# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · anonyme >> catalogue — Catalogue des événements
- Location: e2e/captures.spec.ts:67:21

# Error details

```
Error: contrôles bloquants de catalogue__mobile__sombre.png

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 5

- Array []
+ Array [
+   "requête en échec : GET localhost:3000/login?redirect=%2Ftickets : net::ERR_ABORTED",
+   "requête en échec : GET localhost:3000/login?redirect=%2Forders : net::ERR_ABORTED",
+   "requête en échec : GET localhost:3000/login?redirect=%2Fwallet : net::ERR_ABORTED",
+ ]
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - generic [ref=e3]:
      - banner [ref=e4]:
        - generic [ref=e5]:
          - button "Ouvrir le menu" [ref=e6] [cursor=pointer]
          - link "Event Village, accueil" [ref=e10] [cursor=pointer]:
            - /url: /
        - generic [ref=e16]:
          - button "Notifications" [ref=e18] [cursor=pointer]
          - button "Basculer le thème" [pressed] [ref=e23] [cursor=pointer]
          - link "Se connecter" [ref=e31] [cursor=pointer]:
            - /url: /login
      - main [ref=e35]:
        - generic [ref=e37]:
          - generic [ref=e39]:
            - generic [ref=e40]:
              - heading "Explorer les événements" [level=1] [ref=e41]
              - paragraph [ref=e42]: Concerts, festivals, soirées et rencontres à venir au Sénégal. La liste se met à jour d’elle-même.
            - status [ref=e44]: En direct
          - region "Recherche et filtres" [ref=e46]:
            - generic [ref=e47]:
              - generic [ref=e49]:
                - generic [ref=e50]: Rechercher un événement
                - searchbox "Rechercher un événement" [ref=e52]
              - generic [ref=e53]:
                - generic [ref=e54]: Ville
                - combobox "Ville" [ref=e57] [cursor=pointer]:
                  - option "Toutes les villes" [selected]
                  - option "Dakar"
                  - option "Foundiougne"
                  - option "Kaolack"
                  - option "Mbour"
                  - option "Saint-Louis"
                  - option "Saly"
                  - option "Ziguinchor"
              - generic [ref=e58]:
                - generic [ref=e59]: Trier par
                - combobox "Trier par" [ref=e62] [cursor=pointer]:
                  - option "Date la plus proche" [selected]
                  - option "Prix croissant"
                  - option "Prix décroissant"
            - group "Catégorie" [ref=e63]:
              - button "Toutes les catégories" [pressed] [ref=e64] [cursor=pointer]
              - button "Concerts & Musique" [ref=e65] [cursor=pointer]
              - button "Festivals" [ref=e66] [cursor=pointer]
              - button "Gastronomie & Tables" [ref=e67] [cursor=pointer]
              - button "Salles & Réceptions" [ref=e68] [cursor=pointer]
          - region [ref=e69]:
            - heading "10 événements" [level=2] [ref=e71]
            - list [ref=e72]:
              - listitem [ref=e73]:
                - article [ref=e74]:
                  - generic [ref=e76]:
                    - generic [ref=e77]:
                      - generic [aria-hidden] [ref=e78]:
                        - generic [ref=e79]: "03"
                        - generic [ref=e80]: NOV
                      - generic [ref=e81]:
                        - paragraph [ref=e82]: Baobab Scène
                        - heading [level=3] [ref=e83]:
                          - link "Nuit du Sabar — édition d’automne" [ref=e84] [cursor=pointer]:
                            - /url: /events/07be8ac0-5ef3-4a3b-9a96-68a6f99946d1
                    - generic [ref=e85]: Concerts & Musique
                    - list [ref=e88]:
                      - listitem [ref=e89]:
                        - generic [ref=e92]: 03 NOV 2026 à 22:45
                      - listitem [ref=e93]:
                        - generic [ref=e97]: Esplanade de la Corniche Ouest, Dakar
                    - generic [ref=e99]:
                      - paragraph [ref=e100]: À partir de
                      - paragraph [ref=e101]: 5 000 F CFA
              - listitem [ref=e105]:
                - article [ref=e106]:
                  - generic [ref=e108]:
                    - generic [ref=e109]:
                      - generic [aria-hidden] [ref=e110]:
                        - generic [ref=e111]: "08"
                        - generic [ref=e112]: NOV
                      - generic [ref=e113]:
                        - paragraph [ref=e114]: Petite-Côte Événements
                        - heading [level=3] [ref=e115]:
                          - link "Marché gourmand de la Petite-Côte" [ref=e116] [cursor=pointer]:
                            - /url: /events/cf411fef-bed9-48ba-ad5c-026ab876568b
                    - generic [ref=e117]: Gastronomie & Tables
                    - list [ref=e120]:
                      - listitem [ref=e121]:
                        - generic [ref=e124]: 08 NOV 2026 à 10:00
                      - listitem [ref=e125]:
                        - generic [ref=e129]: Place du Marché Central, Mbour
                    - generic [ref=e131]:
                      - paragraph [ref=e132]: À partir de
                      - paragraph [ref=e133]: 1 000 F CFA
              - listitem [ref=e137]:
                - article [ref=e138]:
                  - generic [ref=e140]:
                    - generic [ref=e141]:
                      - generic [aria-hidden] [ref=e142]:
                        - generic [ref=e143]: "11"
                        - generic [ref=e144]: NOV
                      - generic [ref=e145]:
                        - paragraph [ref=e146]: Saloum Culture
                        - heading [level=3] [ref=e147]:
                          - link "Dîner-spectacle au bord du Saloum" [ref=e148] [cursor=pointer]:
                            - /url: /events/d5ca7418-064d-4a4f-b642-64ce6ac6886f
                    - generic [ref=e149]: Salles & Réceptions
                    - list [ref=e152]:
                      - listitem [ref=e153]:
                        - generic [ref=e156]: 11 NOV 2026 à 20:00
                      - listitem [ref=e157]:
                        - generic [ref=e161]: Terrasse des Pirogues, Foundiougne
                    - generic [ref=e163]:
                      - paragraph [ref=e164]: À partir de
                      - paragraph [ref=e165]: 25 000 F CFA
              - listitem [ref=e169]:
                - article [ref=e170]:
                  - generic [ref=e172]:
                    - generic [ref=e173]:
                      - generic [aria-hidden] [ref=e174]:
                        - generic [ref=e175]: "15"
                        - generic [ref=e176]: NOV
                      - generic [ref=e177]:
                        - paragraph [ref=e178]: Baobab Scène
                        - heading [level=3] [ref=e179]:
                          - link "Festival Jazz sur le Fleuve" [ref=e180] [cursor=pointer]:
                            - /url: /events/86fb2b08-fef4-4b8e-98b7-b019bd127696
                    - generic [ref=e181]: Festivals
                    - list [ref=e184]:
                      - listitem [ref=e185]:
                        - generic [ref=e188]: 15 NOV 2026 à 18:00
                      - listitem [ref=e189]:
                        - generic [ref=e193]: Quai des Pêcheurs, Saint-Louis
                    - generic [ref=e195]:
                      - paragraph [ref=e196]: À partir de
                      - paragraph [ref=e197]: 7 500 F CFA
              - listitem [ref=e201]:
                - article [ref=e202]:
                  - generic [ref=e204]:
                    - generic [ref=e205]:
                      - generic [aria-hidden] [ref=e206]:
                        - generic [ref=e207]: "20"
                        - generic [ref=e208]: NOV
                      - generic [ref=e209]:
                        - paragraph [ref=e210]: Baobab Scène
                        - heading [level=3] [ref=e211]:
                          - link "Soirée Kora & Lumières" [ref=e212] [cursor=pointer]:
                            - /url: /events/2143ea28-9ab6-4c7d-8aef-e42cec439c44
                    - generic [ref=e213]: Concerts & Musique
                    - list [ref=e216]:
                      - listitem [ref=e217]:
                        - generic [ref=e220]: 20 NOV 2026 à 20:30
                      - listitem [ref=e221]:
                        - generic [ref=e225]: Jardin de la Maison des Arts, Dakar
                    - generic [ref=e227]:
                      - paragraph [ref=e228]: À partir de
                      - paragraph [ref=e229]: 6 000 F CFA
              - listitem [ref=e233]:
                - article [ref=e234]:
                  - generic [ref=e236]:
                    - generic [ref=e237]:
                      - generic [aria-hidden] [ref=e238]:
                        - generic [ref=e239]: "23"
                        - generic [ref=e240]: NOV
                      - generic [ref=e241]:
                        - paragraph [ref=e242]: Orga B (test)
                        - heading [level=3] [ref=e243]:
                          - link "TEST Spectacle B (publié, à venir)" [ref=e244] [cursor=pointer]:
                            - /url: /events/0db6b4ca-7299-4f80-a8d1-9924f0fac599
                    - generic [ref=e245]: Concerts & Musique
                    - list [ref=e248]:
                      - listitem [ref=e249]:
                        - generic [ref=e252]: 23 NOV 2026 à 20:00
                      - listitem [ref=e253]:
                        - generic [ref=e257]: Salle de test, Dakar, Dakar
                    - generic [ref=e259]:
                      - paragraph [ref=e260]: À partir de
                      - paragraph [ref=e261]: 4 000 F CFA
              - listitem [ref=e265]:
                - article [ref=e266]:
                  - generic [ref=e268]:
                    - generic [ref=e269]:
                      - generic [aria-hidden] [ref=e270]:
                        - generic [ref=e271]: "24"
                        - generic [ref=e272]: NOV
                      - generic [ref=e273]:
                        - paragraph [ref=e274]: Saloum Culture
                        - heading [level=3] [ref=e275]:
                          - link "Gala des entrepreneurs du Saloum" [ref=e276] [cursor=pointer]:
                            - /url: /events/b2f3124b-623f-48a3-83e4-2988e1a6b66e
                    - generic [ref=e277]: Salles & Réceptions
                    - list [ref=e280]:
                      - listitem [ref=e281]:
                        - generic [ref=e284]: 24 NOV 2026 à 19:30
                      - listitem [ref=e285]:
                        - generic [ref=e289]: Salle des Palétuviers, Kaolack
                    - generic [ref=e291]:
                      - paragraph [ref=e292]: À partir de
                      - paragraph [ref=e293]: 10 000 F CFA
              - listitem [ref=e297]:
                - article [ref=e298]:
                  - generic [ref=e300]:
                    - generic [ref=e301]:
                      - generic [aria-hidden] [ref=e302]:
                        - generic [ref=e303]: "29"
                        - generic [ref=e304]: NOV
                      - generic [ref=e305]:
                        - paragraph [ref=e306]: Petite-Côte Événements
                        - heading [level=3] [ref=e307]:
                          - link "Festival des rythmes de Casamance" [ref=e308] [cursor=pointer]:
                            - /url: /events/8b91396a-2a6c-4117-a83a-f6153fc0a775
                    - generic [ref=e309]: Festivals
                    - list [ref=e312]:
                      - listitem [ref=e313]:
                        - generic [ref=e316]: 29 NOV 2026 à 17:00
                      - listitem [ref=e317]:
                        - generic [ref=e321]: Esplanade du Port, Ziguinchor
                    - generic [ref=e323]:
                      - paragraph [ref=e324]: À partir de
                      - paragraph [ref=e325]: 5 000 F CFA
              - listitem [ref=e329]:
                - article [ref=e330]:
                  - generic [ref=e332]:
                    - generic [ref=e333]:
                      - generic [aria-hidden] [ref=e334]:
                        - generic [ref=e335]: "03"
                        - generic [ref=e336]: DÉC
                      - generic [ref=e337]:
                        - paragraph [ref=e338]: Petite-Côte Événements
                        - heading [level=3] [ref=e339]:
                          - link "Carnaval des enfants de Saly" [ref=e340] [cursor=pointer]:
                            - /url: /events/15929bab-7e03-4340-81bd-d822be18673e
                    - generic [ref=e341]: Festivals
                    - list [ref=e344]:
                      - listitem [ref=e345]:
                        - generic [ref=e348]: 03 DÉC 2026 à 15:00
                      - listitem [ref=e349]:
                        - generic [ref=e353]: Promenade des Filaos, Saly
                    - generic [ref=e355]:
                      - paragraph [ref=e356]: À partir de
                      - paragraph [ref=e357]: 2 000 F CFA
              - listitem [ref=e361]:
                - article [ref=e362]:
                  - generic [ref=e364]:
                    - generic [ref=e365]:
                      - generic [aria-hidden] [ref=e366]:
                        - generic [ref=e367]: "03"
                        - generic [ref=e368]: DÉC
                      - generic [ref=e369]:
                        - paragraph [ref=e370]: Orga A (test)
                        - heading [level=3] [ref=e371]:
                          - link "TEST Concert A (publié, à venir)" [ref=e372] [cursor=pointer]:
                            - /url: /events/41c0641b-b19e-4979-8516-c53ace67c45c
                    - generic [ref=e373]: Concerts & Musique
                    - list [ref=e376]:
                      - listitem [ref=e377]:
                        - generic [ref=e380]: 03 DÉC 2026 à 20:00
                      - listitem [ref=e381]:
                        - generic [ref=e385]: Salle de test, Dakar, Dakar
                    - generic [ref=e387]:
                      - paragraph [ref=e388]: À partir de
                      - paragraph [ref=e389]: 5 000 F CFA
    - navigation "Navigation rapide" [ref=e393]:
      - generic [ref=e394]:
        - link "Accueil" [ref=e395] [cursor=pointer]:
          - /url: /
        - link "Explorer" [ref=e400] [cursor=pointer]:
          - /url: /explore
        - link "Billets" [ref=e405] [cursor=pointer]:
          - /url: /tickets
        - link "Achats" [ref=e409] [cursor=pointer]:
          - /url: /orders
        - link "Solde" [ref=e414] [cursor=pointer]:
          - /url: /wallet
  - alert [ref=e419]
```

# Test source

```ts
  25  | const ROLE_ORDER: readonly CaptureRole[] = ['anonyme', 'client', 'organisateur', 'admin', 'controleur'];
  26  | 
  27  | /** Attente « page stable » ; une attente non aboutie est notée dans l'index (jamais ignorée). */
  28  | async function settle(page: Page, notes: string[]): Promise<void> {
  29  |     await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch((err: Error) => {
  30  |         notes.push(`réseau jamais au repos après 15 s (${err.message.split('\n')[0]})`);
  31  |     });
  32  |     await page.waitForFunction(() => Array.from(document.images).every((img) => img.complete), undefined, { timeout: 15_000 }).catch((err: Error) => {
  33  |         notes.push(`images encore en chargement après 15 s (${err.message.split('\n')[0]})`);
  34  |     });
  35  |     await page.evaluate(() => document.fonts.ready.then(() => true));
  36  | }
  37  | 
  38  | function globalMasks(page: Page) {
  39  |     return [
  40  |         page.locator('[data-e2e-mask]'),
  41  |         page.getByText(/^(il y a|dans) \d+\s?(s|sec|min|minutes?|h|heures?|j|jours?)\b/i),
  42  |         page.getByText(/^à l[’']instant$/i),
  43  |     ];
  44  | }
  45  | 
  46  | async function capture(page: Page, screen: Screen, file: string): Promise<string> {
  47  |     fs.mkdirSync(CAPTURES_DIR, { recursive: true });
  48  |     const target = path.join(CAPTURES_DIR, file);
  49  |     await page.screenshot({
  50  |         path: target,
  51  |         animations: 'disabled',
  52  |         caret: 'hide',
  53  |         scale: 'device',
  54  |         mask: [...globalMasks(page), ...(screen.masks ? screen.masks(page) : [])],
  55  |     });
  56  |     return target;
  57  | }
  58  | 
  59  | for (const theme of THEMES) {
  60  |     for (const role of ROLE_ORDER) {
  61  |         const screens = SCREENS.filter((s) => s.role === role);
  62  |         if (screens.length === 0) continue;
  63  |         test.describe(`${theme.key} · ${role}`, () => {
  64  |             test.use({ colorScheme: theme.colorScheme, evTheme: theme.key, evRole: role });
  65  | 
  66  |             for (const screen of screens) {
  67  |                 test(`${screen.id} — ${screen.titre}`, async ({ page, context, guard }, testInfo) => {
  68  |                     const vue = testInfo.project.name === 'mobile' ? 'mobile' : 'ordinateur';
  69  |                     const file = `${screen.id}__${vue}__${theme.key}.png`;
  70  |                     const started = Date.now();
  71  |                     const record: CaptureRecord = {
  72  |                         file, screen: screen.id, titre: screen.titre, vue, theme: theme.key, role,
  73  |                         url: null, status: null, captured: false, blocking: [], warnings: [], axeDetails: [], notes: [], error: null, durationMs: 0,
  74  |                     };
  75  |                     try {
  76  |                         const demo: DemoIds | null = screen.needsIds ? readDemoIds() : null;
  77  |                         record.url = screen.path(demo);
  78  |                         guard.configure({
  79  |                             allowFailures: [...(screen.allowFailures ?? []), ...(screen.injectError ? [screen.injectError] : [])],
  80  |                             ignoreConsoleErrors: Boolean(screen.injectError),
  81  |                         });
  82  |                         if (screen.injectError) {
  83  |                             record.notes.push(`état d'erreur simulé : réponses ${screen.injectError} remplacées par un 500 (erreurs de console attendues, ignorées)`);
  84  |                             await page.route(screen.injectError, (route) => route.fulfill({
  85  |                                 status: 500,
  86  |                                 contentType: 'application/json; charset=utf-8',
  87  |                                 body: JSON.stringify({ error: 'Erreur simulée par les tests de bout en bout.', code: 'E2E_SIMULATED_ERROR' }),
  88  |                             }));
  89  |                         }
  90  |                         if (screen.fakeCamera) await context.addInitScript(installFakeCamera, { mode: fakeScanMode() });
  91  |                         const response = await page.goto(record.url, { waitUntil: 'load' });
  92  |                         record.status = response ? response.status() : null;
  93  |                         await settle(page, record.notes);
  94  |                         const sc = { page, context, guard, ids: demo };
  95  |                         if (screen.ready) await screen.ready(sc);
  96  |                         if (screen.actions) {
  97  |                             await screen.actions(sc);
  98  |                             await settle(page, record.notes);
  99  |                         }
  100 |                         const checks = await runPageChecks(page, { mobile: vue === 'mobile', axe: true });
  101 |                         record.blocking.push(...checks.blocking);
  102 |                         record.warnings.push(...checks.warnings);
  103 |                         record.axeDetails = checks.axeDetails;
  104 |                         const shot = await capture(page, screen, file);
  105 |                         record.captured = true;
  106 |                         await testInfo.attach(file, { path: shot, contentType: 'image/png' });
  107 |                     } catch (err) {
  108 |                         record.error = err instanceof Error ? err.message.split('\n')[0] : String(err);
  109 |                         if (!record.captured && !page.isClosed()) {
  110 |                             await capture(page, screen, file).then(
  111 |                                 async (shot) => {
  112 |                                     record.captured = true;
  113 |                                     record.notes.push('capture prise après l’erreur (état de la page au moment de l’échec)');
  114 |                                     await testInfo.attach(file, { path: shot, contentType: 'image/png' });
  115 |                                 },
  116 |                                 (shotErr: Error) => { record.notes.push(`capture impossible après l’erreur : ${shotErr.message.split('\n')[0]}`); },
  117 |                             );
  118 |                         }
  119 |                         throw err;
  120 |                     } finally {
  121 |                         record.blocking.push(...guard.blockingIssues());
  122 |                         record.durationMs = Date.now() - started;
  123 |                         writeCaptureRecord(record);
  124 |                     }
> 125 |                     expect(record.blocking, `contrôles bloquants de ${file}`).toEqual([]);
      |                                                                               ^ Error: contrôles bloquants de catalogue__mobile__sombre.png
  126 |                 });
  127 |             }
  128 |         });
  129 |     }
  130 | }
  131 | 
```