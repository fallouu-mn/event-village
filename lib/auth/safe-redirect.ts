/**
 * Lot 9 quater (A1 : AUD-17, G-03) — seule fonction de nettoyage d'une destination après connexion ou inscription
 * (`?redirect=`, `?next=`, `?returnTo=`). Tout lecteur de ces paramètres passe par elle : resolvePostLoginRoute,
 * LoginForm, la page de connexion, la page d'inscription.
 *
 * N'est accepté qu'un chemin interne du site :
 *  - commence par un seul « / » (jamais « // », jamais « /\ ») ;
 *  - aucune barre oblique inverse, aucun caractère de contrôle (tabulation et retour à la ligne compris : le
 *    navigateur les retire, « /\t/site.example » deviendrait « //site.example ») ;
 *  - aucun schéma (javascript:, data:, vbscript:, http:, https:…) ;
 *  - mêmes contrôles sur chaque forme décodée (« %2F%2F », double encodage), jusqu'à stabilité ;
 *  - résolu contre une origine fictive, il reste sur cette origine.
 * Sinon : `null`, et l'appelant envoie vers l'espace du compte.
 */

const MAX_LENGTH = 2048;
const MAX_DECODE_PASSES = 5;
const PROBE_ORIGIN = 'https://destination.eventvillage.invalid';
/** Caractère de contrôle C0 ou C1, ou séparateur de ligne ou de paragraphe Unicode (U+2028, U+2029). */
function hasControlChar(value: string): boolean {
    for (let i = 0; i < value.length; i += 1) {
        const c = value.charCodeAt(i);
        if (c <= 0x1f || (c >= 0x7f && c <= 0x9f) || c === 0x2028 || c === 0x2029) return true;
    }
    return false;
}
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/** Une forme (brute ou décodée) est-elle un chemin interne sûr ? */
function isSafeForm(value: string): boolean {
    if (!value.startsWith('/')) return false;
    if (value.startsWith('//')) return false;
    if (value.includes('\\')) return false;
    if (hasControlChar(value)) return false;
    if (SCHEME.test(value)) return false;
    // Un schéma caché derrière des caractères ignorés est déjà exclu (contrôle, « \ ») ; dernier filet : l'URL résolue
    // reste sur l'origine de départ.
    let resolved: URL;
    try {
        resolved = new URL(value, PROBE_ORIGIN);
    } catch {
        return false;
    }
    return resolved.origin === PROBE_ORIGIN && resolved.protocol === 'https:';
}

/**
 * Chemin interne sûr tiré de `raw`, ou `null`. La valeur rendue est la valeur saisie (espaces de bord retirés), jamais
 * une forme décodée : le navigateur la décode lui-même une fois.
 */
export function safeInternalPath(raw: string | null | undefined): string | null {
    if (typeof raw !== 'string') return null;
    const value = raw.trim();
    if (!value || value.length > MAX_LENGTH) return null;

    let form = value;
    for (let pass = 0; pass <= MAX_DECODE_PASSES; pass += 1) {
        if (!isSafeForm(form)) return null;
        let decoded: string;
        try {
            decoded = decodeURIComponent(form);
        } catch {
            // Séquence « % » invalide : le navigateur la garderait telle quelle ; la forme courante a passé les contrôles
            return value;
        }
        if (decoded === form) return value;
        form = decoded;
    }
    // Encodage imbriqué au-delà de MAX_DECODE_PASSES : refusé
    return null;
}

/** Destination à transmettre telle quelle à l'inscription (`/register?redirect=`) : chemin sûr autre que « / ». */
export function isForwardableRedirect(raw: string | null | undefined): boolean {
    const safe = safeInternalPath(raw);
    return safe !== null && safe !== '/';
}
