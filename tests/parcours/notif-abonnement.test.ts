/**
 * Lot 8, tâche 8.2 m (contrat 10.1, L57) — lien de la notification PAYMENT_SUCCESS d'un abonnement :
 * /partner/subscription, au lieu de /orders. Parcours réel : paiement de l'abonnement par la route, confirmation
 * par le webhook du faux SamirPay, ligne de la boîte d'envoi écrite par trg_payments_other_success, passage de
 * l'envoyeur, notification de la cloche.
 *  1. abonnement payé : une ligne PAYMENT_SUCCESS au compte, IN_APP, qui transmet payment_target = SUBSCRIPTION ;
 *     une notification, avec metadata.actionUrl = /partner/subscription ;
 *  2. témoin : une ligne déjà en file à l'application de la migration, sans payment_target, part toujours et
 *     garde /orders (lecture tolérante : `field`, jamais `text`, qui lèverait TemplateDataError).
 *
 * Rouge avant correctif (fix(8.2m)) : 1. le déclencheur ne transmet que payment_id et amount
 * (supabase/migrations/20261103000006_lot6_pros_admin.sql:968-973), et le catalogue rend /orders pour tout
 * paiement (lib/notifications/catalog.ts:882). Le rendu du lien seul est prouvé par notif-modeles.test.ts.
 * Vert dès l'écriture (témoin, signalé) : 2 ; son garde-fou est la lecture tolérante elle-même : un correctif
 * par `text()` le rendrait rouge.
 * Rouge aussi jusqu'à la fin du lot : assertRecetteInvariants en after(), qui échoue tant que le schéma du
 * lot 8 n'est pas livré et nomme chaque objet absent.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { formatFcfa } from '../../lib/format';
import { POST as createPaymentRoute } from '../../app/api/payments/create/route';
import { assertRecetteInvariants } from '../helpers/recette-invariants';
import { jsonRequest, newPartner, type TestPartner } from './finance-helpers';
import { flushNotifications, insertOutboxRow, outboxRows, type OutboxRow } from './notif-helpers';
import { deliverWebhook, paymentById, providerSays, service, type PaymentRow } from './paiement-helpers';

const PLAN_PRICE = 20_000;

let subscriber: TestPartner;
let planId: string;

before(async () => {
    subscriber = await newPartner('notif-abonne');
    const { data, error } = await service.from('subscription_plans').insert({
        code: `TEST-NOTIF-${randomUUID()}`, name: 'Pack de test (notification)', description: 'Plan dédié au test du lien de PAYMENT_SUCCESS.',
        price: PLAN_PRICE, billing_period: 'MONTHLY', features: {}, is_active: true,
    }).select('id').single();
    assert.equal(error, null, `plan d'abonnement : ${error?.message}`);
    planId = String(data.id);
});

after(async () => {
    await assertRecetteInvariants('notif-abonnement');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

interface NotificationRow {
    id: string;
    type: string;
    title: string;
    content: string;
    metadata: Record<string, unknown> | null;
}

/** Abonnement payé par la route, confirmé par le webhook (même schéma que finance-cibles.test.ts:136-160). */
async function paySubscription(): Promise<PaymentRow> {
    const res = await createPaymentRoute(jsonRequest('/api/payments/create', 'POST', subscriber.accessToken, {
        targetType: 'SUBSCRIPTION', targetId: planId, operator: 'WAVE', payerPhone: subscriber.phone9,
    }));
    const body = (await res.json()) as Record<string, unknown>;
    assert.equal(res.status, 201, `paiement de l'abonnement : HTTP ${res.status} ${JSON.stringify(body)}`);
    const pending = await paymentById(String(body.payment_id));
    assert.equal(pending.payment_target, 'SUBSCRIPTION', 'cible du paiement');
    providerSays(pending, 'SUCCESS');
    const hook = await deliverWebhook(pending);
    assert.equal(hook.status, 200, 'webhook accepté');
    const confirmed = await paymentById(pending.id);
    assert.equal(confirmed.status, 'SUCCESS', `paiement confirmé (${confirmed.status})`);
    return confirmed;
}

/** Passe l'envoyeur sur cette seule ligne, et rend l'unique notification qu'elle a écrite. */
async function deliver(row: OutboxRow): Promise<NotificationRow> {
    await flushNotifications({ ids: [row.id] });
    const [done] = await outboxRows({ ids: [row.id] });
    assert.ok(done, `ligne ${row.id} introuvable après l'envoi`);
    assert.equal(done.status, 'SENT', `ligne ${row.id} : ${JSON.stringify({ status: done.status, reason: done.reason, detail: done.reason_detail })}`);
    assert.ok(done.notification_id, 'notification_id posé sur la ligne de la boîte d’envoi');
    const { data, error } = await service.from('notifications').select('id, type, title, content, metadata')
        .eq('user_id', subscriber.userId).eq('metadata->>outbox_id', row.id);
    assert.equal(error, null, `lecture de notifications : ${error?.message}`);
    const rows = (data ?? []) as NotificationRow[];
    assert.equal(rows.length, 1, `une notification pour la ligne ${row.id} : ${JSON.stringify(rows)}`);
    assert.equal(rows[0].id, done.notification_id, 'notification_id = id de la notification écrite');
    return rows[0];
}

// ── Parcours ───────────────────────────────────────────────────────────────

describe('8.2 m — PAYMENT_SUCCESS : le lien suit la cible du paiement (contrat 10.1)', () => {
    test('abonnement payé et confirmé : une notification dont le lien mène à /partner/subscription', async () => {
        const payment = await paySubscription();
        const rows = await outboxRows({ keyPrefix: `PAYMENT_SUCCESS:${payment.id}`, userId: subscriber.userId });
        assert.deepEqual(rows.map((r) => ({ type: r.type, channel: r.channel })), [{ type: 'PAYMENT_SUCCESS', channel: 'IN_APP' }],
            `une seule ligne, canal IN_APP : ${JSON.stringify(rows.map((r) => r.idempotency_key))}`);

        const n = await deliver(rows[0]);
        assert.deepEqual(
            { type: n.type, title: n.title, content: n.content, actionUrl: n.metadata?.actionUrl },
            {
                type: 'PAYMENT_SUCCESS', title: 'Paiement confirmé',
                content: `Votre paiement de ${formatFcfa(Number(payment.amount))} a été validé.`,
                actionUrl: '/partner/subscription',
            }, 'notification de l’abonnement : lien vers la page d’abonnement, jamais /orders');
        assert.equal(rows[0].template_data.payment_target, 'SUBSCRIPTION',
            `le déclencheur transmet la cible : ${JSON.stringify(rows[0].template_data)}`);
    });

    test('témoin : une ligne déjà en file, sans payment_target, part toujours et garde /orders (lecture tolérante, L57)', async () => {
        const due = new Date(Date.now() - 1000).toISOString();
        const row = await insertOutboxRow({
            type: 'PAYMENT_SUCCESS', family: 'ESSENTIAL', channel: 'IN_APP', recipient_user_id: subscriber.userId,
            template_data: { payment_id: randomUUID(), amount: 15_000 }, due_at: due, next_attempt_at: due,
        });
        const n = await deliver(row);
        assert.deepEqual(
            { type: n.type, content: n.content, actionUrl: n.metadata?.actionUrl },
            { type: 'PAYMENT_SUCCESS', content: `Votre paiement de ${formatFcfa(15_000)} a été validé.`, actionUrl: '/orders' },
            'ligne d’avant la migration : aucun échec de modèle, lien inchangé');
    });
});
