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
    // Correctifs de la contre-vérification (docs/audit-lot10b.md) : T1, T3 à T7 (et bis pour les tables)
    '20261126000004_l10b_cv_correctifs.sql',
    // Avis du changement de droits d'un administrateur (demande du 19/11)
    '20261126000005_l10b_cv_droits_avis.sql',
    // Date exacte de l'envoi en validation (point ouvert du rapport)
    '20261126000006_l10b_cv_envoi.sql',
    // T8 : rappels des salles dans le report de nuit de la finition 4 (après sa fusion)
    '20261126000007_l10b_cv_nuit.sql',
] as const;

/** Recopies faites par les correctifs : comparées à la définition d'avant LEUR migration (lot 10b compris). */
const CV_RECOPIES: Array<{ fn: string; file: string; replaced: string[] }> = [
    { fn: 'hall_reservation_cancel', file: LOT10B_MIGRATIONS[3], replaced: [] },
    { fn: 'hall_quote', file: LOT10B_MIGRATIONS[3], replaced: [
        "IF NOT h.is_active OR h.partner_status <> 'VALIDE'",
        "OR (h.validation_status <> 'VALIDEE'",
        "AND (public.fin_setting_bool('halls.validation_required') OR h.validation_status IN ('REFUSEE', 'SUSPENDUE'))) THEN",
    ] },
    { fn: 'hall_booking_refusal', file: LOT10B_MIGRATIONS[3], replaced: [
        "IF NOT h.is_active OR h.partner_status <> 'VALIDE'",
        "OR (h.validation_status <> 'VALIDEE'",
        "AND (public.fin_setting_bool('halls.validation_required') OR h.validation_status IN ('REFUSEE', 'SUSPENDUE'))) THEN",
    ] },
    { fn: 'notif_admin_review_sms', file: LOT10B_MIGRATIONS[3], replaced: [
        "v_is_hall boolean := btrim(COALESCE(p->>'kind', '')) = 'HALL_SUBMITTED';",
        "'hall_count', COALESCE((v_row.template_data->>'hall_count')::integer, 0) + CASE WHEN v_is_hall THEN 1 ELSE 0 END,",
        "'hall_count', CASE WHEN v_is_hall THEN 1 ELSE 0 END,",
    ] },
    { fn: 'halls_notify_admins', file: LOT10B_MIGRATIONS[3], replaced: [] },
    { fn: 'hall_reservations_tick', file: LOT10B_MIGRATIONS[3], replaced: [
        "-- Lot 10b : rappel du solde 10 jours puis 8 jours avant la date (l'échéance est à J-7), un de chaque, de jour",
        'SELECT hr.id, hr.client_id, lower(hr.slot) AS start_at FROM public.hall_reservations hr',
        "AND now() < hr.balance_due_at AND v_now_local >= lower(hr.slot) - interval '10 days'",
        "v_step := CASE WHEN v_now_local >= r.start_at - interval '8 days' THEN 'J8' ELSE 'J10' END;",
    ] },
    { fn: 'admin_permissions_set', file: LOT10B_MIGRATIONS[4], replaced: [] },
    { fn: 'halls_validation_guard', file: LOT10B_MIGRATIONS[5], replaced: [] },
    { fn: 'hall_reservations_tick', file: LOT10B_MIGRATIONS[6], replaced: [
        '-- Lot 10b : rappels, veille et recettes envoyés hors de la nuit (réglages notif.sms_quiet_start / _end)',
        "v_day       boolean := NOT public.notif_in_quiet_hours(now(), public.fin_setting_num('notif.sms_quiet_start')::int,",
        "public.fin_setting_num('notif.sms_quiet_end')::int);",
        "-- calculée avec halls.balance_due_days), un de chaque, de jour ; avec l'échéance par défaut (J-7), J-10 puis J-8",
        "WHERE v_day AND hr.booking_state = 'ACOMPTE_PAYE' AND hr.balance_due_at IS NOT NULL",
        "WHERE v_day AND hr.booking_state = 'PAYEE' AND hr.start_date = v_now_local::date + 1",
        'WHERE v_day AND hr.end_date >= v_now_local::date - 30',
    ] },
    { fn: 'hall_submit', file: LOT10B_MIGRATIONS[5], replaced: [
        "validated_at = CASE WHEN v_new = 'VALIDEE' THEN now() END, updated_at = now()",
    ] },
];

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

    for (const spec of CV_RECOPIES) {
        test(`recopie de ${spec.fn} (${spec.file.slice(0, 14)}) : aucune ligne de la définition précédente perdue`, () => {
            const all = fs.readdirSync(DIR).filter((f) => /^\d{14}_.+\.sql$/.test(f) || /^\d{4}_.+\.sql$/.test(f)).sort();
            const previous = lastDefinition(spec.fn, all.filter((f) => f < spec.file));
            const mine = lastDefinition(spec.fn, [spec.file]);
            assert.ok(previous && mine, `${spec.fn} : définition précédente ou recopie introuvable`);
            const kept = new Set(mine!.split('\n').map((l) => l.trim()));
            const lost = previous!.split('\n').map((l) => l.trim()).filter((l) => l.length > 0 && !kept.has(l) && !spec.replaced.includes(l));
            assert.deepEqual(lost, [], `${spec.fn} : lignes perdues`);
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
