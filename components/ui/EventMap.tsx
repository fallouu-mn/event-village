'use client';

import React, { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';

interface EventMapProps {
    latitude: number;
    longitude: number;
    venueName?: string;
}

/** Tuiles configurables comme dans MapPicker (NEXT_PUBLIC_MAP_TILE_URL, NEXT_PUBLIC_MAP_TILE_ATTRIBUTION), OpenStreetMap par défaut. */
const TILE_URL = process.env.NEXT_PUBLIC_MAP_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION || '&copy; contributeurs OpenStreetMap';

/**
 * Carte du lieu sur la page publique (relecture des captures du run 50) :
 *  - feuille de style et icônes servies par l'application (public/leaflet), plus d'unpkg ;
 *  - boutons de zoom en français, 44 px (règle .leaflet-control-zoom de app/globals.css) ;
 *  - repère non focalisable (il n'a aucune action au clavier) avec un texte de remplacement : le lieu est
 *    aussi écrit en clair sur la page et l'itinéraire est proposé par un lien ;
 *  - nom du lieu inséré comme texte (plus de HTML construit à partir d'une saisie de l'organisateur) ;
 *  - bulle du lieu (run 52) : bouton de fermeture « Fermer la bulle », 44 × 44 px, texte à 14 px et
 *    couleurs des tokens dans les deux thèmes (règles .leaflet-popup-* de app/globals.css).
 */
export const EventMap: React.FC<EventMapProps> = ({ latitude, longitude, venueName }) => {
    const mapRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const container = mapRef.current;
        if (!container) return;

        // Leaflet lit window : chargé dans le navigateur seulement, après le montage.
        const L = require('leaflet') as typeof import('leaflet');

        const icon = L.icon({
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

        L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(map);
        // Lot 7 (D74) : mention légale des tuiles (12 px de Leaflet) marquée comme légende pour le contrôle des
        // captures (e2e/support/checks.ts, CAPTION_SELECTOR) ; elle reste lisible et n'est pas un contenu.
        map.attributionControl?.setPrefix('Leaflet'); // sans le drapeau du préfixe par défaut de Leaflet
        map.attributionControl?.getContainer()?.setAttribute('data-ev-caption', '');

        const marker = L.marker([latitude, longitude], {
            icon,
            keyboard: false,
            alt: venueName ? `Emplacement : ${venueName}` : 'Emplacement du lieu',
        }).addTo(map);
        if (venueName) {
            const label = document.createElement('strong');
            label.textContent = venueName;
            // Leaflet écrit « Close popup » en dur sur le bouton de fermeture : libellé français posé à
            // chaque ouverture (la bulle peut être reconstruite) ; cible de 44 px par app/globals.css.
            marker.on('popupopen', (e: import('leaflet').PopupEvent) => {
                e.popup.getElement()?.querySelector('.leaflet-popup-close-button')?.setAttribute('aria-label', 'Fermer la bulle');
            });
            marker.bindPopup(label).openPopup();
        }

        return () => {
            map.remove();
        };
    }, [latitude, longitude, venueName]);

    return (
        <div
            ref={mapRef}
            role="region"
            aria-label={venueName ? `Carte : ${venueName}` : 'Carte du lieu'}
            className="isolate h-48 w-full overflow-hidden rounded-xl border border-border bg-surface-sunken sm:h-56"
        />
    );
};
