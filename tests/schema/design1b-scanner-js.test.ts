/**
 * Design 1b (décision 3 de l'utilisateur) — scanner, budget NON relevé : rien d'accessoire n'est chargé avant son écran
 * de départ (e2e/perf.spec.ts, JavaScript avant le marqueur ≤ 234,9 + 20 Ko).
 * Analyse du run 376 (261,1 Ko) : écran lui-même 240,3 Ko (manifeste du build, gzip) ; + 12,3 Ko de préchargement de la
 * page profil (lien de l'en-tête) ; + ≈ 8,5 Ko de cartes des toasts et de barre de navigation, préchargées « quand le
 * navigateur est libre » pendant que le scanner attend ses affectations (libre plus tôt depuis le CSS écrit dans la page).
 * Contrôle statique (le poids réel reste mesuré par la CI, e2e/perf.spec.ts).
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (rel: string): string => fs.readFileSync(path.join(process.cwd(), rel), 'utf8').replace(/\r\n/g, '\n');

describe('design 1b — JavaScript avant l’écran de départ du scanner', () => {
    test('en-tête du contrôleur : aucun lien préchargé (accueil, profil)', () => {
        const layout = read('app/controller/layout.tsx');
        const links = [...layout.matchAll(/<Link\n([\s\S]*?)>/g)].map((m) => m[1]);
        assert.ok(links.length >= 2, 'liens de l’en-tête trouvés');
        for (const l of links) assert.match(l, /prefetch=\{false\}/, `lien sans prefetch={false} : ${l.trim().split('\n')[0]}`);
    });

    test('toasts et barre de navigation : préchargés par warmWhenIdle (jamais par requestIdleCallback direct)', () => {
        for (const f of ['components/ui/Toast.tsx', 'components/ui/NavigationProgressDifferee.tsx']) {
            const src = read(f);
            assert.match(src, /import \{ warmWhenIdle \} from '@\/lib\/ui\/warm-when-idle';/, f);
            assert.match(src, /useEffect\(\(\) => warmWhenIdle\(/, f);
            assert.doesNotMatch(src, /requestIdleCallback/, f);
        }
    });

    test('warmWhenIdle attend la fin de l’écran de chargement marqué, avec garde-fou, et rien sans réseau', () => {
        const src = read('lib/ui/warm-when-idle.ts');
        assert.match(src, /export const HOLD_WARM_ATTR = 'data-ev-hold-warm';/);
        assert.match(src, /new MutationObserver\(/);
        assert.match(src, /maxHoldMs = 20_000/);
        assert.match(src, /navigator\.onLine === false\) return;/);
        assert.match(src, /cancelIdleCallback/);
    });

    test('scanner : l’écran « Chargement de vos événements… » retient les préchargements', () => {
        const src = read('app/controller/scanner/page.tsx');
        const i = src.indexOf('    if (loading) {');
        assert.ok(i > 0);
        const block = src.slice(i, src.indexOf('    }\n', i));
        assert.match(block, /\{\.\.\.\{ \[HOLD_WARM_ATTR\]: '' \}\}/);
        assert.match(block, /Chargement de vos événements…/);
    });
});
