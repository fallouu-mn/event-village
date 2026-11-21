import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession } from '@/lib/auth/session';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { okOrRefuse } from '@/lib/tables/queries';
import { hmText } from '@/lib/tables/views';
import { tableFailure } from '@/lib/tables/route-helpers';

export const dynamic = 'force-dynamic';

/**
 * POST /api/tables/reservations/[id]/coming — « J'arrive » : le client confirme sa venue (rappel 2 h avant). Lot 11b
 * (point 5) : table_client_coming en base (réservation confirmée du client, de 24 h avant l'heure à la fin de la garde
 * de la table ; une fois) ; l'établissement est prévenu (TABLE_CLIENT_COMING). Réservation d'un autre compte : 404.
 * Sans interrupteur (une réservation existante se gère même service fermé).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await requireActiveSession(req);
        if (session.response) return session.response;
        const { id } = await params;
        const { data, error } = await getServiceRoleClient().rpc('table_client_coming', { p: { reservation_id: id, client_id: session.user.id } });
        if (error) throw new Error(`table_client_coming : ${error.message}`);
        const r = okOrRefuse((data ?? {}) as Record<string, unknown>);
        const until = hmText(String(r.held_until ?? ''));
        return NextResponse.json({ success: true, message: `C’est noté : l’établissement sait que vous arrivez. Votre table est gardée jusqu’à ${until}.`, heldUntil: r.held_until });
    } catch (err: unknown) {
        return tableFailure('POST /api/tables/reservations/[id]/coming', err, { message: 'Confirmation impossible pour le moment. Réessayez.', code: 'TABLE_COMING_FAILED' });
    }
}
