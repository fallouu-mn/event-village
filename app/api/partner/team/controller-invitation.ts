/**
 * Lot 9 bis (R37, B62, contrat 4.3) — invitation d'un compte établi à contrôler les événements d'une partenaire,
 * partagée par POST /api/partner/team/invite et PATCH /api/partner/team/assignments. Le titulaire accepte lui-même
 * (POST /api/account/controller-invitations/[id]) : aucun rôle ni affectation n'est posé ici. RPC
 * controller_invitation_create : invitation de 72 h et CONTROLLER_INVITATION (SMS, in-app, push, email) dans la même
 * transaction. Module serveur (pas une route).
 */
import { NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/server';

type ServiceClient = ReturnType<typeof getServiceRoleClient>;

export interface InvitationAssignment {
    event_id: string;
    can_accept_cash: boolean;
}

export type InvitationOutcome =
    | { response: NextResponse; invitationId?: undefined; expiresAt?: undefined }
    | { response?: undefined; invitationId: string; expiresAt: string };

const REFUSALS: Record<string, [number, string]> = {
    INVALID_INPUT: [400, 'Invitation incomplète : choisissez au moins un événement.'],
    PARTNER_NOT_FOUND: [404, 'Organisateur introuvable.'],
    ACCOUNT_NOT_ACTIVE: [403, 'Ce compte n’est pas actif : il ne peut pas être invité.'],
    EVENT_NOT_OWNED: [403, 'Vous n’êtes pas propriétaire de tous les événements sélectionnés.'],
    EVENT_NOT_ELIGIBLE: [400, 'Seuls les événements validés ou publiés peuvent être affectés.'],
};

/**
 * Crée l'invitation. `partnerId` : partenaire de la session ; pour un admin (null), l'organisateur commun des
 * événements demandés (plusieurs organisateurs : refus 400). Une panne lève (500 explicite par la route).
 */
export async function createControllerInvitation(supabase: ServiceClient, input: {
    actorId: string;
    actorRole: 'PARTENAIRE' | 'ADMIN';
    partnerId: string | null;
    userId: string;
    assignments: InvitationAssignment[];
}): Promise<InvitationOutcome> {
    let partnerId = input.partnerId;
    if (!partnerId) {
        const eventIds = Array.from(new Set(input.assignments.map((a) => a.event_id)));
        const { data, error } = await supabase.from('events').select('id, partner_id').in('id', eventIds);
        if (error) throw new Error(`organisateur des événements de l'invitation : ${error.message}`);
        const owners = new Set((data ?? []).map((e: { partner_id: string }) => String(e.partner_id)));
        if ((data ?? []).length !== eventIds.length || owners.size !== 1) {
            return {
                response: NextResponse.json({
                    error: 'Les événements d’une invitation appartiennent à un seul organisateur.',
                    code: 'INVALID_FIELD',
                }, { status: 400 }),
            };
        }
        partnerId = Array.from(owners)[0];
    }
    const { data, error } = await supabase.rpc('controller_invitation_create', {
        p: {
            actor_id: input.actorId,
            actor_role: input.actorRole,
            partner_id: partnerId,
            user_id: input.userId,
            assignments: input.assignments,
        },
    });
    if (error) throw new Error(`controller_invitation_create : ${error.code ?? ''} ${error.message}`);
    const reply = data as { ok?: boolean; code?: string; invitation_id?: string; expires_at?: string } | null;
    if (!reply) throw new Error('controller_invitation_create : réponse vide');
    if (reply.ok !== true) {
        const refusal = REFUSALS[String(reply.code)];
        if (!refusal) throw new Error(`controller_invitation_create : refus inattendu ${JSON.stringify(reply)}`);
        return { response: NextResponse.json({ error: refusal[1], code: String(reply.code) }, { status: refusal[0] }) };
    }
    if (!reply.invitation_id || !reply.expires_at) throw new Error(`controller_invitation_create : réponse incomplète ${JSON.stringify(reply)}`);
    return { invitationId: reply.invitation_id, expiresAt: reply.expires_at };
}
