# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> clair · anonyme >> hors-ligne — Indicateur « Hors ligne » (catalogue ouvert, connexion coupée)
- Location: e2e/captures.spec.ts:67:21

# Error details

```
Error: contrôles bloquants de hors-ligne__mobile__clair.png

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
          - button "Basculer le thème" [ref=e23] [cursor=pointer]
          - link "Se connecter" [ref=e27] [cursor=pointer]:
            - /url: /login
      - main [ref=e31]:
        - generic [ref=e33]:
          - generic [ref=e35]:
            - generic [ref=e36]:
              - heading "Explorer les événements" [level=1] [ref=e37]
              - paragraph [ref=e38]: Concerts, festivals, soirées et rencontres à venir au Sénégal. La liste se met à jour d’elle-même.
            - status "Les chiffres affichés sont ceux du dernier chargement." [ref=e40]: Hors ligne
          - region "Recherche et filtres" [ref=e42]:
            - generic [ref=e43]:
              - generic [ref=e45]:
                - generic [ref=e46]: Rechercher un événement
                - searchbox "Rechercher un événement" [ref=e48]
              - generic [ref=e49]:
                - generic [ref=e50]: Ville
                - combobox "Ville" [ref=e53] [cursor=pointer]:
                  - option "Toutes les villes" [selected]
                  - option "Dakar"
                  - option "Foundiougne"
                  - option "Kaolack"
                  - option "Mbour"
                  - option "Saint-Louis"
                  - option "Saly"
                  - option "Ziguinchor"
              - generic [ref=e54]:
                - generic [ref=e55]: Trier par
                - combobox "Trier par" [ref=e58] [cursor=pointer]:
                  - option "Date la plus proche" [selected]
                  - option "Prix croissant"
                  - option "Prix décroissant"
            - group "Catégorie" [ref=e59]:
              - button "Toutes les catégories" [pressed] [ref=e60] [cursor=pointer]
              - button "Concerts & Musique" [ref=e61] [cursor=pointer]
              - button "Festivals" [ref=e62] [cursor=pointer]
              - button "Gastronomie & Tables" [ref=e63] [cursor=pointer]
              - button "Salles & Réceptions" [ref=e64] [cursor=pointer]
          - region [ref=e65]:
            - heading "10 événements" [level=2] [ref=e67]
            - list [ref=e68]:
              - listitem [ref=e69]:
                - article [ref=e70]:
                  - generic [ref=e72]:
                    - generic [ref=e73]:
                      - generic [aria-hidden] [ref=e74]:
                        - generic [ref=e75]: "03"
                        - generic [ref=e76]: NOV
                      - generic [ref=e77]:
                        - paragraph [ref=e78]: Baobab Scène
                        - heading [level=3] [ref=e79]:
                          - link "Nuit du Sabar — édition d’automne" [ref=e80] [cursor=pointer]:
                            - /url: /events/07be8ac0-5ef3-4a3b-9a96-68a6f99946d1
                    - generic [ref=e81]: Concerts & Musique
                    - list [ref=e84]:
                      - listitem [ref=e85]:
                        - generic [ref=e88]: 03 NOV 2026 à 22:45
                      - listitem [ref=e89]:
                        - generic [ref=e93]: Esplanade de la Corniche Ouest, Dakar
                    - generic [ref=e95]:
                      - paragraph [ref=e96]: À partir de
                      - paragraph [ref=e97]: 5 000 F CFA
              - listitem [ref=e101]:
                - article [ref=e102]:
                  - generic [ref=e104]:
                    - generic [ref=e105]:
                      - generic [aria-hidden] [ref=e106]:
                        - generic [ref=e107]: "08"
                        - generic [ref=e108]: NOV
                      - generic [ref=e109]:
                        - paragraph [ref=e110]: Petite-Côte Événements
                        - heading [level=3] [ref=e111]:
                          - link "Marché gourmand de la Petite-Côte" [ref=e112] [cursor=pointer]:
                            - /url: /events/cf411fef-bed9-48ba-ad5c-026ab876568b
                    - generic [ref=e113]: Gastronomie & Tables
                    - list [ref=e116]:
                      - listitem [ref=e117]:
                        - generic [ref=e120]: 08 NOV 2026 à 10:00
                      - listitem [ref=e121]:
                        - generic [ref=e125]: Place du Marché Central, Mbour
                    - generic [ref=e127]:
                      - paragraph [ref=e128]: À partir de
                      - paragraph [ref=e129]: 1 000 F CFA
              - listitem [ref=e133]:
                - article [ref=e134]:
                  - generic [ref=e136]:
                    - generic [ref=e137]:
                      - generic [aria-hidden] [ref=e138]:
                        - generic [ref=e139]: "11"
                        - generic [ref=e140]: NOV
                      - generic [ref=e141]:
                        - paragraph [ref=e142]: Saloum Culture
                        - heading [level=3] [ref=e143]:
                          - link "Dîner-spectacle au bord du Saloum" [ref=e144] [cursor=pointer]:
                            - /url: /events/d5ca7418-064d-4a4f-b642-64ce6ac6886f
                    - generic [ref=e145]: Salles & Réceptions
                    - list [ref=e148]:
                      - listitem [ref=e149]:
                        - generic [ref=e152]: 11 NOV 2026 à 20:00
                      - listitem [ref=e153]:
                        - generic [ref=e157]: Terrasse des Pirogues, Foundiougne
                    - generic [ref=e159]:
                      - paragraph [ref=e160]: À partir de
                      - paragraph [ref=e161]: 25 000 F CFA
              - listitem [ref=e165]:
                - article [ref=e166]:
                  - generic [ref=e168]:
                    - generic [ref=e169]:
                      - generic [aria-hidden] [ref=e170]:
                        - generic [ref=e171]: "15"
                        - generic [ref=e172]: NOV
                      - generic [ref=e173]:
                        - paragraph [ref=e174]: Baobab Scène
                        - heading [level=3] [ref=e175]:
                          - link "Festival Jazz sur le Fleuve" [ref=e176] [cursor=pointer]:
                            - /url: /events/86fb2b08-fef4-4b8e-98b7-b019bd127696
                    - generic [ref=e177]: Festivals
                    - list [ref=e180]:
                      - listitem [ref=e181]:
                        - generic [ref=e184]: 15 NOV 2026 à 18:00
                      - listitem [ref=e185]:
                        - generic [ref=e189]: Quai des Pêcheurs, Saint-Louis
                    - generic [ref=e191]:
                      - paragraph [ref=e192]: À partir de
                      - paragraph [ref=e193]: 7 500 F CFA
              - listitem [ref=e197]:
                - article [ref=e198]:
                  - generic [ref=e200]:
                    - generic [ref=e201]:
                      - generic [aria-hidden] [ref=e202]:
                        - generic [ref=e203]: "20"
                        - generic [ref=e204]: NOV
                      - generic [ref=e205]:
                        - paragraph [ref=e206]: Baobab Scène
                        - heading [level=3] [ref=e207]:
                          - link "Soirée Kora & Lumières" [ref=e208] [cursor=pointer]:
                            - /url: /events/2143ea28-9ab6-4c7d-8aef-e42cec439c44
                    - generic [ref=e209]: Concerts & Musique
                    - list [ref=e212]:
                      - listitem [ref=e213]:
                        - generic [ref=e216]: 20 NOV 2026 à 20:30
                      - listitem [ref=e217]:
                        - generic [ref=e221]: Jardin de la Maison des Arts, Dakar
                    - generic [ref=e223]:
                      - paragraph [ref=e224]: À partir de
                      - paragraph [ref=e225]: 6 000 F CFA
              - listitem [ref=e229]:
                - article [ref=e230]:
                  - generic [ref=e232]:
                    - generic [ref=e233]:
                      - generic [aria-hidden] [ref=e234]:
                        - generic [ref=e235]: "23"
                        - generic [ref=e236]: NOV
                      - generic [ref=e237]:
                        - paragraph [ref=e238]: Orga B (test)
                        - heading [level=3] [ref=e239]:
                          - link "TEST Spectacle B (publié, à venir)" [ref=e240] [cursor=pointer]:
                            - /url: /events/0db6b4ca-7299-4f80-a8d1-9924f0fac599
                    - generic [ref=e241]: Concerts & Musique
                    - list [ref=e244]:
                      - listitem [ref=e245]:
                        - generic [ref=e248]: 23 NOV 2026 à 20:00
                      - listitem [ref=e249]:
                        - generic [ref=e253]: Salle de test, Dakar, Dakar
                    - generic [ref=e255]:
                      - paragraph [ref=e256]: À partir de
                      - paragraph [ref=e257]: 4 000 F CFA
              - listitem [ref=e261]:
                - article [ref=e262]:
                  - generic [ref=e264]:
                    - generic [ref=e265]:
                      - generic [aria-hidden] [ref=e266]:
                        - generic [ref=e267]: "24"
                        - generic [ref=e268]: NOV
                      - generic [ref=e269]:
                        - paragraph [ref=e270]: Saloum Culture
                        - heading [level=3] [ref=e271]:
                          - link "Gala des entrepreneurs du Saloum" [ref=e272] [cursor=pointer]:
                            - /url: /events/b2f3124b-623f-48a3-83e4-2988e1a6b66e
                    - generic [ref=e273]: Salles & Réceptions
                    - list [ref=e276]:
                      - listitem [ref=e277]:
                        - generic [ref=e280]: 24 NOV 2026 à 19:30
                      - listitem [ref=e281]:
                        - generic [ref=e285]: Salle des Palétuviers, Kaolack
                    - generic [ref=e287]:
                      - paragraph [ref=e288]: À partir de
                      - paragraph [ref=e289]: 10 000 F CFA
              - listitem [ref=e293]:
                - article [ref=e294]:
                  - generic [ref=e296]:
                    - generic [ref=e297]:
                      - generic [aria-hidden] [ref=e298]:
                        - generic [ref=e299]: "29"
                        - generic [ref=e300]: NOV
                      - generic [ref=e301]:
                        - paragraph [ref=e302]: Petite-Côte Événements
                        - heading [level=3] [ref=e303]:
                          - link "Festival des rythmes de Casamance" [ref=e304] [cursor=pointer]:
                            - /url: /events/8b91396a-2a6c-4117-a83a-f6153fc0a775
                    - generic [ref=e305]: Festivals
                    - list [ref=e308]:
                      - listitem [ref=e309]:
                        - generic [ref=e312]: 29 NOV 2026 à 17:00
                      - listitem [ref=e313]:
                        - generic [ref=e317]: Esplanade du Port, Ziguinchor
                    - generic [ref=e319]:
                      - paragraph [ref=e320]: À partir de
                      - paragraph [ref=e321]: 5 000 F CFA
              - listitem [ref=e325]:
                - article [ref=e326]:
                  - generic [ref=e328]:
                    - generic [ref=e329]:
                      - generic [aria-hidden] [ref=e330]:
                        - generic [ref=e331]: "03"
                        - generic [ref=e332]: DÉC
                      - generic [ref=e333]:
                        - paragraph [ref=e334]: Petite-Côte Événements
                        - heading [level=3] [ref=e335]:
                          - link "Carnaval des enfants de Saly" [ref=e336] [cursor=pointer]:
                            - /url: /events/15929bab-7e03-4340-81bd-d822be18673e
                    - generic [ref=e337]: Festivals
                    - list [ref=e340]:
                      - listitem [ref=e341]:
                        - generic [ref=e344]: 03 DÉC 2026 à 15:00
                      - listitem [ref=e345]:
                        - generic [ref=e349]: Promenade des Filaos, Saly
                    - generic [ref=e351]:
                      - paragraph [ref=e352]: À partir de
                      - paragraph [ref=e353]: 2 000 F CFA
              - listitem [ref=e357]:
                - article [ref=e358]:
                  - generic [ref=e360]:
                    - generic [ref=e361]:
                      - generic [aria-hidden] [ref=e362]:
                        - generic [ref=e363]: "03"
                        - generic [ref=e364]: DÉC
                      - generic [ref=e365]:
                        - paragraph [ref=e366]: Orga A (test)
                        - heading [level=3] [ref=e367]:
                          - link "TEST Concert A (publié, à venir)" [ref=e368] [cursor=pointer]:
                            - /url: /events/41c0641b-b19e-4979-8516-c53ace67c45c
                    - generic [ref=e369]: Concerts & Musique
                    - list [ref=e372]:
                      - listitem [ref=e373]:
                        - generic [ref=e376]: 03 DÉC 2026 à 20:00
                      - listitem [ref=e377]:
                        - generic [ref=e381]: Salle de test, Dakar, Dakar
                    - generic [ref=e383]:
                      - paragraph [ref=e384]: À partir de
                      - paragraph [ref=e385]: 5 000 F CFA
    - navigation "Navigation rapide" [ref=e389]:
      - generic [ref=e390]:
        - link "Accueil" [ref=e391] [cursor=pointer]:
          - /url: /
        - link "Explorer" [ref=e396] [cursor=pointer]:
          - /url: /explore
        - link "Billets" [ref=e401] [cursor=pointer]:
          - /url: /tickets
        - link "Achats" [ref=e405] [cursor=pointer]:
          - /url: /orders
        - link "Solde" [ref=e410] [cursor=pointer]:
          - /url: /wallet
  - alert [ref=e415]
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
      |                                                                               ^ Error: contrôles bloquants de hors-ligne__mobile__clair.png
  126 |                 });
  127 |             }
  128 |         });
  129 |     }
  130 | }
  131 | 
```