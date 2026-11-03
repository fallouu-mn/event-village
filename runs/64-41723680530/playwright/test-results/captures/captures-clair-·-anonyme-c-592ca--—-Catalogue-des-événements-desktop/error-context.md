# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> clair · anonyme >> catalogue — Catalogue des événements
- Location: e2e/captures.spec.ts:67:21

# Error details

```
Error: contrôles bloquants de catalogue__ordinateur__clair.png

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 4

- Array []
+ Array [
+   "requête en échec : GET localhost:3000/login?redirect=%2Fwallet : net::ERR_ABORTED",
+   "requête en échec : GET localhost:3000/login?redirect=%2Forders : net::ERR_ABORTED",
+ ]
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - complementary [ref=e3]:
      - link "Event Village, accueil" [ref=e5] [cursor=pointer]:
        - /url: /
        - generic [ref=e11]:
          - generic [ref=e12]: EVENT
          - generic [ref=e13]: VILLAGE
      - navigation "Navigation principale" [ref=e14]:
        - generic [ref=e15]:
          - paragraph [ref=e16]: Menu principal
          - generic [ref=e17]:
            - link "Accueil" [ref=e18] [cursor=pointer]:
              - /url: /
            - link "Explorer" [ref=e23] [cursor=pointer]:
              - /url: /explore
            - link "Mes billets" [ref=e28] [cursor=pointer]:
              - /url: /tickets
            - link "Commandes" [ref=e32] [cursor=pointer]:
              - /url: /orders
            - link "Portefeuille" [ref=e37] [cursor=pointer]:
              - /url: /wallet
        - generic [ref=e42]:
          - paragraph [ref=e43]: Services et espaces
          - generic [ref=e44]:
            - link "Salles de fête" [ref=e45] [cursor=pointer]:
              - /url: /halls
            - link "Restaurants et tables" [ref=e51] [cursor=pointer]:
              - /url: /restaurants/rest-terrou-bi/tables
        - generic [ref=e56]:
          - paragraph [ref=e57]: Espaces métier
          - link "Devenir partenaire" [ref=e59] [cursor=pointer]:
            - /url: /partner/register
      - generic [ref=e65]:
        - link "Se connecter" [ref=e66] [cursor=pointer]:
          - /url: /login
        - button "Basculer le thème" [ref=e72] [cursor=pointer]
    - generic [ref=e76]:
      - banner [ref=e77]:
        - link "Rechercher un événement, un concert, un restaurant…" [ref=e79] [cursor=pointer]:
          - /url: /explore
        - button "Notifications" [ref=e86] [cursor=pointer]
      - main [ref=e90]:
        - generic [ref=e92]:
          - generic [ref=e94]:
            - generic [ref=e95]:
              - heading "Explorer les événements" [level=1] [ref=e96]
              - paragraph [ref=e97]: Concerts, festivals, soirées et rencontres à venir au Sénégal. La liste se met à jour d’elle-même.
            - status [ref=e99]: En direct
          - region "Recherche et filtres" [ref=e101]:
            - generic [ref=e102]:
              - generic [ref=e104]:
                - generic [ref=e105]: Rechercher un événement
                - searchbox "Rechercher un événement" [ref=e107]
              - generic [ref=e108]:
                - generic [ref=e109]: Ville
                - combobox "Ville" [ref=e112] [cursor=pointer]:
                  - option "Toutes les villes" [selected]
                  - option "Dakar"
                  - option "Foundiougne"
                  - option "Kaolack"
                  - option "Mbour"
                  - option "Saint-Louis"
                  - option "Saly"
                  - option "Ziguinchor"
              - generic [ref=e113]:
                - generic [ref=e114]: Trier par
                - combobox "Trier par" [ref=e117] [cursor=pointer]:
                  - option "Date la plus proche" [selected]
                  - option "Prix croissant"
                  - option "Prix décroissant"
            - group "Catégorie" [ref=e118]:
              - button "Toutes les catégories" [pressed] [ref=e119] [cursor=pointer]
              - button "Concerts & Musique" [ref=e120] [cursor=pointer]
              - button "Festivals" [ref=e121] [cursor=pointer]
              - button "Gastronomie & Tables" [ref=e122] [cursor=pointer]
              - button "Salles & Réceptions" [ref=e123] [cursor=pointer]
          - region [ref=e124]:
            - heading "10 événements" [level=2] [ref=e126]
            - list [ref=e127]:
              - listitem [ref=e128]:
                - article [ref=e129]:
                  - generic [ref=e131]:
                    - generic [ref=e132]:
                      - generic [aria-hidden] [ref=e133]:
                        - generic [ref=e134]: "03"
                        - generic [ref=e135]: NOV
                      - generic [ref=e136]:
                        - paragraph [ref=e137]: Baobab Scène
                        - heading [level=3] [ref=e138]:
                          - link "Nuit du Sabar — édition d’automne" [ref=e139] [cursor=pointer]:
                            - /url: /events/07be8ac0-5ef3-4a3b-9a96-68a6f99946d1
                    - generic [ref=e140]: Concerts & Musique
                    - list [ref=e143]:
                      - listitem [ref=e144]:
                        - generic [ref=e147]: 03 NOV 2026 à 22:45
                      - listitem [ref=e148]:
                        - generic [ref=e152]: Esplanade de la Corniche Ouest, Dakar
                    - generic [ref=e154]:
                      - paragraph [ref=e155]: À partir de
                      - paragraph [ref=e156]: 5 000 F CFA
              - listitem [ref=e160]:
                - article [ref=e161]:
                  - generic [ref=e163]:
                    - generic [ref=e164]:
                      - generic [aria-hidden] [ref=e165]:
                        - generic [ref=e166]: "08"
                        - generic [ref=e167]: NOV
                      - generic [ref=e168]:
                        - paragraph [ref=e169]: Petite-Côte Événements
                        - heading [level=3] [ref=e170]:
                          - link "Marché gourmand de la Petite-Côte" [ref=e171] [cursor=pointer]:
                            - /url: /events/cf411fef-bed9-48ba-ad5c-026ab876568b
                    - generic [ref=e172]: Gastronomie & Tables
                    - list [ref=e175]:
                      - listitem [ref=e176]:
                        - generic [ref=e179]: 08 NOV 2026 à 10:00
                      - listitem [ref=e180]:
                        - generic [ref=e184]: Place du Marché Central, Mbour
                    - generic [ref=e186]:
                      - paragraph [ref=e187]: À partir de
                      - paragraph [ref=e188]: 1 000 F CFA
              - listitem [ref=e192]:
                - article [ref=e193]:
                  - generic [ref=e195]:
                    - generic [ref=e196]:
                      - generic [aria-hidden] [ref=e197]:
                        - generic [ref=e198]: "11"
                        - generic [ref=e199]: NOV
                      - generic [ref=e200]:
                        - paragraph [ref=e201]: Saloum Culture
                        - heading [level=3] [ref=e202]:
                          - link "Dîner-spectacle au bord du Saloum" [ref=e203] [cursor=pointer]:
                            - /url: /events/d5ca7418-064d-4a4f-b642-64ce6ac6886f
                    - generic [ref=e204]: Salles & Réceptions
                    - list [ref=e207]:
                      - listitem [ref=e208]:
                        - generic [ref=e211]: 11 NOV 2026 à 20:00
                      - listitem [ref=e212]:
                        - generic [ref=e216]: Terrasse des Pirogues, Foundiougne
                    - generic [ref=e218]:
                      - paragraph [ref=e219]: À partir de
                      - paragraph [ref=e220]: 25 000 F CFA
              - listitem [ref=e224]:
                - article [ref=e225]:
                  - generic [ref=e227]:
                    - generic [ref=e228]:
                      - generic [aria-hidden] [ref=e229]:
                        - generic [ref=e230]: "15"
                        - generic [ref=e231]: NOV
                      - generic [ref=e232]:
                        - paragraph [ref=e233]: Baobab Scène
                        - heading [level=3] [ref=e234]:
                          - link "Festival Jazz sur le Fleuve" [ref=e235] [cursor=pointer]:
                            - /url: /events/86fb2b08-fef4-4b8e-98b7-b019bd127696
                    - generic [ref=e236]: Festivals
                    - list [ref=e239]:
                      - listitem [ref=e240]:
                        - generic [ref=e243]: 15 NOV 2026 à 18:00
                      - listitem [ref=e244]:
                        - generic [ref=e248]: Quai des Pêcheurs, Saint-Louis
                    - generic [ref=e250]:
                      - paragraph [ref=e251]: À partir de
                      - paragraph [ref=e252]: 7 500 F CFA
              - listitem [ref=e256]:
                - article [ref=e257]:
                  - generic [ref=e259]:
                    - generic [ref=e260]:
                      - generic [aria-hidden] [ref=e261]:
                        - generic [ref=e262]: "20"
                        - generic [ref=e263]: NOV
                      - generic [ref=e264]:
                        - paragraph [ref=e265]: Baobab Scène
                        - heading [level=3] [ref=e266]:
                          - link "Soirée Kora & Lumières" [ref=e267] [cursor=pointer]:
                            - /url: /events/2143ea28-9ab6-4c7d-8aef-e42cec439c44
                    - generic [ref=e268]: Concerts & Musique
                    - list [ref=e271]:
                      - listitem [ref=e272]:
                        - generic [ref=e275]: 20 NOV 2026 à 20:30
                      - listitem [ref=e276]:
                        - generic [ref=e280]: Jardin de la Maison des Arts, Dakar
                    - generic [ref=e282]:
                      - paragraph [ref=e283]: À partir de
                      - paragraph [ref=e284]: 6 000 F CFA
              - listitem [ref=e288]:
                - article [ref=e289]:
                  - generic [ref=e291]:
                    - generic [ref=e292]:
                      - generic [aria-hidden] [ref=e293]:
                        - generic [ref=e294]: "23"
                        - generic [ref=e295]: NOV
                      - generic [ref=e296]:
                        - paragraph [ref=e297]: Orga B (test)
                        - heading [level=3] [ref=e298]:
                          - link "TEST Spectacle B (publié, à venir)" [ref=e299] [cursor=pointer]:
                            - /url: /events/0db6b4ca-7299-4f80-a8d1-9924f0fac599
                    - generic [ref=e300]: Concerts & Musique
                    - list [ref=e303]:
                      - listitem [ref=e304]:
                        - generic [ref=e307]: 23 NOV 2026 à 20:00
                      - listitem [ref=e308]:
                        - generic [ref=e312]: Salle de test, Dakar, Dakar
                    - generic [ref=e314]:
                      - paragraph [ref=e315]: À partir de
                      - paragraph [ref=e316]: 4 000 F CFA
              - listitem [ref=e320]:
                - article [ref=e321]:
                  - generic [ref=e323]:
                    - generic [ref=e324]:
                      - generic [aria-hidden] [ref=e325]:
                        - generic [ref=e326]: "24"
                        - generic [ref=e327]: NOV
                      - generic [ref=e328]:
                        - paragraph [ref=e329]: Saloum Culture
                        - heading [level=3] [ref=e330]:
                          - link "Gala des entrepreneurs du Saloum" [ref=e331] [cursor=pointer]:
                            - /url: /events/b2f3124b-623f-48a3-83e4-2988e1a6b66e
                    - generic [ref=e332]: Salles & Réceptions
                    - list [ref=e335]:
                      - listitem [ref=e336]:
                        - generic [ref=e339]: 24 NOV 2026 à 19:30
                      - listitem [ref=e340]:
                        - generic [ref=e344]: Salle des Palétuviers, Kaolack
                    - generic [ref=e346]:
                      - paragraph [ref=e347]: À partir de
                      - paragraph [ref=e348]: 10 000 F CFA
              - listitem [ref=e352]:
                - article [ref=e353]:
                  - generic [ref=e355]:
                    - generic [ref=e356]:
                      - generic [aria-hidden] [ref=e357]:
                        - generic [ref=e358]: "29"
                        - generic [ref=e359]: NOV
                      - generic [ref=e360]:
                        - paragraph [ref=e361]: Petite-Côte Événements
                        - heading [level=3] [ref=e362]:
                          - link "Festival des rythmes de Casamance" [ref=e363] [cursor=pointer]:
                            - /url: /events/8b91396a-2a6c-4117-a83a-f6153fc0a775
                    - generic [ref=e364]: Festivals
                    - list [ref=e367]:
                      - listitem [ref=e368]:
                        - generic [ref=e371]: 29 NOV 2026 à 17:00
                      - listitem [ref=e372]:
                        - generic [ref=e376]: Esplanade du Port, Ziguinchor
                    - generic [ref=e378]:
                      - paragraph [ref=e379]: À partir de
                      - paragraph [ref=e380]: 5 000 F CFA
              - listitem [ref=e384]:
                - article [ref=e385]:
                  - generic [ref=e387]:
                    - generic [ref=e388]:
                      - generic [aria-hidden] [ref=e389]:
                        - generic [ref=e390]: "03"
                        - generic [ref=e391]: DÉC
                      - generic [ref=e392]:
                        - paragraph [ref=e393]: Petite-Côte Événements
                        - heading [level=3] [ref=e394]:
                          - link "Carnaval des enfants de Saly" [ref=e395] [cursor=pointer]:
                            - /url: /events/15929bab-7e03-4340-81bd-d822be18673e
                    - generic [ref=e396]: Festivals
                    - list [ref=e399]:
                      - listitem [ref=e400]:
                        - generic [ref=e403]: 03 DÉC 2026 à 15:00
                      - listitem [ref=e404]:
                        - generic [ref=e408]: Promenade des Filaos, Saly
                    - generic [ref=e410]:
                      - paragraph [ref=e411]: À partir de
                      - paragraph [ref=e412]: 2 000 F CFA
              - listitem [ref=e416]:
                - article [ref=e417]:
                  - generic [ref=e419]:
                    - generic [ref=e420]:
                      - generic [aria-hidden] [ref=e421]:
                        - generic [ref=e422]: "03"
                        - generic [ref=e423]: DÉC
                      - generic [ref=e424]:
                        - paragraph [ref=e425]: Orga A (test)
                        - heading [level=3] [ref=e426]:
                          - link "TEST Concert A (publié, à venir)" [ref=e427] [cursor=pointer]:
                            - /url: /events/41c0641b-b19e-4979-8516-c53ace67c45c
                    - generic [ref=e428]: Concerts & Musique
                    - list [ref=e431]:
                      - listitem [ref=e432]:
                        - generic [ref=e435]: 03 DÉC 2026 à 20:00
                      - listitem [ref=e436]:
                        - generic [ref=e440]: Salle de test, Dakar, Dakar
                    - generic [ref=e442]:
                      - paragraph [ref=e443]: À partir de
                      - paragraph [ref=e444]: 5 000 F CFA
  - alert [ref=e448]
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
      |                                                                               ^ Error: contrôles bloquants de catalogue__ordinateur__clair.png
  126 |                 });
  127 |             }
  128 |         });
  129 |     }
  130 | }
  131 | 
```