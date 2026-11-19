import { EarningsView } from '@/components/halls/partner/EarningsView';

/**
 * Lot 10b (point 3) : recettes des salles de la propriétaire (GET /api/partner/halls/earnings), lues dans le
 * navigateur. Le retrait se fait depuis /partner/finance.
 */
export default function HallEarningsPage() {
    return <EarningsView />;
}
