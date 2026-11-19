/**
 * Lot 6 (contrat F4 « Client ») — push web côté navigateur.
 *
 * Règle : l'autorisation des notifications n'est demandée QUE par enablePush, elle-même appelée seulement
 * par le gestionnaire de clic du bouton « Activer les notifications » (components/notifications/
 * PushDeviceCard.tsx), jamais au chargement d'une page ni dans un effet (contrôle statique des tests).
 * La lecture de l'état (currentPushState) ne demande jamais rien et ne s'abonne jamais.
 *
 * Les appels aux routes /api/push/* portent la session par les cookies (même origine).
 * Ce module ne contient aucun secret : seule la clé PUBLIQUE VAPID est lue (GET /api/push/config).
 *
 * Design 1b (point 9) — réabonnement automatique de CET appareil. Depuis la contre-vérification 2b (6.8, 6.9), toute fin de
 * session retire l'abonnement du navigateur (et « Déconnecter tous mes appareils » tous ceux du compte côté serveur) ; la
 * permission du navigateur, elle, reste « accordée ». À la reconnexion, syncPushSubscription (appelée par AuthProvider)
 * réabonne l'appareil SANS fenêtre d'autorisation, seulement si :
 *  - la permission est déjà accordée (jamais de demande : requestPermission reste dans enablePush seule) ;
 *  - la personne n'a pas désactivé les notifications de cet appareil : réglage de l'APPAREIL `ev-push-appareil` =
 *    « desactive », écrit par disablePush (« Désactiver »), retiré par enablePush (« Activer ») ; aucune donnée du compte
 *    (ni identifiant, ni empreinte), comme le thème : rien à effacer à la déconnexion (inventaire des stockages,
 *    tests/audit/cvf2b-6-deconnexion.test.ts, cas 13) ;
 *  - l'abonnement est enregistré pour le compte CONNECTÉ seulement (session de la requête, côté serveur) ; si le compte a
 *    changé avant l'enregistrement, rien n'est envoyé et l'abonnement neuf est retiré.
 */

export type PushState = 'enabled' | 'denied' | 'disabled' | 'unsupported' | 'unavailable';

interface PushConfigResponse { enabled: boolean; publicKey: string | null }

const CONFIG_URL = '/api/push/config';
/** Réglage de l'appareil « notifications désactivées ici » (valeur DEVICE_OFF), sans aucune donnée du compte. */
export const PUSH_DEVICE_KEY = 'ev-push-appareil';
const DEVICE_OFF = 'desactive';
const SUBSCRIPTIONS_URL = '/api/push/subscriptions';
const SW_URL = '/sw.js';

/** true si ce navigateur sait recevoir des notifications push (contexte sécurisé, service worker, Push API). */
export function pushSupport(): boolean {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
    const w = window as unknown as { isSecureContext?: boolean };
    return w.isSecureContext === true
        && Boolean(navigator.serviceWorker)
        && 'PushManager' in window
        && 'Notification' in window;
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
    const b64 = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const binary = atob(padded);
    const out = new Uint8Array(new ArrayBuffer(binary.length));
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
}

function bytesOf(value: ArrayBuffer | ArrayBufferView | null | undefined): Uint8Array | null {
    if (!value) return null;
    if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    return new Uint8Array(value);
}

/** L'abonnement a-t-il été créé avec cette clé publique VAPID ? (inconnu : oui, le serveur tranchera). */
function sameServerKey(sub: PushSubscription, publicKey: string): boolean {
    const current = bytesOf(sub.options?.applicationServerKey ?? null);
    if (!current) return true;
    const expected = base64UrlToBytes(publicKey);
    if (current.length !== expected.length) return false;
    return current.every((b, i) => b === expected[i]);
}

async function errorMessage(res: Response, fallback: string): Promise<string> {
    try {
        const body = await res.json() as { error?: unknown };
        return typeof body.error === 'string' && body.error ? body.error : fallback;
    } catch {
        return fallback; // réponse sans corps JSON : message générique
    }
}

/** Notifications désactivées sur cet appareil par la personne (« Désactiver ») ? Stockage refusé : non. */
function deviceTurnedOff(): boolean {
    try {
        return window.localStorage.getItem(PUSH_DEVICE_KEY) === DEVICE_OFF;
    } catch {
        return false;
    }
}

function setDeviceTurnedOff(off: boolean): void {
    try {
        if (off) window.localStorage.setItem(PUSH_DEVICE_KEY, DEVICE_OFF);
        else window.localStorage.removeItem(PUSH_DEVICE_KEY);
    } catch {
        // stockage refusé (navigation privée) : réglage non gardé, l'abonnement suit la permission du navigateur
    }
}

/** Configuration publique du push (clé publique VAPID), lue sur le serveur. */
export async function fetchPushConfig(): Promise<PushConfigResponse> {
    const res = await fetch(CONFIG_URL, { credentials: 'same-origin', cache: 'no-store' });
    if (!res.ok) throw new Error(await errorMessage(res, 'Configuration des notifications indisponible.'));
    const body = await res.json() as Partial<PushConfigResponse>;
    return { enabled: body.enabled === true, publicKey: typeof body.publicKey === 'string' ? body.publicKey : null };
}

async function existingSubscription(): Promise<PushSubscription | null> {
    const reg = await navigator.serviceWorker.getRegistration();
    return reg ? reg.pushManager.getSubscription() : null;
}

async function readyRegistration(): Promise<ServiceWorkerRegistration> {
    await navigator.serviceWorker.register(SW_URL);
    return navigator.serviceWorker.ready;
}

function subscriptionBody(sub: PushSubscription): { endpoint: string; keys: { p256dh: string; auth: string }; userAgent?: string } {
    const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
    const endpoint = json.endpoint ?? sub.endpoint;
    const p256dh = json.keys?.p256dh;
    const auth = json.keys?.auth;
    if (!endpoint || !p256dh || !auth) throw new Error('Abonnement du navigateur incomplet : réessayez.');
    const ua = typeof navigator.userAgent === 'string' ? navigator.userAgent.slice(0, 200) : '';
    return ua ? { endpoint, keys: { p256dh, auth }, userAgent: ua } : { endpoint, keys: { p256dh, auth } };
}

async function registerOnServer(sub: PushSubscription): Promise<void> {
    const res = await fetch(SUBSCRIPTIONS_URL, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(subscriptionBody(sub)),
    });
    if (!res.ok) throw new Error(await errorMessage(res, 'Impossible d’enregistrer cet appareil. Réessayez.'));
    // Corps toujours consommé : une réponse jamais lue reste ouverte dans le navigateur (run 65 : requête
    // inachevée, réseau jamais au repos).
    await res.text();
}

async function removeOnServer(endpoint: string): Promise<void> {
    const res = await fetch(SUBSCRIPTIONS_URL, {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ endpoint }),
    });
    if (!res.ok) throw new Error(await errorMessage(res, 'Impossible de retirer cet appareil. Réessayez.'));
    await res.text();
}

/**
 * État du push sur CET appareil, sans rien demander : non pris en charge, refusé dans le navigateur,
 * indisponible (canal non configuré sur le serveur), activé (autorisé et abonné) ou désactivé.
 */
export async function currentPushState(): Promise<PushState> {
    if (!pushSupport()) return 'unsupported';
    if (Notification.permission === 'denied') return 'denied';
    let config: PushConfigResponse;
    try {
        config = await fetchPushConfig();
    } catch (err) {
        console.warn('[push] configuration illisible, notifications considérées indisponibles :', err instanceof Error ? err.message : String(err));
        return 'unavailable';
    }
    if (!config.enabled || !config.publicKey) return 'unavailable';
    const sub = await existingSubscription();
    return Notification.permission === 'granted' && sub ? 'enabled' : 'disabled';
}

/**
 * Active le push sur cet appareil. À appeler SEULEMENT depuis un gestionnaire de clic : la demande
 * d'autorisation est faite d'abord, dans le geste de l'utilisateur (exigence de Safari). Renvoie l'état
 * obtenu ; une erreur technique (abonnement ou enregistrement impossible) est levée avec un message
 * français à afficher.
 */
export async function enablePush(): Promise<PushState> {
    if (!pushSupport()) return 'unsupported';
    const permission = await Notification.requestPermission();
    if (permission === 'denied') return 'denied';
    if (permission !== 'granted') return 'disabled';
    const config = await fetchPushConfig();
    if (!config.enabled || !config.publicKey) return 'unavailable';
    const reg = await readyRegistration();
    let sub = await reg.pushManager.getSubscription();
    if (sub && !sameServerKey(sub, config.publicKey)) {
        await sub.unsubscribe();
        sub = null;
    }
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(config.publicKey) });
    await registerOnServer(sub);
    setDeviceTurnedOff(false); // design 1b (point 9) : activé à nouveau, réabonnement automatique permis
    return 'enabled';
}

/** Désactive le push sur cet appareil (retrait côté serveur, puis désabonnement du navigateur). Lève en cas d'échec. */
export async function disablePush(): Promise<void> {
    if (!pushSupport()) return;
    setDeviceTurnedOff(true); // design 1b (point 9) : désactivé par la personne, plus de réabonnement automatique
    const sub = await existingSubscription();
    if (!sub) return;
    await removeOnServer(sub.endpoint);
    await sub.unsubscribe();
}

/**
 * Détache l'appareil avant une déconnexion : retrait côté serveur puis désabonnement du navigateur.
 * Ne lève jamais : un échec est journalisé et la déconnexion continue (un abonnement resté côté serveur
 * est supprimé au premier envoi refusé par le service push, 404 ou 410).
 */
export async function detachPushSubscription(): Promise<void> {
    try {
        if (!pushSupport()) return;
        const sub = await existingSubscription();
        if (!sub) return;
        try {
            await removeOnServer(sub.endpoint);
        } catch (err) {
            console.warn('[push] retrait de l’appareil côté serveur impossible avant la déconnexion :', err instanceof Error ? err.message : String(err));
        }
        try {
            await sub.unsubscribe();
        } catch (err) {
            console.warn('[push] désabonnement du navigateur impossible :', err instanceof Error ? err.message : String(err));
        }
    } catch (err) {
        console.warn('[push] détachement de l’appareil impossible :', err instanceof Error ? err.message : String(err));
    }
}

export type PushSyncOutcome = 'registered' | 'resubscribed' | 'skipped';

/**
 * Resynchronisation à la connexion et à l'ouverture, SANS demande d'autorisation (appelée par AuthProvider quand un compte
 * actif est connecté). Permission non accordée, ou notifications désactivées sur cet appareil : rien. Abonnement présent :
 * enregistré pour le compte connecté (remplacé s'il a été créé avec une ancienne clé VAPID). Aucun abonnement (retiré à la
 * fin de la session précédente, « Déconnecter tous mes appareils ») : nouvel abonnement, sans fenêtre, enregistré pour le
 * compte connecté. `isCurrent` : faux si le compte a changé entre-temps (rien n'est enregistré, l'abonnement neuf est
 * retiré). Ne lève jamais.
 */
export async function syncPushSubscription(isCurrent: () => boolean = () => true): Promise<PushSyncOutcome> {
    try {
        if (!pushSupport() || Notification.permission !== 'granted' || deviceTurnedOff()) return 'skipped';
        const reg = await navigator.serviceWorker.getRegistration();
        let sub = reg ? await reg.pushManager.getSubscription() : null;
        const config = await fetchPushConfig();
        if (!config.enabled || !config.publicKey || !isCurrent()) return 'skipped';
        let fresh = false;
        if (sub && !sameServerKey(sub, config.publicKey)) {
            await sub.unsubscribe();
            sub = null;
        }
        if (!sub) {
            const registration = reg ?? await readyRegistration();
            sub = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(config.publicKey) });
            fresh = true;
        }
        if (!isCurrent()) {
            if (fresh) await sub.unsubscribe();
            return 'skipped';
        }
        try {
            await registerOnServer(sub);
        } catch (err) {
            if (fresh) await sub.unsubscribe().catch(() => false); // refusé (compte suspendu, canal fermé) : rien ne reste
            throw err;
        }
        return fresh ? 'resubscribed' : 'registered';
    } catch (err) {
        console.warn('[push] resynchronisation de l’appareil impossible :', err instanceof Error ? err.message : String(err));
        return 'skipped';
    }
}
