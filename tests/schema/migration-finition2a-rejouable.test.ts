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
    // 3, carte de l'étape Accès : position (ensemble, au Sénégal, obligatoire pour soumettre), repère déplacé de plus de
    // 200 m, recherche de lieu (réponses gardées, une requête par seconde)
    '20261116000003_f2a_carte.sql',
    // Correctifs de la contre-vérification de la finition 2a (liste complétée, signalée au rapport) : T1, équipe d'une
    // fiche SUSPENDU ; T2, écart de caisse ; T3-T4, avis de lieu ; T5, affiche de la route ; T6, adresses citées
    '20261116000004_f2acv_equipe_suspendue.sql',
    '20261116000005_f2acv_ecart_caisse.sql',
    '20261116000006_f2acv_avis_de_lieu.sql',
    '20261116000007_f2acv_affiche_format.sql',
    '20261116000008_f2acv_stockage_cite.sql',
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
