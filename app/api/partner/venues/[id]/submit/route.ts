import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession, serverIsPartner } from '@/lib/auth/session';
import { TableService } from '@/lib/tables/table.service';
import { guardFeature } from '@/lib/features/flags';
import { venueStatusView } from '@/lib/tables/views';
import { tableFailure } from '@/lib/tables/route-helpers';

export const dynamic = 'force-dynamic';

/**
 * POST /api/partner/venues/[id]/submit — renvoi en validation d'un établissement refusé, par sa propriétaire.
 * Lot 11b (point 2) : venue_submit en base (propriétaire, compte ACTIF, fiche VALIDE ; nom, adresse et ville, une photo,
 * des horaires et une table active exigés) ; les administrateurs qui peuvent valider sont prévenus. Service fermé : 404.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await requireActiveSession(request);
        if (session.response) return session.response;
        const closed = await guardFeature('tables', 'POST /api/partner/venues/[id]/submit');
        if (closed) return closed;
        if (!serverIsPartner(session.user)) return NextResponse.json({ error: 'Réservé aux partenaires.' }, { status: 403 });
        const { id } = await params;
        const r = await TableService.submitVenue(session.user.id, id);
        const s = venueStatusView(r.validation_status);
        return NextResponse.json({ success: true, venue: { id, status: r.validation_status, statusLabel: s.label } });
    } catch (error: unknown) {
        return tableFailure('POST /api/partner/venues/[id]/submit', error, { message: 'Envoi impossible pour le moment. Réessayez.', code: 'VENUE_SUBMIT_FAILED' });
    }
}
