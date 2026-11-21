# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · organisateur >> org-tables-modification — Établissement — modification d’un établissement validé (formulaire prérempli)
- Location: e2e/captures.spec.ts:193:9

# Error details

```
Error: contrôles bloquants de org-tables-modification__mobile__sombre.png

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
    - generic [ref=e3]:
      - banner [ref=e4]:
        - generic [ref=e5]:
          - button "Ouvrir le menu" [ref=e6] [cursor=pointer]
          - link "Event Village, accueil" [ref=e10] [cursor=pointer]:
            - /url: /
        - generic [ref=e13]:
          - button "Notifications, 37 non lues" [ref=e15] [cursor=pointer]:
            - generic [ref=e19]: "37"
          - button "Basculer le thème" [ref=e21] [cursor=pointer]
          - link "Mon profil (Mariama Ndiaye)" [ref=e25] [cursor=pointer]:
            - /url: /profile
            - generic [aria-hidden] [ref=e26]: MN
      - main [ref=e28]:
        - generic [ref=e30]:
          - generic [ref=e31]:
            - link "Retour à l’établissement" [ref=e33] [cursor=pointer]:
              - /url: /partner/tables/c4b57642-db5a-4206-93e0-1ef3dc232ba8
            - generic [ref=e39]:
              - generic [ref=e40]: Validé
              - heading "Modifier l’établissement" [level=1] [ref=e43]
              - paragraph [ref=e44]: La Terrasse du Plateau
          - generic [ref=e45]:
            - navigation "Autres réglages de l’établissement" [ref=e46]:
              - link "Plan de salle Montré aux clients" [ref=e47] [cursor=pointer]:
                - /url: /partner/tables/edition/c4b57642-db5a-4206-93e0-1ef3dc232ba8/plan
                - generic [ref=e54]:
                  - generic [ref=e55]: Plan de salle
                  - generic [ref=e56]: Montré aux clients
              - link "Fermetures exceptionnelles 1 à venir" [ref=e59] [cursor=pointer]:
                - /url: /partner/tables/edition/c4b57642-db5a-4206-93e0-1ef3dc232ba8/fermetures
                - generic [ref=e65]:
                  - generic [ref=e66]: Fermetures exceptionnelles
                  - generic [ref=e67]: 1 à venir
            - generic [ref=e70]:
              - status [ref=e71]:
                - generic [ref=e76]:
                  - paragraph [ref=e77]: "Cet établissement est validé : il reste visible pendant vos modifications."
                  - generic [ref=e78]: Les réservations déjà faites gardent leur heure, leur table et leurs montants.
              - region [ref=e79]:
                - generic [ref=e81]:
                  - generic [aria-hidden] [ref=e82]: "1"
                  - generic [ref=e83]:
                    - heading "L’établissement" [level=2] [ref=e84]
                    - paragraph [ref=e85]: Ce que les clients voient en premier.
                - group "Genre" [ref=e86]:
                  - generic [ref=e88]:
                    - generic [ref=e89] [cursor=pointer]:
                      - radio "Restaurant Repas assis, déjeuner ou dîner." [checked] [ref=e90]
                      - generic [ref=e91]:
                        - generic [ref=e92]: Restaurant
                        - generic [ref=e99]: Repas assis, déjeuner ou dîner.
                    - generic [ref=e100] [cursor=pointer]:
                      - radio "Bar Lounge, bar, rooftop, club." [ref=e101]
                      - generic [ref=e102]:
                        - generic [ref=e103]: Bar
                        - generic [ref=e107]: Lounge, bar, rooftop, club.
                    - generic [ref=e108] [cursor=pointer]:
                      - radio "Espace Terrasse, plage, espace privatisable." [ref=e109]
                      - generic [ref=e110]:
                        - generic [ref=e111]: Espace
                        - generic [ref=e116]: Terrasse, plage, espace privatisable.
                - generic [ref=e117]:
                  - generic [ref=e119]:
                    - text: Nom*
                    - generic [ref=e120]: (obligatoire)
                  - textbox "Nom (obligatoire)" [ref=e121]:
                    - /placeholder: "Par exemple : Le Lagon 1"
                    - text: La Terrasse du Plateau
                - generic [ref=e122]:
                  - generic [ref=e123]:
                    - generic [ref=e124]: Description
                    - generic [ref=e125]: 180 / 2000
                  - textbox "Description" [ref=e126]:
                    - /placeholder: Cuisine, ambiance, musique, tenue, ce qui vous rend unique…
                    - text: "Cuisine sénégalaise et grillades de la mer au cœur du Plateau : thiéboudiène le midi, poissons braisés le soir. Salle climatisée et terrasse ombragée ; menus de groupe sur demande."
              - region [ref=e127]:
                - generic [ref=e129]:
                  - generic [aria-hidden] [ref=e130]: "2"
                  - generic [ref=e131]:
                    - heading "Adresse et position" [level=2] [ref=e132]
                    - paragraph [ref=e133]: Pour que les clients vous trouvent.
                - generic [ref=e134]:
                  - generic [ref=e135]:
                    - generic [ref=e137]:
                      - text: Adresse*
                      - generic [ref=e138]: (obligatoire)
                    - textbox "Adresse (obligatoire)" [ref=e139]:
                      - /placeholder: Rue, quartier, point de repère
                      - text: 8, rue Carnot, Dakar-Plateau
                  - generic [ref=e140]:
                    - generic [ref=e142]:
                      - text: Ville*
                      - generic [ref=e143]: (obligatoire)
                    - combobox "Ville (obligatoire)" [ref=e145] [cursor=pointer]:
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
                - group "Position sur la carte (conseillée)" [ref=e146]:
                  - paragraph [ref=e148]: "Placez le repère sur l’entrée : la carte s’affiche sur votre fiche."
                  - generic [ref=e149]:
                    - search "Rechercher un lieu" [ref=e150]:
                      - generic [ref=e151]:
                        - generic [ref=e152]:
                          - generic [ref=e153]: Rechercher un lieu
                          - textbox "Rechercher un lieu" [ref=e155]:
                            - /placeholder: "Par exemple : Grand Théâtre, Dakar"
                        - button "Rechercher" [ref=e156] [cursor=pointer]
                      - generic [ref=e162]: "Lieux : © contributeurs OpenStreetMap"
                    - generic [ref=e164]:
                      - paragraph [ref=e165]: Touchez la carte pour placer le repère à l’entrée du lieu. Un doigt fait défiler la page ; deux doigts, ou « Déplacer la carte », déplacent la carte.
                      - button "Ma position" [ref=e166] [cursor=pointer]
                    - generic [ref=e172]:
                      - region "Carte du lieu" [ref=e173]:
                        - img "Repère de la position du lieu" [ref=e174] [cursor=pointer]
                        - generic:
                          - generic [ref=e175]:
                            - button "Zoom avant" [ref=e176] [cursor=pointer]: +
                            - button "Zoom arrière" [ref=e177] [cursor=pointer]: −
                          - generic: © contributeurs OpenStreetMap
                      - button "Déplacer la carte" [ref=e179] [cursor=pointer]
                    - generic [ref=e187]:
                      - generic [ref=e188]:
                        - generic [ref=e189]: Latitude
                        - textbox "Latitude" [ref=e191]:
                          - /placeholder: "Par exemple : 14.6937"
                          - text: "14.6681"
                      - generic [ref=e192]:
                        - generic [ref=e193]: Longitude
                        - textbox "Longitude" [ref=e195]:
                          - /placeholder: "Par exemple : -17.4441"
                          - text: "-17.4335"
                    - status [ref=e196]:
                      - generic [ref=e200]: Position choisie
              - region [ref=e201]:
                - generic [ref=e203]:
                  - generic [aria-hidden] [ref=e204]: "3"
                  - generic [ref=e205]:
                    - heading "Photos" [level=2] [ref=e206]
                    - paragraph [ref=e207]: "De 1 à 12 photos. La première est la couverture, montrée dans la recherche. Photos : 2 sur 12."
                - generic [ref=e208]:
                  - list "Photos de l’établissement, dans l’ordre d’affichage" [ref=e209]:
                    - listitem [ref=e210]:
                      - generic [ref=e211]:
                        - img "Photo de couverture de l’établissement" [ref=e212]
                        - generic [ref=e213]: Couverture
                      - generic [ref=e214]:
                        - generic [ref=e215]: "1"
                        - generic [ref=e216]:
                          - button "Placer la photo 1 avant" [disabled] [ref=e217]
                          - button "Placer la photo 1 après" [ref=e221] [cursor=pointer]
                          - button "Retirer la photo 1" [ref=e225] [cursor=pointer]
                    - listitem [ref=e230]:
                      - img "Photo 2 de l’établissement" [ref=e232]
                      - generic [ref=e233]:
                        - generic [ref=e234]: "2"
                        - generic [ref=e235]:
                          - button "Placer la photo 2 avant" [ref=e236] [cursor=pointer]
                          - button "Placer la photo 2 après" [disabled] [ref=e240]
                          - button "Retirer la photo 2" [ref=e244] [cursor=pointer]
                  - paragraph [ref=e249]
                  - generic [ref=e250]:
                    - generic [ref=e251]: Ajouter une autre photo
                    - button "Ajouter une autre photo" [ref=e252]
                    - generic [ref=e253] [cursor=pointer]: Choisir une image ou la déposer ici
                    - paragraph [ref=e260]: JPEG, PNG ou WebP, 5 Mo au plus. Une photo à la fois ; la salle, la terrasse, une table dressée, un plat.
              - region [ref=e261]:
                - generic [ref=e263]:
                  - generic [aria-hidden] [ref=e264]: "4"
                  - generic [ref=e265]:
                    - heading "Horaires" [level=2] [ref=e266]
                    - paragraph [ref=e267]: "Jour par jour, jusqu’à 4 plages. Une plage peut finir après minuit : le client réserve jusqu’à la fermeture moins la durée d’une réservation."
                - list [ref=e270]:
                  - listitem [ref=e271]:
                    - generic [ref=e273]:
                      - generic [ref=e274]:
                        - generic [ref=e275] [cursor=pointer]: Lundi
                        - paragraph [ref=e276]: 12 h à 15 h, 19 h à 23 h 30
                      - generic [ref=e277]:
                        - generic [aria-hidden] [ref=e278]: Activé
                        - switch "Lundi" [checked] [ref=e279] [cursor=pointer]
                    - generic [ref=e282]:
                      - generic [ref=e284]:
                        - generic [ref=e285]:
                          - generic [ref=e286]: Ouvre à
                          - textbox "Ouvre à" [ref=e288]: 12:00
                        - generic [ref=e289]:
                          - generic [ref=e290]: Ferme à
                          - textbox "Ferme à" [ref=e292]: 15:00
                        - button "Retirer la plage 1 du lundi" [ref=e293] [cursor=pointer]
                      - generic [ref=e299]:
                        - generic [ref=e300]:
                          - generic [ref=e301]: Ouvre à
                          - textbox "Ouvre à" [ref=e303]: 19:00
                        - generic [ref=e304]:
                          - generic [ref=e305]: Ferme à
                          - textbox "Ferme à" [ref=e307]: 23:30
                        - button "Retirer la plage 2 du lundi" [ref=e308] [cursor=pointer]
                      - generic [ref=e313]:
                        - button "Ajouter une plage" [ref=e314] [cursor=pointer]
                        - button "Copier les horaires du lundi sur tous les jours" [ref=e318] [cursor=pointer]:
                          - generic [ref=e323]: Copier sur tous les jours
                  - listitem [ref=e324]:
                    - generic [ref=e326]:
                      - generic [ref=e327]:
                        - generic [ref=e328] [cursor=pointer]: Mardi
                        - paragraph [ref=e329]: 12 h à 15 h, 19 h à 23 h 30
                      - generic [ref=e330]:
                        - generic [aria-hidden] [ref=e331]: Activé
                        - switch "Mardi" [checked] [ref=e332] [cursor=pointer]
                    - generic [ref=e335]:
                      - generic [ref=e337]:
                        - generic [ref=e338]:
                          - generic [ref=e339]: Ouvre à
                          - textbox "Ouvre à" [ref=e341]: 12:00
                        - generic [ref=e342]:
                          - generic [ref=e343]: Ferme à
                          - textbox "Ferme à" [ref=e345]: 15:00
                        - button "Retirer la plage 1 du mardi" [ref=e346] [cursor=pointer]
                      - generic [ref=e352]:
                        - generic [ref=e353]:
                          - generic [ref=e354]: Ouvre à
                          - textbox "Ouvre à" [ref=e356]: 19:00
                        - generic [ref=e357]:
                          - generic [ref=e358]: Ferme à
                          - textbox "Ferme à" [ref=e360]: 23:30
                        - button "Retirer la plage 2 du mardi" [ref=e361] [cursor=pointer]
                      - generic [ref=e366]:
                        - button "Ajouter une plage" [ref=e367] [cursor=pointer]
                        - button "Copier les horaires du mardi sur tous les jours" [ref=e371] [cursor=pointer]:
                          - generic [ref=e376]: Copier sur tous les jours
                  - listitem [ref=e377]:
                    - generic [ref=e379]:
                      - generic [ref=e380]:
                        - generic [ref=e381] [cursor=pointer]: Mercredi
                        - paragraph [ref=e382]: 12 h à 15 h, 19 h à 23 h 30
                      - generic [ref=e383]:
                        - generic [aria-hidden] [ref=e384]: Activé
                        - switch "Mercredi" [checked] [ref=e385] [cursor=pointer]
                    - generic [ref=e388]:
                      - generic [ref=e390]:
                        - generic [ref=e391]:
                          - generic [ref=e392]: Ouvre à
                          - textbox "Ouvre à" [ref=e394]: 12:00
                        - generic [ref=e395]:
                          - generic [ref=e396]: Ferme à
                          - textbox "Ferme à" [ref=e398]: 15:00
                        - button "Retirer la plage 1 du mercredi" [ref=e399] [cursor=pointer]
                      - generic [ref=e405]:
                        - generic [ref=e406]:
                          - generic [ref=e407]: Ouvre à
                          - textbox "Ouvre à" [ref=e409]: 19:00
                        - generic [ref=e410]:
                          - generic [ref=e411]: Ferme à
                          - textbox "Ferme à" [ref=e413]: 23:30
                        - button "Retirer la plage 2 du mercredi" [ref=e414] [cursor=pointer]
                      - generic [ref=e419]:
                        - button "Ajouter une plage" [ref=e420] [cursor=pointer]
                        - button "Copier les horaires du mercredi sur tous les jours" [ref=e424] [cursor=pointer]:
                          - generic [ref=e429]: Copier sur tous les jours
                  - listitem [ref=e430]:
                    - generic [ref=e432]:
                      - generic [ref=e433]:
                        - generic [ref=e434] [cursor=pointer]: Jeudi
                        - paragraph [ref=e435]: 12 h à 15 h, 19 h à 23 h 30
                      - generic [ref=e436]:
                        - generic [aria-hidden] [ref=e437]: Activé
                        - switch "Jeudi" [checked] [ref=e438] [cursor=pointer]
                    - generic [ref=e441]:
                      - generic [ref=e443]:
                        - generic [ref=e444]:
                          - generic [ref=e445]: Ouvre à
                          - textbox "Ouvre à" [ref=e447]: 12:00
                        - generic [ref=e448]:
                          - generic [ref=e449]: Ferme à
                          - textbox "Ferme à" [ref=e451]: 15:00
                        - button "Retirer la plage 1 du jeudi" [ref=e452] [cursor=pointer]
                      - generic [ref=e458]:
                        - generic [ref=e459]:
                          - generic [ref=e460]: Ouvre à
                          - textbox "Ouvre à" [ref=e462]: 19:00
                        - generic [ref=e463]:
                          - generic [ref=e464]: Ferme à
                          - textbox "Ferme à" [ref=e466]: 23:30
                        - button "Retirer la plage 2 du jeudi" [ref=e467] [cursor=pointer]
                      - generic [ref=e472]:
                        - button "Ajouter une plage" [ref=e473] [cursor=pointer]
                        - button "Copier les horaires du jeudi sur tous les jours" [ref=e477] [cursor=pointer]:
                          - generic [ref=e482]: Copier sur tous les jours
                  - listitem [ref=e483]:
                    - generic [ref=e485]:
                      - generic [ref=e486]:
                        - generic [ref=e487] [cursor=pointer]: Vendredi
                        - paragraph [ref=e488]: 12 h à 15 h, 19 h à 23 h 30
                      - generic [ref=e489]:
                        - generic [aria-hidden] [ref=e490]: Activé
                        - switch "Vendredi" [checked] [ref=e491] [cursor=pointer]
                    - generic [ref=e494]:
                      - generic [ref=e496]:
                        - generic [ref=e497]:
                          - generic [ref=e498]: Ouvre à
                          - textbox "Ouvre à" [ref=e500]: 12:00
                        - generic [ref=e501]:
                          - generic [ref=e502]: Ferme à
                          - textbox "Ferme à" [ref=e504]: 15:00
                        - button "Retirer la plage 1 du vendredi" [ref=e505] [cursor=pointer]
                      - generic [ref=e511]:
                        - generic [ref=e512]:
                          - generic [ref=e513]: Ouvre à
                          - textbox "Ouvre à" [ref=e515]: 19:00
                        - generic [ref=e516]:
                          - generic [ref=e517]: Ferme à
                          - textbox "Ferme à" [ref=e519]: 23:30
                        - button "Retirer la plage 2 du vendredi" [ref=e520] [cursor=pointer]
                      - generic [ref=e525]:
                        - button "Ajouter une plage" [ref=e526] [cursor=pointer]
                        - button "Copier les horaires du vendredi sur tous les jours" [ref=e530] [cursor=pointer]:
                          - generic [ref=e535]: Copier sur tous les jours
                  - listitem [ref=e536]:
                    - generic [ref=e538]:
                      - generic [ref=e539]:
                        - generic [ref=e540] [cursor=pointer]: Samedi
                        - paragraph [ref=e541]: 12 h à 15 h, 19 h à 23 h 30
                      - generic [ref=e542]:
                        - generic [aria-hidden] [ref=e543]: Activé
                        - switch "Samedi" [checked] [ref=e544] [cursor=pointer]
                    - generic [ref=e547]:
                      - generic [ref=e549]:
                        - generic [ref=e550]:
                          - generic [ref=e551]: Ouvre à
                          - textbox "Ouvre à" [ref=e553]: 12:00
                        - generic [ref=e554]:
                          - generic [ref=e555]: Ferme à
                          - textbox "Ferme à" [ref=e557]: 15:00
                        - button "Retirer la plage 1 du samedi" [ref=e558] [cursor=pointer]
                      - generic [ref=e564]:
                        - generic [ref=e565]:
                          - generic [ref=e566]: Ouvre à
                          - textbox "Ouvre à" [ref=e568]: 19:00
                        - generic [ref=e569]:
                          - generic [ref=e570]: Ferme à
                          - textbox "Ferme à" [ref=e572]: 23:30
                        - button "Retirer la plage 2 du samedi" [ref=e573] [cursor=pointer]
                      - generic [ref=e578]:
                        - button "Ajouter une plage" [ref=e579] [cursor=pointer]
                        - button "Copier les horaires du samedi sur tous les jours" [ref=e583] [cursor=pointer]:
                          - generic [ref=e588]: Copier sur tous les jours
                  - listitem [ref=e589]:
                    - generic [ref=e591]:
                      - generic [ref=e592]:
                        - generic [ref=e593] [cursor=pointer]: Dimanche
                        - paragraph [ref=e594]: 12 h à 15 h, 19 h à 23 h 30
                      - generic [ref=e595]:
                        - generic [aria-hidden] [ref=e596]: Activé
                        - switch "Dimanche" [checked] [ref=e597] [cursor=pointer]
                    - generic [ref=e600]:
                      - generic [ref=e602]:
                        - generic [ref=e603]:
                          - generic [ref=e604]: Ouvre à
                          - textbox "Ouvre à" [ref=e606]: 12:00
                        - generic [ref=e607]:
                          - generic [ref=e608]: Ferme à
                          - textbox "Ferme à" [ref=e610]: 15:00
                        - button "Retirer la plage 1 du dimanche" [ref=e611] [cursor=pointer]
                      - generic [ref=e617]:
                        - generic [ref=e618]:
                          - generic [ref=e619]: Ouvre à
                          - textbox "Ouvre à" [ref=e621]: 19:00
                        - generic [ref=e622]:
                          - generic [ref=e623]: Ferme à
                          - textbox "Ferme à" [ref=e625]: 23:30
                        - button "Retirer la plage 2 du dimanche" [ref=e626] [cursor=pointer]
                      - generic [ref=e631]:
                        - button "Ajouter une plage" [ref=e632] [cursor=pointer]
                        - button "Copier les horaires du dimanche sur tous les jours" [ref=e636] [cursor=pointer]:
                          - generic [ref=e641]: Copier sur tous les jours
              - region [ref=e642]:
                - generic [ref=e644]:
                  - generic [aria-hidden] [ref=e645]: "5"
                  - generic [ref=e646]:
                    - heading "Réglages des réservations" [level=2] [ref=e647]
                    - paragraph [ref=e648]: Comment une demande devient une table gardée.
                - group "Confirmation" [ref=e649]:
                  - generic [ref=e651]:
                    - generic [ref=e652] [cursor=pointer]:
                      - radio "Confirmation immédiate La table est gardée dès que le client réserve (et paie l’acompte s’il y en a un). Rien à faire de votre côté." [checked] [ref=e653]
                      - generic [ref=e654]:
                        - generic [ref=e655]: Confirmation immédiate
                        - generic [ref=e660]: La table est gardée dès que le client réserve (et paie l’acompte s’il y en a un). Rien à faire de votre côté.
                    - generic [ref=e661] [cursor=pointer]:
                      - radio "J’accepte chaque demande Vous avez 2 heures pour répondre à chaque demande. Sans réponse, elle est annulée et l’acompte rendu au client." [ref=e662]
                      - generic [ref=e663]:
                        - generic [ref=e664]: J’accepte chaque demande
                        - generic [ref=e671]: Vous avez 2 heures pour répondre à chaque demande. Sans réponse, elle est annulée et l’acompte rendu au client.
                - generic [ref=e672]:
                  - generic [ref=e673]:
                    - generic [ref=e674]: Acompte par personne (F CFA)
                    - textbox "Acompte par personne (F CFA)" [ref=e676]:
                      - /placeholder: Vide = réservation gratuite
                      - text: "5000"
                    - paragraph [ref=e677]: Facultatif, de 100 à 1 000 000 F CFA. Des frais de service de 5 % sont payés par le client en plus.
                  - generic [ref=e678]:
                    - generic [ref=e679]: Durée d’une réservation
                    - combobox "Durée d’une réservation" [ref=e682] [cursor=pointer]:
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
                    - paragraph [ref=e683]: Le temps pendant lequel la table est gardée pour un groupe.
                - paragraph [ref=e684]:
                  - generic [ref=e688]: "Avec un acompte, le client paie en réservant pour garder la table. Il est remboursé s’il annule au moins 2 h avant. Un client en retard de plus de 30 minutes peut être noté absent : la table est libérée."
              - generic [ref=e689]:
                - link "Annuler" [ref=e690] [cursor=pointer]:
                  - /url: /partner/tables/c4b57642-db5a-4206-93e0-1ef3dc232ba8
                - button "Aucune modification" [disabled] [ref=e692]
            - region [ref=e699]:
              - generic [ref=e701]:
                - generic [aria-hidden] [ref=e702]: "6"
                - generic [ref=e703]:
                  - heading "Zones et tables" [level=2] [ref=e704]
                  - paragraph [ref=e705]: Chaque changement est enregistré tout de suite. Une table réservée se désactive au lieu d’être supprimée.
              - generic [ref=e706]:
                - generic [ref=e707]:
                  - generic [ref=e708]:
                    - heading "Zones" [level=3] [ref=e709]
                    - paragraph [ref=e710]: "Terrasse, salle, étage : le client peut choisir où s’asseoir."
                  - list [ref=e711]:
                    - listitem [ref=e712]:
                      - generic [ref=e713]:
                        - generic [ref=e714]:
                          - generic [ref=e715]: Nom de la zone
                          - textbox "Nom de la zone" [ref=e717]: Salle climatisée
                        - generic [ref=e718]:
                          - button "Désactiver la zone Salle climatisée" [ref=e719] [cursor=pointer]
                          - button "Supprimer la zone Salle climatisée" [ref=e726] [cursor=pointer]
                    - listitem [ref=e731]:
                      - generic [ref=e732]:
                        - generic [ref=e733]:
                          - generic [ref=e734]: Nom de la zone
                          - textbox "Nom de la zone" [ref=e736]: Terrasse
                        - generic [ref=e737]:
                          - button "Désactiver la zone Terrasse" [ref=e738] [cursor=pointer]
                          - button "Supprimer la zone Terrasse" [ref=e745] [cursor=pointer]
                  - generic [ref=e750]:
                    - generic [ref=e751]:
                      - generic [ref=e752]: Nouvelle zone
                      - textbox "Nouvelle zone" [ref=e754]:
                        - /placeholder: "Par exemple : Terrasse"
                    - button "Ajouter la zone" [ref=e755] [cursor=pointer]
                - generic [ref=e759]:
                  - generic [ref=e760]:
                    - heading "Tables" [level=3] [ref=e761]
                    - paragraph [ref=e762]: 8 tables proposées · 36 places
                  - list [ref=e768]:
                    - listitem [ref=e769]:
                      - generic [ref=e770]:
                        - generic [ref=e771]:
                          - generic [ref=e772]: Numéro
                          - textbox "Numéro" [ref=e774]: "1"
                        - generic [ref=e775]:
                          - generic [ref=e776]: Places
                          - textbox "Places" [ref=e778]: "2"
                        - generic [ref=e779]:
                          - generic [ref=e780]: Minimum
                          - textbox "Minimum" [ref=e782]:
                            - /placeholder: "1"
                        - generic [ref=e783]:
                          - generic [ref=e784]: Zone
                          - combobox "Zone" [ref=e787] [cursor=pointer]:
                            - option "Sans zone"
                            - option "Salle climatisée" [selected]
                            - option "Terrasse"
                        - generic [ref=e788]:
                          - button "Désactiver la table 1" [ref=e789] [cursor=pointer]
                          - button "Supprimer la table 1" [ref=e796] [cursor=pointer]
                    - listitem [ref=e801]:
                      - generic [ref=e802]:
                        - generic [ref=e803]:
                          - generic [ref=e804]: Numéro
                          - textbox "Numéro" [ref=e806]: "2"
                        - generic [ref=e807]:
                          - generic [ref=e808]: Places
                          - textbox "Places" [ref=e810]: "2"
                        - generic [ref=e811]:
                          - generic [ref=e812]: Minimum
                          - textbox "Minimum" [ref=e814]:
                            - /placeholder: "1"
                        - generic [ref=e815]:
                          - generic [ref=e816]: Zone
                          - combobox "Zone" [ref=e819] [cursor=pointer]:
                            - option "Sans zone"
                            - option "Salle climatisée" [selected]
                            - option "Terrasse"
                        - generic [ref=e820]:
                          - button "Désactiver la table 2" [ref=e821] [cursor=pointer]
                          - button "Supprimer la table 2" [ref=e828] [cursor=pointer]
                    - listitem [ref=e833]:
                      - generic [ref=e834]:
                        - generic [ref=e835]:
                          - generic [ref=e836]: Numéro
                          - textbox "Numéro" [ref=e838]: "3"
                        - generic [ref=e839]:
                          - generic [ref=e840]: Places
                          - textbox "Places" [ref=e842]: "4"
                        - generic [ref=e843]:
                          - generic [ref=e844]: Minimum
                          - textbox "Minimum" [ref=e846]:
                            - /placeholder: "1"
                            - text: "2"
                        - generic [ref=e847]:
                          - generic [ref=e848]: Zone
                          - combobox "Zone" [ref=e851] [cursor=pointer]:
                            - option "Sans zone"
                            - option "Salle climatisée" [selected]
                            - option "Terrasse"
                        - generic [ref=e852]:
                          - button "Désactiver la table 3" [ref=e853] [cursor=pointer]
                          - button "Supprimer la table 3" [ref=e860] [cursor=pointer]
                    - listitem [ref=e865]:
                      - generic [ref=e866]:
                        - generic [ref=e867]:
                          - generic [ref=e868]: Numéro
                          - textbox "Numéro" [ref=e870]: "4"
                        - generic [ref=e871]:
                          - generic [ref=e872]: Places
                          - textbox "Places" [ref=e874]: "4"
                        - generic [ref=e875]:
                          - generic [ref=e876]: Minimum
                          - textbox "Minimum" [ref=e878]:
                            - /placeholder: "1"
                            - text: "2"
                        - generic [ref=e879]:
                          - generic [ref=e880]: Zone
                          - combobox "Zone" [ref=e883] [cursor=pointer]:
                            - option "Sans zone"
                            - option "Salle climatisée" [selected]
                            - option "Terrasse"
                        - generic [ref=e884]:
                          - button "Désactiver la table 4" [ref=e885] [cursor=pointer]
                          - button "Supprimer la table 4" [ref=e892] [cursor=pointer]
                    - listitem [ref=e897]:
                      - generic [ref=e898]:
                        - generic [ref=e899]:
                          - generic [ref=e900]: Numéro
                          - textbox "Numéro" [ref=e902]: "5"
                        - generic [ref=e903]:
                          - generic [ref=e904]: Places
                          - textbox "Places" [ref=e906]: "6"
                        - generic [ref=e907]:
                          - generic [ref=e908]: Minimum
                          - textbox "Minimum" [ref=e910]:
                            - /placeholder: "1"
                            - text: "3"
                        - generic [ref=e911]:
                          - generic [ref=e912]: Zone
                          - combobox "Zone" [ref=e915] [cursor=pointer]:
                            - option "Sans zone"
                            - option "Salle climatisée" [selected]
                            - option "Terrasse"
                        - generic [ref=e916]:
                          - button "Désactiver la table 5" [ref=e917] [cursor=pointer]
                          - button "Supprimer la table 5" [ref=e924] [cursor=pointer]
                    - listitem [ref=e929]:
                      - generic [ref=e930]:
                        - generic [ref=e931]:
                          - generic [ref=e932]: Numéro
                          - textbox "Numéro" [ref=e934]: "6"
                        - generic [ref=e935]:
                          - generic [ref=e936]: Places
                          - textbox "Places" [ref=e938]: "4"
                        - generic [ref=e939]:
                          - generic [ref=e940]: Minimum
                          - textbox "Minimum" [ref=e942]:
                            - /placeholder: "1"
                            - text: "2"
                        - generic [ref=e943]:
                          - generic [ref=e944]: Zone
                          - combobox "Zone" [ref=e947] [cursor=pointer]:
                            - option "Sans zone"
                            - option "Salle climatisée"
                            - option "Terrasse" [selected]
                        - generic [ref=e948]:
                          - button "Désactiver la table 6" [ref=e949] [cursor=pointer]
                          - button "Supprimer la table 6" [ref=e956] [cursor=pointer]
                    - listitem [ref=e961]:
                      - generic [ref=e962]:
                        - generic [ref=e963]:
                          - generic [ref=e964]: Numéro
                          - textbox "Numéro" [ref=e966]: "7"
                        - generic [ref=e967]:
                          - generic [ref=e968]: Places
                          - textbox "Places" [ref=e970]: "6"
                        - generic [ref=e971]:
                          - generic [ref=e972]: Minimum
                          - textbox "Minimum" [ref=e974]:
                            - /placeholder: "1"
                            - text: "3"
                        - generic [ref=e975]:
                          - generic [ref=e976]: Zone
                          - combobox "Zone" [ref=e979] [cursor=pointer]:
                            - option "Sans zone"
                            - option "Salle climatisée"
                            - option "Terrasse" [selected]
                        - generic [ref=e980]:
                          - button "Désactiver la table 7" [ref=e981] [cursor=pointer]
                          - button "Supprimer la table 7" [ref=e988] [cursor=pointer]
                    - listitem [ref=e993]:
                      - generic [ref=e994]:
                        - generic [ref=e995]:
                          - generic [ref=e996]: Numéro
                          - textbox "Numéro" [ref=e998]: "8"
                        - generic [ref=e999]:
                          - generic [ref=e1000]: Places
                          - textbox "Places" [ref=e1002]: "8"
                        - generic [ref=e1003]:
                          - generic [ref=e1004]: Minimum
                          - textbox "Minimum" [ref=e1006]:
                            - /placeholder: "1"
                            - text: "4"
                        - generic [ref=e1007]:
                          - generic [ref=e1008]: Zone
                          - combobox "Zone" [ref=e1011] [cursor=pointer]:
                            - option "Sans zone"
                            - option "Salle climatisée"
                            - option "Terrasse" [selected]
                        - generic [ref=e1012]:
                          - button "Désactiver la table 8" [ref=e1013] [cursor=pointer]
                          - button "Supprimer la table 8" [ref=e1020] [cursor=pointer]
                  - generic [ref=e1025]:
                    - heading "Ajouter une table" [level=4] [ref=e1026]
                    - generic [ref=e1027]:
                      - generic [ref=e1028]:
                        - generic [ref=e1029]: Numéro
                        - textbox "Numéro" [ref=e1031]:
                          - /placeholder: "9"
                      - generic [ref=e1032]:
                        - generic [ref=e1033]: Places
                        - textbox "Places" [ref=e1035]: "4"
                      - generic [ref=e1036]:
                        - generic [ref=e1037]: Minimum
                        - textbox "Minimum" [ref=e1039]:
                          - /placeholder: "1"
                      - generic [ref=e1040]:
                        - generic [ref=e1041]: Zone
                        - combobox "Zone" [ref=e1044] [cursor=pointer]:
                          - option "Sans zone" [selected]
                          - option "Salle climatisée"
                          - option "Terrasse"
                      - button "Ajouter" [ref=e1045] [cursor=pointer]
                    - generic [ref=e1049]:
                      - paragraph [ref=e1050]: Ajout rapide, numéros à la suite, dans la zone choisie ci-dessus
                      - generic [ref=e1056]:
                        - generic [ref=e1057]:
                          - generic [ref=e1058]: Tables
                          - textbox "Tables" [ref=e1060]: "5"
                        - generic [ref=e1061]:
                          - generic [ref=e1062]: Places chacune
                          - textbox "Places chacune" [ref=e1064]: "4"
                        - button "Ajouter 5 tables de 4" [ref=e1065] [cursor=pointer]
                      - paragraph [ref=e1069]
    - navigation "Navigation rapide" [ref=e1070]:
      - generic [ref=e1071]:
        - link "Accueil" [ref=e1072] [cursor=pointer]:
          - /url: /partner/dashboard
        - link "Billetterie" [ref=e1079] [cursor=pointer]:
          - /url: /partner/events
        - link "Scanner" [ref=e1083] [cursor=pointer]:
          - /url: /partner/scan
        - link "Finances" [ref=e1091] [cursor=pointer]:
          - /url: /partner/finance
        - link "Profil" [ref=e1095] [cursor=pointer]:
          - /url: /partner/profile
  - alert [ref=e1100]
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
      |                                                                   ^ Error: contrôles bloquants de org-tables-modification__mobile__sombre.png
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