import React from 'react';
import Link from 'next/link';

export interface LogoProps {
  /** full : symbole et nom ; mark : symbole seul ; auto : nom masqué sous 640 px. */
  variant?: 'full' | 'mark' | 'auto';
  /** Conservé pour compatibilité : les couleurs suivent le thème par les jetons. */
  theme?: 'light' | 'dark' | 'auto';
  className?: string;
  linkToHome?: boolean;
}

/**
 * Design 1a (direction.md, section 9, décision 1) — logo « Bras levés ».
 *
 * Symbole : public/branding/bras-leves-symbole.svg (docs/design/logo/svg, dégradé #EA580C → #DB2777, lisible en clair
 * et en sombre), en image : aucun octet de JavaScript, mis en cache par le service worker pour la page hors ligne.
 * Nom : « Event Village » en Plus Jakarta Sans graisse 800, resserré de 0,012 em, comme le nom vectorisé du logo
 * (docs/design/outils/logos.mjs) ; couleur `foreground-strong` (#1A1A1A en clair, blanc en sombre). Place réservée
 * (largeur et hauteur fixes) : rien ne saute au chargement. Nom accessible : « Event Village » (une seule fois).
 */
export const Logo: React.FC<LogoProps> = ({
  variant = 'full',
  className = '',
  linkToHome = true,
}) => {
  const showName = variant === 'full' || variant === 'auto';
  const content = (
    <span className={`flex select-none items-center gap-2 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- SVG statique du logo : next/image n'apporte rien et coûterait du JavaScript */}
      <img
        src="/branding/bras-leves-symbole.svg"
        alt=""
        aria-hidden="true"
        width={40}
        height={36}
        decoding="async"
        className="h-8 w-[2.2rem] flex-shrink-0 sm:h-9 sm:w-10"
      />
      {showName && (
        <span
          className={`${variant === 'auto' ? 'hidden sm:inline' : 'inline'} whitespace-nowrap text-xl font-extrabold leading-none tracking-[-0.012em] text-foreground-strong sm:text-[1.375rem]`}
        >
          Event Village
        </span>
      )}
    </span>
  );

  if (linkToHome) {
    return (
      <Link
        href="/"
        prefetch={false}
        aria-label="Event Village, accueil"
        className="inline-flex min-h-11 min-w-11 items-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {content}
      </Link>
    );
  }

  return <span role="img" aria-label="Event Village">{content}</span>;
};
