/**
 * Lot 5, tâche 5.10 — page de pilotage, onglets Équipe et Caisse (contrat, section I).
 *  - GET /api/partner/events/[id]/pilotage/team (RPC pilotage_team) : contrôleurs affectés à
 *    l'événement, avec l'identifiant de l'affectation, le nom, le point d'entrée et la permission espèces ;
 *  - PATCH /api/partner/team/assignments/[id] { canAcceptCash } : par affectation (et non plus pour
 *    tous les événements d'un contrôleur), propriétaire seul, journalisé ; partenaire B → 404, admin
 *    refusé, corps invalide → 400, affectation inconnue → 404 ;
 *  - GET …/pilotage/cash (RPC pilotage_cash) : caisses ouvertes et clôturées (fonds, espèces
 *    encaissées, déclaré hors fonds, écart, justification), espèces par contrôleur, PIN régisseur
 *    { hasPin, updatedAt } sans jamais le haché ; régénération par la route du lot 4, confirmée.
 * Jeu de données et valeurs attendues (calculées à la main) : tests/parcours/pilotage-helpers.ts.
 * Le contrôleur C4 est aussi affecté, sans espèces, à un second événement du même partenaire : le
 * changement de permission ne doit toucher que l'affectation visée.
 * Interprétation (contrat muet) : le journal est une ligne audit_logs dont object_id est l'affectation
 * et user_id le partenaire, mentionnant la permission espèces.
 *
 * Rouge avant correctif :
 *  - aucune route app/api/partner/events/[id]/pilotage/team ni …/cash, ni RPC pilotage_team ou pilotage_cash ;
 *  - aucune route app/api/partner/team/assignments/[id] : seule app/api/partner/team/assignments/route.ts
 *    existe, qui modifie can_accept_cash pour tous les événements demandés du contrôleur, sans contrôle
 *    d'erreur ni journal (app/api/partner/team/assignments/route.ts:226-234) ;
 *  - l'équipe d'un événement n'a ni point d'entrée ni dernière activité (app/api/partner/team/[eventId]/route.ts:15-76) ;
 *  - la caisse calcule ses indicateurs dans le navigateur (app/partner/events/[id]/caisse/page.tsx:125-135) ;
 *  - le jeu de données échoue avant (event_transition, sale_channel, guichet, clôture : voir
 *    pilotage-apercu-ventes.test.ts).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { assertLifecycleInvariants } from '../helpers/lifecycle-invariants';
import { signInAs, type SignedInUser } from '../helpers/fixtures';
import { service } from './paiement-helpers';
import { newPartner, type TestPartner } from './finance-helpers';
import { assignController } from './acces-helpers';
import { createDraftEvent, type DraftEvent } from './cycle-helpers';
import {
    at, buildKnownDataset, dateOf, ENTRY_POINTS, EXPECTED, findItem, fullName, listAt, nullableNumber, numberAt, patchAssignment,
    pilotageOk, regisseurPin, S1_JUSTIFICATION, show, STANDARD, type KnownDataset, type Row,
} from './pilotage-helpers';

let ds: KnownDataset;
let partnerB: TestPartner;
let admin: SignedInUser;
let otherEvent: DraftEvent;

before(async () => {
    ds = await buildKnownDataset('equipe');
    partnerB = await newPartner('pil-equipe-b');
    admin = await signInAs('ADMIN');
    otherEvent = await createDraftEvent(ds.partner, 'pilotage-equipe-autre', [{ name: STANDARD, price: 1_000, total: 5 }]);
    await assignController(ds.partner, ds.c4.userId, otherEvent.eventId, false);
});

after(async () => {
    await assertLifecycleInvariants('pilotage-equipe-caisse');
});

async function cashPermission(eventId: string, userId: string): Promise<boolean> {
    const { data, error } = await service.from('event_controllers').select('can_accept_cash').eq('event_id', eventId).eq('user_id', userId).single();
    assert.equal(error, null, `affectation ${userId} sur ${eventId} : ${error?.message}`);
    return data.can_accept_cash === true;
}

async function pinRow(eventId: string): Promise<Row> {
    const { data, error } = await service.from('event_regisseur_pins').select('*').eq('event_id', eventId).single();
    assert.equal(error, null, `PIN régisseur de l’événement : ${error?.message}`);
    return data as Row;
}

describe('5.10 Équipe : GET …/pilotage/team', () => {
    test('contrôleurs affectés : identifiant d’affectation, nom, point d’entrée, permission espèces ; le contrôleur non affecté absent', async () => {
        const body = await pilotageOk(ds.partner, ds.eventId, 'team', 'le partenaire propriétaire');
        const rows = listAt(body, 'controllers', 'contrôleurs de l’événement');
        assert.equal(rows.length, 3, `trois affectations sur l’événement (C1, C2, C4) : ${JSON.stringify(rows)}`);
        const expected = [
            { key: 'c1' as const, entry: ENTRY_POINTS.c1, cash: true },
            { key: 'c2' as const, entry: ENTRY_POINTS.c2, cash: true },
            { key: 'c4' as const, entry: ENTRY_POINTS.c4, cash: false },
        ];
        for (const e of expected) {
            const ctrl = ds[e.key];
            const row = findItem(rows, 'controller_id', ctrl.userId, `contrôleur ${fullName(ctrl)}`);
            assert.equal(row.assignment_id, ds.assignments[e.key], `${fullName(ctrl)} : identifiant de l’affectation (event_controllers.id)`);
            assert.ok(String(row.name ?? '').includes(ctrl.firstName) && String(row.name ?? '').includes(ctrl.lastName), `${fullName(ctrl)} : nom ${JSON.stringify(row)}`);
            assert.equal(row.entry_point, e.entry, `${fullName(ctrl)} : point d’entrée`);
            assert.equal(row.can_accept_cash, e.cash, `${fullName(ctrl)} : permission espèces`);
        }
        assert.ok(!rows.some((r) => r.controller_id === ds.c3.userId), 'le contrôleur non affecté (tentative refusée) n’est pas dans l’équipe');
    });
});

describe('PATCH /api/partner/team/assignments/[id] { canAcceptCash }', () => {
    test('propriétaire : permission espèces de cette seule affectation, journalisée, visible dans l’onglet Équipe', async () => {
        const t0 = Date.now() - 1_000;
        const res = await patchAssignment(ds.partner, ds.assignments.c4, { canAcceptCash: true });
        assert.equal(res.status, 200, `permission espèces de C4 par le propriétaire : ${show(res)}`);
        assert.equal(await cashPermission(ds.eventId, ds.c4.userId), true, 'affectation de C4 sur l’événement : espèces autorisées');
        assert.equal(await cashPermission(otherEvent.eventId, ds.c4.userId), false, 'affectation de C4 sur l’autre événement : inchangée (modification par affectation)');

        const { data: logs, error } = await service.from('audit_logs').select('*').eq('object_id', ds.assignments.c4).eq('user_id', ds.partner.userId);
        assert.equal(error, null, `audit_logs : ${error?.message}`);
        const fresh = (logs ?? []).filter((l) => new Date(String(l.created_at)).getTime() >= t0);
        assert.ok(fresh.length >= 1, `changement de permission journalisé (audit_logs, objet = affectation, acteur = partenaire) : ${JSON.stringify(logs)}`);
        assert.ok(fresh.some((l) => /accept_?cash/i.test(JSON.stringify(l))), `le journal mentionne la permission espèces : ${JSON.stringify(fresh)}`);

        const body = await pilotageOk(ds.partner, ds.eventId, 'team', 'le partenaire propriétaire');
        const row = findItem(listAt(body, 'controllers', 'contrôleurs'), 'assignment_id', ds.assignments.c4, 'affectation de C4');
        assert.equal(row.can_accept_cash, true, 'onglet Équipe : permission espèces de C4 mise à jour');
    });

    test('partenaire B : 404 sans effet ; admin : refusé ; corps invalide : 400 ; affectation inconnue : 404', async () => {
        assert.equal(await cashPermission(ds.eventId, ds.c4.userId), true, 'garde-fou : permission accordée par le test précédent');
        const byB = await patchAssignment(partnerB, ds.assignments.c4, { canAcceptCash: false });
        assert.equal(byB.status, 404, `partenaire B : 404 attendu, ${show(byB)}`);
        assert.ok(!JSON.stringify(byB.body).includes(ds.c4.lastName), `partenaire B : aucune donnée de l’affectation : ${show(byB)}`);
        assert.equal(await cashPermission(ds.eventId, ds.c4.userId), true, 'partenaire B : affectation inchangée');

        const byAdmin = await patchAssignment(admin, ds.assignments.c4, { canAcceptCash: false });
        assert.ok([403, 404].includes(byAdmin.status), `admin : modification réservée au propriétaire (403 ou 404), ${show(byAdmin)}`);
        assert.equal(await cashPermission(ds.eventId, ds.c4.userId), true, 'admin : affectation inchangée');

        const invalid = await patchAssignment(ds.partner, ds.assignments.c4, { canAcceptCash: 'oui' });
        assert.equal(invalid.status, 400, `corps invalide (canAcceptCash non booléen) : 400 attendu, ${show(invalid)}`);
        assert.equal(typeof invalid.body.error, 'string', `corps invalide : message d’erreur : ${show(invalid)}`);
        assert.equal(await cashPermission(ds.eventId, ds.c4.userId), true, 'corps invalide : affectation inchangée');

        const unknown = await patchAssignment(ds.partner, randomUUID(), { canAcceptCash: false });
        assert.equal(unknown.status, 404, `affectation inconnue : 404 attendu, ${show(unknown)}`);
    });
});

describe('5.10 Caisse : GET …/pilotage/cash', () => {
    test('caisses ouvertes et clôturées : fonds, espèces encaissées, déclaré hors fonds, écart, justification', async () => {
        const body = await pilotageOk(ds.partner, ds.eventId, 'cash', 'le partenaire propriétaire');
        const rows = listAt(body, 'shifts', 'caisses de l’événement');
        assert.equal(rows.length, 2, `deux caisses (S1 clôturée, S2 ouverte) : ${JSON.stringify(rows)}`);
        const s1 = findItem(rows, 'id', ds.shifts.s1, 'caisse S1');
        const e1 = EXPECTED.shifts.s1;
        assert.equal(s1.controller_id, ds.c1.userId, 'S1 : caisse de C1');
        assert.equal(s1.status, e1.status, 'S1 : clôturée');
        assert.equal(numberAt(s1, 'opening_float', 'S1 : fonds'), e1.opening_float, 'S1 : fonds de caisse');
        assert.equal(numberAt(s1, 'cash_collected', 'S1 : encaissé'), e1.cash_collected, 'S1 : espèces encaissées = 5 000 au scan + 2 000 au guichet');
        assert.equal(numberAt(s1, 'declared', 'S1 : déclaré'), e1.declared, 'S1 : déclaré hors fonds');
        assert.equal(numberAt(s1, 'difference', 'S1 : écart'), e1.difference, 'S1 : écart = déclaré − encaissé = −500');
        assert.equal(s1.justification, S1_JUSTIFICATION, 'S1 : justification de l’écart');

        const s2 = findItem(rows, 'id', ds.shifts.s2, 'caisse S2');
        const e2 = EXPECTED.shifts.s2;
        assert.equal(s2.controller_id, ds.c2.userId, 'S2 : caisse de C2');
        assert.equal(s2.status, e2.status, 'S2 : ouverte');
        assert.equal(numberAt(s2, 'opening_float', 'S2 : fonds'), e2.opening_float, 'S2 : fonds de caisse');
        assert.equal(numberAt(s2, 'cash_collected', 'S2 : encaissé'), e2.cash_collected, 'S2 : espèces encaissées au guichet');
        assert.equal(nullableNumber(s2.declared), e2.declared, 'S2 ouverte : rien de déclaré');
        assert.equal(nullableNumber(s2.difference), e2.difference, 'S2 ouverte : pas encore d’écart');
    });

    test('espèces par contrôleur', async () => {
        const body = await pilotageOk(ds.partner, ds.eventId, 'cash', 'le partenaire propriétaire');
        const rows = listAt(body, 'by_controller', 'espèces par contrôleur');
        for (const key of ['c1', 'c2'] as const) {
            const row = findItem(rows, 'controller_id', ds[key].userId, `contrôleur ${fullName(ds[key])}`);
            assert.equal(numberAt(row, 'cash_collected', `${fullName(ds[key])} : espèces`), EXPECTED.cashByController[key], `${fullName(ds[key])} : espèces encaissées`);
        }
        const c4 = rows.find((r) => r.controller_id === ds.c4.userId);
        if (c4) assert.equal(numberAt(c4, 'cash_collected', 'C4 : espèces'), 0, 'C4 : aucune caisse, aucune espèce');
    });

    test('PIN régisseur : hasPin et date de mise à jour, jamais le haché ; régénération confirmée visible', async () => {
        const before = await pinRow(ds.eventId);
        const body = await pilotageOk(ds.partner, ds.eventId, 'cash', 'le partenaire propriétaire');
        assert.equal(at(body, 'pin.hasPin'), true, `PIN régisseur défini : ${JSON.stringify(body.pin)}`);
        const updated = dateOf(at(body, 'pin.updatedAt'), 'date du PIN').getTime();
        assert.ok(Math.abs(updated - new Date(String(before.updated_at)).getTime()) < 1_000, `date du PIN = event_regisseur_pins.updated_at (${before.updated_at}), reçu ${JSON.stringify(body.pin)}`);
        const json = JSON.stringify(body);
        assert.ok(!json.includes(String(before.pin_hash)), 'le haché du PIN n’est jamais renvoyé');
        assert.ok(!/pin_hash|pin_salt/.test(json), `aucun champ de haché ou de sel : ${JSON.stringify(body.pin)}`);

        // Régénération (route du lot 4) : confirmation exigée, puis confirmation des caisses ouvertes (S2)
        const blocked = await regisseurPin(ds.partner, ds.eventId, { confirm: true });
        assert.equal(blocked.status, 409, `garde-fou (lot 4) : caisse ouverte → 409 OPEN_SHIFTS, ${show(blocked)}`);
        const regen = await regisseurPin(ds.partner, ds.eventId, { confirm: true, confirmOpenShifts: true });
        assert.equal(regen.status, 200, `régénération confirmée : ${show(regen)}`);
        const afterBody = await pilotageOk(ds.partner, ds.eventId, 'cash', 'le partenaire propriétaire');
        const after = dateOf(at(afterBody, 'pin.updatedAt'), 'date du PIN régénéré').getTime();
        assert.ok(after > updated, `onglet Caisse : date du PIN mise à jour après régénération (${new Date(updated).toISOString()} → ${JSON.stringify(afterBody.pin)})`);
        const pinFields = (afterBody.pin ?? {}) as Record<string, unknown>;
        assert.ok(Object.values(pinFields).every((v) => String(v) !== String(regen.body.pin)),
            `le PIN en clair n’est pas renvoyé par l’onglet Caisse : ${JSON.stringify(pinFields)}`);
    });
});
