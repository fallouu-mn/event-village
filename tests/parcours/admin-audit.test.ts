/**
 * Lot 8, tâche 8.3 d, anomalie A13 (contrat 13.4 ; CDC §134) — journal d'activité : GET /api/admin/audit n'avait aucun
 * test, et app/admin/audit/page.tsx:47-50 affiche « Aucun enregistrement » quand la lecture échoue.
 *  1. droits : 401 sans session ; 403 client, partenaire, contrôleur ; 403 ADMIN SUSPENDU ; 200 ADMIN et SUPERADMIN ;
 *     une tentative refusée est elle-même tracée dans le journal ;
 *  2. filtres action, objectType, userRole, valeur ALL, limit, ordre du plus récent au plus ancien ;
 *  3. champs de §134 servis par l'API (utilisateur, rôle, date et heure, action, objet, ancienne et nouvelle valeur) ;
 *  4. statique : ErrorState avec relance sur erreur, jamais la liste vide ; colonne Utilisateur.
 *
 * Rouge avant correctif (fix(8.3-A13), E2) : le point 4 (ErrorState absent, échec silencieux, utilisateur affiché nulle
 * part dans la page). Verts dès l'écriture (couverture ajoutée, signalés) : les points 1, 2 et 3, la route n'est pas
 * changée par le lot ; leur garde-fou est leur comparaison exacte sur des lignes marquées par la suite.
 * Écart : « statut » (§134) n'est pas une colonne de audit_logs, il ne peut donc pas être contrôlé ici (signalé au
 * rapport). Après la suite : assertRecetteInvariants, car la suite écrit et reste rouge jusqu'au correctif.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import ts from 'typescript';
import { GET as auditRoute } from '../../app/api/admin/audit/route';
import { bearer, signInAs } from '../helpers/fixtures';
import { assertRecetteInvariants } from '../helpers/recette-invariants';
import { type RouteResult } from './acces-helpers';
import { BASE_URL } from './helpers';
import { newBuyer, service } from './paiement-helpers';
import { newAdminWith } from './terrain-helpers';

type Row = Record<string, unknown>;

const PAGE = 'app/admin/audit/page.tsx';

const RUN = randomUUID().slice(0, 8).toUpperCase();
const ACTION = `TEST_AUDIT_${RUN}`;
const OTHER_ACTION = `TEST_AUTRE_${RUN}`;
const OBJECT_A = `test_objet_a_${RUN}`;
const OBJECT_B = `test_objet_b_${RUN}`;
const ROLE_A = `ROLE_A_${RUN}`;
const ROLE_B = `ROLE_B_${RUN}`;

/** Lignes de la suite, de la plus ancienne à la plus récente. */
const ids: Record<'first' | 'second' | 'third' | 'other', string> = { first: '', second: '', third: '', other: '' };
let actorId: string;
let objectId: string;

const createdAccounts: string[] = [];

async function writeRows(): Promise<void> {
    const actor = await newBuyer('audit-acteur');
    actorId = actor.userId;
    objectId = randomUUID();
    const base = Date.now() - 60_000;
    const row = (action: string, objectType: string, role: string, shift: number): Row => ({
        user_id: actorId, user_role: role, action, object_type: objectType, object_id: objectId,
        old_value: { statut: 'AVANT', rang: shift }, new_value: { statut: 'APRES', rang: shift },
        metadata: { suite: 'admin-audit', run: RUN },
        created_at: new Date(base + shift * 1000).toISOString(),
    });
    const { data, error } = await service.from('audit_logs').insert([
        row(ACTION, OBJECT_A, ROLE_A, 0),
        row(ACTION, OBJECT_B, ROLE_A, 1),
        row(ACTION, OBJECT_A, ROLE_B, 2),
        row(OTHER_ACTION, OBJECT_A, ROLE_A, 3),
    ]).select('id, action, object_type, user_role');
    assert.equal(error, null, `lignes du journal : ${error?.message}`);
    const find = (action: string, object: string, role: string): string => {
        const found = (data ?? []).find((d) => d.action === action && d.object_type === object && d.user_role === role);
        assert.ok(found, `ligne ${action} ${object} ${role} non écrite`);
        return String(found.id);
    };
    ids.first = find(ACTION, OBJECT_A, ROLE_A);
    ids.second = find(ACTION, OBJECT_B, ROLE_A);
    ids.third = find(ACTION, OBJECT_A, ROLE_B);
    ids.other = find(OTHER_ACTION, OBJECT_A, ROLE_A);
}

async function audit(token: string | null, query = ''): Promise<RouteResult> {
    const res = await auditRoute(new NextRequest(`${BASE_URL}/api/admin/audit${query}`, { method: 'GET', headers: token ? bearer(token) : {} }));
    return { status: res.status, body: await res.json() as Row };
}

function show(r: RouteResult): string {
    return `HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 500)}`;
}

function logIds(r: RouteResult): string[] {
    assert.equal(r.status, 200, show(r));
    assert.ok(Array.isArray(r.body.logs), `logs : ${show(r)}`);
    assert.equal(r.body.total, (r.body.logs as Row[]).length, `total : ${show(r)}`);
    return (r.body.logs as Row[]).map((l) => String(l.id));
}

after(async () => {
    if (createdAccounts.length > 0) {
        const { error } = await service.from('users').update({ status: 'SUSPENDU' }).in('id', createdAccounts).eq('status', 'ACTIF');
        assert.equal(error, null, `suspension des comptes de la suite : ${error?.message}`);
    }
    await assertRecetteInvariants('admin-audit');
});

// ── 1. Droits (verts dès l'écriture) ───────────────────────────────────────

describe('A13 — GET /api/admin/audit : droits', () => {
    test('sans session 401 ; partenaire et contrôleur 403 ; ADMIN et SUPERADMIN 200', async () => {
        const anonymous = await audit(null);
        assert.equal(anonymous.status, 401, `sans session : ${show(anonymous)}`);
        assert.equal(anonymous.body.logs, undefined, 'aucune ligne sans session');

        for (const key of ['PARTNER_A', 'CONTROLLER_A'] as const) {
            const user = await signInAs(key);
            const r = await audit(user.accessToken);
            assert.equal(r.status, 403, `${key} : ${show(r)}`);
            assert.equal(r.body.logs, undefined, `${key} : aucune ligne`);
        }

        for (const key of ['ADMIN', 'SUPERADMIN'] as const) {
            const user = await signInAs(key);
            const r = await audit(user.accessToken, '?limit=1');
            assert.equal(r.status, 200, `${key} : ${show(r)}`);
            assert.equal(r.body.success, true, `${key} : ${show(r)}`);
        }
    });

    test('client : 403, et la tentative est tracée dans le journal', async () => {
        const client = await newBuyer('audit-client');
        const r = await audit(client.accessToken);
        assert.equal(r.status, 403, show(r));
        assert.equal(r.body.logs, undefined, 'aucune ligne');
        const { data, error } = await service.from('audit_logs').select('object_type, metadata')
            .eq('user_id', client.userId).eq('action', 'UNAUTHORIZED_ACCESS_ATTEMPT');
        assert.equal(error, null, `tentatives : ${error?.message}`);
        assert.equal(data?.length, 1, 'une tentative tracée');
        assert.equal(data![0].object_type, 'admin_api');
        assert.equal((data![0].metadata as Row).path, '/api/admin/audit');
    });

    test('ADMIN SUSPENDU : 403 ACCOUNT_NOT_ACTIVE', async () => {
        const admin = await newAdminWith(['users.read'], { label: 'audit-suspendu' });
        createdAccounts.push(admin.userId);
        const { error } = await service.from('users').update({ status: 'SUSPENDU' }).eq('id', admin.userId);
        assert.equal(error, null, `suspension : ${error?.message}`);
        const r = await audit(admin.accessToken);
        assert.equal(r.status, 403, show(r));
        assert.equal(r.body.code, 'ACCOUNT_NOT_ACTIVE', show(r));
    });
});

// ── 2 et 3. Filtres et champs (verts dès l'écriture) ───────────────────────

describe('A13 — GET /api/admin/audit : filtres et champs de §134', () => {
    let token: string;

    before(async () => {
        await writeRows();
        token = (await signInAs('SUPERADMIN')).accessToken;
    });

    test('action : exactement les lignes de cette action, de la plus récente à la plus ancienne', async () => {
        assert.deepEqual(logIds(await audit(token, `?action=${ACTION}`)), [ids.third, ids.second, ids.first]);
        assert.deepEqual(logIds(await audit(token, `?action=${OTHER_ACTION}`)), [ids.other]);
    });

    test('objectType et userRole, seuls et combinés', async () => {
        assert.deepEqual(logIds(await audit(token, `?objectType=${OBJECT_B}`)), [ids.second]);
        assert.deepEqual(logIds(await audit(token, `?objectType=${OBJECT_A}`)), [ids.other, ids.third, ids.first]);
        assert.deepEqual(logIds(await audit(token, `?userRole=${ROLE_B}`)), [ids.third]);
        assert.deepEqual(logIds(await audit(token, `?action=${ACTION}&objectType=${OBJECT_A}`)), [ids.third, ids.first]);
        assert.deepEqual(logIds(await audit(token, `?action=${ACTION}&objectType=${OBJECT_A}&userRole=${ROLE_A}`)), [ids.first]);
    });

    test('ALL n’est pas un filtre ; une valeur inconnue ne rend rien ; limit coupe aux plus récentes', async () => {
        assert.deepEqual(logIds(await audit(token, `?action=ALL&objectType=${OBJECT_B}&userRole=ALL`)), [ids.second]);
        assert.deepEqual(logIds(await audit(token, `?action=TEST_INCONNUE_${RUN}`)), []);
        assert.deepEqual(logIds(await audit(token, `?action=${ACTION}&limit=2`)), [ids.third, ids.second]);
    });

    test('chaque ligne porte utilisateur, rôle, date et heure, action, objet, ancienne et nouvelle valeur', async () => {
        const r = await audit(token, `?action=${OTHER_ACTION}`);
        logIds(r);
        const [log] = r.body.logs as Row[];
        assert.equal(log.user_id, actorId, 'utilisateur');
        assert.equal(log.user_role, ROLE_A, 'rôle');
        assert.equal(log.action, OTHER_ACTION, 'action');
        assert.equal(log.object_type, OBJECT_A, 'objet');
        assert.equal(log.object_id, objectId, 'identifiant de l’objet');
        assert.deepEqual(log.old_value, { statut: 'AVANT', rang: 3 }, 'ancienne valeur');
        assert.deepEqual(log.new_value, { statut: 'APRES', rang: 3 }, 'nouvelle valeur');
        assert.ok(Number.isFinite(new Date(String(log.created_at)).getTime()), `date et heure : ${String(log.created_at)}`);
        assert.match(String(log.created_at), /T\d{2}:\d{2}:\d{2}/, 'la date porte l’heure');
    });
});

// ── 4. Écran (statique) ────────────────────────────────────────────────────

const source = ts.createSourceFile(PAGE, fs.readFileSync(path.join(process.cwd(), ...PAGE.split('/')), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const printer = ts.createPrinter({ removeComments: true });

function code(node: ts.Node): string {
    return printer.printNode(ts.EmitHint.Unspecified, node, source);
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

function tagIs(n: ts.Node, name: string): boolean {
    return (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) && n.tagName.getText() === name;
}

function errorStates(): ts.Node[] {
    return nodesOf(source, (n) => tagIs(n, 'ErrorState'));
}

/** Identifiants qui conditionnent l'affichage de `node` : `cond ? <X/> : …`, `cond && <X/>`, `if (cond) return <X/>`. */
function gates(node: ts.Node): string[] {
    const out = new Set<string>();
    const collect = (cond: ts.Expression): void => {
        for (const id of nodesOf(cond, ts.isIdentifier)) out.add((id as ts.Identifier).text);
    };
    for (let p: ts.Node | undefined = node.parent; p; p = p.parent) {
        if (ts.isConditionalExpression(p)) collect(p.condition);
        else if (ts.isBinaryExpression(p) && p.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) collect(p.left);
        else if (ts.isIfStatement(p)) collect(p.expression);
    }
    return Array.from(out);
}

function stateSetter(name: string): string {
    return `set${name[0].toUpperCase()}${name.slice(1)}`;
}

function setterCalls(root: ts.Node, setters: string[]): number {
    return nodesOf(root, (n) => ts.isCallExpression(n) && ts.isIdentifier(n.expression) && setters.includes(n.expression.text)).length;
}

describe('A13 — /admin/audit : une erreur n’est pas une liste vide (statique)', () => {
    test('ErrorState importé du système de design et rendu avec relance', () => {
        const imports = nodesOf(source, (n) => ts.isImportDeclaration(n) && (n.moduleSpecifier as ts.StringLiteral).text === '@/components/ui/EmptyState' && /\bErrorState\b/.test(code(n)));
        assert.equal(imports.length, 1, `${PAGE} n'importe pas ErrorState de @/components/ui/EmptyState`);
        const states = errorStates();
        assert.ok(states.length >= 1, `${PAGE} ne rend pas <ErrorState />`);
        assert.ok(states.every((s) => /onRetry=/.test(code(s))), 'ErrorState sans onRetry : l’administrateur doit pouvoir relancer');
    });

    test('la lecture échouée passe par l’état d’erreur, pour un refus HTTP comme pour une panne réseau', () => {
        const usesHook = nodesOf(source, (n) => ts.isCallExpression(n) && n.expression.getText() === 'useServerData').length > 0;
        if (usesHook) return; // useServerData (components/partner) couvre les deux cas et rend `error` (SalesTab.tsx).
        const [state] = errorStates();
        assert.ok(state, `${PAGE} ne rend pas <ErrorState />`);
        const setters = gates(state).filter((g) => !['isLoading', 'logs', 'length'].includes(g)).map(stateSetter);
        assert.ok(setters.length > 0, 'ErrorState rendu sans condition sur une erreur');
        const fetcher = nodesOf(source, (n) => (ts.isArrowFunction(n) || ts.isFunctionExpression(n) || ts.isFunctionDeclaration(n)) && /\/api\/admin\/audit/.test(code(n))).pop();
        assert.ok(fetcher, `${PAGE} : lecture de /api/admin/audit introuvable`);
        const catches = nodesOf(fetcher, ts.isCatchClause);
        assert.ok(catches.some((c) => setterCalls(c, setters) >= 1), `panne réseau sans passage à l'état d'erreur (attendu : ${setters.join(' ou ')})`);
        const tryBlocks = nodesOf(fetcher, ts.isTryStatement) as ts.TryStatement[];
        assert.ok(tryBlocks.some((t) => setterCalls(t.tryBlock, setters) >= 1 || /throw /.test(code(t.tryBlock))), 'réponse HTTP en échec non traitée : !res.ok doit mener à l’état d’erreur');
    });

    test('« Aucun enregistrement » n’est jamais affiché quand la lecture a échoué', () => {
        const [state] = errorStates();
        assert.ok(state, `${PAGE} ne rend pas <ErrorState />`);
        const empty = nodesOf(source, (n) => ts.isJsxText(n) && /Aucun enregistrement/.test(n.text));
        assert.equal(empty.length, 1, 'message de liste vide introuvable');
        assert.ok(state.getStart(source) < empty[0].getStart(source), 'la branche d’erreur doit passer avant celle de la liste vide');
    });

    test('la colonne Utilisateur de §134 est affichée', () => {
        const headers = nodesOf(source, (n) => ts.isJsxElement(n) && n.openingElement.tagName.getText() === 'th').map((n) => code(n));
        assert.ok(headers.length >= 5, `en-têtes du tableau : ${headers.length}`);
        assert.ok(headers.some((h) => /Utilisateur/.test(h)), `${PAGE} : aucune colonne Utilisateur (§134), user_id n'est affiché nulle part`);
        const cells = nodesOf(source, ts.isJsxExpression);
        assert.ok(cells.some((c) => /\blog\.(?:user_(?!role\b)\w+|users?\b|actor\w*)/.test(code(c))), 'l’utilisateur de la ligne n’est pas affiché');
    });

    test('garde-fou : date et heure, rôle, action, objet, ancienne et nouvelle valeur restent affichés', () => {
        const text = code(source.statements[source.statements.length - 1]);
        for (const needle of ['log.created_at', 'log.user_role', 'log.action', 'log.object_type', 'selectedLog.old_value', 'selectedLog.new_value']) {
            assert.ok(text.includes(needle), `${PAGE} : ${needle} n'est plus affiché`);
        }
        assert.match(text, /hour:\s*['"]2-digit['"]/, 'l’heure reste affichée');
    });
});
