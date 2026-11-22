'use client';

import { useTheme } from '@/components/providers/ThemeProvider';
import { tileConfig, type MapTheme } from '@/lib/map/tiles';

/**
 * Lot Carte B (B1) — fond de carte du thème (Stadia « Alidade Smooth » en clair, « Alidade Smooth Dark » en sombre ;
 * lib/map/tiles.ts), partagé par toutes les cartes Leaflet.
 *  - Mention des fonds toujours visible (contrôle d'attribution de Leaflet, sans le préfixe « Leaflet »), marquée comme
 *    légende pour le contrôle des captures (data-ev-caption ; lot 7, D74).
 *  - Changement de thème : la même couche change d'adresse (setUrl), la carte n'est pas recréée.
 */

type LeafletModule = typeof import('leaflet');
type LeafletMap = import('leaflet').Map;
type LeafletTileLayer = import('leaflet').TileLayer;

/** Thème de la carte : celui de l'application (clair par défaut). */
export function useMapTheme(): MapTheme {
    const { resolvedTheme } = useTheme();
    return resolvedTheme === 'dark' ? 'dark' : 'light';
}

/** Ajoute la couche des tuiles du thème et la mention des fonds ; rend la couche (pour setUrl au changement de thème). */
export function addThemedTiles(L: LeafletModule, map: LeafletMap, theme: MapTheme): LeafletTileLayer {
    const cfg = tileConfig(theme);
    const layer = L.tileLayer(cfg.url, { attribution: cfg.attribution, maxZoom: cfg.maxZoom });
    layer.addTo(map);
    map.attributionControl?.setPrefix(false);
    map.attributionControl?.getContainer()?.setAttribute('data-ev-caption', '');
    return layer;
}

/** Passe la couche au fond du thème (sans recréer la carte). */
export function setTilesTheme(layer: LeafletTileLayer | null, theme: MapTheme): void {
    if (!layer) return;
    // Leaflet 1.9 : même adresse = aucun nouveau chargement
    layer.setUrl(tileConfig(theme).url);
}
