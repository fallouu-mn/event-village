/**
 * Lot 9 quater (A3 : AUD-02 ; A5 : G-97) — compte contrôleur créé par une invitation et pas encore activé.
 *
 * La marque est dans app_metadata (écrite par le service_role seul), plus dans user_metadata que l'utilisateur écrit
 * lui-même (PUT /auth/v1/user {data}). Tant qu'elle est posée, le compte ne s'ouvre ni par code, ni par mot de passe,
 * ni par « Mot de passe oublié » : seule l'activation (/controller/setup, code reçu par SMS) le rend utilisable.
 */
import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const CONTROLLER_ACTIVATION_KEY = 'controller_activation_pending';

export const CONTROLLER_NOT_ACTIVATED_MESSAGE = 'Activez d’abord votre compte contrôleur avec le lien reçu par SMS.';

/** La marque est-elle posée sur ce compte d'authentification ? (lecture de app_metadata seulement) */
export function isControllerActivationPending(authUser: Pick<User, 'app_metadata'> | null | undefined): boolean {
    return authUser?.app_metadata?.[CONTROLLER_ACTIVATION_KEY] === true;
}

/** Lecture par l'identifiant du compte ; lève une erreur si GoTrue ne répond pas (jamais « non » par défaut). */
export async function controllerActivationPendingById(userId: string): Promise<boolean> {
    const { data, error } = await getServiceRoleClient().auth.admin.getUserById(userId);
    if (error || !data?.user) throw new Error(`compte d’authentification ${userId} illisible : ${error?.message ?? 'absent'}`);
    return isControllerActivationPending(data.user);
}

/** Refus commun (403) : connexion par code, par mot de passe, « Mot de passe oublié ». */
export function controllerNotActivatedResponse(): NextResponse {
    return NextResponse.json({ error: CONTROLLER_NOT_ACTIVATED_MESSAGE, code: 'CONTROLLER_NOT_ACTIVATED' }, { status: 403 });
}
