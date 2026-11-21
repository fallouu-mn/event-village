import { TableEarningsView } from '@/components/tables/partner/EarningsView';

/**
 * Lot 11b : recettes des établissements de la partenaire (GET /api/partner/tables/earnings), lues dans le navigateur.
 * Le paiement sur place n'y figure pas ; le retrait se fait depuis /partner/finance. Ouverte même service fermé.
 */
export default function TableEarningsPage() {
    return <TableEarningsView />;
}
