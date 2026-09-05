import { mTargetService } from '@/lib/sms/mtarget.service';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { EmailService, EmailTemplates } from '@/lib/email/email.service';

export interface NotificationResult {
    smsSent: boolean;
    emailSent: boolean;
    inAppCreated: boolean;
    error?: string;
}

// ── Helpers internes ──────────────────────────────────────────────────────

/** Récupère le profil (id, phone, email) de tous les SUPERADMIN et ADMIN en base. */
async function fetchAdminProfiles(): Promise<Array<{ id: string; phone?: string; email?: string }>> {
    try {
        const supabase = getServiceRoleClient();
        const { data, error } = await supabase
            .from('users')
            .select('id, phone, email')
            .or('role.eq.SUPERADMIN,role.eq.ADMIN');

        if (error) {
            console.error('[NOTIFY SUPERADMIN ERROR] fetchAdminProfiles — Supabase query failed:', error.message, error.code, error.details);
            return [];
        }

        if (!data || data.length === 0) {
            console.warn('[NOTIFY SUPERADMIN WARNING] fetchAdminProfiles — Aucun SUPERADMIN/ADMIN trouvé en base. Vérifiez que des utilisateurs avec role SUPERADMIN existent.');
            return [];
        }

        console.log(`[NOTIFY SUPERADMIN] fetchAdminProfiles — ${data.length} admin(s) trouvé(s):`, data.map(a => ({ id: a.id, email: a.email, hasPhone: !!a.phone })));
        return data as Array<{ id: string; phone?: string; email?: string }>;
    } catch (err) {
        console.error('[NOTIFY SUPERADMIN ERROR] fetchAdminProfiles — Exception inattendue:', err instanceof Error ? err.message : err);
        return [];
    }
}

// =========================================================================

export class NotificationService {

    // =========================================================================
    // WORKFLOW 1 — Inscription Partenaire
    // CDC : 3 canaux pour le partenaire + 3 canaux pour les SuperAdmins
    // =========================================================================
    static async sendPartnerRegistrationNotification(params: {
        email: string;
        phone: string;
        companyName: string;
        partnerName?: string;
        userId?: string;
    }): Promise<NotificationResult> {
        const name = params.partnerName || params.companyName;
        const smsToPartner = `Event Village: Votre inscription pour "${params.companyName}" a bien été reçue. Notre équipe administrative procède à son examen.`;
        const smsToAdmin = `EV ADMIN: Nouvelle candidature partenaire "${params.companyName}" (${params.email}) en attente de validation. Dashboard: /admin/dashboard`;

        // ── Canal 1 : SMS → Partenaire ────────────────────────────────────
        let smsSent = false;
        if (params.phone) {
            try {
                const res = await mTargetService.sendSms(params.phone, smsToPartner);
                smsSent = res.success;
            } catch (err) {
                console.warn('[NotificationService] SMS inscription partenaire:', err instanceof Error ? err.message : err);
            }
        }

        // ── Canal 2 : Email → Partenaire ──────────────────────────────────
        let emailSent = false;
        if (params.email) {
            try {
                const tpl = EmailTemplates.partnerRegistrationConfirmation({
                    partnerName: name,
                    companyName: params.companyName,
                });
                const res = await EmailService.send({ to: params.email, ...tpl });
                emailSent = res.sent;
            } catch (err) {
                console.warn('[NotificationService] Email inscription partenaire:', err instanceof Error ? err.message : err);
            }
        }

        // ── Canal 3 : In-App → Partenaire ─────────────────────────────────
        let inAppCreated = false;
        if (params.userId) {
            try {
                const supabase = getServiceRoleClient();
                await supabase.from('notifications').insert({
                    user_id: params.userId,
                    type: 'KYC',
                    title: 'Inscription Reçue',
                    content: smsToPartner,
                    channel: 'PUSH',
                    status: 'PENDING',
                    metadata: { companyName: params.companyName },
                });
                inAppCreated = true;
            } catch (err) {
                console.warn('[NotificationService] In-App inscription partenaire:', err instanceof Error ? err.message : err);
            }
        }

        // ── Triple notification SuperAdmins (In-App + SMS + Email) ────────
        await NotificationService.notifySuperadmins({
            title: 'Nouvelle Candidature Partenaire',
            content: `Le partenaire "${params.companyName}" a soumis son dossier d'inscription en attente de vérification.`,
            type: 'KYC',
            metadata: { companyName: params.companyName, userId: params.userId, actionUrl: '/admin/dashboard' },
            smsMessage: smsToAdmin,
            emailTemplate: EmailTemplates.superadminNewPartnerAlert({
                partnerName: name,
                companyName: params.companyName,
                partnerEmail: params.email,
                partnerPhone: params.phone,
            }),
        });

        return { smsSent, emailSent, inAppCreated };
    }

    // =========================================================================
    // HELPER — Notifier tous les SuperAdmins (In-App + SMS optionnel + Email optionnel)
    // =========================================================================
    static async notifySuperadmins(params: {
        title: string;
        content: string;
        type?: string;
        metadata?: Record<string, unknown>;
        smsMessage?: string;
        emailTemplate?: { subject: string; html: string };
    }): Promise<{ adminsFound: number; inApp: boolean; smsResults: Array<{ phone: string; success: boolean; error?: string }>; emailResult: { sent: number; failed: number } | null }> {
        const result = {
            adminsFound: 0,
            inApp: false,
            smsResults: [] as Array<{ phone: string; success: boolean; error?: string }>,
            emailResult: null as { sent: number; failed: number } | null,
        };

        console.log(`[NOTIFY SUPERADMIN] ▶ Démarrage notification: "${params.title}"`);

        const admins = await fetchAdminProfiles();
        result.adminsFound = admins.length;

        if (admins.length === 0) {
            console.error('[NOTIFY SUPERADMIN ERROR] ✗ 0 admin trouvé → AUCUNE notification envoyée. Vérifiez la table users (role = SUPERADMIN).');
            return result;
        }

        // ── In-App ────────────────────────────────────────────────────────
        try {
            const supabase = getServiceRoleClient();
            const notifs = admins.map(a => ({
                user_id: a.id,
                type: params.type || 'KYC',
                title: params.title,
                content: params.content,
                channel: 'PUSH' as const,
                status: 'PENDING' as const,
                metadata: params.metadata || {},
            }));
            const { error: insertErr } = await supabase.from('notifications').insert(notifs);
            if (insertErr) {
                console.error('[NOTIFY SUPERADMIN ERROR] ✗ In-App insert failed:', insertErr.message, insertErr.code, insertErr.details);
            } else {
                result.inApp = true;
                console.log(`[NOTIFY SUPERADMIN] ✓ In-App: ${admins.length} notification(s) insérée(s)`);
            }
        } catch (err) {
            console.error('[NOTIFY SUPERADMIN ERROR] ✗ In-App exception:', err instanceof Error ? err.message : err);
        }

        // ── SMS → chaque admin qui a un téléphone ─────────────────────────
        if (params.smsMessage) {
            const phones = admins.map(a => a.phone).filter(Boolean) as string[];
            if (phones.length === 0) {
                console.warn('[NOTIFY SUPERADMIN WARNING] Aucun admin n\'a de numéro de téléphone → SMS ignoré');
            } else {
                const smsSettled = await Promise.allSettled(
                    phones.map(async (phone) => {
                        try {
                            const res = await mTargetService.sendSms(phone, params.smsMessage!);
                            const entry = { phone, success: res.success, error: res.success ? undefined : (res.error || 'Échec inconnu') };
                            console.log(`[NOTIFY SUPERADMIN] ${res.success ? '✓' : '✗'} SMS → ${phone}:`, res.success ? 'envoyé' : (res.error || 'échec'));
                            return entry;
                        } catch (err) {
                            const errMsg = err instanceof Error ? err.message : String(err);
                            console.error(`[NOTIFY SUPERADMIN ERROR] ✗ SMS → ${phone}: exception:`, errMsg);
                            return { phone, success: false, error: errMsg };
                        }
                    })
                );
                result.smsResults = smsSettled.map(s => s.status === 'fulfilled' ? s.value : { phone: '?', success: false, error: 'Promise rejected' });
            }
        }

        // ── Email → chaque admin qui a un email ───────────────────────────
        if (params.emailTemplate) {
            const emails = admins.map(a => a.email).filter(Boolean) as string[];
            if (emails.length === 0) {
                console.warn('[NOTIFY SUPERADMIN WARNING] Aucun admin n\'a d\'email → Email ignoré');
            } else {
                try {
                    const emailRes = await EmailService.sendToMany(emails, params.emailTemplate);
                    result.emailResult = emailRes;
                    console.log(`[NOTIFY SUPERADMIN] ${emailRes.sent > 0 ? '✓' : '✗'} Email: ${emailRes.sent} envoyé(s), ${emailRes.failed} échoué(s) sur ${emails.length} destinataire(s)`);
                } catch (err) {
                    console.error('[NOTIFY SUPERADMIN ERROR] ✗ Email exception:', err instanceof Error ? err.message : err);
                    result.emailResult = { sent: 0, failed: emails.length };
                }
            }
        }

        console.log('[NOTIFY SUPERADMIN] ◀ Résultat final:', JSON.stringify(result));
        return result;
    }

    // =========================================================================
    // NOTIFICATION OTP
    // =========================================================================
    static async sendOtpNotification(params: {
        phone: string;
        code: string;
        validityMinutes?: number;
    }): Promise<NotificationResult> {
        const minutes = params.validityMinutes || 10;
        const msg = `Event Village: Votre code de confirmation est ${params.code}. Il est valable ${minutes} minutes. Ne le partagez jamais.`;

        let smsSent = false;
        try {
            const res = await mTargetService.sendSms(params.phone, msg);
            smsSent = res.success;
        } catch (err) {
            console.warn('[NotificationService] SMS OTP:', err instanceof Error ? err.message : err);
        }

        return { smsSent, emailSent: false, inAppCreated: false };
    }

    // =========================================================================
    // WORKFLOW 2 — Validation / Rejet Admin
    // CDC : 3 canaux pour le partenaire
    // =========================================================================
    static async sendAdminValidationNotification(params: {
        email: string;
        phone: string;
        companyName: string;
        partnerName?: string;
        approved: boolean;
        rejectionReason?: string;
        userId?: string;
    }): Promise<NotificationResult> {
        const name = params.partnerName || params.companyName;

        const smsMessage = params.approved
            ? `Event Village: Félicitations ! Votre compte partenaire "${params.companyName}" a été validé. Rendez-vous sur votre espace pro.`
            : `Event Village: Votre demande partenaire pour "${params.companyName}" n'a pas été retenue.${params.rejectionReason ? ` Motif: ${params.rejectionReason}` : ''}`;

        // ── Canal 1 : SMS → Partenaire ────────────────────────────────────
        let smsSent = false;
        if (params.phone) {
            try {
                const res = await mTargetService.sendSms(params.phone, smsMessage);
                smsSent = res.success;
            } catch (err) {
                console.warn('[NotificationService] SMS validation partenaire:', err instanceof Error ? err.message : err);
            }
        }

        // ── Canal 2 : Email → Partenaire ──────────────────────────────────
        let emailSent = false;
        if (params.email) {
            try {
                const tpl = params.approved
                    ? EmailTemplates.partnerAccountValidated({ partnerName: name, companyName: params.companyName })
                    : EmailTemplates.partnerAccountRejected({ partnerName: name, companyName: params.companyName, reason: params.rejectionReason });
                const res = await EmailService.send({ to: params.email, ...tpl });
                emailSent = res.sent;
            } catch (err) {
                console.warn('[NotificationService] Email validation partenaire:', err instanceof Error ? err.message : err);
            }
        }

        // ── Canal 3 : In-App → Partenaire ─────────────────────────────────
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
            } catch (err) {
                console.warn('[NotificationService] In-App validation partenaire:', err instanceof Error ? err.message : err);
            }
        }

        return { smsSent, emailSent, inAppCreated };
    }

    // =========================================================================
    // NOTIFICATION — Première Activation (avec idempotency guard)
    // =========================================================================
    static async sendFirstActivationNotification(params: {
        email: string;
        phone: string;
        companyName: string;
        trialDays: number;
        trialEndsAt: string;
        userId?: string;
    }): Promise<NotificationResult> {
        // Idempotency guard
        if (params.userId) {
            try {
                const supabase = getServiceRoleClient();
                const { data: existing } = await supabase
                    .from('notifications')
                    .select('id')
                    .eq('user_id', params.userId)
                    .eq('title', "Période d'Essai Activée")
                    .limit(1);
                if (existing && existing.length > 0) {
                    return { smsSent: false, emailSent: false, inAppCreated: false };
                }
            } catch {
                // poursuite si le guard échoue
            }
        }

        const d = new Date(params.trialEndsAt);
        const formattedDate = d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
        const smsMessage = `Event Village: Bienvenue ! Votre période d'essai de ${params.trialDays} jours est active jusqu'au ${formattedDate}. Accédez à votre tableau de bord.`;

        let smsSent = false;
        if (params.phone) {
            try {
                const res = await mTargetService.sendSms(params.phone, smsMessage);
                smsSent = res.success;
            } catch (err) {
                console.warn('[NotificationService] SMS première activation:', err instanceof Error ? err.message : err);
            }
        }

        let inAppCreated = false;
        if (params.userId) {
            try {
                const supabase = getServiceRoleClient();
                await supabase.from('notifications').insert({
                    user_id: params.userId,
                    type: 'SYSTEM',
                    title: "Période d'Essai Activée",
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

        return { smsSent, emailSent: false, inAppCreated };
    }

    // =========================================================================
    // NOTIFICATION — Mot de Passe Oublié
    // =========================================================================
    static async sendPasswordResetNotification(params: {
        email?: string;
        phone?: string;
        resetCode: string;
    }): Promise<NotificationResult> {
        const smsMessage = `Event Village: Votre code de réinitialisation est : ${params.resetCode}. Valable 10 minutes.`;

        let smsSent = false;
        if (params.phone) {
            try {
                const res = await mTargetService.sendSms(params.phone, smsMessage);
                smsSent = res.success;
            } catch (err) {
                console.warn('[NotificationService] SMS reset password:', err instanceof Error ? err.message : err);
            }
        }

        return { smsSent, emailSent: !!params.email, inAppCreated: false };
    }

    // =========================================================================
    // NOTIFICATION — Opération Sensible (Retrait, modification coordonnées)
    // =========================================================================
    static async sendSensitiveActionOtpNotification(params: {
        phone: string;
        actionName: string;
        code: string;
        userId?: string;
    }): Promise<NotificationResult> {
        const msg = `Event Village SÉCURITÉ: Code ${params.code} requis pour : ${params.actionName}. Ne le communiquez à personne.`;

        let smsSent = false;
        try {
            const res = await mTargetService.sendSms(params.phone, msg);
            smsSent = res.success;
        } catch (err) {
            console.warn('[NotificationService] SMS opération sensible:', err instanceof Error ? err.message : err);
        }

        return { smsSent, emailSent: false, inAppCreated: false };
    }

    // =========================================================================
    // WORKFLOW RÉACTIVATION — Partenaire SUSPENDU → VALIDE
    // CDC : 3 canaux pour le partenaire
    // =========================================================================
    static async sendReactivationNotification(params: {
        email: string;
        phone: string;
        companyName: string;
        partnerName?: string;
        userId?: string;
    }): Promise<NotificationResult> {
        const name = params.partnerName || params.companyName;
        const smsMessage = `Event Village: Votre compte Partenaire "${params.companyName}" est à nouveau actif ! Bonnes ventes.`;
        const inAppContent = `Bonne nouvelle ! Votre compte Partenaire "${params.companyName}" a été réactivé. Vous pouvez reprendre vos activités.`;

        // ── Canal 1 : SMS → Partenaire ────────────────────────────────────
        let smsSent = false;
        if (params.phone) {
            try {
                const res = await mTargetService.sendSms(params.phone, smsMessage);
                smsSent = res.success;
            } catch (err) {
                console.warn('[NotificationService] SMS réactivation:', err instanceof Error ? err.message : err);
            }
        }

        // ── Canal 2 : Email → Partenaire ──────────────────────────────────
        let emailSent = false;
        if (params.email) {
            try {
                const tpl = EmailTemplates.partnerAccountReactivated({
                    partnerName: name,
                    companyName: params.companyName,
                });
                const res = await EmailService.send({ to: params.email, ...tpl });
                emailSent = res.sent;
            } catch (err) {
                console.warn('[NotificationService] Email réactivation:', err instanceof Error ? err.message : err);
            }
        }

        // ── Canal 3 : In-App → Partenaire ─────────────────────────────────
        let inAppCreated = false;
        if (params.userId) {
            try {
                const supabase = getServiceRoleClient();
                await supabase.from('notifications').insert({
                    user_id: params.userId,
                    type: 'SYSTEM',
                    title: 'Compte Partenaire Réactivé !',
                    content: inAppContent,
                    channel: 'PUSH',
                    status: 'PENDING',
                    metadata: { companyName: params.companyName, reactivated: true },
                });
                inAppCreated = true;
            } catch (err) {
                console.warn('[NotificationService] In-App réactivation:', err instanceof Error ? err.message : err);
            }
        }

        return { smsSent, emailSent, inAppCreated };
    }

    // =========================================================================
    // NOTIFICATION — Suspension Partenaire
    // =========================================================================
    static async sendSuspensionNotification(params: {
        email: string;
        phone: string;
        companyName: string;
        partnerName?: string;
        reason: string;
        userId?: string;
    }): Promise<NotificationResult> {
        const name = params.partnerName || params.companyName;
        const smsMessage = `Event Village: Votre compte partenaire "${params.companyName}" a été suspendu. Motif: ${params.reason}. Contactez le support officiel.`;

        // ── Canal 1 : SMS → Partenaire ────────────────────────────────────
        let smsSent = false;
        if (params.phone) {
            try {
                const res = await mTargetService.sendSms(params.phone, smsMessage);
                smsSent = res.success;
            } catch (err) {
                console.warn('[NotificationService] SMS suspension:', err instanceof Error ? err.message : err);
            }
        }

        // ── Canal 2 : Email → Partenaire ──────────────────────────────────
        let emailSent = false;
        if (params.email) {
            try {
                const tpl = EmailTemplates.partnerAccountSuspended({
                    partnerName: name,
                    companyName: params.companyName,
                    reason: params.reason,
                });
                const res = await EmailService.send({ to: params.email, ...tpl });
                emailSent = res.sent;
            } catch (err) {
                console.warn('[NotificationService] Email suspension:', err instanceof Error ? err.message : err);
            }
        }

        // ── Canal 3 : In-App → Partenaire ─────────────────────────────────
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

        return { smsSent, emailSent, inAppCreated };
    }

    // =========================================================================
    // HELPER GÉNÉRIQUE — Notification in-app
    // =========================================================================
    static async createNotification(params: {
        userId: string;
        title: string;
        message: string;
        type?: 'SYSTEM' | 'COMMUNICATION' | 'KYC' | 'RESERVATION' | 'ORDER' | 'PAYMENT' | 'ALERT';
        data?: Record<string, unknown>;
    }): Promise<boolean> {
        try {
            const supabase = getServiceRoleClient();
            await supabase.from('notifications').insert({
                user_id: params.userId,
                type: params.type || 'SYSTEM',
                title: params.title,
                content: params.message,
                channel: 'PUSH',
                status: 'PENDING',
                metadata: params.data || {},
            });
            return true;
        } catch (err) {
            console.warn('[NotificationService.createNotification]:', err instanceof Error ? err.message : err);
            return false;
        }
    }
}
