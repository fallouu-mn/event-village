import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { requireActiveSession, serverIsPartner } from '@/lib/auth/session';
import { TableService } from '@/lib/tables/table.service';
import { guardFeature } from '@/lib/features/flags';

export async function GET(request: NextRequest) {
    try {
        const activeSession = await requireActiveSession(request);
        if (activeSession.response) return activeSession.response;
        // Lot 7 (7.3, D56) : session d'abord, puis interrupteur (404 si le service est fermé)
        const closed = await guardFeature('tables', '/api/partner/tables/reservations');
        if (closed) return closed;
        const user = activeSession.user;
        if (!user || !serverIsPartner(user)) {
            return NextResponse.json({ error: 'Non autorise.' }, { status: 401 });
        }

        const url = new URL(request.url);
        const status = url.searchParams.get('status') || undefined;
        const date = url.searchParams.get('date') || undefined;

        const reservations = await TableService.getPartnerReservations(user.id, { status, date });
        return NextResponse.json({ success: true, reservations });
    } catch (error: unknown) {
        return apiFailure('GET /api/partner/tables/reservations', error, { message: 'Réservations momentanément indisponibles.', code: 'TABLE_RESERVATIONS_UNAVAILABLE', status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const activeSession = await requireActiveSession(request);
        if (activeSession.response) return activeSession.response;
        // Lot 7 (7.3, D56) : session d'abord, puis interrupteur (404 si le service est fermé)
        const closed = await guardFeature('tables', '/api/partner/tables/reservations');
        if (closed) return closed;
        const user = activeSession.user;
        if (!user) {
            return NextResponse.json({ error: 'Non autorise.' }, { status: 401 });
        }

        const body = await request.json();
        body.clientId = user.id;

        const reservation = await TableService.createReservation(body);
        return NextResponse.json({ success: true, reservation }, { status: 201 });
    } catch (error: unknown) {
        return apiFailure('POST /api/partner/tables/reservations', error, { message: 'Réservation non enregistrée. Réessayez.', code: 'TABLE_RESERVATION_SAVE_FAILED', status: 400 });
    }
}
