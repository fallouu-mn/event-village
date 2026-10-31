/**
 * Lot 1C.8 — canaux de notification.
 * Le SMS (MTarget) est le canal essentiel : ses identifiants sont obligatoires (lib/env.ts).
 * L'email (Resend) est optionnel : sans RESEND_API_KEY, aucun envoi n'est tenté, aucune route
 * n'échoue, et un seul avertissement est émis pour tout le processus. SMS et notifications
 * dans l'application partent normalement.
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
