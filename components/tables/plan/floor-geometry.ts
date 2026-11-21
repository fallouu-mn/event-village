/**
 * Lot 11b — plan de salle : géométrie sans dépendance (positions en % du plan, 0 à 100).
 * Tables : (x, y) = centre de la table. Zones : (x, y) = coin haut gauche, (w, h) = taille, 5 à 100, x + w ≤ 100 et
 * y + h ≤ 100 (contrainte restaurant_zones_plan_chk de la base). Rotation des tables : 0 à 345 par 15°.
 */

export type FloorShape = 'RONDE' | 'CARREE' | 'RECTANGLE';

export const SHAPES: readonly { value: FloorShape; label: string }[] = [
    { value: 'RONDE', label: 'Ronde' },
    { value: 'CARREE', label: 'Carrée' },
    { value: 'RECTANGLE', label: 'Rectangle' },
];

export const SHAPE_LABEL: Readonly<Record<FloorShape, string>> = { RONDE: 'ronde', CARREE: 'carrée', RECTANGLE: 'rectangle' };

export const ZONE_MIN = 5;
export const ZONE_DEFAULT_W = 34;
export const ZONE_DEFAULT_H = 28;
export const ROTATION_STEP = 15;

export function clamp(v: number, min: number, max: number): number {
    if (max < min) return min;
    return Math.min(max, Math.max(min, v));
}

/** Arrondi au dixième (la base garde deux décimales). */
export function round1(v: number): number {
    return Math.round(v * 10) / 10;
}

export function nextRotation(r: number): number {
    const base = Number.isFinite(r) ? Math.round(r / ROTATION_STEP) * ROTATION_STEP : 0;
    return (((base + ROTATION_STEP) % 360) + 360) % 360;
}

/**
 * Taille d'une table en % de la largeur du plan selon sa capacité et sa forme ; un minimum en pixels (44 px, cible
 * tactile) est appliqué à l'affichage.
 */
export function tableWidthPct(capacity: number, shape: FloorShape): number {
    const base = Math.min(15, 7 + Math.max(1, capacity) * 0.8);
    return shape === 'RECTANGLE' ? Math.min(24, base * 1.55) : base;
}

export function tableMinPx(shape: FloorShape): number {
    return shape === 'RECTANGLE' ? 80 : 44;
}

/** Ratio largeur / hauteur de la boîte de la table. */
export function tableAspect(shape: FloorShape): number {
    return shape === 'RECTANGLE' ? 16 / 9 : 1;
}

/** Zone gardée dans le cadre : taille 5 à 100, coin dans le cadre, x + w ≤ 100, y + h ≤ 100. */
export function clampZone(z: { x: number; y: number; w: number; h: number }): { x: number; y: number; w: number; h: number } {
    const w = round1(clamp(z.w, ZONE_MIN, 100));
    const h = round1(clamp(z.h, ZONE_MIN, 100));
    return { x: round1(clamp(z.x, 0, 100 - w)), y: round1(clamp(z.y, 0, 100 - h)), w, h };
}

/**
 * Première place libre pour une nouvelle table : balayage d'une grille, loin des tables déjà posées (au moins `gap` %
 * en distance) ; à défaut, le centre du plan.
 */
export function freeSpot(taken: readonly { x: number; y: number }[], gap = 14): { x: number; y: number } {
    for (let y = 14; y <= 86; y += 12) {
        for (let x = 10; x <= 90; x += 10) {
            if (taken.every((t) => Math.hypot((t.x - x) * 1, (t.y - y) * 0.75) >= gap)) return { x, y };
        }
    }
    return { x: 50, y: 50 };
}

/** Place libre pour une zone (coin haut gauche) : la première case de la grille qui ne chevauche aucune zone posée. */
export function freeZoneSpot(taken: readonly { x: number; y: number; w: number; h: number }[], w = ZONE_DEFAULT_W, h = ZONE_DEFAULT_H): { x: number; y: number } {
    for (let y = 0; y + h <= 100; y += 6) {
        for (let x = 0; x + w <= 100; x += 6) {
            const overlaps = taken.some((z) => x < z.x + z.w && x + w > z.x && y < z.y + z.h && y + h > z.y);
            if (!overlaps) return { x, y };
        }
    }
    return { x: 0, y: 0 };
}
