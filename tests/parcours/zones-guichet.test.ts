/**
 * Lot 9 ter, tâche 9t.15 (consigne 1, arbitrage 18 : « Guichet = entrée, soumis à la règle de zone ») — vente au
 * guichet à une porte (contrat 5.C, C.1.2 F38, C.1.5, 4.3, 11.3 ; rectification C 6 : le devis ne voit pas la porte).
 * Patrons : tests/parcours/acces-guichet.test.ts:66-80, openShift (acces-helpers.ts).
 *  1. vendeur sans porte sur un événement à zones : 409 GATE_REQUIRED, rien écrit ;
 *  2. catégorie non admise à la porte du vendeur : 409 CATEGORY_NOT_ADMITTED_AT_GATE, texte et zones proposées, rien
 *     écrit, caisse non créditée ;
 *  3. vendeur à une porte de contrôle : refus, texte exact ;
 *  4. vente admise : ligne COUNTER avec porte et zone ; billet sans porteur ; GET du guichet : porte et
 *     admitted_at_gate par catégorie ;
 *  5. sans zone : vente inchangée, porte NULL ;
 *  6. rejeu d'une vente faite avant le retrait de la porte : même réponse (rejeu avant tout contrôle de porte).
 *
 * Rouge avant correctif (fix(9t.15), F38 de la migration 20261110000009, route du guichet) : cas 1 à 4 et 6, route
 * des zones absente (createZonedEvent la nomme) ; cas 5 : ticket_scans sans colonne gate_id.
 * after() : assertLot9terInvariants.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { assertLot9terInvariants } from '../helpers/lot9ter-invariants';
import { eventTickets, service, type Buyer, type CategorySpec, type SaleEvent } from './paiement-helpers';
import { newPartner, type TestPartner } from './finance-helpers';
import { authed, createTimedEvent, newController, openShift, shiftRow, type RouteResult } from './acces-helpers';
import { invoke, routeHandler } from './pilotage-helpers';
import { assignGate, createZonedEvent, gateOf, type ZonedEvent, type ZoneSpec } from './zones-helpers';

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
const ROUTE = '../../app/api/controller/counter-sale/route';

let partner: TestPartner;

before(async () => {
    partner = await newPartner('zones-guichet');
});

after(async () => {
    await assertLot9terInvariants('zones-guichet');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

function show(r: RouteResult): string {
    return `HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 900)}`;
}

function zonedEvent(label: string): Promise<ZonedEvent> {
    return createZonedEvent(partner, `zones-guichet ${label}`, CATEGORIES, ZONES);
}

async function sell(user: Buyer, ev: SaleEvent, category: string, quantity = 1, key: string = randomUUID()): Promise<RouteResult> {
    const handler = await routeHandler(ROUTE, 'POST', 'POST /api/controller/counter-sale');
    return invoke(handler, authed('/api/controller/counter-sale', 'POST', user,
        { eventId: ev.eventId, items: [{ categoryId: ev.categories[category].id, quantity }] }, { 'idempotency-key': key }));
}

async function counterScreen(user: Buyer, ev: SaleEvent): Promise<RouteResult> {
    const handler = await routeHandler(ROUTE, 'GET', 'GET /api/controller/counter-sale');
    return invoke(handler, authed(`/api/controller/counter-sale?eventId=${ev.eventId}`, 'GET', user));
}

/** Vendeur affecté (espèces), porte posée par la route de la partenaire si `gateName`, caisse ouverte. */
async function seller(ev: SaleEvent, label: string, gateName: string | null): Promise<{ user: Buyer; shiftId: string }> {
    const user = await newController(partner, ev.eventId, { canAcceptCash: true, label });
    if (gateName) {
        const res = await assignGate(partner, ev.eventId, user.userId, gateOf(ev as ZonedEvent, gateName));
        assert.equal(res.status, 200, `porte ${gateName} de ${label} : ${show(res)}`);
    }
    const opened = await openShift(user, ev.eventId);
    assert.equal(opened.status, 200, `caisse de ${label} : ${show(opened)}`);
    const { data, error } = await service.from('controller_shifts').select('id').eq('controller_id', user.userId).eq('event_id', ev.eventId).eq('status', 'OUVERT').single();
    assert.equal(error, null, `caisse ouverte de ${label} : ${error?.message}`);
    return { user, shiftId: String(data.id) };
}

interface Snapshot { tickets: string[]; total: number; payments: number }

async function snapshot(ev: SaleEvent, shiftId: string): Promise<Snapshot> {
    const { count, error } = await service.from('payments').select('id', { count: 'exact', head: true }).eq('shift_id', shiftId);
    assert.equal(error, null, `paiements de la caisse : ${error?.message}`);
    return {
        tickets: (await eventTickets(ev.eventId)).map((t) => String(t.id)).sort(),
        total: Number((await shiftRow(shiftId)).expected_cash_total),
        payments: count ?? 0,
    };
}

async function assertNothingSold(ev: SaleEvent, shiftId: string, before: Snapshot, what: string): Promise<void> {
    assert.deepEqual(await snapshot(ev, shiftId), before, `${what} : aucun billet, aucun paiement, caisse non créditée`);
}

async function saleScans(ticketIds: string[]): Promise<Row[]> {
    const { data, error } = await service.from('ticket_scans').select('*').in('ticket_id', ticketIds);
    assert.equal(error, null, `ticket_scans : ${error?.message}`);
    return (data ?? []) as Row[];
}

// ── Scénarios ──────────────────────────────────────────────────────────────

describe('9t.15 Guichet à une porte', () => {
    test('1. vendeur sans porte sur un événement à zones : 409 GATE_REQUIRED, rien écrit', async () => {
        const ev = await zonedEvent('sans-porte');
        const { user, shiftId } = await seller(ev, 'zg-sans-porte', null);
        const before = await snapshot(ev, shiftId);
        const r = await sell(user, ev, SIMPLE);
        assert.equal(r.status, 409, show(r));
        assert.equal(r.body.code, 'GATE_REQUIRED', show(r));
        assert.equal(r.body.error, 'Aucune porte ne vous est attribuée : demandez à l’organisateur de vous en attribuer une. Rien n’a été vendu.', show(r));
        await assertNothingSold(ev, shiftId, before, 'vendeur sans porte');
    });

    test('2. catégorie non admise à la porte du vendeur : 409, rien écrit, caisse non créditée', async () => {
        const ev = await zonedEvent('non-admise');
        const { user, shiftId } = await seller(ev, 'zg-nord', 'Porte Nord');
        const before = await snapshot(ev, shiftId);
        const r = await sell(user, ev, VIP);
        assert.equal(r.status, 409, show(r));
        assert.equal(r.body.code, 'CATEGORY_NOT_ADMITTED_AT_GATE', show(r));
        assert.equal(r.body.error, 'VIP n’entre pas par cette porte : vendez-la à Entrée VIP.', show(r));
        const problems = (r.body.problems ?? []) as Row[];
        assert.equal(problems.length, 1, show(r));
        assert.deepEqual(problems[0], { category_id: ev.categories[VIP].id, category: VIP, zones: ['Entrée VIP'] }, show(r));
        await assertNothingSold(ev, shiftId, before, 'catégorie non admise');
    });

    test('3. vendeur à une porte de contrôle : refus', async () => {
        const ev = await zonedEvent('controle');
        const { user, shiftId } = await seller(ev, 'zg-carre', 'Accès carré');
        const before = await snapshot(ev, shiftId);
        const r = await sell(user, ev, VIP);
        assert.equal(r.status, 409, show(r));
        assert.equal(r.body.code, 'CATEGORY_NOT_ADMITTED_AT_GATE', show(r));
        assert.equal(r.body.error, 'La vente au guichet se fait à une porte d’entrée : demandez à l’organisateur de changer votre porte.', show(r));
        await assertNothingSold(ev, shiftId, before, 'porte de contrôle');
    });

    test('4. vente admise : ligne COUNTER avec porte et zone', async () => {
        const ev = await zonedEvent('admise');
        const { user, shiftId } = await seller(ev, 'zg-admise', 'Porte Nord');
        const before = await snapshot(ev, shiftId);
        const r = await sell(user, ev, SIMPLE);
        assert.equal(r.status, 200, show(r));
        assert.equal(r.body.ok, true, show(r));
        const ids = (r.body.ticket_ids ?? []) as string[];
        assert.equal(ids.length, 1, show(r));
        const rows = await saleScans(ids);
        assert.equal(rows.length, 1, 'une ligne de compostage');
        assert.deepEqual({
            accepted: rows[0].accepted, method: rows[0].method, gate_id: rows[0].gate_id, zone_id: rows[0].zone_id, entry_point: rows[0].entry_point,
        }, {
            accepted: true, method: 'COUNTER', gate_id: gateOf(ev, 'Porte Nord'), zone_id: ev.zones['Entrée générale'].id, entry_point: 'Porte Nord',
        }, JSON.stringify(rows[0]));
        const { data: t, error } = await service.from('tickets').select('user_id, status').eq('id', ids[0]).single();
        assert.equal(error, null, `billet : ${error?.message}`);
        assert.deepEqual(t, { user_id: null, status: 'UTILISE' }, 'billet sans porteur, composté : aucun QR à présenter');
        assert.equal((await snapshot(ev, shiftId)).total, before.total + 5_000, 'caisse créditée du prix');

        const screen = await counterScreen(user, ev);
        assert.equal(screen.status, 200, show(screen));
        assert.deepEqual(screen.body.gate, {
            id: gateOf(ev, 'Porte Nord'), name: 'Porte Nord', zone: { id: ev.zones['Entrée générale'].id, name: 'Entrée générale', kind: 'ENTREE' },
        }, show(screen));
        const cats = (screen.body.categories ?? []) as Row[];
        const admitted = (name: string): unknown => cats.find((c) => c.name === name)?.admitted_at_gate;
        assert.equal(admitted(SIMPLE), true, show(screen));
        assert.equal(admitted(VIP), false, show(screen));
    });

    test('5. sans zone : vente inchangée', async () => {
        const ev0 = await createTimedEvent(partner.partnerId, 'zones-guichet Z0', CATEGORIES);
        const { user } = await seller(ev0, 'zg-z0', null);
        const r = await sell(user, ev0, VIP);
        assert.equal(r.status, 200, show(r));
        const ids = (r.body.ticket_ids ?? []) as string[];
        const rows = await saleScans(ids);
        assert.equal(rows.length, 1, 'une ligne de compostage');
        assert.ok('gate_id' in rows[0], `colonne ticket_scans.gate_id (migration 20261110000009) : ${JSON.stringify(rows[0])}`);
        assert.equal(rows[0].gate_id, null, 'aucune porte sans zone');
        assert.equal(rows[0].zone_id, null, 'zone implicite : aucune ligne de zone');
        const screen = await counterScreen(user, ev0);
        assert.equal(screen.status, 200, show(screen));
        assert.equal(screen.body.gate, null, show(screen));
        assert.ok(((screen.body.categories ?? []) as Row[]).every((c) => c.admitted_at_gate === true), `toutes admises sans zone : ${show(screen)}`);
    });

    test('6. rejeu d’une vente faite avant le retrait de la porte : même réponse', async () => {
        const ev = await zonedEvent('rejeu');
        const { user } = await seller(ev, 'zg-rejeu', 'Porte Nord');
        const key = randomUUID();
        const first = await sell(user, ev, SIMPLE, 1, key);
        assert.equal(first.status, 200, show(first));
        const removed = await assignGate(partner, ev.eventId, user.userId, null);
        assert.equal(removed.status, 200, show(removed));
        const again = await sell(user, ev, SIMPLE, 1, key);
        assert.equal(again.status, 200, `rejeu avant tout contrôle de porte : ${show(again)}`);
        assert.equal(again.body.replayed, true, show(again));
        assert.deepEqual(again.body.ticket_ids, first.body.ticket_ids, 'mêmes billets');
        const fresh = await sell(user, ev, SIMPLE);
        assert.equal(fresh.status, 409, `clé neuve sans porte : ${show(fresh)}`);
        assert.equal(fresh.body.code, 'GATE_REQUIRED', show(fresh));
    });
});
