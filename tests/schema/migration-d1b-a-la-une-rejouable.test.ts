/**
 * Design 1b (À LA UNE) — la migration 20261122000001_d1b_a_la_une.sql (seule migration du design 1b) est rejouable :
 * déjà appliquée par la CI depuis une base vide, elle s'exécute encore deux fois de suite sans erreur, dans une
 * transaction annulée (base LOCALE seulement), et ne gère pas elle-même sa transaction (aucun BEGIN ni COMMIT).
 * Modèle : migration-finition2b-rejouable.test.ts. Après les deux passages, dans la même transaction : RLS activée sans
 * aucune politique, aucun droit pour anon ni authenticated, service_role en lecture seule, fonctions SECURITY DEFINER à
 * search_path fixé, trigger de retrait automatique présent une seule fois.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { inRolledBackTransaction } from '../helpers/db';

const DIR = path.resolve(process.cwd(), 'supabase/migrations');
const NAME = '20261122000001_d1b_a_la_une.sql';

describe('Design 1b — migration « À la une » rejouable (transaction annulée)', () => {
    test(`${NAME} : sans BEGIN ni COMMIT, appliquée deux fois de plus sans erreur ; droits et RLS conformes ensuite`, async () => {
        const file = path.join(DIR, NAME);
        assert.ok(fs.existsSync(file), `migration absente : supabase/migrations/${NAME}`);
        const sql = fs.readFileSync(file, 'utf8');
        assert.doesNotMatch(sql, /^\s*(BEGIN|COMMIT)\s*;\s*$/im, `${NAME} : la migration ne gère pas elle-même sa transaction`);
        await inRolledBackTransaction(async (db) => {
            await db.query(sql);
            await db.query(sql);

            const t = (await db.query<{ rls: boolean; policies: number }>(`
                SELECT c.relrowsecurity AS rls,
                       (SELECT count(*)::int FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = 'home_featured') AS policies
                  FROM pg_class c WHERE c.oid = 'public.home_featured'::regclass`)).rows[0];
            assert.deepEqual(t, { rls: true, policies: 0 }, 'home_featured : RLS activée, aucune politique');

            const grants = (await db.query<{ role: string; sel: boolean; ins: boolean; upd: boolean; del: boolean }>(`
                SELECT r AS role,
                       has_table_privilege(r, 'public.home_featured', 'SELECT') AS sel,
                       has_table_privilege(r, 'public.home_featured', 'INSERT') AS ins,
                       has_table_privilege(r, 'public.home_featured', 'UPDATE') AS upd,
                       has_table_privilege(r, 'public.home_featured', 'DELETE') AS del
                  FROM unnest(ARRAY['anon', 'authenticated', 'service_role']) AS r ORDER BY r`)).rows;
            assert.deepEqual(grants, [
                { role: 'anon', sel: false, ins: false, upd: false, del: false },
                { role: 'authenticated', sel: false, ins: false, upd: false, del: false },
                { role: 'service_role', sel: true, ins: false, upd: false, del: false },
            ], 'droits de table');

            const fns = (await db.query<{ sig: string; anon: boolean; auth: boolean; svc: boolean; secdef: boolean; path: boolean }>(`
                SELECT p.oid::regprocedure::text AS sig,
                       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon,
                       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth,
                       has_function_privilege('service_role', p.oid, 'EXECUTE') AS svc,
                       p.prosecdef AS secdef,
                       COALESCE(p.proconfig::text, '') LIKE '%search_path=public%' AS path
                  FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname LIKE 'home\\_featured%' ORDER BY 1`)).rows;
            console.log(`[D1B-MIG] ${fns.map((f) => `${f.sig} svc=${f.svc}`).join(' ; ')}`);
            assert.deepEqual(fns.filter((f) => f.anon || f.auth).map((f) => f.sig), [], 'fonction exécutable par anon ou authenticated');
            assert.deepEqual(fns.filter((f) => !f.secdef || !f.path).map((f) => f.sig), [], 'fonction sans SECURITY DEFINER ni search_path fixé');
            const callable = fns.filter((f) => f.svc).map((f) => f.sig.replace(/^public\./, '').replace(/\(.*$/, '')).sort();
            assert.deepEqual(callable, ['home_featured_add', 'home_featured_admin_list', 'home_featured_candidates', 'home_featured_public',
                'home_featured_remove', 'home_featured_reorder', 'home_featured_set_window'], 'fonctions appelables par le service_role');

            const trg = (await db.query<{ n: number }>(`
                SELECT count(*)::int AS n FROM pg_trigger
                 WHERE tgrelid = 'public.events'::regclass AND tgname = 'trg_home_featured_on_event_status' AND NOT tgisinternal`)).rows[0];
            assert.equal(trg.n, 1, 'trigger de retrait automatique présent une seule fois');
        });
    });
});
