/**
 * Design 1b (lot CATALOGUE, point 5) — GET /api/events avec les filtres de l'Explorer, sur la base (CI seulement).
 * Mêmes règles que la page serveur (lib/events/catalog-filters.ts, testées sans base dans tests/schema/design1b-catalogue) :
 *  - `quand` (aujourdhui | weekend | semaine) : la route rend exactement les événements de la suite dont le début et la fin
 *    retenue servis par la carte recoupent la plage du filtre (calendrier vérifié hors base) ; valeur inconnue ignorée ;
 *  - `gratuit=1` : au moins une catégorie gratuite achetable ; `paidFrom` = plus petit prix payant (« Gratuit ou dès … ») ;
 *  - `categorie` et `ville` (noms de l'Explorer) comme `category` et `city` ; `tri=prix` ; `total` ;
 *  - `page` et `pageSize` : découpage et total ; sans `page`, tous les résultats (écrans existants) ;
 *  - la carte porte `startsAt`, `endsAt`, `paidFrom`, jamais un nombre de places.
 * Isolement : une ville propre à la suite (aucun autre événement ne la porte).
 */
import '../helpers/env';
import { before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { GET as eventsRoute } from '../../app/api/events/route';
import { matchesWhen, type CatalogWhen } from '../../lib/events/catalog-filters';
import { shiftEventDates } from './cycle-helpers';
import { createPartnerEvent, newPartner, type TestPartner } from './finance-helpers';
import { BASE_URL } from './helpers';
import { service, type CategorySpec } from './paiement-helpers';

type Card = Record<string, unknown> & { id: string; startsAt: string; endsAt: string };
interface Reply { events: Card[]; cities: unknown; total?: unknown; page?: unknown; pageSize?: unknown }

const MARK = randomUUID().replace(/-/g, '').slice(0, 10).toLowerCase();
const CITY = `Villed1b${MARK}`;

let partner: TestPartner;
const ids: Record<string, string> = {};

async function event(key: string, categories: CategorySpec[], startsInHours: number, category: 'CONCERT' | 'FESTIVAL' | 'FOOD'): Promise<void> {
    const { eventId } = await createPartnerEvent(partner.partnerId, `d1b-${key}`, categories, { daysFromNow: 2 });
    await shiftEventDates(eventId, { startsInHours, durationHours: 3 });
    const { error } = await service.from('events').update({ city: CITY, category }).eq('id', eventId);
    assert.equal(error, null, `événement ${key} : ${error?.message}`);
    ids[key] = eventId;
}

async function search(params: Record<string, string>): Promise<Reply> {
    const query = new URLSearchParams(params).toString();
    const res = await eventsRoute(new NextRequest(`${BASE_URL}/api/events?${query}`));
    const body = await res.json() as Reply;
    assert.equal(res.status, 200, JSON.stringify(body).slice(0, 400));
    assert.equal(res.headers.get('cache-control'), 'no-store', 'réponse jamais mise en cache (temps réel des écrans)');
    assert.ok(Array.isArray(body.events), `liste absente : ${JSON.stringify(body).slice(0, 400)}`);
    return body;
}

const keyOf = (id: string): string => Object.keys(ids).find((k) => ids[k] === id) ?? id;
const keys = (r: Reply): string[] => r.events.map((e) => keyOf(String(e.id)));

before(async () => {
    partner = await newPartner(`d1b-cat-${MARK.slice(0, 6)}`);
    await event('bientot', [{ name: 'Standard', price: 5_000, total: 20 }], 1, 'CONCERT');
    await event('mixte', [{ name: 'Libre', price: 0, total: 20 }, { name: 'VIP', price: 3_000, total: 20 }], 30, 'FESTIVAL');
    await event('libre', [{ name: 'Libre', price: 0, total: 20 }], 100, 'CONCERT');
    await event('loin', [{ name: 'Standard', price: 8_000, total: 20 }], 200, 'FOOD');
});

describe('design 1b — GET /api/events : filtres de l’Explorer', () => {
    test('sans autre filtre que la ville : les quatre, dans l’ordre des dates, avec le total', async () => {
        const r = await search({ city: CITY });
        assert.deepEqual(keys(r), ['bientot', 'mixte', 'libre', 'loin']);
        assert.equal(r.total, 4);
        assert.equal(r.page, undefined, 'sans `page` : tous les résultats, sans découpage');
    });

    test('carte : début, fin retenue, plus petit prix payant ; aucun nombre de places', async () => {
        const r = await search({ city: CITY });
        const mixte = r.events.find((e) => e.id === ids.mixte)!;
        assert.equal(mixte.price, 0);
        assert.equal(mixte.paidFrom, 3_000, '« Gratuit ou dès 3 000 F CFA »');
        assert.equal(r.events.find((e) => e.id === ids.libre)!.paidFrom, null, 'gratuit seulement');
        assert.equal(r.events.find((e) => e.id === ids.bientot)!.paidFrom, 5_000);
        for (const e of r.events) {
            assert.ok(Number.isFinite(Date.parse(e.startsAt)) && Date.parse(e.endsAt) > Date.parse(e.startsAt), `instants de ${keyOf(e.id)}`);
            assert.equal(Date.parse(e.endsAt) - Date.parse(e.startsAt), 3 * 3_600_000, 'fin saisie : début + 3 h');
            assert.doesNotMatch(JSON.stringify(e), /quantity|remaining/i, 'aucun nombre de places');
        }
    });

    test('gratuit=1 : seulement ceux qui ont une catégorie gratuite achetable', async () => {
        assert.deepEqual(keys(await search({ city: CITY, gratuit: '1' })), ['mixte', 'libre']);
    });

    test('quand : exactement les événements dont la plage recoupe celle du filtre ; valeur inconnue ignorée', async () => {
        const all = (await search({ city: CITY })).events;
        for (const quand of ['aujourdhui', 'weekend', 'semaine'] as CatalogWhen[]) {
            const now = new Date();
            const expected = all.filter((e) => matchesWhen(e, quand, now)).map((e) => keyOf(e.id));
            assert.deepEqual(keys(await search({ city: CITY, quand })), expected, `quand=${quand}`);
        }
        assert.ok(keys(await search({ city: CITY, quand: 'semaine' })).includes('bientot'), 'dans une heure : cette semaine');
        assert.ok(!keys(await search({ city: CITY, quand: 'semaine' })).includes('loin'), 'dans 200 heures : hors de la semaine');
        assert.equal((await search({ city: CITY, quand: 'demain' })).events.length, 4);
    });

    test('categorie et ville (noms de l’Explorer) comme category et city', async () => {
        assert.deepEqual(keys(await search({ ville: CITY, categorie: 'CONCERT' })), ['bientot', 'libre']);
        assert.deepEqual(keys(await search({ city: CITY, category: 'CONCERT' })), ['bientot', 'libre']);
    });

    test('tri=prix : gratuits d’abord, puis prix croissant', async () => {
        assert.deepEqual(keys(await search({ city: CITY, tri: 'prix' })), ['mixte', 'libre', 'bientot', 'loin']);
    });

    test('page et pageSize : découpage, total et page dans la réponse', async () => {
        const p1 = await search({ city: CITY, page: '1', pageSize: '3' });
        assert.deepEqual(keys(p1), ['bientot', 'mixte', 'libre']);
        assert.deepEqual([p1.total, p1.page, p1.pageSize], [4, 1, 3]);
        const p2 = await search({ city: CITY, page: '2', pageSize: '3' });
        assert.deepEqual(keys(p2), ['loin']);
        assert.equal((await search({ city: CITY, page: '1' })).pageSize, 12, 'taille par défaut de l’Explorer');
    });
});
