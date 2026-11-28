import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { requireActiveSession, serverIsPartner } from '@/lib/auth/session';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { guardFeature } from '@/lib/features/flags';
import { UUID_RE, invalidBody, orderRefusal, readJson } from '@/lib/orders/booking';

export const dynamic = 'force-dynamic';

/**
 * Lot 12d — pause des commandes en un geste.
 * GET /api/partner/orders/pause — pause en cours de chaque établissement de la partenaire (order_partner_pauses).
 * POST /api/partner/orders/pause { venueId, minutes: 15 | 30 | 60 | 0 } — « Plus de commandes pendant 15, 30 ou
 * 60 minutes » (0 = reprendre tout de suite) ; fin automatique ; le devis du client est refusé pendant la pause
 * (order_venue_pause, propriétaire, compte ACTIF, fiche VALIDE).
 */
export async function GET(request: NextRequest) {
    try {
        const session = await requireActiveSession(request);
        if (session.response) return session.response;
        const closed = await guardFeature('orders', 'GET /api/partner/orders/pause');
        if (closed) return closed;
        if (!serverIsPartner(session.user)) return NextResponse.json({ error: 'Réservé aux partenaires.' }, { status: 403 });
        const { data, error } = await getServiceRoleClient().rpc('order_partner_pauses', { p: { actor_id: session.user.id } });
        if (error) throw new Error(`order_partner_pauses : ${error.message}`);
        const r = data as Record<string, unknown>;
        if (r?.ok !== true) return orderRefusal(r, 'Pause momentanément indisponible.');
        return NextResponse.json({ success: true, venues: r.venues ?? [] }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error: unknown) {
        return apiFailure('GET /api/partner/orders/pause', error, { message: 'Pause momentanément indisponible.', code: 'ORDER_PAUSE_UNAVAILABLE', status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await requireActiveSession(request);
        if (session.response) return session.response;
        const closed = await guardFeature('orders', 'POST /api/partner/orders/pause');
        if (closed) return closed;
        if (!serverIsPartner(session.user)) return NextResponse.json({ error: 'Réservé aux partenaires.' }, { status: 403 });
        const body = await readJson(request);
        if (!body || typeof body.venueId !== 'string' || !UUID_RE.test(body.venueId)) return invalidBody();
        const { data, error } = await getServiceRoleClient().rpc('order_venue_pause', {
            p: { actor_id: session.user.id, venue_id: body.venueId, minutes: typeof body.minutes === 'number' || typeof body.minutes === 'string' ? body.minutes : null },
        });
        if (error) throw new Error(`order_venue_pause : ${error.message}`);
        const r = data as Record<string, unknown>;
        if (r?.ok !== true) return orderRefusal(r, 'Pause impossible pour le moment.');
        return NextResponse.json({ success: true, venueId: r.venue_id, pausedUntil: r.paused_until ?? null });
    } catch (error: unknown) {
        return apiFailure('POST /api/partner/orders/pause', error, { message: 'Pause impossible pour le moment. Réessayez.', code: 'ORDER_PAUSE_FAILED', status: 500 });
    }
}
