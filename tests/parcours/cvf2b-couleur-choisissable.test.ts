/**
 * Correctifs de la contre-vérification de la finition 2b, 2b — couleur OR retirée du choix manuel et de la palette
 * automatique ; aucune couleur choisissable à moins de 25 (CIEDE2000, jetons d'app/globals.css, même formule que
 * tests/audit/cvf2b-2-couleur-prix) d'un verdict du scanner. Sans base : lecture des sources et des schémas.
 *  a. Écart mesuré : chaque couleur CHOISISSABLE (SCAN_CATEGORY_CHOOSABLE) est à 25 au moins du vert « valide », des
 *     rouges « déjà utilisé » et « refusé », de l'orange « mauvaise zone » et de l'ambre « hors fenêtre » ; OR, encore
 *     affiché pour les catégories qui l'ont déjà, aussi (vieil or, plus l'ancien #FACC15 à 5,1 de l'ambre).
 *  b. Listes : choisissables = palette du scanner sans OR ; propositions automatiques (écran et base) parmi elles.
 *  c. Schéma : OR refusé à la création et à la modification d'une catégorie, les sept autres acceptées.
 *  d. Base : listes de ticket_category_normalize et ticket_category_update (dernière migration qui les définit) = les
 *     choisissables ; contrainte de la table inchangée (8 clés, catégories existantes).
 *  e. Écran : pastilles et liste déroulante tirées des choisissables ; une couleur retirée est dite, à remplacer.
 * Rouge avant le correctif : OR choisissable partout (schéma, écran, base), OR à 5,1 de l'ambre. Sortie brute `[CVF2B-2B]`.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PALETTE = ['BLANC', 'OR', 'ARGENT', 'ROSE', 'TURQUOISE', 'BLEU', 'VIOLET', 'NOIR'];
const CHOOSABLE = ['BLANC', 'ARGENT', 'ROSE', 'TURQUOISE', 'BLEU', 'VIOLET', 'NOIR'];
const VERDICTS: Record<string, string> = {
    'vert « valide »': 'scan-accept-bg', 'rouge « déjà utilisé »': 'scan-used-bg', 'rouge « refusé »': 'scan-refuse-bg',
    'orange « mauvaise zone »': 'scan-orient-bg', 'ambre « hors fenêtre »': 'scan-window-bg',
};

interface Parsed { success: boolean; error?: { issues: Array<{ path: Array<string | number>; message: string }> } }
interface ValidationModule {
    createTicketCategorySchema(ctx: { eventEnd: Date | null }): { safeParse(v: unknown): Parsed };
    updateTicketCategorySchema(ctx: { eventEnd: Date | null; current: Record<string, unknown> }): { safeParse(v: unknown): Parsed };
}
interface ScanResultModule {
    SCAN_CATEGORY_COLORS: readonly string[];
    SCAN_CATEGORY_CHOOSABLE: readonly string[];
    AUTO_SCAN_COLOR_ORDER: readonly string[];
    isChoosableScanColor(v: unknown): boolean;
}

async function load<T>(rel: string): Promise<T> {
    const target = rel;
    return (await import(target)) as T;
}

// ── Écart de couleur perçu (CIEDE2000) : recopie de tests/audit/cvf2b-12-helpers.ts (suite sans base) ──

function cssToken(name: string): [number, number, number] {
    const css = fs.readFileSync(path.join(ROOT, 'app/globals.css'), 'utf8');
    const m = new RegExp(`--${name}:[ ]*([0-9]+)[ ]+([0-9]+)[ ]+([0-9]+)[ ]*;`).exec(css);
    assert.ok(m, `jeton --${name} absent d'app/globals.css`);
    return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function lab([r8, g8, b8]: [number, number, number]): [number, number, number] {
    const lin = (c: number) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    const [r, g, b] = [lin(r8), lin(g8), lin(b8)];
    const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
    const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
    const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
    const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

/** Écart CIEDE2000 (même formule que tests/parcours/f2b-couleur-auto.test.ts). */
function deltaE00(c1: [number, number, number], c2: [number, number, number]): number {
    const [L1, a1, b1] = lab(c1);
    const [L2, a2, b2] = lab(c2);
    const rad = Math.PI / 180;
    const C1 = Math.hypot(a1, b1);
    const C2 = Math.hypot(a2, b2);
    const Cb = (C1 + C2) / 2;
    const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
    const a1p = (1 + G) * a1;
    const a2p = (1 + G) * a2;
    const C1p = Math.hypot(a1p, b1);
    const C2p = Math.hypot(a2p, b2);
    const h1p = (Math.atan2(b1, a1p) / rad + 360) % 360;
    const h2p = (Math.atan2(b2, a2p) / rad + 360) % 360;
    const dLp = L2 - L1;
    const dCp = C2p - C1p;
    let dhp = 0;
    if (C1p * C2p !== 0) { dhp = h2p - h1p; if (dhp > 180) dhp -= 360; else if (dhp < -180) dhp += 360; }
    const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * rad);
    const Lbp = (L1 + L2) / 2;
    const Cbp = (C1p + C2p) / 2;
    let hbp = h1p + h2p;
    if (C1p * C2p !== 0) hbp = Math.abs(h1p - h2p) <= 180 ? (h1p + h2p) / 2 : (h1p + h2p < 360 ? (h1p + h2p + 360) / 2 : (h1p + h2p - 360) / 2);
    const T = 1 - 0.17 * Math.cos((hbp - 30) * rad) + 0.24 * Math.cos(2 * hbp * rad) + 0.32 * Math.cos((3 * hbp + 6) * rad) - 0.2 * Math.cos((4 * hbp - 63) * rad);
    const dTheta = 30 * Math.exp(-(((hbp - 275) / 25) ** 2));
    const Rc = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7));
    const Sl = 1 + (0.015 * (Lbp - 50) ** 2) / Math.sqrt(20 + (Lbp - 50) ** 2);
    const Sc = 1 + 0.045 * Cbp;
    const Sh = 1 + 0.015 * Cbp * T;
    const Rt = -Math.sin(2 * dTheta * rad) * Rc;
    return Math.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh));
}

function read(rel: string): string {
    return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

/** Corps de la DERNIÈRE définition d'une fonction dans les migrations (ordre des noms de fichier). */
function lastDefinition(fn: string): { file: string; body: string } {
    const dir = path.join(ROOT, 'supabase/migrations');
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
    let found: { file: string; body: string } | null = null;
    for (const file of files) {
        const sql = fs.readFileSync(path.join(dir, file), 'utf8');
        const at = sql.lastIndexOf(`CREATE OR REPLACE FUNCTION public.${fn}(`);
        if (at < 0) continue;
        const end = sql.indexOf('\n$$;', at);
        found = { file, body: sql.slice(at, end < 0 ? undefined : end) };
    }
    assert.ok(found, `fonction ${fn} introuvable dans les migrations`);
    return found;
}

function colorLists(body: string): string[][] {
    return [...body.matchAll(/\('BLANC',[^)]*\)/g)].map((m) => [...m[0].matchAll(/'([A-Z]+)'/g)].map((x) => x[1]));
}

describe('a. écart mesuré avec les verdicts du scanner', () => {
    test('chaque couleur choisissable, et OR encore affiché, est à 25 au moins de chaque verdict', async () => {
        const mod = await load<ScanResultModule>('../../lib/scan/scan-result');
        const table: Record<string, Record<string, number>> = {};
        const close: string[] = [];
        for (const key of [...mod.SCAN_CATEGORY_CHOOSABLE, 'OR']) {
            const c = cssToken(`scan-cat-${key.toLowerCase()}-bg`);
            table[key] = {};
            for (const [label, token] of Object.entries(VERDICTS)) {
                const d = Math.round(deltaE00(c, cssToken(token)) * 10) / 10;
                table[key][label] = d;
                if (d < 25) close.push(`${key} à ${d} du ${label}`);
            }
        }
        console.log(`[CVF2B-2B] écarts CIEDE2000, choisissables et OR × verdicts : ${JSON.stringify(table)}`);
        assert.deepEqual(close, [], `couleurs confondables avec un verdict :\n${close.join('\n')}`);
    });
});

describe('b. listes de l’écran', () => {
    test('choisissables = palette sans OR ; propositions automatiques parmi elles ; OR non choisissable', async () => {
        const mod = await load<ScanResultModule>('../../lib/scan/scan-result');
        assert.deepEqual([...mod.SCAN_CATEGORY_COLORS], PALETTE, 'palette du scanner (catégories existantes) inchangée');
        assert.deepEqual([...mod.SCAN_CATEGORY_CHOOSABLE], CHOOSABLE);
        assert.equal(mod.isChoosableScanColor('OR'), false);
        for (const key of CHOOSABLE) assert.equal(mod.isChoosableScanColor(key), true, key);
        for (const key of mod.AUTO_SCAN_COLOR_ORDER) assert.ok(CHOOSABLE.includes(key), `proposition automatique ${key} choisissable`);
        const auto = lastDefinition('ticket_category_auto_color');
        const order = /ARRAY\[([^\]]*)\]::text\[\]/.exec(auto.body);
        assert.ok(order, `liste de ticket_category_auto_color (${auto.file})`);
        const keys = [...order[1].matchAll(/'([A-Z]+)'/g)].map((x) => x[1]);
        assert.ok(!keys.includes('OR') && keys.every((k) => CHOOSABLE.includes(k)), `ticket_category_auto_color (${auto.file}) : ${keys.join(', ')}`);
    });
});

describe('c. schéma des catégories', () => {
    test('OR refusé à la création et à la modification (champ scan_color) ; les sept autres acceptées', async () => {
        const v = await load<ValidationModule>('../../lib/validations/event');
        const create = v.createTicketCategorySchema({ eventEnd: null });
        const update = v.updateTicketCategorySchema({ eventEnd: null, current: { sale_start: null, sale_end: null } });
        const base = { name: 'VIP', price: 0, total_quantity: 10 };
        for (const [label, r] of [['création', create.safeParse({ ...base, scan_color: 'OR' })], ['modification', update.safeParse({ scan_color: 'OR' })]] as const) {
            assert.equal(r.success, false, `${label} : OR accepté`);
            assert.ok(r.error?.issues.some((i) => i.path.join('.') === 'scan_color' && i.message === 'Choisissez une couleur dans la liste.'),
                `${label} : refus porté par scan_color : ${JSON.stringify(r.error?.issues)}`);
        }
        for (const key of CHOOSABLE) {
            assert.equal(create.safeParse({ ...base, scan_color: key }).success, true, `création ${key}`);
            assert.equal(update.safeParse({ scan_color: key }).success, true, `modification ${key}`);
        }
    });
});

describe('d. base', () => {
    test('ticket_category_normalize et ticket_category_update : listes = choisissables ; contrainte de la table : 8 clés', () => {
        for (const fn of ['ticket_category_normalize', 'ticket_category_update']) {
            const def = lastDefinition(fn);
            const lists = colorLists(def.body);
            console.log(`[CVF2B-2B] ${fn} (${def.file}) : ${JSON.stringify(lists)}`);
            assert.equal(lists.length, 1, `${fn} (${def.file}) : une seule liste de couleurs`);
            assert.deepEqual(lists[0], CHOOSABLE, `${fn} (${def.file})`);
        }
        const m09 = read('supabase/migrations/20261110000009_lot9ter_zones.sql');
        const check = /ticket_categories_scan_color_check\s+CHECK \(([^;]*)\);/.exec(m09);
        assert.ok(check, 'contrainte ticket_categories_scan_color_check');
        assert.deepEqual([...check[1].matchAll(/'([A-Z]+)'/g)].map((x) => x[1]), PALETTE);
    });
});

describe('e. écran', () => {
    test('pastilles et liste déroulante tirées des choisissables ; couleur retirée dite', () => {
        const picker = read('components/events/ScanColorPicker.tsx');
        assert.ok(!/SCAN_CATEGORY_COLORS/.test(picker), 'ScanColorPicker ne propose plus la palette entière');
        assert.match(picker, /SCAN_CATEGORY_CHOOSABLE\.map\(\(color, i\)/, 'pastilles : choisissables');
        assert.match(picker, /options=\{SCAN_CATEGORY_CHOOSABLE\.map\(/, 'liste déroulante : choisissables');
        assert.match(picker, /qui n’est plus proposée\. Choisissez-en une autre\./, 'couleur retirée dite');
    });
});
