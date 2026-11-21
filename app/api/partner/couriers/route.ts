import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { requireActiveSession, serverIsPartner } from '@/lib/auth/session';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { guardFeature } from '@/lib/features/flags';
import { invalidBody, orderRefusal, readJson } from '@/lib/orders/booking';

export const dynamic = 'force-dynamic';

const STATUS_LABELS: Record<string, string> = { PENDING: 'Invitation envoyée', ACTIVE: 'Livre pour vous', DECLINED: 'Invitation refusée', REMOVED: 'Retiré de l’équipe' };

/**
 * GET /api/partner/couriers — livreurs de la partenaire de la session (membres de son équipe) : prénom, état. Jamais le
 * numéro ni l'adresse email (la partenaire a saisi le numéro elle-même à l'invitation).
 */
export async function GET(request: NextRequest) {
    try {
        const activeSession = await requireActiveSession(request);
        if (activeSession.response) return activeSession.response;
        const closed = await guardFeature('orders', '/api/partner/couriers');
        if (closed) return closed;
        const user = activeSession.user;
        if (!user || !serverIsPartner(user)) {
            return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 403 });
        }
        const supabase = getServiceRoleClient();
        const { data: partner, error: pErr } = await supabase.from('partners').select('id').eq('user_id', user.id).order('created_at').limit(1).maybeSingle();
        if (pErr) throw new Error(`fiche partenaire : ${pErr.message}`);
        if (!partner) return NextResponse.json({ success: true, couriers: [] });
        const { data, error } = await supabase.from('partner_couriers')
            .select('id, user_id, status, invited_at, responded_at, removed_at, users:user_id (first_name)')
            .eq('partner_id', partner.id).order('invited_at', { ascending: false }).limit(100);
        if (error) throw new Error(`livreurs : ${error.message}`);
        const couriers = (data ?? []).map((c) => {
            const u = (Array.isArray(c.users) ? c.users[0] : c.users) as { first_name?: string } | null;
            return {
                id: c.id, userId: c.user_id, firstName: u?.first_name ?? null, status: c.status,
                statusLabel: STATUS_LABELS[String(c.status)] ?? 'État inconnu', invitedAt: c.invited_at,
            };
        });
        return NextResponse.json({ success: true, couriers }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error: unknown) {
        return apiFailure('GET /api/partner/couriers', error, { message: 'Livreurs momentanément indisponibles.', code: 'COURIERS_UNAVAILABLE', status: 500 });
    }
}

/**
 * POST /api/partner/couriers { phone } — invite un livreur (compte Event Village actif existant) par order_courier_invite ;
 * il devient livreur seulement après son accord (POST /api/courier/invitations/[id]). Fiche SUSPENDU : refus.
 */
export async function POST(request: NextRequest) {
    try {
        const activeSession = await requireActiveSession(request);
        if (activeSession.response) return activeSession.response;
        const closed = await guardFeature('orders', 'POST /api/partner/couriers');
        if (closed) return closed;
        const user = activeSession.user;
        if (!user || !serverIsPartner(user)) {
            return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 403 });
        }
        const body = await readJson(request);
        if (!body) return invalidBody();
        const { data, error } = await getServiceRoleClient().rpc('order_courier_invite', {
            p: { actor_id: user.id, phone: typeof body.phone === 'string' ? body.phone : null },
        });
        if (error) throw new Error(`order_courier_invite : ${error.message}`);
        const r = data as Record<string, unknown>;
        if (r?.ok !== true) return orderRefusal(r, 'Invitation impossible pour le moment.');
        return NextResponse.json({ success: true, invitation: { id: r.invitation_id, firstName: r.first_name, statusLabel: STATUS_LABELS.PENDING } }, { status: 201 });
    } catch (error: unknown) {
        return apiFailure('POST /api/partner/couriers', error, { message: 'Invitation impossible pour le moment. Réessayez.', code: 'COURIER_INVITE_FAILED', status: 500 });
    }
}
