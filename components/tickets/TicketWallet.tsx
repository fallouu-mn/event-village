'use client';

/**
 * Design 1b (point 8) — portefeuille de billets : sur téléphone, on glisse d'un billet à l'autre (défilement horizontal
 * magnétique en CSS, `scroll-snap`, aucune bibliothèque) ; boutons « Billet précédent » / « Billet suivant » de 44 px et
 * flèches gauche et droite du clavier quand la rangée a le focus (WCAG 2.5.7 : aucun geste obligatoire) ; position
 * annoncée poliment (« Billet 2 sur 3 »). Sur ordinateur, grille de deux colonnes sans défilement.
 * Arrivée en cascade (ev-stagger : 250 ms, déplacement et transparence), coupée si « réduire les animations ».
 *
 * Décision du 19/11 (option 1, temps de blocage de Mes billets) : seul le billet visible est dessiné en entier (QR compris) ;
 * les autres sont des vignettes légères (`thumb`), dépliées quand elles arrivent à l'écran (glissées au centre sur
 * téléphone ; sur ordinateur, à l'approche de l'écran) ou au toucher, avec une animation de 250 ms (transparence et
 * déplacement, ev-wallet-unfold), coupée si « réduire les animations ». Un billet déplié le reste.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { msToNextMinute } from './wallet';

export interface WalletItem {
  key: string;
  node: React.ReactNode;
  /** Vignette légère tant que le billet n'est pas déplié ; `open` le déplie. Absente : billet toujours complet. */
  thumb?: (open: () => void) => React.ReactNode;
}

/** Heure du téléphone, renouvelée à chaque changement de minute (une seule minuterie pour tous les comptes à rebours). */
export function useMinuteNow(initial?: number): number {
  // Décision du 19/11 : liste préparée par le serveur ; l'heure du serveur sert au premier rendu (rendu identique côté
  // serveur et navigateur, aucune erreur d'hydratation), puis l'heure du téléphone prend le relais.
  const [now, setNow] = useState(() => initial ?? Date.now());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      setNow(Date.now());
      timer = setTimeout(tick, msToNextMinute(Date.now()));
    };
    timer = setTimeout(tick, msToNextMinute(Date.now()));
    // Retour au premier plan : les minuteries ont pu être suspendues, l'heure est relue tout de suite.
    const onVisible = () => { if (document.visibilityState === 'visible') setNow(Date.now()); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  return now;
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Design 1e (point B) : `total` = nombre de billets de l'onglet (le portefeuille n'en affiche que les premiers, par 10) ;
 * `onEndReached` : appelé quand la fin des billets affichés approche (deux avant le dernier sur téléphone, ou le dernier
 * près de l'écran sur ordinateur), pour afficher les suivants.
 */
export function TicketWallet({ items, label, total, onEndReached }: { items: WalletItem[]; label: string; total?: number; onEndReached?: () => void }) {
  const listRef = useRef<HTMLUListElement>(null);
  const [index, setIndex] = useState(0);
  const count = items.length;
  const several = count > 1;
  // Billets dépliés (au toucher, ou arrivés à l'écran) ; le premier et le billet affiché le sont toujours
  const [opened, setOpened] = useState<ReadonlySet<string>>(() => new Set());
  const [animated, setAnimated] = useState<ReadonlySet<string>>(() => new Set());
  const open = useCallback((key: string, withAnimation: boolean) => {
    setOpened((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
    if (withAnimation) setAnimated((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
  }, []);
  const hasThumbs = items.some((it) => it.thumb);

  // Arrivée à l'écran : sur téléphone, le billet glissé au centre (60 % visible au moins) ; sur ordinateur, les billets de
  // la grille jusqu'à deux écrans plus bas. Les voisins qui dépassent à peine du bord restent en vignette.
  useEffect(() => {
    const list = listRef.current;
    if (!list || !hasThumbs || typeof IntersectionObserver !== 'function') return undefined;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const key = (e.target as HTMLElement).dataset.walletKey;
        if (e.isIntersecting && key) open(key, true);
      }
    }, { threshold: 0.6, rootMargin: '200% 0px 200% 0px' });
    Array.from(list.children).forEach((child) => io.observe(child));
    return () => io.disconnect();
  }, [hasThumbs, count, open]);

  // Billet affiché : celui dont le centre est le plus proche du centre de la rangée (lu à chaque image de défilement).
  useEffect(() => {
    const list = listRef.current;
    if (!list || !several) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const center = list.scrollLeft + list.clientWidth / 2;
        let best = 0;
        let bestDistance = Number.POSITIVE_INFINITY;
        Array.from(list.children).forEach((child, i) => {
          const el = child as HTMLElement;
          const distance = Math.abs(el.offsetLeft + el.offsetWidth / 2 - center);
          if (distance < bestDistance) {
            bestDistance = distance;
            best = i;
          }
        });
        setIndex(best);
      });
    };
    list.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      list.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [several, count]);

  useEffect(() => {
    if (index > count - 1) setIndex(Math.max(0, count - 1));
  }, [count, index]);

  // Design 1e (point B) : suite des billets. Téléphone (rangée qui glisse) : à deux billets de la fin ; ordinateur (grille) :
  // dernier billet à moins d'un écran du bas. Rien à faire si tous les billets sont déjà affichés.
  const hasMore = total !== undefined && total > count;
  useEffect(() => {
    if (hasMore && onEndReached && index >= count - 2) onEndReached();
  }, [hasMore, onEndReached, index, count]);
  useEffect(() => {
    const last = listRef.current?.lastElementChild;
    if (!hasMore || !onEndReached || !last || typeof IntersectionObserver !== 'function') return undefined;
    if (!window.matchMedia('(min-width: 768px)').matches) return undefined;
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) onEndReached(); }, { rootMargin: '0px 0px 100% 0px' });
    io.observe(last);
    return () => io.disconnect();
  }, [hasMore, onEndReached, count]);

  const go = useCallback((target: number) => {
    const list = listRef.current;
    const next = Math.min(Math.max(target, 0), count - 1);
    const child = list?.children[next] as HTMLElement | undefined;
    if (!list || !child) return;
    list.scrollTo({ left: child.offsetLeft - (list.clientWidth - child.offsetWidth) / 2, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    setIndex(next);
  }, [count]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLUListElement>) => {
    if (e.target !== e.currentTarget) return; // flèches d'un bouton ou d'un champ du billet : laissées telles quelles
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      go(index + 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      go(index - 1);
    }
  };

  return (
    <section aria-roledescription="carrousel" aria-label={label} className="space-y-3">
      {several && (
        <div className="flex items-center justify-between gap-3 md:hidden">
          <p className="text-sm font-semibold tabular-nums text-muted-foreground" aria-live="polite" aria-atomic="true">
            {`Billet ${index + 1} sur ${total ?? count}`}
          </p>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" aria-label="Billet précédent" onClick={() => go(index - 1)} disabled={index === 0}>
              <ChevronLeft size={20} aria-hidden="true" />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Billet suivant" onClick={() => go(index + 1)} disabled={index >= count - 1}>
              <ChevronRight size={20} aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}
      <ul
        ref={listRef}
        tabIndex={several ? 0 : undefined}
        aria-label={several ? `${label} : glissez ou utilisez les flèches pour passer d’un billet à l’autre` : undefined}
        onKeyDown={several ? onKeyDown : undefined}
        className={cn(
          'ev-stagger relative flex snap-x snap-mandatory items-start gap-3 overflow-x-auto overscroll-x-contain pb-2',
          '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          'rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          'md:grid md:grid-cols-2 md:gap-6 md:overflow-visible md:pb-0',
        )}
      >
        {items.map((item, i) => {
          const full = !item.thumb || i === 0 || i === index || opened.has(item.key);
          return (
            <li key={item.key} data-wallet-key={item.key} className={cn('min-w-0 shrink-0 snap-center md:w-auto', several ? 'w-[calc(100%-2rem)]' : 'w-full')}>
              {full ? (
                <div className={animated.has(item.key) ? 'ev-wallet-unfold' : undefined}>{item.node}</div>
              ) : (
                item.thumb?.(() => { open(item.key, true); go(i); })
              )}
            </li>
          );
        })}
      </ul>
      {several && (
        <div aria-hidden="true" className="flex justify-center gap-1.5 md:hidden">
          {items.map((item, i) => (
            <span
              key={item.key}
              className={cn('h-2 w-2 rounded-full transition-[background-color,transform] duration-200', i === index ? 'scale-125 bg-brand-vif' : 'bg-border')}
            />
          ))}
        </div>
      )}
    </section>
  );
}
