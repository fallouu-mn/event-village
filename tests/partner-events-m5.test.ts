import { test } from 'node:test';
import assert from 'node:assert';
import { EventService } from '../lib/events/event.service';
import { PaymentService } from '../lib/payments/payment.service';
import { samirPayClient } from '../lib/samirpay/client';
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
        password: 'Password123!'
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
    const password = 'Password123!';

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

test('3. PROTECTION ANTI-SURVENTE (RACE CONDITION) : Deux paiements réels concurrents (Promise.allSettled webhooks) sur 1 billet restant -> Exactement 1 seul billet émis et 0 survente', async () => {
    if (!supabaseUrl || !serviceRoleKey) return;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const paymentService = new PaymentService();

    // Use existing test users:
    // Partner: Partner A (e706a7a2-502c-4396-9e91-4dc6720388f7)
    // Buyer1: Client A (a7345050-03cf-4967-9281-9ee5eb75615a)
    // Buyer2: Controller X (fe9318ac-1f65-4e80-980f-f00626f1a003) - we'll temporarily set their role to CLIENT for this test
    const partnerUserId = 'e706a7a2-502c-4396-9e91-4dc6720388f7'; // Partner A
    const buyer1Id = 'a7345050-03cf-4967-9281-9ee5eb75615a'; // Client A
    let buyer2Id = 'fe9318ac-1f65-4e80-980f-f00626f1a003'; // Controller X

    const suffix = Date.now().toString().slice(-6);
    const phoneP = `+22177${Math.floor(1000000 + Math.random() * 9000000)}`;
    const phoneBuyer1 = `+22176${Math.floor(1000000 + Math.random() * 9000000)}`;
    // For buyer2 (controller), we'll use a different phone to avoid conflict
    const phoneBuyer2 = `+22175${Math.floor(1000000 + Math.random() * 9000000)}`;

    // 1. Update Partner A's auth and metadata
    await adminClient.auth.admin.updateUserById(partnerUserId, {
        email: `partner.sale.${suffix}@eventvillage.sn`,
        email_confirm: true,
        phone: phoneP,
        phone_confirm: true,
        user_metadata: { first_name: 'Organisateur', last_name: 'Test', phone: phoneP },
        password: 'Password123!'
    });

    // 2. Update Buyer1 (Client A) auth and metadata
    await adminClient.auth.admin.updateUserById(buyer1Id, {
        email: `buyer1.${suffix}@eventvillage.sn`,
        email_confirm: true,
        phone: phoneBuyer1,
        phone_confirm: true,
        user_metadata: { first_name: 'Acheteur', last_name: 'Un', phone: phoneBuyer1 },
        password: 'Password123!'
    });

    // 3. Update Buyer2 (Controller X) auth and metadata, and temporarily set role to CLIENT
    await adminClient.auth.admin.updateUserById(buyer2Id, {
        email: `buyer2.${suffix}@eventvillage.sn`,
        email_confirm: true,
        phone: phoneBuyer2,
        phone_confirm: true,
        user_metadata: { first_name: 'Acheteur', last_name: 'Deux', phone: phoneBuyer2 },
        password: 'Password123!'
    });
    // Temporarily change role to CLIENT for this test
    await adminClient.from('users').update({ role: 'CLIENT' }).eq('id', buyer2Id);

    // 4. Upsert all three users in the public users table
    await adminClient.from('users').upsert([
        { id: partnerUserId, email: `partner.sale.${suffix}@eventvillage.sn`, phone: phoneP, first_name: 'Organisateur', last_name: 'Test', role: 'PARTENAIRE', status: 'ACTIF' },
        { id: buyer1Id, email: `buyer1.${suffix}@eventvillage.sn`, phone: phoneBuyer1, first_name: 'Acheteur', last_name: 'Un', role: 'CLIENT', status: 'ACTIF' },
        { id: buyer2Id, email: `buyer2.${suffix}@eventvillage.sn`, phone: phoneBuyer2, first_name: 'Acheteur', last_name: 'Deux', role: 'CLIENT', status: 'ACTIF' } // Note: role is CLIENT due to update above
    ]);

    // 5. Ensure partner record exists for Partner A
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
                company_name: 'Event Concurrency Production',
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

    const originalInitPayment = samirPayClient.initPayment;
    let paymentId: string | null = null;

    try {
        // Mock réseau SamirPay pour initialiser les intentions de paiement en ligne
        samirPayClient.initPayment = async (payload) => ({
            success: true,
            status: 'success',
            transaction_id: `TX-SAMIR-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            order_id: payload.order_id,
            payment_url: `https://app.samirpay.com/pay/${payload.order_id}`,
            message: 'Intention de paiement enregistrée',
        });

        // 3. Deux acheteurs tentent d'initier le paiement SIMULTANÉMENT via Promise.allSettled
        const [payRes1, payRes2] = await Promise.allSettled([
            paymentService.createPayment(buyer1Id, {
                targetType: 'TICKET',
                targetId: category.id,
                operator: 'WAVE',
                customerPhone: phoneBuyer1,
            }),
            paymentService.createPayment(buyer2Id, {
                targetType: 'TICKET',
                targetId: category.id,
                operator: 'WAVE',
                customerPhone: phoneBuyer2,
            }),
        ]);

        console.log('--- RÉSULTATS DU TEST DE CONCURRENCE SUR LE PARCOURS DE PAIEMENT REEL ---');
        console.log('Initiation Acheteur 1 Status:', payRes1.status);
        console.log('Initiation Acheteur 2 Status:', payRes2.status);

        // Exactement 1 succès et 1 rejet immédiat avant débit
        const fulfilled = [payRes1, payRes2].filter(r => r.status === 'fulfilled') as PromiseFulfilledResult<any>[];
        const rejected = [payRes1, payRes2].filter(r => r.status === 'rejected') as PromiseRejectedResult[];

        assert.strictEqual(fulfilled.length, 1, 'EXACTEMENT 1 SEULE initiation de paiement autorisée sur 1 billet restant');
        assert.strictEqual(rejected.length, 1, 'EXACTEMENT 1 tentative rejetée avant débit (Protection Anti-Survente)');

        const winningPayment = fulfilled[0].value;
        paymentId = winningPayment.payment_id;
        assert.strictEqual(winningPayment.status, 'PENDING');

        // 4. Traitement du webhook SamirPay SUCCESS pour le paiement gagnant
        const formData = new FormData();
        formData.append('transaction_id', winningPayment.transaction_id);
        formData.append('order_id', winningPayment.order_id);
        formData.append('status', 'SUCCESS');

        const webhookRes = await paymentService.handleSamirPayWebhook(formData);
        assert.strictEqual(webhookRes.success, true, 'Webhook validé avec succès');

        // 5. Assertion : Relecture stricte de la base de données PostgreSQL
        // 5.1 Relecture de la catégorie : sold_quantity DOIT valoir 1 et total_quantity 1 (Zéro survente)
        const { data: dbCategory, error: catErr } = await adminClient
            .from('ticket_categories')
            .select('total_quantity, sold_quantity')
            .eq('id', category.id)
            .single();

        assert.ok(!catErr && dbCategory, 'Relecture de la catégorie en base');
        assert.strictEqual(dbCategory.total_quantity, 1, 'total_quantity inchangé = 1');
        assert.strictEqual(dbCategory.sold_quantity, 1, 'sold_quantity = 1 (Strictement 1 seul billet vendu)');
        assert.ok(dbCategory.sold_quantity <= dbCategory.total_quantity, 'INVARIANT : sold_quantity <= total_quantity (Zéro survente)');

        // 5.2 Relecture des tickets créés en base
        const { data: dbTickets } = await adminClient
            .from('tickets')
            .select('id, user_id, ticket_number, qr_code, status')
            .eq('category_id', category.id);

        assert.strictEqual(dbTickets?.length, 1, 'EXACTEMENT UN SEUL ticket doit exister en base de données');
        assert.strictEqual(dbTickets?.[0]?.status, 'VALIDE', 'Le ticket émis est au statut VALIDE');
        assert.ok(
            dbTickets?.[0]?.user_id === buyer1Id || dbTickets?.[0]?.user_id === buyer2Id,
            'Le ticket émis appartient à l\'un des deux acheteurs'
        );

        // 5.3 Relecture des paiements : le paiement gagnant a émis un ticket
        const { data: dbPmt } = await adminClient
            .from('payments')
            .select('id, status, ticket_id')
            .eq('id', paymentId!)
            .single();

        assert.strictEqual(dbPmt?.status, 'SUCCESS');
        assert.ok(dbPmt?.ticket_id, 'Un ticket est rattaché au paiement');
    } finally {
        samirPayClient.initPayment = originalInitPayment;
        if (paymentId) await adminClient.from('payments').delete().eq('id', paymentId);
        await adminClient.from('tickets').delete().eq('event_id', event.id);
        await adminClient.from('ticket_categories').delete().eq('event_id', event.id);
        await adminClient.from('events').delete().eq('id', event.id);
        await adminClient.from('partners').delete().eq('id', partner.id);
        // Reset Buyer2's role back to CONTROLEUR
        await adminClient.from('users').update({ role: 'CONTROLEUR' }).eq('id', buyer2Id);
    }
});

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
        password: 'Password123!'
    });

    // 2. Update Partner B's auth and metadata (temporarily for admin role in this test)
    await adminClient.auth.admin.updateUserById(adminUserId, {
        email: emailAdmin,
        email_confirm: true,
        phone: phoneAdmin,
        phone_confirm: true,
        user_metadata: { first_name: 'Admin', last_name: 'Control', phone: phoneAdmin },
        password: 'Password123!'
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

test('5. SÉCURITÉ ANTI-BILLET GRATUIT & VALIDATION PAR WEBHOOK SAMIRPAY : Blocage direct pour Client sur catégorie payante et émission stricte post-webhook SUCCESS', async () => {
    if (!supabaseUrl || !serviceRoleKey) return;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const paymentService = new PaymentService();

    // Use existing test users:
    // Partner: Partner A (e706a7a2-502c-4396-9e91-4dc6720388f7)
    // Client: Client A (a7345050-03cf-4967-9281-9ee5eb75615a)
    const partnerUserId = 'e706a7a2-502c-4396-9e91-4dc6720388f7'; // Partner A
    const clientId = 'a7345050-03cf-4967-9281-9ee5eb75615a'; // Client A

    const suffix = Date.now().toString().slice(-6);
    const emailP = `partner.pay.${suffix}@eventvillage.sn`;
    const emailC = `client.pay.${suffix}@eventvillage.sn`;
    const phoneP = `+22177${Math.floor(1000000 + Math.random() * 9000000)}`;
    const phoneClient = `+22176${Math.floor(1000000 + Math.random() * 9000000)}`;

    // 1. Update Partner A's auth and metadata
    await adminClient.auth.admin.updateUserById(partnerUserId, {
        email: emailP,
        email_confirm: true,
        phone: phoneP,
        phone_confirm: true,
        user_metadata: { first_name: 'Partner', last_name: 'Pay', phone: phoneP },
        password: 'Password123!'
    });

    // 2. Update Client A's auth and metadata
    await adminClient.auth.admin.updateUserById(clientId, {
        email: emailC,
        email_confirm: true,
        phone: phoneClient,
        phone_confirm: true,
        user_metadata: { first_name: 'Client', last_name: 'Pay', phone: phoneClient },
        password: 'Password123!'
    });

    // 3. Upsert both users in the public users table
    await adminClient.from('users').upsert([
        { id: partnerUserId, email: emailP, phone: phoneP, first_name: 'Partner', last_name: 'Pay', role: 'PARTENAIRE', status: 'ACTIF' },
        { id: clientId, email: emailC, phone: phoneClient, first_name: 'Client', last_name: 'Pay', role: 'CLIENT', status: 'ACTIF' }
    ]);

    // 4. Ensure partner record exists for Partner A
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
                company_name: 'Security Ticketing Test SA',
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

    const { data: event } = await adminClient.from('events').insert({
        partner_id: partner.id,
        title: 'Festival Payant Sécurisé',
        status: 'PUBLIE',
        start_date: '2026-12-31',
        start_time: '20:00',
        location: 'Monument Renaissance',
    }).select('id').single();
    if (!event?.id) throw new Error('Création événement échouée');

    // Catégorie payante à 20 000 FCFA
    const { data: paidCat } = await adminClient.from('ticket_categories').insert({
        event_id: event.id,
        name: 'Pass Payant VIP',
        price: 20000,
        total_quantity: 10,
        sold_quantity: 0,
        is_active: true,
    }).select('id, price').single();

    // Catégorie gratuite (0 FCFA)
    const { data: freeCat } = await adminClient.from('ticket_categories').insert({
        event_id: event.id,
        name: 'Pass Gratuit Presse',
        price: 0,
        total_quantity: 5,
        sold_quantity: 0,
        is_active: true,
    }).select('id, price').single();

    if (!paidCat?.id || !freeCat?.id) throw new Error('Création catégories échouée');

    let paymentId: string | null = null;

    try {
        // --- ÉTAPE A : Tentative d'appel direct à purchaseTicketAtomic par un CLIENT sur une catégorie payante (is_free = false) ---
        let directPaidAttemptFailed = false;
        let directPaidErrorMessage = '';
        try {
            await EventService.purchaseTicketAtomic({
                eventId: event.id,
                categoryId: paidCat.id,
                userId: clientId,
                callerRole: 'CLIENT',
            });
        } catch (err: unknown) {
            directPaidAttemptFailed = true;
            directPaidErrorMessage = err instanceof Error ? err.message : '';
        }

        assert.strictEqual(directPaidAttemptFailed, true, 'Un client appelant directement purchaseTicketAtomic pour un billet payant DOIT être rejeté');
        assert.ok(
            directPaidErrorMessage.includes('Paiement requis'),
            `L'erreur doit indiquer que le paiement est requis (Reçu: ${directPaidErrorMessage})`
        );

        // Vérification en base : Aucun billet payant n'a été créé
        const { data: paidTicketsCheck } = await adminClient.from('tickets').select('id').eq('category_id', paidCat.id);
        assert.strictEqual(paidTicketsCheck?.length, 0, 'Zéro billet payant ne doit exister en base');

        // --- ÉTAPE B : Appel direct à purchaseTicketAtomic par un CLIENT sur une catégorie gratuite (price = 0) ---
        const freeTicketResult = await EventService.purchaseTicketAtomic({
            eventId: event.id,
            categoryId: freeCat.id,
            userId: clientId,
            callerRole: 'CLIENT',
        });
        assert.ok(freeTicketResult.ticket.id, 'L\'émission d\'un billet gratuit est autorisée');
        assert.strictEqual(freeTicketResult.ticket.status, 'VALIDE', 'Le billet gratuit émis a le statut VALIDE');

        // --- ÉTAPE C : Parcours de paiement réel pour billet payant via SamirPay Webhook ---
        // Mock côté client pour isoler l'API externe réseau
        const originalInitPayment = samirPayClient.initPayment;
        samirPayClient.initPayment = async (payload) => ({
            success: true,
            status: 'success',
            transaction_id: `TX-SAMIR-${Date.now()}`,
            order_id: payload.order_id,
            payment_url: `https://app.samirpay.com/pay/${payload.order_id}`,
            message: 'Paiement initialisé avec succès',
        });

        let createPaymentRes;
        try {
            // 1. Initialisation de l'intention de paiement par le client
            createPaymentRes = await paymentService.createPayment(clientId, {
                targetType: 'TICKET',
                targetId: paidCat.id,
                operator: 'WAVE',
                customerPhone: phoneClient,
            });
        } finally {
            samirPayClient.initPayment = originalInitPayment;
        }

        assert.strictEqual(createPaymentRes.success, true);
        paymentId = createPaymentRes.payment_id;
        assert.strictEqual(createPaymentRes.status, 'PENDING');

        // Vérification qu'à ce stade, AUCUN ticket payant n'est encore émis pour cette commande
        const { data: ticketsBeforeWebhook } = await adminClient
            .from('tickets')
            .select('id')
            .eq('category_id', paidCat.id);
        assert.strictEqual(ticketsBeforeWebhook?.length, 0, 'Avant webhook, aucun ticket payant n\'est généré');

        // 2. Réception du webhook SamirPay avec le statut SUCCESS
        const formData = new FormData();
        formData.append('transaction_id', createPaymentRes.transaction_id);
        formData.append('order_id', createPaymentRes.order_id);
        formData.append('status', 'SUCCESS');

        const webhookRes = await paymentService.handleSamirPayWebhook(formData);
        assert.strictEqual(webhookRes.success, true, 'Webhook SamirPay traité avec succès');

        // 3. Vérification en base : Le paiement est SUCCESS et le ticket est émis avec status VALIDE
        const { data: dbPayment } = await adminClient
            .from('payments')
            .select('status, ticket_id')
            .eq('id', paymentId)
            .single();

        assert.strictEqual(dbPayment?.status, 'SUCCESS', 'Le paiement est passé à SUCCESS');
        assert.ok(dbPayment?.ticket_id, 'Le ticket_id a été rattaché au paiement');

        const { data: dbPaidTicket } = await adminClient
            .from('tickets')
            .select('id, ticket_number, qr_code, status, price')
            .eq('id', dbPayment!.ticket_id)
            .single();

        assert.ok(dbPaidTicket, 'Le billet payant existe en base après confirmation webhook');
        assert.strictEqual(dbPaidTicket?.status, 'VALIDE', 'Le statut du billet est strictement VALIDE');
        assert.strictEqual(Number(dbPaidTicket?.price), 20000, 'Prix du billet = 20 000 FCFA');

        // 4. Vérification de l'incrémentation atomique du stock
        const { data: dbPaidCat } = await adminClient
            .from('ticket_categories')
            .select('sold_quantity, total_quantity')
            .eq('id', paidCat.id)
            .single();

        assert.strictEqual(dbPaidCat?.sold_quantity, 1, 'sold_quantity a été incrémenté à 1 après webhook');
    } finally {
        if (paymentId) await adminClient.from('payments').delete().eq('id', paymentId);
        await adminClient.from('tickets').delete().eq('event_id', event.id);
        await adminClient.from('ticket_categories').delete().eq('event_id', event.id);
        await adminClient.from('events').delete().eq('id', event.id);
        // Note: We don't delete the existing partner/users as they are shared test data
        // We only clean up the event we created for this test
    }
});

test('6. ENCAISSEMENT GUICHET CONTROLEUR (§76) & INVITATIONS PARTENAIRE (§160) : Traçabilité financière intégrale dans la table payments', async () => {
    if (!supabaseUrl || !serviceRoleKey) return;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Utilisation des comptes permanents de test :
    const partnerUserId = 'e706a7a2-502c-4396-9e91-4dc6720388f7'; // Partner A
    const ctrlUserId = 'fe9318ac-1f65-4e80-980f-f00626f1a003';    // Controller X
    const client1Id = 'a7345050-03cf-4967-9281-9ee5eb75615a';     // Client A
    const guestId = '775818bd-1833-4e99-843d-3f5ecf8196e3';       // Partner B (utilisé comme invité VIP)

    const suffix = Date.now().toString().slice(-6);
    const emailP = `partner.guichet.${suffix}@eventvillage.sn`;
    const emailCtrl = `ctrl.guichet.${suffix}@eventvillage.sn`;
    const emailClient1 = `client1.guichet.${suffix}@eventvillage.sn`;
    const emailGuest = `guest.guichet.${suffix}@eventvillage.sn`;
    const phoneP = `+22177${Math.floor(1000000 + Math.random() * 9000000)}`;
    const phoneCtrl = `+22170${Math.floor(1000000 + Math.random() * 9000000)}`;
    const phoneClient1 = `+22176${Math.floor(1000000 + Math.random() * 9000000)}`;
    const phoneGuest = `+22178${Math.floor(1000000 + Math.random() * 9000000)}`;

    // 1. Mise à jour des mots de passe et métadonnées
    await adminClient.auth.admin.updateUserById(partnerUserId, {
        email: emailP,
        email_confirm: true,
        phone: phoneP,
        phone_confirm: true,
        user_metadata: { first_name: 'Partner', last_name: 'Guichet', phone: phoneP },
        password: 'Password123!'
    });

    await adminClient.auth.admin.updateUserById(ctrlUserId, {
        email: emailCtrl,
        email_confirm: true,
        phone: phoneCtrl,
        phone_confirm: true,
        user_metadata: { first_name: 'Controleur', last_name: 'Guichet', phone: phoneCtrl },
        password: 'Password123!'
    });
    await adminClient.from('users').update({ role: 'CONTROLEUR' }).eq('id', ctrlUserId);

    await adminClient.auth.admin.updateUserById(client1Id, {
        email: emailClient1,
        email_confirm: true,
        phone: phoneClient1,
        phone_confirm: true,
        user_metadata: { first_name: 'Client', last_name: 'Cash', phone: phoneClient1 },
        password: 'Password123!'
    });

    await adminClient.auth.admin.updateUserById(guestId, {
        email: emailGuest,
        email_confirm: true,
        phone: phoneGuest,
        phone_confirm: true,
        user_metadata: { first_name: 'VIP', last_name: 'Guest', phone: phoneGuest },
        password: 'Password123!'
    });
    await adminClient.from('users').update({ role: 'CLIENT' }).eq('id', guestId);

    // 2. Upsert dans la table users
    await adminClient.from('users').upsert([
        { id: partnerUserId, email: emailP, phone: phoneP, first_name: 'Partner', last_name: 'Guichet', role: 'PARTENAIRE', status: 'ACTIF' },
        { id: ctrlUserId, email: emailCtrl, phone: phoneCtrl, first_name: 'Controleur', last_name: 'Guichet', role: 'CONTROLEUR', status: 'ACTIF' },
        { id: client1Id, email: emailClient1, phone: phoneClient1, first_name: 'Client', last_name: 'Cash', role: 'CLIENT', status: 'ACTIF' },
        { id: guestId, email: emailGuest, phone: phoneGuest, first_name: 'VIP', last_name: 'Guest', role: 'CLIENT', status: 'ACTIF' }
    ]);

    // 3. S'assurer que le partner record existe
    let { data: partner, error: partnerErr } = await adminClient
        .from('partners')
        .select('id')
        .eq('user_id', partnerUserId)
        .single();

    if (partnerErr && partnerErr.code === 'PGRST116') {
        const { data: newPartner, error: insertErr } = await adminClient
            .from('partners')
            .insert({
                user_id: partnerUserId,
                company_name: 'Guichet & Invitations SA',
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

    const { data: event } = await adminClient.from('events').insert({
        partner_id: partner.id,
        title: 'Festival Guichet & VIP',
        status: 'PUBLIE',
        start_date: '2026-12-31',
        start_time: '20:00',
        location: 'Dakar Arena',
    }).select('id').single();
    if (!event?.id) throw new Error('Création événement échouée');

    const { data: paidCat } = await adminClient.from('ticket_categories').insert({
        event_id: event.id,
        name: 'Pass Entrée Payant',
        price: 10000,
        total_quantity: 50,
        sold_quantity: 0,
        is_active: true,
    }).select('id, price').single();
    if (!paidCat?.id) throw new Error('Création catégorie échouée');

    try {
        // --- CAS 1 : Émission Guichet physique par le Contrôleur (Espèces / Cash §76) ---
        const guichetTicketRes = await EventService.purchaseTicketAtomic({
            eventId: event.id,
            categoryId: paidCat.id,
            userId: client1Id,
            callerUserId: ctrlUserId,
            callerRole: 'CONTROLEUR',
        });

        assert.ok(guichetTicketRes.ticket.id, 'Billet émis avec succès par le Contrôleur au guichet');
        assert.strictEqual(guichetTicketRes.ticket.status, 'VALIDE');

        // Vérification de la création automatique de l'écriture comptable CASH dans la table payments
        const { data: cashPayment } = await adminClient
            .from('payments')
            .select('id, amount, payment_method, is_platform_payment, offline_payment_method, provider_status, status, ticket_id')
            .eq('ticket_id', guichetTicketRes.ticket.id)
            .single();

        assert.ok(cashPayment, 'Une ligne payment CASH DOIT exister en base pour tout billet guichet');
        assert.strictEqual(Number(cashPayment.amount), 10000, 'Montant encaissé en cash = 10 000 FCFA');
        assert.strictEqual(cashPayment.payment_method, 'CASH');
        assert.strictEqual(cashPayment.is_platform_payment, false);
        assert.strictEqual(cashPayment.offline_payment_method, 'ESPECES');
        assert.strictEqual(cashPayment.provider_status, 'GUICHET_CASH');
        assert.strictEqual(cashPayment.status, 'SUCCESS');

        // --- CAS 2 : Émission d'invitation par le Partenaire sur son événement (§160) ---
        const invitationRes = await EventService.purchaseTicketAtomic({
            eventId: event.id,
            categoryId: paidCat.id,
            userId: guestId,
            callerUserId: partnerUserId,
            callerRole: 'PARTENAIRE',
        });

        assert.ok(invitationRes.ticket.id, 'Billet d\'invitation émis avec succès par le Partenaire');
        assert.strictEqual(invitationRes.ticket.status, 'VALIDE');

        // Vérification de la création automatique de l'écriture comptable INVITATION dans la table payments
        const { data: invitationPayment } = await adminClient
            .from('payments')
            .select('id, amount, payment_method, is_platform_payment, provider_status, status, ticket_id')
            .eq('ticket_id', invitationRes.ticket.id)
            .single();

        assert.ok(invitationPayment, 'Une ligne payment INVITATION DOIT exister en base pour tout billet d\'invitation');
        assert.strictEqual(Number(invitationPayment.amount), 0, 'Montant de l\'invitation = 0 FCFA');
        assert.strictEqual(invitationPayment.payment_method, 'INVITATION');
        assert.strictEqual(invitationPayment.is_platform_payment, false);
        assert.strictEqual(invitationPayment.provider_status, 'INVITATION_ORGANISATEUR');
        assert.strictEqual(invitationPayment.status, 'SUCCESS');

        // --- CAS 3 : Vérification que le stock a été décrémenté de 2 ---
        const { data: updatedPaidCat } = await adminClient
            .from('ticket_categories')
            .select('sold_quantity, total_quantity')
            .eq('id', paidCat.id)
            .single();

        assert.strictEqual(updatedPaidCat?.sold_quantity, 2, 'sold_quantity devrait être de 2 après un guichet + une invitation');
        assert.strictEqual(updatedPaidCat?.total_quantity, 50, 'total_quantity devrait rester à 50');
    } finally {
        await adminClient.from('users').update({ role: 'PARTENAIRE' }).eq('id', guestId);
        await adminClient.from('tickets').delete().eq('event_id', event.id);
        await adminClient.from('ticket_categories').delete().eq('event_id', event.id);
        await adminClient.from('events').delete().eq('id', event.id);
        await adminClient.from('partners').delete().eq('id', partner.id);
    }
});
