import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession, serverIsPartner } from '@/lib/auth/session';
import { DAY_RE, planning } from '@/lib/tables/queries';
import { badRequest, notFound, tableFailure } from '@/lib/tables/route-helpers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/partner/venues/[id]/planning?date=AAAA-MM-JJ — planning d'un jour (lu par l'écran toutes les 20 secondes,
 * « en direct ») : tables (et positions du plan), réservations du jour (heure, personnes, table, état en mots, prénom du
 * client et son téléphone seulement pour une réservation qui tient la table, « J'arrive », table gardée jusqu'à…),
 * demandes à accepter (tous les jours, avec leur échéance), fermetures du jour, heure du serveur.
 * Lot 11b (point 2) : seulement la propriétaire ; sinon 404. Lecture ouverte même service fermé (réservations existantes).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await requireActiveSession(request);
        if (session.response) return session.response;
        if (!serverIsPartner(session.user)) return NextResponse.json({ error: 'Réservé aux partenaires.' }, { status: 403 });
        const { id } = await params;
        const date = request.nextUrl.searchParams.get('date') ?? new Date().toISOString().slice(0, 10);
        if (!DAY_RE.test(date)) return badRequest('Choisissez un jour valable.');
        const day = await planning(session.user.id, id, date);
        if (!day) return notFound('Établissement introuvable.', 'VENUE_NOT_FOUND');
        return NextResponse.json({ success: true, ...day }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error: unknown) {
        return tableFailure('GET /api/partner/venues/[id]/planning', error, { message: 'Planning momentanément indisponible.', code: 'PLANNING_UNAVAILABLE', status: 500 });
    }
}
