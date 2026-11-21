# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> clair · organisateur >> org-tables-planning — Planning du jour d’un établissement validé
- Location: e2e/responsive.spec.ts:76:21

# Error details

```
Error: contrôles responsive de org-tables-planning (clair)

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 8

- Array []
+ Array [
+   "320 px : défilement horizontal (largeur du document 1208 px, fenêtre 320 px)",
+   "360 px : défilement horizontal (largeur du document 1208 px, fenêtre 360 px)",
+   "390 px : défilement horizontal (largeur du document 1208 px, fenêtre 390 px)",
+   "768 px : défilement horizontal (largeur du document 1220 px, fenêtre 768 px)",
+   "1024 px : défilement horizontal (largeur du document 1484 px, fenêtre 1024 px)",
+   "1440 px : défilement horizontal (largeur du document 1516 px, fenêtre 1440 px)",
+ ]
```

# Page snapshot

```yaml
- generic [active] [ref=f5e1]:
  - generic [ref=f5e2]:
    - complementary [ref=f5e3]:
      - link "Event Village, accueil" [ref=f5e5] [cursor=pointer]:
        - /url: /
        - generic [ref=f5e6]: Event Village
      - navigation "Navigation principale" [ref=f5e9]:
        - generic [ref=f5e10]:
          - paragraph [ref=f5e11]: Gestion
          - generic [ref=f5e12]:
            - link "Tableau de bord" [ref=f5e13] [cursor=pointer]:
              - /url: /partner/dashboard
            - link "Événements" [ref=f5e20] [cursor=pointer]:
              - /url: /partner/events
            - link "Salles de fête" [ref=f5e24] [cursor=pointer]:
              - /url: /partner/halls
            - link "Tables" [ref=f5e30] [cursor=pointer]:
              - /url: /partner/tables
            - link "Équipe" [ref=f5e35] [cursor=pointer]:
              - /url: /partner/team
        - generic [ref=f5e42]:
          - paragraph [ref=f5e43]: Outils
          - generic [ref=f5e44]:
            - link "Finances" [ref=f5e45] [cursor=pointer]:
              - /url: /partner/finance
            - link "Statistiques" [ref=f5e49] [cursor=pointer]:
              - /url: /partner/stats
            - link "Scanner les billets" [ref=f5e53] [cursor=pointer]:
              - /url: /partner/scan
            - link "Calendrier" [ref=f5e61] [cursor=pointer]:
              - /url: /partner/calendar
            - link "Abonnement" [ref=f5e65] [cursor=pointer]:
              - /url: /partner/subscription
            - link "Profil partenaire" [ref=f5e70] [cursor=pointer]:
              - /url: /partner/profile
        - link "Retour au site" [ref=f5e76] [cursor=pointer]:
          - /url: /
      - generic [ref=f5e82]:
        - link "Mariama Ndiaye Partenaire" [ref=f5e83] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=f5e84]: MN
          - generic [ref=f5e85]:
            - generic [ref=f5e86]: Mariama Ndiaye
            - generic [ref=f5e87]: Partenaire
        - generic [ref=f5e88]:
          - button "Se déconnecter" [ref=f5e89] [cursor=pointer]
          - button "Basculer le thème" [ref=f5e94] [cursor=pointer]
    - generic [ref=f5e98]:
      - banner [ref=f5e99]:
        - link "Rechercher un événement…" [ref=f5e101] [cursor=pointer]:
          - /url: /explore
        - button "Notifications, 37 non lues" [ref=f5e108] [cursor=pointer]:
          - generic [ref=f5e112]: "37"
      - main [ref=f5e113]:
        - generic [ref=f5e115]:
          - generic [ref=f5e116]:
            - link "Mes établissements" [ref=f5e118] [cursor=pointer]:
              - /url: /partner/tables
            - generic [ref=f5e123]:
              - generic [ref=f5e124]:
                - generic [ref=f5e125]: Validé
                - heading "La Terrasse du Plateau" [level=1] [ref=f5e128]
                - paragraph [ref=f5e129]: Restaurant · Dakar
              - generic [ref=f5e130]:
                - link "Modifier" [ref=f5e131] [cursor=pointer]:
                  - /url: /partner/tables/edition/c4ce25dd-131e-4a3e-8005-a018532f2888
                - link "Plan de salle" [ref=f5e137] [cursor=pointer]:
                  - /url: /partner/tables/edition/c4ce25dd-131e-4a3e-8005-a018532f2888/plan
                - link "Fermetures" [ref=f5e145] [cursor=pointer]:
                  - /url: /partner/tables/edition/c4ce25dd-131e-4a3e-8005-a018532f2888/fermetures
                - link "Recettes" [ref=f5e152] [cursor=pointer]:
                  - /url: /partner/tables/recettes
          - generic [ref=f5e158]:
            - generic [ref=f5e159]:
              - generic [ref=f5e160]:
                - heading "Aujourd’hui" [level=2] [ref=f5e161]
                - status [ref=f5e162]: Mis à jour à 5 h 09
              - button "Actualiser le planning" [ref=f5e164] [cursor=pointer]
            - generic [ref=f5e171]:
              - list "Choisir le jour du planning" [ref=f5e172]:
                - listitem [ref=f5e173]:
                  - button "Hier 20 nov" [ref=f5e174] [cursor=pointer]:
                    - generic [ref=f5e175]: Hier
                    - generic [ref=f5e176]: "20"
                    - generic [ref=f5e177]: nov
                - listitem [ref=f5e178]:
                  - button "Aujourd’hui 21 nov" [pressed] [ref=f5e179] [cursor=pointer]:
                    - generic [ref=f5e180]: Aujourd’hui
                    - generic [ref=f5e181]: "21"
                    - generic [ref=f5e182]: nov
                - listitem [ref=f5e183]:
                  - button "Demain 22 nov" [ref=f5e184] [cursor=pointer]:
                    - generic [ref=f5e185]: Demain
                    - generic [ref=f5e186]: "22"
                    - generic [ref=f5e187]: nov
                - listitem [ref=f5e188]:
                  - button "Lun 23 nov" [ref=f5e189] [cursor=pointer]:
                    - generic [ref=f5e190]: Lun
                    - generic [ref=f5e191]: "23"
                    - generic [ref=f5e192]: nov
                - listitem [ref=f5e193]:
                  - button "Mar 24 nov" [ref=f5e194] [cursor=pointer]:
                    - generic [ref=f5e195]: Mar
                    - generic [ref=f5e196]: "24"
                    - generic [ref=f5e197]: nov
                - listitem [ref=f5e198]:
                  - button "Mer 25 nov" [ref=f5e199] [cursor=pointer]:
                    - generic [ref=f5e200]: Mer
                    - generic [ref=f5e201]: "25"
                    - generic [ref=f5e202]: nov
                - listitem [ref=f5e203]:
                  - button "Jeu 26 nov" [ref=f5e204] [cursor=pointer]:
                    - generic [ref=f5e205]: Jeu
                    - generic [ref=f5e206]: "26"
                    - generic [ref=f5e207]: nov
                - listitem [ref=f5e208]:
                  - button "Ven 27 nov" [ref=f5e209] [cursor=pointer]:
                    - generic [ref=f5e210]: Ven
                    - generic [ref=f5e211]: "27"
                    - generic [ref=f5e212]: nov
                - listitem [ref=f5e213]:
                  - button "Sam 28 nov" [ref=f5e214] [cursor=pointer]:
                    - generic [ref=f5e215]: Sam
                    - generic [ref=f5e216]: "28"
                    - generic [ref=f5e217]: nov
                - listitem [ref=f5e218]:
                  - button "Dim 29 nov" [ref=f5e219] [cursor=pointer]:
                    - generic [ref=f5e220]: Dim
                    - generic [ref=f5e221]: "29"
                    - generic [ref=f5e222]: nov
                - listitem [ref=f5e223]:
                  - button "Lun 30 nov" [ref=f5e224] [cursor=pointer]:
                    - generic [ref=f5e225]: Lun
                    - generic [ref=f5e226]: "30"
                    - generic [ref=f5e227]: nov
                - listitem [ref=f5e228]:
                  - button "Mar 1 déc" [ref=f5e229] [cursor=pointer]:
                    - generic [ref=f5e230]: Mar
                    - generic [ref=f5e231]: "1"
                    - generic [ref=f5e232]: déc
                - listitem [ref=f5e233]:
                  - button "Mer 2 déc" [ref=f5e234] [cursor=pointer]:
                    - generic [ref=f5e235]: Mer
                    - generic [ref=f5e236]: "2"
                    - generic [ref=f5e237]: déc
                - listitem [ref=f5e238]:
                  - button "Jeu 3 déc" [ref=f5e239] [cursor=pointer]:
                    - generic [ref=f5e240]: Jeu
                    - generic [ref=f5e241]: "3"
                    - generic [ref=f5e242]: déc
                - listitem [ref=f5e243]:
                  - button "Ven 4 déc" [ref=f5e244] [cursor=pointer]:
                    - generic [ref=f5e245]: Ven
                    - generic [ref=f5e246]: "4"
                    - generic [ref=f5e247]: déc
              - generic [ref=f5e248]:
                - generic [ref=f5e249]: Autre jour
                - textbox "Autre jour" [ref=f5e252]: 2026-11-21
          - status [ref=f5e253]
          - generic [ref=f5e254]:
            - region [ref=f5e256]:
              - heading "Réservations du jour" [level=2] [ref=f5e258]
              - generic [ref=f5e260]:
                - heading "Aucune réservation aujourd’hui pour le moment" [level=3] [ref=f5e266]
                - paragraph [ref=f5e267]: Les nouvelles réservations apparaissent ici d’elles-mêmes, avec un signal discret. Gardez cette page ouverte pendant le service.
            - complementary "Tables et réglages de l’écran" [ref=f5e268]:
              - region [ref=f5e269]:
                - generic [ref=f5e270]:
                  - heading "Les tables maintenant" [level=2] [ref=f5e271]
                  - paragraph [ref=f5e277]: 8 libres · 0 attendue · 0 occupée
                - generic [ref=f5e278]:
                  - generic [ref=f5e279]:
                    - 'group "Plan de salle : état des tables maintenant" [ref=f5e280]':
                      - generic [ref=f5e281]:
                        - generic:
                          - generic "Salle climatisée"
                        - generic:
                          - generic "Terrasse"
                        - button "Table 1, 2 places, libre, aucune autre réservation aujourd’hui" [ref=f5e282] [cursor=pointer]:
                          - generic [aria-hidden] [ref=f5e284]:
                            - generic [ref=f5e285]: "1"
                            - generic [ref=f5e286]: "2"
                        - button "Table 2, 2 places, libre, aucune autre réservation aujourd’hui" [ref=f5e292] [cursor=pointer]:
                          - generic [aria-hidden] [ref=f5e294]:
                            - generic [ref=f5e295]: "2"
                            - generic [ref=f5e296]: "2"
                        - button "Table 3, 2 à 4 places, libre, aucune autre réservation aujourd’hui" [ref=f5e302] [cursor=pointer]:
                          - generic [aria-hidden] [ref=f5e304]:
                            - generic [ref=f5e305]: "3"
                            - generic [ref=f5e306]: "4"
                        - button "Table 4, 2 à 4 places, libre, aucune autre réservation aujourd’hui" [ref=f5e312] [cursor=pointer]:
                          - generic [aria-hidden] [ref=f5e314]:
                            - generic [ref=f5e315]: "4"
                            - generic [ref=f5e316]: "4"
                        - button "Table 5, 3 à 6 places, libre, aucune autre réservation aujourd’hui" [ref=f5e322] [cursor=pointer]:
                          - generic [aria-hidden] [ref=f5e324]:
                            - generic [ref=f5e325]: "5"
                            - generic [ref=f5e326]: "6"
                        - button "Table 6, 2 à 4 places, libre, aucune autre réservation aujourd’hui" [ref=f5e332] [cursor=pointer]:
                          - generic [aria-hidden] [ref=f5e334]:
                            - generic [ref=f5e335]: "6"
                            - generic [ref=f5e336]: "4"
                        - button "Table 7, 3 à 6 places, libre, aucune autre réservation aujourd’hui" [ref=f5e342] [cursor=pointer]:
                          - generic [aria-hidden] [ref=f5e344]:
                            - generic [ref=f5e345]: "7"
                            - generic [ref=f5e346]: "6"
                        - button "Table 8, 4 à 8 places, libre, aucune autre réservation aujourd’hui" [ref=f5e352] [cursor=pointer]:
                          - generic [aria-hidden] [ref=f5e354]:
                            - generic [ref=f5e355]: "8"
                            - generic [ref=f5e356]: "8"
                    - paragraph [ref=f5e362]: "Zones du plan : Salle climatisée, Terrasse"
                    - list "Légende du plan" [ref=f5e363]:
                      - listitem [ref=f5e364]:
                        - generic [ref=f5e366]: Libre
                    - paragraph [ref=f5e367]: "Flèches : déplacer de 1 %. Majuscule et flèches : déplacer de 5 %. Touche R : tourner la table de 15 degrés."
                    - paragraph [ref=f5e368]
                  - paragraph [ref=f5e369]: Touchez une table pour ouvrir sa réservation.
              - region [ref=f5e370]:
                - heading "Réglages de l’écran" [level=2] [ref=f5e371]
                - generic [ref=f5e373]:
                  - generic [ref=f5e374]:
                    - generic [ref=f5e375] [cursor=pointer]: Signal des nouvelles réservations
                    - paragraph [ref=f5e376]: Un petit bip à chaque nouvelle réservation, dès que vous avez touché la page une fois. Choix gardé sur cet appareil.
                  - generic [ref=f5e377]:
                    - generic [aria-hidden] [ref=f5e378]: Activé
                    - switch "Signal des nouvelles réservations" [checked] [ref=f5e379] [cursor=pointer]
              - paragraph [ref=f5e383]: "Gardez cette page ouverte pendant le service : elle se met à jour toute seule."
  - alert [ref=f5e389]
```

# Test source

```ts
  20  | import path from 'node:path';
  21  | import type { Page } from '@playwright/test';
  22  | import { test, expect, type CaptureRole, type ThemeKey } from './support/fixtures';
  23  | import { readDemoIds, E2E_OUTPUT_DIR, type DemoIds } from './support/demo-ids';
  24  | import { fakeScanMode, installFakeCamera } from './support/fake-camera';
  25  | import {
  26  |     PHONE_MAX_WIDTH, RESPONSIVE_CAPTURE_WIDTHS, RESPONSIVE_LANDSCAPE, RESPONSIVE_PAGES, RESPONSIVE_WIDTHS, type ResponsivePage,
  27  | } from './support/responsive-pages';
  28  | import { runResponsiveChecks } from './support/responsive-checks';
  29  | import { keepHomeOutOfServicesWindow } from './support/services-switch';
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
  76  |                 test(`${p.id} — ${p.titre}`, async ({ page, context, guard, servicesLock }) => {
  77  |                     test.setTimeout(240_000);
  78  |                     const record: ResponsiveRecord = { page: p.id, titre: p.titre, groupe: p.groupe, role, theme: theme.key, url: null, sizes: [], notes: [], error: null };
  79  |                     try {
  80  |                         // Lot 10b (lot 11b : salles et tables) : verrou des services avant tout chargement (attente ajoutée au délai du test)
  81  |                         await servicesLock.enter(p.services ? 'services' : 'autres');
  82  |                         if (servicesLock.waitedMs >= 1_000) record.notes.push(`attente du verrou des services : ${Math.round(servicesLock.waitedMs / 1000)} s`);
  83  |                         if (p.services) {
  84  |                             record.notes.push('page des services : interrupteurs features.halls_enabled et features.tables_enabled ouverts le temps du test (e2e/support/services-switch.ts)');
  85  |                             await keepHomeOutOfServicesWindow(page);
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
      |                                                                                        ^ Error: contrôles responsive de org-tables-planning (clair)
  121 |                 });
  122 |             }
  123 |         });
  124 |     }
  125 | }
  126 | 
```