# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · anonyme >> evenement-suspendu — Page publique — événement suspendu (bandeau, sans achat)
- Location: e2e/captures.spec.ts:67:21

# Error details

```
Error: contrôles bloquants de evenement-suspendu__mobile__sombre.png

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
          - status [ref=e55]:
            - generic [ref=e60]:
              - paragraph [ref=e61]: Événement suspendu
              - paragraph [ref=e63]: La billetterie est momentanément fermée par l’organisation. Les billets déjà achetés restent valables ; vous serez informé de la suite.
          - generic [ref=e64]:
            - generic [ref=e65]:
              - img "Affiche de l’événement Rencontres du conte et de la parole" [ref=e67]
              - generic [ref=e68]:
                - generic [ref=e69]: Festivals
                - heading "Rencontres du conte et de la parole" [level=1] [ref=e72]
                - paragraph [ref=e73]: Organisé par Saloum Culture
              - generic [ref=e74]:
                - generic [ref=e79]:
                  - paragraph [ref=e80]: Date et heure
                  - generic [ref=e81]: Jeudi 12 novembre 2026 à 16:00
                - generic [ref=e87]:
                  - paragraph [ref=e88]: Lieu
                  - generic [ref=e89]: Cour de l’ancienne gare, Kaolack
              - generic [ref=e90]:
                - heading "À propos de l’événement" [level=2] [ref=e91]
                - paragraph [ref=e92]: Conteurs et griots de toute la région pour un après-midi de récits et de chants.
              - generic [ref=e93]:
                - heading "Programme" [level=2] [ref=e94]
                - list [ref=e98]:
                  - listitem [ref=e99]:
                    - generic [ref=e101]:
                      - paragraph [ref=e102]: 16:00
                      - generic [ref=e103]: Intervenant
                    - paragraph [ref=e105]: Contes pour les enfants
                    - paragraph [ref=e106]: Conteuse invitée
                  - listitem [ref=e107]:
                    - generic [ref=e109]:
                      - paragraph [ref=e110]: 19:00
                      - generic [ref=e111]: Artiste
                    - paragraph [ref=e113]: Veillée de la parole
              - generic [ref=e114]:
                - heading "Lieu et accès" [level=2] [ref=e115]
                - generic [ref=e120]:
                  - paragraph [ref=e121]: Cour de l’ancienne gare
                  - paragraph [ref=e122]: Cour de l’ancienne gare, Kaolack
                - 'region "Carte : Cour de l’ancienne gare" [ref=e123]':
                  - generic:
                    - 'img "Emplacement : Cour de l’ancienne gare" [ref=e124] [cursor=pointer]'
                    - generic [ref=e125]:
                      - strong [ref=e128]: Cour de l’ancienne gare
                      - button "Fermer la bulle" [ref=e130] [cursor=pointer]: ×
                  - generic:
                    - generic [ref=e131]:
                      - button "Zoom avant" [ref=e132] [cursor=pointer]: +
                      - button "Zoom arrière" [ref=e133] [cursor=pointer]: −
                    - generic [ref=e134]:
                      - link "Leaflet" [ref=e135] [cursor=pointer]:
                        - /url: https://leafletjs.com
                      - text: "| © contributeurs OpenStreetMap"
                - link "Voir l’itinéraire" [ref=e140] [cursor=pointer]:
                  - /url: https://www.google.com/maps/dir/?api=1&destination=14.1468,-16.0726
                - generic [ref=e150]:
                  - generic [ref=e157]:
                    - paragraph [ref=e158]: Stationnement
                    - generic [ref=e159]: Stationnement surveillé à proximité.
                  - generic [ref=e165]:
                    - paragraph [ref=e166]: Règlement et consignes
                    - generic [ref=e167]: Billet présenté sur téléphone ; pièce d’identité pour les entrées à saisie manuelle.
              - generic [ref=e170]:
                - paragraph [ref=e171]: Organisateur
                - heading "Saloum Culture" [level=2] [ref=e172]
            - complementary [ref=e173]:
              - generic [ref=e174]:
                - heading "Billetterie" [level=2] [ref=e175]
                - paragraph [ref=e176]: La vente de billets est fermée pour cet événement.
              - list "Formules" [ref=e177]:
                - listitem [ref=e178]:
                  - paragraph [ref=e180]: Entrée
                  - paragraph [ref=e181]: 3 000 F CFA
              - link "Voir d’autres événements" [ref=e182] [cursor=pointer]:
                - /url: /explore
    - navigation "Navigation rapide" [ref=e188]:
      - generic [ref=e189]:
        - link "Accueil" [ref=e190] [cursor=pointer]:
          - /url: /
        - link "Explorer" [ref=e195] [cursor=pointer]:
          - /url: /explore
        - link "Billets" [ref=e200] [cursor=pointer]:
          - /url: /tickets
        - link "Achats" [ref=e204] [cursor=pointer]:
          - /url: /orders
        - link "Solde" [ref=e209] [cursor=pointer]:
          - /url: /wallet
  - alert [ref=e214]
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
      |                                                                               ^ Error: contrôles bloquants de evenement-suspendu__mobile__sombre.png
  126 |                 });
  127 |             }
  128 |         });
  129 |     }
  130 | }
  131 | 
```