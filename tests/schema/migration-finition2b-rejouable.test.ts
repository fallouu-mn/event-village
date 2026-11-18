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
    // A, E-26 : prix minimum refusé sous la bonne catégorie (normalisation commune)
    '20261119000004_f2b_prix_minimum.sql',
    // B, E-23 : portes et zones dès la création (fonctions communes extraites de event_zones_save)
    '20261119000005_f2b_zones_creation.sql',
    // D, E-28 : cadence des avis de lieu ET de date (une heure glissante, regroupés ; dernière heure : 2 SMS au plus)
    '20261119000006_f2b_cadence_avis.sql',
    // D, E-27 : aperçu d'une modification (fenêtre « Prévenir ») : event_update exécuté puis annulé
    '20261119000007_f2b_apercu_avis.sql',
    // Ajout (point 1) : recherche de lieu, créneaux espacés de 1,3 s (appels séparés d'une seconde au moins)
    '20261119000008_f2b_cadence_recherche.sql',
] as const;

after(async () => {
    await assertFinition1Invariants('migration-finition2b-rejouable');
});

describe('Finition 2b — migrations 20261119… rejouables (transaction annulée)', () => {
    test('les migrations 20261119… du dépôt sont exactement celles de la finition, dans cet ordre', () => {
        const present = fs.readdirSync(DIR).filter((f) => f.startsWith('20261119')).sort();
        assert.deepEqual(present, [...FINITION2B_MIGRATIONS], `migrations 20261119… présentes : ${present.join(', ') || 'aucune'}`);
    });
    // Ajout (point 3) : la finition 3a (migrations 20261117…) est fusionnée dans main avant la 2b ; les migrations de la
    // 2b, non appliquées, passent après toutes les autres du dépôt (sinon : renuméroter)
    test('les migrations 20261119… passent après toutes les autres du dépôt (finition 3a, 20261117…, comprise)', () => {
        const all = fs.readdirSync(DIR).filter((f) => /^\d{14}_.+\.sql$/.test(f)).sort();
        // Contre-vérification 2b : ses correctifs (20261121…) corrigent la finition 2b et passent donc après elle ; ils ne
        // comptent pas parmi les migrations que la 2b doit suivre.
        const others = all.filter((f) => !f.startsWith('20261119') && !f.startsWith('20261121'));
        const last = others[others.length - 1];
        console.log(`[F2B-MIG] dernière migration hors finition 2b : ${last} ; première de la finition 2b : ${FINITION2B_MIGRATIONS[0]}`);
        assert.ok(others.some((f) => f.startsWith('20261117')), 'précondition : migrations 20261117… de la finition 3a présentes (main fusionnée)');
        assert.ok(last < FINITION2B_MIGRATIONS[0], `${last} passe après ${FINITION2B_MIGRATIONS[0]} : renuméroter les migrations de la finition 2b`);
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
