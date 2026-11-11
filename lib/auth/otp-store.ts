/**
 * Lot 1B.7 — codes OTP en base (public.otp_codes, service_role uniquement).
 *
 * La base est la seule source de vérité : un code émis par une instance est vérifiable par
 * n'importe quelle autre (aucun cache mémoire de processus). Seul le code le plus récent non
 * consommé d'un numéro est valable ; les essais infructueux sont comptés sur ce code.
 * Toute erreur de lecture ou d'écriture est remontée à l'appelant (aucun repli silencieux).
 *
 * Lot 1C.4 : le code n'est jamais stocké en clair. Seule son empreinte HMAC-SHA256 (secret
 * dédié OTP_HASH_SECRET, message lié au numéro) est enregistrée ; la comparaison se fait en
 * temps constant.
 *
 * Lot 3 : chaque code porte un objet (otp_codes.purpose). Un code émis pour un objet (connexion,
 * inscription, retrait…) n'est jamais accepté pour un autre : la recherche se fait par numéro ET
 * objet, et un essai pour un autre objet ne touche pas au code (point 9 du lot 1C).
 *
 * Lot 5 (C6) : chaque essai passe par la RPC otp_check, qui verrouille la ligne du code, compare
 * l'empreinte, incrémente attempts de façon atomique (5 essais au plus, quel que soit le parallélisme)
 * et consomme le code en cas de succès, dans la même transaction.
 */
import { createHmac } from 'node:crypto';
import { getServerEnv } from '@/lib/env';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const OTP_MAX_ATTEMPTS = 5;
const OTP_HASH_DOMAIN = 'event-village:otp:v1';

export const OTP_PURPOSES = ['LOGIN', 'REGISTER', 'PASSWORD_RESET', 'CONTROLLER_SETUP', 'WITHDRAWAL', 'PHONE_CHANGE'] as const;
export type OtpPurpose = (typeof OTP_PURPOSES)[number];
/** Objets acceptés par la vérification du parcours de compte (/api/auth/verify-otp). */
export const ACCOUNT_OTP_PURPOSES: readonly OtpPurpose[] = ['LOGIN', 'REGISTER', 'PASSWORD_RESET'];

export type OtpFailureReason = 'INVALID' | 'EXPIRED' | 'TOO_MANY_ATTEMPTS';
export type OtpCheck = { ok: true; id: string } | { ok: false; reason: OtpFailureReason };

/** Empreinte HMAC-SHA256 (hexadécimal, 64 caractères) d'un code pour un numéro donné. */
export function hashOtpCode(phone: string, code: string): string {
    return createHmac('sha256', getServerEnv().OTP_HASH_SECRET)
        .update(`${OTP_HASH_DOMAIN}\0${phone}\0${code}`)
        .digest('hex');
}

/** Enregistre un code OTP pour un numéro normalisé et un objet. Lève une erreur si l'écriture échoue. */
export async function storeOtp(phone: string, code: string, expiresAt: Date, purpose: OtpPurpose): Promise<string> {
    if (!OTP_PURPOSES.includes(purpose)) throw new Error(`Objet de code OTP inconnu : ${purpose}`);
    const { data, error } = await getServiceRoleClient()
        .from('otp_codes')
        .insert({ phone, purpose, code_hash: hashOtpCode(phone, code), expires_at: expiresAt.toISOString(), verified: false, attempts: 0 })
        .select('id')
        .single();
    if (error || !data) {
        throw new Error(`Enregistrement du code OTP impossible : ${error?.message ?? 'aucune ligne créée'}`);
    }
    return data.id as string;
}

type OtpCheckReply = { ok?: boolean; id?: string; code?: string };

/** Un essai, sérialisé en base (otp_check) ; `consume` : le code est consommé s'il est bon. */
async function otpCheck(phone: string, code: string, purpose: OtpPurpose | readonly OtpPurpose[], consume: boolean): Promise<OtpCheck> {
    const purposes = (Array.isArray(purpose) ? purpose : [purpose]) as OtpPurpose[];
    if (purposes.length === 0 || purposes.some((p) => !OTP_PURPOSES.includes(p))) throw new Error(`Objet de code OTP inconnu : ${purposes.join(', ')}`);
    const { data, error } = await getServiceRoleClient().rpc('otp_check', {
        p: { phone, purposes, code_hash: hashOtpCode(phone, code), consume },
    });
    if (error) throw new Error(`Vérification du code OTP impossible : ${error.message}`);
    const reply = (data ?? null) as OtpCheckReply | null;
    if (!reply) throw new Error('Vérification du code OTP impossible : réponse vide');
    if (reply.ok === true && reply.id) return { ok: true, id: String(reply.id) };
    switch (reply.code) {
        case 'INVALID':
        case 'EXPIRED':
        case 'TOO_MANY_ATTEMPTS':
            return { ok: false, reason: reply.code };
        default:
            throw new Error(`Vérification du code OTP : réponse inattendue ${JSON.stringify(reply)}`);
    }
}

/**
 * Contrôle le code sans le consommer, pour l'objet (ou les objets) attendu(s). Un essai faux
 * incrémente le compteur du code courant de cet objet ; un code d'un autre objet n'est pas lu.
 */
export async function checkStoredOtp(phone: string, code: string, purpose: OtpPurpose | readonly OtpPurpose[]): Promise<OtpCheck> {
    return otpCheck(phone, code, purpose, false);
}

/** Consomme un code contrôlé. Renvoie false s'il a déjà été consommé (requête concurrente). */
export async function consumeStoredOtp(id: string): Promise<boolean> {
    const { data, error } = await getServiceRoleClient()
        .from('otp_codes')
        .update({ verified: true })
        .eq('id', id)
        .eq('verified', false)
        .select('id');
    if (error) throw new Error(`Consommation du code OTP impossible : ${error.message}`);
    return (data ?? []).length === 1;
}

/** Contrôle et consomme dans la même transaction (otp_check). */
export async function verifyStoredOtp(phone: string, code: string, purpose: OtpPurpose | readonly OtpPurpose[]): Promise<OtpCheck> {
    return otpCheck(phone, code, purpose, true);
}

export function otpFailureMessage(reason: OtpFailureReason): { message: string; status: number } {
    switch (reason) {
        case 'EXPIRED':
            return { message: 'Le code a expiré. Demandez-en un nouveau.', status: 400 };
        case 'TOO_MANY_ATTEMPTS':
            return { message: 'Trop de tentatives infructueuses. Veuillez demander un nouveau code.', status: 429 };
        default:
            return { message: 'Code de vérification incorrect ou expiré.', status: 400 };
    }
}
