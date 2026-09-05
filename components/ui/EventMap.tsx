'use client';

import React, { useEffect, useRef } from 'react';

interface EventMapProps {
    latitude: number;
    longitude: number;
    venueName?: string;
}

export const EventMap: React.FC<EventMapProps> = ({ latitude, longitude, venueName }) => {
    const mapRef = useRef<HTMLDivElement>(null);

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

        const map = L.map(container, {
            center: [latitude, longitude],
            zoom: 15,
            zoomControl: true,
            scrollWheelZoom: false,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors',
            maxZoom: 19,
        }).addTo(map);

        const marker = L.marker([latitude, longitude]).addTo(map);
        if (venueName) {
            marker.bindPopup(`<strong>${venueName}</strong>`).openPopup();
        }

        return () => {
            map.remove();
        };
    }, [latitude, longitude, venueName]);

    return (
        <>
            <link
                rel="stylesheet"
                href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
                crossOrigin=""
            />
            <div
                ref={mapRef}
                className="w-full h-48 sm:h-56 rounded-xl border border-slate-200 dark:border-zinc-700 overflow-hidden bg-slate-100 dark:bg-zinc-800"
                style={{ zIndex: 0 }}
            />
        </>
    );
};
