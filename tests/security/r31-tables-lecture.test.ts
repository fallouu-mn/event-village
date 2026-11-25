/**
 * R31 — Lot 11a (C3) : données personnelles des réservations de table et visibilité des établissements, par la REST
 * avec le jeton de chacun (clé anon + jeton de session), jamais la clé de service.
 *  - réservations : le client voit les siennes ; l'établissement celles de ses établissements ; un autre client, une
 *    autre partenaire, un visiteur et un administrateur sans le code administrateur ne voient rien ; avec le code, oui ;
 *  - établissements : plus aucune lecture REST pour un visiteur, un client ou une autre partenaire (contre-vérification
 *    de la carte B3, T1 : docs/audit-carte-b3.md ; modification signalée au rapport du lot Carte B3 ; avant : les
 *    établissements actifs et validés) ; zones, tables et horaires d'un
 *    établissement non validé : invisibles du public. Décision du chef de projet, T6 de cv11b : la propriétaire aussi ne
 *    lit par la REST que ses établissements validés et publics ; les autres, par les routes serveur seulement ;
 *  - aucune écriture REST sur venues, venue_opening_hours, restaurant_zones, restaurant_tables ni table_reservations.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { assertLot11aInvariants } from '../helpers/lot11a-invariants';
import { newAdmin } from '../parcours/notif-helpers';
import { service } from '../parcours/paiement-helpers';
import { api, show } from '../audit/cvf1-helpers';
import {
    dayFromNow, decideVenue, newBuyer, newPartner, newTable, newVenue, newZone, openTablesService, reserveRpc, type Buyer, type TestPartner,
} from '../parcours/l11a-helpers';

function clientOf(token: string | null): SupabaseClient {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        ...(token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}),
    });
}

async function visible(table: string, token: string | null, ids: string[], column = 'id'): Promise<string[]> {
    const { data, error } = await clientOf(token).from(table).select(column).in(column, ids);
    if (error) return [];
    return [...new Set((data ?? []).map((r) => String((r as unknown as Record<string, unknown>)[column])))].sort();
}

let restore: () => Promise<void>;
let owner: TestPartner;
let otherPartner: TestPartner;
let alice: Buyer;
let bob: Buyer;
let aliceRes: string;
let bobRes: string;
let validated: string;
let pending: string;
let refused: string;
let pendingTable: string;
let validatedTable: string;
let pendingZone: string;

before(async () => {
    restore = await openTablesService();
    owner = await newPartner('r31-etab');
    otherPartner = await newPartner('r31-autre');
    alice = await newBuyer('r31-alice');
    bob = await newBuyer('r31-bob');
    validated = await newVenue(owner);
    pending = await newVenue(owner, { validate: false });
    refused = await newVenue(owner, { validate: false });
    await decideVenue(refused, 'REFUSER', 'Adresse introuvable.');
    validatedTable = await newTable(owner, validated, 4);
    await newTable(owner, validated, 4);
    pendingZone = await newZone(owner, pending, 'Terrasse');
    pendingTable = await newTable(owner, pending, 4, { zoneId: pendingZone });
    aliceRes = String((await reserveRpc(alice, validated, { date: dayFromNow(40), notes: 'Allergie aux arachides' })).reservation_id);
    bobRes = String((await reserveRpc(bob, validated, { date: dayFromNow(41) })).reservation_id);
});

after(async () => {
    await restore();
    await assertLot11aInvariants('r31-tables-lecture');
});

describe('R31 — réservations de table : chacun ne lit que ce qui le regarde', () => {
    test('le client voit la sienne seulement', async () => {
        assert.deepEqual(await visible('table_reservations', alice.accessToken, [aliceRes, bobRes]), [aliceRes]);
        assert.deepEqual(await visible('table_reservations', bob.accessToken, [aliceRes, bobRes]), [bobRes]);
    });
    // Contre-vérification du lot 10b (T5 bis, modification signalée au rapport) : l’établissement ne lit plus ses
    // réservations par la REST (ses écrans passent par les routes serveur)
    test('l’établissement ne lit plus ses réservations par la REST ; une autre partenaire ne voit rien', async () => {
        assert.deepEqual(await visible('table_reservations', owner.accessToken, [aliceRes, bobRes]), []);
        assert.deepEqual(await visible('table_reservations', otherPartner.accessToken, [aliceRes, bobRes]), []);
    });
    test('un visiteur ne voit rien', async () => {
        assert.deepEqual(await visible('table_reservations', null, [aliceRes, bobRes]), []);
    });
    test('un administrateur sans le code administrateur ne voit rien ; avec le code, il voit', async () => {
        const admin = await newAdmin('r31-admin', ['events.read']);
        assert.deepEqual(await visible('table_reservations', admin.accessToken, [aliceRes, bobRes]), [aliceRes, bobRes].sort(), 'avec le code');
        const bare = await newBuyer('r31-admin-sans-code');
        const { error } = await service.from('user_roles').upsert([{ user_id: bare.userId, role: 'ADMIN' }], { onConflict: 'user_id,role' });
        assert.equal(error, null, error?.message);
        const { error: delErr } = await service.from('admin_session_codes').delete().eq('user_id', bare.userId);
        assert.equal(delErr, null, delErr?.message);
        assert.deepEqual(await visible('table_reservations', bare.accessToken, [aliceRes, bobRes]), [], 'sans le code administrateur');
    });
});

describe('R31 — établissements, zones, tables, horaires : visibles du public seulement validés', () => {
    // Contre-vérification de la carte B3 (T1, modification signalée au rapport du lot Carte B3) : la REST de venues est
    // fermée aux rôles publics ; seule la propriétaire lit encore l'identifiant de son établissement public (ci-dessous).
    test('un visiteur, un client et une autre partenaire ne voient aucun établissement, même validé', async () => {
        assert.deepEqual(await visible('venues', null, [validated, pending, refused]), []);
        assert.deepEqual(await visible('venues', alice.accessToken, [validated, pending, refused]), []);
        assert.deepEqual(await visible('venues', otherPartner.accessToken, [validated, pending, refused]), []);
    });
    // Décision du chef de projet, T6 de cv11b (docs/audit-lot11b.md ; modification signalée au rapport du lot 11b) : la
    // propriétaire ne lit par la REST que son établissement et ses tables validés et publics ; en attente ou refusés :
    // 0 ligne. Elle voit toujours tout par les routes serveur (rôle de service), prouvé ci-dessous.
    test('la propriétaire ne lit par la REST que son établissement validé ; en attente ou refusé : 0 ligne', async () => {
        assert.deepEqual(await visible('venues', owner.accessToken, [validated, pending, refused]), [validated]);
        assert.deepEqual(await visible('venues', owner.accessToken, [pending, refused]), []);
    });
    test('tables, zones et horaires d’un établissement en attente : invisibles du public et de la propriétaire par la REST', async () => {
        assert.deepEqual(await visible('restaurant_tables', null, [validatedTable, pendingTable]), [validatedTable]);
        assert.deepEqual(await visible('restaurant_tables', owner.accessToken, [validatedTable, pendingTable]), [validatedTable]);
        assert.deepEqual(await visible('restaurant_zones', null, [pendingZone]), []);
        assert.deepEqual(await visible('restaurant_zones', owner.accessToken, [pendingZone]), []);
        assert.deepEqual(await visible('venue_opening_hours', null, [validated, pending], 'venue_id'), [validated]);
        assert.deepEqual(await visible('venue_opening_hours', owner.accessToken, [validated, pending], 'venue_id'), [validated]);
    });
    test('par les routes serveur, la propriétaire voit toujours ses établissements en attente ou refusés, leurs tables et zones', async () => {
        const list = await api('GET', 'partner/venues', { token: owner.accessToken });
        assert.equal(list.status, 200, show(list));
        const ids = ((list.body.venues as Array<Record<string, unknown>>) ?? []).map((v) => String(v.id));
        for (const v of [validated, pending, refused]) assert.ok(ids.includes(v), `établissement ${v} absent de la liste de la propriétaire : ${show(list)}`);
        const sheet = await api('GET', 'partner/venues/[id]', { token: owner.accessToken, params: { id: pending }, path: `/api/partner/venues/${pending}` });
        assert.equal(sheet.status, 200, show(sheet));
        const venue = sheet.body.venue as Record<string, unknown>;
        assert.equal(venue.status, 'EN_ATTENTE_VALIDATION');
        assert.ok(((venue.tables as Array<Record<string, unknown>>) ?? []).some((t) => t.id === pendingTable), `table de l’établissement en attente absente : ${show(sheet)}`);
        assert.ok(((venue.zones as Array<Record<string, unknown>>) ?? []).some((z) => z.id === pendingZone), `zone de l’établissement en attente absente : ${show(sheet)}`);
        const refusedSheet = await api('GET', 'partner/venues/[id]', { token: owner.accessToken, params: { id: refused }, path: `/api/partner/venues/${refused}` });
        assert.equal(refusedSheet.status, 200, show(refusedSheet));
        assert.equal((refusedSheet.body.venue as Record<string, unknown>).status, 'REFUSEE');
        const stranger = await api('GET', 'partner/venues/[id]', { token: otherPartner.accessToken, params: { id: pending }, path: `/api/partner/venues/${pending}` });
        assert.equal(stranger.status, 404, `établissement en attente servi à une autre partenaire : ${show(stranger)}`);
    });
});

describe('R31 — aucune écriture REST sur les tables', () => {
    test('insertion et mise à jour refusées, même par la propriétaire ou le client', async () => {
        const ins = await clientOf(alice.accessToken).from('table_reservations').insert({
            partner_id: owner.partnerId, venue_id: validated, table_id: validatedTable, client_id: alice.userId,
            reservation_date: dayFromNow(50), reservation_time: '20:00', guest_count: 2,
        });
        assert.ok(ins.error, 'insertion d’une réservation acceptée');
        const upd = await clientOf(owner.accessToken).from('table_reservations').update({ booking_state: 'ARRIVEE' }).eq('id', aliceRes).select('id');
        assert.ok(upd.error || (upd.data ?? []).length === 0, 'mise à jour d’une réservation acceptée');
        const venueUpd = await clientOf(owner.accessToken).from('venues').update({ validation_status: 'VALIDEE' }).eq('id', pending).select('id');
        assert.ok(venueUpd.error || (venueUpd.data ?? []).length === 0, 'validation de son propre établissement acceptée');
        const venueIns = await clientOf(owner.accessToken).from('venues').insert({ partner_id: owner.partnerId, name: 'Établissement REST', city: 'Dakar' });
        assert.ok(venueIns.error, 'établissement créé par la REST');
        const tableIns = await clientOf(owner.accessToken).from('restaurant_tables').insert({ partner_id: owner.partnerId, venue_id: validated, table_number: 'R', capacity: 4 });
        assert.ok(tableIns.error, 'table créée par la REST');
        const hoursIns = await clientOf(owner.accessToken).from('venue_opening_hours').insert({ venue_id: validated, weekday: 1, opens_at: '10:00', closes_at: '11:00' });
        assert.ok(hoursIns.error, 'horaires écrits par la REST');
    });
});
