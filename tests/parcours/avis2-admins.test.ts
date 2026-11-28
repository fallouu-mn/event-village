/**
 * Lot « Avis », phase 2, sous-lot 2d (écarts B8, B9, B10 de docs/avis-inventaire.md) — administrateurs regroupés. Base LOCALE.
 *
 *  B9. Alertes d'argent (remboursement à reprendre, incertain, double paiement, créance) écrites dans la cloche d'un
 *      administrateur : UN seul SMS « argent à vérifier » en attente, qui les compte (test « une fois » : la même alerte
 *      relue ne compte pas deux fois) ; texte exact ; une fois parti, le SMS suivant est dû une heure plus tard au plus tôt.
 *  B8. Produits à vérifier : la sorte PRODUCT_REVIEW du SMS regroupé des validations compte N produits ; texte exact.
 *  B8, B9, B10. Notification du téléphone ajoutée (registre = catalogue) ; plafonds de SMS sans SMS (D4).
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { assertNotificationInvariants } from '../helpers/notification-invariants';
import { service } from './paiement-helpers';
import { dispatchAt, newAdmin, nowOutsideNight, outboxRows } from './notif-helpers';
import { NOTIFICATION_CATALOG, renderNotification } from '../../lib/notifications/catalog';

const CTX = { appUrl: 'https://app.eventvillage.sn' };

after(async () => {
    await assertNotificationInvariants('avis2-admins');
});

async function alert(type: string, data: Record<string, unknown>, ref = randomUUID()): Promise<string> {
    const { error } = await service.rpc('notif_enqueue_admins', { p: { type, ref, data } });
    assert.equal(error, null, `${type} : ${error?.message}`);
    return ref;
}

describe('B9 — SMS regroupé « argent à vérifier »', () => {
    test('quatre alertes → un seul SMS qui les compte ; alerte relue non recomptée ; texte exact ; SMS suivant une heure après', async () => {
        const admin = await newAdmin('avis2-argent', ['refunds.manage', 'payments.read']);
        const uncertain = await alert('ADMIN_CASHOUT_UNCERTAIN', { cashout_id: randomUUID(), amount: 5_000 });
        await alert('ADMIN_REFUND_TO_RETRY', { cashout_id: randomUUID(), amount: 6_000, cashout_status: 'ECHOUE' });
        await alert('ADMIN_DUPLICATE_PAYMENT', { payment_id: randomUUID(), duplicate_of: randomUUID(), amount: 7_000 });
        await alert('ADMIN_FINANCE_DEBT', { debt_id: randomUUID(), amount: 8_000, debt: 8_000, account_kind: 'ORGANISATEUR' });
        await alert('ADMIN_CASHOUT_UNCERTAIN', { cashout_id: randomUUID(), amount: 5_000 }, uncertain); // même alerte : rien de plus

        const rows = await outboxRows({ type: 'ADMIN_MONEY_SMS', userId: admin.userId });
        assert.equal(rows.length, 1, `un seul SMS regroupé : ${JSON.stringify(rows.map((r) => [r.status, r.template_data]))}`);
        const d = rows[0].template_data;
        assert.deepEqual([d.resume_count, d.uncertain_count, d.duplicate_count, d.debt_count], [1, 1, 1, 1], JSON.stringify(d));
        const sms = renderNotification('ADMIN_MONEY_SMS', 'SMS', d, CTX);
        assert.equal(sms.channel === 'SMS' && sms.text,
            'Event Village : argent à vérifier : 1 versement à reprendre, 1 incertain, 1 double paiement, 1 créance. https://app.eventvillage.sn/admin/finance');

        const at = new Date(Math.max(Date.parse(rows[0].due_at), (await nowOutsideNight()).getTime()) + 1_000);
        await dispatchAt(at, { ids: [rows[0].id] });
        const [sent] = await outboxRows({ ids: [rows[0].id] });
        assert.equal(sent.status, 'SENT', `${sent.status} ${sent.reason ?? ''}`);
        await alert('ADMIN_REFUND_TO_RETRY', { cashout_id: randomUUID(), amount: 6_000, cashout_status: 'BLOQUE' });
        const next = (await outboxRows({ type: 'ADMIN_MONEY_SMS', userId: admin.userId, status: 'PENDING' }));
        assert.equal(next.length, 1, 'un nouveau SMS en attente');
        const gap = Date.parse(next[0].due_at) - Date.parse(String(sent.sent_at ?? sent.claimed_at));
        assert.ok(gap >= 3_600_000 - 1_000, `au plus un SMS par heure : ${gap} ms`);
    });
});

describe('B8 — produits dans le SMS regroupé des validations', () => {
    test('PRODUCT_REVIEW compte N produits ; texte exact', async () => {
        const admin = await newAdmin('avis2-produits', ['partners.validate']);
        const { error } = await service.rpc('notif_admin_review_sms', { p: { kind: 'PRODUCT_REVIEW', ref: `PRODUCTS:${randomUUID()}`, count: 3, only_admin_ids: [admin.userId] } });
        assert.equal(error, null, error?.message);
        const rows = await outboxRows({ type: 'ADMIN_REVIEW_SMS', userId: admin.userId });
        assert.equal(rows.length, 1, JSON.stringify(rows.map((r) => r.template_data)));
        assert.equal(rows[0].template_data.product_count, 3);
        const sms = renderNotification('ADMIN_REVIEW_SMS', 'SMS', rows[0].template_data, CTX);
        assert.equal(sms.channel === 'SMS' && sms.text, 'Event Village : 3 produit(s) attendent votre validation : https://app.eventvillage.sn/admin/dashboard');
        // Un produit de plus : même SMS, 4 produits
        const { error: e2 } = await service.rpc('notif_admin_review_sms', { p: { kind: 'PRODUCT_REVIEW', ref: `PRODUCT:${randomUUID()}`, only_admin_ids: [admin.userId] } });
        assert.equal(e2, null, e2?.message);
        const again = await outboxRows({ type: 'ADMIN_REVIEW_SMS', userId: admin.userId });
        assert.deepEqual(again.map((r) => r.template_data.product_count), [4], 'même SMS, compté une fois de plus');
    });
});

describe('B8, B9, B10 — notification du téléphone ajoutée, plafonds sans SMS', () => {
    test('registre = catalogue', async () => {
        const types = ['ADMIN_PRODUCT_REVIEW', 'ADMIN_PRODUCTS_REVIEW_BATCH', 'ADMIN_WITHDRAWAL_REJECTED', 'ADMIN_FINANCE_DEBT',
            'ADMIN_SMS_CAP_GLOBAL', 'ADMIN_SMS_CAP_NON_OTP', 'ADMIN_SMS_CAP_NEW_NUMBERS'];
        const { data, error } = await service.from('notification_types').select('type, channels').in('type', [...types, 'ADMIN_MONEY_SMS']);
        assert.equal(error, null, error?.message);
        const byType = new Map((data ?? []).map((r) => [String(r.type), [...(r.channels as string[])].sort()]));
        for (const t of types) {
            assert.deepEqual(byType.get(t), ['EMAIL', 'IN_APP', 'PUSH'], `${t} : cloche, email, notification ; jamais de SMS`);
            assert.deepEqual([...NOTIFICATION_CATALOG[t as keyof typeof NOTIFICATION_CATALOG].channels].sort(), ['EMAIL', 'IN_APP', 'PUSH'], `${t} au catalogue`);
        }
        assert.deepEqual(byType.get('ADMIN_MONEY_SMS'), ['SMS']);
    });
});
