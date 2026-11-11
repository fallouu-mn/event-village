/**
 * Façade SMS métier (OTP, invitation d'un contrôleur, envoi par l'envoyeur de la boîte d'envoi).
 *
 * L'envoi effectif passe par l'adaptateur fourni par le registre d'intégrations :
 * MTarget en production, faux adaptateur (sans réseau) en test.
 *
 * Lot 1C.9 : point d'envoi unique, gardé. Chaque SMS consomme d'abord une réservation de quota
 * en base (lib/sms/sms-guard.ts) ; un refus ou une garde indisponible renvoie un échec explicite
 * (code SMS_RATE_LIMITED / SMS_DAILY_CAP_REACHED / SMS_ACCOUNT_LIMIT_REACHED / SMS_GUARD_UNAVAILABLE)
 * sans rien envoyer.
 * Lot 6 (contrat E6, E7) : chaque résultat porte une issue `outcome` (SENT, REJECTED, UNCERTAIN) ; seuls
 * l'envoyeur de la boîte d'envoi (sendSms) et les envois synchrones (sendOtp, sendControllerInvite)
 * appellent cette façade. Les textes des codes et de l'invitation sont ceux du catalogue
 * (renderSyncSms) ; `ctx.log` inscrit l'envoi dans la boîte d'envoi (notification_sync_log), sans le code.
 * Aucun autre module n'appelle l'adaptateur SMS directement (contrôlé par les tests).
 * Lot 9 bis (I1, contrat 4.7) : hors simulation, les envois synchrones consultent d'abord la garde des comptes de
 * démonstration (lib/notifications/demo-guard.ts), avant toute réservation de quota : un destinataire de
 * démonstration ne reçoit rien (SMS_DEMO_ACCOUNT, journal SKIPPED DEMO_ACCOUNT) ; garde indisponible : rien ne part
 * (SMS_GUARD_UNAVAILABLE).
 */
import { getSmsAdapter } from '@/lib/integrations/registry';
import type { SmsSendResult } from '@/lib/integrations/types';
import { renderSyncSms } from '@/lib/notifications/catalog';
import { demoBlockedKeys, demoGuardActive } from '@/lib/notifications/demo-guard';
import { logSyncSms, type SyncLogContext, type SyncSmsOutcome, type SyncSmsType } from '@/lib/notifications/sync-log';
import { formatMTargetPhoneNumber, type MTargetOutcome } from './mtarget-http.adapter';
import { reserveSms, type SmsContext } from './sms-guard';

export { formatMTargetPhoneNumber } from './mtarget-http.adapter';
export type { MTargetConfig, MTargetOutcome, MTargetSmsResult } from './mtarget-http.adapter';
export { reserveSms, smsRefusalHttp, type SmsCategory, type SmsContext, SmsReservation } from './sms-guard';
export type { SyncLogContext } from '@/lib/notifications/sync-log';

/** Résultat de la façade : `SmsSendResult` plus l'issue du contrat E6 (absente seulement chez un adaptateur ancien). */
export type MTargetSendResult = SmsSendResult & {
    outcome?: MTargetOutcome;
    retryable?: boolean;
    providerCode?: string;
    uncertainty?: 'PROVIDER_TIMEOUT' | 'PROVIDER_UNREADABLE';
};

/** Objet d'un code à usage unique : fixe le texte (réinitialisation) et le type du journal. */
export type OtpSmsPurpose = 'LOGIN' | 'REGISTER' | 'PASSWORD_RESET' | 'WITHDRAWAL' | 'PHONE_CHANGE' | 'AUTH_HOOK';

const OTP_TYPE_BY_PURPOSE: Readonly<Record<OtpSmsPurpose, SyncSmsType>> = {
    LOGIN: 'OTP_LOGIN',
    REGISTER: 'OTP_REGISTER',
    PASSWORD_RESET: 'OTP_PASSWORD_RESET',
    WITHDRAWAL: 'OTP_WITHDRAWAL',
    PHONE_CHANGE: 'OTP_PHONE_CHANGE',
    AUTH_HOOK: 'OTP_AUTH_HOOK',
};

/** Contexte d'un envoi synchrone : garde (SmsContext), objet du code, journal sans code. */
export type SyncSmsContext = SmsContext & {
    purpose?: OtpSmsPurpose;
    log?: SyncLogContext;
};

/**
 * Lecture unique d'un résultat SMS (envoyeur et journal synchrone) :
 *  - GUARD_REFUSED : la garde anti-abus a refusé, rien n'est parti (motif SMS_DAILY_CAP, SMS_ACCOUNT_CAP,
 *    SMS_RECIPIENT_CAP) ; GUARD_UNAVAILABLE : garde indisponible, rien n'est parti ;
 *  - SENT ; RETRYABLE : refus temporaire, rien n'est parti ; REJECTED : refus définitif ;
 *  - UNCERTAIN : peut-être parti (jamais renvoyé).
 */
export type SmsResultKind = 'SENT' | 'GUARD_REFUSED' | 'GUARD_UNAVAILABLE' | 'RETRYABLE' | 'REJECTED' | 'UNCERTAIN';

export interface SmsResultClass {
    kind: SmsResultKind;
    /** Motif de la boîte d'envoi (contrat C4) ; absent pour SENT. */
    reason?: string;
    /** Détail lisible (jamais le texte du message). */
    detail?: string;
}

export function classifySmsResult(res: MTargetSendResult): SmsResultClass {
    switch (res.code) {
        case 'SMS_DAILY_CAP_REACHED':
            return { kind: 'GUARD_REFUSED', reason: 'SMS_DAILY_CAP', detail: res.error };
        case 'SMS_ACCOUNT_LIMIT_REACHED':
            return { kind: 'GUARD_REFUSED', reason: 'SMS_ACCOUNT_CAP', detail: res.error };
        case 'SMS_RATE_LIMITED':
            return { kind: 'GUARD_REFUSED', reason: 'SMS_RECIPIENT_CAP', detail: res.error };
        case 'SMS_GUARD_UNAVAILABLE':
            return { kind: 'GUARD_UNAVAILABLE', reason: 'SMS_GUARD_UNAVAILABLE', detail: res.error };
        case 'SMS_DEMO_ACCOUNT':
            return { kind: 'GUARD_REFUSED', reason: 'DEMO_ACCOUNT', detail: res.error };
        default:
            break;
    }
    const outcome: MTargetOutcome = res.outcome ?? (res.success ? 'SENT' : 'REJECTED');
    if (outcome === 'SENT') return { kind: 'SENT' };
    if (outcome === 'UNCERTAIN') return { kind: 'UNCERTAIN', reason: res.uncertainty ?? 'PROVIDER_TIMEOUT', detail: res.error };
    const detail = res.providerCode ? `code ${res.providerCode} : ${res.error ?? 'refus du fournisseur'}` : res.error;
    // Issue absente (adaptateur antérieur au lot 6) : refus traité comme temporaire (lib/integrations/types.ts).
    if (res.retryable === true || res.outcome === undefined) return { kind: 'RETRYABLE', reason: 'SMS_PROVIDER_ERROR', detail };
    return { kind: 'REJECTED', reason: 'SMS_REJECTED', detail };
}

/** Issue d'un envoi synchrone pour le journal (statut final, motif obligatoire hors SENT). */
function syncLogOutcome(res: MTargetSendResult): { outcome: SyncSmsOutcome; reason?: string } {
    const c = classifySmsResult(res);
    switch (c.kind) {
        case 'SENT':
            return { outcome: 'SENT' };
        case 'GUARD_REFUSED':
            return { outcome: 'SKIPPED', reason: c.reason };
        case 'UNCERTAIN':
            return { outcome: 'UNCERTAIN', reason: c.reason };
        default:
            return { outcome: 'FAILED', reason: c.reason };
    }
}

/** Contexte de la garde seul (sans objet ni journal). */
function guardContext(ctx: SyncSmsContext): SmsContext {
    return { ip: ctx.ip, actorId: ctx.actorId, shiftId: ctx.shiftId, reservation: ctx.reservation };
}

/** Clé de l'unique destinataire d'un envoi synchrone dans l'appel à la garde des comptes de démonstration. */
const SYNC_DEMO_KEY = 'sync';

/**
 * Lot 9 bis (I1) : refus d'un envoi synchrone vers un destinataire de démonstration, hors simulation ; null si
 * l'envoi peut continuer. Consultée avant la réservation de quota : un SMS retenu ne consomme rien.
 */
async function demoRefusal(phone: string, ctx: SyncSmsContext): Promise<MTargetSendResult | null> {
    if (!demoGuardActive()) return null;
    const guard = await demoBlockedKeys([{ key: SYNC_DEMO_KEY, phone, user_id: ctx.log?.userId ?? null }]);
    const recipient = formatMTargetPhoneNumber(phone);
    if (!guard.ok) {
        return {
            success: false, outcome: 'REJECTED', retryable: false, recipient, code: 'SMS_GUARD_UNAVAILABLE',
            error: 'Contrôle des comptes de démonstration indisponible : aucun SMS envoyé.',
        };
    }
    if (!guard.blocked.has(SYNC_DEMO_KEY)) return null;
    console.warn(`[SMS] envoi retenu : compte de démonstration (${recipient.slice(0, 6)}…)`);
    return {
        success: false, outcome: 'REJECTED', retryable: false, recipient, code: 'SMS_DEMO_ACCOUNT',
        error: 'Compte de démonstration : aucun SMS hors simulation.',
    };
}

export class MTargetService {
    /**
     * Envoie un SMS après réservation de quota (lib/sms/sms-guard.ts). Catégorie par défaut :
     * TRANSACTIONAL (notification) ; `ctx.actorId` = compte connecté qui déclenche l'envoi. Lot 7 (7.0 a) :
     * `ctx.family` (famille du registre, posée par l'envoyeur) est transmise telle quelle à la garde : un SMS
     * ESSENTIAL n'est soumis à aucun plafond journalier global. Les envois synchrones (sendOtp,
     * sendControllerInvite) ne la transmettent pas (guardContext) : l'invitation garde la part non OTP (D14).
     */
    async sendSms(to: string, message: string, ctx: SmsContext = {}): Promise<MTargetSendResult> {
        let reservation = ctx.reservation;
        if (!reservation) {
            const reserved = await reserveSms(to, ctx);
            if (!reserved.ok) {
                console.warn(`[SMS] envoi refusé par la garde (${reserved.refusal.code}) vers ${formatMTargetPhoneNumber(to).slice(0, 6)}…`);
                return {
                    success: false,
                    outcome: 'REJECTED',
                    retryable: false,
                    recipient: formatMTargetPhoneNumber(to),
                    error: reserved.refusal.message,
                    code: reserved.refusal.code,
                    retryAfterSeconds: reserved.refusal.retryAfterSeconds,
                };
            }
            reservation = reserved.reservation;
        }
        reservation.consume(to);
        return getSmsAdapter().sendSms(to, message) as Promise<MTargetSendResult>;
    }

    /**
     * Code à usage unique (catégorie OTP : limites par numéro et par IP en plus). Texte du catalogue selon
     * l'objet (`ctx.purpose`, réinitialisation à part) ; `ctx.log` journalise l'envoi sans le code.
     */
    async sendOtp(phone: string, otpCode: string, ctx: SyncSmsContext = {}): Promise<MTargetSendResult> {
        const type: SyncSmsType = ctx.log?.type ?? OTP_TYPE_BY_PURPOSE[ctx.purpose ?? 'LOGIN'];
        const message = renderSyncSms(type, { code: otpCode });
        const result = (await demoRefusal(phone, ctx)) ?? await this.sendSms(phone, message, { ...guardContext(ctx), category: 'OTP' });
        if (ctx.log) await this.journal(ctx.log, phone, result);
        return result;
    }

    /** Invitation d'un nouveau contrôleur : code d'activation 24 h et lien (texte du catalogue). */
    async sendControllerInvite(phone: string, otpCode: string, setupLink: string, firstName?: string, ctx: SyncSmsContext = {}): Promise<MTargetSendResult> {
        const name = firstName && firstName.trim() ? firstName.trim() : undefined;
        const message = renderSyncSms('CONTROLLER_INVITE', { code: otpCode, setupLink, ...(name ? { firstName: name } : {}) });
        const result = (await demoRefusal(phone, ctx)) ?? await this.sendSms(phone, message, { ...guardContext(ctx), category: 'CONTROLLER_INVITE' });
        if (ctx.log) await this.journal(ctx.log, phone, result);
        return result;
    }

    /**
     * Alias historique de sendSms (contrat K : conservé pour tests/fondations-lot0.test.ts). Aucun module
     * applicatif ne l'appelle : les notifications passent par la boîte d'envoi et son envoyeur.
     */
    async sendNotification(phone: string, message: string, ctx: SmsContext = {}): Promise<MTargetSendResult> {
        return this.sendSms(phone, message, ctx);
    }

    /** Journal synchrone (E7) : l'échec d'écriture est journalisé par logSyncSms, le code parti n'est pas annulé. */
    private async journal(log: SyncLogContext, phone: string, result: MTargetSendResult): Promise<void> {
        const { outcome, reason } = syncLogOutcome(result);
        await logSyncSms({ ...log, phone, outcome, reason, providerMessageId: result.messageId ?? null });
    }
}

// Singleton par défaut pour l'application
export const mTargetService = new MTargetService();
