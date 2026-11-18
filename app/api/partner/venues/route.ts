import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { requireActiveSession, serverIsPartner } from '@/lib/auth/session';
import { TableService } from '@/lib/tables/table.service';
import { guardFeature } from '@/lib/features/flags';
import { VENUE_KIND_LABELS, VENUE_VALIDATION_LABELS } from '@/lib/tables/booking';

export const dynamic = 'force-dynamic';

function view(v: Record<string, unknown>) {
    return { ...v, kindLabel: VENUE_KIND_LABELS[String(v.kind)] ?? 'Établissement', status: VENUE_VALIDATION_LABELS[String(v.validation_status)] ?? 'En attente de validation' };
}

/**
 * GET /api/partner/venues — établissements de la partenaire (avec leurs horaires).
 * POST /api/partner/venues { kind, name, address, city, latitude?, longitude?, slot_minutes?, deposit_per_person?,
 *   confirmation_mode, hours? } — nouvel établissement, en attente de validation par l'administration (réglage
 *   tables.validation_required) ; les administrateurs qui peuvent valider sont prévenus (cloche, push, email, SMS
 *   groupé). Lot 11a : la base revérifie tout (bornes, partenaire, statut de validation jamais écrit ici).
 */
export async function GET(request: NextRequest) {
    try {
        const session = await requireActiveSession(request);
        if (session.response) return session.response;
        const closed = await guardFeature('tables', 'GET /api/partner/venues');
        if (closed) return closed;
        if (!serverIsPartner(session.user)) return NextResponse.json({ error: 'Réservé aux partenaires.' }, { status: 403 });
        const venues = await TableService.listVenues(session.user.id);
        return NextResponse.json({ success: true, venues: venues.map((v) => view(v as Record<string, unknown>)) });
    } catch (error: unknown) {
        return apiFailure('GET /api/partner/venues', error, { message: 'Établissements momentanément indisponibles.', code: 'VENUES_UNAVAILABLE', status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await requireActiveSession(request);
        if (session.response) return session.response;
        const closed = await guardFeature('tables', 'POST /api/partner/venues');
        if (closed) return closed;
        if (!serverIsPartner(session.user)) return NextResponse.json({ error: 'Réservé aux partenaires.' }, { status: 403 });
        const body = await request.json().catch(() => null);
        const venue = await TableService.createVenue(session.user.id, body);
        return NextResponse.json({ success: true, venue: view(venue as Record<string, unknown>) }, { status: 201 });
    } catch (error: unknown) {
        return apiFailure('POST /api/partner/venues', error, { message: 'Établissement non enregistré. Réessayez.', code: 'VENUE_SAVE_FAILED', status: 400 });
    }
}
