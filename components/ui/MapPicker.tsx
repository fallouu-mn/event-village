'use client';

import React, { useEffect, useRef } from 'react';
import { MapPin, Navigation } from 'lucide-react';

interface MapPickerProps {
    latitude: number | null;
    longitude: number | null;
    onChange: (lat: number, lng: number) => void;
}

const DEFAULT_LAT = 14.6937;
const DEFAULT_LNG = -17.4441;

export const MapPicker: React.FC<MapPickerProps> = ({ latitude, longitude, onChange }) => {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<any>(null);
    const markerRef = useRef<any>(null);
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

    useEffect(() => {
        const container = mapRef.current;
        if (!container) return;

        // eslint-disable-next-line
        const L = require('leaflet') as typeof import('leaflet');

        // @ts-ignore
        delete L.Icon.Default.prototype._getIconUrl;
        L.Icon.Default.mergeOptions({
            iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
            iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
            shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        });

        const initLat = latitude ?? DEFAULT_LAT;
        const initLng = longitude ?? DEFAULT_LNG;

        const map = L.map(container, {
            center: [initLat, initLng],
            zoom: 13,
            zoomControl: true,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors',
            maxZoom: 19,
        }).addTo(map);

        const marker = L.marker([initLat, initLng], { draggable: true }).addTo(map);

        const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

        marker.on('dragend', () => {
            const pos = marker.getLatLng();
            onChangeRef.current(round6(pos.lat), round6(pos.lng));
        });

        map.on('click', (e: any) => {
            const { lat, lng } = e.latlng;
            marker.setLatLng([lat, lng]);
            onChangeRef.current(round6(lat), round6(lng));
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
        if (!markerRef.current || latitude === null || longitude === null) return;
        markerRef.current.setLatLng([latitude, longitude]);
        mapInstanceRef.current?.setView([latitude, longitude], mapInstanceRef.current.getZoom());
    }, [latitude, longitude]);

    const handleUseMyLocation = () => {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const { latitude: lat, longitude: lng } = pos.coords;
                const round6 = (n: number) => Math.round(n * 1e6) / 1e6;
                onChange(round6(lat), round6(lng));
                if (markerRef.current && mapInstanceRef.current) {
                    markerRef.current.setLatLng([lat, lng]);
                    mapInstanceRef.current.setView([lat, lng], 15);
                }
            },
            () => {},
            { enableHighAccuracy: true, timeout: 8000 }
        );
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-500 dark:text-zinc-400">
                    Cliquez sur la carte ou déplacez le marqueur pour définir la position exacte
                </span>
                <button
                    type="button"
                    onClick={handleUseMyLocation}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-zinc-800 text-xs font-bold text-slate-700 dark:text-zinc-300 hover:bg-orange-50 hover:text-[#FF5722] transition-all"
                >
                    <Navigation size={12} />
                    Ma position
                </button>
            </div>

            <link
                rel="stylesheet"
                href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
                crossOrigin=""
            />

            <div
                ref={mapRef}
                className="w-full h-56 rounded-xl border border-slate-200 dark:border-zinc-700 overflow-hidden bg-slate-100 dark:bg-zinc-800"
                style={{ zIndex: 0 }}
            />

            {latitude !== null && longitude !== null && (
                <div className="flex items-center gap-3 mt-1">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40">
                        <MapPin size={12} className="text-emerald-600" />
                        <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                            {latitude.toFixed(6)}, {longitude.toFixed(6)}
                        </span>
                    </div>
                    <span className="text-[11px] text-slate-400 dark:text-zinc-500">Position enregistrée</span>
                </div>
            )}
        </div>
    );
};
