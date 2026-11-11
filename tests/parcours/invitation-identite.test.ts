/**
 * Lot 1C.1 — une invitation de contrôleur ne modifie JAMAIS l'identité d'un compte existant.
 *  - Recherche du compte par téléphone E.164 en égalité exacte (plus de suffixe ilike) ;
 *    un numéro non sénégalais est refusé.
 *  - Le partenaire ne voit que le nom masqué du titulaire, puis confirme ; prénom, nom, email,
 *    téléphone et mot de passe du titulaire restent intacts, même si le partenaire en saisit d'autres.
 *  - La réinitialisation du mot de passe par téléphone reste liée à l'email du client.
 *  - « resend » ne contourne plus la confirmation ; aucun code OTP n'est renvoyé au partenaire ;
 *    un compte créé par invitation n'a pas d'email choisi par le partenaire.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { getServiceRoleClient } from '../../lib/supabase/server';
import { bearer, loadFixtures, signInAs } from '../helpers/fixtures';
import { POST as inviteController } from '../../app/api/partner/team/invite/route';
import { POST as sendOtp } from '../../app/api/auth/send-otp/route';
import { POST as verifyOtp } from '../../app/api/auth/verify-otp/route';
import { getFakes } from '../fakes';
import { jsonRequest, randomEmail, randomSenegalPhone, STRONG_PASSWORD } from './helpers'; import { freshSession, respondControllerInvitations } from './acces-helpers';

interface Holder { userId: string; email: string; phone: string; firstName: string; lastName: string }

async function newHolder(label: string): Promise<Holder> {
    const service = getServiceRoleClient();
    const email = randomEmail(label);
    const phone = randomSenegalPhone('77');
    const firstName = 'Mariétou';
    const lastName = `Sarrdiop${Math.floor(Math.random() * 1e6)}`;
    const { data, error } = await service.auth.admin.createUser({
        email, phone, password: STRONG_PASSWORD, email_confirm: true, phone_confirm: true,
        user_metadata: { first_name: firstName, last_name: lastName },
    });
    assert.equal(error, null, `création du titulaire : ${error?.message}`);
    const userId = data.user!.id;
    const { error: upErr } = await service.from('users').update({ phone, email, first_name: firstName, last_name: lastName }).eq('id', userId);
    assert.equal(upErr, null, `profil du titulaire : ${upErr?.message}`);
    return { userId, email, phone, firstName, lastName };
}

async function identityOf(userId: string) {
    const service = getServiceRoleClient();
    const { data: profile, error } = await service.from('users').select('first_name, last_name, email, phone').eq('id', userId).single();
    assert.equal(error, null, `profil : ${error?.message}`);
    const { data: auth, error: authErr } = await service.auth.admin.getUserById(userId);
    assert.equal(authErr, null, `auth.users : ${authErr?.message}`);
    return { profile, authEmail: auth.user?.email, authPhoneDigits: (auth.user?.phone || '').replace(/\D/g, '') };
}

async function rolesOf(userId: string): Promise<string[]> {
    const { data, error } = await getServiceRoleClient().from('user_roles').select('role').eq('user_id', userId);
    assert.equal(error, null, `rôles : ${error?.message}`);
    return (data || []).map((r) => r.role as string).sort();
}

function lastCodeTo(phone: string): string {
    const codes = getFakes().sms.messagesTo(phone).map((m) => m.message.match(/\b(\d{6})\b/)?.[1]).filter((c): c is string => Boolean(c));
    assert.ok(codes.length > 0, `aucun code reçu au ${phone}`);
    return codes[codes.length - 1];
}

describe('Invitation : identité des comptes existants', () => {
    test('invitation du numéro d’un client avec un autre email et un autre nom → nom masqué, confirmation, identité intacte', async () => {
        const fx = await loadFixtures();
        const partnerA = await signInAs('PARTNER_A');
        const holder = await newHolder('titulaire');
        const before = await identityOf(holder.userId);
        const forged = { first_name: 'Pirate', last_name: 'Imposteur', email: randomEmail('pirate') };

        const first = await inviteController(jsonRequest('/api/partner/team/invite', {
            phone: holder.phone, event_ids: [fx.events.A_PUBLIE.id], ...forged,
        }, bearer(partnerA.accessToken)));
        const firstBody = await first.json();
        const raw = JSON.stringify(firstBody);
        assert.equal(first.status, 200, `HTTP ${first.status} ${raw}`);
        assert.equal(firstBody.requires_confirmation, true, `confirmation attendue : ${raw}`);
        assert.ok(!raw.includes(holder.firstName) && !raw.includes(holder.lastName), `nom du titulaire révélé en clair : ${raw}`);
        assert.ok(!raw.includes(holder.userId), `identifiant du titulaire révélé : ${raw}`);
        assert.match(String(firstBody.existing_user?.display_name), /^\S{1,2}\*\*\* \S\*\*\*$/, `nom masqué attendu : ${raw}`);

        const confirmed = await inviteController(jsonRequest('/api/partner/team/invite', {
            phone: holder.phone, event_ids: [fx.events.A_PUBLIE.id], ...forged, confirm_promotion: true,
        }, bearer(partnerA.accessToken)));
        const confirmedBody = await confirmed.json();
        assert.ok((confirmed.status === 200 || confirmed.status === 201) && !(await rolesOf(holder.userId)).includes('CONTROLEUR'), `confirmation de la partenaire : invitation en attente, aucun rôle avant l’acceptation du titulaire (R37, lot 9 bis) : HTTP ${confirmed.status} ${JSON.stringify(confirmedBody)}`);
        await acceptAsHolder(holder); assert.ok((await rolesOf(holder.userId)).includes('CONTROLEUR') && (await assignedEventsOf(holder.userId)).includes(fx.events.A_PUBLIE.id), 'rôle CONTROLEUR et affectation après l’acceptation du titulaire (R37)');

        assert.deepEqual(await identityOf(holder.userId), before, 'prénom, nom, email et téléphone du titulaire inchangés');
        const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
        const { error: loginErr } = await anon.auth.signInWithPassword({ email: holder.email, password: STRONG_PASSWORD });
        assert.equal(loginErr, null, `mot de passe du titulaire inchangé : ${loginErr?.message}`);
    });

    test('après une invitation, la réinitialisation par téléphone reste liée à l’email du client', async () => {
        const fx = await loadFixtures();
        const partnerA = await signInAs('PARTNER_A');
        const holder = await newHolder('reset');
        for (const confirm of [false, true]) {
            await inviteController(jsonRequest('/api/partner/team/invite', {
                phone: holder.phone, event_ids: [fx.events.A_PUBLIE.id],
                first_name: 'Pirate', email: randomEmail('pirate-reset'), confirm_promotion: confirm,
            }, bearer(partnerA.accessToken)));
        }
        const sent = await sendOtp(jsonRequest('/api/auth/send-otp', { phone: holder.phone, purpose: 'PASSWORD_RESET' }));
        assert.equal(sent.status, 200, `send-otp : HTTP ${sent.status} ${JSON.stringify(await sent.json())}`);
        const verified = await verifyOtp(jsonRequest('/api/auth/verify-otp', { phone: holder.phone, otpCode: lastCodeTo(holder.phone) }));
        const body = await verified.json();
        assert.equal(verified.status, 200, `verify-otp : HTTP ${verified.status} ${JSON.stringify(body)}`);
        assert.equal(body.email, holder.email, 'le lien de réinitialisation vise l’email du client');
    });

    test('recherche par égalité exacte : un numéro étranger finissant par les 9 chiffres d’un client est refusé', async () => {
        const fx = await loadFixtures();
        const partnerA = await signInAs('PARTNER_A');
        const holder = await newHolder('suffixe');
        const foreign = `+33${holder.phone.replace(/\D/g, '').slice(-9)}`;
        const res = await inviteController(jsonRequest('/api/partner/team/invite', {
            phone: foreign, event_ids: [fx.events.A_PUBLIE.id], first_name: 'Inconnu',
        }, bearer(partnerA.accessToken)));
        const body = await res.json();
        const raw = JSON.stringify(body);
        assert.equal(res.status, 400, `numéro non sénégalais refusé : HTTP ${res.status} ${raw}`);
        assert.ok(!raw.includes(holder.lastName), `le compte du client ne doit pas être retrouvé : ${raw}`);
    });

    test('« resend » ne contourne plus la confirmation', async () => {
        const fx = await loadFixtures();
        const partnerA = await signInAs('PARTNER_A');
        const holder = await newHolder('resend');
        const res = await inviteController(jsonRequest('/api/partner/team/invite', {
            phone: holder.phone, event_ids: [fx.events.A_PUBLIE.id], resend: true,
        }, bearer(partnerA.accessToken)));
        const body = await res.json();
        assert.equal(body.requires_confirmation, true, `confirmation exigée malgré resend : ${JSON.stringify(body)}`);
        assert.ok(!(await rolesOf(holder.userId)).includes('CONTROLEUR'), 'aucun rôle attribué sans confirmation');
    });

    test('nouveau compte invité : aucun code renvoyé au partenaire, email de connexion non choisi par le partenaire', async () => {
        const fx = await loadFixtures();
        const partnerA = await signInAs('PARTNER_A');
        const phone = randomSenegalPhone('78');
        const res = await inviteController(jsonRequest('/api/partner/team/invite', {
            phone, event_ids: [fx.events.A_PUBLIE.id], first_name: 'Nouveau', email: randomEmail('choisi-par-partenaire'),
        }, bearer(partnerA.accessToken)));
        const body = await res.json();
        assert.ok(res.status === 200 || res.status === 201, `invitation : HTTP ${res.status} ${JSON.stringify(body)}`);
        assert.ok(!('otp_code' in body), `le code d’activation ne doit pas être renvoyé au partenaire : ${JSON.stringify(body)}`);
        const userId = body.assignment?.user_id ?? body.assignments?.[0]?.user_id;
        assert.ok(userId, `compte créé : ${JSON.stringify(body)}`);
        const { data: auth } = await getServiceRoleClient().auth.admin.getUserById(userId);
        assert.equal(auth.user?.email, `${phone.replace(/\D/g, '')}@eventvillage.sn`, 'email de connexion synthétique, lié au numéro');
    });
});

// ── Lot 9 bis (R37, T49) : acceptation par le titulaire ───────────────────

/** Le titulaire, connecté par son mot de passe, accepte ses invitations de contrôleur (routes /api/account/controller-invitations). */
async function acceptAsHolder(holder: Holder): Promise<void> {
    await respondControllerInvitations(await freshSession(holder), true);
}

async function assignedEventsOf(userId: string): Promise<string[]> {
    const { data, error } = await getServiceRoleClient().from('event_controllers').select('event_id').eq('user_id', userId);
    assert.equal(error, null, `affectations : ${error?.message}`);
    return (data ?? []).map((a) => String(a.event_id));
}
