/**
 * Lot 9 quater — les migrations du lot (20261111000001 à …06) sont rejouables : chacune, déjà appliquée par la CI depuis
 * une base vide, s'exécute encore deux fois de suite sans erreur, dans une transaction annulée (base LOCALE seulement),
 * et ne gère pas elle-même sa transaction (aucun BEGIN ni COMMIT). Modèle : migration-lot9ter-rejouable.test.ts (dont la
 * garde des 12 contraintes gelées continue de tourner sur la base qui porte aussi les migrations de ce lot).
 * En fin de suite : invariants (a) à (x) et (q1) à (q8) sur toute la base.
 * Rouge avant correctif : les fichiers n'existent pas ; chaque échec nomme le fichier attendu.
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { inRolledBackTransaction } from '../helpers/db';
import { assertLot9quaterInvariants } from '../helpers/lot9quater-invariants';

const DIR = path.resolve(process.cwd(), 'supabase/migrations');

const LOT9QUATER_MIGRATIONS = [
    '20261111000001_lot9quater_comptes.sql',
    '20261111000002_lot9quater_sms.sql',
    '20261111000003_lot9quater_droits.sql',
    '20261111000004_lot9quater_email.sql',
    '20261111000005_lot9quater_argent.sql',
    '20261111000006_lot9quater_invites_zones.sql',
] as const;

after(async () => {
    await assertLot9quaterInvariants('migration-lot9quater-rejouable');
});

describe('Lot 9 quater — migrations 20261111000001 à …06 rejouables (transaction annulée)', () => {
    test('les migrations 20261111… du dépôt sont exactement les six du lot, dans cet ordre', () => {
        const present = fs.readdirSync(DIR).filter((f) => f.startsWith('20261111')).sort();
        assert.deepEqual(present, [...LOT9QUATER_MIGRATIONS], `migrations 20261111… présentes : ${present.join(', ') || 'aucune'}`);
    });

    for (const name of LOT9QUATER_MIGRATIONS) {
        test(`${name} : sans BEGIN ni COMMIT, appliquée deux fois de plus sans erreur`, async () => {
            const file = path.join(DIR, name);
            assert.ok(fs.existsSync(file), `migration du lot 9 quater absente : supabase/migrations/${name}`);
            const sql = fs.readFileSync(file, 'utf8');
            assert.doesNotMatch(sql, /^\s*(BEGIN|COMMIT)\s*;\s*$/im, `${name} : la migration ne gère pas elle-même sa transaction`);
            await inRolledBackTransaction(async (c) => {
                await c.query(sql);
                await c.query(sql);
            });
        });
    }
});
