import type { Metadata } from 'next';
import { UnavailableItem } from '@/components/ui/UnavailableItem';
import { CourierDelivery } from '@/components/orders/courier/CourierDelivery';
import { COURIER_PATHS } from '@/components/orders/courier/courier-view';

/**
 * Lot 12d — une livraison vue par son livreur. Les liens des avis du livreur (ORDER_COURIER_ASSIGNED, ORDER_READY_COURIER,
 * ORDER_COURIER_RETURN) mènent ici. Identifiant illisible, livraison absente, d'un autre livreur ou d'une autre
 * partenaire : « Cet élément n'est plus disponible » (même texte, aucun indice). Garde du service : app/courier/layout.tsx.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Livraison — Event Village', robots: { index: false } };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function CourierDeliveryPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    if (!UUID_RE.test(id)) return <UnavailableItem actionLabel="Mes livraisons" actionHref={COURIER_PATHS.home} />;
    return <CourierDelivery orderId={id} />;
}
