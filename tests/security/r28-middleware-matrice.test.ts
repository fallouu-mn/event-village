/**
 * R28 — Lot 9, A21 (contrat 5.5, L51) : matrice du vrai middleware, qui remplace le simulateur evaluateRbac de
 * tests/auth-rbac.test.ts (supprimé en vague L, T33). Cas portés : 1 à 3 (public), 8 à 10 (admin, superadmin, contrôleur
 * autorisés), 12 (anonyme vers /login?redirect=), 19 (page d'authentification selon le rôle), 21 avec la règle réelle
 * (contrôleur sur /partner/* vers /?error=unauthorized_partner, middleware.ts:259 ; l'ancien cas affirmait une redirection
 * vers /controller/scanner, fausse). Le cas partenaire EN_ATTENTE n'est pas porté (AR14) : jamais figé par un test.
 *
 * Vert dès l'écriture, annoncé au commit. Si un cas échoue, c'est une anomalie à instruire, pas un test à détendre.
 * Comptes inscrits avec la clé anon, rôles posés par une connexion directe à la base LOCALE (comme r6 et r25) ;
 * l'acteur testé est le middleware appelé avec de vrais cookies de session. Fin de suite : assertRecetteInvariants,
 * car une suite verte dès l'écriture ne dépend pas des migrations du lot (section 1).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { openConcurrentClient } from '../helpers/db';
import { assertRecetteInvariants } from '../helpers/recette-invariants';
import { callMiddleware, sessionCookies, type MiddlewareResult, type SessionCookie } from '../helpers/middleware';
import { signUpAttacker, uniqueSuffix } from './helpers';

const ROLES = ['CLIENT', 'PARTENAIRE', 'CONTROLEUR', 'ADMIN', 'SUPERADMIN'] as const;
type Role = (typeof ROLES)[number];

const PASS = 'page servie';
const ERR_ADMIN = '/?error=unauthorized_admin';
const ERR_PARTNER = '/?error=unauthorized_partner';
const ERR_SCANNER = '/?error=unauthorized_scanner';
const ERR_CONTROLLER = '/?error=unauthorized_controller';

const PROTECTED = ['/admin/dashboard', '/admin/referral', '/partner/dashboard', '/partner/scan', '/scan', '/controller/scanner'] as const;
type ProtectedPath = (typeof PROTECTED)[number];

const MATRIX: Record<Role, Record<ProtectedPath, string>> = {
    CLIENT: {
        '/admin/dashboard': ERR_ADMIN, '/admin/referral': ERR_ADMIN, '/partner/dashboard': ERR_PARTNER,
        '/partner/scan': ERR_SCANNER, '/scan': ERR_SCANNER, '/controller/scanner': ERR_CONTROLLER,
    },
    PARTENAIRE: {
        '/admin/dashboard': ERR_ADMIN, '/admin/referral': ERR_ADMIN, '/partner/dashboard': PASS,
        '/partner/scan': PASS, '/scan': PASS, '/controller/scanner': ERR_CONTROLLER,
    },
    CONTROLEUR: {
        '/admin/dashboard': ERR_ADMIN, '/admin/referral': ERR_ADMIN, '/partner/dashboard': ERR_PARTNER,
        '/partner/scan': PASS, '/scan': PASS, '/controller/scanner': PASS,
    },
    ADMIN: {
        '/admin/dashboard': PASS, '/admin/referral': PASS, '/partner/dashboard': PASS,
        '/partner/scan': PASS, '/scan': PASS, '/controller/scanner': PASS,
    },
    SUPERADMIN: {
        '/admin/dashboard': PASS, '/admin/referral': PASS, '/partner/dashboard': PASS,
        '/partner/scan': PASS, '/scan': PASS, '/controller/scanner': PASS,
    },
};

const POST_LOGIN: Record<Role, string> = {
    CLIENT: '/',
    PARTENAIRE: '/partner/dashboard',
    CONTROLEUR: '/controller/scanner',
    ADMIN: '/admin/dashboard',
    SUPERADMIN: '/admin/dashboard',
};

const PUBLIC_PATHS = ['/', '/explore', `/events/evt-${uniqueSuffix()}`] as const;
const AUTH_PAGES = ['/login', '/register', '/forgot-password'] as const;

const cookiesByRole = new Map<Role, SessionCookie[]>();

function cookiesOf(role: Role): SessionCookie[] {
    const cookies = cookiesByRole.get(role);
    assert.ok(cookies, `session ${role} absente`);
    return cookies;
}

/** Destination relative d'une redirection, ou PASS si le middleware laisse passer. */
function outcome(res: MiddlewareResult): string {
    if (res.passedThrough) return PASS;
    assert.equal(res.status, 307, `redirection attendue, HTTP ${res.status}`);
    assert.ok(res.location, `redirection sans en-tête Location (HTTP ${res.status})`);
    const url = new URL(res.location);
    return `${url.pathname}${url.search}`;
}

before(async () => {
    for (const role of ROLES) {
        const account = await signUpAttacker(`r28-${role.toLowerCase()}`);
        if (role !== 'CLIENT') {
            const db = await openConcurrentClient({ applicationName: 'ev-test-r28' });
            try {
                await db.query('INSERT INTO public.user_roles (user_id, role) VALUES ($1, $2) ON CONFLICT (user_id, role) DO NOTHING', [account.userId, role]);
                const updated = await db.query(`UPDATE public.users SET status = 'ACTIF' WHERE id = $1`, [account.userId]);
                assert.equal(updated.rowCount, 1, `profil du compte ${role} absent`);
                await db.commit();
            } finally {
                await db.close();
            }
        }
        cookiesByRole.set(role, await sessionCookies(account.client));
    }
});

after(async () => {
    await assertRecetteInvariants('r28-middleware-matrice');
});

describe('R28 — visiteur anonyme', () => {
    test('pages publiques servies, pages protégées et /wallet renvoient vers /login?redirect=', async () => {
        const failures: string[] = [];
        for (const pathname of [...PUBLIC_PATHS, '/login']) {
            const seen = outcome(await callMiddleware(pathname, []));
            if (seen !== PASS) failures.push(`${pathname} : attendu ${PASS}, vu ${seen}`);
        }
        for (const pathname of [...PROTECTED, '/wallet']) {
            const expected = `/login?redirect=${encodeURIComponent(pathname)}`;
            const seen = outcome(await callMiddleware(pathname, []));
            if (seen !== expected) failures.push(`${pathname} : attendu ${expected}, vu ${seen}`);
        }
        assert.deepEqual(failures, [], `écarts de la matrice :\n${failures.join('\n')}`);
    });
});

describe('R28 — chaque rôle', () => {
    for (const role of ROLES) {
        test(`${role} : pages publiques servies, espaces protégés selon la règle réelle`, async () => {
            const cookies = cookiesOf(role);
            const failures: string[] = [];
            for (const pathname of PUBLIC_PATHS) {
                const seen = outcome(await callMiddleware(pathname, cookies));
                if (seen !== PASS) failures.push(`${pathname} : attendu ${PASS}, vu ${seen}`);
            }
            for (const pathname of PROTECTED) {
                const expected = MATRIX[role][pathname];
                const seen = outcome(await callMiddleware(pathname, cookies));
                if (seen !== expected) failures.push(`${pathname} : attendu ${expected}, vu ${seen}`);
            }
            assert.deepEqual(failures, [], `${role} : écarts de la matrice :\n${failures.join('\n')}`);
        });

        test(`${role} : les pages d’authentification renvoient vers ${POST_LOGIN[role]}`, async () => {
            const cookies = cookiesOf(role);
            const failures: string[] = [];
            for (const pathname of AUTH_PAGES) {
                const seen = outcome(await callMiddleware(pathname, cookies));
                if (seen !== POST_LOGIN[role]) failures.push(`${pathname} : attendu ${POST_LOGIN[role]}, vu ${seen}`);
            }
            assert.deepEqual(failures, [], `${role} : écarts :\n${failures.join('\n')}`);
        });
    }
});
