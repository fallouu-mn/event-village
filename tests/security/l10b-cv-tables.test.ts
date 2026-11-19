/**
 * Contre-vérification du lot 10b, T4 bis et T5 bis — les mêmes trous que T4 et T5, vérifiés sur les établissements et
 * les réservations de tables (lot 11a). Clé anon et jetons de session seulement, jamais la clé de service pour attaquer.
 *  - T4 bis : établissement validé d'une partenaire SUSPENDU : l'application ne le sert plus (routes publiques : partenaire
 *    VALIDE exigée), mais la REST anonyme le rendait, avec ses tables et ses zones ;
 *  - T5 bis : l'établissement lisait par la REST toutes les colonnes des réservations de ses établissements (client_id,
 *    données de l'attente non payée), alors que sa route serveur ne lui donne ni le compte du client ni son identité.
 * Vert = attaque bloquée.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { assertLot11aInvariants } from '../helpers/lot11a-invariants';
import { service } from '../parcours/paiement-helpers';
import {
    dayFromNow, newBuyer, newPartner, newTable, newVenue, newZone, openTablesService, reserveRpc, type Buyer, type TestPartner,
} from '../parcours/l11a-helpers';

function clientOf(token: string | null): SupabaseClient {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        ...(token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}),
    });
}

let restore: () => Promise<void>;
let owner: TestPartner;
let suspended: TestPartner;
let alice: Buyer;
let venue: string;
let suspendedVenue: string;
let suspendedTable: string;
let suspendedZone: string;
let resId: string;

before(async () => {
    restore = await openTablesService();
    owner = await newPartner('l10b-cv-etab');
    suspended = await newPartner('l10b-cv-etab-suspendu');
    alice = await newBuyer('l10b-cv-alice');
    venue = await newVenue(owner);
    await newTable(owner, venue, 4);
    suspendedVenue = await newVenue(suspended);
    suspendedZone = await newZone(suspended, suspendedVenue, 'Terrasse');
    suspendedTable = await newTable(suspended, suspendedVenue, 4, { zoneId: suspendedZone });
    resId = String((await reserveRpc(alice, venue, { date: dayFromNow(50), notes: 'Appelez-moi au 777112889' })).reservation_id);
    const { error } = await service.from('partners').update({ status: 'SUSPENDU' }).eq('id', suspended.partnerId);
    assert.equal(error, null, error?.message);
});

after(async () => {
    await service.from('partners').update({ status: 'VALIDE' }).eq('id', suspended.partnerId);
    await restore();
    await assertLot11aInvariants('l10b-cv-tables');
});

describe('T4 bis. Établissement d’une partenaire suspendue lisible par la REST anonyme', () => {
    test('établissement, table et zone d’une partenaire SUSPENDU : invisibles d’un visiteur et d’un client', async () => {
        for (const token of [null, alice.accessToken]) {
            const v = await clientOf(token).from('venues').select('id').eq('id', suspendedVenue);
            const t = await clientOf(token).from('restaurant_tables').select('id').eq('id', suspendedTable);
            const z = await clientOf(token).from('restaurant_zones').select('id').eq('id', suspendedZone);
            const seen = { venue: v.data ?? [], table: t.data ?? [], zone: z.data ?? [] };
            console.log(`[L10B-CV] T4 bis ${token ? 'client' : 'visiteur'} : ${JSON.stringify(seen)}`);
            assert.deepEqual([seen.venue.length, seen.table.length, seen.zone.length], [0, 0, 0], `lu par ${token ? 'un client' : 'un visiteur'} : ${JSON.stringify(seen)}`);
        }
    });
});

describe('T5 bis. Réservations de tables lues par l’établissement par la REST', () => {
    test('jeton de l’établissement + clé anon : aucune réservation lisible (ses écrans passent par le serveur)', async () => {
        const { data } = await clientOf(owner.accessToken).from('table_reservations').select('id, client_id, booking_state, special_requests').eq('id', resId);
        console.log(`[L10B-CV] T5 bis REST de l’établissement : ${JSON.stringify(data)}`);
        assert.deepEqual(data ?? [], [], `réservation lue par l’établissement par la REST : ${JSON.stringify(data)}`);
        const mine = await clientOf(alice.accessToken).from('table_reservations').select('id').eq('id', resId);
        assert.deepEqual((mine.data ?? []).map((r) => r.id), [resId], 'témoin : le client lit la sienne');
    });
});
