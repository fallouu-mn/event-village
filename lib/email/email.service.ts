/**
 * EMAIL SERVICE — Event Village
 * Implémentation via l'API REST Resend (https://resend.com)
 * Aucune dépendance npm requise — utilise fetch() natif (Node 18+)
 *
 * Pour activer : ajouter RESEND_API_KEY=re_xxxx dans .env.local
 * Tant que la clé est absente, les envois sont journalisés (pas de crash).
 */

// ── Types ─────────────────────────────────────────────────────────────────

export interface EmailResult {
    sent: boolean;
    id?: string;
    error?: string;
}

interface SendPayload {
    to: string | string[];
    subject: string;
    html: string;
    from?: string;
    replyTo?: string;
}

// ── Helpers HTML ──────────────────────────────────────────────────────────

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://eventvillage.sn';
const BRAND_COLOR = '#FF5722';

function baseLayout(body: string): string {
    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>Event Village</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 12px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- HEADER -->
        <tr><td style="background:${BRAND_COLOR};border-radius:16px 16px 0 0;padding:26px 32px;text-align:center;">
          <h1 style="margin:0;font-size:22px;font-weight:900;color:#fff;letter-spacing:-0.5px;">Event Village</h1>
          <p style="margin:4px 0 0;font-size:10px;color:rgba(255,255,255,.75);font-weight:700;text-transform:uppercase;letter-spacing:1.5px;">Plateforme B2B Partenaires — Sénégal</p>
        </td></tr>

        <!-- BODY -->
        <tr><td style="background:#fff;padding:32px 36px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px;">
          ${body}
          <!-- FOOTER -->
          <hr style="border:none;border-top:1px solid #f1f5f9;margin:28px 0 20px;" />
          <p style="margin:0;font-size:11px;color:#94a3b8;text-align:center;line-height:1.8;">
            © ${new Date().getFullYear()} Event Village SN · Dakar, Sénégal<br />
            Support : <a href="mailto:support@eventvillage.sn" style="color:${BRAND_COLOR};text-decoration:none;">support@eventvillage.sn</a><br />
            <em style="font-size:10px;">Cet email est généré automatiquement — ne pas répondre directement.</em>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function infoRow(label: string, value: string): string {
    return `<tr>
      <td style="padding:9px 0;border-bottom:1px solid #f1f5f9;">
        <span style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;">${label}</span><br />
        <span style="font-size:13px;font-weight:600;color:#0f172a;">${value}</span>
      </td>
    </tr>`;
}

function ctaButton(label: string, url: string, color = BRAND_COLOR): string {
    return `<div style="text-align:center;margin:28px 0;">
      <a href="${url}" style="display:inline-block;background:${color};color:#fff;font-size:13px;font-weight:800;padding:14px 32px;border-radius:12px;text-decoration:none;letter-spacing:.3px;">${label}</a>
    </div>`;
}

// ── Email Templates ───────────────────────────────────────────────────────

export const EmailTemplates = {

    /**
     * T1 — Confirmation d'inscription partenaire → envoyé AU PARTENAIRE
     */
    partnerRegistrationConfirmation(p: {
        partnerName: string;
        companyName: string;
    }): { subject: string; html: string } {
        return {
            subject: `Votre dossier de partenariat a bien été reçu — Event Village`,
            html: baseLayout(`
              <p style="margin:0 0 6px;font-size:13px;color:#64748b;">Bonjour <strong>${p.partnerName}</strong>,</p>
              <h2 style="margin:0 0 20px;font-size:19px;font-weight:900;color:#0f172a;line-height:1.3;">
                Votre candidature partenaire a été soumise avec succès.
              </h2>
              <div style="background:#f8fafc;border-left:4px solid ${BRAND_COLOR};border-radius:8px;padding:14px 18px;margin:0 0 22px;">
                <p style="margin:0 0 3px;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;">Établissement</p>
                <p style="margin:0;font-size:16px;font-weight:800;color:#0f172a;">${p.companyName}</p>
              </div>
              <p style="margin:0 0 16px;font-size:13px;color:#475569;line-height:1.7;">
                Notre équipe de conformité procède à la vérification de votre dossier et de vos documents professionnels.
              </p>
              <div style="padding:18px 20px;background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;margin:0 0 22px;">
                <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#9a3412;">📋 Prochaines étapes :</p>
                <ol style="margin:0;padding-left:18px;font-size:12px;color:#c2410c;line-height:2.2;">
                  <li>Vérification CNI / Passeport + documents d'entreprise</li>
                  <li>Audit de conformité de votre établissement</li>
                  <li>Notification SMS &amp; email de la décision finale</li>
                </ol>
              </div>
              <p style="margin:0;font-size:12px;color:#64748b;line-height:1.6;">
                <strong>Délai de traitement :</strong> 24 à 72 heures ouvrables.<br />
                Questions ? <a href="mailto:partenaires@eventvillage.sn" style="color:${BRAND_COLOR};">partenaires@eventvillage.sn</a>
              </p>
            `),
        };
    },

    /**
     * T2 — Alerte nouvelle candidature → envoyé AUX SUPERADMINS/ADMINS
     */
    superadminNewPartnerAlert(p: {
        partnerName: string;
        companyName: string;
        partnerEmail: string;
        partnerPhone: string;
    }): { subject: string; html: string } {
        return {
            subject: `[ACTION REQUISE] Nouvelle candidature partenaire : ${p.companyName}`,
            html: baseLayout(`
              <div style="background:#fef2f2;border-left:4px solid #ef4444;border-radius:8px;padding:13px 17px;margin:0 0 22px;">
                <p style="margin:0;font-size:13px;font-weight:700;color:#991b1b;">🔔 Nouvelle demande de partenariat en attente de validation</p>
              </div>
              <h2 style="margin:0 0 18px;font-size:18px;font-weight:900;color:#0f172a;">${p.companyName}</h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                ${infoRow('Gérant / Responsable', p.partnerName)}
                ${infoRow('Email professionnel', `<a href="mailto:${p.partnerEmail}" style="color:${BRAND_COLOR};text-decoration:none;">${p.partnerEmail}</a>`)}
                ${infoRow('Téléphone', p.partnerPhone)}
              </table>
              ${ctaButton('Accéder au Dashboard Admin →', `${APP_URL}/admin/dashboard`)}
              <p style="margin:0;font-size:11px;color:#94a3b8;text-align:center;">
                Notification automatique envoyée à tous les administrateurs Event Village.
              </p>
            `),
        };
    },

    /**
     * T3 — Compte partenaire validé → envoyé AU PARTENAIRE
     */
    partnerAccountValidated(p: {
        partnerName: string;
        companyName: string;
    }): { subject: string; html: string } {
        return {
            subject: `Félicitations ! Votre compte partenaire Event Village est activé 🎉`,
            html: baseLayout(`
              <div style="text-align:center;margin:0 0 24px;">
                <div style="display:inline-block;width:64px;height:64px;background:#dcfce7;border-radius:50%;line-height:68px;font-size:32px;">✅</div>
              </div>
              <p style="margin:0 0 4px;font-size:13px;color:#64748b;text-align:center;">Bonjour <strong>${p.partnerName}</strong>,</p>
              <h2 style="margin:0 0 18px;font-size:19px;font-weight:900;color:#0f172a;text-align:center;line-height:1.3;">
                Votre compte partenaire est officiellement activé !
              </h2>
              <div style="background:#f0fdf4;border-left:4px solid #22c55e;border-radius:8px;padding:14px 18px;margin:0 0 20px;">
                <p style="margin:0 0 3px;font-size:10px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:.5px;">Établissement validé</p>
                <p style="margin:0;font-size:16px;font-weight:800;color:#15803d;">${p.companyName}</p>
              </div>
              <p style="margin:0 0 18px;font-size:13px;color:#475569;line-height:1.7;">
                L'équipe Event Village a approuvé votre dossier. Votre espace professionnel est maintenant entièrement opérationnel.
              </p>
              <div style="padding:18px 20px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;margin:0 0 22px;">
                <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#166534;">🚀 Commencez maintenant :</p>
                <ul style="margin:0;padding-left:18px;font-size:12px;color:#15803d;line-height:2.2;">
                  <li>Complétez votre page de présentation et vos photos</li>
                  <li>Publiez votre premier événement ou offre</li>
                  <li>Configurez votre menu / catalogue de services</li>
                  <li>Partagez votre QR Code de pointage</li>
                </ul>
              </div>
              ${ctaButton('Accéder à mon espace partenaire →', `${APP_URL}/partner/dashboard`, '#22c55e')}
              <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;font-style:italic;">Bienvenue dans la famille Event Village ! 🎊</p>
            `),
        };
    },

    /**
     * T4 — Candidature rejetée → envoyé AU PARTENAIRE
     */
    partnerAccountRejected(p: {
        partnerName: string;
        companyName: string;
        reason?: string;
    }): { subject: string; html: string } {
        return {
            subject: `Mise à jour sur votre candidature partenaire — Event Village`,
            html: baseLayout(`
              <p style="margin:0 0 6px;font-size:13px;color:#64748b;">Bonjour <strong>${p.partnerName}</strong>,</p>
              <h2 style="margin:0 0 18px;font-size:18px;font-weight:900;color:#0f172a;line-height:1.3;">
                Votre candidature n'a pas été retenue.
              </h2>
              <p style="margin:0 0 18px;font-size:13px;color:#475569;line-height:1.7;">
                Après examen du dossier pour <strong>${p.companyName}</strong>, notre équipe de conformité n'est pas en mesure de valider votre candidature à ce stade.
              </p>
              ${p.reason ? `
              <div style="background:#fef2f2;border-left:4px solid #ef4444;border-radius:8px;padding:14px 18px;margin:0 0 18px;">
                <p style="margin:0 0 4px;font-size:10px;font-weight:700;color:#991b1b;text-transform:uppercase;letter-spacing:.5px;">Motif communiqué</p>
                <p style="margin:0;font-size:13px;color:#7f1d1d;font-style:italic;">"${p.reason}"</p>
              </div>` : ''}
              <div style="padding:16px 18px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;margin:0 0 20px;">
                <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#475569;">Vous souhaitez soumettre un nouveau dossier ?</p>
                <p style="margin:0;font-size:12px;color:#64748b;line-height:1.6;">
                  Vous pouvez corriger les points soulevés et soumettre une nouvelle candidature après 30 jours. Notre équipe reste disponible.
                </p>
              </div>
              <p style="margin:0;font-size:12px;color:#64748b;">
                Contact : <a href="mailto:partenaires@eventvillage.sn" style="color:${BRAND_COLOR};">partenaires@eventvillage.sn</a>
              </p>
            `),
        };
    },

    /**
     * T5 — Compte suspendu → envoyé AU PARTENAIRE
     */
    partnerAccountSuspended(p: {
        partnerName: string;
        companyName: string;
        reason: string;
    }): { subject: string; html: string } {
        return {
            subject: `[URGENT] Suspension de votre compte partenaire — Event Village`,
            html: baseLayout(`
              <div style="background:#fef2f2;border:2px solid #ef4444;border-radius:12px;padding:18px;margin:0 0 22px;text-align:center;">
                <p style="margin:0;font-size:28px;">⚠️</p>
                <p style="margin:6px 0 0;font-size:14px;font-weight:800;color:#991b1b;">Suspension Temporaire de Compte</p>
              </div>
              <p style="margin:0 0 6px;font-size:13px;color:#64748b;">Bonjour <strong>${p.partnerName}</strong>,</p>
              <p style="margin:0 0 18px;font-size:13px;color:#475569;line-height:1.7;">
                Votre compte partenaire pour l'établissement <strong>${p.companyName}</strong> a été temporairement suspendu par l'administration Event Village.
              </p>
              <div style="background:#fef2f2;border:1px solid #fecaca;border-left:4px solid #ef4444;border-radius:8px;padding:16px 18px;margin:0 0 18px;">
                <p style="margin:0 0 6px;font-size:10px;font-weight:800;color:#991b1b;text-transform:uppercase;letter-spacing:.8px;">Motif de suspension</p>
                <p style="margin:0;font-size:14px;font-weight:700;color:#7f1d1d;font-style:italic;">"${p.reason}"</p>
              </div>
              <p style="margin:0 0 20px;font-size:13px;color:#475569;line-height:1.7;">
                Pendant la suspension, votre espace partenaire et vos offres ne sont plus accessibles aux utilisateurs. Pour contester cette décision ou régulariser votre situation, contactez immédiatement notre équipe de conformité.
              </p>
              ${ctaButton("Contacter l'équipe de conformité", `mailto:conformite@eventvillage.sn?subject=Contestation%20suspension%20-%20${encodeURIComponent(p.companyName)}`, '#ef4444')}
            `),
        };
    },

    /**
     * T6 — Compte réactivé → envoyé AU PARTENAIRE
     */
    partnerAccountReactivated(p: {
        partnerName: string;
        companyName: string;
    }): { subject: string; html: string } {
        return {
            subject: `Votre compte partenaire Event Village est à nouveau actif ! 🎉`,
            html: baseLayout(`
              <div style="text-align:center;margin:0 0 26px;">
                <div style="display:inline-flex;align-items:center;justify-content:center;width:72px;height:72px;background:linear-gradient(135deg,#dcfce7,#bbf7d0);border-radius:50%;border:2px solid #22c55e;box-shadow:0 4px 16px rgba(34,197,94,.2);">
                  <span style="font-size:34px;line-height:1;">🔓</span>
                </div>
              </div>
              <p style="margin:0 0 4px;font-size:13px;color:#64748b;text-align:center;">Bonjour <strong>${p.partnerName}</strong>,</p>
              <h2 style="margin:0 0 20px;font-size:20px;font-weight:900;color:#0f172a;text-align:center;line-height:1.3;">
                Bonne nouvelle ! Votre compte est réactivé.
              </h2>
              <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-left:4px solid #22c55e;border-radius:10px;padding:16px 20px;margin:0 0 22px;">
                <p style="margin:0 0 4px;font-size:10px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:.6px;">Établissement réactivé</p>
                <p style="margin:0;font-size:16px;font-weight:800;color:#15803d;">${p.companyName}</p>
              </div>
              <p style="margin:0 0 18px;font-size:13px;color:#475569;line-height:1.7;">
                L'équipe Event Village a levé la suspension de votre compte partenaire. Vous pouvez reprendre l'intégralité de vos activités dès maintenant.
              </p>
              <div style="padding:18px 20px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;margin:0 0 22px;">
                <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#166534;">✅ Ce qui est à nouveau accessible :</p>
                <ul style="margin:0;padding-left:18px;font-size:12px;color:#15803d;line-height:2.2;">
                  <li>Votre tableau de bord partenaire et toutes vos statistiques</li>
                  <li>Vos événements et offres publiés sur la plateforme</li>
                  <li>La réception de nouvelles commandes et réservations</li>
                  <li>Votre espace finances et les reversements</li>
                </ul>
              </div>
              ${ctaButton('Accéder à mon espace partenaire →', `${APP_URL}/partner/dashboard`, '#22c55e')}
              <p style="margin:0;font-size:12px;color:#64748b;text-align:center;">
                Une question ? <a href="mailto:partenaires@eventvillage.sn" style="color:${BRAND_COLOR};">partenaires@eventvillage.sn</a>
              </p>
            `),
        };
    },
};

// ── EmailService ──────────────────────────────────────────────────────────

export class EmailService {
    private static readonly RESEND_API = 'https://api.resend.com/emails';

    private static fromAddress(): string {
        const addr = process.env.NOTIFICATION_FROM_EMAIL || 'notifications@eventvillage.sn';
        return `Event Village <${addr}>`;
    }

    /**
     * Envoie un email via l'API Resend.
     * Retourne toujours — l'échec ne propage pas d'exception.
     */
    static async send(payload: SendPayload): Promise<EmailResult> {
        const apiKey = process.env.RESEND_API_KEY;

        if (!apiKey) {
            console.warn('[EmailService] RESEND_API_KEY manquant — email non expédié :', payload.subject);
            return { sent: false, error: 'RESEND_API_KEY_MISSING' };
        }

        try {
            const res = await fetch(EmailService.RESEND_API, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    from: payload.from ?? EmailService.fromAddress(),
                    to: Array.isArray(payload.to) ? payload.to : [payload.to],
                    subject: payload.subject,
                    html: payload.html,
                    ...(payload.replyTo ? { reply_to: payload.replyTo } : {}),
                }),
            });

            if (!res.ok) {
                const errBody = await res.json().catch(() => ({})) as Record<string, unknown>;
                const msg = (errBody.message as string) || `HTTP ${res.status}`;
                console.warn('[EmailService] Resend API error:', msg, '— sujet:', payload.subject);
                return { sent: false, error: msg };
            }

            const data = await res.json() as { id?: string };
            return { sent: true, id: data.id };
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'network_error';
            console.warn('[EmailService] Exception envoi:', msg, '— sujet:', payload.subject);
            return { sent: false, error: msg };
        }
    }

    /**
     * Envoie le même email à une liste d'adresses (1 requête / destinataire pour éviter
     * les fuites de destinataires et respecter les limites Resend Free tier).
     */
    static async sendToMany(
        recipients: string[],
        payload: Omit<SendPayload, 'to'>,
    ): Promise<{ sent: number; failed: number }> {
        const valid = recipients.filter(Boolean).filter(r => r.includes('@'));
        if (valid.length === 0) return { sent: 0, failed: 0 };

        const results = await Promise.allSettled(
            valid.map(to => EmailService.send({ ...payload, to })),
        );

        let sent = 0; let failed = 0;
        results.forEach(r => (r.status === 'fulfilled' && r.value.sent ? sent++ : failed++));
        return { sent, failed };
    }
}
