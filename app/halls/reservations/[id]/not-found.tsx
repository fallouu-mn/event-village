import { CalendarX } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';

/** Lot 10b (point 4) : réservation inconnue ou d'un autre compte (404, sans autre indice). */
export default function ReservationNotFound() {
    return (
        <EmptyState
            icon={<CalendarX size={28} />}
            title="Réservation introuvable"
            description="Cette réservation n’existe pas ou n’est pas liée à votre compte."
            actionLabel="Voir mes réservations"
            actionHref="/halls/reservations"
        />
    );
}
