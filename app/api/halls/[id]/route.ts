import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { guardFeature } from '@/lib/features/flags';
import { publicHall } from '@/lib/halls/queries';
import { notFound } from '@/lib/halls/route-helpers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/halls/[id] — fiche publique d'une salle.
 * Lot 10b (point 2) : galerie, capacité, équipements, position, prix au jour et à l'heure, acompte, règle d'annulation
 * (texte affiché avant de payer) ; salle active, validée, d'une partenaire VALIDE, avec un prix ; sinon 404. Colonnes
 * publiques seulement : ni réservation, ni client, ni contact de la partenaire.
 * Lot 7 (7.3, D11, D56) : GET public, interrupteur d'abord (404 si le service est fermé).
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const closed = await guardFeature('halls', 'GET /api/halls/[id]');
        if (closed) return closed;
        const { id } = await params;
        const hall = await publicHall(id);
        if (!hall) return notFound('Cette salle n’existe pas ou n’est plus proposée.', 'HALL_NOT_FOUND');
        return NextResponse.json({ success: true, hall });
    } catch (err: unknown) {
        return apiFailure('GET /api/halls/[id]', err, { message: 'Salle momentanément indisponible.', code: 'HALL_UNAVAILABLE', status: 500 });
    }
}
