import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession, serverIsPartner } from '@/lib/auth/session';
import { invalidatePublicEvent } from '@/lib/events/public-cache.server';
import { callTables, isUuid, outcomeOf, TableTypeCreateSchema } from '@/lib/event-tables/event-tables.server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/partner/events/[id]/tables/types — lot 11c-a : nouveau type de table (« Table VIP, 6 places, 150 000 F »)
 * avec ses N tables, numérotées sur les plus petits numéros libres de l'événement (event_table_type_save). Corps
 * { type: { name, seats, price, included_text, onsite_note, payment_mode, sale_start, sale_end, is_active, scan_color,
 * entry_instruction }, count } ; tout est contrôlé en base (places 2 à 20, prix entier, jauge en places, seul le paiement
 * en entier, nom unique, garde de la billetterie). 201 `{ success, type, tables }`.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await requireActiveSession(request);
    if (session.response) return session.response;
    if (!serverIsPartner(session.user)) {
        return NextResponse.json({ success: false, error: 'Accès réservé aux organisateurs.', code: 'FORBIDDEN' }, { status: 403 });
    }
    const { id: eventId } = await params;
    if (!isUuid(eventId)) return NextResponse.json({ success: false, error: 'Événement introuvable.', code: 'EVENT_NOT_FOUND' }, { status: 404 });
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ success: false, error: 'Corps de requête illisible (JSON attendu).', code: 'INVALID_BODY' }, { status: 400 });
    }
    const parsed = TableTypeCreateSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ success: false, error: 'Le type de table est illisible : rechargez la page et réessayez.', code: 'INVALID_INPUT' }, { status: 400 });
    }
    try {
        const outcome = outcomeOf(await callTables('event_table_type_save', {
            event_id: eventId, actor_id: session.user.id, type: parsed.data.type, count: parsed.data.count,
        }), 201);
        if (outcome.status === 201) invalidatePublicEvent(eventId, 'type de table ajouté');
        return NextResponse.json(outcome.body, { status: outcome.status });
    } catch (err) {
        console.error('[API partner table types POST]', err instanceof Error ? err.message : String(err));
        return NextResponse.json({ success: false, error: 'Ajout du type de table impossible pour le moment.', code: 'TABLE_TYPE_SAVE_FAILED' }, { status: 500 });
    }
}
