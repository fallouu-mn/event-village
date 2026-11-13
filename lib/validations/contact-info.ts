/**
 * Lot 9 quater (D3 : AUD-26) — un texte saisi par une partenaire et recopié dans les SMS envoyés par Event Village
 * (titre, lieu, ville d'un événement, nom d'un invité, consigne d'entrée) ne porte ni adresse web ni numéro de
 * téléphone : sinon un compte compromis ferait envoyer « Event Village : <lien> » à tous les porteurs.
 *
 * Adresse web : « http:// », « https:// », « www. », ou un nom de domaine (mot, point, extension courante).
 * Numéro : un mobile ou fixe sénégalais (7x / 33 / 30, 9 chiffres, indicatif 221 facultatif, séparés ou non par des
 * espaces, points ou tirets), ou toute suite de 10 chiffres et plus. Une année (« 2026 ») ou une plage d'années
 * (« 2026-2027 ») n'est pas un numéro.
 */

const URL_RE = /(?:https?:\/\/|www\.)\S/i;
const DOMAIN_RE = /\b[a-z0-9][a-z0-9-]*\.(?:com|net|org|sn|fr|io|me|ly|co|app|link|xyz|info|biz|site|online|shop|store|page|gl|to|tk|cc|club|live|click)\b/i;
const SN_PHONE_RE = /(?:^|[^\d])(?:(?:\+|00)?221[\s.-]?)?(?:7[05678]|3[03])(?:[\s.-]?\d){7}(?!\d)/;
const LONG_DIGITS_RE = /\d(?:[\s.-]?\d){9,}/;

/** Le texte contient-il une adresse web ou un numéro de téléphone ? */
export function hasContactInfo(text: string | null | undefined): boolean {
    if (!text) return false;
    return URL_RE.test(text) || DOMAIN_RE.test(text) || SN_PHONE_RE.test(text) || LONG_DIGITS_RE.test(text);
}

/** Message de refus d'un champ (« Le titre », « Le lieu »…). */
export function contactInfoMessage(fieldWithArticle: string): string {
    return `${fieldWithArticle} ne peut pas contenir d'adresse web ni de numéro de téléphone.`;
}
