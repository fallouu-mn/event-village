import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { requireActiveSession } from '@/lib/auth/session';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { guardFeature } from '@/lib/features/flags';
import { UUID_RE, invalidBody, orderRefusal, readJson } from '@/lib/orders/booking';

export const dynamic = 'force-dynamic';

const invitationNotFound = (): NextResponse =>
    NextResponse.json({ success: false, error: 'Invitation introuvable.', code: 'INVITATION_NOT_FOUND' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });

/**
 * GET /api/courier/invitations/[id] — lot 12d : une invitation adressée au compte de la session (établissement, état,
 * heure ; order_courier_invitation_view) ; toute autre : 404.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const activeSession = await requireActiveSession(request);
        if (activeSession.response) return activeSession.response;
        const closed = await guardFeature('orders', 'GET /api/courier/invitations/[id]');
        if (closed) return closed;
        const { id } = await params;
        if (!UUID_RE.test(id)) return invitationNotFound();
        const { data, error } = await getServiceRoleClient().rpc('order_courier_invitation_view', { p: { actor_id: activeSession.user.id, invitation_id: id } });
        if (error) throw new Error(`order_courier_invitation_view : ${error.message}`);
        if (!data) return invitationNotFound();
        return NextResponse.json({ success: true, invitation: data }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error: unknown) {
        return apiFailure('GET /api/courier/invitations/[id]', error, { message: 'Invitation momentanément indisponible.', code: 'COURIER_INVITATION_UNAVAILABLE', status: 500 });
    }
}

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
