# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> clair · anonyme >> explorer — Explorer
- Location: e2e/responsive.spec.ts:76:21

# Error details

```
Error: contrôles responsive de explorer (clair)

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "320 px : texte coupé : span.whitespace-nowrap « Bientôt en vente » dépasse de article.ev-press.ev-lift «  »",
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
        - button "Notifications" [ref=f5e26] [cursor=pointer]
        - button "Mon compte" [ref=f5e31] [cursor=pointer]
    - main [ref=f5e39]:
      - generic [ref=f5e41]:
        - generic [ref=f5e43]:
          - generic [ref=f5e44]:
            - heading "Explorer les événements" [level=1] [ref=f5e45]
            - paragraph [ref=f5e46]: Concerts, festivals, soirées et rencontres à venir au Sénégal. La liste se met à jour d’elle-même.
          - status [ref=f5e48]: En direct
        - region "Recherche et filtres" [ref=f5e50]:
          - generic [ref=f5e52]:
            - generic [ref=f5e53]: Rechercher un événement
            - searchbox "Rechercher un événement" [ref=f5e55]
          - group "Date et prix" [ref=f5e56]:
            - button "Aujourd’hui" [ref=f5e57] [cursor=pointer]
            - button "Ce week-end" [ref=f5e58] [cursor=pointer]
            - button "Cette semaine" [ref=f5e59] [cursor=pointer]
            - button "Gratuit" [ref=f5e60] [cursor=pointer]
          - generic [ref=f5e61]:
            - generic [ref=f5e62]:
              - generic [ref=f5e63]: Ville
              - combobox "Ville" [ref=f5e66] [cursor=pointer]:
                - option "Toutes les villes" [selected]
                - option "Dakar"
                - option "Foundiougne"
                - option "Gorée"
                - option "Kaolack"
                - option "Mbour"
                - option "Saint-Louis"
                - option "Saly"
                - option "Ziguinchor"
            - generic [ref=f5e67]:
              - generic [ref=f5e68]: Trier par
              - combobox "Trier par" [ref=f5e71] [cursor=pointer]:
                - option "Date la plus proche" [selected]
                - option "Prix croissant"
        - group "Catégorie" [ref=f5e73]:
          - button "Toutes les catégories" [pressed] [ref=f5e74] [cursor=pointer]:
            - generic [aria-hidden] [ref=f5e75]: ✓
            - text: Toutes les catégories
          - button "Concerts & Musique" [ref=f5e76] [cursor=pointer]
          - button "Festivals" [ref=f5e77] [cursor=pointer]
          - button "Gastronomie & Tables" [ref=f5e78] [cursor=pointer]
          - button "Salles & Réceptions" [ref=f5e79] [cursor=pointer]
        - region [ref=f5e81]:
          - heading "12 sur 13 événements" [level=2] [ref=f5e83]
          - list [ref=f5e84]:
            - listitem [ref=f5e85]:
              - article [ref=f5e86]:
                - generic [ref=f5e87]:
                  - generic: En cours
                  - 'button "Mettre en favori : Nuit du Sabar — édition d’automne" [ref=f5e88] [cursor=pointer]'
                - generic [ref=f5e91]:
                  - paragraph [ref=f5e92]: Concerts & Musique
                  - heading [level=3] [ref=f5e93]:
                    - link "Nuit du Sabar — édition d’automne" [ref=f5e94] [cursor=pointer]:
                      - /url: /events/fe2c4616-5fef-40f8-812c-d52e6b0bfd49
                  - paragraph [ref=f5e95]:
                    - generic [ref=f5e98]: dim. 22 nov. · 05:00
                  - paragraph [ref=f5e99]: Commence dans 45 min
                  - paragraph [ref=f5e100]: Dakar
                  - paragraph [ref=f5e101]:
                    - generic [ref=f5e102]:
                      - generic [ref=f5e103]: Dès
                      - generic [ref=f5e104]: 5 000 F CFA
            - listitem [ref=f5e105]:
              - article [ref=f5e106]:
                - generic [ref=f5e107]:
                  - generic: En cours
                  - 'button "Mettre en favori : Concert des Lumières de Gorée" [ref=f5e108] [cursor=pointer]'
                - generic [ref=f5e111]:
                  - paragraph [ref=f5e112]: Concerts & Musique
                  - heading [level=3] [ref=f5e113]:
                    - link "Concert des Lumières de Gorée" [ref=f5e114] [cursor=pointer]:
                      - /url: /events/90bd3cb9-0fef-4ccb-b68f-03bca39554e7
                  - paragraph [ref=f5e115]:
                    - generic [ref=f5e118]: lun. 23 nov. · 00:15
                  - paragraph [ref=f5e119]: Commence dans 20 h 00 min
                  - paragraph [ref=f5e120]: Gorée
                  - paragraph [ref=f5e121]:
                    - generic [ref=f5e122]:
                      - generic [ref=f5e123]: Dès
                      - generic [ref=f5e124]: 6 000 F CFA
            - listitem [ref=f5e125]:
              - article [ref=f5e126]:
                - generic [ref=f5e127]:
                  - generic: En cours
                  - 'button "Mettre en favori : Nuit du slam de Kaolack" [ref=f5e128] [cursor=pointer]'
                - generic [ref=f5e131]:
                  - paragraph [ref=f5e132]: Concerts & Musique
                  - heading [level=3] [ref=f5e133]:
                    - link "Nuit du slam de Kaolack" [ref=f5e134] [cursor=pointer]:
                      - /url: /events/3575016f-de1e-4298-9b47-8ad0086c3ca0
                  - paragraph [ref=f5e135]:
                    - generic [ref=f5e138]: lun. 23 nov. · 21:00
                  - paragraph [ref=f5e139]: Commence dans 1 j 16 h
                  - paragraph [ref=f5e140]: Kaolack
                  - generic [ref=f5e141]: Dernières places
                  - paragraph [ref=f5e144]:
                    - generic [ref=f5e145]:
                      - generic [ref=f5e146]: Dès
                      - generic [ref=f5e147]: 3 000 F CFA
            - listitem [ref=f5e148]:
              - article [ref=f5e149]:
                - generic [ref=f5e150]:
                  - generic: En cours
                  - 'button "Mettre en favori : Marché gourmand de la Petite-Côte" [ref=f5e151] [cursor=pointer]'
                - generic [ref=f5e154]:
                  - paragraph [ref=f5e155]: Gastronomie & Tables
                  - heading [level=3] [ref=f5e156]:
                    - link "Marché gourmand de la Petite-Côte" [ref=f5e157] [cursor=pointer]:
                      - /url: /events/6f7fa922-1b94-4dbc-9333-aa25c611dc06
                  - paragraph [ref=f5e158]:
                    - generic [ref=f5e161]: ven. 27 nov. · 10:00
                  - paragraph [ref=f5e162]: Commence dans 5 j 5 h
                  - paragraph [ref=f5e163]: Mbour
                  - paragraph [ref=f5e164]:
                    - generic [ref=f5e165]:
                      - generic [ref=f5e166]: Dès
                      - generic [ref=f5e167]: 1 000 F CFA
            - listitem [ref=f5e168]:
              - article [ref=f5e169]:
                - generic [ref=f5e170]:
                  - generic: En cours
                  - 'button "Mettre en favori : Carte B arrêt de vente 6e91b134" [ref=f5e171] [cursor=pointer]'
                - generic [ref=f5e174]:
                  - paragraph [ref=f5e175]: Concerts & Musique
                  - heading [level=3] [ref=f5e176]:
                    - link "Carte B arrêt de vente 6e91b134" [ref=f5e177] [cursor=pointer]:
                      - /url: /events/e0dd02bf-b8c2-480a-9afd-ff138d4417a4
                  - paragraph [ref=f5e178]:
                    - generic [ref=f5e181]: sam. 28 nov. · 20:00
                  - paragraph [ref=f5e182]: Commence dans 6 j 15 h
                  - paragraph [ref=f5e183]: Dakar
                  - paragraph [ref=f5e184]:
                    - generic [ref=f5e185]:
                      - generic [ref=f5e186]: Billetterie
                      - generic [ref=f5e187]: Bientôt en vente
            - listitem [ref=f5e188]:
              - article [ref=f5e189]:
                - generic [ref=f5e190]:
                  - generic: En cours
                  - 'button "Mettre en favori : Dîner-spectacle au bord du Saloum" [ref=f5e191] [cursor=pointer]'
                - generic [ref=f5e194]:
                  - paragraph [ref=f5e195]: Salles & Réceptions
                  - heading [level=3] [ref=f5e196]:
                    - link "Dîner-spectacle au bord du Saloum" [ref=f5e197] [cursor=pointer]:
                      - /url: /events/ac1b4955-611c-44fa-ad62-dc1e6231902c
                  - paragraph [ref=f5e198]:
                    - generic [ref=f5e201]: lun. 30 nov. · 20:00
                  - paragraph [ref=f5e202]: Foundiougne
                  - paragraph [ref=f5e203]:
                    - generic [ref=f5e204]:
                      - generic [ref=f5e205]: Dès
                      - generic [ref=f5e206]: 25 000 F CFA
            - listitem [ref=f5e207]:
              - article [ref=f5e208]:
                - generic [ref=f5e209]:
                  - generic: En cours
                  - 'button "Mettre en favori : Festival Jazz sur le Fleuve" [ref=f5e210] [cursor=pointer]'
                - generic [ref=f5e213]:
                  - paragraph [ref=f5e214]: Festivals
                  - heading [level=3] [ref=f5e215]:
                    - link "Festival Jazz sur le Fleuve" [ref=f5e216] [cursor=pointer]:
                      - /url: /events/4b1852f3-b49f-44a0-9652-ba1d2d54bb02
                  - paragraph [ref=f5e217]:
                    - generic [ref=f5e220]: ven. 4 déc. · 18:00
                  - paragraph [ref=f5e221]: Saint-Louis
                  - paragraph [ref=f5e222]:
                    - generic [ref=f5e223]:
                      - generic [ref=f5e224]: Dès
                      - generic [ref=f5e225]: 7 500 F CFA
            - listitem [ref=f5e226]:
              - article [ref=f5e227]:
                - generic [ref=f5e228]:
                  - generic: En cours
                  - 'button "Mettre en favori : Soirée Kora & Lumières" [ref=f5e229] [cursor=pointer]'
                - generic [ref=f5e232]:
                  - paragraph [ref=f5e233]: Concerts & Musique
                  - heading [level=3] [ref=f5e234]:
                    - link "Soirée Kora & Lumières" [ref=f5e235] [cursor=pointer]:
                      - /url: /events/a2401a7c-9452-4388-92b7-f124ab5b1e6d
                  - paragraph [ref=f5e236]:
                    - generic [ref=f5e239]: mer. 9 déc. · 20:30
                  - paragraph [ref=f5e240]: Dakar
                  - paragraph [ref=f5e241]:
                    - generic [ref=f5e242]:
                      - generic [ref=f5e243]: Dès
                      - generic [ref=f5e244]: 6 000 F CFA
            - listitem [ref=f5e245]:
              - article [ref=f5e246]:
                - generic [ref=f5e247]:
                  - generic: En cours
                  - 'button "Mettre en favori : TEST Spectacle B (publié, à venir)" [ref=f5e248] [cursor=pointer]'
                - generic [ref=f5e251]:
                  - paragraph [ref=f5e252]: Concerts & Musique
                  - heading [level=3] [ref=f5e253]:
                    - link "TEST Spectacle B (publié, à venir)" [ref=f5e254] [cursor=pointer]:
                      - /url: /events/38f1699f-8867-417d-ab7b-ce431823c195
                  - paragraph [ref=f5e255]:
                    - generic [ref=f5e258]: sam. 12 déc. · 20:00
                  - paragraph [ref=f5e259]: Dakar
                  - paragraph [ref=f5e260]:
                    - generic [ref=f5e261]:
                      - generic [ref=f5e262]: Dès
                      - generic [ref=f5e263]: 4 000 F CFA
            - listitem [ref=f5e264]:
              - article [ref=f5e265]:
                - generic [ref=f5e266]:
                  - generic: En cours
                  - 'button "Mettre en favori : Gala des entrepreneurs du Saloum" [ref=f5e267] [cursor=pointer]'
                - generic [ref=f5e270]:
                  - paragraph [ref=f5e271]: Salles & Réceptions
                  - heading [level=3] [ref=f5e272]:
                    - link "Gala des entrepreneurs du Saloum" [ref=f5e273] [cursor=pointer]:
                      - /url: /events/01f76663-43a7-4d7d-b9f2-96376e92e213
                  - paragraph [ref=f5e274]:
                    - generic [ref=f5e277]: dim. 13 déc. · 19:30
                  - paragraph [ref=f5e278]: Kaolack
                  - paragraph [ref=f5e279]:
                    - generic [ref=f5e280]:
                      - generic [ref=f5e281]: Dès
                      - generic [ref=f5e282]: 10 000 F CFA
            - listitem [ref=f5e283]:
              - article [ref=f5e284]:
                - generic [ref=f5e285]:
                  - generic: En cours
                  - 'button "Mettre en favori : Festival des rythmes de Casamance" [ref=f5e286] [cursor=pointer]'
                - generic [ref=f5e289]:
                  - paragraph [ref=f5e290]: Festivals
                  - heading [level=3] [ref=f5e291]:
                    - link "Festival des rythmes de Casamance" [ref=f5e292] [cursor=pointer]:
                      - /url: /events/c9355e67-c0e2-4f24-8927-7e82e8fe2ae8
                  - paragraph [ref=f5e293]:
                    - generic [ref=f5e296]: ven. 18 déc. · 17:00
                  - paragraph [ref=f5e297]: Ziguinchor
                  - paragraph [ref=f5e298]:
                    - generic [ref=f5e299]:
                      - generic [ref=f5e300]: Dès
                      - generic [ref=f5e301]: 5 000 F CFA
            - listitem [ref=f5e302]:
              - article [ref=f5e303]:
                - generic [ref=f5e304]:
                  - generic: En cours
                  - 'button "Mettre en favori : Carnaval des enfants de Saly" [ref=f5e305] [cursor=pointer]'
                - generic [ref=f5e308]:
                  - paragraph [ref=f5e309]: Festivals
                  - heading [level=3] [ref=f5e310]:
                    - link "Carnaval des enfants de Saly" [ref=f5e311] [cursor=pointer]:
                      - /url: /events/88e0e97b-8fb0-4aa8-8fe5-ee474456c894
                  - paragraph [ref=f5e312]:
                    - generic [ref=f5e315]: mar. 22 déc. · 15:00
                  - paragraph [ref=f5e316]: Saly
                  - paragraph [ref=f5e317]:
                    - generic [ref=f5e318]:
                      - generic [ref=f5e319]: Dès
                      - generic [ref=f5e320]: 2 000 F CFA
          - link "Voir plus d’événements" [ref=f5e322] [cursor=pointer]:
            - /url: /explore?page=2
  - alert [ref=f5e324]
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
      |                                                                                        ^ Error: contrôles responsive de explorer (clair)
  121 |                 });
  122 |             }
  123 |         });
  124 |     }
  125 | }
  126 | 
```