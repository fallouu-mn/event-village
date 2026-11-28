/**
 * Lot 12d — les six migrations du lot (20261228000001-006, appliquées nulle part avant la fusion) se rejouent sans
 * erreur : appliquées deux fois de plus dans une transaction annulée, dans l'ordre ; aucun BEGIN ni COMMIT.
 * Droits en base : fonctions publiques nouvelles et recopiées au rôle de service seulement (ni anon, ni authenticated, ni
 * PUBLIC) ; aides du schéma private à aucun rôle de l'API (clé de service comprise) ; tables nouvelles (order_issues,
 * order_closure_keeps) fermées à anon et authenticated ; colonnes nouvelles de products (allergens, spice_level) non
 * lisibles par la REST (droits par colonne du lot 12c). Les recopies (aucune ligne perdue) sont contrôlées sans base par
 * tests/parcours/l12d-statique.test.ts.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { inRolledBackTransaction } from '../helpers/db';

const DIR = path.resolve(process.cwd(), 'supabase/migrations');
const FILES = fs.readdirSync(DIR).filter((f) => f.includes('_l12d_') && f.endsWith('.sql')).sort();

const PUBLIC_FUNCTIONS = [
    // nouvelles
    'order_courier_day', 'order_courier_invitation_view', 'order_delivery_step', 'order_watch_tick', 'order_absence_decide',
    'order_issue_report', 'order_issue_close', 'order_admin_list', 'order_admin_view', 'order_closure_orders', 'order_closure_keep',
    'order_venue_pause', 'order_partner_pauses', 'order_product_details_set',
    // recopiées
    'order_view', 'order_payable_refusal', 'order_quote_compute', 'order_venue_menu',
];
const PRIVATE_FUNCTIONS = [
    'order_person_short', 'order_courier_status_notify', 'order_admin_allowed', 'order_admin_role', 'order_closure_hits',
    'order_closure_notify', 'order_close_apply',
];

describe('Lot 12d — migrations', () => {
    test('six migrations dans l’intervalle 20261228…, après celles de main', () => {
        assert.deepEqual(FILES, [
            '20261228000001_l12d_schema.sql', '20261228000002_l12d_livreur.sql', '20261228000003_l12d_absence_signalement.sql',
            '20261228000004_l12d_administration.sql', '20261228000005_l12d_fermetures_pause.sql', '20261228000006_l12d_avis.sql',
        ]);
        const all = fs.readdirSync(DIR).filter((f) => /^\d{14}_.+\.sql$/.test(f)).sort();
        assert.ok(all.filter((f) => f < FILES[0]).includes('20261226000003_l12b_garde_prix.sql'), 'après les migrations du 12b');
    });

    test('sans BEGIN ni COMMIT, appliquées deux fois de plus sans erreur', async () => {
        const sqls = FILES.map((f) => fs.readFileSync(path.join(DIR, f), 'utf8'));
        for (const [i, sql] of sqls.entries()) assert.doesNotMatch(sql, /^\s*(BEGIN|COMMIT)\s*;\s*$/im, FILES[i]);
        await inRolledBackTransaction(async (c) => {
            for (const sql of sqls) await c.query(sql);
            for (const sql of sqls) await c.query(sql);
        });
    });

    test('droits en base : publiques au rôle de service seul ; private à personne ; tables et colonnes nouvelles fermées à la REST', async () => {
        await inRolledBackTransaction(async (c) => {
            const { rows: pub } = await c.query<{ proname: string; anon: boolean; auth: boolean; svc: boolean; pub: boolean }>(
                `SELECT p.proname, has_function_privilege('anon', p.oid, 'EXECUTE') AS anon, has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth,
                        has_function_privilege('service_role', p.oid, 'EXECUTE') AS svc,
                        EXISTS (SELECT 1 FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a WHERE a.grantee = 0) AS pub
                   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                  WHERE n.nspname = 'public' AND p.proname = ANY ($1) ORDER BY p.proname`, [PUBLIC_FUNCTIONS]);
            assert.deepEqual(pub.map((r) => r.proname).sort(), [...PUBLIC_FUNCTIONS].sort());
            for (const r of pub) assert.deepEqual([r.proname, r.anon, r.auth, r.pub, r.svc], [r.proname, false, false, false, true]);
            const { rows: priv } = await c.query<{ proname: string; anon: boolean; auth: boolean; svc: boolean }>(
                `SELECT p.proname, has_function_privilege('anon', p.oid, 'EXECUTE') AS anon, has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth,
                        has_function_privilege('service_role', p.oid, 'EXECUTE') AS svc
                   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                  WHERE n.nspname = 'private' AND p.proname = ANY ($1) ORDER BY p.proname`, [PRIVATE_FUNCTIONS]);
            assert.deepEqual(priv.map((r) => r.proname).sort(), [...PRIVATE_FUNCTIONS].sort());
            for (const r of priv) assert.deepEqual([r.proname, r.anon, r.auth, r.svc], [r.proname, false, false, false]);
            const { rows: tables } = await c.query<{ t: string; anon: boolean; auth: boolean; rls: boolean }>(
                `SELECT t, has_table_privilege('anon', t, 'SELECT') AS anon, has_table_privilege('authenticated', t, 'SELECT') AS auth,
                        (SELECT relrowsecurity FROM pg_class WHERE oid = t::regclass) AS rls
                   FROM unnest(ARRAY['public.order_issues', 'public.order_closure_keeps']) AS t`);
            for (const r of tables) assert.deepEqual([r.t, r.anon, r.auth, r.rls], [r.t, false, false, true]);
            const { rows: cols } = await c.query<{ col: string; anon: boolean; auth: boolean }>(
                `SELECT col, has_column_privilege('anon', 'public.products', col, 'SELECT') AS anon,
                        has_column_privilege('authenticated', 'public.products', col, 'SELECT') AS auth
                   FROM unnest(ARRAY['allergens', 'spice_level']) AS col`);
            for (const r of cols) assert.deepEqual([r.col, r.anon, r.auth], [r.col, false, false]);
            // Pause : aucune écriture REST sur venues (RLS active, aucune règle d'écriture), seulement order_venue_pause
            const { rows: venues } = await c.query<{ rls: boolean; writes: string }>(
                `SELECT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.venues'::regclass) AS rls,
                        (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'venues' AND cmd IN ('UPDATE', 'INSERT', 'DELETE', 'ALL'))::text AS writes`);
            assert.deepEqual([venues[0].rls, venues[0].writes], [true, '0'], 'aucune écriture REST de la pause');
        });
    });
});
