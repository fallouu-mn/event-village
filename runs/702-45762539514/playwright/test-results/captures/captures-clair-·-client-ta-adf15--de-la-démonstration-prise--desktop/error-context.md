# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> clair · client >> tables-fiche-plan — Fiche d’un établissement : plan de salle au créneau choisi (table de la démonstration prise)
- Location: e2e/captures.spec.ts:202:9

# Error details

```
Error: contrôles bloquants de tables-fiche-plan__ordinateur__clair.png

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
  - generic [ref=e3]:
    - banner [ref=e4]:
      - generic [ref=e5]:
        - link "Event Village, accueil" [ref=e7] [cursor=pointer]:
          - /url: /
          - generic [ref=e8]: Event Village
        - navigation "Rubriques" [ref=e13]:
          - link "Accueil" [ref=e14] [cursor=pointer]:
            - /url: /
          - link "Explorer" [ref=e15] [cursor=pointer]:
            - /url: /explore
          - link "Mes billets" [ref=e16] [cursor=pointer]:
            - /url: /tickets
          - link "Commandes" [ref=e17] [cursor=pointer]:
            - /url: /orders
          - link "Portefeuille" [ref=e18] [cursor=pointer]:
            - /url: /wallet
      - link "Rechercher un événement…" [ref=e20] [cursor=pointer]:
        - /url: /explore
      - generic [ref=e25]:
        - button "Notifications, 13 non lues" [ref=e27] [cursor=pointer]:
          - generic [ref=e31]: "13"
        - button "Fatou Mbaye" [ref=e33] [cursor=pointer]:
          - generic [aria-hidden] [ref=e34]: FM
    - main [ref=e38]:
      - generic [ref=e40]:
        - link "Tous les établissements" [ref=e41] [cursor=pointer]:
          - /url: /tables
        - generic [ref=e46]:
          - article [ref=e47]:
            - region "Photos de La Terrasse du Plateau" [ref=e48]:
              - group "Faire défiler les photos avec les flèches gauche et droite" [ref=e49]:
                - img "Photo 1 sur 2 de La Terrasse du Plateau" [ref=e51]
              - button "Photo précédente" [ref=e54] [cursor=pointer]
              - button "Photo suivante" [ref=e58] [cursor=pointer]
              - generic:
                - paragraph: Photo 1 sur 2
            - generic [ref=e62]:
              - generic [ref=e63]: Restaurant
              - heading "La Terrasse du Plateau" [level=1] [ref=e65]
              - paragraph [ref=e66]:
                - generic [ref=e70]: 8, rue Carnot, Dakar-Plateau, Dakar
              - paragraph [ref=e71]: Proposé par Baobab Scène
            - list "L’essentiel" [ref=e72]:
              - listitem [ref=e73]:
                - generic [ref=e78]:
                  - paragraph [ref=e79]: Acompte 5 000 F CFA par personne
                  - paragraph [ref=e80]: Payé en ligne pour garder la table, frais de service en plus
              - listitem [ref=e81]:
                - generic [ref=e85]:
                  - paragraph [ref=e86]: Confirmation immédiate
                  - paragraph [ref=e87]: Votre table est confirmée tout de suite
              - listitem [ref=e88]:
                - generic [ref=e95]:
                  - paragraph [ref=e96]: De 1 à 8 personnes
                  - paragraph [ref=e97]: Selon les tables de l’établissement
              - listitem [ref=e98]:
                - generic [ref=e103]:
                  - paragraph [ref=e104]: Table pour 2 h
                  - paragraph [ref=e105]: Durée prévue pour votre repas ou votre soirée
            - region [ref=e106]:
              - heading "À propos" [level=2] [ref=e107]
              - paragraph [ref=e108]: "Cuisine sénégalaise et grillades de la mer au cœur du Plateau : thiéboudiène le midi, poissons braisés le soir. Salle climatisée et terrasse ombragée ; menus de groupe sur demande."
            - region [ref=e109]:
              - heading "Horaires" [level=2] [ref=e110]
              - list [ref=e111]:
                - listitem [ref=e112]:
                  - generic [ref=e113]: Lundi
                  - generic [ref=e114]:
                    - generic [ref=e115]: 12 h à 15 h
                    - generic [ref=e116]: 19 h à 23 h 30
                - listitem [ref=e117]:
                  - generic [ref=e118]: Mardi
                  - generic [ref=e119]:
                    - generic [ref=e120]: 12 h à 15 h
                    - generic [ref=e121]: 19 h à 23 h 30
                - listitem [ref=e122]:
                  - generic [ref=e123]: Mercredi
                  - generic [ref=e124]:
                    - generic [ref=e125]: 12 h à 15 h
                    - generic [ref=e126]: 19 h à 23 h 30
                - listitem [ref=e127]:
                  - generic [ref=e128]: Jeudi · aujourd’hui
                  - generic [ref=e129]:
                    - generic [ref=e130]: 12 h à 15 h
                    - generic [ref=e131]: 19 h à 23 h 30
                - listitem [ref=e132]:
                  - generic [ref=e133]: Vendredi
                  - generic [ref=e134]:
                    - generic [ref=e135]: 12 h à 15 h
                    - generic [ref=e136]: 19 h à 23 h 30
                - listitem [ref=e137]:
                  - generic [ref=e138]: Samedi
                  - generic [ref=e139]:
                    - generic [ref=e140]: 12 h à 15 h
                    - generic [ref=e141]: 19 h à 23 h 30
                - listitem [ref=e142]:
                  - generic [ref=e143]: Dimanche
                  - generic [ref=e144]:
                    - generic [ref=e145]: 12 h à 15 h
                    - generic [ref=e146]: 19 h à 23 h 30
              - generic [ref=e147]:
                - heading "Fermetures exceptionnelles à venir" [level=3] [ref=e148]
                - list [ref=e153]:
                  - listitem [ref=e154]: Dimanche 6 décembre, toute la journée
            - region [ref=e155]:
              - heading "Adresse" [level=2] [ref=e156]
              - paragraph [ref=e157]: 8, rue Carnot, Dakar-Plateau, Dakar
              - generic [ref=e158]:
                - img "La Terrasse du Plateau, 8, rue Carnot, Dakar-Plateau, Dakar" [ref=e165]:
                  - generic [ref=e166]: La Terrasse du Plateau
                - button "Afficher la carte" [ref=e170] [cursor=pointer]
              - link "Voir l’itinéraire" [ref=e175] [cursor=pointer]:
                - /url: https://www.google.com/maps/dir/?api=1&destination=14.6681,-17.4335
            - region [ref=e185]:
              - heading "Bon à savoir" [level=2] [ref=e186]
              - list [ref=e187]:
                - listitem [ref=e188]:
                  - generic [ref=e193]:
                    - heading "Annulation" [level=3] [ref=e194]
                    - paragraph [ref=e195]: "Annulation gratuite jusqu’à 2 h avant l’heure : l’acompte vous est rendu en entier. Après, il est gardé par l’établissement."
                - listitem [ref=e196]:
                  - generic [ref=e201]:
                    - heading "Retard" [level=3] [ref=e202]
                    - paragraph [ref=e203]: Votre table est gardée 30 minutes après l’heure prévue. Au-delà, elle peut être donnée à d’autres clients.
                - listitem [ref=e204]:
                  - generic [ref=e209]:
                    - heading "Paiement de l’acompte" [level=3] [ref=e210]
                    - paragraph [ref=e211]: "Après la réservation, vous avez 15 minutes pour payer par Wave ou Orange Money ; sinon la table est libérée. Des frais de service s’ajoutent : leur montant exact s’affiche avant de réserver."
          - complementary [ref=e212]:
            - generic [ref=e213]:
              - generic [ref=e214]:
                - heading "Réserver une table" [level=2] [ref=e215]
                - list [ref=e216]:
                  - listitem [ref=e217]: Acompte 5 000 F CFA par personne
                  - listitem [ref=e221]: Confirmation immédiate
              - region [ref=e224]:
                - heading "Combien de personnes ?" [level=3] [ref=e226]:
                  - generic [aria-hidden] [ref=e227]: "1"
                  - text: Combien de personnes ?
                - generic [ref=e228]:
                  - generic [ref=e229]: Personnes
                  - generic [ref=e230]:
                    - button "Une personne de moins" [ref=e231] [cursor=pointer]
                    - generic [ref=e234]:
                      - textbox "Personnes" [ref=e235]: "4"
                      - generic [aria-hidden] [ref=e236]: personnes
                    - button "Une personne de plus" [ref=e237] [cursor=pointer]
                  - paragraph [ref=e240]: Tables de 1 à 8 personnes. Plus de 50 ? Contactez l’établissement.
              - region [ref=e241]:
                - heading "Quel jour ?" [level=3] [ref=e243]:
                  - generic [aria-hidden] [ref=e244]: "2"
                  - text: Quel jour ?
                - group "Jour" [ref=e245]:
                  - generic [ref=e247]:
                    - button "Auj. 26 nov , aujourd’hui, jeudi 26 novembre" [ref=e248] [cursor=pointer]:
                      - generic [ref=e249]: Auj.
                      - generic [ref=e250]: "26"
                      - generic [ref=e251]: nov
                      - generic [ref=e252]: ", aujourd’hui, jeudi 26 novembre"
                    - button "Dem. 27 nov , demain, vendredi 27 novembre" [ref=e253] [cursor=pointer]:
                      - generic [ref=e254]: Dem.
                      - generic [ref=e255]: "27"
                      - generic [ref=e256]: nov
                      - generic [ref=e257]: ", demain, vendredi 27 novembre"
                    - button "sam 28 nov , samedi 28 novembre" [ref=e258] [cursor=pointer]:
                      - generic [ref=e259]: sam
                      - generic [ref=e260]: "28"
                      - generic [ref=e261]: nov
                      - generic [ref=e262]: ", samedi 28 novembre"
                    - button "dim 29 nov , dimanche 29 novembre" [pressed] [ref=e263] [cursor=pointer]:
                      - generic [ref=e264]: dim
                      - generic [ref=e265]: "29"
                      - generic [ref=e266]: nov
                      - generic [ref=e267]: ", dimanche 29 novembre"
                    - button "lun 30 nov , lundi 30 novembre" [ref=e268] [cursor=pointer]:
                      - generic [ref=e269]: lun
                      - generic [ref=e270]: "30"
                      - generic [ref=e271]: nov
                      - generic [ref=e272]: ", lundi 30 novembre"
                    - button "mar 1 déc , mardi 1 décembre" [ref=e273] [cursor=pointer]:
                      - generic [ref=e274]: mar
                      - generic [ref=e275]: "1"
                      - generic [ref=e276]: déc
                      - generic [ref=e277]: ", mardi 1 décembre"
                    - button "mer 2 déc , mercredi 2 décembre" [ref=e278] [cursor=pointer]:
                      - generic [ref=e279]: mer
                      - generic [ref=e280]: "2"
                      - generic [ref=e281]: déc
                      - generic [ref=e282]: ", mercredi 2 décembre"
                    - button "jeu 3 déc , jeudi 3 décembre" [ref=e283] [cursor=pointer]:
                      - generic [ref=e284]: jeu
                      - generic [ref=e285]: "3"
                      - generic [ref=e286]: déc
                      - generic [ref=e287]: ", jeudi 3 décembre"
                    - button "ven 4 déc , vendredi 4 décembre" [ref=e288] [cursor=pointer]:
                      - generic [ref=e289]: ven
                      - generic [ref=e290]: "4"
                      - generic [ref=e291]: déc
                      - generic [ref=e292]: ", vendredi 4 décembre"
                    - button "sam 5 déc , samedi 5 décembre" [ref=e293] [cursor=pointer]:
                      - generic [ref=e294]: sam
                      - generic [ref=e295]: "5"
                      - generic [ref=e296]: déc
                      - generic [ref=e297]: ", samedi 5 décembre"
                    - button "dim 6 déc , dimanche 6 décembre" [ref=e298] [cursor=pointer]:
                      - generic [ref=e299]: dim
                      - generic [ref=e300]: "6"
                      - generic [ref=e301]: déc
                      - generic [ref=e302]: ", dimanche 6 décembre"
                    - button "lun 7 déc , lundi 7 décembre" [ref=e303] [cursor=pointer]:
                      - generic [ref=e304]: lun
                      - generic [ref=e305]: "7"
                      - generic [ref=e306]: déc
                      - generic [ref=e307]: ", lundi 7 décembre"
                    - button "mar 8 déc , mardi 8 décembre" [ref=e308] [cursor=pointer]:
                      - generic [ref=e309]: mar
                      - generic [ref=e310]: "8"
                      - generic [ref=e311]: déc
                      - generic [ref=e312]: ", mardi 8 décembre"
                    - button "mer 9 déc , mercredi 9 décembre" [ref=e313] [cursor=pointer]:
                      - generic [ref=e314]: mer
                      - generic [ref=e315]: "9"
                      - generic [ref=e316]: déc
                      - generic [ref=e317]: ", mercredi 9 décembre"
                  - generic [ref=e318]:
                    - generic [ref=e319]: Autre jour
                    - textbox "Autre jour" [ref=e321]
                    - paragraph [ref=e322]: Jusqu’à 90 jours à l’avance.
              - region [ref=e323]:
                - generic [ref=e324]:
                  - heading "À quelle heure ?" [level=3] [ref=e325]:
                    - generic [aria-hidden] [ref=e326]: "3"
                    - text: À quelle heure ?
                  - paragraph [ref=e327]: Table pour 2 h
                - group "Zone (facultatif)" [ref=e328]:
                  - button "Toutes les zones" [pressed] [ref=e329] [cursor=pointer]:
                    - generic [aria-hidden] [ref=e330]: ✓
                    - text: Toutes les zones
                  - button "Salle climatisée" [ref=e331] [cursor=pointer]
                  - button "Terrasse" [ref=e336] [cursor=pointer]
                - status [ref=e341]
                - generic [ref=e342]:
                  - generic [ref=e343]:
                    - heading "Midi" [level=4] [ref=e344]
                    - list [ref=e345]:
                      - listitem [ref=e346]:
                        - button "12 h" [ref=e347] [cursor=pointer]
                      - listitem [ref=e349]:
                        - button "12 h 30" [ref=e350] [cursor=pointer]
                      - listitem [ref=e352]:
                        - button "13 h" [ref=e353] [cursor=pointer]
                  - generic [ref=e355]:
                    - heading "Soir" [level=4] [ref=e356]
                    - list [ref=e357]:
                      - listitem [ref=e358]:
                        - button "19 h" [ref=e359] [cursor=pointer]
                      - listitem [ref=e361]:
                        - button "19 h 30" [ref=e362] [cursor=pointer]
                      - listitem [ref=e364]:
                        - button "20 h" [pressed] [ref=e365] [cursor=pointer]
                      - listitem [ref=e369]:
                        - button "20 h 30" [ref=e370] [cursor=pointer]
                      - listitem [ref=e372]:
                        - button "21 h" [ref=e373] [cursor=pointer]
                      - listitem [ref=e375]:
                        - button "21 h 30" [ref=e376] [cursor=pointer]
              - region [ref=e378]:
                - heading "Votre table (facultatif)" [level=3] [ref=e380]:
                  - generic [aria-hidden] [ref=e381]: "4"
                  - text: Votre table (facultatif)
                - generic [ref=e382]:
                  - paragraph [ref=e383]:
                    - generic [ref=e389]: Touchez une table libre pour la choisir. Sans choix, l’établissement vous en attribue une qui convient.
                  - generic [ref=e390]:
                    - group "Plan de salle de La Terrasse du Plateau à 20 h" [ref=e391]:
                      - generic [ref=e392]:
                        - generic:
                          - generic "Salle climatisée"
                        - generic:
                          - generic "Terrasse"
                        - button "Table 1, 2 places, ne convient pas au nombre de personnes, Pour 2 personnes" [disabled] [ref=e393]:
                          - generic [aria-hidden] [ref=e395]:
                            - generic [ref=e396]: "1"
                            - generic [ref=e397]: "2"
                        - button "Table 2, 2 places, ne convient pas au nombre de personnes, Pour 2 personnes" [disabled] [ref=e403]:
                          - generic [aria-hidden] [ref=e405]:
                            - generic [ref=e406]: "2"
                            - generic [ref=e407]: "2"
                        - button "Table 3, 4 places, à partir de 2, déjà prise à cette heure, Déjà réservée à cette heure" [disabled] [ref=e413]:
                          - generic [aria-hidden] [ref=e415]:
                            - generic [ref=e416]: "3"
                            - generic [ref=e417]: Prise
                        - button "Table 4, 4 places, à partir de 2, libre, 4 places" [ref=e422] [cursor=pointer]:
                          - generic [aria-hidden] [ref=e424]:
                            - generic [ref=e425]: "4"
                            - generic [ref=e426]: "4"
                        - button "Table 5, 6 places, à partir de 3, libre, 6 places" [ref=e432] [cursor=pointer]:
                          - generic [aria-hidden] [ref=e434]:
                            - generic [ref=e435]: "5"
                            - generic [ref=e436]: "6"
                        - button "Table 6, 4 places, à partir de 2, libre, 4 places" [ref=e442] [cursor=pointer]:
                          - generic [aria-hidden] [ref=e444]:
                            - generic [ref=e445]: "6"
                            - generic [ref=e446]: "4"
                        - button "Table 7, 6 places, à partir de 3, libre, 6 places" [ref=e452] [cursor=pointer]:
                          - generic [aria-hidden] [ref=e454]:
                            - generic [ref=e455]: "7"
                            - generic [ref=e456]: "6"
                        - button "Table 8, 8 places, à partir de 4, libre, 8 places" [ref=e462] [cursor=pointer]:
                          - generic [aria-hidden] [ref=e464]:
                            - generic [ref=e465]: "8"
                            - generic [ref=e466]: "8"
                    - paragraph [ref=e472]: "Zones du plan : Salle climatisée, Terrasse"
                    - list "Légende du plan" [ref=e473]:
                      - listitem [ref=e474]:
                        - generic [ref=e476]: Libre
                      - listitem [ref=e477]:
                        - generic [ref=e479]: Votre choix
                      - listitem [ref=e480]:
                        - generic [ref=e482]: Déjà prise
                      - listitem [ref=e483]:
                        - generic [ref=e485]: Ne convient pas au groupe
                    - paragraph [ref=e486]: "Flèches : déplacer de 1 %. Majuscule et flèches : déplacer de 5 %. Touche R : tourner la table de 15 degrés."
                    - paragraph [ref=e487]
                  - paragraph [ref=e488]: Aucune table choisie
              - region [ref=e489]:
                - heading "Une demande particulière ?" [level=3] [ref=e491]:
                  - generic [aria-hidden] [ref=e492]: "5"
                  - text: Une demande particulière ?
                - generic [ref=e493]:
                  - generic [ref=e494]:
                    - generic [ref=e495]: Demande particulière (facultatif)
                    - generic [ref=e496]: 0 / 500
                  - textbox "Demande particulière (facultatif)" [ref=e497]:
                    - /placeholder: "Par exemple : anniversaire, chaise haute, table au calme"
                  - paragraph [ref=e498]: Transmise à l’établissement avec votre réservation.
              - generic [ref=e499]:
                - paragraph [ref=e500]:
                  - generic [ref=e505]: Dimanche 29 novembre à 20 h · 4 personnes
                - generic [ref=e506]:
                  - status [ref=e507]: "Total à payer : 21 000 F CFA."
                  - generic [ref=e508]:
                    - generic [ref=e509]:
                      - term [ref=e510]: Acompte (4 personnes)
                      - definition [ref=e511]: 20 000 F CFA
                    - generic [ref=e512]:
                      - term [ref=e513]: Frais de service
                      - definition [ref=e514]: 1 000 F CFA
                    - generic [ref=e515]:
                      - term [ref=e516]: Total à payer
                      - definition [ref=e517]: 21 000 F CFA
              - generic [ref=e518]:
                - button "Réserver et payer l’acompte" [ref=e519] [cursor=pointer]
                - paragraph [ref=e521]: Après la réservation, la table vous est gardée 15 minutes, le temps de payer l’acompte par Wave ou Orange Money.
  - alert [ref=e522]
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
      |                                                                   ^ Error: contrôles bloquants de tables-fiche-plan__ordinateur__clair.png
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