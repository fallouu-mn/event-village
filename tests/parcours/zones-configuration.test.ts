/**
 * Lot 9 ter, tâche 9t.15 (consigne 1 : zones et portes) — configuration des zones et des portes par la partenaire,
 * affectation d'une porte à un contrôleur, changement de porte par le contrôleur (contrat 5.C, C.1.2 F30 à F34, C.1.5,
 * 4.3, 11.3 ; EC6 ZONE_IN_USE). Toutes les routes avec le jeton de l'acteur.
 *  1. validations : un refus par code, statut et texte exacts, rien d'écrit (GET inchangé, aucun audit) ;
 *  2. droits et statuts : partenaire B 404, admin events.read en lecture seule, EN_ATTENTE, TERMINE, BROUILLON ;
 *  3. catégorie créée après les zones : admise par toutes les zones d'entrée, jamais par un contrôle (trigger F34) ;
 *  4. porte déjà scannée : ni supprimée ni déplacée ; zone scannée : type figé ; renommage propagé au point d'entrée ;
 *  5. porte affectée : suppression refusée tant qu'un contrôleur y est ;
 *  6. échange de noms entre deux zones dans un même enregistrement ;
 *  7. point d'entrée en texte libre refusé sur un événement à zones (GATES_CONFIGURED), inchangé sans zone ;
 *  8. changement de porte par le contrôleur : refusé sans autorisation, puis accepté et journalisé ; scan suivant
 *     avec l'ancienne porte → GATE_CHANGED ;
 *  9. retour à une seule entrée : tables vides, scan sans porte vert avec la zone implicite ;
 * 10. double clic : deux enregistrements identiques simultanés, mêmes identifiants, deux audits ;
 * 11. affectation de porte : droits (partenaire B, admin sans events.write, porte d'un autre événement).
 *
 * Écart tranché (à reporter au rapport) : le schéma Zod du PUT (4.3) borne `zones` à 20, ce qui rendrait 400
 * INVALID_FIELD pour 21 zones ; le cas 1 exige le code TOO_MANY_ZONES et son texte, que la table 4.3 liste parmi
 * les refus du PUT (le correctif borne Zod au-delà de 20 ou rend ce code pour un tableau trop long).
 *
 * Rouge avant correctif (fix(9t.15), migration 20261110000009) : routes app/api/partner/events/[id]/zones,
 * app/api/partner/team/gate, app/api/controller/gates et app/api/controller/gate absentes (chaque cas échoue en les
 * nommant, par zones-helpers) ; cas 7 : entry-point accepte un texte libre ; aucun cas vert par accident (le témoin
 * Z0 du cas 7 n'est atteint qu'après le refus attendu sur l'événement à zones).
 * after() : assertLot9terInvariants.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { assertLot9terInvariants } from '../helpers/lot9ter-invariants';
import { routeContext } from './helpers';
import { newBuyer, service, type Buyer, type CategorySpec, type SaleEvent } from './paiement-helpers';
import { buyConfirmed, newPartner, type TestPartner } from './finance-helpers';
import { authed, createTimedEvent, newController, ticketPayload, type RouteResult } from './acces-helpers';
import { newAdmin } from './notif-helpers';
import { invoke, routeHandler } from './pilotage-helpers';
import {
    assignGate, controllerGates, createZonedEvent, gateOf, getZones, saveZones, scanAtGate, selectGate,
    type ZonedEvent, type ZoneSpec,
} from './zones-helpers';

type Row = Record<string, unknown>;

const SIMPLE = 'SIMPLE';
const VIP = 'VIP';
const VVIP = 'VVIP';
const CATEGORIES: CategorySpec[] = [
    { name: SIMPLE, price: 5_000, total: 30 },
    { name: VIP, price: 20_000, total: 20 },
    { name: VVIP, price: 50_000, total: 5 },
];
const ZONES: ZoneSpec[] = [
    { name: 'Entrée générale', kind: 'ENTREE', admits: [SIMPLE], gates: ['Porte Nord', 'Porte Sud'] },
    { name: 'Entrée VIP', kind: 'ENTREE', admits: [VIP, VVIP], gates: ['Porte VIP'] },
    { name: 'Carré VIP', kind: 'CONTROLE', admits: [VIP, VVIP], gates: ['Accès carré'] },
];

let partner: TestPartner;
let partnerB: TestPartner;
let buyer: Buyer;

before(async () => {
    partner = await newPartner('zones-config');
    partnerB = await newPartner('zones-config-b');
    buyer = await newBuyer('zones-config');
});

after(async () => {
    await assertLot9terInvariants('zones-configuration');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

function show(r: RouteResult): string {
    return `HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 900)}`;
}

function zonedEvent(label: string, zones: ZoneSpec[] = ZONES): Promise<ZonedEvent> {
    return createZonedEvent(partner, `zones-config ${label}`, CATEGORIES, zones);
}

interface GateBody { id?: string; name: string }
interface ZoneBody { id?: string; name: string; kind: string; position?: number; category_ids: string[]; gates: GateBody[] }

/** Configuration complète lue par GET (identifiants compris), prête à renvoyer par PUT. */
async function currentConfig(caller: Pick<Buyer, 'accessToken'>, eventId: string): Promise<ZoneBody[]> {
    const r = await getZones(caller, eventId);
    assert.equal(r.status, 200, `GET des zones : ${show(r)}`);
    const zones = (Array.isArray(r.body.zones) ? r.body.zones : []) as Row[];
    return zones.map((z) => ({
        id: String(z.id), name: String(z.name), kind: String(z.kind), position: Number(z.position),
        category_ids: (z.category_ids as string[]).slice(),
        gates: ((z.gates as Row[]) ?? []).map((g) => ({ id: String(g.id), name: String(g.name) })),
    }));
}

/** Configuration d'une seule zone d'entrée qui admet toutes les catégories (corps de PUT valide). */
function singleEntrance(ev: SaleEvent): { zones: ZoneBody[] } {
    return { zones: [{ name: 'Entrée', kind: 'ENTREE', category_ids: Object.values(ev.categories).map((c) => c.id), gates: [{ name: 'Entrée' }] }] };
}

function zoneByName(config: ZoneBody[], name: string): ZoneBody {
    const z = config.find((c) => c.name === name);
    assert.ok(z, `zone ${name} dans la configuration (${config.map((c) => c.name).join(', ')})`);
    return z;
}

function assertRefusal(r: RouteResult, status: number, code: string, text: string | RegExp, what: string): void {
    assert.equal(r.status, status, `${what} : ${show(r)}`);
    assert.equal(r.body.code, code, `${what} : ${show(r)}`);
    if (typeof text === 'string') assert.equal(r.body.error, text, `${what} : texte exact (C.1.2) : ${show(r)}`);
    else assert.match(String(r.body.error), text, `${what} : texte (C.1.2) : ${show(r)}`);
}

async function zonesAudits(eventId: string): Promise<Row[]> {
    const { data, error } = await service.from('audit_logs').select('*').eq('action', 'EVENT_ZONES_UPDATED').eq('object_id', eventId).order('created_at');
    assert.equal(error, null, `audit : ${error?.message}`);
    return (data ?? []) as Row[];
}

async function auditsOf(userId: string, action: string): Promise<Row[]> {
    const { data, error } = await service.from('audit_logs').select('*').eq('user_id', userId).eq('action', action).order('created_at');
    assert.equal(error, null, `audit ${action} : ${error?.message}`);
    return (data ?? []) as Row[];
}

async function controllerRow(eventId: string, userId: string): Promise<Row> {
    const { data, error } = await service.from('event_controllers').select('*').eq('event_id', eventId).eq('user_id', userId).single();
    assert.equal(error, null, `affectation : ${error?.message}`);
    return data as Row;
}

async function oneTicket(ev: SaleEvent, category: string): Promise<string> {
    const [t] = (await buyConfirmed(buyer, ev, [[category, 1]])).tickets;
    assert.ok(t, `billet ${category}`);
    return String(t.id);
}

// ── 1. Validations ─────────────────────────────────────────────────────────

describe('9t.15 Zones : validations', () => {
    test('1. validations : chaque refus, rien d’écrit', async () => {
        const ev = await zonedEvent('validations');
        const other = await createTimedEvent(partner.partnerId, 'zones-config autre', [{ name: SIMPLE, price: 1_000, total: 5 }]);
        const before = await getZones(partner, ev.eventId);
        assert.equal(before.status, 200, show(before));
        const auditsBefore = (await zonesAudits(ev.eventId)).length;
        const all = Object.values(ev.categories).map((c) => c.id);
        const [s, v, vv] = [ev.categories[SIMPLE].id, ev.categories[VIP].id, ev.categories[VVIP].id];
        const entry = (name: string, cats: string[], gates: string[]): ZoneBody => ({ name, kind: 'ENTREE', category_ids: cats, gates: gates.map((g) => ({ name: g })) });
        const control = (name: string, cats: string[], gates: string[]): ZoneBody => ({ name, kind: 'CONTROLE', category_ids: cats, gates: gates.map((g) => ({ name: g })) });
        const gatesNamed = (prefix: string, n: number): string[] => Array.from({ length: n }, (_, i) => `${prefix} ${i + 1}`);

        const cases: Array<[string, { zones: ZoneBody[] }, number, string, string | RegExp, string | undefined]> = [
            ['nom de zone de 41 caractères', { zones: [entry('x'.repeat(41), all, ['Porte A'])] }, 400, 'ZONE_NAME_INVALID',
                'Donnez à chaque zone un nom de 1 à 40 caractères.', 'zones.0.name'],
            ['21 zones', { zones: Array.from({ length: 21 }, (_, i) => entry(`Zone ${i + 1}`, all, [`Porte ${i + 1}`])) }, 400, 'TOO_MANY_ZONES',
                '20 zones au plus par événement.', undefined],
            ['51 portes', { zones: [entry('Zone A', all, gatesNamed('Porte A', 26)), entry('Zone B', all, gatesNamed('Porte B', 25))] }, 400, 'TOO_MANY_GATES',
                '50 portes au plus par événement.', undefined],
            ['« VIP » et « vip »', { zones: [entry('VIP', all, ['Porte A']), entry('vip', all, ['Porte B'])] }, 409, 'ZONE_NAME_TAKEN',
                /^Deux zones portent le nom (VIP|vip) : choisissez des noms différents\.$/, undefined],
            ['deux portes de même nom', { zones: [entry('Zone A', all, ['Porte A']), entry('Zone B', all, ['Porte A'])] }, 409, 'GATE_NAME_TAKEN',
                'Deux portes portent le nom Porte A : choisissez des noms différents.', undefined],
            ['zone sans porte', { zones: [entry('Entrée générale', all, [])] }, 409, 'ZONE_WITHOUT_GATE',
                'La zone Entrée générale n’a aucune porte : ajoutez-en au moins une.', undefined],
            ['zone sans catégorie', { zones: [entry('Entrée générale', all, ['Porte A']), control('Carré VIP', [], ['Accès carré'])] }, 409, 'ZONE_WITHOUT_CATEGORY',
                'La zone Carré VIP n’admet aucune catégorie : cochez-en au moins une.', undefined],
            ['une seule zone de contrôle', { zones: [control('Carré VIP', all, ['Accès carré'])] }, 409, 'NO_ENTRANCE_ZONE',
                'Il faut au moins une zone de type Entrée : c’est là que les billets sont compostés.', undefined],
            ['VVIP admise seulement au carré', { zones: [entry('Entrée générale', [s, v], ['Porte A']), control('Carré VIP', [v, vv], ['Accès carré'])] }, 409,
                'CATEGORY_WITHOUT_ENTRANCE', 'La catégorie VVIP n’entre par aucune zone de type Entrée : cochez-la dans une zone d’entrée.', undefined],
            ['catégorie d’un autre événement', { zones: [entry('Entrée générale', [...all, other.categories[SIMPLE].id], ['Porte A'])] }, 400, 'INVALID_INPUT',
                'Demande invalide.', 'zones.0.category_ids'],
        ];
        for (const [label, body, status, code, text, field] of cases) {
            const r = await saveZones(partner, ev.eventId, body);
            assertRefusal(r, status, code, text, label);
            if (field !== undefined) assert.equal(r.body.field, field, `${label} : champ ${field} : ${show(r)}`);
            const now = await getZones(partner, ev.eventId);
            assert.deepEqual(now.body, before.body, `${label} : configuration inchangée`);
        }
        assert.equal((await zonesAudits(ev.eventId)).length, auditsBefore, 'aucun audit EVENT_ZONES_UPDATED pour un refus');
    });
});

// ── 2. Droits et statuts ───────────────────────────────────────────────────

describe('9t.15 Zones : droits et statuts', () => {
    test('2. droits et statuts', async () => {
        const ev = await zonedEvent('droits');
        const body = { zones: await currentConfig(partner, ev.eventId) };
        for (const [label, r] of [['GET', await getZones(partnerB, ev.eventId)], ['PUT', await saveZones(partnerB, ev.eventId, body)]] as Array<[string, RouteResult]>) {
            assert.equal(r.status, 404, `partenaire B, ${label} : ${show(r)}`);
            assert.equal(r.body.code, 'EVENT_NOT_FOUND', `partenaire B, ${label} : ${show(r)}`);
        }
        const reader = await newAdmin('zones-lecture', ['events.read']);
        const read = await getZones(reader, ev.eventId);
        assert.equal(read.status, 200, show(read));
        assert.equal(read.body.can_edit, false, show(read));
        assert.equal(read.body.edit_block, 'Seul l’organisateur modifie les zones de son événement.', show(read));
        assert.equal(read.body.configured, true, show(read));
        const write = await saveZones(reader, ev.eventId, body);
        assert.equal(write.status, 403, show(write));
        assert.equal(write.body.code, 'ADMIN_CANNOT_EDIT', show(write));

        const pending = await createTimedEvent(partner.partnerId, 'zones-config en attente', CATEGORIES, { startsInHours: 72, status: 'EN_ATTENTE' });
        const pendingRes = await saveZones(partner, pending.eventId, singleEntrance(pending));
        assert.equal(pendingRes.status, 409, show(pendingRes));
        assert.equal(pendingRes.body.code, 'WITHDRAW_TO_EDIT', show(pendingRes));
        const ended = await createTimedEvent(partner.partnerId, 'zones-config terminé', CATEGORIES, { startsInHours: -8, durationHours: 2, status: 'TERMINE' });
        const endedRes = await saveZones(partner, ended.eventId, singleEntrance(ended));
        assert.equal(endedRes.status, 409, show(endedRes));
        assert.equal(endedRes.body.code, 'EVENT_LOCKED', show(endedRes));
        const draft = await createTimedEvent(partner.partnerId, 'zones-config brouillon', CATEGORIES, { startsInHours: 72, status: 'BROUILLON' });
        const draftRes = await saveZones(partner, draft.eventId, singleEntrance(draft));
        assert.equal(draftRes.status, 200, show(draftRes));
        assert.equal(draftRes.body.message, 'Zones enregistrées.', show(draftRes));
        assert.equal(draftRes.body.configured, true, show(draftRes));
    });
});

// ── 3. Catégorie créée après les zones ─────────────────────────────────────

describe('9t.15 Zones : catégorie nouvelle', () => {
    test('3. catégorie créée après les zones : admise par toutes les zones d’entrée, jamais par un contrôle', async () => {
        const ev = await zonedEvent('categorie');
        const post = await routeHandler('../../app/api/partner/events/[id]/categories/route', 'POST', 'POST /api/partner/events/[id]/categories');
        const name = 'Étudiant';
        const created = await invoke(post, authed(`/api/partner/events/${ev.eventId}/categories`, 'POST', partner, { name, price: 2_000, total_quantity: 10 }),
            routeContext({ id: ev.eventId }));
        assert.ok(created.status === 200 || created.status === 201, `catégorie créée : ${show(created)}`);
        const { data, error } = await service.from('ticket_categories').select('id').eq('event_id', ev.eventId).eq('name', name).single();
        assert.equal(error, null, `catégorie ${name} : ${error?.message}`);
        const config = await currentConfig(partner, ev.eventId);
        for (const zone of ['Entrée générale', 'Entrée VIP']) {
            assert.ok(zoneByName(config, zone).category_ids.includes(data.id), `${zone} admet la catégorie nouvelle (trigger F34) : ${JSON.stringify(config)}`);
        }
        assert.ok(!zoneByName(config, 'Carré VIP').category_ids.includes(data.id), `le carré (contrôle) ne l’admet pas : ${JSON.stringify(config)}`);
    });
});

// ── 4 et 5. Portes en usage ou affectées ───────────────────────────────────

describe('9t.15 Zones : portes en usage', () => {
    test('4. porte déjà scannée : ni supprimée ni déplacée ; zone scannée : type figé', async () => {
        const ev = await zonedEvent('usage');
        const id = await oneTicket(ev, SIMPLE);
        const scanned = await scanAtGate(partner, { eventId: ev.eventId, payload: await ticketPayload(id) }, gateOf(ev, 'Porte Nord'));
        assert.equal(scanned.body.result, 'valid', `scan de la propriétaire à la Porte Nord : ${show(scanned)}`);
        const base = await currentConfig(partner, ev.eventId);
        const clone = (): ZoneBody[] => JSON.parse(JSON.stringify(base)) as ZoneBody[];
        const gateInUse = 'La porte Porte Nord a déjà servi au contrôle : elle ne peut être ni supprimée ni changée de zone.';

        const removed = clone();
        zoneByName(removed, 'Entrée générale').gates = zoneByName(removed, 'Entrée générale').gates.filter((g) => g.name !== 'Porte Nord');
        assertRefusal(await saveZones(partner, ev.eventId, { zones: removed }), 409, 'GATE_IN_USE', gateInUse, 'suppression de la Porte Nord');

        const moved = clone();
        const nord = zoneByName(moved, 'Entrée générale').gates.find((g) => g.name === 'Porte Nord')!;
        zoneByName(moved, 'Entrée générale').gates = zoneByName(moved, 'Entrée générale').gates.filter((g) => g.name !== 'Porte Nord');
        zoneByName(moved, 'Entrée VIP').gates.push(nord);
        assertRefusal(await saveZones(partner, ev.eventId, { zones: moved }), 409, 'GATE_IN_USE', gateInUse, 'déplacement de la Porte Nord');

        const retyped = clone();
        zoneByName(retyped, 'Entrée générale').kind = 'CONTROLE';
        zoneByName(retyped, 'Entrée VIP').category_ids.push(ev.categories[SIMPLE].id);
        assertRefusal(await saveZones(partner, ev.eventId, { zones: retyped }), 409, 'ZONE_IN_USE',
            'La zone Entrée générale a déjà servi au contrôle : son type ne peut plus changer et elle ne peut plus être supprimée.', 'type de la zone scannée');

        const ctrl = await newController(partner, ev.eventId, { label: 'zc-renomme' });
        const assigned = await assignGate(partner, ev.eventId, ctrl.userId, gateOf(ev, 'Porte Nord'));
        assert.equal(assigned.status, 200, show(assigned));
        const renamed = clone();
        zoneByName(renamed, 'Entrée générale').gates.find((g) => g.name === 'Porte Nord')!.name = 'Porte Nord-Est';
        const ok = await saveZones(partner, ev.eventId, { zones: renamed });
        assert.equal(ok.status, 200, `renommage de la Porte Nord : ${show(ok)}`);
        assert.equal((await controllerRow(ev.eventId, ctrl.userId)).entry_point, 'Porte Nord-Est', 'point d’entrée du contrôleur suivi');
    });

    test('5. porte affectée : suppression refusée tant qu’un contrôleur y est', async () => {
        const ev = await zonedEvent('affectee');
        const ctrl = await newController(partner, ev.eventId, { label: 'zc-affecte' });
        assert.equal((await assignGate(partner, ev.eventId, ctrl.userId, gateOf(ev, 'Porte Sud'))).status, 200);
        const config = await currentConfig(partner, ev.eventId);
        zoneByName(config, 'Entrée générale').gates = zoneByName(config, 'Entrée générale').gates.filter((g) => g.name !== 'Porte Sud');
        assertRefusal(await saveZones(partner, ev.eventId, { zones: config }), 409, 'GATE_ASSIGNED',
            'Des contrôleurs sont affectés à la porte Porte Sud : changez d’abord leur porte dans l’équipe.', 'suppression d’une porte affectée');
        const removed = await assignGate(partner, ev.eventId, ctrl.userId, null);
        assert.equal(removed.status, 200, show(removed));
        assert.equal(removed.body.gate, null, show(removed));
        const ok = await saveZones(partner, ev.eventId, { zones: config });
        assert.equal(ok.status, 200, `suppression après retrait de la porte : ${show(ok)}`);
        const after0 = await currentConfig(partner, ev.eventId);
        assert.deepEqual(zoneByName(after0, 'Entrée générale').gates.map((g) => g.name), ['Porte Nord'], 'Porte Sud supprimée');
    });
});

// ── 6. Échange de noms ─────────────────────────────────────────────────────

describe('9t.15 Zones : échange de noms', () => {
    test('6. échange de noms entre deux zones dans un même enregistrement', async () => {
        const ev = await zonedEvent('echange', [
            { name: 'A', kind: 'ENTREE', admits: [SIMPLE], gates: ['Porte A'] },
            { name: 'B', kind: 'ENTREE', admits: [VIP, VVIP], gates: ['Porte B'] },
        ]);
        const config = await currentConfig(partner, ev.eventId);
        const [a, b] = [zoneByName(config, 'A'), zoneByName(config, 'B')];
        a.name = 'B';
        b.name = 'A';
        const r = await saveZones(partner, ev.eventId, { zones: [a, b] });
        assert.equal(r.status, 200, `échange A ↔ B (aucune 23505) : ${show(r)}`);
        const after0 = await currentConfig(partner, ev.eventId);
        assert.equal(after0.find((z) => z.id === a.id)?.name, 'B', JSON.stringify(after0));
        assert.equal(after0.find((z) => z.id === b.id)?.name, 'A', JSON.stringify(after0));
    });
});

// ── 7. Point d'entrée en texte libre ───────────────────────────────────────

describe('9t.15 Zones : point d’entrée en texte libre', () => {
    test('7. point d’entrée en texte libre refusé sur un événement à zones', async () => {
        const ev = await zonedEvent('point-entree');
        const ctrl = await newController(partner, ev.eventId, { label: 'zc-point' });
        const handler = await routeHandler('../../app/api/partner/team/entry-point/route', 'PATCH', 'PATCH /api/partner/team/entry-point');
        const refused = await invoke(handler, authed('/api/partner/team/entry-point', 'PATCH', partner, { controllerId: ctrl.userId, eventId: ev.eventId, entryPoint: 'Portail libre' }));
        assertRefusal(refused, 409, 'GATES_CONFIGURED', 'Cet événement a des portes : choisissez la porte du contrôleur dans la liste.', 'texte libre sur un événement à zones');
        assert.equal((await controllerRow(ev.eventId, ctrl.userId)).entry_point ?? null, null, 'point d’entrée inchangé');

        const ev0 = await createTimedEvent(partner.partnerId, 'zones-config Z0 point', CATEGORIES);
        const ctrl0 = await newController(partner, ev0.eventId, { label: 'zc-point-z0' });
        const ok = await invoke(handler, authed('/api/partner/team/entry-point', 'PATCH', partner, { controllerId: ctrl0.userId, eventId: ev0.eventId, entryPoint: 'Portail libre' }));
        assert.equal(ok.status, 200, `sans zone : inchangé : ${show(ok)}`);
        assert.equal((await controllerRow(ev0.eventId, ctrl0.userId)).entry_point, 'Portail libre');
    });
});

// ── 8. Changement de porte par le contrôleur ───────────────────────────────

describe('9t.15 Zones : changement de porte par le contrôleur', () => {
    test('8. changement de porte par le contrôleur : refusé sans autorisation, puis accepté et journalisé', async () => {
        const ev = await zonedEvent('changement');
        const ctrl = await newController(partner, ev.eventId, { label: 'zc-change' });
        assert.equal((await assignGate(partner, ev.eventId, ctrl.userId, gateOf(ev, 'Porte Nord'))).status, 200);
        const notAllowed = 'L’organisateur ne vous autorise pas à changer de porte.';
        assertRefusal(await selectGate(ctrl, ev.eventId, gateOf(ev, 'Porte Sud')), 403, 'GATE_CHANGE_NOT_ALLOWED', notAllowed, 'changement sans autorisation');
        const gatesRefused = await controllerGates(ctrl, ev.eventId);
        assert.equal(gatesRefused.status, 403, show(gatesRefused));
        assert.equal(gatesRefused.body.code, 'GATE_CHANGE_NOT_ALLOWED', show(gatesRefused));

        const allowed = await assignGate(partner, ev.eventId, ctrl.userId, gateOf(ev, 'Porte Nord'), { canChange: true });
        assert.equal(allowed.status, 200, show(allowed));
        assert.equal(allowed.body.gate_change_allowed, true, show(allowed));
        const gates = await controllerGates(ctrl, ev.eventId);
        assert.equal(gates.status, 200, show(gates));
        assert.equal(gates.body.configured, true, show(gates));
        assert.deepEqual(((gates.body.gates as Row[]) ?? []).map((g) => g.name).sort(), ['Accès carré', 'Porte Nord', 'Porte Sud', 'Porte VIP'], show(gates));
        const chosen = await selectGate(ctrl, ev.eventId, gateOf(ev, 'Porte Sud'));
        assert.equal(chosen.status, 200, show(chosen));
        assert.equal((chosen.body.gate as Row | undefined)?.name, 'Porte Sud', show(chosen));
        const row = await controllerRow(ev.eventId, ctrl.userId);
        assert.equal(row.gate_id, gateOf(ev, 'Porte Sud'));
        assert.equal(row.entry_point, 'Porte Sud');

        const set = await auditsOf(partner.userId, 'CONTROLLER_GATE_SET');
        const changed = await auditsOf(ctrl.userId, 'CONTROLLER_GATE_CHANGED');
        const mine = set.filter((a) => (a.metadata as Row).controller_id === ctrl.userId);
        assert.equal(mine.length, 2, `deux affectations journalisées : ${JSON.stringify(mine)}`);
        assert.equal(changed.length, 1, `un changement journalisé : ${JSON.stringify(changed)}`);
        assert.deepEqual(changed[0].metadata, { event_id: ev.eventId, from_gate_id: gateOf(ev, 'Porte Nord'), to_gate_id: gateOf(ev, 'Porte Sud') }, JSON.stringify(changed[0]));
        assert.ok(Date.parse(String(changed[0].created_at)) >= Date.parse(String(mine[1].created_at)), 'le changement suit l’affectation');

        const id = await oneTicket(ev, SIMPLE);
        const stale = await scanAtGate(ctrl, { eventId: ev.eventId, payload: await ticketPayload(id) }, gateOf(ev, 'Porte Nord'));
        assert.equal(stale.status, 409, show(stale));
        assert.equal(stale.body.code, 'GATE_CHANGED', show(stale));
    });
});

// ── 9 et 10. Retour à une seule entrée, double clic ────────────────────────

describe('9t.15 Zones : retour à une seule entrée et double clic', () => {
    test('9. retour à une seule entrée', async () => {
        const ev = await zonedEvent('retour');
        const r = await saveZones(partner, ev.eventId, { zones: [] });
        assert.equal(r.status, 200, show(r));
        assert.equal(r.body.configured, false, show(r));
        assert.deepEqual(r.body.zones, [], show(r));
        for (const table of ['event_zones', 'event_gates', 'zone_categories']) {
            const { count, error } = await service.from(table).select('event_id', { count: 'exact', head: true }).eq('event_id', ev.eventId);
            assert.equal(error, null, `${table} : ${error?.message}`);
            assert.equal(count, 0, `${table} vide pour l’événement`);
        }
        const ctrl = await newController(partner, ev.eventId, { label: 'zc-retour' });
        const id = await oneTicket(ev, VIP);
        const scanned = await scanAtGate(ctrl, { eventId: ev.eventId, payload: await ticketPayload(id) }, undefined);
        assert.equal(scanned.body.result, 'valid', show(scanned));
        assert.equal((scanned.body.zone as Row | undefined)?.implicit, true, show(scanned));
    });

    test('10. double clic : deux enregistrements identiques simultanés', async () => {
        const ev = await zonedEvent('double-clic');
        const config = await currentConfig(partner, ev.eventId);
        const auditsBefore = (await zonesAudits(ev.eventId)).length;
        const [a, b] = await Promise.all([saveZones(partner, ev.eventId, { zones: config }), saveZones(partner, ev.eventId, { zones: config })]);
        assert.equal(a.status, 200, show(a));
        assert.equal(b.status, 200, show(b));
        const after0 = await currentConfig(partner, ev.eventId);
        const ids = (c: ZoneBody[]): string[] => c.flatMap((z) => [String(z.id), ...z.gates.map((g) => String(g.id))]).sort();
        assert.deepEqual(ids(after0), ids(config), 'mêmes identifiants de zones et de portes');
        assert.equal((await zonesAudits(ev.eventId)).length, auditsBefore + 2, 'deux audits EVENT_ZONES_UPDATED');
    });
});

// ── 11. Affectation de porte : droits ──────────────────────────────────────

describe('9t.15 Zones : affectation de porte, droits', () => {
    test('11. affectation de porte : droits', async () => {
        const ev = await zonedEvent('affectation-droits');
        const other = await zonedEvent('affectation-autre');
        const ctrl = await newController(partner, ev.eventId, { label: 'zc-droits' });
        const byB = await assignGate(partnerB, ev.eventId, ctrl.userId, gateOf(ev, 'Porte Nord'));
        assert.equal(byB.status, 404, show(byB));
        assert.equal(byB.body.code, 'EVENT_NOT_FOUND', show(byB));
        const reader = await newAdmin('zones-affect', ['events.read']);
        const byReader = await assignGate(reader, ev.eventId, ctrl.userId, gateOf(ev, 'Porte Nord'));
        assert.equal(byReader.status, 403, show(byReader));
        assert.equal(byReader.body.code, 'PERMISSION_MISSING', show(byReader));
        assertRefusal(await assignGate(partner, ev.eventId, ctrl.userId, gateOf(other, 'Porte Nord')), 409, 'GATE_INVALID',
            'Porte inconnue : choisissez une porte de cet événement.', 'porte d’un autre événement');
        assert.equal((await controllerRow(ev.eventId, ctrl.userId)).gate_id ?? null, null, 'aucune porte posée');
    });
});
