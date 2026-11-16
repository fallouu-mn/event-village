/**
 * Finition 3b (administration claire) — les migrations de la finition (20261118…) sont rejouables : déjà appliquées par la
 * CI depuis une base vide, chacune s'exécute encore deux fois de suite sans erreur, dans une transaction annulée (base
 * LOCALE seulement), et ne gère pas elle-même sa transaction (aucun BEGIN ni COMMIT).
 * Modèle : migration-finition3a-rejouable.test.ts. La liste grandit avec chaque migration de la finition.
 * Rouge avant correctif : le fichier n'existe pas ; l'échec nomme le fichier attendu.
 * Fin de suite : invariants de toutes les livraisons précédentes (assertFinition3aInvariants).
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { inRolledBackTransaction } from '../helpers/db';
import { assertFinition3aInvariants } from '../helpers/finition3a-invariants';

const DIR = path.resolve(process.cwd(), 'supabase/migrations');

const FINITION3B_MIGRATIONS = [
    // 1 : « À faire aujourd'hui » (E-29)
    '20261118000001_f3b_todo.sql',
] as const;

after(async () => {
    await assertFinition3aInvariants('migration-finition3b-rejouable');
});

describe('Finition 3b — migrations 20261118… rejouables (transaction annulée)', () => {
    test('les migrations 20261118… du dépôt sont exactement celles de la finition, dans cet ordre', () => {
        const present = fs.readdirSync(DIR).filter((f) => f.startsWith('20261118')).sort();
        assert.deepEqual(present, [...FINITION3B_MIGRATIONS], `migrations 20261118… présentes : ${present.join(', ') || 'aucune'}`);
    });

    for (const name of FINITION3B_MIGRATIONS) {
        test(`${name} : sans BEGIN ni COMMIT, appliquée deux fois de plus sans erreur`, async () => {
            const file = path.join(DIR, name);
            assert.ok(fs.existsSync(file), `migration de la finition 3b absente : supabase/migrations/${name}`);
            const sql = fs.readFileSync(file, 'utf8');
            assert.doesNotMatch(sql, /^\s*(BEGIN|COMMIT)\s*;\s*$/im, `${name} : la migration ne gère pas elle-même sa transaction`);
            await inRolledBackTransaction(async (c) => {
                await c.query(sql);
                await c.query(sql);
            });
        });
    }
});
