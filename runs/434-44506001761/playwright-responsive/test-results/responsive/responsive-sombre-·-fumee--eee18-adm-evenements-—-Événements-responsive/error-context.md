# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> sombre · fumee-superadmin >> adm-evenements — Événements
- Location: e2e/responsive.spec.ts:69:21

# Error details

```
Error: contrôles responsive de adm-evenements (sombre)

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 6

- Array []
+ Array [
+   "768 px : texte hors de l’écran : th.px-4.py-3 « Action » de 932 à 976 px (fenêtre 768 px) ; time.whitespace-nowrap.text-sm « jeu. 19 nov. 2026 à 10:34 » de 693 à 853 px (fenêtre 768 px) ; span.min-w-0 « Examiner » de 900 à 961 px (fenêtre 768 px) ; time.whitespace-nowrap.text-sm « jeu. 19 nov. 2026 à 10:34 » de 693 à 853 px (fenêtre 768 px) ; span.min-w-0 « Examiner » de 900 à 961 px (fenêtre 768 px) ; time.whitespace-nowrap.text-sm « jeu. 19 nov. 2026 à 10:34 » de 693 à 853 px (fenêtre 768 px) ; span.min-w-0 « Examiner » de 900 à 961 px (fenêtre 768 px) ; time.whitespace-nowrap.text-sm « jeu. 19 nov. 2026 à 10:34 » de 693 à 853 px (fenêtre 768 px) ; span.min-w-0 « Examiner » de 900 à 961 px (fenêtre 768 px)",
+   "768 px : texte coupé : th.px-4.py-3 « Soumis le » dépasse de div.hidden.overflow-hidden «  » ; th.px-4.py-3 « Action » dépasse de div.hidden.overflow-hidden «  » ; time.whitespace-nowrap.text-sm « jeu. 19 nov. 2026 à 10:34 » dépasse de div.hidden.overflow-hidden «  » ; span.min-w-0 « Examiner » dépasse de div.hidden.overflow-hidden «  » ; time.whitespace-nowrap.text-sm « jeu. 19 nov. 2026 à 10:34 » dépasse de div.hidden.overflow-hidden «  » ; span.min-w-0 « Examiner » dépasse de div.hidden.overflow-hidden «  » ; time.whitespace-nowrap.text-sm « jeu. 19 nov. 2026 à 10:34 » dépasse de div.hidden.overflow-hidden «  » ; span.min-w-0 « Examiner » dépasse de div.hidden.overflow-hidden «  » ; time.whitespace-nowrap.text-sm « jeu. 19 nov. 2026 à 10:34 » dépasse de div.hidden.overflow-hidden «  » ; span.min-w-0 « Examiner » dépasse de div.hidden.overflow-hidden «  »",
+   "768 px : textes qui se chevauchent : span.hidden.whitespace-nowrap « Event Village » sur span.truncate « Rechercher un événement, un concert, un restaurant » (46×18 px)",
+   "1440 px : texte tronqué sans le texte entier : span.block.truncate « Elhadji SuperAdmin » (points de suspension, texte entier absent)",
+ ]
```

# Page snapshot

```yaml
- generic [active] [ref=f2e1]:
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
        - generic [ref=f2e42]:
          - paragraph [ref=f2e43]: Finances
          - link "Finance" [ref=f2e45] [cursor=pointer]:
            - /url: /admin/finance
        - generic [ref=f2e49]:
          - paragraph [ref=f2e50]: Engagement
          - generic [ref=f2e51]:
            - link "Parrainage" [ref=f2e52] [cursor=pointer]:
              - /url: /admin/referral
            - link "Campagnes" [ref=f2e57] [cursor=pointer]:
              - /url: /admin/communications
            - link "À la une" [ref=f2e62] [cursor=pointer]:
              - /url: /admin/a-la-une
        - generic [ref=f2e66]:
          - paragraph [ref=f2e67]: Système
          - generic [ref=f2e68]:
            - link "Réglages" [ref=f2e69] [cursor=pointer]:
              - /url: /admin/finance-settings
            - link "Journal d’audit" [ref=f2e74] [cursor=pointer]:
              - /url: /admin/audit
            - link "Notifications" [ref=f2e79] [cursor=pointer]:
              - /url: /admin/notifications
            - link "Scanner" [ref=f2e86] [cursor=pointer]:
              - /url: /scan
            - link "Sécurité du compte" [ref=f2e94] [cursor=pointer]:
              - /url: /admin/securite
        - link "Retour au site" [ref=f2e100] [cursor=pointer]:
          - /url: /
      - generic [ref=f2e105]:
        - link "Elhadji SuperAdmin Superadmin" [ref=f2e106] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=f2e107]: ES
          - generic [ref=f2e108]:
            - generic [ref=f2e109]: Elhadji SuperAdmin
            - generic [ref=f2e110]: Superadmin
        - generic [ref=f2e111]:
          - button "Se déconnecter" [ref=f2e112] [cursor=pointer]
          - button "Basculer le thème" [ref=f2e117] [cursor=pointer]
    - generic [ref=f2e121]:
      - banner [ref=f2e122]:
        - link "Rechercher un événement, un concert, un restaurant…" [ref=f2e124] [cursor=pointer]:
          - /url: /explore
        - button "Notifications, 58 non lues" [ref=f2e131] [cursor=pointer]:
          - generic [ref=f2e135]: "58"
      - main [ref=f2e136]:
        - generic [ref=f2e138]:
          - generic [ref=f2e140]:
            - generic [ref=f2e141]:
              - heading "Événements" [level=1] [ref=f2e142]
              - paragraph [ref=f2e143]: Examinez les soumissions des organisateurs, puis suivez chaque événement tout au long de son cycle de vie.
            - status [ref=f2e145]: En direct
          - search "Rechercher un événement" [ref=f2e147]:
            - generic [ref=f2e148]:
              - generic [ref=f2e149]: Rechercher par titre
              - searchbox "Rechercher par titre" [ref=f2e151]
          - tablist "Statut des événements" [ref=f2e154]:
            - tab "En attente de validation , 4" [selected] [ref=f2e155] [cursor=pointer]:
              - generic [ref=f2e156]: En attente de validation
              - generic [ref=f2e157]:
                - generic [ref=f2e158]: ","
                - text: "4"
            - tab "Publié , 12" [ref=f2e159] [cursor=pointer]:
              - generic [ref=f2e160]: Publié
              - generic [ref=f2e161]:
                - generic [ref=f2e162]: ","
                - text: "12"
            - tab "Validé , 2" [ref=f2e163] [cursor=pointer]:
              - generic [ref=f2e164]: Validé
              - generic [ref=f2e165]:
                - generic [ref=f2e166]: ","
                - text: "2"
            - tab "Suspendu , 1" [ref=f2e167] [cursor=pointer]:
              - generic [ref=f2e168]: Suspendu
              - generic [ref=f2e169]:
                - generic [ref=f2e170]: ","
                - text: "1"
            - tab "Brouillon , 3" [ref=f2e171] [cursor=pointer]:
              - generic [ref=f2e172]: Brouillon
              - generic [ref=f2e173]:
                - generic [ref=f2e174]: ","
                - text: "3"
            - tab "Terminé , 3" [ref=f2e175] [cursor=pointer]:
              - generic [ref=f2e176]: Terminé
              - generic [ref=f2e177]:
                - generic [ref=f2e178]: ","
                - text: "3"
            - tab "Annulé , 3" [ref=f2e179] [cursor=pointer]:
              - generic [ref=f2e180]: Annulé
              - generic [ref=f2e181]:
                - generic [ref=f2e182]: ","
                - text: "3"
            - tab "Tous" [ref=f2e183] [cursor=pointer]
          - tabpanel "En attente de validation , 4" [ref=f2e185]:
            - paragraph [ref=f2e186]: Soumis à l’équipe Event Village, qui vérifie la fiche avant validation.
            - table [ref=f2e189]:
              - caption [ref=f2e190]: "Événements : En attente de validation"
              - rowgroup [ref=f2e191]:
                - row [ref=f2e192]:
                  - columnheader "Événement" [ref=f2e193]
                  - columnheader "Organisateur" [ref=f2e194]
                  - columnheader "Date" [ref=f2e195]
                  - columnheader "Statut" [ref=f2e196]
                  - columnheader "Soumis le" [ref=f2e197]
                  - columnheader "Action" [ref=f2e198]
              - rowgroup [ref=f2e199]:
                - row [ref=f2e200]:
                  - cell "Matinée gospel et chorales Théâtre de verdure de Sicap, Dakar" [ref=f2e201]:
                    - generic [ref=f2e202]:
                      - link "Matinée gospel et chorales" [ref=f2e203] [cursor=pointer]:
                        - /url: /admin/events/87f4b519-fd35-4816-aec6-ad56b6fc9e5c
                      - generic [ref=f2e204]: Théâtre de verdure de Sicap, Dakar
                  - cell "Baobab Scène Productions" [ref=f2e205]
                  - cell "dim. 13 déc. 2026 à 10:00" [ref=f2e206]
                  - cell "En attente de validation" [ref=f2e207]:
                    - generic "Soumis à l’équipe Event Village, qui vérifie la fiche avant validation." [ref=f2e208]: En attente de validation
                  - cell [ref=f2e211]:
                    - time [ref=f2e212]: jeu. 19 nov. 2026 à 10:34
                  - cell [ref=f2e213]:
                    - link "Examiner" [ref=f2e214] [cursor=pointer]:
                      - /url: /admin/events/87f4b519-fd35-4816-aec6-ad56b6fc9e5c
                - row [ref=f2e216]:
                  - cell "Exposition-vente de l’artisanat de Thiès Halle du Marché Moderne, Thiès" [ref=f2e217]:
                    - generic [ref=f2e218]:
                      - link "Exposition-vente de l’artisanat de Thiès" [ref=f2e219] [cursor=pointer]:
                        - /url: /admin/events/612dc110-b25b-4727-ad58-a9d766dde688
                      - generic [ref=f2e220]: Halle du Marché Moderne, Thiès
                  - cell "Atelier Petite-Côte" [ref=f2e221]
                  - cell "mar. 8 déc. 2026 à 09:00" [ref=f2e222]
                  - cell "En attente de validation" [ref=f2e223]:
                    - generic "Soumis à l’équipe Event Village, qui vérifie la fiche avant validation." [ref=f2e224]: En attente de validation
                  - cell [ref=f2e227]:
                    - time [ref=f2e228]: jeu. 19 nov. 2026 à 10:34
                  - cell [ref=f2e229]:
                    - link "Examiner" [ref=f2e230] [cursor=pointer]:
                      - /url: /admin/events/612dc110-b25b-4727-ad58-a9d766dde688
                - row [ref=f2e232]:
                  - cell "Atelier cuisine du thiéboudienne Maison des Saveurs, Kaolack" [ref=f2e233]:
                    - generic [ref=f2e234]:
                      - link "Atelier cuisine du thiéboudienne" [ref=f2e235] [cursor=pointer]:
                        - /url: /admin/events/8623a872-a99f-422a-b1c2-5b1d4e232f66
                      - generic [ref=f2e236]: Maison des Saveurs, Kaolack
                  - cell "Sine-Saloum Culture & Loisirs" [ref=f2e237]
                  - cell "sam. 5 déc. 2026 à 10:00" [ref=f2e238]
                  - cell "En attente de validation" [ref=f2e239]:
                    - generic "Soumis à l’équipe Event Village, qui vérifie la fiche avant validation." [ref=f2e240]: En attente de validation
                  - cell [ref=f2e243]:
                    - time [ref=f2e244]: jeu. 19 nov. 2026 à 10:34
                  - cell [ref=f2e245]:
                    - link "Examiner" [ref=f2e246] [cursor=pointer]:
                      - /url: /admin/events/8623a872-a99f-422a-b1c2-5b1d4e232f66
                - row [ref=f2e248]:
                  - cell "Festival des musiques du Saloum Parc de la Promenade, Kaolack" [ref=f2e249]:
                    - generic [ref=f2e250]:
                      - link "Festival des musiques du Saloum" [ref=f2e251] [cursor=pointer]:
                        - /url: /admin/events/df93422e-6d27-4e16-8ac3-eb759df0ebb5
                      - generic [ref=f2e252]: Parc de la Promenade, Kaolack
                  - cell "Sine-Saloum Culture & Loisirs" [ref=f2e253]
                  - cell "mar. 22 déc. 2026 à 17:00" [ref=f2e254]
                  - cell "En attente de validation" [ref=f2e255]:
                    - generic "Soumis à l’équipe Event Village, qui vérifie la fiche avant validation." [ref=f2e256]: En attente de validation
                  - cell [ref=f2e259]:
                    - time [ref=f2e260]: jeu. 19 nov. 2026 à 10:34
                  - cell [ref=f2e261]:
                    - link "Examiner" [ref=f2e262] [cursor=pointer]:
                      - /url: /admin/events/df93422e-6d27-4e16-8ac3-eb759df0ebb5
  - alert [ref=f2e264]
```

# Test source

```ts
  6   |  * aussi en paysage), pour que tout ce qui se décide au chargement suive la largeur. En clair : toutes les largeurs ; en
  7   |  * sombre : les largeurs capturées (360, 768, 1440) et le paysage. Les contrôles sont bloquants à chaque largeur contrôlée.
  8   |  *
  9   |  * Captures (JPEG, échelle 1, fenêtre visible) : .e2e-captures/captures-responsive/<page>__<largeur>__<thème>.jpg ;
  10  |  * résultats : .e2e-captures/responsive/<page>__<thème>.json, résumés par scripts/e2e/responsive-resume.mjs
  11  |  * (responsive.tsv et responsive.txt, publiés sur ci-results).
  12  |  */
  13  | import fs from 'node:fs';
  14  | import path from 'node:path';
  15  | import type { Page } from '@playwright/test';
  16  | import { test, expect, type CaptureRole, type ThemeKey } from './support/fixtures';
  17  | import { readDemoIds, E2E_OUTPUT_DIR, type DemoIds } from './support/demo-ids';
  18  | import { fakeScanMode, installFakeCamera } from './support/fake-camera';
  19  | import {
  20  |     PHONE_MAX_WIDTH, RESPONSIVE_CAPTURE_WIDTHS, RESPONSIVE_LANDSCAPE, RESPONSIVE_PAGES, RESPONSIVE_WIDTHS, type ResponsivePage,
  21  | } from './support/responsive-pages';
  22  | import { runResponsiveChecks } from './support/responsive-checks';
  23  | 
  24  | const RESULTS = path.join(E2E_OUTPUT_DIR, 'responsive');
  25  | const SHOTS = path.join(E2E_OUTPUT_DIR, 'captures-responsive');
  26  | 
  27  | const THEMES: ReadonlyArray<{ key: ThemeKey; colorScheme: 'light' | 'dark' }> = [
  28  |     { key: 'clair', colorScheme: 'light' },
  29  |     { key: 'sombre', colorScheme: 'dark' },
  30  | ];
  31  | 
  32  | interface Size { width: number; height: number; paysage?: boolean }
  33  | 
  34  | function sizesFor(p: ResponsivePage, theme: ThemeKey): Size[] {
  35  |     const base: Size[] = RESPONSIVE_WIDTHS
  36  |         .filter((w) => theme === 'clair' || RESPONSIVE_CAPTURE_WIDTHS.includes(w.width))
  37  |         .map((w) => ({ width: w.width, height: w.height }));
  38  |     const land: Size[] = p.paysage ? RESPONSIVE_LANDSCAPE.map((w) => ({ width: w.width, height: w.height, paysage: true })) : [];
  39  |     return [...base, ...land];
  40  | }
  41  | 
  42  | /** Page stable : polices chargées, réseau au repos (plafond 3 s, noté sinon), deux images d'affichage. */
  43  | async function settle(page: Page, notes: string[], at: string): Promise<void> {
  44  |     await page.evaluate(() => document.fonts.ready.then(() => true));
  45  |     await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => { notes.push(`${at} : réseau jamais au repos en 3 s (attente plafonnée)`); });
  46  |     await page.waitForFunction(() => Array.from(document.images).every((img) => img.complete), undefined, { timeout: 5_000 })
  47  |         .catch(() => { notes.push(`${at} : images encore en chargement après 5 s`); });
  48  |     await page.evaluate(() => new Promise<void>((resolve) => { requestAnimationFrame(() => requestAnimationFrame(() => resolve())); }));
  49  | }
  50  | 
  51  | interface ResponsiveRecord {
  52  |     page: string;
  53  |     titre: string;
  54  |     groupe: string;
  55  |     role: CaptureRole;
  56  |     theme: ThemeKey;
  57  |     url: string | null;
  58  |     sizes: Array<{ size: string; blocking: string[]; warnings: string[]; capture: string | null }>;
  59  |     notes: string[];
  60  |     error: string | null;
  61  | }
  62  | 
  63  | for (const theme of THEMES) {
  64  |     const roles = Array.from(new Set(RESPONSIVE_PAGES.map((p) => p.role)));
  65  |     for (const role of roles) {
  66  |         test.describe(`${theme.key} · ${role}`, () => {
  67  |             test.use({ colorScheme: theme.colorScheme, evTheme: theme.key, evRole: role });
  68  |             for (const p of RESPONSIVE_PAGES.filter((x) => x.role === role)) {
  69  |                 test(`${p.id} — ${p.titre}`, async ({ page, context, guard }) => {
  70  |                     test.setTimeout(240_000);
  71  |                     const record: ResponsiveRecord = { page: p.id, titre: p.titre, groupe: p.groupe, role, theme: theme.key, url: null, sizes: [], notes: [], error: null };
  72  |                     try {
  73  |                         const demo: DemoIds | null = p.needsIds ? readDemoIds() : null;
  74  |                         record.url = p.path(demo);
  75  |                         guard.configure({ allowFailures: p.allowFailures ?? [], ignoreConsoleErrors: false });
  76  |                         if (p.fakeCamera) await context.addInitScript(installFakeCamera, { mode: fakeScanMode() });
  77  |                         for (const size of sizesFor(p, theme.key)) {
  78  |                             const at = size.paysage ? `${size.width}×${size.height} px (paysage)` : `${size.width} px`;
  79  |                             await page.setViewportSize({ width: size.width, height: size.height });
  80  |                             const response = await page.goto(record.url, { waitUntil: 'load' });
  81  |                             if (p.expectStatus !== undefined) expect(response?.status(), `statut HTTP de ${record.url}`).toBe(p.expectStatus);
  82  |                             if (p.ready) await p.ready(page);
  83  |                             else await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 30_000 });
  84  |                             if (p.actions) await p.actions(page);
  85  |                             await settle(page, record.notes, at);
  86  |                             const checks = await runResponsiveChecks(page, { width: size.width, phone: !size.paysage && size.width <= PHONE_MAX_WIDTH });
  87  |                             const blocking = checks.blocking.map((b) => (size.paysage ? b.replace(`${size.width} px`, at) : b));
  88  |                             let capture: string | null = null;
  89  |                             if (size.paysage || RESPONSIVE_CAPTURE_WIDTHS.includes(size.width)) {
  90  |                                 fs.mkdirSync(SHOTS, { recursive: true });
  91  |                                 capture = `${p.id}__${size.paysage ? `${size.width}x${size.height}` : size.width}__${theme.key}.jpg`;
  92  |                                 await page.screenshot({ path: path.join(SHOTS, capture), type: 'jpeg', quality: 80, animations: 'disabled', caret: 'hide', scale: 'css' });
  93  |                             }
  94  |                             record.sizes.push({ size: at, blocking, warnings: checks.warnings, capture });
  95  |                         }
  96  |                     } catch (err) {
  97  |                         record.error = err instanceof Error ? err.message.split('\n')[0] : String(err);
  98  |                         throw err;
  99  |                     } finally {
  100 |                         // Erreurs de la page (console, requêtes) : notées, déjà bloquantes dans les captures
  101 |                         record.notes.push(...guard.blockingIssues().map((i) => `erreur de la page : ${i}`));
  102 |                         fs.mkdirSync(RESULTS, { recursive: true });
  103 |                         fs.writeFileSync(path.join(RESULTS, `${p.id}__${theme.key}.json`), `${JSON.stringify(record, null, 1)}\n`, 'utf8');
  104 |                     }
  105 |                     const blocking = record.sizes.flatMap((s) => s.blocking);
> 106 |                     expect(blocking, `contrôles responsive de ${p.id} (${theme.key})`).toEqual([]);
      |                                                                                        ^ Error: contrôles responsive de adm-evenements (sombre)
  107 |                 });
  108 |             }
  109 |         });
  110 |     }
  111 | }
  112 | 
```