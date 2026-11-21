/**
 * Lot 11b (écrans du client) : lecture par le serveur des réservations de table du compte. La page appelle la route
 * GET elle-même, avec les cookies et en-têtes de la requête reçue (même modèle que les salles,
 * app/halls/reservations/read-on-server.ts) : mêmes règles de session, même lecture, aucune logique recopiée. Sans
 * session : renvoi vers la connexion ; réservation d'un autre compte ou inconnue : introuvable ; autre refus : message
 * de la route ; panne : message simple.
 */
import { headers } from 'next/headers';
import { NextRequest } from 'next/server';

export type ServerRead<T> =
    | { kind: 'ok'; data: T }
    | { kind: 'login' }
    | { kind: 'not-found' }
    | { kind: 'error'; message: string };

const GENERIC = 'Vos réservations n’ont pas pu être chargées. Vérifiez votre connexion, puis réessayez.';

export async function readOnServer<T>(
    path: string,
    handler: (req: NextRequest) => Promise<Response>,
    pick: (body: Record<string, unknown>) => T | null,
): Promise<ServerRead<T>> {
    try {
        const h = await headers();
        if (!h.get('cookie')) return { kind: 'login' };
        const host = h.get('x-forwarded-host') ?? h.get('host');
        if (!host) return { kind: 'error', message: GENERIC };
        const proto = h.get('x-forwarded-proto') ?? 'http';
        const res = await handler(new NextRequest(`${proto}://${host}${path}`, { headers: new Headers(h) }));
        if (res.status === 401) return { kind: 'login' };
        if (res.status === 404) return { kind: 'not-found' };
        const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
        if (!res.ok || !body) {
            const message = typeof body?.error === 'string' && body.error.trim() ? body.error : GENERIC;
            return { kind: 'error', message };
        }
        const data = pick(body);
        return data === null ? { kind: 'error', message: GENERIC } : { kind: 'ok', data };
    } catch (err) {
        console.error('[Mes réservations de table] lecture impossible :', err instanceof Error ? err.message : String(err));
        return { kind: 'error', message: GENERIC };
    }
}
