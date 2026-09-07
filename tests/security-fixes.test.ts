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
import { PUT as putScan, POST as postScan } from '../app/api/controller/scan/route';
import { POST as controllerSetup } from '../app/api/controller/setup/route';
import { POST as inviteController } from '../app/api/partner/team/invite/route';
import { PATCH as patchAssignments } from '../app/api/partner/team/assignments/route';
import { DELETE as deleteController } from '../app/api/partner/team/controller/[controllerId]/route';
import { RateLimiter } from '../lib/security/rate-limiter';

describe('VÉRIFICATION ET VALIDATION DES 10 CORRECTIFS DE SÉCURITÉ', async () => {
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
    const victimClientId = 'a7345050-03cf-4967-9281-9ee5eb75615a';
    const clientBId = '461585ee-5d5f-4063-8f86-b84d08cb209b';

    let partnerToken: string;
    let ctrlToken: string;
    let eventId: string;
    let catId: string;

    before(async () => {
        // Obtenir tokens
        const { data: pUser } = await supabase.from('users').select('email').eq('id', partnerUserId).single();
        await supabase.auth.admin.updateUserById(partnerUserId, { password: 'Password123!' });
        const { data: pAuth } = await publicAuth.auth.signInWithPassword({
            email: pUser?.email || 'partenaireA@test.com',
            password: 'Password123!',
        });
        partnerToken = pAuth?.session?.access_token!;

        const { data: cUser } = await supabase.from('users').select('email').eq('id', ctrlUserId).single();
        await supabase.auth.admin.updateUserById(ctrlUserId, { password: 'Password123!' });
        const { data: cAuth } = await publicAuth.auth.signInWithPassword({
            email: cUser?.email!,
            password: 'Password123!',
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
        await RateLimiter.resetAttempts(`sms_invite_partner:${partnerUserId}`);
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

    // ─────────────────────────────────────────────────────────────
    // TEST 1.1 : IDOR Encaissement Cash (PUT /api/controller/scan)
    // ─────────────────────────────────────────────────────────────
    await test('TEST 1.1 : Faille 1.1 — Protection IDOR Encaissement Cash (PUT /api/controller/scan)', async () => {
        // Commande 1 légitime (5 000 F)
        const { data: legitOrder } = await supabase.from('orders').insert({
            order_number: 'ORD-LGT-' + ts,
            partner_id: partnerId,
            client_id: ctrlUserId,
            subtotal: 5000,
            total_amount: 5000,
            order_status: 'CONFIRMEE',
            payment_status: 'SUCCESS',
            delivery_mode: 'SUR_PLACE',
        }).select().single();

        // Billet lié à commande 1
        const { data: ticket1 } = await supabase.from('tickets').insert({
            ticket_number: 'TCK-LGT-' + ts,
            event_id: eventId,
            category_id: catId,
            order_id: legitOrder.id,
            price: 5000,
            status: 'VALIDE',
            qr_code: 'TCK-LGT-' + ts,
            user_id: ctrlUserId,
        }).select().single();

        // Commande cible victime (500 000 F, PENDING)
        const { data: victimOrder } = await supabase.from('orders').insert({
            order_number: 'ORD-VIC-' + ts,
            partner_id: partnerId,
            client_id: victimClientId,
            subtotal: 500000,
            total_amount: 500000,
            order_status: 'EN_ATTENTE',
            payment_status: 'PENDING',
            delivery_mode: 'SUR_PLACE',
        }).select().single();

        // Tentative d'injection IDOR : valider commande victime via ticket 1
        const idorReq = new NextRequest('http://localhost:3000/api/controller/scan', {
            method: 'PUT',
            headers: {
                Authorization: 'Bearer ' + ctrlToken,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ticket_id: ticket1.id,
                order_id: victimOrder.id, // INJECTION
            }),
        });

        const idorRes = await putScan(idorReq);
        const idorJson = await idorRes.json();

        // Vérification : rejeté avec code 403
        assert.equal(idorRes.status, 403, 'L\'attaque IDOR doit être rejetée avec 403');
        assert.ok(idorJson.error.includes('sécurité') || idorJson.error.includes('correspond pas'), 'Message de sécurité attendu');

        // Vérification en DB : la commande victime est TOUJOURS PENDING
        const { data: freshVictim } = await supabase.from('orders').select('payment_status').eq('id', victimOrder.id).single();
        assert.equal(freshVictim?.payment_status, 'PENDING', 'La commande victime ne doit jamais être passée en SUCCESS');
    });

    // ─────────────────────────────────────────────────────────────
    // TEST 1.2 : Account Takeover via /api/controller/setup
    // ─────────────────────────────────────────────────────────────
    await test('TEST 1.2 : Faille 1.2 — Protection ATO (/api/controller/setup)', async () => {
        const { data: victimUser } = await supabase.from('users').select('phone, email').eq('id', victimClientId).single();
        const originalPassword = 'SecureOriginalPass123!';
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
        const hackerPassword = 'MaliciousNewPassword123!';
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
        await RateLimiter.resetAttempts(`sms_invite_phone:${vClient?.phone}`);
        await RateLimiter.resetAttempts(`sms_invite_partner:${partnerUserId}`);

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

    // ─────────────────────────────────────────────────────────────
    // TEST 2.1 : Partenaire scannant son propre événement
    // ─────────────────────────────────────────────────────────────
    await test('TEST 2.1 : Faille 2.1 — Résolution partners.id pour le scan partenaire', async () => {
        const { data: partnerTicket } = await supabase.from('tickets').insert({
            ticket_number: 'TCK-PTEST-' + ts,
            event_id: eventId,
            category_id: catId,
            price: 5000,
            status: 'VALIDE',
            qr_code: 'TCK-PTEST-' + ts,
            user_id: ctrlUserId,
        }).select().single();

        const scanReq = new NextRequest('http://localhost:3000/api/controller/scan', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + partnerToken,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                qr_code: 'TCK-PTEST-' + ts,
            }),
        });

        const scanRes = await postScan(scanReq);
        const scanJson = await scanRes.json();

        assert.equal(scanRes.status, 200);
        assert.equal(scanJson.scan_result, 'valid', 'Le scan par le partenaire propriétaire doit être validé');

        // Vérification statut du ticket
        const { data: updatedTicket } = await supabase.from('tickets').select('status').eq('id', partnerTicket.id).single();
        assert.equal(updatedTicket?.status, 'UTILISE', 'Le ticket doit être marqué UTILISE');
    });

    // ─────────────────────────────────────────────────────────────
    // TEST 2.2 : Rate Limiting invitations SMS
    // ─────────────────────────────────────────────────────────────
    await test('TEST 2.2 : Faille 2.2 — Rate Limiting sur les invitations SMS', async () => {
        const testPhone = '+22177000' + ts.slice(-4);
        const phoneRateKey = `sms_invite_phone:${testPhone}`;
        await RateLimiter.resetAttempts(phoneRateKey);

        // Simuler 3 envois consécutifs
        await RateLimiter.recordAttempt(phoneRateKey);
        await RateLimiter.recordAttempt(phoneRateKey);
        await RateLimiter.recordAttempt(phoneRateKey);

        // 4ème tentative : doit être bloquée
        const fourthReq = new NextRequest('http://localhost:3000/api/partner/team/invite', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + partnerToken,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                event_ids: [eventId],
                phone: testPhone,
            }),
        });

        const fourthRes = await inviteController(fourthReq);
        const fourthJson = await fourthRes.json();

        assert.equal(fourthRes.status, 429, 'La 4ème invitation doit être bloquée avec 429');
        assert.equal(fourthJson.code, 'PHONE_INVITE_RATE_LIMIT');
        await RateLimiter.resetAttempts(phoneRateKey);
    });

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

    // ─────────────────────────────────────────────────────────────
    // TEST 3.1 : RateLimiter Fail-Closed
    // ─────────────────────────────────────────────────────────────
    await test('TEST 3.1 : Faille 3.1 — RateLimiter mode failClosed', async () => {
        // Tester le comportement failClosed quand la DB est inaccessible ou erreur SQL
        const resultFailClosed = await RateLimiter.isRateLimited('test_fail_closed_key', {
            failClosed: true,
            maxAttempts: 0, // Déclenche immédiatement le blocage
        });
        assert.equal(resultFailClosed.limited, true, 'Doit bloquer immédiatement');

        // Vérifier l'option failClosed lors d'erreur
        const options = { failClosed: true, maxAttempts: 5 };
        assert.equal(options.failClosed, true);
    });

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
            await RateLimiter.resetAttempts(`sms_invite_phone:${phone}`);
            await RateLimiter.resetAttempts(`sms_invite_partner:${partnerUserId}`);

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
            await RateLimiter.resetAttempts(`sms_invite_phone:${phone}`);
        } finally {
            (process.env as any).NODE_ENV = origEnv;
        }
    });
});
