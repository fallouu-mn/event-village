/**
 * Lot 7 — 7.3 : attente de paiement honnête et aucun double paiement (contrat §7.1, M6, 3.5, D4 ; écrivain
 * « Client », W7). Faux SamirPay de tests/fakes.
 *  1. second checkout (autre Idempotency-Key) pendant un PENDING non échu du même compte et du même
 *     événement → 409 PAYMENT_PENDING avec le payment_id du premier et status_page_url, aucune réservation ni
 *     appel SamirPay de plus ; autre événement → 200 ; après échéance (held_expires_at reculé en base locale)
 *     → 200 ; même clé → doublon actuel (200, même paiement) ;
 *  2. deux checkouts simultanés (clés différentes) → un seul PENDING, l'autre 409 PAYMENT_PENDING ;
 *  3. annulation par le client vérifiée chez SamirPay avant de libérer : SamirPay SUCCESS → 409
 *     PAYMENT_ALREADY_CONFIRMED et billets émis ; SamirPay injoignable → 503 PROVIDER_UNAVAILABLE, paiement
 *     toujours PENDING, réservation intacte ; SamirPay PENDING → annulation (200 CANCELLED, réservation
 *     libérée), après une interrogation de SamirPay ;
 *  4. succès tardif d'un paiement annulé → billets émis (D4) ;
 *  5. GET /api/payments/[id]/status enrichi : target_type, event, ticket_count, items, payer_phone_masked,
 *     receipt_channels, success_url, retry_url ; abonnement → /partner/subscription, sans événement ;
 *  6. GET /api/checkout/pending?eventId= : le PENDING du compte seulement (401 sans session).
 *
 * Rouge avant correctif (fix(7.3s), A5) :
 *  - 1 et 2 : aucune garde (checkout_create_payment, 20261101000003_lot3_moteur.sql:162-…, ne cherche que
 *    le doublon par clé) : le second paiement est créé (200) ;
 *  - 3 : app/api/payments/[transactionId]/cancel/route.ts libère sans interroger SamirPay (200 CANCELLED dans
 *    les trois cas, aucun appel checkTransactionStatus) ;
 *  - 5 : la route de statut ne renvoie que payment_id, status, montants, operator, expires_at, ticket_ids ;
 *  - 6 : app/api/checkout/pending/route.ts absent.
 * Vert dès l'écriture (couverture ajoutée, signalé) : 4 (confirmation.service.ts:75, payment_confirm accepte
 * un paiement CANCELLED tant que le stock le permet) ; dans 1, « même clé → même paiement ».
 *
 * SamirPay injoignable : la méthode checkTransactionStatus du faux est remplacée le temps du cas par une
 * fonction qui enregistre l'appel et lève SamirPayError UNCERTAIN (comme un délai dépassé), puis rétablie dans
 * un finally.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { isModuleNotFound } from '../helpers/notification-invariants';
import { maskPhone } from '../../lib/payments/payer-phone';
import { SamirPayError } from '../../lib/samirpay/types';
import { BASE_URL, routeContext } from './helpers';
import {
    callsOf, cart, categoryState, checkout, createSaleEvent, deliverWebhook, eventTickets, fakePay, importModule, initCalls,
    newBuyer, paymentById, paymentsOf, pollStatus, providerSays, service, type Buyer, type PaymentRow, type SaleEvent,
} from './paiement-helpers';
import { newPartner } from './finance-helpers';
import { assertTerrainInvariants } from './terrain-helpers';

type Row = Record<string, unknown>;
interface Result { status: number; body: Row }

let ev: SaleEvent;
let other: SaleEvent;

before(async () => {
    ev = await createSaleEvent('attente-lot7', [
        { name: 'Standard', price: 3_000, total: 80, maxPerOrder: 10 },
        { name: 'VIP', price: 10_000, total: 20, maxPerOrder: 5 },
    ]);
    other = await createSaleEvent('attente-lot7-autre', [{ name: 'Standard', price: 2_500, total: 20 }]);
});

after(async () => {
    await assertTerrainInvariants('paiement-attente-lot7');
});

// ── Aides locales ──────────────────────────────────────────────────────────

async function loadHandler(modPath: string, method: string, contract: string): Promise<(req: NextRequest, ctx?: unknown) => Promise<Response>> {
    let mod: Record<string, unknown>;
    try {
        mod = await importModule(modPath);
    } catch (err) {
        if (isModuleNotFound(err, modPath)) {
            assert.fail(`module absent : ${modPath.replace(/^(\.\.\/)+/, '')}.ts (${contract}, fix(7.3s)) — ${String((err as Error).message).split('\n')[0]}`);
        }
        throw err;
    }
    assert.equal(typeof mod[method], 'function', `${modPath.replace(/^(\.\.\/)+/, '')}.ts : ${method} non exporté`);
    return mod[method] as (req: NextRequest, ctx?: unknown) => Promise<Response>;
}

async function asResult(res: Response): Promise<Result> {
    const text = await res.text();
    let body: Row = {};
    try {
        body = text ? JSON.parse(text) : {};
    } catch {
        body = { raw: text }; // corps non JSON conservé tel quel pour le message d'échec
    }
    return { status: res.status, body };
}

async function cancelPayment(buyer: Buyer, paymentId: string): Promise<Result> {
    const cancel = await loadHandler('../../app/api/payments/[transactionId]/cancel/route', 'POST', 'contrat 3.5');
    const req = new NextRequest(`${BASE_URL}/api/payments/${paymentId}/cancel`, { method: 'POST', headers: { authorization: `Bearer ${buyer.accessToken}` } });
    return asResult(await cancel(req, routeContext({ transactionId: paymentId })));
}

async function pendingOf(token: string | null, eventId: string): Promise<Result> {
    const get = await loadHandler('../../app/api/checkout/pending/route', 'GET', 'contrat 3.5, GET /api/checkout/pending');
    const headers: Record<string, string> = {};
    if (token) headers.authorization = `Bearer ${token}`;
    return asResult(await get(new NextRequest(`${BASE_URL}/api/checkout/pending?eventId=${eventId}`, { method: 'GET', headers })));
}

function brief(r: { status: number; body: Row }): string {
    return `HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 400)}`;
}

/** Appels checkTransactionStatus enregistrés par le faux pour cette transaction. */
function statusChecks(payment: PaymentRow): number {
    return callsOf('checkTransactionStatus').filter((c) => c.args.transactionId === payment.external_transaction_id).length;
}

/** Remplace checkTransactionStatus du faux par un SamirPay injoignable le temps de fn (rétabli dans un finally). */
async function withProviderUnreachable<T>(fn: (attempts: () => number) => Promise<T>): Promise<T> {
    const fake = fakePay();
    const original = fake.checkTransactionStatus;
    let attempts = 0;
    fake.checkTransactionStatus = async (transactionId: string) => {
        attempts += 1;
        fake.calls.push({ method: 'checkTransactionStatus', args: { transactionId, simulated: 'UNREACHABLE' }, at: new Date().toISOString() });
        throw new SamirPayError('UNCERTAIN', 'SamirPay injoignable (simulation du test)');
    };
    try {
        return await fn(() => attempts);
    } finally {
        fake.checkTransactionStatus = original;
    }
}

async function pendingPayment(label: string, items: Array<[string, number]> = [['Standard', 2]]): Promise<{ buyer: Buyer; payment: PaymentRow }> {
    const buyer = await newBuyer(label);
    const r = await checkout(buyer, cart(ev.eventId, items.map(([name, q]) => [ev.categories[name].id, q]), buyer));
    assert.equal(r.status, 200, `checkout de préparation : ${brief(r)}`);
    assert.ok(r.payment, 'paiement de préparation créé');
    assert.equal(r.payment!.status, 'PENDING', 'paiement de préparation PENDING');
    return { buyer, payment: r.payment! };
}

// ── 1. Un seul paiement en attente par compte et par événement ─────────────

describe('7.3 — paiement : refus d\'un second paiement en attente (D4, M6)', () => {
    test('autre clé pendant un PENDING → 409 PAYMENT_PENDING ; autre événement → 200 ; après échéance → 200 ; même clé → doublon', async () => {
        const buyer = await newBuyer('attente-second');
        const key = randomUUID();
        const body = cart(ev.eventId, [[ev.categories.Standard.id, 2]], buyer);
        const first = await checkout(buyer, body, { idempotencyKey: key });
        assert.equal(first.status, 200, `premier paiement : ${brief(first)}`);
        const firstId = String(first.body.payment_id);

        const heldBefore = await categoryState(ev.categories.Standard.id);
        const initsBefore = initCalls().length;
        const second = await checkout(buyer, cart(ev.eventId, [[ev.categories.Standard.id, 1]], buyer, 'ORANGE_MONEY'));
        assert.equal(second.status, 409, `second paiement (autre clé, autre opérateur) : ${brief(second)}`);
        assert.equal(second.body.code, 'PAYMENT_PENDING', `code : ${brief(second)}`);
        assert.equal(second.body.payment_id, firstId, 'payment_id du paiement déjà en attente');
        assert.equal(second.body.status_page_url, `/paiement/${firstId}`, 'lien vers la page de suivi du premier paiement');
        assert.equal(second.body.error, 'Un paiement est déjà en attente pour cet événement.', 'message du contrat 3.5');
        assert.deepEqual((await paymentsOf(buyer.userId)).map((p) => p.id), [firstId], 'aucun paiement de plus');
        assert.deepEqual(await categoryState(ev.categories.Standard.id), heldBefore, 'aucune réservation de plus');
        assert.equal(initCalls().length, initsBefore, 'aucun appel SamirPay de plus');

        const replay = await checkout(buyer, body, { idempotencyKey: key });
        assert.equal(replay.status, 200, `même clé : doublon actuel : ${brief(replay)}`);
        assert.equal(replay.body.payment_id, firstId, 'même clé : même paiement');

        const elsewhere = await checkout(buyer, cart(other.eventId, [[other.categories.Standard.id, 1]], buyer));
        assert.equal(elsewhere.status, 200, `autre événement : ${brief(elsewhere)}`);
        assert.notEqual(elsewhere.body.payment_id, firstId, 'autre événement : nouveau paiement');

        const { error } = await service.from('payments').update({ held_expires_at: new Date(Date.now() - 60_000).toISOString() }).eq('id', firstId);
        assert.equal(error, null, `échéance reculée : ${error?.message}`);
        const afterExpiry = await checkout(buyer, cart(ev.eventId, [[ev.categories.Standard.id, 1]], buyer));
        assert.equal(afterExpiry.status, 200, `après l'échéance du premier : ${brief(afterExpiry)}`);
        assert.notEqual(afterExpiry.body.payment_id, firstId, 'après échéance : nouveau paiement');
    });

    test('deux checkouts simultanés (clés différentes) → un seul PENDING, l\'autre 409 PAYMENT_PENDING', async () => {
        const buyer = await newBuyer('attente-simultane');
        const initsBefore = initCalls().length;
        const results = await Promise.all([
            checkout(buyer, cart(ev.eventId, [[ev.categories.Standard.id, 1]], buyer)),
            checkout(buyer, cart(ev.eventId, [[ev.categories.Standard.id, 1]], buyer, 'ORANGE_MONEY')),
        ]);
        const statuses = results.map((r) => r.status).sort();
        assert.deepEqual(statuses, [200, 409], `réponses : ${results.map(brief).join(' | ')}`);
        const won = results.find((r) => r.status === 200)!;
        const lost = results.find((r) => r.status === 409)!;
        assert.equal(lost.body.code, 'PAYMENT_PENDING', `refus : ${brief(lost)}`);
        assert.equal(lost.body.payment_id, won.body.payment_id, 'le refus désigne le paiement retenu');
        const payments = await paymentsOf(buyer.userId);
        assert.deepEqual(payments.map((p) => [p.id, p.status]), [[won.body.payment_id, 'PENDING']], 'un seul paiement PENDING');
        assert.equal(initCalls().length - initsBefore, 1, 'un seul appel SamirPay');
    });
});

// ── 3 et 4. Annulation vérifiée chez SamirPay ──────────────────────────────

describe('7.3 — annulation par le client vérifiée chez SamirPay (D4, contrat 3.5)', () => {
    test('SamirPay dit SUCCESS : 409 PAYMENT_ALREADY_CONFIRMED, paiement confirmé, billets émis', async () => {
        const { buyer, payment } = await pendingPayment('attente-annule-succes');
        providerSays(payment, 'SUCCESS');
        const r = await cancelPayment(buyer, payment.id);
        assert.equal(r.status, 409, `annulation d'un paiement payé : ${brief(r)}`);
        assert.equal(r.body.code, 'PAYMENT_ALREADY_CONFIRMED', `code : ${brief(r)}`);
        assert.equal(r.body.status, 'SUCCESS', `statut renvoyé : ${brief(r)}`);
        assert.equal(r.body.error, 'Votre paiement vient d\'être confirmé.', 'message du contrat 3.5');
        assert.equal((await paymentById(payment.id)).status, 'SUCCESS', 'paiement confirmé, pas annulé');
        const tickets = (await eventTickets(ev.eventId)).filter((t) => t.payment_id === payment.id);
        assert.equal(tickets.length, 2, 'les 2 billets payés sont émis');
        assert.deepEqual([...(r.body.ticket_ids as string[] ?? [])].sort(), tickets.map((t) => String(t.id)).sort(), 'ticket_ids = billets émis');
    });

    test('SamirPay injoignable : 503 PROVIDER_UNAVAILABLE, rien n\'est annulé', async () => {
        const { buyer, payment } = await pendingPayment('attente-annule-injoignable');
        const held = await categoryState(ev.categories.Standard.id);
        await withProviderUnreachable(async (attempts) => {
            const r = await cancelPayment(buyer, payment.id);
            assert.equal(r.status, 503, `SamirPay injoignable : ${brief(r)}`);
            assert.equal(r.body.code, 'PROVIDER_UNAVAILABLE', `code : ${brief(r)}`);
            assert.equal(r.body.error, 'Vérification impossible pour le moment : réessayez dans un instant.', 'message du contrat 3.5');
            assert.ok(attempts() >= 1, 'SamirPay a été interrogé avant toute annulation');
        });
        assert.equal((await paymentById(payment.id)).status, 'PENDING', 'paiement toujours PENDING');
        assert.deepEqual(await categoryState(ev.categories.Standard.id), held, 'réservation intacte');
    });

    test('SamirPay dit PENDING : SamirPay interrogé, puis annulation (200 CANCELLED, réservation libérée)', async () => {
        const before0 = await categoryState(ev.categories.Standard.id);
        const { buyer, payment } = await pendingPayment('attente-annule-pending', [['Standard', 3]]);
        assert.equal((await categoryState(ev.categories.Standard.id)).held, before0.held + 3, 'précondition : 3 places réservées');
        const checks = statusChecks(payment);
        const r = await cancelPayment(buyer, payment.id);
        assert.equal(r.status, 200, `annulation : ${brief(r)}`);
        assert.deepEqual({ payment_id: r.body.payment_id, status: r.body.status }, { payment_id: payment.id, status: 'CANCELLED' }, `réponse : ${brief(r)}`);
        assert.ok(statusChecks(payment) > checks, 'statut demandé à SamirPay (identifiant enregistré) avant l\'annulation');
        assert.equal((await paymentById(payment.id)).status, 'CANCELLED');
        assert.deepEqual(await categoryState(ev.categories.Standard.id), before0, 'réservation libérée');
    });

    test('succès tardif d\'un paiement annulé : billets émis (D4, comportement conservé)', async () => {
        const { buyer, payment } = await pendingPayment('attente-tardif', [['VIP', 1]]);
        const r = await cancelPayment(buyer, payment.id);
        assert.equal(r.status, 200, `annulation : ${brief(r)}`);
        assert.equal((await paymentById(payment.id)).status, 'CANCELLED', 'précondition : paiement annulé');
        providerSays(payment, 'SUCCESS');
        const hook = await deliverWebhook(payment);
        assert.equal(hook.status, 200, 'webhook accepté');
        assert.equal((await paymentById(payment.id)).status, 'SUCCESS', 'succès tardif honoré');
        const tickets = (await eventTickets(ev.eventId)).filter((t) => t.payment_id === payment.id);
        assert.equal(tickets.length, 1, 'le billet payé est émis');
    });
});

// ── 5. Statut enrichi ──────────────────────────────────────────────────────

describe('7.3 — GET /api/payments/[id]/status enrichi (contrat 3.5)', () => {
    test('billets : cible, événement, nombre de billets, lignes du panier, payeur masqué, canaux, liens de succès et de reprise', async () => {
        const { buyer, payment } = await pendingPayment('attente-statut', [['Standard', 2], ['VIP', 1]]);
        const s = await pollStatus(buyer.accessToken, payment.id);
        assert.equal(s.status, 200, brief(s));
        const { data: event, error } = await service.from('events').select('id, title').eq('id', ev.eventId).single();
        assert.equal(error, null, `événement : ${error?.message}`);
        const { data: startAt, error: startErr } = await service.rpc('event_start_at', { p_event: ev.eventId });
        assert.equal(startErr, null, `event_start_at : ${startErr?.message}`);

        assert.equal(s.body.target_type, 'TICKET', `target_type : ${brief(s)}`);
        const e = s.body.event as Row | null;
        assert.ok(e && typeof e === 'object', `event absent : ${brief(s)}`);
        assert.deepEqual({ id: e.id, title: e.title }, { id: event.id, title: event.title }, 'événement du paiement');
        assert.equal(Date.parse(String(e.start_at)), Date.parse(String(startAt)), 'event.start_at = début de l\'événement');
        assert.equal(s.body.ticket_count, 3, 'ticket_count = 2 + 1');
        const items = ((s.body.items ?? []) as Row[]).map((i) => ({ category_id: i.category_id, category_name: i.category_name, quantity: i.quantity }))
            .sort((x, y) => String(x.category_name).localeCompare(String(y.category_name)));
        assert.deepEqual(items, [
            { category_id: ev.categories.Standard.id, category_name: 'Standard', quantity: 2 },
            { category_id: ev.categories.VIP.id, category_name: 'VIP', quantity: 1 },
        ], `items : ${brief(s)}`);
        assert.equal(s.body.payer_phone_masked, maskPhone(buyer.phone9), 'numéro payeur masqué (maskPhone)');
        assert.ok(!JSON.stringify(s.body).includes(buyer.phone9), 'le numéro payeur en clair n\'est jamais renvoyé');
        assert.ok(Array.isArray(s.body.receipt_channels), `receipt_channels : ${brief(s)}`);
        assert.ok((s.body.receipt_channels as string[]).includes('SMS'), 'le SMS de confirmation est prévu (PURCHASE_CONFIRMED, famille ESSENTIAL)');
        for (const c of s.body.receipt_channels as string[]) assert.ok(['IN_APP', 'PUSH', 'EMAIL', 'SMS'].includes(c), `canal inconnu : ${c}`);
        assert.equal(s.body.success_url, '/tickets', 'succès d\'un achat de billets → Mes billets');
        assert.equal(s.body.retry_url, `/events/${ev.eventId}?reprise=${payment.id}`, 'reprise vers la page de l\'événement');
    });

    test('abonnement partenaire : success_url et retry_url vers /partner/subscription, aucun événement', async () => {
        const subscriber = await newPartner('attente-abonne');
        const { data: plan, error } = await service.from('subscription_plans').insert({
            code: `TEST-ATT-${randomUUID()}`, name: 'Pack de test (attente)', description: 'Plan dédié au test du statut enrichi.',
            price: 20_000, billing_period: 'MONTHLY', features: {}, is_active: true,
        }).select('id').single();
        assert.equal(error, null, `plan : ${error?.message}`);
        const create = await loadHandler('../../app/api/payments/create/route', 'POST', 'route existante');
        const res = await asResult(await create(new NextRequest(`${BASE_URL}/api/payments/create`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', authorization: `Bearer ${subscriber.accessToken}` },
            body: JSON.stringify({ targetType: 'SUBSCRIPTION', targetId: plan.id, operator: 'WAVE', payerPhone: subscriber.phone9 }),
        })));
        assert.equal(res.status, 201, `paiement de l'abonnement : ${brief(res)}`);
        const s = await pollStatus(subscriber.accessToken, String(res.body.payment_id));
        assert.equal(s.status, 200, brief(s));
        assert.equal(s.body.target_type, 'SUBSCRIPTION', `target_type : ${brief(s)}`);
        assert.equal(s.body.event, null, 'aucun événement pour un abonnement');
        assert.equal(s.body.success_url, '/partner/subscription', 'succès → page d\'abonnement (pas /orders)');
        assert.equal(s.body.retry_url, '/partner/subscription', 'reprise → page d\'abonnement');
    });
});

// ── 6. Paiement en attente lu par la page événement ────────────────────────

describe('7.3 — GET /api/checkout/pending?eventId= (contrat 3.5)', () => {
    test('le PENDING du compte seulement ; aucun pour un autre compte ou un autre événement ; 401 sans session ; rien après annulation', async () => {
        const { buyer, payment } = await pendingPayment('attente-bandeau', [['Standard', 1]]);
        const stranger = await newBuyer('attente-bandeau-tiers');
        assert.equal((await pendingOf(null, ev.eventId)).status, 401, 'sans session : 401');
        const mine = await pendingOf(buyer.accessToken, ev.eventId);
        assert.equal(mine.status, 200, brief(mine));
        const p = mine.body.pending as Row | null;
        assert.ok(p && typeof p === 'object', `paiement en attente attendu : ${brief(mine)}`);
        const fresh = await paymentById(payment.id);
        assert.deepEqual(
            { payment_id: p.payment_id, amount: Number(p.amount), operator: p.operator, status_page_url: p.status_page_url },
            { payment_id: payment.id, amount: Number(fresh.amount), operator: 'WAVE', status_page_url: `/paiement/${payment.id}` },
            `pending : ${brief(mine)}`);
        assert.equal(Date.parse(String(p.expires_at)), Date.parse(String(fresh.held_expires_at)), 'expires_at = échéance de la réservation');
        assert.deepEqual((await pendingOf(stranger.accessToken, ev.eventId)).body, { pending: null }, 'autre compte : aucun');
        assert.deepEqual((await pendingOf(buyer.accessToken, other.eventId)).body, { pending: null }, 'autre événement : aucun');
        const c = await cancelPayment(buyer, payment.id);
        assert.equal(c.status, 200, `annulation : ${brief(c)}`);
        assert.deepEqual((await pendingOf(buyer.accessToken, ev.eventId)).body, { pending: null }, 'après annulation : aucun');
    });
});
