import type { NextRequest } from 'next/server';
import { handleInvitationAction } from '../invitation-actions';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/partner/team/invitations/[id] — finition 1 (E-19) : « Effacer » une invitation expirée, refusée ou
 * annulée de la page Équipe (une invitation en attente : 409, annulez-la d'abord). Corps facultatif `{ reason }`
 * (motif exigé d'un admin). Voir ../invitation-actions.ts.
 */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
    const { id } = await ctx.params;
    return handleInvitationAction('clear', req, id);
}
