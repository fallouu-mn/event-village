/**
 * Lot 7, tâche 7.0 c — sécurité de l'administration (contrat section 4.3, D18, D19, 3.7 ; écrivain W2).
 *  1. verifyAdminAuth refuse tout compte dont users.status <> 'ACTIF' (SUPPRIME, EN_ATTENTE, SUSPENDU) :
 *     403 ACCOUNT_NOT_ACTIVE, sur GET /api/admin/users (verifyAdminAuth seul) et GET /api/admin/notifications
 *     (requireActiveSession puis verifyAdminAuth), et par un appel direct de verifyAdminAuth ; témoin : le
 *     même admin ACTIF obtient 200 ;
 *  2. aucun repli sur users.role quand user_roles est vide (règle du lot 1B.8) : compte sans ligne
 *     user_roles, users.role = 'ADMIN', permissions users.read et notifications.read → 403 ;
 *  3. anonymisation d'un ADMIN (puis d'un SUPERADMIN) à 3 permissions par DELETE /api/admin/users (route de
 *     tests/parcours/anonymisation-debogage.test.ts) : admin_permissions vide (colonne user_id,
 *     lib/admin/admin.service.ts:417), user_roles sans ADMIN ni SUPERADMIN (D19), ancien jeton refusé par
 *     verifyAdminAuth, requireActiveSession et la route admin, et côté REST (clé anon + ancien jeton) :
 *     rpc(is_admin) ne vaut plus vrai et aucune ligne de admin_signals n'est lisible ; témoin avant
 *     l'anonymisation : is_admin vrai, signal lisible, route 200 ;
 *  4. permissions dédiées (3.7) : POST /api/admin/cashouts/[id]/resend (lot 9 bis, B4, T19) exige refunds.manage
 *     (sans → 403 ; avec → le contrôle passe, 404 pour un versement inconnu ; SUSPENDU → 403 ; client → 403 ;
 *     SUPERADMIN → 404) ; GET /api/admin/shifts/audit exige shifts.read (sans → 403 ; avec → 200 ;
 *     SUPERADMIN → 200) ; ADMIN_PERMISSIONS contient shifts.read.
 *
 * Rouge avant correctif (fix(7.0c)) :
 *  - 1 : lib/admin/admin-auth.ts:123-128 ne refuse que SUSPENDU (et sans code) : SUPPRIME et EN_ATTENTE
 *    passent sur /api/admin/users (200) ; SUSPENDU y répond 403 sans code ACCOUNT_NOT_ACTIVE. Sur
 *    /api/admin/notifications, le 403 ACCOUNT_NOT_ACTIVE existe déjà (requireActiveSession) : partie verte ;
 *  - 2 : admin-auth.ts:118-120 se replie sur users.role quand user_roles est vide : 200 ;
 *  - 3 : admin.service.ts:417 supprime par admin_id (colonne inexistante, erreur seulement journalisée) :
 *    les 3 permissions restent ; seul CONTROLEUR est retiré de user_roles (:416) : ADMIN reste, is_admin()
 *    vaut vrai avec l'ancien jeton (PostgREST ne consulte pas les sessions révoquées). Parties déjà vraies
 *    (signalées) : lecture de admin_signals (la politique exige un compte ni SUSPENDU ni SUPPRIME,
 *    20261103000001_lot6_dette.sql:107-113) ; refus de l'ancien jeton par les routes (sessions supprimées
 *    par revoke_user_sessions : GoTrue refuse alors le jeton, 401 — SUPPOSÉ, voir plus bas) ;
 *  - 4 : (lot 9 bis) la route refunds/[id]/retry est supprimée (B4), mêmes assertions sur cashouts/[id]/resend,
 *    absente jusqu'à fix(9b.1) (import dynamique) ; shifts/audit n'exige que le rôle : sans shifts.read
 *    → 200 ; shifts.read absent de ADMIN_PERMISSIONS.
 *
 * Écart au contrat (signalé) : pour l'ancien jeton d'un compte anonymisé, le contrat écrit « verifyAdminAuth
 * 403, requireActiveSession 403 ». Les sessions sont supprimées par l'anonymisation (lot 1C.3) ; si GoTrue
 * refuse alors le jeton (SUPPOSÉ, non exécutable sans Docker), la réponse est 401 avant tout contrôle de
 * statut. La suite exige donc un refus (401 ou 403, jamais autorisé) et, pour un 403, le code
 * ACCOUNT_NOT_ACTIVE ; le refus par statut lui-même est prouvé au point 1 (compte SUPPRIME à session valide).
 * Les comptes admin créés sont suspendus en fin de suite s'ils sont encore ACTIF (ils ne reçoivent plus
 * d'alertes des suites suivantes, comme notif-admin).
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { ADMIN_PERMISSIONS, verifyAdminAuth } from '../../lib/admin/admin-auth';
import { requireActiveSession } from '../../lib/auth/session';
import { bearer, signInAs } from '../helpers/fixtures';
import { BASE_URL } from './helpers';
import { importModule, newBuyer, service, type Buyer } from './paiement-helpers';
import { newPartner } from './finance-helpers';
import { assertTerrainInvariants, newAdminWith } from './terrain-helpers';

type Row = Record<string, unknown>;
type Handler = (req: NextRequest, ctx?: unknown) => Promise<Response>;
interface RouteResult { status: number; body: Row }

const USERS_ROUTE = '../../app/api/admin/users/route';
const NOTIFICATIONS_ROUTE = '../../app/api/admin/notifications/route';
const RETRY_ROUTE = '../../app/api/admin/cashouts/[id]/resend/route';
const SHIFTS_AUDIT_ROUTE = '../../app/api/admin/shifts/audit/route';

/** Comptes créés par la suite (suspendus en fin de suite s'ils sont encore ACTIF). */
const createdAccounts: string[] = [];

/** Jeton du SUPERADMIN du seed, une seule connexion par processus (limite de débit de l'API Auth). */
let superadminToken: Promise<string> | null = null;
function superadminAccess(): Promise<string> {
    if (!superadminToken) superadminToken = signInAs('SUPERADMIN').then((s) => s.accessToken);
    return superadminToken;
}

after(async () => {
    if (createdAccounts.length > 0) {
        const { error } = await service.from('users').update({ status: 'SUSPENDU' }).in('id', createdAccounts).eq('status', 'ACTIF');
        assert.equal(error, null, `suspension des comptes de la suite : ${error?.message}`);
    }
    await assertTerrainInvariants('securite-admin-lot7');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

async function handler(relPath: string, method: 'GET' | 'POST' | 'DELETE'): Promise<Handler> {
    const mod = await importModule(relPath);
    const h = mod[method] as Handler | undefined;
    assert.equal(typeof h, 'function', `${relPath.replace(/^(\.\.\/)+/, '')}.ts : ${method} non exporté`);
    return h as Handler;
}

async function call(relPath: string, method: 'GET' | 'POST' | 'DELETE', path: string, token: string | null, ctx?: unknown, json?: unknown): Promise<RouteResult> {
    const h = await handler(relPath, method);
    const headers: Record<string, string> = { 'content-type': 'application/json', ...(token ? bearer(token) : {}) };
    const res = await h(new NextRequest(`${BASE_URL}${path}`, { method, headers, body: json === undefined ? undefined : JSON.stringify(json) }), ctx);
    const text = await res.text();
    let body: Row = {};
    if (text) {
        try {
            body = JSON.parse(text) as Row;
        } catch (err) {
            body = { raw: text.slice(0, 2000), parseError: (err as Error).message };
        }
    }
    return { status: res.status, body };
}

function show(r: RouteResult): string {
    return `HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 600)}`;
}

/** Contexte de route valable que le gestionnaire lise `params.id` (Next 14) ou `await params`. */
function paramsContext(id: string): { params: Promise<{ id: string }> & { id: string } } {
    return { params: Object.assign(Promise.resolve({ id }), { id }) };
}

/** GET /api/admin/users filtré sur l'email du compte (réponse courte). */
function usersList(token: string | null, email: string): Promise<RouteResult> {
    return call(USERS_ROUTE, 'GET', `/api/admin/users?search=${encodeURIComponent(email)}`, token);
}

function notificationsList(token: string | null): Promise<RouteResult> {
    return call(NOTIFICATIONS_ROUTE, 'GET', '/api/admin/notifications?page=1&pageSize=1', token);
}

/** verifyAdminAuth appelé directement, réponse d'erreur lue. */
async function directAdminAuth(token: string): Promise<{ authorized: boolean; status: number | null; body: Row }> {
    const r = await verifyAdminAuth(new NextRequest(`${BASE_URL}/api/admin/users`, { method: 'GET', headers: bearer(token) }));
    if (r.authorized) return { authorized: true, status: null, body: {} };
    assert.ok(r.errorResponse, 'verifyAdminAuth : refus sans réponse d’erreur');
    return { authorized: false, status: r.errorResponse.status, body: (await r.errorResponse.json()) as Row };
}

/** requireActiveSession appelé directement : statut de la réponse de refus, ou null si la session passe. */
async function directActiveSession(token: string): Promise<{ status: number | null; body: Row }> {
    const r = await requireActiveSession(new NextRequest(`${BASE_URL}/api/tickets`, { method: 'GET', headers: bearer(token) }));
    if (!r.response) return { status: null, body: {} };
    return { status: r.response.status, body: (await r.response.json()) as Row };
}

/** Client REST (clé anon) porteur d'un jeton d'accès donné, sans rafraîchissement. */
function restWithToken(token: string): SupabaseClient {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { headers: bearer(token) },
    });
}

async function setStatus(userId: string, status: 'ACTIF' | 'SUSPENDU' | 'EN_ATTENTE' | 'SUPPRIME'): Promise<void> {
    const { data, error } = await service.from('users').update({ status }).eq('id', userId).select('id');
    assert.equal(error, null, `statut ${status} du compte ${userId} : ${error?.message}`);
    assert.equal((data ?? []).length, 1, `compte ${userId} introuvable`);
}

async function statusOf(userId: string): Promise<string> {
    const { data, error } = await service.from('users').select('status').eq('id', userId).single();
    assert.equal(error, null, `statut du compte ${userId} : ${error?.message}`);
    return String(data.status);
}

async function adminWith(perms: string[], label: string, role: 'ADMIN' | 'SUPERADMIN' = 'ADMIN'): Promise<Buyer> {
    const admin = await newAdminWith(perms, { role, label: `${label}-${randomUUID().slice(0, 6)}` });
    createdAccounts.push(admin.userId);
    return admin;
}

/** Refus « compte non actif » attendu : 403, code ACCOUNT_NOT_ACTIVE (D18, même code que lib/auth/session.ts:56-63). */
function assertNotActive(r: { status: number | null; body: Row }, what: string): void {
    assert.equal(r.status, 403, `${what} : 403 attendu, reçu ${r.status} ${JSON.stringify(r.body).slice(0, 400)}`);
    assert.equal(r.body.code, 'ACCOUNT_NOT_ACTIVE', `${what} : code ACCOUNT_NOT_ACTIVE attendu, reçu ${JSON.stringify(r.body).slice(0, 400)}`);
}

// ── 1. Compte ACTIF seulement ──────────────────────────────────────────────

describe('7.0 c — verifyAdminAuth refuse tout compte non ACTIF (D18)', () => {
    test('témoin : admin ACTIF (users.read, notifications.read) → 200 sur /api/admin/users et /api/admin/notifications', async () => {
        const admin = await adminWith(['users.read', 'notifications.read'], 'actif');
        const users = await usersList(admin.accessToken, admin.email);
        assert.equal(users.status, 200, `/api/admin/users : ${show(users)}`);
        const notifs = await notificationsList(admin.accessToken);
        assert.equal(notifs.status, 200, `/api/admin/notifications : ${show(notifs)}`);
        const direct = await directAdminAuth(admin.accessToken);
        assert.equal(direct.authorized, true, `verifyAdminAuth direct : refusé ${direct.status} ${JSON.stringify(direct.body)}`);
    });

    for (const status of ['SUPPRIME', 'EN_ATTENTE', 'SUSPENDU'] as const) {
        test(`admin ${status} (session valide) → 403 ACCOUNT_NOT_ACTIVE sur /api/admin/users, /api/admin/notifications et verifyAdminAuth`, async () => {
            const admin = await adminWith(['users.read', 'notifications.read'], status.toLowerCase());
            const before = await usersList(admin.accessToken, admin.email);
            assert.equal(before.status, 200, `précondition, compte ACTIF : ${show(before)}`);
            await setStatus(admin.userId, status);

            assertNotActive(await usersList(admin.accessToken, admin.email), `${status} : GET /api/admin/users`);
            assertNotActive(await notificationsList(admin.accessToken), `${status} : GET /api/admin/notifications`);
            const direct = await directAdminAuth(admin.accessToken);
            assert.equal(direct.authorized, false, `${status} : verifyAdminAuth a autorisé le compte`);
            assertNotActive(direct, `${status} : verifyAdminAuth direct`);
        });
    }
});

// ── 2. Aucun repli sur users.role ──────────────────────────────────────────

describe('7.0 c — verifyAdminAuth : user_roles seule source des rôles (D18, règle du lot 1B.8)', () => {
    test('compte sans aucune ligne user_roles, users.role = ADMIN, permissions users.read et notifications.read → 403', async () => {
        const user = await newBuyer('sans-roles', { firstName: 'Khady', lastName: 'Sansrole' });
        createdAccounts.push(user.userId);
        const { error: delErr } = await service.from('user_roles').delete().eq('user_id', user.userId);
        assert.equal(delErr, null, `retrait des rôles : ${delErr?.message}`);
        const { error: roleErr } = await service.from('users').update({ role: 'ADMIN' }).eq('id', user.userId);
        assert.equal(roleErr, null, `users.role = ADMIN : ${roleErr?.message}`);
        for (const permission of ['users.read', 'notifications.read']) {
            const { error } = await service.from('admin_permissions').upsert({ user_id: user.userId, permission }, { onConflict: 'user_id,permission' });
            assert.equal(error, null, `permission ${permission} : ${error?.message}`);
        }
        const { data: roles, error: rErr } = await service.from('user_roles').select('role').eq('user_id', user.userId);
        assert.equal(rErr, null, `lecture des rôles : ${rErr?.message}`);
        assert.deepEqual(roles ?? [], [], 'précondition : aucune ligne user_roles pour ce compte');
        assert.equal(await statusOf(user.userId), 'ACTIF', 'précondition : compte ACTIF (le refus ne vient pas du statut)');

        const users = await usersList(user.accessToken, user.email);
        assert.equal(users.status, 403, `GET /api/admin/users avec users.role seul : ${show(users)}`);
        assert.doesNotMatch(String(users.body.error ?? ''), /Permission manquante/, `le refus doit venir du rôle, pas d'une permission : ${show(users)}`);
        const notifs = await notificationsList(user.accessToken);
        assert.equal(notifs.status, 403, `GET /api/admin/notifications avec users.role seul : ${show(notifs)}`);
        const direct = await directAdminAuth(user.accessToken);
        assert.equal(direct.authorized, false, 'verifyAdminAuth a autorisé un compte sans rôle ADMIN dans user_roles (repli sur users.role)');
        assert.equal(direct.status, 403, `verifyAdminAuth direct : ${direct.status} ${JSON.stringify(direct.body)}`);
    });
});

// ── 3. Anonymisation d'un admin ────────────────────────────────────────────

describe('7.0 c — un admin anonymisé n’a plus aucune permission et sa session est refusée partout (D19)', () => {
    for (const role of ['ADMIN', 'SUPERADMIN'] as const) {
        test(`${role} à 3 permissions anonymisé par DELETE /api/admin/users : permissions et rôles admin retirés, ancien jeton refusé`, async () => {
            const perms = ['users.read', 'notifications.read', 'events.read'];
            const admin = await adminWith(perms, `anon-${role.toLowerCase()}`, role);
            // Signal admin_signals PARTNER_REGISTERED écrit par trigger à l'insertion du partenaire (lot 5, O2)
            const partner = await newPartner(`lot7-signal-${role.toLowerCase()}`);
            const { data: sig, error: sigErr } = await service.from('admin_signals').select('id').eq('kind', 'PARTNER_REGISTERED').eq('ref_id', partner.partnerId);
            assert.equal(sigErr, null, `signal du partenaire : ${sigErr?.message}`);
            assert.equal((sig ?? []).length, 1, 'précondition : un signal PARTNER_REGISTERED pour le partenaire neuf');

            // Témoins avant l'anonymisation (même jeton)
            const rest = restWithToken(admin.accessToken);
            const isAdminBefore = await rest.rpc('is_admin');
            assert.equal(isAdminBefore.error, null, `rpc(is_admin) avant : ${isAdminBefore.error?.message}`);
            assert.equal(isAdminBefore.data, true, 'témoin : is_admin() vrai avant l’anonymisation');
            const signalsBefore = await rest.from('admin_signals').select('id').eq('ref_id', partner.partnerId);
            assert.equal(signalsBefore.error, null, `admin_signals avant : ${signalsBefore.error?.message}`);
            assert.equal((signalsBefore.data ?? []).length, 1, 'témoin : le signal est lisible par l’admin ACTIF');
            const usersBefore = await usersList(admin.accessToken, admin.email);
            assert.equal(usersBefore.status, 200, `témoin : route admin avant : ${show(usersBefore)}`);
            const { data: permsBefore, error: pbErr } = await service.from('admin_permissions').select('permission').eq('user_id', admin.userId);
            assert.equal(pbErr, null, `permissions avant : ${pbErr?.message}`);
            assert.deepEqual((permsBefore ?? []).map((p) => String(p.permission)).sort(), [...perms].sort(), 'précondition : 3 permissions');

            // Anonymisation par le SUPERADMIN du seed
            const del = await call(USERS_ROUTE, 'DELETE', `/api/admin/users?userId=${admin.userId}`, await superadminAccess());
            assert.equal(del.status, 200, `anonymisation : ${show(del)}`);
            assert.equal(await statusOf(admin.userId), 'SUPPRIME', 'compte SUPPRIME après l’anonymisation');

            const { data: permsAfter, error: paErr } = await service.from('admin_permissions').select('permission').eq('user_id', admin.userId);
            assert.equal(paErr, null, `permissions après : ${paErr?.message}`);
            assert.deepEqual(permsAfter ?? [], [], `admin_permissions non vidé (lib/admin/admin.service.ts:417 supprime par admin_id) : ${JSON.stringify(permsAfter)}`);
            const { data: rolesAfter, error: raErr } = await service.from('user_roles').select('role').eq('user_id', admin.userId).in('role', ['ADMIN', 'SUPERADMIN']);
            assert.equal(raErr, null, `rôles après : ${raErr?.message}`);
            assert.deepEqual(rolesAfter ?? [], [], `user_roles garde ${JSON.stringify(rolesAfter)} : is_admin() reste vrai pendant la vie du jeton`);

            // Ancien jeton : refusé partout (401 si GoTrue refuse le jeton, 403 ACCOUNT_NOT_ACTIVE sinon)
            const direct = await directAdminAuth(admin.accessToken);
            assert.equal(direct.authorized, false, 'verifyAdminAuth a autorisé l’ancien jeton d’un compte anonymisé');
            assert.ok(direct.status === 401 || direct.status === 403, `verifyAdminAuth : 401 ou 403 attendu, reçu ${direct.status}`);
            if (direct.status === 403) assert.equal(direct.body.code, 'ACCOUNT_NOT_ACTIVE', `verifyAdminAuth : ${JSON.stringify(direct.body)}`);
            const session = await directActiveSession(admin.accessToken);
            assert.ok(session.status === 401 || session.status === 403, `requireActiveSession a laissé passer l’ancien jeton (statut ${session.status})`);
            if (session.status === 403) assert.equal(session.body.code, 'ACCOUNT_NOT_ACTIVE', `requireActiveSession : ${JSON.stringify(session.body)}`);
            const usersAfter = await usersList(admin.accessToken, admin.email);
            assert.ok(usersAfter.status === 401 || usersAfter.status === 403, `route admin avec l’ancien jeton : ${show(usersAfter)}`);
            const notifsAfter = await notificationsList(admin.accessToken);
            assert.ok(notifsAfter.status === 401 || notifsAfter.status === 403, `/api/admin/notifications avec l’ancien jeton : ${show(notifsAfter)}`);

            // REST, clé anon + ancien jeton : is_admin() ne vaut plus vrai, aucun signal lisible
            const isAdminAfter = await rest.rpc('is_admin');
            if (isAdminAfter.error === null) {
                assert.equal(isAdminAfter.data, false, 'is_admin() vaut encore vrai avec l’ancien jeton (rôle ADMIN ou SUPERADMIN resté dans user_roles)');
            } else {
                assert.match(`${isAdminAfter.error.code} ${isAdminAfter.error.message}`, /PGRST30|JWT|401|jwt/i, `rpc(is_admin) : refus inattendu ${isAdminAfter.error.code} ${isAdminAfter.error.message}`);
            }
            const signalsAfter = await rest.from('admin_signals').select('id').eq('ref_id', partner.partnerId);
            if (signalsAfter.error === null) {
                assert.deepEqual(signalsAfter.data ?? [], [], 'admin_signals lisible avec l’ancien jeton d’un compte anonymisé');
            } else {
                assert.match(`${signalsAfter.error.code} ${signalsAfter.error.message}`, /PGRST30|JWT|42501|permission denied/i, `admin_signals : refus inattendu ${signalsAfter.error.code} ${signalsAfter.error.message}`);
            }
        });
    }
});

// ── 4. Permissions dédiées ─────────────────────────────────────────────────

describe('7.0 c — permissions dédiées : refunds.manage et shifts.read (3.7)', () => {
    test('ADMIN_PERMISSIONS contient shifts.read (et toujours refunds.manage)', () => {
        const list = ADMIN_PERMISSIONS as readonly string[];
        assert.ok(list.includes('shifts.read'), `shifts.read absente de ADMIN_PERMISSIONS : ${list.join(', ')}`);
        assert.ok(list.includes('refunds.manage'), 'refunds.manage absente de ADMIN_PERMISSIONS');
    });

    test('POST /api/admin/cashouts/[id]/resend : sans refunds.manage → 403 ; avec → 404 (versement inconnu) ; SUSPENDU → 403 ; client → 403 ; SUPERADMIN → 404', async () => {
        const unknown = randomUUID();
        const path = `/api/admin/cashouts/${unknown}/resend`; const reason = { reason: 'Justification valable du test (lot 9 bis, T19)' };

        const without = await adminWith(['users.read', 'payments.read'], 'sans-refunds');
        const r1 = await call(RETRY_ROUTE, 'POST', path, without.accessToken, paramsContext(unknown), reason);
        assert.equal(r1.status, 403, `ADMIN sans refunds.manage : ${show(r1)}`);

        const withPerm = await adminWith(['refunds.manage'], 'refunds');
        const r2 = await call(RETRY_ROUTE, 'POST', path, withPerm.accessToken, paramsContext(unknown), reason);
        assert.equal(r2.status, 404, `ADMIN avec refunds.manage, versement inconnu : ${show(r2)}`);

        const suspended = await adminWith(['refunds.manage'], 'refunds-suspendu');
        await setStatus(suspended.userId, 'SUSPENDU');
        const r3 = await call(RETRY_ROUTE, 'POST', path, suspended.accessToken, paramsContext(unknown), reason);
        assertNotActive(r3, 'ADMIN SUSPENDU avec refunds.manage');

        const client = await newBuyer('retry-client');
        createdAccounts.push(client.userId);
        const r4 = await call(RETRY_ROUTE, 'POST', path, client.accessToken, paramsContext(unknown), reason);
        assert.equal(r4.status, 403, `client : ${show(r4)}`);

        const r5 = await call(RETRY_ROUTE, 'POST', path, await superadminAccess(), paramsContext(unknown), reason);
        assert.equal(r5.status, 404, `SUPERADMIN, versement inconnu : ${show(r5)}`);

        const anonymous = await call(RETRY_ROUTE, 'POST', path, null, paramsContext(unknown), reason);
        assert.equal(anonymous.status, 401, `sans session : ${show(anonymous)}`);
    });

    test('GET /api/admin/shifts/audit : sans shifts.read → 403 ; avec → 200 ; SUSPENDU avec shifts.read → 403 ; SUPERADMIN → 200', async () => {
        const path = '/api/admin/shifts/audit';
        const without = await adminWith(['users.read', 'refunds.manage'], 'sans-shifts');
        const r1 = await call(SHIFTS_AUDIT_ROUTE, 'GET', path, without.accessToken);
        assert.equal(r1.status, 403, `ADMIN sans shifts.read : ${show(r1)}`);

        const withPerm = await adminWith(['shifts.read'], 'shifts');
        const r2 = await call(SHIFTS_AUDIT_ROUTE, 'GET', path, withPerm.accessToken);
        assert.equal(r2.status, 200, `ADMIN avec shifts.read : ${show(r2)}`);
        assert.equal(r2.body.success, true, `corps : ${show(r2)}`);
        assert.equal(typeof r2.body.total_discrepancies, 'number', `total_discrepancies : ${show(r2)}`);

        const suspended = await adminWith(['shifts.read'], 'shifts-suspendu');
        await setStatus(suspended.userId, 'SUSPENDU');
        const r3 = await call(SHIFTS_AUDIT_ROUTE, 'GET', path, suspended.accessToken);
        assertNotActive(r3, 'ADMIN SUSPENDU avec shifts.read');

        const r4 = await call(SHIFTS_AUDIT_ROUTE, 'GET', path, await superadminAccess());
        assert.equal(r4.status, 200, `SUPERADMIN : ${show(r4)}`);
    });
});
