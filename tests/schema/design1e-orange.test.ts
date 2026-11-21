/**
 * Design 1e (point 1) — orange de marque : chaque paire couleur / texte des jetons d'app/globals.css, en clair (:root)
 * et en sombre (.dark), contre les seuils de la consigne (WCAG 2.x) :
 *  - bouton principal : orange plein, texte blanc GRAS d'au moins 19 px (« grand texte ») ≥ 3:1, au repos et au survol ;
 *  - petits boutons et pastilles sur orange : texte #1A1A1A ≥ 4,5:1 ;
 *  - bouton secondaire : fond de carte, texte orange foncé ; petits textes orange (liens, « Voir tout ») ≥ 4,5:1 sur
 *    tous les fonds où ils se posent ;
 *  - dégradé signature tout orange (orange de marque → orange profond), texte blanc gras ≥ 19 px, ≥ 3:1 sur TOUTE sa
 *    longueur (21 positions, interpolation sRGB comme le navigateur), plus de rose ;
 *  - mode sombre : même orange sur fond noir profond.
 * Sortie brute `[D1E-ORANGE]` (une ligne par paire), reprise au rapport.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, ...rel.split('/')), 'utf8').replace(/\r\n/g, '\n');

type Rgb = [number, number, number];

/** Déclarations `--nom: r g b;` d'un bloc CSS (premier `selecteur {`, jusqu'à son accolade fermante). */
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

const css = read('app/globals.css');
const LIGHT = block(css, ':root');
const DARK = { ...LIGHT, ...block(css, '.dark') };
const THEMES = [['clair', LIGHT], ['sombre', DARK]] as const;

function rgb(vars: Record<string, string>, name: string): Rgb {
    const raw = vars[name];
    assert.ok(raw, `--${name} absent`);
    const m = raw.match(/^(\d{1,3}) (\d{1,3}) (\d{1,3})$/);
    assert.ok(m, `--${name} = ${raw} : canaux « r g b » attendus`);
    return [Number(m[1]), Number(m[2]), Number(m[3])];
}
const hex = (c: Rgb): string => `#${c.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
const lin = (v: number): number => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = ([r, g, b]: Rgb): number => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a: Rgb, b: Rgb): number => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const mix = (a: Rgb, b: Rgb, t: number): Rgb => a.map((v, i) => Math.round(v + (b[i] - v) * t)) as Rgb;
function hsl([r, g, b]: Rgb): { h: number; s: number; l: number } {
    const [R, G, B] = [r / 255, g / 255, b / 255];
    const max = Math.max(R, G, B); const min = Math.min(R, G, B); const l = (max + min) / 2; const d = max - min;
    if (d === 0) return { h: 0, s: 0, l };
    const s = d / (1 - Math.abs(2 * l - 1));
    const h = max === R ? 60 * (((G - B) / d) % 6) : max === G ? 60 * ((B - R) / d + 2) : 60 * ((R - G) / d + 4);
    return { h: (h + 360) % 360, s, l };
}
const fr = (n: number): string => n.toFixed(2).replace('.', ',');

/** [libellé, texte, fonds, seuil] : seuil 3 = grand texte (blanc gras ≥ 19 px), 4,5 = texte courant. */
const PAIRS: Array<[string, string, string[], number]> = [
    ['bouton principal (blanc gras ≥ 19 px)', 'primary-foreground-large', ['primary', 'primary-hover'], 3],
    ['petits boutons et pastilles sur orange (#1A1A1A)', 'primary-foreground', ['primary', 'primary-hover'], 4.5],
    ['texte sur l’orange de la marque (#1A1A1A)', 'brand-foreground', ['brand'], 4.5],
    ['orange foncé en texte (liens, « Voir tout », bouton secondaire)', 'primary-text', ['background', 'card', 'popover', 'muted', 'primary-soft'], 4.5],
];

describe('design 1e — orange de marque : paires couleur / texte des jetons', () => {
    for (const [theme, vars] of THEMES) {
        test(`${theme} : chaque paire tient son seuil`, () => {
            const faults: string[] = [];
            for (const [label, text, bgs, min] of PAIRS) {
                for (const bg of bgs) {
                    const r = ratio(rgb(vars, text), rgb(vars, bg));
                    console.log(`[D1E-ORANGE] ${theme} · ${label} : --${text} ${hex(rgb(vars, text))} sur --${bg} ${hex(rgb(vars, bg))} = ${fr(r)}:1 (seuil ${fr(min)}:1)`);
                    if (r < min) faults.push(`${label} : --${text} sur --${bg} ${fr(r)}:1 < ${fr(min)}:1`);
                }
            }
            assert.deepEqual(faults, []);
        });

        test(`${theme} : dégradé signature tout orange, blanc ≥ 3:1 sur toute sa longueur`, () => {
            const from = rgb(vars, 'gradient-from');
            const to = rgb(vars, 'gradient-to');
            const white = rgb(vars, 'gradient-foreground');
            assert.deepEqual(white, [255, 255, 255], 'texte du dégradé : blanc');
            let worst = Infinity;
            let worstAt = '';
            for (let i = 0; i <= 20; i += 1) {
                const c = mix(from, to, i / 20);
                const r = ratio(white, c);
                if (r < worst) { worst = r; worstAt = hex(c); }
            }
            console.log(`[D1E-ORANGE] ${theme} · dégradé ${hex(from)} → ${hex(to)} : blanc au pire point ${worstAt} = ${fr(worst)}:1 (seuil 3,00:1)`);
            assert.ok(worst >= 3, `dégradé : ${fr(worst)}:1 au pire point ${worstAt}`);
            for (const [n, c] of [['départ', from], ['arrivée', to]] as const) {
                const { h, s } = hsl(c);
                assert.ok(h >= 10 && h <= 30 && s >= 0.7, `${n} du dégradé ${hex(c)} : orange vif attendu (teinte ${h.toFixed(1)}°, saturation ${s.toFixed(2)}), plus de rose`);
            }
            assert.deepEqual(from, rgb(vars, 'brand'), 'le dégradé part de l’orange de la marque');
            assert.ok(lum(to) < lum(from), 'le dégradé finit sur un orange plus profond');
        });
    }

    test('orange de la marque : proche de la référence du client (≈ #F26522), plus profond et plus vif que #FF8A3D, même orange en sombre', () => {
        const brand = rgb(LIGHT, 'brand');
        const { h, s } = hsl(brand);
        const ref = hsl([0xF2, 0x65, 0x22]);
        console.log(`[D1E-ORANGE] orange de la marque ${hex(brand)} : teinte ${h.toFixed(1)}° (référence ${ref.h.toFixed(1)}°), saturation ${s.toFixed(2)}, blanc ${fr(ratio(brand, [255, 255, 255]))}:1, #1A1A1A ${fr(ratio(brand, [26, 26, 26]))}:1`);
        assert.ok(Math.abs(h - ref.h) <= 3, `teinte ${h.toFixed(1)}° trop loin de la référence (${ref.h.toFixed(1)}°)`);
        assert.ok(s >= 0.85, `saturation ${s.toFixed(2)} : orange vif attendu`);
        assert.ok(lum(brand) < lum([0xFF, 0x8A, 0x3D]), 'plus profond que l’ancien #FF8A3D');
        assert.deepEqual(rgb(DARK, 'brand'), brand, 'même orange en sombre');
        assert.deepEqual(rgb(LIGHT, 'primary'), brand, 'bouton principal = orange de la marque (clair)');
        assert.deepEqual(rgb(DARK, 'primary'), brand, 'bouton principal = orange de la marque (sombre)');
        assert.deepEqual(rgb(LIGHT, 'ring'), brand, 'anneau de focus : orange de la marque');
        assert.deepEqual(rgb(LIGHT, 'primary-foreground'), [26, 26, 26], 'petits boutons : texte #1A1A1A');
        assert.deepEqual(rgb(LIGHT, 'primary-foreground-large'), [255, 255, 255], 'bouton principal : texte blanc');
        assert.deepEqual(rgb(DARK, 'background'), [18, 18, 18], 'sombre : fond noir profond #121212');
        const text = hsl(rgb(LIGHT, 'primary-text'));
        assert.ok(text.h >= 12 && text.h <= 30, 'orange foncé en texte (≈ #C2410C)');
        assert.equal(hex(rgb(LIGHT, 'primary-text')), '#C2410C', 'orange foncé des petits textes en clair : #C2410C');
    });

    test('Button : principal plein, blanc gras de 19 px en grande taille seulement ; secondaire fond de carte et texte orange foncé', () => {
        const src = read('components/ui/Button.tsx');
        assert.match(src, /primary: 'bg-primary text-primary-foreground[^']*'/, 'principal : fond orange, texte #1A1A1A (petites tailles)');
        assert.match(src, /secondary: 'bg-card text-primary-text[^']*'/, 'secondaire : fond de carte, texte orange foncé');
        const large = src.match(/const PRIMARY_LARGE = '([^']+)'/);
        assert.ok(large, 'PRIMARY_LARGE (grande taille du bouton principal) introuvable');
        for (const cls of ['text-primary-foreground-large', 'font-bold', 'text-[1.1875rem]']) assert.ok(large[1].includes(cls), `grande taille : ${cls} attendu (${large[1]})`);
        assert.match(src, /variant === 'primary' && size === 'lg' && PRIMARY_LARGE/, 'blanc seulement pour le principal en grande taille');
        assert.doesNotMatch(src, /text-white/, 'aucun blanc écrit en dur');
    });

    test('plus aucune trace de l’ancien orange ni du rose du dégradé dans l’application', () => {
        const files = ['app/globals.css', 'app/global-error.tsx', 'lib/og/event-preview.server.tsx', 'components/ui/Button.tsx', 'docs/design/jetons.css'];
        const faults = files.filter((f) => /#FF8A3D|255 138 61|#DB2777|219 39 119|219, 39, 119/i.test(read(f)));
        assert.deepEqual(faults, [], `ancien orange ou rose encore présent : ${faults.join(', ')}`);
    });
});

describe('design 1e — blanc sur l’orange seulement en grand texte (run 537 : boutons du scanner en blanc de 14 px, 3,39:1)', () => {
    test('bouton principal en grande taille dont la classe locale réduit le texte : #1A1A1A, jamais le blanc', async () => {
        const { buttonClasses } = await import('../../components/ui/Button');
        const big = buttonClasses({ variant: 'primary', size: 'lg' });
        assert.match(big, /text-primary-foreground-large/);
        assert.match(big, /text-\[1\.1875rem\]/);
        for (const local of ['text-sm', 'text-base', 'text-lg']) {
            const c = buttonClasses({ variant: 'primary', size: 'lg', className: local });
            assert.doesNotMatch(c, /text-primary-foreground-large/, `${local} : blanc sur orange sous 19 px`);
            assert.match(c, /(^|\s)text-primary-foreground(\s|$)/, `${local} : texte #1A1A1A attendu`);
        }
        assert.doesNotMatch(buttonClasses({ variant: 'primary', size: 'md' }), /text-primary-foreground-large/);
    });
});
