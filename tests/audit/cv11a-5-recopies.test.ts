/**
 * Contre-vérification du lot 11a — point 5 : recopies de fonctions communes et réglages des salles, après TOUTES les
 * migrations (base LOCALE montée par la CI depuis supabase/migrations, main compris : main n'a aucune migration absente
 * de cette branche, vérifié par `git diff --name-only HEAD origin/main -- supabase/migrations`).
 *
 *  5.1 Chaque fonction recopiée par la 11a contient tout le code de sa dernière version dans main (dernière définition
 *      d'un fichier antérieur à 20261123000101) : chaque ligne (commentaires et blancs retirés, espaces réduits) est dans
 *      le corps en base (pg_proc.prosrc), sauf les lignes remplacées par leur version élargie aux tables, listées
 *      ci-dessous une à une avec leur remplaçante (qui doit être en base). Le corps en base est aussi celui de la 11a.
 *  5.2 Chaque réglage des salles (halls.*, dont halls.full_payment_margin_hours) : présent, lu par la route de
 *      l'administration et par platform_settings_defaults, modifiable par le SUPERADMIN (fonction et route), valeurs
 *      invalides refusées, valeur inchangée. Même contrôle de la route pour les réglages des tables.
 * Un test rouge est un TROU (docs/audit-lot11a.md). Les écritures remettent la même valeur (aucun effet sur les suites).
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { signInAs } from '../helpers/fixtures';
import { api, service, show, sql, trace, type Row } from './cv11a-helpers';

const MIGRATIONS = join(process.cwd(), 'supabase', 'migrations');
const FIRST_11A = '20261123000101';
/** Première migration d'un lot postérieur qui recopie aussi ces fonctions (finition 4). */
const LATER = '20261125000001';

const RECOPIED = [
    'finance_setting_set', 'fin_setting_valid', 'platform_settings_defaults', 'fin_payout_available_at', 'calculate_referral_commissions',
    'notif_cashouts_notify', 'notif_admin_review_sms', 'finance_admin_earned', 'finance_admin_payments',
] as const;

/** Lignes de main remplacées par la 11a : ligne d'origine → lignes qui doivent la remplacer (même sens, tables en plus). */
const REPLACED: Record<string, Record<string, string[]>> = {
    finance_setting_set: {
        "'halls.full_payment_margin_hours') THEN": ["'halls.full_payment_margin_hours',"],
        // Design 1c bis (migration 20261124000001, modification signalée) : seul le message du refus change
        "RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'Seul un SUPERADMIN actif modifie les réglages de la plateforme.');":
            ["RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'Seul un super-administrateur actif peut modifier les réglages.');"],
    },
    fin_setting_valid: { "'halls.validation_required') THEN": ["'halls.validation_required', 'tables.validation_required') THEN"] },
    platform_settings_defaults: {
        "WHERE s.key ~ '^(finance|access|notif|features|support|halls)\\.'": ["WHERE s.key ~ '^(finance|access|notif|features|support|halls|tables)\\.'"],
    },
    fin_payout_available_at: {
        'SELECT id, payment_target::text AS payment_target, event_id, paid_at, payout_hold_enabled, payout_delay_hours, hall_reservation_id':
            ['SELECT id, payment_target::text AS payment_target, event_id, paid_at, payout_hold_enabled, payout_delay_hours, hall_reservation_id,', 'table_reservation_id'],
    },
    notif_cashouts_notify: {
        "AND NOT EXISTS (SELECT 1 FROM public.payments hp WHERE hp.id = NEW.payment_id AND hp.payment_target::text = 'HALL_RESERVATION') THEN":
            ['AND NOT EXISTS (SELECT 1 FROM public.payments hp WHERE hp.id = NEW.payment_id', "AND hp.payment_target::text IN ('HALL_RESERVATION', 'TABLE_RESERVATION')) THEN"],
    },
    notif_admin_review_sms: {
        "IF v_kind NOT IN ('PARTNER_NEW', 'PARTNER_RESUBMITTED', 'EVENT_SUBMITTED') THEN": ["IF v_kind NOT IN ('PARTNER_NEW', 'PARTNER_RESUBMITTED', 'EVENT_SUBMITTED', 'VENUE_SUBMITTED') THEN"],
        // Même compte pour les anciennes sortes (PARTNER_NEW, PARTNER_RESUBMITTED : 1 ; EVENT_SUBMITTED : 0) ; VENUE_SUBMITTED compté à part
        "'partner_count', COALESCE((v_row.template_data->>'partner_count')::integer, 0) + CASE WHEN v_kind = 'EVENT_SUBMITTED' THEN 0 ELSE 1 END,":
            ["'partner_count', COALESCE((v_row.template_data->>'partner_count')::integer, 0) + CASE WHEN v_kind IN ('PARTNER_NEW', 'PARTNER_RESUBMITTED') THEN 1 ELSE 0 END,"],
        "'partner_count', CASE WHEN v_kind = 'EVENT_SUBMITTED' THEN 0 ELSE 1 END,": ["'partner_count', CASE WHEN v_kind IN ('PARTNER_NEW', 'PARTNER_RESUBMITTED') THEN 1 ELSE 0 END,"],
    },
    finance_admin_earned: {
        "COALESCE(sum(CASE WHEN p.payment_target::text = 'HALL_RESERVATION'": ["COALESCE(sum(CASE WHEN p.payment_target::text IN ('HALL_RESERVATION', 'TABLE_RESERVATION')"],
    },
    finance_admin_payments: {
        "'commission', CASE WHEN py.payment_target::text = 'HALL_RESERVATION'": ["'commission', CASE WHEN py.payment_target::text IN ('HALL_RESERVATION', 'TABLE_RESERVATION')"],
        "+ CASE WHEN py.payment_target::text = 'HALL_RESERVATION' AND py.facial_amount IS NOT NULL THEN":
            ["+ CASE WHEN py.payment_target::text IN ('HALL_RESERVATION', 'TABLE_RESERVATION') AND py.facial_amount IS NOT NULL THEN"],
    },
};

/** Corps (entre les marques dollar) de chaque définition `CREATE OR REPLACE FUNCTION public.<name>(` des migrations, dans l'ordre. */
function definitions(name: string): Array<{ file: string; body: string }> {
    const out: Array<{ file: string; body: string }> = [];
    const head = new RegExp(`CREATE OR REPLACE FUNCTION public\\.${name}\\s*\\(`, 'g');
    for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
        const text = readFileSync(join(MIGRATIONS, file), 'utf8');
        for (const m of text.matchAll(head)) {
            const as = text.indexOf('AS $', m.index!);
            const tag = text.slice(as + 3, text.indexOf('$', as + 4) + 1);
            const start = as + 3 + tag.length;
            out.push({ file, body: text.slice(start, text.indexOf(tag, start)) });
        }
    }
    return out;
}

function lines(body: string): string[] {
    return body.split(/\r?\n/).map((l) => l.replace(/--.*$/, '').trim().replace(/\s+/g, ' ')).filter(Boolean);
}

describe('5.1 Recopies de la 11a : tout le code de main', () => {
    for (const name of RECOPIED) {
        test(`${name} : chaque ligne de sa dernière version dans main est en base (ou remplacée par sa version élargie)`, async () => {
            const defs = definitions(name);
            const main = defs.filter((d) => d.file < FIRST_11A).at(-1);
            // Finition 4 (modification signalée au rapport) : une recopie postérieure (20261125…) remplace la version de la 11a en base,
            // et tests/parcours/f4-recopies.test.ts la vérifie ; ici, la 11a est alors contrôlée sur son fichier.
            const l11a = defs.filter((d) => d.file >= FIRST_11A && d.file < LATER).at(-1);
            const later = defs.some((d) => d.file >= LATER);
            assert.ok(main, `${name} : aucune définition dans main`);
            assert.ok(l11a, `${name} : pas recopiée par la 11a`);
            const rows = await sql<{ src: string }>(`SELECT string_agg(prosrc, E'\\n') AS src FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = $1`, [name]);
            const live = new Set(later ? lines(l11a?.body ?? '') : lines(String(rows[0]?.src ?? '')));
            const replaced = REPLACED[name] ?? {};
            const lost: string[] = [];
            const badReplacement: string[] = [];
            for (const l of lines(main!.body)) {
                if (live.has(l)) continue;
                if (replaced[l]) {
                    for (const r of replaced[l]) if (!live.has(r)) badReplacement.push(`${l} → ${r}`);
                } else {
                    lost.push(l);
                }
            }
            const notApplied = lines(l11a!.body).filter((l) => !live.has(l));
            trace(`5.1 ${name}`, { main: main!.file, l11a: l11a!.file, lignesMain: lines(main!.body).length, perdues: lost, remplacantesAbsentes: badReplacement, versionEnBaseDifferenteDe11a: notApplied.length });
            assert.deepEqual(lost, [], `${name} : lignes de main (${main!.file}) perdues après la recopie de ${l11a!.file}`);
            assert.deepEqual(badReplacement, [], `${name} : remplaçantes absentes`);
            assert.deepEqual(notApplied, [], `${name} : le corps en base n'est pas celui de ${l11a!.file}`);
        });
    }
});

/** Réglages des salles connus de main : clés de finance_setting_set dans sa dernière version antérieure à la 11a. */
function hallKeysOfMain(): string[] {
    const main = definitions('finance_setting_set').filter((d) => d.file < FIRST_11A).at(-1)!;
    return [...new Set([...main.body.matchAll(/'(halls\.[a-z_]+)'/g)].map((m) => m[1]))].sort();
}

function invalidValues(current: unknown): unknown[] {
    return typeof current === 'boolean' ? ['abc', 5] : [-1, 1_000_000_000, 'abc'];
}

describe('5.2 Réglages des salles après toutes les migrations', () => {
    test('chaque réglage halls.* : présent, lu, modifiable par le SUPERADMIN (fonction), valeurs invalides refusées, inchangé', async () => {
        const keys = hallKeysOfMain();
        assert.ok(keys.includes('halls.full_payment_margin_hours'), `précondition : clés de main ${JSON.stringify(keys)}`);
        const superadmin = await signInAs('SUPERADMIN');
        const read = await api('GET', 'admin/finance-settings', { token: superadmin.accessToken });
        assert.equal(read.status, 200, show(read));
        const listed = new Map(((read.body.settings as Row[]) ?? []).map((s) => [String(s.key), s.value]));
        const defaults = (read.body.defaults ?? {}) as Row;
        const report: Row = {};
        const problems: string[] = [];
        for (const key of keys) {
            const row = (await sql(`SELECT value FROM public.platform_settings WHERE key = $1`, [key]))[0];
            const current = (row?.value as Row | undefined)?.value;
            const same = await service.rpc('finance_setting_set', { p_key: key, p_value: { value: current }, p_actor: superadmin.userId, p_reason: 'contre-vérification 11a : même valeur' });
            const refused: string[] = [];
            for (const bad of invalidValues(current)) {
                const r = await service.rpc('finance_setting_set', { p_key: key, p_value: { value: bad }, p_actor: superadmin.userId, p_reason: 'contre-vérification 11a : valeur invalide' });
                refused.push(r.error ? `erreur ${r.error.message}` : String((r.data as Row).code ?? (r.data as Row).ok));
            }
            const afterRow = (await sql(`SELECT value FROM public.platform_settings WHERE key = $1`, [key]))[0];
            const entry = {
                enBase: row !== undefined, valeur: current, luParLaRoute: listed.has(key), parDefaut: key in defaults,
                memeValeur: same.error?.message ?? (same.data as Row).ok, invalides: refused, inchange: JSON.stringify(afterRow?.value) === JSON.stringify(row?.value),
            };
            report[key] = entry;
            if (!entry.enBase) problems.push(`${key} absent de platform_settings`);
            if (!entry.luParLaRoute) problems.push(`${key} absent de la lecture de l'administration`);
            if (!entry.parDefaut) problems.push(`${key} absent de platform_settings_defaults`);
            if (entry.memeValeur !== true) problems.push(`${key} non modifiable par le SUPERADMIN : ${String(entry.memeValeur)}`);
            if (!refused.every((r) => r === 'INVALID_VALUE')) problems.push(`${key} : valeur invalide acceptée (${refused.join(', ')})`);
            if (!entry.inchange) problems.push(`${key} : valeur changée`);
        }
        trace('5.2a', report);
        assert.deepEqual(problems, []);
    });

    test('route de l’administration (PUT, SUPERADMIN, même valeur) : chaque réglage des salles et des tables est enregistrable', async () => {
        const superadmin = await signInAs('SUPERADMIN');
        const rows = await sql<{ key: string; value: Row }>(`SELECT key, value FROM public.platform_settings WHERE key LIKE 'halls.%' OR key LIKE 'tables.%' ORDER BY key`);
        const out: Row = {};
        for (const r of rows) {
            const res = await api('PUT', 'admin/finance-settings', { token: superadmin.accessToken, body: { key: r.key, value: r.value.value, reason: 'contre-vérification 11a : même valeur' } });
            out[r.key] = res.status === 200 ? 200 : `${res.status} ${String(res.body.error ?? '').slice(0, 120)}`;
        }
        trace('5.2b', out);
        assert.ok(rows.length >= 22, `précondition : ${rows.length} réglages halls.* et tables.*`);
        const refused = Object.entries(out).filter(([, s]) => s !== 200).map(([k]) => k);
        assert.deepEqual(refused, [], `réglages refusés par la route du SUPERADMIN : ${refused.length} sur ${rows.length}`);
    });
});
