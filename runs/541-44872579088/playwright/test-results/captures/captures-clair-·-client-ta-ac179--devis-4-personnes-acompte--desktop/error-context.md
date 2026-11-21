# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> clair · client >> tables-fiche — Fiche d’un établissement validé : pastilles du jour et devis (4 personnes, acompte)
- Location: e2e/captures.spec.ts:193:9

# Error details

```
Error: contrôles bloquants de tables-fiche__ordinateur__clair.png

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 4

- Array []
+ Array [
+   "axe-core label-content-name-mismatch (serious, 14 nœud(s)) : Elements must have their visible text as part of their accessible name",
+   "axe-core scrollable-region-focusable (serious, 1 nœud(s)) : Scrollable region must have keyboard access",
+ ]
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - complementary [ref=e3]:
      - link "Event Village, accueil" [ref=e5] [cursor=pointer]:
        - /url: /
        - generic [ref=e6]: Event Village
      - navigation "Navigation principale" [ref=e9]:
        - generic [ref=e10]:
          - paragraph [ref=e11]: Menu principal
          - generic [ref=e12]:
            - link "Accueil" [ref=e13] [cursor=pointer]:
              - /url: /
            - link "Explorer" [ref=e18] [cursor=pointer]:
              - /url: /explore
            - link "Mes billets" [ref=e23] [cursor=pointer]:
              - /url: /tickets
            - link "Commandes" [ref=e27] [cursor=pointer]:
              - /url: /orders
            - link "Portefeuille" [ref=e32] [cursor=pointer]:
              - /url: /wallet
        - generic [ref=e37]:
          - paragraph [ref=e38]: Services et espaces
          - generic [ref=e39]:
            - link "Salles de fête" [ref=e40] [cursor=pointer]:
              - /url: /halls
            - link "Restaurants et tables" [ref=e46] [cursor=pointer]:
              - /url: /restaurants/rest-terrou-bi/tables
        - generic [ref=e51]:
          - paragraph [ref=e52]: Espaces métier
          - link "Devenir partenaire" [ref=e54] [cursor=pointer]:
            - /url: /partner/register
      - generic [ref=e60]:
        - link "Fatou Mbaye Client" [ref=e61] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=e62]: FM
          - generic [ref=e63]:
            - generic [ref=e64]: Fatou Mbaye
            - generic [ref=e65]: Client
        - generic [ref=e66]:
          - button "Se déconnecter" [ref=e67] [cursor=pointer]
          - button "Basculer le thème" [ref=e72] [cursor=pointer]
    - generic [ref=e76]:
      - banner [ref=e77]:
        - link "Rechercher un événement…" [ref=e79] [cursor=pointer]:
          - /url: /explore
        - button "Notifications, 13 non lues" [ref=e86] [cursor=pointer]:
          - generic [ref=e90]: "13"
      - main [ref=e91]:
        - generic [ref=e93]:
          - link "Tous les établissements" [ref=e94] [cursor=pointer]:
            - /url: /tables
          - generic [ref=e99]:
            - article [ref=e100]:
              - region "Photos de La Terrasse du Plateau" [ref=e101]:
                - img "Photo 1 sur 2 de La Terrasse du Plateau" [ref=e104]
                - button "Photo précédente" [ref=e107] [cursor=pointer]
                - button "Photo suivante" [ref=e111] [cursor=pointer]
                - generic:
                  - paragraph: Photo 1 sur 2
              - generic [ref=e115]:
                - generic [ref=e116]: Restaurant
                - heading "La Terrasse du Plateau" [level=1] [ref=e118]
                - paragraph [ref=e119]:
                  - generic [ref=e123]: 8, rue Carnot, Dakar-Plateau, Dakar
                - paragraph [ref=e124]: Proposé par Baobab Scène
              - list "L’essentiel" [ref=e125]:
                - listitem [ref=e126]:
                  - generic [ref=e131]:
                    - paragraph [ref=e132]: Acompte 5 000 F CFA par personne
                    - paragraph [ref=e133]: Payé en ligne pour garder la table, frais de service en plus
                - listitem [ref=e134]:
                  - generic [ref=e138]:
                    - paragraph [ref=e139]: Confirmation immédiate
                    - paragraph [ref=e140]: Votre table est confirmée tout de suite
                - listitem [ref=e141]:
                  - generic [ref=e148]:
                    - paragraph [ref=e149]: De 1 à 8 personnes
                    - paragraph [ref=e150]: Selon les tables de l’établissement
                - listitem [ref=e151]:
                  - generic [ref=e156]:
                    - paragraph [ref=e157]: Table pour 2 h
                    - paragraph [ref=e158]: Durée prévue pour votre repas ou votre soirée
              - region [ref=e159]:
                - heading "À propos" [level=2] [ref=e160]
                - paragraph [ref=e161]: "Cuisine sénégalaise et grillades de la mer au cœur du Plateau : thiéboudiène le midi, poissons braisés le soir. Salle climatisée et terrasse ombragée ; menus de groupe sur demande."
              - region [ref=e162]:
                - heading "Horaires" [level=2] [ref=e163]
                - list [ref=e164]:
                  - listitem [ref=e165]:
                    - generic [ref=e166]: Lundi
                    - generic [ref=e167]:
                      - generic [ref=e168]: 12 h à 15 h
                      - generic [ref=e169]: 19 h à 23 h 30
                  - listitem [ref=e170]:
                    - generic [ref=e171]: Mardi
                    - generic [ref=e172]:
                      - generic [ref=e173]: 12 h à 15 h
                      - generic [ref=e174]: 19 h à 23 h 30
                  - listitem [ref=e175]:
                    - generic [ref=e176]: Mercredi
                    - generic [ref=e177]:
                      - generic [ref=e178]: 12 h à 15 h
                      - generic [ref=e179]: 19 h à 23 h 30
                  - listitem [ref=e180]:
                    - generic [ref=e181]: Jeudi
                    - generic [ref=e182]:
                      - generic [ref=e183]: 12 h à 15 h
                      - generic [ref=e184]: 19 h à 23 h 30
                  - listitem [ref=e185]:
                    - generic [ref=e186]: Vendredi
                    - generic [ref=e187]:
                      - generic [ref=e188]: 12 h à 15 h
                      - generic [ref=e189]: 19 h à 23 h 30
                  - listitem [ref=e190]:
                    - generic [ref=e191]: Samedi · aujourd’hui
                    - generic [ref=e192]:
                      - generic [ref=e193]: 12 h à 15 h
                      - generic [ref=e194]: 19 h à 23 h 30
                  - listitem [ref=e195]:
                    - generic [ref=e196]: Dimanche
                    - generic [ref=e197]:
                      - generic [ref=e198]: 12 h à 15 h
                      - generic [ref=e199]: 19 h à 23 h 30
                - generic [ref=e200]:
                  - heading "Fermetures exceptionnelles à venir" [level=3] [ref=e201]
                  - list [ref=e206]:
                    - listitem [ref=e207]: Mardi 1 décembre, toute la journée
              - region [ref=e208]:
                - heading "Adresse" [level=2] [ref=e209]
                - paragraph [ref=e210]: 8, rue Carnot, Dakar-Plateau, Dakar
                - generic [ref=e211]:
                  - img "La Terrasse du Plateau, 8, rue Carnot, Dakar-Plateau, Dakar" [ref=e218]:
                    - generic [ref=e219]: La Terrasse du Plateau
                  - button "Afficher la carte" [ref=e223] [cursor=pointer]
                - link "Voir l’itinéraire" [ref=e228] [cursor=pointer]:
                  - /url: https://www.google.com/maps/dir/?api=1&destination=14.6681,-17.4335
              - region [ref=e238]:
                - heading "Bon à savoir" [level=2] [ref=e239]
                - list [ref=e240]:
                  - listitem [ref=e241]:
                    - generic [ref=e246]:
                      - heading "Annulation" [level=3] [ref=e247]
                      - paragraph [ref=e248]: "Annulation gratuite jusqu’à 2 h avant l’heure : l’acompte vous est rendu en entier. Après, il est gardé par l’établissement."
                  - listitem [ref=e249]:
                    - generic [ref=e254]:
                      - heading "Retard" [level=3] [ref=e255]
                      - paragraph [ref=e256]: Votre table est gardée 30 minutes après l’heure prévue. Au-delà, elle peut être donnée à d’autres clients.
                  - listitem [ref=e257]:
                    - generic [ref=e262]:
                      - heading "Paiement de l’acompte" [level=3] [ref=e263]
                      - paragraph [ref=e264]: "Après la réservation, vous avez 15 minutes pour payer par Wave ou Orange Money ; sinon la table est libérée. Des frais de service s’ajoutent : leur montant exact s’affiche avant de réserver."
            - complementary [ref=e265]:
              - generic [ref=e266]:
                - generic [ref=e267]:
                  - heading "Réserver une table" [level=2] [ref=e268]
                  - list [ref=e269]:
                    - listitem [ref=e270]: Acompte 5 000 F CFA par personne
                    - listitem [ref=e274]: Confirmation immédiate
                - region [ref=e277]:
                  - heading "Combien de personnes ?" [level=3] [ref=e279]:
                    - generic [aria-hidden] [ref=e280]: "1"
                    - text: Combien de personnes ?
                  - generic [ref=e281]:
                    - generic [ref=e282]: Personnes
                    - generic [ref=e283]:
                      - button "Une personne de moins" [ref=e284] [cursor=pointer]
                      - generic [ref=e287]:
                        - textbox "Personnes" [ref=e288]: "4"
                        - generic [aria-hidden] [ref=e289]: personnes
                      - button "Une personne de plus" [ref=e290] [cursor=pointer]
                    - paragraph [ref=e293]: Tables de 1 à 8 personnes. Plus de 50 ? Contactez l’établissement.
                - region [ref=e294]:
                  - heading "Quel jour ?" [level=3] [ref=e296]:
                    - generic [aria-hidden] [ref=e297]: "2"
                    - text: Quel jour ?
                  - group "Jour" [ref=e298]:
                    - generic [ref=e300]:
                      - button "Aujourd’hui, samedi 21 novembre" [ref=e301] [cursor=pointer]:
                        - generic [ref=e302]: Auj.
                        - generic [ref=e303]: "21"
                        - generic [ref=e304]: nov
                      - button "Demain, dimanche 22 novembre" [ref=e305] [cursor=pointer]:
                        - generic [ref=e306]: Dem.
                        - generic [ref=e307]: "22"
                        - generic [ref=e308]: nov
                      - button "lundi 23 novembre" [ref=e309] [cursor=pointer]:
                        - generic [ref=e310]: lun
                        - generic [ref=e311]: "23"
                        - generic [ref=e312]: nov
                      - button "mardi 24 novembre" [pressed] [ref=e313] [cursor=pointer]:
                        - generic [ref=e314]: mar
                        - generic [ref=e315]: "24"
                        - generic [ref=e316]: nov
                      - button "mercredi 25 novembre" [ref=e317] [cursor=pointer]:
                        - generic [ref=e318]: mer
                        - generic [ref=e319]: "25"
                        - generic [ref=e320]: nov
                      - button "jeudi 26 novembre" [ref=e321] [cursor=pointer]:
                        - generic [ref=e322]: jeu
                        - generic [ref=e323]: "26"
                        - generic [ref=e324]: nov
                      - button "vendredi 27 novembre" [ref=e325] [cursor=pointer]:
                        - generic [ref=e326]: ven
                        - generic [ref=e327]: "27"
                        - generic [ref=e328]: nov
                      - button "samedi 28 novembre" [ref=e329] [cursor=pointer]:
                        - generic [ref=e330]: sam
                        - generic [ref=e331]: "28"
                        - generic [ref=e332]: nov
                      - button "dimanche 29 novembre" [ref=e333] [cursor=pointer]:
                        - generic [ref=e334]: dim
                        - generic [ref=e335]: "29"
                        - generic [ref=e336]: nov
                      - button "lundi 30 novembre" [ref=e337] [cursor=pointer]:
                        - generic [ref=e338]: lun
                        - generic [ref=e339]: "30"
                        - generic [ref=e340]: nov
                      - button "mardi 1 décembre" [ref=e341] [cursor=pointer]:
                        - generic [ref=e342]: mar
                        - generic [ref=e343]: "1"
                        - generic [ref=e344]: déc
                      - button "mercredi 2 décembre" [ref=e345] [cursor=pointer]:
                        - generic [ref=e346]: mer
                        - generic [ref=e347]: "2"
                        - generic [ref=e348]: déc
                      - button "jeudi 3 décembre" [ref=e349] [cursor=pointer]:
                        - generic [ref=e350]: jeu
                        - generic [ref=e351]: "3"
                        - generic [ref=e352]: déc
                      - button "vendredi 4 décembre" [ref=e353] [cursor=pointer]:
                        - generic [ref=e354]: ven
                        - generic [ref=e355]: "4"
                        - generic [ref=e356]: déc
                    - generic [ref=e357]:
                      - generic [ref=e358]: Autre jour
                      - textbox "Autre jour" [ref=e360]
                      - paragraph [ref=e361]: Jusqu’à 90 jours à l’avance.
                - region [ref=e362]:
                  - generic [ref=e363]:
                    - heading "À quelle heure ?" [level=3] [ref=e364]:
                      - generic [aria-hidden] [ref=e365]: "3"
                      - text: À quelle heure ?
                    - paragraph [ref=e366]: Table pour 2 h
                  - group "Zone (facultatif)" [ref=e367]:
                    - button "Toutes les zones" [pressed] [ref=e368] [cursor=pointer]:
                      - generic [aria-hidden] [ref=e369]: ✓
                      - text: Toutes les zones
                    - button "Salle climatisée" [ref=e370] [cursor=pointer]
                    - button "Terrasse" [ref=e375] [cursor=pointer]
                  - status [ref=e380]
                  - generic [ref=e381]:
                    - generic [ref=e382]:
                      - heading "Midi" [level=4] [ref=e383]
                      - list [ref=e384]:
                        - listitem [ref=e385]:
                          - button "12 h" [ref=e386] [cursor=pointer]
                        - listitem [ref=e388]:
                          - button "12 h 30" [ref=e389] [cursor=pointer]
                        - listitem [ref=e391]:
                          - button "13 h" [ref=e392] [cursor=pointer]
                    - generic [ref=e394]:
                      - heading "Soir" [level=4] [ref=e395]
                      - list [ref=e396]:
                        - listitem [ref=e397]:
                          - button "19 h" [ref=e398] [cursor=pointer]
                        - listitem [ref=e400]:
                          - button "19 h 30" [ref=e401] [cursor=pointer]
                        - listitem [ref=e403]:
                          - button "20 h" [ref=e404] [cursor=pointer]
                        - listitem [ref=e406]:
                          - button "20 h 30" [ref=e407] [cursor=pointer]
                        - listitem [ref=e409]:
                          - button "21 h" [ref=e410] [cursor=pointer]
                        - listitem [ref=e412]:
                          - button "21 h 30" [ref=e413] [cursor=pointer]
                - region [ref=e415]:
                  - heading "Une demande particulière ?" [level=3] [ref=e417]:
                    - generic [aria-hidden] [ref=e418]: "4"
                    - text: Une demande particulière ?
                  - generic [ref=e419]:
                    - generic [ref=e420]:
                      - generic [ref=e421]: Demande particulière (facultatif)
                      - generic [ref=e422]: 0 / 500
                    - textbox "Demande particulière (facultatif)" [ref=e423]:
                      - /placeholder: "Par exemple : anniversaire, chaise haute, table au calme"
                    - paragraph [ref=e424]: Transmise à l’établissement avec votre réservation.
                - generic [ref=e425]:
                  - paragraph [ref=e426]:
                    - generic [ref=e431]: Mardi 24 novembre · 4 personnes · choisissez une heure
                  - generic [ref=e432]:
                    - status [ref=e433]: "Total à payer : 21 000 F CFA."
                    - generic [ref=e434]:
                      - generic [ref=e435]:
                        - term [ref=e436]: Acompte (4 personnes)
                        - definition [ref=e437]: 20 000 F CFA
                      - generic [ref=e438]:
                        - term [ref=e439]: Frais de service
                        - definition [ref=e440]: 1 000 F CFA
                      - generic [ref=e441]:
                        - term [ref=e442]: Total à payer
                        - definition [ref=e443]: 21 000 F CFA
                - generic [ref=e444]:
                  - button "Réserver et payer l’acompte" [disabled] [ref=e445]
                  - paragraph [ref=e447]: Choisissez une heure pour réserver.
                  - paragraph [ref=e448]: Après la réservation, la table vous est gardée 15 minutes, le temps de payer l’acompte par Wave ou Orange Money.
  - alert [ref=e449]
```

# Test source

```ts
  225 |                 await context.addInitScript(stretchTimers, screen.slowTimers);
  226 |             }
  227 |             if (screen.injectError) {
  228 |                 record.notes.push(`état d'erreur simulé : réponses ${screen.injectError} remplacées par un 500 (erreurs de console attendues, ignorées)`);
  229 |                 await page.route(screen.injectError, (route) => route.fulfill({
  230 |                     status: 500,
  231 |                     contentType: 'application/json; charset=utf-8',
  232 |                     body: JSON.stringify({ error: screen.injectErrorMessage ?? 'Erreur simulée par les tests de bout en bout.', code: 'E2E_SIMULATED_ERROR' }),
  233 |                 }));
  234 |             }
  235 |             const stubs: StubResponse[] = [...(screen.stubResponse ? [screen.stubResponse] : []), ...(screen.stubResponses ?? [])];
  236 |             for (const stub of stubs) {
  237 |                 record.notes.push(`réponse simulée : ${stub.method ?? 'toute méthode'} ${stub.url} remplacée par HTTP ${stub.status} ${JSON.stringify(stub.body).slice(0, 160)}`);
  238 |                 await page.route(stub.url, async (route) => {
  239 |                     if (!methodMatches(stub.method, route.request().method())) {
  240 |                         await route.fallback();
  241 |                         return;
  242 |                     }
  243 |                     await route.fulfill({ status: stub.status, contentType: 'application/json; charset=utf-8', body: JSON.stringify(stub.body) });
  244 |                 });
  245 |             }
  246 |             for (const hold of screen.holdRequests ?? []) {
  247 |                 record.notes.push(`requête retenue (jamais servie) : ${hold.method ?? 'toute méthode'} ${hold.url}`);
  248 |                 await page.route(hold.url, async (route) => {
  249 |                     if (!methodMatches(hold.method, route.request().method())) {
  250 |                         await route.fallback();
  251 |                         return;
  252 |                     }
  253 |                     // Retenue jusqu'à la fermeture de la page : ni réponse ni erreur (réseau lent, téléchargement en cours)
  254 |                     await new Promise<void>((resolve) => { page.once('close', () => resolve()); });
  255 |                 });
  256 |             }
  257 |             if (screen.fakePush) {
  258 |                 const subscription = screen.fakePush === 'granted' ? await fakePushSubscriber() : null;
  259 |                 record.notes.push(screen.fakePush === 'granted'
  260 |                     ? `push simulé (granted) : permission accordée au clic sans fenêtre, inscription du service worker et pushManager.subscribe remplacés ; abonnement du faux service push ${subscription?.endpoint ?? '?'} ; configuration VAPID, route d'inscription et base réelles`
  261 |                     : screen.fakePush === 'denied'
  262 |                         ? 'push simulé (denied) : Notification.permission = « denied », appels à requestPermission comptés'
  263 |                         : 'push simulé (unsupported) : window.PushManager et window.Notification supprimés');
  264 |                 await context.addInitScript(installFakePush, { mode: screen.fakePush, subscription });
  265 |             }
  266 |             if (screen.fakeCamera) {
  267 |                 const mode = screen.fakeCamera === 'barcode-detector' ? 'barcode-detector' : fakeScanMode();
  268 |                 record.notes.push(`caméra simulée (${mode})${mode === 'barcode-detector' ? ' : faux BarcodeDetector, payload posé par le test' : ''}`);
  269 |                 await context.addInitScript(installFakeCamera, { mode });
  270 |             }
  271 |             if (screen.offline === 'before-load') {
  272 |                 record.notes.push('connexion coupée avant le chargement (collecte d’erreurs arrêtée)');
  273 |                 guard.freeze();
  274 |                 await context.setOffline(true);
  275 |             }
  276 |             const response = await page.goto(record.url, { waitUntil: 'load' });
  277 |             record.status = response ? response.status() : null;
  278 |             if (screen.expectStatus !== undefined) {
  279 |                 expect(record.status, `statut HTTP du document ${record.url}`).toBe(screen.expectStatus);
  280 |             }
  281 |             if (screen.offline === 'after-load') {
  282 |                 record.notes.push('connexion coupée après le chargement (collecte d’erreurs arrêtée)');
  283 |                 guard.freeze();
  284 |                 await context.setOffline(true);
  285 |             }
  286 |             const sc = { page, context, guard, ids: demo };
  287 |             if (screen.ready) await screen.ready(sc);
  288 |             await settle(page, guard, record.notes);
  289 |             if (screen.actions) {
  290 |                 await screen.actions(sc);
  291 |                 await settle(page, guard, record.notes);
  292 |             }
  293 |             if (screen.id === 'cloche-ouverte' && vue === 'mobile') {
  294 |                 const problem = await markAllOnOneLine(page);
  295 |                 if (problem) record.blocking.push(problem);
  296 |             }
  297 |             const checks = await runPageChecks(page, { mobile: vue === 'mobile', axe: true, references: screen.references });
  298 |             record.blocking.push(...checks.blocking);
  299 |             record.warnings.push(...checks.warnings);
  300 |             record.axeDetails = checks.axeDetails;
  301 |             record.smallTextDetails = checks.smallTextDetails;
  302 |             record.metrics = checks.metrics;
  303 |             const shot = await capture(page, screen, file);
  304 |             record.captured = true;
  305 |             await testInfo.attach(file, { path: shot, contentType: 'image/png' });
  306 |         } catch (err) {
  307 |             record.error = err instanceof Error ? err.message.split('\n')[0] : String(err);
  308 |             if (!record.captured && !page.isClosed()) {
  309 |                 await capture(page, screen, file).then(
  310 |                     async (shot) => {
  311 |                         record.captured = true;
  312 |                         record.notes.push('capture prise après l’erreur (état de la page au moment de l’échec)');
  313 |                         await testInfo.attach(file, { path: shot, contentType: 'image/png' });
  314 |                     },
  315 |                     (shotErr: Error) => { record.notes.push(`capture impossible après l’erreur : ${shotErr.message.split('\n')[0]}`); },
  316 |                 );
  317 |             }
  318 |             throw err;
  319 |         } finally {
  320 |             record.blocking.push(...guard.blockingIssues());
  321 |             record.warnings.push(...guard.nonBlockingIssues());
  322 |             record.durationMs = Date.now() - started;
  323 |             writeCaptureRecord(record);
  324 |         }
> 325 |         expect(record.blocking, `contrôles bloquants de ${file}`).toEqual([]);
      |                                                                   ^ Error: contrôles bloquants de tables-fiche__ordinateur__clair.png
  326 |     });
  327 | }
  328 | 
  329 | for (const theme of THEMES) {
  330 |     for (const role of ROLE_ORDER) {
  331 |         const screens = SCREENS.filter((s) => s.role === role);
  332 |         if (screens.length === 0) continue;
  333 |         test.describe(`${theme.key} · ${role}`, () => {
  334 |             test.use({ colorScheme: theme.colorScheme, evTheme: theme.key, evRole: role });
  335 | 
  336 |             for (const screen of screens) {
  337 |                 if (screen.serviceWorkers === 'allow') {
  338 |                     // Lot 7 (D7) : service worker autorisé seulement dans le contexte de cet écran
  339 |                     test.describe(`${screen.id} (service worker autorisé)`, () => {
  340 |                         test.use({ serviceWorkers: 'allow' });
  341 |                         defineCapture(screen, theme, role);
  342 |                     });
  343 |                 } else {
  344 |                     defineCapture(screen, theme, role);
  345 |                 }
  346 |             }
  347 |         });
  348 |     }
  349 | }
  350 | 
```