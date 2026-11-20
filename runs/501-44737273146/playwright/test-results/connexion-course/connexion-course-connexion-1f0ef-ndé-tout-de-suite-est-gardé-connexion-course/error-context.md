# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: connexion-course.spec.ts >> connexion d’un administrateur : la page de l’espace n’est jamais rechargée après l’arrivée ; le code demandé tout de suite est gardé
- Location: e2e/connexion-course.spec.ts:48:5

# Error details

```
Error: après /login, un seul changement d'adresse, par un chargement de document (journal : document /login → soft /admin/dashboard → document /admin → document /admin/dashboard)

expect(received).toEqual(expected) // deep equality

- Expected  - 0
+ Received  + 2

  Array [
+   "soft /admin/dashboard",
+   "document /admin",
    "document /admin/dashboard",
  ]
```

# Test source

```ts
  1  | /**
  2  |  * Stabilité — connexion d'un administrateur : aucun rechargement de page après l'arrivée (mini-lot stabilite/connexion).
  3  |  *
  4  |  * Course vue aux runs 474 et 476 (connexion du super-administrateur dans e2e/auth.setup.ts) : après « Se connecter »,
  5  |  * components/auth/LoginForm.tsx appelait router.refresh() — sur /login d'un compte connecté, middleware.ts répond par une
  6  |  * redirection vers l'espace du compte, suivie SANS recharger la page — puis rechargeait toute la page 400 ms plus tard
  7  |  * (window.location.href). La fenêtre « Code administrateur » paraissait sur la première page ; un clic sur « Recevoir le code
  8  |  * par SMS » tombé avant le rechargement était perdu (aucun SMS, run 474) ou défait (SMS parti, fenêtre revenue à « Recevoir le
  9  |  * code par SMS », run 476).
  10 |  *
  11 |  * Test : compte ADMIN du seed de test (aucune autre phase ne l'ouvre), contexte neuf (appareil inconnu : la fenêtre du code
  12 |  * s'ouvre), connexion par le formulaire. Un script posé avant chaque document journalise dans sessionStorage chaque
  13 |  * chargement de document et chaque changement d'adresse sans rechargement (history.pushState / replaceState). Clic sur
  14 |  * « Recevoir le code par SMS » dès que la fenêtre paraît.
  15 |  *  1. Après le départ de /login, l'adresse ne change qu'une fois, par un chargement de document : aucune page de l'espace
  16 |  *     n'est affichée puis rechargée.
  17 |  *  2. La fenêtre passe à la saisie du code et y reste (case « chiffre 1 sur 6 » encore là 3 s plus tard) ; un seul SMS de code.
  18 |  */
  19 | import { expect, test } from '@playwright/test';
  20 | import { FIXTURE_USERS, TEST_PASSWORD } from '../tests/helpers/fixture-data';
  21 | import { openAnonymousContext } from './support/fixtures';
  22 | import { fakeSmsTo } from './support/parcours';
  23 | 
  24 | const LOG_KEY = '__ev_navigations';
  25 | 
  26 | /** Avant chaque document : journal des chargements et des changements d'adresse sans rechargement (sessionStorage). */
  27 | function installNavigationLog(key: string): void {
  28 |     const push = (kind: string, url: string): void => {
  29 |         try {
  30 |             const list = JSON.parse(sessionStorage.getItem(key) ?? '[]') as string[];
  31 |             list.push(`${kind} ${new URL(url, location.href).pathname}`);
  32 |             sessionStorage.setItem(key, JSON.stringify(list));
  33 |         } catch {
  34 |             // Stockage indisponible : le test le verra (journal vide)
  35 |         }
  36 |     };
  37 |     push('document', location.href);
  38 |     for (const method of ['pushState', 'replaceState'] as const) {
  39 |         const original = history[method].bind(history);
  40 |         history[method] = (data: unknown, unused: string, url?: string | URL | null) => {
  41 |             const before = location.pathname;
  42 |             original(data, unused, url);
  43 |             if (location.pathname !== before) push('soft', location.href);
  44 |         };
  45 |     }
  46 | }
  47 | 
  48 | test('connexion d’un administrateur : la page de l’espace n’est jamais rechargée après l’arrivée ; le code demandé tout de suite est gardé', async ({ browser }, testInfo) => {
  49 |     const admin = FIXTURE_USERS.ADMIN;
  50 |     const context = await openAnonymousContext(browser, testInfo);
  51 |     await context.addInitScript(installNavigationLog, LOG_KEY);
  52 |     const page = await context.newPage();
  53 |     try {
  54 |         await page.goto('/login');
  55 |         await page.getByLabel(/e-?mail ou t[ée]l[ée]phone/i).first().fill(admin.email);
  56 |         await page.getByLabel(/^mot de passe/i).first().fill(TEST_PASSWORD);
  57 |         const before = new Set((await fakeSmsTo(admin.phone)).map((m) => m.ticket));
  58 |         await page.getByRole('button', { name: /^se connecter$/i }).click();
  59 | 
  60 |         // Clic dès que la fenêtre paraît, comme un utilisateur rapide (ou e2e/auth.setup.ts)
  61 |         const dialog = page.getByRole('alertdialog', { name: /code administrateur/i });
  62 |         await expect(dialog, 'fenêtre du code administrateur').toBeVisible({ timeout: 30_000 });
  63 |         await dialog.getByRole('button', { name: /recevoir le code par sms/i }).click();
  64 | 
  65 |         const codeBox = page.getByRole('alertdialog', { name: /code administrateur/i }).getByRole('textbox', { name: /chiffre 1 sur 6/i });
  66 |         await expect(codeBox, 'saisie du code affichée après « Recevoir le code par SMS »').toBeVisible({ timeout: 15_000 });
  67 |         await page.waitForTimeout(3_000);
  68 |         await expect(codeBox, 'saisie du code toujours affichée 3 s plus tard (aucun rechargement ne l’a défaite)').toBeVisible();
  69 | 
  70 |         const log = await page.evaluate((key) => JSON.parse(sessionStorage.getItem(key) ?? '[]') as string[], LOG_KEY);
  71 |         console.log(`[CONNEXION-COURSE] journal des adresses : ${log.join(' → ')}`);
  72 |         const afterLogin = log.slice(log.findIndex((e) => !e.endsWith(' /login')));
  73 |         expect(log.some((e) => !e.endsWith(' /login')), `l'adresse a quitté /login (journal : ${log.join(' → ')})`).toBe(true);
  74 |         expect(afterLogin, `après /login, un seul changement d'adresse, par un chargement de document (journal : ${log.join(' → ')})`)
> 75 |             .toEqual([`document /admin/dashboard`]);
     |              ^ Error: après /login, un seul changement d'adresse, par un chargement de document (journal : document /login → soft /admin/dashboard → document /admin → document /admin/dashboard)
  76 | 
  77 |         const codes = (await fakeSmsTo(admin.phone)).filter((m) => !before.has(m.ticket) && /code administrateur \d{6}/.test(m.message));
  78 |         expect(codes.length, 'un seul SMS de code administrateur').toBe(1);
  79 |     } finally {
  80 |         await context.close();
  81 |     }
  82 | });
  83 | 
```