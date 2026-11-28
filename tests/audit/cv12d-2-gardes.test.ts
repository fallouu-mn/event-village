/**
 * Contre-vérification du lot 12d — GARDE-FOUS (branche lot12d/cv-rouges, jamais fusionnée). Vert = attaque bloquée.
 * Base LOCALE, faux SamirPay, faux SMS. Montants calculés à la main ; chaque test remet en état pauses et fermetures.
 *
 *  G1. Décision sur une absence et remise tardive avec le code, en même temps : jamais les deux (remise sans
 *      remboursement, ou décision et remise refusée).
 *  G2. Décision et « Annuler et rembourser » de l'administration en même temps : une seule passe, un seul remboursement.
 *  G3. Décision après une annulation : NO_ABSENCE ; « tout » et « rien » en même temps : une seule décision.
 *  G4. Montants : part de 33 % arrondie au franc, aperçu = remboursement = montant noté ; acompte : jamais au-delà du
 *      payé ; parts invalides refusées (0, 100, 50,5, « 1e1 », « 50 » avec espace, -1, absente).
 *  G5. Annulations du client, de la partenaire et de l'administration en même temps : une seule passe, un remboursement.
 *  G6. Paiement débité chez l'opérateur, confirmé après une fermeture posée sur l'heure : remboursé une fois, commande
 *      jamais transmise, deuxième rappel sans doublon.
 *  G7. Pause : création par la route refusée (aucune commande), autre établissement non touché, commande acceptée
 *      avant la pause qui avance pendant la pause.
 *  G8. order_watch_tick lancée deux fois en même temps : un avis à l'équipe, un avis au livreur, une étape.
 *  G9. Deux touches « Appeler » en même temps : un seul appel compté.
 *  G10. Reste en espèces : refusé à un autre livreur de l'équipe, noté par la partenaire, une fois, aucune écriture
 *       d'argent d'Event Village.
 *  G11. Remise possible pendant la décision de l'équipe (sortie de « À décider »), plus après la décision.
 *  G12. Accès : invité non accepté (ni confié, ni lecture) ; signalement par le livreur, après 48 h, au-delà de 3.
 *  G13. REST (clé anon, jeton d'un client) : allergènes, signalements, commandes gardées, pause de l'établissement.
 *  G14. « Garder » une commande d'un autre établissement de la même partenaire : refusé.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { POST as quoteRoute } from '../../app/api/orders/quote/route';
import { POST as issuePost } from '../../app/api/orders/[id]/issue/route';
import { GET as courierOrderGet } from '../../app/api/courier/orders/[id]/route';
import { POST as closureOrdersPost } from '../../app/api/partner/venues/closures/[id]/orders/route';
import { assertLot12aInvariants } from '../helpers/lot12a-invariants';
import { deliverWebhook, newBuyer, paymentById, providerSays } from '../parcours/paiement-helpers';
import {
    codeOf, courierAct, n, newProduct, newShop, openOrdersService, order, orderBody, orderRoute, partnerAct, payOrder,
    placed, releaseUnpaid, service, startOrderPay, toReady, userClient, type Row,
} from '../parcours/l12a-helpers';
import { buildWorld, closeIfOpen, ctx, delivered, delivery, escalated, reply, req, rpc, sql, twoCalls, type World } from './cv12d-aides';

let restore: () => Promise<void>;
let w: World;

before(async () => {
    restore = await openOrdersService();
    w = await buildWorld('gardes');
});

after(async () => {
    await restore();
    await assertLot12aInvariants('cv12d-2-gardes');
});

async function refundAmounts(orderId: string): Promise<number[]> {
    const rows = await sql<{ amount: string }>(
        `SELECT f.amount FROM public.refunds f JOIN public.payments p ON p.id = f.payment_id WHERE p.order_id = $1 ORDER BY f.amount`, [orderId]);
    return rows.map((r) => n(r.amount));
}
const decide = (p: Row) => service.rpc('order_absence_decide', { p });
const okOf = (r: { data: unknown; error: unknown }) => (r.data as Row | null)?.ok === true;

describe('G1-G4. Décision sur une absence : argent', () => {
    test('G1. décision « tout » et remise avec le code en même temps : jamais les deux', async () => {
        const id = await escalated(w);
        const code = await codeOf(w.client, id);
        // 4 000 + zone 1 000 = 5 000 ; frais 5 % = 250 ; payé 5 250
        const [d, h] = await Promise.all([
            decide({ actor_id: w.adminRefund.userId, order_id: id, decision: 'TOUT', reason: 'Client injoignable', expected_amount: 5_250 }),
            courierAct(w.courier, id, { action: 'REMETTRE', code }),
        ]);
        const o = await order(id);
        const refunds = await refundAmounts(id);
        const trace = JSON.stringify({ decision: d.data ?? d.error, remise: [h.status, h.body.code], etat: o.order_state, refunds });
        assert.equal(okOf(d) !== (h.status === 200), true, `une seule des deux passe : ${trace}`);
        if (o.order_state === 'REMISE') assert.deepEqual(refunds, [], `remise : aucun remboursement ; ${trace}`);
        else assert.deepEqual([o.order_state, refunds], ['NON_RETIREE', [5_250]], trace);
    });

    test('G2. décision et « Annuler et rembourser » en même temps : une seule passe, un seul remboursement', async () => {
        const id = await escalated(w);
        const [d, c] = await Promise.all([
            decide({ actor_id: w.adminRefund.userId, order_id: id, decision: 'PART', percent: 50, reason: 'Client rappelé', expected_amount: 2_625 }),
            service.rpc('order_cancel', { p: { order_id: id, actor_id: w.adminRefund.userId, origin: 'EVENT_VILLAGE', reason: 'Erreur de l’établissement', partner_fault: true } }),
        ]);
        const refunds = await refundAmounts(id);
        const trace = JSON.stringify({ decision: d.data ?? d.error, annulation: c.data ?? c.error, refunds });
        assert.equal([okOf(d), okOf(c)].filter(Boolean).length, 1, trace);
        assert.equal(refunds.length, 1, trace);
        assert.ok(refunds[0] === 2_625 || refunds[0] === 5_250, trace);
    });

    test('G3. décision après une annulation : NO_ABSENCE ; « tout » et « rien » en même temps : une seule décision', async () => {
        const id = await escalated(w);
        const c = await rpc('order_cancel', { order_id: id, actor_id: w.adminRefund.userId, origin: 'EVENT_VILLAGE', reason: 'Annulée par l’équipe', partner_fault: false });
        assert.equal(c.ok, true, JSON.stringify(c));
        const late = await rpc('order_absence_decide', { actor_id: w.adminRefund.userId, order_id: id, decision: 'RIEN', reason: 'Trop tard', expected_amount: 0 });
        assert.equal(late.code, 'NO_ABSENCE', JSON.stringify(late));
        assert.deepEqual(await refundAmounts(id), [5_250], 'un seul remboursement (celui de l’annulation)');

        const id2 = await escalated(w);
        const both = await Promise.all([
            decide({ actor_id: w.adminRefund.userId, order_id: id2, decision: 'TOUT', reason: 'Client injoignable', expected_amount: 5_250 }),
            decide({ actor_id: w.adminRefund.userId, order_id: id2, decision: 'RIEN', reason: 'Client injoignable', expected_amount: 0 }),
        ]);
        const refunds = await refundAmounts(id2);
        const o = await order(id2);
        const trace = JSON.stringify({ r: both.map((r) => r.data ?? r.error), refunds, decision: o.absent_decision });
        assert.equal(both.filter(okOf).length, 1, trace);
        assert.deepEqual(refunds, o.absent_decision === 'TOUT' ? [5_250] : [], trace);
    });

    test('G4. part de 33 % arrondie au franc ; acompte : jamais au-delà du payé ; parts invalides refusées', async () => {
        const id = await escalated(w, { price: 4_010 });
        // 4 010 + zone 1 000 = 5 010 ; frais 5 % = 250,5 arrondis au franc supérieur = 251 ; payé 5 261 ; 33 % = 1 736,13 → 1 736
        const pv = await rpc('order_absence_decide', { actor_id: w.adminRefund.userId, order_id: id, decision: 'PART', percent: 33, reason: 'x', preview: true });
        assert.deepEqual([pv.ok, n(pv.paid), n(pv.refund_amount)], [true, 5_261, 1_736], JSON.stringify(pv));
        for (const percent of [0, 100, 50.5, '1e1', ' 50', -1, null, '33%']) {
            const r = await rpc('order_absence_decide', { actor_id: w.adminRefund.userId, order_id: id, decision: 'PART', percent, reason: 'Essai', preview: true });
            assert.equal(r.code, 'INVALID_PERCENT', `part ${JSON.stringify(percent)} : ${JSON.stringify(r)}`);
        }
        const wrong = await rpc('order_absence_decide', { actor_id: w.adminRefund.userId, order_id: id, decision: 'PART', percent: 33, reason: 'Client rappelé', expected_amount: '1736.13' });
        assert.equal(wrong.code, 'AMOUNT_CHANGED', JSON.stringify(wrong));
        const ok = await rpc('order_absence_decide', { actor_id: w.adminRefund.userId, order_id: id, decision: 'PART', percent: 33, reason: 'Client rappelé', expected_amount: 1_736 });
        assert.equal(ok.ok, true, JSON.stringify(ok));
        const o = await order(id);
        assert.deepEqual([await refundAmounts(id), n(o.refunded_amount), n(o.refund_percent)], [[1_736], 1_736, 33]);

        const dep = await escalated(w, { price: 5_000, payment: 'ACOMPTE' });
        // 5 000 + zone 1 000 = 6 000 ; acompte 30 % = 1 800 ; frais 5 % de 1 800 = 90 ; payé en ligne 1 890 ; reste 4 200 en espèces
        const all = await rpc('order_absence_decide', { actor_id: w.adminRefund.userId, order_id: dep, decision: 'TOUT', reason: 'x', preview: true });
        assert.deepEqual([n(all.paid), n(all.refund_amount)], [1_890, 1_890], JSON.stringify(all));
        const done = await rpc('order_absence_decide', { actor_id: w.adminRefund.userId, order_id: dep, decision: 'TOUT', reason: 'Client injoignable', expected_amount: 1_890 });
        assert.equal(done.ok, true, JSON.stringify(done));
        const od = await order(dep);
        assert.deepEqual([await refundAmounts(dep), n(od.refunded_amount), od.onsite_amount], [[1_890], 1_890, null], 'reste en espèces jamais rendu ni noté');
    });
});

describe('G5-G6. Annulations et paiement refusé', () => {
    test('G5. annulations du client, de la partenaire et de l’administration en même temps : une seule passe', async () => {
        const p = await newProduct(w.partner, w.shop, { price: 3_000 });
        const id = await placed(w.client, orderBody(w.shop, [{ productId: p, quantity: 1 }]));
        await payOrder(w.client, id);
        // 3 000 ; frais 5 % = 150 ; payé 3 150
        const all = await Promise.all([
            service.rpc('order_cancel', { p: { order_id: id, actor_id: w.client.userId, origin: 'CLIENT' } }),
            service.rpc('order_cancel', { p: { order_id: id, actor_id: w.partner.userId, origin: 'PARTENAIRE', reason: 'Rupture de stock' } }),
            service.rpc('order_cancel', { p: { order_id: id, actor_id: w.adminRefund.userId, origin: 'EVENT_VILLAGE', reason: 'Annulée par l’équipe' } }),
        ]);
        const trace = JSON.stringify(all.map((r) => r.data ?? r.error));
        assert.equal(all.filter(okOf).length, 1, trace);
        assert.deepEqual(await refundAmounts(id), [3_150], trace);
    });

    test('G6. paiement débité, confirmé après une fermeture posée sur l’heure : remboursé une fois, jamais transmis', async () => {
        const venue = await newShop(w.partner);
        const p = await newProduct(w.partner, venue, { price: 2_000 });
        const day = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
        const id = await placed(w.client, orderBody(venue, [{ productId: p, quantity: 1 }], { scheduledFor: `${day}T12:00` }));
        const started = await startOrderPay(w.client, id);
        assert.equal(started.status, 201, JSON.stringify(started.body));
        const { data: closure, error } = await service.from('venue_closures')
            .insert({ venue_id: venue, starts_at: `${day}T11:00:00`, ends_at: `${day}T14:00:00`, reason: 'Coupure d’électricité', created_by: w.partner.userId })
            .select('id').single();
        assert.equal(error, null, error?.message);
        try {
            providerSays(started.payment!, 'SUCCESS');
            const hooks = [(await deliverWebhook(started.payment!)).status, (await deliverWebhook(started.payment!)).status];
            const pay = await paymentById(started.payment!.id);
            const cash = await sql<{ c: string; amount: string }>(
                `SELECT count(*)::text AS c, COALESCE(sum(amount), 0)::text AS amount FROM public.cashouts WHERE payment_id = $1`, [started.payment!.id]);
            const o = await order(id);
            // 2 000 ; frais 5 % = 100 ; débité 2 100
            const trace = JSON.stringify({ hooks, status: pay.status, cash: cash[0], etat: o.order_state });
            assert.ok(['REFUND_PENDING', 'REFUNDED'].includes(String(pay.status)), trace);
            assert.deepEqual([cash[0].c, n(cash[0].amount), o.order_state, o.received_at ?? null], ['1', 2_100, 'EN_ATTENTE_PAIEMENT', null],
                `remboursé une fois, commande jamais transmise : ${trace}`);
        } finally {
            await sql(`UPDATE public.venue_closures SET cancelled_at = now() WHERE id = $1`, [closure!.id]);
            await releaseUnpaid(w.client.userId);
        }
    });
});

describe('G7. Pause', () => {
    test('création refusée par la route ; autre établissement non touché ; commande acceptée avant la pause qui avance', async () => {
        const venue = await newShop(w.partner);
        const other = await newShop(w.partner);
        const p = await newProduct(w.partner, venue, { price: 1_500 });
        const po = await newProduct(w.partner, other, { price: 1_500 });
        const accepted = await placed(w.client, orderBody(venue, [{ productId: p, quantity: 1 }]));
        await payOrder(w.client, accepted);
        assert.equal((await partnerAct(w.partner, accepted, { action: 'ACCEPTER' })).status, 200);
        assert.equal((await rpc('order_venue_pause', { actor_id: w.partner.userId, venue_id: venue, minutes: 15 })).ok, true);
        try {
            const before = await sql<{ c: string }>(`SELECT count(*)::text AS c FROM public.orders WHERE venue_id = $1`, [venue]);
            const created = await orderRoute(w.client, orderBody(venue, [{ productId: p, quantity: 1 }]));
            assert.deepEqual([created.status, created.body.code], [409, 'ORDERS_PAUSED'], JSON.stringify(created.body));
            const later = await orderRoute(w.client, orderBody(venue, [{ productId: p, quantity: 1 }],
                { scheduledFor: `${new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10)}T12:00` }));
            assert.equal(later.body.code, 'ORDERS_PAUSED', `commande programmée pour plus tard pendant la pause : ${JSON.stringify(later.body)}`);
            const after = await sql<{ c: string }>(`SELECT count(*)::text AS c FROM public.orders WHERE venue_id = $1`, [venue]);
            assert.equal(after[0].c, before[0].c, 'aucune commande écrite pendant la pause');
            const q = await reply(await quoteRoute(req('/api/orders/quote', 'POST', w.client.accessToken, orderBody(other, [{ productId: po, quantity: 1 }]))));
            assert.equal(q.status, 200, `autre établissement : ${q.text}`);
            assert.equal((await partnerAct(w.partner, accepted, { action: 'PREPARER' })).status, 200, 'commande acceptée avant la pause : elle avance');
        } finally {
            assert.equal((await rpc('order_venue_pause', { actor_id: w.partner.userId, venue_id: venue, minutes: 0 })).ok, true);
            await closeIfOpen(w, accepted);
            await releaseUnpaid(w.client.userId);
        }
    });
});

describe('G8-G11. Client absent et reste en espèces', () => {
    test('G8. deux order_watch_tick en même temps : un avis à l’équipe, un au livreur, une étape', async () => {
        const id = await delivered(w);
        await twoCalls(w.courier, id);
        assert.equal((await courierAct(w.courier, id, { action: 'ABSENT' })).status, 200);
        await sql(`UPDATE public.orders SET absent_wait_until = now() - interval '1 minute' WHERE id = $1`, [id]);
        const both = await Promise.all([service.rpc('order_watch_tick'), service.rpc('order_watch_tick')]);
        assert.deepEqual(both.map((r) => r.error), [null, null], JSON.stringify(both.map((r) => r.error)));
        const admin = await sql<{ channel: string }>(`SELECT channel FROM public.notification_outbox WHERE recipient_user_id = $1 AND type = 'ADMIN_ORDER_ABSENT' AND idempotency_key LIKE $2 ORDER BY channel`,
            [w.adminRefund.userId, `%${id}%`]);
        const back = await sql<{ channel: string }>(`SELECT channel FROM public.notification_outbox WHERE recipient_user_id = $1 AND type = 'ORDER_COURIER_RETURN' AND idempotency_key LIKE $2 ORDER BY channel`,
            [w.courier.userId, `%${id}%`]);
        const steps = await sql<{ c: string }>(`SELECT count(*)::text AS c FROM public.order_state_history WHERE order_id = $1 AND note LIKE 'Client toujours absent%'`, [id]);
        assert.deepEqual([admin.map((r) => r.channel), back.map((r) => r.channel), steps[0].c], [['EMAIL', 'IN_APP'], ['IN_APP', 'PUSH'], '1']);
        await closeIfOpen(w, id);
    });

    test('G9. deux touches « Appeler » en même temps : un seul appel compté', async () => {
        const id = await delivered(w);
        const both = await Promise.all([courierAct(w.courier, id, { action: 'APPEL' }), courierAct(w.courier, id, { action: 'APPEL' })]);
        assert.deepEqual(both.map((r) => r.status), [200, 200]);
        assert.equal(n((await order(id)).delivery_calls), 1);
        await closeIfOpen(w, id);
    });

    test('G10. reste en espèces : refusé à un autre livreur de l’équipe, noté par la partenaire, une fois, aucune écriture d’argent', async () => {
        const id = await delivered(w, { payment: 'ACOMPTE', price: 5_000 });
        // 5 000 + zone 1 000 = 6 000 ; acompte 30 % = 1 800 (+ frais 90) ; reste 4 200
        const code = await codeOf(w.client, id);
        const other = await courierAct(w.courier2, id, { action: 'REMETTRE', code, balanceReceived: true });
        assert.equal(other.status, 404, `autre livreur de l’équipe : ${JSON.stringify(other.body)}`);
        const pays = await sql<{ id: string }>(`SELECT id FROM public.payments WHERE order_id = $1`, [id]);
        assert.equal(pays.length, 1, 'le seul paiement en ligne : l’acompte');
        const done = await partnerAct(w.partner, id, { action: 'REMETTRE', code, balanceReceived: true });
        assert.equal(done.status, 200, JSON.stringify(done.body));
        const again = await partnerAct(w.partner, id, { action: 'REMETTRE', code, balanceReceived: true });
        assert.equal(again.status, 409, JSON.stringify(again.body));
        const o = await order(id);
        const after = await sql<{ p: string; c: string }>(
            `SELECT (SELECT count(*) FROM public.payments WHERE order_id = $1)::text AS p,
                    (SELECT count(*) FROM public.cashouts c JOIN public.payments p ON p.id = c.payment_id WHERE p.order_id = $1)::text AS c`, [id]);
        // Aucune écriture du grand livre pour le reste encaissé en espèces (4 200)
        const cashLedger = await sql<{ c: string }>(
            `SELECT count(*)::text AS c FROM public.finance_ledger l JOIN public.payments p ON p.id = l.payment_id WHERE p.order_id = $1 AND abs(l.amount) = 4200`, [id]);
        assert.deepEqual([o.order_state, n(o.onsite_amount), o.onsite_recorded_by, after[0].p, after[0].c, cashLedger[0].c],
            ['REMISE', 4_200, w.partner.userId, '1', '0', '0']);
    });

    test('G11. remise encore possible pendant la décision de l’équipe, plus après la décision', async () => {
        const id = await escalated(w);
        const code = await codeOf(w.client, id);
        assert.equal((await courierAct(w.courier, id, { action: 'REMETTRE', code })).status, 200, 'le client revient : remise');
        const v = await rpc('order_admin_view', { actor_id: w.adminRefund.userId, order_id: id });
        assert.equal((v.order as Row).can_decide_absence, false);
        const list = await rpc('order_admin_list', { actor_id: w.adminRefund.userId, group: 'A_DECIDER', q: String((v.order as Row).order_number) });
        assert.equal(((list.items as Row[]) ?? []).length, 0, 'plus dans « À décider »');

        const id2 = await escalated(w);
        const code2 = await codeOf(w.client, id2);
        assert.equal((await rpc('order_absence_decide', { actor_id: w.adminRefund.userId, order_id: id2, decision: 'RIEN', reason: 'Client injoignable', expected_amount: 0 })).ok, true);
        const late = await courierAct(w.courier, id2, { action: 'REMETTRE', code: code2 });
        assert.notEqual(late.status, 200, `remise après la décision : ${JSON.stringify(late.body)}`);
        assert.equal((await order(id2)).order_state, 'NON_RETIREE');
    });
});

describe('G12-G14. Accès', () => {
    test('G12. invité non accepté : ni confié ni lecture ; signalement : livreur, après 48 h, au-delà de 3', async () => {
        const invited = await newBuyer('cv12d-invite', { firstName: 'Aminata', lastName: 'Faye' });
        const inv = await rpc('order_courier_invite', { actor_id: w.partner.userId, phone: invited.phoneE164 });
        assert.equal(inv.ok, true, JSON.stringify(inv));
        const prod = await newProduct(w.partner, w.shop, { price: 4_000 });
        const id = await placed(w.client, orderBody(w.shop, [{ productId: prod, quantity: 1 }], { ...delivery(w), payment: 'INTEGRAL' }));
        await payOrder(w.client, id);
        await toReady(w.partner, id);
        const give = await partnerAct(w.partner, id, { action: 'CONFIER', courierId: invited.userId });
        assert.notEqual(give.status, 200, `confiée à un invité non accepté : ${JSON.stringify(give.body)}`);
        assert.equal((await reply(await courierOrderGet(req(`/api/courier/orders/${id}`, 'GET', invited.accessToken), ctx(id)))).status, 404);
        assert.equal((await courierAct(invited, id, { action: 'APPEL' })).status, 404);

        const post = async (who: string, oid: string, body: Row) => reply(await issuePost(req(`/api/orders/${oid}/issue`, 'POST', who, body), ctx(oid)));
        assert.equal((await post(w.courier.accessToken, id, { reason: 'RETARD' })).status, 404, 'signalement par le livreur');
        for (let i = 0; i < 3; i += 1) {
            const r = await post(w.client.accessToken, id, { reason: 'RETARD' });
            assert.equal(r.status, 201, r.text);
            const close = await rpc('order_issue_close', { actor_id: w.adminRefund.userId, issue_id: (r.body.issue as Row).id, note: 'Le livreur arrive' });
            assert.equal(close.ok, true, JSON.stringify(close));
        }
        const fourth = await post(w.client.accessToken, id, { reason: 'RETARD' });
        assert.deepEqual([fourth.status, fourth.body.code], [409, 'TOO_MANY_ISSUES'], fourth.text);
        assert.equal((await partnerAct(w.partner, id, { action: 'CONFIER', courierId: w.courier.userId })).status, 200);
        assert.equal((await courierAct(w.courier, id, { action: 'EN_ROUTE', minutes: 20 })).status, 200);
        assert.equal((await courierAct(w.courier, id, { action: 'REMETTRE', code: await codeOf(w.client, id) })).status, 200);

        const id2 = await delivered(w);
        assert.equal((await courierAct(w.courier, id2, { action: 'REMETTRE', code: await codeOf(w.client, id2) })).status, 200);
        await sql(`UPDATE public.orders SET handed_over_at = now() - interval '49 hours' WHERE id = $1`, [id2]);
        const late = await post(w.client.accessToken, id2, { reason: 'INCOMPLETE' });
        assert.deepEqual([late.status, late.body.code], [409, 'ISSUE_TOO_LATE'], late.text);
        await sql(`UPDATE public.orders SET handed_over_at = now() - interval '47 hours' WHERE id = $1`, [id2]);
        assert.equal((await post(w.client.accessToken, id2, { reason: 'INCOMPLETE' })).status, 201, 'avant 48 h : accepté');
        const open = await sql<{ id: string }>(`SELECT id FROM public.order_issues WHERE order_id = $1 AND status = 'OUVERT'`, [id2]);
        await rpc('order_issue_close', { actor_id: w.adminRefund.userId, issue_id: open[0].id, note: 'Fin du test de la contre-vérification' });
        await rpc('order_courier_remove', { actor_id: w.partner.userId, courier_id: invited.userId });
    });

    test('G13. REST (clé anon, jeton d’un client) : allergènes, signalements, commandes gardées, pause fermés', async () => {
        const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
        const me = userClient(w.client.accessToken);
        const reads: Array<[string, string, string]> = [
            ['anon', 'products', 'id, allergens, spice_level'], ['client', 'products', 'id, allergens'],
            ['anon', 'order_issues', 'id'], ['client', 'order_issues', 'id, details'],
            ['anon', 'order_closure_keeps', 'order_id'], ['client', 'order_closure_keeps', 'order_id'],
            ['anon', 'venues', 'id, orders_paused_until'], ['client', 'venues', 'id, orders_paused_by'],
        ];
        const open: string[] = [];
        for (const [who, table, cols] of reads) {
            const r = await (who === 'anon' ? anon : me).from(table).select(cols).limit(1);
            if (!r.error) open.push(`${who} ${table}(${cols}) : ${JSON.stringify(r.data)}`);
        }
        assert.deepEqual(open, [], open.join(' ; '));
    });

    test('G14. « Garder » une commande d’un autre établissement de la même partenaire : refusé', async () => {
        const v1 = await newShop(w.partner);
        const v2 = await newShop(w.partner);
        const p2 = await newProduct(w.partner, v2, { price: 2_000 });
        const day = new Date(Date.now() + 4 * 86_400_000).toISOString().slice(0, 10);
        const id = await placed(w.client, orderBody(v2, [{ productId: p2, quantity: 1 }], { scheduledFor: `${day}T12:00` }));
        await payOrder(w.client, id);
        const { data: closure, error } = await service.from('venue_closures')
            .insert({ venue_id: v1, starts_at: `${day}T11:00:00`, ends_at: `${day}T14:00:00`, reason: 'Inventaire', created_by: w.partner.userId })
            .select('id').single();
        assert.equal(error, null, error?.message);
        try {
            const cid = String(closure!.id);
            const keep = await reply(await closureOrdersPost(req(`/api/partner/venues/closures/${cid}/orders`, 'POST', w.partner.accessToken, { orderId: id }), ctx(cid)));
            assert.equal(keep.status, 404, keep.text);
            const kept = await sql<{ c: string }>(`SELECT count(*)::text AS c FROM public.order_closure_keeps WHERE order_id = $1`, [id]);
            assert.equal(kept[0].c, '0');
        } finally {
            await sql(`UPDATE public.venue_closures SET cancelled_at = now() WHERE id = $1`, [closure!.id]);
            await closeIfOpen(w, id);
        }
    });
});
