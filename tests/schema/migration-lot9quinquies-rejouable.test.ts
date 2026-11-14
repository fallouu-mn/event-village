/**
 * Lot 9 quinquies — les migrations du lot (20261112000001 à …14, dont 11 à 14 des correctifs de la contre-vérification) sont rejouables : chacune, déjà appliquée par la CI
 * depuis une base vide, s'exécute encore deux fois de suite sans erreur, dans une transaction annulée (base LOCALE seulement),
 * et ne gère pas elle-même sa transaction (aucun BEGIN ni COMMIT). Modèle : migration-lot9quater-rejouable.test.ts.
 * En fin de suite : invariants (a) à (x), (q1) à (q8) et (p) sur toute la base.
 * Rouge avant correctif : les fichiers n'existent pas ; chaque échec nomme le fichier attendu.
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { inRolledBackTransaction } from '../helpers/db';
import { assertLot9quinquiesInvariants } from '../helpers/lot9quinquies-invariants';

const DIR = path.resolve(process.cwd(), 'supabase/migrations');

const LOT9QUINQUIES_MIGRATIONS = [
    '20261112000001_lot9quinquies_admin_sms.sql',
    '20261112000002_lot9quinquies_connexion.sql',
    '20261112000003_lot9quinquies_support.sql',
    '20261112000004_lot9quinquies_recuperation.sql',
    '20261112000005_lot9quinquies_fiche_partenaire.sql',
    '20261112000006_lot9quinquies_comptes_admin.sql',
    '20261112000007_lot9quinquies_admin_step_up.sql',
    '20261112000008_lot9quinquies_messages.sql',
    '20261112000009_lot9quinquies_check_reel.sql',
    '20261112000010_lot9quinquies_recuperation_email.sql',
    // Correctifs de la contre-vérification (modification signalée au rapport)
    '20261112000011_lot9quinquies_admin_code_rls.sql',
    '20261112000012_lot9quinquies_identifiants_gotrue.sql',
    '20261112000013_lot9quinquies_affectations_fiche.sql',
    '20261112000014_lot9quinquies_salles_concurrence.sql',
] as const;

after(async () => {
    await assertLot9quinquiesInvariants('migration-lot9quinquies-rejouable');
});

describe('Lot 9 quinquies — migrations 20261112… rejouables (transaction annulée)', () => {
    test('les migrations 20261112… du dépôt sont exactement celles du lot, dans cet ordre', () => {
        const present = fs.readdirSync(DIR).filter((f) => f.startsWith('20261112')).sort();
        assert.deepEqual(present, [...LOT9QUINQUIES_MIGRATIONS], `migrations 20261112… présentes : ${present.join(', ') || 'aucune'}`);
    });

    for (const name of LOT9QUINQUIES_MIGRATIONS) {
        test(`${name} : sans BEGIN ni COMMIT, appliquée deux fois de plus sans erreur`, async () => {
            const file = path.join(DIR, name);
            assert.ok(fs.existsSync(file), `migration du lot 9 quinquies absente : supabase/migrations/${name}`);
            const sql = fs.readFileSync(file, 'utf8');
            assert.doesNotMatch(sql, /^\s*(BEGIN|COMMIT)\s*;\s*$/im, `${name} : la migration ne gère pas elle-même sa transaction`);
            await inRolledBackTransaction(async (c) => {
                await c.query(sql);
                await c.query(sql);
            });
        });
    }
});
