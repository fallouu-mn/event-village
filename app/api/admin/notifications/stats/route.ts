import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession } from '@/lib/auth/session';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/notifications/stats?days= — lot 6 (contrat L2, L3). Compteurs de la supervision :
 * permission notifications.read, compte ACTIF. Par jour (de Dakar) et par canal : envoyées, échecs, non
 * envoyées, incertaines, annulées ; SMS du mois (envoyés + incertains, journaux OTP compris, nombre
 * d'OTP) ; SMS du jour. Lot 7 (7.0 a, D15) : `threshold` = seuil de l'alerte à 80 % du budget des SMS
 * optionnels (ceil(0,8 × notif.sms_optional_daily_cap), null si le plafond est absent ou vaut 0),
 * `optional_cap` (le plafond) et `optional_today` (SMS optionnels du jour), servis tels quels par
 * admin_notifications_stats : la route ne calcule rien. `days` de 1 à 31 (défaut 14), sinon 400
 * INVALID_FILTER. Aucune heure n'est lue de la requête.
 */

const NO_STORE = { 'Cache-Control': 'no-store' };

function unavailable(detail: string): NextResponse {
    console.error('[API GET /api/admin/notifications/stats] admin_notifications_stats :', detail);
    return NextResponse.json(
        { error: 'Les statistiques des notifications sont momentanément indisponibles.', code: 'NOTIFICATIONS_UNAVAILABLE' },
        { status: 500, headers: NO_STORE },
    );
}

export async function GET(req: NextRequest) {
    const session = await requireActiveSession(req);
    if (session.response) return session.response;
    const auth = await verifyAdminAuth(req, { requiredPermission: 'notifications.read' });
    if (!auth.authorized || !auth.user) {
        return auth.errorResponse ?? NextResponse.json({ error: 'Accès réservé aux administrateurs.', code: 'FORBIDDEN' }, { status: 403 });
    }

    const days = new URL(req.url).searchParams.get('days');
    const { data, error } = await getServiceRoleClient().rpc('admin_notifications_stats', {
        p: days !== null && days !== '' ? { days } : {},
    });
    const body = data as ({ ok?: boolean; code?: string; message?: string } & Record<string, unknown>) | null;
    if (error || !body) return unavailable(error ? `${error.code ?? ''} ${error.message}` : 'réponse vide');
    if (body.ok !== true) {
        if (body.code === 'INVALID_FILTER') {
            return NextResponse.json({ error: body.message ?? 'Période invalide.', code: 'INVALID_FILTER' }, { status: 400, headers: NO_STORE });
        }
        return unavailable(`refus inattendu : ${JSON.stringify(body)}`);
    }
    const { ok: _ok, ...rest } = body;
    void _ok;
    return NextResponse.json(rest, { headers: NO_STORE });
}
