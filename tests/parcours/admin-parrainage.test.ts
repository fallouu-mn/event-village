/**
 * Lot 8, tâche 8.3 d, anomalie A1 (contrat 13.4, L86 ; CDC §98, §133) — fausse sauvegarde de /admin/referral : le
 * bouton « Enregistrer la personnalisation » affiche « Les taux personnalisés ont bien été enregistrés » sans aucun
 * appel réseau (app/admin/referral/page.tsx:366-372). Taux et durée ne sont écrits nulle part.
 *
 * Suite STATIQUE, sans base : elle lit les sources avec le compilateur TypeScript (arbre syntaxique, commentaires
 * exclus). L'affichage réel est prouvé par la capture de la page (agent E2E).
 *  1. contrôle général sur app/admin/** : aucun toast.success dans un gestionnaire qui n'appelle pas le réseau,
 *     directement ou par une fonction locale du même fichier ;
 *  2. auto-contrôle de ce contrôle sur des extraits (il attrape la fausse sauvegarde, il accepte une vraie) ;
 *  3. /admin/referral : plus de bouton « Taux & Durée », plus de modale de saisie, mention exacte du contrat ;
 *  4. garde-fou : la bascule du statut Ambassadeur, réelle, reste branchée sur PATCH /api/admin/users.
 *
 * Rouge avant correctif (fix(8.3-A1), E3) : le contrôle général (app/admin/referral/page.tsx:369) et les tests du
 * point 3. Verts dès l'écriture (signalés) : l'auto-contrôle, le contrôle de couverture et le garde-fou du point 4.
 * Aucune écriture en base : pas d'appel d'invariants, écart signalé.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const ROOT = process.cwd();
const PAGE = 'app/admin/referral/page.tsx';
const MENTION = 'La personnalisation des taux n’est pas disponible pour le moment.';
/** Textes de la modale factice : aucun ne doit rester à l'écran. */
const FAKE_FORM_TEXTS = [
    'Enregistrer la personnalisation',
    'Les taux personnalisés ont bien été enregistrés',
    'Taux & Durée',
    'Taux N1 Client (%)',
    'Taux N2 Client (%)',
    'Taux N1 Prestataire (%)',
    'Taux N2 Prestataire (%)',
    'Durée de validité (Mois)',
];

// ── Lecture de l'arbre syntaxique ──────────────────────────────────────────

function parse(name: string, text: string): ts.SourceFile {
    return ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

function read(rel: string): string {
    return fs.readFileSync(path.join(ROOT, ...rel.split('/')), 'utf8');
}

function nodesOf(root: ts.Node, keep: (n: ts.Node) => boolean): ts.Node[] {
    const out: ts.Node[] = [];
    const visit = (n: ts.Node): void => {
        if (keep(n)) out.push(n);
        ts.forEachChild(n, visit);
    };
    visit(root);
    return out;
}

function isFunction(n: ts.Node): boolean {
    return ts.isArrowFunction(n) || ts.isFunctionExpression(n) || ts.isFunctionDeclaration(n) || ts.isMethodDeclaration(n);
}

function isToastSuccess(n: ts.Node): boolean {
    return ts.isCallExpression(n)
        && ts.isPropertyAccessExpression(n.expression)
        && n.expression.name.text === 'success'
        && ts.isIdentifier(n.expression.expression)
        && n.expression.expression.text === 'toast';
}

/**
 * Gestionnaire d'un appel : la fonction la plus haute sous le composant. Un `.then(() => toast.success())` reste
 * dans le gestionnaire qui l'englobe ; un appel dans une fonction de niveau fichier a cette fonction pour gestionnaire.
 */
function handlerOf(call: ts.Node): ts.Node | null {
    const chain: ts.Node[] = [];
    for (let n: ts.Node | undefined = call.parent; n; n = n.parent) {
        if (isFunction(n)) chain.unshift(n);
    }
    return chain[1] ?? chain[0] ?? null;
}

/** Fonctions locales du fichier par nom : `function f`, `const f = () => …`, `const f = useCallback(() => …)`. */
function localFunctions(sf: ts.SourceFile): Map<string, ts.Node> {
    const out = new Map<string, ts.Node>();
    for (const n of nodesOf(sf, (x) => ts.isFunctionDeclaration(x) || ts.isVariableDeclaration(x))) {
        if (ts.isFunctionDeclaration(n)) {
            if (n.name) out.set(n.name.text, n);
            continue;
        }
        const decl = n as ts.VariableDeclaration;
        if (!ts.isIdentifier(decl.name) || !decl.initializer) continue;
        const init = decl.initializer;
        if (isFunction(init)) out.set(decl.name.text, init);
        else if (ts.isCallExpression(init) && ts.isIdentifier(init.expression) && init.expression.text === 'useCallback' && init.arguments[0]) {
            out.set(decl.name.text, init.arguments[0]);
        }
    }
    return out;
}

function reachesNetwork(node: ts.Node, fns: Map<string, ts.Node>, seen: Set<ts.Node> = new Set()): boolean {
    if (seen.has(node)) return false;
    seen.add(node);
    let found = false;
    const visit = (n: ts.Node): void => {
        if (found) return;
        if (ts.isCallExpression(n)) {
            const callee = n.expression;
            const name = ts.isIdentifier(callee) ? callee.text : ts.isPropertyAccessExpression(callee) ? callee.name.text : '';
            if (name === 'fetch') {
                found = true;
                return;
            }
            const target = ts.isIdentifier(callee) ? fns.get(callee.text) : undefined;
            if (target && reachesNetwork(target, fns, seen)) {
                found = true;
                return;
            }
        }
        ts.forEachChild(n, visit);
    };
    visit(node);
    return found;
}

/** Lignes des toast.success dont le gestionnaire n'appelle jamais le réseau. */
function falseSuccesses(name: string, text: string): string[] {
    const sf = parse(name, text);
    const fns = localFunctions(sf);
    return nodesOf(sf, isToastSuccess)
        .filter((call) => {
            const handler = handlerOf(call);
            return !handler || !reachesNetwork(handler, fns);
        })
        .map((call) => `${name}:${sf.getLineAndCharacterOfPosition(call.getStart(sf)).line + 1}`);
}

/** Toutes les sources de app/admin, chemins en barres obliques. */
function adminSources(): string[] {
    const out: string[] = [];
    const walk = (rel: string): void => {
        for (const entry of fs.readdirSync(path.join(ROOT, ...rel.split('/')), { withFileTypes: true })) {
            const child = `${rel}/${entry.name}`;
            if (entry.isDirectory()) walk(child);
            else if (/\.tsx?$/.test(entry.name)) out.push(child);
        }
    };
    walk('app/admin');
    return out.sort();
}

/** Espaces repliés (insécables compris), apostrophes et entités ramenées à « ' ». */
function clean(text: string): string {
    return text
        .replace(/&apos;|&#39;|&rsquo;|’/g, '\'')
        .replace(/&amp;/g, '&')
        .replace(/[\s  ]+/g, ' ')
        .trim();
}

/** Textes de la page : JSX et chaînes, gabarits compris, commentaires exclus. */
function visibleTexts(sf: ts.SourceFile): string[] {
    return nodesOf(sf, (n) => ts.isJsxText(n) || ts.isStringLiteralLike(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n))
        .map((n) => clean((n as ts.LiteralLikeNode).text))
        .filter(Boolean);
}

// ── 1. Le contrôle lui-même ────────────────────────────────────────────────

describe('A1 — le contrôle des fausses réussites se vérifie lui-même', () => {
    const component = (body: string): string => `'use client';
        export default function Page() {
            const toast = useToast();
            ${body}
            return null;
        }`;

    const ACCUSED: Array<{ name: string; text: string }> = [
        { name: 'bouton en ligne sans réseau (le cas de /admin/referral)', text: `export default function Page() { const toast = useToast(); return <Button onClick={() => { toast.success('Enregistré'); close(null); }} />; }` },
        { name: 'gestionnaire nommé sans réseau', text: component(`const save = () => { setOpen(false); toast.success('Enregistré'); };`) },
        { name: 'gestionnaire asynchrone sans réseau', text: component(`const save = async () => { await wait(10); toast.success('Enregistré'); };`) },
        { name: 'fonction locale appelée, sans réseau elle non plus', text: component(`const close = () => setOpen(false); const save = () => { close(); toast.success('Enregistré'); };`) },
    ];
    const ACCEPTED: Array<{ name: string; text: string }> = [
        { name: 'fetch dans le gestionnaire', text: component(`const save = async () => { const res = await fetch('/api/x', { method: 'PATCH' }); if (res.ok) toast.success('Enregistré'); };`) },
        { name: 'fetch puis then', text: component(`const save = () => { fetch('/api/x').then(() => toast.success('Enregistré')); };`) },
        { name: 'fetch par une fonction locale', text: component(`const call = async () => fetch('/api/x'); const save = async () => { await call(); toast.success('Enregistré'); };`) },
        { name: 'fetch par useCallback', text: component(`const call = useCallback(async () => { await fetch('/api/x'); }, []); const save = async () => { await call(); toast.success('Enregistré'); };`) },
        { name: 'bouton en ligne qui appelle le réseau', text: `export default function Page() { const toast = useToast(); return <Button onClick={async () => { await fetch('/api/x'); toast.success('Enregistré'); }} />; }` },
    ];

    for (const c of ACCUSED) {
        test(`accuse : ${c.name}`, () => {
            assert.equal(falseSuccesses('demo.tsx', c.text).length, 1, `fausse réussite non détectée : ${c.name}`);
        });
    }
    for (const c of ACCEPTED) {
        test(`n'accuse pas : ${c.name}`, () => {
            assert.deepEqual(falseSuccesses('demo.tsx', c.text), [], `faux positif sur : ${c.name}`);
        });
    }

    test('le contrôle voit les écrans d’administration (contrôle vide impossible)', () => {
        const files = adminSources();
        assert.ok(files.length >= 14, `seulement ${files.length} fichiers sous app/admin`);
        assert.ok(files.includes(PAGE), `${PAGE} n'est pas parcouru`);
        const total = files.reduce((sum, f) => sum + nodesOf(parse(f, read(f)), isToastSuccess).length, 0);
        assert.ok(total >= 10, `seulement ${total} toast.success trouvés : la lecture ne les voit plus`);
    });

    test('aucun écran n’échappe au contrôle par un autre nom : useToast() est toujours rangé dans « toast »', () => {
        const faults: string[] = [];
        for (const f of adminSources()) {
            const sf = parse(f, read(f));
            for (const n of nodesOf(sf, (x) => ts.isVariableDeclaration(x) && Boolean(x.initializer) && ts.isCallExpression(x.initializer!) && x.initializer!.expression.getText(sf) === 'useToast')) {
                const name = (n as ts.VariableDeclaration).name;
                if (!ts.isIdentifier(name) || name.text !== 'toast') faults.push(`${f} : ${name.getText(sf)}`);
            }
        }
        assert.deepEqual(faults, [], `useToast sous un autre nom :\n${faults.join('\n')}`);
    });
});

// ── 2. Le dépôt ────────────────────────────────────────────────────────────

describe('A1 — aucune réussite annoncée sans appel réseau dans app/admin', () => {
    test('chaque toast.success de app/admin/** a un appel réseau dans son gestionnaire', () => {
        const faults = adminSources().flatMap((f) => falseSuccesses(f, read(f)));
        assert.deepEqual(faults, [], `réussite annoncée sans aucun appel réseau :\n${faults.join('\n')}`);
    });
});

describe('A1 — /admin/referral : fausse sauvegarde retirée (contrat 13.4)', () => {
    const sf = parse(PAGE, read(PAGE));
    const texts = visibleTexts(sf);

    test('aucun texte de la modale factice ne reste à l’écran', () => {
        const left = FAKE_FORM_TEXTS.filter((t) => texts.some((x) => x.includes(clean(t))));
        assert.deepEqual(left, [], `textes de la fausse personnalisation encore présents dans ${PAGE} : ${left.join(' ; ')}`);
    });

    test('plus aucun champ non contrôlé : la modale de saisie est retirée', () => {
        const fields = nodesOf(sf, (n) => ts.isJsxAttribute(n) && n.name.getText(sf) === 'defaultValue')
            .map((n) => `ligne ${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}`);
        assert.deepEqual(fields, [], `champs defaultValue (saisies écrites nulle part) encore présents : ${fields.join(', ')}`);
    });

    test('la mention exacte du contrat est affichée', () => {
        assert.ok(texts.some((x) => x.includes(clean(MENTION))), `mention absente de ${PAGE} : « ${MENTION} »`);
    });

    test('garde-fou : la bascule du statut Ambassadeur reste un vrai PATCH /api/admin/users', () => {
        const fn = localFunctions(sf).get('handleToggleAmbassador');
        assert.ok(fn, 'handleToggleAmbassador introuvable');
        const fetches = nodesOf(fn, (n) => ts.isCallExpression(n) && n.expression.getText(sf) === 'fetch') as ts.CallExpression[];
        assert.equal(fetches.length, 1, 'un seul appel réseau dans la bascule');
        assert.equal((fetches[0].arguments[0] as ts.StringLiteral).text, '/api/admin/users');
        assert.match(fetches[0].arguments[1].getText(sf), /method:\s*'PATCH'/);
        assert.match(fetches[0].arguments[1].getText(sf), /referralStatus/);
    });
});
