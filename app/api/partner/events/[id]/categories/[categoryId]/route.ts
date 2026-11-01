import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession, serverIsPartner } from '@/lib/auth/session';
import { EventService, EventServiceError } from '@/lib/events/event.service';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string; categoryId: string }> };

function refused(error: unknown, label: string, fallback: string, code: string): NextResponse {
    if (error instanceof EventServiceError) return NextResponse.json({ success: false, ...error.toBody() }, { status: error.status });
    console.error(`[API partner categories ${label}]`, error instanceof Error ? error.message : String(error));
    return NextResponse.json({ success: false, error: fallback, code }, { status: 500 });
}

/**
 * PATCH /api/partner/events/[id]/categories/[categoryId] — lot 5 (contrat F4)
 * Modification d'une catégorie (schéma partagé updateTicketCategorySchema, puis RPC ticket_category_update) :
 * nom, description, prix (seulement sans vente : sinon 409 PRICE_LOCKED_AFTER_SALES), quota (≥ vendus :
 * QUOTA_BELOW_SOLD ; ≥ vendus + réservés : QUOTA_BELOW_HELD ; Σ quotas ≤ jauge : QUOTA_ABOVE_CAPACITY), dates
 * de vente, max_per_order, visibilité et mise en vente. Rien n'est ignoré ni modifié implicitement.
 * Réponses : 200 `{ success, category }` ; 400 ; 403 ; 404 ; 409.
 */
export async function PATCH(request: NextRequest, { params }: Params) {
    const activeSession = await requireActiveSession(request);
    if (activeSession.response) return activeSession.response;
    const user = activeSession.user;
    if (!serverIsPartner(user)) {
        return NextResponse.json({ success: false, error: 'Accès réservé aux organisateurs.', code: 'FORBIDDEN' }, { status: 403 });
    }

    const { id: eventId, categoryId } = await params;
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ success: false, error: 'Corps de requête illisible (JSON attendu).', code: 'INVALID_BODY' }, { status: 400 });
    }

    try {
        const category = await EventService.updateTicketCategory(user.id, eventId, categoryId, body);
        return NextResponse.json({ success: true, category });
    } catch (error: unknown) {
        return refused(error, 'PATCH', 'Modification de la catégorie impossible pour le moment.', 'CATEGORY_UPDATE_FAILED');
    }
}

/**
 * DELETE /api/partner/events/[id]/categories/[categoryId] — lot 5 (contrat F4)
 * Suppression d'une catégorie sans billet ni réservation (RPC ticket_category_delete) ; sinon 409
 * CATEGORY_HAS_SALES, la réponse proposant de la désactiver. Réponses : 200 `{ success, category_id }`.
 */
export async function DELETE(request: NextRequest, { params }: Params) {
    const activeSession = await requireActiveSession(request);
    if (activeSession.response) return activeSession.response;
    const user = activeSession.user;
    if (!serverIsPartner(user)) {
        return NextResponse.json({ success: false, error: 'Accès réservé aux organisateurs.', code: 'FORBIDDEN' }, { status: 403 });
    }

    const { id: eventId, categoryId } = await params;
    try {
        const result = await EventService.deleteTicketCategory(user.id, eventId, categoryId);
        return NextResponse.json({ success: true, ...result });
    } catch (error: unknown) {
        return refused(error, 'DELETE', 'Suppression de la catégorie impossible pour le moment.', 'CATEGORY_DELETE_FAILED');
    }
}
