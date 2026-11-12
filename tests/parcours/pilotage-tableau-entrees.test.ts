/**
 * Lot 9 ter, tâche 9t.18 (consigne 4 : tableau de bord des entrées ; consigne 3 : validations par la liste « à part ») —
 * GET /api/partner/events/[id]/pilotage/entries rend les vues par zone, par porte, par catégorie et par origine, le débit,
 * les contrôleurs actifs, les alertes de refus et la liste des invités (contrat 5.D, D.1.2 (5) à (7), D.1.6 T1 ; X3, X36 ;
 * arbitrage 21 ; rectification 3 de D).
 *
 * Montage Z (aide locale, copiée dans pilotage-cloture-entrees, jamais importée d'une suite) : partenaire neuve ;
 * createZonedEvent (signature de C.7) avec SIMPLE 5 000 F ×10, VIP 15 000 F ×10, VVIP 30 000 F ×5, GRATUIT 0 F ×10 ;
 * zones « Entrée générale » (ENTRÉE : SIMPLE, GRATUIT ; Porte Nord, Porte Sud), « Entrée VIP » (ENTRÉE : VIP, VVIP ;
 * Porte VIP), « Carré VVIP » (CONTRÔLE : VVIP ; Accès carré) ; un contrôleur par porte (PATCH /api/partner/team/gate) ;
 * achats en ligne : acheteur 1 deux SIMPLE, acheteur 2 un VIP et un VVIP ; un GRATUIT (issueFreeTicket, origine FREE) ;
 * une invitation VIP à un numéro sans compte, nom « Awa Diop » (route des invitations). Scans, dans l'ordre :
 * SIMPLE#1 Porte Nord valid ; SIMPLE#1 Porte Sud already_used ; SIMPLE#2 Porte VIP wrong_zone ; VVIP Accès carré
 * not_entered ; VIP puis VVIP Porte VIP valid ; VVIP Accès carré zone_ok ; GRATUIT Porte Sud valid ; charge
 * TCK-INVALIDE-1 Porte Sud refusée ; invitation validée par la liste à la Porte VIP. Attendus : billets attendus 6,
 * total 5, refused 4, zone_checks 1, guest_list.count 1, counter 0.
 *
 * Rouge avant correctif (S-P fix(9t.18), migration 20261110000010 ; C : 20261110000009, 20261110000008) :
 *  - cas 1, 3 : pilotage_entries ne rend ni `configured`, ni `by_zone`, ni `by_gate`, ni `by_origin`, ni `guest_list`,
 *    ni `zone_checks` (M/20261102000005:685-700) ;
 *  - cas 2 à 8 : route des zones absente, createZonedEvent échoue en la nommant (9t.15) ; puis clés absentes ;
 *  - cas 8 : la CTE `att` garde les lignes zone_ok (rectification 3).
 * Témoin vert dès l'écriture : cas 9 (accès inchangé, sur le jeu sans zone).
 * after() : assertLot9terInvariants.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { assertLot9terInvariants } from '../helpers/lot9ter-invariants';
import { randomSenegalPhone } from './helpers';
import { newBuyer, type Buyer, type CategorySpec } from './paiement-helpers';
import { buyConfirmed, newPartner, type TestPartner } from './finance-helpers';
import { newController, ticketPayload, type RouteResult } from './acces-helpers';
import { issueFreeTicket, newAdminWith } from './terrain-helpers';
import {
    EXPECTED, buildKnownDataset, listAt, numberAt, pilotageGet, pilotageOk, show, type KnownDataset, type Row,
} from './pilotage-helpers';
import { assignGate, createZonedEvent, gateOf, guestAdmit, guestSearch, scanAtGate, sendInvitations, type ZonedEvent, type ZoneSpec } from './zones-helpers';

// ── Montage Z (copie locale, contrat D.1.6) ────────────────────────────────

const SIMPLE = 'SIMPLE';
const VIP = 'VIP';
const VVIP = 'VVIP';
const GRATUIT = 'GRATUIT';
const Z_CATEGORIES: CategorySpec[] = [
    { name: SIMPLE, price: 5_000, total: 10 },
    { name: VIP, price: 15_000, total: 10 },
    { name: VVIP, price: 30_000, total: 5 },
    { name: GRATUIT, price: 0, total: 10 },
];
const Z_ZONES: ZoneSpec[] = [
    { name: 'Entrée générale', kind: 'ENTREE', admits: [SIMPLE, GRATUIT], gates: ['Porte Nord', 'Porte Sud'] },
    { name: 'Entrée VIP', kind: 'ENTREE', admits: [VIP, VVIP], gates: ['Porte VIP'] },
    { name: 'Carré VVIP', kind: 'CONTROLE', admits: [VVIP], gates: ['Accès carré'] },
];
const GUEST_NAME = 'Awa Diop';

interface ZMontage {
    partner: TestPartner;
    ev: ZonedEvent;
    ctrl: { nord: Buyer; sud: Buyer; vip: Buyer; carre: Buyer };
    tickets: { simple1: string; simple2: string; vip: string; vvip: string; gratuit: string; invitation: string };
}

function ticketOfCategory(tickets: Row[], ev: ZonedEvent, category: string, what: string): string[] {
    const ids = tickets.filter((t) => t.category_id === ev.categories[category].id).map((t) => String(t.id));
    assert.ok(ids.length > 0, `${what} : billet ${category} émis (${JSON.stringify(tickets.map((t) => t.category_id))})`);
    return ids;
}

/** Scan à une porte, résultat exigé (statut 200 et `result`, ou l'un des résultats permis). */
async function scanExpect(user: Buyer, ev: ZonedEvent, payload: string, gate: string, expected: string | string[], what: string): Promise<RouteResult> {
    const res = await scanAtGate(user, { eventId: ev.eventId, payload }, gateOf(ev, gate));
    assert.equal(res.status, 200, `${what} : ${show(res)}`);
    const allowed = Array.isArray(expected) ? expected : [expected];
    assert.ok(allowed.includes(String(res.body.result)), `${what} : résultat ${allowed.join(' ou ')} attendu, ${show(res)}`);
    return res;
}

async function controllerAt(partner: TestPartner, ev: ZonedEvent, gate: string, label: string): Promise<Buyer> {
    const ctrl = await newController(partner, ev.eventId, { label });
    const res = await assignGate(partner, ev.eventId, ctrl.userId, gateOf(ev, gate));
    assert.equal(res.status, 200, `porte ${gate} attribuée à ${label} (PATCH /api/partner/team/gate) : ${show(res)}`);
    return ctrl;
}

async function buildZ(label: string): Promise<ZMontage> {
    const partner = await newPartner(`pil9ter-${label}`);
    const ev = await createZonedEvent(partner, `pil9ter-${label}`, Z_CATEGORIES, Z_ZONES);
    const ctrl = {
        nord: await controllerAt(partner, ev, 'Porte Nord', `${label}-nord`),
        sud: await controllerAt(partner, ev, 'Porte Sud', `${label}-sud`),
        vip: await controllerAt(partner, ev, 'Porte VIP', `${label}-vip`),
        carre: await controllerAt(partner, ev, 'Accès carré', `${label}-carre`),
    };
    const b1 = await newBuyer(`pil9ter-${label}-1`, { firstName: 'Moussa', lastName: 'Sarr' });
    const b2 = await newBuyer(`pil9ter-${label}-2`, { firstName: 'Khady', lastName: 'Ndiaye' });
    const holder = await newBuyer(`pil9ter-${label}-g`, { firstName: 'Fatou', lastName: 'Gaye' });
    const p1 = await buyConfirmed(b1, ev, [[SIMPLE, 2]]);
    const p2 = await buyConfirmed(b2, ev, [[VIP, 1], [VVIP, 1]]);
    const [simple1, simple2] = ticketOfCategory(p1.tickets, ev, SIMPLE, 'acheteur 1');
    assert.ok(simple2, 'acheteur 1 : deux billets SIMPLE');
    const [vip] = ticketOfCategory(p2.tickets, ev, VIP, 'acheteur 2');
    const [vvip] = ticketOfCategory(p2.tickets, ev, VVIP, 'acheteur 2');
    const gratuit = await issueFreeTicket(ev.eventId, ev.categories[GRATUIT].id, holder);

    const guestPhone = randomSenegalPhone('78');
    const sent = await sendInvitations(partner, ev.eventId, { category_id: ev.categories[VIP].id, phones: [guestPhone], quantity: 1, guest_names: [GUEST_NAME] });
    assert.equal(sent.status, 200, `invitation VIP nommée « ${GUEST_NAME} » (POST …/invitations, 9t.17) : ${show(sent)}`);

    await scanExpect(ctrl.nord, ev, await ticketPayload(simple1), 'Porte Nord', 'valid', 'SIMPLE#1 à la Porte Nord');
    await scanExpect(ctrl.sud, ev, await ticketPayload(simple1), 'Porte Sud', 'already_used', 'SIMPLE#1 à la Porte Sud');
    await scanExpect(ctrl.vip, ev, await ticketPayload(simple2), 'Porte VIP', 'wrong_zone', 'SIMPLE#2 à la Porte VIP');
    await scanExpect(ctrl.carre, ev, await ticketPayload(vvip), 'Accès carré', 'not_entered', 'VVIP au carré avant l’entrée');
    await scanExpect(ctrl.vip, ev, await ticketPayload(vip), 'Porte VIP', 'valid', 'VIP à la Porte VIP');
    await scanExpect(ctrl.vip, ev, await ticketPayload(vvip), 'Porte VIP', 'valid', 'VVIP à la Porte VIP');
    await scanExpect(ctrl.carre, ev, await ticketPayload(vvip), 'Accès carré', 'zone_ok', 'VVIP au carré après l’entrée');
    await scanExpect(ctrl.sud, ev, await ticketPayload(gratuit), 'Porte Sud', 'valid', 'GRATUIT à la Porte Sud');
    await scanExpect(ctrl.sud, ev, 'TCK-INVALIDE-1', 'Porte Sud', ['invalid', 'dynamic_qr_required'], 'charge invalide à la Porte Sud');

    const found = await guestSearch(ctrl.vip, ev.eventId, guestPhone.slice(4));
    assert.equal(found.status, 200, `recherche de l’invitée dans la liste (9t.17) : ${show(found)}`);
    const items = Array.isArray(found.body.items) ? (found.body.items as Row[]) : [];
    assert.equal(items.length, 1, `un groupe pour le numéro invité : ${show(found)}`);
    const ids = Array.isArray(items[0].ticket_ids) ? (items[0].ticket_ids as unknown[]).map(String) : [];
    assert.equal(ids.length, 1, `un billet d’invitation : ${show(found)}`);
    const admitted = await guestAdmit(ctrl.vip, ev.eventId, ids[0], { gateId: gateOf(ev, 'Porte VIP') });
    assert.equal(admitted.status, 200, `validation par la liste à la Porte VIP : ${show(admitted)}`);
    assert.equal(admitted.body.result, 'valid', `invitée entrée par la liste : ${show(admitted)}`);

    return { partner, ev, ctrl, tickets: { simple1, simple2, vip, vvip, gratuit, invitation: ids[0] } };
}

// ── Montages partagés (mémoïsés : un échec de montage rougit chaque cas qui l'utilise, avec sa raison) ─

let known: KnownDataset;
let zMain: Promise<ZMontage> | null = null;

function montageZ(): Promise<ZMontage> {
    zMain ??= buildZ('t1');
    return zMain;
}

before(async () => {
    known = await buildKnownDataset('9ter-sans-zone');
});

after(async () => {
    await assertLot9terInvariants('pilotage-tableau-entrees');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

async function entriesOf(caller: { accessToken: string }, eventId: string, who: string): Promise<Row> {
    return pilotageOk(caller, eventId, 'entries', who);
}

function pick(row: Row, keys: string[]): Row {
    return Object.fromEntries(keys.map((k) => [k, row[k] === undefined ? '(absent)' : row[k]]));
}

function rowNamed(rows: Row[], key: string, value: unknown, what: string): Row {
    const hit = rows.find((r) => r[key] === value);
    assert.ok(hit, `${what} : ligne ${key} = ${JSON.stringify(value)} absente de ${JSON.stringify(rows).slice(0, 1200)}`);
    return hit;
}

function asNumberOrNull(v: unknown): number | null {
    return v === null ? null : Number(v);
}

// ── Cas ────────────────────────────────────────────────────────────────────

describe('9t.18 T1 — tableau de bord des entrées (pilotage_entries)', () => {
    test('sans zone : toutes les clés existantes inchangées, une zone implicite « Entrée », by_gate égal à by_entry_point', async () => {
        const body = await entriesOf(known.partner, known.eventId, 'la partenaire propriétaire');
        assert.equal(numberAt(body, 'total', 'entrées'), EXPECTED.entries.total, 'total inchangé');
        assert.equal(numberAt(body, 'counter', 'guichet'), EXPECTED.entries.counter, 'counter inchangé');
        assert.equal(numberAt(body, 'refused', 'refus'), EXPECTED.entries.refused, 'refused inchangé');
        assert.equal(typeof body.cash_pending, 'number', `cash_pending gardé : ${JSON.stringify(body.cash_pending)}`);
        for (const [point, n] of Object.entries(EXPECTED.byEntryPoint)) {
            assert.equal(numberAt(rowNamed(listAt(body, 'by_entry_point', 'points'), 'entry_point', point, 'by_entry_point'), 'accepted', point), n, `by_entry_point ${point}`);
        }
        const cats = listAt(body, 'by_category', 'catégories');
        for (const [name, exp] of Object.entries(EXPECTED.byCategory)) {
            assert.equal(numberAt(rowNamed(cats, 'category_id', known.categoryIds[name], 'by_category'), 'accepted', name), exp.accepted, `by_category ${name}`);
        }
        const reasons: Record<string, number> = {};
        for (const r of listAt(body, 'refusals_by_reason', 'motifs')) if (Number(r.count) > 0) reasons[String(r.result)] = Number(r.count);
        assert.deepEqual(reasons, EXPECTED.refusalsByReason, 'refusals_by_reason inchangé');
        const attempts = listAt(body, 'repeated_attempts', 'tentatives');
        assert.deepEqual(attempts.map((r) => [r.ticket_id, Number(r.attempts), r.last_result]),
            [[known.tickets.p1a, EXPECTED.repeatedAttempts.attempts, EXPECTED.repeatedAttempts.lastResult]], 'repeated_attempts inchangé');
        assert.equal(listAt(body, 'by_quarter', 'quarts d’heure').reduce((s, q) => s + Number(q.accepted), 0), EXPECTED.entries.total, 'Σ by_quarter = total');

        assert.equal(body.configured, false, `configured faux sans zone : ${JSON.stringify(body.configured)}`);
        const expected = EXPECTED.tickets.sold + EXPECTED.tickets.invitations;
        assert.deepEqual(listAt(body, 'by_zone', 'par zone'),
            [{ zone_id: null, name: 'Entrée', kind: 'ENTREE', implicit: true, expected, entered: EXPECTED.entries.total, checked: null, refused: EXPECTED.entries.refused }],
            'une seule zone implicite « Entrée » (attendus = vendus + invitations de l’aperçu)');
        const gates = listAt(body, 'by_gate', 'par porte').map((g) => ({ name: g.name, accepted: Number(g.accepted), refused: Number(g.refused) }));
        const points = listAt(body, 'by_entry_point', 'par point d’entrée').map((p) => ({ name: p.entry_point, accepted: Number(p.accepted), refused: Number(p.refused) }));
        assert.deepEqual(gates, points, 'sans zone, by_gate = by_entry_point (mêmes points, mêmes nombres, même ordre)');
        assert.deepEqual(body.guest_list, { count: 0, items: [] }, 'aucune validation par la liste');
        assert.equal(body.zone_checks, 0, 'aucun contrôle de zone');
    });

    test('événement à zones : attendus et entrés par zone, par catégorie et par origine ; un contrôle réussi n’est ni une entrée ni un refus', async () => {
        const z = await montageZ();
        const body = await entriesOf(z.partner, z.ev.eventId, 'la partenaire propriétaire');
        assert.equal(body.configured, true, 'configured vrai');
        assert.equal(numberAt(body, 'total', 'entrées'), 5, 'total 5 (SIMPLE#1, VIP, VVIP, GRATUIT, invitation)');
        assert.equal(numberAt(body, 'refused', 'refus'), 4, 'refus 4 (déjà utilisé, mauvaise zone, pas encore entré, charge invalide)');
        assert.equal(numberAt(body, 'zone_checks', 'contrôles de zone'), 1, 'un billet contrôlé au carré');
        const keys = ['zone_id', 'name', 'kind', 'implicit', 'expected', 'entered', 'checked', 'refused'];
        const zoneRows = listAt(body, 'by_zone', 'par zone').map((r) => {
            const p = pick(r, keys);
            return { ...p, expected: asNumberOrNull(p.expected), entered: asNumberOrNull(p.entered), checked: asNumberOrNull(p.checked), refused: Number(p.refused) };
        });
        assert.deepEqual(zoneRows, [
            { zone_id: z.ev.zones['Entrée générale'].id, name: 'Entrée générale', kind: 'ENTREE', implicit: false, expected: 3, entered: 2, checked: null, refused: 2 },
            { zone_id: z.ev.zones['Entrée VIP'].id, name: 'Entrée VIP', kind: 'ENTREE', implicit: false, expected: 3, entered: 3, checked: null, refused: 1 },
            { zone_id: z.ev.zones['Carré VVIP'].id, name: 'Carré VVIP', kind: 'CONTROLE', implicit: false, expected: 1, entered: null, checked: 1, refused: 1 },
        ], 'par zone, dans l’ordre des zones, sans ligne « Zone non précisée »');

        const cats = listAt(body, 'by_category', 'par catégorie');
        for (const [name, expected, accepted] of [[SIMPLE, 2, 1], [VIP, 2, 2], [VVIP, 1, 1], [GRATUIT, 1, 1]] as Array<[string, number, number]>) {
            const row = rowNamed(cats, 'category_id', z.ev.categories[name].id, 'by_category');
            assert.deepEqual({ expected: Number(row.expected), accepted: Number(row.accepted) }, { expected, accepted }, `catégorie ${name}`);
        }
        const origins = listAt(body, 'by_origin', 'par origine').map((r) => ({ origin: r.origin, label: r.label, expected: Number(r.expected), entered: Number(r.entered) }));
        assert.deepEqual(origins, [
            { origin: 'ONLINE', label: 'En ligne', expected: 4, entered: 3 },
            { origin: 'COUNTER', label: 'Guichet', expected: 0, entered: 0 },
            { origin: 'FREE', label: 'Gratuit', expected: 1, entered: 1 },
            { origin: 'INVITATION', label: 'Invitation', expected: 1, entered: 1 },
        ], 'par origine, ordre fixe ; Σ attendus 6, Σ entrés = total 5');

        const reasons = listAt(body, 'refusals_by_reason', 'refus par motif');
        for (const [result, label] of [['wrong_zone', 'Mauvaise zone'], ['not_entered', 'Pas encore entré'], ['already_used', 'Billet déjà utilisé']]) {
            const row = rowNamed(reasons, 'result', result, 'refusals_by_reason');
            assert.deepEqual({ label: row.label, count: Number(row.count) }, { label, count: 1 }, `motif ${result}`);
        }
        assert.ok(!reasons.some((r) => r.result === 'zone_ok' || r.label === 'Autre refus'), `ni zone_ok ni « Autre refus » : ${JSON.stringify(reasons)}`);

        const gates = listAt(body, 'by_gate', 'par porte');
        for (const [gate, zone, accepted, refused] of [
            ['Porte Nord', 'Entrée générale', 1, 0], ['Porte Sud', 'Entrée générale', 1, 2], ['Porte VIP', 'Entrée VIP', 3, 1], ['Accès carré', 'Carré VVIP', 0, 1],
        ] as Array<[string, string, number, number]>) {
            const row = rowNamed(gates, 'name', gate, 'by_gate');
            assert.deepEqual(
                { gate_id: row.gate_id, zone_name: row.zone_name, accepted: Number(row.accepted), refused: Number(row.refused), controllers_assigned: Number(row.controllers_assigned) },
                { gate_id: gateOf(z.ev, gate), zone_name: zone, accepted, refused, controllers_assigned: 1 }, `porte ${gate}`);
        }
    });

    test('une seule règle d’origine : by_origin.expected égale le tableau « Par canal » des ventes', async () => {
        const z = await montageZ();
        const pairs: Array<[string, string]> = [['ONLINE', 'ONLINE'], ['FREE', 'ONLINE_FREE'], ['COUNTER', 'COUNTER'], ['INVITATION', 'INVITATION']];
        for (const [what, partner, eventId] of [['jeu sans zone', known.partner, known.eventId], ['montage Z', z.partner, z.ev.eventId]] as Array<[string, TestPartner, string]>) {
            const entries = await entriesOf(partner, eventId, `propriétaire (${what})`);
            const sales = await pilotageOk(partner, eventId, 'sales', `propriétaire (${what})`);
            const origins = listAt(entries, 'by_origin', `${what} : par origine`);
            const channels = listAt(sales, 'by_channel', `${what} : par canal`);
            for (const [origin, channel] of pairs) {
                assert.equal(Number(rowNamed(origins, 'origin', origin, what).expected), Number(rowNamed(channels, 'channel', channel, what).tickets),
                    `${what} : by_origin ${origin} = by_channel ${channel} (règle R50, ticket_origin)`);
            }
        }
    });

    test('débit : trois entrées → 0,6 par minute, et la somme des 30 dernières minutes vaut 3', async () => {
        const partner = await newPartner('pil9ter-debit');
        const ev = await createZonedEvent(partner, 'pil9ter-debit', [{ name: SIMPLE, price: 5_000, total: 10 }],
            [{ name: 'Entrée générale', kind: 'ENTREE', admits: [SIMPLE], gates: ['Porte Nord'] }]);
        const ctrl = await controllerAt(partner, ev, 'Porte Nord', 'debit');
        const buyer = await newBuyer('pil9ter-debit');
        const { tickets } = await buyConfirmed(buyer, ev, [[SIMPLE, 3]]);
        assert.equal(tickets.length, 3, 'trois billets');
        for (const t of tickets) await scanExpect(ctrl, ev, await ticketPayload(String(t.id)), 'Porte Nord', 'valid', 'entrée');
        const body = await entriesOf(partner, ev.eventId, 'la partenaire propriétaire');
        const rate = body.rate as Row | undefined;
        assert.ok(rate && typeof rate === 'object', `clé rate servie : ${JSON.stringify(Object.keys(body))}`);
        assert.equal(rate.window_minutes, 5, 'fenêtre de 5 minutes');
        assert.equal(Number(rate.per_minute), 0.6, 'trois entrées en 5 minutes : 0,6 par minute');
        const minutes = listAt(body, 'rate.by_minute', 'débit par minute');
        assert.equal(minutes.length, 30, '30 minutes, vides comprises');
        assert.equal(minutes.reduce((s, m) => s + Number(m.accepted), 0), 3, 'Σ des 30 minutes = 3');
        const starts = minutes.map((m) => {
            const iso = String(m.start);
            const ms = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`).getTime();
            assert.ok(Number.isFinite(ms) && ms % 60_000 === 0, `début à la minute pleine : ${iso}`);
            return ms;
        });
        assert.deepEqual(starts, [...starts].sort((a, b) => a - b), 'ordre croissant');
        assert.equal(Number(rowNamed(listAt(body, 'by_gate', 'par porte'), 'name', 'Porte Nord', 'by_gate').rate_per_minute), 0.6, 'débit de la Porte Nord');
    });

    test('contrôleurs actifs : un scan dans les 10 minutes rend actif, une affectation sans scan non, le propriétaire qui scanne n’est pas compté', async () => {
        const z = await buildZ('t1-actifs');
        const fifth = await controllerAt(z.partner, z.ev, 'Porte Nord', 't1-actifs-5');
        await scanExpect(z.partner, z.ev, 'TCK-PROPRIO-1', 'Porte Nord', ['invalid', 'dynamic_qr_required'], 'scan de la propriétaire (/partner/scan)');
        const body = await entriesOf(z.partner, z.ev.eventId, 'la partenaire propriétaire');
        assert.deepEqual(body.controllers, { window_minutes: 10, assigned: 5, active: 4 }, 'cinq affectés, quatre actifs');
        const scanners = listAt(body, 'by_scanner', 'par contrôleur');
        assert.ok(!scanners.some((s) => s.scanner_id === fifth.userId), 'le 5e contrôleur, sans activité, est absent de by_scanner');
        assert.equal(rowNamed(scanners, 'scanner_id', z.partner.userId, 'by_scanner').active, true, 'la propriétaire qui scanne est active dans by_scanner');
        for (const [key, gate] of [['nord', 'Porte Nord'], ['sud', 'Porte Sud'], ['vip', 'Porte VIP'], ['carre', 'Accès carré']] as Array<[keyof ZMontage['ctrl'], string]>) {
            const row = rowNamed(scanners, 'scanner_id', z.ctrl[key].userId, 'by_scanner');
            assert.deepEqual({ gate: row.gate, active: row.active }, { gate, active: true }, `contrôleur de la ${gate}`);
        }
        const nord = rowNamed(listAt(body, 'by_gate', 'par porte'), 'name', 'Porte Nord', 'by_gate');
        assert.deepEqual({ assigned: Number(nord.controllers_assigned), active: Number(nord.controllers_active) }, { assigned: 2, active: 1 }, 'Porte Nord : deux affectés, un actif');
    });

    test('liste des invités : une validation par la liste compte dans le total et à part, jamais au guichet ; le nom n’est rendu qu’à la propriétaire', async () => {
        const z = await montageZ();
        const owner = await entriesOf(z.partner, z.ev.eventId, 'la partenaire propriétaire');
        assert.equal(numberAt(owner, 'guest_list.count', 'liste des invités'), 1, 'une validation par la liste');
        assert.equal(numberAt(owner, 'counter', 'guichet'), 0, 'jamais au guichet');
        assert.equal(numberAt(owner, 'total', 'entrées'), 5, 'comptée dans le total');
        const ownerItems = listAt(owner, 'guest_list.items', 'validations (propriétaire)');
        assert.equal(ownerItems.length, 1, 'une ligne');
        assert.deepEqual(pick(ownerItems[0], ['category', 'gate', 'zone', 'guest_name']), { category: VIP, gate: 'Porte VIP', zone: 'Entrée VIP', guest_name: GUEST_NAME }, 'ligne de la propriétaire');
        const admin = await newAdminWith(['events.read'], { label: 'pil9ter-lecture' });
        const adminBody = await entriesOf(admin, z.ev.eventId, 'admin events.read');
        const adminItems = listAt(adminBody, 'guest_list.items', 'validations (admin)');
        assert.equal(adminItems.length, 1, 'même ligne pour l’admin');
        assert.deepEqual(pick(adminItems[0], ['category', 'gate', 'zone', 'guest_name']), { category: VIP, gate: 'Porte VIP', zone: 'Entrée VIP', guest_name: null }, 'nom masqué à l’admin');
        assert.ok(!JSON.stringify(adminBody).includes(GUEST_NAME), 'aucun nom d’invité dans la réponse de l’admin');
        const overview = await pilotageOk(z.partner, z.ev.eventId, 'overview', 'la partenaire propriétaire');
        assert.equal(numberAt(overview, 'entries.guest_list', 'aperçu'), 1, 'aperçu : entries.guest_list = 1');
    });

    test('alertes servies : réglages par défaut, aucune alerte sous le seuil', async () => {
        const z = await montageZ();
        const body = await entriesOf(z.partner, z.ev.eventId, 'la partenaire propriétaire');
        assert.deepEqual(body.alert_settings, { threshold: 10, minutes: 5 }, 'réglages par défaut servis');
        assert.deepEqual(body.alerts, [], 'aucune porte au seuil');
    });

    test('tentatives multiples : un contrôle de zone après l’entrée n’est pas une tentative', async () => {
        const z = await montageZ();
        const body = await entriesOf(z.partner, z.ev.eventId, 'la partenaire propriétaire');
        const rows = listAt(body, 'repeated_attempts', 'tentatives multiples');
        assert.ok(!rows.some((r) => r.ticket_id === z.tickets.vvip), `VVIP (entré puis contrôlé au carré) absent : ${JSON.stringify(rows)}`);
        const simple = rowNamed(rows, 'ticket_id', z.tickets.simple1, 'repeated_attempts');
        assert.equal(simple.last_result, 'already_used', 'SIMPLE#1 signalé (déjà utilisé à la Porte Sud)');
    });

    test('accès inchangé : partenaire B, admin sans events.read', async () => {
        const other = await newPartner('pil9ter-autre');
        const denied = await pilotageGet(other, known.eventId, 'entries');
        assert.equal(denied.status, 404, `partenaire B : ${show(denied)}`);
        assert.equal(denied.body.code, 'EVENT_NOT_FOUND', show(denied));
        const admin = await newAdminWith([], { label: 'pil9ter-sans-droit' });
        const forbidden = await pilotageGet(admin, known.eventId, 'entries');
        assert.equal(forbidden.status, 403, `admin sans events.read : ${show(forbidden)}`);
        assert.equal(forbidden.body.code, 'PERMISSION_MISSING', show(forbidden));
        assert.equal(forbidden.body.by_zone, undefined, 'aucune vue servie');
    });
});
