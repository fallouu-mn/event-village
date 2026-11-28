import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { UUID_RE, orderNotFound, orderRefusal, orderResponse } from '@/lib/orders/booking';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/orders/[id] — lot 12d : fiche d'une commande pour l'administration (order_admin_view) : étapes avec
 * leurs notes, paiements, remboursements, signalements, absence, montant remboursable servi par la base, actions
 * permises (refunds.manage) ; adresse, téléphone et nom entier du client seulement avec users.read.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await verifyAdminAuth(req);
    if (!auth.authorized) return auth.errorResponse!;
    try {
        const { id } = await params;
        if (!UUID_RE.test(id)) return orderNotFound();
        const { data, error } = await getServiceRoleClient().rpc('order_admin_view', { p: { actor_id: auth.user!.id, order_id: id } });
        if (error) throw new Error(`order_admin_view : ${error.message}`);
        const r = data as Record<string, unknown>;
        if (r?.ok !== true) return orderRefusal(r, 'Commande momentanément indisponible.');
        return NextResponse.json({ success: true, order: orderResponse(r.order as Record<string, unknown>) }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (err: unknown) {
        return apiFailure('GET /api/admin/orders/[id]', err, { message: 'Commande momentanément indisponible.', code: 'ADMIN_ORDER_UNAVAILABLE', status: 500 });
    }
}
