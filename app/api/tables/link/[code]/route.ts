import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession } from '@/lib/auth/session';
import { shortLinkTarget } from '@/lib/tables/short-link';
import { notFound, tableFailure } from '@/lib/tables/route-helpers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/tables/link/[code] — cible du lien court d'un SMS (« /t/<code> ») pour le compte de la session : la page de
 * la réservation pour son client, celle de l'espace de l'établissement pour sa propriétaire. Lot 11b : le code n'est pas
 * un secret (session et propriété exigées) ; tout autre compte ou code inconnu : 404 sans indice. Sans interrupteur (le
 * lien d'une notification ne mène jamais à une page introuvable).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
    try {
        const session = await requireActiveSession(req, { allowStatuses: ['ACTIF', 'EN_ATTENTE'] });
        if (session.response) return session.response;
        const { code } = await params;
        const target = await shortLinkTarget(session.user.id, code);
        if (!target) return notFound('Réservation introuvable.', 'RESERVATION_NOT_FOUND');
        return NextResponse.json({ success: true, target }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (err: unknown) {
        return tableFailure('GET /api/tables/link/[code]', err, { message: 'Lien momentanément indisponible.', code: 'LINK_UNAVAILABLE', status: 500 });
    }
}
