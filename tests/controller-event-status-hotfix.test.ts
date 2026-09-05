import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Chargement des variables d'environnement
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
import { POST as inviteController } from '../app/api/partner/team/invite/route';
import { PATCH as updateAssignments } from '../app/api/partner/team/assignments/route';
import { POST as scanTicket } from '../app/api/controller/scan/route';
import { INELIGIBLE_EVENT_ASSIGNMENT_ERROR } from '../lib/events/event-status';

describe('HOTFIX MÉTIER — AFFECTATION CONTRÔLEUR ↔ ÉTAT DE L\'ÉVÉNEMENT (12 TESTS + ANTI-CONTOURNEMENT)', async () => {
    const supabase = getServiceRoleClient();
    const publicAuthClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const ts = Date.now().toString().slice(-6);

    // Identifiants de test
    let partnerAUserId: string;
    let partnerAId: string;
    let partnerAToken: string;

    let partnerBUserId: string;
    let partnerBId: string;
    let partnerBToken: string;

    let controllerUserId: string;
    let controllerEmail: string;
    let controllerPhone: string;
    let controllerToken: string;

    // Événements de test sous différents statuts
    let eventBrouillonId: string;
    let eventEnAttenteId: string;
    let eventSuspenduId: string;
    let eventValideId: string;
    let eventPublieId: string;
    let eventTermineId: string;
    let eventPartnerBId: string;

    let ticketEventSuspendu: any;
    let ticketEventTermine: any;

    before(async () => {
        // 1. Initialiser Partenaire A
        partnerAUserId = 'e706a7a2-502c-4396-9e91-4dc6720388f7';
        partnerAId = 'a917b7ac-d542-4c2b-b5d8-ab38f866b2e7';
        const { data: pAUser } = await supabase.from('users').select('email').eq('id', partnerAUserId).single();
        await supabase.auth.admin.updateUserById(partnerAUserId, { password: 'Password123!' });
        const { data: sA } = await publicAuthClient.auth.signInWithPassword({
            email: pAUser?.email || 'partenaireA@test.com',
            password: 'Password123!',
        });
        partnerAToken = sA?.session?.access_token || '';

        // 2. Initialiser Partenaire B (pour vérification d'isolation multi-tenant)
        partnerBUserId = '775818bd-1833-4e99-843d-3f5ecf8196e3';
        partnerBId = '9cdc4247-d1fe-483b-b5e2-12671b069134';
        const { data: pBUser } = await supabase.from('users').select('email').eq('id', partnerBUserId).single();
        await supabase.auth.admin.updateUserById(partnerBUserId, { password: 'Password123!' });
        const { data: sB } = await publicAuthClient.auth.signInWithPassword({
            email: pBUser?.email || 'partenaireB@test.com',
            password: 'Password123!',
        });
        partnerBToken = sB?.session?.access_token || '';

        // 3. Initialiser Contrôleur
        controllerUserId = 'fe9318ac-1f65-4e80-980f-f00626f1a003';
        controllerEmail = 'clientA_1788284499885@test.com';
        controllerPhone = `+22177${ts}99`;
        await supabase.auth.admin.updateUserById(controllerUserId, { password: 'Password123!' });
        await supabase.from('users').update({
            role: 'CONTROLEUR',
            status: 'ACTIF',
            phone: controllerPhone,
            first_name: 'Amadou',
            last_name: 'Ba',
        }).eq('id', controllerUserId);

        const { data: sCtrl } = await publicAuthClient.auth.signInWithPassword({
            email: controllerEmail,
            password: 'Password123!',
        });
        controllerToken = sCtrl?.session?.access_token || '';

        // 4. Créer les événements de test pour Partenaire A
        const { data: evBrouillon } = await supabase.from('events').insert({
            partner_id: partnerAId,
            title: `Brouillon ${ts}`,
            slug: `brouillon-${ts}`,
            description: 'Event en brouillon',
            start_date: '2026-12-10',
            start_time: '20:00:00',
            location: 'Dakar',
            status: 'BROUILLON',
        }).select().single();
        eventBrouillonId = evBrouillon.id;

        const { data: evAttente } = await supabase.from('events').insert({
            partner_id: partnerAId,
            title: `En Attente ${ts}`,
            slug: `en-attente-${ts}`,
            description: 'Event en attente de modération',
            start_date: '2026-12-11',
            start_time: '20:00:00',
            location: 'Dakar',
            status: 'EN_ATTENTE',
        }).select().single();
        eventEnAttenteId = evAttente.id;

        const { data: evSuspendu } = await supabase.from('events').insert({
            partner_id: partnerAId,
            title: `Suspendu ${ts}`,
            slug: `suspendu-${ts}`,
            description: 'Event suspendu par admin',
            start_date: '2026-12-12',
            start_time: '20:00:00',
            location: 'Dakar',
            status: 'SUSPENDU',
        }).select().single();
        eventSuspenduId = evSuspendu.id;

        const { data: evValide } = await supabase.from('events').insert({
            partner_id: partnerAId,
            title: `Validé ${ts}`,
            slug: `valide-${ts}`,
            description: 'Event validé opérationnel',
            start_date: '2026-12-13',
            start_time: '20:00:00',
            location: 'Dakar',
            status: 'VALIDE',
        }).select().single();
        eventValideId = evValide.id;

        const { data: evPublie } = await supabase.from('events').insert({
            partner_id: partnerAId,
            title: `Publié ${ts}`,
            slug: `publie-${ts}`,
            description: 'Event publié en ligne',
            start_date: '2026-12-14',
            start_time: '20:00:00',
            location: 'Dakar',
            status: 'PUBLIE',
        }).select().single();
        eventPublieId = evPublie.id;

        const { data: evTermine } = await supabase.from('events').insert({
            partner_id: partnerAId,
            title: `Terminé ${ts}`,
            slug: `termine-${ts}`,
            description: 'Event clôturé',
            start_date: '2026-08-01',
            start_time: '20:00:00',
            location: 'Dakar',
            status: 'TERMINE',
        }).select().single();
        eventTermineId = evTermine.id;

        // 5. Créer l'événement pour Partenaire B
        const { data: evPB } = await supabase.from('events').insert({
            partner_id: partnerBId,
            title: `Event Partenaire B ${ts}`,
            slug: `event-partner-b-${ts}`,
            description: 'Event de l\'autre partenaire',
            start_date: '2026-12-15',
            start_time: '20:00:00',
            location: 'Saint-Louis',
            status: 'PUBLIE',
        }).select().single();
        eventPartnerBId = evPB.id;

        // 6. Créer des billets pour tester le scanner
        const { data: catSusp } = await supabase.from('ticket_categories').insert({
            event_id: eventSuspenduId,
            name: 'Pass Standard',
            price: 5000,
            total_quantity: 100,
        }).select().single();

        const { data: tSusp } = await supabase.from('tickets').insert({
            event_id: eventSuspenduId,
            category_id: catSusp.id,
            user_id: partnerAUserId,
            ticket_number: `TCK-SUSP-${ts}`,
            qr_code: `EV-QR-SUSP-${ts}`,
            price: 5000,
            status: 'VALIDE',
        }).select().single();
        ticketEventSuspendu = tSusp;

        const { data: catTerm } = await supabase.from('ticket_categories').insert({
            event_id: eventTermineId,
            name: 'Pass Standard',
            price: 5000,
            total_quantity: 100,
        }).select().single();

        const { data: tTerm } = await supabase.from('tickets').insert({
            event_id: eventTermineId,
            category_id: catTerm.id,
            user_id: partnerAUserId,
            ticket_number: `TCK-TERM-${ts}`,
            qr_code: `EV-QR-TERM-${ts}`,
            price: 5000,
            status: 'VALIDE',
        }).select().single();
        ticketEventTermine = tTerm;

        // Nettoyage préalable des affectations du contrôleur
        await supabase.from('event_controllers').delete().eq('user_id', controllerUserId);
    });

    after(async () => {
        // Nettoyage complet
        const evIds = [eventBrouillonId, eventEnAttenteId, eventSuspenduId, eventValideId, eventPublieId, eventTermineId, eventPartnerBId].filter(Boolean);
        await supabase.from('tickets').delete().in('event_id', evIds);
        await supabase.from('ticket_categories').delete().in('event_id', evIds);
        await supabase.from('event_controllers').delete().eq('user_id', controllerUserId);
        await supabase.from('events').delete().in('id', evIds);
    });

    // ──────────────────────────────────────────────────────────
    // TEST 1 : Événement BROUILLON → tentative d'affectation → 400 rejeté
    // ──────────────────────────────────────────────────────────
    await test('TEST 1: Événement BROUILLON -> tentative d\'affectation rejetée avec HTTP 400', async () => {
        const req = new NextRequest('http://localhost:3000/api/partner/team/invite', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${partnerAToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                phone: controllerPhone,
                firstName: 'Amadou',
                lastName: 'Ba',
                event_ids: [eventBrouillonId],
            }),
        });
        const res = await inviteController(req);
        const data = await res.json();

        assert.equal(res.status, 400, 'Doit retourner 400');
        assert.equal(data.error, INELIGIBLE_EVENT_ASSIGNMENT_ERROR, 'Le message d\'erreur doit être la formule standard');
    });

    // ──────────────────────────────────────────────────────────
    // TEST 2 : Événement EN_ATTENTE → tentative d'affectation → 400 rejeté
    // ──────────────────────────────────────────────────────────
    await test('TEST 2: Événement EN_ATTENTE -> tentative d\'affectation rejetée avec HTTP 400', async () => {
        const req = new NextRequest('http://localhost:3000/api/partner/team/invite', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${partnerAToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                phone: controllerPhone,
                firstName: 'Amadou',
                lastName: 'Ba',
                event_ids: [eventEnAttenteId],
            }),
        });
        const res = await inviteController(req);
        const data = await res.json();

        assert.equal(res.status, 400, 'Doit retourner 400');
        assert.equal(data.error, INELIGIBLE_EVENT_ASSIGNMENT_ERROR);
    });

    // ──────────────────────────────────────────────────────────
    // TEST 3 : Événement SUSPENDU → tentative d'affectation → 400 rejeté
    // ──────────────────────────────────────────────────────────
    await test('TEST 3: Événement SUSPENDU -> tentative d\'affectation rejetée avec HTTP 400', async () => {
        const req = new NextRequest('http://localhost:3000/api/partner/team/invite', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${partnerAToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                phone: controllerPhone,
                firstName: 'Amadou',
                lastName: 'Ba',
                event_ids: [eventSuspenduId],
            }),
        });
        const res = await inviteController(req);
        const data = await res.json();

        assert.equal(res.status, 400, 'Doit retourner 400');
        assert.equal(data.error, INELIGIBLE_EVENT_ASSIGNMENT_ERROR);
    });

    // ──────────────────────────────────────────────────────────
    // TEST 4 : Événement CONFIRMÉ (VALIDE & PUBLIE) → affectation → 200 succès
    // ──────────────────────────────────────────────────────────
    await test('TEST 4: Événement CONFIRMÉ (VALIDE & PUBLIE) -> affectation autorisée avec HTTP 200', async () => {
        const req = new NextRequest('http://localhost:3000/api/partner/team/invite', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${partnerAToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                phone: controllerPhone,
                firstName: 'Amadou',
                lastName: 'Ba',
                event_ids: [eventValideId, eventPublieId],
            }),
        });
        const res = await inviteController(req);
        const data = await res.json();

        assert.ok(res.status === 200 || res.status === 201, 'Doit retourner 200 ou 201 succès');
        assert.equal(data.success, true);

        // Vérifier en base la présence des 2 affectations
        const { data: dbAssignments } = await supabase
            .from('event_controllers')
            .select('event_id')
            .eq('user_id', controllerUserId);

        const assignedIds = dbAssignments?.map(a => a.event_id) || [];
        assert.ok(assignedIds.includes(eventValideId), 'L\'événement VALIDÉ doit être assigné');
        assert.ok(assignedIds.includes(eventPublieId), 'L\'événement PUBLIÉ doit être assigné');
    });

    // ──────────────────────────────────────────────────────────
    // TEST 5 : Événement TERMINÉ → nouvelle affectation → 400 rejeté
    // ──────────────────────────────────────────────────────────
    await test('TEST 5: Événement TERMINÉ -> nouvelle affectation rejetée avec HTTP 400', async () => {
        const req = new NextRequest('http://localhost:3000/api/partner/team/assignments', {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${partnerAToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                controller_id: controllerUserId,
                event_ids: [eventValideId, eventPublieId, eventTermineId],
            }),
        });
        const res = await updateAssignments(req);
        const data = await res.json();

        assert.equal(res.status, 400, 'Doit retourner 400');
        assert.equal(data.error, INELIGIBLE_EVENT_ASSIGNMENT_ERROR);
    });

    // ──────────────────────────────────────────────────────────
    // TEST 6 : Événement d'un autre partenaire → tentative d'affectation → 403 rejeté
    // ──────────────────────────────────────────────────────────
    await test('TEST 6: Événement d\'un autre partenaire -> tentative d\'affectation rejetée avec HTTP 403', async () => {
        const req = new NextRequest('http://localhost:3000/api/partner/team/invite', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${partnerAToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                phone: controllerPhone,
                firstName: 'Amadou',
                lastName: 'Ba',
                event_ids: [eventPartnerBId],
            }),
        });
        const res = await inviteController(req);
        const data = await res.json();

        assert.equal(res.status, 403, 'Doit retourner 403 Forbidden');
        assert.match(data.error, /propriétaire/i);
    });

    // ──────────────────────────────────────────────────────────
    // TEST 7 : Même événement déjà assigné → pas de duplication
    // ──────────────────────────────────────────────────────────
    await test('TEST 7: Même événement déjà assigné -> réaffectation idempotente sans duplication', async () => {
        const req = new NextRequest('http://localhost:3000/api/partner/team/invite', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${partnerAToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                phone: controllerPhone,
                firstName: 'Amadou',
                lastName: 'Ba',
                event_ids: [eventValideId],
            }),
        });
        const res = await inviteController(req);
        assert.equal(res.status, 200);

        // Compter les lignes en DB pour ce couple (user_id, event_id)
        const { count } = await supabase
            .from('event_controllers')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', controllerUserId)
            .eq('event_id', eventValideId);

        assert.equal(count, 1, 'Exactement 1 ligne doit exister, aucune duplication tolérée');
    });

    // ──────────────────────────────────────────────────────────
    // TEST 8 : Événement CONFIRMÉ → SUSPENDU → scanner bloqué
    // ──────────────────────────────────────────────────────────
    await test('TEST 8: Événement CONFIRMÉ -> SUSPENDU -> scanner bloqué (HTTP 400 event_suspended)', async () => {
        // Assigner le contrôleur à l'événement suspendu directement en base (pour simuler un événement suspendu a posteriori)
        await supabase.from('event_controllers').upsert({
            event_id: eventSuspenduId,
            user_id: controllerUserId,
            can_accept_cash: false,
            created_by: partnerAUserId,
        });

        const req = new NextRequest('http://localhost:3000/api/controller/scan', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${controllerToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                qr_code: ticketEventSuspendu.qr_code,
                event_id: eventSuspenduId,
            }),
        });
        const res = await scanTicket(req);
        const data = await res.json();

        assert.equal(res.status, 400, 'Doit refuser le scan avec 400');
        assert.ok(data.scan_result === 'event_suspended' || data.code === 'event_suspended', 'Le code doit indiquer que l\'événement est suspendu');
    });

    // ──────────────────────────────────────────────────────────
    // TEST 9 : Événement CONFIRMÉ → TERMINÉ → scanner bloqué
    // ──────────────────────────────────────────────────────────
    await test('TEST 9: Événement CONFIRMÉ -> TERMINÉ -> scanner bloqué (HTTP 400 event_ended)', async () => {
        // Assigner le contrôleur à l'événement terminé directement en base (pour simuler un événement achevé a posteriori)
        await supabase.from('event_controllers').upsert({
            event_id: eventTermineId,
            user_id: controllerUserId,
            can_accept_cash: false,
            created_by: partnerAUserId,
        });

        const req = new NextRequest('http://localhost:3000/api/controller/scan', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${controllerToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                qr_code: ticketEventTermine.qr_code,
                event_id: eventTermineId,
            }),
        });
        const res = await scanTicket(req);
        const data = await res.json();

        assert.equal(res.status, 400, 'Doit refuser le scan avec 400');
        assert.ok(data.scan_result === 'event_ended' || data.code === 'event_ended', 'Le code doit indiquer que l\'événement est terminé');
    });

    // ──────────────────────────────────────────────────────────
    // TEST 10 : Payload manipulé via PATCH assignments avec ID événement inéligible → 400
    // ──────────────────────────────────────────────────────────
    await test('TEST 10: Payload manipulé via PATCH assignments avec un événement inéligible -> rejeté avec HTTP 400', async () => {
        const req = new NextRequest('http://localhost:3000/api/partner/team/assignments', {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${partnerAToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                controller_id: controllerUserId,
                event_ids: [eventBrouillonId], // ID brouillon injecté manuellement
            }),
        });
        const res = await updateAssignments(req);
        const data = await res.json();

        assert.equal(res.status, 400, 'Doit retourner 400 Bad Request');
        assert.equal(data.error, INELIGIBLE_EVENT_ASSIGNMENT_ERROR);
    });

    // ──────────────────────────────────────────────────────────
    // TEST 11 : Payload manipulé via PATCH assignments avec ID événement d'un autre partenaire → 403
    // ──────────────────────────────────────────────────────────
    await test('TEST 11: Payload manipulé via PATCH assignments avec événement d\'un autre partenaire -> rejeté avec HTTP 403', async () => {
        const req = new NextRequest('http://localhost:3000/api/partner/team/assignments', {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${partnerAToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                controller_id: controllerUserId,
                event_ids: [eventPartnerBId], // ID d'un autre partenaire
            }),
        });
        const res = await updateAssignments(req);
        const data = await res.json();

        assert.equal(res.status, 403, 'Doit retourner 403 Forbidden');
        assert.match(data.error, /propriétaire/i);
    });

    // ──────────────────────────────────────────────────────────
    // TEST 12 : Retrait d'une affectation existante sur événement devenu suspendu/terminé → 200 succès
    // ──────────────────────────────────────────────────────────
    await test('TEST 12: Retrait d\'une affectation existante sur événement devenu suspendu/terminé -> succès 200 (nettoyage administratif)', async () => {
        // Le contrôleur a une affectation résiduelle sur eventSuspenduId et eventTermineId
        // Le partenaire utilise PATCH /assignments pour ne garder que eventValideId
        const req = new NextRequest('http://localhost:3000/api/partner/team/assignments', {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${partnerAToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                controller_id: controllerUserId,
                event_ids: [eventValideId], // retire eventSuspenduId et eventTermineId
            }),
        });
        const res = await updateAssignments(req);
        const data = await res.json();

        assert.equal(res.status, 200, 'Le retrait doit réussir avec HTTP 200');
        assert.equal(data.success, true);

        // Vérifier en base que les événements suspendu et terminé ont bien été retirés
        const { data: remainingAssignments } = await supabase
            .from('event_controllers')
            .select('event_id')
            .eq('user_id', controllerUserId);

        const remainingIds = remainingAssignments?.map(a => a.event_id) || [];
        assert.ok(!remainingIds.includes(eventSuspenduId), 'L\'événement suspendu doit être nettoyé');
        assert.ok(!remainingIds.includes(eventTermineId), 'L\'événement terminé doit être nettoyé');
        assert.ok(remainingIds.includes(eventValideId), 'L\'événement valide est conservé');
    });

    // ──────────────────────────────────────────────────────────
    // ANTI-CONTOURNEMENT : Envois directs de payloads JSON au backend
    // ──────────────────────────────────────────────────────────
    await test('ANTI-CONTOURNEMENT: Requête directe { controllerId, eventId: BROUILLON } -> Rejet 400', async () => {
        const req = new NextRequest('http://localhost:3000/api/partner/team/assignments', {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${partnerAToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                controllerId: controllerUserId,
                eventId: eventBrouillonId,
            }),
        });
        const res = await updateAssignments(req);
        const data = await res.json();

        assert.equal(res.status, 400, 'Rejet 400');
        assert.equal(data.error, INELIGIBLE_EVENT_ASSIGNMENT_ERROR);
    });

    await test('ANTI-CONTOURNEMENT: Requête directe { controllerId, eventId: AUTRE_PARTENAIRE } -> Rejet 403', async () => {
        const req = new NextRequest('http://localhost:3000/api/partner/team/assignments', {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${partnerAToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                controllerId: controllerUserId,
                eventId: eventPartnerBId,
            }),
        });
        const res = await updateAssignments(req);
        const data = await res.json();

        assert.equal(res.status, 403, 'Rejet 403 Forbidden');
        assert.match(data.error, /propriétaire/i);
    });

    await test('ANTI-CONTOURNEMENT: Requête directe { controllerId, eventId: EVENT_CONFIRME } -> Succès 200', async () => {
        const req = new NextRequest('http://localhost:3000/api/partner/team/assignments', {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${partnerAToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                controllerId: controllerUserId,
                eventId: eventPublieId,
            }),
        });
        const res = await updateAssignments(req);
        const data = await res.json();

        assert.equal(res.status, 200, 'Succès 200');
        assert.equal(data.success, true);
    });
});
