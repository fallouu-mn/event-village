import { ReservationDetailView } from '@/components/halls/partner/ReservationDetailView';

/**
 * Lot 10b (point 3) : détail d'une réservation d'une salle, pour sa propriétaire. La réservation est lue dans le
 * navigateur (GET /api/partner/halls/reservations/[id] : seulement une réservation de ses salles) ; l'annulation passe
 * par POST /api/partner/halls/reservations/[id]/status quand la route la permet (`canCancel`).
 */
export default async function HallReservationPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return <ReservationDetailView reservationId={id} />;
}
