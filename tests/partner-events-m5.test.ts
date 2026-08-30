import { test } from 'node:test';
import assert from 'node:assert';
import { EventService } from '../lib/events/event.service';
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

test('1. ISOLATION PUBLIQUE : Les événements en BROUILLON sont invisibles publiquement, seuls les PUBLIES sont accessibles', async () => {
    if (!supabaseUrl || !serviceRoleKey || !anonKey) return;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const suffix = Date.now().toString().slice(-6);
    const phone = `+22177${Math.floor(1000000 + Math.random() * 9000000)}`;
    const email = `partner.iso.${suffix}@eventvillage.sn`;

    // 1. Création du partenaire
    const { data: authPartner } = await adminClient.auth.admin.createUser({
        email,
        password: 'Password123!',
        email_confirm: true,
        phone,
        phone_confirm: true,
        user_metadata: { first_name: 'Organisateur', last_name: 'Test', phone },
    });
    if (!authPartner?.user) throw new Error('Création auth partenaire échouée');
    const partnerUserId = authPartner.user.id;

    await adminClient.from('users').upsert({
        id: partnerUserId,
        email,
        phone,
        first_name: 'Organisateur',
        last_name: 'Test',
        role: 'PARTENAIRE',
        status: 'ACTIF',
    });

    const { data: partner } = await adminClient.from('partners').insert({
        user_id: partnerUserId,
        company_name: 'Agence Événementielle Alpha',
        phone,
        status: 'VALIDE',
    }).select('id').single();
    if (!partner?.id) throw new Error('Création partenaire échouée');

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
        await adminClient.from('events').delete().in('id', [draftEvent.id, publishedEvent.id]);
        await adminClient.from('partners').delete().eq('id', partner.id);
        await adminClient.from('users').delete().eq('id', partnerUserId);
        await adminClient.auth.admin.deleteUser(partnerUserId);
    }
});

test('2. ANTI-FALSIFICATION OWNERSHIP : Dérivation stricte du partner_id et blocage RLS d\'usurpation', async () => {
    if (!supabaseUrl || !serviceRoleKey || !anonKey) return;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const suffix = Date.now().toString().slice(-6);
    const phoneA = `+22177${Math.floor(1000000 + Math.random() * 9000000)}`;
    const phoneB = `+22178${Math.floor(1000000 + Math.random() * 9000000)}`;
    const emailA = `partner.a.${suffix}@eventvillage.sn`;
    const emailB = `partner.b.${suffix}@eventvillage.sn`;
    const password = 'Password123!';

    // Création Partner A
    const { data: authA } = await adminClient.auth.admin.createUser({
        email: emailA, password, email_confirm: true, phone: phoneA, phone_confirm: true,
        user_metadata: { first_name: 'Partner', last_name: 'A', phone: phoneA },
    });
    // Création Partner B
    const { data: authB } = await adminClient.auth.admin.createUser({
        email: emailB, password, email_confirm: true, phone: phoneB, phone_confirm: true,
        user_metadata: { first_name: 'Partner', last_name: 'B', phone: phoneB },
    });

    if (!authA?.user || !authB?.user) throw new Error('Création auth échouée');
    const userAId = authA.user.id;
    const userBId = authB.user.id;

    await adminClient.from('users').upsert([
        { id: userAId, email: emailA, phone: phoneA, first_name: 'Partner', last_name: 'A', role: 'PARTENAIRE', status: 'ACTIF' },
        { id: userBId, email: emailB, phone: phoneB, first_name: 'Partner', last_name: 'B', role: 'PARTENAIRE', status: 'ACTIF' }
    ]);

    const { data: partnerA } = await adminClient.from('partners').insert({
        user_id: userAId, company_name: 'Partenaire A Pro', phone: phoneA, status: 'VALIDE'
    }).select('id').single();

    const { data: partnerB } = await adminClient.from('partners').insert({
        user_id: userBId, company_name: 'Partenaire B Pro', phone: phoneB, status: 'VALIDE'
    }).select('id').single();

    if (!partnerA?.id || !partnerB?.id) throw new Error('Création fiches partenaires échouée');

    let createdEventId: string | null = null;

    try {
        // Test A : Via EventService.createEvent(userAId), l'événement est TOUJOURS attribué à partnerA.id
        const eventA = await EventService.createEvent(userAId, {
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

        // PostgreSQL RLS bloque l'insertion car is_partner_owner(partnerB.id) est FALSE pour le token de A
        assert.ok(fraudErr || !fraudulentEvent || fraudulentEvent.length === 0, 'PostgreSQL RLS doit bloquer l\'insertion falsifiée');
    } finally {
        if (createdEventId) {
            await adminClient.from('ticket_categories').delete().eq('event_id', createdEventId);
            await adminClient.from('events').delete().eq('id', createdEventId);
        }
        await adminClient.from('partners').delete().in('id', [partnerA.id, partnerB.id]);
        await adminClient.from('users').delete().in('id', [userAId, userBId]);
        await adminClient.auth.admin.deleteUser(userAId);
        await adminClient.auth.admin.deleteUser(userBId);
    }
});

test('3. PROTECTION ANTI-SURVENTE (RACE CONDITION) : Deux achats simultanés (Promise.all) sur 1 billet restant -> 1 Succès, 1 Échec, sold_quantity = total_quantity', async () => {
    if (!supabaseUrl || !serviceRoleKey) return;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const suffix = Date.now().toString().slice(-6);
    const phoneP = `+22177${Math.floor(1000000 + Math.random() * 9000000)}`;
    const phoneBuyer1 = `+22176${Math.floor(1000000 + Math.random() * 9000000)}`;
    const phoneBuyer2 = `+22175${Math.floor(1000000 + Math.random() * 9000000)}`;

    // 1. Création Partenaire Organisateur et 2 Acheteurs
    const { data: authP } = await adminClient.auth.admin.createUser({
        email: `partner.sale.${suffix}@eventvillage.sn`, password: 'Password123!', email_confirm: true, phone: phoneP, phone_confirm: true,
        user_metadata: { first_name: 'Organisateur', last_name: 'Test', phone: phoneP },
    });
    const { data: authB1 } = await adminClient.auth.admin.createUser({
        email: `buyer1.${suffix}@eventvillage.sn`, password: 'Password123!', email_confirm: true, phone: phoneBuyer1, phone_confirm: true,
        user_metadata: { first_name: 'Acheteur', last_name: 'Un', phone: phoneBuyer1 },
    });
    const { data: authB2 } = await adminClient.auth.admin.createUser({
        email: `buyer2.${suffix}@eventvillage.sn`, password: 'Password123!', email_confirm: true, phone: phoneBuyer2, phone_confirm: true,
        user_metadata: { first_name: 'Acheteur', last_name: 'Deux', phone: phoneBuyer2 },
    });

    if (!authP?.user || !authB1?.user || !authB2?.user) throw new Error('Création utilisateurs échouée');
    const partnerUserId = authP.user.id;
    const buyer1Id = authB1.user.id;
    const buyer2Id = authB2.user.id;

    await adminClient.from('users').upsert([
        { id: partnerUserId, email: `partner.sale.${suffix}@eventvillage.sn`, phone: phoneP, first_name: 'Organisateur', last_name: 'Test', role: 'PARTENAIRE', status: 'ACTIF' },
        { id: buyer1Id, email: `buyer1.${suffix}@eventvillage.sn`, phone: phoneBuyer1, first_name: 'Acheteur', last_name: 'Un', role: 'CLIENT', status: 'ACTIF' },
        { id: buyer2Id, email: `buyer2.${suffix}@eventvillage.sn`, phone: phoneBuyer2, first_name: 'Acheteur', last_name: 'Deux', role: 'CLIENT', status: 'ACTIF' }
    ]);

    const { data: partner } = await adminClient.from('partners').insert({
        user_id: partnerUserId, company_name: 'Event Concurrency Production', phone: phoneP, status: 'VALIDE'
    }).select('id').single();
    if (!partner?.id) throw new Error('Création partenaire échouée');

    // 2. Création de l'événement PUBLIÉ avec une catégorie à EXACTEMENT 1 BILLET AU TOTAL
    const { data: event } = await adminClient.from('events').insert({
        partner_id: partner.id,
        title: 'Masterclass Exclusive - 1 Place Restante',
        status: 'PUBLIE',
        start_date: '2026-10-30',
        start_time: '18:00',
        location: 'Radisson Blu Dakar',
    }).select('id').single();
    if (!event?.id) throw new Error('Création événement échouée');

    const { data: category } = await adminClient.from('ticket_categories').insert({
        event_id: event.id,
        name: 'Pass Unique VIP',
        price: 15000,
        total_quantity: 1, // EXACTEMENT 1 SEUL BILLET DISPONIBLE
        sold_quantity: 0,
        is_active: true,
    }).select('id, total_quantity, sold_quantity').single();
    if (!category?.id) throw new Error('Création catégorie de billet échouée');

    try {
        // 3. EXÉCUTION CONCURRENTE RÉELLE VIA Promise.allSettled()
        // Deux acheteurs tentent d'acheter le dernier billet EXACTEMENT en même temps
        const [result1, result2] = await Promise.allSettled([
            EventService.purchaseTicketAtomic({
                eventId: event.id,
                categoryId: category.id,
                userId: buyer1Id,
            }),
            EventService.purchaseTicketAtomic({
                eventId: event.id,
                categoryId: category.id,
                userId: buyer2Id,
            }),
        ]);

        console.log('--- RÉSULTATS DU TEST DE CONCURRENCE ---');
        console.log('Acheteur 1 Status:', result1.status, result1.status === 'rejected' ? (result1 as PromiseRejectedResult).reason.message : 'Achat réussi');
        console.log('Acheteur 2 Status:', result2.status, result2.status === 'rejected' ? (result2 as PromiseRejectedResult).reason.message : 'Achat réussi');

        // Assertion 1 : Une seule promesse a réussi, l'autre a été rejetée
        const fulfilledCount = (result1.status === 'fulfilled' ? 1 : 0) + (result2.status === 'fulfilled' ? 1 : 0);
        const rejectedCount = (result1.status === 'rejected' ? 1 : 0) + (result2.status === 'rejected' ? 1 : 0);

        assert.strictEqual(fulfilledCount, 1, 'EXACTEMENT UN SEUL achat concurrent doit réussir');
        assert.strictEqual(rejectedCount, 1, 'EXACTEMENT UN SEUL achat concurrent doit être rejeté');

        // Assertion 2 : Le message de rejet explicite l'épuisement des stocks
        const rejectedResult = result1.status === 'rejected' ? (result1 as PromiseRejectedResult) : (result2 as PromiseRejectedResult);
        assert.ok(
            rejectedResult.reason.message.includes('Épuisé'),
            `Le message de rejet doit indiquer que le billet est épuisé (Reçu: ${rejectedResult.reason.message})`
        );

        // Assertion 3 : Relecture directe de la catégorie en base de données PostgreSQL
        const { data: dbCategory, error: catErr } = await adminClient
            .from('ticket_categories')
            .select('total_quantity, sold_quantity')
            .eq('id', category.id)
            .single();

        assert.ok(!catErr && dbCategory, 'Relecture de la catégorie en base');
        assert.strictEqual(dbCategory.total_quantity, 1, 'total_quantity inchangé = 1');
        assert.strictEqual(dbCategory.sold_quantity, 1, 'sold_quantity = 1 (Exactement 1 vendu)');
        assert.ok(dbCategory.sold_quantity <= dbCategory.total_quantity, 'INVARIANT : sold_quantity <= total_quantity (Zéro survente)');

        // Assertion 4 : Relecture des tickets créés en base
        const { data: dbTickets } = await adminClient
            .from('tickets')
            .select('id, ticket_number, qr_code, status')
            .eq('category_id', category.id);

        assert.strictEqual(dbTickets?.length, 1, 'Exactement un seul ticket doit exister en base');
        assert.strictEqual(dbTickets?.[0]?.status, 'VALIDE', 'Le ticket émis est au statut VALIDE');
    } finally {
        await adminClient.from('tickets').delete().eq('event_id', event.id);
        await adminClient.from('ticket_categories').delete().eq('event_id', event.id);
        await adminClient.from('events').delete().eq('id', event.id);
        await adminClient.from('partners').delete().eq('id', partner.id);
        await adminClient.from('users').delete().in('id', [partnerUserId, buyer1Id, buyer2Id]);
        await adminClient.auth.admin.deleteUser(partnerUserId);
        await adminClient.auth.admin.deleteUser(buyer1Id);
        await adminClient.auth.admin.deleteUser(buyer2Id);
    }
});

test('4. CYCLE DE VIE COMPLET DES STATUTS (§31) : BROUILLON -> EN_ATTENTE -> Rejet auto-validation -> VALIDE -> PUBLIE -> TERMINE', async () => {
    if (!supabaseUrl || !serviceRoleKey) return;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const suffix = Date.now().toString().slice(-6);
    const phoneP = `+22177${Math.floor(1000000 + Math.random() * 9000000)}`;
    const phoneAdmin = `+22170${Math.floor(1000000 + Math.random() * 9000000)}`;

    const { data: authP } = await adminClient.auth.admin.createUser({
        email: `partner.cycle.${suffix}@eventvillage.sn`, password: 'Password123!', email_confirm: true, phone: phoneP, phone_confirm: true,
        user_metadata: { first_name: 'Partner', last_name: 'Cycle', phone: phoneP },
    });
    const { data: authAdmin } = await adminClient.auth.admin.createUser({
        email: `admin.cycle.${suffix}@eventvillage.sn`, password: 'Password123!', email_confirm: true, phone: phoneAdmin, phone_confirm: true,
        user_metadata: { first_name: 'Admin', last_name: 'Control', phone: phoneAdmin },
    });

    if (!authP?.user || !authAdmin?.user) throw new Error('Création utilisateurs échouée');
    const partnerUserId = authP.user.id;
    const adminUserId = authAdmin.user.id;

    await adminClient.from('users').upsert([
        { id: partnerUserId, email: `partner.cycle.${suffix}@eventvillage.sn`, phone: phoneP, first_name: 'Partner', last_name: 'Cycle', role: 'PARTENAIRE', status: 'ACTIF' },
        { id: adminUserId, email: `admin.cycle.${suffix}@eventvillage.sn`, phone: phoneAdmin, first_name: 'Admin', last_name: 'Control', role: 'ADMIN', status: 'ACTIF' }
    ]);

    const { data: partner } = await adminClient.from('partners').insert({
        user_id: partnerUserId, company_name: 'Cycle Events Agency', phone: phoneP, status: 'VALIDE'
    }).select('id').single();
    if (!partner?.id) throw new Error('Création partenaire échouée');

    // 1. Étape 1 : Création initiale en statut BROUILLON
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

        // 4. Étape 4 : L'Administrateur valide l'événement (EN_ATTENTE -> VALIDE)
        const step4 = await EventService.changeEventStatus(event.id, adminUserId, 'VALIDE', 'ADMIN');
        assert.strictEqual(step4.status, 'VALIDE', 'Étape 4 : Statut passé à VALIDE par l\'Administrateur');

        const { data: dbStep4 } = await adminClient.from('events').select('status').eq('id', event.id).single();
        assert.strictEqual(dbStep4?.status, 'VALIDE', 'Relecture DB Étape 4 = VALIDE');

        // 5. Étape 5 : Publication de l'événement (VALIDE -> PUBLIE)
        const step5 = await EventService.changeEventStatus(event.id, partnerUserId, 'PUBLIE', 'PARTENAIRE');
        assert.strictEqual(step5.status, 'PUBLIE', 'Étape 5 : Statut passé à PUBLIE');

        const { data: dbStep5 } = await adminClient.from('events').select('status').eq('id', event.id).single();
        assert.strictEqual(dbStep5?.status, 'PUBLIE', 'Relecture DB Étape 5 = PUBLIE');

        // 6. Étape 6 : Clôture de l'événement (PUBLIE -> TERMINE)
        const step6 = await EventService.changeEventStatus(event.id, partnerUserId, 'TERMINE', 'PARTENAIRE');
        assert.strictEqual(step6.status, 'TERMINE', 'Étape 6 : Statut passé à TERMINE');

        const { data: dbStep6 } = await adminClient.from('events').select('status').eq('id', event.id).single();
        assert.strictEqual(dbStep6?.status, 'TERMINE', 'Relecture DB Étape 6 = TERMINE');
    } finally {
        await adminClient.from('ticket_categories').delete().eq('event_id', event.id);
        await adminClient.from('events').delete().eq('id', event.id);
        await adminClient.from('partners').delete().eq('id', partner.id);
        await adminClient.from('users').delete().in('id', [partnerUserId, adminUserId]);
        await adminClient.auth.admin.deleteUser(partnerUserId);
        await adminClient.auth.admin.deleteUser(adminUserId);
    }
});
