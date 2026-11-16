'use client';

import { useEffect, useRef } from 'react';

/**
 * Finition 3a (E-07) — une fois la page en place (`ready`), fait défiler jusqu'à l'ancre de l'adresse (#creances,
 * #versements-a-reprendre…) et pose le focus sur son titre, pour un lien venu d'un avis ou de l'accueil. Une seule fois
 * par chargement ; sans animation si l'utilisateur la refuse (prefers-reduced-motion).
 */
export function useHashScroll(ready: boolean): void {
    const done = useRef(false);
    useEffect(() => {
        if (!ready || done.current || typeof window === 'undefined') return;
        const id = decodeURIComponent(window.location.hash.replace(/^#/, ''));
        if (!id) return;
        const target = document.getElementById(id);
        if (!target) return;
        done.current = true;
        const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
        target.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
        const heading = target.querySelector<HTMLElement>('h2, h3') ?? target;
        if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
        heading.focus({ preventScroll: true });
    }, [ready]);
}
