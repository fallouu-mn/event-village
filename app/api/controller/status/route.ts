import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { requireActiveSession } from '@/lib/auth/session';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/controller/status — finition 1 (complément 11) : le droit de scanner est un droit par événement, pas un
 * statut de compte. `scanner` vrai si le compte a au moins un événement dont le contrôle est ouvert ou ouvre dans les
 * 24 h (RPC controller_scanner_status, règle de la plage du contrôle) ; sinon faux : l'application est celle d'un client
 * normal (menu « Scanner » masqué). Ouverte à toute session active (un client sans affectation reçoit faux). Rien n'est
 * retiré au compte à la fin d'un événement. Réponse `{ scanner, open_now, next_opens_at }`.
 */
export async function GET(req: NextRequest) {
    const session = await requireActiveSession(req);
    if (session.response) return session.response;
    try {
        const { data, error } = await getServiceRoleClient().rpc('controller_scanner_status', { p: { user_id: session.user.id } });
        if (error) throw new Error(`controller_scanner_status : ${error.code ?? ''} ${error.message}`);
        const reply = data as { ok?: boolean; scanner?: boolean; open_now?: number; next_opens_at?: string | null } | null;
        if (!reply || reply.ok !== true) throw new Error(`controller_scanner_status : réponse inattendue ${JSON.stringify(data)}`);
        return NextResponse.json({
            scanner: reply.scanner === true,
            open_now: Number(reply.open_now ?? 0),
            next_opens_at: reply.next_opens_at ?? null,
        }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (err) {
        return apiFailure('GET /api/controller/status', err, { message: 'État du scanner momentanément indisponible.', code: 'SCANNER_STATUS_UNAVAILABLE' });
    }
}
