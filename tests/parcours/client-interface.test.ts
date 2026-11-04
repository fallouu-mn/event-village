/**
 * Lot 7 — 7.3 : écrans du parcours client (contrat §7.1 « client-interface », §7.2, D26, D55, D58 à D60 ;
 * écrivain « Client », W7). Suite STATIQUE : les sources sont lues par l'arbre syntaxique de TypeScript
 * (commentaires exclus), espaces repliés et apostrophes typographiques ramenées à « ' » pour les textes.
 * Les règles générales du système de design (couleurs brutes, tailles, liens imbriqués…) sont appliquées par
 * tests/parcours/design-systeme.test.ts aux fichiers de tests/helpers/design-files.ts : cette suite fige ce que
 * 7.3 exige en plus.
 *  - page de paiement /paiement/[id] (avec components/payment/PaymentWaitingInfo.tsx) : texte d'attente
 *    honnête de D58, numéro payeur masqué servi par la route, « Réessayer le paiement » vers retry_url, succès
 *    vers success_url, plus de framer-motion, montants par formatFcfa (D60) ;
 *  - PaymentModal : jetons --op-wave et --op-orange-money au lieu de bg-[#…] (D59), 409 PAYMENT_PENDING →
 *    « Un paiement est déjà en attente » et « Suivre le paiement », montants par formatFcfa ;
 *  - jetons --op-* d'app/globals.css : fond et texte, contraste ≥ 4,5:1 (calcul WCAG du test) ;
 *  - app/error.tsx : message générique, jamais error.message, « Réessayer » ;
 *  - app/orders/page.tsx : état d'erreur avec « Réessayer », plus de ?userId= (D5), onglets selon
 *    useFeatureFlags() ;
 *  - profil : « profil illisible » (erreur avec « Réessayer ») distinct de « non connecté » ;
 *  - AppLayout : Commandes, Salles de fête, Restaurants et tables, Produits et menu, Tables (et Commandes
 *    partenaire) conditionnées par useFeatureFlags(), masquées tant que la réponse n'est pas lue ; page nue
 *    pour /billet/hors-ligne (D26) ;
 *  - page événement : bandeau PendingPaymentBanner lu sur /api/checkout/pending, PaymentModal et EventMap en
 *    next/dynamic (aucun import statique d'une valeur de PaymentModal), carte chargée à la visibilité ;
 *  - app/not-found.tsx (404 des interrupteurs) : « Page introuvable », LinkButton vers l'accueil.
 *
 * Rouge avant correctif (fix(7.3e), E4 ; jetons --op-* par E3, fix(7.2e)) : page de paiement sans texte
 * d'attente ni reprise, avec framer-motion et « FCFA » écrit à la main (formatAmount) ; modale en bg-[#1DC8F2]
 * et bg-[#FF7900], sans traitement de PAYMENT_PENDING ; aucun jeton --op-* ; error.tsx affiche error.message ;
 * la page des commandes n'a aucun état d'erreur et envoie ?userId= ; le profil confond les deux cas
 * (!isAuthenticated || !profile) ; AppLayout sans useFeatureFlags ni /billet/hors-ligne ; page événement sans
 * bandeau, PaymentModal importée statiquement, aucune observation de visibilité ; not-found en <Link><Button>.
 * Vert dès l'écriture (garde-fou, signalé) : EventMap déjà chargée par next/dynamic.
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { assertTerrainInvariants } from './terrain-helpers';

after(async () => {
    await assertTerrainInvariants('client-interface');
});

const ROOT = process.cwd();
const PAY_PAGE = 'app/paiement/[id]/page.tsx';
const WAITING_INFO = 'components/payment/PaymentWaitingInfo.tsx';
const MODAL = 'components/payment/PaymentModal.tsx';
const BANNER = 'components/payment/PendingPaymentBanner.tsx';
const EVENT_PAGE = 'app/events/[id]/page.tsx';
const LAYOUT = 'components/layout/AppLayout.tsx';

// ── Lecture des sources ────────────────────────────────────────────────────

const printer = ts.createPrinter({ removeComments: true });

function abs(rel: string): string {
    return path.join(ROOT, ...rel.split('/'));
}

function exists(rel: string): boolean {
    return fs.existsSync(abs(rel)) && fs.statSync(abs(rel)).isFile();
}

function sourceFile(rel: string): ts.SourceFile {
    assert.ok(exists(rel), `${rel} absent`);
    const kind = rel.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    return ts.createSourceFile(rel, fs.readFileSync(abs(rel), 'utf8'), ts.ScriptTarget.Latest, true, kind);
}

/** Code sans commentaires. */
function code(rel: string): string {
    return printer.printFile(sourceFile(rel));
}

/** Texte comparable : entités et apostrophes typographiques ramenées à « ' », espaces (insécables compris) repliés. */
function normalized(text: string): string {
    return text.replace(/&apos;|&#39;|&rsquo;|[’‘]/g, "'").replace(/&nbsp;|[  ]/g, ' ').replace(/\s+/g, ' ');
}

/** Code sans commentaires de plusieurs fichiers (absents ignorés), texte comparable. */
function textOf(...files: string[]): string {
    return normalized(files.filter(exists).map(code).join('\n'));
}

/** formatFcfa importé de lib/format (D60), jamais redéfini localement, aucun « FCFA » écrit à la main. */
function assertSharedFcfa(rel: string): void {
    const src = code(rel);
    assert.match(src, /import\s*\{[^}]*\bformatFcfa\b[^}]*\}\s*from\s*["'](?:@\/|(?:\.\.\/)+)lib\/format["']/, `${rel} : formatFcfa non importé de lib/format`);
    assert.doesNotMatch(src, /function\s+formatFcfa\b|\bconst\s+formatFcfa\s*=/, `${rel} : formatFcfa redéfini localement (« FCFA » au lieu de « F CFA »)`);
    assert.doesNotMatch(src, /FCFA/, `${rel} : « FCFA » écrit à la main (D60 : formatFcfa partout)`);
}

function staticValueImports(sf: ts.SourceFile, moduleRe: RegExp): string[] {
    const out: string[] = [];
    for (const st of sf.statements) {
        if (!ts.isImportDeclaration(st) || !ts.isStringLiteral(st.moduleSpecifier) || !moduleRe.test(st.moduleSpecifier.text)) continue;
        const clause = st.importClause;
        if (!clause || clause.isTypeOnly) continue;
        if (clause.name) out.push(clause.name.text);
        const nb = clause.namedBindings;
        if (nb && ts.isNamedImports(nb)) for (const el of nb.elements) if (!el.isTypeOnly) out.push(el.name.text);
        if (nb && ts.isNamespaceImport(nb)) out.push(`* as ${nb.name.text}`);
    }
    return out;
}

// ── Contraste WCAG ─────────────────────────────────────────────────────────

function luminance([r, g, b]: number[]): number {
    const lin = (c: number) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: number[], b: number[]): number {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
}

/** Valeur d'une variable CSS au format du dépôt (« r g b », #rrggbb ou rgb(r, g, b)) dans un bloc. */
function cssColor(block: string, name: string): number[] | null {
    const all = Array.from(block.matchAll(new RegExp(`--${name}\\s*:\\s*([^;]+);`, 'g')));
    if (all.length === 0) return null;
    const v = all[all.length - 1][1].trim();
    let parts: RegExpExecArray | null;
    if ((parts = /^(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})$/.exec(v))) return [Number(parts[1]), Number(parts[2]), Number(parts[3])];
    if ((parts = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(v))) return [parseInt(parts[1], 16), parseInt(parts[2], 16), parseInt(parts[3], 16)];
    if ((parts = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i.exec(v))) return [Number(parts[1]), Number(parts[2]), Number(parts[3])];
    return null;
}

/** Contenu de tous les blocs d'un sélecteur exact (accolades équilibrées), dans l'ordre du fichier ; null si aucun. */
function cssBlocks(css: string, selector: RegExp): string | null {
    const out: string[] = [];
    const re = new RegExp(selector.source, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(css))) {
        const open = css.indexOf('{', m.index);
        let depth = 0;
        for (let i = open; i < css.length; i++) {
            if (css[i] === '{') depth += 1;
            else if (css[i] === '}') {
                depth -= 1;
                if (depth === 0) {
                    out.push(css.slice(open + 1, i));
                    break;
                }
            }
        }
    }
    return out.length > 0 ? out.join('\n') : null;
}

// ── Paiement ───────────────────────────────────────────────────────────────

describe('7.3 — page de paiement /paiement/[id] (D58, D60, contrat 3.5)', () => {
    test('attente honnête : garder la page ouverte, achat enregistré même fermée, SMS au numéro masqué, billets dans Mes billets', () => {
        const text = textOf(PAY_PAGE, WAITING_INFO);
        for (const fragment of [
            'Gardez cette page ouverte pour suivre la confirmation.',
            'Si elle se ferme, votre achat est quand même enregistré',
            'vous recevrez un SMS au',
            'vos billets apparaîtront dans Mes billets',
        ]) assert.ok(text.includes(fragment), `texte d'attente de D58 absent : « ${fragment} »`);
        assert.match(text, /payer_phone_masked/, 'numéro payeur masqué lu dans la route de statut (jamais le numéro en clair)');
    });

    test('échec, annulation, échéance : « Réessayer le paiement » vers retry_url ; succès vers success_url', () => {
        const text = textOf(PAY_PAGE, WAITING_INFO);
        assert.ok(text.includes('Réessayer le paiement'), 'bouton « Réessayer le paiement » absent');
        assert.match(text, /retry_url/, 'reprise vers retry_url servie par la route de statut');
        assert.match(text, /success_url/, 'destination du succès lue dans success_url (abonnement → /partner/subscription)');
    });

    test('plus de framer-motion ; montants par formatFcfa (« F CFA »), aucun « FCFA » écrit à la main', () => {
        const page = code(PAY_PAGE);
        assert.doesNotMatch(page, /from\s+["']framer-motion["']/, 'framer-motion encore importé (D77)');
        assertSharedFcfa(PAY_PAGE);
    });
});

describe('7.3 — PaymentModal (D59, D60, contrat 3.5)', () => {
    test('jetons d\'opérateur --op-* au lieu de couleurs brutes bg-[#…]', () => {
        const modal = code(MODAL);
        assert.doesNotMatch(modal, /bg-\[#/, 'couleur brute bg-[#…] encore présente');
        assert.match(modal, /op-wave/, 'jeton op-wave non utilisé');
        assert.match(modal, /op-orange-money/, 'jeton op-orange-money non utilisé');
    });

    test('409 PAYMENT_PENDING : « Un paiement est déjà en attente » et « Suivre le paiement »', () => {
        const text = normalized(code(MODAL));
        assert.match(text, /["']PAYMENT_PENDING["']/, 'code PAYMENT_PENDING non traité');
        assert.ok(text.includes('Un paiement est déjà en attente'), 'message « Un paiement est déjà en attente » absent');
        assert.ok(text.includes('Suivre le paiement'), 'lien « Suivre le paiement » absent');
    });

    test('montants par formatFcfa, aucun « FCFA » écrit à la main', () => {
        assertSharedFcfa(MODAL);
    });

    test('app/globals.css : --op-wave et --op-orange-money (fond et texte), contraste ≥ 4,5:1 en clair et en sombre', () => {
        const css = fs.readFileSync(abs('app/globals.css'), 'utf8');
        const blocks: Array<[string, string | null]> = [[':root', cssBlocks(css, /(?:^|[\s,}]):root\s*\{/)], ['.dark', cssBlocks(css, /(?:^|[\s,}])\.dark\s*\{/)]];
        const problems: string[] = [];
        for (const op of ['op-wave', 'op-orange-money']) {
            const root = blocks[0][1] ?? '';
            if (!cssColor(root, op)) {
                problems.push(`--${op} absent de :root (canaux « r g b »)`);
                continue;
            }
            for (const [label, block] of blocks) {
                if (!block) continue;
                const bg = cssColor(block, op) ?? cssColor(root, op);
                const fgName = [`on-${op}`, `${op}-fg`, `${op}-text`, `${op}-on`].find((n) => cssColor(block, n) || cssColor(root, n));
                if (!fgName) {
                    problems.push(`${label} : jeton de texte de --${op} absent (--on-${op} ou --${op}-fg)`);
                    continue;
                }
                const fg = cssColor(block, fgName) ?? cssColor(root, fgName);
                const ratio = contrast(bg!, fg!);
                if (ratio < 4.5) problems.push(`${label} : --${fgName} sur --${op} = ${ratio.toFixed(2)}:1 (< 4,5:1)`);
            }
        }
        assert.deepEqual(problems, [], problems.join('\n'));
    });
});

// ── Erreur, commandes, profil, 404 ─────────────────────────────────────────

describe('7.3 — états d\'erreur et 404', () => {
    test('app/error.tsx : message générique, jamais error.message, « Réessayer »', () => {
        const sf = sourceFile('app/error.tsx');
        const shown: string[] = [];
        const visit = (n: ts.Node): void => {
            if (ts.isJsxExpression(n) && n.expression && /\berror\.message\b/.test(n.expression.getText(sf))) shown.push(n.getText(sf));
            ts.forEachChild(n, visit);
        };
        visit(sf);
        assert.deepEqual(shown, [], `error.message affiché à l'écran : ${shown.join(' | ')}`);
        assert.ok(normalized(code('app/error.tsx')).includes('Réessayer'), 'bouton « Réessayer » absent');
    });

    test('app/orders/page.tsx : état d\'erreur avec « Réessayer », plus de ?userId=, onglets selon useFeatureFlags()', () => {
        const page = code('app/orders/page.tsx');
        assert.match(page, /<ErrorState\b|Réessayer/, 'aucun état d\'erreur avec « Réessayer » (une erreur affiche aujourd\'hui « Aucune commande trouvée »)');
        assert.doesNotMatch(page, /userId=/, 'la page envoie encore ?userId= (D5 : le compte vient de la session)');
        assert.match(page, /\buseFeatureFlags\s*\(/, 'onglets non conditionnés par useFeatureFlags() (D55)');
    });

    test('profil : un profil illisible affiche une erreur avec « Réessayer », distincte de « Connectez-vous »', () => {
        const page = code('app/profile/page.tsx');
        assert.doesNotMatch(page, /!\s*isAuthenticated\s*\|\|\s*!\s*profile\b/, 'non connecté et profil illisible confondus (!isAuthenticated || !profile)');
        assert.match(page, /<ErrorState\b|Réessayer/, 'aucune erreur avec « Réessayer » pour un profil illisible');
        assert.ok(normalized(page).includes('Connectez-vous pour voir votre profil'), 'état « non connecté » conservé');
    });

    test('app/not-found.tsx : « Page introuvable », LinkButton vers l\'accueil, plus de <Link><Button>', () => {
        const page = code('app/not-found.tsx');
        assert.ok(normalized(page).includes('Page introuvable'), '« Page introuvable » absent');
        const sf = sourceFile('app/not-found.tsx');
        const hrefs: string[] = [];
        const visit = (n: ts.Node): void => {
            if ((ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) && n.tagName.getText(sf) === 'LinkButton') {
                for (const attr of n.attributes.properties) {
                    if (ts.isJsxAttribute(attr) && attr.name.getText(sf) === 'href' && attr.initializer) hrefs.push(attr.initializer.getText(sf).replace(/^\{\s*|\s*\}$/g, ''));
                }
            }
            ts.forEachChild(n, visit);
        };
        visit(sf);
        assert.ok(hrefs.some((h) => /^["'`]\/["'`]$/.test(h)), `LinkButton vers « / » absent (href lus : ${hrefs.join(' | ') || 'aucun'})`);
        assert.doesNotMatch(page, /<Link\b[^>]*>\s*<Button\b/, '<Link><Button> imbriqués');
    });
});

// ── Navigation ─────────────────────────────────────────────────────────────

/** Entrées de navigation gouvernées par un interrupteur et nom attendu dans la condition. */
const GATED_NAV: Array<{ match: (href: string) => boolean; label: string; flag: RegExp }> = [
    { match: (h) => h === '/orders', label: 'Commandes (/orders)', flag: /halls|tables|orders|service|feature/i },
    { match: (h) => h === '/halls', label: 'Salles de fête (/halls)', flag: /halls/i },
    { match: (h) => h.startsWith('/restaurants/'), label: 'Restaurants et tables (/restaurants/…)', flag: /tables/i },
    { match: (h) => h === '/partner/products', label: 'Produits et menu (/partner/products)', flag: /orders/i },
    { match: (h) => h === '/partner/halls', label: 'Salles de fête (/partner/halls)', flag: /halls/i },
    { match: (h) => h === '/partner/tables', label: 'Tables (/partner/tables)', flag: /tables/i },
    { match: (h) => h === '/partner/orders', label: 'Commandes (/partner/orders)', flag: /orders/i },
];

const NAV_KEYS = new Set(['name', 'short', 'href', 'icon']);

/** Vrai si l'entrée porte un interrupteur (propriété dédiée) ou se trouve sous une condition qui en lit un. */
function isGated(obj: ts.ObjectLiteralExpression, flag: RegExp, sf: ts.SourceFile): boolean {
    for (const p of obj.properties) {
        if (!ts.isPropertyAssignment(p)) continue;
        const key = p.name.getText(sf).replace(/["']/g, '');
        if (!NAV_KEYS.has(key) && flag.test(p.initializer.getText(sf))) return true;
    }
    let node: ts.Node = obj;
    while (node.parent && !ts.isSourceFile(node.parent)) {
        const parent = node.parent;
        if (ts.isConditionalExpression(parent) && node !== parent.condition && flag.test(parent.condition.getText(sf))) return true;
        if (ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken && node === parent.right && flag.test(parent.left.getText(sf))) return true;
        if (ts.isIfStatement(parent) && node !== parent.expression && flag.test(parent.expression.getText(sf))) return true;
        node = parent;
    }
    return false;
}

describe('7.3 — AppLayout : entrées des services selon les interrupteurs (D55), page nue hors ligne (D26)', () => {
    test('useFeatureFlags() de lib/features/client, aucune valeur par défaut à true', () => {
        const layout = code(LAYOUT);
        assert.match(layout, /import\s*\{[^}]*\buseFeatureFlags\b[^}]*\}\s*from\s*["'](?:@\/|(?:\.\.\/)+)lib\/features\/client["']/, 'useFeatureFlags non importé de lib/features/client');
        assert.match(layout, /\buseFeatureFlags\s*\(\s*\)/, 'useFeatureFlags() non appelé');
        assert.doesNotMatch(layout, /\b(halls|tables|orders)\s*:\s*true\b/, 'valeur par défaut à true : les entrées doivent rester masquées tant que la réponse n\'est pas lue');
    });

    test('Commandes, Salles de fête, Restaurants et tables, Produits et menu, Tables, Commandes partenaire : conditionnées par leur interrupteur', () => {
        const sf = sourceFile(LAYOUT);
        const found = new Map<string, boolean>();
        const visit = (n: ts.Node): void => {
            if (ts.isObjectLiteralExpression(n)) {
                const href = n.properties.find((p): p is ts.PropertyAssignment => ts.isPropertyAssignment(p) && p.name.getText(sf) === 'href');
                if (href && ts.isStringLiteralLike(href.initializer)) {
                    const value = href.initializer.text;
                    const spec = GATED_NAV.find((g) => g.match(value));
                    if (spec) found.set(spec.label, (found.get(spec.label) ?? true) && isGated(n, spec.flag, sf));
                }
            }
            ts.forEachChild(n, visit);
        };
        visit(sf);
        const problems: string[] = [];
        for (const g of GATED_NAV) {
            if (!found.has(g.label)) problems.push(`${g.label} : entrée absente (le code n'est pas supprimé, l'entrée est masquée)`);
            else if (!found.get(g.label)) problems.push(`${g.label} : non conditionnée par l'interrupteur (${g.flag.source})`);
        }
        assert.deepEqual(problems, [], problems.join('\n'));
    });

    test('page nue pour /billet/hors-ligne', () => {
        assert.match(code(LAYOUT), /["'`]\/billet\/hors-ligne["'`]/, '/billet/hors-ligne non rendue nue par AppLayout (D26)');
    });
});

// ── Page événement ─────────────────────────────────────────────────────────

describe('7.3 — page événement : paiement en attente, chargements différés', () => {
    test('bandeau PendingPaymentBanner rendu, lu sur /api/checkout/pending', () => {
        assert.match(code(EVENT_PAGE), /<PendingPaymentBanner\b/, 'PendingPaymentBanner non rendu par la page événement');
        assert.match(code(BANNER), /["'`]\/api\/checkout\/pending/, `${BANNER} : lecture de /api/checkout/pending absente`);
    });

    test('PaymentModal en next/dynamic, sans import statique d\'une valeur de son module', () => {
        const sf = sourceFile(EVENT_PAGE);
        const page = code(EVENT_PAGE);
        assert.match(page, /\bdynamic\s*\(\s*\(\s*\)\s*=>\s*import\(\s*["']@\/components\/payment\/PaymentModal["']\s*\)/, 'PaymentModal non chargée par next/dynamic');
        assert.deepEqual(staticValueImports(sf, /components\/payment\/PaymentModal$/), [],
            'import statique d\'une valeur de PaymentModal : le module entier reste dans le bundle de la page (déplacer les aides ou importer leurs types seulement)');
    });

    test('EventMap en next/dynamic (garde-fou) et carte chargée à la visibilité', () => {
        const page = code(EVENT_PAGE);
        assert.match(page, /\bdynamic\s*\(\s*\(\s*\)\s*=>\s*import\(\s*["']@\/components\/ui\/EventMap["']\s*\)/, 'EventMap non chargée par next/dynamic');
        assert.deepEqual(staticValueImports(sourceFile(EVENT_PAGE), /components\/ui\/EventMap$/), [], 'import statique d\'EventMap');
        assert.match(page, /\bIntersectionObserver\b/, 'carte non différée jusqu\'à sa visibilité (IntersectionObserver)');
    });
});
