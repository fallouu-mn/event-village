import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { RetryError } from '@/components/halls/client/RetryError';
import { TicketsFocusView } from '@/components/tickets/TicketsFocusView';
import { PageHeader } from '@/components/ui/PageHeader';
import { readTicketsFocus } from '../../focus-read';

/**
 * Finition 5 (point 2) — billets du compte pour un événement : page d'arrivée des avis d'un achat, d'une invitation, d'un
 * rappel, d'une annulation ou d'un remboursement (avis qui portent l'événement, parfois plusieurs billets). Sans session :
 * connexion puis retour ici. Aucun billet du compte pour cet événement (ou identifiant deviné) : même 404 « Cet élément
 * n'est plus disponible » (./not-found.tsx).
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Mes billets pour cet événement — Event Village' };

export default async function MyEventTicketsPage({ params }: { params: Promise<{ eventId: string }> }) {
    const { eventId } = await params;
    const read = await readTicketsFocus({ event: eventId });
    if (read.kind === 'login') redirect(`/login?redirect=${encodeURIComponent(`/tickets/evenement/${eventId}`)}`);
    if (read.kind === 'not-found') notFound();
    if (read.kind === 'error') {
        return (
            <div className="space-y-2">
                <PageHeader title="Mes billets" back={{ href: '/tickets', label: 'Tous mes billets' }} />
                <RetryError title="Vos billets n’ont pas pu être chargés" description={read.message} />
            </div>
        );
    }
    const t = read.tickets[0];
    const n = read.tickets.length;
    return (
        <TicketsFocusView
            tickets={read.tickets}
            title={t.eventTitle}
            description={`${n > 1 ? `Vos ${n} billets` : 'Votre billet'} · ${t.dateFormatted} à ${t.timeFormatted}, ${t.venue}. Présentez le QR code à l’entrée : il se renouvelle tout seul.`}
            serverNow={Date.now()}
        />
    );
}
