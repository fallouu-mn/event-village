/**
 * Contre-vérification du lot 9 quinquies, attaque 6 — un compte SUSPENDU ne reçoit aucun SMS de code (A5).
 *
 * Toutes les routes qui envoient un code par SMS, appelées avec le numéro d'un compte suspendu : connexion, « mot de passe
 * oublié », inscription (numéro déjà inscrit), changement de numéro demandé par un autre compte vers ce numéro, connexion
 * par code directement chez GoTrue ; et, pour un ADMIN suspendu avec un jeton d'avant la suspension, le code
 * administrateur. Aucun SMS ne doit partir vers ce numéro.
 */
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { assertLot9quinquiesInvariants } from '../helpers/lot9quinquies-invariants';
import { getFakes } from '../fakes';
import { STRONG_PASSWORD } from '../parcours/helpers';
import { newBuyer, service } from '../parcours/paiement-helpers';
import { anonClient, callRoute, post, rawAccount } from './cv9qq-helpers';

after(async () => {
    await assertLot9quinquiesInvariants('cv9qq-6-compte-suspendu');
});

async function suspend(userId: string): Promise<void> {
    const { error } = await service.from('users').update({ status: 'SUSPENDU' }).eq('id', userId);
    assert.equal(error, null, `suspension : ${error?.message}`);
}

describe('Attaque 6 — compte suspendu : recevoir un SMS de code', () => {
    test('toutes les routes qui envoient un code, vers le numéro d\'un compte suspendu : aucun SMS', async () => {
        const victim = await newBuyer('cv9qq-suspendu');
        const other = await newBuyer('cv9qq-autre');
        await suspend(victim.userId);
        const before = getFakes().sms.messagesTo(victim.phoneE164).length;
        const outcomes: string[] = [];
        for (const purpose of ['LOGIN', 'PASSWORD_RESET', 'REGISTER']) {
            const r = await post('auth/send-otp', { phone: victim.phoneE164, purpose });
            outcomes.push(`send-otp ${purpose}:${r.status}/${String(r.body.code ?? '')}`);
        }
        const reg = await post('auth/register/start', { phone: victim.phoneE164 });
        outcomes.push(`register/start:${reg.status}/${String(reg.body.code ?? '')}`);
        const change = await post('account/phone/start', { phone: victim.phoneE164 }, other.accessToken);
        outcomes.push(`account/phone/start (autre compte):${change.status}/${String(change.body.code ?? '')}`);
        const gotrue = await anonClient().auth.signInWithOtp({ phone: victim.phoneE164, options: { shouldCreateUser: false } });
        outcomes.push(`GoTrue /otp:${gotrue.error ? `refus ${gotrue.error.status}` : 'accepté'}`);
        const login = await post('auth/login', { identifier: victim.phoneE164, password: STRONG_PASSWORD });
        outcomes.push(`login:${login.status}/${String(login.body.code ?? '')}`);
        console.log(`[CV9QQ-6] numéro d'un compte suspendu : ${outcomes.join(' ; ')}`);
        const received = getFakes().sms.messagesTo(victim.phoneE164).slice(before).map((m) => m.message);
        assert.deepEqual(received, [], `SMS reçus par le compte suspendu :\n${received.join('\n')}`);
        assert.deepEqual([login.status, login.body.code], [403, 'ACCOUNT_SUSPENDED'], JSON.stringify(login.body));
    });

    test('ADMIN suspendu, jeton d\'avant la suspension : aucun code administrateur', async () => {
        const admin = await rawAccount('admin-suspendu', 'ADMIN', ['users.read']);
        await suspend(admin.userId);
        const before = getFakes().sms.messagesTo(admin.phone).length;
        const r = await callRoute('admin/step-up/sms', 'POST', { token: admin.token, body: {} });
        console.log(`[CV9QQ-6] code administrateur demandé par un ADMIN suspendu : ${r?.status} ${String(r?.body.code ?? '')}`);
        assert.ok(r && r.status >= 400, `demande acceptée : ${JSON.stringify(r?.body)}`);
        assert.equal(getFakes().sms.messagesTo(admin.phone).length, before, 'aucun SMS');
    });
});
