/**
 * Lot 6, tâche 6.5 — réglages notif.* des rappels (contrat I1, décisions 24 et 25), sur le même mécanisme
 * historisé que finance.* (lot 3) et access.* (lot 4) : même RPC (finance_setting_set), même validation
 * (fin_setting_valid), même route (/api/admin/finance-settings), même page (/admin/finance-settings).
 *  - les 10 clés notif.* existent avec leur valeur par défaut et une description (lot 7, T4 : 9 − 1 + 2,
 *    notif.sms_daily_alert supprimée, notif.sms_optional_daily_cap et notif.free_ticket_reminder_sms ajoutées) ;
 *  - bornes de chaque clé par la RPC : valeurs admises appliquées, valeurs refusées (INVALID_VALUE) sans
 *    effet ni historique ; heure du J-1 de 6 à 20, heures du H-3 de 1 à 12, choix ALWAYS | IF_NO_PUSH |
 *    NEVER, plage de silence de 0 à 23 (début = fin admis : plage vide) ; lot 7 : plafond des SMS optionnels
 *    de 0 à 1 000 000, choix NEVER | SAME_AS_PAID pour les rappels des billets gratuits ;
 *  - notif_in_quiet_hours (contrat D) : plage qui passe minuit (22 h - 8 h), plage vide (début = fin),
 *    plage dans la journée ;
 *  - finance_setting_set : ADMIN refusé (FORBIDDEN, nouveau message du contrat I1.3), clé notif.*
 *    inconnue refusée (UNKNOWN_KEY), sans effet ;
 *  - historique : ancienne et nouvelle valeur, auteur, motif ;
 *  - route : GET (ADMIN et SUPERADMIN) renvoie les clés notif.* et leur historique ; PUT : 403 pour
 *    l'ADMIN, 200 pour le SUPERADMIN (entier, booléen, choix), valeur hors bornes et clé inconnue 400 ;
 *  - POST /api/admin/pricing (ADMIN avec pricing.manage, écriture service_role sans validation) : 403
 *    NOTIF_SETTING, ni modification ni création d'une clé notif.* ;
 *  - page /admin/finance-settings : 10 libellés exacts (unité « h » pour les heures), choix en français,
 *    section « Notifications » (icône Bell), plus aucune entrée notif.sms_daily_alert ; lot 7 : section
 *    « Fonctionnalités » (interrupteurs features.*) — contrôle statique.
 * Lot 7 (7.0 a, 7.0 b, T4) : rouge jusqu'à fix(7.0a) (clés et bornes) et fix(7.0f) (libellés de la page).
 *
 * Rouge avant correctif : aucune clé notif.* n'existe (migration 20261103000003 absente) ;
 * finance_setting_set répond UNKNOWN_KEY pour toute clé notif.* ; notif_in_quiet_hours n'existe pas ;
 * la route refuse les clés notif.* (PutSchema : finance|access) et ne les lit pas ; /api/admin/pricing
 * écrit (et crée) une clé notif.* ; la page ne connaît aucune clé notif.*.
 * La suite restaure toute valeur qu'elle modifie et supprime toute clé qu'elle aurait créée.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { NextRequest } from 'next/server';
import { inspect } from '../helpers/db';
import { signInAs } from '../helpers/fixtures';
import { jsonRequest, superadminId } from './finance-helpers';
import { importModule, service } from './paiement-helpers';
import {
    assertNotificationInvariants, getNotifSetting, newAdmin, NOTIF_SETTING_DEFAULTS, setNotifSetting,
    type NotifSettingKey,
} from './notif-helpers';

type Handler = (req: NextRequest) => Promise<Response>;
type Row = Record<string, unknown>;

const KEYS = Object.keys(NOTIF_SETTING_DEFAULTS) as NotifSettingKey[];
const ROUTE = '/api/admin/finance-settings';
const FORBIDDEN_MESSAGE = 'Seul un SUPERADMIN actif modifie les réglages de la plateforme.';
const PRICING_REFUSAL = 'Réglage des notifications : utilisez /api/admin/finance-settings (SUPERADMIN).';

let GET: Handler;
let PUT: Handler;

before(async () => {
    ({ GET, PUT } = await importModule('../../app/api/admin/finance-settings/route'));
});

after(async () => {
    await assertNotificationInvariants('notif-reglages');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

interface SetReply { ok?: boolean; code?: string; message?: string; key?: string; value?: unknown }

/** Appel brut de finance_setting_set (le résultat n'est pas exigé : les refus sont vérifiés par l'appelant). */
async function rpcSet(key: string, value: unknown, actor: string, reason = 'test des bornes, lot 6'): Promise<SetReply> {
    const { data, error } = await service.rpc('finance_setting_set', { p_key: key, p_value: { value }, p_actor: actor, p_reason: reason });
    assert.equal(error, null, `finance_setting_set(${key}) : ${error?.message}`);
    assert.ok(data && typeof data === 'object', `finance_setting_set(${key}) : réponse vide`);
    return data as SetReply;
}

async function historyOf(key: string): Promise<Row[]> {
    const { data, error } = await service.from('platform_settings_history').select('*').eq('key', key).order('id', { ascending: false });
    assert.equal(error, null, `historique de ${key} : ${error?.message}`);
    return (data ?? []) as Row[];
}

function inner(v: unknown): unknown {
    return v && typeof v === 'object' && 'value' in (v as Row) ? (v as Row).value : v;
}

/** Valeurs courantes des 10 clés (chacune doit exister). */
async function snapshot(): Promise<Map<NotifSettingKey, unknown>> {
    const out = new Map<NotifSettingKey, unknown>();
    for (const k of KEYS) out.set(k, await getNotifSetting(k));
    return out;
}

/** Remet chaque clé à sa valeur photographiée si elle a changé (par la RPC, historisé). */
async function restore(saved: Map<NotifSettingKey, unknown>): Promise<void> {
    for (const [k, v] of Array.from(saved.entries())) {
        if (JSON.stringify(await getNotifSetting(k)) !== JSON.stringify(v)) {
            await setNotifSetting(k, v, 'restauration après un test du lot 6 (réglages)');
        }
    }
}

async function keyExists(key: string): Promise<boolean> {
    const { data, error } = await service.from('platform_settings').select('key').eq('key', key);
    assert.equal(error, null, `lecture de ${key} : ${error?.message}`);
    return (data ?? []).length > 0;
}

/** Supprime des clés créées par erreur (avant correctif : la route pricing crée des clés notif.*). */
async function dropKeys(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    const { error } = await service.from('platform_settings').delete().in('key', keys);
    assert.equal(error, null, `nettoyage des clés ${keys.join(', ')} : ${error?.message}`);
}

// ── Valeurs admises et refusées (contrat I1) ───────────────────────────────

const ACCEPTED: Array<[NotifSettingKey, unknown]> = [
    ['notif.reminder_j1_enabled', false], ['notif.reminder_j1_enabled', true],
    ['notif.reminder_j1_hour', 6], ['notif.reminder_j1_hour', 20], ['notif.reminder_j1_hour', 10],
    ['notif.reminder_h3_enabled', false], ['notif.reminder_h3_enabled', true],
    ['notif.reminder_h3_hours', 1], ['notif.reminder_h3_hours', 12], ['notif.reminder_h3_hours', 3],
    ['notif.j1_sms', 'IF_NO_PUSH'], ['notif.j1_sms', 'NEVER'], ['notif.j1_sms', 'ALWAYS'],
    ['notif.h3_sms', 'ALWAYS'], ['notif.h3_sms', 'NEVER'], ['notif.h3_sms', 'IF_NO_PUSH'],
    ['notif.sms_quiet_start', 0], ['notif.sms_quiet_start', 23], ['notif.sms_quiet_start', 8],
    ['notif.sms_quiet_end', 0], ['notif.sms_quiet_end', 23], ['notif.sms_quiet_end', 8],
    // Lot 7 (T4) : notif.sms_daily_alert supprimée ; bornes des deux clés du lot 7.
    ['notif.sms_optional_daily_cap', 0], ['notif.sms_optional_daily_cap', 1_000_000], ['notif.sms_optional_daily_cap', 700],
    ['notif.free_ticket_reminder_sms', 'SAME_AS_PAID'], ['notif.free_ticket_reminder_sms', 'NEVER'],
];

const REFUSED: Array<[NotifSettingKey, unknown]> = [
    ['notif.reminder_j1_enabled', 'oui'], ['notif.reminder_j1_enabled', 1], ['notif.reminder_j1_enabled', null],
    ['notif.reminder_j1_hour', 5], ['notif.reminder_j1_hour', 21], ['notif.reminder_j1_hour', 10.5], ['notif.reminder_j1_hour', '10'], ['notif.reminder_j1_hour', true],
    ['notif.reminder_h3_enabled', 'non'], ['notif.reminder_h3_enabled', 0],
    ['notif.reminder_h3_hours', 0], ['notif.reminder_h3_hours', 13], ['notif.reminder_h3_hours', 2.5], ['notif.reminder_h3_hours', -3],
    ['notif.j1_sms', 'TOUJOURS'], ['notif.j1_sms', 'always'], ['notif.j1_sms', 1], ['notif.j1_sms', true],
    ['notif.h3_sms', 'SOMETIMES'], ['notif.h3_sms', ''], ['notif.h3_sms', null],
    ['notif.sms_quiet_start', -1], ['notif.sms_quiet_start', 24], ['notif.sms_quiet_start', 7.5], ['notif.sms_quiet_start', '22'],
    ['notif.sms_quiet_end', -1], ['notif.sms_quiet_end', 24], ['notif.sms_quiet_end', 8.5],
    ['notif.sms_optional_daily_cap', -1], ['notif.sms_optional_daily_cap', 1_000_001], ['notif.sms_optional_daily_cap', 2.5],
    ['notif.sms_optional_daily_cap', '700'], ['notif.sms_optional_daily_cap', null], ['notif.sms_optional_daily_cap', true],
    ['notif.free_ticket_reminder_sms', 'ALWAYS'], ['notif.free_ticket_reminder_sms', 'never'], ['notif.free_ticket_reminder_sms', ''],
    ['notif.free_ticket_reminder_sms', 1], ['notif.free_ticket_reminder_sms', null],
];

describe('6.5 Réglages notif.* (contrat I1)', () => {
    test('les 10 clés notif.* existent avec leur valeur par défaut et une description', async () => {
        assert.equal(KEYS.length, 10, 'dix clés : neuf du contrat I1, moins notif.sms_daily_alert, plus deux du lot 7 (M1)');
        const { data, error } = await service.from('platform_settings').select('key, value, description').like('key', 'notif.%');
        assert.equal(error, null, `lecture des clés notif.* : ${error?.message}`);
        const rows = (data ?? []) as Array<{ key: string; value: unknown; description: string | null }>;
        assert.deepEqual(rows.map((r) => r.key).sort(), [...KEYS].sort(),
            `clés notif.* en base : ${JSON.stringify(rows.map((r) => r.key))} (migrations 20261103000003 et 20261105000001 attendues)`);
        for (const key of KEYS) {
            const row = rows.find((r) => r.key === key)!;
            assert.deepEqual(inner(row.value), NOTIF_SETTING_DEFAULTS[key], `valeur par défaut de ${key}`);
            assert.ok(typeof row.description === 'string' && row.description.trim().length >= 10, `${key} : description française attendue`);
        }
    });

    test('finance_setting_set (SUPERADMIN) : chaque valeur admise par le contrat est appliquée', async () => {
        const actor = await superadminId();
        const saved = await snapshot();
        try {
            for (const [key, value] of ACCEPTED) {
                const r = await rpcSet(key, value, actor);
                assert.equal(r.ok, true, `${key} = ${JSON.stringify(value)} refusé : ${JSON.stringify(r)}`);
                assert.deepEqual(await getNotifSetting(key), value, `${key} = ${JSON.stringify(value)} appliqué`);
            }
        } finally {
            await restore(saved);
        }
    });

    test('finance_setting_set (SUPERADMIN) : chaque valeur hors bornes ou de mauvais type → INVALID_VALUE, sans effet ni historique', async () => {
        const actor = await superadminId();
        const saved = await snapshot();
        const counts = new Map<NotifSettingKey, number>();
        for (const k of KEYS) counts.set(k, (await historyOf(k)).length);
        try {
            for (const [key, value] of REFUSED) {
                const r = await rpcSet(key, value, actor, 'valeur refusée attendue');
                assert.equal(r.ok, false, `${key} = ${JSON.stringify(value)} accepté : ${JSON.stringify(r)}`);
                assert.equal(r.code, 'INVALID_VALUE', `${key} = ${JSON.stringify(value)} : code ${r.code} (${r.message})`);
            }
            for (const k of KEYS) {
                assert.deepEqual(await getNotifSetting(k), saved.get(k), `${k} inchangé après les refus`);
                assert.equal((await historyOf(k)).length, counts.get(k), `${k} : aucun historique pour un refus`);
            }
        } finally {
            await restore(saved);
        }
    });

    test('notif_in_quiet_hours : 22 h - 8 h passe minuit, début = fin est une plage vide, plage dans la journée', async () => {
        const cases: Array<[string, number, number, boolean]> = [
            ['2026-11-10T22:00:00Z', 22, 8, true], ['2026-11-10T23:59:00Z', 22, 8, true], ['2026-11-11T00:00:00Z', 22, 8, true],
            ['2026-11-11T07:59:00Z', 22, 8, true], ['2026-11-11T08:00:00Z', 22, 8, false], ['2026-11-11T21:59:00Z', 22, 8, false],
            ['2026-11-11T10:00:00Z', 22, 8, false],
            ['2026-11-11T03:00:00Z', 0, 0, false], ['2026-11-11T15:00:00Z', 0, 0, false], ['2026-11-11T08:30:00Z', 8, 8, false],
            ['2026-11-11T08:00:00Z', 8, 20, true], ['2026-11-11T19:59:00Z', 8, 20, true], ['2026-11-11T20:00:00Z', 8, 20, false],
            ['2026-11-11T07:59:00Z', 8, 20, false],
        ];
        const found = await inspect(async (db) => (await db.query<{ ok: boolean }>(
            "SELECT to_regprocedure('public.notif_in_quiet_hours(timestamptz, integer, integer)') IS NOT NULL AS ok")).rows[0].ok);
        assert.equal(found, true, 'public.notif_in_quiet_hours(timestamptz, integer, integer) absente (contrat D, migration 20261103000002)');
        const got = await inspect(async (db) => {
            const out: boolean[] = [];
            for (const [at, start, end] of cases) {
                const r = await db.query<{ q: boolean }>('SELECT public.notif_in_quiet_hours($1::timestamptz, $2::int, $3::int) AS q', [at, start, end]);
                out.push(r.rows[0].q);
            }
            return out;
        });
        cases.forEach(([at, start, end, expected], i) => {
            assert.equal(got[i], expected, `notif_in_quiet_hours(${at}, ${start}, ${end}) : ${got[i]}, attendu ${expected} (heure de Dakar = UTC)`);
        });
    });

    test('finance_setting_set : ADMIN refusé (FORBIDDEN, message du contrat), clé notif.* inconnue refusée (UNKNOWN_KEY), sans effet', async () => {
        const admin = await newAdmin('reglages-forbidden', ['pricing.manage']);
        const key: NotifSettingKey = 'notif.reminder_h3_hours';
        const saved = await getNotifSetting(key);
        const count0 = (await historyOf(key)).length;
        const denied = await rpcSet(key, 6, admin.userId, 'tentative ADMIN');
        assert.equal(denied.ok, false, `ADMIN accepté : ${JSON.stringify(denied)}`);
        assert.equal(denied.code, 'FORBIDDEN', `ADMIN : code ${denied.code}`);
        assert.equal(denied.message, FORBIDDEN_MESSAGE, 'message FORBIDDEN générique du contrat I1.3');
        assert.deepEqual(await getNotifSetting(key), saved, 'valeur inchangée');
        assert.equal((await historyOf(key)).length, count0, 'aucun historique');

        const unknown = 'notif.cle_inconnue_lot6';
        const r = await rpcSet(unknown, 1, await superadminId(), 'clé inconnue');
        try {
            assert.equal(r.ok, false, `clé inconnue acceptée : ${JSON.stringify(r)}`);
            assert.equal(r.code, 'UNKNOWN_KEY', `clé inconnue : code ${r.code}`);
            assert.equal(await keyExists(unknown), false, 'aucune clé créée');
        } finally {
            if (await keyExists(unknown)) await dropKeys([unknown]);
        }
    });

    test('historique : ancienne et nouvelle valeur, auteur et motif de chaque modification', async () => {
        const key: NotifSettingKey = 'notif.reminder_j1_hour';
        const saved = await getNotifSetting(key);
        const actor = await superadminId();
        const next = saved === 11 ? 12 : 11;
        try {
            const r = await rpcSet(key, next, actor, 'test de l’historique, lot 6');
            assert.equal(r.ok, true, `modification refusée : ${JSON.stringify(r)}`);
            const [last] = await historyOf(key);
            assert.ok(last, 'ligne d’historique attendue');
            assert.deepEqual(inner(last.old_value), saved, 'ancienne valeur');
            assert.deepEqual(inner(last.new_value), next, 'nouvelle valeur');
            assert.equal(last.changed_by, actor, 'auteur');
            assert.equal(last.reason, 'test de l’historique, lot 6', 'motif');
        } finally {
            if ((await getNotifSetting(key)) !== saved) await setNotifSetting(key, saved, 'restauration après le test de l’historique');
        }
        const [restored] = await historyOf(key);
        assert.deepEqual(inner(restored.new_value), saved, 'la restauration est historisée elle aussi');
    });
});

describe('6.5 Route /api/admin/finance-settings et refus de /api/admin/pricing (contrat I1.6)', () => {
    test('GET : l’ADMIN et le SUPERADMIN lisent les 10 clés notif.* et leur historique', async () => {
        // Lot 7 (T4) : marqueur posé sur notif.sms_optional_daily_cap (notif.sms_daily_alert est supprimée).
        const key: NotifSettingKey = 'notif.sms_optional_daily_cap';
        const saved = await getNotifSetting(key);
        const marker = saved === 650 ? 651 : 650;
        try {
            await setNotifSetting(key, marker, 'marqueur d’historique pour la route, lot 6');
            for (const who of ['ADMIN', 'SUPERADMIN'] as const) {
                const s = await signInAs(who);
                const res = await GET(jsonRequest(ROUTE, 'GET', s.accessToken));
                const body = await res.json();
                assert.equal(res.status, 200, `${who} : HTTP ${res.status} ${JSON.stringify(body).slice(0, 300)}`);
                const settings = (body.settings ?? []) as Array<{ key: string; value: unknown }>;
                for (const k of KEYS) {
                    const row = settings.find((x) => x.key === k);
                    assert.ok(row, `${who} : ${k} absent de la réponse (clés reçues : ${settings.map((x) => x.key).filter((x) => x.startsWith('notif.')).join(', ') || 'aucune clé notif.*'})`);
                    assert.deepEqual(row.value, await getNotifSetting(k), `${who} : valeur de ${k}`);
                }
                const history = (body.history ?? []) as Array<{ key: string; new_value: unknown }>;
                assert.ok(history.some((h) => h.key === key && inner(h.new_value) === marker), `${who} : la modification de ${key} figure dans l’historique de la réponse`);
            }
        } finally {
            if ((await getNotifSetting(key)) !== saved) await setNotifSetting(key, saved, 'restauration après le test de la route');
        }
    });

    test('PUT : 403 pour l’ADMIN (sans effet) ; 200 pour le SUPERADMIN, pour un entier, un booléen et un choix, valeur appliquée et historisée', async () => {
        const saved = await snapshot();
        try {
            const key0: NotifSettingKey = 'notif.reminder_j1_hour';
            const count0 = (await historyOf(key0)).length;
            const admin = await signInAs('ADMIN');
            const denied = await PUT(jsonRequest(ROUTE, 'PUT', admin.accessToken, { key: key0, value: 12, reason: 'tentative ADMIN' }));
            assert.equal(denied.status, 403, `ADMIN : HTTP ${denied.status}`);
            assert.deepEqual(await getNotifSetting(key0), saved.get(key0), 'valeur inchangée après le refus');
            assert.equal((await historyOf(key0)).length, count0, 'aucun historique pour un refus');

            const superadmin = await signInAs('SUPERADMIN');
            const changes: Array<[NotifSettingKey, unknown]> = [
                ['notif.reminder_j1_hour', saved.get('notif.reminder_j1_hour') === 12 ? 13 : 12],
                ['notif.reminder_h3_enabled', !(saved.get('notif.reminder_h3_enabled') as boolean)],
                ['notif.h3_sms', saved.get('notif.h3_sms') === 'ALWAYS' ? 'NEVER' : 'ALWAYS'],
                ['notif.sms_quiet_start', saved.get('notif.sms_quiet_start') === 21 ? 20 : 21],
                // Lot 7 (T4) : un entier et un choix des clés du lot 7.
                ['notif.sms_optional_daily_cap', saved.get('notif.sms_optional_daily_cap') === 690 ? 691 : 690],
                ['notif.free_ticket_reminder_sms', saved.get('notif.free_ticket_reminder_sms') === 'SAME_AS_PAID' ? 'NEVER' : 'SAME_AS_PAID'],
            ];
            for (const [key, value] of changes) {
                const reason = `test de la route, lot 6 (${key})`;
                const res = await PUT(jsonRequest(ROUTE, 'PUT', superadmin.accessToken, { key, value, reason }));
                const body = await res.json();
                assert.equal(res.status, 200, `${key} = ${JSON.stringify(value)} : HTTP ${res.status} ${JSON.stringify(body)}`);
                assert.deepEqual(await getNotifSetting(key), value, `${key} appliqué`);
                const [last] = await historyOf(key);
                assert.equal(last?.changed_by, superadmin.userId, `${key} : auteur historisé`);
                assert.equal(last?.reason, reason, `${key} : motif historisé`);
            }
        } finally {
            await restore(saved);
        }
    });

    test('PUT SUPERADMIN : valeur hors bornes (400 INVALID_VALUE) et clé notif.* inconnue (400) refusées, sans effet', async () => {
        const superadmin = await signInAs('SUPERADMIN');
        const saved = await snapshot();
        const bad: Array<[string, unknown]> = [
            ['notif.reminder_h3_hours', 13], ['notif.reminder_j1_hour', 21], ['notif.j1_sms', 'PARFOIS'],
            ['notif.sms_quiet_end', 24], ['notif.reminder_j1_enabled', 'oui'],
            ['notif.sms_optional_daily_cap', -1], ['notif.free_ticket_reminder_sms', 'ALWAYS'],
        ];
        for (const [key, value] of bad) {
            const res = await PUT(jsonRequest(ROUTE, 'PUT', superadmin.accessToken, { key, value, reason: 'valeur refusée attendue' }));
            const body = await res.json();
            assert.equal(res.status, 400, `${key} = ${JSON.stringify(value)} : HTTP ${res.status} ${JSON.stringify(body)}`);
            assert.equal(body.code, 'INVALID_VALUE', `${key} = ${JSON.stringify(value)} : refusé par la validation en base (code ${body.code}), pas par le format de la clé`);
        }
        const unknown = 'notif.cle_inconnue_route_lot6';
        try {
            const res = await PUT(jsonRequest(ROUTE, 'PUT', superadmin.accessToken, { key: unknown, value: 1, reason: 'clé inconnue' }));
            const body = await res.json();
            assert.equal(res.status, 400, `clé inconnue : HTTP ${res.status} ${JSON.stringify(body)}`);
            assert.equal(body.code, 'UNKNOWN_KEY', `clé inconnue : code ${body.code}`);
            assert.equal(await keyExists(unknown), false, 'aucune clé créée');
            for (const k of KEYS) assert.deepEqual(await getNotifSetting(k), saved.get(k), `${k} inchangé`);
        } finally {
            if (await keyExists(unknown)) await dropKeys([unknown]);
            await restore(saved);
        }
    });

    test('POST /api/admin/pricing : un ADMIN qui a pricing.manage n’écrit ni ne crée de clé notif.* (403 NOTIF_SETTING, sans effet)', async () => {
        const { POST: pricing } = (await importModule('../../app/api/admin/pricing/route')) as { POST: Handler };
        const admin = await newAdmin('reglages-pricing', ['pricing.manage']);
        const witnessKey = `test.lot6_reglages_${admin.userId.slice(0, 8)}`;
        const created = 'notif.cle_creee_par_pricing_lot6';
        const key: NotifSettingKey = 'notif.reminder_h3_hours';
        const existed = await keyExists(key);
        const saved = existed ? await getNotifSetting(key) : undefined;
        const count0 = (await historyOf(key)).length;
        try {
            // Témoin : la permission pricing.manage est bien effective pour ce compte.
            const control = await pricing(jsonRequest('/api/admin/pricing', 'POST', admin.accessToken, { key: witnessKey, value: { value: 1 } }));
            assert.equal(control.status, 200, `témoin (clé ordinaire par un ADMIN pricing.manage) : HTTP ${control.status} ${JSON.stringify(await control.json())}`);

            const denied = await pricing(jsonRequest('/api/admin/pricing', 'POST', admin.accessToken, { key, value: { value: 12 } }));
            const body = await denied.json();
            assert.equal(denied.status, 403, `${key} par /api/admin/pricing : HTTP ${denied.status} ${JSON.stringify(body)}`);
            assert.equal(body.code, 'NOTIF_SETTING', `code du refus : ${JSON.stringify(body)}`);
            assert.equal(body.error, PRICING_REFUSAL, 'message du refus (contrat I1.6)');
            assert.equal(await keyExists(key), existed, `${key} : ni créée ni supprimée par la route`);
            if (existed) assert.deepEqual(await getNotifSetting(key), saved, 'valeur inchangée');
            assert.equal((await historyOf(key)).length, count0, 'aucun historique');

            const create = await pricing(jsonRequest('/api/admin/pricing', 'POST', admin.accessToken, { key: created, value: { value: 1 } }));
            assert.equal(create.status, 403, `création de ${created} par /api/admin/pricing : HTTP ${create.status}`);
            assert.equal(await keyExists(created), false, 'aucune clé notif.* créée');
        } finally {
            const leftovers = [witnessKey, created];
            if (!existed && (await keyExists(key))) leftovers.push(key);
            await dropKeys(leftovers);
            if (existed && JSON.stringify(await getNotifSetting(key)) !== JSON.stringify(saved)) {
                await setNotifSetting(key, saved, 'restauration après le test de /api/admin/pricing');
            }
        }
    });

    test('page /admin/finance-settings : 10 libellés exacts, choix en français, section « Notifications », section « Fonctionnalités » (contrôle statique)', () => {
        const page = readFileSync(path.join(process.cwd(), 'app/admin/finance-settings/page.tsx'), 'utf8');
        const apostrophe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/'/g, "(?:'|’|\\\\')");
        const labels: Record<NotifSettingKey, { label: string; kind: string; unit?: string }> = {
            'notif.reminder_j1_enabled': { label: 'Rappel la veille', kind: 'boolean' },
            'notif.reminder_j1_hour': { label: 'Heure du rappel de la veille', kind: 'integer', unit: 'h' },
            'notif.reminder_h3_enabled': { label: 'Rappel avant le début', kind: 'boolean' },
            'notif.reminder_h3_hours': { label: 'Heures avant le début', kind: 'integer', unit: 'h' },
            'notif.j1_sms': { label: 'SMS du rappel de la veille', kind: 'choice' },
            'notif.h3_sms': { label: 'SMS du rappel avant le début', kind: 'choice' },
            'notif.sms_quiet_start': { label: 'Début de la plage sans SMS', kind: 'integer', unit: 'h' },
            'notif.sms_quiet_end': { label: 'Fin de la plage sans SMS', kind: 'integer', unit: 'h' },
            // Lot 7 (T4) : libellés des deux clés du lot 7 (contrat 4.6 : SETTING_META des 5 clés ; rédaction retenue ici).
            'notif.sms_optional_daily_cap': { label: 'Plafond quotidien des SMS optionnels', kind: 'integer' },
            'notif.free_ticket_reminder_sms': { label: 'SMS des rappels pour les billets gratuits', kind: 'choice' },
        };
        for (const key of KEYS) {
            const quoted = key.replace(/\./g, '\\.');
            const entry = page.match(new RegExp(`['"]${quoted}['"]\\s*:\\s*\\{([^}]*)\\}`));
            assert.ok(entry, `${key} : aucune entrée META dans la page des réglages`);
            const spec = labels[key];
            assert.match(entry[1], new RegExp(`label:\\s*['"\`]${apostrophe(spec.label)}['"\`]`), `${key} : libellé « ${spec.label} » attendu (contrat I1.6), entrée : ${entry[1].trim().slice(0, 160)}`);
            assert.match(entry[1], new RegExp(`kind:\\s*['"]${spec.kind}['"]`), `${key} : type d’affichage ${spec.kind}`);
            if (spec.unit) assert.match(entry[1], new RegExp(`unit:\\s*['"]${spec.unit}['"]`), `${key} : unité « ${spec.unit} »`);
        }
        assert.match(page, /\bALWAYS['"]?\s*:\s*['"]Toujours['"]/, 'choix ALWAYS : « Toujours »');
        assert.match(page, /\bIF_NO_PUSH['"]?\s*:\s*['"]Seulement sans notification push['"]/, 'choix IF_NO_PUSH : « Seulement sans notification push »');
        assert.match(page, /\bNEVER['"]?\s*:\s*['"]Jamais['"]/, 'choix NEVER : « Jamais »');
        // Lot 7 (T4) : choix de notif.free_ticket_reminder_sms, clé supprimée absente, section des interrupteurs.
        assert.match(page, /\bSAME_AS_PAID['"]?\s*:\s*['"]Comme un billet payant['"]/, 'choix SAME_AS_PAID : « Comme un billet payant »');
        assert.doesNotMatch(page, /notif\.sms_daily_alert/, 'plus aucune entrée notif.sms_daily_alert (supprimée, D15)');
        for (const key of ['features.halls_enabled', 'features.tables_enabled', 'features.orders_enabled']) {
            const entry = page.match(new RegExp(`['"]${key.replace(/\./g, '\\.')}['"]\\s*:\\s*\\{([^}]*)\\}`));
            assert.ok(entry, `${key} : aucune entrée META dans la page des réglages (contrat, section 4.6)`);
            assert.match(entry[1], /kind:\s*['"]boolean['"]/, `${key} : interrupteur affiché en booléen`);
            assert.match(entry[1], /label:\s*['"`][^'"`]{3,}['"`]/, `${key} : libellé`);
        }
        assert.match(page, /prefix:\s*['"]features\.['"]\s*,\s*title:\s*['"]Fonctionnalités['"]/, 'section « Fonctionnalités » (préfixe features.)');
        assert.match(page, /prefix:\s*['"]notif\.['"]\s*,\s*title:\s*['"]Notifications['"][^}]*icon:\s*Bell\b/, 'section « Notifications » (préfixe notif., icône Bell)');
        assert.match(page, /import\s*\{[^}]*\bBell\b[^}]*\}\s*from\s*['"]lucide-react['"]/, 'icône Bell importée de lucide-react');
    });
});
