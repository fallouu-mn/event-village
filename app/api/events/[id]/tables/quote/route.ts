import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { callTables, isUuid, outcomeOf } from '@/lib/event-tables/event-tables.server';

export const dynamic = 'force-dynamic';

const QuoteSchema = z.object({
    typeId: z.string().uuid(),
    tableId: z.string().uuid().nullable().optional(),
    operator: z.enum(['WAVE', 'ORANGE_MONEY']).nullable().optional(),
}).strict();

/**
 * POST /api/events/[id]/tables/quote — lot 11c-a : devis d'une table, sans session (comme /api/checkout/quote) :
 * prix de la table, prix par personne, frais de service, total, places, état de la table choisie (event_table_quote,
 * moteur financier unique). Aucun montant n'est lu du corps.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id: eventId } = await params;
    if (!isUuid(eventId)) return NextResponse.json({ success: false, error: 'Événement introuvable.', code: 'EVENT_NOT_FOUND' }, { status: 404 });
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ success: false, error: 'Corps de requête illisible (JSON attendu).', code: 'INVALID_BODY' }, { status: 400 });
    }
    const parsed = QuoteSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ success: false, error: 'Choix de table illisible : rechargez la page et réessayez.', code: 'INVALID_INPUT' }, { status: 400 });
    try {
        const outcome = outcomeOf(await callTables('event_table_quote', {
            event_id: eventId, type_id: parsed.data.typeId, table_id: parsed.data.tableId ?? null, operator: parsed.data.operator ?? null,
        }));
        return NextResponse.json(outcome.body, { status: outcome.status, headers: { 'Cache-Control': 'no-store' } });
    } catch (err) {
        console.error('[API event tables quote]', err instanceof Error ? err.message : String(err));
        return NextResponse.json({ success: false, error: 'Le prix ne peut pas être calculé pour le moment.', code: 'QUOTE_UNAVAILABLE' }, { status: 500 });
    }
}
