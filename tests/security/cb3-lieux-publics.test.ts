/**
 * Lot Carte B3 — lieux publics. Décision du client du 25/11 (elle remplace celle du 21/11 sur les particuliers ;
 * modification signalée au rapport) : l'application est entièrement publique ; l'adresse et la position exactes d'une
 * salle ou d'un établissement validé sont des données publiques. Les anciennes failles F2 (recherche sur l'adresse),
 * F3 (adresse et point sur les routes publiques) et F4 (adresse sur l'écran de réservation) n'en sont donc plus : leurs
 * tests vérifient maintenant que ces données SONT rendues. Restent, inchangées :
 *  F1. REST : les colonnes address, latitude, longitude des salles et des établissements ne sont jamais lisibles par la
 *      clé anon ni par le jeton d'une cliente : tout passe par les routes du serveur, colonne par colonne ;
 *  R.  rien de la partenaire (nom légal, téléphone, adresse électronique, pièces) dans les réponses publiques.
 * Chaque lecture se fait avec la clé anon ou le jeton de chacun (jamais la clé de service pour lire).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { anonClient, api, show, userClient, type Reply } from '../audit/cvf1-helpers';
import { newBuyer, service, type Buyer } from '../parcours/paiement-helpers';
import { newPartner, type TestPartner } from '../parcours/finance-helpers';
import { decideHall, newHall, openHallsService, reserveRpc as reserveHall } from '../parcours/l10a-helpers';
import { newTable, newVenue, openTablesService, reserveRpc as reserveTable } from '../parcours/l11a-helpers';
// Lecture réelle de la carte, celle que GET /api/lieux/carte met en cache (le cache de Next n'existe pas hors du serveur)
import { readPlaceEntries } from '../../lib/lieux/carte-lieux.server';

const TOKEN = `cb3${randomBytes(4).toString('hex')}`;
/** Quartier reconnaissable, écrit dans l'adresse (aucune colonne « quartier » : le quartier fait partie de l'adresse). */
const QUARTIER = `Mermoz${randomBytes(3).toString('hex')}`;
const HALL_ADDRESS = `Villa ${TOKEN} rue des Manguiers, ${QUARTIER}`;
const VENUE_ADDRESS = `Maison ${TOKEN} allée des Filaos, ${QUARTIER}`;
const HALL_POINT = { latitude: 14.71357, longitude: -17.46913 };
const VENUE_POINT = { latitude: 14.72468, longitude: -17.48024 };

const route = (rel: string, token: string | null, opts: { id?: string; query?: string } = {}): Promise<Reply> =>
    api('GET', rel, { token, params: opts.id ? { id: opts.id } : {}, path: `/api/${opts.id ? rel.replace('[id]', opts.id) : rel}${opts.query ?? ''}` });

const text = (r: Reply): string => JSON.stringify(r.body);

/** Toutes les clés d'une réponse, à toute profondeur. */
function keysOf(v: unknown, out: Set<string> = new Set()): Set<string> {
    if (Array.isArray(v)) v.forEach((x) => keysOf(x, out));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { out.add(k); keysOf(x, out); }
    return out;
}

let restoreHalls: () => Promise<void>;
let restoreTables: () => Promise<void>;
let owner: TestPartner;
let alice: Buyer;
let bob: Buyer;
let hallId: string;
let venueId: string;
let partnerSecrets: string[];

before(async () => {
    restoreHalls = await openHallsService();
    restoreTables = await openTablesService();
    owner = await newPartner('cb3-public');
    alice = await newBuyer('cb3-alice');
    bob = await newBuyer('cb3-bob');
    hallId = await newHall(owner, { validate: false, position: HALL_POINT });
    const h = await service.from('halls').update({ address: HALL_ADDRESS }).eq('id', hallId).select('id').single();
    assert.equal(h.error, null, h.error?.message);
    const d = await decideHall(hallId, 'VALIDER');
    assert.equal(d.ok, true, JSON.stringify(d));
    venueId = await newVenue(owner, { deposit_per_person: 2_000, position: VENUE_POINT });
    const v = await service.from('venues').update({ address: VENUE_ADDRESS }).eq('id', venueId).select('id').single();
    assert.equal(v.error, null, v.error?.message);
    await newTable(owner, venueId, 4);
    const { data: pa, error } = await service.from('partners').select('company_name, phone, email').eq('id', owner.partnerId).single();
    assert.equal(error, null, error?.message);
    partnerSecrets = [String(pa!.company_name), String(pa!.phone), String(pa!.email)].filter((x) => x && x !== 'null');
});

after(async () => {
    await restoreHalls();
    await restoreTables();
});

describe('F1 (gardée) — REST : adresse et position jamais lisibles directement', () => {
    for (const [table, id] of [['halls', () => hallId], ['venues', () => venueId]] as const) {
        test(`${table} : visiteur et cliente connectée ne lisent ni l’adresse ni la position par la REST`, async () => {
            for (const client of [anonClient(), userClient(alice.accessToken)]) {
                const { data, error } = await client.from(table).select('id, address, latitude, longitude').eq('id', id());
                const rows = (data ?? []) as Array<Record<string, unknown>>;
                const exposed = rows.filter((r) => r.address !== null && r.address !== undefined || r.latitude !== null && r.latitude !== undefined);
                assert.deepEqual(exposed, [], `${table} lisible par la REST (erreur : ${error?.message ?? 'aucune'})`);
            }
        });
    }
});

describe('P1 — recherche publique : par l’adresse et par le quartier (décision du 25/11)', () => {
    for (const word of [TOKEN, QUARTIER]) {
        test(`« ${word.startsWith('Mermoz') ? 'quartier' : 'adresse'} » : salle et établissement retrouvés`, async () => {
            const halls = await route('halls', null, { query: `?q=${encodeURIComponent(word)}` });
            assert.equal(halls.status, 200, show(halls));
            assert.ok(((halls.body.halls ?? []) as Array<{ id: string }>).some((x) => x.id === hallId), `salle absente : ${show(halls)}`);
            const venues = await route('tables', null, { query: `?q=${encodeURIComponent(word)}` });
            assert.equal(venues.status, 200, show(venues));
            assert.ok(((venues.body.venues ?? []) as Array<{ id: string }>).some((x) => x.id === venueId), `établissement absent : ${show(venues)}`);
        });
    }
});

describe('P2 — routes publiques : adresse et point exacts pour tout le monde', () => {
    test('GET /api/halls/[id] et la recherche des salles', async () => {
        const one = await route('halls/[id]', null, { id: hallId });
        assert.equal(one.status, 200, show(one));
        for (const v of [HALL_ADDRESS, String(HALL_POINT.latitude), String(HALL_POINT.longitude)]) assert.ok(text(one).includes(v), `${v} absent de la fiche : ${show(one)}`);
        const list = await route('halls', null, { query: `?q=${TOKEN}` });
        assert.ok(text(list).includes(HALL_ADDRESS) && text(list).includes(String(HALL_POINT.latitude)), show(list));
    });
    test('GET /api/tables/[id], /api/restaurants/[id]/tables et la recherche des établissements', async () => {
        for (const r of [await route('tables/[id]', null, { id: venueId }), await route('restaurants/[id]/tables', null, { id: venueId })]) {
            assert.equal(r.status, 200, show(r));
            for (const v of [VENUE_ADDRESS, String(VENUE_POINT.latitude), String(VENUE_POINT.longitude)]) assert.ok(text(r).includes(v), `${v} absent : ${show(r)}`);
        }
        const list = await route('tables', null, { query: `?q=${TOKEN}` });
        assert.ok(text(list).includes(VENUE_ADDRESS) && text(list).includes(String(VENUE_POINT.latitude)), show(list));
    });
    test('carte d’Explorer : point exact', async () => {
        const places = await readPlaceEntries();
        const p = places.find((x) => x.id === hallId);
        const v = places.find((x) => x.id === venueId);
        assert.deepEqual(p && { lat: p.lat, lng: p.lng }, { lat: HALL_POINT.latitude, lng: HALL_POINT.longitude });
        assert.deepEqual(v && { lat: v.lat, lng: v.lng }, { lat: VENUE_POINT.latitude, lng: VENUE_POINT.longitude });
    });
});

describe('P3 — écran de réservation : l’adresse dès la réservation ; une autre cliente ne lit rien', () => {
    test('salle : en attente de paiement = adresse ; autre cliente = rien', async () => {
        const res = await reserveHall(alice, hallId, { startInDays: 75 });
        assert.equal(res.ok, true, JSON.stringify(res));
        const id = String(res.reservation_id);
        const mine = await route('halls/reservations/[id]', alice.accessToken, { id });
        assert.equal(mine.status, 200, show(mine));
        assert.ok(text(mine).includes(HALL_ADDRESS), `adresse absente : ${show(mine)}`);
        const other = await route('halls/reservations/[id]', bob.accessToken, { id });
        assert.ok(other.status >= 400 && !text(other).includes(HALL_ADDRESS), show(other));
    });
    test('table : acompte à payer = adresse ; autre cliente = rien', async () => {
        const res = await reserveTable(alice, venueId, { guests: 2 });
        assert.equal(res.ok, true, JSON.stringify(res));
        const id = String(res.reservation_id);
        const mine = await route('tables/reservations/[id]', alice.accessToken, { id });
        assert.equal(mine.status, 200, show(mine));
        assert.ok(text(mine).includes(VENUE_ADDRESS), `adresse absente : ${show(mine)}`);
        const other = await route('tables/reservations/[id]', bob.accessToken, { id });
        assert.ok(other.status >= 400 && !text(other).includes(VENUE_ADDRESS), show(other));
    });
});

describe('R (gardée) — rien de la partenaire dans les réponses publiques', () => {
    test('recherches, fiches, tables, carte : ni nom légal, ni téléphone, ni adresse électronique, ni pièces', async () => {
        const replies: Array<[string, Reply]> = [
            ['recherche des salles', await route('halls', null, { query: `?q=${TOKEN}` })],
            ['fiche de la salle', await route('halls/[id]', null, { id: hallId })],
            ['recherche des établissements', await route('tables', null, { query: `?q=${TOKEN}` })],
            ['fiche de l’établissement', await route('tables/[id]', null, { id: venueId })],
            ['tables de l’établissement', await route('restaurants/[id]/tables', null, { id: venueId })],
            ['carte', { status: 200, body: { places: (await readPlaceEntries()).filter((x) => x.id === hallId || x.id === venueId) } }],
        ];
        assert.ok(partnerSecrets.length >= 2, `secrets de la partenaire lus : ${partnerSecrets.join(', ')}`);
        for (const [what, r] of replies) {
            assert.equal(r.status, 200, `${what} : ${show(r)}`);
            for (const secret of partnerSecrets) assert.ok(!text(r).includes(secret), `${what} : « ${secret} » rendu`);
            const banned = [...keysOf(r.body)].filter((k) => /^(phone|email|company_name|legal_name|siret|ninea|documents?|pieces?|id_document\w*|registration\w*)$/i.test(k));
            assert.deepEqual(banned, [], `${what} : champs de la partenaire`);
        }
    });
});
