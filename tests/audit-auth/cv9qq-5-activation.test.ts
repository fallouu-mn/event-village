/**
 * Contre-vérification du lot 9 quinquies, attaque 5 — activation d'un compte créé par un admin (A2).
 *
 *  a. lien réutilisé, y compris deux activations simultanées du même lien : une seule réussit ;
 *  b. lien expiré (24 h) : refusé, le compte reste en attente ;
 *  c. lien d'un autre compte : activer le sien ne touche pas l'autre ; lien modifié refusé ;
 *  d. connexion avant activation : mot de passe, code de connexion, code « mot de passe oublié », lien email : rien
 *     n'ouvre de session ni n'envoie de SMS ;
 *  e. compte suspendu par l'admin avant l'activation : le lien est refusé.
 */
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { writeLocal } from '../helpers/db';
import { assertLot9quinquiesInvariants } from '../helpers/lot9quinquies-invariants';
import { getFakes } from '../fakes';
import { signInAs } from '../helpers/fixtures';
import { randomEmail, randomSenegalPhone } from '../parcours/helpers';
import { service } from '../parcours/paiement-helpers';
import { anonClient, post } from './cv9qq-helpers';

after(async () => {
    await assertLot9quinquiesInvariants('cv9qq-5-activation');
});

const phrase = (): string => `ma terrasse fleurie ${randomBytes(3).toString('hex')}`;

interface Pending { userId: string; phone: string; email: string; token: string }

async function created(label: string): Promise<Pending> {
    const sa = await signInAs('SUPERADMIN');
    const phone = randomSenegalPhone('76');
    const email = randomEmail(`cv9qq-act-${label}`);
    const r = await post('admin/users', { firstName: 'Awa', lastName: 'Activation', phone, email, role: 'CLIENT' }, sa.accessToken);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.activation, 'SENT', JSON.stringify(r.body));
    const sms = getFakes().sms.messagesTo(phone).at(-1)?.message ?? '';
    const token = /\/activation\?t=([A-Za-z0-9_-]+)$/.exec(sms)?.[1];
    assert.ok(token, `lien d'activation : ${sms}`);
    return { userId: String(r.body.userId), phone, email, token };
}

async function stillPending(userId: string): Promise<boolean> {
    const { data } = await service.auth.admin.getUserById(userId);
    return (data.user?.app_metadata as Record<string, unknown> | undefined)?.account_activation_pending === true;
}

const activate = (token: string, password: string) => post('auth/activate', { token, password });

describe('Attaque 5 — activation d\'un compte créé par un admin', () => {
    test('a. lien réutilisé, et deux activations simultanées du même lien : une seule réussit', async () => {
        const p = await created('double');
        const [x, y] = await Promise.all([activate(p.token, phrase()), activate(p.token, phrase())]);
        const statuses = [x.status, y.status].sort();
        console.log(`[CV9QQ-5a] deux activations simultanées : ${statuses.join(',')}`);
        assert.equal(statuses.filter((s) => s === 200).length, 1, `une seule activation : ${JSON.stringify([x.body, y.body])}`);
        const again = await activate(p.token, phrase());
        assert.deepEqual([again.status, again.body.code], [409, 'ACTIVATION_USED'], JSON.stringify(again.body));
    });

    test('b. lien expiré : 410, compte toujours en attente', async () => {
        const p = await created('expire');
        await writeLocal((c) => c.query(`UPDATE public.account_activations SET expires_at = now() - interval '1 minute' WHERE user_id = $1`, [p.userId]));
        const r = await activate(p.token, phrase());
        assert.deepEqual([r.status, r.body.code], [410, 'ACTIVATION_EXPIRED'], JSON.stringify(r.body));
        assert.equal(await stillPending(p.userId), true, 'compte toujours en attente');
    });

    test('c. lien d\'un autre compte : activer le sien ne touche pas l\'autre ; lien modifié refusé', async () => {
        const mine = await created('mien');
        const other = await created('autre');
        const tampered = await activate(`${other.token.slice(0, -2)}${other.token.endsWith('AA') ? 'BB' : 'AA'}`, phrase());
        assert.ok(tampered.status >= 400 && tampered.status < 500, `lien modifié accepté : ${JSON.stringify(tampered.body)}`);
        assert.equal((await activate(mine.token, phrase())).status, 200);
        assert.equal(await stillPending(other.userId), true, 'l\'autre compte reste en attente');
        assert.equal(await stillPending(mine.userId), false, 'le sien est activé');
    });

    test('d. connexion avant activation : ni session, ni SMS de code', async () => {
        const p = await created('avant');
        const before = getFakes().sms.messagesTo(p.phone).length;
        const outcomes: string[] = [];
        const pwd = await post('auth/login', { identifier: p.phone, password: phrase() });
        outcomes.push(`login:${pwd.status}/${String(pwd.body.code)}`);
        for (const purpose of ['LOGIN', 'PASSWORD_RESET']) {
            const r = await post('auth/send-otp', { phone: p.phone, purpose });
            outcomes.push(`code ${purpose}:${r.status}/${String(r.body.code)}`);
        }
        const mail = await post('auth/forgot-password', { email: p.email });
        outcomes.push(`lien email:${mail.status}`);
        const magic = await anonClient().auth.signInWithOtp({ email: p.email, options: { shouldCreateUser: false } });
        outcomes.push(`GoTrue lien magique:${magic.error ? `refus ${magic.error.status}` : 'accepté'}`);
        console.log(`[CV9QQ-5d] avant activation : ${outcomes.join(' ; ')}`);
        assert.equal(getFakes().sms.messagesTo(p.phone).length, before, 'aucun SMS envoyé avant l\'activation');
        assert.equal(pwd.status, 403, JSON.stringify(pwd.body));
        const links = await service.from('password_reset_links').select('id').eq('user_id', p.userId);
        assert.equal((links.data ?? []).length, 0, 'aucun lien « mot de passe oublié » émis pour un compte en attente');
        assert.equal(await stillPending(p.userId), true, 'toujours en attente');
    });

    test('e. compte suspendu avant l\'activation : lien refusé', async () => {
        const p = await created('suspendu');
        const { error } = await service.from('users').update({ status: 'SUSPENDU' }).eq('id', p.userId);
        assert.equal(error, null, error?.message);
        const r = await activate(p.token, phrase());
        console.log(`[CV9QQ-5e] activation d'un compte suspendu : ${r.status} ${String(r.body.code ?? '')}`);
        assert.equal(r.status, 403, JSON.stringify(r.body));
        assert.equal(await stillPending(p.userId), true, 'toujours en attente');
    });
});
