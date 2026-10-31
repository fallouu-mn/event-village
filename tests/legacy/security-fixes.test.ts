import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Chargement des variables d'environnement
// [lot 0] Chargement de .env.local supprimé : l'environnement de test (.env.test, instance Supabase locale)
// et le garde-fou anti-base réelle sont fournis par tests/helpers/env.ts.
import '../helpers/env';

import { getServiceRoleClient } from '../../lib/supabase/server';
import { POST as postScan } from '../../app/api/controller/scan/route';
import { POST as controllerSetup } from '../../app/api/controller/setup/route';
import { POST as inviteController } from '../../app/api/partner/team/invite/route';
import { PATCH as patchAssignments } from '../../app/api/partner/team/assignments/route';
import { DELETE as deleteController } from '../../app/api/partner/team/controller/[controllerId]/route';

describe('VÉRIFICATION ET VALIDATION DES 10 CORRECTIFS DE SÉCURITÉ', async () => {
    const supabase = getServiceRoleClient();
    const publicAuth = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const ts = Date.now().toString().slice(-6);

    // [lot 4] lib/security/rate-limiter.ts supprimé : les quotas sont des compteurs en base (quota_counters,
    // réservés par reserveQuota de lib/security/quota.ts). Remise à zéro équivalente des anciennes clés :
    // sms_invite_phone → invite_phone, sms_invite_partner → invite_partner.
    const resetQuota = async (scope: string, bucket: string) => {
        const { error } = await supabase.from('quota_counters').delete().eq('scope', scope).eq('bucket', bucket);
        if (error) throw new Error(`remise à zéro du quota ${scope}/${bucket} : ${error.message}`);
    };

    const partnerUserId = 'e706a7a2-502c-4396-9e91-4dc6720388f7';
    const partnerId = 'a917b7ac-d542-4c2b-b5d8-ab38f866b2e7';
    const ctrlUserId = 'fe9318ac-1f65-4e80-980f-f00626f1a003';
    const victimClientId = 'a7345050-03cf-4967-9281-9ee5eb75615a';
    const clientBId = '461585ee-5d5f-4063-8f86-b84d08cb209b';

    let partnerToken: string;
    let ctrlToken: string;
    let eventId: string;
    let catId: string;

    before(async () => {
        // Obtenir tokens
        const { data: pUser } = await supabase.from('users').select('email').eq('id', partnerUserId).single();
        await supabase.auth.admin.updateUserById(partnerUserId, { password: process.env.LEGACY_TEST_PASSWORD! });
        const { data: pAuth } = await publicAuth.auth.signInWithPassword({
            email: pUser?.email || 'partenaireA@test.com',
            password: process.env.LEGACY_TEST_PASSWORD!,
        });
        partnerToken = pAuth?.session?.access_token!;

        const { data: cUser } = await supabase.from('users').select('email').eq('id', ctrlUserId).single();
        await supabase.auth.admin.updateUserById(ctrlUserId, { password: process.env.LEGACY_TEST_PASSWORD! });
        const { data: cAuth } = await publicAuth.auth.signInWithPassword({
            email: cUser?.email!,
            password: process.env.LEGACY_TEST_PASSWORD!,
        });
        ctrlToken = cAuth?.session?.access_token!;

        // Créer un événement test
        const { data: event, error: evErr } = await supabase.from('events').insert({
            partner_id: partnerId,
            title: 'Audit Fix Test Event ' + ts,
            slug: 'audit-fix-' + ts,
            start_date: '2026-12-25',
            start_time: '20:00:00',
            location: 'Dakar Arena',
            status: 'PUBLIE',
        }).select().single();
        if (evErr) throw evErr;
        eventId = event.id;

        // Créer une catégorie de billets
        const { data: cat, error: catErr } = await supabase.from('ticket_categories').insert({
            event_id: eventId,
            name: 'Pass VIP ' + ts,
            price: 5000,
            total_quantity: 100,
        }).select().single();
        if (catErr) throw catErr;
        catId = cat.id;

        // Affecter le contrôleur
        await supabase.from('event_controllers').insert({
            user_id: ctrlUserId,
            event_id: eventId,
            can_accept_cash: true,
            created_by: partnerUserId,
        });

        // Nettoyer rate limits initiaux
        await resetQuota('invite_partner', partnerUserId);
    });

    after(async () => {
        // Nettoyage DB
        await supabase.from('tickets').delete().eq('event_id', eventId);
        await supabase.from('orders').delete().eq('partner_id', partnerId);
        await supabase.from('event_controllers').delete().eq('event_id', eventId);
        await supabase.from('ticket_categories').delete().eq('id', catId);
        await supabase.from('events').delete().eq('id', eventId);
        await supabase.from('users').update({ role: 'CLIENT', status: 'ACTIF' }).in('id', [victimClientId, clientBId]);
    });

    // [lot 4 — cas supprimé] TEST 1.1 : Faille 1.1 — Protection IDOR Encaissement Cash : PUT /api/controller/scan { ticket_id, order_id } retiré ; l'encaissement ne reçoit plus de commande, il part d'un scan cash_required du même scanneur ({ scanId, eventId } → ticket_cash_checkin, commande lue en base sous verrou) ; couvert par tests/parcours/acces-encaissement.test.ts

    // ─────────────────────────────────────────────────────────────
    // TEST 1.2 : Account Takeover via /api/controller/setup
    // ─────────────────────────────────────────────────────────────
    await test('TEST 1.2 : Faille 1.2 — Protection ATO (/api/controller/setup)', async () => {
        const { data: victimUser } = await supabase.from('users').select('phone, email').eq('id', victimClientId).single();
        const originalPassword = `${process.env.LEGACY_TEST_PASSWORD}-original`; // lot 1C.6 : plus de littéral
        await supabase.auth.admin.updateUserById(victimClientId, {
            password: originalPassword,
            user_metadata: { is_temporary_controller_account: false, role: 'CLIENT' },
        });

        // Assigner à un événement pour simuler l'existence d'une invitation
        await supabase.from('event_controllers').delete().eq('user_id', victimClientId);
        await supabase.from('event_controllers').insert({
            user_id: victimClientId,
            event_id: eventId,
            created_by: partnerUserId,
        });

        // Simuler un OTP valide
        const testOtp = '112233';
        await (supabase.from('otp_codes') as any).delete().eq('phone', victimUser?.phone);
        await (supabase.from('otp_codes') as any).insert({
            phone: victimUser?.phone,
            code: testOtp,
            expires_at: new Date(Date.now() + 3600000).toISOString(),
            verified: false,
        });

        // Appel malveillant vers /api/controller/setup
        const hackerPassword = `${process.env.LEGACY_TEST_PASSWORD}-hacker`; // lot 1C.6 : plus de littéral
        const setupReq = new NextRequest('http://localhost:3000/api/controller/setup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phone: victimUser?.phone,
                otp_code: testOtp,
                new_password: hackerPassword,
            }),
        });

        const setupRes = await controllerSetup(setupReq);
        const setupJson = await setupRes.json();

        // Doit être rejeté car le compte n'a pas is_temporary_controller_account: true
        assert.equal(setupRes.status, 400, 'Le setup doit échouer avec 400');
        assert.equal(setupJson.code, 'ACCOUNT_ALREADY_CONFIGURED', 'Code d\'erreur explicite');

        // Vérification : l'ancien mot de passe fonctionne toujours, le mot de passe pirate échoue
        const { data: origLogin, error: origErr } = await publicAuth.auth.signInWithPassword({
            email: victimUser?.email!,
            password: originalPassword,
        });
        assert.ok(origLogin?.session, 'L\'utilisateur légitime peut toujours se connecter');
        assert.equal(origErr, null);

        const { error: hackErr } = await publicAuth.auth.signInWithPassword({
            email: victimUser?.email!,
            password: hackerPassword,
        });
        assert.ok(hackErr, 'Le mot de passe pirate doit être refusé');

        // Nettoyage assignation temporaire
        await supabase.from('event_controllers').delete().eq('user_id', victimClientId);
    });

    // ─────────────────────────────────────────────────────────────
    // TEST 1.3 : Éradication du recyclage d'identités orphelines
    // ─────────────────────────────────────────────────────────────
    await test('TEST 1.3 : Faille 1.3 — Éradication du recyclage d\'identités orphelines', async () => {
        // Vérification que le code d\'invitation définit correctement is_temporary_controller_account: true
        // pour les nouveaux comptes contrôleurs, et false pour les clients existants
        const { data: vClient } = await supabase.from('users').select('phone').eq('id', victimClientId).single();

        // Réinitialiser rate limits pour le test
        await resetQuota('invite_phone', vClient?.phone);
        await resetQuota('invite_partner', partnerUserId);

        const inviteReq = new NextRequest('http://localhost:3000/api/partner/team/invite', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + partnerToken,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                event_ids: [eventId],
                phone: vClient?.phone,
                confirm_promotion: true,
            }),
        });

        const inviteRes = await inviteController(inviteReq);
        assert.equal(inviteRes.status, 201);

        // Vérifier les métadonnées dans auth
        const { data: authUserData } = await supabase.auth.admin.getUserById(victimClientId);
        assert.equal(authUserData.user?.user_metadata?.is_temporary_controller_account, false,
            'Le compte client promu ne doit PAS être marqué temporaire');
    });

    // [lot 4 — cas supprimé] TEST 2.1 : Faille 2.1 — Résolution partners.id pour le scan partenaire : corps { qr_code } et champ scan_result retirés (identifiant nu → dynamic_qr_required) ; couvert par tests/parcours/acces-scan.test.ts (partenaire propriétaire : valid par la même route)
    // [lot 4 — cas supprimé] TEST 2.2 : Faille 2.2 — Rate Limiting sur les invitations SMS : RateLimiter.recordAttempt supprimé (compteurs en base, reserveQuota) ; couvert par tests/parcours/acces-limiteurs.test.ts (invitation : INVITE_PER_PHONE_DAY par numéro invité)

    // ─────────────────────────────────────────────────────────────
    // TEST 2.3 : Handshake PATCH /api/partner/team/assignments
    // ─────────────────────────────────────────────────────────────
    await test('TEST 2.3 : Faille 2.3 — Handshake requires_confirmation sur PATCH assignments', async () => {
        // S'assurer que clientB est CLIENT
        await supabase.from('users').update({ role: 'CLIENT', status: 'ACTIF' }).eq('id', clientBId);

        // 1. Sans confirmation
        const unconfirmedReq = new NextRequest('http://localhost:3000/api/partner/team/assignments', {
            method: 'PATCH',
            headers: {
                Authorization: 'Bearer ' + partnerToken,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                controller_id: clientBId,
                event_ids: [eventId],
            }),
        });

        const unconfirmedRes = await patchAssignments(unconfirmedReq);
        const unconfirmedJson = await unconfirmedRes.json();

        assert.equal(unconfirmedRes.status, 200);
        assert.equal(unconfirmedJson.requires_confirmation, true, 'Doit exiger confirmation');

        // Vérification : rôle toujours CLIENT
        const { data: userStillClient } = await supabase.from('users').select('role').eq('id', clientBId).single();
        assert.equal(userStillClient?.role, 'CLIENT', 'Le rôle ne doit pas changer sans confirmation explicite');

        // 2. Avec confirm_promotion: true
        const confirmedReq = new NextRequest('http://localhost:3000/api/partner/team/assignments', {
            method: 'PATCH',
            headers: {
                Authorization: 'Bearer ' + partnerToken,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                controller_id: clientBId,
                event_ids: [eventId],
                confirm_promotion: true,
            }),
        });

        const confirmedRes = await patchAssignments(confirmedReq);
        const confirmedJson = await confirmedRes.json();

        assert.equal(confirmedRes.status, 200);
        assert.equal(confirmedJson.success, true);

        // Vérification : rôle promu CONTROLEUR
        const { data: userPromoted } = await supabase.from('users').select('role').eq('id', clientBId).single();
        assert.equal(userPromoted?.role, 'CONTROLEUR', 'Le rôle doit être promu avec confirmation');
    });

    // [lot 4 — cas supprimé] TEST 3.1 : Faille 3.1 — RateLimiter mode failClosed : RateLimiter.isRateLimited supprimé ; fail-closed de reserveQuota couvert par tests/parcours/acces-limiteurs.test.ts (EXECUTE retiré sur quota_reserve → 503)

    // ─────────────────────────────────────────────────────────────
    // TEST 3.2 : Rejet scan si utilisateur suspendu ou inactif
    // ─────────────────────────────────────────────────────────────
    await test('TEST 3.2 : Faille 3.2 — Rejet scan pour contrôleur suspendu/inactif', async () => {
        // Suspendre temporairement le contrôleur
        await supabase.from('users').update({ status: 'SUSPENDU' }).eq('id', ctrlUserId);

        const scanReq = new NextRequest('http://localhost:3000/api/controller/scan', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + ctrlToken,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                qr_code: 'ANY-CODE',
            }),
        });

        const scanRes = await postScan(scanReq);
        const scanJson = await scanRes.json();

        assert.equal(scanRes.status, 403, 'Un compte suspendu doit être rejeté avec 403');
        assert.ok(scanJson.error.includes('inactif') || scanJson.error.includes('suspendu'));

        // Restaurer statut ACTIF
        await supabase.from('users').update({ status: 'ACTIF' }).eq('id', ctrlUserId);
    });

    // ─────────────────────────────────────────────────────────────
    // TEST 3.3 : Smart Delete & Rétrogradation atomique vers CLIENT
    // ─────────────────────────────────────────────────────────────
    await test('TEST 3.3 : Faille 3.3 — Smart Delete rétrograde vers CLIENT et préserve ACTIF', async () => {
        // clientBId est actuellement CONTROLEUR
        const deleteReq = new NextRequest('http://localhost:3000/api/partner/team/controller/' + clientBId, {
            method: 'DELETE',
            headers: {
                Authorization: 'Bearer ' + partnerToken,
                'Content-Type': 'application/json',
            },
        });

        const deleteRes = await deleteController(deleteReq, { params: { controllerId: clientBId } });
        const deleteJson = await deleteRes.json();

        assert.equal(deleteRes.status, 200);
        assert.equal(deleteJson.success, true);
        assert.equal(deleteJson.deactivated, true);

        // Vérification en DB
        const { data: demotedUser } = await supabase.from('users').select('role, status').eq('id', clientBId).single();
        assert.equal(demotedUser?.role, 'CLIENT', 'Le rôle doit être rétrogradé vers CLIENT');
        assert.equal(demotedUser?.status, 'ACTIF', 'Le statut doit STRICTEMENT rester ACTIF');
    });

    // ─────────────────────────────────────────────────────────────
    // TEST 3.4 : Protection de fuite de code OTP en production
    // ─────────────────────────────────────────────────────────────
    await test('TEST 3.4 : Faille 3.4 — otp_code absent des réponses API en production', async () => {
        const origEnv = process.env.NODE_ENV;
        try {
            (process.env as any).NODE_ENV = 'production';

            const phone = '+22177888' + ts.slice(-4);
            await resetQuota('invite_phone', phone);
            await resetQuota('invite_partner', partnerUserId);

            const prodReq = new NextRequest('http://localhost:3000/api/partner/team/invite', {
                method: 'POST',
                headers: {
                    Authorization: 'Bearer ' + partnerToken,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    event_ids: [eventId],
                    phone: phone,
                    first_name: 'ProdTest',
                }),
            });

            const prodRes = await inviteController(prodReq);
            const prodJson = await prodRes.json();

            assert.equal(prodJson.otp_code, undefined, 'otp_code doit être STRICTEMENT undefined en production');
            await resetQuota('invite_phone', phone);
        } finally {
            (process.env as any).NODE_ENV = origEnv;
        }
    });
});
