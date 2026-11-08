'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Tabs, type TabsProps } from './Tabs';
import { cn } from './cn';

/** Écart (px) sous lequel un bord est considéré comme atteint (arrondis des positions de défilement). */
const EDGE_TOLERANCE_PX = 4;

/**
 * Largeur d'un indice de débordement, en px : celle de `w-8` (2 rem). Le conteneur qui défile reçoit la même
 * marge de défilement (`scroll-px-8`, scroll-padding-inline) : un onglet amené à l'écran (clavier, onglet
 * actif) n'est jamais caché sous un indice.
 */
const HINT_WIDTH_PX = 32;

/**
 * Onglets qui débordent (lot 5 : pilotage, liste des organisateurs ; lot 6 : file admin à 8 onglets, page admin
 * Notifications). La barre défile horizontalement (Tabs) ; un dégradé sur la couleur du fond de page (token
 * surface-sunken) et un chevron signalent qu'il reste des onglets de chaque côté, et l'onglet actif est ramené
 * au centre de la zone libre entre les deux indices (au montage, puis à chaque changement, y compris au
 * clavier). Sans débordement (ordinateur), aucun indice n'est affiché.
 * Les indices sont décoratifs (aria-hidden) et ne captent aucun clic. Même API que Tabs (TabsProps).
 */
export function ScrollableTabs(props: TabsProps) {
    const { value, className, ...rest } = props;
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const [edges, setEdges] = useState<{ start: boolean; end: boolean }>({ start: false, end: false });

    /** Conteneur qui défile : premier enfant rendu par Tabs. */
    const scroller = useCallback((): HTMLElement | null => {
        const el = wrapperRef.current?.firstElementChild;
        return el instanceof HTMLElement ? el : null;
    }, []);

    const updateEdges = useCallback(() => {
        const el = scroller();
        if (!el) return;
        const max = el.scrollWidth - el.clientWidth;
        const start = el.scrollLeft > EDGE_TOLERANCE_PX;
        const end = max - el.scrollLeft > EDGE_TOLERANCE_PX;
        setEdges((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
    }, [scroller]);

    useEffect(() => {
        const el = scroller();
        if (!el) return undefined;
        updateEdges();
        el.addEventListener('scroll', updateEdges, { passive: true });
        const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateEdges);
        observer?.observe(el);
        window.addEventListener('resize', updateEdges);
        return () => {
            el.removeEventListener('scroll', updateEdges);
            observer?.disconnect();
            window.removeEventListener('resize', updateEdges);
        };
    }, [scroller, updateEdges]);

    // Onglet actif centré entre les deux indices (effet du parent : il passe après le scrollIntoView de Tabs).
    // Un onglet plus large que la zone libre est aligné juste après l'indice de gauche.
    useEffect(() => {
        const el = scroller();
        const active = el?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
        if (!el || !active || el.scrollWidth <= el.clientWidth) {
            updateEdges();
            return;
        }
        const box = el.getBoundingClientRect();
        const tab = active.getBoundingClientRect();
        const free = box.width - 2 * HINT_WIDTH_PX;
        const offset = tab.width <= free ? (box.width - tab.width) / 2 : HINT_WIDTH_PX;
        const target = el.scrollLeft + (tab.left - box.left) - offset;
        const reduceMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        el.scrollTo({ left: Math.max(0, target), behavior: reduceMotion ? 'auto' : 'smooth' });
        updateEdges();
    }, [value, scroller, updateEdges]);

    return (
        <div ref={wrapperRef} className="relative">
            <Tabs {...rest} value={value} className={cn('scroll-px-8', className)} />
            <span
                aria-hidden="true"
                className={cn(
                    'pointer-events-none absolute inset-y-0 -left-4 flex w-8 items-center justify-start bg-gradient-to-r from-surface-sunken from-60% to-surface-sunken/0 text-fg-muted transition-opacity duration-200 sm:left-0',
                    edges.start ? 'opacity-100' : 'opacity-0',
                )}
            >
                <ChevronLeft size={18} />
            </span>
            <span
                aria-hidden="true"
                className={cn(
                    'pointer-events-none absolute inset-y-0 -right-4 flex w-8 items-center justify-end bg-gradient-to-l from-surface-sunken from-60% to-surface-sunken/0 text-fg-muted transition-opacity duration-200 sm:right-0',
                    edges.end ? 'opacity-100' : 'opacity-0',
                )}
            >
                <ChevronRight size={18} />
            </span>
        </div>
    );
}
