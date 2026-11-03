# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · anonyme >> evenement-publie — Page publique — événement publié (ce soir)
- Location: e2e/captures.spec.ts:67:21

# Error details

```
Error: contrôles bloquants de evenement-publie__mobile__sombre.png

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 4

- Array []
+ Array [
+   "requête en échec : GET localhost:3000/login?redirect=%2Ftickets : net::ERR_ABORTED",
+   "requête en échec : GET localhost:3000/login?redirect=%2Forders : net::ERR_ABORTED",
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
          - generic [ref=e38]:
            - link "Retour aux événements" [ref=e39] [cursor=pointer]:
              - /url: /explore
            - generic [ref=e44]:
              - status [ref=e45]: En direct
              - button "Partager l’événement" [ref=e47] [cursor=pointer]
          - generic [ref=e55]:
            - generic [ref=e56]:
              - img "Affiche de l’événement Nuit du Sabar — édition d’automne" [ref=e58]
              - generic [ref=e59]:
                - generic [ref=e60]: Concerts & Musique
                - heading "Nuit du Sabar — édition d’automne" [level=1] [ref=e63]
                - paragraph [ref=e64]: Organisé par Baobab Scène
              - generic [ref=e65]:
                - generic [ref=e70]:
                  - paragraph [ref=e71]: Date et heure
                  - generic [ref=e72]: Mardi 3 novembre 2026 à 22:45
                - generic [ref=e78]:
                  - paragraph [ref=e79]: Lieu
                  - generic [ref=e80]: Esplanade de la Corniche Ouest, Dakar
              - generic [ref=e81]:
                - heading "À propos de l’événement" [level=2] [ref=e82]
                - paragraph [ref=e83]: Une nuit entière de sabar avec quatre troupes de percussionnistes et danseurs, en plein air face à l’océan. Restauration sur place, accès aux personnes à mobilité réduite par l’entrée principale.
              - generic [ref=e84]:
                - heading "Programme" [level=2] [ref=e85]
                - list [ref=e89]:
                  - listitem [ref=e90]:
                    - generic [ref=e92]:
                      - paragraph [ref=e93]: 19:30
                      - generic [ref=e94]: Activité
                    - paragraph [ref=e96]: Ouverture des portes
                  - listitem [ref=e97]:
                    - generic [ref=e99]:
                      - paragraph [ref=e100]: 20:30
                      - generic [ref=e101]: Artiste
                    - paragraph [ref=e103]: Première partie
                    - paragraph [ref=e104]: Troupe Kër Gëstu
                  - listitem [ref=e105]:
                    - generic [ref=e107]:
                      - paragraph [ref=e108]: 22:00
                      - generic [ref=e109]: Artiste
                    - paragraph [ref=e111]: Grand cercle de sabar
                    - paragraph [ref=e112]: Ensemble Ndawrabine des Parcelles
                  - listitem [ref=e113]:
                    - generic [ref=e115]:
                      - paragraph [ref=e116]: 23:30
                      - generic [ref=e117]: Activité
                    - paragraph [ref=e119]: Bœuf final avec le public
              - generic [ref=e120]:
                - heading "Lieu et accès" [level=2] [ref=e121]
                - generic [ref=e126]:
                  - paragraph [ref=e127]: Esplanade de la Corniche Ouest
                  - paragraph [ref=e128]: Esplanade de la Corniche Ouest, Dakar
                - 'region "Carte : Esplanade de la Corniche Ouest" [ref=e129]':
                  - generic:
                    - 'img "Emplacement : Esplanade de la Corniche Ouest" [ref=e130] [cursor=pointer]'
                    - generic [ref=e131]:
                      - strong [ref=e134]: Esplanade de la Corniche Ouest
                      - button "Fermer la bulle" [ref=e136] [cursor=pointer]: ×
                  - generic:
                    - generic [ref=e137]:
                      - button "Zoom avant" [ref=e138] [cursor=pointer]: +
                      - button "Zoom arrière" [ref=e139] [cursor=pointer]: −
                    - generic [ref=e140]:
                      - link "Leaflet" [ref=e141] [cursor=pointer]:
                        - /url: https://leafletjs.com
                      - text: "| © contributeurs OpenStreetMap"
                - link "Voir l’itinéraire" [ref=e146] [cursor=pointer]:
                  - /url: https://www.google.com/maps/dir/?api=1&destination=14.6833,-17.4676
                - generic [ref=e156]:
                  - generic [ref=e163]:
                    - paragraph [ref=e164]: Stationnement
                    - generic [ref=e165]: Stationnement surveillé à proximité.
                  - generic [ref=e171]:
                    - paragraph [ref=e172]: Règlement et consignes
                    - generic [ref=e173]: Billet présenté sur téléphone ; pièce d’identité pour les entrées à saisie manuelle.
              - generic [ref=e176]:
                - paragraph [ref=e177]: Organisateur
                - heading "Baobab Scène" [level=2] [ref=e178]
            - complementary [ref=e179]:
              - generic [ref=e180]:
                - heading "Choisissez vos billets" [level=2] [ref=e181]
                - paragraph [ref=e182]: Places et disponibilités mises à jour en direct.
              - list [ref=e183]:
                - listitem [ref=e184]:
                  - generic [ref=e185]:
                    - generic [ref=e186]:
                      - heading "Standard" [level=3] [ref=e187]
                      - paragraph [ref=e188]: 5 000 F CFA
                      - paragraph [ref=e189]: Disponible
                      - paragraph [ref=e190]: Accès à l’esplanade.
                    - group "Quantité Standard" [ref=e191]:
                      - button "Retirer un billet Standard" [disabled] [ref=e192]
                      - status [ref=e195]: "0"
                      - button "Ajouter un billet Standard" [ref=e196] [cursor=pointer]
                - listitem [ref=e199]:
                  - generic [ref=e200]:
                    - generic [ref=e201]:
                      - heading "VIP" [level=3] [ref=e202]
                      - paragraph [ref=e203]: 15 000 F CFA
                      - paragraph [ref=e204]: Disponible
                      - paragraph [ref=e205]: Carré assis, entrée dédiée, une boisson offerte.
                    - group "Quantité VIP" [ref=e206]:
                      - button "Retirer un billet VIP" [disabled] [ref=e207]
                      - status [ref=e210]: "0"
                      - button "Ajouter un billet VIP" [ref=e211] [cursor=pointer]
              - paragraph [ref=e214]: Choisissez au moins un billet avec le bouton « + ».
    - navigation "Navigation rapide" [ref=e215]:
      - generic [ref=e216]:
        - link "Accueil" [ref=e217] [cursor=pointer]:
          - /url: /
        - link "Explorer" [ref=e222] [cursor=pointer]:
          - /url: /explore
        - link "Billets" [ref=e227] [cursor=pointer]:
          - /url: /tickets
        - link "Achats" [ref=e231] [cursor=pointer]:
          - /url: /orders
        - link "Solde" [ref=e236] [cursor=pointer]:
          - /url: /wallet
  - alert [ref=e241]
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
      |                                                                               ^ Error: contrôles bloquants de evenement-publie__mobile__sombre.png
  126 |                 });
  127 |             }
  128 |         });
  129 |     }
  130 | }
  131 | 
```