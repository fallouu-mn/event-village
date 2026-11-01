import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession, serverIsPartner } from '@/lib/auth/session';
import { EventService, EventServiceError } from '@/lib/events/event.service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/partner/events/[id]/categories — lot 5 (contrat F4)
 * Ajout d'une catégorie de billets : corps validé par le schéma partagé (lib/validations/event.ts,
 * createTicketCategorySchema : nom, prix et quotas entiers, max_per_order de 1 à 50, dates de vente en
 * heure de Dakar, clés inconnues refusées), puis RPC ticket_category_create (nom unique, Σ quotas ≤ jauge,
 * statut de l'événement). Tous les champs envoyés sont appliqués, is_active compris.
 * Réponses : 201 `{ success, category }` ; 400 `{ error, code, field?, fields }` ; 403 ; 404 ; 409.
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const activeSession = await requireActiveSession(request);
    if (activeSession.response) return activeSession.response;
    const user = activeSession.user;
    if (!serverIsPartner(user)) {
        return NextResponse.json({ success: false, error: 'Accès réservé aux organisateurs.', code: 'FORBIDDEN' }, { status: 403 });
    }

    const { id: eventId } = await params;
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ success: false, error: 'Corps de requête illisible (JSON attendu).', code: 'INVALID_BODY' }, { status: 400 });
    }

    try {
        const category = await EventService.createTicketCategory(user.id, eventId, body);
        return NextResponse.json({ success: true, category }, { status: 201 });
    } catch (error: unknown) {
        if (error instanceof EventServiceError) return NextResponse.json({ success: false, ...error.toBody() }, { status: error.status });
        console.error('[API partner categories POST]', error instanceof Error ? error.message : String(error));
        return NextResponse.json({ success: false, error: 'Ajout de la catégorie impossible pour le moment.', code: 'CATEGORY_CREATE_FAILED' }, { status: 500 });
    }
}
