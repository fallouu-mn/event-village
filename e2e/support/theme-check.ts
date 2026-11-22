/**
 * Finition 5 (point 1) — preuve que la page capturée est dans le thème demandé.
 *
 * Depuis le design 1a, les captures et le contrôle responsive « sombre » des pages connectées sortaient en CLAIR : le
 * cookie `ev-theme=light` enregistré avec la session par e2e/auth.setup.ts l'emportait sur le thème du test (cause :
 * docs/lot11b-rapport.md, section Captures ; correctif : e2e/support/fixtures.ts, prepareContext, et auth.setup.ts).
 * Ce contrôle, BLOQUANT dans e2e/captures.spec.ts et e2e/responsive.spec.ts, lit sur la page elle-même :
 *  - la classe `dark` de <html> (posée par THEME_BOOT_SCRIPT, lib/theme.ts) ;
 *  - la couleur de fond calculée de <body> (jeton --background de app/globals.css) : luminance relative ≤ 0,05 en
 *    sombre (fond noir profond), ≥ 0,8 en clair.
 * Le scanner et le QR gardent leurs propres couleurs (jetons --scan-*) dans des éléments à eux : <html> et <body>
 * suivent quand même le thème, le contrôle vaut donc pour toutes les pages.
 */
import type { Page } from '@playwright/test';
import type { ThemeKey } from './fixtures';

export interface ThemeReading {
    darkClass: boolean;
    background: string;
    luminance: number | null;
    choice: string | null;
}

/** Luminance relative WCAG d'une couleur CSS calculée « rgb(r, g, b) » ou « rgba(r, g, b, a) » ; null si illisible ou transparente. */
export function relativeLuminance(css: string): number | null {
    const m = /^rgba?\(\s*(\d+(?:\.\d+)?)[,\s]+(\d+(?:\.\d+)?)[,\s]+(\d+(?:\.\d+)?)(?:[,\s/]+(\d*\.?\d+))?\s*\)$/.exec(css.trim());
    if (!m) return null;
    if (m[4] !== undefined && Number(m[4]) === 0) return null;
    const lin = (v: number): number => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * lin(Number(m[1])) + 0.7152 * lin(Number(m[2])) + 0.0722 * lin(Number(m[3]));
}

export const THEME_LUMINANCE = Object.freeze({ sombreMax: 0.05, clairMin: 0.8 });

export async function readTheme(page: Page): Promise<ThemeReading> {
    const r = await page.evaluate(() => ({
        darkClass: document.documentElement.classList.contains('dark'),
        background: getComputedStyle(document.body).backgroundColor,
        choice: document.documentElement.getAttribute('data-theme-choice'),
    }));
    return { ...r, luminance: relativeLuminance(r.background) };
}

/** Problème (texte du contrôle bloquant) si la page n'est pas dans le thème demandé ; null sinon. */
export function themeProblem(reading: ThemeReading, theme: ThemeKey, at = ''): string | null {
    const where = at ? ` (${at})` : '';
    const lum = reading.luminance === null ? 'illisible' : reading.luminance.toFixed(3);
    if (theme === 'sombre') {
        if (!reading.darkClass || reading.luminance === null || reading.luminance > THEME_LUMINANCE.sombreMax) {
            return `thème sombre demandé mais page affichée en clair${where} : classe dark ${reading.darkClass ? 'présente' : 'absente'}, choix « ${reading.choice ?? '—'} », fond ${reading.background} (luminance ${lum}, ${THEME_LUMINANCE.sombreMax} au plus)`;
        }
        return null;
    }
    if (reading.darkClass || reading.luminance === null || reading.luminance < THEME_LUMINANCE.clairMin) {
        return `thème clair demandé mais page affichée en sombre${where} : classe dark ${reading.darkClass ? 'présente' : 'absente'}, choix « ${reading.choice ?? '—'} », fond ${reading.background} (luminance ${lum}, ${THEME_LUMINANCE.clairMin} au moins)`;
    }
    return null;
}
