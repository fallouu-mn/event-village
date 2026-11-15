/**
 * Finition 1 (équipe) — la migration de la finition (20261115000001) est rejouable : déjà appliquée par la CI depuis une
 * base vide, elle s'exécute encore deux fois de suite sans erreur, dans une transaction annulée (base LOCALE seulement),
 * et ne gère pas elle-même sa transaction (aucun BEGIN ni COMMIT). Modèle : migration-lot9quinquies-rejouable.test.ts.
 * En fin de suite : invariants des lots précédents et (f1) à (f4) sur toute la base.
 * Rouge avant correctif : le fichier n'existe pas ; l'échec nomme le fichier attendu.
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { inRolledBackTransaction } from '../helpers/db';
import { assertFinition1Invariants } from '../helpers/finition1-invariants';

const DIR = path.resolve(process.cwd(), 'supabase/migrations');

const FINITION1_MIGRATIONS = [
    '20261115000001_finition1_equipe.sql',
] as const;

after(async () => {
    await assertFinition1Invariants('migration-finition1-rejouable');
});

describe('Finition 1 — migration 20261115… rejouable (transaction annulée)', () => {
    test('les migrations 20261115… du dépôt sont exactement celles de la finition, dans cet ordre', () => {
        const present = fs.readdirSync(DIR).filter((f) => f.startsWith('20261115')).sort();
        assert.deepEqual(present, [...FINITION1_MIGRATIONS], `migrations 20261115… présentes : ${present.join(', ') || 'aucune'}`);
    });

    for (const name of FINITION1_MIGRATIONS) {
        test(`${name} : sans BEGIN ni COMMIT, appliquée deux fois de plus sans erreur`, async () => {
            const file = path.join(DIR, name);
            assert.ok(fs.existsSync(file), `migration de la finition 1 absente : supabase/migrations/${name}`);
            const sql = fs.readFileSync(file, 'utf8');
            assert.doesNotMatch(sql, /^\s*(BEGIN|COMMIT)\s*;\s*$/im, `${name} : la migration ne gère pas elle-même sa transaction`);
            await inRolledBackTransaction(async (c) => {
                await c.query(sql);
                await c.query(sql);
            });
        });
    }
});
