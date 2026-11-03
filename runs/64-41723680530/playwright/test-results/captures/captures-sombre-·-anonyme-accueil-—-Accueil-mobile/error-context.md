# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · anonyme >> accueil — Accueil
- Location: e2e/captures.spec.ts:67:21

# Error details

```
Error: contrôles bloquants de accueil__mobile__sombre.png

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
              - paragraph [ref=e41]: Billetterie officielle au Sénégal
              - heading "Découvrez, réservez et vivez les événements qui comptent." [level=1] [ref=e45]
              - paragraph [ref=e46]: "Concerts, festivals, soirées et rencontres : choisissez votre place, payez en quelques secondes et présentez votre billet à l’entrée."
              - search [ref=e47]:
                - generic [ref=e49]:
                  - generic [ref=e50]: Rechercher un événement
                  - searchbox "Rechercher un événement" [ref=e52]
                - button "Explorer" [ref=e53] [cursor=pointer]
            - list [ref=e59]:
              - listitem [ref=e60]:
                - generic [ref=e64]:
                  - paragraph [ref=e65]: Wave et Orange Money
                  - paragraph [ref=e66]: Payez depuis votre téléphone, le billet arrive aussitôt.
              - listitem [ref=e67]:
                - generic [ref=e75]:
                  - paragraph [ref=e76]: QR code dynamique
                  - paragraph [ref=e77]: "Un code renouvelé en continu : une capture d’écran ne passe pas l’entrée."
              - listitem [ref=e78]:
                - generic [ref=e83]:
                  - paragraph [ref=e84]: Remboursement automatique
                  - paragraph [ref=e85]: "Événement annulé : les billets payés en ligne sont remboursés."
          - region [ref=e86]:
            - generic [ref=e87]:
              - generic [ref=e88]:
                - heading "À l’affiche" [level=2] [ref=e89]
                - status [ref=e90]: En direct
              - link "Tous les événements" [ref=e92] [cursor=pointer]:
                - /url: /explore
            - group "Catégorie" [ref=e97]:
              - button "Tous" [pressed] [ref=e98] [cursor=pointer]
              - button "Concerts & Musique" [ref=e99] [cursor=pointer]
              - button "Festivals" [ref=e100] [cursor=pointer]
              - button "Gastronomie & Tables" [ref=e101] [cursor=pointer]
              - button "Salles & Réceptions" [ref=e102] [cursor=pointer]
            - list [ref=e103]:
              - listitem [ref=e104]:
                - article [ref=e105]:
                  - generic [ref=e107]:
                    - generic [ref=e108]:
                      - generic [aria-hidden] [ref=e109]:
                        - generic [ref=e110]: "03"
                        - generic [ref=e111]: NOV
                      - generic [ref=e112]:
                        - paragraph [ref=e113]: Baobab Scène
                        - heading [level=3] [ref=e114]:
                          - link "Nuit du Sabar — édition d’automne" [ref=e115] [cursor=pointer]:
                            - /url: /events/07be8ac0-5ef3-4a3b-9a96-68a6f99946d1
                    - generic [ref=e116]: Concerts & Musique
                    - list [ref=e119]:
                      - listitem [ref=e120]:
                        - generic [ref=e123]: 03 NOV 2026 à 22:45
                      - listitem [ref=e124]:
                        - generic [ref=e128]: Esplanade de la Corniche Ouest, Dakar
                    - generic [ref=e130]:
                      - paragraph [ref=e131]: À partir de
                      - paragraph [ref=e132]: 5 000 F CFA
              - listitem [ref=e136]:
                - article [ref=e137]:
                  - generic [ref=e139]:
                    - generic [ref=e140]:
                      - generic [aria-hidden] [ref=e141]:
                        - generic [ref=e142]: "08"
                        - generic [ref=e143]: NOV
                      - generic [ref=e144]:
                        - paragraph [ref=e145]: Petite-Côte Événements
                        - heading [level=3] [ref=e146]:
                          - link "Marché gourmand de la Petite-Côte" [ref=e147] [cursor=pointer]:
                            - /url: /events/cf411fef-bed9-48ba-ad5c-026ab876568b
                    - generic [ref=e148]: Gastronomie & Tables
                    - list [ref=e151]:
                      - listitem [ref=e152]:
                        - generic [ref=e155]: 08 NOV 2026 à 10:00
                      - listitem [ref=e156]:
                        - generic [ref=e160]: Place du Marché Central, Mbour
                    - generic [ref=e162]:
                      - paragraph [ref=e163]: À partir de
                      - paragraph [ref=e164]: 1 000 F CFA
              - listitem [ref=e168]:
                - article [ref=e169]:
                  - generic [ref=e171]:
                    - generic [ref=e172]:
                      - generic [aria-hidden] [ref=e173]:
                        - generic [ref=e174]: "11"
                        - generic [ref=e175]: NOV
                      - generic [ref=e176]:
                        - paragraph [ref=e177]: Saloum Culture
                        - heading [level=3] [ref=e178]:
                          - link "Dîner-spectacle au bord du Saloum" [ref=e179] [cursor=pointer]:
                            - /url: /events/d5ca7418-064d-4a4f-b642-64ce6ac6886f
                    - generic [ref=e180]: Salles & Réceptions
                    - list [ref=e183]:
                      - listitem [ref=e184]:
                        - generic [ref=e187]: 11 NOV 2026 à 20:00
                      - listitem [ref=e188]:
                        - generic [ref=e192]: Terrasse des Pirogues, Foundiougne
                    - generic [ref=e194]:
                      - paragraph [ref=e195]: À partir de
                      - paragraph [ref=e196]: 25 000 F CFA
              - listitem [ref=e200]:
                - article [ref=e201]:
                  - generic [ref=e203]:
                    - generic [ref=e204]:
                      - generic [aria-hidden] [ref=e205]:
                        - generic [ref=e206]: "15"
                        - generic [ref=e207]: NOV
                      - generic [ref=e208]:
                        - paragraph [ref=e209]: Baobab Scène
                        - heading [level=3] [ref=e210]:
                          - link "Festival Jazz sur le Fleuve" [ref=e211] [cursor=pointer]:
                            - /url: /events/86fb2b08-fef4-4b8e-98b7-b019bd127696
                    - generic [ref=e212]: Festivals
                    - list [ref=e215]:
                      - listitem [ref=e216]:
                        - generic [ref=e219]: 15 NOV 2026 à 18:00
                      - listitem [ref=e220]:
                        - generic [ref=e224]: Quai des Pêcheurs, Saint-Louis
                    - generic [ref=e226]:
                      - paragraph [ref=e227]: À partir de
                      - paragraph [ref=e228]: 7 500 F CFA
              - listitem [ref=e232]:
                - article [ref=e233]:
                  - generic [ref=e235]:
                    - generic [ref=e236]:
                      - generic [aria-hidden] [ref=e237]:
                        - generic [ref=e238]: "20"
                        - generic [ref=e239]: NOV
                      - generic [ref=e240]:
                        - paragraph [ref=e241]: Baobab Scène
                        - heading [level=3] [ref=e242]:
                          - link "Soirée Kora & Lumières" [ref=e243] [cursor=pointer]:
                            - /url: /events/2143ea28-9ab6-4c7d-8aef-e42cec439c44
                    - generic [ref=e244]: Concerts & Musique
                    - list [ref=e247]:
                      - listitem [ref=e248]:
                        - generic [ref=e251]: 20 NOV 2026 à 20:30
                      - listitem [ref=e252]:
                        - generic [ref=e256]: Jardin de la Maison des Arts, Dakar
                    - generic [ref=e258]:
                      - paragraph [ref=e259]: À partir de
                      - paragraph [ref=e260]: 6 000 F CFA
              - listitem [ref=e264]:
                - article [ref=e265]:
                  - generic [ref=e267]:
                    - generic [ref=e268]:
                      - generic [aria-hidden] [ref=e269]:
                        - generic [ref=e270]: "23"
                        - generic [ref=e271]: NOV
                      - generic [ref=e272]:
                        - paragraph [ref=e273]: Orga B (test)
                        - heading [level=3] [ref=e274]:
                          - link "TEST Spectacle B (publié, à venir)" [ref=e275] [cursor=pointer]:
                            - /url: /events/0db6b4ca-7299-4f80-a8d1-9924f0fac599
                    - generic [ref=e276]: Concerts & Musique
                    - list [ref=e279]:
                      - listitem [ref=e280]:
                        - generic [ref=e283]: 23 NOV 2026 à 20:00
                      - listitem [ref=e284]:
                        - generic [ref=e288]: Salle de test, Dakar, Dakar
                    - generic [ref=e290]:
                      - paragraph [ref=e291]: À partir de
                      - paragraph [ref=e292]: 4 000 F CFA
              - listitem [ref=e296]:
                - article [ref=e297]:
                  - generic [ref=e299]:
                    - generic [ref=e300]:
                      - generic [aria-hidden] [ref=e301]:
                        - generic [ref=e302]: "24"
                        - generic [ref=e303]: NOV
                      - generic [ref=e304]:
                        - paragraph [ref=e305]: Saloum Culture
                        - heading [level=3] [ref=e306]:
                          - link "Gala des entrepreneurs du Saloum" [ref=e307] [cursor=pointer]:
                            - /url: /events/b2f3124b-623f-48a3-83e4-2988e1a6b66e
                    - generic [ref=e308]: Salles & Réceptions
                    - list [ref=e311]:
                      - listitem [ref=e312]:
                        - generic [ref=e315]: 24 NOV 2026 à 19:30
                      - listitem [ref=e316]:
                        - generic [ref=e320]: Salle des Palétuviers, Kaolack
                    - generic [ref=e322]:
                      - paragraph [ref=e323]: À partir de
                      - paragraph [ref=e324]: 10 000 F CFA
              - listitem [ref=e328]:
                - article [ref=e329]:
                  - generic [ref=e331]:
                    - generic [ref=e332]:
                      - generic [aria-hidden] [ref=e333]:
                        - generic [ref=e334]: "29"
                        - generic [ref=e335]: NOV
                      - generic [ref=e336]:
                        - paragraph [ref=e337]: Petite-Côte Événements
                        - heading [level=3] [ref=e338]:
                          - link "Festival des rythmes de Casamance" [ref=e339] [cursor=pointer]:
                            - /url: /events/8b91396a-2a6c-4117-a83a-f6153fc0a775
                    - generic [ref=e340]: Festivals
                    - list [ref=e343]:
                      - listitem [ref=e344]:
                        - generic [ref=e347]: 29 NOV 2026 à 17:00
                      - listitem [ref=e348]:
                        - generic [ref=e352]: Esplanade du Port, Ziguinchor
                    - generic [ref=e354]:
                      - paragraph [ref=e355]: À partir de
                      - paragraph [ref=e356]: 5 000 F CFA
          - region [ref=e360]:
            - generic [ref=e361]:
              - paragraph [ref=e362]: Espace organisateur
              - heading "Vous organisez des événements ? Vendez vos billets avec Event Village." [level=2] [ref=e363]
              - list [ref=e364]:
                - listitem [ref=e365]:
                  - generic [ref=e369]: Création et publication de vos événements, validées par notre équipe
                - listitem [ref=e370]:
                  - generic [ref=e374]: Ventes et entrées suivies en direct, contrôleurs et caisses sur place
                - listitem [ref=e375]:
                  - generic [ref=e379]: Fonds versés sur votre compte après l’événement
              - link "Devenir organisateur" [ref=e381] [cursor=pointer]:
                - /url: /partner/register
            - generic [ref=e386]:
              - generic [ref=e387]:
                - heading "Une salle pour votre réception ?" [level=2] [ref=e393]
                - paragraph [ref=e394]: "Mariages, séminaires, galas : consultez les salles disponibles et réservez en ligne."
              - link "Voir les salles" [ref=e395] [cursor=pointer]:
                - /url: /halls
          - generic [ref=e400]:
            - generic [ref=e401]:
              - generic [ref=e402]:
                - paragraph [ref=e403]: Event Village
                - paragraph [ref=e404]: Billetterie, salles et événements au Sénégal.
              - navigation "Liens du pied de page" [ref=e405]:
                - list [ref=e406]:
                  - listitem [ref=e407]:
                    - link "Explorer" [ref=e408] [cursor=pointer]:
                      - /url: /explore
                  - listitem [ref=e410]:
                    - link "Mes billets" [ref=e411] [cursor=pointer]:
                      - /url: /tickets
                  - listitem [ref=e413]:
                    - link "Salles" [ref=e414] [cursor=pointer]:
                      - /url: /halls
                  - listitem [ref=e416]:
                    - link "Devenir organisateur" [ref=e417] [cursor=pointer]:
                      - /url: /partner/register
            - paragraph [ref=e419]: Event Village, 2026. Tous droits réservés.
    - navigation "Navigation rapide" [ref=e420]:
      - generic [ref=e421]:
        - link "Accueil" [ref=e422] [cursor=pointer]:
          - /url: /
        - link "Explorer" [ref=e427] [cursor=pointer]:
          - /url: /explore
        - link "Billets" [ref=e432] [cursor=pointer]:
          - /url: /tickets
        - link "Achats" [ref=e436] [cursor=pointer]:
          - /url: /orders
        - link "Solde" [ref=e441] [cursor=pointer]:
          - /url: /wallet
  - alert [ref=e446]
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
      |                                                                               ^ Error: contrôles bloquants de accueil__mobile__sombre.png
  126 |                 });
  127 |             }
  128 |         });
  129 |     }
  130 | }
  131 | 
```