import { test } from 'node:test';
import assert from 'node:assert';
import { EventService } from '../lib/events/event.service';
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

test('1. UX / MUTATION UNIQUE : 1 clic valide déclenche exactement 1 création en base de données', async () => {
    if (!supabaseUrl || !serviceRoleKey) return;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const suffix = Date.now().toString().slice(-6);
    const phone = `+22177${Math.floor(1000000 + Math.random() * 9000000)}`;
    const email = `partner.ux.${suffix}@eventvillage.sn`;

    const { data: authUser } = await adminClient.auth.admin.createUser({
        email, password: 'Password123!', email_confirm: true, phone, phone_confirm: true,
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
        const event = await EventService.createEvent(partnerUserId, {
            title: 'SaaS Showcase Night',
            start_date: '2026-11-20',
            start_time: '19:00',
            location: 'Dakar',
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
    const phoneP = `+22177${Math.floor(1000000 + Math.random() * 9000000)}`;
    const phoneC = `+22176${Math.floor(1000000 + Math.random() * 9000000)}`;

    const { data: authP } = await adminClient.auth.admin.createUser({
        email: `partner.double.${suffix}@eventvillage.sn`, password: 'Password123!', email_confirm: true, phone: phoneP, phone_confirm: true,
        user_metadata: { first_name: 'P', last_name: 'Double', phone: phoneP },
    });
    const { data: authC } = await adminClient.auth.admin.createUser({
        email: `client.double.${suffix}@eventvillage.sn`, password: 'Password123!', email_confirm: true, phone: phoneC, phone_confirm: true,
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

    try {
        // Simulation de 2 clics ultra-rapides simultanés sur le bouton "Réserver"
        const [click1, click2] = await Promise.allSettled([
            HallService.createReservation({
                hallId: hall.id,
                clientId,
                startDate: '2026-12-05',
                endDate: '2026-12-07',
            }),
            HallService.createReservation({
                hallId: hall.id,
                clientId,
                startDate: '2026-12-05',
                endDate: '2026-12-07',
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
