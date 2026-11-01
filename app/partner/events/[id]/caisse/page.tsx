import { redirect } from 'next/navigation';

/**
 * Lot 5 (contrat I) — la caisse d'un événement (sessions, écarts, PIN régisseur) est un onglet de la page
 * de pilotage. Les liens et favoris vers l'ancienne page aboutissent à l'onglet Caisse.
 */
export default function PartnerEventCaisseRedirect({ params }: { params: { id: string } }) {
    redirect(`/partner/events/${encodeURIComponent(params.id)}?tab=caisse`);
}
