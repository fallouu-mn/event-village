# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> clair · organisateur >> pilotage-equipe — Pilotage — Équipe
- Location: e2e/captures.spec.ts:185:9

# Error details

```
Error: contrôles bloquants de pilotage-equipe__ordinateur__clair.png

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
    - complementary [ref=e3]:
      - link "Event Village, accueil" [ref=e5] [cursor=pointer]:
        - /url: /
        - generic [ref=e11]:
          - generic [ref=e12]: EVENT
          - generic [ref=e13]: VILLAGE
      - navigation "Navigation principale" [ref=e14]:
        - generic [ref=e15]:
          - paragraph [ref=e16]: Gestion
          - generic [ref=e17]:
            - link "Tableau de bord" [ref=e18] [cursor=pointer]:
              - /url: /partner/dashboard
            - link "Événements" [ref=e25] [cursor=pointer]:
              - /url: /partner/events
            - link "Équipe" [ref=e29] [cursor=pointer]:
              - /url: /partner/team
        - generic [ref=e36]:
          - paragraph [ref=e37]: Outils
          - generic [ref=e38]:
            - link "Finances" [ref=e39] [cursor=pointer]:
              - /url: /partner/finance
            - link "Statistiques" [ref=e43] [cursor=pointer]:
              - /url: /partner/stats
            - link "Scanner les billets" [ref=e47] [cursor=pointer]:
              - /url: /partner/scan
            - link "Calendrier" [ref=e55] [cursor=pointer]:
              - /url: /partner/calendar
            - link "Abonnement" [ref=e59] [cursor=pointer]:
              - /url: /partner/subscription
            - link "Profil partenaire" [ref=e64] [cursor=pointer]:
              - /url: /partner/profile
        - link "Retour au site" [ref=e70] [cursor=pointer]:
          - /url: /
      - generic [ref=e76]:
        - link "Mariama Ndiaye Partenaire" [ref=e77] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=e78]: MN
          - generic [ref=e79]:
            - generic [ref=e80]: Mariama Ndiaye
            - generic [ref=e81]: Partenaire
        - generic [ref=e82]:
          - button "Se déconnecter" [ref=e83] [cursor=pointer]
          - button "Basculer le thème" [ref=e88] [cursor=pointer]
    - generic [ref=e92]:
      - banner [ref=e93]:
        - link "Rechercher un événement, un concert, un restaurant…" [ref=e95] [cursor=pointer]:
          - /url: /explore
        - button "Notifications, 99+ non lues" [ref=e102] [cursor=pointer]:
          - generic [ref=e106]: 99+
      - main [ref=e107]:
        - generic [ref=e109]:
          - generic [ref=e110]:
            - link "Mes événements" [ref=e112] [cursor=pointer]:
              - /url: /partner/events
            - generic [ref=e117]:
              - generic [ref=e118]:
                - generic [ref=e119]:
                  - 'generic "En ligne : la page publique est visible et la billetterie est ouverte." [ref=e120]': Publié
                  - status [ref=e123]: En direct
                - heading "Nuit du Sabar — édition d’automne" [level=1] [ref=e125]
                - paragraph [ref=e126]:
                  - generic [ref=e127]:
                    - generic [ref=e128]: dim. 15 nov. 2026 à 03:00
                    - generic [ref=e131]: Esplanade de la Corniche Ouest, Dakar
              - generic [ref=e135]:
                - link "Modifier" [ref=e136] [cursor=pointer]:
                  - /url: /partner/events/8b6ecf5e-05d6-4311-ab95-83819d4b2ed2/edit
                - button "Annuler l’événement" [ref=e142] [cursor=pointer]
          - generic [ref=e148]:
            - tablist "Rubriques du pilotage" [ref=e151]:
              - tab "Aperçu" [ref=e152] [cursor=pointer]
              - tab "Ventes" [ref=e154] [cursor=pointer]
              - tab "Invitations" [ref=e156] [cursor=pointer]
              - tab "Entrées" [ref=e158] [cursor=pointer]
              - tab "Équipe" [active] [selected] [ref=e160] [cursor=pointer]
              - tab "Caisse" [ref=e162] [cursor=pointer]
              - tab "Clôture" [ref=e164] [cursor=pointer]
            - tabpanel "Équipe" [ref=e166]:
              - generic [ref=e167]:
                - region [ref=e168]:
                  - generic [ref=e169]:
                    - generic [ref=e170]:
                      - heading "Équipe de cet événement" [level=2] [ref=e171]
                      - paragraph [ref=e172]: 3 contrôleurs · 3 prêts · 0 en attente
                      - status [ref=e173]: Mis à jour à 02:26
                    - button "Inviter un contrôleur" [ref=e176] [cursor=pointer]
                  - group [ref=e182]:
                    - generic "Portes et couleurs" [ref=e183] [cursor=pointer]
                    - list "Portes et couleurs des événements" [ref=e184]:
                      - listitem [ref=e185]:
                        - generic [ref=e186]:
                          - paragraph [ref=e187]: Nuit du Sabar — édition d’automne · 15 nov. 2026 à 03:00
                          - link "Modifier les portes et les couleurs" [ref=e188] [cursor=pointer]:
                            - /url: "#portes-et-couleurs"
                        - paragraph [ref=e190]: "Pas de zones : chaque contrôleur laisse entrer toutes les catégories."
                  - generic [ref=e191]:
                    - generic [ref=e192]:
                      - paragraph [ref=e193]: Vous (organisatrice) — toutes les portes
                      - paragraph [ref=e194]: Vous scannez vos événements dont le contrôle est ouvert, à toutes les portes ou à une porte choisie, et vous vendez au guichet.
                    - link "Scanner les billets" [ref=e195] [cursor=pointer]:
                      - /url: /partner/scan
                  - table [ref=e199]:
                    - caption [ref=e200]: Contrôleurs de l’équipe
                    - rowgroup [ref=e201]:
                      - row [ref=e202]:
                        - columnheader "Contrôleur" [ref=e203]
                        - columnheader "État" [ref=e204]
                        - columnheader "Porte et espèces" [ref=e205]
                    - rowgroup [ref=e206]:
                      - row [ref=e207]:
                        - cell [ref=e208]:
                          - generic [ref=e209]:
                            - generic [ref=e210]:
                              - paragraph [ref=e211]: Ibrahima Gueye
                              - paragraph [ref=e212]: 70 000 01 06
                            - generic [ref=e213]:
                              - link "Appeler Ibrahima Gueye" [ref=e214] [cursor=pointer]:
                                - /url: tel:+221700000106
                                - generic [ref=e217]: Appeler
                              - link "Écrire à Ibrahima Gueye sur WhatsApp" [ref=e218] [cursor=pointer]:
                                - /url: https://wa.me/221700000106?text=Bonjour%20Ibrahima%2C%20ici%20Baobab%20Sc%C3%A8ne.%20Vous%20contr%C3%B4lez%20l%E2%80%99entr%C3%A9e%20de%20%C2%AB%20Nuit%20du%20Sabar%20%E2%80%94%20%C3%A9dition%20d%E2%80%99automne%20%C2%BB%20le%2015%20nov.%202026%20%C3%A0%2003%3A00%2C%20Entr%C3%A9e%20principale.%20Ouvrez%20le%20scanner%20%3A%20http%3A%2F%2Flocalhost%3A3000%2Fcontroller%2Fscanner
                                - generic [ref=e221]: WhatsApp
                        - cell "Prêt Actif depuis le 15 nov. 2026 Retirer de l’équipe" [ref=e222]:
                          - generic [ref=e223]:
                            - generic [ref=e224]: Prêt
                            - paragraph [ref=e226]: Actif depuis le 15 nov. 2026
                            - button "Retirer de l’équipe" [ref=e228] [cursor=pointer]
                        - cell [ref=e230]:
                          - list "Événements de Ibrahima Gueye" [ref=e232]:
                            - listitem [ref=e233]:
                              - paragraph [ref=e234]: "Point d’entrée : Entrée principale"
                              - paragraph [ref=e235]: "Laisse entrer : toutes les catégories"
                              - generic [ref=e236]:
                                - generic [ref=e237]: Espèces autorisées
                                - generic [ref=e239]:
                                  - button "Caisse ouverte" [ref=e240] [cursor=pointer]
                                  - button "32 entrées · dernier scan à 02:10" [ref=e241] [cursor=pointer]
                              - generic [ref=e242]:
                                - button "Modifier" [ref=e243] [cursor=pointer]
                                - button "Retirer de cet événement" [ref=e245] [cursor=pointer]
                      - row [ref=e247]:
                        - cell [ref=e248]:
                          - generic [ref=e249]:
                            - generic [ref=e250]:
                              - paragraph [ref=e251]: Lamine Cissé
                              - paragraph [ref=e252]: 70 000 01 08
                            - generic [ref=e253]:
                              - link "Appeler Lamine Cissé" [ref=e254] [cursor=pointer]:
                                - /url: tel:+221700000108
                                - generic [ref=e257]: Appeler
                              - link "Écrire à Lamine Cissé sur WhatsApp" [ref=e258] [cursor=pointer]:
                                - /url: https://wa.me/221700000108?text=Bonjour%20Lamine%2C%20ici%20Baobab%20Sc%C3%A8ne.%20Vous%20contr%C3%B4lez%20l%E2%80%99entr%C3%A9e%20de%20%C2%AB%20Nuit%20du%20Sabar%20%E2%80%94%20%C3%A9dition%20d%E2%80%99automne%20%C2%BB%20le%2015%20nov.%202026%20%C3%A0%2003%3A00%2C%20Entr%C3%A9e%20principale.%20Ouvrez%20le%20scanner%20%3A%20http%3A%2F%2Flocalhost%3A3000%2Fcontroller%2Fscanner
                                - generic [ref=e261]: WhatsApp
                        - cell "Prêt Actif depuis le 15 nov. 2026 Retirer de l’équipe" [ref=e262]:
                          - generic [ref=e263]:
                            - generic [ref=e264]: Prêt
                            - paragraph [ref=e266]: Actif depuis le 15 nov. 2026
                            - button "Retirer de l’équipe" [ref=e268] [cursor=pointer]
                        - cell [ref=e270]:
                          - list "Événements de Lamine Cissé" [ref=e272]:
                            - listitem [ref=e273]:
                              - paragraph [ref=e274]: "Point d’entrée : Entrée principale"
                              - paragraph [ref=e275]: "Laisse entrer : toutes les catégories"
                              - generic [ref=e276]:
                                - generic [ref=e277]: Espèces autorisées
                                - button "22 entrées · dernier scan à 02:06" [ref=e280] [cursor=pointer]
                              - generic [ref=e281]:
                                - button "Modifier" [ref=e282] [cursor=pointer]
                                - button "Retirer de cet événement" [ref=e284] [cursor=pointer]
                      - row [ref=e286]:
                        - cell [ref=e287]:
                          - generic [ref=e288]:
                            - generic [ref=e289]:
                              - paragraph [ref=e290]: Seynabou Ba
                              - paragraph [ref=e291]: 70 000 01 07
                            - generic [ref=e292]:
                              - link "Appeler Seynabou Ba" [ref=e293] [cursor=pointer]:
                                - /url: tel:+221700000107
                                - generic [ref=e296]: Appeler
                              - link "Écrire à Seynabou Ba sur WhatsApp" [ref=e297] [cursor=pointer]:
                                - /url: https://wa.me/221700000107?text=Bonjour%20Seynabou%2C%20ici%20Baobab%20Sc%C3%A8ne.%20Vous%20contr%C3%B4lez%20l%E2%80%99entr%C3%A9e%20de%20%C2%AB%20Nuit%20du%20Sabar%20%E2%80%94%20%C3%A9dition%20d%E2%80%99automne%20%C2%BB%20le%2015%20nov.%202026%20%C3%A0%2003%3A00%2C%20Entr%C3%A9e%20VIP.%20Ouvrez%20le%20scanner%20%3A%20http%3A%2F%2Flocalhost%3A3000%2Fcontroller%2Fscanner
                                - generic [ref=e300]: WhatsApp
                        - cell "Prêt Actif depuis le 15 nov. 2026 Retirer de l’équipe" [ref=e301]:
                          - generic [ref=e302]:
                            - generic [ref=e303]: Prêt
                            - paragraph [ref=e305]: Actif depuis le 15 nov. 2026
                            - button "Retirer de l’équipe" [ref=e307] [cursor=pointer]
                        - cell [ref=e309]:
                          - list "Événements de Seynabou Ba" [ref=e311]:
                            - listitem [ref=e312]:
                              - paragraph [ref=e313]: "Point d’entrée : Entrée VIP"
                              - paragraph [ref=e314]: "Laisse entrer : toutes les catégories"
                              - generic [ref=e315]:
                                - generic [ref=e316]: Espèces autorisées
                                - button "7 entrées · dernier scan à 02:02" [ref=e319] [cursor=pointer]
                              - generic [ref=e320]:
                                - button "Modifier" [ref=e321] [cursor=pointer]
                                - button "Retirer de cet événement" [ref=e323] [cursor=pointer]
                - region [ref=e326]:
                  - generic [ref=e328]:
                    - heading "Zones et portes" [level=2] [ref=e329]
                    - paragraph [ref=e330]: "Sans zone, une seule entrée « Entrée » admet toutes les catégories : rien à régler. Ajoutez des zones pour séparer les accès (carré VIP, backstage)."
                  - generic [ref=e331]:
                    - generic [ref=e337]:
                      - paragraph [ref=e338]: Une seule entrée, toutes les catégories
                      - paragraph [ref=e339]: Tous vos contrôleurs compostent les billets de toutes les catégories.
                    - button "Configurer des zones" [ref=e340] [cursor=pointer]
  - alert [ref=e348]: Nuit du Sabar — édition d’automne
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
      |                                                                   ^ Error: contrôles bloquants de pilotage-equipe__ordinateur__clair.png
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