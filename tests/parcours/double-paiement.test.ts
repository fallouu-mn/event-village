/**
 * Lot 8, tâche 8.2 a — double paiement réussi d'un même panier (contrat section 6.1, L30 à L33, point ouvert 16
 * du lot 7 ; écrivain W3). Faux SamirPay de tests/fakes. Un événement et un acheteur neufs par cas.
 *
 * « Même panier » (L30) : mêmes catégories et mêmes quantités, même compte, même événement, X créé avant la
 * confirmation de Y. Le paiement remboursé est le second confirmé chez nous, quel que soit l'ordre de création
 * (L31) ; les frais d'agrégateur restent à la charge d'Event Village.
 *  1. A annulé par le client, B acheté et confirmé, succès tardif de A par webhook : A REFUNDED, 0 billet, B
 *     garde ses billets ; sold_quantity = un seul jeu, held 0 ; un cashout REFUND = A.amount ; une VENTE (B),
 *     commission de B seule ; un REFUND_PAID (SMS exact) ; une alerte ADMIN_DUPLICATE_PAYMENT par admin ;
 *  2. même chose par le cron (source RECONCILIATION, A EXPIRED) ;
 *  3. ordre inverse : A PENDING échu confirmé d'abord, B ensuite : B remboursé ;
 *  4. rejeu du webhook : REFUND_IN_PROGRESS, pas de second cashout ;
 *  5. témoin : rachat séquentiel identique : deux jeux, aucun remboursement ;
 *  6. témoin : panier différent (1 VIP puis 2 VIP) : deux jeux ;
 *  7. témoin : Y entièrement remboursé : X émet ses billets ;
 *  8. concurrence : deux payment_confirm sur deux connexions, attente constatée par waitForLockWaiters : un seul
 *     jeu ;
 *  9. refus de l'opérateur : ADMIN_REFUND_TO_RETRY, la relance admin aboutit ;
 * 10. getSolde indisponible au premier envoi : rien n'est envoyé avant 5 minutes, puis le cron verse (L33).
 *
 * Rouge avant correctif (fix(8.2a)) :
 *  - 1 à 4, 8 à 10 : payment_confirm n'a aucun contrôle croisé (20261105000007_lot7_confirmation.sql:57) : le
 *    stock le permet, donc le second paiement passe SUCCESS avec un second jeu de billets. Échec sur le statut
 *    du paiement en double, pas sur la plomberie ;
 *  - 10 exige en plus CashoutService.resumeUnsentRefunds, appelée par payments-reconcile (L33) ;
 *  - after() : assertRecetteInvariants nomme le schéma du lot absent.
 * Vert dès l'écriture (témoins, signalé) : 5, 6, 7. Leur garde-fou est le cas 1 : le même montage avec un panier
 * identique doit, lui, être remboursé. Sans le critère de temps et l'égalité stricte des paniers, 5 ou 6 rougissent.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { smsVar } from '../../lib/notifications/sms-format';
import { CashoutService } from '../../lib/payments/cashout.service';
import { SamirPayError } from '../../lib/samirpay/types';
import { assertRecetteInvariants, recetteViolations } from '../helpers/recette-invariants';
import { routeContext } from './helpers';
import {
    callsOf, cart, categoryState, checkout, cronRequest, deliverWebhook, eventTickets, fakePay, importModule, newBuyer, paymentById,
    providerSays, service, setFakeMode, type Buyer, type PaymentRow, type SaleEvent,
} from './paiement-helpers';
import { buyConfirmed, createPartnerEvent, jsonRequest, newPartner, paymentRow, type TestPartner } from './finance-helpers';
import { flushNotifications, newAdmin, outboxRows, smsMark, smsTo, withEnv, type TestAdmin } from './notif-helpers';
import { openConcurrentClient, waitForLockWaiters, type ConcurrentClient } from './terrain-helpers';

type Row = Record<string, unknown>;
type Items = Array<[string, number]>;

const CANCEL_ROUTE = '../../app/api/payments/[transactionId]/cancel/route';
const RECONCILE_ROUTE = '../../app/api/cron/payments-reconcile/route';
const RETRY_ROUTE = '../../app/api/admin/refunds/[id]/retry/route';
const CONFIRM_SQL = 'SELECT public.payment_confirm($1::uuid, $2::text) AS r';
const VIP_PRICE = 1_000;
/** 2 × 1 000 F : service 100, total 2 100, agrégateur 31,50, net 68,50 ; commission N1 à 5 % : 3,43 F. */
const TWO_VIP_N1_CENTS = 343;

let partner: TestPartner;
let sponsor: Buyer;
let refundAdmin: TestAdmin;
let plainAdmin: TestAdmin;

before(async () => {
    setFakeMode('cashoutMode', 'success');
    fakePay().balance = 10_000_000;
    partner = await newPartner('double-paiement');
    sponsor = await newBuyer('double-parrain', { firstName: 'Ibrahima', lastName: 'Parrain' });
    refundAdmin = await newAdmin('double-remb', ['refunds.manage']);
    plainAdmin = await newAdmin('double-sans', []);
});

after(async () => {
    setFakeMode('cashoutMode', 'success');
    fakePay().balance = 10_000_000;
    // Comme notif-admin : les admins de la suite ne reçoivent plus les alertes des suites suivantes
    const { error } = await service.from('users').update({ status: 'SUSPENDU' }).in('id', [refundAdmin.userId, plainAdmin.userId]);
    assert.equal(error, null, `admins de la suite suspendus : ${error?.message}`);
    await assertRecetteInvariants('double-paiement');
});

// ── Montage ────────────────────────────────────────────────────────────────

interface Scene { buyer: Buyer; ev: SaleEvent; title: string }

/** Acheteur neuf, filleul de `sponsor` si demandé (grille 5/2), et événement neuf : le stock se compte exactement. */
async function scene(label: string, opts: { sponsored?: boolean } = {}): Promise<Scene> {
    const buyer = await newBuyer(`double-${label}`, { firstName: 'Khady', lastName: 'Acheteuse' });
    if (opts.sponsored) {
        const { error } = await service.from('referral_relationships').insert({
            sponsor_id: sponsor.userId, referred_id: buyer.userId, referral_type: 'CLIENT_TO_CLIENT', sponsor_status_at_creation: 'STANDARD',
            rate_n1_at_creation: 5, rate_n2_at_creation: 2, duration_months: 12,
            expires_at: new Date(Date.now() + 365 * 24 * 3600_000).toISOString(), is_active: true,
        });
        assert.equal(error, null, `relation de parrainage : ${error?.message}`);
    }
    const ev = await createPartnerEvent(partner.partnerId, `double ${label}`, [{ name: 'VIP', price: VIP_PRICE, total: 10, maxPerOrder: 5 }]);
    const { data, error } = await service.from('events').select('title').eq('id', ev.eventId).single();
    assert.equal(error, null, `événement ${ev.eventId} : ${error?.message}`);
    return { buyer, ev, title: String(data.title) };
}

async function pendingPayment(s: Scene, items: Items): Promise<PaymentRow> {
    const r = await checkout(s.buyer, cart(s.ev.eventId, items.map(([name, q]) => [s.ev.categories[name].id, q]), s.buyer));
    assert.equal(r.status, 200, `checkout de préparation : HTTP ${r.status} ${JSON.stringify(r.body)}`);
    assert.ok(r.payment, 'paiement de préparation créé');
    assert.equal(r.payment!.status, 'PENDING', 'paiement de préparation PENDING');
    return r.payment!;
}

async function cancelByClient(s: Scene, payment: PaymentRow): Promise<void> {
    const { POST } = await importModule(CANCEL_ROUTE);
    const res = await POST(jsonRequest(`/api/payments/${payment.id}/cancel`, 'POST', s.buyer.accessToken), routeContext({ transactionId: payment.id }));
    assert.equal(res.status, 200, `annulation par le client : HTTP ${res.status}`);
    assert.equal((await paymentById(payment.id)).status, 'CANCELLED', 'précondition : paiement annulé');
}

/** Paiement dont la garde est échue, comme 16 minutes après sa création : réservation comprise. */
async function expireHold(payment: PaymentRow): Promise<void> {
    const past = new Date(Date.now() - 60_000).toISOString();
    const { error } = await service.from('payments').update({ held_expires_at: past }).eq('id', payment.id);
    assert.equal(error, null, `échéance du paiement : ${error?.message}`);
    const { error: rErr } = await service.from('stock_reservations').update({ expires_at: past }).eq('payment_id', payment.id).eq('status', 'ACTIVE');
    assert.equal(rErr, null, `échéance de la réservation : ${rErr?.message}`);
}

/** Le client a validé l'invite : succès chez SamirPay, webhook authentique. */
async function lateSuccess(payment: PaymentRow): Promise<void> {
    providerSays(payment, 'SUCCESS');
    const hook = await deliverWebhook(payment);
    assert.equal(hook.status, 200, `webhook du paiement ${payment.id} : HTTP ${hook.status}`);
}

/** Lot large : les lignes laissées par d'autres suites n'écartent jamais le paiement du cas (L33, section 6.1). */
async function runCron(): Promise<Row> {
    const { GET } = await importModule(RECONCILE_ROUTE);
    return withEnv({ PAYMENT_RECONCILE_BATCH: '1000' }, async () => {
        const res = await GET(cronRequest('/api/cron/payments-reconcile'));
        const body = (await res.json()) as Row;
        assert.equal(res.status, 200, `cron payments-reconcile : ${JSON.stringify(body)}`);
        return body;
    });
}

async function cashoutsOf(paymentId: string): Promise<Row[]> {
    const { data, error } = await service.from('cashouts').select('*').eq('payment_id', paymentId).order('created_at');
    assert.equal(error, null, `cashouts du paiement ${paymentId} : ${error?.message}`);
    return (data ?? []) as Row[];
}

async function refundsOf(paymentId: string): Promise<Row[]> {
    const { data, error } = await service.from('refunds').select('*').eq('payment_id', paymentId);
    assert.equal(error, null, `remboursements du paiement ${paymentId} : ${error?.message}`);
    return (data ?? []) as Row[];
}

async function commissionsOf(paymentId: string): Promise<Row[]> {
    const { data, error } = await service.from('referral_commissions').select('*').eq('payment_id', paymentId);
    assert.equal(error, null, `commissions du paiement ${paymentId} : ${error?.message}`);
    return (data ?? []) as Row[];
}

async function salesOf(paymentIds: string[]): Promise<string[]> {
    const keys = paymentIds.map((id) => `VENTE-${id}`);
    const { data, error } = await service.from('finance_ledger').select('source_key').in('source_key', keys);
    assert.equal(error, null, `grand livre : ${error?.message}`);
    return (data ?? []).map((r) => String(r.source_key)).sort();
}

const ticketsOf = async (s: Scene, paymentId: string): Promise<Row[]> => (await eventTickets(s.ev.eventId)).filter((t) => t.payment_id === paymentId);

/** Envois d'argent demandés au faux SamirPay pour ce client (numéro neuf : jamais compté globalement). */
const cashoutCalls = (s: Scene): Array<{ args: Row }> => callsOf('sendCashout').filter((c) => c.args.phoneNumber === s.buyer.phone9);

// ── Assertions communes ────────────────────────────────────────────────────

/** Un seul REFUND_PAID pour ce client, quatre canaux, et le texte exact du SMS, compté sur son numéro neuf. */
async function assertRefundPaid(s: Scene, cashoutId: string, amountText: string): Promise<void> {
    const key = `REFUND_PAID:${cashoutId}`;
    const rows = await outboxRows({ type: 'REFUND_PAID', keyPrefix: `${key}:` });
    assert.deepEqual(rows.map((r) => r.channel).sort(), ['EMAIL', 'IN_APP', 'PUSH', 'SMS'], `REFUND_PAID : canaux ${JSON.stringify(rows.map((r) => r.channel))}`);
    assert.ok(rows.every((r) => r.group_key === key && r.recipient_user_id === s.buyer.userId), `REFUND_PAID adressé au client : ${JSON.stringify(rows.map((r) => [r.group_key, r.recipient_user_id]))}`);
    const all = await outboxRows({ type: 'REFUND_PAID', userId: s.buyer.userId });
    assert.equal(all.length, rows.length, `un seul avis REFUND_PAID pour ce client : ${JSON.stringify(all.map((r) => r.idempotency_key))}`);
    const mark = smsMark(s.buyer.phoneE164);
    await flushNotifications({ ids: rows.map((r) => r.id) });
    assert.deepEqual(smsTo(s.buyer.phoneE164, mark).map((m) => m.message),
        [`Event Village : remboursement de ${amountText} versé sur votre compte Wave (${smsVar(s.title, 30)}).`], 'SMS de remboursement, texte exact, envoyé une fois');
}

/** Une alerte par admin qui a refunds.manage (type ADMIN_DUPLICATE_PAYMENT, L32), aucune sans la permission. */
async function assertDuplicateAlert(duplicate: PaymentRow, keptId: string): Promise<void> {
    const base = `ADMIN_DUPLICATE_PAYMENT:${duplicate.id}:`;
    const rows = await outboxRows({ type: 'ADMIN_DUPLICATE_PAYMENT', keyPrefix: base });
    const mine = rows.filter((r) => r.recipient_user_id === refundAdmin.userId);
    assert.deepEqual(mine.map((r) => r.channel).sort(), ['EMAIL', 'IN_APP', 'PUSH'], `alerte de l'admin refunds.manage : ${JSON.stringify(rows.map((r) => r.idempotency_key))}`);
    for (const r of mine) {
        assert.equal(r.idempotency_key, `${base}${refundAdmin.userId}:${r.channel}`, `clé de l'alerte ${r.channel}`);
        assert.equal(r.event_id, duplicate.event_id, `alerte ${r.channel} rattachée à l'événement`);
        assert.deepEqual(
            { payment_id: r.template_data.payment_id, duplicate_of: r.template_data.duplicate_of, amount: Number(r.template_data.amount) },
            { payment_id: duplicate.id, duplicate_of: keptId, amount: Number(duplicate.amount) }, `données de l'alerte ${r.channel}`);
    }
    assert.ok(!rows.some((r) => r.recipient_user_id === plainAdmin.userId), 'aucune alerte à un admin sans refunds.manage');
    assert.equal(new Set(rows.map((r) => r.idempotency_key)).size, rows.length, 'une seule alerte par admin et par canal');
}

/** Aucune ligne de l'invariant (s) ne cite ces paiements. */
async function assertInvariantS(ids: string[]): Promise<void> {
    const rows = (await recetteViolations()).filter((v) => v.regle === 's' && ids.some((id) => v.objet.includes(id)));
    assert.deepEqual(rows, [], 'invariant (s) sur ces paiements');
}

/** État final d'un double paiement remboursé : le contrat 6.1 cas 1, partagé par les cas 2 et 3. */
async function assertDuplicateRefunded(s: Scene, duplicateId: string, keptId: string, quantity: number, source: string): Promise<void> {
    const dup = await paymentRow(duplicateId);
    assert.equal(dup.status, 'REFUNDED', `paiement en double ${duplicateId} : statut ${String(dup.status)}, remboursement attendu ; ${(await ticketsOf(s, duplicateId)).length} billet(s) émis en second jeu`);
    assert.equal(dup.confirmed_source, source, 'source de la confirmation');
    assert.ok(dup.paid_at, 'date de réception des fonds');
    const metadata = dup.metadata as Row;
    assert.equal(metadata.duplicate_of, keptId, `metadata.duplicate_of : ${JSON.stringify(metadata)}`);
    assert.equal(metadata.refund_reason, `paiement en double du panier déjà réglé (${keptId})`, `metadata.refund_reason : ${JSON.stringify(metadata)}`);
    assert.equal(Number(dup.refunded_amount), Number(dup.amount), 'montant remboursé = total du paiement');

    assert.equal((await ticketsOf(s, duplicateId)).length, 0, 'aucun billet sur le paiement remboursé');
    const kept = await ticketsOf(s, keptId);
    assert.equal(kept.length, quantity, 'le paiement conservé garde ses billets');
    assert.ok(kept.every((t) => t.status === 'VALIDE'), `billets conservés valides : ${JSON.stringify(kept.map((t) => t.status))}`);
    assert.equal((await paymentRow(keptId)).status, 'SUCCESS', 'paiement conservé SUCCESS');
    const stock = await categoryState(s.ev.categories.VIP.id);
    assert.deepEqual([stock.sold, stock.held], [quantity, 0], `stock : un seul jeu vendu, rien de réservé (${JSON.stringify(stock)})`);

    const cashouts = await cashoutsOf(duplicateId);
    assert.equal(cashouts.length, 1, `un seul cashout : ${JSON.stringify(cashouts.map((c) => [c.kind, c.status]))}`);
    assert.deepEqual(
        { kind: cashouts[0].kind, key: cashouts[0].idempotency_key, amount: Number(cashouts[0].amount), status: cashouts[0].status },
        { kind: 'REFUND', key: `REFUND-${duplicateId}`, amount: Number(dup.amount), status: 'CONFIRME' }, 'cashout du remboursement');
    assert.deepEqual(cashoutCalls(s).map((c) => Number(c.args.amount)), [Number(dup.amount)], 'un seul envoi chez SamirPay, du total du paiement');
    const refunds = await refundsOf(duplicateId);
    assert.equal(refunds.length, 1, 'un seul remboursement');
    assert.deepEqual(
        { reason: refunds[0].reason, settlement: refunds[0].settlement, status: refunds[0].status, bearer: refunds[0].aggregator_fee_bearer },
        { reason: 'Paiement en double du même panier', settlement: 'PLATEFORME', status: 'PROCESSED', bearer: 'EVENT_VILLAGE' }, 'remboursement (L31)');

    assert.deepEqual(await salesOf([duplicateId, keptId]), [`VENTE-${keptId}`], 'une seule VENTE au grand livre, celle du paiement conservé');
    assert.deepEqual(await commissionsOf(duplicateId), [], 'aucune commission sur le paiement remboursé');
    await assertDuplicateAlert(await paymentById(duplicateId), keptId);
    await assertInvariantS([duplicateId, keptId]);
}

function assertKeptCommission(rows: Row[]): void {
    assert.deepEqual(rows.map((c) => [c.generation, c.sponsor_id, Math.round(Number(c.amount) * 100)]), [['N1', sponsor.userId, TWO_VIP_N1_CENTS]],
        'commission du seul paiement conservé');
}

// ── Remboursement du second paiement ───────────────────────────────────────

describe('8.2 a — le second paiement réussi d’un même panier est remboursé', () => {
    test('1. A annulé, B confirmé, succès tardif de A par webhook : A remboursé, un seul jeu, un REFUND_PAID, une alerte par admin', async () => {
        const s = await scene('webhook', { sponsored: true });
        const first = await pendingPayment(s, [['VIP', 2]]);
        await cancelByClient(s, first);
        const kept = await buyConfirmed(s.buyer, s.ev, [['VIP', 2]]);
        await lateSuccess(first);

        await assertDuplicateRefunded(s, first.id, kept.payment.id, 2, 'WEBHOOK');
        assertKeptCommission(await commissionsOf(kept.payment.id));
        await assertRefundPaid(s, String((await cashoutsOf(first.id))[0].id), '2 100 F CFA');
    });

    test('2. même chose par le cron : A EXPIRED, rattrapage tardif (RECONCILIATION), A remboursé', async () => {
        const s = await scene('cron', { sponsored: true });
        const first = await pendingPayment(s, [['VIP', 2]]);
        const { data, error } = await service.rpc('payment_release', { p_payment_id: first.id, p_status: 'EXPIRED', p_reason: 'PENDING_TOO_OLD' });
        assert.equal(error, null, `expiration : ${error?.message}`);
        assert.equal((data as Row | null)?.changed, true, `précondition : A EXPIRED (${JSON.stringify(data)})`);
        const kept = await buyConfirmed(s.buyer, s.ev, [['VIP', 2]]);
        providerSays(first, 'SUCCESS');
        const body = await runCron();

        await assertDuplicateRefunded(s, first.id, kept.payment.id, 2, 'RECONCILIATION');
        assert.ok(Number(body.late_refund_required) >= 1, `compteur du cron : ${JSON.stringify(body)}`);
        assertKeptCommission(await commissionsOf(kept.payment.id));
    });

    test('3. ordre inverse : A PENDING échu confirmé d’abord, B ensuite : B, second confirmé, est remboursé', async () => {
        const s = await scene('inverse', { sponsored: true });
        const first = await pendingPayment(s, [['VIP', 2]]);
        await expireHold(first);
        const second = await pendingPayment(s, [['VIP', 2]]);
        assert.notEqual(second.id, first.id, 'précondition : deux paiements');
        await lateSuccess(first);
        assert.equal((await paymentById(first.id)).status, 'SUCCESS', 'précondition : A confirmé en premier');
        await lateSuccess(second);

        await assertDuplicateRefunded(s, second.id, first.id, 2, 'WEBHOOK');
        assertKeptCommission(await commissionsOf(first.id));
    });

    test('4. rejeu du webhook : REFUND_IN_PROGRESS, pas de second cashout, pas de second envoi', async () => {
        const s = await scene('rejeu');
        const first = await pendingPayment(s, [['VIP', 1]]);
        await cancelByClient(s, first);
        const kept = await buyConfirmed(s.buyer, s.ev, [['VIP', 1]]);
        await lateSuccess(first);
        await assertDuplicateRefunded(s, first.id, kept.payment.id, 1, 'WEBHOOK');

        const hook = await deliverWebhook(first);
        assert.equal(hook.status, 200, 'webhook rejoué accepté');
        const { data: events, error } = await service.from('payment_webhook_events').select('result, receive_count').eq('payment_id', first.id);
        assert.equal(error, null, `webhooks : ${error?.message}`);
        assert.deepEqual((events ?? []).map((e) => [e.result, Number(e.receive_count)]), [['REFUND_IN_PROGRESS', 2]], 'rejeu enregistré sur la même ligne');
        const replay = await service.rpc('payment_confirm', { p_payment_id: first.id, p_source: 'TEST' });
        assert.equal(replay.error, null, `payment_confirm : ${replay.error?.message}`);
        assert.deepEqual(replay.data, { result: 'REFUND_IN_PROGRESS', status: 'REFUNDED' }, 'rejeu direct de la RPC');
        assert.equal((await cashoutsOf(first.id)).length, 1, 'pas de second cashout');
        assert.equal(cashoutCalls(s).length, 1, 'pas de second envoi chez SamirPay');
    });

    test('8. concurrence : deux payment_confirm sur deux connexions, le second attend le premier : un seul jeu', async () => {
        const s = await scene('concurrence');
        const first = await pendingPayment(s, [['VIP', 2]]);
        await expireHold(first);
        const second = await pendingPayment(s, [['VIP', 2]]);
        const a = await openConcurrentClient({ applicationName: 'ev-test-double-a' });
        const b = await openConcurrentClient({ applicationName: 'ev-test-double-b' });
        let bResult: Row;
        try {
            const aRes = await a.query<{ r: Row }>(CONFIRM_SQL, [first.id, 'TEST']);
            assert.equal(aRes.rows[0].r.result, 'CONFIRMED', `A : ${JSON.stringify(aRes.rows[0].r)}`);
            const bPending = b.query<{ r: Row }>(CONFIRM_SQL, [second.id, 'TEST']);
            await waitForLockWaiters([b.pid]);
            await a.commit();
            bResult = (await bPending).rows[0].r;
            await b.commit();
        } finally {
            await closeAll(a, b);
        }
        assert.equal(bResult.result, 'REFUND_REQUIRED', `B, confirmé en second : ${JSON.stringify(bResult)}`);
        assert.equal(bResult.duplicate_of, first.id, `B désigne le paiement conservé : ${JSON.stringify(bResult)}`);
        assert.equal(typeof bResult.cashout_id, 'string', `cashout créé : ${JSON.stringify(bResult)}`);
        assert.equal((await CashoutService.send(String(bResult.cashout_id))).status, 'CONFIRME', 'envoi du remboursement');

        await assertDuplicateRefunded(s, second.id, first.id, 2, 'TEST');
    });
});

// ── Échecs d'envoi ─────────────────────────────────────────────────────────

/** Remplace getSolde du faux par une panne brève le temps de fn (rétabli dans un finally). */
async function withBalanceUnavailable<T>(fn: () => Promise<T>): Promise<T> {
    const fake = fakePay();
    const original = fake.getSolde;
    fake.getSolde = async () => {
        fake.calls.push({ method: 'getSolde', args: { simulated: 'UNAVAILABLE' }, at: new Date().toISOString() });
        throw new SamirPayError('UNCERTAIN', 'Solde SamirPay indisponible (simulation du test)');
    };
    try {
        return await fn();
    } finally {
        fake.getSolde = original;
    }
}

describe('8.2 a — remboursement du double paiement qui n’aboutit pas du premier coup', () => {
    test('9. refus de l’opérateur : ADMIN_REFUND_TO_RETRY à l’admin, la relance par la route aboutit', async () => {
        const s = await scene('refus');
        const first = await pendingPayment(s, [['VIP', 2]]);
        await cancelByClient(s, first);
        const kept = await buyConfirmed(s.buyer, s.ev, [['VIP', 2]]);
        setFakeMode('cashoutMode', 'rejected');
        try {
            await lateSuccess(first);
        } finally {
            setFakeMode('cashoutMode', 'success');
        }

        assert.equal((await paymentRow(first.id)).status, 'REFUND_PENDING', 'paiement en double en attente de remboursement');
        const [refused] = await cashoutsOf(first.id);
        assert.ok(refused, 'cashout du remboursement créé');
        assert.deepEqual({ kind: refused.kind, status: refused.status }, { kind: 'REFUND', status: 'ECHOUE' }, 'refus enregistré');
        const base = `ADMIN_REFUND_TO_RETRY:${refused.id}:${Number(refused.attempt_count)}:ECHOUE:`;
        const alerts = await outboxRows({ type: 'ADMIN_REFUND_TO_RETRY', keyPrefix: base, userId: refundAdmin.userId });
        assert.deepEqual(alerts.map((r) => r.channel).sort(), ['EMAIL', 'IN_APP', 'PUSH'], `alerte de relance : ${JSON.stringify(alerts.map((r) => r.idempotency_key))}`);

        const { POST } = await importModule(RETRY_ROUTE);
        const refundId = String(refused.refund_id);
        const res = await POST(jsonRequest(`/api/admin/refunds/${refundId}/retry`, 'POST', refundAdmin.accessToken), { params: { id: refundId } });
        const body = (await res.json()) as Row;
        assert.equal(res.status, 200, `relance : ${JSON.stringify(body)}`);
        assert.deepEqual({ success: body.success, status: body.status }, { success: true, status: 'PROCESSED' }, `relance : ${JSON.stringify(body)}`);

        const paid = await paymentRow(first.id);
        assert.equal(paid.status, 'REFUNDED', 'paiement remboursé après la relance');
        assert.equal(Number(paid.refunded_amount), Number(first.amount), 'montant remboursé');
        const cashouts = await cashoutsOf(first.id);
        assert.deepEqual(cashouts.map((c) => [c.id, c.status]), [[refused.id, 'CONFIRME']], 'même cashout, confirmé');
        assert.equal((await ticketsOf(s, first.id)).length, 0, 'aucun billet sur le paiement remboursé');
        assert.equal((await ticketsOf(s, kept.payment.id)).length, 2, 'le paiement conservé garde ses billets');
        await assertRefundPaid(s, String(refused.id), '2 100 F CFA');
        await assertInvariantS([first.id, kept.payment.id]);
    });

    test('10. getSolde indisponible au premier envoi : A_ENVOYER, rien avant 5 minutes, puis le cron verse une seule fois', async () => {
        const s = await scene('solde');
        const first = await pendingPayment(s, [['VIP', 1]]);
        await cancelByClient(s, first);
        const kept = await buyConfirmed(s.buyer, s.ev, [['VIP', 1]]);
        await withBalanceUnavailable(() => lateSuccess(first));

        const [waiting] = await cashoutsOf(first.id);
        assert.ok(waiting, `cashout du remboursement créé (paiement ${(await paymentRow(first.id)).status})`);
        assert.deepEqual(
            { status: waiting.status, blocked: waiting.blocked_reason, started: waiting.send_started_at },
            { status: 'A_ENVOYER', blocked: null, started: null }, 'envoi différé, ni bloqué ni réservé');
        assert.equal(cashoutCalls(s).length, 0, 'rien n’est parti');

        await runCron();
        assert.equal((await cashoutsOf(first.id))[0].status, 'A_ENVOYER', 'moins de 5 minutes : le cron ne reprend pas encore');
        assert.equal(cashoutCalls(s).length, 0, 'moins de 5 minutes : rien n’est parti');

        const { error } = await service.from('cashouts').update({ created_at: new Date(Date.now() - 6 * 60_000).toISOString() }).eq('id', waiting.id);
        assert.equal(error, null, `created_at reculé : ${error?.message}`);
        const body = await runCron();
        assert.ok(Number(body.refunds_resumed) >= 1, `compteur refunds_resumed du cron (L33) : ${JSON.stringify(body)}`);

        const cashouts = await cashoutsOf(first.id);
        assert.deepEqual(cashouts.map((c) => [c.id, c.status]), [[waiting.id, 'CONFIRME']], 'même cashout, versé');
        assert.equal((await paymentRow(first.id)).status, 'REFUNDED', 'paiement remboursé');
        await runCron();
        assert.deepEqual(cashoutCalls(s).map((c) => Number(c.args.amount)), [Number(first.amount)], 'un seul envoi, même après un autre passage');
        assert.equal((await ticketsOf(s, kept.payment.id)).length, 1, 'le paiement conservé garde son billet');
    });
});

// ── Témoins ────────────────────────────────────────────────────────────────

/** Deux paiements conservés : aucun remboursement, aucune marque de double, deux jeux émis. */
async function assertBothKept(s: Scene, ids: string[], tickets: number): Promise<void> {
    for (const id of ids) {
        const p = await paymentRow(id);
        assert.equal(p.status, 'SUCCESS', `paiement ${id} conservé`);
        assert.ok(!('duplicate_of' in (p.metadata as Row)), `paiement ${id} non marqué en double : ${JSON.stringify(p.metadata)}`);
        assert.deepEqual(await cashoutsOf(id), [], `paiement ${id} : aucun cashout`);
    }
    assert.equal(cashoutCalls(s).length, 0, 'aucun envoi d’argent');
    assert.equal((await eventTickets(s.ev.eventId)).length, tickets, 'tous les billets émis');
    assert.equal((await categoryState(s.ev.categories.VIP.id)).sold, tickets, 'stock vendu = billets émis');
}

describe('8.2 a — témoins : ce qui n’est pas un double paiement n’est jamais remboursé (L30)', () => {
    test('5. rachat séquentiel identique, après la confirmation du premier : deux jeux, aucun remboursement', async () => {
        const s = await scene('rachat');
        const one = await buyConfirmed(s.buyer, s.ev, [['VIP', 2]]);
        const two = await buyConfirmed(s.buyer, s.ev, [['VIP', 2]]);
        await assertBothKept(s, [one.payment.id, two.payment.id], 4);
    });

    test('6. panier différent (1 VIP annulé puis 2 VIP) : le succès tardif garde les deux jeux', async () => {
        const s = await scene('panier');
        const first = await pendingPayment(s, [['VIP', 1]]);
        await cancelByClient(s, first);
        const kept = await buyConfirmed(s.buyer, s.ev, [['VIP', 2]]);
        await lateSuccess(first);
        await assertBothKept(s, [first.id, kept.payment.id], 3);
    });

    test('7. Y entièrement remboursé : X émet ses billets', async () => {
        const s = await scene('rembourse');
        const first = await pendingPayment(s, [['VIP', 1]]);
        await cancelByClient(s, first);
        const refunded = await buyConfirmed(s.buyer, s.ev, [['VIP', 1]]);
        const out = await CashoutService.requestTicketRefund({ ticketId: String(refunded.tickets[0].id), actorId: partner.userId, reason: 'Remboursement demandé (témoin double paiement)' });
        assert.equal(out.ok, true, `remboursement de Y : ${JSON.stringify(out)}`);
        assert.ok(out.cashout, 'cashout de Y');
        assert.equal((await CashoutService.send(out.cashout!.id)).status, 'CONFIRME', 'envoi de Y');
        assert.equal((await paymentRow(refunded.payment.id)).status, 'REFUNDED', 'précondition : Y entièrement remboursé');

        await lateSuccess(first);
        const p = await paymentRow(first.id);
        assert.equal(p.status, 'SUCCESS', `X : ${String(p.status)}`);
        assert.ok(!('duplicate_of' in (p.metadata as Row)), `X non marqué en double : ${JSON.stringify(p.metadata)}`);
        assert.deepEqual(await cashoutsOf(first.id), [], 'X : aucun cashout');
        const tickets = await ticketsOf(s, first.id);
        assert.deepEqual(tickets.map((t) => t.status), ['VALIDE'], 'X émet son billet');
    });
});

async function closeAll(...clients: ConcurrentClient[]): Promise<void> {
    for (const c of clients) await c.close();
}
