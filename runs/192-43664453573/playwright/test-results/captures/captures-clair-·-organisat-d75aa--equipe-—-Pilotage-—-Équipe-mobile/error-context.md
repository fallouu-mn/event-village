# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> clair · organisateur >> pilotage-equipe — Pilotage — Équipe
- Location: e2e/captures.spec.ts:185:9

# Error details

```
Error: contrôles bloquants de pilotage-equipe__mobile__clair.png

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "4 cible(s) < 44 px : button « Caisse ouverte » 102×20 ; button « 32 entrées · dernier scan à 02:10 » 220×20 ; button « 22 entrées · dernier scan à 02:06 » 222×20 ; button « 7 entrées · dernier scan à 02:02 » 214×20",
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
                    - generic [ref=e52]: dim. 15 nov. 2026 à 03:00
                    - generic [ref=e55]: Esplanade de la Corniche Ouest, Dakar
              - generic [ref=e59]:
                - link "Modifier" [ref=e60] [cursor=pointer]:
                  - /url: /partner/events/8b6ecf5e-05d6-4311-ab95-83819d4b2ed2/edit
                - button "Annuler l’événement" [ref=e66] [cursor=pointer]
          - generic [ref=e72]:
            - tablist "Rubriques du pilotage" [ref=e75]:
              - tab "Aperçu" [ref=e76] [cursor=pointer]
              - tab "Ventes" [ref=e78] [cursor=pointer]
              - tab "Invitations" [ref=e80] [cursor=pointer]
              - tab "Entrées" [ref=e82] [cursor=pointer]
              - tab "Équipe" [active] [selected] [ref=e84] [cursor=pointer]
              - tab "Caisse" [ref=e86] [cursor=pointer]
              - tab "Clôture" [ref=e88] [cursor=pointer]
            - tabpanel "Équipe" [ref=e90]:
              - generic [ref=e91]:
                - region [ref=e92]:
                  - generic [ref=e93]:
                    - generic [ref=e94]:
                      - heading "Équipe de cet événement" [level=2] [ref=e95]
                      - paragraph [ref=e96]: 3 contrôleurs · 3 prêts · 0 en attente
                      - status [ref=e97]: Mis à jour à 02:16
                    - button "Inviter un contrôleur" [ref=e100] [cursor=pointer]
                  - group [ref=e106]:
                    - generic "Portes et couleurs" [ref=e107] [cursor=pointer]
                    - list "Portes et couleurs des événements" [ref=e108]:
                      - listitem [ref=e109]:
                        - generic [ref=e110]:
                          - paragraph [ref=e111]: Nuit du Sabar — édition d’automne · 15 nov. 2026 à 03:00
                          - link "Modifier les portes et les couleurs" [ref=e112] [cursor=pointer]:
                            - /url: "#portes-et-couleurs"
                        - paragraph [ref=e114]: "Pas de zones : chaque contrôleur laisse entrer toutes les catégories."
                  - generic [ref=e115]:
                    - generic [ref=e116]:
                      - paragraph [ref=e117]: Vous (organisatrice) — toutes les portes
                      - paragraph [ref=e118]: Vous scannez vos événements dont le contrôle est ouvert, à toutes les portes ou à une porte choisie, et vous vendez au guichet.
                    - link "Scanner les billets" [ref=e119] [cursor=pointer]:
                      - /url: /partner/scan
                  - list "Contrôleurs de l’équipe" [ref=e122]:
                    - listitem [ref=e123]:
                      - generic [ref=e124]:
                        - generic [ref=e125]:
                          - generic [ref=e126]:
                            - paragraph [ref=e127]: Ibrahima Gueye
                            - paragraph [ref=e128]: Actif depuis le 15 nov. 2026
                          - generic [ref=e129]: Prêt
                        - generic [ref=e131]:
                          - paragraph [ref=e132]: 70 000 01 06
                          - generic [ref=e133]:
                            - link "Appeler Ibrahima Gueye" [ref=e134] [cursor=pointer]:
                              - /url: tel:+221700000106
                              - generic [ref=e137]: Appeler
                            - link "Écrire à Ibrahima Gueye sur WhatsApp" [ref=e138] [cursor=pointer]:
                              - /url: https://wa.me/221700000106?text=Bonjour%20Ibrahima%2C%20ici%20Baobab%20Sc%C3%A8ne.%20Vous%20contr%C3%B4lez%20l%E2%80%99entr%C3%A9e%20de%20%C2%AB%20Nuit%20du%20Sabar%20%E2%80%94%20%C3%A9dition%20d%E2%80%99automne%20%C2%BB%20le%2015%20nov.%202026%20%C3%A0%2003%3A00%2C%20Entr%C3%A9e%20principale.%20Ouvrez%20le%20scanner%20%3A%20http%3A%2F%2Flocalhost%3A3000%2Fcontroller%2Fscanner
                              - generic [ref=e141]: WhatsApp
                        - list "Événements de Ibrahima Gueye" [ref=e144]:
                          - listitem [ref=e145]:
                            - paragraph [ref=e146]: "Point d’entrée : Entrée principale"
                            - paragraph [ref=e147]: "Laisse entrer : toutes les catégories"
                            - generic [ref=e148]:
                              - generic [ref=e149]: Espèces autorisées
                              - generic [ref=e151]:
                                - button "Caisse ouverte" [ref=e152] [cursor=pointer]
                                - button "32 entrées · dernier scan à 02:10" [ref=e153] [cursor=pointer]
                            - generic [ref=e154]:
                              - button "Modifier" [ref=e155] [cursor=pointer]
                              - button "Retirer de cet événement" [ref=e157] [cursor=pointer]
                        - button "Retirer de l’équipe" [ref=e160] [cursor=pointer]
                    - listitem [ref=e162]:
                      - generic [ref=e163]:
                        - generic [ref=e164]:
                          - generic [ref=e165]:
                            - paragraph [ref=e166]: Lamine Cissé
                            - paragraph [ref=e167]: Actif depuis le 15 nov. 2026
                          - generic [ref=e168]: Prêt
                        - generic [ref=e170]:
                          - paragraph [ref=e171]: 70 000 01 08
                          - generic [ref=e172]:
                            - link "Appeler Lamine Cissé" [ref=e173] [cursor=pointer]:
                              - /url: tel:+221700000108
                              - generic [ref=e176]: Appeler
                            - link "Écrire à Lamine Cissé sur WhatsApp" [ref=e177] [cursor=pointer]:
                              - /url: https://wa.me/221700000108?text=Bonjour%20Lamine%2C%20ici%20Baobab%20Sc%C3%A8ne.%20Vous%20contr%C3%B4lez%20l%E2%80%99entr%C3%A9e%20de%20%C2%AB%20Nuit%20du%20Sabar%20%E2%80%94%20%C3%A9dition%20d%E2%80%99automne%20%C2%BB%20le%2015%20nov.%202026%20%C3%A0%2003%3A00%2C%20Entr%C3%A9e%20principale.%20Ouvrez%20le%20scanner%20%3A%20http%3A%2F%2Flocalhost%3A3000%2Fcontroller%2Fscanner
                              - generic [ref=e180]: WhatsApp
                        - list "Événements de Lamine Cissé" [ref=e183]:
                          - listitem [ref=e184]:
                            - paragraph [ref=e185]: "Point d’entrée : Entrée principale"
                            - paragraph [ref=e186]: "Laisse entrer : toutes les catégories"
                            - generic [ref=e187]:
                              - generic [ref=e188]: Espèces autorisées
                              - button "22 entrées · dernier scan à 02:06" [ref=e191] [cursor=pointer]
                            - generic [ref=e192]:
                              - button "Modifier" [ref=e193] [cursor=pointer]
                              - button "Retirer de cet événement" [ref=e195] [cursor=pointer]
                        - button "Retirer de l’équipe" [ref=e198] [cursor=pointer]
                    - listitem [ref=e200]:
                      - generic [ref=e201]:
                        - generic [ref=e202]:
                          - generic [ref=e203]:
                            - paragraph [ref=e204]: Seynabou Ba
                            - paragraph [ref=e205]: Actif depuis le 15 nov. 2026
                          - generic [ref=e206]: Prêt
                        - generic [ref=e208]:
                          - paragraph [ref=e209]: 70 000 01 07
                          - generic [ref=e210]:
                            - link "Appeler Seynabou Ba" [ref=e211] [cursor=pointer]:
                              - /url: tel:+221700000107
                              - generic [ref=e214]: Appeler
                            - link "Écrire à Seynabou Ba sur WhatsApp" [ref=e215] [cursor=pointer]:
                              - /url: https://wa.me/221700000107?text=Bonjour%20Seynabou%2C%20ici%20Baobab%20Sc%C3%A8ne.%20Vous%20contr%C3%B4lez%20l%E2%80%99entr%C3%A9e%20de%20%C2%AB%20Nuit%20du%20Sabar%20%E2%80%94%20%C3%A9dition%20d%E2%80%99automne%20%C2%BB%20le%2015%20nov.%202026%20%C3%A0%2003%3A00%2C%20Entr%C3%A9e%20VIP.%20Ouvrez%20le%20scanner%20%3A%20http%3A%2F%2Flocalhost%3A3000%2Fcontroller%2Fscanner
                              - generic [ref=e218]: WhatsApp
                        - list "Événements de Seynabou Ba" [ref=e221]:
                          - listitem [ref=e222]:
                            - paragraph [ref=e223]: "Point d’entrée : Entrée VIP"
                            - paragraph [ref=e224]: "Laisse entrer : toutes les catégories"
                            - generic [ref=e225]:
                              - generic [ref=e226]: Espèces autorisées
                              - button "7 entrées · dernier scan à 02:02" [ref=e229] [cursor=pointer]
                            - generic [ref=e230]:
                              - button "Modifier" [ref=e231] [cursor=pointer]
                              - button "Retirer de cet événement" [ref=e233] [cursor=pointer]
                        - button "Retirer de l’équipe" [ref=e236] [cursor=pointer]
                - region [ref=e239]:
                  - generic [ref=e241]:
                    - heading "Zones et portes" [level=2] [ref=e242]
                    - paragraph [ref=e243]: "Sans zone, une seule entrée « Entrée » admet toutes les catégories : rien à régler. Ajoutez des zones pour séparer les accès (carré VIP, backstage)."
                  - generic [ref=e244]:
                    - generic [ref=e250]:
                      - paragraph [ref=e251]: Une seule entrée, toutes les catégories
                      - paragraph [ref=e252]: Tous vos contrôleurs compostent les billets de toutes les catégories.
                    - button "Configurer des zones" [ref=e253] [cursor=pointer]
    - navigation "Navigation rapide" [ref=e261]:
      - generic [ref=e262]:
        - link "Accueil" [ref=e263] [cursor=pointer]:
          - /url: /partner/dashboard
        - link "Billetterie" [ref=e270] [cursor=pointer]:
          - /url: /partner/events
        - link "Scanner" [ref=e274] [cursor=pointer]:
          - /url: /partner/scan
        - link "Finances" [ref=e282] [cursor=pointer]:
          - /url: /partner/finance
        - link "Profil" [ref=e286] [cursor=pointer]:
          - /url: /partner/profile
  - alert [ref=e291]
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
      |                                                                   ^ Error: contrôles bloquants de pilotage-equipe__mobile__clair.png
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