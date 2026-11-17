/**
 * Sécurité — « Se déconnecter » sans réseau, dans un vrai navigateur (lot securite/deconnexion-hors-ligne).
 * Compte client créé pour le test (jamais l'état enregistré d'un rôle : la révocation le fermerait pour les autres phases),
 * connexion par le formulaire, réseau coupé, horloge du navigateur avancée de deux heures (jeton d'accès échu pour
 * auth-js : c'est le cas où l'ancienne déconnexion gardait la session), clic sur « Se déconnecter ».
 *  1. Sans réseau, tout de suite : « Vous êtes déconnecté de ce téléphone. » à l'écran, plus aucun cookie de session.
 *  2. Retour du réseau : la révocation part avec le jeton gardé en mémoire ; l'écran de connexion s'ouvre avec le même
 *     message ; /profile renvoie vers la connexion ; aucun compte n'est montré.
 *  3. Aucune requête (pages, données, API) ne part avec l'ancien jeton ou les cookies de session, hors des requêtes de
 *     révocation ; côté serveur, l'ancien jeton d'accès ne donne plus de compte et l'ancien jeton de rafraîchissement est
 *     refusé.
 * Constats en expect.soft : un rouge montre toute la chaîne (message, cookies, compte rouvert, requêtes, révocation).
 * Même règle sans navigateur, avec la vraie bibliothèque : tests/parcours/securite-deconnexion.test.ts.
 */
import { expect, test, type BrowserContext } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { combineChunks, stringFromBase64URL } from '@supabase/ssr';
import { TEST_PASSWORD } from '../tests/helpers/fixture-data';
import { openAnonymousContext } from './support/fixtures';
import { createClientAccount } from './support/service';
import { e2eConfig } from './support/env';

const AUTH_COOKIE = /^sb-.+-auth-token(?:-code-verifier)?(?:\.\d+)?$/;
/** Requêtes de révocation admises avec l'ancien jeton (mêmes exceptions que tests/parcours/securite-deconnexion.test.ts). */
const REVOCATION = /\/auth\/v1\/logout\?scope=local$|\/auth\/v1\/token\?grant_type=refresh_token$|\/api\/auth\/sign-out-global$/;
const SIGNED_OUT_TEXT = 'Vous êtes déconnecté de ce téléphone.';

interface Tokens { access_token: string; refresh_token: string }
interface Sent { method: string; url: string; cookie: string; auth: string; body: string }

/** Session lue dans les cookies du contexte (format de @supabase/ssr : morceaux, préfixe « base64- »). */
async function sessionOf(context: BrowserContext): Promise<Tokens | null> {
    const jar = new Map((await context.cookies()).map((c) => [c.name, c.value]));
    const key = [...jar.keys()].find((n) => /^sb-[^.]+-auth-token(\.0)?$/.test(n))?.replace(/\.0$/, '');
    if (!key) return null;
    const raw = await combineChunks(key, (name) => jar.get(name));
    if (!raw) return null;
    return JSON.parse(raw.startsWith('base64-') ? stringFromBase64URL(raw.slice(7)) : raw) as Tokens;
}

test('« Se déconnecter » sans réseau, deux heures après la connexion, puis retour du réseau', async ({ browser }, testInfo) => {
    test.setTimeout(4 * 60_000);
    const account = await createClientAccount('deco-hors-ligne');
    const context = await openAnonymousContext(browser, testInfo);
    await context.clock.install({ time: Date.now() });
    const page = await context.newPage();
    try {
        await page.goto('/login');
        await page.getByLabel(/e-?mail ou t[ée]l[ée]phone/i).first().fill(account.email);
        await page.getByLabel(/^mot de passe/i).first().fill(TEST_PASSWORD);
        await page.getByRole('button', { name: /^se connecter$/i }).click();
        await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 });
        await page.goto('/profile');
        const signOutButton = page.getByRole('button', { name: /^se déconnecter$/i }).first();
        await expect(signOutButton, 'compte connecté').toBeVisible();
        const old = await sessionOf(context);
        expect(old, 'session dans les cookies après la connexion').not.toBeNull();

        // 1. Sans réseau, deux heures plus tard
        await context.setOffline(true);
        await context.clock.fastForward('02:00:00');
        await signOutButton.click();
        await expect.soft(page.getByText(SIGNED_OUT_TEXT, { exact: true }), 'message sans réseau, tout de suite').toBeVisible({ timeout: 3_000 });
        await expect.soft.poll(async () => (await context.cookies()).filter((c) => AUTH_COOKIE.test(c.name)).map((c) => c.name),
            { message: 'cookies de session effacés tout de suite', timeout: 3_000 }).toEqual([]);

        // 2-3. Retour du réseau : toutes les requêtes notées
        const sent: Promise<Sent | null>[] = [];
        context.on('request', (r) => {
            sent.push(r.allHeaders().then((h) => ({
                method: r.method(), url: r.url(), cookie: h.cookie ?? '', auth: h.authorization ?? '', body: r.postData() ?? '',
            })).catch(() => null));
        });
        await context.setOffline(false);
        await expect.soft(page, 'écran de connexion au retour du réseau').toHaveURL(/\/login\?message=deconnecte/, { timeout: 30_000 });
        await expect.soft(page.getByText(SIGNED_OUT_TEXT, { exact: true }), 'message sur l’écran de connexion').toBeVisible();
        const anon = createClient(e2eConfig().supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
        await expect.soft.poll(async () => (await anon.auth.getUser(old!.access_token)).data.user?.id ?? null,
            { message: 'révocation faite au retour du réseau', timeout: 30_000 }).toBeNull();
        await page.goto('/profile');
        await expect.soft(page, 'page protégée : connexion demandée').toHaveURL(/\/login\?redirect=%2Fprofile/);
        await expect.soft(page.getByRole('button', { name: /^se déconnecter$/i }), 'aucun compte affiché').toHaveCount(0);

        const all = (await Promise.all(sent)).filter((s): s is Sent => s !== null);
        const leaks = all.filter((s) => !REVOCATION.test(s.url) && (
            s.cookie.split(/;\s*/).some((c) => AUTH_COOKIE.test(c.split('=')[0]))
            || s.auth.includes(old!.access_token) || s.body.includes(old!.refresh_token)));
        console.log(`[SECU-DECO-E2E] ${all.length} requête(s) après le retour du réseau ; révocation : ${all.filter((s) => REVOCATION.test(s.url)).map((s) => `${s.method} ${new URL(s.url).pathname}`).join(', ') || 'aucune'}`);
        expect.soft(leaks.map((s) => `${s.method} ${s.url}`), 'aucune requête avec l’ancien jeton ou les cookies de session').toEqual([]);
        const { error } = await anon.auth.refreshSession({ refresh_token: old!.refresh_token });
        expect(error, 'ancien jeton de rafraîchissement refusé').not.toBeNull();
    } finally {
        await context.close();
    }
});
