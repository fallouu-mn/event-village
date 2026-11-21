import { TableReservationDetailView } from '@/components/tables/partner/ReservationDetailView';

/**
 * Lot 11b : détail d'une réservation de table pour l'établissement, page des liens des avis de l'établissement. La
 * réservation est lue dans le navigateur (GET /api/partner/tables/reservations/[id] : seulement une réservation d'un de
 * ses établissements, sinon 404) ; les actions passent par PATCH sur la même route. Ouverte même service fermé.
 */
export default async function TableReservationPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return <TableReservationDetailView reservationId={id} />;
}
