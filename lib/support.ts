/**
 * Lot 9 bis, tâche 41 (R70 ; contrat 5.41, B88, décision D4) — une seule adresse de support, lue côté serveur.
 * Par défaut `support@eventvillage.sn` (domaine de l'application) ; la variable SUPPORT_EMAIL la remplace sans code.
 * Jamais en NEXT_PUBLIC_ (figée au build) : un écran client la reçoit dans la réponse de sa route (`support_email`).
 */
import { getServerEnv } from '@/lib/env';

export const DEFAULT_SUPPORT_EMAIL = 'support@eventvillage.sn';

/** Adresse de support montrée aux personnes (PDF, exports, emails, écrans). */
export function supportEmail(): string {
    return getServerEnv().SUPPORT_EMAIL ?? DEFAULT_SUPPORT_EMAIL;
}
