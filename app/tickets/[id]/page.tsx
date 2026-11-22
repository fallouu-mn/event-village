import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { RetryError } from '@/components/halls/client/RetryError';
import { TicketsFocusView } from '@/components/tickets/TicketsFocusView';
import { PageHeader } from '@/components/ui/PageHeader';
import { UnavailableItem } from '@/components/ui/UnavailableItem';
import { readTicketsFocus } from '../focus-read';

/**
 * Finition 5 (point 2) — page d'arrivée des avis sur un billet. `/tickets/<id>` ouvre :
 *  - le billet du compte qui porte cet identifiant (transfert reçu ou rendu, billet contrôlé, annulé, remboursé…) ;
 *  - sinon, les billets du compte pour l'événement qui porte cet identifiant (achat, invitation, rappel, annulation,
 *    remboursement : plusieurs billets possibles). Une seule route pour les deux (poids du moteur de chargement : chaque
 *    page ajoute une entrée commune à toutes les routes, budgets JS non relevés).
 * Sans session : connexion puis retour ici. Rien du compte sous cet identifiant (billet d'autrui, deviné, transféré,
 * supprimé, identifiant mal formé) : page « Cet élément n'est plus disponible », la même dans tous les cas (aucun indice),
 * rendue ici plutôt que par un fichier not-found (même raison de poids).
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Mon billet — Event Village', robots: { index: false } };

export default async function MyTicketPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const read = await readTicketsFocus(id);
    if (read.kind === 'login') redirect(`/login?redirect=${encodeURIComponent(`/tickets/${id}`)}`);
    if (read.kind === 'not-found') return <UnavailableItem actionLabel="Voir mes billets" actionHref="/tickets" />;
    if (read.kind === 'error') {
        return (
            <div className="space-y-2">
                <PageHeader title="Mes billets" back={{ href: '/tickets', label: 'Tous mes billets' }} />
                <RetryError title="Vos billets n’ont pas pu être chargés" description={read.message} />
            </div>
        );
    }
    const t = read.tickets[0];
    if (read.focus === 'ticket') {
        return (
            <TicketsFocusView
                tickets={read.tickets}
                title="Mon billet"
                description={`${t.eventTitle} · ${t.dateFormatted}. Présentez le QR code à l’entrée : il se renouvelle tout seul.`}
                serverNow={Date.now()}
            />
        );
    }
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
