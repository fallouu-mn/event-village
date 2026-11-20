import { Building2 } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';

/** Lot 10b (point 2) : salle absente, retirée de la vente ou non validée (404, sans autre indice). */
export default function HallNotFound() {
    return (
        <EmptyState
            icon={<Building2 size={28} />}
            title="Salle introuvable"
            description="Cette salle n’existe pas ou n’est plus proposée. D’autres salles sont peut-être libres à votre date."
            actionLabel="Voir les salles"
            actionHref="/halls"
        />
    );
}
