'use client';

import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { warmWhenIdle } from '@/lib/ui/warm-when-idle';

/** Distance de tirage (px) au-delà de laquelle relâcher actualise. */
const THRESHOLD = 64;
/** Course maximale de l'indicateur (px). */
const MAX_PULL = 88;

/**
 * Design 1d (point 10) — « tirer pour actualiser » sur Mes billets : en haut de la page, sur un écran tactile, tirer vers
 * le bas fait descendre un indicateur (déplacement et rotation en transform, aucune mise en page) ; relâché au-delà de
 * 64 px, la liste est relue (même lecture que le bouton « Réessayer »). Le geste horizontal (glisser d'un billet à
 * l'autre) n'est jamais pris. Le rechargement natif du navigateur est coupé sur cette page (overscroll-behavior), pour
 * ne pas recharger toute la page par erreur. Écouteurs passifs : le défilement n'attend jamais ce composant. Résultat
 * annoncé aux lecteurs d'écran ; rien ne bouge en continu, et rien d'animé si « réduire les animations ».
 */
export function PullToRefresh({ onRefresh }: { onRefresh: () => Promise<unknown> }) {
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [announce, setAnnounce] = useState('');
  const refreshRef = useRef(onRefresh);
  refreshRef.current = onRefresh;
  const busyRef = useRef(false);

  useEffect(() => {
    if (!window.matchMedia('(pointer: coarse)').matches) return undefined;
    // Run 504 (Mes billets 89, temps de blocage) : rien pendant l'hydratation de la page. L'écriture sur la racine du
    // document (recalcul du style de toute la page) et les écouteurs sont posés au premier moment libre une fois la
    // page prête (lib/ui/warm-when-idle.ts) ; sans réseau, rien (actualiser n'aurait rien à relire).
    const arm = (): (() => void) => {
      const root = document.documentElement;
      const previous = root.style.overscrollBehaviorY;
      root.style.overscrollBehaviorY = 'contain';
      let startX = 0;
      let startY = 0;
      let tracking = false;
      let decided = false;
      let current = 0;
      const onStart = (e: TouchEvent): void => {
        if (busyRef.current || window.scrollY > 0 || e.touches.length !== 1) return;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        tracking = true;
        decided = false;
        current = 0;
      };
      const onMove = (e: TouchEvent): void => {
        if (!tracking) return;
        const dx = e.touches[0].clientX - startX;
        const dy = e.touches[0].clientY - startY;
        if (!decided) {
          if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
          decided = true;
          if (dy <= 0 || Math.abs(dx) > Math.abs(dy) || window.scrollY > 0) {
            tracking = false;
            return;
          }
          setDragging(true);
        }
        current = Math.min(MAX_PULL, Math.max(0, dy * 0.5));
        setPull(current);
      };
      const onEnd = (): void => {
        if (!tracking) return;
        tracking = false;
        setDragging(false);
        if (current < THRESHOLD) {
          setPull(0);
          return;
        }
        busyRef.current = true;
        setBusy(true);
        setPull(THRESHOLD);
        setAnnounce('');
        void refreshRef.current()
          .then(() => setAnnounce('Billets mis à jour.'))
          .catch((err: unknown) => {
            console.warn('[mes billets] actualisation impossible :', err instanceof Error ? err.message : String(err));
            setAnnounce('Les billets n’ont pas pu être mis à jour.');
          })
          .finally(() => {
            busyRef.current = false;
            setBusy(false);
            setPull(0);
          });
      };
      window.addEventListener('touchstart', onStart, { passive: true });
      window.addEventListener('touchmove', onMove, { passive: true });
      window.addEventListener('touchend', onEnd, { passive: true });
      window.addEventListener('touchcancel', onEnd, { passive: true });
      return () => {
        root.style.overscrollBehaviorY = previous;
        window.removeEventListener('touchstart', onStart);
        window.removeEventListener('touchmove', onMove);
        window.removeEventListener('touchend', onEnd);
        window.removeEventListener('touchcancel', onEnd);
      };
    };
    let disarm: (() => void) | null = null;
    const cancelWarm = warmWhenIdle(() => { disarm = arm(); }, 2000);
    return () => {
      cancelWarm();
      disarm?.();
    };
  }, []);

  const shown = pull > 0 || busy;
  return (
    <>
      {shown && (
      <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-16 z-20 flex justify-center">
        <span
          {...(dragging ? { 'data-dragging': '' } : {})}
          className="ev-ptr-indicator flex h-11 items-center gap-2 rounded-full border border-border bg-popover px-4 text-sm font-semibold text-foreground-strong shadow-md"
          style={{ transform: `translateY(${pull - 24}px)` }}
        >
          <RefreshCw size={16} style={{ transform: `rotate(${Math.round(pull * 4)}deg)` }} />
          {busy ? 'Mise à jour…' : pull >= THRESHOLD ? 'Relâchez pour actualiser' : 'Tirez pour actualiser'}
        </span>
      </div>
      )}
      <p role="status" className="sr-only">{announce}</p>
    </>
  );
}
