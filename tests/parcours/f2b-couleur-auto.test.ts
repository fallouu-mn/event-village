/**
 * Finition 2b (A, E-22) — couleur au contrôle proposée automatiquement par l'écran, distincte pour chaque catégorie de
 * l'événement, choisie dans la palette existante du scanner, jamais confondable avec le vert « valide », le rouge
 * « refusé » ou l'orange « mauvaise porte » ; posée par la base si elle manque ; modifiable.
 *  a. Écart de couleur mesuré (CIEDE2000, jetons d'app/globals.css) : chaque couleur proposée est à 25 au moins du vert
 *     « valide », des deux rouges (« déjà utilisé », « refusé ») et de l'orange « mauvaise zone » ; OR (24,0 de l'orange,
 *     5,1 de l'ambre « hors fenêtre ») est exclu des propositions, il reste choisissable à la main.
 *  b. proposeScanColor : ordre BLANC, NOIR, VIOLET, ROSE, TURQUOISE, BLEU, ARGENT (chaque nouvelle couleur la plus éloignée
 *     des précédentes) ; couleur déjà prise sautée ; les 7 prises : la moins employée, dans cet ordre ; jamais OR.
 *  c. Base : une catégorie insérée sans couleur en reçoit une, distincte de celles de l'événement, dans le même ordre ;
 *     une couleur choisie est gardée ; remise à vide, elle est reposée ; 8 catégories : la 8e prend la moins employée.
 *  d. Même ordre à l'écran et en base (lu dans la migration).
 *  e. Catégories existantes sans couleur : colorées par la migration (transaction annulée, déclencheur coupé au montage).
 *  f. Écran : plus de choix « Aucune couleur » ; une catégorie ajoutée reçoit la couleur proposée.
 * Rouge avant le correctif : proposeScanColor absente, catégories sans couleur, « Aucune couleur » proposée. Sortie brute
 * `[F2B-A2]`.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { inRolledBackTransaction } from '../helpers/db';
import { importModule, service } from './paiement-helpers';
import { newPartner, type TestPartner } from './finance-helpers';
import { createDraftEvent } from './cycle-helpers';
import { assertFinition1Invariants } from '../helpers/finition1-invariants';

const ROOT = process.cwd();
const ORDER = ['BLANC', 'NOIR', 'VIOLET', 'ROSE', 'TURQUOISE', 'BLEU', 'ARGENT'];
const MIGRATION = 'supabase/migrations/20261119000003_f2b_couleur_auto.sql';
const SCAN_RESULT = '../../lib/scan/scan-result';

let P: TestPartner;

before(async () => {
    P = await newPartner('f2b-couleur-auto');
});

after(async () => {
    await assertFinition1Invariants('f2b-couleur-auto');
});

// ── Écart de couleur perçu (CIEDE2000), jetons « r g b » d'app/globals.css ──

function token(css: string, name: string): [number, number, number] {
    const m = new RegExp(`--${name}:\\s*(\\d+)\\s+(\\d+)\\s+(\\d+)\\s*;`).exec(css);
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

describe('a. jamais confondable avec un verdict (écart mesuré)', () => {
    const css = fs.readFileSync(path.join(ROOT, 'app/globals.css'), 'utf8');
    const verdicts = { 'vert valide': 'scan-accept-bg', 'rouge déjà utilisé': 'scan-used-bg', 'rouge refusé': 'scan-refuse-bg', 'orange mauvaise zone': 'scan-orient-bg' };
    test('chaque couleur proposée est à 25 au moins des verdicts ; OR ne l’est pas', () => {
        const table: Record<string, Record<string, number>> = {};
        for (const key of [...ORDER, 'OR']) {
            const c = token(css, `scan-cat-${key.toLowerCase()}-bg`);
            table[key] = Object.fromEntries(Object.entries(verdicts).map(([label, t]) => [label, Math.round(deltaE00(c, token(css, t)) * 10) / 10]));
        }
        console.log(`[F2B-A2] écarts CIEDE2000 avec les verdicts : ${JSON.stringify(table)}`);
        for (const key of ORDER) {
            for (const [label, d] of Object.entries(table[key])) assert.ok(d >= 25, `${key} trop proche du ${label} : ${d}`);
        }
        assert.ok(Math.min(...Object.values(table.OR)) < 25, `OR serait proposable : ${JSON.stringify(table.OR)}`);
    });
});

describe('b. proposeScanColor (écran)', () => {
    test('ordre, couleurs prises sautées, la moins employée au-delà de 7, jamais OR', async () => {
        const mod = await importModule(SCAN_RESULT);
        assert.equal(typeof mod.proposeScanColor, 'function', 'proposeScanColor exportée par lib/scan/scan-result.ts');
        assert.deepEqual(mod.AUTO_SCAN_COLOR_ORDER, ORDER, 'ordre des propositions');
        const propose = mod.proposeScanColor as (used: ReadonlyArray<string | null | undefined>) => string;
        const seq: string[] = [];
        for (let i = 0; i < 7; i++) seq.push(propose(seq));
        assert.deepEqual(seq, ORDER, 'sept catégories, sept couleurs distinctes');
        assert.equal(propose(['BLANC', 'VIOLET', null, '']), 'NOIR', 'couleur prise sautée, vides ignorés');
        assert.equal(propose([...ORDER]), 'BLANC', 'les 7 prises : la moins employée, dans l’ordre');
        assert.equal(propose([...ORDER, 'BLANC', 'NOIR']), 'VIOLET', 'la moins employée');
        assert.equal(propose(['OR']), 'BLANC', 'OR choisi à la main n’empêche rien');
        assert.ok(!seq.includes('OR'));
    });
});

async function colorsOf(eventId: string): Promise<Record<string, string | null>> {
    const { data, error } = await service.from('ticket_categories').select('name, scan_color').eq('event_id', eventId);
    assert.equal(error, null, error?.message);
    return Object.fromEntries((data ?? []).map((r) => [String(r.name), (r.scan_color as string | null) ?? null]));
}

describe('c. base : couleur posée si elle manque', () => {
    test('insertions sans couleur : BLANC, NOIR, VIOLET ; couleur choisie gardée ; remise à vide reposée', async () => {
        const ev = await createDraftEvent(P, 'f2b-a2-base', [{ name: 'Standard', price: 0, total: 10 }, { name: 'VIP', price: 0, total: 5 }], { startsInHours: 96 });
        const { error: insErr } = await service.from('ticket_categories').insert([
            { event_id: ev.eventId, name: 'Étudiant', price: 0, total_quantity: 5, sold_quantity: 0, is_active: true },
            { event_id: ev.eventId, name: 'Presse', price: 0, total_quantity: 5, sold_quantity: 0, is_active: true, scan_color: 'OR' },
        ]);
        assert.equal(insErr, null, insErr?.message);
        const first = await colorsOf(ev.eventId);
        console.log(`[F2B-A2] couleurs posées par la base : ${JSON.stringify(first)}`);
        assert.deepEqual(first, { Standard: 'BLANC', VIP: 'NOIR', 'Étudiant': 'VIOLET', Presse: 'OR' });
        const { error: upErr } = await service.from('ticket_categories').update({ scan_color: null }).eq('id', ev.categories.VIP.id);
        assert.equal(upErr, null, upErr?.message);
        const second = await colorsOf(ev.eventId);
        assert.equal(second.VIP, 'NOIR', `couleur reposée (la première libre) : ${JSON.stringify(second)}`);
    });

    test('8 catégories sans couleur : 7 distinctes, la 8e prend la moins employée', async () => {
        const names = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8'];
        const ev = await createDraftEvent(P, 'f2b-a2-huit', names.map((name) => ({ name, price: 0, total: 2 })), { startsInHours: 96 });
        const colors = await colorsOf(ev.eventId);
        console.log(`[F2B-A2] 8 catégories : ${JSON.stringify(colors)}`);
        assert.deepEqual(names.map((n) => colors[n]), [...ORDER, 'BLANC']);
    });
});

describe('d. même ordre à l’écran et en base', () => {
    test('ARRAY[…] de la migration = AUTO_SCAN_COLOR_ORDER', () => {
        const sql = fs.readFileSync(path.join(ROOT, MIGRATION), 'utf8');
        const m = /ARRAY\[((?:'[A-Z]+',?\s*){7})\]::text\[\]/.exec(sql);
        assert.ok(m, `ordre des couleurs introuvable dans ${MIGRATION}`);
        const order = m[1].split(',').map((s) => s.trim().replace(/'/g, '')).filter(Boolean);
        assert.deepEqual(order, ORDER);
    });
});

describe('e. catégories existantes sans couleur : colorées par la migration', () => {
    test('migration rejouée sur une catégorie restée sans couleur (transaction annulée)', async () => {
        const sql = fs.readFileSync(path.join(ROOT, MIGRATION), 'utf8');
        const ev = await createDraftEvent(P, 'f2b-a2-rattrapage', [{ name: 'Standard', price: 0, total: 10 }], { startsInHours: 96 });
        await inRolledBackTransaction(async (db) => {
            await db.query('ALTER TABLE public.ticket_categories DISABLE TRIGGER trg_ticket_categories_auto_color');
            await db.query(`INSERT INTO public.ticket_categories (event_id, name, price, total_quantity, sold_quantity, is_active)
                            VALUES ($1, 'Sans couleur', 0, 5, 0, true)`, [ev.eventId]);
            await db.query('ALTER TABLE public.ticket_categories ENABLE TRIGGER trg_ticket_categories_auto_color');
            const before = await db.query(`SELECT scan_color FROM public.ticket_categories WHERE event_id = $1 AND name = 'Sans couleur'`, [ev.eventId]);
            assert.equal(before.rows[0].scan_color, null, 'précondition : catégorie sans couleur');
            await db.query(sql);
            const after = await db.query(`SELECT name, scan_color FROM public.ticket_categories WHERE event_id = $1 ORDER BY name`, [ev.eventId]);
            console.log(`[F2B-A2] après la migration : ${JSON.stringify(after.rows)}`);
            assert.deepEqual(after.rows, [{ name: 'Sans couleur', scan_color: 'NOIR' }, { name: 'Standard', scan_color: 'BLANC' }]);
        });
    });
});

describe('f. écran : couleur proposée, plus de « Aucune couleur »', () => {
    const ticketing = fs.readFileSync(path.join(ROOT, 'components/events/EventTicketing.tsx'), 'utf8');
    const form = fs.readFileSync(path.join(ROOT, 'components/events/EventForm.tsx'), 'utf8');
    test('aucun choix « Aucune couleur »', () => {
        assert.doesNotMatch(ticketing, /Aucune couleur/);
    });
    test('une catégorie ajoutée reçoit proposeScanColor (création et modification)', () => {
        assert.match(form, /proposeScanColor\(/, 'EventForm : couleur proposée à l’ajout d’une catégorie');
        assert.match(ticketing, /proposeScanColor\(/, 'EventTicketingManager : couleur proposée à l’ajout d’une catégorie');
    });
});
