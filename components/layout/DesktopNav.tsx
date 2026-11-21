'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from '@/components/ui/IntentLink';
import { cn } from '@/components/ui/cn';

export interface DesktopNavItem {
  name: string;
  href: string;
}

const LARGE = '(min-width: 1024px)';

/**
 * Design 1e (point 3) — rubriques de l'en-tête de l'ordinateur (≥ 1024 px) : un trait orange glisse sous la rubrique
 * active et suit le survol (et le focus au clavier), puis revient à la rubrique active. Une seule mesure des liens, sur
 * ordinateur seulement (rien sur téléphone, où la liste est masquée) ; trait déplacé par transform (translateX et scaleX
 * d'un trait de 100 px), 250 ms, coupé si « réduire les animations ».
 */
export function DesktopNav({ items, activeHref }: { items: DesktopNavItem[]; activeHref: string | null }) {
  const navRef = useRef<HTMLDivElement>(null);
  const [target, setTarget] = useState<number | null>(null);
  const [box, setBox] = useState<{ x: number; w: number } | null>(null);
  const [ready, setReady] = useState(false);
  const activeIndex = items.findIndex((i) => i.href === activeHref);
  const shown = target ?? activeIndex;

  const measure = useCallback(() => {
    if (!window.matchMedia(LARGE).matches) return;
    const nav = navRef.current;
    const el = shown >= 0 ? nav?.querySelectorAll<HTMLAnchorElement>('nav a')[shown] ?? null : null;
    if (!nav || !el) { setBox(null); return; }
    setBox({ x: el.offsetLeft + 12, w: Math.max(el.offsetWidth - 24, 8) });
  }, [shown]);

  useEffect(() => {
    measure();
    const id = window.requestAnimationFrame(() => setReady(true));
    const mq = window.matchMedia(LARGE);
    const onChange = () => measure();
    mq.addEventListener('change', onChange);
    window.addEventListener('resize', onChange);
    return () => { window.cancelAnimationFrame(id); mq.removeEventListener('change', onChange); window.removeEventListener('resize', onChange); };
  }, [measure]);

  return (
    <div ref={navRef} className="relative hidden h-full items-stretch lg:flex" onMouseLeave={() => setTarget(null)}>
      <nav aria-label="Rubriques" className="flex items-stretch gap-1">
        {items.map((item, i) => {
          const active = i === activeIndex;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              onMouseEnter={() => setTarget(i)}
              onFocus={() => setTarget(i)}
              onBlur={() => setTarget(null)}
              className={cn(
                'flex min-h-11 items-center whitespace-nowrap rounded-xl px-3 text-sm font-semibold transition-colors duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                active ? 'text-foreground-strong' : 'text-muted-foreground hover:text-foreground-strong',
              )}
            >
              {item.name}
            </Link>
          );
        })}
      </nav>
      <span
        aria-hidden="true"
        data-ready={ready && box ? '' : undefined}
        className="ev-nav-underline pointer-events-none absolute -bottom-2 left-0 h-[3px] w-[100px] rounded-full bg-brand-vif"
        style={{ transform: `translateX(${box?.x ?? 0}px) scaleX(${(box?.w ?? 0) / 100})`, opacity: box ? 1 : 0 }}
      />
    </div>
  );
}
