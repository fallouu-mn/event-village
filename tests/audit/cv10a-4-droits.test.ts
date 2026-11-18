/**
 * Contre-vérification du lot 10a — point 4 : droits et données. Lecture des réservations (noms, numéros) par un autre
 * client, une autre salle, un visiteur, un administrateur sans code, par la REST et par les routes ; REST et RPC
 * directes sur toutes les fonctions hall_* ; validation d'une salle sans le droit ; prix modifié après une réservation.
 * Un test rouge est un TROU (docs/audit-lot10a.md).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { assertLot10aInvariants } from '../helpers/lot10a-invariants';
import { newAdmin, type TestAdmin } from '../parcours/notif-helpers';
import {
    api, clientCancel, confirmByWebhook, dayFromNow, decideHall, n, newBuyer, newHall, newPartner, openHallsService, payConfirmed, platformSetting,
    refundsOf, reservation, reserveRpc, restAs, routeId, service, setPlatformSetting, show, sql, started, trace,
    type Buyer, type Row, type TestPartner,
} from './cv10a-helpers';

const NOTE = 'Mariage de Awa Diop, appelez-moi au 77 123 45 67';

let restore: () => Promise<void>;
let owner: TestPartner;
let otherPartner: TestPartner;
let alice: Buyer;
let bob: Buyer;
let adminNoCode: Buyer;
let admin: TestAdmin;
let hall: string;
let pendingHall: string;
let resId: string;
let payId: string;

before(async () => {
    restore = await openHallsService();
    owner = await newPartner('cv10a-droits');
    otherPartner = await newPartner('cv10a-droits-autre');
    alice = await newBuyer('cv10a-alice', { firstName: 'Awa', lastName: 'Diop' });
    bob = await newBuyer('cv10a-bob');
    admin = await newAdmin('cv10a-admin', ['events.read', 'refunds.manage', 'partners.validate']);
    adminNoCode = await newBuyer('cv10a-admin-sans-code');
    const { error } = await service.from('user_roles').upsert([{ user_id: adminNoCode.userId, role: 'ADMIN' }], { onConflict: 'user_id,role' });
    assert.equal(error, null, error?.message);
    for (const permission of ['events.read', 'refunds.manage', 'partners.validate']) {
        await service.from('admin_permissions').upsert({ user_id: adminNoCode.userId, permission }, { onConflict: 'user_id,permission' });
    }
    // Les sessions de test passent le code administrateur par défaut (stepUpTestSession) : retiré pour ce compte, en base
    // (admin_session_codes, lu par is_admin()) comme pour les routes (appareil vérifié par SMS, activité de la session).
    // Run 379 : seul admin_session_codes retiré, les routes acceptaient encore la session (défaut de montage corrigé).
    for (const table of ['admin_session_codes', 'admin_devices', 'admin_session_activity']) {
        const { error: delErr } = await service.from(table).delete().eq('user_id', adminNoCode.userId);
        assert.equal(delErr, null, `${table} : ${delErr?.message}`);
    }
    hall = await newHall(owner);
    pendingHall = await newHall(owner, { validate: false });
    const { data, error: rErr } = await service.rpc('hall_reserve', {
        p: { client_id: alice.userId, hall_id: hall, mode: 'JOUR', start_date: dayFromNow(100), units: 1, notes: NOTE },
    });
    assert.equal(rErr, null, rErr?.message);
    resId = String((data as Row).reservation_id);
    payId = (await payConfirmed(alice, resId, 'INTEGRAL')).id;
});

after(async () => {
    await restore();
    await assertLot10aInvariants('cv10a-4-droits');
});

describe('4.1 REST : réservations, paiements, comptes', () => {
    const who = (): Array<[string, string | null]> => [
        ['un autre client', bob.accessToken], ['une autre salle', otherPartner.accessToken], ['un visiteur', null], ['un administrateur sans code', adminNoCode.accessToken],
    ];
    test('réservation, paiement (numéro payeur), remboursements, compte du client : rien de lisible', async () => {
        const seen: Row = {};
        for (const [label, token] of who()) {
            const rest = restAs(token);
            const r1 = await rest.from('hall_reservations').select('id, notes, client_id').eq('id', resId);
            const r2 = await rest.from('payments').select('id, payer_phone').eq('hall_reservation_id', resId);
            const r3 = await rest.from('users').select('id, first_name, last_name, phone').eq('id', alice.userId);
            const r4 = await rest.from('halls').select('id, hall_reservations(id, notes, client_id)').eq('id', hall);
            const r5 = await rest.from('cashouts').select('id, phone_number').eq('payment_id', payId);
            const embedded = (r4.data ?? []).flatMap((h) => ((h as Row).hall_reservations as Row[] | undefined) ?? []);
            seen[label] = { resa: r1.data?.length ?? r1.error?.code, paiement: r2.data?.length ?? r2.error?.code, compte: r3.data?.length ?? r3.error?.code, imbrique: embedded.length, versements: r5.data?.length ?? r5.error?.code };
            assert.equal((r1.data ?? []).length, 0, `${label} lit la réservation`);
            assert.equal((r2.data ?? []).length, 0, `${label} lit le paiement`);
            assert.equal((r3.data ?? []).length, 0, `${label} lit le compte du client`);
            assert.equal(embedded.length, 0, `${label} lit la réservation par la salle`);
            assert.equal((r5.data ?? []).length, 0, `${label} lit les versements`);
        }
        trace('4.1a', seen);
    });

    test('la salle propriétaire ne lit pas le compte (nom, numéro) de son client par la REST', async () => {
        const r = await restAs(owner.accessToken).from('users').select('id, first_name, phone').eq('id', alice.userId);
        const p = await restAs(owner.accessToken).from('payments').select('payer_phone').eq('id', payId);
        trace('4.1b', { compte: r.data, numeroPayeurVuParLaSalle: p.data });
        assert.equal((r.data ?? []).length, 0);
    });
});

describe('4.2 Routes : réservations d’une salle lues par n’importe qui', () => {
    for (const [label, tok] of [['un autre client', () => bob.accessToken], ['une autre salle', () => otherPartner.accessToken]] as const) {
        test(`GET /api/partner/halls/[id] par ${label} : ni réservations, ni identité, ni note du client`, async () => {
            const r = await routeId('GET', 'partner/halls/[id]', hall, tok());
            const text = JSON.stringify(r.body);
            trace(`4.2 ${label}`, `HTTP ${r.status} ${text.slice(0, 700)}`);
            assert.ok(!text.includes(resId), `réservation ${resId} révélée`);
            assert.ok(!text.includes(alice.userId), 'identifiant du client révélé');
            assert.ok(!text.includes('77 123 45 67'), 'note du client (numéro) révélée');
        });
    }

    test('GET /api/partner/halls/[id] d’une salle non validée par un autre client : introuvable', async () => {
        const r = await routeId('GET', 'partner/halls/[id]', pendingHall, bob.accessToken);
        trace('4.2c', show(r));
        assert.ok(r.status === 403 || r.status === 404, show(r));
    });

    test('routes publiques et liste des salles d’une autre partenaire : aucune réservation', async () => {
        const pub = await routeId('GET', 'halls/[id]', hall, null);
        const list = await api('GET', 'halls', { token: null });
        const mine = await api('GET', 'partner/halls', { token: otherPartner.accessToken });
        const orders = await api('GET', 'orders', { token: bob.accessToken });
        const admin1 = await api('GET', 'admin/services', { token: adminNoCode.accessToken, path: '/api/admin/services?type=halls' });
        trace('4.2d', [pub.status, list.status, mine.status, orders.status, admin1.status]);
        for (const r of [pub, list, mine, orders]) {
            const text = JSON.stringify(r.body);
            assert.ok(!text.includes(resId) && !text.includes(alice.userId) && !text.includes('77 123 45 67'), show(r));
        }
        assert.ok(admin1.status === 401 || admin1.status === 403, `administrateur sans code : ${show(admin1)}`);
    });
});

describe('4.3 REST et RPC directes sur les fonctions des salles', () => {
    test('aucune fonction hall_* (ni finance_setting_set, calculate_referral_commissions) exécutable par anon ou authenticated', async () => {
        const rows = await sql<{ proname: string; ret: string; anon: boolean; auth: boolean; pub: boolean }>(`
            SELECT p.proname, p.prorettype::regtype::text AS ret,
                   has_function_privilege('anon', p.oid, 'EXECUTE') AS anon,
                   has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth,
                   EXISTS (SELECT 1 FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a WHERE a.grantee = 0) AS pub
              FROM pg_proc p
             WHERE p.pronamespace = 'public'::regnamespace
               AND (p.proname LIKE 'hall%' OR p.proname IN ('finance_setting_set', 'calculate_referral_commissions', 'check_hall_availability', 'fin_payout_available_at'))
             ORDER BY 1`);
        trace('4.3a', rows.map((r) => `${r.proname} (${r.ret}) anon=${r.anon} auth=${r.auth} public=${r.pub}`));
        assert.ok(rows.length >= 15, `fonctions trouvées : ${rows.length}`);
        const open = rows.filter((r) => r.ret !== 'trigger' && (r.anon || r.auth));
        assert.deepEqual(open.map((r) => r.proname), [], 'fonctions exécutables par anon ou authenticated');
    });

    test('appel REST de chaque fonction, avec des arguments plausibles, par un visiteur, le client, la salle et un administrateur avec code : refusé, rien ne bouge', async () => {
        const fns = await sql<{ proname: string; names: string[] | null; types: string[] }>(`
            SELECT p.proname, p.proargnames AS names, ARRAY(SELECT format_type(t, NULL) FROM unnest(p.proargtypes) t) AS types
              FROM pg_proc p
             WHERE p.pronamespace = 'public'::regnamespace AND p.prorettype <> 'trigger'::regtype
               AND (p.proname LIKE 'hall%' OR p.proname IN ('finance_setting_set', 'calculate_referral_commissions'))
             ORDER BY 1`);
        const jsonArg = {
            client_id: alice.userId, actor_id: admin.userId, reservation_id: resId, hall_id: pendingHall, decision: 'VALIDER',
            origin: 'EVENT_VILLAGE', reason: 'Attaque par la REST', part: 'INTEGRAL', operator: 'WAVE', mode: 'JOUR',
            start_date: dayFromNow(101), units: 1, payer_phone: alice.phone9,
        };
        const value = (name: string, type: string): unknown => {
            if (type === 'jsonb' || type === 'json') return jsonArg;
            if (type === 'uuid') return /payment/.test(name) ? payId : resId;
            if (type === 'numeric' || type.startsWith('integer')) return 100;
            if (type.startsWith('timestamp')) return '2030-01-01T00:00:00';
            if (type === 'date') return '2030-01-01';
            if (type.startsWith('time')) return '10:00';
            if (name === 'p_key') return 'halls.service_fee_rate';
            return 'EVENT_VILLAGE';
        };
        const tokens: Array<[string, string | null]> = [['visiteur', null], ['client', alice.accessToken], ['salle', owner.accessToken], ['admin avec code', admin.accessToken]];
        const accepted: string[] = [];
        for (const f of fns) {
            const args: Row = {};
            (f.names ?? []).forEach((name, i) => { args[name] = value(name, f.types[i]); });
            for (const [label, token] of tokens) {
                const { error } = await restAs(token).rpc(f.proname, args);
                if (!error) accepted.push(`${f.proname} par ${label}`);
            }
        }
        trace('4.3b', { fonctions: fns.map((f) => f.proname), acceptes: accepted });
        assert.deepEqual(accepted, []);
        assert.equal((await reservation(resId)).booking_state, 'PAYEE');
        const { data: h } = await service.from('halls').select('validation_status').eq('id', pendingHall).single();
        assert.equal(h!.validation_status, 'EN_ATTENTE_VALIDATION');
    });
});

describe('4.4 Valider une salle sans le droit', () => {
    test('administrateur sans partners.validate, sans code, suspendu ; partenaire ; client : refusés, salle toujours en attente', async () => {
        const target = await newHall(owner, { validate: false });
        const noRight = await newAdmin('cv10a-sans-droit', ['events.write', 'events.read', 'refunds.manage']);
        const suspended = await newAdmin('cv10a-suspendu', ['partners.validate']);
        await service.from('users').update({ status: 'SUSPENDU' }).eq('id', suspended.userId);
        const route = (token: string) => routeId('POST', 'admin/halls/[id]/validation', target, token, { decision: 'VALIDER' });
        const rs = {
            sansDroit: await route(noRight.accessToken), sansCode: await route(adminNoCode.accessToken),
            suspendu: await route(suspended.accessToken), partenaire: await route(owner.accessToken), client: await route(bob.accessToken),
        };
        trace('4.4a', Object.fromEntries(Object.entries(rs).map(([k, v]) => [k, `${v.status} ${String(v.body.code ?? v.body.error ?? '')}`])));
        for (const [k, v] of Object.entries(rs)) assert.ok(v.status === 401 || v.status === 403, `${k} : ${show(v)}`);
        for (const actor of [noRight.userId, suspended.userId, owner.userId]) {
            const d = await decideHall(target, 'VALIDER', null, actor);
            assert.equal(d.code, 'FORBIDDEN', JSON.stringify(d));
        }
        const { data: h } = await service.from('halls').select('validation_status').eq('id', target).single();
        assert.equal(h!.validation_status, 'EN_ATTENTE_VALIDATION');
    });

    test('la partenaire écrit elle-même le statut de validation (modification, création) : sans effet', async () => {
        const target = await newHall(owner, { validate: false });
        const put = await routeId('PUT', 'partner/halls/[id]', target, owner.accessToken, { name: 'Salle validée par moi', validation_status: 'VALIDEE', validated_by: owner.userId, validated_at: new Date().toISOString() });
        const post = await api('POST', 'partner/halls', {
            token: owner.accessToken,
            body: { name: 'Salle auto-validée', capacity: 50, price_per_day: 10_000, validation_status: 'VALIDEE', validated_by: owner.userId },
        });
        trace('4.4b', [show(put), show(post)]);
        const { data: h } = await service.from('halls').select('validation_status').eq('id', target).single();
        assert.equal(h!.validation_status, 'EN_ATTENTE_VALIDATION');
        if (post.status === 201) assert.equal((post.body.hall as Row).validation_status, 'EN_ATTENTE_VALIDATION');
    });

    test('partenaire suspendue ou en attente : aucune salle créée', async () => {
        const out: Row = {};
        for (const status of ['SUSPENDU', 'EN_ATTENTE', 'REJETE']) {
            const p = await newPartner(`cv10a-creat-${status}`);
            await service.from('partners').update({ status }).eq('id', p.partnerId);
            const r = await api('POST', 'partner/halls', { token: p.accessToken, body: { name: `Salle ${status}`, capacity: 50, price_per_day: 10_000 } });
            out[status] = show(r);
            assert.ok(r.status >= 400, `${status} : ${show(r)}`);
            const { data } = await service.from('halls').select('id').eq('partner_id', p.partnerId);
            assert.equal((data ?? []).length, 0, `${status} : salle créée`);
        }
        trace('4.4c', out);
    });
});

describe('4.5 Prix, acompte, règle et réglages modifiés après une réservation', () => {
    test('le solde et le remboursement restent ceux de la réservation (294 000, puis 50 % de la règle modérée)', async () => {
        const client = await newBuyer('cv10a-prix');
        const h = await newHall(owner, { price_per_day: 200_000, cancellation_policy: 'MODEREE' });
        const id = String((await reserveRpc(client, h, { days: 2, startInDays: 20 })).reservation_id);
        await payConfirmed(client, id, 'ACOMPTE');
        const before = await reservation(id);
        const put = await routeId('PUT', 'partner/halls/[id]', h, owner.accessToken, {
            price_per_day: 2_000_000, price_per_hour: 1, deposit_mode: 'POURCENTAGE', deposit_value: 100, cancellation_policy: 'STRICTE',
        });
        assert.equal(put.status, 200, show(put));
        const fee = await platformSetting('halls.service_fee_rate');
        const partial = await platformSetting('halls.cancel_partial_percent');
        await setPlatformSetting('halls.service_fee_rate', 20, 'contre-vérification 10a');
        await setPlatformSetting('halls.cancel_partial_percent', 10, 'contre-vérification 10a');
        try {
            const row = await reservation(id);
            const keys = ['price_amount', 'service_fee_amount', 'total_amount', 'deposit_amount', 'balance_amount', 'cancellation_policy', 'cancellation_terms', 'balance_due_at'];
            assert.deepEqual(keys.map((k) => JSON.stringify(row[k])), keys.map((k) => JSON.stringify(before[k])));
            const s = await started(client, id, 'SOLDE');
            trace('4.5', { solde: s.amount });
            assert.equal(n(s.amount), 294_000);
            await confirmByWebhook(s);
            const c = await clientCancel(id, client.accessToken);
            assert.equal(c.status, 200, show(c));
            assert.deepEqual((await refundsOf(id)).map((r) => n(r.amount)), [63_000, 147_000]);
        } finally {
            await setPlatformSetting('halls.service_fee_rate', fee, 'contre-vérification 10a : valeur d’origine');
            await setPlatformSetting('halls.cancel_partial_percent', partial, 'contre-vérification 10a : valeur d’origine');
        }
    });
});
