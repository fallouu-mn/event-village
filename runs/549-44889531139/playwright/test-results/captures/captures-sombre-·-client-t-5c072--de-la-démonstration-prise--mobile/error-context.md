# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · client >> tables-fiche-plan — Fiche d’un établissement : plan de salle au créneau choisi (table de la démonstration prise)
- Location: e2e/captures.spec.ts:193:9

# Error details

```
Error: contrôles bloquants de tables-fiche-plan__mobile__sombre.png

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "axe-core label-content-name-mismatch (serious, 8 nœud(s)) : Elements must have their visible text as part of their accessible name",
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
          - button "Notifications, 13 non lues" [ref=e15] [cursor=pointer]:
            - generic [ref=e19]: "13"
          - button "Basculer le thème" [ref=e21] [cursor=pointer]
          - link "Mon profil (Fatou Mbaye)" [ref=e25] [cursor=pointer]:
            - /url: /profile
            - generic [aria-hidden] [ref=e26]: FM
      - main [ref=e28]:
        - generic [ref=e30]:
          - link "Tous les établissements" [ref=e31] [cursor=pointer]:
            - /url: /tables
          - generic [ref=e36]:
            - article [ref=e37]:
              - region "Photos de La Terrasse du Plateau" [ref=e38]:
                - group "Faire défiler les photos avec les flèches gauche et droite" [ref=e39]:
                  - img "Photo 1 sur 2 de La Terrasse du Plateau" [ref=e41]
                - button "Photo précédente" [ref=e44] [cursor=pointer]
                - button "Photo suivante" [ref=e48] [cursor=pointer]
                - generic:
                  - paragraph: Photo 1 sur 2
              - generic [ref=e52]:
                - generic [ref=e53]: Restaurant
                - heading "La Terrasse du Plateau" [level=1] [ref=e55]
                - paragraph [ref=e56]:
                  - generic [ref=e60]: 8, rue Carnot, Dakar-Plateau, Dakar
                - paragraph [ref=e61]: Proposé par Baobab Scène
              - list "L’essentiel" [ref=e62]:
                - listitem [ref=e63]:
                  - generic [ref=e68]:
                    - paragraph [ref=e69]: Acompte 5 000 F CFA par personne
                    - paragraph [ref=e70]: Payé en ligne pour garder la table, frais de service en plus
                - listitem [ref=e71]:
                  - generic [ref=e75]:
                    - paragraph [ref=e76]: Confirmation immédiate
                    - paragraph [ref=e77]: Votre table est confirmée tout de suite
                - listitem [ref=e78]:
                  - generic [ref=e85]:
                    - paragraph [ref=e86]: De 1 à 8 personnes
                    - paragraph [ref=e87]: Selon les tables de l’établissement
                - listitem [ref=e88]:
                  - generic [ref=e93]:
                    - paragraph [ref=e94]: Table pour 2 h
                    - paragraph [ref=e95]: Durée prévue pour votre repas ou votre soirée
              - link "Choisir mon heure et réserver" [ref=e96] [cursor=pointer]:
                - /url: "#reserver"
              - region [ref=e98]:
                - heading "À propos" [level=2] [ref=e99]
                - paragraph [ref=e100]: "Cuisine sénégalaise et grillades de la mer au cœur du Plateau : thiéboudiène le midi, poissons braisés le soir. Salle climatisée et terrasse ombragée ; menus de groupe sur demande."
              - region [ref=e101]:
                - heading "Horaires" [level=2] [ref=e102]
                - list [ref=e103]:
                  - listitem [ref=e104]:
                    - generic [ref=e105]: Lundi
                    - generic [ref=e106]:
                      - generic [ref=e107]: 12 h à 15 h
                      - generic [ref=e108]: 19 h à 23 h 30
                  - listitem [ref=e109]:
                    - generic [ref=e110]: Mardi
                    - generic [ref=e111]:
                      - generic [ref=e112]: 12 h à 15 h
                      - generic [ref=e113]: 19 h à 23 h 30
                  - listitem [ref=e114]:
                    - generic [ref=e115]: Mercredi
                    - generic [ref=e116]:
                      - generic [ref=e117]: 12 h à 15 h
                      - generic [ref=e118]: 19 h à 23 h 30
                  - listitem [ref=e119]:
                    - generic [ref=e120]: Jeudi
                    - generic [ref=e121]:
                      - generic [ref=e122]: 12 h à 15 h
                      - generic [ref=e123]: 19 h à 23 h 30
                  - listitem [ref=e124]:
                    - generic [ref=e125]: Vendredi
                    - generic [ref=e126]:
                      - generic [ref=e127]: 12 h à 15 h
                      - generic [ref=e128]: 19 h à 23 h 30
                  - listitem [ref=e129]:
                    - generic [ref=e130]: Samedi · aujourd’hui
                    - generic [ref=e131]:
                      - generic [ref=e132]: 12 h à 15 h
                      - generic [ref=e133]: 19 h à 23 h 30
                  - listitem [ref=e134]:
                    - generic [ref=e135]: Dimanche
                    - generic [ref=e136]:
                      - generic [ref=e137]: 12 h à 15 h
                      - generic [ref=e138]: 19 h à 23 h 30
                - generic [ref=e139]:
                  - heading "Fermetures exceptionnelles à venir" [level=3] [ref=e140]
                  - list [ref=e145]:
                    - listitem [ref=e146]: Mardi 1 décembre, toute la journée
              - region [ref=e147]:
                - heading "Adresse" [level=2] [ref=e148]
                - paragraph [ref=e149]: 8, rue Carnot, Dakar-Plateau, Dakar
                - generic [ref=e150]:
                  - img "La Terrasse du Plateau, 8, rue Carnot, Dakar-Plateau, Dakar" [ref=e157]:
                    - generic [ref=e158]: La Terrasse du Plateau
                  - button "Afficher la carte" [ref=e162] [cursor=pointer]
                - link "Voir l’itinéraire" [ref=e167] [cursor=pointer]:
                  - /url: https://www.google.com/maps/dir/?api=1&destination=14.6681,-17.4335
              - region [ref=e177]:
                - heading "Bon à savoir" [level=2] [ref=e178]
                - list [ref=e179]:
                  - listitem [ref=e180]:
                    - generic [ref=e185]:
                      - heading "Annulation" [level=3] [ref=e186]
                      - paragraph [ref=e187]: "Annulation gratuite jusqu’à 2 h avant l’heure : l’acompte vous est rendu en entier. Après, il est gardé par l’établissement."
                  - listitem [ref=e188]:
                    - generic [ref=e193]:
                      - heading "Retard" [level=3] [ref=e194]
                      - paragraph [ref=e195]: Votre table est gardée 30 minutes après l’heure prévue. Au-delà, elle peut être donnée à d’autres clients.
                  - listitem [ref=e196]:
                    - generic [ref=e201]:
                      - heading "Paiement de l’acompte" [level=3] [ref=e202]
                      - paragraph [ref=e203]: "Après la réservation, vous avez 15 minutes pour payer par Wave ou Orange Money ; sinon la table est libérée. Des frais de service s’ajoutent : leur montant exact s’affiche avant de réserver."
            - complementary [ref=e204]:
              - generic [ref=e205]:
                - generic [ref=e206]:
                  - heading "Réserver une table" [level=2] [ref=e207]
                  - list [ref=e208]:
                    - listitem [ref=e209]: Acompte 5 000 F CFA par personne
                    - listitem [ref=e213]: Confirmation immédiate
                - region [ref=e216]:
                  - heading "Combien de personnes ?" [level=3] [ref=e218]:
                    - generic [aria-hidden] [ref=e219]: "1"
                    - text: Combien de personnes ?
                  - generic [ref=e220]:
                    - generic [ref=e221]: Personnes
                    - generic [ref=e222]:
                      - button "Une personne de moins" [ref=e223] [cursor=pointer]
                      - generic [ref=e226]:
                        - textbox "Personnes" [ref=e227]: "4"
                        - generic [aria-hidden] [ref=e228]: personnes
                      - button "Une personne de plus" [ref=e229] [cursor=pointer]
                    - paragraph [ref=e232]: Tables de 1 à 8 personnes. Plus de 50 ? Contactez l’établissement.
                - region [ref=e233]:
                  - heading "Quel jour ?" [level=3] [ref=e235]:
                    - generic [aria-hidden] [ref=e236]: "2"
                    - text: Quel jour ?
                  - group "Jour" [ref=e237]:
                    - generic [ref=e239]:
                      - button "Auj. 21 nov , aujourd’hui, samedi 21 novembre" [ref=e240] [cursor=pointer]:
                        - generic [ref=e241]: Auj.
                        - generic [ref=e242]: "21"
                        - generic [ref=e243]: nov
                        - generic [ref=e244]: ", aujourd’hui, samedi 21 novembre"
                      - button "Dem. 22 nov , demain, dimanche 22 novembre" [ref=e245] [cursor=pointer]:
                        - generic [ref=e246]: Dem.
                        - generic [ref=e247]: "22"
                        - generic [ref=e248]: nov
                        - generic [ref=e249]: ", demain, dimanche 22 novembre"
                      - button "lun 23 nov , lundi 23 novembre" [ref=e250] [cursor=pointer]:
                        - generic [ref=e251]: lun
                        - generic [ref=e252]: "23"
                        - generic [ref=e253]: nov
                        - generic [ref=e254]: ", lundi 23 novembre"
                      - button "mar 24 nov , mardi 24 novembre" [pressed] [ref=e255] [cursor=pointer]:
                        - generic [ref=e256]: mar
                        - generic [ref=e257]: "24"
                        - generic [ref=e258]: nov
                        - generic [ref=e259]: ", mardi 24 novembre"
                      - button "mer 25 nov , mercredi 25 novembre" [ref=e260] [cursor=pointer]:
                        - generic [ref=e261]: mer
                        - generic [ref=e262]: "25"
                        - generic [ref=e263]: nov
                        - generic [ref=e264]: ", mercredi 25 novembre"
                      - button "jeu 26 nov , jeudi 26 novembre" [ref=e265] [cursor=pointer]:
                        - generic [ref=e266]: jeu
                        - generic [ref=e267]: "26"
                        - generic [ref=e268]: nov
                        - generic [ref=e269]: ", jeudi 26 novembre"
                      - button "ven 27 nov , vendredi 27 novembre" [ref=e270] [cursor=pointer]:
                        - generic [ref=e271]: ven
                        - generic [ref=e272]: "27"
                        - generic [ref=e273]: nov
                        - generic [ref=e274]: ", vendredi 27 novembre"
                      - button "sam 28 nov , samedi 28 novembre" [ref=e275] [cursor=pointer]:
                        - generic [ref=e276]: sam
                        - generic [ref=e277]: "28"
                        - generic [ref=e278]: nov
                        - generic [ref=e279]: ", samedi 28 novembre"
                      - button "dim 29 nov , dimanche 29 novembre" [ref=e280] [cursor=pointer]:
                        - generic [ref=e281]: dim
                        - generic [ref=e282]: "29"
                        - generic [ref=e283]: nov
                        - generic [ref=e284]: ", dimanche 29 novembre"
                      - button "lun 30 nov , lundi 30 novembre" [ref=e285] [cursor=pointer]:
                        - generic [ref=e286]: lun
                        - generic [ref=e287]: "30"
                        - generic [ref=e288]: nov
                        - generic [ref=e289]: ", lundi 30 novembre"
                      - button "mar 1 déc , mardi 1 décembre" [ref=e290] [cursor=pointer]:
                        - generic [ref=e291]: mar
                        - generic [ref=e292]: "1"
                        - generic [ref=e293]: déc
                        - generic [ref=e294]: ", mardi 1 décembre"
                      - button "mer 2 déc , mercredi 2 décembre" [ref=e295] [cursor=pointer]:
                        - generic [ref=e296]: mer
                        - generic [ref=e297]: "2"
                        - generic [ref=e298]: déc
                        - generic [ref=e299]: ", mercredi 2 décembre"
                      - button "jeu 3 déc , jeudi 3 décembre" [ref=e300] [cursor=pointer]:
                        - generic [ref=e301]: jeu
                        - generic [ref=e302]: "3"
                        - generic [ref=e303]: déc
                        - generic [ref=e304]: ", jeudi 3 décembre"
                      - button "ven 4 déc , vendredi 4 décembre" [ref=e305] [cursor=pointer]:
                        - generic [ref=e306]: ven
                        - generic [ref=e307]: "4"
                        - generic [ref=e308]: déc
                        - generic [ref=e309]: ", vendredi 4 décembre"
                    - generic [ref=e310]:
                      - generic [ref=e311]: Autre jour
                      - textbox "Autre jour" [ref=e313]
                      - paragraph [ref=e314]: Jusqu’à 90 jours à l’avance.
                - region [ref=e315]:
                  - generic [ref=e316]:
                    - heading "À quelle heure ?" [level=3] [ref=e317]:
                      - generic [aria-hidden] [ref=e318]: "3"
                      - text: À quelle heure ?
                    - paragraph [ref=e319]: Table pour 2 h
                  - group "Zone (facultatif)" [ref=e320]:
                    - button "Toutes les zones" [pressed] [ref=e321] [cursor=pointer]:
                      - generic [aria-hidden] [ref=e322]: ✓
                      - text: Toutes les zones
                    - button "Salle climatisée" [ref=e323] [cursor=pointer]
                    - button "Terrasse" [ref=e328] [cursor=pointer]
                  - status [ref=e333]
                  - generic [ref=e334]:
                    - generic [ref=e335]:
                      - heading "Midi" [level=4] [ref=e336]
                      - list [ref=e337]:
                        - listitem [ref=e338]:
                          - button "12 h" [ref=e339] [cursor=pointer]
                        - listitem [ref=e341]:
                          - button "12 h 30" [ref=e342] [cursor=pointer]
                        - listitem [ref=e344]:
                          - button "13 h" [ref=e345] [cursor=pointer]
                    - generic [ref=e347]:
                      - heading "Soir" [level=4] [ref=e348]
                      - list [ref=e349]:
                        - listitem [ref=e350]:
                          - button "19 h" [ref=e351] [cursor=pointer]
                        - listitem [ref=e353]:
                          - button "19 h 30" [ref=e354] [cursor=pointer]
                        - listitem [ref=e356]:
                          - button "20 h" [pressed] [ref=e357] [cursor=pointer]
                        - listitem [ref=e361]:
                          - button "20 h 30" [ref=e362] [cursor=pointer]
                        - listitem [ref=e364]:
                          - button "21 h" [ref=e365] [cursor=pointer]
                        - listitem [ref=e367]:
                          - button "21 h 30" [ref=e368] [cursor=pointer]
                - region [ref=e370]:
                  - heading "Votre table (facultatif)" [level=3] [ref=e372]:
                    - generic [aria-hidden] [ref=e373]: "4"
                    - text: Votre table (facultatif)
                  - generic [ref=e374]:
                    - paragraph [ref=e375]:
                      - generic [ref=e381]: Touchez une table libre pour la choisir. Sans choix, l’établissement vous en attribue une qui convient.
                    - generic [ref=e382]:
                      - group "Plan de salle de La Terrasse du Plateau à 20 h" [ref=e383]:
                        - generic [ref=e384]:
                          - generic:
                            - generic "Salle climatisée"
                          - generic:
                            - generic "Terrasse"
                          - button "Table 1, 2 places, ne convient pas au nombre de personnes, Pour 2 personnes" [disabled] [ref=e385]:
                            - generic [aria-hidden] [ref=e387]:
                              - generic [ref=e388]: "1"
                              - generic [ref=e389]: "2"
                          - button "Table 2, 2 places, ne convient pas au nombre de personnes, Pour 2 personnes" [disabled] [ref=e395]:
                            - generic [aria-hidden] [ref=e397]:
                              - generic [ref=e398]: "2"
                              - generic [ref=e399]: "2"
                          - button "Table 3, 4 places, à partir de 2, déjà prise à cette heure, Déjà réservée à cette heure" [disabled] [ref=e405]:
                            - generic [aria-hidden] [ref=e407]:
                              - generic [ref=e408]: "3"
                              - generic [ref=e409]: "4"
                          - button "Table 4, 4 places, à partir de 2, libre, 4 places" [ref=e419] [cursor=pointer]:
                            - generic [aria-hidden] [ref=e421]:
                              - generic [ref=e422]: "4"
                              - generic [ref=e423]: "4"
                          - button "Table 5, 6 places, à partir de 3, libre, 6 places" [ref=e429] [cursor=pointer]:
                            - generic [aria-hidden] [ref=e431]:
                              - generic [ref=e432]: "5"
                              - generic [ref=e433]: "6"
                          - button "Table 6, 4 places, à partir de 2, libre, 4 places" [ref=e439] [cursor=pointer]:
                            - generic [aria-hidden] [ref=e441]:
                              - generic [ref=e442]: "6"
                              - generic [ref=e443]: "4"
                          - button "Table 7, 6 places, à partir de 3, libre, 6 places" [ref=e449] [cursor=pointer]:
                            - generic [aria-hidden] [ref=e451]:
                              - generic [ref=e452]: "7"
                              - generic [ref=e453]: "6"
                          - button "Table 8, 8 places, à partir de 4, libre, 8 places" [ref=e459] [cursor=pointer]:
                            - generic [aria-hidden] [ref=e461]:
                              - generic [ref=e462]: "8"
                              - generic [ref=e463]: "8"
                      - paragraph [ref=e469]: "Zones du plan : Salle climatisée, Terrasse"
                      - list "Légende du plan" [ref=e470]:
                        - listitem [ref=e471]:
                          - generic [ref=e473]: Libre
                        - listitem [ref=e474]:
                          - generic [ref=e476]: Votre choix
                        - listitem [ref=e477]:
                          - generic [ref=e479]: Déjà prise
                        - listitem [ref=e480]:
                          - generic [ref=e482]: Ne convient pas au groupe
                      - paragraph [ref=e483]: "Flèches : déplacer de 1 %. Majuscule et flèches : déplacer de 5 %. Touche R : tourner la table de 15 degrés."
                      - paragraph [ref=e484]
                    - paragraph [ref=e485]: Aucune table choisie
                - region [ref=e486]:
                  - heading "Une demande particulière ?" [level=3] [ref=e488]:
                    - generic [aria-hidden] [ref=e489]: "5"
                    - text: Une demande particulière ?
                  - generic [ref=e490]:
                    - generic [ref=e491]:
                      - generic [ref=e492]: Demande particulière (facultatif)
                      - generic [ref=e493]: 0 / 500
                    - textbox "Demande particulière (facultatif)" [ref=e494]:
                      - /placeholder: "Par exemple : anniversaire, chaise haute, table au calme"
                    - paragraph [ref=e495]: Transmise à l’établissement avec votre réservation.
                - generic [ref=e496]:
                  - paragraph [ref=e497]:
                    - generic [ref=e502]: Mardi 24 novembre à 20 h · 4 personnes
                  - generic [ref=e503]:
                    - status [ref=e504]: "Total à payer : 21 000 F CFA."
                    - generic [ref=e505]:
                      - generic [ref=e506]:
                        - term [ref=e507]: Acompte (4 personnes)
                        - definition [ref=e508]: 20 000 F CFA
                      - generic [ref=e509]:
                        - term [ref=e510]: Frais de service
                        - definition [ref=e511]: 1 000 F CFA
                      - generic [ref=e512]:
                        - term [ref=e513]: Total à payer
                        - definition [ref=e514]: 21 000 F CFA
                - generic [ref=e515]:
                  - button "Réserver et payer l’acompte" [ref=e516] [cursor=pointer]
                  - paragraph [ref=e518]: Après la réservation, la table vous est gardée 15 minutes, le temps de payer l’acompte par Wave ou Orange Money.
    - navigation "Navigation rapide" [ref=e519]:
      - generic [ref=e520]:
        - link "Accueil" [ref=e521] [cursor=pointer]:
          - /url: /
        - link "Explorer" [ref=e526] [cursor=pointer]:
          - /url: /explore
        - link "Billets" [ref=e531] [cursor=pointer]:
          - /url: /tickets
        - link "Achats" [ref=e535] [cursor=pointer]:
          - /url: /orders
        - link "Portefeuille" [ref=e540] [cursor=pointer]:
          - /url: /wallet
  - alert [ref=e545]
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
      |                                                                   ^ Error: contrôles bloquants de tables-fiche-plan__mobile__sombre.png
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