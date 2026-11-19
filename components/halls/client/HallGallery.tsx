'use client';

/**
 * Lot 10b (point 2) : galerie des photos d'une salle. Grande photo (place réservée en 16/10 : rien ne saute), boutons
 * « Photo précédente » et « Photo suivante », flèches gauche et droite du clavier dans la galerie, vignettes cliquables
 * (photo affichée signalée par un cadre ET par aria-current) et annonce « Photo 2 sur 5 ». Seule la première photo est
 * chargée tout de suite ; les vignettes se chargent à la demande. Aucune animation en boucle.
 */
import React, { useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';
import { cn } from '@/components/ui/cn';
import { eventImageSrc } from '@/lib/events/event-image';

export function HallGallery({ photos, name }: { photos: string[]; name: string }) {
    const [index, setIndex] = useState(0);
    const list = photos.length > 0 ? photos : [''];
    const count = photos.length;
    const many = count > 1;
    const go = (delta: number) => setIndex((i) => (i + delta + list.length) % list.length);

    return (
        <section
            aria-roledescription="galerie"
            aria-label={`Photos de la salle ${name}`}
            className="space-y-3"
            onKeyDown={(e) => {
                if (!many) return;
                if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    go(-1);
                } else if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    go(1);
                }
            }}
        >
            <div className="relative -mx-4 aspect-[16/10] overflow-hidden bg-muted sm:mx-0 sm:rounded-xl sm:border sm:border-border">
                <Image
                    key={list[index]}
                    src={eventImageSrc(list[index] || null)}
                    alt={count > 0 ? `Photo ${index + 1} sur ${count} de la salle ${name}` : `Pas encore de photo de la salle ${name}`}
                    fill
                    priority={index === 0}
                    fetchPriority={index === 0 ? 'high' : undefined}
                    sizes="(min-width: 1024px) 60vw, 100vw"
                    className="object-cover"
                />
                {many && (
                    <>
                        <div className="absolute inset-y-0 left-2 flex items-center">
                            <IconButton aria-label="Photo précédente" variant="secondary" onClick={() => go(-1)} className="shadow-sm">
                                <ChevronLeft size={22} aria-hidden="true" />
                            </IconButton>
                        </div>
                        <div className="absolute inset-y-0 right-2 flex items-center">
                            <IconButton aria-label="Photo suivante" variant="secondary" onClick={() => go(1)} className="shadow-sm">
                                <ChevronRight size={22} aria-hidden="true" />
                            </IconButton>
                        </div>
                        <p aria-live="polite" className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-card px-3 py-1 text-sm font-semibold tabular-nums text-foreground-strong shadow-sm">
                            {`Photo ${index + 1} sur ${count}`}
                        </p>
                    </>
                )}
            </div>
            {many && (
                <ul className="flex gap-2 overflow-x-auto pb-1" aria-label="Choisir une photo">
                    {photos.map((src, i) => (
                        <li key={`${src}-${i}`} className="flex-shrink-0">
                            <button
                                type="button"
                                onClick={() => setIndex(i)}
                                aria-label={`Afficher la photo ${i + 1} sur ${count}`}
                                aria-current={i === index ? 'true' : undefined}
                                className={cn(
                                    'relative block h-14 w-20 overflow-hidden rounded-lg border-2 bg-muted transition-opacity duration-fast ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-16 sm:w-24',
                                    i === index ? 'border-foreground-strong' : 'border-transparent opacity-80 hover:opacity-100',
                                )}
                            >
                                <Image src={eventImageSrc(src)} alt="" fill sizes="96px" loading="lazy" className="object-cover" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
