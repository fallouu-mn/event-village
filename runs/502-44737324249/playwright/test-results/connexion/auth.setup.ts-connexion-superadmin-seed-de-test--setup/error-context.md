# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.setup.ts >> connexion : superadmin (seed de test)
- Location: e2e/auth.setup.ts:54:10

# Error details

```
TimeoutError: locator.click: Timeout 15000ms exceeded.
Call log:
  - waiting for getByRole('alertdialog', { name: /code administrateur/i }).getByRole('textbox', { name: /chiffre 1 sur 6/i })

```

# Page snapshot

```yaml
- generic [ref=f2e1]:
  - generic [ref=f2e2]:
    - complementary [ref=f2e3]:
      - link "Event Village, accueil" [ref=f2e5] [cursor=pointer]:
        - /url: /
        - generic [ref=f2e6]: Event Village
      - navigation "Navigation principale" [ref=f2e9]:
        - generic [ref=f2e10]: Administration
        - link "Tableau de bord" [ref=f2e15] [cursor=pointer]:
          - /url: /admin/dashboard
        - generic [ref=f2e22]:
          - paragraph [ref=f2e23]: Gestion
          - generic [ref=f2e24]:
            - link "Événements" [ref=f2e25] [cursor=pointer]:
              - /url: /admin/events
            - link "Comptes" [ref=f2e29] [cursor=pointer]:
              - /url: /admin/users
            - link "Catalogues et services" [ref=f2e36] [cursor=pointer]:
              - /url: /admin/services
            - link "Salles à valider" [ref=f2e42] [cursor=pointer]:
              - /url: /admin/halls
        - generic [ref=f2e48]:
          - paragraph [ref=f2e49]: Finances
          - link "Finance" [ref=f2e51] [cursor=pointer]:
            - /url: /admin/finance
        - generic [ref=f2e55]:
          - paragraph [ref=f2e56]: Engagement
          - generic [ref=f2e57]:
            - link "Parrainage" [ref=f2e58] [cursor=pointer]:
              - /url: /admin/referral
            - link "Campagnes" [ref=f2e63] [cursor=pointer]:
              - /url: /admin/communications
            - link "À la une" [ref=f2e68] [cursor=pointer]:
              - /url: /admin/a-la-une
        - generic [ref=f2e72]:
          - paragraph [ref=f2e73]: Système
          - generic [ref=f2e74]:
            - link "Réglages" [ref=f2e75] [cursor=pointer]:
              - /url: /admin/finance-settings
            - link "Journal d’audit" [ref=f2e80] [cursor=pointer]:
              - /url: /admin/audit
            - link "Notifications" [ref=f2e85] [cursor=pointer]:
              - /url: /admin/notifications
            - link "Scanner" [ref=f2e92] [cursor=pointer]:
              - /url: /scan
            - link "Sécurité du compte" [ref=f2e100] [cursor=pointer]:
              - /url: /admin/securite
        - link "Retour au site" [ref=f2e106] [cursor=pointer]:
          - /url: /
      - generic [ref=f2e111]:
        - link "Elhadji SuperAdmin Super-administrateur" [ref=f2e112] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=f2e113]: ES
          - generic [ref=f2e114]:
            - generic [ref=f2e115]: Elhadji SuperAdmin
            - generic [ref=f2e116]: Super-administrateur
        - generic [ref=f2e117]:
          - button "Se déconnecter" [ref=f2e118] [cursor=pointer]
          - button "Basculer le thème" [ref=f2e123] [cursor=pointer]
    - generic [ref=f2e127]:
      - banner [ref=f2e128]:
        - link "Rechercher un événement…" [ref=f2e130] [cursor=pointer]:
          - /url: /explore
        - button "Notifications" [ref=f2e137] [cursor=pointer]
      - main [ref=f2e141]:
        - generic [ref=f2e143]:
          - generic [ref=f2e145]:
            - generic [ref=f2e146]:
              - heading "Tableau de bord" [level=1] [ref=f2e147]
              - paragraph [ref=f2e148]: Dossiers à traiter et vue d’ensemble de la plateforme.
            - generic [ref=f2e149]:
              - status [ref=f2e150]: Mise à jour en cours
              - button "Actualiser" [ref=f2e152] [cursor=pointer]
          - region [ref=f2e160]:
            - heading "À faire aujourd’hui" [level=2] [ref=f2e161]
            - alert [ref=f2e162]:
              - paragraph [ref=f2e163]: Liste indisponible pour le moment. Les files restent ouvertes depuis le menu.
              - button "Réessayer" [ref=f2e164] [cursor=pointer]
          - region [ref=f2e167]:
            - heading "Argent qui attend" [level=2] [ref=f2e168]
            - alert [ref=f2e169]:
              - paragraph [ref=f2e170]: "Compteurs indisponibles pour le moment : ouvrez la page Finance pour voir les listes."
              - button "Réessayer" [ref=f2e171] [cursor=pointer]
          - region [ref=f2e173]:
            - heading "Indicateurs" [level=2] [ref=f2e174]
            - alert [ref=f2e175]:
              - heading "Indicateurs indisponibles" [level=3] [ref=f2e179]
              - paragraph [ref=f2e180]: Impossible de charger les indicateurs de la plateforme pour le moment. Réessayez dans un instant.
              - button "Réessayer" [ref=f2e181] [cursor=pointer]
          - region [ref=f2e189]:
            - generic [ref=f2e190]:
              - heading "Candidatures des partenaires" [level=2] [ref=f2e191]
              - paragraph [ref=f2e192]: Validez ou refusez les organisateurs, restaurants et gestionnaires de salles après examen de leur dossier.
            - tablist "Statut des candidatures" [ref=f2e194]:
              - tab "En attente" [selected] [ref=f2e195] [cursor=pointer]
              - tab "Validés" [ref=f2e197] [cursor=pointer]
              - tab "Refusés" [ref=f2e199] [cursor=pointer]
              - tab "Tous" [ref=f2e201] [cursor=pointer]
            - tabpanel "En attente" [ref=f2e203]:
              - alert [ref=f2e204]:
                - heading "Candidatures indisponibles" [level=3] [ref=f2e208]
                - paragraph [ref=f2e209]: Votre compte n’a pas l’autorisation de consulter les partenaires.
                - button "Réessayer" [ref=f2e210] [cursor=pointer]
          - region [ref=f2e218]:
            - heading "Raccourcis" [level=2] [ref=f2e219]
            - generic [ref=f2e220]:
              - link "Parrainage et ambassadeurs" [ref=f2e221] [cursor=pointer]:
                - /url: /admin/referral
              - link "Journal d’audit" [ref=f2e227] [cursor=pointer]:
                - /url: /admin/audit
              - link "Catalogues et services" [ref=f2e232] [cursor=pointer]:
                - /url: /admin/services
  - alert [ref=f2e239]
  - alertdialog [ref=f2e242]:
    - generic [ref=f2e243]:
      - generic [ref=f2e249]:
        - heading "Code administrateur" [level=2] [ref=f2e250]
        - paragraph [ref=f2e251]: "Première ouverture de l’administration sur cet appareil : un code vous est envoyé par SMS."
      - button "Fermer" [ref=f2e252] [cursor=pointer]
    - generic [ref=f2e258]:
      - generic [ref=f2e259]:
        - paragraph [ref=f2e260]: Le code part par SMS au 70 ••• •• 07. Ne le donnez à personne.
        - button "Recevoir le code par SMS" [active] [ref=f2e261] [cursor=pointer]
      - button "J’ai perdu mon téléphone" [ref=f2e266] [cursor=pointer]
      - button "Se déconnecter" [ref=f2e271] [cursor=pointer]
```

# Test source

```ts
  1  | /**
  2  |  * Lot 5.1 — connexion par le formulaire, une fois par rôle, puis état de connexion enregistré dans
  3  |  * .auth/<rôle>.json (cookies @supabase/ssr sur l'hôte localhost, celui des redirections du middleware). Chaque rôle est un test distinct : un
  4  |  * rôle de démonstration qui échoue (seed:demo absent) n'empêche pas ceux du seed de test.
  5  |  *
  6  |  * Sélecteurs : libellé lié au champ d'abord (getByLabel). Tant que le formulaire de connexion n'a
  7  |  * pas de libellés liés (htmlFor/id, défaut d'accessibilité relevé par la découverte 5.1), le test
  8  |  * se replie sur le texte indicatif et l'écrit dans le journal et les annotations : ce repli est
  9  |  * visible, jamais silencieux.
  10 |  */
  11 | import fs from 'node:fs';
  12 | import { test as setup, expect, type Locator, type Page, type TestInfo } from '@playwright/test';
  13 | import { AUTH_DIR, ROLES, storageStatePath, TEST_PASSWORD } from './support/accounts';
  14 | import { prepareContext } from './support/fixtures';
  15 | import { fakeSmsTo } from './support/parcours';
  16 | import { serviceClient, userIdByEmail } from './support/service';
  17 | 
  18 | /**
  19 |  * Lot 9 quinquies (A3 : AUTH-05) : un compte ADMIN ou SUPERADMIN ouvre l'administration sur un nouvel appareil avec le
  20 |  * code administrateur reçu par SMS. Le code est lu dans le faux MTarget (GET /__test/sms), saisi dans la fenêtre ; le
  21 |  * cookie d'appareil (httpOnly) est ensuite enregistré avec l'état de connexion du rôle (valable 12 h).
  22 |  */
  23 | async function passAdminCode(page: Page, email: string): Promise<void> {
  24 |     const dialog = page.getByRole('alertdialog', { name: /code administrateur/i });
  25 |     await expect(dialog, 'fenêtre du code administrateur').toBeVisible({ timeout: 15_000 });
  26 |     const userId = await userIdByEmail(email);
  27 |     const { data, error } = await serviceClient().from('users').select('phone').eq('id', userId).single();
  28 |     if (error || !data?.phone) throw new Error(`[e2e] numéro du compte admin ${email} illisible : ${error?.message ?? 'absent'}`);
  29 |     const phone = String(data.phone);
  30 |     const before = new Set((await fakeSmsTo(phone)).map((m) => m.ticket));
  31 |     await dialog.getByRole('button', { name: /recevoir le code par sms/i }).click();
  32 |     let code: string | null = null;
  33 |     await expect.poll(async () => {
  34 |         const fresh = (await fakeSmsTo(phone)).filter((m) => !before.has(m.ticket));
  35 |         code = fresh.map((m) => /code administrateur (\d{6})/.exec(m.message)?.[1]).find((c): c is string => Boolean(c)) ?? null;
  36 |         return code;
  37 |     }, { message: 'SMS du code administrateur reçu par le faux MTarget', timeout: 15_000 }).not.toBeNull();
> 38 |     await dialog.getByRole('textbox', { name: /chiffre 1 sur 6/i }).click();
     |                                                                     ^ TimeoutError: locator.click: Timeout 15000ms exceeded.
  39 |     await page.keyboard.type(String(code));
  40 |     await dialog.getByRole('button', { name: /valider le code/i }).click();
  41 |     await expect(dialog, 'fenêtre fermée après le code').toBeHidden({ timeout: 15_000 });
  42 | }
  43 | 
  44 | async function field(page: Page, testInfo: TestInfo, label: RegExp, fallback: Locator, nom: string): Promise<Locator> {
  45 |     const byLabel = page.getByLabel(label);
  46 |     if ((await byLabel.count()) > 0) return byLabel.first();
  47 |     const message = `champ « ${nom} » sans libellé lié (htmlFor/id) : sélection par repli (${fallback.toString()})`;
  48 |     console.warn(`[e2e][accessibilité] ${message}`);
  49 |     testInfo.annotations.push({ type: 'accessibilité', description: message });
  50 |     return fallback;
  51 | }
  52 | 
  53 | for (const role of ROLES) {
  54 |     setup(`connexion : ${role.libelle}`, async ({ page, context }, testInfo) => {
  55 |         await prepareContext(context, 'clair');
  56 |         const email = role.email();
  57 |         await page.goto('/login');
  58 |         const identifiant = await field(page, testInfo, /e-?mail ou t[ée]l[ée]phone/i, page.getByPlaceholder(/client@email\.com/i), 'Email ou Téléphone');
  59 |         const motDePasse = await field(page, testInfo, /^mot de passe$/i, page.locator('input[autocomplete="current-password"]'), 'Mot de passe');
  60 |         await identifiant.fill(email);
  61 |         await motDePasse.fill(TEST_PASSWORD);
  62 |         await page.getByRole('button', { name: /^se connecter$/i }).click();
  63 |         await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 });
  64 |         await expect.poll(() => new URL(page.url()).pathname, { message: `page d'arrivée de ${role.libelle}`, timeout: 15_000 }).toMatch(role.arrivee);
  65 |         if (role.arrivee.test('/admin')) await passAdminCode(page, email);
  66 |         fs.mkdirSync(AUTH_DIR, { recursive: true });
  67 |         await context.storageState({ path: storageStatePath(role.key) });
  68 |     });
  69 | }
  70 | 
```