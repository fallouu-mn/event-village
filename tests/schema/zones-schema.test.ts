/**
 * Lot 9 ter, tâche 9t.15 (consigne 1 : zones et portes ; contrat 5.C, C.1.2 et C.1.5, arbitrages 9 et 18, EC2, K6) —
 * schéma des zones, des portes et des verdicts de zone, lu sur le catalogue de la base LOCALE.
 *  1. tables event_zones, zone_categories, event_gates : colonnes et types de C.1.2, clés composées (event_id, id),
 *     RLS activée sans aucune politique, aucun droit pour anon ni authenticated ;
 *  2. colonnes ajoutées : event_controllers.gate_id (nullable) et gate_change_allowed (NOT NULL, défaut faux),
 *     ticket_scans.gate_id, zone_id, zone_result, result devenue nullable, ticket_categories.scan_color et
 *     entry_instruction (nullables) ;
 *  3. contraintes exactes : ticket_scans_outcome_one, ticket_scans_zone_not_accepted, ticket_scans_zone_result_check,
 *     ticket_categories_scan_color_check (8 clés dans l'ordre de 3.8), ticket_categories_entry_instruction_check,
 *     event_controllers_gate_fk, ticket_categories_event_id_id_key, ticket_scans_method_check (GUEST_LIST, migration 08) ;
 *  4. dans une transaction annulée : une ligne de zone acceptée, une ligne à deux verdicts et une ligne sans verdict
 *     sont refusées par la base (23514) en nommant leur contrainte ;
 *  5. couleur et consigne illisibles par anon et authenticated (privilèges de colonne, comme sale_decision) ;
 *  6. fonctions de la section C : une seule définition, SECURITY DEFINER, search_path=public, service_role seul ;
 *     scan_log et ticket_scan sans surcharge ; trigger trg_ticket_categories_zone_admit AFTER INSERT ;
 *  7. témoin (garde A3) : ticket_scans_result_check garde exactement les 17 valeurs du 9 bis.
 *
 * Rouge avant correctif (fix(9t.15), migration 20261110000009_lot9ter_zones ; 08 pour GUEST_LIST et
 * ticket_guest_list_search, ticket_invitation_guest_name_set) : tables, colonnes, contraintes, fonctions et trigger
 * absents (to_regclass NULL, 42703 attrapé en échec explicite, 23514 exigé alors que la base répond 42703).
 * Vert dès l'écriture, annoncé : cas 7 (A3 : la migration ne touche jamais la contrainte gelée).
 *
 * Écritures : seulement dans des transactions annulées (inRolledBackTransaction) ; after() appelle tout de même
 * assertLot9terInvariants (contrat C.1.5, « toute suite »).
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Client } from 'pg';
import { inRolledBackTransaction, inspect } from '../helpers/db';
import { assertLot9terInvariants, LOT9TER_MIGRATION } from '../helpers/lot9ter-invariants';

const M09 = LOT9TER_MIGRATION.M09;
const M08 = LOT9TER_MIGRATION.M08;
const API_ROLES = ['anon', 'authenticated'] as const;
const NEW_TABLES = ['event_zones', 'zone_categories', 'event_gates'] as const;
const SCAN_COLORS = ['BLANC', 'OR', 'ARGENT', 'ROSE', 'TURQUOISE', 'BLEU', 'VIOLET', 'NOIR'];
/** Dernière définition gelée de ticket_scans_result_check (M/20261109000008:173-176). */
const RESULTS_9BIS = [
    'valid', 'already_used', 'invalid', 'cancelled', 'refunded', 'wrong_event', 'event_cancelled', 'event_ended',
    'event_suspended', 'event_not_open', 'payment_required', 'cash_required', 'qr_expired', 'dynamic_qr_required',
    'manual_entry_refused', 'forbidden', 'transfer_pending',
];

after(async () => {
    await assertLot9terInvariants('zones-schema');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

interface ColumnInfo { data_type: string; is_nullable: string; column_default: string | null }

async function columnsOf(db: Client, table: string): Promise<Map<string, ColumnInfo>> {
    const { rows } = await db.query<ColumnInfo & { column_name: string }>(
        `SELECT column_name, data_type, is_nullable, column_default
           FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`, [table]);
    return new Map(rows.map((r) => [r.column_name, { data_type: r.data_type, is_nullable: r.is_nullable, column_default: r.column_default }]));
}

async function tableExists(db: Client, table: string): Promise<boolean> {
    const { rows } = await db.query<{ reg: string | null }>('SELECT to_regclass($1)::text AS reg', [`public.${table}`]);
    return rows[0].reg !== null;
}

/** Définition d'une contrainte (pg_get_constraintdef) ; null si elle n'existe pas. */
async function constraintDef(db: Client, table: string, name: string): Promise<string | null> {
    const { rows } = await db.query<{ def: string }>(
        `SELECT pg_get_constraintdef(c.oid) AS def FROM pg_constraint c
          WHERE c.conrelid = to_regclass($1) AND c.conname = $2`, [`public.${table}`, name]);
    return rows.length ? rows[0].def : null;
}

/** Définition sans parenthèses, sans schéma ni conversions de type, espaces réduits : comparaison de forme. */
function flat(def: string): string {
    return def.replace(/::"?[a-z_]+"?(\[\])?/g, '').replace(/public\./g, '').replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Valeurs littérales citées par une contrainte, dans l'ordre. */
function literals(def: string): string[] {
    return Array.from(def.matchAll(/'([^']*)'/g)).map((m) => m[1]);
}

async function requireConstraint(db: Client, table: string, name: string, migration: string): Promise<string> {
    const def = await constraintDef(db, table, name);
    assert.ok(def, `contrainte ${name} absente de public.${table} (${migration})`);
    return def;
}

// ── 1. Tables nouvelles ────────────────────────────────────────────────────

describe('9t.15 Schéma des zones : tables, colonnes, clés, RLS, droits', () => {
    test('1. tables event_zones, zone_categories, event_gates : colonnes, clés composées, RLS sans politique, aucun droit pour anon ni authenticated', async () => {
        await inspect(async (db) => {
            const missing: string[] = [];
            for (const t of NEW_TABLES) if (!(await tableExists(db, t))) missing.push(t);
            assert.deepEqual(missing, [], `tables absentes (${M09}) : ${missing.join(', ')}`);

            const expected: Record<string, Record<string, [string, 'YES' | 'NO']>> = {
                event_zones: {
                    id: ['uuid', 'NO'], event_id: ['uuid', 'NO'], name: ['text', 'NO'], kind: ['text', 'NO'], position: ['smallint', 'NO'],
                    created_at: ['timestamp with time zone', 'NO'], updated_at: ['timestamp with time zone', 'NO'],
                },
                zone_categories: { event_id: ['uuid', 'NO'], zone_id: ['uuid', 'NO'], category_id: ['uuid', 'NO'] },
                event_gates: {
                    id: ['uuid', 'NO'], event_id: ['uuid', 'NO'], zone_id: ['uuid', 'NO'], name: ['text', 'NO'],
                    created_at: ['timestamp with time zone', 'NO'],
                },
            };
            for (const [table, cols] of Object.entries(expected)) {
                const got = await columnsOf(db, table);
                assert.deepEqual(Array.from(got.keys()).sort(), Object.keys(cols).sort(), `public.${table} : colonnes exactes de C.1.2`);
                for (const [col, [type, nullable]] of Object.entries(cols)) {
                    assert.equal(got.get(col)?.data_type, type, `public.${table}.${col} : type`);
                    assert.equal(got.get(col)?.is_nullable, nullable, `public.${table}.${col} : nullabilité`);
                }
            }
            assert.match(flat(await requireConstraint(db, 'event_zones', 'event_zones_event_id_id_key', M09)), /^UNIQUE event_id, id$/);
            assert.match(flat(await requireConstraint(db, 'event_gates', 'event_gates_event_id_id_key', M09)), /^UNIQUE event_id, id$/);
            assert.deepEqual(literals(await requireConstraint(db, 'event_zones', 'event_zones_kind_check', M09)), ['ENTREE', 'CONTROLE']);

            const { rows: pk } = await db.query<{ def: string }>(
                `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid = 'public.zone_categories'::regclass AND contype = 'p'`);
            assert.deepEqual(pk.map((r) => flat(r.def)), ['PRIMARY KEY zone_id, category_id'], 'zone_categories : clé primaire (zone_id, category_id)');
            const { rows: fks } = await db.query<{ def: string }>(
                `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
                  WHERE conrelid = 'public.zone_categories'::regclass AND contype = 'f' ORDER BY 1`);
            assert.deepEqual(fks.map((r) => flat(r.def)).sort(), [
                'FOREIGN KEY event_id, category_id REFERENCES ticket_categories event_id, id ON DELETE CASCADE',
                'FOREIGN KEY event_id, zone_id REFERENCES event_zones event_id, id ON DELETE CASCADE',
            ], 'zone_categories : clés étrangères composées (même événement garanti par la base)');
            const { rows: gateFks } = await db.query<{ def: string }>(
                `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
                  WHERE conrelid = 'public.event_gates'::regclass AND contype = 'f' AND pg_get_constraintdef(oid) LIKE '%zone_id%'`);
            assert.deepEqual(gateFks.map((r) => flat(r.def)), ['FOREIGN KEY event_id, zone_id REFERENCES event_zones event_id, id ON DELETE RESTRICT'],
                'event_gates : porte rattachée à une zone du même événement');

            for (const t of NEW_TABLES) {
                const { rows } = await db.query<{ rls: boolean; policies: number }>(
                    `SELECT c.relrowsecurity AS rls,
                            (SELECT count(*)::int FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = $1) AS policies
                       FROM pg_class c WHERE c.oid = to_regclass($2)`, [t, `public.${t}`]);
                assert.deepEqual(rows[0], { rls: true, policies: 0 }, `public.${t} : RLS activée, aucune politique (service_role seul, x2)`);
                for (const role of API_ROLES) {
                    const { rows: priv } = await db.query<{ any: boolean }>(
                        `SELECT has_table_privilege($1, $2, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') AS any`, [role, `public.${t}`]);
                    assert.equal(priv[0].any, false, `public.${t} : aucun droit pour ${role}`);
                }
            }
        });
    });

    test('2. colonnes ajoutées : event_controllers.gate_id et gate_change_allowed (défaut faux), ticket_scans.gate_id, zone_id, zone_result, result nullable, ticket_categories.scan_color et entry_instruction', async () => {
        await inspect(async (db) => {
            const ec = await columnsOf(db, 'event_controllers');
            const ts = await columnsOf(db, 'ticket_scans');
            const tc = await columnsOf(db, 'ticket_categories');
            const expected: Array<[string, Map<string, ColumnInfo>, string, string, 'YES' | 'NO']> = [
                ['event_controllers', ec, 'gate_id', 'uuid', 'YES'],
                ['event_controllers', ec, 'gate_change_allowed', 'boolean', 'NO'],
                ['ticket_scans', ts, 'gate_id', 'uuid', 'YES'],
                ['ticket_scans', ts, 'zone_id', 'uuid', 'YES'],
                ['ticket_scans', ts, 'zone_result', 'text', 'YES'],
                ['ticket_scans', ts, 'result', 'text', 'YES'],
                ['ticket_categories', tc, 'scan_color', 'text', 'YES'],
                ['ticket_categories', tc, 'entry_instruction', 'text', 'YES'],
            ];
            const missing = expected.filter(([, cols, col]) => !cols.has(col)).map(([t, , col]) => `${t}.${col}`);
            assert.deepEqual(missing, [], `colonnes absentes (${M09}) : ${missing.join(', ')}`);
            for (const [table, cols, col, type, nullable] of expected) {
                assert.equal(cols.get(col)!.data_type, type, `${table}.${col} : type`);
                assert.equal(cols.get(col)!.is_nullable, nullable, `${table}.${col} : nullabilité (colonne ajoutée nullable ou avec défaut, contrat 1)`);
            }
            assert.equal(ec.get('gate_change_allowed')!.column_default, 'false', 'event_controllers.gate_change_allowed : DEFAULT false');
        });
    });

    test('3. contraintes exactes de C.1.2 et C.3.3', async () => {
        await inspect(async (db) => {
            assert.equal(flat(await requireConstraint(db, 'ticket_scans', 'ticket_scans_outcome_one', M09)),
                'CHECK result IS NULL <> zone_result IS NULL', 'exactement un des deux verdicts');
            assert.equal(flat(await requireConstraint(db, 'ticket_scans', 'ticket_scans_zone_not_accepted', M09)),
                'CHECK zone_result IS NULL OR NOT accepted', 'un verdict de zone n’est jamais une entrée acceptée');
            const zoneResult = await requireConstraint(db, 'ticket_scans', 'ticket_scans_zone_result_check', M09);
            assert.match(flat(zoneResult), /^CHECK zone_result IS NULL OR zone_result = ANY ARRAY\[/, zoneResult);
            assert.deepEqual(literals(zoneResult), ['wrong_zone', 'not_entered', 'zone_ok'], zoneResult);
            const color = await requireConstraint(db, 'ticket_categories', 'ticket_categories_scan_color_check', M09);
            assert.match(flat(color), /^CHECK scan_color IS NULL OR scan_color = ANY ARRAY\[/, color);
            assert.deepEqual(literals(color), SCAN_COLORS, `palette fermée de 8 clés, dans l’ordre de 3.8 : ${color}`);
            assert.equal(flat(await requireConstraint(db, 'ticket_categories', 'ticket_categories_entry_instruction_check', M09)),
                'CHECK entry_instruction IS NULL OR char_length entry_instruction >= 1 AND char_length entry_instruction <= 60',
                'consigne de 1 à 60 caractères');
            assert.equal(flat(await requireConstraint(db, 'event_controllers', 'event_controllers_gate_fk', M09)),
                'FOREIGN KEY event_id, gate_id REFERENCES event_gates event_id, id ON DELETE RESTRICT', 'porte d’un contrôleur : même événement');
            assert.equal(flat(await requireConstraint(db, 'ticket_categories', 'ticket_categories_event_id_id_key', M09)),
                'UNIQUE event_id, id', 'clé composée des catégories (EC2, pose gardée)');
            const method = await requireConstraint(db, 'ticket_scans', 'ticket_scans_method_check', M08);
            assert.deepEqual(literals(method), ['QR', 'MANUAL', 'COUNTER', 'GUEST_LIST'], `méthode GUEST_LIST admise (${M08}) : ${method}`);
        });
    });

    test('4. une ligne de zone acceptée, une ligne à deux verdicts ou sans verdict sont refusées par la base', async () => {
        const outcomes = await inRolledBackTransaction(async (db) => {
            const { rows } = await db.query<{ id: string }>(
                `SELECT ur.user_id AS id FROM public.user_roles ur WHERE ur.role = 'SUPERADMIN' ORDER BY ur.user_id LIMIT 1`);
            assert.equal(rows.length, 1, 'précondition : un SUPERADMIN dans la base de test');
            const scanner = rows[0].id;
            const cases: Array<[string, string, unknown[]]> = [
                ['verdict de zone accepté',
                    `INSERT INTO public.ticket_scans (ticket_id, scanner_id, result, zone_result, accepted, method) VALUES (NULL, $1, NULL, 'wrong_zone', TRUE, 'QR')`, [scanner]],
                ['deux verdicts',
                    `INSERT INTO public.ticket_scans (ticket_id, scanner_id, result, zone_result, accepted, method) VALUES (NULL, $1, 'invalid', 'wrong_zone', FALSE, 'QR')`, [scanner]],
                ['aucun verdict',
                    `INSERT INTO public.ticket_scans (ticket_id, scanner_id, result, zone_result, accepted, method) VALUES (NULL, $1, NULL, NULL, FALSE, 'QR')`, [scanner]],
            ];
            const out: Array<[string, string, string]> = [];
            for (const [label, sql, params] of cases) {
                await db.query('SAVEPOINT essai');
                try {
                    await db.query(sql, params);
                    out.push([label, 'accepté', '']);
                } catch (err) {
                    const e = err as { code?: string; constraint?: string; message?: string };
                    out.push([label, String(e.code ?? ''), String(e.constraint ?? e.message ?? '')]);
                } finally {
                    await db.query('ROLLBACK TO SAVEPOINT essai');
                }
            }
            return out;
        });
        assert.deepEqual(outcomes, [
            ['verdict de zone accepté', '23514', 'ticket_scans_zone_not_accepted'],
            ['deux verdicts', '23514', 'ticket_scans_outcome_one'],
            ['aucun verdict', '23514', 'ticket_scans_outcome_one'],
        ], `refus par la base (${M09}) : ${JSON.stringify(outcomes)}`);
    });

    test('5. couleur et consigne de la catégorie illisibles par anon et authenticated', async () => {
        const rights = await inspect(async (db) => {
            const out: Record<string, boolean> = {};
            for (const role of API_ROLES) {
                for (const col of ['scan_color', 'entry_instruction']) {
                    try {
                        const { rows } = await db.query<{ ok: boolean }>(
                            `SELECT has_column_privilege($1, 'public.ticket_categories', $2, 'SELECT') AS ok`, [role, col]);
                        out[`${role}.${col}`] = rows[0].ok;
                    } catch (err) {
                        const e = err as { code?: string; message?: string };
                        assert.fail(`ticket_categories.${col} illisible au catalogue (${e.code} ${e.message}) : colonne absente (${M09})`);
                    }
                }
            }
            return out;
        });
        assert.deepEqual(rights, {
            'anon.scan_color': false, 'anon.entry_instruction': false,
            'authenticated.scan_color': false, 'authenticated.entry_instruction': false,
        }, `aucun GRANT SELECT de colonne (la consigne n’est servie qu’au scanneur autorisé) : ${JSON.stringify(rights)}`);
    });

    test('6. fonctions de C : service_role seul, SECURITY DEFINER, search_path fixé, une seule définition ; aucune surcharge de scan_log ni ticket_scan ; trigger d’admission', async () => {
        const fns: Array<[string, string, boolean]> = [
            ['scan_gate_context', M09, false], ['scan_zone_verdict', M09, false], ['scan_log_at', M09, false],
            ['event_zones_get', M09, false], ['event_zones_save', M09, false], ['event_controller_gate_set', M09, false],
            ['controller_gate_select', M09, false], ['zone_categories_default_admit', M09, true],
            ['ticket_guest_list_search', M08, false], ['ticket_invitation_guest_name_set', M08, false],
        ];
        await inspect(async (db) => {
            const problems: string[] = [];
            for (const [name, migration, isTrigger] of fns) {
                const { rows } = await db.query<{ oid: number; secdef: boolean; config: string[] | null }>(
                    `SELECT p.oid::int AS oid, p.prosecdef AS secdef, p.proconfig AS config
                       FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = $1`, [name]);
                if (rows.length !== 1) {
                    problems.push(`${name} : ${rows.length} définition(s), 1 attendue (${migration})`);
                    continue;
                }
                const [fn] = rows;
                if (!fn.secdef) problems.push(`${name} : SECURITY DEFINER attendu`);
                if (!(fn.config ?? []).includes('search_path=public')) problems.push(`${name} : search_path=public attendu (${JSON.stringify(fn.config)})`);
                const { rows: priv } = await db.query<{ anon: boolean; auth: boolean; svc: boolean }>(
                    `SELECT has_function_privilege('anon', $1::oid, 'EXECUTE') AS anon,
                            has_function_privilege('authenticated', $1::oid, 'EXECUTE') AS auth,
                            has_function_privilege('service_role', $1::oid, 'EXECUTE') AS svc`, [fn.oid]);
                if (priv[0].anon) problems.push(`${name} : exécutable par anon`);
                if (priv[0].auth) problems.push(`${name} : exécutable par authenticated`);
                if (!isTrigger && !priv[0].svc) problems.push(`${name} : non exécutable par service_role`);
            }
            for (const name of ['scan_log', 'ticket_scan']) {
                const { rows } = await db.query<{ n: number }>(
                    `SELECT count(*)::int AS n FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = $1`, [name]);
                if (rows[0].n !== 1) problems.push(`${name} : ${rows[0].n} définitions, aucune surcharge permise (PGRST203)`);
            }
            const { rows: trg } = await db.query<{ timing: string; event: string; fn: string }>(
                `SELECT t.action_timing AS timing, t.event_manipulation AS event, t.action_statement AS fn
                   FROM information_schema.triggers t
                  WHERE t.event_object_schema = 'public' AND t.event_object_table = 'ticket_categories'
                    AND t.trigger_name = 'trg_ticket_categories_zone_admit'`);
            if (trg.length !== 1 || trg[0].timing !== 'AFTER' || trg[0].event !== 'INSERT' || !/zone_categories_default_admit\(\)/.test(trg[0].fn)) {
                problems.push(`trigger trg_ticket_categories_zone_admit AFTER INSERT sur ticket_categories attendu (${M09}) : ${JSON.stringify(trg)}`);
            }
            assert.deepEqual(problems, [], `fonctions de la section C :\n${problems.join('\n')}`);
        });
    });

    test('7. témoin (garde A3) : ticket_scans_result_check garde exactement la liste du 9 bis', async () => {
        await inspect(async (db) => {
            const def = await requireConstraint(db, 'ticket_scans', 'ticket_scans_result_check', 'migration gelée 20261109000008');
            assert.deepEqual(literals(def), RESULTS_9BIS, `les 17 valeurs de M/20261109000008:173-176, rien d’autre : ${def}`);
            for (const v of ['wrong_zone', 'not_entered', 'zone_ok']) assert.ok(!def.includes(`'${v}'`), `${v} n’entre jamais dans result (arbitrage 9) : ${def}`);
        });
    });
});
