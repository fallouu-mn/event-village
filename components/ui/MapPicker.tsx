'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { LocateFixed, MapPin } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { Button } from './Button';
import { TextInput } from './Field';

interface MapPickerProps {
    latitude: number | null;
    longitude: number | null;
    onChange: (lat: number, lng: number) => void;
    /** Erreur de coordonnées venue du formulaire ou du serveur. */
    error?: string;
    /** Préfixe des identifiants des champs Latitude et Longitude (lien depuis un récapitulatif d'erreurs). */
    idPrefix?: string;
}

const DEFAULT_LAT = 14.6937;
const DEFAULT_LNG = -17.4441;

/**
 * Tuiles de la carte : configurables (NEXT_PUBLIC_MAP_TILE_URL, NEXT_PUBLIC_MAP_TILE_ATTRIBUTION), par défaut
 * OpenStreetMap. La feuille de style et les icônes de Leaflet sont servies par l'application (plus d'unpkg).
 */
const TILE_URL = process.env.NEXT_PUBLIC_MAP_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION || '&copy; contributeurs OpenStreetMap';

const round6 = (n: number): number => Math.round(n * 1e6) / 1e6;

function parseCoordinate(raw: string, limit: number): number | null {
    const normalized = raw.trim().replace(',', '.');
    if (normalized === '') return null;
    const n = Number(normalized);
    return Number.isFinite(n) && n >= -limit && n <= limit ? round6(n) : null;
}

/**
 * Choix de la position d'un lieu (lot 5, contrat F6) : clic sur la carte, repère déplaçable, position de
 * l'appareil, ou saisie au clavier de la latitude et de la longitude (alternative au glisser, WCAG 2.5.7).
 */
export const MapPicker: React.FC<MapPickerProps> = ({ latitude, longitude, onChange, error, idPrefix }) => {
    const generated = useId();
    const prefix = idPrefix ?? `carte-${generated}`;
    const helpId = `${prefix}-aide`;
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<import('leaflet').Map | null>(null);
    const markerRef = useRef<import('leaflet').Marker | null>(null);
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

    const [latText, setLatText] = useState(latitude === null ? '' : String(latitude));
    const [lngText, setLngText] = useState(longitude === null ? '' : String(longitude));
    const [inputError, setInputError] = useState<string | null>(null);
    const [geoMessage, setGeoMessage] = useState<string | null>(null);
    const [locating, setLocating] = useState(false);

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

        const initLat = latitude ?? DEFAULT_LAT;
        const initLng = longitude ?? DEFAULT_LNG;
        const map = L.map(container, { center: [initLat, initLng], zoom: 13, zoomControl: false, keyboard: true });
        // Boutons de zoom en français ; 44 px par la règle .leaflet-control-zoom de app/globals.css
        L.control.zoom({ zoomInTitle: 'Zoom avant', zoomOutTitle: 'Zoom arrière' }).addTo(map);
        L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(map);
        // Lot 7 (D74) : mention légale des tuiles (12 px de Leaflet) marquée comme légende pour le contrôle des
        // captures (e2e/support/checks.ts, CAPTION_SELECTOR) ; elle reste lisible et n'est pas un contenu.
        map.attributionControl?.getContainer()?.setAttribute('data-ev-caption', '');

        // Repère déplaçable à la souris ou au doigt, sans action au clavier dans Leaflet : il n'est pas
        // focalisable (keyboard: false), l'alternative au clavier est la saisie de la latitude et de la
        // longitude ci-dessous (WCAG 2.5.7). Son image garde un texte de remplacement.
        const marker = L.marker([initLat, initLng], {
            draggable: true,
            icon,
            keyboard: false,
            title: 'Position du lieu',
            alt: 'Repère de la position du lieu',
        }).addTo(map);

        marker.on('dragend', () => {
            const pos = marker.getLatLng();
            onChangeRef.current(round6(pos.lat), round6(pos.lng));
        });
        map.on('click', (e: import('leaflet').LeafletMouseEvent) => {
            marker.setLatLng(e.latlng);
            onChangeRef.current(round6(e.latlng.lat), round6(e.latlng.lng));
        });

        mapInstanceRef.current = map;
        markerRef.current = marker;
        return () => {
            map.remove();
            mapInstanceRef.current = null;
            markerRef.current = null;
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        setLatText(latitude === null ? '' : String(latitude));
        setLngText(longitude === null ? '' : String(longitude));
        if (!markerRef.current || latitude === null || longitude === null) return;
        markerRef.current.setLatLng([latitude, longitude]);
        mapInstanceRef.current?.setView([latitude, longitude], mapInstanceRef.current.getZoom());
    }, [latitude, longitude]);

    const applyTyped = (nextLat: string, nextLng: string) => {
        if (nextLat.trim() === '' || nextLng.trim() === '') {
            setInputError(null);
            return;
        }
        const lat = parseCoordinate(nextLat, 90);
        const lng = parseCoordinate(nextLng, 180);
        if (lat === null || lng === null) {
            setInputError('Coordonnées invalides : latitude entre -90 et 90, longitude entre -180 et 180.');
            return;
        }
        setInputError(null);
        onChange(lat, lng);
    };

    const handleUseMyLocation = () => {
        setGeoMessage(null);
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
            setGeoMessage('La localisation n’est pas disponible sur cet appareil : placez le repère sur la carte.');
            return;
        }
        setLocating(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setLocating(false);
                const lat = round6(pos.coords.latitude);
                const lng = round6(pos.coords.longitude);
                onChange(lat, lng);
                mapInstanceRef.current?.setView([lat, lng], 15);
            },
            (err) => {
                setLocating(false);
                setGeoMessage(err.code === err.PERMISSION_DENIED
                    ? 'Localisation refusée : autorisez-la dans le navigateur ou placez le repère sur la carte.'
                    : 'Position introuvable pour le moment : placez le repère sur la carte.');
            },
            { enableHighAccuracy: true, timeout: 8000 },
        );
    };

    const shownError = inputError ?? error ?? null;

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p id={helpId} className="min-w-0 flex-1 basis-56 text-sm leading-snug text-fg-muted">
                    Touchez la carte ou déplacez le repère pour indiquer l’entrée du lieu. Vous pouvez aussi saisir les coordonnées.
                </p>
                <Button type="button" variant="secondary" size="sm" onClick={handleUseMyLocation} isLoading={locating} leftIcon={<LocateFixed size={16} />}>
                    Ma position
                </Button>
            </div>

            <div
                ref={mapRef}
                role="region"
                aria-label="Carte du lieu"
                aria-describedby={helpId}
                className="isolate h-64 w-full overflow-hidden rounded-2xl border border-border bg-surface-sunken"
            />

            {geoMessage && (
                <p role="status" className="text-sm leading-snug text-warning-fg">{geoMessage}</p>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <TextInput
                    id={`${prefix}-latitude`}
                    label="Latitude"
                    inputMode="decimal"
                    value={latText}
                    onChange={(e) => setLatText(e.target.value)}
                    onBlur={() => applyTyped(latText, lngText)}
                    placeholder="14.6937"
                />
                <TextInput
                    id={`${prefix}-longitude`}
                    label="Longitude"
                    inputMode="decimal"
                    value={lngText}
                    onChange={(e) => setLngText(e.target.value)}
                    onBlur={() => applyTyped(latText, lngText)}
                    placeholder="-17.4441"
                    error={shownError ?? undefined}
                />
            </div>

            {latitude !== null && longitude !== null && !shownError && (
                <p className="inline-flex items-center gap-2 self-start rounded-xl border border-success-border bg-success-bg px-3 py-2 text-sm font-medium text-success-fg">
                    <MapPin size={16} aria-hidden="true" />
                    Position enregistrée
                </p>
            )}
        </div>
    );
};
