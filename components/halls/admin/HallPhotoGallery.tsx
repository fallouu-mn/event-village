'use client';

/**
 * Lot 10b (point 4) : galerie des photos d'une salle sur la fiche de décision de l'administration.
 * Grande photo choisie, vignettes en boutons (état « affichée » lu par les lecteurs d'écran), lien pour ouvrir la
 * photo en taille réelle. Première photo chargée tout de suite, les autres à la demande. Aucune animation.
 */

import React, { useState } from 'react';
import { ExternalLink, ImageOff } from 'lucide-react';
import { LinkButton } from '@/components/ui/LinkButton';
import { cn } from '@/components/ui/cn';

interface HallPhotoGalleryProps {
  photos: string[];
  hallName: string;
}

export function HallPhotoGallery({ photos, hallName }: HallPhotoGalleryProps) {
  const [index, setIndex] = useState(0);

  if (photos.length === 0) {
    return (
      <div className="flex aspect-[16/10] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted text-muted-foreground">
        <ImageOff size={28} aria-hidden="true" />
        <p className="text-sm">Aucune photo : la partenaire doit en ajouter au moins une.</p>
      </div>
    );
  }

  const current = Math.min(index, photos.length - 1);
  const src = photos[current];

  return (
    <div className="flex flex-col gap-3">
      <figure className="flex flex-col gap-2">
        <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl border border-border bg-muted">
          {/* Photos servies par le stockage du projet : pas d'optimiseur next/image (même choix que l'affiche des événements). */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={src}
            src={src}
            alt={`${hallName} : photo ${current + 1} sur ${photos.length}`}
            loading={current === 0 ? 'eager' : 'lazy'}
            decoding="async"
            className="h-full w-full object-cover"
          />
        </div>
        <figcaption className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm tabular-nums text-muted-foreground">
            {`Photo ${current + 1} sur ${photos.length}`}
          </span>
          <LinkButton href={src} external variant="ghost" size="sm" rightIcon={<ExternalLink size={16} />}>
            Voir en taille réelle
          </LinkButton>
        </figcaption>
      </figure>

      {photos.length > 1 && (
        <ul className="flex flex-wrap gap-2" aria-label="Choisir une photo">
          {photos.map((photo, i) => (
            <li key={`${photo}-${i}`}>
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-pressed={i === current}
                aria-label={`Afficher la photo ${i + 1} sur ${photos.length}`}
                className={cn(
                  'block h-14 w-20 overflow-hidden rounded-lg border-2 bg-muted transition-opacity duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card',
                  i === current ? 'border-primary' : 'border-transparent opacity-80 hover:opacity-100',
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
