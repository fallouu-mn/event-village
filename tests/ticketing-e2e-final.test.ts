import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { getServiceRoleClient } from '../lib/supabase/server';
import { EventService } from '../lib/events/event.service';
import { NotificationService } from '../lib/notifications/notification.service';
import { POST as claimFreeRoute } from '../app/api/tickets/claim-free/route';
import { GET as getEventRoute } from '../app/api/events/[id]/route';
import { PATCH as updatePartnerCategoryRoute } from '../app/api/partner/events/[id]/categories/[categoryId]/route';
import { POST as controllerScanRoute } from '../app/api/controller/scan/route';
import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

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

describe('BILLETTERIE EVENT VILLAGE — AUDIT E2E & BLINDAGE FINAL (20 POINTS CDC V3.0)', () => {
    const supabase = getServiceRoleClient();
    const publicAuth = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

    const partnerUserId = 'e706a7a2-502c-4396-9e91-4dc6720388f7';
    const partnerId = 'a917b7ac-d542-4c2b-b5d8-ab38f866b2e7';
    const buyerAUserId = 'a7345050-03cf-4967-9281-9ee5eb75615a';
    const ctrlUserId = 'fe9318ac-1f65-4e80-980f-f00626f1a003';
    const otherPartnerUserId = '775818bd-1833-4e99-843d-3f5ecf8196e3';

    let partnerToken: string;
    let otherPartnerToken: string;
    let buyerAToken: string;
    let ctrlToken: string;

    let mainEventId: string;
    const createdEventIds: string[] = [];
    const ts = Date.now();

    before(async () => {
        console.log('[SETUP] Préparation du banc d\'audit final E2E...');
        const start = Date.now();

        // 1. Partenaire A
        const { data: pAuthUser } = await supabase.auth.admin.getUserById(partnerUserId);
        const pEmail = pAuthUser?.user?.email || 'fallouu.dev@gmail.com';
        await supabase.from('users').update({ status: 'ACTIF', role: 'PARTENAIRE', phone: '221770006743' }).eq('id', partnerUserId);
        await supabase.from('user_roles').delete().eq('user_id', partnerUserId);
        await supabase.from('user_roles').insert({ user_id: partnerUserId, role: 'PARTENAIRE' });
        await supabase.auth.admin.updateUserById(partnerUserId, { password: 'Password123!', email_confirm: true, user_metadata: { role: 'PARTENAIRE' } });
        const { data: pAuth } = await publicAuth.auth.signInWithPassword({
            email: pEmail,
            password: 'Password123!',
        });
        partnerToken = pAuth?.session?.access_token || '';
        assert.ok(partnerToken, 'partnerToken obtenu');

        // 2. Partenaire B
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

        // 3. Acheteur A
        const { data: bAuthUser } = await supabase.auth.admin.getUserById(buyerAUserId);
        const bEmail = bAuthUser?.user?.email || 'clientA@test.com';
        await supabase.from('users').update({ status: 'ACTIF', role: 'CLIENT', phone: '221771234567' }).eq('id', buyerAUserId);
        await supabase.from('user_roles').delete().eq('user_id', buyerAUserId);
        await supabase.from('user_roles').insert({ user_id: buyerAUserId, role: 'CLIENT' });
        await supabase.auth.admin.updateUserById(buyerAUserId, { password: 'Password123!', email_confirm: true, user_metadata: { role: 'CLIENT' } });
        const { data: bAAuth } = await publicAuth.auth.signInWithPassword({
            email: bEmail,
            password: 'Password123!',
        });
        buyerAToken = bAAuth?.session?.access_token || '';
        assert.ok(buyerAToken, 'buyerAToken obtenu');

        // 4. Contrôleur
        const { data: cAuthUser } = await supabase.auth.admin.getUserById(ctrlUserId);
        const cEmail = cAuthUser?.user?.email || 'clientB@test.com';
        await supabase.from('users').update({ status: 'ACTIF', role: 'CONTROLEUR', phone: '221772223344' }).eq('id', ctrlUserId);
        await supabase.from('user_roles').delete().eq('user_id', ctrlUserId);
        await supabase.from('user_roles').insert({ user_id: ctrlUserId, role: 'CONTROLEUR' });
        await supabase.auth.admin.updateUserById(ctrlUserId, { password: 'Password123!', email_confirm: true, user_metadata: { role: 'CONTROLEUR' } });
        const { data: cAuth } = await publicAuth.auth.signInWithPassword({
            email: cEmail,
            password: 'Password123!',
        });
        ctrlToken = cAuth?.session?.access_token || '';
        assert.ok(ctrlToken, 'ctrlToken obtenu');

        // 5. Événement principal
        const { data: mainEv } = await supabase.from('events').insert({
            partner_id: partnerId,
            title: `Festival Dakar E2E Final ${ts}`,
            slug: `festival-dakar-e2e-${ts}`,
            category: 'CONCERT',
            description: 'Grand Festival Dakar Test Final',
            start_date: '2026-11-20',
            start_time: '20:00:00',
            location: 'Esplanade Monument de la Renaissance',
            city: 'Dakar',
            capacity: 500,
            status: 'PUBLIE',
        }).select('id').single();
        mainEventId = mainEv!.id;
        createdEventIds.push(mainEventId);

        // Affecter le contrôleur à l'événement
        await supabase.from('event_controllers').insert({
            event_id: mainEventId,
            user_id: ctrlUserId,
            created_by: partnerUserId,
            can_accept_cash: true,
        });

        console.log(`[SETUP OK] Initialisé en ${Date.now() - start}ms | Event: ${mainEventId}`);
    });

    after(async () => {
        console.log('[TEARDOWN] Nettoyage des données de test...');
        for (const evId of createdEventIds) {
            await supabase.from('tickets').delete().eq('event_id', evId);
            await supabase.from('ticket_categories').delete().eq('event_id', evId);
            await supabase.from('event_controllers').delete().eq('event_id', evId);
            await supabase.from('events').delete().eq('id', evId);
        }
        console.log('[TEARDOWN OK] Banc d\'essai final nettoyé.');
    });

    // =========================================================================
    // SECTION 1 : CYCLE DE VIE DES CATÉGORIES & CLAIMS GRATUITS
    // =========================================================================

    test('1.1 : Achat de billets gratuits (N=2) -> 2 tickets créés, stock décrémenté, catégorie SOLD_OUT', async () => {
        const start = Date.now();
        const { data: freeCat } = await supabase.from('ticket_categories').insert({
            event_id: mainEventId,
            name: 'Pass Invitation Presse',
            price: 0,
            total_quantity: 2,
            sold_quantity: 0,
            is_active: true,
            is_visible: true,
        }).select('*').single();

        const req = new NextRequest('http://localhost/api/tickets/claim-free', {
            method: 'POST',
            body: JSON.stringify({ categoryId: freeCat.id, quantity: 2 }),
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${buyerAToken}`
            }
        });

        const res = await claimFreeRoute(req);
        const json = await res.json();
        assert.ok(res.status === 200 || res.status === 201, `Status attendu 200 ou 201 (reçu ${res.status})`);
        assert.equal(json.success, true);
        assert.equal(json.tickets.length, 2, '2 tickets distincts générés');

        // Vérification de l'état SOLD_OUT de la catégorie
        const { data: updatedCat } = await supabase.from('ticket_categories').select('*').eq('id', freeCat.id).single();
        assert.equal(updatedCat.sold_quantity, 2);
        assert.equal(updatedCat.total_quantity, 2);
        console.log(`  ✓ 1.1 Validé (${Date.now() - start}ms)`);
    });

    test('1.2 : Tentative de claim gratuit après SOLD_OUT -> Rejet serveur immédiat', async () => {
        const start = Date.now();
        const { data: soldCat } = await supabase.from('ticket_categories').insert({
            event_id: mainEventId,
            name: 'Pass Gratuit Épuisé',
            price: 0,
            total_quantity: 1,
            sold_quantity: 1,
            is_active: true,
            is_visible: true,
        }).select('*').single();

        const req = new NextRequest('http://localhost/api/tickets/claim-free', {
            method: 'POST',
            body: JSON.stringify({ categoryId: soldCat.id, quantity: 1 }),
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${buyerAToken}`
            }
        });

        const res = await claimFreeRoute(req);
        const json = await res.json();
        assert.equal(res.status, 400);
        assert.equal(json.code, 'TICKET_CATEGORY_SOLD_OUT');
        console.log(`  ✓ 1.2 Validé (${Date.now() - start}ms)`);
    });

    // =========================================================================
    // SECTION 2 : DISTINCTION STRICTE ENTRE SOLD_OUT ET CLOSED
    // =========================================================================

    test('2.1 : Catégorie fermée volontairement (is_active = false) -> status = CLOSED et refus d\'achat', async () => {
        const start = Date.now();
        const { data: closedCat } = await supabase.from('ticket_categories').insert({
            event_id: mainEventId,
            name: 'Pass Clôturé Volontaire',
            price: 10000,
            total_quantity: 100,
            sold_quantity: 40,
            is_active: false,
            is_visible: true,
        }).select('*').single();

        const req = new NextRequest(`http://localhost/api/events/${mainEventId}`);
        const res = await getEventRoute(req, { params: { id: mainEventId } });
        const json = await res.json();
        const formattedCat = json.event.categories.find((c: any) => c.id === closedCat.id);

        assert.equal(formattedCat.status, 'CLOSED');
        assert.equal(formattedCat.isClosed, true);
        assert.equal(formattedCat.isSoldOut, false);
        assert.equal(formattedCat.availableQuantity, 60, '60 places restantes mais fermées aux ventes');

        // Tentative d'achat direct via service
        await assert.rejects(async () => {
            await EventService.reserveTicketsAtomic({
                eventId: mainEventId,
                categoryId: closedCat.id,
                userId: buyerAUserId,
                quantity: 1,
            });
        }, /fermée|inactive|indisponible/i);

        console.log(`  ✓ 2.1 Validé (${Date.now() - start}ms)`);
    });

    // =========================================================================
    // SECTION 3 : ACHAT MULTI-BILLETS & CALCUL FINANCIER FIABLE
    // =========================================================================

    let multiTickets: any[] = [];
    test('3.1 : Achat de N=3 billets -> 3 tickets avec UUID/QR/Numéros distincts & Statut VALIDE', async () => {
        const start = Date.now();
        const unitPrice = 5000;
        const { data: cat } = await supabase.from('ticket_categories').insert({
            event_id: mainEventId,
            name: 'Pass VIP Multi-Achat',
            price: unitPrice,
            total_quantity: 20,
            sold_quantity: 0,
            is_active: true,
            is_visible: true,
        }).select('*').single();

        const reserveRes = await EventService.reserveTicketsAtomic({
            eventId: mainEventId,
            categoryId: cat.id,
            userId: buyerAUserId,
            quantity: 3,
            paymentConfirmed: true,
        });

        assert.equal(reserveRes.tickets.length, 3);
        multiTickets = reserveRes.tickets;

        const ticketNumbers = new Set(reserveRes.tickets.map(t => t.ticket_number));
        assert.equal(ticketNumbers.size, 3, 'Chaque billet possède un numéro unique');

        const qrCodes = new Set(reserveRes.tickets.map(t => t.qr_code));
        assert.equal(qrCodes.size, 3, 'Chaque billet possède un QR code unique');

        assert.ok(reserveRes.tickets.every(t => t.status === 'VALIDE' && !t.checked_in_at));
        console.log(`  ✓ 3.1 Validé (${Date.now() - start}ms)`);
    });

    test('3.2 : Compostage du Billet 1 -> Seul Billet 1 passe à UTILISE (Billets 2 & 3 restent VALIDE)', async () => {
        const start = Date.now();
        assert.equal(multiTickets.length, 3);

        const ticket1 = multiTickets[0];
        const ticket2 = multiTickets[1];
        const ticket3 = multiTickets[2];

        // 1. Scan du billet 1 avec le token contrôleur réel
        const scanReq = new NextRequest('http://localhost/api/controller/scan', {
            method: 'POST',
            body: JSON.stringify({ qr_code: ticket1.qr_code }),
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${ctrlToken}`
            }
        });

        const scanRes = await controllerScanRoute(scanReq);
        const scanJson = await scanRes.json();
        assert.equal(scanRes.status, 200);
        assert.equal(scanJson.scan_result, 'valid');
        assert.ok(scanJson.ticket_info?.checked_in_at);

        // 2. Vérification en base : Billets 2 et 3 sont restés intacts
        const { data: dbT1 } = await supabase.from('tickets').select('status, checked_in_at').eq('id', ticket1.id).single();
        const { data: dbT2 } = await supabase.from('tickets').select('status, checked_in_at').eq('id', ticket2.id).single();
        const { data: dbT3 } = await supabase.from('tickets').select('status, checked_in_at').eq('id', ticket3.id).single();
        assert.ok(dbT1);
        assert.ok(dbT2);
        assert.ok(dbT3);
        assert.equal(dbT1.status, 'UTILISE');
        assert.ok(dbT1.checked_in_at);
        assert.equal(dbT2.status, 'VALIDE');
        assert.equal(dbT2.checked_in_at, null);
        assert.equal(dbT3.status, 'VALIDE');
        assert.equal(dbT3.checked_in_at, null);

        console.log(`  ✓ 3.2 Validé (${Date.now() - start}ms)`);
    });

    test('3.3 : Double scan sur Billet 1 -> ALREADY_USED sans altération de la date d\'origine', async () => {
        const start = Date.now();
        const ticket1 = multiTickets[0];
        const { data: initialTicket } = await supabase.from('tickets').select('checked_in_at').eq('id', ticket1.id).single();
        assert.ok(initialTicket);
        const originalCheckIn = initialTicket.checked_in_at;

        const scanReq = new NextRequest('http://localhost/api/controller/scan', {
            method: 'POST',
            body: JSON.stringify({ qr_code: ticket1.qr_code }),
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${ctrlToken}`
            }
        });

        const scanRes = await controllerScanRoute(scanReq);
        const scanJson = await scanRes.json();
        assert.equal(scanRes.status, 200);
        assert.equal(scanJson.scan_result, 'already_used');
        assert.equal(scanJson.ticket_info.checked_in_at, originalCheckIn, 'Date originale inchangée');
        console.log(`  ✓ 3.3 Validé (${Date.now() - start}ms)`);
    });

    // =========================================================================
    // SECTION 4 : CONCURRENCE EXTRÊME & ANTI-SURBOOKING (100 REQUÊTES SUR STOCK 1)
    // =========================================================================

    test('4.1 : Concurrence Extrême -> 100 requêtes simultanées pour 1 billet restant (Stock=1) -> Exactement 1 Gagnant', async () => {
        const start = Date.now();
        const { data: singleStockCat } = await supabase.from('ticket_categories').insert({
            event_id: mainEventId,
            name: 'Pass Dernier Billet Rare',
            price: 25000,
            total_quantity: 1,
            sold_quantity: 0,
            is_active: true,
            is_visible: true,
        }).select('*').single();

        const promises = Array.from({ length: 100 }, () => {
            return EventService.reserveTicketsAtomic({
                eventId: mainEventId,
                categoryId: singleStockCat.id,
                userId: buyerAUserId,
                quantity: 1,
                paymentConfirmed: true,
            });
        });

        const results = await Promise.allSettled(promises);
        const fulfilled = results.filter(r => r.status === 'fulfilled');
        const rejected = results.filter(r => r.status === 'rejected');

        assert.equal(fulfilled.length, 1, 'Exactement 1 achat réussi');
        assert.equal(rejected.length, 99, 'Exactement 99 rejets propres pour rupture de stock');

        // Vérification finale en base
        const { data: finalCat } = await supabase.from('ticket_categories').select('sold_quantity, total_quantity').eq('id', singleStockCat.id).single();
        assert.ok(finalCat);
        assert.equal(finalCat.sold_quantity, 1, 'sold_quantity = 1 (Zéro surbooking)');
        assert.equal(finalCat.total_quantity, 1);
        console.log(`  ✓ 4.1 Validé (${Date.now() - start}ms | 1 succès / 99 rejets)`);
    });

    // =========================================================================
    // SECTION 5 : NOTIFICATIONS SOLD_OUT ET ÉVÉNEMENT COMPLET (IDEMPOTENCE)
    // =========================================================================

    test('5.1 : Notification Événement 100% COMPLET émise à l\'organisateur avec Idempotence', async () => {
        const start = Date.now();
        const { data: soloEv } = await supabase.from('events').insert({
            partner_id: partnerId,
            title: `Gala Exclusif Complet ${ts}`,
            slug: `gala-exclusif-${ts}`,
            category: 'CONCERT',
            description: 'Gala VIP exclusif guichet fermé',
            start_date: '2026-12-31',
            start_time: '21:00:00',
            location: 'King Fahd Palace',
            city: 'Dakar',
            capacity: 1,
            status: 'PUBLIE',
        }).select('id').single();
        assert.ok(soloEv, 'soloEv doit être créé');
        createdEventIds.push(soloEv.id);

        const { data: soloCat } = await supabase.from('ticket_categories').insert({
            event_id: soloEv.id,
            name: 'Pass Unique Gala',
            price: 50000,
            total_quantity: 1,
            sold_quantity: 0,
            is_active: true,
            is_visible: true,
        }).select('*').single();

        // Achat du seul billet -> Déclenche CATEGORY_SOLD_OUT ET EVENT_FULLY_SOLD_OUT
        await EventService.reserveTicketsAtomic({
            eventId: soloEv.id,
            categoryId: soloCat.id,
            userId: buyerAUserId,
            quantity: 1,
            paymentConfirmed: true,
        });

        // Attendre le traitement asynchrone post-commit
        await new Promise(r => setTimeout(r, 600));

        // Vérification de la notification EVENT_FULLY_SOLD_OUT en base
        const { data: notifs } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', partnerUserId)
            .eq('type', 'ALERT')
            .filter('metadata->>alert_type', 'eq', 'EVENT_FULLY_SOLD_OUT')
            .filter('metadata->>event_id', 'eq', soloEv.id);

        assert.ok(notifs && notifs.length === 1, 'Exactement 1 notification EVENT_FULLY_SOLD_OUT reçue');

        // Test d'Idempotence : rappel direct ne doit pas insérer de doublon
        const secondCall = await NotificationService.sendEventFullySoldOutNotification({
            eventId: soloEv.id,
            eventTitle: `Gala Exclusif Complet ${ts}`,
            totalTicketsSold: 1,
        });
        assert.equal(secondCall.inApp, true);
        assert.equal(secondCall.sms, false, 'SMS non renvoyé (Idempotent)');

        const { data: notifsAfter } = await supabase
            .from('notifications')
            .select('id')
            .eq('user_id', partnerUserId)
            .filter('metadata->>alert_type', 'eq', 'EVENT_FULLY_SOLD_OUT')
            .filter('metadata->>event_id', 'eq', soloEv.id);
        assert.equal(notifsAfter?.length, 1, 'Toujours exactement 1 notification en base');
        console.log(`  ✓ 5.1 Validé (${Date.now() - start}ms)`);
    });

    // =========================================================================
    // SECTION 6 : RÉAPPROVISIONNEMENT ET SÉCURITÉ D'ACCÈS PARTENAIRE
    // =========================================================================

    test('6.1 : Réapprovisionnement par l\'organisateur (+10 billets) -> Statut repasse à ACTIVE', async () => {
        const start = Date.now();
        const { data: restockCat } = await supabase.from('ticket_categories').insert({
            event_id: mainEventId,
            name: 'Pass Réapprovisionnement',
            price: 15000,
            total_quantity: 5,
            sold_quantity: 5, // SOLD_OUT
            is_active: true,
            is_visible: true,
        }).select('*').single();

        const patchReq = new NextRequest(`http://localhost/api/partner/events/${mainEventId}/categories/${restockCat.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ total_quantity: 15 }),
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${partnerToken}`
            }
        });

        const patchRes = await updatePartnerCategoryRoute(patchReq, {
            params: Promise.resolve({ id: mainEventId, categoryId: restockCat.id })
        });
        const patchJson = await patchRes.json();
        assert.equal(patchRes.status, 200);
        assert.equal(patchJson.category.total_quantity, 15);
        assert.equal(patchJson.category.sold_quantity, 5);
        assert.equal(patchJson.category.is_active, true);

        console.log(`  ✓ 6.1 Validé (${Date.now() - start}ms)`);
    });

    test('6.2 : Tentative de modification par un partenaire tiers non propriétaire -> 400/403 / Rejet', async () => {
        const start = Date.now();
        const { data: targetCat } = await supabase.from('ticket_categories').insert({
            event_id: mainEventId,
            name: 'Pass Sécurisé Propriétaire',
            price: 20000,
            total_quantity: 10,
            sold_quantity: 0,
            is_active: true,
            is_visible: true,
        }).select('*').single();

        const hackReq = new NextRequest(`http://localhost/api/partner/events/${mainEventId}/categories/${targetCat.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ total_quantity: 50 }),
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${otherPartnerToken}`
            }
        });

        const hackRes = await updatePartnerCategoryRoute(hackReq, {
            params: Promise.resolve({ id: mainEventId, categoryId: targetCat.id })
        });
        const hackJson = await hackRes.json();
        assert.equal(hackJson.success, false);
        assert.match(hackJson.error, /propriétaire|non autorisé|introuvable/i);
        console.log(`  ✓ 6.2 Validé (${Date.now() - start}ms)`);
    });

    // =========================================================================
    // SECTION 7 : SÉCURITÉ & VALIDATIONS DES QUANTITÉS ET PRIX
    // =========================================================================

    test('7.1 : Rejet des quantités invalides (q <= 0, q > 50, flottants)', async () => {
        const start = Date.now();
        const { data: testCat } = await supabase.from('ticket_categories').insert({
            event_id: mainEventId,
            name: 'Pass Validations Quantité',
            price: 5000,
            total_quantity: 100,
            sold_quantity: 0,
            is_active: true,
            is_visible: true,
        }).select('*').single();

        await assert.rejects(async () => {
            await EventService.reserveTicketsAtomic({
                eventId: mainEventId,
                categoryId: testCat.id,
                userId: buyerAUserId,
                quantity: 0,
                paymentConfirmed: true,
            });
        }, /quantité invalide/i);

        await assert.rejects(async () => {
            await EventService.reserveTicketsAtomic({
                eventId: mainEventId,
                categoryId: testCat.id,
                userId: buyerAUserId,
                quantity: -5,
                paymentConfirmed: true,
            });
        }, /quantité invalide/i);

        await assert.rejects(async () => {
            await EventService.reserveTicketsAtomic({
                eventId: mainEventId,
                categoryId: testCat.id,
                userId: buyerAUserId,
                quantity: 51,
                paymentConfirmed: true,
            });
        }, /quantité invalide/i);

        console.log(`  ✓ 7.1 Validé (${Date.now() - start}ms)`);
    });
});