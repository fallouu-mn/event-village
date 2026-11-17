// Event Village — logo retenu « Bras levés » (décision du 17/11/2026) : génération des SVG et des PNG.
//
// Symbole dessiné à la main ci-dessous (grille de 64 × 64) : deux billets levés comme des bras forment le V de Village,
// la tête au milieu. Deux dessins : NORMAL (64 px et plus) et RÉDUIT (16 à 48 px : bras plus écartés, tête plus petite
// et plus haute, filets plus larges, pour que la tête et les deux bras restent distincts à 16 px).
// Le nom est vectorisé depuis la police de l'application (app/fonts/plus-jakarta-sans-latin-wght-normal.woff2, OFL).
// Dégradé de la charte (#EA580C → #DB2777) sur le symbole et l'icône seulement (décision 6).
//
// Lancer depuis la racine du dépôt :
//   OUTILS_POLICE=<dossier avec node_modules/fontkit@2.0.4 et wawoff2@2.0.1> \
//   DEPENDANCES=<node_modules contenant sharp> node docs/design/outils/logos.mjs
// Sortie : docs/design/logo/svg/ (SVG) et docs/design/logo/export/ (favicons, PWA, Apple, image de partage).

import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const dossierSvg = join(racine, 'docs/design/logo/svg');
const dossierExport = join(racine, 'docs/design/logo/export');
if (!process.env.OUTILS_POLICE || !process.env.DEPENDANCES) throw new Error('OUTILS_POLICE et DEPENDANCES sont requis (voir l\'en-tête).');
const reqPolice = createRequire(join(process.env.OUTILS_POLICE, 'package.json'));
const fontkit = reqPolice('fontkit');
const wawoff2 = reqPolice('wawoff2');
const sharp = createRequire(join(process.env.DEPENDANCES, 'x.js'))('sharp');

const C = { de: '#EA580C', a: '#DB2777', deSombre: '#FF8A3D', aSombre: '#F0509A', encre: '#1A1A1A', blanc: '#FFFFFF', nuit: '#121212' };
const r2 = (n) => Math.round(n * 100) / 100;
const fmt = (s) => s.replace(/-?\d+\.\d+|-?\d+/g, (m) => String(r2(Number(m))));
const cercle = (cx, cy, r) => `M${r2(cx - r)} ${r2(cy)}a${r2(r)} ${r2(r)} 0 1 0 ${r2(2 * r)} 0a${r2(r)} ${r2(r)} 0 1 0 ${r2(-2 * r)} 0Z`;

// ── Nom vectorisé ────────────────────────────────────────────────────────────
const police = fontkit.create(Buffer.from(await wawoff2.decompress(readFileSync(join(racine, 'app/fonts/plus-jakarta-sans-latin-wght-normal.woff2')))));
function nom(texte, graisse, cap, approche) {
    const f = police.getVariation({ wght: graisse });
    const run = f.layout(texte);
    const s = cap / police.capHeight;
    let x = 0;
    let bas = 0;
    let haut = 0;
    const parts = [];
    run.glyphs.forEach((g, i) => {
        const p = g.path.transform(s, 0, 0, -s, x, 0);
        if (Number.isFinite(p.bbox.minY)) { haut = Math.min(haut, p.bbox.minY); bas = Math.max(bas, p.bbox.maxY); }
        parts.push(p.toSVG());
        x += run.positions[i].xAdvance * s + approche * cap;
    });
    return { d: fmt(parts.join('')), largeur: x - approche * cap, haut, bas };
}

// ── Le symbole ───────────────────────────────────────────────────────────────
/** Billet : rectangle arrondi l × h, bas en y = 55, centré sur x = 32. */
function billet(l, h, r) {
    const yh = 55 - h;
    const xg = 32 - l / 2;
    return `M${xg + r} ${yh}H${xg + l - r}A${r} ${r} 0 0 1 ${xg + l} ${yh + r}V${55 - r}A${r} ${r} 0 0 1 ${xg + l - r} 55H${xg + r}A${r} ${r} 0 0 1 ${xg} ${55 - r}V${yh + r}A${r} ${r} 0 0 1 ${xg + r} ${yh}Z`;
}
const DESSINS = {
    normal: { billet: billet(14, 37, 4.5), angle: 31, pivot: [32, 52], tete: [32, 21.2, 6.6], filet: 3.4, boite: [7.4, 13.8, 49.2, 44.4] },
    reduit: { billet: billet(13, 36, 4.5), angle: 34, pivot: [32, 52], tete: [32, 19.4, 6.1], filet: 4.6, boite: [6.2, 12.8, 51.6, 45.4] },
};

/**
 * Le symbole. remplissage : 'degrade' (clair), 'degrade-sombre', ou une couleur. Les deux billets sont séparés par un
 * filet transparent (masque) : on voit toujours deux bras, quelle que soit la couleur et le fond.
 */
function symbole(dessin, remplissage, id) {
    const d = DESSINS[dessin];
    const [px, py] = d.pivot;
    const b = fmt(d.billet);
    const degrade = remplissage.startsWith('degrade');
    const [de, a] = remplissage === 'degrade-sombre' ? [C.deSombre, C.aSombre] : [C.de, C.a];
    const plein = degrade ? `url(#${id}-g)` : remplissage;
    const defs = (degrade ? `<linearGradient id="${id}-g" x1="12" y1="12" x2="52" y2="58" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${de}"/><stop offset="1" stop-color="${a}"/></linearGradient>` : '') +
        `<mask id="${id}-m" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64"><rect width="64" height="64" fill="#fff"/><path transform="rotate(${d.angle} ${px} ${py})" d="${b}" fill="#000" stroke="#000" stroke-width="${d.filet}"/></mask>`;
    const corps = `<g fill="${plein}"><path mask="url(#${id}-m)" transform="rotate(${-d.angle} ${px} ${py})" d="${b}"/><path transform="rotate(${d.angle} ${px} ${py})" d="${b}"/><path d="${cercle(...d.tete)}"/></g>`;
    return { defs, corps, boite: d.boite };
}

const svg = (vb, contenu, titre = 'Event Village') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" role="img" aria-label="${titre}"><title>${titre}</title>${contenu}</svg>\n`;
const cadre = (s) => (s.defs ? `<defs>${s.defs}</defs>` : '') + s.corps;
const vbBoite = ([x, y, l, h], m = 2) => `${r2(x - m)} ${r2(y - m)} ${r2(l + 2 * m)} ${r2(h + 2 * m)}`;

mkdirSync(dossierSvg, { recursive: true });
mkdirSync(dossierExport, { recursive: true });
const ecrits = [];
const ecrire = (dossier, f, contenu) => { writeFileSync(join(dossier, f), contenu); ecrits.push(`${f} (${Buffer.byteLength(contenu)} o)`); };

// Symbole seul
for (const [suffixe, dessin, rempl] of [
    ['', 'normal', 'degrade'], ['-sombre', 'normal', 'degrade-sombre'], ['-encre', 'normal', C.encre], ['-blanc', 'normal', C.blanc],
    ['-reduit', 'reduit', 'degrade'], ['-reduit-sombre', 'reduit', 'degrade-sombre'],
]) {
    const s = symbole(dessin, rempl, `s${suffixe || '-c'}`);
    ecrire(dossierSvg, `bras-leves-symbole${suffixe}.svg`, svg(vbBoite(s.boite), cadre(s)));
}

// Logo horizontal : couleur (texte encre), sombre (texte blanc), encre, blanc
const cap = 22;
const n = nom('Event Village', 800, cap, -0.012);
const horizontal = (rempl, couleurTexte, id) => {
    const s = symbole('normal', rempl, id);
    const [bx, by, bl, bh] = s.boite;
    const xt = bx + bl + 12;
    const yBase = by + bh / 2 + cap / 2;
    const haut = Math.min(by, yBase + n.haut) - 2;
    const bas = Math.max(by + bh, yBase + n.bas) + 2;
    const vb = `${r2(bx - 2)} ${r2(haut)} ${r2(xt + n.largeur - bx + 4)} ${r2(bas - haut)}`;
    return svg(vb, cadre(s) + `<path fill="${couleurTexte}" transform="translate(${r2(xt)} ${r2(yBase)})" d="${n.d}"/>`);
};
ecrire(dossierSvg, 'bras-leves-horizontal.svg', horizontal('degrade', C.encre, 'h-c'));
ecrire(dossierSvg, 'bras-leves-horizontal-sombre.svg', horizontal('degrade-sombre', C.blanc, 'h-s'));
ecrire(dossierSvg, 'bras-leves-horizontal-encre.svg', horizontal(C.encre, C.encre, 'h-e'));
ecrire(dossierSvg, 'bras-leves-horizontal-blanc.svg', horizontal(C.blanc, C.blanc, 'h-b'));

// Icône : fond en dégradé, symbole blanc. `occupation` = part de la largeur prise par le symbole ; `arrondi` en % du côté
// (0 pour l'icône Apple et l'icône « maskable », que le système découpe lui-même).
function icone({ dessin = 'normal', occupation = 0.62, arrondi = 0.225, id = 'i' }) {
    const s = symbole(dessin, C.blanc, id);
    const [bx, by, bl, bh] = s.boite;
    const k = (64 * occupation) / Math.max(bl, bh);
    const tx = 32 - (bx + bl / 2) * k;
    const ty = 32 - (by + bh / 2) * k + 1; // un point plus bas : la tête allège le haut
    const fond = `<linearGradient id="${id}-f" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${C.de}"/><stop offset="1" stop-color="${C.a}"/></linearGradient>`;
    return svg('0 0 64 64', `<defs>${fond}${s.defs}</defs><rect width="64" height="64" rx="${r2(64 * arrondi)}" fill="url(#${id}-f)"/><g transform="translate(${r2(tx)} ${r2(ty)}) scale(${r2(k)})">${s.corps}</g>`);
}
const iconeApp = icone({ id: 'ia' });
const iconeCarree = icone({ arrondi: 0, id: 'ic' });
const iconeMasquable = icone({ arrondi: 0, occupation: 0.5, id: 'im' }); // zone sûre : cercle de 80 % (symbole dans 50 %)
ecrire(dossierSvg, 'bras-leves-icone.svg', iconeApp);
ecrire(dossierSvg, 'bras-leves-icone-carree.svg', iconeCarree);
ecrire(dossierSvg, 'bras-leves-icone-maskable.svg', iconeMasquable);

// Favicon SVG : symbole réduit, couleurs adaptées au thème du navigateur.
const fav = symbole('reduit', 'degrade', 'fv');
const favSombre = symbole('reduit', 'degrade-sombre', 'fs');
ecrire(dossierSvg, 'favicon.svg', svg(vbBoite(fav.boite, 1),
    `<style>.s{display:none}@media (prefers-color-scheme:dark){.c{display:none}.s{display:inline}}</style><defs>${fav.defs}${favSombre.defs}</defs><g class="c">${fav.corps}</g><g class="s">${favSombre.corps}</g>`));

// ── PNG ──────────────────────────────────────────────────────────────────────
const png = async (source, cote, fichier, fond) => {
    let img = sharp(Buffer.from(source), { density: Math.max(72, Math.ceil((cote / 64) * 72 * 2)) }).resize(cote, cote, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } });
    if (fond) img = img.flatten({ background: fond });
    const tampon = await img.png({ compressionLevel: 9 }).toBuffer();
    writeFileSync(join(dossierExport, fichier), tampon);
    ecrits.push(`${fichier} (${tampon.length} o)`);
    return tampon;
};
// Favicons : symbole réduit en dégradé sur fond transparent (lisible sur un onglet clair comme sombre).
const favCarre = svg('0 0 64 64', `<defs>${fav.defs}</defs><g transform="translate(0 2) scale(${r2(64 / 51.6)}) translate(-6.2 -12.8)">${fav.corps}</g>`);
const favs = [];
for (const c of [16, 32, 48]) favs.push({ c, b: await png(favCarre, c, `favicon-${c}.png`) });
// favicon.ico : les trois tailles en PNG dans un seul fichier ICO.
{
    const entete = Buffer.alloc(6 + 16 * favs.length);
    entete.writeUInt16LE(0, 0); entete.writeUInt16LE(1, 2); entete.writeUInt16LE(favs.length, 4);
    let decalage = entete.length;
    favs.forEach((f, i) => {
        const o = 6 + 16 * i;
        entete.writeUInt8(f.c % 256, o); entete.writeUInt8(f.c % 256, o + 1); entete.writeUInt8(0, o + 2); entete.writeUInt8(0, o + 3);
        entete.writeUInt16LE(1, o + 4); entete.writeUInt16LE(32, o + 6); entete.writeUInt32LE(f.b.length, o + 8); entete.writeUInt32LE(decalage, o + 12);
        decalage += f.b.length;
    });
    const ico = Buffer.concat([entete, ...favs.map((f) => f.b)]);
    writeFileSync(join(dossierExport, 'favicon.ico'), ico);
    ecrits.push(`favicon.ico (${ico.length} o)`);
}
await png(iconeApp, 192, 'icon-192.png');
await png(iconeApp, 512, 'icon-512.png');
await png(iconeMasquable, 512, 'icon-maskable-512.png');
await png(iconeCarree, 180, 'apple-touch-icon.png', '#EA580C'); // iOS : carré plein, sans transparence

// Image de partage 1200 × 630 : fond nuit (lisible dans un fil clair comme sombre), symbole, nom, une phrase vraie.
{
    const s = symbole('normal', 'degrade-sombre', 'og');
    const grand = nom('Event Village', 800, 64, -0.012);
    const phrase = nom('Concerts, soirées et spectacles au Sénégal', 500, 22, 0);
    const k = 300 / 49.2;
    const contenu = `<rect width="1200" height="630" fill="${C.nuit}"/>` +
        `<rect x="0" y="606" width="1200" height="24" fill="url(#og-bande)"/>` +
        `<defs><linearGradient id="og-bande" x1="0" y1="0" x2="1200" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${C.de}"/><stop offset="1" stop-color="${C.a}"/></linearGradient>${s.defs}</defs>` +
        `<g transform="translate(96 ${315 - 36.1 * k}) scale(${r2(k)}) translate(-7.4 0)">${s.corps}</g>` +
        `<path fill="${C.blanc}" transform="translate(470 318)" d="${grand.d}"/>` +
        `<path fill="#A6A6A6" transform="translate(472 386)" d="${phrase.d}"/>`;
    const source = svg('0 0 1200 630', contenu);
    const tampon = await sharp(Buffer.from(source)).png({ compressionLevel: 9 }).toBuffer();
    writeFileSync(join(dossierExport, 'og-image-1200x630.png'), tampon);
    ecrits.push(`og-image-1200x630.png (${tampon.length} o)`);
    ecrire(dossierSvg, 'og-image.svg', source);
}

console.log(ecrits.join('\n'));
