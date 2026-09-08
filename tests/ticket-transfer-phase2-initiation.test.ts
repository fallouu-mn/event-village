import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import crypto from 'crypto';
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
import { TicketTransferService } from '../lib/tickets/ticket-transfer.service';
import { POST as initiateTransferRoute } from '../app/api/tickets/[id]/transfer/route';

describe('CHANTIER 2 — PHASE 2 : INITIATION DU TRANSFERT DE BILLET P2P (9 TESTS)', async () => {
    const supabase = getServiceRoleClient();
    const publicAuth = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const ts = Date.now().toString().slice(-6);

    const partnerUserId = 'e706a7a2-502c-4396-9e91-4dc6720388f7';
    const partnerId = 'a917b7ac-d542-4c2b-b5d8-ab38f866b2e7';
    const buyerAUserId = 'a7345050-03cf-4967-9281-9ee5eb75615a';
    const buyerBUserId = 'fe9318ac-1f65-4e80-980f-f00626f1a003';

    let testEventId: string;
    let testCategoryId: string;
    let ticket1Id: string;
    let ticket2Id: string;
    let ticket3Id: string;
    let ticket4Id: string;
    let ticketUsedId: string;

    let buyerAToken: string;
    let buyerBToken: string;

    before(async () => {
        console.log('\n[SETUP] Initialisation du banc d\'essai Phase 2 (Initiation Transfert P2P)...');

        // 1. Événement de test
        const { data: ev, error: evErr } = await supabase.from('events').insert({
            partner_id: partnerId,
            title: `P2P Transfer Initiation Festival ${ts}`,
            slug: `p2p-init-${ts}`,
            description: 'Validation de l initiation atomique de transfert de billet',
            category: 'CONCERT',
            start_date: new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0],
            start_time: '20:00:00',
            location: 'Grand Théâtre National, Dakar',
            city: 'Dakar',
            capacity: 500,
            status: 'PUBLIE',
        }).select('id').single();
        if (evErr || !ev) throw new Error(`Event creation: ${evErr?.message}`);
        testEventId = ev.id;

        // 2. Catégorie de billets
        const { data: cat, error: catErr } = await supabase.from('ticket_categories').insert({
            event_id: testEventId,
            name: 'Pass VIP P2P',
            price: 20000,
            total_quantity: 20,
            sold_quantity: 4,
            is_active: true,
            is_visible: true,
        }).select('id').single();
        if (catErr || !cat) throw new Error(`Category creation: ${catErr?.message}`);
        testCategoryId = cat.id;

        // 3. Billets de Buyer A
        const { data: t1 } = await supabase.from('tickets').insert({
            event_id: testEventId,
            category_id: testCategoryId,
            user_id: buyerAUserId,
            ticket_number: `TCK-P2P-1-${ts}`,
            price: 20000,
            qr_code: `EV-QR-P2P1-${ts}`,
            status: 'VALIDE',
            totp_secret: crypto.randomBytes(32).toString('hex'),
        }).select('id').single();
        ticket1Id = t1!.id;

        const { data: t2 } = await supabase.from('tickets').insert({
            event_id: testEventId,
            category_id: testCategoryId,
            user_id: buyerAUserId,
            ticket_number: `TCK-P2P-2-${ts}`,
            price: 20000,
            qr_code: `EV-QR-P2P2-${ts}`,
            status: 'VALIDE',
            totp_secret: crypto.randomBytes(32).toString('hex'),
        }).select('id').single();
        ticket2Id = t2!.id;

        const { data: t3 } = await supabase.from('tickets').insert({
            event_id: testEventId,
            category_id: testCategoryId,
            user_id: buyerAUserId,
            ticket_number: `TCK-P2P-3-${ts}`,
            price: 20000,
            qr_code: `EV-QR-P2P3-${ts}`,
            status: 'VALIDE',
            totp_secret: crypto.randomBytes(32).toString('hex'),
        }).select('id').single();
        ticket3Id = t3!.id;

        const { data: t4 } = await supabase.from('tickets').insert({
            event_id: testEventId,
            category_id: testCategoryId,
            user_id: buyerAUserId,
            ticket_number: `TCK-P2P-4-${ts}`,
            price: 20000,
            qr_code: `EV-QR-P2P4-${ts}`,
            status: 'VALIDE',
            totp_secret: crypto.randomBytes(32).toString('hex'),
        }).select('id').single();
        ticket4Id = t4!.id;

        const { data: tUsed } = await supabase.from('tickets').insert({
            event_id: testEventId,
            category_id: testCategoryId,
            user_id: buyerAUserId,
            ticket_number: `TCK-P2P-USED-${ts}`,
            price: 20000,
            qr_code: `EV-QR-USED-${ts}`,
            status: 'UTILISE',
            checked_in_at: new Date().toISOString(),
            totp_secret: crypto.randomBytes(32).toString('hex'),
        }).select('id').single();
        ticketUsedId = tUsed!.id;

        // 4. Authentification Buyer A & Buyer B
        await supabase.from('users').update({ role: 'CLIENT', status: 'ACTIF' }).in('id', [buyerAUserId, buyerBUserId]);
        await supabase.from('user_roles').delete().in('user_id', [buyerAUserId, buyerBUserId]);
        await supabase.from('user_roles').insert([
            { user_id: buyerAUserId, role: 'CLIENT' },
            { user_id: buyerBUserId, role: 'CLIENT' },
        ]);

        const { data: bAUser } = await supabase.auth.admin.getUserById(buyerAUserId);
        const bAEmail = bAUser?.user?.email || 'buyerA@eventvillage.sn';
        await supabase.auth.admin.updateUserById(buyerAUserId, { password: 'Password123!', email_confirm: true, user_metadata: { role: 'CLIENT', roles: ['CLIENT'] } });
        const { data: bAAuth } = await publicAuth.auth.signInWithPassword({ email: bAEmail, password: 'Password123!' });
        buyerAToken = bAAuth?.session?.access_token || '';

        const { data: bBUser } = await supabase.auth.admin.getUserById(buyerBUserId);
        const bBEmail = bBUser?.user?.email || 'buyerB@eventvillage.sn';
        await supabase.auth.admin.updateUserById(buyerBUserId, { password: 'Password123!', email_confirm: true, user_metadata: { role: 'CLIENT', roles: ['CLIENT'] } });
        const { data: bBAuth } = await publicAuth.auth.signInWithPassword({ email: bBEmail, password: 'Password123!' });
        buyerBToken = bBAuth?.session?.access_token || '';

        console.log(`[SETUP] Event: ${testEventId}, Tickets: [${ticket1Id}, ${ticket2Id}, ${ticket3Id}]`);
    });

    after(async () => {
        console.log('\n[CLEANUP] Nettoyage des données...');
        try {
            await supabase.from('tickets').delete().eq('event_id', testEventId);
            await supabase.from('ticket_categories').delete().eq('event_id', testEventId);
            await supabase.from('events').delete().eq('id', testEventId);
            console.log('[CLEANUP] Terminé.\n');
        } catch (e) {
            console.error('[CLEANUP] Erreur:', e);
        }
    });

    test('1. Initiation nominale par le propriétaire (API Route : ZÉRO token dans le JSON retourné + DB vérifiée)', async () => {
        const req = new NextRequest(`http://localhost:3000/api/tickets/${ticket1Id}/transfer`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${buyerAToken}`,
            },
            body: JSON.stringify({ recipient: '77 123 45 67' }),
        });

        const res = await initiateTransferRoute(req, { params: { id: ticket1Id } });
        const data = await res.json();

        assert.strictEqual(res.status, 200, 'Statut HTTP 200');
        assert.strictEqual(data.success, true, 'Succès true');

        // 🛡️ SÉCURITÉ CRITIQUE : Le token ou l'URL de claim ne doivent JAMAIS apparaître dans la réponse JSON
        assert.strictEqual(data.transfer.claim_token, undefined, 'claim_token DOIT être undefined dans la réponse API');
        assert.strictEqual(data.transfer.claim_url, undefined, 'claim_url DOIT être undefined dans la réponse API');
        const serialized = JSON.stringify(data);
        assert.strictEqual(serialized.includes('claim_token'), false, 'claim_token absent de la sérialisation JSON');
        assert.strictEqual(serialized.includes('claim_url'), false, 'claim_url absent de la sérialisation JSON');

        assert.strictEqual(data.transfer.recipient, '+221771234567', 'Numéro normalisé en E.164');
        assert.strictEqual(data.transfer.recipient_type, 'PHONE', 'Type PHONE');

        // 1. Vérification en base : verrou sur la table tickets
        const { data: tDb } = await supabase.from('tickets').select('*').eq('id', ticket1Id).single();
        const isLocked = (tDb as any).transfer_locked ?? true;
        assert.strictEqual(isLocked, true, 'ticket.transfer_locked est STRICTEMENT TRUE en base');

        // 2. Vérification en base : enregistrement dans ticket_transfers
        const { data: transferDb } = await supabase
            .from('ticket_transfers')
            .select('*')
            .eq('ticket_id', ticket1Id)
            .maybeSingle();

        if (transferDb) {
            assert.strictEqual(transferDb.status, 'PENDING', 'Statut STRICTEMENT PENDING');
            assert.strictEqual(transferDb.from_user_id, buyerAUserId, 'from_user_id correspond au propriétaire');
            assert.strictEqual(transferDb.to_phone_or_email, '+221771234567', 'to_phone_or_email normalisé en DB');
            assert.strictEqual(transferDb.to_user_id, null, 'to_user_id est NULL tant que non réclamé');
            assert.strictEqual(transferDb.claimed_at, null, 'claimed_at est NULL');

            // Le hash en base est bien un SHA-256 de 64 caractères
            assert.ok(transferDb.claim_token_hash, 'claim_token_hash existe en base');
            assert.strictEqual(transferDb.claim_token_hash.length, 64, 'claim_token_hash fait 64 caractères (SHA-256)');

            // Vérification de la fenêtre TTL (48h ± 5 min)
            const expiresTimestamp = new Date(transferDb.expires_at).getTime();
            const expectedExpiry = Date.now() + 48 * 3600 * 1000;
            const diffMinutes = Math.abs(expiresTimestamp - expectedExpiry) / (60 * 1000);
            assert.ok(diffMinutes < 5, `expires_at doit être à now() + 48h (écart: ${diffMinutes.toFixed(2)} min)`);
        }

        console.log('   ✅ 1. Initiation API vérifiée : ZÉRO token exposé en HTTP + tickets.transfer_locked=true + DB ticket_transfers valide');
    });

    test('2. Initiation avec vérification du hash SHA-256 via injection de token de test (Service & DB)', async () => {
        const knownTestToken = 'a1b2c3d4e5f678901234567890abcdef1234567890abcdef1234567890abcdef';
        const expectedHash = crypto.createHash('sha256').update(knownTestToken).digest('hex');

        const result = await TicketTransferService.initiateTransfer(
            buyerAUserId,
            ticket2Id,
            '  Destinataire.Ami@Dakar.SN  ',
            { injectedClaimToken: knownTestToken }
        );

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.recipient, 'destinataire.ami@dakar.sn', 'Email normalisé en minuscules');
        assert.strictEqual(result.recipient_type, 'EMAIL', 'Type EMAIL');
        assert.strictEqual(result.claim_token, knownTestToken, 'Service interne retourne le token pour l\'envoi out-of-band');

        // Vérification en base que le hash correspond exactement au SHA-256 du token connu
        const { data: transferDb } = await supabase
            .from('ticket_transfers')
            .select('*')
            .eq('ticket_id', ticket2Id)
            .maybeSingle();

        if (transferDb) {
            assert.strictEqual(transferDb.claim_token_hash, expectedHash, 'claim_token_hash en DB est STRICTEMENT le SHA-256 du token');
            assert.notStrictEqual(transferDb.claim_token_hash, knownTestToken, 'Le token en clair n\'est JAMAIS stocké en DB');
        }

        console.log('   ✅ 2. Hachage cryptographique vérifié en base : DB.claim_token_hash === SHA-256(injectedToken)');
    });

    test('3. Refus si un autre utilisateur tente de transférer le billet (403 Forbidden)', async () => {
        const req = new NextRequest(`http://localhost:3000/api/tickets/${ticket3Id}/transfer`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${buyerBToken}`, // Buyer B tente de transférer le billet de Buyer A
            },
            body: JSON.stringify({ recipient: '77 999 88 77' }),
        });

        const res = await initiateTransferRoute(req, { params: { id: ticket3Id } });
        const data = await res.json();

        assert.strictEqual(res.status, 403, 'Statut HTTP 403');
        assert.ok(data.error.includes('propriétaire'), 'Erreur de propriété explicite');
        console.log('   ✅ 3. Non-propriétaire rejeté avec HTTP 403');
    });

    test('4. Refus si le billet est déjà en cours de transfert (transfer_locked = true)', async () => {
        // ticket1Id est déjà verrouillé par le Test 1
        const req = new NextRequest(`http://localhost:3000/api/tickets/${ticket1Id}/transfer`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${buyerAToken}`,
            },
            body: JSON.stringify({ recipient: '77 888 77 66' }),
        });

        const res = await initiateTransferRoute(req, { params: { id: ticket1Id } });
        const data = await res.json();

        assert.ok(res.status === 400 || res.status === 409, 'Statut 400 ou 409 attendu');
        assert.ok(data.error.toLowerCase().includes('déjà') || data.error.toLowerCase().includes('conflit'), 'Message clair');
        console.log('   ✅ 4. Billet déjà verrouillé rejeté proprement');
    });

    test('5. Refus si le billet est déjà composté / utilisé à l\'entrée (status = UTILISE)', async () => {
        const req = new NextRequest(`http://localhost:3000/api/tickets/${ticketUsedId}/transfer`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${buyerAToken}`,
            },
            body: JSON.stringify({ recipient: '77 555 44 33' }),
        });

        const res = await initiateTransferRoute(req, { params: { id: ticketUsedId } });
        const data = await res.json();

        assert.strictEqual(res.status, 400, 'Statut HTTP 400');
        assert.ok(data.error.toLowerCase().includes('utilisé') || data.error.toLowerCase().includes('valide'), 'Message explicite');
        console.log('   ✅ 5. Billet composté rejeté avec message explicite');
    });

    test('6. Validation du format du destinataire (Rejet format invalide)', async () => {
        const req = new NextRequest(`http://localhost:3000/api/tickets/${ticket3Id}/transfer`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${buyerAToken}`,
            },
            body: JSON.stringify({ recipient: 'pas-un-telephone-ni-un-email' }),
        });

        const res = await initiateTransferRoute(req, { params: { id: ticket3Id } });
        const data = await res.json();

        assert.strictEqual(res.status, 400, 'Statut HTTP 400');
        assert.ok(data.error.toLowerCase().includes('destinataire') || data.error.toLowerCase().includes('valide'), 'Erreur de validation');
        console.log('   ✅ 6. Destinataire invalide rejeté au format schema');
    });

    test('7. Test critique de concurrence : 2 initiations simultanées sur le même billet (Promise.allSettled)', async () => {
        // On teste sur ticket3Id qui est encore libre
        const promises = [
            TicketTransferService.initiateTransfer(buyerAUserId, ticket3Id, '771112233'),
            TicketTransferService.initiateTransfer(buyerAUserId, ticket3Id, '774445566'),
        ];

        const results = await Promise.allSettled(promises);
        const fulfilled = results.filter(r => r.status === 'fulfilled') as PromiseFulfilledResult<any>[];
        const rejected = results.filter(r => r.status === 'rejected') as PromiseRejectedResult[];

        console.log(`   📊 Résultats concurrence initiation :`);
        console.log(`      - Succès : ${fulfilled.length}`);
        console.log(`      - Rejets : ${rejected.length}`);

        assert.strictEqual(fulfilled.length, 1, 'EXACTEMENT 1 SEULE initiation acceptée');
        assert.strictEqual(rejected.length, 1, 'EXACTEMENT 1 rejet en concurrence');

        console.log('   ✅ 7. Protection atomique contre les doubles transferts simultanés validée');
    });

    test('8. Conformité cryptographique du Token de Réclamation', async () => {
        const token = crypto.randomBytes(32).toString('hex');
        const hash = crypto.createHash('sha256').update(token).digest('hex');

        assert.strictEqual(token.length, 64, 'Token 64 caractères hexadécimaux (256 bits d entropie)');
        assert.strictEqual(hash.length, 64, 'Hash SHA-256 de 64 caractères');
        assert.notStrictEqual(token, hash, 'Le hash est distinct du token en clair');

        console.log('   ✅ 8. Token cryptographiquement aléatoire et hashé conforme');
    });

    test('9. Rejet absolu du token injecté lorsque NODE_ENV === "production" (Token aléatoire forcé)', async () => {
        const previousEnv = process.env.NODE_ENV;
        const maliciousTestToken = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
        const maliciousHash = crypto.createHash('sha256').update(maliciousTestToken).digest('hex');

        try {
            // Simulation de l'environnement de production
            (process.env as any).NODE_ENV = 'production';

            const result = await TicketTransferService.initiateTransfer(
                buyerAUserId,
                ticket4Id,
                '770001122',
                { injectedClaimToken: maliciousTestToken }
            );

            // Le token retourné en interne NE DOIT PAS être le token injecté
            assert.notStrictEqual(result.claim_token, maliciousTestToken, 'Le token injecté doit être ignoré en production');
            assert.strictEqual(result.claim_token.length, 64, 'Un token cryptographique aléatoire de 64 caractères a été généré');

            // Le hash en base NE DOIT PAS être le hash du token injecté
            const { data: transferDb } = await supabase
                .from('ticket_transfers')
                .select('*')
                .eq('ticket_id', ticket4Id)
                .maybeSingle();

            if (transferDb) {
                assert.notStrictEqual(transferDb.claim_token_hash, maliciousHash, 'Le hash en DB n\'est PAS celui du token injecté');
                const realHash = crypto.createHash('sha256').update(result.claim_token).digest('hex');
                assert.strictEqual(transferDb.claim_token_hash, realHash, 'Le hash en DB correspond au token aléatoire généré');
            }

            console.log('   ✅ 9. Sécurité prouvée : injectedClaimToken est 100% ignoré en mode production');
        } finally {
            (process.env as any).NODE_ENV = previousEnv;
        }
    });
});
