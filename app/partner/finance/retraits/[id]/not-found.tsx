import { UnavailableItem } from '@/components/ui/UnavailableItem';

/** Finition 5 (point 2) : retrait inconnu ou d'un autre compte : même page, aucun indice. */
export default function WithdrawalNotAvailable() {
    return <UnavailableItem actionLabel="Voir mes finances" actionHref="/partner/finance" />;
}
