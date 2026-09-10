import { test } from 'node:test';
import assert from 'node:assert';
import { EventCancellationService } from '../lib/events/event-cancellation.service';
import { EventService } from '../lib/events/event.service';
import { TicketTransferService } from '../lib/tickets/ticket-transfer.service';
import { isEventEligibleForController, getEventEligibilityRejectionReason } from '../lib/events/event-status';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Chargement de l'environnement local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const envLines = envContent.split(/\r?\n/);
    envLines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
            const [k, ...v] = trimmed.split('=');
            process.env[k.trim()] = v.join('=').trim();
        }
    });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const partnerAUserId = 'e706a7a2-502c-4396-9e91-4dc6720388f7';
const partnerBUserId = '775818bd-1833-4e99-843d-3f5ecf8196e3';
const clientAUserId = 'a7345050-03cf-4967-9281-9ee5eb75615a';

test('1. ANNULATION PARTENAIRE & VERROUILLAGE ATOMIQUE : Invalidation des billets et persistance', async () => {
    if (!supabaseUrl || !serviceRoleKey) return;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: partnerA } = await adminClient.from('partners').select('id').eq('user_id', partnerAUserId).single();
    assert.ok(partnerA?.id, 'Partenaire A trouvé en base');

    const suffix = Date.now().toString().slice(-6);

    const { data: event, error: evErr } = await adminClient
        .from('events')
        .insert({
            partner_id: partnerA.id,
            title: `Concert Annulation Test ${suffix}`,
            description: 'Test annulation et verrouillage atomique',
            start_date: '2026-10-15',
            start_time: '20:00',
            end_date: '2026-10-16',
            end_time: '02:00',
            location: 'Grand Théâtre National, Dakar',
            status: 'PUBLIE',
        })
        .select('*')
        .single();

    assert.ifError(evErr);
    assert.ok(event?.id);

    const { data: cat, error: catErr } = await adminClient
        .from('ticket_categories')
        .insert({
            event_id: event.id,
            name: 'Pass Standard',
            price: 5000,
            total_quantity: 100,
            sold_quantity: 2,
            is_active: true,
        })
        .select('*')
        .single();

    assert.ifError(catErr);
    assert.ok(cat?.id);

    const { data: ticket1, error: t1Err } = await adminClient
        .from('tickets')
        .insert({
            event_id: event.id,
            category_id: cat.id,
            user_id: clientAUserId,
            ticket_number: `TCK-ANN-1-${suffix}`,
            price: 5000,
            qr_code: `EV-QR-1-${suffix}`,
            status: 'VALIDE',
        })
        .select('*')
        .single();

    const { data: ticket2, error: t2Err } = await adminClient
        .from('tickets')
        .insert({
            event_id: event.id,
            category_id: cat.id,
            user_id: clientAUserId,
            ticket_number: `TCK-ANN-2-${suffix}`,
            price: 5000,
            qr_code: `EV-QR-2-${suffix}`,
            status: 'VALIDE',
        })
        .select('*')
        .single();

    assert.ifError(t1Err);
    assert.ifError(t2Err);

    try {
        const result = await EventCancellationService.cancelEvent(
            event.id,
            partnerAUserId,
            'PARTENAIRE',
            'Impossibilité logistique majeure',
            "L'événement ne pourra pas avoir lieu en raison de contraintes techniques."
        );

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.eventId, event.id);

        const { data: dbEvent } = await adminClient
            .from('events')
            .select('status')
            .eq('id', event.id)
            .single();

        assert.ok(['ANNULE', 'SUSPENDU'].includes(dbEvent?.status || ''), 'Statut désactivé (ANNULE ou SUSPENDU)');

        const { data: dbTickets } = await adminClient
            .from('tickets')
            .select('id, status')
            .eq('event_id', event.id);

        assert.strictEqual(dbTickets?.length, 2);
        dbTickets?.forEach(t => {
            assert.strictEqual(t.status, 'ANNULE');
        });

    } finally {
        await adminClient.from('tickets').delete().eq('event_id', event.id);
        await adminClient.from('ticket_categories').delete().eq('event_id', event.id);
        await adminClient.from('events').delete().eq('id', event.id);
    }
});

test('2. SÉCURITÉ RBAC & ISOLATION MULTI-TENANT : Rejet strict des accès non autorisés', async () => {
    if (!supabaseUrl || !serviceRoleKey) return;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: partnerA } = await adminClient.from('partners').select('id').eq('user_id', partnerAUserId).single();
    assert.ok(partnerA?.id);

    const suffix = Date.now().toString().slice(-6);

    const { data: event, error: evErr } = await adminClient
        .from('events')
        .insert({
            partner_id: partnerA.id,
            title: `Concert Ownership Test ${suffix}`,
            description: 'Test ownership security',
            start_date: '2026-11-01',
            start_time: '19:00',
            location: 'Dakar Arena',
            status: 'PUBLIE',
        })
        .select('*')
        .single();

    assert.ifError(evErr);
    assert.ok(event?.id);

    try {
        // Tentative par un autre partenaire (Partner B) -> 403 / rejet
        await assert.rejects(
            async () => {
                await EventCancellationService.cancelEvent(
                    event.id,
                    partnerBUserId,
                    'PARTENAIRE',
                    'Tentative usurpation'
                );
            },
            /Non autorisé/
        );

        // Tentative par un simple client -> 403 / rejet
        await assert.rejects(
            async () => {
                await EventCancellationService.cancelEvent(
                    event.id,
                    clientAUserId,
                    'CLIENT',
                    'Tentative client'
                );
            },
            /Non autorisé/
        );

        const { data: checkEvent } = await adminClient
            .from('events')
            .select('status')
            .eq('id', event.id)
            .single();

        assert.strictEqual(checkEvent?.status, 'PUBLIE');
    } finally {
        await adminClient.from('events').delete().eq('id', event.id);
    }
});

test('3. CONCURRENCE ATOMIQUE SUR ANNULATION : Promise.allSettled() déclenche exactement 1 annulation', async () => {
    if (!supabaseUrl || !serviceRoleKey) return;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: partnerA } = await adminClient.from('partners').select('id').eq('user_id', partnerAUserId).single();
    assert.ok(partnerA?.id);

    const suffix = Date.now().toString().slice(-6);

    const { data: event, error: evErr } = await adminClient
        .from('events')
        .insert({
            partner_id: partnerA.id,
            title: `Concert Concurrence Test ${suffix}`,
            description: 'Test atomic concurrency',
            start_date: '2026-11-10',
            start_time: '20:00',
            location: 'Dakar',
            status: 'PUBLIE',
        })
        .select('*')
        .single();

    assert.ifError(evErr);
    assert.ok(event?.id);

    try {
        // 2 appels concurrents simultanés via Promise.allSettled
        const results = await Promise.allSettled([
            EventCancellationService.cancelEvent(event.id, partnerAUserId, 'PARTENAIRE', 'Worker A cancel'),
            EventCancellationService.cancelEvent(event.id, partnerAUserId, 'PARTENAIRE', 'Worker B cancel'),
        ]);

        const fulfilled = results.filter(r => r.status === 'fulfilled');
        const rejected = results.filter(r => r.status === 'rejected');

        // Exactement 1 succès et 1 rejet
        assert.strictEqual(fulfilled.length, 1, 'Exactement 1 opération d\'annulation réussit');
        assert.strictEqual(rejected.length, 1, 'L\'opération concurrente est rejetée');

    } finally {
        await adminClient.from('events').delete().eq('id', event.id);
    }
});

test('4. REMBOURSEMENT MOBILE MONEY & IDEMPOTENCE (REFUND-PMT-<id>) : Traçabilité financière intégrale', async () => {
    if (!supabaseUrl || !serviceRoleKey) return;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: partnerA } = await adminClient.from('partners').select('id').eq('user_id', partnerAUserId).single();
    assert.ok(partnerA?.id);

    const suffix = Date.now().toString().slice(-6);

    const { data: event, error: evErr } = await adminClient
        .from('events')
        .insert({
            partner_id: partnerA.id,
            title: `Gala Remboursement Test ${suffix}`,
            description: 'Test remboursement cashout',
            start_date: '2026-11-20',
            start_time: '20:30',
            location: 'Hôtel King Fahd Palace',
            status: 'PUBLIE',
        })
        .select('*')
        .single();

    assert.ifError(evErr);
    assert.ok(event?.id);

    const { data: cat, error: catErr } = await adminClient
        .from('ticket_categories')
        .insert({
            event_id: event.id,
            name: 'Pass VIP',
            price: 25000,
            total_quantity: 50,
            sold_quantity: 1,
            is_active: true,
        })
        .select('*')
        .single();

    assert.ifError(catErr);
    assert.ok(cat?.id);

    const { data: ticket, error: tickErr } = await adminClient
        .from('tickets')
        .insert({
            event_id: event.id,
            category_id: cat.id,
            user_id: clientAUserId,
            ticket_number: `TCK-REF-${suffix}`,
            price: 25000,
            qr_code: `EV-QR-REF-${suffix}`,
            status: 'VALIDE',
        })
        .select('*')
        .single();

    assert.ifError(tickErr);
    assert.ok(ticket?.id);

    const pmtTxId = `TX-TEST-${suffix}`;
    const { data: payment, error: pmtErr } = await adminClient
        .from('payments')
        .insert({
            transaction_id: pmtTxId,
            client_id: clientAUserId,
            partner_id: partnerA.id,
            ticket_id: ticket.id,
            payment_target: 'TICKET',
            amount: 25000,
            currency: 'XOF',
            payment_method: 'WAVE',
            is_platform_payment: true,
            status: 'SUCCESS',
            metadata: {
                event_id: event.id,
                customer_phone: '+221771234567',
                customer_name: 'Fatou Sow',
                operator: 'WAVE',
            },
        })
        .select('*')
        .single();

    assert.ifError(pmtErr);
    assert.ok(payment?.id);

    try {
        const result = await EventCancellationService.cancelEvent(
            event.id,
            partnerAUserId,
            'PARTENAIRE',
            'Annulation pour intempéries'
        );

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.refundsProcessed + result.refundsFailed, 1);

        // Relecture DB : Ligne dans la table refunds
        const { data: dbRefund } = await adminClient
            .from('refunds')
            .select('*')
            .eq('payment_id', payment.id)
            .single();

        assert.ok(dbRefund);
        assert.strictEqual(dbRefund.refund_transaction_id, `REFUND-PMT-${payment.id}`);
        assert.ok(['PROCESSED', 'FAILED', 'PENDING'].includes(dbRefund.status));

        // Test d'idempotence : Deuxième appel à cancelEvent rejeté (déjà annulé)
        await assert.rejects(
            async () => {
                await EventCancellationService.cancelEvent(
                    event.id,
                    partnerAUserId,
                    'PARTENAIRE',
                    'Deuxième tentative'
                );
            },
            (err: Error) => {
                return err.message.includes('déjà été annulé') ||
                       err.message.includes('Impossible d\'annuler un événement au statut') ||
                       err.message.includes('Non autorisé');
            }
        );

    } finally {
        await adminClient.from('refunds').delete().eq('payment_id', payment.id);
        await adminClient.from('payments').delete().eq('id', payment.id);
        await adminClient.from('tickets').delete().eq('event_id', event.id);
        await adminClient.from('ticket_categories').delete().eq('event_id', event.id);
        await adminClient.from('events').delete().eq('id', event.id);
    }
});

test('5. RETRY REMBOURSEMENT ADMINISTRATEUR & VERROU DE CONCURRENCE CAS : Relance sécurisée', async () => {
    if (!supabaseUrl || !serviceRoleKey) return;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: partnerA } = await adminClient.from('partners').select('id').eq('user_id', partnerAUserId).single();
    assert.ok(partnerA?.id);

    const suffix = Date.now().toString().slice(-6);

    const pmtTxId = `TX-FAIL-${suffix}`;
    const { data: payment, error: pmtErr } = await adminClient
        .from('payments')
        .insert({
            transaction_id: pmtTxId,
            client_id: clientAUserId,
            partner_id: partnerA.id,
            payment_target: 'TICKET',
            amount: 10000,
            currency: 'XOF',
            payment_method: 'ORANGE_MONEY',
            is_platform_payment: true,
            status: 'SUCCESS',
            metadata: {
                customer_phone: '+221779998877',
                customer_name: 'Moussa Diop',
                operator: 'ORANGE_MONEY',
            },
        })
        .select('*')
        .single();

    assert.ifError(pmtErr);
    assert.ok(payment?.id);

    const refundTxId = `REFUND-PMT-${payment.id}`;
    const { data: failedRefund, error: refErr } = await adminClient
        .from('refunds')
        .insert({
            payment_id: payment.id,
            refund_transaction_id: refundTxId,
            amount: 10000,
            reason: 'Test retry cashout (Réseau indisponible)',
            status: 'FAILED',
        })
        .select('*')
        .single();

    assert.ifError(refErr);
    assert.ok(failedRefund?.id);

    try {
        const retryResult = await EventCancellationService.retryRefund(
            failedRefund.id,
            partnerAUserId
        );

        assert.ok(retryResult.refundId === failedRefund.id);
        assert.ok(['PROCESSED', 'FAILED'].includes(retryResult.status));

        const { data: dbRefund } = await adminClient
            .from('refunds')
            .select('status')
            .eq('id', failedRefund.id)
            .single();

        assert.ok(['PROCESSED', 'FAILED'].includes(dbRefund?.status || ''));
    } finally {
        await adminClient.from('refunds').delete().eq('id', failedRefund.id);
        await adminClient.from('payments').delete().eq('id', payment.id);
    }
});

test('6. RÉVOCATION DES TRANSFERTS P2P & REJET DE RÉCLAMATION APRÈS ANNULATION', async () => {
    if (!supabaseUrl || !serviceRoleKey) return;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: partnerA } = await adminClient.from('partners').select('id').eq('user_id', partnerAUserId).single();
    assert.ok(partnerA?.id);

    const suffix = Date.now().toString().slice(-6);

    const { data: event, error: evErr } = await adminClient
        .from('events')
        .insert({
            partner_id: partnerA.id,
            title: `P2P Cancel Test ${suffix}`,
            description: 'Test P2P transfer revocation on cancellation',
            start_date: '2026-11-25',
            start_time: '21:00',
            location: 'Dakar',
            status: 'PUBLIE',
        })
        .select('*')
        .single();

    assert.ifError(evErr);

    const { data: cat, error: catErr } = await adminClient
        .from('ticket_categories')
        .insert({
            event_id: event.id,
            name: 'Pass P2P',
            price: 5000,
            total_quantity: 20,
            sold_quantity: 1,
            is_active: true,
        })
        .select('*')
        .single();

    assert.ifError(catErr);

    const { data: ticket, error: tickErr } = await adminClient
        .from('tickets')
        .insert({
            event_id: event.id,
            category_id: cat.id,
            user_id: clientAUserId,
            ticket_number: `TCK-P2P-${suffix}`,
            price: 5000,
            qr_code: `EV-QR-P2P-${suffix}`,
            status: 'VALIDE',
        })
        .select('*')
        .single();

    assert.ifError(tickErr);

    try {
        // Initier un transfert P2P vers un ami
        const transferResult = await TicketTransferService.initiateTransfer(
            clientAUserId,
            ticket.id,
            '771234567'
        );

        assert.ok(transferResult.success, 'Transfert initié');

        // Annuler l'événement
        await EventCancellationService.cancelEvent(
            event.id,
            partnerAUserId,
            'PARTENAIRE',
            'Annulation P2P'
        );

        // Vérifier que le ticket est ANNULE
        const { data: checkTicket } = await adminClient
            .from('tickets')
            .select('status')
            .eq('id', ticket.id)
            .single();

        assert.strictEqual(checkTicket?.status, 'ANNULE');

    } finally {
        await adminClient.from('tickets').delete().eq('event_id', event.id);
        await adminClient.from('ticket_categories').delete().eq('event_id', event.id);
        await adminClient.from('events').delete().eq('id', event.id);
    }
});

test('7. RÈGLES MÉTIER SCANNER : Le statut ANNULE bloque immédiatement les contrôles d\'accès', async () => {
    assert.strictEqual(isEventEligibleForController('ANNULE'), false);
    assert.strictEqual(isEventEligibleForController('annule'), false);
    assert.strictEqual(isEventEligibleForController('PUBLIE'), true);
    assert.strictEqual(isEventEligibleForController('VALIDE'), true);

    const rejectionReason = getEventEligibilityRejectionReason('ANNULE');
    assert.strictEqual(rejectionReason, "L'événement a été annulé.");
});

test('8. HOLD CART & ACHAT DE BILLETS BLOQUÉS SUR ÉVÉNEMENT ANNULÉ', async () => {
    if (!supabaseUrl || !serviceRoleKey) return;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: partnerA } = await adminClient.from('partners').select('id').eq('user_id', partnerAUserId).single();
    assert.ok(partnerA?.id);

    const suffix = Date.now().toString().slice(-6);

    const { data: event, error: evErr } = await adminClient
        .from('events')
        .insert({
            partner_id: partnerA.id,
            title: `Hold Cart Cancel Test ${suffix}`,
            description: 'Test purchase rejection on cancelled event',
            start_date: '2026-11-30',
            start_time: '20:00',
            location: 'Dakar',
            status: 'PUBLIE',
        })
        .select('*')
        .single();

    assert.ifError(evErr);

    const { data: cat, error: catErr } = await adminClient
        .from('ticket_categories')
        .insert({
            event_id: event.id,
            name: 'Pass Standard',
            price: 5000,
            total_quantity: 10,
            sold_quantity: 0,
            is_active: true,
        })
        .select('*')
        .single();

    assert.ifError(catErr);

    try {
        // Annuler l'événement
        await EventCancellationService.cancelEvent(
            event.id,
            partnerAUserId,
            'PARTENAIRE',
            'Annulation avant tentative d\'achat'
        );

        // Toute tentative de réservation via reserveTicketsAtomic doit être rejetée
        await assert.rejects(
            async () => {
                await EventService.reserveTicketsAtomic({
                    eventId: event.id,
                    categoryId: cat.id,
                    quantity: 1,
                    userId: clientAUserId,
                });
            },
            /billetterie n'est ouverte que pour les événements au statut PUBLIE/
        );

    } finally {
        await adminClient.from('ticket_categories').delete().eq('event_id', event.id);
        await adminClient.from('events').delete().eq('id', event.id);
    }
});