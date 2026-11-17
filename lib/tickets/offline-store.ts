/**
 * Lot 7, tâche 7.1 (contrat 5.2, D34, D35) — stockage local des lots de codes hors ligne (IndexedDB écrit à
 * la main, aucune dépendance).
 *
 * Base `event-village-offline` version 1 :
 *  - magasin `lots`, clé `"<userId>:<ticketId>:<secretVersion>"`, index `ticketId` et `expiresAt` (heure du
 *    serveur, ms) ; une seule version par billet : enregistrer une version supprime les autres ;
 *  - magasin `meta`, enregistrement `currentUserId` : la page hors ligne n'affiche que les lots de ce compte ;
 *    enregistrement `generation` (cvf2b 6.4) : valeur changée par chaque purge (clearOfflineStore). Un téléchargement
 *    la lit avant sa requête et la revérifie dans la transaction de son écriture : une réponse partie avant
 *    « Se déconnecter » (dans cet onglet ou un autre) n'écrit plus rien après la purge (lib/tickets/offline-lots.ts).
 *
 * Purge : à la déconnexion et à la connexion d'un autre compte (AuthProvider, clearOfflineStore), au
 * transfert (TransferModal, deleteOfflineLots), quand un billet disparaît de la liste ou change de version
 * (reconcileOfflineLots, lib/tickets/offline-lots.ts), et à l'expiration (purgeExpiredLots).
 *
 * Lot sécurité (déconnexion sans réseau) : enregistrement, lecture, compte courant, réconciliation, écart d'horloge
 * et coquille hors ligne déplacés tels quels dans lib/tickets/offline-lots.ts. Ce module (base, transactions, purges)
 * est importé par AuthProvider, chargé par chaque page : il ne garde que ce que la purge et les écrans des billets
 * partagent.
 *
 * Toute erreur IndexedDB est journalisée (`console.warn('[hors-ligne] …')`) puis remonte sous la forme d'une
 * OfflineStoreError : l'écran affiche « Stockage hors ligne indisponible sur ce téléphone ». Seule
 * clearOfflineStore ne lève pas (elle accompagne la déconnexion, qui doit avoir lieu) : elle rend false.
 */
import type { OfflineLot } from './offline-clock';

const DB_NAME = 'event-village-offline';
const DB_VERSION = 1;
export const LOTS = 'lots';
export const META = 'meta';
export const CURRENT_USER_KEY = 'currentUserId';
export const GENERATION_KEY = 'generation';

export class OfflineStoreError extends Error {
    constructor(message: string, readonly cause?: unknown) {
        super(message);
        this.name = 'OfflineStoreError';
    }
}

export interface LotRecord {
    key: string;
    userId: string;
    ticketId: string;
    secretVersion: number;
    /** Fin d'utilité du lot, heure du serveur (ms). */
    expiresAt: number;
    lot: OfflineLot;
}

export interface MetaRecord {
    key: string;
    value: string;
}

export function describeError(err: unknown): string {
    if (err instanceof Error) return `${err.name} : ${err.message}`;
    if (err && typeof err === 'object' && 'name' in err) return String((err as { name: unknown }).name);
    return String(err);
}

function fail(what: string, err: unknown): OfflineStoreError {
    console.warn(`[hors-ligne] ${what} : ${describeError(err)}`);
    return new OfflineStoreError(`${what} : ${describeError(err)}`, err);
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
export async function withTx<T>(stores: string[], mode: IDBTransactionMode, what: string, body: (tx: IDBTransaction) => T | Promise<T>): Promise<T> {
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
                    console.warn(`[hors-ligne] ${what} : annulation de la transaction impossible : ${describeError(abortErr)}`);
                }
                reject(fail(what, err));
            });
    });
}

export function req<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('requête refusée'));
    });
}

/** Lots d'un billet (toutes versions, tous comptes). */
export async function lotsOfTicket(tx: IDBTransaction, ticketId: string): Promise<LotRecord[]> {
    return req(tx.objectStore(LOTS).index('ticketId').getAll(ticketId) as IDBRequest<LotRecord[]>);
}

/** Supprime tous les lots d'un billet (transfert lancé, billet annulé). */
export async function deleteOfflineLots(ticketId: string): Promise<void> {
    await withTx([LOTS], 'readwrite', `suppression des lots du billet ${ticketId}`, async (tx) => {
        const store = tx.objectStore(LOTS);
        for (const r of await lotsOfTicket(tx, ticketId)) await req(store.delete(r.key));
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
 * Vide le stockage hors ligne (déconnexion, autre compte). Ne lève jamais : rend false après avoir journalisé
 * l'échec, pour que la déconnexion qui l'accompagne ait lieu.
 */
export async function clearOfflineStore(): Promise<boolean> {
    try {
        await withTx([LOTS, META], 'readwrite', 'effacement du stockage hors ligne', async (tx) => {
            await req(tx.objectStore(LOTS).clear());
            await req(tx.objectStore(META).clear());
            // Cvf2b 6.4 : nouvelle génération, dans la même transaction que la purge
            await req(tx.objectStore(META).put({ key: GENERATION_KEY, value: Math.random().toString(36) } satisfies MetaRecord));
        });
        return true;
    } catch (err) {
        console.warn(`[hors-ligne] effacement du stockage hors ligne impossible : ${describeError(err)}`);
        return false;
    }
}
