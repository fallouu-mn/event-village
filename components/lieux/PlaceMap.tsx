'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Map as MapIcon, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { mapMarkerHtml } from '@/components/ui/MapMarker';
import { loadEventMap } from '@/components/ui/event-map-load';
import { ZONE_RADIUS_M, ZONE_SENTENCE } from '@/lib/lieux/position-publique';

// Même chargeur que la carte de la fiche d'un événement (un seul import(), un seul morceau : leçon du lot poids)
const EventMap = dynamic(
    () => loadEventMap().then((m) => ({ default: m.EventMap })),
    { ssr: false, loading: () => <div className="h-full w-full bg-muted motion-safe:animate-pulse" aria-hidden="true" /> },
);

function shortName(name: string): string {
    const t = name.trim().replace(/\s+/g, ' ');
    return t.length > 28 ? `${t.slice(0, 27).trimEnd()}…` : t;
}

/**
 * Lot Carte B3 — petite carte de la fiche d'une salle ou d'un établissement (même principe que
 * components/event-page/VenueMap.tsx : place réservée, plan dessiné avant le toucher, fond de carte au toucher de
 * « Afficher la carte », module préchargé à l'approche) :
 *  - lieu professionnel (`exact`) : repère avec le nom, au point exact ;
 *  - lieu d'un particulier : (latitude, longitude) est le centre de sa zone ; seul le cercle de 300 m est dessiné, bord en
 *    pointillé, avec « Adresse exacte après réservation » ; aucun repère au centre.
 */
export function PlaceMap({ latitude, longitude, name, area, exact }: { latitude: number; longitude: number; name: string; area: string | null; exact: boolean }) {
    const holderRef = useRef<HTMLDivElement | null>(null);
    const [shown, setShown] = useState(false);

    useEffect(() => {
        const node = holderRef.current;
        if (!node || shown || typeof IntersectionObserver === 'undefined') return undefined;
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

    const label = exact ? `${name}${area ? `, ${area}` : ''}` : `Zone approximative de ${name}${area ? `, ${area}` : ''} : ${ZONE_SENTENCE.toLowerCase()}`;

    return (
        <div ref={holderRef} className="relative h-52 w-full overflow-hidden rounded-xl border border-border bg-muted sm:h-60">
            {shown ? (
                <EventMap
                    latitude={latitude}
                    longitude={longitude}
                    venueName={exact ? (area ? `${name}, ${area}` : name) : undefined}
                    eventName={exact ? name : undefined}
                    zoneRadiusM={exact ? undefined : ZONE_RADIUS_M}
                    className="h-full rounded-none border-0 sm:h-full"
                />
            ) : (
                <>
                    {/* Plan dessiné : rues en filets, aucune donnée réelle (le vrai fond de carte vient au toucher) */}
                    <svg aria-hidden="true" className="absolute inset-0 h-full w-full text-border" preserveAspectRatio="xMidYMid slice" viewBox="0 0 400 220">
                        <path d="M-10 160 C 80 140, 150 175, 230 150 S 360 120, 420 135" fill="none" stroke="currentColor" strokeWidth="10" />
                        <path d="M120 -10 L 150 240" fill="none" stroke="currentColor" strokeWidth="6" />
                        <path d="M290 -10 C 270 60, 300 120, 280 240" fill="none" stroke="currentColor" strokeWidth="6" />
                        <path d="M-10 60 L 420 85" fill="none" stroke="currentColor" strokeWidth="4" />
                        {!exact && (
                            <circle cx="200" cy="96" r="64" className="fill-brand-vif/15 stroke-brand-vif" strokeWidth="2.5" strokeDasharray="7 7" />
                        )}
                    </svg>
                    {exact ? (
                        <div className="absolute inset-x-0 top-6 flex justify-center">
                            <span role="img" aria-label={label} dangerouslySetInnerHTML={{ __html: mapMarkerHtml('choisi', shortName(name)) }} />
                        </div>
                    ) : (
                        <span role="img" aria-label={label} className="absolute inset-0" />
                    )}
                    <div className="absolute inset-x-0 bottom-3 flex justify-center">
                        <Button variant="secondary" size="sm" className="ev-press shadow-sm" leftIcon={<MapIcon size={16} />} onClick={() => setShown(true)}>
                            Afficher la carte
                        </Button>
                    </div>
                </>
            )}
            {!exact && (
                // Phrase de la zone, visible avant et après le chargement de la carte (au-dessus du fond, sous les boutons)
                <p className="pointer-events-none absolute inset-x-0 top-3 z-[500] flex justify-center px-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/95 px-3 py-1.5 text-sm font-semibold text-foreground-strong shadow-sm">
                        <ShieldCheck size={16} className="flex-shrink-0 text-primary-text" aria-hidden="true" />
                        {ZONE_SENTENCE}
                    </span>
                </p>
            )}
        </div>
    );
}
