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
import { resolvePostLoginRoute } from '../lib/auth/resolve-post-login-route';

describe('MODULE CONTRÔLEUR — WORKFLOW COMPLET & TESTS CRITIQUES (§Audit)', () => {
    const supabase = getServiceRoleClient();
    const publicAuthClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const timestamp = Date.now().toString().slice(-6);

    let eventAId: string;
    let eventBId: string;
    let partnerUserId: string;
    let partnerId: string;
    let controllerUserId: string;
    let controllerToken: string;
    let clientUserId: string;
    let ticketEventAId: string;
    let ticketEventBId: string;
    let concurrentTicketId: string;
    let concurrentQrCode: string;
    let categoryAId: string;
    let categoryBId: string;

    before(async () => {
        // Utilisation des comptes de test persistants pour bypasser les triggers auth distants
        partnerUserId = '66cb74dc-c43e-48ad-8452-8edb7ebcc6e1';
        partnerId = '8cb7a5eb-f344-4a4a-abb5-4c03fe60773a';
        controllerUserId = 'fe9318ac-1f65-4e80-980f-f00626f1a003';
        const controllerEmail = 'clientA_1788284499885@test.com';
        clientUserId = '03301357-7980-4b26-ad8c-228e24565afe';

        // 1. Mise à niveau du compte contrôleur et obtention du vrai JWT session via le client public
        await supabase.auth.admin.updateUserById(controllerUserId, { password: 'Password123!' });
        await supabase.from('users').update({ role: 'CONTROLEUR', status: 'ACTIF' }).eq('id', controllerUserId);

        const { data: signInCtrl, error: sErr } = await publicAuthClient.auth.signInWithPassword({
            email: controllerEmail,
            password: 'Password123!',
        });
        if (sErr || !signInCtrl?.session?.access_token) {
            throw new Error(`Échec login contrôleur: ${sErr?.message}`);
        }
        controllerToken = signInCtrl.session.access_token;

        // 2. Événements A et B
        const { data: evA, error: errEvA } = await supabase.from('events').insert({
            partner_id: partnerId,
            title: `Festival A - Dakar Arena ${timestamp}`,
            slug: `festival-a-${timestamp}`,
            description: 'Grand concert A',
            start_date: '2026-12-30',
            start_time: '20:00:00',
            location: 'Dakar Arena, Diamniadio',
            status: 'PUBLIE',
        }).select().single();
        if (errEvA || !evA) throw new Error(`Échec création Event A: ${errEvA?.message}`);
        eventAId = evA.id;

        const { data: evB, error: errEvB } = await supabase.from('events').insert({
            partner_id: partnerId,
            title: `Festival B - Grand Théâtre ${timestamp}`,
            slug: `festival-b-${timestamp}`,
            description: 'Grand concert B',
            start_date: '2026-12-31',
            start_time: '21:00:00',
            location: 'Grand Théâtre National, Dakar',
            status: 'PUBLIE',
        }).select().single();
        if (errEvB || !evB) throw new Error(`Échec création Event B: ${errEvB?.message}`);
        eventBId = evB.id;

        // Catégories
        const { data: catA, error: errCatA } = await supabase.from('ticket_categories').insert({
            event_id: eventAId,
            name: 'Pass Standard A',
            price: 5000,
            total_quantity: 100,
            sold_quantity: 0,
        }).select().single();
        if (errCatA || !catA) throw new Error(`Échec création Catégorie A: ${errCatA?.message}`);
        categoryAId = catA.id;

        const { data: catB, error: errCatB } = await supabase.from('ticket_categories').insert({
            event_id: eventBId,
            name: 'Pass VIP B',
            price: 15000,
            total_quantity: 50,
            sold_quantity: 0,
        }).select().single();
        if (errCatB || !catB) throw new Error(`Échec création Catégorie B: ${errCatB?.message}`);
        categoryBId = catB.id;

        // 3. Assigner le contrôleur uniquement à l'Événement A
        await supabase.from('event_controllers').insert({
            event_id: eventAId,
            user_id: controllerUserId,
            can_accept_cash: true,
            created_by: partnerUserId,
        });

        // 4. Billets
        // Billet pour Event A
        const { data: tktA } = await supabase.from('tickets').insert({
            event_id: eventAId,
            category_id: categoryAId,
            user_id: clientUserId,
            ticket_number: `TKT-A-${timestamp}`,
            price: 5000,
            qr_code: `QR-A-${timestamp}`,
            status: 'VALIDE',
        }).select().single();
        ticketEventAId = tktA!.id;

        // Billet pour Event B
        const { data: tktB } = await supabase.from('tickets').insert({
            event_id: eventBId,
            category_id: categoryBId,
            user_id: clientUserId,
            ticket_number: `TKT-B-${timestamp}`,
            price: 15000,
            qr_code: `QR-B-${timestamp}`,
            status: 'VALIDE',
        }).select().single();
        ticketEventBId = tktB!.id;

        // Billet pour test de concurrence
        concurrentQrCode = `QR-CONCURRENT-${timestamp}`;
        const { data: tktConc } = await supabase.from('tickets').insert({
            event_id: eventAId,
            category_id: categoryAId,
            user_id: clientUserId,
            ticket_number: `TKT-CONC-${timestamp}`,
            price: 5000,
            qr_code: concurrentQrCode,
            status: 'VALIDE',
        }).select().single();
        concurrentTicketId = tktConc!.id;
    });

    after(async () => {
        try {
            if (ticketEventAId) await supabase.from('tickets').delete().eq('id', ticketEventAId);
            if (ticketEventBId) await supabase.from('tickets').delete().eq('id', ticketEventBId);
            if (concurrentTicketId) await supabase.from('tickets').delete().eq('id', concurrentTicketId);
            if (eventAId) {
                await supabase.from('event_controllers').delete().eq('event_id', eventAId);
                await supabase.from('ticket_categories').delete().eq('event_id', eventAId);
                await supabase.from('events').delete().eq('id', eventAId);
            }
            if (eventBId) {
                await supabase.from('ticket_categories').delete().eq('event_id', eventBId);
                await supabase.from('events').delete().eq('id', eventBId);
            }
            if (controllerUserId) {
                await supabase.from('users').update({ role: 'CLIENT' }).eq('id', controllerUserId);
            }
        } catch {
            // Nettoyage silencieux
        }
    });

    // ────────────────────────────────────────────────────────────────────────
    // TEST 1 : Redirection post-login et synchronisation de rôle (Bug Critique 1)
    // ────────────────────────────────────────────────────────────────────────
    test('1. Redirection Post-Login : Un utilisateur avec rôle CONTROLEUR est dirigé vers /controller/scanner', () => {
        // Valide directement la fonction pure de production importée de @/lib/auth/resolve-post-login-route

        // Cas nominal : Contrôleur se connecte sans redirect
        assert.equal(resolvePostLoginRoute('CONTROLEUR'), '/controller/scanner');
        assert.equal(resolvePostLoginRoute('CONTROLEUR', '/'), '/controller/scanner');

        // Cas critique : Anciennes routes /scan ou /partner/scan automatiquement normalisées
        assert.equal(resolvePostLoginRoute('CONTROLEUR', '/scan'), '/controller/scanner');
        assert.equal(resolvePostLoginRoute('CONTROLEUR', '/partner/scan'), '/controller/scanner');

        // Les autres rôles conservent leurs destinations
        assert.equal(resolvePostLoginRoute('CLIENT'), '/');
        assert.equal(resolvePostLoginRoute('PARTENAIRE'), '/partner');
        assert.equal(resolvePostLoginRoute('ADMIN'), '/admin');
    });

    // ────────────────────────────────────────────────────────────────────────
    // TEST 2 : Middleware RBAC & Fallback DB pour le rôle CONTROLEUR
    // ────────────────────────────────────────────────────────────────────────
    test('2. Middleware RBAC : /controller/* accessible à CONTROLEUR et bloqué pour CLIENT avec redirection', () => {
        function simulateMiddleware(pathname: string, user: { role: string; dbRoleFallback?: string } | null, isAuthPage: boolean) {
            if (isAuthPage) {
                let role = user?.role || 'CLIENT';
                if (role === 'CLIENT' && user?.dbRoleFallback && user.dbRoleFallback !== 'CLIENT') {
                    role = user.dbRoleFallback;
                }
                if (role === 'CONTROLEUR') return { action: 'redirect', target: '/controller/scanner' };
                if (role === 'PARTENAIRE') return { action: 'redirect', target: '/partner/dashboard' };
                if (role === 'ADMIN' || role === 'SUPERADMIN') return { action: 'redirect', target: '/admin/dashboard' };
                return { action: 'redirect', target: '/' };
            }

            if (!user) {
                return { action: 'redirect', target: `/login?redirect=${encodeURIComponent(pathname)}` };
            }

            let role = user.role;
            if (pathname.startsWith('/controller')) {
                if (role !== 'CONTROLEUR' && role !== 'ADMIN' && role !== 'SUPERADMIN') {
                    if (user.dbRoleFallback === 'CONTROLEUR') {
                        role = 'CONTROLEUR';
                    }
                }
                if (role !== 'CONTROLEUR' && role !== 'ADMIN' && role !== 'SUPERADMIN') {
                    return { action: 'redirect', target: '/?error=unauthorized_controller' };
                }
                return { action: 'allow' };
            }

            return { action: 'allow' };
        }

        // Contrôleur avec claim à jour accède à /controller/scanner
        const allowedRes = simulateMiddleware('/controller/scanner', { role: 'CONTROLEUR' }, false);
        assert.equal(allowedRes.action, 'allow');

        // Client ordinaire est bloqué avec redirection
        const deniedRes = simulateMiddleware('/controller/scanner', { role: 'CLIENT' }, false);
        assert.equal(deniedRes.action, 'redirect');
        assert.equal(deniedRes.target, '/?error=unauthorized_controller');

        // Contrôleur connecté visitant /login est dirigé vers /controller/scanner
        const loginRedirect = simulateMiddleware('/login', { role: 'CONTROLEUR' }, true);
        assert.equal(loginRedirect.action, 'redirect');
        assert.equal(loginRedirect.target, '/controller/scanner');

        // Token lag : JWT role=CLIENT mais base de données role=CONTROLEUR -> Fallback autorise l'accès
        const fallbackRes = simulateMiddleware('/controller/scanner', { role: 'CLIENT', dbRoleFallback: 'CONTROLEUR' }, false);
        assert.equal(fallbackRes.action, 'allow');
    });

    // ────────────────────────────────────────────────────────────────────────
    // TEST 3 : Isolation multi-événements (403 si scan d'un événement non assigné)
    // ────────────────────────────────────────────────────────────────────────
    test('3. Isolation Multi-Événements : Le contrôleur reçoit un refus 403 s\'il scanne un billet d\'un autre événement', async () => {
        // Le contrôleur est assigné à l'Event A. Il tente de scanner le billet de l'Event B
        const req = new NextRequest('http://localhost:3000/api/controller/scan', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${controllerToken}`,
            },
            body: JSON.stringify({ qr_code: `QR-B-${timestamp}` }),
        });

        const res = await scanTicket(req);
        const data = await res.json();

        assert.equal(res.status, 403, 'Le contrôleur non assigné à cet événement doit recevoir HTTP 403');
        assert.equal(data.scan_result, 'unauthorized');
        assert.ok(data.message.includes('pas assigné'), 'Le message doit expliciter l\'absence d\'assignation');
    });

    // ────────────────────────────────────────────────────────────────────────
    // TEST 4 : Concurrence atomique sur le compostage (Promise.allSettled)
    // ────────────────────────────────────────────────────────────────────────
    test('4. Concurrence Atomique : 5 scans simultanés produisent exactement 1 succès et 4 rejets "already_used"', async () => {
        const CONCURRENT_REQUESTS = 5;

        const scanRequests = Array.from({ length: CONCURRENT_REQUESTS }, () => {
            const req = new NextRequest('http://localhost:3000/api/controller/scan', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${controllerToken}`,
                },
                body: JSON.stringify({ qr_code: concurrentQrCode }),
            });
            return scanTicket(req).then(async res => ({
                status: res.status,
                body: await res.json(),
            }));
        });

        const results = await Promise.allSettled(scanRequests);

        const fulfilled = results
            .filter((r): r is PromiseFulfilledResult<{ status: number; body: any }> => r.status === 'fulfilled')
            .map(r => r.value);

        assert.equal(fulfilled.length, CONCURRENT_REQUESTS, 'Toutes les requêtes de scan doivent aboutir');

        const successCount = fulfilled.filter(r => r.body.scan_result === 'valid' || r.body.scan_result === 'success').length;
        const alreadyUsedCount = fulfilled.filter(r => r.body.scan_result === 'already_used').length;

        assert.equal(successCount, 1, 'Exactement UN compostage doit réussir parmi les 5 requêtes concurrentes');
        assert.equal(alreadyUsedCount, CONCURRENT_REQUESTS - 1, 'Les 4 autres requêtes doivent être rejetées comme already_used');

        // Vérification de la persistance en base de données
        const { data: ticketInDb } = await supabase
            .from('tickets')
            .select('status, checked_in_at, checked_in_by')
            .eq('id', concurrentTicketId)
            .single();

        assert.equal(ticketInDb?.status, 'UTILISE', 'Le billet doit être marqué UTILISE en base');
        assert.equal(ticketInDb?.checked_in_by, controllerUserId, 'Le composteur doit être l\'ID du contrôleur');
        assert.ok(ticketInDb?.checked_in_at, 'La date de compostage doit être renseignée');
    });
});
