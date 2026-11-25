/**
 * Lot Carte B3 — adresse exacte d'un lieu tenu par un particulier (décision du client du 21/11 : la carte et les pages
 * publiques ne montrent qu'une zone d'environ 300 m ; l'adresse exacte n'est donnée qu'après une réservation confirmée,
 * et seulement à cette cliente).
 *
 * Un lieu (salle ou établissement) est « particulier » tant que sa propriétaire n'a pas déclaré un lieu professionnel
 * (protection par défaut). Les lieux créés ici ne déclarent rien : ce sont des lieux de particuliers. Chaque lecture
 * possible sans réservation confirmée est essayée, avec la clé anon et le jeton de chacun (jamais la clé de service pour
 * lire) :
 *  F1. REST : colonnes address, latitude, longitude des salles et des établissements ;
 *  F2. recherche publique : le texte cherché ne doit jamais être comparé à l'adresse d'un particulier (sinon on retrouve
 *      l'adresse par essais successifs) ;
 *  F3. routes publiques (recherche, fiche, tables d'un établissement) : ni l'adresse ni le point exact dans la réponse ;
 *  F4. écran de réservation de la cliente : réservation en attente de paiement ou annulée = jamais l'adresse ; autre
 *      cliente = rien ; réservation confirmée = adresse donnée (garde-fou).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { anonClient, api, show, userClient, type Reply } from '../audit/cvf1-helpers';
import { newBuyer, service, type Buyer } from '../parcours/paiement-helpers';
import { newPartner, type TestPartner } from '../parcours/finance-helpers';
import {
    decideHall, newHall, openHallsService, payConfirmed as payHall, reserveRpc as reserveHall,
} from '../parcours/l10a-helpers';
import {
    newTable, newVenue, openTablesService, payConfirmed as payTable, reserveRpc as reserveTable,
} from '../parcours/l11a-helpers';

const TOKEN = `cb3${randomBytes(4).toString('hex')}`;
const HALL_ADDRESS = `Villa ${TOKEN} rue des Manguiers`;
const VENUE_ADDRESS = `Maison ${TOKEN} allée des Filaos`;
// Positions exactes reconnaissables (5 décimales) : aucune ne doit sortir
const HALL_POINT = { latitude: 14.71357, longitude: -17.46913 };
const VENUE_POINT = { latitude: 14.72468, longitude: -17.48024 };

const exactTexts = (address: string, p: { latitude: number; longitude: number }): string[] => [
    address, TOKEN, String(p.latitude), String(p.longitude),
];

function leaks(r: Reply | string, forbidden: string[]): string[] {
    const text = typeof r === 'string' ? r : JSON.stringify(r.body);
    return forbidden.filter((f) => text.includes(f));
}

const route = (rel: string, token: string | null, opts: { id?: string; query?: string } = {}): Promise<Reply> =>
    api('GET', rel, { token, params: opts.id ? { id: opts.id } : {}, path: `/api/${opts.id ? rel.replace('[id]', opts.id) : rel}${opts.query ?? ''}` });

let restoreHalls: () => Promise<void>;
let restoreTables: () => Promise<void>;
let owner: TestPartner;
let alice: Buyer;
let bob: Buyer;
let hallId: string;
let venueId: string;

before(async () => {
    restoreHalls = await openHallsService();
    restoreTables = await openTablesService();
    owner = await newPartner('cb3-particulier');
    alice = await newBuyer('cb3-alice');
    bob = await newBuyer('cb3-bob');
    hallId = await newHall(owner, { validate: false });
    const h = await service.from('halls').update({ address: HALL_ADDRESS, ...HALL_POINT }).eq('id', hallId).select('id').single();
    assert.equal(h.error, null, h.error?.message);
    const d = await decideHall(hallId, 'VALIDER');
    assert.equal(d.ok, true, JSON.stringify(d));
    venueId = await newVenue(owner, { deposit_per_person: 2_000 });
    const v = await service.from('venues').update({ address: VENUE_ADDRESS, ...VENUE_POINT }).eq('id', venueId).select('id').single();
    assert.equal(v.error, null, v.error?.message);
    await newTable(owner, venueId, 4);
});

after(async () => {
    await restoreHalls();
    await restoreTables();
});

describe('F1 — REST : adresse et position d’un lieu de particulier jamais lisibles', () => {
    for (const [table, id] of [['halls', () => hallId], ['venues', () => venueId]] as const) {
        test(`${table} : visiteur et cliente connectée ne lisent ni l’adresse ni la position`, async () => {
            for (const client of [anonClient(), userClient(alice.accessToken)]) {
                const { data, error } = await client.from(table).select('id, address, latitude, longitude').eq('id', id());
                const rows = (data ?? []) as Array<Record<string, unknown>>;
                const exposed = rows.filter((r) => r.address !== null && r.address !== undefined || r.latitude !== null && r.latitude !== undefined);
                assert.deepEqual(exposed, [], `${table} lisible par la REST (erreur : ${error?.message ?? 'aucune'})`);
            }
        });
    }
});

describe('F2 — recherche publique : jamais comparée à l’adresse d’un particulier', () => {
    test('salles : chercher un mot de l’adresse ne retrouve pas la salle', async () => {
        const r = await route('halls', null, { query: `?q=${TOKEN}` });
        assert.equal(r.status, 200, show(r));
        const ids = ((r.body.halls ?? []) as Array<{ id: string }>).map((x) => x.id);
        assert.ok(!ids.includes(hallId), `la recherche « ${TOKEN} » retrouve la salle par son adresse : ${show(r)}`);
    });
    test('établissements : chercher un mot de l’adresse ne retrouve pas l’établissement', async () => {
        const r = await route('tables', null, { query: `?q=${TOKEN}` });
        assert.equal(r.status, 200, show(r));
        const ids = ((r.body.venues ?? []) as Array<{ id: string }>).map((x) => x.id);
        assert.ok(!ids.includes(venueId), `la recherche « ${TOKEN} » retrouve l’établissement par son adresse : ${show(r)}`);
    });
});

describe('F3 — routes publiques : ni l’adresse ni le point exact', () => {
    test('GET /api/halls et /api/halls/[id]', async () => {
        const name = String((await service.from('halls').select('name').eq('id', hallId).single()).data!.name);
        const list = await route('halls', null, { query: `?q=${encodeURIComponent(name)}` });
        assert.equal(list.status, 200, show(list));
        assert.ok(((list.body.halls ?? []) as Array<{ id: string }>).some((x) => x.id === hallId), `salle absente de la recherche : ${show(list)}`);
        assert.deepEqual(leaks(list, exactTexts(HALL_ADDRESS, HALL_POINT)), [], 'recherche des salles');
        const one = await route('halls/[id]', null, { id: hallId });
        assert.equal(one.status, 200, show(one));
        assert.deepEqual(leaks(one, exactTexts(HALL_ADDRESS, HALL_POINT)), [], 'fiche de la salle');
    });
    test('GET /api/tables, /api/tables/[id], /api/restaurants/[id]/tables', async () => {
        const name = String((await service.from('venues').select('name').eq('id', venueId).single()).data!.name);
        const list = await route('tables', null, { query: `?q=${encodeURIComponent(name)}` });
        assert.equal(list.status, 200, show(list));
        assert.ok(((list.body.venues ?? []) as Array<{ id: string }>).some((x) => x.id === venueId), `établissement absent de la recherche : ${show(list)}`);
        assert.deepEqual(leaks(list, exactTexts(VENUE_ADDRESS, VENUE_POINT)), [], 'recherche des établissements');
        const one = await route('tables/[id]', null, { id: venueId });
        assert.equal(one.status, 200, show(one));
        assert.deepEqual(leaks(one, exactTexts(VENUE_ADDRESS, VENUE_POINT)), [], 'fiche de l’établissement');
        const tables = await route('restaurants/[id]/tables', null, { id: venueId });
        assert.ok(tables.status === 200 || tables.status === 404, show(tables));
        assert.deepEqual(leaks(tables, exactTexts(VENUE_ADDRESS, VENUE_POINT)), [], 'tables de l’établissement');
    });
});

describe('F4 — écran de réservation : l’adresse seulement après confirmation, seulement à cette cliente', () => {
    test('salle : en attente de paiement = pas d’adresse ; autre cliente = rien ; confirmée = adresse', async () => {
        const res = await reserveHall(alice, hallId, { startInDays: 75 });
        assert.equal(res.ok, true, JSON.stringify(res));
        const id = String(res.reservation_id);
        const pending = await route('halls/reservations/[id]', alice.accessToken, { id });
        assert.equal(pending.status, 200, show(pending));
        assert.deepEqual(leaks(pending, exactTexts(HALL_ADDRESS, HALL_POINT)), [], 'réservation en attente de paiement');
        const other = await route('halls/reservations/[id]', bob.accessToken, { id });
        assert.deepEqual(leaks(other, exactTexts(HALL_ADDRESS, HALL_POINT)), [], 'autre cliente');
        await payHall(alice, id, 'ACOMPTE');
        const confirmed = await route('halls/reservations/[id]', alice.accessToken, { id });
        assert.equal(confirmed.status, 200, show(confirmed));
        assert.ok(JSON.stringify(confirmed.body).includes(HALL_ADDRESS), `adresse absente après confirmation : ${show(confirmed)}`);
        const stranger = await route('halls/reservations/[id]', bob.accessToken, { id });
        assert.deepEqual(leaks(stranger, exactTexts(HALL_ADDRESS, HALL_POINT)), [], 'autre cliente après confirmation');
    });
    test('table : acompte à payer = pas d’adresse ; confirmée = adresse ; annulée = plus d’adresse', async () => {
        const res = await reserveTable(alice, venueId, { guests: 2 });
        assert.equal(res.ok, true, JSON.stringify(res));
        const id = String(res.reservation_id);
        const pending = await route('tables/reservations/[id]', alice.accessToken, { id });
        assert.equal(pending.status, 200, show(pending));
        assert.deepEqual(leaks(pending, exactTexts(VENUE_ADDRESS, VENUE_POINT)), [], 'réservation en attente de paiement');
        await payTable(alice, id);
        const confirmed = await route('tables/reservations/[id]', alice.accessToken, { id });
        assert.ok(JSON.stringify(confirmed.body).includes(VENUE_ADDRESS), `adresse absente après confirmation : ${show(confirmed)}`);
        const other = await route('tables/reservations/[id]', bob.accessToken, { id });
        assert.deepEqual(leaks(other, exactTexts(VENUE_ADDRESS, VENUE_POINT)), [], 'autre cliente');
        const cancel = await api('POST', 'tables/reservations/[id]/cancel', { token: alice.accessToken, params: { id }, path: `/api/tables/reservations/${id}/cancel`, body: {} });
        assert.ok(cancel.status < 300, show(cancel));
        const cancelled = await route('tables/reservations/[id]', alice.accessToken, { id });
        assert.deepEqual(leaks(cancelled, exactTexts(VENUE_ADDRESS, VENUE_POINT)), [], 'réservation annulée');
    });
});
