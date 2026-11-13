/**
 * Audit de sécurité du module événements (branche audit/evenements) — inventaire du catalogue de la base LOCALE.
 *
 * Source des tableaux 1 (fonctions exécutables) et 2 (lectures) de docs/audit-evenements-rapport.md : la suite imprime
 * l'état réel après `supabase db reset` + `npm run seed:test`, sans rien écrire (transactions READ ONLY de
 * tests/helpers/db.ts) :
 *  - fonctions de tous les schémas exposés ou sensibles exécutables par anon / authenticated (SECURITY DEFINER compris) ;
 *  - politiques RLS de public, storage et realtime avec leurs clauses USING / WITH CHECK et leurs rôles ;
 *  - droits SELECT de table et de colonne de anon et authenticated, colonnes masquées ;
 *  - vues (propriétaire, options, définition) ;
 *  - buckets du stockage, tables de la publication temps réel et leur REPLICA IDENTITY ;
 *  - lignes visibles par un visiteur et par quatre comptes du seed, table par table.
 */
import '../helpers/env';
import { before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Client } from 'pg';
import { inspect } from '../helpers/db';
import { FIXTURE_USERS } from '../helpers/fixture-data';

type Row = Record<string, unknown>;

const AS_USERS = ['CLIENT', 'PARTNER_A', 'CONTROLLER_A', 'ADMIN', 'SUSPENDED'] as const;

function print(title: string, rows: Row[]): void {
    console.log(`\n[AUDIT-CATALOGUE] ${title} — ${rows.length} ligne(s)`);
    for (const r of rows) console.log(`[AUDIT-CATALOGUE] ${JSON.stringify(r)}`);
}

async function rows(c: Client, sql: string, params: unknown[] = []): Promise<Row[]> {
    return (await c.query(sql, params)).rows as Row[];
}

/** Imprime une section ; une requête refusée (droit, objet absent) est imprimée comme telle, la suite continue. */
async function section(c: Client, title: string, sql: string): Promise<Row[]> {
    await c.query('SAVEPOINT section');
    try {
        const out = await rows(c, sql);
        await c.query('RELEASE SAVEPOINT section');
        print(title, out);
        return out;
    } catch (err) {
        await c.query('ROLLBACK TO SAVEPOINT section');
        console.log(`\n[AUDIT-CATALOGUE] ${title} — REQUÊTE EN ÉCHEC : ${(err as Error).message}`);
        return [];
    }
}

describe('Audit — inventaire du catalogue (base locale, lecture seule)', () => {
    const relations: Row[] = [];
    const helpers: Row[] = [];

    before(async () => {
        await inspect(async (c) => {
            await section(c, 'Fonctions exécutables par anon ou authenticated hors pg_catalog/information_schema', `
                SELECT n.nspname AS schema, p.proname AS name, pg_get_function_identity_arguments(p.oid) AS args,
                       p.prosecdef AS secdef, has_function_privilege('anon', p.oid, 'EXECUTE') AS anon,
                       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth
                  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                 WHERE n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
                   AND n.nspname IN ('public', 'graphql_public', 'storage', 'realtime')
                   AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))
                 ORDER BY 1, 2, 3`);

            helpers.push(...await section(c, 'Définition des aides exécutables de public (hors fonctions d’extensions)', `
                SELECT p.proname AS name, pg_get_functiondef(p.oid) AS def
                  FROM pg_proc p
                 WHERE p.pronamespace = 'public'::regnamespace
                   AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))
                   AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
                 ORDER BY 1`));

            await section(c, 'Politiques RLS (public, storage, realtime)', `
                SELECT schemaname AS schema, tablename AS rel, policyname AS policy, permissive, roles::text AS roles, cmd,
                       qual, with_check
                  FROM pg_policies WHERE schemaname IN ('public', 'storage', 'realtime') ORDER BY 1, 2, 3`);

            const rel = await rows(c, `
                SELECT n.nspname AS schema, c.relname AS rel, c.relkind AS kind, c.relrowsecurity AS rls,
                       has_table_privilege('anon', c.oid, 'SELECT') AS anon_select,
                       has_table_privilege('authenticated', c.oid, 'SELECT') AS auth_select,
                       (SELECT string_agg(a.attname, ',' ORDER BY a.attnum) FROM pg_attribute a
                         WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
                           AND has_column_privilege('anon', c.oid, a.attnum, 'SELECT')) AS anon_cols,
                       (SELECT string_agg(a.attname, ',' ORDER BY a.attnum) FROM pg_attribute a
                         WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
                           AND has_column_privilege('authenticated', c.oid, a.attnum, 'SELECT')) AS auth_cols,
                       (SELECT string_agg(a.attname, ',' ORDER BY a.attnum) FROM pg_attribute a
                         WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
                           AND NOT has_column_privilege('authenticated', c.oid, a.attnum, 'SELECT')) AS auth_hidden_cols
                  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                 WHERE n.nspname IN ('public', 'storage') AND c.relkind IN ('r', 'v', 'm', 'p', 'f')
                 ORDER BY 1, 2`);
            relations.push(...rel);
            print('Relations : droits SELECT de anon et authenticated, colonnes lisibles et masquées', rel);

            await section(c, 'Vues et vues matérialisées de public', `
                SELECT c.relname AS view, pg_get_userbyid(c.relowner) AS owner, c.reloptions::text AS options,
                       pg_get_viewdef(c.oid, true) AS def
                  FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('v', 'm') ORDER BY 1`);

            await section(c, 'Buckets du stockage', `
                SELECT id, name, public, file_size_limit, allowed_mime_types::text AS mimes FROM storage.buckets ORDER BY 1`);

            await section(c, 'Publication temps réel', `
                SELECT pt.pubname, pt.schemaname AS schema, pt.tablename AS rel,
                       (SELECT c.relreplident FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                         WHERE n.nspname = pt.schemaname AND c.relname = pt.tablename) AS replica_identity
                  FROM pg_publication_tables pt ORDER BY 1, 2, 3`);

            await section(c, 'Privilèges par défaut', `
                SELECT pg_get_userbyid(d.defaclrole) AS owner, n.nspname AS schema, d.defaclobjtype AS type, d.defaclacl::text AS acl
                  FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace ORDER BY 1, 2, 3`);
        });

        // Lignes visibles, table par table, pour un visiteur puis pour des comptes du seed (aucune écriture).
        // Droit de table OU droit sur au moins une colonne (count(*) n'exige qu'une colonne lisible)
        const readable = relations.filter((r) => r.schema === 'public' && (r.anon_select || r.auth_select || r.anon_cols || r.auth_cols)).map((r) => String(r.rel));
        const ids = await inspect(async (c) => rows(c, `SELECT id, email FROM public.users WHERE email = ANY($1::text[])`,
            [AS_USERS.map((k) => FIXTURE_USERS[k].email)]));
        const total = await inspect(async (c) => {
            const out: Row = {};
            for (const t of readable) out[t] = Number((await c.query(`SELECT count(*)::int AS n FROM public."${t}"`)).rows[0].n);
            return out;
        });
        const asAnon = await inspect(async (c) => {
            const out: Row = {};
            for (const t of readable) {
                await c.query('SAVEPOINT s');
                try {
                    out[t] = Number((await c.query(`SELECT count(*)::int AS n FROM public."${t}"`)).rows[0].n);
                    await c.query('RELEASE SAVEPOINT s');
                } catch (err) {
                    await c.query('ROLLBACK TO SAVEPOINT s');
                    out[t] = `refus : ${(err as Error).message}`;
                }
            }
            return out;
        }, 'anon');
        const perUser: Record<string, Row> = {};
        for (const key of AS_USERS) {
            const id = ids.find((r) => r.email === FIXTURE_USERS[key].email)?.id;
            if (!id) { perUser[key] = { absent: true }; continue; }
            perUser[key] = await inspect(async (c) => {
                await c.query(`SELECT set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: id, role: 'authenticated' })]);
                const out: Row = {};
                for (const t of readable) {
                    await c.query('SAVEPOINT s');
                    try {
                        out[t] = Number((await c.query(`SELECT count(*)::int AS n FROM public."${t}"`)).rows[0].n);
                        await c.query('RELEASE SAVEPOINT s');
                    } catch (err) {
                        await c.query('ROLLBACK TO SAVEPOINT s');
                        out[t] = `refus : ${(err as Error).message}`;
                    }
                }
                return out;
            }, 'authenticated');
        }
        print('Lignes visibles par table (total / anon / comptes du seed)', readable.map((t) => ({
            rel: t, total: total[t], anon: asAnon[t], ...Object.fromEntries(AS_USERS.map((k) => [k, perUser[k][t]])),
        })));
    });

    /**
     * AUD-06 (cause) — une aide RLS exécutable par anon/authenticated qui accorde un droit selon l'appelant doit tenir
     * compte du statut du compte (comme is_admin() depuis 20261110000001_lot9ter_rls.sql:116-117). Rouge aujourd'hui :
     * has_role (20260906000004_user_roles_multi_role.sql:192-197), is_controller (même fichier:214-216), auth_user_role
     * (même fichier:220) et is_partner_owner (0003_rls.sql:33-38) ne lisent jamais users.status.
     */
    test('AUD-06 : chaque aide RLS exécutable par les rôles API tient compte du statut du compte', () => {
        assert.ok(helpers.length > 0, 'précondition : définitions des aides lues dans le catalogue');
        const offenders = helpers.filter((h) => !/\bstatus\b/.test(String(h.def))).map((h) => String(h.name)).sort();
        assert.deepEqual(offenders, [], `aides RLS qui ignorent le statut du compte (SUSPENDU, SUPPRIME) : ${offenders.join(', ')}`);
    });
});
