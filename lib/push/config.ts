/**
 * Lot 6 (contrat F4) — configuration du push web (VAPID), côté serveur seulement.
 *
 * Les trois variables VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY et VAPID_SUBJECT sont FACULTATIVES, mais vont
 * ensemble : toutes trois valides, le canal est actif ; aucune, une partie seulement, ou une valeur
 * invalide, le canal est désactivé (lignes SKIPPED PUSH_NOT_CONFIGURED) et le reste de l'application
 * fonctionne. Un seul avertissement est émis par processus (sans jamais citer une clé).
 *
 * Contrôles : clé publique P-256 non compressée (65 octets, base64url) ; clé privée de 32 octets
 * (base64url) ; sujet `mailto:` ou `https:` (exigence du protocole VAPID, RFC 8292).
 * `keyId` = base64url(sha256(clé publique brute)).slice(0, 16) : identifie la paire qui a servi à chaque
 * abonnement (push_subscriptions.vapid_key_id) ; un abonnement d'une autre paire est supprimé à l'envoi.
 *
 * La configuration est lue dans process.env et gardée en cache tant que les trois valeurs ne changent
 * pas ; resetPushConfigCache() vide ce cache (tests).
 */
import { createHash } from 'node:crypto';

export interface PushConfigEnabled {
    enabled: true;
    publicKey: string;
    privateKey: string;
    subject: string;
    keyId: string;
}

export interface PushConfigDisabled {
    enabled: false;
    /** Raison lisible (journal seulement), jamais une valeur de clé. */
    reason: string;
}

export type PushConfig = PushConfigEnabled | PushConfigDisabled;

const BASE64URL_RE = /^[A-Za-z0-9_-]+$/;

/** Octets d'une valeur base64url (sans « = »), ou null si elle n'en est pas une. */
export function base64UrlBytes(value: string): Buffer | null {
    if (!BASE64URL_RE.test(value)) return null;
    return Buffer.from(value, 'base64url');
}

/** Identifiant de la paire VAPID : base64url(sha256(clé publique brute)), 16 caractères. */
export function vapidKeyIdOf(publicKey: string): string {
    return createHash('sha256').update(Buffer.from(publicKey, 'base64url')).digest('base64url').slice(0, 16);
}

function clean(value: string | undefined): string | undefined {
    const v = value?.trim();
    return v ? v : undefined;
}

function validSubject(subject: string): boolean {
    let url: URL;
    try {
        url = new URL(subject);
    } catch {
        return false; // valeur illisible : sujet refusé, la raison est journalisée par l'appelant
    }
    if (url.protocol === 'mailto:') return url.pathname.includes('@');
    return url.protocol === 'https:' && url.hostname.length > 0;
}

function evaluate(publicKey: string | undefined, privateKey: string | undefined, subject: string | undefined): PushConfig {
    if (!publicKey && !privateKey && !subject) {
        return { enabled: false, reason: 'variables VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY et VAPID_SUBJECT absentes' };
    }
    const missing = [
        ['VAPID_PUBLIC_KEY', publicKey], ['VAPID_PRIVATE_KEY', privateKey], ['VAPID_SUBJECT', subject],
    ].filter(([, v]) => !v).map(([k]) => k);
    if (missing.length > 0) {
        return { enabled: false, reason: `configuration partielle : ${missing.join(', ')} absente(s) (les trois variables vont ensemble)` };
    }
    const pub = base64UrlBytes(publicKey!);
    if (!pub || pub.length !== 65 || pub[0] !== 0x04) {
        return { enabled: false, reason: 'VAPID_PUBLIC_KEY invalide (clé publique P-256 non compressée de 65 octets, en base64url, attendue)' };
    }
    const priv = base64UrlBytes(privateKey!);
    if (!priv || priv.length !== 32) {
        return { enabled: false, reason: 'VAPID_PRIVATE_KEY invalide (clé privée P-256 de 32 octets, en base64url, attendue)' };
    }
    if (!validSubject(subject!)) {
        return { enabled: false, reason: 'VAPID_SUBJECT invalide (adresse mailto: ou URL https: attendue)' };
    }
    return { enabled: true, publicKey: publicKey!, privateKey: privateKey!, subject: subject!, keyId: vapidKeyIdOf(publicKey!) };
}

let cache: { signature: string; config: PushConfig } | null = null;

/** Configuration courante du push (lue dans process.env, en cache tant que les valeurs ne changent pas). */
export function getPushConfig(): PushConfig {
    const publicKey = clean(process.env.VAPID_PUBLIC_KEY);
    const privateKey = clean(process.env.VAPID_PRIVATE_KEY);
    const subject = clean(process.env.VAPID_SUBJECT);
    // Empreinte des valeurs (jamais conservées en clair dans la clé du cache).
    const signature = createHash('sha256').update(`${publicKey ?? ''}\n${privateKey ?? ''}\n${subject ?? ''}`).digest('base64url');
    if (cache && cache.signature === signature) return cache.config;
    const config = evaluate(publicKey, privateKey, subject);
    cache = { signature, config };
    return config;
}

/** Réservé aux tests (withEnv) : force une nouvelle lecture au prochain appel. */
export function resetPushConfigCache(): void {
    cache = null;
}

const WARNED = Symbol.for('event-village.push-disabled-warned');
type ProcessFlags = typeof globalThis & { [WARNED]?: boolean };

/**
 * true si le canal push est actif ; sinon avertit une seule fois par processus (avec la raison, sans
 * aucune valeur de clé) et renvoie false.
 */
export function pushChannelAvailable(): boolean {
    const config = getPushConfig();
    if (config.enabled) return true;
    const flags = globalThis as ProcessFlags;
    if (!flags[WARNED]) {
        flags[WARNED] = true;
        console.warn(`[notifications] Canal push désactivé : ${config.reason}. Les notifications partent dans l'application et par SMS.`);
    }
    return false;
}
