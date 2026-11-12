/**
 * Lot 9 ter, tâche 9t.1 (consigne 0.1, arbitrages 1 à 5 ; contrat 5.A, A.1.5 suite 1, invariants x1 et x2) — audit
 * des écritures REST dans le schéma public, sur le catalogue de la base LOCALE.
 *  1. x2 : aucune politique d'écriture (INSERT, UPDATE, DELETE, ALL) ni aucun droit INSERT, UPDATE, DELETE ou TRUNCATE
 *     pour anon et authenticated sur une relation de public (tables, vues, vues matérialisées, tables étrangères).
 *     Imprime `[RLS-ECRITURES]` une ligne par relation : sortie brute reprise au rapport (tableaux A et B) ;
 *  2. x1 : aucune colonne de la liste sensible écrivable par anon ou authenticated (droit de colonne ET politique) ;
 *     garde qui nomme chaque colonne lue absente du schéma (15 de partners, 10 de users, commission_rate) ;
 *  3. privilèges par défaut : une table créée par postgres dans public (transaction annulée) n'accorde ni INSERT, ni
 *     UPDATE, ni DELETE, ni TRUNCATE à anon ni à authenticated (D2) ;
 *  4. aides RLS is_admin() et is_superadmin() : compte ACTIF exigé (lecture de users.status), STABLE, SECURITY
 *     DEFINER, search_path = public, exécutables par anon et authenticated (D3, E1, X18) ;
 *  5. garde finale de 20261110000001 : une politique d'écriture ajoutée à la main (transaction annulée) fait échouer
 *     la migration, lue sur disque, avec un message qui la nomme.
 *
 * Les requêtes x1 et x2 sont celles de tests/helpers/lot9ter-invariants.ts (contrat 6.2), extraites de
 * LOT9TER_INVARIANT_SQL : un seul oracle pour la suite et pour les invariants.
 *
 * Rouge avant correctif (fix(9t.1), migration 20261110000001_lot9ter_rls) :
 *  - 1 : les 25 politiques d'écriture du tableau A (M/0003_rls.sql:102 à :335, M/0007:103, :115, M/20260902000003:32,
 *    M/20261105000003:76, M/20261105000001:146, M/20260906000004:443) et les droits par défaut de Supabase ;
 *  - 2 : partners.status (partners_insert_auth, partners_update_owner), payments.status (payments_admin_update),
 *    hall_reservations.deposit_amount (hall_reservations_update)… ;
 *  - 3 : SUPPOSÉ rouge (droits par défaut de Supabase pour les tables créées par postgres) ; s'il est vert au run
 *    « avant », il est annoncé vert au rapport ;
 *  - 4 : is_admin() et is_superadmin() ne lisent pas users (M/20260906000004:202-211) ;
 *  - 5 : fichier supabase/migrations/20261110000001_lot9ter_rls.sql absent.
 *
 * Suite sans écriture : lectures du catalogue en transaction READ ONLY, essais DDL dans des transactions annulées
 * (inRolledBackTransaction) ; aucun appel d'invariants (écart signalé, comme rls-toutes-tables).
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { inRolledBackTransaction, inspect } from '../helpers/db';
import { LOT9TER_INVARIANT_SQL } from '../helpers/lot9ter-invariants';

const MIGRATION_FILE = path.join(process.cwd(), 'supabase', 'migrations', '20261110000001_lot9ter_rls.sql');
const GUARD_MESSAGE = 'lot 9 ter (0.1) : écritures REST encore possibles';

interface Violation { regle: string; objet: string; detail: string }

/**
 * CTE x1_cols, x1 et x2 extraites de la requête des invariants du lot (contrat 6.1 : elles précèdent `-- (x3)`).
 * Échec explicite si la requête change de forme : jamais un oracle recopié à part.
 */
function x1x2Ctes(): string {
    const start = LOT9TER_INVARIANT_SQL.indexOf('x1_cols AS (');
    const end = LOT9TER_INVARIANT_SQL.indexOf('-- (x3)');
    assert.ok(start > 0 && end > start, 'LOT9TER_INVARIANT_SQL : CTE x1_cols, x1 et x2 introuvables avant « -- (x3) » (contrat 6.1)');
    const ctes = LOT9TER_INVARIANT_SQL.slice(start, end).trimEnd();
    assert.ok(ctes.endsWith(','), 'LOT9TER_INVARIANT_SQL : la CTE x2 doit être suivie d’une virgule (contrat 6.1)');
    assert.match(ctes, /\nx2 AS \(/, 'LOT9TER_INVARIANT_SQL : CTE x2 absente (contrat 6.2)');
    return ctes.slice(0, -1);
}

async function violationsOf(rule: 'x1' | 'x2'): Promise<Violation[]> {
    const sql = `WITH ${x1x2Ctes()}\nSELECT regle, objet, detail FROM ${rule} ORDER BY 1, 2, 3`;
    return inspect(async (db) => (await db.query<Violation>(sql)).rows);
}

function lines(rows: Violation[]): string {
    return rows.map((r) => `(${r.regle}) ${r.objet} : ${r.detail}`).join('\n');
}

/** Colonnes lues par x1 (contrat 6, garde de schéma, partie A) : toutes présentes aujourd'hui (PROUVÉ). */
const X1_READ_COLUMNS: ReadonlyArray<[string, readonly string[]]> = [
    ['partners', ['status', 'is_verified', 'resubmitted_at', 'rejection_reason', 'suspended_reason', 'subscription_plan_id', 'trial_started_at',
        'trial_ends_at', 'is_founder', 'phone_verified', 'user_id', 'id_card_url', 'business_doc_url', 'ninea', 'rccm']],
    ['users', ['role', 'status', 'referral_status', 'demo_account', 'email_verified_at', 'email_pending', 'phone_verified_at', 'referral_code',
        'phone', 'email']],
    ['referral_commissions', ['commission_rate']],
];

const ROLES = ['anon', 'authenticated'] as const;
const WRITE_PRIVILEGES = ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'] as const;

describe('9t.1 — audit des écritures REST dans public (x1, x2)', () => {
    test('x2 : aucune politique d’écriture ni aucun droit INSERT, UPDATE, DELETE ou TRUNCATE pour anon et authenticated dans public', async () => {
        const relations = await inspect(async (db) => (await db.query<{ relname: string; relkind: string; rls: boolean; policies: string; anon: string; auth: string }>(
            `SELECT c.relname::text AS relname, c.relkind::text AS relkind, c.relrowsecurity AS rls,
                    COALESCE((SELECT string_agg(p.cmd || ' ' || p.policyname, ', ' ORDER BY p.cmd, p.policyname)
                                FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = c.relname), '') AS policies,
                    concat(CASE WHEN has_any_column_privilege('anon', c.oid, 'INSERT') THEN 'I' END,
                           CASE WHEN has_any_column_privilege('anon', c.oid, 'UPDATE') THEN 'U' END,
                           CASE WHEN has_table_privilege('anon', c.oid, 'DELETE') THEN 'D' END,
                           CASE WHEN has_table_privilege('anon', c.oid, 'TRUNCATE') THEN 'T' END) AS anon,
                    concat(CASE WHEN has_any_column_privilege('authenticated', c.oid, 'INSERT') THEN 'I' END,
                           CASE WHEN has_any_column_privilege('authenticated', c.oid, 'UPDATE') THEN 'U' END,
                           CASE WHEN has_table_privilege('authenticated', c.oid, 'DELETE') THEN 'D' END,
                           CASE WHEN has_table_privilege('authenticated', c.oid, 'TRUNCATE') THEN 'T' END) AS auth
               FROM pg_class c
              WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
              ORDER BY c.relname`)).rows);
        for (const r of relations) {
            console.log(`[RLS-ECRITURES] ${r.relname} (relkind ${r.relkind}, RLS ${r.rls ? 'oui' : 'non'}) politiques : ${r.policies || 'aucune'} ; anon : ${r.anon || '-'} ; authenticated : ${r.auth || '-'}`);
        }
        const writable = relations.filter((r) => r.anon !== '' || r.auth !== '').length;
        const writePolicies = relations.reduce((n, r) => n + r.policies.split(', ').filter((p) => /^(INSERT|UPDATE|DELETE|ALL) /.test(p)).length, 0);
        console.log(`[RLS-ECRITURES] total : ${relations.length} relation(s), ${writable} avec un droit d’écriture pour anon ou authenticated, ${writePolicies} politique(s) d’écriture`);
        assert.ok(relations.length > 0, 'aucune relation lue dans public : connexion à la base locale ?');

        const rows = await violationsOf('x2');
        assert.deepEqual(rows, [], `x2 : ${rows.length} écriture(s) REST encore possible(s) dans public :\n${lines(rows)}`);
    });

    test('x1 : aucune colonne de la liste sensible écrivable par anon ou authenticated', async () => {
        const missing = await inspect(async (db) => {
            const out: string[] = [];
            for (const [table, columns] of X1_READ_COLUMNS) {
                const { rows } = await db.query<{ attname: string }>(
                    `SELECT a.attname::text AS attname FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid
                      WHERE c.relnamespace = 'public'::regnamespace AND c.relname = $1 AND a.attnum > 0 AND NOT a.attisdropped`, [table]);
                const present = new Set(rows.map((r) => r.attname));
                for (const column of columns) if (!present.has(column)) out.push(`colonne public.${table}.${column} absente (lue par x1, contrat 6)`);
            }
            return out;
        });
        assert.deepEqual(missing, [], `colonnes de la liste sensible absentes du schéma :\n${missing.join('\n')}`);

        const expanded = await inspect(async (db) => {
            const sql = `WITH ${x1x2Ctes()}\nSELECT count(*)::int AS n FROM x1_cols`;
            return (await db.query<{ n: number }>(sql)).rows[0].n;
        });
        console.log(`[RLS-ECRITURES] x1 : ${expanded} colonne(s) sensible(s) examinée(s) dans public (liste nominative et suffixes)`);
        assert.ok(expanded >= 26, `x1 : ${expanded} colonne(s) développée(s), au moins les 26 de la liste nominative attendues`);

        const rows = await violationsOf('x1');
        assert.deepEqual(rows, [], `x1 : ${rows.length} colonne(s) sensible(s) écrivable(s) par REST :\n${lines(rows)}`);
    });

    test('privilèges par défaut : une table créée par postgres dans public n’est ni insérable, ni modifiable, ni supprimable, ni vidable par anon ou authenticated', async () => {
        const granted = await inRolledBackTransaction(async (db) => {
            await db.query('CREATE TABLE public.__lot9ter_sonde_acl (id integer)');
            const out: string[] = [];
            for (const role of ROLES) {
                for (const privilege of WRITE_PRIVILEGES) {
                    const { rows } = await db.query<{ ok: boolean }>(
                        'SELECT has_table_privilege($1, \'public.__lot9ter_sonde_acl\', $2) AS ok', [role, privilege]);
                    if (rows[0].ok) out.push(`${role} : ${privilege}`);
                }
            }
            return out;
        });
        assert.deepEqual(granted, [], `table neuve de public : droits d’écriture accordés par défaut (ALTER DEFAULT PRIVILEGES FOR ROLE postgres attendu, D2) :\n${granted.join('\n')}`);
    });

    test('aides RLS is_admin() et is_superadmin() : compte ACTIF exigé, STABLE, SECURITY DEFINER, search_path = public, exécutables par anon et authenticated', async () => {
        const rows = await inspect(async (db) => (await db.query<{ proname: string; args: string; src: string; volatile: string; definer: boolean; config: string[] | null; anon_exec: boolean; auth_exec: boolean }>(
            `SELECT p.proname::text AS proname, pg_get_function_identity_arguments(p.oid) AS args, p.prosrc AS src,
                    p.provolatile::text AS volatile, p.prosecdef AS definer, p.proconfig AS config,
                    has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec,
                    has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_exec
               FROM pg_proc p
              WHERE p.pronamespace = 'public'::regnamespace AND p.proname IN ('is_admin', 'is_superadmin')
              ORDER BY p.proname, args`)).rows);
        const problems: string[] = [];
        for (const name of ['is_admin', 'is_superadmin']) {
            const defs = rows.filter((r) => r.proname === name);
            if (defs.length !== 1 || defs[0].args !== '') {
                problems.push(`${name}() : ${defs.length} définition(s) (${defs.map((d) => `(${d.args})`).join(', ')}), une seule sans argument attendue`);
                continue;
            }
            const f = defs[0];
            if (!/\busers\b/.test(f.src)) problems.push(`${name}() ne lit pas public.users (statut du compte ignoré, D3) : ${f.src.trim()}`);
            if (!/ACTIF/.test(f.src)) problems.push(`${name}() n’exige pas un compte ACTIF (D3) : ${f.src.trim()}`);
            if (f.volatile !== 's') problems.push(`${name}() : volatilité ${f.volatile}, STABLE attendu`);
            if (!f.definer) problems.push(`${name}() : SECURITY DEFINER attendu`);
            if (!(f.config ?? []).includes('search_path=public')) problems.push(`${name}() : search_path = public attendu (E1, X18) : ${JSON.stringify(f.config)}`);
            if (!f.anon_exec) problems.push(`${name}() : EXECUTE pour anon attendu (aide RLS du groupe a)`);
            if (!f.auth_exec) problems.push(`${name}() : EXECUTE pour authenticated attendu (aide RLS du groupe a)`);
        }
        assert.deepEqual(problems, [], `aides RLS is_admin() et is_superadmin() :\n${problems.join('\n')}`);
    });

    test('garde finale de 20261110000001 : une politique d’écriture ajoutée à la main fait échouer la migration', async () => {
        assert.ok(fs.existsSync(MIGRATION_FILE), 'supabase/migrations/20261110000001_lot9ter_rls.sql absent : livré par fix(9t.1) (S-RLS, contrat A.1.3)');
        const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');
        const outcome = await inRolledBackTransaction(async (db) => {
            await db.query('CREATE POLICY lot9ter_derive ON public.partners FOR UPDATE TO authenticated USING (true)');
            await db.query('SAVEPOINT migration');
            try {
                await db.query(sql);
                return { error: null as string | null };
            } catch (err) {
                await db.query('ROLLBACK TO SAVEPOINT migration');
                return { error: (err as Error).message };
            }
        });
        assert.notEqual(outcome.error, null, 'la migration est passée malgré la politique d’écriture lot9ter_derive ajoutée à la main : garde finale absente (X19)');
        assert.ok(outcome.error!.includes(GUARD_MESSAGE), `message de la garde attendu (« ${GUARD_MESSAGE} ») : ${outcome.error}`);
        assert.ok(outcome.error!.includes('politique partners.lot9ter_derive (UPDATE)'), `la garde doit nommer la politique ajoutée : ${outcome.error}`);
    });
});
