/**
 * Lot 9, tâche 9.3, A32 et A26 (contrat 5.4, L41, D-sec 6) — une panne n'est plus présentée comme une absence :
 * GET partner/events/[id], partner/halls/[id], partner/products/[id], partner/orders/[id].
 *  - panne : 500, code *_UNAVAILABLE, message français, journalisée, jamais 404 ;
 *  - absence réelle, uuid invalide : 404 et code *_NOT_FOUND (un uuid invalide n'est pas une panne) ;
 *  - autre propriétaire et client : 404 (événement, commande) ;
 *  - panne de la lecture du partenaire (resolvePartnerId), événement et commande : 500, journalisée.
 *
 * Panne : `during` (panne-helpers.ts, extrait de messages-bruts.test.ts:81) ; lecture du partenaire visée par son filtre
 * user_id, pour ne pas toucher aux lectures de la session.
 *
 * Rouge avant correctif : événement, salle, commande 404 sur panne ; produit 500 sans journal, avec « introuvable »
 * sur panne ; produit absent et uuid invalide 500 ; commande absente sans code. after() : assertLot9Invariants, rouge
 * jusqu'à M2 et M4.
 * Verts dès l'écriture (témoins, signalés) : les lectures nominales (200) ; événement et salle absents ou uuid invalide
 * (404 et code déjà présents par repli de route) ; événement d'un autre propriétaire, client sur un événement.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { GET as partnerEvent } from '../../app/api/partner/events/[id]/route';
import { GET as partnerHall } from '../../app/api/partner/halls/[id]/route';
import { GET as partnerOrder } from '../../app/api/partner/orders/[id]/route';
import { GET as partnerProduct } from '../../app/api/partner/products/[id]/route';
import { assertLot9Invariants } from '../helpers/lot9-invariants';
import { authed, createTimedEvent } from './acces-helpers';
import { newPartner, type TestPartner } from './finance-helpers';
import { assertClean, during, reply, routeCtx, table, tableWhere, type Reply } from './panne-helpers';
import { newBuyer, service, type Buyer, type SaleEvent } from './paiement-helpers';
import { withFeatureFlags, type FeatureFlag } from './terrain-helpers';

let partner: TestPartner;
let otherPartner: TestPartner;
let client: Buyer;
let ev: SaleEvent;
let hallId: string;
let productId: string;
let orderId: string;

before(async () => {
    partner = await newPartner('pannes-a');
    otherPartner = await newPartner('pannes-b');
    client = await newBuyer('pannes-client');
    ev = await createTimedEvent(partner.partnerId, 'pannes absences', [{ name: 'Standard', price: 5000, total: 10 }], { startsInHours: 24 });
    const { data: hall, error: hallErr } = await service.from('halls').insert({
        partner_id: partner.partnerId, name: `TEST Salle pannes ${randomUUID().slice(0, 8)}`, capacity: 100,
        price_per_day: 50_000, deposit_percentage: 30, city: 'Dakar', is_active: true,
    }).select('id').single();
    assert.equal(hallErr, null, `salle : ${hallErr?.message}`);
    hallId = hall.id;
    const { data: product, error: prodErr } = await service.from('products').insert({
        partner_id: partner.partnerId, name: `TEST Plat pannes ${randomUUID().slice(0, 8)}`, price: 4_000, status: 'DISPONIBLE',
    }).select('id').single();
    assert.equal(prodErr, null, `produit : ${prodErr?.message}`);
    productId = product.id;
    const { data: order, error: orderErr } = await service.from('orders').insert({
        order_number: `CMD-PAN-${randomUUID()}`, client_id: client.userId, partner_id: partner.partnerId, subtotal: 4_000, total_amount: 4_000,
        paid_amount: 0, balance_amount: 4_000, payment_type: 'INTEGRAL', delivery_mode: 'RETRAIT', order_status: 'EN_ATTENTE', payment_status: 'PENDING',
    }).select('id').single();
    assert.equal(orderErr, null, `commande : ${orderErr?.message}`);
    orderId = order.id;
});

after(async () => {
    await assertLot9Invariants('pannes-absences');
});

function show(r: Reply): string {
    return `HTTP ${r.status} ${r.text.slice(0, 400)}`;
}

interface Subject {
    label: string;
    table: string;
    flag: FeatureFlag | null;
    unavailable: string;
    notFound: string;
    existing: () => string;
    call: (user: Buyer, id: string) => Promise<Reply>;
    wrapped: (body: Record<string, unknown>) => string | undefined;
}

const SUBJECTS: Subject[] = [
    {
        label: 'événement', table: 'events', flag: null, unavailable: 'EVENT_UNAVAILABLE', notFound: 'EVENT_NOT_FOUND', existing: () => ev.eventId,
        call: async (user, id) => reply(await partnerEvent(authed(`/api/partner/events/${id}`, 'GET', user), routeCtx({ id }))),
        wrapped: (body) => (body.event as { id?: string } | undefined)?.id,
    },
    {
        label: 'salle', table: 'halls', flag: 'halls', unavailable: 'HALL_UNAVAILABLE', notFound: 'HALL_NOT_FOUND', existing: () => hallId,
        call: async (user, id) => reply(await partnerHall(authed(`/api/partner/halls/${id}`, 'GET', user), routeCtx({ id }))),
        wrapped: (body) => (body.hall as { id?: string } | undefined)?.id,
    },
    {
        label: 'produit', table: 'products', flag: 'orders', unavailable: 'PRODUCT_UNAVAILABLE', notFound: 'PRODUCT_NOT_FOUND', existing: () => productId,
        call: async (user, id) => reply(await partnerProduct(authed(`/api/partner/products/${id}`, 'GET', user), routeCtx({ id }))),
        wrapped: (body) => (body.product as { id?: string } | undefined)?.id,
    },
    {
        label: 'commande', table: 'orders', flag: 'orders', unavailable: 'ORDER_UNAVAILABLE', notFound: 'ORDER_NOT_FOUND', existing: () => orderId,
        call: async (user, id) => reply(await partnerOrder(authed(`/api/partner/orders/${id}`, 'GET', user), routeCtx({ id }))),
        wrapped: (body) => (body.order as { id?: string } | undefined)?.id,
    },
];

/** Service ouvert le temps de `fn`, si la route est derrière un interrupteur. */
function withFlag<T>(s: Subject, fn: () => Promise<T>): Promise<T> {
    return s.flag ? withFeatureFlags({ [s.flag]: true }, fn) : fn();
}

const assertNotFound = (r: Reply, s: Subject, what: string): void => {
    assert.equal(r.status, 404, `${what} : ${show(r)}`);
    assert.equal(r.body.code, s.notFound, `${what} : ${show(r)}`);
    assert.match(String(r.body.error), /introuvable/i, `${what} : ${show(r)}`);
};

for (const s of SUBJECTS) {
    describe(`A32 — ${s.label}`, () => {
        test(`panne de ${s.table} : 500 ${s.unavailable}, journalisée, jamais 404`, async () => {
            const { result, logged } = await withFlag(s, () => during(table(s.table), async () => s.call(partner, s.existing())));
            assert.equal(result.status, 500, `panne présentée comme une absence : ${show(result)}`);
            assertClean(result, s.table);
            assert.equal(result.body.code, s.unavailable, show(result));
            assert.match(String(result.body.error), /momentanément indisponible/, show(result));
            assert.ok(logged.length >= 1, 'panne non journalisée');
        });

        test(`${s.label} absent : 404 ${s.notFound}`, async () => {
            assertNotFound(await withFlag(s, () => s.call(partner, randomUUID())), s, 'absent');
        });

        test(`uuid invalide : 404 ${s.notFound}, pas une panne`, async () => {
            assertNotFound(await withFlag(s, () => s.call(partner, 'pas-un-uuid')), s, 'uuid invalide');
        });

        test(`témoin : ${s.label} existant, 200 (vert dès l’écriture)`, async () => {
            const r = await withFlag(s, () => s.call(partner, s.existing()));
            assert.equal(r.status, 200, show(r));
            assert.equal(s.wrapped(r.body), s.existing(), show(r));
        });
    });
}

describe('A26 — partner/events/[id], lecture du partenaire', () => {
    const event = SUBJECTS[0];

    test('panne de partners : 503 PARTNER_UNAVAILABLE (garde de la fiche), journalisée, jamais 404', async () => {
        // Lot 9 quinquies (A9 ; modification signalée au rapport) : la garde de la fiche partenaire (requireActiveSession,
        // lib/auth/partner-fiche-guard.ts) lit partners AVANT la route ; la panne y est arrêtée : 503 PARTNER_UNAVAILABLE,
        // journalisée, jamais 404 ni un passage. La règle éprouvée est la même : une panne n'est jamais présentée comme une absence.
        const { result, logged } = await during(tableWhere('partners', 'user_id', partner.userId), async () => event.call(partner, ev.eventId));
        assert.equal(result.status, 503, `panne présentée comme une absence : ${show(result)}`);
        assertClean(result, 'partners');
        assert.equal(result.body.code, 'PARTNER_UNAVAILABLE', show(result));
        assert.equal(result.body.error, 'Vérification du compte momentanément impossible.', show(result));
        assert.ok(logged.length >= 1, 'panne non journalisée');
    });

    test('témoin : événement d’un autre propriétaire, 404 EVENT_NOT_FOUND (vert dès l’écriture)', async () => {
        assertNotFound(await event.call(otherPartner, ev.eventId), event, 'autre propriétaire');
    });

    test('témoin : un client, 404 EVENT_NOT_FOUND (vert dès l’écriture)', async () => {
        assertNotFound(await event.call(client, ev.eventId), event, 'client');
    });
});

describe('A32 — partner/orders/[id], lecture du partenaire et propriété', () => {
    const order = SUBJECTS[3];

    test('panne de partners : 503 PARTNER_UNAVAILABLE (garde de la fiche), journalisée', async () => {
        // Lot 9 quinquies (A9 ; modification signalée au rapport) : la garde de la fiche partenaire (requireActiveSession,
        // lib/auth/partner-fiche-guard.ts) lit partners AVANT la route ; la panne y est arrêtée : 503 PARTNER_UNAVAILABLE,
        // journalisée, jamais 404 ni un passage. La règle éprouvée est la même : une panne n'est jamais présentée comme une absence.
        const { result, logged } = await withFlag(order, () => during(tableWhere('partners', 'user_id', partner.userId), async () => order.call(partner, orderId)));
        assert.equal(result.status, 503, show(result));
        assertClean(result, 'partners');
        assert.equal(result.body.code, 'PARTNER_UNAVAILABLE', show(result));
        assert.match(String(result.body.error), /momentanément impossible/, show(result));
        assert.ok(logged.length >= 1, 'panne non journalisée');
    });

    test('commande d’un autre propriétaire : 404 ORDER_NOT_FOUND', async () => {
        assertNotFound(await withFlag(order, () => order.call(otherPartner, orderId)), order, 'autre propriétaire');
    });
});
