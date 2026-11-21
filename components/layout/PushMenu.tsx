'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;
const DURATION_MS = 280;
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Design 1e (point 2) — menu du téléphone et de la tablette (< 1024 px) : la page RECULE (légère réduction, coins arrondis,
 * ombre) et glisse vers la droite ; le menu apparaît derrière, sur l'orange de la marque, entrées en blanc gras de 19 px
 * (« grand texte » : 3,40:1) et petits libellés en #1A1A1A (5,12:1). 280 ms, transform et opacity seulement.
 *  - fermeture en touchant la page, en glissant vers la gauche, par Échap ou par le bouton ;
 *  - focus piégé : la page est rendue inerte (inert : ni focus, ni clic, ni lecteur d'écran) et Tab tourne dans le menu ;
 *    le focus revient au bouton du menu à la fermeture ;
 *  - la page est figée à sa position de défilement le temps du menu (.ev-push-fixed), puis rendue telle quelle ; après une
 *    navigation depuis le menu, elle repart du haut ;
 *  - rien au premier affichage : le contenu du menu n'est rendu qu'à la première ouverture.
 */
export function PushMenu({
  open,
  onClose,
  pageRef,
  returnFocusRef,
  pathname,
  header,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  pageRef: React.RefObject<HTMLDivElement | null>;
  returnFocusRef: React.RefObject<HTMLButtonElement | null>;
  pathname: string;
  header: React.ReactNode;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  const [rendered, setRendered] = useState(false);
  const [shown, setShown] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const scrollYRef = useRef(0);
  const openedAtRef = useRef(pathname);
  const wasOpenRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useIsoLayoutEffect(() => {
    const page = pageRef.current;
    if (!page) return undefined;
    if (open) {
      wasOpenRef.current = true;
      setRendered(true);
      scrollYRef.current = window.scrollY;
      openedAtRef.current = window.location.pathname;
      page.classList.add('ev-push-fixed');
      page.scrollTop = scrollYRef.current;
      page.setAttribute('inert', '');
      page.setAttribute('aria-hidden', 'true');
      document.documentElement.classList.add('ev-menu-ouvert');
      let inner = 0;
      const outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(() => {
          page.setAttribute('data-menu', 'ouvert');
          setShown(true);
        });
      });
      return () => { cancelAnimationFrame(outer); cancelAnimationFrame(inner); };
    }
    if (!wasOpenRef.current) return undefined;
    wasOpenRef.current = false;
    page.removeAttribute('data-menu');
    page.removeAttribute('inert');
    page.removeAttribute('aria-hidden');
    setShown(false);
    const done = () => {
      page.classList.remove('ev-push-fixed');
      document.documentElement.classList.remove('ev-menu-ouvert');
      window.scrollTo(0, window.location.pathname === openedAtRef.current ? scrollYRef.current : 0);
      returnFocusRef.current?.focus();
    };
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { done(); return undefined; }
    const timer = window.setTimeout(done, DURATION_MS + 20);
    return () => { window.clearTimeout(timer); done(); };
  }, [open, pageRef, returnFocusRef]);

  // Focus dans le menu à l'ouverture ; Échap ; Tab tourne dans le menu
  useEffect(() => {
    if (!open) return undefined;
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onCloseRef.current(); return; }
      if (e.key !== 'Tab' || !menuRef.current) return;
      const items = Array.from(menuRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // Glisser vers la gauche (sur le menu ou sur la page reculée) : fermeture
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => { const t = e.touches[0]; touch.current = { x: t.clientX, y: t.clientY }; };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touch.current;
    touch.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    if (dx < -50 && Math.abs(dx) > Math.abs(t.clientY - start.y)) onCloseRef.current();
  };

  if (!rendered) return null;
  return (
    <div
      ref={menuRef}
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
      data-open={shown ? '' : undefined}
      className={`ev-push-menu fixed inset-0 z-0 flex flex-col bg-brand-vif lg:hidden ${open || shown ? 'visible' : 'invisible'}`}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* La page reculée est inerte : un toucher sur elle arrive ici et ferme le menu */}
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-y-0 right-0 z-10 w-[calc(100%-min(68vw,320px))] cursor-default bg-transparent"
      />
      <div className="relative flex h-full w-[min(68vw,320px)] flex-col pt-[env(safe-area-inset-top)]">
        <div className="flex flex-shrink-0 items-center gap-2 px-3 py-3">
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Fermer le menu"
            className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-primary-foreground-large focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X size={24} aria-hidden="true" />
          </button>
          {header}
        </div>
        <nav aria-label="Navigation principale" className="ev-push-menu__items flex flex-1 flex-col gap-5 overflow-y-auto overscroll-contain px-3 pb-3">
          {children}
        </nav>
        <div className="flex-shrink-0 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">{footer}</div>
      </div>
    </div>
  );
}
