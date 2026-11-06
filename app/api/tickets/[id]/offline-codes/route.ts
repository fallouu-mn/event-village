import { promisify } from 'node:util';
import { gzip } from 'node:zlib';
import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession } from '@/lib/auth/session';
import { issueOfflineCodes } from '@/lib/tickets/offline-codes.service';

export const dynamic = 'force-dynamic';

const gzipAsync = promisify(gzip);

/** Vrai si le client accepte gzip ; `gzip;q=0` est un refus explicite (RFC 9110), un poids illisible aussi. */
function acceptsGzip(header: string | null): boolean {
    if (!header) return false;
    return header.split(',').some((entry) => {
        const [coding, ...params] = entry.split(';').map((part) => part.trim().toLowerCase());
        if (coding !== 'gzip') return false;
        const weight = params.find((param) => param.startsWith('q='));
        return weight === undefined || Number(weight.slice(2)) > 0;
    });
}

/**
 * GET /api/tickets/[id]/offline-codes — lot de codes hors ligne du billet (lot 7, tâche 7.1, contrat 3.1).
 * Porteur seul (404 sinon, même corps que pour un billet inconnu), compte ACTIF, billet VALIDE, événement
 * PUBLIE, aucun transfert en attente, dans la fenêtre [début − 24 h ; fin + access.scan_window_after_hours].
 * Réponse compacte (codes concaténés, jamais le secret), `Cache-Control: no-store`. La route ne lit aucun
 * paramètre de requête ni aucun en-tête d'heure : la décision et l'heure viennent du serveur.
 *
 * Lot 8 (8.2 x, contrat 3.7, L72) : `next start` ne compresse aucune route API (Content-Type posé en tableau,
 * refusé par compressible()), le lot de 48 h partait donc à 52 Ko. La route compresse elle-même le lot accordé
 * quand le client accepte gzip ; Content-Encoding déjà posé, la couche de Next ne recompresse pas. Les refus,
 * courts, restent en JSON brut. Le corps ne reflète aucune entrée de l'appelant : seul le porteur reçoit un 200,
 * et l'identifiant du billet y est celui de la base (BREACH sans objet).
 */
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> | { id: string } }) {
    const session = await requireActiveSession(req);
    if (session.response) {
        session.response.headers.set('Cache-Control', 'no-store');
        return session.response;
    }
    const { id } = await Promise.resolve(context.params);
    const result = await issueOfflineCodes({ ticketId: String(id ?? ''), userId: session.user.id });
    const headers = { ...result.headers, 'Cache-Control': 'no-store' };
    if (result.status !== 200 || !acceptsGzip(req.headers.get('accept-encoding'))) {
        return NextResponse.json(result.body, { status: result.status, headers });
    }
    try {
        const packed = await gzipAsync(JSON.stringify(result.body));
        return new NextResponse(new Uint8Array(packed), {
            status: 200,
            headers: { ...headers, 'Content-Type': 'application/json', 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' },
        });
    } catch (err) {
        console.error(`[offline-codes] compression du lot du billet ${String(id ?? '')} : ${err instanceof Error ? err.message : String(err)}`);
        return NextResponse.json({ error: 'Erreur serveur.', code: 'SERVER_ERROR' }, { status: 500, headers });
    }
}
