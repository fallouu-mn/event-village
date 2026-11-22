import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { requireActiveSession, serverIsPartner } from '@/lib/auth/session';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { guardFeature } from '@/lib/features/flags';
import { UUID_RE, invalidBody, orderRefusal, readJson } from '@/lib/orders/booking';

export const dynamic = 'force-dynamic';

/**
 * POST /api/partner/products/[id]/portions { portions } — portions du plat du jour pour aujourd'hui (heure de Dakar), par
 * order_daily_portions_set (fonction en base : produit de la partenaire de la session, plat du jour, jamais sous ce qui
 * est déjà vendu, journal). Le plat s'arrête seul à la fin du jour (il ne se commande que pour aujourd'hui).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const activeSession = await requireActiveSession(request);
        if (activeSession.response) return activeSession.response;
        const closed = await guardFeature('orders', '/api/partner/products/[id]/portions');
        if (closed) return closed;
        const user = activeSession.user;
        if (!user || !serverIsPartner(user)) {
            return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 403 });
        }
        const { id } = await params;
        if (!UUID_RE.test(id)) {
            return NextResponse.json({ success: false, error: 'Ce produit n’existe pas ou n’est pas le vôtre.', code: 'PRODUCT_NOT_FOUND' }, { status: 404 });
        }
        const body = await readJson(request);
        if (!body) return invalidBody();
        const { data, error } = await getServiceRoleClient().rpc('order_daily_portions_set', {
            p: { actor_id: user.id, product_id: id, portions: typeof body.portions === 'number' || typeof body.portions === 'string' ? body.portions : null },
        });
        if (error) throw new Error(`order_daily_portions_set : ${error.message}`);
        const r = data as Record<string, unknown>;
        if (r?.ok !== true) return orderRefusal(r, 'Portions non enregistrées.');
        return NextResponse.json({ success: true, portions: { day: r.day, portions: Number(r.portions), sold: Number(r.sold) } });
    } catch (error: unknown) {
        return apiFailure('POST /api/partner/products/[id]/portions', error, { message: 'Portions non enregistrées. Réessayez.', code: 'PORTIONS_SAVE_FAILED', status: 500 });
    }
}
