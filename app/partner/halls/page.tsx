import { HallsListView } from '@/components/halls/partner/HallsListView';

/**
 * Lot 10b (point 3) : « Mes salles » de la propriétaire. La liste est lue dans le navigateur (GET /api/partner/halls,
 * session et rôle vérifiés par la route) ; l'espace partenaire garde déjà la session (app/partner/layout.tsx).
 */
export default function PartnerHallsPage() {
    return <HallsListView />;
}
