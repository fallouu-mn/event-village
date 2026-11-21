import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession, serverIsPartner } from '@/lib/auth/session';
import { TableService } from '@/lib/tables/table.service';
import { guardFeature } from '@/lib/features/flags';
import { tableFailure } from '@/lib/tables/route-helpers';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/partner/venues/closures/[id] — retire une fermeture exceptionnelle pas encore finie : l'établissement
 * redevient réservable sur la période ; les réservations annulées le restent. Lot 11b (point 2) : venue_closure_delete en
 * base (propriétaire, compte ACTIF, fiche VALIDE) ; fermeture d'un autre établissement : 404 sans indice. Service fermé : 404.
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await requireActiveSession(request);
        if (session.response) return session.response;
        const closed = await guardFeature('tables', 'DELETE /api/partner/venues/closures/[id]');
        if (closed) return closed;
        if (!serverIsPartner(session.user)) return NextResponse.json({ error: 'Réservé aux partenaires.' }, { status: 403 });
        const { id } = await params;
        await TableService.removeClosure(session.user.id, id);
        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        return tableFailure('DELETE /api/partner/venues/closures/[id]', error, { message: 'Fermeture non retirée. Réessayez.', code: 'CLOSURE_DELETE_FAILED' });
    }
}
