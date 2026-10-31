/**
 * Lot 1A.7 — supabase/hotfix/2026-10-31-lot1a/02-hotfix.sql doit contenir exactement la
 * migration du lot 1A entre BEGIN et COMMIT (régénérer avec scripts/build-hotfix-lot1a.mjs).
 */
import '../helpers/env';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

test('02-hotfix.sql = BEGIN + migration du lot 1A à l\'identique + COMMIT', async () => {
    const builder = await import(pathToFileURL(path.resolve(process.cwd(), 'scripts/build-hotfix-lot1a.mjs')).href);
    const migration = fs.readFileSync(path.resolve(process.cwd(), builder.MIGRATION), 'utf8');
    const hotfix = fs.readFileSync(path.resolve(process.cwd(), builder.HOTFIX), 'utf8').replace(/\r\n/g, '\n');
    assert.equal(hotfix, builder.buildHotfix(migration), '02-hotfix.sql diffère de la migration : relancer node scripts/build-hotfix-lot1a.mjs');
    assert.match(hotfix, /^BEGIN;$/m);
    assert.match(hotfix, /^COMMIT;$/m);
});
