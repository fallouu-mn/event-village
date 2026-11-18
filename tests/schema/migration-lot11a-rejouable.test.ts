/**
 * Lot 11a — les migrations 20261123000101… (réservation de tables : argent et sécurité) se rejouent sans erreur :
 * chacune, appliquée deux fois de plus dans une transaction annulée, ne casse rien ; aucune ne gère elle-même sa
 * transaction ; elles passent après celles du lot 10a.
 * Les recopies de fonctions communes partent de la dernière définition d'avant le lot (lot 10a compris) : chaque ligne
 * de cette définition se retrouve dans la recopie, sauf les lignes remplacées, listées ici.
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { inRolledBackTransaction } from '../helpers/db';
import { assertLot11aInvariants } from '../helpers/lot11a-invariants';

const DIR = path.resolve(process.cwd(), 'supabase/migrations');

const LOT11A_MIGRATIONS = [
    // Réglages tables.* (frais, commission, créneau, attentes, absence, annulation, demandes, rappel, validation)
    '20261123000101_l11a_reglages.sql',
    // Établissements (validation, position, créneau, acompte, confirmation), horaires, zones et tables rattachées
    '20261123000102_l11a_etablissements.sql',
    // Réservations : état détaillé, garde des écritures, créneau, contrainte, lecture
    '20261123000103_l11a_reservations_schema.sql',
    // Réserver : une seule fonction en base (T1, T2, T3, T5, T6)
    '20261123000104_l11a_reserver.sql',
    // Payer l'acompte : création et confirmation en base, recettes et parrainage après le créneau
    '20261123000105_l11a_paiement.sql',
    // Répondre, annuler, absence, paiement sur place, tâche planifiée (C1, C2, T4)
    '20261123000106_l11a_annulation.sql',
    // Validation des établissements par l'administration
    '20261123000107_l11a_validation.sql',
    // Messages du parcours
    '20261123000108_l11a_messages.sql',
] as const;

/** Recopies de fonctions communes : fichier de la recopie, et lignes de la définition précédente qu'elle remplace. */
const RECOPIES: Record<string, { file: string; replaced: string[] }> = {
    finance_setting_set: { file: '20261123000101_l11a_reglages.sql', replaced: [
        "'halls.cancel_moderee_full_days', 'halls.cancel_moderee_partial_days', 'halls.cancel_stricte_partial_days') THEN",
    ] },
    fin_setting_valid: { file: '20261123000101_l11a_reglages.sql', replaced: [
        "'halls.validation_required') THEN",
    ] },
    platform_settings_defaults: { file: '20261123000101_l11a_reglages.sql', replaced: [
        "WHERE s.key ~ '^(finance|access|notif|features|support|halls)\\.'",
    ] },
    fin_payout_available_at: { file: '20261123000105_l11a_paiement.sql', replaced: [
        'SELECT id, payment_target::text AS payment_target, event_id, paid_at, payout_hold_enabled, payout_delay_hours, hall_reservation_id',
    ] },
    calculate_referral_commissions: { file: '20261123000105_l11a_paiement.sql', replaced: [] },
    notif_cashouts_notify: { file: '20261123000106_l11a_annulation.sql', replaced: [
        "AND NOT EXISTS (SELECT 1 FROM public.payments hp WHERE hp.id = NEW.payment_id AND hp.payment_target::text = 'HALL_RESERVATION') THEN",
    ] },
    notif_admin_review_sms: { file: '20261123000107_l11a_validation.sql', replaced: [
        "IF v_kind NOT IN ('PARTNER_NEW', 'PARTNER_RESUBMITTED', 'EVENT_SUBMITTED') THEN",
        "v_perm := CASE WHEN v_kind = 'EVENT_SUBMITTED' THEN 'events.write' ELSE 'partners.validate' END;",
        "'partner_count', COALESCE((v_row.template_data->>'partner_count')::integer, 0) + CASE WHEN v_kind = 'EVENT_SUBMITTED' THEN 0 ELSE 1 END,",
        "'partner_count', CASE WHEN v_kind = 'EVENT_SUBMITTED' THEN 0 ELSE 1 END,",
    ] },
};

/** Texte de la dernière définition de public.<nom> dans les fichiers donnés (du CREATE au second $$). */
function lastDefinition(name: string, files: string[]): string | null {
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
    await assertLot11aInvariants('migration-lot11a-rejouable');
});

describe('Lot 11a — migrations 20261123000101… rejouables (transaction annulée)', () => {
    test('les migrations du lot sont exactement celles-ci, dans cet ordre, après celles du lot 10a', () => {
        const all = fs.readdirSync(DIR).filter((f) => /^\d{14}_.+\.sql$/.test(f)).sort();
        const present = all.filter((f) => /^20261123\d{6}_l11a_/.test(f));
        assert.deepEqual(present, [...LOT11A_MIGRATIONS], `migrations du lot 11a présentes : ${present.join(', ') || 'aucune'}`);
        const lot10a = all.filter((f) => f.startsWith('20261122'));
        assert.ok(lot10a.length > 0 && lot10a[lot10a.length - 1] < LOT11A_MIGRATIONS[0], 'les migrations du lot 10a passent avant');
    });

    for (const name of LOT11A_MIGRATIONS) {
        test(`${name} : sans BEGIN ni COMMIT, appliquée deux fois de plus sans erreur`, async () => {
            const file = path.join(DIR, name);
            assert.ok(fs.existsSync(file), `migration du lot 11a absente : supabase/migrations/${name}`);
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
            const before = all.filter((f) => f < LOT11A_MIGRATIONS[0]);
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
