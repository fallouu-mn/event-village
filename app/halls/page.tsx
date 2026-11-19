import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { CalendarCheck, SearchX } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { LinkButton } from '@/components/ui/LinkButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { HallResults } from '@/components/halls/client/HallResults';
import { HallSearch, filtersQuery, type HallFilters } from '@/components/halls/client/HallSearch';
import { RetryError } from '@/components/halls/client/RetryError';
import { HallRefusal, searchHalls, type HallCard } from '@/lib/halls/queries';

/**
 * Lot 10b (point 1) : recherche des salles de fête. Rendu par le serveur (searchHalls de lib/halls/queries, même lecture
 * que GET /api/halls) : lieu (ville parmi celles des salles proposées, nom ou quartier), date et nombre de jours (seules
 * les salles libres sur toute la période), invités, prix maximum par jour, tri. Les filtres sont dans l'adresse :
 * partageable, retour arrière. Résultats en cartes ; « Voir plus » charge la suite dans le navigateur (offset).
 * Filtre refusé : message de la base en français ; panne : « Réessayer ». Service fermé : 404 par app/halls/layout.tsx.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: 'Salles de fête — Event Village',
    description: 'Trouvez une salle libre à votre date, voyez le prix exact et réservez en ligne.',
};

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function one(v: string | string[] | undefined): string {
    return typeof v === 'string' ? v.trim() : '';
}

/** Entier positif lu dans l'adresse, sinon chaîne vide (filtre ignoré). */
function intText(v: string, max: number): string {
    return /^\d{1,9}$/.test(v) && Number(v) >= 1 && Number(v) <= max ? String(Number(v)) : '';
}

function readFilters(sp: Record<string, string | string[] | undefined>): HallFilters {
    const date = one(sp.date);
    return {
        q: one(sp.q).slice(0, 80),
        city: one(sp.city).slice(0, 80),
        date: DAY_RE.test(date) ? date : '',
        days: intText(one(sp.days), 30),
        capacity: intText(one(sp.capacity), 100000),
        priceMax: intText(one(sp.price_max), 1000000000),
        sort: one(sp.sort) === 'price' ? 'price' : 'recent',
    };
}

type SearchOutcome =
    | { kind: 'ok'; total: number; halls: HallCard[]; cities: string[] }
    | { kind: 'refused'; message: string }
    | { kind: 'error' };

async function runSearch(f: HallFilters): Promise<SearchOutcome> {
    try {
        const r = await searchHalls({
            q: f.q || null,
            city: f.city || null,
            date: f.date || null,
            days: f.date && f.days ? Number(f.days) : null,
            capacity: f.capacity ? Number(f.capacity) : null,
            priceMax: f.priceMax ? Number(f.priceMax) : null,
            sort: f.sort,
            limit: 24,
            offset: 0,
        });
        return { kind: 'ok', total: r.total, halls: r.halls, cities: r.cities };
    } catch (err) {
        if (err instanceof HallRefusal) return { kind: 'refused', message: err.publicText };
        console.error('[Salles] recherche impossible :', err instanceof Error ? err.message : String(err));
        return { kind: 'error' };
    }
}

export default async function HallsSearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    const filters = readFilters(await searchParams);
    const query = filtersQuery(filters);
    const outcome = await runSearch(filters);
    // Jour de Dakar (UTC+0) : aucune date passée proposée
    const today = new Date().toISOString().slice(0, 10);
    const cities = outcome.kind === 'ok' ? outcome.cities : [];

    let content: ReactNode;
    if (outcome.kind === 'refused') {
        content = (
            <StatusBanner
                tone="warning"
                title="Cette recherche n’est pas possible"
                action={<LinkButton href="/halls" variant="secondary" size="sm">Effacer les filtres</LinkButton>}
            >
                {outcome.message}
            </StatusBanner>
        );
    } else if (outcome.kind === 'error') {
        content = <RetryError title="Les salles n’ont pas pu être chargées" />;
    } else if (outcome.total === 0 || outcome.halls.length === 0) {
        content = query ? (
            <EmptyState
                icon={<SearchX size={28} />}
                title="Aucune salle ne correspond"
                description="Essayez une autre date, une autre ville, moins de jours ou un prix maximum plus élevé."
                actionLabel="Effacer les filtres"
                actionHref="/halls"
            />
        ) : (
            <EmptyState
                icon={<SearchX size={28} />}
                title="Aucune salle proposée pour le moment"
                description="Les salles apparaissent ici dès qu’elles sont validées par l’équipe d’Event Village. Revenez bientôt."
            />
        );
    } else {
        content = <HallResults key={query} initial={outcome.halls} total={outcome.total} query={query} />;
    }

    return (
        <div className="space-y-2">
            <PageHeader
                title="Salles de fête"
                description="Trouvez une salle libre à votre date, voyez le prix exact avant de payer et réservez avec un acompte."
                actions={
                    <LinkButton href="/halls/reservations" variant="secondary" leftIcon={<CalendarCheck size={18} />}>
                        Mes réservations
                    </LinkButton>
                }
            />
            <HallSearch key={query} cities={cities} initial={filters} today={today}>
                {content}
            </HallSearch>
        </div>
    );
}
