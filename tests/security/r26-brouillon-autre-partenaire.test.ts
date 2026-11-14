/**
 * R26 — Lot 8, tâche 8.2 v : un partenaire connecté ne lit pas en direct le brouillon d'un autre partenaire. Cas T3
 * de tests/legacy/cdc-v3-validation-checks.test.ts (tableau 12.1, ligne 3) : aucun test de tests/security ne visait
 * cette lecture (la politique events_read_public, 20261102000003_lot5_cycle.sql:1111-1117, la réserve au
 * propriétaire et aux administrateurs). T5 du legacy (moratoires) est noté pour le lot salles.
 *  1. partenaire A (clé anon, connexion par mot de passe) : 0 ligne du brouillon de B, sans erreur ;
 *  2. client anonyme (clé anon seule) : 0 ligne ;
 *  3. mêmes lectures sur les catégories du brouillon de B : 0 ligne ;
 *  4. témoins : chaque partenaire lit son propre brouillon et ses catégories (sinon 0 ligne ne prouverait rien).
 *
 * Acteurs : clé anon seule. Les comptes et les brouillons sont préparés par le service_role (helpers des parcours),
 * jamais pour l'acteur testé (règle du lot 1A). Annoncée verte dès l'écriture (port) : tout rouge est une faille à
 * traiter (8.3 d). Suite verte à l'écriture : assertTerrainInvariants (Conventions), contrairement à r24 et r25.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { STRONG_PASSWORD } from '../parcours/helpers';
import { newPartner, type TestPartner } from '../parcours/finance-helpers';
import { createDraftEvent, type DraftEvent } from '../parcours/cycle-helpers';
import { assertTerrainInvariants } from '../parcours/terrain-helpers';
import { anonClient } from './helpers';
import { gotrueEmail } from '../helpers/gotrue-email';

let partnerA: TestPartner;
let partnerB: TestPartner;
let draftA: DraftEvent;
let draftB: DraftEvent;
let clientA: SupabaseClient;
let clientB: SupabaseClient;

async function connected(partner: TestPartner): Promise<SupabaseClient> {
    const client = anonClient();
    const { error } = await client.auth.signInWithPassword({ email: await gotrueEmail(partner.email), password: STRONG_PASSWORD });
    assert.equal(error, null, `connexion du partenaire : ${error?.message}`);
    return client;
}

async function readEvent(client: SupabaseClient, eventId: string): Promise<string[]> {
    const { data, error } = await client.from('events').select('id').eq('id', eventId);
    assert.equal(error, null, `lecture de l’événement : ${error?.message}`);
    return (data ?? []).map((e) => String(e.id));
}

async function readCategories(client: SupabaseClient, eventId: string): Promise<string[]> {
    const { data, error } = await client.from('ticket_categories').select('id').eq('event_id', eventId);
    assert.equal(error, null, `lecture des catégories : ${error?.message}`);
    return (data ?? []).map((c) => String(c.id));
}

before(async () => {
    partnerA = await newPartner('r26-a');
    partnerB = await newPartner('r26-b');
    draftA = await createDraftEvent(partnerA, 'r26-a', [{ name: 'Standard', price: 5000, total: 10 }], { startsInHours: 72 });
    draftB = await createDraftEvent(partnerB, 'r26-b', [{ name: 'Standard', price: 5000, total: 10 }], { startsInHours: 72 });
    clientA = await connected(partnerA);
    clientB = await connected(partnerB);
});

after(async () => {
    await assertTerrainInvariants('r26-brouillon-autre-partenaire');
});

describe('R26 — brouillon d’un autre partenaire illisible en direct (cas T3 porté)', () => {
    test('témoins : chaque partenaire lit son brouillon et ses catégories', async () => {
        assert.deepEqual(await readEvent(clientA, draftA.eventId), [draftA.eventId], 'A lit son brouillon');
        assert.deepEqual(await readCategories(clientA, draftA.eventId), [draftA.categories.Standard.id], 'A lit ses catégories');
        assert.deepEqual(await readEvent(clientB, draftB.eventId), [draftB.eventId], 'B lit son brouillon');
        assert.deepEqual(await readCategories(clientB, draftB.eventId), [draftB.categories.Standard.id], 'B lit ses catégories');
    });

    test('partenaire A connecté : 0 ligne du brouillon de B ni de ses catégories', async () => {
        assert.deepEqual(await readEvent(clientA, draftB.eventId), [], 'VIOLATION RLS : A lit le brouillon de B');
        assert.deepEqual(await readCategories(clientA, draftB.eventId), [], 'VIOLATION RLS : A lit les catégories du brouillon de B');
    });

    test('client anonyme : 0 ligne du brouillon ni de ses catégories', async () => {
        const anon = anonClient();
        assert.deepEqual(await readEvent(anon, draftB.eventId), [], 'VIOLATION RLS : un anonyme lit le brouillon de B');
        assert.deepEqual(await readCategories(anon, draftB.eventId), [], 'VIOLATION RLS : un anonyme lit les catégories du brouillon de B');
    });
});
