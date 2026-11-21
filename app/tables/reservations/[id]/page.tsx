import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { GET as readMyTableReservation } from '@/app/api/tables/reservations/[id]/route';
import { PageHeader } from '@/components/ui/PageHeader';
import { RetryError } from '@/components/halls/client/RetryError';
import { ReservationDetail } from '@/components/tables/client/ReservationDetail';
import type { ClientTableReservationDetail } from '@/lib/tables/queries';
import { readOnServer } from '../read-on-server';

/**
 * Lot 11b (écrans du client) : détail d'une réservation de table du compte. Lue par le serveur
 * (GET /api/tables/reservations/[id] avec la session de la requête) ; sans session : connexion puis retour ici (rappel
 * compris) ; réservation d'un autre compte ou inconnue : 404 « Réservation introuvable » (sans indice). `?rappel=1`
 * (lien du rappel) met en avant « Votre table vous attend » avec « J'arrive » et « Annuler ». Hors du groupe
 * (catalogue) : ouverte même service fermé.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Ma réservation de table — Event Village', robots: { index: false } };

export default async function MyTableReservationPage({ params, searchParams }: {
    params: Promise<{ id: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const { id } = await params;
    const sp = await searchParams;
    const reminder = sp.rappel === '1';
    const path = `/api/tables/reservations/${encodeURIComponent(id)}`;
    const read = await readOnServer<ClientTableReservationDetail>(
        path,
        (req) => readMyTableReservation(req, { params: Promise.resolve({ id }) }),
        (b) => (b.reservation && typeof b.reservation === 'object' ? (b.reservation as ClientTableReservationDetail) : null),
    );
    if (read.kind === 'login') redirect(`/login?redirect=${encodeURIComponent(`/tables/reservations/${id}${reminder ? '?rappel=1' : ''}`)}`);
    if (read.kind === 'not-found') notFound();
    if (read.kind !== 'ok') {
        return (
            <div className="space-y-2">
                <PageHeader title="Ma réservation" back={{ href: '/tables/reservations', label: 'Mes réservations' }} />
                <RetryError title="La réservation n’a pas pu être chargée" description={read.message} />
            </div>
        );
    }
    return <ReservationDetail reservation={read.data} reminder={reminder} />;
}
