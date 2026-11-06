/**
 * Lot 8, tâche 8.2 i — contrôle statique : aucun message brut de la base n'atteint le navigateur (contrat 3.8,
 * 8.2, section 9 ; AR10, L51, L52). Reprend le prototype d8i/scan.cjs de la découverte.
 *
 * Sans base : la suite lit les sources par l'arbre syntaxique de TypeScript (commentaires exclus) et n'écrit rien.
 * Elle tourne sur le poste : EV_ENV_FILE=.env.test.example node scripts/run-tests.mjs tests/schema/messages-bruts.test.ts
 *
 * Source : .message, .details, .hint, .stack sur un nom d'erreur, String(err), err.toString(), JSON.stringify(err),
 * ${err}, (err as Error).message, et l'erreur elle-même en valeur ({ error }, { error: err }).
 * Puits : NextResponse.json, Response.json, new Response, new NextResponse.
 *  - Règle 1 : aucun puits de app/api et de lib ne reçoit une source, directement ou par variable locale, sauf
 *    sous `err instanceof X` avec X dans la liste blanche (ALLOWED_CLASSES).
 *  - Règle 2 : un helper local ne transmet pas un argument touché à un puits (suivi du paramètre, un niveau).
 *  - Règle 3 : `return { error: <source> }` dans lib/ est limité à LIB_RETURNS, chaque entrée avec sa raison.
 *  - Règle 4 (ajout de cet écrivain, lot I6, section 9, qui n'a pas de rouge au contrat) : dans les quatre écrans
 *    du lot I6, `err.message` n'atteint jamais l'affichage sous `instanceof Error`, seul filtre d'aujourd'hui :
 *    il laisse passer le texte anglais de Supabase Auth et « Failed to fetch ».
 *  - Auto-contrôle : chaque motif est détecté sur un texte de démonstration. Sans lui, un contrôleur vide resterait
 *    vert. Il est VERT dès l'écriture, annoncé : il prouve l'outil, pas le dépôt.
 *
 * Le contrat 3.8 de apiFailure et PublicError est vérifié ici aussi, sans base.
 *
 * Rouge aujourd'hui : 62 fautes des règles 1 et 2, imprimées fichier:ligne (l'inventaire de la section 9), 8 fautes
 * de la règle 4, lib/api/public-error.ts absent. La règle 3 est verte : sa liste décrit le dépôt, et une entrée
 * périmée la fait échouer.
 * Vert après fix(8.2i-1) à fix(8.2i-6).
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const ROOT = process.cwd();

/** Classes métier dont le message est rédigé en français pour l'écran (contrat 8.2, règle 1). */
const ALLOWED_CLASSES = new Set(['PublicError', 'PaymentInputError', 'ShiftError', 'EventServiceError', 'EventLifecycleError', 'PilotageError']);

/** Règle 3 : `return { error: <source> }` admis dans lib/, par fichier et fonction, avec le nombre exact et la raison. */
const LIB_RETURNS: ReadonlyArray<{ file: string; fn: string; count: number; reason: string }> = [
    {
        file: 'lib/auth/roles.ts',
        fn: 'addUserRole',
        count: 1,
        reason: 'résultat lu par les appelants, qui journalisent et rendent un message fixe (controller/setup, partner/team/invite)',
    },
    {
        file: 'lib/auth/roles.ts',
        fn: 'removeUserRole',
        count: 1,
        reason: 'même contrat que addUserRole',
    },
    {
        file: 'lib/hardware/torch.ts',
        fn: 'setTorchState',
        count: 1,
        reason: 'code du navigateur : erreur de l\'API caméra, sans base ni réponse de route',
    },
    {
        file: 'lib/payments/rpc.ts',
        fn: 'rpcWithRetry',
        count: 1,
        reason: 'rend l\'objet d\'erreur de supabase.rpc à son appelant serveur, qui le journalise ; la règle 1 couvre la réponse de route',
    },
    {
        file: 'lib/push/web-push.adapter.ts',
        fn: 'send',
        count: 2,
        reason: 'motif d\'échec d\'un envoi push rangé dans le journal d\'envoi, jamais dans une réponse de route',
    },
];

/** Écrans du lot I6 (règle 4). */
const BROWSER_FILES = ['components/auth/LoginForm.tsx', 'app/forgot-password/page.tsx', 'app/reset-password/page.tsx', 'app/global-error.tsx'];

const SOURCE_PROPS = new Set(['message', 'details', 'hint', 'stack']);
const ERROR_NAME = /^(err|error|e|ex|exc|cause|\w*(Err|Error))$|\.error$/;
/** Méthodes qui rendent une réponse à une question sur le texte, jamais le texte : une condition, pas une fuite. */
const TEST_METHODS = new Set(['includes', 'startsWith', 'endsWith', 'match', 'test', 'search', 'indexOf']);
const COMPARISONS = new Set<ts.SyntaxKind>([
    ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken,
    ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken,
    ts.SyntaxKind.LessThanToken, ts.SyntaxKind.GreaterThanToken,
    ts.SyntaxKind.InstanceOfKeyword, ts.SyntaxKind.InKeyword,
]);

const API_SINK_CALLS = ['NextResponse.json', 'Response.json'];
const API_SINK_NEW = ['Response', 'NextResponse'];
const BROWSER_SINK_CALLS = ['setErrorMessage', 'setError', 'recordFailedAttempt', 'toast.error'];

interface Fault { rule: 1 | 2 | 3 | 4; file: string; line: number; detail: string }

interface AnalyzeOptions {
    sinkCalls: readonly string[];
    sinkNew: readonly string[];
    /** Le texte JSX est-il un puits ? (écrans, règle 4) */
    jsxSink: boolean;
    /** La classe garde-t-elle le message ? */
    allowedClass: (name: string) => boolean;
    /** Numéro de règle des fautes directes. */
    rule: 1 | 4;
}

const API_OPTIONS: AnalyzeOptions = {
    sinkCalls: API_SINK_CALLS,
    sinkNew: API_SINK_NEW,
    jsxSink: false,
    allowedClass: (name) => ALLOWED_CLASSES.has(name),
    rule: 1,
};

/** Écrans : toute classe propre convient, sauf Error, qui ne filtre rien. */
const BROWSER_OPTIONS: AnalyzeOptions = {
    sinkCalls: BROWSER_SINK_CALLS,
    sinkNew: [],
    jsxSink: true,
    allowedClass: (name) => name !== 'Error',
    rule: 4,
};

type TaintMap = Map<ts.Node, Map<string, string>>;

function unwrap(expr: ts.Expression): ts.Expression {
    let e = expr;
    while (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isNonNullExpression(e) || ts.isTypeAssertionExpression(e) || ts.isSatisfiesExpression(e)) {
        e = e.expression;
    }
    return e;
}

function scriptKind(file: string): ts.ScriptKind {
    return file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
}

/** Fautes d'un texte source. `file` décide seulement de l'application de la règle 3 (préfixe lib/). */
function analyze(file: string, text: string, options: AnalyzeOptions = API_OPTIONS): Fault[] {
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, scriptKind(file));
    const faults: Fault[] = [];
    const lineOf = (n: ts.Node): number => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;

    const errorText = (expr: ts.Expression): string | null => {
        const t = unwrap(expr).getText(sf).replace(/\?\./g, '.');
        return ERROR_NAME.test(t) ? t : null;
    };

    // Portée d'un nom : la fonction englobante (deux fonctions d'un fichier peuvent réutiliser un même nom).
    const scopeOf = (n: ts.Node): ts.Node => {
        let p: ts.Node | undefined = n.parent;
        while (p && !ts.isFunctionLike(p) && !ts.isSourceFile(p)) p = p.parent;
        return p ?? sf;
    };

    const lookup = (map: TaintMap, name: string, from: ts.Node): string | null => {
        for (let scope: ts.Node = scopeOf(from); ; scope = scopeOf(scope)) {
            const hit = map.get(scope)?.get(name);
            if (hit !== undefined) return hit;
            if (ts.isSourceFile(scope)) return null;
        }
    };

    // Variables de catch et `const { error } = …` : l'erreur elle-même, en valeur, est une source.
    const errorBindings = new Map<ts.Node, Set<string>>();
    const bindError = (scope: ts.Node, name: string): void => {
        const set = errorBindings.get(scope) ?? new Set<string>();
        set.add(name);
        errorBindings.set(scope, set);
    };
    (function collect(n: ts.Node): void {
        if (ts.isCatchClause(n) && n.variableDeclaration && ts.isIdentifier(n.variableDeclaration.name)) {
            bindError(scopeOf(n), n.variableDeclaration.name.text);
        }
        if (ts.isBindingElement(n) && ts.isIdentifier(n.name) && (n.propertyName ?? n.name).getText(sf) === 'error') {
            bindError(scopeOf(n), n.name.text);
        }
        // Paramètre : une erreur, sauf s'il est déclaré chaîne (function invalid(error: string), texte déjà rédigé).
        if (ts.isParameter(n) && ts.isIdentifier(n.name) && ERROR_NAME.test(n.name.text) && !/\bstring\b/.test(n.type?.getText(sf) ?? '')) {
            bindError(n.parent, n.name.text);
        }
        ts.forEachChild(n, collect);
    })(sf);
    const isErrorBinding = (id: ts.Identifier): boolean => {
        for (let scope: ts.Node = scopeOf(id); ; scope = scopeOf(scope)) {
            if (errorBindings.get(scope)?.has(id.text)) return true;
            if (ts.isSourceFile(scope)) return false;
        }
    };

    /** Texte de l'erreur lue par ce nœud, sans regarder ses enfants. */
    const readsError = (n: ts.Node): { base: string; text: string } | null => {
        if (ts.isPropertyAccessExpression(n) && SOURCE_PROPS.has(n.name.text)) {
            const base = errorText(n.expression);
            if (base) return { base, text: n.getText(sf) };
        }
        if (ts.isElementAccessExpression(n) && ts.isStringLiteralLike(n.argumentExpression) && SOURCE_PROPS.has(n.argumentExpression.text)) {
            const base = errorText(n.expression);
            if (base) return { base, text: n.getText(sf) };
        }
        if (ts.isCallExpression(n)) {
            const callee = n.expression.getText(sf);
            if ((callee === 'String' || callee === 'JSON.stringify') && n.arguments[0]) {
                const base = errorText(n.arguments[0]);
                if (base) return { base, text: n.getText(sf) };
            }
            if (ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'toString') {
                const base = errorText(n.expression.expression);
                if (base) return { base, text: n.getText(sf) };
            }
        }
        if (ts.isTemplateSpan(n)) {
            const inner = unwrap(n.expression);
            if (ts.isIdentifier(inner) && isErrorBinding(inner)) return { base: inner.text, text: n.getText(sf) };
        }
        const value = ts.isShorthandPropertyAssignment(n) ? n.name
            : ts.isPropertyAssignment(n) ? unwrap(n.initializer)
                : null;
        if (value && ts.isIdentifier(value) && isErrorBinding(value)) return { base: value.text, text: n.getText(sf) };
        return null;
    };

    const guardedBy = (condition: ts.Expression, base: string): boolean => {
        const c = unwrap(condition);
        if (ts.isBinaryExpression(c)) {
            const op = c.operatorToken.kind;
            if (op === ts.SyntaxKind.InstanceOfKeyword) return unwrap(c.left).getText(sf) === base && options.allowedClass(c.right.getText(sf));
            if (op === ts.SyntaxKind.BarBarToken) return guardedBy(c.left, base) && guardedBy(c.right, base);
            if (op === ts.SyntaxKind.AmpersandAmpersandToken) return guardedBy(c.left, base) || guardedBy(c.right, base);
        }
        return false;
    };

    const isGuarded = (node: ts.Node, base: string): boolean => {
        let child: ts.Node = node;
        for (let p: ts.Node | undefined = node.parent; p; child = p, p = p.parent) {
            if (ts.isIfStatement(p) && child === p.thenStatement && guardedBy(p.expression, base)) return true;
            if (ts.isConditionalExpression(p) && child === p.whenTrue && guardedBy(p.condition, base)) return true;
            if (ts.isBinaryExpression(p) && p.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken && child === p.right && guardedBy(p.left, base)) return true;
        }
        return false;
    };

    /** Première fuite de l'expression : une source non gardée, ou une variable touchée. */
    const findLeak = (expr: ts.Node, map: TaintMap): string | null => {
        let hit: string | null = null;
        const visit = (n: ts.Node): void => {
            if (hit) return;
            if (ts.isFunctionLike(n) || ts.isThrowStatement(n)) return;
            if (ts.isCallExpression(n)) {
                const callee = n.expression.getText(sf);
                if (callee.startsWith('console.')) return;
                if (ts.isPropertyAccessExpression(n.expression) && TEST_METHODS.has(n.expression.name.text)) return;
            }
            if (ts.isBinaryExpression(n) && COMPARISONS.has(n.operatorToken.kind)) return;
            if (ts.isPrefixUnaryExpression(n) || ts.isTypeOfExpression(n)) return;
            if (ts.isConditionalExpression(n)) {
                visit(n.whenTrue);
                visit(n.whenFalse);
                return;
            }
            const source = readsError(n);
            if (source) {
                if (!isGuarded(n, source.base)) hit = source.text;
                return;
            }
            if (ts.isIdentifier(n)) {
                const p = n.parent;
                const isName = (ts.isPropertyAccessExpression(p) && p.name === n)
                    || (ts.isPropertyAssignment(p) && p.name === n)
                    || (ts.isPropertyAccessExpression(p) && p.expression === n);
                if (!isName) {
                    const origin = lookup(map, n.text, n);
                    if (origin) hit = `${n.text} ← ${origin}`;
                }
                return;
            }
            ts.forEachChild(n, visit);
        };
        visit(expr);
        return hit;
    };

    const setTaint = (map: TaintMap, scope: ts.Node, name: string, origin: string): void => {
        const entries = map.get(scope) ?? new Map<string, string>();
        if (!entries.has(name)) entries.set(name, origin.replace(/\s+/g, ' ').slice(0, 70));
        map.set(scope, entries);
    };

    /** Propage la fuite aux variables locales de `root` (trois passes : a ← b ← c). */
    const propagate = (root: ts.Node, map: TaintMap): void => {
        for (let pass = 0; pass < 3; pass++) {
            (function visit(n: ts.Node): void {
                if (ts.isVariableDeclaration(n) && n.initializer && ts.isIdentifier(n.name)) {
                    const leak = findLeak(n.initializer, map);
                    if (leak) setTaint(map, scopeOf(n), n.name.text, leak);
                }
                if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isIdentifier(n.left)) {
                    const leak = findLeak(n.right, map);
                    if (leak) setTaint(map, scopeOf(n), n.left.text, leak);
                }
                ts.forEachChild(n, visit);
            })(root);
        }
    };

    const sinkOf = (n: ts.Node): { label: string; parts: readonly ts.Node[] } | null => {
        if (ts.isCallExpression(n)) {
            const t = n.expression.getText(sf);
            if (options.sinkCalls.includes(t)) return { label: t, parts: n.arguments };
        }
        if (ts.isNewExpression(n)) {
            const t = n.expression.getText(sf);
            if (options.sinkNew.includes(t)) return { label: `new ${t}`, parts: n.arguments ?? [] };
        }
        if (options.jsxSink && ts.isJsxExpression(n) && n.expression) return { label: 'texte JSX', parts: [n.expression] };
        return null;
    };

    const leakingSinks = (root: ts.Node, map: TaintMap): Array<{ node: ts.Node; label: string; leak: string }> => {
        const out: Array<{ node: ts.Node; label: string; leak: string }> = [];
        (function visit(n: ts.Node): void {
            const sink = sinkOf(n);
            if (sink) {
                for (const part of sink.parts) {
                    const leak = findLeak(part, map);
                    if (leak) {
                        out.push({ node: n, label: sink.label, leak });
                        break;
                    }
                }
            }
            ts.forEachChild(n, visit);
        })(root);
        return out;
    };

    const fileTaint: TaintMap = new Map();
    propagate(sf, fileTaint);

    // Règles 1 et 4
    for (const s of leakingSinks(sf, fileTaint)) {
        faults.push({ rule: options.rule, file, line: lineOf(s.node), detail: `${s.label} reçoit ${s.leak.replace(/\s+/g, ' ').slice(0, 90)}` });
    }

    // Règle 2 : helpers locaux, un niveau
    const helpers = new Map<string, ts.SignatureDeclaration & { body?: ts.Node }>();
    (function collect(n: ts.Node): void {
        if (ts.isFunctionDeclaration(n) && n.name && n.body) helpers.set(n.name.text, n);
        if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer
            && (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer))) {
            helpers.set(n.name.text, n.initializer);
        }
        ts.forEachChild(n, collect);
    })(sf);
    (function visit(n: ts.Node): void {
        if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && !options.sinkCalls.includes(n.expression.text)) {
            const helper = helpers.get(n.expression.text);
            if (helper?.body) {
                n.arguments.forEach((arg, i) => {
                    const param = helper.parameters[i];
                    if (!param || !ts.isIdentifier(param.name)) return;
                    const leak = findLeak(arg, fileTaint);
                    if (!leak) return;
                    const seeded: TaintMap = new Map();
                    setTaint(seeded, helper, param.name.text, leak);
                    propagate(helper.body!, seeded);
                    const reached = leakingSinks(helper.body!, seeded);
                    if (reached.length > 0) {
                        faults.push({ rule: 2, file, line: lineOf(n), detail: `${n.expression.getText(sf)} transmet ${leak.slice(0, 60)} à ${reached[0].label} (ligne ${lineOf(reached[0].node)})` });
                    }
                });
            }
        }
        ts.forEachChild(n, visit);
    })(sf);

    return faults;
}

function enclosingFunctionName(n: ts.Node): string {
    for (let p: ts.Node | undefined = n.parent; p; p = p.parent) {
        if (ts.isFunctionDeclaration(p) && p.name) return p.name.text;
        if (ts.isMethodDeclaration(p)) return p.name.getText();
        if ((ts.isArrowFunction(p) || ts.isFunctionExpression(p)) && ts.isVariableDeclaration(p.parent)) return p.parent.name.getText();
    }
    return '(module)';
}

/** Règle 3 : chaque `return { error: <source> }` d'un fichier de lib/. */
function libReturns(file: string, text: string): Array<{ file: string; fn: string; line: number; text: string }> {
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, scriptKind(file));
    const out: Array<{ file: string; fn: string; line: number; text: string }> = [];
    const hasSource = (e: ts.Expression): boolean => {
        const u = unwrap(e);
        if (ts.isIdentifier(u)) return ERROR_NAME.test(u.text);
        if (ts.isPropertyAccessExpression(u) && SOURCE_PROPS.has(u.name.text)) return ERROR_NAME.test(unwrap(u.expression).getText(sf).replace(/\?\./g, '.'));
        if (ts.isConditionalExpression(u)) return hasSource(u.whenTrue) || hasSource(u.whenFalse);
        if (ts.isBinaryExpression(u)) return hasSource(u.left) || hasSource(u.right);
        if (ts.isTemplateExpression(u)) return u.templateSpans.some((s) => hasSource(s.expression));
        if (ts.isCallExpression(u) && u.expression.getText(sf) === 'String') return u.arguments.some(hasSource);
        return false;
    };
    (function visit(n: ts.Node): void {
        if (ts.isReturnStatement(n) && n.expression) {
            const value = unwrap(n.expression);
            if (ts.isObjectLiteralExpression(value)) {
                for (const prop of value.properties) {
                    const named = (ts.isPropertyAssignment(prop) || ts.isShorthandPropertyAssignment(prop)) && prop.name.getText(sf) === 'error';
                    if (!named) continue;
                    const leaks = ts.isPropertyAssignment(prop) ? hasSource(prop.initializer) : ERROR_NAME.test(prop.name.getText(sf));
                    if (leaks) out.push({ file, fn: enclosingFunctionName(n), line: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1, text: n.getText(sf).replace(/\s+/g, ' ').slice(0, 90) });
                }
            }
        }
        ts.forEachChild(n, visit);
    })(sf);
    return out;
}

function sourceFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
        const rel = `${dir}/${entry.name}`;
        if (entry.isDirectory()) out.push(...sourceFiles(rel));
        else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) out.push(rel);
    }
    return out;
}

const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const scanned = [...sourceFiles('app/api'), ...sourceFiles('lib')].sort();
const render = (f: Fault): string => `${f.file}:${f.line} [règle ${f.rule}] ${f.detail}`;

/** Corps de démonstration placé dans un catch : `body` voit `err`. */
const inCatch = (body: string): string => `export async function GET() { try { await run(); } catch (err: unknown) { ${body} } }`;
/** Corps placé après une lecture Supabase : `body` voit `error`. */
const afterRead = (body: string): string => `export async function GET() { const { data, error } = await read(); ${body} return ok(data); }`;

describe('8.2 i — auto-contrôle du contrôleur (vert dès l\'écriture, annoncé : il prouve l\'outil)', () => {
    const DETECTED: Array<{ name: string; text: string; rule: 1 | 2 }> = [
        { name: 'texte direct de PostgREST', rule: 1, text: afterRead(`if (error) return NextResponse.json({ error: error.message }, { status: 500 });`) },
        { name: 'ternaire sur Error', rule: 1, text: inCatch(`return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur.' }, { status: 500 });`) },
        { name: 'variable locale', rule: 1, text: inCatch(`const msg = err instanceof Error ? err.message : 'Erreur.'; return NextResponse.json({ error: msg });`) },
        { name: 'variable de variable', rule: 1, text: inCatch(`const a = (err as Error).message; const b = 'Échec : ' + a; return NextResponse.json({ error: b });`) },
        { name: 'affectation d\'un let', rule: 1, text: inCatch(`let m = 'Erreur.'; m = (err as Error).message; return NextResponse.json({ error: m });`) },
        { name: 'String(err)', rule: 1, text: inCatch(`return NextResponse.json({ error: String(err) });`) },
        { name: 'err.toString()', rule: 1, text: inCatch(`return NextResponse.json({ error: err.toString() });`) },
        { name: 'JSON.stringify(err)', rule: 1, text: inCatch(`return NextResponse.json({ error: JSON.stringify(err) });`) },
        { name: '${err}', rule: 1, text: inCatch('return NextResponse.json({ error: `Échec : ${err}` });') },
        { name: '(err as Error).message', rule: 1, text: inCatch(`return NextResponse.json({ error: (err as Error).message });`) },
        { name: 'err?.message', rule: 1, text: inCatch(`return NextResponse.json({ error: err?.message });`) },
        { name: 'err[\'message\']', rule: 1, text: inCatch(`return NextResponse.json({ error: err['message'] });`) },
        { name: '.details', rule: 1, text: afterRead(`if (error) return NextResponse.json({ error: 'Erreur.', detail: error.details });`) },
        { name: '.hint', rule: 1, text: afterRead(`if (error) return NextResponse.json({ error: 'Erreur.', hint: error.hint });`) },
        { name: '.stack', rule: 1, text: inCatch(`return NextResponse.json({ error: 'Erreur.', trace: (err as Error).stack });`) },
        { name: 'erreur d\'un champ imbriqué', rule: 1, text: `const r = await read(); return NextResponse.json({ error: r.error.message });` },
        { name: 'nom suffixé', rule: 1, text: `const { error: updateErr } = await write(); return NextResponse.json({ error: updateErr.message });` },
        { name: 'l\'erreur en valeur, abrégée', rule: 1, text: afterRead(`if (error) return NextResponse.json({ error });`) },
        { name: 'l\'erreur en valeur, nommée', rule: 1, text: inCatch(`return NextResponse.json({ error: err });`) },
        { name: 'paramètre non typé chaîne', rule: 1, text: 'function fail(err: unknown) { return NextResponse.json({ error: `Échec : ${err}` }); }' },
        { name: 'Response.json', rule: 1, text: inCatch(`return Response.json({ error: (err as Error).message });`) },
        { name: 'new Response', rule: 1, text: inCatch(`return new Response((err as Error).message, { status: 500 });`) },
        { name: 'new Response avec JSON.stringify', rule: 1, text: inCatch(`return new Response(JSON.stringify({ error: (err as Error).message }));`) },
        { name: 'new NextResponse', rule: 1, text: inCatch(`return new NextResponse((err as Error).message, { status: 500 });`) },
        { name: 'autre argument que le premier', rule: 1, text: inCatch(`return NextResponse.json({}, { status: 500, statusText: (err as Error).message });`) },
        { name: 'garde sur un autre objet', rule: 1, text: `try { a(); } catch (err) { if (other instanceof PublicError) return NextResponse.json({ error: err.message }); }` },
        { name: 'garde mêlée à Error', rule: 1, text: inCatch(`if (err instanceof PublicError || err instanceof Error) return NextResponse.json({ error: err.message });`) },
        { name: 'branche sinon d\'une garde', rule: 1, text: inCatch(`return NextResponse.json({ error: err instanceof PublicError ? 'Refus.' : (err as Error).message });`) },
        { name: 'classe hors liste', rule: 1, text: inCatch(`if (err instanceof TypeError) return NextResponse.json({ error: err.message });`) },
        {
            name: 'helper local (fonction)', rule: 2,
            text: `function fail(detail: string) { return NextResponse.json({ error: detail }); } export async function GET() { try { await run(); } catch (err) { return fail((err as Error).message); } }`,
        },
        {
            name: 'helper local (flèche, variable interne)', rule: 2,
            text: `const fail = (detail: string, status: number) => { const body = { error: detail }; return NextResponse.json(body, { status }); }; export async function GET() { try { await run(); } catch (err) { const m = String(err); return fail(m, 500); } }`,
        },
    ];

    for (const c of DETECTED) {
        test(`détecte : ${c.name}`, () => {
            const faults = analyze('app/api/demo/route.ts', c.text);
            assert.ok(faults.some((f) => f.rule === c.rule), `motif « ${c.name} » non détecté par la règle ${c.rule} : ${JSON.stringify(faults)}`);
        });
    }

    const ACCEPTED: Array<{ name: string; text: string }> = [
        { name: 'if instanceof, chaque classe de la liste', text: Array.from(ALLOWED_CLASSES, (c) => inCatch(`if (err instanceof ${c}) return NextResponse.json({ error: err.message }, { status: 400 });`)).join('\n') },
        { name: 'ternaire gardé', text: inCatch(`return NextResponse.json({ error: err instanceof PublicError ? err.message : 'Erreur.' });`) },
        { name: 'et logique gardé', text: inCatch(`return NextResponse.json({ error: (err instanceof ShiftError && err.message) || 'Erreur.' });`) },
        { name: 'variable gardée', text: inCatch(`const msg = err instanceof PublicError ? err.message : 'Erreur.'; return NextResponse.json({ error: msg });`) },
        { name: 'journal seul', text: inCatch(`console.error('[route]', err instanceof Error ? err.message : String(err)); return NextResponse.json({ error: 'Erreur.', code: 'X_UNAVAILABLE' }, { status: 500 });`) },
        { name: 'helper qui ne journalise que le détail', text: `function fail(context: string, detail: string) { console.error(context, detail); return NextResponse.json({ error: 'Erreur.' }, { status: 500 }); } export async function GET() { try { await run(); } catch (err) { return fail('lecture', (err as Error).message); } }` },
        { name: 'message d\'une RPC', text: `const sale = await rpc(); return NextResponse.json({ error: sale.message, details: sale.details });` },
        { name: 'refus Zod', text: `const parsed = schema.safeParse(body); if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message });` },
        { name: 'throw dans une fonction passée en argument', text: `const r = await run().catch((e) => { throw new Error(e.message); }); return NextResponse.json({ ok: r });` },
        { name: 'condition sur le texte', text: inCatch(`const dup = (err as Error).message.includes('duplicate'); return NextResponse.json({ error: dup ? 'Déjà pris.' : 'Erreur.' });`) },
        { name: 'test en ternaire', text: inCatch(`return NextResponse.json({ error: (err as Error).message === 'x' ? 'Refus.' : 'Erreur.' });`) },
        { name: 'même nom de variable dans une autre fonction', text: `function a(err: Error) { const msg = err.message; console.error(msg); } function b() { const msg = 'Erreur.'; return NextResponse.json({ error: msg }); }` },
        { name: 'chaîne appelée error', text: `const error = 'Refus.'; return NextResponse.json({ error });` },
        { name: 'gabarit d\'une chaîne au nom d\'erreur', text: 'const customError = \'Refus.\'; return NextResponse.json({ error: `Compte : ${customError}` });' },
        { name: 'paramètre déclaré chaîne', text: 'function invalid(error: string, customError?: string) { return NextResponse.json({ error, detail: `${customError}`, code: \'INVALID_QUERY\' }); }' },
        { name: 'code de la base hors de la réponse', text: inCatch(`console.error((err as Error).stack); return NextResponse.json({ error: 'Erreur.' });`) },
    ];

    for (const c of ACCEPTED) {
        test(`n'accuse pas : ${c.name}`, () => {
            assert.deepEqual(analyze('app/api/demo/route.ts', c.text).map(render), [], `faux positif sur « ${c.name} »`);
        });
    }

    test('règle 3 : détecte return { error: err.message } et ses variantes, ignore un texte fixe', () => {
        const count = (text: string): number => libReturns('lib/demo.ts', `export function f(err: Error, error: { message: string }) { ${text} }`).length;
        assert.equal(count(`return { error: err.message };`), 1, 'texte direct non détecté');
        assert.equal(count(`return { ok: false, error: error.message };`), 1, 'objet à plusieurs clés non détecté');
        assert.equal(count(`return { error: err ? err.message : 'x' };`), 1, 'ternaire non détecté');
        assert.equal(count('return { error: `Échec : ${err.message}` };'), 1, 'gabarit non détecté');
        assert.equal(count(`return { error: 'Refus.' };`), 0, 'texte fixe accusé à tort');
        assert.equal(count(`return { error: reason.message };`), 0, 'objet sans nom d\'erreur accusé à tort');
    });

    test('règle 4 : Error ne garde rien à l\'écran, une classe propre oui, le texte JSX est un puits', () => {
        const screen = (body: string): Fault[] => analyze('app/demo/page.tsx', `export function P() { const go = async () => { try { await run(); } catch (err: unknown) { ${body} } }; return null; }`, BROWSER_OPTIONS);
        assert.equal(screen(`const msg = err instanceof Error ? err.message : 'Erreur.'; setErrorMessage(msg);`).length, 1, 'setErrorMessage sous instanceof Error non détecté');
        assert.equal(screen(`const msg = err instanceof Error ? err.message : 'Erreur.'; recordFailedAttempt(msg);`).length, 1, 'recordFailedAttempt non détecté');
        assert.equal(screen(`toast.error((err as Error).message);`).length, 1, 'toast.error non détecté');
        assert.equal(screen(`const msg = err instanceof AuthDisplayError ? err.message : 'Erreur.'; setErrorMessage(msg);`).length, 0, 'classe propre accusée à tort');
        assert.equal(screen(`console.error(err); setErrorMessage('Erreur.');`).length, 0, 'message fixe accusé à tort');
        const jsx = analyze('app/global-error.tsx', `export default function G({ error }: { error: Error }) { return <p>{error.message || 'Erreur.'}</p>; }`, BROWSER_OPTIONS);
        assert.equal(jsx.length, 1, 'error.message en texte JSX non détecté');
    });

    test('le contrôleur voit bien les sources du dépôt (contrôle vide impossible)', () => {
        assert.ok(scanned.length > 150, `seulement ${scanned.length} fichiers parcourus`);
        for (const known of ['app/api/admin/audit/route.ts', 'app/api/partner/halls/route.ts', 'lib/auth/roles.ts', 'lib/events/event.service.ts']) {
            assert.ok(scanned.includes(known), `${known} n'est pas parcouru`);
        }
        for (const f of BROWSER_FILES) assert.ok(fs.existsSync(path.join(ROOT, f)), `${f} : écran du lot I6 introuvable`);
        for (const entry of LIB_RETURNS) assert.ok(entry.reason.length > 20, `${entry.file} : raison manquante`);
    });
});

describe('8.2 i — aucun message brut sur le dépôt', () => {
    test('règles 1 et 2 : aucune source n\'atteint une réponse (app/api, lib)', () => {
        const faults = scanned.flatMap((f) => analyze(f, read(f)));
        const lines = faults.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line).map(render);
        assert.deepEqual(lines, [], `${lines.length} message(s) brut(s) renvoyé(s) au navigateur :\n${lines.join('\n')}`);
    });

    test('règle 3 : return { error: <source> } dans lib/ limité à la liste explicite, sans entrée périmée', () => {
        const found = scanned.filter((f) => f.startsWith('lib/')).flatMap((f) => libReturns(f, read(f)));
        const counted = new Map<string, typeof found>();
        for (const r of found) counted.set(`${r.file}#${r.fn}`, [...(counted.get(`${r.file}#${r.fn}`) ?? []), r]);
        const faults: string[] = [];
        for (const [key, rows] of Array.from(counted)) {
            const entry = LIB_RETURNS.find((e) => `${e.file}#${e.fn}` === key);
            if (!entry || rows.length > entry.count) {
                faults.push(...rows.map((r) => `${r.file}:${r.line} (${r.fn}) hors de la liste : ${r.text}`));
            }
        }
        for (const e of LIB_RETURNS) {
            if (!counted.has(`${e.file}#${e.fn}`)) faults.push(`${e.file}#${e.fn} : entrée périmée, à retirer de la liste`);
        }
        assert.deepEqual(faults, [], `lib/ rend un texte d'erreur brut :\n${faults.join('\n')}`);
    });

    test('règle 4 : les écrans du lot I6 n\'affichent pas err.message filtré par Error (LoginForm, mot de passe, global-error)', () => {
        const lines = BROWSER_FILES.flatMap((f) => analyze(f, read(f), BROWSER_OPTIONS)).map(render);
        assert.deepEqual(lines, [], `texte brut à l'écran (Supabase Auth en anglais, « Failed to fetch ») :\n${lines.join('\n')}`);
    });
});

describe('8.2 i — contrat 3.8 : PublicError et apiFailure', () => {
    const MODULE = '../../lib/api/public-error';

    interface PublicErrorModule {
        PublicError: new (message: string, code?: string, status?: number) => Error & { code?: string; status?: number };
        apiFailure: (context: string, err: unknown, fallback: { message: string; code: string; status?: number }) => Response;
    }

    async function load(): Promise<PublicErrorModule> {
        const target = MODULE;
        try {
            return (await import(target)) as PublicErrorModule;
        } catch (err) {
            assert.fail(`lib/api/public-error.ts absent ou illisible (fix(8.2i-1)) : ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    const FALLBACK = { message: 'Salles momentanément indisponibles.', code: 'HALLS_UNAVAILABLE' };

    async function captured(fn: () => Response): Promise<{ status: number; body: Record<string, unknown>; logged: string }> {
        const original = console.error;
        const logs: string[] = [];
        console.error = (...args: unknown[]): void => {
            logs.push(args.map((a) => (a instanceof Error ? `${a.message}` : String(a))).join(' '));
        };
        try {
            const res = fn();
            return { status: res.status, body: (await res.json()) as Record<string, unknown>, logged: logs.join('\n') };
        } finally {
            console.error = original;
        }
    }

    test('PublicError étend Error et garde son message', async () => {
        const { PublicError } = await load();
        const err = new PublicError('Le nom de la salle est obligatoire.', 'HALL_NAME_REQUIRED', 422);
        assert.ok(err instanceof Error, 'PublicError doit étendre Error (assert.rejects, journaux)');
        assert.equal(err.message, 'Le nom de la salle est obligatoire.');
        assert.equal(err.code, 'HALL_NAME_REQUIRED');
        assert.equal(err.status, 422);
    });

    test('PublicError : message, code et statut de l\'erreur', async () => {
        const { PublicError, apiFailure } = await load();
        const out = await captured(() => apiFailure('halls', new PublicError('Salle déjà réservée.', 'HALL_TAKEN', 409), FALLBACK));
        assert.equal(out.status, 409);
        assert.deepEqual(out.body, { error: 'Salle déjà réservée.', code: 'HALL_TAKEN' });
    });

    test('PublicError sans code ni statut : code du repli, 400 par défaut', async () => {
        const { PublicError, apiFailure } = await load();
        const out = await captured(() => apiFailure('halls', new PublicError('Salle déjà réservée.'), FALLBACK));
        assert.equal(out.status, 400);
        assert.deepEqual(out.body, { error: 'Salle déjà réservée.', code: 'HALLS_UNAVAILABLE' });
    });

    test('PublicError sans statut : statut du repli s\'il en donne un', async () => {
        const { PublicError, apiFailure } = await load();
        const out = await captured(() => apiFailure('halls', new PublicError('Salle introuvable.'), { ...FALLBACK, status: 404 }));
        assert.equal(out.status, 404);
    });

    for (const [name, err] of [
        ['Error', new Error('relation "halls" SENTINELLE_SECRETE')],
        ['TypeError', new TypeError('fetch failed SENTINELLE_SECRETE')],
        ['erreur PostgREST (objet)', { message: 'duplicate key SENTINELLE_SECRETE', code: '23505', details: 'x', hint: 'y' }],
        ['chaîne', 'SENTINELLE_SECRETE'],
    ] as ReadonlyArray<[string, unknown]>) {
        test(`repli : ${name} donne le message du repli, 500, et le détail part au journal seulement`, async () => {
            const { apiFailure } = await load();
            const out = await captured(() => apiFailure('halls', err, FALLBACK));
            assert.equal(out.status, 500);
            assert.deepEqual(out.body, { error: FALLBACK.message, code: FALLBACK.code }, 'liste blanche : tout ce qui n\'est pas PublicError donne le repli, jamais le texte');
            assert.match(out.logged, /SENTINELLE_SECRETE/, 'le détail doit partir au journal');
        });
    }

    test('repli : statut du repli conservé', async () => {
        const { apiFailure } = await load();
        const out = await captured(() => apiFailure('halls', new Error('x'), { ...FALLBACK, status: 503 }));
        assert.equal(out.status, 503);
    });
});
