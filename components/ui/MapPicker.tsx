'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { LocateFixed, MapPin, Move, Search } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { Button } from './Button';
import { TextInput } from './Field';
import { SENEGAL_BOUNDS, SENEGAL_VIEW, inSenegal, type GeoPoint } from '@/lib/events/senegal-cities';

/** Lieu trouvé par la recherche (route serveur GET /api/partner/places/search). */
export interface PlaceSearchResult {
    label: string;
    latitude: number;
    longitude: number;
}

export type PlaceSearchOutcome =
    | { kind: 'results'; results: PlaceSearchResult[] }
    | { kind: 'error'; message: string };

interface MapPickerProps {
    latitude: number | null;
    longitude: number | null;
    onChange: (lat: number, lng: number) => void;
    /** Erreur de position venue du formulaire ou du serveur. */
    error?: string;
    /** Préfixe des identifiants des champs Latitude et Longitude (lien depuis un récapitulatif d'erreurs). */
    idPrefix?: string;
    /** Centre fixe de la ville choisie : la carte s'y place tant qu'aucun repère n'est choisi (sinon le pays entier). */
    center?: GeoPoint | null;
    /** Recherche de lieu par le serveur ; absente : pas de champ de recherche. */
    onSearch?: (query: string) => Promise<PlaceSearchOutcome>;
}

/**
 * Tuiles de la carte : configurables (NEXT_PUBLIC_MAP_TILE_URL, NEXT_PUBLIC_MAP_TILE_ATTRIBUTION), par défaut
 * OpenStreetMap. La feuille de style et les icônes de Leaflet sont servies par l'application (plus d'unpkg).
 */
const TILE_URL = process.env.NEXT_PUBLIC_MAP_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION || '&copy; contributeurs OpenStreetMap';
const OUTSIDE_TEXT = 'Le repère doit être placé au Sénégal : touchez la carte à l’emplacement du lieu.';
const CITY_ZOOM = 13;
const PLACE_ZOOM = 16;

const round6 = (n: number): number => Math.round(n * 1e6) / 1e6;
const frNumber = (n: number): string => String(n).replace('.', ',');

function parseCoordinate(raw: string): number | null {
    const normalized = raw.trim().replace(',', '.');
    if (normalized === '') return null;
    const n = Number(normalized);
    return Number.isFinite(n) ? round6(n) : null;
}

/** Écran tactile principal (téléphone, tablette) : un doigt doit faire défiler la page, pas la carte. */
function coarsePointer(): boolean {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
}

/**
 * Choix de la position d'un lieu (lot 5, contrat F6 ; finition 2a, point 3) :
 *  - aucun repère tant que rien n'est choisi ; la carte se place sur la ville choisie (centre fixe), sinon sur le pays ;
 *  - toucher la carte place le repère (sans glisser : alternative à un pointeur, WCAG 2.5.7) ; le repère se déplace
 *    aussi au glisser ; « Ma position » ; recherche de lieu par le serveur (« Rechercher un lieu », bouton
 *    « Rechercher », aucun appel à la frappe) ; saisie des coordonnées au clavier ;
 *  - sur écran tactile, un doigt fait défiler la page (glisser de la carte désactivé : dragging.disable()) ; deux doigts
 *    déplacent et zooment la carte ; « Déplacer la carte » active le glisser à un doigt, « Terminer » le rend à la page ;
 *  - un repère hors du Sénégal est refusé ici comme par le serveur ; « Position choisie » quand un repère est posé.
 */
export const MapPicker: React.FC<MapPickerProps> = ({ latitude, longitude, onChange, error, idPrefix, center, onSearch }) => {
    const generated = useId();
    const prefix = idPrefix ?? `carte-${generated}`;
    const helpId = `${prefix}-aide`;
    const searchId = `${prefix}-recherche`;
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<import('leaflet').Map | null>(null);
    const markerRef = useRef<import('leaflet').Marker | null>(null);
    const placeMarkerRef = useRef<((lat: number, lng: number) => void) | null>(null);
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

    const [latText, setLatText] = useState(latitude === null ? '' : String(latitude));
    const [lngText, setLngText] = useState(longitude === null ? '' : String(longitude));
    const [inputError, setInputError] = useState<string | null>(null);
    const [geoMessage, setGeoMessage] = useState<string | null>(null);
    const [locating, setLocating] = useState(false);
    const [touch, setTouch] = useState(false);
    const [panning, setPanning] = useState(false);

    const [query, setQuery] = useState('');
    const [searching, setSearching] = useState(false);
    const [results, setResults] = useState<PlaceSearchResult[] | null>(null);
    const [searchMessage, setSearchMessage] = useState<string | null>(null);
    const [chosenLabel, setChosenLabel] = useState<string | null>(null);

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

        const hasPosition = latitude !== null && longitude !== null;
        const view: { at: [number, number]; zoom: number } = hasPosition
            ? { at: [latitude, longitude], zoom: PLACE_ZOOM }
            : center
                ? { at: [center.latitude, center.longitude], zoom: CITY_ZOOM }
                : { at: [SENEGAL_VIEW.center.latitude, SENEGAL_VIEW.center.longitude], zoom: SENEGAL_VIEW.zoom };
        const isTouch = coarsePointer();
        const map = L.map(container, { center: view.at, zoom: view.zoom, zoomControl: false, keyboard: true, scrollWheelZoom: false });
        // Écran tactile : un doigt fait défiler la page (sans glisser actif, Leaflet laisse le défilement à un doigt au
        // navigateur), deux doigts déplacent et zooment la carte (touchZoom) ; « Déplacer la carte » rend le glisser.
        if (isTouch) map.dragging.disable();
        setTouch(isTouch);
        // Boutons de zoom en français ; 44 px par la règle .leaflet-control-zoom de app/globals.css
        L.control.zoom({ zoomInTitle: 'Zoom avant', zoomOutTitle: 'Zoom arrière' }).addTo(map);
        L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(map);
        // Lot 7 (D74) : mention légale des tuiles (12 px de Leaflet) marquée comme légende pour le contrôle des
        // captures (e2e/support/checks.ts, CAPTION_SELECTOR) ; elle reste lisible et n'est pas un contenu.
        map.attributionControl?.setPrefix('Leaflet'); // sans le drapeau du préfixe par défaut de Leaflet
        map.attributionControl?.getContainer()?.setAttribute('data-ev-caption', '');

        // Repère créé au premier choix seulement ; déplaçable à la souris ou au doigt, sans action au clavier dans
        // Leaflet : il n'est pas focalisable (keyboard: false), l'alternative au clavier est la recherche ou la saisie
        // des coordonnées (WCAG 2.5.7). Son image garde un texte de remplacement.
        const placeMarker = (lat: number, lng: number) => {
            if (markerRef.current) {
                markerRef.current.setLatLng([lat, lng]);
                return;
            }
            const marker = L.marker([lat, lng], {
                draggable: true,
                icon,
                keyboard: false,
                title: 'Position du lieu',
                alt: 'Repère de la position du lieu',
            }).addTo(map);
            let before = marker.getLatLng();
            marker.on('dragstart', () => {
                before = marker.getLatLng();
            });
            marker.on('dragend', () => {
                const pos = marker.getLatLng();
                if (!inSenegal(pos.lat, pos.lng)) {
                    marker.setLatLng(before);
                    setInputError(OUTSIDE_TEXT);
                    return;
                }
                setInputError(null);
                setChosenLabel(null);
                onChangeRef.current(round6(pos.lat), round6(pos.lng));
            });
            markerRef.current = marker;
        };
        placeMarkerRef.current = placeMarker;
        if (hasPosition) placeMarker(latitude, longitude);

        map.on('click', (e: import('leaflet').LeafletMouseEvent) => {
            if (!inSenegal(e.latlng.lat, e.latlng.lng)) {
                setInputError(OUTSIDE_TEXT);
                return;
            }
            setInputError(null);
            setChosenLabel(null);
            placeMarker(e.latlng.lat, e.latlng.lng);
            onChangeRef.current(round6(e.latlng.lat), round6(e.latlng.lng));
        });

        mapInstanceRef.current = map;
        return () => {
            map.remove();
            mapInstanceRef.current = null;
            markerRef.current = null;
            placeMarkerRef.current = null;
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Position venue du formulaire (saisie, recherche, chargement d'un événement) : repère posé ou déplacé
    useEffect(() => {
        setLatText(latitude === null ? '' : String(latitude));
        setLngText(longitude === null ? '' : String(longitude));
        const map = mapInstanceRef.current;
        if (!map || latitude === null || longitude === null) return;
        placeMarkerRef.current?.(latitude, longitude);
        if (!map.getBounds().contains([latitude, longitude])) map.setView([latitude, longitude], Math.max(map.getZoom(), CITY_ZOOM));
    }, [latitude, longitude]);

    // Ville changée sans repère choisi : la carte se place sur son centre fixe (sinon sur le pays entier)
    const centerKey = center ? `${center.latitude},${center.longitude}` : '';
    useEffect(() => {
        const map = mapInstanceRef.current;
        if (!map || markerRef.current) return;
        if (center) map.setView([center.latitude, center.longitude], CITY_ZOOM);
        else map.setView([SENEGAL_VIEW.center.latitude, SENEGAL_VIEW.center.longitude], SENEGAL_VIEW.zoom);
    }, [centerKey]); // eslint-disable-line react-hooks/exhaustive-deps

    const togglePanning = () => {
        const map = mapInstanceRef.current;
        if (!map) return;
        if (panning) map.dragging.disable();
        else map.dragging.enable();
        setPanning(!panning);
    };

    const applyTyped = (nextLat: string, nextLng: string) => {
        if (nextLat.trim() === '' || nextLng.trim() === '') {
            setInputError(null);
            return;
        }
        const lat = parseCoordinate(nextLat);
        const lng = parseCoordinate(nextLng);
        if (lat === null || lng === null) {
            setInputError('Coordonnées illisibles : saisissez deux nombres, par exemple 14.6937 et -17.4441.');
            return;
        }
        if (!inSenegal(lat, lng)) {
            setInputError(`Coordonnées hors du Sénégal : latitude entre ${frNumber(SENEGAL_BOUNDS.minLatitude)} et ${frNumber(SENEGAL_BOUNDS.maxLatitude)}, longitude entre ${frNumber(SENEGAL_BOUNDS.minLongitude)} et ${frNumber(SENEGAL_BOUNDS.maxLongitude)}.`);
            return;
        }
        setInputError(null);
        setChosenLabel(null);
        onChange(lat, lng);
        mapInstanceRef.current?.setView([lat, lng], PLACE_ZOOM);
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
                if (!inSenegal(lat, lng)) {
                    setGeoMessage('Votre position est hors du Sénégal : touchez la carte à l’emplacement du lieu.');
                    return;
                }
                setInputError(null);
                setChosenLabel(null);
                onChange(lat, lng);
                mapInstanceRef.current?.setView([lat, lng], PLACE_ZOOM);
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

    const runSearch = useCallback(async () => {
        if (!onSearch || searching) return;
        const q = query.replace(/\s+/g, ' ').trim();
        if (q.length < 3) {
            setResults(null);
            setSearchMessage('Saisissez au moins 3 caractères, par exemple le nom de la salle ou du quartier.');
            return;
        }
        setSearching(true);
        setSearchMessage(null);
        try {
            const outcome = await onSearch(q);
            if (outcome.kind === 'error') {
                setResults(null);
                setSearchMessage(outcome.message);
            } else {
                setResults(outcome.results);
                setSearchMessage(outcome.results.length === 0
                    ? 'Aucun lieu trouvé : essayez un autre nom ou le quartier, ou touchez la carte pour placer le repère.'
                    : null);
            }
        } finally {
            setSearching(false);
        }
    }, [onSearch, query, searching]);

    const choose = (r: PlaceSearchResult) => {
        setInputError(null);
        setChosenLabel(r.label);
        setResults(null);
        onChange(round6(r.latitude), round6(r.longitude));
        mapInstanceRef.current?.setView([r.latitude, r.longitude], PLACE_ZOOM);
    };

    const shownError = inputError ?? error ?? null;
    const chosen = latitude !== null && longitude !== null;

    return (
        <div className="flex flex-col gap-3">
            {onSearch && (
                <div className="flex flex-col gap-2" role="search" aria-label="Rechercher un lieu">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                        <TextInput
                            id={searchId}
                            label="Rechercher un lieu"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => {
                                // Entrée lance la recherche, jamais l'envoi du formulaire de l'événement
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    void runSearch();
                                }
                            }}
                            placeholder="Par exemple : Grand Théâtre, Dakar"
                            maxLength={120}
                            autoComplete="off"
                            enterKeyHint="search"
                            fieldClassName="min-w-0 flex-1"
                        />
                        <Button type="button" variant="secondary" onClick={() => void runSearch()} isLoading={searching} leftIcon={<Search size={16} />}>
                            Rechercher
                        </Button>
                    </div>
                    <div aria-live="polite" aria-busy={searching} className="flex flex-col gap-2">
                        {searchMessage && <p className="text-sm leading-snug text-warning-fg">{searchMessage}</p>}
                        {results && results.length > 0 && (
                            <ul className="flex flex-col overflow-hidden rounded-2xl border border-border bg-surface" aria-label="Lieux trouvés">
                                {results.map((r) => (
                                    <li key={`${r.label}-${r.latitude}-${r.longitude}`} className="border-b border-border last:border-b-0">
                                        <button
                                            type="button"
                                            onClick={() => choose(r)}
                                            className="flex min-h-11 w-full items-start gap-2 px-3 py-2 text-left text-sm text-fg transition-colors duration-150 hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                                        >
                                            <MapPin size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-fg-muted" />
                                            <span className="min-w-0 break-words">{r.label}</span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                        <small className="text-caption text-fg-muted">Lieux : &copy; contributeurs OpenStreetMap</small>
                    </div>
                </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
                <p id={helpId} className="min-w-0 flex-1 basis-56 text-sm leading-snug text-fg-muted">
                    {touch
                        ? 'Touchez la carte pour placer le repère à l’entrée du lieu. Un doigt fait défiler la page ; deux doigts, ou « Déplacer la carte », déplacent la carte.'
                        : 'Cliquez sur la carte ou déplacez le repère pour indiquer l’entrée du lieu. Vous pouvez aussi saisir les coordonnées.'}
                </p>
                <Button type="button" variant="secondary" size="sm" onClick={handleUseMyLocation} isLoading={locating} leftIcon={<LocateFixed size={16} />}>
                    Ma position
                </Button>
            </div>

            <div className="relative">
                <div
                    ref={mapRef}
                    role="region"
                    aria-label="Carte du lieu"
                    aria-describedby={helpId}
                    className="isolate h-64 w-full overflow-hidden rounded-2xl border border-border bg-surface-sunken sm:h-72"
                />
                {touch && (
                    <Button
                        type="button"
                        variant={panning ? 'primary' : 'secondary'}
                        size="sm"
                        onClick={togglePanning}
                        aria-pressed={panning}
                        leftIcon={<Move size={16} />}
                        className="absolute right-2 top-2 z-[500] shadow-md"
                    >
                        {panning ? 'Terminer' : 'Déplacer la carte'}
                    </Button>
                )}
            </div>

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
                    // Finition 2a (3) : plus de repère par défaut, le champ est vide au départ ; l'exemple ne doit pas
                    // ressembler à une position déjà choisie
                    placeholder="Par exemple : 14.6937"
                />
                <TextInput
                    id={`${prefix}-longitude`}
                    label="Longitude"
                    inputMode="decimal"
                    value={lngText}
                    onChange={(e) => setLngText(e.target.value)}
                    onBlur={() => applyTyped(latText, lngText)}
                    placeholder="Par exemple : -17.4441"
                    error={shownError ?? undefined}
                />
            </div>

            {chosen && !shownError && (
                <p role="status" className="inline-flex items-center gap-2 self-start rounded-xl border border-success-border bg-success-bg px-3 py-2 text-sm font-medium text-success-fg">
                    <MapPin size={16} aria-hidden="true" className="shrink-0" />
                    <span className="min-w-0 break-words">{chosenLabel ? `Position choisie : ${chosenLabel}` : 'Position choisie'}</span>
                </p>
            )}
        </div>
    );
};
