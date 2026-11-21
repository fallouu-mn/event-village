import { redirect } from 'next/navigation';

/**
 * Lot 11b : ancienne page de réservation d'une table (lot 11a : elle ne correspondait plus aux routes). Elle mène
 * désormais à la fiche de l'établissement (/tables/<id>) quand l'identifiant est celui d'un établissement, sinon à la
 * recherche des établissements (/tables) ; l'entrée « Restaurants et tables » du menu y arrive.
 */
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function FormerTablesPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    redirect(UUID.test(id) ? `/tables/${id}` : '/tables');
}
