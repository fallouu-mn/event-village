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
import { ShiftService } from '../lib/shifts/shift.service';
import { POST as openShiftRoute } from '../app/api/controller/shifts/open/route';
import { POST as closeShiftRoute } from '../app/api/controller/shifts/close/route';
import { GET as getActiveShiftRoute } from '../app/api/controller/shifts/active/route';
import { POST as generatePinRoute } from '../app/api/partner/events/[id]/regisseur-pin/route';
import { POST as controllerScanRoute, PUT as controllerCashConfirmRoute } from '../app/api/controller/scan/route';
import { DELETE as removeControllerRoute } from '../app/api/partner/team/controller/[controllerId]/route';

describe('MODULE "Z DE CAISSE" & FENÊTRE DE SHIFT CONTRÔLEUR (PRE-MORTEM §2.1 & §4.2)', async () => {
    const supabase = getServiceRoleClient();
    const publicAuth = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const ts = Date.now().toString().slice(-6);

    const partnerUserId = 'e706a7a2-502c-4396-9e91-4dc6720388f7';
    const partnerId = 'a917b7ac-d542-4c2b-b5d8-ab38f866b2e7';
    const ctrlUserId = 'fe9318ac-1f65-4e80-980f-f00626f1a003';
    const clientUserId = 'a7345050-03cf-4967-9281-9ee5eb75615a';

    let partnerToken: string;
    let ctrlToken: string;
    let clientToken: string;

    let activeEventId: string;
    let futureEventId: string;
    let regisseurPin: string;
    let catId: string;

    const createdEventIds: string[] = [];
    const createdTicketIds: string[] = [];
    const createdOrderIds: string[] = [];

    before(async () => {
        // 1. Obtenir les tokens d'accès
        const { data: pUser } = await supabase.from('users').select('email').eq('id', partnerUserId).single();
        await supabase.auth.admin.updateUserById(partnerUserId, { password: 'Password123!' });

        // S'assurer que le partenaire a le rôle PARTENAIRE
        await supabase.from('user_roles').upsert({
            user_id: partnerUserId,
            role: 'PARTENAIRE'
        }, { onConflict: 'user_id,role' });

        const { data: pAuth } = await publicAuth.auth.signInWithPassword({
            email: pUser?.email || 'partenaireA@test.com',
            password: 'Password123!',
        });
        partnerToken = pAuth?.session?.access_token!;
        assert.ok(partnerToken, 'Token Partenaire obtenu');

        const { data: cUser } = await supabase.from('users').select('email').eq('id', ctrlUserId).single();
        await supabase.auth.admin.updateUserById(ctrlUserId, { password: 'Password123!' });

        // S'assurer que le contrôleur a le statut ACTIF et rôle CONTROLEUR
        await supabase.from('users').update({ role: 'CONTROLEUR', status: 'ACTIF' }).eq('id', ctrlUserId);
        await supabase.from('user_roles').upsert({
            user_id: ctrlUserId,
            role: 'CONTROLEUR'
        }, { onConflict: 'user_id,role' });

        // Re-login to get fresh session with updated role
        const { data: cAuthFresh } = await publicAuth.auth.signInWithPassword({
            email: cUser?.email!,
            password: 'Password123!',
        });
        ctrlToken = cAuthFresh?.session?.access_token!;
        assert.ok(ctrlToken, 'Token Contrôleur obtenu (après mise à jour du rôle)');

        const { data: clUser } = await supabase.from('users').select('email').eq('id', clientUserId).single();
        await supabase.auth.admin.updateUserById(clientUserId, { password: 'Password123!' });
        const { data: clAuth } = await publicAuth.auth.signInWithPassword({
            email: clUser?.email!,
            password: 'Password123!',
        });
        clientToken = clAuth?.session?.access_token!;
        assert.ok(clientToken, 'Token Client obtenu');

        // 2. Créer un événement actif (fenêtre horaire en cours : aujourd'hui)
        const todayStr = new Date().toISOString().split('T')[0];
        const { data: activeEvent, error: evErr } = await supabase.from('events').insert({
            partner_id: partnerId,
            title: `Festival Caisse & Shift ${ts}`,
            slug: `festival-caisse-shift-${ts}`,
            start_date: todayStr,
            start_time: '00:00:00',
            end_date: todayStr,
            end_time: '23:59:59',
            location: 'Esplanade du Village',
            status: 'PUBLIE',
        }).select().single();

        if (evErr || !activeEvent) throw new Error(`Échec création activeEvent: ${evErr?.message}`);
        activeEventId = activeEvent.id;
        createdEventIds.push(activeEventId);

        // 3. Créer un événement dans le futur lointain (pour le test hors fenêtre horaire)
        const { data: futureEvent, error: futErr } = await supabase.from('events').insert({
            partner_id: partnerId,
            title: `Concert Futur Lointain ${ts}`,
            slug: `concert-futur-lointain-${ts}`,
            start_date: '2028-12-31',
            start_time: '20:00:00',
            end_date: '2028-12-31',
            end_time: '23:00:00',
            location: 'Grand Théâtre',
            status: 'PUBLIE',
        }).select().single();

        if (futErr || !futureEvent) throw new Error(`Échec création futureEvent: ${futErr?.message}`);
        futureEventId = futureEvent.id;
        createdEventIds.push(futureEventId);

        // 4. Créer une catégorie de billets
        const { data: cat, error: catErr } = await supabase.from('ticket_categories').insert({
            event_id: activeEventId,
            name: `Standard Cash ${ts}`,
            price: 10000,
            total_quantity: 100,
        }).select().single();
        if (catErr) throw new Error(`Erreur creation categorie: ${catErr.message}`);
        catId = cat.id;

        // 5. Affecter le contrôleur à l'événement actif avec can_accept_cash = true
        await supabase.from('event_controllers').delete().eq('user_id', ctrlUserId);
        await supabase.from('event_controllers').insert([
            {
                event_id: activeEventId,
                user_id: ctrlUserId,
                can_accept_cash: true,
                created_by: partnerUserId,
            },
            {
                event_id: futureEventId,
                user_id: ctrlUserId,
                can_accept_cash: true,
                created_by: partnerUserId,
            },
        ]);

        // Nettoyer les shifts résiduels
        ShiftService._clearMemory();
    });

    after(async () => {
        // Nettoyage en cascade
        ShiftService._clearMemory();
        if (createdTicketIds.length > 0) {
            await supabase.from('tickets').delete().in('id', createdTicketIds);
        }
        if (createdOrderIds.length > 0) {
            await supabase.from('orders').delete().in('id', createdOrderIds);
        }
        if (createdEventIds.length > 0) {
            await supabase.from('event_controllers').delete().in('event_id', createdEventIds);
            await supabase.from('ticket_categories').delete().in('event_id', createdEventIds);
            await supabase.from('events').delete().in('id', createdEventIds);
        }
        // Also clean up controller_shifts to prevent test interference
        if (createdEventIds.length > 0) {
            await supabase.from('controller_shifts').delete().in('event_id', createdEventIds);
        }
    });

    // ──────────────────────────────────────────────────────────
    // TEST 1 : OUVERTURE DE SHIFT AVEC PIN VALIDE DANS LA FENÊTRE HORAIRE
    // ──────────────────────────────────────────────────────────
    await test('1. Ouverture de shift avec PIN valide dans la fenêtre horaire → succès & fond de caisse exact', async () => {
        // 1.1 Le Partenaire génère le PIN régisseur
        const pinReq = new NextRequest(`http://localhost:3000/api/partner/events/${activeEventId}/regisseur-pin`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${partnerToken}` },
        });
        const pinRes = await generatePinRoute(pinReq, { params: Promise.resolve({ id: activeEventId }) });
        assert.equal(pinRes.status, 200, 'Génération du code PIN régisseur réussie');
        const pinData = await pinRes.json();
        assert.ok(pinData.pin, 'PIN en clair renvoyé au partenaire');
        regisseurPin = pinData.pin;

        // 1.2 Le Contrôleur ouvre sa session de caisse avec fond de caisse de 50 000 FCFA
        const openReq = new NextRequest('http://localhost:3000/api/controller/shifts/open', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${ctrlToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                event_id: activeEventId,
                opening_float_amount: 50000,
                regisseur_pin: regisseurPin,
            }),
        });
        const openRes = await openShiftRoute(openReq);
        assert.equal(openRes.status, 200, 'Ouverture de shift acceptée');
        const openData = await openRes.json();

        assert.equal(openData.success, true);
        assert.equal(openData.shift.status, 'OUVERT', 'Le statut du shift est OUVERT');
        assert.equal(openData.shift.opening_float_amount, 50000, 'Fond de caisse initial conforme');
        assert.equal(openData.shift.expected_cash_total, 0, 'Encaissements attendus initialisés à 0');
    });

    // ──────────────────────────────────────────────────────────
    // TEST 2 : OUVERTURE HORS FENÊTRE HORAIRE
    // ──────────────────────────────────────────────────────────
    await test('2. Ouverture hors fenêtre horaire → rejetée avec message explicite', async () => {
        // Générer le PIN pour l'événement futur
        const pinReq = new NextRequest(`http://localhost:3000/api/partner/events/${futureEventId}/regisseur-pin`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${partnerToken}` },
        });
        const pinRes = await generatePinRoute(pinReq, { params: Promise.resolve({ id: futureEventId }) });
        const pinData = await pinRes.json();
        const futurePin = pinData.pin;

        // Tentative d'ouverture de shift pour un événement en 2028
        const openReq = new NextRequest('http://localhost:3000/api/controller/shifts/open', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${ctrlToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                event_id: futureEventId,
                opening_float_amount: 20000,
                regisseur_pin: futurePin,
            }),
        });
        const openRes = await openShiftRoute(openReq);
        assert.equal(openRes.status, 400, 'Rejeté avec statut 400');
        const openData = await openRes.json();
        assert.match(openData.error, /fenêtre horaire|ne peut être ouvert/i, 'Message d\'erreur explicite sur la fenêtre horaire');
    });

    // ──────────────────────────────────────────────────────────
    // TEST 3 : OUVERTURE AVEC PIN INVALIDE
    // ──────────────────────────────────────────────────────────
    await test('3. Ouverture avec PIN invalide → rejetée 401 & tentative journalisée', async () => {
        const openReq = new NextRequest('http://localhost:3000/api/controller/shifts/open', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${ctrlToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                event_id: activeEventId,
                opening_float_amount: 10000,
                regisseur_pin: '000000', // Code erroné
            }),
        });
        const openRes = await openShiftRoute(openReq);
        assert.equal(openRes.status, 401, 'Rejeté avec statut 401');
        const openData = await openRes.json();
        assert.match(openData.error, /incorrect|invalide/i, 'Message explicite PIN invalide');
    });

    // ──────────────────────────────────────────────────────────
    // TEST 4 : ENCAISSEMENT CASH PENDANT UN SHIFT OUVERT (CUMUL EXACT)
    // ──────────────────────────────────────────────────────────
    await test('4. Encaissement cash pendant shift ouvert → expected_cash_total s\'incrémente atomiquement', async () => {
        // Récupérer le shift actif ouvert au Test 1
        const activeShift = await ShiftService.getActiveShift(ctrlUserId, activeEventId);
        assert.ok(activeShift, 'Shift actif trouvé');
        assert.equal(activeShift.status, 'OUVERT');
        const initialExpected = Number(activeShift.expected_cash_total);

        // 4.1 Premier billet cash (10 000 FCFA)
        const order1Id = crypto.randomUUID();
        createdOrderIds.push(order1Id);
        const { error: ord1Err } = await supabase.from('orders').insert({
            id: order1Id,
            order_number: `CMD-CASH1-${ts}-${Date.now()}`,
            client_id: clientUserId,
            partner_id: partnerId,
            subtotal: 10000,
            total_amount: 10000,
            delivery_mode: 'SUR_PLACE',
            payment_status: 'PENDING',
            order_status: 'EN_ATTENTE',
        });
        if (ord1Err) throw new Error(`Erreur creation order 1: ${ord1Err.message}`);

        const { data: ticket1, error: tck1Err } = await supabase.from('tickets').insert({
            event_id: activeEventId,
            category_id: catId,
            user_id: clientUserId,
            order_id: order1Id,
            ticket_number: `TCK-CASH1-${ts}`,
            qr_code: `EV-CASH1-${ts}`,
            price: 10000,
            status: 'VALIDE',
        }).select().single();
        if (tck1Err || !ticket1) throw new Error(`Erreur creation ticket 1: ${tck1Err?.message}`);
        createdTicketIds.push(ticket1.id);

        const putReq1 = new NextRequest('http://localhost:3000/api/controller/scan', {
            method: 'PUT',
            headers: {
                Authorization: `Bearer ${ctrlToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ ticket_id: ticket1.id, order_id: order1Id }),
        });
        const putRes1 = await controllerCashConfirmRoute(putReq1);
        assert.equal(putRes1.status, 200, 'Premier encaissement cash validé');

        // 4.2 Deuxième billet cash (10 000 FCFA)
        const order2Id = crypto.randomUUID();
        createdOrderIds.push(order2Id);
        const { error: ord2Err } = await supabase.from('orders').insert({
            id: order2Id,
            order_number: `CMD-CASH2-${ts}-${Date.now()}`,
            client_id: clientUserId,
            partner_id: partnerId,
            subtotal: 10000,
            total_amount: 10000,
            delivery_mode: 'SUR_PLACE',
            payment_status: 'PENDING',
            order_status: 'EN_ATTENTE',
        });
        if (ord2Err) throw new Error(`Erreur creation order 2: ${ord2Err.message}`);

        const { data: ticket2, error: tck2Err } = await supabase.from('tickets').insert({
            event_id: activeEventId,
            category_id: catId,
            user_id: clientUserId,
            order_id: order2Id,
            ticket_number: `TCK-CASH2-${ts}`,
            qr_code: `EV-CASH2-${ts}`,
            price: 10000,
            status: 'VALIDE',
        }).select().single();
        if (tck2Err || !ticket2) throw new Error(`Erreur creation ticket 2: ${tck2Err?.message}`);
        createdTicketIds.push(ticket2.id);

        const putReq2 = new NextRequest('http://localhost:3000/api/controller/scan', {
            method: 'PUT',
            headers: {
                Authorization: `Bearer ${ctrlToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ ticket_id: ticket2.id, order_id: order2Id }),
        });
        const putRes2 = await controllerCashConfirmRoute(putReq2);
        assert.equal(putRes2.status, 200, 'Deuxième encaissement cash validé');

        // Vérification de l'incrémentation exacte : initial (0) + 10 000 + 10 000 = 20 000 FCFA
        const updatedShift = await ShiftService.getActiveShift(ctrlUserId, activeEventId);
        assert.ok(updatedShift);
        assert.equal(Number(updatedShift.expected_cash_total), initialExpected + 20000, 'Total attendu cumulé exact (20 000 FCFA)');
    });

    // ──────────────────────────────────────────────────────────
    // TEST 5 : CLÔTURE SANS ÉCART
    // ──────────────────────────────────────────────────────────
    await test('5. Clôture sans écart → succès direct & statut CLOTURE', async () => {
        const shift = await ShiftService.getActiveShift(ctrlUserId, activeEventId);
        assert.ok(shift, 'Shift à clôturer trouvé');
        const expected = Number(shift.expected_cash_total); // 20 000 FCFA

        // Clôture avec montant déclaré = montant attendu
        const closeReq = new NextRequest('http://localhost:3000/api/controller/shifts/close', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${ctrlToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                shift_id: shift.id,
                declared_cash_total: expected,
                regisseur_pin: regisseurPin,
            }),
        });
        const closeRes = await closeShiftRoute(closeReq);
        assert.equal(closeRes.status, 200, 'Clôture acceptée');
        const closeData = await closeRes.json();

        assert.equal(closeData.shift.status, 'CLOTURE', 'Statut passé à CLOTURE');
        assert.equal(closeData.shift.discrepancy_amount, 0, 'Écart nul');
        assert.ok(closeData.summary, 'Résumé Z de caisse généré');
        assert.equal(closeData.summary.declared_cash_total, expected);
    });

    // ──────────────────────────────────────────────────────────
    // TEST 6 : CLÔTURE AVEC ÉCART SANS JUSTIFICATION FOURNIE
    // ──────────────────────────────────────────────────────────
    await test('6. Clôture AVEC écart sans justification fournie → rejetée 400', async () => {
        // Ouvrir une nouvelle session de caisse
        const openShift = await ShiftService.openShift(ctrlUserId, {
            eventId: activeEventId,
            openingFloatAmount: 10000,
            regisseurPin: regisseurPin,
        });
        assert.equal(openShift.status, 'OUVERT');

        // Enregistrer un encaissement de 10 000 F
        await ShiftService.recordCashPayment(openShift.id, 10000);

        // Tentative de clôture avec un déficit de 3 000 F (déclaré 7 000 au lieu de 10 000) SANS justification
        const closeReq = new NextRequest('http://localhost:3000/api/controller/shifts/close', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${ctrlToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                shift_id: openShift.id,
                declared_cash_total: 7000, // Écart = -3000
                discrepancy_justification: '', // Justification vide
                regisseur_pin: regisseurPin,
            }),
        });
        const closeRes = await closeShiftRoute(closeReq);
        assert.equal(closeRes.status, 400, 'Rejetée avec statut 400');
        const closeData = await closeRes.json();
        assert.match(closeData.error, /justification est obligatoire/i, 'Message imposant la justification');
    });

    // ──────────────────────────────────────────────────────────
    // TEST 7 : CLÔTURE AVEC ÉCART + JUSTIFICATION + PIN
    // ──────────────────────────────────────────────────────────
    await test('7. Clôture avec écart + justification + PIN → succès, écart enregistré & alerte notifiée', async () => {
        const shift = await ShiftService.getActiveShift(ctrlUserId, activeEventId);
        assert.ok(shift, 'Shift ouvert trouvé');

        const justification = 'Rendu de monnaie manquant pour client pressé au guichet 2.';
        const closeReq = new NextRequest('http://localhost:3000/api/controller/shifts/close', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${ctrlToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                shift_id: shift.id,
                declared_cash_total: 7000, // Attendu: 10000, écart: -3000
                discrepancy_justification: justification,
                regisseur_pin: regisseurPin,
            }),
        });
        const closeRes = await closeShiftRoute(closeReq);
        assert.equal(closeRes.status, 200, 'Clôture acceptée avec justification');
        const closeData = await closeRes.json();

        assert.equal(closeData.shift.status, 'CLOTURE');
        assert.equal(closeData.shift.discrepancy_amount, -3000, 'Écart de -3000 F enregistré');
        assert.equal(closeData.shift.discrepancy_justification, justification, 'Justification enregistrée');

        // Vérification de la notification déclenchée en base pour le partenaire
        const { data: notifications } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', partnerUserId)
            .order('created_at', { ascending: false })
            .limit(1);

        assert.ok(notifications && notifications.length > 0, 'Notification générée en base');
        assert.match(notifications[0].title, /Écart de caisse/i, 'Titre de notification sur l\'écart');
    });

    // ──────────────────────────────────────────────────────────
    // TEST 8 : TENTATIVE DE RETRAIT D'AFFECTATION D'UN CONTRÔLEUR AVEC SHIFT OUVERT
    // ──────────────────────────────────────────────────────────
    await test('8. Retrait d\'affectation avec shift encore OUVERT → bloqué 400', async () => {
        // Ouvrir un nouveau shift
        const openShift = await ShiftService.openShift(ctrlUserId, {
            eventId: activeEventId,
            openingFloatAmount: 15000,
            regisseurPin: regisseurPin,
        });
        assert.equal(openShift.status, 'OUVERT');

        // Le Partenaire tente de supprimer le contrôleur alors que sa session est ouverte
        const delReq = new NextRequest(`http://localhost:3000/api/partner/team/controller/${ctrlUserId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${partnerToken}` },
        });
        const delRes = await removeControllerRoute(delReq, { params: Promise.resolve({ controllerId: ctrlUserId }) });
        assert.equal(delRes.status, 400, 'Suppression bloquée avec statut 400');
        const delData = await delRes.json();
        assert.equal(delData.code, 'OPEN_SHIFT_EXISTS', 'Code d\'erreur OPEN_SHIFT_EXISTS');
        assert.match(delData.error, /session de caisse ouverte/i, 'Message explicite de session ouverte');

        // Clôturer le shift pour débloquer
        await ShiftService.closeShift(ctrlUserId, {
            shiftId: openShift.id,
            declaredCashTotal: 0,
            regisseurPin: regisseurPin,
        });
    });

    // ──────────────────────────────────────────────────────────
    // TEST 9 : NON-RÉGRESSION SCAN EN LIGNE (SANS SHIFT OUVERT)
    // ──────────────────────────────────────────────────────────
    await test('9. Non-régression : scan de billet déjà payé en ligne fonctionne SANS shift ouvert', async () => {
        // Vérifier qu'aucun shift n'est ouvert pour ce contrôleur
        const openShift = await ShiftService.getActiveShift(ctrlUserId, activeEventId);
        assert.equal(openShift, null, 'Aucun shift ouvert');

        // Billet acheté et payé en ligne (payment_status = SUCCESS)
        const orderId = crypto.randomUUID();
        createdOrderIds.push(orderId);
        const { error: ordErr } = await supabase.from('orders').insert({
            id: orderId,
            order_number: `CMD-ONLINE-${ts}-${Date.now()}`,
            client_id: clientUserId,
            partner_id: partnerId,
            subtotal: 10000,
            total_amount: 10000,
            delivery_mode: 'SUR_PLACE',
            payment_status: 'SUCCESS',
            order_status: 'CONFIRMEE',
        });
        if (ordErr) throw new Error(`Erreur creation order online: ${ordErr.message}`);

        const { data: onlineTicket, error: tckErr } = await supabase.from('tickets').insert({
            event_id: activeEventId,
            category_id: catId,
            user_id: clientUserId,
            order_id: orderId,
            ticket_number: `TCK-ONLINE-${ts}`,
            qr_code: `EV-ONLINE-${ts}`,
            price: 10000,
            status: 'VALIDE',
        }).select().single();
        if (tckErr || !onlineTicket) throw new Error(`Erreur creation ticket online: ${tckErr?.message}`);
        createdTicketIds.push(onlineTicket.id);

        // Scan normal par le contrôleur (POST /api/controller/scan)
        const scanReq = new NextRequest('http://localhost:3000/api/controller/scan', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${ctrlToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ qr_code: onlineTicket.qr_code }),
        });
        const scanRes = await controllerScanRoute(scanReq);
        assert.equal(scanRes.status, 200, 'Scan de billet prépayé accepté sans shift');
        const scanData = await scanRes.json();
        assert.equal(scanData.scan_result, 'valid', 'Compostage valide et autorisé');

        // Vérification en base que le billet est bien UTILISE
        const { data: dbTicket } = await supabase.from('tickets').select('status').eq('id', onlineTicket.id).single();
        assert.equal(dbTicket?.status, 'UTILISE', 'Billet composté atomiquement en base');
    });
});
