/**
 * Lot Carte B3 — salles et établissements sur la carte d'Explorer, sur la base locale (lecture réelle : readPlaceEntries,
 * celle que la route met en cache, puis selectPlaces, celle que la route rend) :
 *  A. rendus : lieux actifs, validés, d'une partenaire VALIDE, avec une position ; jamais : en attente, refusé,
 *     suspendu, retiré (inactif), partenaire suspendue, sans position ; une suspension, un retrait ou une suspension de
 *     la partenaire les retirent à la lecture suivante (le passage à travers le cache, en moins de 5 s, est prouvé de
 *     bout en bout par e2e/carte-b3.responsive.spec.ts) ;
 *  B. aucun champ en trop (PUBLIC_PLACE_FIELDS) ; ni adresse, ni nom, téléphone ou adresse électronique de la partenaire ;
 *  C. zone d'un particulier : même centre d'une lecture à l'autre ; écart au vrai point jamais nul, toujours sous 300 m
 *     (80 à 220 m) ; le vrai point n'apparaît nulle part ; une écriture directe de la zone est ignorée ; une nouvelle
 *     position tire une nouvelle zone autour d'elle ; un lieu professionnel montre son point exact ;
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
const PRO_POINT = { latitude: 14.69321, longitude: -17.44123 };
const VENUE_POINT = { latitude: 14.73456, longitude: -17.49876 };

function metres(a: { lat: number; lng: number }, b: { latitude: number; longitude: number }): number {
    const dy = (a.lat - b.latitude) * 111_320;
    const dx = (a.lng - b.longitude) * 111_320 * Math.cos((b.latitude * Math.PI) / 180);
    return Math.hypot(dx, dy);
}

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
    for (const key of ['particulier', 'pro', 'attente', 'suspendue', 'inactive', 'sansPosition', 'autrePartenaire']) {
        const id = await newHall(key === 'autrePartenaire' ? other : owner, { validate: false });
        H[key] = id;
        const point = key === 'pro' ? PRO_POINT : key === 'sansPosition' ? { latitude: null, longitude: null } : POINT;
        await setPlace('halls', id, { ...point, name: `Salle ${TOKEN} ${key}`, address: `Adresse secrète ${TOKEN} ${key}`, ...(key === 'pro' ? { host_kind: 'PROFESSIONNEL' } : {}) });
        if (key !== 'attente') {
            const d = await decideHall(id, 'VALIDER');
            assert.equal(d.ok, true, JSON.stringify(d));
        }
    }
    assert.equal((await decideHall(H.suspendue, 'SUSPENDRE', 'Contrôle de la carte B3.')).ok, true);
    await setPlace('halls', H.inactive, { is_active: false });
    venueId = await newVenue(owner, { deposit_per_person: 2_000 });
    await setPlace('venues', venueId, { ...VENUE_POINT, name: `Restaurant ${TOKEN}`, address: `Adresse secrète ${TOKEN} restaurant` });
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
        assert.ok(got.has(H.particulier), 'salle de particulier validée absente');
        assert.ok(got.has(H.pro), 'salle professionnelle validée absente');
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

describe('B — aucun champ en trop, rien de la partenaire, jamais d’adresse', () => {
    test('chaque lieu n’a que PUBLIC_PLACE_FIELDS', async () => {
        for (const p of [...await layer('salles'), ...await layer('restaurants')]) {
            assert.deepEqual(Object.keys(p).sort(), [...PUBLIC_PLACE_FIELDS].sort(), `champs du lieu ${p.id}`);
        }
    });
    test('ni adresse ni coordonnées de la partenaire dans la réponse', async () => {
        const { data: pa } = await service.from('partners').select('company_name, phone, email').eq('id', owner.partnerId).single();
        const text = JSON.stringify([...await layer('salles'), ...await layer('restaurants')]);
        for (const secret of [`Adresse secrète ${TOKEN}`, String(pa!.company_name), String(pa!.phone), String(pa!.email)]) {
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

describe('C — zone d’un particulier : fixe, autour du vrai point, jamais lui', () => {
    test('même centre à chaque lecture ; écart entre 0 et 300 m (80 à 220 m) ; vrai point absent', async () => {
        const reads = await Promise.all([1, 2, 3, 4, 5].map(async () => (await layer('salles')).find((p) => p.id === H.particulier)!));
        const centres = new Set(reads.map((p) => `${p.lat},${p.lng}`));
        assert.equal(centres.size, 1, `centre différent d’une lecture à l’autre : ${[...centres].join(' | ')}`);
        const p = reads[0];
        assert.equal(p.exact, false);
        const d = metres(p, POINT);
        assert.ok(d > 0 && d < 300, `écart au vrai point : ${d.toFixed(1)} m`);
        assert.ok(d >= 79 && d <= 221, `écart hors de 80 à 220 m : ${d.toFixed(1)} m`);
        const text = JSON.stringify(await layer('salles'));
        assert.ok(!text.includes(String(POINT.latitude)) && !text.includes(String(POINT.longitude)), 'vrai point dans la réponse');
    });
    test('établissement de particulier : zone aussi', async () => {
        const v = (await layer('restaurants')).find((p) => p.id === venueId)!;
        assert.equal(v.exact, false);
        const d = metres(v, VENUE_POINT);
        assert.ok(d >= 79 && d <= 221, `écart : ${d.toFixed(1)} m`);
    });
    test('lieu professionnel : point exact', async () => {
        const p = (await layer('salles')).find((x) => x.id === H.pro)!;
        assert.equal(p.exact, true);
        assert.deepEqual({ lat: p.lat, lng: p.lng }, { lat: PRO_POINT.latitude, lng: PRO_POINT.longitude });
    });
    test('écriture directe de la zone ignorée ; autre champ modifié : même zone', async () => {
        const before0 = (await service.from('halls').select('zone_latitude, zone_longitude').eq('id', H.particulier).single()).data!;
        await setPlace('halls', H.particulier, { zone_latitude: POINT.latitude, zone_longitude: POINT.longitude, capacity: 321 });
        const after0 = (await service.from('halls').select('zone_latitude, zone_longitude, capacity').eq('id', H.particulier).single()).data!;
        assert.equal(after0.capacity, 321);
        assert.deepEqual({ a: after0.zone_latitude, b: after0.zone_longitude }, { a: before0.zone_latitude, b: before0.zone_longitude }, 'zone réécrite');
    });
    test('nouvelle position : nouvelle zone autour d’elle', async () => {
        const moved = { latitude: 14.75111, longitude: -17.40222 };
        await setPlace('halls', H.particulier, moved);
        const p = (await layer('salles')).find((x) => x.id === H.particulier)!;
        const d = metres(p, moved);
        assert.ok(d >= 79 && d <= 221, `écart à la nouvelle position : ${d.toFixed(1)} m`);
        await setPlace('halls', H.particulier, POINT);
    });
    test('les 200 tirages de la base restent entre 80 et 220 m', async () => {
        for (let i = 0; i < 200; i += 1) {
            const { data, error } = await service.rpc('place_zone_center', { p_lat: POINT.latitude, p_lng: POINT.longitude });
            assert.equal(error, null, error?.message);
            const [lat, lng] = data as number[];
            const d = metres({ lat, lng }, POINT);
            assert.ok(d >= 79 && d <= 221, `tirage ${i} : ${d.toFixed(1)} m`);
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
        const res = await reserveHall(alice, H.pro, { startDate: date });
        assert.equal(res.ok, true, JSON.stringify(res));
        const q = parsePlacesQuery(new URLSearchParams(`couche=salles&date=${date}`));
        assert.ok(q.ok);
        const free = await availablePlaceIds(q.query);
        assert.ok(!free.has(H.pro), 'salle prise rendue disponible');
        assert.ok(free.has(H.particulier), 'salle libre absente');
    });
});
