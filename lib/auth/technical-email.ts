/**
 * Lot 9 quater (A4 : AUD-19) — adresse technique d'un compte inscrit par son numéro.
 *
 * GoTrue identifie chaque compte par une adresse email. Un compte à numéro reçoit une adresse technique non routable
 * sous le domaine réservé `.invalid` (RFC 2606 : aucune boîte ne peut exister), unique par compte, tirée au hasard (ou
 * de l'identifiant du compte, comme la migration 20261111000001 : technical_email_for), jamais déductible du numéro,
 * jamais affichée, refusée à la saisie (TECHNICAL_EMAIL_RE, lib/notifications/channels.ts). La base refuse en plus à
 * GoTrue tout code ou lien email vers une adresse technique (trigger auth_users_guard_writes).
 */
import { randomBytes } from 'node:crypto';

export const TECHNICAL_EMAIL_DOMAIN = 'comptes.eventvillage.invalid';

/** Adresse technique neuve, aléatoire (création d'un compte : inscription, partenaire, invitation, administration). */
export function newTechnicalEmail(): string {
    return `u${randomBytes(16).toString('hex')}@${TECHNICAL_EMAIL_DOMAIN}`;
}

/** Adresse technique tirée de l'identifiant du compte (même règle que technical_email_for en base). */
export function technicalEmailFor(userId: string): string {
    return `u${userId.replace(/-/g, '').toLowerCase()}@${TECHNICAL_EMAIL_DOMAIN}`;
}
