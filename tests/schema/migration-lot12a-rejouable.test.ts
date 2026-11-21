/**
 * Lot 12a — les migrations 20261130000001… (commandes : argent et sécurité) se rejouent sans erreur : chacune, appliquée
 * deux fois de plus dans une transaction annulée, ne casse rien ; aucune ne gère elle-même sa transaction ; elles passent
 * après toutes celles d'avant (lots 10a, 11a, 10b, finition 4, design 1d…).
 * Les recopies de fonctions communes partent de la dernière définition d'avant le lot : chaque ligne de cette définition
 * se retrouve dans la recopie, sauf les lignes remplacées, listées ici. Le test devient rouge si une autre branche
 * (lot 11b, design 1e…) change une de ces fonctions avant la fusion sans que la recopie du lot 12a soit refaite.
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { inRolledBackTransaction } from '../helpers/db';
import { assertLot12aInvariants } from '../helpers/lot12a-invariants';

const DIR = path.resolve(process.cwd(), 'supabase/migrations');

const LOT12A_MIGRATIONS = [
    // Réglages orders.* (frais, commission, acompte, attentes, plafond, retrait, masquage, code, préparation)
    '20261130000001_l12a_reglages.sql',
    // Catalogue : établissements qui vendent, produits réglementés, options, plat du jour, zones de livraison
    '20261130000002_l12a_catalogue.sql',
    // Commandes : état, montants figés, étapes, codes hachés, livreurs, garde, lecture (aucune REST pour la partenaire)
    '20261130000003_l12a_commandes_schema.sql',
    // Devis et création en base (verrous, stock et portions, plafond)
    '20261130000004_l12a_devis_commande.sql',
    // Paiement : création et confirmation en base, recettes et parrainage après l'heure prévue
    '20261130000005_l12a_paiement.sql',
    // Étapes, remise contre code, annulations et remboursements, livreurs, lectures serveur, tâche planifiée
    '20261130000006_l12a_etapes.sql',
    // Avis des étapes, classement de nuit, code effacé de la boîte d'envoi
    '20261130000007_l12a_avis.sql',
    // Commission des commandes dans les relevés
    '20261130000008_l12a_releves.sql',
] as const;

/** Recopies de fonctions communes : fichier de la recopie, et lignes de la définition précédente qu'elle remplace. */
const RECOPIES: Record<string, { file: string; replaced: string[] }> = {
    finance_setting_set: { file: LOT12A_MIGRATIONS[0], replaced: [
        "'halls.max_pending_per_client') THEN",
    ] },
    fin_setting_valid: { file: LOT12A_MIGRATIONS[0], replaced: [] },
    platform_settings_defaults: { file: LOT12A_MIGRATIONS[0], replaced: [
        "WHERE s.key ~ '^(finance|access|notif|features|support|halls|tables)\\.'",
    ] },
    fin_payout_available_at: { file: LOT12A_MIGRATIONS[4], replaced: [
        'table_reservation_id',
    ] },
    calculate_referral_commissions: { file: LOT12A_MIGRATIONS[4], replaced: [] },
    notif_cashouts_notify: { file: LOT12A_MIGRATIONS[5], replaced: [
        "AND hp.payment_target::text IN ('HALL_RESERVATION', 'TABLE_RESERVATION')) THEN",
    ] },
    notification_sync_log: { file: LOT12A_MIGRATIONS[6], replaced: [] },
    finance_admin_earned: { file: LOT12A_MIGRATIONS[7], replaced: [
        "COALESCE(sum(CASE WHEN p.payment_target::text IN ('HALL_RESERVATION', 'TABLE_RESERVATION')",
    ] },
    finance_admin_payments: { file: LOT12A_MIGRATIONS[7], replaced: [
        "'commission', CASE WHEN py.payment_target::text IN ('HALL_RESERVATION', 'TABLE_RESERVATION')",
        "+ CASE WHEN py.payment_target::text IN ('HALL_RESERVATION', 'TABLE_RESERVATION') AND py.facial_amount IS NOT NULL THEN",
    ] },
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
    await assertLot12aInvariants('migration-lot12a-rejouable');
});

describe('Lot 12a — migrations 20261130000001… rejouables (transaction annulée)', () => {
    test('les migrations du lot sont exactement celles-ci, dans cet ordre, après toutes celles d’avant', () => {
        const all = fs.readdirSync(DIR).filter((f) => /^\d{14}_.+\.sql$/.test(f)).sort();
        const present = all.filter((f) => /^20261130\d{6}_l12a_/.test(f));
        assert.deepEqual(present, [...LOT12A_MIGRATIONS], `migrations du lot 12a présentes : ${present.join(', ') || 'aucune'}`);
        const earlier = all.filter((f) => f < LOT12A_MIGRATIONS[0]);
        assert.ok(earlier.includes('20261127000001_d1d_vitrine.sql'), 'précondition : migrations de main présentes (design 1d)');
    });

    for (const name of LOT12A_MIGRATIONS) {
        test(`${name} : sans BEGIN ni COMMIT, appliquée deux fois de plus sans erreur`, async () => {
            const file = path.join(DIR, name);
            assert.ok(fs.existsSync(file), `migration du lot 12a absente : supabase/migrations/${name}`);
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
            const before = all.filter((f) => f < LOT12A_MIGRATIONS[0]);
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

    test('fonctions du lot réservées au rôle de service ; code de remise et sa clé jamais lisibles hors des fonctions', async () => {
        await inRolledBackTransaction(async (c) => {
            const { rows } = await c.query<{ proname: string; anon: boolean; auth: boolean }>(
                `SELECT p.proname, has_function_privilege('anon', p.oid, 'execute') AS anon, has_function_privilege('authenticated', p.oid, 'execute') AS auth
                   FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname LIKE 'order\\_%' ORDER BY 1`);
            assert.ok(rows.length >= 25, `fonctions order_* : ${rows.length}`);
            assert.deepEqual(rows.filter((r) => r.anon || r.auth).map((r) => r.proname), [], 'aucune ouverte à anon ou authenticated');
            const { rows: svc } = await c.query<{ hash: boolean; issue: boolean; delivery: boolean; key: boolean }>(
                `SELECT has_function_privilege('service_role', 'public.order_code_hash(uuid, text)', 'execute') AS hash,
                        has_function_privilege('service_role', 'public.order_issue_code(uuid)', 'execute') AS issue,
                        has_function_privilege('service_role', 'public.order_code_delivery(uuid, text, text)', 'execute') AS delivery,
                        has_table_privilege('service_role', 'private.order_code_key', 'select') AS key`);
            assert.deepEqual(svc[0], { hash: false, issue: false, delivery: false, key: false });
        });
    });
});
