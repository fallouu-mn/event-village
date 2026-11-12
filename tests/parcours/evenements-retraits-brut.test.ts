/**
 * Lot 9 ter, tâche 9t.12 c (consigne 0.8, R106 c ; contrat 5.B 9t.12 (c), B.2.3 (5) F20, B.5 point 11, décision B-D23) —
 * « Retraits en cours » au brut : finance_account_balance sert in_progress = Σ gross_amount des retraits en cours (le
 * grand livre réserve le brut, frais compris), donc available + in_progress = solde d'avant ; les deux écrans le disent
 * (« Montant réservé sur votre solde, frais compris, pendant l’envoi vers Wave ou Orange Money. »).
 *
 * Montage recopié de finance-retraits.test.ts:44-73, :115-129 (WITHDRAWAL_RULES, fundedPartner, rpcWithdraw) : partenaire
 * neuve dont une vente en ligne de 10 000 F est disponible, retrait Mobile Money de 6 000 F (frais 1 % = 60 F) par la RPC
 * withdrawal_request, lecture par finance_account_balance et par GET /api/finance/balance (jeton de la partenaire).
 * Le versement du retrait est envoyé puis confirmé en fin de cas (finally) : rien n'est laissé à envoyer.
 *
 * Rouge avant correctif (S-E fix(9t.12), M07 F20 ; E-B app/partner/finance/page.tsx, E-A app/wallet/page.tsx) :
 * in_progress = Σ net_amount = 5 940 (M/20261109000006:624-625) ; aides « Montant réservé pendant l’envoi vers Wave ou
 * Orange Money. » sans « frais compris ». after() : assertLot9terInvariants.
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { CashoutService } from '../../lib/payments/cashout.service';
import { assertLot9terInvariants } from '../helpers/lot9ter-invariants';
import { fakePay, newBuyer, service, setFakeMode, type Buyer, type SaleEvent } from './paiement-helpers';
import {
    balanceOf, buyConfirmed, confirmCashouts, createPartnerEvent, jsonRequest, newPartner, withSettings,
    type AccountKind, type FinanceSettingKey, type Purchase, type TestPartner,
} from './finance-helpers';
import { invoke, routeHandler, show } from './pilotage-helpers';

const ROOT = process.cwd();
const BALANCE_ROUTE = '../../app/api/finance/balance/route';
const HELP = 'Montant réservé sur votre solde, frais compris, pendant l’envoi vers Wave ou Orange Money.';

after(async () => {
    setFakeMode('cashoutMode', 'success');
    await assertLot9terInvariants('evenements-retraits-brut');
});

// ── Recopie de finance-retraits.test.ts:44-73 et :115-129 ──────────────────

const WITHDRAWAL_RULES: Partial<Record<FinanceSettingKey, unknown>> = {
    'finance.withdrawal_fee_rate': 1,
    'finance.withdrawal_min_amount': 5000,
    'finance.withdrawal_bank_enabled': false,
};

interface Funded { partner: TestPartner; ev: SaleEvent; purchase: Purchase }

async function fundedPartner(label: string, price = 10_000): Promise<Funded> {
    const partner = await newPartner(label);
    const ev = await createPartnerEvent(partner.partnerId, label, [{ name: 'Standard', price, total: 20 }]);
    const buyer = await newBuyer(`${label}-ach`);
    const purchase = await withSettings({ 'finance.payout_hold_enabled': false }, () => buyConfirmed(buyer, ev, [['Standard', 1]]));
    const b = await balanceOf(partner.userId, 'ORGANISATEUR');
    assert.equal(b.available, price, `fonds disponibles du partenaire de test : ${JSON.stringify(b)}`);
    return { partner, ev, purchase };
}

interface RpcWithdrawal { ok?: boolean; code?: string; withdrawal_id?: string; cashout_id?: string; gross_amount?: number; fee_amount?: number; net_amount?: number }

async function rpcWithdraw(user: Buyer, o: { account: AccountKind; gross: number }): Promise<RpcWithdrawal> {
    const { data, error } = await service.rpc('withdrawal_request', {
        p: { user_id: user.userId, account_kind: o.account, gross_amount: o.gross, method: 'MOBILE_MONEY', operator: 'WAVE', phone_number: user.phone9, client_key: randomUUID() },
    });
    assert.equal(error, null, `withdrawal_request : ${error?.message}`);
    return (data ?? {}) as RpcWithdrawal;
}

/** Versement du retrait envoyé puis confirmé (retrait PAID) : rien d'envoyable ne reste en base. */
async function settleWithdrawal(cashoutId: string | undefined): Promise<void> {
    if (!cashoutId) return;
    await CashoutService.send(cashoutId);
    const { data, error } = await service.from('cashouts').select('samirpay_transaction_id').eq('id', cashoutId).single();
    assert.equal(error, null, `versement ${cashoutId} : ${error?.message}`);
    if (data.samirpay_transaction_id) fakePay().setTransactionStatus(String(data.samirpay_transaction_id), 'SUCCESS');
    await confirmCashouts();
}

describe('9t.12 c (R106) : « Retraits en cours » au brut', () => {
    test('retrait en cours de 6 000 F (frais 60 F) : in_progress = 6 000, available + in_progress = solde d\'avant ; même valeur servie par GET /api/finance/balance', async () => {
        const { partner } = await fundedPartner('retrait-brut');
        await withSettings(WITHDRAWAL_RULES, async () => {
            const w = await rpcWithdraw(partner, { account: 'ORGANISATEUR', gross: 6000 });
            try {
                assert.equal(w.ok, true, `retrait accepté : ${JSON.stringify(w)}`);
                assert.deepEqual([Number(w.gross_amount), Number(w.fee_amount), Number(w.net_amount)], [6000, 60, 5940], JSON.stringify(w));
                const b = await balanceOf(partner.userId, 'ORGANISATEUR');
                assert.equal(b.available, 4000, `solde réservé : ${JSON.stringify(b)}`);
                assert.equal(b.in_progress, 6000, `retrait en cours au brut réservé, frais compris (aujourd'hui 5 940) : ${JSON.stringify(b)}`);
                assert.equal(b.available + b.in_progress, 10_000, 'available + in_progress = solde d\'avant le retrait');
                const handler = await routeHandler(BALANCE_ROUTE, 'GET', 'GET /api/finance/balance');
                const res = await invoke(handler, jsonRequest('/api/finance/balance?account=ORGANISATEUR', 'GET', partner.accessToken));
                assert.equal(res.status, 200, show(res));
                assert.equal(Number(res.body.in_progress), 6000, `GET /api/finance/balance : ${show(res)}`);
            } finally {
                await settleWithdrawal(w.cashout_id);
            }
        });
    });

    test('statique : l\'aide « Retraits en cours » des deux écrans dit le brut réservé', () => {
        for (const rel of ['app/partner/finance/page.tsx', 'app/wallet/page.tsx']) {
            const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
            assert.ok(src.includes('Retraits en cours'), `${rel} : « Retraits en cours »`);
            assert.ok(src.includes(HELP), `${rel} : aide « ${HELP} » (B.5 point 11)`);
        }
    });
});
