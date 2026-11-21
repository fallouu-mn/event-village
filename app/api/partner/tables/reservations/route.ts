import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { requireActiveSession, serverIsPartner } from '@/lib/auth/session';
import { TableService } from '@/lib/tables/table.service';

/**
 * GET /api/partner/tables/reservations?date=AAAA-MM-JJ&venueId=… — réservations des établissements de la partenaire.
 * Lot 11a : plus de POST ici. Une réservation se crée seulement par la fonction en base table_reserve (route
 * POST /api/restaurants/reserve-table, compte du client) ; l'ancienne création par la partenaire passait par
 * create_table_reservation_atomic, sans contrôle de l'établissement, de l'heure ni de l'argent (retirée).
 */
export async function GET(request: NextRequest) {
    try {
        const activeSession = await requireActiveSession(request);
        if (activeSession.response) return activeSession.response;
        // Lot 11b (décision du 20/11) : sans interrupteur, une réservation existante se lit et se gère même service fermé
        const user = activeSession.user;
        if (!user || !serverIsPartner(user)) {
            return NextResponse.json({ error: 'Réservé aux partenaires.' }, { status: 403 });
        }
        const url = new URL(request.url);
        const reservations = await TableService.getPartnerReservations(user.id, {
            date: url.searchParams.get('date') || undefined,
            venueId: url.searchParams.get('venueId') || undefined,
        });
        return NextResponse.json({ success: true, reservations });
    } catch (error: unknown) {
        return apiFailure('GET /api/partner/tables/reservations', error, { message: 'Réservations momentanément indisponibles.', code: 'TABLE_RESERVATIONS_UNAVAILABLE', status: 500 });
    }
}
