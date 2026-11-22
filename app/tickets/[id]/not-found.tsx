import { UnavailableItem } from '@/components/ui/UnavailableItem';

/** Finition 5 (point 2) : billet inconnu, d'un autre compte, transféré ou supprimé : même page, aucun indice. */
export default function TicketNotAvailable() {
    return <UnavailableItem actionLabel="Voir mes billets" actionHref="/tickets" />;
}
