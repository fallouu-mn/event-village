/**
 * Design 1a (point 1) — jetons de couleur de la charte, en clair et en sombre.
 *
 * 1. Contraste : docs/design/outils/contraste.mjs --verifier (mesure WCAG 2.x de tous les couples de
 *    docs/design/jetons.css, boutons B en clair et A en sombre) sort sans erreur : aucun couple obligatoire sous son seuil.
 * 2. Ce que l'application affiche est ce qui est mesuré : chaque jeton de la charte d'app/globals.css (canaux « r g b »)
 *    vaut exactement la valeur de jetons.css, dans le bloc clair (:root) et dans le bloc sombre (.dark).
 * 3. Tailwind expose les noms de la charte (classes bg-background, text-foreground, bg-primary…).
 * Sortie brute `[DESIGN-JETONS]`.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, ...rel.split('/')), 'utf8').replace(/\r\n/g, '\n');

/** Jetons de couleur de la charte comparés un à un (les ombres et durées ne sont pas des couleurs). */
const COLOR_TOKENS = [
    'background', 'foreground', 'foreground-strong', 'card', 'popover', 'muted', 'muted-foreground', 'border', 'input',
    'ring', 'ring-halo', 'brand', 'brand-foreground', 'primary', 'primary-hover', 'primary-foreground', 'primary-text',
    'primary-soft', 'accent-text', 'gradient-from', 'gradient-to', 'gradient-foreground',
    'success', 'success-soft', 'success-text', 'success-border', 'warning', 'warning-soft', 'warning-text', 'warning-border',
    'danger', 'danger-soft', 'danger-text', 'danger-border', 'info', 'info-soft', 'info-text', 'info-border',
    'on-tone', 'op-wave', 'op-orange-money', 'on-op', 'op-logo',
];

/** Déclarations `--nom: valeur;` d'un bloc (premier `selecteur {` trouvé, jusqu'à l'accolade fermante). */
function block(css: string, selector: string): Record<string, string> {
    const start = css.indexOf(`${selector} {`);
    assert.ok(start >= 0, `bloc ${selector} introuvable`);
    let depth = 0;
    let end = start;
    for (let i = css.indexOf('{', start); i < css.length; i += 1) {
        if (css[i] === '{') depth += 1;
        if (css[i] === '}') { depth -= 1; if (depth === 0) { end = i; break; } }
    }
    const body = css.slice(start, end).replace(/\/\*[\s\S]*?\*\//g, '');
    const out: Record<string, string> = {};
    for (const m of body.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
    return out;
}

function hexToChannels(hex: string): string {
    const h = hex.replace('#', '');
    return [0, 2, 4].map((i) => String(parseInt(h.slice(i, i + 2), 16))).join(' ');
}

describe('design 1a — jetons de la charte', () => {
    test('1. contrastes : contraste.mjs --verifier, aucun couple obligatoire sous son seuil', () => {
        const r = spawnSync(process.execPath, ['docs/design/outils/contraste.mjs', '--verifier'], { cwd: ROOT, encoding: 'utf8' });
        const summary = (r.stdout ?? '').trim().split('\n').pop() ?? '';
        console.log(`[DESIGN-JETONS] ${summary}`);
        assert.equal(r.status, 0, `contraste.mjs en échec :\n${r.stdout}\n${r.stderr}`);
        assert.match(summary, /, 0 sous le seuil\.$/);
    });

    test('2. app/globals.css : chaque jeton de couleur vaut celui de jetons.css, en clair et en sombre', () => {
        const ref = read('docs/design/jetons.css');
        const app = read('app/globals.css');
        const refLight = block(ref, ':root');
        const refDark = { ...refLight, ...block(ref, ":root[data-theme='dark']") };
        const appLight = block(app, ':root');
        const appDark = { ...appLight, ...block(app, '.dark') };
        const faults: string[] = [];
        for (const [theme, r, a] of [['clair', refLight, appLight], ['sombre', refDark, appDark]] as const) {
            for (const name of COLOR_TOKENS) {
                const want = r[name];
                assert.ok(want && /^#[0-9A-Fa-f]{6}$/.test(want), `jetons.css : --${name} (${theme}) absent ou pas en #RRGGBB : ${want}`);
                const got = a[name];
                if (got !== hexToChannels(want)) faults.push(`--${name} (${theme}) : app ${got ?? 'absent'}, charte ${want} (${hexToChannels(want)})`);
            }
        }
        console.log(`[DESIGN-JETONS] ${COLOR_TOKENS.length * 2} valeurs comparées ; écarts : ${faults.length === 0 ? 'aucun' : faults.join(' ; ')}`);
        assert.deepEqual(faults, []);
    });

    test('3. tailwind.config.ts expose les noms de la charte', () => {
        const tw = read('tailwind.config.ts');
        const missing = ['background', 'foreground', 'card', 'popover', 'muted', 'input', 'primary', 'brand-vif', 'gradient']
            .filter((k) => !new RegExp(`^\\s+'?${k}'?: `, 'm').test(tw));
        assert.deepEqual(missing, [], `noms absents de tailwind.config.ts : ${missing.join(', ')}`);
    });
});
