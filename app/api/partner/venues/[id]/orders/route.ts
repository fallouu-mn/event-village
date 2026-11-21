import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { requireActiveSession, serverIsPartner } from '@/lib/auth/session';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { guardFeature } from '@/lib/features/flags';
import { UUID_RE, invalidBody, orderRefusal, readJson } from '@/lib/orders/booking';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/partner/venues/[id]/orders { ordersOpen?, modes?, depositAllowed?, depositPercent?, payOnHandover?, prepMinutes? }
 * Lot 12a : réglages de vente d'un établissement de la partenaire, par order_venue_settings_set (fonction en base :
 * établissement de la session, fiche VALIDE, bornes, journal). Fiche SUSPENDU : refus (lecture seule).
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const activeSession = await requireActiveSession(request);
        if (activeSession.response) return activeSession.response;
        const closed = await guardFeature('orders', '/api/partner/venues/[id]/orders');
        if (closed) return closed;
        const user = activeSession.user;
        if (!user || !serverIsPartner(user)) {
            return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 403 });
        }
        const { id } = await params;
        if (!UUID_RE.test(id)) {
            return NextResponse.json({ success: false, error: 'Cet établissement n’existe pas ou n’est pas le vôtre.', code: 'VENUE_NOT_FOUND' }, { status: 404 });
        }
        const body = await readJson(request);
        if (!body) return invalidBody();
        const p: Record<string, unknown> = { actor_id: user.id, venue_id: id };
        if (typeof body.ordersOpen === 'boolean') p.orders_open = body.ordersOpen;
        if (Array.isArray(body.modes)) p.modes = body.modes.filter((m) => typeof m === 'string').slice(0, 3);
        if (typeof body.depositAllowed === 'boolean') p.deposit_allowed = body.depositAllowed;
        if ('depositPercent' in body) p.deposit_percent = body.depositPercent ?? null;
        if (typeof body.payOnHandover === 'boolean') p.pay_on_handover = body.payOnHandover;
        if ('prepMinutes' in body) p.prep_minutes = body.prepMinutes ?? null;
        const { data, error } = await getServiceRoleClient().rpc('order_venue_settings_set', { p });
        if (error) throw new Error(`order_venue_settings_set : ${error.message}`);
        const r = data as Record<string, unknown>;
        if (r?.ok !== true) return orderRefusal(r, 'Réglages non enregistrés.');
        return NextResponse.json({
            success: true,
            settings: {
                ordersOpen: r.orders_open, modes: r.modes, depositAllowed: r.deposit_allowed, depositPercent: r.deposit_percent ?? null,
                payOnHandover: r.pay_on_handover, prepMinutes: r.prep_minutes ?? null,
            },
        });
    } catch (error: unknown) {
        return apiFailure('PATCH /api/partner/venues/[id]/orders', error, { message: 'Réglages non enregistrés. Réessayez.', code: 'VENUE_ORDERS_SAVE_FAILED', status: 500 });
    }
}
