/**
 * Design 1d (point 10) — retour arrière à la même position dans une liste de cartes (accueil, Explorer, Mes favoris).
 *
 * Au toucher d'une carte, la position est gardée EN MÉMOIRE (variable du module : elle vit tant que l'onglet garde
 * l'application, rien n'est écrit dans le stockage) : la carte touchée (identifiant et rang parmi les cartes du même
 * événement), sa distance au haut de l'écran, et le défilement horizontal de chaque rangée (`data-ev-row`). Au retour
 * arrière (popstate) sur la même adresse, la page remet les rangées puis fait défiler la fenêtre pour que la carte
 * retrouve sa place, ancrée sur la carte (juste même si des sections hors écran ont une hauteur estimée). Plusieurs
 * passes courtes (image suivante, 150 ms, 400 ms) : la page peut finir sa mise en page entre-temps. Un retour arrière
 * vers une autre adresse ou plus de 30 minutes après : rien.
 */

export const ROW_ATTR = 'data-ev-row';
const CARD_LINK_SELECTOR = 'a[data-ev-card-link]';
const MAX_AGE_MS = 30 * 60_000;
const POP_WINDOW_MS = 3000;

interface SavedPosition {
    key: string;
    id: string;
    index: number;
    top: number;
    rows: number[];
    at: number;
}

let saved: SavedPosition | null = null;
let poppedAt = 0;

if (typeof window !== 'undefined') {
    window.addEventListener('popstate', () => {
        poppedAt = Date.now();
    });
}

function currentKey(): string {
    return `${window.location.pathname}${window.location.search}`;
}

/** À appeler au toucher du lien d'une carte (avant la navigation). */
export function rememberListPosition(link: HTMLAnchorElement): void {
    const id = link.getAttribute('data-ev-card-link');
    if (!id) return;
    const same = Array.from(document.querySelectorAll<HTMLAnchorElement>(`${CARD_LINK_SELECTOR}[data-ev-card-link="${CSS.escape(id)}"]`));
    const card = link.closest('article') ?? link;
    saved = {
        key: currentKey(),
        id,
        index: Math.max(0, same.indexOf(link)),
        top: card.getBoundingClientRect().top,
        rows: Array.from(document.querySelectorAll<HTMLElement>(`[${ROW_ATTR}]`), (row) => row.scrollLeft),
        at: Date.now(),
    };
}

function restoreOnce(position: SavedPosition): void {
    document.querySelectorAll<HTMLElement>(`[${ROW_ATTR}]`).forEach((row, i) => {
        const left = position.rows[i];
        if (typeof left === 'number' && Math.abs(row.scrollLeft - left) > 1) row.scrollLeft = left;
    });
    const links = document.querySelectorAll<HTMLAnchorElement>(`${CARD_LINK_SELECTOR}[data-ev-card-link="${CSS.escape(position.id)}"]`);
    const link = links[position.index] ?? links[0];
    if (!link) return;
    const card = link.closest('article') ?? link;
    const delta = card.getBoundingClientRect().top - position.top;
    if (Math.abs(delta) > 1) window.scrollBy({ top: delta, left: 0, behavior: 'auto' });
}

/**
 * À appeler au montage d'une page de cartes : remet la position si l'on revient (retour arrière) sur l'adresse gardée.
 * Rend une fonction qui annule les passes restantes.
 */
export function restoreListPosition(): () => void {
    const position = saved;
    if (!position || position.key !== currentKey() || Date.now() - position.at > MAX_AGE_MS || Date.now() - poppedAt > POP_WINDOW_MS) {
        return () => undefined;
    }
    saved = null;
    const frame = requestAnimationFrame(() => restoreOnce(position));
    const timers = [150, 400].map((ms) => window.setTimeout(() => restoreOnce(position), ms));
    return () => {
        cancelAnimationFrame(frame);
        timers.forEach((t) => window.clearTimeout(t));
    };
}
