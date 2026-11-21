/**
 * Design 1e (point 4) — couleur des affiches : la couleur VIVE de l'affiche (forte saturation, à la manière d'une palette
 * « vibrant / muted ») plutôt que la dominante, qui tombe souvent sur un fond clair ; gris seulement pour une affiche
 * vraiment sans couleur ; contraste ≥ 4,5:1 avec le blanc inchangé. Script des affiches existantes : toujours rejouable,
 * lancé avec npx tsx --env-file=.env.local (docs/essai-local.md). Sortie brute `[D1E-AFFICHES]`.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import sharp, { type OverlayOptions } from 'sharp';
import { computePosterStyle } from '../../lib/images/poster-style';
import { contrastWithWhite, hexToRgb, pickPosterColor, type Rgb } from '../../lib/events/poster-color';

const ROOT = process.cwd();
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, ...rel.split('/')), 'utf8').replace(/\r\n/g, '\n');

function hsl({ r, g, b }: Rgb): { h: number; s: number } {
    const [R, G, B] = [r / 255, g / 255, b / 255];
    const max = Math.max(R, G, B); const min = Math.min(R, G, B); const d = max - min; const l = (max + min) / 2;
    if (d === 0) return { h: 0, s: 0 };
    const s = d / (1 - Math.abs(2 * l - 1));
    const h = max === R ? 60 * (((G - B) / d) % 6) : max === G ? 60 * ((B - R) / d + 2) : 60 * ((R - G) / d + 4);
    return { h: (h + 360) % 360, s };
}
const hueGap = (a: number, b: number): number => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

/** Affiche 400 × 500 : fond, puis bandes horizontales [couleur, part de la hauteur]. */
async function poster(bg: string, bands: Array<[string, number]>): Promise<Buffer> {
    const W = 400; const H = 500;
    const parts: OverlayOptions[] = [];
    let y = 40;
    for (const [color, share] of bands) {
        const h = Math.max(1, Math.round(H * share));
        parts.push({ input: { create: { width: W - 80, height: h, channels: 3, background: color } }, top: y, left: 40 });
        y += h;
    }
    return sharp({ create: { width: W, height: H, channels: 3, background: bg } }).composite(parts).jpeg({ quality: 90 }).toBuffer();
}

async function colorOf(name: string, buf: Buffer): Promise<Rgb> {
    const { color } = await computePosterStyle(buf);
    const rgb = hexToRgb(color)!;
    const { h, s } = hsl(rgb);
    console.log(`[D1E-AFFICHES] ${name} → ${color} (teinte ${h.toFixed(0)}°, saturation ${s.toFixed(2)}, contraste blanc ${contrastWithWhite(rgb).toFixed(2)})`);
    assert.ok(contrastWithWhite(rgb) >= 4.5, `${name} : contraste ${contrastWithWhite(rgb).toFixed(2)} < 4,5`);
    return rgb;
}

describe('design 1e — couleur vive des affiches', () => {
    test('fond blanc dominant, sujet rouge-orangé : la couleur vive l’emporte sur le fond (plus de gris)', async () => {
        const rgb = await colorOf('fond blanc, sujet rouge-orangé', await poster('#ffffff', [['#e8452c', 0.2], ['#1a1a1a', 0.05]]));
        const { h, s } = hsl(rgb);
        assert.ok(s >= 0.5, `saturation ${s.toFixed(2)} : couleur vive attendue`);
        assert.ok(hueGap(h, hsl({ r: 0xe8, g: 0x45, b: 0x2c }).h) <= 12, `teinte ${h.toFixed(0)}° : celle du sujet attendue`);
    });

    test('fond crème, bleu et jaune vifs : une des deux couleurs vives, jamais le crème', async () => {
        const rgb = await colorOf('fond crème, bleu et jaune', await poster('#f4efe6', [['#1d4ed8', 0.16], ['#facc15', 0.12]]));
        const { h, s } = hsl(rgb);
        assert.ok(s >= 0.5, `saturation ${s.toFixed(2)}`);
        assert.ok(hueGap(h, 224) <= 15 || hueGap(h, 48) <= 15, `teinte ${h.toFixed(0)}° : bleu ou jaune attendu`);
    });

    test('affiche sombre aux tons sourds : la couleur sourde (« muted »), pas le noir', async () => {
        const rgb = await colorOf('fond noir, prune sourde', await poster('#0d0d0d', [['#6b3f5c', 0.3]]));
        const { h, s } = hsl(rgb);
        assert.ok(s >= 0.2, `saturation ${s.toFixed(2)} : teinte gardée`);
        assert.ok(hueGap(h, hsl({ r: 0x6b, g: 0x3f, b: 0x5c }).h) <= 15, `teinte ${h.toFixed(0)}°`);
    });

    test('affiche vraiment sans couleur (noir, blanc, gris) : gris', async () => {
        const rgb = await colorOf('noir et blanc', await poster('#ffffff', [['#000000', 0.3], ['#9a9a9a', 0.2]]));
        assert.ok(hsl(rgb).s <= 0.08, 'gris attendu');
    });

    test('quelques pixels de couleur perdus (< 1 %) : la couleur n’est pas inventée, gris', () => {
        const px = new Uint8Array(100 * 100 * 3).fill(250);
        for (let i = 0; i < 50; i += 1) { px[i * 3] = 230; px[i * 3 + 1] = 30; px[i * 3 + 2] = 30; }
        const c = pickPosterColor(px);
        assert.ok(hsl(c).s <= 0.08, `gris attendu (${JSON.stringify(c)})`);
    });

    test('les cas du design 1d restent lisibles (aplats, transparence, rayures) : test 1 de design1d-vitrine inchangé', () => {
        assert.match(read('tests/schema/design1d-vitrine.test.ts'), /for \(const bg of \['#ffffff', '#ff8a3d', '#1dc8f2', '#ffee00', '#101010', '#14213d'\]\)/);
    });

    test('le calcul passe par la couleur vive (dépôt, réencodage, script des affiches existantes)', () => {
        const src = read('lib/images/poster-style.ts');
        assert.match(src, /pickPosterColor\(/);
        assert.doesNotMatch(src, /stats\(\)/, 'plus de couleur dominante de sharp');
        assert.match(read('lib/events/poster-styles-backfill.ts'), /computePosterStyle/);
    });

    test('script des affiches existantes : rejouable, lancé avec npx tsx --env-file=.env.local (essai local)', () => {
        assert.match(read('docs/essai-local.md'), /npx tsx --env-file=\.env\.local scripts\/poster-styles\.ts/);
        assert.match(read('scripts/poster-styles.ts'), /npx tsx --env-file=\.env\.local scripts\/poster-styles\.ts/);
        assert.match(read('lib/events/poster-styles-backfill.ts'), /\.is\('poster_color', null\)/, 'rejouable : seules les affiches sans couleur');
    });
});
