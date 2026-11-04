/**
 * Lot 7, amendement A10 — préfixes des clés de la mémoire du contrôle sur l'appareil (session retenue et scan en
 * attente de verdict, lib/scan/scan-session) et leur effacement à la déconnexion. Module à part et minuscule :
 * AuthProvider (chargé sur toutes les pages) l'importe sans tirer le reste de la mémoire du scanner.
 */

export const SCAN_SESSION_PREFIX = 'ev-scan-session:v1:';
export const SCAN_PENDING_PREFIX = 'ev-scan-pending:v1:';
/** Préfixes des clés de la mémoire du contrôle (effacées à la déconnexion). */
export const SCAN_MEMORY_PREFIXES: readonly string[] = [SCAN_SESSION_PREFIX, SCAN_PENDING_PREFIX];

/**
 * Efface toute la mémoire du contrôle sur l'appareil (tous comptes) : appelé avant la déconnexion et sur
 * SIGNED_OUT. Ne lève jamais : un échec est journalisé (la mémoire, sans donnée personnelle, expire d'elle-même).
 */
export function clearAllScanMemory(): void {
    try {
        const s = window.localStorage;
        const keys: string[] = [];
        for (let i = 0; i < s.length; i++) {
            const k = s.key(i);
            if (k && SCAN_MEMORY_PREFIXES.some((p) => k.startsWith(p))) keys.push(k);
        }
        for (const k of keys) s.removeItem(k);
    } catch (err) {
        console.warn('[scan-session] mémoire du contrôle non effacée :', err instanceof Error ? err.message : String(err));
    }
}
