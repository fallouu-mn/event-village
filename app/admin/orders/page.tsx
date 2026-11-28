import { AdminOrdersListView } from '@/components/orders/admin/AdminOrdersListView';
import { isAdminOrderGroup } from '@/components/orders/admin/order-admin-labels';

/**
 * Lot 12d : commandes de l'administration (droit payments.read ou refunds.manage ; la route et la base le vérifient).
 * Page à part, hors de app/admin/services/page.tsx. `?groupe=A_DECIDER` (lien des avis), `?q=` et `?page=` respectés.
 */
export const dynamic = 'force-dynamic';

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    const sp = await searchParams;
    const group = isAdminOrderGroup(sp.groupe) ? sp.groupe : 'TOUTES';
    const q = typeof sp.q === 'string' ? sp.q.slice(0, 80) : '';
    const page = typeof sp.page === 'string' && /^\d{1,4}$/.test(sp.page) ? Math.max(1, Number(sp.page)) : 1;
    return <AdminOrdersListView initialGroup={group} initialQuery={q} initialPage={page} />;
}
