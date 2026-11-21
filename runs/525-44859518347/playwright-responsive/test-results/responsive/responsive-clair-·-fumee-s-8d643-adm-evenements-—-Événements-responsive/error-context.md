# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> clair · fumee-superadmin >> adm-evenements — Événements
- Location: e2e/responsive.spec.ts:76:21

# Error details

```
Error: contrôles responsive de adm-evenements (clair)

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 4

- Array []
+ Array [
+   "1024 px : textes qui se chevauchent : span.min-w-0.break-words « À la une » sur span.block.break-words « Elhadji SuperAdmin » (42×10 px) ; span.flex.flex-shrink-0 « ES » sur p.mb-1.5.block « Système » (17×14 px) ; span.block.break-words « Super-administrateur » sur p.mb-1.5.block « Système » (23×14 px) ; span.block.break-words « Super-administrateur » sur span.min-w-0.break-words « Réglages » (13×16 px)",
+   "1440 px : textes qui se chevauchent : span.block.break-words « Elhadji SuperAdmin » sur span.min-w-0.break-words « Notifications » (77×16 px) ; span.block.break-words « Super-administrateur » sur span.min-w-0.break-words « Scanner » (47×10 px)",
+ ]
```

# Page snapshot

```yaml
- generic [active] [ref=f5e1]:
  - generic [ref=f5e2]:
    - complementary [ref=f5e4]:
      - generic [ref=f5e5]:
        - link "Event Village, accueil" [ref=f5e7] [cursor=pointer]:
          - /url: /
          - generic [ref=f5e8]: Event Village
        - button "Replier la barre latérale" [expanded] [ref=f5e11] [cursor=pointer]
      - navigation "Navigation principale" [ref=f5e16]:
        - generic [ref=f5e17]: Administration
        - link "Tableau de bord" [ref=f5e22] [cursor=pointer]:
          - /url: /admin/dashboard
        - generic [ref=f5e29]:
          - paragraph [ref=f5e30]: Gestion
          - generic [ref=f5e31]:
            - link "Événements" [ref=f5e32] [cursor=pointer]:
              - /url: /admin/events
            - link "Comptes" [ref=f5e36] [cursor=pointer]:
              - /url: /admin/users
            - link "Catalogues et services" [ref=f5e43] [cursor=pointer]:
              - /url: /admin/services
            - link "Salles à valider" [ref=f5e49] [cursor=pointer]:
              - /url: /admin/halls
        - generic [ref=f5e55]:
          - paragraph [ref=f5e56]: Finances
          - link "Finance" [ref=f5e58] [cursor=pointer]:
            - /url: /admin/finance
        - generic [ref=f5e62]:
          - paragraph [ref=f5e63]: Engagement
          - generic [ref=f5e64]:
            - link "Parrainage" [ref=f5e65] [cursor=pointer]:
              - /url: /admin/referral
            - link "Campagnes" [ref=f5e70] [cursor=pointer]:
              - /url: /admin/communications
            - link "À la une" [ref=f5e75] [cursor=pointer]:
              - /url: /admin/a-la-une
        - generic [ref=f5e79]:
          - paragraph [ref=f5e80]: Système
          - generic [ref=f5e81]:
            - link "Réglages" [ref=f5e82] [cursor=pointer]:
              - /url: /admin/finance-settings
            - link "Journal d’audit" [ref=f5e87] [cursor=pointer]:
              - /url: /admin/audit
            - link "Notifications" [ref=f5e92] [cursor=pointer]:
              - /url: /admin/notifications
            - link "Scanner" [ref=f5e99] [cursor=pointer]:
              - /url: /scan
            - link "Sécurité du compte" [ref=f5e107] [cursor=pointer]:
              - /url: /admin/securite
        - link "Retour au site" [ref=f5e113] [cursor=pointer]:
          - /url: /
      - generic [ref=f5e118]:
        - link "Elhadji SuperAdmin Super-administrateur" [ref=f5e119] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=f5e121]: ES
          - generic [ref=f5e122]:
            - generic [ref=f5e123]: Elhadji SuperAdmin
            - generic [ref=f5e124]: Super-administrateur
        - generic [ref=f5e125]:
          - button "Se déconnecter" [ref=f5e126] [cursor=pointer]
          - button "Basculer le thème" [ref=f5e131] [cursor=pointer]
    - generic [ref=f5e135]:
      - banner [ref=f5e136]:
        - link "Rechercher un événement…" [ref=f5e138] [cursor=pointer]:
          - /url: /explore
        - generic [ref=f5e143]:
          - button "Notifications, 61 non lues" [ref=f5e145] [cursor=pointer]:
            - generic [ref=f5e149]: "61"
          - button "Elhadji SuperAdmin" [ref=f5e151] [cursor=pointer]:
            - generic [aria-hidden] [ref=f5e152]: ES
      - main [ref=f5e156]:
        - generic [ref=f5e158]:
          - generic [ref=f5e160]:
            - generic [ref=f5e161]:
              - heading "Événements" [level=1] [ref=f5e162]
              - paragraph [ref=f5e163]: Examinez les soumissions des organisateurs, puis suivez chaque événement tout au long de son cycle de vie.
            - status [ref=f5e165]: En direct
          - search "Rechercher un événement" [ref=f5e167]:
            - generic [ref=f5e168]:
              - generic [ref=f5e169]: Rechercher par titre
              - searchbox "Rechercher par titre" [ref=f5e171]
          - tablist "Statut des événements" [ref=f5e174]:
            - tab "En attente de validation , 4" [selected] [ref=f5e175] [cursor=pointer]:
              - generic [ref=f5e176]: En attente de validation
              - generic [ref=f5e177]:
                - generic [ref=f5e178]: ","
                - text: "4"
            - tab "Publié , 12" [ref=f5e179] [cursor=pointer]:
              - generic [ref=f5e180]: Publié
              - generic [ref=f5e181]:
                - generic [ref=f5e182]: ","
                - text: "12"
            - tab "Validé , 2" [ref=f5e183] [cursor=pointer]:
              - generic [ref=f5e184]: Validé
              - generic [ref=f5e185]:
                - generic [ref=f5e186]: ","
                - text: "2"
            - tab "Suspendu , 1" [ref=f5e187] [cursor=pointer]:
              - generic [ref=f5e188]: Suspendu
              - generic [ref=f5e189]:
                - generic [ref=f5e190]: ","
                - text: "1"
            - tab "Brouillon , 3" [ref=f5e191] [cursor=pointer]:
              - generic [ref=f5e192]: Brouillon
              - generic [ref=f5e193]:
                - generic [ref=f5e194]: ","
                - text: "3"
            - tab "Terminé , 3" [ref=f5e195] [cursor=pointer]:
              - generic [ref=f5e196]: Terminé
              - generic [ref=f5e197]:
                - generic [ref=f5e198]: ","
                - text: "3"
            - tab "Annulé , 3" [ref=f5e199] [cursor=pointer]:
              - generic [ref=f5e200]: Annulé
              - generic [ref=f5e201]:
                - generic [ref=f5e202]: ","
                - text: "3"
            - tab "Tous" [ref=f5e203] [cursor=pointer]
          - tabpanel "En attente de validation , 4" [ref=f5e205]:
            - paragraph [ref=f5e206]: Soumis à l’équipe Event Village, qui vérifie la fiche avant validation.
            - 'region "Événements : En attente de validation" [ref=f5e208]':
              - table [ref=f5e209]:
                - caption [ref=f5e210]: "Événements : En attente de validation"
                - rowgroup [ref=f5e211]:
                  - row [ref=f5e212]:
                    - columnheader "Événement" [ref=f5e213]
                    - columnheader "Organisateur" [ref=f5e214]
                    - columnheader "Date" [ref=f5e215]
                    - columnheader "Statut" [ref=f5e216]
                    - columnheader "Soumis le" [ref=f5e217]
                    - columnheader "Action" [ref=f5e218]
                - rowgroup [ref=f5e219]:
                  - row [ref=f5e220]:
                    - cell "Matinée gospel et chorales Théâtre de verdure de Sicap, Dakar" [ref=f5e221]:
                      - generic [ref=f5e222]:
                        - link "Matinée gospel et chorales" [ref=f5e223] [cursor=pointer]:
                          - /url: /admin/events/01634504-7d97-4b25-b89f-1426ac76eebc
                        - generic [ref=f5e224]: Théâtre de verdure de Sicap, Dakar
                    - cell "Baobab Scène Productions" [ref=f5e225]
                    - cell "mar. 15 déc. 2026 à 10:00" [ref=f5e226]
                    - cell "En attente de validation" [ref=f5e227]:
                      - generic "Soumis à l’équipe Event Village, qui vérifie la fiche avant validation." [ref=f5e228]: En attente de validation
                    - cell [ref=f5e231]:
                      - time [ref=f5e232]: sam. 21 nov. 2026 à 03:10
                    - cell [ref=f5e233]:
                      - link "Examiner" [ref=f5e234] [cursor=pointer]:
                        - /url: /admin/events/01634504-7d97-4b25-b89f-1426ac76eebc
                  - row [ref=f5e236]:
                    - cell "Exposition-vente de l’artisanat de Thiès Halle du Marché Moderne, Thiès" [ref=f5e237]:
                      - generic [ref=f5e238]:
                        - link "Exposition-vente de l’artisanat de Thiès" [ref=f5e239] [cursor=pointer]:
                          - /url: /admin/events/3a0847f6-824e-4bf6-9089-fea9c0514026
                        - generic [ref=f5e240]: Halle du Marché Moderne, Thiès
                    - cell "Atelier Petite-Côte" [ref=f5e241]
                    - cell "jeu. 10 déc. 2026 à 09:00" [ref=f5e242]
                    - cell "En attente de validation" [ref=f5e243]:
                      - generic "Soumis à l’équipe Event Village, qui vérifie la fiche avant validation." [ref=f5e244]: En attente de validation
                    - cell [ref=f5e247]:
                      - time [ref=f5e248]: sam. 21 nov. 2026 à 03:10
                    - cell [ref=f5e249]:
                      - link "Examiner" [ref=f5e250] [cursor=pointer]:
                        - /url: /admin/events/3a0847f6-824e-4bf6-9089-fea9c0514026
                  - row [ref=f5e252]:
                    - cell "Atelier cuisine du thiéboudienne Maison des Saveurs, Kaolack" [ref=f5e253]:
                      - generic [ref=f5e254]:
                        - link "Atelier cuisine du thiéboudienne" [ref=f5e255] [cursor=pointer]:
                          - /url: /admin/events/d0710a40-4cbd-4d09-8fe0-5cdbcfe33609
                        - generic [ref=f5e256]: Maison des Saveurs, Kaolack
                    - cell "Sine-Saloum Culture & Loisirs" [ref=f5e257]
                    - cell "lun. 7 déc. 2026 à 10:00" [ref=f5e258]
                    - cell "En attente de validation" [ref=f5e259]:
                      - generic "Soumis à l’équipe Event Village, qui vérifie la fiche avant validation." [ref=f5e260]: En attente de validation
                    - cell [ref=f5e263]:
                      - time [ref=f5e264]: sam. 21 nov. 2026 à 03:10
                    - cell [ref=f5e265]:
                      - link "Examiner" [ref=f5e266] [cursor=pointer]:
                        - /url: /admin/events/d0710a40-4cbd-4d09-8fe0-5cdbcfe33609
                  - row [ref=f5e268]:
                    - cell "Festival des musiques du Saloum Parc de la Promenade, Kaolack" [ref=f5e269]:
                      - generic [ref=f5e270]:
                        - link "Festival des musiques du Saloum" [ref=f5e271] [cursor=pointer]:
                          - /url: /admin/events/45ef7659-a648-45e8-9dc9-8da722f7de7b
                        - generic [ref=f5e272]: Parc de la Promenade, Kaolack
                    - cell "Sine-Saloum Culture & Loisirs" [ref=f5e273]
                    - cell "jeu. 24 déc. 2026 à 17:00" [ref=f5e274]
                    - cell "En attente de validation" [ref=f5e275]:
                      - generic "Soumis à l’équipe Event Village, qui vérifie la fiche avant validation." [ref=f5e276]: En attente de validation
                    - cell [ref=f5e279]:
                      - time [ref=f5e280]: sam. 21 nov. 2026 à 03:10
                    - cell [ref=f5e281]:
                      - link "Examiner" [ref=f5e282] [cursor=pointer]:
                        - /url: /admin/events/45ef7659-a648-45e8-9dc9-8da722f7de7b
  - alert [ref=f5e284]
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
      |                                                                                        ^ Error: contrôles responsive de adm-evenements (clair)
  121 |                 });
  122 |             }
  123 |         });
  124 |     }
  125 | }
  126 | 
```