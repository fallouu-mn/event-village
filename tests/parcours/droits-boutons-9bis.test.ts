/**
 * Lot 9 bis, tâche 12 (R51 ; contrat 5.12, B34, 4.2) — les boutons sans permission sont masqués ; un refus éventuel
 * s'affiche en français.
 *  - event_actions (M08) : un admin events.read seul lit la fiche mais ne reçoit ni `can_cancel` ni action ADMIN ;
 *    events.write les reçoit (témoin) ;
 *  - GET /api/auth/me sert `admin_permissions` : les lignes d'un ADMIN, la liste complète pour un SUPERADMIN ;
 *  - refus d'une route admin : 403 `{ error, code: 'PERMISSION_MISSING', permission }`, texte « Action non autorisée :
 *    votre compte n’a pas la permission « {libellé} ». », sans le code brut (verifyAdminAuth, partners/[id]/status,
 *    notifications/[id]/retry) ;
 *  - statique (patron tests/helpers/design-files.ts, commentaires exclus) : AuthProvider expose `hasPermission` ;
 *    users, dashboard et fiche événement de l'admin conditionnent leurs boutons par `hasPermission` ; « Modifier » des
 *    réglages financiers est réservé au SUPERADMIN ; aucune page app/admin/** n'affiche un code de permission brut
 *    (`{perm}`, app/admin/users/page.tsx:752).
 *
 * Rouge avant correctif (fix(9b.12), fix(9b.12-SC), écrans E-B et E-V) : event_actions rend `can_cancel` sans
 * condition d'acteur et les actions ADMIN à tout admin (M/20261102000003:514, :544) ; /api/auth/me ne rend que les
 * rôles ; les refus disent « Permission manquante : {code} » (lib/admin/admin-auth.ts:206) ; aucun `hasPermission`.
 * Écart signalé : le contrat dit « les 17 » permissions du SUPERADMIN, ADMIN_PERMISSIONS en compte 16 aujourd'hui
 * (lib/admin/admin-auth.ts:22-41) : le test compare à ADMIN_PERMISSIONS, quelle que soit sa longueur.
 * Fin de suite : assertLot9bisInvariants.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import ts from 'typescript';
import { ADMIN_PERMISSIONS } from '../../lib/admin/admin-auth';
import { assertLot9bisInvariants } from '../helpers/lot9bis-invariants';
import { newBuyer, service } from './paiement-helpers';
import { jsonRequest, newPartner, type TestPartner } from './finance-helpers';
import type { RouteResult } from './acces-helpers';
import { createEventInStatus, type DraftEvent } from './cycle-helpers';
import { invoke, routeHandler, show } from './pilotage-helpers';
import { newAdminWith } from './terrain-helpers';

after(async () => {
    await assertLot9bisInvariants('droits-boutons-9bis');
});

type Row = Record<string, unknown>;

const ADMIN_ONLY_TARGETS = ['SUSPENDU', 'TERMINE', 'VALIDE'];
const REFUSAL_TEXT = /^Action non autorisée : votre compte n[’']a pas la permission « [^«»]+ »\.$/;

let partner: TestPartner;
let ev: DraftEvent;

function ctx(params: Record<string, string>): { params: Promise<Record<string, string>> & Record<string, string> } {
    return { params: Object.assign(Promise.resolve(params), params) };
}

async function eventActions(actorId: string): Promise<Row> {
    const { data, error } = await service.rpc('event_actions', { p: { event_id: ev.eventId, actor_id: actorId } });
    assert.equal(error, null, `event_actions : ${error?.message}`);
    return data as Row;
}

function targets(body: Row): string[] {
    return (Array.isArray(body.actions) ? body.actions as Row[] : []).map((a) => String(a.to));
}

function assertFrenchRefusal(res: RouteResult, permission: string, what: string): void {
    assert.equal(res.status, 403, `${what} : 403 attendu, ${show(res)}`);
    assert.equal(res.body.code, 'PERMISSION_MISSING', `R51 : ${what} : code PERMISSION_MISSING, ${show(res)}`);
    assert.equal(res.body.permission, permission, `${what} : permission manquante nommée dans le corps, ${show(res)}`);
    const text = String(res.body.error ?? '');
    assert.match(text, REFUSAL_TEXT, `R51 : ${what} : texte du contrat 4.2, ${show(res)}`);
    assert.ok(!text.includes(permission), `R51 : ${what} : le code brut ${permission} n’apparaît pas dans le texte, ${show(res)}`);
}

describe('R51 — event_actions : boutons de la fiche admin selon la permission', () => {
    before(async () => {
        partner = await newPartner('r51');
        ev = await createEventInStatus(partner, 'r51-boutons', [{ name: 'Standard', price: 2_000, total: 10 }], 'PUBLIE', { startsInHours: 72 });
    });

    test('admin events.read seul : réponse servie, can_cancel = false et aucune action réservée à l’admin', async () => {
        const reader = await newAdminWith(['events.read'], { label: 'r51-lecture' });
        const body = await eventActions(reader.userId);
        assert.equal(body.ok, true, `lecture de la fiche par un admin events.read : ${JSON.stringify(body)}`);
        assert.equal(body.can_cancel, false, `R51 : « Annuler » masqué sans events.write : ${JSON.stringify(body)}`);
        const admins = targets(body).filter((t) => ADMIN_ONLY_TARGETS.includes(t));
        assert.deepEqual(admins, [], `R51 : aucune action ADMIN sans events.write : ${JSON.stringify(body.actions)}`);
    });

    test('témoin : admin events.write → can_cancel = true et action SUSPENDU proposée', async () => {
        const writer = await newAdminWith(['events.write'], { label: 'r51-ecriture' });
        const body = await eventActions(writer.userId);
        assert.equal(body.ok, true, JSON.stringify(body));
        assert.equal(body.can_cancel, true, JSON.stringify(body));
        assert.ok(targets(body).includes('SUSPENDU'), `action SUSPENDU : ${JSON.stringify(body.actions)}`);
    });
});

describe('R51 — GET /api/auth/me sert admin_permissions', () => {
    async function me(token: string): Promise<RouteResult> {
        const handler = await routeHandler('../../app/api/auth/me/route', 'GET', 'GET /api/auth/me');
        return invoke(handler, jsonRequest('/api/auth/me', 'GET', token));
    }

    test('ADMIN : ses lignes ; SUPERADMIN : toutes les permissions ; client : aucune', async () => {
        const admin = await newAdminWith(['refunds.manage', 'events.read'], { label: 'r51-me' });
        const a = await me(admin.accessToken);
        assert.equal(a.status, 200, show(a));
        assert.ok(Array.isArray(a.body.admin_permissions), `R51 : admin_permissions absent de /api/auth/me : ${show(a)}`);
        assert.deepEqual([...(a.body.admin_permissions as string[])].sort(), ['events.read', 'refunds.manage']);

        const superadmin = await newAdminWith([], { role: 'SUPERADMIN', label: 'r51-me-super' });
        const s = await me(superadmin.accessToken);
        assert.equal(s.status, 200, show(s));
        assert.ok(Array.isArray(s.body.admin_permissions), `R51 : admin_permissions absent pour le SUPERADMIN : ${show(s)}`);
        assert.deepEqual([...(s.body.admin_permissions as string[])].sort(), [...ADMIN_PERMISSIONS].sort(), 'SUPERADMIN : toutes les permissions');

        const client = await newBuyer('r51-me-client');
        const c = await me(client.accessToken);
        assert.equal(c.status, 200, show(c));
        assert.deepEqual(c.body.admin_permissions ?? [], [], 'client : aucune permission d’admin');
    });
});

describe('R51 — refus d’une route admin en français', () => {
    test('verifyAdminAuth : GET /api/admin/users sans users.read', async () => {
        const admin = await newAdminWith([], { label: 'r51-users' });
        const res = await invoke(await routeHandler('../../app/api/admin/users/route', 'GET', 'GET /api/admin/users'), jsonRequest('/api/admin/users', 'GET', admin.accessToken));
        assertFrenchRefusal(res, 'users.read', 'GET /api/admin/users');
    });

    test('PATCH /api/admin/partners/[id]/status {SUSPENDU} sans partners.suspend : refus en français, partenaire toujours VALIDE', async () => {
        const admin = await newAdminWith(['partners.validate'], { label: 'r51-suspend' });
        const target = await newPartner('r51-cible');
        const handler = await routeHandler('../../app/api/admin/partners/[id]/status/route', 'PATCH', 'PATCH /api/admin/partners/[id]/status');
        const res = await invoke(handler, jsonRequest(`/api/admin/partners/${target.partnerId}/status`, 'PATCH', admin.accessToken,
            { status: 'SUSPENDU', reason: 'Test lot 9 bis : refus en français' }), ctx({ id: target.partnerId }));
        assertFrenchRefusal(res, 'partners.suspend', 'PATCH /api/admin/partners/[id]/status');
        const { data, error } = await service.from('partners').select('status').eq('id', target.partnerId).single();
        assert.equal(error, null, error?.message);
        assert.equal(data.status, 'VALIDE', 'refus sans effet');
    });

    test('POST /api/admin/notifications/[id]/retry sans notifications.write', async () => {
        const admin = await newAdminWith(['notifications.read'], { label: 'r51-relance' });
        const id = randomUUID();
        const handler = await routeHandler('../../app/api/admin/notifications/[id]/retry/route', 'POST', 'POST /api/admin/notifications/[id]/retry');
        const res = await invoke(handler, jsonRequest(`/api/admin/notifications/${id}/retry`, 'POST', admin.accessToken, {}), ctx({ id }));
        assertFrenchRefusal(res, 'notifications.write', 'POST /api/admin/notifications/[id]/retry');
    });
});

// ── Contrôles statiques des écrans ─────────────────────────────────────────

const ROOT = process.cwd();

/** Code sans commentaires (réimprimé par TypeScript). */
function code(rel: string): string {
    const abs = path.join(ROOT, rel);
    assert.ok(fs.existsSync(abs), `${rel} absent`);
    const text = fs.readFileSync(abs, 'utf8');
    const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, rel.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    return ts.createPrinter({ removeComments: true }).printFile(sf);
}

function adminPages(dir = 'app/admin'): string[] {
    const out: string[] = [];
    for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
        const rel = `${dir}/${entry.name}`;
        if (entry.isDirectory()) out.push(...adminPages(rel));
        else if (entry.name.endsWith('.tsx')) out.push(rel);
    }
    return out;
}

describe('R51 — écrans (contrôles statiques)', () => {
    test('AuthProvider expose hasPermission, lu dans admin_permissions de /api/auth/me', () => {
        const src = code('components/providers/AuthProvider.tsx');
        assert.match(src, /\bhasPermission\b/, 'R51 : hasPermission absent de components/providers/AuthProvider.tsx');
        assert.ok(/admin_permissions/.test(src), 'R51 : AuthProvider ne lit pas admin_permissions');
    });

    test('boutons conditionnés par hasPermission : /admin/users (users.write), /admin/dashboard (partners.validate, partners.suspend), fiche événement', () => {
        const expectations: Array<[string, string[]]> = [
            ['app/admin/users/page.tsx', ['users.write']],
            ['app/admin/dashboard/page.tsx', ['partners.validate', 'partners.suspend']],
            ['app/admin/events/[id]/page.tsx', []],
        ];
        for (const [rel, perms] of expectations) {
            const src = code(rel);
            assert.match(src, /\bhasPermission\s*\(/, `R51 : ${rel} n’appelle pas hasPermission(…)`);
            for (const p of perms) {
                assert.ok(new RegExp(`hasPermission\\(\\s*['"\`]${p.replace('.', '\\.')}['"\`]\\s*\\)`).test(src), `R51 : ${rel} : bouton non conditionné par hasPermission('${p}')`);
            }
        }
    });

    test('« Modifier » des réglages financiers réservé au SUPERADMIN (contrôle dans le code, pas seulement en commentaire)', () => {
        const src = code('app/admin/finance-settings/page.tsx');
        assert.ok(/SUPERADMIN|isSuperadmin/.test(src), 'R51 : app/admin/finance-settings/page.tsx ne conditionne pas « Modifier » au SUPERADMIN');
    });

    test('aucune page app/admin/** n’affiche un code de permission brut ({perm})', () => {
        const offenders = adminPages().filter((rel) => />\s*\{\s*(perm|permission)\s*\}\s*</.test(code(rel)));
        assert.deepEqual(offenders, [], `R51 : code de permission affiché tel quel (libellés de lib/admin/permission-labels.ts attendus) : ${offenders.join(', ')}`);
    });
});
