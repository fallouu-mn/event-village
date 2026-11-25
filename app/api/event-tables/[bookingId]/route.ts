import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession } from '@/lib/auth/session';
import { getServerEnv } from '@/lib/env';
import { callTables, isUuid, outcomeOf, whatsappShareUrl } from '@/lib/event-tables/event-tables.server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/event-tables/[bookingId] — lot 11c-a : « Ma table » (titulaire seulement ; une table d'un autre compte : 404
 * sans indice) : places, invités en prénom et initiale, remboursement possible après un report, partage WhatsApp.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ bookingId: string }> }) {
    const session = await requireActiveSession(request);
    if (session.response) return session.response;
    const { bookingId } = await params;
    if (!isUuid(bookingId)) return NextResponse.json({ success: false, error: 'Table introuvable.', code: 'NOT_FOUND' }, { status: 404 });
    try {
        const reply = await callTables('event_table_mine', { actor_id: session.user.id, booking_id: bookingId });
        const outcome = outcomeOf(reply);
        if (outcome.status === 200 && Array.isArray(reply.items)) {
            const item = (reply.items as Array<Record<string, unknown>>)[0];
            outcome.body = { success: true, table: { ...item, whatsapp_url: whatsappShareUrl(getServerEnv().NEXT_PUBLIC_APP_URL, item) } };
        }
        return NextResponse.json(outcome.body, { status: outcome.status, headers: { 'Cache-Control': 'no-store' } });
    } catch (err) {
        console.error('[API event-tables/[bookingId] GET]', err instanceof Error ? err.message : String(err));
        return NextResponse.json({ success: false, error: 'Votre table ne peut pas être affichée pour le moment.', code: 'TABLES_UNAVAILABLE' }, { status: 500 });
    }
}
