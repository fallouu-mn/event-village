/**
 * Lot 6 (contrat G1, N2) — lien d'action d'une notification : chemin INTERNE seulement.
 *
 * Partagé par le catalogue (liens des modèles), la cloche, la page /notifications, les routes qui
 * renvoient `actionUrl` et le service worker côté serveur (charge `url` du push). Une valeur venue de la
 * base n'est jamais suivie telle quelle : seul un chemin qui commence par « / » (et pas « // » ni « /\ »),
 * sans schéma, sans espace ni caractère de contrôle, est gardé ; tout le reste donne null (aucun lien).
 */

const MAX_ACTION_URL_LENGTH = 2048;

/** Caractère de contrôle (C0, DEL, C1), espace, ou barre oblique inverse (lue comme « / » par les navigateurs). */
function hasForbiddenChar(value: string): boolean {
    for (let i = 0; i < value.length; i++) {
        const c = value.charCodeAt(i);
        if (c <= 0x20 || (c >= 0x7f && c <= 0xa0) || c === 0x5c || c === 0x2028 || c === 0x2029 || c === 0x202f || c === 0xfeff) return true;
    }
    return false;
}

/** Chemin interne (« /tickets?tab=recus ») ou null pour toute autre valeur (externe, //, \, schéma, relatif). */
export function internalActionUrl(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    if (value.length < 1 || value.length > MAX_ACTION_URL_LENGTH) return null;
    if (!value.startsWith('/') || value.startsWith('//')) return null;
    if (hasForbiddenChar(value)) return null;
    // Défense en profondeur : une fois résolu sur une origine quelconque, le lien doit y rester.
    let resolved: URL;
    try {
        resolved = new URL(value, 'https://event-village.invalid');
    } catch {
        return null; // chemin illisible : aucun lien
    }
    if (resolved.origin !== 'https://event-village.invalid') return null;
    return value;
}
