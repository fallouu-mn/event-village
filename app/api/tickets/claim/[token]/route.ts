import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/**
 * Lot 6 (contrat B4, décision 37, amendement 5) — l'ancien lien de réclamation par jeton est retiré.
 * Le transfert se réclame désormais depuis « Mes billets », avec le numéro auquel il a été envoyé
 * (POST /api/tickets/transfers/[id]/claim). Cette route répond 410 quel que soit le jeton, vrai ou faux,
 * sans lire la base : la réponse ne dit rien de l'existence d'un transfert.
 */
const RETIRED = {
    error: "Ce lien n'est plus utilisé. Connectez-vous avec le numéro auquel le billet a été envoyé, puis ouvrez « Mes billets ».",
    code: 'CLAIM_LINK_RETIRED',
} as const;

type RouteContext = { params: Promise<{ token: string }> | { token: string } };

function retired(): NextResponse {
    return NextResponse.json(RETIRED, { status: 410, headers: { 'Cache-Control': 'no-store' } });
}

/** GET /api/tickets/claim/[token] : 410, sans lecture de la base (le jeton n'est pas lu). */
export async function GET(_req: NextRequest, _context: RouteContext) {
    void _req;
    void _context;
    return retired();
}

/** POST /api/tickets/claim/[token] : session active exigée (statut du compte), puis 410 sans lecture de la base. */
export async function POST(req: NextRequest, _context: RouteContext) {
    void _context;
    const activeSession = await requireActiveSession(req);
    if (activeSession.response) return activeSession.response;
    return retired();
}
