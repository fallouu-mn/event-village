/**
 * Lot « Avis », phase 2 (2h, écart C3 de docs/avis-inventaire.md) — longueur de l'adresse de l'application.
 *
 * Chaque SMS d'avis finit par un lien `NEXT_PUBLIC_APP_URL + chemin`. Les textes sont mesurés avec une adresse de
 * 27 caractères (https://app.eventvillage.sn, contrat G3) : six SMS font alors 160 caractères pile au pire cas. Une adresse
 * plus longue en ferait passer en deux SMS (deux fois facturés, parfois coupés). En production, le serveur refuse donc de
 * démarrer avec une adresse plus longue (instrumentation.ts), avec un message pour l'exploitant.
 * Exemption : essai local par tunnel (EV_DEV_TUNNEL_URL posée, docs/essai-local.md), dont l'adresse est forcément longue.
 */

/** Longueur maximale de NEXT_PUBLIC_APP_URL, « / » final retiré (contrat G3 des SMS). */
export const APP_URL_MAX_LENGTH = 27;

/** Message de refus si l'adresse est trop longue en production ; null sinon. */
export function appUrlStartupProblem(env: Record<string, string | undefined>): string | null {
    if (env.NODE_ENV !== 'production') return null;
    if (env.EV_DEV_TUNNEL_URL && env.EV_DEV_TUNNEL_URL.trim() !== '') return null;
    const url = (env.NEXT_PUBLIC_APP_URL ?? '').trim().replace(/\/+$/, '');
    if (url.length <= APP_URL_MAX_LENGTH) return null;
    return `[démarrage] Refus de démarrer : l'adresse de l'application (NEXT_PUBLIC_APP_URL) fait ${url.length} caractères, ${APP_URL_MAX_LENGTH} au plus. `
        + 'Chaque SMS contient ce lien : plus long, certains SMS partiraient en deux messages (facturés deux fois). '
        + 'Choisissez un domaine court (par exemple https://app.eventvillage.sn), mettez-le dans NEXT_PUBLIC_APP_URL, puis relancez.';
}
