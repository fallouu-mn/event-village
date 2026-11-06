/**
 * R6 — Lot 1B.1 : les rôles ne se lisent plus dans user_metadata, que l'utilisateur modifie
 * librement (signUp options.data, auth.updateUser({ data })).
 *
 * Le middleware est appelé avec de vrais cookies de session (clé anon uniquement) :
 *  - compte inscrit avec data.roles = ['SUPERADMIN'] ;
 *  - compte CLIENT qui écrit roles = ['SUPERADMIN'] dans ses métadonnées.
 * Dans les deux cas /admin, /partner, /scan et /controller/scanner doivent rediriger.
 * Un contrôle statique vérifie qu'aucun code applicatif ne relit les rôles dans user_metadata.
 *
 * Lot 8, 8.2 j (T19, L53) : /controller/scanner rejoint PROTECTED, et toute redirection d'un connecté vise /?error=…
 * Rouge jusqu'à fix(8.2j-s) : middleware.ts renvoie vers /login?error=unauthorized_controller, que le connecté quitte
 * aussitôt selon son rôle ; pour un CONTROLEUR SUSPENDU à la session encore valide, c'est une boucle. Comptes préparés
 * par une connexion directe à la base LOCALE (transaction validée, comme r25) ; l'acteur testé garde la clé anon.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { openConcurrentClient } from '../helpers/db';
import { callMiddleware, sessionCookies, type SessionCookie } from '../helpers/middleware';
import { signUpAttacker, type AttackerAccount } from './helpers';

const PROTECTED = [
    { path: '/admin/dashboard', redirect: '/?error=unauthorized_admin' },
    { path: '/partner/dashboard', redirect: '/?error=unauthorized_partner' },
    { path: '/scan', redirect: '/?error=unauthorized_scanner' },
    { path: '/controller/scanner', redirect: '/?error=unauthorized_controller' },
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

/** Compte inscrit (clé anon), puis rôle CONTROLEUR et statut posés en base locale ; sa session reste valide. */
async function controllerAccount(label: string, status: 'ACTIF' | 'SUSPENDU'): Promise<AttackerAccount> {
    const account = await signUpAttacker(label);
    const db = await openConcurrentClient({ applicationName: 'ev-test-r6' });
    try {
        await db.query(`INSERT INTO public.user_roles (user_id, role) VALUES ($1, 'CONTROLEUR') ON CONFLICT (user_id, role) DO NOTHING`, [account.userId]);
        const updated = await db.query(`UPDATE public.users SET status = $2 WHERE id = $1`, [account.userId, status]);
        assert.equal(updated.rowCount, 1, `profil de ${label} absent`);
        await db.commit();
    } finally {
        await db.close();
    }
    return account;
}

/** Suit les redirections du middleware, au plus `maxHops` sauts ; `landing` : la page finalement servie, ou null. */
async function follow(start: string, cookies: SessionCookie[], maxHops = 3): Promise<{ landing: string | null; chain: string[] }> {
    const chain = [start];
    let current = start;
    for (let hop = 0; hop <= maxHops; hop++) {
        const res = await callMiddleware(current, cookies);
        if (res.passedThrough) return { landing: current, chain };
        assert.equal(res.status, 307, `${current} : ni page servie ni redirection (HTTP ${res.status})`);
        assert.ok(res.location, `${current} : redirection sans destination`);
        const next = new URL(res.location);
        current = `${next.pathname}${next.search}`;
        chain.push(current);
    }
    return { landing: null, chain };
}

/** Panne de la lecture du statut par le middleware (users, colonne status seule), le temps de `fn`. */
async function withStatusReadFailure<T>(fn: () => Promise<T>): Promise<T> {
    const previous = globalThis.fetch;
    let hits = 0;
    globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
        if (url.pathname !== '/rest/v1/users' || url.searchParams.get('select') !== 'status') return previous(input, init);
        hits++;
        return new Response(JSON.stringify({ message: 'panne simulée', code: '42P01' }), { status: 500, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;
    try {
        const out = await fn();
        assert.ok(hits >= 1, 'la panne simulée n\'a pas été atteinte');
        return out;
    } finally {
        globalThis.fetch = previous;
    }
}

describe('R6 — lot 8 (8.2 j) : plus de redirection d\'un connecté vers /login, plus de boucle', () => {
    test('CONTROLEUR SUSPENDU, session valide : au plus 3 sauts, atterrit sur /?error=unauthorized_controller', async () => {
        const suspended = await controllerAccount('r6-susp', 'SUSPENDU');
        const { landing, chain } = await follow('/controller/scanner', await sessionCookies(suspended.client));
        assert.equal(landing, '/?error=unauthorized_controller', `parcours : ${chain.join(' → ')}`);
    });

    test('CONTROLEUR SUSPENDU : un appel API reste un 403 JSON, sans redirection (témoin, vert dès l\'écriture)', async () => {
        const suspended = await controllerAccount('r6-susp-api', 'SUSPENDU');
        const res = await callMiddleware('/api/controller/profile', await sessionCookies(suspended.client));
        assert.equal(res.status, 403);
        assert.equal(res.location, null);
    });

    test('lecture du statut impossible : /?error=roles_unavailable, atterrissage sans boucle', async () => {
        const active = await controllerAccount('r6-panne', 'ACTIF');
        const cookies = await sessionCookies(active.client);
        await withStatusReadFailure(async () => {
            const { landing, chain } = await follow('/controller/scanner', cookies);
            assert.equal(landing, '/?error=roles_unavailable', `parcours : ${chain.join(' → ')}`);
        });
    });

    test('lecture du statut impossible : un appel API reste un 503 JSON (témoin, vert dès l\'écriture)', async () => {
        const active = await controllerAccount('r6-panne-api', 'ACTIF');
        const cookies = await sessionCookies(active.client);
        const res = await withStatusReadFailure(() => callMiddleware('/api/controller/profile', cookies));
        assert.equal(res.status, 503);
        assert.equal(res.location, null);
    });

    test('témoin : CONTROLEUR actif, la page est servie sans redirection (vert dès l\'écriture)', async () => {
        const active = await controllerAccount('r6-actif', 'ACTIF');
        const res = await callMiddleware('/controller/scanner', await sessionCookies(active.client));
        assert.equal(res.passedThrough, true, `HTTP ${res.status} vers ${res.location}`);
    });
});

describe('R6 — rôles déclarés dans user_metadata', () => {
    test('signUp avec data.roles = [SUPERADMIN] → /admin, /partner, /scan et /controller/scanner redirigent', async () => {
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
