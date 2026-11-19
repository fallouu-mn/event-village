/**
 * Design 1c (administration) — contrôle statique, sans base.
 *  1. app/admin/** et components/admin/** : aucune couleur en dur (palette Tailwind brute, #hex, white, black, valeur de
 *     couleur arbitraire) ni ancien nom de couleur (scripts/design-anciens-noms.mjs) ; aucun texte de moins de 14 px
 *     (text-xs, text-[Npx]) ; arrondis de la charte (pas de rounded-2xl ni rounded-3xl) ; aucun <table> hors DataList.
 *  2. « super-administrateur » partout à l'écran (décision de l'utilisateur, qui remplace « Superadmin ») : textes JSX,
 *     chaînes et gabarits d'app/, components/ et lib/ lus par l'arbre syntaxique (identifiants exclus), hors modèles de
 *     messages (lib/notifications/catalog.ts, finition 4) ; libellé de rôle « Super-administrateur » ; glossaire.
 *  3. Fenêtre « Changer le rôle » : Modal de la charte, titre en question, quatre rôles en cartes radio avec une phrase,
 *     conséquence qui dit qui est prévenu, bouton qui dit l'action (« Passer en … »), retrait « Garder le rôle actuel ».
 *  4. Finance de l'administration : aucun identifiant brut affiché ; la référence d'un paiement passe par
 *     readablePaymentReference ; l'exception RAW_ID_TEXT de l'e2e est retirée.
 *  5. Tableaux larges de l'administration : cartes jusqu'à xl (menu latéral : à 768 et 1 024 px, la place manque).
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { oldNamesIn } from '../../scripts/design-anciens-noms.mjs';
import { readablePaymentReference } from '../../lib/finance/payment-labels';

const ROOT = process.cwd();
/** Identifiant brut (même motif que TECH_RE de tests/schema/design1b-mots.test.ts et techRe de e2e/support/checks.ts). */
const RAW_ID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
/** Code sans commentaires (les commentaires peuvent citer d'anciens textes ou d'anciennes classes). */
const code = (rel: string): string => read(rel).replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

function walk(dir: string, keep: (name: string) => boolean, out: string[] = []): string[] {
    if (!fs.existsSync(path.join(ROOT, dir))) return out;
    for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
        const rel = `${dir}/${e.name}`;
        if (e.isDirectory()) {
            if (e.name === 'node_modules') continue;
            walk(rel, keep, out);
        } else if (keep(e.name)) out.push(rel);
    }
    return out.sort();
}

const ADMIN_FILES = [...walk('app/admin', (n) => /\.tsx?$/.test(n)), ...walk('components/admin', (n) => /\.tsx?$/.test(n))];

const PALETTE = 'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';
const PREFIX = '(?:bg|text|border(?:-[trblxy])?|ring(?:-offset)?|divide|outline|fill|stroke|from|via|to|placeholder|decoration|caret|accent|shadow)';
/** Couleur en dur : palette brute, blanc ou noir Tailwind, valeur arbitraire, #hex. */
const HARD_COLOR = new RegExp(
    `(?<![\\w-])${PREFIX}-(?:(?:${PALETTE})-\\d{2,3}|white|black)(?![\\w-])`
    + `|(?<![\\w-])${PREFIX}-\\[(?:#|rgb|hsl)`
    + '|#[0-9a-fA-F]{6}\\b|#[0-9a-fA-F]{3}\\b(?![\\w-])',
);

describe('1. administration aux jetons de la charte', () => {
    test(`${ADMIN_FILES.length} fichiers lus (app/admin, components/admin)`, () => {
        assert.ok(ADMIN_FILES.length >= 35, `fichiers de l’administration lus : ${ADMIN_FILES.length}`);
    });

    test('aucune couleur en dur ni ancien nom de couleur', () => {
        const faults: string[] = [];
        for (const f of ADMIN_FILES) {
            const src = read(f);
            const hard = code(f).split('\n').map((l, i) => [i + 1, HARD_COLOR.exec(l)] as const).filter(([, m]) => m);
            for (const [line, m] of hard) faults.push(`${f}:${line} : couleur en dur « ${m![0]} »`);
            for (const old of oldNamesIn(src)) faults.push(`${f} : ancien nom « ${old} »`);
        }
        console.log(`[DESIGN1C-ADMIN] 1. ${ADMIN_FILES.length} fichiers ; fautes : ${faults.length}`);
        assert.deepEqual(faults, [], faults.join('\n'));
    });

    test('aucun texte de moins de 14 px, arrondis de la charte, aucun <table> hors DataList', () => {
        const faults: string[] = [];
        for (const f of ADMIN_FILES) {
            const c = code(f);
            for (const m of c.match(/(?<![\w-])text-(?:xs|\[\d+px\]|\[0?\.\d+rem\])(?![\w-])/g) ?? []) faults.push(`${f} : texte trop petit « ${m} »`);
            for (const m of c.match(/(?<![\w-])rounded(?:-[tblr]{1,2})?-(?:2xl|3xl)(?![\w-])/g) ?? []) faults.push(`${f} : arrondi hors charte « ${m} »`);
            if (/<table\b/.test(c)) faults.push(`${f} : <table> écrit à la main (DataList attendu)`);
        }
        assert.deepEqual(faults, [], faults.join('\n'));
    });

    test('pas de grand bouton en dégradé dans l’administration (rien à vendre)', () => {
        const faults = ADMIN_FILES.filter((f) => /variant=["']gradient["']|bg-gradient-to-/.test(code(f)));
        assert.deepEqual(faults, []);
    });
});

// ── 2. « super-administrateur » ───────────────────────────────────────────────────────────────────────────────────────

/** Autres formes du rôle : « Superadmin », « Super admin », « superadministrateur », « super administrateur »… */
const OTHER_FORMS = /(?<![\p{L}\p{N}_./@-])(?:[Ss]uperadmins?|SuperAdmins?|[Ss]uper[ -]admins?|[Ss]uper ?administrat\p{L}*)(?![\p{L}\p{N}_-])/u;
const MESSAGE_TEMPLATES = new Set(['lib/notifications/catalog.ts']);

/** Textes lus à l'écran ou renvoyés à l'écran : texte JSX, chaînes, gabarits (identifiants et commentaires exclus). */
function shownTexts(rel: string): Array<{ line: number; text: string }> {
    const src = read(rel);
    const sf = ts.createSourceFile(rel, src, ts.ScriptTarget.Latest, true, rel.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const out: Array<{ line: number; text: string }> = [];
    const add = (node: ts.Node, text: string): void => {
        out.push({ line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1, text });
    };
    const visit = (node: ts.Node): void => {
        // Modules importés (chemins) : pas des textes
        if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return;
        if (ts.isJsxText(node)) add(node, node.text);
        else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) add(node, node.text);
        else if (ts.isTemplateExpression(node)) add(node, [node.head.text, ...node.templateSpans.map((s) => s.literal.text)].join(' '));
        ts.forEachChild(node, visit);
    };
    visit(sf);
    return out;
}

describe('2. « super-administrateur » partout à l’écran', () => {
    test('aucune autre forme du rôle dans les textes d’app/, components/ et lib/ (hors modèles de messages)', () => {
        const files = ['app', 'components', 'lib'].flatMap((d) => walk(d, (n) => /\.tsx?$/.test(n) && !n.endsWith('.d.ts')))
            .filter((f) => !MESSAGE_TEMPLATES.has(f));
        const faults: string[] = [];
        let texts = 0;
        for (const f of files) {
            for (const { line, text } of shownTexts(f)) {
                texts += 1;
                const m = OTHER_FORMS.exec(text);
                if (m) faults.push(`${f}:${line} : « ${m[0]} » — « ${text.replace(/\s+/g, ' ').trim().slice(0, 100)} »`);
            }
        }
        console.log(`[DESIGN1C-ADMIN] 2. ${files.length} fichiers, ${texts} textes relus ; fautes : ${faults.length}`);
        assert.deepEqual(faults, [], faults.join('\n'));
    });

    test('libellé du rôle : « Super-administrateur » (comptes, menu, profil, journal)', () => {
        for (const f of ['lib/labels/account.ts', 'components/layout/AppLayout.tsx', 'app/profile/page.tsx', 'app/admin/audit/page.tsx']) {
            assert.match(code(f), /SUPERADMIN: 'Super-administrateur',/, `${f} : rôle SUPERADMIN mal nommé`);
        }
    });

    test('glossaire : entrée « super-administrateur », « Superadmin » parmi les mots à éviter', () => {
        const doc = read('docs/glossaire.md');
        const row = doc.split('\n').find((l) => l.startsWith('| **super-administrateur** |'));
        assert.ok(row, 'entrée « super-administrateur » absente du glossaire');
        assert.match(row!.split('|').slice(-2, -1)[0], /Superadmin/, '« Superadmin » absent des mots à éviter');
        assert.doesNotMatch(doc, /\| \*\*Superadmin\*\* \|/, 'ancienne entrée « Superadmin » encore retenue');
    });
});

// ── 3. Fenêtre « Changer le rôle » ────────────────────────────────────────────────────────────────────────────────────

describe('3. fenêtre « Changer le rôle »', () => {
    const dlg = code('components/admin/RoleChangeDialog.tsx');

    test('Modal de la charte (focus piégé, Échap ferme), titre en question', () => {
        assert.match(dlg, /import \{ Modal \} from '@\/components\/ui\/Modal'/);
        assert.match(dlg, /<Modal\b/);
        assert.match(dlg, /title=\{self \? 'Quitter le rôle de super-administrateur \?' : `Changer le rôle de \$\{name\} \?`\}/, 'titre en question');
        assert.doesNotMatch(dlg, /<div[^>]*role="dialog"/, 'fenêtre écrite à la main');
    });

    test('quatre rôles en cartes radio, une phrase chacun', () => {
        assert.match(dlg, /type="radio"/);
        for (const [label, sentence] of [
            ['Client', 'Achète des billets, sans accès professionnel.'],
            ['Contrôleur', 'Scanne les billets des événements où un partenaire l’affecte.'],
            ['Administrateur', 'Agit selon les droits que vous lui donnez.'],
            ['Super-administrateur', 'Tous les droits, dont les réglages et la création d’administrateurs.'],
        ]) {
            assert.ok(dlg.includes(`label: '${label}', sentence: '${sentence}'`), `carte « ${label} » absente ou sans sa phrase`);
        }
        assert.match(dlg, /Rôle actuel/, 'rôle actuel non dit');
    });

    test('conséquence en une phrase : ce que la personne pourra faire et qui est prévenu', () => {
        const effects = dlg.match(/return (?:self\s*\?\s*)?'[^']+'/g) ?? [];
        const sentences = [...dlg.matchAll(/'((?:Il|Vous) [^']+)'/g)].map((m) => m[1]);
        assert.ok(effects.length >= 4 && sentences.length >= 5, `conséquences lues : ${sentences.length}`);
        for (const s of sentences) {
            assert.match(s, /Personne n’est prévenu\.|Chaque super-administrateur reçoit un SMS d’alerte\./, `conséquence sans « qui est prévenu » : ${s}`);
        }
    });

    test('bouton qui dit l’action, retrait « Garder le rôle actuel » ; « fait » seulement sur la réponse du serveur', () => {
        assert.match(dlg, /const actionLabel = `Passer en \$\{IN_SENTENCE\[to\]\}`/);
        assert.match(dlg, /ADMIN: 'administrateur'/);
        assert.match(dlg, /SUPERADMIN: 'super-administrateur'/);
        assert.match(dlg, />Garder le rôle actuel</);
        assert.doesNotMatch(dlg, />Changer le rôle</, 'bouton générique « Changer le rôle » dans la fenêtre');
        assert.match(dlg, /reply\.ok === true && reply\.role_after === to/);
    });
});

// ── 4. Finance : aucun identifiant brut ───────────────────────────────────────────────────────────────────────────────

describe('4. finance de l’administration : aucun identifiant brut', () => {
    test('référence d’un paiement : SamirPay telle quelle, identifiant interne en référence courte', () => {
        const id = 'f7b8c4ba-28ef-43ab-9ed1-b0cfd23e4a4a';
        assert.equal(readablePaymentReference(id), 'Réf. interne F7B8C4BA');
        assert.equal(readablePaymentReference('SP-2611-8F3A21'), 'SP-2611-8F3A21');
        assert.equal(readablePaymentReference(''), 'Sans référence');
        assert.equal(readablePaymentReference(null), 'Sans référence');
        assert.doesNotMatch(readablePaymentReference(id), RAW_ID);
    });

    test('la page Finance passe chaque référence par readablePaymentReference', () => {
        const page = code('app/admin/finance/page.tsx');
        assert.doesNotMatch(page, /\{\s*p\.transactionReference\s*\}/, 'référence brute affichée');
        assert.equal((page.match(/readablePaymentReference\(p\.transactionReference\)/g) ?? []).length, 2, 'tableau et carte');
    });

    test('aucun identifiant rendu dans la finance et le journal ; exception RAW_ID_TEXT retirée de l’e2e', () => {
        const files = ['app/admin/finance/page.tsx', 'app/admin/audit/page.tsx', ...walk('components/admin/finance', (n) => n.endsWith('.tsx')), 'components/admin/RefundsToRetry.tsx'];
        for (const f of files) {
            // Rendu JSX seulement : ni `${item.id}` (adresse d'une route), ni `key={item.id}` (attribut)
            const shown = /(?<![$=])\{\s*[\w.]*\.(?:id|user_id|object_id|partner_id|event_id)\s*\}/.exec(code(f));
            assert.equal(shown, null, `${f} : identifiant rendu entre accolades (${shown?.[0]})`);
        }
        const screens = read('e2e/support/screens.ts');
        assert.doesNotMatch(screens, /references:\s*\[RAW_ID_TEXT\]/, 'exception d’identifiant brut encore déclarée');
        assert.doesNotMatch(screens, /const RAW_ID_TEXT\b/);
    });
});

// ── 5. Tableaux larges ────────────────────────────────────────────────────────────────────────────────────────────────

describe('5. tableaux larges : cartes jusqu’à xl', () => {
    test('DataList : point de rupture réglable (md par défaut, lg, xl), défilement dans la boîte, jamais texte coupé', () => {
        const dl = code('components/ui/DataList.tsx');
        assert.match(dl, /breakpoint\?: 'md' \| 'lg' \| 'xl'/);
        assert.match(dl, /xl: 'hidden xl:block'/);
        assert.match(dl, /xl: 'xl:hidden'/);
        assert.match(dl, /overflow-x-auto/);
    });

    test('chaque DataList de 5 colonnes ou plus de l’administration passe en cartes jusqu’à xl', () => {
        const faults: string[] = [];
        for (const f of ADMIN_FILES.filter((x) => x.endsWith('.tsx'))) {
            const c = code(f);
            for (const m of c.matchAll(/<DataList\b[\s\S]*?\/>/g)) {
                const cols = /columns=\{(\w+)\}/.exec(m[0])?.[1];
                if (!cols) continue;
                const decl = new RegExp(`(?:const|let) ${cols}\\b[^=]*=\\s*\\[([\\s\\S]*?)\\n\\s*\\];`).exec(c);
                const count = decl ? (decl[1].match(/\bheader:/g) ?? []).length : 0;
                if (count >= 5 && !/breakpoint="xl"/.test(m[0])) faults.push(`${f} : ${cols} (${count} colonnes) sans breakpoint="xl"`);
            }
        }
        assert.deepEqual(faults, [], faults.join('\n'));
    });
});
