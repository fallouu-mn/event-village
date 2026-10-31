/**
 * Lot 3.6 — soldes et retraits (constats R26, ticketing-finance-8, point ouvert n° 2 du lot 2 ; CDC §83,
 * §105, §153). Contrat : sections A, C et F de la conception du lot 3.
 *  - solde organisateur = Σ des prix faciaux des billets payés EN LIGNE (grand livre, écritures VENTE) ;
 *    une vente espèces ou une invitation n'y ajoute rien ;
 *  - fonds en attente jusqu'à la fin de l'événement + payout_delay_hours (date de début à 23:59,
 *    Africa/Dakar, si la fin manque) ; disponibles dès la confirmation si payout_hold_enabled = false ;
 *  - withdrawal_request : solde réservé atomiquement (deux demandes simultanées → une seule acceptée),
 *    seuil, montant entier, banque désactivée, frais = ceil(brut × taux / 100), cashout WITHDRAWAL-<id>
 *    au montant net, Idempotency-Key ; parrainage : solde distinct, retirable au FCFA inférieur ;
 *  - module commun de cashout : délai dépassé → INCERTAIN, aucun renvoi, solde toujours réservé ;
 *    refus explicite → retrait REJECTED et écriture RETRAIT_ANNULE ;
 *  - routes : POST /api/withdrawals/otp, POST /api/withdrawals/request (session ACTIF, OTP de l'objet
 *    WITHDRAWAL), GET /api/finance/balance — importées dynamiquement (absentes avant le correctif).
 * Chaque test crée son partenaire, son événement et ses acheteurs (grand livre sans historique).
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { CashoutService } from '../../lib/payments/cashout.service';
import { getFakes } from '../fakes';
import { assertFinanceInvariants } from '../helpers/finance-invariants';
import { randomSenegalPhone } from './helpers';
import { callsOf, fakePay, importModule, newBuyer, service, setFakeMode, type Buyer, type SaleEvent } from './paiement-helpers';
import {
    balanceOf, buyConfirmed, cashoutsByKey, createPartnerEvent, jsonRequest, ledgerOf, newPartner, round2, withSettings,
    type AccountKind, type FinanceSettingKey, type Purchase, type TestPartner,
} from './finance-helpers';

const ZERO_UUID = '00000000-0000-0000-0000-000000000000';
const HOUR = 3600_000;

after(async () => {
    setFakeMode('cashoutMode', 'success');
    fakePay().balance = 10_000_000;
    await assertFinanceInvariants('finance-retraits');
});

// ── Réglages des retraits (valeurs du contrat, restaurées après chaque test) ──

const WITHDRAWAL_RULES: Partial<Record<FinanceSettingKey, unknown>> = {
    'finance.withdrawal_fee_rate': 1,
    'finance.withdrawal_min_amount': 5000,
    'finance.withdrawal_bank_enabled': false,
};

function withWithdrawalRules<T>(fn: () => Promise<T>, extra: Partial<Record<FinanceSettingKey, unknown>> = {}): Promise<T> {
    return withSettings({ ...WITHDRAWAL_RULES, ...extra }, fn);
}

// ── Partenaire approvisionné ───────────────────────────────────────────────

interface Funded {
    partner: TestPartner;
    ev: SaleEvent;
    purchase: Purchase;
}

/** Partenaire neuf dont une vente en ligne (sans délai de garde) est immédiatement disponible. */
async function fundedPartner(label: string, price = 10_000): Promise<Funded> {
    const partner = await newPartner(label);
    const ev = await createPartnerEvent(partner.partnerId, label, [{ name: 'Standard', price, total: 20 }]);
    const buyer = await newBuyer(`${label}-ach`);
    const purchase = await withSettings({ 'finance.payout_hold_enabled': false }, () => buyConfirmed(buyer, ev, [['Standard', 1]]));
    const b = await balanceOf(partner.userId, 'ORGANISATEUR');
    assert.equal(b.available, price, `fonds disponibles du partenaire de test : ${JSON.stringify(b)}`);
    return { partner, ev, purchase };
}

/** Vente hors plateforme (espèces, invitation) d'un billet de la catégorie Standard, payée au guichet. */
async function offlineSale(partner: TestPartner, ev: SaleEvent, holder: Buyer, opts: { label: string; amount: number; payout: number; method: 'ESPECES' | 'AUTRE' }): Promise<{ paymentId: string; ticketId: string }> {
    const s = randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();
    const { data: pay, error } = await service.from('payments').insert({
        transaction_id: `TX-HORS-${s}`,
        client_id: holder.userId,
        partner_id: partner.partnerId,
        payment_target: 'TICKET',
        amount: opts.amount,
        currency: 'XOF',
        is_platform_payment: false,
        offline_payment_method: opts.method,
        aggregator: 'GUICHET_PHYSIQUE',
        // Ancien guichet : reversement = prix facial même hors plateforme (ticketing-finance-7)
        partner_payout_amount: opts.payout,
        status: 'PENDING',
        metadata: { event_id: ev.eventId, test: opts.label },
    }).select('id').single();
    assert.equal(error, null, `paiement ${opts.label} : ${error?.message}`);
    const { error: upErr } = await service.from('payments').update({ status: 'SUCCESS', paid_at: new Date().toISOString() }).eq('id', pay.id);
    assert.equal(upErr, null, `confirmation ${opts.label} : ${upErr?.message}`);
    const cat = ev.categories.Standard;
    const { data: ticket, error: tErr } = await service.from('tickets').insert({
        event_id: ev.eventId, category_id: cat.id, user_id: holder.userId, ticket_number: `TCK-HORS-${s}`,
        qr_code: `EV-QR-HORS-${s}`, price: cat.price, status: 'VALIDE', payment_id: pay.id,
    }).select('id').single();
    assert.equal(tErr, null, `billet ${opts.label} : ${tErr?.message}`);
    return { paymentId: pay.id as string, ticketId: ticket.id as string };
}

// ── Retraits : RPC, routes, lectures ───────────────────────────────────────

interface RpcWithdrawal {
    ok?: boolean;
    code?: string;
    withdrawal_id?: string;
    cashout_id?: string;
    gross_amount?: number;
    fee_amount?: number;
    net_amount?: number;
}

async function rpcWithdraw(user: Buyer, o: { account: AccountKind; gross: number; method?: 'MOBILE_MONEY' | 'BANK'; operator?: 'WAVE' | 'ORANGE_MONEY'; phone?: string; key?: string }): Promise<RpcWithdrawal> {
    const { data, error } = await service.rpc('withdrawal_request', {
        p: {
            user_id: user.userId,
            account_kind: o.account,
            gross_amount: o.gross,
            method: o.method ?? 'MOBILE_MONEY',
            operator: o.operator ?? 'WAVE',
            phone_number: o.phone ?? user.phone9,
            client_key: o.key ?? randomUUID(),
        },
    });
    assert.equal(error, null, `withdrawal_request : ${error?.message}`);
    return (data ?? {}) as RpcWithdrawal;
}

async function withdrawalsOf(userId: string): Promise<Array<Record<string, unknown>>> {
    const { data, error } = await service.from('withdrawals').select('*').eq('user_id', userId).order('created_at');
    assert.equal(error, null, `retraits de ${userId} : ${error?.message}`);
    return (data ?? []) as Array<Record<string, unknown>>;
}

async function withdrawalById(id: string): Promise<Record<string, unknown>> {
    const { data, error } = await service.from('withdrawals').select('*').eq('id', id).single();
    assert.equal(error, null, `retrait ${id} : ${error?.message}`);
    return data as Record<string, unknown>;
}

function smsCodes(phoneE164: string): string[] {
    return getFakes().sms.messagesTo(phoneE164)
        .map((m) => m.message.match(/\b(\d{6})\b/)?.[1])
        .filter((c): c is string => Boolean(c));
}

/** POST /api/withdrawals/otp : code WITHDRAWAL envoyé au téléphone du compte, lu dans le faux MTarget. */
async function withdrawalOtp(user: Buyer, account: AccountKind): Promise<string> {
    const { POST } = await importModule('../../app/api/withdrawals/otp/route');
    const before = smsCodes(user.phoneE164).length;
    const res: Response = await POST(jsonRequest('/api/withdrawals/otp', 'POST', user.accessToken, { account }));
    const body = await res.json();
    assert.equal(res.status, 200, `envoi du code de retrait : HTTP ${res.status} ${JSON.stringify(body)}`);
    const codes = smsCodes(user.phoneE164);
    assert.ok(codes.length > before, 'un code de retrait doit être envoyé par SMS au téléphone du compte');
    return codes[codes.length - 1];
}

interface WithdrawalBody {
    account: AccountKind;
    amount: number;
    method?: 'MOBILE_MONEY' | 'BANK';
    operator?: 'WAVE' | 'ORANGE_MONEY';
    phoneNumber: string;
    otpCode: string;
}

async function postWithdrawal(user: Buyer, body: WithdrawalBody, key: string = randomUUID()): Promise<{ status: number; body: Record<string, unknown> }> {
    const { POST } = await importModule('../../app/api/withdrawals/request/route');
    const res: Response = await POST(jsonRequest('/api/withdrawals/request', 'POST', user.accessToken, { method: 'MOBILE_MONEY', operator: 'WAVE', ...body }, { 'idempotency-key': key }));
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

/** Parcours complet : code WITHDRAWAL, puis demande de retrait par la route. */
async function withdrawByRoute(user: Buyer, o: { account: AccountKind; amount: number; operator?: 'WAVE' | 'ORANGE_MONEY'; phoneNumber?: string }, key?: string): Promise<{ status: number; body: Record<string, unknown> }> {
    const otpCode = await withdrawalOtp(user, o.account);
    return postWithdrawal(user, { account: o.account, amount: o.amount, operator: o.operator ?? 'WAVE', phoneNumber: o.phoneNumber ?? user.phone9, otpCode }, key);
}

function entries(ledger: Array<Record<string, unknown>>, type: string): Array<Record<string, unknown>> {
    return ledger.filter((e) => e.entry_type === type);
}

// ── Parrainage ─────────────────────────────────────────────────────────────

async function linkReferral(sponsorId: string, referredId: string): Promise<void> {
    const { error } = await service.from('referral_relationships').insert({
        sponsor_id: sponsorId,
        referred_id: referredId,
        referral_type: 'CLIENT_TO_CLIENT',
        sponsor_status_at_creation: 'STANDARD',
        rate_n1_at_creation: 5,
        rate_n2_at_creation: 2,
        duration_months: 12,
        expires_at: new Date(Date.now() + 365 * 24 * HOUR).toISOString(),
        is_active: true,
    });
    assert.equal(error, null, `relation de parrainage : ${error?.message}`);
}

/** Simule l'écoulement du délai de disponibilité (§102) puis lance la libération des commissions. */
async function makeCommissionAvailable(commissionId: string): Promise<void> {
    const past = new Date(Date.now() - 60_000).toISOString();
    const { error: cErr } = await service.from('referral_commissions').update({ available_at: past }).eq('id', commissionId);
    assert.equal(cErr, null, `échéance de la commission : ${cErr?.message}`);
    const { error: lErr } = await service.from('finance_ledger').update({ available_at: past }).eq('commission_id', commissionId);
    assert.equal(lErr, null, `échéance de l'écriture COMMISSION : ${lErr?.message}`);
    const { error } = await service.rpc('referral_commissions_release');
    assert.equal(error, null, `referral_commissions_release : ${error?.message}`);
}

describe('Lot 3.6 — soldes et retraits', () => {
    test('solde organisateur : prix faciaux des billets payés en ligne seulement ; vente espèces et invitation n’ajoutent rien', async () => {
        const partner = await newPartner('solde');
        const ev = await createPartnerEvent(partner.partnerId, 'solde', [{ name: 'Standard', price: 10_000, total: 20 }]);
        const buyer = await newBuyer('solde-ach');
        const online = await buyConfirmed(buyer, ev, [['Standard', 2]]);
        const cash = await offlineSale(partner, ev, buyer, { label: 'especes', amount: 10_000, payout: 10_000, method: 'ESPECES' });
        const invitation = await offlineSale(partner, ev, buyer, { label: 'invitation', amount: 0, payout: 0, method: 'AUTRE' });

        const b = await balanceOf(partner.userId, 'ORGANISATEUR');
        assert.equal(b.available + b.pending, 20_000, `solde organisateur = 2 × 10 000 F payés en ligne : ${JSON.stringify(b)}`);
        const ledger = await ledgerOf(partner.userId, 'ORGANISATEUR');
        assert.deepEqual(
            ledger.map((e) => [e.entry_type, Number(e.amount), e.payment_id]),
            [['VENTE', 20_000, online.payment.id]],
            'une seule écriture VENTE, celle du paiement en ligne (reversement = prix facial)'
        );
        const { data: offline, error } = await service.from('finance_ledger').select('id, entry_type, payment_id').in('payment_id', [cash.paymentId, invitation.paymentId]);
        assert.equal(error, null, `grand livre hors plateforme : ${error?.message}`);
        assert.deepEqual(offline ?? [], [], 'aucune écriture pour une vente espèces ou une invitation');
    });

    test('fonds en attente jusqu’à la fin de l’événement + 48 h ; disponibles dès la confirmation si payout_hold_enabled = false (non rétroactif)', async () => {
        const partner = await newPartner('delai');
        const ev = await createPartnerEvent(partner.partnerId, 'delai', [{ name: 'Standard', price: 10_000, total: 20 }]);
        const { data: evRow, error: evErr } = await service.from('events').select('end_date, end_time').eq('id', ev.eventId).single();
        assert.equal(evErr, null, `événement : ${evErr?.message}`);
        // Africa/Dakar = UTC+0 toute l'année
        const expected = Date.parse(`${evRow.end_date}T${evRow.end_time}Z`) + 48 * HOUR;

        const buyer1 = await newBuyer('delai-ach1');
        const buyer2 = await newBuyer('delai-ach2');
        await withSettings({ 'finance.payout_hold_enabled': true, 'finance.payout_delay_hours': 48 }, () => buyConfirmed(buyer1, ev, [['Standard', 2]]));
        let b = await balanceOf(partner.userId, 'ORGANISATEUR');
        assert.equal(b.available, 0, `rien de disponible avant la fin de l'événement : ${JSON.stringify(b)}`);
        assert.equal(b.pending, 20_000, `20 000 F en attente : ${JSON.stringify(b)}`);
        assert.ok(b.next_available_at, 'date de disponibilité renseignée');
        assert.ok(Math.abs(Date.parse(b.next_available_at!) - expected) <= 60_000,
            `disponible à la fin de l'événement + 48 h (${new Date(expected).toISOString()}), obtenu ${b.next_available_at}`);

        const early = await withWithdrawalRules(() => rpcWithdraw(partner, { account: 'ORGANISATEUR', gross: 5_000 }));
        assert.equal(early.code, 'INSUFFICIENT_BALANCE', `les fonds en attente ne sont pas retirables : ${JSON.stringify(early)}`);

        await withSettings({ 'finance.payout_hold_enabled': false }, () => buyConfirmed(buyer2, ev, [['Standard', 1]]));
        b = await balanceOf(partner.userId, 'ORGANISATEUR');
        assert.equal(b.available, 10_000, `vente sans délai de garde disponible dès la confirmation : ${JSON.stringify(b)}`);
        assert.equal(b.pending, 20_000, `la première vente reste en attente (réglage non rétroactif) : ${JSON.stringify(b)}`);
    });

    test('date de fin absente : date de début à 23:59 (Africa/Dakar) + 48 h', async () => {
        const partner = await newPartner('sansfin');
        const ev = await createPartnerEvent(partner.partnerId, 'sansfin', [{ name: 'Standard', price: 8_000, total: 10 }]);
        const { error: upErr } = await service.from('events').update({ end_date: null, end_time: null }).eq('id', ev.eventId);
        assert.equal(upErr, null, `suppression de la date de fin : ${upErr?.message}`);
        const { data: evRow } = await service.from('events').select('start_date').eq('id', ev.eventId).single();
        const expected = Date.parse(`${evRow!.start_date}T23:59:00Z`) + 48 * HOUR;
        const buyer = await newBuyer('sansfin-ach');
        await withSettings({ 'finance.payout_hold_enabled': true, 'finance.payout_delay_hours': 48 }, () => buyConfirmed(buyer, ev, [['Standard', 1]]));
        const b = await balanceOf(partner.userId, 'ORGANISATEUR');
        assert.equal(b.available, 0, JSON.stringify(b));
        assert.equal(b.pending, 8_000, JSON.stringify(b));
        assert.ok(b.next_available_at && Math.abs(Date.parse(b.next_available_at) - expected) <= 60_000,
            `disponible le ${new Date(expected).toISOString()} (début 23:59 + 48 h), obtenu ${b.next_available_at}`);
    });

    test('deux retraits simultanés qui dépassent ensemble le solde : un seul accepté', async () => {
        const { partner } = await fundedPartner('concurrence');
        const results = await withWithdrawalRules(() => Promise.all([
            rpcWithdraw(partner, { account: 'ORGANISATEUR', gross: 6_000 }),
            rpcWithdraw(partner, { account: 'ORGANISATEUR', gross: 6_000 }),
        ]));
        const accepted = results.filter((r) => r.ok === true);
        const refused = results.filter((r) => r.ok !== true);
        assert.equal(accepted.length, 1, `une seule demande acceptée : ${JSON.stringify(results)}`);
        assert.equal(refused[0]?.code, 'INSUFFICIENT_BALANCE', JSON.stringify(results));
        assert.equal((await withdrawalsOf(partner.userId)).length, 1, 'un seul retrait créé');
        const b = await balanceOf(partner.userId, 'ORGANISATEUR');
        assert.equal(b.available, 4_000, `10 000 − 6 000 réservés : ${JSON.stringify(b)}`);
        assert.deepEqual(entries(await ledgerOf(partner.userId, 'ORGANISATEUR'), 'RETRAIT').map((e) => Number(e.amount)), [-6_000]);
    });

    test('montants et comptes refusés : BELOW_MINIMUM (seuil 5 000 F), INVALID_AMOUNT, INSUFFICIENT_BALANCE, NOT_PARTNER', async () => {
        const { partner } = await fundedPartner('refus');
        const client = await newBuyer('refus-client');
        await withWithdrawalRules(async () => {
            assert.equal((await rpcWithdraw(partner, { account: 'ORGANISATEUR', gross: 4_999 })).code, 'BELOW_MINIMUM', 'sous le seuil de 5 000 F');
            assert.equal((await rpcWithdraw(partner, { account: 'ORGANISATEUR', gross: 5_000.5 })).code, 'INVALID_AMOUNT', 'montant non entier');
            assert.equal((await rpcWithdraw(partner, { account: 'ORGANISATEUR', gross: 0 })).code, 'INVALID_AMOUNT', 'montant nul');
            assert.equal((await rpcWithdraw(partner, { account: 'ORGANISATEUR', gross: 10_001 })).code, 'INSUFFICIENT_BALANCE', 'au-delà du disponible');
            assert.equal((await rpcWithdraw(client, { account: 'ORGANISATEUR', gross: 5_000 })).code, 'NOT_PARTNER', 'compte organisateur d’un non-partenaire');
        });
        assert.equal((await withdrawalsOf(partner.userId)).length, 0, 'aucun retrait créé');
        assert.equal((await withdrawalsOf(client.userId)).length, 0, 'aucun retrait créé');
        assert.equal((await balanceOf(partner.userId, 'ORGANISATEUR')).available, 10_000, 'solde inchangé');
    });

    test('virement bancaire refusé tant que finance.withdrawal_bank_enabled est désactivé (BANK_DISABLED)', async () => {
        const { partner } = await fundedPartner('banque');
        const out = await withWithdrawalRules(() => rpcWithdraw(partner, { account: 'ORGANISATEUR', gross: 5_000, method: 'BANK' }));
        assert.equal(out.ok, false, JSON.stringify(out));
        assert.equal(out.code, 'BANK_DISABLED', JSON.stringify(out));
        assert.equal((await withdrawalsOf(partner.userId)).length, 0);
        assert.equal((await balanceOf(partner.userId, 'ORGANISATEUR')).available, 10_000);
    });

    test('frais de 1 % arrondis au FCFA supérieur ; cashout WITHDRAWAL-<id> au montant net, vers le numéro déclaré', async () => {
        const { partner } = await fundedPartner('frais');
        const declared = randomSenegalPhone('78').slice(4);
        const before0 = callsOf('sendCashout').length;
        const res = await withWithdrawalRules(() => withdrawByRoute(partner, { account: 'ORGANISATEUR', amount: 5_050, operator: 'ORANGE_MONEY', phoneNumber: declared }));
        assert.equal(res.status, 200, `demande de retrait : HTTP ${res.status} ${JSON.stringify(res.body)}`);

        const rows = await withdrawalsOf(partner.userId);
        assert.equal(rows.length, 1, 'un retrait');
        const w = rows[0];
        assert.equal(Number(w.gross_amount), 5_050);
        assert.equal(Number(w.fee_amount), 51, 'ceil(5 050 × 1 %) = 51');
        assert.equal(Number(w.net_amount), 4_999);
        assert.equal(w.account_kind, 'ORGANISATEUR');
        assert.equal(w.operator, 'ORANGE_MONEY');
        assert.equal(w.phone_number, declared);
        assert.ok(w.otp_verified_at, 'OTP de retrait vérifié et horodaté');

        const cashouts = await cashoutsByKey(`WITHDRAWAL-${w.id}`);
        assert.equal(cashouts.length, 1, 'un cashout, clé WITHDRAWAL-<id>');
        const c = cashouts[0];
        assert.equal(c.kind, 'WITHDRAWAL');
        assert.equal(Number(c.amount), 4_999, 'montant net');
        assert.equal(c.withdrawal_id, w.id);
        assert.equal(w.cashout_id, c.id);
        assert.equal(c.operator, 'ORANGE_MONEY');
        assert.equal(c.phone_number, declared);
        assert.equal(c.first_name, partner.firstName);
        assert.equal(c.last_name, partner.lastName);

        const sent = callsOf('sendCashout').slice(before0);
        assert.equal(sent.length, 1, 'un seul envoi SamirPay');
        assert.equal(Number(sent[0].args.amount), 4_999);
        assert.equal(sent[0].args.phoneNumber, declared);
        assert.equal(sent[0].args.operatorName, 'ORANGE_MONEY');

        assert.equal((await cashoutsByKey(`WITHDRAWAL-${w.id}`))[0].status, 'CONFIRME');
        assert.equal((await withdrawalById(String(w.id))).status, 'PAID');
        assert.deepEqual(entries(await ledgerOf(partner.userId, 'ORGANISATEUR'), 'RETRAIT').map((e) => [Number(e.amount), e.withdrawal_id]), [[-5_050, w.id]]);
        const b = await balanceOf(partner.userId, 'ORGANISATEUR');
        assert.equal(b.available, 4_950, JSON.stringify(b));
        assert.equal(b.in_progress, 0, JSON.stringify(b));
    });

    test('délai dépassé après envoi : cashout INCERTAIN, aucun second envoi, retrait non REJECTED, solde toujours réservé', async () => {
        const { partner } = await fundedPartner('incertain');
        const before0 = callsOf('sendCashout').length;
        setFakeMode('cashoutMode', 'timeout-after-send');
        try {
            await withWithdrawalRules(() => withdrawByRoute(partner, { account: 'ORGANISATEUR', amount: 6_000 }));
        } finally {
            setFakeMode('cashoutMode', 'success');
        }
        const rows = await withdrawalsOf(partner.userId);
        assert.equal(rows.length, 1, 'un retrait');
        const w = rows[0];
        const [c] = await cashoutsByKey(`WITHDRAWAL-${w.id}`);
        assert.ok(c, 'cashout WITHDRAWAL-<id>');
        assert.equal(c.status, 'INCERTAIN');

        await CashoutService.send(String(c.id));
        await CashoutService.confirmSent(200);
        assert.equal(callsOf('sendCashout').length - before0, 1, 'aucun renvoi automatique');

        const again = await withdrawalById(String(w.id));
        assert.notEqual(again.status, 'REJECTED', 'un envoi possiblement effectué ne libère jamais le solde');
        assert.equal(again.status, 'PROCESSING');
        const ledger = await ledgerOf(partner.userId, 'ORGANISATEUR');
        assert.deepEqual(entries(ledger, 'RETRAIT').map((e) => Number(e.amount)), [-6_000]);
        assert.deepEqual(entries(ledger, 'RETRAIT_ANNULE'), [], 'aucune annulation');
        const b = await balanceOf(partner.userId, 'ORGANISATEUR');
        assert.equal(b.available, 4_000, `solde réservé : ${JSON.stringify(b)}`);
        assert.equal(b.in_progress, 5_940, `retrait en cours au montant net (6 000 − 60) : ${JSON.stringify(b)}`);
    });

    test('refus explicite de SamirPay : retrait REJECTED, écriture RETRAIT_ANNULE, solde rendu', async () => {
        const { partner } = await fundedPartner('refuse');
        const before0 = callsOf('sendCashout').length;
        setFakeMode('cashoutMode', 'rejected');
        try {
            await withWithdrawalRules(() => withdrawByRoute(partner, { account: 'ORGANISATEUR', amount: 6_000 }));
        } finally {
            setFakeMode('cashoutMode', 'success');
        }
        assert.equal(callsOf('sendCashout').length - before0, 1, 'un envoi, refusé');
        const rows = await withdrawalsOf(partner.userId);
        assert.equal(rows.length, 1);
        const w = rows[0];
        assert.equal(w.status, 'REJECTED');
        const [c] = await cashoutsByKey(`WITHDRAWAL-${w.id}`);
        assert.equal(c?.status, 'ECHOUE');
        const ledger = await ledgerOf(partner.userId, 'ORGANISATEUR');
        assert.deepEqual(entries(ledger, 'RETRAIT').map((e) => [Number(e.amount), e.withdrawal_id]), [[-6_000, w.id]]);
        assert.deepEqual(entries(ledger, 'RETRAIT_ANNULE').map((e) => [Number(e.amount), e.withdrawal_id]), [[6_000, w.id]]);
        const b = await balanceOf(partner.userId, 'ORGANISATEUR');
        assert.equal(b.available, 10_000, `solde rendu : ${JSON.stringify(b)}`);
        assert.equal(b.in_progress, 0, JSON.stringify(b));
    });

    test('solde de parrainage distinct du solde organisateur ; retirable au FCFA inférieur ; commissions allouées', async () => {
        const sponsor = await newPartner('parrain');
        const ev = await createPartnerEvent(sponsor.partnerId, 'parrain', [{ name: 'Standard', price: 100_000, total: 5 }]);
        const filleul = await newBuyer('filleul');
        await linkReferral(sponsor.userId, filleul.userId);
        const purchase = await withSettings({ 'finance.payout_hold_enabled': false }, () => buyConfirmed(filleul, ev, [['Standard', 1]]));

        const { data: comms, error } = await service.from('referral_commissions').select('*')
            .eq('payment_id', purchase.payment.id).eq('sponsor_id', sponsor.userId).eq('generation', 'N1');
        assert.equal(error, null, `commission : ${error?.message}`);
        const commission = (comms ?? []).find((c) => (c.kind ?? 'COMMISSION') === 'COMMISSION');
        assert.ok(commission, 'commission N1 du parrain');
        assert.equal(commission.status, 'PENDING', 'commission en attente à sa création (§102)');
        const amount = Number(commission.amount);
        const retirable = Math.floor(amount);
        assert.ok(retirable >= 2, `commission suffisante pour le test (${amount})`);

        assert.equal((await balanceOf(sponsor.userId, 'PARRAINAGE')).available, 0, 'commission non disponible avant le délai');
        await makeCommissionAvailable(String(commission.id));
        assert.equal((await balanceOf(sponsor.userId, 'PARRAINAGE')).available, amount, 'commission disponible après le délai');
        assert.equal((await balanceOf(sponsor.userId, 'ORGANISATEUR')).available, 100_000, 'vente disponible sur le compte organisateur');

        const fee = Math.ceil(retirable / 100);
        await withWithdrawalRules(async () => {
            const over = await rpcWithdraw(sponsor, { account: 'PARRAINAGE', gross: retirable + 1 });
            assert.equal(over.code, 'INSUFFICIENT_BALANCE', `parrainage : au plus ${retirable} F retirables (solde ${amount}), sans puiser dans le compte organisateur : ${JSON.stringify(over)}`);
            const ok = await rpcWithdraw(sponsor, { account: 'PARRAINAGE', gross: retirable });
            assert.equal(ok.ok, true, `retrait de parrainage de ${retirable} F : ${JSON.stringify(ok)}`);
            assert.equal(Number(ok.fee_amount), fee, 'frais = ceil(1 %)');
            assert.equal(Number(ok.net_amount), retirable - fee);
            const w = await withdrawalById(String(ok.withdrawal_id));
            assert.equal(w.account_kind, 'PARRAINAGE');
            const { data: payouts, error: pErr } = await service.from('referral_commission_payouts').select('commission_id, withdrawal_id, amount').eq('withdrawal_id', ok.withdrawal_id);
            assert.equal(pErr, null, `allocation des commissions : ${pErr?.message}`);
            assert.deepEqual((payouts ?? []).map((p) => [p.commission_id, Number(p.amount)]), [[commission.id, retirable]], 'allocation FIFO de la commission');
        }, { 'finance.withdrawal_min_amount': 0 });

        const { data: after1 } = await service.from('referral_commissions').select('status, paid_amount').eq('id', commission.id).single();
        assert.equal(Number(after1?.paid_amount), retirable);
        if (amount > retirable) assert.notEqual(after1?.status, 'PAID', 'commission partiellement couverte : pas encore PAID');
        assert.equal((await balanceOf(sponsor.userId, 'PARRAINAGE')).available, round2(amount - retirable), 'reliquat de parrainage');
        assert.equal((await balanceOf(sponsor.userId, 'ORGANISATEUR')).available, 100_000, 'compte organisateur intact');
    });

    test('compte SUSPENDU : retrait, code de retrait et solde refusés (ACCOUNT_NOT_ACTIVE)', async () => {
        const { partner } = await fundedPartner('suspendu');
        const { error } = await service.from('users').update({ status: 'SUSPENDU' }).eq('id', partner.userId);
        assert.equal(error, null, `suspension : ${error?.message}`);
        const sms0 = smsCodes(partner.phoneE164).length;

        const req = await postWithdrawal(partner, { account: 'ORGANISATEUR', amount: 5_000, phoneNumber: partner.phone9, otpCode: '123456' });
        assert.equal(req.status, 403, `retrait d'un compte SUSPENDU : HTTP ${req.status} ${JSON.stringify(req.body)}`);
        assert.equal(req.body.code, 'ACCOUNT_NOT_ACTIVE');

        const { POST: otpRoute } = await importModule('../../app/api/withdrawals/otp/route');
        const otp: Response = await otpRoute(jsonRequest('/api/withdrawals/otp', 'POST', partner.accessToken, { account: 'ORGANISATEUR' }));
        const otpBody = await otp.json();
        assert.equal(otp.status, 403, JSON.stringify(otpBody));
        assert.equal(otpBody.code, 'ACCOUNT_NOT_ACTIVE');
        assert.equal(smsCodes(partner.phoneE164).length, sms0, 'aucun code envoyé');

        const { GET: balanceRoute } = await importModule('../../app/api/finance/balance/route');
        const bal: Response = await balanceRoute(jsonRequest('/api/finance/balance?account=ORGANISATEUR', 'GET', partner.accessToken));
        assert.equal(bal.status, 403);

        assert.equal((await withdrawalsOf(partner.userId)).length, 0, 'aucun retrait créé');
    });

    test('Idempotency-Key : même clé → même retrait, un seul cashout, un seul envoi ; RPC : DUPLICATE avant le contrôle du solde', async () => {
        const { partner } = await fundedPartner('idem');
        const key = randomUUID();
        const before0 = callsOf('sendCashout').length;
        await withWithdrawalRules(async () => {
            const first = await withdrawByRoute(partner, { account: 'ORGANISATEUR', amount: 5_000 }, key);
            assert.equal(first.status, 200, `première demande : HTTP ${first.status} ${JSON.stringify(first.body)}`);
            const replay = await withdrawByRoute(partner, { account: 'ORGANISATEUR', amount: 5_000 }, key);
            assert.ok(replay.status < 300, `rejeu de la même demande : HTTP ${replay.status} ${JSON.stringify(replay.body)}`);
        });
        const rows = await withdrawalsOf(partner.userId);
        assert.equal(rows.length, 1, 'un seul retrait pour la même clé');
        assert.equal(rows[0].client_idempotency_key, key);
        assert.equal((await cashoutsByKey(`WITHDRAWAL-${rows[0].id}`)).length, 1);
        assert.equal(callsOf('sendCashout').length - before0, 1, 'un seul envoi');
        assert.equal((await balanceOf(partner.userId, 'ORGANISATEUR')).available, 5_000);

        const k2 = randomUUID();
        await withWithdrawalRules(async () => {
            const a = await rpcWithdraw(partner, { account: 'ORGANISATEUR', gross: 5_000, key: k2 });
            assert.equal(a.ok, true, JSON.stringify(a));
            const b = await rpcWithdraw(partner, { account: 'ORGANISATEUR', gross: 5_000, key: k2 });
            assert.equal(b.code, 'DUPLICATE', `même clé : DUPLICATE (et non INSUFFICIENT_BALANCE) : ${JSON.stringify(b)}`);
            if (b.withdrawal_id) assert.equal(b.withdrawal_id, a.withdrawal_id);
        });
        const { data: dup, error } = await service.from('withdrawals').select('id').eq('user_id', partner.userId).eq('client_idempotency_key', k2);
        assert.equal(error, null, error?.message);
        assert.equal(dup?.length, 1);
    });

    test('GET /api/finance/balance : disponible, en attente, retraits en cours et historique ; 401 sans session', async () => {
        const { partner, purchase } = await fundedPartner('route-solde');
        const { GET } = await importModule('../../app/api/finance/balance/route');
        const res: Response = await GET(jsonRequest('/api/finance/balance?account=ORGANISATEUR', 'GET', partner.accessToken));
        const body = (await res.json()) as Record<string, unknown>;
        assert.equal(res.status, 200, `solde organisateur : HTTP ${res.status} ${JSON.stringify(body)}`);
        const b = await balanceOf(partner.userId, 'ORGANISATEUR');
        assert.equal(Number(body.available), b.available);
        assert.equal(Number(body.pending), b.pending);
        assert.equal(Number(body.in_progress ?? 0), b.in_progress);
        assert.ok('next_available_at' in body, 'date de prochaine disponibilité exposée');
        assert.ok(Array.isArray(body.history), 'historique');
        const history = body.history as Array<Record<string, unknown>>;
        assert.ok(history.some((e) => e.entry_type === 'VENTE' && Number(e.amount) === 10_000 && (e.payment_id === undefined || e.payment_id === purchase.payment.id)),
            `écriture VENTE dans l'historique : ${JSON.stringify(history)}`);

        const parr: Response = await GET(jsonRequest('/api/finance/balance?account=PARRAINAGE', 'GET', partner.accessToken));
        const parrBody = (await parr.json()) as Record<string, unknown>;
        assert.equal(parr.status, 200, JSON.stringify(parrBody));
        assert.equal(Number(parrBody.available), 0, 'compte de parrainage distinct, vide');
        assert.equal(Number(parrBody.pending), 0);

        const anon: Response = await GET(jsonRequest('/api/finance/balance?account=ORGANISATEUR', 'GET', null));
        assert.equal(anon.status, 401);
    });

    test('contrôle statique : plus d’envoi d’argent hors du module de cashout, plus de request_withdrawal', () => {
        const file = path.resolve(process.cwd(), 'lib/payments/withdrawal.service.ts');
        if (fs.existsSync(file)) {
            assert.ok(!/\.sendCashout\(/.test(fs.readFileSync(file, 'utf8')), 'withdrawal.service.ts ne doit plus appeler sendCashout directement');
        }
        const offenders: string[] = [];
        const walk = (dir: string) => {
            for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
                const full = path.join(dir, e.name);
                const rel = full.replace(/\\/g, '/');
                if (e.isDirectory()) { walk(full); continue; }
                if (!/\.(ts|tsx)$/.test(e.name)) continue;
                const src = fs.readFileSync(full, 'utf8');
                if (/\.sendCashout\(/.test(src) && rel !== 'lib/payments/cashout.service.ts' && !rel.startsWith('lib/samirpay/') && !rel.startsWith('lib/integrations/')) {
                    offenders.push(`${rel} : envoi d'argent hors du module`);
                }
                if (/rpc\(\s*['"]request_withdrawal['"]/.test(src)) offenders.push(`${rel} : appel de l'ancienne RPC request_withdrawal`);
            }
        };
        walk('app');
        walk('lib');
        assert.deepEqual(offenders, []);
    });

    test('ancienne RPC request_withdrawal supprimée', async () => {
        const { error } = await service.rpc('request_withdrawal', {
            p_user_id: ZERO_UUID, p_gross_amount: 5000, p_fee_rate: 1, p_fee_amount: 50, p_net_amount: 4950, p_payment_details: {},
        });
        assert.ok(error, 'la RPC request_withdrawal doit avoir disparu');
        assert.ok(error.code === 'PGRST202' || /Could not find|does not exist/i.test(error.message), `fonction absente attendue, obtenu ${error.code} ${error.message}`);
    });
});
