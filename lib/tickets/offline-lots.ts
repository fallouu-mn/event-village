/**
 * Lot 7, tâche 7.1 (contrat 5.2, D34, D35) — lots de codes hors ligne : enregistrement, lecture, compte courant,
 * réconciliation avec la liste du serveur, écart d'horloge, coquille de la page hors ligne. La base IndexedDB, ses
 * transactions et ses purges (déconnexion, transfert, expiration) sont dans lib/tickets/offline-store.ts.
 *
 * Lot sécurité (déconnexion sans réseau) : code déplacé tel quel d'offline-store, comportement inchangé. AuthProvider,
 * chargé par chaque page, n'importe que la purge (clearOfflineStore) : ce module ne sert qu'aux écrans des billets
 * (OfflineTicketsSync, TicketCard, /billet/hors-ligne) et reste hors du JavaScript commun à toutes les pages.
 */
import type { OfflineLot } from './offline-clock';
import {
    CURRENT_USER_KEY, describeError, LOTS, lotsOfTicket, META, req, withTx, type LotRecord, type MetaRecord,
} from './offline-store';

/** Chemin de la coquille mise en cache par public/sw.js (D35). */
export const OFFLINE_SHELL_PATH = '/billet/hors-ligne';

export const OFFLINE_STORE_UNAVAILABLE = 'Stockage hors ligne indisponible sur ce téléphone.';

export function lotKey(userId: string, ticketId: string, secretVersion: number): string {
    return `${userId}:${ticketId}:${secretVersion}`;
}

function expiryOf(lot: OfflineLot): number {
    const t = Math.min(Date.parse(lot.expires_at), Date.parse(lot.valid_until));
    if (!Number.isFinite(t)) throw new Error('lot sans date de fin lisible');
    return t;
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

/** La coquille de la page hors ligne est-elle dans le cache du service worker (D35) ? */
export async function hasCachedOfflineShell(): Promise<boolean> {
    if (typeof caches === 'undefined') return false;
    try {
        return Boolean(await caches.match(OFFLINE_SHELL_PATH, { ignoreSearch: true }));
    } catch (err) {
        console.warn(`[hors-ligne] lecture du cache de la page hors ligne impossible : ${describeError(err)}`);
        return false;
    }
}
