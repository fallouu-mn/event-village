/**
 * Finition 3d (recours et suppléance) — les migrations de la finition (20261120…) sont rejouables : déjà appliquées par la
 * CI depuis une base vide, chacune s'exécute encore deux fois de suite sans erreur, dans une transaction annulée (base
 * LOCALE seulement), et ne gère pas elle-même sa transaction (aucun BEGIN ni COMMIT).
 * Modèle : migration-finition3b-rejouable.test.ts. La liste grandit avec chaque migration de la finition ; une migration
 * nommée ici avant d'exister rend la suite rouge (l'échec nomme le fichier attendu).
 * Fin de suite : invariants de la 3d et de toutes les livraisons précédentes (assertFinition3dInvariants).
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { inRolledBackTransaction } from '../helpers/db';
import { assertFinition3dInvariants } from '../helpers/finition3d-invariants';

const DIR = path.resolve(process.cwd(), 'supabase/migrations');

const FINITION3D_MIGRATIONS = [
    // 4b : liste des organisatrices de la page Équipe d'un admin (recherche sans accents)
    '20261120000001_f3d_equipe.sql',
    // 4a : espèces marquées rendues par un admin, avis à l'organisatrice
    '20261120000002_f3d_especes.sql',
    // 3 : changer le rôle (SUPERADMIN), mot de passe et code des actions sensibles, garde du rôle SUPERADMIN
    '20261120000003_f3d_role.sql',
    // 2b et 2c : codes de secours du SUPERADMIN (empreintes seulement), « J'ai perdu mon téléphone »
    '20261120000004_f3d_codes_secours.sql',
    // 2a et 2c : changement du numéro d'un administrateur, prouvé par un code au nouveau numéro
    '20261120000005_f3d_numero_admin.sql',
    // Contre-vérification T1 : account_phone_finalize refuse un compte ADMIN ou SUPERADMIN (profil client)
    '20261120000006_f3d_cv_numero_profil.sql',
    // Contre-vérification T2 : révocation immédiate (session encore ouverte exigée, codes effacés)
    '20261120000007_f3d_cv_revocation.sql',
] as const;

after(async () => {
    await assertFinition3dInvariants('migration-finition3d-rejouable');
});

describe('Finition 3d — migrations 20261120… rejouables (transaction annulée)', () => {
    test('les migrations 20261120… du dépôt sont exactement celles de la finition, dans cet ordre', () => {
        const present = fs.readdirSync(DIR).filter((f) => f.startsWith('20261120')).sort();
        assert.deepEqual(present, [...FINITION3D_MIGRATIONS], `migrations 20261120… présentes : ${present.join(', ') || 'aucune'}`);
    });

    for (const name of FINITION3D_MIGRATIONS) {
        test(`${name} : sans BEGIN ni COMMIT, appliquée deux fois de plus sans erreur`, async () => {
            const file = path.join(DIR, name);
            assert.ok(fs.existsSync(file), `migration de la finition 3d absente : supabase/migrations/${name}`);
            const sql = fs.readFileSync(file, 'utf8');
            assert.doesNotMatch(sql, /^\s*(BEGIN|COMMIT)\s*;\s*$/im, `${name} : la migration ne gère pas elle-même sa transaction`);
            await inRolledBackTransaction(async (c) => {
                await c.query(sql);
                await c.query(sql);
            });
        });
    }
});
