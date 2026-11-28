import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession, serverIsPartner } from '@/lib/auth/session';
import { invalidatePublicEvent } from '@/lib/events/public-cache.server';
import { errorResponse, routeParam, UUID_RE, type RouteParams } from '@/lib/events/pilotage.service';
import { copyTablesFrom } from '@/lib/event-tables/report.server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/partner/events/[id]/tables/copy { from_event_id } — lot 11c-c : reprend les types et les tables (numéros,
 * positions, formes, état de vente) d'un événement précédent de la même organisatrice, sur un événement encore sans
 * table. Contre-vérification 11c-c (T2, T3) : une seule fonction en base (public.event_table_copy), une transaction, sous
 * le verrou de l'événement cible ; propriété des DEUX événements, garde, jauge en places et interrupteur vérifiés en
 * base ; tout ou rien. Refus : texte de la base, tel quel.
 */
export async function POST(request: NextRequest, ctx: RouteParams<{ id: string }>) {
    const session = await requireActiveSession(request);
    if (session.response) return session.response;
    if (!serverIsPartner(session.user)) {
        return NextResponse.json({ success: false, error: 'Accès réservé aux organisateurs.', code: 'FORBIDDEN' }, { status: 403 });
    }
    const eventId = await routeParam(ctx, 'id');
    if (!UUID_RE.test(eventId)) {
        return NextResponse.json({ success: false, error: 'Événement introuvable.', code: 'EVENT_NOT_FOUND' }, { status: 404 });
    }
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ success: false, error: 'Demande illisible. Rechargez la page, puis réessayez.', code: 'INVALID_BODY' }, { status: 400 });
    }
    const from = body && typeof body === 'object' ? (body as { from_event_id?: unknown }).from_event_id : undefined;
    try {
        const outcome = await copyTablesFrom({ userId: session.user.id, eventId, fromEventId: from });
        if (outcome.status === 200) invalidatePublicEvent(eventId, 'tables copiées');
        return NextResponse.json(outcome.body, { status: outcome.status, headers: { 'Cache-Control': 'no-store' } });
    } catch (err) {
        return errorResponse(err, 'POST /api/partner/events/[id]/tables/copy', 'Copie des tables impossible pour le moment.', 'TABLES_COPY_FAILED');
    }
}
