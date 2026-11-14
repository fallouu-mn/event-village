/**
 * Lot 9 quinquies, correctifs de la contre-vérification — point 2 : les identifiants de GoTrue deviennent secrets.
 *
 * Rouge avant correctif (contre-vérification, run 177, cv9qq-2 c) : GoTrue appelé directement avec la clé publique et
 * l'adresse réelle acceptait 12 mauvais mots de passe puis ouvrait la session ; la limite de 10 échecs par compte ne
 * valait que pour POST /api/auth/login.
 *
 *  a. un attaquant qui connaît le numéro, l'adresse réelle ET le mot de passe d'une victime n'ouvre aucune session chez
 *     GoTrue directement (mot de passe par adresse ou par numéro, code par SMS ou par email) ; témoin : la connexion par
 *     l'application, par numéro et par adresse, réussit ;
 *  b. dans auth.users : aucun numéro, et pour chaque compte une adresse technique tirée d'une empreinte secrète (ni
 *     l'adresse réelle, ni l'identifiant du compte) ;
 *  c. un compte créé ou modifié par l'API d'administration avec une adresse réelle et un numéro garde l'adresse technique
 *     et aucun numéro chez GoTrue ; son profil garde l'adresse et le numéro.
 */
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { inspect } from '../helpers/db';
import { assertLot9quinquiesInvariants } from '../helpers/lot9quinquies-invariants';
import { anonClient, post } from '../audit-auth/cv9qq-helpers';
import { randomEmail, randomSenegalPhone, STRONG_PASSWORD } from './helpers';
import { newBuyer, service } from './paiement-helpers';
import { markEmailVerified } from './notif-helpers';

after(async () => {
    await assertLot9quinquiesInvariants('lot9quinquies-cv-gotrue');
});

const ALIAS_RE = /^k[0-9a-f]{40}@comptes\.eventvillage\.invalid$/;

async function authRow(userId: string): Promise<{ email: string | null; phone: string | null }> {
    const { data, error } = await service.auth.admin.getUserById(userId);
    assert.equal(error, null, error?.message);
    return { email: data.user?.email ?? null, phone: data.user?.phone || null };
}

describe('Point 2 — GoTrue directement : aucun identifiant connu ne permet de se connecter', () => {
    test('a. numéro, adresse réelle et bon mot de passe connus : aucune session chez GoTrue ; l\'application connecte', async () => {
        const v = await newBuyer('cv-gotrue-victime');
        await markEmailVerified(v.userId);
        const g = anonClient();
        const outcomes: string[] = [];
        const sessions: string[] = [];
        const tries: Array<[string, () => Promise<{ data: { session: unknown }; error: { status?: number; code?: string } | null }>]> = [
            ['mot de passe, adresse réelle', () => g.auth.signInWithPassword({ email: v.email, password: STRONG_PASSWORD })],
            ['mot de passe, adresse en capitales', () => g.auth.signInWithPassword({ email: v.email.toUpperCase(), password: STRONG_PASSWORD })],
            ['mot de passe, numéro', () => g.auth.signInWithPassword({ phone: v.phoneE164, password: STRONG_PASSWORD })],
            ['mot de passe, numéro sans +', () => g.auth.signInWithPassword({ phone: v.phoneE164.replace('+', ''), password: STRONG_PASSWORD })],
            ['code par SMS', () => g.auth.signInWithOtp({ phone: v.phoneE164, options: { shouldCreateUser: false } }) as never],
            ['code par email', () => g.auth.signInWithOtp({ email: v.email, options: { shouldCreateUser: false } }) as never],
        ];
        for (const [label, run] of tries) {
            const r = await run();
            outcomes.push(`${label} : ${r.error ? `refus ${r.error.status ?? ''} ${r.error.code ?? ''}`.trim() : 'accepté'}`);
            if (r.data?.session) sessions.push(label);
        }
        console.log(`[CV-2a] GoTrue directement : ${outcomes.join(' ; ')}`);
        assert.deepEqual(sessions, [], `session ouverte chez GoTrue sans l'application : ${sessions.join(', ')}`);
        const pwd = outcomes.filter((o) => o.startsWith('mot de passe') && o.endsWith('accepté'));
        assert.deepEqual(pwd, [], 'connexion par mot de passe acceptée par GoTrue');

        const byPhone = await post('auth/login', { identifier: v.phone9, password: STRONG_PASSWORD });
        const byEmail = await post('auth/login', { identifier: v.email, password: STRONG_PASSWORD });
        console.log(`[CV-2a] témoin, par l'application : numéro ${byPhone.status} ; adresse ${byEmail.status}`);
        assert.equal(byPhone.status, 200, JSON.stringify(byPhone.body));
        assert.equal(byEmail.status, 200, JSON.stringify(byEmail.body));
    });

    test('b. auth.users : aucun numéro ; adresse technique d\'empreinte secrète, ni réelle ni tirée de l\'identifiant', async () => {
        const [row] = await inspect(async (c) => (await c.query<Record<string, string>>(
            `SELECT count(*)::int AS total,
                    count(*) FILTER (WHERE COALESCE(a.phone, '') <> '')::int AS with_phone,
                    count(*) FILTER (WHERE COALESCE(a.email, '') !~ '^k[0-9a-f]{40}@comptes\\.eventvillage\\.invalid$')::int AS not_alias,
                    count(*) FILTER (WHERE u.email IS NOT NULL AND lower(a.email) = lower(u.email))::int AS same_as_profile,
                    count(*) FILTER (WHERE position(replace(a.id::text, '-', '') IN COALESCE(a.email, '')) > 0)::int AS from_id
               FROM auth.users a LEFT JOIN public.users u ON u.id = a.id`,
        )).rows);
        console.log(`[CV-2b] auth.users : ${JSON.stringify(row)}`);
        assert.equal(Number(row.with_phone), 0, 'comptes avec un numéro chez GoTrue');
        assert.equal(Number(row.not_alias), 0, 'comptes dont l\'identifiant GoTrue n\'est pas l\'adresse technique');
        assert.equal(Number(row.same_as_profile), 0, 'comptes dont l\'identifiant GoTrue est l\'adresse du profil');
        assert.equal(Number(row.from_id), 0, 'comptes dont l\'identifiant GoTrue est tiré de l\'identifiant du compte');
    });

    test('c. création et modification par l\'API d\'administration avec adresse réelle et numéro : GoTrue garde l\'adresse technique, sans numéro', async () => {
        const email = randomEmail('cv-gotrue-api');
        const phone = randomSenegalPhone('78');
        const { data, error } = await service.auth.admin.createUser({ email, phone, password: STRONG_PASSWORD, email_confirm: true, phone_confirm: true });
        assert.equal(error, null, error?.message);
        const userId = data.user!.id;
        const created = await authRow(userId);
        const { data: profile } = await service.from('users').select('email, phone').eq('id', userId).single();
        console.log(`[CV-2c] après création : GoTrue ${ALIAS_RE.test(String(created.email)) ? 'adresse technique' : 'AUTRE ADRESSE'}, numéro ${created.phone ? 'PRÉSENT' : 'absent'} ; profil ${profile?.email === email ? 'adresse réelle' : String(profile?.email)}`);
        assert.match(String(created.email), ALIAS_RE);
        assert.equal(created.phone, null);
        assert.equal(profile?.email, email, 'le profil garde l\'adresse réelle');
        assert.ok(String(profile?.phone ?? '').endsWith(phone.replace('+', '')), 'le profil garde le numéro');

        const { error: upErr } = await service.auth.admin.updateUserById(userId, { email: randomEmail('cv-gotrue-api2'), phone: randomSenegalPhone('76'), email_confirm: true, phone_confirm: true });
        assert.equal(upErr, null, upErr?.message);
        const updated = await authRow(userId);
        assert.equal(updated.email, created.email, 'l\'adresse technique ne change pas');
        assert.equal(updated.phone, null, 'aucun numéro chez GoTrue');

        const direct = await anonClient().auth.signInWithPassword({ email, password: STRONG_PASSWORD });
        assert.equal(direct.data.session, null, 'GoTrue directement avec l\'adresse réelle : aucune session');
    });
});
