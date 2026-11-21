import { Store } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';

/** Lot 11b (écrans du client) : établissement absent, retiré ou non validé (404, sans autre indice). */
export default function VenueNotFound() {
    return (
        <EmptyState
            icon={<Store size={28} />}
            title="Établissement introuvable"
            description="Cet établissement n’existe pas ou n’est plus proposé. D’autres tables sont peut-être libres à votre heure."
            actionLabel="Voir les établissements"
            actionHref="/tables"
        />
    );
}
