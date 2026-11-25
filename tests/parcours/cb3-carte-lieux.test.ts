/**
 * Lot Carte B3 — salles et établissements sur la carte d'Explorer, sur la base locale (lecture réelle : readPlaceEntries,
 * celle que la route met en cache, puis selectPlaces, celle que la route rend) :
 *  A. rendus : lieux actifs, validés, d'une partenaire VALIDE, avec une position ; jamais : en attente, refusé,
 *     suspendu, retiré (inactif), partenaire suspendue, sans position ; une suspension, un retrait ou une suspension de
 *     la partenaire les retirent à la lecture suivante (le passage à travers le cache, en moins de 5 s, est prouvé de
 *     bout en bout par e2e/carte-b3.responsive.spec.ts) ;
 *  B. aucun champ en trop (PUBLIC_PLACE_FIELDS) ; ni nom légal, ni téléphone, ni adresse électronique de la partenaire ;
 *  C. décision du client du 25/11 (modification signalée au rapport : remplace les tests de la zone de 300 m) : chaque
 *     lieu à sa position exacte, la même à chaque lecture ; une position déplacée est rendue telle quelle ; une salle
 *     sans position (d'avant la décision) n'est pas sur la carte ;
 *  D. route : couche d'un service fermé = 404 ; paramètres illisibles = 400 ;
 *  E. disponibilité : salle réservée à une date absente de la couche filtrée sur cette date.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { NextRequest } from 'next/server';
import { BASE_URL } from './helpers';
import { newBuyer, service, type Buyer } from './paiement-helpers';
import { newPartner, type TestPartner } from './finance-helpers';
import { decideHall, newHall, openHallsService, reserveRpc as reserveHall, setPlatformSetting, platformSetting } from './l10a-helpers';
import { decideVenue, newTable, newVenue, openTablesService } from './l11a-helpers';
import { readPlaceEntries } from '../../lib/lieux/carte-lieux.server';
import { parsePlacesQuery, selectPlaces, PUBLIC_PLACE_FIELDS, type PublicMapPlace } from '../../lib/lieux/carte-lieux';
import { availablePlaceIds } from '../../lib/lieux/carte-lieux.server';
import { GET as placesRoute } from '../../app/api/lieux/carte/route';

const TOKEN = `cb3c${randomBytes(3).toString('hex')}`;
const POINT = { latitude: 14.70123, longitude: -17.45678 };
const OTHER_POINT = { latitude: 14.69321, longitude: -17.44123 };
const VENUE_POINT = { latitude: 14.73456, longitude: -17.49876 };

async function layer(name: 'salles' | 'restaurants', extra = ''): Promise<PublicMapPlace[]> {
    const q = parsePlacesQuery(new URLSearchParams(`couche=${name}${extra}`));
    assert.ok(q.ok, q.ok ? '' : q.message);
    return selectPlaces(await readPlaceEntries(), q.query, null).places;
}

const ids = (places: PublicMapPlace[]): Set<string> => new Set(places.map((p) => p.id));

async function setPlace(table: 'halls' | 'venues', id: string, patch: Record<string, unknown>): Promise<void> {
    const { error } = await service.from(table).update(patch).eq('id', id);
    assert.equal(error, null, error?.message);
}

async function route(query: string): Promise<{ status: number; body: Record<string, unknown> }> {
    const res = await placesRoute(new NextRequest(`${BASE_URL}/api/lieux/carte?${query}`));
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

let restoreHalls: () => Promise<void>;
let restoreTables: () => Promise<void>;
let owner: TestPartner;
let other: TestPartner;
let alice: Buyer;
const H: Record<string, string> = {};
let venueId: string;
let refusedVenue: string;

before(async () => {
    restoreHalls = await openHallsService();
    restoreTables = await openTablesService();
    owner = await newPartner('cb3-carte');
    other = await newPartner('cb3-autre');
    alice = await newBuyer('cb3-carte-alice');
    for (const key of ['une', 'deux', 'attente', 'suspendue', 'inactive', 'sansPosition', 'autrePartenaire']) {
        const id = await newHall(key === 'autrePartenaire' ? other : owner, { validate: false, position: key === 'deux' ? OTHER_POINT : POINT });
        H[key] = id;
        await setPlace('halls', id, { name: `Salle ${TOKEN} ${key}`, address: `Adresse ${TOKEN} ${key}` });
        if (key !== 'attente') {
            const d = await decideHall(id, 'VALIDER');
            assert.equal(d.ok, true, JSON.stringify(d));
        }
    }
    // Salle validée avant la décision du 25/11, sans position (retirée par la clé de service) : hors de la carte
    await setPlace('halls', H.sansPosition, { latitude: null, longitude: null });
    assert.equal((await decideHall(H.suspendue, 'SUSPENDRE', 'Contrôle de la carte B3.')).ok, true);
    await setPlace('halls', H.inactive, { is_active: false });
    venueId = await newVenue(owner, { deposit_per_person: 2_000, position: VENUE_POINT });
    await setPlace('venues', venueId, { name: `Restaurant ${TOKEN}`, address: `Adresse ${TOKEN} restaurant` });
    await newTable(owner, venueId, 4);
    await newTable(owner, venueId, 6);
    refusedVenue = await newVenue(owner, { validate: false });
    await setPlace('venues', refusedVenue, { ...VENUE_POINT });
    assert.equal((await decideVenue(refusedVenue, 'REFUSER', 'Photos manquantes.')).ok, true);
});

after(async () => {
    await restoreHalls();
    await restoreTables();
});

describe('A — seuls les lieux publics sont sur la carte', () => {
    test('salles : validées avec position seulement', async () => {
        const got = ids(await layer('salles'));
        assert.ok(got.has(H.une), 'salle validée absente');
        assert.ok(got.has(H.deux), 'deuxième salle validée absente');
        assert.ok(got.has(H.autrePartenaire), 'salle d’une autre partenaire validée absente');
        for (const k of ['attente', 'suspendue', 'inactive', 'sansPosition']) assert.ok(!got.has(H[k]), `salle ${k} rendue`);
    });
    test('restaurants : validé rendu, refusé jamais', async () => {
        const got = ids(await layer('restaurants'));
        assert.ok(got.has(venueId), 'établissement validé absent');
        assert.ok(!got.has(refusedVenue), 'établissement refusé rendu');
    });
    test('suspension, retrait, partenaire suspendue : retirés à la lecture suivante, puis rétablis', async () => {
        assert.equal((await decideHall(H.autrePartenaire, 'SUSPENDRE', 'Contrôle de la carte B3.')).ok, true);
        assert.ok(!ids(await layer('salles')).has(H.autrePartenaire), 'salle suspendue encore rendue');
        assert.equal((await decideHall(H.autrePartenaire, 'REACTIVER')).ok, true);
        assert.ok(ids(await layer('salles')).has(H.autrePartenaire), 'salle réactivée absente');
        await setPlace('halls', H.autrePartenaire, { is_active: false });
        assert.ok(!ids(await layer('salles')).has(H.autrePartenaire), 'salle retirée encore rendue');
        await setPlace('halls', H.autrePartenaire, { is_active: true });
        const { error } = await service.from('partners').update({ status: 'SUSPENDU' }).eq('id', other.partnerId);
        assert.equal(error, null, error?.message);
        try {
            assert.ok(!ids(await layer('salles')).has(H.autrePartenaire), 'salle d’une partenaire suspendue encore rendue');
        } finally {
            const back = await service.from('partners').update({ status: 'VALIDE' }).eq('id', other.partnerId);
            assert.equal(back.error, null, back.error?.message);
        }
    });
});

describe('B — aucun champ en trop, rien de la partenaire', () => {
    test('chaque lieu n’a que PUBLIC_PLACE_FIELDS', async () => {
        for (const p of [...await layer('salles'), ...await layer('restaurants')]) {
            assert.deepEqual(Object.keys(p).sort(), [...PUBLIC_PLACE_FIELDS].sort(), `champs du lieu ${p.id}`);
        }
    });
    test('ni nom légal, ni téléphone, ni adresse électronique de la partenaire dans la réponse', async () => {
        const { data: pa } = await service.from('partners').select('company_name, phone, email').eq('id', owner.partnerId).single();
        const text = JSON.stringify([...await layer('salles'), ...await layer('restaurants')]);
        for (const secret of [String(pa!.company_name), String(pa!.phone), String(pa!.email)]) {
            assert.ok(!text.includes(secret), `« ${secret} » dans la réponse`);
        }
    });
    test('restaurant : acompte, places assises, horaires', async () => {
        const v = (await layer('restaurants')).find((p) => p.id === venueId)!;
        assert.equal(v.type, 'restaurant');
        assert.equal(v.price, 2_000);
        assert.equal(v.capacity, 10);
        assert.equal(v.hours?.length, 7);
    });
});

describe('C — position exacte pour tous (décision du client du 25/11)', () => {
    test('salle : son point exact, le même à chaque lecture', async () => {
        const reads = await Promise.all([1, 2, 3].map(async () => (await layer('salles')).find((p) => p.id === H.une)!));
        for (const p of reads) assert.deepEqual({ lat: p.lat, lng: p.lng }, { lat: POINT.latitude, lng: POINT.longitude });
        const two = (await layer('salles')).find((p) => p.id === H.deux)!;
        assert.deepEqual({ lat: two.lat, lng: two.lng }, { lat: OTHER_POINT.latitude, lng: OTHER_POINT.longitude });
    });
    test('établissement : son point exact', async () => {
        const v = (await layer('restaurants')).find((p) => p.id === venueId)!;
        assert.deepEqual({ lat: v.lat, lng: v.lng }, { lat: VENUE_POINT.latitude, lng: VENUE_POINT.longitude });
    });
    test('position déplacée : rendue telle quelle à la lecture suivante', async () => {
        const moved = { latitude: 14.75111, longitude: -17.40222 };
        await setPlace('halls', H.une, moved);
        try {
            const p = (await layer('salles')).find((x) => x.id === H.une)!;
            assert.deepEqual({ lat: p.lat, lng: p.lng }, { lat: moved.latitude, lng: moved.longitude });
        } finally {
            await setPlace('halls', H.une, POINT);
        }
    });
});

describe('D — route publique', () => {
    test('paramètres illisibles : 400', async () => {
        for (const q of ['', 'couche=tout', 'couche=salles&zone=abc', 'couche=salles&date=2026-13-40', 'couche=restaurants&heure=20:10', 'couche=restaurants&personnes=0']) {
            const r = await route(q);
            assert.equal(r.status, 400, `${q} : HTTP ${r.status}`);
        }
    });
    test('couche d’un service fermé : 404', async () => {
        const before0 = await platformSetting('features.halls_enabled');
        await setPlatformSetting('features.halls_enabled', false, 'test de la carte B3');
        try {
            const r = await route('couche=salles');
            assert.equal(r.status, 404, JSON.stringify(r.body));
        } finally {
            await setPlatformSetting('features.halls_enabled', before0, 'test de la carte B3');
        }
    });
});

describe('E — disponibilité', () => {
    test('salle réservée ce jour-là : absente de la couche filtrée sur la date, présente un autre jour', async () => {
        const date = new Date(Date.now() + 80 * 86_400_000).toISOString().slice(0, 10);
        const res = await reserveHall(alice, H.deux, { startDate: date });
        assert.equal(res.ok, true, JSON.stringify(res));
        const q = parsePlacesQuery(new URLSearchParams(`couche=salles&date=${date}`));
        assert.ok(q.ok);
        const free = await availablePlaceIds(q.query);
        assert.ok(!free.has(H.deux), 'salle prise rendue disponible');
        assert.ok(free.has(H.une), 'salle libre absente');
    });
});
