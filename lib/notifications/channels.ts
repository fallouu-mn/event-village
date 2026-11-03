/**
 * Lot 1C.8, lot 6 — disponibilité des canaux facultatifs de notification.
 *
 * Le SMS (MTarget) est le canal essentiel : ses identifiants sont obligatoires (lib/env.ts).
 * L'email (Resend) est facultatif : sans RESEND_API_KEY, l'envoyeur n'appelle pas l'adaptateur, la ligne
 * EMAIL de la boîte d'envoi passe SKIPPED avec le motif EMAIL_NOT_CONFIGURED, aucune route n'échoue, et un
 * seul avertissement est émis pour tout le processus. Le push web est facultatif de la même façon
 * (lib/push/config.ts, pushChannelAvailable : SKIPPED PUSH_NOT_CONFIGURED).
 *
 * Une adresse factice (« <chiffres>@eventvillage.sn », créée pour un compte inscrit par téléphone) n'est
 * jamais destinataire (SKIPPED NO_REAL_EMAIL).
 */

const WARNED = Symbol.for('event-village.email-disabled-warned');
type ProcessFlags = typeof globalThis & { [WARNED]?: boolean };

/** Lu à chaque appel : la clé peut être ajoutée plus tard sans changer le code. */
export function isEmailEnabled(): boolean {
    return Boolean(process.env.RESEND_API_KEY?.trim());
}

/** true si le canal email est actif ; sinon avertit une seule fois par processus et renvoie false. */
export function emailChannelAvailable(): boolean {
    if (isEmailEnabled()) return true;
    const flags = globalThis as ProcessFlags;
    if (!flags[WARNED]) {
        flags[WARNED] = true;
        console.warn('[notifications] Canal email désactivé : RESEND_API_KEY absente. Les notifications partent par SMS et dans l’application.');
    }
    return false;
}

const PLACEHOLDER_EMAIL_RE = /^[0-9]+@eventvillage\.sn$/i;

/** true pour une adresse réelle (contient « @ » et n'est pas une adresse factice d'un compte par téléphone). */
export function isDeliverableEmail(address: unknown): address is string {
    if (typeof address !== 'string') return false;
    const a = address.trim();
    return a.indexOf('@') > 0 && a.length <= 254 && !PLACEHOLDER_EMAIL_RE.test(a);
}
