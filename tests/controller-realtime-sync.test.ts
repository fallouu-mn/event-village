import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Chargement des variables d'environnement
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
import { POST as scanTicket } from '../app/api/controller/scan/route';
import { GET as getAssignments } from '../app/api/controller/assignments/route';
import { DELETE as removeAllPartnerEvents } from '../app/api/partner/team/all/route';
import { DELETE as removeSingleEvent } from '../app/api/partner/team/[eventId]/route';
import { PATCH as updateAssignments } from '../app/api/partner/team/assignments/route';
import { DELETE as deleteControllerFromTeam } from '../app/api/partner/team/controller/[controllerId]/route';

describe('SYNCHRONISATION EN DIRECT & TEMPS RÉEL DU CONTRÔLEUR (TESTS A À E)', async () => {
    const supabase = getServiceRoleClient();
    const publicAuthClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const ts = Date.now().toString().slice(-6);

    let partnerUserId: string;
    let partnerId: string;
    let partnerToken: string;

    let controllerUserId: string;
    let controllerEmail: string;
    let controllerPhone: string;
    let controllerToken: string;

    let event1Id: string;
    let event2Id: string;
    let ticketEvent1: any;

    before(async () => {
        // 1. Partenaire
        partnerUserId = 'e706a7a2-502c-4396-9e91-4dc6720388f7';
        partnerId = 'a917b7ac-d542-4c2b-b5d8-ab38f866b2e7';
        const { data: pUser } = await supabase.from('users').select('email').eq('id', partnerUserId).single();
        await supabase.auth.admin.updateUserById(partnerUserId, { password: 'Password123!' });
        const { data: sP } = await publicAuthClient.auth.signInWithPassword({
            email: pUser?.email || 'partenaireA@test.com',
            password: 'Password123!',
        });
        partnerToken = sP?.session?.access_token || '';

        // 2. Contrôleur
        controllerUserId = 'fe9318ac-1f65-4e80-980f-f00626f1a003';
        controllerEmail = 'clientA_1788284499885@test.com';
        controllerPhone = `+22177${ts}99`;
        await supabase.auth.admin.updateUserById(controllerUserId, { password: 'Password123!' });
        await supabase.from('users').update({
            role: 'CONTROLEUR',
            status: 'ACTIF',
            phone: controllerPhone,
            first_name: 'Amadou',
            last_name: 'Ba',
        }).eq('id', controllerUserId);

        const { data: sC } = await publicAuthClient.auth.signInWithPassword({
            email: controllerEmail,
            password: 'Password123!',
        });
        controllerToken = sC?.session?.access_token || '';

        // 3. Événements de test
        const { data: ev1 } = await supabase.from('events').insert({
            partner_id: partnerId,
            title: `Festival Live Sync 1 ${ts}`,
            slug: `festival-live-sync-1-${ts}`,
            description: 'Test Realtime 1',
            start_date: '2026-12-15',
            start_time: '18:00:00',
            location: 'Dakar Arena',
            status: 'PUBLIE',
        }).select().single();
        event1Id = ev1.id;

        const { data: ev2 } = await supabase.from('events').insert({
            partner_id: partnerId,
            title: `Festival Live Sync 2 ${ts}`,
            slug: `festival-live-sync-2-${ts}`,
            description: 'Test Realtime 2',
            start_date: '2026-12-16',
            start_time: '19:00:00',
            location: 'Grand Théâtre',
            status: 'PUBLIE',
        }).select().single();
        event2Id = ev2.id;

        // Catégorie + Billet sur Event 1
        const { data: cat, error: catErr } = await supabase.from('ticket_categories').insert({
            event_id: event1Id,
            name: 'VIP Realtime',
            price: 15000,
            total_quantity: 100,
        }).select().single();
        if (catErr) console.error('catErr:', catErr);

        const { data: tck } = await supabase.from('tickets').insert({
            event_id: event1Id,
            category_id: cat.id,
            user_id: partnerUserId,
            ticket_number: `TCK-RT-${ts}-001`,
            qr_code: `EV-QR-RT-${ts}-001`,
            price: 15000,
            status: 'VALIDE',
        }).select().single();
        ticketEvent1 = tck;

        // Nettoyer toute assignation préexistante pour ce contrôleur
        await supabase.from('event_controllers').delete().eq('user_id', controllerUserId);
    });

    after(async () => {
        // Nettoyage complet
        if (event1Id) {
            await supabase.from('tickets').delete().eq('event_id', event1Id);
            await supabase.from('ticket_categories').delete().eq('event_id', event1Id);
            await supabase.from('event_controllers').delete().eq('event_id', event1Id);
            await supabase.from('events').delete().eq('id', event1Id);
        }
        if (event2Id) {
            await supabase.from('event_controllers').delete().eq('event_id', event2Id);
            await supabase.from('events').delete().eq('id', event2Id);
        }
        // Restaurer le contrôleur en état actif
        await supabase.from('users').update({ role: 'CONTROLEUR', status: 'ACTIF' }).eq('id', controllerUserId);
    });

    test('TEST A — AFFECTATION PAR LE PARTENAIRE → SYNCHRONISATION CONTRÔLEUR', async () => {
        // Partenaire affecte le contrôleur à Event 1
        const req = new NextRequest('http://localhost:3000/api/partner/team/assignments', {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${partnerToken}`,
            },
            body: JSON.stringify({
                controller_id: controllerUserId,
                event_ids: [event1Id],
                can_accept_cash: true,
            }),
        });

        const res = await updateAssignments(req);
        assert.equal(res.status, 200, 'Affectation Partenaire doit réussir');
        const data = await res.json();
        assert.equal(data.success, true);
        assert.equal(data.total_active, 1);

        // Côté Contrôleur : sans rechargement de page (appel immédiat de la route assignments)
        const ctrlReq = new NextRequest('http://localhost:3000/api/controller/assignments', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${controllerToken}` },
        });
        const ctrlRes = await getAssignments(ctrlReq);
        assert.equal(ctrlRes.status, 200);
        const ctrlData = await ctrlRes.json();
        assert.equal(ctrlData.success, true);
        assert.equal(ctrlData.assignments.length, 1, 'Le contrôleur doit voir 1 événement sans F5');
        assert.equal(ctrlData.assignments[0].events.id, event1Id, 'L\'événement assigné doit être Festival 1');
        assert.equal(ctrlData.assignments[0].can_accept_cash, true);
    });

    test('TEST B — RETRAIT D\'UN ÉVÉNEMENT → SYNCHRONISATION CONTRÔLEUR', async () => {
        // Partenaire affecte d\'abord à Event 1 ET Event 2
        const patchReq = new NextRequest('http://localhost:3000/api/partner/team/assignments', {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${partnerToken}`,
            },
            body: JSON.stringify({
                controller_id: controllerUserId,
                event_ids: [event1Id, event2Id],
                can_accept_cash: false,
            }),
        });
        const patchRes = await updateAssignments(patchReq);
        assert.equal(patchRes.status, 200);

        // Récupérer l\'assignation d\'Event 1
        const { data: assign1 } = await supabase
            .from('event_controllers')
            .select('id')
            .eq('event_id', event1Id)
            .eq('user_id', controllerUserId)
            .single();
        assert.ok(assign1?.id, 'Assignation 1 doit exister');

        // Partenaire retire le contrôleur d\'Event 1 (Action D)
        const delReq = new NextRequest(`http://localhost:3000/api/partner/team/${event1Id}?assignmentId=${assign1.id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${partnerToken}` },
        });
        const delRes = await removeSingleEvent(delReq, { params: Promise.resolve({ eventId: event1Id }) });
        assert.equal(delRes.status, 200);
        const delData = await delRes.json();
        assert.equal(delData.success, true);

        // Côté Contrôleur : sans rechargement, seule l\'affectation Event 2 subsiste
        const ctrlReq = new NextRequest('http://localhost:3000/api/controller/assignments', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${controllerToken}` },
        });
        const ctrlRes = await getAssignments(ctrlReq);
        const ctrlData = await ctrlRes.json();
        assert.equal(ctrlData.success, true);
        assert.equal(ctrlData.assignments.length, 1, 'Seul 1 événement doit rester');
        assert.equal(ctrlData.assignments[0].events.id, event2Id, 'L\'événement restant doit être Event 2');
    });

    test('TEST C — SCAN D\'UN TICKET → MISE À JOUR TEMPS RÉEL DES STATS', async () => {
        // Réassigner Event 1 pour le test de scan
        await updateAssignments(new NextRequest('http://localhost:3000/api/partner/team/assignments', {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${partnerToken}`,
            },
            body: JSON.stringify({
                controller_id: controllerUserId,
                event_ids: [event1Id],
                can_accept_cash: true,
            }),
        }));

        // État initial des stats côté contrôleur
        const preReq = new NextRequest('http://localhost:3000/api/controller/assignments', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${controllerToken}` },
        });
        const preRes = await getAssignments(preReq);
        const preData = await preRes.json();
        const initialScanned = preData.assignments[0].stats.scanned_today;

        // Le contrôleur scanne le billet valide
        const scanReq = new NextRequest('http://localhost:3000/api/controller/scan', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${controllerToken}`,
            },
            body: JSON.stringify({ qr_code: ticketEvent1.qr_code }),
        });
        const scanRes = await scanTicket(scanReq);
        assert.equal(scanRes.status, 200);
        const scanData = await scanRes.json();

        assert.equal(scanData.scan_result, 'valid', 'Le billet doit être validé avec succès');
        assert.ok(scanData.stats, 'Les stats doivent être retournées immédiatement par l\'API');
        assert.equal(scanData.stats.scanned_today, initialScanned + 1, 'Le compteur du jour doit s\'incrémenter immédiatement de 1');

        // Vérification directe de persistance et broadcast
        const postReq = new NextRequest('http://localhost:3000/api/controller/assignments', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${controllerToken}` },
        });
        const postRes = await getAssignments(postReq);
        const postData = await postRes.json();
        assert.equal(postData.assignments[0].stats.scanned_today, initialScanned + 1, 'La persistance du compteur en base est confirmée');
    });

    test('TEST D — RETRAIT DE TOUS LES ÉVÉNEMENTS → ÉTAT VIDE IMMÉDIAT', async () => {
        // Partenaire retire le contrôleur de TOUS les événements (Action E)
        const delAllReq = new NextRequest(`http://localhost:3000/api/partner/team/all?controllerId=${controllerUserId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${partnerToken}` },
        });
        const delAllRes = await removeAllPartnerEvents(delAllReq);
        assert.equal(delAllRes.status, 200);
        const delAllData = await delAllRes.json();
        assert.equal(delAllData.success, true);

        // Côté Contrôleur : sans rechargement, la liste devient vide (déclencheur UI de l\'état vide)
        const ctrlReq = new NextRequest('http://localhost:3000/api/controller/assignments', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${controllerToken}` },
        });
        const ctrlRes = await getAssignments(ctrlReq);
        const ctrlData = await ctrlRes.json();
        assert.equal(ctrlData.success, true);
        assert.equal(ctrlData.assignments.length, 0, 'La liste d\'assignations doit être exactement vide (longueur 0)');
        // Le compte reste présent et valide
        const { data: userRow } = await supabase.from('users').select('role, status').eq('id', controllerUserId).single();
        assert.equal(userRow?.role, 'CONTROLEUR');
        assert.equal(userRow?.status, 'ACTIF');
    });

    test('TEST E — DÉSACTIVATION COMPTE → INVALIDATION SESSION ET EXPULSION', async () => {
        // Partenaire supprime et désactive complètement le contrôleur (Action F)
        const delCtrlReq = new NextRequest(`http://localhost:3000/api/partner/team/controller/${controllerUserId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${partnerToken}` },
        });
        const delCtrlRes = await deleteControllerFromTeam(delCtrlReq, { params: { controllerId: controllerUserId } });
        assert.equal(delCtrlRes.status, 200);
        const delCtrlData = await delCtrlRes.json();
        assert.equal(delCtrlData.success, true);

        // 1. Vérification en base : statut SUSPENDU et rôle rétrogradé
        const { data: userRow } = await supabase.from('users').select('role, status').eq('id', controllerUserId).single();
        assert.equal(userRow?.status, 'SUSPENDU', 'Le contrôleur doit avoir status=SUSPENDU en base');
        assert.equal(userRow?.role, 'CLIENT', 'Le contrôleur ne doit plus avoir le rôle CONTROLEUR');

        // 2. Vérification que l\'accès API contrôleur est désormais strictement refusé (HTTP 403)
        const scanBlockedReq = new NextRequest('http://localhost:3000/api/controller/scan', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${controllerToken}`,
            },
            body: JSON.stringify({ qr_code: 'DUMMY' }),
        });
        const scanBlockedRes = await scanTicket(scanBlockedReq);
        assert.equal(scanBlockedRes.status, 403, 'Le contrôleur désactivé doit recevoir 403 Forbidden sur /scan');

        const assignBlockedReq = new NextRequest('http://localhost:3000/api/controller/assignments', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${controllerToken}` },
        });
        const assignBlockedRes = await getAssignments(assignBlockedReq);
        assert.equal(assignBlockedRes.status, 403, 'Le contrôleur désactivé doit recevoir 403 Forbidden sur /assignments');
    });
});
