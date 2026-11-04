/**
 * Lot 7, tâche 7.0 e (contrat §4.5, D24) — génère les icônes opaques de l'application installable :
 *  - public/icons/icon-maskable-512.png : 512×512, PNG de type de couleur 2 (RVB, sans alpha ni tRNS),
 *    fond plein, motif entièrement dans le cercle de sécurité (rayon 40 %, 409,6 px de diamètre) ;
 *  - public/icons/apple-touch-icon.png : 180×180, opaque (iOS remplit la transparence en noir).
 *
 * Dessin : celui des icônes « any » existantes (public/icon-512x512.png : disque #FF5722 et centre blanc,
 * rapport des rayons 78/256). Le fond orange couvre tout le carré, le centre blanc reste au milieu : une fois
 * rognée par le masque du lanceur (cercle, carré arrondi), l'icône a le même aspect que l'icône « any ».
 * Couleurs du système de design (design-system/event-village/MASTER.md) : brand-decor #FF5722 (décor, aucun
 * texte) et on-tone #FFFFFF ; jamais l'ancien dégradé #FF6A3D → #FF3D68 (MASTER.md, interdit). Choix tracé
 * par ui-ux-pro-max : docs/lot7-logs/ui-ux-pro-max/A3-001-icones-pwa.txt et A3-002-icones-couleur.txt.
 *
 * Rendu par Chromium (Playwright, déjà en devDependencies : aucune dépendance nouvelle), page.setContent(svg)
 * puis screenshot ; la capture est décodée, chaque pixel est contrôlé opaque, puis réencodée en RVB (type 2).
 * Lancé une fois à la main, les PNG produits sont committés :
 *     node scripts/generate-pwa-icons.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { chromium } from 'playwright';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'public', 'icons');

const BRAND_DECOR = '#FF5722';
const ON_TONE = '#FFFFFF';
/** Rayon du centre blanc rapporté au demi-côté (icône « any » : 78 px sur 256). */
const CENTER_RATIO = 78 / 256;

const ICONS = [
    { file: 'icon-maskable-512.png', size: 512 },
    { file: 'apple-touch-icon.png', size: 180 },
];

function svgFor(size) {
    const half = size / 2;
    const r = (CENTER_RATIO * half).toFixed(3);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`
        + `<rect x="0" y="0" width="${size}" height="${size}" fill="${BRAND_DECOR}"/>`
        + `<circle cx="${half}" cy="${half}" r="${r}" fill="${ON_TONE}"/>`
        + '</svg>';
}

// ── PNG : décodage (8 bits, sans entrelacement) et encodage RVB ─────────────

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
});

function crc32(buf) {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    out.write(type, 4, 'latin1');
    data.copy(out, 8);
    out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
    return out;
}

function decodePng(buf, label) {
    if (buf.toString('latin1', 12, 16) !== 'IHDR') throw new Error(`${label} : PNG sans IHDR`);
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    const bitDepth = buf[24];
    const colorType = buf[25];
    const interlace = buf[28];
    const channels = { 2: 3, 6: 4 }[colorType];
    if (!channels || bitDepth !== 8 || interlace !== 0) {
        throw new Error(`${label} : PNG non pris en charge (type ${colorType}, ${bitDepth} bits, entrelacement ${interlace})`);
    }
    const parts = [];
    for (let off = 8; off + 8 <= buf.length;) {
        const len = buf.readUInt32BE(off);
        const type = buf.toString('latin1', off + 4, off + 8);
        if (type === 'IDAT') parts.push(buf.subarray(off + 8, off + 8 + len));
        if (type === 'IEND') break;
        off += 12 + len;
    }
    const raw = zlib.inflateSync(Buffer.concat(parts));
    const stride = width * channels;
    const px = Buffer.alloc(stride * height);
    for (let y = 0; y < height; y++) {
        const filter = raw[y * (stride + 1)];
        for (let x = 0; x < stride; x++) {
            const a = x >= channels ? px[y * stride + x - channels] : 0;
            const b = y > 0 ? px[(y - 1) * stride + x] : 0;
            const c = x >= channels && y > 0 ? px[(y - 1) * stride + x - channels] : 0;
            const v = raw[y * (stride + 1) + 1 + x];
            let r;
            if (filter === 0) r = v;
            else if (filter === 1) r = v + a;
            else if (filter === 2) r = v + b;
            else if (filter === 3) r = v + ((a + b) >> 1);
            else if (filter === 4) {
                const p = a + b - c;
                const pa = Math.abs(p - a);
                const pb = Math.abs(p - b);
                const pc = Math.abs(p - c);
                r = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
            } else throw new Error(`${label} : filtre PNG inconnu ${filter} (ligne ${y})`);
            px[y * stride + x] = r & 0xff;
        }
    }
    return { width, height, channels, px };
}

/** RVB opaque : refuse tout pixel dont l'alpha n'est pas 255 (jamais de transparence aplatie en silence). */
function toOpaqueRgb(img, label) {
    const rgb = Buffer.alloc(img.width * img.height * 3);
    let transparent = 0;
    for (let i = 0, j = 0; i < img.px.length; i += img.channels, j += 3) {
        if (img.channels === 4 && img.px[i + 3] !== 255) transparent++;
        rgb[j] = img.px[i];
        rgb[j + 1] = img.px[i + 1];
        rgb[j + 2] = img.px[i + 2];
    }
    if (transparent > 0) throw new Error(`${label} : ${transparent} pixel(s) non opaques dans la capture`);
    return rgb;
}

function encodeRgbPng(width, height, rgb) {
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8; // 8 bits par canal
    ihdr[9] = 2; // type de couleur 2 : RVB, sans alpha
    ihdr[10] = 0;
    ihdr[11] = 0;
    ihdr[12] = 0;
    const stride = width * 3;
    const raw = Buffer.alloc((stride + 1) * height);
    for (let y = 0; y < height; y++) {
        raw[y * (stride + 1)] = 0; // filtre 0 (aucun)
        rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
    }
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', ihdr),
        chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
        chunk('IEND', Buffer.alloc(0)),
    ]);
}

// ── Rendu ──────────────────────────────────────────────────────────────────

async function main() {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const browser = await chromium.launch();
    try {
        for (const icon of ICONS) {
            const page = await browser.newPage({ viewport: { width: icon.size, height: icon.size }, deviceScaleFactor: 1 });
            try {
                await page.setContent(`<!doctype html><html><head><style>html,body{margin:0;padding:0;background:${BRAND_DECOR}}svg{display:block}</style></head><body>${svgFor(icon.size)}</body></html>`);
                const shot = await page.screenshot({ type: 'png', omitBackground: false, clip: { x: 0, y: 0, width: icon.size, height: icon.size } });
                const img = decodePng(shot, icon.file);
                if (img.width !== icon.size || img.height !== icon.size) {
                    throw new Error(`${icon.file} : capture de ${img.width}×${img.height} au lieu de ${icon.size}×${icon.size}`);
                }
                const png = encodeRgbPng(icon.size, icon.size, toOpaqueRgb(img, icon.file));
                const out = path.join(OUT_DIR, icon.file);
                fs.writeFileSync(out, png);
                console.log(`[icônes PWA] ${path.relative(ROOT, out).replace(/\\/g, '/')} : ${icon.size}×${icon.size}, RVB opaque, ${png.length} octets`);
            } finally {
                await page.close();
            }
        }
    } finally {
        await browser.close();
    }
}

main().catch((err) => {
    console.error('[icônes PWA] génération impossible :', err instanceof Error ? err.message : err);
    process.exitCode = 1;
});
