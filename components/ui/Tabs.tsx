'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from './cn';

export interface TabItem {
  id: string;
  label: string;
  /** Compteur affiché à côté du libellé (et lu : « Publié, 4 »). */
  count?: number;
  disabled?: boolean;
}

export interface TabsProps {
  tabs: TabItem[];
  value: string;
  onChange: (id: string) => void;
  /** Nom accessible de la liste d'onglets (« Statut des événements »). */
  ariaLabel: string;
  /** Préfixe des identifiants (onglet et panneau) ; généré si omis. Le panneau utilise tabPanelId(). */
  idPrefix?: string;
  className?: string;
}

/** Identifiants partagés par un onglet et son panneau. */
export function tabId(prefix: string, id: string): string {
  return `${prefix}-onglet-${id}`;
}

export function tabPanelId(prefix: string, id: string): string {
  return `${prefix}-panneau-${id}`;
}

/**
 * Onglets accessibles (contrat Q) : role tablist et tab, aria-selected, tabulation itinérante (un seul
 * onglet dans l'ordre de tabulation), flèches gauche et droite, Début et Fin ; défilement horizontal
 * interne sans débordement de la page à 390 px ; cibles de 44 px.
 */
export function Tabs({ tabs, value, onChange, ariaLabel, idPrefix, className }: TabsProps) {
  const generated = useId();
  const prefix = idPrefix ?? `tabs-${generated}`;
  const refs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const enabled = tabs.filter((t) => !t.disabled);

  const move = (fromId: string, delta: number | 'first' | 'last'): void => {
    if (enabled.length === 0) return;
    const i = enabled.findIndex((t) => t.id === fromId);
    let next: number;
    if (delta === 'first') next = 0;
    else if (delta === 'last') next = enabled.length - 1;
    else next = (Math.max(i, 0) + delta + enabled.length) % enabled.length;
    const target = enabled[next];
    onChange(target.id);
    refs.current.get(target.id)?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, id: string): void => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      move(id, 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      move(id, -1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      move(id, 'first');
    } else if (e.key === 'End') {
      e.preventDefault();
      move(id, 'last');
    }
  };

  useEffect(() => {
    refs.current.get(value)?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [value]);

  return (
    <div className={cn('-mx-4 overflow-x-auto px-4 no-scrollbar sm:mx-0 sm:px-0', className)}>
      <div role="tablist" aria-label={ariaLabel} aria-orientation="horizontal" className="flex w-max min-w-full gap-1 border-b border-border">
        {tabs.map((tab) => {
          const selected = tab.id === value;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                if (el) refs.current.set(tab.id, el);
                else refs.current.delete(tab.id);
              }}
              type="button"
              role="tab"
              id={tabId(prefix, tab.id)}
              aria-selected={selected}
              aria-controls={tabPanelId(prefix, tab.id)}
              tabIndex={selected ? 0 : -1}
              disabled={tab.disabled}
              onClick={() => onChange(tab.id)}
              onKeyDown={(e) => onKeyDown(e, tab.id)}
              className={cn(
                'relative -mb-px inline-flex min-h-11 flex-shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap border-b-2 px-3 text-sm font-semibold transition-colors duration-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                'disabled:cursor-not-allowed disabled:opacity-50',
                selected ? 'border-brand-fg text-brand-fg' : 'border-transparent text-fg-muted hover:border-border-strong hover:text-fg',
              )}
            >
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && (
                <span
                  className={cn(
                    'inline-flex min-w-6 items-center justify-center rounded-full px-1.5 text-sm font-semibold tabular-nums',
                    selected ? 'bg-brand-bg text-brand-fg' : 'bg-surface-sunken text-fg-muted',
                  )}
                >
                  <span className="sr-only">, </span>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export interface TabPanelProps {
  idPrefix: string;
  tabIdValue: string;
  children: React.ReactNode;
  className?: string;
}

/** Panneau d'un onglet, relié à son onglet (aria-labelledby). */
export function TabPanel({ idPrefix, tabIdValue, children, className }: TabPanelProps) {
  return (
    <div role="tabpanel" id={tabPanelId(idPrefix, tabIdValue)} aria-labelledby={tabId(idPrefix, tabIdValue)} tabIndex={0} className={cn('focus-visible:outline-none', className)}>
      {children}
    </div>
  );
}

/**
 * Onglet courant porté par l'URL (`?tab=` par défaut) : lu au montage, écrit par router.replace sans
 * défilement. Une valeur hors de `allowed` revient à `fallback`. Ne dépend pas de useSearchParams
 * (pas de frontière Suspense imposée à la page).
 */
export function useTabParam<T extends string>(allowed: readonly T[], fallback: T, param = 'tab'): [T, (next: T) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const [current, setCurrent] = useState<T>(fallback);

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get(param);
    if (fromUrl && (allowed as readonly string[]).includes(fromUrl)) setCurrent(fromUrl as T);
    // lecture initiale seulement
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [param]);

  const select = useCallback((next: T) => {
    setCurrent(next);
    const params = new URLSearchParams(window.location.search);
    if (next === fallback) params.delete(param);
    else params.set(param, next);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [fallback, param, pathname, router]);

  return [current, select];
}
