import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { requireActiveSession, serverIsPartner } from '@/lib/auth/session';
import { TableService } from '@/lib/tables/table.service';
import { guardFeature } from '@/lib/features/flags';
import { VENUE_VALIDATION_LABELS } from '@/lib/tables/booking';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/partner/venues/[id] { champs de l'établissement, hours? } — la partenaire modifie un de ses
 * établissements. Lot 11a : le statut de validation n'est jamais écrit ici (un établissement refusé puis modifié
 * repart en attente de validation, les administrateurs sont prévenus) ; horaires par venue_hours_set (journal).
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await requireActiveSession(request);
        if (session.response) return session.response;
        const closed = await guardFeature('tables', 'PATCH /api/partner/venues/[id]');
        if (closed) return closed;
        if (!serverIsPartner(session.user)) return NextResponse.json({ error: 'Réservé aux partenaires.' }, { status: 403 });
        const { id } = await params;
        const body = await request.json().catch(() => null);
        const venue = await TableService.updateVenue(session.user.id, id, body);
        return NextResponse.json({ success: true, venue: { ...venue, status: VENUE_VALIDATION_LABELS[String(venue.validation_status)] ?? 'En attente de validation' } });
    } catch (error: unknown) {
        return apiFailure('PATCH /api/partner/venues/[id]', error, { message: 'Établissement non enregistré. Réessayez.', code: 'VENUE_SAVE_FAILED', status: 400 });
    }
}
