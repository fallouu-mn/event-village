/**
 * Lot 9 bis (contrat 3.1) — les migrations du lot (20261109000001 à …12) sont rejouables : chacune, déjà appliquée
 * par la CI depuis une base vide, s'exécute encore deux fois de suite sans erreur, dans une transaction annulée
 * (base LOCALE seulement), et ne gère pas elle-même sa transaction (aucun BEGIN ni COMMIT). Modèle :
 * tests/schema/migration-lot9-rejouable.test.ts:20-57 (inchangé, comme les rejeux des lots 6, 7 et 8 : aucune
 * contrainte qu'ils recréent n'est élargie, A3).
 *
 * Rouge avant correctif : les douze fichiers n'existent pas (M01 et M02 par S-INFRA, M03 et M09 par S-D, M04 par S-B,
 * M05 par S-H, M06 par S-A, M07 par S-V, M08 par S-C, M10 par S-G, M11 par S-E, M12 par S-I) ; chaque échec nomme
 * le fichier attendu. En fin de suite, assertLot9bisInvariants contrôle toute la base, après toutes les suites
 * tests/parcours (rouge par la garde de schéma tant que M12 n'est pas livrée).
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { inRolledBackTransaction } from '../helpers/db';
import { assertLot9bisInvariants } from '../helpers/lot9bis-invariants';

const DIR = path.resolve(process.cwd(), 'supabase/migrations');

/** Migrations du lot 9 bis, dans l'ordre du contrat (section 3.1). */
const LOT9BIS_MIGRATIONS = [
    '20261109000001_lot9bis_reglages.sql',
    '20261109000002_lot9bis_transfert_statut.sql',
    '20261109000003_lot9bis_registre.sql',
    '20261109000004_lot9bis_droits.sql',
    '20261109000005_lot9bis_samirpay.sql',
    '20261109000006_lot9bis_argent.sql',
    '20261109000007_lot9bis_versements.sql',
    '20261109000008_lot9bis_cycle.sql',
    '20261109000009_lot9bis_messages.sql',
    '20261109000010_lot9bis_email.sql',
    '20261109000011_lot9bis_textes.sql',
    '20261109000012_lot9bis_mode_reel.sql',
] as const;

function readMigration(name: string): string {
    const file = path.join(DIR, name);
    assert.ok(fs.existsSync(file), `migration du lot 9 bis absente : supabase/migrations/${name} (contrat, section 3.1)`);
    return fs.readFileSync(file, 'utf8');
}

after(async () => {
    await assertLot9bisInvariants('migration-lot9bis-rejouable');
});

describe('Lot 9 bis — migrations 20261109000001 à …12 rejouables (transaction annulée)', () => {
    test('les migrations 20261109… du dépôt sont exactement les douze du contrat, dans cet ordre', () => {
        const present = fs.readdirSync(DIR).filter((f) => f.startsWith('20261109')).sort();
        assert.deepEqual(present, [...LOT9BIS_MIGRATIONS], `migrations 20261109… présentes : ${present.join(', ') || 'aucune'}`);
    });

    for (const name of LOT9BIS_MIGRATIONS) {
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
