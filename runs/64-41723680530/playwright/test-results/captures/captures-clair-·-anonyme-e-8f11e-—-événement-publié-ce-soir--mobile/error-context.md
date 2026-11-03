# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> clair · anonyme >> evenement-publie — Page publique — événement publié (ce soir)
- Location: e2e/captures.spec.ts:67:21

# Error details

```
Error: contrôles bloquants de evenement-publie__mobile__clair.png

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
          - generic [ref=e34]:
            - link "Retour aux événements" [ref=e35] [cursor=pointer]:
              - /url: /explore
            - generic [ref=e40]:
              - status [ref=e41]: En direct
              - button "Partager l’événement" [ref=e43] [cursor=pointer]
          - generic [ref=e51]:
            - generic [ref=e52]:
              - img "Affiche de l’événement Nuit du Sabar — édition d’automne" [ref=e54]
              - generic [ref=e55]:
                - generic [ref=e56]: Concerts & Musique
                - heading "Nuit du Sabar — édition d’automne" [level=1] [ref=e59]
                - paragraph [ref=e60]: Organisé par Baobab Scène
              - generic [ref=e61]:
                - generic [ref=e66]:
                  - paragraph [ref=e67]: Date et heure
                  - generic [ref=e68]: Mardi 3 novembre 2026 à 22:45
                - generic [ref=e74]:
                  - paragraph [ref=e75]: Lieu
                  - generic [ref=e76]: Esplanade de la Corniche Ouest, Dakar
              - generic [ref=e77]:
                - heading "À propos de l’événement" [level=2] [ref=e78]
                - paragraph [ref=e79]: Une nuit entière de sabar avec quatre troupes de percussionnistes et danseurs, en plein air face à l’océan. Restauration sur place, accès aux personnes à mobilité réduite par l’entrée principale.
              - generic [ref=e80]:
                - heading "Programme" [level=2] [ref=e81]
                - list [ref=e85]:
                  - listitem [ref=e86]:
                    - generic [ref=e88]:
                      - paragraph [ref=e89]: 19:30
                      - generic [ref=e90]: Activité
                    - paragraph [ref=e92]: Ouverture des portes
                  - listitem [ref=e93]:
                    - generic [ref=e95]:
                      - paragraph [ref=e96]: 20:30
                      - generic [ref=e97]: Artiste
                    - paragraph [ref=e99]: Première partie
                    - paragraph [ref=e100]: Troupe Kër Gëstu
                  - listitem [ref=e101]:
                    - generic [ref=e103]:
                      - paragraph [ref=e104]: 22:00
                      - generic [ref=e105]: Artiste
                    - paragraph [ref=e107]: Grand cercle de sabar
                    - paragraph [ref=e108]: Ensemble Ndawrabine des Parcelles
                  - listitem [ref=e109]:
                    - generic [ref=e111]:
                      - paragraph [ref=e112]: 23:30
                      - generic [ref=e113]: Activité
                    - paragraph [ref=e115]: Bœuf final avec le public
              - generic [ref=e116]:
                - heading "Lieu et accès" [level=2] [ref=e117]
                - generic [ref=e122]:
                  - paragraph [ref=e123]: Esplanade de la Corniche Ouest
                  - paragraph [ref=e124]: Esplanade de la Corniche Ouest, Dakar
                - 'region "Carte : Esplanade de la Corniche Ouest" [ref=e125]':
                  - generic:
                    - 'img "Emplacement : Esplanade de la Corniche Ouest" [ref=e126] [cursor=pointer]'
                    - generic [ref=e127]:
                      - strong [ref=e130]: Esplanade de la Corniche Ouest
                      - button "Fermer la bulle" [ref=e132] [cursor=pointer]: ×
                  - generic:
                    - generic [ref=e133]:
                      - button "Zoom avant" [ref=e134] [cursor=pointer]: +
                      - button "Zoom arrière" [ref=e135] [cursor=pointer]: −
                    - generic [ref=e136]:
                      - link "Leaflet" [ref=e137] [cursor=pointer]:
                        - /url: https://leafletjs.com
                      - text: "| © contributeurs OpenStreetMap"
                - link "Voir l’itinéraire" [ref=e142] [cursor=pointer]:
                  - /url: https://www.google.com/maps/dir/?api=1&destination=14.6833,-17.4676
                - generic [ref=e152]:
                  - generic [ref=e159]:
                    - paragraph [ref=e160]: Stationnement
                    - generic [ref=e161]: Stationnement surveillé à proximité.
                  - generic [ref=e167]:
                    - paragraph [ref=e168]: Règlement et consignes
                    - generic [ref=e169]: Billet présenté sur téléphone ; pièce d’identité pour les entrées à saisie manuelle.
              - generic [ref=e172]:
                - paragraph [ref=e173]: Organisateur
                - heading "Baobab Scène" [level=2] [ref=e174]
            - complementary [ref=e175]:
              - generic [ref=e176]:
                - heading "Choisissez vos billets" [level=2] [ref=e177]
                - paragraph [ref=e178]: Places et disponibilités mises à jour en direct.
              - list [ref=e179]:
                - listitem [ref=e180]:
                  - generic [ref=e181]:
                    - generic [ref=e182]:
                      - heading "Standard" [level=3] [ref=e183]
                      - paragraph [ref=e184]: 5 000 F CFA
                      - paragraph [ref=e185]: Disponible
                      - paragraph [ref=e186]: Accès à l’esplanade.
                    - group "Quantité Standard" [ref=e187]:
                      - button "Retirer un billet Standard" [disabled] [ref=e188]
                      - status [ref=e191]: "0"
                      - button "Ajouter un billet Standard" [ref=e192] [cursor=pointer]
                - listitem [ref=e195]:
                  - generic [ref=e196]:
                    - generic [ref=e197]:
                      - heading "VIP" [level=3] [ref=e198]
                      - paragraph [ref=e199]: 15 000 F CFA
                      - paragraph [ref=e200]: Disponible
                      - paragraph [ref=e201]: Carré assis, entrée dédiée, une boisson offerte.
                    - group "Quantité VIP" [ref=e202]:
                      - button "Retirer un billet VIP" [disabled] [ref=e203]
                      - status [ref=e206]: "0"
                      - button "Ajouter un billet VIP" [ref=e207] [cursor=pointer]
              - paragraph [ref=e210]: Choisissez au moins un billet avec le bouton « + ».
    - navigation "Navigation rapide" [ref=e211]:
      - generic [ref=e212]:
        - link "Accueil" [ref=e213] [cursor=pointer]:
          - /url: /
        - link "Explorer" [ref=e218] [cursor=pointer]:
          - /url: /explore
        - link "Billets" [ref=e223] [cursor=pointer]:
          - /url: /tickets
        - link "Achats" [ref=e227] [cursor=pointer]:
          - /url: /orders
        - link "Solde" [ref=e232] [cursor=pointer]:
          - /url: /wallet
  - alert [ref=e237]
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
      |                                                                               ^ Error: contrôles bloquants de evenement-publie__mobile__clair.png
  126 |                 });
  127 |             }
  128 |         });
  129 |     }
  130 | }
  131 | 
```