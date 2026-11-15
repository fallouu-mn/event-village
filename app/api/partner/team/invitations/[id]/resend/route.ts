import type { NextRequest } from 'next/server';
import { handleInvitationAction } from '../../invitation-actions';

export const dynamic = 'force-dynamic';

/**
 * POST /api/partner/team/invitations/[id]/resend — finition 1 (E-19) : « Renvoyer l'invitation ». En attente et non
 * échue : nouveau SMS (et cloche, push, email), prolongée de 72 h. Plafonné par organisateur et par numéro (429). Corps
 * facultatif `{ reason }` (motif exigé d'un admin). Voir ../../invitation-actions.ts.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
    const { id } = await ctx.params;
    return handleInvitationAction('resend', req, id);
}
