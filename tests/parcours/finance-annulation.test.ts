/**
 * Lot 3.7 — annulation d'un événement (contrat D, refund_request ; contrat C, débit et créance).
 *  - par la route partenaire existante POST /api/partner/events/[id]/cancel ;
 *  - seuls les paiements en ligne sont remboursés, chacun au total client (prix + frais de service) :
 *    la vente espèces (paiement hors plateforme) et l'invitation (billet à 0 F sans paiement) ne
 *    donnent lieu à aucun cashout ;
 *  - le reversement organisateur est débité au grand livre (prix facial, frais d'agrégateur portés par
 *    Event Village) ; tant que les fonds sont en attente, aucune créance ;
 *  - fonds déjà retirés (fonds disponibles dès la confirmation, retrait au grand livre) : débit limité
 *    au solde, créance finance_debts pour le reste, alerte admin.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { assertFinanceInvariants } from '../helpers/finance-invariants';
import {
    balanceOf, buyConfirmed, createPartnerEvent, getSetting, jsonRequest, ledgerOf, newPartner, withSettings,
    type TestPartner,
} from './finance-helpers';
import { categoryState, importModule, newBuyer, service, type Buyer, type SaleEvent } from './paiement-helpers';

type Handler = (req: NextRequest, ctx?: unknown) => Promise<Response>;

let cancelRoute: Handler;
const PRICE = 5000;
const EV_BEARS_FEES = { 'finance.cancellation_aggregator_fee_bearer': 'EVENT_VILLAGE' } as const;

before(async () => {
    ({ POST: cancelRoute } = await importModule('../../app/api/partner/events/[id]/cancel/route'));
});

after(async () => {
    await assertFinanceInvariants('finance-annulation');
});

/** Contexte de route compatible avec params objet (Next 14) et params promesse. */
function routeCtx<T extends Record<string, string>>(params: T): { params: Promise<T> & T } {
    return { params: Object.assign(Promise.resolve(params), params) };
}

function unitServiceFee(unitPrice: number, ratePercent: number): number {
    return Math.ceil(Number((unitPrice * ratePercent / 100).toFixed(6)));
}

async function cancel(owner: TestPartner, eventId: string): Promise<void> {
    // Lot 5 (contrat D6) : titre retapé et avis public d'au moins 10 caractères obligatoires
    const { data: ev, error } = await service.from('events').select('title').eq('id', eventId).single();
    assert.equal(error, null, `titre de l’événement : ${error?.message}`);
    const res = await cancelRoute(
        jsonRequest(`/api/partner/events/${eventId}/cancel`, 'POST', owner.accessToken, {
            internalReason: 'Test lot 3 : annulation',
            publicNotice: 'Événement annulé : les acheteurs sont remboursés.',
            confirmTitle: String(ev.title),
        }),
        routeCtx({ id: eventId }),
    );
    assert.equal(res.status, 200, `annulation : HTTP ${res.status} ${JSON.stringify(await res.clone().json().catch(() => ({})))}`);
}

async function insertTicket(sale: SaleEvent, category: string, userId: string, paymentId: string | null): Promise<string> {
    const cat = sale.categories[category];
    const { data, error } = await service.from('tickets').insert({
        event_id: sale.eventId, category_id: cat.id, user_id: userId, payment_id: paymentId,
        ticket_number: `TCK-TEST-${randomUUID().slice(0, 12).toUpperCase()}`, price: cat.price,
        qr_code: `EV-QR-TEST-${randomUUID()}`, status: 'VALIDE',
    }).select('id').single();
    assert.equal(error, null, `billet ${category} : ${error?.message}`);
    const state = await categoryState(cat.id);
    const { error: soldErr } = await service.from('ticket_categories').update({ sold_quantity: state.sold + 1 }).eq('id', cat.id);
    assert.equal(soldErr, null, `stock vendu : ${soldErr?.message}`);
    return data.id;
}

/** Vente espèces au guichet : paiement hors plateforme SUCCESS et billet VALIDE. */
async function cashSale(owner: TestPartner, buyer: Buyer, sale: SaleEvent): Promise<{ paymentId: string; ticketId: string }> {
    const { data, error } = await service.from('payments').insert({
        transaction_id: `TX-CASH-TEST-${randomUUID()}`, client_id: buyer.userId, partner_id: owner.partnerId,
        payment_target: 'TICKET', amount: PRICE, currency: 'XOF', is_platform_payment: false,
        offline_payment_method: 'ESPECES', payment_method: 'CASH', status: 'SUCCESS', paid_at: new Date().toISOString(),
        metadata: { event_id: sale.eventId },
    }).select('id').single();
    assert.equal(error, null, `paiement espèces : ${error?.message}`);
    return { paymentId: data.id, ticketId: await insertTicket(sale, 'Standard', buyer.userId, data.id) };
}

describe('Annulation d’un événement', () => {
    test('3 paiements en ligne, 1 vente espèces, 1 invitation → 3 cashouts au total client, rien pour les deux autres', async () => {
        await withSettings(EV_BEARS_FEES, async () => {
            const owner = await newPartner('annulation');
            const ev = await createPartnerEvent(owner.partnerId, 'annulation', [
                { name: 'Standard', price: PRICE, total: 30 },
                { name: 'Invitation', price: 0, total: 10 },
            ]);
            const b1 = await newBuyer('annul-1');
            const b2 = await newBuyer('annul-2');
            const b3 = await newBuyer('annul-3');
            const online = [
                { qty: 1, ...(await buyConfirmed(b1, ev, [['Standard', 1]], 'WAVE')) },
                { qty: 2, ...(await buyConfirmed(b2, ev, [['Standard', 2]], 'ORANGE_MONEY')) },
                { qty: 1, ...(await buyConfirmed(b3, ev, [['Standard', 1]], 'WAVE')) },
            ];
            const cashBuyer = await newBuyer('annul-especes');
            const cash = await cashSale(owner, cashBuyer, ev);
            const guest = await newBuyer('annul-invite');
            const invitation = await insertTicket(ev, 'Invitation', guest.userId, null);

            await cancel(owner, ev.eventId);

            const onlineIds = online.map((o) => String(o.payment.id));
            const { data: cashouts, error } = await service.from('cashouts').select('*').in('payment_id', [...onlineIds, cash.paymentId]);
            assert.equal(error, null, `cashouts : ${error?.message}`);
            assert.equal(cashouts?.length, 3, `un cashout par paiement en ligne, aucun pour l’espèce : ${JSON.stringify(cashouts)}`);

            const serviceRate = Number(await getSetting('finance.service_fee_rate'));
            const share = PRICE + unitServiceFee(PRICE, serviceRate);
            for (const o of online) {
                const c: Record<string, unknown> | undefined = cashouts!.find((x: Record<string, unknown>) => x.payment_id === o.payment.id);
                assert.ok(c, `cashout du paiement ${o.payment.id}`);
                assert.equal(c.idempotency_key, `REFUND-${o.payment.id}`);
                assert.equal(Number(o.payment.amount), o.qty * share, 'total client = quantité × (prix + frais de service)');
                assert.equal(Number(c.amount), o.qty * share, 'remboursement du total client, frais de service compris');
            }
            const { data: stray, error: strayErr } = await service.from('cashouts').select('id')
                .in('idempotency_key', [`REFUND-TKT-${cash.ticketId}`, `REFUND-TKT-${invitation}`, `REFUND-${cash.paymentId}`]);
            assert.equal(strayErr, null, `cashouts parasites : ${strayErr?.message}`);
            assert.equal(stray?.length, 0, 'ni la vente espèces ni l’invitation ne sont versées par la plateforme');

            const debits = (await ledgerOf(owner.userId, 'ORGANISATEUR')).filter((e) => e.entry_type === 'REMBOURSEMENT');
            assert.equal(debits.reduce((s, e) => s + Number(e.amount), 0), -4 * PRICE, 'reversement des 4 billets en ligne débité (prix facial)');
            const b = await balanceOf(owner.userId, 'ORGANISATEUR');
            assert.equal(b.available + b.pending, 0, 'solde organisateur ramené à 0');
            const { data: debts, error: debtErr } = await service.from('finance_debts').select('id').eq('owner_id', owner.userId);
            assert.equal(debtErr, null, `créances : ${debtErr?.message}`);
            assert.equal(debts?.length, 0, 'fonds encore en attente : aucune créance');
        });
    });

    test('fonds déjà retirés par l’organisateur → débit limité au solde, créance et alerte admin', async () => {
        await withSettings({ ...EV_BEARS_FEES, 'finance.payout_hold_enabled': false }, async () => {
            const owner = await newPartner('annul-retire');
            const ev = await createPartnerEvent(owner.partnerId, 'annul-retire', [{ name: 'Standard', price: PRICE, total: 10 }]);
            const buyer = await newBuyer('annul-retire');
            const { payment } = await buyConfirmed(buyer, ev, [['Standard', 2]], 'WAVE');

            const before0 = await balanceOf(owner.userId, 'ORGANISATEUR');
            assert.equal(before0.available, 2 * PRICE, 'fonds disponibles dès la confirmation');
            // Retrait déjà effectué de tout le disponible (écriture RETRAIT au grand livre)
            const { error: wErr } = await service.from('finance_ledger').insert({
                owner_id: owner.userId, account_kind: 'ORGANISATEUR', partner_id: owner.partnerId, entry_type: 'RETRAIT',
                amount: -2 * PRICE, available_at: new Date().toISOString(), source_key: `TEST-RETRAIT-${randomUUID()}`,
                description: 'Retrait simulé (test du lot 3)',
            });
            assert.equal(wErr, null, `retrait simulé : ${wErr?.message}`);

            await cancel(owner, ev.eventId);

            const { data: cashouts } = await service.from('cashouts').select('amount').eq('payment_id', payment.id);
            assert.equal(cashouts?.length, 1, 'le client est remboursé malgré le retrait');
            assert.equal(Number(cashouts![0].amount), Number(payment.amount));

            const { data: debts, error } = await service.from('finance_debts').select('*').eq('owner_id', owner.userId);
            assert.equal(error, null, `créances : ${error?.message}`);
            assert.equal(debts?.length, 1, 'une créance sur l’organisateur');
            const debt = debts![0];
            assert.equal(debt.account_kind, 'ORGANISATEUR');
            assert.equal(Number(debt.amount), 2 * PRICE, 'créance = reversement déjà retiré');
            assert.equal(Number(debt.remaining), 2 * PRICE);
            assert.equal(debt.settled_at, null);
            const { data: refund } = await service.from('refunds').select('id').eq('refund_transaction_id', `REFUND-${payment.id}`).single();
            assert.equal(debt.refund_id, refund?.id, 'créance rattachée au remboursement');

            const b = await balanceOf(owner.userId, 'ORGANISATEUR');
            assert.equal(b.available + b.pending, 0, 'le solde ne devient jamais négatif');

            const byObject = await service.from('audit_logs').select('id').eq('object_id', debt.id);
            const byMetadata = await service.from('audit_logs').select('id').eq('metadata->>debt_id', debt.id);
            const notified = await service.from('notifications').select('id').eq('metadata->>debt_id', debt.id);
            const alerts = (byObject.data?.length ?? 0) + (byMetadata.data?.length ?? 0) + (notified.data?.length ?? 0);
            assert.ok(alerts > 0, 'alerte admin portant l’identifiant de la créance (audit_logs ou notifications)');
        });
    });
});
