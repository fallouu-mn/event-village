/**
 * Lot Carte B — regroupement des points de la carte, sans bibliothèque (décision : aucune nouvelle dépendance).
 *
 * Grille en pixels de l'écran au zoom courant : les points d'une même case (CELL_PX de côté) forment un groupe, placé au
 * barycentre de ses points. Un groupe d'un seul point est un repère simple. Ordre stable : celui des points donnés (les
 * événements arrivent dans l'ordre de début), un groupe prend la place de son premier point.
 */

export const CLUSTER_CELL_PX = 64;

export interface ScreenPoint<T> {
    item: T;
    /** Position à l'écran au zoom courant (pixels du plan de Leaflet). */
    x: number;
    y: number;
}

export interface Cluster<T> {
    /** Clé stable du groupe : identifiants de ses points. */
    key: string;
    items: T[];
    /** Barycentre à l'écran. */
    x: number;
    y: number;
}

export function clusterPoints<T>(points: ReadonlyArray<ScreenPoint<T>>, idOf: (item: T) => string, cell = CLUSTER_CELL_PX): Array<Cluster<T>> {
    const byCell = new Map<string, { items: T[]; sx: number; sy: number }>();
    const order: string[] = [];
    for (const p of points) {
        if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
        const k = `${Math.floor(p.x / cell)}:${Math.floor(p.y / cell)}`;
        let group = byCell.get(k);
        if (!group) {
            group = { items: [], sx: 0, sy: 0 };
            byCell.set(k, group);
            order.push(k);
        }
        group.items.push(p.item);
        group.sx += p.x;
        group.sy += p.y;
    }
    return order.map((k) => {
        const g = byCell.get(k)!;
        return { key: g.items.map(idOf).join('|'), items: g.items, x: g.sx / g.items.length, y: g.sy / g.items.length };
    });
}
