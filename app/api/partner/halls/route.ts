import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { requireActiveSession, serverIsPartner } from '@/lib/auth/session';
import { HallService } from '@/lib/halls/hall.service';
import { guardFeature } from '@/lib/features/flags';

/**
 * GET /api/partner/halls
 * Liste des salles du partenaire connecté
 */
export async function GET(request: NextRequest) {
    try {
        const activeSession = await requireActiveSession(request);
        if (activeSession.response) return activeSession.response;
        // Lot 7 (7.3, D56) : session d'abord, puis interrupteur (404 si le service est fermé)
        const closed = await guardFeature('halls', '/api/partner/halls');
        if (closed) return closed;
        const user = activeSession.user;
        if (!user || !serverIsPartner(user)) {
            return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 401 });
        }

        const halls = await HallService.getPartnerHalls(user.id);
        return NextResponse.json({ success: true, halls });
    } catch (error: unknown) {
        return apiFailure('GET /api/partner/halls', error, { message: 'Salles momentanément indisponibles.', code: 'HALLS_UNAVAILABLE', status: 500 });
    }
}

/**
 * POST /api/partner/halls
 * Création d'une salle avec acompte configurable (§42/§45)
 */
export async function POST(request: NextRequest) {
    try {
        const activeSession = await requireActiveSession(request);
        if (activeSession.response) return activeSession.response;
        // Lot 7 (7.3, D56) : session d'abord, puis interrupteur (404 si le service est fermé)
        const closed = await guardFeature('halls', '/api/partner/halls');
        if (closed) return closed;
        const user = activeSession.user;
        if (!user || !serverIsPartner(user)) {
            return NextResponse.json({ error: 'Seul un partenaire peut créer une salle.' }, { status: 403 });
        }

        const body = await request.json();
        const hall = await HallService.createHall(user.id, body);

        return NextResponse.json({ success: true, hall }, { status: 201 });
    } catch (error: unknown) {
        return apiFailure('POST /api/partner/halls', error, { message: 'Salle non enregistrée. Réessayez.', code: 'HALL_SAVE_FAILED', status: 400 });
    }
}
