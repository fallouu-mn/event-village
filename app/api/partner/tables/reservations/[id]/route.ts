import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { requireActiveSession, serverIsPartner } from '@/lib/auth/session';
import { TableService } from '@/lib/tables/table.service';
import { guardFeature } from '@/lib/features/flags';

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const activeSession = await requireActiveSession(request);
        if (activeSession.response) return activeSession.response;
        // Lot 7 (7.3, D56) : session d'abord, puis interrupteur (404 si le service est fermé)
        const closed = await guardFeature('tables', '/api/partner/tables/reservations/[id]');
        if (closed) return closed;
        const user = activeSession.user;
        if (!user || !serverIsPartner(user)) {
            return NextResponse.json({ error: 'Non autorise.' }, { status: 403 });
        }

        const { id } = await params;
        const body = await request.json();

        const reservation = await TableService.updateReservationStatus(id, user.id, body.status);
        return NextResponse.json({ success: true, reservation });
    } catch (error: unknown) {
        return apiFailure('PATCH /api/partner/tables/reservations/[id]', error, { message: 'Réservation non enregistrée. Réessayez.', code: 'TABLE_RESERVATION_SAVE_FAILED', status: 400 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const activeSession = await requireActiveSession(request);
        if (activeSession.response) return activeSession.response;
        // Lot 7 (7.3, D56) : session d'abord, puis interrupteur (404 si le service est fermé)
        const closed = await guardFeature('tables', '/api/partner/tables/reservations/[id]');
        if (closed) return closed;
        const user = activeSession.user;
        if (!user) {
            return NextResponse.json({ error: 'Non autorise.' }, { status: 401 });
        }

        const { id } = await params;
        const body = await request.json();
        await TableService.cancelReservation(id, user.id, body.reason || 'Annule par le partenaire');

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        return apiFailure('DELETE /api/partner/tables/reservations/[id]', error, { message: 'Réservation non annulée. Réessayez.', code: 'TABLE_RESERVATION_CANCEL_FAILED', status: 400 });
    }
}
