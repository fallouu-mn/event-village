import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { orderRefusal, orderStateLabel } from '@/lib/orders/booking';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/orders?groupe=&etat=&q=&page= — lot 12d : liste des commandes pour l'administration, filtrée et paginée
 * par la base (order_admin_list) : droit payments.read ou refunds.manage (ou super-administrateur), vérifié en base ;
 * nom du client entier seulement avec users.read (prénom et initiale sinon). Pas d'interrupteur : l'équipe garde la vue
 * des commandes passées service fermé.
 */
export async function GET(req: NextRequest) {
    const auth = await verifyAdminAuth(req);
    if (!auth.authorized) return auth.errorResponse!;
    try {
        const sp = req.nextUrl.searchParams;
        const { data, error } = await getServiceRoleClient().rpc('order_admin_list', {
            p: {
                actor_id: auth.user!.id,
                group: sp.get('groupe') ?? 'TOUTES',
                state: sp.get('etat') ?? null,
                q: sp.get('q') ?? null,
                page: sp.get('page') ?? '1',
                page_size: sp.get('par_page') ?? '20',
            },
        });
        if (error) throw new Error(`order_admin_list : ${error.message}`);
        const r = data as Record<string, unknown>;
        if (r?.ok !== true) return orderRefusal(r, 'Liste momentanément indisponible.');
        const items = Array.isArray(r.items) ? (r.items as Array<Record<string, unknown>>) : [];
        return NextResponse.json({
            success: true, total: r.total, page: r.page, pageSize: r.page_size, pages: r.pages,
            orders: items.map((o) => ({ ...o, stateLabel: orderStateLabel(o.state, o.mode) })),
        }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (err: unknown) {
        return apiFailure('GET /api/admin/orders', err, { message: 'Liste momentanément indisponible.', code: 'ADMIN_ORDERS_UNAVAILABLE', status: 500 });
    }
}
