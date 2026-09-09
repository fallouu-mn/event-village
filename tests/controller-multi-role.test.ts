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
import { POST as inviteController } from '../app/api/partner/team/invite/route';
import { DELETE as deleteController } from '../app/api/partner/team/controller/[controllerId]/route';
import { POST as requestWithdrawal } from '../app/api/withdrawals/request/route';
import { RateLimiter } from '../lib/security/rate-limiter';

describe('MULTI-CASQUETTE CLIENT + CONTRÔLEUR (SANS DOUBLON & SMART DELETE)', async () => {
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

    let clientUserId: string;
    let clientEmail: string;
    let clientPhone: string;
    let clientPhoneNormalized: string;
    let clientToken: string;
    let originalPhone: string;

    let eventAId: string;
    let eventBId: string;

    before(async () => {
        // 1. Initialiser Partenaire A
        partnerAUserId = 'e706a7a2-502c-4396-9e91-4dc6720388f7';
        partnerAId = 'a917b7ac-d542-4c2b-b5d8-ab38f866b2e7';
        await supabase.from('users').update({ role: 'PARTENAIRE', status: 'ACTIF' }).eq('id', partnerAUserId);
        const { data: pAUser } = await supabase.from('users').select('email').eq('id', partnerAUserId).single();
        await supabase.auth.admin.updateUserById(partnerAUserId, { password: 'Password123!' });
        const { data: sA } = await publicAuthClient.auth.signInWithPassword({
            email: pAUser?.email || 'partenaireA@test.com',
            password: 'Password123!',
        });
        partnerAToken = sA?.session?.access_token || '';
        assert.ok(partnerAToken, 'Token Partenaire A généré avec succès');

        // 2. Initialiser Partenaire B
        partnerBUserId = '775818bd-1833-4e99-843d-3f5ecf8196e3';
        partnerBId = '9cdc4247-d1fe-483b-b5e2-12671b069134';
        await supabase.from('users').update({ role: 'PARTENAIRE', status: 'ACTIF' }).eq('id', partnerBUserId);
        const { data: pBUser } = await supabase.from('users').select('email').eq('id', partnerBUserId).single();
        await supabase.auth.admin.updateUserById(partnerBUserId, { password: 'Password123!' });
        const { data: sB } = await publicAuthClient.auth.signInWithPassword({
            email: pBUser?.email || 'partenaireB@test.com',
            password: 'Password123!',
        });
        partnerBToken = sB?.session?.access_token || '';
        assert.ok(partnerBToken, 'Token Partenaire B généré avec succès');

        // 3. Préparer un compte CLIENT existant
        const { data: existingClient, error: clientFetchErr } = await supabase
            .from('users')
            .select('id, email, phone')
            .eq('role', 'CLIENT')
            .eq('status', 'ACTIF')
            .limit(1)
            .single();

        if (clientFetchErr || !existingClient) {
            throw new Error(`Aucun compte client trouvé pour le test: ${clientFetchErr?.message}`);
        }

        clientUserId = existingClient.id;
        clientEmail = existingClient.email;
        originalPhone = existingClient.phone;

        const random7 = Math.floor(1000000 + Math.random() * 9000000);
        clientPhone = `77${random7}`;
        clientPhoneNormalized = `+221${clientPhone}`;

        // Initialiser avec rôle CLIENT et téléphone de test
        await supabase.from('event_controllers').delete().eq('user_id', clientUserId);
        await supabase.from('user_roles').delete().eq('user_id', clientUserId);
        await supabase.from('user_roles').insert({ user_id: clientUserId, role: 'CLIENT' });
        await supabase.from('users').update({
            phone: clientPhoneNormalized,
            first_name: 'Moussa',
            last_name: 'Diop',
            role: 'CLIENT',
            status: 'ACTIF',
        }).eq('id', clientUserId);

        await RateLimiter.resetAttempts(`sms_invite_phone:${clientPhoneNormalized}`);
        await RateLimiter.resetAttempts(`sms_invite_partner:${partnerAUserId}`);
        await RateLimiter.resetAttempts(`sms_invite_partner:${partnerBUserId}`);
        await RateLimiter.resetAttempts(`sms_daily_quota_partner:${partnerAUserId}`);
        await RateLimiter.resetAttempts(`sms_daily_quota_partner:${partnerBUserId}`);

        await supabase.auth.admin.updateUserById(clientUserId, {
            password: 'Password123!',
            user_metadata: { role: 'CLIENT', first_name: 'Moussa', last_name: 'Diop' },
        });

        const { data: sClient } = await publicAuthClient.auth.signInWithPassword({
            email: clientEmail,
            password: 'Password123!',
        });
        clientToken = sClient?.session?.access_token || '';
        assert.ok(clientToken, 'Token Client généré avec succès');

        // 4. Créer un événement publié pour Partenaire A
        const { data: evA, error: evAErr } = await supabase.from('events').insert({
            partner_id: partnerAId,
            title: `Festival Multi-Role A ${ts}`,
            slug: `festival-multi-a-${ts}`,
            description: 'Festival test A',
            start_date: '2026-12-20',
            start_time: '20:00:00',
            location: 'Dakar',
            status: 'PUBLIE',
        }).select().single();
        if (evAErr) throw new Error(`Échec création event A: ${evAErr.message}`);
        eventAId = evA.id;

        // 5. Créer un événement publié pour Partenaire B
        const { data: evB, error: evBErr } = await supabase.from('events').insert({
            partner_id: partnerBId,
            title: `Festival Multi-Role B ${ts}`,
            slug: `festival-multi-b-${ts}`,
            description: 'Festival test B',
            start_date: '2026-12-25',
            start_time: '20:00:00',
            location: 'Saly',
            status: 'PUBLIE',
        }).select().single();
        if (evBErr) throw new Error(`Échec création event B: ${evBErr.message}`);
        eventBId = evB.id;

        // 6. Créer une commande de test pour ce client (historique client)
        await supabase.from('orders').insert({
            order_number: `CMD-TEST-${ts}`,
            client_id: clientUserId,
            partner_id: partnerAId,
            subtotal: 5000,
            total_amount: 5000,
            delivery_mode: 'SUR_PLACE',
            order_status: 'CONFIRMEE',
            payment_status: 'SUCCESS',
        });

        // Nettoyer les compteurs de rate limit pour les identifiants de test
        await RateLimiter.resetAttempts(`sms_invite_phone:${clientPhoneNormalized}`);
        await RateLimiter.resetAttempts(`sms_invite_partner:${partnerAUserId}`);
        await RateLimiter.resetAttempts(`sms_invite_partner:${partnerBUserId}`);
    });

    after(async () => {
        // Nettoyage complet
        if (eventAId) {
            await supabase.from('event_controllers').delete().eq('event_id', eventAId);
            await supabase.from('orders').delete().eq('partner_id', partnerAId).eq('client_id', clientUserId);
            await supabase.from('events').delete().eq('id', eventAId);
        }
        if (eventBId) {
            await supabase.from('event_controllers').delete().eq('event_id', eventBId);
            await supabase.from('events').delete().eq('id', eventBId);
        }
        if (clientUserId) {
            await supabase.from('event_controllers').delete().eq('user_id', clientUserId);
            await supabase.from('users').update({
                phone: originalPhone,
                role: 'CLIENT',
                status: 'ACTIF',
            }).eq('id', clientUserId);
            await supabase.auth.admin.updateUserById(clientUserId, {
                user_metadata: { role: 'CLIENT' },
            });
        }
    });

    // ──────────────────────────────────────────────────────────
    // TEST 1 : Compte CLIENT invité -> requires_confirmation -> confirmation -> zéro doublon
    // ──────────────────────────────────────────────────────────
    await test('TEST 1.A : Invitation compte CLIENT existant sans confirmation -> retourne requires_confirmation (aucun changement en DB)', async () => {
        const req = new NextRequest('http://localhost:3000/api/partner/team/invite', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${partnerAToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                event_ids: [eventAId],
                phone: clientPhone,
                first_name: 'Moussa',
                last_name: 'Diop',
                can_accept_cash: true,
            }),
        });
        const res = await inviteController(req);
        const data = await res.json();

        assert.equal(res.status, 200, 'Statut 200 avec payload confirmation');
        assert.equal(data.requires_confirmation, true, 'requires_confirmation doit être true');
        assert.ok(data.existing_user, 'existing_user doit être présent');
        assert.equal(data.existing_user.id, clientUserId, 'ID correspond au compte client existant');
        assert.equal(data.existing_user.role, 'CLIENT', 'Rôle existant est CLIENT');
        assert.match(data.message, /Compte existant détecté/i, 'Message explicite pour modal partenaire');

        // Vérification DB : aucun changement n'a été appliqué sans confirmation
        const { data: userInDb } = await supabase.from('users').select('role, status').eq('id', clientUserId).single();
        assert.equal(userInDb?.role, 'CLIENT', 'Rôle en DB doit toujours être CLIENT');
        assert.equal(userInDb?.status, 'ACTIF', 'Statut doit être ACTIF');

        const { count: assignCount } = await supabase
            .from('event_controllers')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', clientUserId);
        assert.equal(assignCount, 0, 'Aucune affectation créée avant confirmation explicite');
    });

    await test('TEST 1.B : Confirmation promotion -> rôle promu CONTROLEUR, statut ACTIF, zéro doublon, affectation créée', async () => {
        const req = new NextRequest('http://localhost:3000/api/partner/team/invite', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${partnerAToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                event_ids: [eventAId],
                phone: clientPhone,
                first_name: 'Moussa',
                last_name: 'Diop',
                can_accept_cash: true,
                confirm_promotion: true,
            }),
        });
        const res = await inviteController(req);
        const data = await res.json();
        assert.ok([200, 201].includes(res.status), `Statut 200/201 (reçu: ${res.status})`);
        assert.equal(data.success, true, 'Invitation réussie');

        // Vérification unicité : EXACTEMENT 1 ligne dans public.users pour ce numéro
        const { data: usersWithPhone } = await supabase
            .from('users')
            .select('id, role, status, phone')
            .eq('phone', clientPhoneNormalized);
        assert.equal(usersWithPhone?.length, 1, 'ZÉRO doublon : exactement 1 utilisateur avec ce numéro');
        assert.equal(usersWithPhone[0].id, clientUserId, 'Même user_id conservé');
        assert.equal(usersWithPhone[0].role, 'CONTROLEUR', 'Rôle promu en CONTROLEUR');
        assert.equal(usersWithPhone[0].status, 'ACTIF', 'Statut ACTIF maintenu');

        // Vérification Supabase Auth metadata
        const { data: authUser } = await supabase.auth.admin.getUserById(clientUserId);
        assert.equal(authUser.user?.user_metadata?.role, 'CONTROLEUR', 'Auth metadata mis à jour à CONTROLEUR');

        // Vérification affectation créée
        const { data: assignments } = await supabase
            .from('event_controllers')
            .select('id, event_id, can_accept_cash')
            .eq('user_id', clientUserId);
        assert.equal(assignments?.length, 1, 'Exactement 1 affectation créée');
        assert.equal(assignments[0].event_id, eventAId, 'Affecté à Event A');
        assert.equal(assignments[0].can_accept_cash, true, 'can_accept_cash respecté');
    });

    // ──────────────────────────────────────────────────────────
    // TEST 2 : Capacités Client préservées pour le compte Contrôleur
    // ──────────────────────────────────────────────────────────
    await test('TEST 2 : Le compte Contrôleur préserve l\'accès aux fonctions Client (Commandes & Retraits)', async () => {
        // Vérification de l'historique commande précédent
        const { data: orders } = await supabase
            .from('orders')
            .select('id, order_status, total_amount')
            .eq('client_id', clientUserId);
        assert.ok(orders && orders.length > 0, 'Les commandes client passées sont toujours présentes et liées');

        // Vérification que le contrôleur peut demander un retrait portefeuille (rôle CONTROLEUR éligible)
        await supabase.auth.admin.updateUserById(clientUserId, { password: 'Password123!' });
        const { data: sFresh } = await publicAuthClient.auth.signInWithPassword({
            email: clientEmail,
            password: 'Password123!',
        });
        const freshCtrlToken = sFresh?.session?.access_token || '';

        const withdrawReq = new NextRequest('http://localhost:3000/api/withdrawals/request', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${freshCtrlToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                amount: 1000,
                paymentMethod: 'WAVE',
                phoneNumber: clientPhoneNormalized,
            }),
        });
        const withdrawRes = await requestWithdrawal(withdrawReq);
        // Le retrait peut renvoyer 400 (solde insuffisant), mais JAMAIS 403 (Rôle non autorisé)
        assert.notEqual(
            withdrawRes.status,
            403,
            'Le rôle CONTROLEUR ne doit JAMAIS recevoir 403 Forbidden sur les retraits'
        );
    });

    // ──────────────────────────────────────────────────────────
    // TEST 3 : Smart Delete - Cas A (Exclusif)
    // Le contrôleur est retiré de sa seule équipe -> rôle redevient CLIENT, statut reste ACTIF
    // ──────────────────────────────────────────────────────────
    await test('TEST 3 : Smart Delete Cas A (Exclusif) -> Rôle devient CLIENT, statut reste ACTIF (jamais SUSPENDU)', async () => {
        const req = new NextRequest(`http://localhost:3000/api/partner/team/controller/${clientUserId}`, {
            method: 'DELETE',
            headers: {
                Authorization: `Bearer ${partnerAToken}`,
                'Content-Type': 'application/json',
            },
        });
        const res = await deleteController(req, { params: { controllerId: clientUserId } });
        const data = await res.json();

        assert.equal(res.status, 200, 'Suppression réussie 200');
        assert.equal(data.success, true, 'Succès confirmé');
        assert.equal(data.deactivated, true, 'Indique que le rôle contrôleur a été révoqué');

        // Vérification DB public.users
        const { data: userAfterDelete } = await supabase
            .from('users')
            .select('id, role, status')
            .eq('id', clientUserId)
            .single();

        assert.equal(userAfterDelete?.role, 'CLIENT', 'Rôle rétrogradé proprement à CLIENT');
        assert.equal(userAfterDelete?.status, 'ACTIF', 'DIRECTIVE CRITIQUE : statut STRICTEMENT ACTIF (jamais SUSPENDU)');

        // Vérification Supabase Auth metadata & purge rôle
        const { data: authUserAfterDelete } = await supabase.auth.admin.getUserById(clientUserId);
        assert.equal(authUserAfterDelete.user?.user_metadata?.role, 'CLIENT', 'Auth metadata rétrogradé à CLIENT');

        // Vérification suppression de l'affectation
        const { count: remainingAssigns } = await supabase
            .from('event_controllers')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', clientUserId);
        assert.equal(remainingAssigns, 0, 'Affectation supprimée');

        // Vérification intégrité des commandes
        const { count: orderCount } = await supabase
            .from('orders')
            .select('id', { count: 'exact', head: true })
            .eq('client_id', clientUserId);
        assert.ok((orderCount ?? 0) > 0, 'Les commandes client restent 100% intactes');
    });

    // ──────────────────────────────────────────────────────────
    // TEST 4 : Smart Delete - Cas B (Partagé)
    // Contrôleur affecté chez Partenaire A ET Partenaire B -> suppression par A conserve le rôle CONTROLEUR
    // ──────────────────────────────────────────────────────────
    await test('TEST 4 : Smart Delete Cas B (Partagé) -> Suppression par Partenaire A préserve le rôle CONTROLEUR et l\'affectation Partenaire B', async () => {
        // Reset rate limiters before test
        await RateLimiter.resetAttempts(`sms_invite_phone:${clientPhoneNormalized}`);
        await RateLimiter.resetAttempts(`sms_invite_partner:${partnerAUserId}`);
        await RateLimiter.resetAttempts(`sms_invite_partner:${partnerBUserId}`);
        await RateLimiter.resetAttempts(`sms_daily_quota_partner:${partnerAUserId}`);
        await RateLimiter.resetAttempts(`sms_daily_quota_partner:${partnerBUserId}`);

        // 1. Réassigner chez Partenaire A (avec confirmation car le user est redevenu CLIENT)
        const reInviteAReq = new NextRequest('http://localhost:3000/api/partner/team/invite', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${partnerAToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                event_ids: [eventAId],
                phone: clientPhone,
                confirm_promotion: true,
            }),
        });
        const reInviteARes = await inviteController(reInviteAReq);
        assert.ok([200, 201].includes(reInviteARes.status));

        // Reset phone rate limit for second invite in same test
        await RateLimiter.resetAttempts(`sms_invite_phone:${clientPhoneNormalized}`);

        // 2. Partenaire B invite également ce contrôleur (déjà CONTROLEUR -> pas de confirmation requise)
        const inviteBReq = new NextRequest('http://localhost:3000/api/partner/team/invite', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${partnerBToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                event_ids: [eventBId],
                phone: clientPhone,
            }),
        });
        const inviteBRes = await inviteController(inviteBReq);
        const inviteBData = await inviteBRes.json();
        assert.ok([200, 201].includes(inviteBRes.status));
        assert.equal(inviteBData.success, true, 'Assigné directement chez Partenaire B sans confirmation');

        // Vérifier 2 affectations au total
        const { count: twoAssigns } = await supabase
            .from('event_controllers')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', clientUserId);
        assert.equal(twoAssigns, 2, 'Contrôleur partagé sur 2 événements (2 partenaires)');

        // 3. Partenaire A supprime le contrôleur de son équipe
        const deleteReqA = new NextRequest(`http://localhost:3000/api/partner/team/controller/${clientUserId}`, {
            method: 'DELETE',
            headers: {
                Authorization: `Bearer ${partnerAToken}`,
                'Content-Type': 'application/json',
            },
        });
        const deleteResA = await deleteController(deleteReqA, { params: { controllerId: clientUserId } });
        const deleteDataA = await deleteResA.json();

        assert.equal(deleteResA.status, 200);
        assert.equal(deleteDataA.success, true);
        assert.equal(deleteDataA.deactivated, false, 'deactivated = false car encore actif chez Partenaire B');

        // 4. Vérifications en DB
        // Rôle CONTROLEUR conservé !
        const { data: userShared } = await supabase
            .from('users')
            .select('role, status')
            .eq('id', clientUserId)
            .single();
        assert.equal(userShared?.role, 'CONTROLEUR', 'Rôle CONTROLEUR maintenu grâce à l\'affectation Partenaire B');
        assert.equal(userShared?.status, 'ACTIF', 'Statut ACTIF maintenu');

        // Affectations : Event A supprimé, Event B préservé !
        const { data: remainingAfterSharedDelete } = await supabase
            .from('event_controllers')
            .select('event_id')
            .eq('user_id', clientUserId);

        const remainingEvIds = (remainingAfterSharedDelete || []).map(a => a.event_id);
        assert.ok(!remainingEvIds.includes(eventAId), 'Affectation Partenaire A bien supprimée');
        assert.ok(remainingEvIds.includes(eventBId), 'Affectation Partenaire B STRICTEMENT PRÉSERVÉE');
    });

    // ──────────────────────────────────────────────────────────
    // TEST 5 : Ré-invitation d'un ancien contrôleur (redevenu CLIENT)
    // ──────────────────────────────────────────────────────────
    await test('TEST 5 : Après retrait total (Cas A), une ré-invitation re-déclenche requires_confirmation et ré-active le rôle sans conflit', async () => {
        // 1. Partenaire B supprime également ce contrôleur -> retrait total -> retour CLIENT
        const deleteReqB = new NextRequest(`http://localhost:3000/api/partner/team/controller/${clientUserId}`, {
            method: 'DELETE',
            headers: {
                Authorization: `Bearer ${partnerBToken}`,
                'Content-Type': 'application/json',
            },
        });
        const deleteResB = await deleteController(deleteReqB, { params: { controllerId: clientUserId } });
        assert.equal(deleteResB.status, 200);

        // Vérification retour CLIENT
        const { data: userReset } = await supabase.from('users').select('role, status').eq('id', clientUserId).single();
        assert.equal(userReset?.role, 'CLIENT', 'Redevenu CLIENT');
        assert.equal(userReset?.status, 'ACTIF', 'Toujours ACTIF');

        // Reset rate limiter for the test phone so re-invitations in the same test pass
        await RateLimiter.resetAttempts(`sms_invite_phone:${clientPhoneNormalized}`);
        await RateLimiter.resetAttempts(`sms_invite_partner:${partnerAUserId}`);

        // 2. Partenaire A ré-invite ce numéro sans confirmation
        const reInviteReq1 = new NextRequest('http://localhost:3000/api/partner/team/invite', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${partnerAToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                event_ids: [eventAId],
                phone: clientPhone,
            }),
        });
        const reInviteRes1 = await inviteController(reInviteReq1);
        const reInviteData1 = await reInviteRes1.json();

        assert.equal(reInviteRes1.status, 200);
        assert.equal(reInviteData1.requires_confirmation, true, 'Demande de confirmation ré-affichée');

        // 3. Partenaire A confirme
        const reInviteReq2 = new NextRequest('http://localhost:3000/api/partner/team/invite', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${partnerAToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                event_ids: [eventAId],
                phone: clientPhone,
                confirm_promotion: true,
            }),
        });
        const reInviteRes2 = await inviteController(reInviteReq2);
        const reInviteData2 = await reInviteRes2.json();

        assert.ok([200, 201].includes(reInviteRes2.status));
        assert.equal(reInviteData2.success, true);

        // Vérification finale
        const { data: userFinal } = await supabase.from('users').select('role, status').eq('id', clientUserId).single();
        assert.equal(userFinal?.role, 'CONTROLEUR', 'Rôle ré-activé');
        assert.equal(userFinal?.status, 'ACTIF', 'Statut ACTIF');
    });
});
