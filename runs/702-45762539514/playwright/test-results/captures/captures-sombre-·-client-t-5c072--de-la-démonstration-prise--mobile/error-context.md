# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · client >> tables-fiche-plan — Fiche d’un établissement : plan de salle au créneau choisi (table de la démonstration prise)
- Location: e2e/captures.spec.ts:202:9

# Error details

```
Error: contrôles bloquants de tables-fiche-plan__mobile__sombre.png

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "axe-core label-content-name-mismatch (serious, 1 nœud(s)) : Elements must have their visible text as part of their accessible name",
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
          - button "Basculer le thème" [pressed] [ref=e21] [cursor=pointer]
          - link "Mon profil (Fatou Mbaye)" [ref=e29] [cursor=pointer]:
            - /url: /profile
            - generic [aria-hidden] [ref=e30]: FM
      - main [ref=e32]:
        - generic [ref=e34]:
          - link "Tous les établissements" [ref=e35] [cursor=pointer]:
            - /url: /tables
          - generic [ref=e40]:
            - article [ref=e41]:
              - region "Photos de La Terrasse du Plateau" [ref=e42]:
                - group "Faire défiler les photos avec les flèches gauche et droite" [ref=e43]:
                  - img "Photo 1 sur 2 de La Terrasse du Plateau" [ref=e45]
                - button "Photo précédente" [ref=e48] [cursor=pointer]
                - button "Photo suivante" [ref=e52] [cursor=pointer]
                - generic:
                  - paragraph: Photo 1 sur 2
              - generic [ref=e56]:
                - generic [ref=e57]: Restaurant
                - heading "La Terrasse du Plateau" [level=1] [ref=e59]
                - paragraph [ref=e60]:
                  - generic [ref=e64]: 8, rue Carnot, Dakar-Plateau, Dakar
                - paragraph [ref=e65]: Proposé par Baobab Scène
              - list "L’essentiel" [ref=e66]:
                - listitem [ref=e67]:
                  - generic [ref=e72]:
                    - paragraph [ref=e73]: Acompte 5 000 F CFA par personne
                    - paragraph [ref=e74]: Payé en ligne pour garder la table, frais de service en plus
                - listitem [ref=e75]:
                  - generic [ref=e79]:
                    - paragraph [ref=e80]: Confirmation immédiate
                    - paragraph [ref=e81]: Votre table est confirmée tout de suite
                - listitem [ref=e82]:
                  - generic [ref=e89]:
                    - paragraph [ref=e90]: De 1 à 8 personnes
                    - paragraph [ref=e91]: Selon les tables de l’établissement
                - listitem [ref=e92]:
                  - generic [ref=e97]:
                    - paragraph [ref=e98]: Table pour 2 h
                    - paragraph [ref=e99]: Durée prévue pour votre repas ou votre soirée
              - link "Choisir mon heure et réserver" [ref=e100] [cursor=pointer]:
                - /url: "#reserver"
              - region [ref=e102]:
                - heading "À propos" [level=2] [ref=e103]
                - paragraph [ref=e104]: "Cuisine sénégalaise et grillades de la mer au cœur du Plateau : thiéboudiène le midi, poissons braisés le soir. Salle climatisée et terrasse ombragée ; menus de groupe sur demande."
              - region [ref=e105]:
                - heading "Horaires" [level=2] [ref=e106]
                - list [ref=e107]:
                  - listitem [ref=e108]:
                    - generic [ref=e109]: Lundi
                    - generic [ref=e110]:
                      - generic [ref=e111]: 12 h à 15 h
                      - generic [ref=e112]: 19 h à 23 h 30
                  - listitem [ref=e113]:
                    - generic [ref=e114]: Mardi
                    - generic [ref=e115]:
                      - generic [ref=e116]: 12 h à 15 h
                      - generic [ref=e117]: 19 h à 23 h 30
                  - listitem [ref=e118]:
                    - generic [ref=e119]: Mercredi
                    - generic [ref=e120]:
                      - generic [ref=e121]: 12 h à 15 h
                      - generic [ref=e122]: 19 h à 23 h 30
                  - listitem [ref=e123]:
                    - generic [ref=e124]: Jeudi · aujourd’hui
                    - generic [ref=e125]:
                      - generic [ref=e126]: 12 h à 15 h
                      - generic [ref=e127]: 19 h à 23 h 30
                  - listitem [ref=e128]:
                    - generic [ref=e129]: Vendredi
                    - generic [ref=e130]:
                      - generic [ref=e131]: 12 h à 15 h
                      - generic [ref=e132]: 19 h à 23 h 30
                  - listitem [ref=e133]:
                    - generic [ref=e134]: Samedi
                    - generic [ref=e135]:
                      - generic [ref=e136]: 12 h à 15 h
                      - generic [ref=e137]: 19 h à 23 h 30
                  - listitem [ref=e138]:
                    - generic [ref=e139]: Dimanche
                    - generic [ref=e140]:
                      - generic [ref=e141]: 12 h à 15 h
                      - generic [ref=e142]: 19 h à 23 h 30
                - generic [ref=e143]:
                  - heading "Fermetures exceptionnelles à venir" [level=3] [ref=e144]
                  - list [ref=e149]:
                    - listitem [ref=e150]: Dimanche 6 décembre, toute la journée
              - region [ref=e151]:
                - heading "Adresse" [level=2] [ref=e152]
                - paragraph [ref=e153]: 8, rue Carnot, Dakar-Plateau, Dakar
                - generic [ref=e154]:
                  - img "La Terrasse du Plateau, 8, rue Carnot, Dakar-Plateau, Dakar" [ref=e161]:
                    - generic [ref=e162]: La Terrasse du Plateau
                  - button "Afficher la carte" [ref=e166] [cursor=pointer]
                - link "Voir l’itinéraire" [ref=e171] [cursor=pointer]:
                  - /url: https://www.google.com/maps/dir/?api=1&destination=14.6681,-17.4335
              - region [ref=e181]:
                - heading "Bon à savoir" [level=2] [ref=e182]
                - list [ref=e183]:
                  - listitem [ref=e184]:
                    - generic [ref=e189]:
                      - heading "Annulation" [level=3] [ref=e190]
                      - paragraph [ref=e191]: "Annulation gratuite jusqu’à 2 h avant l’heure : l’acompte vous est rendu en entier. Après, il est gardé par l’établissement."
                  - listitem [ref=e192]:
                    - generic [ref=e197]:
                      - heading "Retard" [level=3] [ref=e198]
                      - paragraph [ref=e199]: Votre table est gardée 30 minutes après l’heure prévue. Au-delà, elle peut être donnée à d’autres clients.
                  - listitem [ref=e200]:
                    - generic [ref=e205]:
                      - heading "Paiement de l’acompte" [level=3] [ref=e206]
                      - paragraph [ref=e207]: "Après la réservation, vous avez 15 minutes pour payer par Wave ou Orange Money ; sinon la table est libérée. Des frais de service s’ajoutent : leur montant exact s’affiche avant de réserver."
            - complementary [ref=e208]:
              - generic [ref=e209]:
                - generic [ref=e210]:
                  - heading "Réserver une table" [level=2] [ref=e211]
                  - list [ref=e212]:
                    - listitem [ref=e213]: Acompte 5 000 F CFA par personne
                    - listitem [ref=e217]: Confirmation immédiate
                - region [ref=e220]:
                  - heading "Combien de personnes ?" [level=3] [ref=e222]:
                    - generic [aria-hidden] [ref=e223]: "1"
                    - text: Combien de personnes ?
                  - generic [ref=e224]:
                    - generic [ref=e225]: Personnes
                    - generic [ref=e226]:
                      - button "Une personne de moins" [ref=e227] [cursor=pointer]
                      - generic [ref=e230]:
                        - textbox "Personnes" [ref=e231]: "4"
                        - generic [aria-hidden] [ref=e232]: personnes
                      - button "Une personne de plus" [ref=e233] [cursor=pointer]
                    - paragraph [ref=e236]: Tables de 1 à 8 personnes. Plus de 50 ? Contactez l’établissement.
                - region [ref=e237]:
                  - heading "Quel jour ?" [level=3] [ref=e239]:
                    - generic [aria-hidden] [ref=e240]: "2"
                    - text: Quel jour ?
                  - group "Jour" [ref=e241]:
                    - generic [ref=e243]:
                      - button "Auj. 26 nov , aujourd’hui, jeudi 26 novembre" [ref=e244] [cursor=pointer]:
                        - generic [ref=e245]: Auj.
                        - generic [ref=e246]: "26"
                        - generic [ref=e247]: nov
                        - generic [ref=e248]: ", aujourd’hui, jeudi 26 novembre"
                      - button "Dem. 27 nov , demain, vendredi 27 novembre" [ref=e249] [cursor=pointer]:
                        - generic [ref=e250]: Dem.
                        - generic [ref=e251]: "27"
                        - generic [ref=e252]: nov
                        - generic [ref=e253]: ", demain, vendredi 27 novembre"
                      - button "sam 28 nov , samedi 28 novembre" [ref=e254] [cursor=pointer]:
                        - generic [ref=e255]: sam
                        - generic [ref=e256]: "28"
                        - generic [ref=e257]: nov
                        - generic [ref=e258]: ", samedi 28 novembre"
                      - button "dim 29 nov , dimanche 29 novembre" [pressed] [ref=e259] [cursor=pointer]:
                        - generic [ref=e260]: dim
                        - generic [ref=e261]: "29"
                        - generic [ref=e262]: nov
                        - generic [ref=e263]: ", dimanche 29 novembre"
                      - button "lun 30 nov , lundi 30 novembre" [ref=e264] [cursor=pointer]:
                        - generic [ref=e265]: lun
                        - generic [ref=e266]: "30"
                        - generic [ref=e267]: nov
                        - generic [ref=e268]: ", lundi 30 novembre"
                      - button "mar 1 déc , mardi 1 décembre" [ref=e269] [cursor=pointer]:
                        - generic [ref=e270]: mar
                        - generic [ref=e271]: "1"
                        - generic [ref=e272]: déc
                        - generic [ref=e273]: ", mardi 1 décembre"
                      - button "mer 2 déc , mercredi 2 décembre" [ref=e274] [cursor=pointer]:
                        - generic [ref=e275]: mer
                        - generic [ref=e276]: "2"
                        - generic [ref=e277]: déc
                        - generic [ref=e278]: ", mercredi 2 décembre"
                      - button "jeu 3 déc , jeudi 3 décembre" [ref=e279] [cursor=pointer]:
                        - generic [ref=e280]: jeu
                        - generic [ref=e281]: "3"
                        - generic [ref=e282]: déc
                        - generic [ref=e283]: ", jeudi 3 décembre"
                      - button "ven 4 déc , vendredi 4 décembre" [ref=e284] [cursor=pointer]:
                        - generic [ref=e285]: ven
                        - generic [ref=e286]: "4"
                        - generic [ref=e287]: déc
                        - generic [ref=e288]: ", vendredi 4 décembre"
                      - button "sam 5 déc , samedi 5 décembre" [ref=e289] [cursor=pointer]:
                        - generic [ref=e290]: sam
                        - generic [ref=e291]: "5"
                        - generic [ref=e292]: déc
                        - generic [ref=e293]: ", samedi 5 décembre"
                      - button "dim 6 déc , dimanche 6 décembre" [ref=e294] [cursor=pointer]:
                        - generic [ref=e295]: dim
                        - generic [ref=e296]: "6"
                        - generic [ref=e297]: déc
                        - generic [ref=e298]: ", dimanche 6 décembre"
                      - button "lun 7 déc , lundi 7 décembre" [ref=e299] [cursor=pointer]:
                        - generic [ref=e300]: lun
                        - generic [ref=e301]: "7"
                        - generic [ref=e302]: déc
                        - generic [ref=e303]: ", lundi 7 décembre"
                      - button "mar 8 déc , mardi 8 décembre" [ref=e304] [cursor=pointer]:
                        - generic [ref=e305]: mar
                        - generic [ref=e306]: "8"
                        - generic [ref=e307]: déc
                        - generic [ref=e308]: ", mardi 8 décembre"
                      - button "mer 9 déc , mercredi 9 décembre" [ref=e309] [cursor=pointer]:
                        - generic [ref=e310]: mer
                        - generic [ref=e311]: "9"
                        - generic [ref=e312]: déc
                        - generic [ref=e313]: ", mercredi 9 décembre"
                    - generic [ref=e314]:
                      - generic [ref=e315]: Autre jour
                      - textbox "Autre jour" [ref=e317]
                      - paragraph [ref=e318]: Jusqu’à 90 jours à l’avance.
                - region [ref=e319]:
                  - generic [ref=e320]:
                    - heading "À quelle heure ?" [level=3] [ref=e321]:
                      - generic [aria-hidden] [ref=e322]: "3"
                      - text: À quelle heure ?
                    - paragraph [ref=e323]: Table pour 2 h
                  - group "Zone (facultatif)" [ref=e324]:
                    - button "Toutes les zones" [pressed] [ref=e325] [cursor=pointer]:
                      - generic [aria-hidden] [ref=e326]: ✓
                      - text: Toutes les zones
                    - button "Salle climatisée" [ref=e327] [cursor=pointer]
                    - button "Terrasse" [ref=e332] [cursor=pointer]
                  - status [ref=e337]
                  - generic [ref=e338]:
                    - generic [ref=e339]:
                      - heading "Midi" [level=4] [ref=e340]
                      - list [ref=e341]:
                        - listitem [ref=e342]:
                          - button "12 h" [ref=e343] [cursor=pointer]
                        - listitem [ref=e345]:
                          - button "12 h 30" [ref=e346] [cursor=pointer]
                        - listitem [ref=e348]:
                          - button "13 h" [ref=e349] [cursor=pointer]
                    - generic [ref=e351]:
                      - heading "Soir" [level=4] [ref=e352]
                      - list [ref=e353]:
                        - listitem [ref=e354]:
                          - button "19 h" [ref=e355] [cursor=pointer]
                        - listitem [ref=e357]:
                          - button "19 h 30" [ref=e358] [cursor=pointer]
                        - listitem [ref=e360]:
                          - button "20 h" [pressed] [ref=e361] [cursor=pointer]
                        - listitem [ref=e365]:
                          - button "20 h 30" [ref=e366] [cursor=pointer]
                        - listitem [ref=e368]:
                          - button "21 h" [ref=e369] [cursor=pointer]
                        - listitem [ref=e371]:
                          - button "21 h 30" [ref=e372] [cursor=pointer]
                - region [ref=e374]:
                  - heading "Votre table (facultatif)" [level=3] [ref=e376]:
                    - generic [aria-hidden] [ref=e377]: "4"
                    - text: Votre table (facultatif)
                  - generic [ref=e378]:
                    - paragraph [ref=e379]:
                      - generic [ref=e385]: Touchez une table libre pour la choisir. Sans choix, l’établissement vous en attribue une qui convient.
                    - generic [ref=e386]:
                      - group "Plan de salle de La Terrasse du Plateau à 20 h" [ref=e387]:
                        - generic [ref=e388]:
                          - generic:
                            - generic "Salle climatisée"
                          - generic:
                            - generic "Terrasse"
                          - button "Table 1, 2 places, ne convient pas au nombre de personnes, Pour 2 personnes" [disabled] [ref=e389]:
                            - generic [aria-hidden] [ref=e391]:
                              - generic [ref=e392]: "1"
                              - generic [ref=e393]: "2"
                          - button "Table 2, 2 places, ne convient pas au nombre de personnes, Pour 2 personnes" [disabled] [ref=e399]:
                            - generic [aria-hidden] [ref=e401]:
                              - generic [ref=e402]: "2"
                              - generic [ref=e403]: "2"
                          - button "Table 3, 4 places, à partir de 2, déjà prise à cette heure, Déjà réservée à cette heure" [disabled] [ref=e409]:
                            - generic [aria-hidden] [ref=e411]:
                              - generic [ref=e412]: "3"
                              - generic [ref=e413]: Prise
                          - button "Table 4, 4 places, à partir de 2, libre, 4 places" [ref=e418] [cursor=pointer]:
                            - generic [aria-hidden] [ref=e420]:
                              - generic [ref=e421]: "4"
                              - generic [ref=e422]: "4"
                          - button "Table 5, 6 places, à partir de 3, libre, 6 places" [ref=e428] [cursor=pointer]:
                            - generic [aria-hidden] [ref=e430]:
                              - generic [ref=e431]: "5"
                              - generic [ref=e432]: "6"
                          - button "Table 6, 4 places, à partir de 2, libre, 4 places" [ref=e438] [cursor=pointer]:
                            - generic [aria-hidden] [ref=e440]:
                              - generic [ref=e441]: "6"
                              - generic [ref=e442]: "4"
                          - button "Table 7, 6 places, à partir de 3, libre, 6 places" [ref=e448] [cursor=pointer]:
                            - generic [aria-hidden] [ref=e450]:
                              - generic [ref=e451]: "7"
                              - generic [ref=e452]: "6"
                          - button "Table 8, 8 places, à partir de 4, libre, 8 places" [ref=e458] [cursor=pointer]:
                            - generic [aria-hidden] [ref=e460]:
                              - generic [ref=e461]: "8"
                              - generic [ref=e462]: "8"
                      - paragraph [ref=e468]: "Zones du plan : Salle climatisée, Terrasse"
                      - list "Légende du plan" [ref=e469]:
                        - listitem [ref=e470]:
                          - generic [ref=e472]: Libre
                        - listitem [ref=e473]:
                          - generic [ref=e475]: Votre choix
                        - listitem [ref=e476]:
                          - generic [ref=e478]: Déjà prise
                        - listitem [ref=e479]:
                          - generic [ref=e481]: Ne convient pas au groupe
                      - paragraph [ref=e482]: "Flèches : déplacer de 1 %. Majuscule et flèches : déplacer de 5 %. Touche R : tourner la table de 15 degrés."
                      - paragraph [ref=e483]
                    - paragraph [ref=e484]: Aucune table choisie
                - region [ref=e485]:
                  - heading "Une demande particulière ?" [level=3] [ref=e487]:
                    - generic [aria-hidden] [ref=e488]: "5"
                    - text: Une demande particulière ?
                  - generic [ref=e489]:
                    - generic [ref=e490]:
                      - generic [ref=e491]: Demande particulière (facultatif)
                      - generic [ref=e492]: 0 / 500
                    - textbox "Demande particulière (facultatif)" [ref=e493]:
                      - /placeholder: "Par exemple : anniversaire, chaise haute, table au calme"
                    - paragraph [ref=e494]: Transmise à l’établissement avec votre réservation.
                - generic [ref=e495]:
                  - paragraph [ref=e496]:
                    - generic [ref=e501]: Dimanche 29 novembre à 20 h · 4 personnes
                  - generic [ref=e502]:
                    - status [ref=e503]: "Total à payer : 21 000 F CFA."
                    - generic [ref=e504]:
                      - generic [ref=e505]:
                        - term [ref=e506]: Acompte (4 personnes)
                        - definition [ref=e507]: 20 000 F CFA
                      - generic [ref=e508]:
                        - term [ref=e509]: Frais de service
                        - definition [ref=e510]: 1 000 F CFA
                      - generic [ref=e511]:
                        - term [ref=e512]: Total à payer
                        - definition [ref=e513]: 21 000 F CFA
                - generic [ref=e514]:
                  - button "Réserver et payer l’acompte" [ref=e515] [cursor=pointer]
                  - paragraph [ref=e517]: Après la réservation, la table vous est gardée 15 minutes, le temps de payer l’acompte par Wave ou Orange Money.
    - navigation "Navigation rapide":
      - generic [ref=e518]:
        - link "Accueil" [ref=e520] [cursor=pointer]:
          - /url: /
        - link "Explorer" [ref=e526] [cursor=pointer]:
          - /url: /explore
        - link "Billets" [ref=e532] [cursor=pointer]:
          - /url: /tickets
        - link "Avis (nouvelles notifications)" [ref=e537] [cursor=pointer]:
          - /url: /notifications
          - generic [ref=e543]:
            - text: Avis
            - generic [ref=e544]: (nouvelles notifications)
        - link "Portefeuille" [ref=e545] [cursor=pointer]:
          - /url: /wallet
  - alert [ref=e551]
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
      |                                                                   ^ Error: contrôles bloquants de tables-fiche-plan__mobile__sombre.png
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