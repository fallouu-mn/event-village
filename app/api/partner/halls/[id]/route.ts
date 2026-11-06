import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { requireActiveSession, serverIsPartner } from '@/lib/auth/session';
import { HallService } from '@/lib/halls/hall.service';
import { guardFeature } from '@/lib/features/flags';

/**
 * GET /api/partner/halls/[id]
 * Lot 7 (7.3, D56) : route de l'espace partenaire, session ACTIVE exigée comme les autres gestionnaires du
 * fichier, puis interrupteur (404 si le service des salles est fermé).
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const activeSession = await requireActiveSession(request);
        if (activeSession.response) return activeSession.response;
        const closed = await guardFeature('halls', '/api/partner/halls/[id]');
        if (closed) return closed;
        const { id } = await params;
        const hall = await HallService.getHallById(id);
        return NextResponse.json({ success: true, hall });
    } catch (error: unknown) {
        return apiFailure('GET /api/partner/halls/[id]', error, { message: 'Salle introuvable.', code: 'HALL_NOT_FOUND', status: 404 });
    }
}

/**
 * PUT /api/partner/halls/[id]
 */
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const activeSession = await requireActiveSession(request);
        if (activeSession.response) return activeSession.response;
        // Lot 7 (7.3, D56) : session d'abord, puis interrupteur (404 si le service est fermé)
        const closed = await guardFeature('halls', '/api/partner/halls/[id]');
        if (closed) return closed;
        const user = activeSession.user;
        if (!user || !serverIsPartner(user)) {
            return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 403 });
        }

        const { id } = await params;
        const body = await request.json();
        const updated = await HallService.updateHall(id, user.id, body);

        return NextResponse.json({ success: true, hall: updated });
    } catch (error: unknown) {
        return apiFailure('PUT /api/partner/halls/[id]', error, { message: 'Salle non enregistrée. Réessayez.', code: 'HALL_SAVE_FAILED', status: 400 });
    }
}

/**
 * DELETE /api/partner/halls/[id]
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const activeSession = await requireActiveSession(request);
        if (activeSession.response) return activeSession.response;
        // Lot 7 (7.3, D56) : session d'abord, puis interrupteur (404 si le service est fermé)
        const closed = await guardFeature('halls', '/api/partner/halls/[id]');
        if (closed) return closed;
        const user = activeSession.user;
        if (!user || !serverIsPartner(user)) {
            return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 403 });
        }

        const { id } = await params;
        const result = await HallService.deleteHall(id, user.id);

        return NextResponse.json(result);
    } catch (error: unknown) {
        return apiFailure('DELETE /api/partner/halls/[id]', error, { message: 'Salle non supprimée. Réessayez.', code: 'HALL_DELETE_FAILED', status: 400 });
    }
}
