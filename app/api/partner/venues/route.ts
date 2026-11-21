import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession, serverIsPartner } from '@/lib/auth/session';
import { TableService } from '@/lib/tables/table.service';
import { guardFeature } from '@/lib/features/flags';
import { VENUE_KIND_LABELS, VENUE_VALIDATION_LABELS } from '@/lib/tables/booking';
import { partnerVenues } from '@/lib/tables/queries';
import { jsonBody, tableFailure } from '@/lib/tables/route-helpers';

export const dynamic = 'force-dynamic';

function view(v: Record<string, unknown>) {
    return { ...v, kindLabel: VENUE_KIND_LABELS[String(v.kind)] ?? 'Établissement', status: VENUE_VALIDATION_LABELS[String(v.validation_status)] ?? 'En attente de validation' };
}

/**
 * GET /api/partner/venues — établissements de la partenaire : statut en mots, photo, tables, réservations du jour,
 * demandes à accepter. Lot 11b : lecture ouverte même service fermé (décision du 20/11 : l'espace de l'établissement
 * reste lisible, ses réservations existantes se gèrent) ; colonnes nommées, jamais celles d'une autre partenaire.
 */
export async function GET(request: NextRequest) {
    try {
        const session = await requireActiveSession(request);
        if (session.response) return session.response;
        if (!serverIsPartner(session.user)) return NextResponse.json({ error: 'Réservé aux partenaires.' }, { status: 403 });
        const venues = await partnerVenues(session.user.id);
        return NextResponse.json({ success: true, venues });
    } catch (error: unknown) {
        return tableFailure('GET /api/partner/venues', error, { message: 'Établissements momentanément indisponibles.', code: 'VENUES_UNAVAILABLE', status: 500 });
    }
}

/**
 * POST /api/partner/venues { kind, name, description?, address, city, latitude?, longitude?, slot_minutes?,
 *   deposit_per_person?, confirmation_mode, photos[], hours[], zones[{key, name}], tables[{number, capacity,
 *   min_capacity?, zone_key?}] } — nouvel établissement, envoyé en validation (réglage tables.validation_required) ;
 *   les administrateurs qui peuvent valider sont prévenus.
 * Lot 11b : tout en une transaction (venue_create : fiche partenaire VALIDE et compte ACTIF revérifiés en base) ; une
 * photo réencodée de la route de dépôt, une plage d'ouverture et une table au moins. Service fermé : 404.
 */
export async function POST(request: NextRequest) {
    try {
        const session = await requireActiveSession(request);
        if (session.response) return session.response;
        const closed = await guardFeature('tables', 'POST /api/partner/venues');
        if (closed) return closed;
        if (!serverIsPartner(session.user)) return NextResponse.json({ error: 'Réservé aux partenaires.' }, { status: 403 });
        const body = await jsonBody(request);
        const venue = await TableService.createVenue(session.user.id, body);
        return NextResponse.json({ success: true, venue: view(venue as Record<string, unknown>) }, { status: 201 });
    } catch (error: unknown) {
        return tableFailure('POST /api/partner/venues', error, { message: 'Établissement non enregistré. Réessayez.', code: 'VENUE_SAVE_FAILED', status: 400 });
    }
}
