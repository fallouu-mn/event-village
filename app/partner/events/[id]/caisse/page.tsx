import { redirect } from 'next/navigation';

/**
 * Lot 5 (contrat I) — la caisse d'un événement (sessions, écarts, PIN régisseur) est un onglet de la page
 * de pilotage. Les liens et favoris vers l'ancienne page aboutissent à l'onglet Caisse.
 */
export default async function PartnerEventCaisseRedirect(props: { params: Promise<{ id: string }> }) {
 const params = await props.params;
 redirect(`/partner/events/${encodeURIComponent(params.id)}?tab=caisse`);
}
