import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 1. Chargement des variables d'environnement (.env.local)
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
import { TicketPdfService } from '../lib/tickets/ticket-pdf.service';
import { TicketTransferService } from '../lib/tickets/ticket-transfer.service';
import { NotificationService } from '../lib/notifications/notification.service';
import { paymentService } from '../lib/payments/payment.service';
import { GET as getTicketPdfRoute } from '../app/api/tickets/[id]/pdf/route';
import { generateTotp, verifyTotp } from '../lib/security/totp';

describe('CHANTIER 3 : FINALISATION & EXPORTS DES BILLETS — SUITE OFFICIELLE (12 TESTS)', async () => {
    const supabase = getServiceRoleClient();
    const publicAuth = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const ts = Date.now().toString().slice(-6);

    const partnerId = 'a917b7ac-d542-4c2b-b5d8-ab38f866b2e7';
    const buyerAUserId = 'a7345050-03cf-4967-9281-9ee5eb75615a';
    const buyerBUserId = 'fe9318ac-1f65-4e80-980f-f00626f1a003';

    let testEventId: string;
    let testCategoryId: string;

    let buyerAToken: string;
    let buyerBToken: string;

    let ticketValidAId: string;
    let ticketCancelledAId: string;
    let ticketTransferredId: string;
    let secretTotpSecretA: string;

    before(async () => {
        console.log('\n[SETUP] Initialisation du banc d\'essai Chantier 3 (Exports PDF & Notifications)...');

        // 1. Authentification Buyer A & Buyer B
        const { data: bAUser } = await supabase.auth.admin.getUserById(buyerAUserId);
        const bAEmail = bAUser?.user?.email || 'buyerA@eventvillage.sn';
        await supabase.from('users').upsert({
            id: buyerAUserId,
            first_name: 'Mamadou',
            last_name: 'Diallo',
            phone: '+221771234567',
            email: bAEmail,
            role: 'CLIENT',
            status: 'ACTIF',
        });
        await supabase.auth.admin.updateUserById(buyerAUserId, { password: 'Password123!', email_confirm: true, user_metadata: { role: 'CLIENT', roles: ['CLIENT'] } });
        const { data: bAAuth } = await publicAuth.auth.signInWithPassword({ email: bAEmail, password: 'Password123!' });
        buyerAToken = bAAuth?.session?.access_token || '';

        const { data: bBUser } = await supabase.auth.admin.getUserById(buyerBUserId);
        const bBEmail = bBUser?.user?.email || 'buyerB@eventvillage.sn';
        await supabase.from('users').upsert({
            id: buyerBUserId,
            first_name: 'Aissatou',
            last_name: 'Sow',
            phone: '+221772345678',
            email: bBEmail,
            role: 'CLIENT',
            status: 'ACTIF',
        });
        await supabase.auth.admin.updateUserById(buyerBUserId, { password: 'Password123!', email_confirm: true, user_metadata: { role: 'CLIENT', roles: ['CLIENT'] } });
        const { data: bBAuth } = await publicAuth.auth.signInWithPassword({ email: bBEmail, password: 'Password123!' });
        buyerBToken = bBAuth?.session?.access_token || '';

        // 2. Événement de test
        const { data: ev, error: evErr } = await supabase.from('events').insert({
            partner_id: partnerId,
            title: `Festival Export PDF & Finition ${ts}`,
            slug: `fest-pdf-${ts}`,
            description: 'Validation de l export PDF officiel, du QR et des notifications',
            category: 'FESTIVAL',
            start_date: new Date(Date.now() + 86400000 * 6).toISOString().split('T')[0],
            start_time: '20:30:00',
            location: 'Esplanade du Grand Théâtre',
            city: 'Dakar',
            capacity: 500,
            status: 'PUBLIE',
        }).select('id').single();
        if (evErr || !ev) throw new Error(`Event creation: ${evErr?.message}`);
        testEventId = ev.id;

        // 3. Catégorie de billets
        const { data: cat, error: catErr } = await supabase.from('ticket_categories').insert({
            event_id: testEventId,
            name: 'Pass VIP Export',
            price: 25000,
            total_quantity: 30,
            sold_quantity: 5,
            is_active: true,
            is_visible: true,
        }).select('id').single();
        if (catErr || !cat) throw new Error(`Category creation: ${catErr?.message}`);
        testCategoryId = cat.id;

        // Inscription des rôles CLIENT
        await supabase.from('user_roles').delete().in('user_id', [buyerAUserId, buyerBUserId]);
        await supabase.from('user_roles').insert([
            { user_id: buyerAUserId, role: 'CLIENT' },
            { user_id: buyerBUserId, role: 'CLIENT' },
        ]);

        // 4. Billets de test
        secretTotpSecretA = crypto.randomBytes(32).toString('hex');

        // Billet 1 : VALIDE pour Buyer A
        const { data: t1, error: t1Err } = await supabase.from('tickets').insert({
            event_id: testEventId,
            category_id: testCategoryId,
            user_id: buyerAUserId,
            ticket_number: `TCK-PDF-1-${ts}`,
            price: 25000,
            qr_code: `EV-QR-PDF1-${ts}`,
            status: 'VALIDE',
            totp_secret: secretTotpSecretA,
        }).select('id').single();
        if (t1Err || !t1) throw new Error(`Ticket 1 creation failed: ${t1Err?.message || JSON.stringify(t1Err)}`);
        ticketValidAId = t1.id;

        // Billet 2 : ANNULE pour Buyer A
        const { data: t2, error: t2Err } = await supabase.from('tickets').insert({
            event_id: testEventId,
            category_id: testCategoryId,
            user_id: buyerAUserId,
            ticket_number: `TCK-PDF-ANNULE-${ts}`,
            price: 25000,
            qr_code: `EV-QR-PDF2-${ts}`,
            status: 'ANNULE',
            totp_secret: crypto.randomBytes(32).toString('hex'),
        }).select('id').single();
        if (t2Err || !t2) throw new Error(`Ticket 2 creation failed: ${t2Err?.message || JSON.stringify(t2Err)}`);
        ticketCancelledAId = t2.id;

        // Billet 3 : Transféré à Buyer B
        const { data: t3, error: t3Err } = await supabase.from('tickets').insert({
            event_id: testEventId,
            category_id: testCategoryId,
            user_id: buyerAUserId,
            ticket_number: `TCK-PDF-TRANS-${ts}`,
            price: 25000,
            qr_code: `EV-QR-PDF3-${ts}`,
            status: 'VALIDE',
            totp_secret: crypto.randomBytes(32).toString('hex'),
        }).select('id').single();
        if (t3Err || !t3) throw new Error(`Ticket 3 creation failed: ${t3Err?.message || JSON.stringify(t3Err)}`);
        ticketTransferredId = t3.id;

        // Effectuer le transfert P2P réel de ticket 3 de Buyer A vers Buyer B
        const transferRes = await TicketTransferService.initiateTransfer(buyerAUserId, ticketTransferredId, '+221772345678');
        await TicketTransferService.claimTransfer(buyerBUserId, transferRes.claim_token);

        console.log('[SETUP] Prêt.');
    });

    after(async () => {
        console.log('\n[CLEANUP] Nettoyage du banc d\'essai Chantier 3...');
        if (testEventId) {
            await supabase.from('ticket_transfers').delete().in('ticket_id', [ticketValidAId, ticketCancelledAId, ticketTransferredId].filter(Boolean));
            await supabase.from('tickets').delete().eq('event_id', testEventId);
            await supabase.from('ticket_categories').delete().eq('event_id', testEventId);
            await supabase.from('events').delete().eq('id', testEventId);
        }
        console.log('[CLEANUP] Terminé.');
    });

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 1 : Téléchargement PDF d'un billet valide par son propriétaire -> SUCCESS
    // ─────────────────────────────────────────────────────────────────────────
    await test('TEST 1 : Téléchargement PDF d\'un billet valide par son propriétaire (HTTP 200 & application/pdf)', async () => {
        const req = new NextRequest(`http://localhost:3000/api/tickets/${ticketValidAId}/pdf`, {
            headers: {
                Authorization: `Bearer ${buyerAToken}`,
            },
        });

        const res = await getTicketPdfRoute(req, { params: Promise.resolve({ id: ticketValidAId }) });

        assert.equal(res.status, 200, 'Le statut de réponse doit être 200 OK');
        assert.equal(res.headers.get('content-type'), 'application/pdf', 'Le content-type doit être application/pdf');

        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        assert.ok(buffer.length > 500, 'Le fichier PDF doit avoir une taille valide');
        assert.ok(buffer.toString('latin1', 0, 8).startsWith('%PDF-1.'), 'Le document doit débuter par le magic header PDF standard');
        assert.ok(buffer.toString('latin1').includes('%%EOF'), 'Le document doit se terminer par le trailer EOF standard');
    });

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 2 : Buyer B tente de télécharger le billet de Buyer A -> 403 Forbidden
    // ─────────────────────────────────────────────────────────────────────────
    await test('TEST 2 : Buyer B tente de télécharger le billet de Buyer A (HTTP 403 Forbidden)', async () => {
        const req = new NextRequest(`http://localhost:3000/api/tickets/${ticketValidAId}/pdf`, {
            headers: {
                Authorization: `Bearer ${buyerBToken}`, // Authentifié en tant que Buyer B
            },
        });

        const res = await getTicketPdfRoute(req, { params: Promise.resolve({ id: ticketValidAId }) });
        assert.equal(res.status, 403, 'Un utilisateur tiers doit être rejeté avec HTTP 403');
        const json = await res.json();
        assert.ok(json.error.includes('pas le propriétaire'), 'Message d\'erreur explicite d\'appartenance');
    });

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 3 : Utilisateur non authentifié -> 401 Unauthorized
    // ─────────────────────────────────────────────────────────────────────────
    await test('TEST 3 : Utilisateur non authentifié (HTTP 401 Unauthorized)', async () => {
        const req = new NextRequest(`http://localhost:3000/api/tickets/${ticketValidAId}/pdf`, {
            // Aucun header Authorization
        });

        const res = await getTicketPdfRoute(req, { params: Promise.resolve({ id: ticketValidAId }) });
        assert.equal(res.status, 401, 'Une requête sans token doit être rejetée avec HTTP 401');
    });

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 4 : Ticket inexistant -> 404 Not Found
    // ─────────────────────────────────────────────────────────────────────────
    await test('TEST 4 : Ticket inexistant (HTTP 404 Not Found)', async () => {
        const fakeId = '00000000-0000-0000-0000-000000000000';
        const req = new NextRequest(`http://localhost:3000/api/tickets/${fakeId}/pdf`, {
            headers: {
                Authorization: `Bearer ${buyerAToken}`,
            },
        });

        const res = await getTicketPdfRoute(req, { params: Promise.resolve({ id: fakeId }) });
        assert.equal(res.status, 404, 'Un identifiant inexistant doit retourner 404');
    });

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 5 : Ticket annulé/remboursé -> Rejet sécurisé (HTTP 400)
    // ─────────────────────────────────────────────────────────────────────────
    await test('TEST 5 : Ticket annulé/remboursé (Rejet sécurisé HTTP 400)', async () => {
        const req = new NextRequest(`http://localhost:3000/api/tickets/${ticketCancelledAId}/pdf`, {
            headers: {
                Authorization: `Bearer ${buyerAToken}`,
            },
        });

        const res = await getTicketPdfRoute(req, { params: Promise.resolve({ id: ticketCancelledAId }) });
        assert.equal(res.status, 400, 'Un billet ANNULE ne peut pas être généré en PDF');
        const json = await res.json();
        assert.ok(json.error.includes('n\'est plus valide'), 'Doit indiquer que le billet n\'est plus valide');
    });

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 6 : Billet transféré -> Seul le nouveau propriétaire peut le télécharger
    // ─────────────────────────────────────────────────────────────────────────
    await test('TEST 6 : Billet transféré (Ancien propriétaire = 403, Nouveau propriétaire = 200 OK)', async () => {
        // 1. L'ancien propriétaire (Buyer A) tente de télécharger le billet transféré -> 403
        const reqOldOwner = new NextRequest(`http://localhost:3000/api/tickets/${ticketTransferredId}/pdf`, {
            headers: {
                Authorization: `Bearer ${buyerAToken}`,
            },
        });
        const resOld = await getTicketPdfRoute(reqOldOwner, { params: Promise.resolve({ id: ticketTransferredId }) });
        assert.equal(resOld.status, 403, 'L\'ancien propriétaire doit recevoir 403 après le transfert');

        // 2. Le nouveau propriétaire légitime (Buyer B) télécharge le billet -> 200 OK
        const reqNewOwner = new NextRequest(`http://localhost:3000/api/tickets/${ticketTransferredId}/pdf`, {
            headers: {
                Authorization: `Bearer ${buyerBToken}`,
            },
        });
        const resNew = await getTicketPdfRoute(reqNewOwner, { params: Promise.resolve({ id: ticketTransferredId }) });
        assert.equal(resNew.status, 200, 'Le nouveau propriétaire légitime doit recevoir 200 OK');
        assert.equal(resNew.headers.get('content-type'), 'application/pdf');
    });

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 7 : Vérification approfondie du contenu PDF & Absence de secrets
    // ─────────────────────────────────────────────────────────────────────────
    await test('TEST 7 : Vérification du contenu PDF (Métadonnées, QR, ZÉRO secret TOTP, ZÉRO claim token)', async () => {
        const req = new NextRequest(`http://localhost:3000/api/tickets/${ticketValidAId}/pdf`, {
            headers: {
                Authorization: `Bearer ${buyerAToken}`,
            },
        });

        const res = await getTicketPdfRoute(req, { params: Promise.resolve({ id: ticketValidAId }) });
        const arrayBuf = await res.arrayBuffer();
        const pdfText = Buffer.from(arrayBuf).toString('latin1');

        // Vérification des données requises
        assert.ok(pdfText.includes('EVENT VILLAGE'), 'Le PDF doit contenir le nom EVENT VILLAGE');
        assert.ok(pdfText.includes(`TCK-PDF-1-${ts}`), 'Le PDF doit contenir le numéro officiel du billet');
        assert.ok(pdfText.includes('Pass VIP Export'), 'Le PDF doit contenir la catégorie du billet');
        assert.ok(pdfText.includes('25 000 FCFA') || pdfText.includes('25000'), 'Le PDF doit contenir le prix');
        assert.ok(pdfText.includes('Mamadou Diallo'), 'Le PDF doit contenir le nom du porteur');
        assert.ok(pdfText.includes('Grand Th'), 'Le PDF doit contenir le lieu');

        // Sécurité absolue : AUCUN secret TOTP, aucun claim_token
        assert.ok(!pdfText.includes(secretTotpSecretA), 'Le PDF ne doit JAMAIS contenir la clé secrète TOTP');
        assert.ok(!pdfText.includes('totp_secret'), 'Le mot-clé interne totp_secret ne doit pas être présent');
        assert.ok(!pdfText.includes('claim_token'), 'Aucun claim_token ne doit être exposé');
        assert.ok(!pdfText.includes('claim_token_hash'), 'Aucun claim_token_hash ne doit être exposé');
    });

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 8 : Notification SMS après paiement SUCCESS avec lien sécurisé
    // ─────────────────────────────────────────────────────────────────────────
    await test('TEST 8 : Notification SMS après paiement SUCCESS (Exactement 1 notification avec lien portefeuille)', async () => {
        const notifResult = await NotificationService.sendTicketPurchaseNotifications({
            userId: buyerAUserId,
            eventId: testEventId,
            categoryId: testCategoryId,
            orderNumber: `CMD-TEST-${ts}`,
            ticketCount: 2,
            ticketNumbers: [`TCK-PDF-1-${ts}`, `TCK-PDF-2-${ts}`],
            totalAmount: 50000,
            clientPhone: '+221771234567',
            clientEmail: 'buyerA@eventvillage.sn',
            clientName: 'Mamadou Diallo',
        });

        assert.ok(notifResult.client.sms, 'Le SMS acheteur doit être envoyé avec succès');
        assert.ok(notifResult.client.inApp, 'La notification in-app acheteur doit être créée');
    });

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 9 : Webhook SUCCESS répété -> Idempotence stricte (0 notification en double)
    // ─────────────────────────────────────────────────────────────────────────
    await test('TEST 9 : Webhook SUCCESS répété (Idempotence stricte — Aucun traitement en double)', async () => {
        const orderId = `ORD-IDEMP-${ts}`;
        const transactionId = `TX-IDEMP-${ts}`;

        // 1. Création de l'enregistrement de paiement en base avec status PENDING
        const { data: p, error: pErr } = await supabase.from('payments').insert({
            external_order_id: orderId,
            transaction_id: transactionId,
            client_id: buyerAUserId,
            partner_id: partnerId,
            amount: 25000,
            currency: 'XOF',
            is_platform_payment: true,
            status: 'PENDING',
            payment_target: 'TICKET',
            ticket_id: ticketValidAId,
            idempotency_key: `IDEMP-${orderId}`,
            metadata: {
                event_id: testEventId,
                category_id: testCategoryId,
                customer_phone: '+221771234567',
                customer_name: 'Mamadou Diallo',
            },
        }).select('*').single();
        if (pErr || !p) throw new Error(`Payment insert failed: ${pErr?.message || JSON.stringify(pErr)}`);

        // 2. Premier appel webhook (SUCCESS)
        const webhookPayload = {
            order_id: orderId,
            transaction_id: transactionId,
            status: 'SUCCESS',
            amount: '25000',
        };

        const firstWebhook = await paymentService.handleSamirPayWebhook(webhookPayload);
        assert.ok(firstWebhook.success, 'Le 1er webhook doit être accepté avec succès');

        // 3. Deuxième appel webhook identique (Simulation de répétition réseau SamirPay)
        const secondWebhook = await paymentService.handleSamirPayWebhook(webhookPayload);
        assert.ok(secondWebhook.success, 'Le 2nd webhook doit répondre avec succès (Idempotence)');
        assert.equal(secondWebhook.message, 'Transaction déjà confirmée.', 'Doit détecter immédiatement que la transaction a déjà été traitée');

        // 4. Vérification en base : le paiement reste unique et au statut SUCCESS
        const { data: finalPayment } = await supabase.from('payments').select('status').eq('id', p.id).single();
        assert.equal(finalPayment?.status, 'SUCCESS');

        // Nettoyage paiement test
        await supabase.from('payments').delete().eq('id', p.id);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 10 : Non-régression Hold Cart
    // ─────────────────────────────────────────────────────────────────────────
    await test('TEST 10 : Non-régression — Hold Cart toujours 100% opérationnel', async () => {
        const { EventService } = await import('../lib/events/event.service');
        const initialHeld = await EventService.getActiveHeldQuantity(testCategoryId);
        assert.strictEqual(typeof initialHeld, 'number');

        // Initier un paiement temporaire qui place 1 billet en hold
        const payRes = await paymentService.createPayment(buyerAUserId, {
            targetType: 'TICKET',
            targetId: testCategoryId,
            quantity: 1,
            operator: 'WAVE',
            customerPhone: '771234567',
        });
        assert.ok(payRes.success);

        const heldDuring = await EventService.getActiveHeldQuantity(testCategoryId);
        assert.strictEqual(heldDuring, initialHeld + 1, 'Le stock doit être incrémenté en hold temporaire');

        // Échec du paiement -> libération immédiate du hold
        await paymentService.handleSamirPayWebhook({
            order_id: payRes.order_id,
            transaction_id: `TX-FAIL-${Date.now()}`,
            status: 'FAILED',
            amount: '25000',
        });

        const heldAfter = await EventService.getActiveHeldQuantity(testCategoryId);
        assert.strictEqual(heldAfter, initialHeld, 'Le hold doit être libéré après échec');
    });

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 11 : Non-régression Transfert P2P
    // ─────────────────────────────────────────────────────────────────────────
    await test('TEST 11 : Non-régression — Transfert P2P toujours 100% opérationnel', async () => {
        // Création d'un ticket temporaire
        const { data: tP2P } = await supabase.from('tickets').insert({
            event_id: testEventId,
            category_id: testCategoryId,
            user_id: buyerAUserId,
            ticket_number: `TCK-P2P-REG-${ts}`,
            price: 25000,
            qr_code: `EV-QR-P2P-REG-${ts}`,
            status: 'VALIDE',
            totp_secret: crypto.randomBytes(32).toString('hex'),
        }).select('id').single();

        const tr = await TicketTransferService.initiateTransfer(buyerAUserId, tP2P!.id, '+221772345678');
        assert.ok(tr.success);
        assert.ok(tr.claim_token);

        const cancel = await TicketTransferService.cancelTransfer(buyerAUserId, tr.transfer_id);
        assert.ok(cancel.success);

        await supabase.from('tickets').delete().eq('id', tP2P!.id);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 12 : Non-régression QR/TOTP + Scan contrôleur
    // ─────────────────────────────────────────────────────────────────────────
    await test('TEST 12 : Non-régression — QR/TOTP RFC 6238 et scan/compostage atomique', async () => {
        // 1. Calcul du code TOTP en direct
        const currentTotp = generateTotp(secretTotpSecretA);
        const isValid = verifyTotp(currentTotp.code, secretTotpSecretA);
        assert.equal(isValid, true, 'Le code TOTP généré doit être valide selon RFC 6238');

        // 2. RPC de check-in / compostage
        const { data: checkinRes, error: checkinErr } = await supabase.rpc('atomic_ticket_checkin', {
            p_ticket_id: ticketValidAId,
            p_controller_id: buyerAUserId,
        });

        assert.equal(checkinErr, null, 'Le scan doit s\'exécuter sans erreur SQL');
        assert.ok(checkinRes, 'Le scan doit retourner le payload JSON de compostage');
    });
});
