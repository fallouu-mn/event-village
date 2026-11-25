/**
 * Contre-vérification du lot 11c-a — garde-fous éprouvés de façon indépendante (verts attendus ; un rouge serait un trou).
 * Base LOCALE, faux SamirPay ; attaques par les routes (jeton de l'attaquant) ou par la REST (clé anon + jeton) ; la clé
 * de service ne sert qu'à la mise en place, aux lectures et à l'essai des gardes « même par la clé de service ».
 *
 *  G1 Corps du navigateur : aucun montant, nombre de places, durée de garde ni partenaire accepté (champs ignorés compris) ;
 *     type ou table d'un autre événement refusés ; montant et garde lus en base.
 *  G2 Webhook rejoué et relève simultanés : une seule vente, N billets, un seul avis par canal.
 *  G3 Limite par compte sous concurrence (un seul paiement en attente) et avec un autre numéro payeur (2 types différents).
 *  G4 Paiement arrivé après l'annulation de l'événement, webhook rejoué : remboursé en entier une seule fois, aucune vente.
 *  G5 Cloisonnement : une autre organisatrice ne lit ni ne modifie rien ; types, tables et zones d'un autre événement
 *     refusés ; « Ma table » au seul titulaire (l'invité : 404) ; porte refusée ; données réduites (prénom et initiale,
 *     2 derniers chiffres) ; REST (anon et jeton) fermée ; schéma private inatteignable, clé de service comprise.
 *  G6 Prix et places figés dès la première attente (route et clé de service) ; table en attente jamais retirée.
 *  G7 ADMIN_EVENT_TABLES_CHANGED : une alerte par enregistrement et par administrateur et canal (création de 3 tables,
 *     plan de 3 changements, retrait d'un type), jamais ADMIN_EVENT_CHANGED.
 *  G8 Interrupteur fermé : devis, achat, création, modification et plan refusés ; offre vide.
 *  G9 Deux tables du même type achetées l'une après l'autre par le même compte : toutes deux vendues (aucune fausse
 *     alerte de paiement en double : payment_duplicate_of n'attrape que deux paiements ouverts en même temps). Piste T1
 *     écrite d'abord dans cv11c-1-trous, verte au run 662 : déplacée ici.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { checkLot11cInvariants } from '../helpers/lot11c-invariants';
import { assertNotificationInvariants } from '../helpers/notification-invariants';
import { randomSenegalPhone } from '../parcours/helpers';
import { deliverWebhook, newBuyer, paymentById, providerSays, service } from '../parcours/paiement-helpers';
import { newPartner, type TestPartner } from '../parcours/finance-helpers';
import {
    bookingOfPayment, buyTable, categoryRow, confirmByWebhook, createTableType, createdTableType, deleteTableType, doorList, myTable, myTables,
    newTablesEvent, outbox, patchTableType, platformRefunds, reservationsOfPayment, saveTables, show, showPlan, switchEventTablesService,
    setEventTablesSetting, tableCheckout, tableOffer, tableQuote, tablesConfig, tablesForSave, ticketsOfBooking, transferSeat, vipType,
    withEventTablesSetting, type Row,
} from '../parcours/l11c-helpers';
import { cancelEvent, n, restClient } from './cv11c-helpers';

let restore: () => Promise<void>;
let partner: TestPartner;
let other: TestPartner;

before(async () => {
    restore = await switchEventTablesService(true);
    partner = await newPartner('cv11c-gardes');
    other = await newPartner('cv11c-autre');
});

after(async () => {
    if (restore) await restore();
    await checkLot11cInvariants('cv11c-2-gardes');
    await assertNotificationInvariants('cv11c-2-gardes');
});

/** Paiements créés pour un compte et un événement (aucun ne doit naître d'un corps refusé). */
async function paymentsOf(userId: string, eventId: string): Promise<Row[]> {
    const { data, error } = await service.from('payments').select('id, status, amount').eq('client_id', userId).eq('event_id', eventId);
    assert.equal(error, null, error?.message);
    return (data ?? []) as Row[];
}

describe('Garde-fous du lot 11c-a', () => {
    test('G1 — corps du navigateur : prix, montant, places, garde ou partenaire refusés (400, aucun paiement) ; type ou table d’ailleurs refusés ; montant lu en base', async () => {
        const ev = await newTablesEvent(partner, 'cv-g1');
        const t = await createdTableType(partner, ev.eventId, vipType(), 2);
        const elsewhere = await newTablesEvent(partner, 'cv-g1-autre');
        const foreign = await createdTableType(partner, elsewhere.eventId, vipType(), 1);
        const buyer = await newBuyer('cv11c-g1');
        const extras: Row[] = [{ price: 1 }, { amount: 1 }, { seats: 20 }, { unit_price: 1 }, { hold_minutes: 600 }, { partner_id: other.partnerId }, { total: 1 }, { quantity: 6 }];
        for (const extra of extras) {
            const r = await tableCheckout(buyer, ev.eventId, t.typeId, { extra });
            assert.deepEqual([r.status, r.body.code], [400, 'INVALID_INPUT'], `champ ${Object.keys(extra)[0]} : ${show(r)}`);
        }
        assert.deepEqual(await paymentsOf(buyer.userId, ev.eventId), [], 'aucun paiement né d’un corps refusé');
        const otherType = await tableCheckout(buyer, ev.eventId, foreign.typeId);
        assert.deepEqual([otherType.status, otherType.body.code], [404, 'TABLE_TYPE_NOT_FOUND'], `type d’un autre événement : ${show(otherType)}`);
        const quoteOther = await tableQuote(ev.eventId, { typeId: foreign.typeId });
        assert.deepEqual([quoteOther.status, quoteOther.body.code], [404, 'TABLE_TYPE_NOT_FOUND'], `devis d’un type d’un autre événement : ${show(quoteOther)}`);
        const quoteExtra = await tableQuote(ev.eventId, { typeId: t.typeId, price: 1 });
        assert.deepEqual([quoteExtra.status, quoteExtra.body.code], [400, 'INVALID_INPUT'], `devis avec un prix venu du navigateur : ${show(quoteExtra)}`);
        await showPlan(partner, ev.eventId);
        const otherTable = await tableCheckout(buyer, ev.eventId, t.typeId, { tableId: foreign.tables[0].id });
        assert.deepEqual([otherTable.status, otherTable.body.code], [404, 'TABLE_NOT_FOUND'], `table d’un autre événement : ${show(otherTable)}`);
        assert.deepEqual(await paymentsOf(buyer.userId, ev.eventId), [], 'aucun paiement');

        const ok = await tableCheckout(buyer, ev.eventId, t.typeId);
        assert.equal(ok.status, 200, show(ok));
        const { data: rate } = await service.from('platform_settings').select('value').eq('key', 'finance.service_fee_rate').single();
        const { data: hold } = await service.from('platform_settings').select('value').eq('key', 'finance.payment_hold_minutes').single();
        const fee = Math.ceil(150_000 * n((rate!.value as Row).value) / 100);
        assert.equal(n(ok.payment!.amount), 150_000 + fee, `montant = prix de la table + frais (${fee}) : ${n(ok.payment!.amount)}`);
        const res = await reservationsOfPayment(ok.payment!.id);
        const minutes = (Date.parse(String(res[0].expires_at)) - Date.parse(String(ok.payment!.created_at))) / 60_000;
        assert.ok(Math.abs(minutes - n((hold!.value as Row).value)) < 1.5, `garde = finance.payment_hold_minutes (${n((hold!.value as Row).value)}) : ${minutes.toFixed(2)} min`);
        await service.rpc('payment_release', { p_payment_id: ok.payment!.id, p_status: 'FAILED', p_reason: 'cv11c G1' });
    });

    test('G2 — webhook rejoué deux fois et relève en même temps : une seule vente, 6 billets, type +1, un avis par canal', async () => {
        const ev = await newTablesEvent(partner, 'cv-g2');
        const t = await createdTableType(partner, ev.eventId, vipType(), 2);
        const buyer = await newBuyer('cv11c-g2');
        const started = await tableCheckout(buyer, ev.eventId, t.typeId);
        assert.equal(started.status, 200, show(started));
        providerSays(started.payment!, 'SUCCESS');
        const [w1, w2, relève] = await Promise.all([
            deliverWebhook(started.payment!), deliverWebhook(started.payment!),
            service.rpc('payment_confirm', { p_payment_id: started.payment!.id, p_source: 'TEST' }),
        ]);
        assert.equal(relève.error, null, relève.error?.message);
        assert.deepEqual([w1.status, w2.status], [200, 200]);
        const paid = await paymentById(started.payment!.id);
        assert.equal(paid.status, 'SUCCESS');
        const booking = await bookingOfPayment(paid.id);
        assert.ok(booking, 'vente créée');
        const { data: all } = await service.from('event_table_bookings').select('id').eq('payment_id', paid.id);
        assert.equal((all ?? []).length, 1, 'une seule vente');
        assert.equal((await ticketsOfBooking(String(booking!.id))).length, 6, '6 billets');
        const { data: tk } = await service.from('tickets').select('id').eq('payment_id', paid.id);
        assert.equal((tk ?? []).length, 6, '6 billets pour le paiement');
        assert.equal(n((await categoryRow(t.typeId)).sold_quantity), 1, 'une table vendue');
        const confirmed = (await outbox({ type: 'EVENT_TABLE_CONFIRMED', eventId: ev.eventId })).filter((r) => r.recipient_user_id === buyer.userId);
        const perChannel = new Map<string, number>();
        for (const r of confirmed) perChannel.set(String(r.channel), (perChannel.get(String(r.channel)) ?? 0) + 1);
        assert.ok(confirmed.length > 0, 'avis EVENT_TABLE_CONFIRMED');
        assert.ok([...perChannel.values()].every((c) => c === 1), `un avis par canal : ${JSON.stringify([...perChannel])}`);
    });

    test('G3 — limite par compte : 3 achats simultanés → 1 seul ; 2 tables (2 types) puis 3e refusée, même avec un autre numéro payeur', async () => {
        const ev = await newTablesEvent(partner, 'cv-g3');
        const a = await createdTableType(partner, ev.eventId, vipType(), 3);
        const b = await createdTableType(partner, ev.eventId, vipType({ price: 120_000 }), 3);
        const buyer = await newBuyer('cv11c-g3');
        await withEventTablesSetting('event_tables.max_per_account', 2, async () => {
            const rush = await Promise.all([a.typeId, b.typeId, a.typeId].map((id) => tableCheckout(buyer, ev.eventId, id)));
            const won = rush.filter((r) => r.status === 200);
            assert.equal(won.length, 1, `un seul paiement en attente : ${rush.map(show).join(' | ')}`);
            assert.ok(rush.filter((r) => r.status !== 200).every((r) => r.status === 409 && r.body.code === 'PAYMENT_PENDING'), rush.map(show).join(' | '));
            const firstPaid = await confirmByWebhook(won[0].payment!);
            assert.equal(firstPaid.status, 'SUCCESS', JSON.stringify(firstPaid.metadata));
            const firstType = String(((firstPaid.metadata as Row).event_table as Row).type_id);
            const secondType = firstType === a.typeId ? b.typeId : a.typeId;
            await buyTable(buyer, ev.eventId, secondType);
            const otherPayer = randomSenegalPhone('76').slice(-9);
            for (const typeId of [a.typeId, b.typeId]) {
                const third = await tableCheckout(buyer, ev.eventId, typeId, { extra: { payerPhone: otherPayer } });
                assert.deepEqual([third.status, third.body.code], [409, 'TABLE_LIMIT'], `3e table (autre numéro payeur) : ${show(third)}`);
                assert.equal(third.payment, null, 'aucun paiement');
            }
            const { count } = await service.from('event_table_bookings').select('id', { count: 'exact', head: true })
                .eq('event_id', ev.eventId).eq('holder_id', buyer.userId).eq('status', 'ACTIVE');
            assert.equal(count, 2, 'deux tables au plus');
        });
    });

    test('G4 — paiement arrivé après l’annulation de l’événement, webhook rejoué : remboursé en entier une fois, aucune vente ni billet', async () => {
        const ev = await newTablesEvent(partner, 'cv-g4');
        const t = await createdTableType(partner, ev.eventId, vipType(), 1);
        const buyer = await newBuyer('cv11c-g4');
        const started = await tableCheckout(buyer, ev.eventId, t.typeId);
        assert.equal(started.status, 200, show(started));
        await cancelEvent(partner, ev.eventId, ev.title);
        const paid = await confirmByWebhook(started.payment!);
        assert.ok(['REFUND_PENDING', 'REFUNDED'].includes(String(paid.status)), `paiement sur événement annulé : ${paid.status}`);
        await deliverWebhook(paid);
        await service.rpc('payment_confirm', { p_payment_id: paid.id, p_source: 'TEST' });
        const refunds = await platformRefunds(paid.id);
        assert.deepEqual(refunds.map((r) => n(r.amount)), [n(paid.amount)], `un remboursement entier : ${JSON.stringify(refunds)}`);
        assert.equal(await bookingOfPayment(paid.id), null, 'aucune vente');
        const { data: tk } = await service.from('tickets').select('id').eq('payment_id', paid.id);
        assert.deepEqual(tk ?? [], [], 'aucun billet');
    });

    test('G5 — cloisonnement : autre organisatrice, types et tables d’un autre événement, invité, porte, données réduites, REST et schéma private', async () => {
        const ev = await newTablesEvent(partner, 'cv-g5');
        const t = await createdTableType(partner, ev.eventId, vipType(), 2);
        const holder = await newBuyer('cv11c-g5-titulaire', { lastName: 'Diopsecret' });
        const guest = await newBuyer('cv11c-g5-invite', { firstName: 'Fatou', lastName: 'Ndiayesecret' });
        const bought = await buyTable(holder, ev.eventId, t.typeId);
        const transferId = await transferSeat(String(bought.tickets[0].id), holder, guest.phoneE164);
        const { data: acc } = await service.rpc('ticket_transfer_accept', { p: { transfer_id: transferId, actor_id: guest.userId } });
        assert.equal((acc as Row).ok, true, JSON.stringify(acc));
        const pendingPhone = randomSenegalPhone('76');
        await transferSeat(String(bought.tickets[1].id), holder, pendingPhone);

        // Autre organisatrice : rien à lire ni à écrire
        const own = await newTablesEvent(other, 'cv-g5-autre');
        const ownType = await createdTableType(other, own.eventId, vipType(), 1);
        const cfg = await tablesConfig(other, ev.eventId);
        assert.equal(cfg.status, 404, `configuration d’un autre événement : ${show(cfg)}`);
        const tablesBefore = await tablesForSave(partner, ev.eventId);
        for (const r of [
            await saveTables(other, ev.eventId, { plan_enabled: false, tables: [], zones: [] }),
            await createTableType(other, ev.eventId, vipType(), 1),
            await patchTableType(other, ev.eventId, t.typeId, { name: 'Pris', price: 1 }),
            await deleteTableType(other, ev.eventId, t.typeId),
        ]) assert.ok([403, 404].includes(r.status), `écriture sur l’événement d’une autre : ${show(r)}`);
        assert.equal((await tablesForSave(partner, ev.eventId)).length, tablesBefore.length, 'tables inchangées');
        assert.equal(n((await categoryRow(t.typeId)).price), 150_000, 'prix inchangé');
        const door = await doorList(other, ev.eventId);
        assert.equal(door.status, 403, `porte d’un autre événement : ${show(door)}`);
        // Types, tables et zones d'un autre événement glissés dans son propre plan
        const injectType = await saveTables(other, own.eventId, { plan_enabled: false, tables: [...(await tablesForSave(other, own.eventId)), { type_id: t.typeId, number: 50 }], zones: [] });
        assert.deepEqual([injectType.status, injectType.body.code], [404, 'TABLE_TYPE_NOT_FOUND'], show(injectType));
        const injectTable = await saveTables(other, own.eventId, { plan_enabled: false, tables: [{ id: t.tables[1].id, type_id: ownType.typeId, number: 51 }], zones: [] });
        assert.ok([404].includes(injectTable.status) && ['TABLE_NOT_FOUND', 'TABLE_TYPE_NOT_FOUND'].includes(String(injectTable.body.code)), show(injectTable));
        const { data: zone, error: zErr } = await service.from('event_zones').insert({ event_id: ev.eventId, name: `Carré ${Date.now() % 1000}` }).select('id').single();
        if (!zErr && zone) {
            const injectZone = await saveTables(other, own.eventId, { plan_enabled: false, tables: await tablesForSave(other, own.eventId), zones: [{ id: zone.id, x: 0, y: 0, w: 50, h: 50 }] });
            assert.deepEqual([injectZone.status, injectZone.body.code], [404, 'ZONE_NOT_FOUND'], show(injectZone));
        }
        assert.equal((await tablesForSave(partner, ev.eventId)).length, tablesBefore.length, 'tables de la propriétaire inchangées');

        // « Ma table » : titulaire seulement ; invité 404 ; données réduites
        const guestView = await myTable(guest, String(bought.booking.id));
        assert.equal(guestView.status, 404, `l’invité ne voit pas la table : ${show(guestView)}`);
        const guestList = await myTables(guest);
        assert.deepEqual(guestList.body.items ?? [], [], `l’invité n’a aucune table : ${show(guestList)}`);
        const mine = await myTable(holder, String(bought.booking.id));
        assert.equal(mine.status, 200, show(mine));
        const text = JSON.stringify(mine.body);
        assert.ok(text.includes('Fatou N.'), `invité en prénom et initiale : ${text.slice(0, 400)}`);
        assert.ok(!text.includes('Ndiayesecret') && !text.includes(guest.phone9) && !text.includes(pendingPhone.slice(4, 11)), `aucune donnée de trop : ${text.slice(0, 600)}`);
        assert.ok(text.includes(`•• ${pendingPhone.slice(-2)}`), `numéro en attente réduit à 2 chiffres : ${text.slice(0, 600)}`);
        const wa = String((mine.body.table as Row).whatsapp_url ?? '');
        assert.ok(!/token|[?&]t=|claim|transfer/i.test(decodeURIComponent(wa)), `lien WhatsApp sans jeton : ${wa}`);
        const ownerDoor = await doorList(partner, ev.eventId);
        assert.equal(ownerDoor.status, 200, show(ownerDoor));
        const doorText = JSON.stringify(ownerDoor.body);
        assert.ok(!doorText.includes('Diopsecret') && !doorText.includes('Ndiayesecret') && !doorText.includes(holder.phone9) && !doorText.includes(guest.phone9), `porte : prénom et initiale seulement : ${doorText.slice(0, 400)}`);

        // REST : clé anon, jeton d'un client, de l'invité et de l'autre organisatrice
        const problems: string[] = [];
        for (const [who, token] of [['anon', undefined], ['titulaire', holder.accessToken], ['invité', guest.accessToken], ['autre organisatrice', other.accessToken]] as const) {
            const db = restClient(token);
            for (const table of ['event_tables', 'event_table_plans', 'event_table_bookings'] as const) {
                const { data } = await db.from(table).select('*').eq('event_id', ev.eventId);
                if ((data ?? []).length) problems.push(`${who} lit ${table}`);
            }
            const { error: insErr } = await db.from('event_table_bookings').insert({
                event_id: ev.eventId, event_table_id: t.tables[1].id, category_id: t.typeId, payment_id: bought.payment.id,
                holder_id: holder.userId, seats: 6, table_number: 2,
            });
            if (!insErr) problems.push(`${who} insère une vente`);
            const { data: upd } = await db.from('event_tables').update({ number: 77 }).eq('id', t.tables[1].id).select('id');
            if ((upd ?? []).length) problems.push(`${who} renumérote une table`);
            const { data: tk } = await db.from('tickets').update({ event_table_booking_id: null }).eq('id', String(bought.tickets[2].id)).select('id');
            if ((tk ?? []).length) problems.push(`${who} détache une place`);
            const { error: privErr } = await db.schema('private').rpc('event_table_issue', { p_payment: bought.payment.id, p_reservation: randomUUID(), p_holder: holder.userId });
            if (!privErr) problems.push(`${who} appelle private.event_table_issue`);
        }
        const { error: svcPriv } = await service.schema('private').rpc('event_table_checkout', { p: {} });
        if (!svcPriv) problems.push('clé de service : private.event_table_checkout appelée');
        const { error: svcIssue } = await service.schema('private').rpc('event_table_issue', { p_payment: bought.payment.id, p_reservation: randomUUID(), p_holder: holder.userId });
        if (!svcIssue) problems.push('clé de service : private.event_table_issue appelée');
        assert.deepEqual(problems, []);
        assert.equal((await ticketsOfBooking(String(bought.booking.id))).length, 6, 'places toujours reliées');
    });

    test('G6 — prix et places figés dès la première attente (route, clé de service) ; table en attente jamais retirée', async () => {
        const ev = await newTablesEvent(partner, 'cv-g6');
        const t = await createdTableType(partner, ev.eventId, vipType(), 2);
        const buyer = await newBuyer('cv11c-g6');
        const started = await tableCheckout(buyer, ev.eventId, t.typeId);
        assert.equal(started.status, 200, show(started));
        try {
            for (const patch of [{ price: 100_000 }, { seats: 8 }]) {
                const r = await patchTableType(partner, ev.eventId, t.typeId, patch);
                assert.deepEqual([r.status, r.body.code], [409, 'PRICE_LOCKED_AFTER_SALES'], `${JSON.stringify(patch)} : ${show(r)}`);
            }
            const { error: direct } = await service.from('ticket_categories').update({ price: 1 }).eq('id', t.typeId);
            assert.ok(direct, 'clé de service : prix refusé');
            const { error: direct2 } = await service.from('ticket_categories').update({ seats_per_unit: 2 }).eq('id', t.typeId);
            assert.ok(direct2, 'clé de service : places refusées');
            const all = await tablesForSave(partner, ev.eventId);
            const held = String((started.body.table as Row).id);
            const removed = await saveTables(partner, ev.eventId, { plan_enabled: false, tables: all.filter((x) => x.id !== held), zones: [] });
            assert.deepEqual([removed.status, removed.body.code], [409, 'TABLE_SOLD'], show(removed));
            const row = await categoryRow(t.typeId);
            assert.deepEqual([n(row.price), n(row.seats_per_unit), n(row.total_quantity)], [150_000, 6, 2], 'type inchangé');
        } finally {
            await service.rpc('payment_release', { p_payment_id: started.payment!.id, p_status: 'FAILED', p_reason: 'cv11c G6' });
        }
    });

    test('G7 — ADMIN_EVENT_TABLES_CHANGED : une alerte par enregistrement (par administrateur et canal), retrait signalé, jamais ADMIN_EVENT_CHANGED', async () => {
        const ev = await newTablesEvent(partner, 'cv-g7');
        const ticketAlerts = (await outbox({ type: 'ADMIN_EVENT_CHANGED', eventId: ev.eventId })).length;
        const counts = async (): Promise<Map<string, number>> => {
            const m = new Map<string, number>();
            for (const r of await outbox({ type: 'ADMIN_EVENT_TABLES_CHANGED', eventId: ev.eventId })) {
                const k = `${String(r.recipient_user_id)}:${String(r.channel)}`;
                m.set(k, (m.get(k) ?? 0) + 1);
            }
            return m;
        };
        const allEqual = (m: Map<string, number>, v: number): boolean => m.size > 0 && [...m.values()].every((c) => c === v);
        const first = await createdTableType(partner, ev.eventId, vipType(), 3);
        const c1 = await counts();
        assert.ok(allEqual(c1, 1), `création d’un type et de 3 tables : une alerte par destinataire et canal : ${JSON.stringify([...c1])}`);
        const extra = await createdTableType(partner, ev.eventId, vipType({ price: 90_000 }), 1);
        const c2 = await counts();
        assert.ok(allEqual(c2, 2), `2e enregistrement : ${JSON.stringify([...c2])}`);
        const tables = await tablesForSave(partner, ev.eventId);
        const plan = await saveTables(partner, ev.eventId, {
            plan_enabled: false, zones: [],
            tables: [...tables.map((x) => (x.id === first.tables[0].id ? { ...x, number: 40 } : x)), { type_id: first.typeId, number: 41 }, { type_id: first.typeId, number: 42 }],
        });
        assert.equal(plan.status, 200, show(plan));
        const c3 = await counts();
        assert.ok(allEqual(c3, 3), `plan : 1 renumérotation + 2 ajouts en un enregistrement : ${JSON.stringify([...c3])}`);
        const del = await deleteTableType(partner, ev.eventId, extra.typeId);
        assert.equal(del.status, 200, show(del));
        const c4 = await counts();
        assert.ok(allEqual(c4, 4), `retrait d’un type signalé une fois : ${JSON.stringify([...c4])}`);
        assert.equal((await outbox({ type: 'ADMIN_EVENT_CHANGED', eventId: ev.eventId })).length, ticketAlerts, 'aucune alerte de catégorie de billets');
    });

    test('G8 — interrupteur fermé : devis, achat, création, modification et plan refusés (404) ; offre vide', async () => {
        const ev = await newTablesEvent(partner, 'cv-g8');
        const t = await createdTableType(partner, ev.eventId, vipType(), 1);
        const buyer = await newBuyer('cv11c-g8');
        await setEventTablesSetting('features.event_tables_enabled', false, 'cv11c G8');
        try {
            const quote = await tableQuote(ev.eventId, { typeId: t.typeId });
            const buy = await tableCheckout(buyer, ev.eventId, t.typeId);
            const add = await createTableType(partner, ev.eventId, vipType(), 1);
            const patch = await patchTableType(partner, ev.eventId, t.typeId, { name: 'Fermé' });
            const plan = await saveTables(partner, ev.eventId, { plan_enabled: false, tables: [], zones: [] });
            for (const [what, r] of [['devis', quote], ['achat', buy], ['création', add], ['modification', patch], ['plan', plan]] as const) {
                assert.deepEqual([r.status, r.body.code], [404, 'SERVICE_UNAVAILABLE'], `${what} service fermé : ${show(r)}`);
            }
            assert.equal(buy.payment, null, 'aucun paiement');
            const offer = await tableOffer(ev.eventId);
            assert.deepEqual([offer.body.open, offer.body.types], [false, []], show(offer));
            assert.equal(n((await categoryRow(t.typeId)).total_quantity), 1, 'table intacte');
        } finally {
            await setEventTablesSetting('features.event_tables_enabled', true, 'cv11c G8 : réouverture');
        }
    });

    test('G9 — deux tables du même type par le même compte (maximum 2) : la 2e est vendue, pas remboursée comme un paiement en double', async () => {
        const ev = await newTablesEvent(partner, 'cv-g9');
        const t = await createdTableType(partner, ev.eventId, vipType(), 3);
        const buyer = await newBuyer('cv11c-g9');
        await withEventTablesSetting('event_tables.max_per_account', 2, async () => {
            const first = await buyTable(buyer, ev.eventId, t.typeId);
            const started = await tableCheckout(buyer, ev.eventId, t.typeId);
            assert.equal(started.status, 200, `2e table acceptée à l’achat (limite 2) : ${show(started)}`);
            const second = await confirmByWebhook(started.payment!);
            const { data: booking } = await service.from('event_table_bookings').select('id, status').eq('payment_id', second.id).maybeSingle();
            const { data: alerts } = await service.from('notification_outbox').select('id').eq('type', 'ADMIN_DUPLICATE_PAYMENT')
                .contains('template_data', { payment_id: second.id });
            assert.deepEqual(
                { status: second.status, booking: booking?.status ?? null, duplicate_of: (second.metadata as Row).duplicate_of ?? null, admin_alerts: (alerts ?? []).length },
                { status: 'SUCCESS', booking: 'ACTIVE', duplicate_of: null, admin_alerts: 0 },
                `2e table du même type : paiement ${second.status} (1re table : paiement ${first.payment.id})`,
            );
        });
    });
});
