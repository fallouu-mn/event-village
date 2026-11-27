import { OrdersBoard } from '@/components/orders/partner/orders/OrdersBoard';

/**
 * Lot 12c : écran des commandes de la partenaire (colonnes par étape sur tablette et ordinateur, onglets sur téléphone,
 * son à chaque nouvelle commande). Lu dans le navigateur par la route serveur GET /api/partner/orders, relue toutes les
 * 5 secondes tant que la page est visible ; plus de temps réel par la base (l'ancien écran lisait la REST, fermée à la
 * partenaire depuis le lot 12a). Garde du service : layout (features.orders_enabled).
 */
export default function PartnerOrdersPage() {
    return <OrdersBoard />;
}
