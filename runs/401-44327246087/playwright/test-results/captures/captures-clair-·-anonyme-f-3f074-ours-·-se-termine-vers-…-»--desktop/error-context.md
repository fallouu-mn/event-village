# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> clair · anonyme >> fiche-en-cours — Fiche — événement en cours (« En cours · se termine vers … »)
- Location: e2e/captures.spec.ts:185:9

# Error details

```
Error: contrôles bloquants de fiche-en-cours__ordinateur__clair.png

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
- generic [active] [ref=f1e1]:
  - generic [ref=f1e2]:
    - complementary [ref=f1e3]:
      - link "Event Village, accueil" [ref=f1e5] [cursor=pointer]:
        - /url: /
        - generic [ref=f1e6]: Event Village
      - navigation "Navigation principale" [ref=f1e9]:
        - generic [ref=f1e10]:
          - paragraph [ref=f1e11]: Menu principal
          - generic [ref=f1e12]:
            - link "Accueil" [ref=f1e13] [cursor=pointer]:
              - /url: /
            - link "Explorer" [ref=f1e18] [cursor=pointer]:
              - /url: /explore
            - link "Mes billets" [ref=f1e23] [cursor=pointer]:
              - /url: /tickets
            - link "Portefeuille" [ref=f1e27] [cursor=pointer]:
              - /url: /wallet
        - generic [ref=f1e32]:
          - paragraph [ref=f1e33]: Espaces métier
          - link "Devenir partenaire" [ref=f1e35] [cursor=pointer]:
            - /url: /partner/register
      - generic [ref=f1e41]:
        - link "Se connecter" [ref=f1e42] [cursor=pointer]:
          - /url: /login
        - button "Basculer le thème" [ref=f1e48] [cursor=pointer]
    - generic [ref=f1e52]:
      - banner [ref=f1e53]:
        - link "Rechercher un événement, un concert, un restaurant…" [ref=f1e55] [cursor=pointer]:
          - /url: /explore
        - button "Notifications" [ref=f1e62] [cursor=pointer]
      - main [ref=f1e66]:
        - generic [ref=f1e68]:
          - generic [ref=f1e69]:
            - link "Retour aux événements" [ref=f1e70] [cursor=pointer]:
              - /url: /explore
            - button "Partager l’événement" [ref=f1e75] [cursor=pointer]
          - generic [ref=f1e83]:
            - article [ref=f1e84]:
              - generic [ref=f1e85]:
                - img "Affiche de l’événement Nuit du Sabar — édition d’automne" [ref=f1e86]
                - paragraph:
                  - generic: En cours · se termine vers 20:30
              - generic [ref=f1e87]:
                - generic [ref=f1e88]: Concerts & Musique
                - heading "Nuit du Sabar — édition d’automne" [level=1] [ref=f1e91]
                - paragraph [ref=f1e92]: Organisé par Baobab Scène
              - list "Infos de l’événement" [ref=f1e93]:
                - listitem [ref=f1e94]:
                  - generic [ref=f1e98]:
                    - paragraph [ref=f1e99]: Mercredi 18 novembre 2026 à 15:30
                    - paragraph [ref=f1e100]: Jusqu’à 20:30
                - listitem [ref=f1e101]:
                  - generic [ref=f1e106]:
                    - paragraph [ref=f1e107]: Esplanade de la Corniche Ouest
                    - paragraph [ref=f1e108]: Esplanade de la Corniche Ouest, Dakar · Dakar
                - listitem [ref=f1e109]:
                  - generic [ref=f1e113]:
                    - paragraph [ref=f1e114]: Billet dans l’application
                    - paragraph [ref=f1e115]: Présentez son QR code à l’entrée, depuis Mes billets.
              - region [ref=f1e116]:
                - heading "À propos" [level=2] [ref=f1e117]
                - paragraph [ref=f1e118]: Une nuit entière de sabar avec quatre troupes de percussionnistes et danseurs, en plein air face à l’océan. Restauration sur place, accès aux personnes à mobilité réduite par l’entrée principale.
              - region [ref=f1e119]:
                - heading "Programme" [level=2] [ref=f1e120]
                - list [ref=f1e121]:
                  - listitem [ref=f1e122]:
                    - generic [ref=f1e124]:
                      - paragraph [ref=f1e125]: 19:30
                      - generic [ref=f1e126]: Activité
                    - paragraph [ref=f1e128]: Ouverture des portes
                  - listitem [ref=f1e129]:
                    - generic [ref=f1e131]:
                      - paragraph [ref=f1e132]: 20:30
                      - generic [ref=f1e133]: Artiste
                    - paragraph [ref=f1e135]: Première partie
                    - paragraph [ref=f1e136]: Troupe Kër Gëstu
                  - listitem [ref=f1e137]:
                    - generic [ref=f1e139]:
                      - paragraph [ref=f1e140]: 22:00
                      - generic [ref=f1e141]: Artiste
                    - paragraph [ref=f1e143]: Grand cercle de sabar
                    - paragraph [ref=f1e144]: Ensemble Ndawrabine des Parcelles
                  - listitem [ref=f1e145]:
                    - generic [ref=f1e147]:
                      - paragraph [ref=f1e148]: 23:30
                      - generic [ref=f1e149]: Activité
                    - paragraph [ref=f1e151]: Bœuf final avec le public
              - region [ref=f1e152]:
                - heading "Lieu et accès" [level=2] [ref=f1e153]
                - generic [ref=f1e154]:
                  - paragraph [ref=f1e155]: Esplanade de la Corniche Ouest
                  - paragraph [ref=f1e156]: Esplanade de la Corniche Ouest, Dakar · Dakar
                - generic [ref=f1e157]:
                  - img "Nuit du Sabar — édition d’automne, Esplanade de la Corniche Ouest" [ref=f1e164]:
                    - generic [ref=f1e165]: Nuit du Sabar — édition d’a…
                  - button "Afficher la carte" [ref=f1e169] [cursor=pointer]
                - link "Voir l’itinéraire" [ref=f1e174] [cursor=pointer]:
                  - /url: https://www.google.com/maps/dir/?api=1&destination=14.6833,-17.4676
                - generic [ref=f1e184]:
                  - generic [ref=f1e191]:
                    - paragraph [ref=f1e192]: Stationnement
                    - generic [ref=f1e193]: Stationnement surveillé à proximité.
                  - generic [ref=f1e199]:
                    - paragraph [ref=f1e200]: Paiement
                    - generic [ref=f1e201]: Wave ou Orange Money, en ligne. Les frais de service s’affichent avant le paiement.
                  - generic [ref=f1e207]:
                    - paragraph [ref=f1e208]: Règlement et consignes
                    - generic [ref=f1e209]: Billet présenté sur téléphone ; pièce d’identité pour les entrées à saisie manuelle.
              - region "Organisateur" [ref=f1e210]:
                - generic [ref=f1e212]:
                  - paragraph [ref=f1e213]: Organisateur
                  - paragraph [ref=f1e214]: Baobab Scène
            - complementary [ref=f1e215]:
              - generic [ref=f1e216]:
                - generic [ref=f1e217]:
                  - generic [ref=f1e218]:
                    - heading "Billetterie" [level=2] [ref=f1e219]
                    - paragraph [ref=f1e220]: "Choisissez vos billets : places mises à jour en direct."
                  - status [ref=f1e221]: En direct
                - list "Catégories de billets" [ref=f1e223]:
                  - listitem [ref=f1e224]:
                    - generic [ref=f1e226]:
                      - generic [ref=f1e227]:
                        - heading "VIP" [level=3] [ref=f1e228]
                        - paragraph [ref=f1e229]: 15 000 F CFA
                        - paragraph [ref=f1e230]: Disponible
                        - paragraph [ref=f1e231]: Carré assis, entrée dédiée, une boisson offerte.
                      - group "Quantité VIP" [ref=f1e232]:
                        - button "Retirer un billet VIP" [disabled] [ref=f1e233]
                        - status [ref=f1e236]: "0"
                        - button "Ajouter un billet VIP" [ref=f1e237] [cursor=pointer]
                  - listitem [ref=f1e240]:
                    - generic [ref=f1e242]:
                      - generic [ref=f1e243]:
                        - heading "Standard" [level=3] [ref=f1e244]
                        - paragraph [ref=f1e245]: 5 000 F CFA
                        - paragraph [ref=f1e246]: Disponible
                        - paragraph [ref=f1e247]: Accès à l’esplanade.
                      - group "Quantité Standard" [ref=f1e248]:
                        - button "Retirer un billet Standard" [disabled] [ref=f1e249]
                        - status [ref=f1e252]: "0"
                        - button "Ajouter un billet Standard" [ref=f1e253] [cursor=pointer]
                - paragraph [ref=f1e256]: Choisissez au moins un billet avec le bouton « + ».
                - generic [ref=f1e257]:
                  - paragraph [ref=f1e258]:
                    - generic [ref=f1e259]: Paiement
                    - generic [ref=f1e260]: Wave
                    - generic [ref=f1e261]: ou
                    - generic [ref=f1e262]: Orange Money
                  - paragraph [ref=f1e263]: Billet avec QR code dans Mes billets, dès le paiement
  - alert [ref=f1e267]
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
      |                                                                   ^ Error: contrôles bloquants de fiche-en-cours__ordinateur__clair.png
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