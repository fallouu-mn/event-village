/**
 * Lot 1A.1 — les rôles élevés ne s'attribuent que par des routes serveur (service_role).
 * Preuve que les parcours existants fonctionnent toujours :
 *  - inscription partenaire → rôle PARTENAIRE ;
 *  - création d'un compte par un SUPERADMIN → rôle demandé ;
 *  - invitation d'un contrôleur par un partenaire → rôle CONTROLEUR.
 * Dans chaque cas, le rôle doit figurer dans user_roles (source des politiques RLS) et être
 * accordé à la session du compte (has_role). Depuis le lot 1C.5, aucun rôle n'est recopié
 * dans user_metadata : la session ne doit y porter ni « role » ni « roles ».
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { getServiceRoleClient } from '../../lib/supabase/server';
import { bearer, loadFixtures, signInAs } from '../helpers/fixtures';
import { getFakes } from '../fakes';
// Lot 9 bis (R53, T38) : l'inscription partenaire passe par registerPartnerTwoStep (deux appels de la route).
import { POST as adminCreateUser } from '../../app/api/admin/users/route';
import { POST as inviteController } from '../../app/api/partner/team/invite/route';
import { jsonRequest, randomEmail, randomSenegalPhone, registerPartnerTwoStep, STRONG_PASSWORD, uploadRegistrationDocuments } from './helpers';
import { gotrueEmail } from '../helpers/gotrue-email';

const service = getServiceRoleClient();

async function rolesOf(userId: string): Promise<string[]> {
    const { data, error } = await service.from('user_roles').select('role').eq('user_id', userId);
    assert.equal(error, null, `lecture user_roles : ${error?.message}`);
    return (data || []).map((r) => r.role as string).sort();
}

async function assertSessionRole(email: string, password: string, role: string): Promise<void> {
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await anon.auth.signInWithPassword({ email: await gotrueEmail(email), password });
    assert.equal(error, null, `connexion ${email} : ${error?.message}`);
    const { data: granted, error: rpcErr } = await anon.rpc('has_role', { p_role: role });
    assert.equal(rpcErr, null, `has_role(${role}) : ${rpcErr?.message}`);
    assert.equal(granted, true, `la session doit détenir ${role}`);
    const meta = data.user?.user_metadata ?? {};
    assert.ok(!('role' in meta) && !('roles' in meta), `aucun rôle dans user_metadata (lot 1C.5) : ${JSON.stringify(meta)}`);
}

describe('Attribution des rôles par les routes serveur', () => {
    test('inscription partenaire → PARTENAIRE dans user_roles et pour la session', async () => {
        const email = randomEmail('partenaire');
        const phone = randomSenegalPhone('77');
        const reg = await registerPartnerTwoStep({
            companyName: 'Parcours Test SARL',
            description: 'Organisateur fictif créé par la suite de tests.',
            address: '12 rue des Tests',
            city: 'Dakar',
            activities: ['ORGANISATEUR'],
            firstName: 'Fatou',
            lastName: 'Parcours',
            phone,
            email,
            password: STRONG_PASSWORD,
            confirmPassword: STRONG_PASSWORD,
            ...(await uploadRegistrationDocuments()),
        });
        const res = reg.second ?? reg.first; const body = res.body;
        assert.ok(reg.second !== null && res.status < 300, `inscription partenaire (appel 2, code vérifié) : HTTP ${res.status} ${JSON.stringify(body)}`);

        const { data: user, error } = await service.from('users').select('id, role, status').in('phone', [phone, phone.replace(/^\+/, '')]).single();
        assert.equal(error, null, `profil partenaire : ${error?.message}`);
        assert.ok((await rolesOf(user.id)).includes('PARTENAIRE'), 'user_roles doit contenir PARTENAIRE');

        const { data: partner } = await service.from('partners').select('status').eq('user_id', user.id).single();
        assert.equal(partner?.status, 'EN_ATTENTE');
        const { data: authUser, error: authErr } = await service.auth.admin.getUserById(user.id); assert.equal(authErr, null, authErr?.message); await assertSessionRole(String(authUser.user?.email ?? email), STRONG_PASSWORD, 'PARTENAIRE');
    });

    test('création d\'un compte CONTROLEUR par un SUPERADMIN → CONTROLEUR dans user_roles et pour la session', async () => {
        const superadmin = await signInAs('SUPERADMIN');
        const email = randomEmail('cree-par-admin');
        const createdPhone = randomSenegalPhone('76');
        // Lot 9 quinquies (A2, modification signalée) : plus de mot de passe saisi par l'admin ; le titulaire active son
        // compte par le lien reçu par SMS (POST /api/auth/activate), puis se connecte.
        const res = await adminCreateUser(jsonRequest('/api/admin/users', {
            firstName: 'Ibrahima',
            lastName: 'CreeParAdmin',
            phone: createdPhone,
            email,
            role: 'CONTROLEUR',
        }, bearer(superadmin.accessToken)));
        const body = await res.json();
        assert.equal(res.status, 200, `création par admin : HTTP ${res.status} ${JSON.stringify(body)}`);
        const link = /\/activation\?t=([A-Za-z0-9_-]+)$/.exec(getFakes().sms.messagesTo(createdPhone).at(-1)?.message ?? '');
        assert.ok(link, 'lien d’activation reçu par SMS');
        const { POST: activate } = await import('../../app/api/auth/activate/route');
        const activated = await activate(jsonRequest('/api/auth/activate', { token: link[1], password: STRONG_PASSWORD }));
        assert.equal(activated.status, 200, `activation : ${JSON.stringify(await activated.json())}`);
        assert.ok((await rolesOf(body.userId)).includes('CONTROLEUR'), 'user_roles doit contenir CONTROLEUR');
        const { data: authUser, error: authErr } = await service.auth.admin.getUserById(body.userId); assert.equal(authErr, null, authErr?.message); await assertSessionRole(String(authUser.user?.email ?? email), STRONG_PASSWORD, 'CONTROLEUR'); // lot 9 bis (R87-c, contrat 4.6) : GoTrue porte l'adresse technique
    });

    test('invitation d\'un contrôleur par le partenaire A → CONTROLEUR dans user_roles + affectation', async () => {
        const fx = await loadFixtures();
        const partner = await signInAs('PARTNER_A');
        const phone = randomSenegalPhone('78');
        const res = await inviteController(jsonRequest('/api/partner/team/invite', {
            event_id: fx.events.A_PUBLIE.id,
            phone,
            first_name: 'Ousmane',
            last_name: 'Invite',
            can_accept_cash: false,
        }, bearer(partner.accessToken)));
        const body = await res.json();
        assert.ok(res.status === 201 || res.status === 200, `invitation : HTTP ${res.status} ${JSON.stringify(body)}`);
        const controllerId = body.assignment?.user_id as string;
        assert.ok(controllerId, 'affectation retournée');
        assert.ok((await rolesOf(controllerId)).includes('CONTROLEUR'), 'user_roles doit contenir CONTROLEUR');

        const { data: assignment } = await service.from('event_controllers').select('id').eq('event_id', fx.events.A_PUBLIE.id).eq('user_id', controllerId).maybeSingle();
        assert.ok(assignment, 'affectation event_controllers créée');
    });
});
