/**
 * Finition 3a (argent de l'administration), point 1 — SÉCURITÉ D'ABORD.
 *
 * 1a. GET /api/admin/metrics (permission statistics.read) renvoyait les 10 dernières lignes du journal d'audit
 *     (`recentAuditLogs` : action, objet, rôle, compte) alors que le journal est réservé au SUPERADMIN
 *     (GET /api/admin/audit, requireSuperadmin). La réponse ne doit plus porter aucune ligne du journal, pour aucun
 *     lecteur ; contrôle statique : la route ne lit plus la table audit_logs.
 * 1b. En base (défense en profondeur, une route fautive ou contournée ne suffit plus) :
 *     - partner_status_set vérifie la permission de l'auteur : valider, refuser ou réactiver exige partners.validate ;
 *       suspendre exige le SUPERADMIN (règle de la route depuis le lot 9 quater, B2) ;
 *     - admin_permissions_set exige un auteur SUPERADMIN ACTIF et lit la cible dans user_roles (jamais l'ancienne colonne
 *       users.role) : cible SUPERADMIN refusée, cible sans rôle ADMIN refusée.
 *     Les fonctions ne sont exécutables que par service_role : l'« attaque » est l'appel qu'une route ferait sans avoir
 *     contrôlé l'auteur. Rien ne doit changer (statut, compte, journal, droits).
 *
 * Rouge avant correctif (main c248e17f) : 1a recentAuditLogs présent ; 1b partner_status_set n'exige qu'un rôle ADMIN ou
 * SUPERADMIN actif (20261109000006_lot9bis_argent.sql:797-803) ; admin_permissions_set ne lit pas l'auteur et teste la
 * cible sur users.role (20261108000001_lot9_securite.sql). Témoins verts dès l'écriture : annoncés dans leur titre.
 * Fin de suite : invariants de toutes les livraisons précédentes (assertFinition1Invariants).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { NextRequest } from 'next/server';
import { inRolledBackTransaction } from '../helpers/db';
import { assertFinition1Invariants } from '../helpers/finition1-invariants';
import { jsonRequest, newPartner, type TestPartner } from './finance-helpers';
import { newAdmin, type TestAdmin } from './notif-helpers';
import { confirmIdentity } from './f3d-helpers';
import { importModule, newBuyer, service, type Buyer } from './paiement-helpers';

type Row = Record<string, unknown>;
type Handler = (req: NextRequest) => Promise<Response>;

const REASON = 'Contrôle de sécurité de la finition 3a';

let noPerm: TestAdmin;
let validator: TestAdmin;
let suspender: TestAdmin;
let both: TestAdmin;
let superadmin: TestAdmin;

before(async () => {
    noPerm = await newAdmin('f3a-sans', ['partners.read', 'statistics.read']);
    validator = await newAdmin('f3a-valide', ['partners.read', 'partners.validate']);
    suspender = await newAdmin('f3a-suspend', ['partners.read', 'partners.suspend']);
    both = await newAdmin('f3a-tout', ['partners.read', 'partners.validate', 'partners.suspend', 'users.write']);
    superadmin = await newAdmin('f3a-super', [], { role: 'SUPERADMIN' });
    // Contre-vérification de la finition 3d (T4 ; modification signalée au rapport) : la grille des droits exige le mot de
    // passe et le code administrateur de moins de 10 minutes.
    await confirmIdentity(superadmin);
});

after(async () => {
    await assertFinition1Invariants('f3a-securite');
});

// ── Outils ─────────────────────────────────────────────────────────────────

async function partnerState(partnerId: string, userId: string): Promise<{ partner: string; account: string }> {
    const { data: p, error: pErr } = await service.from('partners').select('status').eq('id', partnerId).single();
    assert.equal(pErr, null, `fiche ${partnerId} : ${pErr?.message}`);
    const { data: u, error: uErr } = await service.from('users').select('status').eq('id', userId).single();
    assert.equal(uErr, null, `compte ${userId} : ${uErr?.message}`);
    return { partner: String(p.status), account: String(u.status) };
}

async function auditCount(action: string, objectId: string): Promise<number> {
    const { count, error } = await service.from('audit_logs').select('id', { count: 'exact', head: true })
        .eq('action', action).eq('object_id', objectId);
    assert.equal(error, null, `journal ${action} : ${error?.message}`);
    return count ?? 0;
}

async function partnerWithStatus(label: string, status: 'EN_ATTENTE' | 'VALIDE' | 'SUSPENDU'): Promise<TestPartner> {
    const p = await newPartner(label);
    if (status !== 'VALIDE') {
        const { error } = await service.from('partners').update({ status, is_verified: false }).eq('id', p.partnerId);
        assert.equal(error, null, `fiche ${status} : ${error?.message}`);
        if (status === 'SUSPENDU') {
            const { error: uErr } = await service.from('users').update({ status: 'SUSPENDU' }).eq('id', p.userId);
            assert.equal(uErr, null, `compte suspendu : ${uErr?.message}`);
        }
    }
    return p;
}

async function setPartnerStatus(actorId: string, partnerId: string, status: string, reason: string | null = REASON): Promise<Row> {
    const { data, error } = await service.rpc('partner_status_set', { p: { partner_id: partnerId, actor_id: actorId, status, reason } });
    assert.equal(error, null, `partner_status_set : ${error?.code} ${error?.message}`);
    assert.ok(data, 'partner_status_set : réponse vide');
    return data as Row;
}

async function setPermissions(actorId: string, adminId: string, permissions: string[]): Promise<Row> {
    const { data, error } = await service.rpc('admin_permissions_set', { p: { admin_id: adminId, permissions, actor_id: actorId } });
    assert.equal(error, null, `admin_permissions_set : ${error?.code} ${error?.message}`);
    assert.ok(data, 'admin_permissions_set : réponse vide');
    return data as Row;
}

async function permissionsOf(userId: string): Promise<string[]> {
    const { data, error } = await service.from('admin_permissions').select('permission').eq('user_id', userId);
    assert.equal(error, null, `permissions de ${userId} : ${error?.message}`);
    return (data ?? []).map((r) => String(r.permission)).sort();
}

/** Toute ligne du journal d'audit, quelle que soit sa clé, dans une réponse JSON : objet portant action ET object_type. */
function auditLinesIn(value: unknown, found: Row[] = []): Row[] {
    if (Array.isArray(value)) {
        for (const v of value) auditLinesIn(v, found);
    } else if (value && typeof value === 'object') {
        const o = value as Row;
        if ('action' in o && 'object_type' in o) found.push(o);
        for (const v of Object.values(o)) auditLinesIn(v, found);
    }
    return found;
}

// ── 1a. Journal d'audit hors de /api/admin/metrics ─────────────────────────

describe('1a — /api/admin/metrics ne renvoie aucune ligne du journal d’audit', () => {
    test('ADMIN avec statistics.read : réponse 200 sans aucune ligne du journal (rouge : recentAuditLogs)', async () => {
        const { GET } = await importModule('../../app/api/admin/metrics/route') as { GET: Handler };
        const res = await GET(jsonRequest('/api/admin/metrics', 'GET', noPerm.accessToken));
        const body = (await res.json()) as Row;
        assert.equal(res.status, 200, `HTTP ${res.status} ${JSON.stringify(body).slice(0, 300)}`);
        assert.equal('recentAuditLogs' in body, false, `champ recentAuditLogs encore servi à un ADMIN : ${String(JSON.stringify(body.recentAuditLogs)).slice(0, 300)}`);
        const lines = auditLinesIn(body);
        assert.deepEqual(lines, [], `lignes du journal d’audit dans la réponse : ${JSON.stringify(lines).slice(0, 300)}`);
    });

    test('SUPERADMIN : même réponse, aucune ligne du journal (le journal se lit sur /api/admin/audit)', async () => {
        const { GET } = await importModule('../../app/api/admin/metrics/route') as { GET: Handler };
        const res = await GET(jsonRequest('/api/admin/metrics', 'GET', superadmin.accessToken));
        const body = (await res.json()) as Row;
        assert.equal(res.status, 200, `HTTP ${res.status} ${JSON.stringify(body).slice(0, 300)}`);
        assert.equal('recentAuditLogs' in body, false, 'champ recentAuditLogs encore servi');
        assert.deepEqual(auditLinesIn(body), [], 'lignes du journal d’audit dans la réponse');
    });

    test('statique : app/api/admin/metrics/route.ts ne lit plus la table audit_logs', () => {
        const file = path.join(process.cwd(), 'app/api/admin/metrics/route.ts');
        const code = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
        assert.doesNotMatch(code, /audit_logs/, 'app/api/admin/metrics/route.ts lit encore audit_logs');
    });
});

// ── 1b. partner_status_set : permission de l'auteur en base ─────────────────

describe('1b — partner_status_set vérifie la permission de l’auteur (base)', () => {
    test('valider sans partners.validate : refusé, fiche EN_ATTENTE, aucun journal (rouge)', async () => {
        const p = await partnerWithStatus('f3a-val-refus', 'EN_ATTENTE');
        const r = await setPartnerStatus(suspender.userId, p.partnerId, 'VALIDE', null);
        assert.equal(r.ok, false, `validation acceptée sans partners.validate : ${JSON.stringify(r)}`);
        assert.equal(r.code, 'FORBIDDEN', JSON.stringify(r));
        assert.equal(r.permission, 'partners.validate', `permission nommée : ${JSON.stringify(r)}`);
        assert.deepEqual(await partnerState(p.partnerId, p.userId), { partner: 'EN_ATTENTE', account: 'ACTIF' });
        assert.equal(await auditCount('PARTNER_STATUS_SET', p.partnerId), 0, 'journal écrit malgré le refus');
    });

    test('refuser un dossier sans partners.validate : refusé (rouge)', async () => {
        const p = await partnerWithStatus('f3a-rej-refus', 'EN_ATTENTE');
        const r = await setPartnerStatus(suspender.userId, p.partnerId, 'REJETE');
        assert.equal(r.ok, false, `refus accepté sans partners.validate : ${JSON.stringify(r)}`);
        assert.deepEqual([r.code, r.permission], ['FORBIDDEN', 'partners.validate'], JSON.stringify(r));
        assert.deepEqual(await partnerState(p.partnerId, p.userId), { partner: 'EN_ATTENTE', account: 'ACTIF' });
        assert.equal(await auditCount('PARTNER_STATUS_SET', p.partnerId), 0, 'journal écrit malgré le refus');
    });

    test('suspendre par un ADMIN muni de partners.suspend : refusé, réservé au SUPERADMIN ; compte ACTIF, sessions gardées (rouge)', async () => {
        const p = await partnerWithStatus('f3a-susp-refus', 'VALIDE');
        const r = await setPartnerStatus(both.userId, p.partnerId, 'SUSPENDU');
        assert.equal(r.ok, false, `suspension acceptée d’un ADMIN : ${JSON.stringify(r)}`);
        assert.equal(r.code, 'FORBIDDEN', JSON.stringify(r));
        assert.deepEqual(await partnerState(p.partnerId, p.userId), { partner: 'VALIDE', account: 'ACTIF' });
        assert.equal(await auditCount('PARTNER_STATUS_SET', p.partnerId), 0, 'journal écrit malgré le refus');
    });

    test('réactiver sans partners.validate : refusé, fiche et compte toujours suspendus (rouge)', async () => {
        const p = await partnerWithStatus('f3a-react-refus', 'SUSPENDU');
        const r = await setPartnerStatus(suspender.userId, p.partnerId, 'VALIDE');
        assert.equal(r.ok, false, `réactivation acceptée sans partners.validate : ${JSON.stringify(r)}`);
        assert.deepEqual([r.code, r.permission], ['FORBIDDEN', 'partners.validate'], JSON.stringify(r));
        assert.deepEqual(await partnerState(p.partnerId, p.userId), { partner: 'SUSPENDU', account: 'SUSPENDU' });
    });

    test('ADMIN sans aucune permission des partenaires : chaque action refusée (rouge)', async () => {
        const p = await partnerWithStatus('f3a-aucune', 'EN_ATTENTE');
        for (const status of ['VALIDE', 'REJETE']) {
            const r = await setPartnerStatus(noPerm.userId, p.partnerId, status);
            assert.equal(r.ok, false, `${status} accepté sans permission : ${JSON.stringify(r)}`);
            assert.equal(r.code, 'FORBIDDEN', JSON.stringify(r));
        }
        assert.deepEqual(await partnerState(p.partnerId, p.userId), { partner: 'EN_ATTENTE', account: 'ACTIF' });
    });

    test('témoins (verts dès l’écriture) : valider et réactiver avec partners.validate, suspendre par le SUPERADMIN', async () => {
        const p = await partnerWithStatus('f3a-temoin', 'EN_ATTENTE');
        const v = await setPartnerStatus(validator.userId, p.partnerId, 'VALIDE', null);
        assert.equal(v.ok, true, `validation avec partners.validate : ${JSON.stringify(v)}`);
        const s = await setPartnerStatus(superadmin.userId, p.partnerId, 'SUSPENDU');
        assert.equal(s.ok, true, `suspension par le SUPERADMIN : ${JSON.stringify(s)}`);
        assert.deepEqual(await partnerState(p.partnerId, p.userId), { partner: 'SUSPENDU', account: 'SUSPENDU' });
        const a = await setPartnerStatus(validator.userId, p.partnerId, 'VALIDE');
        assert.equal(a.ok, true, `réactivation avec partners.validate : ${JSON.stringify(a)}`);
        assert.deepEqual(await partnerState(p.partnerId, p.userId), { partner: 'VALIDE', account: 'ACTIF' });
        assert.equal(await auditCount('PARTNER_STATUS_SET', p.partnerId), 3, 'trois changements journalisés');
    });
});

// ── 1b. admin_permissions_set : auteur SUPERADMIN actif, cible lue dans user_roles ──

describe('1b — admin_permissions_set : auteur SUPERADMIN actif, cible lue dans user_roles', () => {
    test('auteur ADMIN (même muni de tous les droits) : refusé, droits de la cible inchangés, aucun journal (rouge)', async () => {
        const target = await newAdmin('f3a-perm-cible-1', ['events.read']);
        const r = await setPermissions(both.userId, target.userId, ['events.read', 'events.write', 'users.write']);
        assert.equal(r.ok, false, `droits changés par un ADMIN : ${JSON.stringify(r)}`);
        assert.equal(r.code, 'FORBIDDEN', JSON.stringify(r));
        assert.deepEqual(await permissionsOf(target.userId), ['events.read']);
        assert.equal(await auditCount('UPDATE_PERMISSIONS', target.userId), 0, 'journal écrit malgré le refus');
    });

    test('auteur client (aucun rôle d’administration) : refusé (rouge)', async () => {
        const target = await newAdmin('f3a-perm-cible-2', []);
        const client: Buyer = await newBuyer('f3a-perm-client');
        const r = await setPermissions(client.userId, target.userId, ['users.write']);
        assert.equal(r.ok, false, `droits changés par un client : ${JSON.stringify(r)}`);
        assert.equal(r.code, 'FORBIDDEN', JSON.stringify(r));
        assert.deepEqual(await permissionsOf(target.userId), []);
    });

    test('auteur SUPERADMIN suspendu : refusé (rouge)', async () => {
        const sleeper = await newAdmin('f3a-super-suspendu', [], { role: 'SUPERADMIN' });
        const target = await newAdmin('f3a-perm-cible-3', []);
        const { error } = await service.from('users').update({ status: 'SUSPENDU' }).eq('id', sleeper.userId);
        assert.equal(error, null, `suspension de l’auteur : ${error?.message}`);
        try {
            const r = await setPermissions(sleeper.userId, target.userId, ['users.read']);
            assert.equal(r.ok, false, `droits changés par un SUPERADMIN suspendu : ${JSON.stringify(r)}`);
            assert.equal(r.code, 'FORBIDDEN', JSON.stringify(r));
            assert.deepEqual(await permissionsOf(target.userId), []);
        } finally {
            const { error: back } = await service.from('users').update({ status: 'ACTIF' }).eq('id', sleeper.userId);
            assert.equal(back, null, `réactivation de l’auteur : ${back?.message}`);
        }
    });

    // Run 241 : la promotion recalcule users.role (déclencheurs de 20261115000014) ; la colonne désynchronisée est donc
    // fabriquée dans une transaction annulée (précondition corrigée, signalée au rapport).
    test('cible SUPERADMIN dans user_roles dont l’ancienne colonne users.role dit CLIENT : refusée, rien d’écrit (transaction annulée) (rouge)', async () => {
        const otherSuper = await newAdmin('f3a-super-cible', [], { role: 'SUPERADMIN' });
        await inRolledBackTransaction(async (c) => {
            await c.query(`UPDATE public.users SET role = 'CLIENT' WHERE id = $1`, [otherSuper.userId]);
            const { rows } = await c.query<{ r: Row }>(`SELECT public.admin_permissions_set($1::jsonb) AS r`,
                [JSON.stringify({ admin_id: otherSuper.userId, permissions: ['users.read'], actor_id: superadmin.userId })]);
            const r = rows[0].r;
            assert.equal(r.ok, false, `droits écrits pour un SUPERADMIN (users.role = CLIENT) : ${JSON.stringify(r)}`);
            assert.equal(r.code, 'TARGET_IS_SUPERADMIN', JSON.stringify(r));
            const { rows: perms } = await c.query(`SELECT permission FROM public.admin_permissions WHERE user_id = $1`, [otherSuper.userId]);
            assert.deepEqual(perms, [], 'droits écrits dans la transaction');
        });
        assert.deepEqual(await permissionsOf(otherSuper.userId), []);
    });

    test('cible sans rôle ADMIN (client) : refusée, rien d’écrit ; la route répond 400 (rouge)', async () => {
        const client = await newBuyer('f3a-perm-non-admin');
        const r = await setPermissions(superadmin.userId, client.userId, ['users.write']);
        assert.equal(r.ok, false, `droits écrits pour un compte non administrateur : ${JSON.stringify(r)}`);
        assert.equal(r.code, 'TARGET_NOT_ADMIN', JSON.stringify(r));
        assert.deepEqual(await permissionsOf(client.userId), []);
        const { POST } = await importModule('../../app/api/admin/permissions/route') as { POST: Handler };
        const res = await POST(jsonRequest('/api/admin/permissions', 'POST', superadmin.accessToken, { adminId: client.userId, permissions: ['users.write'] }));
        const body = (await res.json()) as Row;
        assert.equal(res.status, 400, `route : HTTP ${res.status} ${JSON.stringify(body)}`);
        assert.equal(body.code, 'TARGET_NOT_ADMIN', JSON.stringify(body));
        assert.deepEqual(await permissionsOf(client.userId), []);
    });

    test('cible ADMIN dans user_roles dont l’ancienne colonne users.role dit SUPERADMIN : acceptée (lue dans user_roles, transaction annulée) (rouge)', async () => {
        const target = await newAdmin('f3a-perm-colonne', ['events.read']);
        await inRolledBackTransaction(async (c) => {
            await c.query(`UPDATE public.users SET role = 'SUPERADMIN' WHERE id = $1`, [target.userId]);
            const { rows } = await c.query<{ r: Row }>(`SELECT public.admin_permissions_set($1::jsonb) AS r`,
                [JSON.stringify({ admin_id: target.userId, permissions: ['events.read', 'events.write'], actor_id: superadmin.userId })]);
            assert.equal(rows[0].r.ok, true, `cible ADMIN refusée sur la foi de users.role : ${JSON.stringify(rows[0].r)}`);
        });
        assert.deepEqual(await permissionsOf(target.userId), ['events.read'], 'transaction annulée : droits d’origine');
    });

    test('témoin (vert dès l’écriture) : SUPERADMIN actif, cible ADMIN : droits remplacés et journalisés', async () => {
        const target = await newAdmin('f3a-perm-temoin', ['events.read']);
        const r = await setPermissions(superadmin.userId, target.userId, ['events.read', 'payments.read']);
        assert.equal(r.ok, true, JSON.stringify(r));
        assert.deepEqual(await permissionsOf(target.userId), ['events.read', 'payments.read']);
        assert.equal(await auditCount('UPDATE_PERMISSIONS', target.userId), 1, 'changement journalisé');
    });
});
