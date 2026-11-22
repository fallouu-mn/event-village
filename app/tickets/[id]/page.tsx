import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { RetryError } from '@/components/halls/client/RetryError';
import { TicketsFocusView } from '@/components/tickets/TicketsFocusView';
import { PageHeader } from '@/components/ui/PageHeader';
import { readTicketsFocus } from '../focus-read';

/**
 * Finition 5 (point 2) — un billet du compte : page d'arrivée des avis qui portent un billet (transfert reçu ou rendu,
 * billet contrôlé, annulé, remboursé…). Sans session : connexion puis retour ici. Billet inconnu, d'un autre compte ou
 * identifiant mal formé : même 404 « Cet élément n'est plus disponible » (./not-found.tsx), aucun indice.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Mon billet — Event Village' };

export default async function MyTicketPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const read = await readTicketsFocus({ ticket: id });
    if (read.kind === 'login') redirect(`/login?redirect=${encodeURIComponent(`/tickets/${id}`)}`);
    if (read.kind === 'not-found') notFound();
    if (read.kind === 'error') {
        return (
            <div className="space-y-2">
                <PageHeader title="Mon billet" back={{ href: '/tickets', label: 'Tous mes billets' }} />
                <RetryError title="Votre billet n’a pas pu être chargé" description={read.message} />
            </div>
        );
    }
    const t = read.tickets[0];
    return (
        <TicketsFocusView
            tickets={read.tickets}
            title="Mon billet"
            description={`${t.eventTitle} · ${t.dateFormatted}. Présentez le QR code à l’entrée : il se renouvelle tout seul.`}
            serverNow={Date.now()}
        />
    );
}
