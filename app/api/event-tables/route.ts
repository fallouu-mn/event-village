import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession } from '@/lib/auth/session';
import { getServerEnv } from '@/lib/env';
import { callTables, outcomeOf, whatsappShareUrl } from '@/lib/event-tables/event-tables.server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/event-tables — lot 11c-a : « Mes tables » du compte connecté (titulaire) : par table, l'événement, le type,
 * la zone, les places (envoyées, en attente, à envoyer, entrées, prénoms des invités), la fenêtre de remboursement en
 * cas de report, et un lien de partage WhatsApp sans aucun jeton (event_table_mine).
 */
export async function GET(request: NextRequest) {
    const session = await requireActiveSession(request);
    if (session.response) return session.response;
    try {
        const reply = await callTables('event_table_mine', { actor_id: session.user.id });
        const outcome = outcomeOf(reply);
        if (outcome.status === 200 && Array.isArray(reply.items)) {
            const appUrl = getServerEnv().NEXT_PUBLIC_APP_URL;
            outcome.body.items = (reply.items as Array<Record<string, unknown>>).map((item) => ({ ...item, whatsapp_url: whatsappShareUrl(appUrl, item) }));
        }
        return NextResponse.json(outcome.body, { status: outcome.status, headers: { 'Cache-Control': 'no-store' } });
    } catch (err) {
        console.error('[API event-tables GET]', err instanceof Error ? err.message : String(err));
        return NextResponse.json({ success: false, error: 'Vos tables ne peuvent pas être affichées pour le moment.', code: 'TABLES_UNAVAILABLE' }, { status: 500 });
    }
}
