import { NextRequest, NextResponse } from 'next/server';
import { callTables, isUuid, outcomeOf } from '@/lib/event-tables/event-tables.server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/events/[id]/tables — lot 11c-a : offre de tables de la fiche d'un événement, sans session.
 * Types en vente (prix de la table, prix par personne, frais, total, places, ce qui est compris, minimum sur place en
 * texte, tables restantes vraies), et, si l'organisatrice montre le plan, ses tables (LIBRE ou PRISE) et ses zones
 * (event_table_offer). Service fermé ou aucun type en vente : open false, listes vides. Lecture fraîche à chaque appel
 * (no-store) : l'écran la relit au signal temps réel du stock du type (public_category_stock, existant) pour griser
 * aussitôt une table qui vient d'être prise. read_at : heure de la lecture en base. Aucune donnée personnelle.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id: eventId } = await params;
    if (!isUuid(eventId)) return NextResponse.json({ success: false, error: 'Événement introuvable.', code: 'EVENT_NOT_FOUND' }, { status: 404 });
    try {
        const outcome = outcomeOf(await callTables('event_table_offer', { event_id: eventId }));
        return NextResponse.json(outcome.body, { status: outcome.status, headers: { 'Cache-Control': 'no-store' } });
    } catch (err) {
        console.error('[API event tables GET]', err instanceof Error ? err.message : String(err));
        return NextResponse.json({ success: false, error: 'Les tables ne peuvent pas être affichées pour le moment.', code: 'TABLES_UNAVAILABLE' }, { status: 500 });
    }
}
