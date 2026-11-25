/**
 * Lot Carte B3 — règles pures et code des écrans de la carte des lieux (sans base) :
 *  - contrat public : copie champ par champ (rien en trop), paramètres bornés, sélection par couche et par zone ;
 *  - « Ouvert maintenant » : plages réunies (minuit, 24 h sur 24), heure de Dakar ;
 *  - « Autour de moi » reste local : la zone envoyée pour les lieux est élargie sur la grille T1 de la carte B ;
 *  - aucune adresse lue par la lecture publique ; aucune nouvelle importation à la demande (un seul chargeur par module :
 *    leçon du lot poids) ; repères distincts par leur forme, texte échappé ; fiches : itinéraire du seul lieu professionnel.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
    openingState, parsePlacesQuery, placeAccessibleName, placePriceBadge, publicPlaceOnly, selectPlaces,
    PUBLIC_PLACE_FIELDS, type OpeningRange, type PublicMapPlace,
} from '../../lib/lieux/carte-lieux';
import { placesUrl, EMPTY_HALL_FILTERS, EMPTY_VENUE_FILTERS } from '../../lib/lieux/carte-lieux-client';
import { publicAddress, publicPosition } from '../../lib/lieux/position-publique';
import { placeMarkerHtml } from '../../components/explore/place-markers';

const read = (rel: string): string => fs.readFileSync(path.resolve(process.cwd(), rel), 'utf8');
/** Code sans les commentaires (les règles portent sur ce qui s'exécute). */
const code = (rel: string): string => read(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const place = (over: Partial<PublicMapPlace> = {}): PublicMapPlace => ({
    id: 'a', type: 'salle', name: 'Salle Teranga', area: 'Thiès', photos: [], price: 150_000, capacity: 300,
    lat: 14.7, lng: -16.9, exact: false, hours: null, ...over,
});

describe('contrat public de la carte des lieux', () => {
    test('copie champ par champ : un champ en trop ne sort jamais', () => {
        const dirty = { ...place(), address: 'Villa secrète', latitude: 1, partner: { phone: '77' } } as unknown as PublicMapPlace;
        assert.deepEqual(Object.keys(publicPlaceOnly(dirty)).sort(), [...PUBLIC_PLACE_FIELDS].sort());
        assert.ok(!JSON.stringify(publicPlaceOnly(dirty)).includes('secrète'));
    });
    test('position publique : centre de la zone pour un particulier, point pour un professionnel ; adresse du seul professionnel', () => {
        const row = { latitude: 14.71357, longitude: -17.46913, zone_latitude: 14.7149, zone_longitude: -17.4702, address: 'Villa' };
        assert.deepEqual(publicPosition({ ...row, host_kind: 'PARTICULIER' }), { lat: 14.7149, lng: -17.4702, exact: false });
        assert.deepEqual(publicPosition({ ...row, host_kind: null }), { lat: 14.7149, lng: -17.4702, exact: false }, 'sans déclaration : particulier');
        assert.deepEqual(publicPosition({ ...row, host_kind: 'PROFESSIONNEL' }), { lat: 14.71357, lng: -17.46913, exact: true });
        assert.equal(publicPosition({ ...row, host_kind: 'PARTICULIER', zone_latitude: null }), null, 'zone absente : rien (jamais le point)');
        assert.equal(publicAddress({ ...row, host_kind: 'PARTICULIER' }), null);
        assert.equal(publicAddress({ ...row, host_kind: 'PROFESSIONNEL' }), 'Villa');
    });
    test('paramètres : couche obligatoire, valeurs bornées', () => {
        for (const bad of ['', 'couche=x', 'couche=salles&zone=1,2,3', 'couche=salles&jours=31', 'couche=salles&invites=0',
            'couche=restaurants&personnes=51', 'couche=restaurants&heure=25:00', 'couche=restaurants&heure=20:05', 'couche=salles&date=2026-02-30']) {
            assert.equal(parsePlacesQuery(new URLSearchParams(bad)).ok, false, bad);
        }
        const ok = parsePlacesQuery(new URLSearchParams('couche=salles&zone=10,-20,20,-10&date=2030-01-02&invites=50'));
        assert.ok(ok.ok);
        assert.deepEqual(ok.ok && ok.query.zone, { south: 12.2, west: -17.6, north: 16.8, east: -11.3 }, 'zone ramenée au Sénégal');
    });
    test('sélection : type de la couche, zone, capacité, disponibilité, 300 au plus', () => {
        const q = parsePlacesQuery(new URLSearchParams('couche=salles&invites=200&zone=14,-17.5,15,-16'));
        assert.ok(q.ok);
        const entries = [place({ id: 'ok' }), place({ id: 'petite', capacity: 100 }), place({ id: 'loin', lat: 16.5 }), place({ id: 'resto', type: 'restaurant' })];
        assert.deepEqual(selectPlaces(entries, q.query, null).places.map((p) => p.id), ['ok']);
        assert.deepEqual(selectPlaces(entries, q.query, new Set()).places.map((p) => p.id), [], 'non disponible');
        const many = Array.from({ length: 320 }, (_, i) => place({ id: String(i) }));
        const all = parsePlacesQuery(new URLSearchParams('couche=salles'));
        assert.ok(all.ok);
        const r = selectPlaces(many, all.query, null);
        assert.equal(r.places.length, 300);
        assert.equal(r.total, 320);
        assert.equal(r.truncated, true);
    });
});

describe('« Ouvert maintenant » (heure de Dakar)', () => {
    const at = (iso: string) => new Date(iso);
    const every = (o: string, c: string): OpeningRange[] => [1, 2, 3, 4, 5, 6, 7].map((d) => [d, o, c]);
    test('24 h sur 24', () => {
        assert.deepEqual(openingState(every('00:00', '24:00'), at('2026-11-25T10:00:00Z')), { open: true, text: 'Ouvert maintenant' });
    });
    test('soirée qui passe minuit', () => {
        assert.deepEqual(openingState(every('19:00', '02:00'), at('2026-11-25T23:30:00Z')), { open: true, text: 'Ouvert maintenant · ferme à 2 h' });
        assert.deepEqual(openingState(every('19:00', '02:00'), at('2026-11-26T01:00:00Z')), { open: true, text: 'Ouvert maintenant · ferme à 2 h' });
        assert.deepEqual(openingState(every('19:00', '02:00'), at('2026-11-25T10:00:00Z')), { open: false, text: 'Fermé · ouvre à 19 h' });
    });
    test('midi et soir (mercredi 25/11/2026)', () => {
        const h: OpeningRange[] = [[3, '12:00', '15:00'], [3, '19:00', '23:30']];
        assert.deepEqual(openingState(h, at('2026-11-25T13:00:00Z')), { open: true, text: 'Ouvert maintenant · ferme à 15 h' });
        assert.deepEqual(openingState(h, at('2026-11-25T16:00:00Z')), { open: false, text: 'Fermé · ouvre à 19 h' });
        assert.deepEqual(openingState(h, at('2026-11-25T20:00:00Z')), { open: true, text: 'Ouvert maintenant · ferme à 23 h 30' });
        assert.deepEqual(openingState(h, at('2026-11-25T23:45:00Z')), { open: false, text: 'Fermé pour aujourd’hui' });
    });
    test('dimanche soir jusqu’au lundi matin', () => {
        assert.deepEqual(openingState([[7, '20:00', '03:00']], at('2026-11-24T01:00:00Z'))?.text, 'Fermé pour aujourd’hui', 'mardi');
        assert.deepEqual(openingState([[7, '20:00', '03:00']], at('2026-11-30T01:00:00Z')), { open: true, text: 'Ouvert maintenant · ferme à 3 h' });
    });
    test('sans horaires : rien', () => {
        assert.equal(openingState(null, new Date()), null);
        assert.equal(openingState([], new Date()), null);
    });
});

describe('« Autour de moi » reste local (règle T1 de la carte B) pour les lieux', () => {
    test('zone envoyée élargie sur la grille de 0,05° : jamais 4 décimales de la position', () => {
        const zone = { south: 14.71234, west: -17.46789, north: 14.73456, east: -17.44321 };
        const url = new URL(placesUrl('salles', zone, { halls: EMPTY_HALL_FILTERS, venues: EMPTY_VENUE_FILTERS }), 'http://x');
        assert.equal(url.searchParams.get('zone'), '14.70,-17.50,14.75,-17.40');
    });
    test('la carte ne lit les lieux que par carte-lieux-client (aucune autre requête)', () => {
        const map = code('components/explore/ExploreMap.tsx');
        assert.ok(!/fetch\(/.test(map));
        assert.match(map, /readPlaces\(hallsUrl\)/);
        assert.match(read('lib/lieux/carte-lieux-client.ts'), /zoneQueryValue\(zone\)/);
    });
});

describe('lecture publique : aucune adresse, rien de la partenaire', () => {
    test('colonnes lues par la carte des lieux', () => {
        const src = code('lib/lieux/carte-lieux.server.ts');
        const selects = [...src.matchAll(/const (HALL|VENUE)_SELECT = ([\s\S]*?);\n/g)].map((m) => m[2]).join(' ');
        assert.ok(selects.length > 0);
        for (const banned of ['address', 'phone', 'email', 'company_name', 'commercial_name', 'description', '*']) {
            assert.ok(!selects.includes(banned), `colonne ${banned} lue`);
        }
        assert.match(src, /publicPosition\(h\)/);
        assert.match(src, /publicPosition\(v\)/);
    });
});

describe('écrans', () => {
    test('aucune importation à la demande de plus (un seul chargeur par module)', () => {
        for (const rel of ['components/explore/ExploreMap.tsx', 'components/explore/MapLayers.tsx', 'components/explore/MapPlaceCard.tsx',
            'components/explore/place-markers.ts', 'lib/lieux/carte-lieux.ts', 'lib/lieux/carte-lieux-client.ts', 'lib/lieux/position-publique.ts']) {
            // Les types de Leaflet (import('leaflet').Map) ne chargent rien
            assert.ok(!/\bimport\((?!'leaflet'\))/.test(code(rel)), `${rel} : import() nouveau`);
        }
        const placeMap = code('components/lieux/PlaceMap.tsx');
        assert.equal((placeMap.match(/\bimport\(/g) ?? []).length, 0, 'PlaceMap passe par loadEventMap');
        assert.match(placeMap, /loadEventMap\(\)/);
        assert.match(read('components/explore/lazy.ts'), /export \{ default as ExploreMap \} from '\.\/ExploreMap';/);
    });
    test('repères : formes distinctes, texte échappé, nom accessible complet', () => {
        const salle = placeMarkerHtml(place({ name: '<b>x</b>' }), false);
        const resto = placeMarkerHtml(place({ type: 'restaurant', name: 'Chez <Awa>', exact: true }), true);
        assert.match(salle, /ev-repere--salle/);
        assert.match(salle, /ev-repere--approx/);
        assert.match(salle, /Dès 150[\s  ]000 F\/jour/);
        assert.match(resto, /ev-repere--resto/);
        assert.match(resto, /ev-repere--choisi/);
        assert.ok(!resto.includes('<Awa>') && resto.includes('&lt;Awa&gt;'));
        assert.ok(!/ev-repere--approx/.test(resto), 'lieu professionnel : trait plein');
        assert.match(placeAccessibleName(place()), /^Salle Teranga, jusqu’à 300 personnes, dès 150[\s  ]000 F par jour, zone approximative, Thiès$/);
        assert.equal(placePriceBadge(place({ type: 'restaurant', price: null })), 'Réservation gratuite');
    });
    test('pastilles des couches : boutons à bascule, barre coupée si « réduire les animations »', () => {
        const layers = code('components/explore/MapLayers.tsx');
        assert.match(layers, /aria-pressed=\{on\}/);
        assert.match(layers, /motion-safe:transition-transform motion-safe:duration-200/);
        assert.match(layers, /url\.searchParams\.set\(LAYERS_PARAM/);
    });
    test('fiches : itinéraire du seul lieu professionnel ; zone et phrase pour un particulier', () => {
        for (const rel of ['app/halls/(catalogue)/[id]/page.tsx', 'app/tables/(catalogue)/[id]/page.tsx']) {
            const src = code(rel);
            assert.match(src, /\{(hall|venue)\.exact && \(\s*<LinkButton\s+href=\{`https:\/\/www\.google\.com\/maps\/dir/, `${rel} : itinéraire sous condition`);
            assert.match(src, /<PlaceMap /);
            assert.ok(!/VenueMap/.test(src), `${rel} : ancienne carte`);
        }
        const placeMap = code('components/lieux/PlaceMap.tsx');
        assert.match(placeMap, /zoneRadiusM=\{exact \? undefined : ZONE_RADIUS_M\}/);
        assert.ok(!/google/.test(placeMap));
    });
});
