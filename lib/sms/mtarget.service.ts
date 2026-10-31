/**
 * Façade SMS métier (OTP, invitations contrôleur, notifications).
 *
 * L'envoi effectif passe par l'adaptateur fourni par le registre d'intégrations :
 * MTarget en production, faux adaptateur (sans réseau) en test.
 */
import { getSmsAdapter, integrationsMode } from '@/lib/integrations/registry';
import type { SmsAdapter, SmsSendResult } from '@/lib/integrations/types';
import { MTargetHttpAdapter, type MTargetConfig } from './mtarget-http.adapter';

export { formatMTargetPhoneNumber } from './mtarget-http.adapter';
export type { MTargetConfig } from './mtarget-http.adapter';

export type MTargetSendResult = SmsSendResult;

export class MTargetService {
    private readonly dedicatedAdapter: SmsAdapter | null;

    /**
     * @param config Configuration explicite (identifiants, URL). Lorsqu'elle est fournie
     *               hors mode test, un adaptateur HTTP dédié est utilisé. En mode test
     *               (EV_INTEGRATIONS=fake), le faux adaptateur du registre est toujours
     *               utilisé : aucune configuration ne peut rétablir le réseau.
     */
    constructor(config?: MTargetConfig) {
        this.dedicatedAdapter = config && integrationsMode() === 'real' ? new MTargetHttpAdapter(config) : null;
    }

    private adapter(): SmsAdapter {
        return this.dedicatedAdapter ?? getSmsAdapter();
    }

    /**
     * Envoie un SMS générique.
     */
    async sendSms(to: string, message: string): Promise<MTargetSendResult> {
        return this.adapter().sendSms(to, message);
    }

    /**
     * Envoi spécifique d'un code OTP (utilisé par le Hook Supabase Auth)
     */
    async sendOtp(phone: string, otpCode: string): Promise<MTargetSendResult> {
        const message = `Votre code de verification Event Village est : ${otpCode}. Valable 10 minutes.`;
        return this.sendSms(phone, message);
    }

    async sendControllerInvite(phone: string, otpCode: string, setupLink: string, firstName?: string): Promise<MTargetSendResult> {
        const greeting = firstName && firstName.trim() ? `Bonjour ${firstName.trim()}, vous etes invite` : `Vous etes invite`;
        const message = `Event Village : ${greeting} comme controleur. Code : ${otpCode} (valable 24h). Activez votre compte : ${setupLink}`;
        return this.sendSms(phone, message);
    }

    async sendControllerActivationConfirmation(phone: string): Promise<MTargetSendResult> {
        const message = `Event Village : Votre compte controleur est active avec succes. Vous pouvez desormais vous connecter et scanner les billets.`;
        return this.sendSms(phone, message);
    }

    async sendControllerRevocationNotice(phone: string, eventTitle: string): Promise<MTargetSendResult> {
        const message = `Event Village : Votre acces controleur pour l'evenement "${eventTitle}" a pris fin.`;
        return this.sendSms(phone, message);
    }

    async sendControllerAllEventsRevokedNotice(phone: string): Promise<MTargetSendResult> {
        const message = `Event Village : Vos affectations en tant que controleur ont ete retirees par l'organisateur. Vous n'avez plus d'evenement actif.`;
        return this.sendSms(phone, message);
    }

    async sendControllerAccountDeletedNotice(phone: string): Promise<MTargetSendResult> {
        const message = `Event Village : Votre compte controleur a ete desactive de l'equipe organisatrice.`;
        return this.sendSms(phone, message);
    }

    async sendControllerAssignmentsUpdatedNotice(phone: string, eventCount: number): Promise<MTargetSendResult> {
        const message = `Event Village : Vos affectations de controleur ont ete mises a jour (${eventCount} evenement(s) assigne(s)).`;
        return this.sendSms(phone, message);
    }

    /**
     * Envoi de notification métier (ex: confirmation d'achat de ticket, validation de réservation)
     */
    async sendNotification(phone: string, message: string): Promise<MTargetSendResult> {
        return this.sendSms(phone, message);
    }
}

// Singleton par défaut pour l'application
export const mTargetService = new MTargetService();
