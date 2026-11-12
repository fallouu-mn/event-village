/**
 * Lot 9 ter, tâche 9t.13 (consigne 0.9 ; contrat 5.B 9t.13, décision B-D9) — couverture du badge « Retardé » d'un
 * retrait, jusqu'ici sans test (grep « Retardé » dans tests/ et e2e/ : vide) : GET /api/finance/balance sert
 * `withdrawals[].delayed` vrai pour un retrait dont l'envoi est signalé en retard (delay_flagged_at, l'état que pose
 * cashouts_flag_delayed, M/20261109000007:121-145) et faux sans retard ; les deux écrans (partenaire et portefeuille)
 * rendent le badge et la phrase sous `w.delayed`.
 *
 * Montage recopié de finance-retraits.test.ts:44-73, :115-129 (fundedPartner, rpcWithdraw) ; le versement de chaque
 * retrait est envoyé puis confirmé en fin de cas (finally).
 *
 * VERTE ANNONCÉE dès l'écriture (contrat 5.B 9t.13 : couverture, aucun correctif attendu) : tout rouge est une anomalie à
 * instruire. Suite verte à l'écriture : after() appelle assertLot9bisInvariants (contrat section 1).
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { CashoutService } from '../../lib/payments/cashout.service';
import { assertLot9bisInvariants } from '../helpers/lot9bis-invariants';
import { fakePay, newBuyer, service, setFakeMode, type Buyer } from './paiement-helpers';
import { balanceOf, buyConfirmed, confirmCashouts, createPartnerEvent, jsonRequest, newPartner, withSettings, type FinanceSettingKey, type TestPartner } from './finance-helpers';
import { invoke, routeHandler, show } from './pilotage-helpers';

type Row = Record<string, unknown>;

const ROOT = process.cwd();
const BALANCE_ROUTE = '../../app/api/finance/balance/route';

after(async () => {
    setFakeMode('cashoutMode', 'success');
    await assertLot9bisInvariants('retrait-retarde-9ter');
});

const WITHDRAWAL_RULES: Partial<Record<FinanceSettingKey, unknown>> = {
    'finance.withdrawal_fee_rate': 1,
    'finance.withdrawal_min_amount': 5000,
    'finance.withdrawal_bank_enabled': false,
};

async function fundedPartner(label: string, price = 10_000): Promise<TestPartner> {
    const partner = await newPartner(label);
    const ev = await createPartnerEvent(partner.partnerId, label, [{ name: 'Standard', price, total: 20 }]);
    const buyer = await newBuyer(`${label}-ach`);
    await withSettings({ 'finance.payout_hold_enabled': false }, () => buyConfirmed(buyer, ev, [['Standard', 1]]));
    const b = await balanceOf(partner.userId, 'ORGANISATEUR');
    assert.equal(b.available, price, `fonds disponibles du partenaire de test : ${JSON.stringify(b)}`);
    return partner;
}

async function rpcWithdraw(user: Buyer, gross: number): Promise<Row> {
    const { data, error } = await service.rpc('withdrawal_request', {
        p: { user_id: user.userId, account_kind: 'ORGANISATEUR', gross_amount: gross, method: 'MOBILE_MONEY', operator: 'WAVE', phone_number: user.phone9, client_key: randomUUID() },
    });
    assert.equal(error, null, `withdrawal_request : ${error?.message}`);
    const body = (data ?? {}) as Row;
    assert.equal(body.ok, true, `retrait accepté : ${JSON.stringify(body)}`);
    return body;
}

async function settleWithdrawal(cashoutId: unknown): Promise<void> {
    if (typeof cashoutId !== 'string') return;
    await CashoutService.send(cashoutId);
    const { data, error } = await service.from('cashouts').select('samirpay_transaction_id').eq('id', cashoutId).single();
    assert.equal(error, null, `versement ${cashoutId} : ${error?.message}`);
    if (data.samirpay_transaction_id) fakePay().setTransactionStatus(String(data.samirpay_transaction_id), 'SUCCESS');
    await confirmCashouts();
}

async function withdrawalsServed(partner: TestPartner): Promise<Row[]> {
    const handler = await routeHandler(BALANCE_ROUTE, 'GET', 'GET /api/finance/balance');
    const res = await invoke(handler, jsonRequest('/api/finance/balance?account=ORGANISATEUR', 'GET', partner.accessToken));
    assert.equal(res.status, 200, show(res));
    assert.ok(Array.isArray(res.body.withdrawals), `withdrawals servi : ${show(res)}`);
    return res.body.withdrawals as Row[];
}

describe('9t.13 (0.9) : badge « Retardé » d\'un retrait', () => {
    test('retrait dont l\'envoi est signalé en retard : delayed vrai, statut effectif PROCESSING', async () => {
        const partner = await fundedPartner('retarde-oui');
        await withSettings(WITHDRAWAL_RULES, async () => {
            const w = await rpcWithdraw(partner, 6000);
            try {
                const { data, error } = await service.from('cashouts').update({ delay_flagged_at: new Date().toISOString() }).eq('id', String(w.cashout_id)).select('id');
                assert.equal(error, null, `signalement du retard : ${error?.message}`);
                assert.equal((data ?? []).length, 1, 'versement du retrait signalé en retard');
                const [served] = await withdrawalsServed(partner);
                assert.ok(served, 'un retrait servi');
                assert.equal(served.delayed, true, `retrait signalé en retard : ${JSON.stringify(served)}`);
                assert.equal(served.effective_status, 'PROCESSING', JSON.stringify(served));
            } finally {
                await settleWithdrawal(w.cashout_id);
            }
        });
    });

    test('retrait en cours sans retard : delayed faux', async () => {
        const partner = await fundedPartner('retarde-non');
        await withSettings(WITHDRAWAL_RULES, async () => {
            const w = await rpcWithdraw(partner, 6000);
            try {
                const [served] = await withdrawalsServed(partner);
                assert.ok(served, 'un retrait servi');
                assert.equal(served.delayed, false, `versement à envoyer sans retard : ${JSON.stringify(served)}`);
            } finally {
                await settleWithdrawal(w.cashout_id);
            }
        });
    });

    test('statique : les deux écrans montrent le badge et la phrase quand delayed est vrai', () => {
        for (const rel of ['app/partner/finance/page.tsx', 'app/wallet/page.tsx']) {
            const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
            assert.match(src, /const\s+WITHDRAWAL_DELAYED\b[^=]*=\s*\{\s*label\s*:\s*'Retardé'/, `${rel} : badge « Retardé »`);
            assert.match(src, /const\s+WITHDRAWAL_DELAYED_TEXT\s*=\s*'Retardé : l’équipe Event Village s’en occupe\.'/, `${rel} : phrase du retard`);
            assert.match(src, /\bw\.delayed\s*\?\s*WITHDRAWAL_DELAYED\b/, `${rel} : badge choisi sous w.delayed`);
            assert.match(src, /\{\s*w\.delayed\s*&&\s*<p\b[^>]*>\s*\{\s*WITHDRAWAL_DELAYED_TEXT\s*\}\s*<\/p>\s*\}/, `${rel} : phrase rendue sous w.delayed`);
        }
    });
});
