/**
 * Lot 11c-c — la migration 20261215000001 (lecture des tables pour les écrans) se rejoue sans erreur : appliquée deux
 * fois de plus dans une transaction annulée ; elle passe après toutes les migrations existantes ; ses deux fonctions
 * sont NOUVELLES (aucune recopie, donc aucune ligne d'une définition précédente à garder) ; droits : la fonction publique
 * au rôle de service seulement, l'aide de private à aucun rôle de l'API (clé de service comprise).
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { inRolledBackTransaction, writeLocal } from '../helpers/db';

const DIR = path.resolve(process.cwd(), 'supabase/migrations');
const FILE = '20261215000001_l11cc_lectures_tables.sql';

describe('Lot 11c-c — migration de lecture des écrans des tables', () => {
    test('présente, après toutes les migrations existantes de main (11c-a comprise)', () => {
        const all = fs.readdirSync(DIR).filter((f) => /^\d{14}_.+\.sql$/.test(f)).sort();
        assert.ok(all.includes(FILE), `migration absente : supabase/migrations/${FILE}`);
        assert.ok(all.includes('20261201000007_l11c_cv_correctifs.sql'), 'migrations du lot 11c-a présentes');
        assert.ok(all.filter((f) => f < FILE).length > 0);
    });

    test('sans BEGIN ni COMMIT, appliquée deux fois de plus sans erreur', async () => {
        const sql = fs.readFileSync(path.join(DIR, FILE), 'utf8');
        assert.doesNotMatch(sql, /^\s*(BEGIN|COMMIT)\s*;\s*$/im);
        await inRolledBackTransaction(async (c) => {
            await c.query(sql);
            await c.query(sql);
        });
    });

    test('droits : event_table_report au rôle de service seulement ; event_table_edit_refusal à aucun rôle de l’API', async () => {
        const rows = await writeLocal(async (c) => (await c.query<{ fn: string; anon: boolean; auth: boolean; svc: boolean }>(
            `SELECT x.fn,
                    has_function_privilege('anon', x.fn, 'execute') AS anon,
                    has_function_privilege('authenticated', x.fn, 'execute') AS auth,
                    has_function_privilege('service_role', x.fn, 'execute') AS svc
               FROM unnest($1::text[]) AS x(fn)`,
            [['public.event_table_report(jsonb)', 'private.event_table_edit_refusal(uuid,uuid)']])).rows);
        const bad = rows.filter((r) => r.anon || r.auth || (r.fn.startsWith('public.') ? !r.svc : r.svc));
        assert.deepEqual(bad, [], `droits inattendus : ${JSON.stringify(bad)}`);
    });
});
