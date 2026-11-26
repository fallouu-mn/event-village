import type { Metadata } from 'next';
import { UnavailableItem } from '@/components/ui/UnavailableItem';
import { OrderTracking } from '@/components/orders/client/tracking/OrderTracking';

/**
 * Lot 12b — suivi d'une commande par son client. Les liens des avis ORDER_* (lib/notifications/catalog.ts) mènent ici.
 * Identifiant illisible : « Cet élément n'est plus disponible », comme une commande absente ou d'un autre compte (même
 * texte, aucun indice sur l'existence de la commande). Sous la garde des interrupteurs de app/orders/layout.tsx.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Suivi de ma commande — Event Village', robots: { index: false } };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function OrderTrackingPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    if (!UUID_RE.test(id)) return <UnavailableItem actionLabel="Mes commandes" actionHref="/orders" />;
    return <OrderTracking orderId={id} />;
}
