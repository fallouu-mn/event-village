import type { Metadata } from 'next';
import { WithdrawalDetail } from '@/components/finance/WithdrawalDetail';

/**
 * Finition 5 (point 2) — un retrait du compte (Mes finances), page d'arrivée des avis WITHDRAWAL_* (identifiant de l'envoi,
 * cashout_id). Session et propriété exigées ; sinon même page « Cet élément n'est plus disponible » (components/finance/WithdrawalDetail.tsx).
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Mon retrait — Event Village' };

export default async function WithdrawalPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return <WithdrawalDetail cashoutId={id} space="pro" />;
}
