'use client';

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import { LocateFixed, RefreshCw, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Select } from '@/components/ui/Field';
import { clusterLabel, mapMarkerHtml, type MarkerKind } from '@/components/ui/MapMarker';
import { addThemedTiles, setTilesTheme, useMapTheme } from '@/components/map/themedTiles';
import { MapEventCard, mapEventWhen } from '@/components/explore/MapEventCard';
import { cn } from '@/components/ui/cn';
import type { CatalogFilterState } from '@/lib/events/catalog-filters';
import { mapUrl, readMapEvents } from '@/lib/events/map-client';
import { priceBadge, QUICK_PLACES, SENEGAL_BOUNDS, type MapZone, type PublicMapEvent } from '@/lib/events/map-shared';
import { clusterPoints } from '@/lib/map/cluster';

/**
 * Lot Carte B (B2) — vue Carte d'Explorer, chargée à la demande (jamais au premier chargement d'Explorer) :
 *  - fond Stadia du thème (components/map/themedTiles.ts) ; aucune tuile avant l'ouverture de la vue ; si les tuiles ne
 *    viennent pas, `onTilesFailed` fait basculer Explorer sur la Liste avec un message simple ;
 *  - points regroupés avec leur nombre (lib/map/cluster.ts), pastilles de prix (« Gratuit », « Dès 5 000 F »), « À la une »
 *    en orange ; repère touché ou survolé : forme « choisi » (orange, agrandi) ;
 *  - téléphone : feuille en bas de la carte avec l'événement touché et « Voir l'événement » ; ordinateur : liste à gauche
 *    synchronisée avec la zone visible, survol ou focus d'une vignette = repère mis en évidence ;
 *  - « Rechercher dans cette zone » après un déplacement ; « Autour de moi » (position de l'appareil utilisée pour centrer
 *    la carte, jamais envoyée ni gardée) ; choix rapide de ville ou de quartier ;
 *  - clavier : repères focalisables (Entrée = toucher), boutons de zoom ; la vue Liste reste l'alternative complète ;
 *  - « réduire les animations » : zoom et déplacements sans animation.
 */

type LeafletModule = typeof import('leaflet');
type LeafletMap = import('leaflet').Map;

const SENEGAL_LATLNG: [[number, number], [number, number]] = [[SENEGAL_BOUNDS.south, SENEGAL_BOUNDS.west], [SENEGAL_BOUNDS.north, SENEGAL_BOUNDS.east]];
/** Tuiles en échec sans aucune réussie : au-delà, la carte est déclarée indisponible. */
const TILE_FAILURES_MAX = 4;
/** Zoom au-delà duquel un groupe ne s'ouvre plus en zoomant (points au même endroit) : la liste du groupe s'affiche. */
const GROUP_ZOOM_LIMIT = 16;

function reducedMotion(): boolean {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function zoneOf(map: LeafletMap): MapZone {
    const b = map.getBounds();
    return { south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() };
}

function inZone(e: PublicMapEvent, z: MapZone | null): boolean {
    return !z || (e.lat >= z.south && e.lat <= z.north && e.lng >= z.west && e.lng <= z.east);
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

export default function ExploreMap({ filters, onTilesFailed, refreshKey = 0 }: {
    filters: CatalogFilterState;
    onTilesFailed: () => void;
    /** Signal temps réel d'Explorer : relecture (un événement suspendu ou annulé disparaît). */
    refreshKey?: number;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<LeafletMap | null>(null);
    const leafletRef = useRef<LeafletModule | null>(null);
    const layerRef = useRef<import('leaflet').LayerGroup | null>(null);
    const tilesRef = useRef<import('leaflet').TileLayer | null>(null);
    const failedRef = useRef(onTilesFailed);
    failedRef.current = onTilesFailed;
    const theme = useMapTheme();
    const themeRef = useRef(theme);
    themeRef.current = theme;
    const descId = useId();

    const [ready, setReady] = useState(false);
    const [zoom, setZoom] = useState(0);
    const [visibleZone, setVisibleZone] = useState<MapZone | null>(null);
    /** Zone de la dernière lecture (null : tout le Sénégal). */
    const [searchZone, setSearchZone] = useState<MapZone | null>(null);
    const [moved, setMoved] = useState(false);
    const [events, setEvents] = useState<PublicMapEvent[]>([]);
    const [truncated, setTruncated] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [hoverId, setHoverId] = useState<string | null>(null);
    const [groupIds, setGroupIds] = useState<string[] | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [place, setPlace] = useState('');
    const seq = useRef(0);

    // 1. Carte créée une fois, à l'ouverture de la vue (Leaflet lit window : chargé dans le navigateur seulement)
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return undefined;
        const L = require('leaflet') as LeafletModule;
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
        layerRef.current = L.layerGroup().addTo(map);
        const sync = () => {
            setZoom(map.getZoom());
            setVisibleZone(zoneOf(map));
        };
        map.on('zoomend moveend', sync);
        // Déplacement voulu par la personne (glisser, zoom, clavier) : « Rechercher dans cette zone » proposé
        map.on('dragend zoomend', () => setMoved(true));
        map.on('click', () => { setSelectedId(null); setGroupIds(null); });
        mapRef.current = map;
        sync();
        setMoved(false);
        setReady(true);
        return () => {
            map.remove();
            mapRef.current = null;
            layerRef.current = null;
            tilesRef.current = null;
        };
    }, []);

    useEffect(() => {
        setTilesTheme(tilesRef.current, theme);
    }, [theme]);

    // 2. Lecture : filtres partagés, zone de la dernière recherche (tout le Sénégal au départ)
    const url = useMemo(() => mapUrl(filters, { zone: searchZone }), [filters, searchZone]);
    const load = useCallback(async () => {
        const n = ++seq.current;
        setLoading(true);
        const r = await readMapEvents('carte', url);
        if (n !== seq.current) return;
        setLoading(false);
        if (!r.ok) {
            setError(r.message);
            return;
        }
        setError(null);
        setEvents(r.data.events);
        setTruncated(r.data.truncated);
        setSelectedId((id) => (id && r.data.events.some((e) => e.id === id) ? id : null));
    }, [url]);
    useEffect(() => { void load(); }, [load, refreshKey]);

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

    // 3. Repères : regroupés au zoom courant ; repère choisi ou survolé mis en évidence
    useEffect(() => {
        const L = leafletRef.current;
        const map = mapRef.current;
        const layer = layerRef.current;
        if (!L || !map || !layer || !ready) return;
        layer.clearLayers();
        const z = map.getZoom();
        const points = events.map((e) => {
            const p = map.project([e.lat, e.lng], z);
            return { item: e, x: p.x, y: p.y };
        });
        for (const c of clusterPoints(points, (e) => e.id)) {
            const at = map.unproject([c.x, c.y], z);
            if (c.items.length > 1) {
                const label = clusterLabel(c.items.length);
                const marker = L.marker(at, {
                    icon: L.divIcon({ className: 'ev-repere-ancre', html: `<span style="position:absolute;left:0;top:0;transform:translate(-50%,-100%)">${mapMarkerHtml('pile', String(c.items.length))}</span>`, iconSize: [0, 0], iconAnchor: [0, 0] }),
                    keyboard: true,
                    title: `${label} : agrandir`,
                    alt: `${label} : agrandir`,
                    riseOnHover: true,
                });
                marker.on('click', () => {
                    const bounds = L.latLngBounds(c.items.map((e) => [e.lat, e.lng] as [number, number]));
                    const samePlace = bounds.getNorthEast().equals(bounds.getSouthWest(), 1e-5);
                    if (samePlace || map.getZoom() >= GROUP_ZOOM_LIMIT) {
                        setGroupIds(c.items.map((e) => e.id));
                        setSelectedId(null);
                        return;
                    }
                    map.fitBounds(bounds.pad(0.3), { animate: !reducedMotion(), maxZoom: GROUP_ZOOM_LIMIT });
                });
                layer.addLayer(marker);
                continue;
            }
            const e = c.items[0];
            const chosen = e.id === selectedId || e.id === hoverId;
            const kind: MarkerKind = chosen ? 'choisi' : e.highlight === 'A_LA_UNE' ? 'une' : 'prix';
            const marker = L.marker([e.lat, e.lng], {
                icon: L.divIcon({ className: 'ev-repere-ancre', html: `<span style="position:absolute;left:0;top:0;transform:translate(-50%,-100%)">${mapMarkerHtml(kind, markerText(e))}</span>`, iconSize: [0, 0], iconAnchor: [0, 0] }),
                keyboard: true,
                title: markerAlt(e),
                alt: markerAlt(e),
                zIndexOffset: chosen ? 1000 : e.highlight ? 500 : 0,
                riseOnHover: true,
            });
            marker.on('click', () => {
                setGroupIds(null);
                setSelectedId(e.id);
            });
            layer.addLayer(marker);
        }
    }, [events, zoom, selectedId, hoverId, ready]);

    // Vignette choisie gardée visible dans la liste de l'ordinateur
    useEffect(() => {
        if (!selectedId) return;
        document.getElementById(`carte-vignette-${selectedId}`)?.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
    }, [selectedId]);

    const visible = useMemo(() => events.filter((e) => inZone(e, visibleZone)), [events, visibleZone]);
    const selected = selectedId ? events.find((e) => e.id === selectedId) ?? null : null;
    const group = groupIds ? events.filter((e) => groupIds.includes(e.id)) : null;
    const countText = loading ? 'Chargement…' : visible.length === 0 ? 'Aucun événement dans cette zone' : visible.length === 1 ? '1 événement dans cette zone' : `${visible.length} événements dans cette zone`;

    return (
        <div className="lg:grid lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-5">
            {/* Ordinateur : liste synchronisée avec la zone visible */}
            <section aria-labelledby="carte-liste-titre" className="hidden min-h-0 lg:flex lg:flex-col">
                <h2 id="carte-liste-titre" className="text-base font-semibold text-foreground-strong tabular-nums" aria-live="polite">{countText}</h2>
                <ul className="mt-3 max-h-[70vh] min-h-[20rem] space-y-2 overflow-y-auto pr-1">
                    {visible.map((e) => (
                        <li key={e.id} id={`carte-vignette-${e.id}`}>
                            <MapEventCard event={e} highlighted={e.id === selectedId || e.id === hoverId} onHover={setHoverId} />
                        </li>
                    ))}
                </ul>
            </section>

            <div className="space-y-3">
                <div className="flex flex-wrap items-end gap-2">
                    <div className="min-w-0 flex-1 sm:max-w-xs">
                        <Select
                            label="Aller à"
                            value={place}
                            onChange={(ev) => choosePlace(ev.target.value)}
                            options={[{ value: '', label: 'Choisir une ville ou un quartier' }, ...QUICK_PLACES.map((p) => ({ value: p.id, label: p.label }))]}
                        />
                    </div>
                    <Button variant="secondary" onClick={aroundMe} leftIcon={<LocateFixed size={18} />} className="min-h-11">
                        Autour de moi
                    </Button>
                </div>
                {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
                {truncated && !loading && (
                    <p role="status" className="text-sm text-muted-foreground">
                        Beaucoup d’événements ici : rapprochez-vous, puis touchez « Rechercher dans cette zone ».
                    </p>
                )}

                <div className="relative">
                    <div
                        ref={containerRef}
                        role="region"
                        aria-label="Carte des événements"
                        aria-describedby={descId}
                        className="isolate h-[62vh] min-h-[20rem] w-full overflow-hidden rounded-xl border border-border bg-muted lg:h-[70vh]"
                    />
                    <p id={descId} className="sr-only">
                        Les repères sont accessibles avec la touche Tabulation, puis Entrée. La vue Liste présente les mêmes événements.
                    </p>

                    {moved && (
                        <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center">
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
                                ) : 'Chargement des événements…'}
                            </div>
                        </div>
                    )}

                    {/* Téléphone : feuille en bas de la carte, événement touché (ou groupe au même endroit) ; au-dessus de la
                        mention des fonds (deux lignes à 360 px), qui reste visible */}
                    {(selected || group) && (
                        <div
                            role="dialog"
                            aria-modal="false"
                            aria-label={selected ? selected.title : `${group?.length ?? 0} événements à cet endroit`}
                            className={cn('absolute inset-x-2 bottom-11 z-10 max-h-[55%] overflow-y-auto rounded-2xl border border-border bg-popover p-3 shadow-popover', 'ev-sheet-up', !group && 'lg:hidden')}
                        >
                            <div className="mb-2 flex items-center justify-between gap-2">
                                <p className="text-sm font-semibold text-muted-foreground">
                                    {group ? `${group.length} événements à cet endroit` : 'Événement choisi'}
                                </p>
                                <IconButton aria-label="Fermer" variant="ghost" onClick={() => { setSelectedId(null); setGroupIds(null); }}>
                                    <X size={18} />
                                </IconButton>
                            </div>
                            <ul className="space-y-2">
                                {(group ?? (selected ? [selected] : [])).map((e) => (
                                    <li key={e.id}>
                                        <MapEventCard event={e} action="Voir l’événement" />
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
                <p className="text-sm text-muted-foreground lg:hidden" aria-live="polite">{countText}</p>
            </div>
        </div>
    );
}
