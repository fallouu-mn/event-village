/**
 * Lot 4 (contrat A) — réglages access.* modifiables par le SUPERADMIN, comme les réglages finance.*
 * du lot 3 : même RPC (finance_setting_set), même route (/api/admin/finance-settings), même page
 * (/admin/finance-settings), même historique.
 *  - les 4 clés access.* existent avec leur valeur par défaut ;
 *  - GET : l'ADMIN et le SUPERADMIN lisent les valeurs access.* et leur historique ;
 *  - PUT : 403 pour l'ADMIN (valeur inchangée, aucun historique) ; 200 pour le SUPERADMIN, valeur
 *    appliquée et historisée (auteur, motif), pour chaque type de réglage (entier, booléen, choix) ;
 *  - PUT : valeur hors bornes ou clé access.* inconnue refusées, sans effet ;
 *  - /api/admin/pricing (ADMIN avec pricing.manage, écriture en service_role sans validation) ne
 *    modifie ni ne crée de clé access.* ;
 *  - la page des réglages présente les 4 clés access.* avec un libellé.
 * Rouge avant correctif : la route n'accepte que les clés finance.* (PutSchema, startsWith('finance.'))
 * et ne lit que finance.% (GET) ; la page ne connaît aucune clé access.*. Le SUPERADMIN ne peut donc
 * changer ces réglages que par la base, alors qu'un ADMIN qui a pricing.manage les écrit sans contrôle
 * par /api/admin/pricing (seul le préfixe finance.* y est refusé, route L54-58).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { NextRequest } from 'next/server';
import { assertAccessInvariants } from '../helpers/access-invariants';
import { signInAs } from '../helpers/fixtures';
import { jsonRequest } from './finance-helpers';
import { importModule, newBuyer, service } from './paiement-helpers';
import { getAccessSetting, setAccessSetting, type AccessSettingKey } from './acces-helpers';

type Handler = (req: NextRequest) => Promise<Response>;

/** Valeurs par défaut du contrat A du lot 4. */
const DEFAULTS: Record<AccessSettingKey, unknown> = {
    'access.manual_entry_scope': 'ASSIGNED_CONTROLLER',
    'access.scan_window_before_hours': 6,
    'access.scan_window_after_hours': 6,
    'access.counter_sale_enabled': true,
};
const KEYS = Object.keys(DEFAULTS) as AccessSettingKey[];
const ROUTE = '/api/admin/finance-settings';

let GET: Handler;
let PUT: Handler;

before(async () => {
    ({ GET, PUT } = await importModule('../../app/api/admin/finance-settings/route'));
});

after(async () => {
    await assertAccessInvariants('acces-reglages');
});

async function historyOf(key: string): Promise<Array<Record<string, unknown>>> {
    const { data, error } = await service.from('platform_settings_history').select('*').eq('key', key).order('id', { ascending: false });
    assert.equal(error, null, `historique de ${key} : ${error?.message}`);
    return (data ?? []) as Array<Record<string, unknown>>;
}

/** Remet la valeur d'origine si un cas l'a changée (par la RPC, hors de la route testée). */
async function restore(key: AccessSettingKey, saved: unknown): Promise<void> {
    if (JSON.stringify(await getAccessSetting(key)) !== JSON.stringify(saved)) {
        await setAccessSetting(key, saved, 'restauration après un test du lot 4 (réglages)');
    }
}

describe('Réglages access.* (contrat A du lot 4)', () => {
    test('les 4 clés access.* existent avec leur valeur par défaut', async () => {
        for (const key of KEYS) assert.deepEqual(await getAccessSetting(key), DEFAULTS[key], `valeur par défaut de ${key}`);
    });

    test('GET : l’ADMIN et le SUPERADMIN lisent les réglages access.* et leur historique', async () => {
        for (const who of ['ADMIN', 'SUPERADMIN'] as const) {
            const s = await signInAs(who);
            const res = await GET(jsonRequest(ROUTE, 'GET', s.accessToken));
            const body = await res.json();
            assert.equal(res.status, 200, `${who} : HTTP ${res.status} ${JSON.stringify(body).slice(0, 300)}`);
            const settings = (body.settings ?? []) as Array<{ key: string; value: unknown }>;
            for (const key of KEYS) {
                const row = settings.find((x) => x.key === key);
                assert.ok(row, `${who} : ${key} absent de la réponse (clés reçues : ${settings.map((x) => x.key).join(', ')})`);
                assert.deepEqual(row.value, await getAccessSetting(key), `${who} : valeur de ${key}`);
            }
            assert.ok(Array.isArray(body.history), `${who} : historique absent de la réponse`);
        }
    });

    test('PUT : 403 pour l’ADMIN (valeur inchangée), 200 pour le SUPERADMIN (valeur appliquée et historisée)', async () => {
        const key: AccessSettingKey = 'access.scan_window_before_hours';
        const saved = await getAccessSetting(key);
        const count0 = (await historyOf(key)).length;
        try {
            const admin = await signInAs('ADMIN');
            const denied = await PUT(jsonRequest(ROUTE, 'PUT', admin.accessToken, { key, value: 9, reason: 'tentative ADMIN' }));
            assert.equal(denied.status, 403, `ADMIN : HTTP ${denied.status}`);
            assert.deepEqual(await getAccessSetting(key), saved, 'valeur inchangée après le refus');
            assert.equal((await historyOf(key)).length, count0, 'aucun historique pour un refus');

            const superadmin = await signInAs('SUPERADMIN');
            const res = await PUT(jsonRequest(ROUTE, 'PUT', superadmin.accessToken, { key, value: 9, reason: 'test route lot 4' }));
            const body = await res.json();
            assert.equal(res.status, 200, `SUPERADMIN : HTTP ${res.status} ${JSON.stringify(body)}`);
            assert.equal(await getAccessSetting(key), 9, 'valeur appliquée');
            const [last] = await historyOf(key);
            assert.equal(last?.changed_by, superadmin.userId, 'auteur historisé');
            assert.equal(last?.reason, 'test route lot 4', 'motif historisé');
        } finally {
            await restore(key, saved);
        }
    });

    test('PUT SUPERADMIN : chaque type de réglage (choix, entier, booléen) est appliqué', async () => {
        const superadmin = await signInAs('SUPERADMIN');
        const changes: Array<[AccessSettingKey, unknown]> = [
            ['access.manual_entry_scope', 'STAFF'],
            ['access.scan_window_after_hours', 0],
            ['access.counter_sale_enabled', false],
        ];
        const saved = new Map<AccessSettingKey, unknown>();
        for (const [key] of changes) saved.set(key, await getAccessSetting(key));
        try {
            for (const [key, value] of changes) {
                const res = await PUT(jsonRequest(ROUTE, 'PUT', superadmin.accessToken, { key, value, reason: 'test des types, lot 4' }));
                const body = await res.json();
                assert.equal(res.status, 200, `${key} = ${JSON.stringify(value)} : HTTP ${res.status} ${JSON.stringify(body)}`);
                assert.deepEqual(await getAccessSetting(key), value, `${key} appliqué`);
            }
        } finally {
            for (const [key] of changes) await restore(key, saved.get(key));
        }
    });

    test('PUT SUPERADMIN : valeur hors bornes ou clé inconnue refusées, sans effet', async () => {
        const superadmin = await signInAs('SUPERADMIN');
        const bad: Array<[string, unknown]> = [
            ['access.scan_window_after_hours', 49],
            ['access.scan_window_before_hours', -1],
            ['access.scan_window_before_hours', 2.5],
            ['access.manual_entry_scope', 'TOUT_LE_MONDE'],
            ['access.counter_sale_enabled', 'oui'],
            ['access.cle_inconnue_lot4', 1],
        ];
        const initial = new Map<AccessSettingKey, unknown>();
        for (const key of KEYS) initial.set(key, await getAccessSetting(key));
        for (const [key, value] of bad) {
            const res = await PUT(jsonRequest(ROUTE, 'PUT', superadmin.accessToken, { key, value, reason: 'valeur refusée attendue' }));
            assert.ok(res.status >= 400 && res.status < 500, `${key} = ${JSON.stringify(value)} : HTTP ${res.status}`);
        }
        for (const key of KEYS) assert.deepEqual(await getAccessSetting(key), initial.get(key), `${key} inchangé`);
        const { data, error } = await service.from('platform_settings').select('key').eq('key', 'access.cle_inconnue_lot4');
        assert.equal(error, null, error?.message);
        assert.deepEqual(data, [], 'aucune clé créée');
    });

    test('POST /api/admin/pricing : un ADMIN qui a pricing.manage n’écrit ni ne crée de clé access.* (403, sans effet)', async () => {
        const { POST: pricing } = (await importModule('../../app/api/admin/pricing/route')) as { POST: Handler };
        const admin = await newBuyer('reglages-admin', { firstName: 'Ndeye', lastName: 'Tarificatrice' });
        const { error: roleErr } = await service.from('user_roles').upsert([{ user_id: admin.userId, role: 'ADMIN' }], { onConflict: 'user_id,role' });
        assert.equal(roleErr, null, `rôle ADMIN : ${roleErr?.message}`);
        const { error: permErr } = await service.from('admin_permissions').upsert(
            { user_id: admin.userId, permission: 'pricing.manage' }, { onConflict: 'user_id,permission' });
        assert.equal(permErr, null, `permission pricing.manage : ${permErr?.message}`);

        const witnessKey = `test.lot4_reglages_${admin.userId.slice(0, 8)}`;
        const created = 'access.cle_creee_par_pricing_lot4';
        const key: AccessSettingKey = 'access.scan_window_before_hours';
        const saved = await getAccessSetting(key);
        const count0 = (await historyOf(key)).length;
        try {
            // Témoin : la permission pricing.manage est bien effective pour ce compte.
            const control = await pricing(jsonRequest('/api/admin/pricing', 'POST', admin.accessToken, { key: witnessKey, value: { value: 1 } }));
            assert.equal(control.status, 200, `témoin (clé ordinaire par un ADMIN pricing.manage) : HTTP ${control.status} ${JSON.stringify(await control.json())}`);

            const denied = await pricing(jsonRequest('/api/admin/pricing', 'POST', admin.accessToken, { key, value: { value: 48 } }));
            assert.equal(denied.status, 403, `${key} par /api/admin/pricing : HTTP ${denied.status} ${JSON.stringify(await denied.json())}`);
            assert.deepEqual(await getAccessSetting(key), saved, 'valeur inchangée');
            assert.equal((await historyOf(key)).length, count0, 'aucun historique');

            const create = await pricing(jsonRequest('/api/admin/pricing', 'POST', admin.accessToken, { key: created, value: { value: 1 } }));
            assert.equal(create.status, 403, `création de ${created} par /api/admin/pricing : HTTP ${create.status}`);
            const { data, error } = await service.from('platform_settings').select('key').eq('key', created);
            assert.equal(error, null, error?.message);
            assert.deepEqual(data, [], 'aucune clé access.* créée');
        } finally {
            await restore(key, saved);
            const { error: cleanErr } = await service.from('platform_settings').delete().in('key', [witnessKey, created]);
            assert.equal(cleanErr, null, `nettoyage des clés du test : ${cleanErr?.message}`);
        }
    });

    test('page /admin/finance-settings : les 4 clés access.* ont un libellé (contrôle statique)', () => {
        const page = readFileSync(path.join(process.cwd(), 'app/admin/finance-settings/page.tsx'), 'utf8');
        for (const key of KEYS) {
            const quoted = key.replace(/\./g, '\\.');
            assert.match(page, new RegExp(`'${quoted}'\\s*:\\s*\\{\\s*label:`), `${key} : aucun libellé dans la page des réglages`);
        }
        assert.match(page, /ASSIGNED_CONTROLLER/, 'choix du périmètre de la saisie manuelle absent');
        assert.match(page, /\bSTAFF\b/, 'choix du périmètre de la saisie manuelle absent');
    });
});
