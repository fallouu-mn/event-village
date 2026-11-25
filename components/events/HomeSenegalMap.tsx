'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { LinkButton } from '@/components/ui/LinkButton';

/**
 * Lot Carte B (4) — section « Partout au Sénégal » de l'accueil, rendue avec « Près de chez vous » (îlot chargé après la
 * page : rien au premier chargement de l'accueil). L'aperçu de la carte n'est monté que lorsque sa place devient visible à
 * l'écran : Leaflet, sa feuille de style, les tuiles et les événements ne sont demandés qu'alors ; place réservée à sa
 * hauteur (aucun saut de mise en page). « Ouvrir la carte » mène à la vue Carte d'Explorer, avec ou sans aperçu.
 *
 * Lot poids : le CODE de l'aperçu n'est plus dans l'îlot (+3 047 octets gzip avant) ; il est chargé, lui aussi, quand sa
 * place devient visible, dans son propre morceau (~3 400 octets). Le module de la carte d'Explorer (components/explore/
 * lazy.ts) a été essayé : il coûtait la même entrée de table (Explorer charge déjà une icône que l'accueil n'a pas : un
 * reste propre à l'accueil) et faisait télécharger 10,8 Ko au lieu de 3,4. Chargement impossible (réseau coupé) : l'aperçu
 * est retiré, la section garde son bouton, comme pour des tuiles absentes.
 */

type PreviewProps = { onCount: (n: number) => void; onUnavailable: () => void };

/** Vue Carte d'Explorer (lib/events/explore-view.ts, exploreModeHref({}, 'carte')), écrite telle quelle : rien d'Explorer dans ce module. */
const MAP_HREF = '/explore?vue=carte';

export function HomeSenegalMap() {
    const box = useRef<HTMLDivElement>(null);
    const [visible, setVisible] = useState(false);
    const [Preview, setPreview] = useState<React.ComponentType<PreviewProps> | null>(null);
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

    // Code de l'aperçu demandé à l'apparition de sa place seulement
    useEffect(() => {
        if (!visible || Preview) return undefined;
        let alive = true;
        import('@/components/explore/SenegalMapPreview')
            .then((m) => { if (alive) setPreview(() => m.default); })
            .catch((err: unknown) => {
                console.warn('[HomeSenegalMap] aperçu de la carte non chargé :', err instanceof Error ? err.message : String(err));
                if (alive) setUnavailable(true);
            });
        return () => { alive = false; };
    }, [visible, Preview]);

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
                <LinkButton href={MAP_HREF} variant="secondary" rightIcon={<ArrowRight size={16} />} className="flex-shrink-0">
                    Ouvrir la carte
                </LinkButton>
            </div>
            {!unavailable && (
                <div ref={box} className="h-56 overflow-hidden rounded-xl border border-border bg-muted sm:h-72">
                    {visible && Preview && <Preview onCount={setCount} onUnavailable={() => setUnavailable(true)} />}
                </div>
            )}
        </section>
    );
}
