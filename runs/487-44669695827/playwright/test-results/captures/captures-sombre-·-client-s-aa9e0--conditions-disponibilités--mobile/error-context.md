# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · client >> salles-fiche — Fiche d’une salle validée (photo, équipements, conditions, disponibilités)
- Location: e2e/captures.spec.ts:192:9

# Error details

```
Error: contrôles bloquants de salles-fiche__mobile__sombre.png

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "axe-core label-content-name-mismatch (serious, 11 nœud(s)) : Elements must have their visible text as part of their accessible name",
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
        - generic [ref=e13]:
          - button "Notifications, 10 non lues" [ref=e15] [cursor=pointer]:
            - generic [ref=e19]: "10"
          - button "Basculer le thème" [ref=e21] [cursor=pointer]
          - link "Mon profil (Fatou Mbaye)" [ref=e25] [cursor=pointer]:
            - /url: /profile
            - generic [aria-hidden] [ref=e26]: FM
      - main [ref=e28]:
        - generic [ref=e30]:
          - link "Toutes les salles" [ref=e31] [cursor=pointer]:
            - /url: /halls
          - generic [ref=e36]:
            - article [ref=e37]:
              - region "Photos de la salle Salle des Fromagers" [ref=e38]:
                - generic [ref=e39]:
                  - img "Photo 1 sur 1 de la salle Salle des Fromagers" [ref=e41]
                  - button "Voir la photo 1 sur 1 en plein écran" [ref=e42]
                  - button "Voir les photos en plein écran" [ref=e44] [cursor=pointer]
              - generic [ref=e51]:
                - heading "Salle des Fromagers" [level=1] [ref=e52]
                - paragraph [ref=e53]:
                  - generic [ref=e57]: 22, avenue Léopold-Sédar-Senghor, Dakar-Plateau, Dakar
                - paragraph [ref=e58]: Proposée par Baobab Scène
              - list "L’essentiel" [ref=e59]:
                - listitem [ref=e60]:
                  - generic [ref=e67]:
                    - paragraph [ref=e68]: Jusqu’à 350 invités
                    - paragraph [ref=e69]: Capacité indiquée par la salle
                - listitem [ref=e70]:
                  - generic [ref=e75]:
                    - paragraph [ref=e76]: 450 000 F CFA par jour
                    - paragraph [ref=e77]: ou 60 000 F CFA par heure
              - link "Choisir une date et réserver" [ref=e78] [cursor=pointer]:
                - /url: "#reserver"
              - region [ref=e80]:
                - heading "À propos de la salle" [level=2] [ref=e81]
                - paragraph [ref=e82]: Grande salle climatisée au cœur du Plateau, avec scène, piste de danse et terrasse ombragée. Mariages, baptêmes, galas et séminaires jusqu’à 350 invités ; cuisine équipée pour le traiteur et parking surveillé.
              - region [ref=e83]:
                - heading "Équipements" [level=2] [ref=e84]
                - list [ref=e85]:
                  - listitem [ref=e86]:
                    - generic [ref=e89]: Climatisation
                  - listitem [ref=e90]:
                    - generic [ref=e93]: Sonorisation
                  - listitem [ref=e94]:
                    - generic [ref=e97]: Scène
                  - listitem [ref=e98]:
                    - generic [ref=e101]: Piste de danse
                  - listitem [ref=e102]:
                    - generic [ref=e105]: Cuisine équipée
                  - listitem [ref=e106]:
                    - generic [ref=e109]: Parking surveillé
                  - listitem [ref=e110]:
                    - generic [ref=e113]: Groupe électrogène
                  - listitem [ref=e114]:
                    - generic [ref=e117]: Terrasse
              - region [ref=e118]:
                - heading "Adresse" [level=2] [ref=e119]
                - paragraph [ref=e120]: 22, avenue Léopold-Sédar-Senghor, Dakar-Plateau, Dakar
                - generic [ref=e121]:
                  - img "Salle des Fromagers, 22, avenue Léopold-Sédar-Senghor, Dakar-Plateau, Dakar" [ref=e128]:
                    - generic [ref=e129]: Salle des Fromagers
                  - button "Afficher la carte" [ref=e133] [cursor=pointer]
                - link "Voir l’itinéraire" [ref=e138] [cursor=pointer]:
                  - /url: https://www.google.com/maps/dir/?api=1&destination=14.6712,-17.437
              - region [ref=e148]:
                - heading "Paiement et annulation" [level=2] [ref=e149]
                - generic [ref=e150]:
                  - generic [ref=e151]:
                    - heading "Acompte" [level=3] [ref=e152]
                    - paragraph [ref=e153]: Acompte de 40 % du prix, plus sa part des frais de service.
                  - generic [ref=e154]:
                    - heading "Solde" [level=3] [ref=e155]
                    - paragraph [ref=e156]: Le reste est à payer au plus tard 7 jours avant la date. Pour une date plus proche, tout se paie en une fois.
                  - generic [ref=e157]:
                    - heading "Délai pour payer" [level=3] [ref=e158]
                    - paragraph [ref=e159]: La date est gardée 15 minutes pour payer, par Wave ou Orange Money. Sans paiement, elle est libérée.
                  - generic [ref=e160]:
                    - heading "Frais de service" [level=3] [ref=e161]
                    - paragraph [ref=e162]: Ils s’ajoutent au prix ; leur montant exact s’affiche avant de payer.
                  - generic [ref=e163]:
                    - heading "Conditions d’annulation" [level=3] [ref=e164]
                    - paragraph [ref=e165]: "Règle Modérée : remboursement total si vous annulez au moins 30 jours avant la date, 50 % jusqu’à 7 jours avant, rien ensuite."
              - region [ref=e166]:
                - heading "Disponibilités" [level=2] [ref=e167]
                - generic [ref=e169]:
                  - generic [ref=e170]:
                    - button "Mois précédent" [disabled] [ref=e171]
                    - heading "Novembre 2026" [level=3] [ref=e175]
                    - button "Mois suivant" [ref=e176] [cursor=pointer]
                  - list "Jours de Novembre 2026" [ref=e181]:
                    - listitem [ref=e182]:
                      - button "Vendredi 20 novembre 2026, aujourd’hui, libre" [ref=e183] [cursor=pointer]:
                        - generic [aria-hidden] [ref=e184]: ven.
                        - generic [ref=e185]: "20"
                    - listitem [ref=e188]:
                      - button "Samedi 21 novembre 2026, libre" [ref=e189] [cursor=pointer]:
                        - generic [aria-hidden] [ref=e190]: sam.
                        - generic [ref=e191]: "21"
                    - listitem [ref=e194]:
                      - button "Dimanche 22 novembre 2026, libre" [ref=e195] [cursor=pointer]:
                        - generic [aria-hidden] [ref=e196]: dim.
                        - generic [ref=e197]: "22"
                    - listitem [ref=e200]:
                      - button "Lundi 23 novembre 2026, libre" [ref=e201] [cursor=pointer]:
                        - generic [aria-hidden] [ref=e202]: lun.
                        - generic [ref=e203]: "23"
                    - listitem [ref=e206]:
                      - button "Mardi 24 novembre 2026, libre" [ref=e207] [cursor=pointer]:
                        - generic [aria-hidden] [ref=e208]: mar.
                        - generic [ref=e209]: "24"
                    - listitem [ref=e212]:
                      - button "Mercredi 25 novembre 2026, libre" [ref=e213] [cursor=pointer]:
                        - generic [aria-hidden] [ref=e214]: mer.
                        - generic [ref=e215]: "25"
                    - listitem [ref=e218]:
                      - button "Jeudi 26 novembre 2026, libre" [ref=e219] [cursor=pointer]:
                        - generic [aria-hidden] [ref=e220]: jeu.
                        - generic [ref=e221]: "26"
                    - listitem [ref=e224]:
                      - button "Vendredi 27 novembre 2026, libre" [ref=e225] [cursor=pointer]:
                        - generic [aria-hidden] [ref=e226]: ven.
                        - generic [ref=e227]: "27"
                    - listitem [ref=e230]:
                      - button "Samedi 28 novembre 2026, libre" [ref=e231] [cursor=pointer]:
                        - generic [aria-hidden] [ref=e232]: sam.
                        - generic [ref=e233]: "28"
                    - listitem [ref=e236]:
                      - button "Dimanche 29 novembre 2026, libre" [ref=e237] [cursor=pointer]:
                        - generic [aria-hidden] [ref=e238]: dim.
                        - generic [ref=e239]: "29"
                    - listitem [ref=e242]:
                      - button "Lundi 30 novembre 2026, libre" [ref=e243] [cursor=pointer]:
                        - generic [aria-hidden] [ref=e244]: lun.
                        - generic [ref=e245]: "30"
                  - list "Légende du calendrier" [ref=e248]:
                    - listitem [ref=e249]:
                      - generic [ref=e251]: "5"
                      - text: Libre
                    - listitem [ref=e254]:
                      - generic [ref=e256]: "5"
                      - text: Pris en partie (à l’heure)
                    - listitem [ref=e260]:
                      - generic [ref=e262]: "5"
                      - text: Déjà réservé
                    - listitem [ref=e266]:
                      - generic [ref=e268]: "5"
                      - text: Passé
                    - listitem [ref=e270]:
                      - generic [ref=e272]: "5"
                      - text: Votre date
                    - listitem [ref=e276]:
                      - generic [aria-hidden] [ref=e277]: "5"
                      - text: Aujourd’hui
            - complementary [ref=e278]:
              - generic [ref=e279]:
                - generic [ref=e280]:
                  - heading "Réserver la salle" [level=2] [ref=e281]
                  - paragraph [ref=e282]: 450 000 F CFA par jour ou 60 000 F CFA par heure, frais de service en plus.
                - group "Durée de la location" [ref=e283]:
                  - button "À la journée" [pressed] [ref=e284] [cursor=pointer]:
                    - generic [aria-hidden] [ref=e285]: ✓
                    - text: À la journée
                  - button "À l’heure" [ref=e288] [cursor=pointer]
                - generic [ref=e292]:
                  - generic [ref=e293]:
                    - generic [ref=e294]: Date
                    - textbox "Date" [ref=e296]
                    - paragraph [ref=e297]: Ou touchez un jour libre du calendrier.
                  - generic [ref=e298]:
                    - generic [ref=e299]: Nombre de jours
                    - combobox "Nombre de jours" [ref=e302] [cursor=pointer]:
                      - option "1 jour" [selected]
                      - option "2 jours"
                      - option "3 jours"
                      - option "4 jours"
                      - option "5 jours"
                      - option "6 jours"
                      - option "7 jours"
                      - option "8 jours"
                      - option "9 jours"
                      - option "10 jours"
                      - option "11 jours"
                      - option "12 jours"
                      - option "13 jours"
                      - option "14 jours"
                      - option "15 jours"
                      - option "16 jours"
                      - option "17 jours"
                      - option "18 jours"
                      - option "19 jours"
                      - option "20 jours"
                      - option "21 jours"
                      - option "22 jours"
                      - option "23 jours"
                      - option "24 jours"
                      - option "25 jours"
                      - option "26 jours"
                      - option "27 jours"
                      - option "28 jours"
                      - option "29 jours"
                      - option "30 jours"
                - status [ref=e303]
                - paragraph [ref=e305]: Choisissez une date pour voir le prix exact, l’acompte et les conditions.
                - generic [ref=e306]:
                  - button "Réserver et payer l’acompte" [disabled] [ref=e307]
                  - paragraph [ref=e309]: Après la réservation, la date vous est gardée 15 minutes, le temps de payer par Wave ou Orange Money.
    - navigation "Navigation rapide" [ref=e310]:
      - generic [ref=e311]:
        - link "Accueil" [ref=e312] [cursor=pointer]:
          - /url: /
        - link "Explorer" [ref=e317] [cursor=pointer]:
          - /url: /explore
        - link "Billets" [ref=e322] [cursor=pointer]:
          - /url: /tickets
        - link "Achats" [ref=e326] [cursor=pointer]:
          - /url: /orders
        - link "Portefeuille" [ref=e331] [cursor=pointer]:
          - /url: /wallet
  - alert [ref=e336]
```

# Test source

```ts
  224 |                 await context.addInitScript(stretchTimers, screen.slowTimers);
  225 |             }
  226 |             if (screen.injectError) {
  227 |                 record.notes.push(`état d'erreur simulé : réponses ${screen.injectError} remplacées par un 500 (erreurs de console attendues, ignorées)`);
  228 |                 await page.route(screen.injectError, (route) => route.fulfill({
  229 |                     status: 500,
  230 |                     contentType: 'application/json; charset=utf-8',
  231 |                     body: JSON.stringify({ error: screen.injectErrorMessage ?? 'Erreur simulée par les tests de bout en bout.', code: 'E2E_SIMULATED_ERROR' }),
  232 |                 }));
  233 |             }
  234 |             const stubs: StubResponse[] = [...(screen.stubResponse ? [screen.stubResponse] : []), ...(screen.stubResponses ?? [])];
  235 |             for (const stub of stubs) {
  236 |                 record.notes.push(`réponse simulée : ${stub.method ?? 'toute méthode'} ${stub.url} remplacée par HTTP ${stub.status} ${JSON.stringify(stub.body).slice(0, 160)}`);
  237 |                 await page.route(stub.url, async (route) => {
  238 |                     if (!methodMatches(stub.method, route.request().method())) {
  239 |                         await route.fallback();
  240 |                         return;
  241 |                     }
  242 |                     await route.fulfill({ status: stub.status, contentType: 'application/json; charset=utf-8', body: JSON.stringify(stub.body) });
  243 |                 });
  244 |             }
  245 |             for (const hold of screen.holdRequests ?? []) {
  246 |                 record.notes.push(`requête retenue (jamais servie) : ${hold.method ?? 'toute méthode'} ${hold.url}`);
  247 |                 await page.route(hold.url, async (route) => {
  248 |                     if (!methodMatches(hold.method, route.request().method())) {
  249 |                         await route.fallback();
  250 |                         return;
  251 |                     }
  252 |                     // Retenue jusqu'à la fermeture de la page : ni réponse ni erreur (réseau lent, téléchargement en cours)
  253 |                     await new Promise<void>((resolve) => { page.once('close', () => resolve()); });
  254 |                 });
  255 |             }
  256 |             if (screen.fakePush) {
  257 |                 const subscription = screen.fakePush === 'granted' ? await fakePushSubscriber() : null;
  258 |                 record.notes.push(screen.fakePush === 'granted'
  259 |                     ? `push simulé (granted) : permission accordée au clic sans fenêtre, inscription du service worker et pushManager.subscribe remplacés ; abonnement du faux service push ${subscription?.endpoint ?? '?'} ; configuration VAPID, route d'inscription et base réelles`
  260 |                     : screen.fakePush === 'denied'
  261 |                         ? 'push simulé (denied) : Notification.permission = « denied », appels à requestPermission comptés'
  262 |                         : 'push simulé (unsupported) : window.PushManager et window.Notification supprimés');
  263 |                 await context.addInitScript(installFakePush, { mode: screen.fakePush, subscription });
  264 |             }
  265 |             if (screen.fakeCamera) {
  266 |                 const mode = screen.fakeCamera === 'barcode-detector' ? 'barcode-detector' : fakeScanMode();
  267 |                 record.notes.push(`caméra simulée (${mode})${mode === 'barcode-detector' ? ' : faux BarcodeDetector, payload posé par le test' : ''}`);
  268 |                 await context.addInitScript(installFakeCamera, { mode });
  269 |             }
  270 |             if (screen.offline === 'before-load') {
  271 |                 record.notes.push('connexion coupée avant le chargement (collecte d’erreurs arrêtée)');
  272 |                 guard.freeze();
  273 |                 await context.setOffline(true);
  274 |             }
  275 |             const response = await page.goto(record.url, { waitUntil: 'load' });
  276 |             record.status = response ? response.status() : null;
  277 |             if (screen.expectStatus !== undefined) {
  278 |                 expect(record.status, `statut HTTP du document ${record.url}`).toBe(screen.expectStatus);
  279 |             }
  280 |             if (screen.offline === 'after-load') {
  281 |                 record.notes.push('connexion coupée après le chargement (collecte d’erreurs arrêtée)');
  282 |                 guard.freeze();
  283 |                 await context.setOffline(true);
  284 |             }
  285 |             const sc = { page, context, guard, ids: demo };
  286 |             if (screen.ready) await screen.ready(sc);
  287 |             await settle(page, guard, record.notes);
  288 |             if (screen.actions) {
  289 |                 await screen.actions(sc);
  290 |                 await settle(page, guard, record.notes);
  291 |             }
  292 |             if (screen.id === 'cloche-ouverte' && vue === 'mobile') {
  293 |                 const problem = await markAllOnOneLine(page);
  294 |                 if (problem) record.blocking.push(problem);
  295 |             }
  296 |             const checks = await runPageChecks(page, { mobile: vue === 'mobile', axe: true, references: screen.references });
  297 |             record.blocking.push(...checks.blocking);
  298 |             record.warnings.push(...checks.warnings);
  299 |             record.axeDetails = checks.axeDetails;
  300 |             record.smallTextDetails = checks.smallTextDetails;
  301 |             record.metrics = checks.metrics;
  302 |             const shot = await capture(page, screen, file);
  303 |             record.captured = true;
  304 |             await testInfo.attach(file, { path: shot, contentType: 'image/png' });
  305 |         } catch (err) {
  306 |             record.error = err instanceof Error ? err.message.split('\n')[0] : String(err);
  307 |             if (!record.captured && !page.isClosed()) {
  308 |                 await capture(page, screen, file).then(
  309 |                     async (shot) => {
  310 |                         record.captured = true;
  311 |                         record.notes.push('capture prise après l’erreur (état de la page au moment de l’échec)');
  312 |                         await testInfo.attach(file, { path: shot, contentType: 'image/png' });
  313 |                     },
  314 |                     (shotErr: Error) => { record.notes.push(`capture impossible après l’erreur : ${shotErr.message.split('\n')[0]}`); },
  315 |                 );
  316 |             }
  317 |             throw err;
  318 |         } finally {
  319 |             record.blocking.push(...guard.blockingIssues());
  320 |             record.warnings.push(...guard.nonBlockingIssues());
  321 |             record.durationMs = Date.now() - started;
  322 |             writeCaptureRecord(record);
  323 |         }
> 324 |         expect(record.blocking, `contrôles bloquants de ${file}`).toEqual([]);
      |                                                                   ^ Error: contrôles bloquants de salles-fiche__mobile__sombre.png
  325 |     });
  326 | }
  327 | 
  328 | for (const theme of THEMES) {
  329 |     for (const role of ROLE_ORDER) {
  330 |         const screens = SCREENS.filter((s) => s.role === role);
  331 |         if (screens.length === 0) continue;
  332 |         test.describe(`${theme.key} · ${role}`, () => {
  333 |             test.use({ colorScheme: theme.colorScheme, evTheme: theme.key, evRole: role });
  334 | 
  335 |             for (const screen of screens) {
  336 |                 if (screen.serviceWorkers === 'allow') {
  337 |                     // Lot 7 (D7) : service worker autorisé seulement dans le contexte de cet écran
  338 |                     test.describe(`${screen.id} (service worker autorisé)`, () => {
  339 |                         test.use({ serviceWorkers: 'allow' });
  340 |                         defineCapture(screen, theme, role);
  341 |                     });
  342 |                 } else {
  343 |                     defineCapture(screen, theme, role);
  344 |                 }
  345 |             }
  346 |         });
  347 |     }
  348 | }
  349 | 
```