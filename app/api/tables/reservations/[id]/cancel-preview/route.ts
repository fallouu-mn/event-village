import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession } from '@/lib/auth/session';
import { cancelPreview } from '@/lib/tables/queries';
import { tableFailure } from '@/lib/tables/route-helpers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/tables/reservations/[id]/cancel-preview — ce que le client récupère s'il annule maintenant, affiché avant de
 * confirmer. Lot 11b (point 1) : table_cancel_preview en base (même règle que l'annulation : tout rendu jusqu'à
 * tables.cancel_free_hours avant l'heure ou pour une demande pas encore acceptée, rien ensuite ; même arrondi que le
 * remboursement). Réservation d'un autre compte : 404. Sans interrupteur (comme l'annulation).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await requireActiveSession(req, { allowStatuses: ['ACTIF', 'EN_ATTENTE'] });
        if (session.response) return session.response;
        const { id } = await params;
        const preview = await cancelPreview(session.user.id, id);
        return NextResponse.json({ success: true, preview }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (err: unknown) {
        return tableFailure('GET /api/tables/reservations/[id]/cancel-preview', err, { message: 'Montant rendu momentanément indisponible.', code: 'CANCEL_PREVIEW_UNAVAILABLE', status: 500 });
    }
}
