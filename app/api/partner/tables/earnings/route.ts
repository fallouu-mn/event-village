import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession, serverIsPartner } from '@/lib/auth/session';
import { partnerEarnings } from '@/lib/tables/queries';
import { tableFailure } from '@/lib/tables/route-helpers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/partner/tables/earnings — recettes des établissements de la partenaire (acomptes encaissés, lus dans le grand
 * livre : disponibles, à venir 48 h après la fin du créneau). Lot 11b (point 2) : table_partner_earnings en base ; aucun
 * montant calculé ici. Le paiement sur place n'y figure jamais (jamais encaissé par Event Village). Lecture ouverte même
 * service fermé.
 */
export async function GET(request: NextRequest) {
    try {
        const session = await requireActiveSession(request);
        if (session.response) return session.response;
        if (!serverIsPartner(session.user)) return NextResponse.json({ error: 'Réservé aux partenaires.' }, { status: 403 });
        const earnings = await partnerEarnings(session.user.id);
        return NextResponse.json({ success: true, ...earnings });
    } catch (error: unknown) {
        return tableFailure('GET /api/partner/tables/earnings', error, { message: 'Recettes momentanément indisponibles.', code: 'EARNINGS_UNAVAILABLE', status: 500 });
    }
}
