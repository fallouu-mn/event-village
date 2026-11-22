'use client';

import React, { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import { addThemedTiles, setTilesTheme, useMapTheme } from '@/components/map/themedTiles';
import { mapMarkerHtml } from '@/components/ui/MapMarker';
import { NO_FILTERS } from '@/lib/events/catalog-filters';
import { mapUrl, readMapEvents } from '@/lib/events/map-client';
import { priceBadge, SENEGAL_BOUNDS } from '@/lib/events/map-shared';
import { clusterPoints } from '@/lib/map/cluster';

/**
 * Lot Carte B (4) — aperçu de la carte sur l'accueil (« Partout au Sénégal »), chargé seulement quand la section devient
 * visible (components/events/HomeDiscovery.tsx). Carte immobile : ni glisser, ni zoom, ni clavier (le bouton « Ouvrir la
 * carte » de la section mène à la vraie carte d'Explorer) ; repères non focalisables. Fond Stadia du thème, mention des
 * fonds visible. Tuiles indisponibles : l'aperçu est retiré, la section garde son bouton.
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
        const L = require('leaflet') as LeafletModule;
        const map = L.map(container, {
            zoomControl: false, dragging: false, touchZoom: false, scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false,
            keyboard: false, zoomSnap: 0.25, zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false,
        });
        map.fitBounds(SENEGAL_LATLNG, { animate: false, padding: [8, 8] });
        const tiles = addThemedTiles(L, map, themeRef.current);
        tilesRef.current = tiles;
        let loaded = 0;
        let failures = 0;
        tiles.on('tileload', () => { loaded += 1; });
        tiles.on('tileerror', () => {
            failures += 1;
            if (loaded === 0 && failures >= 4) cbs.current.onUnavailable();
        });
        let alive = true;
        void readMapEvents('accueil-carte', mapUrl(NO_FILTERS)).then((r) => {
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
            for (const c of clusterPoints(points, (e) => e.id, 72)) {
                const first = c.items[0];
                const html = c.items.length > 1
                    ? mapMarkerHtml('pile', String(c.items.length))
                    : mapMarkerHtml(first.highlight === 'A_LA_UNE' ? 'une' : 'prix', first.highlight === 'A_LA_UNE' ? 'À la une' : priceBadge(first.price) ?? 'Bientôt');
                L.marker(map.unproject([c.x, c.y], z), {
                    icon: L.divIcon({ className: 'ev-repere-ancre', html: `<span style="position:absolute;left:0;top:0;transform:translate(-50%,-100%)">${html}</span>`, iconSize: [0, 0], iconAnchor: [0, 0] }),
                    interactive: false,
                    keyboard: false,
                }).addTo(map);
            }
        });
        return () => {
            alive = false;
            tilesRef.current = null;
            map.remove();
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
