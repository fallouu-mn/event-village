/**
 * Finition 5 (point 2) — lecture par le serveur des billets d'une page d'arrivée d'avis (`/tickets/<id>` : un billet, ou
 * les billets du compte pour un événement). Modèle d'app/tickets/page.tsx : la page appelle GET /api/tickets elle-même avec
 * les cookies et en-têtes de la requête reçue (mêmes règles de session, même lecture). Sans session : connexion puis retour ;
 * rien du compte sous cet identifiant : introuvable (même réponse pour un identifiant deviné ou d'un autre compte) ;
 * panne : message simple.
 */
import { headers } from 'next/headers';
import { NextRequest } from 'next/server';
import { GET as listMyTickets } from '@/app/api/tickets/route';
import { isObjectId, ticketsInFocus } from '@/lib/tickets/focus';
import type { MyTicket } from './TicketsView';

export type FocusRead =
    | { kind: 'ok'; focus: 'ticket' | 'event'; tickets: MyTicket[] }
    | { kind: 'login' }
    | { kind: 'not-found' }
    | { kind: 'error'; message: string };

const GENERIC = 'Vos billets n’ont pas pu être chargés. Vérifiez votre connexion, puis réessayez.';

/** Billet du compte qui porte `id`, sinon billets du compte pour l'événement `id`, sinon introuvable. */
export async function readTicketsFocus(id: string): Promise<FocusRead> {
    if (!isObjectId(id)) return { kind: 'not-found' };
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
        const list = body.tickets as MyTicket[];
        const ticket = ticketsInFocus(list, { ticket: id });
        if (ticket) return { kind: 'ok', focus: 'ticket', tickets: ticket };
        const ofEvent = ticketsInFocus(list, { event: id });
        return ofEvent ? { kind: 'ok', focus: 'event', tickets: ofEvent } : { kind: 'not-found' };
    } catch (err) {
        console.error('[Page d’arrivée des billets] lecture impossible :', err instanceof Error ? err.message : String(err));
        return { kind: 'error', message: GENERIC };
    }
}
