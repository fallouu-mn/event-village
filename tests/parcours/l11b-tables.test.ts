/**
 * Lot 11b — tables : couche serveur des écrans (création en une fois, renvoi en validation, plan de salle, pastilles,
 * recherche, fermetures exceptionnelles, aperçu d'annulation, « J'arrive », lien court, planning, administration,
 * interrupteur fermé, avis). Base LOCALE, faux SamirPay ; routes réelles (gestionnaires importés, session par jeton).
 * Montants attendus calculés à la main : acompte 5 000 F × 4 = 20 000, frais 5 % = 1 000, à payer 21 000.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { assertFinanceInvariants } from '../helpers/finance-invariants';
import { newAdmin, type TestAdmin } from './notif-helpers';
import { withFeatureFlags } from './terrain-helpers';
import { shortLinkTarget } from '../../lib/tables/short-link';
import {
    api, dayFromNow, decideVenue, newBuyer, newPartner, newTable, newVenue, newZone, openTablesService, payConfirmed, reservation,
    reserveRpc, routeId, service, shiftReservation, show, sql, type Buyer, type Row, type TestPartner,
} from '../audit/cv11a-helpers';

let restore: () => Promise<void>;
let owner: TestPartner;
let stranger: TestPartner;
let alice: Buyer;
let bob: Buyer;
let validator: TestAdmin;
let reader: TestAdmin;
let weak: TestAdmin;

const n = (v: unknown): number => Number(v);

/** Adresse d'une photo « déposée » (nom réencodé) dans le dossier des établissements d'une partenaire. */
function photoOf(partnerId: string): string {
    const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
    return `${base}/storage/v1/object/public/public-images/venues/${partnerId}/${Date.now()}_${randomBytes(4).toString('hex')}.webp`;
}

async function outboxTypes(userId: string, reservationId: string, type: string): Promise<string[]> {
    const { data, error } = await service.from('notification_outbox').select('channel')
        .eq('recipient_user_id', userId).eq('type', type).eq('template_data->>reservation_id', reservationId);
    assert.equal(error, null, error?.message);
    return (data ?? []).map((r) => String(r.channel)).sort();
}

async function rpc(fn: string, p: Row): Promise<Row> {
    const { data, error } = await service.rpc(fn, { p });
    assert.equal(error, null, `${fn} : ${error?.message}`);
    return data as Row;
}

before(async () => {
    restore = await openTablesService();
    owner = await newPartner('l11b-proprio');
    stranger = await newPartner('l11b-autre');
    alice = await newBuyer('l11b-alice', { firstName: 'Awa', lastName: 'Ndiaye' });
    bob = await newBuyer('l11b-bob', { firstName: 'Modou', lastName: 'Fall' });
    validator = await newAdmin('l11b-valide', ['halls.validate']);
    reader = await newAdmin('l11b-lecteur', ['halls.validate', 'partners.read']);
    weak = await newAdmin('l11b-faible', ['events.read']);
});

after(async () => {
    await restore();
    await assertFinanceInvariants('l11b-tables');
});

describe('1. Création en une fois, envoi en validation, renvoi', () => {
    test('route : fiche, photo réencodée, horaires, zone, tables → créé « en attente », zones et tables rattachées, administrateurs prévenus', async () => {
        const name = `TEST l11b création ${randomBytes(3).toString('hex')}`;
        const res = await api('POST', 'partner/venues', { token: owner.accessToken, body: {
            kind: 'RESTAURANT', name, address: 'Route de Ngor', city: 'Dakar', confirmation_mode: 'AUTO', deposit_per_person: null,
            // Lot Carte B3 (décision du client du 25/11, modification signalée au rapport) : position obligatoire à la création
            latitude: 14.7461, longitude: -17.5133,
            photos: [photoOf(owner.partnerId)], hours: [{ weekday: 6, opens_at: '12:00', closes_at: '23:00' }],
            zones: [{ key: 'z1', name: 'Terrasse' }], tables: [{ number: '1', capacity: 4, zone_key: 'z1' }, { number: '2', capacity: 2 }],
        } });
        assert.equal(res.status, 201, show(res));
        const id = String((res.body.venue as Row).id);
        const [v] = await sql(`SELECT validation_status, cardinality(photos) AS photos, submitted_at IS NOT NULL AS submitted FROM public.venues WHERE id = $1`, [id]);
        assert.deepEqual([v.validation_status, n(v.photos), v.submitted], ['EN_ATTENTE_VALIDATION', 1, true]);
        const tables = await sql(`SELECT t.table_number, t.capacity, z.name AS zone FROM public.restaurant_tables t LEFT JOIN public.restaurant_zones z ON z.id = t.zone_id WHERE t.venue_id = $1 ORDER BY 1`, [id]);
        assert.deepEqual(tables.map((t) => [t.table_number, n(t.capacity), t.zone]), [['1', 4, 'Terrasse'], ['2', 2, null]]);
        const notices = await sql(`SELECT count(*)::int AS c FROM public.notification_outbox WHERE type = 'ADMIN_VENUE_SUBMITTED' AND template_data->>'venue_id' = $1`, [id]);
        assert.ok(n(notices[0].c) > 0, 'administrateurs prévenus');
    });

    test('refus : photo hors du dossier de la partenaire, numéro de table en double → rien de créé, aucun avis', async () => {
        const name = `TEST l11b refus ${randomBytes(3).toString('hex')}`;
        const body = (photos: string[], tables: Row[]) => ({ name, address: 'Almadies', city: 'Dakar', photos, hours: [{ weekday: 1, opens_at: '10:00', closes_at: '22:00' }], tables });
        const foreign = await api('POST', 'partner/venues', { token: owner.accessToken, body: body([photoOf(stranger.partnerId)], [{ number: '1', capacity: 2 }]) });
        const twice = await api('POST', 'partner/venues', { token: owner.accessToken, body: body([photoOf(owner.partnerId)], [{ number: '7', capacity: 2 }, { number: '7', capacity: 4 }]) });
        const empty = await api('POST', 'partner/venues', { token: owner.accessToken, body: body([photoOf(owner.partnerId)], []) });
        console.log(`[L11B] création refusée : ${JSON.stringify({ foreign: show(foreign), twice: show(twice), empty: show(empty) })}`);
        assert.deepEqual([foreign.status, foreign.body.code], [400, 'IMAGE_ORIGIN_INVALID']);
        assert.equal(twice.status, 400, show(twice));
        assert.match(String(twice.body.error), /Deux tables portent le numéro « 7 »/);
        assert.equal(empty.status, 400, show(empty));
        const rows = await sql(`SELECT count(*)::int AS c FROM public.venues WHERE name = $1`, [name]);
        assert.equal(n(rows[0].c), 0, 'aucun établissement créé');
    });

    test('refusé puis modifié : reste refusé ; renvoi → en attente (administrateurs prévenus) ; renvoi d’un établissement en attente refusé', async () => {
        const venue = await newVenue(owner, { validate: false });
        await newTable(owner, venue, 4);
        await service.from('venues').update({ photos: [photoOf(owner.partnerId)] }).eq('id', venue);
        assert.equal((await decideVenue(venue, 'REFUSER', 'Photos floues, adresse incomplète')).ok, true);
        const patch = await routeId('PATCH', 'partner/venues/[id]', venue, owner.accessToken, { name: 'Nouveau nom l11b' });
        assert.equal(patch.status, 200, show(patch));
        assert.equal((await sql(`SELECT validation_status FROM public.venues WHERE id = $1`, [venue]))[0].validation_status, 'REFUSEE');
        const submit = await routeId('POST', 'partner/venues/[id]/submit', venue, owner.accessToken);
        assert.equal(submit.status, 200, show(submit));
        const [v] = await sql(`SELECT validation_status, validation_reason FROM public.venues WHERE id = $1`, [venue]);
        assert.deepEqual([v.validation_status, v.validation_reason], ['EN_ATTENTE_VALIDATION', null]);
        const again = await routeId('POST', 'partner/venues/[id]/submit', venue, owner.accessToken);
        assert.deepEqual([again.status, again.body.code], [409, 'INVALID_TRANSITION']);
        const other = await routeId('POST', 'partner/venues/[id]/submit', venue, stranger.accessToken);
        assert.equal(other.status, 404, show(other));
    });
});

describe('2. Plan de salle', () => {
    test('positions des tables et des zones ; plan public : libre, prise, hors capacité ; rien sur les clients', async () => {
        const venue = await newVenue(owner);
        const zone = await newZone(owner, venue, 'Salle');
        const t4 = await newTable(owner, venue, 4, { number: 'P4', min: 2, zoneId: zone });
        const t2 = await newTable(owner, venue, 2, { number: 'P2' });
        const empty = await routeId('PUT', 'partner/venues/[id]/plan', venue, owner.accessToken, { enabled: true, tables: [], zones: [] });
        assert.deepEqual([empty.status, empty.body.code], [400, 'INVALID_PLAN']);
        const set = await routeId('PUT', 'partner/venues/[id]/plan', venue, owner.accessToken, {
            enabled: true, tables: [{ id: t4, x: 20, y: 30, shape: 'RONDE', rotation: 0 }, { id: t2, x: 70, y: 30, shape: 'CARREE', rotation: 45 }],
            zones: [{ id: zone, x: 5, y: 10, w: 50, h: 50 }],
        });
        assert.equal(set.status, 200, show(set));
        const date = dayFromNow(22);
        const free = await api('GET', 'tables/[id]/floor', { params: { id: venue }, path: `/api/tables/${venue}/floor?date=${date}&time=20:00&guests=4` });
        assert.equal(free.status, 200, show(free));
        const states = (rows: unknown) => Object.fromEntries((rows as Row[]).map((t) => [t.number, t.state]));
        assert.deepEqual(states(free.body.tables), { P2: 'HORS_CAPACITE', P4: 'LIBRE' });
        assert.ok(((free.body.zones as Row[]) ?? []).some((z) => z.name === 'Salle'), 'zone placée');
        const r = await reserveRpc(alice, venue, { date, time: '20:00', guests: 4, tableId: t4 });
        assert.equal(r.ok, true, JSON.stringify(r));
        const taken = await api('GET', 'tables/[id]/floor', { params: { id: venue }, path: `/api/tables/${venue}/floor?date=${date}&time=21:00&guests=4` });
        assert.deepEqual(states(taken.body.tables), { P2: 'HORS_CAPACITE', P4: 'PRISE' });
        assert.doesNotMatch(JSON.stringify(taken.body), /Ndiaye|Awa|client/i, 'aucune donnée du client');
        const foreignTable = await newTable(stranger, await newVenue(stranger), 4);
        const foreign = await routeId('PUT', 'partner/venues/[id]/plan', venue, owner.accessToken, { enabled: true, tables: [{ id: foreignTable, x: 10, y: 10 }], zones: [] });
        assert.deepEqual([foreign.status, foreign.body.code], [404, 'TABLE_NOT_FOUND']);
        const intruder = await routeId('PUT', 'partner/venues/[id]/plan', venue, stranger.accessToken, { enabled: false, tables: [], zones: [] });
        assert.equal(intruder.status, 404, show(intruder));
    });
});

describe('3. Pastilles, recherche, fermetures exceptionnelles', () => {
    test('fermeture : aperçu (réservations touchées, montant rendu), liste changée refusée, confirmation (annulées, remboursées en entier, client prévenu), plus réservable, retrait', async () => {
        const venue = await newVenue(owner, { deposit_per_person: 5_000 });
        await newTable(owner, venue, 4, { number: 'F1' });
        await newTable(owner, venue, 4, { number: 'F2' });
        const date = dayFromNow(25);
        const paid = await reserveRpc(alice, venue, { date, time: '20:00', guests: 4 });
        assert.equal(paid.ok, true, JSON.stringify(paid));
        await payConfirmed(alice, String(paid.reservation_id));
        const slotsBefore = await api('GET', 'tables/[id]/slots', { params: { id: venue }, path: `/api/tables/${venue}/slots?date=${date}&guests=4` });
        assert.equal(slotsBefore.status, 200, show(slotsBefore));
        assert.equal(slotsBefore.body.day, 'OUVERT');
        const body = { start_date: date, reason: 'Travaux dans la salle' };
        const preview = await api('POST', 'partner/venues/[id]/closures', { token: owner.accessToken, params: { id: venue }, path: `/api/partner/venues/${venue}/closures?preview=1`, body });
        assert.equal(preview.status, 200, show(preview));
        const p = preview.body.preview as Row;
        assert.deepEqual([n(p.count), n(p.refundTotal)], [1, 21_000]);
        assert.equal(((p.reservations as Row[])[0]).client_name, 'Awa N.');
        const changed = await api('POST', 'partner/venues/[id]/closures', { token: owner.accessToken, params: { id: venue }, body: { ...body, expected_count: 0 } });
        assert.deepEqual([changed.status, changed.body.code], [409, 'PREVIEW_CHANGED']);
        const intruder = await api('POST', 'partner/venues/[id]/closures', { token: stranger.accessToken, params: { id: venue }, body: { ...body, expected_count: 1 } });
        assert.equal(intruder.status, 404, show(intruder));
        // Contre-vérification du lot 11b (T1, modification signalée au rapport) : la confirmation renvoie l'empreinte de
        // la liste de l'aperçu ; sans elle, un aperçu non vide ne se confirme pas
        assert.match(String(p.fingerprint), /^[0-9a-f]{32}$/, 'empreinte de la liste rendue avec l’aperçu');
        const noHash = await api('POST', 'partner/venues/[id]/closures', { token: owner.accessToken, params: { id: venue }, body: { ...body, expected_count: 1 } });
        assert.deepEqual([noHash.status, noHash.body.code], [400, 'PREVIEW_REQUIRED']);
        const created = await api('POST', 'partner/venues/[id]/closures', { token: owner.accessToken, params: { id: venue }, body: { ...body, expected_count: 1, expected_hash: p.fingerprint } });
        assert.equal(created.status, 201, show(created));
        const row = await reservation(String(paid.reservation_id));
        assert.deepEqual([row.booking_state, n(row.refunded_amount), row.cancel_origin], ['ANNULEE_ETABLISSEMENT', 21_000, 'ETABLISSEMENT']);
        assert.equal(row.cancel_reason, 'Fermeture exceptionnelle : Travaux dans la salle');
        assert.deepEqual(await outboxTypes(alice.userId, String(paid.reservation_id), 'TABLE_RESERVATION_CANCELLED'), ['EMAIL', 'IN_APP', 'PUSH', 'SMS']);
        const blocked = await reserveRpc(bob, venue, { date, time: '13:00', guests: 2 });
        assert.equal(blocked.code, 'VENUE_CLOSED', JSON.stringify(blocked));
        const slots = await api('GET', 'tables/[id]/slots', { params: { id: venue }, path: `/api/tables/${venue}/slots?date=${date}&guests=4` });
        assert.equal(slots.body.day, 'FERMETURE_EXCEPTIONNELLE');
        const overlap = await api('POST', 'partner/venues/[id]/closures', { token: owner.accessToken, params: { id: venue }, path: `/api/partner/venues/${venue}/closures?preview=1`, body });
        assert.deepEqual([overlap.status, overlap.body.code], [409, 'CLOSURE_OVERLAP']);
        const closureId = String((created.body.closure as Row).id);
        const strangerDel = await routeId('DELETE', 'partner/venues/closures/[id]', closureId, stranger.accessToken);
        assert.equal(strangerDel.status, 404, show(strangerDel));
        const del = await routeId('DELETE', 'partner/venues/closures/[id]', closureId, owner.accessToken);
        assert.equal(del.status, 200, show(del));
        const again = await reserveRpc(bob, venue, { date, time: '13:00', guests: 2 });
        assert.equal(again.ok, true, JSON.stringify(again));
    });

    test('plage horaire : seuls les créneaux qui la touchent sont fermés ; recherche : créneaux autour de l’heure, filtre « libre »', async () => {
        const venue = await newVenue(owner);
        const { data: v } = await service.from('venues').select('name').eq('id', venue).single();
        await newTable(owner, venue, 4, { number: 'S1' });
        const date = dayFromNow(26);
        const preview = await rpc('venue_closure_preview', { actor_id: owner.userId, venue_id: venue, start_date: date, start_time: '19:00', end_time: '21:00', reason: 'Soirée privée' });
        assert.equal(preview.ok, true, JSON.stringify(preview));
        assert.equal((await rpc('venue_closure_create', { actor_id: owner.userId, venue_id: venue, start_date: date, start_time: '19:00', end_time: '21:00', reason: 'Soirée privée', expected_count: 0 })).ok, true);
        const slots = await api('GET', 'tables/[id]/slots', { params: { id: venue }, path: `/api/tables/${venue}/slots?date=${date}&guests=2` });
        const times = (slots.body.slots as Row[]).map((s) => s.time);
        // Créneau de 2 h : 17:00 se termine à 19:00 (gardé) ; 17:30 à 20:30 touchent la fermeture ; 21:00 rouvre
        assert.ok(times.includes('17:00') && times.includes('21:00'), times.join(','));
        assert.ok(!times.includes('17:30') && !times.includes('19:00') && !times.includes('20:30'), times.join(','));
        assert.equal(slots.body.partlyClosed, true);
        const q = encodeURIComponent(String(v!.name));
        const found = await api('GET', 'tables', { path: `/api/tables?q=${q}&date=${date}&time=22:00&guests=2` });
        assert.equal(found.status, 200, show(found));
        const card = (found.body.venues as Row[]).find((x) => x.id === venue);
        assert.ok(card, show(found));
        assert.deepEqual((card!.slots as Row[]).map((s) => [s.time, s.state]), [['21:00', 'LIBRE'], ['21:30', 'LIBRE'], ['22:00', 'LIBRE'], ['22:30', 'LIBRE'], ['23:00', 'LIBRE']]);
        // La seule table prise à 22:00 : plus de créneau libre à 21:00-23:30 qui la chevauche ; « libre seulement » l'écarte
        assert.equal((await reserveRpc(alice, venue, { date, time: '21:30', guests: 2 })).ok, true);
        const full = await api('GET', 'tables', { path: `/api/tables?q=${q}&date=${date}&time=22:00&guests=2&available=1` });
        assert.ok(!(full.body.venues as Row[]).some((x) => x.id === venue), show(full));
    });
});

describe('4. Client : aperçu d’annulation, « J’arrive », lien court, détail', () => {
    test('aperçu = ce que rend l’annulation : tout plus de 2 h avant, rien ensuite ; demande pas encore acceptée : tout', async () => {
        const venue = await newVenue(owner, { deposit_per_person: 5_000 });
        await newTable(owner, venue, 4);
        const early = String((await reserveRpc(bob, venue, { date: dayFromNow(27), time: '20:00', guests: 4 })).reservation_id);
        await payConfirmed(bob, early);
        const p1 = await routeId('GET', 'tables/reservations/[id]/cancel-preview', early, bob.accessToken);
        assert.equal(p1.status, 200, show(p1));
        assert.deepEqual([n((p1.body.preview as Row).refundAmount), n((p1.body.preview as Row).keptAmount)], [21_000, 0]);
        await shiftReservation(early, { startMinutes: 60 });
        const p2 = await routeId('GET', 'tables/reservations/[id]/cancel-preview', early, bob.accessToken);
        assert.deepEqual([n((p2.body.preview as Row).refundAmount), n((p2.body.preview as Row).keptAmount)], [0, 21_000]);
        const other = await routeId('GET', 'tables/reservations/[id]/cancel-preview', early, alice.accessToken);
        assert.equal(other.status, 404, show(other));
        const cancel = await routeId('POST', 'tables/reservations/[id]/cancel', early, bob.accessToken, {});
        assert.equal(cancel.status, 200, show(cancel));
        assert.equal(n((cancel.body.reservation as Row).refundAmount), 0, 'annulation tardive : rien rendu, comme l’aperçu');
        const manual = await newVenue(owner, { deposit_per_person: 5_000, confirmation_mode: 'MANUELLE' });
        await newTable(owner, manual, 4);
        const ask = String((await reserveRpc(bob, manual, { date: dayFromNow(28), time: '20:00', guests: 4 })).reservation_id);
        await payConfirmed(bob, ask);
        assert.equal((await reservation(ask)).booking_state, 'EN_ATTENTE_ACCEPTATION');
        await shiftReservation(ask, { startMinutes: 60, responseMinutes: 30 });
        const p3 = await routeId('GET', 'tables/reservations/[id]/cancel-preview', ask, bob.accessToken);
        assert.equal(n((p3.body.preview as Row).refundAmount), 21_000);
    });

    test('« J’arrive » : trop tôt refusé ; dans les 24 h, noté une fois, l’établissement prévenu sur les 4 canaux ; autre client : introuvable', async () => {
        const alice = await newBuyer('l11b-arrive', { firstName: 'Awa', lastName: 'Ndiaye' });
        const venue = await newVenue(owner);
        await newTable(owner, venue, 4);
        const id = String((await reserveRpc(alice, venue, { date: dayFromNow(29), time: '20:00', guests: 4 })).reservation_id);
        const early = await routeId('POST', 'tables/reservations/[id]/coming', id, alice.accessToken, {});
        assert.deepEqual([early.status, early.body.code], [409, 'TOO_EARLY']);
        await shiftReservation(id, { startMinutes: 90 });
        const ok = await routeId('POST', 'tables/reservations/[id]/coming', id, alice.accessToken, {});
        assert.equal(ok.status, 200, show(ok));
        assert.match(String(ok.body.message), /gardée jusqu’à \d{1,2} h/);
        const twice = await routeId('POST', 'tables/reservations/[id]/coming', id, alice.accessToken, {});
        assert.equal(twice.status, 200, show(twice));
        assert.ok((await reservation(id)).client_coming_at, 'venue notée');
        assert.deepEqual(await outboxTypes(owner.userId, id, 'TABLE_CLIENT_COMING'), ['EMAIL', 'IN_APP', 'PUSH', 'SMS'], 'une seule fois, 4 canaux');
        const other = await routeId('POST', 'tables/reservations/[id]/coming', id, bob.accessToken, {});
        assert.equal(other.status, 404, show(other));
        const detail = await routeId('GET', 'tables/reservations/[id]', id, alice.accessToken);
        assert.equal(detail.status, 200, show(detail));
        const d = detail.body.reservation as Row;
        assert.deepEqual([d.clientComing, d.canSayComing, d.canCancel, d.stateLabel], [true, false, true, 'Confirmée']);
    });

    test('lien court : code de 7 caractères ; mène le client à sa réservation, l’établissement à la sienne, personne d’autre ; avis avec le code', async () => {
        const venue = await newVenue(owner);
        await newTable(owner, venue, 4);
        const id = String((await reserveRpc(bob, venue, { date: dayFromNow(30), time: '20:00', guests: 2 })).reservation_id);
        const code = String((await reservation(id)).short_code);
        assert.match(code, /^[2-9a-hjkmnp-z]{7}$/);
        assert.equal(await shortLinkTarget(bob.userId, code), `/tables/reservations/${id}`);
        assert.equal(await shortLinkTarget(owner.userId, code), `/partner/tables/reservations/${id}`);
        assert.equal(await shortLinkTarget(alice.userId, code), null);
        assert.equal(await shortLinkTarget(stranger.userId, code), null);
        assert.equal(await shortLinkTarget(bob.userId, 'ABCDEFG'), null);
        const { data } = await service.from('notification_outbox').select('template_data').eq('recipient_user_id', bob.userId)
            .eq('type', 'TABLE_RESERVATION_CONFIRMED').eq('template_data->>reservation_id', id).limit(1).single();
        assert.equal((data!.template_data as Row).short_code, code);
        assert.match(String((data!.template_data as Row).held_until), /^\d{2}:\d{2}$/);
    });
});

describe('5. Établissement : planning, détail, recettes', () => {
    test('planning du jour : réservations, téléphone du client seulement pour une table tenue, demandes à accepter ; autre partenaire : introuvable', async () => {
        const alice = await newBuyer('l11b-planning-a', { firstName: 'Awa', lastName: 'Ndiaye' });
        const bob = await newBuyer('l11b-planning-b');
        const venue = await newVenue(owner, { deposit_per_person: 5_000 });
        await newTable(owner, venue, 4);
        await newTable(owner, venue, 4);
        const date = dayFromNow(31);
        const paid = String((await reserveRpc(alice, venue, { date, time: '20:00', guests: 4 })).reservation_id);
        await payConfirmed(alice, paid);
        const holding = String((await reserveRpc(bob, venue, { date, time: '20:00', guests: 4 })).reservation_id);
        const r = await routeId('GET', 'partner/venues/[id]/planning', venue, owner.accessToken, undefined, `?date=${date}`);
        assert.equal(r.status, 200, show(r));
        const byId = Object.fromEntries((r.body.reservations as Row[]).map((x) => [x.id, x]));
        assert.equal((byId[paid].client as Row).name, 'Awa N.');
        assert.ok((byId[paid].client as Row).phone, 'téléphone du client d’une réservation confirmée');
        assert.equal((byId[holding].client as Row).phone, null, 'attente de paiement : pas de téléphone');
        const other = await routeId('GET', 'partner/venues/[id]/planning', venue, stranger.accessToken, undefined, `?date=${date}`);
        assert.equal(other.status, 404, show(other));
        const detail = await routeId('GET', 'partner/tables/reservations/[id]', paid, owner.accessToken);
        assert.equal(detail.status, 200, show(detail));
        assert.deepEqual((detail.body.reservation as Row).actions, { accept: false, refuse: false, arrived: false, absent: false, cancel: true, onsite: true });
        const foreign = await routeId('GET', 'partner/tables/reservations/[id]', paid, stranger.accessToken);
        assert.equal(foreign.status, 404, show(foreign));
        const earnings = await api('GET', 'partner/tables/earnings', { token: owner.accessToken });
        assert.equal(earnings.status, 200, show(earnings));
        const mine = (earnings.body.rows as Row[]).find((x) => x.reservationId === paid);
        assert.ok(mine && n(mine.earned) === 20_000, `recette de l’acompte (20 000) : ${JSON.stringify(mine)}`);
    });
});

describe('6. Administration : file et fiche de décision', () => {
    test('halls.validate : file et fiche, contacts de la partenaire seulement avec partners.read ; sans le droit : refusé', async () => {
        const venue = await newVenue(owner, { validate: false });
        const list = await api('GET', 'admin/venues', { token: validator.accessToken, path: '/api/admin/venues?status=EN_ATTENTE_VALIDATION' });
        assert.equal(list.status, 200, show(list));
        assert.ok(n((list.body.counts as Row).EN_ATTENTE_VALIDATION) >= 1);
        const sheet = await routeId('GET', 'admin/venues/[id]', venue, validator.accessToken);
        assert.equal(sheet.status, 200, show(sheet));
        const partner = (sheet.body.venue as Row).partner as Row;
        assert.deepEqual([partner.phone, partner.email, partner.contactsAllowed], [null, null, false]);
        const full = await routeId('GET', 'admin/venues/[id]', venue, reader.accessToken);
        const p2 = (full.body.venue as Row).partner as Row;
        assert.ok(p2.phone && p2.contactsAllowed === true, show(full));
        const denied = await api('GET', 'admin/venues', { token: weak.accessToken });
        assert.equal(denied.status, 403, show(denied));
        const deniedSheet = await routeId('GET', 'admin/venues/[id]', venue, weak.accessToken);
        assert.equal(deniedSheet.status, 403, show(deniedSheet));
    });
});

describe('7. Service fermé : réservations existantes ouvertes, catalogue et écritures fermés', () => {
    test('client : liste et détail lisibles (paiement non proposé) ; établissement : planning, détail, action ; recherche et création : 404', async () => {
        const alice = await newBuyer('l11b-ferme');
        const venue = await newVenue(owner, { deposit_per_person: 5_000 });
        await newTable(owner, venue, 4);
        const date = dayFromNow(33);
        const id = String((await reserveRpc(alice, venue, { date, time: '20:00', guests: 4 })).reservation_id);
        await withFeatureFlags({ tables: false }, async () => {
            const list = await api('GET', 'tables/reservations', { token: alice.accessToken });
            assert.equal(list.status, 200, show(list));
            assert.ok((list.body.reservations as Row[]).some((r) => r.id === id));
            const detail = await routeId('GET', 'tables/reservations/[id]', id, alice.accessToken);
            assert.equal(detail.status, 200, show(detail));
            assert.equal((detail.body.reservation as Row).canPay, false, 'paiement non proposé service fermé');
            const planning = await routeId('GET', 'partner/venues/[id]/planning', venue, owner.accessToken, undefined, `?date=${date}`);
            assert.equal(planning.status, 200, show(planning));
            const pres = await routeId('GET', 'partner/tables/reservations/[id]', id, owner.accessToken);
            assert.equal(pres.status, 200, show(pres));
            const cancel = await routeId('PATCH', 'partner/tables/reservations/[id]', id, owner.accessToken, { action: 'ANNULER', reason: 'Cuisine fermée ce soir-là' });
            assert.equal(cancel.status, 200, show(cancel));
            const search = await api('GET', 'tables', { path: '/api/tables' });
            assert.equal(search.status, 404, show(search));
            const sheet = await routeId('GET', 'tables/[id]', venue, null);
            assert.equal(sheet.status, 404, show(sheet));
            const create = await api('POST', 'partner/venues', { token: owner.accessToken, body: { name: 'Fermé' } });
            assert.equal(create.status, 404, show(create));
        });
    });
});

describe('8. Avis : nuit et réservation proche', () => {
    test('non urgents reportés la nuit ; une réservation à moins de 12 h rend l’avis urgent ; rappel 2 h avant', async () => {
        const policy = Object.fromEntries((await sql(`SELECT type, night_policy FROM public.notification_types WHERE type LIKE 'TABLE\\_%' OR type LIKE '%VENUE\\_%'`)).map((r) => [r.type, r.night_policy]));
        for (const t of ['TABLE_RESERVATION_CONFIRMED', 'TABLE_NEW_RESERVATION', 'TABLE_CLIENT_COMING', 'VENUE_VALIDATION_DECIDED', 'TABLE_REMINDER']) assert.equal(policy[t], 'DEFER', t);
        for (const t of ['TABLE_REQUEST_SENT', 'TABLE_REQUEST_TO_ANSWER', 'TABLE_RESERVATION_CANCELLED', 'TABLE_REQUEST_REFUSED', 'TABLE_NO_SHOW', 'TABLE_REFUND_PAID']) assert.equal(policy[t], 'SEND', t);
        const alice = await newBuyer('l11b-nuit-a');
        const bob = await newBuyer('l11b-nuit-b');
        const venue = await newVenue(owner);
        await newTable(owner, venue, 4);
        const soon = String((await reserveRpc(bob, venue, { date: dayFromNow(34), time: '20:00', guests: 2 })).reservation_id);
        const far = String((await reserveRpc(alice, venue, { date: dayFromNow(35), time: '20:00', guests: 2 })).reservation_id);
        await shiftReservation(soon, { startMinutes: 180 });
        const [r] = await sql(`SELECT public.notif_event_soon(NULL, jsonb_build_object('reservation_id', $1::text), now()) AS soon,
                                      public.notif_event_soon(NULL, jsonb_build_object('reservation_id', $2::text), now()) AS far`, [soon, far]);
        assert.deepEqual([r.soon, r.far], [true, false]);
        const [s] = await sql(`SELECT value FROM public.platform_settings WHERE key = 'tables.reminder_hours'`);
        assert.deepEqual(s.value, { value: 2 });
    });
});
