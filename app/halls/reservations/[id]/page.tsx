import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { GET as readMyHallReservation } from '@/app/api/halls/reservations/[id]/route';
import { PageHeader } from '@/components/ui/PageHeader';
import { RetryError } from '@/components/halls/client/RetryError';
import { ReservationDetailView } from '@/components/halls/client/ReservationDetailView';
import type { ClientReservationDetail } from '@/lib/halls/queries';
import { readOnServer } from '../read-on-server';

/**
 * Lot 10b (point 4) : détail d'une réservation de salle du compte. Lue par le serveur (GET /api/halls/reservations/[id]
 * avec la session de la requête) ; sans session : connexion puis retour ici ; réservation d'un autre compte ou
 * inconnue : 404 « Réservation introuvable » (sans indice). Paiement et annulation : vue cliente, seulement si la route
 * les permet (`canPay`, `canCancel`).
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Ma réservation de salle — Event Village' };

export default async function MyHallReservationPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const path = `/api/halls/reservations/${encodeURIComponent(id)}`;
    const read = await readOnServer<ClientReservationDetail>(
        path,
        (req) => readMyHallReservation(req, { params: Promise.resolve({ id }) }),
        (b) => (b.reservation && typeof b.reservation === 'object' ? (b.reservation as ClientReservationDetail) : null),
    );
    if (read.kind === 'login') redirect(`/login?redirect=${encodeURIComponent(`/halls/reservations/${id}`)}`);
    if (read.kind === 'not-found') notFound();
    if (read.kind !== 'ok') {
        return (
            <div className="space-y-2">
                <PageHeader title="Ma réservation" back={{ href: '/halls/reservations', label: 'Mes réservations' }} />
                <RetryError title="La réservation n’a pas pu être chargée" description={read.message} />
            </div>
        );
    }
    return <ReservationDetailView reservation={read.data} />;
}
