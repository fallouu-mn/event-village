/**
 * Lot 3.0 — filet de sécurité des cibles de paiement hors billetterie (commande, salle, table,
 * abonnement). Une suite de parcours minimale par cible :
 *  - cible créée par le service_role (lignes minimales valides selon les migrations) ;
 *  - POST /api/payments/create (session ACTIF, Wave, téléphone payeur) → paiement PENDING, montant
 *    envoyé à SamirPay = total du paiement ;
 *  - succès chez SamirPay puis webhook → paiement SUCCESS et effet métier sur la cible ;
 *  - second parcours en échec : FAILED chez SamirPay, paiement vieilli de 20 min, réconciliation
 *    par le cron → paiement FAILED, cible annulée (ou abonnement non activé) ;
 *  - montants du moteur unique (contrat B) : marché (commande, salle, table) total = facial + frais
 *    de service (arrondi au FCFA supérieur par unité), reversement = facial ; abonnement sans frais de
 *    service, reversement 0, net EV = facial − agrégateur.
 * La salle est créée avec un acompte de 100 % (solde 0) : la règle acompte / solde n'est pas fixée par
 * le contrat B, le montant dû est alors le même quelle que soit la règle retenue.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { assertFinanceInvariants } from '../helpers/finance-invariants';
import { getSetting, jsonRequest, newPartner, round2, type TestPartner } from './finance-helpers';
import {
    cronRequest, deliverWebhook, importModule, initCalls, newBuyer, paymentById, providerSays, service,
    type Buyer, type PaymentRow,
} from './paiement-helpers';

type Handler = (req: NextRequest, ctx?: unknown) => Promise<Response>;
type Target = 'ORDER' | 'HALL_RESERVATION' | 'TABLE_RESERVATION' | 'SUBSCRIPTION';

let createPaymentRoute: Handler;
let cron: Handler;
let partner: TestPartner;
let client: Buyer;

/** Dates futures distinctes (une par parcours) : aucune collision avec les contraintes d'exclusion. */
let dayOffset = 40;
function futureDate(): string {
    dayOffset += 1;
    return new Date(Date.now() + dayOffset * 24 * 3600 * 1000).toISOString().slice(0, 10);
}

before(async () => {
    ({ POST: createPaymentRoute } = await importModule('../../app/api/payments/create/route'));
    ({ GET: cron } = await importModule('../../app/api/cron/payments-reconcile/route'));
    partner = await newPartner('cibles');
    client = await newBuyer('cibles-client', { firstName: 'Ndeye', lastName: 'Cliente' });
});

after(async () => {
    await assertFinanceInvariants('finance-cibles');
});

// ── Création des cibles (service_role) ─────────────────────────────────────

async function createOrder(facial: number): Promise<string> {
    const { data: product, error: prodErr } = await service.from('products').insert({
        partner_id: partner.partnerId, name: `TEST Plat ${randomUUID().slice(0, 8)}`, price: facial, status: 'DISPONIBLE',
    }).select('id, name').single();
    assert.equal(prodErr, null, `produit : ${prodErr?.message}`);
    const { data: order, error } = await service.from('orders').insert({
        order_number: `CMD-TEST-${randomUUID()}`,
        client_id: client.userId,
        partner_id: partner.partnerId,
        subtotal: facial,
        total_amount: facial,
        paid_amount: 0,
        balance_amount: facial,
        payment_type: 'INTEGRAL',
        delivery_mode: 'RETRAIT',
        order_status: 'EN_ATTENTE',
        payment_status: 'PENDING',
    }).select('id').single();
    assert.equal(error, null, `commande : ${error?.message}`);
    const { error: itemErr } = await service.from('order_items').insert({
        order_id: order.id, product_id: product.id, product_name: product.name, quantity: 1, unit_price: facial, total_price: facial,
    });
    assert.equal(itemErr, null, `ligne de commande : ${itemErr?.message}`);
    return order.id;
}

async function createHallReservation(facial: number): Promise<string> {
    const { data: hall, error: hallErr } = await service.from('halls').insert({
        partner_id: partner.partnerId, name: `TEST Salle ${randomUUID().slice(0, 8)}`, capacity: 100,
        price_per_day: facial, deposit_percentage: 100, city: 'Dakar', is_active: true,
    }).select('id').single();
    assert.equal(hallErr, null, `salle : ${hallErr?.message}`);
    const day = futureDate();
    const { data: reservation, error } = await service.from('hall_reservations').insert({
        hall_id: hall.id, client_id: client.userId, partner_id: partner.partnerId,
        start_date: day, end_date: day,
        total_amount: facial, deposit_amount: facial, balance_amount: 0,
        status: 'EN_ATTENTE', payment_status: 'PENDING',
    }).select('id').single();
    assert.equal(error, null, `réservation de salle : ${error?.message}`);
    return reservation.id;
}

async function createTableReservation(facial: number): Promise<string> {
    const { data: table, error: tableErr } = await service.from('restaurant_tables').insert({
        partner_id: partner.partnerId, table_number: `T-${randomUUID().slice(0, 8)}`, capacity: 4, is_active: true,
    }).select('id').single();
    assert.equal(tableErr, null, `table : ${tableErr?.message}`);
    const { data: reservation, error } = await service.from('table_reservations').insert({
        partner_id: partner.partnerId, table_id: table.id, client_id: client.userId,
        reservation_date: futureDate(), reservation_time: '20:00:00', guest_count: 2,
        deposit_amount: facial, is_platform_payment: true,
        status: 'EN_ATTENTE', payment_status: 'PENDING',
    }).select('id').single();
    assert.equal(error, null, `réservation de table : ${error?.message}`);
    return reservation.id;
}

async function createPlan(price: number): Promise<string> {
    const { data, error } = await service.from('subscription_plans').insert({
        code: `TEST-${randomUUID()}`, name: 'Pack de test (lot 3)', description: 'Plan dédié aux tests financiers.',
        price, billing_period: 'MONTHLY', features: {}, is_active: true,
    }).select('id').single();
    assert.equal(error, null, `plan d'abonnement : ${error?.message}`);
    return data.id;
}

// ── Paiement par la route ──────────────────────────────────────────────────

async function pay(payer: Buyer, targetType: Target, targetId: string): Promise<PaymentRow> {
    const res = await createPaymentRoute(jsonRequest('/api/payments/create', 'POST', payer.accessToken, {
        targetType, targetId, operator: 'WAVE', payerPhone: payer.phone9,
    }));
    const body = (await res.json()) as Record<string, unknown>;
    assert.equal(res.status, 201, `création du paiement ${targetType} : HTTP ${res.status} ${JSON.stringify(body)}`);
    assert.equal(typeof body.payment_id, 'string', 'identifiant du paiement renvoyé');
    const payment = await paymentById(String(body.payment_id));
    assert.equal(payment.status, 'PENDING');
    assert.equal(payment.payment_target, targetType);
    assert.ok(payment.external_transaction_id, 'identifiant SamirPay enregistré');
    const init = initCalls().find((c) => c.orderId === payment.external_order_id);
    assert.ok(init, 'initialisation SamirPay');
    assert.equal(Number(init!.args.amount), Number(payment.amount), 'montant envoyé à SamirPay = total du paiement');
    return payment;
}

async function confirmBySamirPay(payment: PaymentRow): Promise<PaymentRow> {
    providerSays(payment, 'SUCCESS');
    const hook = await deliverWebhook(payment);
    assert.equal(hook.status, 200, 'webhook accepté');
    const confirmed = await paymentById(payment.id);
    assert.equal(confirmed.status, 'SUCCESS', `paiement confirmé (${confirmed.status})`);
    return confirmed;
}

async function failBySamirPay(payment: PaymentRow): Promise<PaymentRow> {
    const { error } = await service.from('payments').update({ created_at: new Date(Date.now() - 20 * 60_000).toISOString() }).eq('id', payment.id);
    assert.equal(error, null, `vieillissement : ${error?.message}`);
    providerSays(payment, 'FAILED');
    const res = await cron(cronRequest('/api/cron/payments-reconcile'));
    assert.equal(res.status, 200, `réconciliation : ${JSON.stringify(await res.clone().json())}`);
    const failed = await paymentById(payment.id);
    assert.equal(failed.status, 'FAILED', `paiement en échec (${failed.status})`);
    return failed;
}

// ── Montants du contrat B ──────────────────────────────────────────────────

function unitServiceFee(unitPrice: number, ratePercent: number): number {
    return Math.ceil(Number((unitPrice * ratePercent / 100).toFixed(6)));
}

/** Marché (commande, salle, table) : une ligne, quantité 1. */
async function assertMarketAmounts(payment: PaymentRow, facial: number): Promise<void> {
    const serviceRate = Number(await getSetting('finance.service_fee_rate'));
    const aggRate = Number(await getSetting('finance.aggregator_fee_rate.WAVE'));
    const serviceFee = unitServiceFee(facial, serviceRate);
    const total = facial + serviceFee;
    const aggregator = round2(total * aggRate / 100);
    assert.equal(Number(payment.facial_amount), facial, 'facial = montant dû de la cible');
    assert.equal(Number(payment.service_fee), serviceFee, 'frais de service payés par l’acheteur');
    assert.equal(Number(payment.amount), total, 'total débité = facial + frais de service');
    assert.equal(Number(payment.partner_payout_amount), facial, 'reversement partenaire = facial (frais non déduits)');
    assert.equal(Number(payment.aggregator_fee), aggregator, 'agrégateur calculé sur le total, taux Wave');
    assert.equal(Number(payment.net_event_village_revenue), round2(serviceFee - aggregator), 'net EV = service − agrégateur');
    assert.equal(Number(payment.service_fee_rate), serviceRate, 'taux de service recopié sur le paiement');
    assert.equal(Number(payment.aggregator_fee_rate), aggRate, 'taux d’agrégateur recopié sur le paiement');
}

async function assertSubscriptionAmounts(payment: PaymentRow, price: number): Promise<void> {
    const aggRate = Number(await getSetting('finance.aggregator_fee_rate.WAVE'));
    const aggregator = round2(price * aggRate / 100);
    assert.equal(Number(payment.facial_amount), price, 'facial = prix du plan');
    assert.equal(Number(payment.service_fee), 0, 'abonnement : aucun frais de service');
    assert.equal(Number(payment.amount), price, 'abonnement : total = prix du plan');
    assert.equal(Number(payment.partner_payout_amount), 0, 'abonnement : aucun reversement');
    assert.equal(Number(payment.aggregator_fee), aggregator);
    assert.equal(Number(payment.net_event_village_revenue), round2(price - aggregator), 'abonnement : net EV = facial − agrégateur');
}

async function row(table: string, id: string, columns: string): Promise<Record<string, unknown>> {
    const { data, error } = await service.from(table).select(columns).eq('id', id).single();
    assert.equal(error, null, `${table} ${id} : ${error?.message}`);
    return data as unknown as Record<string, unknown>;
}

// ── Parcours ───────────────────────────────────────────────────────────────

describe('Commande (ORDER)', () => {
    test('paiement en ligne : PENDING, montants du contrat, succès SamirPay → SUCCESS, commande confirmée', async () => {
        const orderId = await createOrder(10_000);
        const payment = await pay(client, 'ORDER', orderId);
        await assertMarketAmounts(payment, 10_000);
        await confirmBySamirPay(payment);
        const order = await row('orders', orderId, 'payment_status, order_status');
        assert.equal(order.payment_status, 'SUCCESS');
        assert.equal(order.order_status, 'CONFIRMEE');
    });

    test('échec chez SamirPay, réconciliation → FAILED, commande annulée', async () => {
        const orderId = await createOrder(10_000);
        const payment = await pay(client, 'ORDER', orderId);
        await failBySamirPay(payment);
        const order = await row('orders', orderId, 'payment_status, order_status');
        assert.equal(order.payment_status, 'FAILED');
        assert.equal(order.order_status, 'ANNULEE');
    });
});

describe('Réservation de salle (HALL_RESERVATION)', () => {
    test('paiement en ligne : PENDING, montants du contrat, succès SamirPay → SUCCESS, réservation confirmée', async () => {
        const reservationId = await createHallReservation(50_000);
        const payment = await pay(client, 'HALL_RESERVATION', reservationId);
        await assertMarketAmounts(payment, 50_000);
        await confirmBySamirPay(payment);
        const reservation = await row('hall_reservations', reservationId, 'payment_status, status');
        assert.equal(reservation.payment_status, 'SUCCESS');
        assert.equal(reservation.status, 'CONFIRMEE');
    });

    test('échec chez SamirPay, réconciliation → FAILED, réservation annulée (créneau libéré)', async () => {
        const reservationId = await createHallReservation(50_000);
        const payment = await pay(client, 'HALL_RESERVATION', reservationId);
        await failBySamirPay(payment);
        const reservation = await row('hall_reservations', reservationId, 'payment_status, status');
        assert.equal(reservation.payment_status, 'FAILED');
        assert.equal(reservation.status, 'ANNULEE');
    });
});

describe('Réservation de table (TABLE_RESERVATION)', () => {
    test('paiement en ligne : PENDING, montants du contrat, succès SamirPay → SUCCESS, réservation confirmée', async () => {
        const reservationId = await createTableReservation(10_000);
        const payment = await pay(client, 'TABLE_RESERVATION', reservationId);
        await assertMarketAmounts(payment, 10_000);
        await confirmBySamirPay(payment);
        const reservation = await row('table_reservations', reservationId, 'payment_status, status');
        assert.equal(reservation.payment_status, 'SUCCESS');
        assert.equal(reservation.status, 'CONFIRMEE');
    });

    test('échec chez SamirPay, réconciliation → FAILED, réservation annulée (table libérée)', async () => {
        const reservationId = await createTableReservation(10_000);
        const payment = await pay(client, 'TABLE_RESERVATION', reservationId);
        await failBySamirPay(payment);
        const reservation = await row('table_reservations', reservationId, 'payment_status, status');
        assert.equal(reservation.payment_status, 'FAILED');
        assert.equal(reservation.status, 'ANNULEE');
    });
});

describe('Abonnement partenaire (SUBSCRIPTION)', () => {
    test('paiement en ligne : PENDING, sans frais de service, succès SamirPay → SUCCESS, plan activé', async () => {
        const planId = await createPlan(25_000);
        const subscriber = await newPartner('abonne');
        const payment = await pay(subscriber, 'SUBSCRIPTION', planId);
        await assertSubscriptionAmounts(payment, 25_000);
        await confirmBySamirPay(payment);
        const p = await row('partners', subscriber.partnerId, 'subscription_plan_id');
        assert.equal(p.subscription_plan_id, planId, 'plan activé sur la fiche partenaire');
    });

    test('échec chez SamirPay, réconciliation → FAILED, plan non activé', async () => {
        const planId = await createPlan(25_000);
        const subscriber = await newPartner('abonne-echec');
        const payment = await pay(subscriber, 'SUBSCRIPTION', planId);
        await failBySamirPay(payment);
        const p = await row('partners', subscriber.partnerId, 'subscription_plan_id');
        assert.equal(p.subscription_plan_id, null, 'aucun plan activé après un échec');
    });
});
