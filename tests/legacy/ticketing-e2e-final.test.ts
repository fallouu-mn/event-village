import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { getServiceRoleClient } from '../../lib/supabase/server';
import { POST as claimFreeRoute } from '../../app/api/tickets/claim-free/route';
import { PATCH as updatePartnerCategoryRoute } from '../../app/api/partner/events/[id]/categories/[categoryId]/route';
import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

// [lot 0] Chargement de .env.local supprimé : l'environnement de test (.env.test, instance Supabase locale)
// et le garde-fou anti-base réelle sont fournis par tests/helpers/env.ts.
import '../helpers/env';

describe('BILLETTERIE EVENT VILLAGE — AUDIT E2E & BLINDAGE FINAL (20 POINTS CDC V3.0)', () => {
    const supabase = getServiceRoleClient();
    const publicAuth = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

    const partnerUserId = 'e706a7a2-502c-4396-9e91-4dc6720388f7';
    const partnerId = 'a917b7ac-d542-4c2b-b5d8-ab38f866b2e7';
    const buyerAUserId = 'a7345050-03cf-4967-9281-9ee5eb75615a';
    const ctrlUserId = 'fe9318ac-1f65-4e80-980f-f00626f1a003';
    const otherPartnerUserId = '775818bd-1833-4e99-843d-3f5ecf8196e3';

    let partnerToken: string;
    let otherPartnerToken: string;
    let buyerAToken: string;
    let ctrlToken: string;

    let mainEventId: string;
    const createdEventIds: string[] = [];
    const ts = Date.now();

    before(async () => {
        console.log('[SETUP] Préparation du banc d\'audit final E2E...');
        const start = Date.now();

        // 1. Partenaire A
        const { data: pAuthUser } = await supabase.auth.admin.getUserById(partnerUserId);
        const pEmail = pAuthUser?.user?.email || 'fallouu.dev@gmail.com';
        await supabase.from('users').update({ status: 'ACTIF', role: 'PARTENAIRE', phone: '221770006743' }).eq('id', partnerUserId);
        await supabase.from('user_roles').delete().eq('user_id', partnerUserId);
        await supabase.from('user_roles').insert({ user_id: partnerUserId, role: 'PARTENAIRE' });
        await supabase.auth.admin.updateUserById(partnerUserId, { password: process.env.LEGACY_TEST_PASSWORD!, email_confirm: true, user_metadata: { role: 'PARTENAIRE' } });
        const { data: pAuth } = await publicAuth.auth.signInWithPassword({
            email: pEmail,
            password: process.env.LEGACY_TEST_PASSWORD!,
        });
        partnerToken = pAuth?.session?.access_token || '';
        assert.ok(partnerToken, 'partnerToken obtenu');

        // 2. Partenaire B
        const { data: opAuthUser } = await supabase.auth.admin.getUserById(otherPartnerUserId);
        const opEmail = opAuthUser?.user?.email || 'other.partner@eventvillage.sn';
        await supabase.from('users').update({ status: 'ACTIF', role: 'PARTENAIRE', phone: '221770006744' }).eq('id', otherPartnerUserId);
        await supabase.from('user_roles').delete().eq('user_id', otherPartnerUserId);
        await supabase.from('user_roles').insert({ user_id: otherPartnerUserId, role: 'PARTENAIRE' });
        await supabase.auth.admin.updateUserById(otherPartnerUserId, { password: process.env.LEGACY_TEST_PASSWORD!, email_confirm: true, user_metadata: { role: 'PARTENAIRE' } });
        const { data: opAuth } = await publicAuth.auth.signInWithPassword({
            email: opEmail,
            password: process.env.LEGACY_TEST_PASSWORD!,
        });
        otherPartnerToken = opAuth?.session?.access_token || '';
        assert.ok(otherPartnerToken, 'otherPartnerToken obtenu');

        // 3. Acheteur A
        const { data: bAuthUser } = await supabase.auth.admin.getUserById(buyerAUserId);
        const bEmail = bAuthUser?.user?.email || 'clientA@test.com';
        await supabase.from('users').update({ status: 'ACTIF', role: 'CLIENT', phone: '221771234567' }).eq('id', buyerAUserId);
        await supabase.from('user_roles').delete().eq('user_id', buyerAUserId);
        await supabase.from('user_roles').insert({ user_id: buyerAUserId, role: 'CLIENT' });
        await supabase.auth.admin.updateUserById(buyerAUserId, { password: process.env.LEGACY_TEST_PASSWORD!, email_confirm: true, user_metadata: { role: 'CLIENT' } });
        const { data: bAAuth } = await publicAuth.auth.signInWithPassword({
            email: bEmail,
            password: process.env.LEGACY_TEST_PASSWORD!,
        });
        buyerAToken = bAAuth?.session?.access_token || '';
        assert.ok(buyerAToken, 'buyerAToken obtenu');

        // 4. Contrôleur
        const { data: cAuthUser } = await supabase.auth.admin.getUserById(ctrlUserId);
        const cEmail = cAuthUser?.user?.email || 'clientB@test.com';
        await supabase.from('users').update({ status: 'ACTIF', role: 'CONTROLEUR', phone: '221772223344' }).eq('id', ctrlUserId);
        await supabase.from('user_roles').delete().eq('user_id', ctrlUserId);
        await supabase.from('user_roles').insert({ user_id: ctrlUserId, role: 'CONTROLEUR' });
        await supabase.auth.admin.updateUserById(ctrlUserId, { password: process.env.LEGACY_TEST_PASSWORD!, email_confirm: true, user_metadata: { role: 'CONTROLEUR' } });
        const { data: cAuth } = await publicAuth.auth.signInWithPassword({
            email: cEmail,
            password: process.env.LEGACY_TEST_PASSWORD!,
        });
        ctrlToken = cAuth?.session?.access_token || '';
        assert.ok(ctrlToken, 'ctrlToken obtenu');

        // 5. Événement principal
        const { data: mainEv } = await supabase.from('events').insert({
            partner_id: partnerId,
            title: `Festival Dakar E2E Final ${ts}`,
            slug: `festival-dakar-e2e-${ts}`,
            category: 'CONCERT',
            description: 'Grand Festival Dakar Test Final',
            start_date: '2026-11-20',
            start_time: '20:00:00',
            location: 'Esplanade Monument de la Renaissance',
            city: 'Dakar',
            capacity: 500,
            status: 'PUBLIE',
        }).select('id').single();
        mainEventId = mainEv!.id;
        createdEventIds.push(mainEventId);

        // Affecter le contrôleur à l'événement
        await supabase.from('event_controllers').insert({
            event_id: mainEventId,
            user_id: ctrlUserId,
            created_by: partnerUserId,
            can_accept_cash: true,
        });

        console.log(`[SETUP OK] Initialisé en ${Date.now() - start}ms | Event: ${mainEventId}`);
    });

    after(async () => {
        console.log('[TEARDOWN] Nettoyage des données de test...');
        for (const evId of createdEventIds) {
            await supabase.from('tickets').delete().eq('event_id', evId);
            await supabase.from('ticket_categories').delete().eq('event_id', evId);
            await supabase.from('event_controllers').delete().eq('event_id', evId);
            await supabase.from('events').delete().eq('id', evId);
        }
        console.log('[TEARDOWN OK] Banc d\'essai final nettoyé.');
    });

    // =========================================================================
    // SECTION 1 : CYCLE DE VIE DES CATÉGORIES & CLAIMS GRATUITS
    // =========================================================================

    test('1.1 : Achat de billets gratuits (N=2) -> 2 tickets créés, stock décrémenté, catégorie SOLD_OUT', async () => {
        const start = Date.now();
        const { data: freeCat } = await supabase.from('ticket_categories').insert({
            event_id: mainEventId,
            name: 'Pass Invitation Presse',
            price: 0,
            total_quantity: 2,
            sold_quantity: 0,
            is_active: true,
            is_visible: true,
        }).select('*').single();

        const req = new NextRequest('http://localhost/api/tickets/claim-free', {
            method: 'POST',
            body: JSON.stringify({ categoryId: freeCat.id, quantity: 2 }),
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${buyerAToken}`
            }
        });

        const res = await claimFreeRoute(req);
        const json = await res.json();
        assert.ok(res.status === 200 || res.status === 201, `Status attendu 200 ou 201 (reçu ${res.status})`);
        assert.equal(json.success, true);
        assert.equal(json.tickets.length, 2, '2 tickets distincts générés');

        // Vérification de l'état SOLD_OUT de la catégorie
        const { data: updatedCat } = await supabase.from('ticket_categories').select('*').eq('id', freeCat.id).single();
        assert.equal(updatedCat.sold_quantity, 2);
        assert.equal(updatedCat.total_quantity, 2);
        console.log(`  ✓ 1.1 Validé (${Date.now() - start}ms)`);
    });

    test('1.2 : Tentative de claim gratuit après SOLD_OUT -> Rejet serveur immédiat', async () => {
        const start = Date.now();
        const { data: soldCat } = await supabase.from('ticket_categories').insert({
            event_id: mainEventId,
            name: 'Pass Gratuit Épuisé',
            price: 0,
            total_quantity: 1,
            sold_quantity: 1,
            is_active: true,
            is_visible: true,
        }).select('*').single();

        const req = new NextRequest('http://localhost/api/tickets/claim-free', {
            method: 'POST',
            body: JSON.stringify({ categoryId: soldCat.id, quantity: 1 }),
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${buyerAToken}`
            }
        });

        const res = await claimFreeRoute(req);
        const json = await res.json();
        assert.equal(res.status, 400);
        assert.equal(json.code, 'TICKET_CATEGORY_SOLD_OUT');
        console.log(`  ✓ 1.2 Validé (${Date.now() - start}ms)`);
    });

    // [lot 2 — cas supprimé] 2.1 Catégorie fermée (is_active = false) -> CLOSED et refus d'achat : le refus d'achat reposait sur EventService.reserveTicketsAtomic, supprimé (réservation par la RPC checkout_create_payment) ; couvert par tests/parcours/paiement-controles.test.ts
    // [lot 2 — cas supprimé] 3.1 Achat de N=3 billets distincts : émission par EventService.reserveTicketsAtomic, supprimé (émission par la RPC payment_confirm) ; couvert par tests/parcours/paiement-confirmation.test.ts
    // [lot 2 — cas supprimé] 3.2 Compostage du billet 1 seul : opérait sur les billets émis par le cas 3.1 (reserveTicketsAtomic, supprimé) ; hors périmètre paiement, couvert par tests/legacy/client-ticket-lifecycle.test.ts (tests 10 et 12, conservés) et tests/legacy/controller-complete-workflow.test.ts
    // [lot 2 — cas supprimé] 3.3 Double scan -> ALREADY_USED : opérait sur les billets émis par le cas 3.1 (reserveTicketsAtomic, supprimé) ; hors périmètre paiement, couvert par tests/legacy/client-ticket-lifecycle.test.ts (test 11, conservé) et tests/legacy/controller-complete-workflow.test.ts (cas 4)
    // [lot 2 — cas supprimé] 4.1 Concurrence (100 requêtes pour 1 billet) : reposait sur EventService.reserveTicketsAtomic, supprimé (réservation atomique par la RPC checkout_create_payment) ; couvert par tests/parcours/paiement-reservation.test.ts
    // [lot 2 — cas supprimé] 5.1 Notification EVENT_FULLY_SOLD_OUT : déclenchée par EventService.reserveTicketsAtomic, supprimé ; non couvert : plus aucun appel à sendEventFullySoldOutNotification dans lib/ ni app/ depuis le lot 2 (écart à trancher)

    // =========================================================================
    // SECTION 6 : RÉAPPROVISIONNEMENT ET SÉCURITÉ D'ACCÈS PARTENAIRE
    // =========================================================================

    test('6.1 : Réapprovisionnement par l\'organisateur (+10 billets) -> Statut repasse à ACTIVE', async () => {
        const start = Date.now();
        const { data: restockCat } = await supabase.from('ticket_categories').insert({
            event_id: mainEventId,
            name: 'Pass Réapprovisionnement',
            price: 15000,
            total_quantity: 5,
            sold_quantity: 5, // SOLD_OUT
            is_active: true,
            is_visible: true,
        }).select('*').single();

        const patchReq = new NextRequest(`http://localhost/api/partner/events/${mainEventId}/categories/${restockCat.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ total_quantity: 15 }),
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${partnerToken}`
            }
        });

        const patchRes = await updatePartnerCategoryRoute(patchReq, {
            params: Promise.resolve({ id: mainEventId, categoryId: restockCat.id })
        });
        const patchJson = await patchRes.json();
        assert.equal(patchRes.status, 200);
        assert.equal(patchJson.category.total_quantity, 15);
        assert.equal(patchJson.category.sold_quantity, 5);
        assert.equal(patchJson.category.is_active, true);

        console.log(`  ✓ 6.1 Validé (${Date.now() - start}ms)`);
    });

    test('6.2 : Tentative de modification par un partenaire tiers non propriétaire -> 400/403 / Rejet', async () => {
        const start = Date.now();
        const { data: targetCat } = await supabase.from('ticket_categories').insert({
            event_id: mainEventId,
            name: 'Pass Sécurisé Propriétaire',
            price: 20000,
            total_quantity: 10,
            sold_quantity: 0,
            is_active: true,
            is_visible: true,
        }).select('*').single();

        const hackReq = new NextRequest(`http://localhost/api/partner/events/${mainEventId}/categories/${targetCat.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ total_quantity: 50 }),
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${otherPartnerToken}`
            }
        });

        const hackRes = await updatePartnerCategoryRoute(hackReq, {
            params: Promise.resolve({ id: mainEventId, categoryId: targetCat.id })
        });
        const hackJson = await hackRes.json();
        assert.equal(hackJson.success, false);
        assert.match(hackJson.error, /propriétaire|non autorisé|introuvable/i);
        console.log(`  ✓ 6.2 Validé (${Date.now() - start}ms)`);
    });

    // [lot 2 — cas supprimé] 7.1 Quantités invalides (<= 0, < 0, > 50) : rejet testé sur EventService.reserveTicketsAtomic, supprimé (quantité bornée par le schéma du checkout, lib/payments/checkout.service.ts) ; couvert par tests/parcours/paiement-controles.test.ts (max_per_order)
});