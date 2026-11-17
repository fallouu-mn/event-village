/**
 * Sécurité — déconnexion sans réseau (lot securite/deconnexion-hors-ligne). Règle : « Se déconnecter » efface TOUJOURS
 * localement et tout de suite la session, avec ou sans réseau ; la révocation côté serveur est tentée, refaite au retour du
 * réseau si les jetons sont encore en mémoire ; « Déconnecter tous mes appareils » et le scanner de même.
 * Vraie bibliothèque (@supabase/ssr, auth-js) contre le Supabase local : client « navigateur » sur un pot de cookies en
 * mémoire, réseau coupé puis rétabli par l'enveloppe du fetch global (toutes les requêtes notées), jeton d'accès « deux
 * heures plus tard » (échu pour le navigateur, signature refusée par le serveur, comme un jeton échu).
 *  a. Témoin de la cause, dans la bibliothèque : auth.signOut({ scope: 'local' }) sans réseau et jeton échu rend une erreur
 *     et garde le cookie de session (c'est ce que faisait l'application) ;
 *  b. lib/auth/sign-out-here, sans réseau : effacement tout de suite (moins d'une seconde), plus aucun cookie de session,
 *     SIGNED_OUT émis, aucune requête ; révocation : « reseau » ;
 *  c. retour du réseau : révocation faite avec les jetons gardés (jeton échu → rafraîchi → déconnexion) ; aucune requête avec
 *     l'ancien jeton hors des requêtes de révocation, en nombre borné ; le navigateur n'a plus de session (requête
 *     anonyme), le middleware renvoie vers la connexion ; l'ancien jeton d'accès ne donne plus de compte, l'ancien jeton de
 *     rafraîchissement est refusé ;
 *  d. « Déconnecter tous mes appareils » sans réseau : ce téléphone effacé tout de suite ; au retour du réseau, l'autre
 *     appareil du compte est déconnecté aussi (route /api/auth/sign-out-global, journalisée) ;
 *  e. écrans (lecture des fichiers) : AuthProvider efface avant tout appel réseau et montre « Vous êtes déconnecté de ce
 *     téléphone. » sur place ; contrôleur, scanner, profil et contrôle d'identité passent par useAuth().signOut ; page de
 *     connexion : même message.
 * Rouge avant le correctif : b à d (module absent), e (ancien code) ; a reste vert (la cause est dans la bibliothèque).
 * Navigateur réel (écran, retour du réseau, requêtes et cookies) : e2e/deconnexion.spec.ts au run complet.
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createBrowserClient } from '@supabase/ssr';
import { createClient, type Session } from '@supabase/supabase-js';
import { getServiceRoleClient } from '../../lib/supabase/server';
import { POST as signOutGlobal } from '../../app/api/auth/sign-out-global/route';
import { callMiddleware } from '../helpers/middleware';
import { gotrueEmail } from '../helpers/gotrue-email';
import { assertFinition1Invariants } from '../helpers/finition1-invariants';
import { importModule } from './paiement-helpers';
import { jsonRequest, randomEmail, randomSenegalPhone, STRONG_PASSWORD } from './helpers';

const ROOT = process.cwd();
/** Fichier lu en fins de ligne LF (copie de travail Windows en CRLF, CI en LF). */
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\r\n/g, '\n');
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const anon = () => createClient(SUPABASE_URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });

interface Held { access: string; refresh: string; everywhere: boolean }
type SignOutModule = {
    dropLocalSession(auth: unknown): Promise<void>;
    revokeHeld(t: Held): Promise<'fait' | 'reseau'>;
};

async function mod(): Promise<SignOutModule> {
    const m = (await importModule('../../lib/auth/sign-out-here')) as unknown as SignOutModule;
    assert.equal(typeof m.dropLocalSession, 'function', 'dropLocalSession exportée par lib/auth/sign-out-here.ts');
    return m;
}

// ── Réseau : enveloppe du fetch global (verrou de tests/helpers/env.ts gardé dessous) ───────────────────────────────
/** Requêtes vues : méthode, adresse, en-tête Authorization, corps. */
interface Sent { method: string; url: string; auth: string; body: string }
const sent: Sent[] = [];
const net = { offline: false };
const lockedFetch = globalThis.fetch;
/** Requêtes de révocation admises avec l'ancien jeton (seules exceptions de la règle « aucune requête avec l'ancien jeton »). */
const REVOCATION = /\/auth\/v1\/logout\?scope=local$|\/auth\/v1\/token\?grant_type=refresh_token$|^\/api\/auth\/sign-out-global$/;

globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    sent.push({ method: init?.method ?? 'GET', url, auth: headers.get('authorization') ?? '', body: typeof init?.body === 'string' ? init.body : '' });
    if (net.offline) throw new TypeError('fetch failed');
    // Route de l'application (adresse relative dans le navigateur) : servie par son gestionnaire importé
    if (url === '/api/auth/sign-out-global') return signOutGlobal(jsonRequest(url, {}, Object.fromEntries(headers)));
    return lockedFetch(input, init);
}) as typeof fetch;

after(async () => {
    globalThis.fetch = lockedFetch;
    await assertFinition1Invariants('securite-deconnexion');
});

// ── Comptes et « navigateur » ───────────────────────────────────────────────────────────────────────────────────────
async function newAccount(label: string): Promise<string> {
    const service = getServiceRoleClient();
    const email = randomEmail(label);
    const phone = randomSenegalPhone('76');
    const { data, error } = await service.auth.admin.createUser({ email, phone, password: STRONG_PASSWORD, email_confirm: true, phone_confirm: true });
    assert.equal(error, null, `création : ${error?.message}`);
    const { error: upErr } = await service.from('users').update({ phone }).eq('id', data.user!.id);
    assert.equal(upErr, null, `profil : ${upErr?.message}`);
    return gotrueEmail(email);
}

/** Client du navigateur (singleton désactivé) sur un pot de cookies en mémoire ; événements d'authentification notés. */
function browser(jar: Map<string, string>, events: string[]) {
    const client = createBrowserClient(SUPABASE_URL, ANON, {
        isSingleton: false,
        cookies: {
            getAll: () => Array.from(jar, ([name, value]) => ({ name, value })),
            setAll: (cookies) => {
                for (const c of cookies) {
                    if (c.value) jar.set(c.name, c.value);
                    else jar.delete(c.name);
                }
            },
        },
    });
    client.auth.onAuthStateChange((event) => {
        events.push(event);
    });
    return client;
}

const sessionCookies = (jar: Map<string, string>) => [...jar.keys()].filter((k) => k.includes('-auth-token'));

/** Connexion, puis « deux heures plus tard » : session échue pour le navigateur, jeton d'accès refusé par le serveur. */
async function signedInTwoHoursLater(jar: Map<string, string>, events: string[], email: string) {
    const client = browser(jar, events);
    const { data, error } = await client.auth.signInWithPassword({ email, password: STRONG_PASSWORD });
    assert.equal(error, null, `connexion : ${error?.message}`);
    const s = data.session!;
    assert.ok(sessionCookies(jar).length > 0, 'cookie de session posé à la connexion');
    const tampered = s.access_token.slice(0, -4) + (s.access_token.endsWith('AAAA') ? 'BBBB' : 'AAAA');
    const aged: Session = { ...s, access_token: tampered, expires_at: Math.floor(Date.now() / 1000) - 3600 };
    await (client.auth as unknown as { _saveSession(x: Session): Promise<void> })._saveSession(aged);
    return { client, original: s.access_token, held: { access: tampered, refresh: s.refresh_token, everywhere: false } as Held };
}

/** L'ancien jeton porté par une requête : en-tête Authorization (jeton d'origine ou vieilli) ou corps (rafraîchissement). */
function carriesOld(s: Sent, olds: string[]): boolean {
    return olds.some((t) => s.auth.includes(t) || s.body.includes(t));
}

describe('a. témoin de la cause (bibliothèque)', () => {
    test('auth.signOut sans réseau, jeton échu : erreur rendue, cookie de session gardé, pas de SIGNED_OUT', async () => {
        const jar = new Map<string, string>();
        const events: string[] = [];
        const { client } = await signedInTwoHoursLater(jar, events, await newAccount('deco-temoin'));
        net.offline = true;
        try {
            const { error } = await client.auth.signOut({ scope: 'local' });
            console.log(`[SECU-DECO] témoin : auth.signOut sans réseau → ${error?.name ?? 'aucune erreur'} ; cookies de session ${sessionCookies(jar).length}`);
            assert.ok(error, 'auth.signOut rend une erreur sans réseau avec un jeton échu');
            assert.ok(sessionCookies(jar).length > 0, 'la session reste dans le navigateur');
            assert.ok(!events.includes('SIGNED_OUT'));
        } finally {
            net.offline = false;
        }
    });
});

describe('b-c. « Se déconnecter » sans réseau, puis retour du réseau', () => {
    test('effacement tout de suite ; révocation au retour du réseau ; aucune requête avec l’ancien jeton', async () => {
        const m = await mod();
        const jar = new Map<string, string>();
        const events: string[] = [];
        const { client, original, held } = await signedInTwoHoursLater(jar, events, await newAccount('deco-local'));
        const olds = [original, held.access, held.refresh];
        net.offline = true;
        let started = sent.length;
        const t0 = Date.now();
        await m.dropLocalSession(client.auth);
        const ms = Date.now() - t0;
        assert.ok(ms < 1_000, `effacement en ${ms} ms`);
        assert.deepEqual(sessionCookies(jar), [], 'plus aucun cookie de session');
        assert.ok(events.includes('SIGNED_OUT'), 'SIGNED_OUT émis (purges, temps réel, autres onglets)');
        assert.equal(sent.length, started, 'aucune requête pendant l’effacement');
        const pending: Held = { ...held };
        assert.equal(await m.revokeHeld(pending), 'reseau', 'sans réseau : révocation à refaire');

        net.offline = false;
        started = sent.length;
        assert.equal(await m.revokeHeld(pending), 'fait', 'retour du réseau : révocation faite');
        // Page relue : plus de session dans ce navigateur, requête anonyme ; le middleware ne rouvre rien
        assert.equal((await client.auth.getSession()).data.session, null);
        await client.from('events').select('id').limit(1);
        const mw = await callMiddleware('/profile', Array.from(jar, ([name, value]) => ({ name, value })));
        assert.equal(mw.passedThrough, false, 'page protégée : pas de session');
        assert.match(mw.location ?? '', /\/login/);
        const after = sent.slice(started);
        const leaks = after.filter((s) => carriesOld(s, olds) && !REVOCATION.test(s.url.replace(SUPABASE_URL, '')));
        const revocations = after.filter((s) => REVOCATION.test(s.url.replace(SUPABASE_URL, '')));
        console.log(`[SECU-DECO] retour du réseau : ${after.length} requête(s), révocation ${revocations.map((s) => s.url.replace(SUPABASE_URL, '')).join(' → ')}`);
        assert.deepEqual(leaks.map((s) => `${s.method} ${s.url}`), [], 'aucune requête avec l’ancien jeton hors révocation');
        assert.ok(revocations.length >= 1 && revocations.length <= 3, `requêtes de révocation bornées (${revocations.length})`);
        assert.equal((await anon().auth.getUser(original)).data.user, null, 'ancien jeton d’accès : plus de compte');
        const { error: refreshErr } = await anon().auth.refreshSession({ refresh_token: held.refresh });
        assert.ok(refreshErr, 'ancien jeton de rafraîchissement refusé (session révoquée)');
    });
});

describe('d. « Déconnecter tous mes appareils » sans réseau', () => {
    test('ce téléphone effacé tout de suite ; au retour du réseau, l’autre appareil est déconnecté aussi', async () => {
        const m = await mod();
        const email = await newAccount('deco-partout');
        const jar = new Map<string, string>();
        const events: string[] = [];
        const { client, original, held } = await signedInTwoHoursLater(jar, events, email);
        const { data: other, error } = await anon().auth.signInWithPassword({ email, password: STRONG_PASSWORD });
        assert.equal(error, null, `second appareil : ${error?.message}`);
        net.offline = true;
        await m.dropLocalSession(client.auth);
        assert.deepEqual(sessionCookies(jar), []);
        const pending: Held = { ...held, everywhere: true };
        assert.equal(await m.revokeHeld(pending), 'reseau');
        net.offline = false;
        assert.equal(await m.revokeHeld(pending), 'fait');
        assert.equal((await anon().auth.getUser(original)).data.user, null, 'ce téléphone : plus de compte');
        assert.equal((await anon().auth.getUser(other.session!.access_token)).data.user, null, 'autre appareil : plus de compte');
        const { error: refreshErr } = await anon().auth.refreshSession({ refresh_token: other.session!.refresh_token });
        assert.ok(refreshErr, 'autre appareil : jeton de rafraîchissement refusé');
    });
});

describe('e. écrans', () => {
    test('AuthProvider : effacement avant tout appel réseau, écran sur place, plus d’auth.signOut', () => {
        const auth = read('components/providers/AuthProvider.tsx');
        assert.match(auth, /import \{ dropLocalSession, revokeSoon, unsubscribePush \} from '@\/lib\/auth\/sign-out-here';/);
        assert.doesNotMatch(auth, /\.auth\.signOut\(/, 'auth.signOut ne ferme pas la session sans réseau (a)');
        const at = auth.search(/const signOut = async \(scope\?: 'partout'\) => \{/);
        assert.ok(at >= 0, 'signOut(scope?: « partout »)');
        const body = auth.slice(at, auth.indexOf('\n    };\n', at));
        const order = ['clearAllScanMemory();', 'clearAllDrafts();', 'setSignedOut(true);', 'await dropLocalSession(', 'revokeSoon('];
        const positions = order.map((s) => body.indexOf(s));
        assert.ok(positions.every((p, i) => p >= 0 && (i === 0 || p > positions[i - 1])), `ordre : ${order.join(' → ')} (${positions.join(', ')})`);
        assert.ok(body.indexOf('await dropLocalSession(') < body.search(/await (?!dropLocalSession)/) || body.search(/await (?!dropLocalSession)/) < 0,
            'aucun appel réseau attendu avant l’effacement');
        assert.match(auth, /Vous êtes déconnecté de ce téléphone\./);
        assert.match(auth, /router\.replace\('\/login\?message=deconnecte'\)/);
    });
    test('contrôleur, scanner, profil, contrôle d’identité : une seule déconnexion (useAuth)', () => {
        for (const f of ['app/controller/layout.tsx', 'app/controller/scanner/page.tsx']) {
            const src = read(f);
            assert.doesNotMatch(src, /\.auth\.signOut\(/, `${f} : plus d’auth.signOut`);
            assert.match(src, /useAuth\(\)/, `${f} : useAuth`);
        }
        const profile = read('app/profile/page.tsx');
        assert.match(profile, /signOut\('partout'\)/);
        assert.doesNotMatch(profile, /fetch\('\/api\/auth\/sign-out-global'/);
        assert.doesNotMatch(read('components/admin/AdminStepUpGate.tsx'), /signOut\(\)\.then\(/);
    });
    test('page de connexion : « Vous êtes déconnecté de ce téléphone. »', () => {
        assert.match(read('components/auth/LoginForm.tsx'), /deconnecte: 'Vous êtes déconnecté de ce téléphone\.'/);
    });
});
