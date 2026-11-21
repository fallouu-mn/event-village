import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { CalendarCheck, SearchX, UtensilsCrossed } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { LinkButton } from '@/components/ui/LinkButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { RetryError } from '@/components/halls/client/RetryError';
import { VenueResults } from '@/components/tables/client/VenueResults';
import { VenueSearch } from '@/components/tables/client/VenueSearch';
import { relativeDay } from '@/components/tables/client/format';
import { DEFAULT_GUESTS, filtersQuery, readFilters, type VenueFilters } from '@/components/tables/client/search-filters';
import { TableRefusal, searchVenues, type VenueCard } from '@/lib/tables/queries';
import { dakarToday } from '@/lib/tables/views';

/**
 * Lot 11b (écrans du client) : recherche des établissements (restaurants, bars, espaces). Rendue par le serveur
 * (searchVenues de lib/tables/queries, même lecture que GET /api/tables) : ville (parmi celles des établissements
 * proposés), nom ou quartier, genre, jour (aujourd'hui par défaut), heure au quart d'heure, nombre de personnes (2 par
 * défaut), « Seulement les tables libres ». Les filtres sont dans l'adresse : partageable, retour arrière. Résultats en
 * cartes avec les créneaux du jour en pastilles ; « Voir plus » charge la suite dans le navigateur (offset). Filtre
 * refusé : message de la base en français ; panne : « Réessayer ». Service fermé : 404 par la garde du groupe.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: 'Réserver une table — Event Village',
    description: 'Trouvez une table libre au restaurant, au bar ou dans un espace, choisissez votre heure et réservez en ligne.',
};

type SearchOutcome =
    | { kind: 'ok'; total: number; venues: VenueCard[]; cities: string[]; date: string | null; time: string | null; guests: number }
    | { kind: 'refused'; message: string }
    | { kind: 'error' };

async function runSearch(f: VenueFilters, today: string): Promise<SearchOutcome> {
    try {
        const r = await searchVenues({
            q: f.q || null,
            city: f.city || null,
            kind: f.kind || null,
            date: f.date || today,
            time: f.time || null,
            guests: f.guests ? Number(f.guests) : DEFAULT_GUESTS,
            available: f.available,
            limit: 24,
            offset: 0,
        });
        return { kind: 'ok', total: r.total, venues: r.venues, cities: r.cities, date: r.date, time: r.time, guests: r.guests || DEFAULT_GUESTS };
    } catch (err) {
        if (err instanceof TableRefusal) return { kind: 'refused', message: err.publicText };
        console.error('[Tables] recherche impossible :', err instanceof Error ? err.message : String(err));
        return { kind: 'error' };
    }
}

export default async function TablesSearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    const filters = readFilters(await searchParams);
    const query = filtersQuery(filters);
    // Jour de Dakar (UTC+0) : aucune date passée proposée, 90 jours au plus
    const today = dakarToday();
    const maxDate = new Date(Date.parse(`${today}T00:00:00Z`) + 90 * 86_400_000).toISOString().slice(0, 10);
    const outcome = await runSearch(filters, today);
    const cities = outcome.kind === 'ok' ? outcome.cities : [];

    let content: ReactNode;
    if (outcome.kind === 'refused') {
        content = (
            <StatusBanner
                tone="warning"
                title="Cette recherche n’est pas possible"
                action={<LinkButton href="/tables" variant="secondary" size="sm">Effacer les filtres</LinkButton>}
            >
                {outcome.message}
            </StatusBanner>
        );
    } else if (outcome.kind === 'error') {
        content = <RetryError title="Les établissements n’ont pas pu être chargés" />;
    } else if (outcome.total === 0 || outcome.venues.length === 0) {
        content = query ? (
            <EmptyState
                icon={<SearchX size={28} />}
                title="Aucun établissement ne correspond"
                description="Essayez un autre jour, une autre heure, moins de personnes ou une autre ville."
                actionLabel="Effacer les filtres"
                actionHref="/tables"
            />
        ) : (
            <EmptyState
                icon={<UtensilsCrossed size={28} />}
                title="Aucun établissement proposé pour le moment"
                description="Les restaurants, bars et espaces apparaissent ici dès qu’ils sont validés par l’équipe d’Event Village. Revenez bientôt."
            />
        );
    } else {
        const date = outcome.date ?? (filters.date || today);
        content = (
            <VenueResults
                key={query}
                initial={outcome.venues}
                total={outcome.total}
                query={query}
                date={date}
                time={outcome.time}
                guests={outcome.guests}
                dayLabel={relativeDay(date, today)}
            />
        );
    }

    return (
        <div className="space-y-2">
            <PageHeader
                title="Réserver une table"
                description="Choisissez votre jour, votre heure et le nombre de personnes : les tables libres s’affichent tout de suite."
                actions={
                    <LinkButton href="/tables/reservations" variant="secondary" leftIcon={<CalendarCheck size={18} />}>
                        Mes réservations
                    </LinkButton>
                }
            />
            <VenueSearch key={query} cities={cities} initial={filters} today={today} maxDate={maxDate}>
                {content}
            </VenueSearch>
        </div>
    );
}
