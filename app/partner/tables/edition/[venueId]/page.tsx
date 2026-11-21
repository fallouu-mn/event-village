import { VenueEditView } from '@/components/tables/editor/VenueEditView';

/**
 * Lot 11b : modification d'un établissement par sa propriétaire. L'établissement est lu dans le navigateur
 * (GET /api/partner/venues/[id], propriété vérifiée par la route) puis modifié par le formulaire commun (PATCH) ; zones
 * et tables par les routes /api/partner/tables. Garde de l'interrupteur : app/partner/tables/edition/layout.tsx.
 */
export const dynamic = 'force-dynamic';

export default async function EditVenuePage({ params }: { params: Promise<{ venueId: string }> }) {
    const { venueId } = await params;
    return <VenueEditView venueId={venueId} />;
}
