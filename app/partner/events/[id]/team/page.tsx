import { redirect } from 'next/navigation';

/**
 * Lot 5 (contrat I) — l'équipe d'un événement est un onglet de la page de pilotage. Les liens et favoris
 * vers l'ancienne page aboutissent à l'onglet Équipe.
 */
export default function PartnerEventTeamRedirect({ params }: { params: { id: string } }) {
    redirect(`/partner/events/${encodeURIComponent(params.id)}?tab=equipe`);
}
