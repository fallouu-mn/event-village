/**
 * R8 — Lot 1B.3 : un contrôleur ne lit que les billets des événements auxquels il est affecté
 * (event_controllers) et aucun profil d'autre utilisateur.
 * CONTROLLER_A est affecté à A_PUBLIE seulement ; le seed émet un billet sur A_PUBLIE et un sur B_PUBLIE.
 * (Clé anon + signInWithPassword uniquement.)
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { FIXTURE_TICKETS } from '../helpers/fixture-data';
import { publicEvent, signInFixture } from './helpers';

describe('R8 — lectures du contrôleur', () => {
    test("CONTROLLER_A ne lit pas les billets de l'événement de B", async () => {
        const controller = await signInFixture('CONTROLLER_A');
        const b = await publicEvent('B_PUBLIE');
        const { data, error } = await controller.client.from('tickets').select('id, ticket_number').eq('event_id', b.eventId);
        assert.equal(error, null, `lecture des billets : ${error?.message}`);
        assert.deepEqual(data, [], `billets de B lisibles par le contrôleur de A : ${JSON.stringify(data)}`);
    });

    test('CONTROLLER_A ne lit aucun billet hors de son événement affecté, même sans filtre', async () => {
        const controller = await signInFixture('CONTROLLER_A');
        const a = await publicEvent('A_PUBLIE');
        const { data, error } = await controller.client.from('tickets').select('id, event_id, user_id');
        assert.equal(error, null, `lecture des billets : ${error?.message}`);
        const foreign = (data || []).filter((t) => t.event_id !== a.eventId && t.user_id !== controller.userId);
        assert.deepEqual(foreign, [], `billets hors affectation lisibles : ${foreign.length}`);
    });

    test('CONTROLLER_A lit encore les billets de son événement affecté', async () => {
        const controller = await signInFixture('CONTROLLER_A');
        const a = await publicEvent('A_PUBLIE');
        const { data, error } = await controller.client.from('tickets').select('ticket_number').eq('event_id', a.eventId);
        assert.equal(error, null, `lecture des billets : ${error?.message}`);
        assert.ok(
            (data || []).some((t) => t.ticket_number === FIXTURE_TICKETS.CLIENT_A_STANDARD.ticketNumber),
            'le billet de référence de A_PUBLIE doit rester lisible par le contrôleur affecté'
        );
    });

    test("CONTROLLER_A ne lit aucun profil d'autre utilisateur", async () => {
        const controller = await signInFixture('CONTROLLER_A');
        const { data, error } = await controller.client.from('users').select('id, email');
        assert.equal(error, null, `lecture des profils : ${error?.message}`);
        const others = (data || []).filter((u) => u.id !== controller.userId);
        assert.deepEqual(others.map((u) => u.email), [], 'profils tiers lisibles par un contrôleur');
    });
});
