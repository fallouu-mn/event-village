/**
 * Design 1d (point 1) — couleur d'une affiche, partie sans dépendance (navigateur et serveur) : contraste avec le blanc
 * (WCAG 2), assombrissement, repli « bleu nuit » et contrôle des valeurs enregistrées. Le calcul sur l'image (sharp) est
 * dans lib/images/poster-style.ts (serveur seulement).
 */

/** Repli « bleu nuit » : même valeur que le jeton --poster-fallback (app/globals.css, docs/design/jetons.css). */
export const POSTER_FALLBACK_COLOR = '#14213d';

/** Contraste minimal exigé avec du texte blanc (WCAG AA, texte courant). */
export const POSTER_MIN_CONTRAST = 4.5;
/** Contraste visé à l'assombrissement (marge au-dessus de 4,5:1). */
export const POSTER_TARGET_CONTRAST = 4.6;

/** Image floutée : 24 px de côté au plus, 3 000 caractères au plus en adresse data: (contrainte de la table). */
export const POSTER_BLUR_MAX_SIDE = 24;
export const POSTER_BLUR_MAX_LENGTH = 3000;
export const POSTER_BLUR_PREFIX = 'data:image/webp;base64,';

export const POSTER_COLOR_RE = /^#[0-9a-f]{6}$/;

export interface Rgb { r: number; g: number; b: number }

function channel(v: number): number {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Luminance relative (WCAG 2). */
export function relativeLuminance({ r, g, b }: Rgb): number {
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Contraste entre du texte blanc et la couleur donnée. */
export function contrastWithWhite(rgb: Rgb): number {
    return 1.05 / (relativeLuminance(rgb) + 0.05);
}

export function hexToRgb(hex: string): Rgb | null {
    if (!POSTER_COLOR_RE.test(hex)) return null;
    return { r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16) };
}

export function rgbToHex({ r, g, b }: Rgb): string {
    return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Couleur assombrie (même teinte : les trois canaux multipliés par le même facteur) jusqu'à un contraste d'au moins
 * 4,6:1 avec le blanc. Une couleur déjà assez sombre est rendue telle quelle.
 */
export function darkenForWhiteText(rgb: Rgb): Rgb {
    const clean = { r: Math.round(rgb.r), g: Math.round(rgb.g), b: Math.round(rgb.b) };
    if (contrastWithWhite(clean) >= POSTER_TARGET_CONTRAST) return clean;
    for (let step = 1; step < 50; step++) {
        const factor = 1 - step * 0.02;
        const next = { r: Math.round(clean.r * factor), g: Math.round(clean.g * factor), b: Math.round(clean.b * factor) };
        if (contrastWithWhite(next) >= POSTER_TARGET_CONTRAST) return next;
    }
    return { r: 0, g: 0, b: 0 };
}

/** Couleur d'affiche lisible pour l'écran : la valeur enregistrée si elle est valide et assez sombre, sinon le repli. */
export function posterColorOrFallback(stored: string | null | undefined): string {
    const rgb = stored ? hexToRgb(stored) : null;
    return rgb && contrastWithWhite(rgb) >= POSTER_MIN_CONTRAST ? (stored as string) : POSTER_FALLBACK_COLOR;
}

/** Image floutée enregistrée, seulement si elle a la forme attendue (sinon aucune). */
export function posterBlurOrNull(stored: string | null | undefined): string | null {
    return typeof stored === 'string' && stored.startsWith(POSTER_BLUR_PREFIX) && stored.length <= POSTER_BLUR_MAX_LENGTH
        && /^[A-Za-z0-9+/=]+$/.test(stored.slice(POSTER_BLUR_PREFIX.length))
        ? stored
        : null;
}
