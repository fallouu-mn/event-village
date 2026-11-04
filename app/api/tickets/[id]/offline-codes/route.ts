import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession } from '@/lib/auth/session';
import { issueOfflineCodes } from '@/lib/tickets/offline-codes.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/tickets/[id]/offline-codes — lot de codes hors ligne du billet (lot 7, tâche 7.1, contrat 3.1).
 * Porteur seul (404 sinon, même corps que pour un billet inconnu), compte ACTIF, billet VALIDE, événement
 * PUBLIE, aucun transfert en attente, dans la fenêtre [début − 24 h ; fin + access.scan_window_after_hours].
 * Réponse compacte (codes concaténés, jamais le secret), `Cache-Control: no-store`. La route ne lit aucun
 * paramètre de requête ni aucun en-tête d'heure : la décision et l'heure viennent du serveur.
 */
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> | { id: string } }) {
    const session = await requireActiveSession(req);
    if (session.response) {
        session.response.headers.set('Cache-Control', 'no-store');
        return session.response;
    }
    const { id } = await Promise.resolve(context.params);
    const result = await issueOfflineCodes({ ticketId: String(id ?? ''), userId: session.user.id });
    return NextResponse.json(result.body, {
        status: result.status,
        headers: { ...result.headers, 'Cache-Control': 'no-store' },
    });
}
