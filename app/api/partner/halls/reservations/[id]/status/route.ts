import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { requireActiveSession, serverIsPartner } from '@/lib/auth/session';
import { HallService } from '@/lib/halls/hall.service';
import { guardFeature } from '@/lib/features/flags';

/**
 * POST /api/partner/halls/reservations/[id]/status
 * Confirmation ou annulation d'une réservation de salle
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const activeSession = await requireActiveSession(request);
        if (activeSession.response) return activeSession.response;
        // Lot 7 (7.3, D56) : session d'abord, puis interrupteur (404 si le service est fermé)
        const closed = await guardFeature('halls', '/api/partner/halls/reservations/[id]/status');
        if (closed) return closed;
        const user = activeSession.user;
        if (!user) {
            return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
        }

        const { id } = await params;
        const body = await request.json();
        const { action, reason } = body;

        let result;
        if (action === 'CONFIRM') {
            result = await HallService.confirmReservation(id, user.id);
        } else if (action === 'CANCEL') {
            result = await HallService.cancelReservation(id, user.id, reason);
        } else {
            return NextResponse.json({ error: 'Action non reconnue (CONFIRM ou CANCEL requis).' }, { status: 400 });
        }

        return NextResponse.json({ success: true, reservation: result });
    } catch (error: unknown) {
        return apiFailure('POST /api/partner/halls/reservations/[id]/status', error, { message: 'Réservation non enregistrée. Réessayez.', code: 'HALL_RESERVATION_SAVE_FAILED', status: 400 });
    }
}
