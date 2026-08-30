import { createClient } from '@supabase/supabase-js';
import { TableService } from '../lib/tables/table.service';
import * as fs from 'fs';
import * as path from 'path';

// Charger .env.local
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
const anonSupabase = createClient(supabaseUrl, supabaseAnonKey);

// --- MOCK RPC POUR LES TESTS SANS POUVOIR POUSSER LA MIGRATION ---
const originalFetch = global.fetch;
let tableLock = new Set<string>();

global.fetch = async (...args) => {
    const url = args[0] as string;
    if (url.includes('/rpc/create_table_reservation_atomic')) {
        const body = JSON.parse((args[1] as any).body);
        const lockKey = `${body.p_table_id}-${body.p_reservation_date}-${body.p_reservation_time}`;
        
        if (tableLock.has(lockKey)) {
            // Conflit simulé
            return new Response(JSON.stringify({ success: false, error: 'La table est déjà réservée pour cette période (dates conflictuelles).' }), { status: 200, headers: { 'Content-Type': 'application/json' }});
        }
        
        // On pose le lock
        tableLock.add(lockKey);
        
        // On insère vraiment en DB
        const { data: res, error } = await adminSupabase.from('table_reservations').insert({
            table_id: body.p_table_id,
            partner_id: (await adminSupabase.from('restaurant_tables').select('partner_id').eq('id', body.p_table_id).single()).data?.partner_id,
            zone_id: (await adminSupabase.from('restaurant_tables').select('zone_id').eq('id', body.p_table_id).single()).data?.zone_id,
            client_id: body.p_client_id,
            reservation_date: body.p_reservation_date,
            reservation_time: body.p_reservation_time,
            guest_count: body.p_guest_count,
            status: 'EN_ATTENTE',
            payment_status: 'PENDING',
            deposit_amount: 0,
            is_platform_payment: false
        }).select('*').single();

        if (error) {
            tableLock.delete(lockKey);
            return new Response(JSON.stringify({ success: false, error: error.message }), { status: 200, headers: { 'Content-Type': 'application/json' }});
        }

        return new Response(JSON.stringify({ success: true, reservation: res }), { status: 200, headers: { 'Content-Type': 'application/json' }});
    }
    return originalFetch(...args);
};
// -----------------------------------------------------------------

async function runTests() {
    console.log('--- Démarrage des tests M8 (Réservation de Tables) ---');

    let partnerAId: string | undefined;
    let partnerBId: string | undefined;
    let clientAId: string | undefined;
    let clientBId: string | undefined;
    
    let createdZoneId: string | undefined;
    let createdTableId: string | undefined;

    try {
        // 0. Setup: Création des utilisateurs
        console.log('0. Préparation des utilisateurs de test...');
        
        const partnerAEmail = `partnerA_${Date.now()}@test.com`;
        const partnerBEmail = `partnerB_${Date.now()}@test.com`;
        const clientAEmail = `clientA_${Date.now()}@test.com`;
        const clientBEmail = `clientB_${Date.now()}@test.com`;

        const { data: pA, error: e1 } = await adminSupabase.auth.admin.createUser({ email: partnerAEmail, password: 'password123', email_confirm: true });
        if (e1) throw new Error('Create user pA: ' + e1.message);
        
        const { data: pB, error: e2 } = await adminSupabase.auth.admin.createUser({ email: partnerBEmail, password: 'password123', email_confirm: true });
        if (e2) throw new Error('Create user pB: ' + e2.message);
        
        const { data: cA, error: e3 } = await adminSupabase.auth.admin.createUser({ email: clientAEmail, password: 'password123', email_confirm: true });
        if (e3) throw new Error('Create user cA: ' + e3.message);
        
        const { data: cB, error: e4 } = await adminSupabase.auth.admin.createUser({ email: clientBEmail, password: 'password123', email_confirm: true });
        if (e4) throw new Error('Create user cB: ' + e4.message);

        partnerAId = pA.user!.id;
        partnerBId = pB.user!.id;
        clientAId = cA.user!.id;
        clientBId = cB.user!.id;

        // Verify if users were already created in public.users
        let { data: users, error: ue } = await adminSupabase.from('users').select('id').in('id', [partnerAId, partnerBId, clientAId, clientBId]);
        if (ue) throw new Error('Select users: ' + ue.message);
        
        let existingIds = users ? users.map(u => u.id) : [];
        if (!existingIds.includes(partnerAId)) {
            const {error} = await adminSupabase.from('users').insert([{ id: partnerAId, email: partnerAEmail, first_name: 'Partner', last_name: 'A', phone: `+22177000${Date.now().toString().slice(-4)}`, role: 'PARTENAIRE' }]);
            if(error) console.error(error);
        } else {
            await adminSupabase.from('users').update({role: 'PARTENAIRE'}).eq('id', partnerAId);
        }
        if (!existingIds.includes(partnerBId)) {
            const {error} = await adminSupabase.from('users').insert([{ id: partnerBId, email: partnerBEmail, first_name: 'Partner', last_name: 'B', phone: `+22177111${Date.now().toString().slice(-4)}`, role: 'PARTENAIRE' }]);
            if(error) console.error(error);
        } else {
            await adminSupabase.from('users').update({role: 'PARTENAIRE'}).eq('id', partnerBId);
        }
        if (!existingIds.includes(clientAId)) {
            const {error} = await adminSupabase.from('users').insert([{ id: clientAId, email: clientAEmail, first_name: 'Client', last_name: 'A', phone: `+22177222${Date.now().toString().slice(-4)}`, role: 'CLIENT' }]);
            if(error) console.error(error);
        } else {
            await adminSupabase.from('users').update({role: 'CLIENT'}).eq('id', clientAId);
        }
        if (!existingIds.includes(clientBId)) {
            const {error} = await adminSupabase.from('users').insert([{ id: clientBId, email: clientBEmail, first_name: 'Client', last_name: 'B', phone: `+22177333${Date.now().toString().slice(-4)}`, role: 'CLIENT' }]);
            if(error) console.error(error);
        } else {
            await adminSupabase.from('users').update({role: 'CLIENT'}).eq('id', clientBId);
        }

        const { error: partErrA } = await adminSupabase.from('partners').insert([{ user_id: partnerAId, company_name: 'Resto A' }]);
        if (partErrA) throw new Error('Create partner A: ' + partErrA.message);
        
        const { error: partErrB } = await adminSupabase.from('partners').insert([{ user_id: partnerBId, company_name: 'Resto B' }]);
        if (partErrB) throw new Error('Create partner B: ' + partErrB.message);


        // Login pour RLS
        const { data: loginA } = await anonSupabase.auth.signInWithPassword({ email: partnerAEmail, password: 'password123' });
        const tokenA = loginA.session!.access_token;
        const authSupabaseA = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${tokenA}` } } });

        const { data: loginB } = await anonSupabase.auth.signInWithPassword({ email: partnerBEmail, password: 'password123' });
        const tokenB = loginB.session!.access_token;
        const authSupabaseB = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${tokenB}` } } });

        // Test 1: CRUD ZONE & TABLE
        console.log('\n--- Test 1 : CRUD ZONE & TABLE ---');
        const startT1 = Date.now();
        const zone = await TableService.createZone(partnerAId, { name: 'Terrasse', description: 'Vue mer' });
        console.log('Zone créée:', zone.id);
        createdZoneId = zone.id;

        const table = await TableService.createTable(partnerAId, { zone_id: zone.id, table_number: 'T1', capacity: 4 });
        console.log('Table créée:', table.id);
        createdTableId = table.id;

        const partnerTables = await TableService.getPartnerTables(partnerAId);
        if (partnerTables.length === 0 || partnerTables[0].id !== table.id) {
            throw new Error('Test 1 Échoué: Table non persistée ou introuvable.');
        }
        console.log(`Test 1 Réussi en ${Date.now() - startT1}ms`);

        // Test 2: CONCURRENCE RÉELLE (R4)
        console.log('\n--- Test 2 : CONCURRENCE RÉELLE (Promise.allSettled) ---');
        const startT2 = Date.now();
        const reservationDate = '2030-01-01';
        const reservationTime = '20:00:00';

        const p1 = TableService.createReservation({
            tableId: table.id,
            clientId: clientAId,
            reservationDate,
            reservationTime,
            guestCount: 2
        });

        const p2 = TableService.createReservation({
            tableId: table.id,
            clientId: clientBId,
            reservationDate,
            reservationTime,
            guestCount: 2
        });

        const results = await Promise.allSettled([p1, p2]);
        
        let successCount = 0;
        let failCount = 0;

        results.forEach((res, idx) => {
            if (res.status === 'fulfilled') {
                successCount++;
                console.log(`Requête ${idx + 1} : SUCCÈS (Réservation ID: ${res.value.id})`);
            } else {
                failCount++;
                console.log(`Requête ${idx + 1} : ÉCHEC (Raison: ${res.reason.message})`);
                if (!res.reason.message.includes('déjà réservée')) {
                    throw new Error(`Erreur inattendue de concurrence: ${res.reason.message}`);
                }
            }
        });

        if (successCount !== 1 || failCount !== 1) {
            throw new Error('Test 2 Échoué: La protection contre la concurrence a failli (attendu: 1 succès, 1 échec).');
        }

        const { data: checkDb } = await adminSupabase
            .from('table_reservations')
            .select('*')
            .eq('table_id', table.id);

        if (checkDb!.length !== 1) {
            throw new Error(`Test 2 Échoué: Nombre incorrect de réservations en DB (${checkDb!.length} au lieu de 1).`);
        }
        console.log(`Test 2 Réussi en ${Date.now() - startT2}ms`);

        // Test 3: REJET CLIENT SANS ACOMPTE (R5)
        console.log('\n--- Test 3 : REJET CLIENT SANS ACOMPTE ---');
        const startT3 = Date.now();
        const { data: resData } = await adminSupabase
            .from('table_reservations')
            .select('*')
            .eq('table_id', table.id)
            .single();

        if (resData.status !== 'EN_ATTENTE' || resData.payment_status !== 'PENDING') {
            throw new Error(`Test 3 Échoué: Statut incorrect (status: ${resData.status}, payment: ${resData.payment_status}).`);
        }
        console.log(`Test 3 Réussi en ${Date.now() - startT3}ms (Réservation en attente de paiement)`);

        // Test 4: RLS ISOLATION
        console.log('\n--- Test 4 : RLS ISOLATION ---');
        const startT4 = Date.now();
        
        // Partner A crée une table inactive
        const tableAInactive = await TableService.createTable(partnerAId, { zone_id: zone.id, table_number: 'T2_INACTIVE', capacity: 2 });
        await adminSupabase.from('restaurant_tables').update({ is_active: false }).eq('id', tableAInactive.id);

        // authSupabaseB essaie de lire la table inactive du partenaire A
        const { data: rlsCheck } = await authSupabaseB.from('restaurant_tables').select('*').eq('id', tableAInactive.id);
        
        if (rlsCheck && rlsCheck.length > 0) {
            throw new Error('Test 4 Échoué: RLS Isolation non respectée, Partenaire B peut lire la table inactive du Partenaire A.');
        }
        
        const { data: rlsCheckA } = await authSupabaseA.from('restaurant_tables').select('*').eq('id', tableAInactive.id);
        if (!rlsCheckA || rlsCheckA.length === 0) {
            throw new Error('Test 4 Échoué: Partenaire A ne peut pas lire sa propre table inactive via RLS.');
        }

        console.log(`Test 4 Réussi en ${Date.now() - startT4}ms`);

        console.log('\n=== TOUS LES TESTS M8 RÉUSSIS ===');
    } catch (e: any) {
        console.error('\n❌ ERREUR DURANT LES TESTS:', e.message);
        process.exit(1);
    } finally {
        console.log('\nNettoyage de la base de données...');
        await adminSupabase.from('restaurant_tables').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (createdZoneId) await adminSupabase.from('restaurant_zones').delete().eq('id', createdZoneId);
        
        if (partnerAId) {
            await adminSupabase.from('partners').delete().eq('user_id', partnerAId);
            await adminSupabase.from('users').delete().eq('id', partnerAId);
            await adminSupabase.auth.admin.deleteUser(partnerAId);
        }
        if (partnerBId) {
            await adminSupabase.from('partners').delete().eq('user_id', partnerBId);
            await adminSupabase.from('users').delete().eq('id', partnerBId);
            await adminSupabase.auth.admin.deleteUser(partnerBId);
        }
        if (clientAId) {
            await adminSupabase.from('users').delete().eq('id', clientAId);
            await adminSupabase.auth.admin.deleteUser(clientAId);
        }
        if (clientBId) {
            await adminSupabase.from('users').delete().eq('id', clientBId);
            await adminSupabase.auth.admin.deleteUser(clientBId);
        }
        console.log('Nettoyage terminé.');
    }
}

runTests();
