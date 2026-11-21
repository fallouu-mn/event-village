import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession, serverIsPartner } from '@/lib/auth/session';
import { TableService } from '@/lib/tables/table.service';
import { guardFeature } from '@/lib/features/flags';
import { VENUE_VALIDATION_LABELS } from '@/lib/tables/booking';
import { ownVenue } from '@/lib/tables/queries';
import { jsonBody, notFound, tableFailure } from '@/lib/tables/route-helpers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/partner/venues/[id] — fiche complète d'un établissement de la partenaire (modification, plan, fermetures) :
 * horaires, zones, tables (positions du plan), fermetures à venir, réglages, valeurs par défaut des réglages tables.*.
 * Lot 11b : seulement la propriétaire (fiche résolue depuis la session) ; sinon 404 sans indice. Lecture ouverte même
 * service fermé.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await requireActiveSession(request);
        if (session.response) return session.response;
        if (!serverIsPartner(session.user)) return NextResponse.json({ error: 'Réservé aux partenaires.' }, { status: 403 });
        const { id } = await params;
        const venue = await ownVenue(session.user.id, id);
        if (!venue) return notFound('Établissement introuvable.', 'VENUE_NOT_FOUND');
        return NextResponse.json({ success: true, venue });
    } catch (error: unknown) {
        return tableFailure('GET /api/partner/venues/[id]', error, { message: 'Établissement momentanément indisponible.', code: 'VENUE_UNAVAILABLE', status: 500 });
    }
}

/**
 * PATCH /api/partner/venues/[id] { champs de l'établissement, photos?, hours? } — la partenaire modifie un de ses
 * établissements. Lot 11a : le statut de validation n'est jamais écrit ici ; horaires par venue_hours_set (journal).
 * Lot 11b : un établissement refusé puis modifié reste refusé jusqu'au renvoi (POST …/submit) ; photos réencodées de la
 * route de dépôt ou déjà enregistrées. Service fermé : 404 ; fiche SUSPENDU : 403 (garde des fiches, F1).
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await requireActiveSession(request);
        if (session.response) return session.response;
        const closed = await guardFeature('tables', 'PATCH /api/partner/venues/[id]');
        if (closed) return closed;
        if (!serverIsPartner(session.user)) return NextResponse.json({ error: 'Réservé aux partenaires.' }, { status: 403 });
        const { id } = await params;
        const body = await jsonBody(request);
        const venue = await TableService.updateVenue(session.user.id, id, body);
        return NextResponse.json({ success: true, venue: { ...venue, status: VENUE_VALIDATION_LABELS[String(venue.validation_status)] ?? 'En attente de validation' } });
    } catch (error: unknown) {
        return tableFailure('PATCH /api/partner/venues/[id]', error, { message: 'Établissement non enregistré. Réessayez.', code: 'VENUE_SAVE_FAILED', status: 400 });
    }
}
