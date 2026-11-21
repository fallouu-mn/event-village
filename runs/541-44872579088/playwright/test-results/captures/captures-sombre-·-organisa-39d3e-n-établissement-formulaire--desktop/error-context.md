# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · organisateur >> org-tables-creation — Établissement — création d’un établissement (formulaire)
- Location: e2e/captures.spec.ts:193:9

# Error details

```
Error: contrôles bloquants de org-tables-creation__ordinateur__sombre.png

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "axe-core label-content-name-mismatch (serious, 7 nœud(s)) : Elements must have their visible text as part of their accessible name",
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
          - paragraph [ref=e11]: Gestion
          - generic [ref=e12]:
            - link "Tableau de bord" [ref=e13] [cursor=pointer]:
              - /url: /partner/dashboard
            - link "Événements" [ref=e20] [cursor=pointer]:
              - /url: /partner/events
            - link "Salles de fête" [ref=e24] [cursor=pointer]:
              - /url: /partner/halls
            - link "Tables" [ref=e30] [cursor=pointer]:
              - /url: /partner/tables
            - link "Équipe" [ref=e35] [cursor=pointer]:
              - /url: /partner/team
        - generic [ref=e42]:
          - paragraph [ref=e43]: Outils
          - generic [ref=e44]:
            - link "Finances" [ref=e45] [cursor=pointer]:
              - /url: /partner/finance
            - link "Statistiques" [ref=e49] [cursor=pointer]:
              - /url: /partner/stats
            - link "Scanner les billets" [ref=e53] [cursor=pointer]:
              - /url: /partner/scan
            - link "Calendrier" [ref=e61] [cursor=pointer]:
              - /url: /partner/calendar
            - link "Abonnement" [ref=e65] [cursor=pointer]:
              - /url: /partner/subscription
            - link "Profil partenaire" [ref=e70] [cursor=pointer]:
              - /url: /partner/profile
        - link "Retour au site" [ref=e76] [cursor=pointer]:
          - /url: /
      - generic [ref=e82]:
        - link "Mariama Ndiaye Partenaire" [ref=e83] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=e84]: MN
          - generic [ref=e85]:
            - generic [ref=e86]: Mariama Ndiaye
            - generic [ref=e87]: Partenaire
        - generic [ref=e88]:
          - button "Se déconnecter" [ref=e89] [cursor=pointer]
          - button "Basculer le thème" [ref=e94] [cursor=pointer]
    - generic [ref=e98]:
      - banner [ref=e99]:
        - link "Rechercher un événement…" [ref=e101] [cursor=pointer]:
          - /url: /explore
        - button "Notifications, 37 non lues" [ref=e108] [cursor=pointer]:
          - generic [ref=e112]: "37"
      - main [ref=e113]:
        - generic [ref=e115]:
          - generic [ref=e116]:
            - link "Mes établissements" [ref=e118] [cursor=pointer]:
              - /url: /partner/tables
            - generic [ref=e124]:
              - heading "Ajouter un établissement" [level=1] [ref=e125]
              - paragraph [ref=e126]: "Décrivez le lieu, ses horaires et ses tables : vos clients réservent en quelques secondes."
          - generic [ref=e127]:
            - status [ref=e128]:
              - generic [ref=e133]:
                - paragraph [ref=e134]: L’établissement sera vérifié par l’équipe d’Event Village avant d’être visible.
                - generic [ref=e135]: Vous recevrez un message dès qu’il aura été examiné. Votre saisie est gardée sur cet appareil si vous quittez la page.
            - region [ref=e136]:
              - generic [ref=e138]:
                - generic [aria-hidden] [ref=e139]: "1"
                - generic [ref=e140]:
                  - heading "L’établissement" [level=2] [ref=e141]
                  - paragraph [ref=e142]: Ce que les clients voient en premier.
              - group "Genre" [ref=e143]:
                - generic [ref=e145]:
                  - generic [ref=e146] [cursor=pointer]:
                    - radio "Restaurant Repas assis, déjeuner ou dîner." [checked] [ref=e147]
                    - generic [ref=e148]:
                      - generic [ref=e149]: Restaurant
                      - generic [ref=e156]: Repas assis, déjeuner ou dîner.
                  - generic [ref=e157] [cursor=pointer]:
                    - radio "Bar Lounge, bar, rooftop, club." [ref=e158]
                    - generic [ref=e159]:
                      - generic [ref=e160]: Bar
                      - generic [ref=e164]: Lounge, bar, rooftop, club.
                  - generic [ref=e165] [cursor=pointer]:
                    - radio "Espace Terrasse, plage, espace privatisable." [ref=e166]
                    - generic [ref=e167]:
                      - generic [ref=e168]: Espace
                      - generic [ref=e173]: Terrasse, plage, espace privatisable.
              - generic [ref=e174]:
                - generic [ref=e176]:
                  - text: Nom*
                  - generic [ref=e177]: (obligatoire)
                - textbox "Nom (obligatoire)" [ref=e178]:
                  - /placeholder: "Par exemple : Le Lagon 1"
              - generic [ref=e179]:
                - generic [ref=e180]:
                  - generic [ref=e181]: Description
                  - generic [ref=e182]: 0 / 2000
                - textbox "Description" [ref=e183]:
                  - /placeholder: Cuisine, ambiance, musique, tenue, ce qui vous rend unique…
            - region [ref=e184]:
              - generic [ref=e186]:
                - generic [aria-hidden] [ref=e187]: "2"
                - generic [ref=e188]:
                  - heading "Adresse et position" [level=2] [ref=e189]
                  - paragraph [ref=e190]: Pour que les clients vous trouvent.
              - generic [ref=e191]:
                - generic [ref=e192]:
                  - generic [ref=e194]:
                    - text: Adresse*
                    - generic [ref=e195]: (obligatoire)
                  - textbox "Adresse (obligatoire)" [ref=e196]:
                    - /placeholder: Rue, quartier, point de repère
                - generic [ref=e197]:
                  - generic [ref=e199]:
                    - text: Ville*
                    - generic [ref=e200]: (obligatoire)
                  - combobox "Ville (obligatoire)" [ref=e202] [cursor=pointer]:
                    - option "Choisir la ville" [disabled] [selected]
                    - option "Cap Skirring"
                    - option "Dakar"
                    - option "Diamniadio"
                    - option "Diourbel"
                    - option "Fatick"
                    - option "Guédiawaye"
                    - option "Joal-Fadiouth"
                    - option "Kaffrine"
                    - option "Kaolack"
                    - option "Kédougou"
                    - option "Kolda"
                    - option "Louga"
                    - option "Matam"
                    - option "Mbacké"
                    - option "Mbour"
                    - option "Pikine"
                    - option "Richard-Toll"
                    - option "Rufisque"
                    - option "Saint-Louis"
                    - option "Saly"
                    - option "Sédhiou"
                    - option "Tambacounda"
                    - option "Thiès"
                    - option "Tivaouane"
                    - option "Touba"
                    - option "Ziguinchor"
                    - option "Autre ville"
              - group "Position sur la carte (conseillée)" [ref=e203]:
                - paragraph [ref=e205]: "Placez le repère sur l’entrée : la carte s’affiche sur votre fiche."
                - generic [ref=e206]:
                  - search "Rechercher un lieu" [ref=e207]:
                    - generic [ref=e208]:
                      - generic [ref=e209]:
                        - generic [ref=e210]: Rechercher un lieu
                        - textbox "Rechercher un lieu" [ref=e212]:
                          - /placeholder: "Par exemple : Grand Théâtre, Dakar"
                      - button "Rechercher" [ref=e213] [cursor=pointer]
                    - generic [ref=e219]: "Lieux : © contributeurs OpenStreetMap"
                  - generic [ref=e221]:
                    - paragraph [ref=e222]: Cliquez sur la carte ou déplacez le repère pour indiquer l’entrée du lieu. Vous pouvez aussi saisir les coordonnées.
                    - button "Ma position" [ref=e223] [cursor=pointer]
                  - region "Carte du lieu" [ref=e230]:
                    - generic:
                      - generic [ref=e231]:
                        - button "Zoom avant" [ref=e232] [cursor=pointer]: +
                        - button "Zoom arrière" [ref=e233] [cursor=pointer]: −
                      - generic: © contributeurs OpenStreetMap
                  - generic [ref=e235]:
                    - generic [ref=e236]:
                      - generic [ref=e237]: Latitude
                      - textbox "Latitude" [ref=e239]:
                        - /placeholder: "Par exemple : 14.6937"
                    - generic [ref=e240]:
                      - generic [ref=e241]: Longitude
                      - textbox "Longitude" [ref=e243]:
                        - /placeholder: "Par exemple : -17.4441"
            - region [ref=e244]:
              - generic [ref=e246]:
                - generic [aria-hidden] [ref=e247]: "3"
                - generic [ref=e248]:
                  - heading "Photos" [level=2] [ref=e249]
                  - paragraph [ref=e250]: "De 1 à 12 photos. La première est la couverture, montrée dans la recherche. Photos : 0 sur 12."
              - generic [ref=e251]:
                - paragraph [ref=e252]
                - generic [ref=e253]:
                  - generic [ref=e254]:
                    - text: Ajouter une photo*
                    - generic [ref=e255]: (obligatoire)
                  - button "Ajouter une photo (obligatoire)" [ref=e256]
                  - generic [ref=e257] [cursor=pointer]: Choisir une image ou la déposer ici
                  - paragraph [ref=e264]: JPEG, PNG ou WebP, 5 Mo au plus. Une photo à la fois ; la salle, la terrasse, une table dressée, un plat.
            - region [ref=e265]:
              - generic [ref=e267]:
                - generic [aria-hidden] [ref=e268]: "4"
                - generic [ref=e269]:
                  - heading "Horaires" [level=2] [ref=e270]
                  - paragraph [ref=e271]: "Jour par jour, jusqu’à 4 plages. Une plage peut finir après minuit : le client réserve jusqu’à la fermeture moins la durée d’une réservation."
              - list [ref=e274]:
                - listitem [ref=e275]:
                  - generic [ref=e277]:
                    - generic [ref=e278]:
                      - generic [ref=e279] [cursor=pointer]: Lundi
                      - paragraph [ref=e280]: 12 h à 23 h
                    - generic [ref=e281]:
                      - generic [aria-hidden] [ref=e282]: Activé
                      - switch "Lundi" [checked] [ref=e283] [cursor=pointer]
                  - generic [ref=e286]:
                    - generic [ref=e288]:
                      - generic [ref=e289]:
                        - generic [ref=e290]: Ouvre à
                        - textbox "Ouvre à" [ref=e292]: 12:00
                      - generic [ref=e293]:
                        - generic [ref=e294]: Ferme à
                        - textbox "Ferme à" [ref=e296]: 23:00
                      - button "Retirer la plage 1 du lundi" [ref=e297] [cursor=pointer]
                    - generic [ref=e302]:
                      - button "Ajouter une plage" [ref=e303] [cursor=pointer]
                      - button "Copier les horaires du lundi sur tous les jours" [ref=e307] [cursor=pointer]:
                        - generic [ref=e312]: Copier sur tous les jours
                - listitem [ref=e313]:
                  - generic [ref=e315]:
                    - generic [ref=e316]:
                      - generic [ref=e317] [cursor=pointer]: Mardi
                      - paragraph [ref=e318]: 12 h à 23 h
                    - generic [ref=e319]:
                      - generic [aria-hidden] [ref=e320]: Activé
                      - switch "Mardi" [checked] [ref=e321] [cursor=pointer]
                  - generic [ref=e324]:
                    - generic [ref=e326]:
                      - generic [ref=e327]:
                        - generic [ref=e328]: Ouvre à
                        - textbox "Ouvre à" [ref=e330]: 12:00
                      - generic [ref=e331]:
                        - generic [ref=e332]: Ferme à
                        - textbox "Ferme à" [ref=e334]: 23:00
                      - button "Retirer la plage 1 du mardi" [ref=e335] [cursor=pointer]
                    - generic [ref=e340]:
                      - button "Ajouter une plage" [ref=e341] [cursor=pointer]
                      - button "Copier les horaires du mardi sur tous les jours" [ref=e345] [cursor=pointer]:
                        - generic [ref=e350]: Copier sur tous les jours
                - listitem [ref=e351]:
                  - generic [ref=e353]:
                    - generic [ref=e354]:
                      - generic [ref=e355] [cursor=pointer]: Mercredi
                      - paragraph [ref=e356]: 12 h à 23 h
                    - generic [ref=e357]:
                      - generic [aria-hidden] [ref=e358]: Activé
                      - switch "Mercredi" [checked] [ref=e359] [cursor=pointer]
                  - generic [ref=e362]:
                    - generic [ref=e364]:
                      - generic [ref=e365]:
                        - generic [ref=e366]: Ouvre à
                        - textbox "Ouvre à" [ref=e368]: 12:00
                      - generic [ref=e369]:
                        - generic [ref=e370]: Ferme à
                        - textbox "Ferme à" [ref=e372]: 23:00
                      - button "Retirer la plage 1 du mercredi" [ref=e373] [cursor=pointer]
                    - generic [ref=e378]:
                      - button "Ajouter une plage" [ref=e379] [cursor=pointer]
                      - button "Copier les horaires du mercredi sur tous les jours" [ref=e383] [cursor=pointer]:
                        - generic [ref=e388]: Copier sur tous les jours
                - listitem [ref=e389]:
                  - generic [ref=e391]:
                    - generic [ref=e392]:
                      - generic [ref=e393] [cursor=pointer]: Jeudi
                      - paragraph [ref=e394]: 12 h à 23 h
                    - generic [ref=e395]:
                      - generic [aria-hidden] [ref=e396]: Activé
                      - switch "Jeudi" [checked] [ref=e397] [cursor=pointer]
                  - generic [ref=e400]:
                    - generic [ref=e402]:
                      - generic [ref=e403]:
                        - generic [ref=e404]: Ouvre à
                        - textbox "Ouvre à" [ref=e406]: 12:00
                      - generic [ref=e407]:
                        - generic [ref=e408]: Ferme à
                        - textbox "Ferme à" [ref=e410]: 23:00
                      - button "Retirer la plage 1 du jeudi" [ref=e411] [cursor=pointer]
                    - generic [ref=e416]:
                      - button "Ajouter une plage" [ref=e417] [cursor=pointer]
                      - button "Copier les horaires du jeudi sur tous les jours" [ref=e421] [cursor=pointer]:
                        - generic [ref=e426]: Copier sur tous les jours
                - listitem [ref=e427]:
                  - generic [ref=e429]:
                    - generic [ref=e430]:
                      - generic [ref=e431] [cursor=pointer]: Vendredi
                      - paragraph [ref=e432]: 12 h à 23 h
                    - generic [ref=e433]:
                      - generic [aria-hidden] [ref=e434]: Activé
                      - switch "Vendredi" [checked] [ref=e435] [cursor=pointer]
                  - generic [ref=e438]:
                    - generic [ref=e440]:
                      - generic [ref=e441]:
                        - generic [ref=e442]: Ouvre à
                        - textbox "Ouvre à" [ref=e444]: 12:00
                      - generic [ref=e445]:
                        - generic [ref=e446]: Ferme à
                        - textbox "Ferme à" [ref=e448]: 23:00
                      - button "Retirer la plage 1 du vendredi" [ref=e449] [cursor=pointer]
                    - generic [ref=e454]:
                      - button "Ajouter une plage" [ref=e455] [cursor=pointer]
                      - button "Copier les horaires du vendredi sur tous les jours" [ref=e459] [cursor=pointer]:
                        - generic [ref=e464]: Copier sur tous les jours
                - listitem [ref=e465]:
                  - generic [ref=e467]:
                    - generic [ref=e468]:
                      - generic [ref=e469] [cursor=pointer]: Samedi
                      - paragraph [ref=e470]: 12 h à 23 h
                    - generic [ref=e471]:
                      - generic [aria-hidden] [ref=e472]: Activé
                      - switch "Samedi" [checked] [ref=e473] [cursor=pointer]
                  - generic [ref=e476]:
                    - generic [ref=e478]:
                      - generic [ref=e479]:
                        - generic [ref=e480]: Ouvre à
                        - textbox "Ouvre à" [ref=e482]: 12:00
                      - generic [ref=e483]:
                        - generic [ref=e484]: Ferme à
                        - textbox "Ferme à" [ref=e486]: 23:00
                      - button "Retirer la plage 1 du samedi" [ref=e487] [cursor=pointer]
                    - generic [ref=e492]:
                      - button "Ajouter une plage" [ref=e493] [cursor=pointer]
                      - button "Copier les horaires du samedi sur tous les jours" [ref=e497] [cursor=pointer]:
                        - generic [ref=e502]: Copier sur tous les jours
                - listitem [ref=e503]:
                  - generic [ref=e505]:
                    - generic [ref=e506]:
                      - generic [ref=e507] [cursor=pointer]: Dimanche
                      - paragraph [ref=e508]: 12 h à 23 h
                    - generic [ref=e509]:
                      - generic [aria-hidden] [ref=e510]: Activé
                      - switch "Dimanche" [checked] [ref=e511] [cursor=pointer]
                  - generic [ref=e514]:
                    - generic [ref=e516]:
                      - generic [ref=e517]:
                        - generic [ref=e518]: Ouvre à
                        - textbox "Ouvre à" [ref=e520]: 12:00
                      - generic [ref=e521]:
                        - generic [ref=e522]: Ferme à
                        - textbox "Ferme à" [ref=e524]: 23:00
                      - button "Retirer la plage 1 du dimanche" [ref=e525] [cursor=pointer]
                    - generic [ref=e530]:
                      - button "Ajouter une plage" [ref=e531] [cursor=pointer]
                      - button "Copier les horaires du dimanche sur tous les jours" [ref=e535] [cursor=pointer]:
                        - generic [ref=e540]: Copier sur tous les jours
            - region [ref=e541]:
              - generic [ref=e543]:
                - generic [aria-hidden] [ref=e544]: "5"
                - generic [ref=e545]:
                  - heading "Zones et tables" [level=2] [ref=e546]
                  - paragraph [ref=e547]: Les tables que vos clients peuvent réserver, avec leur nombre de places.
              - generic [ref=e549]:
                - generic [ref=e550]:
                  - generic [ref=e551]:
                    - heading "Zones (facultatif)" [level=3] [ref=e552]
                    - paragraph [ref=e553]: "Terrasse, salle, étage, coin VIP : le client peut choisir où s’asseoir."
                  - button "Ajouter une zone" [ref=e555] [cursor=pointer]
                - generic [ref=e559]:
                  - heading "Ajout rapide" [level=3] [ref=e560]
                  - paragraph [ref=e566]: Ajoutez plusieurs tables identiques d’un coup, numérotées à la suite.
                  - generic [ref=e567]:
                    - generic [ref=e568]:
                      - generic [ref=e569]: Tables
                      - textbox "Tables" [ref=e571]: "5"
                    - generic [ref=e572]:
                      - generic [ref=e573]: Places chacune
                      - textbox "Places chacune" [ref=e575]: "4"
                    - button "Ajouter 5 tables de 4" [ref=e576] [cursor=pointer]
                - generic [ref=e580]:
                  - generic [ref=e581]:
                    - heading "Tables" [level=3] [ref=e582]
                    - paragraph [ref=e583]: 1 table · 4 places
                  - list [ref=e589]:
                    - listitem [ref=e590]:
                      - generic [ref=e591]:
                        - generic [ref=e592]:
                          - generic [ref=e593]: Numéro
                          - textbox "Numéro" [ref=e595]: "1"
                        - generic [ref=e596]:
                          - generic [ref=e597]: Places
                          - textbox "Places" [ref=e599]: "4"
                        - generic [ref=e600]:
                          - generic [ref=e601]: Minimum
                          - textbox "Minimum" [ref=e603]:
                            - /placeholder: "1"
                        - button "Retirer la table 1" [ref=e605] [cursor=pointer]
                  - button "Ajouter une table" [ref=e611] [cursor=pointer]
                  - paragraph [ref=e615]: "« Minimum » : le plus petit groupe accepté à cette table (laissez vide pour 1). Vous pourrez placer les tables sur un plan de salle après la validation."
                - paragraph [ref=e616]
            - region [ref=e617]:
              - generic [ref=e619]:
                - generic [aria-hidden] [ref=e620]: "6"
                - generic [ref=e621]:
                  - heading "Réglages des réservations" [level=2] [ref=e622]
                  - paragraph [ref=e623]: Comment une demande devient une table gardée.
              - group "Confirmation" [ref=e624]:
                - generic [ref=e626]:
                  - generic [ref=e627] [cursor=pointer]:
                    - radio "Confirmation immédiate La table est gardée dès que le client réserve (et paie l’acompte s’il y en a un). Rien à faire de votre côté." [checked] [ref=e628]
                    - generic [ref=e629]:
                      - generic [ref=e630]: Confirmation immédiate
                      - generic [ref=e635]: La table est gardée dès que le client réserve (et paie l’acompte s’il y en a un). Rien à faire de votre côté.
                  - generic [ref=e636] [cursor=pointer]:
                    - radio "J’accepte chaque demande Vous avez 2 heures pour répondre à chaque demande. Sans réponse, elle est annulée et l’acompte rendu au client." [ref=e637]
                    - generic [ref=e638]:
                      - generic [ref=e639]: J’accepte chaque demande
                      - generic [ref=e646]: Vous avez 2 heures pour répondre à chaque demande. Sans réponse, elle est annulée et l’acompte rendu au client.
              - generic [ref=e647]:
                - generic [ref=e648]:
                  - generic [ref=e649]: Acompte par personne (F CFA)
                  - textbox "Acompte par personne (F CFA)" [ref=e651]:
                    - /placeholder: Vide = réservation gratuite
                  - paragraph [ref=e652]: Facultatif, de 100 à 1 000 000 F CFA. Des frais de service de 5 % sont payés par le client en plus.
                - generic [ref=e653]:
                  - generic [ref=e654]: Durée d’une réservation
                  - combobox "Durée d’une réservation" [ref=e657] [cursor=pointer]:
                    - 'option "Durée habituelle d’Event Village : 2 h" [selected]'
                    - option "30 min"
                    - option "45 min"
                    - option "1 h"
                    - option "1 h 15"
                    - option "1 h 30"
                    - option "1 h 45"
                    - option "2 h"
                    - option "2 h 15"
                    - option "2 h 30"
                    - option "2 h 45"
                    - option "3 h"
                    - option "3 h 15"
                    - option "3 h 30"
                    - option "3 h 45"
                    - option "4 h"
                    - option "4 h 15"
                    - option "4 h 30"
                    - option "4 h 45"
                    - option "5 h"
                    - option "5 h 15"
                    - option "5 h 30"
                    - option "5 h 45"
                    - option "6 h"
                  - paragraph [ref=e658]: Le temps pendant lequel la table est gardée pour un groupe.
              - paragraph [ref=e659]:
                - generic [ref=e663]: "Sans acompte, la réservation est gratuite pour le client. Un client en retard de plus de 30 minutes peut être noté absent : la table est libérée."
            - generic [ref=e664]:
              - link "Annuler" [ref=e665] [cursor=pointer]:
                - /url: /partner/tables
              - button "Envoyer en validation" [ref=e667] [cursor=pointer]
  - alert [ref=e673]
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
      |                                                                   ^ Error: contrôles bloquants de org-tables-creation__ordinateur__sombre.png
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