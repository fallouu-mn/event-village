/**
 * Lot 9 bis, tâche 1 — versements bloqués (R1, R9, R10, R52), second refus sans alerte (R105) et retrait d'un
 * bénéficiaire suspendu (B19). Contrat : lot9bis-design 5.1, 4.1 (routes), B1 à B11, B19, X1, X18 ; découverte
 * 9bis/discovery-9bis-versements.md section 2. Faux SamirPay de tests/fakes, envois comptés par numéro neuf.
 *  R1-a  annulation par la partenaire, solde illisible au lot, created_at reculé de 6 min, cron : les
 *        EVENT_CANCELLATION_REFUND sont versés (clé cashouts_resumed) ;
 *  R1-b  même reprise pour un TICKET_REFUND et un WITHDRAWAL ;
 *  R1-c  à envoyer depuis plus de 30 min, solde toujours illisible : listé EN_ATTENTE, ADMIN_CASHOUT_TO_RESUME
 *        aux admins refunds.manage seulement, REFUND_DELAYED au client (texte exact, un seul), refundDelayed
 *        dans /api/payments/[id]/status et /api/tickets ;
 *  R10   retrait, solde 0 : bloqué SOLDE_INSUFFISANT, ADMIN_CASHOUT_TO_RESUME, WITHDRAWAL_DELAYED (texte exact),
 *        listé BLOQUE ;
 *  R52   trois remboursements de 5 250 F, solde de 11 000 F : deux versés, un bloqué, un seul audit
 *        CASHOUT_BATCH_PARTIAL ; solde rétabli, le cron verse le troisième ;
 *  R9-a  retrait à l'issue incertaine : listé INCERTAIN, can_resend false, can_mark_paid vrai ;
 *  R9-b  remboursement bloqué OPERATOR_UNKNOWN, « Marquer versé » avec la référence : CONFIRME, refund
 *        PROCESSED, billet REMBOURSE, REFUND_PAID, audit CASHOUT_MARKED_PAID, aucun envoi ; second appel 409 ;
 *  R9-c  INCERTAIN avec identifiant : FAILED chez SamirPay → « Marquer versé » refusé (PROVIDER_SAYS_FAILED),
 *        « Renvoyer » envoie une fois ; PENDING → 409 PROVIDER_PENDING ; sans identifiant → 409 NOT_RESENDABLE ;
 *  R9-d  sans refunds.manage 403, justification absente ou courte 400 REASON_REQUIRED, référence absente 400
 *        REFERENCE_REQUIRED, aucun effet ;
 *  R105  refus, « Renvoyer », nouveau refus : seconde alerte ADMIN_REFUND_TO_RETRY (tentative 2) ;
 *  B19   retrait d'un compte SUSPENDU : rien ne part (ACCOUNT_SUSPENDED), versé après la réactivation.
 *
 * Rouge aujourd'hui (rien n'est corrigé) :
 *  - R1-a, R1-b : resumeUnsentRefunds ne reprend que kind = 'REFUND' (lib/payments/cashout.service.ts:311) ;
 *  - R1-c, R9-a : la liste exige un motif et les remboursements seuls (app/api/admin/refunds/route.ts:9-10) ;
 *    aucun avis de retard ni ADMIN_CASHOUT_TO_RESUME (types absents du registre) ;
 *  - R10 : notif_cashouts_notify n'alerte que pour un remboursement bloqué (20261103000006:382) ;
 *  - R52 : sendBatch bloque tout le lot dès que le solde ne couvre pas le total (cashout.service.ts:285-297) ;
 *  - R9-b, R9-c, R9-d, R105 : routes app/api/admin/cashouts/[id]/{resend,mark-paid} absentes (import dynamique) ;
 *  - B19 : CashoutService.send ne lit pas le statut du bénéficiaire, le retrait part.
 * R1-d (requête interrompue en plein lot) n'est pas écrit : l'état laissé est celui de R1-a (A_ENVOYER sans
 * réservation, cashout.service.ts:225-234), dit au rapport. after() : assertLot9bisInvariants (garde de schéma
 * rouge jusqu'aux migrations du lot). Les admins de la suite sont suspendus en fin de suite.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { smsAmount, smsVar } from '../../lib/notifications/sms-format';
import { CashoutService } from '../../lib/payments/cashout.service';
import { SamirPayError } from '../../lib/samirpay/types';
import { assertLot9bisInvariants } from '../helpers/lot9bis-invariants';
import { authed, ticketRow, type RouteResult } from './acces-helpers';
import { buyConfirmed, createPartnerEvent, jsonRequest, newPartner, withSettings, type TestPartner } from './finance-helpers';
import { callsOf, cronRequest, fakePay, importModule, newBuyer, pollStatus, service, setFakeMode, type Buyer, type SaleEvent } from './paiement-helpers';
import { flushNotifications, outboxRows, smsMark, smsTo, withEnv, type OutboxRow, type TestAdmin } from './notif-helpers';
import { newAdminWith } from './terrain-helpers';

type Row = Record<string, unknown>;
type Handler = (req: NextRequest, ctx?: unknown) => Promise<Response>;

const FULL_BALANCE = 10_000_000;
const PRICE = 5_000;
const RECONCILE_ROUTE = '../../app/api/cron/payments-reconcile/route';
const LIST_ROUTE = '../../app/api/admin/refunds/route';
const CANCEL_ROUTE = '../../app/api/partner/events/[id]/cancel/route';
const TICKETS_ROUTE = '../../app/api/tickets/route';
const DECISION_ROUTES = {
    resend: '../../app/api/admin/cashouts/[id]/resend/route',
    'mark-paid': '../../app/api/admin/cashouts/[id]/mark-paid/route',
} as const;
const REASON = 'Vérifié avec le support SamirPay (test du lot 9 bis)';
/** Référence SamirPay au format du contrat 4.1 (^TX[A-Za-z0-9]{8}$). */
const REFERENCE = 'TXAB12CD34';
/** Code technique en capitales, jamais affiché (Conventions, Textes). */
const RAW_CODE = /\b[A-Z]{2,}(?:_[A-Z]+)+\b/;
/** Champs d'une ligne de « Versements à reprendre » (contrat 4.1). */
const ITEM_KEYS = ['advice', 'amount', 'beneficiary', 'block_label', 'can_mark_not_sent', 'can_mark_paid', 'can_resend', 'event_title', 'id', 'kind', 'kind_label', 'since', 'state', 'state_label'];
const WITHDRAWAL_RULES = { 'finance.withdrawal_fee_rate': 1, 'finance.withdrawal_min_amount': 5000, 'finance.withdrawal_bank_enabled': false } as const;

let admin: TestAdmin;
let plainAdmin: TestAdmin;

before(async () => {
    setFakeMode('cashoutMode', 'success');
    fakePay().balance = FULL_BALANCE;
    admin = await newAdminWith(['refunds.manage'], { label: 'v9b-reprise' });
    plainAdmin = await newAdminWith(['payments.read'], { label: 'v9b-reprise-sans' });
});

after(async () => {
    setFakeMode('cashoutMode', 'success');
    fakePay().balance = FULL_BALANCE;
    const { error } = await service.from('users').update({ status: 'SUSPENDU' }).in('id', [admin.userId, plainAdmin.userId]).eq('status', 'ACTIF');
    assert.equal(error, null, `admins de la suite suspendus : ${error?.message}`);
    await assertLot9bisInvariants('versements-reprise');
});

// ── Outils ─────────────────────────────────────────────────────────────────

function show(r: RouteResult): string {
    return `HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 500)}`;
}

/** Contexte de route valable que le gestionnaire lise `params.id` ou `await params`. */
function idContext(id: string): { params: Promise<{ id: string }> & { id: string } } {
    return { params: Object.assign(Promise.resolve({ id }), { id }) };
}

async function asResult(res: Response): Promise<RouteResult> {
    const text = await res.text();
    let body: Row = {};
    try {
        body = text ? JSON.parse(text) as Row : {};
    } catch (err) {
        body = { raw: text.slice(0, 2000), parseError: (err as Error).message };
    }
    return { status: res.status, body };
}

/** Remplace getSolde du faux par une panne le temps de fn (patron de double-paiement.test.ts:351-362). */
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

async function withCashoutMode<T>(mode: string, fn: () => Promise<T>): Promise<T> {
    setFakeMode('cashoutMode', mode);
    try {
        return await fn();
    } finally {
        setFakeMode('cashoutMode', 'success');
    }
}

/** Passage du cron de réconciliation, lot large (les lignes des autres suites n'écartent pas celles du cas). */
async function runCron(): Promise<Row> {
    const { GET } = await importModule(RECONCILE_ROUTE);
    return withEnv({ PAYMENT_RECONCILE_BATCH: '1000' }, async () => {
        const res = await GET(cronRequest('/api/cron/payments-reconcile'));
        const body = (await res.json()) as Row;
        assert.equal(res.status, 200, `cron payments-reconcile : ${JSON.stringify(body)}`);
        return body;
    });
}

async function cashoutRow(id: string): Promise<Row> {
    const { data, error } = await service.from('cashouts').select('*').eq('id', id).single();
    assert.equal(error, null, `cashout ${id} : ${error?.message}`);
    return data as Row;
}

async function cashoutsOfPayment(paymentId: string): Promise<Row[]> {
    const { data, error } = await service.from('cashouts').select('*').eq('payment_id', paymentId).order('created_at');
    assert.equal(error, null, `cashouts du paiement ${paymentId} : ${error?.message}`);
    return (data ?? []) as Row[];
}

/** Création reculée de `minutes` (le contrat fixe 5 min pour la reprise et 30 min pour le retard). */
async function ageCashout(id: string, minutes: number): Promise<void> {
    const { error } = await service.from('cashouts').update({ created_at: new Date(Date.now() - minutes * 60_000).toISOString() }).eq('id', id);
    assert.equal(error, null, `created_at du cashout ${id} reculé : ${error?.message}`);
}

/** Envois demandés au faux SamirPay vers ce numéro (9 chiffres) : jamais comptés globalement. */
function sendsTo(phone9: string): number {
    return callsOf('sendCashout').filter((c) => c.args.phoneNumber === phone9).length;
}

async function auditsOf(action: string, cashoutId: string): Promise<Row[]> {
    const { data, error } = await service.from('audit_logs').select('*').eq('action', action).eq('object_id', cashoutId).order('created_at');
    assert.equal(error, null, `journal ${action} : ${error?.message}`);
    return (data ?? []) as Row[];
}

// ── Routes ─────────────────────────────────────────────────────────────────

async function decisionHandler(action: keyof typeof DECISION_ROUTES): Promise<Handler> {
    let mod: { POST?: Handler };
    try {
        mod = await importModule(DECISION_ROUTES[action]);
    } catch (err) {
        assert.fail(`route POST /api/admin/cashouts/[id]/${action} absente : app/api/admin/cashouts/[id]/${action}/route.ts (contrat 4.1, B4, fix(9b.1)) — ${String((err as Error).message).split('\n')[0]}`);
    }
    assert.equal(typeof mod.POST, 'function', `app/api/admin/cashouts/[id]/${action}/route.ts : POST non exporté`);
    return mod.POST!;
}

async function decide(action: keyof typeof DECISION_ROUTES, cashoutId: string, user: Buyer, body: Row): Promise<RouteResult> {
    const handler = await decisionHandler(action);
    return asResult(await handler(authed(`/api/admin/cashouts/${cashoutId}/${action}`, 'POST', user, body), idContext(cashoutId)));
}

async function toResume(user: Buyer = admin): Promise<{ items: Row[]; total: unknown }> {
    const { GET } = await importModule(LIST_ROUTE);
    const r = await asResult(await GET(authed('/api/admin/refunds?state=to_retry', 'GET', user)));
    assert.equal(r.status, 200, `GET /api/admin/refunds?state=to_retry : ${show(r)}`);
    assert.ok(Array.isArray(r.body.items), `items : ${show(r)}`);
    return { items: r.body.items as Row[], total: r.body.total };
}

function listed(items: Row[], cashoutId: string, what: string): Row {
    const found = items.find((i) => i.id === cashoutId);
    assert.ok(found, `${what} : cashout ${cashoutId} absent de « Versements à reprendre » (${items.length} ligne(s) ; contrat 4.1, B1)`);
    assert.deepEqual(Object.keys(found).sort(), ITEM_KEYS, `${what} : champs de la ligne (contrat 4.1) ${JSON.stringify(found)}`);
    return found;
}

async function cancelByPartner(owner: TestPartner, eventId: string): Promise<void> {
    const { data: ev, error } = await service.from('events').select('title').eq('id', eventId).single();
    assert.equal(error, null, `titre de l’événement : ${error?.message}`);
    const { POST } = await importModule(CANCEL_ROUTE);
    const res: Response = await POST(
        jsonRequest(`/api/partner/events/${eventId}/cancel`, 'POST', owner.accessToken, {
            internalReason: 'Test lot 9 bis : annulation',
            publicNotice: 'Événement annulé : les acheteurs sont remboursés.',
            confirmTitle: String(ev.title),
        }),
        idContext(eventId),
    );
    assert.equal(res.status, 200, `annulation : HTTP ${res.status} ${JSON.stringify(await res.clone().json().catch(() => ({})))}`);
}

// ── Versements fabriqués par le vrai module ────────────────────────────────

interface Sale { partner: TestPartner; ev: SaleEvent; title: string }

async function sale(label: string): Promise<Sale> {
    const partner = await newPartner(`v9b-${label}`);
    const ev = await createPartnerEvent(partner.partnerId, `v9b ${label}`, [{ name: 'Standard', price: PRICE, total: 20 }]);
    const { data, error } = await service.from('events').select('title').eq('id', ev.eventId).single();
    assert.equal(error, null, `événement : ${error?.message}`);
    return { partner, ev, title: String(data.title) };
}

interface TicketRefund { buyer: Buyer; s: Sale; ticketId: string; paymentId: string; cashoutId: string; refundId: string }

/** Billet payé par un acheteur neuf puis remboursé par la partenaire : TICKET_REFUND A_ENVOYER, pas encore envoyé. */
async function ticketRefund(label: string, opts: { withoutOperator?: boolean } = {}): Promise<TicketRefund> {
    const s = await sale(label);
    const buyer = await newBuyer(`v9b-${label}`);
    const { tickets, payment } = await buyConfirmed(buyer, s.ev, [['Standard', 1]]);
    if (opts.withoutOperator) {
        const { error } = await service.from('payments').update({ operator: null }).eq('id', payment.id);
        assert.equal(error, null, `opérateur effacé : ${error?.message}`);
    }
    const ticketId = String(tickets[0].id);
    const out = await CashoutService.requestTicketRefund({ ticketId, actorId: s.partner.userId, reason: `Lot 9 bis ${label}` });
    assert.equal(out.ok, true, `remboursement refusé : ${JSON.stringify(out)}`);
    const cashout = out.cashout!;
    assert.equal(cashout.status, 'A_ENVOYER', 'précondition : à envoyer');
    const row = await cashoutRow(cashout.id);
    return { buyer, s, ticketId, paymentId: payment.id, cashoutId: cashout.id, refundId: String(row.refund_id) };
}

interface Withdrawal { partner: TestPartner; withdrawalId: string; cashoutId: string; net: number }

/** Partenaire dont une vente est disponible, retrait de 10 000 F demandé par la RPC : WITHDRAWAL A_ENVOYER. */
async function withdrawal(label: string): Promise<Withdrawal> {
    const s = await sale(`ret-${label}`);
    const buyer = await newBuyer(`v9b-ret-${label}`);
    await withSettings({ 'finance.payout_hold_enabled': false }, () => buyConfirmed(buyer, s.ev, [['Standard', 2]]));
    const out = await withSettings(WITHDRAWAL_RULES, async () => {
        const { data, error } = await service.rpc('withdrawal_request', {
            p: { user_id: s.partner.userId, account_kind: 'ORGANISATEUR', gross_amount: 10_000, method: 'MOBILE_MONEY', operator: 'WAVE', phone_number: s.partner.phone9, client_key: randomUUID() },
        });
        assert.equal(error, null, `withdrawal_request : ${error?.message}`);
        return (data ?? {}) as Row;
    });
    assert.equal(out.ok, true, `retrait refusé : ${JSON.stringify(out)}`);
    const row = await cashoutRow(String(out.cashout_id));
    assert.deepEqual({ kind: row.kind, status: row.status }, { kind: 'WITHDRAWAL', status: 'A_ENVOYER' }, 'précondition : retrait à envoyer');
    return { partner: s.partner, withdrawalId: String(out.withdrawal_id), cashoutId: String(out.cashout_id), net: Number(row.amount) };
}

async function withdrawalStatus(id: string): Promise<unknown> {
    const { data, error } = await service.from('withdrawals').select('status').eq('id', id).single();
    assert.equal(error, null, `retrait ${id} : ${error?.message}`);
    return data.status;
}

async function refundStatus(id: string): Promise<unknown> {
    const { data, error } = await service.from('refunds').select('status').eq('id', id).single();
    assert.equal(error, null, `remboursement ${id} : ${error?.message}`);
    return data.status;
}

/** Alertes d'un admin pour ce versement (template_data.cashout_id, comme ADMIN_REFUND_TO_RETRY). */
async function adminAlerts(type: string, who: TestAdmin, cashoutId: string): Promise<OutboxRow[]> {
    return (await outboxRows({ type, userId: who.userId })).filter((r) => r.template_data.cashout_id === cashoutId);
}

/** SMS envoyé pour ces lignes (passage de l'envoyeur limité à elles), compté sur le numéro neuf. */
async function smsOf(rows: OutboxRow[], phoneE164: string): Promise<string[]> {
    const sms = rows.filter((r) => r.channel === 'SMS');
    assert.equal(sms.length, 1, `une ligne SMS : ${JSON.stringify(rows.map((r) => [r.channel, r.idempotency_key]))}`);
    const mark = smsMark(phoneE164);
    await flushNotifications({ ids: sms.map((r) => r.id) });
    return smsTo(phoneE164, mark).map((m) => m.message);
}

// ── 1. Reprise automatique, tous types (R1, B8) ─────────────────────────────

describe('Tâche 1 — reprise automatique de tous les versements restés à envoyer (R1, B8)', () => {
    test('R1-a : remboursements d’une annulation par la partenaire, solde illisible au lot, versés par le cron après 5 minutes', async () => {
        const s = await sale('r1a');
        const buyer = await newBuyer('v9b-r1a');
        const { payment } = await buyConfirmed(buyer, s.ev, [['Standard', 1]]);
        await withBalanceUnavailable(() => cancelByPartner(s.partner, s.ev.eventId));
        const [waiting] = await cashoutsOfPayment(payment.id);
        assert.ok(waiting, 'remboursement de l’annulation créé');
        assert.deepEqual({ kind: waiting.kind, status: waiting.status, blocked: waiting.blocked_reason, started: waiting.send_started_at },
            { kind: 'EVENT_CANCELLATION_REFUND', status: 'A_ENVOYER', blocked: null, started: null }, 'précondition : lot différé, ni bloqué ni réservé');
        assert.equal(sendsTo(buyer.phone9), 0, 'précondition : rien n’est parti');

        await ageCashout(String(waiting.id), 6);
        const body = await runCron();
        const after0 = await cashoutRow(String(waiting.id));
        assert.equal(after0.status, 'CONFIRME', `EVENT_CANCELLATION_REFUND repris par le cron (reprise limitée à kind = 'REFUND' aujourd'hui) : ${after0.status}`);
        assert.deepEqual(callsOf('sendCashout').filter((c) => c.args.phoneNumber === buyer.phone9).map((c) => Number(c.args.amount)), [Number(waiting.amount)], 'un seul envoi, du montant remboursé');
        assert.ok(Number(body.cashouts_resumed) >= 1, `compteur cashouts_resumed du cron (contrat 5.1) : ${JSON.stringify(body)}`);
    });

    test('R1-b : un remboursement de billet (TICKET_REFUND) et un retrait (WITHDRAWAL) restés à envoyer sont repris de même', async () => {
        const refund = await ticketRefund('r1b');
        const w = await withdrawal('r1b');
        await ageCashout(refund.cashoutId, 6);
        await ageCashout(w.cashoutId, 6);
        await runCron();
        assert.equal((await cashoutRow(refund.cashoutId)).status, 'CONFIRME', 'TICKET_REFUND repris');
        assert.equal(sendsTo(refund.buyer.phone9), 1, 'un seul envoi du remboursement');
        assert.equal((await ticketRow(refund.ticketId)).status, 'REMBOURSE', 'billet remboursé');
        assert.equal((await cashoutRow(w.cashoutId)).status, 'CONFIRME', 'WITHDRAWAL repris');
        assert.equal(sendsTo(w.partner.phone9), 1, 'un seul envoi du retrait');
        assert.equal(await withdrawalStatus(w.withdrawalId), 'PAID', 'retrait versé');
    });

    test('R1-c : à envoyer depuis plus de 30 minutes, solde illisible : listé EN_ATTENTE, ADMIN_CASHOUT_TO_RESUME, REFUND_DELAYED (un seul), état honnête', async () => {
        const r = await ticketRefund('r1c');
        await ageCashout(r.cashoutId, 31);
        await withBalanceUnavailable(runCron);
        const row = await cashoutRow(r.cashoutId);
        assert.deepEqual({ status: row.status, blocked: row.blocked_reason }, { status: 'A_ENVOYER', blocked: null }, 'toujours à envoyer, sans motif');
        assert.equal(sendsTo(r.buyer.phone9), 0, 'rien n’est parti');

        const item = listed((await toResume()).items, r.cashoutId, 'en attente depuis plus de 30 minutes');
        assert.deepEqual({ kind: item.kind, state: item.state, can_resend: item.can_resend, can_mark_paid: item.can_mark_paid, amount: Number(item.amount) },
            { kind: 'TICKET_REFUND', state: 'EN_ATTENTE', can_resend: 'NOW', can_mark_paid: true, amount: Number(row.amount) }, `ligne : ${JSON.stringify(item)}`);
        assert.equal(item.event_title, r.s.title, 'titre de l’événement');
        for (const label of [item.kind_label, item.state_label]) assert.doesNotMatch(String(label), RAW_CODE, 'libellé en français, sans code technique');

        const alerts = await adminAlerts('ADMIN_CASHOUT_TO_RESUME', admin, r.cashoutId);
        assert.deepEqual(alerts.map((a) => a.channel).sort(), ['EMAIL', 'IN_APP', 'PUSH'], `ADMIN_CASHOUT_TO_RESUME de l’admin refunds.manage : ${JSON.stringify(alerts.map((a) => a.idempotency_key))}`);
        assert.deepEqual(await adminAlerts('ADMIN_CASHOUT_TO_RESUME', plainAdmin, r.cashoutId), [], 'aucune alerte à un admin sans refunds.manage');

        const delayed = await outboxRows({ type: 'REFUND_DELAYED', keyPrefix: `REFUND_DELAYED:${r.cashoutId}:` });
        assert.deepEqual(delayed.map((d) => d.channel).sort(), ['EMAIL', 'IN_APP', 'PUSH', 'SMS'], `REFUND_DELAYED au client : ${JSON.stringify(delayed.map((d) => d.idempotency_key))}`);
        assert.ok(delayed.every((d) => d.family === 'ESSENTIAL' && d.recipient_user_id === r.buyer.userId), 'avis indispensable, adressé au client');
        assert.deepEqual(await smsOf(delayed, r.buyer.phoneE164),
            [`Event Village : remboursement de ${smsAmount(Number(row.amount))} retardé ("${smsVar(r.s.title, 30)}"). L'équipe Event Village s'en occupe, aucune action de votre part.`],
            'SMS REFUND_DELAYED, texte exact (contrat 11.1, N1)');

        await withBalanceUnavailable(runCron);
        assert.equal((await outboxRows({ type: 'REFUND_DELAYED', userId: r.buyer.userId })).length, delayed.length, 'un seul avis de retard par versement (B11)');

        const status = await pollStatus(r.buyer.accessToken, r.paymentId);
        assert.equal(status.status, 200, JSON.stringify(status.body));
        assert.equal(status.body.refundDelayed, true, `refundDelayed de /api/payments/[id]/status (contrat 4.1) : ${JSON.stringify(status.body).slice(0, 300)}`);
        const { GET } = await importModule(TICKETS_ROUTE);
        const tickets = await asResult(await GET(authed('/api/tickets', 'GET', r.buyer)));
        assert.equal(tickets.status, 200, show(tickets));
        const mine = ((tickets.body.tickets ?? []) as Row[]).find((t) => t.id === r.ticketId);
        assert.ok(mine, `billet ${r.ticketId} dans /api/tickets`);
        assert.equal(mine.refundDelayed, true, `refundDelayed du billet dans /api/tickets (contrat 4.1) : ${JSON.stringify(mine).slice(0, 300)}`);
    });

    test('R10 : retrait, solde SamirPay à 0 : bloqué SOLDE_INSUFFISANT, ADMIN_CASHOUT_TO_RESUME, WITHDRAWAL_DELAYED, listé BLOQUE', async () => {
        const w = await withdrawal('r10');
        fakePay().balance = 0;
        try {
            assert.equal((await CashoutService.send(w.cashoutId)).skipped, 'SOLDE_INSUFFISANT', 'précondition : envoi bloqué par le solde');
        } finally {
            fakePay().balance = FULL_BALANCE;
        }
        assert.equal(sendsTo(w.partner.phone9), 0, 'rien n’est parti');
        assert.equal(await withdrawalStatus(w.withdrawalId), 'PROCESSING', 'retrait toujours en cours, montant réservé');

        const alerts = await adminAlerts('ADMIN_CASHOUT_TO_RESUME', admin, w.cashoutId);
        assert.deepEqual(alerts.map((a) => a.channel).sort(), ['EMAIL', 'IN_APP', 'PUSH'], `ADMIN_CASHOUT_TO_RESUME pour un retrait bloqué (aujourd'hui : remboursements seuls) : ${JSON.stringify(alerts.map((a) => a.idempotency_key))}`);
        const delayed = (await outboxRows({ type: 'WITHDRAWAL_DELAYED', userId: w.partner.userId })).filter((d) => d.template_data.cashout_id === w.cashoutId);
        assert.deepEqual(delayed.map((d) => d.channel).sort(), ['EMAIL', 'IN_APP', 'PUSH', 'SMS'], `WITHDRAWAL_DELAYED à la partenaire : ${JSON.stringify(delayed.map((d) => d.idempotency_key))}`);
        assert.deepEqual(await smsOf(delayed, w.partner.phoneE164),
            [`Event Village : votre retrait de ${smsAmount(w.net)} est retardé. L'équipe Event Village s'en occupe, aucune action de votre part.`],
            'SMS WITHDRAWAL_DELAYED, texte exact (contrat 11.1, N2)');

        const item = listed((await toResume()).items, w.cashoutId, 'retrait bloqué');
        assert.deepEqual({ kind: item.kind, state: item.state, can_mark_paid: item.can_mark_paid }, { kind: 'WITHDRAWAL', state: 'BLOQUE', can_mark_paid: true }, `ligne : ${JSON.stringify(item)}`);
        assert.equal(typeof item.block_label, 'string', 'motif du blocage');
        assert.doesNotMatch(String(item.block_label), RAW_CODE, 'motif en français, sans code technique');
    });

    test('R52 : trois remboursements de 5 250 F, solde de 11 000 F : deux versés, un bloqué, un audit CASHOUT_BATCH_PARTIAL ; solde rétabli, le cron verse le troisième', async () => {
        const s = await sale('r52');
        const buyers = [await newBuyer('v9b-r52-a'), await newBuyer('v9b-r52-b'), await newBuyer('v9b-r52-c')];
        const payments: string[] = [];
        for (const b of buyers) payments.push((await buyConfirmed(b, s.ev, [['Standard', 1]])).payment.id);
        fakePay().balance = 11_000;
        try {
            await cancelByPartner(s.partner, s.ev.eventId);
        } finally {
            fakePay().balance = FULL_BALANCE;
        }
        const rows = (await Promise.all(payments.map(cashoutsOfPayment))).flat();
        assert.deepEqual(rows.map((r) => [r.kind, Number(r.amount)]), [['EVENT_CANCELLATION_REFUND', 5250], ['EVENT_CANCELLATION_REFUND', 5250], ['EVENT_CANCELLATION_REFUND', 5250]], 'précondition : trois remboursements de 5 250 F');
        const states = rows.map((r) => (r.status === 'A_ENVOYER' ? `A_ENVOYER:${String(r.blocked_reason)}` : String(r.status))).sort();
        assert.deepEqual(states, ['A_ENVOYER:SOLDE_INSUFFISANT', 'CONFIRME', 'CONFIRME'], `envoi jusqu’à épuisement du solde (aujourd'hui les trois sont bloqués) : ${JSON.stringify(states)}`);
        const blocked = rows.find((r) => r.status === 'A_ENVOYER')!;
        const { data: audits, error } = await service.from('audit_logs').select('id, metadata').eq('action', 'CASHOUT_BATCH_PARTIAL');
        assert.equal(error, null, `journal CASHOUT_BATCH_PARTIAL : ${error?.message}`);
        const mine = (audits ?? []).filter((a) => rows.some((r) => JSON.stringify(a.metadata ?? {}).includes(String(r.id))));
        assert.equal(mine.length, 1, `un seul audit CASHOUT_BATCH_PARTIAL pour ce lot : ${JSON.stringify(mine)}`);

        await ageCashout(String(blocked.id), 6);
        await runCron();
        assert.equal((await cashoutRow(String(blocked.id))).status, 'CONFIRME', 'le troisième est versé quand le solde revient (B5, B8)');
        assert.deepEqual(buyers.map((b) => sendsTo(b.phone9)), [1, 1, 1], 'un envoi par acheteur, jamais deux');
    });
});

// ── 2. Décisions de l'administration (R9, B2 à B4) ─────────────────────────

describe('Tâche 1 — « Renvoyer » et « Marquer versé » (R9, B2, B3, B4)', () => {
    test('R9-a : retrait à l’issue incertaine (délai dépassé après envoi) : listé INCERTAIN, sans renvoi, « Marquer versé » proposé', async () => {
        const w = await withdrawal('r9a');
        assert.equal((await withCashoutMode('timeout-after-send', () => CashoutService.send(w.cashoutId))).status, 'INCERTAIN', 'précondition : issue incertaine');
        const item = listed((await toResume()).items, w.cashoutId, 'retrait INCERTAIN');
        assert.deepEqual({ kind: item.kind, state: item.state, can_resend: item.can_resend, can_mark_paid: item.can_mark_paid },
            { kind: 'WITHDRAWAL', state: 'INCERTAIN', can_resend: false, can_mark_paid: true }, `ligne : ${JSON.stringify(item)}`);
        assert.equal(await withdrawalStatus(w.withdrawalId), 'PROCESSING', 'retrait toujours en cours');
    });

    test('R9-b : remboursement bloqué (opérateur inconnu) marqué versé avec la référence : CONFIRME, billet REMBOURSE, REFUND_PAID, audit CASHOUT_MARKED_PAID', async () => {
        const r = await ticketRefund('r9b', { withoutOperator: true });
        assert.equal((await cashoutRow(r.cashoutId)).blocked_reason, 'OPERATOR_UNKNOWN', 'précondition : bloqué faute d’opérateur');
        const item = listed((await toResume()).items, r.cashoutId, 'remboursement bloqué');
        assert.deepEqual({ state: item.state, can_resend: item.can_resend, can_mark_paid: item.can_mark_paid }, { state: 'BLOQUE', can_resend: false, can_mark_paid: true }, `aucune destination : pas de renvoi (${JSON.stringify(item)})`);

        const res = await decide('mark-paid', r.cashoutId, admin, { reason: REASON, reference: REFERENCE });
        assert.equal(res.status, 200, show(res));
        assert.equal(res.body.ok, true, show(res));
        const row = await cashoutRow(r.cashoutId);
        assert.deepEqual({ status: row.status, reference: row.samirpay_reference }, { status: 'CONFIRME', reference: REFERENCE }, 'versé, référence SamirPay enregistrée (X2)');
        assert.equal(await refundStatus(r.refundId), 'PROCESSED', 'remboursement traité');
        assert.equal((await ticketRow(r.ticketId)).status, 'REMBOURSE', 'billet remboursé');
        assert.equal(sendsTo(r.buyer.phone9), 0, 'aucun envoi chez SamirPay : versé à la main');
        const paid = await outboxRows({ type: 'REFUND_PAID', keyPrefix: `REFUND_PAID:${r.cashoutId}:` });
        assert.ok(paid.length > 0 && paid.every((p) => p.recipient_user_id === r.buyer.userId), `REFUND_PAID au client : ${JSON.stringify(paid.map((p) => p.idempotency_key))}`);
        const audits = await auditsOf('CASHOUT_MARKED_PAID', r.cashoutId);
        assert.equal(audits.length, 1, 'un audit CASHOUT_MARKED_PAID (X18)');
        assert.equal(audits[0].user_id, admin.userId, 'audit au nom de l’administrateur');
        const meta = (audits[0].metadata ?? {}) as Row;
        assert.deepEqual({ reason: meta.reason, reference: meta.reference }, { reason: REASON, reference: REFERENCE }, `justification et référence journalisées (invariant w3) : ${JSON.stringify(meta)}`);
        assert.equal(row.provider_status, 'MANUEL', 'versement marqué à la main (invariant w3)');

        const again = await decide('mark-paid', r.cashoutId, admin, { reason: REASON, reference: REFERENCE });
        assert.equal(again.status, 409, show(again));
        assert.equal(again.body.code, 'ALREADY_FINAL', show(again));
        assert.equal((await auditsOf('CASHOUT_MARKED_PAID', r.cashoutId)).length, 1, 'aucun second audit');
    });

    test('R9-c : INCERTAIN avec identifiant : FAILED chez SamirPay → « Marquer versé » refusé, « Renvoyer » envoie une fois ; PENDING → 409 ; sans identifiant → 409 NOT_RESENDABLE', async () => {
        const failed = await ticketRefund('r9c-echec');
        assert.equal((await withCashoutMode('pending', () => CashoutService.send(failed.cashoutId))).status, 'ENVOYE', 'précondition : envoyé avec identifiant');
        const sent = await cashoutRow(failed.cashoutId);
        assert.ok(sent.samirpay_transaction_id, 'précondition : identifiant SamirPay enregistré');
        const { error } = await service.from('cashouts').update({ status: 'INCERTAIN', last_error: 'délai dépassé (test)' }).eq('id', failed.cashoutId);
        assert.equal(error, null, `passage INCERTAIN : ${error?.message}`);
        fakePay().setTransactionStatus(String(sent.samirpay_transaction_id), 'FAILED');
        assert.equal(listed((await toResume()).items, failed.cashoutId, 'INCERTAIN avec identifiant').can_resend, 'AFTER_CHECK', 'renvoi après contrôle du statut');

        const refused = await decide('mark-paid', failed.cashoutId, admin, { reason: REASON, reference: REFERENCE });
        assert.equal(refused.status, 409, show(refused));
        assert.equal(refused.body.code, 'PROVIDER_SAYS_FAILED', show(refused));
        assert.equal((await cashoutRow(failed.cashoutId)).status, 'INCERTAIN', 'aucun effet du refus');

        const resent = await decide('resend', failed.cashoutId, admin, { reason: REASON });
        assert.equal(resent.status, 200, show(resent));
        assert.equal(resent.body.ok, true, show(resent));
        assert.equal(sendsTo(failed.buyer.phone9), 2, 'un second envoi, et un seul');
        assert.equal((await cashoutRow(failed.cashoutId)).status, 'CONFIRME', 'versé');
        const resentAudits = await auditsOf('CASHOUT_RESENT', failed.cashoutId);
        assert.equal(resentAudits.length, 1, 'un audit CASHOUT_RESENT (X18)');
        assert.deepEqual({ user: resentAudits[0].user_id, reason: ((resentAudits[0].metadata ?? {}) as Row).reason }, { user: admin.userId, reason: REASON }, 'décision journalisée avec sa justification (invariant w2)');

        const pending = await ticketRefund('r9c-attente');
        await withCashoutMode('pending', () => CashoutService.send(pending.cashoutId));
        const { error: pErr } = await service.from('cashouts').update({ status: 'INCERTAIN', last_error: 'délai dépassé (test)' }).eq('id', pending.cashoutId);
        assert.equal(pErr, null, `passage INCERTAIN : ${pErr?.message}`);
        const wait = await decide('resend', pending.cashoutId, admin, { reason: REASON });
        assert.equal(wait.status, 409, show(wait));
        assert.equal(wait.body.code, 'PROVIDER_PENDING', show(wait));
        assert.equal(sendsTo(pending.buyer.phone9), 1, 'SamirPay dit PENDING : rien ne repart');
        assert.equal((await cashoutRow(pending.cashoutId)).status, 'INCERTAIN', 'statut inchangé');

        const blind = await ticketRefund('r9c-sans-id');
        assert.equal((await withCashoutMode('timeout', () => CashoutService.send(blind.cashoutId))).status, 'INCERTAIN', 'précondition : incertain sans identifiant');
        assert.equal(listed((await toResume()).items, blind.cashoutId, 'INCERTAIN sans identifiant').can_resend, false, 'jamais de renvoi sans identifiant (B2)');
        const never = await decide('resend', blind.cashoutId, admin, { reason: REASON });
        assert.equal(never.status, 409, show(never));
        assert.equal(never.body.code, 'NOT_RESENDABLE', show(never));
        assert.equal(sendsTo(blind.buyer.phone9), 1, 'aucun nouvel envoi');
        assert.deepEqual(await auditsOf('CASHOUT_RESENT', blind.cashoutId), [], 'aucun audit d’un refus');
    });

    test('R9-d : sans refunds.manage 403 ; justification absente ou courte 400 REASON_REQUIRED ; référence absente 400 REFERENCE_REQUIRED ; aucun effet', async () => {
        const r = await ticketRefund('r9d');
        assert.equal((await withCashoutMode('rejected', () => CashoutService.send(r.cashoutId))).status, 'ECHOUE', 'précondition : refus de SamirPay');
        for (const action of ['resend', 'mark-paid'] as const) {
            const denied = await decide(action, r.cashoutId, plainAdmin, { reason: REASON, reference: REFERENCE });
            assert.equal(denied.status, 403, `${action} sans refunds.manage : ${show(denied)}`);
            for (const reason of [undefined, '', 'court']) {
                const bad = await decide(action, r.cashoutId, admin, { reason, reference: REFERENCE });
                assert.deepEqual([bad.status, bad.body.code], [400, 'REASON_REQUIRED'], `${action}, justification ${JSON.stringify(reason)} : ${show(bad)}`);
            }
        }
        const noRef = await decide('mark-paid', r.cashoutId, admin, { reason: REASON });
        assert.deepEqual([noRef.status, noRef.body.code], [400, 'REFERENCE_REQUIRED'], `référence absente : ${show(noRef)}`);
        assert.equal((await cashoutRow(r.cashoutId)).status, 'ECHOUE', 'aucun effet');
        assert.equal(sendsTo(r.buyer.phone9), 1, 'aucun nouvel envoi');
        assert.deepEqual([...await auditsOf('CASHOUT_RESENT', r.cashoutId), ...await auditsOf('CASHOUT_MARKED_PAID', r.cashoutId)], [], 'aucune décision journalisée');
    });

    test('R105 : refus, « Renvoyer », nouveau refus : une seconde alerte ADMIN_REFUND_TO_RETRY (tentative 2)', async () => {
        const r = await ticketRefund('r105');
        assert.equal((await withCashoutMode('rejected', () => CashoutService.send(r.cashoutId))).status, 'ECHOUE', 'précondition : premier refus');
        const first = await outboxRows({ type: 'ADMIN_REFUND_TO_RETRY', keyPrefix: `ADMIN_REFUND_TO_RETRY:${r.cashoutId}:1:ECHOUE:`, userId: admin.userId });
        assert.deepEqual(first.map((a) => a.channel).sort(), ['EMAIL', 'IN_APP', 'PUSH'], 'précondition : alerte du premier refus');
        const res = await withCashoutMode('rejected', () => decide('resend', r.cashoutId, admin, { reason: REASON }));
        assert.equal(res.status, 200, show(res));
        assert.equal((await cashoutRow(r.cashoutId)).status, 'ECHOUE', 'nouveau refus');
        assert.equal(sendsTo(r.buyer.phone9), 2, 'deux envois, tous deux refusés');
        const second = await outboxRows({ type: 'ADMIN_REFUND_TO_RETRY', keyPrefix: `ADMIN_REFUND_TO_RETRY:${r.cashoutId}:2:ECHOUE:`, userId: admin.userId });
        assert.deepEqual(second.map((a) => a.channel).sort(), ['EMAIL', 'IN_APP', 'PUSH'], `seconde alerte, tentative 2 (attempt_count forcé à 1 aujourd'hui, cashout.service.ts:227) : ${JSON.stringify(second.map((a) => a.idempotency_key))}`);
    });
});

// ── 3. Bénéficiaire suspendu (B19) ─────────────────────────────────────────

describe('Tâche 1 — retrait d’un bénéficiaire suspendu (B19, R5-5)', () => {
    test('CashoutService.send ne verse pas le retrait d’un compte SUSPENDU (ACCOUNT_SUSPENDED), le verse après la réactivation', async () => {
        const w = await withdrawal('b19');
        const { error } = await service.from('users').update({ status: 'SUSPENDU' }).eq('id', w.partner.userId);
        assert.equal(error, null, `suspension : ${error?.message}`);
        try {
            const out = await CashoutService.send(w.cashoutId);
            assert.equal(out.skipped, 'ACCOUNT_SUSPENDED', `retrait d’un compte suspendu : ${JSON.stringify(out)}`);
            assert.equal(sendsTo(w.partner.phone9), 0, 'aucune transaction au faux SamirPay');
            assert.equal((await cashoutRow(w.cashoutId)).status, 'A_ENVOYER', 'toujours à envoyer');
        } finally {
            const { error: back } = await service.from('users').update({ status: 'ACTIF' }).eq('id', w.partner.userId);
            assert.equal(back, null, `réactivation : ${back?.message}`);
        }
        assert.equal((await CashoutService.send(w.cashoutId)).status, 'CONFIRME', 'versé après la réactivation');
        assert.equal(sendsTo(w.partner.phone9), 1, 'un seul envoi');
    });
});

