import React from 'react';
import Image from 'next/image';
import { Clock, MapPin, Timer } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/components/ui/cn';
import { isProjectStorageImage } from '@/lib/events/event-image';
import { ORDER_MODE_LABELS, type VenueMenu } from '@/lib/orders/menu-types';
import { todayHours } from '@/lib/orders/cart-client';

const KIND_LABELS: Readonly<Record<string, string>> = { RESTAURANT: 'Restaurant', BAR: 'Bar', ESPACE: 'Espace', BOUTIQUE: 'Boutique' };

/** Lot 12b — en-tête de la carte : grande photo de l'établissement, nom, ville, horaires du jour, modes de remise. */
export function MenuHeader({ menu }: { menu: VenueMenu }) {
    const { venue, ordering } = menu;
    const hours = todayHours(menu);
    const photo = venue.photos.find((p) => isProjectStorageImage(p)) ?? null;
    return (
        <header className="overflow-hidden rounded-3xl border border-border bg-card">
            <div className="relative aspect-[16/9] w-full bg-muted sm:aspect-[21/8]">
                {photo ? (
                    <Image src={photo} alt={`Photo de ${venue.name}`} fill priority sizes="(min-width: 1024px) 66vw, 100vw" className="object-cover" />
                ) : (
                    <span aria-hidden="true" className="absolute inset-x-0 top-0 h-full bg-gradient-to-br from-primary-soft via-muted to-card" />
                )}
                <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-scrim to-transparent opacity-70" />
            </div>
            <div className="space-y-3 p-4 sm:p-6">
                <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="brand">{KIND_LABELS[venue.kind] ?? 'Établissement'}</Badge>
                    <Badge variant={hours.open ? 'success' : 'neutral'}>{hours.open ? 'Ouvert maintenant' : 'Fermé en ce moment'}</Badge>
                </div>
                <h1 className="break-words text-3xl font-extrabold leading-tight tracking-tight text-foreground-strong sm:text-4xl">{venue.name}</h1>
                {venue.description && <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">{venue.description}</p>}
                <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-foreground">
                    {(venue.city || venue.address) && (
                        <li className="flex items-center gap-1.5">
                            <MapPin size={16} aria-hidden="true" className="text-primary-text" />
                            <span>{[venue.address, venue.city].filter(Boolean).join(', ')}</span>
                        </li>
                    )}
                    <li className="flex items-center gap-1.5">
                        <Clock size={16} aria-hidden="true" className="text-primary-text" />
                        <span className="tabular-nums">{hours.text ? `Aujourd’hui ${hours.text}` : 'Fermé aujourd’hui'}</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                        <Timer size={16} aria-hidden="true" className="text-primary-text" />
                        <span className="tabular-nums">{`Prêt en ${ordering.prepMinutes} min environ`}</span>
                    </li>
                </ul>
                <ul className="flex flex-wrap gap-2" aria-label="Modes de remise">
                    {ordering.modes.map((m) => (
                        <li key={m} className={cn('rounded-full border border-border bg-muted px-3 py-1 text-sm font-semibold text-foreground-strong')}>
                            {ORDER_MODE_LABELS[m]}
                        </li>
                    ))}
                </ul>
            </div>
        </header>
    );
}
