# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · anonyme >> accueil — Accueil
- Location: e2e/captures.spec.ts:67:21

# Error details

```
Error: contrôles bloquants de accueil__ordinateur__sombre.png

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
              - paragraph [ref=e100]: Billetterie officielle au Sénégal
              - heading "Découvrez, réservez et vivez les événements qui comptent." [level=1] [ref=e104]
              - paragraph [ref=e105]: "Concerts, festivals, soirées et rencontres : choisissez votre place, payez en quelques secondes et présentez votre billet à l’entrée."
              - search [ref=e106]:
                - generic [ref=e108]:
                  - generic [ref=e109]: Rechercher un événement
                  - searchbox "Rechercher un événement" [ref=e111]
                - button "Explorer" [ref=e112] [cursor=pointer]
            - list [ref=e118]:
              - listitem [ref=e119]:
                - generic [ref=e123]:
                  - paragraph [ref=e124]: Wave et Orange Money
                  - paragraph [ref=e125]: Payez depuis votre téléphone, le billet arrive aussitôt.
              - listitem [ref=e126]:
                - generic [ref=e134]:
                  - paragraph [ref=e135]: QR code dynamique
                  - paragraph [ref=e136]: "Un code renouvelé en continu : une capture d’écran ne passe pas l’entrée."
              - listitem [ref=e137]:
                - generic [ref=e142]:
                  - paragraph [ref=e143]: Remboursement automatique
                  - paragraph [ref=e144]: "Événement annulé : les billets payés en ligne sont remboursés."
          - region [ref=e145]:
            - generic [ref=e146]:
              - generic [ref=e147]:
                - heading "À l’affiche" [level=2] [ref=e148]
                - status [ref=e149]: En direct
              - link "Tous les événements" [ref=e151] [cursor=pointer]:
                - /url: /explore
            - group "Catégorie" [ref=e156]:
              - button "Tous" [pressed] [ref=e157] [cursor=pointer]
              - button "Concerts & Musique" [ref=e158] [cursor=pointer]
              - button "Festivals" [ref=e159] [cursor=pointer]
              - button "Gastronomie & Tables" [ref=e160] [cursor=pointer]
              - button "Salles & Réceptions" [ref=e161] [cursor=pointer]
            - list [ref=e162]:
              - listitem [ref=e163]:
                - article [ref=e164]:
                  - generic [ref=e166]:
                    - generic [ref=e167]:
                      - generic [aria-hidden] [ref=e168]:
                        - generic [ref=e169]: "03"
                        - generic [ref=e170]: NOV
                      - generic [ref=e171]:
                        - paragraph [ref=e172]: Baobab Scène
                        - heading [level=3] [ref=e173]:
                          - link "Nuit du Sabar — édition d’automne" [ref=e174] [cursor=pointer]:
                            - /url: /events/07be8ac0-5ef3-4a3b-9a96-68a6f99946d1
                    - generic [ref=e175]: Concerts & Musique
                    - list [ref=e178]:
                      - listitem [ref=e179]:
                        - generic [ref=e182]: 03 NOV 2026 à 22:45
                      - listitem [ref=e183]:
                        - generic [ref=e187]: Esplanade de la Corniche Ouest, Dakar
                    - generic [ref=e189]:
                      - paragraph [ref=e190]: À partir de
                      - paragraph [ref=e191]: 5 000 F CFA
              - listitem [ref=e195]:
                - article [ref=e196]:
                  - generic [ref=e198]:
                    - generic [ref=e199]:
                      - generic [aria-hidden] [ref=e200]:
                        - generic [ref=e201]: "08"
                        - generic [ref=e202]: NOV
                      - generic [ref=e203]:
                        - paragraph [ref=e204]: Petite-Côte Événements
                        - heading [level=3] [ref=e205]:
                          - link "Marché gourmand de la Petite-Côte" [ref=e206] [cursor=pointer]:
                            - /url: /events/cf411fef-bed9-48ba-ad5c-026ab876568b
                    - generic [ref=e207]: Gastronomie & Tables
                    - list [ref=e210]:
                      - listitem [ref=e211]:
                        - generic [ref=e214]: 08 NOV 2026 à 10:00
                      - listitem [ref=e215]:
                        - generic [ref=e219]: Place du Marché Central, Mbour
                    - generic [ref=e221]:
                      - paragraph [ref=e222]: À partir de
                      - paragraph [ref=e223]: 1 000 F CFA
              - listitem [ref=e227]:
                - article [ref=e228]:
                  - generic [ref=e230]:
                    - generic [ref=e231]:
                      - generic [aria-hidden] [ref=e232]:
                        - generic [ref=e233]: "11"
                        - generic [ref=e234]: NOV
                      - generic [ref=e235]:
                        - paragraph [ref=e236]: Saloum Culture
                        - heading [level=3] [ref=e237]:
                          - link "Dîner-spectacle au bord du Saloum" [ref=e238] [cursor=pointer]:
                            - /url: /events/d5ca7418-064d-4a4f-b642-64ce6ac6886f
                    - generic [ref=e239]: Salles & Réceptions
                    - list [ref=e242]:
                      - listitem [ref=e243]:
                        - generic [ref=e246]: 11 NOV 2026 à 20:00
                      - listitem [ref=e247]:
                        - generic [ref=e251]: Terrasse des Pirogues, Foundiougne
                    - generic [ref=e253]:
                      - paragraph [ref=e254]: À partir de
                      - paragraph [ref=e255]: 25 000 F CFA
              - listitem [ref=e259]:
                - article [ref=e260]:
                  - generic [ref=e262]:
                    - generic [ref=e263]:
                      - generic [aria-hidden] [ref=e264]:
                        - generic [ref=e265]: "15"
                        - generic [ref=e266]: NOV
                      - generic [ref=e267]:
                        - paragraph [ref=e268]: Baobab Scène
                        - heading [level=3] [ref=e269]:
                          - link "Festival Jazz sur le Fleuve" [ref=e270] [cursor=pointer]:
                            - /url: /events/86fb2b08-fef4-4b8e-98b7-b019bd127696
                    - generic [ref=e271]: Festivals
                    - list [ref=e274]:
                      - listitem [ref=e275]:
                        - generic [ref=e278]: 15 NOV 2026 à 18:00
                      - listitem [ref=e279]:
                        - generic [ref=e283]: Quai des Pêcheurs, Saint-Louis
                    - generic [ref=e285]:
                      - paragraph [ref=e286]: À partir de
                      - paragraph [ref=e287]: 7 500 F CFA
              - listitem [ref=e291]:
                - article [ref=e292]:
                  - generic [ref=e294]:
                    - generic [ref=e295]:
                      - generic [aria-hidden] [ref=e296]:
                        - generic [ref=e297]: "20"
                        - generic [ref=e298]: NOV
                      - generic [ref=e299]:
                        - paragraph [ref=e300]: Baobab Scène
                        - heading [level=3] [ref=e301]:
                          - link "Soirée Kora & Lumières" [ref=e302] [cursor=pointer]:
                            - /url: /events/2143ea28-9ab6-4c7d-8aef-e42cec439c44
                    - generic [ref=e303]: Concerts & Musique
                    - list [ref=e306]:
                      - listitem [ref=e307]:
                        - generic [ref=e310]: 20 NOV 2026 à 20:30
                      - listitem [ref=e311]:
                        - generic [ref=e315]: Jardin de la Maison des Arts, Dakar
                    - generic [ref=e317]:
                      - paragraph [ref=e318]: À partir de
                      - paragraph [ref=e319]: 6 000 F CFA
              - listitem [ref=e323]:
                - article [ref=e324]:
                  - generic [ref=e326]:
                    - generic [ref=e327]:
                      - generic [aria-hidden] [ref=e328]:
                        - generic [ref=e329]: "23"
                        - generic [ref=e330]: NOV
                      - generic [ref=e331]:
                        - paragraph [ref=e332]: Orga B (test)
                        - heading [level=3] [ref=e333]:
                          - link "TEST Spectacle B (publié, à venir)" [ref=e334] [cursor=pointer]:
                            - /url: /events/0db6b4ca-7299-4f80-a8d1-9924f0fac599
                    - generic [ref=e335]: Concerts & Musique
                    - list [ref=e338]:
                      - listitem [ref=e339]:
                        - generic [ref=e342]: 23 NOV 2026 à 20:00
                      - listitem [ref=e343]:
                        - generic [ref=e347]: Salle de test, Dakar, Dakar
                    - generic [ref=e349]:
                      - paragraph [ref=e350]: À partir de
                      - paragraph [ref=e351]: 4 000 F CFA
              - listitem [ref=e355]:
                - article [ref=e356]:
                  - generic [ref=e358]:
                    - generic [ref=e359]:
                      - generic [aria-hidden] [ref=e360]:
                        - generic [ref=e361]: "24"
                        - generic [ref=e362]: NOV
                      - generic [ref=e363]:
                        - paragraph [ref=e364]: Saloum Culture
                        - heading [level=3] [ref=e365]:
                          - link "Gala des entrepreneurs du Saloum" [ref=e366] [cursor=pointer]:
                            - /url: /events/b2f3124b-623f-48a3-83e4-2988e1a6b66e
                    - generic [ref=e367]: Salles & Réceptions
                    - list [ref=e370]:
                      - listitem [ref=e371]:
                        - generic [ref=e374]: 24 NOV 2026 à 19:30
                      - listitem [ref=e375]:
                        - generic [ref=e379]: Salle des Palétuviers, Kaolack
                    - generic [ref=e381]:
                      - paragraph [ref=e382]: À partir de
                      - paragraph [ref=e383]: 10 000 F CFA
              - listitem [ref=e387]:
                - article [ref=e388]:
                  - generic [ref=e390]:
                    - generic [ref=e391]:
                      - generic [aria-hidden] [ref=e392]:
                        - generic [ref=e393]: "29"
                        - generic [ref=e394]: NOV
                      - generic [ref=e395]:
                        - paragraph [ref=e396]: Petite-Côte Événements
                        - heading [level=3] [ref=e397]:
                          - link "Festival des rythmes de Casamance" [ref=e398] [cursor=pointer]:
                            - /url: /events/8b91396a-2a6c-4117-a83a-f6153fc0a775
                    - generic [ref=e399]: Festivals
                    - list [ref=e402]:
                      - listitem [ref=e403]:
                        - generic [ref=e406]: 29 NOV 2026 à 17:00
                      - listitem [ref=e407]:
                        - generic [ref=e411]: Esplanade du Port, Ziguinchor
                    - generic [ref=e413]:
                      - paragraph [ref=e414]: À partir de
                      - paragraph [ref=e415]: 5 000 F CFA
          - region [ref=e419]:
            - generic [ref=e420]:
              - paragraph [ref=e421]: Espace organisateur
              - heading "Vous organisez des événements ? Vendez vos billets avec Event Village." [level=2] [ref=e422]
              - list [ref=e423]:
                - listitem [ref=e424]:
                  - generic [ref=e428]: Création et publication de vos événements, validées par notre équipe
                - listitem [ref=e429]:
                  - generic [ref=e433]: Ventes et entrées suivies en direct, contrôleurs et caisses sur place
                - listitem [ref=e434]:
                  - generic [ref=e438]: Fonds versés sur votre compte après l’événement
              - link "Devenir organisateur" [ref=e440] [cursor=pointer]:
                - /url: /partner/register
            - generic [ref=e445]:
              - generic [ref=e446]:
                - heading "Une salle pour votre réception ?" [level=2] [ref=e452]
                - paragraph [ref=e453]: "Mariages, séminaires, galas : consultez les salles disponibles et réservez en ligne."
              - link "Voir les salles" [ref=e454] [cursor=pointer]:
                - /url: /halls
          - generic [ref=e459]:
            - generic [ref=e460]:
              - generic [ref=e461]:
                - paragraph [ref=e462]: Event Village
                - paragraph [ref=e463]: Billetterie, salles et événements au Sénégal.
              - navigation "Liens du pied de page" [ref=e464]:
                - list [ref=e465]:
                  - listitem [ref=e466]:
                    - link "Explorer" [ref=e467] [cursor=pointer]:
                      - /url: /explore
                  - listitem [ref=e469]:
                    - link "Mes billets" [ref=e470] [cursor=pointer]:
                      - /url: /tickets
                  - listitem [ref=e472]:
                    - link "Salles" [ref=e473] [cursor=pointer]:
                      - /url: /halls
                  - listitem [ref=e475]:
                    - link "Devenir organisateur" [ref=e476] [cursor=pointer]:
                      - /url: /partner/register
            - paragraph [ref=e478]: Event Village, 2026. Tous droits réservés.
  - alert [ref=e479]
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
      |                                                                               ^ Error: contrôles bloquants de accueil__ordinateur__sombre.png
  126 |                 });
  127 |             }
  128 |         });
  129 |     }
  130 | }
  131 | 
```