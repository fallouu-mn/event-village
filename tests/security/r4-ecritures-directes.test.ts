/**
 * Lot 1A.4 (R4, R6, R5 en partie) — aucune écriture directe par l'API REST sur
 * tickets, payments et audit_logs avec un compte gratuit.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { FIXTURE_TICKETS } from '../helpers/fixture-data';
import { assertDenied, publicEvent, signInFixture, uniqueSuffix } from './helpers';

describe('R4 — écritures directes refusées', () => {
    test('CLIENT : insertion d\'un billet VALIDE pour soi-même → refusée', async () => {
        const { client, userId } = await signInFixture('CLIENT');
        const ev = await publicEvent('A_PUBLIE');
        const s = uniqueSuffix();
        const { error } = await client.from('tickets').insert({
            event_id: ev.eventId,
            category_id: ev.categories.VIP.id,
            user_id: userId,
            ticket_number: `TCK-FORGE-${s}`,
            qr_code: `EV-QR-FORGE-${s}`,
            price: 0,
            status: 'VALIDE',
        });
        assertDenied(error, 'INSERT tickets (billet forgé)');
    });

    test('CLIENT : insertion d\'un paiement SUCCESS → refusée', async () => {
        const { client, userId } = await signInFixture('CLIENT');
        const s = uniqueSuffix();
        const { error } = await client.from('payments').insert({
            transaction_id: `TX-FORGE-${s}`,
            client_id: userId,
            payment_target: 'TICKET',
            amount: 15000,
            status: 'SUCCESS',
            is_platform_payment: true,
        });
        assertDenied(error, 'INSERT payments (paiement forgé)');
    });

    test('CLIENT : insertion dans audit_logs → refusée', async () => {
        const { client, userId } = await signInFixture('CLIENT');
        const { error } = await client.from('audit_logs').insert({
            user_id: userId,
            user_role: 'SUPERADMIN',
            action: 'FORGED_ENTRY',
            object_type: 'payments',
        });
        assertDenied(error, 'INSERT audit_logs (entrée forgée)');
    });

    test('CONTROLEUR : modification directe d\'un billet par l\'API → aucune ligne modifiée', async () => {
        const { client } = await signInFixture('CONTROLLER_A');
        const spec = FIXTURE_TICKETS.CLIENT_A_STANDARD;
        const { data: visible, error: readErr } = await client.from('tickets').select('id, status').eq('ticket_number', spec.ticketNumber).maybeSingle();
        assert.equal(readErr, null, `lecture du billet de référence : ${readErr?.message}`);
        assert.ok(visible, 'le billet de référence doit exister (seed de test)');

        const { data: updated, error } = await client.from('tickets').update({ status: visible.status }).eq('id', visible.id).select('id');
        if (error) {
            assertDenied(error, 'UPDATE tickets par un contrôleur');
        } else {
            assert.deepEqual(updated, [], `UPDATE tickets par un contrôleur : ${updated?.length} ligne(s) modifiée(s), attendu 0`);
        }
    });
});
