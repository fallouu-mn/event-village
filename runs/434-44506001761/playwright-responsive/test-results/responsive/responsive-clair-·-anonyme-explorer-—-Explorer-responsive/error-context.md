# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> clair · anonyme >> explorer — Explorer
- Location: e2e/responsive.spec.ts:69:21

# Error details

```
Error: contrôles responsive de explorer (clair)

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 5

- Array []
+ Array [
+   "320 px : texte hors de l’écran : span.truncate « Dakar · Esplanade de la Corniche Ouest » de 57 à 321 px (fenêtre 320 px)",
+   "320 px : texte tronqué sans le texte entier : span.truncate « Dakar · Esplanade de la Corniche Ouest » (points de suspension, texte entier absent) ; span.truncate « Foundiougne · Terrasse des Pirogues » (points de suspension, texte entier absent) ; span.truncate « Dakar · Jardin de la Maison des Arts » (points de suspension, texte entier absent)",
+   "768 px : textes qui se chevauchent : span.hidden.whitespace-nowrap « Event Village » sur span.truncate « Rechercher un événement, un concert, un restaurant » (46×18 px)",
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
          - paragraph [ref=f5e11]: Menu principal
          - generic [ref=f5e12]:
            - link "Accueil" [ref=f5e13] [cursor=pointer]:
              - /url: /
            - link "Explorer" [ref=f5e18] [cursor=pointer]:
              - /url: /explore
            - link "Mes billets" [ref=f5e23] [cursor=pointer]:
              - /url: /tickets
            - link "Portefeuille" [ref=f5e27] [cursor=pointer]:
              - /url: /wallet
        - generic [ref=f5e32]:
          - paragraph [ref=f5e33]: Espaces métier
          - link "Devenir partenaire" [ref=f5e35] [cursor=pointer]:
            - /url: /partner/register
      - generic [ref=f5e41]:
        - link "Se connecter" [ref=f5e42] [cursor=pointer]:
          - /url: /login
        - button "Basculer le thème" [ref=f5e48] [cursor=pointer]
    - generic [ref=f5e52]:
      - banner [ref=f5e53]:
        - link "Rechercher un événement, un concert, un restaurant…" [ref=f5e55] [cursor=pointer]:
          - /url: /explore
        - button "Notifications" [ref=f5e62] [cursor=pointer]
      - main [ref=f5e66]:
        - generic [ref=f5e68]:
          - generic [ref=f5e70]:
            - generic [ref=f5e71]:
              - heading "Explorer les événements" [level=1] [ref=f5e72]
              - paragraph [ref=f5e73]: Concerts, festivals, soirées et rencontres à venir au Sénégal. La liste se met à jour d’elle-même.
            - status [ref=f5e75]: En direct
          - region "Recherche et filtres" [ref=f5e77]:
            - generic [ref=f5e79]:
              - generic [ref=f5e80]: Rechercher un événement
              - searchbox "Rechercher un événement" [ref=f5e82]
            - group "Date et prix" [ref=f5e83]:
              - button "Aujourd’hui" [ref=f5e84] [cursor=pointer]
              - button "Ce week-end" [ref=f5e85] [cursor=pointer]
              - button "Cette semaine" [ref=f5e86] [cursor=pointer]
              - button "Gratuit" [ref=f5e87] [cursor=pointer]
            - group "Catégorie" [ref=f5e88]:
              - button "Toutes les catégories" [pressed] [ref=f5e89] [cursor=pointer]:
                - generic [aria-hidden] [ref=f5e90]: ✓
                - text: Toutes les catégories
              - button "Concerts & Musique" [ref=f5e91] [cursor=pointer]
              - button "Festivals" [ref=f5e92] [cursor=pointer]
              - button "Gastronomie & Tables" [ref=f5e93] [cursor=pointer]
              - button "Salles & Réceptions" [ref=f5e94] [cursor=pointer]
            - generic [ref=f5e95]:
              - generic [ref=f5e96]:
                - generic [ref=f5e97]: Ville
                - combobox "Ville" [ref=f5e100] [cursor=pointer]:
                  - option "Toutes les villes" [selected]
                  - option "Dakar"
                  - option "Foundiougne"
                  - option "Gorée"
                  - option "Kaolack"
                  - option "Mbour"
                  - option "Saint-Louis"
                  - option "Saly"
                  - option "Ziguinchor"
              - generic [ref=f5e101]:
                - generic [ref=f5e102]: Trier par
                - combobox "Trier par" [ref=f5e105] [cursor=pointer]:
                  - option "Date la plus proche" [selected]
                  - option "Prix croissant"
          - region [ref=f5e106]:
            - heading "12 événements" [level=2] [ref=f5e108]
            - list [ref=f5e109]:
              - listitem [ref=f5e110]:
                - article [ref=f5e111]:
                  - generic [ref=f5e112]:
                    - generic: En cours
                    - generic [aria-hidden] [ref=f5e113]:
                      - generic [ref=f5e114]: "19"
                      - generic [ref=f5e115]: NOV
                  - generic [ref=f5e116]:
                    - paragraph [ref=f5e117]: Baobab Scène
                    - heading [level=3] [ref=f5e118]:
                      - link "Nuit du Sabar — édition d’automne" [ref=f5e119] [cursor=pointer]:
                        - /url: /events/1b6b9b15-31a6-41c3-856d-f27700d91f21
                    - paragraph [ref=f5e120]:
                      - generic [ref=f5e123]: jeu. 19 nov. · 11:30
                    - paragraph [ref=f5e124]:
                      - generic [ref=f5e128]: Dakar · Esplanade de la Corniche Ouest
                    - generic [ref=f5e129]: Concerts & Musique
                    - paragraph [ref=f5e132]:
                      - generic [ref=f5e133]: Dès
                      - generic [ref=f5e134]: 5 000 F CFA
              - listitem [ref=f5e135]:
                - article [ref=f5e136]:
                  - generic [ref=f5e137]:
                    - generic: En cours
                    - generic [aria-hidden] [ref=f5e138]:
                      - generic [ref=f5e139]: "20"
                      - generic [ref=f5e140]: NOV
                  - generic [ref=f5e141]:
                    - paragraph [ref=f5e142]: Baobab Scène
                    - heading [level=3] [ref=f5e143]:
                      - link "Concert des Lumières de Gorée" [ref=f5e144] [cursor=pointer]:
                        - /url: /events/3e0f741a-d31d-4cde-af85-7cca6884a434
                    - paragraph [ref=f5e145]:
                      - generic [ref=f5e148]: ven. 20 nov. · 06:45
                    - paragraph [ref=f5e149]:
                      - generic [ref=f5e153]: Gorée · Place du Gouvernement
                    - generic [ref=f5e154]: Concerts & Musique
                    - paragraph [ref=f5e157]:
                      - generic [ref=f5e158]: Dès
                      - generic [ref=f5e159]: 6 000 F CFA
              - listitem [ref=f5e160]:
                - article [ref=f5e161]:
                  - generic [ref=f5e162]:
                    - generic: En cours
                    - generic [aria-hidden] [ref=f5e163]:
                      - generic [ref=f5e164]: "20"
                      - generic [ref=f5e165]: NOV
                  - generic [ref=f5e166]:
                    - paragraph [ref=f5e167]: Saloum Culture
                    - heading [level=3] [ref=f5e168]:
                      - link "Nuit du slam de Kaolack" [ref=f5e169] [cursor=pointer]:
                        - /url: /events/3a49764e-0398-4710-9551-0d00aeb9d709
                    - paragraph [ref=f5e170]:
                      - generic [ref=f5e173]: ven. 20 nov. · 21:00
                    - paragraph [ref=f5e174]:
                      - generic [ref=f5e178]: Kaolack · Centre culturel régional
                    - generic [ref=f5e179]:
                      - generic [ref=f5e180]: Dernières places
                      - generic [ref=f5e182]: Concerts & Musique
                    - paragraph [ref=f5e184]:
                      - generic [ref=f5e185]: Dès
                      - generic [ref=f5e186]: 3 000 F CFA
              - listitem [ref=f5e187]:
                - article [ref=f5e188]:
                  - generic [ref=f5e189]:
                    - generic: En cours
                    - generic [aria-hidden] [ref=f5e190]:
                      - generic [ref=f5e191]: "24"
                      - generic [ref=f5e192]: NOV
                  - generic [ref=f5e193]:
                    - paragraph [ref=f5e194]: Petite-Côte Événements
                    - heading [level=3] [ref=f5e195]:
                      - link "Marché gourmand de la Petite-Côte" [ref=f5e196] [cursor=pointer]:
                        - /url: /events/443f461a-20fa-48ca-8fb2-0e78e955a227
                    - paragraph [ref=f5e197]:
                      - generic [ref=f5e200]: mar. 24 nov. · 10:00
                    - paragraph [ref=f5e201]:
                      - generic [ref=f5e205]: Mbour · Place du Marché Central
                    - generic [ref=f5e206]: Gastronomie & Tables
                    - paragraph [ref=f5e209]:
                      - generic [ref=f5e210]: Dès
                      - generic [ref=f5e211]: 1 000 F CFA
              - listitem [ref=f5e212]:
                - article [ref=f5e213]:
                  - generic [ref=f5e214]:
                    - generic: En cours
                    - generic [aria-hidden] [ref=f5e215]:
                      - generic [ref=f5e216]: "27"
                      - generic [ref=f5e217]: NOV
                  - generic [ref=f5e218]:
                    - paragraph [ref=f5e219]: Saloum Culture
                    - heading [level=3] [ref=f5e220]:
                      - link "Dîner-spectacle au bord du Saloum" [ref=f5e221] [cursor=pointer]:
                        - /url: /events/2aec4c3d-87ae-459b-bdeb-3592df1949ae
                    - paragraph [ref=f5e222]:
                      - generic [ref=f5e225]: ven. 27 nov. · 20:00
                    - paragraph [ref=f5e226]:
                      - generic [ref=f5e230]: Foundiougne · Terrasse des Pirogues
                    - generic [ref=f5e231]: Salles & Réceptions
                    - paragraph [ref=f5e234]:
                      - generic [ref=f5e235]: Dès
                      - generic [ref=f5e236]: 25 000 F CFA
              - listitem [ref=f5e237]:
                - article [ref=f5e238]:
                  - generic [ref=f5e239]:
                    - generic: En cours
                    - generic [aria-hidden] [ref=f5e240]:
                      - generic [ref=f5e241]: "01"
                      - generic [ref=f5e242]: DÉC
                  - generic [ref=f5e243]:
                    - paragraph [ref=f5e244]: Baobab Scène
                    - heading [level=3] [ref=f5e245]:
                      - link "Festival Jazz sur le Fleuve" [ref=f5e246] [cursor=pointer]:
                        - /url: /events/cbf928d9-6a7a-4bcf-822d-29f5e71c0fbe
                    - paragraph [ref=f5e247]:
                      - generic [ref=f5e250]: mar. 1 déc. · 18:00
                    - paragraph [ref=f5e251]:
                      - generic [ref=f5e255]: Saint-Louis · Quai des Pêcheurs
                    - generic [ref=f5e256]: Festivals
                    - paragraph [ref=f5e259]:
                      - generic [ref=f5e260]: Dès
                      - generic [ref=f5e261]: 7 500 F CFA
              - listitem [ref=f5e262]:
                - article [ref=f5e263]:
                  - generic [ref=f5e264]:
                    - generic: En cours
                    - generic [aria-hidden] [ref=f5e265]:
                      - generic [ref=f5e266]: "06"
                      - generic [ref=f5e267]: DÉC
                  - generic [ref=f5e268]:
                    - paragraph [ref=f5e269]: Baobab Scène
                    - heading [level=3] [ref=f5e270]:
                      - link "Soirée Kora & Lumières" [ref=f5e271] [cursor=pointer]:
                        - /url: /events/51729819-f190-4aed-8679-5f33482543fa
                    - paragraph [ref=f5e272]:
                      - generic [ref=f5e275]: dim. 6 déc. · 20:30
                    - paragraph [ref=f5e276]:
                      - generic [ref=f5e280]: Dakar · Jardin de la Maison des Arts
                    - generic [ref=f5e281]: Concerts & Musique
                    - paragraph [ref=f5e284]:
                      - generic [ref=f5e285]: Dès
                      - generic [ref=f5e286]: 6 000 F CFA
              - listitem [ref=f5e287]:
                - article [ref=f5e288]:
                  - generic [ref=f5e289]:
                    - generic: En cours
                    - generic [aria-hidden] [ref=f5e290]:
                      - generic [ref=f5e291]: "09"
                      - generic [ref=f5e292]: DÉC
                  - generic [ref=f5e293]:
                    - paragraph [ref=f5e294]: Orga B (test)
                    - heading [level=3] [ref=f5e295]:
                      - link "TEST Spectacle B (publié, à venir)" [ref=f5e296] [cursor=pointer]:
                        - /url: /events/df279e21-74ce-4986-bbaa-4e51524a33a7
                    - paragraph [ref=f5e297]:
                      - generic [ref=f5e300]: mer. 9 déc. · 20:00
                    - paragraph [ref=f5e301]:
                      - generic [ref=f5e305]: Dakar · Salle de test, Dakar
                    - generic [ref=f5e306]: Concerts & Musique
                    - paragraph [ref=f5e309]:
                      - generic [ref=f5e310]: Dès
                      - generic [ref=f5e311]: 4 000 F CFA
              - listitem [ref=f5e312]:
                - article [ref=f5e313]:
                  - generic [ref=f5e314]:
                    - generic: En cours
                    - generic [aria-hidden] [ref=f5e315]:
                      - generic [ref=f5e316]: "10"
                      - generic [ref=f5e317]: DÉC
                  - generic [ref=f5e318]:
                    - paragraph [ref=f5e319]: Saloum Culture
                    - heading [level=3] [ref=f5e320]:
                      - link "Gala des entrepreneurs du Saloum" [ref=f5e321] [cursor=pointer]:
                        - /url: /events/7ca533ac-74ae-4832-9915-bd2e9b953dba
                    - paragraph [ref=f5e322]:
                      - generic [ref=f5e325]: jeu. 10 déc. · 19:30
                    - paragraph [ref=f5e326]:
                      - generic [ref=f5e330]: Kaolack · Salle des Palétuviers
                    - generic [ref=f5e331]: Salles & Réceptions
                    - paragraph [ref=f5e334]:
                      - generic [ref=f5e335]: Dès
                      - generic [ref=f5e336]: 10 000 F CFA
              - listitem [ref=f5e337]:
                - article [ref=f5e338]:
                  - generic [ref=f5e339]:
                    - generic: En cours
                    - generic [aria-hidden] [ref=f5e340]:
                      - generic [ref=f5e341]: "15"
                      - generic [ref=f5e342]: DÉC
                  - generic [ref=f5e343]:
                    - paragraph [ref=f5e344]: Petite-Côte Événements
                    - heading [level=3] [ref=f5e345]:
                      - link "Festival des rythmes de Casamance" [ref=f5e346] [cursor=pointer]:
                        - /url: /events/cc1135a5-96d5-4d4d-ac8f-0ff8c6cf3ce6
                    - paragraph [ref=f5e347]:
                      - generic [ref=f5e350]: mar. 15 déc. · 17:00
                    - paragraph [ref=f5e351]:
                      - generic [ref=f5e355]: Ziguinchor · Esplanade du Port
                    - generic [ref=f5e356]: Festivals
                    - paragraph [ref=f5e359]:
                      - generic [ref=f5e360]: Dès
                      - generic [ref=f5e361]: 5 000 F CFA
              - listitem [ref=f5e362]:
                - article [ref=f5e363]:
                  - generic [ref=f5e364]:
                    - generic: En cours
                    - generic [aria-hidden] [ref=f5e365]:
                      - generic [ref=f5e366]: "19"
                      - generic [ref=f5e367]: DÉC
                  - generic [ref=f5e368]:
                    - paragraph [ref=f5e369]: Petite-Côte Événements
                    - heading [level=3] [ref=f5e370]:
                      - link "Carnaval des enfants de Saly" [ref=f5e371] [cursor=pointer]:
                        - /url: /events/bcfd2b46-6d47-44f0-be8a-df3ed43885b3
                    - paragraph [ref=f5e372]:
                      - generic [ref=f5e375]: sam. 19 déc. · 15:00
                    - paragraph [ref=f5e376]:
                      - generic [ref=f5e380]: Saly · Promenade des Filaos
                    - generic [ref=f5e381]: Festivals
                    - paragraph [ref=f5e384]:
                      - generic [ref=f5e385]: Dès
                      - generic [ref=f5e386]: 2 000 F CFA
              - listitem [ref=f5e387]:
                - article [ref=f5e388]:
                  - generic [ref=f5e389]:
                    - generic: En cours
                    - generic [aria-hidden] [ref=f5e390]:
                      - generic [ref=f5e391]: "19"
                      - generic [ref=f5e392]: DÉC
                  - generic [ref=f5e393]:
                    - paragraph [ref=f5e394]: Orga A (test)
                    - heading [level=3] [ref=f5e395]:
                      - link "TEST Concert A (publié, à venir)" [ref=f5e396] [cursor=pointer]:
                        - /url: /events/8f0777ab-7940-42ea-abd8-e948c4b2e4a9
                    - paragraph [ref=f5e397]:
                      - generic [ref=f5e400]: sam. 19 déc. · 20:00
                    - paragraph [ref=f5e401]:
                      - generic [ref=f5e405]: Dakar · Salle de test, Dakar
                    - generic [ref=f5e406]: Concerts & Musique
                    - paragraph [ref=f5e409]:
                      - generic [ref=f5e410]: Dès
                      - generic [ref=f5e411]: 5 000 F CFA
  - alert [ref=f5e412]
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
      |                                                                                        ^ Error: contrôles responsive de explorer (clair)
  107 |                 });
  108 |             }
  109 |         });
  110 |     }
  111 | }
  112 | 
```