/**
 * Lot 9, tâche 9.3, A33 (contrat 5.4, L39, D-sec 4) — une écriture dont l'erreur était ignorée la traite.
 *  - POST /api/admin/permissions : RPC transactionnelle admin_permissions_set. Avant : le DELETE passe, l'INSERT
 *    échoue, et la route répond success: true : l'administrateur a perdu tous ses droits.
 *  - POST /api/partner/register : RPC partner_register_finalize, et compensation auth.admin.deleteUser. Avant : la fiche
 *    reste orpheline, le compte de connexion reste, et le numéro est pris au nouvel essai (409).
 *
 * Pannes : déclencheurs temporaires posés et retirés par une connexion locale, dans un finally, patron de
 * partenaire-profil-rpc.test.ts:102-132. Les suites tournent en série (run-tests.mjs).
 *  - permissions : BEFORE INSERT sur admin_permissions, pour le seul administrateur cible ;
 *  - inscription : BEFORE INSERT sur partner_activities, pour la seule raison sociale de la suite ;
 *  - pièce consommée entre-temps : BEFORE INSERT sur partners, qui marque les deux pièces comme réclamées ; le filtre
 *    `claimed_at IS NULL` de la route (ou de la RPC) ne trouve alors plus rien.
 *
 * Écarts tranchés, signalés :
 *  - le format d'old_value n'est pas figé par le contrat : le test exige que chaque permission d'avant y figure ;
 *  - partner_register_finalize n'est pas appelée en direct : son corps (`partner: {…}`) n'est pas figé au contrat ; la
 *    route est prouvée, et le compte des appels à la RPC exige un seul appel, sans écriture REST directe.
 *
 * Rouge avant correctif : réponse 200 sur panne (permissions, inscription), aucune compensation, aucune RPC (PGRST202
 * sur l'appel direct d'admin_permissions_set), routes qui écrivent encore elles-mêmes. after() : assertLot9Invariants,
 * rouge jusqu'à M2 et M4.
 * Verts dès l'écriture (témoins, signalés) : parcours nominal des permissions, permission inconnue ignorée, cibles
 * refusées par la route (404, 400).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { POST as postPermissions } from '../../app/api/admin/permissions/route';
// Lot 9 bis (R53, T38) : l'inscription partenaire passe par registerPartnerTwoStep (deux appels de la route).
import { hashUploadToken } from '../../lib/partners/documents';
import { inspect, openConcurrentClient } from '../helpers/db';
import { bearer, signInAs } from '../helpers/fixtures';
import { assertLot9Invariants } from '../helpers/lot9-invariants';
import { newPartner, type TestPartner } from './finance-helpers';
import { jsonRequest, randomEmail, randomSenegalPhone, registerPartnerTwoStep, STRONG_PASSWORD, uploadRegistrationDocuments, type RegistrationDocuments } from './helpers';
import { SENTINEL, reply, type Reply } from './panne-helpers';
import { service } from './paiement-helpers';
import { newAdminWith } from './terrain-helpers';

type Row = Record<string, unknown>;

const PERMISSIONS_ROUTE = 'app/api/admin/permissions/route.ts';
const REGISTER_ROUTE = 'app/api/partner/register/route.ts';
const TRIGGER = 'ev_test_panne_a33_lot9';
const SAFE_LABEL = /^[A-Za-z0-9 -]+$/;

after(async () => {
    await assertLot9Invariants('ecritures-ignorees');
});

function show(r: Reply): string {
    return `HTTP ${r.status} ${r.text.slice(0, 400)}`;
}

/** Une connexion locale, une instruction, validée (DDL du déclencheur temporaire). */
async function runDdl(sql: string): Promise<void> {
    const db = await openConcurrentClient({ applicationName: 'ev-test-ecritures-ignorees' });
    try {
        await db.query(sql);
        await db.commit();
    } finally {
        await db.close();
    }
}

/** Pose un déclencheur BEFORE INSERT sur `table` pendant `fn` ; il est toujours retiré. `body` : corps PL/pgSQL. */
async function withTrigger<T>(table: string, body: string, fn: () => Promise<T>): Promise<T> {
    await runDdl(`
        CREATE OR REPLACE FUNCTION public.${TRIGGER}() RETURNS trigger LANGUAGE plpgsql AS $fn$
        BEGIN
            ${body}
            RETURN NEW;
        END
        $fn$;
        DROP TRIGGER IF EXISTS ${TRIGGER} ON public.${table};
        CREATE TRIGGER ${TRIGGER} BEFORE INSERT ON public.${table} FOR EACH ROW EXECUTE FUNCTION public.${TRIGGER}();`);
    try {
        return await fn();
    } finally {
        await runDdl(`
            DROP TRIGGER IF EXISTS ${TRIGGER} ON public.${table};
            DROP FUNCTION IF EXISTS public.${TRIGGER}();`);
    }
}

let superadminId: string;
let superadminToken: string;

before(async () => {
    const signed = await signInAs('SUPERADMIN');
    superadminId = signed.userId;
    superadminToken = signed.accessToken;
});

// ── admin/permissions ──────────────────────────────────────────────────────

async function permissionsOf(userId: string): Promise<string[]> {
    const { data, error } = await service.from('admin_permissions').select('permission').eq('user_id', userId);
    assert.equal(error, null, `permissions : ${error?.message}`);
    return (data ?? []).map((p) => String(p.permission)).sort();
}

async function auditRows(adminId: string): Promise<Row[]> {
    const { data, error } = await service.from('audit_logs').select('user_id, user_role, object_type, old_value, new_value')
        .eq('action', 'UPDATE_PERMISSIONS').eq('object_id', adminId);
    assert.equal(error, null, `journal : ${error?.message}`);
    return (data ?? []) as Row[];
}

async function setPermissions(adminId: string, permissions: string[]): Promise<Reply> {
    return reply(await postPermissions(jsonRequest('/api/admin/permissions', { adminId, permissions }, bearer(superadminToken))));
}

describe('A33 — POST /api/admin/permissions', () => {
    test('panne à l’insertion : 500 PERMISSIONS_SAVE_FAILED, anciennes permissions intactes, aucun audit, aucun texte de base', async () => {
        const target = await newAdminWith(['users.read'], { label: 'perm9-panne' });
        assert.match(target.userId, /^[0-9a-f-]{36}$/, 'identifiant attendu');
        const r = await withTrigger('admin_permissions', `
            IF NEW.user_id = '${target.userId}'::uuid THEN
                RAISE EXCEPTION 'panne simulée de l''insertion ${SENTINEL}';
            END IF;`, () => setPermissions(target.userId, ['events.read', 'partners.read']));
        assert.equal(r.status, 500, `panne présentée comme un succès : ${show(r)}`);
        assert.equal(r.body.code, 'PERMISSIONS_SAVE_FAILED', show(r));
        assert.ok(!r.text.includes(SENTINEL), `texte de la base renvoyé : ${show(r)}`);
        assert.deepEqual(await permissionsOf(target.userId), ['users.read'], 'l’administrateur a perdu ses droits : DELETE et INSERT hors transaction');
        assert.deepEqual(await auditRows(target.userId), [], 'aucun audit pour une écriture qui a échoué');
    });

    test('témoin : succès, permissions exactes, permission inconnue ignorée, un audit du SUPERADMIN (vert dès l’écriture)', async () => {
        const target = await newAdminWith(['users.read'], { label: 'perm9-ok' });
        const r = await setPermissions(target.userId, ['events.read', 'partners.read', 'droit.inconnu']);
        assert.equal(r.status, 200, show(r));
        assert.equal(r.body.success, true, show(r));
        assert.deepEqual(await permissionsOf(target.userId), ['events.read', 'partners.read'], 'seules les permissions connues');
        const rows = await auditRows(target.userId);
        assert.equal(rows.length, 1, 'un seul audit');
        assert.equal(rows[0].user_id, superadminId, 'auteur : le SUPERADMIN de la session');
        assert.equal(rows[0].object_type, 'admin_permissions');
        assert.deepEqual((rows[0].new_value as { permissions: string[] }).permissions.sort(), ['events.read', 'partners.read']);
    });

    test('l’audit porte aussi les permissions d’avant', async () => {
        const target = await newAdminWith(['users.read', 'statistics.read'], { label: 'perm9-avant' });
        const r = await setPermissions(target.userId, ['events.read']);
        assert.equal(r.status, 200, show(r));
        const [row] = await auditRows(target.userId);
        assert.ok(row, 'audit écrit');
        const before_ = JSON.stringify(row.old_value);
        for (const perm of ['users.read', 'statistics.read']) assert.ok(before_.includes(perm), `${perm} absente d’old_value : ${before_}`);
    });

    test('témoins : cible introuvable 404, cible SUPERADMIN 400, sans écriture (verts dès l’écriture)', async () => {
        const unknown = await setPermissions(randomUUID(), ['events.read']);
        assert.equal(unknown.status, 404, show(unknown));
        const superadmin = await setPermissions(superadminId, ['events.read']);
        assert.equal(superadmin.status, 400, show(superadmin));
        assert.deepEqual(await auditRows(superadminId), [], 'aucun audit');
    });

    test('RPC directe : remplace les droits, rend l’état d’avant et écrit l’audit dans la transaction', async () => {
        const target = await newAdminWith(['users.read'], { label: 'perm9-rpc' });
        const { data, error } = await service.rpc('admin_permissions_set', { p: { admin_id: target.userId, permissions: ['events.read'], actor_id: superadminId } });
        assert.equal(error, null, `admin_permissions_set : ${error?.code} ${error?.message}`);
        assert.equal((data as Row).ok, true, JSON.stringify(data));
        assert.deepEqual((data as { permissions: string[] }).permissions, ['events.read']);
        assert.deepEqual((data as { before: string[] }).before, ['users.read']);
        assert.deepEqual(await permissionsOf(target.userId), ['events.read']);
        assert.equal((await auditRows(target.userId)).length, 1, 'audit dans la transaction');
    });

    test('RPC directe : cible inconnue TARGET_NOT_FOUND, cible SUPERADMIN TARGET_IS_SUPERADMIN, rien d’écrit', async () => {
        const missing = await service.rpc('admin_permissions_set', { p: { admin_id: randomUUID(), permissions: ['events.read'], actor_id: superadminId } });
        assert.equal(missing.error, null, `admin_permissions_set : ${missing.error?.code} ${missing.error?.message}`);
        assert.deepEqual([(missing.data as Row).ok, (missing.data as Row).code], [false, 'TARGET_NOT_FOUND'], JSON.stringify(missing.data));
        const elevated = await service.rpc('admin_permissions_set', { p: { admin_id: superadminId, permissions: ['events.read'], actor_id: superadminId } });
        assert.equal(elevated.error, null, `admin_permissions_set : ${elevated.error?.code} ${elevated.error?.message}`);
        assert.deepEqual([(elevated.data as Row).ok, (elevated.data as Row).code], [false, 'TARGET_IS_SUPERADMIN'], JSON.stringify(elevated.data));
        assert.deepEqual(await auditRows(superadminId), [], 'aucun audit');
    });

    test('statique : la route passe par la RPC, plus de DELETE ni d’INSERT directs', () => {
        const code = printed(PERMISSIONS_ROUTE);
        assert.doesNotMatch(code, /from\(["']admin_permissions["']\)\s*\.(delete|insert|upsert)\(/, `${PERMISSIONS_ROUTE} : écriture directe restante`);
        const calls = code.match(/\.rpc\(["']admin_permissions_set["']/g) ?? [];
        assert.equal(calls.length, 1, `${PERMISSIONS_ROUTE} : un appel à admin_permissions_set attendu`);
    });
});

// ── partner/register ───────────────────────────────────────────────────────

function printed(rel: string): string {
    const sf = ts.createSourceFile(rel, fs.readFileSync(path.join(process.cwd(), rel), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    return ts.createPrinter({ removeComments: true }).printFile(sf);
}

/** Adresse neuve (/64 IPv6 aléatoire) : aucun couplage avec PARTNER_REGISTER_PER_IP_HOUR des autres suites. */
function freshIp(): Record<string, string> {
    const hex = randomBytes(4).toString('hex');
    return { 'x-forwarded-for': `2001:db8:${hex.slice(0, 4)}:${hex.slice(4)}::1` };
}

interface Candidate { company: string; phone: string; email: string; docs: RegistrationDocuments }

async function candidate(label: string): Promise<Candidate> {
    const company = `TEST Lot9 ${label} ${randomBytes(4).toString('hex')}`;
    assert.match(company, SAFE_LABEL, 'raison sociale sans caractère spécial : elle entre dans le SQL du déclencheur');
    return { company, phone: randomSenegalPhone('77'), email: randomEmail(`a33-${label}`), docs: await uploadRegistrationDocuments() };
}

async function register(c: Candidate): Promise<Reply> {
    const reg = await registerPartnerTwoStep({
        companyName: c.company,
        description: 'Organisateur fictif de la suite ecritures-ignorees.',
        address: '5 rue du Lot 9',
        city: 'Dakar',
        activities: ['ORGANISATEUR'],
        firstName: 'Khady',
        lastName: 'Lot9',
        phone: c.phone,
        email: c.email,
        password: STRONG_PASSWORD,
        confirmPassword: STRONG_PASSWORD,
        ...c.docs,
    }, { headers: freshIp() }); const last = reg.second ?? reg.first; return { status: last.status, body: last.body, text: JSON.stringify(last.body) }; // réponse du dernier appel
}

async function partnersOf(company: string): Promise<Row[]> {
    const { data, error } = await service.from('partners').select('id, status, user_id').eq('company_name', company);
    assert.equal(error, null, `partenaires : ${error?.message}`);
    return (data ?? []) as Row[];
}

async function authAccounts(phone: string): Promise<number> { // lot 9 bis (T38) : par numéro, l'email saisi n'est plus l'adresse du compte (adresse en attente, R87)
    return inspect(async (db) => Number((await db.query<{ n: number }>("SELECT count(*)::int AS n FROM auth.users WHERE phone IN ($1, ltrim($1, '+'))", [phone])).rows[0].n));
}

async function publicAccounts(phone: string): Promise<number> {
    const { count, error } = await service.from('users').select('id', { count: 'exact', head: true }).in('phone', [phone, phone.replace(/^\+/, '')]);
    assert.equal(error, null, `comptes : ${error?.message}`);
    return count ?? 0;
}

async function uploadsOf(c: Candidate): Promise<Array<{ id: string; claimed_at: string | null; claimed_partner_id: string | null }>> {
    const hashes = [c.docs.idCardUploadToken, c.docs.businessDocUploadToken].map(hashUploadToken);
    const { data, error } = await service.from('partner_document_uploads').select('id, claimed_at, claimed_partner_id').in('token_hash', hashes);
    assert.equal(error, null, `pièces : ${error?.message}`);
    assert.equal(data?.length, 2, 'les deux pièces de la candidature');
    return data ?? [];
}

/** Rien ne reste d'une inscription refusée : ni fiche, ni compte de connexion, ni profil. */
async function assertNothingLeft(c: Candidate): Promise<void> {
    assert.deepEqual(await partnersOf(c.company), [], 'fiche partenaire orpheline');
    assert.equal(await authAccounts(c.phone), 0, 'compte de connexion non retiré : le numéro reste pris au nouvel essai');
    assert.equal(await publicAccounts(c.phone), 0, 'profil non retiré');
}

const failActivities = (company: string): string => `
    IF EXISTS (SELECT 1 FROM public.partners p WHERE p.id = NEW.partner_id AND p.company_name = '${company}') THEN
        RAISE EXCEPTION 'panne simulée des activités ${SENTINEL}';
    END IF;`;

interface RegisterTrace { r: Reply; rpcCalls: number; directWrites: string[] }

/** Inscription avec le compte des appels à la RPC et des écritures REST directes. */
async function registerTraced(c: Candidate): Promise<RegisterTrace> {
    const previous = globalThis.fetch;
    let rpcCalls = 0;
    const directWrites: string[] = [];
    globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
        const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
        const { pathname } = new URL(href);
        if (pathname === '/rest/v1/rpc/partner_register_finalize') rpcCalls++;
        if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(method) && ['/rest/v1/users', '/rest/v1/partners', '/rest/v1/partner_activities', '/rest/v1/partner_document_uploads'].includes(pathname)) {
            directWrites.push(`${method} ${pathname}`);
        }
        return previous(input, init);
    }) as typeof fetch;
    try {
        return { r: await register(c), rpcCalls, directWrites };
    } finally {
        globalThis.fetch = previous;
    }
}

describe('A33 — POST /api/partner/register', () => {
    let other: TestPartner;

    before(async () => {
        other = await newPartner('a33-pieces');
    });

    test('panne sur les activités : 500 PARTNER_REGISTER_FAILED, aucune fiche, pièces libres, compte retiré, aucun texte de base', async () => {
        const c = await candidate('panne');
        const r = await withTrigger('partner_activities', failActivities(c.company), () => register(c));
        assert.equal(r.status, 500, `panne présentée comme un succès : ${show(r)}`);
        assert.equal(r.body.code, 'PARTNER_REGISTER_FAILED', show(r));
        assert.ok(!r.text.includes(SENTINEL), `texte de la base renvoyé : ${show(r)}`);
        await assertNothingLeft(c);
        for (const u of await uploadsOf(c)) assert.deepEqual([u.claimed_at, u.claimed_partner_id], [null, null], 'pièce restée rattachée après une inscription annulée');
    });

    test('après une panne, le même numéro et le même email peuvent s’inscrire', async () => {
        const c = await candidate('reprise');
        const failed = await withTrigger('partner_activities', failActivities(c.company), () => register(c));
        assert.equal(failed.status, 500, show(failed));
        const again = await register(c);
        assert.equal(again.status, 201, `nouvel essai refusé (appel 2 : 201, contrat 4.2) : ${show(again)}`);
        assert.equal(await publicAccounts(c.phone), 1, `nouvel essai : un compte créé : ${show(again)}`);
        assert.equal((await partnersOf(c.company)).length, 1, 'une seule fiche');
    });

    test('pièce consommée entre-temps : 409 INVALID_DOCUMENT_UPLOAD, aucune fiche, compte retiré', async () => {
        const c = await candidate('piece');
        const ids = (await uploadsOf(c)).map((u) => u.id);
        for (const id of ids) assert.match(id, /^[0-9a-f-]{36}$/, 'identifiant attendu');
        assert.match(other.partnerId, /^[0-9a-f-]{36}$/, 'identifiant attendu');
        const r = await withTrigger('partners', `
            IF NEW.company_name = '${c.company}' THEN
                UPDATE public.partner_document_uploads SET claimed_partner_id = '${other.partnerId}'::uuid, claimed_at = now()
                 WHERE id IN ('${ids[0]}'::uuid, '${ids[1]}'::uuid);
            END IF;`, () => register(c));
        assert.equal(r.status, 409, show(r));
        assert.equal(r.body.code, 'INVALID_DOCUMENT_UPLOAD', show(r));
        await assertNothingLeft(c);
    });

    test('succès : un seul appel à la RPC, aucune écriture REST directe, tout est écrit ensemble', async () => {
        const c = await candidate('ok');
        const { r, rpcCalls, directWrites } = await registerTraced(c);
        assert.equal(r.status, 201, `appel 2 avec le bon code : 201 (contrat 4.2) : ${show(r)}`);
        assert.deepEqual(directWrites, [], 'écritures directes de la route, hors transaction');
        assert.equal(rpcCalls, 1, `${rpcCalls} appel(s) à partner_register_finalize, un seul attendu`);
        const partners = await partnersOf(c.company);
        assert.equal(partners.length, 1, 'une fiche');
        assert.equal(partners[0].status, 'EN_ATTENTE');
        const partnerId = String(partners[0].id);
        const { data: activities, error: actErr } = await service.from('partner_activities').select('activity_type').eq('partner_id', partnerId);
        assert.equal(actErr, null, `activités : ${actErr?.message}`);
        assert.deepEqual((activities ?? []).map((a) => a.activity_type), ['ORGANISATEUR']);
        for (const u of await uploadsOf(c)) {
            assert.equal(u.claimed_partner_id, partnerId, 'pièce rattachée au dossier');
            assert.ok(u.claimed_at, 'date de rattachement');
        }
        const { count, error } = await service.from('audit_logs').select('id', { count: 'exact', head: true }).eq('action', 'PARTNER_REGISTRATION').eq('object_id', partnerId);
        assert.equal(error, null, `journal : ${error?.message}`);
        assert.equal(count, 1, 'un audit PARTNER_REGISTRATION');
    });

    test('statique : la route passe par la RPC et retire le compte en cas d’échec', () => {
        const code = printed(REGISTER_ROUTE);
        assert.doesNotMatch(code, /from\(["']users["']\)\s*\.upsert\(/, `${REGISTER_ROUTE} : écriture directe de users restante`);
        assert.doesNotMatch(code, /from\(["']partners["']\)\s*\.insert\(/, `${REGISTER_ROUTE} : écriture directe de partners restante`);
        assert.doesNotMatch(code, /from\(["']partner_activities["']\)/, `${REGISTER_ROUTE} : écriture directe de partner_activities restante`);
        assert.doesNotMatch(code, /claimRegistrationUploads/, `${REGISTER_ROUTE} : rattachement hors transaction restant`);
        const calls = code.match(/\.rpc\(["']partner_register_finalize["']/g) ?? [];
        assert.equal(calls.length, 1, `${REGISTER_ROUTE} : un appel à partner_register_finalize attendu`);
        assert.match(code, /auth\.admin\.deleteUser\(/, `${REGISTER_ROUTE} : compensation deleteUser absente`);
    });
});
