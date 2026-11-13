/**
 * Lot 9 (9.2, AR2, AM1, L28) : auth.users n'est écrit que par auth.admin.updateUserById, avant la RPC de finalisation
 * de public.users. Ce module porte ce qui entoure cet appel : savoir si une identité est prise (GoTrue ne garantit
 * aucun code d'erreur) et rétablir auth.users quand la RPC échoue.
 */
import { NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { isTechnicalAddress } from '@/lib/notifications/channels';
import { technicalEmailFor } from '@/lib/auth/technical-email';

/**
 * Adresse technique (lot 9 quater, A4 : ancien domaine eventvillage.sn et domaine réservé .invalid). L'adresse
 * technique n'est plus tirée du numéro : lib/auth/technical-email.ts.
 */
export function isTechnicalEmail(email: string): boolean {
    return isTechnicalAddress(email);
}

/** Toute réponse des routes du compte est hors cache (contrat 4). */
export function noStore(response: NextResponse): NextResponse {
    response.headers.set('Cache-Control', 'no-store');
    return response;
}

export interface IdentityTaken { emailTaken: boolean; phoneTaken: boolean }

/** RPC account_identity_taken, sur tout autre compte que `userId`. Lève une erreur si la lecture échoue. */
export async function identityTaken(userId: string, email: string | null, phone: string | null): Promise<IdentityTaken> {
    const { data, error } = await getServiceRoleClient().rpc('account_identity_taken', { p_user_id: userId, p_email: email, p_phone: phone });
    if (error) throw new Error(`account_identity_taken : ${error.message}`);
    const reply = data as { email_taken?: unknown; phone_taken?: unknown } | null;
    if (typeof reply?.email_taken !== 'boolean' || typeof reply?.phone_taken !== 'boolean') {
        throw new Error(`account_identity_taken : réponse inattendue ${JSON.stringify(data)}`);
    }
    return { emailTaken: reply.email_taken, phoneTaken: reply.phone_taken };
}

/**
 * L'échec de updateUserById vient-il d'une identité déjà prise (AM1) ? Les codes de GoTrue sont acceptés s'ils
 * arrivent, jamais supposés : sans eux, l'identité est relue. Si cette relecture échoue, l'appelant répond son 500.
 */
export async function authUpdateRefusedAsTaken(
    error: { code?: string },
    userId: string,
    email: string | null,
    phone: string | null,
): Promise<boolean> {
    if (error.code === 'phone_exists' || error.code === 'email_exists') return true;
    try {
        const taken = await identityTaken(userId, email, phone);
        return taken.emailTaken || taken.phoneTaken;
    } catch (err) {
        console.error('[account-sync] relecture de l’identité impossible après un échec de l’API', { userId, detail: err instanceof Error ? err.message : String(err) });
        return false;
    }
}

/** Trace de repérage pour le support (AR2) ; son échec est journalisé à son tour. */
async function reportDesync(userId: string, label: string): Promise<void> {
    const { error } = await getServiceRoleClient().from('audit_logs').insert({
        user_id: userId,
        action: 'ACCOUNT_AUTH_DESYNC',
        object_type: 'users',
        object_id: userId,
        metadata: { label, step: 'compensation' },
    });
    if (error) console.error('[account-sync] ligne ACCOUNT_AUTH_DESYNC non écrite', { userId, label, detail: error.message });
}

async function compensationFailed(userId: string, label: string, detail: string): Promise<false> {
    console.error('[account-sync] compensation impossible', { userId, label, detail });
    await reportDesync(userId, label);
    return false;
}

/**
 * Rétablit auth.users sur la valeur relue dans public.users À CET INSTANT (L28 : deux confirmations concurrentes laissent
 * auth aligné sur le gagnant). `fields` : ce que l'aller a écrit, un seul essai, sans boucle. Rend false si la
 * compensation a échoué (journal et ligne ACCOUNT_AUTH_DESYNC faits) : l'appelant répond 500 ACCOUNT_SYNC_FAILED.
 * Un numéro relu NULL n'est pas restituable par l'API : même chemin. Le journal ne porte ni numéro ni email.
 */
export async function compensateAuthIdentity(userId: string, label: string, fields: 'email' | 'phone_email'): Promise<boolean> {
    const supabase = getServiceRoleClient();
    const { data: row, error: readErr } = await supabase.from('users').select('phone, email').eq('id', userId).maybeSingle();
    if (readErr) return compensationFailed(userId, label, `relecture du profil : ${readErr.message}`);
    if (!row) return compensationFailed(userId, label, 'profil absent à la relecture');
    const phone = row.phone as string | null;
    const email = (row.email as string | null) ?? technicalEmailFor(userId);
    if (fields === 'phone_email' && !phone) return compensationFailed(userId, label, 'numéro NULL à la relecture : non restituable par l’API');
    if (!email) return compensationFailed(userId, label, 'email NULL à la relecture');

    const { error } = await supabase.auth.admin.updateUserById(userId, {
        email,
        email_confirm: true,
        ...(fields === 'phone_email' ? { phone: phone as string, phone_confirm: true } : {}),
    });
    if (error) return compensationFailed(userId, label, error.message);
    return true;
}
