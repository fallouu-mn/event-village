/**
 * Lot 9 (contrat 3.1) — les migrations du lot (20261108000001 à …05) sont rejouables : chacune, déjà appliquée par
 * la CI depuis une base vide, s'exécute encore deux fois de suite sans erreur, dans une transaction annulée (base
 * LOCALE seulement), et ne gère pas elle-même sa transaction (aucun BEGIN ni COMMIT). Modèle :
 * tests/schema/migration-lot8-rejouable.test.ts. Aucune reprise de données au lot : pas de bloc sur données
 * fabriquées.
 *
 * Rouge avant correctif : les cinq fichiers n'existent pas (fix(9.3-PO3) pour M1, fix(9.0s) pour M2, fix(9.1s) pour
 * M3, fix(9.2s) pour M4, fix(9.4-A16s) pour M5) ; chaque échec nomme le fichier attendu. En fin de suite,
 * assertLot9Invariants contrôle toute la base, après toutes les suites tests/parcours.
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { inRolledBackTransaction } from '../helpers/db';
import { assertLot9Invariants } from '../helpers/lot9-invariants';

const DIR = path.resolve(process.cwd(), 'supabase/migrations');

/** Migrations du lot 9, dans l'ordre du contrat (section 3.1). */
const LOT9_MIGRATIONS = [
    '20261108000001_lot9_securite.sql',
    '20261108000002_lot9_invitations.sql',
    '20261108000003_lot9_decouverte.sql',
    '20261108000004_lot9_compte.sql',
    '20261108000005_lot9_nettoyage.sql',
] as const;

function readMigration(name: string): string {
    const file = path.join(DIR, name);
    assert.ok(fs.existsSync(file), `migration du lot 9 absente : supabase/migrations/${name} (contrat, section 3.1)`);
    return fs.readFileSync(file, 'utf8');
}

after(async () => {
    await assertLot9Invariants('migration-lot9-rejouable');
});

describe('Lot 9 — migrations 20261108000001 à …05 rejouables (transaction annulée)', () => {
    test('les migrations 20261108… du dépôt sont exactement les cinq du contrat, dans cet ordre', () => {
        const present = fs.readdirSync(DIR).filter((f) => f.startsWith('20261108')).sort();
        assert.deepEqual(present, [...LOT9_MIGRATIONS], `migrations 20261108… présentes : ${present.join(', ') || 'aucune'}`);
    });

    for (const name of LOT9_MIGRATIONS) {
        test(`${name} : sans BEGIN ni COMMIT, appliquée deux fois de plus sans erreur`, async () => {
            const sql = readMigration(name);
            assert.doesNotMatch(sql, /^\s*(BEGIN|COMMIT)\s*;\s*$/im, `${name} : la migration ne gère pas elle-même sa transaction`);
            await inRolledBackTransaction(async (c) => {
                await c.query(sql);
                await c.query(sql);
            });
        });
    }
});
