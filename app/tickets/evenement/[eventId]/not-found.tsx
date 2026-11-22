import { UnavailableItem } from '@/components/ui/UnavailableItem';

/** Finition 5 (point 2) : aucun billet du compte pour cet événement (ou identifiant deviné) : même page, aucun indice. */
export default function EventTicketsNotAvailable() {
    return <UnavailableItem actionLabel="Voir mes billets" actionHref="/tickets" />;
}
