/**
 * Lot 1C.8 — l'email (Resend) est optionnel, le SMS (MTarget) obligatoire ; ce processus retire RESEND_API_KEY.
 * Lot 7 (T18, D1) : inscription client « numéro d'abord » par registerClientFlow, mêmes assertions.
 * Lot 9 bis (T38, R53, G53-10) : inscription partenaire en deux appels (registerPartnerTwoStep, rouge jusqu'à fix(9b.17)) ;
 * acheteur neuf vérifié (G.49 : sinon EMAIL_NOT_VERIFIED masquerait EMAIL_NOT_CONFIGURED, M10) ; G53-10 en fin de fichier
 * (lien de vérification jamais tenté, journal SKIPPED, SMS inchangés, renvoi 503 sans quota, rouge jusqu'à fix(9b.48)).
 *  - Inscription client, inscription partenaire (avis aux admins) et achat de billet : aucune erreur, SMS envoyés
 *    (faux adaptateur), AUCUN email tenté ; un seul avertissement « email désactivé » pour tout le processus.
 *  - Sans identifiants MTarget, la configuration serveur est refusée.
 */
import '../helpers/env';
import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { getServiceRoleClient } from '../../lib/supabase/server';
import { getServerEnv, resetServerEnvCache } from '../../lib/env';
import { bearer, loadFixtures } from '../helpers/fixtures';
import { POST as checkout } from '../../app/api/checkout/route';
import { POST as samirpayWebhook } from '../../app/api/webhooks/samirpay/route';
import { getFakes, resetFakes } from '../fakes';
import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { jsonRequest, randomEmail, randomSenegalPhone, registerPartnerTwoStep, STRONG_PASSWORD, uploadRegistrationDocuments } from './helpers';
import { advanceEventTo, posterUrl } from './cycle-helpers';
import { flushNotifications, loadLotModule, markEmailVerified, outboxRows } from './notif-helpers';
import { newBuyer } from './paiement-helpers';
import { registerClientFlow } from './terrain-helpers';
import { gotrueEmail } from '../helpers/gotrue-email';

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
        start_date: date, start_time: '19:00:00', location: 'Salle de test, Dakar', city: 'Dakar', capacity: 20,
        // Lot 5 : inséré en BROUILLON (forcé par la base), publié par les RPC de transition
        image_url: posterUrl(fx.partners.A.id),
    }).select('id').single();
    assert.equal(error, null, `événement : ${error?.message}`);
    eventId = event.id;
    const { data: cat, error: catErr } = await service.from('ticket_categories')
        .insert({ event_id: eventId, name: 'Standard', price: 1500, total_quantity: 5, sold_quantity: 0, is_active: true })
        .select('id').single();
    assert.equal(catErr, null, `catégorie : ${catErr?.message}`);
    categoryId = cat.id;
    await advanceEventTo(eventId, 'PUBLIE');
});

after(() => {
    console.warn = originalWarn;
});

describe('Email optionnel, SMS obligatoire', () => {
    test('inscriptions et achat sans RESEND_API_KEY : SMS envoyés, aucun email tenté, un seul avertissement', async () => {
        const clientPhone = randomSenegalPhone('77');
        const reg = await registerClientFlow({
            firstName: 'Sans', lastName: 'Email', phone: clientPhone, email: randomEmail('sans-email'), password: STRONG_PASSWORD,
        }, { expectOk: false });
        assert.equal(reg.register?.status, 200, `inscription client : démarrage HTTP ${reg.start.status} ${JSON.stringify(reg.start.body)}, inscription HTTP ${reg.register?.status} ${JSON.stringify(reg.register?.body)}`);
        assert.ok(getFakes().sms.messagesTo(clientPhone).length >= 1, 'SMS OTP envoyé au client');

        const partnerPhone = randomSenegalPhone('78');
        // Lot 9 bis (T38, R53) : deux appels de la même route, code lu dans le faux SMS du numéro.
        const regPartner = await registerPartnerTwoStep({
            companyName: 'Sans Email SARL', description: 'Partenaire fictif, canal email désactivé.', address: '1 rue Sans Email',
            city: 'Dakar', activities: ['ORGANISATEUR'], firstName: 'Pape', lastName: 'Sansemail', phone: partnerPhone,
            email: randomEmail('partenaire-sans-email'), password: STRONG_PASSWORD, confirmPassword: STRONG_PASSWORD,
            ...(await uploadRegistrationDocuments()),
        });
        assert.equal(regPartner.first.status, 200, `inscription partenaire, appel 1 : HTTP ${regPartner.first.status} ${JSON.stringify(regPartner.first.body)}`);
        assert.equal(regPartner.second?.status, 201, `inscription partenaire, appel 2 : HTTP ${regPartner.second?.status} ${JSON.stringify(regPartner.second?.body)}`);
        assert.ok(getFakes().sms.messagesTo(partnerPhone).length >= 1, 'SMS envoyé au partenaire');

        // Lot 9 bis (G.49, B96) : acheteur neuf à l'adresse vérifiée, sinon la ligne EMAIL serait SKIPPED EMAIL_NOT_VERIFIED
        // dès la mise en file et le motif EMAIL_NOT_CONFIGURED testé ci-dessous ne serait plus atteint.
        const client = await newBuyer('sans-email-acheteur');
        await markEmailVerified(client.userId);
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
        // Lot 6 (T) : la confirmation d'achat part par la boîte d'envoi ; passage de l'envoyeur sur ses lignes.
        const purchaseRows = await outboxRows({ keyPrefix: `PURCHASE_CONFIRMED:${body.payment_id}:` });
        assert.ok(purchaseRows.length > 0, 'confirmation d’achat mise en file');
        await flushNotifications({ ids: purchaseRows.map((r) => r.id) });
        assert.ok(getFakes().sms.messagesTo(buyerPhone).length >= 1, 'SMS de confirmation d’achat envoyé');

        assert.equal(getFakes().email.sent.length, 0, `emails tentés sans RESEND_API_KEY : ${getFakes().email.sent.map((e) => e.to).join(', ')}`);
        const emailRows = (await outboxRows({ ids: purchaseRows.map((r) => r.id) })).filter((r) => r.channel === 'EMAIL');
        assert.equal(emailRows.length, 1, 'une ligne EMAIL pour la confirmation d’achat');
        assert.deepEqual([emailRows[0].status, emailRows[0].reason], ['SKIPPED', 'EMAIL_NOT_CONFIGURED'],
            'aucun email tenté : ligne EMAIL SKIPPED EMAIL_NOT_CONFIGURED (motif explicite, contrat F3)');
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

describe('Lot 9 bis (G53-10, contrat 4.6) — sans RESEND_API_KEY : le lien de vérification n’est jamais tenté, les SMS ne changent pas', () => {
    const NOT_CONFIGURED = 'L’envoi des emails n’est pas encore disponible. Votre adresse est enregistrée : vous pourrez la vérifier plus tard.';
    const plain = (s: string): string => s.replace(/[  ]/g, ' ').replace(/[’‘]/g, '\'');
    const ip = (n: number): Record<string, string> => ({ 'x-forwarded-for': `198.19.${(process.pid % 200) + 1}.${n}` });

    test('inscription avec email → 200 NOT_CONFIGURED, aucun email tenté, journal EMAIL_VERIFICATION SKIPPED EMAIL_NOT_CONFIGURED, SMS identiques sans email ; renvoi → 503 sans quota consommé', async () => {
        const attempted = getFakes().email.sent.length;
        const address = randomEmail('g53-10');
        const withEmail = await registerClientFlow({ email: address, headers: ip(201) });
        assert.deepEqual([withEmail.register?.body.email_pending, withEmail.register?.body.email_verification], [address, 'NOT_CONFIGURED'],
            `réponse de l’inscription (contrat 4.6) : ${JSON.stringify(withEmail.register?.body)}`);
        const withoutEmail = await registerClientFlow({ headers: ip(202) });
        const shape = (phone: string): string[] => getFakes().sms.messagesTo(phone).map((m) => m.message.replace(/\b\d{6}\b/g, '{code}'));
        assert.equal(shape(withEmail.phone).length, 1, `un seul SMS à l’inscription avec email (le code) : ${JSON.stringify(shape(withEmail.phone))}`);
        assert.deepEqual(shape(withEmail.phone), shape(withoutEmail.phone), 'SMS d’inscription identiques, en nombre et en texte, avec ou sans email');
        const journal = await outboxRows({ type: 'EMAIL_VERIFICATION', userId: withEmail.userId! });
        assert.deepEqual(journal.map((r) => [r.origin, r.channel, r.status, r.reason]), [['SYNC_LOG', 'EMAIL', 'SKIPPED', 'EMAIL_NOT_CONFIGURED']],
            'journal du lien : non tenté, motif explicite');

        const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
        const { data: s, error } = await anon.auth.signInWithPassword({ email: await gotrueEmail(String(withEmail.register?.body.email)), password: STRONG_PASSWORD });
        assert.equal(error, null, `connexion du compte inscrit : ${error?.message}`);
        const mod = await loadLotModule('../../app/api/account/email/resend/route', 'route POST /api/account/email/resend (contrat 4.6, fix(9b.48))');
        assert.equal(typeof mod.POST, 'function', 'POST /api/account/email/resend non exporté');
        const resend = mod.POST as (req: NextRequest) => Promise<Response>;
        // Quatre renvois : le quota (trois par heure) n'est jamais consommé quand l'envoi n'est pas configuré, donc jamais de 429.
        for (let i = 1; i <= 4; i++) {
            const res = await resend(jsonRequest('/api/account/email/resend', {}, { authorization: `Bearer ${s.session!.access_token}` }));
            const body = await res.json() as Record<string, unknown>;
            assert.equal(res.status, 503, `renvoi ${i} : HTTP ${res.status} ${JSON.stringify(body)}`);
            assert.equal(body.code, 'EMAIL_NOT_CONFIGURED', `renvoi ${i} : ${JSON.stringify(body)}`);
            assert.equal(plain(String(body.error ?? '')), plain(NOT_CONFIGURED), `renvoi ${i} : message du contrat`);
        }
        assert.equal(getFakes().email.sent.length, attempted, 'aucun email tenté sans RESEND_API_KEY');
    });
});
