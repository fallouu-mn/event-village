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
import { ShiftService } from '../../lib/shifts/shift.service';
import { POST as openShiftRoute } from '../../app/api/controller/shifts/open/route';
import { POST as closeShiftRoute } from '../../app/api/controller/shifts/close/route';
import { GET as getActiveShiftRoute } from '../../app/api/controller/shifts/active/route';
import { POST as generatePinRoute } from '../../app/api/partner/events/[id]/regisseur-pin/route';
import { DELETE as removeControllerRoute } from '../../app/api/partner/team/controller/[controllerId]/route';

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
        await supabase.auth.admin.updateUserById(partnerUserId, { password: process.env.LEGACY_TEST_PASSWORD! });

        // S'assurer que le partenaire a le rôle PARTENAIRE
        await supabase.from('user_roles').upsert({
            user_id: partnerUserId,
            role: 'PARTENAIRE'
        }, { onConflict: 'user_id,role' });

        const { data: pAuth } = await publicAuth.auth.signInWithPassword({
            email: pUser?.email || 'partenaireA@test.com',
            password: process.env.LEGACY_TEST_PASSWORD!,
        });
        partnerToken = pAuth?.session?.access_token!;
        assert.ok(partnerToken, 'Token Partenaire obtenu');

        const { data: cUser } = await supabase.from('users').select('email').eq('id', ctrlUserId).single();
        await supabase.auth.admin.updateUserById(ctrlUserId, { password: process.env.LEGACY_TEST_PASSWORD! });

        // S'assurer que le contrôleur a le statut ACTIF et rôle CONTROLEUR
        await supabase.from('users').update({ role: 'CONTROLEUR', status: 'ACTIF' }).eq('id', ctrlUserId);
        await supabase.from('user_roles').upsert({
            user_id: ctrlUserId,
            role: 'CONTROLEUR'
        }, { onConflict: 'user_id,role' });

        // Re-login to get fresh session with updated role
        const { data: cAuthFresh } = await publicAuth.auth.signInWithPassword({
            email: cUser?.email!,
            password: process.env.LEGACY_TEST_PASSWORD!,
        });
        ctrlToken = cAuthFresh?.session?.access_token!;
        assert.ok(ctrlToken, 'Token Contrôleur obtenu (après mise à jour du rôle)');

        const { data: clUser } = await supabase.from('users').select('email').eq('id', clientUserId).single();
        await supabase.auth.admin.updateUserById(clientUserId, { password: process.env.LEGACY_TEST_PASSWORD! });
        const { data: clAuth } = await publicAuth.auth.signInWithPassword({
            email: clUser?.email!,
            password: process.env.LEGACY_TEST_PASSWORD!,
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
        // [lot 4] ShiftService._clearMemory() supprimé : plus de repli en mémoire, les caisses ne vivent qu'en base
        // (controller_shifts, nettoyées dans after()).
    });

    after(async () => {
        // Nettoyage en cascade
        // [lot 4] ShiftService._clearMemory() supprimé (voir before()).
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

    // [lot 4 — cas supprimé] 4. Encaissement cash pendant shift ouvert : PUT /api/controller/scan { ticket_id, order_id } (encaissement direct, sans scan préalable) retiré ; l'encaissement part d'un scan cash_required du même scanneur ({ scanId, eventId } → RPC ticket_cash_checkin) ; couvert par tests/parcours/acces-encaissement.test.ts

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

    // [lot 4 — cas supprimé] 6. Clôture AVEC écart sans justification fournie : ShiftService.recordCashPayment supprimé (le total attendu n'est incrémenté que par ticket_cash_checkin et counter_sale) ; incrément couvert par tests/parcours/acces-encaissement.test.ts et tests/parcours/acces-guichet.test.ts ; non couvert : refus de clôture sans justification (JUSTIFICATION_REQUIRED)
    // [lot 4 — cas supprimé] 7. Clôture avec écart + justification + PIN : clôturait la caisse ouverte par le cas 6 (supprimé) avec l'écart produit par recordCashPayment ; non couvert : aucune suite active ne clôture une caisse par /api/controller/shifts/close (écart, justification, alerte au partenaire)

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

    // [lot 4 — cas supprimé] 9. Non-régression : scan de billet déjà payé en ligne SANS shift ouvert : corps { qr_code } et champ scan_result du scan retirés (contrat { eventId, payload } → { result }, identifiant nu refusé) ; couvert par tests/parcours/acces-scan.test.ts
});
