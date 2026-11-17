// Design 1a — renomme les anciens noms de couleur d'un fichier vers ceux de la charte, EXACTEMENT selon les alias
// d'app/globals.css et de tailwind.config.ts (même couleur, rendu identique). Sert à tout fichier qu'un lot touche :
// la règle des anciens noms (scripts/design-anciens-noms.mjs) interdit les anciens noms dans un fichier modifié.
//
//   node scripts/design-renommer.mjs <fichier…>     réécrit les fichiers et liste ce qui reste à reprendre à la main
//
// Restent à la main (aucun équivalent exact) : la rampe brand-50…900 et les anciennes classes ev-*.
import { readFileSync, writeFileSync } from 'node:fs';
import { oldNamesIn } from './design-anciens-noms.mjs';

const PREFIX = '(bg|text|border(?:-[trblxy])?|ring(?:-offset)?|divide|outline|fill|stroke|from|via|to|placeholder|decoration|caret|accent|shadow)';
/** Ancien nom → nom de la charte (ordre : les plus longs d'abord). */
const COLORS = [
    ['surface-sunken', 'background'],
    ['surface-raised', 'popover'],
    ['surface', 'card'],
    ['fg-muted', 'muted-foreground'],
    ['fg', 'foreground-strong'],
    ['border-strong', 'input'],
    ['on-brand', 'primary-foreground'],
    ['brand-hover', 'primary-hover'],
    ['brand-fg', 'primary-text'],
    ['brand-bg', 'primary-soft'],
    ['brand-decor', 'brand-vif'],
    ['brand', 'primary'],
    ['on-op-wave', 'on-op'],
    ['on-op-orange-money', 'on-op'],
    ...['success', 'warning', 'danger', 'info'].flatMap((t) => [[`${t}-bg`, `${t}-soft`], [`${t}-fg`, `${t}-text`]]),
];
const VARS = [
    ['surface-sunken', 'background'], ['surface-raised', 'popover'], ['surface', 'card'], ['fg-muted', 'muted-foreground'],
    ['fg', 'foreground-strong'], ['border-strong', 'input'], ['on-brand', 'primary-foreground'], ['brand-hover', 'primary-hover'],
    ['brand-fg', 'primary-text'], ['brand-bg', 'primary-soft'], ['brand-decor', 'brand'],
    ...['success', 'warning', 'danger', 'info'].flatMap((t) => [[`${t}-bg`, `${t}-soft`], [`${t}-fg`, `${t}-text`]]),
];
/** Anciennes variables en couleur complète → expression équivalente. */
const FULL_VARS = [
    ['bg-main', 'rgb(var(--background))'], ['bg-surface', 'rgb(var(--card))'], ['bg-card', 'rgb(var(--card))'],
    ['text-main', 'rgb(var(--foreground-strong))'], ['text-secondary', 'rgb(var(--foreground))'], ['text-muted', 'rgb(var(--muted-foreground))'],
    ['border-main', 'rgb(var(--border))'], ['brand-primary', 'rgb(var(--primary))'], ['brand-light', 'rgb(var(--primary-soft))'],
    ['brand-glow', 'var(--gradient-shadow)'],
];

export function rename(text) {
    let out = text;
    for (const [from, to] of COLORS) {
        const re = new RegExp(`(?<![a-zA-Z0-9-])${PREFIX}-${from.replace(/-/g, '\\-')}(?![a-zA-Z0-9-])`, 'g');
        out = out.replace(re, (_m, prefix) => `${prefix}-${to}`);
    }
    for (const [from, to] of VARS) out = out.replace(new RegExp(`var\\(--${from}\\)`, 'g'), `var(--${to})`);
    for (const [from, to] of FULL_VARS) out = out.replace(new RegExp(`var\\(--${from}\\)`, 'g'), to);
    return out;
}

if (process.argv[1] && process.argv[1].endsWith('design-renommer.mjs')) {
    let left = 0;
    for (const file of process.argv.slice(2)) {
        const before = readFileSync(file, 'utf8');
        const after = rename(before);
        if (after !== before) writeFileSync(file, after);
        const rest = oldNamesIn(after);
        if (rest.length > 0) {
            left += 1;
            console.log(`${file} : à reprendre à la main : ${rest.join(', ')}`);
        }
    }
    console.log(`${process.argv.length - 2} fichier(s) traités, ${left} avec un reste à reprendre à la main.`);
}
