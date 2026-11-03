# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> clair · anonyme >> accueil — Accueil
- Location: e2e/captures.spec.ts:67:21

# Error details

```
Error: contrôles bloquants de accueil__ordinateur__clair.png

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "requête en échec : GET localhost:3000/login?redirect=%2Ftickets : net::ERR_ABORTED",
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
              - paragraph [ref=e96]: Billetterie officielle au Sénégal
              - heading "Découvrez, réservez et vivez les événements qui comptent." [level=1] [ref=e100]
              - paragraph [ref=e101]: "Concerts, festivals, soirées et rencontres : choisissez votre place, payez en quelques secondes et présentez votre billet à l’entrée."
              - search [ref=e102]:
                - generic [ref=e104]:
                  - generic [ref=e105]: Rechercher un événement
                  - searchbox "Rechercher un événement" [ref=e107]
                - button "Explorer" [ref=e108] [cursor=pointer]
            - list [ref=e114]:
              - listitem [ref=e115]:
                - generic [ref=e119]:
                  - paragraph [ref=e120]: Wave et Orange Money
                  - paragraph [ref=e121]: Payez depuis votre téléphone, le billet arrive aussitôt.
              - listitem [ref=e122]:
                - generic [ref=e130]:
                  - paragraph [ref=e131]: QR code dynamique
                  - paragraph [ref=e132]: "Un code renouvelé en continu : une capture d’écran ne passe pas l’entrée."
              - listitem [ref=e133]:
                - generic [ref=e138]:
                  - paragraph [ref=e139]: Remboursement automatique
                  - paragraph [ref=e140]: "Événement annulé : les billets payés en ligne sont remboursés."
          - region [ref=e141]:
            - generic [ref=e142]:
              - generic [ref=e143]:
                - heading "À l’affiche" [level=2] [ref=e144]
                - status [ref=e145]: En direct
              - link "Tous les événements" [ref=e147] [cursor=pointer]:
                - /url: /explore
            - group "Catégorie" [ref=e152]:
              - button "Tous" [pressed] [ref=e153] [cursor=pointer]
              - button "Concerts & Musique" [ref=e154] [cursor=pointer]
              - button "Festivals" [ref=e155] [cursor=pointer]
              - button "Gastronomie & Tables" [ref=e156] [cursor=pointer]
              - button "Salles & Réceptions" [ref=e157] [cursor=pointer]
            - list [ref=e158]:
              - listitem [ref=e159]:
                - article [ref=e160]:
                  - generic [ref=e162]:
                    - generic [ref=e163]:
                      - generic [aria-hidden] [ref=e164]:
                        - generic [ref=e165]: "03"
                        - generic [ref=e166]: NOV
                      - generic [ref=e167]:
                        - paragraph [ref=e168]: Baobab Scène
                        - heading [level=3] [ref=e169]:
                          - link "Nuit du Sabar — édition d’automne" [ref=e170] [cursor=pointer]:
                            - /url: /events/07be8ac0-5ef3-4a3b-9a96-68a6f99946d1
                    - generic [ref=e171]: Concerts & Musique
                    - list [ref=e174]:
                      - listitem [ref=e175]:
                        - generic [ref=e178]: 03 NOV 2026 à 22:45
                      - listitem [ref=e179]:
                        - generic [ref=e183]: Esplanade de la Corniche Ouest, Dakar
                    - generic [ref=e185]:
                      - paragraph [ref=e186]: À partir de
                      - paragraph [ref=e187]: 5 000 F CFA
              - listitem [ref=e191]:
                - article [ref=e192]:
                  - generic [ref=e194]:
                    - generic [ref=e195]:
                      - generic [aria-hidden] [ref=e196]:
                        - generic [ref=e197]: "08"
                        - generic [ref=e198]: NOV
                      - generic [ref=e199]:
                        - paragraph [ref=e200]: Petite-Côte Événements
                        - heading [level=3] [ref=e201]:
                          - link "Marché gourmand de la Petite-Côte" [ref=e202] [cursor=pointer]:
                            - /url: /events/cf411fef-bed9-48ba-ad5c-026ab876568b
                    - generic [ref=e203]: Gastronomie & Tables
                    - list [ref=e206]:
                      - listitem [ref=e207]:
                        - generic [ref=e210]: 08 NOV 2026 à 10:00
                      - listitem [ref=e211]:
                        - generic [ref=e215]: Place du Marché Central, Mbour
                    - generic [ref=e217]:
                      - paragraph [ref=e218]: À partir de
                      - paragraph [ref=e219]: 1 000 F CFA
              - listitem [ref=e223]:
                - article [ref=e224]:
                  - generic [ref=e226]:
                    - generic [ref=e227]:
                      - generic [aria-hidden] [ref=e228]:
                        - generic [ref=e229]: "11"
                        - generic [ref=e230]: NOV
                      - generic [ref=e231]:
                        - paragraph [ref=e232]: Saloum Culture
                        - heading [level=3] [ref=e233]:
                          - link "Dîner-spectacle au bord du Saloum" [ref=e234] [cursor=pointer]:
                            - /url: /events/d5ca7418-064d-4a4f-b642-64ce6ac6886f
                    - generic [ref=e235]: Salles & Réceptions
                    - list [ref=e238]:
                      - listitem [ref=e239]:
                        - generic [ref=e242]: 11 NOV 2026 à 20:00
                      - listitem [ref=e243]:
                        - generic [ref=e247]: Terrasse des Pirogues, Foundiougne
                    - generic [ref=e249]:
                      - paragraph [ref=e250]: À partir de
                      - paragraph [ref=e251]: 25 000 F CFA
              - listitem [ref=e255]:
                - article [ref=e256]:
                  - generic [ref=e258]:
                    - generic [ref=e259]:
                      - generic [aria-hidden] [ref=e260]:
                        - generic [ref=e261]: "15"
                        - generic [ref=e262]: NOV
                      - generic [ref=e263]:
                        - paragraph [ref=e264]: Baobab Scène
                        - heading [level=3] [ref=e265]:
                          - link "Festival Jazz sur le Fleuve" [ref=e266] [cursor=pointer]:
                            - /url: /events/86fb2b08-fef4-4b8e-98b7-b019bd127696
                    - generic [ref=e267]: Festivals
                    - list [ref=e270]:
                      - listitem [ref=e271]:
                        - generic [ref=e274]: 15 NOV 2026 à 18:00
                      - listitem [ref=e275]:
                        - generic [ref=e279]: Quai des Pêcheurs, Saint-Louis
                    - generic [ref=e281]:
                      - paragraph [ref=e282]: À partir de
                      - paragraph [ref=e283]: 7 500 F CFA
              - listitem [ref=e287]:
                - article [ref=e288]:
                  - generic [ref=e290]:
                    - generic [ref=e291]:
                      - generic [aria-hidden] [ref=e292]:
                        - generic [ref=e293]: "20"
                        - generic [ref=e294]: NOV
                      - generic [ref=e295]:
                        - paragraph [ref=e296]: Baobab Scène
                        - heading [level=3] [ref=e297]:
                          - link "Soirée Kora & Lumières" [ref=e298] [cursor=pointer]:
                            - /url: /events/2143ea28-9ab6-4c7d-8aef-e42cec439c44
                    - generic [ref=e299]: Concerts & Musique
                    - list [ref=e302]:
                      - listitem [ref=e303]:
                        - generic [ref=e306]: 20 NOV 2026 à 20:30
                      - listitem [ref=e307]:
                        - generic [ref=e311]: Jardin de la Maison des Arts, Dakar
                    - generic [ref=e313]:
                      - paragraph [ref=e314]: À partir de
                      - paragraph [ref=e315]: 6 000 F CFA
              - listitem [ref=e319]:
                - article [ref=e320]:
                  - generic [ref=e322]:
                    - generic [ref=e323]:
                      - generic [aria-hidden] [ref=e324]:
                        - generic [ref=e325]: "23"
                        - generic [ref=e326]: NOV
                      - generic [ref=e327]:
                        - paragraph [ref=e328]: Orga B (test)
                        - heading [level=3] [ref=e329]:
                          - link "TEST Spectacle B (publié, à venir)" [ref=e330] [cursor=pointer]:
                            - /url: /events/0db6b4ca-7299-4f80-a8d1-9924f0fac599
                    - generic [ref=e331]: Concerts & Musique
                    - list [ref=e334]:
                      - listitem [ref=e335]:
                        - generic [ref=e338]: 23 NOV 2026 à 20:00
                      - listitem [ref=e339]:
                        - generic [ref=e343]: Salle de test, Dakar, Dakar
                    - generic [ref=e345]:
                      - paragraph [ref=e346]: À partir de
                      - paragraph [ref=e347]: 4 000 F CFA
              - listitem [ref=e351]:
                - article [ref=e352]:
                  - generic [ref=e354]:
                    - generic [ref=e355]:
                      - generic [aria-hidden] [ref=e356]:
                        - generic [ref=e357]: "24"
                        - generic [ref=e358]: NOV
                      - generic [ref=e359]:
                        - paragraph [ref=e360]: Saloum Culture
                        - heading [level=3] [ref=e361]:
                          - link "Gala des entrepreneurs du Saloum" [ref=e362] [cursor=pointer]:
                            - /url: /events/b2f3124b-623f-48a3-83e4-2988e1a6b66e
                    - generic [ref=e363]: Salles & Réceptions
                    - list [ref=e366]:
                      - listitem [ref=e367]:
                        - generic [ref=e370]: 24 NOV 2026 à 19:30
                      - listitem [ref=e371]:
                        - generic [ref=e375]: Salle des Palétuviers, Kaolack
                    - generic [ref=e377]:
                      - paragraph [ref=e378]: À partir de
                      - paragraph [ref=e379]: 10 000 F CFA
              - listitem [ref=e383]:
                - article [ref=e384]:
                  - generic [ref=e386]:
                    - generic [ref=e387]:
                      - generic [aria-hidden] [ref=e388]:
                        - generic [ref=e389]: "29"
                        - generic [ref=e390]: NOV
                      - generic [ref=e391]:
                        - paragraph [ref=e392]: Petite-Côte Événements
                        - heading [level=3] [ref=e393]:
                          - link "Festival des rythmes de Casamance" [ref=e394] [cursor=pointer]:
                            - /url: /events/8b91396a-2a6c-4117-a83a-f6153fc0a775
                    - generic [ref=e395]: Festivals
                    - list [ref=e398]:
                      - listitem [ref=e399]:
                        - generic [ref=e402]: 29 NOV 2026 à 17:00
                      - listitem [ref=e403]:
                        - generic [ref=e407]: Esplanade du Port, Ziguinchor
                    - generic [ref=e409]:
                      - paragraph [ref=e410]: À partir de
                      - paragraph [ref=e411]: 5 000 F CFA
          - region [ref=e415]:
            - generic [ref=e416]:
              - paragraph [ref=e417]: Espace organisateur
              - heading "Vous organisez des événements ? Vendez vos billets avec Event Village." [level=2] [ref=e418]
              - list [ref=e419]:
                - listitem [ref=e420]:
                  - generic [ref=e424]: Création et publication de vos événements, validées par notre équipe
                - listitem [ref=e425]:
                  - generic [ref=e429]: Ventes et entrées suivies en direct, contrôleurs et caisses sur place
                - listitem [ref=e430]:
                  - generic [ref=e434]: Fonds versés sur votre compte après l’événement
              - link "Devenir organisateur" [ref=e436] [cursor=pointer]:
                - /url: /partner/register
            - generic [ref=e441]:
              - generic [ref=e442]:
                - heading "Une salle pour votre réception ?" [level=2] [ref=e448]
                - paragraph [ref=e449]: "Mariages, séminaires, galas : consultez les salles disponibles et réservez en ligne."
              - link "Voir les salles" [ref=e450] [cursor=pointer]:
                - /url: /halls
          - generic [ref=e455]:
            - generic [ref=e456]:
              - generic [ref=e457]:
                - paragraph [ref=e458]: Event Village
                - paragraph [ref=e459]: Billetterie, salles et événements au Sénégal.
              - navigation "Liens du pied de page" [ref=e460]:
                - list [ref=e461]:
                  - listitem [ref=e462]:
                    - link "Explorer" [ref=e463] [cursor=pointer]:
                      - /url: /explore
                  - listitem [ref=e465]:
                    - link "Mes billets" [ref=e466] [cursor=pointer]:
                      - /url: /tickets
                  - listitem [ref=e468]:
                    - link "Salles" [ref=e469] [cursor=pointer]:
                      - /url: /halls
                  - listitem [ref=e471]:
                    - link "Devenir organisateur" [ref=e472] [cursor=pointer]:
                      - /url: /partner/register
            - paragraph [ref=e474]: Event Village, 2026. Tous droits réservés.
  - alert [ref=e475]
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
      |                                                                               ^ Error: contrôles bloquants de accueil__ordinateur__clair.png
  126 |                 });
  127 |             }
  128 |         });
  129 |     }
  130 | }
  131 | 
```