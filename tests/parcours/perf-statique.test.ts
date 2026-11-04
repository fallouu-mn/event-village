/**
 * Lot 7, tâche 7.5 — contrôles statiques de performance (contrat, section 9 ; décisions D75 à D78).
 * Suite STATIQUE pour ses cas : elle lit les sources (arbre syntaxique TypeScript, commentaires exclus),
 * package.json, package-lock.json, app/globals.css, et exécute scripts/js-budget.mjs sur un build fabriqué
 * dans un dossier temporaire. Seul l'after() touche la base (assertTerrainInvariants, Conventions).
 *  - sharp épinglé à 0.33.5 dans `dependencies`, chargeable, et capable de convertir un PNG 1×1 en WebP ;
 *    package-lock.json contient sharp 0.33.5 et les binaires Linux `@img/sharp-linux-x64` et
 *    `@img/sharp-libvips-linux-x64` (sinon `npm ci` en CI n'installe pas le binaire, D75) ;
 *  - `@types/leaflet` en devDependencies, plus dans dependencies (D75) ;
 *  - aucune référence (import, export … from, import(), require()) à `framer-motion`, `liquid-glass-react`
 *    ou `react-leaflet` dans app/, components/, lib/, hooks/, et ces paquets absents de package.json
 *    (D75, D77) ;
 *  - aucun fichier `'use client'` n'importe en valeur `lib/supabase/server` ni `lib/shifts/shift.service`
 *    (seul `import type …` est admis ; `import { type A }` est refusé : il dépend de l'élagage du
 *    compilateur, que l'on ne veut pas supposer) ;
 *  - scripts/js-budget.mjs existe et scripts/verify.mjs l'appelle juste après `next build` ; le script
 *    mesure le gzip des fichiers .js distincts de "/layout" ∪ "/template" ∪ "<route>/page", mesure seule
 *    sans budget, échoue au-dessus d'un budget, refuse une route inconnue, échoue sur une route budgétée
 *    absente ;
 *  - scripts/js-budget.json fixe un budget bloquant pour chacune des cinq routes mesurées (fix(7.5), D76) ;
 *  - `.ev-page-enter` (app/template.tsx) n'anime plus l'opacité depuis 0 (D78).
 *
 * Rouge aujourd'hui (6fff1bf) : sharp absent de package.json, du lockfile et de node_modules ;
 * `@types/leaflet` dans dependencies (package.json:25) ; framer-motion importé par
 * components/tickets/TransferExplainerModal.tsx:4 et app/paiement/[id]/page.tsx:15, et les trois paquets
 * dans package.json:29,31,37 ; components/shifts/ShiftModals.tsx:9 (`'use client'`) importe
 * `{ Shift, ShiftSummary }` de lib/shifts/shift.service sans `type` ; scripts/js-budget.json absent ;
 * app/globals.css:411-419 : `evPageEnter` part de `opacity: 0`.
 * Verts dès le commit test(7.5) (couverture ajoutée, le script est livré avec ses tests) : js-budget.mjs et
 * son appel dans verify.mjs.
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import ts from 'typescript';
import { assertTerrainInvariants } from '../helpers/terrain-invariants';

after(async () => {
    await assertTerrainInvariants('perf-statique');
});

const ROOT = process.cwd();
const SOURCE_DIRS = ['app', 'components', 'lib', 'hooks'];
const SOURCE_EXT = /\.(tsx?|jsx?|mjs|cjs)$/;
const FORBIDDEN_PACKAGES = ['framer-motion', 'liquid-glass-react', 'react-leaflet'];
const SERVER_ONLY_MODULES = ['lib/supabase/server', 'lib/shifts/shift.service'];
const MEASURED_ROUTES = ['/', '/events/[id]', '/tickets', '/controller/scanner', '/billet/hors-ligne'];

// ── Lecture des sources ────────────────────────────────────────────────────

function read(rel: string): string {
    return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

interface PackageJson {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    optionalDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
}

function packageJson(): PackageJson {
    return JSON.parse(read('package.json')) as PackageJson;
}

/** Fichiers sources de app/, components/, lib/, hooks/ (chemins relatifs, séparateur « / »). */
function sourceFiles(): string[] {
    const out: string[] = [];
    const walk = (dir: string): void => {
        for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
            if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
            const rel = `${dir}/${entry.name}`;
            if (entry.isDirectory()) walk(rel);
            else if (entry.isFile() && SOURCE_EXT.test(entry.name)) out.push(rel);
        }
    };
    for (const d of SOURCE_DIRS) if (fs.existsSync(path.join(ROOT, d))) walk(d);
    return out.sort();
}

interface ModuleRef { spec: string; typeOnly: boolean; line: number; kind: string }

function parse(rel: string): ts.SourceFile {
    const kind = rel.endsWith('.tsx') ? ts.ScriptKind.TSX
        : rel.endsWith('.ts') ? ts.ScriptKind.TS
            : rel.endsWith('.jsx') ? ts.ScriptKind.JSX : ts.ScriptKind.JS;
    return ts.createSourceFile(rel, read(rel), ts.ScriptTarget.Latest, true, kind);
}

/** Toutes les références de module d'un fichier : import, export … from, import x = require(), import(), require(). */
function moduleRefs(sf: ts.SourceFile): ModuleRef[] {
    const refs: ModuleRef[] = [];
    const lineOf = (n: ts.Node): number => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
    const visit = (node: ts.Node): void => {
        if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
            // Seul `import type …` est une référence de type ; `import { type A }` reste compté en valeur.
            refs.push({ spec: node.moduleSpecifier.text, typeOnly: node.importClause?.isTypeOnly === true, line: lineOf(node), kind: 'import' });
        } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
            refs.push({ spec: node.moduleSpecifier.text, typeOnly: node.isTypeOnly, line: lineOf(node), kind: 'export … from' });
        } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)
            && ts.isStringLiteral(node.moduleReference.expression)) {
            refs.push({ spec: node.moduleReference.expression.text, typeOnly: node.isTypeOnly, line: lineOf(node), kind: 'import = require' });
        } else if (ts.isCallExpression(node) && node.arguments.length > 0 && ts.isStringLiteralLike(node.arguments[0])) {
            const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
            const isRequire = ts.isIdentifier(node.expression) && node.expression.text === 'require';
            if (isDynamicImport || isRequire) {
                refs.push({ spec: node.arguments[0].text, typeOnly: false, line: lineOf(node), kind: isDynamicImport ? 'import()' : 'require()' });
            }
        } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) {
            refs.push({ spec: node.argument.literal.text, typeOnly: true, line: lineOf(node), kind: 'import("…") de type' });
        }
        ts.forEachChild(node, visit);
    };
    visit(sf);
    return refs;
}

/** Directive `'use client'` en tête de fichier (prologue de directives). */
function isClientFile(sf: ts.SourceFile): boolean {
    for (const st of sf.statements) {
        if (!ts.isExpressionStatement(st) || !ts.isStringLiteral(st.expression)) return false;
        if (st.expression.text === 'use client') return true;
    }
    return false;
}

/** Module local visé par une référence (chemin relatif à la racine, sans extension ni /index), ou null. */
function resolveLocal(fromRel: string, spec: string): string | null {
    let target: string;
    if (spec.startsWith('@/')) target = spec.slice(2);
    else if (spec.startsWith('./') || spec.startsWith('../')) target = path.posix.normalize(path.posix.join(path.posix.dirname(fromRel), spec));
    else return null;
    return target.replace(/\.(tsx?|jsx?|mjs|cjs)$/, '').replace(/\/index$/, '');
}

function packageOf(spec: string, pkg: string): boolean {
    return spec === pkg || spec.startsWith(`${pkg}/`);
}

// ── sharp et dépendances ───────────────────────────────────────────────────

/** PNG 1×1 RGBA (signature et IHDR vérifiés par le test avant la conversion). */
const PNG_1X1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

type SharpFactory = (input: Buffer) => {
    webp(): { toBuffer(): Promise<Buffer> };
    metadata(): Promise<{ width?: number; height?: number; format?: string }>;
};

function loadSharp(): SharpFactory {
    const req = createRequire(path.join(ROOT, 'package.json'));
    const name = 'sharp';
    let mod: unknown;
    try {
        mod = req(name);
    } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        assert.fail(`sharp ne se charge pas depuis la racine du dépôt (${code ?? 'erreur'} : ${err instanceof Error ? err.message.split('\n')[0] : String(err)}) : `
            + 'installer sharp 0.33.5 en dependencies avec ses binaires @img/sharp-* (D75)');
    }
    const factory = (typeof mod === 'function' ? mod : (mod as { default?: unknown }).default) as SharpFactory | undefined;
    assert.equal(typeof factory, 'function', 'le module sharp chargé n\'exporte pas de fonction');
    return factory as SharpFactory;
}

describe('7.5 sharp et dépendances (D75, D77)', () => {
    test('sharp est épinglé à 0.33.5 dans dependencies et convertit un PNG 1×1 en WebP', async () => {
        const pkg = packageJson();
        assert.equal(pkg.dependencies?.sharp, '0.33.5', `package.json : sharp attendu en dependencies à « 0.33.5 » exactement, trouvé ${JSON.stringify(pkg.dependencies?.sharp ?? null)}`);
        assert.equal(pkg.devDependencies?.sharp, undefined, 'sharp ne doit pas être en devDependencies (next start en production en a besoin)');

        assert.equal(PNG_1X1.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'signature PNG de l\'échantillon');
        assert.equal(PNG_1X1.readUInt32BE(16), 1, 'largeur de l\'échantillon PNG');
        assert.equal(PNG_1X1.readUInt32BE(20), 1, 'hauteur de l\'échantillon PNG');

        const sharp = loadSharp();
        const webp = await sharp(PNG_1X1).webp().toBuffer();
        assert.equal(webp.subarray(0, 4).toString('ascii'), 'RIFF', 'sortie WebP : en-tête RIFF');
        assert.equal(webp.subarray(8, 12).toString('ascii'), 'WEBP', 'sortie WebP : marque WEBP');
        const meta = await sharp(webp).metadata();
        assert.deepEqual({ format: meta.format, width: meta.width, height: meta.height }, { format: 'webp', width: 1, height: 1 },
            `métadonnées de la sortie WebP : ${JSON.stringify(meta)}`);
    });

    test('package-lock.json contient sharp 0.33.5 et les binaires Linux @img/sharp-linux-x64 et @img/sharp-libvips-linux-x64', () => {
        const lock = JSON.parse(read('package-lock.json')) as { lockfileVersion?: number; packages?: Record<string, { version?: string; optional?: boolean }> };
        assert.ok(lock.packages && typeof lock.packages === 'object', `package-lock.json sans « packages » (lockfileVersion ${lock.lockfileVersion})`);
        const packages = lock.packages ?? {};
        assert.equal((packages[''] as { dependencies?: Record<string, string> } | undefined)?.dependencies?.sharp, '0.33.5',
            'package-lock.json : la racine ne déclare pas sharp 0.33.5 en dependencies (lockfile non régénéré)');
        assert.equal(packages['node_modules/sharp']?.version, '0.33.5', `package-lock.json : node_modules/sharp en ${JSON.stringify(packages['node_modules/sharp']?.version ?? null)}, 0.33.5 attendu`);
        const missing = ['node_modules/@img/sharp-linux-x64', 'node_modules/@img/sharp-libvips-linux-x64'].filter((k) => !packages[k]);
        assert.deepEqual(missing, [], `binaires Linux absents du lockfile (npm ci en CI n'installerait pas sharp) : ${missing.join(', ')}`);
    });

    test('@types/leaflet est en devDependencies et plus dans dependencies', () => {
        const pkg = packageJson();
        assert.equal(pkg.dependencies?.['@types/leaflet'], undefined, `@types/leaflet encore en dependencies (${pkg.dependencies?.['@types/leaflet']})`);
        assert.ok(pkg.devDependencies?.['@types/leaflet'], '@types/leaflet absent de devDependencies (leaflet reste utilisé par EventMap et MapPicker)');
    });

    test('framer-motion, liquid-glass-react et react-leaflet : aucune référence dans app/, components/, lib/, hooks/, absents de package.json', () => {
        const hits: string[] = [];
        for (const rel of sourceFiles()) {
            const text = read(rel);
            if (!FORBIDDEN_PACKAGES.some((p) => text.includes(p))) continue;
            for (const ref of moduleRefs(parse(rel))) {
                const pkgName = FORBIDDEN_PACKAGES.find((p) => packageOf(ref.spec, p));
                if (pkgName) hits.push(`${rel}:${ref.line} ${ref.kind} « ${ref.spec} »`);
            }
        }
        assert.deepEqual(hits, [], `références aux paquets retirés (D75, D77) :\n${hits.join('\n')}`);

        const pkg = packageJson();
        const declared: string[] = [];
        for (const field of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'] as const) {
            for (const p of FORBIDDEN_PACKAGES) if (pkg[field]?.[p] !== undefined) declared.push(`${field}.${p}`);
        }
        assert.deepEqual(declared, [], `paquets retirés encore déclarés dans package.json : ${declared.join(', ')}`);
    });

    test('aucun fichier « use client » n\'importe en valeur lib/supabase/server ni lib/shifts/shift.service', () => {
        const hits: string[] = [];
        let clientFiles = 0;
        for (const rel of sourceFiles()) {
            const sf = parse(rel);
            if (!isClientFile(sf)) continue;
            clientFiles++;
            for (const ref of moduleRefs(sf)) {
                if (ref.typeOnly) continue;
                const target = resolveLocal(rel, ref.spec);
                if (target && SERVER_ONLY_MODULES.includes(target)) {
                    hits.push(`${rel}:${ref.line} ${ref.kind} « ${ref.spec} » en valeur (écrire « import type … »)`);
                }
            }
        }
        assert.ok(clientFiles > 50, `détecteur de « use client » : ${clientFiles} fichier(s) client seulement, lecture des sources suspecte`);
        assert.deepEqual(hits, [], `modules serveur importés en valeur par un fichier client (clé de service exposable au bundle) :\n${hits.join('\n')}`);
    });

    test('auto-test du détecteur d\'imports : valeur, type, import(), require(), export … from, prologue « use client »', () => {
        const src = [
            '"use client";',
            "import type { A } from '@/lib/shifts/shift.service';",
            "import { type B } from '../../lib/shifts/shift.service';",
            "export { C } from '@/lib/supabase/server';",
            "export type { D } from '@/lib/supabase/server';",
            "const m = () => import('framer-motion');",
            "const r = require('react-leaflet/hooks');",
            "type T = import('liquid-glass-react').X;",
        ].join('\n');
        const sf = ts.createSourceFile('components/x/Probe.tsx', src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
        assert.equal(isClientFile(sf), true, 'prologue « use client » reconnu');
        const refs = moduleRefs(sf).map((r) => `${r.kind}|${r.spec}|${r.typeOnly ? 'type' : 'valeur'}`);
        assert.deepEqual(refs, [
            'import|@/lib/shifts/shift.service|type',
            'import|../../lib/shifts/shift.service|valeur',
            'export … from|@/lib/supabase/server|valeur',
            'export … from|@/lib/supabase/server|type',
            'import()|framer-motion|valeur',
            'require()|react-leaflet/hooks|valeur',
            'import("…") de type|liquid-glass-react|type',
        ]);
        assert.equal(resolveLocal('components/x/Probe.tsx', '../../lib/shifts/shift.service'), 'lib/shifts/shift.service');
        assert.equal(resolveLocal('components/x/Probe.tsx', '@/lib/supabase/server.ts'), 'lib/supabase/server');
        assert.equal(resolveLocal('components/x/Probe.tsx', 'lucide-react'), null);
        assert.equal(packageOf('react-leaflet/hooks', 'react-leaflet'), true);
        assert.equal(packageOf('react-leaflet-cluster', 'react-leaflet'), false);
        const notClient = ts.createSourceFile('a.ts', "import x from 'y';\n'use client';", ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
        assert.equal(isClientFile(notClient), false, '« use client » hors du prologue ignoré');
    });
});

// ── Budget de poids JavaScript (scripts/js-budget.mjs) ─────────────────────

interface BudgetRun { status: number | null; stdout: string; stderr: string; tsv: string | null }

/** Build fabriqué : manifeste et chunks déterministes dans un dossier temporaire. */
function fakeBuild(): { dir: string; pages: Record<string, string[]>; files: Record<string, Buffer> } {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ev-js-budget-'));
    const chunk = (seed: string, size: number): Buffer => {
        // Contenu pseudo-aléatoire déterministe (peu compressible), pour que la taille gzip compte.
        const out = Buffer.alloc(size);
        let x = 0;
        for (const c of seed) x = (x * 31 + c.charCodeAt(0)) >>> 0;
        for (let i = 0; i < size; i++) {
            x = (x * 1103515245 + 12345) >>> 0;
            out[i] = 32 + (x >>> 16) % 90;
        }
        return out;
    };
    const files: Record<string, Buffer> = {
        'static/chunks/webpack-aaaa.js': chunk('webpack', 2_000),
        'static/chunks/main-app-bbbb.js': chunk('main-app', 6_000),
        'static/chunks/app/layout-cccc.js': chunk('layout', 9_000),
        'static/chunks/app/template-dddd.js': chunk('template', 1_000),
        'static/chunks/app/page-eeee.js': chunk('home', 3_000),
        'static/chunks/app/events/[id]/page-ffff.js': chunk('event', 5_000),
        'static/chunks/app/tickets/page-gggg.js': chunk('tickets', 8_000),
        'static/chunks/shared-hhhh.js': chunk('shared', 4_000),
        'static/chunks/app/controller/scanner/page-iiii.js': chunk('scanner', 7_000),
        'static/css/app/layout-jjjj.css': chunk('css', 50_000),
    };
    for (const [rel, buf] of Object.entries(files)) {
        fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
        fs.writeFileSync(path.join(dir, rel), buf);
    }
    const common = ['static/chunks/webpack-aaaa.js', 'static/chunks/main-app-bbbb.js'];
    const pages: Record<string, string[]> = {
        '/layout': [...common, 'static/css/app/layout-jjjj.css', 'static/chunks/app/layout-cccc.js'],
        '/template': [...common, 'static/chunks/app/template-dddd.js'],
        '/page': [...common, 'static/chunks/app/page-eeee.js'],
        '/events/[id]/page': [...common, 'static/chunks/shared-hhhh.js', 'static/chunks/app/events/[id]/page-ffff.js'],
        '/tickets/page': [...common, 'static/chunks/shared-hhhh.js', 'static/chunks/app/tickets/page-gggg.js'],
        '/controller/scanner/page': [...common, 'static/chunks/app/controller/scanner/page-iiii.js'],
        '/admin/audit/page': [...common, 'static/chunks/app/page-eeee.js'],
    };
    fs.writeFileSync(path.join(dir, 'app-build-manifest.json'), JSON.stringify({ pages }, null, 2));
    return { dir, pages, files };
}

function expectedGzip(build: ReturnType<typeof fakeBuild>, pageEntry: string): number {
    const set = new Set([...build.pages['/layout'], ...build.pages['/template'], ...build.pages[pageEntry]]);
    let total = 0;
    for (const rel of Array.from(set)) if (rel.endsWith('.js')) total += zlib.gzipSync(build.files[rel], { level: 9 }).length;
    return total;
}

function runBudget(nextDir: string, budget: unknown | undefined): BudgetRun {
    const work = fs.mkdtempSync(path.join(os.tmpdir(), 'ev-js-budget-run-'));
    const budgetFile = path.join(work, 'js-budget.json');
    if (budget !== undefined) fs.writeFileSync(budgetFile, typeof budget === 'string' ? budget : JSON.stringify(budget));
    const out = path.join(work, 'out', 'js-budget.tsv');
    const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts/js-budget.mjs'), '--next-dir', nextDir, '--budget', budgetFile, '--out', out],
        { cwd: ROOT, encoding: 'utf8', timeout: 60_000 });
    const tsv = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : null;
    fs.rmSync(work, { recursive: true, force: true });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '', tsv };
}

function tsvRows(tsv: string): Record<string, string>[] {
    const [head, ...lines] = tsv.trim().split('\n');
    const cols = head.split('\t');
    return lines.map((l) => Object.fromEntries(l.split('\t').map((v, i) => [cols[i], v])));
}

describe('7.5 budget de poids JavaScript (D76)', () => {
    test('scripts/js-budget.mjs existe et scripts/verify.mjs l\'appelle juste après next build', () => {
        assert.ok(fs.existsSync(path.join(ROOT, 'scripts/js-budget.mjs')), 'scripts/js-budget.mjs absent');
        const verify = read('scripts/verify.mjs');
        const block = /const steps = \[([\s\S]*?)\];/.exec(verify);
        assert.ok(block, 'scripts/verify.mjs : tableau « const steps = [ … ] » introuvable');
        const steps = Array.from(block[1].matchAll(/\[\s*'([^']+)'\s*,\s*'([^']+)'\s*\]/g), (m) => [m[1], m[2]]);
        assert.deepEqual(steps, [
            ['typecheck', 'npm run typecheck'],
            ['lint', 'npm run lint'],
            ['test', 'npm run test'],
            ['build', 'npm run build'],
            ['js-budget', 'node scripts/js-budget.mjs'],
        ], `étapes de verify : ${JSON.stringify(steps)}`);
    });

    test('mesure seule sans budget : gzip niveau 9 des .js distincts de /layout ∪ /template ∪ page, TSV écrit, aucun échec', (t) => {
        const build = fakeBuild();
        t.after(() => fs.rmSync(build.dir, { recursive: true, force: true }));
        for (const budget of [undefined, {}] as const) {
            const r = runBudget(build.dir, budget);
            assert.equal(r.status, 0, `budget ${JSON.stringify(budget ?? 'absent')} : code ${r.status}\n${r.stdout}\n${r.stderr}`);
            assert.match(r.stdout, /MESURE SEULE/, 'le mode « mesure seule » est annoncé');
            assert.ok(r.tsv, 'TSV écrit');
            const rows = tsvRows(r.tsv ?? '');
            assert.deepEqual(rows.map((x) => x.route), MEASURED_ROUTES, 'une ligne par route mesurée, dans l\'ordre');
            const by = Object.fromEntries(rows.map((x) => [x.route, x]));
            assert.equal(Number(by['/'].octets_gzip), expectedGzip(build, '/page'), '/ : somme gzip');
            assert.equal(Number(by['/events/[id]'].octets_gzip), expectedGzip(build, '/events/[id]/page'), '/events/[id] : somme gzip');
            assert.equal(Number(by['/tickets'].octets_gzip), expectedGzip(build, '/tickets/page'), '/tickets : somme gzip (fichiers communs comptés une fois)');
            assert.equal(by['/tickets'].fichiers, '6', '/tickets : webpack, main-app, layout, template, shared, page (CSS exclue)');
            assert.equal(Number(by['/controller/scanner'].octets_gzip), expectedGzip(build, '/controller/scanner/page'), '/controller/scanner : somme gzip');
            assert.deepEqual([by['/billet/hors-ligne'].statut, by['/billet/hors-ligne'].octets_gzip], ['ABSENTE', ''], '/billet/hors-ligne absente du build, sans budget : signalée, pas d\'échec');
            for (const route of ['/', '/events/[id]', '/tickets', '/controller/scanner']) assert.equal(by[route].statut, 'MESURE', `${route} : statut`);
            assert.match(r.stdout, /\[JS-BUDGET\] \/tickets : \d+ octets gzip/, 'ligne [JS-BUDGET] imprimée pour /tickets');
        }
    });

    test('budgets : dépassement → code 1 ; dans le budget → code 0 ; route inconnue ou valeur invalide → code 2 ; route budgétée ou attendue absente → code 1', (t) => {
        const build = fakeBuild();
        t.after(() => fs.rmSync(build.dir, { recursive: true, force: true }));
        const tickets = expectedGzip(build, '/tickets/page');

        const over = runBudget(build.dir, { '/tickets': tickets - 1 });
        assert.equal(over.status, 1, `dépassement d'un octet : code ${over.status}\n${over.stdout}\n${over.stderr}`);
        assert.match(over.stderr, /\/tickets : \d+ octets gzip > budget \d+ \(dépassement 1\)/, `message de dépassement : ${over.stderr}`);
        assert.equal(tsvRows(over.tsv ?? '').find((x) => x.route === '/tickets')?.statut, 'DEPASSE', 'TSV : /tickets DEPASSE');

        const exact = runBudget(build.dir, { '/tickets': tickets, '/': expectedGzip(build, '/page') });
        assert.equal(exact.status, 0, `budget exactement atteint : code ${exact.status}\n${exact.stdout}\n${exact.stderr}`);
        assert.doesNotMatch(exact.stdout, /MESURE SEULE/);

        const unknown = runBudget(build.dir, { '/ticket': 100_000 });
        assert.equal(unknown.status, 2, `route inconnue : code ${unknown.status}\n${unknown.stderr}`);
        assert.match(unknown.stderr, /route inconnue .*« \/ticket »/);

        for (const bad of [{ '/tickets': 0 }, { '/tickets': 12.5 }, { '/tickets': '200000' }, '[1]', '{ invalide']) {
            const r = runBudget(build.dir, bad);
            assert.equal(r.status, 2, `budget invalide ${JSON.stringify(bad)} : code ${r.status}\n${r.stderr}`);
        }

        const absent = runBudget(build.dir, { '/billet/hors-ligne': 150_000 });
        assert.equal(absent.status, 1, `route budgétée absente du build : code ${absent.status}\n${absent.stdout}\n${absent.stderr}`);
        assert.match(absent.stderr, /\/billet\/hors-ligne : route budgétée absente du build/);

        const manifest = JSON.parse(fs.readFileSync(path.join(build.dir, 'app-build-manifest.json'), 'utf8')) as { pages: Record<string, string[]> };
        delete manifest.pages['/tickets/page'];
        fs.writeFileSync(path.join(build.dir, 'app-build-manifest.json'), JSON.stringify(manifest));
        const missingRoute = runBudget(build.dir, undefined);
        assert.equal(missingRoute.status, 1, `route existante absente du build, même sans budget : code ${missingRoute.status}\n${missingRoute.stderr}`);
        assert.match(missingRoute.stderr, /\/tickets : route attendue absente du build/);

        delete manifest.pages['/layout'];
        fs.writeFileSync(path.join(build.dir, 'app-build-manifest.json'), JSON.stringify(manifest));
        const noLayout = runBudget(build.dir, undefined);
        assert.equal(noLayout.status, 2, `entrée /layout absente : code ${noLayout.status}\n${noLayout.stderr}`);

        const noBuild = runBudget(path.join(build.dir, 'inexistant'), undefined);
        assert.equal(noBuild.status, 2, `build absent : code ${noBuild.status}\n${noBuild.stderr}`);
        assert.match(noBuild.stderr, /app-build-manifest\.json introuvable/);
    });

    test('scripts/js-budget.json fixe un budget bloquant (octets gzip) pour chacune des cinq routes mesurées', () => {
        const file = path.join(ROOT, 'scripts/js-budget.json');
        assert.ok(fs.existsSync(file), 'scripts/js-budget.json absent : le poids JavaScript n\'est que mesuré, aucun budget ne bloque (fix(7.5), D76)');
        const budgets = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
        assert.deepEqual(Object.keys(budgets).sort(), [...MEASURED_ROUTES].sort(), `routes budgétées : ${JSON.stringify(Object.keys(budgets))}`);
        for (const route of MEASURED_ROUTES) {
            const v = budgets[route];
            assert.ok(Number.isInteger(v) && (v as number) > 0, `budget de ${route} : entier d'octets > 0 attendu, trouvé ${JSON.stringify(v)}`);
        }
    });
});

// ── Animation d'entrée de page (D78) ───────────────────────────────────────

interface CssNode { prelude: string; body: string; children: CssNode[] }

/** Découpe une feuille de style en blocs imbriqués (commentaires retirés, chaînes respectées). */
function parseCss(css: string): CssNode[] {
    const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const parseBlock = (from: number, to: number): CssNode[] => {
        const nodes: CssNode[] = [];
        let i = from;
        let start = from;
        while (i < to) {
            const ch = text[i];
            if (ch === '"' || ch === "'") {
                const end = text.indexOf(ch, i + 1);
                i = end === -1 ? to : end + 1;
                continue;
            }
            if (ch === ';') { start = i + 1; i++; continue; }
            if (ch === '{') {
                let depth = 1;
                let j = i + 1;
                while (j < to && depth > 0) {
                    if (text[j] === '{') depth++;
                    else if (text[j] === '}') depth--;
                    j++;
                }
                const prelude = text.slice(start, i).trim();
                const body = text.slice(i + 1, j - 1);
                nodes.push({ prelude, body, children: body.includes('{') ? parseBlock(i + 1, j - 1) : [] });
                i = j;
                start = j;
                continue;
            }
            if (ch === '}') { start = i + 1; }
            i++;
        }
        return nodes;
    };
    return parseBlock(0, text.length);
}

function declarations(body: string): Record<string, string> {
    const out: Record<string, string> = {};
    for (const part of body.replace(/\{[\s\S]*\}/g, '').split(';')) {
        const idx = part.indexOf(':');
        if (idx === -1) continue;
        out[part.slice(0, idx).trim().toLowerCase()] = part.slice(idx + 1).trim();
    }
    return out;
}

const ANIMATION_KEYWORDS = new Set(['none', 'infinite', 'normal', 'reverse', 'alternate', 'alternate-reverse', 'forwards', 'backwards', 'both',
    'running', 'paused', 'ease', 'ease-in', 'ease-out', 'ease-in-out', 'linear', 'step-start', 'step-end', 'initial', 'inherit', 'unset']);

/** Noms d'animation d'une déclaration `animation` ou `animation-name`. */
function animationNames(decl: Record<string, string>): string[] {
    const names: string[] = [];
    if (decl['animation-name']) names.push(...decl['animation-name'].split(',').map((s) => s.trim()).filter((s) => s && s !== 'none'));
    if (decl.animation) {
        for (const one of decl.animation.replace(/[\w-]+\([^)]*\)/g, ' ').split(',')) {
            for (const tok of one.trim().split(/\s+/)) {
                if (!tok || ANIMATION_KEYWORDS.has(tok.toLowerCase()) || /^-?[\d.]+(m?s)?$/i.test(tok)) continue;
                names.push(tok);
            }
        }
    }
    return names;
}

function opacityIsZero(value: string | undefined): boolean {
    if (value === undefined) return false;
    const v = value.replace(/!important/i, '').trim();
    const n = v.endsWith('%') ? Number(v.slice(0, -1)) / 100 : Number(v);
    return Number.isFinite(n) && n === 0;
}

function cssFiles(): string[] {
    const out: string[] = [];
    const walk = (dir: string): void => {
        if (!fs.existsSync(path.join(ROOT, dir))) return;
        for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
            if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
            const rel = `${dir}/${entry.name}`;
            if (entry.isDirectory()) walk(rel);
            else if (entry.isFile() && entry.name.endsWith('.css')) out.push(rel);
        }
    };
    for (const d of ['app', 'components', 'styles']) walk(d);
    return out.sort();
}

describe('7.5 animation d\'entrée de page (D78)', () => {
    test('.ev-page-enter n\'anime plus l\'opacité depuis 0 (aucune règle ni image clé de départ à opacity: 0)', () => {
        const rules: { file: string; selector: string; decl: Record<string, string> }[] = [];
        const keyframes = new Map<string, { file: string; frames: CssNode[] }>();
        const collect = (file: string, nodes: CssNode[]): void => {
            for (const n of nodes) {
                const kf = /^@(?:-webkit-)?keyframes\s+([\w-]+)/i.exec(n.prelude);
                if (kf) { keyframes.set(kf[1], { file, frames: n.children }); continue; }
                if (n.prelude.startsWith('@')) { collect(file, n.children); continue; }
                if (n.prelude.split(',').some((sel) => /\.ev-page-enter(?![\w-])/.test(sel))) {
                    rules.push({ file, selector: n.prelude, decl: declarations(n.body) });
                }
            }
        };
        for (const file of cssFiles()) collect(file, parseCss(read(file)));
        assert.ok(keyframes.size > 0, 'détecteur CSS : aucune règle @keyframes lue dans app/, lecture suspecte');

        const problems: string[] = [];
        for (const r of rules) {
            if (opacityIsZero(r.decl.opacity)) problems.push(`${r.file} « ${r.selector} » : opacity ${r.decl.opacity}`);
            for (const name of animationNames(r.decl)) {
                const k = keyframes.get(name);
                if (!k) { problems.push(`${r.file} « ${r.selector} » : animation « ${name} » sans @keyframes lisible dans app/, components/, styles/`); continue; }
                for (const frame of k.frames) {
                    const stops = frame.prelude.split(',').map((s) => s.trim().toLowerCase());
                    if (!stops.some((s) => s === 'from' || s === '0%')) continue;
                    const d = declarations(frame.body);
                    if (opacityIsZero(d.opacity)) problems.push(`${k.file} @keyframes ${name} « ${frame.prelude} » : opacity ${d.opacity} (premier affichage retardé, LCP)`);
                }
            }
        }
        assert.deepEqual(problems, [], `.ev-page-enter part d'une opacité nulle (D78 : transform seul) :\n${problems.join('\n')}`);
    });

    test('auto-test du lecteur CSS : image clé de départ, raccourci animation, opacity 0 et 0%', () => {
        const css = '/* .ev-page-enter { opacity: 0 } */\n@keyframes kA { from { opacity: 0; transform: x } to { opacity: 1 } }\n'
            + '@media (min-width: 1px) { .ev-page-enter, .b { animation: kA 0.32s cubic-bezier(0.22, 1, 0.36, 1) both; } }';
        const nodes = parseCss(css);
        assert.equal(nodes.length, 2);
        assert.equal(nodes[0].prelude, '@keyframes kA');
        assert.deepEqual(nodes[0].children.map((c) => c.prelude), ['from', 'to']);
        assert.equal(declarations(nodes[0].children[0].body).opacity, '0');
        assert.equal(nodes[1].children[0].prelude, '.ev-page-enter, .b');
        assert.deepEqual(animationNames(declarations(nodes[1].children[0].body)), ['kA']);
        assert.deepEqual(animationNames({ 'animation-name': 'a, b', animation: 'c 1s ease-in-out 200ms infinite' }), ['a', 'b', 'c']);
        assert.equal(opacityIsZero('0'), true);
        assert.equal(opacityIsZero('0%'), true);
        assert.equal(opacityIsZero('0.0 !important'), true);
        assert.equal(opacityIsZero('0.6'), false);
        assert.equal(opacityIsZero(undefined), false);
    });
});
