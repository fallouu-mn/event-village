/**
 * Lot 3.8 — rapport de clôture et finance partenaire lus depuis le grand livre (contrat G, constat
 * partner-ux-7).
 * Scénario : 3 billets Standard (un paiement) + 1 billet VIP (un paiement) payés en ligne, 2 billets
 * Standard remboursés (cashouts confirmés), 1 vente espèces.
 *  - net organisateur = prix faciaux des billets restants payés en ligne (Σ VENTE + REMBOURSEMENT de
 *    l'événement), sans double déduction des remboursements ;
 *  - ligne informative « frais de service payés par l'acheteur » = frais des billets restants payés en
 *    ligne (les frais des billets remboursés ont été rendus à l'acheteur), non déduite du net ;
 *  - ventes espèces séparées et informatives, hors net.
 * Champs de réponse fixés par cette suite (contrat G) :
 *  - GET /api/partner/reports/closing → report.financialSummary.{totalNet, buyerServiceFees, cashSales} ;
 *  - GET /api/partner/finance → finance.netRevenue et finance.breakdown.tickets.{netRevenue, buyerServiceFees, cashSales}.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { CashoutService } from '../../lib/payments/cashout.service';
import { assertFinanceInvariants } from '../helpers/finance-invariants';
import {
    buyConfirmed, createPartnerEvent, getSetting, jsonRequest, newPartner, withSettings, type TestPartner,
} from './finance-helpers';
import { categoryState, importModule, newBuyer, service, type SaleEvent } from './paiement-helpers';

type Handler = (req: NextRequest, ctx?: unknown) => Promise<Response>;

let closingRoute: Handler;
let financeRoute: Handler;
let partner: TestPartner;
let ev: SaleEvent;

const STANDARD = 5000;
const VIP = 10_000;
let expectedNet = 0;
let expectedServiceFees = 0;
const expectedCash = STANDARD;

function unitServiceFee(unitPrice: number, ratePercent: number): number {
    return Math.ceil(Number((unitPrice * ratePercent / 100).toFixed(6)));
}

before(async () => {
    ({ GET: closingRoute } = await importModule('../../app/api/partner/reports/closing/route'));
    ({ GET: financeRoute } = await importModule('../../app/api/partner/finance/route'));
    partner = await newPartner('rapports');
    ev = await createPartnerEvent(partner.partnerId, 'rapports', [
        { name: 'Standard', price: STANDARD, total: 20 },
        { name: 'VIP', price: VIP, total: 10 },
    ]);

    await withSettings({ 'finance.cancellation_aggregator_fee_bearer': 'EVENT_VILLAGE' }, async () => {
        const a = await newBuyer('rapport-a');
        const b = await newBuyer('rapport-b');
        const standard = await buyConfirmed(a, ev, [['Standard', 3]], 'WAVE');
        await buyConfirmed(b, ev, [['VIP', 1]], 'ORANGE_MONEY');

        // Deux billets Standard remboursés, versements confirmés
        for (const t of standard.tickets.slice(0, 2)) {
            const { data, error } = await service.rpc('ticket_refund_request', { p_ticket_id: t.id, p_actor: partner.userId, p_reason: 'Test lot 3 : rapport' });
            assert.equal(error, null, `ticket_refund_request : ${error?.message}`);
            const r = data as { ok?: boolean; mode?: string; cashout_id?: string };
            assert.equal(r?.ok, true, `remboursement refusé : ${JSON.stringify(data)}`);
            assert.equal(r.mode, 'CASHOUT');
            await CashoutService.send(String(r.cashout_id));
            const { data: c } = await service.from('cashouts').select('status').eq('id', r.cashout_id).single();
            assert.equal(c?.status, 'CONFIRME', 'versement confirmé');
        }
    });

    // Vente espèces au guichet (paiement hors plateforme)
    const cashBuyer = await newBuyer('rapport-especes');
    const { data: pay, error: payErr } = await service.from('payments').insert({
        transaction_id: `TX-CASH-TEST-${randomUUID()}`, client_id: cashBuyer.userId, partner_id: partner.partnerId,
        payment_target: 'TICKET', event_id: ev.eventId, amount: STANDARD, currency: 'XOF', is_platform_payment: false,
        offline_payment_method: 'ESPECES', payment_method: 'CASH', status: 'SUCCESS', paid_at: new Date().toISOString(),
        metadata: { event_id: ev.eventId },
    }).select('id').single();
    assert.equal(payErr, null, `paiement espèces : ${payErr?.message}`);
    const cat = ev.categories.Standard;
    const { error: tErr } = await service.from('tickets').insert({
        event_id: ev.eventId, category_id: cat.id, user_id: cashBuyer.userId, payment_id: pay.id,
        ticket_number: `TCK-CASH-${randomUUID().slice(0, 12).toUpperCase()}`, price: STANDARD,
        qr_code: `EV-QR-TEST-${randomUUID()}`, status: 'VALIDE',
    });
    assert.equal(tErr, null, `billet espèces : ${tErr?.message}`);
    const { error: soldErr } = await service.from('ticket_categories').update({ sold_quantity: (await categoryState(cat.id)).sold + 1 }).eq('id', cat.id);
    assert.equal(soldErr, null, `stock vendu : ${soldErr?.message}`);

    const rate = Number(await getSetting('finance.service_fee_rate'));
    // Billets restants payés en ligne : 1 Standard + 1 VIP
    expectedNet = STANDARD + VIP;
    expectedServiceFees = unitServiceFee(STANDARD, rate) + unitServiceFee(VIP, rate);
});

after(async () => {
    await assertFinanceInvariants('finance-rapports');
});

describe('Rapports partenaire lus depuis le grand livre', () => {
    test('rapport de clôture : net = faciaux des billets restants en ligne, frais acheteur informatifs, espèces séparées', async () => {
        const res = await closingRoute(jsonRequest(`/api/partner/reports/closing?eventId=${ev.eventId}`, 'GET', partner.accessToken));
        const body = (await res.json()) as { report?: { financialSummary?: Record<string, unknown> } };
        assert.equal(res.status, 200, `rapport de clôture : HTTP ${res.status} ${JSON.stringify(body)}`);
        const fin = body.report?.financialSummary ?? {};
        assert.equal(Number(fin.totalNet), expectedNet, `net organisateur sans double déduction : ${JSON.stringify(fin)}`);
        assert.equal(Number(fin.buyerServiceFees), expectedServiceFees, 'frais de service payés par l’acheteur (informatif)');
        assert.equal(Number(fin.cashSales), expectedCash, 'ventes espèces séparées');
    });

    test('finance partenaire : même net billetterie, mêmes lignes informatives', async () => {
        const res = await financeRoute(jsonRequest('/api/partner/finance', 'GET', partner.accessToken));
        const body = (await res.json()) as { finance?: { netRevenue?: unknown; breakdown?: { tickets?: Record<string, unknown> } } };
        assert.equal(res.status, 200, `finance partenaire : HTTP ${res.status} ${JSON.stringify(body)}`);
        const tickets = body.finance?.breakdown?.tickets ?? {};
        assert.equal(Number(tickets.netRevenue), expectedNet, `net billetterie : ${JSON.stringify(tickets)}`);
        assert.equal(Number(tickets.buyerServiceFees), expectedServiceFees, 'frais de service payés par l’acheteur (informatif)');
        assert.equal(Number(tickets.cashSales), expectedCash, 'ventes espèces séparées');
        assert.equal(Number(body.finance?.netRevenue), expectedNet, 'partenaire sans autre activité : net total = net billetterie');
    });
});
