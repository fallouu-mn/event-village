# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · organisateur >> org-tables-modification — Établissement — modification d’un établissement validé (formulaire prérempli)
- Location: e2e/captures.spec.ts:193:9

# Error details

```
Error: contrôles bloquants de org-tables-modification__ordinateur__sombre.png

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
            - link "Retour à l’établissement" [ref=e118] [cursor=pointer]:
              - /url: /partner/tables/1bfb114d-b208-4e99-aa4d-dcaa33b505e2
            - generic [ref=e124]:
              - generic [ref=e125]: Validé
              - heading "Modifier l’établissement" [level=1] [ref=e128]
              - paragraph [ref=e129]: La Terrasse du Plateau
          - generic [ref=e130]:
            - navigation "Autres réglages de l’établissement" [ref=e131]:
              - link "Plan de salle Montré aux clients" [ref=e132] [cursor=pointer]:
                - /url: /partner/tables/edition/1bfb114d-b208-4e99-aa4d-dcaa33b505e2/plan
                - generic [ref=e139]:
                  - generic [ref=e140]: Plan de salle
                  - generic [ref=e141]: Montré aux clients
              - link "Fermetures exceptionnelles 1 à venir" [ref=e144] [cursor=pointer]:
                - /url: /partner/tables/edition/1bfb114d-b208-4e99-aa4d-dcaa33b505e2/fermetures
                - generic [ref=e150]:
                  - generic [ref=e151]: Fermetures exceptionnelles
                  - generic [ref=e152]: 1 à venir
            - generic [ref=e155]:
              - status [ref=e156]:
                - generic [ref=e161]:
                  - paragraph [ref=e162]: "Cet établissement est validé : il reste visible pendant vos modifications."
                  - generic [ref=e163]: Les réservations déjà faites gardent leur heure, leur table et leurs montants.
              - region [ref=e164]:
                - generic [ref=e166]:
                  - generic [aria-hidden] [ref=e167]: "1"
                  - generic [ref=e168]:
                    - heading "L’établissement" [level=2] [ref=e169]
                    - paragraph [ref=e170]: Ce que les clients voient en premier.
                - group "Genre" [ref=e171]:
                  - generic [ref=e173]:
                    - generic [ref=e174] [cursor=pointer]:
                      - radio "Restaurant Repas assis, déjeuner ou dîner." [checked] [ref=e175]
                      - generic [ref=e176]:
                        - generic [ref=e177]: Restaurant
                        - generic [ref=e184]: Repas assis, déjeuner ou dîner.
                    - generic [ref=e185] [cursor=pointer]:
                      - radio "Bar Lounge, bar, rooftop, club." [ref=e186]
                      - generic [ref=e187]:
                        - generic [ref=e188]: Bar
                        - generic [ref=e192]: Lounge, bar, rooftop, club.
                    - generic [ref=e193] [cursor=pointer]:
                      - radio "Espace Terrasse, plage, espace privatisable." [ref=e194]
                      - generic [ref=e195]:
                        - generic [ref=e196]: Espace
                        - generic [ref=e201]: Terrasse, plage, espace privatisable.
                - generic [ref=e202]:
                  - generic [ref=e204]:
                    - text: Nom*
                    - generic [ref=e205]: (obligatoire)
                  - textbox "Nom (obligatoire)" [ref=e206]:
                    - /placeholder: "Par exemple : Le Lagon 1"
                    - text: La Terrasse du Plateau
                - generic [ref=e207]:
                  - generic [ref=e208]:
                    - generic [ref=e209]: Description
                    - generic [ref=e210]: 180 / 2000
                  - textbox "Description" [ref=e211]:
                    - /placeholder: Cuisine, ambiance, musique, tenue, ce qui vous rend unique…
                    - text: "Cuisine sénégalaise et grillades de la mer au cœur du Plateau : thiéboudiène le midi, poissons braisés le soir. Salle climatisée et terrasse ombragée ; menus de groupe sur demande."
              - region [ref=e212]:
                - generic [ref=e214]:
                  - generic [aria-hidden] [ref=e215]: "2"
                  - generic [ref=e216]:
                    - heading "Adresse et position" [level=2] [ref=e217]
                    - paragraph [ref=e218]: Pour que les clients vous trouvent.
                - generic [ref=e219]:
                  - generic [ref=e220]:
                    - generic [ref=e222]:
                      - text: Adresse*
                      - generic [ref=e223]: (obligatoire)
                    - textbox "Adresse (obligatoire)" [ref=e224]:
                      - /placeholder: Rue, quartier, point de repère
                      - text: 8, rue Carnot, Dakar-Plateau
                  - generic [ref=e225]:
                    - generic [ref=e227]:
                      - text: Ville*
                      - generic [ref=e228]: (obligatoire)
                    - combobox "Ville (obligatoire)" [ref=e230] [cursor=pointer]:
                      - option "Choisir la ville" [disabled]
                      - option "Cap Skirring"
                      - option "Dakar" [selected]
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
                - group "Position sur la carte (conseillée)" [ref=e231]:
                  - paragraph [ref=e233]: "Placez le repère sur l’entrée : la carte s’affiche sur votre fiche."
                  - generic [ref=e234]:
                    - search "Rechercher un lieu" [ref=e235]:
                      - generic [ref=e236]:
                        - generic [ref=e237]:
                          - generic [ref=e238]: Rechercher un lieu
                          - textbox "Rechercher un lieu" [ref=e240]:
                            - /placeholder: "Par exemple : Grand Théâtre, Dakar"
                        - button "Rechercher" [ref=e241] [cursor=pointer]
                      - generic [ref=e247]: "Lieux : © contributeurs OpenStreetMap"
                    - generic [ref=e249]:
                      - paragraph [ref=e250]: Cliquez sur la carte ou déplacez le repère pour indiquer l’entrée du lieu. Vous pouvez aussi saisir les coordonnées.
                      - button "Ma position" [ref=e251] [cursor=pointer]
                    - region "Carte du lieu" [ref=e258]:
                      - img "Repère de la position du lieu" [ref=e259] [cursor=pointer]
                      - generic:
                        - generic [ref=e260]:
                          - button "Zoom avant" [ref=e261] [cursor=pointer]: +
                          - button "Zoom arrière" [ref=e262] [cursor=pointer]: −
                        - generic: © contributeurs OpenStreetMap
                    - generic [ref=e264]:
                      - generic [ref=e265]:
                        - generic [ref=e266]: Latitude
                        - textbox "Latitude" [ref=e268]:
                          - /placeholder: "Par exemple : 14.6937"
                          - text: "14.6681"
                      - generic [ref=e269]:
                        - generic [ref=e270]: Longitude
                        - textbox "Longitude" [ref=e272]:
                          - /placeholder: "Par exemple : -17.4441"
                          - text: "-17.4335"
                    - status [ref=e273]:
                      - generic [ref=e277]: Position choisie
              - region [ref=e278]:
                - generic [ref=e280]:
                  - generic [aria-hidden] [ref=e281]: "3"
                  - generic [ref=e282]:
                    - heading "Photos" [level=2] [ref=e283]
                    - paragraph [ref=e284]: "De 1 à 12 photos. La première est la couverture, montrée dans la recherche. Photos : 2 sur 12."
                - generic [ref=e285]:
                  - list "Photos de l’établissement, dans l’ordre d’affichage" [ref=e286]:
                    - listitem [ref=e287]:
                      - generic [ref=e288]:
                        - img "Photo de couverture de l’établissement" [ref=e289]
                        - generic [ref=e290]: Couverture
                      - generic [ref=e291]:
                        - generic [ref=e292]: "1"
                        - generic [ref=e293]:
                          - button "Placer la photo 1 avant" [disabled] [ref=e294]
                          - button "Placer la photo 1 après" [ref=e298] [cursor=pointer]
                          - button "Retirer la photo 1" [ref=e302] [cursor=pointer]
                    - listitem [ref=e307]:
                      - img "Photo 2 de l’établissement" [ref=e309]
                      - generic [ref=e310]:
                        - generic [ref=e311]: "2"
                        - generic [ref=e312]:
                          - button "Placer la photo 2 avant" [ref=e313] [cursor=pointer]
                          - button "Placer la photo 2 après" [disabled] [ref=e317]
                          - button "Retirer la photo 2" [ref=e321] [cursor=pointer]
                  - paragraph [ref=e326]
                  - generic [ref=e327]:
                    - generic [ref=e328]: Ajouter une autre photo
                    - button "Ajouter une autre photo" [ref=e329]
                    - generic [ref=e330] [cursor=pointer]: Choisir une image ou la déposer ici
                    - paragraph [ref=e337]: JPEG, PNG ou WebP, 5 Mo au plus. Une photo à la fois ; la salle, la terrasse, une table dressée, un plat.
              - region [ref=e338]:
                - generic [ref=e340]:
                  - generic [aria-hidden] [ref=e341]: "4"
                  - generic [ref=e342]:
                    - heading "Horaires" [level=2] [ref=e343]
                    - paragraph [ref=e344]: "Jour par jour, jusqu’à 4 plages. Une plage peut finir après minuit : le client réserve jusqu’à la fermeture moins la durée d’une réservation."
                - list [ref=e347]:
                  - listitem [ref=e348]:
                    - generic [ref=e350]:
                      - generic [ref=e351]:
                        - generic [ref=e352] [cursor=pointer]: Lundi
                        - paragraph [ref=e353]: 12 h à 15 h, 19 h à 23 h 30
                      - generic [ref=e354]:
                        - generic [aria-hidden] [ref=e355]: Activé
                        - switch "Lundi" [checked] [ref=e356] [cursor=pointer]
                    - generic [ref=e359]:
                      - generic [ref=e361]:
                        - generic [ref=e362]:
                          - generic [ref=e363]: Ouvre à
                          - textbox "Ouvre à" [ref=e365]: 12:00
                        - generic [ref=e366]:
                          - generic [ref=e367]: Ferme à
                          - textbox "Ferme à" [ref=e369]: 15:00
                        - button "Retirer la plage 1 du lundi" [ref=e370] [cursor=pointer]
                      - generic [ref=e376]:
                        - generic [ref=e377]:
                          - generic [ref=e378]: Ouvre à
                          - textbox "Ouvre à" [ref=e380]: 19:00
                        - generic [ref=e381]:
                          - generic [ref=e382]: Ferme à
                          - textbox "Ferme à" [ref=e384]: 23:30
                        - button "Retirer la plage 2 du lundi" [ref=e385] [cursor=pointer]
                      - generic [ref=e390]:
                        - button "Ajouter une plage" [ref=e391] [cursor=pointer]
                        - button "Copier les horaires du lundi sur tous les jours" [ref=e395] [cursor=pointer]:
                          - generic [ref=e400]: Copier sur tous les jours
                  - listitem [ref=e401]:
                    - generic [ref=e403]:
                      - generic [ref=e404]:
                        - generic [ref=e405] [cursor=pointer]: Mardi
                        - paragraph [ref=e406]: 12 h à 15 h, 19 h à 23 h 30
                      - generic [ref=e407]:
                        - generic [aria-hidden] [ref=e408]: Activé
                        - switch "Mardi" [checked] [ref=e409] [cursor=pointer]
                    - generic [ref=e412]:
                      - generic [ref=e414]:
                        - generic [ref=e415]:
                          - generic [ref=e416]: Ouvre à
                          - textbox "Ouvre à" [ref=e418]: 12:00
                        - generic [ref=e419]:
                          - generic [ref=e420]: Ferme à
                          - textbox "Ferme à" [ref=e422]: 15:00
                        - button "Retirer la plage 1 du mardi" [ref=e423] [cursor=pointer]
                      - generic [ref=e429]:
                        - generic [ref=e430]:
                          - generic [ref=e431]: Ouvre à
                          - textbox "Ouvre à" [ref=e433]: 19:00
                        - generic [ref=e434]:
                          - generic [ref=e435]: Ferme à
                          - textbox "Ferme à" [ref=e437]: 23:30
                        - button "Retirer la plage 2 du mardi" [ref=e438] [cursor=pointer]
                      - generic [ref=e443]:
                        - button "Ajouter une plage" [ref=e444] [cursor=pointer]
                        - button "Copier les horaires du mardi sur tous les jours" [ref=e448] [cursor=pointer]:
                          - generic [ref=e453]: Copier sur tous les jours
                  - listitem [ref=e454]:
                    - generic [ref=e456]:
                      - generic [ref=e457]:
                        - generic [ref=e458] [cursor=pointer]: Mercredi
                        - paragraph [ref=e459]: 12 h à 15 h, 19 h à 23 h 30
                      - generic [ref=e460]:
                        - generic [aria-hidden] [ref=e461]: Activé
                        - switch "Mercredi" [checked] [ref=e462] [cursor=pointer]
                    - generic [ref=e465]:
                      - generic [ref=e467]:
                        - generic [ref=e468]:
                          - generic [ref=e469]: Ouvre à
                          - textbox "Ouvre à" [ref=e471]: 12:00
                        - generic [ref=e472]:
                          - generic [ref=e473]: Ferme à
                          - textbox "Ferme à" [ref=e475]: 15:00
                        - button "Retirer la plage 1 du mercredi" [ref=e476] [cursor=pointer]
                      - generic [ref=e482]:
                        - generic [ref=e483]:
                          - generic [ref=e484]: Ouvre à
                          - textbox "Ouvre à" [ref=e486]: 19:00
                        - generic [ref=e487]:
                          - generic [ref=e488]: Ferme à
                          - textbox "Ferme à" [ref=e490]: 23:30
                        - button "Retirer la plage 2 du mercredi" [ref=e491] [cursor=pointer]
                      - generic [ref=e496]:
                        - button "Ajouter une plage" [ref=e497] [cursor=pointer]
                        - button "Copier les horaires du mercredi sur tous les jours" [ref=e501] [cursor=pointer]:
                          - generic [ref=e506]: Copier sur tous les jours
                  - listitem [ref=e507]:
                    - generic [ref=e509]:
                      - generic [ref=e510]:
                        - generic [ref=e511] [cursor=pointer]: Jeudi
                        - paragraph [ref=e512]: 12 h à 15 h, 19 h à 23 h 30
                      - generic [ref=e513]:
                        - generic [aria-hidden] [ref=e514]: Activé
                        - switch "Jeudi" [checked] [ref=e515] [cursor=pointer]
                    - generic [ref=e518]:
                      - generic [ref=e520]:
                        - generic [ref=e521]:
                          - generic [ref=e522]: Ouvre à
                          - textbox "Ouvre à" [ref=e524]: 12:00
                        - generic [ref=e525]:
                          - generic [ref=e526]: Ferme à
                          - textbox "Ferme à" [ref=e528]: 15:00
                        - button "Retirer la plage 1 du jeudi" [ref=e529] [cursor=pointer]
                      - generic [ref=e535]:
                        - generic [ref=e536]:
                          - generic [ref=e537]: Ouvre à
                          - textbox "Ouvre à" [ref=e539]: 19:00
                        - generic [ref=e540]:
                          - generic [ref=e541]: Ferme à
                          - textbox "Ferme à" [ref=e543]: 23:30
                        - button "Retirer la plage 2 du jeudi" [ref=e544] [cursor=pointer]
                      - generic [ref=e549]:
                        - button "Ajouter une plage" [ref=e550] [cursor=pointer]
                        - button "Copier les horaires du jeudi sur tous les jours" [ref=e554] [cursor=pointer]:
                          - generic [ref=e559]: Copier sur tous les jours
                  - listitem [ref=e560]:
                    - generic [ref=e562]:
                      - generic [ref=e563]:
                        - generic [ref=e564] [cursor=pointer]: Vendredi
                        - paragraph [ref=e565]: 12 h à 15 h, 19 h à 23 h 30
                      - generic [ref=e566]:
                        - generic [aria-hidden] [ref=e567]: Activé
                        - switch "Vendredi" [checked] [ref=e568] [cursor=pointer]
                    - generic [ref=e571]:
                      - generic [ref=e573]:
                        - generic [ref=e574]:
                          - generic [ref=e575]: Ouvre à
                          - textbox "Ouvre à" [ref=e577]: 12:00
                        - generic [ref=e578]:
                          - generic [ref=e579]: Ferme à
                          - textbox "Ferme à" [ref=e581]: 15:00
                        - button "Retirer la plage 1 du vendredi" [ref=e582] [cursor=pointer]
                      - generic [ref=e588]:
                        - generic [ref=e589]:
                          - generic [ref=e590]: Ouvre à
                          - textbox "Ouvre à" [ref=e592]: 19:00
                        - generic [ref=e593]:
                          - generic [ref=e594]: Ferme à
                          - textbox "Ferme à" [ref=e596]: 23:30
                        - button "Retirer la plage 2 du vendredi" [ref=e597] [cursor=pointer]
                      - generic [ref=e602]:
                        - button "Ajouter une plage" [ref=e603] [cursor=pointer]
                        - button "Copier les horaires du vendredi sur tous les jours" [ref=e607] [cursor=pointer]:
                          - generic [ref=e612]: Copier sur tous les jours
                  - listitem [ref=e613]:
                    - generic [ref=e615]:
                      - generic [ref=e616]:
                        - generic [ref=e617] [cursor=pointer]: Samedi
                        - paragraph [ref=e618]: 12 h à 15 h, 19 h à 23 h 30
                      - generic [ref=e619]:
                        - generic [aria-hidden] [ref=e620]: Activé
                        - switch "Samedi" [checked] [ref=e621] [cursor=pointer]
                    - generic [ref=e624]:
                      - generic [ref=e626]:
                        - generic [ref=e627]:
                          - generic [ref=e628]: Ouvre à
                          - textbox "Ouvre à" [ref=e630]: 12:00
                        - generic [ref=e631]:
                          - generic [ref=e632]: Ferme à
                          - textbox "Ferme à" [ref=e634]: 15:00
                        - button "Retirer la plage 1 du samedi" [ref=e635] [cursor=pointer]
                      - generic [ref=e641]:
                        - generic [ref=e642]:
                          - generic [ref=e643]: Ouvre à
                          - textbox "Ouvre à" [ref=e645]: 19:00
                        - generic [ref=e646]:
                          - generic [ref=e647]: Ferme à
                          - textbox "Ferme à" [ref=e649]: 23:30
                        - button "Retirer la plage 2 du samedi" [ref=e650] [cursor=pointer]
                      - generic [ref=e655]:
                        - button "Ajouter une plage" [ref=e656] [cursor=pointer]
                        - button "Copier les horaires du samedi sur tous les jours" [ref=e660] [cursor=pointer]:
                          - generic [ref=e665]: Copier sur tous les jours
                  - listitem [ref=e666]:
                    - generic [ref=e668]:
                      - generic [ref=e669]:
                        - generic [ref=e670] [cursor=pointer]: Dimanche
                        - paragraph [ref=e671]: 12 h à 15 h, 19 h à 23 h 30
                      - generic [ref=e672]:
                        - generic [aria-hidden] [ref=e673]: Activé
                        - switch "Dimanche" [checked] [ref=e674] [cursor=pointer]
                    - generic [ref=e677]:
                      - generic [ref=e679]:
                        - generic [ref=e680]:
                          - generic [ref=e681]: Ouvre à
                          - textbox "Ouvre à" [ref=e683]: 12:00
                        - generic [ref=e684]:
                          - generic [ref=e685]: Ferme à
                          - textbox "Ferme à" [ref=e687]: 15:00
                        - button "Retirer la plage 1 du dimanche" [ref=e688] [cursor=pointer]
                      - generic [ref=e694]:
                        - generic [ref=e695]:
                          - generic [ref=e696]: Ouvre à
                          - textbox "Ouvre à" [ref=e698]: 19:00
                        - generic [ref=e699]:
                          - generic [ref=e700]: Ferme à
                          - textbox "Ferme à" [ref=e702]: 23:30
                        - button "Retirer la plage 2 du dimanche" [ref=e703] [cursor=pointer]
                      - generic [ref=e708]:
                        - button "Ajouter une plage" [ref=e709] [cursor=pointer]
                        - button "Copier les horaires du dimanche sur tous les jours" [ref=e713] [cursor=pointer]:
                          - generic [ref=e718]: Copier sur tous les jours
              - region [ref=e719]:
                - generic [ref=e721]:
                  - generic [aria-hidden] [ref=e722]: "5"
                  - generic [ref=e723]:
                    - heading "Réglages des réservations" [level=2] [ref=e724]
                    - paragraph [ref=e725]: Comment une demande devient une table gardée.
                - group "Confirmation" [ref=e726]:
                  - generic [ref=e728]:
                    - generic [ref=e729] [cursor=pointer]:
                      - radio "Confirmation immédiate La table est gardée dès que le client réserve (et paie l’acompte s’il y en a un). Rien à faire de votre côté." [checked] [ref=e730]
                      - generic [ref=e731]:
                        - generic [ref=e732]: Confirmation immédiate
                        - generic [ref=e737]: La table est gardée dès que le client réserve (et paie l’acompte s’il y en a un). Rien à faire de votre côté.
                    - generic [ref=e738] [cursor=pointer]:
                      - radio "J’accepte chaque demande Vous avez 2 heures pour répondre à chaque demande. Sans réponse, elle est annulée et l’acompte rendu au client." [ref=e739]
                      - generic [ref=e740]:
                        - generic [ref=e741]: J’accepte chaque demande
                        - generic [ref=e748]: Vous avez 2 heures pour répondre à chaque demande. Sans réponse, elle est annulée et l’acompte rendu au client.
                - generic [ref=e749]:
                  - generic [ref=e750]:
                    - generic [ref=e751]: Acompte par personne (F CFA)
                    - textbox "Acompte par personne (F CFA)" [ref=e753]:
                      - /placeholder: Vide = réservation gratuite
                      - text: "5000"
                    - paragraph [ref=e754]: Facultatif, de 100 à 1 000 000 F CFA. Des frais de service de 5 % sont payés par le client en plus.
                  - generic [ref=e755]:
                    - generic [ref=e756]: Durée d’une réservation
                    - combobox "Durée d’une réservation" [ref=e759] [cursor=pointer]:
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
                    - paragraph [ref=e760]: Le temps pendant lequel la table est gardée pour un groupe.
                - paragraph [ref=e761]:
                  - generic [ref=e765]: "Avec un acompte, le client paie en réservant pour garder la table. Il est remboursé s’il annule au moins 2 h avant. Un client en retard de plus de 30 minutes peut être noté absent : la table est libérée."
              - generic [ref=e766]:
                - link "Annuler" [ref=e767] [cursor=pointer]:
                  - /url: /partner/tables/1bfb114d-b208-4e99-aa4d-dcaa33b505e2
                - button "Aucune modification" [disabled] [ref=e769]
            - region [ref=e776]:
              - generic [ref=e778]:
                - generic [aria-hidden] [ref=e779]: "6"
                - generic [ref=e780]:
                  - heading "Zones et tables" [level=2] [ref=e781]
                  - paragraph [ref=e782]: Chaque changement est enregistré tout de suite. Une table réservée se désactive au lieu d’être supprimée.
              - generic [ref=e783]:
                - generic [ref=e784]:
                  - generic [ref=e785]:
                    - heading "Zones" [level=3] [ref=e786]
                    - paragraph [ref=e787]: "Terrasse, salle, étage : le client peut choisir où s’asseoir."
                  - list [ref=e788]:
                    - listitem [ref=e789]:
                      - generic [ref=e790]:
                        - generic [ref=e791]:
                          - generic [ref=e792]: Nom de la zone
                          - textbox "Nom de la zone" [ref=e794]: Salle climatisée
                        - generic [ref=e795]:
                          - button "Désactiver la zone Salle climatisée" [ref=e796] [cursor=pointer]
                          - button "Supprimer la zone Salle climatisée" [ref=e803] [cursor=pointer]
                    - listitem [ref=e808]:
                      - generic [ref=e809]:
                        - generic [ref=e810]:
                          - generic [ref=e811]: Nom de la zone
                          - textbox "Nom de la zone" [ref=e813]: Terrasse
                        - generic [ref=e814]:
                          - button "Désactiver la zone Terrasse" [ref=e815] [cursor=pointer]
                          - button "Supprimer la zone Terrasse" [ref=e822] [cursor=pointer]
                  - generic [ref=e827]:
                    - generic [ref=e828]:
                      - generic [ref=e829]: Nouvelle zone
                      - textbox "Nouvelle zone" [ref=e831]:
                        - /placeholder: "Par exemple : Terrasse"
                    - button "Ajouter la zone" [ref=e832] [cursor=pointer]
                - generic [ref=e836]:
                  - generic [ref=e837]:
                    - heading "Tables" [level=3] [ref=e838]
                    - paragraph [ref=e839]: 8 tables proposées · 36 places
                  - list [ref=e845]:
                    - listitem [ref=e846]:
                      - generic [ref=e847]:
                        - generic [ref=e848]:
                          - generic [ref=e849]: Numéro
                          - textbox "Numéro" [ref=e851]: "1"
                        - generic [ref=e852]:
                          - generic [ref=e853]: Places
                          - textbox "Places" [ref=e855]: "2"
                        - generic [ref=e856]:
                          - generic [ref=e857]: Minimum
                          - textbox "Minimum" [ref=e859]:
                            - /placeholder: "1"
                        - generic [ref=e860]:
                          - generic [ref=e861]: Zone
                          - combobox "Zone" [ref=e864] [cursor=pointer]:
                            - option "Sans zone"
                            - option "Salle climatisée" [selected]
                            - option "Terrasse"
                        - generic [ref=e865]:
                          - button "Désactiver la table 1" [ref=e866] [cursor=pointer]
                          - button "Supprimer la table 1" [ref=e873] [cursor=pointer]
                    - listitem [ref=e878]:
                      - generic [ref=e879]:
                        - generic [ref=e880]:
                          - generic [ref=e881]: Numéro
                          - textbox "Numéro" [ref=e883]: "2"
                        - generic [ref=e884]:
                          - generic [ref=e885]: Places
                          - textbox "Places" [ref=e887]: "2"
                        - generic [ref=e888]:
                          - generic [ref=e889]: Minimum
                          - textbox "Minimum" [ref=e891]:
                            - /placeholder: "1"
                        - generic [ref=e892]:
                          - generic [ref=e893]: Zone
                          - combobox "Zone" [ref=e896] [cursor=pointer]:
                            - option "Sans zone"
                            - option "Salle climatisée" [selected]
                            - option "Terrasse"
                        - generic [ref=e897]:
                          - button "Désactiver la table 2" [ref=e898] [cursor=pointer]
                          - button "Supprimer la table 2" [ref=e905] [cursor=pointer]
                    - listitem [ref=e910]:
                      - generic [ref=e911]:
                        - generic [ref=e912]:
                          - generic [ref=e913]: Numéro
                          - textbox "Numéro" [ref=e915]: "3"
                        - generic [ref=e916]:
                          - generic [ref=e917]: Places
                          - textbox "Places" [ref=e919]: "4"
                        - generic [ref=e920]:
                          - generic [ref=e921]: Minimum
                          - textbox "Minimum" [ref=e923]:
                            - /placeholder: "1"
                            - text: "2"
                        - generic [ref=e924]:
                          - generic [ref=e925]: Zone
                          - combobox "Zone" [ref=e928] [cursor=pointer]:
                            - option "Sans zone"
                            - option "Salle climatisée" [selected]
                            - option "Terrasse"
                        - generic [ref=e929]:
                          - button "Désactiver la table 3" [ref=e930] [cursor=pointer]
                          - button "Supprimer la table 3" [ref=e937] [cursor=pointer]
                    - listitem [ref=e942]:
                      - generic [ref=e943]:
                        - generic [ref=e944]:
                          - generic [ref=e945]: Numéro
                          - textbox "Numéro" [ref=e947]: "4"
                        - generic [ref=e948]:
                          - generic [ref=e949]: Places
                          - textbox "Places" [ref=e951]: "4"
                        - generic [ref=e952]:
                          - generic [ref=e953]: Minimum
                          - textbox "Minimum" [ref=e955]:
                            - /placeholder: "1"
                            - text: "2"
                        - generic [ref=e956]:
                          - generic [ref=e957]: Zone
                          - combobox "Zone" [ref=e960] [cursor=pointer]:
                            - option "Sans zone"
                            - option "Salle climatisée" [selected]
                            - option "Terrasse"
                        - generic [ref=e961]:
                          - button "Désactiver la table 4" [ref=e962] [cursor=pointer]
                          - button "Supprimer la table 4" [ref=e969] [cursor=pointer]
                    - listitem [ref=e974]:
                      - generic [ref=e975]:
                        - generic [ref=e976]:
                          - generic [ref=e977]: Numéro
                          - textbox "Numéro" [ref=e979]: "5"
                        - generic [ref=e980]:
                          - generic [ref=e981]: Places
                          - textbox "Places" [ref=e983]: "6"
                        - generic [ref=e984]:
                          - generic [ref=e985]: Minimum
                          - textbox "Minimum" [ref=e987]:
                            - /placeholder: "1"
                            - text: "3"
                        - generic [ref=e988]:
                          - generic [ref=e989]: Zone
                          - combobox "Zone" [ref=e992] [cursor=pointer]:
                            - option "Sans zone"
                            - option "Salle climatisée" [selected]
                            - option "Terrasse"
                        - generic [ref=e993]:
                          - button "Désactiver la table 5" [ref=e994] [cursor=pointer]
                          - button "Supprimer la table 5" [ref=e1001] [cursor=pointer]
                    - listitem [ref=e1006]:
                      - generic [ref=e1007]:
                        - generic [ref=e1008]:
                          - generic [ref=e1009]: Numéro
                          - textbox "Numéro" [ref=e1011]: "6"
                        - generic [ref=e1012]:
                          - generic [ref=e1013]: Places
                          - textbox "Places" [ref=e1015]: "4"
                        - generic [ref=e1016]:
                          - generic [ref=e1017]: Minimum
                          - textbox "Minimum" [ref=e1019]:
                            - /placeholder: "1"
                            - text: "2"
                        - generic [ref=e1020]:
                          - generic [ref=e1021]: Zone
                          - combobox "Zone" [ref=e1024] [cursor=pointer]:
                            - option "Sans zone"
                            - option "Salle climatisée"
                            - option "Terrasse" [selected]
                        - generic [ref=e1025]:
                          - button "Désactiver la table 6" [ref=e1026] [cursor=pointer]
                          - button "Supprimer la table 6" [ref=e1033] [cursor=pointer]
                    - listitem [ref=e1038]:
                      - generic [ref=e1039]:
                        - generic [ref=e1040]:
                          - generic [ref=e1041]: Numéro
                          - textbox "Numéro" [ref=e1043]: "7"
                        - generic [ref=e1044]:
                          - generic [ref=e1045]: Places
                          - textbox "Places" [ref=e1047]: "6"
                        - generic [ref=e1048]:
                          - generic [ref=e1049]: Minimum
                          - textbox "Minimum" [ref=e1051]:
                            - /placeholder: "1"
                            - text: "3"
                        - generic [ref=e1052]:
                          - generic [ref=e1053]: Zone
                          - combobox "Zone" [ref=e1056] [cursor=pointer]:
                            - option "Sans zone"
                            - option "Salle climatisée"
                            - option "Terrasse" [selected]
                        - generic [ref=e1057]:
                          - button "Désactiver la table 7" [ref=e1058] [cursor=pointer]
                          - button "Supprimer la table 7" [ref=e1065] [cursor=pointer]
                    - listitem [ref=e1070]:
                      - generic [ref=e1071]:
                        - generic [ref=e1072]:
                          - generic [ref=e1073]: Numéro
                          - textbox "Numéro" [ref=e1075]: "8"
                        - generic [ref=e1076]:
                          - generic [ref=e1077]: Places
                          - textbox "Places" [ref=e1079]: "8"
                        - generic [ref=e1080]:
                          - generic [ref=e1081]: Minimum
                          - textbox "Minimum" [ref=e1083]:
                            - /placeholder: "1"
                            - text: "4"
                        - generic [ref=e1084]:
                          - generic [ref=e1085]: Zone
                          - combobox "Zone" [ref=e1088] [cursor=pointer]:
                            - option "Sans zone"
                            - option "Salle climatisée"
                            - option "Terrasse" [selected]
                        - generic [ref=e1089]:
                          - button "Désactiver la table 8" [ref=e1090] [cursor=pointer]
                          - button "Supprimer la table 8" [ref=e1097] [cursor=pointer]
                  - generic [ref=e1102]:
                    - heading "Ajouter une table" [level=4] [ref=e1103]
                    - generic [ref=e1104]:
                      - generic [ref=e1105]:
                        - generic [ref=e1106]: Numéro
                        - textbox "Numéro" [ref=e1108]:
                          - /placeholder: "9"
                      - generic [ref=e1109]:
                        - generic [ref=e1110]: Places
                        - textbox "Places" [ref=e1112]: "4"
                      - generic [ref=e1113]:
                        - generic [ref=e1114]: Minimum
                        - textbox "Minimum" [ref=e1116]:
                          - /placeholder: "1"
                      - generic [ref=e1117]:
                        - generic [ref=e1118]: Zone
                        - combobox "Zone" [ref=e1121] [cursor=pointer]:
                          - option "Sans zone" [selected]
                          - option "Salle climatisée"
                          - option "Terrasse"
                      - button "Ajouter" [ref=e1122] [cursor=pointer]
                    - generic [ref=e1126]:
                      - paragraph [ref=e1127]: Ajout rapide, numéros à la suite, dans la zone choisie ci-dessus
                      - generic [ref=e1133]:
                        - generic [ref=e1134]:
                          - generic [ref=e1135]: Tables
                          - textbox "Tables" [ref=e1137]: "5"
                        - generic [ref=e1138]:
                          - generic [ref=e1139]: Places chacune
                          - textbox "Places chacune" [ref=e1141]: "4"
                        - button "Ajouter 5 tables de 4" [ref=e1142] [cursor=pointer]
                      - paragraph [ref=e1146]
  - alert [ref=e1147]
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
      |                                                                   ^ Error: contrôles bloquants de org-tables-modification__ordinateur__sombre.png
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