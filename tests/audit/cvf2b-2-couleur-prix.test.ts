/**
 * Contre-vérification de la finition 2b, attaque 2 — couleur au contrôle, consigne d'entrée et prix minimum d'une
 * catégorie, par CHAQUE chemin d'écriture : création de l'événement (POST /api/partner/events, event_create), nouvelle
 * catégorie (POST …/categories, ticket_category_create), modification (PATCH …/categories/[id], ticket_category_update),
 * REST directe sur ticket_categories avec la session de l'attaquante, RPC avec sa session.
 *
 * Ce que tests/parcours/f2b-couleur-consigne, f2b-couleur-auto et f2b-prix-minimum ne couvrent pas :
 *  a. couleur hors palette, en variantes (casse, espaces, caractères invisibles ou homoglyphes, #RGB, #RRGGBB, rgb(),
 *     noms CSS, types non textuels) sur les trois chemins, route et base ;
 *  b. couleur de la palette confondable avec un verdict du scanner : écart CIEDE2000 de CHAQUE couleur choisissable (pas
 *     seulement les proposées) avec le vert « valide », les rouges, l'orange « mauvaise zone » et l'ambre « hors
 *     fenêtre » ; OR posé à la main par chaque chemin ;
 *  c. consigne : trop longue (variantes d'espaces, lettres décomposées), caractères de contrôle, contrôles
 *     bidirectionnels, balises (jamais interprétées à l'écran) ;
 *  d. prix sous le minimum par chaque chemin, valeurs limites (minimum − 1, 1, négatif, décimal, texte, NaN, Infinity),
 *     et 0 sur une catégorie payante déjà vendue ;
 *  e. session de l'attaquante : REST directe sur ticket_categories, RPC des catégories.
 * Comportement sûr : refus (aucune écriture) ; pour la consigne, refus OU valeur enregistrée sans caractère de contrôle
 * ni contrôle bidirectionnel. Une attaque réussie = une écriture de la valeur. Sortie brute `[CVF2B-2]`.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { newBuyer, service } from '../parcours/paiement-helpers';
import { buyConfirmed, newPartner, type TestPartner } from '../parcours/finance-helpers';
import { createTimedEvent } from '../parcours/acces-helpers';
import { createDraftEvent, storedPosterUrl, type DraftEvent } from '../parcours/cycle-helpers';
import { assertFinition1Invariants } from '../helpers/finition1-invariants';
import {
    asAttacker, asServer, categoriesOf, categoryRow, cssToken, deltaE00, eventBody, is2xx, list, lit, mark, minPaidPrice,
    nothingWritten, patchCategory, postCategory, postEvent, rpcEvent, show, showBase, traces, userClient, type Row,
} from './cvf2b-12-helpers';

const ROOT = process.cwd();
const PALETTE = ['BLANC', 'OR', 'ARGENT', 'ROSE', 'TURQUOISE', 'BLEU', 'VIOLET', 'NOIR'] as const;

let A: TestPartner;
let poster: string;
let minimum: number;
let D: DraftEvent;   // brouillon de l'attaquante : « Standard » (payant) et « Libre » (gratuit)

before(async () => {
    A = await newPartner('cvf2b-2');
    poster = await storedPosterUrl(A.partnerId);
    minimum = await minPaidPrice();
    D = await createDraftEvent(A, 'cvf2b-2', [{ name: 'Standard', price: 2_000, total: 50 }, { name: 'Libre', price: 0, total: 50 }], { startsInHours: 96 });
});

after(async () => {
    await assertFinition1Invariants('cvf2b-2-couleur-prix');
});

// ── Chemins d'écriture d'une valeur de catégorie ───────────────────────────

type Field = 'scan_color' | 'entry_instruction' | 'price';

interface Outcome { path: string; value: unknown; refused: boolean; stored: unknown; observed: string }

function baseCategory(m: string, field: Field, value: unknown): Row {
    const cat: Row = { name: `Cat ${m}`, price: field === 'price' ? value : 0, total_quantity: 10 };
    if (field !== 'price') cat[field] = value;
    return cat;
}

/** Valeur enregistrée pour la catégorie marquée `m` (création ou nouvelle catégorie), ou undefined si aucune ligne. */
async function storedFor(m: string, field: Field): Promise<{ count: number; value: unknown }> {
    const { data, error } = await service.from('ticket_categories').select(`id, ${field}`).ilike('name', `%${m}%`);
    assert.equal(error, null, error?.message);
    const rows = (data ?? []) as unknown as Row[];
    return { count: rows.length, value: rows.length > 0 ? rows[0][field] : undefined };
}

/**
 * Essaie `value` sur `field` par les six chemins (trois routes, trois fonctions en base). La modification vise la
 * catégorie `target` du brouillon (remise dans son état d'origine après une écriture acceptée, pour l'essai suivant).
 */
async function tryAllPaths(field: Field, value: unknown, target: { eventId: string; categoryId: string }): Promise<Outcome[]> {
    const out: Outcome[] = [];
    const record = (o: Outcome) => {
        console.log(`[CVF2B-2] ${field} = ${lit(value)} par ${o.path} → ${o.observed.slice(0, 300)} ; enregistré : ${lit(o.stored)}`);
        out.push(o);
    };

    // 1. Création de l'événement par la route
    {
        const m = mark();
        const before = await traces(m, A.userId);
        const r = await postEvent(A.accessToken, eventBody(`TEST CVF2B-2 ${m}`, poster, [baseCategory(m, field, value)]));
        const after = await traces(m, A.userId);
        const s = await storedFor(m, field);
        record({ path: 'route POST /api/partner/events', value, refused: !is2xx(r) && nothingWritten(before, after), stored: s.value, observed: show(r) });
    }
    // 2. Nouvelle catégorie par la route
    {
        const m = mark();
        const r = await postCategory(A.accessToken, target.eventId, baseCategory(m, field, value));
        const s = await storedFor(m, field);
        record({ path: 'route POST …/categories', value, refused: !is2xx(r) && s.count === 0, stored: s.value, observed: show(r) });
        if (s.count > 0) await service.from('ticket_categories').delete().ilike('name', `%${m}%`);
    }
    // 3. Modification par la route
    {
        const before = await categoryRow(target.categoryId);
        const r = await patchCategory(A.accessToken, target.eventId, target.categoryId, { [field]: value });
        const after = await categoryRow(target.categoryId);
        record({ path: 'route PATCH …/categories/[id]', value, refused: !is2xx(r) && JSON.stringify(after) === JSON.stringify(before), stored: after[field], observed: show(r) });
        if (JSON.stringify(after) !== JSON.stringify(before)) await restoreCategory(before);
    }
    // 4. event_create en base
    {
        const m = mark();
        const before = await traces(m, A.userId);
        const r = await asServer('event_create', { actor_id: A.userId, event: rpcEvent(`TEST CVF2B-2 base ${m}`), ticket_categories: [baseCategory(m, field, value)] });
        const after = await traces(m, A.userId);
        const s = await storedFor(m, field);
        record({ path: 'base event_create', value, refused: !r.ok && nothingWritten(before, after), stored: s.value, observed: showBase(r) });
    }
    // 5. ticket_category_create en base
    {
        const m = mark();
        const r = await asServer('ticket_category_create', { event_id: target.eventId, actor_id: A.userId, category: baseCategory(m, field, value) });
        const s = await storedFor(m, field);
        record({ path: 'base ticket_category_create', value, refused: !r.ok && s.count === 0, stored: s.value, observed: showBase(r) });
        if (s.count > 0) await service.from('ticket_categories').delete().ilike('name', `%${m}%`);
    }
    // 6. ticket_category_update en base
    {
        const before = await categoryRow(target.categoryId);
        const r = await asServer('ticket_category_update', { event_id: target.eventId, category_id: target.categoryId, actor_id: A.userId, patch: { [field]: value } });
        const after = await categoryRow(target.categoryId);
        record({ path: 'base ticket_category_update', value, refused: !r.ok && JSON.stringify(after) === JSON.stringify(before), stored: after[field], observed: showBase(r) });
        if (JSON.stringify(after) !== JSON.stringify(before)) await restoreCategory(before);
    }
    return out;
}

/** Remet une catégorie dans l'état relevé (montage, service_role) : chaque essai part du même état. */
async function restoreCategory(row: Row): Promise<void> {
    const { error } = await service.from('ticket_categories')
        .update({ price: row.price, scan_color: row.scan_color, entry_instruction: row.entry_instruction, name: row.name, total_quantity: row.total_quantity, is_active: row.is_active })
        .eq('id', String(row.id));
    assert.equal(error, null, `catégorie remise en état (montage) : ${error?.message}`);
}

function standard(): { eventId: string; categoryId: string } {
    return { eventId: D.eventId, categoryId: D.categories['Standard'].id };
}

// ── Témoin ─────────────────────────────────────────────────────────────────

describe('témoin : les six chemins écrivent une valeur légitime', () => {
    test('couleur BLEU, consigne « Bracelet bleu », prix au minimum : acceptés partout', async () => {
        const failures: string[] = [];
        for (const [field, value] of [['scan_color', 'BLEU'], ['entry_instruction', 'Bracelet bleu'], ['price', minimum]] as Array<[Field, unknown]>) {
            for (const o of await tryAllPaths(field, value, standard())) {
                if (o.refused || String(o.stored) !== String(value)) failures.push(`${field} = ${lit(value)} par ${o.path} : refusé ou mal écrit (${o.observed.slice(0, 200)} ; enregistré ${lit(o.stored)})`);
            }
        }
        assert.deepEqual(failures, [], `chemins fermés pour une valeur légitime (le témoin ne prouve rien) :\n${list(failures)}`);
    });
});

// ── a. Couleur hors palette ────────────────────────────────────────────────

describe('a. couleur hors de la palette, en variantes', () => {
    const variants: unknown[] = [
        'VERT', 'ROUGE', 'ORANGE', 'AMBRE', 'JAUNE', 'vert', 'blanc', 'Blanc', ' BLANC', 'BLANC ', 'BL ANC', 'BLANC​', '​NOIR',
        'ВLANC' /* В cyrillique */, 'ＢＬＡＮＣ' /* BLANC pleine chasse */, 'BLANC\n', 'BLANC;VERT', 'BLANC,VERT',
        '#FFF', '#fff', '#0F0', '#FFFFFF', '#4ADE80', '#4ade80', '#FB923C', '#7F1D1D', '#FBBF24', 'rgb(74, 222, 128)', 'rgb(74,222,128)',
        'hsl(142, 69%, 58%)', 'green', 'red', 'orange', 'gold', 'lime', 'transparent', 'inherit', '', 0, 1, true, ['BLANC'], { cle: 'BLANC' },
    ];

    test('six chemins : chaque variante refusée, rien d’écrit', async () => {
        const breaches: string[] = [];
        for (const v of variants) {
            for (const o of await tryAllPaths('scan_color', v, standard())) {
                if (!o.refused) breaches.push(`${lit(v)} par ${o.path} : ${o.observed.slice(0, 160)} ; enregistré ${lit(o.stored)}`);
            }
        }
        assert.deepEqual(breaches, [], `couleurs hors palette écrites :\n${list(breaches)}`);
    });
});

// ── b. Couleur confondable avec un verdict ─────────────────────────────────

describe('b. couleur de la palette confondable avec un verdict du scanner', () => {
    const verdicts = {
        'vert « valide »': 'scan-accept-bg', 'rouge « déjà utilisé »': 'scan-used-bg', 'rouge « refusé »': 'scan-refuse-bg',
        'orange « mauvaise zone »': 'scan-orient-bg', 'ambre « hors fenêtre »': 'scan-window-bg',
    };

    test('chaque couleur CHOISISSABLE (palette fermée, base et écran) est à 25 au moins de chaque verdict', () => {
        const source = fs.readFileSync(path.join(ROOT, 'lib/scan/scan-result.ts'), 'utf8');
        const m = /SCAN_CATEGORY_COLORS\s*=\s*\[([^\]]*)\]/.exec(source);
        assert.ok(m, 'SCAN_CATEGORY_COLORS lisible dans lib/scan/scan-result.ts');
        const choosable = [...m[1].matchAll(/'([A-Z]+)'/g)].map((x) => x[1]);
        assert.deepEqual([...choosable].sort(), [...PALETTE].sort(), 'palette de l’écran = palette de la base');
        const close: string[] = [];
        const table: Record<string, Record<string, number>> = {};
        for (const key of choosable) {
            const c = cssToken(`scan-cat-${key.toLowerCase()}-bg`);
            table[key] = {};
            for (const [label, t] of Object.entries(verdicts)) {
                const d = Math.round(deltaE00(c, cssToken(t)) * 10) / 10;
                table[key][label] = d;
                if (d < 25) close.push(`${key} à ${d} du ${label}`);
            }
        }
        console.log(`[CVF2B-2] écarts CIEDE2000, palette choisissable × verdicts : ${JSON.stringify(table)}`);
        assert.deepEqual(close, [], `couleurs choisissables confondables avec un verdict (seuil 25 de la finition 2b) :\n${list(close)}`);
    });

    test('OR posé à la main par chacun des six chemins : refusé', async () => {
        const breaches: string[] = [];
        for (const o of await tryAllPaths('scan_color', 'OR', standard())) {
            if (!o.refused) breaches.push(`OR par ${o.path} : ${o.observed.slice(0, 160)} ; enregistré ${lit(o.stored)}`);
        }
        assert.deepEqual(breaches, [], `couleur OR (5,1 de l’ambre « hors fenêtre », 24,0 de l’orange « mauvaise zone ») écrite :\n${list(breaches)}`);
    });
});

// ── c. Consigne d'entrée ───────────────────────────────────────────────────

/** Caractères de contrôle (C0, DEL, C1). */
const CONTROL_RE = /[\u0000-\u001f\u007f-\u009f]/;
/** Contrôles bidirectionnels (marques, enchâssements, forçages, isolats). */
const BIDI_RE = /[‎‏‪-‮⁦-⁩]/;

function consigneBreaches(outcomes: Outcome[], forbidden: RegExp): string[] {
    return outcomes
        .filter((o) => !o.refused && typeof o.stored === 'string' && forbidden.test(o.stored))
        .map((o) => `${lit(o.value)} par ${o.path} : enregistré ${lit(o.stored)} (${o.observed.slice(0, 120)})`);
}

describe('c. consigne d’entrée', () => {
    test('trop longue (61 caractères visibles et variantes) : refusée par les six chemins', async () => {
        const variants = [
            'x'.repeat(61),
            `   ${'x'.repeat(61)}   `,
            `${'x'.repeat(30)} ${'y'.repeat(31)}`,
            `${'x'.repeat(31)}${'\n'.repeat(40)}${'y'.repeat(30)}`,
            'é'.repeat(31),
            'É'.repeat(61),
        ];
        const breaches: string[] = [];
        for (const v of variants) {
            for (const o of await tryAllPaths('entry_instruction', v, standard())) {
                const stored = typeof o.stored === 'string' ? o.stored : '';
                if (!o.refused && [...stored].length > 60) breaches.push(`${lit(v).slice(0, 60)}… par ${o.path} : ${[...stored].length} caractères enregistrés`);
            }
        }
        assert.deepEqual(breaches, [], `consignes de plus de 60 caractères écrites :\n${list(breaches)}`);
    });

    test('caractères de contrôle (BEL, ESC, BS, DEL, NEL, NUL) : refus ou retirés, par les six chemins', async () => {
        const variants = ['Entrée\u0007 VIP', 'Bracelet \u001b[31mrouge\u001b[0m', 'Porte\u0008\u0008\u0008 B', 'Zone\u007f A', 'Ligne\u0085suite', 'Nul\u0000 octet'];
        const breaches: string[] = [];
        for (const v of variants) breaches.push(...consigneBreaches(await tryAllPaths('entry_instruction', v, standard()), CONTROL_RE));
        assert.deepEqual(breaches, [], `consignes enregistrées avec des caractères de contrôle (les noms de zone et de porte les refusent : [[:cntrl:]]) :\n${list(breaches)}`);
    });

    test('contrôles bidirectionnels (U+202E, U+2066…U+2069, U+200F) : refus ou retirés, par les six chemins', async () => {
        const variants = ['VIP ‮PIV ecnartne‬', 'Carré ⁦⁧B⁩⁩', 'Bracelet‏ rouge'];
        const breaches: string[] = [];
        for (const v of variants) breaches.push(...consigneBreaches(await tryAllPaths('entry_instruction', v, standard()), BIDI_RE));
        assert.deepEqual(breaches, [], `consignes enregistrées avec des contrôles bidirectionnels (texte retourné à l’écran du contrôleur) :\n${list(breaches)}`);
    });

    test('balises : la consigne n’est jamais interprétée comme du HTML à l’écran', async () => {
        // Écriture observée (pas un manquement en soi : React échappe le texte)
        for (const v of ['<b>VIP</b><script>alert(1)</script>', '<img src=x onerror=alert(1)>']) {
            const m = mark();
            const r = await postEvent(A.accessToken, eventBody(`TEST CVF2B-2 html ${m}`, poster, [baseCategory(m, 'entry_instruction', v)]));
            const s = await storedFor(m, 'entry_instruction');
            console.log(`[CVF2B-2] consigne ${lit(v)} par la route → ${show(r).slice(0, 200)} ; enregistrée ${lit(s.value)}`);
        }
        // Tout fichier d'écran ou de serveur qui lit la consigne : aucun puits HTML
        const sinks = /dangerouslySetInnerHTML|\.innerHTML\s*=|\.outerHTML\s*=|insertAdjacentHTML|document\.write\(/;
        const offenders: string[] = [];
        const walk = (dir: string) => {
            for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
                const p = path.join(dir, e.name);
                if (e.isDirectory()) { if (e.name !== 'node_modules' && !e.name.startsWith('.')) walk(p); continue; }
                if (!/\.(tsx?|jsx?)$/.test(e.name)) continue;
                const text = fs.readFileSync(p, 'utf8');
                if (/entry_instruction|entryInstruction/.test(text) && sinks.test(text)) offenders.push(path.relative(ROOT, p).replace(/\\/g, '/'));
            }
        };
        for (const d of ['app', 'components', 'lib']) walk(path.join(ROOT, d));
        console.log(`[CVF2B-2] fichiers qui lisent la consigne et contiennent un puits HTML : ${JSON.stringify(offenders)}`);
        assert.deepEqual(offenders, [], `consigne rendue par un puits HTML :\n${list(offenders)}`);
    });
});

// ── d. Prix sous le minimum ────────────────────────────────────────────────

describe('d. prix sous le minimum', () => {
    test('valeurs limites par les six chemins : refusées, rien d’écrit', async () => {
        const values: unknown[] = [minimum - 1, 1, -1, -minimum, 0.5, minimum - 0.5, minimum + 0.5, String(minimum - 1), `${minimum - 1}e0`, 'NaN', 'Infinity', '-Infinity', null, 10_000_001];
        const breaches: string[] = [];
        for (const v of values) {
            for (const o of await tryAllPaths('price', v, standard())) {
                if (!o.refused) breaches.push(`prix ${lit(v)} par ${o.path} : ${o.observed.slice(0, 160)} ; enregistré ${lit(o.stored)}`);
            }
        }
        assert.deepEqual(breaches, [], `prix hors règle écrits (minimum ${minimum}) :\n${list(breaches)}`);
    });

    test('0 (et minimum − 1) sur une catégorie payante déjà vendue : refusé (PRICE_LOCKED_AFTER_SALES), prix gardé', async () => {
        const ev = await createTimedEvent(A.partnerId, 'cvf2b-2-vendu', [{ name: 'Payant', price: 5_000, total: 20 }], { startsInHours: 48 });
        await buyConfirmed(await newBuyer('cvf2b-2-acheteur'), ev, [['Payant', 1]]);
        const catId = ev.categories['Payant'].id;
        const breaches: string[] = [];
        for (const price of [0, minimum - 1, 4_999]) {
            const before = await categoryRow(catId);
            const r = await patchCategory(A.accessToken, ev.eventId, catId, { price });
            const mid = await categoryRow(catId);
            const b = await asServer('ticket_category_update', { event_id: ev.eventId, category_id: catId, actor_id: A.userId, patch: { price } });
            const after = await categoryRow(catId);
            console.log(`[CVF2B-2] catégorie vendue, prix ${price} : route → ${show(r).slice(0, 200)} ; base → ${showBase(b)} ; prix ${before.price} → ${mid.price} → ${after.price}`);
            if (is2xx(r) || Number(mid.price) !== Number(before.price)) breaches.push(`route PATCH, prix ${price} : ${show(r).slice(0, 160)} ; prix ${before.price} → ${mid.price}`);
            if (b.ok || Number(after.price) !== Number(before.price)) breaches.push(`base ticket_category_update, prix ${price} : ${showBase(b).slice(0, 160)} ; prix ${mid.price} → ${after.price}`);
            if (!is2xx(r) && r.body.code !== 'PRICE_LOCKED_AFTER_SALES' && r.body.code !== 'PRICE_BELOW_MINIMUM') breaches.push(`route PATCH, prix ${price} : refus inattendu ${show(r).slice(0, 160)}`);
        }
        assert.deepEqual(breaches, [], `prix d’une catégorie vendue modifié :\n${list(breaches)}`);
    });
});

// ── e. Session de l'attaquante ─────────────────────────────────────────────

describe('e. session de l’attaquante : REST directe et RPC des catégories', () => {
    test('REST : modification et insertion sur ticket_categories (couleur, consigne, prix) refusées', async () => {
        const db = userClient(A.accessToken);
        const catId = D.categories['Standard'].id;
        const m = mark();
        const before = await categoryRow(catId);
        const attempts: Array<[string, () => PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>]> = [
            ['UPDATE scan_color = VERT', () => db.from('ticket_categories').update({ scan_color: 'VERT' }).eq('id', catId).select()],
            ['UPDATE scan_color = OR', () => db.from('ticket_categories').update({ scan_color: 'OR' }).eq('id', catId).select()],
            ['UPDATE entry_instruction (BEL, 80 caractères)', () => db.from('ticket_categories').update({ entry_instruction: `\u0007${'x'.repeat(79)}` }).eq('id', catId).select()],
            ['UPDATE price = 1', () => db.from('ticket_categories').update({ price: 1 }).eq('id', catId).select()],
            ['INSERT catégorie à 1 F CFA, couleur VERT', () => db.from('ticket_categories').insert({ event_id: D.eventId, name: `Cat ${m}`, price: 1, total_quantity: 10, sold_quantity: 0, scan_color: 'VERT' }).select()],
        ];
        const breaches: string[] = [];
        for (const [label, run] of attempts) {
            const { data, error } = await run();
            const rows = Array.isArray(data) ? data : [];
            console.log(`[CVF2B-2] REST ticket_categories, ${label} → ${error ? `erreur ${error.code ?? ''} ${error.message}` : `${rows.length} ligne(s) ${JSON.stringify(rows).slice(0, 200)}`}`);
            if (!error && rows.length > 0) breaches.push(`${label} : ${rows.length} ligne(s) ${JSON.stringify(rows).slice(0, 200)}`);
        }
        const after = await categoryRow(catId);
        if (JSON.stringify(after) !== JSON.stringify(before)) breaches.push(`catégorie changée : avant ${JSON.stringify(before)} après ${JSON.stringify(after)}`);
        const s = await storedFor(m, 'price');
        if (s.count !== 0) breaches.push(`catégorie insérée (${s.count})`);
        assert.deepEqual(breaches, [], `REST directe sur ticket_categories :\n${list(breaches)}`);
    });

    test('RPC event_create, ticket_category_create, ticket_category_update, ticket_category_normalize, ticket_category_auto_color : refusées', async () => {
        const catId = D.categories['Standard'].id;
        const m = mark();
        const before = await categoryRow(catId);
        const tBefore = await traces(m, A.userId);
        const calls: Array<[string, Row]> = [
            ['event_create', { p: { actor_id: A.userId, event: rpcEvent(`TEST CVF2B-2 e ${m}`), ticket_categories: [{ name: `Cat ${m}`, price: 1, total_quantity: 5, scan_color: 'OR', entry_instruction: '\u0007' }] } }],
            ['ticket_category_create', { p: { event_id: D.eventId, actor_id: A.userId, category: { name: `Cat ${m}`, price: 1, total_quantity: 5 } } }],
            ['ticket_category_update', { p: { event_id: D.eventId, category_id: catId, actor_id: A.userId, patch: { price: 1, scan_color: 'OR', entry_instruction: '\u0007' } } }],
            ['ticket_category_normalize', { p_cat: { name: 'x', price: 1, total_quantity: 1 }, p_event_end: null, p_prefix: '' }],
            ['ticket_category_auto_color', { p_event: D.eventId, p_exclude: null }],
        ];
        const breaches: string[] = [];
        for (const [fn, args] of calls) {
            const r = await asAttacker(A.accessToken, fn, args);
            console.log(`[CVF2B-2] REST rpc/${fn} (jeton de l’attaquante) → ok=${r.ok} ${r.error ?? JSON.stringify(r.data).slice(0, 300)}`);
            if (r.ok) breaches.push(`${fn} exécutée : ${JSON.stringify(r.data).slice(0, 200)}`);
        }
        const after = await categoryRow(catId);
        const tAfter = await traces(m, A.userId);
        if (JSON.stringify(after) !== JSON.stringify(before)) breaches.push(`catégorie changée : avant ${JSON.stringify(before)} après ${JSON.stringify(after)}`);
        if (!nothingWritten(tBefore, tAfter)) breaches.push(`écritures : avant ${JSON.stringify(tBefore)} après ${JSON.stringify(tAfter)}`);
        assert.deepEqual(breaches, [], `fonctions des catégories par la REST :\n${list(breaches)}`);
    });
});

// ── Catégories du brouillon après la suite (sortie brute) ─────────────────

describe('relevé', () => {
    test('catégories du brouillon de l’attaquante', async () => {
        console.log(`[CVF2B-2] catégories du brouillon ${D.eventId} : ${lit(await categoriesOf(D.eventId))}`);
    });
});

