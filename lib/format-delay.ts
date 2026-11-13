/**
 * Lot 9 quinquies (B3 : AUTH-03, E-56) — délai d'attente réel après un refus 429, dit en mots.
 *
 * Les routes rendent `retryAfterSeconds` (lib/security/quota-http.ts, lib/sms/sms-http.ts, lib/auth/login-guard.ts) ;
 * les écrans et les messages du serveur l'affichent ici : en secondes jusqu'à 2 minutes, en minutes jusqu'à 2 heures,
 * en heures au-delà (arrondi au supérieur : jamais une attente plus courte que la réalité).
 * Module partagé : sans dépendance serveur (importé par des composants client).
 */

/** Durée en mots : « 45 secondes », « 45 minutes », « 3 heures ». */
export function formatDelayWords(seconds: number): string {
    const s = Math.max(1, Math.ceil(Number.isFinite(seconds) ? seconds : 60));
    if (s <= 120) return `${s} seconde${s > 1 ? 's' : ''}`;
    const minutes = Math.ceil(s / 60);
    if (minutes < 120) return `${minutes} minutes`;
    const hours = Math.ceil(s / 3600);
    return `${hours} heures`;
}

/** Phrase complète : « Réessayez dans 45 minutes. » */
export function formatRetryDelay(seconds: number): string {
    return `Réessayez dans ${formatDelayWords(seconds)}.`;
}

/** Délai d'un corps de réponse 429 : `retryAfterSeconds` (seul champ envoyé par le serveur), sinon null. */
export function retryAfterOf(body: unknown): number | null {
    if (!body || typeof body !== 'object') return null;
    const v = (body as { retryAfterSeconds?: unknown }).retryAfterSeconds;
    const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
    return Number.isFinite(n) && n > 0 ? Math.ceil(n) : null;
}
