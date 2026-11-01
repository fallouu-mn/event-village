import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { eventImageSrc, isProjectStorageImage } from '@/lib/events/event-image';

/**
 * Grande carte d'un événement (lot 5, contrat Q). Plus aucune image de repli d'une banque d'images :
 * l'affiche et l'avatar viennent du stockage du projet, sinon l'image locale neutre et les initiales de
 * l'organisateur. Toute la carte est un seul lien, porté par le titre.
 */
export interface FeaturedEventCardProps {
  id: string;
  title: string;
  artistName: string;
  artistAvatarUrl?: string | null;
  location: string;
  /** Jour du mois, par exemple « 19 ». */
  dateDay: string;
  /** Mois abrégé, par exemple « déc. ». */
  dateMonth: string;
  /** Prix déjà formaté par le serveur (« 5 000 F CFA », « Bientôt en vente »). */
  priceFormatted: string;
  imageUrl?: string | null;
}

function initialsOf(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
  return letters || 'EV';
}

export const FeaturedEventCard: React.FC<FeaturedEventCardProps> = ({
  id,
  title,
  artistName,
  artistAvatarUrl,
  location,
  dateDay,
  dateMonth,
  priceFormatted,
  imageUrl,
}) => {
  return (
    <article className="group relative w-full overflow-hidden rounded-3xl border border-border bg-surface p-2.5 shadow-sm transition-shadow duration-200 focus-within:ring-2 focus-within:ring-ring hover:shadow-lg">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-surface-sunken">
        <Image
          src={eventImageSrc(imageUrl)}
          alt=""
          fill
          className="object-cover motion-safe:transition-transform motion-safe:duration-500 motion-safe:group-hover:scale-[1.03]"
          sizes="(max-width: 640px) 100vw, 50vw"
        />

        <div
          className="absolute right-3 top-3 flex h-14 w-14 flex-col items-center justify-center rounded-full border border-border bg-surface text-fg shadow-md"
          aria-hidden="true"
        >
          <span className="text-base font-bold leading-none tabular-nums">{dateDay}</span>
          <span className="text-sm font-semibold leading-tight text-brand-fg">{dateMonth}</span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 px-1.5 pb-1 pt-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-brand-bg text-sm font-bold text-brand-fg">
            {isProjectStorageImage(artistAvatarUrl) ? (
              <Image src={artistAvatarUrl} alt="" fill className="object-cover" sizes="44px" />
            ) : (
              <span aria-hidden="true">{initialsOf(artistName)}</span>
            )}
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-base font-bold leading-tight text-fg">
              <Link href={`/events/${id}`} className="after:absolute after:inset-0 focus-visible:outline-none">
                {title}
              </Link>
            </h3>
            <p className="truncate text-sm text-fg-muted">
              {artistName} · {location}
            </p>
          </div>
        </div>

        <p className="flex-shrink-0 rounded-full bg-surface-sunken px-3.5 py-2 text-sm font-bold tabular-nums text-fg">
          {priceFormatted}
        </p>
      </div>
    </article>
  );
};
