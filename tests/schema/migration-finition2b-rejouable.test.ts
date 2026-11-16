/**
 * Finition 2b — les migrations de la finition (20261119…) sont rejouables : déjà appliquées par la CI depuis une base
 * vide, chacune s'exécute encore deux fois de suite sans erreur, dans une transaction annulée (base LOCALE seulement),
 * et ne gère pas elle-même sa transaction (aucun BEGIN ni COMMIT). Modèle : migration-finition2a-rejouable.test.ts.
 * La liste grandit avec chaque point de la finition (un commit par point).
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { inRolledBackTransaction } from '../helpers/db';
import { assertFinition1Invariants } from '../helpers/finition1-invariants';

const DIR = path.resolve(process.cwd(), 'supabase/migrations');
const FINITION2B_MIGRATIONS = [
    // A (sécurité faible, corrigée en premier) : une suppression de catégorie ne laisse jamais une zone sans catégorie
    '20261119000001_f2b_categorie_zone.sql',
    // A, E-22 : couleur au contrôle et consigne d'entrée dès la création (normalisation commune, event_create)
    '20261119000002_f2b_couleur_consigne.sql',
    // A, E-22 : couleur au contrôle posée par la base quand elle manque (distincte, jamais confondable avec un verdict)
    '20261119000003_f2b_couleur_auto.sql',
] as const;

after(async () => {
    await assertFinition1Invariants('migration-finition2b-rejouable');
});

describe('Finition 2b — migrations 20261119… rejouables (transaction annulée)', () => {
    test('les migrations 20261119… du dépôt sont exactement celles de la finition, dans cet ordre', () => {
        const present = fs.readdirSync(DIR).filter((f) => f.startsWith('20261119')).sort();
        assert.deepEqual(present, [...FINITION2B_MIGRATIONS], `migrations 20261119… présentes : ${present.join(', ') || 'aucune'}`);
    });
    for (const name of FINITION2B_MIGRATIONS) {
        test(`${name} : sans BEGIN ni COMMIT, appliquée deux fois de plus sans erreur`, async () => {
            const file = path.join(DIR, name);
            assert.ok(fs.existsSync(file), `migration de la finition 2b absente : supabase/migrations/${name}`);
            const sql = fs.readFileSync(file, 'utf8');
            assert.doesNotMatch(sql, /^\s*(BEGIN|COMMIT)\s*;\s*$/im, `${name} : la migration ne gère pas elle-même sa transaction`);
            await inRolledBackTransaction(async (db) => {
                await db.query(sql);
                await db.query(sql);
            });
        });
    }
});
