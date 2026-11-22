'use client';

import React, { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { ArrowRight } from 'lucide-react';
import { LinkButton } from '@/components/ui/LinkButton';
import { exploreModeHref } from '@/lib/events/explore-view';

/**
 * Lot Carte B (4) — section « Partout au Sénégal » de l'accueil, rendue avec « Près de chez vous » (îlot chargé après la
 * page : rien au premier chargement de l'accueil). L'aperçu de la carte (Leaflet, tuiles) n'est chargé que lorsque sa
 * place devient visible à l'écran ; place réservée à sa hauteur (aucun saut de mise en page). « Ouvrir la carte » mène à
 * la vue Carte d'Explorer, avec ou sans aperçu.
 */

const SenegalMapPreview = dynamic(() => import('@/components/explore/SenegalMapPreview'), { ssr: false });

export function HomeSenegalMap() {
    const box = useRef<HTMLDivElement>(null);
    const [visible, setVisible] = useState(false);
    const [count, setCount] = useState<number | null>(null);
    const [unavailable, setUnavailable] = useState(false);

    useEffect(() => {
        if (visible) return undefined;
        const el = box.current;
        if (!el || typeof IntersectionObserver !== 'function') return undefined;
        const observer = new IntersectionObserver((entries) => {
            if (entries.some((e) => e.isIntersecting)) {
                setVisible(true);
                observer.disconnect();
            }
        }, { threshold: 0.1 });
        observer.observe(el);
        return () => observer.disconnect();
    }, [visible]);

    const hint = count === null
        ? 'Les événements à venir, sur la carte du Sénégal.'
        : count === 0 ? 'Aucun événement à venir sur la carte pour le moment.'
            : `${count} ${count > 1 ? 'événements à venir' : 'événement à venir'} sur la carte du Sénégal.`;

    return (
        <section aria-labelledby="senegal-titre" className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="min-w-0 space-y-1">
                    <h2 id="senegal-titre" className="text-xl font-bold tracking-tight text-foreground-strong sm:text-2xl">Partout au Sénégal</h2>
                    <p className="text-sm text-muted-foreground" aria-live="polite">{hint}</p>
                </div>
                <LinkButton href={exploreModeHref({}, 'carte')} variant="secondary" rightIcon={<ArrowRight size={16} />} className="flex-shrink-0">
                    Ouvrir la carte
                </LinkButton>
            </div>
            {!unavailable && (
                <div ref={box} className="h-56 overflow-hidden rounded-xl border border-border bg-muted sm:h-72">
                    {visible && <SenegalMapPreview onCount={setCount} onUnavailable={() => setUnavailable(true)} />}
                </div>
            )}
        </section>
    );
}
