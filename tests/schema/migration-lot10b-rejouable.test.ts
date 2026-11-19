/**
 * Lot 10b — les migrations 20261126… (salles : droit unique, écrans, avis) se rejouent sans erreur : chacune,
 * appliquée deux fois de plus dans une transaction annulée, ne casse rien ; aucune ne gère elle-même sa transaction ;
 * elles passent après celles des lots 10a et 11a.
 * Les recopies de fonctions communes partent de la dernière définition d'avant le lot : chaque ligne de cette
 * définition se retrouve dans la recopie, sauf les lignes remplacées, listées ici.
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { inRolledBackTransaction } from '../helpers/db';
import { assertLot10aInvariants } from '../helpers/lot10a-invariants';

const DIR = path.resolve(process.cwd(), 'supabase/migrations');

const LOT10B_MIGRATIONS = [
    // Droit unique halls.validate (salles et établissements)
    '20261126000001_l10b_droit_validation.sql',
    // Réglage des attentes, renvoi en validation, recherche, calendrier, aperçu d'annulation, recettes
    '20261126000002_l10b_salles.sql',
    // Avis sur les quatre canaux, administrateurs prévenus, rappels, veille, recettes, remboursement versé
    '20261126000003_l10b_avis.sql',
] as const;

/** Recopies de fonctions communes : fichier de la recopie, et lignes de la définition précédente qu'elle remplace. */
const RECOPIES: Record<string, { file: string; replaced: string[] }> = {
    hall_validation_decide: { file: LOT10B_MIGRATIONS[0], replaced: [
        "OR public.has_admin_permission(v_actor, 'partners.validate')) THEN",
    ] },
    venue_validation_decide: { file: LOT10B_MIGRATIONS[0], replaced: [
        "OR public.has_admin_permission(v_actor, 'partners.validate')) THEN",
    ] },
    // Lignes d'origine gardées mot pour mot (audit cv11a-5-recopies) ; seul le compte des établissements exclut les salles
    notif_admin_review_sms: { file: LOT10B_MIGRATIONS[0], replaced: [
        "'venue_count', COALESCE((v_row.template_data->>'venue_count')::integer, 0) + CASE WHEN v_kind = 'VENUE_SUBMITTED' THEN 1 ELSE 0 END,",
        "'venue_count', CASE WHEN v_kind = 'VENUE_SUBMITTED' THEN 1 ELSE 0 END,",
    ] },
    finance_setting_set: { file: LOT10B_MIGRATIONS[1], replaced: [
        "'tables.max_pending_per_client', 'tables.reminder_hours') THEN",
    ] },
    fin_setting_valid: { file: LOT10B_MIGRATIONS[1], replaced: [] },
    hall_client_pending_refusal: { file: LOT10B_MIGRATIONS[1], replaced: [
        'IF v_pending >= 3 THEN',
        "'message', 'Vous avez déjà 3 réservations en attente de paiement. Payez-en une ou attendez qu’elle se libère.');",
    ] },
    halls_validation_guard: { file: LOT10B_MIGRATIONS[1], replaced: [
        '-- Mise à jour par la partenaire ou par une route : statut et décision gardés ; une salle refusée puis modifiée',
        '-- repart en attente de validation (nouvel examen)',
        "IF OLD.validation_status = 'REFUSEE' THEN",
        "NEW.validation_status := 'EN_ATTENTE_VALIDATION';",
    ] },
    hall_reserve: { file: LOT10B_MIGRATIONS[2], replaced: [] },
    hall_reservations_tick: { file: LOT10B_MIGRATIONS[2], replaced: [
        'SELECT hr.id, hr.client_id FROM public.hall_reservations hr',
        "WHERE hr.booking_state = 'ACOMPTE_PAYE' AND hr.balance_due_at IS NOT NULL",
        "AND now() >= hr.balance_due_at - interval '3 days' AND now() < hr.balance_due_at",
        "'type', 'HALL_BALANCE_REMINDER', 'key', 'HALL_BALANCE_REMINDER:' || r.id::text,",
        "'user_id', r.client_id, 'data', COALESCE(public.hall_notif_data(r.id), '{}'::jsonb))), 0);",
    ] },
    notif_cashouts_notify: { file: LOT10B_MIGRATIONS[2], replaced: [] },
};

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

after(async () => {
    await assertLot10aInvariants('migration-lot10b-rejouable');
});

describe('Lot 10b — migrations 20261126… rejouables (transaction annulée)', () => {
    test('les migrations du lot sont exactement celles-ci, dans cet ordre, après celles des lots 10a et 11a', () => {
        const all = fs.readdirSync(DIR).filter((f) => /^\d{14}_.+\.sql$/.test(f)).sort();
        const present = all.filter((f) => /^20261126\d{6}_l10b_/.test(f));
        assert.deepEqual(present, [...LOT10B_MIGRATIONS], `migrations du lot 10b présentes : ${present.join(', ') || 'aucune'}`);
        const earlier = all.filter((f) => /^2026112[23]/.test(f));
        assert.ok(earlier.length > 0 && earlier[earlier.length - 1] < LOT10B_MIGRATIONS[0], 'les migrations des lots 10a et 11a passent avant');
    });

    for (const name of LOT10B_MIGRATIONS) {
        test(`${name} : sans BEGIN ni COMMIT, appliquée deux fois de plus sans erreur`, async () => {
            const file = path.join(DIR, name);
            assert.ok(fs.existsSync(file), `migration du lot 10b absente : supabase/migrations/${name}`);
            const sql = fs.readFileSync(file, 'utf8');
            assert.doesNotMatch(sql, /^\s*(BEGIN|COMMIT)\s*;\s*$/im, `${name} : la migration ne gère pas elle-même sa transaction`);
            await inRolledBackTransaction(async (c) => {
                await c.query(sql);
                await c.query(sql);
            });
        });
    }

    for (const [fn, spec] of Object.entries(RECOPIES)) {
        test(`recopie de ${fn} : aucune ligne de la définition précédente perdue (hors lignes remplacées)`, () => {
            const all = fs.readdirSync(DIR).filter((f) => /^\d{14}_.+\.sql$/.test(f) || /^\d{4}_.+\.sql$/.test(f)).sort();
            const before = all.filter((f) => f < LOT10B_MIGRATIONS[0]);
            const previous = lastDefinition(fn, before);
            const mine = lastDefinition(fn, [spec.file]);
            assert.ok(previous, `${fn} : définition précédente introuvable`);
            assert.ok(mine, `${fn} : recopie absente de ${spec.file}`);
            const kept = new Set(mine!.split('\n').map((l) => l.trim()));
            const lost = previous!.split('\n').map((l) => l.trim())
                .filter((l) => l.length > 0 && !kept.has(l) && !spec.replaced.includes(l));
            assert.deepEqual(lost, [], `${fn} : lignes perdues`);
        });
    }
});
