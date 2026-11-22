/**
 * Finition 5 (point 2) — lecture par le serveur des billets d'une page d'arrivée d'avis (un billet, ou les billets du compte
 * pour un événement). Modèle d'app/tickets/page.tsx : la page appelle GET /api/tickets elle-même avec les cookies et en-têtes
 * de la requête reçue (mêmes règles de session, même lecture). Sans session : connexion puis retour ; rien de visé dans les
 * billets du compte : introuvable (même 404 pour un identifiant deviné ou d'un autre compte) ; panne : message simple.
 */
import { headers } from 'next/headers';
import { NextRequest } from 'next/server';
import { GET as listMyTickets } from '@/app/api/tickets/route';
import { isObjectId, ticketsInFocus, type TicketFocus } from '@/lib/tickets/focus';
import type { MyTicket } from './TicketsView';

export type FocusRead = { kind: 'ok'; tickets: MyTicket[] } | { kind: 'login' } | { kind: 'not-found' } | { kind: 'error'; message: string };

const GENERIC = 'Vos billets n’ont pas pu être chargés. Vérifiez votre connexion, puis réessayez.';

export async function readTicketsFocus(focus: TicketFocus): Promise<FocusRead> {
    if (!isObjectId('ticket' in focus ? focus.ticket : focus.event)) return { kind: 'not-found' };
    try {
        const h = await headers();
        if (!h.get('cookie')) return { kind: 'login' };
        const host = h.get('x-forwarded-host') ?? h.get('host');
        if (!host) return { kind: 'error', message: GENERIC };
        const proto = h.get('x-forwarded-proto') ?? 'http';
        const res = await listMyTickets(new NextRequest(`${proto}://${host}/api/tickets`, { headers: new Headers(h) }));
        if (res.status === 401) return { kind: 'login' };
        const body = (await res.json().catch(() => null)) as { tickets?: unknown; error?: unknown } | null;
        if (!res.ok || !body || !Array.isArray(body.tickets)) {
            return { kind: 'error', message: typeof body?.error === 'string' && body.error.trim() ? body.error : GENERIC };
        }
        const found = ticketsInFocus(body.tickets as MyTicket[], focus);
        return found ? { kind: 'ok', tickets: found } : { kind: 'not-found' };
    } catch (err) {
        console.error('[Page d’arrivée des billets] lecture impossible :', err instanceof Error ? err.message : String(err));
        return { kind: 'error', message: GENERIC };
    }
}
