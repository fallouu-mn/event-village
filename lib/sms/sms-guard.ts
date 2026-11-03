/**
 * Garde anti-abus SMS : chaque SMS est facturé au client (lot 1C.9, complété au lot 4.8).
 *
 * Avant tout envoi, une réservation atomique en base (lib/security/quota.ts) consomme, tout ou rien :
 *  - OTP : le plafond global quotidien en entier (SMS_GLOBAL_DAILY_CAP), et ses propres compteurs
 *    par numéro (15 min, jour) et par IP (heure, jour) ;
 *  - autres SMS (notifications, invitations) : le plafond global jusqu'à (100 − part OTP) % seulement
 *    (SMS_GLOBAL_OTP_RESERVED_PERCENT) — le reste du plafond est réservé à l'OTP —, la limite
 *    quotidienne par destinataire (SMS_PER_PHONE_DAY, notifications seulement) et, quand un compte
 *    connecté déclenche l'envoi (`actorId`), la limite quotidienne par compte (SMS_PER_ACCOUNT_DAY) ;
 *  - reçus de la vente au guichet (lot 5, COUNTER_RECEIPT) : part non OTP du plafond global, limite par
 *    destinataire et quota par caisse et par jour (COUNTER_RECEIPT_PER_SHIFT_DAY), sans limite par vendeur.
 * Les compteurs par destinataire de l'OTP et des notifications sont distincts : des notifications
 * vers un numéro n'épuisent pas ses codes de connexion.
 * Le destinataire est compté sous sa forme facturée (formatMTargetPhoneNumber) : « 77… »,
 * « +221… » et « 00221… » partagent un compteur.
 * Plafond atteint (global, ou part non OTP) : alerte journalisée (audit_logs) et mise en file pour les
 * administrateurs (notification_admin_alert), une fois par jour et par type, jamais par SMS.
 * Garde indisponible : refus (fail-closed), jamais d'envoi « à l'aveugle ».
 */
import { getServerEnv } from '@/lib/env';
import { reserveQuota, type QuotaRule } from '@/lib/security/quota';
import { getServiceRoleClient } from '@/lib/supabase/server';
import type { SmsSendResult } from '@/lib/integrations/types';
import { formatMTargetPhoneNumber } from './mtarget-http.adapter';

const DAY = 86400;

export type SmsCategory = 'OTP' | 'CONTROLLER_INVITE' | 'TRANSACTIONAL' | 'COUNTER_RECEIPT';

export interface SmsContext {
    category?: SmsCategory;
    /** IP du demandeur (catégorie OTP) : limite par IP. */
    ip?: string | null;
    /**
     * Compte connecté dont l'action déclenche l'envoi (invitation, équipe, transfert, billet gratuit…) :
     * limite quotidienne par compte (SMS_PER_ACCOUNT_DAY), hors OTP.
     */
    actorId?: string | null;
    /**
     * Lot 5 (C7) : caisse qui émet un reçu de vente au guichet (catégorie COUNTER_RECEIPT, obligatoire) :
     * quota par caisse et par jour (COUNTER_RECEIPT_PER_SHIFT_DAY) au lieu de la limite par compte du vendeur.
     */
    shiftId?: string | null;
    /** Réservation obtenue plus tôt (routes OTP : réserver avant d'enregistrer le code). */
    reservation?: SmsReservation;
}

/** Réservation à usage unique, liée à un destinataire. */
export class SmsReservation {
    private used = false;
    constructor(readonly recipient: string, readonly category: SmsCategory) {}

    consume(to: string): void {
        if (this.used) throw new Error('réservation SMS déjà utilisée');
        if (formatMTargetPhoneNumber(to) !== this.recipient) throw new Error('réservation SMS émise pour un autre destinataire');
        this.used = true;
    }
}

export type SmsReserveResult =
    | { ok: true; reservation: SmsReservation }
    | { ok: false; refusal: Required<Pick<SmsSendResult, 'code'>> & { message: string; retryAfterSeconds?: number } };

/** Part du plafond global ouverte aux SMS non OTP : floor(plafond × (100 − part OTP) / 100). */
export function nonOtpGlobalCap(): number {
    const env = getServerEnv();
    return Math.floor((env.SMS_GLOBAL_DAILY_CAP * (100 - env.SMS_GLOBAL_OTP_RESERVED_PERCENT)) / 100);
}

function rulesFor(recipient: string, ctx: SmsContext): QuotaRule[] {
    const env = getServerEnv();
    if ((ctx.category ?? 'TRANSACTIONAL') === 'OTP') {
        const rules: QuotaRule[] = [
            { scope: 'sms_global', bucket: 'all', windowSecs: DAY, max: env.SMS_GLOBAL_DAILY_CAP },
            { scope: 'sms_otp_phone', bucket: recipient, windowSecs: 900, max: env.SMS_OTP_PER_PHONE_15MIN },
            { scope: 'sms_otp_phone', bucket: recipient, windowSecs: DAY, max: env.SMS_OTP_PER_PHONE_DAY },
        ];
        if (ctx.ip) {
            rules.push(
                { scope: 'sms_otp_ip', bucket: ctx.ip, windowSecs: 3600, max: env.SMS_OTP_PER_IP_HOUR },
                { scope: 'sms_otp_ip', bucket: ctx.ip, windowSecs: DAY, max: env.SMS_OTP_PER_IP_DAY },
            );
        }
        return rules;
    }
    // Même compteur global que l'OTP, plafonné plus bas : les non OTP s'arrêtent à la part qui leur
    // est ouverte, l'OTP continue jusqu'au plafond entier.
    const rules: QuotaRule[] = [
        { scope: 'sms_global', bucket: 'all', windowSecs: DAY, max: nonOtpGlobalCap() },
        { scope: 'sms_phone', bucket: recipient, windowSecs: DAY, max: env.SMS_PER_PHONE_DAY },
    ];
    if ((ctx.category ?? 'TRANSACTIONAL') === 'COUNTER_RECEIPT') {
        // Reçu du guichet : part non OTP du plafond global, limite par destinataire, quota par caisse
        if (!ctx.shiftId) throw new Error('reçu de guichet sans caisse (shiftId) : quota par caisse impossible');
        rules.push({ scope: 'sms_counter_receipt', bucket: ctx.shiftId, windowSecs: DAY, max: env.COUNTER_RECEIPT_PER_SHIFT_DAY });
        return rules;
    }
    if (ctx.actorId) rules.push({ scope: 'sms_account', bucket: ctx.actorId, windowSecs: DAY, max: env.SMS_PER_ACCOUNT_DAY });
    return rules;
}

type CapKind = 'GLOBAL' | 'NON_OTP_SHARE';

/**
 * Alerte de plafond, une fois par jour UTC et par type : journal d'audit (audit_logs) puis mise en file
 * pour les administrateurs (RPC notification_admin_alert, types ADMIN_SMS_CAP_GLOBAL et
 * ADMIN_SMS_CAP_NON_OTP, destinataires par permission notifications.read ; la clé porte le jour UTC).
 * Lot 6 (J2.13) : plus aucune écriture directe de notification. L'alerte ne part jamais par SMS.
 */
async function raiseCapAlert(kind: CapKind, context: Record<string, unknown>): Promise<void> {
    const bucket = kind === 'GLOBAL' ? 'global_cap' : 'non_otp_share';
    const first = await reserveQuota([{ scope: 'sms_alert', bucket, windowSecs: DAY, max: 1 }], 'alerte plafond SMS');
    if (!first.allowed) return; // déjà signalé aujourd'hui (ou garde indisponible, déjà journalisé)
    const env = getServerEnv();
    const cap = env.SMS_GLOBAL_DAILY_CAP;
    const limit = kind === 'GLOBAL' ? cap : nonOtpGlobalCap();
    const action = kind === 'GLOBAL' ? 'SMS_GLOBAL_DAILY_CAP_REACHED' : 'SMS_NON_OTP_DAILY_SHARE_REACHED';
    console.error(`[SMS_QUOTA] ${action} (${limit} SMS sur un plafond de ${cap})`);
    const supabase = getServiceRoleClient();
    const { error: auditErr } = await supabase.from('audit_logs').insert({
        user_role: 'SYSTEM',
        action,
        object_type: 'sms_quota',
        metadata: { ...context, cap, limit, reserved_otp_percent: env.SMS_GLOBAL_OTP_RESERVED_PERCENT },
    });
    if (auditErr) console.error('[SMS_QUOTA] journalisation de l’alerte impossible :', auditErr.message);
    const day = new Date().toISOString().slice(0, 10);
    const type = kind === 'GLOBAL' ? 'ADMIN_SMS_CAP_GLOBAL' : 'ADMIN_SMS_CAP_NON_OTP';
    const { data, error } = await supabase.rpc('notification_admin_alert', {
        p: { type, ref: day, data: { ...context, day, cap, limit } },
    });
    if (error) {
        console.error(`[SMS_QUOTA] mise en file de l’alerte ${type} impossible :`, error.message);
        return;
    }
    const reply = (data ?? null) as { ok?: boolean; code?: string; message?: string } | null;
    if (reply?.ok !== true) console.error(`[SMS_QUOTA] alerte ${type} refusée :`, reply?.code ?? 'réponse vide', reply?.message ?? '');
}

export async function reserveSms(to: string, ctx: SmsContext = {}): Promise<SmsReserveResult> {
    const category = ctx.category ?? 'TRANSACTIONAL';
    const recipient = formatMTargetPhoneNumber(to);
    const result = await reserveQuota(rulesFor(recipient, ctx), `SMS ${category}`);
    if (result.allowed) return { ok: true, reservation: new SmsReservation(recipient, category) };
    if (result.reason === 'UNAVAILABLE') {
        return { ok: false, refusal: { code: 'SMS_GUARD_UNAVAILABLE', message: 'Service SMS momentanément indisponible.' } };
    }
    if (result.scope === 'sms_global') {
        await raiseCapAlert(category === 'OTP' ? 'GLOBAL' : 'NON_OTP_SHARE', { category });
        return {
            ok: false,
            refusal: {
                code: 'SMS_DAILY_CAP_REACHED',
                message: "L'envoi de SMS est momentanément suspendu. Réessayez plus tard ou contactez le support.",
                retryAfterSeconds: result.retryAfterSeconds,
            },
        };
    }
    if (result.scope === 'sms_account') {
        return {
            ok: false,
            refusal: {
                code: 'SMS_ACCOUNT_LIMIT_REACHED',
                message: 'Limite quotidienne de SMS de votre compte atteinte. Réessayez demain ou contactez le support.',
                retryAfterSeconds: result.retryAfterSeconds,
            },
        };
    }
    const minutes = Math.max(1, Math.ceil(result.retryAfterSeconds / 60));
    return {
        ok: false,
        refusal: {
            code: 'SMS_RATE_LIMITED',
            message: `Trop de demandes de SMS. Réessayez dans ${minutes} minute${minutes > 1 ? 's' : ''}.`,
            retryAfterSeconds: result.retryAfterSeconds,
        },
    };
}

/** Réponse HTTP à renvoyer quand la garde refuse un SMS demandé par l'utilisateur. */
export function smsRefusalHttp(code: NonNullable<SmsSendResult['code']>): number {
    return code === 'SMS_GUARD_UNAVAILABLE' ? 503 : 429;
}
