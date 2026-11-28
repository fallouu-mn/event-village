/**
 * Lot 12d — livreur, client absent, signalements, administration des commandes, fermetures, pause, allergènes (base
 * LOCALE, faux SamirPay, faux SMS). Les montants attendus sont calculés à la main dans chaque test.
 *
 *  A. Livreur : téléphone du client seulement en route (adresse avant), rien après la fin (ni adresse ni téléphone),
 *     code jamais visible ; livreur retiré ou d'une autre partenaire : rien (lecture, appel, absence, remise) ;
 *     invitation : lecture par l'invité seul, réponse une fois, avis à l'établissement (A6) ; retrait : avis au livreur (A7).
 *  B. Reste encaissé en espèces : refusé sans « reste reçu », une seule remise (deux à la fois : une seule passe), noté
 *     par le bon compte, montant juste.
 *  C. Client absent : deux appels (deux touches rapprochées = un appel), attente de 30 minutes, décision de l'équipe
 *     (droit, aperçu, montant écrit, une seule fois sous concurrence, montant rendu juste, stock gardé), remise encore
 *     possible pendant l'attente, avis (client 4 canaux, établissement, administration, livreur).
 *  D. Signalement : trop tôt, d'autrui, motif, doublon, avis regroupé aux administrateurs, réponse de l'équipe.
 *  E. Annulation par l'administration : droit refunds.manage, remboursement une seule fois sous concurrence.
 *  F. Liste et fiche de l'administration : droits, pagination, données personnelles selon users.read.
 *  G. Fermeture exceptionnelle : commandes prévues listées (propriétaire seul), « Garder », avis ; paiement refusé.
 *  H. Pause : devis refusé, bandeau servi, fin automatique, avis de fin une fois, durées et propriétaire contrôlés.
 *  I. Allergènes et piment : écriture contrôlée, carte, colonnes fermées à la REST.
 *  J. Profil : « Mes livraisons » (courier_active) pour un livreur actif seulement.
 */
import '../helpers/env';
import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { assertLot12aInvariants } from '../helpers/lot12a-invariants';
import { openConcurrentClient } from '../helpers/db';
import { stepUpTestSession } from '../helpers/admin-step-up';
import { BASE_URL } from './helpers';
import { GET as courierDayGet } from '../../app/api/courier/orders/route';
import { GET as courierOrderGet } from '../../app/api/courier/orders/[id]/route';
import { GET as invitationGet, POST as invitationPost } from '../../app/api/courier/invitations/[id]/route';
import { GET as clientOrderGet } from '../../app/api/orders/[id]/route';
import { POST as issuePost } from '../../app/api/orders/[id]/issue/route';
import { GET as partnerOrderGet } from '../../app/api/partner/orders/[id]/route';
import { GET as pauseGet, POST as pausePost } from '../../app/api/partner/orders/pause/route';
import { GET as closureOrdersGet, POST as closureOrdersPost } from '../../app/api/partner/venues/closures/[id]/orders/route';
import { PUT as detailsPut } from '../../app/api/partner/products/[id]/details/route';
import { GET as adminListGet } from '../../app/api/admin/orders/route';
import { GET as adminOrderGet } from '../../app/api/admin/orders/[id]/route';
import { POST as adminAbsencePost } from '../../app/api/admin/orders/[id]/absence/route';
import { POST as adminCancelPost } from '../../app/api/admin/orders/[id]/cancel/route';
import { POST as adminIssuePost } from '../../app/api/admin/orders/issues/[id]/route';
import { POST as quoteRoute } from '../../app/api/orders/quote/route';
import { GET as menuGet } from '../../app/api/restaurants/[id]/menu/route';
import { GET as meGet } from '../../app/api/auth/me/route';
import {
    addCourier, codeOf, courierAct, n, newBuyer, newDeliveryZone, newPartner, newProduct, newShop, openOrdersService, order,
    orderBody, partnerAct, payOrder, placed, releaseUnpaid, service, startOrderPay, toReady, userClient, type Buyer, type Row, type TestPartner,
} from './l12a-helpers';

let restore: () => Promise<void>;
let partner: TestPartner;
let partnerB: TestPartner;
let client: Buyer;
let stranger: Buyer;
let courier: Buyer;
let foreignCourier: Buyer;
let adminPay: Buyer;
let adminRefund: Buyer;
let adminPeople: Buyer;
let adminNone: Buyer;
let shop: string;
let zone: string;

async function newAdmin(label: string, permissions: string[]): Promise<Buyer> {
    const user = await newBuyer(`l12d-${label}`, { firstName: 'Ndeye', lastName: 'Equipe' });
    const { error } = await service.from('user_roles').upsert([{ user_id: user.userId, role: 'ADMIN' }], { onConflict: 'user_id,role' });
    assert.equal(error, null, `rôle ADMIN : ${error?.message}`);
    for (const permission of permissions) {
        const { error: pErr } = await service.from('admin_permissions').upsert({ user_id: user.userId, permission }, { onConflict: 'user_id,permission' });
        assert.equal(pErr, null, `permission ${permission} : ${pErr?.message}`);
    }
    await stepUpTestSession(user.accessToken);
    return user;
}

before(async () => {
    restore = await openOrdersService();
    partner = await newPartner('l12d');
    partnerB = await newPartner('l12d-autre');
    client = await newBuyer('l12d-client', { firstName: 'Khady', lastName: 'Sarrdiop' });
    stranger = await newBuyer('l12d-autre');
    courier = await newBuyer('l12d-livreur', { firstName: 'Moussa', lastName: 'Diallo' });
    foreignCourier = await newBuyer('l12d-livreur-b');
    shop = await newShop(partner, { depositAllowed: true, depositPercent: 30, payOnHandover: true });
    zone = await newDeliveryZone(shop, 1_000, 0, 'Plateau');
    const shopB = await newShop(partnerB);
    assert.ok(shopB);
    await addCourier(partner, courier);
    await addCourier(partnerB, foreignCourier);
    adminPay = await newAdmin('paiements', ['payments.read']);
    adminRefund = await newAdmin('remboursements', ['refunds.manage']);
    adminPeople = await newAdmin('comptes', ['refunds.manage', 'users.read']);
    adminNone = await newAdmin('evenements', ['events.read']);
});

beforeEach(async () => {
    if (client) await releaseUnpaid(client.userId);
});

after(async () => {
    await restore();
    await assertLot12aInvariants('l12d-livreur-admin');
});

// ── Aides ─────────────────────────────────────────────────────────────────────────────────────────────────────────

function req(path: string, method: string, token: string | null, body?: unknown): NextRequest {
    const h: Record<string, string> = { 'content-type': 'application/json' };
    if (token) h.authorization = `Bearer ${token}`;
    return new NextRequest(`${BASE_URL}${path}`, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
}
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
async function reply(res: Response): Promise<{ status: number; body: Row; text: string }> {
    const text = await res.text();
    let body: Row = {};
    try {
        body = text ? (JSON.parse(text) as Row) : {};
    } catch {
        body = { raw: text }; // corps non JSON gardé pour le message d'échec
    }
    return { status: res.status, body, text };
}
async function sql<T extends Row = Row>(text: string, params: unknown[] = []): Promise<T[]> {
    const c = await openConcurrentClient({ applicationName: 'ev-test-l12d' });
    try {
        await c.query(`SELECT set_config('event_village.order_flow', 'on', true)`);
        const { rows } = await c.query<T>(text, params);
        await c.commit();
        return rows;
    } finally {
        await c.close();
    }
}
async function rpc(name: string, p: Row): Promise<Row> {
    const { data, error } = await service.rpc(name, { p });
    assert.equal(error, null, `${name} : ${error?.message}`);
    return data as Row;
}
const delivery = (who: Buyer = client): Row => ({ mode: 'LIVRAISON', zoneId: zone, address: 'Villa 12, route des Almadies', phone: who.phone9 });
const courierView = async (who: Buyer, id: string) => reply(await courierOrderGet(req(`/api/courier/orders/${id}`, 'GET', who.accessToken), ctx(id)));
const courierDay = async (who: Buyer) => reply(await courierDayGet(req('/api/courier/orders', 'GET', who.accessToken)));
async function outbox(userId: string, type: string, key?: string): Promise<string[]> {
    let q = service.from('notification_outbox').select('channel, idempotency_key').eq('recipient_user_id', userId).eq('type', type);
    if (key) q = q.like('idempotency_key', `%${key}%`);
    const { data, error } = await q;
    assert.equal(error, null, `boîte d'envoi : ${error?.message}`);
    return (data ?? []).map((r) => String(r.channel)).sort();
}

/** Livraison payée (entier par défaut) confiée au livreur et prête ; `go` : partie (en route). */
async function delivered(opts: { who?: Buyer; payment?: 'INTEGRAL' | 'ACOMPTE'; price?: number; stock?: number; go?: boolean; by?: Buyer } = {}): Promise<{ id: string; product: string }> {
    const who = opts.who ?? client;
    const product = await newProduct(partner, shop, { price: opts.price ?? 4_000, ...(opts.stock !== undefined ? { stock: opts.stock } : {}) });
    const id = await placed(who, orderBody(shop, [{ productId: product, quantity: 1 }], { ...delivery(who), payment: opts.payment ?? 'INTEGRAL' }));
    await payOrder(who, id);
    await toReady(partner, id);
    const assign = await partnerAct(partner, id, { action: 'CONFIER', courierId: (opts.by ?? courier).userId });
    assert.equal(assign.status, 200, JSON.stringify(assign.body));
    if (opts.go !== false) {
        const go = await courierAct(opts.by ?? courier, id, { action: 'EN_ROUTE', minutes: 20 });
        assert.equal(go.status, 200, JSON.stringify(go.body));
    }
    return { id, product };
}
async function twoCalls(who: Buyer, id: string): Promise<void> {
    assert.equal((await courierAct(who, id, { action: 'APPEL' })).status, 200);
    await sql(`UPDATE public.orders SET last_call_at = now() - interval '31 seconds' WHERE id = $1`, [id]);
    const second = await courierAct(who, id, { action: 'APPEL' });
    assert.equal((second.body.order as Row).calls, 2, JSON.stringify(second.body));
}

// ── A. Livreur ────────────────────────────────────────────────────────────────────────────────────────────────────

describe('A. Livreur : coordonnées, accès, invitations', () => {
    test('téléphone seulement en route, adresse avant ; rien après la fin ; code jamais visible du livreur', async () => {
        const { id } = await delivered({ go: false });
        const before = await courierView(courier, id);
        assert.equal(before.status, 200, before.text);
        const c0 = (before.body.order as Row).contact as Row;
        assert.deepEqual([c0.address, c0.phone ?? null], ['Villa 12, route des Almadies', null], 'adresse oui, téléphone non avant le départ');
        const day0 = await courierDay(courier);
        assert.doesNotMatch(day0.text, new RegExp(client.phone9), 'aucun téléphone dans la liste avant le départ');
        assert.equal((await courierAct(courier, id, { action: 'APPEL' })).body.code, 'NOT_EN_ROUTE', 'pas d’appel compté avant le départ');

        assert.equal((await courierAct(courier, id, { action: 'EN_ROUTE', minutes: 15 })).status, 200);
        const during = await courierView(courier, id);
        assert.equal(((during.body.order as Row).contact as Row).phone, client.phoneE164, 'téléphone pendant la livraison');
        const code = await codeOf(client, id);
        const codeRe = new RegExp(`"(?:code|handover_code)"\\s*:\\s*"${code}"`);
        assert.doesNotMatch(during.text, codeRe, 'code absent de la fiche du livreur');
        assert.doesNotMatch((await courierDay(courier)).text, codeRe, 'code absent de la journée du livreur');

        const done = await courierAct(courier, id, { action: 'REMETTRE', code });
        assert.equal(done.status, 200, JSON.stringify(done.body));
        assert.equal((await courierView(courier, id)).status, 404, 'plus rien après la fin');
        const day = await courierDay(courier);
        const row = ((day.body.done as Row[]) ?? []).find((d) => d.id === id);
        assert.ok(row, 'livraison terminée aujourd’hui listée');
        assert.equal(row!.stateLabel, 'Livrée');
        assert.doesNotMatch(JSON.stringify(row), /Villa 12|\+221|"contact"/, 'ni adresse ni téléphone après la fin');
        assert.equal(((day.body.orders as Row[]) ?? []).some((o) => o.id === id), false);
    });

    test('livreur d’une autre partenaire ou retiré : ni lecture, ni appel, ni absence, ni remise ; avis A7', async () => {
        const { id } = await delivered();
        assert.equal((await courierView(foreignCourier, id)).status, 404);
        for (const action of ['APPEL', 'ABSENT', 'REMETTRE', 'EN_ROUTE']) {
            assert.equal((await courierAct(foreignCourier, id, { action, code: '0000' })).status, 404, `autre équipe : ${action}`);
        }
        assert.equal(((await courierDay(foreignCourier)).body.orders as Row[]).some((o) => o.id === id), false);

        const second = await newBuyer('l12d-livreur-retire', { firstName: 'Ibou', lastName: 'Ndour' });
        await addCourier(partner, second);
        const { id: id2 } = await delivered({ by: second });
        assert.equal((await courierView(second, id2)).status, 200);
        const removed = await rpc('order_courier_remove', { actor_id: partner.userId, courier_id: second.userId });
        assert.equal(removed.ok, true, JSON.stringify(removed));
        assert.equal((await courierView(second, id2)).status, 404, 'retiré : plus de lecture');
        for (const action of ['APPEL', 'ABSENT', 'REMETTRE']) {
            assert.equal((await courierAct(second, id2, { action, code: '0000' })).status, 404, `retiré : ${action}`);
        }
        assert.deepEqual(await outbox(second.userId, 'ORDER_COURIER_REMOVED'), ['IN_APP', 'PUSH'], 'livreur retiré prévenu (cloche, téléphone)');
        // La partenaire termine elle-même la livraison partie
        const code = await codeOf(client, id2);
        assert.equal((await partnerAct(partner, id2, { action: 'REMETTRE', code })).status, 200);
        const code1 = await codeOf(client, id);
        assert.equal((await courierAct(courier, id, { action: 'REMETTRE', code: code1 })).status, 200);
    });

    test('invitation : lue par l’invité seul, réponse une fois, avis à l’établissement (prénom et initiale)', async () => {
        const invited = await newBuyer('l12d-invite', { firstName: 'Aminata', lastName: 'Faye' });
        const inv = await rpc('order_courier_invite', { actor_id: partner.userId, phone: invited.phoneE164 });
        assert.equal(inv.ok, true, JSON.stringify(inv));
        const invId = String(inv.invitation_id);
        const mine = await reply(await invitationGet(req(`/api/courier/invitations/${invId}`, 'GET', invited.accessToken), ctx(invId)));
        assert.equal(mine.status, 200, mine.text);
        assert.equal((mine.body.invitation as Row).status, 'PENDING');
        assert.ok(String((mine.body.invitation as Row).partner_name).length > 0);
        assert.equal((await reply(await invitationGet(req(`/api/courier/invitations/${invId}`, 'GET', stranger.accessToken), ctx(invId)))).status, 404);
        assert.ok(((await courierDay(invited)).body.invitations as Row[]).some((i) => i.id === invId), 'invitation en attente dans la journée');
        const yes = await reply(await invitationPost(req(`/api/courier/invitations/${invId}`, 'POST', invited.accessToken, { accept: true }), ctx(invId)));
        assert.equal(yes.status, 200, yes.text);
        const again = await reply(await invitationPost(req(`/api/courier/invitations/${invId}`, 'POST', invited.accessToken, { accept: false }), ctx(invId)));
        assert.deepEqual([again.status, again.body.code], [409, 'ALREADY_ANSWERED']);
        assert.deepEqual(await outbox(partner.userId, 'ORDER_COURIER_ANSWERED', invId), ['IN_APP', 'PUSH']);
        const { data } = await service.from('notification_outbox').select('template_data')
            .eq('recipient_user_id', partner.userId).eq('type', 'ORDER_COURIER_ANSWERED').like('idempotency_key', `%${invId}%`).limit(1).single();
        assert.equal((data!.template_data as Row).courier_name, 'Aminata F.', 'prénom et initiale seulement');
        assert.doesNotMatch(JSON.stringify(data), /Faye/);
    });
});

// ── B. Reste encaissé ─────────────────────────────────────────────────────────────────────────────────────────────

describe('B. Reste reçu en espèces', () => {
    test('acompte 30 % : reste servi par la base, exigé à la remise, une seule remise sous concurrence, noté par le livreur', async () => {
        const { id } = await delivered({ payment: 'ACOMPTE', price: 5_000 });
        // 5 000 + zone 1 000 = 6 000 ; acompte 30 % = 1 800 ; reste 4 200
        const view = await courierView(courier, id);
        assert.equal(n(((view.body.order as Row).amounts as Row).balance_due), 4_200);
        const code = await codeOf(client, id);
        const refused = await courierAct(courier, id, { action: 'REMETTRE', code });
        assert.deepEqual([refused.status, refused.body.code, n(refused.body.balance_due)], [409, 'BALANCE_DUE', 4_200]);
        const both = await Promise.all([
            courierAct(courier, id, { action: 'REMETTRE', code, balanceReceived: true }),
            courierAct(courier, id, { action: 'REMETTRE', code, balanceReceived: true }),
        ]);
        assert.deepEqual(both.map((r) => r.status).sort(), [200, 409], JSON.stringify(both.map((r) => r.body)));
        const o = await order(id);
        assert.deepEqual([o.order_state, n(o.onsite_amount), o.onsite_recorded_by], ['REMISE', 4_200, courier.userId]);
    });
});

// ── C. Client absent ──────────────────────────────────────────────────────────────────────────────────────────────

describe('C. Client absent', () => {
    test('deux appels exigés (touches rapprochées = un appel), attente, décision de l’équipe une seule fois, montant juste, stock gardé', async () => {
        const { id, product } = await delivered({ price: 4_000, stock: 5 });
        // 4 000 + zone 1 000 = 5 000 ; frais 5 % = 250 ; payé 5 250
        const tooSoon = await courierAct(courier, id, { action: 'ABSENT' });
        assert.deepEqual([tooSoon.status, tooSoon.body.code], [409, 'CALLS_REQUIRED']);
        const c1 = await courierAct(courier, id, { action: 'APPEL' });
        const c2 = await courierAct(courier, id, { action: 'APPEL' });
        assert.deepEqual([(c1.body.order as Row).calls, (c2.body.order as Row).calls, (c2.body.order as Row).counted], [1, 1, false], 'deux touches rapprochées : un appel');
        assert.equal((await courierAct(courier, id, { action: 'ABSENT' })).body.code, 'CALLS_REQUIRED');
        await sql(`UPDATE public.orders SET last_call_at = now() - interval '31 seconds' WHERE id = $1`, [id]);
        assert.equal(((await courierAct(courier, id, { action: 'APPEL' })).body.order as Row).calls, 2);
        assert.equal(((await courierView(courier, id)).body.order as Row).can_report_absent, true);
        const absent = await courierAct(courier, id, { action: 'ABSENT' });
        assert.equal(absent.status, 200, JSON.stringify(absent.body));
        const wait = Date.parse(String((absent.body.order as Row).absentWaitUntil));
        assert.ok(Math.abs(wait - Date.now() - 30 * 60_000) < 120_000, 'attente de 30 minutes');
        assert.equal((await courierAct(courier, id, { action: 'ABSENT' })).body.code, 'ALREADY_ABSENT');
        assert.deepEqual(await outbox(client.userId, 'ORDER_CLIENT_ABSENT', id), ['EMAIL', 'IN_APP', 'PUSH', 'SMS'], 'client prévenu sur ses 4 canaux');
        assert.deepEqual(await outbox(partner.userId, 'ORDER_CLIENT_ABSENT_PRO', id), ['IN_APP', 'PUSH']);
        const clientView = await reply(await clientOrderGet(req(`/api/orders/${id}`, 'GET', client.accessToken), ctx(id)));
        assert.equal(((clientView.body.order as Row).absence as Row).phase, 'ATTENTE');

        const early = await rpc('order_absence_decide', { actor_id: adminRefund.userId, order_id: id, decision: 'TOUT', reason: 'Essai trop tôt', preview: true });
        assert.equal(early.code, 'ABSENCE_WAITING', 'pas de décision pendant l’attente');
        await sql(`UPDATE public.orders SET absent_wait_until = now() - interval '1 minute' WHERE id = $1`, [id]);
        const t1 = await service.rpc('order_watch_tick');
        assert.equal(t1.error, null, t1.error?.message);
        assert.ok(n((t1.data as Row).absences_escalated) >= 1, JSON.stringify(t1.data));
        const t2 = await service.rpc('order_watch_tick');
        assert.equal(t2.error, null, 'tâche rejouée sans erreur');
        assert.deepEqual(await outbox(adminRefund.userId, 'ADMIN_ORDER_ABSENT', id), ['EMAIL', 'IN_APP'], 'administrateur refunds.manage prévenu une fois');
        assert.deepEqual(await outbox(adminPay.userId, 'ADMIN_ORDER_ABSENT', id), [], 'sans refunds.manage : rien');
        assert.deepEqual(await outbox(courier.userId, 'ORDER_COURIER_RETURN', id), ['IN_APP', 'PUSH']);
        assert.equal((((await courierView(courier, id)).body.order as Row).absence as Row).phase, 'EQUIPE');

        assert.equal((await rpc('order_absence_decide', { actor_id: adminPay.userId, order_id: id, decision: 'TOUT', reason: 'Sans le droit', preview: true })).code, 'FORBIDDEN');
        const preview = await rpc('order_absence_decide', { actor_id: adminRefund.userId, order_id: id, decision: 'PART', percent: 50, reason: 'x', preview: true });
        // 50 % de 5 250 = 2 625
        assert.deepEqual([preview.ok, n(preview.refund_amount), n(preview.paid)], [true, 2_625, 5_250]);
        const stale = await rpc('order_absence_decide', { actor_id: adminRefund.userId, order_id: id, decision: 'PART', percent: 50, reason: 'Client rappelé trop tard', expected_amount: 2_600 });
        assert.deepEqual([stale.code, n(stale.refund_amount)], ['AMOUNT_CHANGED', 2_625]);
        const p = { actor_id: adminRefund.userId, order_id: id, decision: 'PART', percent: 50, reason: 'Client rappelé trop tard', expected_amount: 2_625 };
        const both = await Promise.all([service.rpc('order_absence_decide', { p }), service.rpc('order_absence_decide', { p })]);
        const oks = both.map((r) => (r.data as Row)?.ok === true);
        assert.deepEqual(oks.filter(Boolean).length, 1, `une seule décision : ${JSON.stringify(both.map((r) => r.data ?? r.error))}`);
        assert.equal(both.map((r) => (r.data as Row)?.code).find(Boolean), 'ALREADY_DECIDED');
        const o = await order(id);
        assert.deepEqual([o.order_state, n(o.refunded_amount), n(o.refund_percent), o.cancel_origin, o.absent_decision], ['NON_RETIREE', 2_625, 50, 'EVENT_VILLAGE', 'PART']);
        const { data: refunds } = await service.from('refunds').select('amount, payments!inner(order_id)').eq('payments.order_id', id);
        assert.deepEqual((refunds ?? []).map((r) => n(r.amount)), [2_625], 'un seul remboursement');
        assert.equal(n((await service.from('products').select('stock_quantity').eq('id', product).single()).data?.stock_quantity), 4, 'plat préparé : stock gardé');
        assert.deepEqual(await outbox(client.userId, 'ORDER_ABSENCE_DECIDED', id), ['EMAIL', 'IN_APP', 'PUSH', 'SMS']);
        assert.deepEqual(await outbox(partner.userId, 'ORDER_ABSENCE_DECIDED_PRO', id), ['IN_APP', 'PUSH']);
        assert.equal((await courierView(courier, id)).status, 404, 'livreur : commande close');
    });

    test('remise encore possible pendant l’attente ; décision ensuite refusée ; décision « rien » par la route avec le montant écrit', async () => {
        const { id } = await delivered();
        await twoCalls(courier, id);
        assert.equal((await courierAct(courier, id, { action: 'ABSENT' })).status, 200);
        const code = await codeOf(client, id);
        assert.equal((await courierAct(courier, id, { action: 'REMETTRE', code })).status, 200, 'le client arrive : remise');
        await sql(`UPDATE public.orders SET absent_wait_until = now() - interval '1 minute' WHERE id = $1`, [id]);
        await service.rpc('order_watch_tick');
        assert.equal((await rpc('order_absence_decide', { actor_id: adminRefund.userId, order_id: id, decision: 'RIEN', reason: 'Déjà remise', preview: true })).code, 'NO_ABSENCE');

        const { id: id2 } = await delivered();
        await twoCalls(courier, id2);
        assert.equal((await courierAct(courier, id2, { action: 'ABSENT' })).status, 200);
        await sql(`UPDATE public.orders SET absent_wait_until = now() - interval '1 minute' WHERE id = $1`, [id2]);
        await service.rpc('order_watch_tick');
        const noRight = await reply(await adminAbsencePost(req(`/api/admin/orders/${id2}/absence`, 'POST', adminPay.accessToken, { decision: 'RIEN', reason: 'Sans droit', preview: true }), ctx(id2)));
        assert.equal(noRight.status, 403, noRight.text);
        const pv = await reply(await adminAbsencePost(req(`/api/admin/orders/${id2}/absence`, 'POST', adminRefund.accessToken, { decision: 'RIEN', reason: 'x', preview: true }), ctx(id2)));
        assert.deepEqual([pv.status, n((pv.body.preview as Row).refundAmount)], [200, 0], pv.text);
        const noAmount = await reply(await adminAbsencePost(req(`/api/admin/orders/${id2}/absence`, 'POST', adminRefund.accessToken, { decision: 'RIEN', reason: 'Deux appels et 30 minutes sans réponse' }), ctx(id2)));
        assert.equal(noAmount.body.code, 'AMOUNT_CHANGED', 'confirmation sans montant écrit refusée');
        const ok = await reply(await adminAbsencePost(req(`/api/admin/orders/${id2}/absence`, 'POST', adminRefund.accessToken,
            { decision: 'RIEN', reason: 'Deux appels et 30 minutes sans réponse', expectedAmount: 0 }), ctx(id2)));
        assert.equal(ok.status, 200, ok.text);
        const o = await order(id2);
        assert.deepEqual([o.order_state, n(o.refunded_amount), o.absent_decision], ['NON_RETIREE', 0, 'RIEN']);
        const view = await reply(await clientOrderGet(req(`/api/orders/${id2}`, 'GET', client.accessToken), ctx(id2)));
        assert.equal((view.body.order as Row).stateLabel, 'Client absent');
    });
});

// ── D. Signalement ────────────────────────────────────────────────────────────────────────────────────────────────

describe('D. Signaler un problème', () => {
    test('trop tôt, d’autrui, motif, doublon ; établissement et équipe prévenus ; réponse de l’équipe', async () => {
        const p = await newProduct(partner, shop, { price: 3_000 });
        const id = await placed(client, orderBody(shop, [{ productId: p, quantity: 1 }]));
        await payOrder(client, id);
        assert.equal((await partnerAct(partner, id, { action: 'ACCEPTER' })).status, 200);
        const post = async (who: Buyer, body: Row) => reply(await issuePost(req(`/api/orders/${id}/issue`, 'POST', who.accessToken, body), ctx(id)));
        assert.deepEqual([(await post(client, { reason: 'RETARD' })).status, (await post(client, { reason: 'RETARD' })).body.code], [409, 'ISSUE_TOO_EARLY']);
        assert.equal((await partnerAct(partner, id, { action: 'PREPARER' })).status, 200);
        assert.equal((await post(stranger, { reason: 'RETARD' })).status, 404, 'commande d’autrui');
        assert.deepEqual([(await post(client, { reason: 'AUTRE' })).status, (await post(client, { reason: 'AUTRE' })).body.code], [400, 'DETAILS_REQUIRED']);
        assert.equal((await post(client, { reason: 'PAS_CONTENT' })).body.code, 'INVALID_REASON');
        const hourBefore = new Date().toISOString().slice(0, 13);
        const ok = await post(client, { reason: 'RETARD', details: 'Toujours rien après 40 minutes' });
        assert.equal(ok.status, 201, ok.text);
        const dup = await post(client, { reason: 'ERREUR' });
        assert.deepEqual([dup.status, dup.body.code], [409, 'ISSUE_ALREADY_OPEN']);
        const cv = await reply(await clientOrderGet(req(`/api/orders/${id}`, 'GET', client.accessToken), ctx(id)));
        assert.deepEqual([((cv.body.order as Row).issue as Row).status, (cv.body.order as Row).can_report], ['OUVERT', false]);
        const pv = await reply(await partnerOrderGet(req(`/api/partner/orders/${id}`, 'GET', partner.accessToken), ctx(id)));
        assert.deepEqual([((pv.body.order as Row).issue as Row).reason, ((pv.body.order as Row).issue as Row).details ?? null], ['RETARD', null], 'l’établissement voit le motif, pas le texte');
        assert.deepEqual(await outbox(partner.userId, 'ORDER_ISSUE_PRO', id), ['IN_APP', 'PUSH']);

        // Second signalement sur une autre commande dans la même heure : un seul avis par administrateur (regroupé)
        const p2 = await newProduct(partner, shop, { price: 2_000 });
        const id2 = await placed(client, orderBody(shop, [{ productId: p2, quantity: 1 }]));
        await payOrder(client, id2);
        await partnerAct(partner, id2, { action: 'ACCEPTER' });
        await partnerAct(partner, id2, { action: 'PREPARER' });
        assert.equal((await reply(await issuePost(req(`/api/orders/${id2}/issue`, 'POST', client.accessToken, { reason: 'INCOMPLETE' }), ctx(id2)))).status, 201);
        const hourAfter = new Date().toISOString().slice(0, 13);
        const { count } = await service.from('notification_outbox').select('id', { count: 'exact', head: true })
            .eq('recipient_user_id', adminRefund.userId).eq('type', 'ADMIN_ORDER_ISSUE').eq('channel', 'IN_APP');
        assert.equal(count, hourBefore === hourAfter ? 1 : 2, 'avis regroupé : un par heure au plus');

        const { data: issue } = await service.from('order_issues').select('id').eq('order_id', id).single();
        const issueId = String(issue!.id);
        assert.equal((await rpc('order_issue_close', { actor_id: adminPay.userId, issue_id: issueId, note: 'Sans le droit' })).code, 'FORBIDDEN');
        const short = await reply(await adminIssuePost(req(`/api/admin/orders/issues/${issueId}`, 'POST', adminRefund.accessToken, { note: 'ok' }), ctx(issueId)));
        assert.equal(short.body.code, 'REASON_REQUIRED');
        const closed = await reply(await adminIssuePost(req(`/api/admin/orders/issues/${issueId}`, 'POST', adminRefund.accessToken,
            { note: 'Le restaurant confirme un retard : livraison dans 10 minutes.' }), ctx(issueId)));
        assert.equal(closed.status, 200, closed.text);
        assert.equal((await rpc('order_issue_close', { actor_id: adminRefund.userId, issue_id: issueId, note: 'Encore une fois' })).code, 'ISSUE_ALREADY_CLOSED');
        assert.deepEqual(await outbox(client.userId, 'ORDER_ISSUE_CLOSED', id), ['IN_APP', 'PUSH']);
        const after = await reply(await clientOrderGet(req(`/api/orders/${id}`, 'GET', client.accessToken), ctx(id)));
        assert.deepEqual([((after.body.order as Row).issue as Row).status, ((after.body.order as Row).issue as Row).close_note, (after.body.order as Row).can_report],
            ['TRAITE', 'Le restaurant confirme un retard : livraison dans 10 minutes.', true]);
        assert.equal(n((await order(id)).refunded_amount), 0, 'aucun remboursement automatique');
        for (const x of [id, id2]) assert.equal((await rpc('order_cancel', { order_id: x, actor_id: partner.userId, origin: 'PARTENAIRE', reason: 'Fin du test du lot 12d' })).ok, true);
    });
});

// ── E. Annulation par l'administration ────────────────────────────────────────────────────────────────────────────

describe('E. Annuler et rembourser (administration)', () => {
    test('droit refunds.manage ; deux annulations à la fois : une seule passe, un seul remboursement par paiement', async () => {
        const p = await newProduct(partner, shop, { price: 6_000 });
        const id = await placed(client, orderBody(shop, [{ productId: p, quantity: 1 }]));
        await payOrder(client, id);
        await partnerAct(partner, id, { action: 'ACCEPTER' });
        const noRight = await reply(await adminCancelPost(req(`/api/admin/orders/${id}/cancel`, 'POST', adminPay.accessToken, { reason: 'Plainte confirmée' }), ctx(id)));
        assert.equal(noRight.status, 403, noRight.text);
        const fiche = await reply(await adminOrderGet(req(`/api/admin/orders/${id}`, 'GET', adminRefund.accessToken), ctx(id)));
        // 6 000 + frais 5 % 300 = 6 300 remboursables
        assert.deepEqual([fiche.status, n((fiche.body.order as Row).refundable), (fiche.body.order as Row).can_cancel], [200, 6_300, true], fiche.text);
        const both = await Promise.all([1, 2].map(async () => reply(await adminCancelPost(req(`/api/admin/orders/${id}/cancel`, 'POST', adminRefund.accessToken, { reason: 'Plainte confirmée par Event Village' }), ctx(id)))));
        assert.deepEqual(both.map((r) => r.status).sort(), [200, 409], JSON.stringify(both.map((r) => r.body)));
        const o = await order(id);
        assert.deepEqual([o.order_state, n(o.refunded_amount)], ['ANNULEE_EV', 6_300]);
        const { data: refunds } = await service.from('refunds').select('amount, payments!inner(order_id)').eq('payments.order_id', id);
        assert.deepEqual((refunds ?? []).map((r) => n(r.amount)), [6_300]);
    });
});

// ── F. Liste et fiche de l'administration ─────────────────────────────────────────────────────────────────────────

describe('F. Administration : liste, fiche, données personnelles', () => {
    test('droits, filtres, pagination par la base ; nom, numéro et adresse du client seulement avec users.read', async () => {
        const { id } = await delivered();
        const number = String((await order(id)).order_number);
        assert.equal((await rpc('order_admin_list', { actor_id: adminNone.userId })).code, 'FORBIDDEN');
        assert.equal((await rpc('order_admin_view', { actor_id: adminNone.userId, order_id: id })).code, 'FORBIDDEN');
        assert.equal((await rpc('order_admin_list', { actor_id: client.userId })).code, 'FORBIDDEN');
        const list = await reply(await adminListGet(req(`/api/admin/orders?groupe=EN_COURS&q=${number}`, 'GET', adminPay.accessToken)));
        assert.equal(list.status, 200, list.text);
        const row = (list.body.orders as Row[]).find((o) => o.id === id);
        assert.ok(row, 'commande trouvée par son numéro');
        assert.deepEqual([row!.stateLabel, row!.client_name], ['En route', 'Khady S.'], 'sans users.read : prénom et initiale');
        assert.doesNotMatch(list.text, /Sarrdiop|Villa 12|\+221/);
        const paged = await rpc('order_admin_list', { actor_id: adminPay.userId, page_size: 1, page: 2 });
        assert.deepEqual([paged.ok, (paged.items as Row[]).length, n(paged.page)], [true, 1, 2]);
        assert.ok(n(paged.pages) >= 2);
        assert.equal((await rpc('order_admin_list', { actor_id: adminPay.userId, group: 'TOUT_ET_RIEN' })).code, 'INVALID_FILTER');

        const masked = await reply(await adminOrderGet(req(`/api/admin/orders/${id}`, 'GET', adminPay.accessToken), ctx(id)));
        const m = masked.body.order as Row;
        assert.deepEqual([m.people_visible, (m.client as Row).name, (m.client as Row).phone ?? null, m.admin_contact ?? null, m.can_cancel], [false, 'Khady S.', null, null, false]);
        assert.doesNotMatch(masked.text, /Sarrdiop|Villa 12|\+221/);
        assert.ok(Array.isArray(m.payments) && Array.isArray(m.timeline), 'paiements et frise');
        const full = await reply(await adminOrderGet(req(`/api/admin/orders/${id}`, 'GET', adminPeople.accessToken), ctx(id)));
        const f = full.body.order as Row;
        assert.deepEqual([f.people_visible, (f.client as Row).name, (f.client as Row).phone, (f.admin_contact as Row).address, f.can_cancel],
            [true, 'Khady Sarrdiop', client.phoneE164, 'Villa 12, route des Almadies', true]);
        const code = await codeOf(client, id);
        assert.doesNotMatch(full.text, new RegExp(`"(?:code|handover_code)"\\s*:\\s*"${code}"`), 'jamais le code');
        assert.equal((await courierAct(courier, id, { action: 'REMETTRE', code })).status, 200);
    });
});

// ── G. Fermeture exceptionnelle ───────────────────────────────────────────────────────────────────────────────────

describe('G. Fermeture exceptionnelle et commandes prévues', () => {
    test('commandes prévues listées (propriétaire seul), « Garder », avis ; paiement refusé dans la fermeture', async () => {
        const venue = await newShop(partner);
        const p = await newProduct(partner, venue, { price: 2_500 });
        const day = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
        const kept = await placed(client, orderBody(venue, [{ productId: p, quantity: 2 }], { scheduledFor: `${day}T12:00` }));
        await payOrder(client, kept);
        assert.equal((await partnerAct(partner, kept, { action: 'ACCEPTER' })).status, 200);
        const unpaid = await placed(client, orderBody(venue, [{ productId: p, quantity: 1 }], { scheduledFor: `${day}T13:00` }));
        const outside = await placed(stranger, orderBody(venue, [{ productId: p, quantity: 1 }], { scheduledFor: `${day}T18:00` }));
        await payOrder(stranger, outside);

        const { data: closure, error } = await service.from('venue_closures')
            .insert({ venue_id: venue, starts_at: `${day}T11:00:00`, ends_at: `${day}T14:00:00`, reason: 'Travaux en cuisine', created_by: partner.userId })
            .select('id').single();
        assert.equal(error, null, error?.message);
        const closureId = String(closure!.id);
        const got = await reply(await closureOrdersGet(req(`/api/partner/venues/closures/${closureId}/orders`, 'GET', partner.accessToken), ctx(closureId)));
        assert.equal(got.status, 200, got.text);
        const ids = (got.body.orders as Row[]).map((o) => o.id);
        assert.deepEqual(ids, [kept], 'seule la commande transmise dans la fermeture (ni non payée, ni hors fermeture)');
        assert.equal((got.body.orders as Row[])[0].kept, false);
        assert.equal((await reply(await closureOrdersGet(req(`/api/partner/venues/closures/${closureId}/orders`, 'GET', partnerB.accessToken), ctx(closureId)))).status, 404);
        const { data: notice } = await service.from('notification_outbox').select('channel, template_data')
            .eq('recipient_user_id', partner.userId).eq('type', 'ORDER_CLOSURE_ORDERS').like('idempotency_key', `%${closureId}%`);
        assert.deepEqual((notice ?? []).map((x) => String(x.channel)).sort(), ['IN_APP', 'PUSH']);
        assert.equal(n(((notice ?? [])[0]?.template_data as Row)?.count), 1);

        const keep = await reply(await closureOrdersPost(req(`/api/partner/venues/closures/${closureId}/orders`, 'POST', partner.accessToken, { orderId: kept }), ctx(closureId)));
        assert.equal(keep.status, 200, keep.text);
        assert.equal((await reply(await closureOrdersPost(req(`/api/partner/venues/closures/${closureId}/orders`, 'POST', partner.accessToken, { orderId: outside }), ctx(closureId)))).status, 404);
        const again = await reply(await closureOrdersGet(req(`/api/partner/venues/closures/${closureId}/orders`, 'GET', partner.accessToken), ctx(closureId)));
        assert.equal((again.body.orders as Row[])[0].kept, true);
        assert.equal((await order(kept)).order_state, 'ACCEPTEE', 'rien d’automatique');

        const pay = await startOrderPay(client, unpaid);
        assert.deepEqual([pay.status, pay.body.code], [409, 'VENUE_CLOSED'], JSON.stringify(pay.body));
        assert.equal(pay.payment, null, 'aucun paiement créé');
        for (const x of [kept, outside]) await rpc('order_cancel', { order_id: x, actor_id: partner.userId, origin: 'PARTENAIRE', reason: 'Fin du test du lot 12d' });
    });
});

// ── H. Pause des commandes ────────────────────────────────────────────────────────────────────────────────────────

describe('H. Pause des commandes', () => {
    test('15, 30 ou 60 min, propriétaire seul ; devis refusé avec l’heure de reprise ; bandeau servi ; fin automatique ; avis de fin une fois', async () => {
        const venue = await newShop(partner);
        const p = await newProduct(partner, venue, { price: 1_500 });
        assert.equal((await rpc('order_venue_pause', { actor_id: partner.userId, venue_id: venue, minutes: 45 })).code, 'INVALID_MINUTES');
        assert.equal((await rpc('order_venue_pause', { actor_id: partnerB.userId, venue_id: venue, minutes: 30 })).code, 'VENUE_NOT_FOUND');
        const set = await reply(await pausePost(req('/api/partner/orders/pause', 'POST', partner.accessToken, { venueId: venue, minutes: 30 })));
        assert.equal(set.status, 200, set.text);
        const until = Date.parse(String(set.body.pausedUntil));
        assert.ok(Math.abs(until - Date.now() - 30 * 60_000) < 120_000);
        const q = await reply(await quoteRoute(req('/api/orders/quote', 'POST', client.accessToken, orderBody(venue, [{ productId: p, quantity: 1 }]))));
        assert.deepEqual([q.status, q.body.code], [409, 'ORDERS_PAUSED'], q.text);
        assert.match(String(q.body.error), /^Ce restaurant fait une courte pause : il reprend les commandes à \d{1,2} h \d{2}\.$/);
        const menu = await reply(await menuGet(req(`/api/restaurants/${venue}/menu`, 'GET', null), ctx(venue)));
        assert.match(String(((menu.body.menu as Row).ordering as Row).pausedUntil), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
        const state = await reply(await pauseGet(req('/api/partner/orders/pause', 'GET', partner.accessToken)));
        assert.ok(((state.body.venues as Row[]) ?? []).some((v) => v.id === venue && typeof v.paused_until === 'string'));

        const { error } = await service.from('venues').update({ orders_paused_until: new Date(Date.now() - 60_000).toISOString() }).eq('id', venue);
        assert.equal(error, null, error?.message);
        const q2 = await reply(await quoteRoute(req('/api/orders/quote', 'POST', client.accessToken, orderBody(venue, [{ productId: p, quantity: 1 }]))));
        assert.equal(q2.status, 200, `fin automatique : ${q2.text}`);
        await service.rpc('order_watch_tick');
        await service.rpc('order_watch_tick');
        assert.deepEqual(await outbox(partner.userId, 'ORDER_PAUSE_ENDED', venue), ['IN_APP', 'PUSH'], 'avis de fin une fois');
        const resume = await rpc('order_venue_pause', { actor_id: partner.userId, venue_id: venue, minutes: 0 });
        assert.deepEqual([resume.ok, resume.paused_until ?? null], [true, null]);
    });
});

// ── I. Allergènes et piment ───────────────────────────────────────────────────────────────────────────────────────

describe('I. Allergènes et piment', () => {
    test('écriture contrôlée par la base, affichés sur la carte, colonnes fermées à la REST', async () => {
        const p = await newProduct(partner, shop, { price: 3_500, name: 'TEST Yassa poulet' });
        const put = async (who: Buyer, body: Row, id = p) => reply(await detailsPut(req(`/api/partner/products/${id}/details`, 'PUT', who.accessToken, body), ctx(id)));
        const ok = await put(partner, { allergens: ['moutarde', 'GLUTEN', 'GLUTEN'], spiceLevel: 2 });
        assert.equal(ok.status, 200, ok.text);
        assert.deepEqual([ok.body.allergens, ok.body.spiceLevel], [['GLUTEN', 'MOUTARDE'], 2]);
        assert.deepEqual([(await put(partner, { allergens: ['ALCOOL'], spiceLevel: 1 })).body.code, (await put(partner, { allergens: [], spiceLevel: 4 })).body.code],
            ['INVALID_ALLERGENS', 'INVALID_SPICE']);
        assert.equal((await put(partnerB, { allergens: [], spiceLevel: 0 })).status, 404, 'produit d’une autre partenaire');
        const menu = await reply(await menuGet(req(`/api/restaurants/${shop}/menu`, 'GET', null), ctx(shop)));
        const dish = ((menu.body.menu as Row).dishFacts as Record<string, Row>)[p];
        assert.deepEqual([dish?.allergens, dish?.spiceLevel], [['GLUTEN', 'MOUTARDE'], 2]);
        assert.equal('allergens' in (((menu.body.menu as Row).products as Row[]).find((x) => x.id === p) ?? {}), false, 'champs d’un produit inchangés (audit G6)');
        const rest = await userClient(client.accessToken).from('products').select('id, allergens, spice_level').eq('id', p);
        assert.ok(rest.error, 'allergènes non lisibles par la REST (lus par la carte servie)');
        // Produit retiré de la carte (archivé) : figé
        const c = await openConcurrentClient({ applicationName: 'ev-test-l12d-archive' });
        try {
            await c.query(`SELECT set_config('event_village.product_write', 'on', true)`);
            await c.query(`UPDATE public.products SET archived_at = now() WHERE id = $1`, [p]);
            await c.commit();
        } finally {
            await c.close();
        }
        assert.equal((await put(partner, { allergens: [], spiceLevel: 0 })).body.code, 'PRODUCT_ARCHIVED');
    });
});

// ── J. Profil ─────────────────────────────────────────────────────────────────────────────────────────────────────

describe('J. Entrée « Mes livraisons »', () => {
    test('courier_active pour un livreur actif seulement', async () => {
        const me = async (who: Buyer) => reply(await meGet(req('/api/auth/me', 'GET', who.accessToken)));
        assert.equal(((await me(courier)).body.profile as Row).courier_active, true);
        assert.equal(((await me(client)).body.profile as Row).courier_active, undefined);
    });
});
