import { test } from 'node:test';
import assert from 'node:assert';
import { HallService } from '../lib/halls/hall.service';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Chargement de l'environnement local
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
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

test('1. CONFIGURATION SALLE (§42/§45) : Création avec acompte personnalisé (40%) et persistance en base', async () => {
    if (!supabaseUrl || !serviceRoleKey) return;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const suffix = Date.now().toString().slice(-6);
    const phone = `+22177${Math.floor(1000000 + Math.random() * 9000000)}`;
    const email = `partner.hall.${suffix}@eventvillage.sn`;

    const { data: authUser } = await adminClient.auth.admin.createUser({
        email, password: 'Password123!', email_confirm: true, phone, phone_confirm: true,
        user_metadata: { first_name: 'Propriétaire', last_name: 'Salle', phone },
    });
    if (!authUser?.user) throw new Error('Création utilisateur échouée');
    const partnerUserId = authUser.user.id;

    await adminClient.from('users').upsert({
        id: partnerUserId, email, phone, first_name: 'Propriétaire', last_name: 'Salle', role: 'PARTENAIRE', status: 'ACTIF'
    });

    const { data: partner } = await adminClient.from('partners').insert({
        user_id: partnerUserId, company_name: 'Espace Prestige Dakar', phone, status: 'VALIDE'
    }).select('id').single();
    if (!partner?.id) throw new Error('Création partenaire échouée');

    let hallId: string | null = null;

    try {
        // Création de la salle avec acompte personnalisé à 40.0% (CDC §45)
        const hall = await HallService.createHall(partnerUserId, {
            name: 'Grand Salon Teranga',
            description: 'Salle de réception climatisée avec scène et projecteur',
            capacity: 350,
            price_per_day: 250000,
            price_per_hour: 35000,
            deposit_percentage: 40.0, // Taux configurable
            address: 'Almadies Zone 2',
            city: 'Dakar',
            amenities: ['Climatisation', 'Wifi', 'Scène', 'Parking VIP', 'Groupe Électrogène'],
        });

        hallId = hall.id;
        assert.ok(hall.id, 'La salle a été créée avec succès');
        assert.strictEqual(hall.name, 'Grand Salon Teranga');
        assert.strictEqual(Number(hall.deposit_percentage), 40.0, 'Le taux d\'acompte en base doit être de 40.0%');

        // Re-lecture directe en base de données
        const { data: dbHall, error: fetchErr } = await adminClient
            .from('halls')
            .select('*')
            .eq('id', hall.id)
            .single();

        assert.ok(!fetchErr && dbHall, 'Relecture DB de la salle');
        assert.strictEqual(Number(dbHall.deposit_percentage), 40.0, 'Persistance de deposit_percentage = 40.0%');
        assert.strictEqual(Number(dbHall.price_per_day), 250000, 'Persistance du tarif journalier = 250 000 FCFA');
        assert.strictEqual(dbHall.capacity, 350, 'Persistance de la capacité = 350');
    } finally {
        if (hallId) await adminClient.from('halls').delete().eq('id', hallId);
        await adminClient.from('partners').delete().eq('id', partner.id);
        await adminClient.from('users').delete().eq('id', partnerUserId);
        await adminClient.auth.admin.deleteUser(partnerUserId);
    }
});

test('2. DISPONIBILITÉ & CONCURRENCE RÉELLE (§43-§44) : Deux réservations simultanées (Promise.allSettled) sur dates chevauchantes -> 1 Succès, 1 Échec, 1 seule ligne en base', async () => {
    if (!supabaseUrl || !serviceRoleKey) return;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const suffix = Date.now().toString().slice(-6);
    const phoneP = `+22177${Math.floor(1000000 + Math.random() * 9000000)}`;
    const phoneC1 = `+22176${Math.floor(1000000 + Math.random() * 9000000)}`;
    const phoneC2 = `+22175${Math.floor(1000000 + Math.random() * 9000000)}`;

    const { data: authP } = await adminClient.auth.admin.createUser({
        email: `partner.conflict.${suffix}@eventvillage.sn`, password: 'Password123!', email_confirm: true, phone: phoneP, phone_confirm: true,
        user_metadata: { first_name: 'P', last_name: 'P', phone: phoneP },
    });
    const { data: authC1 } = await adminClient.auth.admin.createUser({
        email: `client1.conflict.${suffix}@eventvillage.sn`, password: 'Password123!', email_confirm: true, phone: phoneC1, phone_confirm: true,
        user_metadata: { first_name: 'C1', last_name: 'C1', phone: phoneC1 },
    });
    const { data: authC2 } = await adminClient.auth.admin.createUser({
        email: `client2.conflict.${suffix}@eventvillage.sn`, password: 'Password123!', email_confirm: true, phone: phoneC2, phone_confirm: true,
        user_metadata: { first_name: 'C2', last_name: 'C2', phone: phoneC2 },
    });

    if (!authP?.user || !authC1?.user || !authC2?.user) throw new Error('Création utilisateurs échouée');
    const partnerUserId = authP.user.id;
    const client1Id = authC1.user.id;
    const client2Id = authC2.user.id;

    await adminClient.from('users').upsert([
        { id: partnerUserId, email: `partner.conflict.${suffix}@eventvillage.sn`, phone: phoneP, first_name: 'P', last_name: 'P', role: 'PARTENAIRE', status: 'ACTIF' },
        { id: client1Id, email: `client1.conflict.${suffix}@eventvillage.sn`, phone: phoneC1, first_name: 'C1', last_name: 'C1', role: 'CLIENT', status: 'ACTIF' },
        { id: client2Id, email: `client2.conflict.${suffix}@eventvillage.sn`, phone: phoneC2, first_name: 'C2', last_name: 'C2', role: 'CLIENT', status: 'ACTIF' }
    ]);

    const { data: partner } = await adminClient.from('partners').insert({
        user_id: partnerUserId, company_name: 'Espace Calendrier Test Concurrency', phone: phoneP, status: 'VALIDE'
    }).select('id').single();
    if (!partner?.id) throw new Error('Création partenaire échouée');

    const { data: hall } = await adminClient.from('halls').insert({
        partner_id: partner.id, name: 'Salle Renaissance Concurrency', capacity: 200, price_per_day: 150000, deposit_percentage: 30.0
    }).select('id').single();
    if (!hall?.id) throw new Error('Création salle échouée');

    try {
        // EXÉCUTION CONCURRENTE RÉELLE VIA Promise.allSettled()
        // Deux clients tentent de réserver simultanément la salle sur des dates chevauchantes :
        // Client 1 : 2026-11-10 au 2026-11-15
        // Client 2 : 2026-11-12 au 2026-11-18 (Chevauchement du 12 au 15)
        const [result1, result2] = await Promise.allSettled([
            HallService.createReservation({
                hallId: hall.id,
                clientId: client1Id,
                startDate: '2026-11-10',
                endDate: '2026-11-15',
                notes: 'Mariage traditionnel Client 1',
            }),
            HallService.createReservation({
                hallId: hall.id,
                clientId: client2Id,
                startDate: '2026-11-12',
                endDate: '2026-11-18',
                notes: 'Séminaire d\'entreprise Client 2',
            }),
        ]);

        console.log('--- RÉSULTATS DU TEST DE CONCURRENCE RÉSERVATION SALLE ---');
        console.log('Client 1 Result:', result1.status, result1.status === 'fulfilled' ? result1.value.id : (result1 as PromiseRejectedResult).reason.message);
        console.log('Client 2 Result:', result2.status, result2.status === 'fulfilled' ? result2.value.id : (result2 as PromiseRejectedResult).reason.message);

        // Assertion 1 : Exactement une promesse réussit et l'autre est rejetée
        const fulfilledCount = (result1.status === 'fulfilled' ? 1 : 0) + (result2.status === 'fulfilled' ? 1 : 0);
        const rejectedCount = (result1.status === 'rejected' ? 1 : 0) + (result2.status === 'rejected' ? 1 : 0);

        assert.strictEqual(fulfilledCount, 1, 'EXACTEMENT UNE SEULE réservation concurrente sur dates chevauchantes doit réussir');
        assert.strictEqual(rejectedCount, 1, 'EXACTEMENT UNE SEULE réservation concurrente doit être rejetée pour conflit de dates');

        // Assertion 2 : Le message d'erreur explicite le conflit de dates
        const rejectedResult = result1.status === 'rejected' ? (result1 as PromiseRejectedResult) : (result2 as PromiseRejectedResult);
        assert.ok(
            rejectedResult.reason.message.includes('déjà réservée pour cette période'),
            `Le message de rejet doit expliciter le conflit de calendrier (Reçu: ${rejectedResult.reason.message})`
        );

        // Assertion 3 : Relecture directe en base de données — confirmation qu'une seule réservation existe pour cette salle
        const { data: dbReservations, error: fetchErr } = await adminClient
            .from('hall_reservations')
            .select('id, start_date, end_date, status')
            .eq('hall_id', hall.id)
            .in('status', ['EN_ATTENTE', 'CONFIRMEE']);

        assert.ok(!fetchErr, 'Relecture des réservations actives en base');
        assert.strictEqual(dbReservations?.length, 1, 'La base de données ne doit contenir STRICTEMENT qu\'une seule réservation active');

        const winningReservation = result1.status === 'fulfilled' ? result1.value : (result2 as PromiseFulfilledResult<any>).value;
        assert.strictEqual(dbReservations?.[0]?.id, winningReservation.id, 'L\'ID en base correspond à la réservation gagnante');
    } finally {
        await adminClient.from('hall_reservations').delete().eq('hall_id', hall.id);
        await adminClient.from('halls').delete().eq('id', hall.id);
        await adminClient.from('partners').delete().eq('id', partner.id);
        await adminClient.from('users').delete().in('id', [partnerUserId, client1Id, client2Id]);
        await adminClient.auth.admin.deleteUser(partnerUserId);
        await adminClient.auth.admin.deleteUser(client1Id);
        await adminClient.auth.admin.deleteUser(client2Id);
    }
});

test('3. INVARIANT FINANCIER ACOMPTE + SOLDE = TOTAL (§45-§47) & MORATOIRE', async () => {
    if (!supabaseUrl || !serviceRoleKey) return;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const suffix = Date.now().toString().slice(-6);
    const phoneP = `+22177${Math.floor(1000000 + Math.random() * 9000000)}`;
    const phoneC = `+22176${Math.floor(1000000 + Math.random() * 9000000)}`;

    const { data: authP } = await adminClient.auth.admin.createUser({
        email: `partner.fin.${suffix}@eventvillage.sn`, password: 'Password123!', email_confirm: true, phone: phoneP, phone_confirm: true,
        user_metadata: { first_name: 'P', last_name: 'P', phone: phoneP },
    });
    const { data: authC } = await adminClient.auth.admin.createUser({
        email: `client.fin.${suffix}@eventvillage.sn`, password: 'Password123!', email_confirm: true, phone: phoneC, phone_confirm: true,
        user_metadata: { first_name: 'C', last_name: 'C', phone: phoneC },
    });

    if (!authP?.user || !authC?.user) throw new Error('Création utilisateurs échouée');
    const partnerUserId = authP.user.id;
    const clientId = authC.user.id;

    await adminClient.from('users').upsert([
        { id: partnerUserId, email: `partner.fin.${suffix}@eventvillage.sn`, phone: phoneP, first_name: 'P', last_name: 'P', role: 'PARTENAIRE', status: 'ACTIF' },
        { id: clientId, email: `client.fin.${suffix}@eventvillage.sn`, phone: phoneC, first_name: 'C', last_name: 'C', role: 'CLIENT', status: 'ACTIF' }
    ]);

    const { data: partner } = await adminClient.from('partners').insert({
        user_id: partnerUserId, company_name: 'Finances Salles SA', phone: phoneP, status: 'VALIDE'
    }).select('id').single();
    if (!partner?.id) throw new Error('Création partenaire échouée');

    // Salle à 120 000 FCFA/jour avec acompte de 35.0%
    const { data: hall } = await adminClient.from('halls').insert({
        partner_id: partner.id, name: 'Salle Les Palmiers', capacity: 150, price_per_day: 120000, deposit_percentage: 35.0
    }).select('id').single();
    if (!hall?.id) throw new Error('Création salle échouée');

    let resId: string | null = null;

    try {
        // Réservation de 3 jours : du 2026-12-01 au 2026-12-03 (3 jours * 120 000 = 360 000 FCFA)
        // Acompte 35% de 360 000 = 126 000 FCFA
        // Solde = 360 000 - 126 000 = 234 000 FCFA
        const reservation = await HallService.createReservation({
            hallId: hall.id,
            clientId,
            startDate: '2026-12-01',
            endDate: '2026-12-03',
            moratoriumDate: '2026-11-20',
        });

        resId = reservation.id;
        const total = Number(reservation.total_amount);
        const deposit = Number(reservation.deposit_amount);
        const balance = Number(reservation.balance_amount);

        assert.strictEqual(total, 360000, 'Total pour 3 jours = 360 000 FCFA');
        assert.strictEqual(deposit, 126000, 'Acompte (35%) = 126 000 FCFA');
        assert.strictEqual(balance, 234000, 'Solde restant = 234 000 FCFA');
        assert.strictEqual(deposit + balance, total, 'Invariant : Acompte + Solde = Total');
        assert.strictEqual(reservation.moratorium_date, '2026-11-20', 'Date de moratoire enregistrée');

        // Re-lecture directe en base de données
        const { data: dbRes, error: fetchErr } = await adminClient
            .from('hall_reservations')
            .select('total_amount, deposit_amount, balance_amount, moratorium_date')
            .eq('id', reservation.id)
            .single();

        assert.ok(!fetchErr && dbRes, 'Relecture DB réservation');
        assert.strictEqual(Number(dbRes.total_amount), 360000);
        assert.strictEqual(Number(dbRes.deposit_amount), 126000);
        assert.strictEqual(Number(dbRes.balance_amount), 234000);
        assert.strictEqual(Number(dbRes.deposit_amount) + Number(dbRes.balance_amount), Number(dbRes.total_amount));
    } finally {
        if (resId) await adminClient.from('hall_reservations').delete().eq('id', resId);
        await adminClient.from('halls').delete().eq('id', hall.id);
        await adminClient.from('partners').delete().eq('id', partner.id);
        await adminClient.from('users').delete().in('id', [partnerUserId, clientId]);
        await adminClient.auth.admin.deleteUser(partnerUserId);
        await adminClient.auth.admin.deleteUser(clientId);
    }
});

test('4. CYCLE DE STATUT RÉSERVATION (§47-§48) : EN_ATTENTE -> CONFIRMEE -> ANNULEE', async () => {
    if (!supabaseUrl || !serviceRoleKey) return;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const suffix = Date.now().toString().slice(-6);
    const phoneP = `+22177${Math.floor(1000000 + Math.random() * 9000000)}`;
    const phoneC = `+22176${Math.floor(1000000 + Math.random() * 9000000)}`;

    const { data: authP } = await adminClient.auth.admin.createUser({
        email: `partner.cycle.h.${suffix}@eventvillage.sn`, password: 'Password123!', email_confirm: true, phone: phoneP, phone_confirm: true,
        user_metadata: { first_name: 'P', last_name: 'P', phone: phoneP },
    });
    const { data: authC } = await adminClient.auth.admin.createUser({
        email: `client.cycle.h.${suffix}@eventvillage.sn`, password: 'Password123!', email_confirm: true, phone: phoneC, phone_confirm: true,
        user_metadata: { first_name: 'C', last_name: 'C', phone: phoneC },
    });

    if (!authP?.user || !authC?.user) throw new Error('Création utilisateurs échouée');
    const partnerUserId = authP.user.id;
    const clientId = authC.user.id;

    await adminClient.from('users').upsert([
        { id: partnerUserId, email: `partner.cycle.h.${suffix}@eventvillage.sn`, phone: phoneP, first_name: 'P', last_name: 'P', role: 'PARTENAIRE', status: 'ACTIF' },
        { id: clientId, email: `client.cycle.h.${suffix}@eventvillage.sn`, phone: phoneC, first_name: 'C', last_name: 'C', role: 'CLIENT', status: 'ACTIF' }
    ]);

    const { data: partner } = await adminClient.from('partners').insert({
        user_id: partnerUserId, company_name: 'Cycle Hall Partner', phone: phoneP, status: 'VALIDE'
    }).select('id').single();
    if (!partner?.id) throw new Error('Création partenaire échouée');

    const { data: hall } = await adminClient.from('halls').insert({
        partner_id: partner.id, name: 'Salle Océane', capacity: 100, price_per_day: 80000, deposit_percentage: 30.0
    }).select('id').single();
    if (!hall?.id) throw new Error('Création salle échouée');

    let resId: string | null = null;

    try {
        // 1. Création (Statut initial : EN_ATTENTE)
        const reservation = await HallService.createReservation({
            hallId: hall.id,
            clientId,
            startDate: '2026-12-20',
            endDate: '2026-12-21',
        });
        resId = reservation.id;
        assert.strictEqual(reservation.status, 'EN_ATTENTE', 'Statut initial = EN_ATTENTE');

        // 2. Confirmation par le Partenaire (EN_ATTENTE -> CONFIRMEE)
        const confirmed = await HallService.confirmReservation(reservation.id, partnerUserId);
        assert.strictEqual(confirmed.status, 'CONFIRMEE', 'Statut après confirmation = CONFIRMEE');

        const { data: dbConfirmed } = await adminClient
            .from('hall_reservations')
            .select('status')
            .eq('id', reservation.id)
            .single();
        assert.strictEqual(dbConfirmed?.status, 'CONFIRMEE', 'Relecture DB = CONFIRMEE');

        // 3. Annulation (CONFIRMEE -> ANNULEE)
        const cancelled = await HallService.cancelReservation(reservation.id, partnerUserId, 'Demande d\'annulation client');
        assert.strictEqual(cancelled.status, 'ANNULEE', 'Statut après annulation = ANNULEE');
        assert.strictEqual(cancelled.payment_status, 'CANCELLED', 'Statut paiement = CANCELLED');

        const { data: dbCancelled } = await adminClient
            .from('hall_reservations')
            .select('status, payment_status')
            .eq('id', reservation.id)
            .single();
        assert.strictEqual(dbCancelled?.status, 'ANNULEE', 'Relecture DB = ANNULEE');
        assert.strictEqual(dbCancelled?.payment_status, 'CANCELLED', 'Relecture DB payment_status = CANCELLED');
    } finally {
        if (resId) await adminClient.from('hall_reservations').delete().eq('id', resId);
        await adminClient.from('halls').delete().eq('id', hall.id);
        await adminClient.from('partners').delete().eq('id', partner.id);
        await adminClient.from('users').delete().in('id', [partnerUserId, clientId]);
        await adminClient.auth.admin.deleteUser(partnerUserId);
        await adminClient.auth.admin.deleteUser(clientId);
    }
});
