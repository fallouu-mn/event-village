import { VenuesListView } from '@/components/tables/partner/VenuesListView';

/**
 * Lot 11b : « Mes établissements » (restaurants, bars, espaces) de la partenaire. La liste est lue dans le navigateur
 * (GET /api/partner/venues, session et rôle vérifiés par la route) ; l'espace partenaire garde déjà la session
 * (app/partner/layout.tsx). Remplace l'ancienne page aux données inventées. Ouverte même service fermé (décision du
 * 20/11) : seule l'édition (app/partner/tables/edition/*) est gardée par l'interrupteur.
 */
export default function PartnerTablesPage() {
    return <VenuesListView />;
}
