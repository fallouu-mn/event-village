'use client';

import React, { useEffect, useState } from 'react';
import Link from '@/components/ui/IntentLink';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/components/ui/cn';

export interface BottomNavItem {
  name: string;
  short?: string;
  href: string;
  icon: LucideIcon;
  /** Point « du nouveau » (notifications non lues), annoncé dans le nom accessible. */
  dot?: boolean;
}

/**
 * Design 1e (point 2) — barre de navigation basse flottante en pilule (< 1024 px).
 *  - pilule blanche en clair, noire en sombre (--nav-bar), ombre ; onglet actif = pastille orange de la marque qui GLISSE
 *    d'un onglet à l'autre (transform seulement, ressort de 250 ms ; coupé si « réduire les animations ») ; texte et icône
 *    de l'onglet actif en #1A1A1A sur l'orange (5,12:1) ;
 *  - la pastille part dès le toucher (onglet visé), sans attendre la fin de la navigation ;
 *  - hauteur fixe (onglets de 48 px, barre de 64 px avec sa marge) : un libellé sur deux lignes (« Porte-feuille ») ne la
 *    grandit pas, la barre d'achat de la fiche se cale dessus (run 537) ; cibles de 44 px au moins, libellés entiers ;
 *  - zone sûre de l'iPhone : marge du bas = max(8 px, env(safe-area-inset-bottom)) (.ev-bottom-nav, app/globals.css) ;
 *  - rien de plus au premier affichage : aucune mesure de la page, aucun effet coûteux (une position en pourcentage).
 */
function BottomNavView({ items, activeHref }: { items: BottomNavItem[]; activeHref: string | null }) {
  const [pending, setPending] = useState<string | null>(null);
  useEffect(() => { setPending(null); }, [activeHref]);
  const current = pending ?? activeHref;
  const index = items.findIndex((item) => item.href === current);
  const count = Math.max(items.length, 1);

  return (
    <nav aria-label="Navigation rapide" className="safe-bottom fixed inset-x-0 bottom-0 z-40 ev-bottom-nav pointer-events-none px-3 lg:hidden">
      <div className="pointer-events-auto relative mx-auto flex max-w-md items-stretch rounded-full bg-nav-bar p-1 shadow-lg ring-1 ring-border">
        <span
          aria-hidden="true"
          className={cn('ev-nav-pill absolute bottom-1 left-1 top-1 rounded-full bg-brand-vif', index < 0 && 'opacity-0')}
          style={{ width: `calc((100% - 0.5rem) / ${count})`, transform: `translateX(${Math.max(index, 0) * 100}%)` }}
        />
        {items.map((item) => {
          const active = item.href === current;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setPending(item.href)}
              aria-current={item.href === activeHref ? 'page' : undefined}
              className={cn(
                'relative z-10 flex h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full px-1 transition-colors duration-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                active ? 'text-brand-vif-foreground' : 'text-muted-foreground hover:text-foreground-strong',
              )}
            >
              <span className="relative inline-flex">
                <Icon size={18} aria-hidden="true" />
                {item.dot && (
                  <span aria-hidden="true" className="absolute -right-1 -top-0.5 h-2.5 w-2.5 rounded-full bg-danger ring-2 ring-nav-bar" />
                )}
              </span>
              {/* Design 1c (point 1) : libellé entier, au besoin sur deux lignes (aucun texte tronqué à 320 px) */}
              <small className="text-caption max-w-full text-center font-semibold leading-[1.1] [overflow-wrap:anywhere]">
                {item.short ?? item.name}
                {item.dot && <span className="sr-only"> (nouvelles notifications)</span>}
              </small>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/**
 * Design 1e (vitesse) : la coquille se redessine à chaque changement de session ou de réglage pendant le chargement ; la
 * barre ne se redessine que si ses onglets (adresse, libellé, point) ou l'onglet actif changent.
 */
const sameBar = (a: { items: BottomNavItem[]; activeHref: string | null }, b: { items: BottomNavItem[]; activeHref: string | null }): boolean =>
  a.activeHref === b.activeHref && a.items.length === b.items.length
  && a.items.every((x, i) => x.href === b.items[i].href && x.name === b.items[i].name && x.short === b.items[i].short && x.icon === b.items[i].icon && Boolean(x.dot) === Boolean(b.items[i].dot));
export const BottomNav = React.memo(BottomNavView, sameBar);
