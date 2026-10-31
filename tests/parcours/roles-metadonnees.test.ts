/**
 * Lot 1C.5 — plus aucun rôle recopié dans auth.users.raw_user_meta_data.
 *  - Le trigger de user_roles ne met plus à jour que users.role (rôle legacy prioritaire).
 *  - Les métadonnées existantes sont nettoyées (fixtures du seed comprises).
 *  - Middleware et routes fonctionnent toujours (rôles lus dans user_roles).
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { getServiceRoleClient } from '../../lib/supabase/server';
import { grantUserRoles } from '../../lib/auth/roles';
import { inRolledBackTransaction } from '../helpers/db';
import { loadFixtures } from '../helpers/fixtures';
import { callMiddleware, sessionCookies } from '../helpers/middleware';
import { randomEmail, STRONG_PASSWORD } from './helpers';

function roleKeys(meta: Record<string, unknown> | null | undefined): string[] {
    return Object.keys(meta ?? {}).filter((k) => k === 'role' || k === 'roles');
}

describe('Rôles hors des métadonnées utilisateur', () => {
    test('trigger : attribution et retrait de rôles sans écriture dans raw_user_meta_data ; users.role suit la priorité', async () => {
        const id = crypto.randomUUID();
        const observed = await inRolledBackTransaction(async (c) => {
            await c.query(
                `INSERT INTO auth.users (id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
                 VALUES ($1, 'authenticated', 'authenticated', $2, '{"first_name":"Meta"}'::jsonb, '{}'::jsonb, now(), now())`,
                [id, `meta-${id.slice(0, 8)}@test.eventvillage.local`],
            );
            const snapshot = async () => {
                const { rows } = await c.query(
                    `SELECT u.raw_user_meta_data AS meta, p.role AS legacy
                       FROM auth.users u JOIN public.users p ON p.id = u.id WHERE u.id = $1`, [id]);
                return rows[0] as { meta: Record<string, unknown>; legacy: string };
            };
            const steps: { step: string; keys: string[]; legacy: string }[] = [];
            const record = async (step: string) => { const s = await snapshot(); steps.push({ step, keys: roleKeys(s.meta), legacy: s.legacy }); };
            await record('inscription');
            await c.query(`INSERT INTO public.user_roles (user_id, role) VALUES ($1, 'CONTROLEUR')`, [id]);
            await record('+CONTROLEUR');
            await c.query(`INSERT INTO public.user_roles (user_id, role) VALUES ($1, 'PARTENAIRE')`, [id]);
            await record('+PARTENAIRE');
            await c.query(`DELETE FROM public.user_roles WHERE user_id = $1 AND role IN ('PARTENAIRE', 'CONTROLEUR')`, [id]);
            await record('retrait');
            return steps;
        });
        assert.deepEqual(observed, [
            { step: 'inscription', keys: [], legacy: 'CLIENT' },
            { step: '+CONTROLEUR', keys: [], legacy: 'CONTROLEUR' },
            { step: '+PARTENAIRE', keys: [], legacy: 'PARTENAIRE' },
            { step: 'retrait', keys: [], legacy: 'CLIENT' },
        ]);
    });

    test('fixtures du seed : aucune clé role / roles dans les métadonnées', async () => {
        const fx = await loadFixtures();
        const service = getServiceRoleClient();
        const offenders: string[] = [];
        for (const key of ['PARTNER_A', 'CONTROLLER_A', 'ADMIN', 'SUPERADMIN'] as const) {
            const { data, error } = await service.auth.admin.getUserById(fx.users[key].id);
            assert.equal(error, null, `lecture ${key} : ${error?.message}`);
            const keys = roleKeys(data.user?.user_metadata);
            if (keys.length) offenders.push(`${key} : ${keys.join(', ')}`);
        }
        assert.deepEqual(offenders, [], `métadonnées porteuses de rôles :\n${offenders.join('\n')}`);
    });

    test('attribution par le serveur : métadonnées sans rôle, accès /partner ouvert par le middleware', async () => {
        const service = getServiceRoleClient();
        const email = randomEmail('meta-partenaire');
        const { data, error } = await service.auth.admin.createUser({ email, password: STRONG_PASSWORD, email_confirm: true });
        assert.equal(error, null, `création : ${error?.message}`);
        await grantUserRoles(data.user!.id, ['PARTENAIRE']);

        const { data: after } = await service.auth.admin.getUserById(data.user!.id);
        assert.deepEqual(roleKeys(after.user?.user_metadata), [], `rôles recopiés dans les métadonnées : ${JSON.stringify(after.user?.user_metadata)}`);

        const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
        const { error: signErr } = await client.auth.signInWithPassword({ email, password: STRONG_PASSWORD });
        assert.equal(signErr, null, `connexion : ${signErr?.message}`);
        const res = await callMiddleware('/partner/dashboard', await sessionCookies(client));
        assert.ok(res.passedThrough, `middleware : accès partenaire attendu, HTTP ${res.status} ${res.location ?? ''}`);
    });
});
