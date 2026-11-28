/**
 * Lot « Avis », phase 2, sous-lots 2f, 2g et D8 (décisions D2, D1, D8 du 27/11). Base LOCALE, faux SamirPay, faux SMS.
 *
 *  2f. Filleul inscrit : cloche et notification au parrain, jamais le nom ni le numéro du filleul. Contrôle du jour (9 h,
 *      heure de Dakar) : commissions gagnées la veille (cloche et notification) et commissions devenues disponibles (quatre
 *      canaux), une fois chacune (le contrôle relancé n'ajoute rien) ; commission annulée jamais annoncée.
 *  2g. Paiement de billets échoué : SMS, notification et cloche, dus 10 minutes plus tard ; second échec du même panier : rien
 *      de plus (une fois par panier) ; un paiement du même panier réussit : l'avis encore en attente est annulé.
 *  D8. Anonymisation d'un compte par l'équipe : SMS au numéro et email à l'adresse vérifiée, envoyés avant l'effacement.
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { assertNotificationInvariants } from '../helpers/notification-invariants';
import { buyConfirmed, createPartnerEvent, newPartner } from './finance-helpers';
import { cart, checkout, createSaleEvent, deliverWebhook, newBuyer, paymentById, pollStatus, providerSays, service } from './paiement-helpers';
import { dakarAt, dakarDay, markEmailVerified, outboxRows, smsMark, smsTo, emailsTo, type OutboxRow } from './notif-helpers';
import { renderNotification } from '../../lib/notifications/catalog';

const CTX = { appUrl: 'https://app.eventvillage.sn' };
const channels = (rows: OutboxRow[]): string[] => rows.map((r) => r.channel).sort();
const describeRows = (rows: OutboxRow[]): string => JSON.stringify(rows.map((r) => [r.type, r.channel, r.status, r.reason]));

after(async () => {
    await assertNotificationInvariants('avis2-parrainage-paiement');
});

async function linkReferral(sponsorId: string, referredId: string): Promise<void> {
    const { error } = await service.from('referral_relationships').insert({
        sponsor_id: sponsorId, referred_id: referredId, referral_type: 'CLIENT_TO_CLIENT', sponsor_status_at_creation: 'STANDARD',
        rate_n1_at_creation: 10, rate_n2_at_creation: 5, duration_months: 12, expires_at: new Date(Date.now() + 365 * 86_400_000).toISOString(),
    });
    assert.equal(error, null, `parrainage : ${error?.message}`);
}

describe('2f — parrainage', () => {
    test('filleul inscrit : cloche et notification au parrain, sans nom ni numéro', async () => {
        const sponsor = await newBuyer('avis2-parrain');
        const referred = await newBuyer('avis2-filleul', { firstName: 'Khady', lastName: 'Filleule' });
        await linkReferral(sponsor.userId, referred.userId);
        const rows = await outboxRows({ type: 'REFERRAL_SIGNUP', userId: sponsor.userId });
        assert.deepEqual(channels(rows), ['IN_APP', 'PUSH'], describeRows(rows));
        const blob = JSON.stringify(rows.map((r) => r.template_data));
        assert.ok(!blob.includes('Khady') && !blob.includes(referred.phone9), `jamais le nom ni le numéro du filleul : ${blob}`);
        const r = renderNotification('REFERRAL_SIGNUP', 'IN_APP', rows[0].template_data, CTX);
        assert.deepEqual(r.channel === 'IN_APP' && [r.title, r.actionUrl], ['Nouveau filleul', '/wallet']);
    });

    test('contrôle de 9 h : commissions de la veille et commissions disponibles, une fois ; annulée jamais annoncée', async () => {
        const sponsor = await newBuyer('avis2-parrain2');
        const referred = await newBuyer('avis2-filleul2');
        await linkReferral(sponsor.userId, referred.userId);
        const partner = await newPartner('avis2-parrainage');
        const ev = await createPartnerEvent(partner.partnerId, 'avis2-parrainage', [{ name: 'Standard', price: 20_000, total: 20 }]);
        await buyConfirmed(referred, ev, [['Standard', 1]]);
        await buyConfirmed(referred, ev, [['Standard', 1]]);
        const { data: comms, error } = await service.from('referral_commissions').select('id, amount').eq('sponsor_id', sponsor.userId).eq('kind', 'COMMISSION');
        assert.equal(error, null, error?.message);
        assert.ok((comms ?? []).length >= 2, `commissions créées par les achats du filleul : ${JSON.stringify(comms)}`);
        // Contrôle « demain à 10 h » (Dakar) : la veille = aujourd'hui ; disponibles entre aujourd'hui 9 h et demain 9 h
        const tomorrow = dakarDay(1);
        const now = dakarAt(tomorrow, '10:00');
        const today9 = dakarAt(dakarDay(0), '09:00');
        const [kept, cancelled] = comms!;
        const { error: e1 } = await service.from('referral_commissions').update({ available_at: new Date(today9.getTime() + 3_600_000).toISOString() }).eq('id', kept.id);
        assert.equal(e1, null, e1?.message);
        const { error: e2 } = await service.from('referral_commissions').update({ status: 'CANCELLED', cancelled_at: new Date().toISOString(), cancellation_reason: 'Remboursement (test avis 2f)' }).eq('id', cancelled.id);
        assert.equal(e2, null, e2?.message);
        for (let i = 0; i < 2; i += 1) {
            const { data, error: dErr } = await service.rpc('notification_daily_checks', { p: { now: now.toISOString() } });
            assert.equal(dErr, null, dErr?.message);
            assert.equal((data as { ok?: boolean }).ok, true, JSON.stringify(data));
        }
        const earned = await outboxRows({ type: 'REFERRAL_EARNED', userId: sponsor.userId });
        assert.deepEqual(channels(earned), ['IN_APP', 'PUSH'], `une fois, cloche et notification : ${describeRows(earned)}`);
        const others = (comms ?? []).filter((c) => c.id !== cancelled.id);
        assert.equal(earned[0].template_data.count, others.length, 'commission annulée jamais annoncée');
        assert.equal(Number(earned[0].template_data.amount), others.reduce((a, c) => a + Number(c.amount), 0));
        const available = await outboxRows({ type: 'REFERRAL_AVAILABLE', userId: sponsor.userId });
        assert.deepEqual(channels(available), ['EMAIL', 'IN_APP', 'PUSH', 'SMS'], `une fois, quatre canaux : ${describeRows(available)}`);
        assert.equal(Number(available[0].template_data.amount), Number(kept.amount));
        const sms = renderNotification('REFERRAL_AVAILABLE', 'SMS', available[0].template_data, CTX);
        assert.match(sms.channel === 'SMS' ? sms.text : '', /^Event Village : .+ F CFA de commissions de parrainage sont disponibles\. Retirez-les : https:\/\/app\.eventvillage\.sn\/wallet$/);
    });
});

describe('2g — paiement non abouti', () => {
    test('échec : SMS, notification, cloche à 10 minutes ; second échec du panier : rien de plus ; panier payé : avis annulé', async () => {
        const ev = await createSaleEvent('avis2-echec', [{ name: 'Standard', price: 5_000, total: 30 }]);
        const buyer = await newBuyer('avis2-echec');
        const items: Array<[string, number]> = [[ev.categories.Standard.id, 2]];
        const failOnce = async (): Promise<string> => {
            const r = await checkout(buyer, cart(ev.eventId, items, buyer));
            assert.equal(r.status, 200, JSON.stringify(r.body));
            providerSays(r.payment!, 'FAILED');
            await pollStatus(buyer.accessToken, r.payment!.id);
            assert.equal((await paymentById(r.payment!.id)).status, 'FAILED', 'paiement en échec');
            return r.payment!.id;
        };
        await failOnce();
        let rows = await outboxRows({ type: 'PAYMENT_NOT_COMPLETED', userId: buyer.userId });
        assert.deepEqual(channels(rows), ['IN_APP', 'PUSH', 'SMS'], `sans email (D1) : ${describeRows(rows)}`);
        const delay = Date.parse(rows[0].due_at) - Date.parse(rows[0].created_at);
        assert.ok(delay >= 9 * 60_000 && delay <= 11 * 60_000, `dû 10 minutes plus tard : ${delay} ms`);
        const sms = renderNotification('PAYMENT_NOT_COMPLETED', 'SMS', rows.find((r) => r.channel === 'SMS')!.template_data, CTX);
        assert.match(sms.channel === 'SMS' ? sms.text : '', /^Event Village : paiement non abouti pour .+\. Rien n'a été débité\. Réessayez : https:\/\/app\.eventvillage\.sn\/tickets$/);
        const app = renderNotification('PAYMENT_NOT_COMPLETED', 'IN_APP', rows.find((r) => r.channel === 'IN_APP')!.template_data, CTX);
        assert.equal(app.channel === 'IN_APP' && app.actionUrl, `/events/${ev.eventId}`, 'la cloche mène à l’événement');

        await failOnce();
        rows = await outboxRows({ type: 'PAYMENT_NOT_COMPLETED', userId: buyer.userId });
        assert.equal(rows.length, 3, `une fois par panier : ${describeRows(rows)}`);

        const ok = await checkout(buyer, cart(ev.eventId, items, buyer));
        assert.equal(ok.status, 200, JSON.stringify(ok.body));
        providerSays(ok.payment!, 'SUCCESS');
        await deliverWebhook(ok.payment!);
        assert.equal((await paymentById(ok.payment!.id)).status, 'SUCCESS');
        rows = await outboxRows({ type: 'PAYMENT_NOT_COMPLETED', userId: buyer.userId });
        assert.deepEqual(rows.map((r) => [r.status, r.reason]), [['CANCELLED', 'SUPERSEDED'], ['CANCELLED', 'SUPERSEDED'], ['CANCELLED', 'SUPERSEDED']],
            `panier payé : plus d'avis : ${describeRows(rows)}`);
    });
});

describe('D8 — avis juste avant l’anonymisation', () => {
    test('SMS au numéro et email à l’adresse vérifiée, partis avant l’effacement', async () => {
        const { AdminService } = await import('../../lib/admin/admin.service');
        const target = await newBuyer('avis2-anonyme');
        const email = `avis2-${randomUUID().slice(0, 8)}@exemple-reel.sn`;
        const { error: eErr } = await service.from('users').update({ email }).eq('id', target.userId);
        assert.equal(eErr, null, eErr?.message);
        await markEmailVerified(target.userId);
        const { data: sa, error: saErr } = await service.from('user_roles').select('user_id').eq('role', 'SUPERADMIN').limit(1).single();
        assert.equal(saErr, null, saErr?.message);
        const mark = smsMark(target.phoneE164);
        const mails = emailsTo(email).length;
        await AdminService.anonymizeUser(target.userId, { id: String(sa!.user_id), role: 'SUPERADMIN' });
        const rows = await outboxRows({ type: 'ACCOUNT_ANONYMIZATION_NOTICE', userId: target.userId });
        assert.deepEqual(rows.map((r) => [r.channel, r.status]).sort(), [['EMAIL', 'SENT'], ['SMS', 'SENT']], describeRows(rows));
        const got = smsTo(target.phoneE164, mark);
        assert.equal(got.length, 1, 'un SMS au numéro du compte');
        assert.match(got[0].message, /votre compte est supprimé par l'équipe/);
        assert.equal(emailsTo(email).length, mails + 1, 'un email à l’adresse vérifiée');
        const { data: u } = await service.from('users').select('phone, email').eq('id', target.userId).single();
        assert.notEqual(u!.email, email, 'adresse effacée après l’avis');
    });
});
