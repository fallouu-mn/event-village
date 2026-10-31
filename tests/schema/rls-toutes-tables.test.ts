/**
 * Lot 1A.6 — garde-fou permanent : toutes les tables du schéma public ont la RLS activée.
 *
 * Lecture du catalogue sur la base LOCALE (tests/helpers/db.ts, transaction READ ONLY) :
 * l'état de la RLS n'est pas exposé par l'API REST.
 */
import '../helpers/env';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inspect } from '../helpers/db';

test('toutes les tables du schéma public ont la RLS activée', async () => {
    const { rows } = await inspect((c) =>
        c.query<{ table_name: string; rls: boolean }>(
            `SELECT c.relname AS table_name, c.relrowsecurity AS rls
               FROM pg_class c
               JOIN pg_namespace n ON n.oid = c.relnamespace
              WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
              ORDER BY c.relname`
        )
    );
    console.log(`Tables du schéma public : ${rows.length}`);
    for (const r of rows) console.log(`  ${r.rls ? 'RLS ' : 'SANS'}  ${r.table_name}`);
    const without = rows.filter((r) => !r.rls).map((r) => r.table_name);
    assert.ok(rows.length > 0, 'aucune table trouvée dans public');
    assert.deepEqual(without, [], `tables sans RLS : ${without.join(', ')}`);
});
