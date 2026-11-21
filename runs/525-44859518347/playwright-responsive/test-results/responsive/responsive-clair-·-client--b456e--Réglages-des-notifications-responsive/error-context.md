# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> clair · client >> profil-notifications — Réglages des notifications
- Location: e2e/responsive.spec.ts:76:21

# Error details

```
Error: contrôles responsive de profil-notifications (clair)

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "1024 px : défilement horizontal (largeur du document 1030 px, fenêtre 1024 px)",
+ ]
```

# Page snapshot

```yaml
- generic [active] [ref=f5e1]:
  - generic [ref=f5e3]:
    - banner [ref=f5e4]:
      - generic [ref=f5e5]:
        - link "Event Village, accueil" [ref=f5e7] [cursor=pointer]:
          - /url: /
          - generic [ref=f5e8]: Event Village
        - navigation "Rubriques" [ref=f5e13]:
          - link "Accueil" [ref=f5e14] [cursor=pointer]:
            - /url: /
          - link "Explorer" [ref=f5e15] [cursor=pointer]:
            - /url: /explore
          - link "Mes billets" [ref=f5e16] [cursor=pointer]:
            - /url: /tickets
          - link "Portefeuille" [ref=f5e17] [cursor=pointer]:
            - /url: /wallet
      - link "Rechercher un événement…" [ref=f5e19] [cursor=pointer]:
        - /url: /explore
      - generic [ref=f5e24]:
        - button "Notifications, 10 non lues" [ref=f5e26] [cursor=pointer]:
          - generic [ref=f5e30]: "10"
        - button "Fatou Mbaye" [ref=f5e32] [cursor=pointer]:
          - generic [aria-hidden] [ref=f5e33]: FM
    - main [ref=f5e37]:
      - generic [ref=f5e39]:
        - generic [ref=f5e40]:
          - link "Mon profil" [ref=f5e42] [cursor=pointer]:
            - /url: /profile
          - generic [ref=f5e48]:
            - heading "Préférences de notification" [level=1] [ref=f5e49]
            - paragraph [ref=f5e50]: Choisissez comment Event Village vous prévient. Les messages indispensables partent toujours.
        - region [ref=f5e51]:
          - heading "Sur cet appareil" [level=2] [ref=f5e52]
          - status [ref=f5e55]:
            - generic [ref=f5e61]:
              - paragraph [ref=f5e62]: Refusées dans le navigateur
              - paragraph [ref=f5e63]: Vous avez bloqué les notifications pour Event Village. Pour les réactiver, ouvrez les réglages du site dans votre navigateur (icône à gauche de l’adresse), autorisez les notifications, puis revenez sur cette page.
        - region [ref=f5e64]:
          - generic [ref=f5e65]:
            - heading "Vous choisissez" [level=2] [ref=f5e66]
            - paragraph [ref=f5e67]: Pour chaque sujet, activez ou coupez un canal. Un canal coupé n’envoie plus rien sur ce sujet ; vous gardez les autres.
          - status [ref=f5e68]:
            - generic [ref=f5e73]:
              - paragraph [ref=f5e74]: Emails non disponibles
              - generic [ref=f5e75]: Ajoutez et vérifiez une adresse email dans votre profil pour recevoir ces emails.
            - link "Ouvrir mon profil" [ref=f5e77] [cursor=pointer]:
              - /url: /profile
          - region [ref=f5e79]:
            - generic [ref=f5e86]:
              - heading "Rappels avant l’événement" [level=3] [ref=f5e87]
              - paragraph [ref=f5e88]: La veille et quelques heures avant le début d’un événement dont vous avez un billet (et, pour un contrôleur, la veille de chaque affectation).
            - list [ref=f5e89]:
              - listitem [ref=f5e90]:
                - generic [ref=f5e92]:
                  - generic [ref=f5e93]: Application
                  - generic [ref=f5e95]:
                    - generic [aria-hidden] [ref=f5e96]: Activé
                    - switch "Application" [checked] [ref=f5e97] [cursor=pointer]
              - listitem [ref=f5e100]:
                - generic [ref=f5e102]:
                  - generic [ref=f5e103]: SMS
                  - generic [ref=f5e105]:
                    - generic [aria-hidden] [ref=f5e106]: Désactivé
                    - switch "SMS" [ref=f5e107] [cursor=pointer]
              - listitem [ref=f5e110]:
                - generic [ref=f5e112]:
                  - generic [ref=f5e113]:
                    - generic [ref=f5e114]: Email
                    - paragraph [ref=f5e115]: Adresse email non vérifiée
                  - generic [ref=f5e116]:
                    - generic [aria-hidden] [ref=f5e117]: Désactivé
                    - switch "Email" [disabled] [ref=f5e118]
              - listitem [ref=f5e121]:
                - generic [ref=f5e123]:
                  - generic [ref=f5e124]: Notifications push
                  - generic [ref=f5e126]:
                    - generic [aria-hidden] [ref=f5e127]: Activé
                    - switch "Notifications push" [checked] [ref=f5e128] [cursor=pointer]
          - region [ref=f5e131]:
            - generic [ref=f5e139]:
              - heading "Suspension et reprise d’un événement" [level=3] [ref=f5e140]
              - paragraph [ref=f5e141]: Suspension ou reprise d’un événement dont vous avez un billet.
            - list [ref=f5e142]:
              - listitem [ref=f5e143]:
                - generic [ref=f5e145]:
                  - generic [ref=f5e146]: Application
                  - generic [ref=f5e148]:
                    - generic [aria-hidden] [ref=f5e149]: Activé
                    - switch "Application" [checked] [ref=f5e150] [cursor=pointer]
              - listitem [ref=f5e153]:
                - generic [ref=f5e155]:
                  - generic [ref=f5e156]: SMS
                  - generic [ref=f5e158]:
                    - generic [aria-hidden] [ref=f5e159]: Activé
                    - switch "SMS" [checked] [ref=f5e160] [cursor=pointer]
              - listitem [ref=f5e163]:
                - generic [ref=f5e165]:
                  - generic [ref=f5e166]:
                    - generic [ref=f5e167]: Email
                    - paragraph [ref=f5e168]: Adresse email non vérifiée
                  - generic [ref=f5e169]:
                    - generic [aria-hidden] [ref=f5e170]: Désactivé
                    - switch "Email" [disabled] [ref=f5e171]
              - listitem [ref=f5e174]:
                - generic [ref=f5e176]:
                  - generic [ref=f5e177]: Notifications push
                  - generic [ref=f5e179]:
                    - generic [aria-hidden] [ref=f5e180]: Activé
                    - switch "Notifications push" [checked] [ref=f5e181] [cursor=pointer]
          - region [ref=f5e184]:
            - generic [ref=f5e192]:
              - heading "Après l’événement" [level=3] [ref=f5e193]
              - paragraph [ref=f5e194]: Le lendemain d’un événement où vous êtes entré, un message de remerciement avec le lien de l’événement.
            - list [ref=f5e195]:
              - listitem [ref=f5e196]:
                - generic [ref=f5e198]:
                  - generic [ref=f5e199]: Application
                  - generic [ref=f5e201]:
                    - generic [aria-hidden] [ref=f5e202]: Activé
                    - switch "Application" [checked] [ref=f5e203] [cursor=pointer]
              - listitem [ref=f5e206]:
                - generic [ref=f5e208]:
                  - generic [ref=f5e209]: SMS
                  - generic [ref=f5e211]:
                    - generic [aria-hidden] [ref=f5e212]: Activé
                    - switch "SMS" [checked] [ref=f5e213] [cursor=pointer]
              - listitem [ref=f5e216]:
                - generic [ref=f5e218]:
                  - generic [ref=f5e219]:
                    - generic [ref=f5e220]: Email
                    - paragraph [ref=f5e221]: Adresse email non vérifiée
                  - generic [ref=f5e222]:
                    - generic [aria-hidden] [ref=f5e223]: Désactivé
                    - switch "Email" [disabled] [ref=f5e224]
              - listitem [ref=f5e227]:
                - generic [ref=f5e229]:
                  - generic [ref=f5e230]: Notifications push
                  - generic [ref=f5e232]:
                    - generic [aria-hidden] [ref=f5e233]: Activé
                    - switch "Notifications push" [checked] [ref=f5e234] [cursor=pointer]
        - region [ref=f5e237]:
          - generic [ref=f5e243]:
            - heading "Toujours envoyées" [level=2] [ref=f5e244]
            - paragraph [ref=f5e245]: "Ces messages protègent votre compte, votre argent et vos billets : ils ne se désactivent pas."
          - list [ref=f5e246]:
            - listitem [ref=f5e247]: Codes de connexion
            - listitem [ref=f5e251]: Confirmations d’achat et reçus
            - listitem [ref=f5e255]: Billets transférés
            - listitem [ref=f5e259]: Annulations
            - listitem [ref=f5e263]: Remboursements
            - listitem [ref=f5e267]: Sécurité du compte
            - listitem [ref=f5e271]: Changements de date ou de lieu
  - alert [ref=f5e275]
```

# Test source

```ts
  20  | import path from 'node:path';
  21  | import type { Page } from '@playwright/test';
  22  | import { test, expect, type CaptureRole, type ThemeKey } from './support/fixtures';
  23  | import { readDemoIds, E2E_OUTPUT_DIR, type DemoIds } from './support/demo-ids';
  24  | import { fakeScanMode, installFakeCamera } from './support/fake-camera';
  25  | import { keepHomeOutOfHallsWindow } from './support/halls-switch';
  26  | import {
  27  |     PHONE_MAX_WIDTH, RESPONSIVE_CAPTURE_WIDTHS, RESPONSIVE_LANDSCAPE, RESPONSIVE_PAGES, RESPONSIVE_WIDTHS, type ResponsivePage,
  28  | } from './support/responsive-pages';
  29  | import { runResponsiveChecks } from './support/responsive-checks';
  30  | 
  31  | const RESULTS = path.join(E2E_OUTPUT_DIR, 'responsive');
  32  | const SHOTS = path.join(E2E_OUTPUT_DIR, 'captures-responsive');
  33  | 
  34  | const THEMES: ReadonlyArray<{ key: ThemeKey; colorScheme: 'light' | 'dark' }> = [
  35  |     { key: 'clair', colorScheme: 'light' },
  36  |     { key: 'sombre', colorScheme: 'dark' },
  37  | ];
  38  | 
  39  | interface Size { width: number; height: number; paysage?: boolean }
  40  | 
  41  | function sizesFor(p: ResponsivePage, theme: ThemeKey): Size[] {
  42  |     const base: Size[] = RESPONSIVE_WIDTHS
  43  |         .filter((w) => theme === 'clair' || RESPONSIVE_CAPTURE_WIDTHS.includes(w.width))
  44  |         .map((w) => ({ width: w.width, height: w.height }));
  45  |     const land: Size[] = p.paysage ? RESPONSIVE_LANDSCAPE.map((w) => ({ width: w.width, height: w.height, paysage: true })) : [];
  46  |     return [...base, ...land];
  47  | }
  48  | 
  49  | /** Page stable : polices chargées, réseau au repos (plafond 3 s, noté sinon), deux images d'affichage. */
  50  | async function settle(page: Page, notes: string[], at: string): Promise<void> {
  51  |     await page.evaluate(() => document.fonts.ready.then(() => true));
  52  |     await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => { notes.push(`${at} : réseau jamais au repos en 3 s (attente plafonnée)`); });
  53  |     await page.waitForFunction(() => Array.from(document.images).every((img) => img.complete), undefined, { timeout: 5_000 })
  54  |         .catch(() => { notes.push(`${at} : images encore en chargement après 5 s`); });
  55  |     await page.evaluate(() => new Promise<void>((resolve) => { requestAnimationFrame(() => requestAnimationFrame(() => resolve())); }));
  56  | }
  57  | 
  58  | interface ResponsiveRecord {
  59  |     page: string;
  60  |     titre: string;
  61  |     groupe: string;
  62  |     role: CaptureRole;
  63  |     theme: ThemeKey;
  64  |     url: string | null;
  65  |     sizes: Array<{ size: string; blocking: string[]; warnings: string[]; capture: string | null }>;
  66  |     notes: string[];
  67  |     error: string | null;
  68  | }
  69  | 
  70  | for (const theme of THEMES) {
  71  |     const roles = Array.from(new Set(RESPONSIVE_PAGES.map((p) => p.role)));
  72  |     for (const role of roles) {
  73  |         test.describe(`${theme.key} · ${role}`, () => {
  74  |             test.use({ colorScheme: theme.colorScheme, evTheme: theme.key, evRole: role });
  75  |             for (const p of RESPONSIVE_PAGES.filter((x) => x.role === role)) {
  76  |                 test(`${p.id} — ${p.titre}`, async ({ page, context, guard, hallsLock }) => {
  77  |                     test.setTimeout(240_000);
  78  |                     const record: ResponsiveRecord = { page: p.id, titre: p.titre, groupe: p.groupe, role, theme: theme.key, url: null, sizes: [], notes: [], error: null };
  79  |                     try {
  80  |                         // Lot 10b : verrou des salles avant tout chargement (attente ajoutée au délai du test)
  81  |                         await hallsLock.enter(p.salles ? 'salles' : 'autres');
  82  |                         if (hallsLock.waitedMs >= 1_000) record.notes.push(`attente du verrou des salles : ${Math.round(hallsLock.waitedMs / 1000)} s`);
  83  |                         if (p.salles) {
  84  |                             record.notes.push('page des salles : interrupteur features.halls_enabled ouvert le temps du test (e2e/support/halls-switch.ts)');
  85  |                             await keepHomeOutOfHallsWindow(page);
  86  |                         }
  87  |                         const demo: DemoIds | null = p.needsIds ? readDemoIds() : null;
  88  |                         record.url = p.path(demo);
  89  |                         guard.configure({ allowFailures: p.allowFailures ?? [], ignoreConsoleErrors: false });
  90  |                         if (p.fakeCamera) await context.addInitScript(installFakeCamera, { mode: fakeScanMode() });
  91  |                         for (const size of sizesFor(p, theme.key)) {
  92  |                             const at = size.paysage ? `${size.width}×${size.height} px (paysage)` : `${size.width} px`;
  93  |                             await page.setViewportSize({ width: size.width, height: size.height });
  94  |                             const response = await page.goto(record.url, { waitUntil: 'load' });
  95  |                             if (p.expectStatus !== undefined) expect(response?.status(), `statut HTTP de ${record.url}`).toBe(p.expectStatus);
  96  |                             if (p.ready) await p.ready(page);
  97  |                             else await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 30_000 });
  98  |                             if (p.actions) await p.actions(page);
  99  |                             await settle(page, record.notes, at);
  100 |                             const checks = await runResponsiveChecks(page, { width: size.width, phone: !size.paysage && size.width <= PHONE_MAX_WIDTH });
  101 |                             const blocking = checks.blocking.map((b) => (size.paysage ? b.replace(`${size.width} px`, at) : b));
  102 |                             let capture: string | null = null;
  103 |                             if (size.paysage || RESPONSIVE_CAPTURE_WIDTHS.includes(size.width)) {
  104 |                                 fs.mkdirSync(SHOTS, { recursive: true });
  105 |                                 capture = `${p.id}__${size.paysage ? `${size.width}x${size.height}` : size.width}__${theme.key}.jpg`;
  106 |                                 await page.screenshot({ path: path.join(SHOTS, capture), type: 'jpeg', quality: 80, animations: 'disabled', caret: 'hide', scale: 'css' });
  107 |                             }
  108 |                             record.sizes.push({ size: at, blocking, warnings: checks.warnings, capture });
  109 |                         }
  110 |                     } catch (err) {
  111 |                         record.error = err instanceof Error ? err.message.split('\n')[0] : String(err);
  112 |                         throw err;
  113 |                     } finally {
  114 |                         // Erreurs de la page (console, requêtes) : notées, déjà bloquantes dans les captures
  115 |                         record.notes.push(...guard.blockingIssues().map((i) => `erreur de la page : ${i}`));
  116 |                         fs.mkdirSync(RESULTS, { recursive: true });
  117 |                         fs.writeFileSync(path.join(RESULTS, `${p.id}__${theme.key}.json`), `${JSON.stringify(record, null, 1)}\n`, 'utf8');
  118 |                     }
  119 |                     const blocking = record.sizes.flatMap((s) => s.blocking);
> 120 |                     expect(blocking, `contrôles responsive de ${p.id} (${theme.key})`).toEqual([]);
      |                                                                                        ^ Error: contrôles responsive de profil-notifications (clair)
  121 |                 });
  122 |             }
  123 |         });
  124 |     }
  125 | }
  126 | 
```