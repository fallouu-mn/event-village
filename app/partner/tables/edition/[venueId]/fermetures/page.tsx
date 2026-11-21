import { ClosuresView } from '@/components/tables/editor/ClosuresView';

/**
 * Lot 11b : fermetures exceptionnelles d'un établissement (liste des fermetures à venir, aperçu des réservations
 * touchées, confirmation). Lecture GET /api/partner/venues/[id] ; aperçu et création POST /api/partner/venues/[id]/closures ;
 * retrait DELETE /api/partner/venues/closures/[id]. Garde de l'interrupteur : app/partner/tables/edition/layout.tsx.
 */
export const dynamic = 'force-dynamic';

export default async function VenueClosuresPage({ params }: { params: Promise<{ venueId: string }> }) {
    const { venueId } = await params;
    return <ClosuresView venueId={venueId} />;
}
