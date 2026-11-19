# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · anonyme >> fiche-en-cours — Fiche — événement en cours (« En cours · se termine vers … »)
- Location: e2e/captures.spec.ts:185:9

# Error details

```
Error: contrôles bloquants de fiche-en-cours__ordinateur__sombre.png

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "exception de page : Error: Minified React error #418; visit https://react.dev/errors/418?args[]=HTML&args[]= for the full message or use the non-minified dev environment for full errors and additional helpful warnings.",
+ ]
```

# Page snapshot

```yaml
- generic [active] [ref=f3e1]:
  - generic [ref=f3e2]:
    - complementary [ref=f3e3]:
      - link "Event Village, accueil" [ref=f3e5] [cursor=pointer]:
        - /url: /
        - generic [ref=f3e6]: Event Village
      - navigation "Navigation principale" [ref=f3e9]:
        - generic [ref=f3e10]:
          - paragraph [ref=f3e11]: Menu principal
          - generic [ref=f3e12]:
            - link "Accueil" [ref=f3e13] [cursor=pointer]:
              - /url: /
            - link "Explorer" [ref=f3e18] [cursor=pointer]:
              - /url: /explore
            - link "Mes billets" [ref=f3e23] [cursor=pointer]:
              - /url: /tickets
            - link "Portefeuille" [ref=f3e27] [cursor=pointer]:
              - /url: /wallet
        - generic [ref=f3e32]:
          - paragraph [ref=f3e33]: Espaces métier
          - link "Devenir partenaire" [ref=f3e35] [cursor=pointer]:
            - /url: /partner/register
      - generic [ref=f3e41]:
        - link "Se connecter" [ref=f3e42] [cursor=pointer]:
          - /url: /login
        - button "Basculer le thème" [pressed] [ref=f3e48] [cursor=pointer]
    - generic [ref=f3e56]:
      - banner [ref=f3e57]:
        - link "Rechercher un événement, un concert, un restaurant…" [ref=f3e59] [cursor=pointer]:
          - /url: /explore
        - button "Notifications" [ref=f3e66] [cursor=pointer]
      - main [ref=f3e70]:
        - generic [ref=f3e72]:
          - generic [ref=f3e73]:
            - link "Retour aux événements" [ref=f3e74] [cursor=pointer]:
              - /url: /explore
            - button "Partager l’événement" [ref=f3e79] [cursor=pointer]
          - generic [ref=f3e87]:
            - article [ref=f3e88]:
              - generic [ref=f3e89]:
                - img "Affiche de l’événement Nuit du Sabar — édition d’automne" [ref=f3e90]
                - paragraph:
                  - generic: En cours · se termine vers 17:30
              - generic [ref=f3e91]:
                - generic [ref=f3e92]: Concerts & Musique
                - heading "Nuit du Sabar — édition d’automne" [level=1] [ref=f3e95]
                - paragraph [ref=f3e96]: Organisé par Baobab Scène
              - list "Infos de l’événement" [ref=f3e97]:
                - listitem [ref=f3e98]:
                  - generic [ref=f3e102]:
                    - paragraph [ref=f3e103]: Jeudi 19 novembre 2026 à 12:30
                    - paragraph [ref=f3e104]: Jusqu’à 17:30
                - listitem [ref=f3e105]:
                  - generic [ref=f3e110]:
                    - paragraph [ref=f3e111]: Esplanade de la Corniche Ouest
                    - paragraph [ref=f3e112]: Esplanade de la Corniche Ouest, Dakar · Dakar
                - listitem [ref=f3e113]:
                  - generic [ref=f3e117]:
                    - paragraph [ref=f3e118]: Billet dans l’application
                    - paragraph [ref=f3e119]: Présentez son QR code à l’entrée, depuis Mes billets.
              - region [ref=f3e120]:
                - heading "À propos" [level=2] [ref=f3e121]
                - paragraph [ref=f3e122]: Une nuit entière de sabar avec quatre troupes de percussionnistes et danseurs, en plein air face à l’océan. Restauration sur place, accès aux personnes à mobilité réduite par l’entrée principale.
              - region [ref=f3e123]:
                - heading "Programme" [level=2] [ref=f3e124]
                - list [ref=f3e125]:
                  - listitem [ref=f3e126]:
                    - generic [ref=f3e128]:
                      - paragraph [ref=f3e129]: 19:30
                      - generic [ref=f3e130]: Activité
                    - paragraph [ref=f3e132]: Ouverture des portes
                  - listitem [ref=f3e133]:
                    - generic [ref=f3e135]:
                      - paragraph [ref=f3e136]: 20:30
                      - generic [ref=f3e137]: Artiste
                    - paragraph [ref=f3e139]: Première partie
                    - paragraph [ref=f3e140]: Troupe Kër Gëstu
                  - listitem [ref=f3e141]:
                    - generic [ref=f3e143]:
                      - paragraph [ref=f3e144]: 22:00
                      - generic [ref=f3e145]: Artiste
                    - paragraph [ref=f3e147]: Grand cercle de sabar
                    - paragraph [ref=f3e148]: Ensemble Ndawrabine des Parcelles
                  - listitem [ref=f3e149]:
                    - generic [ref=f3e151]:
                      - paragraph [ref=f3e152]: 23:30
                      - generic [ref=f3e153]: Activité
                    - paragraph [ref=f3e155]: Bœuf final avec le public
              - region [ref=f3e156]:
                - heading "Lieu et accès" [level=2] [ref=f3e157]
                - generic [ref=f3e158]:
                  - paragraph [ref=f3e159]: Esplanade de la Corniche Ouest
                  - paragraph [ref=f3e160]: Esplanade de la Corniche Ouest, Dakar · Dakar
                - generic [ref=f3e161]:
                  - img "Nuit du Sabar — édition d’automne, Esplanade de la Corniche Ouest" [ref=f3e168]:
                    - generic [ref=f3e169]: Nuit du Sabar — édition d’a…
                  - button "Afficher la carte" [ref=f3e173] [cursor=pointer]
                - link "Voir l’itinéraire" [ref=f3e178] [cursor=pointer]:
                  - /url: https://www.google.com/maps/dir/?api=1&destination=14.6833,-17.4676
                - generic [ref=f3e188]:
                  - generic [ref=f3e195]:
                    - paragraph [ref=f3e196]: Stationnement
                    - generic [ref=f3e197]: Stationnement surveillé à proximité.
                  - generic [ref=f3e203]:
                    - paragraph [ref=f3e204]: Paiement
                    - generic [ref=f3e205]: Wave ou Orange Money, en ligne. Les frais de service s’affichent avant le paiement.
                  - generic [ref=f3e211]:
                    - paragraph [ref=f3e212]: Règlement et consignes
                    - generic [ref=f3e213]: Billet présenté sur téléphone ; pièce d’identité pour les entrées à saisie manuelle.
              - region "Organisateur" [ref=f3e214]:
                - generic [ref=f3e216]:
                  - paragraph [ref=f3e217]: Organisateur
                  - paragraph [ref=f3e218]: Baobab Scène
            - complementary [ref=f3e219]:
              - generic [ref=f3e220]:
                - generic [ref=f3e221]:
                  - generic [ref=f3e222]:
                    - heading "Billetterie" [level=2] [ref=f3e223]
                    - paragraph [ref=f3e224]: "Choisissez vos billets : places mises à jour en direct."
                  - status [ref=f3e225]: En direct
                - list "Catégories de billets" [ref=f3e227]:
                  - listitem [ref=f3e228]:
                    - generic [ref=f3e230]:
                      - generic [ref=f3e231]:
                        - heading "VIP" [level=3] [ref=f3e232]
                        - paragraph [ref=f3e233]: 15 000 F CFA
                        - paragraph [ref=f3e234]: Disponible
                        - paragraph [ref=f3e235]: Carré assis, entrée dédiée, une boisson offerte.
                      - group "Quantité VIP" [ref=f3e236]:
                        - button "Retirer un billet VIP" [disabled] [ref=f3e237]
                        - status [ref=f3e240]: "0"
                        - button "Ajouter un billet VIP" [ref=f3e241] [cursor=pointer]
                  - listitem [ref=f3e244]:
                    - generic [ref=f3e246]:
                      - generic [ref=f3e247]:
                        - heading "Standard" [level=3] [ref=f3e248]
                        - paragraph [ref=f3e249]: 5 000 F CFA
                        - paragraph [ref=f3e250]: Disponible
                        - paragraph [ref=f3e251]: Accès à l’esplanade.
                      - group "Quantité Standard" [ref=f3e252]:
                        - button "Retirer un billet Standard" [disabled] [ref=f3e253]
                        - status [ref=f3e256]: "0"
                        - button "Ajouter un billet Standard" [ref=f3e257] [cursor=pointer]
                - paragraph [ref=f3e260]: Choisissez au moins un billet avec le bouton « + ».
                - generic [ref=f3e261]:
                  - paragraph [ref=f3e262]:
                    - generic [ref=f3e263]: Paiement
                    - generic [ref=f3e264]: Wave
                    - generic [ref=f3e265]: ou
                    - generic [ref=f3e266]: Orange Money
                  - paragraph [ref=f3e267]: Billet avec QR code dans Mes billets, dès le paiement
  - alert [ref=f3e271]
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
      |                                                                   ^ Error: contrôles bloquants de fiche-en-cours__ordinateur__sombre.png
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