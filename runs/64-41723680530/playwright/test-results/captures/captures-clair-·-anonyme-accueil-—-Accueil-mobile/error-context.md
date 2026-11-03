# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> clair · anonyme >> accueil — Accueil
- Location: e2e/captures.spec.ts:67:21

# Error details

```
Error: contrôles bloquants de accueil__mobile__clair.png

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
              - paragraph [ref=e37]: Billetterie officielle au Sénégal
              - heading "Découvrez, réservez et vivez les événements qui comptent." [level=1] [ref=e41]
              - paragraph [ref=e42]: "Concerts, festivals, soirées et rencontres : choisissez votre place, payez en quelques secondes et présentez votre billet à l’entrée."
              - search [ref=e43]:
                - generic [ref=e45]:
                  - generic [ref=e46]: Rechercher un événement
                  - searchbox "Rechercher un événement" [ref=e48]
                - button "Explorer" [ref=e49] [cursor=pointer]
            - list [ref=e55]:
              - listitem [ref=e56]:
                - generic [ref=e60]:
                  - paragraph [ref=e61]: Wave et Orange Money
                  - paragraph [ref=e62]: Payez depuis votre téléphone, le billet arrive aussitôt.
              - listitem [ref=e63]:
                - generic [ref=e71]:
                  - paragraph [ref=e72]: QR code dynamique
                  - paragraph [ref=e73]: "Un code renouvelé en continu : une capture d’écran ne passe pas l’entrée."
              - listitem [ref=e74]:
                - generic [ref=e79]:
                  - paragraph [ref=e80]: Remboursement automatique
                  - paragraph [ref=e81]: "Événement annulé : les billets payés en ligne sont remboursés."
          - region [ref=e82]:
            - generic [ref=e83]:
              - generic [ref=e84]:
                - heading "À l’affiche" [level=2] [ref=e85]
                - status [ref=e86]: En direct
              - link "Tous les événements" [ref=e88] [cursor=pointer]:
                - /url: /explore
            - group "Catégorie" [ref=e93]:
              - button "Tous" [pressed] [ref=e94] [cursor=pointer]
              - button "Concerts & Musique" [ref=e95] [cursor=pointer]
              - button "Festivals" [ref=e96] [cursor=pointer]
              - button "Gastronomie & Tables" [ref=e97] [cursor=pointer]
              - button "Salles & Réceptions" [ref=e98] [cursor=pointer]
            - list [ref=e99]:
              - listitem [ref=e100]:
                - article [ref=e101]:
                  - generic [ref=e103]:
                    - generic [ref=e104]:
                      - generic [aria-hidden] [ref=e105]:
                        - generic [ref=e106]: "03"
                        - generic [ref=e107]: NOV
                      - generic [ref=e108]:
                        - paragraph [ref=e109]: Baobab Scène
                        - heading [level=3] [ref=e110]:
                          - link "Nuit du Sabar — édition d’automne" [ref=e111] [cursor=pointer]:
                            - /url: /events/07be8ac0-5ef3-4a3b-9a96-68a6f99946d1
                    - generic [ref=e112]: Concerts & Musique
                    - list [ref=e115]:
                      - listitem [ref=e116]:
                        - generic [ref=e119]: 03 NOV 2026 à 22:45
                      - listitem [ref=e120]:
                        - generic [ref=e124]: Esplanade de la Corniche Ouest, Dakar
                    - generic [ref=e126]:
                      - paragraph [ref=e127]: À partir de
                      - paragraph [ref=e128]: 5 000 F CFA
              - listitem [ref=e132]:
                - article [ref=e133]:
                  - generic [ref=e135]:
                    - generic [ref=e136]:
                      - generic [aria-hidden] [ref=e137]:
                        - generic [ref=e138]: "08"
                        - generic [ref=e139]: NOV
                      - generic [ref=e140]:
                        - paragraph [ref=e141]: Petite-Côte Événements
                        - heading [level=3] [ref=e142]:
                          - link "Marché gourmand de la Petite-Côte" [ref=e143] [cursor=pointer]:
                            - /url: /events/cf411fef-bed9-48ba-ad5c-026ab876568b
                    - generic [ref=e144]: Gastronomie & Tables
                    - list [ref=e147]:
                      - listitem [ref=e148]:
                        - generic [ref=e151]: 08 NOV 2026 à 10:00
                      - listitem [ref=e152]:
                        - generic [ref=e156]: Place du Marché Central, Mbour
                    - generic [ref=e158]:
                      - paragraph [ref=e159]: À partir de
                      - paragraph [ref=e160]: 1 000 F CFA
              - listitem [ref=e164]:
                - article [ref=e165]:
                  - generic [ref=e167]:
                    - generic [ref=e168]:
                      - generic [aria-hidden] [ref=e169]:
                        - generic [ref=e170]: "11"
                        - generic [ref=e171]: NOV
                      - generic [ref=e172]:
                        - paragraph [ref=e173]: Saloum Culture
                        - heading [level=3] [ref=e174]:
                          - link "Dîner-spectacle au bord du Saloum" [ref=e175] [cursor=pointer]:
                            - /url: /events/d5ca7418-064d-4a4f-b642-64ce6ac6886f
                    - generic [ref=e176]: Salles & Réceptions
                    - list [ref=e179]:
                      - listitem [ref=e180]:
                        - generic [ref=e183]: 11 NOV 2026 à 20:00
                      - listitem [ref=e184]:
                        - generic [ref=e188]: Terrasse des Pirogues, Foundiougne
                    - generic [ref=e190]:
                      - paragraph [ref=e191]: À partir de
                      - paragraph [ref=e192]: 25 000 F CFA
              - listitem [ref=e196]:
                - article [ref=e197]:
                  - generic [ref=e199]:
                    - generic [ref=e200]:
                      - generic [aria-hidden] [ref=e201]:
                        - generic [ref=e202]: "15"
                        - generic [ref=e203]: NOV
                      - generic [ref=e204]:
                        - paragraph [ref=e205]: Baobab Scène
                        - heading [level=3] [ref=e206]:
                          - link "Festival Jazz sur le Fleuve" [ref=e207] [cursor=pointer]:
                            - /url: /events/86fb2b08-fef4-4b8e-98b7-b019bd127696
                    - generic [ref=e208]: Festivals
                    - list [ref=e211]:
                      - listitem [ref=e212]:
                        - generic [ref=e215]: 15 NOV 2026 à 18:00
                      - listitem [ref=e216]:
                        - generic [ref=e220]: Quai des Pêcheurs, Saint-Louis
                    - generic [ref=e222]:
                      - paragraph [ref=e223]: À partir de
                      - paragraph [ref=e224]: 7 500 F CFA
              - listitem [ref=e228]:
                - article [ref=e229]:
                  - generic [ref=e231]:
                    - generic [ref=e232]:
                      - generic [aria-hidden] [ref=e233]:
                        - generic [ref=e234]: "20"
                        - generic [ref=e235]: NOV
                      - generic [ref=e236]:
                        - paragraph [ref=e237]: Baobab Scène
                        - heading [level=3] [ref=e238]:
                          - link "Soirée Kora & Lumières" [ref=e239] [cursor=pointer]:
                            - /url: /events/2143ea28-9ab6-4c7d-8aef-e42cec439c44
                    - generic [ref=e240]: Concerts & Musique
                    - list [ref=e243]:
                      - listitem [ref=e244]:
                        - generic [ref=e247]: 20 NOV 2026 à 20:30
                      - listitem [ref=e248]:
                        - generic [ref=e252]: Jardin de la Maison des Arts, Dakar
                    - generic [ref=e254]:
                      - paragraph [ref=e255]: À partir de
                      - paragraph [ref=e256]: 6 000 F CFA
              - listitem [ref=e260]:
                - article [ref=e261]:
                  - generic [ref=e263]:
                    - generic [ref=e264]:
                      - generic [aria-hidden] [ref=e265]:
                        - generic [ref=e266]: "23"
                        - generic [ref=e267]: NOV
                      - generic [ref=e268]:
                        - paragraph [ref=e269]: Orga B (test)
                        - heading [level=3] [ref=e270]:
                          - link "TEST Spectacle B (publié, à venir)" [ref=e271] [cursor=pointer]:
                            - /url: /events/0db6b4ca-7299-4f80-a8d1-9924f0fac599
                    - generic [ref=e272]: Concerts & Musique
                    - list [ref=e275]:
                      - listitem [ref=e276]:
                        - generic [ref=e279]: 23 NOV 2026 à 20:00
                      - listitem [ref=e280]:
                        - generic [ref=e284]: Salle de test, Dakar, Dakar
                    - generic [ref=e286]:
                      - paragraph [ref=e287]: À partir de
                      - paragraph [ref=e288]: 4 000 F CFA
              - listitem [ref=e292]:
                - article [ref=e293]:
                  - generic [ref=e295]:
                    - generic [ref=e296]:
                      - generic [aria-hidden] [ref=e297]:
                        - generic [ref=e298]: "24"
                        - generic [ref=e299]: NOV
                      - generic [ref=e300]:
                        - paragraph [ref=e301]: Saloum Culture
                        - heading [level=3] [ref=e302]:
                          - link "Gala des entrepreneurs du Saloum" [ref=e303] [cursor=pointer]:
                            - /url: /events/b2f3124b-623f-48a3-83e4-2988e1a6b66e
                    - generic [ref=e304]: Salles & Réceptions
                    - list [ref=e307]:
                      - listitem [ref=e308]:
                        - generic [ref=e311]: 24 NOV 2026 à 19:30
                      - listitem [ref=e312]:
                        - generic [ref=e316]: Salle des Palétuviers, Kaolack
                    - generic [ref=e318]:
                      - paragraph [ref=e319]: À partir de
                      - paragraph [ref=e320]: 10 000 F CFA
              - listitem [ref=e324]:
                - article [ref=e325]:
                  - generic [ref=e327]:
                    - generic [ref=e328]:
                      - generic [aria-hidden] [ref=e329]:
                        - generic [ref=e330]: "29"
                        - generic [ref=e331]: NOV
                      - generic [ref=e332]:
                        - paragraph [ref=e333]: Petite-Côte Événements
                        - heading [level=3] [ref=e334]:
                          - link "Festival des rythmes de Casamance" [ref=e335] [cursor=pointer]:
                            - /url: /events/8b91396a-2a6c-4117-a83a-f6153fc0a775
                    - generic [ref=e336]: Festivals
                    - list [ref=e339]:
                      - listitem [ref=e340]:
                        - generic [ref=e343]: 29 NOV 2026 à 17:00
                      - listitem [ref=e344]:
                        - generic [ref=e348]: Esplanade du Port, Ziguinchor
                    - generic [ref=e350]:
                      - paragraph [ref=e351]: À partir de
                      - paragraph [ref=e352]: 5 000 F CFA
          - region [ref=e356]:
            - generic [ref=e357]:
              - paragraph [ref=e358]: Espace organisateur
              - heading "Vous organisez des événements ? Vendez vos billets avec Event Village." [level=2] [ref=e359]
              - list [ref=e360]:
                - listitem [ref=e361]:
                  - generic [ref=e365]: Création et publication de vos événements, validées par notre équipe
                - listitem [ref=e366]:
                  - generic [ref=e370]: Ventes et entrées suivies en direct, contrôleurs et caisses sur place
                - listitem [ref=e371]:
                  - generic [ref=e375]: Fonds versés sur votre compte après l’événement
              - link "Devenir organisateur" [ref=e377] [cursor=pointer]:
                - /url: /partner/register
            - generic [ref=e382]:
              - generic [ref=e383]:
                - heading "Une salle pour votre réception ?" [level=2] [ref=e389]
                - paragraph [ref=e390]: "Mariages, séminaires, galas : consultez les salles disponibles et réservez en ligne."
              - link "Voir les salles" [ref=e391] [cursor=pointer]:
                - /url: /halls
          - generic [ref=e396]:
            - generic [ref=e397]:
              - generic [ref=e398]:
                - paragraph [ref=e399]: Event Village
                - paragraph [ref=e400]: Billetterie, salles et événements au Sénégal.
              - navigation "Liens du pied de page" [ref=e401]:
                - list [ref=e402]:
                  - listitem [ref=e403]:
                    - link "Explorer" [ref=e404] [cursor=pointer]:
                      - /url: /explore
                  - listitem [ref=e406]:
                    - link "Mes billets" [ref=e407] [cursor=pointer]:
                      - /url: /tickets
                  - listitem [ref=e409]:
                    - link "Salles" [ref=e410] [cursor=pointer]:
                      - /url: /halls
                  - listitem [ref=e412]:
                    - link "Devenir organisateur" [ref=e413] [cursor=pointer]:
                      - /url: /partner/register
            - paragraph [ref=e415]: Event Village, 2026. Tous droits réservés.
    - navigation "Navigation rapide" [ref=e416]:
      - generic [ref=e417]:
        - link "Accueil" [ref=e418] [cursor=pointer]:
          - /url: /
        - link "Explorer" [ref=e423] [cursor=pointer]:
          - /url: /explore
        - link "Billets" [ref=e428] [cursor=pointer]:
          - /url: /tickets
        - link "Achats" [ref=e432] [cursor=pointer]:
          - /url: /orders
        - link "Solde" [ref=e437] [cursor=pointer]:
          - /url: /wallet
  - alert [ref=e442]
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
      |                                                                               ^ Error: contrôles bloquants de accueil__mobile__clair.png
  126 |                 });
  127 |             }
  128 |         });
  129 |     }
  130 | }
  131 | 
```