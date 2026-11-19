# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> sombre · anonyme >> explorer — Explorer
- Location: e2e/responsive.spec.ts:69:21

# Error details

```
Error: contrôles responsive de explorer (sombre)

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "768 px : textes qui se chevauchent : span.hidden.whitespace-nowrap « Event Village » sur span.truncate « Rechercher un événement, un concert, un restaurant » (46×18 px)",
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
        - generic [ref=f2e10]:
          - paragraph [ref=f2e11]: Menu principal
          - generic [ref=f2e12]:
            - link "Accueil" [ref=f2e13] [cursor=pointer]:
              - /url: /
            - link "Explorer" [ref=f2e18] [cursor=pointer]:
              - /url: /explore
            - link "Mes billets" [ref=f2e23] [cursor=pointer]:
              - /url: /tickets
            - link "Portefeuille" [ref=f2e27] [cursor=pointer]:
              - /url: /wallet
        - generic [ref=f2e32]:
          - paragraph [ref=f2e33]: Espaces métier
          - link "Devenir partenaire" [ref=f2e35] [cursor=pointer]:
            - /url: /partner/register
      - generic [ref=f2e41]:
        - link "Se connecter" [ref=f2e42] [cursor=pointer]:
          - /url: /login
        - button "Basculer le thème" [pressed] [ref=f2e48] [cursor=pointer]
    - generic [ref=f2e56]:
      - banner [ref=f2e57]:
        - link "Rechercher un événement, un concert, un restaurant…" [ref=f2e59] [cursor=pointer]:
          - /url: /explore
        - button "Notifications" [ref=f2e66] [cursor=pointer]
      - main [ref=f2e70]:
        - generic [ref=f2e72]:
          - generic [ref=f2e74]:
            - generic [ref=f2e75]:
              - heading "Explorer les événements" [level=1] [ref=f2e76]
              - paragraph [ref=f2e77]: Concerts, festivals, soirées et rencontres à venir au Sénégal. La liste se met à jour d’elle-même.
            - status [ref=f2e79]: En direct
          - region "Recherche et filtres" [ref=f2e81]:
            - generic [ref=f2e83]:
              - generic [ref=f2e84]: Rechercher un événement
              - searchbox "Rechercher un événement" [ref=f2e86]
            - group "Date et prix" [ref=f2e87]:
              - button "Aujourd’hui" [ref=f2e88] [cursor=pointer]
              - button "Ce week-end" [ref=f2e89] [cursor=pointer]
              - button "Cette semaine" [ref=f2e90] [cursor=pointer]
              - button "Gratuit" [ref=f2e91] [cursor=pointer]
            - group "Catégorie" [ref=f2e92]:
              - button "Toutes les catégories" [pressed] [ref=f2e93] [cursor=pointer]:
                - generic [aria-hidden] [ref=f2e94]: ✓
                - text: Toutes les catégories
              - button "Concerts & Musique" [ref=f2e95] [cursor=pointer]
              - button "Festivals" [ref=f2e96] [cursor=pointer]
              - button "Gastronomie & Tables" [ref=f2e97] [cursor=pointer]
              - button "Salles & Réceptions" [ref=f2e98] [cursor=pointer]
            - generic [ref=f2e99]:
              - generic [ref=f2e100]:
                - generic [ref=f2e101]: Ville
                - combobox "Ville" [ref=f2e104] [cursor=pointer]:
                  - option "Toutes les villes" [selected]
                  - option "Dakar"
                  - option "Foundiougne"
                  - option "Gorée"
                  - option "Kaolack"
                  - option "Mbour"
                  - option "Saint-Louis"
                  - option "Saly"
                  - option "Ziguinchor"
              - generic [ref=f2e105]:
                - generic [ref=f2e106]: Trier par
                - combobox "Trier par" [ref=f2e109] [cursor=pointer]:
                  - option "Date la plus proche" [selected]
                  - option "Prix croissant"
          - region [ref=f2e110]:
            - heading "12 événements" [level=2] [ref=f2e112]
            - list [ref=f2e113]:
              - listitem [ref=f2e114]:
                - article [ref=f2e115]:
                  - generic [ref=f2e116]:
                    - generic: En cours
                    - generic [aria-hidden] [ref=f2e117]:
                      - generic [ref=f2e118]: "19"
                      - generic [ref=f2e119]: NOV
                  - generic [ref=f2e120]:
                    - paragraph [ref=f2e121]: Baobab Scène
                    - heading [level=3] [ref=f2e122]:
                      - link "Nuit du Sabar — édition d’automne" [ref=f2e123] [cursor=pointer]:
                        - /url: /events/1b6b9b15-31a6-41c3-856d-f27700d91f21
                    - paragraph [ref=f2e124]:
                      - generic [ref=f2e127]: jeu. 19 nov. · 11:30
                    - paragraph [ref=f2e128]:
                      - generic [ref=f2e132]: Dakar · Esplanade de la Corniche Ouest
                    - generic [ref=f2e133]: Concerts & Musique
                    - paragraph [ref=f2e136]:
                      - generic [ref=f2e137]: Dès
                      - generic [ref=f2e138]: 5 000 F CFA
              - listitem [ref=f2e139]:
                - article [ref=f2e140]:
                  - generic [ref=f2e141]:
                    - generic: En cours
                    - generic [aria-hidden] [ref=f2e142]:
                      - generic [ref=f2e143]: "20"
                      - generic [ref=f2e144]: NOV
                  - generic [ref=f2e145]:
                    - paragraph [ref=f2e146]: Baobab Scène
                    - heading [level=3] [ref=f2e147]:
                      - link "Concert des Lumières de Gorée" [ref=f2e148] [cursor=pointer]:
                        - /url: /events/3e0f741a-d31d-4cde-af85-7cca6884a434
                    - paragraph [ref=f2e149]:
                      - generic [ref=f2e152]: ven. 20 nov. · 06:45
                    - paragraph [ref=f2e153]:
                      - generic [ref=f2e157]: Gorée · Place du Gouvernement
                    - generic [ref=f2e158]: Concerts & Musique
                    - paragraph [ref=f2e161]:
                      - generic [ref=f2e162]: Dès
                      - generic [ref=f2e163]: 6 000 F CFA
              - listitem [ref=f2e164]:
                - article [ref=f2e165]:
                  - generic [ref=f2e166]:
                    - generic: En cours
                    - generic [aria-hidden] [ref=f2e167]:
                      - generic [ref=f2e168]: "20"
                      - generic [ref=f2e169]: NOV
                  - generic [ref=f2e170]:
                    - paragraph [ref=f2e171]: Saloum Culture
                    - heading [level=3] [ref=f2e172]:
                      - link "Nuit du slam de Kaolack" [ref=f2e173] [cursor=pointer]:
                        - /url: /events/3a49764e-0398-4710-9551-0d00aeb9d709
                    - paragraph [ref=f2e174]:
                      - generic [ref=f2e177]: ven. 20 nov. · 21:00
                    - paragraph [ref=f2e178]:
                      - generic [ref=f2e182]: Kaolack · Centre culturel régional
                    - generic [ref=f2e183]:
                      - generic [ref=f2e184]: Dernières places
                      - generic [ref=f2e186]: Concerts & Musique
                    - paragraph [ref=f2e188]:
                      - generic [ref=f2e189]: Dès
                      - generic [ref=f2e190]: 3 000 F CFA
              - listitem [ref=f2e191]:
                - article [ref=f2e192]:
                  - generic [ref=f2e193]:
                    - generic: En cours
                    - generic [aria-hidden] [ref=f2e194]:
                      - generic [ref=f2e195]: "24"
                      - generic [ref=f2e196]: NOV
                  - generic [ref=f2e197]:
                    - paragraph [ref=f2e198]: Petite-Côte Événements
                    - heading [level=3] [ref=f2e199]:
                      - link "Marché gourmand de la Petite-Côte" [ref=f2e200] [cursor=pointer]:
                        - /url: /events/443f461a-20fa-48ca-8fb2-0e78e955a227
                    - paragraph [ref=f2e201]:
                      - generic [ref=f2e204]: mar. 24 nov. · 10:00
                    - paragraph [ref=f2e205]:
                      - generic [ref=f2e209]: Mbour · Place du Marché Central
                    - generic [ref=f2e210]: Gastronomie & Tables
                    - paragraph [ref=f2e213]:
                      - generic [ref=f2e214]: Dès
                      - generic [ref=f2e215]: 1 000 F CFA
              - listitem [ref=f2e216]:
                - article [ref=f2e217]:
                  - generic [ref=f2e218]:
                    - generic: En cours
                    - generic [aria-hidden] [ref=f2e219]:
                      - generic [ref=f2e220]: "27"
                      - generic [ref=f2e221]: NOV
                  - generic [ref=f2e222]:
                    - paragraph [ref=f2e223]: Saloum Culture
                    - heading [level=3] [ref=f2e224]:
                      - link "Dîner-spectacle au bord du Saloum" [ref=f2e225] [cursor=pointer]:
                        - /url: /events/2aec4c3d-87ae-459b-bdeb-3592df1949ae
                    - paragraph [ref=f2e226]:
                      - generic [ref=f2e229]: ven. 27 nov. · 20:00
                    - paragraph [ref=f2e230]:
                      - generic [ref=f2e234]: Foundiougne · Terrasse des Pirogues
                    - generic [ref=f2e235]: Salles & Réceptions
                    - paragraph [ref=f2e238]:
                      - generic [ref=f2e239]: Dès
                      - generic [ref=f2e240]: 25 000 F CFA
              - listitem [ref=f2e241]:
                - article [ref=f2e242]:
                  - generic [ref=f2e243]:
                    - generic: En cours
                    - generic [aria-hidden] [ref=f2e244]:
                      - generic [ref=f2e245]: "01"
                      - generic [ref=f2e246]: DÉC
                  - generic [ref=f2e247]:
                    - paragraph [ref=f2e248]: Baobab Scène
                    - heading [level=3] [ref=f2e249]:
                      - link "Festival Jazz sur le Fleuve" [ref=f2e250] [cursor=pointer]:
                        - /url: /events/cbf928d9-6a7a-4bcf-822d-29f5e71c0fbe
                    - paragraph [ref=f2e251]:
                      - generic [ref=f2e254]: mar. 1 déc. · 18:00
                    - paragraph [ref=f2e255]:
                      - generic [ref=f2e259]: Saint-Louis · Quai des Pêcheurs
                    - generic [ref=f2e260]: Festivals
                    - paragraph [ref=f2e263]:
                      - generic [ref=f2e264]: Dès
                      - generic [ref=f2e265]: 7 500 F CFA
              - listitem [ref=f2e266]:
                - article [ref=f2e267]:
                  - generic [ref=f2e268]:
                    - generic: En cours
                    - generic [aria-hidden] [ref=f2e269]:
                      - generic [ref=f2e270]: "06"
                      - generic [ref=f2e271]: DÉC
                  - generic [ref=f2e272]:
                    - paragraph [ref=f2e273]: Baobab Scène
                    - heading [level=3] [ref=f2e274]:
                      - link "Soirée Kora & Lumières" [ref=f2e275] [cursor=pointer]:
                        - /url: /events/51729819-f190-4aed-8679-5f33482543fa
                    - paragraph [ref=f2e276]:
                      - generic [ref=f2e279]: dim. 6 déc. · 20:30
                    - paragraph [ref=f2e280]:
                      - generic [ref=f2e284]: Dakar · Jardin de la Maison des Arts
                    - generic [ref=f2e285]: Concerts & Musique
                    - paragraph [ref=f2e288]:
                      - generic [ref=f2e289]: Dès
                      - generic [ref=f2e290]: 6 000 F CFA
              - listitem [ref=f2e291]:
                - article [ref=f2e292]:
                  - generic [ref=f2e293]:
                    - generic: En cours
                    - generic [aria-hidden] [ref=f2e294]:
                      - generic [ref=f2e295]: "09"
                      - generic [ref=f2e296]: DÉC
                  - generic [ref=f2e297]:
                    - paragraph [ref=f2e298]: Orga B (test)
                    - heading [level=3] [ref=f2e299]:
                      - link "TEST Spectacle B (publié, à venir)" [ref=f2e300] [cursor=pointer]:
                        - /url: /events/df279e21-74ce-4986-bbaa-4e51524a33a7
                    - paragraph [ref=f2e301]:
                      - generic [ref=f2e304]: mer. 9 déc. · 20:00
                    - paragraph [ref=f2e305]:
                      - generic [ref=f2e309]: Dakar · Salle de test, Dakar
                    - generic [ref=f2e310]: Concerts & Musique
                    - paragraph [ref=f2e313]:
                      - generic [ref=f2e314]: Dès
                      - generic [ref=f2e315]: 4 000 F CFA
              - listitem [ref=f2e316]:
                - article [ref=f2e317]:
                  - generic [ref=f2e318]:
                    - generic: En cours
                    - generic [aria-hidden] [ref=f2e319]:
                      - generic [ref=f2e320]: "10"
                      - generic [ref=f2e321]: DÉC
                  - generic [ref=f2e322]:
                    - paragraph [ref=f2e323]: Saloum Culture
                    - heading [level=3] [ref=f2e324]:
                      - link "Gala des entrepreneurs du Saloum" [ref=f2e325] [cursor=pointer]:
                        - /url: /events/7ca533ac-74ae-4832-9915-bd2e9b953dba
                    - paragraph [ref=f2e326]:
                      - generic [ref=f2e329]: jeu. 10 déc. · 19:30
                    - paragraph [ref=f2e330]:
                      - generic [ref=f2e334]: Kaolack · Salle des Palétuviers
                    - generic [ref=f2e335]: Salles & Réceptions
                    - paragraph [ref=f2e338]:
                      - generic [ref=f2e339]: Dès
                      - generic [ref=f2e340]: 10 000 F CFA
              - listitem [ref=f2e341]:
                - article [ref=f2e342]:
                  - generic [ref=f2e343]:
                    - generic: En cours
                    - generic [aria-hidden] [ref=f2e344]:
                      - generic [ref=f2e345]: "15"
                      - generic [ref=f2e346]: DÉC
                  - generic [ref=f2e347]:
                    - paragraph [ref=f2e348]: Petite-Côte Événements
                    - heading [level=3] [ref=f2e349]:
                      - link "Festival des rythmes de Casamance" [ref=f2e350] [cursor=pointer]:
                        - /url: /events/cc1135a5-96d5-4d4d-ac8f-0ff8c6cf3ce6
                    - paragraph [ref=f2e351]:
                      - generic [ref=f2e354]: mar. 15 déc. · 17:00
                    - paragraph [ref=f2e355]:
                      - generic [ref=f2e359]: Ziguinchor · Esplanade du Port
                    - generic [ref=f2e360]: Festivals
                    - paragraph [ref=f2e363]:
                      - generic [ref=f2e364]: Dès
                      - generic [ref=f2e365]: 5 000 F CFA
              - listitem [ref=f2e366]:
                - article [ref=f2e367]:
                  - generic [ref=f2e368]:
                    - generic: En cours
                    - generic [aria-hidden] [ref=f2e369]:
                      - generic [ref=f2e370]: "19"
                      - generic [ref=f2e371]: DÉC
                  - generic [ref=f2e372]:
                    - paragraph [ref=f2e373]: Petite-Côte Événements
                    - heading [level=3] [ref=f2e374]:
                      - link "Carnaval des enfants de Saly" [ref=f2e375] [cursor=pointer]:
                        - /url: /events/bcfd2b46-6d47-44f0-be8a-df3ed43885b3
                    - paragraph [ref=f2e376]:
                      - generic [ref=f2e379]: sam. 19 déc. · 15:00
                    - paragraph [ref=f2e380]:
                      - generic [ref=f2e384]: Saly · Promenade des Filaos
                    - generic [ref=f2e385]: Festivals
                    - paragraph [ref=f2e388]:
                      - generic [ref=f2e389]: Dès
                      - generic [ref=f2e390]: 2 000 F CFA
              - listitem [ref=f2e391]:
                - article [ref=f2e392]:
                  - generic [ref=f2e393]:
                    - generic: En cours
                    - generic [aria-hidden] [ref=f2e394]:
                      - generic [ref=f2e395]: "19"
                      - generic [ref=f2e396]: DÉC
                  - generic [ref=f2e397]:
                    - paragraph [ref=f2e398]: Orga A (test)
                    - heading [level=3] [ref=f2e399]:
                      - link "TEST Concert A (publié, à venir)" [ref=f2e400] [cursor=pointer]:
                        - /url: /events/8f0777ab-7940-42ea-abd8-e948c4b2e4a9
                    - paragraph [ref=f2e401]:
                      - generic [ref=f2e404]: sam. 19 déc. · 20:00
                    - paragraph [ref=f2e405]:
                      - generic [ref=f2e409]: Dakar · Salle de test, Dakar
                    - generic [ref=f2e410]: Concerts & Musique
                    - paragraph [ref=f2e413]:
                      - generic [ref=f2e414]: Dès
                      - generic [ref=f2e415]: 5 000 F CFA
  - alert [ref=f2e416]
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
      |                                                                                        ^ Error: contrôles responsive de explorer (sombre)
  107 |                 });
  108 |             }
  109 |         });
  110 |     }
  111 | }
  112 | 
```