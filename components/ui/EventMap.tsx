'use client';

import React, { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import { addThemedTiles, setTilesTheme, useMapTheme } from '@/components/map/themedTiles';
import { mapMarkerHtml } from './MapMarker';
import { cn } from './cn';

interface EventMapProps {
    latitude: number;
    longitude: number;
    venueName?: string;
    /**
     * Design 1b (point 6) : nom de l'événement écrit sur le repère (forme « Repère » de la charte, choisi : orange de la
     * marque, texte #1A1A1A). Sans lui : épingle classique et bulle du lieu ouverte (fiche admin, pilotage).
     */
    eventName?: string;
    className?: string;
}


/**
 * Lot Carte B — Leaflet pour les cartes d'Explorer et l'aperçu de l'accueil : ils chargent CE module à la demande et
 * prennent Leaflet (et sa feuille de style, importée ci-dessus) ici, sans ajouter de morceau de code à charger : la table
 * des morceaux, chargée par toutes les pages, ne grossit pas (budgets JS de toutes les routes).
 */
export function loadLeaflet(): typeof import('leaflet') {
    return require('leaflet') as typeof import('leaflet');
}

/**
 * Lot Carte B — aperçu de la carte de l'accueil (« Partout au Sénégal ») servi par CE module : il est déjà chargeable à
 * la demande (fiche, administration, pilotage) ; l'accueil le charge quand l'aperçu devient visible, sans morceau de code ni
 * entrée de plus dans la table que toutes les pages chargent.
 */
export { default as SenegalMapPreview } from '@/components/explore/SenegalMapPreview';

/** Nom affiché sur le repère : 28 caractères au plus (le nom entier reste dans le texte de remplacement). */
export function markerName(name: string): string {
    const t = name.trim().replace(/\s+/g, ' ');
    return t.length > 28 ? `${t.slice(0, 27).trimEnd()}…` : t;
}

/**
 * Carte du lieu (relecture des captures du run 50) :
 *  - feuille de style et icônes servies par l'application (public/leaflet), plus d'unpkg ;
 *  - boutons de zoom en français, 44 px (règle .leaflet-control-zoom de app/globals.css) ;
 *  - repère non focalisable (il n'a aucune action au clavier) avec un texte de remplacement : le lieu est
 *    aussi écrit en clair sur la page et l'itinéraire est proposé par un lien ;
 *  - nom du lieu inséré comme texte (plus de HTML construit à partir d'une saisie de l'organisateur) ; le nom de
 *    l'événement sur le repère passe par mapMarkerHtml, qui l'échappe ;
 *  - bulle du lieu (run 52) : bouton de fermeture « Fermer la bulle », 44 × 44 px, texte à 14 px et
 *    couleurs des jetons dans les deux thèmes (règles .leaflet-popup-* de app/globals.css).
 */
export const EventMap: React.FC<EventMapProps> = ({ latitude, longitude, venueName, eventName, className }) => {
    const mapRef = useRef<HTMLDivElement>(null);
    // Lot Carte B (B1) : fond Stadia du thème (lib/map/tiles.ts), changé sans recréer la carte
    const theme = useMapTheme();
    const themeRef = useRef(theme);
    themeRef.current = theme;
    const tilesRef = useRef<import('leaflet').TileLayer | null>(null);

    useEffect(() => {
        const container = mapRef.current;
        if (!container) return;

        // Leaflet lit window : chargé dans le navigateur seulement, après le montage.
        const L = require('leaflet') as typeof import('leaflet');

        const icon = eventName
            // Repère de la charte : le point d'ancrage (0, 0) est le lieu ; le billet est remonté de toute sa hauteur et
            // centré, sa pointe touche le lieu quelle que soit la longueur du nom.
            ? L.divIcon({
                className: 'ev-repere-ancre',
                html: `<span style="position:absolute;left:0;top:0;transform:translate(-50%,-100%)">${mapMarkerHtml('choisi', markerName(eventName))}</span>`,
                iconSize: [0, 0],
                iconAnchor: [0, 0],
                popupAnchor: [0, -48],
            })
            : L.icon({
                iconUrl: '/leaflet/marker-icon.png',
                iconRetinaUrl: '/leaflet/marker-icon-2x.png',
                shadowUrl: '/leaflet/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41],
            });

        const map = L.map(container, {
            center: [latitude, longitude],
            zoom: 15,
            zoomControl: false,
            scrollWheelZoom: false,
        });
        // En bas à gauche : en haut, il recouvrait le début de la bulle du lieu, ouverte d'office (run 98).
        L.control.zoom({ position: 'bottomleft', zoomInTitle: 'Zoom avant', zoomOutTitle: 'Zoom arrière' }).addTo(map);

        // Lot 7 (D74) : mention légale des tuiles marquée comme légende pour le contrôle des captures ; finition 2b (A) : sans
        // « Leaflet ». Lot Carte B : fond et mention de Stadia (addThemedTiles).
        tilesRef.current = addThemedTiles(L, map, themeRef.current);

        const alt = eventName
            ? `${eventName}${venueName ? `, ${venueName}` : ''}`
            : venueName ? `Emplacement : ${venueName}` : 'Emplacement du lieu';
        const marker = L.marker([latitude, longitude], { icon, keyboard: false, alt }).addTo(map);
        if (venueName) {
            const label = document.createElement('strong');
            label.textContent = venueName;
            // Leaflet écrit « Close popup » en dur sur le bouton de fermeture : libellé français posé à
            // chaque ouverture (la bulle peut être reconstruite) ; cible de 44 px par app/globals.css.
            marker.on('popupopen', (e: import('leaflet').PopupEvent) => {
                e.popup.getElement()?.querySelector('.leaflet-popup-close-button')?.setAttribute('aria-label', 'Fermer la bulle');
            });
            // Design 1c (point 1) : bulle bornée à la largeur de la carte et ramenée dedans (à 320 px, le bouton de
            // fermeture sortait du cadre)
            marker.bindPopup(label, { maxWidth: Math.max(120, container.clientWidth - 88), autoPanPadding: [8, 8], keepInView: true });
            // Avec le nom de l'événement sur le repère, la bulle du lieu s'ouvre au toucher seulement.
            if (!eventName) marker.openPopup();
        }

        return () => {
            tilesRef.current = null;
            map.remove();
        };
    }, [latitude, longitude, venueName, eventName]);

    useEffect(() => {
        setTilesTheme(tilesRef.current, theme);
    }, [theme]);

    return (
        <div
            ref={mapRef}
            role="region"
            aria-label={venueName ? `Carte : ${venueName}` : 'Carte du lieu'}
            className={cn('isolate h-48 w-full overflow-hidden rounded-xl border border-border bg-background sm:h-56', className)}
        />
    );
};
