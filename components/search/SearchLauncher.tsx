'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

import { SEARCH_LAUNCH_ATTR, SEARCH_OPEN_EVENT } from './search-events';

export { SEARCH_LAUNCH_ATTR, SEARCH_OPEN_EVENT };

// Fenêtre de recherche chargée seulement à la première ouverture : rien de plus dans le JavaScript de chaque page, et
// aucun chargement différé pendant la mesure (Lighthouse compte le travail reporté, design 1b).
const InstantSearch = dynamic(() => import('./InstantSearch').then((m) => ({ default: m.InstantSearch })), { ssr: false });

/**
 * Design 1d (point 9) — UN seul écouteur (délégation) pour ouvrir la recherche instantanée depuis tout élément marqué
 * `data-ev-search` : lien « Rechercher un événement » de l'en-tête et du menu, champ de recherche de l'accueil. Sans
 * JavaScript, ces éléments gardent leur rôle (lien vers Explorer, formulaire vers Explorer). Le contenu déjà tapé dans le
 * champ de l'accueil est repris par la fenêtre.
 */
export function SearchLauncher() {
  const [open, setOpen] = useState(false);
  const [initial, setInitial] = useState('');

  useEffect(() => {
    const launch = (target: HTMLElement, e: Event): void => {
      // Avant le lien (phase de capture) : la navigation vers Explorer n'a pas lieu, la fenêtre s'ouvre à la place
      e.preventDefault();
      e.stopPropagation();
      window.dispatchEvent(new Event(SEARCH_OPEN_EVENT));
      const value = target instanceof HTMLInputElement ? target.value : '';
      if (target instanceof HTMLInputElement) target.blur();
      setInitial(value);
      setOpen(true);
    };
    const onClick = (e: MouseEvent): void => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const target = (e.target as Element | null)?.closest?.<HTMLElement>(`[${SEARCH_LAUNCH_ATTR}]`);
      if (target) launch(target, e);
    };
    const onFocus = (e: FocusEvent): void => {
      const target = e.target as HTMLElement | null;
      if (target instanceof HTMLInputElement && target.hasAttribute(SEARCH_LAUNCH_ATTR)) launch(target, e);
    };
    document.addEventListener('click', onClick, true);
    document.addEventListener('focusin', onFocus);
    return () => {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('focusin', onFocus);
    };
  }, []);

  return open ? <InstantSearch initialQuery={initial} onClose={() => setOpen(false)} /> : null;
}
