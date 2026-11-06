/**
 * Lot 8, tâche 8.2 o (contrat 10.3, D57, L59) — /admin/services affiche « Service désactivé » pour chaque service
 * dont l'interrupteur est fermé. Suite STATIQUE, sans base : elle lit la page avec le compilateur TypeScript
 * (arbre syntaxique, commentaires exclus). L'affichage réel est prouvé par la capture admin-services-desactive
 * (agent E2E, contrat 15.6).
 *  1. la page importe useFeatureFlags de lib/features/client et l'appelle ;
 *  2. chaque onglet de catalogue a sa clé : salles → halls, tables → tables, produits et commandes → orders ;
 *     l'onglet Événements n'en a pas (la billetterie n'a pas d'interrupteur) ;
 *  3. bandeau StatusBanner neutre, titre et texte exacts ;
 *  4. bandeau sous condition de l'interrupteur de l'onglet, et rien tant que les interrupteurs ne sont pas lus
 *     (`flags === null`), pas même par `!flags?.[clé]` ;
 *  5. bandeau en tête du CatalogPanel : présent dans chaque retour du panneau (chargement, erreur, liste) ;
 *  6. garde-fou : onglets, libellés et types demandés à /api/admin/services inchangés.
 *
 * Rouge avant correctif (fix(8.2o)) : 1 à 5, app/admin/services/page.tsx ne lit aucun interrupteur.
 * Vert dès l'écriture (garde-fou, signalé) : 6. Aucune écriture en base : pas d'appel d'invariants, écart signalé.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const PAGE = 'app/admin/services/page.tsx';
const EXPECTED_FLAGS: Record<string, string> = { salles: 'halls', tables: 'tables', produits: 'orders', commandes: 'orders' };
const BANNER_TITLE = 'Service désactivé';
const BANNER_TEXT = 'Ce service est fermé par son interrupteur : il est masqué au public. Les données restent consultables ici.';

const source = ts.createSourceFile(PAGE, fs.readFileSync(path.join(process.cwd(), ...PAGE.split('/')), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

// ── Lecture de l'arbre syntaxique ──────────────────────────────────────────

function nodesOf(root: ts.Node, keep: (n: ts.Node) => boolean): ts.Node[] {
    const out: ts.Node[] = [];
    const visit = (n: ts.Node): void => {
        if (keep(n)) out.push(n);
        ts.forEachChild(n, visit);
    };
    visit(root);
    return out;
}

/** Espaces repliés (insécables compris), apostrophe typographique ramenée à « ' ». */
function clean(text: string): string {
    return text.replace(/[\s  ]+/g, ' ').replace(/’/g, '\'').trim();
}

function stringValue(n: ts.Expression | undefined): string | null {
    return n && ts.isStringLiteralLike(n) ? n.text : null;
}

/** Tableau de chaînes déclaré par `const name = [...]` (`as const` compris). */
function stringArray(name: string): string[] | null {
    const [decl] = nodesOf(source, (n) => ts.isVariableDeclaration(n) && n.name.getText(source) === name) as ts.VariableDeclaration[];
    let init = decl?.initializer;
    if (init && ts.isAsExpression(init)) init = init.expression;
    if (!init || !ts.isArrayLiteralExpression(init)) return null;
    return init.elements.map((e) => stringValue(e) ?? `(expression ${e.getText(source)})`);
}

/** Objets littéraux déclarés `const name = { clé: 'valeur', … }`, à valeurs toutes textuelles. */
function stringMaps(): Array<{ name: string; map: Record<string, string> }> {
    const out: Array<{ name: string; map: Record<string, string> }> = [];
    for (const n of nodesOf(source, ts.isVariableDeclaration) as ts.VariableDeclaration[]) {
        if (!n.initializer || !ts.isObjectLiteralExpression(n.initializer)) continue;
        const map: Record<string, string> = {};
        const plain = n.initializer.properties.every((p) => {
            if (!ts.isPropertyAssignment(p)) return false;
            const value = stringValue(p.initializer);
            if (value === null) return false;
            map[p.name.getText(source).replace(/^['"]|['"]$/g, '')] = value;
            return true;
        });
        if (plain) out.push({ name: n.name.getText(source), map });
    }
    return out;
}

/** Correspondance onglet → interrupteur du contrat 10.3 (API_TYPE, qui rend `products`, ne convient pas). */
function flagMap(): { name: string; map: Record<string, string> } {
    const maps = stringMaps().filter((m) => JSON.stringify(Object.entries(m.map).sort()) === JSON.stringify(Object.entries(EXPECTED_FLAGS).sort()));
    assert.equal(maps.length, 1, `${PAGE} : une correspondance onglet → interrupteur attendue, ${JSON.stringify(EXPECTED_FLAGS)} (trouvées : ${JSON.stringify(maps)})`);
    return maps[0];
}

/** Noms des variables qui reçoivent useFeatureFlags(). */
function flagVariables(): string[] {
    return (nodesOf(source, ts.isVariableDeclaration) as ts.VariableDeclaration[])
        .filter((d) => d.initializer && ts.isCallExpression(d.initializer) && d.initializer.expression.getText(source) === 'useFeatureFlags')
        .map((d) => d.name.getText(source));
}

type JsxTag = ts.JsxSelfClosingElement | ts.JsxOpeningElement;

function attr(tag: JsxTag, name: string): string | null {
    const a = tag.attributes.properties.find((p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && p.name.getText(source) === name);
    if (!a?.initializer) return null;
    if (ts.isStringLiteral(a.initializer)) return a.initializer.text;
    return ts.isJsxExpression(a.initializer) ? stringValue(a.initializer.expression) : null;
}

function banners(): JsxTag[] {
    return (nodesOf(source, (n) => ts.isJsxSelfClosingElement(n) || ts.isJsxOpeningElement(n)) as JsxTag[])
        .filter((t) => t.tagName.getText(source) === 'StatusBanner' && attr(t, 'title') !== null && clean(attr(t, 'title') as string) === BANNER_TITLE);
}

function theBanner(): JsxTag {
    const found = banners();
    assert.equal(found.length, 1, `${PAGE} : un StatusBanner de titre « ${BANNER_TITLE} » attendu (trouvés : ${found.length})`);
    return found[0];
}

function isFunctionLike(n: ts.Node): n is ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression {
    return ts.isFunctionDeclaration(n) || ts.isArrowFunction(n) || ts.isFunctionExpression(n);
}

/** Composant nommé qui contient le nœud : fonction déclarée ou fonction fléchée affectée à une constante. */
function ownerOf(node: ts.Node): { name: string; fn: ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression } | null {
    for (let n: ts.Node | undefined = node.parent; n; n = n.parent) {
        if (!isFunctionLike(n)) continue;
        if (ts.isFunctionDeclaration(n) && n.name) return { name: n.name.text, fn: n };
        if (ts.isVariableDeclaration(n.parent)) return { name: n.parent.name.getText(source), fn: n };
    }
    return null;
}

/** Fonction du composant nommé, déclaration ou constante. */
function componentNamed(name: string): ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression {
    const found = nodesOf(source, (n) => (ts.isFunctionDeclaration(n) && n.name?.text === name)
        || (ts.isVariableDeclaration(n) && n.name.getText(source) === name && !!n.initializer && isFunctionLike(n.initializer)));
    assert.equal(found.length, 1, `${PAGE} : composant ${name} introuvable`);
    const n = found[0];
    return (ts.isVariableDeclaration(n) ? n.initializer : n) as ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression;
}

/** Le bandeau dépend d'une condition : JSX conditionnel, ou `if` qui précède son retour dans le composant. */
function isConditional(tag: JsxTag): boolean {
    const owner = ownerOf(tag);
    for (let n: ts.Node | undefined = tag.parent; n && n !== owner?.fn; n = n.parent) {
        if (ts.isConditionalExpression(n) || ts.isIfStatement(n)) return true;
        if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) return true;
    }
    const body = owner?.fn.body;
    if (!body || !ts.isBlock(body)) return false;
    return body.statements.some((s) => ts.isIfStatement(s) && s.end <= tag.pos);
}

/** Retours propres au composant, sans ceux des fonctions imbriquées. */
function ownReturns(fn: ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression): ts.ReturnStatement[] {
    const out: ts.ReturnStatement[] = [];
    const visit = (n: ts.Node): void => {
        if (isFunctionLike(n)) return;
        if (ts.isReturnStatement(n)) out.push(n);
        ts.forEachChild(n, visit);
    };
    ts.forEachChild(fn.body as ts.Node, visit);
    return out;
}

// ── Contrôles ──────────────────────────────────────────────────────────────

describe('8.2 o — /admin/services : mention « Service désactivé » (contrat 10.3, D57)', () => {
    test('la page importe useFeatureFlags de lib/features/client et l’appelle', () => {
        const imported = (source.statements.filter(ts.isImportDeclaration)).some((st) => /lib\/features\/client$/.test((st.moduleSpecifier as ts.StringLiteral).text)
            && !!st.importClause?.namedBindings && ts.isNamedImports(st.importClause.namedBindings)
            && st.importClause.namedBindings.elements.some((el) => (el.propertyName ?? el.name).text === 'useFeatureFlags'));
        assert.ok(imported, `${PAGE} : useFeatureFlags non importé de lib/features/client`);
        assert.equal(flagVariables().length, 1, `${PAGE} : un seul appel de useFeatureFlags() affecté à une variable attendu (trouvés : ${JSON.stringify(flagVariables())})`);
    });

    test('chaque onglet de catalogue a sa clé : salles → halls, tables → tables, produits et commandes → orders ; Événements n’en a aucune', () => {
        const tabs = stringArray('TAB_IDS');
        assert.ok(tabs, `${PAGE} : TAB_IDS introuvable`);
        const { map } = flagMap();
        assert.deepEqual(Object.keys(map).sort(), tabs.filter((t) => t !== 'evenements').sort(), 'chaque onglet de catalogue, et lui seul, a sa clé');
        assert.ok(!('evenements' in map), 'l’onglet Événements n’a pas d’interrupteur');
    });

    test(`bandeau neutre, titre « ${BANNER_TITLE} », texte du contrat`, () => {
        const tag = theBanner();
        assert.equal(attr(tag, 'tone'), 'neutral', `${PAGE} : ton du bandeau`);
        assert.ok(ts.isJsxOpeningElement(tag), `${PAGE} : bandeau sans texte`);
        const text = (tag.parent as ts.JsxElement).children
            .map((c) => (ts.isJsxText(c) ? c.text : ts.isJsxExpression(c) ? (stringValue(c.expression) ?? '') : '')).join(' ');
        assert.equal(clean(text), BANNER_TEXT, `${PAGE} : texte du bandeau`);
    });

    test('bandeau sous condition de l’interrupteur de l’onglet ; rien tant que les interrupteurs ne sont pas lus (flags === null)', () => {
        const tag = theBanner();
        assert.ok(isConditional(tag), `${PAGE} : bandeau affiché sans condition`);
        const { name: mapName } = flagMap();
        const uses = nodesOf(source, (n) => ts.isIdentifier(n) && n.text === mapName && !ts.isVariableDeclaration(n.parent));
        assert.ok(uses.length > 0, `${PAGE} : correspondance ${mapName} jamais lue`);

        const [flags] = flagVariables();
        assert.ok(flags, `${PAGE} : useFeatureFlags() non affecté à une variable`);
        const reads = nodesOf(source, (n) => ts.isElementAccessExpression(n) && n.expression.getText(source) === flags) as ts.ElementAccessExpression[];
        assert.ok(reads.length > 0, `${PAGE} : aucune lecture ${flags}[clé]`);
        // `!flags?.[clé]` vaut vrai quand flags est null : la mention s'afficherait avant toute lecture.
        const unsafe = reads.filter((r) => r.questionDotToken && !(ts.isBinaryExpression(r.parent)
            && r.parent.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken && r.parent.right.kind === ts.SyntaxKind.FalseKeyword));
        assert.deepEqual(unsafe.map((r) => r.parent.getText(source)), [], `${PAGE} : lecture qui afficherait la mention quand ${flags} est null (seul « ${flags}?.[clé] === false » est sûr)`);
    });

    test('bandeau en tête du CatalogPanel : présent dans chaque retour du panneau (chargement, erreur, liste)', () => {
        const tag = theBanner();
        const owner = ownerOf(tag);
        assert.ok(owner, `${PAGE} : bandeau hors de tout composant`);
        const panel = componentNamed('CatalogPanel');
        const returns = ownReturns(panel);
        assert.ok(returns.length > 0, `${PAGE} : CatalogPanel sans retour`);
        if (owner.name === 'CatalogPanel') {
            // Écrit directement, ou porté par une constante du panneau rendue dans chaque retour.
            const holder = ((): string | null => {
                for (let n: ts.Node | undefined = tag.parent; n && n !== owner.fn; n = n.parent) {
                    if (ts.isVariableDeclaration(n)) return n.name.getText(source);
                }
                return null;
            })();
            const missing = returns.filter((r) => !r.getText(source).includes('StatusBanner') && !(holder && new RegExp(`\\b${holder}\\b`).test(r.getText(source))));
            assert.deepEqual(missing.map((r) => clean(r.getText(source)).slice(0, 80)), [], `${PAGE} : retour de CatalogPanel sans la mention`);
        } else {
            const missing = returns.filter((r) => !new RegExp(`<${owner.name}\\b`).test(r.getText(source)));
            assert.deepEqual(missing.map((r) => clean(r.getText(source)).slice(0, 80)), [], `${PAGE} : retour de CatalogPanel sans <${owner.name}>`);
        }
    });

    test('garde-fou : onglets, libellés et types demandés à /api/admin/services inchangés', () => {
        assert.deepEqual(stringArray('TAB_IDS'), ['evenements', 'salles', 'tables', 'produits', 'commandes'], 'onglets de la page');
        const labels = (nodesOf(source, (n) => ts.isVariableDeclaration(n) && n.name.getText(source) === 'TABS') as ts.VariableDeclaration[])
            .flatMap((d) => nodesOf(d, ts.isObjectLiteralExpression) as ts.ObjectLiteralExpression[])
            .map((o) => o.properties.filter(ts.isPropertyAssignment).find((p) => p.name.getText(source) === 'label'))
            .map((p) => stringValue(p?.initializer));
        assert.deepEqual(labels, ['Événements', 'Salles de fête', 'Restaurants et tables', 'Produits et traiteurs', 'Commandes'], 'libellés des onglets (TabItem n’a qu’un libellé, la mention est un bandeau)');
        const api = stringMaps().find((m) => m.name === 'API_TYPE');
        assert.deepEqual(api?.map, { salles: 'halls', tables: 'tables', produits: 'products', commandes: 'orders' }, 'contrat de GET /api/admin/services inchangé (L59)');
    });
});
