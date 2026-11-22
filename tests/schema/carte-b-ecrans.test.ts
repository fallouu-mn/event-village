/**
 * Lot Carte B (B1, B2, accueil) — lectures du code et règles pures des écrans, sans base ni navigateur :
 *  - fond de carte : Stadia « Alidade Smooth » (clair) et « Alidade Smooth Dark » (sombre), AUCUNE clé dans le code du
 *    navigateur, adresse et mention réglables, mention exigée (Stadia Maps, OpenMapTiles, contributeurs OpenStreetMap) ;
 *    toutes les cartes passent par l'aide commune ; CSP : images limitées, seul l'hôte des tuiles choisi est ajouté ;
 *    blocage des tuiles Stadia dans la mesure de performance ;
 *  - Explorer : trois onglets (indicateur qui glisse : Tabs), vue gardée dans l'adresse, carte et calendrier chargés à
 *    l'ouverture de leur onglet (next/dynamic, ssr false) : ni Leaflet ni la carte au premier chargement ; tuiles en échec
 *    → Liste et message simple ; groupes de filtres gardés (mesure du toucher) ;
 *  - carte : regroupement, pastilles, « À la une », feuille du téléphone, liste synchronisée, « Rechercher dans cette
 *    zone », « Autour de moi » (position jamais envoyée ni gardée), choix rapide, clavier, « réduire les animations » ;
 *  - calendrier : libellés des jours (« samedi 13 décembre, 3 événements »), événement de plusieurs jours ;
 *  - accueil : « Partout au Sénégal » dans l'îlot chargé après la page, aperçu chargé quand il devient visible ;
 *    l'accueil n'importe ni Leaflet ni la carte.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { STADIA_ATTRIBUTION, STADIA_DARK_URL, STADIA_LIGHT_URL, tileConfig, tileOrigins } from '../../lib/map/tiles';
import { clusterPoints } from '../../lib/map/cluster';
import { dayAriaLabel, eventsByDay } from '../../lib/events/calendar-days';
import { exploreModeHref, parseExploreMode } from '../../lib/events/explore-view';
import { mapUrl } from '../../lib/events/map-client';
import { NO_FILTERS } from '../../lib/events/catalog-filters';
import type { PublicMapEvent } from '../../lib/events/map-shared';

const ROOT = process.cwd();
const raw = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
const code = (rel: string): string => raw(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');

describe('B1 — fond de carte Stadia', () => {
    test('clair Alidade Smooth, sombre Alidade Smooth Dark, mention exigée par Stadia', () => {
        assert.equal(tileConfig('light').url, STADIA_LIGHT_URL);
        assert.equal(tileConfig('dark').url, STADIA_DARK_URL);
        assert.match(STADIA_LIGHT_URL, /^https:\/\/tiles\.stadiamaps\.com\/tiles\/alidade_smooth\/\{z\}\/\{x\}\/\{y\}\{r\}\.png$/);
        assert.match(STADIA_DARK_URL, /^https:\/\/tiles\.stadiamaps\.com\/tiles\/alidade_smooth_dark\/\{z\}\/\{x\}\/\{y\}\{r\}\.png$/);
        for (const part of ['Stadia Maps', 'OpenMapTiles', 'contributeurs OpenStreetMap']) assert.ok(STADIA_ATTRIBUTION.includes(part), part);
        assert.equal(tileConfig('light').attribution, STADIA_ATTRIBUTION);
    });

    test('aucune clé dans le code du navigateur : authentification par domaine', () => {
        for (const rel of ['lib/map/tiles.ts', 'components/map/themedTiles.ts', 'components/explore/ExploreMap.tsx', 'components/explore/SenegalMapPreview.tsx', 'components/ui/EventMap.tsx', 'components/ui/MapPicker.tsx', 'next.config.mjs']) {
            assert.doesNotMatch(raw(rel), /api_key|apikey|STADIA_API|access_token|NEXT_PUBLIC_[A-Z_]*KEY/i, `${rel} : aucune clé`);
        }
    });

    test('adresse et mention réglables ; origines pour la CSP (sous-domaines {s} compris)', () => {
        assert.match(raw('lib/map/tiles.ts'), /process\.env\.NEXT_PUBLIC_MAP_TILE_URL\b/);
        assert.match(raw('lib/map/tiles.ts'), /process\.env\.NEXT_PUBLIC_MAP_TILE_URL_DARK\b/);
        assert.match(raw('lib/map/tiles.ts'), /process\.env\.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION\b/);
        assert.deepEqual(tileOrigins({}), ['https://tiles.stadiamaps.com']);
        assert.deepEqual(tileOrigins({ light: 'https://{s}.tuiles.example/{z}/{x}/{y}.png' }), ['https://a.tuiles.example', 'https://b.tuiles.example', 'https://c.tuiles.example']);
        assert.deepEqual(tileOrigins({ light: 'https://clair.example/{z}/{x}/{y}.png', dark: 'https://sombre.example/{z}/{x}/{y}.png' }), ['https://clair.example', 'https://sombre.example']);
    });

    test('toutes les cartes posent le fond par l’aide commune ; thème suivi sans recréer la carte', () => {
        for (const rel of ['components/ui/EventMap.tsx', 'components/ui/MapPicker.tsx', 'components/explore/ExploreMap.tsx', 'components/explore/SenegalMapPreview.tsx']) {
            const src = code(rel);
            assert.match(src, /addThemedTiles\(L, map, themeRef\.current\)/, `${rel} : addThemedTiles`);
            assert.match(src, /setTilesTheme\(tilesRef\.current, theme\)/, `${rel} : thème suivi`);
            assert.doesNotMatch(src, /L\.tileLayer\(|openstreetmap\.org\/\{z\}/, `${rel} : aucune autre couche`);
        }
    });

    test('CSP : images limitées (plus de « https: » entier), hôte des tuiles choisi ajouté', async () => {
        const factory = (await import('../../next.config.mjs')).default as (phase: string) => { headers: () => Promise<Array<{ source: string; headers: Array<{ key: string; value: string }> }>> };
        const all = (await factory('phase-production-build').headers()).find((h) => h.source === '/(.*)');
        const csp = String(all?.headers.find((h) => h.key === 'Content-Security-Policy-Report-Only')?.value);
        const img = csp.split('; ').find((d) => d.startsWith('img-src ')) ?? '';
        const sources = img.split(' ').slice(1);
        assert.ok(!sources.includes('https:'), `img-src : ${img}`);
        for (const o of tileOrigins()) assert.ok(sources.includes(o), `tuiles ${o} dans img-src`);
        assert.ok(!sources.some((s) => /openstreetmap/.test(s)), 'plus d’OpenStreetMap');
    });

    test('mesure de performance : tuiles Stadia bloquées', () => {
        for (const rel of ['e2e/perf.spec.ts', 'scripts/e2e/perf-mobile.mjs', 'scripts/e2e/perf-profil.mjs']) {
            assert.match(raw(rel), /'\*tiles\.stadiamaps\.com\*'/, rel);
        }
    });
});

describe('B2 — Explorer : trois vues, rien de plus au premier chargement', () => {
    test('vue lue et écrite dans l’adresse', () => {
        assert.equal(parseExploreMode({ vue: 'carte' }), 'carte');
        assert.equal(parseExploreMode(new URLSearchParams('vue=calendrier')), 'calendrier');
        assert.equal(parseExploreMode({ vue: 'autre' }), 'liste');
        assert.equal(parseExploreMode({}), 'liste');
        assert.equal(exploreModeHref({}, 'liste'), '/explore');
        assert.equal(exploreModeHref({}, 'carte'), '/explore?vue=carte');
        assert.equal(exploreModeHref({ gratuit: true }, 'calendrier'), '/explore?gratuit=1&vue=calendrier');
    });

    test('onglets (indicateur qui glisse), carte et calendrier par next/dynamic sans rendu serveur, aucun import statique', () => {
        const view = code('app/explore/ExploreView.tsx');
        assert.match(view, /<ViewTabs value=\{mode\} onChange=\{chooseMode\} \/>/);
        assert.match(view, /role="tablist" aria-label="Affichage des événements"/);
        assert.match(view, /ArrowRight[\s\S]*ArrowLeft[\s\S]*Home[\s\S]*End/, 'flèches, Début et Fin');
        assert.match(view, /motion-safe:transition-transform motion-safe:duration-slow/, 'indicateur qui glisse, coupé si réduire les animations');
        assert.doesNotMatch(view, /from '@\/components\/ui\/Tabs'/, 'module partagé des onglets non chargé par Explorer (poids)');
        assert.match(view, /import\('@\/components\/explore\/lazy'\)\.then\(\(m\) => m\.ExploreMap\)/);
        assert.match(view, /import\('@\/components\/explore\/lazy'\)\.then\(\(m\) => m\.ExploreCalendar\)/);
        assert.match(view, /exploreModeHref\(next, modeRef\.current\)/, 'filtres : vue gardée');
        assert.doesNotMatch(view, /from '@\/components\/explore\/ExploreMap'|from '@\/components\/explore\/ExploreCalendar'|from 'leaflet'|leaflet\.css/);
        assert.doesNotMatch(code('app/explore/page.tsx'), /leaflet|ExploreMap|ExploreCalendar/);
        // Groupes visés par la mesure du toucher (scripts/e2e/perf-mobile.mjs) gardés
        assert.match(view, /aria-label="Date et prix"/);
        assert.match(raw('components/events/CategoryChipsBar.tsx'), /aria-label=/);
    });

    test('tuiles en échec : retour à la Liste avec un message simple', () => {
        const view = code('app/explore/ExploreView.tsx');
        assert.match(view, /const onTilesFailed = useCallback\(\(\) => \{\n\s*setMapFailed\(true\);\n\s*setMode\('liste'\);/);
        assert.match(view, /La carte ne peut pas s’afficher pour le moment/);
        const map = code('components/explore/ExploreMap.tsx');
        assert.match(map, /tiles\.on\('tileerror'/);
        assert.match(map, /failedRef\.current\(\)/);
    });

    test('carte : regroupement, pastilles, « À la une », feuille du téléphone, liste synchronisée, zone, clavier', () => {
        const map = code('components/explore/ExploreMap.tsx');
        assert.match(map, /clusterPoints\(points, \(e\) => e\.id\)/);
        assert.match(map, /mapMarkerHtml\('pile', String\(c\.items\.length\)\)/);
        assert.match(map, /'choisi' : e\.highlight === 'A_LA_UNE' \? 'une' : 'prix'/);
        assert.match(map, /priceBadge\(e\.price\)/);
        assert.match(map, /Voir l’événement/);
        assert.match(map, /Rechercher dans cette zone/);
        assert.match(map, /onHover=\{setHoverId\}/);
        assert.match(map, /keyboard: true/);
        assert.match(map, /zoomAnimation: !still/, 'réduire les animations');
        assert.match(map, /La vue Liste présente les mêmes événements/);
    });

    test('« Autour de moi » : position utilisée pour centrer la carte seulement, jamais envoyée ni gardée', () => {
        const map = code('components/explore/ExploreMap.tsx');
        assert.match(map, /navigator\.geolocation\.getCurrentPosition/);
        assert.match(map, /goTo\(latitude, longitude, 13\)/);
        assert.doesNotMatch(map, /localStorage|sessionStorage|document\.cookie|indexedDB|sendBeacon/);
        // Les coordonnées de l'appareil ne passent jamais par l'adresse de lecture ni par fetch
        const geoBlock = map.slice(map.indexOf('const aroundMe'), map.indexOf('// 3. Repères'));
        assert.doesNotMatch(geoBlock, /mapUrl|fetch\(|readMapEvents|setSearchZone/);
        assert.doesNotMatch(raw('lib/events/map-client.ts'), /geolocation|coords/);
    });

    test('choix rapide de ville ou de quartier (pas de recherche d’adresse publique)', () => {
        const map = code('components/explore/ExploreMap.tsx');
        assert.match(map, /QUICK_PLACES\.map\(\(p\) => \(\{ value: p\.id, label: p\.label \}\)\)/);
        assert.doesNotMatch(map, /places\/search|nominatim/i);
    });

    test('regroupement : une case de 64 px par groupe, barycentre, ordre stable', () => {
        const groups = clusterPoints([
            { item: { id: 'a' }, x: 10, y: 10 }, { item: { id: 'b' }, x: 30, y: 50 }, { item: { id: 'c' }, x: 200, y: 10 },
            { item: { id: 'd' }, x: Number.NaN, y: 0 },
        ], (i) => i.id);
        assert.deepEqual(groups.map((g) => g.key), ['a|b', 'c']);
        assert.deepEqual([groups[0].x, groups[0].y], [20, 30]);
    });
});

describe('B2 — calendrier', () => {
    const ev = (id: string, startsAt: string, endsAt: string): PublicMapEvent => ({
        id, title: id, startsAt, endsAt, price: 0, color: '#14213d', blur: null, highlight: null, lat: 14.7, lng: -17.4,
    });

    test('libellé lu par les lecteurs d’écran : « samedi 13 décembre, 3 événements »', () => {
        assert.equal(dayAriaLabel(Date.UTC(2025, 11, 13), 3), 'samedi 13 décembre, 3 événements');
        assert.equal(dayAriaLabel(Date.UTC(2025, 11, 14), 1), 'dimanche 14 décembre, 1 événement');
    });

    test('un événement compte sur chacun de ses jours, dans le mois ; fin à minuit exclue', () => {
        const days = eventsByDay([
            ev('festival', '2026-11-29T18:00:00.000Z', '2026-12-02T02:00:00.000Z'),
            ev('soiree', '2026-12-05T20:00:00.000Z', '2026-12-06T00:00:00.000Z'),
        ], 2026, 11);
        const keys = Array.from(days.keys()).map((t) => new Date(t).toISOString().slice(0, 10)).sort();
        assert.deepEqual(keys, ['2026-12-01', '2026-12-02', '2026-12-05']);
    });

    test('vignettes : image floutée et couleur seulement (aucune grande image), « +n », aujourd’hui en orange, feuille d’un jour', () => {
        const cal = code('components/explore/ExploreCalendar.tsx');
        assert.match(cal, /<PosterDot key=\{e\.id\} event=\{e\} size="sm"/);
        assert.doesNotMatch(cal, /imageUrl|next\/image/);
        assert.match(cal, /\+\{list\.length - 1\}/);
        assert.match(cal, /isToday \? 'bg-brand-vif text-brand-vif-foreground'/);
        assert.match(cal, /aria-current=\{isToday \? 'date' : undefined\}/);
        assert.match(cal, /<Modal[\s\S]*sheetOnMobile/);
        assert.match(cal, /Ce week-end/);
        assert.match(cal, /Ce mois-ci/);
        const card = code('components/explore/MapEventCard.tsx');
        assert.match(card, /src=\{event\.blur\}/);
        assert.doesNotMatch(card, /imageUrl|next\/image/);
    });

    test('lecture d’un mois : période passée à la route avec les filtres partagés', () => {
        assert.equal(mapUrl({ ...NO_FILTERS, gratuit: true }, { from: '2026-12-01', to: '2027-01-01' }), '/api/events/carte?gratuit=1&du=2026-12-01&au=2027-01-01');
        assert.equal(mapUrl(NO_FILTERS, { zone: { south: 14.6, west: -17.55, north: 14.8, east: -17.3 } }), '/api/events/carte?zone=14.6%2C-17.55%2C14.8%2C-17.3');
    });
});

describe('Accueil — « Partout au Sénégal »', () => {
    test('section dans l’îlot chargé après la page ; aperçu chargé quand il devient visible ; « Ouvrir la carte »', () => {
        assert.match(code('components/events/HomeDiscovery.tsx'), /<HomeSenegalMap \/>/);
        const section = code('components/events/HomeSenegalMap.tsx');
        assert.match(section, /new IntersectionObserver/);
        assert.match(section, /dynamic\(\(\) => import\('@\/components\/explore\/lazy'\)\.then\(\(m\) => m\.SenegalMapPreview\), \{ ssr: false \}\)/);
        assert.match(section, /\{visible && <SenegalMapPreview /);
        assert.match(section, /Ouvrir la carte/);
        assert.match(section, /exploreModeHref\(\{\}, 'carte'\)/);
    });

    test('un seul module à la demande pour carte, calendrier et aperçu ; Leaflet pris dans le module de la fiche', () => {
        const lazy = code('components/explore/lazy.ts');
        assert.match(lazy, /export \{ default as ExploreMap \} from '\.\/ExploreMap'/);
        assert.match(lazy, /export \{ default as ExploreCalendar \} from '\.\/ExploreCalendar'/);
        assert.match(lazy, /export \{ default as SenegalMapPreview \} from '\.\/SenegalMapPreview'/);
        for (const rel of ['components/explore/ExploreMap.tsx', 'components/explore/SenegalMapPreview.tsx', 'components/explore/ExploreCalendar.tsx']) {
            const src = code(rel);
            assert.doesNotMatch(src, /leaflet\.css|require\('leaflet'\)|from 'leaflet'/, `${rel} : ni Leaflet ni sa feuille de style en propre`);
        }
        for (const rel of ['components/explore/ExploreMap.tsx', 'components/explore/SenegalMapPreview.tsx']) {
            assert.match(code(rel), /import\('@\/components\/ui\/EventMap'\)\s*\.then\(\(\{ loadLeaflet \}\)/, rel);
        }
        assert.doesNotMatch(code('components/explore/ExploreCalendar.tsx'), /EventMap|loadLeaflet/, 'le calendrier ne charge pas Leaflet');
        assert.match(code('components/ui/EventMap.tsx'), /export function loadLeaflet\(\): typeof import\('leaflet'\)/);
    });

    test('l’accueil n’importe ni Leaflet ni la carte (poids initial inchangé)', () => {
        for (const rel of ['app/page.tsx', 'app/_accueil/HomeNearby.tsx', 'app/_accueil/sections.tsx']) {
            assert.doesNotMatch(raw(rel), /leaflet|SenegalMapPreview|HomeSenegalMap|ExploreMap/, rel);
        }
        assert.match(raw('app/_accueil/HomeNearby.tsx'), /dynamic\(\(\) => import\('@\/components\/events\/HomeDiscovery'\)/);
    });

    test('aperçu immobile : ni glisser, ni zoom, ni clavier ; repères non focalisables', () => {
        const preview = code('components/explore/SenegalMapPreview.tsx');
        for (const opt of ['dragging: false', 'touchZoom: false', 'scrollWheelZoom: false', 'doubleClickZoom: false', 'keyboard: false']) assert.ok(preview.includes(opt), opt);
        assert.match(preview, /interactive: false,\n\s*keyboard: false/);
    });
});
