'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { SIDEBAR_KEY, SIDEBAR_COLLAPSED } from './sidebar-state';

/**
 * Design 1e (point 3) — barre latérale des espaces organisatrice et administration (≥ 1024 px).
 *  - surlignage de la rubrique active qui GLISSE de l'une à l'autre (transform, 250 ms) ;
 *  - repliable en icônes : la barre glisse vers la gauche (transform) et ne montre que sa bande d'icônes, les icônes restant
 *    en place, les libellés s'effaçant (app/globals.css, .ev-side*) ; choix gardé sur l'appareil (localStorage, toujours
 *    dans try/catch : stockage refusé = barre dépliée, rien d'autre) et posé sur <html data-sidebar> AVANT le premier
 *    affichage (SIDEBAR_BOOT_SCRIPT, app/layout.tsx) : aucun saut ;
 *  - info-bulles en mode replié (survol et focus au clavier), nom accessible des liens inchangé (libellé dans le lien).
 */
export function ProSidebar({ pathname, header, children, footer }: {
  pathname: string;
  header: React.ReactNode;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  const navRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [hl, setHl] = useState<{ y: number; h: number } | null>(null);
  const [ready, setReady] = useState(false);
  const [tip, setTip] = useState<{ text: string; top: number } | null>(null);

  useEffect(() => { setCollapsed(document.documentElement.dataset.sidebar === SIDEBAR_COLLAPSED); }, []);

  const place = useCallback(() => {
    const nav = navRef.current;
    if (!nav || !window.matchMedia('(min-width: 1024px)').matches) return;
    const active = nav.querySelector<HTMLElement>('a[aria-current="page"]');
    if (!active) { setHl(null); return; }
    const navBox = nav.getBoundingClientRect();
    const box = active.getBoundingClientRect();
    setHl({ y: box.top - navBox.top, h: box.height });
  }, []);

  useEffect(() => {
    place();
    const id = window.requestAnimationFrame(() => setReady(true));
    window.addEventListener('resize', place);
    return () => { window.cancelAnimationFrame(id); window.removeEventListener('resize', place); };
  }, [place, pathname, children]);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    setTip(null);
    if (next) document.documentElement.dataset.sidebar = SIDEBAR_COLLAPSED;
    else delete document.documentElement.dataset.sidebar;
    try {
      if (next) window.localStorage.setItem(SIDEBAR_KEY, SIDEBAR_COLLAPSED);
      else window.localStorage.removeItem(SIDEBAR_KEY);
    } catch (err) {
      console.warn('[barre latérale] choix non gardé sur cet appareil :', err instanceof Error ? err.message : String(err));
    }
  };

  const showTip = (e: React.SyntheticEvent) => {
    if (!collapsed) return;
    const link = (e.target as HTMLElement).closest?.('a, button');
    const label = link?.querySelector('.ev-side-label')?.textContent?.trim();
    if (!link || !label) { setTip(null); return; }
    const r = link.getBoundingClientRect();
    setTip({ text: label, top: r.top + r.height / 2 });
  };

  return (
    <>
      <div className="ev-side-spacer hidden flex-shrink-0 lg:block" aria-hidden="true" />
      <aside className="ev-side fixed left-0 top-0 z-30 hidden h-screen flex-col overflow-y-auto overflow-x-hidden border-r border-border bg-card shadow-subtle lg:flex">
        <div className="flex flex-shrink-0 items-center justify-between gap-2 px-4 py-4">
          <div className="ev-side-label min-w-0">{header}</div>
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? 'Déplier la barre latérale' : 'Replier la barre latérale'}
            aria-expanded={!collapsed}
            className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {collapsed ? <PanelLeftOpen size={20} aria-hidden="true" /> : <PanelLeftClose size={20} aria-hidden="true" />}
          </button>
        </div>
        <div
          ref={navRef}
          className="relative flex-1 px-3 pb-3"
          onMouseOver={showTip}
          onFocus={showTip}
          onMouseLeave={() => setTip(null)}
          onBlur={() => setTip(null)}
        >
          <span
            aria-hidden="true"
            data-ready={ready && hl ? '' : undefined}
            className="ev-side-hl pointer-events-none absolute inset-x-3 top-0 rounded-xl bg-primary-soft"
            style={{ height: hl?.h ?? 0, transform: `translateY(${hl?.y ?? 0}px)`, opacity: hl ? 1 : 0 }}
          />
          <nav aria-label="Navigation principale" className="relative flex flex-col gap-5">
            {children}
          </nav>
        </div>
        <div className="mt-auto flex-shrink-0 border-t border-border p-3">{footer}</div>
      </aside>
      {tip && (
        <span
          role="tooltip"
          className="ev-side-tip pointer-events-none fixed left-[4.75rem] z-50 -translate-y-1/2 whitespace-nowrap rounded-lg bg-foreground-strong px-2.5 py-1.5 text-sm font-semibold text-background shadow-md"
          style={{ top: tip.top }}
        >
          {tip.text}
        </span>
      )}
    </>
  );
}
