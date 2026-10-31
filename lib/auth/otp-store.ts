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
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { getServerEnv } from '@/lib/env';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const OTP_MAX_ATTEMPTS = 5;
const OTP_HASH_DOMAIN = 'event-village:otp:v1';

export type OtpFailureReason = 'INVALID' | 'EXPIRED' | 'TOO_MANY_ATTEMPTS';
export type OtpCheck = { ok: true; id: string } | { ok: false; reason: OtpFailureReason };

/** Empreinte HMAC-SHA256 (hexadécimal, 64 caractères) d'un code pour un numéro donné. */
export function hashOtpCode(phone: string, code: string): string {
    return createHmac('sha256', getServerEnv().OTP_HASH_SECRET)
        .update(`${OTP_HASH_DOMAIN}\0${phone}\0${code}`)
        .digest('hex');
}

function otpHashMatches(storedHex: string, phone: string, code: string): boolean {
    const stored = Buffer.from(storedHex, 'hex');
    const candidate = Buffer.from(hashOtpCode(phone, code), 'hex');
    return stored.length === 32 && candidate.length === 32 && timingSafeEqual(stored, candidate);
}

/** Enregistre un code OTP pour un numéro normalisé. Lève une erreur si l'écriture échoue. */
export async function storeOtp(phone: string, code: string, expiresAt: Date): Promise<string> {
    const { data, error } = await getServiceRoleClient()
        .from('otp_codes')
        .insert({ phone, code_hash: hashOtpCode(phone, code), expires_at: expiresAt.toISOString(), verified: false, attempts: 0 })
        .select('id')
        .single();
    if (error || !data) {
        throw new Error(`Enregistrement du code OTP impossible : ${error?.message ?? 'aucune ligne créée'}`);
    }
    return data.id as string;
}

/** Contrôle le code sans le consommer. Un essai faux incrémente le compteur du code courant. */
export async function checkStoredOtp(phone: string, code: string): Promise<OtpCheck> {
    const supabase = getServiceRoleClient();
    const { data: record, error } = await supabase
        .from('otp_codes')
        .select('id, code_hash, expires_at, attempts')
        .eq('phone', phone)
        .eq('verified', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (error) throw new Error(`Lecture du code OTP impossible : ${error.message}`);
    if (!record) return { ok: false, reason: 'INVALID' };
    if (new Date(record.expires_at as string).getTime() <= Date.now()) return { ok: false, reason: 'EXPIRED' };
    const attempts = Number(record.attempts ?? 0);
    if (attempts >= OTP_MAX_ATTEMPTS) return { ok: false, reason: 'TOO_MANY_ATTEMPTS' };
    if (!otpHashMatches(String(record.code_hash), phone, code)) {
        const { error: incErr } = await supabase.from('otp_codes').update({ attempts: attempts + 1 }).eq('id', record.id);
        if (incErr) throw new Error(`Comptage de l'essai OTP impossible : ${incErr.message}`);
        return { ok: false, reason: attempts + 1 >= OTP_MAX_ATTEMPTS ? 'TOO_MANY_ATTEMPTS' : 'INVALID' };
    }
    return { ok: true, id: record.id as string };
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

/** Contrôle puis consomme. */
export async function verifyStoredOtp(phone: string, code: string): Promise<OtpCheck> {
    const check = await checkStoredOtp(phone, code);
    if (!check.ok) return check;
    return (await consumeStoredOtp(check.id)) ? check : { ok: false, reason: 'INVALID' };
}

export function otpFailureMessage(reason: OtpFailureReason): { message: string; status: number } {
    switch (reason) {
        case 'EXPIRED':
            return { message: 'Le code OTP a expiré. Veuillez en demander un nouveau.', status: 400 };
        case 'TOO_MANY_ATTEMPTS':
            return { message: 'Trop de tentatives infructueuses. Veuillez demander un nouveau code.', status: 429 };
        default:
            return { message: 'Code de vérification incorrect ou expiré.', status: 400 };
    }
}
