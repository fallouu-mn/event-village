import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { UUID_RE, invalidBody, orderRefusal, readJson } from '@/lib/orders/booking';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/orders/issues/[id] { note } — lot 12d : l'équipe traite un signalement (droit refunds.manage, vérifié
 * par la route puis en base) ; la réponse (5 à 300 caractères) est montrée au client dans sa commande, qui est prévenu
 * (cloche, notification du téléphone). Aucun remboursement automatique : « Annuler et rembourser » reste une action à part.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await verifyAdminAuth(req, { requiredPermission: 'refunds.manage' });
    if (!auth.authorized) return auth.errorResponse!;
    try {
        const { id } = await params;
        if (!UUID_RE.test(id)) {
            return NextResponse.json({ success: false, error: 'Signalement introuvable.', code: 'ISSUE_NOT_FOUND' }, { status: 404 });
        }
        const body = await readJson(req);
        if (!body) return invalidBody();
        const { data, error } = await getServiceRoleClient().rpc('order_issue_close', {
            p: { actor_id: auth.user!.id, issue_id: id, note: typeof body.note === 'string' ? body.note : '' },
        });
        if (error) throw new Error(`order_issue_close : ${error.message}`);
        const r = data as Record<string, unknown>;
        if (r?.ok !== true) return orderRefusal(r, 'Signalement non traité.');
        return NextResponse.json({ success: true, message: 'Signalement traité : le client voit votre réponse.', issueId: r.issue_id, orderId: r.order_id });
    } catch (err: unknown) {
        return apiFailure('POST /api/admin/orders/issues/[id]', err, { message: 'Signalement non traité. Réessayez.', code: 'ORDER_ISSUE_CLOSE_FAILED' });
    }
}
