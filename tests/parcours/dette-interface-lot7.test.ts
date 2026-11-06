/**
 * Lot 7 — 7.0 f : restes d'interface du lot 6 (contrat §4.6, décisions D61, D63 à D72 ; écrivain « Interface », W4).
 *
 * Suite surtout STATIQUE : elle lit les sources par l'arbre syntaxique de TypeScript (commentaires exclus), sans
 * exécuter l'interface. Deux groupes touchent la base locale : le type notification_channel_enum (catalogue
 * Postgres) et la route PATCH /api/partner/profile (appelée dans le processus, partenaire neuf par cas, clé de
 * session d'un vrai compte). Les règles générales du système de design (couleurs, tailles, libellés liés…) sont
 * appliquées par tests/parcours/design-systeme.test.ts aux fichiers de tests/helpers/design-files.ts : cette suite
 * ne les répète pas, elle fige ce que §4.6 exige en plus. Les contrôles à 390 px (cloche ouverte, texte du bouton
 * sur une ligne, hauteur ≤ 44 px) sont en e2e (§11.2).
 *
 * Comparaisons de textes : espaces (insécables compris) repliés, apostrophe typographique ramenée à « ' »,
 * entités &apos; &#39; &rsquo; décodées.
 *
 * Rouge avant correctif (fix(7.0f), E1 ; type supprimé par M3.7, A2 ; documentation par l'agent Docs) :
 *  - LoginForm ne connaît ni reset=success, ni session_expired, ni unauthorized_controller, ni already_configured,
 *    app/login/page.tsx ne lit pas « reset », le lien « Créer un compte client » perd ?redirect= (D61) ;
 *  - components/layout/AppLayoutHeader.tsx existe encore ;
 *  - ImageUpload rend son titre en <label htmlFor={inputId}> (zone cliquable pleine largeur) ;
 *  - le bouton « Tout marquer comme lu » de la cloche est dans le conteneur du titre et du bouton Fermer, sans
 *    whitespace-nowrap ;
 *  - la page Campagnes envoie sendNow: true, affiche « diffusée avec succès », « (§121-§126) », « livrés » et
 *    le statut brut ;
 *  - TransferExplainerModal importe framer-motion, est écrit à la main en « fixed inset-0 » et promet une
 *    « signature cryptographique » au PDF ;
 *  - app/controller/setup/page.tsx lit l'URL par useSearchParams sous Suspense ;
 *  - public.notification_channel_enum existe encore ;
 *  - docs/architecture.md cite notification.service.ts et use-notifications.ts ;
 *  - PATCH /api/partner/profile recopie le corps sans validation (phone « abc » et logo_url « javascript:x »
 *    enregistrés, latitude « abc » renvoie le message de Postgres, une activité hors liste efface toutes les
 *    activités).
 * Verts dès l'écriture (couverture ajoutée, garde-fous) : aucun corps de fonction ne cite
 * notification_channel_enum ; aucun fichier n'importe AppLayoutHeader ; témoin d'un PATCH valide accepté.
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import type { NextRequest } from 'next/server';
import { inspect } from '../helpers/db';
import { bearer } from '../helpers/fixtures';
import { assertTerrainInvariants } from '../helpers/terrain-invariants';
import { jsonRequest } from './helpers';
import { importModule, service } from './paiement-helpers';
import { newPartner, type TestPartner } from './finance-helpers';

after(async () => {
    await assertTerrainInvariants('dette-interface-lot7');
});

const ROOT = process.cwd();

// ── Lecture des sources (arbre syntaxique, commentaires exclus) ────────────

const printer = ts.createPrinter({ removeComments: true });
const sfCache = new Map<string, ts.SourceFile>();

function absPath(rel: string): string {
    return path.join(ROOT, ...rel.split('/'));
}

function isFile(rel: string): boolean {
    const p = absPath(rel);
    return fs.existsSync(p) && fs.statSync(p).isFile();
}

function requireFile(rel: string): void {
    assert.ok(isFile(rel), `${rel} absent`);
}

function sourceOf(rel: string): ts.SourceFile {
    requireFile(rel);
    let sf = sfCache.get(rel);
    if (!sf) {
        const kind = rel.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
        sf = ts.createSourceFile(rel, fs.readFileSync(absPath(rel), 'utf8'), ts.ScriptTarget.Latest, true, kind);
        sfCache.set(rel, sf);
    }
    return sf;
}

/** Code sans commentaires (réimprimé par le compilateur). */
function codeOf(rel: string): string {
    return printer.printFile(sourceOf(rel));
}

function listFiles(dirRel: string, re: RegExp): string[] {
    const out: string[] = [];
    const visit = (rel: string) => {
        const abs = absPath(rel);
        if (!fs.existsSync(abs)) return;
        for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
            if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
            const child = `${rel}/${e.name}`;
            if (e.isDirectory()) visit(child);
            else if (re.test(e.name)) out.push(child);
        }
    };
    visit(dirRel);
    return out;
}

function lineOf(sf: ts.SourceFile, node: ts.Node): number {
    return sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
}

function norm(s: string): string {
    return s
        .replace(/&apos;|&#39;|&rsquo;/g, "'")
        .replace(/[’‘]/g, "'")
        .replace(/[  ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function walk(node: ts.Node, visit: (n: ts.Node) => void): void {
    visit(node);
    ts.forEachChild(node, (c) => walk(c, visit));
}

function isStringish(n: ts.Node): n is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral {
    return ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n);
}

/** Textes sous un nœud : texte JSX, littéraux et morceaux de gabarits, normalisés, vides exclus. */
function textsUnder(node: ts.Node): string[] {
    const out: string[] = [];
    walk(node, (n) => {
        if (ts.isJsxText(n) || isStringish(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) {
            const p = n.parent;
            if (p && (ts.isImportDeclaration(p) || ts.isExportDeclaration(p))) return;
            const t = norm((n as ts.LiteralLikeNode).text);
            if (t) out.push(t);
        }
    });
    return out;
}

function fileTexts(rel: string): string[] {
    return textsUnder(sourceOf(rel));
}

function containsText(rel: string, expected: string): boolean {
    const e = norm(expected);
    return fileTexts(rel).some((t) => t.includes(e));
}

type JsxTag = ts.JsxOpeningElement | ts.JsxSelfClosingElement;

function tagOf(el: JsxTag): string {
    return el.tagName.getText();
}

function jsxTags(rel: string, name?: string | RegExp): JsxTag[] {
    const out: JsxTag[] = [];
    walk(sourceOf(rel), (n) => {
        if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) {
            const t = tagOf(n);
            if (name === undefined || (typeof name === 'string' ? t === name : name.test(t))) out.push(n);
        }
    });
    return out;
}

function attrOf(el: JsxTag, name: string): ts.JsxAttribute | undefined {
    for (const p of el.attributes.properties) {
        if (ts.isJsxAttribute(p) && p.name.getText() === name) return p;
    }
    return undefined;
}

/** Valeur textuelle d'un attribut (littéral) ou texte de son expression. */
function attrValue(el: JsxTag, name: string): string | null {
    const a = attrOf(el, name);
    if (!a || !a.initializer) return null;
    if (ts.isStringLiteral(a.initializer)) return a.initializer.text;
    if (ts.isJsxExpression(a.initializer) && a.initializer.expression) {
        const e = a.initializer.expression;
        return isStringish(e) ? e.text : e.getText();
    }
    return null;
}

/** Chaînes de classes d'un attribut className (littéraux, gabarits, arguments de cn()). */
function classStrings(el: JsxTag): string[] {
    const a = attrOf(el, 'className');
    if (!a || !a.initializer) return [];
    return textsUnder(a.initializer);
}

/** Élément complet (JsxElement ou auto-fermant) d'une balise ouvrante. */
function elementOf(el: JsxTag): ts.Node {
    return ts.isJsxOpeningElement(el) ? el.parent : el;
}

/** Textes des enfants (hors attributs) d'un élément. */
function childTexts(el: JsxTag): string[] {
    if (ts.isJsxSelfClosingElement(el)) return [];
    const out: string[] = [];
    for (const c of el.parent.children) out.push(...textsUnder(c));
    return out;
}

function isWithin(node: ts.Node, ancestor: ts.Node): boolean {
    for (let n: ts.Node | undefined = node; n; n = n.parent) if (n === ancestor) return true;
    return false;
}

/** Plus petit élément JSX qui contient les deux nœuds. */
function commonJsxAncestor(a: ts.Node, b: ts.Node): ts.Node | null {
    for (let n: ts.Node | undefined = a.parent; n; n = n.parent) {
        if ((ts.isJsxElement(n) || ts.isJsxFragment(n)) && isWithin(b, n)) return n;
    }
    return null;
}

function importsFrom(rel: string, specRe: RegExp): ts.ImportDeclaration[] {
    const out: ts.ImportDeclaration[] = [];
    for (const st of sourceOf(rel).statements) {
        if (ts.isImportDeclaration(st) && ts.isStringLiteral(st.moduleSpecifier) && specRe.test(st.moduleSpecifier.text)) out.push(st);
    }
    return out;
}

function importsName(rel: string, name: string, specRe: RegExp): boolean {
    return importsFrom(rel, specRe).some((st) => {
        const b = st.importClause?.namedBindings;
        const named = b && ts.isNamedImports(b) ? b.elements.some((e) => e.name.text === name) : false;
        return named || st.importClause?.name?.text === name;
    });
}

function identifiersNamed(rel: string, name: string): ts.Identifier[] {
    const out: ts.Identifier[] = [];
    walk(sourceOf(rel), (n) => {
        if (ts.isIdentifier(n) && n.text === name) out.push(n);
    });
    return out;
}

function propName(name: ts.PropertyName): string | null {
    if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name)) return name.text;
    return null;
}

/** Vrai si un nœud contient le littéral `value` (comparaison exacte). */
function hasLiteral(node: ts.Node, value: string): boolean {
    let found = false;
    walk(node, (n) => {
        if (isStringish(n) && n.text === value) found = true;
    });
    return found;
}

function hasTextEqual(node: ts.Node, expected: string): boolean {
    const e = norm(expected);
    return textsUnder(node).includes(e);
}

/**
 * Le message `text` est associé au code `key` dans `rel` : propriété d'objet `key: '<text>'`, ou branche
 * (if, ternaire, case) dont la condition contient le littéral `key` et qui contient le texte.
 */
function pairedInSource(rel: string, key: string, text: string): boolean {
    let ok = false;
    walk(sourceOf(rel), (n) => {
        if (ok) return;
        if (ts.isPropertyAssignment(n) && propName(n.name) === key && hasTextEqual(n.initializer, text)) ok = true;
        else if (ts.isIfStatement(n) && hasLiteral(n.expression, key) && hasTextEqual(n.thenStatement, text)) ok = true;
        else if (ts.isConditionalExpression(n) && hasLiteral(n.condition, key) && hasTextEqual(n.whenTrue, text)) ok = true;
        else if (ts.isCaseClause(n) && hasLiteral(n.expression, key) && n.statements.some((s) => hasTextEqual(s, text))) ok = true;
    });
    return ok;
}

/** Fonction exportée par défaut (déclaration, ou identifiant résolu dans le fichier). */
function defaultExportFunction(rel: string): ts.FunctionLikeDeclaration | null {
    const sf = sourceOf(rel);
    let target: ts.FunctionLikeDeclaration | null = null;
    let exportedName: string | null = null;
    for (const st of sf.statements) {
        if (ts.isFunctionDeclaration(st) && st.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)) target = st;
        if (ts.isExportAssignment(st) && !st.isExportEquals) {
            if (ts.isIdentifier(st.expression)) exportedName = st.expression.text;
            else if (ts.isArrowFunction(st.expression) || ts.isFunctionExpression(st.expression)) target = st.expression;
        }
    }
    if (!target && exportedName) {
        for (const st of sf.statements) {
            if (ts.isFunctionDeclaration(st) && st.name?.text === exportedName) target = st;
            if (ts.isVariableStatement(st)) {
                for (const d of st.declarationList.declarations) {
                    if (ts.isIdentifier(d.name) && d.name.text === exportedName && d.initializer
                        && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer))) target = d.initializer;
                }
            }
        }
    }
    return target;
}

function faultsMessage(title: string, faults: string[]): string {
    return `${title} :\n  - ${faults.join('\n  - ')}`;
}

// ── Fichiers ───────────────────────────────────────────────────────────────

const LOGIN_FORM = 'components/auth/LoginForm.tsx';
const LOGIN_PAGE = 'app/login/page.tsx';
const APP_LAYOUT_HEADER = 'components/layout/AppLayoutHeader.tsx';
const IMAGE_UPLOAD = 'components/ui/ImageUpload.tsx';
const BELL = 'components/notifications/NotificationBell.tsx';
const CAMPAIGNS = 'app/admin/communications/page.tsx';
const TRANSFER_EXPLAINER = 'components/tickets/TransferExplainerModal.tsx';
const CONTROLLER_SETUP = 'app/controller/setup/page.tsx';
const ARCHITECTURE_DOC = 'docs/architecture.md';
const PARTNER_PROFILE_ROUTE = '../../app/api/partner/profile/route';

// ── Connexion : messages de l'URL (§4.6, D61) ─────────────────────────────

describe('7.0 f — connexion : messages de ?reset, ?error et ?message, lien d\'inscription', () => {
    const PAIRS: Array<{ param: string; key: string; text: string }> = [
        { param: 'reset', key: 'success', text: 'Mot de passe modifié : connectez-vous avec le nouveau.' },
        { param: 'error', key: 'session_expired', text: 'Le lien a expiré : demandez un nouveau code.' },
        { param: 'error', key: 'unauthorized_controller', text: 'Accès réservé aux contrôleurs.' },
        { param: 'message', key: 'already_configured', text: 'Ce compte est déjà activé : connectez-vous.' },
    ];
    for (const p of PAIRS) {
        test(`LoginForm : ?${p.param}=${p.key} → « ${p.text} »`, () => {
            assert.ok(
                pairedInSource(LOGIN_FORM, p.key, p.text),
                `${LOGIN_FORM} : aucun message « ${p.text} » associé au code « ${p.key} » (propriété « ${p.key}: '…' » ou branche dont la condition contient '${p.key}')`,
            );
        });
    }

    test('app/login/page.tsx lit searchParams.reset et le transmet à <LoginForm>, qui le reçoit en prop', () => {
        const faults: string[] = [];
        const sf = sourceOf(LOGIN_PAGE);
        let readsReset = false;
        walk(sf, (n) => {
            if (ts.isPropertyAccessExpression(n) && n.name.text === 'reset' && /searchParams/.test(n.expression.getText(sf))) readsReset = true;
            if (ts.isElementAccessExpression(n) && /searchParams/.test(n.expression.getText(sf)) && isStringish(n.argumentExpression) && n.argumentExpression.text === 'reset') readsReset = true;
        });
        if (!readsReset) faults.push(`${LOGIN_PAGE} : searchParams.reset jamais lu`);
        const forms = jsxTags(LOGIN_PAGE, 'LoginForm');
        if (forms.length === 0) faults.push(`${LOGIN_PAGE} : <LoginForm> jamais rendu`);
        const passes = forms.some((el) => el.attributes.properties.some((a) => ts.isJsxAttribute(a) && /reset/i.test(a.name.getText())));
        if (!passes) faults.push(`${LOGIN_PAGE} : aucune prop « reset… » passée à <LoginForm>`);
        const fn = (() => {
            let found: ts.FunctionLikeDeclaration | null = null;
            walk(sourceOf(LOGIN_FORM), (n) => {
                if (ts.isFunctionDeclaration(n) && n.name?.text === 'LoginForm') found = n;
                if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === 'LoginForm' && n.initializer
                    && (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer))) found = n.initializer;
            });
            return found as ts.FunctionLikeDeclaration | null;
        })();
        if (!fn) faults.push(`${LOGIN_FORM} : composant LoginForm introuvable`);
        else {
            const param = fn.parameters[0];
            const names = param && ts.isObjectBindingPattern(param.name)
                ? param.name.elements.map((e) => (e.propertyName ?? e.name).getText())
                : [];
            if (!names.some((n) => /reset/i.test(n))) faults.push(`${LOGIN_FORM} : LoginForm ne reçoit aucune prop « reset… » (props lues : ${names.join(', ') || 'aucune'})`);
        }
        assert.deepEqual(faults, [], faultsMessage('paramètre ?reset=success', faults));
    });

    test('D61 : le lien « Créer un compte » mène à /register?redirect=<destination encodée>', () => {
        const links = jsxTags(LOGIN_FORM).filter((el) => /^(Link|LinkButton|a)$/.test(tagOf(el)) && childTexts(el).some((t) => t.startsWith('Créer un compte')));
        assert.ok(links.length > 0, `${LOGIN_FORM} : aucun lien « Créer un compte »`);
        const faults: string[] = [];
        for (const el of links) {
            const href = attrOf(el, 'href');
            const text = href?.initializer ? href.initializer.getText() : '';
            if (!text.includes('/register?redirect=')) faults.push(`ligne ${lineOf(sourceOf(LOGIN_FORM), el)} : href = ${text || 'absent'} (attendu /register?redirect=…)`);
            else if (!/encodeURIComponent\s*\(|URLSearchParams/.test(text)) faults.push(`ligne ${lineOf(sourceOf(LOGIN_FORM), el)} : la destination n'est pas encodée (${text})`);
        }
        assert.deepEqual(faults, [], faultsMessage(`${LOGIN_FORM} : lien d'inscription`, faults));
    });
});

// ── AppLayoutHeader ────────────────────────────────────────────────────────

describe('7.0 f — AppLayoutHeader supprimé', () => {
    test('components/layout/AppLayoutHeader.tsx n\'existe plus', () => {
        assert.equal(isFile(APP_LAYOUT_HEADER), false, `${APP_LAYOUT_HEADER} existe encore (§4.6 : fichier mort, à supprimer)`);
    });

    test('garde-fou : aucun fichier de app/, components/ ou lib/ n\'importe AppLayoutHeader', () => {
        const files = [...listFiles('app', /\.tsx?$/), ...listFiles('components', /\.tsx?$/), ...listFiles('lib', /\.tsx?$/)]
            .filter((f) => f !== APP_LAYOUT_HEADER);
        const users = files.filter((f) => importsFrom(f, /AppLayoutHeader/).length > 0);
        assert.deepEqual(users, [], `fichiers qui importent AppLayoutHeader : ${users.join(', ')}`);
    });
});

// ── ImageUpload ────────────────────────────────────────────────────────────

describe('7.0 f — ImageUpload : zone cliquable du titre ramenée au bouton', () => {
    test('le titre n\'est plus un <label htmlFor={inputId}> ; élément à id, référencé par aria-labelledby sur le champ fichier', () => {
        const sf = sourceOf(IMAGE_UPLOAD);
        const faults: string[] = [];
        const titles = jsxTags(IMAGE_UPLOAD).filter((el) => ts.isJsxOpeningElement(el)
            && el.parent.children.some((c) => ts.isJsxExpression(c) && c.expression && ts.isIdentifier(c.expression) && c.expression.text === 'label'));
        if (titles.length === 0) faults.push('aucun élément ne rend {label} en enfant (titre du champ introuvable)');
        for (const el of titles) {
            if (tagOf(el) === 'label') faults.push(`ligne ${lineOf(sf, el)} : le titre {label} est encore un <label${attrOf(el, 'htmlFor') ? ' htmlFor' : ''}> (zone cliquable pleine largeur)`);
        }
        const fileInputs = jsxTags(IMAGE_UPLOAD, 'input').filter((el) => attrValue(el, 'type') === 'file');
        if (fileInputs.length !== 1) faults.push(`${fileInputs.length} champ(s) <input type="file"> (1 attendu)`);
        const labelledBy = fileInputs.length === 1 ? attrValue(fileInputs[0], 'aria-labelledby') : null;
        if (!labelledBy) faults.push('<input type="file"> sans aria-labelledby');
        const titleIds = titles.filter((el) => tagOf(el) !== 'label').map((el) => attrValue(el, 'id')).filter((v): v is string => !!v);
        if (titles.some((el) => tagOf(el) !== 'label') && titleIds.length === 0) faults.push('le titre {label} n\'a pas d\'attribut id');
        if (labelledBy && titleIds.length > 0 && !titleIds.some((id) => labelledBy.includes(id))) {
            faults.push(`aria-labelledby = ${labelledBy} ne référence pas l'id du titre (${titleIds.join(', ')})`);
        }
        assert.deepEqual(faults, [], faultsMessage(IMAGE_UPLOAD, faults));
    });
});

// ── Cloche ─────────────────────────────────────────────────────────────────

describe('7.0 f — cloche : « Tout marquer comme lu » sur sa propre ligne (D68)', () => {
    test('bouton en whitespace-nowrap, hors du conteneur du titre « Notifications » et du bouton Fermer', () => {
        const sf = sourceOf(BELL);
        const faults: string[] = [];
        const tags = jsxTags(BELL);
        const markAll = tags.filter((el) => /^(button|Button)$/.test(tagOf(el)) && childTexts(el).some((t) => t === 'Tout marquer comme lu'));
        const title = tags.filter((el) => /^h[1-6]$/.test(tagOf(el)) && childTexts(el).includes('Notifications'));
        const close = tags.filter((el) => attrValue(el, 'aria-label') === 'Fermer les notifications');
        if (markAll.length !== 1) faults.push(`${markAll.length} bouton(s) « Tout marquer comme lu » (1 attendu, libellé gardé : D68)`);
        if (title.length !== 1) faults.push(`${title.length} titre(s) « Notifications » (1 attendu)`);
        if (close.length !== 1) faults.push(`${close.length} bouton(s) « Fermer les notifications » (1 attendu)`);
        if (markAll.length === 1) {
            if (!classStrings(markAll[0]).some((c) => /(^|\s)whitespace-nowrap(\s|$)/.test(c))) {
                faults.push(`ligne ${lineOf(sf, markAll[0])} : bouton sans whitespace-nowrap (classes : ${classStrings(markAll[0]).join(' | ') || 'aucune'})`);
            }
            if (title.length === 1 && close.length === 1) {
                const box = commonJsxAncestor(elementOf(title[0]), elementOf(close[0]));
                if (box && isWithin(markAll[0], box)) {
                    faults.push(`ligne ${lineOf(sf, markAll[0])} : bouton dans le conteneur du titre et du bouton Fermer (ligne ${lineOf(sf, box)}) : à 390 px le libellé passe à la ligne`);
                }
            }
        }
        assert.deepEqual(faults, [], faultsMessage(BELL, faults));
    });
});

// ── Campagnes (D71) ────────────────────────────────────────────────────────

describe('7.0 f — page Campagnes : aucun envoi annoncé (D71)', () => {
    test('sans « diffusée avec succès », sendNow: true, « § », « livrés », statut ni audience bruts ; « Brouillon enregistré : l\'envoi immédiat est désactivé »', () => {
        const sf = sourceOf(CAMPAIGNS);
        const texts = fileTexts(CAMPAIGNS);
        const faults: string[] = [];
        for (const t of texts) {
            if (/diffusée avec succès/i.test(t)) faults.push(`texte « ${t} »`);
            if (t.includes('§')) faults.push(`« § » dans « ${t} »`);
            if (/\blivrés\b/i.test(t)) faults.push(`« livrés » dans « ${t} »`);
        }
        walk(sf, (n) => {
            if (ts.isPropertyAssignment(n) && propName(n.name) === 'sendNow' && n.initializer.kind === ts.SyntaxKind.TrueKeyword) {
                faults.push(`ligne ${lineOf(sf, n)} : sendNow: true envoyé à la route (l'envoi immédiat est désactivé)`);
            }
            if (ts.isJsxExpression(n) && n.expression && ts.isPropertyAccessExpression(n.expression)
                && ['status', 'target_audience'].includes(n.expression.name.text) && n.parent && (ts.isJsxElement(n.parent) || ts.isJsxFragment(n.parent))) {
                faults.push(`ligne ${lineOf(sf, n)} : valeur brute {${n.expression.getText(sf)}} affichée`);
            }
        });
        if (!containsText(CAMPAIGNS, 'Brouillon enregistré : l\'envoi immédiat est désactivé')) {
            faults.push('message « Brouillon enregistré : l\'envoi immédiat est désactivé » absent');
        }
        assert.deepEqual(faults, [], faultsMessage(CAMPAIGNS, faults));
    });
});

// ── Aide au transfert ──────────────────────────────────────────────────────

describe('7.0 f — TransferExplainerModal', () => {
    test('sans « signature cryptographique », framer-motion ni modale écrite à la main en « fixed inset-0 »', () => {
        const faults: string[] = [];
        if (importsFrom(TRANSFER_EXPLAINER, /^framer-motion$/).length > 0) faults.push('import de framer-motion');
        for (const t of fileTexts(TRANSFER_EXPLAINER)) {
            if (/signature cryptographique/i.test(t)) faults.push(`texte faux sur le PDF : « ${t.slice(0, 90)}… »`);
            if (/(^|\s)fixed(\s|$)/.test(t) && /(^|\s)inset-0(\s|$)/.test(t)) faults.push(`classes « ${t} » (modale à la main au lieu de Modal)`);
        }
        assert.deepEqual(faults, [], faultsMessage(TRANSFER_EXPLAINER, faults));
    });

    test('rendue par Modal (components/ui/Modal), FAQ du PDF exacte', () => {
        const faults: string[] = [];
        if (!importsName(TRANSFER_EXPLAINER, 'Modal', /(^@\/components\/ui\/Modal$)|(\/ui\/Modal$)|(^\.\.\/ui\/Modal$)/)) faults.push('Modal non importé de components/ui/Modal');
        if (jsxTags(TRANSFER_EXPLAINER, 'Modal').length === 0) faults.push('<Modal> jamais rendu');
        const faq = 'Le PDF n\'est pas un billet d\'entrée : il ne contient pas de QR. À l\'entrée, ouvrez le billet dans l\'application ; il reste disponible sans réseau si vous l\'avez ouvert avant d\'arriver.';
        if (!containsText(TRANSFER_EXPLAINER, faq)) faults.push(`réponse de la FAQ « ${faq} » absente`);
        assert.deepEqual(faults, [], faultsMessage(TRANSFER_EXPLAINER, faults));
    });
});

// ── Activation du contrôleur ───────────────────────────────────────────────

describe('7.0 f — app/controller/setup/page.tsx', () => {
    test('la page lit searchParams (prop de la page) et n\'appelle plus useSearchParams', () => {
        const faults: string[] = [];
        const uses = identifiersNamed(CONTROLLER_SETUP, 'useSearchParams');
        if (uses.length > 0) faults.push(`useSearchParams cité ${uses.length} fois (lignes ${uses.map((u) => lineOf(sourceOf(CONTROLLER_SETUP), u)).join(', ')})`);
        const page = defaultExportFunction(CONTROLLER_SETUP);
        if (!page) faults.push('aucune fonction exportée par défaut');
        else {
            const param = page.parameters[0];
            if (!param || !/\bsearchParams\b/.test(param.getText())) {
                faults.push(`la page exportée ne reçoit pas searchParams (paramètre : ${param ? param.getText().slice(0, 80) : 'aucun'})`);
            }
        }
        assert.deepEqual(faults, [], faultsMessage(CONTROLLER_SETUP, faults));
    });
});

// ── notification_channel_enum (base locale) ───────────────────────────────

describe('7.0 f — notification_channel_enum supprimé (M3.7)', () => {
    test('to_regtype(\'public.notification_channel_enum\') IS NULL', async () => {
        const reg = await inspect((db) => db.query<{ t: string | null }>(`SELECT to_regtype('public.notification_channel_enum')::text AS t`));
        assert.equal(reg.rows[0].t, null, `le type public.notification_channel_enum existe encore (${reg.rows[0].t})`);
    });

    test('garde-fou : aucun corps de fonction (pg_proc.prosrc) ne cite notification_channel_enum', async () => {
        const res = await inspect((db) => db.query<{ fn: string }>(
            `SELECT n.nspname || '.' || p.proname AS fn
               FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
                AND p.prosrc ILIKE '%notification_channel_enum%'
              ORDER BY 1`));
        assert.deepEqual(res.rows.map((r) => r.fn), [], 'fonctions qui citent encore notification_channel_enum (un DROP TYPE sans CASCADE ne les voit pas)');
    });
});

// ── Documentation ──────────────────────────────────────────────────────────

describe('7.0 f — docs/architecture.md à jour', () => {
    test('ne cite plus notification.service.ts ni hooks/use-notifications.ts', () => {
        requireFile(ARCHITECTURE_DOC);
        const lines = fs.readFileSync(absPath(ARCHITECTURE_DOC), 'utf8').split(/\r?\n/);
        const hits = lines
            .map((l, i) => ({ l, i }))
            .filter(({ l }) => /notification\.service(\.ts)?\b|use-notifications(\.ts)?\b/.test(l))
            .map(({ l, i }) => `ligne ${i + 1} : ${l.trim()}`);
        assert.deepEqual(hits, [], `${ARCHITECTURE_DOC} cite des fichiers supprimés`);
    });
});

// ── PATCH /api/partner/profile (D72, base locale) ─────────────────────────

interface Reply { status: number; body: Record<string, unknown>; text: string }

type Handler = (req: NextRequest) => Promise<Response>;

async function patchProfile(token: string, body: Record<string, unknown>): Promise<Reply> {
    const mod = await importModule(PARTNER_PROFILE_ROUTE);
    const handler = mod.PATCH as Handler | undefined;
    assert.equal(typeof handler, 'function', `${PARTNER_PROFILE_ROUTE} n'exporte pas PATCH`);
    const res = await handler!(jsonRequest('/api/partner/profile', body, bearer(token), 'PATCH'));
    const text = await res.text();
    let parsed: Record<string, unknown>;
    try {
        parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch (err) {
        assert.fail(`réponse non JSON (${res.status}) : ${text.slice(0, 200)} (${err instanceof Error ? err.message : String(err)})`);
    }
    return { status: res.status, body: parsed, text };
}

interface PartnerRow {
    phone: string | null;
    logo_url: string | null;
    latitude: number | null;
    commercial_name: string | null;
    city: string | null;
}

async function partnerRow(partnerId: string): Promise<PartnerRow> {
    const { data, error } = await service.from('partners').select('phone, logo_url, latitude, commercial_name, city').eq('id', partnerId).single();
    assert.equal(error, null, `lecture du partenaire : ${error?.message}`);
    return data as PartnerRow;
}

async function activitiesOf(partnerId: string): Promise<string[]> {
    const { data, error } = await service.from('partner_activities').select('activity_type').eq('partner_id', partnerId).order('activity_type');
    assert.equal(error, null, `lecture des activités : ${error?.message}`);
    return (data ?? []).map((r) => String((r as { activity_type: string }).activity_type));
}

/** Motifs d'un message de Postgres ou de PostgREST (jamais renvoyé au navigateur, D72). */
export const POSTGRES_TEXT_RE = /invalid input|syntax for type|violates|duplicate key|null value in column|double precision|relation "|column "|PGRST|SQLSTATE|\b(22P02|23502|23505|23514|42703)\b/i;

function assertInvalidField(reply: Reply, field: string, what: string): void {
    assert.equal(reply.status, 400, `${what} : statut ${reply.status}, corps ${reply.text.slice(0, 300)} (attendu 400 INVALID_FIELD)`);
    assert.equal(reply.body.code, 'INVALID_FIELD', `${what} : code ${JSON.stringify(reply.body.code)} (attendu INVALID_FIELD)`);
    assert.equal(reply.body.field, field, `${what} : field ${JSON.stringify(reply.body.field)} (attendu « ${field} »)`);
    assert.ok(typeof reply.body.error === 'string' && reply.body.error.trim().length > 0, `${what} : message d'erreur absent`);
    assert.doesNotMatch(reply.text, POSTGRES_TEXT_RE, `${what} : la réponse contient un texte de la base : ${reply.text.slice(0, 300)}`);
}

describe('7.0 f — PATCH /api/partner/profile validé (D72)', () => {
    const freshPartner = (label: string): Promise<TestPartner> => newPartner(`profil-${label}`);

    test('phone « abc » → 400 INVALID_FIELD (phone), numéro inchangé, aucun texte de la base', async () => {
        const p = await freshPartner('tel');
        const before = await partnerRow(p.partnerId);
        assertInvalidField(await patchProfile(p.accessToken, { phone: 'abc' }), 'phone', 'phone « abc »');
        assert.equal((await partnerRow(p.partnerId)).phone, before.phone, 'phone « abc » enregistré malgré le refus');
    });

    test('logo_url « javascript:x » → 400 INVALID_FIELD (logo_url), logo inchangé', async () => {
        const p = await freshPartner('logo');
        const before = await partnerRow(p.partnerId);
        assertInvalidField(await patchProfile(p.accessToken, { logo_url: 'javascript:x' }), 'logo_url', 'logo_url « javascript:x »');
        assert.equal((await partnerRow(p.partnerId)).logo_url, before.logo_url, 'logo_url « javascript:x » enregistré malgré le refus');
    });

    test('latitude « abc » → 400 INVALID_FIELD (latitude), sans le message de Postgres', async () => {
        const p = await freshPartner('lat');
        const before = await partnerRow(p.partnerId);
        assertInvalidField(await patchProfile(p.accessToken, { latitude: 'abc' }), 'latitude', 'latitude « abc »');
        assert.equal((await partnerRow(p.partnerId)).latitude, before.latitude, 'latitude modifiée malgré le refus');
    });

    test('activité hors liste → 400 INVALID_FIELD (activities), activités intactes', async () => {
        const p = await freshPartner('act');
        const before = await activitiesOf(p.partnerId);
        assert.deepEqual(before, ['ORGANISATEUR'], `activités du partenaire neuf : ${before.join(', ')}`);
        assertInvalidField(await patchProfile(p.accessToken, { activities: ['ACTIVITE_INCONNUE'] }), 'activities', 'activité hors liste');
        assert.deepEqual(await activitiesOf(p.partnerId), before, 'les activités ont été supprimées ou changées par une demande refusée');
    });

    test('témoin : PATCH valide (nom commercial, ville, numéro E.164) → 200 et valeurs enregistrées', async () => {
        const p = await freshPartner('ok');
        const name = `Profil valide ${Date.now()}`;
        const reply = await patchProfile(p.accessToken, { commercial_name: name, city: 'Thiès', phone: p.phoneE164 });
        assert.equal(reply.status, 200, `PATCH valide refusé : ${reply.status} ${reply.text.slice(0, 300)}`);
        const row = await partnerRow(p.partnerId);
        assert.equal(row.commercial_name, name, 'nom commercial non enregistré');
        assert.equal(row.city, 'Thiès', 'ville non enregistrée');
        assert.equal(row.phone, p.phoneE164, 'numéro non enregistré');
    });
});
