/**
 * Lot Carte B (B0) — règles pures de la lecture publique de la carte et du calendrier (sans base) :
 *  - toMapEntry : PUBLIE seulement, position présente et au Sénégal, fin à venir ; prix d'appel sur les catégories
 *    achetables en ligne ; couleur et image floutée validées ; mise en avant reprise telle quelle ;
 *  - selectMapEvents : zone, période (au moins en partie), filtres de l'Explorer (gratuit, catégorie, date, recherche,
 *    ville), limite de 300 (truncated), champs publics SEULEMENT (une entrée qui porterait davantage ne le fait pas sortir) ;
 *  - parseMapQuery : zone et période illisibles refusées, zone ramenée au Sénégal, période de 93 jours au plus ;
 *  - libellé de la pastille : « Gratuit », « Dès 5 000 F », rien sans prix ;
 *  - lectures du code : requête PUBLIE et position non nulle, cache étiqueté `catalogue-public`, route sans session.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseMapQuery, publicOnly, selectMapEvents, toMapEntry, type MapEntry, type MapQuery, type MapRow } from '../../lib/events/map-data';
import { MAP_RESULT_LIMIT, PUBLIC_MAP_FIELDS, SENEGAL_BOUNDS, priceBadge, QUICK_PLACES, type PublicMapEvent } from '../../lib/events/map-shared';
import type { CatalogCategoryRow } from '../../lib/events/catalog.server';

const ROOT = process.cwd();
const code = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');

const NOW = Date.parse('2026-11-25T12:00:00Z');
const BLUR = 'data:image/webp;base64,UklGRhIAAABXRUJQVlA4TAYAAAAvAAAAAAfQ//73v/+BiOh/AAA=';

function cat(price: number, extra: Partial<CatalogCategoryRow> = {}): CatalogCategoryRow {
    return { price, is_active: true, sale_online: true, sale_counter: false, total_quantity: 50, sold_quantity: 0, held_quantity: 0, sale_start: null, sale_end: null, ...extra };
}

function row(extra: Partial<MapRow> = {}): MapRow {
    return {
        id: '11111111-1111-4111-8111-111111111111', title: 'Concert', status: 'PUBLIE', category: 'CONCERT', location: 'Corniche',
        city: 'Dakar', start_date: '2026-11-28', start_time: '20:00:00', end_date: '2026-11-28', end_time: '23:00:00',
        latitude: 14.69, longitude: -17.45, poster_color: '#14213d', poster_blur: BLUR,
        partners: { company_name: 'Société Secrète SARL', commercial_name: 'Secret Prod' } as { commercial_name: string | null }, /* carte B3 (T2) : raison sociale gardée pour le contrôle de fuite, plus lue */ ticket_categories: [cat(5000)], ...extra,
    };
}

function q(raw = ''): MapQuery {
    const r = parseMapQuery(new URLSearchParams(raw));
    assert.ok(r.ok, raw);
    return r.query;
}

describe('toMapEntry : ce qui peut être rendu', () => {
    test('seul PUBLIE est rendu : brouillon, en attente, validé, suspendu, annulé, terminé, refusé jamais', () => {
        assert.ok(toMapEntry(row(), null, NOW));
        for (const status of ['BROUILLON', 'EN_ATTENTE', 'VALIDE', 'SUSPENDU', 'ANNULE', 'TERMINE', 'REFUSE', 'publie', '']) {
            assert.equal(toMapEntry(row({ status }), null, NOW), null, status);
        }
    });

    test('sans position, position incomplète, illisible ou hors du Sénégal : jamais rendu', () => {
        for (const pos of [
            { latitude: null, longitude: null }, { latitude: 14.69, longitude: null }, { latitude: null, longitude: -17.45 },
            { latitude: 'abc', longitude: -17.45 }, { latitude: 48.85, longitude: 2.35 }, { latitude: 12.1, longitude: -16 },
            { latitude: 14.5, longitude: -11.2 }, { latitude: '', longitude: '' },
        ] as Array<Pick<MapRow, 'latitude' | 'longitude'>>) {
            assert.equal(toMapEntry(row(pos), null, NOW), null, JSON.stringify(pos));
        }
        // Bornes comprises, valeurs texte de PostgREST acceptées
        assert.ok(toMapEntry(row({ latitude: SENEGAL_BOUNDS.south, longitude: SENEGAL_BOUNDS.west }), null, NOW));
        assert.ok(toMapEntry(row({ latitude: '14.7', longitude: '-17.4' }), null, NOW));
    });

    test('terminé (fin passée) jamais rendu ; en cours rendu', () => {
        assert.equal(toMapEntry(row({ start_date: '2026-11-24', end_date: '2026-11-24' }), null, NOW), null, 'fini la veille');
        assert.ok(toMapEntry(row({ start_date: '2026-11-25', start_time: '10:00:00', end_date: '2026-11-25', end_time: '18:00:00' }), null, NOW), 'en cours');
    });

    test('prix d’appel : catégories achetables en ligne seulement ; 0 = gratuit ; rien d’achetable = null', () => {
        assert.equal(toMapEntry(row({ ticket_categories: [cat(5000), cat(3000)] }), null, NOW)?.pub.price, 3000);
        assert.equal(toMapEntry(row({ ticket_categories: [cat(0), cat(3000)] }), null, NOW)?.pub.price, 0);
        assert.equal(toMapEntry(row({ ticket_categories: [cat(1000, { is_active: false }), cat(4000)] }), null, NOW)?.pub.price, 4000, 'vente arrêtée ignorée');
        assert.equal(toMapEntry(row({ ticket_categories: [cat(1000, { sale_online: false })] }), null, NOW)?.pub.price, null, 'guichet seulement');
        assert.equal(toMapEntry(row({ ticket_categories: [cat(1000, { sold_quantity: 50 })] }), null, NOW)?.pub.price, null, 'complet');
        assert.equal(toMapEntry(row({ ticket_categories: [cat(1000, { sale_end: '2026-11-20T00:00:00Z' })] }), null, NOW)?.pub.price, null, 'vente close');
        assert.equal(toMapEntry(row({ ticket_categories: [] }), null, NOW)?.pub.price, null);
    });

    test('couleur et image floutée validées ; mise en avant reprise', () => {
        const e = toMapEntry(row({ poster_color: '#ffffff', poster_blur: 'javascript:alert(1)' }), 'A_LA_UNE', NOW);
        assert.equal(e?.pub.color, '#14213d', 'couleur trop claire : repli');
        assert.equal(e?.pub.blur, null, 'image floutée invalide : aucune');
        assert.equal(e?.pub.highlight, 'A_LA_UNE');
        assert.equal(toMapEntry(row(), null, NOW)?.pub.blur, BLUR);
    });
});

describe('selectMapEvents : ce qui sort', () => {
    const entries = (rows: MapRow[]): MapEntry[] => rows.map((r) => toMapEntry(r, null, NOW)).filter((e): e is MapEntry => e !== null);

    test('champs publics seulement, même si l’entrée en porte davantage ; ni partenaire ni lieu', () => {
        const [entry] = entries([row()]);
        const polluted = { ...entry, pub: { ...entry.pub, partner: 'Secret Prod', phone: '+221770000000' } as unknown as PublicMapEvent };
        const out = selectMapEvents([polluted], q(), new Date(NOW));
        assert.equal(out.events.length, 1);
        assert.deepEqual(Object.keys(out.events[0]).sort(), [...PUBLIC_MAP_FIELDS].sort());
        const body = JSON.stringify(out);
        for (const secret of ['Secret Prod', 'Société Secrète', 'Corniche', '+221', 'CONCERT', 'DAKAR']) assert.ok(!body.includes(secret), secret);
        assert.deepEqual(Object.keys(publicOnly(polluted.pub)).sort(), [...PUBLIC_MAP_FIELDS].sort());
    });

    test('zone : dans la zone seulement ; zone ramenée aux bornes du Sénégal', () => {
        const list = entries([row({ id: 'a', latitude: 14.69, longitude: -17.45 }), row({ id: 'b', latitude: 16.02, longitude: -16.49 })]);
        assert.deepEqual(selectMapEvents(list, q('zone=14.5,-17.6,14.9,-17.2'), new Date(NOW)).events.map((e) => e.id), ['a']);
        assert.deepEqual(selectMapEvents(list, q(), new Date(NOW)).events.map((e) => e.id), ['a', 'b']);
        assert.deepEqual(q('zone=-80,-170,80,170').zone, { ...SENEGAL_BOUNDS });
    });

    test('période : au moins en partie dans [du, au[ ; filtres de l’Explorer', () => {
        const list = entries([
            row({ id: 'a', start_date: '2026-11-28', end_date: '2026-11-28', ticket_categories: [cat(0)] }),
            row({ id: 'b', start_date: '2026-12-05', end_date: '2026-12-05', category: 'FESTIVAL', title: 'Festival du fleuve' }),
        ]);
        assert.deepEqual(selectMapEvents(list, q('du=2026-11-28&au=2026-11-29'), new Date(NOW)).events.map((e) => e.id), ['a']);
        assert.deepEqual(selectMapEvents(list, q('du=2026-12-01&au=2027-01-01'), new Date(NOW)).events.map((e) => e.id), ['b']);
        assert.deepEqual(selectMapEvents(list, q('gratuit=1'), new Date(NOW)).events.map((e) => e.id), ['a']);
        assert.deepEqual(selectMapEvents(list, q('categorie=FESTIVAL'), new Date(NOW)).events.map((e) => e.id), ['b']);
        assert.deepEqual(selectMapEvents(list, q('q=fleuve'), new Date(NOW)).events.map((e) => e.id), ['b']);
        assert.deepEqual(selectMapEvents(list, q('q=secret'), new Date(NOW)).events.map((e) => e.id), ['a', 'b'], 'recherche sur l’organisateur, comme la liste');
        assert.deepEqual(selectMapEvents(list, q('ville=Thies'), new Date(NOW)).events.map((e) => e.id), []);
    });

    test('limite : 300 au plus, total et truncated', () => {
        const many = entries(Array.from({ length: MAP_RESULT_LIMIT + 5 }, (_, i) => row({ id: `id-${i}` })));
        const out = selectMapEvents(many, q(), new Date(NOW));
        assert.equal(out.events.length, MAP_RESULT_LIMIT);
        assert.equal(out.total, MAP_RESULT_LIMIT + 5);
        assert.equal(out.truncated, true);
    });

    test('fini depuis la lecture (cache) : retiré à chaque appel', () => {
        const list = entries([row({ start_date: '2026-11-25', start_time: '10:00:00', end_date: '2026-11-25', end_time: '13:00:00' })]);
        assert.equal(selectMapEvents(list, q(), new Date(NOW)).events.length, 1);
        assert.equal(selectMapEvents(list, q(), new Date(Date.parse('2026-11-25T13:00:01Z'))).events.length, 0);
    });
});

describe('parseMapQuery : paramètres illisibles refusés', () => {
    test('zone', () => {
        for (const zone of ['1,2,3', 'a,b,c,d', '14,-17,13,-16', '14,-16,15,-17', '91,0,92,1', '14;-17;15;-16', '1e3,0,2,1', '14.123456789,-17,15,-16']) {
            assert.equal(parseMapQuery(new URLSearchParams({ zone })).ok, false, zone);
        }
    });

    test('période : deux dates valides, au après du, 93 jours au plus', () => {
        for (const raw of ['du=2026-11-01', 'au=2026-11-02', 'du=2026-02-30&au=2026-03-02', 'du=2026-11-02&au=2026-11-02', 'du=2026-01-01&au=2026-06-01', 'du=hier&au=demain']) {
            assert.equal(parseMapQuery(new URLSearchParams(raw)).ok, false, raw);
        }
        assert.equal(parseMapQuery(new URLSearchParams('du=2026-11-01&au=2027-02-02')).ok, true, '93 jours');
    });
});

describe('pastille de prix et choix rapide', () => {
    test('« Gratuit », « Dès 5 000 F », rien sans prix', () => {
        assert.equal(priceBadge(0), 'Gratuit');
        assert.equal(priceBadge(5000)?.replace(/\s/g, ' '), 'Dès 5 000 F', 'espace insécable du français');
        assert.equal(priceBadge(null), null);
    });

    test('villes et quartiers de la décision du 21/11, tous au Sénégal', () => {
        const labels = QUICK_PLACES.map((p) => p.label);
        for (const l of ['Dakar', 'Almadies', 'Plateau', 'Ngor', 'Ouakam', 'Mermoz', 'Sacré-Cœur', 'Saly', 'Thiès', 'Saint-Louis']) assert.ok(labels.includes(l), l);
        for (const p of QUICK_PLACES) {
            assert.ok(p.lat >= SENEGAL_BOUNDS.south && p.lat <= SENEGAL_BOUNDS.north && p.lng >= SENEGAL_BOUNDS.west && p.lng <= SENEGAL_BOUNDS.east, p.label);
        }
    });
});

describe('lectures du code', () => {
    test('requête : PUBLIE et position non nulle exigés par la base ; cache étiqueté catalogue-public', () => {
        const src = code('lib/events/map-data.server.ts');
        assert.match(src, /\.eq\('status', 'PUBLIE'\)/);
        assert.match(src, /\.not\('latitude', 'is', null\)/);
        assert.match(src, /\.not\('longitude', 'is', null\)/);
        assert.match(src, /unstable_cache\(readMapEntries,[^\n]*tags:\s*\['catalogue-public'\]/);
        assert.doesNotMatch(src, /description|phone|email|user_id|partner_id/, 'aucune colonne de contact ni identifiant de partenaire lu');
    });

    test('route : sans session, réponse no-store, sortie par selectMapEvents', () => {
        const src = code('app/api/events/carte/route.ts');
        assert.doesNotMatch(src, /requireActiveSession|cookies\(|getUser|auth\./);
        assert.match(src, /selectMapEvents\(await cachedMapEntries\(\), parsed\.query, new Date\(\)\)/);
        assert.match(src, /'Cache-Control': 'no-store'/);
        assert.doesNotMatch(src, /export async function (POST|PUT|PATCH|DELETE)/, 'lecture seule');
    });
});
