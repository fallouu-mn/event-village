import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { GET as listMyTableReservations } from '@/app/api/tables/reservations/route';
import { PageHeader } from '@/components/ui/PageHeader';
import { RetryError } from '@/components/halls/client/RetryError';
import { ReservationsList, type ReservationTab } from '@/components/tables/client/ReservationsList';
import type { TableReservationView } from '@/lib/tables/queries';
import { readOnServer } from './read-on-server';

/**
 * Lot 11b (écrans du client) : « Mes réservations » de tables. Liste lue par le serveur (GET /api/tables/reservations
 * appelée avec la session de la requête) ; sans session : /login?redirect=/tables/reservations. Hors du groupe
 * (catalogue) : ouverte même service fermé (le lien d'une notification ne mène jamais à une page introuvable).
 * Réponse personnelle : rendue à chaque requête, jamais mise en cache.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Mes réservations de table — Event Village', robots: { index: false } };

export default async function MyTableReservationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    const sp = await searchParams;
    const tab: ReservationTab = sp.tab === 'passees' ? 'passees' : 'a-venir';
    const read = await readOnServer<TableReservationView[]>('/api/tables/reservations', listMyTableReservations, (b) =>
        Array.isArray(b.reservations) ? (b.reservations as TableReservationView[]) : null,
    );
    if (read.kind === 'login') redirect(`/login?redirect=${encodeURIComponent(tab === 'passees' ? '/tables/reservations?tab=passees' : '/tables/reservations')}`);
    if (read.kind !== 'ok') {
        return (
            <div className="space-y-2">
                <PageHeader title="Mes réservations" back={{ href: '/tables', label: 'Réserver une table' }} />
                <RetryError title="Vos réservations n’ont pas pu être chargées" description={read.kind === 'error' ? read.message : undefined} />
            </div>
        );
    }
    return <ReservationsList reservations={read.data} initialTab={tab} />;
}
