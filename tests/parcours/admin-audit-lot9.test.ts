/**
 * Lot 9, tâche 9.3, A24, A25, A38 (contrat 4.4, 5.4, L37, L38, AR10) — GET /api/admin/audit.
 *  - A24 : réservé au SUPERADMIN, comme la RLS (M/0003_rls.sql:355). Un ADMIN reçoit 403, sans ligne au journal (il
 *    n'a pas tenté d'entrer dans l'administration : verifyAdminAuth ne trace que les non-admins). La page dit
 *    « Réservé au superadmin » (EmptyState, sans ErrorState : admin-audit.test.ts:251 exige onRetry), et les liens vers
 *    /admin/audit disparaissent pour un ADMIN (AR10).
 *  - A25 : limit borné, valeur hors bornes = 50, plafond 100 ; prouvé par le paramètre envoyé à PostgREST.
 *  - A38 : actor_name et actor_role aplatis (jointure côté serveur), actor retiré, user_id et user_role gardés.
 *
 * Rouge avant correctif : ADMIN 200 (A24) ; limit transmis tel quel, NaN ou négatif rejetés par PostgREST en 500 (A25) ;
 * ni actor_name ni actor_role (A38) ; écrans sans cas 403, liens visibles. after() : assertLot9Invariants, rouge
 * jusqu'à M2 et M4.
 * Verts dès l'écriture (témoins, signalés) : SUPERADMIN 200 ; limit absent, 7 et 100 ; identifiant de la modale.
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
import { assertLot9Invariants } from '../helpers/lot9-invariants';
import { BASE_URL } from './helpers';
import { reply, type Reply } from './panne-helpers';
import { newBuyer, service, type Buyer } from './paiement-helpers';
import { newAdminWith } from './terrain-helpers';

type Row = Record<string, unknown>;

const PAGE = 'app/admin/audit/page.tsx';
const LAYOUT = 'components/layout/AppLayout.tsx';
const DASHBOARD = 'app/admin/dashboard/page.tsx';
const AUDIT_HREF = '/admin/audit';
const RUN = randomUUID().slice(0, 8).toUpperCase();
const ACTION = `TEST_AUDIT_LOT9_${RUN}`;
const ROLE_THEN = `ROLE_ALORS_${RUN}`;

after(async () => {
    await assertLot9Invariants('admin-audit-lot9');
});

async function audit(token: string, query = ''): Promise<Reply> {
    return reply(await auditRoute(new NextRequest(`${BASE_URL}/api/admin/audit${query}`, { method: 'GET', headers: bearer(token) })));
}

function show(r: Reply): string {
    return `HTTP ${r.status} ${r.text.slice(0, 400)}`;
}

/** Appelle la route et rend, avec la réponse, le paramètre `limit` envoyé à PostgREST pour audit_logs. */
async function auditLimit(token: string, query: string): Promise<{ r: Reply; limits: Array<string | null> }> {
    const previous = globalThis.fetch;
    const limits: Array<string | null> = [];
    globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
        const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        const url = new URL(href);
        if (url.pathname === '/rest/v1/audit_logs') limits.push(url.searchParams.get('limit'));
        return previous(input, init);
    }) as typeof fetch;
    try {
        return { r: await audit(token, query), limits };
    } finally {
        globalThis.fetch = previous;
    }
}

let superadminToken: string;

before(async () => {
    superadminToken = (await signInAs('SUPERADMIN')).accessToken;
});

describe('A24 — le journal est réservé au SUPERADMIN', () => {
    test('ADMIN avec permissions : 403, aucune ligne servie, tentative non journalisée', async () => {
        const admin = await newAdminWith(['users.read', 'statistics.read'], { label: 'audit9-admin' });
        const r = await audit(admin.accessToken);
        assert.equal(r.status, 403, show(r));
        assert.equal(r.body.logs, undefined, `aucune ligne pour un ADMIN : ${show(r)}`);
        const { count, error } = await service.from('audit_logs').select('id', { count: 'exact', head: true })
            .eq('user_id', admin.userId).eq('action', 'UNAUTHORIZED_ACCESS_ATTEMPT');
        assert.equal(error, null, `journal : ${error?.message}`);
        assert.equal(count, 0, 'un ADMIN n’est pas un intrus : aucune tentative journalisée');
    });

    test('témoin : SUPERADMIN 200, liste servie (vert dès l’écriture)', async () => {
        const r = await audit(superadminToken, '?limit=1');
        assert.equal(r.status, 200, show(r));
        assert.equal(r.body.success, true, show(r));
        assert.ok(Array.isArray(r.body.logs), `logs : ${show(r)}`);
    });
});

describe('A25 — limit borné : 100 au plus, 50 par défaut', () => {
    const cases: ReadonlyArray<[string, string, string]> = [
        ['limit=500 : plafonné à 100', '?limit=500', '100'],
        ['limit=abc : 50', '?limit=abc', '50'],
        ['limit=0 : 50', '?limit=0', '50'],
        ['limit=-1 : 50', '?limit=-1', '50'],
        ['limit absent : 50 (témoin, vert dès l’écriture)', '', '50'],
        ['limit=7 : 7 (témoin, vert dès l’écriture)', '?limit=7', '7'],
        ['limit=100 : 100 (témoin, vert dès l’écriture)', '?limit=100', '100'],
    ];
    for (const [title, query, expected] of cases) {
        test(title, async () => {
            const { r, limits } = await auditLimit(superadminToken, query);
            assert.equal(r.status, 200, show(r));
            assert.deepEqual(limits, [expected], `paramètre limit envoyé à PostgREST : ${JSON.stringify(limits)}, attendu ${expected}`);
        });
    }
});

describe('A38 — colonne Utilisateur : nom et rôle par jointure côté serveur', () => {
    let actor: Buyer;
    let actorRow: Row;
    let systemRow: Row;

    before(async () => {
        actor = await newBuyer('audit9-acteur', { firstName: 'Khady', lastName: 'Diop' });
        const { error } = await service.from('audit_logs').insert([
            { user_id: actor.userId, user_role: ROLE_THEN, action: ACTION, object_type: 'test_objet', metadata: { rang: 1 } },
            { user_id: null, user_role: 'SYSTEM', action: ACTION, object_type: 'test_objet', metadata: { rang: 2 } },
        ]);
        assert.equal(error, null, `lignes du journal : ${error?.message}`);
        const r = await audit(superadminToken, `?action=${ACTION}`);
        assert.equal(r.status, 200, show(r));
        const logs = r.body.logs as Row[];
        assert.equal(logs.length, 2, `deux lignes attendues : ${show(r)}`);
        actorRow = logs.find((l) => l.user_id === actor.userId)!;
        systemRow = logs.find((l) => l.user_id === null)!;
        assert.ok(actorRow && systemRow, 'les deux lignes de la suite');
    });

    test('compte connu : actor_name « Prénom Nom », actor_role = rôle courant', () => {
        assert.equal(actorRow.actor_name, 'Khady Diop');
        assert.equal(actorRow.actor_role, 'CLIENT', 'actor_role = rôle courant du compte, pas le rôle de la ligne');
    });

    test('la jointure brute ne sort pas : plus de clé actor', () => {
        assert.ok(!('actor' in actorRow), `clé actor servie : ${JSON.stringify(actorRow).slice(0, 300)}`);
    });

    test('compte connu : user_id et user_role au moment de l’action restent servis', () => {
        assert.equal(actorRow.user_id, actor.userId);
        assert.equal(actorRow.user_role, ROLE_THEN, 'la colonne Rôle reste le rôle au moment de l’action');
    });

    test('ligne système (user_id nul) : actor_name et actor_role nuls', () => {
        assert.ok('actor_name' in systemRow, `actor_name absent : ${JSON.stringify(systemRow).slice(0, 300)}`);
        assert.equal(systemRow.actor_name, null, 'actor_name nul sans compte');
        assert.equal(systemRow.actor_role, null, 'actor_role nul sans compte');
    });
});

// ── Écrans (statique) ──────────────────────────────────────────────────────

function parsed(rel: string): ts.SourceFile {
    return ts.createSourceFile(rel, fs.readFileSync(path.join(process.cwd(), ...rel.split('/')), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
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

function isHrefLiteral(init: ts.Node | undefined): boolean {
    return init !== undefined && ts.isStringLiteralLike(init) && init.text === AUDIT_HREF;
}

/** Conditions qui gardent l'affichage de `node` : condition d'un ternaire, gauche d'un &&, condition d'un if. */
function gates(node: ts.Node, sf: ts.SourceFile): string[] {
    const out: string[] = [];
    for (let child = node, p: ts.Node | undefined = node.parent; p; child = p, p = p.parent) {
        if (ts.isConditionalExpression(p) && child !== p.condition) out.push(p.condition.getText(sf));
        else if (ts.isBinaryExpression(p) && p.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken && child === p.right) out.push(p.left.getText(sf));
        else if (ts.isIfStatement(p) && child !== p.expression) out.push(p.expression.getText(sf));
    }
    return out;
}

function insideDeclaration(node: ts.Node, name: string): boolean {
    for (let p: ts.Node | undefined = node.parent; p; p = p.parent) {
        if (ts.isVariableDeclaration(p) && p.name.getText() === name) return true;
    }
    return false;
}

describe('A24, A38 — écrans (statique)', () => {
    const page = parsed(PAGE);
    const pageText = page.getFullText();

    test('A24 : la page distingue le refus 403 et affiche « Réservé au superadmin » sans bouton Réessayer', () => {
        assert.match(pageText, /\.status\s*===\s*403/, `${PAGE} : le refus 403 n'est pas distingué d'une panne`);
        const states = nodesOf(page, (n) => (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) && n.tagName.getText(page) === 'EmptyState');
        const reserved = states.filter((n) => /Réservé au superadmin/.test(n.getText(page)) || /Réservé au superadmin/.test(n.parent.getText(page)));
        assert.equal(reserved.length, 1, `${PAGE} : un EmptyState « Réservé au superadmin » attendu`);
        assert.doesNotMatch(reserved[0].getText(page), /onRetry=/, 'pas de relance pour un refus de droits');
    });

    test('A38 : la cellule Utilisateur affiche le nom (Système sinon) et le rôle courant, jamais l’identifiant', () => {
        assert.match(pageText, /log\.actor_name\s*\?\?\s*['"]Système['"]/, `${PAGE} : actor_name ?? 'Système' attendu dans la cellule`);
        assert.match(pageText, /\blog\.actor_role\b/, `${PAGE} : rôle courant absent de la cellule`);
        const shown = nodesOf(page, (n) => ts.isJsxExpression(n) && ts.isJsxElement(n.parent) && /\blog\.user_id\b/.test(n.getText(page)));
        assert.equal(shown.length, 0, `${PAGE} : l'identifiant ne doit plus être affiché en clair dans le tableau`);
    });

    test('A38 : témoin, l’identifiant reste dans la modale (vert dès l’écriture)', () => {
        assert.match(pageText, /selectedLog\.user_id/, `${PAGE} : identifiant retiré de la modale`);
    });

    test('A24, AR10 : la barre latérale et le groupe Système masquent le lien pour un ADMIN', () => {
        const layout = parsed(LAYOUT);
        const items = nodesOf(layout, (n) => ts.isPropertyAssignment(n) && n.name.getText(layout) === 'href' && isHrefLiteral(n.initializer))
            .filter((n) => !insideDeclaration(n, 'adminMobileItems'));
        assert.ok(items.length >= 2, `${LAYOUT} : liens vers ${AUDIT_HREF} introuvables`);
        for (const item of items) {
            assert.ok(gates(item, layout).some((g) => /\bisSuperAdmin\b/.test(g)), `${LAYOUT} : lien vers ${AUDIT_HREF} non conditionné à isSuperAdmin (${gates(item, layout).join(' ; ')})`);
        }
    });

    test('A24, AR10 : la barre du bas filtre à l’usage, le littéral garde ses 5 objets (notif-interface:956)', () => {
        const text = parsed(LAYOUT).getFullText();
        assert.match(text, /href\s*!==?\s*['"]\/admin\/audit['"]\s*\|\|\s*isSuperAdmin/, `${LAYOUT} : filtre attendu sur adminMobileItems`);
    });

    test('A24, AR10 : le raccourci du tableau de bord est réservé au SUPERADMIN', () => {
        const dash = parsed(DASHBOARD);
        const links = nodesOf(dash, (n) => (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n))
            && n.attributes.properties.some((a) => ts.isJsxAttribute(a) && a.name.getText(dash) === 'href' && isHrefLiteral(a.initializer)));
        assert.equal(links.length, 1, `${DASHBOARD} : un raccourci vers ${AUDIT_HREF} attendu`);
        const conditions = gates(links[0], dash);
        assert.ok(conditions.some((g) => /hasRole\(\s*['"]SUPERADMIN['"]\s*\)|\bisSuperAdmin\b/.test(g)), `${DASHBOARD} : raccourci non conditionné au rôle SUPERADMIN (${conditions.join(' ; ')})`);
    });
});
