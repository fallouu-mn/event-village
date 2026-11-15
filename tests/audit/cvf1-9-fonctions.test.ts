/**
 * Contre-vérification de la finition 1, attaque 9 — fonctions et politiques de la base.
 *
 *  a. Chaque fonction créée ou recopiée par les migrations 20261115… (liste tirée des fichiers eux-mêmes) existe et n'est
 *     exécutable ni par anon ni par authenticated (has_function_privilege, toutes les signatures) ; les fonctions
 *     SECURITY DEFINER fixent leur search_path.
 *  b. Les mêmes fonctions appelées par PostgREST (clé anon, puis jeton d'un compte connecté) : jamais exécutées.
 *  c. Aucune politique de lecture (SELECT ou ALL) d'une table du schéma public ne repose sur created_by (famille de S1).
 *  d. Tables de l'équipe sans RLS : controller_invitations et partner_controllers ne se lisent pas par l'API.
 * Lecture seule du catalogue (inspect). Sortie brute `[CVF1-9]`.
 */
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { newBuyer } from '../parcours/paiement-helpers';
import { inspect } from '../helpers/db';
import { assertFinition1Invariants } from '../helpers/finition1-invariants';
import { anonClient, restRows, restRpc, userClient } from './cvf1-helpers';

const MIGRATIONS = path.join(process.cwd(), 'supabase', 'migrations');

after(async () => {
    await assertFinition1Invariants('cvf1-9-fonctions');
});

function finitionFunctions(): string[] {
    const files = fs.readdirSync(MIGRATIONS).filter((f) => /^20261115\d{6}_.*\.sql$/.test(f)).sort();
    assert.ok(files.length >= 5, `migrations 20261115… : ${files.join(', ')}`);
    const names = new Set<string>();
    for (const f of files) {
        const sql = fs.readFileSync(path.join(MIGRATIONS, f), 'utf8');
        for (const m of sql.matchAll(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\.(\w+)\s*\(/gi)) names.add(String(m[1]));
    }
    return [...names].sort();
}

type ProcRow = { sig: string; proname: string; anon: boolean; auth: boolean; public_exec: boolean; secdef: boolean; config: string[] | null; args: string };

describe('a. droits des fonctions de la finition (catalogue)', () => {
    test('toutes présentes, aucune exécutable par anon ni authenticated, search_path fixé', async () => {
        const names = finitionFunctions();
        console.log(`[CVF1-9] fonctions des migrations 20261115… (${names.length}) : ${names.join(', ')}`);
        const rows = await inspect(async (c) => (await c.query<ProcRow>(`
            SELECT p.oid::regprocedure::text AS sig, p.proname,
                   has_function_privilege('anon', p.oid, 'EXECUTE') AS anon,
                   has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth,
                   EXISTS (SELECT 1 FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a
                            WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE') AS public_exec,
                   p.prosecdef AS secdef, p.proconfig AS config, pg_get_function_identity_arguments(p.oid) AS args
              FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = ANY($1::text[])
             ORDER BY 1`, [names])).rows);
        const missing = names.filter((n) => !rows.some((r) => r.proname === n));
        const open = rows.filter((r) => r.anon || r.auth || r.public_exec);
        const noPath = rows.filter((r) => r.secdef && !(r.config ?? []).some((x) => x.startsWith('search_path=')));
        for (const r of rows) console.log(`[CVF1-9] ${r.sig} : anon=${r.anon} authenticated=${r.auth} PUBLIC=${r.public_exec} definer=${r.secdef} config=${JSON.stringify(r.config)}`);
        assert.deepEqual(missing, [], `fonctions absentes de la base : ${missing.join(', ')}`);
        assert.deepEqual(open.map((r) => r.sig), [], `fonctions exécutables par l'API : ${open.map((r) => `${r.sig} (anon ${r.anon}, authenticated ${r.auth}, PUBLIC ${r.public_exec})`).join(' ; ')}`);
        assert.deepEqual(noPath.map((r) => r.sig), [], `SECURITY DEFINER sans search_path : ${noPath.map((r) => r.sig).join(', ')}`);
    });
});

describe('b. les mêmes fonctions par PostgREST', () => {
    test('clé anon puis jeton d’un compte connecté : aucune exécution', async () => {
        const names = finitionFunctions();
        const sigs = await inspect(async (c) => (await c.query<{ proname: string; args: string }>(`
            SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
              FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = ANY($1::text[])`, [names])).rows);
        const user = await newBuyer('cvf1-fn-curieux', { firstName: 'Curieux', lastName: 'Rest' });
        const breaches: string[] = [];
        for (const { proname, args } of sigs) {
            // Arguments nommés comme la signature : PostgREST trouve la fonction et ne peut refuser que par le droit
            const body: Record<string, unknown> = {};
            for (const part of args.split(',').map((x) => x.trim()).filter(Boolean)) {
                const [argName, ...type] = part.split(/\s+/);
                const t = type.join(' ');
                body[argName] = t === 'jsonb' ? {} : t === 'uuid' ? '00000000-0000-4000-8000-000000000000' : t === 'boolean' ? false : t === 'text' ? 'x' : null;
            }
            for (const [label, client] of [['anon', anonClient()], ['authenticated', userClient(user.accessToken)]] as const) {
                const r = await restRpc(client, proname, body);
                console.log(`[CVF1-9] REST ${label} ${proname}(${args}) → ${r.ok ? `EXÉCUTÉE ${JSON.stringify(r.data).slice(0, 160)}` : `refus ${r.error}`}`);
                if (r.ok) breaches.push(`${label} exécute ${proname}(${args})`);
            }
        }
        assert.deepEqual(breaches, [], `fonctions exécutées par PostgREST :\n${breaches.join('\n')}`);
    });
});

describe('c. politiques de lecture et créateur de la ligne', () => {
    test('aucune politique SELECT ou ALL du schéma public fondée sur created_by', async () => {
        const rows = await inspect(async (c) => (await c.query<{ tablename: string; policyname: string; cmd: string; qual: string | null }>(`
            SELECT tablename, policyname, cmd, qual FROM pg_policies
             WHERE schemaname = 'public' AND cmd IN ('SELECT', 'ALL')
               AND (COALESCE(qual, '') ~* 'created_by' OR COALESCE(with_check, '') ~* 'created_by')
             ORDER BY 1, 2`)).rows);
        for (const r of rows) console.log(`[CVF1-9] politique ${r.tablename}.${r.policyname} (${r.cmd}) : ${String(r.qual).slice(0, 200)}`);
        console.log(`[CVF1-9] politiques de lecture fondées sur created_by : ${rows.length}`);
        assert.deepEqual(rows.map((r) => `${r.tablename}.${r.policyname}`), [], 'politiques de lecture fondées sur created_by');
    });
});

describe('d. tables de l’équipe fermées à l’API', () => {
    test('controller_invitations, partner_controllers : aucun droit SELECT, aucune ligne par la REST', async () => {
        const grants = await inspect(async (c) => (await c.query<{ t: string; anon: boolean; auth: boolean }>(`
            SELECT t, has_table_privilege('anon', 'public.' || t, 'SELECT') AS anon, has_table_privilege('authenticated', 'public.' || t, 'SELECT') AS auth
              FROM unnest(ARRAY['controller_invitations', 'partner_controllers']) AS t`)).rows);
        for (const g of grants) console.log(`[CVF1-9] ${g.t} : SELECT anon=${g.anon} authenticated=${g.auth}`);
        assert.deepEqual(grants.filter((g) => g.anon || g.auth).map((g) => g.t), [], 'tables de l’équipe lisibles par l’API');
        const user = await newBuyer('cvf1-fn-lecteur', { firstName: 'Lecteur', lastName: 'Rest' });
        for (const t of ['controller_invitations', 'partner_controllers']) {
            const r = await restRows(userClient(user.accessToken), t);
            const a = await restRows(anonClient(), t);
            console.log(`[CVF1-9] REST ${t} : authenticated ${r.rows.length} ligne(s) (${r.error ?? 'sans erreur'}) ; anon ${a.rows.length} ligne(s) (${a.error ?? 'sans erreur'})`);
            assert.equal(r.rows.length + a.rows.length, 0, `${t} lisible par la REST`);
        }
    });
});
