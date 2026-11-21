/**
 * Lot 12a — preuve des trous de l'ancien code des commandes (relevé du 21/11, rapport § 1), éprouvés par les routes et la
 * lecture REST, avec des corps acceptés par l'ancien code comme par le nouveau. Rouge sur main (2ec11bb66), vert après
 * le lot :
 *  F1. la partenaire écrit n'importe quel statut : une commande jamais payée passe « livrée » (PATCH /api/partner/orders/[id]) ;
 *  F2. la partenaire lit par REST ses commandes, avec le nom et le téléphone du client, sans limite de durée ;
 *  F3. une quantité négative dans le panier fait une remise : 10 000 F de produits pour 2 000 F (POST /api/orders/create) ;
 *  F4. un produit d'une autre partenaire est vendu sous le nom de la partenaire choisie (POST /api/orders/create) ;
 *  F5. la liste de la partenaire montre les commandes jamais payées, avec le téléphone du client (GET /api/partner/orders).
 * Base LOCALE, service des commandes ouvert le temps de la suite.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { BASE_URL } from './helpers';
import { newPartner, type TestPartner } from './finance-helpers';
import { newBuyer, service, type Buyer } from './paiement-helpers';
import { platformSetting, setPlatformSetting } from './l10a-helpers';
import { PATCH as partnerOrderPatch } from '../../app/api/partner/orders/[id]/route';
import { GET as partnerOrdersGet } from '../../app/api/partner/orders/route';
import { POST as createOrderRoute } from '../../app/api/orders/create/route';

let before0: unknown;
let partner: TestPartner;
let other: TestPartner;
let client: Buyer;

before(async () => {
    before0 = await platformSetting('features.orders_enabled');
    await setPlatformSetting('features.orders_enabled', true, 'preuve des trous du lot 12a');
    partner = await newPartner('l12a-trous');
    other = await newPartner('l12a-trous-autre');
    client = await newBuyer('l12a-trous-client');
});

after(async () => {
    await setPlatformSetting('features.orders_enabled', before0, 'preuve des trous du lot 12a');
});

function req(path: string, method: string, token: string, body?: unknown): NextRequest {
    return new NextRequest(`${BASE_URL}${path}`, {
        method, headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: body === undefined ? undefined : JSON.stringify(body),
    });
}

/** Commande de l'ancien code (insertion directe, comme le faisait la route), jamais payée. */
async function legacyOrder(): Promise<string> {
    const { data, error } = await service.from('orders').insert({
        order_number: `CMD-TROU-${randomUUID()}`, client_id: client.userId, partner_id: partner.partnerId, subtotal: 5_000, total_amount: 5_000,
        paid_amount: 0, balance_amount: 5_000, payment_type: 'INTEGRAL', delivery_mode: 'LIVRAISON', delivery_address: 'Villa 3, Ouakam',
        order_status: 'EN_ATTENTE', payment_status: 'PENDING',
    }).select('id').single();
    assert.equal(error, null, `commande : ${error?.message}`);
    return String(data!.id);
}

async function product(owner: TestPartner, price: number): Promise<string> {
    const { data, error } = await service.from('products').insert({
        partner_id: owner.partnerId, name: `TEST Produit trou ${randomUUID().slice(0, 6)}`, price, status: 'DISPONIBLE',
    }).select('id').single();
    assert.equal(error, null, `produit : ${error?.message}`);
    return String(data!.id);
}

async function ordersOfClient(): Promise<Array<Record<string, unknown>>> {
    const { data, error } = await service.from('orders').select('id, subtotal, partner_id').eq('client_id', client.userId);
    assert.equal(error, null, error?.message);
    return (data ?? []) as Array<Record<string, unknown>>;
}

describe('Lot 12a — trous de l’ancien code des commandes', () => {
    test('F1 : une commande jamais payée ne passe pas « livrée » par la partenaire', async () => {
        const id = await legacyOrder();
        const res = await partnerOrderPatch(req(`/api/partner/orders/${id}`, 'PATCH', partner.accessToken, { order_status: 'LIVREE' }), { params: Promise.resolve({ id }) });
        const { data } = await service.from('orders').select('order_status, payment_status').eq('id', id).single();
        assert.notEqual(data?.order_status, 'LIVREE', `commande jamais payée écrite « livrée » par la partenaire (HTTP ${res.status})`);
    });

    test('F2 : la partenaire ne lit pas les commandes par REST (nom, téléphone, adresse du client)', async () => {
        const id = await legacyOrder();
        const rest = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
            auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${partner.accessToken}` } },
        });
        const { data } = await rest.from('orders').select('id, delivery_address').eq('id', id);
        assert.deepEqual(data ?? [], [], `lecture REST de la commande et de l’adresse du client par la partenaire : ${JSON.stringify(data)}`);
    });

    test('F3 : une quantité négative ne fait pas une remise (10 000 F de produits pour 2 000 F)', async () => {
        const a = await product(partner, 10_000);
        const b = await product(partner, 4_000);
        const before1 = (await ordersOfClient()).length;
        const res = await createOrderRoute(req('/api/orders/create', 'POST', client.accessToken, {
            partnerId: partner.partnerId, deliveryMode: 'RETRAIT', items: [{ id: a, quantity: 1 }, { id: b, quantity: -2 }],
        }));
        const created = (await ordersOfClient()).length - before1;
        assert.equal(created, 0, `commande créée avec une quantité négative (HTTP ${res.status}) : ${JSON.stringify(await res.json())}`);
    });

    test('F4 : le produit d’une autre partenaire n’est pas vendu sous le nom de la partenaire choisie', async () => {
        const foreign = await product(other, 3_000);
        const before1 = (await ordersOfClient()).length;
        const res = await createOrderRoute(req('/api/orders/create', 'POST', client.accessToken, {
            partnerId: partner.partnerId, deliveryMode: 'RETRAIT', items: [{ id: foreign, quantity: 1 }],
        }));
        const created = (await ordersOfClient()).length - before1;
        assert.equal(created, 0, `commande créée chez une partenaire avec le produit d’une autre (HTTP ${res.status})`);
    });

    test('F5 : la liste de la partenaire ne montre ni les commandes jamais payées, ni le téléphone du client', async () => {
        const id = await legacyOrder();
        const res = await partnerOrdersGet(req('/api/partner/orders', 'GET', partner.accessToken));
        const text = await res.text();
        assert.equal(text.includes(id), false, `commande jamais payée listée à la partenaire (HTTP ${res.status})`);
        assert.equal(text.includes(client.phoneE164) || text.includes(client.phone9), false, 'téléphone du client montré à la partenaire');
    });
});
