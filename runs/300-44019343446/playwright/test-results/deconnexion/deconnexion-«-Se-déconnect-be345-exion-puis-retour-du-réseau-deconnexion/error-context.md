# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: deconnexion.spec.ts >> « Se déconnecter » sans réseau, deux heures après la connexion, puis retour du réseau
- Location: e2e/deconnexion.spec.ts:41:5

# Error details

```
Error: message sans réseau, tout de suite

expect(locator).toBeVisible() failed

Locator: getByText('Vous êtes déconnecté de ce téléphone.', { exact: true })
Expected: visible
Timeout: 3000ms
Error: element(s) not found

Call log:
  - message sans réseau, tout de suite getByText('Vous êtes déconnecté de ce téléphone.', { exact: true }) with timeout 3000ms
  - waiting for getByText('Vous êtes déconnecté de ce téléphone.', { exact: true })

```

```yaml
- banner:
  - button "Ouvrir le menu"
  - link "Event Village, accueil":
    - /url: /
  - button "Notifications"
  - button "Basculer le thème"
  - link "Mon profil (Awa Sarr)":
    - /url: /profile
- main:
  - heading "Mon profil" [level=1]
  - paragraph: Vos coordonnées, l’affichage de l’application, vos notifications et vos accès.
  - region "Awa Sarr":
    - button "Choisir une photo"
    - paragraph: JPEG, PNG ou WebP, 2 Mo au plus.
    - heading "Awa Sarr" [level=2]
    - term: Téléphone
    - definition: +221 77 704 59 19
    - term: Email
    - definition: c1.deco-hors-ligne.777045919@recette.eventvillage.local
    - term: "Rôle :"
    - definition: Client
    - term: Statut du compte
    - definition: Compte actif
  - region "Mes informations":
    - heading "Mes informations" [level=2]
    - text: Prénom
    - textbox "Prénom": Awa
    - text: Nom
    - textbox "Nom": Sarr
    - text: Adresse email
    - textbox "Adresse email": c1.deco-hors-ligne.777045919@recette.eventvillage.local
    - paragraph: "Recommandé : recevez vos billets et confirmations par email"
    - status:
      - paragraph: Adresse email non vérifiée
      - text: "c1.deco-hors-ligne.777045919@recette.eventvillage.local : ouvrez le lien reçu par email pour la vérifier. En attendant, connectez-vous avec votre numéro."
      - button "Recevoir le lien de vérification"
    - button "Enregistrer le profil"
    - paragraph: Numéro de téléphone
    - paragraph: Un code envoyé au nouveau numéro confirme le changement.
    - button "Changer de numéro"
    - paragraph: Mot de passe
    - paragraph: Les autres appareils seront déconnectés.
    - button "Changer de mot de passe"
  - region "Réglages et espaces":
    - heading "Réglages et espaces" [level=2]
    - list:
      - listitem:
        - link "Préférences de notification Rappels, changements d’événement, SMS et notifications push sur cet appareil":
          - /url: /profile/notifications
      - listitem:
        - link "Mes paiements L’historique de vos paiements et de vos remboursements":
          - /url: /profile/payments
      - listitem:
        - link "Portefeuille de parrainage Vos gains de parrainage et vos demandes de retrait":
          - /url: /wallet
  - region "Affichage":
    - heading "Affichage" [level=2]
    - group "Thème de l’application":
      - button "Clair" [pressed]
      - button "Sombre"
      - button "Système"
  - button "Se déconnecter"
  - paragraph: « Se déconnecter » ferme seulement cet appareil.
  - button "Déconnecter tous mes appareils"
- navigation "Navigation rapide":
  - link "Accueil":
    - /url: /
  - link "Explorer":
    - /url: /explore
  - link "Billets":
    - /url: /tickets
  - link "Portefeuille":
    - /url: /wallet
- alert
```

```
Error: cookies de session effacés tout de suite

cookies de session effacés tout de suite

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 4

- Array []
+ Array [
+   "sb-127-auth-token.0",
+   "sb-127-auth-token.1",
+ ]

Call Log:
- Timeout 3000ms exceeded while waiting on the predicate
```

```
Error: écran de connexion au retour du réseau

expect(page).toHaveURL(expected) failed

Expected pattern: /\/login\?message=deconnecte/
Received string:  "http://localhost:3000/login"
Timeout: 30000ms

Call log:
  - écran de connexion au retour du réseau with timeout 30000ms
    5 × locator resolved to <html lang="fr" class="__variable_a8fb83">…</html>
      - unexpected value "http://localhost:3000/profile"
    58 × locator resolved to <html lang="fr" class="__variable_a8fb83">…</html>
       - unexpected value "http://localhost:3000/login"

```

```yaml
- banner:
  - button "Ouvrir le menu"
  - link "Event Village, accueil":
    - /url: /
  - button "Notifications"
  - button "Basculer le thème"
  - link "Se connecter":
    - /url: /login
- main:
  - link "Event Village, accueil":
    - /url: /
    - text: EVENT VILLAGE
  - heading "Connexion" [level=1]
  - paragraph: Accédez à vos billets, commandes, réservations et portefeuille.
  - group "Mode de connexion":
    - button "Mot de passe" [pressed]
    - button "Code SMS"
  - text: Email ou téléphone
  - textbox "Email ou téléphone":
    - /placeholder: 77 123 45 67 ou adresse email
  - paragraph: "Email : seulement si votre adresse a été vérifiée. Sinon, utilisez votre numéro."
  - text: Mot de passe
  - link "Mot de passe oublié ?":
    - /url: /forgot-password
  - textbox "Mot de passe"
  - button "Afficher le mot de passe"
  - button "Se connecter"
  - paragraph:
    - text: Pas encore de compte ?
    - link "Créer un compte client":
      - /url: /register
  - 'link "Espace professionnel Organisateurs, salles et restaurants : devenir partenaire"':
    - /url: /partner/register
  - paragraph:
    - text: Besoin d’aide ?
    - link "Aide et contact du support":
      - /url: /aide
- navigation "Navigation rapide":
  - link "Accueil":
    - /url: /
  - link "Explorer":
    - /url: /explore
  - link "Billets":
    - /url: /tickets
  - link "Portefeuille":
    - /url: /wallet
- alert
```

```
Error: message sur l’écran de connexion

expect(locator).toBeVisible() failed

Locator: getByText('Vous êtes déconnecté de ce téléphone.', { exact: true })
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - message sur l’écran de connexion getByText('Vous êtes déconnecté de ce téléphone.', { exact: true }) with timeout 15000ms
  - waiting for getByText('Vous êtes déconnecté de ce téléphone.', { exact: true })

```

```yaml
- banner:
  - button "Ouvrir le menu"
  - link "Event Village, accueil":
    - /url: /
  - button "Notifications"
  - button "Basculer le thème"
  - link "Se connecter":
    - /url: /login
- main:
  - link "Event Village, accueil":
    - /url: /
    - text: EVENT VILLAGE
  - heading "Connexion" [level=1]
  - paragraph: Accédez à vos billets, commandes, réservations et portefeuille.
  - group "Mode de connexion":
    - button "Mot de passe" [pressed]
    - button "Code SMS"
  - text: Email ou téléphone
  - textbox "Email ou téléphone":
    - /placeholder: 77 123 45 67 ou adresse email
  - paragraph: "Email : seulement si votre adresse a été vérifiée. Sinon, utilisez votre numéro."
  - text: Mot de passe
  - link "Mot de passe oublié ?":
    - /url: /forgot-password
  - textbox "Mot de passe"
  - button "Afficher le mot de passe"
  - button "Se connecter"
  - paragraph:
    - text: Pas encore de compte ?
    - link "Créer un compte client":
      - /url: /register
  - 'link "Espace professionnel Organisateurs, salles et restaurants : devenir partenaire"':
    - /url: /partner/register
  - paragraph:
    - text: Besoin d’aide ?
    - link "Aide et contact du support":
      - /url: /aide
- navigation "Navigation rapide":
  - link "Accueil":
    - /url: /
  - link "Explorer":
    - /url: /explore
  - link "Billets":
    - /url: /tickets
  - link "Portefeuille":
    - /url: /wallet
- alert
```

```
Error: aucune requête avec l’ancien jeton ou les cookies de session

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 4

- Array []
+ Array [
+   "GET http://localhost:3000/api/tickets",
+   "GET http://localhost:3000/api/auth/me",
+ ]
```

# Test source

```ts
  1  | /**
  2  |  * Sécurité — « Se déconnecter » sans réseau, dans un vrai navigateur (lot securite/deconnexion-hors-ligne).
  3  |  * Compte client créé pour le test (jamais l'état enregistré d'un rôle : la révocation le fermerait pour les autres phases),
  4  |  * connexion par le formulaire, réseau coupé, horloge du navigateur avancée de deux heures (jeton d'accès échu pour
  5  |  * auth-js : c'est le cas où l'ancienne déconnexion gardait la session), clic sur « Se déconnecter ».
  6  |  *  1. Sans réseau, tout de suite : « Vous êtes déconnecté de ce téléphone. » à l'écran, plus aucun cookie de session.
  7  |  *  2. Retour du réseau : la révocation part avec le jeton gardé en mémoire ; l'écran de connexion s'ouvre avec le même
  8  |  *     message ; /profile renvoie vers la connexion ; aucun compte n'est montré.
  9  |  *  3. Aucune requête (pages, données, API) ne part avec l'ancien jeton ou les cookies de session, hors des requêtes de
  10 |  *     révocation ; côté serveur, l'ancien jeton d'accès ne donne plus de compte et l'ancien jeton de rafraîchissement est
  11 |  *     refusé.
  12 |  * Constats en expect.soft : un rouge montre toute la chaîne (message, cookies, compte rouvert, requêtes, révocation).
  13 |  * Même règle sans navigateur, avec la vraie bibliothèque : tests/parcours/securite-deconnexion.test.ts.
  14 |  */
  15 | import { expect, test, type BrowserContext } from '@playwright/test';
  16 | import { createClient } from '@supabase/supabase-js';
  17 | import { combineChunks, stringFromBase64URL } from '@supabase/ssr';
  18 | import { TEST_PASSWORD } from '../tests/helpers/fixture-data';
  19 | import { openAnonymousContext } from './support/fixtures';
  20 | import { createClientAccount } from './support/service';
  21 | import { e2eConfig } from './support/env';
  22 | 
  23 | const AUTH_COOKIE = /^sb-.+-auth-token(?:-code-verifier)?(?:\.\d+)?$/;
  24 | /** Requêtes de révocation admises avec l'ancien jeton (mêmes exceptions que tests/parcours/securite-deconnexion.test.ts). */
  25 | const REVOCATION = /\/auth\/v1\/logout\?scope=local$|\/auth\/v1\/token\?grant_type=refresh_token$|\/api\/auth\/sign-out-global$/;
  26 | const SIGNED_OUT_TEXT = 'Vous êtes déconnecté de ce téléphone.';
  27 | 
  28 | interface Tokens { access_token: string; refresh_token: string }
  29 | interface Sent { method: string; url: string; cookie: string; auth: string; body: string }
  30 | 
  31 | /** Session lue dans les cookies du contexte (format de @supabase/ssr : morceaux, préfixe « base64- »). */
  32 | async function sessionOf(context: BrowserContext): Promise<Tokens | null> {
  33 |     const jar = new Map((await context.cookies()).map((c) => [c.name, c.value]));
  34 |     const key = [...jar.keys()].find((n) => /^sb-[^.]+-auth-token(\.0)?$/.test(n))?.replace(/\.0$/, '');
  35 |     if (!key) return null;
  36 |     const raw = await combineChunks(key, (name) => jar.get(name));
  37 |     if (!raw) return null;
  38 |     return JSON.parse(raw.startsWith('base64-') ? stringFromBase64URL(raw.slice(7)) : raw) as Tokens;
  39 | }
  40 | 
  41 | test('« Se déconnecter » sans réseau, deux heures après la connexion, puis retour du réseau', async ({ browser }, testInfo) => {
  42 |     test.setTimeout(4 * 60_000);
  43 |     const account = await createClientAccount('deco-hors-ligne');
  44 |     const context = await openAnonymousContext(browser, testInfo);
  45 |     await context.clock.install({ time: Date.now() });
  46 |     const page = await context.newPage();
  47 |     try {
  48 |         await page.goto('/login');
  49 |         await page.getByLabel(/e-?mail ou t[ée]l[ée]phone/i).first().fill(account.email);
  50 |         await page.getByLabel(/^mot de passe/i).first().fill(TEST_PASSWORD);
  51 |         await page.getByRole('button', { name: /^se connecter$/i }).click();
  52 |         await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 });
  53 |         await page.goto('/profile');
  54 |         const signOutButton = page.getByRole('button', { name: /^se déconnecter$/i }).first();
  55 |         await expect(signOutButton, 'compte connecté').toBeVisible();
  56 |         const old = await sessionOf(context);
  57 |         expect(old, 'session dans les cookies après la connexion').not.toBeNull();
  58 | 
  59 |         // 1. Sans réseau, deux heures plus tard
  60 |         await context.setOffline(true);
  61 |         await context.clock.fastForward('02:00:00');
  62 |         await signOutButton.click();
  63 |         await expect.soft(page.getByText(SIGNED_OUT_TEXT, { exact: true }), 'message sans réseau, tout de suite').toBeVisible({ timeout: 3_000 });
  64 |         await expect.soft.poll(async () => (await context.cookies()).filter((c) => AUTH_COOKIE.test(c.name)).map((c) => c.name),
  65 |             { message: 'cookies de session effacés tout de suite', timeout: 3_000 }).toEqual([]);
  66 | 
  67 |         // 2-3. Retour du réseau : toutes les requêtes notées
  68 |         const sent: Promise<Sent | null>[] = [];
  69 |         context.on('request', (r) => {
  70 |             sent.push(r.allHeaders().then((h) => ({
  71 |                 method: r.method(), url: r.url(), cookie: h.cookie ?? '', auth: h.authorization ?? '', body: r.postData() ?? '',
  72 |             })).catch(() => null));
  73 |         });
  74 |         await context.setOffline(false);
  75 |         await expect.soft(page, 'écran de connexion au retour du réseau').toHaveURL(/\/login\?message=deconnecte/, { timeout: 30_000 });
  76 |         await expect.soft(page.getByText(SIGNED_OUT_TEXT, { exact: true }), 'message sur l’écran de connexion').toBeVisible();
  77 |         const anon = createClient(e2eConfig().supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  78 |         await expect.soft.poll(async () => (await anon.auth.getUser(old!.access_token)).data.user?.id ?? null,
  79 |             { message: 'révocation faite au retour du réseau', timeout: 30_000 }).toBeNull();
  80 |         await page.goto('/profile');
  81 |         await expect.soft(page, 'page protégée : connexion demandée').toHaveURL(/\/login\?redirect=%2Fprofile/);
  82 |         await expect.soft(page.getByRole('button', { name: /^se déconnecter$/i }), 'aucun compte affiché').toHaveCount(0);
  83 | 
  84 |         const all = (await Promise.all(sent)).filter((s): s is Sent => s !== null);
  85 |         const leaks = all.filter((s) => !REVOCATION.test(s.url) && (
  86 |             s.cookie.split(/;\s*/).some((c) => AUTH_COOKIE.test(c.split('=')[0]))
  87 |             || s.auth.includes(old!.access_token) || s.body.includes(old!.refresh_token)));
  88 |         console.log(`[SECU-DECO-E2E] ${all.length} requête(s) après le retour du réseau ; révocation : ${all.filter((s) => REVOCATION.test(s.url)).map((s) => `${s.method} ${new URL(s.url).pathname}`).join(', ') || 'aucune'}`);
> 89 |         expect.soft(leaks.map((s) => `${s.method} ${s.url}`), 'aucune requête avec l’ancien jeton ou les cookies de session').toEqual([]);
     |                                                                                                                               ^ Error: aucune requête avec l’ancien jeton ou les cookies de session
  90 |         const { error } = await anon.auth.refreshSession({ refresh_token: old!.refresh_token });
  91 |         expect(error, 'ancien jeton de rafraîchissement refusé').not.toBeNull();
  92 |     } finally {
  93 |         await context.close();
  94 |     }
  95 | });
  96 | 
```