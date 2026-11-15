/**
 * Finition 2a — les migrations de la finition (20261116…) sont rejouables : déjà appliquées par la CI depuis une base
 * vide, chacune s'exécute encore deux fois de suite sans erreur, dans une transaction annulée (base LOCALE seulement),
 * et ne gère pas elle-même sa transaction (aucun BEGIN ni COMMIT). Modèle : migration-finition1-rejouable.test.ts.
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
const FINITION2A_MIGRATIONS = [
    // 1a, sécurité, corrigée en premier : fiche SUSPENDU, événements en lecture seule
    '20261116000001_f2a_fiche_suspendue.sql',
    // 2, fin retenue (E-01) : équipe et « Mes soirées » sur event_end_at
    '20261116000002_f2a_fin_retenue.sql',
] as const;

after(async () => {
    await assertFinition1Invariants('migration-finition2a-rejouable');
});

describe('Finition 2a — migrations 20261116… rejouables (transaction annulée)', () => {
    test('les migrations 20261116… du dépôt sont exactement celles de la finition, dans cet ordre', () => {
        const present = fs.readdirSync(DIR).filter((f) => f.startsWith('20261116')).sort();
        assert.deepEqual(present, [...FINITION2A_MIGRATIONS], `migrations 20261116… présentes : ${present.join(', ') || 'aucune'}`);
    });
    for (const name of FINITION2A_MIGRATIONS) {
        test(`${name} : sans BEGIN ni COMMIT, appliquée deux fois de plus sans erreur`, async () => {
            const file = path.join(DIR, name);
            assert.ok(fs.existsSync(file), `migration de la finition 2a absente : supabase/migrations/${name}`);
            const sql = fs.readFileSync(file, 'utf8');
            assert.doesNotMatch(sql, /^\s*(BEGIN|COMMIT)\s*;\s*$/im, `${name} : la migration ne gère pas elle-même sa transaction`);
            await inRolledBackTransaction(async (db) => {
                await db.query(sql);
                await db.query(sql);
            });
        });
    }
});
