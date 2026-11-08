/**
 * Lot 9, tâche 9.1 (contrat 4.2, 5.2 ; A28, L18, L19, X7) — ce que GET /api/events gagne pour que les écrans passent
 * par le serveur. Fichier neuf (X7) : decouverte-recherche.test.ts garde ses assertions et ses lignes.
 *  1. `q` cherche aussi la ville (sinon régression : le navigateur la cherchait) ; `q` limité à 120 caractères ;
 *  2. `city` normalisée (`trim().toUpperCase()`) ; `all` en minuscules : pas de filtre ;
 *  3. `cities` : distinctes, triées, calculées AVANT les filtres, sans les événements non publics.
 * Les événements portent des marques propres à la suite : chaque comparaison ne lit que ses lignes.
 *
 * Rouge avant correctif : `q` ne lit pas la ville, `city` compare sans normaliser, `cities` n'existe pas ;
 * après les tests, assertLot9Invariants reste rouge tant que M2 et M4 ne sont pas livrés. Cas déjà vert, signalé au
 * commit : le passage du middleware (préfixe public /api/events, rappel A41).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { GET as eventsRoute } from '../../app/api/events/route';
import { assertLot9Invariants } from '../helpers/lot9-invariants';
import { callMiddleware } from '../helpers/middleware';
import { createPartnerEvent, newPartner, type TestPartner } from './finance-helpers';
import { BASE_URL } from './helpers';
import { createSaleEvent, service } from './paiement-helpers';

interface CatalogReply { events: Array<Record<string, unknown>>; cities: unknown }

const MARK = randomUUID().replace(/-/g, '').slice(0, 10).toLowerCase();
const CITY_A = `Villea${MARK}`;
const CITY_B = `Villeb${MARK}`;
const CITY_DRAFT = `Villec${MARK}`;
const LONG_VENUE = `salle${MARK}${'y'.repeat(105)}`;

let partner: TestPartner;
let idA: string;
let idLong: string;
let idB: string;

async function publicEvent(label: string, city: string, location = 'Salle de test'): Promise<string> {
    const { eventId } = await createPartnerEvent(partner.partnerId, label, [{ name: 'Standard', price: 2000, total: 10 }]);
    const { error } = await service.from('events').update({ city, location }).eq('id', eventId);
    assert.equal(error, null, `événement ${label} : ${error?.message}`);
    return eventId;
}

before(async () => {
    assert.equal(LONG_VENUE.length, 120, 'précondition : lieu de 120 caractères');
    partner = await newPartner(`rech-lot9-${MARK.slice(0, 6)}`);
    idA = await publicEvent('recherche-lot9-a', CITY_A);
    idLong = await publicEvent('recherche-lot9-long', CITY_A, LONG_VENUE);
    idB = await publicEvent('recherche-lot9-b', CITY_B);
    const draft = await createSaleEvent(`recherche-lot9-${MARK}`, [{ name: 'Standard', price: 2000, total: 10 }], { status: 'BROUILLON' });
    const { error } = await service.from('events').update({ city: CITY_DRAFT }).eq('id', draft.eventId);
    assert.equal(error, null, `brouillon : ${error?.message}`);
});

after(async () => {
    await assertLot9Invariants('decouverte-recherche-lot9');
});

async function search(params: Record<string, string> = {}): Promise<CatalogReply> {
    const query = new URLSearchParams(params).toString();
    const res = await eventsRoute(new NextRequest(`${BASE_URL}/api/events${query ? `?${query}` : ''}`));
    const body = await res.json() as Partial<CatalogReply>;
    assert.equal(res.status, 200, JSON.stringify(body).slice(0, 400));
    assert.ok(Array.isArray(body.events), `liste absente : ${JSON.stringify(body).slice(0, 400)}`);
    return { events: body.events, cities: body.cities };
}

/** Identifiants trouvés parmi les événements de la suite, triés. */
function own(reply: CatalogReply): string[] {
    return reply.events.map((e) => String(e.id)).filter((id) => [idA, idLong, idB].includes(id)).sort();
}

const sorted = (...ids: string[]): string[] => [...ids].sort();

/** `cities` de la réponse : tableau de chaînes en capitales, sans doublon. */
function citiesOf(reply: CatalogReply, what: string): string[] {
    assert.ok(Array.isArray(reply.cities), `${what} : cities absent de la réponse (contrat 4.2) : ${JSON.stringify(reply.cities)}`);
    const list = reply.cities as unknown[];
    assert.ok(list.every((c) => typeof c === 'string'), `${what} : cities n’est pas une liste de chaînes`);
    const names = list as string[];
    assert.deepEqual(Array.from(new Set(names)), names, `${what} : cities contient un doublon`);
    return names;
}

describe('A28 — `q` cherche aussi la ville', () => {
    test('par ville, sans tenir compte de la casse', async () => {
        assert.deepEqual(own(await search({ q: CITY_A })), sorted(idA, idLong));
        assert.deepEqual(own(await search({ q: CITY_B.toUpperCase() })), [idB]);
    });

    test('`q` est limité à 120 caractères : ce qui dépasse n’empêche pas la recherche', async () => {
        assert.deepEqual(own(await search({ q: `${LONG_VENUE}zzzz` })), [idLong]);
    });
});

describe('A28 — `city` normalisée', () => {
    test('en minuscules et avec des espaces autour', async () => {
        assert.deepEqual(own(await search({ city: CITY_A.toLowerCase() })), sorted(idA, idLong));
        assert.deepEqual(own(await search({ city: `  ${CITY_B.toLowerCase()} ` })), [idB]);
    });

    test('`all` en minuscules : pas de filtre', async () => {
        assert.deepEqual(own(await search({ city: 'all' })), sorted(idA, idLong, idB));
    });
});

describe('L19 — `cities` calculé avant les filtres', () => {
    test('sans filtre : les villes publiques en capitales, sans doublon, triées, sans le brouillon', async () => {
        const reply = await search();
        assert.deepEqual(own(reply), sorted(idA, idLong, idB), 'sans paramètre, events est inchangé');
        const cities = citiesOf(reply, 'sans filtre');
        const a = CITY_A.toUpperCase();
        const b = CITY_B.toUpperCase();
        assert.ok(cities.includes(a) && cities.includes(b), `villes de la suite absentes : ${JSON.stringify(cities.filter((c) => c.includes(MARK.toUpperCase())))}`);
        assert.ok(cities.indexOf(a) < cities.indexOf(b), 'villes triées');
        assert.ok(!cities.includes(CITY_DRAFT.toUpperCase()), 'la ville d’un événement non public n’est pas proposée');
    });

    test('`cities` reste complet malgré un filtre de ville, de texte, ou une recherche vide', async () => {
        const cases: Array<[string, Record<string, string>]> = [
            ['ville A', { city: CITY_A }],
            ['texte de la ville B', { q: CITY_B }],
            ['recherche sans résultat', { q: `introuvablex${MARK}` }],
        ];
        for (const [what, params] of cases) {
            const cities = citiesOf(await search(params), what);
            assert.ok(cities.includes(CITY_A.toUpperCase()), `${what} : ville A absente`);
            assert.ok(cities.includes(CITY_B.toUpperCase()), `${what} : ville B absente`);
        }
    });
});

describe('Rappel A41 — route publique à travers le middleware', () => {
    test('un visiteur sans session passe le middleware avec q et city (déjà vrai, garde-fou)', async () => {
        const result = await callMiddleware('/api/events?q=dakar&city=dakar', []);
        assert.equal(result.passedThrough, true, JSON.stringify(result));
        assert.equal(result.status, 200);
    });
});
