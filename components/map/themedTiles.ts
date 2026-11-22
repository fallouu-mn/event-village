'use client';

import { useSyncExternalStore } from 'react';
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

/**
 * Thème de la carte : celui de la page (classe `dark` posée sur <html> par le script de démarrage du thème et par
 * components/providers/ThemeProvider.tsx), suivi par un observateur. Lu sur la page plutôt que par le contexte du thème :
 * ce module, partagé par les morceaux de code des cartes chargés à la demande, ne tire pas le fournisseur du thème avec
 * lui (morceau commun de plus, entrée de plus dans la table des morceaux chargée par toutes les pages : run 615).
 */
function subscribeTheme(onChange: () => void): () => void {
    const observer = new MutationObserver(onChange);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
}

function readTheme(): MapTheme {
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function useMapTheme(): MapTheme {
    return useSyncExternalStore(subscribeTheme, readTheme, () => 'light');
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
