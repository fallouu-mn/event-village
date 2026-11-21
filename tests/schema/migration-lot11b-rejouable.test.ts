/**
 * Lot 11b — les migrations 20261129… (tables : écrans, plan de salle, fermetures, absences, avis) se rejouent sans
 * erreur : chacune, appliquée deux fois de plus dans une transaction annulée, ne casse rien ; aucune ne gère elle-même
 * sa transaction ; elles passent après celles des lots précédents.
 * Chaque recopie de fonction part de la DERNIÈRE définition d'avant sa migration (fichier et lignes cités en tête de
 * migration) : chaque ligne de cette définition se retrouve dans la recopie, sauf les lignes remplacées, listées ici.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { inRolledBackTransaction } from '../helpers/db';

const DIR = path.resolve(process.cwd(), 'supabase/migrations');

export const LOT11B_MIGRATIONS = [
    // Établissements : photos, envoi en validation, plan de salle, création en une transaction
    '20261129000001_l11b_etablissements.sql',
    // Fermetures exceptionnelles, disponibilités (pastilles), plan public, recherche
    '20261129000002_l11b_fermetures_disponibilites.sql',
    // Réservations : code court, « J'arrive », aperçu d'annulation, recettes, devis, fiche VALIDE (F1)
    '20261129000003_l11b_reservations.sql',
    // Avis : lien vers la réservation, nuit, « J'arrive », remboursement versé, rappel 2 h avant
    '20261129000004_l11b_avis.sql',
    // Photos des établissements citées pour la purge du stockage (run complet 541)
    '20261129000005_l11b_photos_citees.sql',
] as const;

/** Recopies : fonction, migration de la recopie, lignes de la définition précédente qu'elle remplace (aucune ici). */
const RECOPIES: Array<{ fn: string; file: string; replaced: string[] }> = [
    { fn: 'venues_validation_guard', file: LOT11B_MIGRATIONS[0], replaced: [
        // Un établissement refusé puis modifié ne repart plus en attente tout seul (renvoi par venue_submit)
        '-- Mise à jour par la partenaire ou par une route : statut et décision gardés ; un établissement refusé puis',
        '-- modifié repart en attente de validation (nouvel examen)',
        "IF OLD.validation_status = 'REFUSEE' THEN",
        "NEW.validation_status := 'EN_ATTENTE_VALIDATION';",
    ] },
    { fn: 'table_reserve', file: LOT11B_MIGRATIONS[1], replaced: [] },
    { fn: 'table_hold_refusal', file: LOT11B_MIGRATIONS[1], replaced: [] },
    { fn: 'table_reservation_presence', file: LOT11B_MIGRATIONS[2], replaced: [] },
    { fn: 'table_reservation_cancel', file: LOT11B_MIGRATIONS[2], replaced: [] },
    { fn: 'table_notif_data', file: LOT11B_MIGRATIONS[3], replaced: [] },
    { fn: 'notif_event_soon', file: LOT11B_MIGRATIONS[3], replaced: [] },
    { fn: 'notif_cashouts_notify', file: LOT11B_MIGRATIONS[3], replaced: [] },
    { fn: 'storage_public_citations', file: LOT11B_MIGRATIONS[4], replaced: [] },
];

/** Texte de la dernière définition de public.<nom> dans les fichiers donnés (du CREATE au second $$). */
function lastDefinition(name: string, files: readonly string[]): string | null {
    const head = new RegExp(`^CREATE (OR REPLACE )?FUNCTION public\\.${name}\\s*\\(`, 'i');
    let found: string | null = null;
    for (const f of files) {
        const lines = fs.readFileSync(path.join(DIR, f), 'utf8').replace(/\r\n/g, '\n').split('\n');
        lines.forEach((line, i) => {
            if (!head.test(line)) return;
            let dollars = 0;
            let j = i;
            for (; j < lines.length; j += 1) {
                dollars += (lines[j].match(/\$\$/g) ?? []).length;
                if (dollars >= 2) break;
            }
            found = lines.slice(i, j + 1).join('\n');
        });
    }
    return found;
}

const allMigrations = (): string[] =>
    fs.readdirSync(DIR).filter((f) => /^\d{14}_.+\.sql$/.test(f) || /^\d{4}_.+\.sql$/.test(f)).sort();

describe('Lot 11b — migrations 20261129… rejouables, recopies complètes', () => {
    test('les migrations du lot sont exactement celles-ci, dans cet ordre, après celles des lots précédents', () => {
        const all = fs.readdirSync(DIR).filter((f) => /^\d{14}_.+\.sql$/.test(f)).sort();
        const present = all.filter((f) => /^20261129\d{6}_l11b_/.test(f));
        assert.deepEqual(present, [...LOT11B_MIGRATIONS], `migrations du lot 11b présentes : ${present.join(', ') || 'aucune'}`);
        const earlier = all.filter((f) => f < LOT11B_MIGRATIONS[0]);
        assert.ok(earlier.length > 0 && earlier[earlier.length - 1] < LOT11B_MIGRATIONS[0], 'les migrations des lots précédents passent avant');
    });

    for (const name of LOT11B_MIGRATIONS) {
        test(`${name} : sans BEGIN ni COMMIT, appliquée deux fois de plus sans erreur`, async () => {
            const file = path.join(DIR, name);
            assert.ok(fs.existsSync(file), `migration du lot 11b absente : supabase/migrations/${name}`);
            const sql = fs.readFileSync(file, 'utf8');
            assert.doesNotMatch(sql, /^\s*(BEGIN|COMMIT)\s*;\s*$/im, `${name} : la migration ne gère pas elle-même sa transaction`);
            await inRolledBackTransaction(async (c) => {
                await c.query(sql);
                await c.query(sql);
            });
        });
    }

    for (const spec of RECOPIES) {
        test(`recopie de ${spec.fn} (${spec.file.slice(0, 14)}) : aucune ligne de la dernière définition précédente perdue`, () => {
            const previous = lastDefinition(spec.fn, allMigrations().filter((f) => f < spec.file));
            const mine = lastDefinition(spec.fn, [spec.file]);
            assert.ok(previous, `${spec.fn} : définition précédente introuvable`);
            assert.ok(mine, `${spec.fn} : recopie absente de ${spec.file}`);
            const kept = new Set(mine!.split('\n').map((l) => l.trim()));
            const lost = previous!.split('\n').map((l) => l.trim()).filter((l) => l.length > 0 && !kept.has(l) && !spec.replaced.includes(l));
            assert.deepEqual(lost, [], `${spec.fn} : lignes perdues`);
        });
    }

    test('la tête de chaque migration cite le fichier et les lignes de chaque recopie', () => {
        const missing: string[] = [];
        for (const spec of RECOPIES) {
            const head = fs.readFileSync(path.join(DIR, spec.file), 'utf8');
            const cite = new RegExp(`${spec.fn}[^\\n]*\\n?[^\\n]*recopie de \\d{14}_[a-z0-9_]+\\.sql:\\d+-\\d+`, 'i');
            if (!cite.test(head)) missing.push(`${spec.file} : ${spec.fn}`);
        }
        assert.deepEqual(missing, [], `recopies sans fichier ni lignes cités :\n${missing.join('\n')}`);
    });
});
