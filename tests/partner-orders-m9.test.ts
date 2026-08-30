import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { ProductService } from '../lib/products/product.service';
import { OrderService } from '../lib/orders/order.service';

// Charger .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
            const [k, ...v] = trimmed.split('=');
            process.env[k.trim()] = v.join('=').trim();
        }
    });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const adminClient = createClient(supabaseUrl, serviceRoleKey);

async function createTestUsers(prefix: string) {
    const uniqueSuffix = `${prefix}_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
    const phoneP = `+22177${Math.floor(1000000 + Math.random() * 9000000)}`;
    const phoneC = `+22176${Math.floor(1000000 + Math.random() * 9000000)}`;
    const emailP = `partner.m9.${uniqueSuffix}@eventvillage.sn`;
    const emailC = `client.m9.${uniqueSuffix}@eventvillage.sn`;

    const { data: authP, error: errP } = await adminClient.auth.admin.createUser({
        email: emailP, password: 'Password123!', email_confirm: true, phone: phoneP, phone_confirm: true,
        user_metadata: { first_name: 'P', last_name: 'P', phone: phoneP },
    });
    const { data: authC, error: errC } = await adminClient.auth.admin.createUser({
        email: emailC, password: 'Password123!', email_confirm: true, phone: phoneC, phone_confirm: true,
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

test('Test 2 : CRÉATION COMMANDE & CALCUL FINANCIER', async () => {
    const { partnerUserId, clientId, partnerId } = await createTestUsers('fin');
    try {
        const prod1 = await ProductService.createProduct(partnerUserId, {
            name: 'Plat 1', price: 5000, is_stock_managed: false
        });
        const prod2 = await ProductService.createProduct(partnerUserId, {
            name: 'Plat 2', price: 3000, is_stock_managed: false
        });

        const order = await OrderService.createOrder(clientId, {
            partner_id: partnerId,
            items: [
                { product_id: prod1.id, quantity: 2 },
                { product_id: prod2.id, quantity: 1 }
            ],
            delivery_mode: 'SUR_PLACE',
            payment_type: 'INTEGRAL',
            delivery_fee: 1000
        });

        // Subtotal = 2*5000 + 1*3000 = 13000
        // Total = 13000 + 1000 = 14000
        assert.equal(order.subtotal, 13000);
        assert.equal(order.total_amount, 14000);
        
        // Commission (5% de subtotal par défaut) = 13000 * 0.05 = 650
        assert.equal(order.service_fee, 650);

        assert.equal(order.payment_status, 'PENDING');
        assert.equal(order.order_status, 'EN_ATTENTE');

        // Check order items
        const { data: items } = await adminClient.from('order_items').select('*').eq('order_id', order.id);
        assert.equal(items?.length, 2);
        
        const plat1 = items?.find(i => i.product_name === 'Plat 1');
        assert.equal(plat1?.unit_price, 5000);
        assert.equal(plat1?.total_price, 10000);

    } finally {
        await cleanupTestUsers(partnerUserId, clientId);
    }
});

test('Test 3 : CYCLE STATUTS', async () => {
    const { partnerUserId, clientId, partnerId } = await createTestUsers('cycle');
    try {
        const prod = await ProductService.createProduct(partnerUserId, {
            name: 'Plat Cycle', price: 5000, is_stock_managed: false
        });

        let order = await OrderService.createOrder(clientId, {
            partner_id: partnerId,
            items: [{ product_id: prod.id, quantity: 1 }],
            delivery_mode: 'LIVRAISON',
            payment_type: 'INTEGRAL'
        });

        const statuses = ['CONFIRMEE', 'EN_PREPARATION', 'PRETE', 'EN_LIVRAISON', 'LIVREE'];
        
        for (const status of statuses) {
            order = await OrderService.updateOrderStatus(order.id, partnerUserId, status);
            assert.equal(order.order_status, status);
        }
    } finally {
        await cleanupTestUsers(partnerUserId, clientId);
    }
});

test('Test 4 : BLOCAGE PRODUIT INTERDIT', async () => {
    const { partnerUserId, clientId, partnerId } = await createTestUsers('block');
    try {
        const prod = await ProductService.createProduct(partnerUserId, {
            name: 'Plat Suspendu', price: 5000, is_stock_managed: false, status: 'SUSPENDU'
        });

        await assert.rejects(
            OrderService.createOrder(clientId, {
                partner_id: partnerId,
                items: [{ product_id: prod.id, quantity: 1 }],
                delivery_mode: 'SUR_PLACE',
                payment_type: 'INTEGRAL'
            }),
            /est suspendu et ne peut pas être commandé/
        );

        // Check 0 orders
        const { data: orders } = await adminClient.from('orders').select('*').eq('partner_id', partnerId);
        assert.equal(orders?.length, 0);

    } finally {
        await cleanupTestUsers(partnerUserId, clientId);
    }
});

test('Test 5 : ANNULATION & RÉGULARISATION STOCK', async () => {
    const { partnerUserId, clientId, partnerId } = await createTestUsers('cancel');
    try {
        const prod = await ProductService.createProduct(partnerUserId, {
            name: 'Plat Limité', price: 5000, is_stock_managed: true, stock_quantity: 5
        });

        const order = await OrderService.createOrder(clientId, {
            partner_id: partnerId,
            items: [{ product_id: prod.id, quantity: 3 }],
            delivery_mode: 'SUR_PLACE',
            payment_type: 'INTEGRAL'
        });

        // Stock should be 2
        let dbProd = await ProductService.getProductById(prod.id);
        assert.equal(dbProd.stock_quantity, 2);

        // Cancel order
        await OrderService.cancelOrder(order.id, partnerUserId, 'Plus faim');

        // Stock should be restored to 5
        dbProd = await ProductService.getProductById(prod.id);
        assert.equal(dbProd.stock_quantity, 5);
        
        // Also ensure order status is cancelled
        const orders = await OrderService.getPartnerOrders(partnerUserId);
        assert.equal(orders[0].order_status, 'ANNULEE');

    } finally {
        await cleanupTestUsers(partnerUserId, clientId);
    }
});
