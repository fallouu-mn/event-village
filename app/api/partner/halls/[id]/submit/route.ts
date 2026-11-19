import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { requireActiveSession, serverIsPartner } from '@/lib/auth/session';
import { guardFeature } from '@/lib/features/flags';
import { HallService } from '@/lib/halls/hall.service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/partner/halls/[id]/submit — la propriétaire renvoie en validation sa salle refusée.
 * Lot 10b (point 3) : session active, puis interrupteur, puis rôle de partenaire ; propriété vérifiée (salle d'une
 * autre partenaire : 404) ; état et complétude vérifiés en base (hall_submit : compte actif, partenaire VALIDE, salle
 * refusée, nom, prix par jour, adresse et ville, une photo, position). Les administrateurs qui peuvent valider sont
 * prévenus (trg_halls_notify_admins).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await requireActiveSession(req);
        if (session.response) return session.response;
        const closed = await guardFeature('halls', 'POST /api/partner/halls/[id]/submit');
        if (closed) return closed;
        if (!serverIsPartner(session.user)) {
            return NextResponse.json({ success: false, error: 'Seul un partenaire peut envoyer une salle.', code: 'FORBIDDEN' }, { status: 403 });
        }
        const { id } = await params;
        const outcome = await HallService.submitHall(id, session.user.id);
        return NextResponse.json(outcome.body, { status: outcome.status });
    } catch (err: unknown) {
        return apiFailure('POST /api/partner/halls/[id]/submit', err, { message: 'Envoi impossible pour le moment. Réessayez.', code: 'HALL_SUBMIT_FAILED' });
    }
}
