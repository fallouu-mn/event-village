import { OrderDetail } from '@/components/orders/partner/orders/OrderDetail';

/**
 * Lot 12c : fiche d'une commande pour la partenaire (lien des avis ORDER_NEW, ORDER_CANCELLED_PRO, ORDER_HANDED_OVER_PRO).
 * Lue dans le navigateur par GET /api/partner/orders/[id] (seulement une commande transmise d'un de ses établissements,
 * sinon « Cet élément n'est plus disponible »).
 */
export const dynamic = 'force-dynamic';

export default async function PartnerOrderPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return <OrderDetail key={id} orderId={id} />;
}
