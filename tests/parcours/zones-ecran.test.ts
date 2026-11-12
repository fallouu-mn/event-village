/**
 * Lot 9 ter, tâche 9t.16 (consigne 2 : lisibilité du résultat du scan ; arbitrage 19, X1, X5, EC3, EC8) — écran du
 * résultat plein écran, jetons, vibrations, client du scan (contrat 5.C, C.2.3, C.2.4, C.2.5). Sans base : lecture
 * des fichiers, rendu par renderToStaticMarkup, appels des modules purs (patron tests/parcours/scanner-interface).
 *  1. jetons scan-orient et scan-cat-* : texte ≥ 7:1, mêmes valeurs en clair et en sombre ([SCANNER-CONTRASTES-9TER]) ;
 *  2. scan-used est rouge (#991B1B, « 153 27 27 ») et reste ≥ 8,3:1 ;
 *  3. palette : 8 clés de SCAN_CATEGORY_COLORS = 8 paires de jetons = 8 valeurs du CHECK de la migration 09 ;
 *  4. vibrationPattern('oriente') = [250, 100, 250] ; accepte, refuse et technique inchangés ;
 *  5. catégories d'affichage : wrong_zone et not_entered orientés, zone_ok accepté ; libellés courts exacts ;
 *  6. CombatFlashOverlay rendu : titres et lignes exacts de C.2.4 (vert avec bande, consigne et zone ; accès autorisé ;
 *     mauvaise zone ; pas encore entré ; déjà utilisé avec porte) ; un seul role="alert" ; data-scan-contrast ;
 *  7. valid sans option : rendu identique à aujourd'hui (référence relevée le 12/11/2026 sur 82da1d5, props de
 *     e2e/support/screens.ts:211 et :837), attributs data-scan-contrast ôtés avant la comparaison ;
 *  8. badge d'origine : « Invitation », « Gratuit », rien pour ONLINE et COUNTER ;
 *  9. gatePhrase : « Nord » → « porte Nord » ; « Porte Nord », « Entrée VIP » inchangés ;
 * 10. aucune couleur brute dans les fichiers d'écran de C ;
 * 11. scan-client : 409 GATE_* → incident technique (failure 'gate'), sans vibration ni compteur, titre exact ;
 *     409 already_used → verdict.
 *
 * Interprétations (contrat muet, à reprendre au rapport) : les props nouvelles de CombatFlashOverlay sont celles de
 * C.2.4 (`categoryColor`, `entryInstruction`, `zoneName`, `gateName`, `origin`, `redirectZones`, `checkedInGate`) ; le
 * titre « Accès refusé : billet {catégorie} » vient de la prop `category` ; les lignes GATE_* du tableau C.2.4 sont
 * prouvées par titleFor (cas 11), le contrat ne donnant aucune prop d'incident de porte à l'écran. Cas 7 : le contrat
 * pose data-scan-contrast sur chaque nœud de texte (C.2.4) et exige le même rendu sans option (C.2.5 cas 7) ; la
 * comparaison se fait donc sans ces attributs de mesure.
 *
 * Rouge avant correctif (fix(9t.16) pour lib/scan/scan-result.ts et les compagnons de compilation, fix(9t.16e) et
 * fix(9t.17e) pour les écrans) : jetons absents (app/globals.css:70-79), scan-used brun (:72), SCAN_CATEGORY_COLORS et
 * gatePhrase non exportés, migration 09 absente, vibrationPattern('oriente') null, résultats de zone hors de l'union,
 * overlay sans props de zone (rendu vide pour wrong_zone), GuestListPanel.tsx et ZonesEditor.tsx absents, 409 sans
 * résultat lu comme panne serveur. Vert dès l'écriture, annoncé : cas 7 (non-régression).
 * Suite sans base ni écriture : aucun appel d'invariants (comme les suites statiques du lot).
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const ROOT = process.cwd();
const GLOBALS = 'app/globals.css';
const OVERLAY = 'components/scan/CombatFlashOverlay.tsx';
const M09_FILE = 'supabase/migrations/20261110000009_lot9ter_zones.sql';
const C_SCREENS = [
    'components/scan/CombatFlashOverlay.tsx',
    'components/scan/ScanResultPanel.tsx',
    'components/scan/GuestListPanel.tsx',
    'components/partner/zones/ZonesEditor.tsx',
];
const PALETTE = ['BLANC', 'OR', 'ARGENT', 'ROSE', 'TURQUOISE', 'BLEU', 'VIOLET', 'NOIR'];
const CHECKED_AT = '2026-11-04T19:42:00.000Z';
const BASE = { holderName: 'Awa Diop', category: 'VIP', ticketNumber: 'TCK-20261110-0A1B2C3D4E', durationMs: 0 };
/** Rendu d'aujourd'hui de « valid » sans option (relevé sur 82da1d5, props de e2e/support/screens.ts:211, :837). */
const VALID_REFERENCE = '<div data-testid="combat-flash-overlay" data-scan-result="valid" data-scan-state="result" data-scan-category="accepte" class="fixed inset-0 z-50 flex select-none flex-col items-center justify-center gap-4 overflow-y-auto p-6 text-center bg-scan-accept-bg text-scan-accept-fg" role="alert" aria-live="assertive" aria-atomic="true"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-circle-check h-24 w-24 flex-shrink-0 sm:h-32 sm:w-32" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="m9 12 2 2 4-4"></path></svg><p class="max-w-3xl text-balance text-4xl font-black leading-tight tracking-tight sm:text-5xl">Entrée validée</p><div class="flex max-w-4xl flex-col items-center gap-2"><p data-testid="combat-holder-name" class="break-words text-5xl font-black leading-none tracking-tight sm:text-6xl">Fatou Mbaye</p><p class="text-xl font-bold tabular-nums sm:text-2xl">Standard · <span class="min-[375px]:whitespace-nowrap">TCK-20261104-7C2D9A4B1E</span></p></div></div>';
const VALID_REFERENCE_PROPS = { status: 'valid', holderName: 'Fatou Mbaye', category: 'Standard', ticketNumber: 'TCK-20261104-7C2D9A4B1E', durationMs: 0 };

// ── Outils locaux ──────────────────────────────────────────────────────────

/** Import dynamique (chemin relatif à ce fichier) : exports nouveaux absents sans erreur de typage. */
async function importModule(relPath: string): Promise<Record<string, unknown>> {
    const target: string = relPath;
    return (await import(target)) as Record<string, unknown>;
}

function read(file: string): string {
    const abs = path.resolve(ROOT, file);
    assert.ok(fs.existsSync(abs), `fichier attendu absent : ${file}`);
    return fs.readFileSync(abs, 'utf8');
}

function stripComments(src: string): string {
    return src.replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, '')).replace(/(^|\s)\/\/.*$/gm, '$1');
}

type Rgb = [number, number, number];

function parseColor(value: string, what: string): Rgb {
    const v = value.trim();
    let m = /^#([0-9a-f]{6})$/i.exec(v);
    if (m) return [0, 2, 4].map((i) => parseInt(m![1].slice(i, i + 2), 16)) as Rgb;
    m = /^(?:rgb\(\s*)?(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})\s*\)?$/.exec(v);
    if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
    assert.fail(`${what} : valeur de couleur illisible « ${value} »`);
}

/** Rapport de contraste WCAG 2.x (calcul indépendant du code testé). */
function contrast(a: Rgb, b: Rgb): number {
    const lum = (c: Rgb) => {
        const [r, g, bl] = c.map((x) => {
            const s = x / 255;
            return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
    };
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
}

/** Déclarations --scan-* de app/globals.css, toutes valeurs par nom (clair, sombre, tout bloc). */
function scanTokens(): Map<string, string[]> {
    const css = read(GLOBALS).replace(/\/\*[\s\S]*?\*\//g, '');
    const out = new Map<string, string[]>();
    for (const m of Array.from(css.matchAll(/(--scan-[a-z0-9-]+)\s*:\s*([^;]+);/g))) {
        const list = out.get(m[1]) ?? [];
        list.push(m[2].trim());
        out.set(m[1], list);
    }
    return out;
}

function tokenPair(tokens: Map<string, string[]>, tone: string): { bg: string; fg: string; ratio: number } {
    const bg = tokens.get(`--scan-${tone}-bg`);
    const fg = tokens.get(`--scan-${tone}-fg`);
    assert.ok(bg && fg, `jetons --scan-${tone}-bg et --scan-${tone}-fg attendus dans ${GLOBALS} (C.2.4)`);
    for (const [name, values] of [[`--scan-${tone}-bg`, bg], [`--scan-${tone}-fg`, fg]] as Array<[string, string[]]>) {
        const distinct = new Set(values.map((v) => v.replace(/\s+/g, ' ').toLowerCase()));
        assert.equal(distinct.size, 1, `${name} : même valeur en clair et en sombre (${values.join(' | ')})`);
    }
    return { bg: bg[0], fg: fg[0], ratio: contrast(parseColor(fg[0], `--scan-${tone}-fg`), parseColor(bg[0], `--scan-${tone}-bg`)) };
}

async function renderFlash(props: Record<string, unknown>): Promise<string> {
    const mod = await importModule('../../components/scan/CombatFlashOverlay');
    assert.equal(typeof mod.CombatFlashOverlay, 'function', `${OVERLAY} : CombatFlashOverlay exporté`);
    return renderToStaticMarkup(React.createElement(mod.CombatFlashOverlay as React.FC<Record<string, unknown>>, props));
}

/** Texte du rendu : balises de bloc en sauts de ligne, autres balises ôtées, entités décodées, insécables ramenées à l'espace. */
function textOf(html: string): string {
    return html
        .replace(/<\/(p|div|li|h[1-6])>|<br\s*\/?>/g, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&#x27;/g, '\'').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
        .replace(/[  ]/g, ' ');
}

function lines(html: string): string[] {
    return textOf(html).split('\n').map((l) => l.trim()).filter(Boolean);
}

function assertLines(html: string, expected: string[], what: string): void {
    assert.ok(html.length > 0, `${what} : aucun rendu (résultat hors de l’union, ou props de zone non lues)`);
    const got = lines(html);
    for (const line of expected) assert.ok(got.includes(line), `${what} : ligne « ${line} » attendue (C.2.4) ; lignes rendues :\n${got.join('\n')}`);
    assert.equal((html.match(/role="alert"/g) ?? []).length, 1, `${what} : un seul role="alert"`);
}

// ── 1 et 2. Jetons ─────────────────────────────────────────────────────────

describe('9t.16 Jetons du résultat : orange, catégories, rouge « Déjà utilisé »', () => {
    test('1. jetons scan-orient et scan-cat-* : texte ≥ 7:1, mêmes valeurs en clair et en sombre', () => {
        const tokens = scanTokens();
        const tones = ['orient', ...PALETTE.map((k) => `cat-${k.toLowerCase()}`)];
        const ratios: string[] = [];
        for (const tone of tones) {
            const { bg, fg, ratio } = tokenPair(tokens, tone);
            ratios.push(`${tone} ${ratio.toFixed(2)}:1`);
            assert.ok(ratio >= 7, `--scan-${tone} : ${ratio.toFixed(2)}:1 < 7:1 (${fg} / ${bg})`);
        }
        console.log(`[SCANNER-CONTRASTES-9TER] ${ratios.join(' ; ')}`);
        const orient = tokenPair(tokens, 'orient');
        assert.deepEqual(parseColor(orient.bg, '--scan-orient-bg'), [251, 146, 60], 'orange #FB923C (arbitrage 19)');
    });

    test('2. scan-used est rouge (#991B1B) et reste ≥ 7:1', () => {
        const used = tokenPair(scanTokens(), 'used');
        assert.deepEqual(parseColor(used.bg, '--scan-used-bg'), [153, 27, 27], `« Déjà utilisé » rouge #991B1B (consigne 2), trouvé ${used.bg}`);
        assert.ok(used.ratio >= 8.3, `--scan-used : ${used.ratio.toFixed(2)}:1 < 8,3:1`);
    });

    test('3. palette : 8 clés de lib/scan/scan-result.ts = 8 jetons = 8 valeurs du CHECK', async () => {
        const mod = await importModule('../../lib/scan/scan-result');
        assert.ok(Array.isArray(mod.SCAN_CATEGORY_COLORS), 'lib/scan/scan-result.ts : SCAN_CATEGORY_COLORS exportée (X2, seule liste des 8 couleurs)');
        assert.deepEqual(Array.from(mod.SCAN_CATEGORY_COLORS as string[]), PALETTE, 'clés et ordre de 3.8');
        const tokens = scanTokens();
        for (const key of PALETTE) tokenPair(tokens, `cat-${key.toLowerCase()}`);
        const sql = read(M09_FILE);
        const at = sql.indexOf('ADD CONSTRAINT ticket_categories_scan_color_check');
        assert.ok(at >= 0, `${M09_FILE} : contrainte ticket_categories_scan_color_check posée`);
        const clause = sql.slice(at, sql.indexOf(';', at));
        assert.deepEqual(Array.from(clause.matchAll(/'([A-Z]+)'/g)).map((m) => m[1]), PALETTE, `CHECK de la migration = SCAN_CATEGORY_COLORS : ${clause}`);
    });
});

// ── 3 et 4. Vibrations et catégories ───────────────────────────────────────

describe('9t.16 Vibrations et catégories d’affichage', () => {
    test('4. vibrationPattern(\'oriente\') = [250, 100, 250] ; accepte, refuse et technique inchangés', async () => {
        const mod = await importModule('../../lib/hardware/feedback');
        const vibrationPattern = mod.vibrationPattern as (c: string) => number[] | null;
        assert.equal(typeof vibrationPattern, 'function', 'lib/hardware/feedback.ts : vibrationPattern exportée');
        assert.deepEqual(vibrationPattern('oriente'), [250, 100, 250], 'orange : famille « attention » (arbitrage 19)');
        assert.deepEqual(vibrationPattern('accepte'), [60]);
        assert.deepEqual(vibrationPattern('refuse'), [120, 60, 120, 60, 120]);
        assert.equal(vibrationPattern('technique'), null);
        assert.notDeepEqual(vibrationPattern('oriente'), vibrationPattern('accepte'), 'orange et vert distincts');
        assert.notDeepEqual(vibrationPattern('oriente'), vibrationPattern('refuse'), 'orange et rouge distincts');
    });

    test('5. catégories d’affichage : wrong_zone et not_entered orientés, zone_ok accepté ; libellés courts exacts', async () => {
        const mod = await importModule('../../lib/scan/scan-result');
        const scanCategoryOf = mod.scanCategoryOf as (r: string) => string | undefined;
        const labels = mod.SCAN_RESULT_LABELS as Record<string, string>;
        assert.deepEqual(['wrong_zone', 'not_entered', 'zone_ok'].map((r) => [r, scanCategoryOf(r), labels[r]]), [
            ['wrong_zone', 'oriente', 'Mauvaise zone'],
            ['not_entered', 'oriente', 'Pas encore entré'],
            ['zone_ok', 'accepte', 'Accès autorisé'],
        ], 'C.2.3 : catégories et libellés courts');
        assert.ok((mod.SCAN_RESULTS as string[]).includes('wrong_zone'), 'SCAN_RESULTS élargie (union du contrat)');
    });
});

// ── 5 à 8. Plein écran ─────────────────────────────────────────────────────

describe('9t.16 Plein écran du scanner : textes exacts', () => {
    test('6. CombatFlashOverlay rendu : titres et lignes exacts de C.2.4', async () => {
        const valid = await renderFlash({
            ...BASE, status: 'valid', categoryColor: 'OR', entryInstruction: 'Remettre bracelet doré', zoneName: 'Entrée VIP', gateName: 'Porte VIP', origin: 'ONLINE',
        });
        assertLines(valid, ['Entrée validée', 'VIP', 'Remettre bracelet doré', 'Zone : Entrée VIP · Porte VIP', 'Awa Diop', 'TCK-20261110-0A1B2C3D4E'], 'valid avec couleur, consigne et zone');
        assert.match(valid, /data-scan-category="accepte"/, 'catégorie accepte');
        assert.match(valid, /data-scan-band/, 'bande de catégorie marquée data-scan-band');
        for (const cls of ['bg-scan-cat-or-bg', 'text-scan-cat-or-fg', 'border-4', 'border-scan-accept-fg']) assert.ok(valid.includes(cls), `bande : classe ${cls}`);
        assert.ok((valid.match(/data-scan-contrast/g) ?? []).length >= 3, 'au moins 3 nœuds data-scan-contrast (titre, bande, consigne, zone)');

        const zoneOk = await renderFlash({ ...BASE, status: 'zone_ok', categoryColor: 'OR', zoneName: 'Carré VIP', gateName: 'Accès carré', checkedInAt: CHECKED_AT, checkedInGate: 'Porte VIP' });
        assertLines(zoneOk, ['Accès autorisé', 'Zone : Carré VIP', 'Entré à 19:42, Porte VIP', 'Awa Diop'], 'zone_ok');
        assert.match(zoneOk, /data-scan-category="accepte"/, 'zone_ok : vert');
        const zoneOkNoGate = await renderFlash({ ...BASE, status: 'zone_ok', zoneName: 'Carré VIP', gateName: 'Accès carré', checkedInAt: CHECKED_AT, checkedInGate: null });
        assertLines(zoneOkNoGate, ['Entré à 19:42'], 'zone_ok sans porte connue');

        const wrong = await renderFlash({ ...BASE, status: 'wrong_zone', redirectZones: ['Entrée VIP'] });
        assertLines(wrong, ['Accès refusé : billet VIP', 'Présentez-vous à : Entrée VIP', 'Awa Diop', 'Billet : VIP · TCK-20261110-0A1B2C3D4E'], 'wrong_zone');
        assert.match(wrong, /data-scan-category="oriente"/, 'wrong_zone : orange');
        assert.ok(wrong.includes('bg-scan-orient-bg'), 'wrong_zone : surface scan-orient');
        assertLines(await renderFlash({ ...BASE, status: 'wrong_zone', redirectZones: ['Entrée VIP', 'Carré VIP'] }), ['Présentez-vous à : Entrée VIP ou Carré VIP'], 'wrong_zone, deux zones');
        assertLines(await renderFlash({ ...BASE, status: 'wrong_zone', redirectZones: [] }), ['Aucune zone n’admet ce billet : appelez l’organisateur.'], 'wrong_zone, aucune zone');

        const early = await renderFlash({ ...BASE, status: 'not_entered', redirectZones: ['Entrée VIP'] });
        assertLines(early, ['Pas encore entré', 'Passez d’abord par : Entrée VIP', 'Awa Diop', 'Billet : VIP · TCK-20261110-0A1B2C3D4E'], 'not_entered');
        assert.match(early, /data-scan-category="oriente"/, 'not_entered : orange');

        const used = await renderFlash({ ...BASE, status: 'already_used', checkedInAt: CHECKED_AT, checkedInGate: 'Nord' });
        assertLines(used, ['Billet déjà utilisé', 'Déjà utilisé à 19:42, porte Nord', 'Awa Diop'], 'already_used, porte « Nord »');
        assert.ok(used.includes('bg-scan-used-bg'), 'already_used : surface scan-used');
        assertLines(await renderFlash({ ...BASE, status: 'already_used', checkedInAt: CHECKED_AT, checkedInGate: 'Porte Nord' }), ['Déjà utilisé à 19:42, Porte Nord'], 'already_used, « Porte Nord » (X5)');
        const noGate = await renderFlash({ ...BASE, status: 'already_used', checkedInAt: CHECKED_AT, checkedInGate: null });
        assertLines(noGate, ['Déjà utilisé à 19:42'], 'already_used sans porte connue');
        assert.ok(!lines(noGate).includes('Entré à 19:42'), 'la ligne « Entré à » du lot 7 est remplacée');
        assertLines(await renderFlash({ ...BASE, status: 'already_used', checkedInAt: CHECKED_AT, checkedInByMe: true, checkedInGate: 'Porte Nord' }),
            ['Déjà validé par vous à 19:42'], 'already_used par ce contrôleur (D41 gardé)');
    });

    test('7. valid sans option : rendu identique à aujourd’hui', async () => {
        const html = await renderFlash(VALID_REFERENCE_PROPS);
        assert.equal(html.replace(/\s+data-scan-contrast(="[^"]*")?/g, ''), VALID_REFERENCE, 'même rendu que le lot 7 sans couleur, consigne ni zone');
        assert.doesNotMatch(html, /data-scan-band/, 'aucune bande sans couleur');
    });

    test('8. badge : Invitation, Gratuit, rien pour ONLINE et COUNTER', async () => {
        const plain = await renderFlash(VALID_REFERENCE_PROPS);
        for (const [origin, badge] of [['INVITATION', 'Invitation'], ['FREE', 'Gratuit']] as Array<[string, string]>) {
            const html = await renderFlash({ ...VALID_REFERENCE_PROPS, origin });
            assert.ok(lines(html).includes(badge), `origine ${origin} : badge « ${badge} » : ${lines(html).join(' | ')}`);
            assert.match(html, /border-current/, `origine ${origin} : badge discret à bordure (C.2.4)`);
        }
        for (const origin of ['ONLINE', 'COUNTER']) {
            const html = await renderFlash({ ...VALID_REFERENCE_PROPS, origin });
            assert.equal(html, plain, `origine ${origin} : aucun badge, rendu identique`);
        }
    });

    test('9. gatePhrase : « Nord » → « porte Nord », noms qui commencent par Porte, Portail, Entrée, Accès, Guichet inchangés', async () => {
        const mod = await importModule('../../lib/scan/scan-result');
        const gatePhrase = mod.gatePhrase as (name: string) => string;
        assert.equal(typeof gatePhrase, 'function', 'lib/scan/scan-result.ts : gatePhrase exportée (C.2.3)');
        assert.deepEqual(['Nord', 'Porte Nord', 'Entrée VIP', 'Portail 2', 'Accès carré', 'Guichet 1'].map(gatePhrase),
            ['porte Nord', 'Porte Nord', 'Entrée VIP', 'Portail 2', 'Accès carré', 'Guichet 1']);
    });
});

// ── 9. Couleurs brutes ─────────────────────────────────────────────────────

describe('9t.16 Écrans de C sur les jetons du système', () => {
    test('10. aucune couleur brute dans les fichiers de C', () => {
        const palette = 'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';
        const patterns: Array<[RegExp, string]> = [
            [new RegExp(`\\b(?:bg|text|border|ring|from|via|to|fill|stroke|shadow|outline|decoration)-(?:${palette})-\\d{2,3}\\b`), 'couleur de palette brute'],
            [/\b(?:bg|text|border)-(?:white|black)\b/, 'blanc ou noir en dur'],
            [/#[0-9a-fA-F]{3,8}\b/, 'couleur hexadécimale'],
        ];
        const missing = C_SCREENS.filter((f) => !fs.existsSync(path.resolve(ROOT, f)));
        assert.deepEqual(missing, [], `écrans de C absents (8.3) : ${missing.join(', ')}`);
        const found: string[] = [];
        for (const f of C_SCREENS) {
            stripComments(read(f)).split(/\r?\n/).forEach((line, i) => {
                for (const [re, why] of patterns) if (re.test(line)) found.push(`${f}:${i + 1} (${why}) ${line.trim().slice(0, 160)}`);
            });
        }
        assert.deepEqual(found, [], `couleurs hors jetons :\n${found.join('\n')}`);
    });
});

// ── 10. Client du scan ─────────────────────────────────────────────────────

describe('9t.16 Client du scan : incidents de porte', () => {
    test('11. scan-client : 409 GATE_REQUIRED → incident technique sans vibration ni compteur, titre exact ; 409 already_used → verdict', async () => {
        const client = await importModule('../../components/scan/scan-client');
        const feedback = await importModule('../../lib/hardware/feedback');
        const readScanResponse = client.readScanResponse as (res: Response) => Promise<Record<string, unknown>>;
        const titleFor = client.titleFor as (o: Record<string, unknown>) => string;
        const categoryFor = client.categoryFor as (o: Record<string, unknown>) => string;
        const isTicketRefusal = client.isTicketRefusal as (o: Record<string, unknown>) => boolean;
        const vibrationPattern = feedback.vibrationPattern as (c: string) => number[] | null;
        const cases: Array<[string, string, string]> = [
            ['GATE_REQUIRED', 'Aucune porte ne vous est attribuée : demandez à l’organisateur de vous en attribuer une. Rien n’a été validé.', 'Aucune porte affectée'],
            ['GATE_CHANGED', 'Votre porte a changé : le contrôle reprend avec votre nouvelle porte. Scannez de nouveau.', 'Votre porte a changé'],
            ['GATE_INVALID', 'Porte inconnue : choisissez une porte de cet événement.', 'Porte inconnue'],
        ];
        for (const [code, error, title] of cases) {
            const res = new Response(JSON.stringify({ error, code }), { status: 409, headers: { 'content-type': 'application/json' } });
            const outcome = await readScanResponse(res);
            assert.deepEqual({ result: outcome.result, failure: outcome.failure, httpStatus: outcome.httpStatus, code: outcome.code, message: outcome.message },
                { result: 'server_error', failure: 'gate', httpStatus: 409, code, message: error }, `${code} : incident de porte (C.2.3)`);
            assert.equal(titleFor(outcome), title, `${code} : titre`);
            assert.equal(categoryFor(outcome), 'technique', `${code} : écran technique`);
            assert.equal(vibrationPattern(categoryFor(outcome)), null, `${code} : aucune vibration`);
            assert.equal(isTicketRefusal(outcome), false, `${code} : jamais compté comme refus du billet`);
        }
        const used = await readScanResponse(new Response(JSON.stringify({ result: 'already_used', message: 'Billet déjà utilisé', ticket: { checked_in_at: CHECKED_AT } }),
            { status: 409, headers: { 'content-type': 'application/json' } }));
        assert.equal(used.result, 'already_used', '409 avec un résultat : verdict sur le billet');
        assert.equal(used.failure, undefined, '409 avec un résultat : aucun incident');
    });
});
