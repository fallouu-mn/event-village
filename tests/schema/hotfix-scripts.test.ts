/**
 * Lot 1A.7 — validation des scripts de hotfix sur la base LOCALE (jamais le projet distant) :
 *  - 01-detection.sql s'exécute en lecture seule et renvoie les colonnes attendues ;
 *  - 02-hotfix.sql s'applique deux fois de suite sans erreur (idempotence, transaction) ;
 *  - 03-verification.sql ne renvoie que des OK sur une base migrée.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';
import { inspect } from '../helpers/db';

const DIR = path.resolve(process.cwd(), 'supabase/hotfix/2026-10-31-lot1a');
const read = (f: string) => fs.readFileSync(path.join(DIR, f), 'utf8');

describe('Scripts de hotfix du lot 1A', () => {
    test('01-detection.sql : exécution en lecture seule', async () => {
        const res = await inspect((c) => c.query(read('01-detection.sql')));
        const rows = Array.isArray(res) ? res[res.length - 1].rows : res.rows;
        const fields = (Array.isArray(res) ? res[res.length - 1].fields : res.fields).map((f: { name: string }) => f.name);
        assert.deepEqual(fields, ['controle', 'gravite', 'objet_id', 'cree_le', 'details']);
        const byControl: Record<string, number> = {};
        for (const r of rows) byControl[`${r.controle} [${r.gravite}]`] = (byControl[`${r.controle} [${r.gravite}]`] || 0) + 1;
        console.log('Détection sur la base locale de test :', JSON.stringify(byControl, null, 1));
        assert.ok(rows.some((r: { controle: string }) => r.controle === 'H_inventaire_comptes'), 'inventaire des comptes présent');
    });

    test('02-hotfix.sql : appliqué deux fois sans erreur (idempotent)', async () => {
        const client = new Client({ connectionString: process.env.SUPABASE_DB_URL });
        await client.connect();
        try {
            await client.query(read('02-hotfix.sql'));
            await client.query(read('02-hotfix.sql'));
        } finally {
            await client.end();
        }
    });

    test('03-verification.sql : tous les points OK', async () => {
        const res = await inspect((c) => c.query(read('03-verification.sql')));
        const rows = Array.isArray(res) ? res[res.length - 1].rows : res.rows;
        for (const r of rows) console.log(`${r.statut.padEnd(5)} ${r.point} — ${r.detail}`);
        const failed = rows.filter((r: { statut: string }) => r.statut !== 'OK').map((r: { point: string; detail: string }) => `${r.point} (${r.detail})`);
        assert.ok(rows.length >= 20, `au moins 20 points vérifiés, obtenu ${rows.length}`);
        assert.deepEqual(failed, [], `points en ÉCHEC :\n${failed.join('\n')}`);
    });
});
