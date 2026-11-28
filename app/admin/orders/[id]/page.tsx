import { AdminOrderDetailView } from '@/components/orders/admin/AdminOrderDetailView';
import { UnavailableItem } from '@/components/ui/UnavailableItem';

/**
 * Lot 12d : fiche d'une commande pour l'administration (lien de l'avis ADMIN_ORDER_ABSENT : /admin/orders/<id>).
 * Identifiant invalide : « Cet élément n'est plus disponible », comme une commande absente.
 */
export const dynamic = 'force-dynamic';

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
        return <UnavailableItem actionLabel="Retour aux commandes" actionHref="/admin/orders" />;
    }
    return <AdminOrderDetailView key={id} orderId={id} />;
}
