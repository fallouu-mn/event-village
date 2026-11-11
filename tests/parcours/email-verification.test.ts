/**
 * Lot 9 bis, domaine G (contrat 5.47, 5.48, 4.6 ; décisions B96, B100 ; discovery-9bis-email 2, 3, 7) — l'email,
 * vrai canal : adresse visible à l'inscription et au profil, puis vérifiée par un lien avant de servir.
 *
 * Tâche 47 (statique, sans base) :
 *  - app/register/page.tsx : le champ « inscription-email » est rendu hors de l'accordéon `moreOptions`, après le mot de
 *    passe, libellé « Adresse email (facultative) », aide exacte « Recommandé : recevez vos billets et confirmations par
 *    email » ; l'accordéon devient « Plus d’options : code de parrainage » ; textes du lien envoyé ou non parti ;
 *  - components/profile/ProfileForm.tsx (et app/profile/page.tsx) : même aide, badges « Email vérifié » et « Email non
 *    vérifié », bouton « Renvoyer le lien » qui appelle /api/account/email/resend, texte « Lien envoyé à … » ;
 *  - app/partner/register/page.tsx : même aide (E-B).
 * Rouge aujourd'hui : le champ est dans la branche `moreOptions` (app/register/page.tsx:441), l'aide du profil est
 * « Facultative… » (ProfileForm.tsx:150), aucun badge ni bouton de renvoi, aucune route de renvoi.
 *
 * Les textes sont comparés mot pour mot, espaces insécables et apostrophes typographiques ramenées à leur forme simple
 * (la règle des espaces insécables avant « : » est celle de l'interface, pas celle du test).
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const ROOT = process.cwd();
/** Aide exacte de la consigne (G.47), à l'inscription client, à l'inscription partenaire et au profil. */
const EMAIL_HINT = 'Recommandé : recevez vos billets et confirmations par email';

// ── Lecture des sources ────────────────────────────────────────────────────

/** Espaces (insécables comprises) réduites à une espace simple, apostrophes typographiques ramenées à « ' ». */
function norm(s: string): string {
    return s.replace(/[  ]/g, ' ').replace(/[’‘]/g, '\'').replace(/\s+/g, ' ').trim();
}

function readSource(rel: string, why: string): string {
    const abs = path.resolve(ROOT, rel);
    assert.ok(fs.existsSync(abs), `${rel} absent (${why})`);
    return fs.readFileSync(abs, 'utf8');
}

/** Fichier d'un import « @/… » du dépôt (.ts, .tsx ou index), null s'il n'existe pas. */
function resolveAlias(spec: string): string | null {
    const base = spec.replace(/^@\//, '');
    for (const candidate of [`${base}.tsx`, `${base}.ts`, `${base}/index.tsx`, `${base}/index.ts`]) {
        if (fs.existsSync(path.resolve(ROOT, candidate))) return candidate;
    }
    return null;
}

/**
 * Source normalisée du fichier et de ses imports directs « @/components/… » et « @/lib/… » : un texte déplacé dans un
 * composant ou un module de textes reste trouvé, sans élargir la recherche au reste du dépôt.
 */
function sourceWithImports(rel: string, why: string): string {
    const src = readSource(rel, why);
    const parts = [src];
    for (const m of src.matchAll(/from\s+['"](@\/(?:components|lib)\/[^'"]+)['"]/g)) {
        const file = resolveAlias(m[1]);
        if (file) parts.push(fs.readFileSync(path.resolve(ROOT, file), 'utf8'));
    }
    return norm(parts.join('\n'));
}

function tsxFile(rel: string, why: string): ts.SourceFile {
    return ts.createSourceFile(rel, readSource(rel, why), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

type JsxOpening = ts.JsxOpeningElement | ts.JsxSelfClosingElement;

/** Valeur littérale d'un attribut JSX (« … », {'…'} ou {`…`} sans substitution), null sinon. */
function attrValue(el: JsxOpening, name: string): string | null {
    for (const prop of el.attributes.properties) {
        if (!ts.isJsxAttribute(prop) || prop.name.getText() !== name || !prop.initializer) continue;
        const init = prop.initializer;
        if (ts.isStringLiteral(init)) return init.text;
        if (ts.isJsxExpression(init) && init.expression
            && (ts.isStringLiteral(init.expression) || ts.isNoSubstitutionTemplateLiteral(init.expression))) return init.expression.text;
    }
    return null;
}

/** Éléments JSX dont l'attribut `id` vaut littéralement `id`. */
function elementsWithId(sf: ts.SourceFile, id: string): JsxOpening[] {
    const found: JsxOpening[] = [];
    const visit = (n: ts.Node): void => {
        if ((ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) && attrValue(n, 'id') === id) found.push(n);
        ts.forEachChild(n, visit);
    };
    visit(sf);
    return found;
}

/** Conditions qui gardent le rendu de `node` : côté gauche des « && » et « || », condition des « ? : ». */
function renderGuards(node: ts.Node): string[] {
    const guards: string[] = [];
    let child: ts.Node = node;
    for (let n: ts.Node | undefined = node.parent; n; child = n, n = n.parent) {
        if (ts.isBinaryExpression(n) && n.right === child
            && (n.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken || n.operatorToken.kind === ts.SyntaxKind.BarBarToken)) {
            guards.push(n.left.getText());
        }
        if (ts.isConditionalExpression(n) && n.condition !== child) guards.push(n.condition.getText());
    }
    return guards;
}

/** Identifiants (`id`) des éléments JSX qui contiennent `node`. */
function enclosingIds(node: ts.Node): string[] {
    const ids: string[] = [];
    for (let n: ts.Node | undefined = node.parent; n; n = n.parent) {
        if (ts.isJsxElement(n)) {
            const id = attrValue(n.openingElement, 'id');
            if (id) ids.push(id);
        }
    }
    return ids;
}

function assertText(haystack: string, expected: string, what: string): void {
    assert.ok(haystack.includes(norm(expected)), `${what} : texte « ${expected} » absent`);
}

// ── Tâche 47 : inscription ─────────────────────────────────────────────────

describe('9b.47 G.47 — inscription client : l’email n’est plus caché (app/register/page.tsx, E-G)', () => {
    const REGISTER = 'app/register/page.tsx';
    const WHY = 'écran d’inscription, contrat 5.47';

    test('le champ « inscription-email » est rendu hors de l’accordéon moreOptions, après le mot de passe', () => {
        const sf = tsxFile(REGISTER, WHY);
        const fields = elementsWithId(sf, 'inscription-email');
        assert.equal(fields.length, 1, `un seul champ id="inscription-email" attendu (trouvé ${fields.length})`);
        const guards = renderGuards(fields[0]);
        assert.ok(!guards.some((g) => /moreOptions/.test(g)),
            `le champ email est encore rendu sous condition de l’accordéon (G.47 : « n’est plus caché ») : ${guards.join(' | ')}`);
        assert.ok(!enclosingIds(fields[0]).includes('inscription-options'), 'le champ email est encore dans le bloc « inscription-options »');
        const password = elementsWithId(sf, 'inscription-mot-de-passe');
        assert.equal(password.length, 1, 'champ id="inscription-mot-de-passe" attendu');
        assert.ok(fields[0].getStart() > password[0].getStart(), 'le champ email vient après le mot de passe (contrat 5.47, E-G)');
    });

    test('libellé « Adresse email (facultative) » et aide exacte « Recommandé : recevez vos billets et confirmations par email »', () => {
        const [field] = elementsWithId(tsxFile(REGISTER, WHY), 'inscription-email');
        assert.ok(field, 'champ id="inscription-email" absent');
        assert.equal(norm(attrValue(field, 'label') ?? ''), norm('Adresse email (facultative)'), 'libellé du champ');
        assert.equal(norm(attrValue(field, 'hint') ?? ''), norm(EMAIL_HINT),
            `aide du champ (G.47, mot pour mot) ; lue : « ${attrValue(field, 'hint') ?? 'aucune aide littérale'} »`);
    });

    test('l’accordéon ne porte plus que le code de parrainage : « Plus d’options : code de parrainage »', () => {
        const src = norm(readSource(REGISTER, WHY));
        assertText(src, 'Plus d’options : code de parrainage', 'accordéon de l’inscription');
        assert.ok(!src.includes(norm('Plus d’options : email, code de parrainage')), 'l’accordéon annonce encore l’email');
    });

    test('textes après l’inscription : lien envoyé (valable 24 heures) ou lien non parti, renvoi depuis le profil', () => {
        const src = sourceWithImports(REGISTER, WHY);
        assertText(src, 'Un lien de vérification a été envoyé à', 'inscription réussie avec email');
        assertText(src, 'Il est valable 24 heures.', 'inscription réussie avec email');
        assertText(src, 'Le lien n’a pas pu être envoyé. Renvoyez-le depuis votre profil.', 'lien non parti');
    });
});

describe('9b.47 G.47 — inscription partenaire : même aide (app/partner/register/page.tsx, E-B)', () => {
    test('aide exacte sous l’email professionnel', () => {
        const src = sourceWithImports('app/partner/register/page.tsx', 'inscription partenaire, contrat 5.47');
        assertText(src, EMAIL_HINT, 'inscription partenaire');
    });
});

// ── Tâche 47 : profil ──────────────────────────────────────────────────────

describe('9b.47 G.47, R87 — profil : aide, état de l’adresse, renvoi du lien (ProfileForm.tsx, profile/page.tsx, E-G)', () => {
    const FORM = 'components/profile/ProfileForm.tsx';
    const PAGE = 'app/profile/page.tsx';
    const WHY = 'profil, contrat 5.47';
    const profileSources = (): string => `${sourceWithImports(FORM, WHY)}\n${sourceWithImports(PAGE, WHY)}`;

    test('ProfileForm : aide exacte du champ email, plus « Facultative… »', () => {
        const src = norm(readSource(FORM, WHY));
        assertText(src, EMAIL_HINT, 'aide du champ email du profil');
        assert.ok(!src.includes(norm('Facultative. Laissez ce champ vide si vous n’en avez pas.')), 'ancienne aide encore présente (ProfileForm.tsx:150)');
    });

    test('état de l’adresse : badges « Email vérifié » et « Email non vérifié »', () => {
        const src = profileSources();
        assertText(src, 'Email vérifié', 'badge d’une adresse vérifiée');
        assertText(src, 'Email non vérifié', 'badge d’une adresse en attente (R87)');
    });

    test('« Renvoyer le lien » présent et appelle POST /api/account/email/resend ; texte « Lien envoyé à … Il est valable 24 heures. »', () => {
        const src = profileSources();
        assertText(src, 'Renvoyer le lien', 'bouton de renvoi (R87)');
        assert.match(src, /["'`]\/api\/account\/email\/resend["'`]/, 'le profil n’appelle pas /api/account/email/resend');
        assertText(src, 'Lien envoyé à', 'renvoi réussi');
        assertText(src, 'Il est valable 24 heures.', 'renvoi réussi');
    });
});
