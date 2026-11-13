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
import { isRealRun } from '@/lib/integrations/real-mode';

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

function parseRule(entry: string, env: NodeJS.ProcessEnv = process.env): OriginRule | null {
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
    // Lot 9 quater (F3 : AUD-39) : en production réelle, ni http ni hôte local, quelle que soit la variable
    if (strictPushOrigins(env) && (url.protocol !== 'https:' || LOCAL_HOSTS.has(url.hostname))) {
        warnIgnored(entry, 'en production, https seulement et jamais un hôte local');
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

/**
 * Lot 9 quater (F3 : AUD-39) — production réelle : serveur de production (NODE_ENV=production) en mode réel
 * (lib/integrations/real-mode.ts, ni simulation ni faux adaptateurs). Les essais de bout en bout (production, faux
 * adaptateurs) gardent leur service push local.
 */
export function strictPushOrigins(env: NodeJS.ProcessEnv = process.env): boolean {
    return env.NODE_ENV === 'production' && isRealRun(env);
}

/** Contrôle du démarrage : texte du refus si PUSH_ENDPOINT_ALLOWED_ORIGINS porte http ou un hôte local en production réelle. */
export function pushOriginsStartupProblem(env: NodeJS.ProcessEnv = process.env): string | null {
    if (!strictPushOrigins(env)) return null;
    const raw = env.PUSH_ENDPOINT_ALLOWED_ORIGINS?.trim();
    if (!raw) return null;
    const bad = raw.split(',').map((s) => s.trim()).filter(Boolean).filter((entry) => {
        if (/^https:\/\/\*\./i.test(entry)) return false;
        try {
            const url = new URL(entry);
            return url.protocol !== 'https:' || LOCAL_HOSTS.has(url.hostname);
        } catch {
            return false; // illisible : déjà ignorée et signalée par parseRule
        }
    });
    return bad.length === 0 ? null
        : `[push] Refus de démarrer : en production, PUSH_ENDPOINT_ALLOWED_ORIGINS n'admet ni http ni hôte local (${bad.join(', ')}).`;
}

function rules(env: NodeJS.ProcessEnv = process.env): OriginRule[] {
    const raw = env.PUSH_ENDPOINT_ALLOWED_ORIGINS?.trim();
    const entries = raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : [...DEFAULT_PUSH_ORIGINS];
    return entries.map((e) => parseRule(e, env)).filter((r): r is OriginRule => r !== null);
}

/** true si l'adresse est un point d'arrivée d'un service push autorisé (liste blanche courante). */
/** `env` : environnement lu (process.env par défaut ; un test passe le sien). */
export function isAllowedPushEndpoint(endpoint: unknown, env: NodeJS.ProcessEnv = process.env): boolean {
    if (typeof endpoint !== 'string' || endpoint.length === 0 || endpoint.length > MAX_PUSH_ENDPOINT_LENGTH) return false;
    let url: URL;
    try {
        url = new URL(endpoint);
    } catch {
        return false; // adresse illisible : refusée
    }
    if (url.username || url.password) return false;
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
    if (strictPushOrigins(env) && (url.protocol !== 'https:' || LOCAL_HOSTS.has(url.hostname))) return false;
    for (const rule of rules(env)) {
        if (rule.kind === 'exact') {
            if (url.origin === rule.origin) return true;
        } else if (url.protocol === 'https:' && url.port === '' && url.hostname.toLowerCase().endsWith(`.${rule.suffix}`)) {
            return true;
        }
    }
    return false;
}
