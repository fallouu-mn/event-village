/**
 * Lot 9 quater (A3 : AUD-02 ; A4 : AUD-19) — permis d'écriture GoTrue à usage unique (60 s).
 *
 * La base refuse à GoTrue tout changement de mot de passe, et tout code ou lien email vers une adresse technique, sans
 * permis posé juste avant par une route de l'application (trigger auth_users_guard_writes, migration 20261111000001).
 * Chaque route qui a vérifié le droit d'agir (ancien mot de passe, session de récupération, code SMS d'activation,
 * création par un administrateur, connexion par code SMS) pose le permis puis appelle GoTrue. Un jeton de session seul
 * (PUT /auth/v1/user) ou une demande anonyme (POST /auth/v1/otp, /recover) n'en a pas : refus.
 */
import { getServiceRoleClient } from '@/lib/supabase/server';

export type AuthWritePermitKind = 'PASSWORD' | 'EMAIL_LINK';

/** Pose le permis ; lève une erreur si la base le refuse (l'appelant répond son 500/503, rien n'est écrit). */
export async function grantAuthWritePermit(userId: string, kind: AuthWritePermitKind): Promise<void> {
    const { data, error } = await getServiceRoleClient().rpc('auth_write_permit_grant', { p: { user_id: userId, kind } });
    if (error) throw new Error(`permis ${kind} pour ${userId} : ${error.message}`);
    const reply = data as { ok?: boolean; code?: string } | null;
    if (reply?.ok !== true) throw new Error(`permis ${kind} pour ${userId} refusé : ${reply?.code ?? 'réponse vide'}`);
}
