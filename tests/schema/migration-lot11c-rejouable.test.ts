/**
 * Lot 11c-a — les migrations 20261201… (tables d'un événement : réglages, schéma, configuration, vente, remboursement,
 * avis) se rejouent sans erreur : chacune, appliquée deux fois de plus dans une transaction annulée, ne casse rien ;
 * aucune ne gère elle-même sa transaction ; elles passent après celles des lots précédents.
 * Réglages : finance_setting_set, fin_setting_valid et platform_settings_defaults ne sont pas recopiés (la suite d'audit
 * cv12a-3, S1, n'admet qu'une recopie après main) ; event_tables_setting_set règle les deux clés du lot.
 * Chaque recopie de fonction part de la DERNIÈRE définition d'avant sa migration (fichier et lignes cités en tête de
 * migration) : chaque ligne de cette définition se retrouve dans la recopie, sauf les lignes remplacées, listées ici.
 * Droits : fonctions publiques du lot réservées au rôle de service ; aides internes dans le schéma private, exécutables
 * par aucun rôle de l'API, clé de service comprise (leçon T7 de la contre-vérification du lot 12a) ; tables nouvelles
 * sous RLS, sans aucun droit pour anon ni authenticated.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { inRolledBackTransaction, writeLocal } from '../helpers/db';

const DIR = path.resolve(process.cwd(), 'supabase/migrations');

export const LOT11C_MIGRATIONS = [
    // Interrupteur features.event_tables_enabled, tables au plus par compte et par événement
    '20261201000001_l11c_reglages.sql',
    // Types de tables (catégories kind TABLE), tables, plan, attentes et ventes, gardes d'écriture
    '20261201000002_l11c_schema.sql',
    // Types, tables et plan tout ou rien, jauge en places, alertes aux administrateurs
    '20261201000003_l11c_configuration.sql',
    // Vente d'une table (checkout_create_payment, payment_confirm), offre, devis, Ma table, porte, badge
    '20261201000004_l11c_vente.sql',
    // Une place ne se rembourse jamais seule ; table entière au report
    '20261201000005_l11c_remboursement.sql',
    // Avis (4 canaux, nuit) et rappel des places à envoyer
    '20261201000006_l11c_avis.sql',
    // Correctifs de la contre-vérification : une seule aide de jauge (T1, T2), avis à l'invité (T3), alerte de zone
    '20261201000007_l11c_cv_correctifs.sql',
] as const;

/** Recopies : fonction, migration de la recopie, lignes de la définition précédente qu'elle remplace. */
const RECOPIES: Array<{ fn: string; file: string; replaced: string[] }> = [
    // Jauge en places : quotas × places par unité ; un type de table arrêté garde ses tables vendues ou en paiement
    { fn: 'ticket_category_create', file: LOT11C_MIGRATIONS[2], replaced: [
        'SELECT COALESCE(sum(c.total_quantity), 0)::int INTO v_sum',
        'FROM public.ticket_categories c WHERE c.event_id = v_event AND c.is_active;',
    ] },
    { fn: 'ticket_category_update', file: LOT11C_MIGRATIONS[2], replaced: [
        'SELECT COALESCE(sum(o.total_quantity), 0)::int INTO v_sum',
        'FROM public.ticket_categories o WHERE o.event_id = v_event AND o.is_active AND o.id <> c.id;',
    ] },
    { fn: 'event_update', file: LOT11C_MIGRATIONS[2], replaced: [
        'SELECT COALESCE(sum(c.sold_quantity + c.held_quantity), 0)::int,',
        'COALESCE(sum(c.total_quantity) FILTER (WHERE c.is_active), 0)::int',
    ] },
    { fn: 'checkout_create_payment', file: LOT11C_MIGRATIONS[3], replaced: [] },
    { fn: 'payment_confirm', file: LOT11C_MIGRATIONS[3], replaced: [] },
    { fn: 'ticket_refund_request', file: LOT11C_MIGRATIONS[4], replaced: [] },
    { fn: 'ticket_postponement_refund_open', file: LOT11C_MIGRATIONS[4], replaced: [] },
    // Contre-vérification (T1, T2) : la jauge par private.event_seats_gauge ; seuls les calculs de jauge et leurs messages
    { fn: 'private.event_seats_refusal', file: LOT11C_MIGRATIONS[6], replaced: [
        "-- Un type de table arrêté garde ses tables vendues ou en paiement dans la jauge (sinon l'organisatrice pourrait",
        '-- remettre ces places en vente en billets)',
        "SELECT COALESCE(sum(CASE WHEN c.is_active THEN c.total_quantity WHEN c.kind = 'TABLE' THEN c.sold_quantity + c.held_quantity ELSE 0 END",
        '* c.seats_per_unit), 0)::int,',
        'COALESCE(sum(CASE WHEN c.is_active THEN c.total_quantity ELSE c.sold_quantity + c.held_quantity END * c.seats_per_unit)',
        "FILTER (WHERE c.kind = 'TABLE'), 0)::int",
        'INTO v_seats, v_table_seats',
        'FROM public.ticket_categories c WHERE c.event_id = p_event;',
    ] },
    { fn: 'ticket_category_create', file: LOT11C_MIGRATIONS[6], replaced: [
        '-- Lot 11c-a : jauge en places (une table compte ses places ; un type de table arrêté garde ses tables vendues)',
        "SELECT COALESCE(sum(CASE WHEN c.is_active THEN c.total_quantity WHEN c.kind = 'TABLE' THEN c.sold_quantity + c.held_quantity ELSE 0 END",
        '* c.seats_per_unit), 0)::int INTO v_sum',
        "FROM public.ticket_categories c WHERE c.event_id = v_event AND (c.is_active OR c.kind = 'TABLE');",
    ] },
    { fn: 'ticket_category_update', file: LOT11C_MIGRATIONS[6], replaced: [
        '-- Lot 11c-a : jauge en places (une table compte ses places ; un type de table arrêté garde ses tables vendues)',
        "SELECT COALESCE(sum(CASE WHEN o.is_active THEN o.total_quantity WHEN o.kind = 'TABLE' THEN o.sold_quantity + o.held_quantity ELSE 0 END",
        '* o.seats_per_unit), 0)::int INTO v_sum',
        "FROM public.ticket_categories o WHERE o.event_id = v_event AND (o.is_active OR o.kind = 'TABLE') AND o.id <> c.id;",
    ] },
    { fn: 'event_update', file: LOT11C_MIGRATIONS[6], replaced: [
        'SELECT COALESCE(sum((c.sold_quantity + c.held_quantity) * c.seats_per_unit), 0)::int,',
        'COALESCE(sum(c.total_quantity * c.seats_per_unit) FILTER (WHERE c.is_active), 0)::int',
        'INTO v_engaged, v_quota',
    ] },
    { fn: 'event_edit_locks', file: LOT11C_MIGRATIONS[6], replaced: [
        'COALESCE(sum(c.sold_quantity + c.held_quantity), 0)::int AS engaged,',
        'COALESCE(sum(c.total_quantity) FILTER (WHERE c.is_active), 0)::int AS active_quota',
    ] },
    // Contre-vérification (T3) : avis à l'invité, ajout seul
    { fn: 'event_table_postponement_refund', file: LOT11C_MIGRATIONS[6], replaced: [] },
];

/** Fonctions publiques du lot (appelées par les routes du serveur) : rôle de service seulement. */
const PUBLIC_FUNCTIONS = [
    'event_tables_setting_set(text, jsonb, uuid, text)', 'event_tables_setting_valid(text, jsonb)', 'event_tables_settings_defaults()',
    'event_table_type_save(jsonb)', 'event_table_type_delete(jsonb)', 'event_tables_save(jsonb)', 'event_table_config(jsonb)',
    'event_table_offer(jsonb)', 'event_table_quote(jsonb)', 'event_table_mine(jsonb)', 'event_table_door_list(jsonb)',
    'event_table_badge(uuid)', 'event_table_postponement_refund(jsonb)', 'event_table_seats_reminders(jsonb)',
];

/** Aides internes du lot : schéma private, aucun rôle de l'API (clé de service comprise). */
const PRIVATE_FUNCTIONS = [
    'event_tables_writing()', 'event_table_refusal(uuid, uuid)', 'event_seats_refusal(uuid, text)',
    'event_table_text_ok(text, integer, integer)', 'event_table_person(uuid)', 'event_table_state(uuid)',
    'event_table_sale_refusal(uuid, uuid)', 'event_table_prices(uuid, text)', 'event_table_checkout(jsonb)',
    'event_table_issue(uuid, uuid, uuid)', 'event_table_sold_notify(uuid)', 'event_table_seats(uuid)',
    'event_table_postponement_window(uuid)', 'event_seats_gauge(uuid, uuid, text)',
];

/** Texte de la dernière définition de public.<nom> (ou de schéma.<nom>) dans les fichiers donnés (du CREATE au second $$). */
function lastDefinition(name: string, files: readonly string[]): string | null {
    const qualified = name.includes('.') ? name.replace('.', '\\.') : `public\\.${name}`;
    const head = new RegExp(`^CREATE (OR REPLACE )?FUNCTION ${qualified}\\s*\\(`, 'i');
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

describe('Lot 11c-a — migrations 20261201… rejouables, recopies complètes, droits', () => {
    test('les migrations du lot sont exactement celles-ci, dans cet ordre, après celles des lots précédents', () => {
        const all = fs.readdirSync(DIR).filter((f) => /^\d{14}_.+\.sql$/.test(f)).sort();
        const present = all.filter((f) => /_l11c_/.test(f));
        assert.deepEqual(present, [...LOT11C_MIGRATIONS], `migrations du lot 11c-a présentes : ${present.join(', ') || 'aucune'}`);
        const earlier = all.filter((f) => f < LOT11C_MIGRATIONS[0]);
        assert.ok(earlier.length > 0 && earlier.every((f) => f < LOT11C_MIGRATIONS[0]), 'les migrations des lots précédents passent avant');
    });

    for (const name of LOT11C_MIGRATIONS) {
        test(`${name} : sans BEGIN ni COMMIT, appliquée deux fois de plus sans erreur`, async () => {
            const file = path.join(DIR, name);
            assert.ok(fs.existsSync(file), `migration du lot 11c-a absente : supabase/migrations/${name}`);
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

    test('droits : fonctions publiques du lot au rôle de service seulement ; aides de private à aucun rôle de l’API', async () => {
        const rows = await writeLocal(async (c) => (await c.query<{ fn: string; anon: boolean; auth: boolean; svc: boolean }>(
            `SELECT x.fn,
                    has_function_privilege('anon', x.fn, 'execute') AS anon,
                    has_function_privilege('authenticated', x.fn, 'execute') AS auth,
                    has_function_privilege('service_role', x.fn, 'execute') AS svc
               FROM unnest($1::text[]) AS x(fn)`,
            [[...PUBLIC_FUNCTIONS.map((f) => `public.${f}`), ...PRIVATE_FUNCTIONS.map((f) => `private.${f}`)]])).rows);
        const bad = rows.filter((r) => r.anon || r.auth || (r.fn.startsWith('public.') ? !r.svc : r.svc));
        assert.deepEqual(bad, [], `droits inattendus : ${JSON.stringify(bad)}`);
        const schema = await writeLocal(async (c) => (await c.query<{ usage: boolean }>(
            "SELECT has_schema_privilege('service_role', 'private', 'usage') AS usage")).rows[0]);
        assert.equal(schema.usage, false, 'le schéma private reste fermé au rôle de service');
    });

    test('tables nouvelles sous RLS, sans aucun droit pour anon ni authenticated', async () => {
        const rows = await writeLocal(async (c) => (await c.query<{ rel: string; rls: boolean; anon: boolean; auth: boolean }>(
            `SELECT c.relname AS rel, c.relrowsecurity AS rls,
                    has_table_privilege('anon', c.oid, 'select') OR has_table_privilege('anon', c.oid, 'insert') AS anon,
                    has_table_privilege('authenticated', c.oid, 'select') OR has_table_privilege('authenticated', c.oid, 'insert') AS auth
               FROM pg_class c
              WHERE c.relnamespace = 'public'::regnamespace AND c.relname IN ('event_tables', 'event_table_plans', 'event_table_bookings')
              ORDER BY 1`)).rows);
        assert.deepEqual(rows, [
            { rel: 'event_table_bookings', rls: true, anon: false, auth: false },
            { rel: 'event_table_plans', rls: true, anon: false, auth: false },
            { rel: 'event_tables', rls: true, anon: false, auth: false },
        ]);
    });
});
