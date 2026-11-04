/**
 * Lot 2.5 — contrôles AVANT tout débit (R14, client-ux-2).
 * Fonction partagée (checkout, createPayment, réservation) : catégorie active et visible,
 * événement PUBLIE et non passé, fenêtre de vente, max_per_order, stock moins réservations.
 * Échec → 400 explicite, aucune ligne payments, aucun appel SamirPay. Clé d'idempotence fournie
 * par le client (Idempotency-Key). Limite de checkout par compte (quota en base). Opérateur Wave
 * ou Orange Money obligatoire, carte bancaire refusée tant qu'elle n'est pas intégrée.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { resetServerEnvCache } from '../../lib/env';
import { POST as createPaymentRoute } from '../../app/api/payments/create/route';
import { assertPaymentInvariants } from '../helpers/payment-invariants';
import { BASE_URL } from './helpers';
import { Buyer, cart, checkout, createSaleEvent, initCalls, newBuyer, paymentsOf, SaleEvent } from './paiement-helpers';

let ev: SaleEvent;
let past: SaleEvent;
let draft: SaleEvent;

const hour = 3600 * 1000;

before(async () => {
    ev = await createSaleEvent('controles', [
        { name: 'Standard', price: 2000, total: 50, maxPerOrder: 10 },
        { name: 'Close', price: 2000, total: 10, saleEnd: new Date(Date.now() - hour).toISOString() },
        { name: 'Future', price: 2000, total: 10, saleStart: new Date(Date.now() + 24 * hour).toISOString() },
        { name: 'Cachee', price: 2000, total: 10, isVisible: false },
        { name: 'Inactive', price: 2000, total: 10, isActive: false },
    ]);
    past = await createSaleEvent('controles-passe', [{ name: 'Standard', price: 2000, total: 10 }], { daysFromNow: -2 });
    draft = await createSaleEvent('controles-brouillon', [{ name: 'Standard', price: 2000, total: 10 }], { status: 'BROUILLON' });
});

after(async () => {
    await assertPaymentInvariants('paiement-controles');
});

async function refusedBeforeDebit(buyer: Buyer, body: Record<string, unknown>, expectedCode: string, label: string, headers: { idempotencyKey?: string | null } = {}) {
    const inits = initCalls().length;
    const r = await checkout(buyer, body, headers);
    assert.equal(r.status, 400, `${label} : HTTP ${r.status} ${JSON.stringify(r.body)}`);
    const codes = JSON.stringify(r.body);
    assert.ok(codes.includes(expectedCode), `${label} : code ${expectedCode} attendu dans ${codes}`);
    assert.equal((await paymentsOf(buyer.userId)).length, 0, `${label} : aucune ligne payments`);
    assert.equal(initCalls().length, inits, `${label} : aucun appel SamirPay`);
}

describe('Contrôles avant débit', () => {
    test('11 billets pour max_per_order = 10 → 400, aucun paiement, aucun appel SamirPay', async () => {
        const b = await newBuyer('max');
        await refusedBeforeDebit(b, cart(ev.eventId, [[ev.categories.Standard.id, 11]], b), 'MAX_PER_ORDER', 'max_per_order');
    });

    test('vente close, vente pas encore ouverte, catégorie invisible ou inactive → 400', async () => {
        const b = await newBuyer('fenetre');
        await refusedBeforeDebit(b, cart(ev.eventId, [[ev.categories.Close.id, 1]], b), 'SALE_CLOSED', 'vente close');
        await refusedBeforeDebit(b, cart(ev.eventId, [[ev.categories.Future.id, 1]], b), 'SALE_NOT_STARTED', 'vente future');
        await refusedBeforeDebit(b, cart(ev.eventId, [[ev.categories.Cachee.id, 1]], b), 'CATEGORY_NOT_VISIBLE', 'catégorie invisible');
        await refusedBeforeDebit(b, cart(ev.eventId, [[ev.categories.Inactive.id, 1]], b), 'CATEGORY_INACTIVE', 'catégorie inactive');
    });

    test('événement passé ou non publié → 400', async () => {
        const b = await newBuyer('evenement');
        await refusedBeforeDebit(b, cart(past.eventId, [[past.categories.Standard.id, 1]], b), 'EVENT_PAST', 'événement passé');
        await refusedBeforeDebit(b, cart(draft.eventId, [[draft.categories.Standard.id, 1]], b), 'EVENT_NOT_PUBLISHED', 'événement non publié');
    });

    test('opérateur absent, carte bancaire, téléphone payeur invalide → 400, aucun paiement', async () => {
        const b = await newBuyer('operateur');
        const base = cart(ev.eventId, [[ev.categories.Standard.id, 1]], b);
        await refusedBeforeDebit(b, { ...base, operator: undefined }, 'OPERATOR_REQUIRED', 'opérateur absent');
        await refusedBeforeDebit(b, { ...base, operator: 'CARD' }, 'OPERATOR_REQUIRED', 'carte bancaire');
        await refusedBeforeDebit(b, { ...base, payerPhone: '12345' }, 'INVALID_PAYER_PHONE', 'téléphone invalide');
    });

    test('Idempotency-Key absente → 400', async () => {
        const b = await newBuyer('sans-cle');
        await refusedBeforeDebit(b, cart(ev.eventId, [[ev.categories.Standard.id, 1]], b), 'IDEMPOTENCY_KEY_REQUIRED', 'sans clé', { idempotencyKey: null });
    });

    test('double soumission (même Idempotency-Key, en parallèle) → un seul paiement, un seul appel SamirPay', async () => {
        const b = await newBuyer('double');
        const key = randomUUID();
        const inits = initCalls().length;
        const body = cart(ev.eventId, [[ev.categories.Standard.id, 2]], b);
        const results = await Promise.allSettled([checkout(b, body, { idempotencyKey: key }), checkout(b, body, { idempotencyKey: key })]);
        assert.ok(results.every((x) => x.status === 'fulfilled' && x.value.status === 200), `réponses : ${JSON.stringify(results.map((x) => (x.status === 'fulfilled' ? [x.value.status, x.value.body] : x.reason?.message)))}`);
        assert.equal((await paymentsOf(b.userId)).length, 1, 'un seul paiement');
        assert.equal(initCalls().length - inits, 1, 'un seul appel SamirPay');
        const ids = results.map((x) => (x.status === 'fulfilled' ? x.value.body.payment_id : null));
        assert.equal(ids[0], ids[1], 'même paiement renvoyé aux deux soumissions');
    });

    test('limite de checkout par compte (quota en base) → 429', async () => {
        const saved = process.env.CHECKOUT_PER_USER_15MIN;
        process.env.CHECKOUT_PER_USER_15MIN = '2';
        resetServerEnvCache();
        try {
            const b = await newBuyer('quota');
            // Lot 7 (T19, D4) : un second paiement en attente du même compte sur le même événement est refusé
            // (409 PAYMENT_PENDING) ; le deuxième checkout vise donc un autre événement. Le quota est par compte,
            // tous événements confondus, et contrôlé avant la création du paiement : le troisième reste un 429.
            const second = await createSaleEvent('controles-quota', [{ name: 'Standard', price: 2000, total: 10 }]);
            const targets: SaleEvent[] = [ev, second, ev];
            const statuses: number[] = [];
            for (const t of targets) statuses.push((await checkout(b, cart(t.eventId, [[t.categories.Standard.id, 1]], b))).status);
            assert.deepEqual(statuses, [200, 200, 429]);
        } finally {
            if (saved === undefined) delete process.env.CHECKOUT_PER_USER_15MIN;
            else process.env.CHECKOUT_PER_USER_15MIN = saved;
            resetServerEnvCache();
        }
    });

    test('/api/payments/create (billet) applique les mêmes contrôles : 11 billets → 400, aucun paiement', async () => {
        const b = await newBuyer('create');
        const inits = initCalls().length;
        const res = await createPaymentRoute(new NextRequest(`${BASE_URL}/api/payments/create`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', authorization: `Bearer ${b.accessToken}`, 'idempotency-key': randomUUID() },
            body: JSON.stringify({ targetType: 'TICKET', targetId: ev.categories.Standard.id, quantity: 11, operator: 'WAVE', payerPhone: b.phone9, customerPhone: b.phoneE164 }),
        }));
        assert.equal(res.status, 400, `HTTP ${res.status} ${JSON.stringify(await res.json())}`);
        assert.equal((await paymentsOf(b.userId)).length, 0);
        assert.equal(initCalls().length, inits);
    });
});
