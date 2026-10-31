/**
 * R6 — Lot 1B.1 : les rôles ne se lisent plus dans user_metadata, que l'utilisateur modifie
 * librement (signUp options.data, auth.updateUser({ data })).
 *
 * Le middleware est appelé avec de vrais cookies de session (clé anon uniquement) :
 *  - compte inscrit avec data.roles = ['SUPERADMIN'] ;
 *  - compte CLIENT qui écrit roles = ['SUPERADMIN'] dans ses métadonnées.
 * Dans les deux cas /admin, /partner et /scan doivent rediriger.
 * Un contrôle statique vérifie qu'aucun code applicatif ne relit les rôles dans user_metadata.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { callMiddleware, sessionCookies, type SessionCookie } from '../helpers/middleware';
import { signUpAttacker } from './helpers';

const PROTECTED = [
    { path: '/admin/dashboard', redirect: '/?error=unauthorized_admin' },
    { path: '/partner/dashboard', redirect: '/?error=unauthorized_partner' },
    { path: '/scan', redirect: '/?error=unauthorized_scanner' },
] as const;

async function assertAllRedirect(cookies: SessionCookie[], who: string): Promise<void> {
    const failures: string[] = [];
    for (const p of PROTECTED) {
        const res = await callMiddleware(p.path, cookies);
        const ok = res.status === 307 && (res.location ?? '').endsWith(p.redirect);
        if (!ok) failures.push(`${p.path} → HTTP ${res.status}${res.location ? ` vers ${res.location}` : ' (page servie)'}`);
    }
    assert.deepEqual(failures, [], `${who} : accès accordé alors qu'il doit être redirigé :\n${failures.join('\n')}`);
}

describe('R6 — rôles déclarés dans user_metadata', () => {
    test('signUp avec data.roles = [SUPERADMIN] → /admin, /partner et /scan redirigent', async () => {
        // Garde-fou de non-régression : à l'inscription, le trigger de synchronisation réécrit
        // déjà roles en base et dans le jeton (runs 15 et 16) ; la voie exploitable est updateUser.
        const attacker = await signUpAttacker('r6-signup', { roles: ['SUPERADMIN'] });
        await assertAllRedirect(await sessionCookies(attacker.client), 'inscription avec roles forgés');
    });

    test('compte CLIENT qui fait updateUser({ data: { roles: [SUPERADMIN] } }) → idem', async () => {
        const client = await signUpAttacker('r6-update');
        const { error } = await client.client.auth.updateUser({ data: { roles: ['SUPERADMIN'], role: 'SUPERADMIN' } });
        assert.equal(error, null, `précondition : GoTrue accepte la mise à jour des métadonnées (${error?.message})`);
        const { error: refreshErr } = await client.client.auth.refreshSession();
        assert.equal(refreshErr, null, `rafraîchissement de session : ${refreshErr?.message}`);
        await assertAllRedirect(await sessionCookies(client.client), 'métadonnées modifiées par updateUser');
    });

    test('aucun code applicatif ne lit les rôles dans user_metadata', () => {
        const root = process.cwd();
        const files: string[] = [];
        const walk = (p: string) => {
            const st = fs.statSync(p);
            if (st.isDirectory()) for (const e of fs.readdirSync(p)) walk(path.join(p, e));
            else if (/\.(ts|tsx)$/.test(p)) files.push(p);
        };
        for (const d of ['app', 'components', 'hooks', 'lib', 'middleware.ts']) {
            if (fs.existsSync(path.join(root, d))) walk(path.join(root, d));
        }
        const offenders: string[] = [];
        for (const f of files) {
            const src = fs.readFileSync(f, 'utf8');
            const rel = path.relative(root, f).replace(/\\/g, '/');
            src.split(/\r?\n/).forEach((line, i) => {
                if (/user_metadata\s*\??\.\s*roles?\b|user_metadata\s*\??\.?\s*\[\s*['"]roles?['"]\s*\]/.test(line)) offenders.push(`${rel}:${i + 1} ${line.trim()}`);
                if (/\bparseRoles(FromMetadata|FromJwt)?\s*\(/.test(line)) offenders.push(`${rel}:${i + 1} ${line.trim()}`);
            });
            // Variable initialisée depuis user_metadata puis lue en .role / .roles
            for (const m of Array.from(src.matchAll(/(?:const|let|var)\s+(\w+)\s*=\s*[^;\n]*user_metadata\b/g))) {
                const v = m[1];
                if (new RegExp(`\\b${v}\\s*\\??\\.\\s*roles?\\b`).test(src)) offenders.push(`${rel} : ${v}.role(s) lu depuis user_metadata`);
            }
        }
        assert.deepEqual(offenders, [], `lectures de rôles dans user_metadata :\n${offenders.join('\n')}`);
    });
});
