/**
 * Lot 6 (contrat P1, tâche 6.12) — notifications push simulées pour les captures de la page
 * « Préférences de notification » (gabarit de fake-camera.ts : script d'initialisation exécuté dans la
 * page avant tout script de l'application).
 *
 * Pourquoi une simulation : Playwright bloque les service workers (`serviceWorkers: 'block'`,
 * playwright.config.ts, verrou réseau) et le Chromium de la CI ne joint aucun service push réel. Ce qui
 * est simulé, et seulement cela :
 *  - `granted` (état « activé ») : la permission du navigateur (« default » au chargement, « granted »
 *    après le clic, sans fenêtre) et l'abonnement auprès du service push du navigateur
 *    (`pushManager.subscribe`), remplacé par un abonnement dont le point d'arrivée vise le FAUX service
 *    push local (`http://127.0.0.1:4010/push/<id>`, clés P-256 réelles générées par
 *    `POST /__test/push/subscribers`, scripts/e2e/fake-services.mjs). L'enregistrement du service worker
 *    est remplacé par une inscription factice (bloquée par Playwright sinon). Tout le reste est réel :
 *    configuration VAPID lue sur le serveur (GET /api/push/config), inscription de l'appareil par la vraie
 *    route (POST /api/push/subscriptions, liste blanche des services push, base) ;
 *  - `denied` (état « refusé ») : permission refusée ; chaque appel à `requestPermission` est compté
 *    (zéro attendu au chargement : l'autorisation n'est jamais demandée sans geste de l'utilisateur) ;
 *  - `unsupported` (état « non pris en charge ») : `window.PushManager` et `window.Notification`
 *    supprimés, comme dans un navigateur sans Push API.
 * Compteurs lus par les captures : `window.__evFakePush` (`requestPermissionCalls`, `subscribeCalls`).
 */
export type FakePushMode = 'granted' | 'denied' | 'unsupported';

export interface FakePushSubscriptionJson {
    endpoint: string;
    keys: { p256dh: string; auth: string };
}

export interface FakePushArg {
    mode: FakePushMode;
    /** Abonnement du faux service push (mode `granted` seulement). */
    subscription: FakePushSubscriptionJson | null;
}

export interface FakePushCounters {
    mode: FakePushMode;
    requestPermissionCalls: number;
    subscribeCalls: number;
}

/** Fonction sérialisée par Playwright (addInitScript) : aucune référence extérieure. */
export function installFakePush(arg: FakePushArg): void {
    const w = window as unknown as Record<string, unknown> & { __evFakePush?: FakePushCounters };
    const counters: FakePushCounters = { mode: arg.mode, requestPermissionCalls: 0, subscribeCalls: 0 };
    w.__evFakePush = counters;

    if (arg.mode === 'unsupported') {
        delete w.PushManager;
        delete w.Notification;
        if ('PushManager' in window || 'Notification' in window) {
            console.warn('[e2e][push simulé] PushManager ou Notification n’a pas pu être retiré de window');
        }
        return;
    }

    const NotificationCtor = w.Notification as (Record<string, unknown> & object) | undefined;
    if (!NotificationCtor) {
        console.warn('[e2e][push simulé] Notification absent de ce navigateur : simulation impossible');
        return;
    }
    let permission: 'default' | 'granted' | 'denied' = arg.mode === 'denied' ? 'denied' : 'default';
    Object.defineProperty(NotificationCtor, 'permission', { configurable: true, get: () => permission });
    Object.defineProperty(NotificationCtor, 'requestPermission', {
        configurable: true,
        writable: true,
        value: async () => {
            counters.requestPermissionCalls += 1;
            if (arg.mode === 'granted') permission = 'granted';
            return permission;
        },
    });
    if (arg.mode !== 'granted') return;

    const sub = arg.subscription;
    const container = navigator.serviceWorker as unknown as object | undefined;
    if (!sub || !container) {
        console.warn('[e2e][push simulé] abonnement du faux service ou navigator.serviceWorker absent : état « activé » impossible');
        return;
    }
    const bytes = (b64url: string): Uint8Array => {
        const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
        const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
        const out = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
        return out;
    };
    const toBuffer = (key: unknown): ArrayBuffer | null => {
        if (!key) return null;
        if (typeof key === 'string') return bytes(key).slice().buffer;
        if (key instanceof ArrayBuffer) return key.slice(0);
        if (ArrayBuffer.isView(key)) return new Uint8Array(key.buffer, key.byteOffset, key.byteLength).slice().buffer;
        return null;
    };
    let current: Record<string, unknown> | null = null;
    const subscription: Record<string, unknown> = {
        endpoint: sub.endpoint,
        expirationTime: null,
        options: { userVisibleOnly: true, applicationServerKey: null },
        getKey: (name: string) => (name === 'p256dh' ? bytes(sub.keys.p256dh).slice().buffer : name === 'auth' ? bytes(sub.keys.auth).slice().buffer : null),
        toJSON: () => ({ endpoint: sub.endpoint, expirationTime: null, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } }),
        unsubscribe: async () => {
            current = null;
            return true;
        },
    };
    const pushManager = {
        getSubscription: async () => current,
        subscribe: async (opts?: { userVisibleOnly?: boolean; applicationServerKey?: unknown }) => {
            counters.subscribeCalls += 1;
            subscription.options = { userVisibleOnly: opts?.userVisibleOnly === true, applicationServerKey: toBuffer(opts?.applicationServerKey) };
            current = subscription;
            return subscription;
        },
        permissionState: async () => (permission === 'granted' ? 'granted' : permission === 'denied' ? 'denied' : 'prompt'),
    };
    // Méthodes du prototype remplacées aussi (contrat P1), au cas où une inscription réelle existerait.
    const PushManagerCtor = w.PushManager as { prototype?: Record<string, unknown> } | undefined;
    if (PushManagerCtor?.prototype) {
        Object.defineProperty(PushManagerCtor.prototype, 'getSubscription', { configurable: true, writable: true, value: pushManager.getSubscription });
        Object.defineProperty(PushManagerCtor.prototype, 'subscribe', { configurable: true, writable: true, value: pushManager.subscribe });
    }
    let registered = false;
    const registration = {
        scope: `${window.location.origin}/`,
        active: { state: 'activated', scriptURL: `${window.location.origin}/sw.js` },
        installing: null,
        waiting: null,
        pushManager,
        update: async () => undefined,
        unregister: async () => {
            registered = false;
            return true;
        },
        showNotification: async () => undefined,
        getNotifications: async () => [],
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
    };
    Object.defineProperty(container, 'register', {
        configurable: true,
        writable: true,
        value: async () => {
            registered = true;
            return registration;
        },
    });
    Object.defineProperty(container, 'getRegistration', { configurable: true, writable: true, value: async () => (registered ? registration : undefined) });
    Object.defineProperty(container, 'getRegistrations', { configurable: true, writable: true, value: async () => (registered ? [registration] : []) });
    Object.defineProperty(container, 'ready', { configurable: true, get: () => Promise.resolve(registration) });
}
