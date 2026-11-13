/**
 * Lot 9 bis, tâche 2 (R4, R5 ; contrat 5.2, B14 à B20, A7, 4.1, 4.2) — suspension et fonds.
 *  R4 : les fonds d'un événement SUSPENDU ne sont pas retirables. Gel calculé à la lecture (fin_frozen_amount) :
 *       Σ max(0, net échu) des événements SUSPENDU du compte ORGANISATEUR ; finance_account_balance garde `available`,
 *       ajoute `frozen` et réduit `withdrawable` ; withdrawal_request et withdrawal_quote refusent FUNDS_FROZEN (même
 *       règle fin_withdrawal_check) ; la route du code refuse 409 FUNDS_FROZEN sans SMS.
 *  R5 : partenaire suspendue → chacun de ses événements PUBLIE passe SUSPENDU (motif « Organisateur suspendu »,
 *       rôle ADMIN), trace dans partner_suspension_cascades, aucun EVENT_SUSPENDED à la partenaire (A7), porteurs en
 *       in-app (R24) ; réactivation : seuls les événements cascadés encore SUSPENDU, non changés et non terminés
 *       reviennent PUBLIE (« Organisateur réactivé ») ; sinon trace LEFT_ENDED ou LEFT_CHANGED ; un admin ne republie
 *       pas l'événement d'une partenaire suspendue (PARTNER_SUSPENDED, B18) ; texte du bandeau corrigé.
 *
 * Rouge avant correctif : withdrawal_request ne lit que le grand livre (M/20261101000014:92-97), finance_account_balance
 * n'a pas de clé `frozen` (M/20261101000004:330-338), withdrawal_quote n'existe pas ; partner_status_set ne touche pas aux
 * événements (M/20261103000006:741-761), la table partner_suspension_cascades n'existe pas, event_transition ne lit pas
 * le statut de la partenaire ; bandeau « Vos événements ne sont plus visibles du public » (faux).
 * Vert dès l'écriture (témoin, signalé) : un retrait DEMANDÉ par une partenaire suspendue est déjà refusé
 * (ACCOUNT_NOT_ACTIVE, M/20261101000014:63-65), garde-fou finance-retraits.test.ts:468.
 * Le bandeau n'est pas visible en vrai (session refusée à un compte suspendu, lib/auth/session.ts:54-62) : contrôle
 * statique seulement, dit au rapport.
 * Chaque test crée sa partenaire, ses événements et ses acheteurs. Fin de suite : assertLot9bisInvariants (w5 à w7).
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { CashoutService } from '../../lib/payments/cashout.service';
import { getFakes } from '../fakes';
import { bearer, signInAs } from '../helpers/fixtures';
import { assertLot9bisInvariants } from '../helpers/lot9bis-invariants';
import { cart, checkout, deliverWebhook, newBuyer, paymentById, providerSays, service, type Buyer, type SaleEvent } from './paiement-helpers';
import {
    buyConfirmed, confirmCashouts, createPartnerEvent, jsonRequest, newPartner, superadminId, withSettings,
    type AccountKind, type FinanceSettingKey, type TestPartner,
} from './finance-helpers';
import { assertRpcOk, eventHistory, eventStatus, rpcCancel, rpcTransition, shiftEventDates, type RpcBody, type RpcCall } from './cycle-helpers';
import { outboxRows } from './notif-helpers';
import { invoke, routeHandler, show } from './pilotage-helpers';
import type { RouteResult } from './acces-helpers';

after(async () => {
    await assertLot9bisInvariants('lot9bis-fonds-suspension');
});

type Row = Record<string, unknown>;

const PARTNER_STATUS_ROUTE = '../../app/api/admin/partners/[id]/status/route';
const BALANCE_ROUTE = '../../app/api/finance/balance/route';
const OTP_ROUTE = '../../app/api/withdrawals/otp/route';
const TRANSITION_ROUTE = '../../app/api/partner/events/[id]/transition/route';
const CASCADE_REASON = 'Organisateur suspendu';
const RESTORE_REASON = 'Organisateur réactivé';
const CASCADE_TABLE_HINT = 'table partner_suspension_cascades (migration 20261109000006_lot9bis_argent, contrat 5.2)';

const WITHDRAWAL_RULES: Partial<Record<FinanceSettingKey, unknown>> = {
    'finance.withdrawal_fee_rate': 1,
    'finance.withdrawal_min_amount': 5000,
    'finance.withdrawal_bank_enabled': false,
};

// ── Fonds ──────────────────────────────────────────────────────────────────

/** Événement PUBLIE de la partenaire et une vente en ligne d'un billet, disponible tout de suite (garde désactivée). */
async function fundedEvent(partner: TestPartner, label: string, price: number): Promise<SaleEvent> {
    const ev = await createPartnerEvent(partner.partnerId, label, [{ name: 'Standard', price, total: 20 }]);
    const buyer = await newBuyer(`${label}-ach`);
    await withSettings({ 'finance.payout_hold_enabled': false }, () => buyConfirmed(buyer, ev, [['Standard', 1]]));
    return ev;
}

async function fundedPartner(label: string, price = 10_000): Promise<{ partner: TestPartner; ev: SaleEvent }> {
    const partner = await newPartner(label);
    const ev = await fundedEvent(partner, label, price);
    const b = await rawBalance(partner.userId);
    assert.equal(Number(b.available), price, `fonds disponibles du partenaire de test : ${JSON.stringify(b)}`);
    return { partner, ev };
}

/** Réponse brute de finance_account_balance (toutes les clés, `frozen` comprise). */
async function rawBalance(ownerId: string, kind: AccountKind = 'ORGANISATEUR'): Promise<Row> {
    const { data, error } = await service.rpc('finance_account_balance', { p_owner: ownerId, p_kind: kind });
    assert.equal(error, null, `finance_account_balance : ${error?.message}`);
    return (data ?? {}) as Row;
}

/** Valeur numérique d'une clé exigée par le contrat ; échec explicite si la clé manque. */
function num(body: Row, key: string, what: string): number {
    assert.ok(key in body, `${what} : clé « ${key} » absente (contrat 4.1, B14) — reçu ${JSON.stringify(body)}`);
    const n = Number(body[key]);
    assert.ok(Number.isFinite(n), `${what} : ${key} non numérique (${JSON.stringify(body[key])})`);
    return n;
}

async function rpcWithdraw(user: Buyer, gross: number, kind: AccountKind = 'ORGANISATEUR'): Promise<Row> {
    const { data, error } = await service.rpc('withdrawal_request', {
        p: {
            user_id: user.userId, account_kind: kind, gross_amount: gross, method: 'MOBILE_MONEY', operator: 'WAVE',
            phone_number: user.phone9, client_key: randomUUID(),
        },
    });
    assert.equal(error, null, `withdrawal_request : ${error?.message}`);
    return (data ?? {}) as Row;
}

/** withdrawal_quote(p) `{ user_id, account_kind, gross_amount }` (contrat 3.2, M06) : nouvelle, absente avant le correctif. */
async function rpcQuote(user: Buyer, gross: number, kind: AccountKind = 'ORGANISATEUR'): Promise<Row> {
    const { data, error } = await service.rpc('withdrawal_quote', { p: { user_id: user.userId, account_kind: kind, gross_amount: gross } });
    assert.equal(error, null, `withdrawal_quote (RPC nouvelle, migration 20261109000006_lot9bis_argent) : ${error?.message} (code ${error?.code})`);
    return (data ?? {}) as Row;
}

async function withdrawalsOf(userId: string): Promise<Row[]> {
    const { data, error } = await service.from('withdrawals').select('*').eq('user_id', userId).order('created_at');
    assert.equal(error, null, `retraits de ${userId} : ${error?.message}`);
    return (data ?? []) as Row[];
}

async function withdrawalCashoutsOf(userId: string): Promise<Row[]> {
    const { data, error } = await service.from('cashouts').select('*').eq('beneficiary_user_id', userId).eq('kind', 'WITHDRAWAL');
    assert.equal(error, null, `versements de retrait de ${userId} : ${error?.message}`);
    return (data ?? []) as Row[];
}

/** Envoie puis confirme un versement de retrait créé par la RPC (aucun versement laissé en attente). */
async function settleCashout(cashoutId: unknown): Promise<void> {
    if (typeof cashoutId !== 'string') return;
    await CashoutService.send(cashoutId);
    await confirmCashouts();
}

function smsCodes(phoneE164: string): string[] {
    return getFakes().sms.messagesTo(phoneE164)
        .map((m) => m.message.match(/\b(\d{6})\b/)?.[1])
        .filter((c): c is string => Boolean(c));
}

async function withdrawalOtpRows(phoneE164: string): Promise<number> {
    const { data, error } = await service.from('otp_codes').select('id').eq('phone', phoneE164).eq('purpose', 'WITHDRAWAL');
    assert.equal(error, null, `codes de retrait : ${error?.message}`);
    return (data ?? []).length;
}

/**
 * Net du compte ORGANISATEUR pour un événement, lu dans le grand livre (oracle indépendant de fin_frozen_amount). Les
 * écritures de ces tests sont toutes échues (garde désactivée, débit daté de la vente) : aucun filtre sur available_at,
 * qui comparerait l'horloge du test à celle de la base.
 */
async function eventNet(ownerId: string, eventId: string): Promise<number> {
    const { data, error } = await service.from('finance_ledger').select('amount')
        .eq('owner_id', ownerId).eq('account_kind', 'ORGANISATEUR').eq('event_id', eventId);
    assert.equal(error, null, `grand livre de l'événement ${eventId} : ${error?.message}`);
    return (data ?? []).reduce((s, e) => s + Number(e.amount), 0);
}

// ── Statuts ────────────────────────────────────────────────────────────────

async function suspendEvent(eventId: string, reason = 'Suspension de test du lot 9 bis (gel des fonds)'): Promise<void> {
    assertRpcOk(await rpcTransition(eventId, await superadminId(), 'SUSPENDU', reason), `suspension de l'événement ${eventId} par l'admin`);
}

async function eventTitle(eventId: string): Promise<string> {
    const { data, error } = await service.from('events').select('title').eq('id', eventId).single();
    assert.equal(error, null, `titre de l'événement ${eventId} : ${error?.message}`);
    return String(data.title);
}

/** partner_status_set(p) par le SUPERADMIN du seed (même RPC que la route) ; résultat brut, lu par assertRpcOk. */
async function partnerStatusRpc(partnerId: string, status: 'SUSPENDU' | 'VALIDE', reason: string): Promise<RpcCall> {
    const { data, error } = await service.rpc('partner_status_set', { p: { partner_id: partnerId, actor_id: await superadminId(), status, reason } });
    return { data: (data ?? null) as RpcBody | null, error };
}

let superToken: string | null = null;

async function superadminToken(): Promise<string> {
    if (!superToken) superToken = (await signInAs('SUPERADMIN')).accessToken;
    return superToken;
}

function paramsContext(params: Record<string, string>): { params: Promise<Record<string, string>> & Record<string, string> } {
    return { params: Object.assign(Promise.resolve(params), params) };
}

/** PATCH /api/admin/partners/[id]/status par le SUPERADMIN du seed (contrat 4.2 : réponse + events_*). */
async function partnerStatusRoute(partnerId: string, status: 'SUSPENDU' | 'VALIDE', reason: string): Promise<RouteResult> {
    const handler = await routeHandler(PARTNER_STATUS_ROUTE, 'PATCH', 'PATCH /api/admin/partners/[id]/status');
    const req = jsonRequest(`/api/admin/partners/${partnerId}/status`, 'PATCH', null, { status, reason }, bearer(await superadminToken()));
    return invoke(handler, req, paramsContext({ id: partnerId }));
}

async function cascadeRows(partnerId: string): Promise<Row[]> {
    const { data, error } = await service.from('partner_suspension_cascades').select('*').eq('partner_id', partnerId);
    assert.equal(error, null, `${CASCADE_TABLE_HINT} : ${error?.message} (code ${error?.code})`);
    return (data ?? []) as Row[];
}

function mentions(value: unknown, id: string): boolean {
    return JSON.stringify(value ?? null).includes(id);
}

const CATEGORY = [{ name: 'Standard', price: 5_000, total: 20 }];

// ── R4 ─────────────────────────────────────────────────────────────────────

describe('R4 — les fonds d’un événement SUSPENDU ne sont pas retirables', () => {
    test('R4 reproduit : événement suspendu par l’admin, withdrawal_request de 5 000 F → FUNDS_FROZEN, aucun retrait ni versement', async () => {
        const { partner, ev } = await fundedPartner('gel-r4');
        await suspendEvent(ev.eventId);
        const out = await withSettings(WITHDRAWAL_RULES, () => rpcWithdraw(partner, 5_000));
        if (out.ok === true) await settleCashout(out.cashout_id);
        assert.equal(out.ok, false, `R4 : retrait accepté sur les ventes d'un événement suspendu : ${JSON.stringify(out)}`);
        assert.equal(out.code, 'FUNDS_FROZEN', JSON.stringify(out));
        assert.deepEqual(await withdrawalsOf(partner.userId), [], 'aucun retrait créé');
        assert.deepEqual(await withdrawalCashoutsOf(partner.userId), [], 'aucun versement créé');
        assert.equal(Number((await rawBalance(partner.userId)).available), 10_000, 'grand livre intact');
    });

    test('solde : frozen = 10 000, withdrawable = 0, available inchangé (10 000) ; GET /api/finance/balance sert frozen et withdrawable', async () => {
        const { partner, ev } = await fundedPartner('gel-solde');
        await suspendEvent(ev.eventId);
        const b = await rawBalance(partner.userId);
        assert.equal(num(b, 'available', 'finance_account_balance'), 10_000, 'available garde la somme du grand livre (invariant (e))');
        assert.equal(num(b, 'frozen', 'finance_account_balance'), 10_000, `net de l'événement suspendu gelé : ${JSON.stringify(b)}`);
        assert.equal(num(b, 'withdrawable', 'finance_account_balance'), 0, `rien de retirable : ${JSON.stringify(b)}`);

        const handler = await routeHandler(BALANCE_ROUTE, 'GET', 'GET /api/finance/balance');
        const res = await invoke(handler, jsonRequest('/api/finance/balance?account=ORGANISATEUR', 'GET', partner.accessToken));
        assert.equal(res.status, 200, `solde par la route : ${show(res)}`);
        assert.equal(num(res.body, 'frozen', 'GET /api/finance/balance'), 10_000, show(res));
        assert.equal(num(res.body, 'withdrawable', 'GET /api/finance/balance'), 0, show(res));
        assert.equal(num(res.body, 'available', 'GET /api/finance/balance'), 10_000, show(res));
    });

    test('réactivation de l’événement : frozen = 0, withdrawable = 10 000, retrait de 5 000 F accepté', async () => {
        const { partner, ev } = await fundedPartner('gel-reprise');
        await suspendEvent(ev.eventId);
        assertRpcOk(await rpcTransition(ev.eventId, await superadminId(), 'PUBLIE'), 'réactivation de l’événement par l’admin');
        const b = await rawBalance(partner.userId);
        assert.equal(num(b, 'frozen', 'finance_account_balance'), 0, `plus rien de gelé après la réactivation : ${JSON.stringify(b)}`);
        assert.equal(num(b, 'withdrawable', 'finance_account_balance'), 10_000, JSON.stringify(b));
        const out = await withSettings(WITHDRAWAL_RULES, () => rpcWithdraw(partner, 5_000));
        await settleCashout(out.cashout_id);
        assert.equal(out.ok, true, `retrait accepté après la réactivation : ${JSON.stringify(out)}`);
    });

    test('trois événements : seul le net de l’événement suspendu est gelé ; le net négatif d’un autre suspendu ne réduit pas le gel', async () => {
        const partner = await newPartner('gel-trois');
        await fundedEvent(partner, 'gel-trois-a', 10_000);
        const evB = await fundedEvent(partner, 'gel-trois-b', 6_000);
        // Événement C : une vente remboursée, frais d'agrégateur à la charge de l'organisateur → net négatif.
        const evC = await createPartnerEvent(partner.partnerId, 'gel-trois-c', [{ name: 'Standard', price: 5_000, total: 10 }]);
        const buyerC = await newBuyer('gel-trois-c-ach');
        const saleC = await withSettings({ 'finance.payout_hold_enabled': false, 'finance.aggregator_fee_rate.WAVE': 2 },
            () => buyConfirmed(buyerC, evC, [['Standard', 1]]));
        const refund = await withSettings({ 'finance.cancellation_aggregator_fee_bearer': 'ORGANISATEUR' }, async () => {
            const { data, error } = await service.rpc('ticket_refund_request', { p_ticket_id: saleC.tickets[0].id, p_actor: partner.userId, p_reason: 'Remboursement de test (net négatif)' });
            assert.equal(error, null, `ticket_refund_request : ${error?.message}`);
            return (data ?? {}) as Row;
        });
        assert.equal(refund.ok, true, `remboursement du billet de C : ${JSON.stringify(refund)}`);
        await settleCashout(refund.cashout_id);

        const netB = await eventNet(partner.userId, evB.eventId);
        const netC = await eventNet(partner.userId, evC.eventId);
        assert.equal(netB, 6_000, 'net de B : une vente de 6 000 F');
        assert.ok(netC < 0, `précondition : net de C négatif (vente moins remboursement et frais d'agrégateur), obtenu ${netC}`);

        await suspendEvent(evB.eventId);
        await suspendEvent(evC.eventId);
        const b = await rawBalance(partner.userId);
        const available = num(b, 'available', 'finance_account_balance');
        assert.equal(num(b, 'frozen', 'finance_account_balance'), 6_000,
            `gel = Σ max(0, net) des événements suspendus = 6 000 (et non 6 000 ${netC}) : ${JSON.stringify(b)}`);
        assert.equal(num(b, 'withdrawable', 'finance_account_balance'), Math.floor(Math.max(available - 6_000, 0)), JSON.stringify(b));
    });

    test('devis et retrait rendent le même code : withdrawal_quote, route du code (409, aucun SMS) et withdrawal_request → FUNDS_FROZEN', async () => {
        const { partner, ev } = await fundedPartner('gel-devis');
        await suspendEvent(ev.eventId);
        const smsBefore = smsCodes(partner.phoneE164).length;
        const otpBefore = await withdrawalOtpRows(partner.phoneE164);
        await withSettings(WITHDRAWAL_RULES, async () => {
            const quote = await rpcQuote(partner, 5_000);
            assert.equal(quote.code, 'FUNDS_FROZEN', `devis : ${JSON.stringify(quote)}`);

            const handler = await routeHandler(OTP_ROUTE, 'POST', 'POST /api/withdrawals/otp');
            const res = await invoke(handler, jsonRequest('/api/withdrawals/otp', 'POST', partner.accessToken, { account: 'ORGANISATEUR', amount: 5_000 }));
            assert.equal(res.status, 409, `route du code : ${show(res)}`);
            assert.equal(res.body.code, 'FUNDS_FROZEN', show(res));

            const out = await rpcWithdraw(partner, 5_000);
            if (out.ok === true) await settleCashout(out.cashout_id);
            assert.equal(out.code, 'FUNDS_FROZEN', `retrait : ${JSON.stringify(out)}`);
            assert.equal(quote.code, out.code, 'même règle pour le devis et le retrait (fin_withdrawal_check)');
        });
        assert.equal(smsCodes(partner.phoneE164).length, smsBefore, 'aucun code de retrait envoyé par SMS');
        assert.equal(await withdrawalOtpRows(partner.phoneE164), otpBefore, 'aucun code de retrait enregistré');
    });

    test('témoin (vert dès l’écriture) : retrait demandé par une partenaire suspendue refusé (ACCOUNT_NOT_ACTIVE), aucun retrait', async () => {
        const { partner } = await fundedPartner('gel-compte');
        assertRpcOk(await partnerStatusRpc(partner.partnerId, 'SUSPENDU', 'Suspension de test du lot 9 bis (compte)'), 'suspension de la partenaire');
        const out = await withSettings(WITHDRAWAL_RULES, () => rpcWithdraw(partner, 5_000));
        if (out.ok === true) await settleCashout(out.cashout_id);
        assert.equal(out.code, 'ACCOUNT_NOT_ACTIVE', JSON.stringify(out));
        assert.deepEqual(await withdrawalsOf(partner.userId), [], 'aucun retrait créé');
        assertRpcOk(await partnerStatusRpc(partner.partnerId, 'VALIDE', 'Réactivation de test du lot 9 bis (compte)'), 'réactivation de la partenaire');
    });
});

// ── R5 ─────────────────────────────────────────────────────────────────────

describe('R5 — partenaire suspendue : cascade sur ses événements', () => {
    test('R5 reproduit : suspension par la route → l’événement PUBLIE passe SUSPENDU (motif, rôle ADMIN), une trace de cascade, aucun EVENT_SUSPENDED à la partenaire, porteurs avisés en in-app sans SMS', async () => {
        const partner = await newPartner('casc-r5');
        const ev = await createPartnerEvent(partner.partnerId, 'casc-r5', CATEGORY);
        const holder = await newBuyer('casc-r5-porteur');
        await buyConfirmed(holder, ev, [['Standard', 1]]);

        const res = await partnerStatusRoute(partner.partnerId, 'SUSPENDU', 'Suspension de test du lot 9 bis (cascade)');
        assert.equal(res.status, 200, `suspension de la partenaire : ${show(res)}`);
        assert.equal(await eventStatus(ev.eventId), 'SUSPENDU', 'R5 : l’événement en ligne d’une partenaire suspendue doit passer SUSPENDU');

        const history = await eventHistory(ev.eventId);
        const last = history[history.length - 1];
        assert.equal(last.old_status, 'PUBLIE', JSON.stringify(last));
        assert.equal(last.new_status, 'SUSPENDU', JSON.stringify(last));
        assert.equal(last.reason, CASCADE_REASON, `motif de la cascade : ${JSON.stringify(last)}`);
        assert.equal(last.actor_role, 'ADMIN', `rôle de l'acteur : ${JSON.stringify(last)}`);
        assert.equal(last.channel, 'TRANSITION', JSON.stringify(last));
        assert.equal(last.actor_id, await superadminId(), 'acteur : l’admin qui suspend la partenaire (SUPERADMIN du seed)');

        const traces = await cascadeRows(partner.partnerId);
        assert.equal(traces.length, 1, `une trace de cascade : ${JSON.stringify(traces)}`);
        assert.equal(traces[0].event_id, ev.eventId);
        assert.equal(traces[0].suspended_history_id, last.id, 'trace liée à la ligne d’historique de la cascade');
        assert.equal(traces[0].closed_at ?? null, null, 'trace ouverte tant que la partenaire est suspendue');
        assert.ok(mentions(res.body.events_suspended, ev.eventId), `réponse de la route : events_suspended contient l'événement (contrat 4.2) : ${show(res)}`);

        const toPartner = await outboxRows({ type: 'EVENT_SUSPENDED', eventId: ev.eventId, userId: partner.userId });
        assert.deepEqual(toPartner.map((r) => r.channel), [], 'A7 : aucun avis EVENT_SUSPENDED à la partenaire pour un événement de la cascade');
        const toHolder = await outboxRows({ type: 'EVENT_SUSPENDED_HOLDER', eventId: ev.eventId, userId: holder.userId });
        const channels = toHolder.map((r) => r.channel);
        assert.ok(channels.includes('IN_APP'), `porteur avisé en in-app (R24) : ${JSON.stringify(channels)}`);
        assert.ok(!channels.includes('SMS'), `aucun SMS au porteur pour une suspension (R24) : ${JSON.stringify(channels)}`);
    });

    test('paiement ouvert avant la suspension, succès après : aucune VENTE ni billet, paiement remboursé (REFUND_REQUIRED)', async () => {
        const partner = await newPartner('casc-attente');
        const ev = await createPartnerEvent(partner.partnerId, 'casc-attente', CATEGORY);
        const buyer = await newBuyer('casc-attente-ach');
        const opened = await checkout(buyer, cart(ev.eventId, [[ev.categories.Standard.id, 1]], buyer));
        assert.equal(opened.status, 200, `checkout : HTTP ${opened.status} ${JSON.stringify(opened.body)}`);
        assert.ok(opened.payment, 'paiement en attente créé');

        assertRpcOk(await partnerStatusRpc(partner.partnerId, 'SUSPENDU', 'Suspension de test du lot 9 bis (paiement en cours)'), 'suspension de la partenaire');
        assert.equal(await eventStatus(ev.eventId), 'SUSPENDU', 'R5 : événement suspendu par la cascade');

        providerSays(opened.payment!, 'SUCCESS');
        const hook = await deliverWebhook(opened.payment!);
        assert.equal(hook.status, 200, 'webhook accepté');
        const pay = await paymentById(opened.payment!.id);
        assert.ok(['REFUND_PENDING', 'REFUNDED'].includes(pay.status), `paiement remboursé, jamais confirmé : ${pay.status}`);
        assert.match(String((pay.metadata as Row | null)?.refund_reason ?? ''), /suspendu/, `motif du remboursement : ${JSON.stringify(pay.metadata)}`);
        const { data: tickets, error: tErr } = await service.from('tickets').select('id').eq('payment_id', pay.id);
        assert.equal(tErr, null, tErr?.message);
        assert.deepEqual(tickets ?? [], [], 'aucun billet émis');
        const { data: sale, error: sErr } = await service.from('finance_ledger').select('id').eq('source_key', `VENTE-${pay.id}`);
        assert.equal(sErr, null, sErr?.message);
        assert.deepEqual(sale ?? [], [], 'aucun crédit VENTE pour la partenaire suspendue');
    });

    test('réactivation : seul l’événement cascadé intact revient PUBLIE (« Organisateur réactivé ») ; suspendu avant, terminé ou annulé pendant : traces LEFT_ENDED, LEFT_CHANGED ; aucun avis par événement à la partenaire', async () => {
        const partner = await newPartner('casc-retour');
        const admin = await superadminId();
        const e1 = await createPartnerEvent(partner.partnerId, 'casc-retour-1', CATEGORY);
        const e2 = await createPartnerEvent(partner.partnerId, 'casc-retour-2', CATEGORY);
        const e3 = await createPartnerEvent(partner.partnerId, 'casc-retour-3', CATEGORY);
        const e4 = await createPartnerEvent(partner.partnerId, 'casc-retour-4', CATEGORY);
        await suspendEvent(e2.eventId, 'Suspension par l’admin avant celle de la partenaire');

        const suspended = await partnerStatusRoute(partner.partnerId, 'SUSPENDU', 'Suspension de test du lot 9 bis (réactivation)');
        assert.equal(suspended.status, 200, `suspension : ${show(suspended)}`);
        for (const e of [e1, e3, e4]) assert.equal(await eventStatus(e.eventId), 'SUSPENDU', `R5 : ${e.eventId} suspendu par la cascade`);

        await shiftEventDates(e3.eventId, { startsInHours: -10, durationHours: 4 });
        assertRpcOk(await rpcCancel(e4.eventId, admin, {
            publicNotice: 'Événement annulé pendant la suspension de l’organisateur.',
            internalReason: 'Annulation de test du lot 9 bis',
            confirmTitle: await eventTitle(e4.eventId),
        }), 'annulation de l’événement 4 par l’admin pendant la suspension');

        const back = await partnerStatusRoute(partner.partnerId, 'VALIDE', 'Réactivation de test du lot 9 bis');
        assert.equal(back.status, 200, `réactivation : ${show(back)}`);
        assert.equal(await eventStatus(e1.eventId), 'PUBLIE', 'événement cascadé intact : rétabli');
        assert.equal(await eventStatus(e2.eventId), 'SUSPENDU', 'événement suspendu par l’admin avant : reste suspendu');
        assert.equal(await eventStatus(e3.eventId), 'SUSPENDU', 'événement cascadé terminé pendant la suspension : reste suspendu (B20)');
        assert.equal(await eventStatus(e4.eventId), 'ANNULE', 'événement cascadé puis annulé : reste annulé');

        const h1 = await eventHistory(e1.eventId);
        const last1 = h1[h1.length - 1];
        assert.equal(last1.new_status, 'PUBLIE', JSON.stringify(last1));
        assert.equal(last1.reason, RESTORE_REASON, `motif du rétablissement : ${JSON.stringify(last1)}`);
        assert.equal(last1.actor_role, 'ADMIN', JSON.stringify(last1));

        const traces = await cascadeRows(partner.partnerId);
        const byEvent = new Map(traces.map((t) => [String(t.event_id), t]));
        assert.equal(byEvent.has(e2.eventId), false, 'aucune trace pour l’événement suspendu avant la partenaire');
        assert.equal(byEvent.get(e1.eventId)?.outcome, 'RESTORED', JSON.stringify(traces));
        assert.equal(byEvent.get(e3.eventId)?.outcome, 'LEFT_ENDED', JSON.stringify(traces));
        assert.equal(byEvent.get(e4.eventId)?.outcome, 'LEFT_CHANGED', JSON.stringify(traces));
        assert.ok(traces.every((t) => t.closed_at), `toutes les traces fermées après la réactivation : ${JSON.stringify(traces)}`);

        assert.ok(mentions(back.body.events_restored, e1.eventId), `events_restored : ${show(back)}`);
        for (const e of [e2, e3, e4]) assert.ok(!mentions(back.body.events_restored, e.eventId), `events_restored ne contient pas ${e.eventId} : ${show(back)}`);
        assert.ok(mentions(back.body.events_left_suspended, e3.eventId), `events_left_suspended : ${show(back)}`);

        for (const e of [e1, e3, e4]) {
            const rows = await outboxRows({ type: ['EVENT_SUSPENDED', 'EVENT_REACTIVATED'], eventId: e.eventId, userId: partner.userId });
            assert.deepEqual(rows.map((r) => `${r.type}/${r.channel}`), [], `A7 : aucun avis par événement à la partenaire (${e.eventId})`);
        }
    });

    test('B18 : l’admin ne republie pas l’événement d’une partenaire suspendue (RPC et route : PARTNER_SUSPENDED), le statut reste SUSPENDU', async () => {
        const partner = await newPartner('casc-republie');
        const ev = await createPartnerEvent(partner.partnerId, 'casc-republie', CATEGORY);
        await suspendEvent(ev.eventId);
        assertRpcOk(await partnerStatusRpc(partner.partnerId, 'SUSPENDU', 'Suspension de test du lot 9 bis (republication)'), 'suspension de la partenaire');
        try {
            const call = await rpcTransition(ev.eventId, await superadminId(), 'PUBLIE');
            assert.equal(call.error, null, `event_transition : ${call.error?.message}`);
            assert.equal(call.data?.ok, false, `republication acceptée pendant la suspension de la partenaire : ${JSON.stringify(call.data)}`);
            assert.equal(call.data?.code, 'PARTNER_SUSPENDED', JSON.stringify(call.data));
            assert.equal(await eventStatus(ev.eventId), 'SUSPENDU');

            const handler = await routeHandler(TRANSITION_ROUTE, 'POST', 'POST /api/partner/events/[id]/transition');
            const res = await invoke(handler,
                jsonRequest(`/api/partner/events/${ev.eventId}/transition`, 'POST', await superadminToken(), { to: 'PUBLIE' }),
                paramsContext({ id: ev.eventId }));
            assert.equal(res.status, 409, `route de transition : ${show(res)}`);
            assert.equal(res.body.code, 'PARTNER_SUSPENDED', show(res));
            assert.equal(await eventStatus(ev.eventId), 'SUSPENDU');
        } finally {
            assertRpcOk(await partnerStatusRpc(partner.partnerId, 'VALIDE', 'Réactivation de test du lot 9 bis (republication)'), 'réactivation de la partenaire');
        }
    });
});

// ── Bandeau (statique) ─────────────────────────────────────────────────────

describe('Bandeau de la partenaire suspendue', () => {
    test('app/partner/dashboard/page.tsx : « Compte partenaire suspendu », texte vrai (événements suspendus, fonds gelés), plus « ne sont plus visibles du public »', () => {
        const file = path.resolve(process.cwd(), 'app/partner/dashboard/page.tsx');
        const src = fs.readFileSync(file, 'utf8')
            .replace(/&apos;|&rsquo;|’/g, '\'')
            .replace(/\{' '\}/g, ' ')
            .replace(/\s+/g, ' ');
        assert.ok(src.includes('Compte partenaire suspendu'), 'titre du bandeau');
        // Lot 9 quinquies (B1, modification signalée) : « Contactez le support Event Village » devient un lien vers /aide
        assert.ok(src.includes('Vos événements en ligne sont suspendus et vos fonds sont gelés jusqu\'à la réactivation du compte. <Link href="/aide"')
            && src.includes('>Contactez le support Event Village</Link>.'),
            'texte du bandeau (contrat 5.2, E-B) : « Vos événements en ligne sont suspendus et vos fonds sont gelés jusqu’à la réactivation du compte. Contactez le support Event Village. »');
        assert.ok(!src.includes('ne sont plus visibles du public'), 'ancien texte faux retiré');
    });
});
