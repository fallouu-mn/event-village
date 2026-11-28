import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession, serverIsPartner } from '@/lib/auth/session';
import { EventService, EventServiceError } from '@/lib/events/event.service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/partner/events/[id]/notice-preview — Finition 2b (D, E-27) : aperçu d'une modification AVANT de
 * l'enregistrer, pour la fenêtre « {n} détenteurs seront prévenus par SMS {à HH:MM | tout de suite}. ».
 * Même corps et mêmes contrôles que PUT /api/partner/events/[id] (session active, organisatrice, propriétaire, statut,
 * compte suspendu en lecture seule, version attendue, schéma partagé) ; RPC event_update_preview : l'enregistrement est
 * calculé puis annulé, rien n'est écrit.
 * Réponses : 200 `{ success, changed_fields, sms_recipients, sms_notice_at, sms_notice_immediate, sms_notice_held,
 * place_notice_at }` ; refus identiques à ceux de PUT (400, 403, 404, 409).
 */
export async function POST(
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
        return NextResponse.json({ error: 'Demande illisible. Rechargez la page, puis réessayez.', code: 'INVALID_BODY' }, { status: 400 });
    }

    try {
        const preview = await EventService.previewEventUpdate(id, user.id, body);
        return NextResponse.json({ success: true, ...preview });
    } catch (error: unknown) {
        if (error instanceof EventServiceError) return NextResponse.json(error.toBody(), { status: error.status });
        console.error('[API partner/events/[id]/notice-preview POST]', error instanceof Error ? error.message : String(error));
        return NextResponse.json({ error: 'Aperçu de la modification impossible pour le moment.', code: 'EVENT_PREVIEW_FAILED' }, { status: 500 });
    }
}
