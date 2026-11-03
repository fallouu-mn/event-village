/**
 * Lot 6 — interface (contrat A5, A6, A7, F4 « client » et « détachement », H4, B5 et amendement 2, L4, N3, Q ;
 * S2 groupe « Interface »). Suite STATIQUE : elle lit les sources avec fs et le compilateur TypeScript (arbre
 * syntaxique, commentaires exclus), sans exécuter l'interface ; les captures relèvent de la tâche 6.12. Les
 * règles du système de design (couleurs, tailles, emoji, libellés liés…) sont appliquées par
 * tests/parcours/design-systeme.test.ts aux fichiers de tests/helpers/design-files.ts, où ce lot ajoute les
 * fichiers de Q : cette suite ne les répète pas, elle fige ce que Q, A5 à A7, H4, L4 et N3 exigent en plus.
 *
 * Par tâche :
 *  - 6.0 e (A5) : app/login/page.tsx composant serveur (ni « use client », ni useSearchParams, ni Suspense) qui
 *    lit searchParams et rend components/auth/LoginForm.tsx ; libellés figés « Email ou téléphone » et
 *    « Mot de passe » liés à leur champ, bouton « Se connecter » ; logique conservée (verrou client, 429
 *    serveur, résolution du téléphone, OTP type « email », SUSPENDU, refreshSession, resolvePostLoginRoute) ;
 *    PageHeader, StatusBanner, œil en IconButton focalisable, bascule « Mot de passe » / « Code SMS » en
 *    aria-pressed, plus de « F5 / Rechargement bloqué », animations en motion-safe: seulement ; titres
 *    « Créer un compte », « Mot de passe oublié », « Nouveau mot de passe » ; OtpInput accessible ;
 *  - 6.0 f (A6) : data-ev-caption sur Badge et StatusBadge ; bouton de fermeture de la bulle Leaflet à 44 px
 *    par un sélecteur plus spécifique que leaflet.css ;
 *  - 6.0 g (A7) : ScrollableTabs déplacé dans components/ui (indices w-8, scroll-padding), utilisé par la
 *    file admin ; boutons de mode du scanner sur une ligne ; Skeleton et les 7 loading.tsx sur les tokens ;
 *    LoadingSkeleton supprimé s'il n'a aucun import ;
 *  - 6.2 (F4) : requestPermission seulement dans lib/push/client.ts, enablePush appelée seulement depuis un
 *    gestionnaire onClick ; detachPushSubscription avant chaque déconnexion côté navigateur ;
 *  - 6.4 (H4) : page « Préférences de notification », Switch partagé, PushDeviceCard (5 états), liens ;
 *  - 6.7 (B5, amendement 2) : onglet « Reçus » de Mes billets, IncomingTransfers, PhoneVerifyDialog,
 *    TransferModal vers un numéro seulement, page /tickets/claim/[token] qui redirige ;
 *  - 6.8 (L4, C6) : entrée « Notifications » du menu admin, filtres kind=in.(…) des abonnements à
 *    admin_signals, pages liste et détail, « Relancer » rendu sous condition FAILED, domaine « notification »
 *    de StatusBadge ;
 *  - 6.10 (N3) : cloche (onglet « Non lues » chargé par le serveur, libellés par notificationTypeMeta, lien
 *    interne seulement, pied « Préférences »), page /notifications paginée par le serveur.
 *
 * Comparaisons de textes : espaces repliés, apostrophe typographique (’) ramenée à « ' ».
 *
 * Rouge avant correctif (chaque cas nomme le fichier ou le motif en cause) : app/login/page.tsx est un
 * composant client sous Suspense (useSearchParams) et LoginForm.tsx n'existe pas ; les pages d'authentification
 * n'ont ni PageHeader ni IconButton (tabIndex={-1}) ; OtpInput sans aria-label ; Badge et StatusBadge sans
 * data-ev-caption ; globals.css garde le sélecteur que leaflet.css écrase ; ScrollableTabs est dans
 * components/partner/pilotage, la file admin utilise Tabs ; les boutons du scanner n'ont pas whitespace-nowrap ;
 * Skeleton et 5 loading.tsx sur l'ancienne palette ; LoadingSkeleton sans import ; lib/push/client.ts,
 * Switch, PushDeviceCard, la page de préférences, IncomingTransfers, PhoneVerifyDialog et les pages
 * admin Notifications sont absents ; aucune déconnexion n'appelle detachPushSubscription ; aucun abonnement à
 * admin_signals n'est filtré par kind ; le menu admin n'a pas d'entrée Notifications ; la cloche filtre la
 * liste dans le navigateur (TYPE_ICONS, metadata.actionUrl suivi tel quel) ; la page /notifications lit
 * ?limit=50 sans pagination ; TransferModal propose l'email et affiche un lien de réclamation ; la page de
 * réclamation lit le jeton dans le navigateur.
 * Garde-fou vert dès l'écriture : la liste blanche contient les fichiers de Q (ajoutés par ce même commit).
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { MIGRATED_DESIGN_FILES } from '../helpers/design-files';
import { assertNotificationInvariants } from './notif-helpers';

after(async () => {
    await assertNotificationInvariants('notif-interface');
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

function readText(rel: string): string {
    return fs.readFileSync(absPath(rel), 'utf8');
}

function requireFile(rel: string, why: string): void {
    assert.ok(isFile(rel), `${rel} absent (${why})`);
}

function sourceOf(rel: string): ts.SourceFile {
    let sf = sfCache.get(rel);
    if (!sf) {
        const kind = rel.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
        sf = ts.createSourceFile(rel, readText(rel), ts.ScriptTarget.Latest, true, kind);
        sfCache.set(rel, sf);
    }
    return sf;
}

/** Code du fichier sans commentaire (réimprimé par le compilateur ; textes et accents conservés). */
function codeOf(rel: string): string {
    return printer.printFile(sourceOf(rel));
}

function listFiles(dirRel: string, re: RegExp): string[] {
    const out: string[] = [];
    const walk = (d: string): void => {
        if (!fs.existsSync(absPath(d))) return;
        for (const entry of fs.readdirSync(absPath(d), { withFileTypes: true })) {
            const child = `${d}/${entry.name}`;
            if (entry.isDirectory()) {
                if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
                walk(child);
            } else if (entry.isFile() && re.test(entry.name)) out.push(child);
        }
    };
    walk(dirRel);
    return out.sort();
}

/** Sources de l'application lues par les contrôles transverses (routes API comprises sauf mention). */
function appSources(opts: { withApi?: boolean; withLib?: boolean } = {}): string[] {
    const dirs = ['app', 'components', 'hooks', ...(opts.withLib ? ['lib'] : [])];
    return dirs.flatMap((d) => listFiles(d, /\.(?:tsx?|jsx?|mjs)$/))
        .filter((f) => opts.withApi || !f.startsWith('app/api/'));
}

function lineOf(sf: ts.SourceFile, node: ts.Node): number {
    return sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
}

function norm(s: string): string {
    return s.replace(/’/g, "'").replace(/\s+/g, ' ').trim();
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

function hasText(rel: string, expected: string): boolean {
    const e = norm(expected);
    return fileTexts(rel).includes(e);
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
    for (const p of el.attributes.properties) if (ts.isJsxAttribute(p) && p.name.getText() === name) return p;
    return undefined;
}

/** Textes portés par la valeur d'un attribut (littéral, ou littéraux d'une expression : ternaire, gabarit…). */
function attrTexts(el: JsxTag, name: string): string[] {
    const a = attrOf(el, name);
    if (!a?.initializer) return [];
    if (ts.isStringLiteral(a.initializer)) return [norm(a.initializer.text)];
    return textsUnder(a.initializer);
}

function attrExprText(el: JsxTag, name: string): string | null {
    const a = attrOf(el, name);
    if (!a?.initializer) return null;
    if (ts.isStringLiteral(a.initializer)) return JSON.stringify(a.initializer.text);
    if (ts.isJsxExpression(a.initializer)) return a.initializer.expression ? a.initializer.expression.getText() : null;
    return a.initializer.getText();
}

/** Élément JSX complet (ouvrant + enfants) d'une balise ouvrante, ou la balise auto-fermante elle-même. */
function elementOf(el: JsxTag): ts.Node {
    return ts.isJsxOpeningElement(el) ? el.parent : el;
}

/** Textes des enfants d'un élément (hors attributs de la balise ouvrante). */
function childTexts(el: JsxTag): string[] {
    if (ts.isJsxSelfClosingElement(el)) return attrTexts(el, 'children');
    return el.parent.children.flatMap((c) => textsUnder(c));
}

function hasUseClient(rel: string): boolean {
    const first = sourceOf(rel).statements[0];
    return !!first && ts.isExpressionStatement(first) && isStringish(first.expression) && first.expression.text === 'use client';
}

interface ImportBinding { local: string; imported: string; spec: string }

function importsOf(rel: string): ImportBinding[] {
    const out: ImportBinding[] = [];
    for (const st of sourceOf(rel).statements) {
        if (!ts.isImportDeclaration(st) || !ts.isStringLiteral(st.moduleSpecifier) || !st.importClause) continue;
        const spec = st.moduleSpecifier.text;
        const clause = st.importClause;
        if (clause.name) out.push({ local: clause.name.text, imported: 'default', spec });
        const nb = clause.namedBindings;
        if (nb && ts.isNamedImports(nb)) {
            for (const el of nb.elements) out.push({ local: el.name.text, imported: (el.propertyName ?? el.name).text, spec });
        }
    }
    return out;
}

function importsName(rel: string, name: string, specRe: RegExp): boolean {
    return importsOf(rel).some((b) => b.imported === name && specRe.test(b.spec));
}

/** Appels dont la fonction appelée est `name` (identifiant) ou `….name` (propriété). */
function callsTo(rel: string, name: string): ts.CallExpression[] {
    const out: ts.CallExpression[] = [];
    walk(sourceOf(rel), (n) => {
        if (!ts.isCallExpression(n)) return;
        const e = n.expression;
        if ((ts.isIdentifier(e) && e.text === name) || (ts.isPropertyAccessExpression(e) && e.name.text === name)) out.push(n);
    });
    return out;
}

function enclosingFunction(node: ts.Node): ts.FunctionLikeDeclaration | null {
    let cur: ts.Node | undefined = node.parent;
    while (cur) {
        if (ts.isFunctionDeclaration(cur) || ts.isFunctionExpression(cur) || ts.isArrowFunction(cur) || ts.isMethodDeclaration(cur)) return cur;
        cur = cur.parent;
    }
    return null;
}

/** Propriété `name` d'un objet littéral, valeur chaîne (littéral, ou constante chaîne du même fichier). */
function propString(sf: ts.SourceFile, obj: ts.ObjectLiteralExpression, name: string): string | null {
    for (const p of obj.properties) {
        if (!ts.isPropertyAssignment(p) || p.name.getText(sf).replace(/['"]/g, '') !== name) continue;
        const v = p.initializer;
        if (isStringish(v)) return v.text;
        if (ts.isIdentifier(v)) return constString(sf, v.text);
        return null;
    }
    return null;
}

function hasProp(obj: ts.ObjectLiteralExpression, name: string): boolean {
    return obj.properties.some((p) => (ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)) && p.name.getText().replace(/['"]/g, '') === name);
}

function constString(sf: ts.SourceFile, name: string): string | null {
    let found: string | null = null;
    walk(sf, (n) => {
        if (found === null && ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === name && n.initializer) {
            let init: ts.Expression = n.initializer;
            while (ts.isAsExpression(init) || ts.isParenthesizedExpression(init)) init = init.expression;
            if (isStringish(init)) found = init.text;
        }
    });
    return found;
}

function objectLiterals(rel: string, pred: (o: ts.ObjectLiteralExpression) => boolean): ts.ObjectLiteralExpression[] {
    const out: ts.ObjectLiteralExpression[] = [];
    walk(sourceOf(rel), (n) => {
        if (ts.isObjectLiteralExpression(n) && pred(n)) out.push(n);
    });
    return out;
}

/** Jetons de classe d'un littéral (séparés par des espaces). */
function classTokens(rel: string): string[] {
    const out: string[] = [];
    walk(sourceOf(rel), (n) => {
        if (isStringish(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) {
            const p = n.parent;
            if (p && (ts.isImportDeclaration(p) || ts.isExportDeclaration(p))) return;
            out.push(...(n as ts.LiteralLikeNode).text.split(/\s+/).filter(Boolean));
        }
    });
    return out;
}

/** Animation Tailwind (animate-*) sans la variante motion-safe: (MASTER : prefers-reduced-motion respecté). */
function unsafeAnimations(rel: string): string[] {
    return classTokens(rel).filter((tok) => {
        const parts = tok.replace(/^!/, '').split(':');
        const util = parts[parts.length - 1].replace(/^!/, '');
        if (!/^animate-[a-z]/.test(util) || util === 'animate-none') return false;
        return !parts.slice(0, -1).includes('motion-safe');
    });
}

const RAW_PALETTE_RE = new RegExp(
    '(?<![\\w-])(?:[\\w-]+:)*!?(?:bg|text|border(?:-[xytrblse])?|divide|ring|from|via|to)-'
    + '(?:(?:slate|zinc|gray|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|[1-9]00|950)|white|black)'
    + '(?:\\/\\d+)?(?![\\w-])',
);

function rawColors(rel: string): string[] {
    return classTokens(rel).filter((tok) => RAW_PALETTE_RE.test(tok));
}

/** Le champ de libellé `text` est-il lié : <label htmlFor=X> + élément id=X, ou Field/TextInput/Textarea/Select label=… ? */
function hasLinkedField(rel: string, text: string): boolean {
    const expected = norm(text);
    const viaComponent = jsxTags(rel, /^(?:Field|TextInput|Textarea|Select)$/).some((el) => attrTexts(el, 'label').includes(expected));
    if (viaComponent) return true;
    const ids = new Set(jsxTags(rel).map((el) => attrExprText(el, 'id')).filter((x): x is string => x !== null));
    // Premier texte du libellé = le libellé exact (un astérisque ou « (obligatoire) » peuvent suivre).
    return jsxTags(rel, 'label').some((el) => {
        const target = attrExprText(el, 'htmlFor');
        return target !== null && ids.has(target) && childTexts(el)[0] === expected;
    });
}

/** Un élément qui porte aria-pressed et dont le texte des enfants est exactement `text`. */
function hasPressedToggle(rel: string, text: string): boolean {
    return jsxTags(rel).some((el) => attrOf(el, 'aria-pressed') !== undefined && childTexts(el).includes(norm(text)));
}

function pageHeaderTitles(rel: string): string[] {
    return jsxTags(rel, 'PageHeader').flatMap((el) => attrTexts(el, 'title'));
}

function tabIndexMinusOne(rel: string): number[] {
    const sf = sourceOf(rel);
    return jsxTags(rel).filter((el) => {
        const v = attrExprText(el, 'tabIndex');
        return v !== null && /^-\s*1$/.test(v.replace(/["']/g, ''));
    }).map((el) => lineOf(sf, el));
}

/** Le nœud est-il rendu sous une condition (&&, ternaire) dont le texte satisfait `re` ? */
function renderedUnder(node: ts.Node, re: RegExp): boolean {
    let cur: ts.Node = node;
    while (cur.parent) {
        const p: ts.Node = cur.parent;
        if (ts.isBinaryExpression(p) && p.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken && p.right === cur && re.test(p.left.getText())) return true;
        if (ts.isConditionalExpression(p) && p.whenTrue === cur && re.test(p.condition.getText())) return true;
        if (ts.isConditionalExpression(p) && p.whenFalse === cur && re.test(p.condition.getText()) && /!==|!\s*\(/.test(p.condition.getText())) return true;
        cur = p;
    }
    return false;
}

function within<T>(label: string, items: T[]): string {
    return `${label} : ${items.length === 0 ? 'aucun' : items.join(', ')}`;
}

// ── Fichiers du contrat Q ──────────────────────────────────────────────────

const LOGIN_PAGE = 'app/login/page.tsx';
const LOGIN_FORM = 'components/auth/LoginForm.tsx';
const REGISTER_PAGE = 'app/register/page.tsx';
const FORGOT_PAGE = 'app/forgot-password/page.tsx';
const RESET_PAGE = 'app/reset-password/page.tsx';
const OTP_INPUT = 'components/auth/OtpInput.tsx';
const STRENGTH = 'components/auth/PasswordStrengthChecklist.tsx';
const UI_SCROLLABLE_TABS = 'components/ui/ScrollableTabs.tsx';
const OLD_SCROLLABLE_TABS = 'components/partner/pilotage/ScrollableTabs.tsx';
const ADMIN_EVENTS = 'app/admin/events/page.tsx';
const ADMIN_DASHBOARD = 'app/admin/dashboard/page.tsx';
const SCANNER = 'app/controller/scanner/page.tsx';
const SKELETON = 'components/ui/Skeleton.tsx';
const LOADING_SKELETON = 'components/ui/LoadingSkeleton.tsx';
const LOADING_FILES = [
    'app/events/[id]/loading.tsx',
    'app/orders/loading.tsx',
    'app/partner/dashboard/loading.tsx',
    'app/profile/loading.tsx',
    'app/wallet/loading.tsx',
    'app/explore/loading.tsx',
    'app/tickets/loading.tsx',
];
const BADGE = 'components/ui/Badge.tsx';
const STATUS_BADGE = 'components/ui/StatusBadge.tsx';
const SWITCH = 'components/ui/Switch.tsx';
const PUSH_CARD = 'components/notifications/PushDeviceCard.tsx';
const PREFS_PAGE = 'app/profile/notifications/page.tsx';
const PROFILE_PAGE = 'app/profile/page.tsx';
const BELL = 'components/notifications/NotificationBell.tsx';
const NOTIFS_PAGE = 'app/notifications/page.tsx';
const ADMIN_NOTIFS = 'app/admin/notifications/page.tsx';
const ADMIN_NOTIF_DETAIL = 'app/admin/notifications/[id]/page.tsx';
const TICKETS_PAGE = 'app/tickets/page.tsx';
const INCOMING = 'components/tickets/IncomingTransfers.tsx';
const PHONE_VERIFY = 'components/tickets/PhoneVerifyDialog.tsx';
const TRANSFER_MODAL = 'components/tickets/TransferModal.tsx';
const CLAIM_PAGE = 'app/tickets/claim/[token]/page.tsx';
const APP_LAYOUT = 'components/layout/AppLayout.tsx';
const FINANCE_SETTINGS_PAGE = 'app/admin/finance-settings/page.tsx';
const SW_REGISTER = 'components/pwa/ServiceWorkerRegister.tsx';
const PUSH_CLIENT = 'lib/push/client.ts';
const OUTBOX_LABELS = 'lib/notifications/outbox-labels.ts';
const AUTH_PROVIDER = 'components/providers/AuthProvider.tsx';
const CONTROLLER_LAYOUT = 'app/controller/layout.tsx';

/** Contrat Q, 6.0 et 6.2 à 6.10 : fichiers créés ou touchés, tous dans MIGRATED_DESIGN_FILES. */
const Q_FILES = [
    LOGIN_PAGE, LOGIN_FORM, REGISTER_PAGE, FORGOT_PAGE, RESET_PAGE, OTP_INPUT, STRENGTH, UI_SCROLLABLE_TABS, ADMIN_EVENTS,
    SCANNER, SKELETON, ...LOADING_FILES, BADGE, STATUS_BADGE,
    SWITCH, PUSH_CARD, PREFS_PAGE, PROFILE_PAGE, BELL, NOTIFS_PAGE, ADMIN_NOTIFS, ADMIN_NOTIF_DETAIL, TICKETS_PAGE, INCOMING,
    PHONE_VERIFY, TRANSFER_MODAL, CLAIM_PAGE, APP_LAYOUT, FINANCE_SETTINGS_PAGE, SW_REGISTER,
];

describe('Q — liste blanche du système de design (tests/helpers/design-files.ts)', () => {
    test('garde-fou : chaque fichier créé ou touché par l\'interface du lot 6 figure dans MIGRATED_DESIGN_FILES', () => {
        const listed = new Set(MIGRATED_DESIGN_FILES);
        const missing = Q_FILES.filter((f) => !listed.has(f));
        assert.deepEqual(missing, [], `fichiers de Q hors de MIGRATED_DESIGN_FILES : ${missing.join(', ')}`);
    });
});

// ── 6.0 e — connexion, inscription, mot de passe oublié, réinitialisation (A5) ──

describe('6.0 e — connexion : composant serveur et formulaire client (A5)', () => {
    test('app/login/page.tsx : composant serveur (ni « use client », ni useSearchParams, ni Suspense) qui lit searchParams et rend LoginForm', () => {
        requireFile(LOGIN_PAGE, 'page de connexion');
        const code = codeOf(LOGIN_PAGE);
        const faults: string[] = [];
        if (hasUseClient(LOGIN_PAGE)) faults.push('directive « use client » (la page doit être un composant serveur)');
        if (/\buseSearchParams\b/.test(code)) faults.push('useSearchParams (rendu intermédiaire sans formulaire, course de e2e/auth.setup.ts:16-17)');
        if (/\bSuspense\b/.test(code)) faults.push('Suspense (repli sans formulaire)');
        if (!/\bsearchParams\b/.test(code)) faults.push('searchParams de la page jamais lu (error, message, redirect)');
        if (!importsName(LOGIN_PAGE, 'LoginForm', /^@\/components\/auth\/LoginForm$|\/components\/auth\/LoginForm$/)) faults.push('LoginForm non importé de @/components/auth/LoginForm');
        if (jsxTags(LOGIN_PAGE, 'LoginForm').length === 0) faults.push('<LoginForm> jamais rendu');
        assert.deepEqual(faults, [], `${LOGIN_PAGE} :\n  ${faults.join('\n  ')}`);
    });

    test('LoginForm : libellés figés « Email ou téléphone » et « Mot de passe » liés à leur champ, bouton « Se connecter »', () => {
        requireFile(LOGIN_FORM, 'contrat A5 : formulaire client de la connexion');
        const faults: string[] = [];
        if (!hasUseClient(LOGIN_FORM)) faults.push('pas de directive « use client »');
        if (!hasLinkedField(LOGIN_FORM, 'Email ou téléphone')) faults.push('champ « Email ou téléphone » sans libellé lié (exact)');
        if (!hasLinkedField(LOGIN_FORM, 'Mot de passe')) faults.push('champ « Mot de passe » sans libellé lié (exact)');
        const submit = jsxTags(LOGIN_FORM, /^(?:Button|button)$/).filter((el) => attrTexts(el, 'type').includes('submit') && childTexts(el).includes('Se connecter'));
        if (submit.length === 0) faults.push('aucun bouton submit au texte exact « Se connecter »');
        assert.deepEqual(faults, [], `${LOGIN_FORM} :\n  ${faults.join('\n  ')}`);
    });

    test('LoginForm : logique conservée (verrou client et 429 serveur, téléphone → email, OTP type « email », SUSPENDU, refreshSession, resolvePostLoginRoute)', () => {
        requireFile(LOGIN_FORM, 'contrat A5 : formulaire client de la connexion');
        const code = codeOf(LOGIN_FORM);
        const both = `${code}\n${isFile(LOGIN_PAGE) ? codeOf(LOGIN_PAGE) : ''}`;
        const expected: Array<[string, boolean]> = [
            ['MAX_FAILED_ATTEMPTS = 5', /\bMAX_FAILED_ATTEMPTS\s*=\s*5\b/.test(code)],
            ['LOCKOUT_DURATION_SECONDS = 60', /\bLOCKOUT_DURATION_SECONDS\s*=\s*60\b/.test(code)],
            ['clé ev_login_lockout_until', /["'`]ev_login_lockout_until["'`]/.test(code)],
            ['clé ev_login_failed_attempts', /["'`]ev_login_failed_attempts["'`]/.test(code)],
            ['429 serveur lu (remainingSeconds)', /\bremainingSeconds\b/.test(code)],
            ['résolution du téléphone (/api/auth/resolve-phone)', /\/api\/auth\/resolve-phone/.test(code)],
            ['signInWithPassword', /\.signInWithPassword\(/.test(code)],
            ['OTP : /api/auth/send-otp et /api/auth/verify-otp', /\/api\/auth\/send-otp/.test(code) && /\/api\/auth\/verify-otp/.test(code)],
            ['verifyOtp avec type « email »', /\.verifyOtp\(\s*\{[^}]*type:\s*["']email["']/.test(code)],
            ['contrôle du compte SUSPENDU puis signOut', /["']SUSPENDU["']/.test(code) && /\.signOut\(/.test(code)],
            ['refreshSession', /\.refreshSession\(/.test(code)],
            ['resolvePostLoginRoute', /\bresolvePostLoginRoute\(/.test(code)],
            ['message=account_activated (page ou formulaire)', /account_activated/.test(both)],
        ];
        const missing = expected.filter(([, ok]) => !ok).map(([what]) => what);
        assert.deepEqual(missing, [], `${LOGIN_FORM} : logique absente :\n  ${missing.join('\n  ')}`);
    });

    test('connexion sur le système de design : PageHeader « Connexion », StatusBanner, œil en IconButton focalisable, bascule aria-pressed, aucun « F5 », animations en motion-safe:', () => {
        requireFile(LOGIN_FORM, 'contrat A5 : formulaire client de la connexion');
        const files = [LOGIN_PAGE, LOGIN_FORM].filter(isFile);
        const faults: string[] = [];
        if (!files.some((f) => pageHeaderTitles(f).includes('Connexion'))) faults.push('aucun PageHeader de titre « Connexion »');
        if (!files.some((f) => jsxTags(f, 'StatusBanner').length > 0)) faults.push('aucun StatusBanner (erreur, succès, verrou)');
        const eye = jsxTags(LOGIN_FORM, 'IconButton').filter((el) => {
            const labels = attrTexts(el, 'aria-label');
            return labels.includes('Afficher le mot de passe') && labels.includes('Masquer le mot de passe');
        });
        if (eye.length === 0) faults.push('bouton œil : aucun IconButton aria-label « Afficher le mot de passe » / « Masquer le mot de passe »');
        if (!hasPressedToggle(LOGIN_FORM, 'Mot de passe') || !hasPressedToggle(LOGIN_FORM, 'Code SMS')) {
            faults.push('bascule de mode : deux boutons aria-pressed « Mot de passe » et « Code SMS » attendus');
        }
        for (const f of files) {
            const tab = tabIndexMinusOne(f);
            if (tab.length > 0) faults.push(`${f} : tabIndex={-1} (ligne ${tab.join(', ')}) : le bouton œil doit rester focalisable`);
            if (fileTexts(f).some((t) => /\bF5\b|Rechargement bloqué/i.test(t))) faults.push(`${f} : texte « F5 / Rechargement bloqué »`);
            const anim = unsafeAnimations(f);
            if (anim.length > 0) faults.push(`${f} : animations hors motion-safe: (${anim.join(', ')})`);
        }
        assert.deepEqual(faults, [], faults.join('\n'));
    });
});

describe('6.0 e — inscription, mot de passe oublié, réinitialisation, OtpInput (A5)', () => {
    const PAGES: Array<{ file: string; title: string; keep: Array<[string, RegExp]> }> = [
        { file: REGISTER_PAGE, title: 'Créer un compte', keep: [['/api/auth/register', /\/api\/auth\/register/], ['email technique @eventvillage.sn', /@eventvillage\.sn/]] },
        {
            file: FORGOT_PAGE,
            title: 'Mot de passe oublié',
            keep: [
                ["send-otp purpose 'PASSWORD_RESET'", /["']PASSWORD_RESET["']/],
                ["verifyOtp type 'magiclink'", /type:\s*["']magiclink["']/],
                ['drapeaux ev_recovery_verified / ev_recovery_ts', /ev_recovery_verified[^]*ev_recovery_ts|ev_recovery_ts[^]*ev_recovery_verified/],
                ['clés ev_recovery_lockout_until / ev_recovery_failed_attempts', /ev_recovery_lockout_until[^]*ev_recovery_failed_attempts|ev_recovery_failed_attempts[^]*ev_recovery_lockout_until/],
            ],
        },
        { file: RESET_PAGE, title: 'Nouveau mot de passe', keep: [['drapeau ev_recovery_verified', /ev_recovery_verified/]] },
    ];
    for (const page of PAGES) {
        test(`${page.file} : PageHeader « ${page.title} » (un seul <h1>), œil focalisable, animations en motion-safe:, logique conservée`, () => {
            requireFile(page.file, 'contrat A5');
            const code = codeOf(page.file);
            const faults: string[] = [];
            if (!pageHeaderTitles(page.file).includes(page.title)) faults.push(`aucun PageHeader de titre « ${page.title} »`);
            if (jsxTags(page.file, 'h1').length > 0) faults.push('<h1> écrit à la main (PageHeader porte le seul <h1>)');
            const tab = tabIndexMinusOne(page.file);
            if (tab.length > 0) faults.push(`tabIndex={-1} (ligne ${tab.join(', ')})`);
            const anim = unsafeAnimations(page.file);
            if (anim.length > 0) faults.push(`animations hors motion-safe: (${anim.join(', ')})`);
            if (fileTexts(page.file).some((t) => /\bF5\b|Rechargement bloqué/i.test(t))) faults.push('texte « F5 / Rechargement bloqué »');
            for (const [what, re] of page.keep) if (!re.test(code)) faults.push(`logique perdue : ${what}`);
            assert.deepEqual(faults, [], `${page.file} :\n  ${faults.join('\n  ')}`);
        });
    }

    test('OtpInput : 6 champs numériques nommés « Chiffre N sur 6 », one-time-code, 44 px, collage d\'un code complet, anneau ring', () => {
        requireFile(OTP_INPUT, 'contrat A5');
        const code = codeOf(OTP_INPUT);
        const tokens = classTokens(OTP_INPUT);
        const expected: Array<[string, boolean]> = [
            ['inputMode="numeric"', jsxTags(OTP_INPUT, 'input').some((el) => attrTexts(el, 'inputMode').includes('numeric'))],
            ['aria-label « Chiffre N sur 6 »', /Chiffre \$\{[^}]+\} sur (?:6|\$\{[^}]+\})/.test(code) || /["']Chiffre ["']\s*\+/.test(code)],
            ['autoComplete="one-time-code"', /one-time-code/.test(code)],
            ['collage par onPaste (clipboardData)', jsxTags(OTP_INPUT, 'input').some((el) => attrOf(el, 'onPaste') !== undefined) && /clipboardData/.test(code)],
            ['largeur de 44 px (w-11 ou min-w-11), plus de w-10', tokens.some((t) => /(?:^|:)(?:min-)?w-11$/.test(t)) && !tokens.some((t) => /(?:^|:)w-10$/.test(t))],
            ['anneau de focus ring', tokens.some((t) => /(?:^|:)ring(?:-|$)/.test(t))],
        ];
        const missing = expected.filter(([, ok]) => !ok).map(([what]) => what);
        assert.deepEqual(missing, [], `${OTP_INPUT} :\n  ${missing.join('\n  ')}`);
    });
});

// ── 6.0 f — avertissements des captures (A6) ───────────────────────────────

describe('6.0 f — textes admis et bulle Leaflet (A6)', () => {
    test('Badge et StatusBadge posent data-ev-caption (texte de 12 px admis par le contrôle des captures)', () => {
        const missing = [BADGE, STATUS_BADGE].filter((f) => !isFile(f) || jsxTags(f).every((el) => attrOf(el, 'data-ev-caption') === undefined));
        assert.deepEqual(missing, [], `sans attribut data-ev-caption : ${missing.join(', ')}`);
    });

    test('app/globals.css : bouton de fermeture de la bulle Leaflet à 44 × 44 px par un sélecteur plus spécifique que leaflet.css:527-535', () => {
        const css = readText('app/globals.css').replace(/\/\*[^]*?\*\//g, '');
        const rules = Array.from(css.matchAll(/([^{}]+)\{([^{}]*)\}/g));
        const rule = rules.find(([, sel]) => sel.split(',').some((s) => norm(s) === '.leaflet-container .leaflet-popup a.leaflet-popup-close-button'));
        assert.ok(rule, 'aucune règle « .leaflet-container .leaflet-popup a.leaflet-popup-close-button » : le sélecteur actuel (.leaflet-container a.leaflet-popup-close-button) est le même que celui de leaflet.css, chargé après, qui impose 24 × 24 px');
        const body = rule[2];
        assert.ok(/(?:^|;)\s*width\s*:\s*44px/.test(body) && /(?:^|;)\s*height\s*:\s*44px/.test(body), `règle sans width: 44px et height: 44px : ${norm(body)}`);
    });
});

// ── 6.0 g — onglets défilants, scanner, chargement (A7) ─────────────────────

describe('6.0 g — détails du lot 5 (A7)', () => {
    test('ScrollableTabs déplacé dans components/ui (ancien fichier supprimé, imports mis à jour), indices w-8 et scroll-padding', () => {
        const faults: string[] = [];
        if (!isFile(UI_SCROLLABLE_TABS)) faults.push(`${UI_SCROLLABLE_TABS} absent`);
        else {
            if (!/export\s+(?:function|const)\s+ScrollableTabs\b/.test(codeOf(UI_SCROLLABLE_TABS))) faults.push(`${UI_SCROLLABLE_TABS} n'exporte pas ScrollableTabs`);
            const tokens = classTokens(UI_SCROLLABLE_TABS);
            if (tokens.some((t) => /(?:^|:)w-12$/.test(t))) faults.push('indices encore en w-12 (ils recouvrent l\'onglet voisin)');
            if (!tokens.some((t) => /(?:^|:)w-8$/.test(t))) faults.push('indices sans w-8');
            const code = codeOf(UI_SCROLLABLE_TABS);
            if (!tokens.some((t) => /(?:^|:)scroll-p[xse]-/.test(t)) && !/scrollPaddingInline|scroll-padding-inline/.test(code)) faults.push('conteneur sans scroll-padding-inline (scroll-px-…)');
        }
        if (isFile(OLD_SCROLLABLE_TABS)) faults.push(`${OLD_SCROLLABLE_TABS} existe encore (contrat A7 : déplacé, ancien fichier supprimé)`);
        const oldImports = appSources().filter((f) => /\.tsx?$/.test(f) && importsOf(f).some((b) => /components\/partner\/pilotage\/ScrollableTabs$|\.\/ScrollableTabs$/.test(b.spec) && !f.startsWith('components/ui/')));
        if (oldImports.length > 0) faults.push(within('import de l\'ancien chemin', oldImports));
        for (const f of ['app/partner/events/page.tsx', 'app/partner/events/[id]/page.tsx']) {
            if (!importsName(f, 'ScrollableTabs', /^@\/components\/ui\/ScrollableTabs$/)) faults.push(`${f} n'importe pas ScrollableTabs de @/components/ui/ScrollableTabs`);
        }
        assert.deepEqual(faults, [], faults.join('\n'));
    });

    test('file admin (app/admin/events/page.tsx) : onglets de statut en ScrollableTabs (8 onglets, indice de débordement)', () => {
        const faults: string[] = [];
        if (!importsName(ADMIN_EVENTS, 'ScrollableTabs', /^@\/components\/ui\/ScrollableTabs$/)) faults.push('ScrollableTabs non importé de @/components/ui/ScrollableTabs');
        if (jsxTags(ADMIN_EVENTS, 'ScrollableTabs').length === 0) faults.push('<ScrollableTabs> jamais rendu');
        const rawTabs = jsxTags(ADMIN_EVENTS, 'Tabs').map((el) => lineOf(sourceOf(ADMIN_EVENTS), el));
        if (rawTabs.length > 0) faults.push(`<Tabs> brut encore rendu (ligne ${rawTabs.join(', ')})`);
        assert.deepEqual(faults, [], `${ADMIN_EVENTS} :\n  ${faults.join('\n  ')}`);
    });

    test('scanner : boutons « Caméra » / « Saisie manuelle » sur une ligne à 390 px (px-4 gap-2 text-sm whitespace-nowrap, hauteur de 48 px gardée)', () => {
        const group = jsxTags(SCANNER).find((el) => attrTexts(el, 'role').includes('group') && attrTexts(el, 'aria-label').includes('Mode de contrôle'));
        assert.ok(group, `${SCANNER} : groupe role="group" aria-label="Mode de contrôle" introuvable`);
        const buttons: JsxTag[] = [];
        walk(elementOf(group), (n) => {
            if ((ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) && /^(?:Button|button)$/.test(tagOf(n)) && attrOf(n, 'aria-pressed')) buttons.push(n);
        });
        assert.equal(buttons.length, 2, `${SCANNER} : ${buttons.length} bouton(s) aria-pressed dans le groupe « Mode de contrôle » (2 attendus)`);
        assert.ok(buttons.some((b) => childTexts(b).includes('Saisie manuelle')), `${SCANNER} : aucun bouton « Saisie manuelle » dans le groupe`);
        const faults: string[] = [];
        for (const b of buttons) {
            const cls = attrTexts(b, 'className').join(' ').split(/\s+/);
            const label = childTexts(b).join(' ') || '(sans texte)';
            const missing = ['whitespace-nowrap', 'px-4', 'gap-2', 'text-sm'].filter((c) => !cls.includes(c));
            const tall = cls.includes('min-h-12') || attrTexts(b, 'size').includes('lg');
            if (!tall) missing.push('min-h-12 (ou size="lg")');
            if (missing.length > 0) faults.push(`« ${label} » sans ${missing.join(', ')}`);
        }
        assert.deepEqual(faults, [], `${SCANNER} :\n  ${faults.join('\n  ')}`);
    });

    test('components/ui/Skeleton.tsx sur les tokens : bg-surface-sunken, cartes bg-surface border-border, motion-safe:animate-pulse, aucune palette brute', () => {
        const faults: string[] = [];
        const tokens = classTokens(SKELETON);
        const raw = rawColors(SKELETON);
        if (raw.length > 0) faults.push(`palette brute : ${Array.from(new Set(raw)).join(', ')}`);
        const anim = unsafeAnimations(SKELETON);
        if (anim.length > 0) faults.push(`animations hors motion-safe: (${Array.from(new Set(anim)).join(', ')})`);
        if (!tokens.includes('bg-surface-sunken')) faults.push('Skeleton sans bg-surface-sunken');
        if (!tokens.includes('bg-surface') || !tokens.includes('border-border')) faults.push('cartes sans bg-surface et border-border');
        if (!tokens.includes('motion-safe:animate-pulse')) faults.push('aucun motion-safe:animate-pulse');
        assert.deepEqual(faults, [], `${SKELETON} :\n  ${faults.join('\n  ')}`);
    });

    test('les 7 fichiers loading.tsx sur la nouvelle palette (aucune couleur brute, animations en motion-safe:)', () => {
        const faults: string[] = [];
        for (const f of LOADING_FILES) {
            if (!isFile(f)) {
                faults.push(`${f} absent`);
                continue;
            }
            const raw = rawColors(f);
            if (raw.length > 0) faults.push(`${f} : palette brute (${Array.from(new Set(raw)).join(', ')})`);
            const anim = unsafeAnimations(f);
            if (anim.length > 0) faults.push(`${f} : animations hors motion-safe: (${anim.join(', ')})`);
        }
        assert.deepEqual(faults, [], faults.join('\n'));
    });

    test('components/ui/LoadingSkeleton.tsx : supprimé s\'il n\'a aucun import, sinon migré et listé', () => {
        const exists = isFile(LOADING_SKELETON);
        const users = exists
            ? appSources().filter((f) => f !== LOADING_SKELETON && /\.tsx?$/.test(f) && importsOf(f).some((b) => /(?:^|\/)LoadingSkeleton$/.test(b.spec)))
            : [];
        const verdict = !exists ? 'supprimé'
            : users.length === 0 ? `existe sans aucun import dans app/, components/ ni hooks/ (contrat A7 : à supprimer)`
                : MIGRATED_DESIGN_FILES.includes(LOADING_SKELETON) ? 'importé, migré et listé'
                    : `importé par ${users.join(', ')} mais absent de MIGRATED_DESIGN_FILES (à migrer)`;
        assert.ok(verdict === 'supprimé' || verdict === 'importé, migré et listé', `${LOADING_SKELETON} ${verdict}`);
    });
});

// ── 6.2 — push côté navigateur (F4 « Client » et « Détachement à la déconnexion ») ──

/** Fonctions reconnues comme gestionnaires de clic : valeur d'un attribut onClick, ou fonction nommée passée à onClick. */
function clickHandlerNames(rel: string): Set<string> {
    const names = new Set<string>();
    for (const el of jsxTags(rel)) {
        const a = attrOf(el, 'onClick');
        const e = a?.initializer && ts.isJsxExpression(a.initializer) ? a.initializer.expression : undefined;
        if (!e) continue;
        if (ts.isIdentifier(e)) names.add(e.text);
        if (ts.isArrowFunction(e) || ts.isFunctionExpression(e)) {
            walk(e.body, (n) => {
                if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) names.add(n.expression.text);
            });
        }
    }
    return names;
}

function functionName(fn: ts.FunctionLikeDeclaration): string | null {
    if (ts.isFunctionDeclaration(fn) && fn.name) return fn.name.text;
    let p: ts.Node | undefined = fn.parent;
    // const f = useCallback(async () => …, [])
    if (p && ts.isCallExpression(p) && ts.isIdentifier(p.expression) && p.expression.text === 'useCallback') p = p.parent;
    if (p && ts.isVariableDeclaration(p) && ts.isIdentifier(p.name)) return p.name.text;
    return null;
}

function isOnClickValue(fn: ts.Node): boolean {
    const p = fn.parent;
    return !!p && ts.isJsxExpression(p) && !!p.parent && ts.isJsxAttribute(p.parent) && p.parent.name.getText() === 'onClick';
}

/** Appels de `name` qui ne sont pas dans un gestionnaire de clic (ligne). */
function callsOutsideClick(rel: string, name: string): number[] {
    const handlers = clickHandlerNames(rel);
    const sf = sourceOf(rel);
    return callsTo(rel, name).filter((call) => {
        let fn = enclosingFunction(call);
        while (fn) {
            if (isOnClickValue(fn)) return false;
            const n = functionName(fn);
            if (n && handlers.has(n)) return false;
            fn = enclosingFunction(fn);
        }
        return true;
    }).map((call) => lineOf(sf, call));
}

describe('6.2 — autorisation des notifications après un geste seulement, détachement à la déconnexion (F4)', () => {
    test('Notification.requestPermission n\'apparaît que dans lib/push/client.ts (enablePush), nulle part ailleurs dans app/, components/, hooks/, lib/, public/', () => {
        requireFile(PUSH_CLIENT, 'contrat F4 : client push du navigateur');
        const clientCode = codeOf(PUSH_CLIENT);
        assert.ok(/\bNotification\.requestPermission\(/.test(clientCode), `${PUSH_CLIENT} : Notification.requestPermission() absent`);
        assert.ok(/export\s+(?:async\s+)?function\s+enablePush\b|export\s+const\s+enablePush\b/.test(clientCode), `${PUSH_CLIENT} : enablePush non exportée`);
        for (const fn of ['currentPushState', 'disablePush', 'detachPushSubscription']) {
            assert.ok(new RegExp(`export\\s+(?:async\\s+)?function\\s+${fn}\\b|export\\s+const\\s+${fn}\\b`).test(clientCode), `${PUSH_CLIENT} : ${fn} non exportée`);
        }
        // Sources TypeScript : arbre syntaxique sans commentaires ; JavaScript (public/sw.js…) : commentaires retirés.
        const withoutComments = (f: string): string => (/\.tsx?$/.test(f) ? codeOf(f) : readText(f).replace(/\/\*[^]*?\*\/|\/\/[^\n]*/g, ''));
        const others = [...appSources({ withApi: true, withLib: true }), ...listFiles('public', /\.(?:js|mjs)$/)]
            .filter((f) => f !== PUSH_CLIENT)
            .filter((f) => /requestPermission/.test(withoutComments(f)));
        assert.deepEqual(others, [], `requestPermission hors de ${PUSH_CLIENT} : ${others.join(', ')}`);
    });

    test('enablePush n\'est appelée que depuis un gestionnaire onClick (jamais au chargement), et PushDeviceCard l\'appelle', () => {
        requireFile(PUSH_CARD, 'contrat H4 : état du push sur cet appareil');
        const callers = appSources().filter((f) => /\.tsx?$/.test(f) && callsTo(f, 'enablePush').length > 0);
        assert.ok(callers.includes(PUSH_CARD), `${PUSH_CARD} n'appelle pas enablePush (bouton « Activer les notifications »)`);
        const outside = callers.flatMap((f) => callsOutsideClick(f, 'enablePush').map((l) => `${f}:${l}`));
        assert.deepEqual(outside, [], `enablePush appelée hors d'un gestionnaire onClick : ${outside.join(', ')}`);
    });

    test('detachPushSubscription() avant chaque supabase.auth.signOut() du navigateur (AuthProvider, contrôleur, scanner, connexion, réinitialisation)', () => {
        const REQUIRED = [AUTH_PROVIDER, CONTROLLER_LAYOUT, SCANNER, RESET_PAGE];
        const clientFiles = appSources().filter((f) => /\.tsx?$/.test(f) && hasUseClient(f));
        const faults: string[] = [];
        for (const f of clientFiles) {
            const sf = sourceOf(f);
            const signOuts = callsTo(f, 'signOut').filter((c) => ts.isPropertyAccessExpression(c.expression)
                && ts.isPropertyAccessExpression(c.expression.expression) && c.expression.expression.name.text === 'auth');
            for (const so of signOuts) {
                const fn = enclosingFunction(so);
                const before = fn ? callsTo(f, 'detachPushSubscription').some((d) => d.getStart(sf) < so.getStart(sf) && d.getStart(sf) > fn.getStart(sf)) : false;
                if (!before) faults.push(`${f}:${lineOf(sf, so)} : signOut() sans detachPushSubscription() avant, dans la même fonction`);
            }
            if (signOuts.length > 0 && !importsName(f, 'detachPushSubscription', /^@\/lib\/push\/client$/)) faults.push(`${f} : detachPushSubscription non importée de @/lib/push/client`);
        }
        for (const f of REQUIRED) {
            if (callsTo(f, 'detachPushSubscription').length === 0) faults.push(`${f} : aucun appel à detachPushSubscription (contrat F4)`);
        }
        const loginFiles = [LOGIN_PAGE, LOGIN_FORM].filter(isFile);
        if (!loginFiles.some((f) => callsTo(f, 'detachPushSubscription').length > 0)) faults.push('connexion : la déconnexion forcée d\'un compte SUSPENDU n\'appelle pas detachPushSubscription');
        const profileUsesAuth = /\bsignOut\b[^;]*=\s*useAuth\(\)/.test(codeOf(PROFILE_PAGE)) || callsTo(PROFILE_PAGE, 'detachPushSubscription').length > 0;
        if (!profileUsesAuth) faults.push(`${PROFILE_PAGE} : déconnexion ni par useAuth().signOut (détachée par AuthProvider) ni précédée de detachPushSubscription`);
        assert.deepEqual(faults, [], faults.join('\n'));
    });
});

// ── 6.4 — préférences de notification (H4) ─────────────────────────────────

describe('6.4 — page « Préférences de notification » (H4)', () => {
    test('components/ui/Switch.tsx : role="switch", aria-checked, libellé lié, 44 px, états chargement et erreur', () => {
        requireFile(SWITCH, 'contrat H4 : bascule partagée');
        const code = codeOf(SWITCH);
        const tokens = classTokens(SWITCH);
        const expected: Array<[string, boolean]> = [
            ['export Switch', /export\s+(?:function|const)\s+Switch\b/.test(code)],
            ['role="switch"', jsxTags(SWITCH).some((el) => attrTexts(el, 'role').includes('switch'))],
            ['aria-checked', jsxTags(SWITCH).some((el) => attrOf(el, 'aria-checked') !== undefined)],
            ['libellé lié (htmlFor/id ou aria-labelledby)', /htmlFor/.test(code) || /aria-labelledby/.test(code)],
            ['44 px (min-h-11 ou h-11)', tokens.some((t) => /(?:^|:)(?:min-)?h-11$/.test(t))],
            ['état de chargement (prop loading ou isLoading, aria-busy)', /\b(?:isLoading|loading)\??\s*:/.test(code) && /aria-busy/.test(code)],
            ['état d\'erreur (prop error, aria-describedby)', /\berror\??\s*:/.test(code) && /aria-describedby/.test(code)],
        ];
        const missing = expected.filter(([, ok]) => !ok).map(([what]) => what);
        assert.deepEqual(missing, [], `${SWITCH} :\n  ${missing.join('\n  ')}`);
    });

    test('PushDeviceCard : les cinq états du push sur cet appareil, essai par /api/notifications/essai-push, aucune demande d\'autorisation directe', () => {
        requireFile(PUSH_CARD, 'contrat H4');
        const code = codeOf(PUSH_CARD);
        const texts = [
            'Activées sur cet appareil', 'Refusées dans le navigateur', 'Non prises en charge par ce navigateur',
            'Indisponibles pour le moment', 'Désactivées', 'Désactiver', "Envoyer une notification d'essai", 'Activer les notifications',
        ];
        const missing: string[] = texts.filter((t) => !hasText(PUSH_CARD, t)).map((t) => `texte « ${t} »`);
        for (const fn of ['currentPushState', 'enablePush', 'disablePush']) {
            if (!importsName(PUSH_CARD, fn, /^@\/lib\/push\/client$/)) missing.push(`${fn} importée de @/lib/push/client`);
        }
        if (!/\/api\/notifications\/test-push/.test(code) || !/method:\s*["']POST["']/.test(code)) missing.push('POST /api/notifications/essai-push');
        if (/requestPermission/.test(code)) missing.push('aucun requestPermission (présent)');
        assert.deepEqual(missing, [], `${PUSH_CARD} :\n  ${missing.join('\n  ')}`);
    });

    test('app/profile/notifications/page.tsx : PageHeader avec retour, « Toujours envoyées », « Vous choisissez », Switch par canal, PushDeviceCard, GET/PUT des préférences, Toast, ?topic=', () => {
        requireFile(PREFS_PAGE, 'contrat H4');
        const code = codeOf(PREFS_PAGE);
        const faults: string[] = [];
        const header = jsxTags(PREFS_PAGE, 'PageHeader').find((el) => attrTexts(el, 'title').includes('Préférences de notification'));
        if (!header) faults.push('aucun PageHeader de titre « Préférences de notification »');
        else if (!attrOf(header, 'back')) faults.push('PageHeader sans retour (back) vers le profil');
        for (const t of ['Toujours envoyées', 'Vous choisissez']) if (!hasText(PREFS_PAGE, t)) faults.push(`section « ${t} » absente`);
        if (!importsName(PREFS_PAGE, 'Switch', /^@\/components\/ui\/Switch$/) || jsxTags(PREFS_PAGE, 'Switch').length === 0) faults.push('Switch de @/components/ui/Switch non rendu');
        if (!importsName(PREFS_PAGE, 'PushDeviceCard', /^@\/components\/notifications\/PushDeviceCard$/) || jsxTags(PREFS_PAGE, 'PushDeviceCard').length === 0) faults.push('PushDeviceCard non rendu');
        if (!/\/api\/notifications\/preferences/.test(code)) faults.push('aucune lecture de /api/notifications/preferences');
        if (!/method:\s*["']PUT["']/.test(code)) faults.push('aucun PUT (mise à jour d\'une préférence)');
        if (!/\buseToast\b/.test(code)) faults.push('aucun Toast en cas d\'échec (useToast)');
        if (!/["']topic["']/.test(code) || !/scrollIntoView/.test(code)) faults.push('paramètre ?topic= : ni lecture de « topic » ni défilement (scrollIntoView)');
        if (/requestPermission/.test(code)) faults.push('requestPermission dans la page (réservé à lib/push/client.ts)');
        assert.deepEqual(faults, [], `${PREFS_PAGE} :\n  ${faults.join('\n  ')}`);
    });

    test('liens vers /profile/notifications : profil client, profils partenaire et contrôleur, pied de la cloche (« Préférences ») et page /notifications', () => {
        const faults: string[] = [];
        const linkTo = (f: string): JsxTag[] => jsxTags(f, /^(?:Link|LinkButton|a)$/).filter((el) => attrTexts(el, 'href').some((h) => h.startsWith('/profile/notifications')));
        for (const f of [PROFILE_PAGE, 'app/partner/profile/page.tsx', 'app/controller/profile/page.tsx', NOTIFS_PAGE]) {
            if (!isFile(f)) faults.push(`${f} absent`);
            else if (linkTo(f).length === 0) faults.push(`${f} : aucun lien vers /profile/notifications`);
        }
        if (!linkTo(BELL).some((el) => childTexts(el).includes('Préférences'))) faults.push(`${BELL} : pied sans lien « Préférences » vers /profile/notifications`);
        assert.deepEqual(faults, [], faults.join('\n'));
    });

    test('app/profile/page.tsx migré : PageHeader, aucun rôle brut affiché (roles.join)', () => {
        const faults: string[] = [];
        if (jsxTags(PROFILE_PAGE, 'PageHeader').length === 0) faults.push('aucun PageHeader');
        if (/\broles\.join\(/.test(codeOf(PROFILE_PAGE))) faults.push('rôles bruts affichés (roles.join) : codes SUPERADMIN, ADMIN… à l\'écran');
        assert.deepEqual(faults, [], `${PROFILE_PAGE} :\n  ${faults.join('\n  ')}`);
    });
});

// ── 6.7 — transferts reçus, vers un numéro seulement (B5, amendement 2) ─────

describe('6.7 — Mes billets « Reçus », vérification du numéro, transfert vers un numéro (B5, amendement 2)', () => {
    test('app/tickets/page.tsx : onglet « Reçus » (?tab=recus) qui rend IncomingTransfers, lecture de /api/tickets/transfers/incoming', () => {
        const faults: string[] = [];
        const code = codeOf(TICKETS_PAGE);
        if (!/["']recus["']/.test(code)) faults.push('onglet d\'identifiant « recus » absent');
        if (!hasText(TICKETS_PAGE, 'Reçus')) faults.push('libellé « Reçus » absent');
        if (!importsName(TICKETS_PAGE, 'IncomingTransfers', /^@\/components\/tickets\/IncomingTransfers$/) || jsxTags(TICKETS_PAGE, 'IncomingTransfers').length === 0) faults.push('IncomingTransfers non rendu');
        const incomingRead = [TICKETS_PAGE, INCOMING].filter(isFile).some((f) => /\/api\/tickets\/transfers\/incoming/.test(codeOf(f)));
        if (!incomingRead) faults.push('aucune lecture de /api/tickets/transfers/incoming');
        assert.deepEqual(faults, [], `${TICKETS_PAGE} :\n  ${faults.join('\n  ')}`);
    });

    test('IncomingTransfers : « Accepter le billet » confirmé (ConfirmDialog), POST …/claim, bandeau et bouton « Confirmer mon numéro »', () => {
        requireFile(INCOMING, 'contrat B5');
        const code = codeOf(INCOMING);
        const faults: string[] = [];
        if (!hasText(INCOMING, 'Accepter le billet')) faults.push('texte « Accepter le billet » absent');
        if (jsxTags(INCOMING, 'ConfirmDialog').length === 0) faults.push('aucun ConfirmDialog');
        if (!/\/api\/tickets\/transfers\/\$\{[^}]+\}\/claim/.test(code) || !/method:\s*["']POST["']/.test(code)) faults.push('aucun POST /api/tickets/transfers/${id}/claim');
        if (!jsxTags(INCOMING, 'StatusBanner').length || !containsText(INCOMING, 'Un billet vous attend peut-être. Confirmez votre numéro pour le voir.')) faults.push('StatusBanner « Un billet vous attend peut-être. Confirmez votre numéro pour le voir. » absent');
        if (!hasText(INCOMING, 'Confirmer mon numéro')) faults.push('bouton « Confirmer mon numéro » absent');
        if (!/phoneVerificationRequired/.test(code)) faults.push('phoneVerificationRequired jamais lu');
        if (jsxTags(INCOMING, 'PhoneVerifyDialog').length === 0) faults.push('PhoneVerifyDialog non rendu');
        assert.deepEqual(faults, [], `${INCOMING} :\n  ${faults.join('\n  ')}`);
    });

    test('PhoneVerifyDialog : Modal, send-otp puis verify-otp avec purpose LOGIN', () => {
        requireFile(PHONE_VERIFY, 'contrat B5');
        const code = codeOf(PHONE_VERIFY);
        const expected: Array<[string, boolean]> = [
            ['Modal', jsxTags(PHONE_VERIFY, 'Modal').length > 0],
            ['POST /api/auth/send-otp', /\/api\/auth\/send-otp/.test(code)],
            ['POST /api/auth/verify-otp', /\/api\/auth\/verify-otp/.test(code)],
            ["purpose: 'LOGIN'", /purpose:\s*["']LOGIN["']/.test(code)],
            ['otpCode', /\botpCode\b/.test(code)],
        ];
        const missing = expected.filter(([, ok]) => !ok).map(([what]) => what);
        assert.deepEqual(missing, [], `${PHONE_VERIFY} :\n  ${missing.join('\n  ')}`);
    });

    test('TransferModal : un seul champ « Numéro de téléphone du destinataire », texte d\'aide exact, plus d\'email ni de lien de réclamation', () => {
        const code = codeOf(TRANSFER_MODAL);
        const faults: string[] = [];
        if (!hasLinkedField(TRANSFER_MODAL, 'Numéro de téléphone du destinataire')) faults.push('champ « Numéro de téléphone du destinataire » sans libellé lié (exact)');
        if (!containsText(TRANSFER_MODAL, 'Le destinataire recevra un SMS. Il devra se connecter avec ce numéro pour accepter le billet sous 48 h.')) faults.push('texte d\'aide de l\'amendement 2 absent');
        const leftovers = ['claim_url', 'claimUrl', 'claimLink', 'claim_token'].filter((w) => new RegExp(`\\b${w}\\b`).test(code));
        if (leftovers.length > 0) faults.push(`lien de réclamation encore lu ou affiché (${leftovers.join(', ')})`);
        const emailTexts = fileTexts(TRANSFER_MODAL).filter((t) => /\bou (?:un |une |son |l')?(?:adresse )?e-?mail\b|\be-?mail du destinataire\b/i.test(t));
        if (emailTexts.length > 0) faults.push(`cible email encore proposée : ${emailTexts.map((t) => `« ${t.slice(0, 60)} »`).join(', ')}`);
        if (jsxTags(TRANSFER_MODAL, /^(?:input|TextInput)$/).some((el) => attrTexts(el, 'type').includes('email'))) faults.push('champ type="email"');
        assert.deepEqual(faults, [], `${TRANSFER_MODAL} :\n  ${faults.join('\n  ')}`);
    });

    test('app/tickets/claim/[token]/page.tsx : composant serveur qui redirige vers /tickets?tab=recus, sans lire le jeton ni la base', () => {
        const code = codeOf(CLAIM_PAGE);
        const faults: string[] = [];
        if (hasUseClient(CLAIM_PAGE)) faults.push('directive « use client »');
        if (!importsName(CLAIM_PAGE, 'redirect', /^next\/navigation$/)) faults.push('redirect non importé de next/navigation');
        if (!/\bredirect\(\s*["'`]\/tickets\?tab=recus["'`]\s*\)/.test(code)) faults.push("aucun redirect('/tickets?tab=recus')");
        if (/\bfetch\(|\.from\(|\.rpc\(/.test(code)) faults.push('lecture réseau ou base (fetch, from, rpc)');
        assert.deepEqual(faults, [], `${CLAIM_PAGE} :\n  ${faults.join('\n  ')}`);
    });
});

// ── 6.8 — supervision admin (L4, C6) ────────────────────────────────────────

/** Abonnements à admin_signals d'un fichier (objets littéraux `{ table: 'admin_signals', … }`) et leur filtre kind. */
function adminSignalSubscriptions(rel: string): Array<{ line: number; kinds: string[] | null; raw: string | null }> {
    const sf = sourceOf(rel);
    return objectLiterals(rel, (o) => propString(sf, o, 'table') === 'admin_signals').map((o) => {
        const raw = propString(sf, o, 'filter');
        const m = raw ? /^kind=in\.\(([A-Z_]+(?:,[A-Z_]+)*)\)$/.exec(raw.replace(/\s+/g, '')) : null;
        return { line: lineOf(sf, o), kinds: m ? m[1].split(',').sort() : null, raw: raw ?? (hasProp(o, 'filter') ? '(expression)' : null) };
    });
}

describe('6.8 — supervision admin (L4, C6)', () => {
    test('AppLayout : entrée « Notifications » (/admin/notifications) dans le groupe « Système » et dans proItems ; barre du bas admin inchangée', () => {
        const sf = sourceOf(APP_LAYOUT);
        const faults: string[] = [];
        const isNotifEntry = (o: ts.ObjectLiteralExpression): boolean => propString(sf, o, 'href') === '/admin/notifications' && propString(sf, o, 'name') === 'Notifications';
        const systemGroups = objectLiterals(APP_LAYOUT, (o) => propString(sf, o, 'label') === 'Système');
        if (systemGroups.length === 0) faults.push('groupe « Système » de adminNavGroups introuvable');
        else {
            const inSystem = systemGroups.some((g) => {
                let found = false;
                walk(g, (n) => { if (ts.isObjectLiteralExpression(n) && n !== g && isNotifEntry(n)) found = true; });
                return found;
            });
            if (!inSystem) faults.push('groupe « Système » sans { name: \'Notifications\', href: \'/admin/notifications\' }');
        }
        const pushes = callsTo(APP_LAYOUT, 'push').filter((c) => ts.isPropertyAccessExpression(c.expression) && c.expression.expression.getText() === 'proItems'
            && c.arguments.some((a) => ts.isObjectLiteralExpression(a) && propString(sf, a, 'href') === '/admin/notifications'));
        if (pushes.length === 0) faults.push('proItems sans entrée /admin/notifications');
        const mobile = objectLiterals(APP_LAYOUT, (o) => {
            const p = o.parent;
            return !!p && ts.isArrayLiteralExpression(p) && !!p.parent && ts.isVariableDeclaration(p.parent) && p.parent.name.getText() === 'adminMobileItems';
        });
        if (mobile.length !== 5 || mobile.some((o) => propString(sf, o, 'href') === '/admin/notifications')) faults.push(`barre du bas admin modifiée (${mobile.length} entrées ; 5 attendues, sans /admin/notifications)`);
        assert.deepEqual(faults, [], `${APP_LAYOUT} :\n  ${faults.join('\n  ')}`);
    });

    test('abonnements à admin_signals filtrés par kind : tableau de bord et file des événements kind=in.(EVENT_SUBMITTED,PARTNER_REGISTERED), page Notifications kind=in.(NOTIFICATION_FAILED,SMS_DAILY_THRESHOLD)', () => {
        const EXPECTED: Record<string, string[]> = {
            [ADMIN_DASHBOARD]: ['EVENT_SUBMITTED', 'PARTNER_REGISTERED'],
            [ADMIN_EVENTS]: ['EVENT_SUBMITTED', 'PARTNER_REGISTERED'],
            [ADMIN_NOTIFS]: ['NOTIFICATION_FAILED', 'SMS_DAILY_THRESHOLD'],
        };
        const faults: string[] = [];
        for (const [f, kinds] of Object.entries(EXPECTED)) {
            if (!isFile(f)) {
                faults.push(`${f} absent`);
                continue;
            }
            const subs = adminSignalSubscriptions(f);
            if (subs.length === 0) faults.push(`${f} : aucun abonnement à admin_signals`);
            for (const s of subs) {
                if (!s.kinds || s.kinds.join(',') !== [...kinds].sort().join(',')) {
                    faults.push(`${f}:${s.line} : filtre ${s.raw === null ? 'absent' : `« ${s.raw} »`} (attendu kind=in.(${kinds.join(',')}))`);
                }
            }
        }
        const others = appSources().filter((f) => /\.tsx?$/.test(f) && !(f in EXPECTED));
        for (const f of others) {
            for (const s of adminSignalSubscriptions(f)) if (!s.kinds) faults.push(`${f}:${s.line} : abonnement à admin_signals sans filtre kind=in.(…)`);
        }
        assert.deepEqual(faults, [], faults.join('\n'));
    });

    test('app/admin/notifications/page.tsx : PageHeader « Notifications » et LiveIndicator, KpiCard SMS, statut en ScrollableTabs, filtres, DataList, Pagination, états vide, erreur et accès refusé', () => {
        requireFile(ADMIN_NOTIFS, 'contrat L4');
        const code = codeOf(ADMIN_NOTIFS);
        const faults: string[] = [];
        if (!pageHeaderTitles(ADMIN_NOTIFS).includes('Notifications')) faults.push('aucun PageHeader de titre « Notifications »');
        for (const c of ['LiveIndicator', 'DataList', 'Pagination', 'EmptyState', 'ErrorState', 'StatusBadge']) {
            if (jsxTags(ADMIN_NOTIFS, c).length === 0) faults.push(`<${c}> jamais rendu`);
        }
        const kpis = jsxTags(ADMIN_NOTIFS, 'KpiCard').flatMap((el) => attrTexts(el, 'label'));
        for (const k of ["SMS aujourd'hui", 'SMS ce mois-ci']) if (!kpis.includes(k)) faults.push(`KpiCard « ${k} » absent`);
        if (!importsName(ADMIN_NOTIFS, 'ScrollableTabs', /^@\/components\/ui\/ScrollableTabs$/) || jsxTags(ADMIN_NOTIFS, 'ScrollableTabs').length === 0) faults.push('statut sans ScrollableTabs (@/components/ui/ScrollableTabs)');
        if (!jsxTags(ADMIN_NOTIFS, 'StatusBadge').some((el) => attrTexts(el, 'domain').includes('notification'))) faults.push('StatusBadge sans domain="notification"');
        for (const d of ['Du', 'Au']) {
            if (!jsxTags(ADMIN_NOTIFS, /^(?:TextInput|Field)$/).some((el) => attrTexts(el, 'label').includes(d))) faults.push(`champ de période « ${d} » absent`);
        }
        if (!/\/api\/admin\/notifications(?![\w/])/.test(code)) faults.push('aucune lecture de /api/admin/notifications');
        if (!/\/api\/admin\/notifications\/stats/.test(code)) faults.push('aucune lecture de /api/admin/notifications/stats');
        if (!/\b403\b/.test(code) || !hasText(ADMIN_NOTIFS, "Vous n'avez pas la permission de consulter les notifications.")) faults.push('état « Accès refusé » distinct pour un 403 absent');
        if (callsTo(ADMIN_NOTIFS, 'useRealtimeRefresh').length === 0) faults.push('aucun useRealtimeRefresh');
        assert.deepEqual(faults, [], `${ADMIN_NOTIFS} :\n  ${faults.join('\n  ')}`);
    });

    test('app/admin/notifications/[id]/page.tsx : sections, contenu OTP non conservé, « Relancer » rendu seulement sous une condition FAILED / can_retry, confirmé, POST …/retry', () => {
        requireFile(ADMIN_NOTIF_DETAIL, 'contrat L4');
        const code = codeOf(ADMIN_NOTIF_DETAIL);
        const faults: string[] = [];
        for (const s of ['Envoi', 'Destinataire', 'Décision', 'Contenu', 'Tentatives']) if (!hasText(ADMIN_NOTIF_DETAIL, s)) faults.push(`section « ${s} » absente`);
        if (!hasText(ADMIN_NOTIF_DETAIL, 'Contenu non conservé : code à usage unique')) faults.push('journal OTP : « Contenu non conservé : code à usage unique » absent');
        const retryButtons = jsxTags(ADMIN_NOTIF_DETAIL, /^(?:Button|button)$/).filter((el) => childTexts(el).includes('Relancer'));
        if (retryButtons.length === 0) faults.push('aucun bouton « Relancer »');
        const sf = sourceOf(ADMIN_NOTIF_DETAIL);
        const unguarded = retryButtons.filter((el) => !renderedUnder(elementOf(el), /FAILED|can_?retry/i)).map((el) => lineOf(sf, el));
        if (unguarded.length > 0) faults.push(`« Relancer » rendu sans condition FAILED / can_retry (ligne ${unguarded.join(', ')})`);
        if (jsxTags(ADMIN_NOTIF_DETAIL, 'ConfirmDialog').length === 0
            || !containsText(ADMIN_NOTIF_DETAIL, 'Relancer cette notification ?')
            || !containsText(ADMIN_NOTIF_DETAIL, "Elle repartira au prochain passage de l'envoyeur.")) faults.push('confirmation « Relancer cette notification ? Elle repartira au prochain passage de l\'envoyeur. » absente');
        if (!/\/api\/admin\/notifications\/\$\{[^}]+\}\/retry/.test(code) || !/method:\s*["']POST["']/.test(code)) faults.push('aucun POST /api/admin/notifications/${id}/retry');
        assert.deepEqual(faults, [], `${ADMIN_NOTIF_DETAIL} :\n  ${faults.join('\n  ')}`);
    });

    test('« Relancer » n\'est jamais rendu sans condition dans la liste admin', () => {
        requireFile(ADMIN_NOTIFS, 'contrat L4');
        const sf = sourceOf(ADMIN_NOTIFS);
        const unguarded = jsxTags(ADMIN_NOTIFS, /^(?:Button|button)$/)
            .filter((el) => childTexts(el).includes('Relancer') && !renderedUnder(elementOf(el), /FAILED|can_?retry/i))
            .map((el) => lineOf(sf, el));
        assert.deepEqual(unguarded, [], `${ADMIN_NOTIFS} : « Relancer » rendu sans condition FAILED / can_retry (ligne ${unguarded.join(', ')})`);
    });

    test('StatusBadge : domaine « notification » et tons du contrat L4 (PENDING neutral, SENDING info, SENT success, FAILED danger, SKIPPED et CANCELLED muted, UNCERTAIN warning-strong)', () => {
        const sfBadge = sourceOf(STATUS_BADGE);
        let domainOk = false;
        walk(sfBadge, (n) => {
            if (ts.isTypeAliasDeclaration(n) && n.name.text === 'StatusDomain' && /["']notification["']/.test(n.type.getText(sfBadge))) domainOk = true;
        });
        assert.ok(domainOk, `${STATUS_BADGE} : StatusDomain sans « notification »`);
        const EXPECTED: Record<string, string> = {
            PENDING: 'neutral', SENDING: 'info', SENT: 'success', FAILED: 'danger', SKIPPED: 'muted', CANCELLED: 'muted', UNCERTAIN: 'warning-strong',
        };
        const found: Record<string, string>[] = [];
        for (const f of [STATUS_BADGE, OUTBOX_LABELS].filter(isFile)) {
            const sf = sourceOf(f);
            for (const o of objectLiterals(f, (x) => Object.keys(EXPECTED).every((k) => hasProp(x, k)))) {
                const tones: Record<string, string> = {};
                for (const p of o.properties) {
                    if (!ts.isPropertyAssignment(p)) continue;
                    const key = p.name.getText(sf).replace(/['"]/g, '');
                    if (!(key in EXPECTED)) continue;
                    const v = p.initializer;
                    if (isStringish(v)) tones[key] = v.text;
                    else if (ts.isObjectLiteralExpression(v)) {
                        const t = propString(sf, v, 'tone');
                        if (t) tones[key] = t;
                    }
                }
                if (Object.keys(tones).length === Object.keys(EXPECTED).length && Object.values(tones).every((t) => ['neutral', 'brand', 'info', 'success', 'warning', 'warning-strong', 'danger', 'muted'].includes(t))) found.push(tones);
            }
        }
        assert.ok(found.length > 0, `aucune table des tons des 7 statuts de la boîte d'envoi dans ${STATUS_BADGE} ni ${OUTBOX_LABELS}`);
        assert.deepEqual(found[0], EXPECTED);
    });
});

// ── 6.10 — cloche et centre de notifications (N3) ───────────────────────────

/** Appels .filter(…) dont le rappel lit isRead (filtrage local des non lues). */
function localUnreadFilters(rel: string): number[] {
    const sf = sourceOf(rel);
    return callsTo(rel, 'filter').filter((c) => c.arguments.some((a) => /\bisRead\b/.test(a.getText(sf)))).map((c) => lineOf(sf, c));
}

describe('6.10 — cloche et page /notifications (N3)', () => {
    test('cloche : chaînes figées conservées, onglet « Non lues » chargé par le serveur (?limit=20&filter=unread), libellés par notificationTypeMeta, lien interne seulement', () => {
        const code = codeOf(BELL);
        const faults: string[] = [];
        if (!code.includes("fetch('/api/notifications?limit=20')")) faults.push("fetch('/api/notifications?limit=20') absent (tests/notifications-and-documents.test.ts:58-74)");
        for (const w of ['unreadCount', 'handleMarkAllAsRead']) if (!new RegExp(`\\b${w}\\b`).test(code)) faults.push(`${w} absent`);
        if (!/\/api\/notifications\?limit=20&filter=unread/.test(code)) faults.push('onglet « Non lues » : aucune lecture de /api/notifications?limit=20&filter=unread');
        const local = localUnreadFilters(BELL);
        if (local.length > 0) faults.push(`filtrage local des non lues (.filter sur isRead, ligne ${local.join(', ')})`);
        if (/\bTYPE_ICONS\b/.test(code)) faults.push('TYPE_ICONS encore utilisé (libellés et icônes par notificationTypeMeta)');
        if (!/\bnotificationTypeMeta\(/.test(code)) faults.push('notificationTypeMeta jamais appelé');
        const sf = sourceOf(BELL);
        const rawPush = callsTo(BELL, 'push').filter((c) => c.expression.getText(sf).startsWith('router.') && c.arguments.some((a) => /metadata/.test(a.getText(sf))));
        const viaVar = /const\s+(\w+)\s*=\s*[\w.?]*metadata\??\.actionUrl\b/.exec(code);
        if (rawPush.length > 0 || (viaVar && callsTo(BELL, 'push').some((c) => c.arguments.some((a) => a.getText(sf) === viaVar[1])))) {
            faults.push('router.push sur metadata.actionUrl tel quel (actionUrl interne de l\'API ou internalActionUrl attendu)');
        }
        if (!jsxTags(BELL, /^(?:Link|LinkButton)$/).some((el) => attrTexts(el, 'href').includes('/notifications') && childTexts(el).includes('Voir toutes les notifications'))) faults.push('pied « Voir toutes les notifications » absent');
        assert.deepEqual(faults, [], `${BELL} :\n  ${faults.join('\n  ')}`);
    });

    test('page /notifications : pagination serveur (page, pageSize, filter), plus de ?limit=50 ni de filtrage local, « Tout marquer comme lu », « Voir le détail » seulement avec actionUrl', () => {
        const code = codeOf(NOTIFS_PAGE);
        const faults: string[] = [];
        if (!code.includes("fetch('/api/notifications") && !code.includes('fetch(`/api/notifications')) faults.push("fetch('/api/notifications absent");
        if (!code.includes('fetch(`/api/notifications/${id}/read`')) faults.push('fetch(`/api/notifications/${id}/read` absent (tests/notifications-and-documents.test.ts:46-53)');
        if (/limit=50/.test(code)) faults.push('?limit=50 fixe (liste tronquée, pas de pagination)');
        if (jsxTags(NOTIFS_PAGE, 'Pagination').length === 0) faults.push('<Pagination> jamais rendu');
        for (const p of ['page', 'pageSize', 'filter']) {
            if (!new RegExp(`[?&]${p}=|["'\`]${p}["'\`]\\s*[,:)]`).test(code)) faults.push(`paramètre ${p} jamais envoyé à /api/notifications`);
        }
        const local = localUnreadFilters(NOTIFS_PAGE);
        if (local.length > 0) faults.push(`filtrage local des non lues (.filter sur isRead, ligne ${local.join(', ')})`);
        for (const t of ['Toutes', 'Non lues', 'Tout marquer comme lu']) if (!fileTexts(NOTIFS_PAGE).some((x) => x === t || x.startsWith(`${t} `) || x.startsWith(`${t}(`))) faults.push(`« ${t} » absent`);
        if (jsxTags(NOTIFS_PAGE, 'ErrorState').length === 0) faults.push('<ErrorState> (« Réessayer ») jamais rendu');
        const sf = sourceOf(NOTIFS_PAGE);
        const detail = jsxTags(NOTIFS_PAGE, /^(?:LinkButton|Link)$/).filter((el) => childTexts(el).includes('Voir le détail'));
        if (detail.length === 0) faults.push('lien « Voir le détail » absent');
        const unguarded = detail.filter((el) => !renderedUnder(elementOf(el), /actionUrl/)).map((el) => lineOf(sf, el));
        if (unguarded.length > 0) faults.push(`« Voir le détail » sans condition sur actionUrl (ligne ${unguarded.join(', ')})`);
        assert.deepEqual(faults, [], `${NOTIFS_PAGE} :\n  ${faults.join('\n  ')}`);
    });
});
