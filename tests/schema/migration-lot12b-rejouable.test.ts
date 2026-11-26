/**
 * Lot 12b — les trois migrations du lot (20261222000001-003) se rejouent sans erreur : appliquées deux fois de plus dans
 * une transaction annulée, dans l'ordre ; aucun BEGIN ni COMMIT.
 * Recopie : UNE seule fonction existante est recopiée dans tout le lot, private.order_issue_code, depuis sa DERNIÈRE
 * définition (20261130000006_l12a_etapes.sql:281-299, citée en tête de migration) : chaque ligne de cette définition se
 * retrouve dans la recopie (aucune ligne remplacée, ajouts seuls). Aucune autre fonction existante n'est redéfinie par
 * le lot, en particulier celles que recopie le lot 12c (order_quote_compute, product_regulated, products_order_guard,
 * order_product_regulation_decide) et les 9 recopies du lot 12a suivies par tests/audit/cv12a-3-statique.test.ts (S1).
 * Droits : fonctions publiques nouvelles au rôle de service seulement ; aides du schéma private et tables private à aucun
 * rôle de l'API (clé de service comprise).
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { inRolledBackTransaction } from '../helpers/db';

const DIR = path.resolve(process.cwd(), 'supabase/migrations');
const FILES = ['20261222000001_l12b_code_visible.sql', '20261222000002_l12b_carte_des_plats.sql', '20261222000003_l12b_garde_prix.sql'];
const FIRST = '20261222000001';

/** Seule recopie du lot. */
const RECOPIED = 'private.order_issue_code';
/** Fonctions nouvelles du lot. */
const NEW_FUNCTIONS = [
    'private.order_code_encrypt', 'private.order_code_decrypt', 'private.order_codes_clear', 'public.order_code_reveal',
    'public.order_venue_menu', 'private.order_expected_amount', 'public.order_create_checked', 'public.order_payment_start',
];
const NEW_PUBLIC = NEW_FUNCTIONS.filter((f) => f.startsWith('public.')).map((f) => f.slice('public.'.length));
const NEW_PRIVATE = [...NEW_FUNCTIONS.filter((f) => f.startsWith('private.')).map((f) => f.slice('private.'.length)), 'order_issue_code'];
/** Fonctions que le lot ne doit jamais redéfinir (12c, 12a S1, cœur des commandes). */
const UNTOUCHED = [
    'order_quote_compute', 'product_regulated', 'products_order_guard', 'order_product_regulation_decide', 'order_quote', 'order_create',
    'order_payment_create', 'order_view', 'order_cancel', 'order_code_resend', 'finance_setting_set', 'fin_setting_valid',
    'platform_settings_defaults', 'fin_payout_available_at', 'calculate_referral_commissions', 'finance_admin_earned',
    'finance_admin_payments', 'notif_cashouts_notify', 'notification_sync_log', 'listed_venue',
];

const allMigrations = (): string[] =>
    fs.readdirSync(DIR).filter((f) => /^\d{14}_.+\.sql$/.test(f) || /^\d{4}_.+\.sql$/.test(f)).sort();

/** Toutes les définitions de schéma.nom dans les fichiers donnés (du CREATE au second $$), avec leur fichier. */
function definitions(name: string, files: readonly string[]): Array<{ file: string; text: string }> {
    const head = new RegExp(`^CREATE (OR REPLACE )?FUNCTION ${name.replace('.', '\\.')}\\s*\\(`, 'i');
    const out: Array<{ file: string; text: string }> = [];
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
            out.push({ file: f, text: lines.slice(i, j + 1).join('\n') });
        });
    }
    return out;
}

describe('Lot 12b — migrations', () => {
    test('présentes, dans l’ordre, après les migrations de main (11c-c : 20261215000002)', () => {
        const all = fs.readdirSync(DIR).filter((f) => /^\d{14}_.+\.sql$/.test(f)).sort();
        for (const f of FILES) assert.ok(all.includes(f), `migration absente : supabase/migrations/${f}`);
        const lot = all.filter((f) => f.startsWith('20261222'));
        assert.deepEqual(lot, FILES, 'intervalle 20261222… : les trois migrations du lot seulement');
        assert.ok(all.filter((f) => f < FIRST).includes('20261215000002_l11cc_cv_correctifs.sql'));
    });

    test('sans BEGIN ni COMMIT, appliquées deux fois de plus sans erreur', async () => {
        const sqls = FILES.map((f) => fs.readFileSync(path.join(DIR, f), 'utf8'));
        for (const [i, sql] of sqls.entries()) assert.doesNotMatch(sql, /^\s*(BEGIN|COMMIT)\s*;\s*$/im, FILES[i]);
        await inRolledBackTransaction(async (c) => {
            for (const sql of sqls) await c.query(sql);
            for (const sql of sqls) await c.query(sql);
        });
    });

    test(`seule recopie du lot : ${RECOPIED}, une fois, sans aucune ligne perdue de sa dernière définition`, () => {
        const before = allMigrations().filter((f) => f < FIRST);
        const previous = definitions(RECOPIED, before).at(-1);
        const mine = definitions(RECOPIED, FILES);
        assert.ok(previous, 'définition précédente introuvable');
        assert.equal(previous!.file, '20261130000006_l12a_etapes.sql', 'dernière définition de main');
        assert.equal(mine.length, 1, `une seule recopie dans le lot : ${mine.map((d) => d.file).join(', ')}`);
        const kept = new Set(mine[0].text.split('\n').map((l) => l.trim()));
        const lost = previous!.text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0 && !kept.has(l));
        assert.deepEqual(lost, [], 'lignes perdues');
        const head = fs.readFileSync(path.join(DIR, FILES[0]), 'utf8');
        assert.match(head, /20261130000006_l12a_etapes\.sql:281-299/, 'fichier et lignes de la dernière définition cités');
        // Lignes citées : elles bornent bien la définition (CREATE … $$;)
        const src = fs.readFileSync(path.join(DIR, '20261130000006_l12a_etapes.sql'), 'utf8').replace(/\r\n/g, '\n').split('\n');
        assert.match(src[280], /^CREATE OR REPLACE FUNCTION private\.order_issue_code\(/);
        assert.equal(src[298].trim(), '$$;');
    });

    test('aucune autre fonction existante redéfinie par le lot (12c, recopies du 12a, cœur des commandes)', () => {
        const before = allMigrations().filter((f) => f < FIRST);
        for (const fn of NEW_FUNCTIONS) {
            assert.equal(definitions(fn, before).length, 0, `${fn} existe déjà avant le lot`);
            assert.equal(definitions(fn, FILES).length, 1, `${fn} : une définition dans le lot`);
        }
        const redefined = UNTOUCHED.filter((name) => definitions(`public.${name}`, FILES).length > 0 || definitions(`private.${name}`, FILES).length > 0);
        assert.deepEqual(redefined, []);
        // Toute fonction définie dans le lot est soit la recopie, soit nouvelle
        const created = FILES.flatMap((f) => [...fs.readFileSync(path.join(DIR, f), 'utf8').matchAll(/^CREATE (?:OR REPLACE )?FUNCTION ([a-z_]+\.[a-z_]+)\s*\(/gim)].map((m) => m[1]));
        assert.deepEqual([...new Set(created)].sort(), [...NEW_FUNCTIONS, RECOPIED].sort());
    });

    test('droits : publiques nouvelles au rôle de service seulement ; private à aucun rôle de l’API ; tables private fermées', async () => {
        await inRolledBackTransaction(async (c) => {
            const { rows: pub } = await c.query<{ proname: string; anon: boolean; auth: boolean; svc: boolean; pub: boolean }>(
                `SELECT p.proname, has_function_privilege('anon', p.oid, 'EXECUTE') AS anon, has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth,
                        has_function_privilege('service_role', p.oid, 'EXECUTE') AS svc,
                        EXISTS (SELECT 1 FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a WHERE a.grantee = 0) AS pub
                   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                  WHERE n.nspname = 'public' AND p.proname = ANY ($1) ORDER BY p.proname`, [NEW_PUBLIC]);
            assert.deepEqual(pub.map((r) => r.proname).sort(), [...NEW_PUBLIC].sort());
            for (const r of pub) assert.deepEqual([r.proname, r.anon, r.auth, r.pub, r.svc], [r.proname, false, false, false, true]);
            const { rows: priv } = await c.query<{ proname: string; anon: boolean; auth: boolean; svc: boolean }>(
                `SELECT p.proname, has_function_privilege('anon', p.oid, 'EXECUTE') AS anon, has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth,
                        has_function_privilege('service_role', p.oid, 'EXECUTE') AS svc
                   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                  WHERE n.nspname = 'private' AND p.proname = ANY ($1) ORDER BY p.proname`, [NEW_PRIVATE]);
            assert.deepEqual(priv.map((r) => r.proname).sort(), [...NEW_PRIVATE].sort());
            for (const r of priv) assert.deepEqual([r.proname, r.anon, r.auth, r.svc], [r.proname, false, false, false]);
            const { rows: tables } = await c.query<{ t: string; anon: boolean; auth: boolean; svc: boolean }>(
                `SELECT t, has_table_privilege('anon', t, 'SELECT') AS anon, has_table_privilege('authenticated', t, 'SELECT') AS auth,
                        has_table_privilege('service_role', t, 'SELECT') AS svc
                   FROM unnest(ARRAY['private.order_codes', 'private.order_code_enc_key']) AS t`);
            for (const r of tables) assert.deepEqual([r.t, r.anon, r.auth, r.svc], [r.t, false, false, false]);
            const { rows: schema } = await c.query<{ anon: boolean; auth: boolean; svc: boolean }>(
                `SELECT has_schema_privilege('anon', 'private', 'USAGE') AS anon, has_schema_privilege('authenticated', 'private', 'USAGE') AS auth,
                        has_schema_privilege('service_role', 'private', 'USAGE') AS svc`);
            assert.deepEqual(schema[0], { anon: false, auth: false, svc: false });
        });
    });

    test('règles de lecture des produits : établissement listé (listed_venue), propriétaire, administration', async () => {
        await inRolledBackTransaction(async (c) => {
            const { rows } = await c.query<{ tablename: string; policyname: string; qual: string }>(
                `SELECT tablename, policyname, qual FROM pg_policies
                  WHERE schemaname = 'public' AND policyname IN ('products_read', 'product_options_read', 'product_daily_portions_read') ORDER BY policyname`);
            assert.equal(rows.length, 3);
            for (const r of rows) {
                assert.match(r.qual, /listed_venue/, `${r.policyname} : établissement listé`);
                assert.match(r.qual, /is_partner_owner/, `${r.policyname} : propriétaire`);
                assert.match(r.qual, /is_admin\(\)/, `${r.policyname} : administration`);
            }
        });
    });
});
