/**
 * Lot 1A.5 — lectures exposées à anon :
 *  - profils (users) des propriétaires de partenaires validés ;
 *  - hash du PIN régisseur des événements.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { anonClient, assertDenied, publicEvent, signInFixture } from './helpers';

describe('R5 — aucune donnée personnelle ni secret lisible par anon', () => {
    test('anon : aucune ligne de users lisible (propriétaires de partenaires compris)', async () => {
        const { data, error } = await anonClient().from('users').select('id, email, phone, first_name, last_name');
        if (error) {
            assertDenied(error, 'anon SELECT users');
        } else {
            assert.deepEqual(data, [], `anon lit ${data.length} profil(s) : ${data.map((u) => u.email).join(', ')}`);
        }
    });

    test('anon : le hash du PIN régisseur n\'est pas lisible sur events', async () => {
        const ev = await publicEvent('A_PUBLIE');
        const { error } = await anonClient().from('events').select('id, regisseur_pin_hash').eq('id', ev.eventId);
        assertDenied(error, 'anon SELECT events.regisseur_pin_hash');
    });

    test('authenticated (compte CLIENT) : le hash du PIN régisseur n\'est pas lisible', async () => {
        const ev = await publicEvent('A_PUBLIE');
        const { client } = await signInFixture('CLIENT');
        const { error } = await client.from('events').select('id, regisseur_pin_hash').eq('id', ev.eventId);
        assertDenied(error, 'authenticated SELECT events.regisseur_pin_hash');
    });

    test('anon et authenticated : aucune table de PIN régisseur lisible', async () => {
        assertDenied((await anonClient().from('event_regisseur_pins').select('*')).error, 'anon SELECT event_regisseur_pins');
        const { client } = await signInFixture('CLIENT');
        assertDenied((await client.from('event_regisseur_pins').select('*')).error, 'authenticated SELECT event_regisseur_pins');
    });

    test('régression : la lecture publique des événements publiés fonctionne toujours', async () => {
        const ev = await publicEvent('A_PUBLIE');
        assert.ok(ev.eventId);
        assert.ok(ev.categories.Standard, 'catégorie Standard visible publiquement');
    });
});
