'use client';

import React, { useState } from 'react';
import { cn } from './cn';

const AVATAR_PATH = '/storage/v1/object/public/avatars/';
const AVATAR_OBJECT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/;

/** Vrai pour une photo du bucket avatars de ce projet, au chemin <compte>/<uuid>.webp écrit par la route : aucune autre image n'est rendue. */
export function isAvatarUrl(url: unknown): url is string {
  if (typeof url !== 'string') return false;
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
  const prefix = `${base}${AVATAR_PATH}`;
  return base !== '' && url.startsWith(prefix) && AVATAR_OBJECT.test(url.slice(prefix.length));
}

const SIZES = {
  sm: { px: 40, box: 'h-10 w-10 rounded-full text-sm' },
  lg: { px: 64, box: 'h-16 w-16 rounded-2xl text-xl' },
} as const;

export interface AvatarProps {
  src?: string | null;
  initials: string;
  size?: keyof typeof SIZES;
  /** Vide quand le nom est écrit à côté : la photo est alors décorative. */
  alt?: string;
  className?: string;
}

/**
 * Photo de profil, ou initiales sans photo (lot 9, 9.2, AR3). Balise <img> sans l'optimiseur d'images de Next : le composant
 * est dans le layout des routes au budget de poids mesuré, et la route sert déjà un WebP carré de 256 px.
 */
export const Avatar: React.FC<AvatarProps> = ({ src, initials, size = 'sm', alt = '', className }) => {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const { px, box } = SIZES[size];
  const photo = isAvatarUrl(src) && src !== failedSrc ? src : null;

  return (
    <span
      className={cn('flex flex-shrink-0 items-center justify-center overflow-hidden border border-border bg-brand-bg font-bold text-brand-fg', box, className)}
      aria-hidden={alt ? undefined : true}
    >
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- AR3 : l'optimiseur d'images entrerait dans le layout des routes au budget mesuré
        <img
          src={photo}
          alt={alt}
          width={px}
          height={px}
          decoding="async"
          className="h-full w-full object-cover"
          onError={() => {
            console.warn('[Avatar] photo illisible : les initiales sont affichées à la place.');
            setFailedSrc(photo);
          }}
        />
      ) : (
        initials
      )}
    </span>
  );
};
