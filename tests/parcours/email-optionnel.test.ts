/**
 * Lot 1C.8 — l'email (Resend) est optionnel, le SMS (MTarget) obligatoire.
 * Ce processus de test retire RESEND_API_KEY (chaque suite a son propre processus).
 *  - Inscription client, inscription partenaire (avis aux admins) et achat de billet : aucune
 *    erreur, SMS envoyés (faux adaptateur), AUCUN email tenté.
 *  - Un seul avertissement « email désactivé » pour tout le processus.
 *  - Sans identifiants MTarget, la configuration serveur est refusée.
 */
import '../helpers/env';
import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { getServiceRoleClient } from '../../lib/supabase/server';
import { getServerEnv, resetServerEnvCache } from '../../lib/env';
import { bearer, loadFixtures, signInAs } from '../helpers/fixtures';
import { POST as registerClient } from '../../app/api/auth/register/route';
import { POST as registerPartner } from '../../app/api/partner/register/route';
import { POST as checkout } from '../../app/api/checkout/route';
import { POST as samirpayWebhook } from '../../app/api/webhooks/samirpay/route';
import { getFakes, resetFakes } from '../fakes';
import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { jsonRequest, randomEmail, randomSenegalPhone, STRONG_PASSWORD, uploadRegistrationDocuments } from './helpers';

const warnings: string[] = [];
const originalWarn = console.warn;
let eventId = '';
let categoryId = '';

before(async () => {
    delete process.env.RESEND_API_KEY;
    resetServerEnvCache();
    resetFakes();
    console.warn = (...args: unknown[]) => {
        warnings.push(args.map(String).join(' '));
        originalWarn(...args);
    };
    const fx = await loadFixtures();
    const service = getServiceRoleClient();
    const date = new Date(Date.now() + 41 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const { data: event, error } = await service.from('events').insert({
        partner_id: fx.partners.A.id, title: `TEST Email optionnel ${Date.now()}`, description: 'Achat sans canal email.',
        start_date: date, start_time: '19:00:00', location: 'Salle de test, Dakar', city: 'Dakar', capacity: 20, status: 'PUBLIE',
    }).select('id').single();
    assert.equal(error, null, `événement : ${error?.message}`);
    eventId = event.id;
    const { data: cat, error: catErr } = await service.from('ticket_categories')
        .insert({ event_id: eventId, name: 'Standard', price: 1500, total_quantity: 5, sold_quantity: 0, is_active: true })
        .select('id').single();
    assert.equal(catErr, null, `catégorie : ${catErr?.message}`);
    categoryId = cat.id;
});

after(() => {
    console.warn = originalWarn;
});

describe('Email optionnel, SMS obligatoire', () => {
    test('inscriptions et achat sans RESEND_API_KEY : SMS envoyés, aucun email tenté, un seul avertissement', async () => {
        const clientPhone = randomSenegalPhone('77');
        const reg = await registerClient(jsonRequest('/api/auth/register', {
            firstName: 'Sans', lastName: 'Email', phone: clientPhone, email: randomEmail('sans-email'),
            password: STRONG_PASSWORD, confirmPassword: STRONG_PASSWORD,
        }));
        assert.equal(reg.status, 200, `inscription client : HTTP ${reg.status} ${JSON.stringify(await reg.json())}`);
        assert.ok(getFakes().sms.messagesTo(clientPhone).length >= 1, 'SMS OTP envoyé au client');

        const partnerPhone = randomSenegalPhone('78');
        const regPartner = await registerPartner(jsonRequest('/api/partner/register', {
            companyName: 'Sans Email SARL', description: 'Partenaire fictif, canal email désactivé.', address: '1 rue Sans Email',
            city: 'Dakar', activities: ['ORGANISATEUR'], firstName: 'Pape', lastName: 'Sansemail', phone: partnerPhone,
            email: randomEmail('partenaire-sans-email'), password: STRONG_PASSWORD, confirmPassword: STRONG_PASSWORD,
            ...(await uploadRegistrationDocuments()),
        }));
        assert.ok(regPartner.status < 300, `inscription partenaire : HTTP ${regPartner.status} ${JSON.stringify(await regPartner.json())}`);
        assert.ok(getFakes().sms.messagesTo(partnerPhone).length >= 1, 'SMS envoyé au partenaire');

        const client = await signInAs('CLIENT');
        const buyerPhone = randomSenegalPhone('76');
        const res = await checkout(jsonRequest('/api/checkout', {
            eventId, items: [{ categoryId, quantity: 1 }], operator: 'WAVE', payerPhone: buyerPhone.slice(4),
        }, { ...bearer(client.accessToken), 'idempotency-key': randomUUID() }));
        const body = await res.json();
        assert.equal(res.status, 200, `checkout : HTTP ${res.status} ${JSON.stringify(body)}`);
        const { payment } = getFakes();
        const { data: pending } = await getServiceRoleClient().from('payments').select('id, amount, external_transaction_id').eq('id', body.payment_id).single();
        payment.setTransactionStatus(pending!.external_transaction_id, 'SUCCESS');
        const hook = payment.buildWebhook(pending!.external_transaction_id);
        const hookRes = await samirpayWebhook(new NextRequest(hook.url, { method: 'POST', headers: hook.headers, body: hook.body }));
        assert.equal(hookRes.status, 200, `webhook : HTTP ${hookRes.status} ${JSON.stringify(await hookRes.json())}`);
        assert.ok(getFakes().sms.messagesTo(buyerPhone).length >= 1, 'SMS de confirmation d’achat envoyé');

        assert.equal(getFakes().email.sent.length, 0, `emails tentés sans RESEND_API_KEY : ${getFakes().email.sent.map((e) => e.to).join(', ')}`);
        const emailWarnings = warnings.filter((w) => /email/i.test(w) && /d[ée]sactiv/i.test(w));
        assert.equal(emailWarnings.length, 1, `un seul avertissement « email désactivé » attendu, obtenu ${emailWarnings.length} :\n${warnings.filter((w) => /email|resend/i.test(w)).join('\n')}`);
    });

    test('sans identifiants MTarget, la configuration serveur est refusée', () => {
        const saved = { u: process.env.MTARGET_USERNAME, p: process.env.MTARGET_PASSWORD };
        delete process.env.MTARGET_USERNAME;
        resetServerEnvCache();
        try {
            assert.throws(() => getServerEnv(), /MTARGET_USERNAME/, 'MTARGET_USERNAME doit être obligatoire');
        } finally {
            if (saved.u !== undefined) process.env.MTARGET_USERNAME = saved.u;
            resetServerEnvCache();
        }
        assert.doesNotThrow(() => getServerEnv(), 'sans RESEND_API_KEY, la configuration reste valide');
    });
});
