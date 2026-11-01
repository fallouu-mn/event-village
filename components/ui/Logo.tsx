'use client';

import React, { useId } from 'react';
import Link from 'next/link';

export interface LogoProps {
  /** full : symbole et nom ; mark : symbole seul ; auto : nom masqué sous 640 px. */
  variant?: 'full' | 'mark' | 'auto';
  /** Conservé pour compatibilité : les couleurs suivent désormais le thème par les tokens. */
  theme?: 'light' | 'dark' | 'auto';
  className?: string;
  linkToHome?: boolean;
}

/**
 * Logo Event Village, en tokens du système de design.
 *
 * Correctif lot 5 : l'ancien symbole remplissait son fond par url(#logo-mark-grad), un identifiant fixe
 * répété à chaque instance. Le logo de la barre latérale, masqué (display: none) sous 1024 px, venait en
 * premier dans le document : le navigateur résolvait l'url() vers ce dégradé non rendu, et le symbole de
 * l'en-tête mobile perdait son fond. Il ne restait que trois points (les deux encoches et la balise).
 * Désormais : identifiant unique par instance (useId) et encoches découpées par un masque, donc
 * transparentes sur n'importe quel fond, clair ou sombre.
 */
export const Logo: React.FC<LogoProps> = ({
  variant = 'full',
  className = '',
  linkToHome = true,
}) => {
  const maskId = `ev-logo-mask-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const showName = variant === 'full' || variant === 'auto';

  const content = (
    <span className={`flex select-none items-center gap-2.5 ${className}`}>
      <svg viewBox="0 0 100 100" className="h-9 w-9 flex-shrink-0 sm:h-10 sm:w-10" aria-hidden="true" focusable="false">
        <defs>
          <mask id={maskId}>
            <rect x="0" y="0" width="100" height="100" fill="white" />
            <circle cx="8" cy="50" r="7" fill="black" />
            <circle cx="92" cy="50" r="7" fill="black" />
          </mask>
        </defs>
        <rect x="8" y="8" width="84" height="84" rx="26" mask={`url(#${maskId})`} className="fill-brand-decor" />
        <path d="M50 24 L72 46 H60 V70 H40 V46 H28 Z" className="fill-on-brand" />
        <circle cx="50" cy="52" r="5" className="fill-brand-decor" />
      </svg>

      {showName && (
        <span
          className={`${variant === 'auto' ? 'hidden sm:flex' : 'flex'} items-center text-lg font-black leading-none tracking-tight sm:text-xl`}
        >
          {/* Espace réelle entre les deux mots (ignorée par la mise en page flex, l'écart vient de ml-1) :
              sans elle, le texte lu était « EVENTVILLAGE », absent du nom « Event Village, accueil »
              (axe label-content-name-mismatch, relecture des captures du run 50). */}
          <span className="text-fg">EVENT</span>{' '}
          <span className="ml-1 text-brand-fg">VILLAGE</span>
        </span>
      )}
    </span>
  );

  if (linkToHome) {
    return (
      <Link
        href="/"
        aria-label="Event Village, accueil"
        className="inline-flex min-h-11 min-w-11 items-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {content}
      </Link>
    );
  }

  return <span role="img" aria-label="Event Village">{content}</span>;
};
