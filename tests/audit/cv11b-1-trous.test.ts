/**
 * Contre-vérification du lot 11b — suite 1 : TROUS. Chaque test décrit l'attaque et attend le comportement SÛR :
 * vert = attaque bloquée, rouge = trou. Aucun correctif ici (branche lot11b/cv-rouges, jamais fusionnée).
 *
 *  T1. Fermeture exceptionnelle confirmée sur le seul NOMBRE de réservations de l'aperçu, pas sur la liste : une
 *      réservation annulée et une autre prise entre l'aperçu et la confirmation → la nouvelle, jamais montrée, est
 *      annulée (venue_closure_create : jsonb_array_length(v_touched) <> v_expected).
 *  T2. « Client absent » marqué par l'établissement dès l'heure de la réservation (5 min après), acompte gardé, alors
 *      que la règle est 30 minutes et que la confirmation promet « table gardée jusqu'à … » (table_reservation_presence :
 *      ABSENT dès v_now >= lower(slot)).
 *  T3. Aperçu d'annulation (« vous récupérez 21 000 F ») puis annulation confirmée sans montant attendu : l'heure de
 *      l'annulation gratuite passe entre les deux, l'annulation rend 0 sans nouvelle confirmation.
 *  T4. Téléphone du client donné à l'établissement pour une réservation « Client arrivé » dont le créneau est fini
 *      depuis 3 jours (l'état ARRIVEE ne se clôt jamais : contact = EN_ATTENTE_ACCEPTATION, CONFIRMEE, ARRIVEE).
 *  T6. Lecture REST (clé anon + jeton de la propriétaire) d'un établissement NON public (en attente de validation) et de
 *      ses tables : politique venues_read / restaurant_tables_read « OR is_partner_owner(partner_id) ».
 *  T7. Plan de salle refusé (une table d'un autre établissement dans la liste) mais à moitié enregistré : les tables
 *      placées avant la table refusée gardent leur nouvelle position (venue_plan_set : RETURN dans la boucle, sans
 *      annuler les UPDATE déjà faits).
 *
 * Base LOCALE, faux SamirPay ; routes réelles (gestionnaires importés, session par jeton).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { assertFinanceInvariants } from '../helpers/finance-invariants';
import { assertLot11aInvariants } from '../helpers/lot11a-invariants';
import {
    cashoutsOf, closureCreate, closurePreview, dayFromNow, n, newBuyer, newPartner, newTable, newVenue, openTablesService,
    paidOn, partnerPatch, platformSetting, reservation, reserveRpc, restAs, routeId, shiftReservation, show, sql,
    trace, type Buyer, type Row, type TestPartner,
} from './cv11b-helpers';

let restore: () => Promise<void>;
let owner: TestPartner;
let alice: Buyer;
let bob: Buyer;
let carol: Buyer;
let dave: Buyer;
let erin: Buyer;
let stranger: TestPartner;

before(async () => {
    restore = await openTablesService();
    owner = await newPartner('cv11b-1-proprio');
    alice = await newBuyer('cv11b-1-alice', { firstName: 'Awa', lastName: 'Ndiaye' });
    bob = await newBuyer('cv11b-1-bob', { firstName: 'Modou', lastName: 'Fall' });
    carol = await newBuyer('cv11b-1-carol', { firstName: 'Coumba', lastName: 'Sarr' });
    dave = await newBuyer('cv11b-1-dave', { firstName: 'Daouda', lastName: 'Ba' });
    erin = await newBuyer('cv11b-1-erin', { firstName: 'Eva', lastName: 'Mendy' });
    stranger = await newPartner('cv11b-1-autre');
});

after(async () => {
    await restore();
    await assertFinanceInvariants('cv11b-1-trous');
    await assertLot11aInvariants('cv11b-1-trous');
});

describe('T1. Fermeture : liste confirmée = liste de l’aperçu', () => {
    test('aperçu (A), A annulée, B prise sur la période, confirmation avec le même nombre → B ne doit pas être annulée sans avoir été montrée', async () => {
        const venue = await newVenue(owner, { deposit_per_person: 5_000 });
        const day = 40;
        const date = dayFromNow(day);
        const a = await paidOn(owner, venue, alice, day, '20:00', 'A');
        const body = { start_date: date, reason: 'Travaux de cuisine imprévus' };
        const preview = await closurePreview(owner, venue, body);
        assert.equal(preview.status, 200, show(preview));
        const shown = ((preview.body.preview as Row).reservations as Row[]).map((r) => String(r.reservation_id));
        assert.deepEqual(shown, [a.id], 'aperçu : la seule réservation A');
        // Entre l'aperçu et la confirmation : A annulée par son client, B prise et payée par un autre client
        const cancelA = await routeId('POST', 'tables/reservations/[id]/cancel', a.id, alice.accessToken, {});
        assert.equal(cancelA.status, 200, show(cancelA));
        const b = await paidOn(owner, venue, bob, day, '21:00', 'B');
        const created = await closureCreate(owner, venue, { ...body, expected_count: 1 });
        const rowB = await reservation(b.id);
        trace('T1 fermeture confirmée après changement de la liste', {
            apercu: shown, annuleeEntreTemps: a.id, priseEntreTemps: b.id, confirmation: show(created),
            B: { etat: rowB.booking_state, rendu: rowB.refunded_amount, motif: rowB.cancel_reason },
        });
        assert.notEqual(created.status, 201, `confirmation acceptée alors que la liste a changé (B jamais montrée) : ${show(created)}`);
        assert.equal(rowB.booking_state, 'CONFIRMEE', 'B, jamais montrée à l’aperçu, reste confirmée');
    });
});

describe('T2. Absence : 30 minutes de garde', () => {
    test('réservation payée commencée il y a 5 min : « Client absent » par l’établissement → refusé (trop tôt), acompte non gardé', async () => {
        const venue = await newVenue(owner, { deposit_per_person: 5_000 });
        const r = await paidOn(owner, venue, carol, 41, '20:00', 'G');
        const grace = n(await platformSetting('tables.no_show_minutes'));
        await shiftReservation(r.id, { startMinutes: -5 });
        const [promise] = await sql(`SELECT public.table_notif_data($1)->>'held_until' AS held_until, to_char(lower(slot), 'HH24:MI') AS starts FROM public.table_reservations WHERE id = $1`, [r.id]);
        const detail = await routeId('GET', 'partner/tables/reservations/[id]', r.id, owner.accessToken);
        const absent = await partnerPatch(r.id, owner, { action: 'ABSENT' });
        const row = await reservation(r.id);
        trace('T2 absent marqué 5 min après l’heure', {
            regle: `${grace} min`, promesse: promise, boutonAbsent: ((detail.body.reservation as Row | undefined)?.actions as Row | undefined)?.absent,
            reponse: show(absent), etat: row.booking_state, paye: row.paid_amount, rendu: row.refunded_amount, cashouts: (await cashoutsOf(r.id)).length,
        });
        assert.notEqual(absent.status, 200, `absent accepté 5 min après l’heure (règle : ${grace} min, table promise « gardée jusqu’à ${promise.held_until} ») : ${show(absent)}`);
        assert.equal(row.booking_state, 'CONFIRMEE', 'la table reste gardée');
    });
});

describe('T3. Aperçu d’annulation = remboursement réel', () => {
    test('aperçu « tout rendu », l’heure gratuite passe, annulation confirmée → doit rendre le montant annoncé ou demander une nouvelle confirmation', async () => {
        const venue = await newVenue(owner, { deposit_per_person: 5_000 });
        const r = await paidOn(owner, venue, dave, 42, '20:00', 'P');
        const free = n(await platformSetting('tables.cancel_free_hours'));
        await shiftReservation(r.id, { startMinutes: free * 60 + 1 });
        const preview = await routeId('GET', 'tables/reservations/[id]/cancel-preview', r.id, dave.accessToken);
        assert.equal(preview.status, 200, show(preview));
        const announced = n((preview.body.preview as Row).refundAmount);
        assert.equal(announced, 21_000, `aperçu : tout rendu (${show(preview)})`);
        // Deux minutes passent pendant que le client lit la fenêtre de confirmation
        await shiftReservation(r.id, { startMinutes: free * 60 - 1 });
        const cancel = await routeId('POST', 'tables/reservations/[id]/cancel', r.id, dave.accessToken, { expected_refund: announced });
        const row = await reservation(r.id);
        const got = n((cancel.body.reservation as Row | undefined)?.refundAmount ?? -1);
        trace('T3 aperçu puis annulation après l’heure gratuite', {
            apercu: preview.body.preview, annulation: show(cancel), etat: row.booking_state, rendu: row.refunded_amount, cashouts: (await cashoutsOf(r.id)).length,
        });
        assert.ok(cancel.status !== 200 || got === announced, `annulation acceptée avec ${got} F rendus au lieu des ${announced} F annoncés, sans nouvelle confirmation : ${show(cancel)}`);
    });
});

describe('T4. Téléphone du client : seulement pour une réservation qui tient la table', () => {
    test('« Client arrivé », créneau fini depuis 3 jours : détail et planning de l’établissement ne donnent plus le téléphone', async () => {
        const venue = await newVenue(owner);
        const table = await newTable(owner, venue, 4, { number: 'AR1' });
        const res = await reserveRpc(erin, venue, { date: dayFromNow(43), time: '20:00', guests: 4, tableId: table });
        assert.equal(res.ok, true, JSON.stringify(res));
        const id = String(res.reservation_id);
        await shiftReservation(id, { startMinutes: -10 });
        const arrived = await partnerPatch(id, owner, { action: 'ARRIVEE' });
        assert.equal(arrived.status, 200, show(arrived));
        await shiftReservation(id, { startMinutes: -3 * 24 * 60 });
        const row = await reservation(id);
        const detail = await routeId('GET', 'partner/tables/reservations/[id]', id, owner.accessToken);
        assert.equal(detail.status, 200, show(detail));
        const planning = await routeId('GET', 'partner/venues/[id]/planning', venue, owner.accessToken, undefined, `?date=${String(row.reservation_date)}`);
        const inPlanning = ((planning.body.reservations as Row[] | undefined) ?? []).find((x) => x.id === id);
        const phoneDetail = ((detail.body.reservation as Row).client as Row).phone;
        const phonePlanning = (inPlanning?.client as Row | undefined)?.phone ?? null;
        trace('T4 téléphone d’un client arrivé, créneau fini depuis 3 jours', {
            etat: row.booking_state, creneau: `${row.reservation_date} ${row.reservation_time}`, detail: (detail.body.reservation as Row).client,
            planning: inPlanning?.client ?? null,
        });
        assert.equal(phoneDetail, null, `téléphone donné pour une réservation finie depuis 3 jours : ${String(phoneDetail)}`);
        assert.equal(phonePlanning, null, `téléphone au planning d’il y a 3 jours : ${String(phonePlanning)}`);
    });
});

describe('T6. Lecture REST d’un établissement non public par sa propriétaire', () => {
    test('établissement en attente de validation : venues, restaurant_tables, venue_opening_hours → aucune ligne par la REST', async () => {
        const venue = await newVenue(owner, { validate: false });
        await newTable(owner, venue, 4, { number: 'NP1' });
        const [v] = await sql(`SELECT validation_status FROM public.venues WHERE id = $1`, [venue]);
        assert.equal(v.validation_status, 'EN_ATTENTE_VALIDATION', 'précondition : non public');
        const rest = restAs(owner.accessToken);
        const venues = await rest.from('venues').select('id, name, validation_status, validation_reason, photos, submitted_at').eq('id', venue);
        const tables = await rest.from('restaurant_tables').select('id, table_number, plan_x').eq('venue_id', venue);
        const hours = await rest.from('venue_opening_hours').select('weekday').eq('venue_id', venue);
        const anon = await restAs(null).from('venues').select('id').eq('id', venue);
        trace('T6 REST de la propriétaire sur son établissement non public', {
            venues: venues.data ?? venues.error, tables: tables.data ?? tables.error, hours: (hours.data ?? []).length, anon: anon.data ?? anon.error,
        });
        assert.equal((anon.data ?? []).length, 0, 'anon : rien');
        assert.equal((venues.data ?? []).length, 0, `établissement non public lu par la REST : ${JSON.stringify(venues.data)}`);
        assert.equal((tables.data ?? []).length, 0, `tables d’un établissement non public lues par la REST : ${JSON.stringify(tables.data)}`);
    });
});

describe('T7. Plan de salle refusé = rien d’enregistré', () => {
    test('liste du plan : une table à soi puis une table d’un autre établissement → 404 et la première table n’a pas bougé', async () => {
        const venue = await newVenue(owner);
        const mine = await newTable(owner, venue, 4, { number: 'PL1' });
        const foreign = await newTable(stranger, await newVenue(stranger), 4, { number: 'PL9' });
        const res = await routeId('PUT', 'partner/venues/[id]/plan', venue, owner.accessToken, {
            enabled: false, tables: [{ id: mine, x: 42, y: 17, shape: 'RONDE', rotation: 90 }, { id: foreign, x: 10, y: 10 }], zones: [],
        });
        const [t] = await sql(`SELECT plan_x, plan_y, plan_shape, plan_rotation FROM public.restaurant_tables WHERE id = $1`, [mine]);
        const [f] = await sql(`SELECT plan_x FROM public.restaurant_tables WHERE id = $1`, [foreign]);
        trace('T7 plan refusé', { reponse: show(res), maTable: t, tableDAutrui: f });
        assert.equal(res.status, 404, show(res));
        assert.equal(f.plan_x, null, 'table d’autrui jamais écrite');
        assert.deepEqual([t.plan_x, t.plan_shape, n(t.plan_rotation)], [null, 'CARREE', 0], `plan refusé mais position enregistrée : ${JSON.stringify(t)}`);
    });
});
