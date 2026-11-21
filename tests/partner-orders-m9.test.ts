import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { ProductService } from '../lib/products/product.service';
// Lot 12a (modification signalée au rapport) : lib/orders/order.service.ts est retiré (total calculé par le serveur
// applicatif, statut écrit directement, stock rendu sans verrou) ; les tests 2 à 5 passent par les fonctions en base
// (order_create, order_partner_action, order_cancel), avec les mêmes intentions et les mêmes montants.
import { after, before } from 'node:test';
import {
    codeOf, newBuyer, newDeliveryZone, newPartner, newProduct, newShop, openOrdersService, order, orderBody, orderRpc, partnerAct,
    payOrder, placed, service,
} from './parcours/l12a-helpers';

// [lot 0] Chargement de .env.local supprimé : l'environnement de test (.env.test, instance Supabase locale)
// et le garde-fou anti-base réelle sont fournis par tests/helpers/env.ts.
import './helpers/env';
import { TEST_PASSWORD } from './helpers/fixture-data';
import { randomSenegalPhone } from './parcours/helpers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const adminClient = createClient(supabaseUrl, serviceRoleKey);

async function createTestUsers(prefix: string) {
    const uniqueSuffix = `${prefix}_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
    const phoneP = randomSenegalPhone('77');
    const phoneC = randomSenegalPhone('76');
    const emailP = `partner.m9.${uniqueSuffix}@eventvillage.sn`;
    const emailC = `client.m9.${uniqueSuffix}@eventvillage.sn`;

    const { data: authP, error: errP } = await adminClient.auth.admin.createUser({
        email: emailP, password: TEST_PASSWORD, email_confirm: true, phone: phoneP, phone_confirm: true,
        user_metadata: { first_name: 'P', last_name: 'P', phone: phoneP },
    });
    const { data: authC, error: errC } = await adminClient.auth.admin.createUser({
        email: emailC, password: TEST_PASSWORD, email_confirm: true, phone: phoneC, phone_confirm: true,
        user_metadata: { first_name: 'C', last_name: 'C', phone: phoneC },
    });

    if (errP || errC || !authP?.user || !authC?.user) {
        throw new Error(`Création utilisateurs échouée: ${errP?.message || errC?.message}`);
    }
    const partnerUserId = authP.user.id;
    const clientId = authC.user.id;

    await adminClient.from('users').upsert([
        { id: partnerUserId, email: emailP, phone: phoneP, first_name: 'P', last_name: 'P', role: 'PARTENAIRE', status: 'ACTIF' },
        { id: clientId, email: emailC, phone: phoneC, first_name: 'C', last_name: 'C', role: 'CLIENT', status: 'ACTIF' }
    ]);

    const { data: partner } = await adminClient.from('partners').insert({
        user_id: partnerUserId, company_name: `Partner M9 ${uniqueSuffix}`, phone: phoneP, status: 'VALIDE'
    }).select().single();

    return { partnerUserId, clientId, partnerId: partner.id };
}

async function cleanupTestUsers(partnerUserId: string, clientId: string) {
    await adminClient.from('partners').delete().eq('user_id', partnerUserId);
    await adminClient.from('users').delete().in('id', [partnerUserId, clientId]);
    await adminClient.auth.admin.deleteUser(partnerUserId);
    await adminClient.auth.admin.deleteUser(clientId);
}

test('Test 1 : CRUD PRODUIT - Créer catégorie + produit, modifier, changer statut', async () => {
    const { partnerUserId, clientId } = await createTestUsers('crud');
    try {
        const cat = await ProductService.createCategory(partnerUserId, { name: 'Boissons', sort_order: 1 });
        assert.ok(cat.id);

        let prod = await ProductService.createProduct(partnerUserId, {
            category_id: cat.id,
            name: 'Coca Cola',
            price: 1500,
            is_stock_managed: false
        });
        assert.ok(prod.id);
        assert.equal(prod.status, 'DISPONIBLE');

        prod = await ProductService.updateProduct(prod.id, partnerUserId, { price: 2000 });
        assert.equal(prod.price, 2000);

        prod = await ProductService.setProductStatus(prod.id, partnerUserId, 'INDISPONIBLE');
        assert.equal(prod.status, 'INDISPONIBLE');

        const dbProd = await ProductService.getProductById(prod.id);
        assert.equal(dbProd.status, 'INDISPONIBLE');
    } finally {
        await cleanupTestUsers(partnerUserId, clientId);
    }
});

let restoreOrders: () => Promise<void>;
before(async () => { restoreOrders = await openOrdersService(); });
after(async () => { await restoreOrders(); });

test('Test 2 : CRÉATION COMMANDE & CALCUL FINANCIER (lot 12a : en base)', async () => {
    const partner = await newPartner('m9-fin');
    const client = await newBuyer('m9-fin-client');
    const shop = await newShop(partner);
    const prod1 = await newProduct(partner, shop, { name: 'Plat 1', price: 5000 });
    const prod2 = await newProduct(partner, shop, { name: 'Plat 2', price: 3000 });
    const zone = await newDeliveryZone(shop, 1000);
    const r = await orderRpc(client, orderBody(shop, [{ productId: prod1, quantity: 2 }, { productId: prod2, quantity: 1 }],
        { mode: 'LIVRAISON', zoneId: zone, address: 'Rue 10, Almadies', phone: client.phone9 }));
    assert.equal(r.ok, true, JSON.stringify(r));
    // Articles = 2 × 5 000 + 1 × 3 000 = 13 000 ; avec la zone (1 000) = 14 000 ; frais de service 5 % = 700 ; à payer 14 700
    const o = await order(String(r.order_id));
    assert.deepEqual([Number(o.subtotal), Number(o.goods_total), Number(o.first_fee), Number(o.total_amount), o.payment_status, o.order_status],
        [13000, 14000, 700, 14700, 'PENDING', 'EN_ATTENTE']);
    const { data: items } = await adminClient.from('order_items').select('*').eq('order_id', r.order_id);
    assert.equal(items?.length, 2);
    const plat1 = items?.find(i => i.product_name === 'Plat 1');
    assert.equal(Number(plat1?.unit_price), 5000);
    assert.equal(Number(plat1?.total_price), 10000);
});

test('Test 3 : CYCLE STATUTS (lot 12a : chaque étape par la fonction en base, remise contre code)', async () => {
    const partner = await newPartner('m9-cycle');
    const client = await newBuyer('m9-cycle-client');
    const shop = await newShop(partner);
    const prod = await newProduct(partner, shop, { name: 'Plat Cycle', price: 5000 });
    const zone = await newDeliveryZone(shop, 0);
    const id = await placed(client, orderBody(shop, [{ productId: prod, quantity: 1 }], { mode: 'LIVRAISON', zoneId: zone, address: 'Rue 10, Ngor', phone: client.phone9 }));
    await payOrder(client, id);
    const seen: string[] = [String((await order(id)).order_status)];
    for (const action of ['ACCEPTER', 'PREPARER', 'PRETE', 'EN_ROUTE']) {
        const res = await partnerAct(partner, id, { action });
        assert.equal(res.status, 200, `${action} : ${JSON.stringify(res.body)}`);
        seen.push(String((await order(id)).order_status));
    }
    const res = await partnerAct(partner, id, { action: 'REMETTRE', code: await codeOf(client, id) });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    seen.push(String((await order(id)).order_status));
    assert.deepEqual(seen, ['EN_ATTENTE', 'CONFIRMEE', 'EN_PREPARATION', 'PRETE', 'EN_LIVRAISON', 'LIVREE']);
});

test('Test 4 : BLOCAGE PRODUIT INTERDIT (lot 12a : refus en base)', async () => {
    const partner = await newPartner('m9-block');
    const client = await newBuyer('m9-block-client');
    const shop = await newShop(partner);
    const prod = await newProduct(partner, shop, { name: 'Plat Suspendu', price: 5000, status: 'SUSPENDU' });
    const r = await orderRpc(client, orderBody(shop, [{ productId: prod, quantity: 1 }], { mode: 'SUR_PLACE', onsiteLabel: 'Table 3' }));
    assert.deepEqual([r.ok, r.code], [false, 'PRODUCT_UNAVAILABLE'], JSON.stringify(r));
    assert.match(String(r.message), /n’est plus disponible/);
    const { data: orders } = await service.from('orders').select('id').eq('partner_id', partner.partnerId);
    assert.equal(orders?.length, 0);
});

test('Test 5 : ANNULATION & RÉGULARISATION STOCK (lot 12a : stock pris et rendu en base)', async () => {
    const partner = await newPartner('m9-cancel');
    const client = await newBuyer('m9-cancel-client');
    const shop = await newShop(partner);
    const prod = await newProduct(partner, shop, { name: 'Plat Limité', price: 5000, stock: 5 });
    const id = await placed(client, orderBody(shop, [{ productId: prod, quantity: 3 }], { mode: 'SUR_PLACE', onsiteLabel: 'Table 3' }));
    const stock = async (): Promise<number> => Number((await service.from('products').select('stock_quantity').eq('id', prod).single()).data?.stock_quantity);
    assert.equal(await stock(), 2);
    const { data, error } = await service.rpc('order_cancel', { p: { order_id: id, actor_id: client.userId, origin: 'CLIENT' } });
    assert.equal(error, null, error?.message);
    assert.equal((data as Record<string, unknown>).ok, true, JSON.stringify(data));
    assert.equal(await stock(), 5);
    assert.equal((await order(id)).order_status, 'ANNULEE');
});
