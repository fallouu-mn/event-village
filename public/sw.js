/*
 * Event Village — service worker (lot 6, contrat F5, décision 3 de l'utilisateur).
 *
 * Rôle unique : afficher les notifications push et ouvrir l'application au clic.
 *  - aucun cache, aucune interception des requêtes : le réseau n'est jamais servi par ce fichier
 *    (le mode hors ligne du billet est étudié au lot 7) ;
 *  - à l'activation, les caches laissés par l'ancienne version (event-village-v1 et toute clé
 *    « event-village-* ») sont supprimés ;
 *  - un clic n'ouvre qu'un chemin INTERNE de l'application ; tout autre lien mène à /notifications ;
 *  - un renouvellement d'abonnement décidé par le navigateur est réenregistré sur le serveur.
 */
const SW_VERSION = 'lot6-1';
const LEGACY_CACHES = ['event-village-v1'];
const LEGACY_CACHE_PREFIX = 'event-village-';
const FALLBACK = { title: 'Event Village', body: 'Nouvelle notification Event Village', url: '/notifications', tag: 'event-village' };
const ICON = '/icon-192x192.png';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => LEGACY_CACHES.includes(key) || key.startsWith(LEGACY_CACHE_PREFIX))
        .map((key) => caches.delete(key)),
    );
    await self.clients.claim();
  })());
});

function text(value, fallback) {
  return typeof value === 'string' && value.trim() !== '' ? value : fallback;
}

/** Charge du push : JSON { title, body, url, tag } ; illisible ou absente → notification générique. */
function readPayload(event) {
  if (!event.data) return FALLBACK;
  let data;
  try {
    data = event.data.json();
  } catch (err) {
    console.warn('[sw ' + SW_VERSION + '] charge push illisible, notification générique affichée', err);
    return FALLBACK;
  }
  if (!data || typeof data !== 'object' || typeof data.title !== 'string' || data.title.trim() === '') return FALLBACK;
  return {
    title: data.title,
    body: text(data.body, FALLBACK.body),
    url: text(data.url, FALLBACK.url),
    tag: text(data.tag, FALLBACK.tag),
  };
}

self.addEventListener('push', (event) => {
  const p = readPayload(event);
  event.waitUntil(self.registration.showNotification(p.title, {
    body: p.body,
    tag: p.tag,
    data: { url: p.url },
    icon: ICON,
    badge: ICON,
  }));
});

/** Chemin interne de l'application, sinon /notifications (lien externe, //hôte, javascript:, mailto:…). */
function internalTarget(raw) {
  if (typeof raw !== 'string' || !raw.startsWith('/') || raw.startsWith('//') || raw.indexOf('\\') !== -1) return FALLBACK.url;
  try {
    const url = new URL(raw, self.location.origin);
    if (url.origin !== self.location.origin) return FALLBACK.url;
    return url.pathname + url.search + url.hash;
  } catch (err) {
    console.warn('[sw ' + SW_VERSION + '] lien de notification illisible', err);
    return FALLBACK.url;
  }
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = internalTarget(event.notification.data && event.notification.data.url);
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      let sameOrigin = false;
      try {
        sameOrigin = new URL(client.url).origin === self.location.origin;
      } catch (err) {
        console.warn('[sw ' + SW_VERSION + '] onglet ignoré (adresse illisible)', err);
      }
      if (!sameOrigin) continue;
      try {
        await client.focus();
        if (typeof client.navigate === 'function') {
          await client.navigate(target);
          return;
        }
      } catch (err) {
        console.warn('[sw ' + SW_VERSION + '] onglet existant non dirigé, ouverture d\'une nouvelle fenêtre', err);
      }
      break;
    }
    await self.clients.openWindow(target);
  })());
});

function keyBytes(base64url) {
  const b64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil((async () => {
    try {
      let subscription = event.newSubscription || null;
      if (!subscription) {
        const res = await fetch('/api/push/config', { credentials: 'same-origin', cache: 'no-store' });
        if (!res.ok) throw new Error('configuration indisponible (HTTP ' + res.status + ')');
        const config = await res.json();
        if (!config || config.enabled !== true || typeof config.publicKey !== 'string') {
          console.warn('[sw ' + SW_VERSION + '] notifications push indisponibles : abonnement non renouvelé');
          return;
        }
        subscription = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(config.publicKey) });
      }
      const json = subscription.toJSON();
      const posted = await fetch('/api/push/subscriptions', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
      if (!posted.ok) throw new Error('enregistrement refusé (HTTP ' + posted.status + ')');
    } catch (err) {
      console.error('[sw ' + SW_VERSION + '] renouvellement de l\'abonnement push impossible', err);
    }
  })());
});
