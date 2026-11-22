import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession } from '@/lib/auth/session';
import { withdrawalOfCashout } from '@/lib/finance/ledger';
import { isObjectId, UNAVAILABLE_BODY } from '@/lib/tickets/focus';

export const dynamic = 'force-dynamic';

/**
 * Finition 5 (point 2) — GET /api/finance/withdrawals/<envoi> : un retrait du compte de la session, retrouvé par l'envoi
 * (cashout_id) que portent les avis WITHDRAWAL_* ; page d'arrivée /partner/finance/retraits/<envoi> ou
 * /wallet/retraits/<envoi>. Identifiant mal formé, envoi inconnu ou retrait d'un autre compte : même 404 « Cet élément
 * n'est plus disponible », aucun indice. Sans session : 401.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await requireActiveSession(req);
    if (session.response) return session.response;
    const { id } = await params;
    const notAvailable = () => NextResponse.json(UNAVAILABLE_BODY, { status: 404, headers: { 'Cache-Control': 'private, no-store' } });
    if (!isObjectId(id)) return notAvailable();
    try {
        const withdrawal = await withdrawalOfCashout(session.user.id, id);
        if (!withdrawal) return notAvailable();
        return NextResponse.json({ withdrawal }, { headers: { 'Cache-Control': 'private, no-store' } });
    } catch (err) {
        console.error(`[API /api/finance/withdrawals/[id]] envoi ${id} du compte ${session.user.id} :`, err instanceof Error ? err.message : String(err));
        return NextResponse.json({ error: 'Ce retrait est momentanément indisponible. Réessayez dans un instant.' }, { status: 500 });
    }
}
