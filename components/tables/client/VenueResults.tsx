'use client';

/**
 * Lot 11b (écrans du client) : liste des établissements trouvés. La première page vient du serveur (rendu de /tables) ;
 * « Voir plus » demande la suite à GET /api/tables avec les mêmes filtres et le décalage (`offset`), puis place le focus
 * sur le premier nouvel établissement (clavier et lecteur d'écran). Refus ou panne : message de la route et
 * « Réessayer ».
 */
import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { ApiError, errorMessage, fetchJson } from '@/components/partner/fetch-json';
import type { VenueCard as VenueCardData } from '@/lib/tables/queries';
import { VenueCard } from './VenueCard';

function countText(n: number): string {
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export function VenueResults({ initial, total, query, date, time, guests, dayLabel }: {
    initial: VenueCardData[];
    total: number;
    /** Filtres de l'adresse (sans le décalage), repris tels quels par GET /api/tables. */
    query: string;
    date: string | null;
    time: string | null;
    guests: number;
    dayLabel: string;
}) {
    const [venues, setVenues] = useState<VenueCardData[]>(initial);
    const [loading, setLoading] = useState(false);
    const [failure, setFailure] = useState<string | null>(null);
    const focusIndex = useRef<number | null>(null);
    const links = useRef<Map<number, HTMLAnchorElement>>(new Map());

    useEffect(() => {
        if (focusIndex.current === null) return;
        links.current.get(focusIndex.current)?.focus();
        focusIndex.current = null;
    }, [venues]);

    const loadMore = async () => {
        setLoading(true);
        setFailure(null);
        try {
            const params = new URLSearchParams(query);
            if (date && !params.has('date')) params.set('date', date);
            params.set('offset', String(venues.length));
            const body = await fetchJson<{ venues?: VenueCardData[] }>(`/api/tables?${params.toString()}`);
            const known = new Set(venues.map((v) => v.id));
            const fresh = (Array.isArray(body.venues) ? body.venues : []).filter((v) => !known.has(v.id));
            if (fresh.length > 0) focusIndex.current = venues.length;
            setVenues((prev) => [...prev, ...fresh]);
            if (fresh.length === 0) setFailure('Aucun autre établissement pour le moment.');
        } catch (err) {
            setFailure(err instanceof ApiError ? errorMessage(err) : 'Impossible de charger la suite. Vérifiez votre connexion, puis réessayez.');
        } finally {
            setLoading(false);
        }
    };

    const remaining = total - venues.length;

    return (
        <section aria-labelledby="etablissements-trouves" className="space-y-4">
            <h2 id="etablissements-trouves" className="text-base font-semibold text-foreground-strong">
                {total > 1 ? `${countText(total)} établissements` : '1 établissement'}
            </h2>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {venues.map((venue, i) => (
                    <li key={venue.id} className="min-w-0">
                        <VenueCard
                            venue={venue}
                            date={date}
                            time={time}
                            guests={guests}
                            dayLabel={dayLabel}
                            eager={i === 0}
                            linkRef={(node) => {
                                if (node) links.current.set(i, node);
                                else links.current.delete(i);
                            }}
                        />
                    </li>
                ))}
            </ul>
            {failure && (
                <StatusBanner
                    tone="warning"
                    title="La suite n’a pas pu être chargée"
                    announce="alert"
                    action={<Button variant="secondary" size="sm" onClick={loadMore} isLoading={loading}>Réessayer</Button>}
                >
                    {failure}
                </StatusBanner>
            )}
            {remaining > 0 && !failure && (
                <div className="flex flex-col items-center gap-2 pt-2">
                    <p className="text-sm text-muted-foreground">{`${countText(venues.length)} affichés sur ${countText(total)}`}</p>
                    <Button variant="secondary" onClick={loadMore} isLoading={loading}>
                        Voir plus
                    </Button>
                </div>
            )}
        </section>
    );
}
