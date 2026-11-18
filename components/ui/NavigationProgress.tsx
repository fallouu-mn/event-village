'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Design 1a (point 7) — fine barre de progression orange en haut de l'écran pendant un changement de page, sans
 * bibliothèque. Départ : clic sur un lien interne vers une AUTRE page (même onglet, sans touche de modification) ou
 * retour arrière ; fin : la nouvelle adresse est affichée (usePathname). Filet : fin forcée après 10 s.
 * Décorative (aria-hidden) : les lecteurs d'écran ont le titre de la nouvelle page. Orange de la marque (élément d'interface,
 * jamais du texte). « Réduire les animations » : aucune avancée progressive, la barre apparaît puis disparaît.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle');
  const safety = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hide = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const start = (): void => {
      if (hide.current) clearTimeout(hide.current);
      if (safety.current) clearTimeout(safety.current);
      setState('loading');
      safety.current = setTimeout(() => setState('idle'), 10_000);
    };
    const onClick = (e: MouseEvent): void => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a');
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      start();
    };
    document.addEventListener('click', onClick, true);
    window.addEventListener('popstate', start);
    return () => {
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('popstate', start);
    };
  }, []);

  useEffect(() => {
    if (safety.current) clearTimeout(safety.current);
    setState((s) => (s === 'loading' ? 'done' : s));
    hide.current = setTimeout(() => setState((s) => (s === 'done' ? 'idle' : s)), 250);
    return () => { if (hide.current) clearTimeout(hide.current); };
  }, [pathname]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[110] h-[3px]"
      style={{ opacity: state === 'idle' ? 0 : 1, transition: 'opacity 150ms var(--ease-in)' }}
    >
      <div
        className="h-full origin-left bg-brand-vif motion-safe:transition-transform"
        style={{
          transform: `scaleX(${state === 'loading' ? 0.8 : state === 'done' ? 1 : 0})`,
          transitionDuration: state === 'loading' ? '8s' : '200ms',
          transitionTimingFunction: state === 'loading' ? 'cubic-bezier(0.1, 0.6, 0.2, 1)' : 'var(--ease-out)',
        }}
      />
    </div>
  );
}
