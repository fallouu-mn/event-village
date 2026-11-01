import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession, serverIsPartner, serverHasRole } from '@/lib/auth/session';
import { EventService, EventServiceError } from '@/lib/events/event.service';
import { isEventStatus } from '@/lib/events/event-lifecycle.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/partner/events?status=&search=
 * Liste des événements du partenaire connecté (lot 5, contrat H) : `status` vaut TOUS (défaut) ou l'un
 * des 7 statuts, ANNULE compris ; un statut inconnu donne 400 UNKNOWN_STATUS sans jamais atteindre la
 * base. Les indicateurs (sur tous les événements) sont servis par GET /api/partner/events/overview.
 */
export async function GET(request: NextRequest) {
    const activeSession = await requireActiveSession(request);
    if (activeSession.response) return activeSession.response;
    const user = activeSession.user;
    if (!user || !serverIsPartner(user)) {
        return NextResponse.json({ error: 'Accès réservé aux partenaires.', code: 'FORBIDDEN' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'TOUS';
    if (status !== 'TOUS' && !isEventStatus(status)) {
        return NextResponse.json({ error: 'Statut demandé inconnu.', code: 'UNKNOWN_STATUS' }, { status: 400 });
    }
    const search = (searchParams.get('search') || '').slice(0, 100);

    try {
        const events = await EventService.getPartnerEvents(user.id, { status, search });
        return NextResponse.json({ success: true, events });
    } catch (error: unknown) {
        console.error('[API partner/events GET] Error:', error instanceof Error ? error.message : 'unknown');
        return NextResponse.json(
            { error: 'Lecture de vos événements impossible pour le moment.', code: 'EVENTS_READ_FAILED' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/partner/events — lot 5 (contrats F1, F2, F5)
 * Création d'un événement BROUILLON et de ses catégories en une transaction (RPC event_create).
 * Corps validé par le schéma partagé lib/validations/event.ts (.strict() : statut, slug, partenaire,
 * services ou clé inconnue → 400 avec les champs refusés). Le partenaire est dérivé du compte connecté.
 * Réponses : 201 `{ success, event }` ; 400 `{ error, code, field?, fields }` ; 403 ; 409 (doublon, jauge).
 */
export async function POST(request: NextRequest) {
    const activeSession = await requireActiveSession(request);
    if (activeSession.response) return activeSession.response;
    const user = activeSession.user;
    if (!serverHasRole(user, 'PARTENAIRE')) {
        return NextResponse.json({ error: 'Seul un organisateur peut créer un événement.', code: 'PARTNER_ROLE_REQUIRED' }, { status: 403 });
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Corps de requête illisible (JSON attendu).', code: 'INVALID_BODY' }, { status: 400 });
    }

    try {
        const event = await EventService.createEvent(user.id, body);
        return NextResponse.json({ success: true, event }, { status: 201 });
    } catch (error: unknown) {
        if (error instanceof EventServiceError) return NextResponse.json(error.toBody(), { status: error.status });
        console.error('[API partner/events POST]', error instanceof Error ? error.message : String(error));
        return NextResponse.json({ error: 'Création de l’événement impossible pour le moment.', code: 'EVENT_CREATE_FAILED' }, { status: 500 });
    }
}
