import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiFailure, PublicError } from '@/lib/api/public-error';
import { requireActiveSession } from '@/lib/auth/session';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BodySchema = z.object({ accept: z.boolean() }).strict();

/** Refus de controller_invitation_respond : statut HTTP et texte affiché (contrat 4.3). */
const REFUSALS: Record<string, [number, string]> = {
    INVITATION_NOT_FOUND: [404, 'Invitation introuvable.'],
    INVITATION_EXPIRED: [410, 'Cette invitation a expiré.'],
    INVITATION_NOT_PENDING: [409, 'Cette invitation a déjà reçu une réponse.'],
    ACCOUNT_NOT_ACTIVE: [403, 'Votre compte n’est pas actif. Contactez le support.'],
};

/**
 * POST /api/account/controller-invitations/[id] — lot 9 bis (R37, B62, contrat 4.3) : le titulaire accepte ou
 * refuse une invitation à contrôler les événements d'une partenaire (`{ accept }`, RPC controller_invitation_respond,
 * tout ou rien). Acceptation : rôle Contrôleur et affectations aux événements encore validés ou publiés ; refus :
 * rien d'autre. Un tiers ou une invitation inconnue : 404 sans indice ; échue : 410 INVITATION_EXPIRED.
 */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> | { id: string } }) {
    const session = await requireActiveSession(req);
    if (session.response) return session.response;
    const { id } = await Promise.resolve(context.params);
    try {
        if (!id || !UUID_RE.test(id)) throw new PublicError(REFUSALS.INVITATION_NOT_FOUND[1], 'INVITATION_NOT_FOUND', 404);
        let body: unknown;
        try {
            body = await req.json();
        } catch {
            throw new PublicError('Réponse illisible : indiquez si vous acceptez l’invitation.', 'INVALID_BODY', 400);
        }
        const parsed = BodySchema.safeParse(body);
        if (!parsed.success) throw new PublicError('Réponse illisible : indiquez si vous acceptez l’invitation.', 'INVALID_BODY', 400);

        const { data, error } = await getServiceRoleClient().rpc('controller_invitation_respond', {
            p: { invitation_id: id, actor_id: session.user.id, accept: parsed.data.accept },
        });
        if (error) throw error;
        const reply = data as { ok?: boolean; code?: string; status?: string; assigned_event_ids?: string[] } | null;
        if (!reply) throw new Error('controller_invitation_respond : réponse vide');
        if (reply.ok !== true) {
            const refusal = REFUSALS[String(reply.code)];
            if (!refusal) throw new Error(`controller_invitation_respond : refus inattendu ${JSON.stringify(reply)}`);
            throw new PublicError(refusal[1], String(reply.code), refusal[0]);
        }
        return NextResponse.json({
            success: true,
            status: reply.status,
            assigned_event_ids: reply.assigned_event_ids ?? [],
            message: reply.status === 'ACCEPTED'
                ? 'Invitation acceptée : vous pouvez contrôler l’entrée de ces événements.'
                : 'Invitation refusée.',
        });
    } catch (err: unknown) {
        return apiFailure(`POST /api/account/controller-invitations/${id}`, err, {
            message: 'Réponse à l’invitation momentanément impossible. Réessayez.',
            code: 'CONTROLLER_INVITATION_FAILED',
        });
    }
}
