# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> clair · organisateur >> invitations-confirmation — Pilotage — Invitations : confirmation de l’envoi
- Location: e2e/captures.spec.ts:185:9

# Error details

```
Error: contrôles bloquants de invitations-confirmation__mobile__clair.png

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "3 cible(s) < 44 px : button « Fermer » 42×42 ; button « Annuler » 163×42 ; button « Confirmer » 163×42",
+ ]
```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e2]:
    - generic [ref=e3]:
      - banner [ref=e4]:
        - generic [ref=e5]:
          - button "Ouvrir le menu" [ref=e6] [cursor=pointer]
          - link "Event Village, accueil" [ref=e10] [cursor=pointer]:
            - /url: /
        - generic [ref=e16]:
          - button "Notifications, 99+ non lues" [ref=e18] [cursor=pointer]:
            - generic [ref=e22]: 99+
          - button "Basculer le thème" [ref=e24] [cursor=pointer]
          - link "Mon profil (Mariama Ndiaye)" [ref=e28] [cursor=pointer]:
            - /url: /profile
            - generic [aria-hidden] [ref=e29]: MN
      - main [ref=e31]:
        - generic [ref=e33]:
          - generic [ref=e34]:
            - link "Mes événements" [ref=e36] [cursor=pointer]:
              - /url: /partner/events
            - generic [ref=e41]:
              - generic [ref=e42]:
                - generic [ref=e43]:
                  - 'generic "En ligne : la page publique est visible et la billetterie est ouverte." [ref=e44]': Publié
                  - status [ref=e47]: En direct
                - heading "Nuit du Sabar — édition d’automne" [level=1] [ref=e49]
                - paragraph [ref=e50]:
                  - generic [ref=e51]:
                    - generic [ref=e52]: jeu. 12 nov. 2026 à 21:15
                    - generic [ref=e55]: Esplanade de la Corniche Ouest, Dakar
              - generic [ref=e59]:
                - link "Modifier" [ref=e60] [cursor=pointer]:
                  - /url: /partner/events/7deb5e6e-2dc0-46e2-9bf7-e1132e24198a/edit
                - button "Annuler l’événement" [ref=e66] [cursor=pointer]
          - generic [ref=e72]:
            - tablist "Rubriques du pilotage" [ref=e75]:
              - tab "Aperçu" [ref=e76] [cursor=pointer]
              - tab "Ventes" [ref=e78] [cursor=pointer]
              - tab "Invitations" [selected] [ref=e80] [cursor=pointer]
              - tab "Entrées" [ref=e82] [cursor=pointer]
              - tab "Équipe" [ref=e84] [cursor=pointer]
              - tab "Caisse" [ref=e86] [cursor=pointer]
              - tab "Clôture" [ref=e88] [cursor=pointer]
            - tabpanel "Invitations" [ref=e90]:
              - generic [ref=e91]:
                - region [ref=e92]:
                  - generic [ref=e94]:
                    - heading "Inviter par SMS" [level=2] [ref=e95]
                    - paragraph [ref=e96]: Chaque numéro reçoit un SMS avec un lien vers Mes billets. Sans compte, ses billets l’attendent jusqu’à son inscription avec ce numéro.
                  - generic [ref=e97]:
                    - generic [ref=e98]:
                      - generic [ref=e99]:
                        - generic [ref=e101]:
                          - text: Catégorie*
                          - generic [ref=e102]: (obligatoire)
                        - combobox "Catégorie (obligatoire)" [ref=e104] [cursor=pointer]:
                          - option "Choisir une catégorie" [disabled]
                          - option "Invités de la production · 10 restants" [selected]
                          - option "Prévente · vente fermée" [disabled]
                          - option "Standard · 128 restants"
                          - option "VIP · 40 restants"
                          - option "Carré presse · 9 restants"
                        - paragraph [ref=e105]: Toute catégorie peut être distribuée ; les places sont prises sur son stock.
                      - generic [ref=e106]:
                        - generic [ref=e107]: Billets par numéro
                        - combobox "Billets par numéro" [ref=e110] [cursor=pointer]:
                          - option "1" [selected]
                          - option "2"
                          - option "3"
                          - option "4"
                    - group "Numéros de téléphone 1 / 10" [ref=e111]:
                      - generic [ref=e112]:
                        - generic [ref=e113]: Numéros de téléphone
                        - generic [ref=e114]: 1 / 10
                      - list [ref=e115]:
                        - listitem [ref=e116]:
                          - generic [ref=e117]:
                            - generic [ref=e119]:
                              - text: Numéro 1*
                              - generic [ref=e120]: (obligatoire)
                            - textbox "Numéro 1 (obligatoire)" [ref=e121]:
                              - /placeholder: 77 123 45 67
                              - text: "771234567"
                          - generic [ref=e122]:
                            - generic [ref=e123]:
                              - generic [ref=e124]: Nom de l’invité 1
                              - generic [ref=e125]: 0 / 60
                            - textbox "Nom de l’invité 1" [ref=e127]
                            - paragraph [ref=e128]: Facultatif, 60 caractères au plus. Montré au contrôleur qui consulte la liste des invités.
                      - button "Ajouter un numéro" [ref=e130] [cursor=pointer]
                    - button "Envoyer les invitations" [ref=e135] [cursor=pointer]
                - region [ref=e141]:
                  - generic [ref=e143]:
                    - heading "Historique des invitations" [level=2] [ref=e144]
                    - paragraph [ref=e145]: "Les numéros sont masqués. Une invitation non scannée peut être annulée : la place revient au stock et l’invité est prévenu par SMS."
                  - generic [ref=e146]:
                    - heading "Aucune invitation pour le moment" [level=3] [ref=e150]
                    - paragraph [ref=e151]: Elles apparaîtront ici dès le premier envoi.
    - navigation "Navigation rapide" [ref=e152]:
      - generic [ref=e153]:
        - link "Accueil" [ref=e154] [cursor=pointer]:
          - /url: /partner/dashboard
        - link "Billetterie" [ref=e161] [cursor=pointer]:
          - /url: /partner/events
        - link "Scanner" [ref=e165] [cursor=pointer]:
          - /url: /partner/scan
        - link "Finances" [ref=e173] [cursor=pointer]:
          - /url: /partner/finance
        - link "Profil" [ref=e177] [cursor=pointer]:
          - /url: /partner/profile
  - alert [ref=e182]
  - alertdialog [ref=e185]:
    - generic [ref=e186]:
      - heading "Confirmer l’envoi" [level=2] [ref=e189]
      - button "Fermer" [ref=e190] [cursor=pointer]
    - generic [ref=e196]:
      - paragraph [ref=e201]: Un SMS part aussitôt vers chaque numéro et les places sont prises sur le stock de la catégorie.
      - generic [ref=e202]:
        - generic [ref=e203]:
          - term [ref=e204]: Catégorie
          - definition [ref=e205]: Invités de la production
        - generic [ref=e206]:
          - term [ref=e207]:
            - generic [ref=e208]: Numéro
            - generic [ref=e209]: Invité
          - definition [ref=e210]:
            - generic [ref=e211]: +221***67
            - generic [ref=e212]: —
        - generic [ref=e213]:
          - term [ref=e214]: Billets par numéro
          - definition [ref=e215]: "1"
        - generic [ref=e216]:
          - term [ref=e217]: Billets au total
          - definition [ref=e218]: "1"
    - generic [ref=e219]:
      - button "Annuler" [active] [ref=e220] [cursor=pointer]
      - button "Confirmer" [ref=e222] [cursor=pointer]
```

# Test source

```ts
  210 |                 await context.addInitScript(stretchTimers, screen.slowTimers);
  211 |             }
  212 |             if (screen.injectError) {
  213 |                 record.notes.push(`état d'erreur simulé : réponses ${screen.injectError} remplacées par un 500 (erreurs de console attendues, ignorées)`);
  214 |                 await page.route(screen.injectError, (route) => route.fulfill({
  215 |                     status: 500,
  216 |                     contentType: 'application/json; charset=utf-8',
  217 |                     body: JSON.stringify({ error: screen.injectErrorMessage ?? 'Erreur simulée par les tests de bout en bout.', code: 'E2E_SIMULATED_ERROR' }),
  218 |                 }));
  219 |             }
  220 |             const stubs: StubResponse[] = [...(screen.stubResponse ? [screen.stubResponse] : []), ...(screen.stubResponses ?? [])];
  221 |             for (const stub of stubs) {
  222 |                 record.notes.push(`réponse simulée : ${stub.method ?? 'toute méthode'} ${stub.url} remplacée par HTTP ${stub.status} ${JSON.stringify(stub.body).slice(0, 160)}`);
  223 |                 await page.route(stub.url, async (route) => {
  224 |                     if (!methodMatches(stub.method, route.request().method())) {
  225 |                         await route.fallback();
  226 |                         return;
  227 |                     }
  228 |                     await route.fulfill({ status: stub.status, contentType: 'application/json; charset=utf-8', body: JSON.stringify(stub.body) });
  229 |                 });
  230 |             }
  231 |             for (const hold of screen.holdRequests ?? []) {
  232 |                 record.notes.push(`requête retenue (jamais servie) : ${hold.method ?? 'toute méthode'} ${hold.url}`);
  233 |                 await page.route(hold.url, async (route) => {
  234 |                     if (!methodMatches(hold.method, route.request().method())) {
  235 |                         await route.fallback();
  236 |                         return;
  237 |                     }
  238 |                     // Retenue jusqu'à la fermeture de la page : ni réponse ni erreur (réseau lent, téléchargement en cours)
  239 |                     await new Promise<void>((resolve) => { page.once('close', () => resolve()); });
  240 |                 });
  241 |             }
  242 |             if (screen.fakePush) {
  243 |                 const subscription = screen.fakePush === 'granted' ? await fakePushSubscriber() : null;
  244 |                 record.notes.push(screen.fakePush === 'granted'
  245 |                     ? `push simulé (granted) : permission accordée au clic sans fenêtre, inscription du service worker et pushManager.subscribe remplacés ; abonnement du faux service push ${subscription?.endpoint ?? '?'} ; configuration VAPID, route d'inscription et base réelles`
  246 |                     : screen.fakePush === 'denied'
  247 |                         ? 'push simulé (denied) : Notification.permission = « denied », appels à requestPermission comptés'
  248 |                         : 'push simulé (unsupported) : window.PushManager et window.Notification supprimés');
  249 |                 await context.addInitScript(installFakePush, { mode: screen.fakePush, subscription });
  250 |             }
  251 |             if (screen.fakeCamera) {
  252 |                 const mode = screen.fakeCamera === 'barcode-detector' ? 'barcode-detector' : fakeScanMode();
  253 |                 record.notes.push(`caméra simulée (${mode})${mode === 'barcode-detector' ? ' : faux BarcodeDetector, payload posé par le test' : ''}`);
  254 |                 await context.addInitScript(installFakeCamera, { mode });
  255 |             }
  256 |             if (screen.offline === 'before-load') {
  257 |                 record.notes.push('connexion coupée avant le chargement (collecte d’erreurs arrêtée)');
  258 |                 guard.freeze();
  259 |                 await context.setOffline(true);
  260 |             }
  261 |             const response = await page.goto(record.url, { waitUntil: 'load' });
  262 |             record.status = response ? response.status() : null;
  263 |             if (screen.expectStatus !== undefined) {
  264 |                 expect(record.status, `statut HTTP du document ${record.url}`).toBe(screen.expectStatus);
  265 |             }
  266 |             if (screen.offline === 'after-load') {
  267 |                 record.notes.push('connexion coupée après le chargement (collecte d’erreurs arrêtée)');
  268 |                 guard.freeze();
  269 |                 await context.setOffline(true);
  270 |             }
  271 |             const sc = { page, context, guard, ids: demo };
  272 |             if (screen.ready) await screen.ready(sc);
  273 |             await settle(page, guard, record.notes);
  274 |             if (screen.actions) {
  275 |                 await screen.actions(sc);
  276 |                 await settle(page, guard, record.notes);
  277 |             }
  278 |             if (screen.id === 'cloche-ouverte' && vue === 'mobile') {
  279 |                 const problem = await markAllOnOneLine(page);
  280 |                 if (problem) record.blocking.push(problem);
  281 |             }
  282 |             const checks = await runPageChecks(page, { mobile: vue === 'mobile', axe: true, references: screen.references });
  283 |             record.blocking.push(...checks.blocking);
  284 |             record.warnings.push(...checks.warnings);
  285 |             record.axeDetails = checks.axeDetails;
  286 |             record.smallTextDetails = checks.smallTextDetails;
  287 |             record.metrics = checks.metrics;
  288 |             const shot = await capture(page, screen, file);
  289 |             record.captured = true;
  290 |             await testInfo.attach(file, { path: shot, contentType: 'image/png' });
  291 |         } catch (err) {
  292 |             record.error = err instanceof Error ? err.message.split('\n')[0] : String(err);
  293 |             if (!record.captured && !page.isClosed()) {
  294 |                 await capture(page, screen, file).then(
  295 |                     async (shot) => {
  296 |                         record.captured = true;
  297 |                         record.notes.push('capture prise après l’erreur (état de la page au moment de l’échec)');
  298 |                         await testInfo.attach(file, { path: shot, contentType: 'image/png' });
  299 |                     },
  300 |                     (shotErr: Error) => { record.notes.push(`capture impossible après l’erreur : ${shotErr.message.split('\n')[0]}`); },
  301 |                 );
  302 |             }
  303 |             throw err;
  304 |         } finally {
  305 |             record.blocking.push(...guard.blockingIssues());
  306 |             record.warnings.push(...guard.nonBlockingIssues());
  307 |             record.durationMs = Date.now() - started;
  308 |             writeCaptureRecord(record);
  309 |         }
> 310 |         expect(record.blocking, `contrôles bloquants de ${file}`).toEqual([]);
      |                                                                   ^ Error: contrôles bloquants de invitations-confirmation__mobile__clair.png
  311 |     });
  312 | }
  313 | 
  314 | for (const theme of THEMES) {
  315 |     for (const role of ROLE_ORDER) {
  316 |         const screens = SCREENS.filter((s) => s.role === role);
  317 |         if (screens.length === 0) continue;
  318 |         test.describe(`${theme.key} · ${role}`, () => {
  319 |             test.use({ colorScheme: theme.colorScheme, evTheme: theme.key, evRole: role });
  320 | 
  321 |             for (const screen of screens) {
  322 |                 if (screen.serviceWorkers === 'allow') {
  323 |                     // Lot 7 (D7) : service worker autorisé seulement dans le contexte de cet écran
  324 |                     test.describe(`${screen.id} (service worker autorisé)`, () => {
  325 |                         test.use({ serviceWorkers: 'allow' });
  326 |                         defineCapture(screen, theme, role);
  327 |                     });
  328 |                 } else {
  329 |                     defineCapture(screen, theme, role);
  330 |                 }
  331 |             }
  332 |         });
  333 |     }
  334 | }
  335 | 
```