/**
 * Lot 11b (écrans du client) : carte d'un établissement dans les résultats. Photo (place réservée en 16/10, la première
 * chargée tout de suite, les autres à la demande), genre, nom, ville, acompte ou « Gratuit », confirmation immédiate ou
 * sur acceptation, puis les créneaux du jour cherché en pastilles : une pastille libre mène à la fiche avec le jour,
 * l'heure et le nombre de personnes déjà remplis ; un créneau complet est grisé et barré (et dit « complet » à voix
 * haute) ; un créneau passé n'est pas montré. Le nom est le lien de la carte (zone cliquable étendue à toute la carte,
 * sans lien dans un lien : les pastilles passent au-dessus).
 */
import Image from 'next/image';
import Link from 'next/link';
import { Clock, Images, MapPin, Wallet, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { eventImageSrc } from '@/lib/events/event-image';
import { fcfaText, guestsText, hmText } from '@/lib/tables/views';
import type { VenueCard as VenueCardData } from '@/lib/tables/queries';
import { venueHref } from './search-filters';

/** Pastilles montrées au plus sur une carte (le reste est sur la fiche). */
const SHOWN_SLOTS = 6;

export function VenueCard({ venue, date, time, guests, dayLabel, eager = false, linkRef }: {
    venue: VenueCardData;
    date: string | null;
    time: string | null;
    guests: number;
    /** « aujourd'hui », « demain », « samedi 5 décembre ». */
    dayLabel: string;
    eager?: boolean;
    linkRef?: (node: HTMLAnchorElement | null) => void;
}) {
    const place = [venue.city, venue.address].filter(Boolean).join(' · ');
    const visible = venue.slots.filter((s) => s.state === 'LIBRE' || s.state === 'COMPLET');
    const shown = visible.slice(0, SHOWN_SLOTS);
    const more = visible.filter((s) => s.state === 'LIBRE').length - shown.filter((s) => s.state === 'LIBRE').length;
    const href = venueHref(venue.id, { date, time, guests });
    const free = venue.depositPerPerson <= 0;

    return (
        <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card text-foreground shadow-sm transition-shadow duration-fast ease-standard focus-within:ring-2 focus-within:ring-ring hover:shadow-md">
            <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
                <Image
                    src={eventImageSrc(venue.photo)}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover transition-transform duration-slow ease-out motion-safe:group-hover:scale-[1.03]"
                    priority={eager}
                    loading={eager ? undefined : 'lazy'}
                />
                <span className="absolute left-3 top-3">
                    <Badge variant="default" size="sm">{venue.kindLabel}</Badge>
                </span>
                {venue.photoCount > 1 && (
                    <span className="absolute bottom-3 right-3">
                        <Badge variant="default" size="sm" icon={<Images size={14} aria-hidden="true" />}>
                            {`${venue.photoCount} photos`}
                        </Badge>
                    </span>
                )}
            </div>
            <div className="flex flex-1 flex-col gap-3 p-4">
                <div className="space-y-1">
                    <h3 className="break-words text-lg font-bold leading-snug text-foreground-strong">
                        <Link
                            ref={linkRef}
                            href={href}
                            className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none group-hover:underline group-hover:underline-offset-4"
                        >
                            {venue.name}
                        </Link>
                    </h3>
                    {place && (
                        <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
                            <MapPin size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                            <span className="min-w-0 break-words">{place}</span>
                        </p>
                    )}
                </div>
                <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm" aria-label="Conditions">
                    <li className="flex items-center gap-1.5 font-semibold text-foreground-strong">
                        <Wallet size={16} className="flex-shrink-0 text-muted-foreground" aria-hidden="true" />
                        {free ? 'Gratuit' : <span><span className="tabular-nums">{`Acompte ${fcfaText(venue.depositPerPerson)}`}</span> par personne</span>}
                    </li>
                    <li className={venue.confirmation === 'AUTO' ? 'flex items-center gap-1.5 font-semibold text-success-text' : 'flex items-center gap-1.5 font-semibold text-info-text'}>
                        {venue.confirmation === 'AUTO' ? <Zap size={16} className="flex-shrink-0" aria-hidden="true" /> : <Clock size={16} className="flex-shrink-0" aria-hidden="true" />}
                        {venue.confirmation === 'AUTO' ? 'Confirmation immédiate' : 'Sur acceptation'}
                    </li>
                </ul>
                {date && (
                    <div className="mt-auto space-y-2 border-t border-border pt-3">
                        <p className="text-sm text-muted-foreground">{`${dayLabel.charAt(0).toUpperCase()}${dayLabel.slice(1)}, ${guestsText(guests)}`}</p>
                        {shown.length > 0 ? (
                            <ul className="relative z-10 flex flex-wrap gap-2" aria-label={`Créneaux ${dayLabel}`}>
                                {shown.map((s) => (
                                    <li key={s.time}>
                                        {s.state === 'LIBRE' ? (
                                            <Link
                                                href={venueHref(venue.id, { date, time: s.time, guests })}
                                                aria-label={`Réserver à ${hmText(s.time)}`}
                                                className="inline-flex min-h-11 min-w-[4.5rem] items-center justify-center rounded-xl bg-primary px-3 text-sm font-bold tabular-nums text-primary-foreground shadow-sm transition-colors duration-fast ease-standard hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
                                            >
                                                {hmText(s.time)}
                                            </Link>
                                        ) : (
                                            <span className="inline-flex min-h-11 min-w-[4.5rem] items-center justify-center rounded-xl border border-border bg-muted px-3 text-sm font-semibold tabular-nums text-muted-foreground line-through">
                                                <span aria-hidden="true">{hmText(s.time)}</span>
                                                <span className="sr-only">{`${hmText(s.time)}, complet`}</span>
                                            </span>
                                        )}
                                    </li>
                                ))}
                                {more > 0 && (
                                    <li>
                                        <Link
                                            href={href}
                                            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-card px-3 text-sm font-semibold text-primary-text transition-colors duration-fast ease-standard hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        >
                                            {`+ ${more} autre${more > 1 ? 's' : ''}`}
                                        </Link>
                                    </li>
                                )}
                            </ul>
                        ) : (
                            <p className="text-sm font-semibold text-foreground">
                                {time ? 'Plus de table libre autour de cette heure.' : 'Aucun créneau ce jour-là.'}
                                <span className="font-normal text-muted-foreground"> Voyez les autres jours sur la fiche.</span>
                            </p>
                        )}
                    </div>
                )}
            </div>
        </article>
    );
}
