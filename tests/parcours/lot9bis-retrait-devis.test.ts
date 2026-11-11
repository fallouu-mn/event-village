/**
 * Lot 9 bis, tâche 10 (R62 ; contrat 5.10, B27, B15, 4.1) — minimum, taux et net avant le code de retrait :
 *  - POST /api/withdrawals/otp exige `{ account, amount }` et passe le devis (withdrawal_quote, même règle que
 *    withdrawal_request : fin_withdrawal_check) AVANT de réserver le SMS ; tout refus du devis → ni réservation ni code
 *    (400 BELOW_MINIMUM « Le minimum de retrait est de {min} F CFA. », 409 INSUFFICIENT_BALANCE…) ; accepté :
 *    200 `{ sent: true, quote: { minimum, fee_rate, fee_amount, net_amount } }` ;
 *  - GET /api/finance/balance sert `withdrawal_min_amount` et `withdrawal_fee_rate` ;
 *  - devis de 6 000 F au taux de 1 % : frais 60, net 5 940 (mêmes nombres que e2e/recette.spec.ts:767-781).
 *
 * Rouge avant correctif : la route du code ne lit que `account` (app/api/withdrawals/otp/route.ts:14) et envoie le
 * code sans montant (:41-57) ; withdrawal_quote n'existe pas ; finance_account_balance ne sert ni le minimum ni le taux
 * (M/20261101000004:330-338).
 * Comptage des SMS par numéro neuf (codes à 6 chiffres reçus par le téléphone du compte), jamais globalement.
 * Réglages du contrat posés par withSettings (minimum 5 000 F, taux 1 %), restaurés après chaque appel.
 * Fin de suite : assertLot9bisInvariants.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { getFakes } from '../fakes';
import { assertLot9bisInvariants } from '../helpers/lot9bis-invariants';
import { newBuyer, service, type Buyer } from './paiement-helpers';
import {
    buyConfirmed, createPartnerEvent, jsonRequest, newPartner, withSettings,
    type AccountKind, type FinanceSettingKey, type TestPartner,
} from './finance-helpers';
import { invoke, routeHandler, show } from './pilotage-helpers';
import type { RouteResult } from './acces-helpers';

after(async () => {
    await assertLot9bisInvariants('lot9bis-retrait-devis');
});

type Row = Record<string, unknown>;

const OTP_ROUTE = '../../app/api/withdrawals/otp/route';
const BALANCE_ROUTE = '../../app/api/finance/balance/route';
const BELOW_MINIMUM_TEXT = /^Le minimum de retrait est de 5\s?000 F CFA\.$/;

const WITHDRAWAL_RULES: Partial<Record<FinanceSettingKey, unknown>> = {
    'finance.withdrawal_fee_rate': 1,
    'finance.withdrawal_min_amount': 5000,
    'finance.withdrawal_bank_enabled': false,
};

let partner: TestPartner;

before(async () => {
    partner = await newPartner('devis');
    const ev = await createPartnerEvent(partner.partnerId, 'devis', [{ name: 'Standard', price: 10_000, total: 10 }]);
    const buyer = await newBuyer('devis-ach');
    await withSettings({ 'finance.payout_hold_enabled': false }, () => buyConfirmed(buyer, ev, [['Standard', 1]]));
    const { data, error } = await service.rpc('finance_account_balance', { p_owner: partner.userId, p_kind: 'ORGANISATEUR' });
    assert.equal(error, null, `solde : ${error?.message}`);
    assert.equal(Number((data as Row).available), 10_000, `fonds disponibles du partenaire de test : ${JSON.stringify(data)}`);
});

// ── Outils locaux ──────────────────────────────────────────────────────────

function smsCodes(phoneE164: string): number {
    return getFakes().sms.messagesTo(phoneE164).filter((m) => /\b\d{6}\b/.test(m.message)).length;
}

async function withdrawalOtpRows(phoneE164: string): Promise<number> {
    const { data, error } = await service.from('otp_codes').select('id').eq('phone', phoneE164).eq('purpose', 'WITHDRAWAL');
    assert.equal(error, null, `codes de retrait : ${error?.message}`);
    return (data ?? []).length;
}

async function askCode(user: Buyer, body: Row): Promise<RouteResult> {
    const handler = await routeHandler(OTP_ROUTE, 'POST', 'POST /api/withdrawals/otp');
    return withSettings(WITHDRAWAL_RULES, () => invoke(handler, jsonRequest('/api/withdrawals/otp', 'POST', user.accessToken, body)));
}

/** withdrawal_quote(p) `{ user_id, account_kind, gross_amount }` (contrat 3.2, M06) : nouvelle, absente avant le correctif. */
async function rpcQuote(user: Buyer, gross: number, kind: AccountKind = 'ORGANISATEUR'): Promise<Row> {
    const { data, error } = await withSettings(WITHDRAWAL_RULES, async () =>
        service.rpc('withdrawal_quote', { p: { user_id: user.userId, account_kind: kind, gross_amount: gross } }));
    assert.equal(error, null, `withdrawal_quote (RPC nouvelle, migration 20261109000006_lot9bis_argent) : ${error?.message} (code ${error?.code})`);
    return (data ?? {}) as Row;
}

/** Refus du devis par la route du code : statut et code exacts, aucun SMS ni code enregistré pour ce numéro. */
async function assertRefusedWithoutSms(body: Row, status: number, code: string | null, label: string): Promise<RouteResult> {
    const sms0 = smsCodes(partner.phoneE164);
    const otp0 = await withdrawalOtpRows(partner.phoneE164);
    const res = await askCode(partner, body);
    assert.equal(res.status, status, `${label} : ${show(res)}`);
    if (code) assert.equal(res.body.code, code, `${label} : ${show(res)}`);
    assert.equal(smsCodes(partner.phoneE164), sms0, `${label} : aucun code envoyé par SMS`);
    assert.equal(await withdrawalOtpRows(partner.phoneE164), otp0, `${label} : aucun code de retrait enregistré`);
    return res;
}

// ── Cas ────────────────────────────────────────────────────────────────────

describe('R62 — minimum, taux et net avant le code de retrait', () => {
    test('R62 reproduit : POST /api/withdrawals/otp { account, amount: 4 999 } → 400 BELOW_MINIMUM (texte du contrat), aucun SMS ni code', async () => {
        const res = await assertRefusedWithoutSms({ account: 'ORGANISATEUR', amount: 4_999 }, 400, 'BELOW_MINIMUM', 'montant sous le minimum');
        assert.match(String(res.body.error ?? ''), BELOW_MINIMUM_TEXT, `texte du refus : ${show(res)}`);
    });

    test('la route du code exige le montant : { account } seul → 400, aucun SMS ni code', async () => {
        await assertRefusedWithoutSms({ account: 'ORGANISATEUR' }, 400, null, 'montant absent');
    });

    test('tout refus du devis bloque le code : 20 000 F pour 10 000 F disponibles → 409 INSUFFICIENT_BALANCE, aucun SMS ni code', async () => {
        await assertRefusedWithoutSms({ account: 'ORGANISATEUR', amount: 20_000 }, 409, 'INSUFFICIENT_BALANCE', 'montant au-delà du solde');
    });

    test('GET /api/finance/balance : withdrawal_min_amount = 5 000 et withdrawal_fee_rate = 1 (règles servies à l’écran)', async () => {
        const handler = await routeHandler(BALANCE_ROUTE, 'GET', 'GET /api/finance/balance');
        const res = await withSettings(WITHDRAWAL_RULES, () => invoke(handler, jsonRequest('/api/finance/balance?account=ORGANISATEUR', 'GET', partner.accessToken)));
        assert.equal(res.status, 200, show(res));
        for (const key of ['withdrawal_min_amount', 'withdrawal_fee_rate']) {
            assert.ok(key in res.body, `clé « ${key} » absente de la réponse (contrat 4.1) : ${show(res)}`);
        }
        assert.equal(Number(res.body.withdrawal_min_amount), 5_000, show(res));
        assert.equal(Number(res.body.withdrawal_fee_rate), 1, show(res));
    });

    test('devis de 6 000 F : withdrawal_quote et la route du code rendent minimum 5 000, taux 1, frais 60, net 5 940 ; un seul code envoyé', async () => {
        const quote = await rpcQuote(partner, 6_000);
        assert.equal(quote.ok, true, `devis : ${JSON.stringify(quote)}`);
        assert.deepEqual(
            { minimum: Number(quote.minimum), fee_rate: Number(quote.fee_rate), fee_amount: Number(quote.fee_amount), net_amount: Number(quote.net_amount) },
            { minimum: 5_000, fee_rate: 1, fee_amount: 60, net_amount: 5_940 },
            JSON.stringify(quote));
        const below = await rpcQuote(partner, 4_999);
        assert.equal(below.code, 'BELOW_MINIMUM', `devis sous le minimum : ${JSON.stringify(below)}`);

        const sms0 = smsCodes(partner.phoneE164);
        const res = await askCode(partner, { account: 'ORGANISATEUR', amount: 6_000 });
        assert.equal(res.status, 200, `code demandé pour 6 000 F : ${show(res)}`);
        assert.equal(res.body.sent, true, show(res));
        const q = res.body.quote as Row | undefined;
        assert.ok(q && typeof q === 'object', `devis absent de la réponse (contrat 4.1) : ${show(res)}`);
        assert.deepEqual(
            { minimum: Number(q.minimum), fee_rate: Number(q.fee_rate), fee_amount: Number(q.fee_amount), net_amount: Number(q.net_amount) },
            { minimum: 5_000, fee_rate: 1, fee_amount: 60, net_amount: 5_940 },
            show(res));
        assert.equal(smsCodes(partner.phoneE164) - sms0, 1, 'un seul code envoyé au téléphone du compte');
    });
});
