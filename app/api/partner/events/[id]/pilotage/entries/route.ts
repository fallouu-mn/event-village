import type { NextRequest } from 'next/server';
import { requireActiveSession } from '@/lib/auth/session';
import { pilotageTabResponse, type RouteParams } from '@/lib/events/pilotage.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/partner/events/[id]/pilotage/entries — lot 5 (contrat I). Partenaire propriétaire (compte ACTIF)
 * ou admin : 200 avec le corps de la RPC pilotage_entries ; partenaire B, client ou événement inconnu : 404.
 */
export async function GET(request: NextRequest, ctx: RouteParams<{ id: string }>) {
    const session = await requireActiveSession(request);
    if (session.response) return session.response;
    return pilotageTabResponse('entries', ctx, session.user.id);
}
