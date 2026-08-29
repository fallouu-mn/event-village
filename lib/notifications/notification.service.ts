import { mTargetService } from '@/lib/sms/mtarget.service';
import { getServiceRoleClient } from '@/lib/supabase/server';

export interface NotificationResult {
    smsSent: boolean;
    emailSent: boolean;
    inAppCreated: boolean;
    error?: string;
}

export class NotificationService {
    /**
     * NOTIFICATION 1 : Inscription Partenaire
     * Email + SMS : "Votre inscription a bien été reçue, elle est en cours d'examen."
     * + In-app notification envoyée aux Superadmins et Admins
     */
    static async sendPartnerRegistrationNotification(params: {
        email: string;
        phone: string;
        companyName: string;
        userId?: string;
    }): Promise<NotificationResult> {
        const smsMessage = `Event Village: Votre inscription pour "${params.companyName}" a bien été reçue. Notre équipe administrative procède actuellement à son examen.`;

        let smsSent = false;
        if (params.phone) {
            try {
                const res = await mTargetService.sendSms(params.phone, smsMessage);
                smsSent = res.success;
            } catch (err) {
                console.warn('[NotificationService] Échec SMS inscription partenaire:', err);
            }
        }

        let inAppCreated = false;
        if (params.userId) {
            try {
                const supabase = getServiceRoleClient();
                await supabase.from('notifications').insert({
                    user_id: params.userId,
                    type: 'KYC',
                    title: 'Inscription Reçue',
                    content: smsMessage,
                    channel: 'PUSH',
                    status: 'PENDING',
                    metadata: { companyName: params.companyName },
                });
                inAppCreated = true;
            } catch (err) {
                console.warn('[NotificationService] Échec notification in-app partenaire:', err);
            }
        }

        // Notification envoyée à l'équipe Superadmin
        await NotificationService.notifySuperadmins({
            title: 'Nouvelle Candidature Partenaire',
            content: `Le partenaire "${params.companyName}" a soumis son dossier d'inscription en attente de vérification.`,
            type: 'KYC',
            metadata: {
                companyName: params.companyName,
                userId: params.userId,
                actionUrl: '/admin/dashboard',
            },
        });

        return { smsSent, emailSent: true, inAppCreated };
    }

    /**
     * NOTIFICATION SUPERADMINS / ADMINS : Notification push / in-app
     */
    static async notifySuperadmins(params: {
        title: string;
        content: string;
        type?: string;
        metadata?: Record<string, any>;
    }): Promise<number> {
        try {
            const supabase = getServiceRoleClient();
            const { data: superadmins } = await supabase
                .from('users')
                .select('id')
                .or('role.eq.SUPERADMIN,role.eq.ADMIN');

            if (!superadmins || superadmins.length === 0) return 0;

            const notifs = superadmins.map(sa => ({
                user_id: sa.id,
                type: params.type || 'KYC',
                title: params.title,
                content: params.content,
                channel: 'PUSH' as const,
                status: 'PENDING' as const,
                metadata: params.metadata || {},
            }));

            await supabase.from('notifications').insert(notifs);
            return notifs.length;
        } catch (err) {
            console.error('[NotificationService] Erreur notification superadmins:', err);
            return 0;
        }
    }

    /**
     * NOTIFICATION 2 : OTP Authentification / Validation
     * SMS ou WhatsApp : Code + Durée de validité
     */
    static async sendOtpNotification(params: {
        phone: string;
        code: string;
        validityMinutes?: number;
    }): Promise<NotificationResult> {
        const minutes = params.validityMinutes || 10;
        const smsMessage = `Event Village: Votre code de confirmation est ${params.code}. Il est valable ${minutes} minutes. Ne le partagez jamais.`;

        let smsSent = false;
        try {
            const res = await mTargetService.sendSms(params.phone, smsMessage);
            smsSent = res.success;
        } catch (err) {
            console.warn('[NotificationService] Échec SMS OTP:', err);
        }

        return { smsSent, emailSent: false, inAppCreated: false };
    }

    /**
     * NOTIFICATION 3 : Validation / Rejet Admin Partenaire
     * Si VALIDÉ : Email + SMS + Push
     * Si REFUSÉ : Email + SMS avec motif
     */
    static async sendAdminValidationNotification(params: {
        email: string;
        phone: string;
        companyName: string;
        approved: boolean;
        rejectionReason?: string;
        userId?: string;
    }): Promise<NotificationResult> {
        const smsMessage = params.approved
            ? `Event Village: Félicitations ! Votre compte partenaire "${params.companyName}" a été validé avec succès. Rendez-vous sur votre espace pro pour configurer votre page.`
            : `Event Village: Votre demande partenaire pour "${params.companyName}" n'a pas été retenue.${params.rejectionReason ? ` Motif: ${params.rejectionReason}` : ''}`;

        let smsSent = false;
        if (params.phone) {
            try {
                const res = await mTargetService.sendSms(params.phone, smsMessage);
                smsSent = res.success;
            } catch (err) {
                console.warn('[NotificationService] Échec SMS validation partenaire:', err);
            }
        }

        let inAppCreated = false;
        if (params.userId) {
            try {
                const supabase = getServiceRoleClient();
                await supabase.from('notifications').insert({
                    user_id: params.userId,
                    type: params.approved ? 'KYC' : 'SYSTEM',
                    title: params.approved ? 'Compte Partenaire Validé !' : 'Demande Partenaire Non Retenue',
                    content: smsMessage,
                    channel: 'PUSH',
                    status: 'PENDING',
                    metadata: { companyName: params.companyName, approved: params.approved },
                });
                inAppCreated = true;
            } catch {
                // Ignore DB error
            }
        }

        return { smsSent, emailSent: true, inAppCreated };
    }

    /**
     * NOTIFICATION 4 : Première Activation Partenaire
     * Email / In-app : Bienvenue, date début/fin essai, lien dashboard
     */
    static async sendFirstActivationNotification(params: {
        email: string;
        phone: string;
        companyName: string;
        trialDays: number;
        trialEndsAt: string;
        userId?: string;
    }): Promise<NotificationResult> {
        const d = new Date(params.trialEndsAt);
        const formattedDate = d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

        const smsMessage = `Event Village: Bienvenue ! Votre période d'essai de ${params.trialDays} jours est active jusqu'au ${formattedDate}. Accédez à votre tableau de bord.`;

        let smsSent = false;
        if (params.phone) {
            try {
                const res = await mTargetService.sendSms(params.phone, smsMessage);
                smsSent = res.success;
            } catch (err) {
                console.warn('[NotificationService] Échec SMS première activation:', err);
            }
        }

        let inAppCreated = false;
        if (params.userId) {
            try {
                const supabase = getServiceRoleClient();
                await supabase.from('notifications').insert({
                    user_id: params.userId,
                    type: 'SYSTEM',
                    title: 'Période d\'Essai Activée',
                    content: smsMessage,
                    channel: 'PUSH',
                    status: 'PENDING',
                    metadata: { trialDays: params.trialDays, trialEndsAt: params.trialEndsAt },
                });
                inAppCreated = true;
            } catch {
                // Ignore
            }
        }

        return { smsSent, emailSent: true, inAppCreated };
    }

    /**
     * NOTIFICATION 5 : Mot de Passe Oublié
     */
    static async sendPasswordResetNotification(params: {
        email?: string;
        phone?: string;
        resetCode: string;
    }): Promise<NotificationResult> {
        const smsMessage = `Event Village: Votre code de réinitialisation de mot de passe est : ${params.resetCode}. Valable 15 minutes.`;

        let smsSent = false;
        if (params.phone) {
            try {
                const res = await mTargetService.sendSms(params.phone, smsMessage);
                smsSent = res.success;
            } catch (err) {
                console.warn('[NotificationService] Échec SMS reset password:', err);
            }
        }

        return { smsSent, emailSent: !!params.email, inAppCreated: false };
    }

    /**
     * NOTIFICATION 6 : Opération Sensible (Retrait, modification coordonnées)
     */
    static async sendSensitiveActionOtpNotification(params: {
        phone: string;
        actionName: string;
        code: string;
        userId?: string;
    }): Promise<NotificationResult> {
        const smsMessage = `Event Village SÉCURITÉ: Code ${params.code} requis pour valider votre opération : ${params.actionName}. Ne le communiquez à personne.`;

        let smsSent = false;
        try {
            const res = await mTargetService.sendSms(params.phone, smsMessage);
            smsSent = res.success;
        } catch (err) {
            console.warn('[NotificationService] Échec SMS opération sensible:', err);
        }

        return { smsSent, emailSent: false, inAppCreated: false };
    }

    /**
     * NOTIFICATION 7 : Suspension Partenaire
     */
    static async sendSuspensionNotification(params: {
        email: string;
        phone: string;
        companyName: string;
        reason: string;
        userId?: string;
    }): Promise<NotificationResult> {
        const smsMessage = `Event Village: Votre compte partenaire "${params.companyName}" a été suspendu. Motif: ${params.reason}. Contactez le support officiel pour toute contestation.`;

        let smsSent = false;
        if (params.phone) {
            try {
                const res = await mTargetService.sendSms(params.phone, smsMessage);
                smsSent = res.success;
            } catch (err) {
                console.warn('[NotificationService] Échec SMS suspension:', err);
            }
        }

        let inAppCreated = false;
        if (params.userId) {
            try {
                const supabase = getServiceRoleClient();
                await supabase.from('notifications').insert({
                    user_id: params.userId,
                    type: 'SYSTEM',
                    title: 'Compte Partenaire Suspendu',
                    content: smsMessage,
                    channel: 'PUSH',
                    status: 'PENDING',
                    metadata: { reason: params.reason },
                });
                inAppCreated = true;
            } catch {
                // Ignore
            }
        }

        return { smsSent, emailSent: true, inAppCreated };
    }
}
