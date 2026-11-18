/**
 * Lot 8, tâche 8.2 h — page d'un événement non public : un vrai 404 HTTP par notFound() côté serveur (contrat 8.1,
 * L49, L50, D79). Le HTTP lui-même est prouvé en e2e (T21, screens.ts, agent E2E) : `expectStatus: 404`.
 *
 * Contrat figé ici, à lire par S0 :
 *  - lib/events/public-status.ts exporte PUBLIC_EVENT_STATUSES (Set ou tableau) et readPublicEventStatus(id) ;
 *  - readPublicEventStatus rend 'NOT_PUBLIC' pour un identifiant non UUID, une ligne absente ou un statut non public
 *    (valeur prise de discovery-8-scan-messages.md, section h ; le contrat ne la fixe pas), jamais pour un statut
 *    public ni pour une erreur de lecture. Elle ne lève pas sur une erreur de lecture : elle journalise (L49) ;
 *  - app/events/[id]/layout.tsx : export par défaut, composant serveur, `{ params: { id }, children }` en Next 14.
 *
 * Rouge aujourd'hui : lib/events/public-status.ts et app/events/[id]/layout.tsx n'existent pas, la route garde sa
 * propre liste PUBLIC_STATUSES, et le after échoue : le schéma du lot n'est pas livré (assertRecetteInvariants).
 * Vert après fix(8.2h) et les migrations du lot.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { notFound } from 'next/navigation';
import { NextRequest } from 'next/server';
import ts from 'typescript';
import { GET as getPublicEvent } from '../../app/api/events/[id]/route';
import { assertRecetteInvariants } from '../helpers/recette-invariants';
import { createEventInStatus, EVENT_STATUSES, type EventStatus } from './cycle-helpers';
import { newPartner } from './finance-helpers';
import { BASE_URL } from './helpers';
import { importModule } from './paiement-helpers';

after(async () => {
    await assertRecetteInvariants('evenement-404');
});

const ROOT = process.cwd();
const LAYOUT = 'app/events/[id]/layout.tsx';
const LAYOUT_MODULE = '../../app/events/[id]/layout';
const PUBLIC_STATUS = 'lib/events/public-status.ts';
const PUBLIC_STATUS_MODULE = '../../lib/events/public-status';
const API_ROUTE = 'app/api/events/[id]/route.ts';
const PAGE = 'app/events/[id]/page.tsx';
const SHEET_READER = 'lib/events/event-detail.server.ts';

const PUBLIC: readonly EventStatus[] = ['PUBLIE', 'SUSPENDU', 'ANNULE', 'TERMINE'];
const NOT_PUBLIC: readonly EventStatus[] = ['BROUILLON', 'EN_ATTENTE', 'VALIDE'];
const NOT_UUID = ['abc', '42', 'not-a-uuid', '00000000-0000-0000-0000-00000000000', `${randomUUID()}x`];

interface PublicStatusModule {
    PUBLIC_EVENT_STATUSES: Iterable<string>;
    readPublicEventStatus: (id: string) => Promise<string>;
}

async function publicStatus(): Promise<PublicStatusModule> {
    assert.ok(fs.existsSync(path.join(ROOT, PUBLIC_STATUS)), `${PUBLIC_STATUS} absent (fix(8.2h))`);
    return (await importModule(PUBLIC_STATUS_MODULE)) as PublicStatusModule;
}

type Layout = (props: { params: { id: string }; children: string }) => Promise<unknown>;

async function layout(): Promise<Layout> {
    assert.ok(fs.existsSync(path.join(ROOT, LAYOUT)), `${LAYOUT} absent (fix(8.2h))`);
    const mod = (await importModule(LAYOUT_MODULE)) as { default?: Layout };
    assert.equal(typeof mod.default, 'function', `${LAYOUT} : pas d'export par défaut`);
    return mod.default!;
}

/**
 * Lot 9 sexies (Next 15 ; modification signalée) : le digest de notFound() est passé de « NEXT_NOT_FOUND » à
 * « NEXT_HTTP_ERROR_FALLBACK;404 ». Il est lu sur le notFound() de la version installée : contrôle aussi strict.
 */
function notFoundDigest(): string {
    try {
        notFound();
    } catch (err) {
        return String((err as { digest?: string }).digest ?? '');
    }
    throw new Error('notFound() n’a rien levé');
}

async function assertNotFound(render: () => Promise<unknown>, what: string): Promise<void> {
    const expected = notFoundDigest();
    assert.ok(expected.length > 0, 'digest de notFound() illisible');
    await assert.rejects(render, (err: { digest?: string }) => err.digest === expected, `${what} : notFound() attendu (digest ${expected})`);
}

function source(rel: string): ts.SourceFile {
    assert.ok(fs.existsSync(path.join(ROOT, rel)), `${rel} absent`);
    const kind = rel.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    return ts.createSourceFile(rel, fs.readFileSync(path.join(ROOT, rel), 'utf8'), ts.ScriptTarget.Latest, true, kind);
}

function directives(sf: ts.SourceFile): string[] {
    const out: string[] = [];
    for (const st of sf.statements) {
        if (!ts.isExpressionStatement(st) || !ts.isStringLiteral(st.expression)) break;
        out.push(st.expression.text);
    }
    return out;
}

function callsOf(sf: ts.SourceFile, name: string): number {
    let count = 0;
    (function visit(n: ts.Node): void {
        if (ts.isCallExpression(n) && n.expression.getText(sf) === name) count++;
        ts.forEachChild(n, visit);
    })(sf);
    return count;
}

function imports(sf: ts.SourceFile, modulePattern: RegExp, name?: string): boolean {
    return sf.statements.some((st) => {
        if (!ts.isImportDeclaration(st) || !ts.isStringLiteral(st.moduleSpecifier) || !modulePattern.test(st.moduleSpecifier.text)) return false;
        if (!name) return true;
        const named = st.importClause?.namedBindings;
        return !!named && ts.isNamedImports(named) && named.elements.some((e) => (e.propertyName ?? e.name).text === name);
    });
}

/** Panne de lecture de events, le temps de `fn` : réponse 500 de PostgREST. */
async function withEventsReadFailure<T>(fn: (hits: () => number) => Promise<T>): Promise<T> {
    const previous = globalThis.fetch;
    let count = 0;
    globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
        if (url.pathname !== '/rest/v1/events') return previous(input, init);
        count++;
        return new Response(JSON.stringify({ message: 'relation "events" SENTINELLE_SECRETE', code: '42P01' }), {
            status: 500,
            headers: { 'content-type': 'application/json' },
        });
    }) as typeof fetch;
    try {
        return await fn(() => count);
    } finally {
        globalThis.fetch = previous;
    }
}

async function withLoggedErrors<T>(fn: () => Promise<T>): Promise<{ result: T; logged: string[] }> {
    const original = console.error;
    const logged: string[] = [];
    console.error = (...args: unknown[]): void => {
        logged.push(args.map(String).join(' '));
    };
    try {
        return { result: await fn(), logged };
    } finally {
        console.error = original;
    }
}

async function apiStatus(id: string): Promise<number> {
    // Lot 9 sexies (Next 15 ; modification signalée) : params arrive en promesse
    const res = await getPublicEvent(new NextRequest(`${BASE_URL}/api/events/${id}`), { params: Promise.resolve({ id }) });
    return res.status;
}

describe('8.2 h — statique : layout serveur, constante partagée, page serveur en cache (design 1b)', () => {
    // Design 1b (point 1, modification signalée) : la fiche est préparée par le serveur et mise en cache 60 s. Le
    // layout garde le vrai 404 (notFound côté serveur) mais lit la fiche publique EN CACHE (readPublicSheet, fondée sur
    // isPublicEvent de lib/events/public-status) : force-dynamic interdirait tout cache. Même exigence de sécurité :
    // non public → 404 sans rien laisser paraître ; panne → jamais un 404 (tests « base locale » ci-dessous, inchangés).
    test('le layout est un composant serveur qui appelle notFound() sur la fiche publique en cache', () => {
        const sf = source(LAYOUT);
        assert.ok(!directives(sf).includes('use client'), `${LAYOUT} : 'use client' interdit, notFound() doit agir côté serveur`);
        assert.ok(callsOf(sf, 'notFound') >= 1, `${LAYOUT} n'appelle pas notFound()`);
        assert.ok(imports(sf, /^next\/navigation$/, 'notFound'), `${LAYOUT} n'importe pas notFound de next/navigation`);
        assert.ok(imports(sf, /lib\/events\/event-detail\.server$/, 'readPublicSheet'), `${LAYOUT} ne lit pas la fiche publique par readPublicSheet`);
        assert.doesNotMatch(sf.text, /export\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]/, `${LAYOUT} : force-dynamic empêcherait le cache de 60 s de la fiche`);
        const reader = source(SHEET_READER);
        assert.ok(imports(reader, /lib\/events\/public-status$/, 'isPublicEvent'), `${SHEET_READER} : la visibilité publique doit venir d'isPublicEvent`);
        assert.ok(imports(reader, /^next\/cache$/, 'unstable_cache'), `${SHEET_READER} : lecture mise en cache (unstable_cache)`);
        assert.match(reader.text, /revalidate:\s*PUBLIC_SHEET_REVALIDATE_SECONDS/, `${SHEET_READER} : durée du cache absente`);
        assert.match(reader.text, /PUBLIC_SHEET_REVALIDATE_SECONDS\s*=\s*60\b/, `${SHEET_READER} : cache de 60 s attendu`);
    });

    test('la fiche partage PUBLIC_EVENT_STATUSES : un seul exemplaire (route et lecture serveur)', () => {
        const route = source(API_ROUTE);
        assert.ok(imports(route, /lib\/events\/event-detail\.server$/, 'buildPublicEventDetail'), `${API_ROUTE} : la route doit servir la fiche de lib/events/event-detail.server (source unique)`);
        for (const file of [API_ROUTE, SHEET_READER]) {
            const sf = source(file);
            const local: string[] = [];
            (function visit(n: ts.Node): void {
                if (ts.isStringLiteral(n) && n.text === 'SUSPENDU' && !ts.isPropertyAssignment(n.parent) && !ts.isBinaryExpression(n.parent)) {
                    local.push(n.parent.getText(sf).slice(0, 80));
                }
                ts.forEachChild(n, visit);
            })(sf);
            assert.deepEqual(local, [], `${file} garde une liste de statuts locale`);
        }
        assert.ok(imports(source(SHEET_READER), /lib\/events\/public-status$/, 'isPublicEvent'), `${SHEET_READER} n'importe pas isPublicEvent (lot 9 ter, R106 a : la constante partagée y est lue)`);
    });

    test('PUBLIC_EVENT_STATUSES : exactement les statuts publics', async () => {
        const { PUBLIC_EVENT_STATUSES } = await publicStatus();
        assert.deepEqual(Array.from(PUBLIC_EVENT_STATUSES).sort(), [...PUBLIC].sort());
    });

    // Design 1b (point 1, modification signalée) : D79 levée par la consigne de l'utilisateur (« pages publiques préparées
    // par le serveur et mises en cache 60 s »). La page devient un composant serveur mis en cache ; elle ne lit aucune
    // session (rien de personnel dans le HTML en cache) et garde son propre notFound() (événement retiré entre le layout
    // et la page).
    test('design 1b : la page est un composant serveur mis en cache 60 s, sans session lue', () => {
        const sf = source(PAGE);
        assert.ok(!directives(sf).includes('use client'), `${PAGE} : composant serveur attendu (pas de 'use client')`);
        assert.match(sf.text, /export\s+const\s+revalidate\s*=\s*60\s*;/, `${PAGE} : export const revalidate = 60 attendu`);
        assert.ok(callsOf(sf, 'notFound') >= 1, `${PAGE} : notFound() attendu pour une fiche non publique`);
        assert.ok(!imports(sf, /^next\/headers$/), `${PAGE} : cookies() ou headers() rendraient la page personnelle (et sans cache)`);
        assert.doesNotMatch(sf.text, /\buseAuth\b|\bgetSession\b|\bcookies\s*\(/, `${PAGE} : aucune session lue dans la page en cache`);
    });
});

describe('8.2 h — readPublicEventStatus et le layout, chaque statut, base locale', () => {
    const byStatus = new Map<EventStatus, string>();

    before(async () => {
        const partner = await newPartner('e404');
        for (const status of EVENT_STATUSES) {
            const ev = await createEventInStatus(
                partner,
                `404 ${status}`,
                [{ name: 'Standard', price: 5000, total: 10 }],
                status,
                status === 'TERMINE' ? { finishShift: { startsInHours: -3 } } : {},
            );
            byStatus.set(status, ev.eventId);
        }
    });

    test('toute l\'énumération est couverte', () => {
        assert.deepEqual([...PUBLIC, ...NOT_PUBLIC].sort(), [...EVENT_STATUSES].sort(), 'statut oublié par cette suite');
    });

    for (const status of NOT_PUBLIC) {
        test(`${status} : NOT_PUBLIC, notFound() au layout, 404 à l'API`, async () => {
            const id = byStatus.get(status)!;
            const { readPublicEventStatus } = await publicStatus();
            assert.equal(await readPublicEventStatus(id), 'NOT_PUBLIC');
            const Layout = await layout();
            await assertNotFound(() => Layout({ params: { id }, children: 'fiche' }), `événement ${status}`);
            assert.equal(await apiStatus(id), 404, `API sur un événement ${status}`);
        });
    }

    for (const status of PUBLIC) {
        test(`${status} : public, page rendue, 200 à l'API`, async () => {
            const id = byStatus.get(status)!;
            const { readPublicEventStatus } = await publicStatus();
            assert.notEqual(await readPublicEventStatus(id), 'NOT_PUBLIC', `événement ${status} jugé non public`);
            const Layout = await layout();
            await assert.doesNotReject(() => Layout({ params: { id }, children: 'fiche' }), `événement ${status} : la page doit s'afficher`);
            assert.equal(await apiStatus(id), 200, `API sur un événement ${status}`);
        });
    }

    test('UUID inconnu : NOT_PUBLIC, notFound()', async () => {
        const id = randomUUID();
        const { readPublicEventStatus } = await publicStatus();
        assert.equal(await readPublicEventStatus(id), 'NOT_PUBLIC');
        const Layout = await layout();
        await assertNotFound(() => Layout({ params: { id }, children: 'fiche' }), 'UUID inconnu');
    });

    for (const id of NOT_UUID) {
        test(`identifiant non UUID « ${id} » : NOT_PUBLIC sans lecture en base, notFound()`, async () => {
            const { readPublicEventStatus } = await publicStatus();
            const Layout = await layout();
            await withEventsReadFailure(async (hits) => {
                assert.equal(await readPublicEventStatus(id), 'NOT_PUBLIC', 'un identifiant illisible ne doit pas passer pour une erreur de lecture (22P02)');
                await assertNotFound(() => Layout({ params: { id }, children: 'fiche' }), `identifiant « ${id} »`);
                assert.equal(hits(), 0, 'requête envoyée à la base pour un identifiant non UUID');
            });
        });
    }

    test('erreur de lecture (L49) : ni exception ni notFound(), journal, page rendue', async () => {
        const id = byStatus.get('BROUILLON')!;
        const { readPublicEventStatus } = await publicStatus();
        const Layout = await layout();
        await withEventsReadFailure(async (hits) => {
            const read = await withLoggedErrors(() => readPublicEventStatus(id));
            assert.ok(hits() >= 1, 'la panne simulée n\'a pas été atteinte');
            assert.notEqual(read.result, 'NOT_PUBLIC', 'une panne de lecture ne doit pas se présenter en 404');
            assert.ok(read.logged.length >= 1, 'erreur de lecture non journalisée');
            await withLoggedErrors(() => assert.doesNotReject(() => Layout({ params: { id }, children: 'fiche' }), 'panne de lecture : la page s\'affiche, l\'API reste protectrice'));
        });
    });
});
