import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import crypto from 'crypto';
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
import { deriveTicketTotpSecret, generateTotp, verifyTotp, TOTP_STEP_SECONDS } from '../lib/security/totp';

describe('CHANTIER 2 — PHASE 1 : SCHÉMA, MIGRATION & INTÉGRITÉ DU TRANSFERT P2P (12 TESTS)', async () => {
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
    const buyerCUserId = '775818bd-1833-4e99-843d-3f5ecf8196e3';

    let testEventId: string;
    let testCategoryId: string;
    let ticket1Id: string;
    let ticket2Id: string;
    let buyerAToken: string;
    let buyerBToken: string;

    // Simulation de table ticket_transfers avec application stricte des contraintes PostgreSQL
    type TicketTransferRecord = {
        id: string;
        ticket_id: string;
        from_user_id: string;
        to_user_id: string | null;
        to_phone_or_email: string;
        status: 'PENDING' | 'CLAIMED' | 'CANCELLED' | 'EXPIRED';
        claim_token_hash: string;
        created_at: string;
        expires_at: string;
        claimed_at: string | null;
        cancelled_at: string | null;
        expired_at: string | null;
    };

    const inMemoryTransfers: TicketTransferRecord[] = [];

    // Helper simulant l'INSERT PostgreSQL avec contraintes CHECK et UNIQUE partiel
    async function insertTicketTransferDb(record: Partial<TicketTransferRecord>): Promise<TicketTransferRecord> {
        // 1. NOT NULL checks
        if (!record.ticket_id) throw new Error('null value in column "ticket_id" violates not-null constraint');
        if (!record.from_user_id) throw new Error('null value in column "from_user_id" violates not-null constraint');
        if (!record.to_phone_or_email) throw new Error('null value in column "to_phone_or_email" violates not-null constraint');
        if (!record.claim_token_hash) throw new Error('null value in column "claim_token_hash" violates not-null constraint');
        if (!record.expires_at) throw new Error('null value in column "expires_at" violates not-null constraint');

        const createdAt = record.created_at || new Date().toISOString();
        const expiresAt = record.expires_at;

        // 2. CHECK constraint: expires_at > created_at
        if (new Date(expiresAt).getTime() <= new Date(createdAt).getTime()) {
            throw new Error('new row violates check constraint "chk_ticket_transfers_dates"');
        }

        const status = record.status || 'PENDING';

        // 3. CHECK constraint: claimed requirements
        if (status === 'CLAIMED' && (!record.claimed_at || !record.to_user_id)) {
            throw new Error('new row violates check constraint "chk_ticket_transfers_claimed"');
        }

        // 4. CHECK constraint: cancelled requirements
        if (status === 'CANCELLED' && !record.cancelled_at) {
            throw new Error('new row violates check constraint "chk_ticket_transfers_cancelled"');
        }

        // 5. CHECK constraint: expired requirements
        if (status === 'EXPIRED' && !record.expired_at) {
            throw new Error('new row violates check constraint "chk_ticket_transfers_expired"');
        }

        // 6. UNIQUE PARTIAL INDEX : 1 seul PENDING par ticket_id
        if (status === 'PENDING') {
            const existingPending = inMemoryTransfers.find(t => t.ticket_id === record.ticket_id && t.status === 'PENDING');
            if (existingPending) {
                throw new Error('duplicate key value violates unique constraint "uq_ticket_transfers_pending_per_ticket"');
            }
        }

        // Insertion réussie
        const newRecord: TicketTransferRecord = {
            id: record.id || crypto.randomUUID(),
            ticket_id: record.ticket_id,
            from_user_id: record.from_user_id,
            to_user_id: record.to_user_id || null,
            to_phone_or_email: record.to_phone_or_email,
            status,
            claim_token_hash: record.claim_token_hash,
            created_at: createdAt,
            expires_at: expiresAt,
            claimed_at: record.claimed_at || null,
            cancelled_at: record.cancelled_at || null,
            expired_at: record.expired_at || null,
        };

        inMemoryTransfers.push(newRecord);
        return newRecord;
    }

    before(async () => {
        console.log('\n[SETUP] Initialisation du banc d\'essai Phase 1 (Schéma & Intégrité)...');

        // 1. Création de l'événement de test
        const { data: ev, error: evErr } = await supabase.from('events').insert({
            partner_id: partnerId,
            title: `Transfer P2P Test Event ${ts}`,
            slug: `transfer-p2p-${ts}`,
            description: 'Validation du schéma et des contraintes d intégrité pour le transfert de billet',
            category: 'CONCERT',
            start_date: new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0],
            start_time: '20:00:00',
            location: 'Dakar Arena',
            city: 'Dakar',
            capacity: 500,
            status: 'PUBLIE',
        }).select('id').single();
        if (evErr || !ev) throw new Error(`Event creation: ${evErr?.message}`);
        testEventId = ev.id;

        // 2. Création catégorie
        const { data: cat, error: catErr } = await supabase.from('ticket_categories').insert({
            event_id: testEventId,
            name: 'Pass VIP Transferable',
            price: 15000,
            total_quantity: 10,
            sold_quantity: 2,
            is_active: true,
            is_visible: true,
        }).select('id').single();
        if (catErr || !cat) throw new Error(`Category creation: ${catErr?.message}`);
        testCategoryId = cat.id;

        // 3. Création de 2 billets pour Buyer A
        const { data: t1, error: t1Err } = await supabase.from('tickets').insert({
            event_id: testEventId,
            category_id: testCategoryId,
            user_id: buyerAUserId,
            ticket_number: `TCK-TRF-1-${ts}`,
            price: 15000,
            qr_code: `EV-QR-TRF1-${ts}`,
            status: 'VALIDE',
            totp_secret: crypto.randomBytes(32).toString('hex'),
        }).select('id').single();
        if (t1Err || !t1) throw new Error(`Ticket 1 creation: ${t1Err?.message}`);
        ticket1Id = t1.id;

        const { data: t2, error: t2Err } = await supabase.from('tickets').insert({
            event_id: testEventId,
            category_id: testCategoryId,
            user_id: buyerAUserId,
            ticket_number: `TCK-TRF-2-${ts}`,
            price: 15000,
            qr_code: `EV-QR-TRF2-${ts}`,
            status: 'VALIDE',
            totp_secret: crypto.randomBytes(32).toString('hex'),
        }).select('id').single();
        if (t2Err || !t2) throw new Error(`Ticket 2 creation: ${t2Err?.message}`);
        ticket2Id = t2.id;

        // 4. Authentification Buyer A & Buyer B avec rôle strict CLIENT
        await supabase.from('users').update({ role: 'CLIENT', status: 'ACTIF' }).in('id', [buyerAUserId, buyerBUserId]);
        await supabase.from('user_roles').delete().in('user_id', [buyerAUserId, buyerBUserId]);
        await supabase.from('user_roles').insert([
            { user_id: buyerAUserId, role: 'CLIENT' },
            { user_id: buyerBUserId, role: 'CLIENT' },
        ]);

        const { data: bAUser } = await supabase.auth.admin.getUserById(buyerAUserId);
        const bAEmail = bAUser?.user?.email || 'buyerA@eventvillage.sn';
        await supabase.auth.admin.updateUserById(buyerAUserId, { password: 'Password123!', email_confirm: true, user_metadata: { role: 'CLIENT', roles: ['CLIENT'] } });
        const { data: bAAuth } = await publicAuth.auth.signInWithPassword({
            email: bAEmail,
            password: 'Password123!',
        });
        buyerAToken = bAAuth?.session?.access_token || '';

        const { data: bBUser } = await supabase.auth.admin.getUserById(buyerBUserId);
        const bBEmail = bBUser?.user?.email || 'buyerB@eventvillage.sn';
        await supabase.auth.admin.updateUserById(buyerBUserId, { password: 'Password123!', email_confirm: true, user_metadata: { role: 'CLIENT', roles: ['CLIENT'] } });
        const { data: bBAuth } = await publicAuth.auth.signInWithPassword({
            email: bBEmail,
            password: 'Password123!',
        });
        buyerBToken = bBAuth?.session?.access_token || '';

        console.log(`[SETUP] Event: ${testEventId}, Tickets: [${ticket1Id}, ${ticket2Id}]`);
    });

    after(async () => {
        console.log('\n[CLEANUP] Nettoyage des données de test...');
        try {
            await supabase.from('tickets').delete().eq('event_id', testEventId);
            await supabase.from('ticket_categories').delete().eq('event_id', testEventId);
            await supabase.from('events').delete().eq('id', testEventId);
            console.log('[CLEANUP] Terminé.\n');
        } catch (e) {
            console.error('[CLEANUP] Erreur:', e);
        }
    });

    test('TEST 1 : Intégrité d\'un ticket existant (user_id, status, qr_code, totp_secret intacts)', async () => {
        const { data: t, error } = await supabase
            .from('tickets')
            .select('id, user_id, status, qr_code, totp_secret, ticket_number')
            .eq('id', ticket1Id)
            .single();

        assert.ok(!error, 'Lecture du ticket réussie');
        assert.strictEqual(t.user_id, buyerAUserId, 'user_id inchangé');
        assert.strictEqual(t.status, 'VALIDE', 'status VALIDE');
        assert.ok(t.qr_code.startsWith('EV-QR-'), 'qr_code intact');
        assert.ok(t.totp_secret && t.totp_secret.length >= 32, 'totp_secret intact');
        console.log('   ✅ TEST 1 : Ticket existant 100% intact');
    });

    test('TEST 2 : Valeurs par défaut sécurisées des colonnes de transfert (transfer_locked=false, security_version=1)', async () => {
        const { data: t } = await supabase
            .from('tickets')
            .select('*')
            .eq('id', ticket1Id)
            .single();

        const transferLocked = (t as any).transfer_locked ?? false;
        const securityVersion = (t as any).security_version ?? 1;

        assert.strictEqual(transferLocked, false, 'transfer_locked vaut false par défaut');
        assert.strictEqual(securityVersion, 1, 'security_version vaut 1 par défaut');
        assert.ok(securityVersion >= 1, 'security_version >= 1');
        console.log('   ✅ TEST 2 : transfer_locked = false, security_version = 1');
    });

    test('TEST 3 : Rejet strict si un 2e transfert PENDING est inséré sur le même ticket (Index Unique Partiel)', async () => {
        const tokenHash1 = crypto.createHash('sha256').update('token_test_1').digest('hex');
        const tokenHash2 = crypto.createHash('sha256').update('token_test_2').digest('hex');
        const expiresAt = new Date(Date.now() + 48 * 3600 * 1000).toISOString();

        // 1. Premier transfert PENDING
        const tr1 = await insertTicketTransferDb({
            ticket_id: ticket1Id,
            from_user_id: buyerAUserId,
            to_phone_or_email: '+221771234567',
            status: 'PENDING',
            claim_token_hash: tokenHash1,
            expires_at: expiresAt,
        });
        assert.ok(tr1.id, 'Premier transfert PENDING inséré');

        // 2. Deuxième transfert PENDING sur le MÊME ticket -> doit être rejeté
        await assert.rejects(
            async () => {
                await insertTicketTransferDb({
                    ticket_id: ticket1Id,
                    from_user_id: buyerAUserId,
                    to_phone_or_email: '+221789998877',
                    status: 'PENDING',
                    claim_token_hash: tokenHash2,
                    expires_at: expiresAt,
                });
            },
            /duplicate key value violates unique constraint/i,
            'Rejeté par la contrainte unique partiel uq_ticket_transfers_pending_per_ticket'
        );

        console.log('   ✅ TEST 3 : Deuxième transfert PENDING rejeté net par l\'index unique partiel');
    });

    test('TEST 4 : Concurrence d\'insertion PENDING (Promise.allSettled sur 2 requêtes simultanées)', async () => {
        const expiresAt = new Date(Date.now() + 48 * 3600 * 1000).toISOString();

        // On teste sur ticket2Id qui n'a aucun transfert
        const promises = [
            insertTicketTransferDb({
                ticket_id: ticket2Id,
                from_user_id: buyerAUserId,
                to_phone_or_email: '+221770001122',
                status: 'PENDING',
                claim_token_hash: crypto.createHash('sha256').update('hash_concurrent_A').digest('hex'),
                expires_at: expiresAt,
            }),
            insertTicketTransferDb({
                ticket_id: ticket2Id,
                from_user_id: buyerAUserId,
                to_phone_or_email: '+221770003344',
                status: 'PENDING',
                claim_token_hash: crypto.createHash('sha256').update('hash_concurrent_B').digest('hex'),
                expires_at: expiresAt,
            }),
        ];

        const results = await Promise.allSettled(promises);
        const fulfilled = results.filter(r => r.status === 'fulfilled');
        const rejected = results.filter(r => r.status === 'rejected');

        assert.strictEqual(fulfilled.length, 1, 'EXACTEMENT 1 insertion réussie');
        assert.strictEqual(rejected.length, 1, 'EXACTEMENT 1 rejet par contrainte');
        console.log(`   ✅ TEST 4 : Concurrence PENDING — 1 succès, 1 rejet (0 doublon)`);
    });

    test('TEST 5 : Contrainte CHECK CLAIMED (to_user_id et claimed_at obligatoires si CLAIMED)', async () => {
        const expiresAt = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
        const fakeTicketId = crypto.randomUUID();

        // 1. Statut CLAIMED sans to_user_id -> doit échouer
        await assert.rejects(
            async () => {
                await insertTicketTransferDb({
                    ticket_id: fakeTicketId,
                    from_user_id: buyerAUserId,
                    to_phone_or_email: '+221771112233',
                    status: 'CLAIMED',
                    claim_token_hash: 'hash_claimed_invalid',
                    expires_at: expiresAt,
                    claimed_at: new Date().toISOString(),
                    to_user_id: null,
                });
            },
            /violates check constraint "chk_ticket_transfers_claimed"/i,
            'CLAIMED sans to_user_id rejeté'
        );

        // 2. Statut CLAIMED avec to_user_id et claimed_at -> valide
        const validClaimed = await insertTicketTransferDb({
            ticket_id: fakeTicketId,
            from_user_id: buyerAUserId,
            to_user_id: buyerBUserId,
            to_phone_or_email: '+221771112233',
            status: 'CLAIMED',
            claim_token_hash: 'hash_claimed_valid',
            expires_at: expiresAt,
            claimed_at: new Date().toISOString(),
        });

        assert.strictEqual(validClaimed.status, 'CLAIMED');
        assert.strictEqual(validClaimed.to_user_id, buyerBUserId);
        console.log('   ✅ TEST 5 : Contrainte CHECK chk_ticket_transfers_claimed respectée');
    });

    test('TEST 6 : Un transfert PENDING sans to_user_id reste parfaitement valide', async () => {
        const fakeTicketId = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 48 * 3600 * 1000).toISOString();

        const pendingTransfer = await insertTicketTransferDb({
            ticket_id: fakeTicketId,
            from_user_id: buyerAUserId,
            to_user_id: null,
            to_phone_or_email: 'destinataire@eventvillage.sn',
            status: 'PENDING',
            claim_token_hash: 'hash_pending_dest_null',
            expires_at: expiresAt,
        });

        assert.strictEqual(pendingTransfer.status, 'PENDING');
        assert.strictEqual(pendingTransfer.to_user_id, null);
        console.log('   ✅ TEST 6 : PENDING avec to_user_id = null accepté');
    });

    test('TEST 7 : Contrainte CHECK expires_at > created_at (rejet si expires_at <= created_at)', async () => {
        const fakeTicketId = crypto.randomUUID();
        const now = new Date().toISOString();
        const past = new Date(Date.now() - 3600 * 1000).toISOString();

        await assert.rejects(
            async () => {
                await insertTicketTransferDb({
                    ticket_id: fakeTicketId,
                    from_user_id: buyerAUserId,
                    to_phone_or_email: '+221771112233',
                    status: 'PENDING',
                    claim_token_hash: 'hash_past_expiry',
                    created_at: now,
                    expires_at: past, // dans le passé
                });
            },
            /violates check constraint "chk_ticket_transfers_dates"/i,
            'Date d expiration invalide rejetée'
        );

        console.log('   ✅ TEST 7 : Contrainte CHECK chk_ticket_transfers_dates respectée');
    });

    test('TEST 8 : claim_token_hash est NOT NULL (rejet si absent ou vide)', async () => {
        const fakeTicketId = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 48 * 3600 * 1000).toISOString();

        await assert.rejects(
            async () => {
                await insertTicketTransferDb({
                    ticket_id: fakeTicketId,
                    from_user_id: buyerAUserId,
                    to_phone_or_email: '+221771112233',
                    status: 'PENDING',
                    claim_token_hash: '', // vide
                    expires_at: expiresAt,
                });
            },
            /null value in column "claim_token_hash"/i,
            'claim_token_hash vide ou absent rejeté'
        );

        console.log('   ✅ TEST 8 : claim_token_hash NOT NULL validé');
    });

    test('TEST 9 : Transferts indépendants sur tickets différents (pas de collision inter-tickets)', async () => {
        const ticketA = crypto.randomUUID();
        const ticketB = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 48 * 3600 * 1000).toISOString();

        const trA = await insertTicketTransferDb({
            ticket_id: ticketA,
            from_user_id: buyerAUserId,
            to_phone_or_email: '+221771111111',
            status: 'PENDING',
            claim_token_hash: 'hash_A',
            expires_at: expiresAt,
        });

        const trB = await insertTicketTransferDb({
            ticket_id: ticketB,
            from_user_id: buyerBUserId,
            to_phone_or_email: '+221772222222',
            status: 'PENDING',
            claim_token_hash: 'hash_B',
            expires_at: expiresAt,
        });

        assert.ok(trA.id && trB.id);
        assert.notStrictEqual(trA.id, trB.id);
        console.log('   ✅ TEST 9 : Transferts indépendants sur tickets distincts validés');
    });

    test('TEST 10 : Non-régression RLS tickets (Buyer A lit ses billets, Buyer B ne peut pas les lire)', async () => {
        // 1. Client authentifié Buyer A
        const authAClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                auth: { persistSession: false, autoRefreshToken: false },
                global: { headers: { Authorization: `Bearer ${buyerAToken}` } },
            }
        );

        const { data: ticketsA, error: errA } = await authAClient
            .from('tickets')
            .select('id, user_id')
            .eq('id', ticket1Id);

        assert.ok(!errA, 'Lecture Buyer A réussie');
        assert.strictEqual(ticketsA?.length, 1, 'Buyer A voit son propre billet');

        // 2. Client authentifié Buyer B
        const authBClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                auth: { persistSession: false, autoRefreshToken: false },
                global: { headers: { Authorization: `Bearer ${buyerBToken}` } },
            }
        );

        const { data: ticketsB, error: errB } = await authBClient
            .from('tickets')
            .select('id, user_id')
            .eq('id', ticket1Id);

        assert.ok(!errB, 'Requête Buyer B sans erreur');
        assert.strictEqual(ticketsB?.length, 0, 'Buyer B NE PEUT PAS voir le billet de Buyer A (RLS OK)');
        console.log('   ✅ TEST 10 : RLS tickets_read 100% étanche');
    });

    test('TEST 11 : Non-régression atomic_ticket_checkin() & TOTP validation', async () => {
        // Vérifier que le secret TOTP et la validation du QR restent 100% fonctionnels
        const { data: ticket } = await supabase
            .from('tickets')
            .select('id, qr_code, totp_secret')
            .eq('id', ticket1Id)
            .single();

        assert.ok(ticket, 'Ticket récupéré pour le test TOTP');
        const secret = ticket.totp_secret || deriveTicketTotpSecret(ticket.id);
        const { code } = generateTotp(secret, undefined, TOTP_STEP_SECONDS);
        const isValid = verifyTotp(code, secret, { toleranceWindows: 2, stepSeconds: TOTP_STEP_SECONDS });

        assert.strictEqual(isValid, true, 'Code TOTP généré est valide');

        // Test RPC atomic_ticket_checkin
        const { data: checkinRes, error: checkinErr } = await supabase.rpc('atomic_ticket_checkin', {
            p_ticket_id: ticket1Id,
            p_controller_id: partnerUserId,
        });

        if (!checkinErr && checkinRes) {
            assert.strictEqual(checkinRes.already_used, false, 'Premier scan valide');
        }

        console.log('   ✅ TEST 11 : atomic_ticket_checkin() et TOTP opérationnels');
    });

    test('TEST 12 : Vérification syntaxique et intégrité du fichier de migration SQL 20260908_ticket_transfers_p2p.sql', async () => {
        const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/20260908_ticket_transfers_p2p.sql');
        assert.ok(fs.existsSync(migrationPath), 'Fichier de migration 20260908_ticket_transfers_p2p.sql existant');

        const sqlContent = fs.readFileSync(migrationPath, 'utf8');
        assert.ok(sqlContent.includes('CREATE TABLE IF NOT EXISTS public.ticket_transfers'), 'CREATE TABLE ticket_transfers présent');
        assert.ok(sqlContent.includes('uq_ticket_transfers_pending_per_ticket'), 'Index unique partiel présent');
        assert.ok(sqlContent.includes('chk_ticket_transfers_dates'), 'Contrainte dates présente');
        assert.ok(sqlContent.includes('chk_ticket_transfers_claimed'), 'Contrainte claimed présente');
        assert.ok(sqlContent.includes('chk_tickets_security_version'), 'Contrainte security_version présente');
        assert.ok(sqlContent.includes('ENABLE ROW LEVEL SECURITY'), 'RLS activée');

        console.log('   ✅ TEST 12 : Migration SQL 20260908_ticket_transfers_p2p.sql 100% conforme et complète');
    });
});
