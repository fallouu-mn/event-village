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
import { POST as inviteController } from '../app/api/partner/team/invite/route';
import { GET as getTeamAll, DELETE as removeAllPartnerEvents } from '../app/api/partner/team/all/route';
import { DELETE as removeSingleEvent } from '../app/api/partner/team/[eventId]/route';
import { PATCH as updateAssignments } from '../app/api/partner/team/assignments/route';
import { DELETE as deleteControllerFromTeam } from '../app/api/partner/team/controller/[controllerId]/route';
import { GET as getPartnerFinance } from '../app/api/partner/finance/route';

describe('CYCLE DE VIE DU CONTRÔLEUR — SUITE DE VALIDATION 14 POINTS (§CDC V3.0)', async () => {
    const supabase = getServiceRoleClient();
    const publicAuthClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const ts = Date.now().toString().slice(-6);

    // Identifiants de test
    let partnerAUserId: string;
    let partnerAId: string;
    let partnerAToken: string;

    let partnerBUserId: string;
    let partnerBId: string;
    let partnerBToken: string;

    let controllerXUserId: string;
    let controllerXEmail: string;
    let controllerXPhone: string;
    let controllerXToken: string;

    let controllerYUserId: string;
    let controllerYEmail: string;
    let controllerYToken: string;

    let eventAId: string;
    let eventBId: string;
    let eventCId: string;
    let eventPartnerBId: string;

    let ticketEventA: any;
    let ticketPartnerB: any;

    before(async () => {
        // 1. Récupération ou initialisation Partenaire A
        partnerAUserId = 'e706a7a2-502c-4396-9e91-4dc6720388f7';
        partnerAId = 'a917b7ac-d542-4c2b-b5d8-ab38f866b2e7';
        const { data: pAUser } = await supabase.from('users').select('email').eq('id', partnerAUserId).single();
        await supabase.auth.admin.updateUserById(partnerAUserId, { password: 'Password123!' });
        const { data: sA } = await publicAuthClient.auth.signInWithPassword({
            email: pAUser?.email || 'partenaireA@test.com',
            password: 'Password123!',
        });
        partnerAToken = sA?.session?.access_token || '';

        // 2. Partenaire B (pour l'isolation multi-tenant)
        partnerBUserId = '775818bd-1833-4e99-843d-3f5ecf8196e3';
        partnerBId = '9cdc4247-d1fe-483b-b5e2-12671b069134';
        const { data: pBUser } = await supabase.from('users').select('email').eq('id', partnerBUserId).single();
        await supabase.auth.admin.updateUserById(partnerBUserId, { password: 'Password123!' });
        const { data: sB } = await publicAuthClient.auth.signInWithPassword({
            email: pBUser?.email || 'partenaireB@test.com',
            password: 'Password123!',
        });
        partnerBToken = sB?.session?.access_token || '';

        // 3. Contrôleur X
        controllerXUserId = 'fe9318ac-1f65-4e80-980f-f00626f1a003';
        controllerXEmail = 'clientA_1788284499885@test.com';
        controllerXPhone = `+22177${ts}01`;
        await supabase.auth.admin.updateUserById(controllerXUserId, { password: 'Password123!' });
        await supabase.from('users').update({
            role: 'CONTROLEUR',
            status: 'ACTIF',
            phone: controllerXPhone,
            first_name: 'Modou',
            last_name: 'Fall',
        }).eq('id', controllerXUserId);

        const { data: sCtrlX } = await publicAuthClient.auth.signInWithPassword({
            email: controllerXEmail,
            password: 'Password123!',
        });
        controllerXToken = sCtrlX?.session?.access_token || '';

        // 4. Contrôleur Y
        controllerYUserId = '0339e833-89f2-44ee-b2b9-826ebffb0df5';
        controllerYEmail = 'controller_0339@test.com';
        await supabase.auth.admin.updateUserById(controllerYUserId, { password: 'Password123!' });
        await supabase.from('users').update({
            role: 'CONTROLEUR',
            status: 'ACTIF',
            first_name: 'Thierno',
            last_name: 'Ndiaye',
        }).eq('id', controllerYUserId);

        const { data: sCtrlY } = await publicAuthClient.auth.signInWithPassword({
            email: controllerYEmail,
            password: 'Password123!',
        });
        controllerYToken = sCtrlY?.session?.access_token || '';

        // 5. Création des événements de test Partenaire A
        const { data: evA } = await supabase.from('events').insert({
            partner_id: partnerAId,
            title: `Event A Dakar ${ts}`,
            slug: `event-a-dakar-${ts}`,
            description: 'Concert test A',
            start_date: '2026-12-01',
            start_time: '20:00:00',
            location: 'Monument Renaissance',
            status: 'PUBLIE',
        }).select().single();
        eventAId = evA.id;

        const { data: evB } = await supabase.from('events').insert({
            partner_id: partnerAId,
            title: `Event B Saly ${ts}`,
            slug: `event-b-saly-${ts}`,
            description: 'Soirée test B',
            start_date: '2026-12-02',
            start_time: '21:00:00',
            location: 'Plage de Saly',
            status: 'PUBLIE',
        }).select().single();
        eventBId = evB.id;

        const { data: evC } = await supabase.from('events').insert({
            partner_id: partnerAId,
            title: `Event C Thiès ${ts}`,
            slug: `event-c-thies-${ts}`,
            description: 'Festival test C',
            start_date: '2026-12-03',
            start_time: '19:00:00',
            location: 'Stade Lat Dior',
            status: 'PUBLIE',
        }).select().single();
        eventCId = evC.id;

        // Événement Partenaire B
        const { data: evPB } = await supabase.from('events').insert({
            partner_id: partnerBId,
            title: `Event B2 Saint-Louis ${ts}`,
            slug: `event-b2-saint-louis-${ts}`,
            description: 'Jazz Festival B',
            start_date: '2026-12-04',
            start_time: '20:00:00',
            location: 'Place Faidherbe',
            status: 'PUBLIE',
        }).select().single();
        eventPartnerBId = evPB.id;

        // Billets de test
        const { data: catA } = await supabase.from('ticket_categories').insert({
            event_id: eventAId,
            name: 'Pass Standard',
            price: 5000,
            total_quantity: 100,
        }).select().single();

        const { data: tA } = await supabase.from('tickets').insert({
            event_id: eventAId,
            category_id: catA.id,
            user_id: partnerAUserId,
            ticket_number: `TCK-A-${ts}`,
            qr_code: `EV-QR-A-${ts}`,
            price: 5000,
            status: 'VALIDE',
        }).select().single();
        ticketEventA = tA;

        const { data: catPB } = await supabase.from('ticket_categories').insert({
            event_id: eventPartnerBId,
            name: 'Pass VIP B',
            price: 10000,
            total_quantity: 50,
        }).select().single();

        const { data: tPB } = await supabase.from('tickets').insert({
            event_id: eventPartnerBId,
            category_id: catPB.id,
            user_id: partnerBUserId,
            ticket_number: `TCK-PB-${ts}`,
            qr_code: `EV-QR-PB-${ts}`,
            price: 10000,
            status: 'VALIDE',
        }).select().single();
        ticketPartnerB = tPB;

        // Nettoyage préalable des affectations résiduelles
        await supabase.from('event_controllers').delete().eq('user_id', controllerXUserId);
    });

    after(async () => {
        // Nettoyage en base
        await supabase.from('tickets').delete().in('id', [ticketEventA?.id, ticketPartnerB?.id].filter(Boolean));
        await supabase.from('ticket_categories').delete().in('event_id', [eventAId, eventBId, eventCId, eventPartnerBId].filter(Boolean));
        await supabase.from('event_controllers').delete().in('user_id', [controllerXUserId, controllerYUserId].filter(Boolean));
        await supabase.from('events').delete().in('id', [eventAId, eventBId, eventCId, eventPartnerBId].filter(Boolean));
    });

    // ──────────────────────────────────────────────────────────
    // TEST 1 : Créer Contrôleur X & Vérifier rôle CONTROLEUR
    // ──────────────────────────────────────────────────────────
    await test('TEST 1: Créer Contrôleur X et vérifier rôle CONTROLEUR', async () => {
        const { data: user } = await supabase.from('users').select('id, role, status').eq('id', controllerXUserId).single();
        assert.equal(user?.role, 'CONTROLEUR', 'L\'utilisateur doit posséder le rôle CONTROLEUR');
        assert.equal(user?.status, 'ACTIF', 'L\'utilisateur doit avoir le statut ACTIF');
    });

    // ──────────────────────────────────────────────────────────
    // TEST 2 : Affecter X à A & Vérifier qu'il voit A
    // ──────────────────────────────────────────────────────────
    await test('TEST 2: Affecter X à A et vérifier qu\'il voit l\'événement A', async () => {
        const { error: insErr } = await supabase.from('event_controllers').insert({
            event_id: eventAId,
            user_id: controllerXUserId,
            can_accept_cash: false,
            created_by: partnerAUserId,
        });
        assert.ifError(insErr);

        const req = new NextRequest('http://localhost:3000/api/controller/assignments', {
            headers: { Authorization: `Bearer ${controllerXToken}` },
        });
        const res = await getAssignments(req);
        const data = await res.json();

        assert.equal(res.status, 200);
        assert.equal(data.success, true);
        assert.equal(data.assignments.length, 1);
        assert.equal(data.assignments[0].events.id, eventAId);
    });

    // ──────────────────────────────────────────────────────────
    // TEST 3 : Affecter X à B & Vérifier qu'il voit A + B
    // ──────────────────────────────────────────────────────────
    await test('TEST 3: Affecter X à B et vérifier qu\'il voit A + B simultanément', async () => {
        const patchReq = new NextRequest('http://localhost:3000/api/partner/team/assignments', {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${partnerAToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                controller_id: controllerXUserId,
                event_ids: [eventAId, eventBId],
                can_accept_cash: true,
            }),
        });
        const patchRes = await updateAssignments(patchReq);
        const patchData = await patchRes.json();
        assert.equal(patchRes.status, 200, `Erreur patch: ${JSON.stringify(patchData)}`);

        // Relecture côté Contrôleur
        const req = new NextRequest('http://localhost:3000/api/controller/assignments', {
            headers: { Authorization: `Bearer ${controllerXToken}` },
        });
        const res = await getAssignments(req);
        const data = await res.json();

        assert.equal(res.status, 200);
        assert.equal(data.assignments.length, 2, 'Le contrôleur doit voir exactement 2 événements');
        const ids = data.assignments.map((a: any) => a.events.id).sort();
        const expected = [eventAId, eventBId].sort();
        assert.deepEqual(ids, expected);
    });

    // ──────────────────────────────────────────────────────────
    // TEST 4 : Retirer X de A & Vérifier qu'il voit uniquement B
    // ──────────────────────────────────────────────────────────
    await test('TEST 4: Retirer X de A et vérifier qu\'il voit uniquement B', async () => {
        const { data: assignA } = await supabase
            .from('event_controllers')
            .select('id')
            .eq('event_id', eventAId)
            .eq('user_id', controllerXUserId)
            .single();

        assert.ok(assignA, 'L\'assignation A doit exister avant retrait');

        const delReq = new NextRequest(`http://localhost:3000/api/partner/team/${eventAId}?assignmentId=${assignA.id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${partnerAToken}` },
        });
        const delRes = await removeSingleEvent(delReq, { params: { eventId: eventAId } });
        const delData = await delRes.json();
        assert.equal(delRes.status, 200);
        assert.equal(delData.success, true);

        // Relecture côté Contrôleur
        const req = new NextRequest('http://localhost:3000/api/controller/assignments', {
            headers: { Authorization: `Bearer ${controllerXToken}` },
        });
        const res = await getAssignments(req);
        const data = await res.json();

        assert.equal(data.assignments.length, 1);
        assert.equal(data.assignments[0].events.id, eventBId, 'Seul l\'événement B doit rester');
    });

    // ──────────────────────────────────────────────────────────
    // TEST 5 : Retirer X de tous les événements
    // ──────────────────────────────────────────────────────────
    await test('TEST 5: Retirer X de tous les événements (Action E CDC)', async () => {
        const delAllReq = new NextRequest(`http://localhost:3000/api/partner/team/all?controllerId=${controllerXUserId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${partnerAToken}` },
        });
        const delAllRes = await removeAllPartnerEvents(delAllReq);
        const delAllData = await delAllRes.json();
        assert.equal(delAllRes.status, 200);
        assert.equal(delAllData.success, true);

        // 1. Vérification 0 affectation active pour ce partenaire
        const { data: remainingAssignments } = await supabase
            .from('event_controllers')
            .select('id')
            .eq('user_id', controllerXUserId)
            .in('event_id', [eventAId, eventBId, eventCId]);
        assert.equal(remainingAssignments?.length ?? 0, 0, '0 affectation active restante');

        // 2. Vérification compte toujours présent
        const { data: user } = await supabase.from('users').select('id, role, status').eq('id', controllerXUserId).single();
        assert.ok(user, 'Le compte utilisateur doit toujours exister');

        // 3. Rôle CONTROLEUR conservé
        assert.equal(user.role, 'CONTROLEUR', 'Le rôle CONTROLEUR est conservé');

        // 4. API assignments renvoie 0 événement
        const req = new NextRequest('http://localhost:3000/api/controller/assignments', {
            headers: { Authorization: `Bearer ${controllerXToken}` },
        });
        const res = await getAssignments(req);
        const data = await res.json();
        assert.equal(data.assignments.length, 0, 'La liste des événements assignés est vide');
    });

    // ──────────────────────────────────────────────────────────
    // TEST 6 : Réaffecter X à C & Vérifier qu'il retrouve immédiatement C
    // ──────────────────────────────────────────────────────────
    await test('TEST 6: Réaffecter X à C et vérifier qu\'il retrouve immédiatement C', async () => {
        const patchReq = new NextRequest('http://localhost:3000/api/partner/team/assignments', {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${partnerAToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                controller_id: controllerXUserId,
                event_ids: [eventCId],
                can_accept_cash: false,
            }),
        });
        const patchRes = await updateAssignments(patchReq);
        assert.equal(patchRes.status, 200);

        // Vérification immédiate
        const req = new NextRequest('http://localhost:3000/api/controller/assignments', {
            headers: { Authorization: `Bearer ${controllerXToken}` },
        });
        const res = await getAssignments(req);
        const data = await res.json();
        assert.equal(data.assignments.length, 1);
        assert.equal(data.assignments[0].events.id, eventCId);
    });

    // ──────────────────────────────────────────────────────────
    // TEST 7 : Supprimer complètement X (Action F CDC)
    // ──────────────────────────────────────────────────────────
    await test('TEST 7: Supprimer complètement X (Action F CDC - Révocation totale & Invalidation)', async () => {
        const delReq = new NextRequest(`http://localhost:3000/api/partner/team/controller/${controllerXUserId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${partnerAToken}` },
        });
        const delRes = await deleteControllerFromTeam(delReq, { params: { controllerId: controllerXUserId } });
        const delData = await delRes.json();
        assert.equal(delRes.status, 200);
        assert.equal(delData.success, true);

        // 1. Zéro affectation active
        const { count: aCount } = await supabase
            .from('event_controllers')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', controllerXUserId);
        assert.equal(aCount, 0, 'Aucune affectation active restante');

        // 2. Compte non opérationnel : statut SUSPENDU et rôle dégradé à CLIENT
        const { data: userProfile } = await supabase
            .from('users')
            .select('id, role, status')
            .eq('id', controllerXUserId)
            .single();
        assert.equal(userProfile?.status, 'SUSPENDU', 'Le statut doit être SUSPENDU');
        assert.equal(userProfile?.role, 'CLIENT', 'Le rôle contrôleur doit être révoqué');

        // 3. Invisible dans l'équipe du partenaire
        const teamReq = new NextRequest('http://localhost:3000/api/partner/team/all', {
            headers: { Authorization: `Bearer ${partnerAToken}` },
        });
        const teamRes = await getTeamAll(teamReq);
        const teamData = await teamRes.json();
        const isInTeam = (teamData.controllers ?? []).some((c: any) => c.users?.id === controllerXUserId);
        assert.equal(isInTeam, false, 'Le contrôleur supprimé ne doit plus apparaître dans l\'équipe');

        // 4. Accès /api/controller/assignments refusé (403 car rôle n'est plus CONTROLEUR)
        const { data: signInRevoked } = await publicAuthClient.auth.signInWithPassword({
            email: controllerXEmail,
            password: 'Password123!',
        });
        if (signInRevoked?.session?.access_token) {
            const blockedReq = new NextRequest('http://localhost:3000/api/controller/assignments', {
                headers: { Authorization: `Bearer ${signInRevoked.session.access_token}` },
            });
            const blockedRes = await getAssignments(blockedReq);
            assert.equal(blockedRes.status, 403, 'Accès scanner doit être 403 Forbidden');
        }
    });

    // ──────────────────────────────────────────────────────────
    // TEST 8 : Réinviter X avec nouveau cycle OTP + mot de passe
    // ──────────────────────────────────────────────────────────
    await test('TEST 8: Réinviter X et vérifier le nouveau cycle OTP', async () => {
        const inviteReq = new NextRequest('http://localhost:3000/api/partner/team/invite', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${partnerAToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                event_ids: [eventBId],
                phone: controllerXPhone,
                first_name: 'Modou Réinvité',
                last_name: 'Fall',
                can_accept_cash: false,
            }),
        });
        const inviteRes = await inviteController(inviteReq);
        const inviteData = await inviteRes.json();
        assert.ok([200, 201].includes(inviteRes.status), `Status d'invitation invalide: ${inviteRes.status} - ${JSON.stringify(inviteData)}`);
        assert.equal(inviteData.success, true);

        // Vérification de la création d'un OTP valide en DB ou dans la réponse API
        const { data: otpRow } = await supabase
            .from('otp_codes')
            .select('code, expires_at')
            .eq('phone', controllerXPhone)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        const effectiveOtp = otpRow?.code || inviteData.otp_code;
        assert.ok(effectiveOtp, 'Un code OTP doit être généré pour la nouvelle invitation');
        assert.equal(effectiveOtp.length, 6, 'L\'OTP doit faire 6 chiffres');

        // Réactiver pour la suite des tests et renouveler le JWT valide
        await supabase.from('users').update({ role: 'CONTROLEUR', status: 'ACTIF' }).eq('id', controllerXUserId);
        const { data: sReactivated } = await publicAuthClient.auth.signInWithPassword({
            email: controllerXEmail,
            password: 'Password123!',
        });
        if (sReactivated?.session?.access_token) {
            controllerXToken = sReactivated.session.access_token;
        }
    });

    // ──────────────────────────────────────────────────────────
    // TEST 9 : Événement terminé → scan refusé
    // ──────────────────────────────────────────────────────────
    await test('TEST 9: Événement terminé → refus strict de scan (Partie 7 CDC)', async () => {
        // Mettre l'événement A à l'état TERMINE
        await supabase.from('events').update({ status: 'TERMINE' }).eq('id', eventAId);
        // Affecter proprement le contrôleur à cet événement
        await supabase.from('event_controllers').delete().eq('event_id', eventAId).eq('user_id', controllerXUserId);
        const { error: insErr9 } = await supabase.from('event_controllers').insert({
            event_id: eventAId,
            user_id: controllerXUserId,
            can_accept_cash: false,
            created_by: partnerAUserId,
        });
        assert.ifError(insErr9);

        const scanReq = new NextRequest('http://localhost:3000/api/controller/scan', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${controllerXToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ qr_code: ticketEventA.ticket_number }),
        });
        const scanRes = await scanTicket(scanReq);
        const scanData = await scanRes.json();

        assert.equal(scanRes.status, 400, 'Le scan sur événement terminé doit renvoyer HTTP 400');
        assert.equal(scanData.scan_result, 'event_ended', 'Le résultat doit être event_ended');
        assert.match(scanData.message, /terminé/i, 'Le message doit expliciter la clôture');
    });

    // ──────────────────────────────────────────────────────────
    // TEST 10 : Contrôleur A tente d'accéder à l'événement de Partenaire B → Refus
    // ──────────────────────────────────────────────────────────
    await test('TEST 10: Contrôleur A tente de scanner un billet de l\'événement Partenaire B → 403', async () => {
        const scanReq = new NextRequest('http://localhost:3000/api/controller/scan', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${controllerXToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ qr_code: ticketPartnerB.ticket_number }),
        });
        const scanRes = await scanTicket(scanReq);
        const scanData = await scanRes.json();

        assert.equal(scanRes.status, 403, 'Accès à un événement non assigné doit être 403');
        assert.equal(scanData.scan_result, 'unauthorized');
    });

    // ──────────────────────────────────────────────────────────
    // TEST 11 : Deux contrôleurs sur le même événement
    // ──────────────────────────────────────────────────────────
    await test('TEST 11: Deux contrôleurs sur le même événement (A ne voit pas les stats individuelles de B)', async () => {
        // Affecter les deux contrôleurs à Event B
        await supabase.from('event_controllers').delete().eq('event_id', eventBId).in('user_id', [controllerXUserId, controllerYUserId]);
        const { error: insErr11 } = await supabase.from('event_controllers').insert([
            { event_id: eventBId, user_id: controllerXUserId, created_by: partnerAUserId, can_accept_cash: false },
            { event_id: eventBId, user_id: controllerYUserId, created_by: partnerAUserId, can_accept_cash: false },
        ]);
        assert.ifError(insErr11);

        const reqX = new NextRequest('http://localhost:3000/api/controller/assignments', {
            headers: { Authorization: `Bearer ${controllerXToken}` },
        });
        const resX = await getAssignments(reqX);
        const dataX = await resX.json();

        assert.equal(resX.status, 200);
        // dataX.controller ne contient QUE le profil de X
        assert.equal(dataX.controller.first_name, 'Modou Réinvité');
        // Aucune mention ni stats nominatives de Y
        const hasY = JSON.stringify(dataX).includes('Thierno');
        assert.equal(hasY, false, 'Les données personnelles de Controller Y ne sont pas exposées à X');
    });

    // ──────────────────────────────────────────────────────────
    // TEST 12 : Contrôleur tente d'accéder aux finances → 403
    // ──────────────────────────────────────────────────────────
    await test('TEST 12: Contrôleur tente d\'accéder aux finances de la plateforme → 403', async () => {
        const finReq = new NextRequest('http://localhost:3000/api/partner/finance', {
            headers: { Authorization: `Bearer ${controllerXToken}` },
        });
        const finRes = await getPartnerFinance(finReq);
        assert.equal(finRes.status, 403, 'Accès finances doit être strictement 403 pour un contrôleur');
    });

    // ──────────────────────────────────────────────────────────
    // TEST 13 : Isolation Multi-Tenant (Partenaire A retire, Partenaire B reste intact)
    // ──────────────────────────────────────────────────────────
    await test('TEST 13: Isolation Multi-Tenant : Retrait par Partenaire A préserve les affectations de Partenaire B', async () => {
        // Contrôleur X partagé entre Partenaire A (Event B) et Partenaire B (Event Partner B)
        await supabase.from('event_controllers').delete().in('event_id', [eventBId, eventPartnerBId]).eq('user_id', controllerXUserId);
        const { error: insErr13 } = await supabase.from('event_controllers').insert([
            { event_id: eventBId, user_id: controllerXUserId, created_by: partnerAUserId, can_accept_cash: false },
            { event_id: eventPartnerBId, user_id: controllerXUserId, created_by: partnerBUserId, can_accept_cash: false },
        ]);
        assert.ifError(insErr13);

        // Partenaire A retire le contrôleur de tous ses événements
        const delAllReq = new NextRequest(`http://localhost:3000/api/partner/team/all?controllerId=${controllerXUserId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${partnerAToken}` },
        });
        const delAllRes = await removeAllPartnerEvents(delAllReq);
        assert.equal(delAllRes.status, 200);

        // Vérification : affectation Partenaire A supprimée
        const { data: assignA } = await supabase
            .from('event_controllers')
            .select('id')
            .eq('event_id', eventBId)
            .eq('user_id', controllerXUserId)
            .maybeSingle();
        assert.equal(assignA, null, 'L\'affectation Partenaire A doit être supprimée');

        // Vérification : affectation Partenaire B INTACTE !
        const { data: assignB } = await supabase
            .from('event_controllers')
            .select('id')
            .eq('event_id', eventPartnerBId)
            .eq('user_id', controllerXUserId)
            .maybeSingle();
        assert.ok(assignB, 'L\'affectation de Partenaire B DOIT RESTER INTACTE (Partie 11 CDC)');
    });

    // ──────────────────────────────────────────────────────────
    // TEST 14 : Vérification des notifications et audit logs
    // ──────────────────────────────────────────────────────────
    await test('TEST 14: Vérification des notifications in-app et des logs d\'audit de cycle de vie', async () => {
        // 1. Audit logs créés
        const { data: audits } = await supabase
            .from('audit_logs')
            .select('action, object_type, user_id')
            .eq('user_id', partnerAUserId)
            .order('created_at', { ascending: false })
            .limit(10);

        assert.ok(audits && audits.length > 0, 'Des logs d\'audit doivent être enregistrés');
        const actions = audits.map(a => a.action);
        const hasLifecycleAudits = actions.some(a => 
            a === 'CONTROLLER_ASSIGNMENTS_UPDATED' || 
            a === 'CONTROLLER_REMOVED' || 
            a === 'CONTROLLER_REMOVED_ALL' || 
            a === 'CONTROLLER_DELETED'
        );
        assert.equal(hasLifecycleAudits, true, 'Les actions de cycle de vie doivent être auditées');

        // 2. Notifications in-app envoyées au contrôleur
        const { data: notifs } = await supabase
            .from('notifications')
            .select('title, content')
            .eq('user_id', controllerXUserId)
            .order('created_at', { ascending: false })
            .limit(5);

        assert.ok(notifs && notifs.length > 0, 'Des notifications in-app doivent être envoyées au contrôleur');
    });
});
