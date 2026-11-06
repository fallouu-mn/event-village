/**
 * Lot 8, tâche 8.2 j — redirections du middleware : un message affiché à l'accueil (contrat 8.3, L53, L54).
 * Les redirections elles-mêmes, avec de vraies sessions, sont dans tests/security/r6-roles-jeton.test.ts (T19).
 *
 * Sans base : la suite n'écrit rien et ne lit aucune table, elle se passe donc d'assertRecetteInvariants (écart
 * signalé, comme r24). Elle tourne sur le poste.
 *
 * Contrat figé ici, à lire par S1 et E4 (noms choisis par cet écrivain, le contrat 8.3 dit seulement « table
 * fermée clé → message ») :
 *  - lib/auth/access-errors.ts exporte ACCESS_ERROR_MESSAGES (Record<string, string>) et
 *    accessErrorMessage(key: string | null | undefined): string | null ;
 *  - components/layout/AccessNotice.tsx exporte AccessNotice (nommé ou par défaut).
 * AccessNotice est rendu pour de vrai, avec le contexte de useSearchParams de Next : un paramètre inconnu ne produit
 * aucun octet. Mesuré sur un composant d'essai hors du dépôt : le rendu fonctionne avec StatusBanner.
 *
 * Rouge aujourd'hui : les deux fichiers manquent, app/page.tsx ne monte rien, middleware.ts vise encore
 * /login?error=unauthorized_controller. Vert après fix(8.2j-s) et fix(8.2j-e).
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const ROOT = process.cwd();
const MIDDLEWARE = 'middleware.ts';
const TABLE = 'lib/auth/access-errors.ts';
const NOTICE = 'components/layout/AccessNotice.tsx';
const HOME = 'app/page.tsx';
const ROOT_LAYOUT = 'app/layout.tsx';

const MESSAGES: Readonly<Record<string, string>> = {
    unauthorized_admin: 'Cet espace est réservé aux administrateurs.',
    unauthorized_partner: 'Cet espace est réservé aux partenaires.',
    unauthorized_scanner: 'Le contrôle des billets est réservé aux contrôleurs et aux organisateurs.',
    unauthorized_controller: 'Cet espace est réservé aux contrôleurs dont le compte est actif.',
    roles_unavailable: 'Vérification de vos droits impossible pour le moment. Réessayez dans un instant.',
};

const UNKNOWN_KEYS = ['<script>alert(1)</script>', 'inconnu', 'constructor', '__proto__', 'toString', 'hasOwnProperty', 'UNAUTHORIZED_ADMIN', ' unauthorized_admin', ''];

interface AccessErrors {
    ACCESS_ERROR_MESSAGES: Record<string, string>;
    accessErrorMessage: (key: string | null | undefined) => string | null;
}

async function load(rel: string): Promise<Record<string, unknown>> {
    assert.ok(fs.existsSync(path.join(ROOT, rel)), `${rel} absent`);
    const target = `../../${rel.replace(/\.tsx?$/, '')}`;
    return (await import(target)) as Record<string, unknown>;
}

async function accessErrors(): Promise<AccessErrors> {
    const mod = await load(TABLE);
    assert.equal(typeof mod.ACCESS_ERROR_MESSAGES, 'object', `${TABLE} n'exporte pas ACCESS_ERROR_MESSAGES`);
    assert.equal(typeof mod.accessErrorMessage, 'function', `${TABLE} n'exporte pas accessErrorMessage`);
    return mod as unknown as AccessErrors;
}

function parse(rel: string): ts.SourceFile {
    assert.ok(fs.existsSync(path.join(ROOT, rel)), `${rel} absent`);
    const kind = rel.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    return ts.createSourceFile(rel, fs.readFileSync(path.join(ROOT, rel), 'utf8'), ts.ScriptTarget.Latest, true, kind);
}

/** Chaînes du fichier, commentaires exclus. */
function strings(sf: ts.SourceFile): string[] {
    const out: string[] = [];
    (function visit(n: ts.Node): void {
        if (ts.isStringLiteralLike(n)) out.push(n.text);
        ts.forEachChild(n, visit);
    })(sf);
    return out;
}

function emittedKeys(): string[] {
    const keys = new Set<string>();
    for (const text of strings(parse(MIDDLEWARE))) {
        const m = /^(?:.*[?&]error=)?(unauthorized_[a-z]+|[a-z]+_unavailable)$/.exec(text);
        if (m) keys.add(m[1]);
    }
    return Array.from(keys).sort();
}

async function renderNotice(query: string): Promise<string> {
    const mod = await load(NOTICE);
    const Notice = (mod.AccessNotice ?? mod.default) as ComponentType | undefined;
    assert.equal(typeof Notice, 'function', `${NOTICE} n'exporte pas AccessNotice`);
    const contextModule = 'next/dist/shared/lib/hooks-client-context.shared-runtime';
    const { SearchParamsContext } = (await import(contextModule)) as { SearchParamsContext: React.Context<URLSearchParams | null> };
    return renderToStaticMarkup(createElement(SearchParamsContext.Provider, { value: new URLSearchParams(query) }, createElement(Notice!)));
}

describe('8.2 j — table fermée des messages (lib/auth/access-errors.ts)', () => {
    for (const [key, text] of Object.entries(MESSAGES)) {
        test(`${key} → « ${text} »`, async () => {
            const { ACCESS_ERROR_MESSAGES, accessErrorMessage } = await accessErrors();
            assert.equal(ACCESS_ERROR_MESSAGES[key], text);
            assert.equal(accessErrorMessage(key), text);
        });
    }

    test('toute clé émise par middleware.ts est dans la table', async () => {
        const { accessErrorMessage } = await accessErrors();
        const emitted = emittedKeys();
        assert.deepEqual(emitted, Object.keys(MESSAGES).sort(), 'repérage des clés de middleware.ts : un repérage vide rendrait le contrôle muet');
        assert.deepEqual(emitted.filter((k) => accessErrorMessage(k) === null), [], 'clés émises sans message');
    });

    test('L54 : clé inconnue, héritée de Object.prototype, absente ou vide : null', async () => {
        const { accessErrorMessage } = await accessErrors();
        for (const key of [...UNKNOWN_KEYS, null, undefined]) {
            assert.equal(accessErrorMessage(key), null, `clé ${JSON.stringify(key)} : la table doit être fermée`);
        }
    });
});

describe('8.2 j — middleware.ts : plus aucune redirection d\'un connecté vers /login?error= (L53)', () => {
    test('aucune chaîne /login?error= : cette page renvoie un connecté vers son espace (boucle)', () => {
        const hits = strings(parse(MIDDLEWARE)).filter((s) => /\/login\?.*error=/.test(s));
        assert.deepEqual(hits, [], 'redirections à porter vers /?error=');
    });
});

describe('8.2 j — AccessNotice rendu', () => {
    for (const [key, text] of Object.entries(MESSAGES)) {
        test(`?error=${key} : message visible, annoncé en alerte`, async () => {
            const html = await renderNotice(`error=${key}`);
            assert.ok(html.includes(text), `message absent : ${html.slice(0, 300)}`);
            assert.match(html, /role="alert"/, 'StatusBanner announce="alert" attendu');
        });
    }

    for (const key of UNKNOWN_KEYS) {
        test(`?error=${JSON.stringify(key)} : rien n'est rendu, jamais le paramètre`, async () => {
            assert.equal(await renderNotice(`error=${encodeURIComponent(key)}`), '');
        });
    }

    test('sans paramètre : rien', async () => {
        assert.equal(await renderNotice(''), '');
        assert.equal(await renderNotice('autre=unauthorized_admin'), '');
    });
});

describe('8.2 j — montage (statique)', () => {
    test('AccessNotice : client, useSearchParams, StatusBanner warning en alerte, table partagée', () => {
        const sf = parse(NOTICE);
        const printed = ts.createPrinter({ removeComments: true }).printFile(sf);
        assert.match(printed, /^["']use client["']/, `${NOTICE} : 'use client' attendu`);
        assert.match(printed, /\buseSearchParams\s*\(/, `${NOTICE} : useSearchParams attendu`);
        assert.match(printed, /<StatusBanner\b[^>]*\btone="warning"/, `${NOTICE} : StatusBanner tone="warning" attendu`);
        assert.match(printed, /<StatusBanner\b[^>]*\bannounce="alert"/, `${NOTICE} : StatusBanner announce="alert" attendu`);
        assert.match(printed, /\baccessErrorMessage\b|\bACCESS_ERROR_MESSAGES\b/, `${NOTICE} : la table de ${TABLE} est la seule source des textes`);
    });

    test('accueil : AccessNotice sous <Suspense fallback={null}>, ou chargé par dynamic(…, { ssr: false }) ; rien dans le layout racine', () => {
        const printed = ts.createPrinter({ removeComments: true }).printFile(parse(HOME));
        assert.match(printed, /AccessNotice/, `${HOME} ne monte pas AccessNotice`);
        const suspended = /<Suspense\s+fallback=\{null\}\s*>\s*<AccessNotice\b/.test(printed);
        const dynamicNoSsr = /dynamic\([\s\S]*AccessNotice[\s\S]*ssr:\s*false/.test(printed);
        assert.ok(suspended || dynamicNoSsr, `${HOME} : sans Suspense, Next refuse useSearchParams au rendu statique de l'accueil`);
        assert.doesNotMatch(fs.readFileSync(path.join(ROOT, ROOT_LAYOUT), 'utf8'), /AccessNotice/, 'rien de nouveau dans le layout racine (budget de /)');
    });
});
