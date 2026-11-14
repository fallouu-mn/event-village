/**
 * Lot 1B.1 — les accès du middleware suivent les rôles en base sans reconnexion.
 *
 * Un compte garde la même session (mêmes cookies) pendant tout le test :
 *  1. sans rôle CONTROLEUR → /controller/scanner redirige ;
 *  2. rôle CONTROLEUR attribué par le serveur → la même session accède au scanner ;
 *  3. rôle retiré → la même session est de nouveau redirigée ;
 *  4. compte promu PARTENAIRE → /partner/dashboard s'ouvre, puis se ferme au retrait.
 * Attribution et retrait par le service_role, comme les routes serveur.
 *
 * Lot 8 (8.2 v) : cas T1 de tests/legacy/controller-complete-workflow.test.ts porté, resolvePostLoginRoute réel (pur,
 * aucune base), vert dès l'écriture.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { getServiceRoleClient } from '../../lib/supabase/server';
import { grantUserRoles } from '../../lib/auth/roles';
import { resolvePostLoginRoute } from '../../lib/auth/resolve-post-login-route';
import { callMiddleware, sessionCookies } from '../helpers/middleware';
import { randomEmail, STRONG_PASSWORD } from './helpers';
import { gotrueEmail } from '../helpers/gotrue-email';

async function newSignedInAccount(label: string) {
    const service = getServiceRoleClient();
    const email = randomEmail(label);
    const { data, error } = await service.auth.admin.createUser({ email, password: STRONG_PASSWORD, email_confirm: true });
    assert.equal(error, null, `création du compte : ${error?.message}`);
    const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: signInErr } = await client.auth.signInWithPassword({ email: await gotrueEmail(email), password: STRONG_PASSWORD });
    assert.equal(signInErr, null, `connexion : ${signInErr?.message}`);
    return { userId: data.user!.id, cookies: await sessionCookies(client) };
}

async function removeRole(userId: string, role: string): Promise<void> {
    const { error } = await getServiceRoleClient().from('user_roles').delete().eq('user_id', userId).eq('role', role);
    assert.equal(error, null, `retrait du rôle ${role} : ${error?.message}`);
}

describe('8.2 v — redirection après connexion (cas T1 porté, controller-complete-workflow)', () => {
    test('resolvePostLoginRoute : destination par rôle, anciennes routes de scan ramenées au scanner du contrôleur', () => {
        assert.equal(resolvePostLoginRoute('CONTROLEUR'), '/controller/scanner');
        assert.equal(resolvePostLoginRoute('CONTROLEUR', '/'), '/controller/scanner');
        assert.equal(resolvePostLoginRoute('CONTROLEUR', '/scan'), '/controller/scanner');
        assert.equal(resolvePostLoginRoute('CONTROLEUR', '/partner/scan'), '/controller/scanner');
        assert.equal(resolvePostLoginRoute('CLIENT'), '/');
        assert.equal(resolvePostLoginRoute('PARTENAIRE'), '/partner');
        assert.equal(resolvePostLoginRoute('ADMIN'), '/admin');
        assert.equal(resolvePostLoginRoute('SUPERADMIN'), '/admin');
        assert.equal(resolvePostLoginRoute(null), '/', 'aucun rôle : accueil');
        assert.equal(resolvePostLoginRoute(['CLIENT', 'CONTROLEUR']), '/controller/scanner', 'multi-rôle : le contrôleur va au scanner');
        assert.equal(resolvePostLoginRoute(['CLIENT', 'CONTROLEUR', 'PARTENAIRE']), '/partner', 'multi-rôle : le partenaire prime sur le contrôleur');
        assert.equal(resolvePostLoginRoute('CONTROLEUR', '/tickets'), '/tickets', 'une autre destination demandée est conservée');
    });
});

describe('Fraîcheur des rôles dans le middleware (même session)', () => {
    test('contrôleur promu puis retiré : /controller/scanner suit sans reconnexion', async () => {
        const account = await newSignedInAccount('fraicheur-ctrl');

        const before = await callMiddleware('/controller/scanner', account.cookies);
        assert.equal(before.status, 307, `sans rôle : redirection attendue, HTTP ${before.status}`);

        await grantUserRoles(account.userId, ['CONTROLEUR']);
        const promoted = await callMiddleware('/controller/scanner', account.cookies);
        assert.ok(promoted.passedThrough, `après promotion : accès attendu, HTTP ${promoted.status} ${promoted.location ?? ''}`);

        await removeRole(account.userId, 'CONTROLEUR');
        const removed = await callMiddleware('/controller/scanner', account.cookies);
        assert.equal(removed.status, 307, `après retrait : redirection attendue, HTTP ${removed.status}`);
    });

    test('partenaire promu puis retiré : /partner/dashboard suit sans reconnexion', async () => {
        const account = await newSignedInAccount('fraicheur-part');

        const before = await callMiddleware('/partner/dashboard', account.cookies);
        assert.equal(before.status, 307, `sans rôle : redirection attendue, HTTP ${before.status}`);

        await grantUserRoles(account.userId, ['PARTENAIRE']);
        const promoted = await callMiddleware('/partner/dashboard', account.cookies);
        assert.ok(promoted.passedThrough, `après promotion : accès attendu, HTTP ${promoted.status} ${promoted.location ?? ''}`);

        await removeRole(account.userId, 'PARTENAIRE');
        const removed = await callMiddleware('/partner/dashboard', account.cookies);
        assert.equal(removed.status, 307, `après retrait : redirection attendue, HTTP ${removed.status}`);
    });

    test('contrôleur SUSPENDU : /controller/scanner redirige', async () => {
        const account = await newSignedInAccount('fraicheur-susp');
        await grantUserRoles(account.userId, ['CONTROLEUR']);
        const { error } = await getServiceRoleClient().from('users').update({ status: 'SUSPENDU' }).eq('id', account.userId);
        assert.equal(error, null, `suspension : ${error?.message}`);
        const res = await callMiddleware('/controller/scanner', account.cookies);
        assert.equal(res.status, 307, `compte suspendu : redirection attendue, HTTP ${res.status}`);
    });
});
