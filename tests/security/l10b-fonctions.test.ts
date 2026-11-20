/**
 * Lot 10b — chaque fonction nouvelle du lot (salles : renvoi en validation, recherche, calendrier, aperçu
 * d'annulation, recettes, avis aux administrateurs), appelée directement par la REST, est refusée à anon et à un
 * compte connecté (privilège EXECUTE, 42501) : seules les routes serveur (rôle de service) les appellent, après avoir
 * vérifié la session, le droit, la propriété et l'état. Clé anon et comptes de test uniquement.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { anonClient, signInFixture, ZERO_UUID } from './helpers';

const LOT10B_RPCS: Array<[string, Record<string, unknown>]> = [
    ['hall_submit', { p: { actor_id: ZERO_UUID, hall_id: ZERO_UUID } }],
    ['hall_search', { p: {} }],
    ['hall_calendar', { p: { hall_id: ZERO_UUID } }],
    ['hall_cancel_preview', { p: { reservation_id: ZERO_UUID, client_id: ZERO_UUID } }],
    ['hall_partner_earnings', { p_actor: ZERO_UUID }],
    ['halls_notify_admins', {}],
];

describe('Lot 10b : chaque fonction du lot existe et reste réservée au rôle de service (42501)', () => {
    for (const [fn, args] of LOT10B_RPCS) {
        test(`anon et authenticated (compte CLIENT) : rpc(${fn}) refusée`, async () => {
            const anon = await anonClient().rpc(fn, args);
            assert.ok(anon.error, `anon rpc(${fn}) : appel accepté, la fonction doit être réservée au rôle de service`);
            // Fonction de déclencheur (halls_notify_admins) : PostgREST ne l'expose pas (PGRST202) ; les autres : 42501
            const denied = (code: string | undefined, message: string | undefined) =>
                code === '42501' || /permission denied/i.test(message ?? '') || (fn === 'halls_notify_admins' && code === 'PGRST202');
            assert.ok(denied(anon.error.code, anon.error.message), `anon rpc(${fn}) : ${anon.error.code} ${anon.error.message}`);
            const { client } = await signInFixture('CLIENT_BIS');
            const auth = await client.rpc(fn, args);
            assert.ok(auth.error, `authenticated rpc(${fn}) : appel accepté`);
            assert.ok(denied(auth.error.code, auth.error.message), `authenticated rpc(${fn}) : ${auth.error.code} ${auth.error.message}`);
        });
    }
});
