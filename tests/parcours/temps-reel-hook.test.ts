/**
 * Lot 5, tâche 5.13 — hook partagé et écrans en temps réel (contrat, sections O2, O3 et O5). Contrôles
 * statiques des sources (commentaires exclus) ; le comportement réel est prouvé par les suites
 * temps-reel-public, -stock, -billets et -prives (base locale) et par les captures de la tâche 5.1.
 *  - hooks/useRealtimeRefresh.ts : `useRealtimeRefresh({ channelKey, subscriptions: [{ table, filter?, event? }],
 *    onSignal, enabled }) → { status: 'live' | 'connecting' | 'offline' }` ; abonnement postgres_changes,
 *    anti-rebond de 300 ms avant onSignal, onSignal aussi à la (re)connexion (état SUBSCRIBED), suivi des
 *    états hors ligne (CHANNEL_ERROR, TIMED_OUT, CLOSED), removeChannel au démontage ;
 *  - components/ui/LiveIndicator.tsx : « En direct » et « Hors ligne » ;
 *  - écrans du contrat O5 : chacun appelle useRealtimeRefresh sur ses tables (catalogue et accueil :
 *    public_event_state ; page événement : public_event_state et public_category_stock, filtre event_id ;
 *    Mes billets : tickets avec le filtre user_id, et notifications ; cloche : notifications ; liste du
 *    partenaire : event_status_history ; pilotage : ticket_scans, scan_incidents et controller_shifts, filtre
 *    event_id ; admin, file de validation et nouveaux partenaires : admin_signals), sans abonnement direct à
 *    ces tables, avec LiveIndicator (sauf la cloche) ; les écrans publics ne s'abonnent pas à
 *    ticket_categories (volumes de vente : le résumé O1 les remplace) ;
 *  - aucun abonnement de l'application (postgres_changes direct ou subscriptions du hook) à une table hors
 *    de la publication attendue après le lot 5 ;
 *  - la cloche ne lit plus la colonne inexistante notifications.is_read.
 * Lecture des tables : littéraux `table: '…'` d'un `.on('postgres_changes', {…})`, de l'argument d'un
 * appel useRealtimeRefresh(…), ou de la constante passée à `subscriptions` dans le même fichier. Un écran
 * est suivi dans ses imports locaux (alias @/ et chemins relatifs, sous app, components, hooks et lib),
 * sur trois niveaux.
 * Rouge avant correctif :
 *  - hooks/ ne contient que usePartnerOrders.ts : aucun useRealtimeRefresh ; aucun
 *    components/ui/LiveIndicator.tsx ;
 *  - abonnements écrits à la main dans chaque écran : app/tickets/page.tsx:68-105,
 *    app/events/[id]/page.tsx:198-253 (ticket_categories, stock calculé dans le navigateur),
 *    components/notifications/NotificationBell.tsx:94-123 ; aucun temps réel dans app/explore/page.tsx,
 *    app/page.tsx, app/partner/events/page.tsx, app/admin/dashboard/page.tsx ; pages
 *    app/partner/events/[id]/page.tsx (pilotage) et app/admin/events/page.tsx absentes ;
 *  - abonnements à des tables hors publication : app/controller/scanner/page.tsx:211 (event_controllers),
 *    :222 (events), :241 (users) ; app/partner/team/page.tsx:175, :190 ; app/partner/events/[id]/team/page.tsx:105, :121 ;
 *  - NotificationBell.tsx:114 lit n.is_read.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const HOOK = 'hooks/useRealtimeRefresh.ts';
const INDICATOR = 'components/ui/LiveIndicator.tsx';
const BELL = 'components/notifications/NotificationBell.tsx';

/** Publication supabase_realtime attendue après le lot 5 (contrat O2 : payments retirée ; six tables ajoutées). */
const PUBLISHED_AFTER_LOT5 = [
    'orders', 'tickets', 'notifications', 'hall_reservations', 'table_reservations', 'ticket_categories', 'ticket_scans',
    'public_event_state', 'public_category_stock', 'event_status_history', 'controller_shifts', 'scan_incidents', 'admin_signals',
];

interface Screen {
    label: string;
    file: string;
    tables: string[];
    /** Filtre attendu dans l'appel du hook (contrat O5). */
    filter?: string;
    /** Écran public : aucun abonnement à ticket_categories. */
    isPublic?: boolean;
    /** LiveIndicator attendu (tous les écrans, sauf la cloche). */
    indicator: boolean;
}

/** Écrans du contrat O5 (fichiers d'après la découverte du lot 5, section 4.1, et les contrats G et I). */
const SCREENS: Screen[] = [
    { label: 'catalogue', file: 'app/explore/page.tsx', tables: ['public_event_state'], isPublic: true, indicator: true },
    { label: 'accueil', file: 'app/page.tsx', tables: ['public_event_state'], isPublic: true, indicator: true },
    { label: 'page événement', file: 'app/events/[id]/page.tsx', tables: ['public_event_state', 'public_category_stock'], filter: 'event_id=eq.', isPublic: true, indicator: true },
    { label: 'Mes billets', file: 'app/tickets/page.tsx', tables: ['tickets', 'notifications'], filter: 'user_id=eq.', indicator: true },
    { label: 'cloche des notifications', file: BELL, tables: ['notifications'], indicator: false },
    { label: 'liste des événements du partenaire', file: 'app/partner/events/page.tsx', tables: ['event_status_history'], indicator: true },
    { label: 'page de pilotage', file: 'app/partner/events/[id]/page.tsx', tables: ['ticket_scans', 'scan_incidents', 'controller_shifts'], filter: 'event_id=eq.', indicator: true },
    { label: 'admin : file de validation des événements', file: 'app/admin/events/page.tsx', tables: ['admin_signals'], indicator: true },
    { label: 'admin : nouveaux partenaires', file: 'app/admin/dashboard/page.tsx', tables: ['admin_signals'], indicator: true },
];

// ── Lecture des sources ────────────────────────────────────────────────────

function abs(rel: string): string {
    return path.resolve(ROOT, rel);
}

function isFile(rel: string): boolean {
    return fs.existsSync(abs(rel)) && fs.statSync(abs(rel)).isFile();
}

function stripComments(src: string): string {
    return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
}

function source(rel: string): string {
    return stripComments(fs.readFileSync(abs(rel), 'utf8'));
}

function toPosix(p: string): string {
    return p.split(path.sep).join('/');
}

function resolveImport(fromRel: string, spec: string): string | null {
    let base: string;
    if (spec.startsWith('@/')) base = spec.slice(2);
    else if (spec.startsWith('.')) base = path.posix.join(path.posix.dirname(fromRel), spec);
    else return null;
    for (const candidate of [base, `${base}.tsx`, `${base}.ts`, `${base}/index.tsx`, `${base}/index.ts`]) {
        const rel = path.posix.normalize(candidate);
        if (isFile(rel)) return rel;
    }
    return null;
}

function importSpecs(src: string): string[] {
    const specs: string[] = [];
    const re = /(?:import|export)\s[^'"`;]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
    for (const m of Array.from(src.matchAll(re))) specs.push(m[1] ?? m[2]);
    return specs;
}

interface SourceFile {
    rel: string;
    src: string;
    /** Imports locaux résolus (chemins relatifs à la racine). */
    imports: string[];
}

/** L'écran et ses imports locaux (app, components, hooks, lib) sur `depth` niveaux ; le hook, l'indicateur et `exclude` ne sont pas parcourus. */
function closure(entry: string, exclude: string[], depth = 3): SourceFile[] {
    const out: SourceFile[] = [];
    const seen = new Set<string>();
    const queue: Array<{ rel: string; level: number }> = [{ rel: entry, level: 0 }];
    while (queue.length > 0) {
        const { rel, level } = queue.shift()!;
        if (seen.has(rel)) continue;
        seen.add(rel);
        const src = source(rel);
        const imports = importSpecs(src).map((s) => resolveImport(rel, s)).filter((r): r is string => r !== null);
        out.push({ rel, src, imports });
        if (level >= depth) continue;
        for (const target of imports) {
            if (seen.has(target) || target === HOOK || target === INDICATOR || exclude.includes(target)) continue;
            if (!/^(app|components|hooks|lib)\//.test(target)) continue;
            queue.push({ rel: target, level: level + 1 });
        }
    }
    return out;
}

/** Texte de l'expression équilibrée qui commence à `open` ((, [ ou {), chaînes et gabarits sautés. */
function balanced(src: string, open: number): string {
    const pairs: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
    const stack: string[] = [];
    for (let i = open; i < src.length; i++) {
        const ch = src[i];
        if (ch === '"' || ch === "'" || ch === '`') {
            for (i++; i < src.length && src[i] !== ch; i++) if (src[i] === '\\') i++;
            continue;
        }
        if (pairs[ch]) stack.push(pairs[ch]);
        else if (ch === stack[stack.length - 1]) {
            stack.pop();
            if (stack.length === 0) return src.slice(open, i + 1);
        }
    }
    return src.slice(open);
}

/** Texte de l'instruction de déclaration de `name` dans le fichier (const name = …), ou ''. */
function declaration(src: string, name: string): string {
    const m = new RegExp(`(?:const|let|var)\\s+${name}\\b[^=]*=`).exec(src);
    if (!m) return '';
    const rest = src.slice(m.index + m[0].length);
    const end = rest.search(/[;\n]/);
    const firstOpen = rest.search(/[([{]/);
    if (firstOpen < 0 || (end >= 0 && end < firstOpen)) return rest.slice(0, end < 0 ? rest.length : end);
    // L'expression peut commencer par useMemo(…) ou par un tableau : on prend tout jusqu'à la fermeture du premier groupe.
    return rest.slice(0, firstOpen) + balanced(rest, firstOpen);
}

function escapeRegExp(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Texte d'une définition à partir de sa valeur : appel ou groupe (useRef(…), useCallback(…)), fonction fléchée
 * (paramètres puis corps) ou fonction déclarée (corps).
 */
function definitionText(rest: string, isFunction: boolean): string {
    const open = isFunction ? 0 : rest.search(/[({[]/);
    if (open < 0 || (!isFunction && rest.slice(0, open).search(/[;\n]/) >= 0)) return '';
    const first = balanced(rest, open);
    let after = rest.slice(open + first.length);
    if (isFunction) {
        const brace = after.search(/\{/);
        return brace < 0 ? first : first + balanced(after, brace);
    }
    const arrow = /^\s*(?::[^=;{]+)?=>\s*/.exec(after);
    if (!arrow) return first;
    after = after.slice(arrow[0].length);
    if (/^[({[]/.test(after)) return first + balanced(after, 0);
    const end = after.search(/[;\n]/);
    return first + after.slice(0, end < 0 ? after.length : end);
}

/**
 * Noms locaux qui mènent à onSignal : onSignal lui-même, puis toute constante ou fonction du fichier dont la
 * définition y fait référence (useRef(onSignal), rappel temporisé…), sur trois niveaux. Le hook lui-même est exclu.
 */
function signalNames(src: string): string[] {
    const names = ['onSignal'];
    for (let pass = 0; pass < 3; pass++) {
        for (const m of Array.from(src.matchAll(/(?:const|let)\s+([A-Za-z_$][\w$]*)\s*(?::[^=;]+)?=(?!>)\s*|function\s+([A-Za-z_$][\w$]*)\s*(?=\()/g))) {
            const name = m[1] ?? m[2];
            if (names.includes(name) || name === 'useRealtimeRefresh') continue;
            const body = definitionText(src.slice((m.index ?? 0) + m[0].length), m[2] !== undefined);
            if (names.some((n) => new RegExp(`\\b${escapeRegExp(n)}\\b`).test(body))) names.push(name);
        }
    }
    return names;
}

function callsAny(text: string, names: string[]): boolean {
    return names.some((n) => new RegExp(`\\b${escapeRegExp(n)}(?:\\.current)?(?:\\?\\.)?\\s*\\(`).test(text));
}

function tableLiterals(text: string): string[] {
    return Array.from(text.matchAll(/\btable\s*:\s*['"`]([a-z_][a-z0-9_]*)['"`]/g)).map((m) => m[1]);
}

interface Subscriptions {
    /** Tables des appels useRealtimeRefresh(…) du fichier. */
    viaHook: string[];
    /** Tables des .on('postgres_changes', {…}) écrits à la main. */
    direct: string[];
    /** Texte des appels du hook (pour les filtres). */
    hookCalls: string[];
}

function subscriptionsOf(src: string): Subscriptions {
    const viaHook: string[] = [];
    const direct: string[] = [];
    const hookCalls: string[] = [];
    for (const m of Array.from(src.matchAll(/\buseRealtimeRefresh\s*\(/g))) {
        // La définition du hook (function useRealtimeRefresh(…)) n'est pas un appel.
        if (/function\s*$/.test(src.slice(Math.max(0, (m.index ?? 0) - 20), m.index ?? 0))) continue;
        const call = balanced(src, (m.index ?? 0) + m[0].length - 1);
        let text = call;
        const ref = /\bsubscriptions\s*:\s*([A-Za-z_$][\w$]*)\s*[,}]/.exec(call) ?? (/[{,]\s*subscriptions\s*[,}]/.test(call) ? ['', 'subscriptions'] : null);
        if (ref) text += `\n${declaration(src, ref[1])}`;
        hookCalls.push(text);
        viaHook.push(...tableLiterals(text));
    }
    for (const m of Array.from(src.matchAll(/\.on\(\s*['"]postgres_changes['"]\s*,\s*\{/g))) {
        const binding = balanced(src, (m.index ?? 0) + m[0].length - 1);
        direct.push(...tableLiterals(binding));
    }
    return { viaHook, direct, hookCalls };
}

function listSources(dir: string): string[] {
    const out: string[] = [];
    const walk = (rel: string) => {
        for (const entry of fs.readdirSync(abs(rel), { withFileTypes: true })) {
            if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
            const child = `${rel}/${entry.name}`;
            if (entry.isDirectory()) walk(child);
            else if (/\.(ts|tsx)$/.test(entry.name)) out.push(toPosix(child));
        }
    };
    if (fs.existsSync(abs(dir))) walk(dir);
    return out;
}

function uniq(xs: string[]): string[] {
    return xs.filter((x, i) => xs.indexOf(x) === i);
}

// ── Hook partagé ───────────────────────────────────────────────────────────

describe('Hook partagé hooks/useRealtimeRefresh.ts (contrat O3)', () => {
    test('API du contrat : useRealtimeRefresh({ channelKey, subscriptions, onSignal, enabled }) → { status: live | connecting | offline }', () => {
        assert.ok(isFile(HOOK), `${HOOK} absent (contrat O3)`);
        const src = source(HOOK);
        assert.match(src, /export\s+(?:default\s+)?(?:function\s+useRealtimeRefresh\b|const\s+useRealtimeRefresh\b)/, 'export de useRealtimeRefresh');
        for (const param of ['channelKey', 'subscriptions', 'onSignal', 'enabled']) {
            assert.match(src, new RegExp(`\\b${param}\\b`), `paramètre ${param} du contrat O3 absent`);
        }
        for (const state of ['live', 'connecting', 'offline']) {
            assert.match(src, new RegExp(`['"]${state}['"]`), `état « ${state} » absent`);
        }
        assert.match(src, /return\s*\{[^}]*\bstatus\b/, 'le hook renvoie { status }');
        assert.match(src, /['"]postgres_changes['"]/, 'abonnement postgres_changes');
    });

    test('anti-rebond de 300 ms avant onSignal ; onSignal aussi à la (re)connexion ; états hors ligne suivis', () => {
        assert.ok(isFile(HOOK), `${HOOK} absent (contrat O3)`);
        const src = source(HOOK);
        assert.match(src, /\b300\b/, 'anti-rebond de 300 ms (contrat O3)');
        assert.match(src, /\bsetTimeout\s*\(/, 'temporisation (setTimeout)');
        assert.match(src, /\bclearTimeout\s*\(/, 'temporisation annulée (clearTimeout)');
        const names = signalNames(src);
        assert.ok(callsAny(src, names), `appel de onSignal (noms suivis : ${names.join(', ')})`);
        assert.match(src, /['"]SUBSCRIBED['"]/, 'état SUBSCRIBED traité');
        assert.ok(['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].some((s) => new RegExp(`['"]${s}['"]`).test(src)), 'états hors ligne (CHANNEL_ERROR, TIMED_OUT, CLOSED) traités');
        // À la (re)connexion : la branche SUBSCRIBED déclenche onSignal, directement ou par une fonction locale qui y
        // mène (rechargement des changements manqués pendant la coupure). Fenêtre de 300 caractères après le littéral.
        const blocks = Array.from(src.matchAll(/['"]SUBSCRIBED['"]/g)).map((m) => src.slice(m.index ?? 0, (m.index ?? 0) + 300));
        assert.ok(blocks.some((b) => callsAny(b, names)),
            `à l’état SUBSCRIBED (connexion et reconnexion), onSignal est déclenché (noms suivis : ${names.join(', ')})`);
    });

    test('désabonnement au démontage : removeChannel dans le nettoyage de l’effet', () => {
        assert.ok(isFile(HOOK), `${HOOK} absent (contrat O3)`);
        const src = source(HOOK);
        assert.match(src, /\buseEffect\s*\(/, 'abonnement dans un effet');
        assert.match(src, /return\s*\(\s*\)\s*=>/, 'fonction de nettoyage de l’effet');
        assert.match(src, /\.removeChannel\s*\(/, 'removeChannel au démontage');
    });
});

describe('Indicateur components/ui/LiveIndicator.tsx (contrat O3, Q)', () => {
    test('composant exporté, « En direct » et « Hors ligne »', () => {
        assert.ok(isFile(INDICATOR), `${INDICATOR} absent (contrat Q)`);
        const src = source(INDICATOR);
        assert.match(src, /export\s+(?:default\s+)?(?:function\s+LiveIndicator\b|const\s+LiveIndicator\b)|export\s*\{[^}]*\bLiveIndicator\b/, 'export de LiveIndicator');
        assert.ok(src.includes('En direct'), 'libellé « En direct »');
        assert.ok(src.includes('Hors ligne'), 'libellé « Hors ligne »');
        assert.match(src, /\blive\b/, 'état live pris en compte');
        assert.match(src, /\boffline\b/, 'état offline pris en compte');
    });
});

// ── Écrans ─────────────────────────────────────────────────────────────────

describe('Écrans du contrat O5 : un seul hook partagé', () => {
    for (const screen of SCREENS) {
        test(`${screen.label} (${screen.file}) : useRealtimeRefresh sur ${screen.tables.join(', ')}${screen.filter ? ` (filtre ${screen.filter})` : ''}${screen.indicator ? ', LiveIndicator' : ''}`, () => {
            assert.ok(isFile(screen.file), `${screen.file} absent`);
            const files = closure(screen.file, screen.file === BELL ? [] : [BELL]);
            const per = files.map((f) => ({ f, subs: subscriptionsOf(f.src) }));
            const viaHook = uniq(per.flatMap((x) => x.subs.viaHook));
            const direct = uniq(per.flatMap((x) => x.subs.direct));
            const where = `fichiers lus : ${files.map((f) => f.rel).join(', ')} ; tables par le hook : [${viaHook.join(', ')}] ; abonnements directs : [${direct.join(', ')}]`;

            const callers = per.filter((x) => x.f.imports.includes(HOOK) && x.subs.hookCalls.length > 0);
            assert.ok(callers.length > 0, `${screen.label} : aucun appel de useRealtimeRefresh importé de ${HOOK} — ${where}`);
            const missing = screen.tables.filter((t) => !viaHook.includes(t));
            assert.deepEqual(missing, [], `${screen.label} : tables non suivies par le hook — ${where}`);
            const handmade = screen.tables.filter((t) => direct.includes(t));
            assert.deepEqual(handmade, [], `${screen.label} : abonnement écrit à la main au lieu du hook partagé — ${where}`);
            if (screen.filter) {
                const filter = screen.filter;
                assert.ok(callers.some((x) => x.subs.hookCalls.some((c) => c.includes(filter))), `${screen.label} : filtre ${filter} absent de l’appel du hook — ${where}`);
            }
            if (screen.isPublic) {
                const volumes = uniq(viaHook.concat(direct)).filter((t) => ['ticket_categories', 'tickets', 'payments', 'stock_reservations'].includes(t));
                assert.deepEqual(volumes, [], `${screen.label} (écran public) : abonnement à des lignes de vente au lieu du résumé public — ${where}`);
            }
            if (screen.indicator) {
                assert.ok(files.some((f) => f.imports.includes(INDICATOR)), `${screen.label} : LiveIndicator absent — ${where}`);
            }
        });
    }

    test('la cloche ne lit plus la colonne inexistante notifications.is_read', () => {
        const src = source(BELL);
        const hits = src.split('\n').map((line, i) => ({ line: i + 1, text: line.trim() })).filter((l) => /\bis_read\b/.test(l.text));
        assert.deepEqual(hits, [], `${BELL} lit is_read (colonne absente de notifications : status et read_at) : ${JSON.stringify(hits)}`);
    });
});

describe('Aucun abonnement à une table hors de la publication', () => {
    test('chaque table suivie par l’application (postgres_changes direct ou hook) est dans la publication attendue après le lot 5', () => {
        const files = uniq(['app', 'components', 'hooks', 'lib'].flatMap(listSources));
        const offenders: string[] = [];
        let seen = 0;
        for (const rel of files) {
            const src = source(rel);
            if (!/postgres_changes|useRealtimeRefresh\s*\(/.test(src)) continue;
            const subs = subscriptionsOf(src);
            for (const table of uniq(subs.direct.concat(subs.viaHook))) {
                seen += 1;
                if (!PUBLISHED_AFTER_LOT5.includes(table)) offenders.push(`${rel} : ${table}`);
            }
        }
        console.log(`[TEMPS-REEL] ${seen} abonnement(s) lus ; hors publication : ${offenders.length}`);
        assert.ok(seen > 0, 'aucun abonnement trouvé dans app, components, hooks et lib');
        assert.deepEqual(offenders, [], `abonnements à des tables hors publication (rien ne serait reçu, ou une table sensible serait à publier) :\n${offenders.join('\n')}`);
    });
});
