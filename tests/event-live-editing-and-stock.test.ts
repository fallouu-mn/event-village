/**
 * ============================================================================
 * EVENT VILLAGE — CHANTIER 5 : SUITE DE TESTS D'INTÉGRATION
 * GESTION DYNAMIQUE DES ÉVÉNEMENTS EN PRODUCTION & BILLETTERIE EN DIRECT
 * ============================================================================
 * Exécute des tests réels contre la base de données Supabase.
 * Aucune dépendance de mock : persistance réelle, RLS et concurrence CAS.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

// Chargement des variables d'environnement depuis .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach((line) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
            const [k, ...v] = trimmed.split('=');
            process.env[k.trim()] = v.join('=').trim();
        }
    });
}

import { EventService } from '../lib/events/event.service';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

// Comptes de test du projet
const partnerAUserId = 'e706a7a2-502c-4396-9e91-4dc6720388f7';
const partnerBUserId = '775818bd-1833-4e99-843d-3f5ecf8196e3';
const clientAUserId = 'a7345050-03cf-4967-9281-9ee5eb75615a';

async function createPublishedEvent(partnerId: string, options: {
    title: string;
    capacity?: number;
    categories: Array<{ name: string; price: number; total_quantity: number; sold_quantity?: number }>;
}) {
    const suffix = Date.now().toString().slice(-6);

    // 1. Insertion de l'événement avec statut PUBLIE
    const { data: event, error: evErr } = await supabaseAdmin
        .from('events')
        .insert({
            partner_id: partnerId,
            title: `${options.title} ${suffix}`,
            description: 'Événement de test en direct pour le Chantier 5',
            start_date: '2026-10-15',
            start_time: '20:00',
            end_date: '2026-10-15',
            end_time: '23:30',
            location: 'Grand Théâtre National',
            city: 'Dakar',
            capacity: options.capacity ?? null,
            status: 'PUBLIE',
            practical_info: {
                address: 'Boulevard de la Libération',
                accessNotes: 'Entrée porte A',
                parking: 'Parking public sécurisé',
                contactPhone: '+221771112233',
            },
        })
        .select('*')
        .single();

    if (evErr || !event) {
        throw new Error(`Échec création événement: ${evErr?.message}`);
    }

    // 2. Insertion des catégories
    const catsToInsert = options.categories.map((c) => ({
        event_id: event.id,
        name: c.name,
        price: c.price,
        total_quantity: c.total_quantity,
        sold_quantity: c.sold_quantity ?? 0,
        is_active: (c.sold_quantity ?? 0) < c.total_quantity,
        is_visible: true,
    }));

    const { data: insertedCats, error: catErr } = await supabaseAdmin
        .from('ticket_categories')
        .insert(catsToInsert)
        .select('*');

    if (catErr || !insertedCats) {
        throw new Error(`Échec insertion catégories: ${catErr?.message}`);
    }

    return { event, categories: insertedCats };
}

// ────────────────────────────────────────────────────────────────────────────
// TESTS SUITE
// ────────────────────────────────────────────────────────────────────────────

test('1. AUGMENTATION DE STOCK & RÉOUVERTURE CATÉGORIE SOLD OUT : Réassort en direct', async () => {
    const { data: partnerA } = await supabaseAdmin.from('partners').select('id').eq('user_id', partnerAUserId).single();
    assert.ok(partnerA?.id);

    // Événement avec catégorie Sold Out (50/50 vendus)
    const { event, categories } = await createPublishedEvent(partnerA.id, {
        title: 'Festival Sold Out Test',
        capacity: 200,
        categories: [{ name: 'Pass VIP', price: 25000, total_quantity: 50, sold_quantity: 50 }],
    });

    const vipCat = categories[0];
    assert.equal(vipCat.total_quantity, 50);
    assert.equal(vipCat.sold_quantity, 50);

    // Le partenaire augmente le quota à 80 places (+30 places)
    const updatedCat = await EventService.updateCategoryStockAndStatus(
        partnerAUserId,
        event.id,
        vipCat.id,
        { total_quantity: 80 }
    );

    assert.equal(updatedCat.total_quantity, 80);
    assert.equal(updatedCat.sold_quantity, 50);
    assert.equal(updatedCat.available_quantity, 30);
    assert.equal(updatedCat.is_active, true, 'La catégorie doit être réactivée automatiquement');

    // Vérification en base réelle
    const { data: dbCat } = await supabaseAdmin
        .from('ticket_categories')
        .select('*')
        .eq('id', vipCat.id)
        .single();

    assert.equal(dbCat.total_quantity, 80);
    assert.equal(dbCat.is_active, true);
});

test('2. DIMINUTION DE STOCK AUTORISÉE : Réduction sécurisée (total >= sold)', async () => {
    const { data: partnerA } = await supabaseAdmin.from('partners').select('id').eq('user_id', partnerAUserId).single();
    assert.ok(partnerA?.id);

    // 10 billets vendus sur 50
    const { event, categories } = await createPublishedEvent(partnerA.id, {
        title: 'Concert Réduction Quota',
        categories: [{ name: 'Standard', price: 10000, total_quantity: 50, sold_quantity: 10 }],
    });

    const standardCat = categories[0];

    // Réduction du quota à 25 (reste 15 places)
    const updated = await EventService.updateCategoryStockAndStatus(
        partnerAUserId,
        event.id,
        standardCat.id,
        { total_quantity: 25 }
    );

    assert.equal(updated.total_quantity, 25);
    assert.equal(updated.sold_quantity, 10);
    assert.equal(updated.available_quantity, 15);

    // Vérification en base
    const { data: dbCat } = await supabaseAdmin
        .from('ticket_categories')
        .select('*')
        .eq('id', standardCat.id)
        .single();

    assert.equal(dbCat.total_quantity, 25);
});

test('3. DIMINUTION DE STOCK INTERDITE : Rejet strict si total < sold_quantity (Ex: 42 vendus, demande 40)', async () => {
    const { data: partnerA } = await supabaseAdmin.from('partners').select('id').eq('user_id', partnerAUserId).single();
    assert.ok(partnerA?.id);

    // 42 billets vendus sur 100
    const { event, categories } = await createPublishedEvent(partnerA.id, {
        title: 'Conférence Quota Limite',
        categories: [{ name: 'Pass Conférence', price: 15000, total_quantity: 100, sold_quantity: 42 }],
    });

    const confCat = categories[0];

    // Tentative de réduction à 40 (< 42 vendus) -> Doit échouer
    await assert.rejects(
        async () => {
            await EventService.updateCategoryStockAndStatus(
                partnerAUserId,
                event.id,
                confCat.id,
                { total_quantity: 40 }
            );
        },
        /Impossible de réduire le quota à 40 : 42 billets ont déjà été vendus/,
        'Doit rejeter une réduction sous le nombre de billets vendus'
    );

    // Vérification que la DB est restée intacte (toujours 100)
    const { data: dbCat } = await supabaseAdmin
        .from('ticket_categories')
        .select('*')
        .eq('id', confCat.id)
        .single();

    assert.equal(dbCat.total_quantity, 100);
});

test('4. CAPACITÉ GLOBALE & AUGMENTATION DE CAPACITÉ : Somme des quotas <= Capacity', async () => {
    const { data: partnerA } = await supabaseAdmin.from('partners').select('id').eq('user_id', partnerAUserId).single();
    assert.ok(partnerA?.id);

    // Salle de capacité 100 places, avec 2 catégories (60 + 40 = 100)
    const { event, categories } = await createPublishedEvent(partnerA.id, {
        title: 'Salle Pleine Capacité',
        capacity: 100,
        categories: [
            { name: 'Catégorie A', price: 5000, total_quantity: 60, sold_quantity: 20 },
            { name: 'Catégorie B', price: 10000, total_quantity: 40, sold_quantity: 10 },
        ],
    });

    const catB = categories[1];

    // 1. Tentative d'augmenter Cat B à 50 (somme = 60 + 50 = 110 > 100) -> Doit être rejeté
    await assert.rejects(
        async () => {
            await EventService.updateCategoryStockAndStatus(
                partnerAUserId,
                event.id,
                catB.id,
                { total_quantity: 50 }
            );
        },
        /dépasse la capacité maximale/,
        'Doit rejeter le dépassement de la jauge globale de la salle'
    );

    // 2. Le partenaire augmente d'abord la capacité de la salle de 100 à 150
    const updatedEvent = await EventService.updateEvent(event.id, partnerAUserId, {
        capacity: 150,
    });
    assert.equal(updatedEvent.capacity, 150);

    // 3. Maintenant, l'augmentation de Cat B à 50 passe sans problème (110 <= 150)
    const updatedCatB = await EventService.updateCategoryStockAndStatus(
        partnerAUserId,
        event.id,
        catB.id,
        { total_quantity: 50 }
    );
    assert.equal(updatedCatB.total_quantity, 50);
});

test('5. MODIFICATION DU LIEU, VILLE ET INFOS PRATIQUES SUR ÉVÉNEMENT PUBLIÉ', async () => {
    const { data: partnerA } = await supabaseAdmin.from('partners').select('id').eq('user_id', partnerAUserId).single();
    assert.ok(partnerA?.id);

    const { event } = await createPublishedEvent(partnerA.id, {
        title: 'Gala Annuel 2026',
        categories: [{ name: 'Entrée Simple', price: 5000, total_quantity: 100 }],
    });

    // Modification du lieu et des infos pratiques
    const updated = await EventService.updateEvent(event.id, partnerAUserId, {
        location: 'King Fahd Palace',
        city: 'Dakar',
        description: 'Nouvelle description mise à jour en direct',
        practical_info: {
            address: 'Pointe des Almadies',
            accessNotes: 'Entrée principale Almadies',
            parking: 'Parking gardé 500 places',
            contactPhone: '+221778889900',
        },
    });

    assert.equal(updated.location, 'King Fahd Palace');
    assert.equal(updated.city, 'Dakar');
    assert.equal(updated.description, 'Nouvelle description mise à jour en direct');
    assert.equal(updated.practical_info.address, 'Pointe des Almadies');
    assert.equal(updated.practical_info.parking, 'Parking gardé 500 places');

    // Vérification de la journalisation dans audit_logs
    const { data: auditLog } = await supabaseAdmin
        .from('audit_logs')
        .select('*')
        .eq('object_id', event.id)
        .eq('action', 'EVENT_LIVE_UPDATED')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    assert.ok(auditLog, 'Une entrée dans audit_logs doit être créée');
    assert.equal(auditLog.user_id, partnerAUserId);
});

test('6. MODIFICATION DE DATE/HEURE AVEC BILLETS VENDUS : Détection & Envoi des notifications', async () => {
    const { data: partnerA } = await supabaseAdmin.from('partners').select('id').eq('user_id', partnerAUserId).single();
    assert.ok(partnerA?.id);

    const { event, categories } = await createPublishedEvent(partnerA.id, {
        title: 'Concert avec Billets Vendus',
        categories: [{ name: 'Pass VIP', price: 20000, total_quantity: 100, sold_quantity: 1 }],
    });

    // Création d'un billet valide pour le client
    const suffix = Date.now().toString().slice(-6);
    const { data: ticket, error: tErr } = await supabaseAdmin
        .from('tickets')
        .insert({
            event_id: event.id,
            category_id: categories[0].id,
            user_id: clientAUserId,
            ticket_number: `TCK-LIVE-${suffix}`,
            price: 20000,
            qr_code: `QR-CODE-${suffix}`,
            status: 'VALIDE',
        })
        .select('*')
        .single();

    assert.ifError(tErr);
    assert.ok(ticket, 'Billet de test créé');

    // Modification de la date et heure de début
    const updated = await EventService.updateEvent(event.id, partnerAUserId, {
        start_date: '2026-11-20',
        start_time: '21:30',
    });

    assert.equal(updated.start_date, '2026-11-20');
    assert.equal(updated.start_time.slice(0, 5), '21:30');

    // Vérification que la notification in-app a été créée pour le client
    const { data: notifs } = await supabaseAdmin
        .from('notifications')
        .select('*')
        .eq('user_id', clientAUserId)
        .order('created_at', { ascending: false });

    const eventNotif = (notifs || []).find((n: any) => n.data?.eventId === event.id || n.title?.includes('Mise à jour'));
    assert.ok(eventNotif, 'Le client ayant un billet valide doit recevoir une notification');
    assert.match(eventNotif.title, /Mise à jour/);
});

test('7. ISOLATION MULTI-TENANT & RBAC : Partenaire B ne peut pas modifier Partenaire A', async () => {
    const { data: partnerA } = await supabaseAdmin.from('partners').select('id').eq('user_id', partnerAUserId).single();
    assert.ok(partnerA?.id);

    const { event, categories } = await createPublishedEvent(partnerA.id, {
        title: 'Événement Partenaire A',
        categories: [{ name: 'Standard', price: 5000, total_quantity: 50 }],
    });

    // 1. Partenaire B tente de modifier l'événement de Partenaire A
    await assert.rejects(
        async () => {
            await EventService.updateEvent(event.id, partnerBUserId, {
                title: 'Hacked Title',
            });
        },
        /Événement introuvable ou non autorisé/,
        'Partenaire B doit être rejeté sur la mise à jour de l\'événement de A'
    );

    // 2. Partenaire B tente de modifier le quota d'une catégorie de Partenaire A
    await assert.rejects(
        async () => {
            await EventService.updateCategoryStockAndStatus(
                partnerBUserId,
                event.id,
                categories[0].id,
                { total_quantity: 100 }
            );
        },
        /Événement introuvable ou non autorisé/,
        'Partenaire B doit être rejeté sur la mise à jour des quotas de A'
    );
});

test('8. CONCURRENCE SUR LES QUOTAS (Promise.allSettled) : Atomicité et intégrité', async () => {
    const { data: partnerA } = await supabaseAdmin.from('partners').select('id').eq('user_id', partnerAUserId).single();
    assert.ok(partnerA?.id);

    const { event, categories } = await createPublishedEvent(partnerA.id, {
        title: 'Test Concurrence Quotas',
        categories: [{ name: 'Standard', price: 5000, total_quantity: 50, sold_quantity: 20 }],
    });

    const catId = categories[0].id;

    // 2 mises à jour simultanées : une à 80 et une à 90
    const results = await Promise.allSettled([
        EventService.updateCategoryStockAndStatus(partnerAUserId, event.id, catId, { total_quantity: 80 }),
        EventService.updateCategoryStockAndStatus(partnerAUserId, event.id, catId, { total_quantity: 90 }),
    ]);

    // Les deux requêtes doivent être valides et ne causer aucun crash
    const successes = results.filter((r) => r.status === 'fulfilled');
    assert.ok(successes.length >= 1, 'Au moins un appel réussit');

    // Vérification de la cohérence finale en base
    const { data: finalCat } = await supabaseAdmin
        .from('ticket_categories')
        .select('*')
        .eq('id', catId)
        .single();

    assert.ok([80, 90].includes(finalCat.total_quantity));
    assert.equal(finalCat.sold_quantity, 20);
});

test('9. INALTÉRABILITÉ DES ÉVÉNEMENTS ANNULÉS OU TERMINÉS', async () => {
    const { data: partnerA } = await supabaseAdmin.from('partners').select('id').eq('user_id', partnerAUserId).single();
    assert.ok(partnerA?.id);

    // Créer un événement et le passer en TERMINE
    const { event, categories } = await createPublishedEvent(partnerA.id, {
        title: 'Événement Clôturé',
        categories: [{ name: 'Pass VIP', price: 20000, total_quantity: 50 }],
    });

    await supabaseAdmin
        .from('events')
        .update({ status: 'TERMINE' })
        .eq('id', event.id);

    // Tentative de modification de l'événement terminé
    await assert.rejects(
        async () => {
            await EventService.updateEvent(event.id, partnerAUserId, {
                location: 'Nouveau Lieu',
            });
        },
        /Un événement en statut TERMINE ne peut plus être modifié/,
        'Un événement terminé ne peut plus être modifié'
    );

    // Tentative de modification des quotas d'un événement terminé
    await assert.rejects(
        async () => {
            await EventService.updateCategoryStockAndStatus(
                partnerAUserId,
                event.id,
                categories[0].id,
                { total_quantity: 100 }
            );
        },
        /Impossible de modifier une catégorie pour un événement en statut TERMINE/,
        'Les quotas d\'un événement terminé ne peuvent plus être modifiés'
    );
});
