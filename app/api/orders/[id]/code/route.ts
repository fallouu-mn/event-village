import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { apiFailure } from '@/lib/api/public-error';
import { requireActiveSession } from '@/lib/auth/session';
import { UUID_RE, orderNotFound, orderRefusal } from '@/lib/orders/booking';

export const dynamic = 'force-dynamic';

/**
 * POST /api/orders/[id]/code — le client demande un nouveau code de remise (perdu, ou trop d'essais) : order_code_resend.
 * Le code part par SMS, push et email (jamais dans la cloche, gardée en base) ; l'ancien ne vaut plus ; nombre de
 * demandes borné (orders.code_resend_max). Le code n'est jamais rendu dans la réponse.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await requireActiveSession(req);
        if (session.response) return session.response;
        const { id } = await params;
        if (!UUID_RE.test(id)) return orderNotFound();
        const { data, error } = await getServiceRoleClient().rpc('order_code_resend', { p: { order_id: id, client_id: session.user.id } });
        if (error) throw new Error(`order_code_resend : ${error.message}`);
        const r = data as Record<string, unknown>;
        if (r?.ok !== true) return orderRefusal(r, 'Nouveau code impossible pour le moment.');
        return NextResponse.json({
            success: true,
            message: 'Un nouveau code vous est envoyé par SMS. L’ancien ne marche plus.',
            resendsLeft: Number(r.resends_left),
        });
    } catch (err: unknown) {
        return apiFailure('POST /api/orders/[id]/code', err, { message: 'Nouveau code impossible pour le moment. Réessayez.', code: 'ORDER_CODE_FAILED' });
    }
}
