import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession, serverIsPartner } from '@/lib/auth/session';
import { invalidatePublicEvent } from '@/lib/events/public-cache.server';
import { callTables, isUuid, outcomeOf, TableTypeSchema } from '@/lib/event-tables/event-tables.server';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string; typeId: string }> };

async function guard(request: NextRequest, ctx: Ctx) {
    const session = await requireActiveSession(request);
    if (session.response) return { response: session.response } as const;
    if (!serverIsPartner(session.user)) {
        return { response: NextResponse.json({ success: false, error: 'Accès réservé aux organisateurs.', code: 'FORBIDDEN' }, { status: 403 }) } as const;
    }
    const { id: eventId, typeId } = await ctx.params;
    if (!isUuid(eventId) || !isUuid(typeId)) {
        return { response: NextResponse.json({ success: false, error: 'Type de table introuvable pour cet événement.', code: 'TABLE_TYPE_NOT_FOUND' }, { status: 404 }) } as const;
    }
    return { userId: session.user.id, eventId, typeId } as const;
}

/**
 * PATCH /api/partner/events/[id]/tables/types/[typeId] — lot 11c-a : modification d'un type de table (champs envoyés
 * seulement) ; prix et places figés dès la première vente ou attente (PRICE_LOCKED_AFTER_SALES) ; jauge en places.
 */
export async function PATCH(request: NextRequest, ctx: Ctx) {
    const g = await guard(request, ctx);
    if ('response' in g) return g.response;
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ success: false, error: 'Corps de requête illisible (JSON attendu).', code: 'INVALID_BODY' }, { status: 400 });
    }
    const parsed = TableTypeSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ success: false, error: 'Le type de table est illisible : rechargez la page et réessayez.', code: 'INVALID_INPUT' }, { status: 400 });
    }
    try {
        const outcome = outcomeOf(await callTables('event_table_type_save', { event_id: g.eventId, actor_id: g.userId, type_id: g.typeId, type: parsed.data }));
        if (outcome.status === 200) invalidatePublicEvent(g.eventId, 'type de table modifié');
        return NextResponse.json(outcome.body, { status: outcome.status });
    } catch (err) {
        console.error('[API partner table types PATCH]', err instanceof Error ? err.message : String(err));
        return NextResponse.json({ success: false, error: 'Modification du type de table impossible pour le moment.', code: 'TABLE_TYPE_SAVE_FAILED' }, { status: 500 });
    }
}

/** DELETE : type sans vente ni attente, supprimé avec ses tables ; sinon 409 CATEGORY_HAS_SALES (arrêter la vente). */
export async function DELETE(request: NextRequest, ctx: Ctx) {
    const g = await guard(request, ctx);
    if ('response' in g) return g.response;
    try {
        const outcome = outcomeOf(await callTables('event_table_type_delete', { event_id: g.eventId, actor_id: g.userId, type_id: g.typeId }));
        if (outcome.status === 200) invalidatePublicEvent(g.eventId, 'type de table supprimé');
        return NextResponse.json(outcome.body, { status: outcome.status });
    } catch (err) {
        console.error('[API partner table types DELETE]', err instanceof Error ? err.message : String(err));
        return NextResponse.json({ success: false, error: 'Suppression du type de table impossible pour le moment.', code: 'TABLE_TYPE_DELETE_FAILED' }, { status: 500 });
    }
}
