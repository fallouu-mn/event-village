/**
 * Lot 8, tâche 8.0 — canaux de vente : libellés, formulaire, guichet, pilotage (contrat, sections 3.3, 4.1, 4.2,
 * 4.3 ; décisions L5, L11, L13 ; AR8). Suite statique, sans base : modules purs importés, composants rendus par
 * renderToStaticMarkup (le formulaire réel, pas son texte), sources relues pour ce qui ne se rend pas seul.
 *  - lib/events/category-channels.ts : categoryChannelLabel sur les quatre cas, CATEGORY_CHANNEL_HELP, aide de
 *    `none` mot pour mot ;
 *  - lib/validations/event.ts : sale_online et sale_counter booléens, is_visible alias sans défaut, catégorie
 *    sans canal permise ;
 *  - EventTicketing : deux cases « Vendue en ligne » et « Vendue au guichet », chacune avec son aide reliée par
 *    aria-describedby en text-sm, résumé sous les cases, ligne d'état ;
 *  - CounterSalePanel : mention « Sur place uniquement » d'au moins 14 px ;
 *  - SalesTab, page d'administration : libellé de canal à la place de « (masquée) » et « Masquée » ;
 *  - aucun is_visible lu hors de la liste blanche (alias API, code mort, type de compatibilité).
 *
 * Rouge avant correctif : lib/events/category-channels.ts n'existe pas (l'échec nomme le module), le schéma
 * .strict() refuse sale_online et sale_counter (lib/validations/event.ts:310), EventTicketing ne connaît que
 * is_visible (components/events/EventTicketing.tsx:26,38,296), le panneau ignore on_site_only
 * (components/scan/CounterSalePanel.tsx:210-213), is_visible est lu par cinq fichiers hors liste blanche.
 *
 * Suite sans écriture ni base : aucun appel d'invariants (écart signalé, précédent r24).
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const CHANNELS_MODULE = '../../lib/events/category-channels';
const TICKETING_MODULE = '../../components/events/EventTicketing';
const VALIDATION_MODULE = '../../lib/validations/event';

/** Aide de `none`, mot pour mot (contrat 4.1, AR8, L11). */
const NONE_HELP = 'Cette catégorie n’est vendue ni en ligne ni au guichet. L’application n’envoie pas encore d’invitations : aucun billet ne sera distribué pour le moment.';

const CASES: Array<[boolean, boolean, string]> = [
    [true, true, 'En ligne et au guichet'],
    [true, false, 'En ligne uniquement'],
    [false, true, 'Sur place uniquement'],
    [false, false, 'Invitations seulement'],
];

/**
 * Seuls fichiers d'app/, components/, lib/ et hooks/ qui peuvent encore nommer is_visible (commentaires retirés),
 * avec le nombre exact de lectures pour ceux qui ne sont pas du code mort.
 */
const IS_VISIBLE_ALLOWED: Record<string, { why: string; count?: number }> = {
    'lib/validations/event.ts': { why: 'alias accepté par l’API (contrat 3.3)', count: 2 },
    'components/events/AdjustTicketQuotaModal.tsx': { why: 'code mort, conservé (L13)' },
    'components/partner/pilotage/types.ts': { why: 'type de compatibilité : is_visible reste dans la réponse de pilotage_sales (contrat 3.4)', count: 1 },
};

type Row = Record<string, unknown>;

interface ChannelsModule {
    categoryChannelLabel(c: { sale_online: boolean; sale_counter: boolean }): string;
    CATEGORY_CHANNEL_HELP: Record<string, string>;
}

interface TicketingModule {
    CATEGORY_FIELDS: readonly string[];
    CATEGORY_FIELD_LABELS: Record<string, string>;
    CategoryFields: ComponentType<Row>;
    EventTicketingManager: ComponentType<Row>;
    newCategoryDraft(): Row;
    categoryDraftFromRow(row: Row, key?: string): Row;
    categoryCreateBody(d: Row): Row;
    categoryPatch(d: Row, base: Row): Row;
}

interface Parsed { success: boolean; data?: Row; error?: { issues: Array<{ path: Array<string | number> }> } }
interface ValidationModule {
    createTicketCategorySchema(ctx: { eventEnd: Date | null }): { safeParse(v: unknown): Parsed };
    updateTicketCategorySchema(ctx: { eventEnd: Date | null; current: Row }): { safeParse(v: unknown): Parsed };
}

async function load<T>(rel: string, what: string): Promise<T> {
    const target = rel;
    try {
        return (await import(target)) as T;
    } catch (err) {
        assert.fail(`${what} absent ou illisible (${rel}) : ${err instanceof Error ? err.message : String(err)}`);
    }
}

const channels = (): Promise<ChannelsModule> => load<ChannelsModule>(CHANNELS_MODULE, 'module des canaux (contrat 4.1)');
const ticketing = (): Promise<TicketingModule> => load<TicketingModule>(TICKETING_MODULE, 'formulaire de billetterie');
const validation = (): Promise<ValidationModule> => load<ValidationModule>(VALIDATION_MODULE, 'schémas de validation');

function read(rel: string): string {
    return fs.readFileSync(path.resolve(process.cwd(), rel), 'utf8');
}

/** Retire les commentaires d'un source TS/TSX (blocs, y compris ceux du JSX, et lignes ; les URL sont conservées). */
function stripComments(src: string): string {
    return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/[^\n]*/g, '$1');
}

function sourceFiles(dir: string): string[] {
    const abs = path.resolve(process.cwd(), dir);
    if (!fs.existsSync(abs)) return [];
    const out: string[] = [];
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
        const rel = `${dir}/${e.name}`;
        if (e.isDirectory()) out.push(...sourceFiles(rel));
        else if (/\.(ts|tsx)$/.test(e.name)) out.push(rel);
    }
    return out;
}

function decodeHtml(html: string): string {
    return html.replace(/&#x27;/g, '\'').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

function escapeRegExp(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function draftOf(t: TicketingModule, over: Row = {}): Row {
    return { ...t.newCategoryDraft(), key: 'c1', ...over };
}

function renderFields(t: TicketingModule, over: Row = {}): string {
    return renderToStaticMarkup(createElement(t.CategoryFields, { draft: draftOf(t, over), onChange: () => undefined }));
}

/** Élément d'identifiant `id` : balise ouvrante et texte, ou null. */
function elementById(html: string, id: string): { tag: string; text: string } | null {
    const m = new RegExp(`(<(\\w+)[^>]*\\bid="${escapeRegExp(id)}"[^>]*>)([\\s\\S]*?)</\\2>`).exec(html);
    return m ? { tag: m[1], text: decodeHtml(m[3].replace(/<[^>]+>/g, '')) } : null;
}

// ── Libellés ───────────────────────────────────────────────────────────────

describe('8.0 lib/events/category-channels.ts', () => {
    test('categoryChannelLabel : les quatre cas, exactement', async () => {
        const { categoryChannelLabel } = await channels();
        for (const [saleOnline, saleCounter, label] of CASES) {
            assert.equal(categoryChannelLabel({ sale_online: saleOnline, sale_counter: saleCounter }), label, `en ligne ${saleOnline}, guichet ${saleCounter}`);
        }
    });

    test('CATEGORY_CHANNEL_HELP : trois aides en français, celle de `none` mot pour mot', async () => {
        const { CATEGORY_CHANNEL_HELP: help } = await channels();
        assert.deepEqual(Object.keys(help).sort(), ['counter', 'none', 'online'], 'clés de l’aide');
        assert.equal(help.none, NONE_HELP, 'aide de `none`, sans promesse d’invitations (AR8)');
        for (const key of ['online', 'counter']) assert.ok(help[key].trim().length > 0, `aide de ${key} renseignée`);
    });

    test('le module reste pur, importable par le client : aucun import', () => {
        assert.ok(fs.existsSync(path.resolve(process.cwd(), 'lib/events/category-channels.ts')), 'lib/events/category-channels.ts absent (contrat 4.1)');
        const code = stripComments(read('lib/events/category-channels.ts'));
        assert.doesNotMatch(code, /^\s*import\s/m, 'lib/events/category-channels.ts : aucun import');
    });
});

// ── Validation ─────────────────────────────────────────────────────────────

describe('8.0 lib/validations/event.ts', () => {
    const base = { name: 'Presse', price: 3000, total_quantity: 10 };

    test('création : sale_online et sale_counter acceptés, catégorie sans canal permise', async () => {
        const schema = (await validation()).createTicketCategorySchema({ eventEnd: null });
        const none = schema.safeParse({ ...base, sale_online: false, sale_counter: false });
        assert.equal(none.success, true, `catégorie sans canal permise : ${JSON.stringify(none.error?.issues)}`);
        assert.equal(none.data?.sale_online, false, 'sale_online conservé');
        assert.equal(none.data?.sale_counter, false, 'sale_counter conservé');
        const bad = schema.safeParse({ ...base, sale_online: 'oui' });
        assert.equal(bad.success, false, 'sale_online non booléen refusé');
        assert.ok(bad.error?.issues.some((i) => i.path.join('.') === 'sale_online'), `erreur portée par sale_online : ${JSON.stringify(bad.error?.issues)}`);
    });

    test('création : is_visible reste un alias, sans défaut, et aucun défaut de sale_online ne l’écrase (COALESCE de ticket_category_normalize)', async () => {
        const schema = (await validation()).createTicketCategorySchema({ eventEnd: null });
        const plain = schema.safeParse(base);
        assert.equal(plain.success, true, `corps minimal : ${JSON.stringify(plain.error?.issues)}`);
        assert.equal(plain.data?.is_visible, undefined, `is_visible sans défaut : ${JSON.stringify(plain.data)}`);
        const alias = schema.safeParse({ ...base, is_visible: false });
        assert.equal(alias.success, true, `alias accepté : ${JSON.stringify(alias.error?.issues)}`);
        assert.equal(alias.data?.is_visible, false, 'alias conservé');
        assert.equal(alias.data?.sale_online, undefined, `sale_online sans défaut, sinon l'alias serait ignoré : ${JSON.stringify(alias.data)}`);
    });

    test('modification : sale_online et sale_counter acceptés, is_visible toujours accepté', async () => {
        const schema = (await validation()).updateTicketCategorySchema({ eventEnd: null, current: { sale_start: null, sale_end: null } });
        const res = schema.safeParse({ sale_online: false, sale_counter: true });
        assert.equal(res.success, true, `PATCH des canaux : ${JSON.stringify(res.error?.issues)}`);
        assert.deepEqual(res.data, { sale_online: false, sale_counter: true }, 'valeurs conservées');
        assert.equal(schema.safeParse({ is_visible: false }).success, true, 'alias accepté en modification');
    });
});

// ── Formulaire ─────────────────────────────────────────────────────────────

describe('8.0 Formulaire de billetterie (components/events/EventTicketing.tsx)', () => {
    test('champs et libellés : sale_online et sale_counter à la place de is_visible', async () => {
        const t = await ticketing();
        assert.ok(t.CATEGORY_FIELDS.includes('sale_online') && t.CATEGORY_FIELDS.includes('sale_counter'), `CATEGORY_FIELDS : ${JSON.stringify(t.CATEGORY_FIELDS)}`);
        assert.ok(!t.CATEGORY_FIELDS.includes('is_visible'), `is_visible retiré de CATEGORY_FIELDS : ${JSON.stringify(t.CATEGORY_FIELDS)}`);
        assert.equal(t.CATEGORY_FIELD_LABELS.sale_online, 'Vendue en ligne');
        assert.equal(t.CATEGORY_FIELD_LABELS.sale_counter, 'Vendue au guichet');
    });

    test('deux cases cochables, chacune avec son aide reliée par aria-describedby en text-sm', async () => {
        const t = await ticketing();
        const help = (await channels()).CATEGORY_CHANNEL_HELP;
        const html = renderFields(t);
        for (const [field, label, text] of [['sale_online', 'Vendue en ligne', help.online], ['sale_counter', 'Vendue au guichet', help.counter]]) {
            const id = `billet-c1-${field}`;
            const input = new RegExp(`<input[^>]*\\bid="${id}"[^>]*>`).exec(html)?.[0];
            assert.ok(input, `case ${field} rendue : ${html.slice(0, 400)}`);
            assert.match(input, /type="checkbox"/, `${field} : case à cocher`);
            assert.match(input, /\bchecked\b/, `${field} : cochée par défaut`);
            assert.ok(new RegExp(`<label[^>]*for="${id}"[^>]*>[\\s\\S]*?${escapeRegExp(label)}[\\s\\S]*?</label>`).test(html), `${field} : libellé « ${label} » lié à la case`);
            const described = /aria-describedby="([^"]+)"/.exec(input)?.[1];
            assert.ok(described, `${field} : aria-describedby attendu : ${input}`);
            const hints = described.split(/\s+/).map((ref) => elementById(html, ref));
            const hint = hints.find((h) => h?.text === text);
            assert.ok(hint, `${field} : l'aide « ${text} » est l'élément décrit par ${described} : ${JSON.stringify(hints)}`);
            assert.match(hint.tag, /\btext-sm\b/, `${field} : aide en text-sm (14 px) : ${hint.tag}`);
        }
    });

    test('aucun libellé « Visible » restant', async () => {
        const html = renderFields(await ticketing());
        assert.ok(!/Visible/.test(html), 'libellé « Visible » retiré du formulaire (les classes focus-visible sont en minuscules)');
    });

    test('résumé sous les cases sur les quatre cas ; aide de `none` affichée seulement sans canal', async () => {
        const t = await ticketing();
        const help = (await channels()).CATEGORY_CHANNEL_HELP;
        for (const [saleOnline, saleCounter, label] of CASES) {
            // Les aides des cases restent affichées et peuvent citer les libellés : seul le résumé est comparé.
            const html = decodeHtml(renderFields(t, { sale_online: saleOnline, sale_counter: saleCounter }))
                .split(help.online).join('').split(help.counter).join('');
            assert.ok(html.includes(label), `résumé « ${label} » (en ligne ${saleOnline}, guichet ${saleCounter})`);
            for (const [, , other] of CASES.filter((c) => c[2] !== label)) {
                assert.ok(!html.includes(other), `« ${other} » absent quand le résumé vaut « ${label} »`);
            }
            assert.equal(html.includes(NONE_HELP), !saleOnline && !saleCounter, `aide de none (en ligne ${saleOnline}, guichet ${saleCounter})`);
        }
    });

    test('brouillon et corps envoyés : deux canaux lus et envoyés, jamais is_visible', async () => {
        const t = await ticketing();
        const fresh = t.newCategoryDraft();
        assert.deepEqual([fresh.sale_online, fresh.sale_counter], [true, true], 'nouvelle catégorie : les deux canaux ouverts');
        assert.ok(!('is_visible' in fresh), 'brouillon sans is_visible');

        const draft = t.categoryDraftFromRow({ id: 'c', name: 'Presse', sale_online: false, sale_counter: true }, 'k');
        assert.deepEqual([draft.sale_online, draft.sale_counter], [false, true], 'lecture des deux colonnes');

        const body = t.categoryCreateBody(draft);
        assert.deepEqual([body.sale_online, body.sale_counter], [false, true], `corps de création : ${JSON.stringify(body)}`);
        assert.ok(!('is_visible' in body), `corps sans is_visible : ${JSON.stringify(body)}`);

        const patch = t.categoryPatch({ ...draft, sale_counter: false }, draft);
        assert.deepEqual(patch, { sale_counter: false }, 'PATCH : seul le canal changé');
    });

    test('ligne d’état d’une catégorie enregistrée : libellé de canal, plus de « masquée au public »', async () => {
        const t = await ticketing();
        const row = { id: 'cat-1', name: 'Presse', price: 3000, total_quantity: 10, max_per_order: 5, is_active: true, sale_online: false, sale_counter: true };
        const html = decodeHtml(renderToStaticMarkup(createElement(t.EventTicketingManager, { eventId: 'evt-1', initialCategories: [row] })));
        assert.ok(!html.includes('masquée au public'), '« masquée au public » retiré');
        const line = html.split('</p>').find((part) => part.includes('Aucun billet vendu')) ?? '';
        assert.ok(line.includes('Sur place uniquement'), `ligne d'état : libellé de canal à côté de « Aucun billet vendu » : ${line}`);
    });
});

// ── Guichet, pilotage, administration ──────────────────────────────────────

describe('8.0 Guichet, pilotage et administration', () => {
    test('CounterSalePanel : mention « Sur place uniquement » selon on_site_only, en 14 px au moins', () => {
        const code = stripComments(read('components/scan/CounterSalePanel.tsx'));
        assert.match(code, /\bon_site_only\b/, 'le panneau lit on_site_only');
        const mention = /Sur place uniquement|categoryChannelLabel\(/.exec(code);
        assert.ok(mention, 'mention « Sur place uniquement » (texte ou categoryChannelLabel)');
        const line = code.slice(code.lastIndexOf('<', mention.index), mention.index);
        assert.doesNotMatch(line, /text-xs|text-\[(?:\d|1[0-3])(?:\.\d+)?px\]/, `mention d'au moins 14 px : ${line}`);
    });

    test('SalesTab : libellé de canal à la place de « (masquée) » ; types.ts porte les deux canaux', () => {
        const tab = stripComments(read('components/partner/pilotage/SalesTab.tsx'));
        assert.ok(!tab.includes('(masquée)'), '« (masquée) » retiré');
        assert.match(tab, /categoryChannelLabel\(/, 'libellé unique de lib/events/category-channels.ts');
        const types = stripComments(read('components/partner/pilotage/types.ts'));
        assert.match(types, /\bsale_online:\s*boolean/, 'types.ts : sale_online');
        assert.match(types, /\bsale_counter:\s*boolean/, 'types.ts : sale_counter');
    });

    test('page d’administration : colonne ou badge « Canaux », plus de « Masquée »', () => {
        const page = stripComments(read('app/admin/events/[id]/page.tsx'));
        assert.match(page, /Canaux/, 'colonne ou badge « Canaux » (contrat 4.2)');
        assert.match(page, /categoryChannelLabel\(/, 'libellé unique de lib/events/category-channels.ts');
        assert.ok(!page.includes('Masquée'), '« Masquée » retiré');
    });

    test('aucun is_visible lu hors de la liste blanche', () => {
        const found = new Map<string, number>();
        for (const file of ['app', 'components', 'lib', 'hooks'].flatMap(sourceFiles)) {
            const n = (stripComments(read(file)).match(/\bis_visible\b/g) ?? []).length;
            if (n > 0) found.set(file, n);
        }
        const unexpected = Array.from(found.keys()).filter((f) => !(f in IS_VISIBLE_ALLOWED)).sort();
        assert.deepEqual(unexpected, [], `is_visible lu hors de la liste blanche, à passer à sale_online :\n${unexpected.join('\n')}`);
        for (const [file, rule] of Object.entries(IS_VISIBLE_ALLOWED)) {
            if (rule.count !== undefined) assert.equal(found.get(file) ?? 0, rule.count, `${file} (${rule.why}) : ${rule.count} mention(s) attendue(s)`);
        }
    });
});
