# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · anonyme >> evenement-annule — Page publique — événement annulé (avis public, remboursement)
- Location: e2e/captures.spec.ts:67:21

# Error details

```
Error: contrôles bloquants de evenement-annule__ordinateur__sombre.png

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
          - status [ref=e114]:
            - generic [ref=e119]:
              - paragraph [ref=e120]: Événement annulé
              - generic [ref=e121]:
                - paragraph [ref=e122]: Cet événement n’aura pas lieu. Les billets payés en ligne sont remboursés automatiquement.
                - generic [ref=e123]:
                  - paragraph [ref=e124]: Message de l’organisateur
                  - paragraph [ref=e125]: La chaloupe prévue n’a pas obtenu son certificat de navigation à temps. Tous les billets payés en ligne sont remboursés automatiquement, sans démarche de votre part.
                  - paragraph [ref=e126]:
                    - text: Annulé le
                    - time [ref=e127]: mar. 3 nov. 2026 à 21:53
          - generic [ref=e128]:
            - generic [ref=e129]:
              - img "Affiche de l’événement Croisière musicale vers Gorée" [ref=e131]
              - generic [ref=e132]:
                - generic [ref=e133]: Concerts & Musique
                - heading "Croisière musicale vers Gorée" [level=1] [ref=e136]
                - paragraph [ref=e137]: Organisé par Baobab Scène
              - generic [ref=e138]:
                - generic [ref=e143]:
                  - paragraph [ref=e144]: Date et heure
                  - generic [ref=e145]: Samedi 21 novembre 2026 à 17:30
                - generic [ref=e151]:
                  - paragraph [ref=e152]: Lieu
                  - generic [ref=e153]: Embarcadère du port de Dakar, Dakar
              - generic [ref=e154]:
                - heading "À propos de l’événement" [level=2] [ref=e155]
                - paragraph [ref=e156]: Concert sur le pont d’une chaloupe, aller-retour vers l’île au coucher du soleil.
              - generic [ref=e157]:
                - heading "Programme" [level=2] [ref=e158]
                - list [ref=e162]:
                  - listitem [ref=e163]:
                    - generic [ref=e165]:
                      - paragraph [ref=e166]: 17:30
                      - generic [ref=e167]: Activité
                    - paragraph [ref=e169]: Embarquement
                  - listitem [ref=e170]:
                    - generic [ref=e172]:
                      - paragraph [ref=e173]: 18:15
                      - generic [ref=e174]: Artiste
                    - paragraph [ref=e176]: Concert au large
                    - paragraph [ref=e177]: Trio Teranga Swing
              - generic [ref=e178]:
                - heading "Lieu et accès" [level=2] [ref=e179]
                - generic [ref=e184]:
                  - paragraph [ref=e185]: Embarcadère du port de Dakar
                  - paragraph [ref=e186]: Embarcadère du port de Dakar, Dakar
                - 'region "Carte : Embarcadère du port de Dakar" [ref=e187]':
                  - generic:
                    - 'img "Emplacement : Embarcadère du port de Dakar" [ref=e188] [cursor=pointer]'
                    - generic [ref=e189]:
                      - strong [ref=e192]: Embarcadère du port de Dakar
                      - button "Fermer la bulle" [ref=e194] [cursor=pointer]: ×
                  - generic:
                    - generic [ref=e195]:
                      - button "Zoom avant" [ref=e196] [cursor=pointer]: +
                      - button "Zoom arrière" [ref=e197] [cursor=pointer]: −
                    - generic [ref=e198]:
                      - link "Leaflet" [ref=e199] [cursor=pointer]:
                        - /url: https://leafletjs.com
                      - text: "| © contributeurs OpenStreetMap"
                - link "Voir l’itinéraire" [ref=e204] [cursor=pointer]:
                  - /url: https://www.google.com/maps/dir/?api=1&destination=14.673,-17.4298
                - generic [ref=e214]:
                  - generic [ref=e221]:
                    - paragraph [ref=e222]: Stationnement
                    - generic [ref=e223]: Stationnement surveillé à proximité.
                  - generic [ref=e229]:
                    - paragraph [ref=e230]: Règlement et consignes
                    - generic [ref=e231]: Billet présenté sur téléphone ; pièce d’identité pour les entrées à saisie manuelle.
              - generic [ref=e234]:
                - paragraph [ref=e235]: Organisateur
                - heading "Baobab Scène" [level=2] [ref=e236]
            - complementary [ref=e237]:
              - generic [ref=e238]:
                - heading "Billetterie" [level=2] [ref=e239]
                - paragraph [ref=e240]: La vente de billets est fermée pour cet événement.
              - generic [ref=e241]:
                - paragraph [ref=e242]: Remboursement
                - paragraph [ref=e246]: Les billets payés en ligne sont remboursés automatiquement sur le compte Mobile Money utilisé pour l’achat, frais de service compris. Les billets réglés en espèces sont remboursés par l’organisateur.
                - link "Voir mes billets" [ref=e247] [cursor=pointer]:
                  - /url: /tickets
              - list "Formules" [ref=e249]:
                - listitem [ref=e250]:
                  - paragraph [ref=e252]: Pont supérieur
                  - paragraph [ref=e253]: 15 000 F CFA
                - listitem [ref=e254]:
                  - paragraph [ref=e256]: Pont inférieur
                  - paragraph [ref=e257]: 9 000 F CFA
              - link "Voir d’autres événements" [ref=e258] [cursor=pointer]:
                - /url: /explore
  - alert [ref=e264]
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
      |                                                                               ^ Error: contrôles bloquants de evenement-annule__ordinateur__sombre.png
  126 |                 });
  127 |             }
  128 |         });
  129 |     }
  130 | }
  131 | 
```