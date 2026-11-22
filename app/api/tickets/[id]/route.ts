import { NextRequest, NextResponse } from 'next/server';
import { GET as listMyTickets } from '@/app/api/tickets/route';
import { isObjectId, ticketsInFocus, UNAVAILABLE_BODY } from '@/lib/tickets/focus';

export const dynamic = 'force-dynamic';

/**
 * Finition 5 (point 2) — GET /api/tickets/<billet> : un billet du compte de la session, pour la page d'arrivée d'un avis
 * (/tickets/<billet>). Même lecture que la liste (GET /api/tickets : même session, mêmes règles, aucune logique
 * recopiée), puis le billet est cherché parmi ceux du compte. Identifiant mal formé, inconnu ou billet d'un autre compte :
 * même réponse 404 « Cet élément n'est plus disponible » (UNAVAILABLE_BODY), aucun indice. Sans session : 401 de la liste.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const notAvailable = () => NextResponse.json(UNAVAILABLE_BODY, { status: 404, headers: { 'Cache-Control': 'private, no-store' } });
    if (!isObjectId(id)) return notAvailable();
    const res = await listMyTickets(new NextRequest(new URL('/api/tickets', req.url), { headers: req.headers }));
    if (!res.ok) return res;
    const body = (await res.json()) as { tickets?: unknown };
    const list = Array.isArray(body.tickets) ? (body.tickets as Array<{ id: string; eventId: string }>) : null;
    if (!list) {
        console.error('[API /api/tickets/[id]] liste des billets sans tableau « tickets »');
        return NextResponse.json({ error: 'Impossible de charger ce billet.' }, { status: 500 });
    }
    const found = ticketsInFocus(list, { ticket: id });
    if (!found) return notAvailable();
    return NextResponse.json({ ticket: found[0] }, { headers: { 'Cache-Control': 'private, no-store' } });
}
