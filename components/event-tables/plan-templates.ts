/**
 * Lot 11c-c — gabarits du plan des tables d'un événement et alignement sur une grille douce (géométrie pure, sans
 * dépendance). Positions en % du plan (0 à 100, centre de la table), comme le plan partagé du lot 11b et la base
 * (event_tables_plan_chk). Ce ne sont que des positions : aucun nombre de places ni montant n'est calculé ici.
 */

/** Pas de la grille douce : 2,5 % du plan (40 positions par côté). */
export const GRID_STEP = 2.5;
/** Marge gardée au bord du plan, pour qu'une table reste entière dans le cadre. */
export const EDGE = 7.5;

export interface Point { x: number; y: number }

export type TemplateId = 'rangees' | 'carre' | 'cercle' | 'ligne';
export type TemplateArea = 'tout' | 'haut' | 'bas';

export const TEMPLATES: ReadonlyArray<{ id: TemplateId; label: (n: number) => string }> = [
    { id: 'rangees', label: (n) => `${n} tables en 2 rangées` },
    { id: 'carre', label: (n) => (n === 4 ? 'Carré de 4 tables' : `${n} tables en carrés de 4`) },
    { id: 'cercle', label: (n) => `${n} tables en cercle` },
    { id: 'ligne', label: (n) => `${n} tables sur une ligne` },
];

export const AREAS: ReadonlyArray<{ id: TemplateArea; label: string }> = [
    { id: 'tout', label: 'Tout le plan' },
    { id: 'haut', label: 'Moitié haute' },
    { id: 'bas', label: 'Moitié basse' },
];

const round1 = (v: number) => Math.round(v * 10) / 10;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Position ramenée sur la grille douce, dans le cadre (marge EDGE). */
export function snap(v: number): number {
    return round1(clamp(Math.round(v / GRID_STEP) * GRID_STEP, EDGE, 100 - EDGE));
}

export function snapPoint(p: Point): Point {
    return { x: snap(p.x), y: snap(p.y) };
}

function bounds(area: TemplateArea): { top: number; bottom: number } {
    if (area === 'haut') return { top: 12, bottom: 44 };
    if (area === 'bas') return { top: 56, bottom: 88 };
    return { top: 14, bottom: 86 };
}

/** Valeurs régulièrement espacées de `from` à `to` (une seule : au milieu). */
function spread(count: number, from: number, to: number): number[] {
    if (count <= 1) return [(from + to) / 2];
    return Array.from({ length: count }, (_, i) => from + ((to - from) * i) / (count - 1));
}

/**
 * Positions de `n` tables selon un gabarit, dans une partie du plan. Toujours `n` positions, distinctes, dans le cadre,
 * alignées sur la grille douce.
 */
export function templatePositions(id: TemplateId, n: number, area: TemplateArea = 'tout'): Point[] {
    if (!Number.isInteger(n) || n < 1) return [];
    const { top, bottom } = bounds(area);
    const mid = (top + bottom) / 2;
    let points: Point[];
    switch (id) {
        case 'rangees': {
            const rows = n === 1 ? 1 : 2;
            const perRow = Math.ceil(n / rows);
            const ys = spread(rows, top + 6, bottom - 6);
            points = [];
            for (let r = 0; r < rows; r++) {
                const count = r === rows - 1 ? n - perRow * (rows - 1) : perRow;
                for (const x of spread(count, 14, 86)) points.push({ x, y: ys[r] });
            }
            break;
        }
        case 'carre': {
            // Carrés de 4 tables (2 × 2, serrés), côte à côte
            const groups = Math.ceil(n / 4);
            const centers = spread(groups, groups === 1 ? 50 : 20, groups === 1 ? 50 : 80);
            const gap = 7.5;
            points = [];
            for (let g = 0; g < groups && points.length < n; g++) {
                for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
                    if (points.length >= n) break;
                    points.push({ x: centers[g] + dx * gap, y: mid + dy * gap });
                }
            }
            break;
        }
        case 'cercle': {
            if (n === 1) {
                points = [{ x: 50, y: mid }];
                break;
            }
            const ry = Math.max(8, (bottom - top) / 2 - 6);
            const rx = Math.min(36, ry * 1.6 + 4);
            points = Array.from({ length: n }, (_, i) => {
                const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
                return { x: 50 + rx * Math.cos(a), y: mid + ry * Math.sin(a) };
            });
            break;
        }
        default:
            points = spread(n, 10, 90).map((x) => ({ x, y: mid }));
    }
    return dedupe(points.map(snapPoint));
}

/** Deux tables ne prennent jamais la même case : la seconde glisse d'un pas vers la droite (puis la ligne suivante). */
function dedupe(points: Point[]): Point[] {
    const taken = new Set<string>();
    return points.map((p) => {
        let { x, y } = p;
        for (let guard = 0; taken.has(`${x}:${y}`) && guard < 2000; guard++) {
            x = round1(x + GRID_STEP);
            if (x > 100 - EDGE) {
                x = EDGE;
                y = round1(y + GRID_STEP > 100 - EDGE ? EDGE : y + GRID_STEP);
            }
        }
        taken.add(`${x}:${y}`);
        return { x, y };
    });
}

/**
 * Numéros pour une renumérotation : les tables `fixed` (vendues, en paiement ou déjà vendues une fois) gardent leur
 * numéro ; les autres reçoivent, dans l'ordre donné, les plus petits numéros libres à partir de 1.
 */
export function renumber(order: ReadonlyArray<{ key: string; number: number; fixed: boolean }>): Map<string, number> {
    const used = new Set(order.filter((t) => t.fixed).map((t) => t.number));
    const out = new Map<string, number>();
    let next = 1;
    for (const t of order) {
        if (t.fixed) {
            out.set(t.key, t.number);
            continue;
        }
        while (used.has(next)) next++;
        out.set(t.key, next);
        used.add(next);
    }
    return out;
}

/** Plus petit numéro libre (1 à 999), ou null si tous sont pris. */
export function nextFreeNumber(numbers: Iterable<number>): number | null {
    const used = new Set(numbers);
    for (let n = 1; n <= 999; n++) if (!used.has(n)) return n;
    return null;
}
