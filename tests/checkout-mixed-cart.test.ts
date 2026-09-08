import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Chargement des variables d'environnement (.env.local)
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

import { getServiceRoleClient } from '../lib/supabase/server';
import { POST as checkoutRoute } from '../app/api/checkout/route';

describe('CHECKOUT PANIER MULTI-CATÉGORIES — 5 TESTS D\'INTÉGRATION', async () => {
    const supabase = getServiceRoleClient();
    const publicAuth = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const ts = Date.now();

    // Utilisateurs de test existants
    const partnerUserId = 'e706a7a2-502c-4396-9e91-4dc6720388f7';
    const partnerId = 'a917b7ac-d542-4c2b-b5d8-ab38f866b2e7';
    const buyerUserId = 'a7345050-03cf-4967-9281-9ee5eb75615a';

    let buyerToken: string;
    let testEventId: string;
    let paidCategoryId: string;
    let freeCategoryId: string;
    const PAID_PRICE = 5000; // 5000 FCFA
    const PAID_QTY = 2;
    const FREE_QTY = 2;

    before(async () => {
        console.log('\n[SETUP] Initialisation du test de checkout multi-catégories...');

        // 1. Préparer l'acheteur
        const { data: buyerAuth } = await supabase.auth.admin.getUserById(buyerUserId);
        const buyerEmail = buyerAuth?.user?.email || 'clientA@test.com';
        await supabase.from('users').update({
            status: 'ACTIF',
            role: 'CLIENT',
            first_name: 'Acheteur',
            last_name: 'Checkout',
            phone: '221771234567'
        }).eq('id', buyerUserId);
        await supabase.from('user_roles').delete().eq('user_id', buyerUserId);
        await supabase.from('user_roles').insert({ user_id: buyerUserId, role: 'CLIENT' });
        await supabase.auth.admin.updateUserById(buyerUserId, {
            password: 'Password123!',
            email_confirm: true,
            user_metadata: { role: 'CLIENT' }
        });
        const { data: bAuth } = await publicAuth.auth.signInWithPassword({
            email: buyerEmail,
            password: 'Password123!',
        });
        buyerToken = bAuth?.session?.access_token || '';
        assert.ok(buyerToken, 'Token acheteur obtenu');

        // 2. Créer l'événement de test
        const { data: ev, error: evErr } = await supabase.from('events').insert({
            partner_id: partnerId,
            title: `Checkout Test Event ${ts}`,
            slug: `checkout-test-${ts}`,
            description: 'Événement pour tester le checkout multi-catégories',
            category: 'CONCERT',
            start_date: new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0],
            start_time: '20:00:00',
            location: 'Dakar Arena',
            city: 'Dakar',
            capacity: 500,
            status: 'PUBLIE',
        }).select('id').single();
        if (evErr || !ev) throw new Error(`Event creation: ${evErr?.message}`);
        testEventId = ev.id;

        // 3. Créer les catégories
        const { data: paidCat, error: paidErr } = await supabase.from('ticket_categories').insert({
            event_id: testEventId,
            name: 'VIP Checkout Test',
            price: PAID_PRICE,
            total_quantity: 50,
            sold_quantity: 0,
            is_active: true,
            is_visible: true,
            max_per_order: 10,
        }).select('id').single();
        if (paidErr || !paidCat) throw new Error(`Paid category creation: ${paidErr?.message}`);
        paidCategoryId = paidCat.id;

        const { data: freeCat, error: freeErr } = await supabase.from('ticket_categories').insert({
            event_id: testEventId,
            name: 'Entrée Libre Checkout Test',
            price: 0,
            total_quantity: 100,
            sold_quantity: 0,
            is_active: true,
            is_visible: true,
            max_per_order: 10,
        }).select('id').single();
        if (freeErr || !freeCat) throw new Error(`Free category creation: ${freeErr?.message}`);
        freeCategoryId = freeCat.id;

        console.log(`[SETUP] Événement: ${testEventId}`);
        console.log(`[SETUP] Catégorie Payante (${PAID_PRICE} FCFA): ${paidCategoryId}`);
        console.log(`[SETUP] Catégorie Gratuite: ${freeCategoryId}`);
        console.log('[SETUP] Initialisation terminée.\n');
    });

    after(async () => {
        console.log('\n[CLEANUP] Nettoyage des données de test...');
        try {
            await supabase.from('notifications').delete().eq('user_id', buyerUserId);
            await supabase.from('payments').delete().eq('client_id', buyerUserId);
            await supabase.from('tickets').delete().eq('event_id', testEventId);
            await supabase.from('ticket_categories').delete().eq('event_id', testEventId);
            await supabase.from('events').delete().eq('id', testEventId);
            console.log('[CLEANUP] Nettoyage terminé avec succès.\n');
        } catch (e) {
            console.error('[CLEANUP] Erreur de nettoyage:', e);
        }
    });

    // Helper pour créer un NextRequest avec token
    function makeReq(url: string, method: string, body: any, token: string): NextRequest {
        const headers = new Headers({
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        });
        return new NextRequest(new URL(url, 'http://localhost:3000'), {
            method,
            headers,
            body: JSON.stringify(body),
        });
    }

    test('1. Checkout avec panier 100% GRATUIT → Billets émis immédiatement sans paiement', async () => {
        const req = makeReq('/api/checkout', 'POST', {
            eventId: testEventId,
            items: [
                { categoryId: freeCategoryId, quantity: FREE_QTY },
            ],
        }, buyerToken);

        const res = await checkoutRoute(req);
        const data = await res.json();

        assert.ok(data.success, `Checkout gratuit réussi: ${JSON.stringify(data)}`);
        assert.strictEqual(data.payment, null, 'Pas de paiement pour les billets gratuits');
        assert.strictEqual(data.totalPaid, 0, 'Total payé = 0');
        assert.strictEqual(data.totalFree, FREE_QTY, `${FREE_QTY} billets gratuits comptabilisés`);
        assert.strictEqual(data.freeTickets.length, FREE_QTY, `${FREE_QTY} billets gratuits générés`);

        // Vérifier en DB que les billets existent avec statut VALIDE
        const { data: dbTickets } = await supabase
            .from('tickets')
            .select('id, ticket_number, qr_code, status, price')
            .eq('event_id', testEventId)
            .eq('category_id', freeCategoryId)
            .eq('user_id', buyerUserId);

        assert.ok(dbTickets && dbTickets.length >= FREE_QTY, `${FREE_QTY}+ billets gratuits en base`);
        for (const t of dbTickets!) {
            assert.strictEqual(t.status, 'VALIDE', 'Billet gratuit au statut VALIDE');
            assert.strictEqual(Number(t.price), 0, 'Prix = 0 en base');
        }

        console.log(`   ✅ ${FREE_QTY} billets gratuits émis immédiatement`);
    });

    test('2. Checkout avec panier MIXTE (payant + gratuit) → Gratuits émis + paiement créé pour les payants', async () => {
        // Nettoyer les billets précédents pour avoir des compteurs propres
        await supabase.from('tickets').delete().eq('event_id', testEventId).eq('user_id', buyerUserId);
        await supabase.from('ticket_categories').update({ sold_quantity: 0 }).eq('event_id', testEventId);

        const req = makeReq('/api/checkout', 'POST', {
            eventId: testEventId,
            items: [
                { categoryId: paidCategoryId, quantity: PAID_QTY },
                { categoryId: freeCategoryId, quantity: FREE_QTY },
            ],
            operator: 'WAVE',
            customerPhone: '771234567',
        }, buyerToken);

        const res = await checkoutRoute(req);
        const data = await res.json();

        assert.ok(data.success, `Checkout mixte réussi: ${JSON.stringify(data).slice(0, 300)}`);

        // Billets gratuits émis immédiatement
        assert.strictEqual(data.freeTickets.length, FREE_QTY, `${FREE_QTY} billets gratuits émis`);
        assert.strictEqual(data.totalFree, FREE_QTY, 'totalFree correct');

        // Paiement créé pour les payants
        assert.ok(data.payment, 'Objet payment présent pour les payants');
        assert.strictEqual(data.totalPaid, PAID_PRICE * PAID_QTY, `Total payé = ${PAID_PRICE * PAID_QTY} FCFA`);
        assert.ok(data.payment.transaction_id, 'transaction_id présent');
        assert.strictEqual(data.totalTickets, PAID_QTY + FREE_QTY, `Total billets = ${PAID_QTY + FREE_QTY}`);

        // Vérifier l'enregistrement du paiement en DB
        const { data: paymentRec } = await supabase
            .from('payments')
            .select('*')
            .eq('transaction_id', data.payment.transaction_id)
            .single();

        assert.ok(paymentRec, 'Paiement enregistré en base');
        assert.strictEqual(paymentRec.status, 'PENDING', 'Paiement en attente de confirmation');
        assert.strictEqual(Number(paymentRec.amount), PAID_PRICE * PAID_QTY, 'Montant du paiement correct');
        assert.ok(paymentRec.metadata?.checkout_items, 'checkout_items présents dans les metadata');
        assert.strictEqual(paymentRec.metadata.checkout_items.length, 1, '1 catégorie payante dans le panier');

        console.log(`   ✅ ${FREE_QTY} gratuits émis + paiement ${PAID_PRICE * PAID_QTY} FCFA créé`);
    });

    test('3. Le total est calculé STRICTEMENT côté serveur (jamais du client)', async () => {
        // Le client n'envoie que les categoryId + quantity
        // Le serveur doit recalculer le total depuis la DB
        const { data: cat } = await supabase
            .from('ticket_categories')
            .select('price')
            .eq('id', paidCategoryId)
            .single();

        const serverSideExpectedTotal = Number(cat!.price) * PAID_QTY;
        assert.strictEqual(serverSideExpectedTotal, PAID_PRICE * PAID_QTY, 'Le prix serveur correspond au prix DB');

        // Vérifier que le dernier paiement a le bon montant (pas un montant fabricable par le client)
        const { data: payments } = await supabase
            .from('payments')
            .select('amount, metadata')
            .eq('client_id', buyerUserId)
            .eq('payment_target', 'TICKET')
            .order('created_at', { ascending: false })
            .limit(1);

        assert.ok(payments && payments.length > 0, 'Paiement trouvé');
        assert.strictEqual(Number(payments[0].amount), serverSideExpectedTotal, 'Montant serveur = prix DB × quantité');

        console.log(`   ✅ Total serveur ${serverSideExpectedTotal} FCFA vérifié contre la DB`);
    });

    test('4. Chaque billet possède un ID unique et un QR Code distinct', async () => {
        const { data: allTickets } = await supabase
            .from('tickets')
            .select('id, ticket_number, qr_code, category_id, status')
            .eq('event_id', testEventId)
            .eq('user_id', buyerUserId);

        assert.ok(allTickets, 'Billets trouvés en base');
        const freeTickets = allTickets!.filter(t => t.category_id === freeCategoryId);
        assert.ok(freeTickets.length >= FREE_QTY, `Au moins ${FREE_QTY} billets gratuits en base`);

        // Vérifier l'unicité des IDs
        const allIds = allTickets!.map(t => t.id);
        const uniqueIds = new Set(allIds);
        assert.strictEqual(uniqueIds.size, allIds.length, `Tous les IDs sont uniques (${allIds.length} billets, ${uniqueIds.size} IDs distincts)`);

        // Vérifier l'unicité des ticket_numbers
        const allNumbers = allTickets!.map(t => t.ticket_number);
        const uniqueNumbers = new Set(allNumbers);
        assert.strictEqual(uniqueNumbers.size, allNumbers.length, `Tous les numéros de billet sont uniques`);

        // Vérifier l'unicité des QR Codes
        const allQr = allTickets!.map(t => t.qr_code);
        const uniqueQr = new Set(allQr);
        assert.strictEqual(uniqueQr.size, allQr.length, `Tous les QR Codes sont uniques`);

        console.log(`   ✅ ${allIds.length} billets avec IDs, numéros et QR Codes 100% uniques`);
    });

    test('5. Checkout sur catégorie ÉPUISÉE → Rejet propre sans billet fantôme', async () => {
        // Épuiser la catégorie gratuite
        const { data: freeCatNow } = await supabase
            .from('ticket_categories')
            .select('total_quantity')
            .eq('id', freeCategoryId)
            .single();

        await supabase
            .from('ticket_categories')
            .update({ sold_quantity: freeCatNow!.total_quantity })
            .eq('id', freeCategoryId);

        const req = makeReq('/api/checkout', 'POST', {
            eventId: testEventId,
            items: [
                { categoryId: freeCategoryId, quantity: 1 },
            ],
        }, buyerToken);

        const res = await checkoutRoute(req);
        const data = await res.json();

        assert.ok(!data.success || res.status >= 400, 'Checkout rejeté pour stock épuisé');
        assert.ok(
            (data.error || '').toLowerCase().includes('épuisé') ||
            (data.error || '').toLowerCase().includes('épuisée') ||
            (data.error || '').toLowerCase().includes('disponible'),
            `Message d'erreur pertinent: ${data.error}`
        );

        // Restaurer le stock pour le nettoyage
        await supabase
            .from('ticket_categories')
            .update({ sold_quantity: 0 })
            .eq('id', freeCategoryId);

        console.log(`   ✅ Checkout sur stock épuisé correctement rejeté`);
    });
});
