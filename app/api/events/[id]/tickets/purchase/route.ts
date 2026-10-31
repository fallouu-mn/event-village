import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Lot 2.8 — route désactivée. /api/events/[id]/tickets/purchase émettait des billets payants
 * sans paiement pour le staff (rôle lu dans users.role, sans affectation, caisse ni session) et
 * des billets gratuits sans limite. Aucun écran ne l'appelle (grep au rapport du lot 2) : elle
 * répond 410 et n'émet plus rien. Le guichet complet (contrôleur affecté, caisse ouverte,
 * paiement CASH rattaché à la session) sera revu au lot 4.
 */
async function gone(req: NextRequest, context: { params: Promise<{ id: string }> | { id: string } }) {
    const { id } = await Promise.resolve(context?.params);
    console.warn(`[API /api/events/${id}/tickets/purchase] appel refusé (route retirée) : ${req.method}`);
    return NextResponse.json({ error: 'Route retirée : achat par /api/checkout, guichet revu au lot 4.', code: 'ROUTE_GONE' }, { status: 410 });
}

export const POST = gone;
export const GET = gone;
