/**
 * Finition 3a (argent de l'administration) — les migrations de la finition (20261117…) sont rejouables : déjà appliquées
 * par la CI depuis une base vide, chacune s'exécute encore deux fois de suite sans erreur, dans une transaction annulée
 * (base LOCALE seulement), et ne gère pas elle-même sa transaction (aucun BEGIN ni COMMIT).
 * Modèle : migration-finition1-rejouable.test.ts. La liste grandit avec chaque migration du lot (fichier du lot).
 * Rouge avant correctif : le fichier n'existe pas ; l'échec nomme le fichier attendu.
 * Fin de suite : invariants de toutes les livraisons précédentes (assertFinition1Invariants).
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { inRolledBackTransaction } from '../helpers/db';
import { assertFinition1Invariants } from '../helpers/finition1-invariants';

const DIR = path.resolve(process.cwd(), 'supabase/migrations');

const FINITION3A_MIGRATIONS = [
    // 1b, sécurité d'abord : permission de l'auteur en base (partner_status_set, admin_permissions_set)
    '20261117000001_f3a_securite.sql',
    // 2 : réserve de prudence (réglages), synthèse et détail des chiffres, solde SamirPay en cache de 5 minutes
    '20261117000002_f3a_reserve.sql',
    '20261117000003_f3a_synthese.sql',
    '20261117000004_f3a_solde.sql',
] as const;

after(async () => {
    await assertFinition1Invariants('migration-finition3a-rejouable');
});

describe('Finition 3a — migrations 20261117… rejouables (transaction annulée)', () => {
    test('les migrations 20261117… du dépôt sont exactement celles de la finition, dans cet ordre', () => {
        const present = fs.readdirSync(DIR).filter((f) => f.startsWith('20261117')).sort();
        assert.deepEqual(present, [...FINITION3A_MIGRATIONS], `migrations 20261117… présentes : ${present.join(', ') || 'aucune'}`);
    });

    for (const name of FINITION3A_MIGRATIONS) {
        test(`${name} : sans BEGIN ni COMMIT, appliquée deux fois de plus sans erreur`, async () => {
            const file = path.join(DIR, name);
            assert.ok(fs.existsSync(file), `migration de la finition 3a absente : supabase/migrations/${name}`);
            const sql = fs.readFileSync(file, 'utf8');
            assert.doesNotMatch(sql, /^\s*(BEGIN|COMMIT)\s*;\s*$/im, `${name} : la migration ne gère pas elle-même sa transaction`);
            await inRolledBackTransaction(async (c) => {
                await c.query(sql);
                await c.query(sql);
            });
        });
    }
});
