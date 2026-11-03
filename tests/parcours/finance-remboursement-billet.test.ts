/**
 * Lot 3.4 — remboursement unitaire réel d'un billet (contrat D, constats R23 / ticketing-finance-5).
 *  - route POST /api/partner/events/[id]/tickets/[ticketId]/refund : partenaire propriétaire de
 *    l'événement [id] ou ADMIN / SUPERADMIN (rôles user_roles) ; CONTROLEUR refusé (403) ; partenaire
 *    étranger refusé ; billet d'un autre événement → 404 ;
 *  - billet payé en ligne : cashout TICKET_REFUND de clé REFUND-TKT-<ticketId>, montant = prix + frais
 *    de service du billet ; billet REMBOURSEMENT_EN_COURS puis REMBOURSE à la confirmation du versement ;
 *    paiement PARTIAL puis REFUNDED ; débit ORGANISATEUR (prix facial) au grand livre ;
 *  - aucune notification « remboursé » (in-app ou SMS) avant la confirmation du versement ;
 *  - billet espèces (paiement hors plateforme) : aucun cashout, remboursement à la charge de
 *    l'organisateur (settlement ORGANISATEUR), billet ANNULE.
 * Le porteur des frais d'agrégateur est fixé à EVENT_VILLAGE pendant les tests de montants : le débit
 * organisateur est alors exactement le prix facial.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { CashoutService } from '../../lib/payments/cashout.service';
import { getFakes } from '../fakes';
import { assertFinanceInvariants } from '../helpers/finance-invariants';
import { signInAs } from '../helpers/fixtures';
import {
    buyConfirmed, cashoutsByKey, confirmCashouts, createPartnerEvent, getSetting, jsonRequest, ledgerOf, newPartner,
    paymentRow, withSettings, type TestPartner,
} from './finance-helpers';
import { categoryState, fakePay, importModule, newBuyer, service, setFakeMode, type Buyer, type SaleEvent } from './paiement-helpers';
import { flushNotifications, outboxRows } from './notif-helpers';

type Handler = (req: NextRequest, ctx?: unknown) => Promise<Response>;

let refundRoute: Handler;
let partner: TestPartner;
let ev: SaleEvent;
let otherEvent: SaleEvent;

const PRICE = 5000;
/** « remboursé », « remboursée » (pas « remboursement en cours »). */
const REFUNDED_WORD = /rembours[ée](?!m)/i;

before(async () => {
    ({ POST: refundRoute } = await importModule('../../app/api/partner/events/[id]/tickets/[ticketId]/refund/route'));
    partner = await newPartner('remb-billet');
    ev = await createPartnerEvent(partner.partnerId, 'remb-billet', [{ name: 'Standard', price: PRICE, total: 30 }]);
    otherEvent = await createPartnerEvent(partner.partnerId, 'remb-billet-autre', [{ name: 'Standard', price: PRICE, total: 5 }]);
});

after(async () => {
    setFakeMode('cashoutMode', 'success');
    await assertFinanceInvariants('finance-remboursement-billet');
});

/** Contexte de route compatible avec params objet (Next 14) et params promesse. */
function routeCtx<T extends Record<string, string>>(params: T): { params: Promise<T> & T } {
    return { params: Object.assign(Promise.resolve(params), params) };
}

async function requestRefund(token: string, eventId: string, ticketId: string, reason = 'Test lot 3 : remboursement unitaire'): Promise<{ status: number; body: Record<string, unknown> }> {
    const res = await refundRoute(
        jsonRequest(`/api/partner/events/${eventId}/tickets/${ticketId}/refund`, 'POST', token, { reason }),
        routeCtx({ id: eventId, ticketId }),
    );
    return { status: res.status, body: (await res.json().catch(() => ({}))) as Record<string, unknown> };
}

async function ticket(id: string): Promise<Record<string, unknown>> {
    const { data, error } = await service.from('tickets').select('*').eq('id', id).single();
    assert.equal(error, null, `billet ${id} : ${error?.message}`);
    return data as Record<string, unknown>;
}

function unitServiceFee(unitPrice: number, ratePercent: number): number {
    return Math.ceil(Number((unitPrice * ratePercent / 100).toFixed(6)));
}

/** Envoie le cashout (sans effet s'il est déjà parti) et le renvoie relu. */
async function ensureSent(cashoutId: string): Promise<Record<string, unknown>> {
    await CashoutService.send(cashoutId);
    const { data, error } = await service.from('cashouts').select('*').eq('id', cashoutId).single();
    assert.equal(error, null, `cashout ${cashoutId} : ${error?.message}`);
    return data as Record<string, unknown>;
}

/** Le versement en attente chez SamirPay aboutit, puis la confirmation du module le constate. */
async function confirmTransfer(cashout: Record<string, unknown>): Promise<void> {
    assert.ok(cashout.samirpay_transaction_id, `cashout ${cashout.idempotency_key} envoyé (${cashout.status})`);
    fakePay().setTransactionStatus(String(cashout.samirpay_transaction_id), 'SUCCESS');
    await confirmCashouts();
    const { data } = await service.from('cashouts').select('status').eq('id', cashout.id).single();
    assert.equal(data?.status, 'CONFIRME', 'versement confirmé');
}

async function refundedMessagesFor(buyer: Buyer): Promise<string[]> {
    // Lot 6 (6.1, J2.2) : in-app et SMS passent par la boîte d'envoi ; l'envoyeur livre d'abord les
    // lignes du client (restreint à ses lignes) avant la lecture. L'assertion de fond est inchangée.
    const pending = await outboxRows({ userId: buyer.userId, status: 'PENDING' });
    if (pending.length > 0) await flushNotifications({ ids: pending.map((r) => r.id) });
    const { data, error } = await service.from('notifications').select('title, content').eq('user_id', buyer.userId);
    assert.equal(error, null, `notifications : ${error?.message}`);
    const inApp = (data ?? []).map((n) => `${n.title} — ${n.content}`).filter((m) => REFUNDED_WORD.test(m));
    const sms = getFakes().sms.messagesTo(buyer.phoneE164).map((s) => s.message).filter((m) => REFUNDED_WORD.test(m));
    return [...inApp, ...sms];
}

/** Vente espèces enregistrée au guichet : paiement hors plateforme SUCCESS et billet VALIDE. */
async function cashSale(buyer: Buyer, sale: SaleEvent, category: string): Promise<{ paymentId: string; ticketId: string }> {
    const cat = sale.categories[category];
    const { data: pay, error: payErr } = await service.from('payments').insert({
        transaction_id: `TX-CASH-TEST-${randomUUID()}`, client_id: buyer.userId, partner_id: partner.partnerId,
        payment_target: 'TICKET', amount: cat.price, currency: 'XOF', is_platform_payment: false,
        offline_payment_method: 'ESPECES', payment_method: 'CASH', status: 'SUCCESS', paid_at: new Date().toISOString(),
        metadata: { event_id: sale.eventId },
    }).select('id').single();
    assert.equal(payErr, null, `paiement espèces : ${payErr?.message}`);
    const { data: t, error: tErr } = await service.from('tickets').insert({
        event_id: sale.eventId, category_id: cat.id, user_id: buyer.userId, payment_id: pay.id,
        ticket_number: `TCK-CASH-${randomUUID().slice(0, 12).toUpperCase()}`, price: cat.price,
        qr_code: `EV-QR-TEST-${randomUUID()}`, status: 'VALIDE',
    }).select('id').single();
    assert.equal(tErr, null, `billet espèces : ${tErr?.message}`);
    const state = await categoryState(cat.id);
    const { error: soldErr } = await service.from('ticket_categories').update({ sold_quantity: state.sold + 1 }).eq('id', cat.id);
    assert.equal(soldErr, null, `stock vendu : ${soldErr?.message}`);
    return { paymentId: pay.id, ticketId: t.id };
}

describe('Accès à la route de remboursement', () => {
    test('CONTROLEUR 403, partenaire étranger refusé, billet d’un autre événement 404, ADMIN accepté', async () => {
        const buyer = await newBuyer('remb-acces');
        const { tickets } = await buyConfirmed(buyer, ev, [['Standard', 1]]);
        const t = String(tickets[0].id);

        const controller = await signInAs('CONTROLLER_A');
        assert.equal((await requestRefund(controller.accessToken, ev.eventId, t)).status, 403, 'CONTROLEUR refusé');

        const stranger = await newPartner('remb-etranger');
        const strangerRes = await requestRefund(stranger.accessToken, ev.eventId, t);
        assert.ok([403, 404].includes(strangerRes.status), `partenaire étranger : HTTP ${strangerRes.status}`);

        const wrongEvent = await requestRefund(partner.accessToken, otherEvent.eventId, t);
        assert.equal(wrongEvent.status, 404, `billet d'un autre événement : HTTP ${wrongEvent.status}`);

        assert.equal((await ticket(t)).status, 'VALIDE', 'billet intact après les refus');
        assert.equal((await cashoutsByKey(`REFUND-TKT-${t}`)).length, 0, 'aucun cashout après les refus');

        const admin = await signInAs('ADMIN');
        const ok = await requestRefund(admin.accessToken, ev.eventId, t);
        assert.equal(ok.status, 200, `ADMIN : HTTP ${ok.status} ${JSON.stringify(ok.body)}`);
        assert.equal((await cashoutsByKey(`REFUND-TKT-${t}`)).length, 1, 'cashout créé à la demande de l’ADMIN');
    });
});

describe('Billet payé en ligne', () => {
    test('panier de 3 : remboursement d’un billet (cashout REFUND-TKT, EN_COURS → REMBOURSE, PARTIAL), puis des deux autres (REFUNDED), débit au grand livre', async () => {
        await withSettings({ 'finance.cancellation_aggregator_fee_bearer': 'EVENT_VILLAGE' }, async () => {
            setFakeMode('cashoutMode', 'pending');
            try {
                const buyer = await newBuyer('remb-panier', { firstName: 'Aminata', lastName: 'Rembourse' });
                const { payment, tickets } = await buyConfirmed(buyer, ev, [['Standard', 3]], 'ORANGE_MONEY');
                assert.equal(tickets.length, 3);
                const serviceRate = Number(await getSetting('finance.service_fee_rate'));
                const share = PRICE + unitServiceFee(PRICE, serviceRate);
                for (const t of tickets) assert.equal(Number(t.service_fee), unitServiceFee(PRICE, serviceRate), 'frais de service du billet recopiés');
                const [first, ...rest] = tickets.map((t) => String(t.id));
                const sold0 = (await categoryState(ev.categories.Standard.id)).sold;

                // 1. Demande : cashout du bon montant, billet en cours, rien de « remboursé » au client
                const res = await requestRefund(partner.accessToken, ev.eventId, first);
                assert.equal(res.status, 200, `remboursement : HTTP ${res.status} ${JSON.stringify(res.body)}`);
                const created = await cashoutsByKey(`REFUND-TKT-${first}`);
                assert.equal(created.length, 1, 'un seul cashout pour ce billet');
                assert.equal(created[0].kind, 'TICKET_REFUND');
                assert.equal(created[0].payment_id, payment.id);
                assert.equal(Number(created[0].amount), share, 'montant = prix + frais de service du billet');
                assert.equal(created[0].operator, 'ORANGE_MONEY', 'versement sur l’opérateur du payeur');
                assert.equal(created[0].phone_number, buyer.phone9, 'versement au numéro du payeur');
                const sent = await ensureSent(String(created[0].id));
                assert.equal(sent.status, 'ENVOYE', 'versement en attente chez SamirPay');

                assert.equal((await ticket(first)).status, 'REMBOURSEMENT_EN_COURS');
                for (const t of rest) assert.equal((await ticket(t)).status, 'VALIDE', 'les autres billets restent valides');
                assert.equal((await categoryState(ev.categories.Standard.id)).sold, sold0 - 1, 'place rendue à la vente');
                assert.equal((await paymentRow(payment.id)).status, 'SUCCESS', 'paiement inchangé tant que rien n’est versé');
                assert.deepEqual(await refundedMessagesFor(buyer), [], 'aucun message « remboursé » avant la confirmation');

                const { data: refund, error: refundErr } = await service.from('refunds').select('*').eq('refund_transaction_id', `REFUND-TKT-${first}`).single();
                assert.equal(refundErr, null, `remboursement REFUND-TKT : ${refundErr?.message}`);
                assert.equal(refund.ticket_id, first);
                assert.equal(refund.settlement, 'PLATEFORME');
                assert.equal(refund.status, 'PENDING');

                const debit = (await ledgerOf(partner.userId, 'ORGANISATEUR')).filter((e) => e.entry_type === 'REMBOURSEMENT' && e.ticket_id === first);
                assert.equal(debit.length, 1, 'débit organisateur au grand livre');
                assert.equal(Number(debit[0].amount), -PRICE, 'débit = prix facial (frais d’agrégateur portés par Event Village)');

                // 2. Confirmation du versement : billet REMBOURSE, paiement PARTIAL, message « remboursé »
                await confirmTransfer(sent);
                assert.equal((await ticket(first)).status, 'REMBOURSE');
                const partial = await paymentRow(payment.id);
                assert.equal(partial.status, 'PARTIAL');
                assert.equal(Number(partial.refunded_amount), share);
                const { data: processed } = await service.from('refunds').select('status').eq('refund_transaction_id', `REFUND-TKT-${first}`).single();
                assert.equal(processed?.status, 'PROCESSED');
                assert.ok((await refundedMessagesFor(buyer)).length > 0, 'client informé du remboursement après confirmation');

                // 3. Les deux autres billets : paiement REFUNDED
                for (const t of rest) {
                    const r = await requestRefund(partner.accessToken, ev.eventId, t);
                    assert.equal(r.status, 200, `remboursement ${t} : HTTP ${r.status} ${JSON.stringify(r.body)}`);
                    const [c] = await cashoutsByKey(`REFUND-TKT-${t}`);
                    assert.equal(Number(c.amount), share);
                    await confirmTransfer(await ensureSent(String(c.id)));
                    assert.equal((await ticket(t)).status, 'REMBOURSE');
                }
                const refunded = await paymentRow(payment.id);
                assert.equal(refunded.status, 'REFUNDED');
                assert.equal(Number(refunded.refunded_amount), Number(payment.amount), 'tout le paiement est remboursé');
                assert.equal(Number(payment.amount), 3 * share, 'total client = 3 × (prix + frais de service)');

                const debits = (await ledgerOf(partner.userId, 'ORGANISATEUR')).filter((e) => e.entry_type === 'REMBOURSEMENT' && tickets.some((t) => t.id === e.ticket_id));
                assert.equal(debits.reduce((s, e) => s + Number(e.amount), 0), -3 * PRICE, 'trois débits du prix facial');
            } finally {
                setFakeMode('cashoutMode', 'success');
            }
        });
    });
});

describe('Billet espèces', () => {
    test('paiement hors plateforme : aucun cashout, remboursement à la charge de l’organisateur, billet ANNULE', async () => {
        const buyer = await newBuyer('remb-especes');
        const { ticketId } = await cashSale(buyer, ev, 'Standard');
        const res = await requestRefund(partner.accessToken, ev.eventId, ticketId);
        assert.equal(res.status, 200, `remboursement espèces : HTTP ${res.status} ${JSON.stringify(res.body)}`);
        assert.equal((await cashoutsByKey(`REFUND-TKT-${ticketId}`)).length, 0, 'aucun versement par la plateforme');
        const { data: refunds, error } = await service.from('refunds').select('*').eq('ticket_id', ticketId);
        assert.equal(error, null, `remboursements du billet : ${error?.message}`);
        assert.equal(refunds?.length, 1, 'un remboursement enregistré');
        assert.equal(refunds![0].settlement, 'ORGANISATEUR', 'à rembourser par l’organisateur');
        assert.equal(Number(refunds![0].amount), PRICE, 'montant payé au guichet');
        assert.equal((await ticket(ticketId)).status, 'ANNULE');
        const entries = (await ledgerOf(partner.userId, 'ORGANISATEUR')).filter((e) => e.ticket_id === ticketId);
        assert.equal(entries.length, 0, 'aucune écriture : l’argent n’est jamais passé par la plateforme');
    });
});
