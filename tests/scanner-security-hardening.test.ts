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
import { POST as controllerScanRoute } from '../app/api/controller/scan/route';
import { POST as partnerInviteRoute } from '../app/api/partner/team/invite/route';
import { RateLimiter } from '../lib/security/rate-limiter';
import {
    generateTotp,
    verifyTotp,
    buildDynamicQrPayload,
    deriveTicketTotpSecret,
    TOTP_STEP_SECONDS,
} from '../lib/security/totp';
import {
    CAMERA_SCAN_THROTTLE_MS,
    CAMERA_INACTIVITY_TIMEOUT_MS,
} from '../components/scan/CameraQrScanner';
import { setTorchState } from '../lib/hardware/torch';

describe('SCANNER SECURITY HARDENING & QUICK WINS TEST SUITE', async () => {
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
    let eventId: string;
    let categoryId: string;
    const createdTickets: any[] = [];

    before(async () => {
        // Authentifier le partenaire
        const { data: pUser } = await supabase.from('users').select('email').eq('id', partnerUserId).single();
        await supabase.auth.admin.updateUserById(partnerUserId, { password: 'Password123!' });
        const { data: pAuth } = await publicAuth.auth.signInWithPassword({
            email: pUser?.email || 'partenaireA@test.com',
            password: 'Password123!',
        });
        partnerToken = pAuth?.session?.access_token!;
        assert.ok(partnerToken, 'Token Partenaire obtenu');

        // Authentifier le contrôleur
        const { data: cUser } = await supabase.from('users').select('email').eq('id', ctrlUserId).single();
        await supabase.auth.admin.updateUserById(ctrlUserId, { password: 'Password123!' });
        const { data: cAuth } = await publicAuth.auth.signInWithPassword({
            email: cUser?.email!,
            password: 'Password123!',
        });
        ctrlToken = cAuth?.session?.access_token!;
        assert.ok(ctrlToken, 'Token Contrôleur obtenu');

        // Assurer statut actif
        await supabase.from('users').update({ role: 'CONTROLEUR', status: 'ACTIF' }).eq('id', ctrlUserId);

        // Créer un événement de test pour le scan
        const todayStr = new Date().toISOString().split('T')[0];
        const { data: ev, error: evErr } = await supabase.from('events').insert({
            partner_id: partnerId,
            title: `Festival Hardening ${ts}`,
            slug: `festival-hardening-${ts}`,
            start_date: todayStr,
            start_time: '00:00:00',
            end_date: todayStr,
            end_time: '23:59:59',
            location: 'Grand Théâtre National',
            status: 'PUBLIE',
        }).select().single();
        if (evErr || !ev) throw new Error(`Erreur creation event: ${evErr?.message}`);
        eventId = ev.id;

        // Créer une catégorie de billets
        const { data: cat, error: catErr } = await supabase.from('ticket_categories').insert({
            event_id: eventId,
            name: 'Pass VIP Hardening',
            price: 15000,
            total_quantity: 100,
        }).select().single();
        if (catErr || !cat) throw new Error(`Erreur creation categorie: ${catErr?.message}`);
        categoryId = cat.id;

        // Assigner le contrôleur à l'événement
        await supabase.from('event_controllers').upsert({
            event_id: eventId,
            user_id: ctrlUserId,
            can_accept_cash: true,
            created_by: partnerUserId,
        }, { onConflict: 'event_id,user_id' });

        // Créer plusieurs billets pour les tests
        for (let i = 1; i <= 10; i++) {
            const ticketNum = `TCK-HARD-${ts}-${i}`;
            const qrVal = `EV-HARD-${ts}-${i}`;
            const { data: tck, error: tckErr } = await supabase.from('tickets').insert({
                ticket_number: ticketNum,
                qr_code: qrVal,
                event_id: eventId,
                category_id: categoryId,
                user_id: clientUserId,
                price: 15000,
                status: 'VALIDE',
            }).select().single();
            if (tckErr || !tck) throw new Error(`Erreur creation ticket: ${tckErr?.message}`);
            createdTickets.push(tck);
        }

        // Nettoyer les rate limits de test
        await RateLimiter.resetAttempts(`controller_scan:${ctrlUserId}`);
        await RateLimiter.resetAttempts(`sms_daily_quota_partner:${partnerUserId}`);
        await RateLimiter.resetAttempts(`sms_invite_partner:${partnerUserId}`);
    });

    after(async () => {
        // Nettoyage
        await RateLimiter.resetAttempts(`controller_scan:${ctrlUserId}`);
        await RateLimiter.resetAttempts(`sms_daily_quota_partner:${partnerUserId}`);
        await RateLimiter.resetAttempts(`sms_invite_partner:${partnerUserId}`);

        if (createdTickets.length > 0) {
            await supabase.from('tickets').delete().in('id', createdTickets.map(t => t.id));
        }
        if (categoryId) {
            await supabase.from('ticket_categories').delete().eq('id', categoryId);
        }
        if (eventId) {
            await supabase.from('event_controllers').delete().eq('event_id', eventId);
            await supabase.from('events').delete().eq('id', eventId);
        }
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // QUICK WIN 1 : Rate limiting sur POST /api/controller/scan (5 req/s par contrôleur, 429 au-delà)
    // ─────────────────────────────────────────────────────────────────────────────
    await test('1. Rate limiting sur POST /api/controller/scan — Rafale concurrente via Promise.allSettled()', async () => {
        await RateLimiter.resetAttempts(`controller_scan:${ctrlUserId}`);

        // Envoi d'une rafale de 8 requêtes SIMULTANÉES avec Promise.allSettled
        const burstPromises = Array.from({ length: 8 }, (_, i) => {
            const ticket = createdTickets[i % createdTickets.length];
            const secret = deriveTicketTotpSecret(ticket.id);
            const { code } = generateTotp(secret);
            const dynamicQr = buildDynamicQrPayload(ticket.ticket_number, code);

            const req = new NextRequest('http://localhost:3000/api/controller/scan', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${ctrlToken}`,
                },
                body: JSON.stringify({ qr_code: dynamicQr }),
            });
            return controllerScanRoute(req);
        });

        const burstResults = await Promise.allSettled(burstPromises);
        const statusCodes = [];

        for (const res of burstResults) {
            assert.equal(res.status, 'fulfilled');
            if (res.status === 'fulfilled') {
                statusCodes.push(res.value.status);
            }
        }

        const count429 = statusCodes.filter(s => s === 429).length;
        const countNon429 = statusCodes.filter(s => s !== 429).length;

        console.log(`   Burst stats : total=${statusCodes.length}, allowed=${countNon429}, rate_limited(429)=${count429}`);
        assert.ok(count429 > 0, `Au moins une requête doit être rejetée avec 429 (obtenu: ${count429}/8)`);
        assert.ok(countNon429 <= 5, `Au maximum 5 requêtes doivent être autorisées par seconde (obtenu: ${countNon429})`);
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // QUICK WIN 2 : Optimisation des requêtes statistiques (évite double COUNT(*) lourd)
    // ─────────────────────────────────────────────────────────────────────────────
    await test('2. Optimisation des requêtes statistiques — Retourne les stats légères sans overhead COUNT(*)', async () => {
        await RateLimiter.resetAttempts(`controller_scan:${ctrlUserId}`);

        // Créer un billet frais non encore utilisé
        const ticketNum = `TCK-STATS-OPT-${ts}`;
        const { data: freshTicket, error: ftErr } = await supabase.from('tickets').insert({
            ticket_number: ticketNum,
            qr_code: `EV-STATS-${ts}`,
            event_id: eventId,
            category_id: categoryId,
            user_id: clientUserId,
            price: 15000,
            status: 'VALIDE',
        }).select().single();
        if (ftErr || !freshTicket) throw new Error(`Erreur creation fresh ticket: ${ftErr?.message}`);
        createdTickets.push(freshTicket);

        const secret = deriveTicketTotpSecret(freshTicket.id);
        const { code } = generateTotp(secret);
        const dynamicQr = buildDynamicQrPayload(freshTicket.ticket_number, code);

        const startMs = Date.now();
        const req = new NextRequest('http://localhost:3000/api/controller/scan', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${ctrlToken}`,
            },
            body: JSON.stringify({ qr_code: dynamicQr }),
        });

        const res = await controllerScanRoute(req);
        const durationMs = Date.now() - startMs;
        const data = await res.json();

        assert.equal(res.status, 200);
        assert.equal(data.scan_result, 'valid');
        assert.ok(data.stats, 'Le champ stats doit être présent');
        assert.ok(typeof data.stats.scanned_today === 'number', 'scanned_today doit être un nombre');
        console.log(`   Scan validé avec stats optimisées en ${durationMs}ms (scanned_today: ${data.stats.scanned_today})`);
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // QUICK WIN 3 : Tolérance TOTP élargie à ±40s (toleranceWindows: 2) & Rejet screenshot WhatsApp
    // ─────────────────────────────────────────────────────────────────────────────
    await test('3. Tolérance TOTP élargie à ±40s — Valide à T+30s (latence 3G/horloge) et REJETÉ à T+70s (capture WhatsApp)', async () => {
        const testSecret = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
        const nowSec = Math.floor(Date.now() / 1000);

        // 1. Code généré à T = 0
        const { code: generatedCode } = generateTotp(testSecret, nowSec, TOTP_STEP_SECONDS);

        // 2. Vérification immédiate à T = 0 (step delta 0) -> VALIDE
        const isValidAtT0 = verifyTotp(generatedCode, testSecret, {
            timestampSeconds: nowSec,
            toleranceWindows: 2,
            stepSeconds: TOTP_STEP_SECONDS,
        });
        assert.equal(isValidAtT0, true, 'Code valide immédiatement à T = 0');

        // 3. Vérification à T + 30s (latence réseau / léger décalage horloge, delta ~ 1 à 2 steps) -> VALIDE avec ±40s
        const isValidAtT30 = verifyTotp(generatedCode, testSecret, {
            timestampSeconds: nowSec + 30,
            toleranceWindows: 2,
            stepSeconds: TOTP_STEP_SECONDS,
        });
        assert.equal(isValidAtT30, true, 'Code toujours valide à T + 30s sous tolérance ±40s (réseau mobile)');

        // 4. Capture d'écran WhatsApp transmise : scannée à T + 70s (delta > 3 steps) -> REJET STRICT
        const isValidAtT70 = verifyTotp(generatedCode, testSecret, {
            timestampSeconds: nowSec + 70,
            toleranceWindows: 2,
            stepSeconds: TOTP_STEP_SECONDS,
        });
        assert.equal(isValidAtT70, false, 'Capture WhatsApp à T + 70s STRICTEMENT REJETÉE (> 40s)');

        // 5. Capture d'écran WhatsApp scannée à T + 120s (2 minutes après) -> REJET STRICT
        const isValidAtT120 = verifyTotp(generatedCode, testSecret, {
            timestampSeconds: nowSec + 120,
            toleranceWindows: 2,
            stepSeconds: TOTP_STEP_SECONDS,
        });
        assert.equal(isValidAtT120, false, 'Capture WhatsApp à T + 120s STRICTEMENT REJETÉE');
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // QUICK WIN 4 : Throttling scan caméra (120-150ms) + Veille 45s + Coupure Torche
    // ─────────────────────────────────────────────────────────────────────────────
    await test('4. Ergonomie Caméra & Hardware — Throttling (140ms), mise en veille 45s et extinction torche', async () => {
        // 1. Constantes de performance et d'économie de batterie
        assert.ok(
            CAMERA_SCAN_THROTTLE_MS >= 120 && CAMERA_SCAN_THROTTLE_MS <= 150,
            `CAMERA_SCAN_THROTTLE_MS (${CAMERA_SCAN_THROTTLE_MS}ms) doit être entre 120ms et 150ms`
        );
        assert.equal(
            CAMERA_INACTIVITY_TIMEOUT_MS,
            45000,
            'CAMERA_INACTIVITY_TIMEOUT_MS doit être exactement 45 000 ms (45s)'
        );

        // 2. Vérification de la coupure de la torche
        let appliedConstraints: any = null;
        const mockTrack = {
            applyConstraints: async (c: any) => {
                appliedConstraints = c;
            },
            getCapabilities: () => ({ torch: true }),
        } as unknown as MediaStreamTrack;

        // Allumer la torche
        const turnOnRes = await setTorchState(mockTrack, true);
        assert.equal(turnOnRes.success, true);
        assert.equal(appliedConstraints?.advanced?.[0]?.torch, true);

        // Éteindre la torche (mise en veille / unmount)
        const turnOffRes = await setTorchState(mockTrack, false);
        assert.equal(turnOffRes.success, true);
        assert.equal(appliedConstraints?.advanced?.[0]?.torch, false);

        console.log(`   Hardware checks : Throttling=${CAMERA_SCAN_THROTTLE_MS}ms, SleepTimeout=${CAMERA_INACTIVITY_TIMEOUT_MS}ms, TorchExtinguish=OK`);
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // QUICK WIN 5 : Quota SMS journalier par partenaire (20 SMS / 24h)
    // ─────────────────────────────────────────────────────────────────────────────
    await test('5. Quota SMS journalier par partenaire (20/24h) — Blocage 429 dès dépassement du quota', async () => {
        const partnerDailyRateKey = `sms_daily_quota_partner:${partnerUserId}`;
        await RateLimiter.resetAttempts(partnerDailyRateKey);

        // Simuler l'enregistrement de 20 invitations envoyées dans les dernières 24h
        for (let i = 0; i < 20; i++) {
            await RateLimiter.recordAttempt(partnerDailyRateKey);
        }

        // Vérifier que le rate limiter déclare le quota dépassé
        const limitCheck = await RateLimiter.isRateLimited(partnerDailyRateKey, {
            maxAttempts: 20,
            windowSeconds: 86400,
            lockoutSeconds: 86400,
            failClosed: true,
        });
        assert.equal(limitCheck.limited, true, 'Le quota journalier doit être limité après 20 tentatives');

        // Tester l'appel API qui doit retourner 429 et PARTNER_DAILY_SMS_QUOTA_EXCEEDED
        const req = new NextRequest('http://localhost:3000/api/partner/team/invite', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${partnerToken}`,
            },
            body: JSON.stringify({
                event_ids: [eventId],
                phone: '+221770009999',
                first_name: 'Test',
                last_name: 'Quota',
            }),
        });

        const res = await partnerInviteRoute(req);
        const data = await res.json();

        assert.equal(res.status, 429);
        assert.equal(data.code, 'PARTNER_DAILY_SMS_QUOTA_EXCEEDED');
        console.log(`   Quota journalier 20 SMS/24h atteint : statut=${res.status}, code=${data.code}`);
    });
});
