# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> clair · anonyme >> evenement-suspendu — Page publique — événement suspendu (bandeau, sans achat)
- Location: e2e/captures.spec.ts:67:21

# Error details

```
Error: contrôles bloquants de evenement-suspendu__mobile__clair.png

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
          - status [ref=e51]:
            - generic [ref=e56]:
              - paragraph [ref=e57]: Événement suspendu
              - paragraph [ref=e59]: La billetterie est momentanément fermée par l’organisation. Les billets déjà achetés restent valables ; vous serez informé de la suite.
          - generic [ref=e60]:
            - generic [ref=e61]:
              - img "Affiche de l’événement Rencontres du conte et de la parole" [ref=e63]
              - generic [ref=e64]:
                - generic [ref=e65]: Festivals
                - heading "Rencontres du conte et de la parole" [level=1] [ref=e68]
                - paragraph [ref=e69]: Organisé par Saloum Culture
              - generic [ref=e70]:
                - generic [ref=e75]:
                  - paragraph [ref=e76]: Date et heure
                  - generic [ref=e77]: Jeudi 12 novembre 2026 à 16:00
                - generic [ref=e83]:
                  - paragraph [ref=e84]: Lieu
                  - generic [ref=e85]: Cour de l’ancienne gare, Kaolack
              - generic [ref=e86]:
                - heading "À propos de l’événement" [level=2] [ref=e87]
                - paragraph [ref=e88]: Conteurs et griots de toute la région pour un après-midi de récits et de chants.
              - generic [ref=e89]:
                - heading "Programme" [level=2] [ref=e90]
                - list [ref=e94]:
                  - listitem [ref=e95]:
                    - generic [ref=e97]:
                      - paragraph [ref=e98]: 16:00
                      - generic [ref=e99]: Intervenant
                    - paragraph [ref=e101]: Contes pour les enfants
                    - paragraph [ref=e102]: Conteuse invitée
                  - listitem [ref=e103]:
                    - generic [ref=e105]:
                      - paragraph [ref=e106]: 19:00
                      - generic [ref=e107]: Artiste
                    - paragraph [ref=e109]: Veillée de la parole
              - generic [ref=e110]:
                - heading "Lieu et accès" [level=2] [ref=e111]
                - generic [ref=e116]:
                  - paragraph [ref=e117]: Cour de l’ancienne gare
                  - paragraph [ref=e118]: Cour de l’ancienne gare, Kaolack
                - 'region "Carte : Cour de l’ancienne gare" [ref=e119]':
                  - generic:
                    - 'img "Emplacement : Cour de l’ancienne gare" [ref=e120] [cursor=pointer]'
                    - generic [ref=e121]:
                      - strong [ref=e124]: Cour de l’ancienne gare
                      - button "Fermer la bulle" [ref=e126] [cursor=pointer]: ×
                  - generic:
                    - generic [ref=e127]:
                      - button "Zoom avant" [ref=e128] [cursor=pointer]: +
                      - button "Zoom arrière" [ref=e129] [cursor=pointer]: −
                    - generic [ref=e130]:
                      - link "Leaflet" [ref=e131] [cursor=pointer]:
                        - /url: https://leafletjs.com
                      - text: "| © contributeurs OpenStreetMap"
                - link "Voir l’itinéraire" [ref=e136] [cursor=pointer]:
                  - /url: https://www.google.com/maps/dir/?api=1&destination=14.1468,-16.0726
                - generic [ref=e146]:
                  - generic [ref=e153]:
                    - paragraph [ref=e154]: Stationnement
                    - generic [ref=e155]: Stationnement surveillé à proximité.
                  - generic [ref=e161]:
                    - paragraph [ref=e162]: Règlement et consignes
                    - generic [ref=e163]: Billet présenté sur téléphone ; pièce d’identité pour les entrées à saisie manuelle.
              - generic [ref=e166]:
                - paragraph [ref=e167]: Organisateur
                - heading "Saloum Culture" [level=2] [ref=e168]
            - complementary [ref=e169]:
              - generic [ref=e170]:
                - heading "Billetterie" [level=2] [ref=e171]
                - paragraph [ref=e172]: La vente de billets est fermée pour cet événement.
              - list "Formules" [ref=e173]:
                - listitem [ref=e174]:
                  - paragraph [ref=e176]: Entrée
                  - paragraph [ref=e177]: 3 000 F CFA
              - link "Voir d’autres événements" [ref=e178] [cursor=pointer]:
                - /url: /explore
    - navigation "Navigation rapide" [ref=e184]:
      - generic [ref=e185]:
        - link "Accueil" [ref=e186] [cursor=pointer]:
          - /url: /
        - link "Explorer" [ref=e191] [cursor=pointer]:
          - /url: /explore
        - link "Billets" [ref=e196] [cursor=pointer]:
          - /url: /tickets
        - link "Achats" [ref=e200] [cursor=pointer]:
          - /url: /orders
        - link "Solde" [ref=e205] [cursor=pointer]:
          - /url: /wallet
  - alert [ref=e210]
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
      |                                                                               ^ Error: contrôles bloquants de evenement-suspendu__mobile__clair.png
  126 |                 });
  127 |             }
  128 |         });
  129 |     }
  130 | }
  131 | 
```