/**
 * Lot 6 (contrat F4) — liste blanche des services push (anti-SSRF), contrôlée à l'inscription d'un
 * appareil ET à chaque envoi : le serveur n'émet jamais de requête vers une adresse choisie par un client.
 *
 * Liste par défaut (services des navigateurs) :
 *  - https://fcm.googleapis.com              (Chrome, Edge, Android)
 *  - https://updates.push.services.mozilla.com (Firefox)
 *  - https://web.push.apple.com              (Safari)
 *  - https://*.notify.windows.com            (WNS : sous-domaines seulement, en https)
 *
 * `PUSH_ENDPOINT_ALLOWED_ORIGINS` (origines séparées par des virgules) REMPLACE cette liste ; une entrée est
 * une origine exacte (`https://hôte[:port]`) ou `https://*.suffixe`. `http:` n'est admis que pour
 * 127.0.0.1 et localhost (faux service push de l'e2e) ; toute autre entrée http est ignorée et signalée.
 * Un point d'arrivée avec identifiants (`user@hôte`), un port non prévu ou un hôte voisin est refusé :
 * la comparaison porte sur l'origine analysée par `URL`, jamais sur un préfixe de chaîne.
 */

export const DEFAULT_PUSH_ORIGINS: readonly string[] = [
    'https://fcm.googleapis.com',
    'https://updates.push.services.mozilla.com',
    'https://web.push.apple.com',
    'https://*.notify.windows.com',
];

export const MAX_PUSH_ENDPOINT_LENGTH = 2048;

interface ExactRule { kind: 'exact'; origin: string }
interface SuffixRule { kind: 'suffix'; suffix: string }
type OriginRule = ExactRule | SuffixRule;

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost']);

const IGNORED_WARNED = new Set<string>();

function warnIgnored(entry: string, why: string): void {
    if (IGNORED_WARNED.has(entry)) return;
    IGNORED_WARNED.add(entry);
    console.warn(`[push] PUSH_ENDPOINT_ALLOWED_ORIGINS : entrée « ${entry} » ignorée (${why}).`);
}

function parseRule(entry: string): OriginRule | null {
    const wildcard = /^https:\/\/\*\.([a-z0-9.-]+)$/i.exec(entry);
    if (wildcard) {
        const suffix = wildcard[1].toLowerCase();
        if (!suffix.includes('.') || suffix.startsWith('.') || suffix.endsWith('.') || suffix.includes('..')) {
            warnIgnored(entry, 'suffixe de domaine invalide');
            return null;
        }
        return { kind: 'suffix', suffix };
    }
    let url: URL;
    try {
        url = new URL(entry);
    } catch {
        warnIgnored(entry, 'origine illisible');
        return null;
    }
    if (url.username || url.password || (url.pathname !== '/' && url.pathname !== '') || url.search || url.hash) {
        warnIgnored(entry, 'une origine seule est attendue (schéma, hôte et port)');
        return null;
    }
    if (url.protocol === 'http:' && !LOCAL_HOSTS.has(url.hostname)) {
        warnIgnored(entry, 'http admis seulement pour 127.0.0.1 et localhost');
        return null;
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
        warnIgnored(entry, 'schéma non pris en charge');
        return null;
    }
    return { kind: 'exact', origin: url.origin };
}

function rules(): OriginRule[] {
    const raw = process.env.PUSH_ENDPOINT_ALLOWED_ORIGINS?.trim();
    const entries = raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : [...DEFAULT_PUSH_ORIGINS];
    return entries.map(parseRule).filter((r): r is OriginRule => r !== null);
}

/** true si l'adresse est un point d'arrivée d'un service push autorisé (liste blanche courante). */
export function isAllowedPushEndpoint(endpoint: unknown): boolean {
    if (typeof endpoint !== 'string' || endpoint.length === 0 || endpoint.length > MAX_PUSH_ENDPOINT_LENGTH) return false;
    let url: URL;
    try {
        url = new URL(endpoint);
    } catch {
        return false; // adresse illisible : refusée
    }
    if (url.username || url.password) return false;
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
    for (const rule of rules()) {
        if (rule.kind === 'exact') {
            if (url.origin === rule.origin) return true;
        } else if (url.protocol === 'https:' && url.port === '' && url.hostname.toLowerCase().endsWith(`.${rule.suffix}`)) {
            return true;
        }
    }
    return false;
}
