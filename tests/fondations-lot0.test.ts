/**
 * Preuve des fondations de vérification (lot 0) :
 *  - garde-fou anti-base réelle (URL locale, variables gelées, verrou réseau) ;
 *  - faux adaptateurs SMS / email / SamirPay branchés sur les façades métier ;
 *  - validation Zod de l'environnement serveur ;
 *  - seed de test résolu par les fixtures (aucun UUID codé en dur).
 */
import { getBlockedRequests } from './helpers/env';
import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { getFakes, resetFakes } from './fakes';
import { FIXTURE_EVENTS, loadFixtures } from './helpers/fixtures';
import { mTargetService } from '../lib/sms/mtarget.service';
import { EmailService } from '../lib/email/email.service';
import { samirPayClient } from '../lib/samirpay/client';
import { getServerEnv, resetServerEnvCache, ServerEnvError } from '../lib/env';

describe('LOT 0 — fondations de vérification', () => {
    beforeEach(() => resetFakes());

    test('le garde-fou impose une instance Supabase locale', () => {
        const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname;
        assert.ok(['localhost', '127.0.0.1', '::1', '[::1]'].includes(host), `hôte Supabase non local : ${host}`);
        assert.equal(process.env.EV_INTEGRATIONS, 'fake');
    });

    test('les variables Supabase sont gelées pendant les tests', () => {
        assert.throws(
            () => { process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://projet-distant.supabase.co'; },
            /garde-fou anti-base réelle/
        );
        assert.throws(() => { delete process.env.SUPABASE_SERVICE_ROLE_KEY; }, /interdite pendant les tests/);
    });

    test('toute requête réseau vers un hôte externe est bloquée', async () => {
        const before = getBlockedRequests().length;
        await assert.rejects(() => fetch('https://api.resend.com/emails', { method: 'POST' }), /Requête réseau externe bloquée/);
        await assert.rejects(() => fetch('https://api-public-2.mtarget.fr/messages'), /Requête réseau externe bloquée/);
        assert.equal(getBlockedRequests().length, before + 2);
    });

    test('SMS : la façade mTargetService passe par le faux adaptateur', async () => {
        const { sms } = getFakes();
        const res = await mTargetService.sendOtp('77 123 45 67', '482910');
        assert.equal(res.success, true);
        assert.equal(sms.sent.length, 1);
        assert.equal(sms.sent[0].recipient, '00221771234567');
        assert.match(sms.sent[0].message, /482910/);

        sms.failNext('opérateur indisponible');
        const failed = await mTargetService.sendNotification('+221771234567', 'test');
        assert.equal(failed.success, false);
        assert.equal(failed.error, 'opérateur indisponible');
    });

    test('Email : EmailService.send passe par le faux adaptateur', async () => {
        const { email } = getFakes();
        const res = await EmailService.send({ to: 'client@test.eventvillage.local', subject: 'Billet', html: '<p>ok</p>' });
        assert.equal(res.sent, true);
        assert.equal(email.messagesTo('client@test.eventvillage.local').length, 1);
    });

    test('SamirPay : init réussi, refus dans le corps, exception, statut piloté', async () => {
        const { payment } = getFakes();
        const base = { amount: 5000, currency: 'XOF', order_id: 'ORD-TEST-1', operatorName: 'WAVE' };

        const ok = await samirPayClient.initPayment(base);
        assert.equal(ok.status, 'success');
        assert.ok(ok.transaction_id);

        payment.initMode = 'failed-body';
        const refused = await samirPayClient.initPayment({ ...base, order_id: 'ORD-TEST-2' });
        assert.equal(refused.status, 'failed');

        payment.initMode = 'throw';
        await assert.rejects(() => samirPayClient.initPayment({ ...base, order_id: 'ORD-TEST-3' }), /simulation/);

        assert.equal((await samirPayClient.checkTransactionStatus('ORD-TEST-1')).status, 'pending');
        payment.setTransactionStatus('ORD-TEST-1', 'success');
        assert.equal((await samirPayClient.checkTransactionStatus('ORD-TEST-1')).status, 'success');
        payment.setTransactionStatus('ORD-TEST-1', 'failed');
        assert.equal((await samirPayClient.checkTransactionStatus('ORD-TEST-1')).status, 'failed');

        assert.equal(payment.callsOf('initPayment').length, 3);
    });

    test('SamirPay : webhooks générés signés ou non signés', () => {
        const { payment } = getFakes();
        const signed = payment.buildWebhook({ order_id: 'ORD-TEST-9', status: 'success', amount: 5000, currency: 'XOF' });
        assert.ok(signed.fields.signature);
        assert.equal(signed.headers['x-samirpay-signature'], signed.fields.signature);

        const unsigned = payment.buildWebhook({ order_id: 'ORD-TEST-9', status: 'success', signed: false });
        assert.equal(unsigned.fields.signature, undefined);
        assert.equal(unsigned.headers['x-samirpay-signature'], undefined);

        const wrong = payment.buildWebhook({ order_id: 'ORD-TEST-9', status: 'success', amount: 5000, currency: 'XOF', secret: 'mauvais-secret' });
        assert.notEqual(wrong.fields.signature, signed.fields.signature);
    });

    test('lib/env : échec explicite si une variable requise manque', () => {
        const saved = process.env.SAMIRPAY_API_KEY;
        try {
            delete process.env.SAMIRPAY_API_KEY;
            resetServerEnvCache();
            assert.throws(() => getServerEnv(), (err: unknown) => err instanceof ServerEnvError && /SAMIRPAY_API_KEY/.test(err.message));
        } finally {
            process.env.SAMIRPAY_API_KEY = saved;
            resetServerEnvCache();
        }
        assert.equal(getServerEnv().SAMIRPAY_API_KEY, saved);
    });

    test('seed de test : fixtures résolues depuis la base locale', async () => {
        const fx = await loadFixtures(true);
        const a = fx.events.A_PUBLIE;
        assert.equal(a.status, 'PUBLIE');
        assert.equal(a.partnerId, fx.partners.A.id);
        assert.deepEqual(
            { price: a.categories.Standard.price, total: a.categories.Standard.total_quantity },
            { price: 5000, total: 10 }
        );
        assert.deepEqual(
            { price: a.categories.VIP.price, total: a.categories.VIP.total_quantity },
            { price: 15000, total: 3 }
        );
        assert.equal(fx.events.A_BROUILLON.status, 'BROUILLON');
        assert.equal(fx.events.B_PUBLIE.partnerId, fx.partners.B.id);
        assert.notEqual(fx.users.CLIENT.id, fx.users.CLIENT_BIS.id);
        assert.equal(Object.keys(fx.events).length, Object.keys(FIXTURE_EVENTS).length);
    });
});
