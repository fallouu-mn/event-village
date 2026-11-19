import { headers } from 'next/headers';
import { NextRequest } from 'next/server';
import { GET as listMyTickets } from '@/app/api/tickets/route';
import { TicketsView, type MyTicket } from './TicketsView';
import { TABS, type TabKey } from './tabs';

/**
 * Mes billets — décision du 19/11 (temps de blocage de la page) : liste lue par le serveur. La page appelle la route
 * GET /api/tickets elle-même, avec les cookies et en-têtes de la requête reçue : mêmes règles de session (compte actif,
 * code de l'administration), même lecture, aucune logique recopiée. Réponse personnelle : page rendue à chaque requête
 * (jamais préparée ni mise en cache ; le service worker ne garde jamais /tickets, réseau seulement). Sans session ou en
 * cas d'échec, la liste se charge dans le navigateur comme avant (TicketsView).
 * Run 426 : la page n'attend plus la liste ; l'en-tête et le squelette partent aussitôt et la liste suit dans la même réponse
 * (promesse transmise à TicketsView), sans aller-retour du navigateur vers /api/tickets.
 */
export const dynamic = 'force-dynamic';

async function readTicketsOnServer(): Promise<MyTicket[] | null> {
    try {
        const h = await headers();
        if (!h.get('cookie')) return null;
        const host = h.get('x-forwarded-host') ?? h.get('host');
        if (!host) return null;
        const proto = h.get('x-forwarded-proto') ?? 'http';
        const res = await listMyTickets(new NextRequest(`${proto}://${host}/api/tickets`, { headers: new Headers(h) }));
        if (!res.ok) return null;
        const body = (await res.json()) as { tickets?: unknown };
        return Array.isArray(body.tickets) ? (body.tickets as MyTicket[]) : null;
    } catch (err) {
        console.error('[Mes billets] liste non préparée par le serveur (lue dans le navigateur) :', err instanceof Error ? err.message : String(err));
        return null;
    }
}

export default async function TicketsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    const params = await searchParams;
    const tab = typeof params.tab === 'string' && (TABS as readonly string[]).includes(params.tab) ? (params.tab as TabKey) : undefined;
    const ticketsPromise = readTicketsOnServer(); // non attendue : envoyée dans la même réponse
    return <TicketsView ticketsPromise={ticketsPromise} initialTab={tab} serverNow={Date.now()} />;
}
