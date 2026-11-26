/**
 * Lot Carte B3 — règles pures et code des écrans de la carte des lieux (sans base) :
 *  - contrat public : copie champ par champ (rien en trop), paramètres bornés, sélection par couche et par zone ;
 *  - « Ouvert maintenant » : plages réunies (minuit, 24 h sur 24), heure de Dakar ;
 *  - « Autour de moi » reste local : la zone envoyée pour les lieux est élargie sur la grille T1 de la carte B ;
 *  - aucune adresse ni rien de la partenaire lu par la lecture de la carte ; aucune nouvelle importation à la demande (un
 *    seul chargeur par module : leçon du lot poids) ; repères distincts par leur forme, texte échappé.
 * Décisions du client du 25/11 (modifications signalées au rapport) :
 *  - application entièrement publique : chaque lieu à sa position exacte ; fiches avec adresse, carte et « Voir
 *    l'itinéraire » pour tout le monde ; plus aucune trace de zone approximative ni de « Qui accueille ? » ;
 *  - position obligatoire : phrase « L'adresse et la position de votre lieu seront visibles par tous… » à côté de
 *    l'adresse des trois formulaires, position exigée (erreur à côté de la carte), bandeaux de la position manquante.
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
import { placeMarkerHtml } from '../../components/explore/place-markers';
import {
    MISSING_HALL_POSITION_TEXT, MISSING_POSITION_TEXT, MISSING_VENUE_POSITION_TEXT, PLACE_POSITION_REQUIRED, PLACE_PUBLIC_NOTICE,
} from '../../lib/places/place-texts';
import { POSITION_TEXTS } from '../../lib/validations/event';

const read = (rel: string): string => fs.readFileSync(path.resolve(process.cwd(), rel), 'utf8');
/** Code sans les commentaires (les règles portent sur ce qui s'exécute). */
const code = (rel: string): string => read(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** Fichiers où une zone approximative ou un « particulier » se cacherait (écrans, lectures, styles). */
function walk(dir: string, out: string[] = []): string[] {
    for (const e of fs.readdirSync(path.resolve(process.cwd(), dir), { withFileTypes: true })) {
        const rel = `${dir}/${e.name}`;
        if (e.isDirectory()) walk(rel, out);
        else if (/\.(ts|tsx|css)$/.test(e.name)) out.push(rel);
    }
    return out;
}

const place = (over: Partial<PublicMapPlace> = {}): PublicMapPlace => ({
    id: 'a', type: 'salle', name: 'Salle Teranga', area: 'Thiès', photos: [], price: 150_000, capacity: 300,
    lat: 14.7, lng: -16.9, hours: null, ...over,
});

describe('contrat public de la carte des lieux', () => {
    test('copie champ par champ : un champ en trop ne sort jamais', () => {
        const dirty = { ...place(), address: 'Villa secrète', latitude: 1, partner: { phone: '77' } } as unknown as PublicMapPlace;
        assert.deepEqual(Object.keys(publicPlaceOnly(dirty)).sort(), [...PUBLIC_PLACE_FIELDS].sort());
        assert.ok(!JSON.stringify(publicPlaceOnly(dirty)).includes('secrète'));
    });
    test('décision du 25/11 : plus de champ « exact » (chaque lieu à sa position exacte)', () => {
        assert.ok(!(PUBLIC_PLACE_FIELDS as readonly string[]).includes('exact'));
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

describe('lecture de la carte : position exacte, ni adresse ni rien de la partenaire', () => {
    test('colonnes lues par la carte des lieux', () => {
        const src = code('lib/lieux/carte-lieux.server.ts');
        const selects = [...src.matchAll(/const (HALL|VENUE)_SELECT = ([\s\S]*?);\n/g)].map((m) => m[2]).join(' ');
        assert.ok(selects.length > 0);
        for (const banned of ['address', 'phone', 'email', 'company_name', 'commercial_name', 'description', '*', 'zone_', 'host_kind']) {
            assert.ok(!selects.includes(banned), `colonne ${banned} lue`);
        }
        assert.match(selects, /latitude, longitude/);
        assert.match(src, /position\(h\)/);
        assert.match(src, /position\(v\)/);
    });
});

describe('décision du client du 25/11 : plus de zone approximative ni de particulier', () => {
    test('aucune trace dans les écrans, les lectures et les styles', () => {
        const files = [...walk('app'), ...walk('components'), ...walk('lib'), 'middleware.ts'];
        const found: string[] = [];
        for (const rel of files) {
            const src = read(rel);
            for (const banned of ['position-publique', 'host_kind', 'hostKind', 'zone_latitude', 'ZONE_RADIUS_M', /ev-zone(?!s)/, 'ev-repere--approx',
                'zone approximative', 'Adresse exacte après réservation', 'Qui accueille', 'adresse-confirmee']) {
                // « ev-zones » (zones de billetterie du formulaire d'événement) n'est pas la zone d'un lieu
                if (typeof banned === 'string' ? src.includes(banned) : banned.test(src)) found.push(`${rel} : ${String(banned)}`);
            }
        }
        assert.deepEqual(found, []);
        assert.ok(!fs.existsSync(path.resolve(process.cwd(), 'components/lieux/PlaceMap.tsx')), 'petite carte de la zone retirée');
    });
    test('fiches : adresse, carte au point exact et « Voir l’itinéraire » pour tout le monde', () => {
        for (const rel of ['app/halls/(catalogue)/[id]/page.tsx', 'app/tables/(catalogue)/[id]/page.tsx']) {
            const src = code(rel);
            assert.match(src, /<VenueMap /, `${rel} : carte du point exact`);
            assert.match(src, /href=\{`https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=/, `${rel} : itinéraire`);
            assert.match(src, /Voir l’itinéraire/);
            assert.ok(!/\.exact\b/.test(src), `${rel} : condition de l'ancien lot`);
        }
    });
});

describe('écrans', () => {
    test('aucune importation à la demande de plus (un seul chargeur par module)', () => {
        for (const rel of ['components/explore/ExploreMap.tsx', 'components/explore/MapLayers.tsx', 'components/explore/MapPlaceCard.tsx',
            'components/explore/place-markers.ts', 'lib/lieux/carte-lieux.ts', 'lib/lieux/carte-lieux-client.ts']) {
            // Les types de Leaflet (import('leaflet').Map) ne chargent rien
            assert.ok(!/\bimport\((?!'leaflet'\))/.test(code(rel)), `${rel} : import() nouveau`);
        }
        assert.match(read('components/explore/lazy.ts'), /export \{ default as ExploreMap \} from '\.\/ExploreMap';/);
    });
    test('repères : formes distinctes, texte échappé, nom accessible complet', () => {
        const salle = placeMarkerHtml(place({ name: '<b>x</b>' }), false);
        const resto = placeMarkerHtml(place({ type: 'restaurant', name: 'Chez <Awa>' }), true);
        assert.match(salle, /ev-repere--salle/);
        assert.match(salle, /Dès 150[\s  ]000 F\/jour/);
        assert.match(resto, /ev-repere--resto/);
        assert.match(resto, /ev-repere--choisi/);
        assert.ok(!resto.includes('<Awa>') && resto.includes('&lt;Awa&gt;'));
        assert.match(placeAccessibleName(place()), /^Salle Teranga, jusqu’à 300 personnes, dès 150[\s  ]000 F par jour$/);
        assert.equal(placePriceBadge(place({ type: 'restaurant', price: null })), 'Réservation gratuite');
    });
    test('pastilles des couches : boutons à bascule, barre coupée si « réduire les animations »', () => {
        const layers = code('components/explore/MapLayers.tsx');
        assert.match(layers, /aria-pressed=\{on\}/);
        assert.match(layers, /motion-safe:transition-transform motion-safe:duration-200/);
        assert.match(layers, /url\.searchParams\.set\(LAYERS_PARAM/);
    });
    test('regroupement qui cache l’élément survolé ou choisi : mis en évidence (run 658)', () => {
        const map = code('components/explore/ExploreMap.tsx');
        assert.match(map, /const hot = c\.items\.some\(\(x\) => x\.id === selectedKey \|\| x\.id === hoverKey\)/);
        assert.match(map, /ev-repere--pile ev-repere--choisi/);
    });
});

describe('décision du client du 25/11 : position obligatoire, phrase et bandeaux', () => {
    test('textes du client, mot pour mot', () => {
        assert.equal(PLACE_PUBLIC_NOTICE, 'L’adresse et la position de votre lieu seront visibles par tous sur la carte et sur sa fiche.');
        assert.equal(PLACE_POSITION_REQUIRED, 'Placez votre lieu sur la carte avant d’envoyer.');
        assert.equal(POSITION_TEXTS.requiredToSubmit, PLACE_POSITION_REQUIRED, 'même phrase pour un événement');
        assert.equal(MISSING_POSITION_TEXT, 'Ajoutez la position de votre événement pour qu’il apparaisse sur la carte');
        assert.equal(MISSING_HALL_POSITION_TEXT, 'Ajoutez la position de votre salle pour qu’elle apparaisse sur la carte');
        assert.equal(MISSING_VENUE_POSITION_TEXT, 'Ajoutez la position de votre établissement pour qu’il apparaisse sur la carte');
        const sql = read('supabase/migrations/20261210000001_cb3_lieux_publics.sql');
        assert.ok(sql.includes(PLACE_POSITION_REQUIRED), 'même phrase en base');
        assert.match(read('lib/events/submission-check.ts'), /message: 'Placez votre lieu sur la carte avant d’envoyer\.'/);
    });
    test('phrase à côté de l’adresse des trois formulaires', () => {
        assert.match(code('components/halls/partner/HallForm.tsx'), /id="hall-address"[\s\S]{0,400}hint=\{PLACE_PUBLIC_NOTICE\}/);
        assert.match(code('components/tables/editor/VenueForm.tsx'), /id=\{`\$\{P\}-adresse`\}[\s\S]{0,400}hint=\{PLACE_PUBLIC_NOTICE\}/);
        assert.match(code('components/events/EventForm.tsx'), /\{PLACE_PUBLIC_NOTICE\}/);
    });
    test('position exigée dans les formulaires, erreur à côté de la carte', () => {
        const hall = code('components/halls/partner/HallForm.tsx');
        assert.match(hall, /if \(v\.latitude === null \|\| v\.longitude === null\) errors\.position = /);
        assert.match(hall, /error=\{errors\.position\}/);
        const venue = code('components/tables/editor/VenueForm.tsx');
        assert.match(venue, /if \(v\.latitude === null \|\| v\.longitude === null\) errors\.position = PLACE_POSITION_REQUIRED;/);
        assert.match(venue, /error=\{errors\.position\}/);
        assert.match(venue, /<span className="sr-only"> \(obligatoire\)<\/span>/);
        assert.ok(!/\(conseillée\)/.test(venue), 'position plus seulement conseillée');
        assert.match(code('components/events/EventForm.tsx'), /error=\{errors\.latitude \?\? errors\.longitude\}/);
    });
    test('services : création sans position refusée, position jamais retirée', () => {
        const hall = code('lib/halls/hall.service.ts');
        assert.match(hall, /if \(rules\.latitude === undefined \|\| rules\.latitude === null\) throw new PublicError\(PLACE_POSITION_REQUIRED, 'POSITION_REQUIRED', 400\)/);
        assert.match(hall, /if \(lat === null && !creating\) throw new PublicError\(PLACE_POSITION_KEPT, 'POSITION_REQUIRED', 400\)/);
        assert.match(code('lib/tables/table.service.ts'), /if \(fields\.latitude === null \|\| fields\.longitude === null\) throw new PublicError\(PLACE_POSITION_KEPT, 'POSITION_REQUIRED', 400\)/);
    });
    test('bandeaux de la position manquante : pilotage, salle, établissement', () => {
        const pilotage = code('app/partner/events/[id]/page.tsx');
        assert.match(pilotage, /ov\.has_position === false/);
        assert.match(pilotage, /title=\{MISSING_POSITION_TEXT\}/);
        assert.match(pilotage, /edit\?etape=acces/);
        assert.match(code('lib/events/pilotage.service.ts'), /has_position: await eventHasPosition\(eventId\)/);
        const hall = code('components/halls/partner/HallSheetView.tsx');
        assert.match(hall, /\(hall\.latitude === null \|\| hall\.longitude === null\) && !refused/);
        assert.match(hall, /title=\{MISSING_HALL_POSITION_TEXT\}/);
        const venue = code('components/tables/partner/PlanningView.tsx');
        assert.match(venue, /\(venue\.latitude === null \|\| venue\.longitude === null\) && !refused/);
        assert.match(venue, /title=\{MISSING_VENUE_POSITION_TEXT\}/);
    });
});

describe('décision du client du 25/11 : événement suspendu = page neutre (contrat E du lot 5 changé)', () => {
    test('fiche de la route : statut et « non achetable » seulement ; page : texte neutre, « Mes billets », métadonnées sans le nom', () => {
        const route = code('app/api/events/[id]/route.ts');
        assert.match(route, /event\.status === 'SUSPENDU' \? unavailableEventView\(event\.id\) : event/);
        const page = code('app/events/[id]/page.tsx');
        assert.match(page, /if \(read\.event\.status === 'SUSPENDU'\) return \{ title: 'Événement indisponible — Event Village', robots: \{ index: false \} \};/);
        const neutral = page.slice(page.indexOf("if (event.status === 'SUSPENDU') {"), page.indexOf("if (event.status === 'SUSPENDU') {") + 600);
        assert.ok(neutral.length > 0, 'page neutre absente');
        assert.match(neutral, /title=\{UNAVAILABLE_EVENT_TITLE\}/);
        assert.match(neutral, /href="\/tickets"/);
        assert.doesNotMatch(neutral, /event\.(title|venue|city|date|time|startsAt)/, 'la page neutre cite l’événement');
        assert.match(code('components/event-page/EventTicketing.tsx'), /isUnavailableEventBody\(body\)\) \{\s*setGone\(true\);\s*router\.refresh\(\);/);
    });
});
