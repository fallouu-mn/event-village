'use client';

/**
 * Lot 7, tâche 7.1 (contrat 5.2, D29 à D31, D35, D37) — synchronisation des billets hors ligne (rendu nul).
 *
 * Lot 7, tâche 7.5 : ce module n'est plus importé par app/layout.tsx. Le composant OfflineTicketsSync est
 * monté une fois par components/providers/AuthProvider.tsx, qui le charge à la demande (import()) pour un
 * compte client seulement. Les autres exports (ensureOfflineLot, reconcileWithServerTickets, événement
 * OFFLINE_LOTS_CHANGED) restent importés directement par Mes billets et la carte billet.
 *
 *  - Une fois par onglet à l'ouverture, puis à chaque retour du réseau (`online`), pour un compte client :
 *    lecture de /api/tickets (le champ `offline` du serveur décide de la fenêtre, le navigateur ne calcule
 *    rien), purge des lots expirés, réconciliation (billet disparu de la liste, transféré, composté ou
 *    d'une autre version du secret : lot supprimé), puis téléchargement des billets `offline.available`
 *    dont le lot manque ou doit être renouvelé (needsDownload : le quota du serveur n'est pas gaspillé).
 *  - Les téléchargements sont dédoublonnés par billet (la carte billet télécharge aussi à l'affichage).
 *  - Après un lot enregistré, le service worker est invité à préparer la page hors ligne (PREPARE_OFFLINE) ;
 *    il répond OFFLINE_READY quand la coquille est en cache, et les cartes relisent leur état (D35).
 *  - Aucune donnée du lot n'est écrite ailleurs qu'en IndexedDB (lib/tickets/offline-store.ts).
 */
import { useEffect, useRef } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import {
  getOfflineLot,
  hasCachedOfflineShell,
  purgeExpiredLots,
  reconcileOfflineLots,
  saveOfflineLot,
  setCurrentOfflineUser,
} from '@/lib/tickets/offline-store';
import {
  needsDownload,
  offsetFromFetch,
  type OfflineAvailability,
  type OfflineLot,
  type OfflineLotResponse,
} from '@/lib/tickets/offline-clock';

/** Événement de fenêtre : un lot a changé (enregistré, supprimé) ou la coquille est en cache. */
export const OFFLINE_LOTS_CHANGED = 'ev:offline-lots-changed';

/** Billet tel que GET /api/tickets le rend (champs utiles à la synchronisation). */
export interface ServerTicketForOffline {
  id: string;
  status?: string;
  offline?: OfflineAvailability | null;
}

export type OfflineDownloadOutcome =
  | { kind: 'saved' }
  | { kind: 'fresh' }
  | { kind: 'not_yet'; availableFrom: string | null }
  | { kind: 'refused'; code: string }
  | { kind: 'rate_limited'; retryAfterSeconds: number }
  | { kind: 'network' }
  | { kind: 'storage' }
  | { kind: 'server' };

export function notifyOfflineChange(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(OFFLINE_LOTS_CHANGED));
}

/**
 * Demande au service worker de (re)préparer la page hors ligne si sa coquille n'est pas encore en cache.
 * Sans service worker actif (développement, navigateur sans support), rien n'est possible : journalisé.
 */
export async function requestOfflineShell(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    console.warn('[hors-ligne] service worker non pris en charge : la page hors ligne ne peut pas être préparée');
    return;
  }
  if (await hasCachedOfflineShell()) return;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const worker = registration?.active ?? registration?.waiting ?? registration?.installing ?? null;
    if (!worker) {
      console.warn('[hors-ligne] aucun service worker enregistré : la page hors ligne sera préparée à son installation');
      return;
    }
    worker.postMessage({ type: 'PREPARE_OFFLINE' });
  } catch (err) {
    console.warn('[hors-ligne] préparation de la page hors ligne impossible :', err instanceof Error ? err.message : String(err));
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Contrôle la forme de la réponse 200 (contrat 3.1) : un lot inattendu n'est jamais enregistré. */
function lotResponseOf(data: unknown, ticketId: string): OfflineLotResponse | null {
  const r = (data ?? {}) as Record<string, unknown>;
  const count = Number(r.count);
  const digits = Number(r.digits);
  const t = r.ticket as Record<string, unknown> | undefined;
  const dates = ['first_step_at', 'last_step_at', 'valid_until', 'expires_at', 'scan_opens_at', 'scan_closes_at', 'server_time'];
  const ok = r.ticket_id === ticketId
    && Number.isSafeInteger(Number(r.secret_version)) && Number(r.secret_version) >= 1
    && typeof r.prefix === 'string' && r.prefix !== ''
    && Number(r.step_seconds) > 0 && Number.isSafeInteger(digits) && digits > 0
    && Number.isSafeInteger(Number(r.first_counter)) && Number.isSafeInteger(count) && count >= 1
    && typeof r.codes === 'string' && r.codes.length === digits * count && /^\d+$/.test(r.codes)
    && typeof r.complete === 'boolean'
    && dates.every((k) => typeof r[k] === 'string' && Number.isFinite(Date.parse(r[k] as string)))
    && !!t && typeof t.ticket_number === 'string' && typeof t.event_title === 'string' && Number.isFinite(Date.parse(String(t.event_start_at)));
  return ok ? (data as OfflineLotResponse) : null;
}

const inFlight = new Map<string, Promise<OfflineDownloadOutcome>>();

async function downloadIfNeeded(userId: string, ticketId: string, offline: OfflineAvailability): Promise<OfflineDownloadOutcome> {
  let current: OfflineLot | null;
  try {
    current = await getOfflineLot(userId, ticketId);
  } catch (err) {
    console.warn(`[hors-ligne] billet ${ticketId} : stockage illisible, aucun téléchargement`, err instanceof Error ? err.message : String(err));
    return { kind: 'storage' };
  }
  if (!needsDownload(current, offline)) return { kind: 'fresh' };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { kind: 'network' };

  const t0 = Date.now();
  let res: Response;
  try {
    res = await fetch(`/api/tickets/${encodeURIComponent(ticketId)}/offline-codes`, { cache: 'no-store', credentials: 'same-origin' });
  } catch (err) {
    console.warn(`[hors-ligne] billet ${ticketId} : téléchargement des codes impossible (réseau)`, err instanceof Error ? err.message : String(err));
    return { kind: 'network' };
  }
  const t1 = Date.now();
  let body: unknown;
  try {
    body = await res.json();
  } catch (err) {
    console.warn(`[hors-ligne] billet ${ticketId} : réponse illisible (HTTP ${res.status})`, err instanceof Error ? err.message : String(err));
    return { kind: 'server' };
  }
  const payload = (body ?? {}) as { code?: unknown; available_from?: unknown };

  if (res.ok) {
    const lot = lotResponseOf(body, ticketId);
    if (!lot) {
      console.warn(`[hors-ligne] billet ${ticketId} : lot reçu de forme inattendue, ignoré`);
      return { kind: 'server' };
    }
    let offsetMs: number;
    try {
      offsetMs = offsetFromFetch(lot.server_time, t0, t1);
    } catch (err) {
      console.warn(`[hors-ligne] billet ${ticketId} : écart d'horloge non mesurable`, err instanceof Error ? err.message : String(err));
      return { kind: 'server' };
    }
    const stored: OfflineLot = { ...lot, offsetMs, downloadedAtDevice: t1, downloadedAtServer: Date.parse(lot.server_time) };
    try {
      // Le compte de la session devient le compte affiché par la page hors ligne (lots d'un autre compte purgés).
      await setCurrentOfflineUser(userId);
      await saveOfflineLot(userId, stored);
    } catch (err) {
      console.warn(`[hors-ligne] billet ${ticketId} : lot non enregistré`, err instanceof Error ? err.message : String(err));
      return { kind: 'storage' };
    }
    notifyOfflineChange();
    void requestOfflineShell();
    return { kind: 'saved' };
  }

  const code = typeof payload.code === 'string' ? payload.code : `HTTP_${res.status}`;
  if (res.status === 409 && code === 'OFFLINE_WINDOW_CLOSED') {
    console.warn(`[hors-ligne] billet ${ticketId} : fenêtre de téléchargement fermée`);
    return { kind: 'not_yet', availableFrom: typeof payload.available_from === 'string' ? payload.available_from : null };
  }
  if (res.status === 429) {
    const retry = Number(res.headers.get('Retry-After')) || 60;
    console.warn(`[hors-ligne] billet ${ticketId} : trop de téléchargements, nouvel essai possible dans ${retry} s`);
    return { kind: 'rate_limited', retryAfterSeconds: retry };
  }
  if (res.status >= 500) {
    console.warn(`[hors-ligne] billet ${ticketId} : erreur du serveur (HTTP ${res.status}, ${code})`);
    return { kind: 'server' };
  }
  console.warn(`[hors-ligne] billet ${ticketId} : téléchargement refusé (HTTP ${res.status}, ${code})`);
  return { kind: 'refused', code };
}

/**
 * Télécharge le lot du billet s'il manque ou doit être renouvelé (un seul téléchargement à la fois par
 * billet, même appelé par la synchronisation et par la carte).
 */
export function ensureOfflineLot(userId: string, ticketId: string, offline: OfflineAvailability | null | undefined): Promise<OfflineDownloadOutcome> {
  if (!offline || offline.available !== true || !UUID.test(ticketId)) return Promise.resolve({ kind: 'fresh' });
  const key = `${userId}:${ticketId}`;
  const running = inFlight.get(key);
  if (running) return running;
  const p = downloadIfNeeded(userId, ticketId, offline).finally(() => inFlight.delete(key));
  inFlight.set(key, p);
  return p;
}

/** Un lot reste utile tant que le billet est présenté, valide et sans transfert en attente. */
function keptVersion(t: ServerTicketForOffline): number | null | undefined {
  if (t.status !== undefined && t.status !== 'VALIDE') return undefined;
  const o = t.offline;
  if (!o) return null; // disponibilité inconnue (billet ajouté entre deux lectures) : le lot existant est gardé
  if (o.reason === 'TICKET_NOT_VALID' || o.reason === 'TRANSFER_PENDING') return undefined;
  return Number(o.secret_version);
}

/**
 * Réconciliation après chaque chargement réussi de /api/tickets : supprime les lots des billets disparus,
 * non valables, en transfert ou d'une autre version. Rend false si le stockage est indisponible (journalisé).
 */
export async function reconcileWithServerTickets(userId: string, tickets: ServerTicketForOffline[]): Promise<boolean> {
  const keep = new Map<string, number | null>();
  for (const t of tickets) {
    const v = keptVersion(t);
    if (v !== undefined) keep.set(t.id, v);
  }
  try {
    await setCurrentOfflineUser(userId);
    const removed = await reconcileOfflineLots(userId, keep);
    if (removed > 0) notifyOfflineChange();
    return true;
  } catch (err) {
    console.warn('[hors-ligne] réconciliation des billets enregistrés impossible :', err instanceof Error ? err.message : String(err));
    return false;
  }
}

/** Synchronisation complète : purge, lecture de /api/tickets, réconciliation, téléchargements nécessaires. */
export async function syncOfflineTickets(userId: string, why: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  try {
    await setCurrentOfflineUser(userId);
    if ((await purgeExpiredLots()) > 0) notifyOfflineChange();
  } catch (err) {
    console.warn(`[hors-ligne] synchronisation (${why}) : stockage indisponible`, err instanceof Error ? err.message : String(err));
    return;
  }
  let res: Response;
  try {
    res = await fetch('/api/tickets', { cache: 'no-store', credentials: 'same-origin' });
  } catch (err) {
    console.warn(`[hors-ligne] synchronisation (${why}) : liste des billets injoignable`, err instanceof Error ? err.message : String(err));
    return;
  }
  if (!res.ok) {
    console.warn(`[hors-ligne] synchronisation (${why}) : liste des billets refusée (HTTP ${res.status})`);
    return;
  }
  let tickets: ServerTicketForOffline[];
  try {
    const body = (await res.json()) as { tickets?: unknown };
    if (!Array.isArray(body.tickets)) throw new Error('réponse sans liste de billets');
    tickets = body.tickets as ServerTicketForOffline[];
  } catch (err) {
    console.warn(`[hors-ligne] synchronisation (${why}) : réponse illisible`, err instanceof Error ? err.message : String(err));
    return;
  }
  if (!(await reconcileWithServerTickets(userId, tickets))) return;
  for (const t of tickets) {
    if (t.offline?.available) await ensureOfflineLot(userId, t.id, t.offline);
  }
}

export function OfflineTicketsSync() {
  const { user, isLoading, hasRole } = useAuth();
  const userId = user?.id ?? null;
  const isClient = hasRole('CLIENT');
  const openedFor = useRef<string | null>(null);

  // Réponse du service worker : coquille en cache, les cartes relisent leur état.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: unknown } | null;
      if (data && data.type === 'OFFLINE_READY') notifyOfflineChange();
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    if (isLoading || !userId || !isClient) return;
    if (openedFor.current !== userId) {
      openedFor.current = userId;
      void syncOfflineTickets(userId, 'ouverture');
    }
    const onOnline = () => { void syncOfflineTickets(userId, 'retour du réseau'); };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [isLoading, userId, isClient]);

  return null;
}
