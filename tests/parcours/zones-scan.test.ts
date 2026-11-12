/**
 * Lot 9 ter, tâche 9t.15 (consigne 1 : zones et portes ; consigne 6 : « invitation VIP refusée en zone non admise »,
 * « 3 contrôleurs, même porte, même billet ») — règle des zones appliquée dans la RPC de scan (contrat 5.C, C.1.2,
 * C.1.5, C.2.2, C.2.3, 4.3, 11.3 ; arbitrage 18, X5, X36).
 * Événement Z : « Entrée générale » (ENTRÉE : SIMPLE ; portes « Porte Nord », « Porte Sud »), « Entrée VIP » (ENTRÉE :
 * VIP, VVIP ; porte « Porte VIP »), « Carré VIP » (CONTRÔLE : VIP, VVIP ; porte « Accès carré ») ; Z0 sans zone.
 *  1. sans zone : verdicts et clés d'aujourd'hui, zone implicite « Entrée », aucune porte en base ;
 *  2. Entrée : VIP à la Porte Nord → wrong_zone (orange), rien composté, ligne de zone tracée ; vert à la Porte VIP ;
 *  3. Contrôle de zone : not_entered avant l'entrée, zone_ok après, jamais composté par le carré ; SIMPLE au carré →
 *     wrong_zone ; billet remboursé au carré → refunded (rouge), sans verdict de zone ;
 *  4. 3 contrôleurs, même porte, même billet, en même temps : un seul vert, la porte du gagnant aux deux perdants ;
 *  5. problèmes de porte (sans porte, porte périmée, absente, d'un autre événement) : 409 sans donnée du billet ni ligne ;
 *  6. rejeu de la même clé d'un wrong_zone : même verdict, billet rendu, aucune ligne nouvelle ;
 *  7. saisie manuelle à une porte : aperçus sans ligne, validation manuelle à la mauvaise porte → wrong_zone ;
 *  8. couleur, consigne et origine servies au scanneur, consigne seulement sur l'entrée validée ;
 *  9. invitation VIP refusée dans une zone qui n'admet pas le VIP (consigne 6), puis vert à la Porte VIP ;
 * 10. configuration enregistrée pendant un scan : aucun interblocage, porte en cours d'usage protégée (GATE_IN_USE).
 *
 * Rouge avant correctif (fix(9t.15), fix(9t.16), migration 20261110000009) : cas 2 à 10, route
 * app/api/partner/events/[id]/zones/route.ts absente (createZonedEvent échoue en la nommant) ; cas 1 : réponse sans
 * `zone`, `gate`, `origin`, `category_color` (M/20261109000008:1207-1208) et ticket_scans sans gate_id ni zone_id.
 * Cas 8 dépend aussi de la route des catégories de D (F54, scan_color et entry_instruction, fix(9t.19)).
 * Aucun cas vert par accident : chaque cas exige une clé, un résultat ou une colonne du lot.
 * after() : assertLot9terInvariants.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { openConcurrentClient, waitForLockWaiters } from '../helpers/db';
import { assertLot9terInvariants } from '../helpers/lot9ter-invariants';
import { routeContext } from './helpers';
import { importModule, newBuyer, service, type Buyer, type CategorySpec, type SaleEvent } from './paiement-helpers';
import { buyConfirmed, confirmCashouts, newPartner, type TestPartner } from './finance-helpers';
import { authed, createTimedEvent, newController, scansOf, ticketPayload, ticketRow, type RouteResult } from './acces-helpers';
import { markPhoneVerified } from './notif-helpers';
import { invoke, routeHandler } from './pilotage-helpers';
import { assignGate, createZonedEvent, gateOf, lookupAtGate, scanAtGate, sendInvitations, type ZonedEvent, type ZoneSpec } from './zones-helpers';

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
/** Textes exacts servis par l'API (contrat 11.3). */
const GATE_TEXT = {
    GATE_REQUIRED: 'Aucune porte ne vous est attribuée : demandez à l’organisateur de vous en attribuer une. Rien n’a été validé.',
    GATE_CHANGED: 'Votre porte a changé : le contrôle reprend avec votre nouvelle porte. Scannez de nouveau.',
    GATE_INVALID: 'Porte inconnue : choisissez une porte de cet événement.',
} as const;
/** Clés du billet servies aujourd'hui par ticket_scan (M/20261109000008:1137-1139), gardées. */
const CURRENT_TICKET_KEYS = ['id', 'ticket_number', 'category', 'holder', 'price', 'is_manual_entry', 'checked_in_at', 'checked_in_by_me'];
const REFUND_REASON = 'Remboursement d’essai (lot 9 ter, zones)';

let partner: TestPartner;
let buyer: Buyer;

before(async () => {
    partner = await newPartner('zones-scan');
    buyer = await newBuyer('zones-scan', { firstName: 'Aminata', lastName: 'Spectatrice' });
});

after(async () => {
    await assertLot9terInvariants('zones-scan');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

function show(r: RouteResult): string {
    return `HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 900)}`;
}

function zonedEvent(label: string): Promise<ZonedEvent> {
    return createZonedEvent(partner, `zones-scan ${label}`, CATEGORIES, ZONES);
}

function plainEvent(label: string, categories: CategorySpec[] = CATEGORIES): Promise<SaleEvent> {
    return createTimedEvent(partner.partnerId, `zones-scan ${label}`, categories);
}

/** Contrôleur affecté à l'événement, porte posée par la route de la partenaire (200 exigé). */
async function controllerAt(ev: ZonedEvent, gateName: string, label: string, opts: { canChange?: boolean } = {}): Promise<Buyer> {
    const ctrl = await newController(partner, ev.eventId, { label });
    const res = await assignGate(partner, ev.eventId, ctrl.userId, gateOf(ev, gateName), opts);
    assert.equal(res.status, 200, `porte ${gateName} attribuée à ${label} (PATCH /api/partner/team/gate) : ${show(res)}`);
    return ctrl;
}

async function oneTicket(ev: SaleEvent, category: string): Promise<Row> {
    const [t] = (await buyConfirmed(buyer, ev, [[category, 1]])).tickets;
    assert.ok(t, `billet ${category} émis`);
    return t;
}

async function qr(ev: SaleEvent, ticketId: string): Promise<Record<string, unknown>> {
    return { eventId: ev.eventId, payload: await ticketPayload(ticketId) };
}

function ticketOf(r: RouteResult): Row {
    assert.ok(r.body.ticket && typeof r.body.ticket === 'object', `réponse avec ticket : ${show(r)}`);
    return r.body.ticket as Row;
}

function zoneIdOf(ev: ZonedEvent, name: string): string {
    const z = ev.zones[name];
    assert.ok(z, `zone ${name} de l'événement`);
    return z.id;
}

function expectResult(r: RouteResult, result: string, what: string): void {
    assert.equal(r.status, 200, `${what} : ${show(r)}`);
    assert.equal(r.body.result, result, `${what} : ${show(r)}`);
}

function acceptedOf(rows: Row[]): Row[] {
    return rows.filter((s) => s.accepted === true);
}

async function auditCount(userIds: string[], since: string): Promise<number> {
    const { count, error } = await service.from('audit_logs').select('id', { count: 'exact', head: true }).in('user_id', userIds).gte('created_at', since);
    assert.equal(error, null, `audit_logs : ${error?.message}`);
    return count ?? 0;
}

function ms(v: unknown, what: string): number {
    const t = Date.parse(String(v));
    assert.ok(Number.isFinite(t), `${what} : date lisible attendue (${String(v)})`);
    return t;
}

/** Remboursement par la route de la partenaire, puis versement envoyé et confirmé (rien ne reste à envoyer). */
async function refundByPartner(ev: SaleEvent, ticketId: string): Promise<void> {
    const handler = await routeHandler('../../app/api/partner/events/[id]/tickets/[ticketId]/refund/route', 'POST', 'remboursement d’un billet par la partenaire');
    const res = await invoke(handler, authed(`/api/partner/events/${ev.eventId}/tickets/${ticketId}/refund`, 'POST', partner, { reason: REFUND_REASON }),
        routeContext({ id: ev.eventId, ticketId }));
    assert.equal(res.status, 200, `remboursement du billet : ${show(res)}`);
    const { CashoutService } = await importModule('../../lib/payments/cashout.service');
    if (typeof res.body.cashout_id === 'string') await CashoutService.send(res.body.cashout_id);
    await confirmCashouts();
}

// ── 1. Sans zone ───────────────────────────────────────────────────────────

describe('9t.15 Scan sans zone : comportement d’aujourd’hui, zone implicite', () => {
    test('1. sans zone : verdicts et clés d’aujourd’hui, zone implicite Entrée, aucune porte en base', async () => {
        const ev0 = await plainEvent('Z0');
        const ctrl = await newController(partner, ev0.eventId, { label: 'zs-z0' });
        const t = await oneTicket(ev0, SIMPLE);
        const id = String(t.id);
        const body = await qr(ev0, id);

        const first = await scanAtGate(ctrl, body, undefined);
        expectResult(first, 'valid', 'premier scan sur Z0');
        const ticket = ticketOf(first);
        for (const k of CURRENT_TICKET_KEYS) assert.ok(k in ticket, `clé actuelle ${k} gardée : ${show(first)}`);
        assert.deepEqual(first.body.zone, { id: null, name: 'Entrée', kind: 'ENTREE', implicit: true }, `zone implicite servie (C.2.2 point 3) : ${show(first)}`);
        assert.equal(first.body.gate, null, `aucune porte : ${show(first)}`);
        assert.equal(ticket.origin, 'ONLINE', `origine du billet (F5) : ${show(first)}`);
        assert.equal(ticket.category_color, null, `aucune couleur : ${show(first)}`);
        assert.equal(ticket.entry_instruction, null, `aucune consigne : ${show(first)}`);

        const second = await scanAtGate(ctrl, body, undefined);
        expectResult(second, 'already_used', 'second scan sur Z0');
        assert.equal(ticketOf(second).checked_in_gate, null, `aucune porte connue : ${show(second)}`);

        const accepted = acceptedOf(await scansOf(id));
        assert.equal(accepted.length, 1, 'une ligne acceptée');
        for (const col of ['gate_id', 'zone_id', 'zone_result']) {
            assert.ok(col in accepted[0], `colonne ticket_scans.${col} (migration 20261110000009) : ${JSON.stringify(accepted[0])}`);
            assert.equal(accepted[0][col], null, `ticket_scans.${col} NULL sans zone`);
        }
        assert.equal(accepted[0].result, 'valid');

        const outsider = await newController(partner, null, { label: 'zs-z0-hors' });
        const refused = await scanAtGate(outsider, body, undefined);
        assert.equal(refused.status, 403, show(refused));
        assert.deepEqual(Object.keys(refused.body).sort(), ['code', 'error'], `corps exactement { error, code } : ${show(refused)}`);
    });
});

// ── 2 et 3. Règle des zones ────────────────────────────────────────────────

describe('9t.15 Zones d’entrée et de contrôle', () => {
    test('2. Entrée : VIP à la Porte Nord → mauvaise zone, rien composté ; puis vert à la Porte VIP', async () => {
        const ev = await zonedEvent('entree');
        const nord = await controllerAt(ev, 'Porte Nord', 'zs-nord');
        const porteVip = await controllerAt(ev, 'Porte VIP', 'zs-vip');
        const t = await oneTicket(ev, VIP);
        const id = String(t.id);

        const wrong = await scanAtGate(nord, await qr(ev, id), gateOf(ev, 'Porte Nord'));
        expectResult(wrong, 'wrong_zone', 'VIP à la Porte Nord');
        assert.equal(wrong.body.message, 'Accès refusé : billet VIP', show(wrong));
        assert.deepEqual(wrong.body.redirect_zones, ['Entrée VIP'], show(wrong));
        assert.equal((await ticketRow(id)).status, 'VALIDE', 'rien composté');
        const rows = await scansOf(id);
        assert.equal(rows.length, 1, 'une ligne de zone');
        assert.deepEqual({
            result: rows[0].result, zone_result: rows[0].zone_result, accepted: rows[0].accepted,
            gate_id: rows[0].gate_id, zone_id: rows[0].zone_id, entry_point: rows[0].entry_point,
        }, {
            result: null, zone_result: 'wrong_zone', accepted: false,
            gate_id: gateOf(ev, 'Porte Nord'), zone_id: zoneIdOf(ev, 'Entrée générale'), entry_point: 'Porte Nord',
        }, `ligne de zone : ${JSON.stringify(rows[0])}`);

        const ok = await scanAtGate(porteVip, await qr(ev, id), gateOf(ev, 'Porte VIP'));
        expectResult(ok, 'valid', 'VIP à la Porte VIP');
        assert.equal((ok.body.zone as Row | undefined)?.name, 'Entrée VIP', show(ok));
        assert.equal((ok.body.gate as Row | undefined)?.name, 'Porte VIP', show(ok));
        const accepted = acceptedOf(await scansOf(id));
        assert.equal(accepted.length, 1, 'une ligne acceptée');
        assert.equal(accepted[0].gate_id, gateOf(ev, 'Porte VIP'), 'ligne acceptée à la Porte VIP');
        assert.equal((await ticketRow(id)).status, 'UTILISE');
    });

    test('3. Contrôle de zone : pas encore entré, puis accès autorisé, jamais composté par le carré', async () => {
        const ev = await zonedEvent('controle');
        const carre = await controllerAt(ev, 'Accès carré', 'zs-carre');
        const porteVip = await controllerAt(ev, 'Porte VIP', 'zs-vip2');
        const nord = await controllerAt(ev, 'Porte Nord', 'zs-nord2');
        const carreGate = gateOf(ev, 'Accès carré');
        const vvip = String((await oneTicket(ev, VVIP)).id);

        const early = await scanAtGate(carre, await qr(ev, vvip), carreGate);
        expectResult(early, 'not_entered', 'VVIP au carré avant toute entrée');
        assert.deepEqual(early.body.redirect_zones, ['Entrée VIP'], show(early));
        assert.deepEqual(acceptedOf(await scansOf(vvip)), [], 'aucune ligne acceptée');
        assert.equal((await ticketRow(vvip)).status, 'VALIDE', 'jamais composté par le carré');

        expectResult(await scanAtGate(porteVip, await qr(ev, vvip), gateOf(ev, 'Porte VIP')), 'valid', 'entrée par la Porte VIP');
        const entered = await ticketRow(vvip);
        const ok = await scanAtGate(carre, await qr(ev, vvip), carreGate);
        expectResult(ok, 'zone_ok', 'VVIP au carré après l’entrée');
        const okTicket = ticketOf(ok);
        assert.equal(okTicket.checked_in_gate, 'Porte VIP', show(ok));
        assert.equal(ms(okTicket.checked_in_at, 'checked_in_at servi'), ms(entered.checked_in_at, 'checked_in_at du billet'), 'heure de l’entrée');
        const rows = await scansOf(vvip);
        const accepted = acceptedOf(rows);
        assert.equal(accepted.length, 1, 'une seule ligne acceptée');
        const zoneOk = rows.filter((s) => s.zone_result === 'zone_ok');
        assert.equal(zoneOk.length, 1, 'une ligne zone_ok');
        assert.ok(ms(zoneOk[0].created_at, 'ligne zone_ok') > ms(accepted[0].created_at, 'ligne acceptée'), 'la ligne de zone suit l’entrée (x9, clock_timestamp)');

        const simple = String((await oneTicket(ev, SIMPLE)).id);
        expectResult(await scanAtGate(nord, await qr(ev, simple), gateOf(ev, 'Porte Nord')), 'valid', 'SIMPLE à la Porte Nord');
        const intruder = await scanAtGate(carre, await qr(ev, simple), carreGate);
        expectResult(intruder, 'wrong_zone', 'SIMPLE au carré');
        assert.deepEqual(intruder.body.redirect_zones, ['Entrée générale'], show(intruder));

        const refundedId = String((await oneTicket(ev, VIP)).id);
        await refundByPartner(ev, refundedId);
        const refused = await scanAtGate(carre, await qr(ev, refundedId), carreGate);
        expectResult(refused, 'refunded', 'VIP remboursé au carré (rouge avant toute règle de zone)');
        const refusedRows = await scansOf(refundedId);
        assert.equal(refusedRows.length, 1, 'une ligne');
        assert.equal(refusedRows[0].zone_result, null, 'aucun verdict de zone pour un billet remboursé');
        assert.equal(refusedRows[0].result, 'refunded');
    });
});

// ── 4. Course à une porte ──────────────────────────────────────────────────

describe('9t.15 Course : trois contrôleurs, une porte, un billet (consigne 6)', () => {
    test('4. 3 contrôleurs, même porte, même billet en même temps : un seul vert', async () => {
        const ev = await zonedEvent('course');
        const gate = gateOf(ev, 'Porte Nord');
        const ctrls = [
            await controllerAt(ev, 'Porte Nord', 'zs-course1'),
            await controllerAt(ev, 'Porte Nord', 'zs-course2'),
            await controllerAt(ev, 'Porte Nord', 'zs-course3'),
        ];
        const id = String((await oneTicket(ev, SIMPLE)).id);
        const body = await qr(ev, id);
        const settled = await Promise.allSettled(ctrls.map((c) => scanAtGate(c, body, gate)));
        const replies = settled.map((s) => {
            assert.equal(s.status, 'fulfilled', `appel rejeté : ${s.status === 'rejected' ? String(s.reason) : ''}`);
            const r = (s as PromiseFulfilledResult<RouteResult>).value;
            assert.equal(r.status, 200, show(r));
            return r;
        });
        assert.deepEqual(replies.map((r) => String(r.body.result)).sort(), ['already_used', 'already_used', 'valid'], replies.map(show).join('\n'));
        const rows = await scansOf(id);
        assert.equal(rows.length, 3, 'une ligne par tentative');
        assert.equal(acceptedOf(rows).length, 1, 'une seule ligne acceptée');
        const winner = ticketOf(replies.find((r) => r.body.result === 'valid')!);
        for (const loser of replies.filter((r) => r.body.result === 'already_used')) {
            const lt = ticketOf(loser);
            assert.equal(lt.checked_in_gate, 'Porte Nord', `porte du gagnant : ${show(loser)}`);
            assert.equal(ms(lt.checked_in_at, 'perdant'), ms(winner.checked_in_at, 'gagnant'), `même heure d’entrée que le gagnant : ${show(loser)}`);
        }
        assert.equal((await ticketRow(id)).status, 'UTILISE');
    });
});

// ── 5. Problèmes de porte ──────────────────────────────────────────────────

describe('9t.15 Porte absente, périmée ou inconnue', () => {
    test('5. porte : sans porte, porte périmée, porte absente, porte d’un autre événement : 409 sans donnée du billet ni ligne', async () => {
        const ev = await zonedEvent('portes');
        const other = await zonedEvent('portes-autre');
        const ev0 = await plainEvent('portes-Z0');
        const noGate = await newController(partner, ev.eventId, { label: 'zs-sans-porte' });
        const nord = await controllerAt(ev, 'Porte Nord', 'zs-perime');
        const ctrl0 = await newController(partner, ev0.eventId, { label: 'zs-z0-porte' });
        const t = await oneTicket(ev, SIMPLE);
        const t0 = await oneTicket(ev0, SIMPLE);
        const since = new Date().toISOString();
        const cases: Array<[string, Buyer, SaleEvent, Row, string | undefined, keyof typeof GATE_TEXT]> = [
            ['contrôleur sans porte', noGate, ev, t, undefined, 'GATE_REQUIRED'],
            ['contrôleur de la Porte Nord annonçant la Porte Sud', nord, ev, t, gateOf(ev, 'Porte Sud'), 'GATE_CHANGED'],
            ['contrôleur de la Porte Nord sans gateId', nord, ev, t, undefined, 'GATE_CHANGED'],
            ['propriétaire sans gateId', partner, ev, t, undefined, 'GATE_REQUIRED'],
            ['propriétaire avec une porte d’un autre événement', partner, ev, t, gateOf(other, 'Porte Nord'), 'GATE_INVALID'],
            ['contrôleur de Z0 avec un gateId', ctrl0, ev0, t0, gateOf(ev, 'Porte Nord'), 'GATE_CHANGED'],
        ];
        for (const [label, user, event, ticket, gateId, code] of cases) {
            const id = String(ticket.id);
            const before = (await scansOf(id)).length;
            const r = await scanAtGate(user, await qr(event, id), gateId);
            assert.equal(r.status, 409, `${label} : ${show(r)}`);
            assert.deepEqual(r.body, { error: GATE_TEXT[code], code }, `${label} : corps exact (11.3), sans donnée du billet : ${show(r)}`);
            assert.equal((await scansOf(id)).length, before, `${label} : aucune ligne ticket_scans`);
            assert.equal((await ticketRow(id)).status, 'VALIDE', `${label} : billet non composté`);
        }
        assert.equal(await auditCount([noGate.userId, nord.userId, partner.userId, ctrl0.userId], since), 0, 'aucun audit nouveau pour un problème de porte');
    });
});

// ── 6. Rejeu ───────────────────────────────────────────────────────────────

describe('9t.15 Rejeu d’un verdict de zone', () => {
    test('6. rejeu de la même clé d’un wrong_zone : même verdict, billet rendu, aucune ligne nouvelle', async () => {
        const ev = await zonedEvent('rejeu');
        const nord = await controllerAt(ev, 'Porte Nord', 'zs-rejeu');
        const id = String((await oneTicket(ev, VIP)).id);
        const key = randomUUID();
        const body = await qr(ev, id);
        const first = await scanAtGate(nord, body, gateOf(ev, 'Porte Nord'), { idempotencyKey: key });
        expectResult(first, 'wrong_zone', 'premier passage');
        const count = (await scansOf(id)).length;
        const again = await scanAtGate(nord, body, gateOf(ev, 'Porte Nord'), { idempotencyKey: key });
        expectResult(again, 'wrong_zone', 'rejeu de la même clé');
        assert.equal(again.body.replayed, true, show(again));
        assert.equal(ticketOf(again).id, id, `billet rendu au rejeu (une ligne de zone garde son billet) : ${show(again)}`);
        assert.deepEqual(again.body.redirect_zones, first.body.redirect_zones, show(again));
        assert.equal((await scansOf(id)).length, count, 'aucune ligne nouvelle');
    });
});

// ── 7. Saisie manuelle ─────────────────────────────────────────────────────

describe('9t.15 Saisie manuelle à une porte', () => {
    test('7. saisie manuelle à une porte : aperçus wrong_zone, not_entered, zone_ok sans ligne ; validation manuelle à la mauvaise porte : wrong_zone', async () => {
        const ev = await zonedEvent('manuel');
        const nord = await controllerAt(ev, 'Porte Nord', 'zs-man-nord');
        const carre = await controllerAt(ev, 'Accès carré', 'zs-man-carre');
        const porteVip = await controllerAt(ev, 'Porte VIP', 'zs-man-vip');
        const vip = await oneTicket(ev, VIP);
        const vvip = await oneTicket(ev, VVIP);
        const lookups = async (user: Buyer): Promise<number> => {
            const { count, error } = await service.from('audit_logs').select('id', { count: 'exact', head: true }).eq('user_id', user.userId).eq('action', 'MANUAL_LOOKUP');
            assert.equal(error, null, `audit : ${error?.message}`);
            return count ?? 0;
        };
        const preview = async (user: Buyer, t: Row, gate: string, expected: string, redirect: string[] | undefined): Promise<void> => {
            const id = String(t.id);
            const rowsBefore = (await scansOf(id)).length;
            const auditsBefore = await lookups(user);
            const r = await lookupAtGate(user, ev.eventId, String(t.ticket_number), gateOf(ev, gate));
            assert.equal(r.status, 200, `aperçu à ${gate} : ${show(r)}`);
            const tk = ticketOf(r);
            assert.equal(tk.preview, expected, `aperçu à ${gate} : ${show(r)}`);
            if (redirect) assert.deepEqual(tk.redirect_zones, redirect, `zones proposées : ${show(r)}`);
            assert.equal((await scansOf(id)).length, rowsBefore, 'aucune ligne ticket_scans pour un aperçu');
            assert.equal(await lookups(user), auditsBefore + 1, 'un audit MANUAL_LOOKUP par vérification');
        };
        await preview(nord, vip, 'Porte Nord', 'wrong_zone', ['Entrée VIP']);
        await preview(carre, vvip, 'Accès carré', 'not_entered', ['Entrée VIP']);
        expectResult(await scanAtGate(porteVip, await qr(ev, String(vvip.id)), gateOf(ev, 'Porte VIP')), 'valid', 'entrée du VVIP');
        await preview(carre, vvip, 'Accès carré', 'zone_ok', undefined);

        const manual = await scanAtGate(nord, { eventId: ev.eventId, manualTicketNumber: String(vip.ticket_number), identityVerified: true }, gateOf(ev, 'Porte Nord'));
        expectResult(manual, 'wrong_zone', 'validation manuelle du VIP à la Porte Nord');
        assert.equal((await ticketRow(String(vip.id))).status, 'VALIDE', 'rien composté');
    });
});

// ── 8 et 9. Couleur, consigne, origine ─────────────────────────────────────

describe('9t.15 Couleur, consigne et origine servies au scanneur', () => {
    test('8. couleur, consigne et origine : servies au scanneur, consigne seulement sur l’entrée validée', async () => {
        const ev = await zonedEvent('couleur');
        const instruction = 'Remettre bracelet doré — orienter vers le carré VVIP';
        const patch = await routeHandler('../../app/api/partner/events/[id]/categories/[categoryId]/route', 'PATCH', 'PATCH de la catégorie (F54)');
        const vipId = ev.categories[VIP].id;
        const set = await invoke(patch, authed(`/api/partner/events/${ev.eventId}/categories/${vipId}`, 'PATCH', partner,
            { scan_color: 'OR', entry_instruction: instruction }), routeContext({ id: ev.eventId, categoryId: vipId }));
        assert.equal(set.status, 200, `couleur et consigne de la catégorie VIP (route de D, F54) : ${show(set)}`);

        const porteVip = await controllerAt(ev, 'Porte VIP', 'zs-coul-vip');
        const carre = await controllerAt(ev, 'Accès carré', 'zs-coul-carre');
        const id = String((await oneTicket(ev, VIP)).id);
        const ok = await scanAtGate(porteVip, await qr(ev, id), gateOf(ev, 'Porte VIP'));
        expectResult(ok, 'valid', 'VIP à la Porte VIP');
        assert.equal(ticketOf(ok).category_color, 'OR', show(ok));
        assert.equal(ticketOf(ok).entry_instruction, instruction, show(ok));
        assert.equal(ticketOf(ok).origin, 'ONLINE', show(ok));
        const zoneOk = await scanAtGate(carre, await qr(ev, id), gateOf(ev, 'Accès carré'));
        expectResult(zoneOk, 'zone_ok', 'VIP au carré');
        assert.ok(!JSON.stringify(zoneOk.body).includes(instruction), `consigne absente d’un contrôle de zone : ${show(zoneOk)}`);
        assert.equal(ticketOf(zoneOk).category_color, 'OR', show(zoneOk));
        const again = await scanAtGate(porteVip, await qr(ev, id), gateOf(ev, 'Porte VIP'));
        expectResult(again, 'already_used', 'second passage');
        assert.ok(!JSON.stringify(again.body).includes(instruction), `consigne absente d’un billet déjà utilisé : ${show(again)}`);

        const ev0 = await plainEvent('origines', [{ name: 'Gratuit', price: 0, total: 10 }, { name: SIMPLE, price: 5_000, total: 10 }]);
        const ctrl0 = await newController(partner, ev0.eventId, { label: 'zs-origines' });
        const { data: claimed, error } = await service.rpc('free_tickets_claim', {
            p_user_id: buyer.userId, p_event_id: ev0.eventId, p_items: [{ category_id: ev0.categories.Gratuit.id, quantity: 1 }],
        });
        assert.equal(error, null, `free_tickets_claim : ${error?.message}`);
        assert.equal((claimed as Row).ok, true, JSON.stringify(claimed));
        const { data: free, error: freeErr } = await service.from('tickets').select('id').eq('event_id', ev0.eventId).eq('category_id', ev0.categories.Gratuit.id);
        assert.equal(freeErr, null, `billet gratuit : ${freeErr?.message}`);
        assert.equal((free ?? []).length, 1, 'un billet gratuit');
        const freeScan = await scanAtGate(ctrl0, await qr(ev0, String(free![0].id)), undefined);
        expectResult(freeScan, 'valid', 'billet gratuit');
        assert.equal(ticketOf(freeScan).origin, 'FREE', show(freeScan));

        const guest = await newBuyer('zs-invite', { firstName: 'Khadija', lastName: 'Invitee' });
        await markPhoneVerified(guest.userId);
        const sent = await sendInvitations(partner, ev0.eventId, { category_id: ev0.categories[SIMPLE].id, phones: [guest.phoneE164], quantity: 1 });
        assert.equal(sent.status, 200, `invitation : ${show(sent)}`);
        const { data: inv, error: invErr } = await service.from('tickets').select('id').eq('event_id', ev0.eventId).eq('user_id', guest.userId).eq('sale_channel', 'INVITATION');
        assert.equal(invErr, null, `invitation : ${invErr?.message}`);
        assert.equal((inv ?? []).length, 1, 'invitation au compte vérifié');
        const invScan = await scanAtGate(ctrl0, await qr(ev0, String(inv![0].id)), undefined);
        expectResult(invScan, 'valid', 'invitation');
        assert.equal(ticketOf(invScan).origin, 'INVITATION', show(invScan));
    });

    test('9. invitation VIP refusée dans une zone qui n’admet pas le VIP (consigne 6)', async () => {
        const ev = await zonedEvent('invitation');
        const nord = await controllerAt(ev, 'Porte Nord', 'zs-inv-nord');
        const porteVip = await controllerAt(ev, 'Porte VIP', 'zs-inv-vip');
        const guest = await newBuyer('zs-inv-vip', { firstName: 'Mame', lastName: 'Invitee' });
        await markPhoneVerified(guest.userId);
        const sent = await sendInvitations(partner, ev.eventId, { category_id: ev.categories[VIP].id, phones: [guest.phoneE164], quantity: 1 });
        assert.equal(sent.status, 200, `invitation VIP : ${show(sent)}`);
        const { data, error } = await service.from('tickets').select('id').eq('event_id', ev.eventId).eq('user_id', guest.userId).eq('sale_channel', 'INVITATION');
        assert.equal(error, null, `invitation : ${error?.message}`);
        assert.equal((data ?? []).length, 1, 'billet au porteur (compte vérifié)');
        const id = String(data![0].id);
        const wrong = await scanAtGate(nord, await qr(ev, id), gateOf(ev, 'Porte Nord'));
        expectResult(wrong, 'wrong_zone', 'invitation VIP à la Porte Nord');
        assert.equal(ticketOf(wrong).origin, 'INVITATION', show(wrong));
        assert.equal((await ticketRow(id)).status, 'VALIDE', 'billet non composté');
        expectResult(await scanAtGate(porteVip, await qr(ev, id), gateOf(ev, 'Porte VIP')), 'valid', 'invitation VIP à la Porte VIP');
    });
});

// ── 10. Configuration pendant un scan ──────────────────────────────────────

describe('9t.15 Configuration et scan concurrents', () => {
    test('10. configuration enregistrée pendant un scan : aucun interblocage, porte en cours d’usage protégée', async () => {
        const ev = await zonedEvent('concurrence');
        const id = String((await oneTicket(ev, SIMPLE)).id);
        const t = await ticketRow(id);
        const a = await openConcurrentClient({ applicationName: 'ev-test-zones-scan' });
        const b = await openConcurrentClient({ applicationName: 'ev-test-zones-save' });
        try {
            const scanP = {
                scanner_id: partner.userId, event_id: ev.eventId, client_key: randomUUID(), method: 'QR', ticket_id: id, totp_ok: true,
                secret_version: Number(t.security_version), gate_id: gateOf(ev, 'Porte Sud'),
                payload_hash: createHash('sha256').update(`zones-scan-${id}`).digest('hex'),
            };
            const scanned = await a.query<{ r: Row }>('SELECT public.ticket_scan($1::jsonb) AS r', [JSON.stringify(scanP)]);
            assert.equal(scanned.rows[0].r.result, 'valid', `scan tenu par A : ${JSON.stringify(scanned.rows[0].r)}`);
            const withoutSud = ZONES.map((z) => ({
                name: z.name, kind: z.kind,
                category_ids: z.admits.map((n) => ev.categories[n].id),
                gates: z.gates.filter((g) => g !== 'Porte Sud').map((g) => ({ id: gateOf(ev, g), name: g })),
                id: ev.zones[z.name].id,
            }));
            const saveP = { event_id: ev.eventId, actor_id: partner.userId, zones: withoutSud };
            const pending = b.query<{ r: Row }>('SELECT public.event_zones_save($1::jsonb) AS r', [JSON.stringify(saveP)]).then(
                (res) => ({ ok: true as const, r: res.rows[0].r }),
                (err: unknown) => ({ ok: false as const, code: String((err as { code?: string }).code ?? ''), message: String((err as Error).message) }),
            );
            await waitForLockWaiters([b.pid]);
            await a.commit();
            const out = await pending;
            assert.ok(out.ok, `enregistrement : ${JSON.stringify(out)} (aucune 40P01 attendue)`);
            assert.equal(out.r.ok, false, JSON.stringify(out.r));
            assert.equal(out.r.code, 'GATE_IN_USE', JSON.stringify(out.r));
            await b.rollback();
        } finally {
            await a.close();
            await b.close();
        }
        assert.equal(acceptedOf(await scansOf(id)).length, 1, 'le scan de A est validé');
        const { data: kept, error: keptErr } = await service.from('event_gates').select('id, name').eq('id', gateOf(ev, 'Porte Sud'));
        assert.equal(keptErr, null, `event_gates : ${keptErr?.message}`);
        assert.deepEqual(kept, [{ id: gateOf(ev, 'Porte Sud'), name: 'Porte Sud' }], 'la Porte Sud, déjà scannée, n’est pas supprimée');
    });
});
