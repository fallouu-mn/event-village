import { NextRequest, NextResponse } from 'next/server';
import { requireEventAccess } from '@/lib/auth/event-access';
import { requireActiveSession, serverIsPartner } from '@/lib/auth/session';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/partner/events/[id]/promotion — lot 5 (contrat F5, tâche 5.9) : la mise en avant sponsorisée
 * n'est plus proposée (seule la billetterie l'est). Toute demande reçoit 403 SERVICE_UNAVAILABLE, sans
 * écriture dans sponsored_promotions ni notification. Les colonnes et la table restent en base.
 */
export async function POST(req: NextRequest) {
    const activeSession = await requireActiveSession(req);
    if (activeSession.response) return activeSession.response;
    return NextResponse.json({
        error: 'La mise en avant sponsorisée n’est pas proposée pour le moment : seule la billetterie est disponible.',
        code: 'SERVICE_UNAVAILABLE',
    }, { status: 403 });
}

/**
 * GET /api/partner/events/[id]/promotion — dernière demande de promotion d'un événement (historique, lecture
 * seule), pour le partenaire propriétaire, ou un admin muni de events.read, ou le SUPERADMIN (lot 9 bis, R2 ; admin
 * sans la permission : 403 PERMISSION_MISSING) ; sinon 404.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const activeSession = await requireActiveSession(req);
    if (activeSession.response) return activeSession.response;
    const user = activeSession.user;
    if (!serverIsPartner(user)) {
        return NextResponse.json({ error: 'Accès réservé aux organisateurs.', code: 'FORBIDDEN' }, { status: 403 });
    }

    const { id: eventId } = await params;
    const supabase = getServiceRoleClient();

    const access = await requireEventAccess(user, eventId, 'events.read');
    if (access.kind === 'DENIED') return access.response;
    if (access.kind === 'NONE') {
        return NextResponse.json({ error: 'Événement introuvable.', code: 'EVENT_NOT_FOUND' }, { status: 404 });
    }
    const { data: event, error: eventErr } = await supabase.from('events').select('id').eq('id', eventId).maybeSingle();
    if (eventErr) {
        console.error(`[GET promotion] événement ${eventId} illisible : ${eventErr.message}`);
        return NextResponse.json({ error: 'Lecture impossible pour le moment.', code: 'PROMOTION_READ_FAILED' }, { status: 500 });
    }
    if (!event) {
        return NextResponse.json({ error: 'Événement introuvable.', code: 'EVENT_NOT_FOUND' }, { status: 404 });
    }

    const { data, error } = await supabase
        .from('sponsored_promotions')
        .select('id, status, requested_at, reviewed_at, admin_notes, start_date, end_date')
        .eq('event_id', eventId)
        .order('requested_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (error) {
        console.error(`[GET promotion] demandes de ${eventId} illisibles : ${error.message}`);
        return NextResponse.json({ error: 'Lecture impossible pour le moment.', code: 'PROMOTION_READ_FAILED' }, { status: 500 });
    }

    return NextResponse.json({ promotion: data || null });
}
