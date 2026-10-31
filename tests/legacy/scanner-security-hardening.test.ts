import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

// [lot 0] Chargement de .env.local supprimé : l'environnement de test (.env.test, instance Supabase locale)
// et le garde-fou anti-base réelle sont fournis par tests/helpers/env.ts.
import '../helpers/env';

import { getServiceRoleClient } from '../../lib/supabase/server';
import {
    CAMERA_SCAN_THROTTLE_MS,
    CAMERA_INACTIVITY_TIMEOUT_MS,
} from '../../components/scan/CameraQrScanner';
import { setTorchState } from '../../lib/hardware/torch';

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
        await supabase.auth.admin.updateUserById(partnerUserId, { password: process.env.LEGACY_TEST_PASSWORD! });
        const { data: pAuth } = await publicAuth.auth.signInWithPassword({
            email: pUser?.email || 'partenaireA@test.com',
            password: process.env.LEGACY_TEST_PASSWORD!,
        });
        partnerToken = pAuth?.session?.access_token!;
        assert.ok(partnerToken, 'Token Partenaire obtenu');

        // Authentifier le contrôleur
        const { data: cUser } = await supabase.from('users').select('email').eq('id', ctrlUserId).single();
        await supabase.auth.admin.updateUserById(ctrlUserId, { password: process.env.LEGACY_TEST_PASSWORD! });
        const { data: cAuth } = await publicAuth.auth.signInWithPassword({
            email: cUser?.email!,
            password: process.env.LEGACY_TEST_PASSWORD!,
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
        // [lot 4] Remise à zéro par RateLimiter retirée (lib/security/rate-limiter.ts supprimé) : aucun cas conservé
        // n'appelle plus le scan ni l'invitation.
    });

    after(async () => {
        // Nettoyage
        // [lot 4] Remise à zéro par RateLimiter retirée (voir before()).

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

    // [lot 4 — cas supprimé] 1. Rate limiting sur POST /api/controller/scan (rafale) : RateLimiter et ancien code dynamique (deriveTicketTotpSecret, generateTotp, buildDynamicQrPayload) supprimés, quota en base SCAN_PER_SCANNER_10S ; couvert par tests/parcours/acces-limiteurs.test.ts (rafale → 429 rate_limited, compteur en base)
    // [lot 4 — cas supprimé] 2. Optimisation des requêtes statistiques : RateLimiter et ancien code dynamique supprimés ; la réponse du scan n'a plus de champ stats (scanned_today) ; compostage couvert par tests/parcours/acces-scan.test.ts ; non couvert : statistiques du scanneur
    // [lot 4 — cas supprimé] 3. Tolérance TOTP élargie à ±40s : generateTotp et verifyTotp supprimés, la tolérance est désormais de ±1 pas de 20 s ; couvert par tests/parcours/acces-totp.test.ts (verifyTicketCode, code de plus de 40 s refusé)

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

    // [lot 4 — cas supprimé] 5. Quota SMS journalier par partenaire (20/24h) : RateLimiter.recordAttempt et isRateLimited supprimés, code PARTNER_DAILY_SMS_QUOTA_EXCEEDED retiré (INVITE_PER_PARTNER_HOUR → 429 PARTNER_INVITE_RATE_LIMIT, SMS_PER_ACCOUNT_DAY sur le compte du partenaire) ; couvert par tests/parcours/acces-limiteurs.test.ts
});
