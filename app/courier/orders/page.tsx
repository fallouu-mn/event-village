import type { Metadata } from 'next';
import { CourierDay } from '@/components/orders/courier/CourierDay';

/**
 * Lot 12d — livraisons du jour du livreur (invitations en attente, livraisons en cours groupées par état, terminées
 * aujourd'hui). Lu dans le navigateur par GET /api/courier/orders. Garde du service : app/courier/layout.tsx.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Mes livraisons — Event Village', robots: { index: false } };

export default function CourierOrdersPage() {
    return <CourierDay />;
}
