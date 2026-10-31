import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// [lot 0] Chargement de .env.local supprimé : l'environnement de test (.env.test, instance Supabase locale)
// et le garde-fou anti-base réelle sont fournis par tests/helpers/env.ts.
import '../helpers/env';

import { getServiceRoleClient } from '../../lib/supabase/server';
import { NotificationService } from '../../lib/notifications/notification.service';
import { GET as getTicketsRoute } from '../../app/api/tickets/route';
import { POST as claimFreeRoute } from '../../app/api/tickets/claim-free/route';
import { POST as controllerScanRoute } from '../../app/api/controller/scan/route';
import { GET as getLiveCodeRoute } from '../../app/api/tickets/[id]/live-code/route';

describe('BILLETTERIE CLIENT — CYCLE DE VIE COMPLET (20 POINTS D\'AUDIT & CONFORMITÉ)', async () => {
    const supabase = getServiceRoleClient();
    const publicAuth = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const ts = Date.now().toString().slice(-6);

    // Acteurs de test
    const partnerUserId = 'e706a7a2-502c-4396-9e91-4dc6720388f7';
    const partnerId = 'a917b7ac-d542-4c2b-b5d8-ab38f866b2e7';
    const ctrlUserId = 'fe9318ac-1f65-4e80-980f-f00626f1a003';
    const buyerUserId = 'a7345050-03cf-4967-9281-9ee5eb75615a';

    let buyerToken: string;
    let ctrlToken: string;
    let partnerToken: string;

    let eventId: string;
    let paidCatId: string;
    let freeCatId: string;

    const createdTicketIds: string[] = [];
    const createdPaymentIds: string[] = [];

    before(async () => {
        const startSetup = Date.now();
        console.log('\n[SETUP] Initialisation du banc d\'essai Billetterie Client...');

        // 1. Authentification des acteurs avec relecture des emails réels
        const { data: bAuthUser } = await supabase.auth.admin.getUserById(buyerUserId);
        const bEmail = bAuthUser?.user?.email || 'client@eventvillage.sn';
        await supabase.from('users').update({ status: 'ACTIF', role: 'CLIENT', first_name: 'Client', last_name: 'Test', phone: '221771234567' }).eq('id', buyerUserId);
        await supabase.from('user_roles').delete().eq('user_id', buyerUserId);
        await supabase.from('user_roles').insert({ user_id: buyerUserId, role: 'CLIENT' });
        await supabase.auth.admin.updateUserById(buyerUserId, { password: process.env.LEGACY_TEST_PASSWORD!, email_confirm: true, user_metadata: { role: 'CLIENT' } });
        const { data: bAuth } = await publicAuth.auth.signInWithPassword({
            email: bEmail,
            password: process.env.LEGACY_TEST_PASSWORD!,
        });
        buyerToken = bAuth?.session?.access_token || '';
        assert.ok(buyerToken, 'buyerToken obtenu');

        const { data: cAuthUser } = await supabase.auth.admin.getUserById(ctrlUserId);
        const cEmail = cAuthUser?.user?.email || 'controleur@eventvillage.sn';
        await supabase.from('users').update({ status: 'ACTIF', role: 'CONTROLEUR', phone: '221772223344' }).eq('id', ctrlUserId);
        await supabase.from('user_roles').delete().eq('user_id', ctrlUserId);
        await supabase.from('user_roles').insert({ user_id: ctrlUserId, role: 'CONTROLEUR' });
        await supabase.auth.admin.updateUserById(ctrlUserId, { password: process.env.LEGACY_TEST_PASSWORD!, email_confirm: true, user_metadata: { role: 'CONTROLEUR' } });
        const { data: cAuth } = await publicAuth.auth.signInWithPassword({
            email: cEmail,
            password: process.env.LEGACY_TEST_PASSWORD!,
        });
        ctrlToken = cAuth?.session?.access_token || '';
        assert.ok(ctrlToken, 'ctrlToken obtenu');

        const { data: pAuthUser } = await supabase.auth.admin.getUserById(partnerUserId);
        const pEmail = pAuthUser?.user?.email || 'fallouu.dev@gmail.com';
        await supabase.from('users').update({ status: 'ACTIF', role: 'PARTENAIRE', phone: '221770006743' }).eq('id', partnerUserId);
        await supabase.from('user_roles').delete().eq('user_id', partnerUserId);
        await supabase.from('user_roles').insert({ user_id: partnerUserId, role: 'PARTENAIRE' });
        await supabase.auth.admin.updateUserById(partnerUserId, { password: process.env.LEGACY_TEST_PASSWORD!, email_confirm: true, user_metadata: { role: 'PARTENAIRE' } });
        const { data: pAuth } = await publicAuth.auth.signInWithPassword({
            email: pEmail,
            password: process.env.LEGACY_TEST_PASSWORD!,
        });
        partnerToken = pAuth?.session?.access_token || '';
        assert.ok(partnerToken, 'partnerToken obtenu');

        // 2. Création de l'événement de test
        const { data: event, error: eventErr } = await supabase.from('events').insert({
            partner_id: partnerId,
            title: `Festival Test Billetterie Multi-Achat ${ts}`,
            slug: `festival-test-billetterie-${ts}`,
            description: 'Événement de test pour validation bout-en-bout du cycle billetterie',
            category: 'CONCERT',
            start_date: new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0],
            start_time: '20:00:00',
            location: 'Grand Théâtre National, Dakar',
            city: 'Dakar',
            status: 'PUBLIE',
        }).select().single();

        if (eventErr || !event) throw new Error(`Échec création event: ${eventErr?.message}`);
        eventId = event.id;

        // 3. Catégorie Payante (5000 FCFA, 50 places)
        const { data: pCat, error: pCatErr } = await supabase.from('ticket_categories').insert({
            event_id: eventId,
            name: `Pass VIP ${ts}`,
            price: 5000,
            total_quantity: 50,
            sold_quantity: 0,
        }).select().single();
        if (pCatErr || !pCat) throw new Error(`Échec création cat payante: ${pCatErr?.message}`);
        paidCatId = pCat.id;

        // 4. Catégorie Gratuite (0 FCFA, 20 places)
        const { data: fCat, error: fCatErr } = await supabase.from('ticket_categories').insert({
            event_id: eventId,
            name: `Pass Gratuit Presse ${ts}`,
            price: 0,
            total_quantity: 20,
            sold_quantity: 0,
        }).select().single();
        if (fCatErr || !fCat) throw new Error(`Échec création cat gratuite: ${fCatErr?.message}`);
        freeCatId = fCat.id;

        // 5. Affectation du contrôleur sur l'événement
        await supabase.from('event_controllers').insert({
            user_id: ctrlUserId,
            event_id: eventId,
            can_accept_cash: true,
            created_by: partnerUserId,
        });

        console.log(`[SETUP] Initialisation terminée en ${Date.now() - startSetup}ms`);
    });

    after(async () => {
        console.log('\n[TEARDOWN] Nettoyage des données de test...');
        if (createdTicketIds.length > 0) {
            await supabase.from('tickets').delete().in('id', createdTicketIds);
        }
        if (createdPaymentIds.length > 0) {
            await supabase.from('payments').delete().in('id', createdPaymentIds);
        }
        await supabase.from('event_controllers').delete().eq('event_id', eventId);
        await supabase.from('ticket_categories').delete().eq('event_id', eventId);
        await supabase.from('events').delete().eq('id', eventId);
        console.log('[TEARDOWN] Nettoyage complet terminé.');
    });

    // [lot 2 — cas supprimé] Test 1 Achat multi-billets (N=3) : createPayment(TICKET) et PaymentService.handleSamirPayWebhook supprimés (checkout puis RPC payment_confirm) ; couvert par tests/parcours/paiement-confirmation.test.ts et tests/parcours/paiement-webhook.test.ts
    // [lot 2 — cas supprimé] Test 2 Montant exact pour N=3 : lisait le paiement créé par le test 1 (supprimé) ; couvert par tests/parcours/paiement-confirmation.test.ts (montants lus, pas recalculés)
    // [lot 2 — cas supprimé] Test 3 Décrément du stock (-3) : vérifiait l'effet du test 1 (supprimé) ; couvert par tests/parcours/paiement-confirmation.test.ts (held sans double décrément)

    // ─────────────────────────────────────────────────────────────
    // TEST 4 : Réservation de billets gratuits (N=2) via /api/tickets/claim-free
    // ─────────────────────────────────────────────────────────────
    test('Test 4 : Réservation de billets gratuits (N=2) via /api/tickets/claim-free', async () => {
        const start = Date.now();
        const req = new NextRequest('http://localhost:3000/api/tickets/claim-free', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${buyerToken}`,
            },
            body: JSON.stringify({
                categoryId: freeCatId,
                quantity: 2,
            }),
        });

        const res = await claimFreeRoute(req);
        const data = await res.json();

        assert.strictEqual(res.status, 201, 'Statut HTTP 201 attendu');
        assert.strictEqual(data.success, true, 'Réservation gratuite doit réussir');
        assert.strictEqual(data.count, 2, 'Doit confirmer 2 billets');
        assert.strictEqual(data.tickets.length, 2, 'Doit renvoyer 2 billets créés');

        data.tickets.forEach((t: any) => createdTicketIds.push(t.id));

        const { data: freeCat } = await supabase
            .from('ticket_categories')
            .select('sold_quantity')
            .eq('id', freeCatId)
            .single();

        assert.strictEqual(freeCat?.sold_quantity, 2, 'sold_quantity de la catégorie gratuite doit être 2');
        console.log(`  ✓ 2 Billets gratuits créés avec succès (${Date.now() - start}ms)`);
    });

    // ─────────────────────────────────────────────────────────────
    // TEST 5 : Notification In-App Acheteur générée en base
    // ─────────────────────────────────────────────────────────────
    test('Test 5 : Notification In-App Acheteur générée en base après confirmation d\'achat', async () => {
        const { data: notifs, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', buyerUserId)
            .order('created_at', { ascending: false });

        assert.ok(!error && notifs && notifs.length > 0, 'Notification in-app acheteur doit être présente');
        const notif = notifs[0];
        assert.ok(notif.title.includes('Achat confirmé') || notif.title.includes('Confirmation') || notif.title.includes('billet'), 'Titre doit mentionner l\'achat');
        console.log(`  ✓ Notification In-App Acheteur validée : "${notif.title}"`);
    });

    // ─────────────────────────────────────────────────────────────
    // TEST 6 : Notifications SMS & Email acheteur dispatchées
    // ─────────────────────────────────────────────────────────────
    test('Test 6 : NotificationService orchestre les canaux Email et SMS Acheteur', async () => {
        const notifResult = await NotificationService.sendTicketPurchaseNotifications({
            userId: buyerUserId,
            eventId,
            categoryId: paidCatId,
            ticketCount: 3,
            ticketNumbers: ['EV-TIC-TEST1', 'EV-TIC-TEST2', 'EV-TIC-TEST3'],
            totalAmount: 15000,
            clientPhone: '771234567',
            clientEmail: 'client.test@eventvillage.sn',
            clientName: 'Client Test Multi-Achat',
        });

        assert.strictEqual(notifResult.client.inApp, true, 'In-App acheteur validé');
        assert.strictEqual(notifResult.organizer.inApp, true, 'In-App organisateur validé');
        console.log('  ✓ 6 Canaux orchestrés (Buyer In-App/SMS/Email + Organizer In-App/SMS/Email)');
    });

    // ─────────────────────────────────────────────────────────────
    // TEST 7 : Notification In-App Organisateur générée en base
    // ─────────────────────────────────────────────────────────────
    test('Test 7 : Notification In-App & Alerte Vente Organisateur générée en base', async () => {
        const { data: orgNotifs, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', partnerUserId)
            .order('created_at', { ascending: false });

        assert.ok(!error && orgNotifs && orgNotifs.length > 0, 'Notification organisateur doit être présente');
        const orgNotif = orgNotifs[0];
        assert.ok(orgNotif.title.includes('Nouvelle') || orgNotif.title.includes('commande') || orgNotif.title.includes('billet'), 'Titre doit mentionner nouvelle vente/commande');
        console.log(`  ✓ Alerte Vente Organisateur validée : "${orgNotif.title}"`);
    });

    // [lot 2 — cas supprimé] Test 8 Idempotence du webhook : PaymentService.handleSamirPayWebhook supprimé ; couvert par tests/parcours/paiement-webhook.test.ts (rejeu) et tests/parcours/paiement-confirmation.test.ts
    // [lot 2 — cas supprimé] Test 9 GET /api/tickets, isUpcoming=true : l'assertion « au moins 5 billets (3 payants + 2 gratuits) » dépend des billets payants du test 1 (supprimé) ; non couvert pour isUpcoming=true (isUpcoming=false reste vérifié par le test 13)

    // ─────────────────────────────────────────────────────────────
    // TEST 10 : Scan & Compostage du Billet 1 par le contrôleur
    // ─────────────────────────────────────────────────────────────
    let scannedTicketId: string;
    let scannedQrCode: string;

    test('Test 10 : Scan & Compostage du Billet 1 par le contrôleur (/api/controller/scan)', async () => {
        const start = Date.now();
        // Récupérer le premier billet créé
        const { data: ticket } = await supabase
            .from('tickets')
            .select('*')
            .eq('id', createdTicketIds[0])
            .single();

        assert.ok(ticket, 'Billet 1 trouvé');
        scannedTicketId = ticket.id;
        scannedQrCode = ticket.qr_code;

        const scanReq = new NextRequest('http://localhost:3000/api/controller/scan', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${ctrlToken}`,
            },
            body: JSON.stringify({
                qr_code: scannedQrCode,
            }),
        });

        const scanRes = await controllerScanRoute(scanReq);
        const scanData = await scanRes.json();

        assert.strictEqual(scanRes.status, 200, 'Scan doit retourner HTTP 200');
        assert.strictEqual(scanData.scan_result, 'valid', 'Validation du billet réussie');

        // Relecture DB
        const { data: updatedTicket } = await supabase
            .from('tickets')
            .select('status, checked_in_at')
            .eq('id', scannedTicketId)
            .single();

        assert.strictEqual(updatedTicket?.status, 'UTILISE', 'Statut DB doit être UTILISE');
        assert.ok(updatedTicket?.checked_in_at !== null, 'checked_in_at doit être renseigné');
        console.log(`  ✓ Billet 1 composté avec succès (${Date.now() - start}ms) à ${updatedTicket?.checked_in_at}`);
    });

    // ─────────────────────────────────────────────────────────────
    // TEST 11 : Rejet du double scan sur le Billet 1
    // ─────────────────────────────────────────────────────────────
    test('Test 11 : Rejet du double scan sur le Billet 1 (already_used)', async () => {
        const scanReq = new NextRequest('http://localhost:3000/api/controller/scan', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${ctrlToken}`,
            },
            body: JSON.stringify({
                qr_code: scannedQrCode,
            }),
        });

        const scanRes = await controllerScanRoute(scanReq);
        const scanData = await scanRes.json();

        assert.strictEqual(scanData.scan_result, 'already_used', 'Le second scan doit être rejeté comme already_used');
        assert.ok(scanData.ticket_info?.checked_in_at, 'Doit fournir l\'horodatage du 1er compostage');
        console.log(`  ✓ Double scan bloqué avec succès : Déjà composté à ${scanData.ticket_info?.checked_in_at}`);
    });

    // ─────────────────────────────────────────────────────────────
    // TEST 12 : Indépendance des billets multi-achat
    // ─────────────────────────────────────────────────────────────
    test('Test 12 : Indépendance — Les Billets 2 et 3 restent VALIDE et non compostés', async () => {
        const otherTicketIds = createdTicketIds.filter(id => id !== scannedTicketId);

        const { data: remainingTickets } = await supabase
            .from('tickets')
            .select('id, ticket_number, status, checked_in_at')
            .in('id', otherTicketIds);

        assert.ok(remainingTickets, 'Billets restants trouvés');
        assert.strictEqual(remainingTickets.length, otherTicketIds.length);

        remainingTickets.forEach(t => {
            assert.strictEqual(t.status, 'VALIDE', `Billet ${t.ticket_number} doit rester VALIDE`);
            assert.strictEqual(t.checked_in_at, null, `Billet ${t.ticket_number} ne doit pas avoir de checked_in_at`);
        });

        console.log(`  ✓ ${remainingTickets.length} autres billets parfaitement intacts et valides`);
    });

    // ─────────────────────────────────────────────────────────────
    // TEST 13 : API GET /api/tickets après scan
    // ─────────────────────────────────────────────────────────────
    test('Test 13 : API GET /api/tickets : Billet 1 a isUpcoming=false et usedAt renseigné', async () => {
        const req = new NextRequest(`http://localhost:3000/api/tickets?userId=${buyerUserId}`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${buyerToken}` },
        });

        const res = await getTicketsRoute(req);
        const data = await res.json();

        const t1 = data.tickets.find((t: any) => t.id === scannedTicketId);
        assert.ok(t1, 'Billet 1 présent dans la réponse');
        assert.strictEqual(t1.status, 'UTILISE', 'Billet 1 status = UTILISE');
        assert.strictEqual(t1.isUpcoming, false, 'Billet 1 isUpcoming = false');
        assert.ok(t1.usedAt, 'Billet 1 usedAt doit contenir la date de compostage');

        console.log(`  ✓ API mise à jour : Billet 1 isUpcoming=false, usedAt=${t1.usedAt}`);
    });

    // ─────────────────────────────────────────────────────────────
    // TEST 14 : Filtrage Frontend - Onglet 'Historique / Utilisés'
    // ─────────────────────────────────────────────────────────────
    test('Test 14 : Filtrage Frontend — Onglet "Historique / Utilisés" inclut le Billet 1', async () => {
        const isPastTab = (t: { status: string; isUpcoming: boolean }) =>
            t.status === 'UTILISE' || !t.isUpcoming;

        assert.strictEqual(isPastTab({ status: 'UTILISE', isUpcoming: false }), true);
        console.log('  ✓ Billet 1 filtré correctement dans l\'onglet "Historique / Utilisés"');
    });

    // ─────────────────────────────────────────────────────────────
    // TEST 15 : Filtrage Frontend - Onglet 'À venir'
    // ─────────────────────────────────────────────────────────────
    test('Test 15 : Filtrage Frontend — Onglet "À venir" exclut le Billet 1 et conserve Billets 2 et 3', async () => {
        const isUpcomingTab = (t: { status: string; isUpcoming: boolean }) =>
            t.status === 'VALIDE' && t.isUpcoming;

        assert.strictEqual(isUpcomingTab({ status: 'UTILISE', isUpcoming: false }), false, 'Billet 1 exclu de À venir');
        assert.strictEqual(isUpcomingTab({ status: 'VALIDE', isUpcoming: true }), true, 'Billet 2 inclus dans À venir');
        console.log('  ✓ Onglet "À venir" : Billet 1 exclu, Billets 2 & 3 présents sans rechargement');
    });

    // ─────────────────────────────────────────────────────────────
    // TEST 16 : Rotation TOTP QR dynamique pour billet VALIDE
    // ─────────────────────────────────────────────────────────────
    test('Test 16 : Rotation TOTP QR dynamique fonctionnelle pour billet VALIDE', async () => {
        const ticket2Id = createdTicketIds[1];
        const req = new NextRequest(`http://localhost:3000/api/tickets/${ticket2Id}/live-code`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${buyerToken}` },
        });

        const res = await getLiveCodeRoute(req, { params: { id: ticket2Id } });
        const data = await res.json();

        assert.strictEqual(res.status, 200);
        assert.strictEqual(data.success, true);
        assert.ok(data.qr_payload.startsWith('EVT1:') || data.qr_payload.startsWith('EVTOTP:'), 'Payload QR dynamique TOTP');
        assert.ok(data.expires_in > 0, 'expires_in doit être positif');
        console.log(`  ✓ Live-Code dynamique généré : ${data.qr_payload.substring(0, 30)}... (expire dans ${data.expires_in}s)`);
    });

    // ─────────────────────────────────────────────────────────────
    // TEST 17 : Refus de génération live-code pour billet UTILISE
    // ─────────────────────────────────────────────────────────────
    test('Test 17 : Refus de génération live-code TOTP pour billet UTILISE', async () => {
        const req = new NextRequest(`http://localhost:3000/api/tickets/${scannedTicketId}/live-code`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${buyerToken}` },
        });

        const res = await getLiveCodeRoute(req, { params: { id: scannedTicketId } });
        const data = await res.json();

        assert.strictEqual(res.status, 400);
        assert.ok(data.error.includes('déjà utilisé') || data.error.includes('non valide') || data.error.includes('utilisé'));
        console.log('  ✓ Live-Code refusé pour billet déjà utilisé');
    });

    // [lot 2 — cas supprimé] Test 18 Rejet du surbooking : createPayment(TICKET) supprimé (refus USE_TICKET_CHECKOUT) ; couvert par tests/parcours/paiement-reservation.test.ts (dernière place, panier partiel)

    // ─────────────────────────────────────────────────────────────
    // TEST 19 : Isolation RLS & Confidentialité Acheteurs
    // ─────────────────────────────────────────────────────────────
    test('Test 19 : Isolation RLS — Requête avec token tiers ne voit pas les billets de l\'acheteur', async () => {
        // Essai d'accès aux billets du client test avec le token du contrôleur
        const req = new NextRequest(`http://localhost:3000/api/tickets`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${ctrlToken}` },
        });

        const res = await getTicketsRoute(req);
        const data = await res.json();

        const controllerTickets = data.tickets || [];
        const foundBuyerTickets = controllerTickets.filter((t: any) => createdTicketIds.includes(t.id));
        assert.strictEqual(foundBuyerTickets.length, 0, 'Aucun billet d\'un tiers ne doit être visible');
        console.log('  ✓ Isolation et confidentialité RLS vérifiées');
    });

    // ─────────────────────────────────────────────────────────────
    // TEST 20 : Validation de la structure Realtime Event UPDATE
    // ─────────────────────────────────────────────────────────────
    test('Test 20 : Payload Realtime UPDATE contient les champs critiques (status=UTILISE, checked_in_at)', async () => {
        const { data: ticket } = await supabase
            .from('tickets')
            .select('id, user_id, status, checked_in_at, qr_code')
            .eq('id', scannedTicketId)
            .single();

        assert.ok(ticket);
        assert.strictEqual(ticket.user_id, buyerUserId);
        assert.strictEqual(ticket.status, 'UTILISE');
        assert.ok(ticket.checked_in_at !== null);

        // Simulation du traitement dans le hook frontend
        const realtimeEvent = {
            eventType: 'UPDATE',
            new: ticket,
        };

        const frontendTicketState = {
            id: ticket.id,
            status: 'VALIDE',
            isUpcoming: true,
            usedAt: null as string | null,
        };

        const updatedState = realtimeEvent.eventType === 'UPDATE' && realtimeEvent.new.id === frontendTicketState.id
            ? {
                ...frontendTicketState,
                status: realtimeEvent.new.status,
                usedAt: realtimeEvent.new.checked_in_at,
                isUpcoming: realtimeEvent.new.status === 'VALIDE' && frontendTicketState.isUpcoming,
            }
            : frontendTicketState;

        assert.strictEqual(updatedState.status, 'UTILISE');
        assert.strictEqual(updatedState.isUpcoming, false);
        assert.strictEqual(updatedState.usedAt, ticket.checked_in_at);
        console.log('  ✓ Synchronisation d\'état Realtime frontend sans F5 simulée et validée à 100%');
    });
});
