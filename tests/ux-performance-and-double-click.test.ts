import { test } from 'node:test';
import assert from 'node:assert';
import { EventService } from '../lib/events/event.service';
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

test('1. UX / MUTATION UNIQUE : 1 clic valide déclenche exactement 1 création en base de données', async () => {
    if (!supabaseUrl || !serviceRoleKey) return;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const suffix = Date.now().toString().slice(-6);
    const phone = randomSenegalPhone('77');
    const email = `partner.ux.${suffix}@eventvillage.sn`;

    const { data: authUser } = await adminClient.auth.admin.createUser({
        email, password: TEST_PASSWORD, email_confirm: true, phone, phone_confirm: true,
        user_metadata: { first_name: 'Partner', last_name: 'UX', phone },
    });
    if (!authUser?.user) throw new Error('Création utilisateur échouée');
    const partnerUserId = authUser.user.id;

    await adminClient.from('users').upsert({
        id: partnerUserId, email, phone, first_name: 'Partner', last_name: 'UX', role: 'PARTENAIRE', status: 'ACTIF'
    });

    const { data: partner } = await adminClient.from('partners').insert({
        user_id: partnerUserId, company_name: 'UX Enterprise', phone, status: 'VALIDE'
    }).select('id').single();
    if (!partner?.id) throw new Error('Création partenaire échouée');

    let eventId: string | null = null;

    try {
        // Lot 5 (contrat F1) : createEvent valide le corps par le schéma partagé (catégorie, ville et début
        // dans le futur obligatoires) et crée par la RPC event_create.
        const startDate = new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10);
        const event = await EventService.createEvent(partnerUserId, {
            title: 'SaaS Showcase Night',
            category: 'CONCERT',
            start_date: startDate,
            start_time: '19:00',
            location: 'Dakar',
            city: 'Dakar',
        });
        eventId = event.id;

        const { data: dbEvents } = await adminClient.from('events').select('id').eq('partner_id', partner.id);
        assert.strictEqual(dbEvents?.length, 1, 'Exactement 1 seul événement doit avoir été créé');
    } finally {
        if (eventId) await adminClient.from('events').delete().eq('id', eventId);
        await adminClient.from('partners').delete().eq('id', partner.id);
        await adminClient.from('users').delete().eq('id', partnerUserId);
        await adminClient.auth.admin.deleteUser(partnerUserId);
    }
});

test('2. PROTECTION ANTI-DOUBLE CLIC CONCURRENT : 2 clics simultanés sur une réservation de salle -> 1 création, 1 rejet de conflit', async () => {
    if (!supabaseUrl || !serviceRoleKey) return;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const suffix = Date.now().toString().slice(-6);
    const phoneP = randomSenegalPhone('77');
    const phoneC = randomSenegalPhone('76');

    const { data: authP } = await adminClient.auth.admin.createUser({
        email: `partner.double.${suffix}@eventvillage.sn`, password: TEST_PASSWORD, email_confirm: true, phone: phoneP, phone_confirm: true,
        user_metadata: { first_name: 'P', last_name: 'Double', phone: phoneP },
    });
    const { data: authC } = await adminClient.auth.admin.createUser({
        email: `client.double.${suffix}@eventvillage.sn`, password: TEST_PASSWORD, email_confirm: true, phone: phoneC, phone_confirm: true,
        user_metadata: { first_name: 'C', last_name: 'Double', phone: phoneC },
    });

    if (!authP?.user || !authC?.user) throw new Error('Création utilisateurs échouée');
    const partnerUserId = authP.user.id;
    const clientId = authC.user.id;

    await adminClient.from('users').upsert([
        { id: partnerUserId, email: `partner.double.${suffix}@eventvillage.sn`, phone: phoneP, first_name: 'P', last_name: 'Double', role: 'PARTENAIRE', status: 'ACTIF' },
        { id: clientId, email: `client.double.${suffix}@eventvillage.sn`, phone: phoneC, first_name: 'C', last_name: 'Double', role: 'CLIENT', status: 'ACTIF' }
    ]);

    const { data: partner } = await adminClient.from('partners').insert({
        user_id: partnerUserId, company_name: 'Double Click Defense', phone: phoneP, status: 'VALIDE'
    }).select('id').single();
    if (!partner?.id) throw new Error('Création partenaire échouée');

    const { data: hall } = await adminClient.from('halls').insert({
        partner_id: partner.id, name: 'Salle Anti-Double Clic', capacity: 150, price_per_day: 100000, deposit_percentage: 30.0
    }).select('id').single();
    if (!hall?.id) throw new Error('Création salle échouée');
    await validateHall(adminClient, hall.id);

    try {
        // Simulation de 2 clics ultra-rapides simultanés sur le bouton "Réserver"
        const [click1, click2] = await Promise.allSettled([
            HallService.createReservation({
                hallId: hall.id,
                clientId,
                startDate: dayFromNow(80),
                endDate: dayFromNow(82),
            }),
            HallService.createReservation({
                hallId: hall.id,
                clientId,
                startDate: dayFromNow(80),
                endDate: dayFromNow(82),
            }),
        ]);

        const fulfilled = (click1.status === 'fulfilled' ? 1 : 0) + (click2.status === 'fulfilled' ? 1 : 0);
        const rejected = (click1.status === 'rejected' ? 1 : 0) + (click2.status === 'rejected' ? 1 : 0);

        assert.strictEqual(fulfilled, 1, 'Un seul clic doit être accepté');
        assert.strictEqual(rejected, 1, 'Le double clic concurrent doit être bloqué');

        const { data: reservations } = await adminClient
            .from('hall_reservations')
            .select('id')
            .eq('hall_id', hall.id);

        assert.strictEqual(reservations?.length, 1, 'Exactement une seule réservation doit exister en base');
    } finally {
        await adminClient.from('hall_reservations').delete().eq('hall_id', hall.id);
        await adminClient.from('halls').delete().eq('id', hall.id);
        await adminClient.from('partners').delete().eq('id', partner.id);
        await adminClient.from('users').delete().in('id', [partnerUserId, clientId]);
        await adminClient.auth.admin.deleteUser(partnerUserId);
        await adminClient.auth.admin.deleteUser(clientId);
    }
});
