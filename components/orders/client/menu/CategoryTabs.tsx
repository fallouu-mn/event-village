'use client';

import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/components/ui/cn';

export interface MenuSection { id: string; name: string }

function reducedMotion(): boolean {
    try {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
        return false;
    }
}

/**
 * Lot 12b — onglets des catégories, collants en haut, qui suivent le défilement (IntersectionObserver sur chaque
 * section) ; un toucher fait défiler jusqu'à la section. L'onglet actif reste visible dans la barre (défilement
 * horizontal de la barre seule, jamais de la page).
 */
export function CategoryTabs({ sections }: { sections: MenuSection[] }) {
    const [active, setActive] = useState<string | null>(sections[0]?.id ?? null);
    const bar = useRef<HTMLDivElement | null>(null);
    const lock = useRef(0);

    useEffect(() => {
        if (sections.length === 0 || typeof IntersectionObserver === 'undefined') return undefined;
        const visible = new Map<string, number>();
        const obs = new IntersectionObserver((entries) => {
            for (const e of entries) visible.set(e.target.id, e.isIntersecting ? e.boundingClientRect.top : Number.POSITIVE_INFINITY);
            if (Date.now() < lock.current) return;
            const first = sections.map((s) => s.id).find((id) => (visible.get(id) ?? Number.POSITIVE_INFINITY) !== Number.POSITIVE_INFINITY);
            if (first) setActive(first);
        }, { rootMargin: '-120px 0px -55% 0px', threshold: 0 });
        for (const s of sections) {
            const el = document.getElementById(s.id);
            if (el) obs.observe(el);
        }
        return () => obs.disconnect();
    }, [sections]);

    useEffect(() => {
        if (!active || !bar.current) return;
        const tab = bar.current.querySelector<HTMLElement>(`[data-section="${active}"]`);
        if (tab) bar.current.scrollTo({ left: tab.offsetLeft - 16, behavior: reducedMotion() ? 'auto' : 'smooth' });
    }, [active]);

    if (sections.length < 2) return null;
    const go = (id: string) => {
        const el = document.getElementById(id);
        if (!el) return;
        lock.current = Date.now() + 700;
        setActive(id);
        el.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
    };
    return (
        <nav aria-label="Catégories de la carte" className="sticky top-16 z-20 -mx-4 border-b border-border bg-background px-4 py-2 sm:-mx-6 sm:px-6 lg:top-20 lg:mx-0 lg:rounded-2xl lg:border lg:px-2">
            <div ref={bar} className="flex gap-2 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {sections.map((s) => (
                    <button
                        key={s.id}
                        type="button"
                        data-section={s.id}
                        onClick={() => go(s.id)}
                        aria-current={active === s.id ? 'true' : undefined}
                        className={cn(
                            'min-h-11 flex-shrink-0 whitespace-nowrap rounded-full px-4 text-sm font-semibold transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            active === s.id ? 'bg-brand-vif text-brand-vif-foreground' : 'bg-muted text-foreground hover:text-foreground-strong',
                        )}
                    >
                        {s.name}
                    </button>
                ))}
            </div>
        </nav>
    );
}
