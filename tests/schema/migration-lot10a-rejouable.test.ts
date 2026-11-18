/**
 * Lot 10a — les migrations 20261122… (réservation de salles : argent et sécurité) se rejouent sans erreur : chacune,
 * appliquée deux fois de plus dans une transaction annulée, ne casse rien ; aucune ne gère elle-même sa transaction ;
 * elles passent après toutes les autres du dépôt.
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { inRolledBackTransaction } from '../helpers/db';
import { assertLot10aInvariants } from '../helpers/lot10a-invariants';

const DIR = path.resolve(process.cwd(), 'supabase/migrations');

const LOT10A_MIGRATIONS = [
    // Réglages halls.* (frais, commission, acompte, délais, annulation, validation)
    '20261122000001_l10a_reglages.sql',
    // Schéma : validation des salles, acompte, règle d'annulation, position, état détaillé, créneaux, lecture
    '20261122000002_l10a_salles_schema.sql',
    // Réserver : devis et réservation en base (S1 à S3)
    '20261122000003_l10a_reserver.sql',
    // Payer : acompte puis solde, confirmation en base, recettes et parrainage après la date (S4)
    '20261122000004_l10a_paiement.sql',
    // Annuler : remboursement par le moteur financier, délai de paiement dépassé, rappel du solde (S5, S6)
    '20261122000005_l10a_annulation.sql',
    // Validation des salles par l'administration
    '20261122000006_l10a_validation.sql',
    // Messages du parcours
    '20261122000007_l10a_messages.sql',
    // Correctifs de la contre-vérification (docs/audit-lot10a.md ; ajouts signalés au rapport) :
    // T3, paiement confirmé après l'échéance du solde sans payer toute la réservation : rendu en entier
    '20261122000008_l10a_cv_paiement_tardif.sql',
    // T2, réservation échue relancée par un paiement : salle, partenaire et limite des attentes contrôlées
    '20261122000009_l10a_cv_relance.sql',
    // T4, paiement en une fois tant que le solde serait dû dans moins de 24 h (réglage halls.full_payment_margin_hours)
    '20261122000010_l10a_cv_paiement_en_une_fois.sql',
    // T5, verrou par client avant de compter ses attentes
    '20261122000011_l10a_cv_verrou_client.sql',
    // T6, relevés de l'administration étendus à la commission des salles
    '20261122000012_l10a_cv_releves.sql',
] as const;

after(async () => {
    await assertLot10aInvariants('migration-lot10a-rejouable');
});

describe('Lot 10a — migrations 20261122… rejouables (transaction annulée)', () => {
    test('les migrations 20261122… du dépôt sont exactement celles du lot, dans cet ordre, après toutes les autres', () => {
        const all = fs.readdirSync(DIR).filter((f) => /^\d{14}_.+\.sql$/.test(f)).sort();
        const present = all.filter((f) => f.startsWith('20261122'));
        assert.deepEqual(present, [...LOT10A_MIGRATIONS], `migrations 20261122… présentes : ${present.join(', ') || 'aucune'}`);
        const others = all.filter((f) => !f.startsWith('20261122'));
        assert.ok(others[others.length - 1] < LOT10A_MIGRATIONS[0], `${others[others.length - 1]} passe après ${LOT10A_MIGRATIONS[0]}`);
    });

    for (const name of LOT10A_MIGRATIONS) {
        test(`${name} : sans BEGIN ni COMMIT, appliquée deux fois de plus sans erreur`, async () => {
            const file = path.join(DIR, name);
            assert.ok(fs.existsSync(file), `migration du lot 10a absente : supabase/migrations/${name}`);
            const sql = fs.readFileSync(file, 'utf8');
            assert.doesNotMatch(sql, /^\s*(BEGIN|COMMIT)\s*;\s*$/im, `${name} : la migration ne gère pas elle-même sa transaction`);
            await inRolledBackTransaction(async (c) => {
                await c.query(sql);
                await c.query(sql);
            });
        });
    }
});
