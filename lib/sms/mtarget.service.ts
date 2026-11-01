/**
 * Façade SMS métier (OTP, invitations contrôleur, notifications).
 *
 * L'envoi effectif passe par l'adaptateur fourni par le registre d'intégrations :
 * MTarget en production, faux adaptateur (sans réseau) en test.
 *
 * Lot 1C.9 : point d'envoi unique, gardé. Chaque SMS consomme d'abord une réservation de quota
 * en base (lib/sms/sms-guard.ts) ; un refus ou une garde indisponible renvoie un échec explicite
 * (code SMS_RATE_LIMITED / SMS_DAILY_CAP_REACHED / SMS_ACCOUNT_LIMIT_REACHED / SMS_GUARD_UNAVAILABLE)
 * sans rien envoyer.
 * Aucun autre module n'appelle l'adaptateur SMS directement (contrôlé par les tests).
 */
import { getSmsAdapter } from '@/lib/integrations/registry';
import type { SmsSendResult } from '@/lib/integrations/types';
import { formatMTargetPhoneNumber } from './mtarget-http.adapter';
import { reserveSms, type SmsContext } from './sms-guard';

export { formatMTargetPhoneNumber } from './mtarget-http.adapter';
export type { MTargetConfig } from './mtarget-http.adapter';
export { reserveSms, smsRefusalHttp, type SmsCategory, type SmsContext, SmsReservation } from './sms-guard';

export type MTargetSendResult = SmsSendResult;

export class MTargetService {
    /**
     * Envoie un SMS après réservation de quota (lib/sms/sms-guard.ts). Catégorie par défaut :
     * TRANSACTIONAL (notification) ; `ctx.actorId` = compte connecté qui déclenche l'envoi.
     */
    async sendSms(to: string, message: string, ctx: SmsContext = {}): Promise<MTargetSendResult> {
        let reservation = ctx.reservation;
        if (!reservation) {
            const reserved = await reserveSms(to, ctx);
            if (!reserved.ok) {
                console.warn(`[SMS] envoi refusé par la garde (${reserved.refusal.code}) vers ${formatMTargetPhoneNumber(to).slice(0, 6)}…`);
                return {
                    success: false,
                    recipient: formatMTargetPhoneNumber(to),
                    error: reserved.refusal.message,
                    code: reserved.refusal.code,
                    retryAfterSeconds: reserved.refusal.retryAfterSeconds,
                };
            }
            reservation = reserved.reservation;
        }
        reservation.consume(to);
        return getSmsAdapter().sendSms(to, message);
    }

    /** Code OTP (catégorie OTP : limites par numéro et par IP en plus). */
    async sendOtp(phone: string, otpCode: string, ctx: SmsContext = {}): Promise<MTargetSendResult> {
        const message = `Votre code de verification Event Village est : ${otpCode}. Valable 10 minutes.`;
        return this.sendSms(phone, message, { category: 'OTP', ...ctx });
    }

    async sendControllerInvite(phone: string, otpCode: string, setupLink: string, firstName?: string, ctx: SmsContext = {}): Promise<MTargetSendResult> {
        const greeting = firstName && firstName.trim() ? `Bonjour ${firstName.trim()}, vous etes invite` : `Vous etes invite`;
        const message = `Event Village : ${greeting} comme controleur. Code : ${otpCode} (valable 24h). Activez votre compte : ${setupLink}`;
        return this.sendSms(phone, message, { category: 'CONTROLLER_INVITE', ...ctx });
    }

    /**
     * Reçu d'une vente au guichet (lot 5, C7) : catégorie COUNTER_RECEIPT, quota par caisse. Texte sans
     * accents (SMS GSM), sans donnée personnelle.
     */
    async sendCounterReceipt(phone: string, receipt: { eventTitle: string; ticketCount: number; amount: number; reference: string }, shiftId: string): Promise<MTargetSendResult> {
        const amount = String(Math.trunc(receipt.amount)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
        const tickets = receipt.ticketCount > 1 ? `${receipt.ticketCount} billets` : '1 billet';
        const message = `Event Village : achat au guichet pour "${receipt.eventTitle}" - ${tickets}, ${amount} F CFA. Entree validee. Ref ${receipt.reference}.`;
        return this.sendSms(phone, message, { category: 'COUNTER_RECEIPT', shiftId });
    }

    async sendControllerActivationConfirmation(phone: string, ctx: SmsContext = {}): Promise<MTargetSendResult> {
        const message = `Event Village : Votre compte controleur est active avec succes. Vous pouvez desormais vous connecter et scanner les billets.`;
        return this.sendSms(phone, message, ctx);
    }

    async sendControllerRevocationNotice(phone: string, eventTitle: string, ctx: SmsContext = {}): Promise<MTargetSendResult> {
        const message = `Event Village : Votre acces controleur pour l'evenement "${eventTitle}" a pris fin.`;
        return this.sendSms(phone, message, ctx);
    }

    async sendControllerAllEventsRevokedNotice(phone: string, ctx: SmsContext = {}): Promise<MTargetSendResult> {
        const message = `Event Village : Vos affectations en tant que controleur ont ete retirees par l'organisateur. Vous n'avez plus d'evenement actif.`;
        return this.sendSms(phone, message, ctx);
    }

    async sendControllerAccountDeletedNotice(phone: string, ctx: SmsContext = {}): Promise<MTargetSendResult> {
        const message = `Event Village : Votre compte controleur a ete desactive de l'equipe organisatrice.`;
        return this.sendSms(phone, message, ctx);
    }

    async sendControllerAssignmentsUpdatedNotice(phone: string, eventCount: number, ctx: SmsContext = {}): Promise<MTargetSendResult> {
        const message = `Event Village : Vos affectations de controleur ont ete mises a jour (${eventCount} evenement(s) assigne(s)).`;
        return this.sendSms(phone, message, ctx);
    }

    /**
     * Envoi de notification métier (ex: confirmation d'achat de ticket, validation de réservation)
     */
    async sendNotification(phone: string, message: string, ctx: SmsContext = {}): Promise<MTargetSendResult> {
        return this.sendSms(phone, message, ctx);
    }
}

// Singleton par défaut pour l'application
export const mTargetService = new MTargetService();
