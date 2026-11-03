import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// [lot 0] Chargement de .env.local supprimé : l'environnement de test (.env.test, instance Supabase locale)
// et le garde-fou anti-base réelle sont fournis par tests/helpers/env.ts.
import '../helpers/env';

import { getServiceRoleClient } from '../../lib/supabase/server';
import { TicketTransferService } from '../../lib/tickets/ticket-transfer.service';
import { GET as getClaimRoute } from '../../app/api/tickets/claim/[token]/route';
import { POST as cancelRoute } from '../../app/api/tickets/transfers/[id]/cancel/route';

describe('CHANTIER 2 — PHASE 3 : RÉCLAMATION, ROTATION DU SECRET & SÉCURITÉ P2P (18 TESTS)', async () => {
    const supabase = getServiceRoleClient();
    const publicAuth = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const ts = Date.now().toString().slice(-6);

    const partnerId = 'a917b7ac-d542-4c2b-b5d8-ab38f866b2e7';
    const buyerAUserId = 'a7345050-03cf-4967-9281-9ee5eb75615a'; // Expéditeur (Propriétaire initial)
    const buyerBUserId = 'fe9318ac-1f65-4e80-980f-f00626f1a003'; // Destinataire légitime
    const buyerCUserId = '775818bd-1833-4e99-843d-3f5ecf8196e3'; // Tiers non autorisé

    let testEventId: string;
    let testCategoryId: string;

    // Tokens d'authentification JWT réels
    let buyerAToken: string;
    let buyerBToken: string;
    let buyerCToken: string;

    // Tickets de test
    let tClaimNominalId: string;
    let tClaimConcurrenceId: string;
    let tAntiFraudeId: string;
    let tCancelNominalId: string;
    let tCancelAfterClaimId: string;
    let tExpireId: string;
    let tNonTransfereId: string;

    before(async () => {
        console.log('\n[SETUP] Initialisation du banc d\'essai Phase 3 (Claim, Rotation & Révocation P2P)...');

        // 1. Mise à jour / Authentification des utilisateurs de test
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
        await supabase.auth.admin.updateUserById(buyerAUserId, { password: process.env.LEGACY_TEST_PASSWORD!, email_confirm: true, user_metadata: { role: 'CLIENT', roles: ['CLIENT'] } });
        const { data: bAAuth } = await publicAuth.auth.signInWithPassword({ email: bAEmail, password: process.env.LEGACY_TEST_PASSWORD! });
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
        await supabase.auth.admin.updateUserById(buyerBUserId, { password: process.env.LEGACY_TEST_PASSWORD!, email_confirm: true, user_metadata: { role: 'CLIENT', roles: ['CLIENT'] } });
        const { data: bBAuth } = await publicAuth.auth.signInWithPassword({ email: bBEmail, password: process.env.LEGACY_TEST_PASSWORD! });
        buyerBToken = bBAuth?.session?.access_token || '';

        const { data: bCUser } = await supabase.auth.admin.getUserById(buyerCUserId);
        const bCEmail = bCUser?.user?.email || 'buyerC@eventvillage.sn';
        await supabase.from('users').upsert({
            id: buyerCUserId,
            first_name: 'Ousmane',
            last_name: 'Ba',
            phone: '+221779998877',
            email: bCEmail,
            role: 'CLIENT',
            status: 'ACTIF',
        });
        await supabase.auth.admin.updateUserById(buyerCUserId, { password: process.env.LEGACY_TEST_PASSWORD!, email_confirm: true, user_metadata: { role: 'CLIENT', roles: ['CLIENT'] } });
        const { data: bCAuth } = await publicAuth.auth.signInWithPassword({ email: bCEmail, password: process.env.LEGACY_TEST_PASSWORD! });
        buyerCToken = bCAuth?.session?.access_token || '';

        // Inscription des rôles CLIENT
        await supabase.from('user_roles').delete().in('user_id', [buyerAUserId, buyerBUserId, buyerCUserId]);
        await supabase.from('user_roles').insert([
            { user_id: buyerAUserId, role: 'CLIENT' },
            { user_id: buyerBUserId, role: 'CLIENT' },
            { user_id: buyerCUserId, role: 'CLIENT' },
        ]);

        // 2. Événement de test
        const { data: ev, error: evErr } = await supabase.from('events').insert({
            partner_id: partnerId,
            title: `Festival Grand P2P Claim ${ts}`,
            slug: `p2p-claim-${ts}`,
            description: 'Validation de la réclamation atomique et de la rotation cryptographique de sécurité',
            category: 'CONCERT',
            start_date: new Date(Date.now() + 86400000 * 4).toISOString().split('T')[0],
            start_time: '21:00:00',
            location: 'Monument de la Renaissance, Dakar',
            city: 'Dakar',
            capacity: 1000,
            status: 'PUBLIE',
        }).select('id').single();
        if (evErr || !ev) throw new Error(`Event creation: ${evErr?.message}`);
        testEventId = ev.id;

        // 3. Catégorie de billets
        const { data: cat, error: catErr } = await supabase.from('ticket_categories').insert({
            event_id: testEventId,
            name: 'Pass VIP Prestige',
            price: 35000,
            total_quantity: 50,
            sold_quantity: 10,
            is_active: true,
            is_visible: true,
        }).select('id').single();
        if (catErr || !cat) throw new Error(`Category creation: ${catErr?.message}`);
        testCategoryId = cat.id;

        // 4. Création des billets de test pour Buyer A
        async function createTicket(num: string) {
            const { data: t, error: tErr } = await supabase.from('tickets').insert({
                event_id: testEventId,
                category_id: testCategoryId,
                user_id: buyerAUserId,
                ticket_number: `TCK-CLM-${num}-${ts}`,
                price: 35000,
                qr_code: `EV-QR-INIT-${num}-${ts}`,
                status: 'VALIDE',
                totp_secret: crypto.randomBytes(32).toString('hex'),
            }).select('id').single();
            if (tErr || !t) throw new Error(`Ticket creation failed: ${tErr?.message}`);
            return t.id;
        }

        tClaimNominalId = await createTicket('NOMINAL');
        tClaimConcurrenceId = await createTicket('CONCUR');
        tAntiFraudeId = await createTicket('FRAUDE');
        tCancelNominalId = await createTicket('CANCEL');
        tCancelAfterClaimId = await createTicket('C_AFTER');
        tExpireId = await createTicket('EXPIRE');
        tNonTransfereId = await createTicket('NON_TRANSF');

        console.log(`[SETUP] Prêt. Event: ${testEventId}, Tickets initialisés.`);
    });

    after(async () => {
        console.log('\n[CLEANUP] Nettoyage des données Phase 3...');
        try {
            await supabase.from('ticket_transfers').delete().in('ticket_id', [
                tClaimNominalId, tClaimConcurrenceId, tAntiFraudeId, tCancelNominalId,
                tCancelAfterClaimId, tExpireId, tNonTransfereId,
            ]);
            await supabase.from('tickets').delete().eq('event_id', testEventId);
            await supabase.from('ticket_categories').delete().eq('event_id', testEventId);
            await supabase.from('events').delete().eq('id', testEventId);
            console.log('[CLEANUP] Terminé.\n');
        } catch (e) {
            console.error('[CLEANUP] Erreur:', e);
        }
    });

    let trExpiredId: string;

    // [lot 6 — cas supprimé] TEST 1 : GET claim avec token valide : le champ claim_token de l'initiation est retiré et la route /api/tickets/claim/[token] répond 410 CLAIM_LINK_RETIRED sans lire la base (contrat B4) ; détails publics et masquage d'un transfert reçu couverts par tests/parcours/notif-transferts.test.ts (GET /api/tickets/transfers/incoming)

    test('TEST 2 : GET claim avec token invalide (Rejet 404)', async () => {
        const fakeToken = '0000000000000000000000000000000000000000000000000000000000000000';
        const req = new NextRequest(`http://localhost:3000/api/tickets/claim/${fakeToken}`, { method: 'GET' });
        const res = await getClaimRoute(req, { params: { token: fakeToken } });
        const data = await res.json();

        assert.strictEqual(res.status, 404, 'HTTP 404 attendu');
        assert.strictEqual(data.success, undefined);
        console.log('   ✅ TEST 2 : Token invalide rejeté avec HTTP 404');
    });

    test('TEST 3 : GET claim avec transfert expiré (Rejet 410)', async () => {
        // On crée un transfert déjà expiré
        const expiredToken = crypto.randomBytes(32).toString('hex');
        const expiredHash = crypto.createHash('sha256').update(expiredToken).digest('hex');
        const pastDate = new Date(Date.now() - 3600 * 1000).toISOString();
        trExpiredId = crypto.randomUUID();

        const trExpired = {
            id: trExpiredId,
            ticket_id: tExpireId,
            from_user_id: buyerAUserId,
            to_phone_or_email: '+221772345678',
            status: 'PENDING' as const,
            claim_token_hash: expiredHash,
            created_at: new Date(Date.now() - 7200 * 1000).toISOString(),
            expires_at: pastDate,
        };

        try {
            await supabase.from('ticket_transfers').insert(trExpired);
        } catch {}
        (TicketTransferService as any).inMemoryTransfers.set(trExpiredId, trExpired);
        (TicketTransferService as any).activeTransfersLock.add(tExpireId);

        const req = new NextRequest(`http://localhost:3000/api/tickets/claim/${expiredToken}`, { method: 'GET' });
        const res = await getClaimRoute(req, { params: { token: expiredToken } });
        const data = await res.json();

        assert.strictEqual(res.status, 410, 'HTTP 410 attendu pour transfert expiré');
        assert.strictEqual(data.expired, true);
        console.log('   ✅ TEST 3 : Transfert expiré rejeté avec HTTP 410');
    });

    // [lot 6 — cas supprimé] TEST 4 : CLAIM nominal par jeton : claim_token et la réclamation par /api/tickets/claim/[token] sont retirés (contrat B : réclamation par POST /api/tickets/transfers/[id]/claim depuis le compte dont le numéro vérifié est la cible) ; couvert par tests/parcours/notif-transferts.test.ts (destinataire vérifié : 200, billet transféré, identité renouvelée) et tests/parcours/acces-qr.test.ts (transfert complet par les routes)
    // [lot 6 — cas supprimé] TEST 5 : CLAIM avec mauvais destinataire : réclamation par jeton retirée (contrat B) ; couvert par tests/parcours/notif-transferts.test.ts (404 TRANSFER_NOT_FOUND identique pour le transfert d'un autre, billet inchangé)
    // [lot 6 — cas supprimé] TEST 6 : DOUBLE CLAIM concurrent : TicketTransferService.claimTransfer et claim_token supprimés (contrat B, acceptTransfer par l'identifiant du transfert) ; second appel séquentiel refusé (409 TRANSFER_NOT_PENDING) couvert par tests/parcours/notif-transferts.test.ts ; non couvert : deux réclamations simultanées

    // [lot 4 — cas supprimé] TEST 7 — Ancien QR révoqué et nouveau QR opérationnel : generateTotp, verifyTotp et buildDynamicQrPayload supprimés ; couvert par tests/parcours/acces-totp.test.ts (transfert : code de l'ancien secret refusé, nouveau porteur accepté) et tests/parcours/acces-qr.test.ts (identifiants régénérés, ancien QR et ancien numéro refusés)
    // [lot 4 — cas supprimé] TEST 8 : security_version (N → N + 1) : lisait le billet réclamé par le cas 7 (supprimé) ; non couvert : l'incrément de security_version par ticket_transfer_claim n'est vérifié par aucune suite active
    // [lot 4 — cas supprimé] TEST 9 : Ancien qr_code != Nouveau qr_code : lisait le billet réclamé par le cas 7 (supprimé) ; couvert par tests/parcours/acces-qr.test.ts (qr_code régénéré au transfert)
    // [lot 4 — cas supprimé] TEST 10 : Ancien totp_secret != Nouveau totp_secret : lisait le billet réclamé par le cas 7 (supprimé) ; couvert par tests/parcours/acces-qr.test.ts et tests/parcours/acces-totp.test.ts (totp_secret régénéré au transfert)

    test('TEST 11 : Annulation par le propriétaire (CANCELLED, déverrouillage, user_id inchangé)', async () => {
        // Initiation d'un transfert sur tCancelNominalId
        const initCancel = await TicketTransferService.initiateTransfer(buyerAUserId, tCancelNominalId, '+221772345678');

        const req = new NextRequest(`http://localhost:3000/api/tickets/transfers/${initCancel.transfer_id}/cancel`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${buyerAToken}`, // Propriétaire initial
            },
        });

        const res = await cancelRoute(req, { params: { id: initCancel.transfer_id } });
        const data = await res.json();

        assert.strictEqual(res.status, 200, 'HTTP 200 attendu');
        assert.strictEqual(data.success, true);

        // Vérification
        const trDb = await TicketTransferService.getTransferRecord(initCancel.transfer_id);
        assert.strictEqual(trDb!.status, 'CANCELLED', 'ticket_transfers.status est CANCELLED');

        const { data: tDb } = await supabase.from('tickets').select('*').eq('id', tCancelNominalId).single();
        const isLocked = await TicketTransferService.isTicketLocked(tCancelNominalId);
        assert.strictEqual(isLocked, false, 'tickets.transfer_locked est repassé à false');
        assert.strictEqual(tDb!.user_id, buyerAUserId, 'Propriétaire reste Buyer A');

        console.log('   ✅ TEST 11 : Annulation par le propriétaire réussie et billet libéré');
    });

    test('TEST 12 : Annulation par un autre utilisateur (Rejet HTTP 403 Forbidden)', async () => {
        // Initiation d'un nouveau transfert
        const initTr = await TicketTransferService.initiateTransfer(buyerAUserId, tCancelNominalId, '+221772345678');

        // Buyer C tente d'annuler le transfert de Buyer A
        const req = new NextRequest(`http://localhost:3000/api/tickets/transfers/${initTr.transfer_id}/cancel`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${buyerCToken}`, // Tiers non propriétaire
            },
        });

        const res = await cancelRoute(req, { params: { id: initTr.transfer_id } });
        const data = await res.json();

        assert.strictEqual(res.status, 403, 'HTTP 403 attendu');
        assert.ok(data.error.includes('émetteur'), 'Erreur explicite d\'émetteur');

        console.log('   ✅ TEST 12 : Tentative d\'annulation par un tiers rejetée en HTTP 403');
    });

    // [lot 6 — cas supprimé] TEST 13 : Annulation après CLAIM : annulait le transfert réclamé par le test 4 (supprimé) ; non couvert par une suite active (annulation d'un transfert déjà réclamé)

    test('TEST 14 : Expiration TTL 48h (Cleanup Job : EXPIRED & Déverrouillage)', async () => {
        const expiredCleanupResult = await TicketTransferService.expireOverdueTransfers();
        assert.ok(expiredCleanupResult.expiredCount >= 1, 'Au moins 1 transfert expiré nettoyé');

        // Vérification
        const trDb = await TicketTransferService.getTransferRecord(trExpiredId);
        assert.strictEqual(trDb!.status, 'EXPIRED', 'Statut passé à EXPIRED');

        const isLocked = await TicketTransferService.isTicketLocked(tExpireId);
        assert.strictEqual(isLocked, false, 'Billet déverrouillé après expiration');

        console.log('   ✅ TEST 14 : Cleanup TTL 48h exécuté avec succès');
    });

    test('TEST 15 : Idempotence du cleanup job d expiration (Exécution x2 sans effet de bord)', async () => {
        const secondRun = await TicketTransferService.expireOverdueTransfers();
        assert.strictEqual(secondRun.expiredCount, 0, 'Deuxième exécution immédiate = 0 doublon traité');
        console.log('   ✅ TEST 15 : Idempotence du cleanup d expiration prouvée');
    });

    test('TEST 16 : Après expiration, nouvelle initiation de transfert possible sur le billet', async () => {
        // Le billet tExpireId a été déverrouillé par l'expiration
        const reInitResult = await TicketTransferService.initiateTransfer(
            buyerAUserId,
            tExpireId,
            '+221772345678'
        );

        assert.strictEqual(reInitResult.success, true, 'Nouvelle initiation acceptée');

        const isLocked = await TicketTransferService.isTicketLocked(tExpireId);
        assert.strictEqual(isLocked, true, 'Billet reverrouillé pour le nouveau transfert');

        console.log('   ✅ TEST 16 : Re-transfert d un billet expiré validé');
    });

    // [lot 4 — cas supprimé] TEST 17 : Non-régression QR/TOTP d'un billet non transféré : generateTotp et verifyTotp supprimés ; couvert par tests/parcours/acces-totp.test.ts (verifyTicketCode)
    // [lot 4 — cas supprimé] TEST 18 : Non-régression compostage (atomic_ticket_checkin) : RPC atomic_ticket_checkin supprimée (remplacée par ticket_scan) ; couvert par tests/parcours/acces-scan.test.ts (compostage atomique)
});
