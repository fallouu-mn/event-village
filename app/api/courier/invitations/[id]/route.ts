import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { requireActiveSession } from '@/lib/auth/session';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { guardFeature } from '@/lib/features/flags';
import { UUID_RE, invalidBody, orderRefusal, readJson } from '@/lib/orders/booking';

export const dynamic = 'force-dynamic';

/**
 * POST /api/courier/invitations/[id] { accept: true | false } — le compte de la session accepte ou refuse de livrer pour
 * une partenaire (order_courier_respond) ; seule l'invitation qui lui est adressée.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const activeSession = await requireActiveSession(request);
        if (activeSession.response) return activeSession.response;
        const closed = await guardFeature('orders', '/api/courier/invitations/[id]');
        if (closed) return closed;
        const { id } = await params;
        if (!UUID_RE.test(id)) {
            return NextResponse.json({ success: false, error: 'Invitation introuvable.', code: 'INVITATION_NOT_FOUND' }, { status: 404 });
        }
        const body = await readJson(request);
        if (!body || typeof body.accept !== 'boolean') return invalidBody();
        const { data, error } = await getServiceRoleClient().rpc('order_courier_respond', {
            p: { actor_id: activeSession.user.id, invitation_id: id, accept: body.accept },
        });
        if (error) throw new Error(`order_courier_respond : ${error.message}`);
        const r = data as Record<string, unknown>;
        if (r?.ok !== true) return orderRefusal(r, 'Réponse impossible pour le moment.');
        return NextResponse.json({
            success: true,
            message: r.status === 'ACTIVE' ? 'Vous livrez maintenant pour cet établissement.' : 'Invitation refusée.',
        });
    } catch (error: unknown) {
        return apiFailure('POST /api/courier/invitations/[id]', error, { message: 'Réponse impossible pour le moment. Réessayez.', code: 'COURIER_RESPOND_FAILED', status: 500 });
    }
}
