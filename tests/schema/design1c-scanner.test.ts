/**
 * Design 1c (point 3) — scanner : sa propre mise en page légère, vibrations, paysage.
 *  - mise en page à lui (app/controller/layout.tsx) : ni en-tête ni barre du bas de l'application (AppLayout rend les
 *    routes /controller telles quelles), thème sombre forcé ; budget JavaScript du scanner NON relevé ;
 *  - vibration courte pour « validé », motif différent et plus long pour « refusé », aucune pour un incident technique,
 *    donnée au verdict ;
 *  - paysage (téléphone tenu en largeur) : caméra à gauche, commandes à droite, carré de la caméra limité à la hauteur
 *    de l'écran (aucun défilement pour viser) ; contrôlé par le job « responsive » (e2e/support/responsive-pages.ts).
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { vibrationPattern } from '../../lib/hardware/feedback';

const ROOT = process.cwd();
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
const total = (p: number[] | null): number => (p ?? []).reduce((a, b) => a + b, 0);

describe('design 1c — scanner', () => {
    test('vibration courte « validé », différente et plus longue « refusé », rien pour un incident technique', () => {
        const ok = vibrationPattern('accepte');
        const refus = vibrationPattern('refuse');
        assert.deepEqual(ok, [60], 'une impulsion courte');
        assert.ok(refus && refus.length >= 3, 'plusieurs impulsions pour un refus');
        assert.notDeepEqual(refus, ok);
        assert.ok(total(refus) > total(ok) * 3, `refus (${total(refus)} ms) nettement plus long que validé (${total(ok)} ms)`);
        for (const c of ['deja_utilise', 'evenement_annule']) assert.deepEqual(vibrationPattern(c), refus, c);
        assert.equal(vibrationPattern('technique'), null);
        const page = read('app/controller/scanner/page.tsx');
        assert.match(page, /triggerHapticFeedback\(categoryFor\(outcome\)\);/, 'vibration au verdict');
    });

    test('mise en page à lui : aucune enveloppe de l’application, thème sombre forcé', () => {
        const app = read('components/layout/AppLayout.tsx');
        assert.match(app, /if \(isControllerRoute \|\| BARE_ROUTES\.has\(pathname\)\) \{\n\s+return <>\{children\}<\/>;/);
        const layout = read('app/controller/layout.tsx');
        assert.match(layout, /className="dark min-h-screen bg-background text-foreground-strong" style=\{\{ colorScheme: 'dark' \}\}/);
    });

    test('budget JavaScript du scanner non relevé', () => {
        const budget = JSON.parse(read('scripts/js-budget.json')) as Record<string, number>;
        assert.equal(budget['/controller/scanner'], 234911);
    });

    test('paysage : variante « paysage », caméra et commandes côte à côte, caméra limitée à la hauteur de l’écran', () => {
        assert.match(read('tailwind.config.ts'), /paysage: \{ raw: '\(orientation: landscape\) and \(max-height: 520px\)' \}/);
        const page = read('app/controller/scanner/page.tsx');
        assert.match(page, /<div className="flex flex-col gap-3 paysage:grid paysage:grid-cols-2 paysage:items-start paysage:gap-4">/);
        assert.match(read('components/scan/CameraQrScanner.tsx'), /aspect-square w-full max-w-sm[^"]*paysage:max-w-\[min\(24rem,calc\(100svh-9rem\)\)\]/);
        assert.match(read('app/controller/layout.tsx'), /paysage:max-w-4xl/);
    });
});
