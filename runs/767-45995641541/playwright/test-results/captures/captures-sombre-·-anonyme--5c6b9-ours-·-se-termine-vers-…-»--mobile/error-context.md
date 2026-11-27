# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · anonyme >> fiche-en-cours — Fiche — événement en cours (« En cours · se termine vers … »)
- Location: e2e/captures.spec.ts:202:9

# Error details

```
Error: contrôles bloquants de fiche-en-cours__mobile__sombre.png

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
    - generic [ref=f3e3]:
      - banner [ref=f3e4]:
        - generic [ref=f3e5]:
          - button "Ouvrir le menu" [ref=f3e6] [cursor=pointer]
          - link "Event Village, accueil" [ref=f3e10] [cursor=pointer]:
            - /url: /
        - generic [ref=f3e13]:
          - button "Notifications" [ref=f3e15] [cursor=pointer]
          - button "Basculer le thème" [pressed] [ref=f3e20] [cursor=pointer]
          - link "Se connecter" [ref=f3e28] [cursor=pointer]:
            - /url: /login
      - main [ref=f3e32]:
        - generic [ref=f3e34]:
          - region [ref=f3e35]:
            - generic [ref=f3e37]:
              - link "Retour aux événements" [ref=f3e38] [cursor=pointer]:
                - /url: /explore
                - generic [aria-hidden] [ref=f3e41]: Retour
              - generic [ref=f3e42]:
                - 'button "Mettre en favori : Nuit du Sabar — édition d’automne" [ref=f3e43] [cursor=pointer]'
                - button "Partager l’événement" [ref=f3e46] [cursor=pointer]
            - generic [ref=f3e53]:
              - generic [ref=f3e54]:
                - img "Affiche de l’événement Nuit du Sabar — édition d’automne" [ref=f3e55]
                - paragraph:
                  - generic: En cours · se termine vers 18:00
              - generic [ref=f3e56]:
                - generic [ref=f3e57]: Concerts & Musique
                - heading "Nuit du Sabar — édition d’automne" [level=1] [ref=f3e60]
                - paragraph [ref=f3e61]: Organisé par Baobab Scène
                - list "Date et lieu" [ref=f3e62]:
                  - listitem [ref=f3e63]:
                    - generic [ref=f3e66]:
                      - generic [ref=f3e67]: Vendredi 27 novembre 2026 à 13:00
                      - generic [ref=f3e68]: Jusqu’à 18:00
                  - listitem [ref=f3e69]:
                    - generic [ref=f3e73]:
                      - generic [ref=f3e74]: Esplanade de la Corniche Ouest
                      - generic [ref=f3e75]: Esplanade de la Corniche Ouest, Dakar · Dakar
          - generic [ref=f3e78]:
            - article [ref=f3e79]:
              - list "Infos de l’événement" [ref=f3e80]:
                - listitem [ref=f3e81]:
                  - generic [ref=f3e85]:
                    - paragraph [ref=f3e86]: Billet dans l’application
                    - paragraph [ref=f3e87]: Présentez son QR code à l’entrée, depuis Mes billets.
              - region [ref=f3e88]:
                - heading "À propos" [level=2] [ref=f3e89]
                - paragraph [ref=f3e90]: Une nuit entière de sabar avec quatre troupes de percussionnistes et danseurs, en plein air face à l’océan. Restauration sur place, accès aux personnes à mobilité réduite par l’entrée principale.
              - region [ref=f3e91]:
                - heading "Programme" [level=2] [ref=f3e92]
                - list [ref=f3e93]:
                  - listitem [ref=f3e94]:
                    - generic [ref=f3e96]:
                      - paragraph [ref=f3e97]: 19:30
                      - generic [ref=f3e98]: Activité
                    - paragraph [ref=f3e100]: Ouverture des portes
                  - listitem [ref=f3e101]:
                    - generic [ref=f3e103]:
                      - paragraph [ref=f3e104]: 20:30
                      - generic [ref=f3e105]: Artiste
                    - paragraph [ref=f3e107]: Première partie
                    - paragraph [ref=f3e108]: Troupe Kër Gëstu
                  - listitem [ref=f3e109]:
                    - generic [ref=f3e111]:
                      - paragraph [ref=f3e112]: 22:00
                      - generic [ref=f3e113]: Artiste
                    - paragraph [ref=f3e115]: Grand cercle de sabar
                    - paragraph [ref=f3e116]: Ensemble Ndawrabine des Parcelles
                  - listitem [ref=f3e117]:
                    - generic [ref=f3e119]:
                      - paragraph [ref=f3e120]: 23:30
                      - generic [ref=f3e121]: Activité
                    - paragraph [ref=f3e123]: Bœuf final avec le public
              - region [ref=f3e124]:
                - heading "Lieu et accès" [level=2] [ref=f3e125]
                - generic [ref=f3e126]:
                  - paragraph [ref=f3e127]: Esplanade de la Corniche Ouest
                  - paragraph [ref=f3e128]: Esplanade de la Corniche Ouest, Dakar · Dakar
                - generic [ref=f3e129]:
                  - img "Nuit du Sabar — édition d’automne, Esplanade de la Corniche Ouest" [ref=f3e136]:
                    - generic [ref=f3e137]: Nuit du Sabar — édition d’a…
                  - button "Afficher la carte" [ref=f3e141] [cursor=pointer]
                - link "Voir l’itinéraire" [ref=f3e146] [cursor=pointer]:
                  - /url: https://www.google.com/maps/dir/?api=1&destination=14.6833,-17.4676
                - generic [ref=f3e156]:
                  - generic [ref=f3e163]:
                    - paragraph [ref=f3e164]: Stationnement
                    - generic [ref=f3e165]: Stationnement surveillé à proximité.
                  - generic [ref=f3e171]:
                    - paragraph [ref=f3e172]: Paiement
                    - generic [ref=f3e173]: Wave ou Orange Money, en ligne. Les frais de service s’affichent avant le paiement.
                  - generic [ref=f3e179]:
                    - paragraph [ref=f3e180]: Règlement et consignes
                    - generic [ref=f3e181]: Billet présenté sur téléphone ; pièce d’identité pour les entrées à saisie manuelle.
              - region "Organisateur" [ref=f3e182]:
                - generic [ref=f3e184]:
                  - paragraph [ref=f3e185]: Organisateur
                  - paragraph [ref=f3e186]: Baobab Scène
            - complementary [ref=f3e187]:
              - generic [ref=f3e188]:
                - generic [ref=f3e189]:
                  - generic [ref=f3e190]:
                    - heading "Billetterie" [level=2] [ref=f3e191]
                    - paragraph [ref=f3e192]: "Choisissez vos billets : places mises à jour en direct."
                  - status [ref=f3e193]: En direct
                - list "Catégories de billets" [ref=f3e195]:
                  - listitem [ref=f3e196]:
                    - generic [ref=f3e198]:
                      - generic [ref=f3e199]:
                        - heading "VIP" [level=3] [ref=f3e200]
                        - paragraph [ref=f3e201]: 15 000 F CFA
                        - paragraph [ref=f3e202]: Disponible
                        - paragraph [ref=f3e203]: Carré assis, entrée dédiée, une boisson offerte.
                      - group "Quantité VIP" [ref=f3e204]:
                        - button "Retirer un billet VIP" [disabled] [ref=f3e205]
                        - status [ref=f3e208]: "0"
                        - button "Ajouter un billet VIP" [ref=f3e209] [cursor=pointer]
                  - listitem [ref=f3e212]:
                    - generic [ref=f3e214]:
                      - generic [ref=f3e215]:
                        - heading "Standard" [level=3] [ref=f3e216]
                        - paragraph [ref=f3e217]: 5 000 F CFA
                        - paragraph [ref=f3e218]: Disponible
                        - paragraph [ref=f3e219]: Accès à l’esplanade.
                      - group "Quantité Standard" [ref=f3e220]:
                        - button "Retirer un billet Standard" [disabled] [ref=f3e221]
                        - status [ref=f3e224]: "0"
                        - button "Ajouter un billet Standard" [ref=f3e225] [cursor=pointer]
                - paragraph [ref=f3e228]: Choisissez au moins un billet avec le bouton « + ».
                - generic [ref=f3e229]:
                  - paragraph [ref=f3e230]:
                    - generic [ref=f3e231]: Payer avec
                    - generic [ref=f3e232]: Wave
                    - generic [ref=f3e234]: ou
                    - generic [ref=f3e235]: Orange Money
                  - paragraph [ref=f3e237]: Billet avec QR code dans Mes billets, dès le paiement
              - region "Achat des billets" [ref=f3e242]:
                - generic [ref=f3e243]:
                  - generic [ref=f3e244]:
                    - paragraph [ref=f3e245]: Billetterie
                    - paragraph [ref=f3e246]: Dès 5 000 F CFA
                  - button "Choisir mes billets" [ref=f3e247] [cursor=pointer]
    - navigation "Navigation rapide":
      - generic [ref=f3e249]:
        - link "Accueil" [ref=f3e251] [cursor=pointer]:
          - /url: /
        - link "Explorer" [ref=f3e257] [cursor=pointer]:
          - /url: /explore
        - link "Billets" [ref=f3e263] [cursor=pointer]:
          - /url: /tickets
        - link "Avis" [ref=f3e268] [cursor=pointer]:
          - /url: /notifications
        - link "Portefeuille" [ref=f3e274] [cursor=pointer]:
          - /url: /wallet
  - alert [ref=f3e280]
```

# Test source

```ts
  245 |             for (const stub of stubs) {
  246 |                 record.notes.push(`réponse simulée : ${stub.method ?? 'toute méthode'} ${stub.url} remplacée par HTTP ${stub.status} ${JSON.stringify(stub.body).slice(0, 160)}`);
  247 |                 await page.route(stub.url, async (route) => {
  248 |                     if (!methodMatches(stub.method, route.request().method())) {
  249 |                         await route.fallback();
  250 |                         return;
  251 |                     }
  252 |                     await route.fulfill({ status: stub.status, contentType: 'application/json; charset=utf-8', body: JSON.stringify(stub.body) });
  253 |                 });
  254 |             }
  255 |             for (const hold of screen.holdRequests ?? []) {
  256 |                 record.notes.push(`requête retenue (jamais servie) : ${hold.method ?? 'toute méthode'} ${hold.url}`);
  257 |                 await page.route(hold.url, async (route) => {
  258 |                     if (!methodMatches(hold.method, route.request().method())) {
  259 |                         await route.fallback();
  260 |                         return;
  261 |                     }
  262 |                     // Retenue jusqu'à la fermeture de la page : ni réponse ni erreur (réseau lent, téléchargement en cours)
  263 |                     await new Promise<void>((resolve) => { page.once('close', () => resolve()); });
  264 |                 });
  265 |             }
  266 |             if (screen.fakePush) {
  267 |                 const subscription = screen.fakePush === 'granted' ? await fakePushSubscriber() : null;
  268 |                 record.notes.push(screen.fakePush === 'granted'
  269 |                     ? `push simulé (granted) : permission accordée au clic sans fenêtre, inscription du service worker et pushManager.subscribe remplacés ; abonnement du faux service push ${subscription?.endpoint ?? '?'} ; configuration VAPID, route d'inscription et base réelles`
  270 |                     : screen.fakePush === 'denied'
  271 |                         ? 'push simulé (denied) : Notification.permission = « denied », appels à requestPermission comptés'
  272 |                         : 'push simulé (unsupported) : window.PushManager et window.Notification supprimés');
  273 |                 await context.addInitScript(installFakePush, { mode: screen.fakePush, subscription });
  274 |             }
  275 |             if (screen.fakeCamera) {
  276 |                 const mode = screen.fakeCamera === 'barcode-detector' ? 'barcode-detector' : fakeScanMode();
  277 |                 record.notes.push(`caméra simulée (${mode})${mode === 'barcode-detector' ? ' : faux BarcodeDetector, payload posé par le test' : ''}`);
  278 |                 await context.addInitScript(installFakeCamera, { mode });
  279 |             }
  280 |             if (screen.offline === 'before-load') {
  281 |                 record.notes.push('connexion coupée avant le chargement (collecte d’erreurs arrêtée)');
  282 |                 guard.freeze();
  283 |                 await context.setOffline(true);
  284 |             }
  285 |             const response = await page.goto(record.url, { waitUntil: 'load' });
  286 |             record.status = response ? response.status() : null;
  287 |             if (screen.expectStatus !== undefined) {
  288 |                 expect(record.status, `statut HTTP du document ${record.url}`).toBe(screen.expectStatus);
  289 |             }
  290 |             if (screen.offline === 'after-load') {
  291 |                 record.notes.push('connexion coupée après le chargement (collecte d’erreurs arrêtée)');
  292 |                 guard.freeze();
  293 |                 await context.setOffline(true);
  294 |             }
  295 |             const sc = { page, context, guard, ids: demo };
  296 |             if (screen.ready) await screen.ready(sc);
  297 |             await settle(page, guard, record.notes);
  298 |             if (screen.actions) {
  299 |                 await screen.actions(sc);
  300 |                 await settle(page, guard, record.notes);
  301 |             }
  302 |             if (screen.id === 'cloche-ouverte' && vue === 'mobile') {
  303 |                 const problem = await markAllOnOneLine(page);
  304 |                 if (problem) record.blocking.push(problem);
  305 |             }
  306 |             // Design 1e (décision du 21/11, modification signalée) : contrôles toujours faits page en HAUT (position fixe) :
  307 |             // selon le défilement laissé par l'écran, une cible pouvait se trouver à moitié sous l'en-tête collant et le
  308 |             // verdict d'axe changeait d'un run à l'autre. Aucune règle d'axe changée ; la capture garde ensuite la position
  309 |             // de l'écran (barre d'achat sur page défilée…).
  310 |             // Finition 5 (point 1) : la page capturée est-elle vraiment dans le thème demandé ? (classe dark et fond lus sur la
  311 |             // page ; bloquant : depuis le design 1a, les captures « sombre » des comptes connectés sortaient en clair)
  312 |             record.themeLu = await readTheme(page);
  313 |             const themeIssue = themeProblem(record.themeLu, theme.key);
  314 |             if (themeIssue) record.blocking.push(themeIssue);
  315 |             const scrolledTo = await page.evaluate(() => { const y = window.scrollY; window.scrollTo({ top: 0, behavior: 'instant' }); return y; });
  316 |             const checks = await runPageChecks(page, { mobile: vue === 'mobile', axe: true, references: screen.references });
  317 |             if (scrolledTo > 0) await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), scrolledTo);
  318 |             record.blocking.push(...checks.blocking);
  319 |             record.warnings.push(...checks.warnings);
  320 |             record.axeDetails = checks.axeDetails;
  321 |             record.smallTextDetails = checks.smallTextDetails;
  322 |             record.metrics = checks.metrics;
  323 |             const shot = await capture(page, screen, file);
  324 |             record.captured = true;
  325 |             await testInfo.attach(file, { path: shot, contentType: 'image/png' });
  326 |         } catch (err) {
  327 |             record.error = err instanceof Error ? err.message.split('\n')[0] : String(err);
  328 |             if (!record.captured && !page.isClosed()) {
  329 |                 await capture(page, screen, file).then(
  330 |                     async (shot) => {
  331 |                         record.captured = true;
  332 |                         record.notes.push('capture prise après l’erreur (état de la page au moment de l’échec)');
  333 |                         await testInfo.attach(file, { path: shot, contentType: 'image/png' });
  334 |                     },
  335 |                     (shotErr: Error) => { record.notes.push(`capture impossible après l’erreur : ${shotErr.message.split('\n')[0]}`); },
  336 |                 );
  337 |             }
  338 |             throw err;
  339 |         } finally {
  340 |             record.blocking.push(...guard.blockingIssues());
  341 |             record.warnings.push(...guard.nonBlockingIssues());
  342 |             record.durationMs = Date.now() - started;
  343 |             writeCaptureRecord(record);
  344 |         }
> 345 |         expect(record.blocking, `contrôles bloquants de ${file}`).toEqual([]);
      |                                                                   ^ Error: contrôles bloquants de fiche-en-cours__mobile__sombre.png
  346 |     });
  347 | }
  348 | 
  349 | for (const theme of THEMES) {
  350 |     for (const role of ROLE_ORDER) {
  351 |         const screens = SCREENS.filter((s) => s.role === role);
  352 |         if (screens.length === 0) continue;
  353 |         test.describe(`${theme.key} · ${role}`, () => {
  354 |             test.use({ colorScheme: theme.colorScheme, evTheme: theme.key, evRole: role });
  355 | 
  356 |             for (const screen of screens) {
  357 |                 if (screen.serviceWorkers === 'allow') {
  358 |                     // Lot 7 (D7) : service worker autorisé seulement dans le contexte de cet écran
  359 |                     test.describe(`${screen.id} (service worker autorisé)`, () => {
  360 |                         test.use({ serviceWorkers: 'allow' });
  361 |                         defineCapture(screen, theme, role);
  362 |                     });
  363 |                 } else {
  364 |                     defineCapture(screen, theme, role);
  365 |                 }
  366 |             }
  367 |         });
  368 |     }
  369 | }
  370 | 
```