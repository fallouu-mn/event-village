/**
 * Contre-vérification du lot 12d — TROUS (branche lot12d/cv-rouges, jamais fusionnée). Vert = attaque bloquée,
 * rouge = trou. Base LOCALE, faux SamirPay, faux SMS. Chaque test remet en état ce qu'il modifie (pause, commandes).
 *
 *  T1a. Administrateur sans users.read (ni payments.read, ni refunds.manage) : adresse et téléphone du client lus par
 *       la REST (règle orders_read : client_id = auth.uid() OR is_admin()), alors que la règle du lot les réserve à
 *       users.read et que la liste du lot répond FORBIDDEN à ce compte.
 *  T1b. Même compte (droit events.read seulement) : GET /api/admin/services?type=orders sert nom entier, email,
 *       numéro du client et adresse de livraison de toutes les commandes.
 *  T2.  Client : colonnes nouvelles d'orders (absent_decided_by, delivery_calls…) et auteur des étapes
 *       (order_state_history.actor_id) lisibles par la REST : identifiant de l'administrateur qui a décidé.
 *  T3.  Pause : une commande créée juste avant la pause se paie pendant la pause et arrive à l'établissement (RECUE).
 *  T5.  Livreur : adresse du client (et consignes) lue avant le départ, dès que la commande lui est confiée (point 4 de
 *       la consigne : « téléphone et adresse du client jamais avant le départ ») ; le lot ne retient que le téléphone.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { GET as servicesGet } from '../../app/api/admin/services/route';
import { GET as courierDayGet } from '../../app/api/courier/orders/route';
import { GET as courierOrderGet } from '../../app/api/courier/orders/[id]/route';
import { assertLot12aInvariants } from '../helpers/lot12a-invariants';
import { deliverWebhook, providerSays } from '../parcours/paiement-helpers';
import {
    newProduct, newShop, openOrdersService, order, orderBody, placed, releaseUnpaid, startOrderPay, userClient, type Row,
} from '../parcours/l12a-helpers';
import { buildWorld, closeIfOpen, ctx, delivered, escalated, reply, req, rpc, type World } from './cv12d-aides';

let restore: () => Promise<void>;
let w: World;

before(async () => {
    restore = await openOrdersService();
    w = await buildWorld('trous');
});

after(async () => {
    await restore();
    await assertLot12aInvariants('cv12d-1-trous');
});

describe('T1. Données personnelles du client lues par un administrateur sans users.read', () => {
    test('T1a. REST : adresse et téléphone d’une commande lus avec le jeton d’un administrateur (events.read seul)', async () => {
        const id = await delivered(w, { go: false });
        try {
            // Le lot refuse ce compte : liste et fiche FORBIDDEN (contrôle du lot, rappelé ici)
            assert.equal((await rpc('order_admin_view', { actor_id: w.adminNone.userId, order_id: id })).code, 'FORBIDDEN');
            const rest = await userClient(w.adminNone.accessToken).from('orders')
                .select('id, contact_phone, delivery_address, client_id').eq('id', id);
            const leaked = !rest.error && (rest.data ?? []).some((r) => r.contact_phone || r.delivery_address);
            assert.equal(leaked, false,
                `administrateur sans users.read : la REST sert ${JSON.stringify(rest.data)} (erreur : ${rest.error?.message ?? 'aucune'})`);
        } finally {
            await closeIfOpen(w, id);
        }
    });

    test('T1b. GET /api/admin/services?type=orders (events.read seul) : ni nom entier, ni numéro, ni adresse du client', async () => {
        const id = await delivered(w, { go: false });
        try {
            const r = await reply(await servicesGet(req('/api/admin/services?type=orders', 'GET', w.adminNone.accessToken)));
            const mine = ((r.body.orders as Row[]) ?? []).find((o) => o.id === id);
            const leaks: string[] = [];
            if (r.status === 200 && mine) {
                if (mine.contact_phone) leaks.push(`contact_phone=${String(mine.contact_phone)}`);
                if (mine.delivery_address) leaks.push(`delivery_address=${String(mine.delivery_address)}`);
                const u = mine.users as Row | null;
                if (u?.phone) leaks.push(`users.phone=${String(u.phone)}`);
                if (u?.email) leaks.push(`users.email=${String(u.email)}`);
                if (u?.last_name) leaks.push(`users.last_name=${String(u.last_name)}`);
            }
            assert.deepEqual(leaks, [], `HTTP ${r.status} ; commande ${id} servie avec : ${leaks.join(', ')}`);
        } finally {
            await closeIfOpen(w, id);
        }
    });
});

describe('T2. Colonnes nouvelles d’orders lisibles par la REST du client', () => {
    test('identifiant de l’administrateur qui a décidé (absent_decided_by, order_state_history.actor_id) lu par le client', async () => {
        const id = await escalated(w);
        const decided = await rpc('order_absence_decide', {
            actor_id: w.adminRefund.userId, order_id: id, decision: 'RIEN', reason: 'Deux appels sans réponse', expected_amount: 0,
        });
        assert.equal(decided.ok, true, JSON.stringify(decided));
        const leaks: string[] = [];
        const cols = await userClient(w.client.accessToken).from('orders')
            .select('id, delivery_calls, last_call_at, absent_reported_at, absent_decision, absent_decided_by').eq('id', id);
        if (!cols.error && (cols.data ?? []).length > 0) leaks.push(`orders : ${JSON.stringify(cols.data)}`);
        const hist = await userClient(w.client.accessToken).from('order_state_history').select('to_state, actor_role, actor_id').eq('order_id', id);
        if (!hist.error && (hist.data ?? []).some((h) => h.actor_id === w.adminRefund.userId)) {
            leaks.push(`order_state_history : ${JSON.stringify((hist.data ?? []).filter((h) => h.actor_id))}`);
        }
        assert.deepEqual(leaks, [], `client (REST, son propre jeton) : ${leaks.join(' ; ')} ; administrateur = ${w.adminRefund.userId}`);
    });
});

describe('T3. Pause contournée par le paiement', () => {
    test('commande créée avant la pause, payée pendant la pause : paiement refusé (ORDERS_PAUSED)', async () => {
        const venue = await newShop(w.partner);
        const p = await newProduct(w.partner, venue, { price: 2_000 });
        const id = await placed(w.client, orderBody(venue, [{ productId: p, quantity: 1 }]));
        const set = await rpc('order_venue_pause', { actor_id: w.partner.userId, venue_id: venue, minutes: 15 });
        assert.equal(set.ok, true, JSON.stringify(set));
        try {
            const pay = await startOrderPay(w.client, id);
            let state: unknown = (await order(id)).order_state;
            if (pay.status === 201 && pay.payment) {
                providerSays(pay.payment, 'SUCCESS');
                const hook = await deliverWebhook(pay.payment);
                assert.equal(hook.status, 200, `webhook : HTTP ${hook.status}`);
                state = (await order(id)).order_state;
            }
            assert.notEqual(pay.status, 201,
                `pause posée : paiement HTTP ${pay.status} ${JSON.stringify(pay.body)} ; commande ensuite ${String(state)} pendant la pause`);
        } finally {
            const resume = await rpc('order_venue_pause', { actor_id: w.partner.userId, venue_id: venue, minutes: 0 });
            assert.equal(resume.ok, true, JSON.stringify(resume));
            await closeIfOpen(w, id);
            await releaseUnpaid(w.client.userId);
        }
    });
});

describe('T5. Adresse du client lue par le livreur avant le départ', () => {
    test('commande confiée, prête, pas encore partie : ni adresse ni consignes dans le détail ni dans la journée du livreur', async () => {
        const id = await delivered(w, { go: false });
        try {
            const view = await reply(await courierOrderGet(req(`/api/courier/orders/${id}`, 'GET', w.courier.accessToken), ctx(id)));
            const day = await reply(await courierDayGet(req('/api/courier/orders', 'GET', w.courier.accessToken)));
            assert.equal(view.status, 200, view.text);
            const leaks: string[] = [];
            const contact = (view.body.order as Row).contact as Row | undefined;
            if (contact?.address) leaks.push(`détail : ${JSON.stringify(contact)}`);
            if (/Villa 12, route des Almadies/.test(day.text)) leaks.push('journée : adresse du client');
            assert.deepEqual(leaks, [], `avant « Je pars » (état ${String((view.body.order as Row).state)}) : ${leaks.join(' ; ')}`);
        } finally {
            await closeIfOpen(w, id);
        }
    });
});
