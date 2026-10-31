import { NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/server';
import type { ServerUser } from './session';

export type InactiveRefusalAction = 'CONTROLLER_INVITE_REFUSED_INACTIVE' | 'CONTROLLER_ASSIGNMENT_REFUSED_INACTIVE';

/**
 * Lot 1B.6 — une route partenaire ne remet jamais ACTIF un compte qui ne l'est pas.
 * Journalise le refus dans audit_logs (l'échec de journalisation est signalé, pas masqué)
 * et renvoie une réponse 409 explicite (code ACCOUNT_NOT_ACTIVE).
 */
export async function refuseInactiveAccount(params: {
    actor: ServerUser;
    targetId: string;
    targetStatus: string;
    action: InactiveRefusalAction;
    context: Record<string, unknown>;
}): Promise<NextResponse> {
    const { error } = await getServiceRoleClient().from('audit_logs').insert({
        user_id: params.actor.id,
        user_role: params.actor.role,
        action: params.action,
        object_type: 'users',
        object_id: params.targetId,
        old_value: { status: params.targetStatus },
        new_value: null,
        metadata: { ...params.context, reason: 'compte non ACTIF : réactivation réservée aux administrateurs' },
    });
    if (error) {
        console.error(`[refuseInactiveAccount] journalisation du refus ${params.action} impossible :`, error.message);
    }
    const verb = params.action === 'CONTROLLER_INVITE_REFUSED_INACTIVE' ? 'invité' : 'affecté';
    return NextResponse.json(
        {
            error: `Ce compte est au statut ${params.targetStatus} : il ne peut pas être ${verb}. Seul un administrateur peut le réactiver.`,
            code: 'ACCOUNT_NOT_ACTIVE',
        },
        { status: 409 }
    );
}
