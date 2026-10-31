/**
 * Lot 4, tâche 4.5 — encaissement espèces au scan (constats R20, scan-security-6, scan-security-18,
 * data-model-17 ; CDC §11, §55, §76). Contrat : sections D et E de la conception du lot 4.
 *  - billet « à régler sur place » (commande impayée, sans payment_id) : le scan répond cash_required
 *    avec scan_id et amount_due = prix du billet (jamais le total de la commande), sans composter ;
 *  - PUT /api/controller/scan { scanId, eventId } → ticket_cash_checkin, tout ou rien : scan
 *    cash_required du même scanneur, de moins de 5 minutes, non consommé ; commande réellement impayée ;
 *    caisse OUVERT du scanneur pour l'événement (TOUS les rôles) ; paiement hors plateforme SUCCESS au
 *    prix facial (fin_offline, ESPECES, shift_id), tickets.payment_id, orders.paid_amount += prix
 *    (SUCCESS quand tous les billets sont réglés), expected_cash_total incrémenté, compostage, scan
 *    accepté, audit_logs ; refus { result, code } sans aucun effet ;
 *  - ouverture de caisse : contrôleur affecté avec can_accept_cash, partenaire propriétaire ou admin ;
 *    une seule caisse OUVERT par (scanneur, événement), même en concurrence ;
 *  - schéma : index unique partiel des caisses ouvertes, controller_shifts.event_id, tickets.order_id
 *    et payments.shift_id en ON DELETE RESTRICT (vérifié dans le catalogue de la base locale).
 * Routes et modules réécrits au lot 4 : importés dynamiquement (acces-helpers).
 * La suite crée son partenaire, ses événements (dans la fenêtre de scan), ses contrôleurs et son admin.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { inspect } from '../helpers/db';
import { assertAccessInvariants } from '../helpers/access-invariants';
import { newBuyer, service, type Buyer, type SaleEvent } from './paiement-helpers';
import { ledgerOf, newPartner, paymentRow, type TestPartner } from './finance-helpers';
import {
    cashCheckin, createCashOrderTickets, createTimedEvent, newController, openShift, scan, scansOf, shiftRow, ticketPayload, ticketRow,
    type RouteResult,
} from './acces-helpers';

const PRICE = 5000;
const VIP_PRICE = 12_000;
const FIN_OFFLINE_ZERO = ['service_fee', 'aggregator_fee', 'gross_event_village_revenue', 'net_event_village_revenue', 'partner_payout_amount'];

let partner: TestPartner;
let ev: SaleEvent;
let ctrl: Buyer;
let buyer: Buyer;
let admin: Buyer;

before(async () => {
    partner = await newPartner('encaissement');
    ev = await createTimedEvent(partner.partnerId, 'encaissement', [
        { name: 'Standard', price: PRICE, total: 80 },
        { name: 'VIP', price: VIP_PRICE, total: 10 },
    ]);
    ctrl = await newController(partner, ev.eventId, { canAcceptCash: true, label: 'enc' });
    buyer = await newBuyer('enc-ach');
    admin = await newAdmin('enc');
});

after(async () => {
    await assertAccessInvariants('acces-encaissement');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

async function newAdmin(label: string): Promise<Buyer> {
    const user = await newBuyer(`admin-${label}`, { firstName: 'Aminata', lastName: 'Administratrice' });
    const { error } = await service.from('user_roles').upsert([{ user_id: user.userId, role: 'ADMIN' }], { onConflict: 'user_id,role' });
    assert.equal(error, null, `rôle ADMIN : ${error?.message}`);
    return user;
}

/** Payload caméra EVT1 (code dynamique du lot 4). */
async function cameraPayload(ticketId: string): Promise<string> {
    try {
        return await ticketPayload(ticketId);
    } catch (err) {
        assert.fail(`code dynamique du billet indisponible (lib/security/totp.ts, contrat C du lot 4) : ${err instanceof Error ? err.message : String(err)}`);
    }
}

/** Scan caméra d'un billet « à régler sur place » : cash_required au prix du billet, rien de composté. */
async function scanCashRequired(scanner: Buyer, eventId: string, ticketId: string, price: number): Promise<string> {
    const res = await scan(scanner, { eventId, payload: await cameraPayload(ticketId) });
    assert.equal(res.status, 200, `scan : HTTP ${res.status} ${JSON.stringify(res.body)}`);
    assert.equal(res.body.result, 'cash_required', `billet à régler sur place → cash_required : ${JSON.stringify(res.body)}`);
    assert.equal(Number(res.body.amount_due), price, `montant dû = prix du billet (${price} F), pas le total de la commande : ${JSON.stringify(res.body)}`);
    assert.equal(typeof res.body.scan_id, 'string', `scan_id renvoyé avec cash_required : ${JSON.stringify(res.body)}`);
    assert.equal((await ticketRow(ticketId)).status, 'VALIDE', 'aucun compostage avant l’encaissement');
    return res.body.scan_id as string;
}

async function openShiftsOf(userId: string, eventId: string): Promise<Array<Record<string, unknown>>> {
    const { data, error } = await service.from('controller_shifts').select('*').eq('controller_id', userId).eq('event_id', eventId).eq('status', 'OUVERT');
    assert.equal(error, null, `caisses ouvertes : ${error?.message}`);
    return (data ?? []) as Array<Record<string, unknown>>;
}

/** Caisse OUVERT du scanneur pour l'événement, ouverte par la route (contrat E) si elle n'existe pas. */
async function openCashShift(user: Buyer, eventId: string): Promise<string> {
    const existing = await openShiftsOf(user.userId, eventId);
    if (existing.length === 1) return existing[0].id as string;
    const res = await openShift(user, eventId);
    assert.equal(res.status, 200, `ouverture de caisse : HTTP ${res.status} ${JSON.stringify(res.body)}`);
    const rows = await openShiftsOf(user.userId, eventId);
    assert.equal(rows.length, 1, `une caisse OUVERT pour ce scanneur et cet événement (trouvé : ${rows.length})`);
    return rows[0].id as string;
}

async function orderRow(id: string): Promise<Record<string, unknown>> {
    const { data, error } = await service.from('orders').select('*').eq('id', id).single();
    assert.equal(error, null, `commande ${id} : ${error?.message}`);
    return data as Record<string, unknown>;
}

async function expectedCash(shiftId: string): Promise<number> {
    return Number((await shiftRow(shiftId)).expected_cash_total);
}

function assertOfflineCash(p: Record<string, unknown>, amount: number, shiftId: string, label: string): void {
    assert.equal(p.is_platform_payment, false, `${label} : paiement hors plateforme`);
    assert.equal(p.status, 'SUCCESS', `${label} : paiement SUCCESS`);
    assert.equal(Number(p.amount), amount, `${label} : montant = prix facial (${amount} F)`);
    if (p.facial_amount !== null && p.facial_amount !== undefined) assert.equal(Number(p.facial_amount), amount, `${label} : facial_amount`);
    assert.equal(p.offline_payment_method, 'ESPECES', `${label} : offline_payment_method`);
    assert.equal(p.shift_id, shiftId, `${label} : paiement rattaché à la caisse du scanneur`);
    for (const k of FIN_OFFLINE_ZERO) assert.equal(Number(p[k] ?? 0), 0, `${label} : ${k} = 0 (fin_offline, aucun frais ni revenu Event Village)`);
}

async function assertNoLedgerEntry(paymentId: string, label: string): Promise<void> {
    const { data, error } = await service.from('finance_ledger').select('id, entry_type, amount').eq('payment_id', paymentId);
    assert.equal(error, null, `grand livre : ${error?.message}`);
    assert.deepEqual(data ?? [], [], `${label} : aucune écriture au grand livre pour un paiement hors plateforme`);
}

async function auditRowsFor(ids: string[]): Promise<Array<Record<string, unknown>>> {
    const { data, error } = await service.from('audit_logs').select('*').in('object_id', ids);
    assert.equal(error, null, `audit_logs : ${error?.message}`);
    return (data ?? []) as Array<Record<string, unknown>>;
}

/** Refus d'encaissement : jamais « valid », jamais une erreur serveur, code explicite. */
function assertCashRefused(res: RouteResult, label: string, code?: string): void {
    assert.ok(res.status < 500, `${label} : erreur serveur HTTP ${res.status} ${JSON.stringify(res.body)}`);
    assert.notEqual(res.body.result, 'valid', `${label} : encaissement refusé attendu, reçu ${JSON.stringify(res.body)}`);
    assert.equal(typeof res.body.code, 'string', `${label} : code de refus explicite attendu : ${JSON.stringify(res.body)}`);
    if (code) assert.equal(res.body.code, code, `${label} : code ${code} attendu : ${JSON.stringify(res.body)}`);
}

/** Billet resté « à régler sur place » : VALIDE, sans paiement, commande inchangée. */
async function assertUntouched(ticketId: string, orderId: string, label: string, expectStatus = 'VALIDE'): Promise<void> {
    const t = await ticketRow(ticketId);
    assert.equal(t.status, expectStatus, `${label} : billet non composté (${t.status})`);
    assert.equal(t.payment_id ?? null, null, `${label} : aucun paiement rattaché au billet`);
    const o = await orderRow(orderId);
    assert.equal(Number(o.paid_amount), 0, `${label} : commande non créditée (paid_amount ${o.paid_amount})`);
    assert.notEqual(o.payment_status, 'SUCCESS', `${label} : commande toujours impayée`);
}

// ── Encaissement ───────────────────────────────────────────────────────────

describe('Encaissement espèces au scan', () => {
    test('commande de 3 billets à régler sur place : cash_required au prix du billet, encaissement billet par billet, commande SUCCESS au dernier', async () => {
        const order = await createCashOrderTickets(buyer, partner, ev, 'Standard', 3);
        const shiftId = await openCashShift(ctrl, ev.eventId);
        const startTotal = await expectedCash(shiftId);
        const paymentIds = new Set<string>();
        let paid = 0;
        let lastScanId = '';

        for (let i = 0; i < order.ticketIds.length; i++) {
            const ticketId = order.ticketIds[i];
            const label = `billet ${i + 1}/3`;
            const scanId = await scanCashRequired(ctrl, ev.eventId, ticketId, PRICE);
            lastScanId = scanId;
            const res = await cashCheckin(ctrl, { scanId, eventId: ev.eventId });
            assert.equal(res.status, 200, `${label} : encaissement HTTP ${res.status} ${JSON.stringify(res.body)}`);
            assert.equal(res.body.result, 'valid', `${label} : encaissement accepté : ${JSON.stringify(res.body)}`);
            assert.equal(Number(res.body.amount), PRICE, `${label} : montant encaissé = prix du billet : ${JSON.stringify(res.body)}`);
            paid += PRICE;

            const t = await ticketRow(ticketId);
            assert.equal(t.status, 'UTILISE', `${label} : composté après l’encaissement`);
            assert.equal(typeof t.payment_id, 'string', `${label} : tickets.payment_id renseigné`);
            const paymentId = t.payment_id as string;
            assert.ok(!paymentIds.has(paymentId), `${label} : un paiement par billet encaissé`);
            paymentIds.add(paymentId);
            assertOfflineCash(await paymentRow(paymentId), PRICE, shiftId, label);
            await assertNoLedgerEntry(paymentId, label);

            const o = await orderRow(order.orderId);
            assert.equal(Number(o.paid_amount), paid, `${label} : orders.paid_amount += prix du billet`);
            if (i < order.ticketIds.length - 1) {
                assert.notEqual(o.payment_status, 'SUCCESS', `${label} : commande pas encore entièrement réglée`);
            } else {
                assert.equal(o.payment_status, 'SUCCESS', 'dernier billet réglé : commande SUCCESS');
            }
            assert.equal(await expectedCash(shiftId), startTotal + paid, `${label} : expected_cash_total incrémenté du prix du billet`);

            const scans = await scansOf(ticketId);
            assert.equal(scans.filter((s) => s.accepted === true).length, 1, `${label} : exactement un scan accepté : ${JSON.stringify(scans)}`);
            const cashScan = scans.find((s) => s.id === scanId);
            assert.ok(cashScan, `${label} : le scan cash_required est journalisé`);
            assert.ok(cashScan.consumed_at, `${label} : le scan cash_required est consommé`);
            const audit = await auditRowsFor([ticketId, paymentId, scanId]);
            assert.ok(audit.length > 0, `${label} : encaissement journalisé dans audit_logs`);
        }

        const replay = await cashCheckin(ctrl, { scanId: lastScanId, eventId: ev.eventId });
        assertCashRefused(replay, 'rejeu d’un scan déjà consommé');
        assert.equal(await expectedCash(shiftId), startTotal + paid, 'rejeu : total attendu inchangé');
        assert.equal(Number((await orderRow(order.orderId)).paid_amount), paid, 'rejeu : commande inchangée');
        assert.deepEqual(await ledgerOf(partner.userId, 'ORGANISATEUR'), [], 'ventes espèces : aucun crédit au compte organisateur');
    });

    test('commande de 2 billets VIP : un seul réglé → paid_amount = prix d’un billet, commande toujours impayée', async () => {
        const order = await createCashOrderTickets(buyer, partner, ev, 'VIP', 2);
        const shiftId = await openCashShift(ctrl, ev.eventId);
        const startTotal = await expectedCash(shiftId);
        const scanId = await scanCashRequired(ctrl, ev.eventId, order.ticketIds[0], VIP_PRICE);
        const res = await cashCheckin(ctrl, { scanId, eventId: ev.eventId });
        assert.equal(res.body.result, 'valid', `encaissement du premier billet : HTTP ${res.status} ${JSON.stringify(res.body)}`);
        const o = await orderRow(order.orderId);
        assert.equal(Number(o.paid_amount), VIP_PRICE, 'paid_amount = prix d’un seul billet');
        assert.notEqual(o.payment_status, 'SUCCESS', 'un billet reste à régler : commande non SUCCESS');
        assert.equal(await expectedCash(shiftId), startTotal + VIP_PRICE, 'caisse créditée du seul billet encaissé');
        assert.equal((await ticketRow(order.ticketIds[1])).status, 'VALIDE', 'l’autre billet n’est ni composté ni réglé');
        await scanCashRequired(ctrl, ev.eventId, order.ticketIds[1], VIP_PRICE);
    });

    test('commande payée entre le scan et l’encaissement : refus CASH_ALREADY_PAID, rien n’est composté ni encaissé', async () => {
        const order = await createCashOrderTickets(buyer, partner, ev, 'Standard', 1);
        const ticketId = order.ticketIds[0];
        const shiftId = await openCashShift(ctrl, ev.eventId);
        const startTotal = await expectedCash(shiftId);
        const scanId = await scanCashRequired(ctrl, ev.eventId, ticketId, PRICE);
        const { error } = await service.from('orders').update({ payment_status: 'SUCCESS', paid_amount: PRICE, balance_amount: 0 }).eq('id', order.orderId);
        assert.equal(error, null, `commande réglée ailleurs : ${error?.message}`);
        try {
            const res = await cashCheckin(ctrl, { scanId, eventId: ev.eventId });
            assertCashRefused(res, 'commande déjà payée', 'CASH_ALREADY_PAID');
            const t = await ticketRow(ticketId);
            assert.equal(t.status, 'VALIDE', 'commande déjà payée : billet non composté par l’encaissement');
            assert.equal(t.payment_id ?? null, null, 'commande déjà payée : aucun paiement créé');
            assert.equal(await expectedCash(shiftId), startTotal, 'commande déjà payée : caisse inchangée');
        } finally {
            // billet payant VALIDE sans paiement d'une commande SUCCESS : hors du cas légitime de l'invariant (b)
            await service.from('tickets').update({ status: 'ANNULE' }).eq('id', ticketId);
        }
    });

    test('sans caisse ouverte : refus CASH_NO_OPEN_SHIFT pour le contrôleur, le partenaire propriétaire et l’admin, billet non composté', async () => {
        const ev2 = await createTimedEvent(partner.partnerId, 'enc-sans-caisse', [{ name: 'Standard', price: PRICE, total: 20 }]);
        const ctrl2 = await newController(partner, ev2.eventId, { canAcceptCash: true, label: 'enc-sans-caisse' });
        for (const [label, scanner] of [['contrôleur affecté', ctrl2], ['partenaire propriétaire', partner], ['admin', admin]] as Array<[string, Buyer]>) {
            assert.equal((await openShiftsOf(scanner.userId, ev2.eventId)).length, 0, `${label} : précondition, aucune caisse ouverte`);
            const order = await createCashOrderTickets(buyer, partner, ev2, 'Standard', 1);
            const scanId = await scanCashRequired(scanner, ev2.eventId, order.ticketIds[0], PRICE);
            const res = await cashCheckin(scanner, { scanId, eventId: ev2.eventId });
            assertCashRefused(res, `${label} sans caisse`, 'CASH_NO_OPEN_SHIFT');
            await assertUntouched(order.ticketIds[0], order.orderId, `${label} sans caisse`);
        }
    });

    test('ouverture de caisse : partenaire propriétaire et admin ouvrent et encaissent ; contrôleur sans permission espèces refusé', async () => {
        const ev3 = await createTimedEvent(partner.partnerId, 'enc-ouverture', [{ name: 'Standard', price: PRICE, total: 20 }]);
        const noCash = await newController(partner, ev3.eventId, { canAcceptCash: false, label: 'enc-sans-especes' });
        const refused = await openShift(noCash, ev3.eventId);
        assert.ok(refused.status >= 400 && refused.status < 500, `contrôleur sans permission espèces : ouverture refusée (HTTP ${refused.status} ${JSON.stringify(refused.body)})`);
        assert.equal((await openShiftsOf(noCash.userId, ev3.eventId)).length, 0, 'aucune caisse créée sans permission espèces');

        for (const [label, scanner] of [['partenaire propriétaire', partner], ['admin', admin]] as Array<[string, Buyer]>) {
            const shiftId = await openCashShift(scanner, ev3.eventId);
            const order = await createCashOrderTickets(buyer, partner, ev3, 'Standard', 1);
            const scanId = await scanCashRequired(scanner, ev3.eventId, order.ticketIds[0], PRICE);
            const res = await cashCheckin(scanner, { scanId, eventId: ev3.eventId });
            assert.equal(res.body.result, 'valid', `${label} avec caisse ouverte : encaissement accepté (HTTP ${res.status} ${JSON.stringify(res.body)})`);
            const t = await ticketRow(order.ticketIds[0]);
            assert.equal(t.status, 'UTILISE', `${label} : billet composté`);
            assertOfflineCash(await paymentRow(t.payment_id as string), PRICE, shiftId, label);
            assert.equal(await expectedCash(shiftId), PRICE, `${label} : encaissement compté dans SA caisse`);
        }
    });

    test('scan d’un autre scanneur ou de plus de 5 minutes : refusé, billet non composté ; un scan frais du même scanneur passe', async () => {
        const order = await createCashOrderTickets(buyer, partner, ev, 'Standard', 1);
        const ticketId = order.ticketIds[0];
        const shiftA = await openCashShift(ctrl, ev.eventId);
        const other = await newController(partner, ev.eventId, { canAcceptCash: true, label: 'enc-autre' });
        const shiftB = await openCashShift(other, ev.eventId);
        const totalA = await expectedCash(shiftA);

        const scanId = await scanCashRequired(ctrl, ev.eventId, ticketId, PRICE);
        const byOther = await cashCheckin(other, { scanId, eventId: ev.eventId });
        assertCashRefused(byOther, 'scan d’un autre scanneur');
        await assertUntouched(ticketId, order.orderId, 'scan d’un autre scanneur');
        assert.equal(await expectedCash(shiftB), 0, 'caisse de l’autre scanneur inchangée');

        const { error } = await service.from('ticket_scans').update({ created_at: new Date(Date.now() - 6 * 60_000).toISOString() }).eq('id', scanId);
        assert.equal(error, null, `vieillissement du scan : ${error?.message}`);
        const expired = await cashCheckin(ctrl, { scanId, eventId: ev.eventId });
        assertCashRefused(expired, 'scan de plus de 5 minutes', 'CASH_SCAN_EXPIRED');
        await assertUntouched(ticketId, order.orderId, 'scan de plus de 5 minutes');
        assert.equal(await expectedCash(shiftA), totalA, 'scan trop ancien : caisse inchangée');

        const fresh = await scanCashRequired(ctrl, ev.eventId, ticketId, PRICE);
        const ok = await cashCheckin(ctrl, { scanId: fresh, eventId: ev.eventId });
        assert.equal(ok.body.result, 'valid', `scan frais du même scanneur : accepté (${JSON.stringify(ok.body)})`);
        assert.equal(await expectedCash(shiftA), totalA + PRICE, 'scan frais : caisse créditée');
    });

    test('échec de l’encaissement (caisse fermée ou billet devenu non valable après le scan) : rien n’est composté, aucun paiement', async () => {
        // a) caisse clôturée entre le scan et l'encaissement
        const closer = await newController(partner, ev.eventId, { canAcceptCash: true, label: 'enc-cloture' });
        const shiftC = await openCashShift(closer, ev.eventId);
        const orderA = await createCashOrderTickets(buyer, partner, ev, 'Standard', 1);
        const scanA = await scanCashRequired(closer, ev.eventId, orderA.ticketIds[0], PRICE);
        const { error: closeErr } = await service.from('controller_shifts')
            .update({ status: 'CLOTURE', declared_cash_total: 0, discrepancy_amount: 0, closed_at: new Date().toISOString() })
            .eq('id', shiftC);
        assert.equal(closeErr, null, `clôture de la caisse : ${closeErr?.message}`);
        const resA = await cashCheckin(closer, { scanId: scanA, eventId: ev.eventId });
        assertCashRefused(resA, 'caisse clôturée après le scan', 'CASH_NO_OPEN_SHIFT');
        await assertUntouched(orderA.ticketIds[0], orderA.orderId, 'caisse clôturée après le scan');
        assert.equal(await expectedCash(shiftC), 0, 'caisse clôturée : total attendu inchangé');

        // b) billet passé en remboursement entre le scan et l'encaissement
        const shiftId = await openCashShift(ctrl, ev.eventId);
        const total = await expectedCash(shiftId);
        const orderB = await createCashOrderTickets(buyer, partner, ev, 'Standard', 1);
        const scanB = await scanCashRequired(ctrl, ev.eventId, orderB.ticketIds[0], PRICE);
        const { error: tErr } = await service.from('tickets').update({ status: 'REMBOURSEMENT_EN_COURS' }).eq('id', orderB.ticketIds[0]);
        assert.equal(tErr, null, `billet en remboursement : ${tErr?.message}`);
        const resB = await cashCheckin(ctrl, { scanId: scanB, eventId: ev.eventId });
        assertCashRefused(resB, 'billet devenu non valable après le scan');
        await assertUntouched(orderB.ticketIds[0], orderB.orderId, 'billet devenu non valable après le scan', 'REMBOURSEMENT_EN_COURS');
        assert.equal(await expectedCash(shiftId), total, 'billet non valable : caisse inchangée');
    });

    test('ouvertures simultanées pour le même contrôleur et le même événement : une seule caisse OUVERT', async () => {
        const racer = await newController(partner, ev.eventId, { canAcceptCash: true, label: 'enc-course' });
        const settled = await Promise.allSettled(Array.from({ length: 4 }, () => openShift(racer, ev.eventId)));
        const rejected = settled.filter((s) => s.status === 'rejected');
        assert.deepEqual(rejected, [], 'aucune exception non gérée');
        const results = settled.map((s) => (s as PromiseFulfilledResult<RouteResult>).value);
        assert.ok(results.every((r) => r.status < 500), `aucune erreur serveur : ${JSON.stringify(results.map((r) => [r.status, r.body]))}`);
        assert.ok(results.some((r) => r.status === 200), `au moins une ouverture acceptée : ${JSON.stringify(results.map((r) => [r.status, r.body]))}`);
        assert.equal((await openShiftsOf(racer.userId, ev.eventId)).length, 1, 'exactement une caisse OUVERT pour (contrôleur, événement)');
    });
});

// ── Contrôles statiques et schéma ──────────────────────────────────────────

const ROOT = process.cwd();

function offendingLines(file: string, patterns: Array<[RegExp, string]>): string[] {
    const abs = path.join(ROOT, file);
    if (!fs.existsSync(abs)) return [];
    const lines = fs.readFileSync(abs, 'utf8').split(/\r?\n/);
    const out: string[] = [];
    lines.forEach((line, i) => {
        for (const [re, why] of patterns) if (re.test(line)) out.push(`${file}:${i + 1} (${why}) ${line.trim()}`);
    });
    return out;
}

describe('Contrôles statiques et schéma de la caisse', () => {
    test('ShiftService sans repli en mémoire ni erreur avalée', () => {
        const offenders = offendingLines('lib/shifts/shift.service.ts', [
            [/memoryShifts|_clearMemory/, 'registre de caisse en mémoire'],
            [/new Map\s*</, 'Map en mémoire'],
            [/catch\s*(\(\s*\w*\s*\))?\s*\{\s*\}/, 'erreur avalée'],
            [/console\.warn\([^)]*fallback/i, 'repli silencieux'],
        ]);
        assert.deepEqual(offenders, [], `replis mémoire ou erreurs avalées :\n${offenders.join('\n')}`);
    });

    test('route de scan : encaissement délégué à ticket_cash_checkin (plus de compostage puis mise à jour de commande en TypeScript)', () => {
        const file = 'app/api/controller/scan/route.ts';
        const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
        assert.match(src, /ticket_cash_checkin/, `${file} : l’encaissement passe par la RPC ticket_cash_checkin`);
        const offenders = offendingLines(file, [
            [/recordCashPayment/, 'incrément de caisse en TypeScript'],
            [/from\(\s*'orders'\s*\)/, 'commande lue ou modifiée hors RPC'],
            [/atomic_ticket_checkin/, 'compostage séparé de l’encaissement'],
            [/getActiveShift/, 'caisse résolue hors RPC'],
        ]);
        assert.deepEqual(offenders, [], `encaissement hors transaction :\n${offenders.join('\n')}`);
    });

    test('schéma : index unique partiel des caisses OUVERT, ON DELETE RESTRICT sur controller_shifts.event_id, tickets.order_id et payments.shift_id', async () => {
        const { indexes, fks } = await inspect(async (db) => {
            const idx = await db.query<{ indexdef: string }>(
                `SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'controller_shifts'`);
            const fk = await db.query<{ tbl: string; col: string; ref: string; deltype: string }>(
                `SELECT cl.relname AS tbl, a.attname AS col, rc.relname AS ref, c.confdeltype AS deltype
                   FROM pg_constraint c
                   JOIN pg_class cl ON cl.oid = c.conrelid
                   JOIN pg_namespace n ON n.oid = cl.relnamespace AND n.nspname = 'public'
                   JOIN pg_class rc ON rc.oid = c.confrelid
                   JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
                  WHERE c.contype = 'f' AND cl.relname IN ('controller_shifts', 'tickets', 'payments')`);
            return { indexes: idx.rows.map((r) => r.indexdef), fks: fk.rows };
        });
        const uniqueOpen = indexes.filter((d) => {
            if (!/^CREATE UNIQUE INDEX/i.test(d) || !/WHERE/i.test(d) || !/OUVERT/.test(d)) return false;
            const cols = (d.match(/\(([^)]*)\)/)?.[1] ?? '').split(',').map((c) => c.trim()).sort();
            return cols.length === 2 && cols[0] === 'controller_id' && cols[1] === 'event_id';
        });
        assert.equal(uniqueOpen.length, 1, `index unique partiel (controller_id, event_id) WHERE status = 'OUVERT' attendu :\n${indexes.join('\n')}`);

        const fkOf = (tbl: string, col: string) => fks.find((f) => f.tbl === tbl && f.col === col);
        const shiftEvent = fkOf('controller_shifts', 'event_id');
        assert.equal(shiftEvent?.deltype, 'r', `controller_shifts.event_id : ON DELETE RESTRICT attendu (confdeltype ${shiftEvent?.deltype})`);
        const ticketOrder = fkOf('tickets', 'order_id');
        assert.equal(ticketOrder?.deltype, 'r', `tickets.order_id : ON DELETE RESTRICT attendu (confdeltype ${ticketOrder?.deltype})`);
        const paymentShift = fkOf('payments', 'shift_id');
        assert.ok(paymentShift, 'payments.shift_id : clé étrangère vers controller_shifts attendue');
        assert.equal(paymentShift.ref, 'controller_shifts', 'payments.shift_id référence controller_shifts');
        assert.equal(paymentShift.deltype, 'r', `payments.shift_id : ON DELETE RESTRICT attendu (confdeltype ${paymentShift.deltype})`);
    });

    test('RPC shift_open et ticket_cash_checkin : SECURITY DEFINER, search_path = public, réservées au service_role', async () => {
        const rows = await inspect(async (db) => (await db.query<{ proname: string; secdef: boolean; config: string[] | null; anon: boolean; auth: boolean }>(
            `SELECT p.proname, p.prosecdef AS secdef, p.proconfig AS config,
                    has_function_privilege('anon', p.oid, 'EXECUTE') AS anon,
                    has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth
               FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'public' AND p.proname IN ('shift_open', 'ticket_cash_checkin')`)).rows);
        for (const fn of ['shift_open', 'ticket_cash_checkin']) {
            const r = rows.filter((x) => x.proname === fn);
            assert.ok(r.length > 0, `fonction ${fn} absente`);
            for (const x of r) {
                assert.equal(x.secdef, true, `${fn} : SECURITY DEFINER`);
                assert.ok((x.config ?? []).some((c) => /^search_path=public$/.test(c)), `${fn} : search_path = public (${JSON.stringify(x.config)})`);
                assert.equal(x.anon, false, `${fn} : non exécutable par anon`);
                assert.equal(x.auth, false, `${fn} : non exécutable par authenticated`);
            }
        }
    });
});
