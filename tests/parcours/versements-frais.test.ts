/**
 * Lot 9 bis, tâches H7 et H6 — transferts sortants SamirPay v1.2 et frais réels (consigne H6, H7 ; contrat 5.59,
 * 5.60, A5, A6, X2 à X5, B28, B29, B106 ; découvertes 9bis/discovery-9bis-samirpay.md sections 7 et 8,
 * 9bis/discovery-9bis-versements.md section 5). Faux SamirPay de tests/fakes : frais renvoyés au taux
 * cashoutFeeRate (1,5 %, arrondi au centime), modes conflict, insufficient et limits.
 *  H7-a  409 sur le transfert (faux « conflict ») : retrait PROCESSING, versement INCERTAIN, aucun RETRAIT_ANNULE ;
 *  H7-b  400 « Solde insuffisant » (faux « insufficient ») : versement A_ENVOYER bloqué SOLDE_INSUFFISANT, sans
 *        réservation, retrait PROCESSING ; 400 « limites » (faux « limits ») : bloqué LIMITE_COMPTE, motif en français ;
 *  H7-c  annulation par la partenaire, deux remboursements avec frais : deux écritures REGULARISATION de −frais sur
 *        son compte ORGANISATEUR, source CASHOUT_FEE-<versement>, available_at = celui de l'écriture REMBOURSEMENT,
 *        rejeu de cashout_fee_apply sans doublon ;
 *  H7-d  annulation avant l'événement, partenaire sans autres fonds : le disponible ne devient jamais négatif (A6),
 *        les frais vont en écriture ou en créance, jamais perdus ;
 *  H7-e  témoins : annulation par un admin → aucune imputation ; double paiement remboursé → aucune imputation,
 *        samirpay_fees renseigné ;
 *  H7-f  réglages : taux de retrait réglé à 1 %, frais constatés 1,5 % → observed_cashout_fee_rate = 1,5 et
 *        observed_cashout_fee_max (90 jours, X5) ; avertissement de /admin/finance-settings (statique) ;
 *  H6-a  retrait confirmé (frais 225 sur 15 000) : samirpay_fees = 225, samirpay_net_amount = 15 225,
 *        samirpay_ref_operator et samirpay_reference renseignés ;
 *  H6-b  GET /api/admin/finance/reconciliation : frais réels, estimés, écart ; encaissements « non fournis », jamais 0 ;
 *  H6-c  encaissement : payments.samirpay_fees NULL (le Cashin Direct ne renvoie aucun frais).
 *
 * Rouge aujourd'hui : colonnes samirpay_* absentes (M05) ; 400 classé ECHOUE (cashout.service.ts:252-256) ;
 * cashout_fee_apply absente ; routes reconciliation et champs observed_* absents ; texte d'avertissement absent.
 * Vert dès l'écriture (signalé) : H7-a au niveau de la passerelle factice (le faux lève déjà UNCERTAIN : le rouge du
 * 409 est porté par tests/samirpay-contrat.test.ts) ; dans H7-d, « disponible jamais négatif » (rien n'est imputé
 * aujourd'hui) — son garde-fou est l'imputation exigée dans le même cas.
 * after() : assertLot9bisInvariants (garde de schéma rouge jusqu'aux migrations du lot).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { NextRequest } from 'next/server';
import { CashoutService } from '../../lib/payments/cashout.service';
import { signInAs } from '../helpers/fixtures';
import { assertLot9bisInvariants } from '../helpers/lot9bis-invariants';
import { routeContext } from './helpers';
import { authed, type RouteResult } from './acces-helpers';
import { balanceOf, buyConfirmed, createPartnerEvent, jsonRequest, newPartner, withSettings, type TestPartner } from './finance-helpers';
import {
    cart, checkout, deliverWebhook, fakePay, importModule, newBuyer, paymentById, providerSays, service, setFakeMode, type Buyer, type PaymentRow, type SaleEvent,
} from './paiement-helpers';
import { newAdminWith } from './terrain-helpers';
import type { TestAdmin } from './notif-helpers';

type Row = Record<string, unknown>;
type Handler = (req: NextRequest, ctx?: unknown) => Promise<Response>;

const FULL_BALANCE = 10_000_000;
/** Frais SamirPay réels simulés par le faux : 1,5 % (exemple de la v1.2 : 225 F pour 15 000 F). */
const FEE_RATE = 1.5;
const PARTNER_CANCEL_ROUTE = '../../app/api/partner/events/[id]/cancel/route';
const ADMIN_CANCEL_ROUTE = '../../app/api/admin/events/[id]/cancel/route';
const SETTINGS_ROUTE = '../../app/api/admin/finance-settings/route';
const REFUNDS_ROUTE = '../../app/api/admin/refunds/route';
const SETTINGS_PAGE = 'app/admin/finance-settings/page.tsx';
const WITHDRAWAL_RULES = { 'finance.withdrawal_fee_rate': 1, 'finance.withdrawal_min_amount': 5000, 'finance.withdrawal_bank_enabled': false } as const;

let refundAdmin: TestAdmin;

before(async () => {
    setFakeMode('cashoutMode', 'success');
    fakePay().balance = FULL_BALANCE;
    fakePay().cashoutFeeRate = FEE_RATE;
    refundAdmin = await newAdminWith(['refunds.manage', 'payments.read'], { label: 'v9b-frais' });
});

after(async () => {
    setFakeMode('cashoutMode', 'success');
    fakePay().balance = FULL_BALANCE;
    fakePay().cashoutFeeRate = null;
    const { error } = await service.from('users').update({ status: 'SUSPENDU' }).eq('id', refundAdmin.userId).eq('status', 'ACTIF');
    assert.equal(error, null, `administrateur de la suite suspendu : ${error?.message}`);
    await assertLot9bisInvariants('versements-frais');
});

// ── Outils ─────────────────────────────────────────────────────────────────

function show(r: RouteResult): string {
    return `HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 500)}`;
}

const round2 = (x: number): number => Math.round(x * 100) / 100;

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

async function withCashoutMode<T>(mode: string, fn: () => Promise<T>): Promise<T> {
    setFakeMode('cashoutMode', mode);
    try {
        return await fn();
    } finally {
        setFakeMode('cashoutMode', 'success');
    }
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

/** Frais réels enregistrés sur le versement (colonnes samirpay_* de M05, X2). */
async function feesOf(cashoutId: string): Promise<Row> {
    const { data, error } = await service.from('cashouts').select('amount, status, samirpay_fees, samirpay_net_amount, samirpay_ref_operator, samirpay_reference').eq('id', cashoutId).single();
    assert.equal(error, null, `colonnes samirpay_* de cashouts (M05, X2) : ${error?.message}`);
    return data as Row;
}

/** Imputation des frais d'un versement : écriture CASHOUT_FEE-<id> ou créance CASHOUT_FEE-<id>-CREANCE (fin_ledger_debit). */
async function feeBooking(cashoutId: string): Promise<{ entries: Row[]; debts: Row[] }> {
    const key = `CASHOUT_FEE-${cashoutId}`;
    const { data: entries, error } = await service.from('finance_ledger').select('*').eq('source_key', key);
    assert.equal(error, null, `grand livre ${key} : ${error?.message}`);
    const { data: debts, error: dErr } = await service.from('finance_debts').select('*').eq('source_key', `${key}-CREANCE`);
    assert.equal(dErr, null, `créances ${key} : ${dErr?.message}`);
    return { entries: (entries ?? []) as Row[], debts: (debts ?? []) as Row[] };
}

async function titleOf(eventId: string): Promise<string> {
    const { data, error } = await service.from('events').select('title').eq('id', eventId).single();
    assert.equal(error, null, `titre de l’événement : ${error?.message}`);
    return String(data.title);
}

async function cancelByPartner(owner: TestPartner, eventId: string): Promise<void> {
    const { POST } = await importModule(PARTNER_CANCEL_ROUTE);
    const res: Response = await POST(
        jsonRequest(`/api/partner/events/${eventId}/cancel`, 'POST', owner.accessToken, {
            internalReason: 'Test lot 9 bis : annulation', publicNotice: 'Événement annulé : les acheteurs sont remboursés.', confirmTitle: await titleOf(eventId),
        }),
        routeContext({ id: eventId }),
    );
    assert.equal(res.status, 200, `annulation par la partenaire : ${show(await asResult(res))}`);
}

async function cancelByAdmin(eventId: string): Promise<void> {
    const superadmin = await signInAs('SUPERADMIN');
    const { POST } = await importModule(ADMIN_CANCEL_ROUTE);
    const res: Response = await POST(
        jsonRequest(`/api/admin/events/${eventId}/cancel`, 'POST', superadmin.accessToken, {
            internalReason: 'Test lot 9 bis : annulation par l’administration', publicNotice: 'Événement annulé par Event Village.', confirmTitle: await titleOf(eventId),
        }),
        routeContext({ id: eventId }),
    );
    assert.equal(res.status, 200, `annulation par l’administration : ${show(await asResult(res))}`);
}

interface Sale { partner: TestPartner; ev: SaleEvent }

async function partnerSale(label: string, price: number, tickets: number, opts: { otherFunds?: boolean } = {}): Promise<Sale & { payments: string[] }> {
    const partner = await newPartner(`v9b-frais-${label}`);
    if (opts.otherFunds) {
        const other = await createPartnerEvent(partner.partnerId, `v9b frais ${label} autre`, [{ name: 'Standard', price: 10_000, total: 10 }]);
        await buyConfirmed(await newBuyer(`v9b-frais-${label}-autre`), other, [['Standard', 2]]);
    }
    const ev = await createPartnerEvent(partner.partnerId, `v9b frais ${label}`, [{ name: 'Standard', price, total: 20 }]);
    const payments: string[] = [];
    for (let i = 0; i < tickets; i++) payments.push((await buyConfirmed(await newBuyer(`v9b-frais-${label}-${i}`), ev, [['Standard', 1]])).payment.id);
    return { partner, ev, payments };
}

/** Retrait de `gross` F demandé par la RPC (A_ENVOYER), après des ventes disponibles tout de suite. */
async function withdrawal(label: string, gross: number, feeRate: number): Promise<{ partner: TestPartner; withdrawalId: string; cashoutId: string }> {
    const partner = await newPartner(`v9b-frais-ret-${label}`);
    const ev = await createPartnerEvent(partner.partnerId, `v9b frais retrait ${label}`, [{ name: 'Standard', price: 10_000, total: 10 }]);
    const buyer = await newBuyer(`v9b-frais-ret-${label}`);
    await withSettings({ 'finance.payout_hold_enabled': false }, () => buyConfirmed(buyer, ev, [['Standard', 2]]));
    const out = await withSettings({ ...WITHDRAWAL_RULES, 'finance.withdrawal_fee_rate': feeRate }, async () => {
        const { data, error } = await service.rpc('withdrawal_request', {
            p: { user_id: partner.userId, account_kind: 'ORGANISATEUR', gross_amount: gross, method: 'MOBILE_MONEY', operator: 'WAVE', phone_number: partner.phone9, client_key: randomUUID() },
        });
        assert.equal(error, null, `withdrawal_request : ${error?.message}`);
        return (data ?? {}) as Row;
    });
    assert.equal(out.ok, true, `retrait refusé : ${JSON.stringify(out)}`);
    return { partner, withdrawalId: String(out.withdrawal_id), cashoutId: String(out.cashout_id) };
}

async function withdrawalStatus(id: string): Promise<unknown> {
    const { data, error } = await service.from('withdrawals').select('status').eq('id', id).single();
    assert.equal(error, null, `retrait ${id} : ${error?.message}`);
    return data.status;
}

async function refundsList(cashoutId: string): Promise<Row> {
    const { GET } = await importModule(REFUNDS_ROUTE);
    const r = await asResult(await GET(authed('/api/admin/refunds?state=to_retry', 'GET', refundAdmin)));
    assert.equal(r.status, 200, `GET /api/admin/refunds?state=to_retry : ${show(r)}`);
    const item = ((r.body.items ?? []) as Row[]).find((i) => i.id === cashoutId);
    assert.ok(item, `versement ${cashoutId} absent de « Versements à reprendre » : ${show(r)}`);
    return item;
}

/** Double paiement d'un même panier : A annulé, B confirmé, succès tardif de A remboursé (REFUND). */
async function duplicateRefund(label: string): Promise<{ buyer: Buyer; first: PaymentRow }> {
    const partner = await newPartner(`v9b-frais-${label}`);
    const ev = await createPartnerEvent(partner.partnerId, `v9b frais ${label}`, [{ name: 'Standard', price: 2_000, total: 10 }]);
    const buyer = await newBuyer(`v9b-frais-${label}`);
    const r = await checkout(buyer, cart(ev.eventId, [[ev.categories.Standard.id, 1]], buyer));
    assert.equal(r.status, 200, `premier paiement : HTTP ${r.status}`);
    const first = r.payment!;
    const { POST } = await importModule('../../app/api/payments/[transactionId]/cancel/route');
    const cancel: Response = await POST(jsonRequest(`/api/payments/${first.id}/cancel`, 'POST', buyer.accessToken), routeContext({ transactionId: first.id }));
    assert.equal(cancel.status, 200, 'précondition : premier paiement annulé par le client');
    await buyConfirmed(buyer, ev, [['Standard', 1]]);
    providerSays(first, 'SUCCESS');
    assert.equal((await deliverWebhook(first)).status, 200, 'succès tardif du premier paiement');
    const p = await paymentById(first.id);
    assert.ok(p.status === 'REFUND_PENDING' || p.status === 'REFUNDED', `précondition : paiement en double remboursé (${p.status})`);
    return { buyer, first };
}

// ── H7 : transferts sortants ───────────────────────────────────────────────

describe('H7 — transferts sortants : 409 incertain, 400 lisibles, frais imputés selon qui annule', () => {
    test('H7-a : 409 sur le transfert (faux « conflict ») : versement INCERTAIN, retrait PROCESSING, aucun RETRAIT_ANNULE', async () => {
        const w = await withdrawal('conflit', 10_000, 1);
        assert.equal((await withCashoutMode('conflict', () => CashoutService.send(w.cashoutId))).status, 'INCERTAIN', 'transfert interrompu : issue incertaine');
        assert.equal(await withdrawalStatus(w.withdrawalId), 'PROCESSING', 'retrait toujours en cours : le solde n’est pas rendu');
        const { data, error } = await service.from('finance_ledger').select('id').eq('withdrawal_id', w.withdrawalId).eq('entry_type', 'RETRAIT_ANNULE');
        assert.equal(error, null, `grand livre : ${error?.message}`);
        assert.deepEqual(data ?? [], [], 'aucun RETRAIT_ANNULE : jamais de double versement possible');
    });

    test('H7-b : 400 « Solde insuffisant » → bloqué SOLDE_INSUFFISANT sans réservation ; 400 « limites » → bloqué LIMITE_COMPTE, motif en français', async () => {
        const w = await withdrawal('solde', 10_000, 1);
        await withCashoutMode('insufficient', () => CashoutService.send(w.cashoutId));
        const row = await cashoutRow(w.cashoutId);
        assert.deepEqual({ status: row.status, blocked: row.blocked_reason, started: row.send_started_at }, { status: 'A_ENVOYER', blocked: 'SOLDE_INSUFFISANT', started: null },
            `rien n’est débité : blocage repris quand le solde revient (B5 ; aujourd’hui ECHOUE et solde rendu) : ${JSON.stringify({ status: row.status, blocked: row.blocked_reason })}`);
        assert.equal(await withdrawalStatus(w.withdrawalId), 'PROCESSING', 'retrait toujours en cours, montant réservé');

        const l = await withdrawal('limites', 10_000, 1);
        await withCashoutMode('limits', () => CashoutService.send(l.cashoutId));
        const limited = await cashoutRow(l.cashoutId);
        assert.deepEqual({ status: limited.status, blocked: limited.blocked_reason }, { status: 'A_ENVOYER', blocked: 'LIMITE_COMPTE' }, 'montant hors des limites du compte : blocage, « Renvoyer » après vérification (B5)');
        assert.equal((await refundsList(l.cashoutId)).block_label, 'montant hors des limites du compte SamirPay', 'libellé du blocage (contrat 5.1, BLOCK_LABELS)');
    });

    test('H7-c : annulation par la partenaire : une écriture REGULARISATION de −frais par remboursement, datée comme le remboursement, rejeu sans doublon', async () => {
        const s = await partnerSale('partenaire', 5_000, 2, { otherFunds: true });
        await cancelByPartner(s.partner, s.ev.eventId);
        const refunds = (await Promise.all(s.payments.map(cashoutsOfPayment))).flat();
        assert.deepEqual(refunds.map((r) => [r.kind, r.status]), [['EVENT_CANCELLATION_REFUND', 'CONFIRME'], ['EVENT_CANCELLATION_REFUND', 'CONFIRME']], 'précondition : deux remboursements versés');
        for (const r of refunds) {
            const fees = Number((await feesOf(String(r.id))).samirpay_fees);
            assert.equal(fees, round2(Number(r.amount) * FEE_RATE / 100), `frais réels du remboursement ${String(r.id)} enregistrés (H6)`);
            const { entries, debts } = await feeBooking(String(r.id));
            assert.deepEqual(debts, [], 'partenaire avec d’autres fonds : aucune créance');
            assert.equal(entries.length, 1, `une écriture CASHOUT_FEE-${String(r.id)} (B28, X3) : ${JSON.stringify(entries)}`);
            const e = entries[0];
            assert.deepEqual({ owner: e.owner_id, kind: e.account_kind, type: e.entry_type, amount: Number(e.amount), refund: e.refund_id, payment: e.payment_id, event: e.event_id },
                { owner: s.partner.userId, kind: 'ORGANISATEUR', type: 'REGULARISATION', amount: -fees, refund: r.refund_id, payment: r.payment_id, event: s.ev.eventId }, 'imputation à la partenaire qui a annulé');
            const { data: remb, error } = await service.from('finance_ledger').select('available_at').eq('refund_id', String(r.refund_id)).eq('entry_type', 'REMBOURSEMENT').eq('owner_id', s.partner.userId);
            assert.equal(error, null, `écriture REMBOURSEMENT : ${error?.message}`);
            assert.equal((remb ?? []).length, 1, 'précondition : une écriture REMBOURSEMENT pour ce remboursement');
            assert.equal(Date.parse(String(e.available_at)), Date.parse(String(remb![0].available_at)), 'frais datés comme le remboursement, jamais à now() (A6)');
            const { error: replayErr } = await service.rpc('cashout_fee_apply', { p_cashout_id: r.id });
            assert.equal(replayErr, null, `rejeu de cashout_fee_apply (contrat 3.2, M05) : ${replayErr?.message}`);
            assert.equal((await feeBooking(String(r.id))).entries.length, 1, 'rejeu idempotent : aucun doublon');
        }
    });

    test('H7-d : annulation avant l’événement, partenaire sans autres fonds : disponible jamais négatif, frais en écriture ou en créance (A6)', async () => {
        const s = await partnerSale('seule', 5_000, 1);
        await cancelByPartner(s.partner, s.ev.eventId);
        const [refund] = await cashoutsOfPayment(s.payments[0]);
        assert.equal(refund?.status, 'CONFIRME', 'précondition : remboursement versé');
        const fees = Number((await feesOf(String(refund.id))).samirpay_fees);
        assert.ok(fees > 0, `précondition : frais réels connus (${fees})`);
        const { entries, debts } = await feeBooking(String(refund.id));
        const booked = round2(-entries.reduce((t, e) => t + Number(e.amount), 0) + debts.reduce((t, d) => t + Number(d.amount), 0));
        assert.equal(booked, fees, `frais imputés en entier, en écriture ou en créance (B28) : ${JSON.stringify({ entries, debts })}`);
        const b = await balanceOf(s.partner.userId, 'ORGANISATEUR');
        assert.ok(b.available >= 0, `disponible jamais négatif (invariant (e), A6) : ${JSON.stringify(b)}`);
    });

    test('H7-e : témoins : annulation par un admin et double paiement : aucun frais imputé à la partenaire, frais réels enregistrés', async () => {
        const s = await partnerSale('admin', 5_000, 1, { otherFunds: true });
        await cancelByAdmin(s.ev.eventId);
        const [refund] = await cashoutsOfPayment(s.payments[0]);
        assert.equal(refund?.status, 'CONFIRME', 'précondition : remboursement versé');
        assert.equal(Number((await feesOf(String(refund.id))).samirpay_fees), round2(Number(refund.amount) * FEE_RATE / 100), 'frais réels enregistrés (H6)');
        assert.deepEqual(await feeBooking(String(refund.id)), { entries: [], debts: [] }, 'annulation par l’administration : à la charge d’Event Village (X4)');

        const { first } = await duplicateRefund('double');
        const [dup] = await cashoutsOfPayment(first.id);
        assert.deepEqual({ kind: dup?.kind, status: dup?.status }, { kind: 'REFUND', status: 'CONFIRME' }, 'précondition : double paiement remboursé');
        assert.equal(Number((await feesOf(String(dup.id))).samirpay_fees), round2(Number(dup.amount) * FEE_RATE / 100), 'frais réels du remboursement enregistrés');
        assert.deepEqual(await feeBooking(String(dup.id)), { entries: [], debts: [] }, 'double paiement : à la charge d’Event Village (consigne H7)');
    });

    test('H7-f : réglages : taux de retrait à 1 %, frais constatés 1,5 % sur 90 jours → observed_cashout_fee_rate et observed_cashout_fee_max ; avertissement à l’écran', async () => {
        const since = new Date(Date.now() - 90 * 24 * 3600_000).toISOString();
        const { data, error } = await service.from('cashouts').select('amount, samirpay_fees').eq('status', 'CONFIRME').eq('simulated', false).not('samirpay_fees', 'is', null).gte('created_at', since);
        assert.equal(error, null, `colonne cashouts.samirpay_fees (M05) : ${error?.message}`);
        const rows = (data ?? []) as Row[];
        assert.ok(rows.length > 0, 'précondition : frais réels constatés (cas H7-c)');
        const rate = round2(100 * rows.reduce((t, r) => t + Number(r.samirpay_fees), 0) / rows.reduce((t, r) => t + Number(r.amount), 0));
        const max = Math.max(...rows.map((r) => round2(100 * Number(r.samirpay_fees) / Number(r.amount))));
        assert.equal(rate, FEE_RATE, 'précondition : seuls les frais du faux (1,5 %) sont en base');

        const superadmin = await signInAs('SUPERADMIN');
        const { GET } = await importModule(SETTINGS_ROUTE);
        const res = await asResult(await (GET as Handler)(jsonRequest('/api/admin/finance-settings', 'GET', superadmin.accessToken)));
        assert.equal(res.status, 200, show(res));
        const setting = ((res.body.settings ?? []) as Row[]).find((x) => x.key === 'finance.withdrawal_fee_rate');
        assert.equal(Number(setting?.value), 1, 'précondition : frais de retrait réglés à 1 %');
        assert.deepEqual({ rate: res.body.observed_cashout_fee_rate, max: res.body.observed_cashout_fee_max }, { rate, max },
            `taux constatés sur 90 jours (X5 : Σ frais / Σ montants, et maximum par ligne) : ${show(res)}`);

        const source = fs.readFileSync(path.join(process.cwd(), SETTINGS_PAGE), 'utf8').replace(/&apos;|&rsquo;|’/g, "'");
        for (const part of ['Attention : les frais de retrait (', '%) sont inférieurs aux frais SamirPay constatés (', "Chaque retrait coûte alors de l'argent à Event Village.", 'Frais SamirPay réels pas encore constatés.']) {
            assert.ok(source.includes(part), `${SETTINGS_PAGE} : avertissement « ${part} » absent (contrat 5.60)`);
        }
    });
});
