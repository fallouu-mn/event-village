'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Map as MapIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { mapMarkerHtml } from '@/components/ui/MapMarker';

const loadEventMap = () => import('@/components/ui/EventMap');

// Leaflet et ses tuiles : jamais au premier affichage. Le module est seulement préchargé quand la zone approche de
// l'écran (IntersectionObserver) ; le fond de carte n'est demandé qu'au toucher de « Afficher la carte ».
const EventMap = dynamic(
  () => import('@/components/ui/EventMap').then((m) => ({ default: m.EventMap })),
  { ssr: false, loading: () => <div className="h-full w-full bg-muted motion-safe:animate-pulse" aria-hidden="true" /> },
);

function shortName(name: string): string {
  const t = name.trim().replace(/\s+/g, ' ');
  return t.length > 28 ? `${t.slice(0, 27).trimEnd()}…` : t;
}

/**
 * Design 1b (point 6) — petite carte du lieu, avec le NOM de l'événement sur le repère. Place réservée (hauteur fixe) :
 * rien ne bouge quand la carte arrive. Avant le toucher : un plan dessiné (sans réseau, sans image) avec le repère et
 * le bouton « Afficher la carte » ; après : la carte Leaflet (components/ui/EventMap) au même endroit.
 */
export function VenueMap({ latitude, longitude, venueName, eventName }: { latitude: number; longitude: number; venueName: string; eventName: string }) {
  const holderRef = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(false);

  // Préchargement du module de la carte à l'approche de la zone (marge de 200 px) : le toucher répond vite.
  useEffect(() => {
    const node = holderRef.current;
    if (!node || shown) return undefined;
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          void loadEventMap().catch((err: unknown) => {
            console.warn('[fiche] préchargement de la carte impossible :', err instanceof Error ? err.message : String(err));
          });
        }
      },
      { rootMargin: '200px 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [shown]);

  return (
    <div ref={holderRef} className="relative h-48 w-full overflow-hidden rounded-xl border border-border bg-muted sm:h-56">
      {shown ? (
        <EventMap latitude={latitude} longitude={longitude} venueName={venueName} eventName={eventName} className="h-full rounded-none border-0 sm:h-full" />
      ) : (
        <>
          {/* Plan dessiné : rues en filets, aucune donnée réelle (le vrai fond de carte vient au toucher) */}
          <svg aria-hidden="true" className="absolute inset-0 h-full w-full text-border" preserveAspectRatio="xMidYMid slice" viewBox="0 0 400 220">
            <path d="M-10 160 C 80 140, 150 175, 230 150 S 360 120, 420 135" fill="none" stroke="currentColor" strokeWidth="10" />
            <path d="M120 -10 L 150 240" fill="none" stroke="currentColor" strokeWidth="6" />
            <path d="M290 -10 C 270 60, 300 120, 280 240" fill="none" stroke="currentColor" strokeWidth="6" />
            <path d="M-10 60 L 420 85" fill="none" stroke="currentColor" strokeWidth="4" />
          </svg>
          <div className="absolute inset-x-0 top-6 flex justify-center">
            <span
              role="img"
              aria-label={`${eventName}, ${venueName}`}
              // Repère de la charte, nom échappé par mapMarkerHtml
              dangerouslySetInnerHTML={{ __html: mapMarkerHtml('choisi', shortName(eventName)) }}
            />
          </div>
          <div className="absolute inset-x-0 bottom-3 flex justify-center">
            <Button variant="secondary" size="sm" className="ev-press shadow-sm" leftIcon={<MapIcon size={16} />} onClick={() => setShown(true)}>
              Afficher la carte
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
