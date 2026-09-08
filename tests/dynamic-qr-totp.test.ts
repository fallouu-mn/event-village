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
import { POST as controllerScan } from '../app/api/controller/scan/route';
import { POST as verifyTicket } from '../app/api/tickets/verify/route';
import { GET as getLiveCode } from '../app/api/tickets/[id]/live-code/route';
import {
    generateTotp,
    verifyTotp,
    buildDynamicQrPayload,
    parseDynamicQrPayload,
    deriveTicketTotpSecret,
    TOTP_STEP_SECONDS,
} from '../lib/security/totp';

describe('ANTI-FRAUDE QR CODE DYNAMIQUE (TOTP RFC 6238 — PRE-MORTEM §1.2)', async () => {
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
    let eventId: string;
    let catId: string;

    const createdTicketIds: string[] = [];

    before(async () => {
        // 1. Obtenir les jetons d'accès
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
        partnerToken = pAuth?.session?.access_token!;
        assert.ok(partnerToken, 'Token Partenaire obtenu');

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
        ctrlToken = cAuth?.session?.access_token!;
        assert.ok(ctrlToken, 'Token Contrôleur obtenu');

        const { data: clAuthUser } = await supabase.auth.admin.getUserById(clientUserId);
        const clEmail = clAuthUser?.user?.email || 'clientA@test.com';
        await supabase.from('users').update({ status: 'ACTIF', role: 'CLIENT', phone: '221771234567' }).eq('id', clientUserId);
        await supabase.from('user_roles').delete().eq('user_id', clientUserId);
        await supabase.from('user_roles').insert({ user_id: clientUserId, role: 'CLIENT' });
        await supabase.auth.admin.updateUserById(clientUserId, { password: 'Password123!', email_confirm: true, user_metadata: { role: 'CLIENT' } });
        const { data: clAuth } = await publicAuth.auth.signInWithPassword({
            email: clEmail,
            password: 'Password123!',
        });
        clientToken = clAuth?.session?.access_token!;
        assert.ok(clientToken, 'Token Client obtenu');

        // Configurer l'utilisateur client avec nom et prénom pour test d'identité
        await supabase.from('users').update({
            first_name: 'Moussa',
            last_name: 'Diop',
            role: 'CLIENT',
            status: 'ACTIF',
        }).eq('id', clientUserId);

        // 2. Créer un événement publié de test
        const { data: event, error: evErr } = await supabase.from('events').insert({
            partner_id: partnerId,
            title: `Festival Anti-Fraude TOTP ${ts}`,
            slug: `festival-anti-fraude-${ts}`,
            start_date: '2026-12-31',
            start_time: '21:00:00',
            location: 'Esplanade Monument de la Renaissance',
            status: 'PUBLIE',
        }).select().single();
        if (evErr) throw evErr;
        eventId = event.id;

        // 3. Créer une catégorie de billets
        const { data: cat, error: catErr } = await supabase.from('ticket_categories').insert({
            event_id: eventId,
            name: `Pass Festival VIP ${ts}`,
            price: 15000,
            total_quantity: 50,
        }).select().single();
        if (catErr) throw catErr;
        catId = cat.id;

        // 4. Affecter le contrôleur à l'événement
        await supabase.from('event_controllers').insert({
            user_id: ctrlUserId,
            event_id: eventId,
            can_accept_cash: true,
            created_by: partnerUserId,
        });
    });

    after(async () => {
        // Nettoyage DB complet
        if (createdTicketIds.length > 0) {
            await supabase.from('tickets').delete().in('id', createdTicketIds);
        }
        await supabase.from('tickets').delete().eq('event_id', eventId);
        await supabase.from('event_controllers').delete().eq('event_id', eventId);
        await supabase.from('ticket_categories').delete().eq('id', catId);
        await supabase.from('events').delete().eq('id', eventId);
    });

    // Helper pour créer un billet
    async function createTestTicket(suffix: string) {
        const ticketNumber = `TCK-${ts}-${suffix}`;
        const qrCode = `EV-QR-${ts}-${suffix}`;
        const { data: ticket, error } = await supabase.from('tickets').insert({
            event_id: eventId,
            category_id: catId,
            user_id: clientUserId,
            ticket_number: ticketNumber,
            qr_code: qrCode,
            price: 15000,
            status: 'VALIDE',
        }).select().single();

        if (error || !ticket) throw new Error(`Erreur création ticket: ${error?.message}`);
        createdTicketIds.push(ticket.id);
        return ticket;
    }

    // ─────────────────────────────────────────────────────────────
    // TEST 1 : Scan d'un Billet avec QR Code Dynamique Valide (TOTP)
    // ─────────────────────────────────────────────────────────────
    await test('1. Scan d\'un Billet avec QR Code Dynamique Valide (TOTP RFC 6238)', async () => {
        const ticket = await createTestTicket('T1');

        // Appel client à l'endpoint /api/tickets/[id]/live-code
        const liveReq = new NextRequest(`http://localhost:3000/api/tickets/${ticket.id}/live-code`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${clientToken}` },
        });
        const liveRes = await getLiveCode(liveReq, { params: { id: ticket.id } });
        assert.equal(liveRes.status, 200);
        const liveData = await liveRes.json();

        assert.equal(liveData.success, true);
        assert.ok(liveData.qr_payload.startsWith('EVT1:'));
        assert.equal(liveData.totp_code.length, 6);
        assert.ok(liveData.expires_in >= 1 && liveData.expires_in <= 20);

        // Scan par le contrôleur
        const scanReq = new NextRequest('http://localhost:3000/api/controller/scan', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${ctrlToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ qr_code: liveData.qr_payload }),
        });

        const scanRes = await controllerScan(scanReq);
        assert.equal(scanRes.status, 200);
        const scanData = await scanRes.json();

        assert.equal(scanData.scan_result, 'valid');
        assert.equal(scanData.ticket_info.ticket_number, ticket.ticket_number);
        assert.equal(scanData.ticket_info.holder_name, 'Moussa Diop');

        // Vérification persistance DB : statut UTILISE
        const { data: dbTicket } = await supabase.from('tickets').select('status, checked_in_by').eq('id', ticket.id).single();
        assert.equal(dbTicket?.status, 'UTILISE');
        assert.equal(dbTicket?.checked_in_by, ctrlUserId);

        // Deuxième scan immédiat : rejet already_used
        const secondReq = new NextRequest('http://localhost:3000/api/controller/scan', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${ctrlToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ qr_code: liveData.qr_payload }),
        });
        const secondRes = await controllerScan(secondReq);
        const secondData = await secondRes.json();
        assert.equal(secondData.scan_result, 'already_used');
    });

    // ─────────────────────────────────────────────────────────────
    // TEST 2 : Rejet Immédiat d'un QR Code Expiré (> 40s d'ancienneté)
    // ─────────────────────────────────────────────────────────────
    await test('2. Rejet Immédiat d\'un QR Code Expiré (> 40s d\'ancienneté)', async () => {
        const ticket = await createTestTicket('T2');

        // Générer un code TOTP expiré (ancienneté de 70 secondes = au-delà de la tolérance ±40s / 2 pas)
        const secret = deriveTicketTotpSecret(ticket.id);
        const expiredTimestamp = Date.now() - 70000;
        const { code: expiredTotp } = generateTotp(secret, expiredTimestamp, TOTP_STEP_SECONDS);

        const expiredPayload = buildDynamicQrPayload(ticket.qr_code, expiredTotp);

        const scanReq = new NextRequest('http://localhost:3000/api/controller/scan', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${ctrlToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ qr_code: expiredPayload }),
        });

        const scanRes = await controllerScan(scanReq);
        assert.equal(scanRes.status, 400);
        const scanData = await scanRes.json();

        assert.equal(scanData.scan_result, 'qr_expired');
        assert.equal(scanData.code, 'QR_EXPIRED');
        assert.match(scanData.message, /QR Code expiré/i);

        // Vérification DB : le billet doit rester strictement VALIDE (non composté)
        const { data: dbTicket } = await supabase.from('tickets').select('status, checked_in_at').eq('id', ticket.id).single();
        assert.equal(dbTicket?.status, 'VALIDE');
        assert.equal(dbTicket?.checked_in_at, null);
    });

    // ─────────────────────────────────────────────────────────────
    // TEST 3 : REPRODUCTION PRÉ-MORTEM §1.2 — Capture WhatsApp vs Billet Live
    // ─────────────────────────────────────────────────────────────
    await test('3. Anti-Fraude Pre-Mortem §1.2 : Screenshot WhatsApp rejeté (T+70s) vs Billet Live accepté', async () => {
        const ticket = await createTestTicket('T3');
        const secret = deriveTicketTotpSecret(ticket.id);

        const t0 = Date.now();
        // Étape 1 : Le client A génère son QR Code à l'instant T0 et prend un screenshot
        const { code: totpAtT0 } = generateTotp(secret, t0, TOTP_STEP_SECONDS);
        const whatsappScreenshotPayload = buildDynamicQrPayload(ticket.qr_code, totpAtT0);

        // Étape 2 : Le complice Fraudeur B présente le screenshot WhatsApp à T0 + 70 secondes
        // (au-delà du pas de 20s et de la tolérance ±2 fenêtres de 20s = 40s)
        const t70 = t0 + 70000;
        const isScreenshotValidAtT70 = verifyTotp(totpAtT0, secret, {
            toleranceWindows: 2,
            stepSeconds: TOTP_STEP_SECONDS,
            timestamp: t70,
        });
        assert.equal(isScreenshotValidAtT70, false, 'Le code TOTP du screenshot WhatsApp doit être invalide à T0 + 70s (> 40s)');

        // Envoi au contrôleur du payload WhatsApp expiré
        const scanFraudReq = new NextRequest('http://localhost:3000/api/controller/scan', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${ctrlToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                qr_code: buildDynamicQrPayload(
                    ticket.qr_code,
                    generateTotp(secret, Date.now() - 70000, TOTP_STEP_SECONDS).code
                ),
            }),
        });

        const scanFraudRes = await controllerScan(scanFraudReq);
        assert.equal(scanFraudRes.status, 400);
        const scanFraudData = await scanFraudRes.json();
        assert.equal(scanFraudData.scan_result, 'qr_expired');
        assert.equal(scanFraudData.code, 'QR_EXPIRED');

        // Billet toujours VALIDE en base : le fraudeur n'a pas pu consommer l'entrée
        const { data: ticketAfterFraudAttempt } = await supabase.from('tickets').select('status').eq('id', ticket.id).single();
        assert.equal(ticketAfterFraudAttempt?.status, 'VALIDE');

        // Étape 3 : Le vrai Client A arrive avec son smartphone et l'application en direct (Live Code rafraîchi)
        const { code: liveTotpCode } = generateTotp(secret, Date.now(), TOTP_STEP_SECONDS);
        const livePayload = buildDynamicQrPayload(ticket.qr_code, liveTotpCode);

        const scanLegitReq = new NextRequest('http://localhost:3000/api/controller/scan', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${ctrlToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ qr_code: livePayload }),
        });

        const scanLegitRes = await controllerScan(scanLegitReq);
        assert.equal(scanLegitRes.status, 200);
        const scanLegitData = await scanLegitRes.json();
        assert.equal(scanLegitData.scan_result, 'valid');

        // Le billet est désormais officiellement composté par le vrai porteur
        const { data: ticketFinallyUsed } = await supabase.from('tickets').select('status').eq('id', ticket.id).single();
        assert.equal(ticketFinallyUsed?.status, 'UTILISE');
    });

    // ─────────────────────────────────────────────────────────────
    // TEST 4 : Concurrence Réelle & Double-Scan Simultané (Promise.allSettled)
    // ─────────────────────────────────────────────────────────────
    await test('4. Concurrence Réelle (R4) : 2 contrôleurs scannent le même QR dynamique à la même milliseconde', async () => {
        const ticket = await createTestTicket('T4');
        const secret = deriveTicketTotpSecret(ticket.id);
        const { code } = generateTotp(secret, Date.now(), TOTP_STEP_SECONDS);
        const payload = buildDynamicQrPayload(ticket.qr_code, code);

        const req1 = new NextRequest('http://localhost:3000/api/controller/scan', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${ctrlToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ qr_code: payload }),
        });

        const req2 = new NextRequest('http://localhost:3000/api/controller/scan', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${ctrlToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ qr_code: payload }),
        });

        const results = await Promise.allSettled([
            controllerScan(req1).then(r => r.json()),
            controllerScan(req2).then(r => r.json()),
        ]);

        const responses = results.map(r => r.status === 'fulfilled' ? r.value : null);
        const scanResults = responses.map(r => r?.scan_result);

        // Exactement 1 succès 'valid' et 1 rejet 'already_used'
        assert.equal(scanResults.filter(r => r === 'valid').length, 1);
        assert.equal(scanResults.filter(r => r === 'already_used').length, 1);

        // Vérification de l'unicité du compostage en base de données
        const { data: dbTicket } = await supabase.from('tickets').select('status').eq('id', ticket.id).single();
        assert.equal(dbTicket?.status, 'UTILISE');
    });

    // ─────────────────────────────────────────────────────────────
    // TEST 5 : Tolérance d'Horloge & Dérive Temporelle (±1 Pas de 20s)
    // ─────────────────────────────────────────────────────────────
    await test('5. Tolérance Dérive Temporelle (±1 pas = 20s) & Rejet Hors Fenêtre', async () => {
        const ticket = await createTestTicket('T5');
        const secret = deriveTicketTotpSecret(ticket.id);

        const now = Date.now();

        // Jeton à T - 15 secondes (fenêtre précédente / début de cycle) -> DOIT ÊTRE ACCEPTÉ
        const { code: codeMinus15 } = generateTotp(secret, now - 15000, TOTP_STEP_SECONDS);
        assert.equal(
            verifyTotp(codeMinus15, secret, { toleranceWindows: 1, stepSeconds: TOTP_STEP_SECONDS, timestamp: now }),
            true,
            'Jeton à -15s doit être accepté (dans la tolérance ±1 fenêtre)'
        );

        // Jeton à T + 15 secondes (légère avance d'horloge contrôleur) -> DOIT ÊTRE ACCEPTÉ
        const { code: codePlus15 } = generateTotp(secret, now + 15000, TOTP_STEP_SECONDS);
        assert.equal(
            verifyTotp(codePlus15, secret, { toleranceWindows: 1, stepSeconds: TOTP_STEP_SECONDS, timestamp: now }),
            true,
            'Jeton à +15s doit être accepté (tolérance avance)'
        );

        // Jeton à T - 65 secondes (3 pas complets d'ancienneté) -> DOIT ÊTRE STRICTEMENT REJETÉ
        const { code: codeMinus65 } = generateTotp(secret, now - 65000, TOTP_STEP_SECONDS);
        assert.equal(
            verifyTotp(codeMinus65, secret, { toleranceWindows: 1, stepSeconds: TOTP_STEP_SECONDS, timestamp: now }),
            false,
            'Jeton à -65s doit être refusé'
        );
    });

    // ─────────────────────────────────────────────────────────────
    // TEST 6 : Saisie Manuelle (Fallback d'urgence avec contrôle visuel d'identité)
    // ─────────────────────────────────────────────────────────────
    await test('6. Saisie Manuelle Fallback : Numéro statique accepté avec identité du porteur', async () => {
        const ticket = await createTestTicket('T6');

        // Saisie manuelle directe du ticket_number (TCK-...) sans QR dynamique
        const scanReq = new NextRequest('http://localhost:3000/api/controller/scan', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${ctrlToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ qr_code: ticket.ticket_number }),
        });

        const scanRes = await controllerScan(scanReq);
        assert.equal(scanRes.status, 200);
        const scanData = await scanRes.json();

        assert.equal(scanData.scan_result, 'valid');
        assert.equal(scanData.ticket_info.is_manual_entry, true);
        assert.equal(scanData.ticket_info.holder_name, 'Moussa Diop');

        // Vérification en base
        const { data: dbTicket } = await supabase.from('tickets').select('status').eq('id', ticket.id).single();
        assert.equal(dbTicket?.status, 'UTILISE');
    });

    // ─────────────────────────────────────────────────────────────
    // TEST 7 : Vérification via /api/tickets/verify (Mode Borne / Partenaire)
    // ─────────────────────────────────────────────────────────────
    await test('7. Route /api/tickets/verify : Détection et validation du QR dynamique', async () => {
        const ticket = await createTestTicket('T7');
        const secret = deriveTicketTotpSecret(ticket.id);
        const { code: liveCode } = generateTotp(secret, Date.now(), TOTP_STEP_SECONDS);
        const payload = buildDynamicQrPayload(ticket.qr_code, liveCode);

        // 1. Scan valide
        const verifyReq = new NextRequest('http://localhost:3000/api/tickets/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ qrCode: payload }),
        });

        const verifyRes = await verifyTicket(verifyReq);
        assert.equal(verifyRes.status, 200);
        const verifyData = await verifyRes.json();
        assert.equal(verifyData.status, 'valid');
        assert.equal(verifyData.ticketInfo.holderName, 'Moussa Diop');

        // 2. Scan avec code expiré sur /api/tickets/verify
        const ticketExpired = await createTestTicket('T7_EXP');
        const expSecret = deriveTicketTotpSecret(ticketExpired.id);
        const { code: expCode } = generateTotp(expSecret, Date.now() - 50000, TOTP_STEP_SECONDS);
        const expPayload = buildDynamicQrPayload(ticketExpired.qr_code, expCode);

        const expReq = new NextRequest('http://localhost:3000/api/tickets/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ qrCode: expPayload }),
        });

        const expRes = await verifyTicket(expReq);
        assert.equal(expRes.status, 400);
        const expData = await expRes.json();
        assert.equal(expData.status, 'qr_expired');
        assert.equal(expData.code, 'QR_EXPIRED');
    });
});
