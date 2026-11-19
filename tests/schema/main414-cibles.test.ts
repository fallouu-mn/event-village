/**
 * Correctif du run 414 de main — capture design-confirmation (ordinateur, sombre) : « Fermer » 42 × 42, « Garder le
 * billet » et « Rembourser 10 000 F CFA » de 42 px de haut. Cause : la fenêtre s'ouvrait par scale(0.95) → scale(1) ; pendant
 * l'ouverture, ses boutons (min-h-11 = 44 px) mesuraient réellement 44 × 0,95 ≈ 42 px. Ouverture des fenêtres et entrée
 * des toasts désormais sans réduction d'échelle : les cibles gardent 44 px à chaque image.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const css = fs.readFileSync(path.join(process.cwd(), 'app/globals.css'), 'utf8').replace(/\r\n/g, '\n');
const keyframes = (name: string): string => {
    const i = css.indexOf(`@keyframes ${name} {`);
    assert.ok(i >= 0, `@keyframes ${name} introuvable`);
    return css.slice(i, css.indexOf('\n}', i) + 2);
};

describe('run 414 — cibles de 44 px pendant les animations d’entrée', () => {
    test('ouverture des fenêtres (zoom-in-95) et entrée des toasts : aucune réduction d’échelle', () => {
        assert.match(css, /\.animate-in\.zoom-in-95 \{ animation-name: evZoomIn; \}/);
        for (const name of ['evZoomIn', 'toastSlideInRight']) assert.doesNotMatch(keyframes(name), /scale\(/, `${name} réduit l’échelle`);
        assert.match(keyframes('evZoomIn'), /from \{ opacity: 0; transform: translateY\(8px\); \}/);
    });

    test('boutons : 44 px au moins à toutes les tailles', () => {
        const button = fs.readFileSync(path.join(process.cwd(), 'components/ui/Button.tsx'), 'utf8');
        for (const size of ['sm', 'md', 'icon']) assert.match(button, new RegExp(`  ${size}: '[^']*min-h-11`), size);
    });
});
