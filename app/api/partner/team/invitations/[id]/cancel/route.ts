import type { NextRequest } from 'next/server';
import { requireActiveSession } from '@/lib/auth/session';
import { handleInvitationAction } from '../../invitation-actions';

export const dynamic = 'force-dynamic';

/**
 * POST /api/partner/team/invitations/[id]/cancel — finition 1 (E-19) : « Annuler l'invitation ». En attente et non
 * échue seulement ; le lien du SMS ne mène plus à rien, aucun message au titulaire. Corps facultatif `{ reason }`
 * (motif exigé d'un admin). Voir ../../invitation-actions.ts.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
    const session = await requireActiveSession(req);
    if (session.response) return session.response;
    const { id } = await ctx.params;
    return handleInvitationAction('cancel', req, id, session.user);
}
