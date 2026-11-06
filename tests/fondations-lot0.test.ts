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
import fs from 'node:fs';
import path from 'node:path';
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

    // Lot 2 : faux SamirPay aligné sur le contrat (cashin direct, statut par identifiant SamirPay,
    // aucune signature de webhook). Cas réécrits ; l'ancien contrat (initPayment, refus dans le
    // corps, webhook signé provisoire) n'existe plus.
    test('SamirPay : cashin direct réussi, refus, délai dépassé, doublon d’orderId, statut piloté', async () => {
        const { payment } = getFakes();
        const base = { amount: 5000, orderId: 'ORD-EV-1700000000000-AAAAAA', callBackUrl: 'http://127.0.0.1:3000/api/webhooks/samirpay?t=x', operatorName: 'WAVE' as const, telephone: '771234567' };

        const ok = await samirPayClient.initDirectPayment(base);
        assert.match(ok.transactionId, /^[0-9a-f-]{36}$/);

        await assert.rejects(() => samirPayClient.initDirectPayment(base), (e: { kind?: string }) => e.kind === 'DUPLICATE');

        payment.setInitMode('rejected');
        await assert.rejects(() => samirPayClient.initDirectPayment({ ...base, orderId: 'ORD-EV-1700000000000-BBBBBB' }), (e: { kind?: string }) => e.kind === 'REJECTED');
        payment.setInitMode('timeout');
        await assert.rejects(() => samirPayClient.initDirectPayment({ ...base, orderId: 'ORD-EV-1700000000000-CCCCCC' }), (e: { kind?: string }) => e.kind === 'UNCERTAIN');
        payment.setInitMode('success');

        assert.equal((await samirPayClient.checkTransactionStatus(ok.transactionId)).status, 'PENDING');
        payment.setTransactionStatus(ok.transactionId, 'SUCCESS');
        assert.deepEqual(await samirPayClient.checkTransactionStatus(ok.transactionId), { transactionId: ok.transactionId, status: 'SUCCESS' });
        await assert.rejects(() => samirPayClient.checkTransactionStatus('00000000-0000-4000-8000-000000000000'), (e: { kind?: string }) => e.kind === 'NOT_FOUND');

        assert.equal(payment.callsOf('initDirectPayment').length, 4);
    });

    test('SamirPay : webhook form-urlencoded vers le callBackUrl reçu, uniquement en cas de succès', async () => {
        const { payment } = getFakes();
        const init = await samirPayClient.initDirectPayment({ amount: 1000, orderId: 'ORD-EV-1700000000000-DDDDDD', callBackUrl: 'http://127.0.0.1:3000/api/webhooks/samirpay?t=jeton', operatorName: 'ORANGE_MONEY', telephone: '781234567' });
        assert.throws(() => payment.buildWebhook(init.transactionId), /succès/, 'aucun webhook tant que la transaction n’est pas SUCCESS');
        payment.setTransactionStatus(init.transactionId, 'SUCCESS');
        const hook = payment.buildWebhook(init.transactionId);
        assert.equal(hook.url, 'http://127.0.0.1:3000/api/webhooks/samirpay?t=jeton');
        assert.equal(hook.headers['content-type'], 'application/x-www-form-urlencoded');
        assert.deepEqual(Object.fromEntries(new URLSearchParams(hook.body)), { transaction_id: init.transactionId, order_id: 'ORD-EV-1700000000000-DDDDDD', status: 'success' });
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

    // Lot 8 (8.2 w, L70, T38) : sans cette option, npm ci prouve en CI que le lock et les paquets pairs concordent.
    test('npm : legacy-peer-deps=true n’est plus actif dans le dépôt', () => {
        const npmrc = path.join(process.cwd(), '.npmrc');
        const content = fs.existsSync(npmrc) ? fs.readFileSync(npmrc, 'utf8') : '';
        assert.doesNotMatch(content, /^\s*legacy-peer-deps\s*=\s*true\b/m, '.npmrc active encore legacy-peer-deps=true');
    });
});
