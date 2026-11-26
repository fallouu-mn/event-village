import { UtensilsCrossed } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';

/** Lot 12b : carte introuvable (établissement absent, non listé ou fermé à la commande ; 404 sans autre indice). */
export default function MenuNotFound() {
    return (
        <EmptyState
            icon={<UtensilsCrossed size={28} />}
            title="Carte introuvable"
            description="Cet établissement n’existe pas ou ne prend pas de commande en ce moment."
            actionLabel="Voir les établissements"
            actionHref="/tables"
        />
    );
}
