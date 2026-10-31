/**
 * Lot 3.1 (contrat A) — réglages financiers : historisés, jamais rétroactifs, modifiables par le
 * seul SUPERADMIN.
 *  - finance_setting_set : SUPERADMIN accepté ; ADMIN, CLIENT ou acteur absent refusés (FORBIDDEN) ;
 *    valeurs invalides (INVALID_VALUE) et clés inconnues (UNKNOWN_KEY) refusées, sans effet ni
 *    historique ;
 *  - platform_settings_history : une ligne par modification (ancienne et nouvelle valeur, auteur,
 *    motif) ;
 *  - les 10 clés finance.* existent avec leur valeur par défaut ; fin_setting lève une exception si
 *    la clé manque (jamais de repli) ;
 *  - non-rétroactivité : un paiement créé à 5 % puis confirmé après un passage du taux à 10 % garde
 *    ses montants, son taux recopié et les frais de ses billets ;
 *  - GET / PUT /api/admin/finance-settings : lecture ADMIN et SUPERADMIN, écriture SUPERADMIN seul.
 * Rouge avant correctif : aucune clé finance.* (0012_platform_financial_settings.sql ne pose que
 * ticketing_fee_config), ni RPC, ni historique, ni route ; aucun taux recopié sur le paiement
 * (data-model-13) ; écriture des taux par tout ADMIN (0007_superadmin_complete.sql:112-113 et
 * app/api/admin/pricing/route.ts:39).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { NextRequest } from 'next/server';
import { assertFinanceInvariants } from '../helpers/finance-invariants';
import { loadFixtures, signInAs } from '../helpers/fixtures';
import { getSetting, jsonRequest, setSetting, superadminId, withSettings, type FinanceSettingKey } from './finance-helpers';
import {
    cart, checkout, createSaleEvent, deliverWebhook, importModule, newBuyer, paymentById, providerSays, service,
    type SaleEvent,
} from './paiement-helpers';

type Handler = (req: NextRequest) => Promise<Response>;

/** Valeurs par défaut du contrat A. */
const DEFAULTS: Record<FinanceSettingKey, unknown> = {
    'finance.service_fee_rate': 5,
    'finance.aggregator_fee_rate.WAVE': 1.5,
    'finance.aggregator_fee_rate.ORANGE_MONEY': 1.5,
    'finance.cancellation_aggregator_fee_bearer': 'EVENT_VILLAGE',
    'finance.payout_hold_enabled': true,
    'finance.payout_delay_hours': 48,
    'finance.withdrawal_fee_rate': 1,
    'finance.withdrawal_min_amount': 5000,
    'finance.withdrawal_bank_enabled': false,
    'finance.referral_availability_days': 7,
};
const KEYS = Object.keys(DEFAULTS) as FinanceSettingKey[];

let ev: SaleEvent;

before(async () => {
    ev = await createSaleEvent('reglages', [{ name: 'Standard', price: 1000, total: 20 }]);
});

after(async () => {
    await assertFinanceInvariants('finance-reglages');
});

interface SetResult { ok?: boolean; code?: string; key?: string }

/** Appel brut de la RPC d'écriture (sans assertion sur le résultat). */
async function setAs(key: string, value: unknown, actor: string | null, reason = 'test du lot 3 (refus attendu)'): Promise<SetResult> {
    const { data, error } = await service.rpc('finance_setting_set', { p_key: key, p_value: { value }, p_actor: actor, p_reason: reason });
    assert.equal(error, null, `finance_setting_set(${key}) : ${error?.message}`);
    return (data ?? {}) as SetResult;
}

async function historyOf(key: string): Promise<Array<Record<string, unknown>>> {
    const { data, error } = await service.from('platform_settings_history').select('*').eq('key', key).order('id', { ascending: false });
    assert.equal(error, null, `historique de ${key} : ${error?.message}`);
    return (data ?? []) as Array<Record<string, unknown>>;
}

function inner(v: unknown): unknown {
    return (v as { value?: unknown } | null)?.value;
}

describe('Réglages financiers (contrat A)', () => {
    test('les 10 clés finance.* existent avec leur valeur par défaut', async () => {
        for (const key of KEYS) {
            assert.deepEqual(await getSetting(key), DEFAULTS[key], `valeur par défaut de ${key}`);
        }
    });

    test('fin_setting : lecture sans repli, exception si la clé manque', async () => {
        const { error: okErr } = await service.rpc('fin_setting', { p_key: 'finance.service_fee_rate' });
        assert.equal(okErr, null, `lecture de finance.service_fee_rate : ${okErr?.message}`);
        const { error } = await service.rpc('fin_setting', { p_key: 'finance.cle_absente_lot3' });
        assert.ok(error, 'une clé absente doit lever une exception (aucune valeur de repli)');
    });

    test('finance_setting_set : le SUPERADMIN modifie une clé, la valeur est appliquée', async () => {
        const key: FinanceSettingKey = 'finance.payout_delay_hours';
        const saved = await getSetting(key);
        const r = await setAs(key, 72, await superadminId(), 'test du lot 3 : SUPERADMIN');
        try {
            assert.equal(r.ok, true, `écriture SUPERADMIN refusée : ${JSON.stringify(r)}`);
            assert.equal(r.key, key);
            assert.equal(await getSetting(key), 72, 'valeur appliquée');
        } finally {
            await setSetting(key, saved, 'restauration après un test du lot 3');
        }
    });

    test('ADMIN, CLIENT ou acteur absent : FORBIDDEN, valeur et historique inchangés', async () => {
        const fx = await loadFixtures();
        const key: FinanceSettingKey = 'finance.service_fee_rate';
        const before0 = await getSetting(key);
        const history0 = (await historyOf(key)).length;
        for (const [label, actor] of [['ADMIN', fx.users.ADMIN.id], ['CLIENT', fx.users.CLIENT.id], ['acteur absent', null]] as const) {
            const r = await setAs(key, 12, actor);
            assert.equal(r.ok, false, `${label} : écriture acceptée`);
            assert.equal(r.code, 'FORBIDDEN', `${label} : code ${r.code}`);
        }
        assert.deepEqual(await getSetting(key), before0, 'valeur inchangée');
        assert.equal((await historyOf(key)).length, history0, 'aucune ligne d’historique pour un refus');
    });

    test('valeurs invalides : INVALID_VALUE, valeur et historique inchangés', async () => {
        const actor = await superadminId();
        const cases: Array<[FinanceSettingKey, unknown]> = [
            ['finance.service_fee_rate', -1],
            ['finance.service_fee_rate', 51],
            ['finance.service_fee_rate', 'cinq'],
            ['finance.aggregator_fee_rate.WAVE', -0.5],
            ['finance.aggregator_fee_rate.ORANGE_MONEY', 11],
            ['finance.referral_availability_days', 6],
            ['finance.referral_availability_days', 15],
            ['finance.referral_availability_days', 7.5],
            ['finance.payout_delay_hours', 1.5],
            ['finance.payout_delay_hours', 721],
            ['finance.withdrawal_fee_rate', 11],
            ['finance.withdrawal_min_amount', -1],
            ['finance.cancellation_aggregator_fee_bearer', 'CLIENT'],
            ['finance.payout_hold_enabled', 'oui'],
            ['finance.withdrawal_bank_enabled', 1],
        ];
        for (const [key, value] of cases) {
            const before0 = await getSetting(key);
            const history0 = (await historyOf(key)).length;
            const r = await setAs(key, value, actor);
            assert.equal(r.ok, false, `${key} = ${JSON.stringify(value)} : valeur acceptée`);
            assert.equal(r.code, 'INVALID_VALUE', `${key} = ${JSON.stringify(value)} : code ${r.code}`);
            assert.deepEqual(await getSetting(key), before0, `${key} inchangé`);
            assert.equal((await historyOf(key)).length, history0, `${key} : aucune ligne d’historique`);
        }
    });

    test('opérateur ou clé inconnus : UNKNOWN_KEY (aucun taux de repli)', async () => {
        const actor = await superadminId();
        for (const key of ['finance.aggregator_fee_rate.FREE_MONEY', 'finance.aggregator_fee_rate.CARTE_BANCAIRE', 'finance.taux_libre', 'ticketing_fee_config']) {
            const r = await setAs(key, 1.5, actor);
            assert.equal(r.ok, false, `${key} accepté`);
            assert.equal(r.code, 'UNKNOWN_KEY', `${key} : code ${r.code}`);
        }
        const { data } = await service.from('platform_settings').select('key').in('key', ['finance.aggregator_fee_rate.FREE_MONEY', 'finance.aggregator_fee_rate.CARTE_BANCAIRE', 'finance.taux_libre']);
        assert.deepEqual(data ?? [], [], 'aucune clé inconnue créée');
    });

    test('chaque modification écrit une ligne d’historique (ancienne, nouvelle valeur, auteur, motif)', async () => {
        const key: FinanceSettingKey = 'finance.payout_delay_hours';
        const saved = await getSetting(key);
        const count0 = (await historyOf(key)).length;
        const actor = await superadminId();
        await withSettings({ 'finance.payout_delay_hours': 72 }, async () => {
            const rows = await historyOf(key);
            assert.equal(rows.length, count0 + 1, 'une ligne d’historique par modification');
            assert.deepEqual(inner(rows[0].old_value), saved, 'ancienne valeur');
            assert.deepEqual(inner(rows[0].new_value), 72, 'nouvelle valeur');
            assert.equal(rows[0].changed_by, actor, 'auteur');
            assert.equal(rows[0].reason, 'test du lot 3', 'motif');
            assert.ok(rows[0].changed_at, 'horodatage');
        });
        const rows = await historyOf(key);
        assert.equal(rows.length, count0 + 2, 'la restauration est historisée elle aussi');
        assert.deepEqual(inner(rows[0].new_value), saved);
        assert.equal(rows[0].reason, 'restauration après un test du lot 3');
    });

    test('non-rétroactivité : le paiement garde ses montants et son taux si le taux change avant la confirmation', async () => {
        const b = await newBuyer('nonretro');
        const r = await checkout(b, cart(ev.eventId, [[ev.categories.Standard.id, 1]], b));
        assert.equal(r.status, 200, JSON.stringify(r.body));
        const p0 = await paymentById(r.payment!.id);
        assert.equal(Number(p0.service_fee_rate), 5, `taux de service recopié sur le paiement à sa création (${p0.service_fee_rate})`);
        assert.equal(Number(p0.amount), 1050, 'total client au taux de création');
        await withSettings({ 'finance.service_fee_rate': 10 }, async () => {
            const { data: fresh, error } = await service.rpc('finance_compute', { p_target: 'TICKET', p_lines: [{ unit_price: 1000, quantity: 1 }], p_operator: 'WAVE' });
            assert.equal(error, null, `finance_compute : ${error?.message}`);
            assert.equal(Number((fresh as Record<string, unknown>).service_fee), 100, 'le nouveau taux vaut pour les nouveaux calculs');

            providerSays(r.payment!, 'SUCCESS');
            const hook = await deliverWebhook(r.payment!);
            assert.equal(hook.status, 200, 'webhook accepté');
            const p1 = await paymentById(r.payment!.id);
            assert.equal(p1.status, 'SUCCESS');
            assert.equal(Number(p1.amount), 1050, 'montant inchangé');
            assert.equal(Number(p1.facial_amount), 1000);
            assert.equal(Number(p1.service_fee), 50, 'frais de service inchangés');
            assert.equal(Number(p1.service_fee_rate), 5, 'taux recopié inchangé');
            assert.equal(Number(p1.partner_payout_amount), 1000);
            assert.equal(Number(p1.net_event_village_revenue), 34.25);
            const { data: tickets, error: tErr } = await service.from('tickets').select('price, service_fee').eq('payment_id', p1.id);
            assert.equal(tErr, null, `billets : ${tErr?.message}`);
            assert.equal(tickets?.length, 1);
            assert.equal(Number(tickets![0].service_fee), 50, 'frais du billet au taux de création');
        });
    });
});

describe('Route /api/admin/finance-settings', () => {
    let GET: Handler;
    let PUT: Handler;

    before(async () => {
        ({ GET, PUT } = await importModule('../../app/api/admin/finance-settings/route'));
    });

    test('GET : l’ADMIN et le SUPERADMIN lisent les valeurs et l’historique ; anonyme refusé', async () => {
        for (const who of ['ADMIN', 'SUPERADMIN'] as const) {
            const s = await signInAs(who);
            const res = await GET(jsonRequest('/api/admin/finance-settings', 'GET', s.accessToken));
            const body = await res.json();
            assert.equal(res.status, 200, `${who} : HTTP ${res.status} ${JSON.stringify(body)}`);
            const text = JSON.stringify(body);
            for (const key of KEYS) assert.ok(text.includes(key), `${who} : ${key} absent de la réponse`);
            assert.match(text, /"(history|historique)"/i, `${who} : historique absent de la réponse`);
        }
        const anon = await GET(jsonRequest('/api/admin/finance-settings', 'GET', null));
        assert.ok([401, 403].includes(anon.status), `anonyme : HTTP ${anon.status}`);
    });

    test('PUT : 403 pour l’ADMIN (valeur inchangée), 200 pour le SUPERADMIN (valeur appliquée et historisée)', async () => {
        const key: FinanceSettingKey = 'finance.payout_delay_hours';
        const saved = await getSetting(key);
        const count0 = (await historyOf(key)).length;

        const admin = await signInAs('ADMIN');
        const denied = await PUT(jsonRequest('/api/admin/finance-settings', 'PUT', admin.accessToken, { key, value: 36, reason: 'tentative ADMIN' }));
        assert.equal(denied.status, 403, `ADMIN : HTTP ${denied.status}`);
        assert.deepEqual(await getSetting(key), saved, 'valeur inchangée après le refus');
        assert.equal((await historyOf(key)).length, count0, 'aucun historique pour un refus');

        const superadmin = await signInAs('SUPERADMIN');
        const res = await PUT(jsonRequest('/api/admin/finance-settings', 'PUT', superadmin.accessToken, { key, value: 36, reason: 'test route lot 3' }));
        try {
            const body = await res.json();
            assert.equal(res.status, 200, `SUPERADMIN : HTTP ${res.status} ${JSON.stringify(body)}`);
            assert.equal(await getSetting(key), 36, 'valeur appliquée');
            const [last] = await historyOf(key);
            assert.equal(last?.changed_by, superadmin.userId, 'auteur historisé');
            assert.equal(last?.reason, 'test route lot 3', 'motif historisé');
        } finally {
            if ((await getSetting(key)) !== saved) await setSetting(key, saved, 'restauration après un test du lot 3');
        }
    });

    test('PUT : valeur invalide ou clé inconnue refusées pour le SUPERADMIN, sans effet', async () => {
        const superadmin = await signInAs('SUPERADMIN');
        const key: FinanceSettingKey = 'finance.referral_availability_days';
        const saved = await getSetting(key);
        const bad = await PUT(jsonRequest('/api/admin/finance-settings', 'PUT', superadmin.accessToken, { key, value: 15, reason: 'hors bornes' }));
        assert.ok(bad.status >= 400 && bad.status < 500, `valeur invalide : HTTP ${bad.status}`);
        assert.deepEqual(await getSetting(key), saved, 'valeur inchangée');
        const unknown = await PUT(jsonRequest('/api/admin/finance-settings', 'PUT', superadmin.accessToken, { key: 'finance.aggregator_fee_rate.FREE_MONEY', value: 1, reason: 'clé inconnue' }));
        assert.ok(unknown.status >= 400 && unknown.status < 500, `clé inconnue : HTTP ${unknown.status}`);
    });
});
