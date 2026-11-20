import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { GET as listMyHallReservations } from '@/app/api/halls/reservations/route';
import { PageHeader } from '@/components/ui/PageHeader';
import { RetryError } from '@/components/halls/client/RetryError';
import { ReservationsView, type ReservationTab } from '@/components/halls/client/ReservationsView';
import type { ReservationView } from '@/lib/halls/queries';
import { readOnServer } from './read-on-server';

/**
 * Lot 10b (point 3) : « Mes réservations » de salles. Liste lue par le serveur (GET /api/halls/reservations appelée avec
 * la session de la requête) ; sans session : /login?redirect=/halls/reservations (/halls/ est public dans le
 * middleware, la page vérifie elle-même). Réponse personnelle : rendue à chaque requête, jamais mise en cache.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Mes réservations de salle — Event Village' };

export default async function MyHallReservationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    const sp = await searchParams;
    const tab: ReservationTab = sp.tab === 'passees' ? 'passees' : 'a-venir';
    const read = await readOnServer<ReservationView[]>('/api/halls/reservations', listMyHallReservations, (b) =>
        Array.isArray(b.reservations) ? (b.reservations as ReservationView[]) : null,
    );
    if (read.kind === 'login') redirect(`/login?redirect=${encodeURIComponent(tab === 'passees' ? '/halls/reservations?tab=passees' : '/halls/reservations')}`);
    if (read.kind !== 'ok') {
        return (
            <div className="space-y-2">
                <PageHeader title="Mes réservations" back={{ href: '/halls', label: 'Salles de fête' }} />
                <RetryError title="Vos réservations n’ont pas pu être chargées" description={read.kind === 'error' ? read.message : undefined} />
            </div>
        );
    }
    return <ReservationsView reservations={read.data} initialTab={tab} />;
}
