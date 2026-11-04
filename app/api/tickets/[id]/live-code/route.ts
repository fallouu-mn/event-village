import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession } from '@/lib/auth/session';
import { getServerEnv } from '@/lib/env';
import { reserveQuota } from '@/lib/security/quota';
import { buildTicketPayload, generateTicketCode, secondsUntilNextStep, TOTP_STEP_SECONDS } from '@/lib/security/totp';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/tickets/[id]/live-code — QR dynamique du billet (lot 4.2, 4.3) : réservé au PORTEUR du
 * billet (tout autre compte, personnel compris, reçoit 404 sans donnée), billet VALIDE uniquement.
 * Payload « EVT1:<UUID>:<code> », code à 6 chiffres renouvelé toutes les 20 s ; `expires_in` donne
 * le temps restant du pas courant pour que l'interface rafraîchisse au bon moment.
 * Lot 7 (7.1) : `server_time` (heure du serveur à l'envoi) permet au téléphone de recalculer son écart
 * d'horloge, appliqué au lot de codes hors ligne.
 */
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> | { id: string } }) {
    const session = await requireActiveSession(req);
    if (session.response) return session.response;
    const { id } = await Promise.resolve(context.params);
    if (!id || !UUID.test(id)) return NextResponse.json({ error: 'Billet introuvable.' }, { status: 404 });

    const quota = await reserveQuota([{ scope: 'live_code_user', bucket: session.user.id, windowSecs: 60, max: getServerEnv().LIVE_CODE_PER_USER_MIN }], 'live-code');
    if (!quota.allowed) {
        if (quota.reason === 'UNAVAILABLE') return NextResponse.json({ error: 'Code momentanément indisponible.' }, { status: 503 });
        return NextResponse.json({ error: 'Trop de demandes : patientez quelques secondes.' }, { status: 429, headers: { 'Retry-After': String(quota.retryAfterSeconds) } });
    }

    const { data: ticket, error } = await getServiceRoleClient()
        .from('tickets')
        .select('id, user_id, status, totp_secret')
        .eq('id', id)
        .maybeSingle();
    if (error) {
        console.error(`[live-code] lecture du billet ${id} impossible :`, error.message);
        return NextResponse.json({ error: 'Code momentanément indisponible.' }, { status: 500 });
    }
    if (!ticket || ticket.user_id !== session.user.id) return NextResponse.json({ error: 'Billet introuvable.' }, { status: 404 });
    if (ticket.status !== 'VALIDE') {
        return NextResponse.json({ error: 'Ce billet n’est plus valable à l’entrée.', status: ticket.status }, { status: 409 });
    }
    const now = new Date();
    const code = generateTicketCode(ticket.id as string, String(ticket.totp_secret), now);
    return NextResponse.json(
        // Lot 7 (7.1, contrat 5.2) : heure du serveur, pour recalculer l'écart d'horloge du téléphone à chaque code reçu
        { payload: buildTicketPayload(ticket.id as string, code), step_seconds: TOTP_STEP_SECONDS, expires_in: secondsUntilNextStep(now), server_time: new Date().toISOString() },
        { headers: { 'Cache-Control': 'no-store' } });
}
