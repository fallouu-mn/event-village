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
        - tablist "Affichage des événements" [ref=f5e82]:
          - tab "Liste" [selected] [ref=f5e83] [cursor=pointer]
          - tab "Carte" [ref=f5e85] [cursor=pointer]
          - tab "Calendrier" [ref=f5e87] [cursor=pointer]
        - tabpanel "Liste" [ref=f5e89]:
          - heading "12 sur 13 événements" [level=2] [ref=f5e91]
          - list [ref=f5e92]:
            - listitem [ref=f5e93]:
              - article [ref=f5e94]:
                - generic [ref=f5e95]:
                  - generic: En cours
                  - 'button "Mettre en favori : Nuit du Sabar — édition d’automne" [ref=f5e96] [cursor=pointer]'
                - generic [ref=f5e99]:
                  - paragraph [ref=f5e100]: Concerts & Musique
                  - heading [level=3] [ref=f5e101]:
                    - link "Nuit du Sabar — édition d’automne" [ref=f5e102] [cursor=pointer]:
                      - /url: /events/0e5fa293-90ec-49a4-8d41-317c66a5b57d
                  - paragraph [ref=f5e103]:
                    - generic [ref=f5e106]: dim. 22 nov. · 05:00
                  - paragraph [ref=f5e107]: Commence dans 44 min
                  - paragraph [ref=f5e108]: Dakar
                  - paragraph [ref=f5e109]:
                    - generic [ref=f5e110]:
                      - generic [ref=f5e111]: Dès
                      - generic [ref=f5e112]: 5 000 F CFA
            - listitem [ref=f5e113]:
              - article [ref=f5e114]:
                - generic [ref=f5e115]:
                  - generic: En cours
                  - 'button "Mettre en favori : Concert des Lumières de Gorée" [ref=f5e116] [cursor=pointer]'
                - generic [ref=f5e119]:
                  - paragraph [ref=f5e120]: Concerts & Musique
                  - heading [level=3] [ref=f5e121]:
                    - link "Concert des Lumières de Gorée" [ref=f5e122] [cursor=pointer]:
                      - /url: /events/2bdca311-af8d-42c1-a094-4abed12d2053
                  - paragraph [ref=f5e123]:
                    - generic [ref=f5e126]: lun. 23 nov. · 00:15
                  - paragraph [ref=f5e127]: Commence dans 19 h 59 min
                  - paragraph [ref=f5e128]: Gorée
                  - paragraph [ref=f5e129]:
                    - generic [ref=f5e130]:
                      - generic [ref=f5e131]: Dès
                      - generic [ref=f5e132]: 6 000 F CFA
            - listitem [ref=f5e133]:
              - article [ref=f5e134]:
                - generic [ref=f5e135]:
                  - generic: En cours
                  - 'button "Mettre en favori : Nuit du slam de Kaolack" [ref=f5e136] [cursor=pointer]'
                - generic [ref=f5e139]:
                  - paragraph [ref=f5e140]: Concerts & Musique
                  - heading [level=3] [ref=f5e141]:
                    - link "Nuit du slam de Kaolack" [ref=f5e142] [cursor=pointer]:
                      - /url: /events/56035781-7242-425d-9863-69daae651596
                  - paragraph [ref=f5e143]:
                    - generic [ref=f5e146]: lun. 23 nov. · 21:00
                  - paragraph [ref=f5e147]: Commence dans 1 j 16 h
                  - paragraph [ref=f5e148]: Kaolack
                  - generic [ref=f5e149]: Dernières places
                  - paragraph [ref=f5e152]:
                    - generic [ref=f5e153]:
                      - generic [ref=f5e154]: Dès
                      - generic [ref=f5e155]: 3 000 F CFA
            - listitem [ref=f5e156]:
              - article [ref=f5e157]:
                - generic [ref=f5e158]:
                  - generic: En cours
                  - 'button "Mettre en favori : Marché gourmand de la Petite-Côte" [ref=f5e159] [cursor=pointer]'
                - generic [ref=f5e162]:
                  - paragraph [ref=f5e163]: Gastronomie & Tables
                  - heading [level=3] [ref=f5e164]:
                    - link "Marché gourmand de la Petite-Côte" [ref=f5e165] [cursor=pointer]:
                      - /url: /events/5ff0a295-e13f-4a68-8cb4-dfbc7ee25357
                  - paragraph [ref=f5e166]:
                    - generic [ref=f5e169]: ven. 27 nov. · 10:00
                  - paragraph [ref=f5e170]: Commence dans 5 j 5 h
                  - paragraph [ref=f5e171]: Mbour
                  - paragraph [ref=f5e172]:
                    - generic [ref=f5e173]:
                      - generic [ref=f5e174]: Dès
                      - generic [ref=f5e175]: 1 000 F CFA
            - listitem [ref=f5e176]:
              - article [ref=f5e177]:
                - generic [ref=f5e178]:
                  - generic: En cours
                  - 'button "Mettre en favori : Carte B arrêt de vente c5eabe24" [ref=f5e179] [cursor=pointer]'
                - generic [ref=f5e182]:
                  - paragraph [ref=f5e183]: Concerts & Musique
                  - heading [level=3] [ref=f5e184]:
                    - link "Carte B arrêt de vente c5eabe24" [ref=f5e185] [cursor=pointer]:
                      - /url: /events/4c31920f-7d7c-46f6-a53d-4a1ec95483f8
                  - paragraph [ref=f5e186]:
                    - generic [ref=f5e189]: sam. 28 nov. · 20:00
                  - paragraph [ref=f5e190]: Commence dans 6 j 15 h
                  - paragraph [ref=f5e191]: Dakar
                  - paragraph [ref=f5e192]:
                    - generic [ref=f5e193]:
                      - generic [ref=f5e194]: Billetterie
                      - generic [ref=f5e195]: Bientôt en vente
            - listitem [ref=f5e196]:
              - article [ref=f5e197]:
                - generic [ref=f5e198]:
                  - generic: En cours
                  - 'button "Mettre en favori : Dîner-spectacle au bord du Saloum" [ref=f5e199] [cursor=pointer]'
                - generic [ref=f5e202]:
                  - paragraph [ref=f5e203]: Salles & Réceptions
                  - heading [level=3] [ref=f5e204]:
                    - link "Dîner-spectacle au bord du Saloum" [ref=f5e205] [cursor=pointer]:
                      - /url: /events/391f2ddb-9107-44c0-9ec1-2e96899e770d
                  - paragraph [ref=f5e206]:
                    - generic [ref=f5e209]: lun. 30 nov. · 20:00
                  - paragraph [ref=f5e210]: Foundiougne
                  - paragraph [ref=f5e211]:
                    - generic [ref=f5e212]:
                      - generic [ref=f5e213]: Dès
                      - generic [ref=f5e214]: 25 000 F CFA
            - listitem [ref=f5e215]:
              - article [ref=f5e216]:
                - generic [ref=f5e217]:
                  - generic: En cours
                  - 'button "Mettre en favori : Festival Jazz sur le Fleuve" [ref=f5e218] [cursor=pointer]'
                - generic [ref=f5e221]:
                  - paragraph [ref=f5e222]: Festivals
                  - heading [level=3] [ref=f5e223]:
                    - link "Festival Jazz sur le Fleuve" [ref=f5e224] [cursor=pointer]:
                      - /url: /events/86d2de75-6383-4ac0-9866-48d7349f1d5f
                  - paragraph [ref=f5e225]:
                    - generic [ref=f5e228]: ven. 4 déc. · 18:00
                  - paragraph [ref=f5e229]: Saint-Louis
                  - paragraph [ref=f5e230]:
                    - generic [ref=f5e231]:
                      - generic [ref=f5e232]: Dès
                      - generic [ref=f5e233]: 7 500 F CFA
            - listitem [ref=f5e234]:
              - article [ref=f5e235]:
                - generic [ref=f5e236]:
                  - generic: En cours
                  - 'button "Mettre en favori : Soirée Kora & Lumières" [ref=f5e237] [cursor=pointer]'
                - generic [ref=f5e240]:
                  - paragraph [ref=f5e241]: Concerts & Musique
                  - heading [level=3] [ref=f5e242]:
                    - link "Soirée Kora & Lumières" [ref=f5e243] [cursor=pointer]:
                      - /url: /events/0650bd8c-fecd-43a8-9f80-5fca2f2b0989
                  - paragraph [ref=f5e244]:
                    - generic [ref=f5e247]: mer. 9 déc. · 20:30
                  - paragraph [ref=f5e248]: Dakar
                  - paragraph [ref=f5e249]:
                    - generic [ref=f5e250]:
                      - generic [ref=f5e251]: Dès
                      - generic [ref=f5e252]: 6 000 F CFA
            - listitem [ref=f5e253]:
              - article [ref=f5e254]:
                - generic [ref=f5e255]:
                  - generic: En cours
                  - 'button "Mettre en favori : TEST Spectacle B (publié, à venir)" [ref=f5e256] [cursor=pointer]'
                - generic [ref=f5e259]:
                  - paragraph [ref=f5e260]: Concerts & Musique
                  - heading [level=3] [ref=f5e261]:
                    - link "TEST Spectacle B (publié, à venir)" [ref=f5e262] [cursor=pointer]:
                      - /url: /events/8755d8fe-51ff-4119-be63-7cb9f9617c8a
                  - paragraph [ref=f5e263]:
                    - generic [ref=f5e266]: sam. 12 déc. · 20:00
                  - paragraph [ref=f5e267]: Dakar
                  - paragraph [ref=f5e268]:
                    - generic [ref=f5e269]:
                      - generic [ref=f5e270]: Dès
                      - generic [ref=f5e271]: 4 000 F CFA
            - listitem [ref=f5e272]:
              - article [ref=f5e273]:
                - generic [ref=f5e274]:
                  - generic: En cours
                  - 'button "Mettre en favori : Gala des entrepreneurs du Saloum" [ref=f5e275] [cursor=pointer]'
                - generic [ref=f5e278]:
                  - paragraph [ref=f5e279]: Salles & Réceptions
                  - heading [level=3] [ref=f5e280]:
                    - link "Gala des entrepreneurs du Saloum" [ref=f5e281] [cursor=pointer]:
                      - /url: /events/2367f2a9-ac39-483d-8fc9-3f7794147e8e
                  - paragraph [ref=f5e282]:
                    - generic [ref=f5e285]: dim. 13 déc. · 19:30
                  - paragraph [ref=f5e286]: Kaolack
                  - paragraph [ref=f5e287]:
                    - generic [ref=f5e288]:
                      - generic [ref=f5e289]: Dès
                      - generic [ref=f5e290]: 10 000 F CFA
            - listitem [ref=f5e291]:
              - article [ref=f5e292]:
                - generic [ref=f5e293]:
                  - generic: En cours
                  - 'button "Mettre en favori : Festival des rythmes de Casamance" [ref=f5e294] [cursor=pointer]'
                - generic [ref=f5e297]:
                  - paragraph [ref=f5e298]: Festivals
                  - heading [level=3] [ref=f5e299]:
                    - link "Festival des rythmes de Casamance" [ref=f5e300] [cursor=pointer]:
                      - /url: /events/b39c825b-f934-486a-bf47-3ddb14ba004e
                  - paragraph [ref=f5e301]:
                    - generic [ref=f5e304]: ven. 18 déc. · 17:00
                  - paragraph [ref=f5e305]: Ziguinchor
                  - paragraph [ref=f5e306]:
                    - generic [ref=f5e307]:
                      - generic [ref=f5e308]: Dès
                      - generic [ref=f5e309]: 5 000 F CFA
            - listitem [ref=f5e310]:
              - article [ref=f5e311]:
                - generic [ref=f5e312]:
                  - generic: En cours
                  - 'button "Mettre en favori : Carnaval des enfants de Saly" [ref=f5e313] [cursor=pointer]'
                - generic [ref=f5e316]:
                  - paragraph [ref=f5e317]: Festivals
                  - heading [level=3] [ref=f5e318]:
                    - link "Carnaval des enfants de Saly" [ref=f5e319] [cursor=pointer]:
                      - /url: /events/b871babb-7dd4-48cc-952a-6d6e24f4e8cc
                  - paragraph [ref=f5e320]:
                    - generic [ref=f5e323]: mar. 22 déc. · 15:00
                  - paragraph [ref=f5e324]: Saly
                  - paragraph [ref=f5e325]:
                    - generic [ref=f5e326]:
                      - generic [ref=f5e327]: Dès
                      - generic [ref=f5e328]: 2 000 F CFA
          - link "Voir plus d’événements" [ref=f5e330] [cursor=pointer]:
            - /url: /explore?page=2
  - alert [ref=f5e332]
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