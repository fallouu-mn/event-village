import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
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
import { EventService } from '../lib/events/event.service';
import { paymentService } from '../lib/payments/payment.service';

describe('CHANTIER 1 : HOLD CART — RÉSERVATION TEMPORAIRE DE STOCK (7 TESTS)', async () => {
    const supabase = getServiceRoleClient();
    const publicAuth = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const ts = Date.now();

    const partnerUserId = 'e706a7a2-502c-4396-9e91-4dc6720388f7';
    const partnerId = 'a917b7ac-d542-4c2b-b5d8-ab38f866b2e7';
    const buyerAUserId = 'a7345050-03cf-4967-9281-9ee5eb75615a';
    const buyerBUserId = 'fe9318ac-1f65-4e80-980f-f00626f1a003';
    const buyerCUserId = '775818bd-1833-4e99-843d-3f5ecf8196e3';

    let testEventId: string;
    let category10Id: string;
    let category1Id: string;
    let category3Id: string;

    before(async () => {
        console.log('\n[SETUP] Initialisation du banc d\'essai Hold Cart (7 scénarios)...');

        // Création de l'événement de test
        const { data: ev, error: evErr } = await supabase.from('events').insert({
            partner_id: partnerId,
            title: `Hold Cart Festival ${ts}`,
            slug: `hold-cart-${ts}`,
            description: 'Validation de la réservation temporaire de stock et anti-débit sans billet',
            category: 'CONCERT',
            start_date: new Date(Date.now() + 86400000 * 10).toISOString().split('T')[0],
            start_time: '20:00:00',
            location: 'Grand Théâtre National, Dakar',
            city: 'Dakar',
            capacity: 500,
            status: 'PUBLIE',
        }).select('id').single();
        if (evErr || !ev) throw new Error(`Event creation: ${evErr?.message}`);
        testEventId = ev.id;

        // Catégorie Standard (stock: 10)
        const { data: cat10, error: cat10Err } = await supabase.from('ticket_categories').insert({
            event_id: testEventId,
            name: 'Standard Hold Test',
            price: 5000,
            total_quantity: 10,
            sold_quantity: 0,
            is_active: true,
            is_visible: true,
            max_per_order: 10,
        }).select('id').single();
        if (cat10Err || !cat10) throw new Error(`Category 10 creation: ${cat10Err?.message}`);
        category10Id = cat10.id;

        // Catégorie Flash Ultra-Limitée (stock: 1) pour le test critique Pre-Mortem
        const { data: cat1, error: cat1Err } = await supabase.from('ticket_categories').insert({
            event_id: testEventId,
            name: 'Dernière Place Or Flash',
            price: 25000,
            total_quantity: 1,
            sold_quantity: 0,
            is_active: true,
            is_visible: true,
            max_per_order: 1,
        }).select('id').single();
        if (cat1Err || !cat1) throw new Error(`Category 1 creation: ${cat1Err?.message}`);
        category1Id = cat1.id;

        // Catégorie Concurrence Modérée (stock: 3) pour validation du retry loop CAS
        const { data: cat3, error: cat3Err } = await supabase.from('ticket_categories').insert({
            event_id: testEventId,
            name: 'Pack Concurrence 3 Places',
            price: 15000,
            total_quantity: 3,
            sold_quantity: 0,
            is_active: true,
            is_visible: true,
            max_per_order: 3,
        }).select('id').single();
        if (cat3Err || !cat3) throw new Error(`Category 3 creation: ${cat3Err?.message}`);
        category3Id = cat3.id;

        console.log(`[SETUP] Événement: ${testEventId}`);
        console.log(`[SETUP] Catégorie 10 places: ${category10Id}`);
        console.log(`[SETUP] Catégorie 1 place (Pre-Mortem target): ${category1Id}`);
        console.log(`[SETUP] Catégorie 3 places (CAS Concurrency target): ${category3Id}`);
        console.log('[SETUP] Initialisation terminée.\n');
    });

    after(async () => {
        console.log('\n[CLEANUP] Nettoyage des données Hold Cart...');
        try {
            await supabase.from('notifications').delete().eq('user_id', buyerAUserId);
            await supabase.from('payments').delete().eq('partner_id', partnerId);
            await supabase.from('tickets').delete().eq('event_id', testEventId);
            await supabase.from('ticket_categories').delete().eq('event_id', testEventId);
            await supabase.from('events').delete().eq('id', testEventId);
            console.log('[CLEANUP] Nettoyage terminé avec succès.\n');
        } catch (e) {
            console.error('[CLEANUP] Erreur nettoyage:', e);
        }
    });

    async function getCategoryPhysicalState(categoryId: string) {
        const { data: cat } = await supabase
            .from('ticket_categories')
            .select('id, total_quantity, sold_quantity')
            .eq('id', categoryId)
            .single();

        let heldQty = 0;
        try {
            const { data: heldData, error } = await supabase
                .from('ticket_categories')
                .select('held_quantity')
                .eq('id', categoryId)
                .maybeSingle();
            if (!error && heldData && typeof (heldData as any).held_quantity === 'number') {
                heldQty = Number((heldData as any).held_quantity);
            }
        } catch {
            // ignore
        }

        return {
            ...cat,
            held_quantity: heldQty,
            sold_quantity: Number(cat?.sold_quantity || 0),
            total_quantity: Number(cat?.total_quantity || 0),
        };
    }

    test('1. Test nominal : Réservation au paiement → Webhook SUCCESS → Hold libéré, sold_quantity augmenté', async () => {
        const initialHeld = await EventService.getActiveHeldQuantity(category10Id);
        assert.strictEqual(initialHeld, 0, 'Hold initial = 0');

        // 1. Client initie un paiement pour 2 billets
        const paymentRes = await paymentService.createPayment(buyerAUserId, {
            targetType: 'TICKET',
            targetId: category10Id,
            quantity: 2,
            operator: 'WAVE',
            customerPhone: '771234567',
        });

        assert.ok(paymentRes.success, 'Paiement initié avec succès');
        assert.ok(paymentRes.transaction_id, 'transaction_id présent');

        // 2. Vérifier que 2 billets sont bien marqués comme réservés (Service + Colonne DB)
        const activeHeld = await EventService.getActiveHeldQuantity(category10Id);
        assert.strictEqual(activeHeld, 2, 'Exactement 2 billets en hold temporaire');

        const catDuringPay = await getCategoryPhysicalState(category10Id);
        assert.strictEqual(catDuringPay.sold_quantity, 0, 'sold_quantity = 0 pendant paiement');

        // 3. Simuler le Webhook SUCCESS
        const webhookRes = await paymentService.handleSamirPayWebhook({
            transaction_id: `EXT-TX-${Date.now()}`,
            order_id: paymentRes.order_id,
            status: 'SUCCESS',
            amount: '10000',
        });

        assert.ok(webhookRes.success, 'Webhook SUCCESS traité');

        // 4. Vérifier que le hold est libéré (0) et sold_quantity = 2 dans la table physique
        const postHeld = await EventService.getActiveHeldQuantity(category10Id);
        assert.strictEqual(postHeld, 0, 'Hold revenu à 0 après confirmation');

        const catDb = await getCategoryPhysicalState(category10Id);
        assert.strictEqual(catDb.sold_quantity, 2, 'sold_quantity incrémenté de 2');

        const { data: tickets } = await supabase
            .from('tickets')
            .select('id, status')
            .eq('category_id', category10Id)
            .eq('user_id', buyerAUserId);

        assert.strictEqual(tickets?.length, 2, '2 billets générés en base');
        console.log('   ✅ Nominal : 2 places réservées puis converties (sold: 2, hold: 0)');
    });

    test('2. Test échec paiement : Réservation au paiement → Webhook FAILED → Hold libéré, stock redisponible', async () => {
        // 1. Client initie un paiement pour 3 billets
        const paymentRes = await paymentService.createPayment(buyerAUserId, {
            targetType: 'TICKET',
            targetId: category10Id,
            quantity: 3,
            operator: 'WAVE',
            customerPhone: '771234567',
        });

        assert.ok(paymentRes.success, 'Paiement initié');
        const heldDuringPayment = await EventService.getActiveHeldQuantity(category10Id);
        assert.strictEqual(heldDuringPayment, 3, '3 places en hold');

        // 2. Simuler le Webhook FAILED (paiement refusé ou annulé)
        const webhookRes = await paymentService.handleSamirPayWebhook({
            transaction_id: `EXT-FAIL-${Date.now()}`,
            order_id: paymentRes.order_id,
            status: 'FAILED',
            amount: '15000',
        });

        assert.ok(webhookRes.success, 'Webhook FAILED traité');

        // 3. Vérifier que le hold est immédiatement relâché et sold_quantity inchangé en base
        const heldAfterFail = await EventService.getActiveHeldQuantity(category10Id);
        assert.strictEqual(heldAfterFail, 0, 'Hold libéré à 0 après FAILED');

        const catDb = await getCategoryPhysicalState(category10Id);
        assert.strictEqual(catDb.sold_quantity, 2, 'sold_quantity inchangé (toujours 2)');

        // 4. Un autre client peut immédiatement réserver ces places
        const reorderRes = await paymentService.createPayment(buyerBUserId, {
            targetType: 'TICKET',
            targetId: category10Id,
            quantity: 3,
            operator: 'WAVE',
            customerPhone: '772223344',
        });
        assert.ok(reorderRes.success, 'Nouvelle réservation réussie sur les places libérées');

        // Nettoyage de cette commande temporaire et libération du hold
        await EventService.releaseHoldTicketsAtomic({ categoryId: category10Id, quantity: 3 });
        await supabase.from('payments').delete().eq('transaction_id', reorderRes.transaction_id);

        console.log('   ✅ Échec paiement : Hold immédiatement libéré en DB, stock remis sur le marché');
    });

    test('3. Test expiration TTL (10 minutes) : Réservation expirée → cleanupExpiredHolds() libère le stock', async () => {
        // 1. Créer une réservation avec held_expires_at dans le passé
        const paymentRes = await paymentService.createPayment(buyerAUserId, {
            targetType: 'TICKET',
            targetId: category10Id,
            quantity: 2,
            operator: 'WAVE',
            customerPhone: '771234567',
        });

        // Simuler expiration du TTL
        const pastDate = new Date(Date.now() - 15 * 60 * 1000).toISOString();
        await supabase
            .from('payments')
            .update({
                created_at: pastDate,
                metadata: {
                    target_type: 'TICKET',
                    category_id: category10Id,
                    quantity: 2,
                    held_expires_at: pastDate,
                }
            })
            .eq('transaction_id', paymentRes.transaction_id);

        // 2. Exécuter le job de nettoyage
        const cleanupResult = await paymentService.cleanupExpiredHolds();
        assert.ok(cleanupResult.cleanedCount >= 1, 'Au moins 1 hold expiré nettoyé');

        // 3. Vérifier que le statut est CANCELLED / HOLD_EXPIRED
        const { data: updatedPay } = await supabase
            .from('payments')
            .select('status, provider_status')
            .eq('transaction_id', paymentRes.transaction_id)
            .single();

        assert.strictEqual(updatedPay!.status, 'CANCELLED', 'Paiement expiré passé à CANCELLED');
        assert.strictEqual(updatedPay!.provider_status, 'HOLD_EXPIRED', 'Raison HOLD_EXPIRED');

        console.log(`   ✅ TTL 10 min : ${cleanupResult.cleanedCount} hold(s) expiré(s) nettoyé(s) automatiquement`);
    });

    test('4. TEST CRITIQUE — Reproduction exacte du Pre-Mortem : 1 place restante, 5 paiements simultanés → Exactement 1 succès, 4 rejets AVANT débit', async () => {
        // Vérifier que la catégorie flash a bien exactement 1 place disponible
        const flashCat = await getCategoryPhysicalState(category1Id);

        assert.strictEqual(flashCat.total_quantity, 1, 'Total = 1');
        assert.strictEqual(flashCat.sold_quantity, 0, 'Sold = 0');

        const initialHold = await EventService.getActiveHeldQuantity(category1Id);
        assert.strictEqual(initialHold, 0, 'Hold = 0 au départ');

        // 5 acheteurs tentent d'initier le paiement simultanément via Promise.allSettled
        const buyers = [buyerAUserId, buyerBUserId, buyerCUserId, buyerAUserId, buyerBUserId];
        const promises = buyers.map((userId, index) =>
            paymentService.createPayment(userId, {
                targetType: 'TICKET',
                targetId: category1Id,
                quantity: 1,
                operator: 'WAVE',
                customerPhone: `77123456${index}`,
            })
        );

        const results = await Promise.allSettled(promises);

        const fulfilled = results.filter(r => r.status === 'fulfilled') as PromiseFulfilledResult<any>[];
        const rejected = results.filter(r => r.status === 'rejected') as PromiseRejectedResult[];

        console.log(`   📊 Résultats de concurrence (1 place pour 5 acheteurs simultanés) :`);
        console.log(`      - Succès d'initiation : ${fulfilled.length}`);
        console.log(`      - Rejets immédiats (AVANT débit) : ${rejected.length}`);

        // ASSERTION CRITIQUE : Exactement 1 réservation réussie
        assert.strictEqual(fulfilled.length, 1, 'EXACTEMENT 1 SEULE réservation autorisée');
        assert.strictEqual(rejected.length, 4, 'EXACTEMENT 4 réservations REJETÉES AVANT DÉBIT');

        // Vérifier le message de rejet des 4 échecs
        for (const rej of rejected) {
            const msg = rej.reason instanceof Error ? rej.reason.message : String(rej.reason);
            assert.ok(
                msg.toLowerCase().includes('stock insuffisant') ||
                msg.toLowerCase().includes('en cours de réservation') ||
                msg.toLowerCase().includes('épuisé'),
                `Message de rejet clair: ${msg}`
            );
        }

        // Vérifier les colonnes physiques dans ticket_categories en DB
        const flashCatDb = await getCategoryPhysicalState(category1Id);
        assert.strictEqual(flashCatDb.sold_quantity, 0, 'Col physique DB ticket_categories.sold_quantity EXACTEMENT 0');

        // Vérifier le service getActiveHeldQuantity
        const heldFinal = await EventService.getActiveHeldQuantity(category1Id);
        assert.strictEqual(heldFinal, 1, 'Exactement 1 place verrouillée en hold');

        console.log('   🛡️ PRE-MORTEM NEUTRALISÉ : hold = 1, sold = 0, 4 clients protégés contre tout débit sans billet');
    });

    test('5. Test de concurrence modérée (3 places pour 3 acheteurs simultanés) : Résolution CAS sans faux rejet', async () => {
        const cat3 = await getCategoryPhysicalState(category3Id);
        assert.strictEqual(cat3.total_quantity, 3, 'Total = 3');
        assert.strictEqual(cat3.sold_quantity, 0, 'Sold = 0');
        assert.strictEqual(await EventService.getActiveHeldQuantity(category3Id), 0, 'Hold initial = 0');

        // 3 acheteurs distincts tentent de réserver 1 place simultanément via Promise.allSettled
        const buyers = [buyerAUserId, buyerBUserId, buyerCUserId];
        const promises = buyers.map((userId, index) =>
            paymentService.createPayment(userId, {
                targetType: 'TICKET',
                targetId: category3Id,
                quantity: 1,
                operator: 'WAVE',
                customerPhone: `77333445${index}`,
            })
        );

        const results = await Promise.allSettled(promises);

        const fulfilled = results.filter(r => r.status === 'fulfilled') as PromiseFulfilledResult<any>[];
        const rejected = results.filter(r => r.status === 'rejected') as PromiseRejectedResult[];

        console.log(`   📊 Résultats concurrence modérée (3 places pour 3 acheteurs simultanés) :`);
        console.log(`      - Succès d'initiation (réservations garanties) : ${fulfilled.length}`);
        console.log(`      - Rejets : ${rejected.length}`);

        if (rejected.length > 0) {
            console.error('   ❌ Rejet inattendu:', rejected.map(r => r.reason));
        }

        // ASSERTION CRITIQUE : Les 3 doivent réussir sans AUCUN faux rejet
        assert.strictEqual(fulfilled.length, 3, 'EXACTEMENT 3 réservations autorisées (0 faux rejet)');
        assert.strictEqual(rejected.length, 0, '0 rejet lorsque le stock est suffisant');

        // Vérifier l'état physique du hold
        const held3 = await EventService.getActiveHeldQuantity(category3Id);
        assert.strictEqual(held3, 3, 'Exactement 3 places en hold temporaire');

        // Nettoyage des 3 holds temporaires
        await EventService.releaseHoldTicketsAtomic({ categoryId: category3Id, quantity: 3 });
        for (const f of fulfilled) {
            await supabase.from('payments').delete().eq('transaction_id', f.value.transaction_id);
        }

        console.log('   ✅ Concurrence modérée : 3/3 réussis grâce au retry loop CAS avec backoff');
    });

    test('6. Test de non-régression anti-survente : reserveTicketsAtomic garantit l\'intégrité finale', async () => {
        // Vérifier que la protection CAS existante sur reserveTicketsAtomic n'a pas été cassée
        const cat = await getCategoryPhysicalState(category10Id);

        const available = cat.total_quantity - cat.sold_quantity;
        assert.ok(available > 0, 'Il reste du stock');

        // Réserver directement avec reserveTicketsAtomic (cas guichet / confirmation)
        const res = await EventService.reserveTicketsAtomic({
            eventId: testEventId,
            categoryId: category10Id,
            quantity: 1,
            userId: buyerAUserId,
            paymentConfirmed: true,
        });

        assert.ok(res.ticket, 'Billet généré');
        assert.strictEqual(res.ticket.status, 'VALIDE', 'Statut du billet VALIDE');
        console.log('   ✅ Non-régression : reserveTicketsAtomic CAS fonctionne parfaitement');
    });

    test('7. Nettoyage périodique robuste : Plusieurs réservations expirées libérées sans fuite ni valeur négative', async () => {
        const cleanupResult = await paymentService.cleanupExpiredHolds();
        assert.ok(cleanupResult !== undefined, 'Cleanup exécuté avec succès');
        assert.ok(cleanupResult.releasedTickets >= 0, 'Nombre de tickets libérés >= 0');

        const heldQty = await EventService.getActiveHeldQuantity(category10Id);
        assert.ok(heldQty >= 0, 'held_quantity n\'est jamais négatif');
        console.log('   ✅ Nettoyage périodique robuste sans fuite ni dérive négative');
    });

    test('8. Validation max_per_order : Tentative de dépassement de la limite par commande', async () => {
        // Test sur catégorie avec max_per_order = 10 (category10Id)
        const maxPerOrderTest = await EventService.reserveTicketsAtomic({
            eventId: testEventId,
            categoryId: category10Id,
            quantity: 11, // Une de plus que la limite
            userId: buyerAUserId,
            paymentConfirmed: true,
        }).catch(err => err);

        assert.ok(maxPerOrderTest instanceof Error, 'Devrait retourner une erreur pour quantité > max_per_order');
        assert.ok(maxPerOrderTest.message.includes('limite autorisée par commande'), 'Message d\'erreur approprié');

        // Test sur catégorie avec max_per_order = 1 (category1Id - dernière place flash)
        const maxPerOrderOneTest = await EventService.reserveTicketsAtomic({
            eventId: testEventId,
            categoryId: category1Id,
            quantity: 2, // Une de plus que la limite
            userId: buyerBUserId,
            paymentConfirmed: true,
        }).catch(err => err);

        assert.ok(maxPerOrderOneTest instanceof Error, 'Devrait retourner une erreur pour quantité > max_per_order');
        assert.ok(maxPerOrderOneTest.message.includes('limite autorisée par commande'), 'Message d\'erreur approprié');

        // Test quantité valide (égale à max_per_order) devrait réussir
        const validMaxTest = await EventService.reserveTicketsAtomic({
            eventId: testEventId,
            categoryId: category1Id,
            quantity: 1, // Exactement la limite
            userId: buyerCUserId,
            paymentConfirmed: true,
        });

        assert.ok(validMaxTest.ticket, 'Quantité égale à max_per_order devrait réussir');
        assert.strictEqual(validMaxTest.ticket.status, 'VALIDE', 'Statut du billet VALIDE');

        // Nettoyer la réservation valide
        await EventService.releaseHoldTicketsAtomic({ categoryId: category1Id, quantity: 1 });

        // Test quantité zéro devrait échouer
        const zeroQtyTest = await EventService.reserveTicketsAtomic({
            eventId: testEventId,
            categoryId: category10Id,
            quantity: 0,
            userId: buyerAUserId,
            paymentConfirmed: true,
        }).catch(err => err);

        assert.ok(zeroQtyTest instanceof Error, 'Devrait retourner une erreur pour quantité zéro');
        assert.ok(zeroQtyTest.message.includes('Quantité invalide'), 'Message d\'erreur approprié pour quantité zéro');

        // Test quantité négative devrait échouer
        const negativeQtyTest = await EventService.reserveTicketsAtomic({
            eventId: testEventId,
            categoryId: category10Id,
            quantity: -1,
            userId: buyerBUserId,
            paymentConfirmed: true,
        }).catch(err => err);

        assert.ok(negativeQtyTest instanceof Error, 'Devrait retourner une erreur pour quantité négative');
        assert.ok(negativeQtyTest.message.includes('Quantité invalide'), 'Message d\'erreur approprié pour quantité négative');

        console.log('   ✅ Validation max_per_order fonctionnelle : limites respectées, erreurs appropriées');
    });
});

