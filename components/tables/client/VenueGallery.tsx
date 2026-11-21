'use client';

/**
 * Lot 11b (écrans du client) : galerie des photos d'un établissement, glissable au doigt. Défilement natif aimanté
 * (scroll-snap : fluide sur téléphone, sans bibliothèque), place réservée en 16/10 (rien ne saute), boutons « Photo
 * précédente » et « Photo suivante », flèches gauche et droite du clavier, points de position et annonce « Photo 2 sur
 * 5 ». Seule la première photo est chargée tout de suite ; les autres à la demande. Défilement doux seulement si
 * l'utilisateur accepte les animations.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';
import { cn } from '@/components/ui/cn';
import { eventImageSrc } from '@/lib/events/event-image';

function reducedMotion(): boolean {
    try {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
        return false;
    }
}

export function VenueGallery({ photos, name }: { photos: string[]; name: string }) {
    const track = useRef<HTMLDivElement | null>(null);
    const [index, setIndex] = useState(0);
    const count = photos.length;
    const many = count > 1;

    const goTo = useCallback((i: number) => {
        const el = track.current;
        if (!el) return;
        const target = (i + count) % count;
        el.scrollTo({ left: target * el.clientWidth, behavior: reducedMotion() ? 'auto' : 'smooth' });
    }, [count]);

    useEffect(() => {
        const el = track.current;
        if (!el || !many) return undefined;
        let frame = 0;
        const onScroll = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
                setIndex(Math.min(count - 1, Math.max(0, i)));
            });
        };
        el.addEventListener('scroll', onScroll, { passive: true });
        return () => {
            cancelAnimationFrame(frame);
            el.removeEventListener('scroll', onScroll);
        };
    }, [many, count]);

    if (count === 0) {
        return (
            <div className="relative -mx-4 aspect-[16/10] overflow-hidden bg-muted sm:mx-0 sm:rounded-2xl sm:border sm:border-border">
                <Image src={eventImageSrc(null)} alt={`Pas encore de photo de ${name}`} fill priority sizes="(min-width: 1024px) 60vw, 100vw" className="object-cover" />
            </div>
        );
    }

    return (
        <section
            aria-roledescription="galerie"
            aria-label={`Photos de ${name}`}
            className="relative -mx-4 sm:mx-0"
            onKeyDown={(e) => {
                if (!many) return;
                if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    goTo(index - 1);
                } else if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    goTo(index + 1);
                }
            }}
        >
            <div
                ref={track}
                className="no-scrollbar flex aspect-[16/10] snap-x snap-mandatory overflow-x-auto overscroll-x-contain bg-muted sm:rounded-2xl sm:border sm:border-border"
            >
                {photos.map((src, i) => (
                    <div key={`${src}-${i}`} className="relative h-full w-full flex-none snap-center snap-always" aria-hidden={i !== index}>
                        <Image
                            src={eventImageSrc(src)}
                            alt={`Photo ${i + 1} sur ${count} de ${name}`}
                            fill
                            priority={i === 0}
                            fetchPriority={i === 0 ? 'high' : undefined}
                            loading={i === 0 ? undefined : 'lazy'}
                            sizes="(min-width: 1024px) 60vw, 100vw"
                            draggable={false}
                            className="object-cover"
                        />
                    </div>
                ))}
            </div>
            {many && (
                <>
                    <div className="pointer-events-none absolute inset-y-0 left-2 flex items-center">
                        <IconButton aria-label="Photo précédente" variant="secondary" onClick={() => goTo(index - 1)} className="pointer-events-auto shadow-sm">
                            <ChevronLeft size={22} aria-hidden="true" />
                        </IconButton>
                    </div>
                    <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
                        <IconButton aria-label="Photo suivante" variant="secondary" onClick={() => goTo(index + 1)} className="pointer-events-auto shadow-sm">
                            <ChevronRight size={22} aria-hidden="true" />
                        </IconButton>
                    </div>
                    <div className="pointer-events-none absolute inset-x-0 bottom-3 flex flex-col items-center gap-2">
                        <p aria-live="polite" className="rounded-full bg-card px-3 py-1 text-sm font-semibold tabular-nums text-foreground-strong shadow-sm">
                            {`Photo ${index + 1} sur ${count}`}
                        </p>
                        {count <= 12 && (
                            <span className="flex gap-1.5" aria-hidden="true">
                                {photos.map((src, i) => (
                                    <span
                                        key={`${src}-point-${i}`}
                                        className={cn('h-1.5 rounded-full bg-card shadow-sm transition-all duration-base ease-standard', i === index ? 'w-5 opacity-100' : 'w-1.5 opacity-70')}
                                    />
                                ))}
                            </span>
                        )}
                    </div>
                </>
            )}
        </section>
    );
}
