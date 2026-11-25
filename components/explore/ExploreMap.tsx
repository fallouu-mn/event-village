'use client';

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown, LocateFixed, RefreshCw, Search, SlidersHorizontal, X, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { clusterLabel, mapMarkerHtml, type MarkerKind } from '@/components/ui/MapMarker';
import { addThemedTiles, setTilesTheme, useMapTheme } from '@/components/map/themedTiles';
import { loadLeafletWithCss } from '@/lib/map/leaflet-assets';
import { MapEventCard, mapEventWhen } from '@/components/explore/MapEventCard';
import { MapPlaceCard, PlaceSheetCard } from '@/components/explore/MapPlaceCard';
import { HallFilters, LayerPills, readLayersParam, VenueFilters, writeLayersParam, type MapLayer } from '@/components/explore/MapLayers';
import { placeMarkerHtml } from '@/components/explore/place-markers';
import { cn } from '@/components/ui/cn';
import { useFeatureFlags } from '@/lib/features/client';
import { mapUrl, readMapEvents } from '@/lib/events/map-client';
import { priceBadge, QUICK_PLACES, SENEGAL_BOUNDS, type MapZone, type PublicMapEvent } from '@/lib/events/map-shared';
import { placeAccessibleName, type PublicMapPlace } from '@/lib/lieux/carte-lieux';
import {
    EMPTY_HALL_FILTERS, EMPTY_VENUE_FILTERS, placesUrl, readPlaces, type HallLayerFilters, type VenueLayerFilters,
} from '@/lib/lieux/carte-lieux-client';
import { ZONE_RADIUS_M } from '@/lib/lieux/position-publique';
import { clusterPoints } from '@/lib/map/cluster';

/**
 * Lot Carte B (B2) — vue Carte d'Explorer, chargée à la demande (jamais au premier chargement d'Explorer) :
 *  - fond Stadia du thème (components/map/themedTiles.ts) ; aucune tuile avant l'ouverture de la vue ; si les tuiles ne
 *    viennent pas (ou si Leaflet ne se charge pas), `onTilesFailed` fait basculer Explorer sur la Liste avec un message
 *    simple ; Leaflet (morceau existant) et sa feuille de style (fichier statique) chargés à l'ouverture de la vue
 *    (lib/map/leaflet-assets.ts) : aucun morceau de code de plus pour l'application ;
 *  - points regroupés avec leur nombre (lib/map/cluster.ts), pastilles de prix (« Gratuit », « Dès 5 000 F »), « À la une »
 *    en orange ; repère touché ou survolé : forme « choisi » (orange, agrandi) ;
 *  - téléphone : feuille en bas de la carte avec l'élément touché ; ordinateur : liste à gauche synchronisée avec la zone
 *    visible, survol ou focus d'une vignette = repère mis en évidence ;
 *  - « Rechercher dans cette zone » après un déplacement ; « Autour de moi » (position de l'appareil utilisée pour centrer
 *    la carte, jamais envoyée ni gardée) ; choix rapide de ville ou de quartier ;
 *  - clavier : repères focalisables (Entrée = toucher), boutons de zoom ; la vue Liste reste l'alternative complète ;
 *  - « réduire les animations » : zoom et déplacements sans animation.
 *
 * Lot Carte B3 — couches Événements, Salles, Restaurants (components/explore/MapLayers.tsx), chacune affichée ou masquée,
 * gardées dans l'adresse (`couches=`) ; une couche dont le service est fermé n'est pas proposée ; filtres propres aux
 * salles (date, invités) et aux restaurants (date, heure, personnes) ; repères distincts par leur forme
 * (components/explore/place-markers.ts) ; lieu d'un particulier : repère en pointillé au centre de sa zone et cercle de
 * 300 m dès que la carte est assez proche (jamais le point exact : le serveur ne le donne pas) ; feuille du téléphone avec
 * les photos qui glissent ; état vide illustré avec « Élargir la zone ». Mêmes règles que pour les événements : la zone
 * envoyée est élargie sur la grille T1 (lib/lieux/carte-lieux-client.ts).
 */

type LeafletModule = typeof import('leaflet');
type LeafletMap = import('leaflet').Map;

/** Élément de la carte : un événement ou un lieu ; identifiant « e:<id> » ou « p:<id> ». */
type Item =
    | { id: string; kind: 'event'; layer: 'evenements'; lat: number; lng: number; e: PublicMapEvent }
    | { id: string; kind: 'place'; layer: 'salles' | 'restaurants'; lat: number; lng: number; p: PublicMapPlace };

const SENEGAL_LATLNG: [[number, number], [number, number]] = [[SENEGAL_BOUNDS.south, SENEGAL_BOUNDS.west], [SENEGAL_BOUNDS.north, SENEGAL_BOUNDS.east]];
/** Tuiles en échec sans aucune réussie : au-delà, la carte est déclarée indisponible. */
const TILE_FAILURES_MAX = 4;
/** Zoom au-delà duquel un groupe ne s'ouvre plus en zoomant (points au même endroit) : la liste du groupe s'affiche. */
const GROUP_ZOOM_LIMIT = 16;
/** Zoom à partir duquel la zone de 300 m d'un particulier est dessinée (assez grande pour se lire). */
const ZONE_MIN_ZOOM = 13;
/** Délai de frappe des filtres des couches avant la lecture. */
const FILTER_DEBOUNCE_MS = 400;

function reducedMotion(): boolean {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function zoneOf(map: LeafletMap): MapZone {
    const b = map.getBounds();
    return { south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() };
}

function inZone(p: { lat: number; lng: number }, z: MapZone | null): boolean {
    return !z || (p.lat >= z.south && p.lat <= z.north && p.lng >= z.west && p.lng <= z.east);
}

/**
 * Touche qui active un repère (bouton) : Entrée ou Espace. Leaflet 1.9 rend les repères focalisables, mais Entrée n'y
 * ouvre qu'une bulle liée (bindPopup), jamais l'action du toucher : sans ceci, un repère était inactif au clavier.
 */
function activates(e: KeyboardEvent): boolean {
    return e.key === 'Enter' || e.key === ' ' || e.keyCode === 13 || e.keyCode === 32;
}

/** Texte du repère simple : « À la une », sinon le prix, sinon le jour (« sam. 13 déc. »). */
function markerText(e: PublicMapEvent): string {
    if (e.highlight === 'A_LA_UNE') return 'À la une';
    return priceBadge(e.price) ?? mapEventWhen(e).split(' · ')[0];
}

/** Nom accessible du repère : titre, date, prix. */
function markerAlt(e: PublicMapEvent): string {
    const price = priceBadge(e.price);
    return [e.highlight === 'A_LA_UNE' ? `À la une : ${e.title}` : e.title, mapEventWhen(e), price].filter(Boolean).join(', ');
}

function plural(n: number, one: string, many: string): string {
    return `${n} ${n > 1 ? many : one}`;
}

/** Nom d'un regroupement : « 3 événements », « 2 salles », « 4 lieux », « 5 événements et lieux ». */
function groupLabel(items: Item[]): string {
    const layers = new Set(items.map((i) => i.layer));
    if (layers.size === 1 && layers.has('evenements')) return clusterLabel(items.length);
    if (layers.size === 1 && layers.has('salles')) return plural(items.length, 'salle', 'salles');
    if (layers.size === 1 && layers.has('restaurants')) return plural(items.length, 'restaurant', 'restaurants');
    if (!layers.has('evenements')) return plural(items.length, 'lieu', 'lieux');
    return `${items.length} événements et lieux`;
}

/** Texte du nombre dans la zone : « 3 événements, 2 salles dans cette zone ». */
function zoneCountText(counts: Record<MapLayer, number>, active: ReadonlySet<MapLayer>): string {
    const parts: string[] = [];
    if (active.has('evenements')) parts.push(plural(counts.evenements, 'événement', 'événements'));
    if (active.has('salles')) parts.push(plural(counts.salles, 'salle', 'salles'));
    if (active.has('restaurants')) parts.push(plural(counts.restaurants, 'restaurant', 'restaurants'));
    const total = counts.evenements + counts.salles + counts.restaurants;
    if (parts.length === 0) return 'Choisissez ce que la carte affiche';
    if (total === 0) return active.size === 1 && active.has('evenements') ? 'Aucun événement dans cette zone' : 'Rien à afficher dans cette zone';
    return `${parts.join(', ')} dans cette zone`;
}

function useDebounced<T>(value: T, ms: number): T {
    const [out, setOut] = useState(value);
    useEffect(() => {
        const t = window.setTimeout(() => setOut(value), ms);
        return () => window.clearTimeout(t);
    }, [value, ms]);
    return out;
}

/** Illustration de l'état vide : repère au centre d'une zone en pointillé (décorative). */
function EmptyIllustration() {
    return (
        <svg aria-hidden="true" viewBox="0 0 120 80" className="h-16 w-24 text-primary-text">
            <circle cx="60" cy="44" r="30" className="fill-brand-vif/10" stroke="currentColor" strokeWidth="2" strokeDasharray="5 5" />
            <path d="M60 22c-7 0-12 5-12 12 0 9 12 20 12 20s12-11 12-20c0-7-5-12-12-12z" className="fill-card" stroke="currentColor" strokeWidth="2.5" />
            <circle cx="60" cy="34" r="4" fill="currentColor" />
        </svg>
    );
}

export default function ExploreMap({ filtersQuery, onTilesFailed, refreshKey = 0 }: {
    /** Filtres de l'Explorer déjà écrits en adresse par la page (catalogSearchParams). */
    filtersQuery: string;
    onTilesFailed: () => void;
    /** Signal temps réel d'Explorer : relecture (un événement suspendu ou annulé disparaît). */
    refreshKey?: number;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<LeafletMap | null>(null);
    const leafletRef = useRef<LeafletModule | null>(null);
    const layerRef = useRef<import('leaflet').LayerGroup | null>(null);
    const zonesRef = useRef<import('leaflet').LayerGroup | null>(null);
    const tilesRef = useRef<import('leaflet').TileLayer | null>(null);
    const failedRef = useRef(onTilesFailed);
    failedRef.current = onTilesFailed;
    const theme = useMapTheme();
    const themeRef = useRef(theme);
    themeRef.current = theme;
    const descId = useId();
    const placeId = useId();

    // Couches proposées : Événements toujours ; Salles et Restaurants si leur service est ouvert
    const flags = useFeatureFlags();
    const available = useMemo<MapLayer[]>(() => ['evenements', ...(flags?.halls ? ['salles' as const] : []), ...(flags?.tables ? ['restaurants' as const] : [])], [flags]);
    /** Couches choisies par la personne (adresse ou boutons) ; null : toutes les couches proposées. */
    const [chosen, setChosen] = useState<Set<MapLayer> | null>(() => (
        typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('couches') ? readLayersParam(['evenements', 'salles', 'restaurants']) : null
    ));
    const active = useMemo(() => new Set<MapLayer>(available.filter((l) => (chosen ? chosen.has(l) : true))), [available, chosen]);
    const toggleLayer = (layer: MapLayer) => {
        const next = new Set(active);
        if (next.has(layer)) next.delete(layer); else next.add(layer);
        setChosen(next);
        writeLayersParam(next);
    };

    const [hallFilters, setHallFilters] = useState<HallLayerFilters>(EMPTY_HALL_FILTERS);
    const [venueFilters, setVenueFilters] = useState<VenueLayerFilters>(EMPTY_VENUE_FILTERS);
    /** Filtres des couches remplis (nombre affiché sur le bouton « Filtrer »). */
    const activeFilters = [hallFilters.date, hallFilters.guests, venueFilters.date, venueFilters.time, venueFilters.guests].filter(Boolean).length;
    const layerFilters = useDebounced(useMemo(() => ({ halls: hallFilters, venues: venueFilters }), [hallFilters, venueFilters]), FILTER_DEBOUNCE_MS);

    const [ready, setReady] = useState(false);
    const [zoom, setZoom] = useState(0);
    const [visibleZone, setVisibleZone] = useState<MapZone | null>(null);
    /** Zone de la dernière lecture (null : tout le Sénégal). */
    const [searchZone, setSearchZone] = useState<MapZone | null>(null);
    const [moved, setMoved] = useState(false);
    const [events, setEvents] = useState<PublicMapEvent[]>([]);
    const [halls, setHalls] = useState<PublicMapPlace[]>([]);
    const [venues, setVenues] = useState<PublicMapPlace[]>([]);
    const [truncated, setTruncated] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedKey, setSelectedKey] = useState<string | null>(null);
    const [hoverKey, setHoverKey] = useState<string | null>(null);
    const [groupKeys, setGroupKeys] = useState<string[] | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [place, setPlace] = useState('');
    const seq = useRef(0);

    // 1. Carte créée une fois, à l'ouverture de la vue (Leaflet lit window : chargé dans le navigateur seulement)
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return undefined;
        let cancelled = false;
        let created: LeafletMap | null = null;
        const build = (L: LeafletModule) => {
            leafletRef.current = L;
            const still = reducedMotion();
            const map = L.map(container, {
                zoomControl: false,
                keyboard: true,
                minZoom: 6,
                maxBounds: L.latLngBounds(SENEGAL_LATLNG).pad(0.5),
                maxBoundsViscosity: 0.8,
                zoomAnimation: !still,
                fadeAnimation: !still,
                markerZoomAnimation: !still,
            });
            created = map;
            map.fitBounds(SENEGAL_LATLNG, { animate: false });
            L.control.zoom({ position: 'topright', zoomInTitle: 'Zoom avant', zoomOutTitle: 'Zoom arrière' }).addTo(map);
            const tiles = addThemedTiles(L, map, themeRef.current);
            tilesRef.current = tiles;
            let loaded = 0;
            let failures = 0;
            let reported = false;
            tiles.on('tileload', () => { loaded += 1; });
            tiles.on('tileerror', () => {
                failures += 1;
                if (!reported && loaded === 0 && failures >= TILE_FAILURES_MAX) {
                    reported = true;
                    console.warn(`[carte] ${failures} tuiles en échec, aucune chargée : retour à la liste`);
                    failedRef.current();
                }
            });
            // Zones sous les repères (ajoutées avant : tracés SVG, non cliquables)
            zonesRef.current = L.layerGroup().addTo(map);
            layerRef.current = L.layerGroup().addTo(map);
            const sync = () => {
                setZoom(map.getZoom());
                setVisibleZone(zoneOf(map));
            };
            map.on('zoomend moveend', sync);
            // Déplacement voulu par la personne (glisser, zoom, clavier) : « Rechercher dans cette zone » proposé
            map.on('dragend zoomend', () => setMoved(true));
            map.on('click', () => { setSelectedKey(null); setGroupKeys(null); });
            mapRef.current = map;
            sync();
            setMoved(false);
            setReady(true);
        };
        loadLeafletWithCss()
            .then((L) => { if (!cancelled) build(L); })
            .catch((err: unknown) => {
                console.error('[carte] chargement de la carte impossible :', err instanceof Error ? err.message : String(err));
                if (!cancelled) failedRef.current();
            });
        return () => {
            cancelled = true;
            created?.remove();
            mapRef.current = null;
            layerRef.current = null;
            zonesRef.current = null;
            tilesRef.current = null;
        };
    }, []);

    useEffect(() => {
        setTilesTheme(tilesRef.current, theme);
    }, [theme]);

    // 2. Lecture : filtres partagés des événements, filtres des couches, zone de la dernière recherche (tout le Sénégal
    // au départ) ; une couche masquée n'est pas lue
    const wantEvents = active.has('evenements');
    const wantHalls = active.has('salles');
    const wantVenues = active.has('restaurants');
    const eventsUrl = useMemo(() => mapUrl(filtersQuery, { zone: searchZone }), [filtersQuery, searchZone]);
    const hallsUrl = useMemo(() => placesUrl('salles', searchZone, layerFilters), [searchZone, layerFilters]);
    const venuesUrl = useMemo(() => placesUrl('restaurants', searchZone, layerFilters), [searchZone, layerFilters]);
    const load = useCallback(async () => {
        const n = ++seq.current;
        setLoading(true);
        const [ev, ha, ve] = await Promise.all([
            wantEvents ? readMapEvents('carte', eventsUrl) : Promise.resolve(null),
            wantHalls ? readPlaces(hallsUrl) : Promise.resolve(null),
            wantVenues ? readPlaces(venuesUrl) : Promise.resolve(null),
        ]);
        if (n !== seq.current) return;
        setLoading(false);
        const failed = [ev, ha, ve].find((r) => r && !r.ok);
        setError(failed && !failed.ok ? failed.message : null);
        const nextEvents = ev && ev.ok ? ev.data.events : ev ? events : [];
        const nextHalls = ha && ha.ok ? ha.data.places : ha ? halls : [];
        const nextVenues = ve && ve.ok ? ve.data.places : ve ? venues : [];
        setEvents(nextEvents);
        setHalls(nextHalls);
        setVenues(nextVenues);
        setTruncated(Boolean((ev && ev.ok && ev.data.truncated) || (ha && ha.ok && ha.data.truncated) || (ve && ve.ok && ve.data.truncated)));
        const keys = new Set([...nextEvents.map((e) => `e:${e.id}`), ...nextHalls.map((p) => `p:${p.id}`), ...nextVenues.map((p) => `p:${p.id}`)]);
        setSelectedKey((k) => (k && keys.has(k) ? k : null));
        setGroupKeys((g) => (g ? g.filter((k) => keys.has(k)) : g));
        // eslint-disable-next-line react-hooks/exhaustive-deps -- les listes précédentes ne servent qu'en cas d'échec
    }, [eventsUrl, hallsUrl, venuesUrl, wantEvents, wantHalls, wantVenues]);
    useEffect(() => { void load(); }, [load, refreshKey]);

    // Retour sur l'onglet : relecture (un lieu suspendu entre-temps disparaît)
    useEffect(() => {
        const onVisible = () => { if (document.visibilityState === 'visible') void load(); };
        document.addEventListener('visibilitychange', onVisible);
        return () => document.removeEventListener('visibilitychange', onVisible);
    }, [load]);

    const items = useMemo<Item[]>(() => [
        ...(wantEvents ? events.map((e): Item => ({ id: `e:${e.id}`, kind: 'event', layer: 'evenements', lat: e.lat, lng: e.lng, e })) : []),
        ...(wantHalls ? halls.map((p): Item => ({ id: `p:${p.id}`, kind: 'place', layer: 'salles', lat: p.lat, lng: p.lng, p })) : []),
        ...(wantVenues ? venues.map((p): Item => ({ id: `p:${p.id}`, kind: 'place', layer: 'restaurants', lat: p.lat, lng: p.lng, p })) : []),
    ], [events, halls, venues, wantEvents, wantHalls, wantVenues]);

    const searchHere = () => {
        const map = mapRef.current;
        if (!map) return;
        setSearchZone(zoneOf(map));
        setMoved(false);
    };

    const goTo = (lat: number, lng: number, z: number) => {
        mapRef.current?.setView([lat, lng], z, { animate: !reducedMotion() });
        setMoved(true);
    };

    const choosePlace = (id: string) => {
        setPlace(id);
        const p = QUICK_PLACES.find((x) => x.id === id);
        if (!p) return;
        if (p.id === 'senegal') {
            mapRef.current?.fitBounds(SENEGAL_LATLNG, { animate: !reducedMotion() });
            setSearchZone(null);
            setMoved(false);
            return;
        }
        goTo(p.lat, p.lng, p.zoom);
    };

    // « Élargir la zone » : deux crans de zoom en arrière, puis lecture de la nouvelle zone (tout le Sénégal au plus loin)
    const widen = () => {
        const map = mapRef.current;
        if (!map) return;
        setPlace('');
        if (map.getZoom() <= 8 || searchZone === null) {
            map.fitBounds(SENEGAL_LATLNG, { animate: !reducedMotion() });
            setSearchZone(null);
            setMoved(false);
            return;
        }
        map.once('zoomend', () => {
            setSearchZone(zoneOf(map));
            setMoved(false);
        });
        map.setZoom(map.getZoom() - 2, { animate: !reducedMotion() });
    };

    // « Autour de moi » : la position sert seulement à centrer la carte (jamais envoyée ni enregistrée)
    const aroundMe = () => {
        setNotice(null);
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
            setNotice('Votre téléphone ne donne pas sa position : choisissez une ville ou un quartier.');
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const { latitude, longitude } = pos.coords;
                const b = SENEGAL_BOUNDS;
                if (latitude < b.south || latitude > b.north || longitude < b.west || longitude > b.east) {
                    setNotice('Vous semblez hors du Sénégal : la carte reste sur le Sénégal.');
                    return;
                }
                setPlace('');
                goTo(latitude, longitude, 13);
            },
            (err) => {
                setNotice(err.code === err.PERMISSION_DENIED
                    ? 'Position refusée : choisissez une ville ou un quartier.'
                    : 'Position indisponible pour le moment : choisissez une ville ou un quartier.');
            },
            { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
        );
    };

    // 3. Repères : regroupés au zoom courant ; repère choisi ou survolé mis en évidence ; zones des particuliers
    useEffect(() => {
        const L = leafletRef.current;
        const map = mapRef.current;
        const layer = layerRef.current;
        const zones = zonesRef.current;
        if (!L || !map || !layer || !zones || !ready) return;
        layer.clearLayers();
        zones.clearLayers();
        const z = map.getZoom();
        const anchor = (html: string) => L.divIcon({ className: 'ev-repere-ancre', html: `<span style="position:absolute;left:0;top:0;transform:translate(-50%,-100%)">${html}</span>`, iconSize: [0, 0], iconAnchor: [0, 0] });
        if (z >= ZONE_MIN_ZOOM) {
            for (const it of items) {
                if (it.kind !== 'place' || it.p.exact) continue;
                const chosen = it.id === selectedKey || it.id === hoverKey;
                zones.addLayer(L.circle([it.lat, it.lng], { radius: ZONE_RADIUS_M, interactive: false, className: chosen ? 'ev-zone ev-zone--choisie' : 'ev-zone' }));
            }
        }
        const points = items.map((it) => {
            const p = map.project([it.lat, it.lng], z);
            return { item: it, x: p.x, y: p.y };
        });
        for (const c of clusterPoints(points, (e) => e.id)) {
            const at = map.unproject([c.x, c.y], z);
            if (c.items.length > 1) {
                const label = groupLabel(c.items);
                const marker = L.marker(at, { icon: anchor(mapMarkerHtml('pile', String(c.items.length))), keyboard: true, title: `${label} : agrandir`, alt: `${label} : agrandir`, riseOnHover: true });
                const openGroup = () => {
                    const bounds = L.latLngBounds(c.items.map((it) => [it.lat, it.lng] as [number, number]));
                    const samePlace = bounds.getNorthEast().equals(bounds.getSouthWest(), 1e-5);
                    if (samePlace || map.getZoom() >= GROUP_ZOOM_LIMIT) {
                        setGroupKeys(c.items.map((x) => x.id));
                        setSelectedKey(null);
                        return;
                    }
                    map.fitBounds(bounds.pad(0.3), { animate: !reducedMotion(), maxZoom: GROUP_ZOOM_LIMIT });
                };
                marker.on('click', openGroup);
                marker.on('keypress', (ev: import('leaflet').LeafletKeyboardEvent) => { if (activates(ev.originalEvent)) { ev.originalEvent.preventDefault(); openGroup(); } });
                layer.addLayer(marker);
                // Bouton (role posé par Leaflet) : nom complet pour les lecteurs d'écran (sinon « 8 »)
                marker.getElement()?.setAttribute('aria-label', `${label} : agrandir`);
                continue;
            }
            const it = c.items[0];
            const chosen = it.id === selectedKey || it.id === hoverKey;
            const choose = () => {
                setGroupKeys(null);
                setSelectedKey(it.id);
            };
            if (it.kind === 'event') {
                const e = it.e;
                const kind: MarkerKind = chosen ? 'choisi' : e.highlight === 'A_LA_UNE' ? 'une' : 'prix';
                const marker = L.marker([e.lat, e.lng], { icon: anchor(mapMarkerHtml(kind, markerText(e))), keyboard: true, title: markerAlt(e), alt: markerAlt(e), zIndexOffset: chosen ? 1000 : e.highlight ? 500 : 0, riseOnHover: true });
                marker.on('click', choose);
                marker.on('keypress', (ev: import('leaflet').LeafletKeyboardEvent) => { if (activates(ev.originalEvent)) { ev.originalEvent.preventDefault(); choose(); } });
                layer.addLayer(marker);
                // Nom du bouton : titre, date, prix (sinon le lecteur d'écran ne lisait que le prix visible, « Dès 5 000 F »)
                marker.getElement()?.setAttribute('aria-label', markerAlt(e));
                continue;
            }
            // Lieu : repère de sa forme (bâtiment, couverts ; pointillé pour un particulier), même clavier que les événements
            const name = placeAccessibleName(it.p);
            const placeMarker = L.marker([it.lat, it.lng], { icon: anchor(placeMarkerHtml(it.p, chosen)), keyboard: true, title: name, alt: name, zIndexOffset: chosen ? 1000 : 0, riseOnHover: true });
            placeMarker.on('click', choose);
            placeMarker.on('keypress', (ev: import('leaflet').LeafletKeyboardEvent) => { if (activates(ev.originalEvent)) { ev.originalEvent.preventDefault(); choose(); } });
            layer.addLayer(placeMarker);
            placeMarker.getElement()?.setAttribute('aria-label', name);
        }
    }, [items, zoom, selectedKey, hoverKey, ready]);

    // Vignette choisie gardée visible dans la liste de l'ordinateur
    useEffect(() => {
        if (!selectedKey) return;
        document.getElementById(`carte-vignette-${selectedKey.replace(':', '-')}`)?.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
    }, [selectedKey]);

    const visible = useMemo(() => items.filter((it) => inZone(it, visibleZone)), [items, visibleZone]);
    const counts = useMemo(() => ({
        evenements: visible.filter((i) => i.layer === 'evenements').length,
        salles: visible.filter((i) => i.layer === 'salles').length,
        restaurants: visible.filter((i) => i.layer === 'restaurants').length,
    }), [visible]);
    const selected = selectedKey ? items.find((it) => it.id === selectedKey) ?? null : null;
    const group = groupKeys ? items.filter((it) => groupKeys.includes(it.id)) : null;
    const countText = loading ? 'Chargement…' : zoneCountText(counts, active);
    const showLayers = available.length > 1;
    const empty = ready && !loading && !error && active.size > 0 && visible.length === 0;
    /** Survol d'une vignette de la liste : repère mis en évidence (événement, puis lieu). */
    const setHoverId = (id: string | null) => setHoverKey(id ? `e:${id}` : null);
    const setHoverPlace = (id: string | null) => setHoverKey(id ? `p:${id}` : null);

    const card = (it: Item, opts: { action?: string; list?: boolean } = {}) => (
        it.kind === 'event'
            ? (opts.list
                ? <MapEventCard event={it.e} highlighted={it.id === selectedKey || it.id === hoverKey} onHover={setHoverId} />
                : <MapEventCard event={it.e} action={opts.action} />)
            : <MapPlaceCard place={it.p} highlighted={opts.list && (it.id === selectedKey || it.id === hoverKey)} onHover={opts.list ? setHoverPlace : undefined} action={opts.action} />
    );

    const sections: Array<{ layer: MapLayer; title: string; list: Item[] }> = [
        { layer: 'evenements', title: 'Événements', list: visible.filter((i) => i.layer === 'evenements') },
        { layer: 'salles', title: 'Salles', list: visible.filter((i) => i.layer === 'salles') },
        { layer: 'restaurants', title: 'Restaurants', list: visible.filter((i) => i.layer === 'restaurants') },
    ].filter((s) => active.has(s.layer as MapLayer) && s.list.length > 0) as Array<{ layer: MapLayer; title: string; list: Item[] }>;

    return (
        <div className="lg:grid lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-5">
            {/* Ordinateur : liste synchronisée avec la zone visible */}
            <section aria-labelledby="carte-liste-titre" className="hidden min-h-0 lg:flex lg:flex-col">
                <h2 id="carte-liste-titre" className="text-base font-semibold text-foreground-strong tabular-nums" aria-live="polite">{countText}</h2>
                <div className="mt-3 max-h-[70vh] min-h-[20rem] space-y-4 overflow-y-auto pr-1">
                    {sections.map((s) => (
                        <div key={s.layer}>
                            {(sections.length > 1 || s.layer !== 'evenements') && (
                                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{`${s.title} · ${s.list.length}`}</h3>
                            )}
                            <ul className="space-y-2">
                                {s.list.map((it) => (
                                    <li key={it.id} id={`carte-vignette-${it.id.replace(':', '-')}`}>{card(it, { list: true })}</li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            </section>

            <div className="space-y-3">
                {showLayers && (
                    <LayerPills available={available} active={active} counts={loading ? {} : counts} onToggle={toggleLayer} />
                )}
                {(wantHalls || wantVenues) && (
                    // Filtres des couches repliés (bouton natif « Filtrer ») : sur un téléphone, la carte reste à l'écran
                    <details className="group rounded-xl border border-border bg-card">
                        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl px-3 text-sm font-semibold text-foreground-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                            <SlidersHorizontal size={16} aria-hidden="true" />
                            <span>{wantHalls && wantVenues ? 'Filtrer les salles et les restaurants' : wantHalls ? 'Filtrer les salles' : 'Filtrer les restaurants'}</span>
                            {activeFilters > 0 && (
                                <span className="rounded-full bg-primary-soft px-2 tabular-nums text-primary-text">{activeFilters}</span>
                            )}
                            <ChevronDown size={16} aria-hidden="true" className="ml-auto text-muted-foreground motion-safe:transition-transform motion-safe:duration-200 group-open:rotate-180" />
                        </summary>
                        <div className="flex flex-col gap-3 border-t border-border p-3 sm:flex-row sm:flex-wrap sm:gap-6">
                            {wantHalls && <HallFilters value={hallFilters} onChange={setHallFilters} />}
                            {wantVenues && <VenueFilters value={venueFilters} onChange={setVenueFilters} />}
                        </div>
                    </details>
                )}
                <div className="flex flex-wrap items-end gap-2">
                    {/* Champ de sélection écrit sur place (mêmes classes que components/ui/Field) : le module partagé des champs
                        n'entre pas dans ce module à la demande (poids du premier chargement d'Explorer) */}
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:max-w-xs">
                        <label htmlFor={placeId} className="text-sm font-semibold text-foreground-strong">Aller à</label>
                        <div className="relative">
                            <select
                                id={placeId}
                                value={place}
                                onChange={(ev) => choosePlace(ev.target.value)}
                                className="min-h-12 w-full cursor-pointer appearance-none rounded-xl border border-input bg-card px-3.5 py-2.5 pr-10 text-base text-foreground-strong transition-colors duration-fast focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                            >
                                <option value="">Ville ou quartier</option>
                                {QUICK_PLACES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                            </select>
                            <ChevronDown size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                        </div>
                    </div>
                    <Button variant="secondary" onClick={aroundMe} leftIcon={<LocateFixed size={18} />} className="min-h-11">
                        Autour de moi
                    </Button>
                </div>
                {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
                {truncated && !loading && (
                    <p role="status" className="text-sm text-muted-foreground">
                        {showLayers ? 'Beaucoup de résultats ici' : 'Beaucoup d’événements ici'} : rapprochez-vous, puis touchez « Rechercher dans cette zone ».
                    </p>
                )}

                {/* Contexte d'empilement propre : boutons et feuille de la carte (z-10) restent sous la barre des catégories
                    collée en haut de la page (z-10 elle aussi, avant dans la page) quand la carte défile dessous (run 618) */}
                <div className="relative isolate">
                    <div
                        ref={containerRef}
                        role="region"
                        aria-label={showLayers ? 'Carte des événements et des lieux' : 'Carte des événements'}
                        aria-describedby={descId}
                        className="isolate h-[62vh] min-h-[20rem] w-full overflow-hidden rounded-xl border border-border bg-muted lg:h-[70vh]"
                    />
                    <p id={descId} className="sr-only">
                        Les repères sont accessibles avec la touche Tabulation, puis Entrée. La vue Liste présente les mêmes événements.
                        Un lieu tenu par un particulier est placé au centre d’une zone d’environ 300 mètres : son adresse exacte est donnée après la réservation.
                    </p>

                    {moved && (
                        // Place laissée aux boutons de zoom (en haut à droite) : aucun chevauchement à 360 px (capture du run 617)
                        <div className="pointer-events-none absolute left-2 right-16 top-3 z-10 flex justify-center sm:left-16">
                            <Button size="sm" variant="secondary" onClick={searchHere} leftIcon={<Search size={16} />} className="pointer-events-auto min-h-11 shadow-popover">
                                Rechercher dans cette zone
                            </Button>
                        </div>
                    )}

                    {(loading || error) && (
                        <div className="pointer-events-none absolute inset-x-0 top-16 z-10 flex justify-center px-3">
                            <div role="status" className="pointer-events-auto flex items-center gap-3 rounded-xl border border-border bg-popover px-4 py-2 text-sm text-foreground shadow-popover">
                                {error ? (
                                    <>
                                        <span>{error}</span>
                                        <Button size="sm" variant="ghost" onClick={() => void load()} leftIcon={<RefreshCw size={16} />}>Réessayer</Button>
                                    </>
                                ) : active.size === 1 && wantEvents ? 'Chargement des événements…' : 'Chargement de la carte…'}
                            </div>
                        </div>
                    )}

                    {empty && !selected && !group && (
                        // État vide : illustration, phrase, « Élargir la zone » (au-dessus de la mention des fonds)
                        <div className="pointer-events-none absolute inset-x-0 bottom-12 z-10 flex justify-center px-3">
                            <div role="status" className="ev-sheet-up pointer-events-auto flex max-w-sm flex-col items-center gap-2 rounded-2xl border border-border bg-popover px-5 py-4 text-center shadow-popover">
                                <EmptyIllustration />
                                <p className="text-base font-semibold text-foreground-strong">
                                    {active.size === 1 && wantEvents ? 'Aucun événement dans cette zone' : 'Rien à afficher dans cette zone'}
                                </p>
                                <p className="text-sm text-muted-foreground">Élargissez la zone, ou changez la date et le nombre de personnes.</p>
                                <Button size="sm" variant="secondary" onClick={widen} leftIcon={<ZoomOut size={16} />} className="min-h-11">
                                    Élargir la zone
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Téléphone : feuille en bas de la carte, élément touché (ou groupe au même endroit) ; au-dessus de la
                        mention des fonds (deux lignes à 360 px), qui reste visible */}
                    {(selected || group) && (
                        <div
                            role="dialog"
                            aria-modal="false"
                            aria-label={selected ? (selected.kind === 'event' ? selected.e.title : selected.p.name) : group ? groupLabel(group) : ''}
                            className={cn('absolute inset-x-2 bottom-11 z-10 max-h-[70%] overflow-y-auto rounded-2xl border border-border bg-popover p-3 shadow-popover', 'ev-sheet-up', !group && 'lg:hidden')}
                        >
                            <div className="mb-2 flex items-center justify-between gap-2">
                                <p className="text-sm font-semibold text-muted-foreground">
                                    {group ? `${groupLabel(group)} à cet endroit` : selected?.kind === 'event' ? 'Événement choisi' : selected?.layer === 'salles' ? 'Salle choisie' : 'Restaurant choisi'}
                                </p>
                                <IconButton aria-label="Fermer" variant="ghost" onClick={() => { setSelectedKey(null); setGroupKeys(null); }}>
                                    <X size={18} />
                                </IconButton>
                            </div>
                            {selected && selected.kind === 'place' ? (
                                <PlaceSheetCard place={selected.p} />
                            ) : (
                                <ul className="space-y-2">
                                    {(group ?? (selected ? [selected] : [])).map((it) => (
                                        <li key={it.id}>{card(it, { action: it.kind === 'event' ? 'Voir l’événement' : it.layer === 'salles' ? 'Voir la salle' : 'Voir l’établissement' })}</li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}
                </div>
                <p className="text-sm text-muted-foreground lg:hidden" aria-live="polite">{countText}</p>
            </div>
        </div>
    );
}
