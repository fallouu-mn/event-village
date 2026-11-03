# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> clair · anonyme >> evenement-publie — Page publique — événement publié (ce soir)
- Location: e2e/captures.spec.ts:67:21

# Error details

```
Error: contrôles bloquants de evenement-publie__ordinateur__clair.png

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
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
        - button "Basculer le thème" [ref=e72] [cursor=pointer]
    - generic [ref=e76]:
      - banner [ref=e77]:
        - link "Rechercher un événement, un concert, un restaurant…" [ref=e79] [cursor=pointer]:
          - /url: /explore
        - button "Notifications" [ref=e86] [cursor=pointer]
      - main [ref=e90]:
        - generic [ref=e92]:
          - generic [ref=e93]:
            - link "Retour aux événements" [ref=e94] [cursor=pointer]:
              - /url: /explore
            - generic [ref=e99]:
              - status [ref=e100]: En direct
              - button "Partager l’événement" [ref=e102] [cursor=pointer]
          - generic [ref=e110]:
            - generic [ref=e111]:
              - img "Affiche de l’événement Nuit du Sabar — édition d’automne" [ref=e113]
              - generic [ref=e114]:
                - generic [ref=e115]: Concerts & Musique
                - heading "Nuit du Sabar — édition d’automne" [level=1] [ref=e118]
                - paragraph [ref=e119]: Organisé par Baobab Scène
              - generic [ref=e120]:
                - generic [ref=e125]:
                  - paragraph [ref=e126]: Date et heure
                  - generic [ref=e127]: Mardi 3 novembre 2026 à 22:45
                - generic [ref=e133]:
                  - paragraph [ref=e134]: Lieu
                  - generic [ref=e135]: Esplanade de la Corniche Ouest, Dakar
              - generic [ref=e136]:
                - heading "À propos de l’événement" [level=2] [ref=e137]
                - paragraph [ref=e138]: Une nuit entière de sabar avec quatre troupes de percussionnistes et danseurs, en plein air face à l’océan. Restauration sur place, accès aux personnes à mobilité réduite par l’entrée principale.
              - generic [ref=e139]:
                - heading "Programme" [level=2] [ref=e140]
                - list [ref=e144]:
                  - listitem [ref=e145]:
                    - generic [ref=e147]:
                      - paragraph [ref=e148]: 19:30
                      - generic [ref=e149]: Activité
                    - paragraph [ref=e151]: Ouverture des portes
                  - listitem [ref=e152]:
                    - generic [ref=e154]:
                      - paragraph [ref=e155]: 20:30
                      - generic [ref=e156]: Artiste
                    - paragraph [ref=e158]: Première partie
                    - paragraph [ref=e159]: Troupe Kër Gëstu
                  - listitem [ref=e160]:
                    - generic [ref=e162]:
                      - paragraph [ref=e163]: 22:00
                      - generic [ref=e164]: Artiste
                    - paragraph [ref=e166]: Grand cercle de sabar
                    - paragraph [ref=e167]: Ensemble Ndawrabine des Parcelles
                  - listitem [ref=e168]:
                    - generic [ref=e170]:
                      - paragraph [ref=e171]: 23:30
                      - generic [ref=e172]: Activité
                    - paragraph [ref=e174]: Bœuf final avec le public
              - generic [ref=e175]:
                - heading "Lieu et accès" [level=2] [ref=e176]
                - generic [ref=e181]:
                  - paragraph [ref=e182]: Esplanade de la Corniche Ouest
                  - paragraph [ref=e183]: Esplanade de la Corniche Ouest, Dakar
                - 'region "Carte : Esplanade de la Corniche Ouest" [ref=e184]':
                  - generic:
                    - 'img "Emplacement : Esplanade de la Corniche Ouest" [ref=e185] [cursor=pointer]'
                    - generic [ref=e186]:
                      - strong [ref=e189]: Esplanade de la Corniche Ouest
                      - button "Fermer la bulle" [ref=e191] [cursor=pointer]: ×
                  - generic:
                    - generic [ref=e192]:
                      - button "Zoom avant" [ref=e193] [cursor=pointer]: +
                      - button "Zoom arrière" [ref=e194] [cursor=pointer]: −
                    - generic [ref=e195]:
                      - link "Leaflet" [ref=e196] [cursor=pointer]:
                        - /url: https://leafletjs.com
                      - text: "| © contributeurs OpenStreetMap"
                - link "Voir l’itinéraire" [ref=e201] [cursor=pointer]:
                  - /url: https://www.google.com/maps/dir/?api=1&destination=14.6833,-17.4676
                - generic [ref=e211]:
                  - generic [ref=e218]:
                    - paragraph [ref=e219]: Stationnement
                    - generic [ref=e220]: Stationnement surveillé à proximité.
                  - generic [ref=e226]:
                    - paragraph [ref=e227]: Règlement et consignes
                    - generic [ref=e228]: Billet présenté sur téléphone ; pièce d’identité pour les entrées à saisie manuelle.
              - generic [ref=e231]:
                - paragraph [ref=e232]: Organisateur
                - heading "Baobab Scène" [level=2] [ref=e233]
            - complementary [ref=e234]:
              - generic [ref=e235]:
                - heading "Choisissez vos billets" [level=2] [ref=e236]
                - paragraph [ref=e237]: Places et disponibilités mises à jour en direct.
              - list [ref=e238]:
                - listitem [ref=e239]:
                  - generic [ref=e240]:
                    - generic [ref=e241]:
                      - heading "Standard" [level=3] [ref=e242]
                      - paragraph [ref=e243]: 5 000 F CFA
                      - paragraph [ref=e244]: Disponible
                      - paragraph [ref=e245]: Accès à l’esplanade.
                    - group "Quantité Standard" [ref=e246]:
                      - button "Retirer un billet Standard" [disabled] [ref=e247]
                      - status [ref=e250]: "0"
                      - button "Ajouter un billet Standard" [ref=e251] [cursor=pointer]
                - listitem [ref=e254]:
                  - generic [ref=e255]:
                    - generic [ref=e256]:
                      - heading "VIP" [level=3] [ref=e257]
                      - paragraph [ref=e258]: 15 000 F CFA
                      - paragraph [ref=e259]: Disponible
                      - paragraph [ref=e260]: Carré assis, entrée dédiée, une boisson offerte.
                    - group "Quantité VIP" [ref=e261]:
                      - button "Retirer un billet VIP" [disabled] [ref=e262]
                      - status [ref=e265]: "0"
                      - button "Ajouter un billet VIP" [ref=e266] [cursor=pointer]
              - paragraph [ref=e269]: Choisissez au moins un billet avec le bouton « + ».
  - alert [ref=e270]
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
      |                                                                               ^ Error: contrôles bloquants de evenement-publie__ordinateur__clair.png
  126 |                 });
  127 |             }
  128 |         });
  129 |     }
  130 | }
  131 | 
```