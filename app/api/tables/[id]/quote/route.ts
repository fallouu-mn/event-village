import { NextRequest, NextResponse } from 'next/server';
import { guardFeature } from '@/lib/features/flags';
import { UUID_RE, venueQuote } from '@/lib/tables/queries';
import { badRequest, intParam, notFound, tableFailure } from '@/lib/tables/route-helpers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/tables/[id]/quote?guests= — devis affiché avant de réserver : acompte par personne × personnes, frais de
 * service, total, confirmation (immédiate ou sur acceptation), règles (attente du paiement, délai de réponse,
 * annulation gratuite, garde de la table). Lot 11b (point 1) : table_quote en base, même calcul que table_reserve ;
 * l'écran n'additionne rien. Interrupteur d'abord.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const closed = await guardFeature('tables', 'GET /api/tables/[id]/quote');
        if (closed) return closed;
        const { id } = await params;
        if (!UUID_RE.test(id)) return notFound('Cet établissement n’existe pas ou n’est plus proposé.', 'VENUE_NOT_FOUND');
        const guests = intParam(req.nextUrl.searchParams.get('guests'));
        if (guests === null || Number.isNaN(guests)) return badRequest('Indiquez un nombre de personnes entre 1 et 50.', 'INVALID_GUESTS');
        const quote = await venueQuote(id, guests);
        return NextResponse.json({ success: true, quote }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (err: unknown) {
        return tableFailure('GET /api/tables/[id]/quote', err, { message: 'Devis momentanément indisponible.', code: 'QUOTE_UNAVAILABLE', status: 500 });
    }
}
