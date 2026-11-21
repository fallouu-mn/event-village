import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { requireActiveSession, serverIsPartner } from '@/lib/auth/session';
import { HallRefusal, partnerEarnings } from '@/lib/halls/queries';
import { refusalResponse } from '@/lib/halls/route-helpers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/partner/halls/earnings — recettes des salles de la partenaire de la session.
 * Lot 10b (point 3) : lues dans le grand livre (hall_partner_earnings : ventes moins remboursements, disponibilité
 * datée 48 h après la fin de la réservation) ; session active, interrupteur, rôle de partenaire ; seules SES salles.
 */
export async function GET(req: NextRequest) {
    try {
        const session = await requireActiveSession(req);
        if (session.response) return session.response;
        // Lot 11b (décision du 20/11) : sans interrupteur, une réservation existante se lit et se gère même service fermé
        if (!serverIsPartner(session.user)) {
            return NextResponse.json({ success: false, error: 'Espace réservé aux partenaires.', code: 'FORBIDDEN' }, { status: 403 });
        }
        const earnings = await partnerEarnings(session.user.id);
        return NextResponse.json({ success: true, ...earnings });
    } catch (err: unknown) {
        if (err instanceof HallRefusal) return refusalResponse(err);
        return apiFailure('GET /api/partner/halls/earnings', err, { message: 'Recettes momentanément indisponibles.', code: 'HALL_EARNINGS_UNAVAILABLE', status: 500 });
    }
}
