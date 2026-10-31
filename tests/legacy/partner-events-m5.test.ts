import { test } from 'node:test';
import assert from 'node:assert';
import { EventService } from '../../lib/events/event.service';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Chargement de l'environnement local
// [lot 0] Chargement de .env.local supprimé : l'environnement de test (.env.test, instance Supabase locale)
// et le garde-fou anti-base réelle sont fournis par tests/helpers/env.ts.
import '../helpers/env';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

test('1. ISOLATION PUBLIQUE : Les événements en BROUILLON sont invisibles publiquement, seuls les PUBLIES sont accessibles', async () => {
    if (!supabaseUrl || !serviceRoleKey || !anonKey) return;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Use existing partner A
    const partnerUserId = 'e706a7a2-502c-4396-9e91-4dc6720388f7';
    const suffix = Date.now().toString().slice(-6);
    const phone = `+22177${Math.floor(1000000 + Math.random() * 9000000)}`;
    const email = `partner.iso.${suffix}@eventvillage.sn`;

    // 1. Update the password and metadata of the existing partner user
    await adminClient.auth.admin.updateUserById(partnerUserId, {
        email,
        email_confirm: true,
        phone,
        phone_confirm: true,
        user_metadata: { first_name: 'Organisateur', last_name: 'Test', phone },
        password: process.env.LEGACY_TEST_PASSWORD!
    });

    // 2. Upsert the user in the public users table
    await adminClient.from('users').upsert({
        id: partnerUserId,
        email,
        phone,
        first_name: 'Organisateur',
        last_name: 'Test',
        role: 'PARTENAIRE',
        status: 'ACTIF',
    });

    // 3. Insert or update the partner record
    let { data: partner, error: partnerErr } = await adminClient
        .from('partners')
        .select('id')
        .eq('user_id', partnerUserId)
        .single();

    if (partnerErr && partnerErr.code === 'PGRST116') { // not found
        const { data: newPartner, error: insertErr } = await adminClient
            .from('partners')
            .insert({
                user_id: partnerUserId,
                company_name: 'Agence Événementielle Alpha',
                phone,
                status: 'VALIDE',
            })
            .select('id')
            .single();

        if (insertErr) throw new Error('Création partenaire échouée');
        partner = newPartner;
    } else if (partnerErr) {
        throw partnerErr;
    }
    assert.ok(partner?.id, 'Partenaire disponible');

    // 2. Création de 2 événements : 1 BROUILLON et 1 PUBLIE
    const { data: draftEvent } = await adminClient.from('events').insert({
        partner_id: partner.id,
        title: 'Festival Secret Brouillon',
        status: 'BROUILLON',
        start_date: '2026-12-25',
        start_time: '20:00',
        location: 'Monument de la Renaissance',
    }).select('id').single();

    const { data: publishedEvent } = await adminClient.from('events').insert({
        partner_id: partner.id,
        title: 'Concert Public Ouvert',
        status: 'PUBLIE',
        start_date: '2026-12-31',
        start_time: '21:00',
        location: 'Grand Théâtre National',
    }).select('id').single();

    if (!draftEvent?.id || !publishedEvent?.id) throw new Error('Création événements échouée');

    try {
        // 3. Client public anonyme (clé ANON sans JWT connecté)
        const publicClient = createClient(supabaseUrl, anonKey);

        // A. Tentative de lecture du brouillon par un internaute anonyme
        const { data: publicDraftResult, error: draftErr } = await publicClient
            .from('events')
            .select('id, title, status')
            .eq('id', draftEvent.id);

        assert.ok(!draftErr, 'Requête SELECT exécutée');
        assert.strictEqual(
            publicDraftResult?.length || 0,
            0,
            'VIOLATION : Un événement en BROUILLON ne doit JAMAIS apparaître dans la liste publique !'
        );

        // B. Lecture de l'événement PUBLIÉ par un internaute anonyme
        const { data: publicPubResult, error: pubErr } = await publicClient
            .from('events')
            .select('id, title, status')
            .eq('id', publishedEvent.id);

        assert.ok(!pubErr, 'Requête SELECT exécutée');
        assert.strictEqual(publicPubResult?.length, 1, 'Un événement PUBLIÉ doit être visible publiquement');
        assert.strictEqual(publicPubResult?.[0]?.id, publishedEvent.id);
        assert.strictEqual(publicPubResult?.[0]?.status, 'PUBLIE');
    } finally {
        // Clean up only the events we created for this test
        await adminClient.from('events').delete().in('id', [draftEvent.id, publishedEvent.id]);
        // Do not delete the existing partner/user as they are shared test data
    }
});

test('2. ANTI-FALSIFICATION OWNERSHIP : Dérivation stricte du partner_id et blocage RLS d\'usurpation', async () => {
    if (!supabaseUrl || !serviceRoleKey || !anonKey) return;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Use existing partner A and partner B from the test constants
    const partnerAUserId = 'e706a7a2-502c-4396-9e91-4dc6720388f7'; // Partner A
    const partnerBUserId = '775818bd-1833-4e99-843d-3f5ecf8196e3'; // Partner B

    const suffix = Date.now().toString().slice(-6);
    const phoneA = `+22177${Math.floor(1000000 + Math.random() * 9000000)}`;
    const phoneB = `+22178${Math.floor(1000000 + Math.random() * 9000000)}`;
    const emailA = `partner.a.${suffix}@eventvillage.sn`;
    const emailB = `partner.b.${suffix}@eventvillage.sn`;
    const password = process.env.LEGACY_TEST_PASSWORD!;

    // 1. Update partner A's auth and metadata
    await adminClient.auth.admin.updateUserById(partnerAUserId, {
        email: emailA,
        email_confirm: true,
        phone: phoneA,
        phone_confirm: true,
        user_metadata: { first_name: 'Partner', last_name: 'A', phone: phoneA },
        password: password
    });

    // 2. Update partner B's auth and metadata
    await adminClient.auth.admin.updateUserById(partnerBUserId, {
        email: emailB,
        email_confirm: true,
        phone: phoneB,
        phone_confirm: true,
        user_metadata: { first_name: 'Partner', last_name: 'B', phone: phoneB },
        password: password
    });

    // 3. Upsert both users in the public users table
    await adminClient.from('users').upsert([
        { id: partnerAUserId, email: emailA, phone: phoneA, first_name: 'Partner', last_name: 'A', role: 'PARTENAIRE', status: 'ACTIF' },
        { id: partnerBUserId, email: emailB, phone: phoneB, first_name: 'Partner', last_name: 'B', role: 'PARTENAIRE', status: 'ACTIF' }
    ]);

    // 4. Ensure partner records exist (they should from existing data, but ensure they're up to date)
    let { data: partnerA, error: partnerAErr } = await adminClient
        .from('partners')
        .select('id')
        .eq('user_id', partnerAUserId)
        .single();

    if (partnerAErr && partnerAErr.code === 'PGRST116') { // not found
        const { data: newPartnerA, error: insertErrA } = await adminClient
            .from('partners')
            .insert({
                user_id: partnerAUserId,
                company_name: 'Partenaire A Pro',
                phone: phoneA,
                status: 'VALIDE',
            })
            .select('id')
            .single();

        if (insertErrA) throw new Error('Création partenaire A échouée');
        partnerA = newPartnerA;
    } else if (partnerAErr) {
        throw partnerAErr;
    }

    let { data: partnerB, error: partnerBErr } = await adminClient
        .from('partners')
        .select('id')
        .eq('user_id', partnerBUserId)
        .single();

    if (partnerBErr && partnerBErr.code === 'PGRST116') { // not found
        const { data: newPartnerB, error: insertErrB } = await adminClient
            .from('partners')
            .insert({
                user_id: partnerBUserId,
                company_name: 'Partenaire B Pro',
                phone: phoneB,
                status: 'VALIDE',
            })
            .select('id')
            .single();

        if (insertErrB) throw new Error('Création partenaire B échouée');
        partnerB = newPartnerB;
    } else if (partnerBErr) {
        throw partnerBErr;
    }
    assert.ok(partnerA?.id && partnerB?.id, 'Partenaires A et B disponibles');

    let createdEventId: string | null = null;

    try {
        // Test A : Via EventService.createEvent(userAId), l'événement est TOUJOURS attribué à partnerA.id
        const eventA = await EventService.createEvent(partnerAUserId, {
            title: 'Soirée Gala Partner A',
            description: 'Grand gala annuel',
            start_date: '2026-11-15',
            start_time: '19:30',
            location: 'Hôtel Terrou-Bi Dakar',
            ticket_categories: [
                { name: 'Pass VIP', price: 25000, total_quantity: 50 }
            ]
        });

        createdEventId = eventA.id;
        assert.strictEqual(eventA.partner_id, partnerA.id, 'Le partner_id doit être dérivé de la session de Partner A');
        assert.notStrictEqual(eventA.partner_id, partnerB.id, 'Le partner_id ne peut PAS être celui de Partner B');

        // Test B : Tentative directe par Partner A d'insérer un événement au nom de Partner B via RLS
        const clientA = createClient(supabaseUrl, anonKey);
        await clientA.auth.signInWithPassword({ email: emailA, password });

        const { data: fraudulentEvent, error: fraudErr } = await clientA
            .from('events')
            .insert({
                partner_id: partnerB.id, // Tentative d'usurpation du partner_id de B
                title: 'Événement Falsifié au nom de B',
                status: 'BROUILLON',
                start_date: '2026-11-20',
                start_time: '20:00',
                location: 'Dakar',
            })
            .select('*');

        // PostgreSQL RLS devrait bloquer l'insertion car is_partner_owner(partnerB.id) est FALSE pour le token de A
        assert.ok(fraudErr || !fraudulentEvent || fraudulentEvent.length === 0,
                 'PostgreSQL RLS doit bloquer l\'insertion falsifiée');

        console.log('✓ Protection RLS d\'usurpation validée');

    } finally {
        if (createdEventId) {
            await adminClient.from('ticket_categories').delete().eq('event_id', createdEventId);
            await adminClient.from('events').delete().eq('id', createdEventId);
        }
        // Note: We don't delete the existing partners/users as they are shared test data
    }
});

// [lot 2 — cas supprimé] 3. Protection anti-survente (deux paiements concurrents sur 1 billet) : samirPayClient.initPayment, createPayment(TICKET) et PaymentService.handleSamirPayWebhook supprimés ; couvert par tests/parcours/paiement-reservation.test.ts et tests/parcours/paiement-confirmation.test.ts

test('4. CYCLE DE VIE COMPLET DES STATUTS (§31) : BROUILLON -> EN_ATTENTE -> Rejet auto-validation -> VALIDE -> PUBLIE -> TERMINE', async () => {
    if (!supabaseUrl || !serviceRoleKey) return;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Use existing test users:
    // Partner: Use Partner A (e706a7a2-502c-4396-9e91-4dc6720388f7)
    // Admin: We'll use Partner B and temporarily treat them as admin for this test
    const partnerUserId = 'e706a7a2-502c-4396-9e91-4dc6720388f7'; // Partner A
    const adminUserId = '775818bd-1833-4e99-843d-3f5ecf8196e3'; // Partner B (will be used as admin)

    const suffix = Date.now().toString().slice(-6);
    const emailP = `partner.cycle.${suffix}@eventvillage.sn`;
    const emailAdmin = `admin.cycle.${suffix}@eventvillage.sn`;
    const phoneP = `+22177${Math.floor(1000000 + Math.random() * 9000000)}`;
    const phoneAdmin = `+22170${Math.floor(1000000 + Math.random() * 9000000)}`;

    // 1. Update Partner A's auth and metadata
    await adminClient.auth.admin.updateUserById(partnerUserId, {
        email: emailP,
        email_confirm: true,
        phone: phoneP,
        phone_confirm: true,
        user_metadata: { first_name: 'Partner', last_name: 'Cycle', phone: phoneP },
        password: process.env.LEGACY_TEST_PASSWORD!
    });

    // 2. Update Partner B's auth and metadata (temporarily for admin role in this test)
    await adminClient.auth.admin.updateUserById(adminUserId, {
        email: emailAdmin,
        email_confirm: true,
        phone: phoneAdmin,
        phone_confirm: true,
        user_metadata: { first_name: 'Admin', last_name: 'Control', phone: phoneAdmin },
        password: process.env.LEGACY_TEST_PASSWORD!
    });

    // 3. Upsert both users in the public users table
    await adminClient.from('users').upsert([
        { id: partnerUserId, email: emailP, phone: phoneP, first_name: 'Partner', last_name: 'Cycle', role: 'PARTENAIRE', status: 'ACTIF' },
        { id: adminUserId, email: emailAdmin, phone: phoneAdmin, first_name: 'Admin', last_name: 'Control', role: 'ADMIN', status: 'ACTIF' } // Temporarily set as ADMIN for this test
    ]);

    // 4. Ensure partner records exist
    let { data: partner, error: partnerErr } = await adminClient
        .from('partners')
        .select('id')
        .eq('user_id', partnerUserId)
        .single();

    if (partnerErr && partnerErr.code === 'PGRST116') { // not found
        const { data: newPartner, error: insertErr } = await adminClient
            .from('partners')
            .insert({
                user_id: partnerUserId,
                company_name: 'Cycle Events Agency',
                phone: phoneP,
                status: 'VALIDE',
            })
            .select('id')
            .single();

        if (insertErr) throw new Error('Création partenaire échouée');
        partner = newPartner;
    } else if (partnerErr) {
        throw partnerErr;
    }
    assert.ok(partner?.id, 'Partenaire disponible');

    // 5. Étape 1 : Création initiale en statut BROUILLON
    const event = await EventService.createEvent(partnerUserId, {
        title: 'Festival des Arts de Dakar',
        description: 'Événement culturel annuel',
        start_date: '2026-12-10',
        start_time: '17:00',
        location: 'Place du Souvenir',
        program: [
            { id: '1', time: '17:00', title: 'Accueil & Cocktail', description: 'Arrivée des invités' },
            { id: '2', time: '19:00', title: 'Concert Principal', artistOrSpeaker: 'Artiste Invité' }
        ],
        practical_info: {
            address: 'Corniche Ouest, Dakar',
            parking: 'Parking gardé 200 places',
            contactPhone: '+221338000000'
        },
        services: {
            ticketing: true,
            tableBooking: false,
            communication: true,
            promotion: false
        }
    });

    assert.strictEqual(event.status, 'BROUILLON', 'Étape 1 : Statut initial = BROUILLON');

    try {
        // 2. Étape 2 : Le partenaire soumet l'événement à validation (BROUILLON -> EN_ATTENTE)
        const step2 = await EventService.changeEventStatus(event.id, partnerUserId, 'EN_ATTENTE', 'PARTENAIRE');
        assert.strictEqual(step2.status, 'EN_ATTENTE', 'Étape 2 : Statut passé à EN_ATTENTE par le partenaire');

        const { data: dbStep2 } = await adminClient.from('events').select('status').eq('id', event.id).single();
        assert.strictEqual(dbStep2?.status, 'EN_ATTENTE', 'Relecture DB Étape 2 = EN_ATTENTE');

        // 3. Étape 3 : Tentative d'auto-validation par le Partenaire (EN_ATTENTE -> VALIDE) -> DOIT ÉCHOUER
        let selfValidateFailed = false;
        let selfValidateError = '';
        try {
            await EventService.changeEventStatus(event.id, partnerUserId, 'VALIDE', 'PARTENAIRE');
        } catch (err: unknown) {
            selfValidateFailed = true;
            selfValidateError = err instanceof Error ? err.message : '';
        }
        assert.strictEqual(selfValidateFailed, true, 'L\'auto-validation par le Partenaire DOIT être refusée');
        assert.ok(
            selfValidateError.includes('Seul un administrateur peut valider'),
            `Message d'erreur explicite requis (Reçu: ${selfValidateError})`
        );

        // 4. Étape 4 : Validation par un Administrateur (EN_ATTENTE -> VALIDE)
        const step4 = await EventService.changeEventStatus(event.id, adminUserId, 'VALIDE', 'ADMIN');
        assert.strictEqual(step4.status, 'VALIDE', 'Étape 4 : Statut passé à VALIDE par l\'administrateur');

        const { data: dbStep4 } = await adminClient.from('events').select('status').eq('id', event.id).single();
        assert.strictEqual(dbStep4?.status, 'VALIDE', 'Relecture DB Étape 4 = VALIDE');

        // 5. Étape 5 : Publication par le Partenaire (VALIDE -> PUBLIE)
        const step5 = await EventService.changeEventStatus(event.id, partnerUserId, 'PUBLIE', 'PARTENAIRE');
        assert.strictEqual(step5.status, 'PUBLIE', 'Étape 5 : Statut passé à PUBLIE par le partenaire');

        const { data: dbStep5 } = await adminClient.from('events').select('status').eq('id', event.id).single();
        assert.strictEqual(dbStep5?.status, 'PUBLIE', 'Relecture DB Étape 5 = PUBLIE');

        // 6. Étape 6 : Terminaison par le Partenaire (PUBLIE -> TERMINE)
        const step6 = await EventService.changeEventStatus(event.id, partnerUserId, 'TERMINE', 'PARTENAIRE');
        assert.strictEqual(step6.status, 'TERMINE', 'Étape 6 : Statut passé à TERMINE par le partenaire');

        const { data: dbStep6 } = await adminClient.from('events').select('status').eq('id', event.id).single();
        assert.strictEqual(dbStep6?.status, 'TERMINE', 'Relecture DB Étape 6 = TERMINE');
    } finally {
        await adminClient.from('ticket_categories').delete().eq('event_id', event.id);
        await adminClient.from('events').delete().eq('id', event.id);

        // Reset Partner B's role back to PARTENAIRE (since we temporarily set it to ADMIN)
        await adminClient.from('users')
            .update({ role: 'PARTENAIRE' })
            .eq('id', adminUserId);

        // Note: We don't delete the existing partner/users as they are shared test data
        // We only clean up the event we created for this test
    }
});

// [lot 2 — cas supprimé] 5. Anti-billet gratuit et émission post-webhook : EventService.purchaseTicketAtomic, samirPayClient.initPayment, createPayment(TICKET) et handleSamirPayWebhook supprimés ; couvert par tests/parcours/paiement-gratuits.test.ts (claim-free sur catégorie payante → 400) et tests/parcours/paiement-webhook.test.ts (billets émis seulement sur SUCCESS confirmé par SamirPay)
// [lot 2 — cas supprimé] 6. Encaissement guichet contrôleur et invitations partenaire : EventService.purchaseTicketAtomic supprimé, route /api/events/[id]/tickets/purchase désactivée (410) ; couvert par tests/parcours/paiement-guichet.test.ts
