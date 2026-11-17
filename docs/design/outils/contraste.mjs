// Event Village — design phase 0 : contraste MESURÉ de chaque couple texte / fond des jetons.
//
// Lit docs/design/jetons.css (aucune valeur recopiée ici), calcule le rapport de contraste WCAG 2.x de chaque
// couple, en clair (boutons B) et en sombre (boutons A), et réécrit le tableau de docs/design/direction.md entre les
// repères « contraste:debut » et « contraste:fin ». Sort en erreur si un couple obligatoire est sous son seuil.
//
// Lancer depuis la racine du dépôt : node docs/design/outils/contraste.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const css = readFileSync(join(racine, 'docs/design/jetons.css'), 'utf8');

/** Variables « --nom: #RRGGBB; » du premier bloc qui suit le sélecteur donné. */
function bloc(selecteur) {
    const debut = css.indexOf(`${selecteur} {`);
    if (debut < 0) throw new Error(`Bloc introuvable dans jetons.css : ${selecteur}`);
    const fin = css.indexOf('\n}', debut);
    const vars = {};
    for (const m of css.slice(debut, fin).matchAll(/--([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})\b/g)) vars[m[1]] = m[2].toUpperCase();
    return vars;
}

const clair = bloc(':root');
const sombre = { ...clair, ...bloc(":root[data-theme='dark']") };
const THEMES = { clair, sombre };

// ── WCAG 2.x ─────────────────────────────────────────────────────────────────
const canaux = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const lineaire = (v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex) => {
    const [r, g, b] = canaux(hex).map(lineaire);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contraste = (a, b) => {
    const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
};
/** Couleur d'un dégradé linéaire CSS à la position t (interpolation sRGB, comme le navigateur). */
const melange = (a, b, t) => `#${canaux(a).map((v, i) => Math.round(v + (canaux(b)[i] - v) * t).toString(16).padStart(2, '0')).join('').toUpperCase()}`;

// ── Couples mesurés ──────────────────────────────────────────────────────────
// seuil 4,5 : texte courant ; 3 : grand texte (≥ 18,66 px gras) ou élément d'interface (WCAG 1.4.11) ;
// « info » : mesuré pour décider, sans seuil obligatoire.
const COUPLES = [
    ['Texte courant', 'foreground', ['background', 'card', 'muted', 'popover'], 4.5],
    ['Titres, montants', 'foreground-strong', ['background', 'card', 'popover'], 4.5],
    ['Texte secondaire', 'muted-foreground', ['background', 'card', 'muted', 'popover'], 4.5],
    ['Orange en texte, liens', 'primary-text', ['background', 'card', 'muted', 'primary-soft'], 4.5],
    ['Rose en texte', 'accent-text', ['background', 'card'], 4.5],
    ['Succès (pastille, bandeau)', 'success-text', ['success-soft'], 4.5],
    ['Attention', 'warning-text', ['warning-soft'], 4.5],
    ['Erreur', 'danger-text', ['danger-soft', 'background', 'card'], 4.5],
    ['Information', 'info-text', ['info-soft'], 4.5],
    ['Texte sur un ton plein', 'on-tone', ['success', 'warning', 'danger', 'info'], 4.5],
    ['Texte du bouton principal', 'primary-foreground', ['primary', 'primary-hover'], 4.5],
    ['Bouton Wave', 'on-op', ['op-wave'], 4.5],
    ['Bouton Orange Money', 'on-op', ['op-orange-money'], 4.5],
    ['Bord des champs', 'input', ['background', 'card'], 3],
    ["Texte sur l'orange de la marque (repère choisi, « À la une »)", 'brand-foreground', ['brand'], 4.5],
    ['Anneau de focus : orange de la marque', 'ring', ['background', 'card', 'muted'], 'info'],
    ['Anneau de focus : liseré sombre (clair)', 'ring-halo', ['background', 'card', 'muted'], 'halo'],
    ['Onglet actif, accents : orange de la marque', 'brand', ['background', 'card'], 'info'],
    ['Bord du bouton principal sur le fond', 'primary', ['background', 'card'], 3],
];

const lignes = [];
let echecs = 0;
const fmt = (n) => n.toFixed(2).replace('.', ',');
for (const [theme, t] of Object.entries(THEMES)) {
    for (const [nom, texte, fonds, seuil] of COUPLES) {
        for (const fond of fonds) {
            const a = t[texte];
            const b = t[fond];
            if (!a || !b) throw new Error(`Jeton manquant (${theme}) : --${texte} ou --${fond}`);
            const r = contraste(a, b);
            if (seuil === 'halo' && theme === 'sombre') continue; // en sombre, l'orange seul suffit (≥ 6:1)
            const s = seuil === 'halo' ? 3 : seuil;
            const ok = s === 'info' ? null : r >= s;
            if (ok === false) echecs += 1;
            lignes.push(`| ${nom} | ${theme} | \`--${texte}\` ${a} | \`--${fond}\` ${b} | **${fmt(r)}:1** | ${s === 'info' ? '—' : `${fmt(s)}:1`} | ${ok === null ? (r >= 3 ? 'visible seul' : 'pas seul : doublé (liseré sombre, texte gras, libellé)') : ok ? 'oui' : '**NON**'} |`);
        }
    }
}

// Grand bouton en dégradé : texte blanc gras 19 px, minimum le long du dégradé (21 positions).
const gradient = (t) => {
    let min = Infinity;
    let pire = '';
    for (let i = 0; i <= 20; i += 1) {
        const c = melange(t['gradient-from'], t['gradient-to'], i / 20);
        const r = contraste(t['gradient-foreground'], c);
        if (r < min) [min, pire] = [r, c];
    }
    return { min, pire };
};
for (const theme of ['clair', 'sombre']) {
    const t = THEMES[theme];
    const { min, pire } = gradient(t);
    const ok = min >= 3;
    if (!ok) echecs += 1;
    lignes.push(`| Grand bouton en dégradé (blanc gras 19 px) | ${theme} | \`--gradient-foreground\` ${t['gradient-foreground']} | dégradé ${t['gradient-from']} → ${t['gradient-to']}, pire point ${pire} | **${fmt(min)}:1** | 3,00:1 | ${ok ? 'oui (grand texte)' : '**NON**'} |`);
}

// Interdits de la charte, mesurés pour mémoire.
const interdits = [
    ['Blanc sur l\'orange vif (interdit par la charte)', '#FFFFFF', clair.brand],
    ['Orange vif en texte sur blanc (interdit)', clair.brand, '#FFFFFF'],
];
for (const [nom, a, b] of interdits) lignes.push(`| ${nom} | — | ${a} | ${b} | **${fmt(contraste(a, b))}:1** | — | interdit |`);

const tableau = [
    '| Couple | Thème (boutons B en clair, A en sombre) | Texte | Fond | Contraste | Seuil | Conforme |',
    '|---|---|---|---|---|---|---|',
    ...lignes,
].join('\n');

const cible = join(racine, 'docs/design/direction.md');
const doc = readFileSync(cible, 'utf8');
const [ouvre, ferme] = ['<!-- contraste:debut -->', '<!-- contraste:fin -->'];
const i = doc.indexOf(ouvre);
const j = doc.indexOf(ferme);
if (i < 0 || j < i) throw new Error('Repères contraste:debut / contraste:fin absents de direction.md');
writeFileSync(cible, `${doc.slice(0, i + ouvre.length)}\n${tableau}\n${doc.slice(j)}`);

console.log(tableau);
console.log(`\n${lignes.length} couples mesurés, ${echecs} sous le seuil.`);
if (echecs > 0) process.exit(1);
