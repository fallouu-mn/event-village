'use client';

/**
 * Lot 10b (point 2, correctifs) : photos d'une salle en plein écran, ouvertes depuis la galerie de la fiche (chargées à
 * la demande par next/dynamic : rien n'est téléchargé tant qu'on n'ouvre pas).
 *  - Fenêtre native <dialog> ouverte par showModal(), comme le QR en grand des billets : au-dessus de tout, reste de la
 *    page inerte, défilement de la page bloqué, Échap ferme, focus piégé (Tab et Maj+Tab tournent entre les boutons) et
 *    rendu au bouton d'ouverture à la fermeture.
 *  - On passe d'une photo à l'autre en glissant au doigt (useSwipe, seuil et geste vif), avec les boutons « Photo
 *    précédente » et « Photo suivante », ou avec les flèches gauche et droite du clavier. Compteur « Photo 2 sur 5 »
 *    annoncé aux lecteurs d'écran.
 *  - Photos en entier (object-contain), à la taille de l'écran (sizes 100vw) ; seule la photo affichée est chargée tout
 *    de suite, les autres à l'approche (loading="lazy").
 *  - Thème sombre forcé dans la fenêtre (fond de la charte, photo mise en valeur). Apparition 200 ms en transparence et
 *    passage d'une photo à l'autre en translation 200 ms, coupés si « réduire les animations ». Rien en boucle.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';
import { cn } from '@/components/ui/cn';
import { eventImageSrc } from '@/lib/events/event-image';
import { useSwipe } from './useSwipe';

export interface HallLightboxProps {
    photos: string[];
    name: string;
    /** Photo affichée à l'ouverture. */
    startIndex: number;
    /** Fermeture ; reçoit la photo affichée à ce moment (la galerie de la fiche s'y place). */
    onClose: (index: number) => void;
}

const FOCUSABLE = 'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

export function HallLightbox({ photos, name, startIndex, onClose }: HallLightboxProps) {
    const count = photos.length;
    const [index, setIndex] = useState(() => Math.min(Math.max(startIndex, 0), Math.max(count - 1, 0)));
    const dialogRef = useRef<HTMLDialogElement>(null);
    const indexRef = useRef(index);
    const closeRef = useRef(onClose);
    indexRef.current = index;
    closeRef.current = onClose;
    const many = count > 1;

    const go = useCallback((delta: number) => {
        setIndex((i) => (i + delta + count) % count);
    }, [count]);
    const prev = useCallback(() => go(-1), [go]);
    const next = useCallback(() => go(1), [go]);
    // Une seule fermeture même si Échap arrive deux fois (touche et événement « cancel » de la fenêtre native)
    const closed = useRef(false);
    const close = useCallback(() => {
        if (closed.current) return;
        closed.current = true;
        closeRef.current(indexRef.current);
    }, []);

    const { offset, dragging, handlers } = useSwipe({ onPrev: prev, onNext: next, enabled: many, atStart: index === 0, atEnd: index === count - 1 });

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return undefined;
        const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const savedOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        if (typeof dialog.showModal === 'function' && !dialog.open) dialog.showModal();
        dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus();

        // Échap : l'événement « cancel » de la fenêtre native, repris pour fermer par notre état
        const onCancel = (e: Event) => {
            e.preventDefault();
            close();
        };
        dialog.addEventListener('cancel', onCancel);

        return () => {
            dialog.removeEventListener('cancel', onCancel);
            if (dialog.open) dialog.close();
            document.body.style.overflow = savedOverflow;
            if (returnFocus && document.contains(returnFocus)) returnFocus.focus();
        };
    }, [close]);

    const onKeyDown = (e: React.KeyboardEvent<HTMLDialogElement>) => {
        if (e.key === 'ArrowLeft' && many) {
            e.preventDefault();
            prev();
        } else if (e.key === 'ArrowRight' && many) {
            e.preventDefault();
            next();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            close();
        } else if (e.key === 'Tab' && dialogRef.current) {
            const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
            if (items.length === 0) return;
            const first = items[0];
            const last = items[items.length - 1];
            const active = document.activeElement;
            if (e.shiftKey && (active === first || active === dialogRef.current)) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && active === last) {
                e.preventDefault();
                first.focus();
            }
        }
    };

    return (
        <dialog
            ref={dialogRef}
            aria-labelledby="salle-photos-titre"
            onKeyDown={onKeyDown}
            className="dark m-0 h-dvh max-h-none w-screen max-w-none overflow-hidden border-0 bg-background p-0 text-foreground-strong backdrop:bg-scrim motion-safe:animate-in motion-safe:fade-in"
        >
            <div className="flex h-full flex-col">
                <div className="flex flex-shrink-0 items-center justify-between gap-3 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
                    <div className="min-w-0">
                        <h2 id="salle-photos-titre" className="truncate text-base font-bold text-foreground-strong">{name}</h2>
                        {count > 0 && (
                            <p aria-live="polite" className="text-sm font-semibold tabular-nums text-foreground">
                                {`Photo ${index + 1} sur ${count}`}
                            </p>
                        )}
                    </div>
                    <IconButton aria-label="Fermer les photos" variant="secondary" onClick={close} data-autofocus="">
                        <X size={22} aria-hidden="true" />
                    </IconButton>
                </div>

                <div
                    className="relative min-h-0 flex-1 touch-pan-y select-none overflow-hidden"
                    role="region"
                    aria-roledescription="carrousel"
                    aria-label={`Photos de la salle ${name}`}
                    {...handlers}
                >
                    <ul
                        className={cn(
                            'flex h-full',
                            !dragging && 'transition-transform duration-base ease-standard motion-reduce:transition-none',
                        )}
                        style={{ transform: `translateX(calc(${-index * 100}% + ${offset}px))` }}
                    >
                        {photos.map((src, i) => (
                            <li
                                key={`${src}-${i}`}
                                className="relative h-full w-full flex-shrink-0"
                                aria-roledescription="photo"
                                aria-label={`Photo ${i + 1} sur ${count}`}
                                aria-hidden={i === index ? undefined : true}
                            >
                                <Image
                                    src={eventImageSrc(src)}
                                    alt={`Photo ${i + 1} sur ${count} de la salle ${name}`}
                                    fill
                                    sizes="100vw"
                                    loading={i === index ? 'eager' : 'lazy'}
                                    draggable={false}
                                    className="object-contain"
                                />
                            </li>
                        ))}
                    </ul>

                    {many && (
                        <>
                            <div className="absolute inset-y-0 left-2 hidden items-center sm:flex">
                                <IconButton aria-label="Photo précédente" variant="secondary" onClick={prev} className="shadow-sm">
                                    <ChevronLeft size={24} aria-hidden="true" />
                                </IconButton>
                            </div>
                            <div className="absolute inset-y-0 right-2 hidden items-center sm:flex">
                                <IconButton aria-label="Photo suivante" variant="secondary" onClick={next} className="shadow-sm">
                                    <ChevronRight size={24} aria-hidden="true" />
                                </IconButton>
                            </div>
                        </>
                    )}
                </div>

                {many && (
                    <div className="flex flex-shrink-0 items-center justify-between gap-3 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 sm:justify-center">
                        <IconButton aria-label="Photo précédente" variant="secondary" onClick={prev} className="sm:hidden">
                            <ChevronLeft size={24} aria-hidden="true" />
                        </IconButton>
                        <p className="text-center text-sm text-foreground">Glissez la photo ou utilisez les flèches.</p>
                        <IconButton aria-label="Photo suivante" variant="secondary" onClick={next} className="sm:hidden">
                            <ChevronRight size={24} aria-hidden="true" />
                        </IconButton>
                    </div>
                )}
            </div>
        </dialog>
    );
}
