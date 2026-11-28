/**
 * Lot « Avis », phase 2 (2h, écart C3 de docs/avis-inventaire.md) — longueur de l'adresse de l'application.
 *
 * Chaque SMS d'avis finit par un lien `NEXT_PUBLIC_APP_URL + chemin`. Les textes sont mesurés avec une adresse de
 * 27 caractères (https://app.eventvillage.sn, contrat G3) : six SMS font alors 160 caractères pile au pire cas. Une adresse
 * plus longue en ferait passer en deux SMS (deux fois facturés, parfois coupés). En production, le serveur refuse donc de
 * démarrer avec une adresse plus longue (instrumentation.ts), avec un message pour l'exploitant.
 * Exemption : essai local par tunnel (docs/essai-local.md section 9), dont l'adresse est forcément longue. Correctif T5 de
 * la contre-vérification : seulement si l'adresse de l'application est EXACTEMENT celle du tunnel déclaré
 * (EV_DEV_TUNNEL_URL) et de la forme https://<nom>.trycloudflare.com (comme scripts/dev/cron-local.core.mjs) ; une valeur
 * quelconque de EV_DEV_TUNNEL_URL, ou un tunnel déclaré avec une autre adresse, ne lève jamais la garde.
 */

/** Adresse d'un tunnel Cloudflare d'essai (https, un seul nom avant trycloudflare.com). */
const TUNNEL_RE = /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/i;
const clean = (v: string | undefined): string => (v ?? '').trim().replace(/\/+$/, '');

/** Longueur maximale de NEXT_PUBLIC_APP_URL, « / » final retiré (contrat G3 des SMS). */
export const APP_URL_MAX_LENGTH = 27;

/** Message de refus si l'adresse est trop longue en production ; null sinon. */
export function appUrlStartupProblem(env: Record<string, string | undefined>): string | null {
    if (env.NODE_ENV !== 'production') return null;
    const url = clean(env.NEXT_PUBLIC_APP_URL);
    if (url.length <= APP_URL_MAX_LENGTH) return null;
    if (TUNNEL_RE.test(url) && url.toLowerCase() === clean(env.EV_DEV_TUNNEL_URL).toLowerCase()) return null;
    return `[démarrage] Refus de démarrer : l'adresse de l'application (NEXT_PUBLIC_APP_URL) fait ${url.length} caractères, ${APP_URL_MAX_LENGTH} au plus. `
        + 'Chaque SMS contient ce lien : plus long, certains SMS partiraient en deux messages (facturés deux fois). '
        + 'Choisissez un domaine court (par exemple https://app.eventvillage.sn), mettez-le dans NEXT_PUBLIC_APP_URL, puis relancez.';
}
