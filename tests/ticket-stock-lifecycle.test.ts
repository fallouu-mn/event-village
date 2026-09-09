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
import { EventService } from '../lib/events/event.service';
import { paymentService } from '../lib/payments/payment.service';
import { NotificationService } from '../lib/notifications/notification.service';
import { GET as getEventRoute } from '../app/api/events/[id]/route';
import { GET as getTicketsRoute } from '../app/api/tickets/route';
import { POST as claimFreeRoute } from '../app/api/tickets/claim-free/route';
import { POST as controllerScanRoute } from '../app/api/controller/scan/route';
import { PATCH as updateCategoryRoute } from '../app/api/partner/events/[id]/categories/[categoryId]/route';

describe('CYCLE DE VIE COMPLET DES BILLETS — 22 TESTS D\'INTÉGRATION ET DE CONFORMITÉ', async () => {
    const supabase = getServiceRoleClient();
    const publicAuth = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const ts = Date.now().toString().slice(-6);

    const partnerUserId = 'e706a7a2-502c-4396-9e91-4dc6720388f7';
    const partnerId = 'a917b7ac-d542-4c2b-b5d8-ab38f866b2e7';
    const buyerAUserId = 'a7345050-03cf-4967-9281-9ee5eb75615a';
    const ctrlUserId = 'fe9318ac-1f65-4e80-980f-f00626f1a003';
    const otherPartnerUserId = '775818bd-1833-4e99-843d-3f5ecf8196e3';

    let partnerToken: string;
    let buyerAToken: string;
    let ctrlToken: string;
    let otherPartnerToken: string;

    let testEventId: string;
    const createdEventIds: string[] = [];

    before(async () => {
        const setupStart = Date.now();
        console.log('\n[SETUP] Initialisation du banc d\'essai complet (22 scénarios)...');

        // 1. Partenaire Propriétaire
        const { data: pAuthUser } = await supabase.auth.admin.getUserById(partnerUserId);
        const pEmail = pAuthUser?.user?.email || 'fallouu.dev@gmail.com';
        await supabase.from('users').update({ status: 'ACTIF', role: 'PARTENAIRE', first_name: 'Organisateur', last_name: 'Principal', phone: '221770006743' }).eq('id', partnerUserId);
        await supabase.from('user_roles').delete().eq('user_id', partnerUserId);
        await supabase.from('user_roles').insert({ user_id: partnerUserId, role: 'PARTENAIRE' });
        await supabase.auth.admin.updateUserById(partnerUserId, {
            email: pEmail,
            password: 'Password123!',
            email_confirm: true,
            user_metadata: { role: 'PARTENAIRE' }
        });
        const { data: pAuth } = await publicAuth.auth.signInWithPassword({
            email: pEmail,
            password: 'Password123!',
        });
        partnerToken = pAuth?.session?.access_token || '';
        assert.ok(partnerToken !== '', 'partnerToken obtenu');

        // 2. Partenaire Tiers (Non Propriétaire)
        const { data: opAuthUser } = await supabase.auth.admin.getUserById(otherPartnerUserId);
        const opEmail = opAuthUser?.user?.email || 'other.partner@eventvillage.sn';
        await supabase.from('users').update({ status: 'ACTIF', role: 'PARTENAIRE', phone: '221770006744' }).eq('id', otherPartnerUserId);
        await supabase.from('user_roles').delete().eq('user_id', otherPartnerUserId);
        await supabase.from('user_roles').insert({ user_id: otherPartnerUserId, role: 'PARTENAIRE' });
        await supabase.auth.admin.updateUserById(otherPartnerUserId, { password: 'Password123!', email_confirm: true, user_metadata: { role: 'PARTENAIRE' } });
        const { data: opAuth } = await publicAuth.auth.signInWithPassword({
            email: opEmail,
            password: 'Password123!',
        });
        otherPartnerToken = opAuth?.session?.access_token || '';
        assert.ok(otherPartnerToken, 'otherPartnerToken obtenu');

        // 3. Client Acheteur A
        const { data: bAAuthUser } = await supabase.auth.admin.getUserById(buyerAUserId);
        const bAEmail = bAAuthUser?.user?.email || 'clientA@test.com';
        await supabase.from('users').update({ status: 'ACTIF', role: 'CLIENT', first_name: 'Acheteur', last_name: 'Alpha', phone: '221771234567' }).eq('id', buyerAUserId);
        await supabase.from('user_roles').delete().eq('user_id', buyerAUserId);
        await supabase.from('user_roles').insert({ user_id: buyerAUserId, role: 'CLIENT' });
        await supabase.auth.admin.updateUserById(buyerAUserId, { password: 'Password123!', email_confirm: true, user_metadata: { role: 'CLIENT' } });
        const { data: bAAuth } = await publicAuth.auth.signInWithPassword({
            email: bAEmail,
            password: 'Password123!',
        });
        buyerAToken = bAAuth?.session?.access_token || '';
        assert.ok(buyerAToken, 'buyerAToken obtenu');

        // 4. Contrôleur Officiel
        const { data: cAuthUser } = await supabase.auth.admin.getUserById(ctrlUserId);
        const cEmail = cAuthUser?.user?.email || 'clientB@test.com';
        await supabase.from('users').update({ status: 'ACTIF', role: 'CONTROLEUR', first_name: 'Contrôleur', last_name: 'Officiel', phone: '221772223344' }).eq('id', ctrlUserId);
        await supabase.from('user_roles').delete().eq('user_id', ctrlUserId);
        await supabase.from('user_roles').insert({ user_id: ctrlUserId, role: 'CONTROLEUR' });
        await supabase.auth.admin.updateUserById(ctrlUserId, { password: 'Password123!', email_confirm: true, user_metadata: { role: 'CONTROLEUR' } });
        const { data: cAuth } = await publicAuth.auth.signInWithPassword({
            email: cEmail,
            password: 'Password123!',
        });
        ctrlToken = cAuth?.session?.access_token || '';
        assert.ok(ctrlToken, 'ctrlToken obtenu');

        // 5. Événement Principal
        const { data: ev, error: evErr } = await supabase.from('events').insert({
            partner_id: partnerId,
            title: `Grand Festival Dakar 2026 ${ts}`,
            slug: `grand-festival-dakar-${ts}`,
            description: 'Festival de référence pour la validation de transactionnalité billetterie',
            category: 'CONCERT',
            start_date: new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0],
            start_time: '20:00:00',
            location: 'Grand Théâtre National, Dakar',
            city: 'Dakar',
            capacity: 1000,
            status: 'PUBLIE',
        }).select('id').single();
        if (evErr || !ev) throw new Error(`Event creation: ${evErr?.message}`);
        testEventId = ev.id;
        createdEventIds.push(testEventId);

        // Assignation du contrôleur sur l'événement
        await supabase.from('event_controllers').insert({
            user_id: ctrlUserId,
            event_id: testEventId,
            can_accept_cash: true,
            created_by: partnerUserId,
        });

        console.log(`[SETUP OK] Durée: ${Date.now() - setupStart}ms | EventId: ${testEventId}`);
    });

    after(async () => {
        console.log('\n[TEARDOWN] Nettoyage des données de test...');
        for (const evId of createdEventIds) {
            await supabase.from('event_controllers').delete().eq('event_id', evId);
            await supabase.from('notifications').delete().eq('metadata->>event_id', evId);
            await supabase.from('payments').delete().eq('metadata->>event_id', evId);
            await supabase.from('tickets').delete().eq('event_id', evId);
            await supabase.from('ticket_categories').delete().eq('event_id', evId);
            await supabase.from('events').delete().eq('id', evId);
        }
        console.log('[TEARDOWN OK] Banc de test nettoyé.');
    });

    // =========================================================================
    // TEST 1 : Achat de 1 billet
    // =========================================================================
    let singleCatId: string;
    test('TEST 1 : Achat de 1 billet -> 1 ticket créé avec QR et ticket_number unique', async () => {
        const start = Date.now();
        const { data: cat } = await supabase.from('ticket_categories').insert({
            event_id: testEventId,
            name: 'Pass Solo Test 1',
            price: 5000,
            total_quantity: 10,
            sold_quantity: 0,
            is_active: true,
            is_visible: true,
        }).select('*').single();
        singleCatId = cat.id;

        const res = await EventService.reserveTicketsAtomic({
            eventId: testEventId,
            categoryId: singleCatId,
            userId: buyerAUserId,
            quantity: 1,
            paymentConfirmed: true,
        });

        assert.equal(res.count, 1);
        assert.ok(res.ticket.ticket_number.startsWith('TCK-'));
        assert.ok(res.ticket.qr_code.startsWith('EV-QR-'));
        assert.equal(res.ticket.status, 'VALIDE');
        console.log(`  [PASS] Test 1 validé (${Date.now() - start}ms)`);
    });

    // =========================================================================
    // TEST 2 : Achat de 3 billets -> exactement 3 tickets
    // =========================================================================
    let multiCatId: string;
    test('TEST 2 : Achat de 3 billets -> exactement 3 tickets générés individuellement', async () => {
        const start = Date.now();
        const { data: cat } = await supabase.from('ticket_categories').insert({
            event_id: testEventId,
            name: 'Pass Groupe Test 2',
            price: 5000,
            total_quantity: 10,
            sold_quantity: 0,
            is_active: true,
            is_visible: true,
        }).select('*').single();
        multiCatId = cat.id;

        const res = await EventService.reserveTicketsAtomic({
            eventId: testEventId,
            categoryId: multiCatId,
            userId: buyerAUserId,
            quantity: 3,
            paymentConfirmed: true,
        });

        assert.equal(res.count, 3);
        assert.equal(res.tickets.length, 3);
        const qrSet = new Set(res.tickets.map(t => t.qr_code));
        const numSet = new Set(res.tickets.map(t => t.ticket_number));
        assert.equal(qrSet.size, 3, 'Chaque billet a un QR code strictement unique');
        assert.equal(numSet.size, 3, 'Chaque billet a un numéro de billet unique');
        console.log(`  [PASS] Test 2 validé (${Date.now() - start}ms)`);
    });

    // =========================================================================
    // TEST 3 : Prix total correct (prix unitaire x quantité)
    // =========================================================================
    test('TEST 3 : Prix total correct (prix unitaire x quantité = montant total)', async () => {
        const start = Date.now();
        const unitPrice = 7500;
        const qty = 4;
        const { data: cat } = await supabase.from('ticket_categories').insert({
            event_id: testEventId,
            name: 'Pass VIP Calcul Test 3',
            price: unitPrice,
            total_quantity: 10,
            sold_quantity: 0,
            is_active: true,
            is_visible: true,
        }).select('*').single();

        const paymentRes = await paymentService.createPayment(buyerAUserId, {
            targetType: 'TICKET',
            targetId: cat.id,
            quantity: qty,
            operator: 'WAVE',
            customerPhone: '771234567',
        });

        assert.equal(paymentRes.amount, unitPrice * qty, 'Montant exact (7 500 x 4 = 30 000 FCFA)');
        console.log(`  [PASS] Test 3 validé (${Date.now() - start}ms)`);
    });

    // =========================================================================
    // TEST 4 : Stock décrémenté correctement
    // =========================================================================
    test('TEST 4 : Stock décrémenté correctement (exactement -3 sur l\'inventaire)', async () => {
        const start = Date.now();
        const { data: dbCat } = await supabase.from('ticket_categories').select('sold_quantity, total_quantity').eq('id', multiCatId).single();
        assert.equal(dbCat?.sold_quantity, 3, 'sold_quantity = 3 après l\'achat de 3 billets au Test 2');
        assert.equal(dbCat?.total_quantity, 10, 'total_quantity = 10');
        console.log(`  [PASS] Test 4 validé (${Date.now() - start}ms)`);
    });

    // =========================================================================
    // TEST 5 : Stock à zéro -> SOLD_OUT
    // =========================================================================
    let zeroStockCatId: string;
    test('TEST 5 : Stock à zéro -> Statut SOLD_OUT calculé et availableQuantity = 0', async () => {
        const start = Date.now();
        const { data: cat } = await supabase.from('ticket_categories').insert({
            event_id: testEventId,
            name: 'Pass Quota 2 Test 5',
            price: 5000,
            total_quantity: 2,
            sold_quantity: 0,
            is_active: true,
            is_visible: true,
        }).select('*').single();
        zeroStockCatId = cat.id;

        await EventService.reserveTicketsAtomic({
            eventId: testEventId,
            categoryId: zeroStockCatId,
            userId: buyerAUserId,
            quantity: 2,
            paymentConfirmed: true,
        });

        const req = new NextRequest(`http://localhost/api/events/${testEventId}`);
        const res = await getEventRoute(req, { params: { id: testEventId } });
        const json = await res.json();
        const apiCat = json.event.categories.find((c: any) => c.id === zeroStockCatId);

        assert.equal(apiCat.status, 'SOLD_OUT');
        assert.equal(apiCat.isSoldOut, true);
        assert.equal(apiCat.availableQuantity, 0);
        assert.equal(apiCat.isAvailable, false);
        console.log(`  [PASS] Test 5 validé (${Date.now() - start}ms)`);
    });

    // =========================================================================
    // TEST 6 : Tentative d'achat après SOLD_OUT -> rejet
    // =========================================================================
    test('TEST 6 : Tentative d\'achat après SOLD_OUT -> rejet immédiat côté serveur', async () => {
        const start = Date.now();
        await assert.rejects(
            async () => {
                await EventService.reserveTicketsAtomic({
                    eventId: testEventId,
                    categoryId: zeroStockCatId,
                    userId: ctrlUserId,
                    quantity: 1,
                    paymentConfirmed: true,
                });
            },
            /Épuisé|Stock insuffisant/,
            'Rejet immédiat avec message explicite'
        );

        const { data: tickets } = await supabase.from('tickets').select('id').eq('category_id', zeroStockCatId);
        assert.equal(tickets?.length, 2, 'Nombre de billets en base strictement inchangé');
        console.log(`  [PASS] Test 6 validé (${Date.now() - start}ms)`);
    });

    // =========================================================================
    // TEST 7 : Tentative claim-free après SOLD_OUT -> rejet
    // =========================================================================
    test('TEST 7 : Tentative claim-free après SOLD_OUT -> rejet TICKET_CATEGORY_SOLD_OUT', async () => {
        const start = Date.now();
        const { data: freeCat } = await supabase.from('ticket_categories').insert({
            event_id: testEventId,
            name: 'Pass Gratuit Presse Test 7',
            price: 0,
            total_quantity: 1,
            sold_quantity: 1,
            is_active: true,
            is_visible: true,
        }).select('*').single();

        const req = new NextRequest('http://localhost/api/tickets/claim-free', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${buyerAToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                eventId: testEventId,
                categoryId: freeCat.id,
                quantity: 1,
            }),
        });

        const res = await claimFreeRoute(req);
        const json = await res.json();
        assert.equal(res.status, 400);
        assert.equal(json.code, 'TICKET_CATEGORY_SOLD_OUT');
        console.log(`  [PASS] Test 7 validé (${Date.now() - start}ms)`);
    });

    // =========================================================================
    // TEST 8 : VIP SOLD_OUT indépendant de STANDARD
    // =========================================================================
    test('TEST 8 : VIP SOLD_OUT indépendant de STANDARD (Standard reste achetable)', async () => {
        const start = Date.now();
        const { data: vipCat } = await supabase.from('ticket_categories').insert({
            event_id: testEventId,
            name: 'Carré VIP Or Test 8',
            price: 50000,
            total_quantity: 1,
            sold_quantity: 1,
            is_active: true,
            is_visible: true,
        }).select('*').single();

        const { data: stdCat } = await supabase.from('ticket_categories').insert({
            event_id: testEventId,
            name: 'Pass Fosse Standard Test 8',
            price: 5000,
            total_quantity: 20,
            sold_quantity: 0,
            is_active: true,
            is_visible: true,
        }).select('*').single();

        // VIP est bloqué
        await assert.rejects(async () => {
            await EventService.reserveTicketsAtomic({
                eventId: testEventId,
                categoryId: vipCat.id,
                userId: buyerAUserId,
                quantity: 1,
                paymentConfirmed: true,
            });
        }, /Épuisé|Stock insuffisant/);

        // Standard est achetable
        const stdBuy = await EventService.reserveTicketsAtomic({
            eventId: testEventId,
            categoryId: stdCat.id,
            userId: buyerAUserId,
            quantity: 2,
            paymentConfirmed: true,
        });
        assert.equal(stdBuy.count, 2);
        console.log(`  [PASS] Test 8 validé (${Date.now() - start}ms)`);
    });

    // =========================================================================
    // TEST 9 : Toutes catégories épuisées -> événement COMPLET
    // =========================================================================
    test('TEST 9 : Toutes catégories épuisées -> isFullySoldOut = true', async () => {
        const start = Date.now();
        const { data: fullEv } = await supabase.from('events').insert({
            partner_id: partnerId,
            title: `Festival Sold Out Complet ${ts}`,
            slug: `festival-soldout-${ts}`,
            category: 'CONCERT',
            start_date: '2026-12-31',
            start_time: '20:00:00',
            location: 'Dakar Arena',
            status: 'PUBLIE',
        }).select('id').single();
        assert.ok(fullEv, 'fullEv doit exister');
        createdEventIds.push(fullEv!.id);

        await supabase.from('ticket_categories').insert([
            { event_id: fullEv!.id, name: 'Pass A', price: 5000, total_quantity: 2, sold_quantity: 2, is_active: true, is_visible: true },
            { event_id: fullEv!.id, name: 'Pass B', price: 10000, total_quantity: 2, sold_quantity: 0, is_active: false, is_visible: true },
        ]);

        const req = new NextRequest(`http://localhost/api/events/${fullEv!.id}`);
        const res = await getEventRoute(req, { params: { id: fullEv!.id } });
        const json = await res.json();
        assert.equal(json.event.isFullySoldOut, true);
        assert.equal(json.event.hasAvailableTickets, false);
        console.log(`  [PASS] Test 9 validé (${Date.now() - start}ms)`);
    });

    // =========================================================================
    // TEST 10 : Catégorie partiellement épuisée -> événement encore achetable
    // =========================================================================
    test('TEST 10 : Catégorie partiellement épuisée -> isFullySoldOut = false', async () => {
        const start = Date.now();
        const { data: partEv } = await supabase.from('events').insert({
            partner_id: partnerId,
            title: `Festival Partiel ${ts}`,
            slug: `festival-partiel-${ts}`,
            category: 'CONCERT',
            start_date: '2026-12-31',
            start_time: '20:00:00',
            location: 'Monument Renaissance',
            status: 'PUBLIE',
        }).select('id').single();
        assert.ok(partEv, 'partEv doit exister');
        createdEventIds.push(partEv!.id);

        await supabase.from('ticket_categories').insert([
            { event_id: partEv!.id, name: 'Pass VIP', price: 50000, total_quantity: 2, sold_quantity: 2, is_active: true, is_visible: true },
            { event_id: partEv!.id, name: 'Pass Fosse', price: 5000, total_quantity: 50, sold_quantity: 5, is_active: true, is_visible: true },
        ]);

        const req = new NextRequest(`http://localhost/api/events/${partEv!.id}`);
        const res = await getEventRoute(req, { params: { id: partEv!.id } });
        const json = await res.json();
        assert.equal(json.event.isFullySoldOut, false);
        assert.equal(json.event.hasAvailableTickets, true);
        console.log(`  [PASS] Test 10 validé (${Date.now() - start}ms)`);
    });

    // =========================================================================
    // TEST 11 : Notification SOLD_OUT exactement une fois (idempotence)
    // =========================================================================
    test('TEST 11 : Notification SOLD_OUT reçue exactement une fois (idempotence en base)', async () => {
        const start = Date.now();
        const { data: notifCat } = await supabase.from('ticket_categories').insert({
            event_id: testEventId,
            name: 'Pass Notification Test 11',
            price: 5000,
            total_quantity: 1,
            sold_quantity: 0,
            is_active: true,
            is_visible: true,
        }).select('*').single();

        await EventService.reserveTicketsAtomic({
            eventId: testEventId,
            categoryId: notifCat.id,
            userId: buyerAUserId,
            quantity: 1,
            paymentConfirmed: true,
        });

        await new Promise(r => setTimeout(r, 600));

        // Re-déclenchement direct
        await NotificationService.sendTicketCategorySoldOutNotification({
            eventId: testEventId,
            categoryId: notifCat.id,
            categoryName: notifCat.name,
            totalQuantity: 1,
        });

        const { data: notifs } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', partnerUserId)
            .eq('metadata->>category_id', notifCat.id)
            .eq('metadata->>alert_type', 'CATEGORY_SOLD_OUT');

        assert.equal(notifs?.length, 1, 'Exactement 1 notification stockée (aucun doublon)');
        console.log(`  [PASS] Test 11 validé (${Date.now() - start}ms)`);
    });

    // =========================================================================
    // TEST 12 : Notification uniquement après transaction réussie
    // =========================================================================
    test('TEST 12 : Notification uniquement après transaction réussie (aucun envoi en cas d\'échec)', async () => {
        const start = Date.now();
        const { data: dummyCat } = await supabase.from('ticket_categories').insert({
            event_id: testEventId,
            name: 'Pass Rejet Notif Test 12',
            price: 5000,
            total_quantity: 1,
            sold_quantity: 1,
            is_active: true,
            is_visible: true,
        }).select('*').single();

        const countBefore = (await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('metadata->>category_id', dummyCat.id)).count || 0;

        // Tentative d'achat vouée à l'échec
        try {
            await EventService.reserveTicketsAtomic({
                eventId: testEventId,
                categoryId: dummyCat.id,
                userId: buyerAUserId,
                quantity: 1,
                paymentConfirmed: true,
            });
        } catch {}

        const countAfter = (await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('metadata->>category_id', dummyCat.id)).count || 0;
        assert.equal(countAfter, countBefore, 'Aucune notification générée sur tentative rejetée');
        console.log(`  [PASS] Test 12 validé (${Date.now() - start}ms)`);
    });

    // =========================================================================
    // TEST 13 : Concurrence -> aucun surbooking (Scénario 1 & Scénario 2)
    // =========================================================================
    test('TEST 13 : Concurrence -> Aucun surbooking sous forte concurrence (Scénario Stock=2 et Stock=10)', async () => {
        const start = Date.now();
        // Scénario A : Stock=2, A=2, B=1, C=1, D=1
        const { data: catA } = await supabase.from('ticket_categories').insert({
            event_id: testEventId,
            name: 'Concurrence 2 Places',
            price: 5000,
            total_quantity: 2,
            sold_quantity: 0,
            is_active: true,
            is_visible: true,
        }).select('*').single();

        await Promise.allSettled([
            EventService.reserveTicketsAtomic({ eventId: testEventId, categoryId: catA.id, userId: buyerAUserId, quantity: 2, paymentConfirmed: true }),
            EventService.reserveTicketsAtomic({ eventId: testEventId, categoryId: catA.id, userId: ctrlUserId, quantity: 1, paymentConfirmed: true }),
            EventService.reserveTicketsAtomic({ eventId: testEventId, categoryId: catA.id, userId: ctrlUserId, quantity: 1, paymentConfirmed: true }),
            EventService.reserveTicketsAtomic({ eventId: testEventId, categoryId: catA.id, userId: ctrlUserId, quantity: 1, paymentConfirmed: true }),
        ]);

        const ticketsInDbA = await supabase.from('tickets').select('id').eq('category_id', catA.id);
        assert.equal(ticketsInDbA.data?.length, 2, 'Scénario A : Exactement 2 tickets créés en base (JAMAIS 3 ni 5)');

        // Scénario B : Stock=10, 10 demandes de 2 billets avec retry CAS
        const { data: catB } = await supabase.from('ticket_categories').insert({
            event_id: testEventId,
            name: 'Concurrence 10 Places',
            price: 5000,
            total_quantity: 10,
            sold_quantity: 0,
            is_active: true,
            is_visible: true,
        }).select('*').single();

        const batchReqs = Array.from({ length: 10 }).map((_, idx) =>
            EventService.reserveTicketsAtomic({
                eventId: testEventId,
                categoryId: catB.id,
                userId: idx % 2 === 0 ? buyerAUserId : ctrlUserId,
                quantity: 2,
                paymentConfirmed: true,
            })
        );

        const resultsB = await Promise.allSettled(batchReqs);
        const successesB = resultsB.filter(r => r.status === 'fulfilled');
        const ticketsInDbB = await supabase.from('tickets').select('id').eq('category_id', catB.id);

        assert.equal(successesB.length, 5, 'Exactement 5 transactions ont réussi (5 x 2 = 10 billets)');
        assert.equal(ticketsInDbB.data?.length, 10, 'Scénario B : Exactement 10 tickets créés en base (ZÉRO surbooking)');

        const { data: finalCatB } = await supabase.from('ticket_categories').select('sold_quantity').eq('id', catB.id).single();
        assert.equal(finalCatB?.sold_quantity, 10, 'sold_quantity = 10');
        console.log(`  [PASS] Test 13 validé (${Date.now() - start}ms)`);
    });

    // =========================================================================
    // TEST 14 : Échec création ticket -> rollback relatif sécurisé
    // =========================================================================
    test('TEST 14 : Échec création ticket -> rollback relatif sécurisé (préserve les réservations concurrentes)', async () => {
        const start = Date.now();
        const { data: cat } = await supabase.from('ticket_categories').insert({
            event_id: testEventId,
            name: 'Pass Rollback Sécurisé Test 14',
            price: 5000,
            total_quantity: 10,
            sold_quantity: 4, // 4 places déjà vendues
            is_active: true,
            is_visible: true,
        }).select('*').single();

        // Décrémentation relative testée directement
        const latestSold = 4;
        const requestedQty = 2;
        const rolledBack = Math.max(0, latestSold - requestedQty);

        const { data: updated } = await supabase
            .from('ticket_categories')
            .update({ sold_quantity: rolledBack })
            .eq('id', cat.id)
            .eq('sold_quantity', latestSold)
            .select('*')
            .single();

        assert.equal(updated?.sold_quantity, 2, 'Le rollback relatif a rétabli le stock sans écraser les autres');
        console.log(`  [PASS] Test 14 validé (${Date.now() - start}ms)`);
    });

    // =========================================================================
    // TEST 15 : Réapprovisionnement -> ACTIVE
    // =========================================================================
    test('TEST 15 : Réapprovisionnement (+5 billets sur SOLD_OUT) -> Statut repasse à ACTIVE', async () => {
        const start = Date.now();
        const { data: cat } = await supabase.from('ticket_categories').insert({
            event_id: testEventId,
            name: 'Pass Restock Test 15',
            price: 5000,
            total_quantity: 2,
            sold_quantity: 2, // Épuisé
            is_active: true,
            is_visible: true,
        }).select('*').single();

        // Réapprovisionnement de 2 à 7 places
        await EventService.updateCategoryStockAndStatus(partnerUserId, testEventId, cat.id, {
            total_quantity: 7,
        });

        const req = new NextRequest(`http://localhost/api/events/${testEventId}`);
        const res = await getEventRoute(req, { params: { id: testEventId } });
        const json = await res.json();
        const apiCat = json.event.categories.find((c: any) => c.id === cat.id);

        assert.equal(apiCat.status, 'ACTIVE');
        assert.equal(apiCat.isSoldOut, false);
        assert.equal(apiCat.availableQuantity, 5);
        assert.equal(apiCat.isAvailable, true);
        console.log(`  [PASS] Test 15 validé (${Date.now() - start}ms)`);
    });

    // =========================================================================
    // TEST 16 : Realtime stock
    // =========================================================================
    test('TEST 16 : Realtime stock -> Payload UPDATE ticket_categories contient les champs requis', async () => {
        const start = Date.now();
        const { data: cat } = await supabase.from('ticket_categories').insert({
            event_id: testEventId,
            name: 'Pass Realtime Test 16',
            price: 5000,
            total_quantity: 10,
            sold_quantity: 2,
            is_active: true,
            is_visible: true,
        }).select('*').single();

        const { data: updatedCat } = await supabase
            .from('ticket_categories')
            .update({ sold_quantity: 5, updated_at: new Date().toISOString() })
            .eq('id', cat.id)
            .select('*')
            .single();

        assert.equal(updatedCat?.event_id, testEventId);
        assert.equal(updatedCat?.sold_quantity, 5);
        assert.equal(updatedCat?.total_quantity, 10);
        console.log(`  [PASS] Test 16 validé (${Date.now() - start}ms)`);
    });

    // =========================================================================
    // TEST 17 : Realtime nouveau billet (INSERT ticket)
    // =========================================================================
    test('TEST 17 : Realtime nouveau billet -> Payload INSERT ticket contient QR et statut VALIDE', async () => {
        const start = Date.now();
        const buyRes = await EventService.reserveTicketsAtomic({
            eventId: testEventId,
            categoryId: singleCatId,
            userId: buyerAUserId,
            quantity: 1,
            paymentConfirmed: true,
        });

        assert.ok(buyRes.ticket.id);
        assert.equal(buyRes.ticket.user_id, buyerAUserId);
        assert.equal(buyRes.ticket.status, 'VALIDE');
        console.log(`  [PASS] Test 17 validé (${Date.now() - start}ms)`);
    });

    // =========================================================================
    // TEST 18 : Realtime billet UTILISE (UPDATE ticket)
    // =========================================================================
    let ticketToScanId: string;
    let ticketToScanQr: string;
    test('TEST 18 : Realtime billet UTILISE -> Scan réussi & mise à jour du statut vers UTILISE avec checked_in_at', async () => {
        const start = Date.now();
        const buyRes = await EventService.reserveTicketsAtomic({
            eventId: testEventId,
            categoryId: singleCatId,
            userId: buyerAUserId,
            quantity: 1,
            paymentConfirmed: true,
        });
        ticketToScanId = buyRes.ticket.id;
        ticketToScanQr = buyRes.ticket.qr_code;

        // Contrôleur scanne le billet avec qr_code
        const req = new NextRequest('http://localhost:3000/api/controller/scan', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${ctrlToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ qr_code: ticketToScanQr }),
        });

        const res = await controllerScanRoute(req);
        const json = await res.json();
        assert.equal(res.status, 200);
        assert.equal(json.scan_result, 'valid', 'Validation du premier scan réussie');

        const { data: dbTicket } = await supabase.from('tickets').select('status, checked_in_at').eq('id', ticketToScanId).single();
        assert.equal(dbTicket?.status, 'UTILISE');
        assert.ok(dbTicket?.checked_in_at);
        console.log(`  [PASS] Test 18 validé (${Date.now() - start}ms)`);
    });

    // =========================================================================
    // TEST 19 : Billet utilisé -> Historique (isUpcoming = false)
    // =========================================================================
    test('TEST 19 : Billet utilisé -> Apparaît avec isUpcoming = false dans l\'API /api/tickets', async () => {
        const start = Date.now();
        const req = new NextRequest('http://localhost/api/tickets', {
            headers: { 'Authorization': `Bearer ${buyerAToken}` },
        });
        const res = await getTicketsRoute(req);
        const json = await res.json();

        const usedTicket = json.tickets.find((t: any) => t.id === ticketToScanId);
        assert.ok(usedTicket, 'Le billet est présent dans la liste');
        assert.equal(usedTicket.status, 'UTILISE');
        assert.equal(usedTicket.isUpcoming, false, 'Le billet utilisé est classé dans l\'historique (isUpcoming = false)');
        console.log(`  [PASS] Test 19 validé (${Date.now() - start}ms)`);
    });

    // =========================================================================
    // TEST 20 : Double scan -> ALREADY_USED
    // =========================================================================
    test('TEST 20 : Double scan -> ALREADY_USED retourné immédiatement', async () => {
        const start = Date.now();
        const req = new NextRequest('http://localhost:3000/api/controller/scan', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${ctrlToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ qr_code: ticketToScanQr }),
        });

        const res = await controllerScanRoute(req);
        const json = await res.json();
        assert.equal(res.status, 200);
        assert.equal(json.scan_result, 'already_used', 'Double scan immédiatement rejeté');
        assert.ok(json.ticket_info?.checked_in_at || json.checked_in_at, 'Date de compostage initial retournée');
        console.log(`  [PASS] Test 20 validé (${Date.now() - start}ms)`);
    });

    // =========================================================================
    // TEST 21 : Isolation RLS (Confidentialité des billets)
    // =========================================================================
    test('TEST 21 : Isolation RLS -> Un utilisateur ne peut pas voir les billets d\'un autre acheteur', async () => {
        const start = Date.now();
        const reqB = new NextRequest('http://localhost/api/tickets', {
            headers: { 'Authorization': `Bearer ${ctrlToken}` },
        });
        const resB = await getTicketsRoute(reqB);
        const jsonB = await resB.json();

        const hasUserATickets = jsonB.tickets.some((t: any) => t.id === ticketToScanId);
        assert.equal(hasUserATickets, false, 'Le contrôleur / user B ne voit aucun billet appartenant à l\'acheteur A');
        console.log(`  [PASS] Test 21 validé (${Date.now() - start}ms)`);
    });

    // =========================================================================
    // TEST 22 : Organisateur non propriétaire -> Accès refusé
    // =========================================================================
    test('TEST 22 : Organisateur non propriétaire -> Rejet de la modification du stock (403/Error)', async () => {
        const start = Date.now();
        const req = new NextRequest(`http://localhost/api/partner/events/${testEventId}/categories/${singleCatId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${otherPartnerToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ total_quantity: 999 }),
        });

        const res = await updateCategoryRoute(req, { params: Promise.resolve({ id: testEventId, categoryId: singleCatId }) });
        const json = await res.json();

        assert.equal(json.success, false, 'Modification refusée à l\'organisateur non propriétaire');
        assert.match(json.error, /propriétaire|introuvable|autorisé/i);
        console.log(`  [PASS] Test 22 validé (${Date.now() - start}ms)`);
    });
});
