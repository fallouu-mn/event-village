'use client';

import React, { useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

/**
 * Design 1b (décision du 18/11, temps de blocage de l'accueil et de Mes billets) — lien de la mise en page commune qui ne
 * précharge PAS sa page à l'affichage (next/link le fait pour chaque lien visible : connexion, inscription partenaire
 * avec zod, profil, portefeuille… analysés pendant le chargement mesuré, run 406), mais à l'INTENTION : survol, début de
 * toucher, focus clavier. La page reste préchargée avant le clic ; rien n'est chargé tant que personne ne vise le lien.
 */
type IntentLinkProps = React.ComponentProps<typeof Link>;

export default function IntentLink({ href, prefetch, onPointerEnter, onTouchStart, onFocus, ...rest }: IntentLinkProps) {
  const router = useRouter();
  const warm = useCallback(() => {
    if (typeof href === 'string' && href.startsWith('/')) router.prefetch(href);
  }, [href, router]);
  return (
    <Link
      href={href}
      prefetch={prefetch ?? false}
      onPointerEnter={(e) => { onPointerEnter?.(e); warm(); }}
      onTouchStart={(e) => { onTouchStart?.(e); warm(); }}
      onFocus={(e) => { onFocus?.(e); warm(); }}
      {...rest}
    />
  );
}
