import { NextRequest, NextResponse } from 'next/server';
import { guardFeature } from '@/lib/features/flags';
import { publicVenue } from '@/lib/tables/queries';
import { notFound, tableFailure } from '@/lib/tables/route-helpers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/tables/[id] — fiche publique d'un établissement : photos, horaires, zones, capacité, plan de salle (s'il est
 * montré), acompte par personne, confirmation, règles de la base (attente, réponse, annulation gratuite, absence),
 * fermetures exceptionnelles à venir (dates seules). Lot 11b (point 1) : actif, validé, partenaire VALIDE ; sinon 404
 * sans indice. Interrupteur d'abord ; aucune réservation, aucune donnée personnelle.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const closed = await guardFeature('tables', 'GET /api/tables/[id]');
        if (closed) return closed;
        const { id } = await params;
        const venue = await publicVenue(id);
        if (!venue) return notFound('Cet établissement n’existe pas ou n’est plus proposé.', 'VENUE_NOT_FOUND');
        return NextResponse.json({ success: true, venue }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (err: unknown) {
        return tableFailure('GET /api/tables/[id]', err, { message: 'Établissement momentanément indisponible.', code: 'VENUE_UNAVAILABLE', status: 500 });
    }
}
