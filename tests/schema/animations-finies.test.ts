/**
 * Décision du 18/11 — règle pour toute l'application : aucune animation en boucle infinie.
 *  - classes Tailwind animate-pulse, animate-ping : 3 cycles puis fixe (halo effacé) ; animate-spin : 10 tours puis fixe ;
 *  - point « En cours » : 3 pulsations puis fixe, en pause tant qu'il n'est pas à l'écran (lib/ui/live-dots.ts) ;
 *  - Mes billets : plus de barre animée du pas du code, QR en attente = squelette fixe ;
 *  - aucune autre animation infinie (CSS, styles en ligne, SVG animés) dans app/ et components/.
 * Mesure de l'effet : perf/rendu-mes-billets.tsv (scripts/e2e/perf-mobile.mjs, même run, avant / après).
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { renderWorkFromTrace } from '../../scripts/e2e/perf-mobile-seuils.mjs';

const ROOT = process.cwd();
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
const walk = (dir: string): string[] => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) return walk(rel);
    return /\.(tsx?|css)$/.test(e.name) ? [rel] : [];
});

describe('aucune animation en boucle infinie', () => {
    test('classes Tailwind finies', () => {
        const cfg = read('tailwind.config.ts');
        assert.match(cfg, /pulse: 'pulse 2s cubic-bezier\(0\.4, 0, 0\.6, 1\) 3',/);
        assert.match(cfg, /ping: 'ping 1s cubic-bezier\(0, 0, 0\.2, 1\) 3 forwards',/);
        assert.match(cfg, /spin: 'spin 1s linear 10',/);
    });

    test('point « En cours » : 3 pulsations, en pause hors de l’écran', () => {
        const css = read('app/globals.css');
        assert.match(css, /animation: evLivePulse 1\.6s var\(--ease-out\) 3 both;\n\s*animation-play-state: paused;/);
        assert.match(css, /\.ev-live-dot\[data-ev-onscreen\]::after \{\n\s*animation-play-state: running;/);
        const dots = read('lib/ui/live-dots.ts');
        assert.match(dots, /new IntersectionObserver\(/);
        assert.match(dots, /setAttribute\('data-ev-onscreen', ''\)/);
        assert.match(dots, /removeAttribute\('data-ev-onscreen'\)/);
        assert.match(read('components/events/useLiveNow.ts'), /useEffect\(\(\) => \(live \? watchLiveDots\(\) : undefined\), \[live\]\);/);
        assert.match(read('components/events/CardLiveBadge.tsx'), /const stopDots = watchLiveDots\(\);/);
    });

    test('Mes billets : ni barre animée ni QR qui pulse', () => {
        const card = read('components/tickets/TicketCard.tsx');
        assert.doesNotMatch(card, /animate-pulse|duration-1000|QrProgress/);
        assert.match(card, /data-ev-qr-wait=""/);
    });

    test('aucune animation infinie ailleurs (CSS, styles en ligne, SVG animés)', () => {
        const offenders: string[] = [];
        for (const f of [...walk('app'), ...walk('components'), 'tailwind.config.ts']) {
            const src = read(f);
            if (/\binfinite\b/.test(src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, ''))) offenders.push(f);
            if (/repeatCount=|<animate\b/.test(src)) offenders.push(`${f} (SVG animé)`);
        }
        assert.deepEqual(offenders, []);
    });

    test('mesure du rendu : fil principal de la page seulement', () => {
        const r = renderWorkFromTrace({ traceEvents: [
            { ph: 'M', name: 'thread_name', pid: 1, tid: 2, args: { name: 'CrRendererMain' } },
            { ph: 'X', name: 'Paint', pid: 1, tid: 2, dur: 5_000 },
            { ph: 'X', name: 'UpdateLayoutTree', pid: 1, tid: 2, dur: 2_000 },
            { ph: 'X', name: 'Layout', pid: 1, tid: 2, dur: 1_000 },
            { ph: 'X', name: 'Paint', pid: 1, tid: 9, dur: 9_000 },
        ] });
        assert.deepEqual(r, { styleMs: 3, paintMs: 5 });
        assert.match(read('scripts/e2e/perf-mobile.mjs'), /for \(const variant of \['avant', 'apres'\]\)/);
    });
});
