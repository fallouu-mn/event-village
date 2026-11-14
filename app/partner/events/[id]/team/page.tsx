import { redirect } from 'next/navigation';

/**
 * Lot 5 (contrat I) — l'équipe d'un événement est un onglet de la page de pilotage. Les liens et favoris
 * vers l'ancienne page aboutissent à l'onglet Équipe.
 */
export default async function PartnerEventTeamRedirect(props: { params: Promise<{ id: string }> }) {
 const params = await props.params;
 redirect(`/partner/events/${encodeURIComponent(params.id)}?tab=equipe`);
}
