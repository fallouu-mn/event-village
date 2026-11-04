/**
 * Lot 7, tâche 7.1 (contrat 5.2, D34, D35) — stockage local des lots de codes hors ligne (IndexedDB écrit à
 * la main, aucune dépendance).
 *
 * Base `event-village-offline` version 1 :
 *  - magasin `lots`, clé `"<userId>:<ticketId>:<secretVersion>"`, index `ticketId` et `expiresAt` (heure du
 *    serveur, ms) ; une seule version par billet : enregistrer une version supprime les autres ;
 *  - magasin `meta`, enregistrement `currentUserId` : la page hors ligne n'affiche que les lots de ce compte.
 *
 * Purge : à la déconnexion et à la connexion d'un autre compte (AuthProvider, clearOfflineStore), au
 * transfert (TransferModal, deleteOfflineLots), quand un billet disparaît de la liste ou change de version
 * (reconcileOfflineLots), et à l'expiration (purgeExpiredLots).
 *
 * Toute erreur IndexedDB est journalisée (`console.warn('[hors-ligne] …')`) puis remonte sous la forme d'une
 * OfflineStoreError : l'écran affiche « Stockage hors ligne indisponible sur ce téléphone ». Seule
 * clearOfflineStore ne lève pas (elle précède la déconnexion, qui doit avoir lieu) : elle rend false.
 */
import type { OfflineLot } from './offline-clock';

const DB_NAME = 'event-village-offline';
const DB_VERSION = 1;
const LOTS = 'lots';
const META = 'meta';
const CURRENT_USER_KEY = 'currentUserId';
/** Chemin de la coquille mise en cache par public/sw.js (D35). */
export const OFFLINE_SHELL_PATH = '/billet/hors-ligne';

export const OFFLINE_STORE_UNAVAILABLE = 'Stockage hors ligne indisponible sur ce téléphone.';

export class OfflineStoreError extends Error {
    constructor(message: string, readonly cause?: unknown) {
        super(message);
        this.name = 'OfflineStoreError';
    }
}

interface LotRecord {
    key: string;
    userId: string;
    ticketId: string;
    secretVersion: number;
    /** Fin d'utilité du lot, heure du serveur (ms). */
    expiresAt: number;
    lot: OfflineLot;
}

interface MetaRecord {
    key: string;
    value: string;
}

function describe(err: unknown): string {
    if (err instanceof Error) return `${err.name} : ${err.message}`;
    if (err && typeof err === 'object' && 'name' in err) return String((err as { name: unknown }).name);
    return String(err);
}

function fail(what: string, err: unknown): OfflineStoreError {
    console.warn(`[hors-ligne] ${what} : ${describe(err)}`);
    return new OfflineStoreError(`${what} : ${describe(err)}`, err);
}

export function lotKey(userId: string, ticketId: string, secretVersion: number): string {
    return `${userId}:${ticketId}:${secretVersion}`;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
    if (dbPromise) return dbPromise;
    const opening = new Promise<IDBDatabase>((resolve, reject) => {
        if (typeof indexedDB === 'undefined') {
            reject(new Error('IndexedDB absent de ce navigateur'));
            return;
        }
        let request: IDBOpenDBRequest;
        try {
            request = indexedDB.open('event-village-offline', 1);
        } catch (err) {
            reject(err);
            return;
        }
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(LOTS)) {
                const lots = db.createObjectStore('lots', { keyPath: 'key' });
                lots.createIndex('ticketId', 'ticketId', { unique: false });
                lots.createIndex('expiresAt', 'expiresAt', { unique: false });
            }
            if (!db.objectStoreNames.contains(META)) db.createObjectStore('meta', { keyPath: 'key' });
        };
        request.onsuccess = () => {
            const db = request.result;
            // Une autre version ouverte ailleurs (mise à jour de l'application) : on ferme, la prochaine lecture rouvre.
            db.onversionchange = () => {
                db.close();
                dbPromise = null;
            };
            resolve(db);
        };
        request.onerror = () => reject(request.error ?? new Error('ouverture refusée'));
        request.onblocked = () => reject(new Error('ouverture bloquée par un autre onglet'));
    });
    dbPromise = opening.catch((err: unknown) => {
        dbPromise = null;
        throw fail(`ouverture de ${DB_NAME} v${DB_VERSION} impossible`, err);
    });
    return dbPromise;
}

/** Transaction sur les magasins donnés ; résout quand elle est validée, rejette (journalisé) sinon. */
async function withTx<T>(stores: string[], mode: IDBTransactionMode, what: string, body: (tx: IDBTransaction) => T | Promise<T>): Promise<T> {
    const db = await openDb();
    return new Promise<T>((resolve, reject) => {
        let tx: IDBTransaction;
        try {
            tx = db.transaction(stores, mode);
        } catch (err) {
            reject(fail(what, err));
            return;
        }
        let result: T;
        let bodyFailed = false;
        tx.oncomplete = () => resolve(result);
        // Une requête en erreur annule la transaction : l'erreur remonte par onabort (une seule fois).
        tx.onabort = () => {
            if (!bodyFailed) reject(fail(what, tx.error ?? new Error('transaction annulée')));
        };
        Promise.resolve()
            .then(() => body(tx))
            .then((r) => { result = r; })
            .catch((err: unknown) => {
                bodyFailed = true;
                try {
                    tx.abort();
                } catch (abortErr) {
                    console.warn(`[hors-ligne] ${what} : annulation de la transaction impossible : ${describe(abortErr)}`);
                }
                reject(fail(what, err));
            });
    });
}

function req<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('requête refusée'));
    });
}

function expiryOf(lot: OfflineLot): number {
    const t = Math.min(Date.parse(lot.expires_at), Date.parse(lot.valid_until));
    if (!Number.isFinite(t)) throw new Error('lot sans date de fin lisible');
    return t;
}

/** Lots d'un billet (toutes versions, tous comptes). */
async function lotsOfTicket(tx: IDBTransaction, ticketId: string): Promise<LotRecord[]> {
    return req(tx.objectStore(LOTS).index('ticketId').getAll(ticketId) as IDBRequest<LotRecord[]>);
}

/** Enregistre le lot du billet pour ce compte ; les autres versions du même billet sont supprimées. */
export async function saveOfflineLot(userId: string, lot: OfflineLot): Promise<void> {
    const record: LotRecord = {
        key: lotKey(userId, lot.ticket_id, Number(lot.secret_version)),
        userId,
        ticketId: lot.ticket_id,
        secretVersion: Number(lot.secret_version),
        expiresAt: expiryOf(lot),
        lot,
    };
    await withTx([LOTS], 'readwrite', `enregistrement du lot du billet ${lot.ticket_id}`, async (tx) => {
        const store = tx.objectStore(LOTS);
        for (const old of await lotsOfTicket(tx, lot.ticket_id)) {
            if (old.key !== record.key) await req(store.delete(old.key));
        }
        await req(store.put(record));
    });
}

/** Lot du billet pour ce compte (la version la plus récente), ou null. */
export async function getOfflineLot(userId: string, ticketId: string): Promise<OfflineLot | null> {
    return withTx([LOTS], 'readonly', `lecture du lot du billet ${ticketId}`, async (tx) => {
        const mine = (await lotsOfTicket(tx, ticketId)).filter((r) => r.userId === userId);
        mine.sort((a, b) => b.secretVersion - a.secretVersion);
        return mine[0]?.lot ?? null;
    });
}

/** Compte dont les lots sont affichés par la page hors ligne (meta.currentUserId), ou null. */
export async function getCurrentOfflineUser(): Promise<string | null> {
    return withTx([META], 'readonly', 'lecture du compte courant', async (tx) => {
        const row = await req(tx.objectStore(META).get(CURRENT_USER_KEY) as IDBRequest<MetaRecord | undefined>);
        return row && typeof row.value === 'string' && row.value ? row.value : null;
    });
}

/**
 * Désigne le compte courant (meta.currentUserId). Les lots d'un autre compte sont supprimés dans la même
 * transaction : un téléphone partagé ne montre jamais le billet du compte précédent.
 */
export async function setCurrentOfflineUser(userId: string): Promise<void> {
    await withTx([LOTS, META], 'readwrite', 'changement du compte courant', async (tx) => {
        const meta = tx.objectStore(META);
        const row = await req(meta.get(CURRENT_USER_KEY) as IDBRequest<MetaRecord | undefined>);
        if (row?.value === userId) return;
        const lots = tx.objectStore(LOTS);
        for (const r of await req(lots.getAll() as IDBRequest<LotRecord[]>)) {
            if (r.userId !== userId) await req(lots.delete(r.key));
        }
        await req(meta.put({ key: CURRENT_USER_KEY, value: userId } satisfies MetaRecord));
    });
}

/** Lots du compte courant, triés par début d'événement. */
export async function listCurrentOfflineLots(): Promise<{ userId: string | null; lots: OfflineLot[] }> {
    return withTx([LOTS, META], 'readonly', 'lecture des billets enregistrés', async (tx) => {
        const row = await req(tx.objectStore(META).get(CURRENT_USER_KEY) as IDBRequest<MetaRecord | undefined>);
        const userId = row && typeof row.value === 'string' && row.value ? row.value : null;
        if (!userId) return { userId: null, lots: [] };
        const all = await req(tx.objectStore(LOTS).getAll() as IDBRequest<LotRecord[]>);
        const lots = all.filter((r) => r.userId === userId).map((r) => r.lot);
        lots.sort((a, b) => Date.parse(a.ticket.event_start_at) - Date.parse(b.ticket.event_start_at));
        return { userId, lots };
    });
}

/** Supprime tous les lots d'un billet (transfert lancé, billet annulé). */
export async function deleteOfflineLots(ticketId: string): Promise<void> {
    await withTx([LOTS], 'readwrite', `suppression des lots du billet ${ticketId}`, async (tx) => {
        const store = tx.objectStore(LOTS);
        for (const r of await lotsOfTicket(tx, ticketId)) await req(store.delete(r.key));
    });
}

/**
 * Garde seulement les lots des billets encore présentés par le serveur pour ce compte, dans leur version
 * courante (`keep` : billet → version du secret, ou null quand la version n'est pas connue : lot gardé).
 * Rend le nombre de lots supprimés.
 */
export async function reconcileOfflineLots(userId: string, keep: ReadonlyMap<string, number | null>): Promise<number> {
    return withTx([LOTS], 'readwrite', 'réconciliation des billets enregistrés', async (tx) => {
        const store = tx.objectStore(LOTS);
        let removed = 0;
        for (const r of await req(store.getAll() as IDBRequest<LotRecord[]>)) {
            if (r.userId !== userId) continue;
            const version = keep.get(r.ticketId);
            if (version === undefined || (version !== null && version !== r.secretVersion)) {
                await req(store.delete(r.key));
                removed += 1;
            }
        }
        return removed;
    });
}

/** Supprime les lots expirés (heure du serveur estimée avec l'écart de chaque lot). Rend le nombre supprimé. */
export async function purgeExpiredLots(deviceNow: number = Date.now()): Promise<number> {
    return withTx([LOTS], 'readwrite', 'purge des lots expirés', async (tx) => {
        const store = tx.objectStore(LOTS);
        let removed = 0;
        // Index expiresAt : du lot qui expire le premier au dernier.
        for (const r of await req(store.index('expiresAt').getAll() as IDBRequest<LotRecord[]>)) {
            if (deviceNow + Number(r.lot.offsetMs ?? 0) >= r.expiresAt) {
                await req(store.delete(r.key));
                removed += 1;
            }
        }
        return removed;
    });
}

/**
 * Nouvelle mesure de l'écart d'horloge (réponse du live-code) : l'écart et les instants de la dernière mesure
 * du lot sont mis à jour. Sans lot pour ce compte, rien n'est écrit.
 */
export async function updateLotClock(userId: string, ticketId: string, offsetMs: number, deviceAt: number, serverAt: number): Promise<void> {
    await withTx([LOTS], 'readwrite', `mise à jour de l'écart d'horloge du billet ${ticketId}`, async (tx) => {
        const store = tx.objectStore(LOTS);
        for (const r of await lotsOfTicket(tx, ticketId)) {
            if (r.userId !== userId) continue;
            await req(store.put({ ...r, lot: { ...r.lot, offsetMs, downloadedAtDevice: deviceAt, downloadedAtServer: serverAt } } satisfies LotRecord));
        }
    });
}

/**
 * Vide le stockage hors ligne (déconnexion, autre compte). Ne lève jamais : rend false après avoir journalisé
 * l'échec, pour que la déconnexion qui suit ait lieu.
 */
export async function clearOfflineStore(): Promise<boolean> {
    try {
        await withTx([LOTS, META], 'readwrite', 'effacement du stockage hors ligne', async (tx) => {
            await req(tx.objectStore(LOTS).clear());
            await req(tx.objectStore(META).clear());
        });
        return true;
    } catch (err) {
        console.warn(`[hors-ligne] effacement du stockage hors ligne impossible : ${describe(err)}`);
        return false;
    }
}

/** La coquille de la page hors ligne est-elle dans le cache du service worker (D35) ? */
export async function hasCachedOfflineShell(): Promise<boolean> {
    if (typeof caches === 'undefined') return false;
    try {
        return Boolean(await caches.match(OFFLINE_SHELL_PATH, { ignoreSearch: true }));
    } catch (err) {
        console.warn(`[hors-ligne] lecture du cache de la page hors ligne impossible : ${describe(err)}`);
        return false;
    }
}
