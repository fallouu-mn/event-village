import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { apiFailure } from '@/lib/api/public-error';
import { requireActiveSession } from '@/lib/auth/session';
import { UUID_RE, invalidBody, orderNotFound, orderRefusal, readJson } from '@/lib/orders/booking';

export const dynamic = 'force-dynamic';

/**
 * POST /api/orders/[id]/issue { reason: RETARD | INCOMPLETE | ERREUR | AUTRE, details? } — lot 12d, décision du client :
 * « Signaler un problème » après le début de la préparation (en préparation, prête, en route, ou remise depuis moins de
 * 48 h) ; un seul signalement ouvert par commande, 3 au plus ; l'équipe Event Village (une fois par heure au plus) et
 * l'établissement sont prévenus ; aucun remboursement automatique (order_issue_report). Sans interrupteur, comme
 * l'annulation : une commande en cours se suit même service fermé.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await requireActiveSession(req);
        if (session.response) return session.response;
        const { id } = await params;
        if (!UUID_RE.test(id)) return orderNotFound();
        const body = await readJson(req);
        if (!body) return invalidBody();
        const { data, error } = await getServiceRoleClient().rpc('order_issue_report', {
            p: {
                order_id: id, actor_id: session.user.id,
                reason: typeof body.reason === 'string' ? body.reason : '',
                details: typeof body.details === 'string' ? body.details : null,
            },
        });
        if (error) throw new Error(`order_issue_report : ${error.message}`);
        const r = data as Record<string, unknown>;
        if (r?.ok !== true) return orderRefusal(r, 'Signalement impossible pour le moment.');
        return NextResponse.json({
            success: true,
            message: 'Signalement envoyé. L’équipe Event Village s’en occupe et vous répond dans la commande.',
            issue: r.issue,
        }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
    } catch (err: unknown) {
        return apiFailure('POST /api/orders/[id]/issue', err, { message: 'Signalement impossible pour le moment. Réessayez.', code: 'ORDER_ISSUE_FAILED' });
    }
}
