import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { requireActiveSession, serverIsPartner, serverIsAdmin } from '@/lib/auth/session';
import { EventService, EventServiceError } from '@/lib/events/event.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/partner/events/[id]
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const activeSession = await requireActiveSession(request);
        if (activeSession.response) return activeSession.response;
        const user = activeSession.user;
        if (!user) {
            return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
        }

        const { id } = await params;
        const event = await EventService.getEventById(
            id,
            serverIsAdmin(user) ? undefined : user.id
        );

        return NextResponse.json({ success: true, event });
    } catch (error: unknown) {
        // A26 (AM7) : statut 404 conservé, une panne de lecture reste présentée comme un événement introuvable.
        return apiFailure('GET /api/partner/events/[id]', error, { message: 'Événement introuvable.', code: 'EVENT_NOT_FOUND', status: 404 });
    }
}

/**
 * PUT /api/partner/events/[id] — lot 5 (contrats F1, F3, U)
 * Corps `{ patch, expected_updated_at }` : patch validé par le schéma partagé, puis RPC event_update
 * (propriétaire seul, version attendue, règles par statut, verrous après ventes, porteurs prévenus).
 * Réponses : 200 `{ success, event, notified_holders, sms_queued }` ; 400 (champ interdit FIELD_NOT_EDITABLE,
 * validation avec `fields`) ; 403 ADMIN_CANNOT_EDIT ; 404 ; 409 (EDIT_CONFLICT, WITHDRAW_TO_EDIT,
 * EVENT_LOCKED, LOCKED_AFTER_SALES, SALE_END_AFTER_EVENT avec `categories`).
 */
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const activeSession = await requireActiveSession(request);
    if (activeSession.response) return activeSession.response;
    const user = activeSession.user;
    if (!serverIsPartner(user)) {
        return NextResponse.json({ error: 'Accès réservé aux organisateurs.', code: 'FORBIDDEN' }, { status: 403 });
    }

    const { id } = await params;
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Corps de requête illisible (JSON attendu).', code: 'INVALID_BODY' }, { status: 400 });
    }

    try {
        const result = await EventService.updateEvent(id, user.id, body);
        return NextResponse.json({ success: true, ...result });
    } catch (error: unknown) {
        if (error instanceof EventServiceError) return NextResponse.json(error.toBody(), { status: error.status });
        console.error('[API partner/events/[id] PUT]', error instanceof Error ? error.message : String(error));
        return NextResponse.json({ error: 'Modification de l’événement impossible pour le moment.', code: 'EVENT_UPDATE_FAILED' }, { status: 500 });
    }
}

/**
 * DELETE /api/partner/events/[id] — lot 6 (6.0 b, contrat A2)
 * Brouillon neuf seulement (règle en base, trigger events_delete_guard). Réponses : 200 `{ success: true }` ;
 * 404 EVENT_NOT_FOUND ; 409 EVENT_NOT_DELETABLE (événement sorti du brouillon, ou brouillon déjà soumis :
 * message du trigger) ; 500 EVENT_DELETE_FAILED.
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const activeSession = await requireActiveSession(request);
        if (activeSession.response) return activeSession.response;
        const user = activeSession.user;
        if (!user || !serverIsPartner(user)) {
            return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 403 });
        }

        const { id } = await params;
        const result = await EventService.deleteEvent(id, user.id);

        return NextResponse.json(result);
    } catch (error: unknown) {
        if (error instanceof EventServiceError) return NextResponse.json(error.toBody(), { status: error.status });
        // Autres refus : profil partenaire introuvable (PublicError de resolvePartnerId), statut 400 conservé.
        return apiFailure('DELETE /api/partner/events/[id]', error, { message: 'Suppression de l’événement impossible pour le moment.', code: 'EVENT_DELETE_FAILED', status: 400 });
    }
}
