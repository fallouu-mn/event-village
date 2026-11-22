'use client';

import React, { useEffect, useRef, useState } from 'react';
import { addThemedTiles, setTilesTheme, useMapTheme } from '@/components/map/themedTiles';
import { mapUrl, readMapEvents } from '@/lib/events/map-client';
import { SENEGAL_BOUNDS } from '@/lib/events/map-shared';
import { clusterPoints } from '@/lib/map/cluster';

/**
 * Lot Carte B (4) — aperçu de la carte sur l'accueil (« Partout au Sénégal »), chargé seulement quand la section devient
 * visible (components/events/HomeSenegalMap.tsx), par le module de la carte de la fiche (components/ui/EventMap.tsx, qui
 * le réexporte) : aucun morceau de code de plus pour l'application. Carte immobile : ni glisser, ni zoom, ni clavier (le bouton « Ouvrir la
 * carte » de la section mène à la vraie carte d'Explorer) ; repères non focalisables. Fond Stadia du thème, mention des
 * fonds visible ; événements en points orange sans texte (« À la une » cerclé), un groupe en point plus grand. Tuiles
 * indisponibles : l'aperçu est retiré, la section garde son bouton.
 */

type LeafletModule = typeof import('leaflet');

const SENEGAL_LATLNG: [[number, number], [number, number]] = [[SENEGAL_BOUNDS.south, SENEGAL_BOUNDS.west], [SENEGAL_BOUNDS.north, SENEGAL_BOUNDS.east]];

export default function SenegalMapPreview({ onCount, onUnavailable }: { onCount: (n: number) => void; onUnavailable: () => void }) {
    const ref = useRef<HTMLDivElement>(null);
    const tilesRef = useRef<import('leaflet').TileLayer | null>(null);
    const theme = useMapTheme();
    const themeRef = useRef(theme);
    themeRef.current = theme;
    const cbs = useRef({ onCount, onUnavailable });
    cbs.current = { onCount, onUnavailable };
    const [error, setError] = useState(false);

    useEffect(() => {
        const container = ref.current;
        if (!container) return undefined;
        let alive = true;
        let created: import('leaflet').Map | null = null;
        const build = (L: LeafletModule) => {
            const map = L.map(container, {
                zoomControl: false, dragging: false, touchZoom: false, scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false,
                keyboard: false, zoomSnap: 0.25, zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false,
            });
            created = map;
            map.fitBounds(SENEGAL_LATLNG, { animate: false, padding: [8, 8] });
            const tiles = addThemedTiles(L, map, themeRef.current);
            tilesRef.current = tiles;
            let loaded = 0;
            let failures = 0;
            tiles.on('tileload', () => { loaded += 1; });
            tiles.on('tileerror', () => {
                failures += 1;
                if (loaded === 0 && failures === 4) cbs.current.onUnavailable();
            });
            void readMapEvents('accueil-carte', mapUrl('')).then((r) => {
                if (!alive) return;
                if (!r.ok) {
                    setError(true);
                    return;
                }
                cbs.current.onCount(r.data.total);
                const z = map.getZoom();
                const points = r.data.events.map((e) => {
                    const p = map.project([e.lat, e.lng], z);
                    return { item: e, x: p.x, y: p.y };
                });
                // Points sans texte (aperçu décoratif : aucune étiquette coupée au bord de la carte) ; un groupe = point plus grand
                for (const c of clusterPoints(points, (e) => e.id, 40)) {
                    const size = c.items.length > 1 ? Math.min(28, 14 + 3 * Math.round(Math.log2(c.items.length + 1))) : 14;
                    const featured = c.items.some((e) => e.highlight === 'A_LA_UNE');
                    L.marker(map.unproject([c.x, c.y], z), {
                        icon: L.divIcon({
                            className: featured ? 'ev-point ev-point--une' : 'ev-point',
                            iconSize: [size, size],
                            iconAnchor: [size / 2, size / 2],
                        }),
                        interactive: false,
                        keyboard: false,
                    }).addTo(map);
                }
            });
        };
        // Leaflet (et sa feuille de style, importée par components/ui/EventMap.tsx, qui sert ce module) : déjà dans ce morceau
        build(require('leaflet') as LeafletModule);
        return () => {
            alive = false;
            tilesRef.current = null;
            created?.remove();
        };
    }, []);

    useEffect(() => {
        setTilesTheme(tilesRef.current, theme);
    }, [theme]);

    return (
        <div className="relative h-full w-full">
            <div ref={ref} role="region" aria-label="Aperçu de la carte des événements" className="isolate h-full w-full" />
            {error && (
                <p role="status" className="absolute inset-x-3 top-3 z-10 rounded-lg bg-popover px-3 py-2 text-sm text-foreground shadow-popover">
                    Les événements n’ont pas pu être placés sur la carte. Ouvrez la carte pour réessayer.
                </p>
            )}
        </div>
    );
}
