/*
 * Event Village — service worker.
 *
 * Lot 6 (contrat F5, décision 3 de l'utilisateur) : notifications push et ouverture de l'application au clic.
 * Lot 7 (tâche 7.1, contrat 5.3, D7, D26, D35, D36) : cache versionné limité à la page publique du billet hors
 * ligne (/billet/hors-ligne, statique, sans aucune donnée personnelle) et à ses ressources statiques. Renverse
 * la décision 4 du lot 6 (service worker sans cache), signalé au rapport.
 *
 *  - Liste blanche : par défaut, le service worker ne fait rien et le réseau répond. Première règle : /api/
 *    n'est jamais intercepté ni mis en cache. Requêtes non GET, d'une autre origine, RSC (en-tête RSC,
 *    Next-Router-Prefetch, paramètre _rsc) : rien. Les pages connectées ne sont jamais mises en cache.
 *  - Page hors ligne : cache d'abord (ignoreSearch : /billet/hors-ligne?id=…), revalidation en arrière-plan.
 *  - /_next/static/ et ressources publiques : cache d'abord, puis réseau ; une ressource /_next/static/ absente
 *    du cache et demandée par l'onglet de la page hors ligne y est ajoutée.
 *  - Navigation vers / ou /tickets : réseau (réponse préchargée si disponible) ; sur échec réseau seulement,
 *    redirection vers la page hors ligne.
 *  - Une seule fonction écrit dans le cache (cachePut) et revérifie chaque réponse. La pré-mise en cache
 *    (installation, message PREPARE_OFFLINE) télécharge la coquille sans cookie, découvre ses ressources,
 *    et ne remplace l'ensemble en cache qu'une fois tout téléchargé ; un échec est journalisé et n'empêche
 *    jamais l'installation (le push du lot 6 en dépend).
 *  - Activation : suppression des caches event-village-* (anciennes versions) et ev-hors-ligne-* autres que le
 *    cache courant ; navigationPreload activé si disponible.
 *  - Push : inchangé depuis le lot 6. Un clic n'ouvre qu'un chemin INTERNE de l'application ; tout autre lien
 *    mène à /notifications ; un renouvellement d'abonnement décidé par le navigateur est réenregistré.
 */
const SW_VERSION = 'lot7-1';
const LEGACY_CACHES = ['event-village-v1'];
const LEGACY_CACHE_PREFIX = 'event-village-';
const CACHE_PREFIX = 'ev-hors-ligne-';
const CACHE_NAME = CACHE_PREFIX + SW_VERSION;
const OFFLINE_PATH = '/billet/hors-ligne';
const API_PREFIX = '/api/';
const STATIC_PREFIX = '/_next/static/';
const PUBLIC_ASSETS = ['/manifest.json', '/favicon.ico', '/branding/event-village-mark.svg', '/icon-192x192.png', '/icon-512x512.png', '/icons/icon-maskable-512.png', '/icons/apple-touch-icon.png'];
const FALLBACK_NAV = new Set(['/', '/tickets']);
/** Ressources de Next citées par la coquille (balises, charge RSC échappée) ou par ses CSS (url()). */
const ASSET_RE = /(?:\/_next\/)?static\/(?:chunks|css|media)\/[^"'\s)\\]+/g;
const FALLBACK = { title: 'Event Village', body: 'Nouvelle notification Event Village', url: '/notifications', tag: 'event-village' };
const ICON = '/icon-192x192.png';

function warn(message, err) {
  console.warn('[sw ' + SW_VERSION + '] ' + message, err instanceof Error ? err.message : (err === undefined ? '' : String(err)));
}

/** Chemin que le cache peut contenir (liste blanche du contrat 5.3). */
function cacheablePath(pathname) {
  if (pathname.startsWith(API_PREFIX)) return false;
  return pathname === OFFLINE_PATH || pathname.startsWith(STATIC_PREFIX) || PUBLIC_ASSETS.includes(pathname);
}

/**
 * Seule écriture dans le cache. Revérifie le chemin (jamais /api/), la réponse (ok, même origine, non
 * redirigée, sans no-store) et, pour la coquille, son adresse finale et son type HTML. Avec `commit` faux,
 * vérifie seulement : la pré-mise en cache contrôle tout l'ensemble avant d'écrire quoi que ce soit.
 */
async function cachePut(cache, path, response, commit = true) {
  const url = new URL(path, self.location.origin);
  if (url.origin !== self.location.origin || url.pathname.startsWith(API_PREFIX) || !cacheablePath(url.pathname)) return false;
  if (!response || !response.ok || response.type !== 'basic' || response.redirected) return false;
  if (/no-store/i.test(response.headers.get('cache-control') || '')) return false;
  if (url.pathname === OFFLINE_PATH) {
    let finalPath = '';
    try {
      finalPath = new URL(response.url).pathname;
    } catch (err) {
      warn('coquille refusée (adresse illisible)', err);
      return false;
    }
    if (finalPath !== OFFLINE_PATH || !/text\/html/i.test(response.headers.get('content-type') || '')) return false;
  }
  if (!commit) return true;
  await cache.put(url.origin + url.pathname, response);
  return true;
}

function discover(text) {
  const found = new Set();
  for (const m of text.match(ASSET_RE) || []) found.add(m.startsWith('/_next/') ? m : '/_next/' + m);
  return found;
}

async function fetchAsset(path) {
  const res = await fetch(path, { credentials: 'omit' });
  if (!(await cachePut(null, path, res, false))) throw new Error('ressource ' + path + ' refusée (HTTP ' + res.status + ')');
  return res;
}

/** Télécharge la coquille et toutes ses ressources, puis remplace l'ensemble en cache (tout ou rien). */
async function precache() {
  const shell = await fetch(OFFLINE_PATH, { credentials: 'omit', cache: 'no-cache', redirect: 'manual' });
  if (!(await cachePut(null, OFFLINE_PATH, shell, false))) {
    throw new Error('coquille refusée (HTTP ' + shell.status + ', type ' + shell.type + ')');
  }
  const assets = discover(await shell.clone().text());
  const fetched = new Map();
  const pending = Array.from(assets);
  while (pending.length > 0) {
    const path = pending.shift();
    if (fetched.has(path)) continue;
    const res = await fetchAsset(path);
    fetched.set(path, res);
    if (path.endsWith('.css')) {
      for (const inner of discover(await res.clone().text())) {
        if (!fetched.has(inner) && !pending.includes(inner)) pending.push(inner);
      }
    }
  }
  for (const path of PUBLIC_ASSETS) {
    if (!fetched.has(path)) fetched.set(path, await fetchAsset(path));
  }
  const cache = await caches.open(CACHE_NAME);
  const keep = new Set([OFFLINE_PATH, ...fetched.keys()].map((p) => new URL(p, self.location.origin).href));
  if (!(await cachePut(cache, OFFLINE_PATH, shell))) throw new Error('coquille refusée à l\'écriture');
  for (const [path, res] of fetched) {
    if (!(await cachePut(cache, path, res))) throw new Error('ressource ' + path + ' refusée à l\'écriture');
  }
  for (const req of await cache.keys()) {
    if (!keep.has(req.url)) await cache.delete(req);
  }
}

let preparing = null;

/** Pré-mise en cache qui ne rejette jamais (échec journalisé) ; les onglets sont prévenus du succès. */
function prepareOffline(reason) {
  if (preparing) return preparing;
  preparing = precache()
    .then(async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windows) {
        if (client && typeof client.postMessage === 'function') client.postMessage({ type: 'OFFLINE_READY', version: SW_VERSION });
      }
    })
    .catch((err) => warn('page hors ligne non mise en cache (' + reason + ')', err))
    .finally(() => { preparing = null; });
  return preparing;
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(prepareOffline('installation'));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => LEGACY_CACHES.includes(key) || key.startsWith(LEGACY_CACHE_PREFIX) || (key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME))
        .map((key) => caches.delete(key)),
    );
    if (self.registration.navigationPreload) {
      try {
        await self.registration.navigationPreload.enable();
      } catch (err) {
        warn('préchargement des navigations indisponible', err);
      }
    }
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  const data = event.data;
  if (data === 'PREPARE_OFFLINE' || (data && data.type === 'PREPARE_OFFLINE')) {
    event.waitUntil(prepareOffline('demande d\'un onglet'));
  }
});

/** Ressource statique : cache d'abord ; absente, réseau, et ajout au cache si l'onglet est la page hors ligne. */
async function staticFirst(event, url) {
  const hit = await caches.match(url.origin + url.pathname, { cacheName: CACHE_NAME });
  if (hit) return hit;
  const res = await fetch(event.request);
  if (url.pathname.startsWith(STATIC_PREFIX) && event.clientId) {
    try {
      const client = await self.clients.get(event.clientId);
      if (client && new URL(client.url).pathname === OFFLINE_PATH) {
        await cachePut(await caches.open(CACHE_NAME), url.pathname, res.clone());
      }
    } catch (err) {
      warn('ressource de la page hors ligne non ajoutée au cache : ' + url.pathname, err);
    }
  }
  return res;
}

/** Page hors ligne : cache d'abord, puis revalidation de l'ensemble en arrière-plan. */
async function offlineShell(event) {
  const hit = await caches.match(OFFLINE_PATH, { ignoreSearch: true, cacheName: CACHE_NAME });
  if (hit) {
    event.waitUntil(prepareOffline('revalidation'));
    return hit;
  }
  event.waitUntil(prepareOffline('première visite'));
  return fetch(event.request);
}

/** / et /tickets : réseau ; sur échec réseau seulement, redirection vers la page hors ligne. */
async function networkOrOffline(event) {
  try {
    const preloaded = await event.preloadResponse;
    if (preloaded) return preloaded;
    return await fetch(event.request);
  } catch (err) {
    warn('navigation sans réseau, redirection vers la page hors ligne', err);
    return Response.redirect(new URL(OFFLINE_PATH, self.location.origin).href, 302);
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (url.pathname.startsWith(API_PREFIX)) return;
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  const headers = request.headers;
  if ((headers && (headers.get('RSC') || headers.get('Next-Router-Prefetch'))) || url.searchParams.has('_rsc')) return;
  if (request.mode === 'navigate' && url.pathname === OFFLINE_PATH) {
    event.respondWith(offlineShell(event));
    return;
  }
  if (url.pathname.startsWith(STATIC_PREFIX) || PUBLIC_ASSETS.includes(url.pathname)) {
    event.respondWith(staticFirst(event, url));
    return;
  }
  if (request.mode === 'navigate' && FALLBACK_NAV.has(url.pathname)) {
    event.respondWith(networkOrOffline(event));
  }
});

// ── Push (lot 6, inchangé) ─────────────────────────────────────────────────

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
