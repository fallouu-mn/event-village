/**
 * Lot 6 (contrat F3) — gabarit des emails de notification, avec sa version texte.
 *
 * Toute valeur variable passe par escapeHtml (& < > " ') avant d'entrer dans le HTML ; la version texte
 * garde les valeurs telles quelles. Thème clair par des styles en ligne (couleurs du système de design :
 * brand #C2410C sous texte blanc, 5,18:1 ; texte #0F172A ; secondaire #475569). Aucun lien hors de
 * l'application, sauf l'adresse du support. Aucune image, aucune police ni ressource distante.
 *
 * Lot 7 (7.9, D92, contrat 19.5) : blocs facultatifs (faits, liste, encadré, note sous le bouton) et thème
 * sombre. Le seul `<style>` contient un bloc `@media (prefers-color-scheme: dark)` qui surcharge les styles
 * en ligne par classes (`ev-bg`, `ev-card`, `ev-text`, `ev-muted`, `ev-link`, `ev-notice`, `ev-divider`) ; un
 * client qui l'ignore garde le thème clair. Change la règle « styles en ligne seulement » du lot 6 (signalé).
 * Contrastes (WCAG, texte sur son fond) : clair 7,58:1 au moins pour le texte et le secondaire, 5,18:1 pour
 * les liens ; sombre (fond #0F0F11, carte #18181B) : texte #F4F4F5, secondaire #A1A1AA, liens #FDBA74,
 * encadré #2A1609 ; bouton #C2410C sous texte blanc dans les deux thèmes. Le bouton ne porte jamais la classe
 * des liens (texte blanc). Largeur 600 px au plus, lisible à 390 px sans défilement horizontal.
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

/** Lot 7 (7.9) : une ligne du tableau des faits ; une valeur en plusieurs lignes est une liste. */
export interface EmailFact { label: string; value: string | readonly string[] }

/** Lot 7 (7.9) : liste nommée (numéros de billets), avec une mention finale facultative (« et 2 autres »). */
export interface EmailList { title: string; items: readonly string[]; more?: string }

export interface EmailLayoutInput {
    /** NEXT_PUBLIC_APP_URL, sans « / » final. */
    appUrl: string;
    /** Titre affiché en tête du message (texte brut, échappé ici). */
    heading: string;
    /** Paragraphes du corps (texte brut, échappés ici). */
    paragraphs: readonly string[];
    /** Lot 7 (7.9) : tableau de deux colonnes (libellé, valeur), après les paragraphes. */
    facts?: readonly EmailFact[];
    /** Lot 7 (7.9) : liste après les faits (numéros en chasse normale, coupés au besoin). */
    list?: EmailList;
    /** Lot 7 (7.9) : encadré de paragraphes à ne pas manquer, avant le bouton. */
    notice?: readonly string[];
    /** Bouton vers l'application : `path` est un chemin interne (« /tickets »). */
    cta?: { label: string; path: string };
    /** Lot 7 (7.9) : note sous le bouton. */
    footnote?: string;
    /** Sujet optionnel : ajoute le pied de désabonnement. */
    unsubscribeTopic?: EmailTopic | null;
}

export interface EmailLayoutOutput { html: string; text: string }

const SUPPORT_ADDRESS = 'support@eventvillage.sn';

/** Seule feuille de style : surcharges du thème sombre (les styles en ligne restent ceux du thème clair). */
const DARK_STYLE = `<style>
    @media (prefers-color-scheme: dark) {
      .ev-bg { background: #0F0F11 !important; }
      .ev-card { background: #18181B !important; border-color: #3F3F46 !important; }
      .ev-divider { border-top-color: #3F3F46 !important; }
      .ev-text { color: #F4F4F5 !important; }
      .ev-muted { color: #A1A1AA !important; }
      .ev-link { color: #FDBA74 !important; }
      .ev-notice { background: #2A1609 !important; border-left-color: #EA580C !important; }
    }
  </style>`;

function factValueLines(value: EmailFact['value']): string[] {
    return (typeof value === 'string' ? [value] : [...value]).map((v) => String(v));
}

function factsHtml(facts: readonly EmailFact[]): string {
    if (facts.length === 0) return '';
    const rows = facts.map((f) => `<tr>
              <td class="ev-muted" style="padding:6px 12px 6px 0;font-size:14px;line-height:1.5;color:#475569;vertical-align:top;white-space:nowrap;">${escapeHtml(f.label)}</td>
              <td class="ev-text" style="padding:6px 0;font-size:15px;line-height:1.5;font-weight:600;color:#0F172A;vertical-align:top;word-break:break-word;">${factValueLines(f.value).map(escapeHtml).join('<br />')}</td>
            </tr>`).join('\n            ');
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border-collapse:collapse;">
            ${rows}
          </table>`;
}

function listHtml(list: EmailList): string {
    const items = list.items
        .map((item) => `<li class="ev-text" style="margin:0 0 4px;font-size:15px;line-height:1.5;color:#0F172A;word-break:break-all;">${escapeHtml(item)}</li>`)
        .join('\n            ');
    const more = list.more
        ? `\n          <p class="ev-muted" style="margin:0 0 20px;font-size:14px;line-height:1.5;color:#475569;">${escapeHtml(list.more)}</p>`
        : '';
    return `<p class="ev-text" style="margin:0 0 8px;font-size:14px;line-height:1.5;font-weight:700;color:#0F172A;">${escapeHtml(list.title)}</p>
          <ul style="margin:0 0 ${list.more ? '8' : '20'}px;padding:0 0 0 20px;">
            ${items}
          </ul>${more}`;
}

function noticeHtml(notice: readonly string[]): string {
    if (notice.length === 0) return '';
    const paragraphs = notice
        .map((p, i) => `<p class="ev-text" style="margin:0 0 ${i === notice.length - 1 ? '0' : '10px'};font-size:15px;line-height:1.6;color:#0F172A;">${escapeHtml(p)}</p>`)
        .join('\n              ');
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;"><tr>
            <td class="ev-notice" style="padding:16px 18px;background:#FFF7ED;border-left:4px solid #C2410C;border-radius:8px;">
              ${paragraphs}
            </td>
          </tr></table>`;
}

function factsText(facts: readonly EmailFact[]): string[] {
    return facts.map((f) => `${f.label} : ${factValueLines(f.value).join(', ')}`);
}

export function emailLayout(input: EmailLayoutInput): EmailLayoutOutput {
    const appUrl = input.appUrl.replace(/\/+$/, '');
    const ctaUrl = input.cta ? `${appUrl}${input.cta.path}` : null;
    const unsubscribe = input.unsubscribeTopic ? unsubscribeUrl(appUrl, input.unsubscribeTopic) : null;
    const facts = input.facts ?? [];
    const list = input.list && input.list.items.length > 0 ? input.list : null;
    const notice = input.notice ?? [];
    const footnote = input.footnote?.trim() ? input.footnote.trim() : null;

    const blocks: string[] = [];
    for (const p of input.paragraphs) {
        blocks.push(`<p class="ev-text" style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#0F172A;">${escapeHtml(p)}</p>`);
    }
    if (facts.length > 0) blocks.push(factsHtml(facts));
    if (list) blocks.push(listHtml(list));
    if (notice.length > 0) blocks.push(noticeHtml(notice));
    if (ctaUrl && input.cta) {
        blocks.push(`<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;"><tr><td style="background:#C2410C;border-radius:12px;">
            <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:700;color:#FFFFFF;text-decoration:none;">${escapeHtml(input.cta.label)}</a>
          </td></tr></table>`);
    }
    if (footnote) {
        blocks.push(`<p class="ev-muted" style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#475569;">${escapeHtml(footnote)}</p>`);
    }
    const unsubscribeHtml = unsubscribe
        ? `<p class="ev-muted" style="margin:12px 0 0;font-size:14px;line-height:1.6;color:#475569;">Ne plus recevoir ces emails : <a class="ev-link" href="${escapeHtml(unsubscribe)}" style="color:#C2410C;">${escapeHtml(unsubscribe)}</a></p>`
        : '';

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>${escapeHtml(input.heading)}</title>
  ${DARK_STYLE}
</head>
<body class="ev-bg" style="margin:0;padding:0;background:#F4F5F7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <table class="ev-bg" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F5F7;padding:24px 12px;">
    <tr><td align="center">
      <table class="ev-card" role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FFFFFF;border:1px solid #E4E4E7;border-radius:16px;">
        <tr><td style="padding:24px 28px 8px;">
          <p class="ev-link" style="margin:0 0 16px;font-size:14px;font-weight:700;letter-spacing:0.5px;color:#C2410C;">Event Village</p>
          <h1 class="ev-text" style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#0F172A;">${escapeHtml(input.heading)}</h1>
          ${blocks.join('\n          ')}
        </td></tr>
        <tr><td class="ev-divider" style="padding:16px 28px 24px;border-top:1px solid #E4E4E7;">
          <p class="ev-muted" style="margin:0;font-size:14px;line-height:1.6;color:#475569;">Message automatique d'Event Village, merci de ne pas y répondre. Support : <a class="ev-link" href="mailto:${SUPPORT_ADDRESS}" style="color:#C2410C;">${SUPPORT_ADDRESS}</a></p>
          ${unsubscribeHtml}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const textLines = [input.heading, '', ...input.paragraphs.flatMap((p) => [p, ''])];
    if (facts.length > 0) textLines.push(...factsText(facts), '');
    if (list) {
        textLines.push(`${list.title} :`, ...list.items.map((item) => `- ${item}`));
        if (list.more) textLines.push(list.more);
        textLines.push('');
    }
    if (notice.length > 0) textLines.push(...notice.flatMap((p) => [p, '']));
    if (ctaUrl && input.cta) textLines.push(`${input.cta.label} : ${ctaUrl}`, '');
    if (footnote) textLines.push(footnote, '');
    textLines.push('—', `Message automatique d'Event Village, merci de ne pas y répondre. Support : ${SUPPORT_ADDRESS}`);
    if (unsubscribe) textLines.push(`Ne plus recevoir ces emails : ${unsubscribe}`);
    return { html, text: textLines.join('\n') };
}
