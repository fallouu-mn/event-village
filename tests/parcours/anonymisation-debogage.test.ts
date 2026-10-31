/**
 * Lot 1B.9 — routes de débogage et anonymisation.
 *  - Aucune route de test ou de débogage sous app/api (dont /api/test-notify-superadmins,
 *    qui envoyait SMS et emails réels aux superadmins pour tout utilisateur connecté).
 *  - L'anonymisation d'un compte brouille aussi l'email et le téléphone de connexion
 *    (auth.users) et bannit le compte : l'ancien identifiant ne permet plus de se connecter,
 *    et l'email d'origine est libéré.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { getServiceRoleClient } from '../../lib/supabase/server';
import { bearer, signInAs } from '../helpers/fixtures';
import { DELETE as adminDeleteUser } from '../../app/api/admin/users/route';
import { BASE_URL, randomEmail, randomSenegalPhone, STRONG_PASSWORD } from './helpers';

function anonClient() {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
}

describe('Routes de débogage et anonymisation', () => {
    test('aucune route de test ou de débogage sous app/api', () => {
        const apiDir = path.resolve(process.cwd(), 'app/api');
        const offenders: string[] = [];
        const walk = (p: string) => {
            for (const e of fs.readdirSync(p, { withFileTypes: true })) {
                if (!e.isDirectory()) continue;
                const full = path.join(p, e.name);
                if (/^(test|debug|dev|qa)([-_].*)?$|[-_](test|debug)$/i.test(e.name)) offenders.push(path.relative(process.cwd(), full).replace(/\\/g, '/'));
                walk(full);
            }
        };
        walk(apiDir);
        assert.deepEqual(offenders, [], `routes de débogage présentes :\n${offenders.join('\n')}`);
    });

    test('compte anonymisé : email et téléphone de connexion brouillés, connexion impossible, email libéré', async () => {
        const service = getServiceRoleClient();
        const superadmin = await signInAs('SUPERADMIN');
        const email = randomEmail('anonymise');
        const phone = randomSenegalPhone('76');
        const { data: created, error } = await service.auth.admin.createUser({ email, phone, password: STRONG_PASSWORD, email_confirm: true, phone_confirm: true });
        assert.equal(error, null, `création du compte : ${error?.message}`);
        const userId = created.user!.id;

        const { error: preErr } = await anonClient().auth.signInWithPassword({ email, password: STRONG_PASSWORD });
        assert.equal(preErr, null, `précondition : connexion possible avant anonymisation (${preErr?.message})`);

        const res = await adminDeleteUser(new NextRequest(`${BASE_URL}/api/admin/users?userId=${userId}`, { method: 'DELETE', headers: bearer(superadmin.accessToken) }));
        const body = await res.json();
        assert.equal(res.status, 200, `anonymisation : HTTP ${res.status} ${JSON.stringify(body)}`);

        const { data: authUser, error: getErr } = await service.auth.admin.getUserById(userId);
        assert.equal(getErr, null, `lecture auth.users : ${getErr?.message}`);
        const digits = (s: string | undefined | null) => (s || '').replace(/\D/g, '');
        assert.notEqual(authUser.user?.email, email, 'auth.users.email doit être brouillé');
        assert.notEqual(digits(authUser.user?.phone), digits(phone), 'auth.users.phone doit être brouillé');
        const bannedUntil = (authUser.user as { banned_until?: string } | null)?.banned_until;
        assert.ok(bannedUntil && new Date(bannedUntil).getTime() > Date.now(), `le compte doit être banni (banned_until=${bannedUntil})`);

        const { error: loginErr } = await anonClient().auth.signInWithPassword({ email, password: STRONG_PASSWORD });
        assert.ok(loginErr, 'connexion avec l’email d’origine refusée après anonymisation');

        const { error: reuseErr } = await service.auth.admin.createUser({ email, password: STRONG_PASSWORD, email_confirm: true });
        assert.equal(reuseErr, null, `l’email d’origine doit être libéré : ${reuseErr?.message}`);
    });
});
