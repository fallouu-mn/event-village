// Event Village — design phase 0 : génération des fichiers SVG des trois directions de logo.
//
// Les symboles sont dessinés à la main ci-dessous (grille de 64 × 64, chemins écrits un à un).
// Le nom « Event Village » est vectorisé depuis la police de l'application
// (app/fonts/plus-jakarta-sans-latin-wght-normal.woff2, SIL OFL 1.1) : il s'affiche pareil
// partout, sans police chargée.
//
// Lancer (depuis la racine du dépôt) :
//   OUTILS_POLICE=<dossier où « npm i fontkit@2.0.4 wawoff2@2.0.1 » a été fait> node docs/design/outils/logos.mjs
// Sortie : docs/design/logo/svg/*.svg (écrasés à chaque lancement).

import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ici = dirname(fileURLToPath(import.meta.url));
const racine = resolve(ici, '../../..');
const sortie = join(racine, 'docs/design/logo/svg');
const outils = process.env.OUTILS_POLICE;
if (!outils) throw new Error('OUTILS_POLICE manquant : dossier contenant node_modules/fontkit et node_modules/wawoff2.');
const req = createRequire(join(outils, 'package.json'));
const fontkit = req('fontkit');
const wawoff2 = req('wawoff2');

// ── Couleurs de la charte ────────────────────────────────────────────────────
const C = {
    orange: '#FF8A3D',      // orange vif (couleur principale)
    orangeProfond: '#EA580C', // début du dégradé
    rose: '#DB2777',        // fin du dégradé
    encre: '#1A1A1A',       // texte sur orange, logo d'une couleur sur fond clair
    blanc: '#FFFFFF',
    nuit: '#121212',        // fond sombre
};

// ── Outils ───────────────────────────────────────────────────────────────────
const r2 = (n) => Math.round(n * 100) / 100;
const fmt = (s) => s.replace(/-?\d+\.\d+|-?\d+/g, (m) => String(r2(Number(m))));
const cercle = (cx, cy, r) => `M${r2(cx - r)} ${r2(cy)}a${r2(r)} ${r2(r)} 0 1 0 ${r2(2 * r)} 0a${r2(r)} ${r2(r)} 0 1 0 ${r2(-2 * r)} 0Z`;

// ── Police : copie TTF en mémoire pour lire les contours à la graisse voulue ──
const woff2 = readFileSync(join(racine, 'app/fonts/plus-jakarta-sans-latin-wght-normal.woff2'));
const police = fontkit.create(Buffer.from(await wawoff2.decompress(woff2)));

/**
 * Nom vectorisé : un seul chemin, coordonnées en unités du logo (hauteur de capitale = cap).
 * Renvoie { d, largeur, haut, bas } avec la ligne de base à y = 0 (haut < 0, bas > 0 si descendante).
 */
function nom(texte, graisse, cap, approche = 0) {
    const f = police.getVariation({ wght: graisse });
    const run = f.layout(texte);
    const s = cap / police.capHeight;
    let x = 0;
    const morceaux = [];
    let haut = 0;
    let bas = 0;
    run.glyphs.forEach((g, i) => {
        const p = g.path.transform(s, 0, 0, -s, x + run.positions[i].xOffset * s, -run.positions[i].yOffset * s);
        const b = p.bbox;
        if (Number.isFinite(b.minY)) {
            haut = Math.min(haut, b.minY);
            bas = Math.max(bas, b.maxY);
        }
        morceaux.push(p.toSVG());
        x += run.positions[i].xAdvance * s + approche * cap;
    });
    return { d: fmt(morceaux.join('')), largeur: x - approche * cap, haut, bas };
}

// ── Les trois symboles (grille 64 × 64) ──────────────────────────────────────

/**
 * Direction 1 « Repère » : un billet posé sur la carte. Billet couché, encoches aux deux bouts, talon
 * perforé à gauche, pointe de repère en bas. Perforation en 2 + 2 + 1 trous : +221, l'indicatif du Sénégal.
 */
const repere = {
    nom: 'repere',
    boite: { x: 5, y: 8, l: 54, h: 50.6 },
    corps: 'M12 8H52A7 7 0 0 1 59 15V20A6 6 0 0 0 59 32V37A7 7 0 0 1 52 44H43.2Q41.4 44 40.3 45.4L33.6 56.8Q32 59.3 30.4 56.8L23.7 45.4Q22.6 44 20.8 44H12A7 7 0 0 1 5 37V32A6 6 0 0 0 5 20V15A7 7 0 0 1 12 8Z',
    perforation: [14.5, 19, 25, 29.5, 36.5].map((y) => cercle(18.5, y, 1.65)).join(''),
};

/**
 * Direction 2 « Géew » : le cercle qui se forme autour du sabar ou de la lutte (le géew) ;
 * sept personnes autour, la fête au milieu.
 */
const geew = (() => {
    const points = [];
    for (let i = 0; i < 7; i += 1) {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / 7;
        points.push({ x: 32 + 22.5 * Math.cos(a), y: 32 + 22.5 * Math.sin(a) });
    }
    return { nom: 'geew', boite: { x: 4.3, y: 4.3, l: 55.4, h: 54.5 }, points, rayon: 5.4, centre: 7.6 };
})();

/**
 * Direction 3 « Bras levés » : deux billets levés comme des bras forment le V de Village ; la tête, au
 * milieu, fait de l'ensemble quelqu'un qui fait la fête.
 */
const brasLeves = (() => {
    // Un billet : rectangle arrondi 14 × 37 (bas en y = 55), sans perforation ; pivot (32, 52).
    const l = 14;
    const h = 37;
    const r = 4.5;
    const yh = 55 - h;
    const xg = 32 - l / 2;
    const billet = `M${xg + r} ${yh}H${xg + l - r}A${r} ${r} 0 0 1 ${xg + l} ${yh + r}V${55 - r}A${r} ${r} 0 0 1 ${xg + l - r} 55H${xg + r}A${r} ${r} 0 0 1 ${xg} ${55 - r}V${yh + r}A${r} ${r} 0 0 1 ${xg + r} ${yh}Z`;
    const tirets = ''; // essayés : tirets (lus comme des pansements) puis trous (lus comme des dominos) : retirés
    return { nom: 'bras-leves', boite: { x: 7.4, y: 13.8, l: 49.2, h: 44.4 }, billet, tirets, angle: 31, pivot: [32, 52], tete: { x: 32, y: 21.2, r: 6.6 } };
})();

// ── Rendu des symboles ───────────────────────────────────────────────────────

/** Remplissage : { type: 'degrade' } ou une couleur. Renvoie { defs, corps } (contenu SVG sans <svg>). */
function dessin(symbole, mode, id) {
    const deg = (x1, y1, x2, y2, a = C.orangeProfond, b = C.rose) =>
        `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
    if (symbole === repere) {
        const plein = mode.couleur ? mode.couleur : `url(#${id})`;
        const defs = mode.couleur ? '' : deg(32, 8, 32, 58, mode.degrade?.[0], mode.degrade?.[1]);
        const trous = mode.reduit ? '' : repere.perforation;
        return { defs, corps: `<path fill="${plein}" fill-rule="evenodd" d="${fmt(repere.corps + trous)}"/>` };
    }
    if (symbole === geew) {
        const n = geew.points.length;
        const dots = geew.points
            .map((p, i) => {
                const t = i / (n - 1);
                const couleur = mode.couleur ?? mode.anneau ?? melange(C.orange, C.orangeProfond, t);
                return `<path fill="${couleur}" d="${cercle(p.x, p.y, mode.reduit ? 6.2 : geew.rayon)}"/>`;
            })
            .join('');
        const centre = `<path fill="${mode.couleur ?? mode.centre ?? C.rose}" d="${cercle(32, 32, mode.reduit ? 8.4 : geew.centre)}"/>`;
        return { defs: '', corps: dots + centre };
    }
    // Bras levés : billet gauche, billet droit (au-dessus), tête. Perforation en creux (le fond passe à travers).
    const [px, py] = brasLeves.pivot;
    const a = brasLeves.angle;
    const forme = fmt(brasLeves.billet + (mode.reduit ? '' : brasLeves.tirets));
    const bras = (sens, couleur) => `<path fill="${couleur}" fill-rule="evenodd" transform="rotate(${sens * a} ${px} ${py})" d="${forme}"/>`;
    const tete = (couleur) => `<path fill="${couleur}" d="${cercle(brasLeves.tete.x, brasLeves.tete.y, brasLeves.tete.r)}"/>`;
    if (mode.couleur) {
        // Une couleur : un filet du fond sépare les deux billets (masque) pour qu'on en voie toujours deux.
        const masque = `<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64"><rect width="64" height="64" fill="#fff"/><path transform="rotate(${a} ${px} ${py})" d="${fmt(brasLeves.billet)}" fill="#000" stroke="#000" stroke-width="3.4"/></mask>`;
        return { defs: masque, corps: `<g mask="url(#${id})">${bras(-1, mode.couleur)}</g>${bras(1, mode.couleur)}${tete(mode.couleur)}` };
    }
    return { defs: '', corps: bras(-1, mode.gauche ?? C.orange) + bras(1, mode.droite ?? C.rose) + tete(mode.tete ?? C.orangeProfond) };
}

function melange(a, b, t) {
    const h = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
    const [x, y] = [h(a), h(b)];
    return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

// ── Fichiers ─────────────────────────────────────────────────────────────────

function svg(viewBox, contenu, titre) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" role="img" aria-label="${titre}"><title>${titre}</title>${contenu}</svg>\n`;
}

const DIRECTIONS = [
    {
        symbole: repere, titre: 'Event Village', texte: 'Event Village', graisse: 800, approche: -0.012,
        couleurClair: {}, couleurSombre: { degrade: [C.orange, '#F0509A'] },
        icone: { fond: C.nuit, symbole: { degrade: [C.orange, '#F0509A'] } }, // essayé : blanc sur dégradé, lu comme une messagerie
    },
    {
        symbole: geew, titre: 'Event Village', texte: 'event village', graisse: 700, approche: 0.004,
        couleurClair: {}, couleurSombre: {},
        icone: { fond: C.nuit, symbole: {} },
    },
    {
        symbole: brasLeves, titre: 'Event Village', texte: 'Event Village', graisse: 800, approche: -0.012,
        couleurClair: {}, couleurSombre: {},
        icone: { fond: '#FFF4EC', symbole: {} },
    },
];

mkdirSync(sortie, { recursive: true });
const ecrits = [];
const ecrire = (fichier, contenu) => {
    writeFileSync(join(sortie, fichier), contenu);
    ecrits.push(`${fichier} (${Buffer.byteLength(contenu)} o)`);
};

for (const d of DIRECTIONS) {
    const s = d.symbole;
    const b = s.boite;
    const marge = 2;
    const vbSym = `${r2(b.x - marge)} ${r2(b.y - marge)} ${r2(b.l + 2 * marge)} ${r2(b.h + 2 * marge)}`;

    // Symbole seul : couleur, réduit (favicon), une couleur encre et blanc.
    const sym = (mode, id) => {
        const x = dessin(s, mode, id);
        return (x.defs ? `<defs>${x.defs}</defs>` : '') + x.corps;
    };
    ecrire(`${s.nom}-symbole.svg`, svg(vbSym, sym(d.couleurClair, `${s.nom}-d`), d.titre));
    ecrire(`${s.nom}-symbole-sombre.svg`, svg(vbSym, sym(d.couleurSombre, `${s.nom}-ds`), d.titre));
    ecrire(`${s.nom}-symbole-reduit.svg`, svg(vbSym, sym({ ...d.couleurClair, reduit: true }, `${s.nom}-dr`), d.titre));
    ecrire(`${s.nom}-symbole-encre.svg`, svg(vbSym, sym({ couleur: C.encre }, `${s.nom}-me`), d.titre));
    ecrire(`${s.nom}-symbole-blanc.svg`, svg(vbSym, sym({ couleur: C.blanc }, `${s.nom}-mb`), d.titre));

    // Logo horizontal : symbole à gauche, nom aligné sur le centre optique du symbole.
    const cap = 22;
    const n = nom(d.texte, d.graisse, cap, d.approche);
    const ecart = 12;
    const xTexte = b.x + b.l + ecart;
    const yCentre = b.y + b.h / 2 - (s === repere ? 4 : 0); // la pointe du repère ne compte pas dans le centre
    const yBase = yCentre + cap / 2;
    const haut = Math.min(b.y, yBase + n.haut) - marge;
    const bas = Math.max(b.y + b.h, yBase + n.bas) + marge;
    const vbH = `${r2(b.x - marge)} ${r2(haut)} ${r2(xTexte + n.largeur - b.x + 2 * marge)} ${r2(bas - haut)}`;
    const texte = (couleur) => `<path fill="${couleur}" transform="translate(${r2(xTexte)} ${r2(yBase)})" d="${n.d}"/>`;
    ecrire(`${s.nom}-horizontal.svg`, svg(vbH, sym(d.couleurClair, `${s.nom}-hd`) + texte(C.encre), d.titre));
    ecrire(`${s.nom}-horizontal-sombre.svg`, svg(vbH, sym(d.couleurSombre, `${s.nom}-hs`) + texte(C.blanc), d.titre));
    ecrire(`${s.nom}-horizontal-encre.svg`, svg(vbH, sym({ couleur: C.encre }, `${s.nom}-he`) + texte(C.encre), d.titre));
    ecrire(`${s.nom}-horizontal-blanc.svg`, svg(vbH, sym({ couleur: C.blanc }, `${s.nom}-hb`) + texte(C.blanc), d.titre));

    // Icône d'application : carré arrondi (rayon 22,5 %), symbole à 64 % de la largeur, centré sur sa boîte.
    const cote = 64;
    const echelle = (cote * 0.64) / Math.max(b.l, b.h);
    const tx = cote / 2 - (b.x + b.l / 2) * echelle;
    const ty = cote / 2 - (b.y + b.h / 2) * echelle;
    const fond = d.icone.fond === 'degrade'
        ? `<defs><linearGradient id="${s.nom}-if" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${C.orangeProfond}"/><stop offset="1" stop-color="${C.rose}"/></linearGradient></defs><rect width="64" height="64" rx="14.4" fill="url(#${s.nom}-if)"/>`
        : `<rect width="64" height="64" rx="14.4" fill="${d.icone.fond}"/>`;
    const interieur = dessin(s, { ...d.icone.symbole, reduit: false }, `${s.nom}-is`);
    ecrire(
        `${s.nom}-icone.svg`,
        svg('0 0 64 64', fond + (interieur.defs ? `<defs>${interieur.defs}</defs>` : '') + `<g transform="translate(${r2(tx)} ${r2(ty)}) scale(${r2(echelle)})">${interieur.corps}</g>`, d.titre),
    );
}

console.log(`${ecrits.length} fichiers dans ${sortie}`);
console.log(ecrits.join('\n'));
