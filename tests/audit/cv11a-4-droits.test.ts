/**
 * Contre-vérification du lot 11a — point 4 : droits et données. Lecture des réservations (noms, numéros, notes) par un
 * autre client, un autre établissement, un visiteur, un administrateur sans code (REST et routes) ; REST et RPC directes
 * sur toutes les fonctions table_* et venue_* ; écriture d'un statut par n'importe quel chemin (garde trg_0, statut de
 * validation) ; validation sans le droit ; établissement ou partenaire suspendus ; routes publiques (établissement
 * inconnu, fiche en attente, recherche par nom). Un test rouge est un TROU (docs/audit-lot11a.md).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { assertLot11aInvariants } from '../helpers/lot11a-invariants';
import { newAdmin, type TestAdmin } from '../parcours/notif-helpers';
import { withFeatureFlags } from '../parcours/terrain-helpers';
import { adminWithoutCode, setFiche } from './cvf1-helpers';
import {
    adminCancel, api, clientCancel, dayFromNow, decideVenue, depositVenue, n, newBuyer, newPartner, newTable, newVenue, openTablesService,
    partnerAction, payConfirmed, reservation, reserveRpc, restAs, routeId, service, show, sql, trace,
    type Buyer, type Row, type TestPartner,
} from './cv11a-helpers';

const NOTE = 'Anniversaire de Awa Diop, appelez-moi au 77 123 45 67';

let restore: () => Promise<void>;
let owner: TestPartner;
let otherPartner: TestPartner;
let alice: Buyer;
let bob: Buyer;
let adminNoCode: Buyer;
let admin: TestAdmin;
let venue: string;
let table: string;
let pendingVenue: string;
let resId: string;
let payId: string;

before(async () => {
    restore = await openTablesService();
    owner = await newPartner('cv11a-droits');
    otherPartner = await newPartner('cv11a-droits-autre');
    alice = await newBuyer('cv11a-alice', { firstName: 'Awa', lastName: 'Diop' });
    bob = await newBuyer('cv11a-bob');
    admin = await newAdmin('cv11a-admin', ['events.read', 'refunds.manage', 'partners.validate']);
    adminNoCode = await adminWithoutCode('cv11a-sans-code', ['events.read', 'refunds.manage', 'partners.validate']);
    ({ venue, table } = await depositVenue(owner));
    pendingVenue = await newVenue(owner, { validate: false });
    await newTable(owner, pendingVenue, 4);
    const r = await reserveRpc(alice, venue, { date: dayFromNow(70), notes: NOTE });
    assert.equal(r.ok, true, JSON.stringify(r));
    resId = String(r.reservation_id);
    payId = (await payConfirmed(alice, resId)).id;
});

after(async () => {
    await restore();
    await assertLot11aInvariants('cv11a-4-droits');
});

const leak = (text: string): string[] => [resId, alice.userId, '77 123 45 67', alice.phone9, 'Diop'].filter((v) => text.includes(v));

describe('4.1 REST : réservations, paiements, comptes, établissements en attente', () => {
    test('un autre client, une autre partenaire, un visiteur, un administrateur sans code : rien de lisible', async () => {
        const who: Array<[string, string | null]> = [['autre client', bob.accessToken], ['autre partenaire', otherPartner.accessToken], ['visiteur', null], ['admin sans code', adminNoCode.accessToken]];
        const seen: Row = {};
        for (const [label, token] of who) {
            const rest = restAs(token);
            const res = await rest.from('table_reservations').select('id, special_requests, client_id').eq('id', resId);
            const pay = await rest.from('payments').select('id, payer_phone').eq('table_reservation_id', resId);
            const user = await rest.from('users').select('id, first_name, last_name, phone').eq('id', alice.userId);
            const viaVenue = await rest.from('venues').select('id, table_reservations(id, special_requests, client_id)').eq('id', venue);
            const viaTable = await rest.from('restaurant_tables').select('id, table_reservations(id, special_requests, client_id)').eq('id', table);
            const cash = await rest.from('cashouts').select('id, phone_number').eq('payment_id', payId);
            const logs = await rest.from('audit_logs').select('id, metadata').eq('object_id', resId);
            const pend = await rest.from('venues').select('id').eq('id', pendingVenue);
            const pendTables = await rest.from('restaurant_tables').select('id').eq('venue_id', pendingVenue);
            const pendHours = await rest.from('venue_opening_hours').select('weekday').eq('venue_id', pendingVenue);
            const nested = [...(viaVenue.data ?? []), ...(viaTable.data ?? [])].flatMap((x) => ((x as Row).table_reservations as Row[] | undefined) ?? []);
            const counts = {
                resa: res.data?.length ?? res.error?.code, paiement: pay.data?.length ?? pay.error?.code, compte: user.data?.length ?? user.error?.code,
                imbrique: nested.length, versements: cash.data?.length ?? cash.error?.code, journal: logs.data?.length ?? logs.error?.code,
                etabEnAttente: pend.data?.length ?? pend.error?.code, tablesEnAttente: pendTables.data?.length ?? pendTables.error?.code,
                horairesEnAttente: pendHours.data?.length ?? pendHours.error?.code,
            };
            seen[label] = counts;
            for (const [k, v] of Object.entries(counts)) assert.ok(v === 0 || typeof v === 'string', `${label} lit ${k} (${String(v)} ligne(s))`);
        }
        // Contre-vérification du lot 10b (T5 bis, modification signalée au rapport) : l’établissement ne lit plus ses
        // réservations par la REST ; la précondition (session de la propriétaire valide) lit son propre établissement
        const mine = await restAs(owner.accessToken).from('venues').select('id').eq('id', venue);
        const ownerUser = await restAs(owner.accessToken).from('users').select('id, phone').eq('id', alice.userId);
        trace('4.1', { ...seen, proprietaire: mine.data?.length, proprietaireLitLeCompte: ownerUser.data?.length });
        assert.equal(mine.data?.length, 1, 'précondition : la propriétaire lit son établissement');
        assert.equal(ownerUser.data?.length ?? 0, 0, 'la propriétaire lit le compte (numéro) du client');
    });
});

describe('4.2 Routes partenaire, client, administration', () => {
    test('liste des réservations filtrée sur l’établissement d’une autre : rien ; client ou visiteur : refusé', async () => {
        const q = `?venueId=${venue}`;
        const other = await api('GET', 'partner/tables/reservations', { token: otherPartner.accessToken, path: `/api/partner/tables/reservations${q}` });
        const asClient = await api('GET', 'partner/tables/reservations', { token: alice.accessToken, path: `/api/partner/tables/reservations${q}` });
        const anon = await api('GET', 'partner/tables/reservations', { token: null, path: `/api/partner/tables/reservations${q}` });
        const venues = await api('GET', 'partner/venues', { token: otherPartner.accessToken });
        const tables = await api('GET', 'partner/tables', { token: otherPartner.accessToken });
        trace('4.2a', { other: show(other), client: asClient.status, anon: anon.status, venues: leak(JSON.stringify(venues.body)).length + (JSON.stringify(venues.body).includes(venue) ? 1 : 0), tables: JSON.stringify(tables.body).includes(table) });
        assert.deepEqual(leak(JSON.stringify(other.body)), []);
        assert.ok(asClient.status === 403 || asClient.status === 401, show(asClient));
        assert.ok(anon.status === 401 || anon.status === 403, show(anon));
        assert.ok(!JSON.stringify(venues.body).includes(venue), 'établissement d’une autre listé');
        assert.ok(!JSON.stringify(tables.body).includes(table), 'table d’une autre listée');
    });

    test('actions sur la réservation par une autre partenaire (toutes) et par le client lui-même : refusées, rien ne bouge', async () => {
        const before = await reservation(resId);
        const replies: Row = {};
        for (const body of [{ action: 'ACCEPTER' }, { action: 'REFUSER', reason: 'Complet ce soir' }, { action: 'ARRIVEE' }, { action: 'ABSENT' },
            { action: 'ANNULER', reason: 'Fermeture exceptionnelle' }, { action: 'PAIEMENT_SUR_PLACE', amount: 1_000, method: 'ESPECES' }]) {
            replies[`autre ${body.action}`] = (await partnerAction(resId, otherPartner.accessToken, body)).status;
            replies[`client ${body.action}`] = (await partnerAction(resId, alice.accessToken, body)).status;
        }
        replies['autre DELETE'] = (await routeId('DELETE', 'partner/tables/reservations/[id]', resId, otherPartner.accessToken, { reason: 'Fermeture exceptionnelle' })).status;
        replies['client DELETE'] = (await routeId('DELETE', 'partner/tables/reservations/[id]', resId, alice.accessToken, { reason: 'Fermeture exceptionnelle' })).status;
        replies['bob annule'] = (await clientCancel(resId, bob.accessToken)).status;
        replies['autre modifie l’établissement'] = (await routeId('PATCH', 'partner/venues/[id]', venue, otherPartner.accessToken, { name: 'Volé', deposit_per_person: 100 })).status;
        replies['autre modifie la table'] = (await routeId('PATCH', 'partner/tables/[id]', table, otherPartner.accessToken, { capacity: 1, is_active: false })).status;
        replies['autre supprime la table'] = (await routeId('DELETE', 'partner/tables/[id]', table, otherPartner.accessToken)).status;
        const after = await reservation(resId);
        const v = (await sql(`SELECT name, deposit_per_person FROM public.venues WHERE id = $1`, [venue]))[0];
        const t = (await sql(`SELECT capacity, is_active FROM public.restaurant_tables WHERE id = $1`, [table]))[0];
        trace('4.2b', { replies, state: after.booking_state, onsite: after.onsite_amount, venue: v, table: t });
        for (const [k, s] of Object.entries(replies)) if (k !== 'autre supprime la table') assert.ok(n(s) >= 400, `${k} : HTTP ${String(s)}`);
        assert.ok(t, 'table d’une autre supprimée');
        assert.deepEqual([after.booking_state, after.onsite_amount, after.paid_amount], [before.booking_state, before.onsite_amount, before.paid_amount]);
        assert.equal(n(v.deposit_per_person), 5_000);
        assert.deepEqual([n(t.capacity), t.is_active], [4, true]);
    });

    test('administration : annulation et validation sans code, sans le droit, par une partenaire ou un client → 403', async () => {
        const weak = await newAdmin('cv11a-faible', ['events.read']);
        const out: Row = {};
        for (const [label, token] of [['sans code', adminNoCode.accessToken], ['sans le droit', weak.accessToken], ['partenaire', owner.accessToken], ['client', alice.accessToken]] as const) {
            out[`annule ${label}`] = (await adminCancel(resId, token, 'Annulation par l’administration')).status;
            out[`valide ${label}`] = (await routeId('POST', 'admin/venues/[id]/validation', pendingVenue, token, { decision: 'VALIDER' })).status;
        }
        const row = await reservation(resId);
        const pv = (await sql(`SELECT validation_status FROM public.venues WHERE id = $1`, [pendingVenue]))[0];
        trace('4.2c', { out, state: row.booking_state, pending: pv.validation_status });
        for (const [k, s] of Object.entries(out)) assert.ok(s === 403 || s === 401, `${k} : HTTP ${String(s)}`);
        assert.equal(row.booking_state, 'CONFIRMEE');
        assert.equal(pv.validation_status, 'EN_ATTENTE_VALIDATION');
    });
});

describe('4.3 Fonctions en base : droits d’exécution et appels REST', () => {
    test('toutes les fonctions table_*, venue_* (et recopies du lot) : anon et authenticated sans droit d’exécution', async () => {
        const rows = await sql<{ proname: string; args: string; anon: boolean; auth: boolean }>(
            `SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args,
                    has_function_privilege('anon', p.oid, 'execute') AS anon, has_function_privilege('authenticated', p.oid, 'execute') AS auth
               FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
                AND (p.proname LIKE 'table\\_%' OR p.proname LIKE 'venue\\_%' OR p.proname LIKE 'venues\\_%' OR p.proname LIKE 'restaurant\\_%'
                     OR p.proname IN ('fin_payout_available_at', 'calculate_referral_commissions', 'finance_setting_set',
                                      'notif_admin_review_sms', 'notif_cashouts_notify', 'finance_admin_earned', 'finance_admin_payments'))
              ORDER BY 1`);
        const open = rows.filter((r) => r.anon || r.auth);
        trace('4.3a', { total: rows.length, ouvertes: open.map((r) => `${r.proname}(${r.args}) anon=${r.anon} auth=${r.auth}`) });
        assert.ok(rows.length >= 25, `précondition : ${rows.length} fonctions trouvées`);
        assert.deepEqual(open.map((r) => r.proname), []);
    });

    test('appels REST directs (visiteur, client, partenaire, administrateur avec code) : aucun accepté, rien ne bouge', async () => {
        const calls: Array<[string, Row]> = [
            ['table_reserve', { p: { client_id: bob.userId, venue_id: venue, date: dayFromNow(71), time: '20:00', guests: 2 } }],
            ['table_payment_create', { p: { client_id: alice.userId, reservation_id: resId, operator: 'WAVE', payer_phone: alice.phone9 } }],
            ['table_payment_confirm', { p_payment_id: payId, p_source: 'WEBHOOK' }],
            ['table_reservation_cancel', { p: { reservation_id: resId, actor_id: owner.userId, origin: 'ETABLISSEMENT', reason: 'Fermeture exceptionnelle' } }],
            ['table_reservation_respond', { p: { reservation_id: resId, actor_id: owner.userId, action: 'REFUSER', reason: 'Complet ce soir' } }],
            ['table_reservation_presence', { p: { reservation_id: resId, actor_id: owner.userId, action: 'ABSENT' } }],
            ['table_onsite_payment_record', { p: { reservation_id: resId, actor_id: owner.userId, amount: 1_000, method: 'ESPECES' } }],
            ['table_refund_payment', { p_payment_id: payId, p_percent: 100, p_reason: 'rest' }],
            ['table_close_apply', { p_reservation_id: resId, p_state: 'ANNULEE_EV', p_origin: 'EVENT_VILLAGE', p_actor: null, p_reason: 'rest', p_percent: 100 }],
            ['table_expire_hold', { p_reservation_id: resId }],
            ['table_reservations_tick', {}],
            ['table_hold_refusal', { p_reservation_id: resId }],
            ['table_notif_data', { p_reservation_id: resId }],
            ['table_notify', { p_type: 'TABLE_REMINDER', p_reservation_id: resId, p_to: 'CLIENT', p_extra: {} }],
            ['table_lock_reservation', { p_reservation_id: resId }],
            ['venue_validation_decide', { p: { actor_id: admin.userId, venue_id: pendingVenue, decision: 'VALIDER' } }],
            ['venue_hours_set', { p: { actor_id: owner.userId, venue_id: venue, hours: [] } }],
            ['venue_open_covers', { p_venue_id: venue, p_slot: '[2030-01-01 20:00,2030-01-01 22:00)' }],
        ];
        const accepted: string[] = [];
        for (const [label, token] of [['visiteur', null], ['client', alice.accessToken], ['partenaire', owner.accessToken], ['admin', admin.accessToken]] as const) {
            for (const [fn, args] of calls) {
                const { error } = await restAs(token).rpc(fn, args);
                if (!error) accepted.push(`${label} ${fn}`);
            }
        }
        const row = await reservation(resId);
        const pv = (await sql(`SELECT validation_status FROM public.venues WHERE id = $1`, [pendingVenue]))[0];
        const hours = await sql(`SELECT count(*)::int AS c FROM public.venue_opening_hours WHERE venue_id = $1`, [venue]);
        trace('4.3b', { accepted, state: row.booking_state, pending: pv.validation_status, hours: hours[0].c });
        assert.deepEqual(accepted, []);
        assert.equal(row.booking_state, 'CONFIRMEE');
        assert.equal(pv.validation_status, 'EN_ATTENTE_VALIDATION');
        assert.equal(hours[0].c, 7);
    });
});

describe('4.4 Écrire un statut par un autre chemin', () => {
    test('clé de service (comme une route) : état, argent, table, date, personnes, échéance, suppression, insertion → refusés ; note seule permise', async () => {
        const attempts: Array<[string, Row]> = [
            ['état', { booking_state: 'ANNULEE_EV' }], ['ancien statut', { status: 'ANNULEE' }], ['payé', { paid_amount: 0 }], ['remboursé', { refunded_amount: 21_000 }],
            ['table', { table_id: null }], ['date', { reservation_date: dayFromNow(80) }], ['personnes', { guest_count: 1 }], ['échéance', { response_due_at: new Date().toISOString() }],
            ['sur place', { onsite_amount: 999 }], ['paiement', { payment_status: 'REFUNDED' }], ['client', { client_id: bob.userId }],
        ];
        const out: Row = {};
        for (const [label, patch] of attempts) {
            const { error } = await service.from('table_reservations').update(patch).eq('id', resId);
            out[label] = error?.code ?? 'ACCEPTÉ';
        }
        const del = await service.from('table_reservations').delete().eq('id', resId);
        const ins = await service.from('table_reservations').insert({
            partner_id: owner.partnerId, venue_id: venue, table_id: table, client_id: bob.userId, reservation_date: dayFromNow(81), reservation_time: '20:00',
            guest_count: 2, booking_state: 'CONFIRMEE', deposit_amount: 0, total_amount: 0,
        });
        const note = await service.from('table_reservations').update({ special_requests: NOTE }).eq('id', resId);
        out.suppression = del.error?.code ?? 'ACCEPTÉ';
        out.insertion = ins.error?.code ?? 'ACCEPTÉ';
        out.note = note.error?.code ?? 'ACCEPTÉ';
        const restOwner = await restAs(owner.accessToken).from('table_reservations').update({ booking_state: 'ANNULEE_ETABLISSEMENT' }).eq('id', resId).select('id');
        const restClient = await restAs(alice.accessToken).from('table_reservations').update({ special_requests: 'x', paid_amount: 0 }).eq('id', resId).select('id');
        out.restPartenaire = restOwner.error?.code ?? `${restOwner.data?.length} ligne(s)`;
        out.restClient = restClient.error?.code ?? `${restClient.data?.length} ligne(s)`;
        const row = await reservation(resId);
        trace('4.4a', { out, state: row.booking_state, paid: row.paid_amount });
        for (const [k, v] of Object.entries(out)) if (k !== 'note') assert.ok(v !== 'ACCEPTÉ' && v !== '1 ligne(s)', `${k} : ${String(v)}`);
        assert.deepEqual([row.booking_state, n(row.paid_amount)], ['CONFIRMEE', 21_000]);
    });

    test('route de la partenaire : action inventée (CONFIRMEE, TERMINEE, vide) → 400 ; plus de création de réservation par la partenaire', async () => {
        const out: Row = {};
        for (const action of ['CONFIRMEE', 'TERMINEE', 'EN_ATTENTE', '', 'accepter ']) out[action || 'vide'] = (await partnerAction(resId, owner.accessToken, { action, status: 'CONFIRMEE' })).status;
        const mod = (await import('../../app/api/partner/tables/reservations/route')) as Record<string, unknown>;
        out.POST = typeof mod.POST;
        trace('4.4b', out);
        for (const action of ['CONFIRMEE', 'TERMINEE', 'EN_ATTENTE', 'vide', 'accepter ']) assert.equal(out[action], 400, action);
        assert.equal(out.POST, 'undefined');
    });

    test('statut de validation écrit par la partenaire (route, REST) ou par une écriture de service : jamais validé', async () => {
        const viaRoute = await routeId('PATCH', 'partner/venues/[id]', pendingVenue, owner.accessToken, { validation_status: 'VALIDEE', name: 'Nouveau nom cv11a' });
        const viaRest = await restAs(owner.accessToken).from('venues').update({ validation_status: 'VALIDEE' }).eq('id', pendingVenue).select('id');
        const viaService = await service.from('venues').update({ validation_status: 'VALIDEE', validated_by: owner.userId }).eq('id', pendingVenue);
        const created = await api('POST', 'partner/venues', { token: owner.accessToken, body: { name: 'TEST cv11a déjà validé', validation_status: 'VALIDEE', validated_at: new Date().toISOString() } });
        const createdId = String(((created.body as Row).venue as Row | undefined)?.id ?? '');
        const insertedByService = await service.from('venues').insert({ partner_id: owner.partnerId, name: 'TEST cv11a inséré validé', validation_status: 'VALIDEE' }).select('id, validation_status').single();
        const pv = (await sql(`SELECT validation_status, validated_by FROM public.venues WHERE id = $1`, [pendingVenue]))[0];
        const cv = createdId ? (await sql(`SELECT validation_status FROM public.venues WHERE id = $1`, [createdId]))[0] : null;
        const tableRest = await restAs(owner.accessToken).from('restaurant_tables').insert({ partner_id: owner.partnerId, venue_id: venue, table_number: 'REST-1', capacity: 4 }).select('id');
        const hoursRest = await restAs(owner.accessToken).from('venue_opening_hours').insert({ venue_id: venue, weekday: 1, opens_at: '05:00', closes_at: '06:00' }).select('venue_id');
        trace('4.4c', { viaRoute: viaRoute.status, viaRest: viaRest.error?.code ?? viaRest.data?.length, viaService: viaService.error?.message ?? 'sans erreur', created: created.status, createdState: cv?.validation_status,
            inserted: insertedByService.data?.validation_status, pending: pv, tableRest: tableRest.error?.code ?? tableRest.data?.length, hoursRest: hoursRest.error?.code ?? hoursRest.data?.length });
        assert.equal(pv.validation_status, 'EN_ATTENTE_VALIDATION');
        assert.equal(pv.validated_by, null);
        if (cv) assert.equal(cv.validation_status, 'EN_ATTENTE_VALIDATION');
        assert.equal(insertedByService.data?.validation_status, 'EN_ATTENTE_VALIDATION');
        assert.ok(tableRest.error || (tableRest.data ?? []).length === 0, 'table créée par la REST');
        assert.ok(hoursRest.error || (hoursRest.data ?? []).length === 0, 'horaires écrits par la REST');
    });
});

describe('4.5 Validation sans le droit', () => {
    test('par la fonction : partenaire, client, administrateur sans partners.validate, administrateur suspendu → FORBIDDEN', async () => {
        const weak = await newAdmin('cv11a-sans-droit', ['events.read', 'events.write']);
        const suspended = await newAdmin('cv11a-suspendu', ['partners.validate']);
        await service.from('users').update({ status: 'SUSPENDU' }).eq('id', suspended.userId);
        const out: Row = {};
        for (const [label, actor] of [['partenaire', owner.userId], ['client', alice.userId], ['sans droit', weak.userId], ['suspendu', suspended.userId], ['inconnu', '00000000-0000-4000-8000-000000000000']] as const) {
            const { data, error } = await service.rpc('venue_validation_decide', { p: { actor_id: actor, venue_id: pendingVenue, decision: 'VALIDER' } });
            out[label] = error?.message ?? String((data as Row).code ?? (data as Row).ok);
        }
        const pv = (await sql(`SELECT validation_status FROM public.venues WHERE id = $1`, [pendingVenue]))[0];
        trace('4.5', { out, pending: pv.validation_status });
        for (const [k, v] of Object.entries(out)) assert.equal(v, 'FORBIDDEN', k);
        assert.equal(pv.validation_status, 'EN_ATTENTE_VALIDATION');
    });
});

describe('4.6 Établissement ou partenaire suspendus après une demande payée', () => {
    test('établissement suspendu par l’administration : la partenaire n’accepte plus une demande payée en attente', async () => {
        const cl = await newBuyer('cv11a-susp-etab');
        const { venue: v } = await depositVenue(owner, 5_000, { confirmation_mode: 'MANUELLE' });
        const id = String((await reserveRpc(cl, v, { date: dayFromNow(72) })).reservation_id);
        await payConfirmed(cl, id);
        assert.equal((await decideVenue(v, 'SUSPENDRE', 'Plaintes répétées de clients')).ok, true);
        const r = await partnerAction(id, owner.accessToken, { action: 'ACCEPTER' });
        const row = await reservation(id);
        trace('4.6a', { accept: show(r), state: row.booking_state });
        assert.notEqual(row.booking_state, 'CONFIRMEE', 'demande acceptée par un établissement suspendu');
    });

    test('fiche de la partenaire suspendue : elle n’accepte plus une demande payée en attente', async () => {
        const p = await newPartner('cv11a-susp-fiche');
        const cl = await newBuyer('cv11a-susp-fiche-client');
        const { venue: v } = await depositVenue(p, 5_000, { confirmation_mode: 'MANUELLE' });
        const id = String((await reserveRpc(cl, v, { date: dayFromNow(73) })).reservation_id);
        await payConfirmed(cl, id);
        await setFiche(p.partnerId, 'SUSPENDU');
        const r = await partnerAction(id, p.accessToken, { action: 'ACCEPTER' });
        const row = await reservation(id);
        await setFiche(p.partnerId, 'VALIDE');
        trace('4.6b', { accept: show(r), state: row.booking_state });
        assert.notEqual(row.booking_state, 'CONFIRMEE', 'demande acceptée par une partenaire suspendue');
    });
});

describe('4.7 Routes publiques', () => {
    test('/api/restaurants/[id]/tables : inconnu, illisible, en attente, refusé, suspendu, inactif, partenaire suspendue → 404 ; validé : aucune donnée de réservation', async () => {
        const p2 = await newPartner('cv11a-public-susp');
        const refused = await newVenue(owner, { validate: false });
        await decideVenue(refused, 'REFUSER', 'Photos manquantes');
        const suspended = await newVenue(owner);
        await decideVenue(suspended, 'SUSPENDRE', 'Plaintes de clients');
        const inactive = await newVenue(owner, { is_active: false });
        const ofSuspended = await newVenue(p2);
        await setFiche(p2.partnerId, 'SUSPENDU');
        const out: Row = {};
        for (const [label, id] of [['inconnu', '00000000-0000-4000-8000-000000000000'], ['illisible', 'restaurant-1'], ['en attente', pendingVenue], ['refusé', refused],
            ['suspendu', suspended], ['inactif', inactive], ['partenaire suspendue', ofSuspended]] as const) {
            out[label] = (await routeId('GET', 'restaurants/[id]/tables', id, null)).status;
        }
        await setFiche(p2.partnerId, 'VALIDE');
        const ok = await routeId('GET', 'restaurants/[id]/tables', venue, null);
        trace('4.7a', { out, valide: ok.status, fuite: leak(JSON.stringify(ok.body)) });
        for (const [k, s] of Object.entries(out)) assert.equal(s, 404, k);
        assert.equal(ok.status, 200, show(ok));
        assert.deepEqual(leak(JSON.stringify(ok.body)), []);
    });

    test('/api/restaurants/[id]/menu : un nom partiel (« rest-e ») ne désigne pas « la première partenaire venue »', async () => {
        const named = await newPartner('cv11a-menu');
        await service.from('partners').update({ commercial_name: 'Chez Cv11a Menu Unique' }).eq('id', named.partnerId);
        const { error } = await service.from('products').insert({ partner_id: named.partnerId, name: 'TEST Thieb cv11a', price: 3_500, status: 'DISPONIBLE' });
        assert.equal(error, null, error?.message);
        const out = await withFeatureFlags({ orders: true }, async () => {
            const partial = await routeId('GET', 'restaurants/[id]/menu', 'rest-e', null);
            const fragment = await routeId('GET', 'restaurants/[id]/menu', 'cv11a', null);
            return { partial: `${partial.status} ${String(partial.body.partnerName ?? '')}`, fragment: `${fragment.status} ${String(fragment.body.partnerName ?? '')}` };
        });
        trace('4.7b', out);
        assert.match(out.partial, /^404/, `« rest-e » rend un restaurant : ${out.partial}`);
        assert.match(out.fragment, /^404/, `« cv11a » rend un restaurant : ${out.fragment}`);
    });
});
