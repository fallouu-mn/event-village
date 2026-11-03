# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · anonyme >> evenement-publie — Page publique — événement publié (ce soir)
- Location: e2e/captures.spec.ts:67:21

# Error details

```
Error: contrôles bloquants de evenement-publie__ordinateur__sombre.png

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
          - generic [ref=e97]:
            - link "Retour aux événements" [ref=e98] [cursor=pointer]:
              - /url: /explore
            - generic [ref=e103]:
              - status [ref=e104]: En direct
              - button "Partager l’événement" [ref=e106] [cursor=pointer]
          - generic [ref=e114]:
            - generic [ref=e115]:
              - img "Affiche de l’événement Nuit du Sabar — édition d’automne" [ref=e117]
              - generic [ref=e118]:
                - generic [ref=e119]: Concerts & Musique
                - heading "Nuit du Sabar — édition d’automne" [level=1] [ref=e122]
                - paragraph [ref=e123]: Organisé par Baobab Scène
              - generic [ref=e124]:
                - generic [ref=e129]:
                  - paragraph [ref=e130]: Date et heure
                  - generic [ref=e131]: Mardi 3 novembre 2026 à 22:45
                - generic [ref=e137]:
                  - paragraph [ref=e138]: Lieu
                  - generic [ref=e139]: Esplanade de la Corniche Ouest, Dakar
              - generic [ref=e140]:
                - heading "À propos de l’événement" [level=2] [ref=e141]
                - paragraph [ref=e142]: Une nuit entière de sabar avec quatre troupes de percussionnistes et danseurs, en plein air face à l’océan. Restauration sur place, accès aux personnes à mobilité réduite par l’entrée principale.
              - generic [ref=e143]:
                - heading "Programme" [level=2] [ref=e144]
                - list [ref=e148]:
                  - listitem [ref=e149]:
                    - generic [ref=e151]:
                      - paragraph [ref=e152]: 19:30
                      - generic [ref=e153]: Activité
                    - paragraph [ref=e155]: Ouverture des portes
                  - listitem [ref=e156]:
                    - generic [ref=e158]:
                      - paragraph [ref=e159]: 20:30
                      - generic [ref=e160]: Artiste
                    - paragraph [ref=e162]: Première partie
                    - paragraph [ref=e163]: Troupe Kër Gëstu
                  - listitem [ref=e164]:
                    - generic [ref=e166]:
                      - paragraph [ref=e167]: 22:00
                      - generic [ref=e168]: Artiste
                    - paragraph [ref=e170]: Grand cercle de sabar
                    - paragraph [ref=e171]: Ensemble Ndawrabine des Parcelles
                  - listitem [ref=e172]:
                    - generic [ref=e174]:
                      - paragraph [ref=e175]: 23:30
                      - generic [ref=e176]: Activité
                    - paragraph [ref=e178]: Bœuf final avec le public
              - generic [ref=e179]:
                - heading "Lieu et accès" [level=2] [ref=e180]
                - generic [ref=e185]:
                  - paragraph [ref=e186]: Esplanade de la Corniche Ouest
                  - paragraph [ref=e187]: Esplanade de la Corniche Ouest, Dakar
                - 'region "Carte : Esplanade de la Corniche Ouest" [ref=e188]':
                  - generic:
                    - 'img "Emplacement : Esplanade de la Corniche Ouest" [ref=e189] [cursor=pointer]'
                    - generic [ref=e190]:
                      - strong [ref=e193]: Esplanade de la Corniche Ouest
                      - button "Fermer la bulle" [ref=e195] [cursor=pointer]: ×
                  - generic:
                    - generic [ref=e196]:
                      - button "Zoom avant" [ref=e197] [cursor=pointer]: +
                      - button "Zoom arrière" [ref=e198] [cursor=pointer]: −
                    - generic [ref=e199]:
                      - link "Leaflet" [ref=e200] [cursor=pointer]:
                        - /url: https://leafletjs.com
                      - text: "| © contributeurs OpenStreetMap"
                - link "Voir l’itinéraire" [ref=e205] [cursor=pointer]:
                  - /url: https://www.google.com/maps/dir/?api=1&destination=14.6833,-17.4676
                - generic [ref=e215]:
                  - generic [ref=e222]:
                    - paragraph [ref=e223]: Stationnement
                    - generic [ref=e224]: Stationnement surveillé à proximité.
                  - generic [ref=e230]:
                    - paragraph [ref=e231]: Règlement et consignes
                    - generic [ref=e232]: Billet présenté sur téléphone ; pièce d’identité pour les entrées à saisie manuelle.
              - generic [ref=e235]:
                - paragraph [ref=e236]: Organisateur
                - heading "Baobab Scène" [level=2] [ref=e237]
            - complementary [ref=e238]:
              - generic [ref=e239]:
                - heading "Choisissez vos billets" [level=2] [ref=e240]
                - paragraph [ref=e241]: Places et disponibilités mises à jour en direct.
              - list [ref=e242]:
                - listitem [ref=e243]:
                  - generic [ref=e244]:
                    - generic [ref=e245]:
                      - heading "Standard" [level=3] [ref=e246]
                      - paragraph [ref=e247]: 5 000 F CFA
                      - paragraph [ref=e248]: Disponible
                      - paragraph [ref=e249]: Accès à l’esplanade.
                    - group "Quantité Standard" [ref=e250]:
                      - button "Retirer un billet Standard" [disabled] [ref=e251]
                      - status [ref=e254]: "0"
                      - button "Ajouter un billet Standard" [ref=e255] [cursor=pointer]
                - listitem [ref=e258]:
                  - generic [ref=e259]:
                    - generic [ref=e260]:
                      - heading "VIP" [level=3] [ref=e261]
                      - paragraph [ref=e262]: 15 000 F CFA
                      - paragraph [ref=e263]: Disponible
                      - paragraph [ref=e264]: Carré assis, entrée dédiée, une boisson offerte.
                    - group "Quantité VIP" [ref=e265]:
                      - button "Retirer un billet VIP" [disabled] [ref=e266]
                      - status [ref=e269]: "0"
                      - button "Ajouter un billet VIP" [ref=e270] [cursor=pointer]
              - paragraph [ref=e273]: Choisissez au moins un billet avec le bouton « + ».
  - alert [ref=e274]
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
      |                                                                               ^ Error: contrôles bloquants de evenement-publie__ordinateur__sombre.png
  126 |                 });
  127 |             }
  128 |         });
  129 |     }
  130 | }
  131 | 
```