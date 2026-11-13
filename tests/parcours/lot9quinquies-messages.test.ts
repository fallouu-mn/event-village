/**
 * Lot 9 quinquies, C2 (AUTH-09) et C3 (AUTH-12) — messages de sécurité du compte.
 *
 * C2 : quand une nouvelle adresse email est vérifiée, SMS indispensable au numéro du compte « Event Village : une adresse
 *      email a été ajoutée à votre compte. Si ce n'est pas vous : {lien}/aide » ; en cas de changement, email à
 *      l'ancienne adresse vérifiée.
 * C3 : accusé de réception de la partenaire par SMS « Event Village : votre demande de compte partenaire {société} est
 *      enregistrée. Réponse sous 48 h. » (« reçue » : ç hors GSM-7).
 * Rouge avant correctif : aucun avis à la vérification d'une adresse ; accusé de la partenaire dans la cloche et par
 * email seulement.
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { assertLot9quinquiesInvariants } from '../helpers/lot9quinquies-invariants';
import { getFakes } from '../fakes';
import { BASE_URL, randomEmail, randomSenegalPhone, registerPartnerTwoStep, STRONG_PASSWORD, uploadRegistrationDocuments } from './helpers';
import { newBuyer, service } from './paiement-helpers';
import { dispatchAt, emailsTo, markEmailVerified, outboxRows } from './notif-helpers';

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '');

after(async () => {
    await assertLot9quinquiesInvariants('lot9quinquies-messages');
});

/** Adresse mise en attente, lien envoyé (faux adaptateur), jeton lu dans l'email, puis validation par la route. */
async function verifyNewAddress(userId: string, address: string): Promise<void> {
    const { error } = await service.from('users').update({ email_pending: address }).eq('id', userId);
    assert.equal(error, null, error?.message);
    const { sendEmailVerification } = await import('../../lib/email/verification');
    const since = getFakes().email.messagesTo(address).length;
    const sent = await sendEmailVerification(userId);
    assert.equal(sent.outcome, 'SENT', `lien de vérification : ${JSON.stringify(sent)}`);
    const mail = getFakes().email.messagesTo(address).slice(since).at(-1);
    const token = /verify-email\?t=([A-Za-z0-9_-]+)/.exec(`${mail?.text ?? ''} ${mail?.html ?? ''}`)?.[1];
    assert.ok(token, 'jeton dans l\'email de vérification');
    const { POST } = (await import('../../app/api/account/email/verify/route')) as { POST: (r: NextRequest) => Promise<Response> };
    const res = await POST(new NextRequest(`${BASE_URL}/api/account/email/verify`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token }) }));
    assert.equal(res.status, 200, `validation : ${JSON.stringify(await res.json())}`);
}

describe('C2 — avis quand une adresse email est vérifiée', () => {
    test('nouvelle adresse vérifiée : SMS au numéro du compte, texte exact', async () => {
        const user = await newBuyer('c2-ajout');
        await verifyNewAddress(user.userId, randomEmail('c2-ajout'));
        const rows = await outboxRows({ type: 'EMAIL_ADDED', userId: user.userId, channel: 'SMS' });
        assert.equal(rows.length, 1, `SMS EMAIL_ADDED mis en file : ${JSON.stringify(rows.map((r) => [r.status, r.reason]))}`);
        const since = getFakes().sms.messagesTo(user.phoneE164).length;
        await dispatchAt(new Date(), { ids: rows.map((r) => r.id) });
        assert.deepEqual(getFakes().sms.messagesTo(user.phoneE164).slice(since).map((m) => m.message),
            [`Event Village : une adresse email a été ajoutée à votre compte. Si ce n'est pas vous : ${APP_URL}/aide`]);
    });

    test('changement d\'adresse : email à l\'ancienne adresse vérifiée', async () => {
        const user = await newBuyer('c2-change');
        await markEmailVerified(user.userId);
        const { data: before } = await service.from('users').select('email').eq('id', user.userId).single();
        const oldAddress = String(before?.email);
        const since = getFakes().email.messagesTo(oldAddress).length;
        await verifyNewAddress(user.userId, randomEmail('c2-nouvelle'));
        const warned = emailsTo(oldAddress, since).filter((m) => m.subject === 'Adresse email de votre compte modifiée — Event Village');
        assert.equal(warned.length, 1, `email à l'ancienne adresse : ${JSON.stringify(emailsTo(oldAddress, since).map((m) => m.subject))}`);
        assert.ok(!warned[0].html.includes(oldAddress), 'aucune adresse écrite dans l\'avis');
    });
});

describe('C3 — accusé de réception de la partenaire par SMS', () => {
    test('inscription partenaire : SMS « votre demande de compte partenaire … est enregistrée. Réponse sous 48 h. »', async () => {
        const company = `Ndaje ${randomUUID().slice(0, 6)} SARL`;
        const phone = randomSenegalPhone('77');
        const reg = await registerPartnerTwoStep({
            companyName: company, description: 'Organisateur fictif (lot 9 quinquies, C3).', address: '3 rue de l’Accusé', city: 'Dakar',
            activities: ['ORGANISATEUR'], firstName: 'Khady', lastName: 'Accuse', phone, email: randomEmail('c3-partenaire'),
            password: STRONG_PASSWORD, confirmPassword: STRONG_PASSWORD, ...(await uploadRegistrationDocuments()),
        });
        assert.equal(reg.second?.status, 201, JSON.stringify(reg.second?.body));
        const { data: user } = await service.from('users').select('id').in('phone', [phone, phone.replace(/^\+/, '')]).single();
        const rows = await outboxRows({ type: 'PARTNER_REGISTERED_ACK', userId: String(user?.id), channel: 'SMS' });
        assert.equal(rows.length, 1, 'SMS d\'accusé de réception mis en file');
        const since = getFakes().sms.messagesTo(phone).length;
        await dispatchAt(new Date(), { ids: rows.map((r) => r.id) });
        assert.deepEqual(getFakes().sms.messagesTo(phone).slice(since).map((m) => m.message),
            [`Event Village : votre demande de compte partenaire ${company} est enregistrée. Réponse sous 48 h.`]);
    });
});
