/**
 * Lot 10b (point 2) : carte d'une salle dans les résultats de recherche. Photo (place réservée en 16/10, la première
 * chargée tout de suite, les autres à la demande), nom, ville, capacité, prix par jour et par heure s'il existe,
 * quelques équipements. Toute la carte est un lien vers la fiche. Prix lus dans la réponse de la recherche.
 */
import Image from 'next/image';
import Link from 'next/link';
import { Images, MapPin, Users } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { eventImageSrc } from '@/lib/events/event-image';
import { fcfaText } from '@/lib/halls/views';
import type { HallCard as HallCardData } from '@/lib/halls/queries';
import { countText } from './format';

const SHOWN_AMENITIES = 3;

export function HallCard({ hall, eager = false, linkRef }: { hall: HallCardData; eager?: boolean; linkRef?: (node: HTMLAnchorElement | null) => void }) {
    const place = [hall.city, hall.address].filter(Boolean).join(' · ');
    const extra = hall.amenities.length - SHOWN_AMENITIES;
    return (
        <Link
            ref={linkRef}
            href={`/halls/${hall.id}`}
            className="group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card text-foreground shadow-sm transition-shadow duration-fast ease-standard hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
            <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
                <Image
                    src={eventImageSrc(hall.photo)}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover"
                    priority={eager}
                    loading={eager ? undefined : 'lazy'}
                />
                {hall.photoCount > 1 && (
                    <span className="absolute bottom-3 right-3">
                        <Badge variant="default" size="sm" icon={<Images size={14} aria-hidden="true" />}>
                            {`${hall.photoCount} photos`}
                        </Badge>
                    </span>
                )}
            </div>
            <div className="flex flex-1 flex-col gap-3 p-4">
                <div className="space-y-1">
                    <h3 className="break-words text-lg font-bold leading-snug text-foreground-strong group-hover:underline group-hover:underline-offset-4">
                        {hall.name}
                    </h3>
                    {place && (
                        <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
                            <MapPin size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                            <span className="min-w-0 break-words">{place}</span>
                        </p>
                    )}
                    <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Users size={16} className="flex-shrink-0" aria-hidden="true" />
                        <span>{`Jusqu’à ${countText(hall.capacity)} invités`}</span>
                    </p>
                </div>
                {hall.amenities.length > 0 && (
                    <ul className="flex flex-wrap gap-1.5" aria-label="Équipements">
                        {hall.amenities.slice(0, SHOWN_AMENITIES).map((a) => (
                            <li key={a}>
                                <Badge variant="neutral" size="sm">{a}</Badge>
                            </li>
                        ))}
                        {extra > 0 && (
                            <li>
                                <Badge variant="neutral" size="sm">{`+ ${extra}`}</Badge>
                            </li>
                        )}
                    </ul>
                )}
                <div className="mt-auto border-t border-border pt-3">
                    <p className="text-base text-foreground">
                        <span className="text-lg font-bold tabular-nums text-foreground-strong">{fcfaText(hall.pricePerDay)}</span>
                        <span className="text-sm text-muted-foreground"> par jour</span>
                    </p>
                    {hall.pricePerHour !== null && (
                        <p className="text-sm text-muted-foreground">
                            {'ou '}
                            <span className="font-semibold tabular-nums text-foreground-strong">{fcfaText(hall.pricePerHour)}</span>
                            {' par heure'}
                        </p>
                    )}
                </div>
            </div>
        </Link>
    );
}
