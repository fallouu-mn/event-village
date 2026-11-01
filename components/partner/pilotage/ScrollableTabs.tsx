'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Tabs, type TabsProps } from '@/components/ui/Tabs';
import { cn } from '@/components/ui/cn';

/** Écart (px) sous lequel un bord est considéré comme atteint (arrondis des positions de défilement). */
const EDGE_TOLERANCE_PX = 4;

/**
 * Onglets du pilotage quand ils débordent (six onglets à 390 px) : la barre défile horizontalement (Tabs),
 * un dégradé sur la couleur du fond de page (token surface-sunken) et un chevron signalent qu'il reste des
 * onglets de chaque côté, et l'onglet actif est ramené au centre de la barre (au montage, puis à chaque
 * changement, y compris au clavier). Sans débordement (ordinateur), aucun indice n'est affiché.
 * Les indices sont décoratifs (aria-hidden) et ne captent aucun clic.
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

    // Onglet actif centré dans la barre (effet du parent : il passe après le scrollIntoView de Tabs).
    useEffect(() => {
        const el = scroller();
        const active = el?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
        if (!el || !active || el.scrollWidth <= el.clientWidth) {
            updateEdges();
            return;
        }
        const box = el.getBoundingClientRect();
        const tab = active.getBoundingClientRect();
        const target = el.scrollLeft + (tab.left - box.left) - (box.width - tab.width) / 2;
        const reduceMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        el.scrollTo({ left: Math.max(0, target), behavior: reduceMotion ? 'auto' : 'smooth' });
        updateEdges();
    }, [value, scroller, updateEdges]);

    return (
        <div ref={wrapperRef} className="relative">
            <Tabs {...rest} value={value} className={className} />
            <span
                aria-hidden="true"
                className={cn(
                    'pointer-events-none absolute inset-y-0 -left-4 flex w-12 items-center justify-start bg-gradient-to-r from-surface-sunken via-surface-sunken/80 to-surface-sunken/0 pl-1 text-fg-muted transition-opacity duration-200 sm:left-0',
                    edges.start ? 'opacity-100' : 'opacity-0',
                )}
            >
                <ChevronLeft size={18} />
            </span>
            <span
                aria-hidden="true"
                className={cn(
                    'pointer-events-none absolute inset-y-0 -right-4 flex w-12 items-center justify-end bg-gradient-to-l from-surface-sunken via-surface-sunken/80 to-surface-sunken/0 pr-1 text-fg-muted transition-opacity duration-200 sm:right-0',
                    edges.end ? 'opacity-100' : 'opacity-0',
                )}
            >
                <ChevronRight size={18} />
            </span>
        </div>
    );
}
