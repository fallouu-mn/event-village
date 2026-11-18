import { test } from 'node:test';
import assert from 'node:assert';
import { HallService } from '../lib/halls/hall.service';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Chargement de l'environnement local
// [lot 0] Chargement de .env.local supprimé : l'environnement de test (.env.test, instance Supabase locale)
// et le garde-fou anti-base réelle sont fournis par tests/helpers/env.ts.
import './helpers/env';
import { TEST_PASSWORD } from './helpers/fixture-data';
import { randomSenegalPhone } from './parcours/helpers';

// Lot 10a (modification signalée au rapport) : le service des salles est fermé par son interrupteur et une salle n'est réservable
// qu'après validation par l'administration : la suite ouvre le service le temps de ses tests (valeur remise ensuite)
// et valide ses salles ; les dates sont relatives (une réservation exige une date à venir).
import { before, after } from 'node:test';
import { superadminId } from './parcours/finance-helpers';
import { platformSetting, setPlatformSetting } from './parcours/l10a-helpers';

let hallsWereOpen: unknown;
before(async () => {
    hallsWereOpen = await platformSetting('features.halls_enabled');
    await setPlatformSetting('features.halls_enabled', true);
});
after(async () => {
    await setPlatformSetting('features.halls_enabled', hallsWereOpen);
});

async function validateHall(adminClient: { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }> }, hallId: string): Promise<void> {
    const { data, error } = await adminClient.rpc('hall_validation_decide', { p: { actor_id: await superadminId(), hall_id: hallId, decision: 'VALIDER' } });
    if (error || (data as { ok?: boolean } | null)?.ok !== true) throw new Error(`Validation de la salle échouée : ${error?.message ?? JSON.stringify(data)}`);
}

function dayFromNow(days: number): string {
    return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

test('1. CONFIGURATION SALLE (§42/§45) : Création avec acompte personnalisé (40%) et persistance en base', async () => {
    if (!supabaseUrl || !serviceRoleKey) return;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const suffix = Date.now().toString().slice(-6);
    const phone = randomSenegalPhone('77');
    const email = `partner.hall.${suffix}@eventvillage.sn`;

    const { data: authUser } = await adminClient.auth.admin.createUser({
        email, password: TEST_PASSWORD, email_confirm: true, phone, phone_confirm: true,
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
    const phoneP = randomSenegalPhone('77');
    const phoneC1 = randomSenegalPhone('76');
    const phoneC2 = randomSenegalPhone('78');

    const { data: authP } = await adminClient.auth.admin.createUser({
        email: `partner.conflict.${suffix}@eventvillage.sn`, password: TEST_PASSWORD, email_confirm: true, phone: phoneP, phone_confirm: true,
        user_metadata: { first_name: 'P', last_name: 'P', phone: phoneP },
    });
    const { data: authC1 } = await adminClient.auth.admin.createUser({
        email: `client1.conflict.${suffix}@eventvillage.sn`, password: TEST_PASSWORD, email_confirm: true, phone: phoneC1, phone_confirm: true,
        user_metadata: { first_name: 'C1', last_name: 'C1', phone: phoneC1 },
    });
    const { data: authC2 } = await adminClient.auth.admin.createUser({
        email: `client2.conflict.${suffix}@eventvillage.sn`, password: TEST_PASSWORD, email_confirm: true, phone: phoneC2, phone_confirm: true,
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
    await validateHall(adminClient, hall.id);

    try {
        // EXÉCUTION CONCURRENTE RÉELLE VIA Promise.allSettled()
        // Deux clients tentent de réserver simultanément la salle sur des dates chevauchantes :
        // Client 1 : 2026-11-10 au 2026-11-15
        // Client 2 : 2026-11-12 au 2026-11-18 (Chevauchement du 12 au 15)
        const [result1, result2] = await Promise.allSettled([
            HallService.createReservation({
                hallId: hall.id,
                clientId: client1Id,
                startDate: dayFromNow(90),
                endDate: dayFromNow(95),
                notes: 'Mariage traditionnel Client 1',
            }),
            HallService.createReservation({
                hallId: hall.id,
                clientId: client2Id,
                startDate: dayFromNow(92),
                endDate: dayFromNow(98),
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
    const phoneP = randomSenegalPhone('77');
    const phoneC = randomSenegalPhone('76');

    const { data: authP } = await adminClient.auth.admin.createUser({
        email: `partner.fin.${suffix}@eventvillage.sn`, password: TEST_PASSWORD, email_confirm: true, phone: phoneP, phone_confirm: true,
        user_metadata: { first_name: 'P', last_name: 'P', phone: phoneP },
    });
    const { data: authC } = await adminClient.auth.admin.createUser({
        email: `client.fin.${suffix}@eventvillage.sn`, password: TEST_PASSWORD, email_confirm: true, phone: phoneC, phone_confirm: true,
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
        partner_id: partner.id, name: 'Salle Les Palmiers', capacity: 150, price_per_day: 120000, deposit_value: 35.0
    }).select('id').single();
    if (!hall?.id) throw new Error('Création salle échouée');
    await validateHall(adminClient, hall.id);

    let resId: string | null = null;

    try {
        // Lot 10a (modification signalée au rapport) : décisions du client : frais de service de 5 % payés par le client, solde dû
        // 7 jours avant la date (l'échéance ne se choisit plus). 3 jours × 120 000 = 360 000 FCFA ; frais 18 000 ;
        // total 378 000 ; acompte 35 % = 126 000 + 6 300 de frais = 132 300 ; solde = 378 000 − 132 300 = 245 700.
        const start = dayFromNow(60);
        const reservation = await HallService.createReservation({
            hallId: hall.id,
            clientId,
            startDate: start,
            endDate: dayFromNow(62),
        });

        resId = reservation.id;
        const total = Number(reservation.total_amount);
        const deposit = Number(reservation.deposit_amount);
        const balance = Number(reservation.balance_amount);

        assert.strictEqual(total, 378000, 'Total pour 3 jours = 360 000 + 18 000 de frais');
        assert.strictEqual(deposit, 132300, 'Acompte (35 %) = 126 000 + 6 300 de frais');
        assert.strictEqual(balance, 245700, 'Solde restant = 245 700 FCFA');
        assert.strictEqual(deposit + balance, total, 'Invariant : Acompte + Solde = Total');
        assert.strictEqual(reservation.moratorium_date, new Date(Date.parse(`${start}T00:00:00Z`) - 7 * 86_400_000).toISOString().slice(0, 10), 'Solde dû 7 jours avant la date');

        // Re-lecture directe en base de données
        const { data: dbRes, error: fetchErr } = await adminClient
            .from('hall_reservations')
            .select('total_amount, deposit_amount, balance_amount, moratorium_date')
            .eq('id', reservation.id)
            .single();

        assert.ok(!fetchErr && dbRes, 'Relecture DB réservation');
        assert.strictEqual(Number(dbRes.total_amount), 378000);
        assert.strictEqual(Number(dbRes.deposit_amount), 132300);
        assert.strictEqual(Number(dbRes.balance_amount), 245700);
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

test('4. CYCLE DE STATUT RÉSERVATION (§47-§48) : EN_ATTENTE -> confirmation sans paiement refusée -> ANNULEE', async () => {
    if (!supabaseUrl || !serviceRoleKey) return;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const suffix = Date.now().toString().slice(-6);
    const phoneP = randomSenegalPhone('77');
    const phoneC = randomSenegalPhone('76');

    const { data: authP } = await adminClient.auth.admin.createUser({
        email: `partner.cycle.h.${suffix}@eventvillage.sn`, password: TEST_PASSWORD, email_confirm: true, phone: phoneP, phone_confirm: true,
        user_metadata: { first_name: 'P', last_name: 'P', phone: phoneP },
    });
    const { data: authC } = await adminClient.auth.admin.createUser({
        email: `client.cycle.h.${suffix}@eventvillage.sn`, password: TEST_PASSWORD, email_confirm: true, phone: phoneC, phone_confirm: true,
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
    await validateHall(adminClient, hall.id);

    let resId: string | null = null;

    try {
        // 1. Création (Statut initial : EN_ATTENTE)
        const reservation = await HallService.createReservation({
            hallId: hall.id,
            clientId,
            startDate: dayFromNow(70),
            endDate: dayFromNow(71),
        });
        resId = reservation.id;
        assert.strictEqual(reservation.status, 'EN_ATTENTE', 'Statut initial = EN_ATTENTE');

        // 2. Lot 10a (modification signalée au rapport) : C1 : la salle ne confirme jamais une réservation non payée (confirmation par le
        // paiement seulement). Assertion d'origine (EN_ATTENTE -> CONFIRMEE par la salle) remplacée par ce refus.
        await assert.rejects(() => HallService.confirmReservation(reservation.id, partnerUserId), /n’est pas payée/);
        const { data: dbConfirmed } = await adminClient
            .from('hall_reservations')
            .select('status')
            .eq('id', reservation.id)
            .single();
        assert.strictEqual(dbConfirmed?.status, 'EN_ATTENTE', 'Relecture DB = EN_ATTENTE (aucune confirmation sans paiement)');

        // 3. Annulation par la salle (EN_ATTENTE -> ANNULEE)
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
