/**
 * Lot 6 (contrat F3) — gabarit des emails de notification, avec sa version texte.
 *
 * Toute valeur variable passe par escapeHtml (& < > " ') avant d'entrer dans le HTML ; la version texte
 * garde les valeurs telles quelles. Styles en ligne seulement (aucune feuille de style : les clients mail
 * l'ignorent souvent), couleurs du système de design (brand #C2410C sous texte blanc, 5,18:1 ; texte
 * #0F172A ; secondaire #475569). Aucun lien hors de l'application, sauf l'adresse du support.
 *
 * Désabonnement (familles OPTIONAL seulement) : pied « Ne plus recevoir ces emails : <APP_URL>/profile/
 * notifications?topic=<TOPIC> » (texte et HTML) et en-tête List-Unsubscribe vers la même page ; la page
 * demande la connexion, aucun jeton n'est mis dans le lien.
 */

export type EmailTopic = 'REMINDERS' | 'EVENT_UPDATES' | 'PRO_ACTIVITY';

const ESCAPES: Readonly<Record<string, string>> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' };

/** Échappe une valeur pour le HTML (texte ou valeur d'attribut entre guillemets doubles). */
export function escapeHtml(value: string): string {
    return String(value).replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

/** Lien de désabonnement d'un sujet optionnel (page des préférences, connexion demandée). */
export function unsubscribeUrl(appUrl: string, topic: EmailTopic): string {
    return `${appUrl.replace(/\/+$/, '')}/profile/notifications?topic=${topic}`;
}

/** En-têtes d'un email : List-Unsubscribe pour une famille optionnelle, aucun sinon. */
export function emailHeaders(appUrl: string, topic: EmailTopic | null): Record<string, string> {
    return topic ? { 'List-Unsubscribe': `<${unsubscribeUrl(appUrl, topic)}>` } : {};
}

export interface EmailLayoutInput {
    /** NEXT_PUBLIC_APP_URL, sans « / » final. */
    appUrl: string;
    /** Titre affiché en tête du message (texte brut, échappé ici). */
    heading: string;
    /** Paragraphes du corps (texte brut, échappés ici). */
    paragraphs: readonly string[];
    /** Bouton vers l'application : `path` est un chemin interne (« /tickets »). */
    cta?: { label: string; path: string };
    /** Sujet optionnel : ajoute le pied de désabonnement. */
    unsubscribeTopic?: EmailTopic | null;
}

export interface EmailLayoutOutput { html: string; text: string }

const SUPPORT_ADDRESS = 'support@eventvillage.sn';

export function emailLayout(input: EmailLayoutInput): EmailLayoutOutput {
    const appUrl = input.appUrl.replace(/\/+$/, '');
    const ctaUrl = input.cta ? `${appUrl}${input.cta.path}` : null;
    const unsubscribe = input.unsubscribeTopic ? unsubscribeUrl(appUrl, input.unsubscribeTopic) : null;

    const paragraphsHtml = input.paragraphs
        .map((p) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#0F172A;">${escapeHtml(p)}</p>`)
        .join('\n          ');
    const ctaHtml = ctaUrl && input.cta
        ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;"><tr><td style="background:#C2410C;border-radius:12px;">
            <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:700;color:#FFFFFF;text-decoration:none;">${escapeHtml(input.cta.label)}</a>
          </td></tr></table>`
        : '';
    const unsubscribeHtml = unsubscribe
        ? `<p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:#475569;">Ne plus recevoir ces emails : <a href="${escapeHtml(unsubscribe)}" style="color:#C2410C;">${escapeHtml(unsubscribe)}</a></p>`
        : '';

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>${escapeHtml(input.heading)}</title>
</head>
<body style="margin:0;padding:0;background:#F4F5F7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F5F7;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FFFFFF;border:1px solid #E4E4E7;border-radius:16px;">
        <tr><td style="padding:24px 28px 8px;">
          <p style="margin:0 0 16px;font-size:14px;font-weight:700;letter-spacing:0.5px;color:#C2410C;">Event Village</p>
          <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#0F172A;">${escapeHtml(input.heading)}</h1>
          ${paragraphsHtml}
          ${ctaHtml}
        </td></tr>
        <tr><td style="padding:16px 28px 24px;border-top:1px solid #E4E4E7;">
          <p style="margin:0;font-size:14px;line-height:1.6;color:#475569;">Message automatique d'Event Village, merci de ne pas y répondre. Support : <a href="mailto:${SUPPORT_ADDRESS}" style="color:#C2410C;">${SUPPORT_ADDRESS}</a></p>
          ${unsubscribeHtml}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const textLines = [input.heading, '', ...input.paragraphs.flatMap((p) => [p, ''])];
    if (ctaUrl && input.cta) textLines.push(`${input.cta.label} : ${ctaUrl}`, '');
    textLines.push('—', `Message automatique d'Event Village, merci de ne pas y répondre. Support : ${SUPPORT_ADDRESS}`);
    if (unsubscribe) textLines.push(`Ne plus recevoir ces emails : ${unsubscribe}`);
    return { html, text: textLines.join('\n') };
}
