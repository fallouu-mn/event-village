# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · anonyme >> hors-ligne — Indicateur « Hors ligne » (catalogue ouvert, connexion coupée)
- Location: e2e/captures.spec.ts:67:21

# Error details

```
Error: contrôles bloquants de hors-ligne__ordinateur__sombre.png

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
        - button "Basculer le thème" [pressed] [ref=e72] [cursor=pointer]
    - generic [ref=e80]:
      - banner [ref=e81]:
        - link "Rechercher un événement, un concert, un restaurant…" [ref=e83] [cursor=pointer]:
          - /url: /explore
        - button "Notifications" [ref=e90] [cursor=pointer]
      - main [ref=e94]:
        - generic [ref=e96]:
          - generic [ref=e98]:
            - generic [ref=e99]:
              - heading "Explorer les événements" [level=1] [ref=e100]
              - paragraph [ref=e101]: Concerts, festivals, soirées et rencontres à venir au Sénégal. La liste se met à jour d’elle-même.
            - status "Les chiffres affichés sont ceux du dernier chargement." [ref=e103]: Hors ligne
          - region "Recherche et filtres" [ref=e105]:
            - generic [ref=e106]:
              - generic [ref=e108]:
                - generic [ref=e109]: Rechercher un événement
                - searchbox "Rechercher un événement" [ref=e111]
              - generic [ref=e112]:
                - generic [ref=e113]: Ville
                - combobox "Ville" [ref=e116] [cursor=pointer]:
                  - option "Toutes les villes" [selected]
                  - option "Dakar"
                  - option "Foundiougne"
                  - option "Kaolack"
                  - option "Mbour"
                  - option "Saint-Louis"
                  - option "Saly"
                  - option "Ziguinchor"
              - generic [ref=e117]:
                - generic [ref=e118]: Trier par
                - combobox "Trier par" [ref=e121] [cursor=pointer]:
                  - option "Date la plus proche" [selected]
                  - option "Prix croissant"
                  - option "Prix décroissant"
            - group "Catégorie" [ref=e122]:
              - button "Toutes les catégories" [pressed] [ref=e123] [cursor=pointer]
              - button "Concerts & Musique" [ref=e124] [cursor=pointer]
              - button "Festivals" [ref=e125] [cursor=pointer]
              - button "Gastronomie & Tables" [ref=e126] [cursor=pointer]
              - button "Salles & Réceptions" [ref=e127] [cursor=pointer]
          - region [ref=e128]:
            - heading "10 événements" [level=2] [ref=e130]
            - list [ref=e131]:
              - listitem [ref=e132]:
                - article [ref=e133]:
                  - generic [ref=e135]:
                    - generic [ref=e136]:
                      - generic [aria-hidden] [ref=e137]:
                        - generic [ref=e138]: "03"
                        - generic [ref=e139]: NOV
                      - generic [ref=e140]:
                        - paragraph [ref=e141]: Baobab Scène
                        - heading [level=3] [ref=e142]:
                          - link "Nuit du Sabar — édition d’automne" [ref=e143] [cursor=pointer]:
                            - /url: /events/07be8ac0-5ef3-4a3b-9a96-68a6f99946d1
                    - generic [ref=e144]: Concerts & Musique
                    - list [ref=e147]:
                      - listitem [ref=e148]:
                        - generic [ref=e151]: 03 NOV 2026 à 22:45
                      - listitem [ref=e152]:
                        - generic [ref=e156]: Esplanade de la Corniche Ouest, Dakar
                    - generic [ref=e158]:
                      - paragraph [ref=e159]: À partir de
                      - paragraph [ref=e160]: 5 000 F CFA
              - listitem [ref=e164]:
                - article [ref=e165]:
                  - generic [ref=e167]:
                    - generic [ref=e168]:
                      - generic [aria-hidden] [ref=e169]:
                        - generic [ref=e170]: "08"
                        - generic [ref=e171]: NOV
                      - generic [ref=e172]:
                        - paragraph [ref=e173]: Petite-Côte Événements
                        - heading [level=3] [ref=e174]:
                          - link "Marché gourmand de la Petite-Côte" [ref=e175] [cursor=pointer]:
                            - /url: /events/cf411fef-bed9-48ba-ad5c-026ab876568b
                    - generic [ref=e176]: Gastronomie & Tables
                    - list [ref=e179]:
                      - listitem [ref=e180]:
                        - generic [ref=e183]: 08 NOV 2026 à 10:00
                      - listitem [ref=e184]:
                        - generic [ref=e188]: Place du Marché Central, Mbour
                    - generic [ref=e190]:
                      - paragraph [ref=e191]: À partir de
                      - paragraph [ref=e192]: 1 000 F CFA
              - listitem [ref=e196]:
                - article [ref=e197]:
                  - generic [ref=e199]:
                    - generic [ref=e200]:
                      - generic [aria-hidden] [ref=e201]:
                        - generic [ref=e202]: "11"
                        - generic [ref=e203]: NOV
                      - generic [ref=e204]:
                        - paragraph [ref=e205]: Saloum Culture
                        - heading [level=3] [ref=e206]:
                          - link "Dîner-spectacle au bord du Saloum" [ref=e207] [cursor=pointer]:
                            - /url: /events/d5ca7418-064d-4a4f-b642-64ce6ac6886f
                    - generic [ref=e208]: Salles & Réceptions
                    - list [ref=e211]:
                      - listitem [ref=e212]:
                        - generic [ref=e215]: 11 NOV 2026 à 20:00
                      - listitem [ref=e216]:
                        - generic [ref=e220]: Terrasse des Pirogues, Foundiougne
                    - generic [ref=e222]:
                      - paragraph [ref=e223]: À partir de
                      - paragraph [ref=e224]: 25 000 F CFA
              - listitem [ref=e228]:
                - article [ref=e229]:
                  - generic [ref=e231]:
                    - generic [ref=e232]:
                      - generic [aria-hidden] [ref=e233]:
                        - generic [ref=e234]: "15"
                        - generic [ref=e235]: NOV
                      - generic [ref=e236]:
                        - paragraph [ref=e237]: Baobab Scène
                        - heading [level=3] [ref=e238]:
                          - link "Festival Jazz sur le Fleuve" [ref=e239] [cursor=pointer]:
                            - /url: /events/86fb2b08-fef4-4b8e-98b7-b019bd127696
                    - generic [ref=e240]: Festivals
                    - list [ref=e243]:
                      - listitem [ref=e244]:
                        - generic [ref=e247]: 15 NOV 2026 à 18:00
                      - listitem [ref=e248]:
                        - generic [ref=e252]: Quai des Pêcheurs, Saint-Louis
                    - generic [ref=e254]:
                      - paragraph [ref=e255]: À partir de
                      - paragraph [ref=e256]: 7 500 F CFA
              - listitem [ref=e260]:
                - article [ref=e261]:
                  - generic [ref=e263]:
                    - generic [ref=e264]:
                      - generic [aria-hidden] [ref=e265]:
                        - generic [ref=e266]: "20"
                        - generic [ref=e267]: NOV
                      - generic [ref=e268]:
                        - paragraph [ref=e269]: Baobab Scène
                        - heading [level=3] [ref=e270]:
                          - link "Soirée Kora & Lumières" [ref=e271] [cursor=pointer]:
                            - /url: /events/2143ea28-9ab6-4c7d-8aef-e42cec439c44
                    - generic [ref=e272]: Concerts & Musique
                    - list [ref=e275]:
                      - listitem [ref=e276]:
                        - generic [ref=e279]: 20 NOV 2026 à 20:30
                      - listitem [ref=e280]:
                        - generic [ref=e284]: Jardin de la Maison des Arts, Dakar
                    - generic [ref=e286]:
                      - paragraph [ref=e287]: À partir de
                      - paragraph [ref=e288]: 6 000 F CFA
              - listitem [ref=e292]:
                - article [ref=e293]:
                  - generic [ref=e295]:
                    - generic [ref=e296]:
                      - generic [aria-hidden] [ref=e297]:
                        - generic [ref=e298]: "23"
                        - generic [ref=e299]: NOV
                      - generic [ref=e300]:
                        - paragraph [ref=e301]: Orga B (test)
                        - heading [level=3] [ref=e302]:
                          - link "TEST Spectacle B (publié, à venir)" [ref=e303] [cursor=pointer]:
                            - /url: /events/0db6b4ca-7299-4f80-a8d1-9924f0fac599
                    - generic [ref=e304]: Concerts & Musique
                    - list [ref=e307]:
                      - listitem [ref=e308]:
                        - generic [ref=e311]: 23 NOV 2026 à 20:00
                      - listitem [ref=e312]:
                        - generic [ref=e316]: Salle de test, Dakar, Dakar
                    - generic [ref=e318]:
                      - paragraph [ref=e319]: À partir de
                      - paragraph [ref=e320]: 4 000 F CFA
              - listitem [ref=e324]:
                - article [ref=e325]:
                  - generic [ref=e327]:
                    - generic [ref=e328]:
                      - generic [aria-hidden] [ref=e329]:
                        - generic [ref=e330]: "24"
                        - generic [ref=e331]: NOV
                      - generic [ref=e332]:
                        - paragraph [ref=e333]: Saloum Culture
                        - heading [level=3] [ref=e334]:
                          - link "Gala des entrepreneurs du Saloum" [ref=e335] [cursor=pointer]:
                            - /url: /events/b2f3124b-623f-48a3-83e4-2988e1a6b66e
                    - generic [ref=e336]: Salles & Réceptions
                    - list [ref=e339]:
                      - listitem [ref=e340]:
                        - generic [ref=e343]: 24 NOV 2026 à 19:30
                      - listitem [ref=e344]:
                        - generic [ref=e348]: Salle des Palétuviers, Kaolack
                    - generic [ref=e350]:
                      - paragraph [ref=e351]: À partir de
                      - paragraph [ref=e352]: 10 000 F CFA
              - listitem [ref=e356]:
                - article [ref=e357]:
                  - generic [ref=e359]:
                    - generic [ref=e360]:
                      - generic [aria-hidden] [ref=e361]:
                        - generic [ref=e362]: "29"
                        - generic [ref=e363]: NOV
                      - generic [ref=e364]:
                        - paragraph [ref=e365]: Petite-Côte Événements
                        - heading [level=3] [ref=e366]:
                          - link "Festival des rythmes de Casamance" [ref=e367] [cursor=pointer]:
                            - /url: /events/8b91396a-2a6c-4117-a83a-f6153fc0a775
                    - generic [ref=e368]: Festivals
                    - list [ref=e371]:
                      - listitem [ref=e372]:
                        - generic [ref=e375]: 29 NOV 2026 à 17:00
                      - listitem [ref=e376]:
                        - generic [ref=e380]: Esplanade du Port, Ziguinchor
                    - generic [ref=e382]:
                      - paragraph [ref=e383]: À partir de
                      - paragraph [ref=e384]: 5 000 F CFA
              - listitem [ref=e388]:
                - article [ref=e389]:
                  - generic [ref=e391]:
                    - generic [ref=e392]:
                      - generic [aria-hidden] [ref=e393]:
                        - generic [ref=e394]: "03"
                        - generic [ref=e395]: DÉC
                      - generic [ref=e396]:
                        - paragraph [ref=e397]: Petite-Côte Événements
                        - heading [level=3] [ref=e398]:
                          - link "Carnaval des enfants de Saly" [ref=e399] [cursor=pointer]:
                            - /url: /events/15929bab-7e03-4340-81bd-d822be18673e
                    - generic [ref=e400]: Festivals
                    - list [ref=e403]:
                      - listitem [ref=e404]:
                        - generic [ref=e407]: 03 DÉC 2026 à 15:00
                      - listitem [ref=e408]:
                        - generic [ref=e412]: Promenade des Filaos, Saly
                    - generic [ref=e414]:
                      - paragraph [ref=e415]: À partir de
                      - paragraph [ref=e416]: 2 000 F CFA
              - listitem [ref=e420]:
                - article [ref=e421]:
                  - generic [ref=e423]:
                    - generic [ref=e424]:
                      - generic [aria-hidden] [ref=e425]:
                        - generic [ref=e426]: "03"
                        - generic [ref=e427]: DÉC
                      - generic [ref=e428]:
                        - paragraph [ref=e429]: Orga A (test)
                        - heading [level=3] [ref=e430]:
                          - link "TEST Concert A (publié, à venir)" [ref=e431] [cursor=pointer]:
                            - /url: /events/41c0641b-b19e-4979-8516-c53ace67c45c
                    - generic [ref=e432]: Concerts & Musique
                    - list [ref=e435]:
                      - listitem [ref=e436]:
                        - generic [ref=e439]: 03 DÉC 2026 à 20:00
                      - listitem [ref=e440]:
                        - generic [ref=e444]: Salle de test, Dakar, Dakar
                    - generic [ref=e446]:
                      - paragraph [ref=e447]: À partir de
                      - paragraph [ref=e448]: 5 000 F CFA
  - alert [ref=e452]
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
      |                                                                               ^ Error: contrôles bloquants de hors-ligne__ordinateur__sombre.png
  126 |                 });
  127 |             }
  128 |         });
  129 |     }
  130 | }
  131 | 
```