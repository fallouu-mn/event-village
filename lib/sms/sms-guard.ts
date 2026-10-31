/**
 * Lot 1C.9 — garde anti-abus SMS : chaque SMS est facturé au client.
 *
 * Avant tout envoi, une réservation atomique en base (lib/security/quota.ts) consomme :
 *  - pour tout SMS : la limite quotidienne par destinataire et le plafond global quotidien ;
 *  - pour un OTP : en plus, les limites par numéro (15 min, jour) et par IP (heure, jour).
 * Le destinataire est compté sous sa forme facturée (formatMTargetPhoneNumber) : « 77… »,
 * « +221… » et « 00221… » partagent un compteur.
 * Plafond global atteint : alerte journalisée (audit_logs) et notification in-app aux
 * superadmins, une fois par jour, jamais par SMS.
 * Garde indisponible : refus (fail-closed), jamais d'envoi « à l'aveugle ».
 */
import { getServerEnv } from '@/lib/env';
import { reserveQuota, type QuotaRule } from '@/lib/security/quota';
import { getServiceRoleClient } from '@/lib/supabase/server';
import type { SmsSendResult } from '@/lib/integrations/types';
import { formatMTargetPhoneNumber } from './mtarget-http.adapter';

const DAY = 86400;

export type SmsCategory = 'OTP' | 'CONTROLLER_INVITE' | 'TRANSACTIONAL';

export interface SmsContext {
    category?: SmsCategory;
    /** IP du demandeur (catégorie OTP) : limite par IP. */
    ip?: string | null;
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

function rulesFor(recipient: string, ctx: SmsContext): QuotaRule[] {
    const env = getServerEnv();
    const rules: QuotaRule[] = [
        { scope: 'sms_phone', bucket: recipient, windowSecs: DAY, max: env.SMS_PER_PHONE_DAY },
        { scope: 'sms_global', bucket: 'all', windowSecs: DAY, max: env.SMS_GLOBAL_DAILY_CAP },
    ];
    if ((ctx.category ?? 'TRANSACTIONAL') === 'OTP') {
        rules.push(
            { scope: 'sms_otp_phone', bucket: recipient, windowSecs: 900, max: env.SMS_OTP_PER_PHONE_15MIN },
            { scope: 'sms_otp_phone', bucket: recipient, windowSecs: DAY, max: env.SMS_OTP_PER_PHONE_DAY },
        );
        if (ctx.ip) {
            rules.push(
                { scope: 'sms_otp_ip', bucket: ctx.ip, windowSecs: 3600, max: env.SMS_OTP_PER_IP_HOUR },
                { scope: 'sms_otp_ip', bucket: ctx.ip, windowSecs: DAY, max: env.SMS_OTP_PER_IP_DAY },
            );
        }
    }
    return rules;
}

/** Alerte « plafond global atteint », une fois par jour UTC : journal d'audit + in-app superadmins. */
async function raiseGlobalCapAlert(context: Record<string, unknown>): Promise<void> {
    const first = await reserveQuota([{ scope: 'sms_alert', bucket: 'global_cap', windowSecs: DAY, max: 1 }], 'alerte plafond SMS');
    if (!first.allowed) return; // déjà signalé aujourd'hui (ou garde indisponible, déjà journalisé)
    const cap = getServerEnv().SMS_GLOBAL_DAILY_CAP;
    console.error(`[SMS_QUOTA] plafond global quotidien atteint (${cap} SMS) : envois suspendus jusqu'à minuit UTC`);
    const supabase = getServiceRoleClient();
    const { error: auditErr } = await supabase.from('audit_logs').insert({
        user_role: 'SYSTEM',
        action: 'SMS_GLOBAL_DAILY_CAP_REACHED',
        object_type: 'sms_quota',
        metadata: { ...context, cap },
    });
    if (auditErr) console.error('[SMS_QUOTA] journalisation de l’alerte impossible :', auditErr.message);
    const { data: admins, error: adminsErr } = await supabase.from('user_roles').select('user_id').eq('role', 'SUPERADMIN');
    if (adminsErr) {
        console.error('[SMS_QUOTA] lecture des superadmins impossible :', adminsErr.message);
        return;
    }
    if (!admins?.length) return;
    const { error: notifErr } = await supabase.from('notifications').insert(admins.map((a) => ({
        user_id: a.user_id,
        type: 'SMS_DAILY_CAP_REACHED',
        title: 'Plafond quotidien de SMS atteint',
        content: `Le plafond de ${cap} SMS par jour est atteint : les envois sont suspendus jusqu'à minuit (UTC, heure de Dakar).`,
        channel: 'PUSH',
        status: 'SENT',
        sent_at: new Date().toISOString(),
        metadata: { ...context, cap },
    })));
    if (notifErr) console.error('[SMS_QUOTA] notification des superadmins impossible :', notifErr.message);
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
        await raiseGlobalCapAlert({ category });
        return {
            ok: false,
            refusal: {
                code: 'SMS_DAILY_CAP_REACHED',
                message: "L'envoi de SMS est momentanément suspendu. Réessayez plus tard ou contactez le support.",
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
