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

    // =========================================================================
    // NOTIFICATION — Écart de Caisse (Pre-mortem §2.1)
    // =========================================================================
    static async sendShiftDiscrepancyNotification(params: {
        partnerId: string;
        eventTitle: string;
        controllerName: string;
        discrepancyAmount: number;
        justification: string;
    }): Promise<NotificationResult> {
        let smsSent = false;
        let emailSent = false;
        let inAppCreated = false;

        try {
            const supabase = getServiceRoleClient();
            const { data: partner } = await supabase
                .from('partners')
                .select('id, user_id, phone, company_name')
                .eq('id', params.partnerId)
                .maybeSingle();

            const partnerUserId = partner?.user_id;
            const partnerPhone = partner?.phone;

            const formattedDiscrepancy = params.discrepancyAmount > 0 
                ? `+${params.discrepancyAmount.toLocaleString('fr-FR')} FCFA`
                : `${params.discrepancyAmount.toLocaleString('fr-FR')} FCFA`;

            const smsMessage = `EV ALERTE CAISSE: Écart de ${formattedDiscrepancy} constaté lors de la clôture de caisse (${params.controllerName}) sur "${params.eventTitle}". Justification: "${params.justification}".`;

            if (partnerUserId) {
                inAppCreated = await this.createNotification({
                    userId: partnerUserId,
                    type: 'ALERT',
                    title: `⚠️ Écart de caisse détecté (${formattedDiscrepancy})`,
                    message: `Le contrôleur ${params.controllerName} a clôturé sa session avec un écart de ${formattedDiscrepancy} sur "${params.eventTitle}". Justification : ${params.justification}`,
                    data: {
                        event_title: params.eventTitle,
                        controller_name: params.controllerName,
                        discrepancy_amount: params.discrepancyAmount,
                        justification: params.justification,
                    },
                });
            }

            if (partnerPhone) {
                const res = await mTargetService.sendSms(partnerPhone, smsMessage);
                smsSent = res.success;
            }
        } catch (err) {
            console.warn('[NotificationService] sendShiftDiscrepancyNotification failed:', err);
        }

        return { smsSent, emailSent, inAppCreated };
    }

    // =========================================================================
    // WORKFLOW — Confirmation Achat Billetterie (Client + Organisateur)
    // CDC : In-App + SMS + Email pour l'acheteur ET In-App + SMS/Email organisateur
    // =========================================================================
    static async sendTicketPurchaseNotifications(params: {
        userId: string;
        eventId: string;
        categoryId?: string;
        orderId?: string;
        orderNumber?: string;
        ticketCount: number;
        ticketNumbers: string[];
        totalAmount: number;
        clientPhone?: string;
        clientEmail?: string;
        clientName?: string;
    }): Promise<{
        client: { inApp: boolean; sms: boolean; email: boolean };
        organizer: { inApp: boolean; sms: boolean; email: boolean };
    }> {
        const result = {
            client: { inApp: false, sms: false, email: false },
            organizer: { inApp: false, sms: false, email: false },
        };

        try {
            const supabase = getServiceRoleClient();

            // 1. Récupération des informations Client si non fournies
            let clientPhone = params.clientPhone;
            let clientEmail = params.clientEmail;
            let clientName = params.clientName;

            if (!clientPhone || !clientEmail || !clientName) {
                const { data: userRec } = await supabase
                    .from('users')
                    .select('first_name, last_name, phone, email')
                    .eq('id', params.userId)
                    .maybeSingle();

                if (userRec) {
                    clientName = clientName || `${userRec.first_name || ''} ${userRec.last_name || ''}`.trim() || 'Client';
                    clientPhone = clientPhone || userRec.phone;
                    clientEmail = clientEmail || userRec.email;
                }
            }

            // 2. Récupération des informations Événement + Partenaire
            const { data: eventRec } = await supabase
                .from('events')
                .select(`
                    id,
                    title,
                    location,
                    city,
                    start_date,
                    start_time,
                    partner_id,
                    partners (
                        id,
                        user_id,
                        phone,
                        company_name,
                        commercial_name,
                        users (id, phone, email, first_name, last_name)
                    )
                `)
                .eq('id', params.eventId)
                .maybeSingle();

            const eventTitle = eventRec?.title || 'Événement';
            const eventVenue = eventRec?.location || eventRec?.city || 'Dakar, Sénégal';
            const eventDate = eventRec?.start_date ? new Date(eventRec.start_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : '';
            const orderRef = params.orderNumber || (params.orderId ? `CMD-${params.orderId.slice(0, 8).toUpperCase()}` : `CMD-${Date.now().toString().slice(-6)}`);
            const plural = params.ticketCount > 1;

            // ── CANAL 1 : In-App Acheteur ─────────────────────────────
            result.client.inApp = await NotificationService.createNotification({
                userId: params.userId,
                type: 'TICKET' as any,
                title: '🎟️ Achat confirmé',
                message: plural
                    ? `Vos ${params.ticketCount} billets pour "${eventTitle}" sont disponibles dans votre espace.`
                    : `Votre billet pour "${eventTitle}" est disponible dans votre espace.`,
                data: {
                    event_id: params.eventId,
                    order_id: params.orderId,
                    ticket_count: params.ticketCount,
                    ticket_numbers: params.ticketNumbers,
                    total_amount: params.totalAmount,
                },
            });

            // ── CANAL 2 : SMS Acheteur ───────────────────────────────
            if (clientPhone) {
                const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://event-village.sn';
                const clientSms = plural
                    ? `Event Village : Achat confirme (${params.ticketCount} billets pour "${eventTitle}"). Retrouvez vos billets sur : ${appBaseUrl}/tickets`
                    : `Event Village : Achat confirme (billet pour "${eventTitle}"). Retrouvez votre billet sur : ${appBaseUrl}/tickets`;
                try {
                    const smsRes = await mTargetService.sendSms(clientPhone, clientSms);
                    result.client.sms = smsRes.success;
                } catch (smsErr) {
                    console.warn('[NotificationService] SMS achat billet client échoué:', smsErr);
                }
            }

            // ── CANAL 3 : Email Acheteur ─────────────────────────────
            if (clientEmail && clientEmail.includes('@')) {
                try {
                    const tpl = EmailTemplates.ticketPurchaseConfirmation({
                        clientName: clientName || 'Client',
                        eventTitle,
                        eventDate,
                        eventVenue,
                        ticketCount: params.ticketCount,
                        ticketNumbers: params.ticketNumbers,
                        totalAmount: params.totalAmount,
                        orderNumber: orderRef,
                    });
                    const emailRes = await EmailService.send({ to: clientEmail, ...tpl });
                    result.client.email = emailRes.sent;
                } catch (emailErr) {
                    console.warn('[NotificationService] Email achat billet client échoué:', emailErr);
                }
            }

            // ── CANAL 4 : In-App Organisateur (Partenaire) ───────────
            const partnerData: any = eventRec?.partners;
            const partnerUserId = partnerData?.user_id || partnerData?.users?.id;
            const partnerPhone = partnerData?.phone || partnerData?.users?.phone;
            const partnerEmail = partnerData?.users?.email;
            const organizerName = partnerData?.commercial_name || partnerData?.company_name || 'Organisateur';

            if (partnerUserId) {
                result.organizer.inApp = await NotificationService.createNotification({
                    userId: partnerUserId,
                    type: 'ORDER' as any,
                    title: '🎟️ Nouvelle commande de billets',
                    message: `Un client vient d'acheter ${params.ticketCount} billet(s) pour votre événement "${eventTitle}" (${params.totalAmount.toLocaleString('fr-FR')} FCFA).`,
                    data: {
                        event_id: params.eventId,
                        order_id: params.orderId,
                        ticket_count: params.ticketCount,
                        total_amount: params.totalAmount,
                        buyer_name: clientName,
                    },
                });
            }

            // ── CANAL 5 : SMS Organisateur ────────────────────────────
            if (partnerPhone) {
                const partnerSms = `Event Village : Nouvelle vente de ${params.ticketCount} billet(s) pour "${eventTitle}" (${params.totalAmount.toLocaleString('fr-FR')} FCFA, Réf: ${orderRef}).`;
                try {
                    const orgSmsRes = await mTargetService.sendSms(partnerPhone, partnerSms);
                    result.organizer.sms = orgSmsRes.success;
                } catch (orgSmsErr) {
                    console.warn('[NotificationService] SMS vente billet organisateur échoué:', orgSmsErr);
                }
            }

            // ── CANAL 6 : Email Organisateur ──────────────────────────
            if (partnerEmail && partnerEmail.includes('@')) {
                try {
                    let catName = 'Standard';
                    if (params.categoryId) {
                        const { data: catRec } = await supabase
                            .from('ticket_categories')
                            .select('name')
                            .eq('id', params.categoryId)
                            .maybeSingle();
                        if (catRec?.name) catName = catRec.name;
                    }
                    const tpl = EmailTemplates.organizerTicketSaleAlert({
                        organizerName,
                        eventTitle,
                        ticketCount: params.ticketCount,
                        categoryName: catName,
                        totalAmount: params.totalAmount,
                        orderNumber: orderRef,
                    });
                    const orgEmailRes = await EmailService.send({ to: partnerEmail, ...tpl });
                    result.organizer.email = orgEmailRes.sent;
                } catch (orgEmailErr) {
                    console.warn('[NotificationService] Email vente billet organisateur échoué:', orgEmailErr);
                }
            }
        } catch (err) {
            console.error('[NotificationService.sendTicketPurchaseNotifications] Exception:', err);
        }

        return result;
    }

    // =========================================================================
    // WORKFLOW — Alerte Catégorie Épuisée (SOLD_OUT) Organisateur
    // CDC : In-App + SMS + Email avec garde d'idempotence stricte
    // =========================================================================
    static async sendTicketCategorySoldOutNotification(params: {
        eventId: string;
        categoryId: string;
        categoryName?: string;
        totalQuantity?: number;
    }): Promise<{ inApp: boolean; sms: boolean; email: boolean }> {
        const result = { inApp: false, sms: false, email: false };

        try {
            const supabase = getServiceRoleClient();

            // 1. Récupération des informations de la catégorie et de l'événement
            const { data: catRec } = await supabase
                .from('ticket_categories')
                .select(`
                    id,
                    name,
                    total_quantity,
                    sold_quantity,
                    events (
                        id,
                        title,
                        partner_id,
                        partners (
                            id,
                            user_id,
                            phone,
                            company_name,
                            commercial_name,
                            users (id, phone, email, first_name, last_name)
                        )
                    )
                `)
                .eq('id', params.categoryId)
                .maybeSingle();

            const eventData: any = catRec?.events;
            const partnerData: any = eventData?.partners;
            const partnerUserId = partnerData?.user_id || partnerData?.users?.id;
            const partnerPhone = partnerData?.phone || partnerData?.users?.phone;
            const partnerEmail = partnerData?.users?.email;
            const organizerName = partnerData?.commercial_name || partnerData?.company_name || 'Organisateur';
            const categoryName = params.categoryName || catRec?.name || 'Catégorie';
            const eventTitle = eventData?.title || 'Événement';
            const totalQty = params.totalQuantity ?? catRec?.total_quantity ?? 0;

            if (!partnerUserId) {
                console.warn('[NotificationService.sendTicketCategorySoldOutNotification] Aucun partenaire trouvé pour category:', params.categoryId);
                return result;
            }

            // 2. Garde d'Idempotence stricte : Vérifier si une notification d'épuisement existe déjà
            const { data: existingNotifs } = await supabase
                .from('notifications')
                .select('id')
                .eq('user_id', partnerUserId)
                .eq('type', 'ALERT')
                .filter('metadata->>alert_type', 'eq', 'CATEGORY_SOLD_OUT')
                .filter('metadata->>category_id', 'eq', params.categoryId)
                .limit(1);

            if (existingNotifs && existingNotifs.length > 0) {
                console.log(`[NotificationService.sendTicketCategorySoldOutNotification] Notification SOLD_OUT déjà envoyée (Idempotence) pour category: ${params.categoryId}`);
                return { inApp: true, sms: false, email: false };
            }

            // ── CANAL 1 : In-App Organisateur ─────────────────────────
            const inAppMessage = `La catégorie "${categoryName}" de votre événement "${eventTitle}" est désormais complète (${totalQty}/${totalQty} billets vendus). Les ventes sont automatiquement suspendues.`;
            result.inApp = await NotificationService.createNotification({
                userId: partnerUserId,
                type: 'ALERT',
                title: `🎟️ Catégorie "${categoryName}" Épuisée`,
                message: inAppMessage,
                data: {
                    event_id: params.eventId,
                    category_id: params.categoryId,
                    category_name: categoryName,
                    total_quantity: totalQty,
                    alert_type: 'CATEGORY_SOLD_OUT',
                    actionUrl: '/partner/events',
                },
            });

            // ── CANAL 2 : SMS Organisateur ────────────────────────────
            if (partnerPhone) {
                const orgSms = `Event Village : La catégorie "${categoryName}" pour "${eventTitle}" est désormais complète (${totalQty}/${totalQty} vendus). Rendez-vous sur votre espace pro.`;
                try {
                    const smsRes = await mTargetService.sendSms(partnerPhone, orgSms);
                    result.sms = smsRes.success;
                } catch (smsErr) {
                    console.warn('[NotificationService] SMS catégorie épuisée échoué:', smsErr);
                }
            }

            // ── CANAL 3 : Email Organisateur ──────────────────────────
            if (partnerEmail && partnerEmail.includes('@')) {
                try {
                    const tpl = EmailTemplates.ticketCategorySoldOut({
                        partnerName: organizerName,
                        eventTitle,
                        categoryName,
                        totalQuantity: totalQty,
                    });
                    const emailRes = await EmailService.send({ to: partnerEmail, ...tpl });
                    result.email = emailRes.sent;
                } catch (emailErr) {
                    console.warn('[NotificationService] Email catégorie épuisée échoué:', emailErr);
                }
            }
        } catch (err) {
            console.error('[NotificationService.sendTicketCategorySoldOutNotification] Exception:', err);
        }

        return result;
    }

    // =========================================================================
    // WORKFLOW — Alerte Événement Intégralement Complet (EVENT_FULLY_SOLD_OUT)
    // CDC : In-App + SMS + Email avec garde d'idempotence stricte
    // =========================================================================
    static async sendEventFullySoldOutNotification(params: {
        eventId: string;
        eventTitle?: string;
        partnerId?: string;
        totalTicketsSold?: number;
    }): Promise<{ inApp: boolean; sms: boolean; email: boolean }> {
        const result = { inApp: false, sms: false, email: false };

        try {
            const supabase = getServiceRoleClient();

            // 1. Récupération des informations de l'événement et du partenaire
            const { data: eventRec } = await supabase
                .from('events')
                .select(`
                    id,
                    title,
                    partner_id,
                    partners (
                        id,
                        user_id,
                        phone,
                        company_name,
                        commercial_name,
                        users (id, phone, email, first_name, last_name)
                    )
                `)
                .eq('id', params.eventId)
                .maybeSingle();

            const partnerData: any = eventRec?.partners;
            const partnerUserId = partnerData?.user_id || partnerData?.users?.id;
            const partnerPhone = partnerData?.phone || partnerData?.users?.phone;
            const partnerEmail = partnerData?.users?.email;
            const organizerName = partnerData?.commercial_name || partnerData?.company_name || 'Organisateur';
            const eventTitle = params.eventTitle || eventRec?.title || 'Événement';
            const totalSold = params.totalTicketsSold ?? 0;

            if (!partnerUserId) {
                console.warn('[NotificationService.sendEventFullySoldOutNotification] Aucun partenaire trouvé pour event:', params.eventId);
                return result;
            }

            // 2. Garde d'Idempotence stricte : Vérifier si une notification d'événement complet existe déjà
            const { data: existingNotifs } = await supabase
                .from('notifications')
                .select('id')
                .eq('user_id', partnerUserId)
                .eq('type', 'ALERT')
                .filter('metadata->>alert_type', 'eq', 'EVENT_FULLY_SOLD_OUT')
                .filter('metadata->>event_id', 'eq', params.eventId)
                .limit(1);

            if (existingNotifs && existingNotifs.length > 0) {
                console.log(`[NotificationService.sendEventFullySoldOutNotification] Notification EVENT_FULLY_SOLD_OUT déjà envoyée (Idempotence) pour event: ${params.eventId}`);
                return { inApp: true, sms: false, email: false };
            }

            // ── CANAL 1 : In-App Organisateur ─────────────────────────
            const inAppMessage = `Félicitations ! Toutes les catégories de votre événement "${eventTitle}" sont désormais complètes (${totalSold} billets vendus). Votre événement est officiellement à guichet fermé.`;
            result.inApp = await NotificationService.createNotification({
                userId: partnerUserId,
                type: 'ALERT',
                title: `🔴 Événement Complet : "${eventTitle}"`,
                message: inAppMessage,
                data: {
                    event_id: params.eventId,
                    event_title: eventTitle,
                    total_sold: totalSold,
                    alert_type: 'EVENT_FULLY_SOLD_OUT',
                    actionUrl: '/partner/events',
                },
            });

            // ── CANAL 2 : SMS Organisateur ────────────────────────────
            if (partnerPhone) {
                const orgSms = `Event Village : Félicitations ! Votre événement "${eventTitle}" est désormais 100% COMPLET (Guichet Fermé). Total : ${totalSold} billets vendus.`;
                try {
                    const smsRes = await mTargetService.sendSms(partnerPhone, orgSms);
                    result.sms = smsRes.success;
                } catch (smsErr) {
                    console.warn('[NotificationService] SMS événement complet échoué:', smsErr);
                }
            }

            // ── CANAL 3 : Email Organisateur ──────────────────────────
            if (partnerEmail && partnerEmail.includes('@')) {
                try {
                    const tpl = EmailTemplates.eventFullySoldOut({
                        partnerName: organizerName,
                        eventTitle,
                        totalTicketsSold: totalSold,
                    });
                    const emailRes = await EmailService.send({ to: partnerEmail, ...tpl });
                    result.email = emailRes.sent;
                } catch (emailErr) {
                    console.warn('[NotificationService] Email événement complet échoué:', emailErr);
                }
            }
        } catch (err) {
            console.error('[NotificationService.sendEventFullySoldOutNotification] Exception:', err);
        }

        return result;
    }

    // =========================================================================
    // WORKFLOW — Confirmation de Scan & Compostage de Billet au Client
    // CDC : In-App + SMS + Email envoyés immédiatement au porteur lors de l'accès
    // =========================================================================
    static async sendTicketScannedSuccessNotification(params: {
        ticketId: string;
        ticketNumber?: string;
        eventTitle?: string;
        categoryName?: string;
        userId?: string;
        checkedInAt?: string;
        controllerId?: string;
        venue?: string;
    }): Promise<{ inApp: boolean; sms: boolean; email: boolean }> {
        const result = { inApp: false, sms: false, email: false };

        try {
            const supabase = getServiceRoleClient();

            // 1. Récupération des informations complètes du billet si nécessaire
            let buyerUserId = params.userId;
            let buyerPhone: string | undefined;
            let buyerEmail: string | undefined;
            let buyerName = 'Porteur de billet';
            let eventTitle = params.eventTitle;
            let categoryName = params.categoryName;
            let ticketNumber = params.ticketNumber;
            let checkedInAt = params.checkedInAt || new Date().toISOString();
            let venue = params.venue;

            const { data: ticketRec } = await supabase
                .from('tickets')
                .select(`
                    id,
                    ticket_number,
                    checked_in_at,
                    user_id,
                    users:users!tickets_user_id_fkey (id, phone, email, first_name, last_name),
                    events (id, title, location),
                    ticket_categories (id, name)
                `)
                .eq('id', params.ticketId)
                .maybeSingle();

            if (ticketRec) {
                ticketNumber = ticketNumber || ticketRec.ticket_number;
                checkedInAt = ticketRec.checked_in_at || checkedInAt;
                buyerUserId = buyerUserId || ticketRec.user_id;

                const u: any = ticketRec.users;
                if (u) {
                    buyerPhone = u.phone;
                    buyerEmail = u.email;
                    buyerName = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email || buyerName;
                }

                const ev: any = ticketRec.events;
                if (ev) {
                    eventTitle = eventTitle || ev.title;
                    venue = venue || ev.location;
                }

                const cat: any = ticketRec.ticket_categories;
                if (cat) {
                    categoryName = categoryName || cat.name;
                }
            }

            eventTitle = eventTitle || 'Événement Event Village';
            categoryName = categoryName || 'Standard';
            ticketNumber = ticketNumber || params.ticketId.slice(0, 8).toUpperCase();

            if (!buyerUserId) {
                console.warn('[NotificationService.sendTicketScannedSuccessNotification] Aucun user_id pour ticket:', params.ticketId);
                return result;
            }

            // 2. Idempotence : Ne pas doubler les notifications si déjà scanné
            const { data: existingNotifs } = await supabase
                .from('notifications')
                .select('id')
                .eq('user_id', buyerUserId)
                .filter('metadata->>alert_type', 'eq', 'TICKET_SCANNED')
                .filter('metadata->>ticket_id', 'eq', params.ticketId)
                .limit(1);

            if (existingNotifs && existingNotifs.length > 0) {
                return { inApp: true, sms: false, email: false };
            }

            // ── CANAL 1 : In-App Porteur / Client ─────────────────────
            const inAppMessage = `Votre billet "${categoryName}" (N° ${ticketNumber}) pour l'événement "${eventTitle}" a été validé avec succès à l'entrée. Bon événement !`;
            result.inApp = await NotificationService.createNotification({
                userId: buyerUserId,
                type: 'TICKET' as any,
                title: `🎟️ Entrée Validée : "${eventTitle}"`,
                message: inAppMessage,
                data: {
                    ticket_id: params.ticketId,
                    ticket_number: ticketNumber,
                    event_title: eventTitle,
                    category_name: categoryName,
                    checked_in_at: checkedInAt,
                    status: 'UTILISE',
                    alert_type: 'TICKET_SCANNED',
                    actionUrl: '/tickets',
                },
            });

            // ── CANAL 2 : SMS Porteur / Client ────────────────────────
            if (buyerPhone) {
                const clientSms = `Event Village : Votre billet "${categoryName}" (N° ${ticketNumber}) pour "${eventTitle}" a été validé avec succès à l'entrée. Bon événement !`;
                try {
                    const smsRes = await mTargetService.sendSms(buyerPhone, clientSms);
                    result.sms = smsRes.success;
                } catch (smsErr) {
                    console.warn('[NotificationService] SMS validation billet échoué:', smsErr);
                }
            }

            // ── CANAL 3 : Email Porteur / Client ──────────────────────
            if (buyerEmail && buyerEmail.includes('@')) {
                try {
                    const tpl = EmailTemplates.ticketScannedConfirmation({
                        buyerName,
                        eventTitle,
                        categoryName,
                        ticketNumber,
                        checkedInAt,
                        venue,
                    });
                    const emailRes = await EmailService.send({ to: buyerEmail, ...tpl });
                    result.email = emailRes.sent;
                } catch (emailErr) {
                    console.warn('[NotificationService] Email validation billet échoué:', emailErr);
                }
            }
        } catch (err) {
            console.error('[NotificationService.sendTicketScannedSuccessNotification] Exception:', err);
        }

        return result;
    }

    // =========================================================================
    // WORKFLOW TRANSFERT P2P — Réclamation Réussie (Ancien + Nouveau Propriétaire)
    // =========================================================================
    static async sendTicketTransferClaimedNotifications(params: {
        senderUserId: string;
        recipientUserId: string;
        ticketId: string;
        ticketNumber: string;
        eventTitle: string;
        recipientName?: string;
    }): Promise<{ senderNotified: boolean; recipientNotified: boolean }> {
        const result = { senderNotified: false, recipientNotified: false };
        try {
            const supabase = getServiceRoleClient();
            const recipientLabel = params.recipientName || 'votre destinataire';

            // 1. Notification Ancien Propriétaire (Expéditeur)
            const senderMsg = `Votre billet N° ${params.ticketNumber} pour "${params.eventTitle}" a été transféré et réclamé par ${recipientLabel}.`;
            result.senderNotified = await NotificationService.createNotification({
                userId: params.senderUserId,
                type: 'TICKET' as any,
                title: '🎟️ Billet Transféré avec Succès',
                message: senderMsg,
                data: {
                    ticket_id: params.ticketId,
                    ticket_number: params.ticketNumber,
                    event_title: params.eventTitle,
                    action: 'TRANSFER_CLAIMED_SENDER',
                },
            });

            // Récupérer le numéro de l'expéditeur pour SMS optionnel
            const { data: senderUser } = await supabase
                .from('users')
                .select('phone')
                .eq('id', params.senderUserId)
                .maybeSingle();

            if (senderUser?.phone) {
                try {
                    await mTargetService.sendSms(senderUser.phone, `Event Village : ${senderMsg}`);
                } catch {
                    // Non bloquant
                }
            }

            // 2. Notification Nouveau Propriétaire (Destinataire)
            const recipientMsg = `Le billet N° ${params.ticketNumber} pour "${params.eventTitle}" a été ajouté à votre portefeuille.`;
            result.recipientNotified = await NotificationService.createNotification({
                userId: params.recipientUserId,
                type: 'TICKET' as any,
                title: '🎟️ Nouveau Billet Reçu !',
                message: recipientMsg,
                data: {
                    ticket_id: params.ticketId,
                    ticket_number: params.ticketNumber,
                    event_title: params.eventTitle,
                    action: 'TRANSFER_CLAIMED_RECIPIENT',
                    actionUrl: '/tickets',
                },
            });

            const { data: recipientUser } = await supabase
                .from('users')
                .select('phone')
                .eq('id', params.recipientUserId)
                .maybeSingle();

            if (recipientUser?.phone) {
                try {
                    await mTargetService.sendSms(recipientUser.phone, `Event Village : ${recipientMsg} Rendez-vous dans votre espace pour le consulter.`);
                } catch {
                    // Non bloquant
                }
            }
        } catch (err) {
            console.error('[NotificationService.sendTicketTransferClaimedNotifications] Erreur:', err);
        }

        return result;
    }

    // =========================================================================
    // WORKFLOW TRANSFERT P2P — Annulation par l'Expéditeur
    // =========================================================================
    static async sendTicketTransferCancelledNotification(params: {
        recipientPhoneOrEmail: string;
        ticketNumber: string;
        eventTitle: string;
    }): Promise<void> {
        try {
            const msg = `Event Village : Le transfert du billet N° ${params.ticketNumber} pour "${params.eventTitle}" a été annulé par son propriétaire.`;
            if (params.recipientPhoneOrEmail.includes('@')) {
                try {
                    await EmailService.send({
                        to: params.recipientPhoneOrEmail,
                        subject: 'Transfert de billet annulé — Event Village',
                        html: `<p>${msg}</p>`,
                    });
                } catch {
                    // Non bloquant
                }
            } else {
                try {
                    await mTargetService.sendSms(params.recipientPhoneOrEmail, msg);
                } catch {
                    // Non bloquant
                }
            }
        } catch (err) {
            console.warn('[NotificationService.sendTicketTransferCancelledNotification] Erreur:', err);
        }
    }

    // =========================================================================
    // WORKFLOW TRANSFERT P2P — Expiration TTL 48h
    // =========================================================================
    static async sendTicketTransferExpiredNotification(params: {
        recipientPhoneOrEmail: string;
        ticketNumber: string;
        eventTitle: string;
    }): Promise<void> {
        try {
            const msg = `Event Village : Le lien de transfert du billet N° ${params.ticketNumber} pour "${params.eventTitle}" a expiré (délai de 48h dépassé).`;
            if (params.recipientPhoneOrEmail.includes('@')) {
                try {
                    await EmailService.send({
                        to: params.recipientPhoneOrEmail,
                        subject: 'Lien de transfert de billet expiré — Event Village',
                        html: `<p>${msg}</p>`,
                    });
                } catch {
                    // Non bloquant
                }
            } else {
                try {
                    await mTargetService.sendSms(params.recipientPhoneOrEmail, msg);
                } catch {
                    // Non bloquant
                }
            }
        } catch (err) {
            console.warn('[NotificationService.sendTicketTransferExpiredNotification] Erreur:', err);
        }
    }
}


