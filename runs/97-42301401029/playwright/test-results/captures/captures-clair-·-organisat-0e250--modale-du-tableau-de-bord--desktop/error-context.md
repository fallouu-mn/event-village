# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> clair · organisateur >> partenaire-rapport-cloture — Rapport de clôture d’un événement terminé (modale du tableau de bord)
- Location: e2e/captures.spec.ts:159:9

# Error details

```
Error: contrôles bloquants de partenaire-rapport-cloture__ordinateur__clair.png

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 4

- Array []
+ Array [
+   "valeur technique affichée : CLOTURE — ex. texte : « CLOTURE-75E7B0BC-20261106 »",
+   "axe-core scrollable-region-focusable (serious, 1 nœud(s)) : Scrollable region must have keyboard access",
+ ]
```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e2]:
    - complementary [ref=e3]:
      - link "Event Village, accueil" [ref=e5] [cursor=pointer]:
        - /url: /
        - generic [ref=e11]:
          - generic [ref=e12]: EVENT
          - generic [ref=e13]: VILLAGE
      - navigation "Navigation principale" [ref=e14]:
        - generic [ref=e15]:
          - paragraph [ref=e16]: Gestion
          - generic [ref=e17]:
            - link "Tableau de bord" [ref=e18] [cursor=pointer]:
              - /url: /partner/dashboard
            - link "Événements" [ref=e25] [cursor=pointer]:
              - /url: /partner/events
            - link "Équipe" [ref=e29] [cursor=pointer]:
              - /url: /partner/team
        - generic [ref=e36]:
          - paragraph [ref=e37]: Outils
          - generic [ref=e38]:
            - link "Finances" [ref=e39] [cursor=pointer]:
              - /url: /partner/finance
            - link "Statistiques" [ref=e43] [cursor=pointer]:
              - /url: /partner/stats
            - link "Scanner les billets" [ref=e47] [cursor=pointer]:
              - /url: /partner/scan
            - link "Calendrier" [ref=e55] [cursor=pointer]:
              - /url: /partner/calendar
            - link "Abonnement" [ref=e59] [cursor=pointer]:
              - /url: /partner/subscription
            - link "Profil partenaire" [ref=e64] [cursor=pointer]:
              - /url: /partner/profile
        - link "Retour au site" [ref=e70] [cursor=pointer]:
          - /url: /
      - generic [ref=e76]:
        - link "Mariama Ndiaye Partenaire" [ref=e77] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=e78]: MN
          - generic [ref=e79]:
            - generic [ref=e80]: Mariama Ndiaye
            - generic [ref=e81]: Partenaire
        - generic [ref=e82]:
          - button "Se déconnecter" [ref=e83] [cursor=pointer]
          - button "Basculer le thème" [ref=e88] [cursor=pointer]
    - generic [ref=e92]:
      - banner [ref=e93]:
        - link "Rechercher un événement, un concert, un restaurant…" [ref=e95] [cursor=pointer]:
          - /url: /explore
        - button "Notifications, 97 non lues" [ref=e102] [cursor=pointer]:
          - generic [ref=e106]: "97"
      - main [ref=e107]:
        - generic [ref=e109]:
          - generic [ref=e111]:
            - generic [ref=e112]:
              - generic [ref=e113]: Espace organisateur
              - heading "Baobab Scène" [level=1] [ref=e115]
              - paragraph [ref=e116]: Ventes, entrées et solde de vos événements, mis à jour par le serveur.
            - generic [ref=e117]:
              - button "Actualiser" [ref=e118] [cursor=pointer]
              - link "Export comptable" [ref=e126] [cursor=pointer]:
                - /url: /api/partner/reports/accounting?format=csv
              - link "Scanner des billets" [ref=e130] [cursor=pointer]:
                - /url: /partner/scan
          - status [ref=e139]:
            - generic [ref=e145]:
              - paragraph [ref=e146]: Période d’essai gratuite en cours
              - generic [ref=e147]:
                - text: 150 jours offerts, jusqu’au
                - time [ref=e148]: mar. 5 janv. 2027
                - text: .
          - region [ref=e149]:
            - heading "Indicateurs" [level=2] [ref=e150]
            - generic [ref=e151]:
              - generic [ref=e152]:
                - paragraph [ref=e154]: Ventes en ligne
                - paragraph [ref=e159]: 978 000 F CFA
                - paragraph [ref=e160]: Prix des billets vendus en ligne, tous événements.
              - generic [ref=e161]:
                - paragraph [ref=e163]: Net partenaire
                - paragraph [ref=e168]: 828 000 F CFA
                - paragraph [ref=e169]: Après 150 000 F CFA de remboursements.
              - generic [ref=e170]:
                - paragraph [ref=e172]: Billets vendus
                - paragraph [ref=e176]: "130"
                - paragraph [ref=e177]: 68 entrées validées aux portes.
              - generic [ref=e178]:
                - paragraph [ref=e180]: Disponible au retrait
                - paragraph [ref=e185]: 0 F CFA
                - paragraph [ref=e186]: "Déjà versé : 0 F CFA."
            - paragraph [ref=e187]:
              - text: Les ventes en espèces au guichet (110 000 F CFA) et les invitations n’alimentent pas le solde.
              - link "Voir mes finances" [ref=e188] [cursor=pointer]:
                - /url: /partner/finance
          - region [ref=e190]:
            - generic [ref=e191]:
              - generic [ref=e192]:
                - heading "Mes événements" [level=2] [ref=e193]
                - generic [ref=e196]: 8 au total
              - link "Tous mes événements" [ref=e198] [cursor=pointer]:
                - /url: /partner/events
            - table [ref=e202]:
              - caption [ref=e203]: Ventes, entrées et rapports par événement
              - rowgroup [ref=e204]:
                - row [ref=e205]:
                  - columnheader "Événement" [ref=e206]
                  - columnheader "Date et lieu" [ref=e207]
                  - columnheader "Vendus / capacité" [ref=e208]
                  - columnheader "Entrées" [ref=e209]
                  - columnheader "Ventes en ligne" [ref=e210]
                  - columnheader "Net partenaire" [ref=e211]
                  - columnheader "Rapports" [ref=e212]
              - rowgroup [ref=e213]:
                - row [ref=e214]:
                  - cell "Concert acoustique au jardin Brouillon" [ref=e215]:
                    - generic [ref=e216]:
                      - generic [ref=e217]: Concert acoustique au jardin
                      - generic "En cours de rédaction par l’organisateur, visible de lui seul." [ref=e218]: Brouillon
                  - cell "mer. 16 déc. 2026 à 19:00 Dakar" [ref=e221]:
                    - generic [ref=e222]:
                      - time [ref=e223]: mer. 16 déc. 2026 à 19:00
                      - generic [ref=e224]: Dakar
                  - cell "0 / 100 0 % rempli" [ref=e225]:
                    - generic [ref=e226]:
                      - generic [ref=e227]: 0 / 100
                      - generic [ref=e228]: 0 % rempli
                  - cell "0 0 % des vendus" [ref=e229]:
                    - generic [ref=e230]:
                      - generic [ref=e231]: "0"
                      - generic [ref=e232]: 0 % des vendus
                  - cell "0 F CFA" [ref=e233]
                  - cell "0 F CFA" [ref=e234]
                  - cell [ref=e235]:
                    - generic [ref=e236]:
                      - button "Clôture" [ref=e237] [cursor=pointer]
                      - button "Télécharger le rapport PDF de Concert acoustique au jardin" [ref=e243] [cursor=pointer]
                      - button "Exporter les ventes de Concert acoustique au jardin en CSV" [ref=e248] [cursor=pointer]
                - row [ref=e253]:
                  - cell "Matinée gospel et chorales En attente de validation" [ref=e254]:
                    - generic [ref=e255]:
                      - generic [ref=e256]: Matinée gospel et chorales
                      - generic "Soumis à l’équipe Event Village, qui vérifie la fiche avant validation." [ref=e257]: En attente de validation
                  - cell "lun. 30 nov. 2026 à 10:00 Dakar" [ref=e260]:
                    - generic [ref=e261]:
                      - time [ref=e262]: lun. 30 nov. 2026 à 10:00
                      - generic [ref=e263]: Dakar
                  - cell "0 / 300 0 % rempli" [ref=e264]:
                    - generic [ref=e265]:
                      - generic [ref=e266]: 0 / 300
                      - generic [ref=e267]: 0 % rempli
                  - cell "0 0 % des vendus" [ref=e268]:
                    - generic [ref=e269]:
                      - generic [ref=e270]: "0"
                      - generic [ref=e271]: 0 % des vendus
                  - cell "0 F CFA" [ref=e272]
                  - cell "0 F CFA" [ref=e273]
                  - cell [ref=e274]:
                    - generic [ref=e275]:
                      - button "Clôture" [ref=e276] [cursor=pointer]
                      - button "Télécharger le rapport PDF de Matinée gospel et chorales" [ref=e282] [cursor=pointer]
                      - button "Exporter les ventes de Matinée gospel et chorales en CSV" [ref=e287] [cursor=pointer]
                - row [ref=e292]:
                  - cell "Croisière musicale vers Gorée Annulé" [ref=e293]:
                    - generic [ref=e294]:
                      - generic [ref=e295]: Croisière musicale vers Gorée
                      - 'generic "Annulé : les participants sont prévenus et les billets payés sont remboursés." [ref=e296]': Annulé
                  - cell "mar. 24 nov. 2026 à 17:30 Dakar" [ref=e299]:
                    - generic [ref=e300]:
                      - time [ref=e301]: mar. 24 nov. 2026 à 17:30
                      - generic [ref=e302]: Dakar
                  - cell "0 / 120 0 % rempli" [ref=e303]:
                    - generic [ref=e304]:
                      - generic [ref=e305]: 0 / 120
                      - generic [ref=e306]: 0 % rempli
                  - cell "0 0 % des vendus" [ref=e307]:
                    - generic [ref=e308]:
                      - generic [ref=e309]: "0"
                      - generic [ref=e310]: 0 % des vendus
                  - cell "150 000 F CFA" [ref=e311]
                  - cell "0 F CFA" [ref=e312]
                  - cell [ref=e313]:
                    - generic [ref=e314]:
                      - button "Clôture" [ref=e315] [cursor=pointer]
                      - button "Télécharger le rapport PDF de Croisière musicale vers Gorée" [ref=e321] [cursor=pointer]
                      - button "Exporter les ventes de Croisière musicale vers Gorée en CSV" [ref=e326] [cursor=pointer]
                - row [ref=e331]:
                  - cell "Soirée Kora & Lumières Publié" [ref=e332]:
                    - generic [ref=e333]:
                      - generic [ref=e334]: Soirée Kora & Lumières
                      - 'generic "En ligne : la page publique est visible et la billetterie est ouverte." [ref=e335]': Publié
                  - cell "lun. 23 nov. 2026 à 20:30 Dakar" [ref=e338]:
                    - generic [ref=e339]:
                      - time [ref=e340]: lun. 23 nov. 2026 à 20:30
                      - generic [ref=e341]: Dakar
                  - cell "5 / 150 3 % rempli" [ref=e342]:
                    - generic [ref=e343]:
                      - generic [ref=e344]: 5 / 150
                      - generic [ref=e345]: 3 % rempli
                  - cell "0 0 % des vendus" [ref=e346]:
                    - generic [ref=e347]:
                      - generic [ref=e348]: "0"
                      - generic [ref=e349]: 0 % des vendus
                  - cell "42 000 F CFA" [ref=e350]
                  - cell "42 000 F CFA" [ref=e351]
                  - cell [ref=e352]:
                    - generic [ref=e353]:
                      - button "Clôture" [ref=e354] [cursor=pointer]
                      - button "Télécharger le rapport PDF de Soirée Kora & Lumières" [ref=e360] [cursor=pointer]
                      - button "Exporter les ventes de Soirée Kora & Lumières en CSV" [ref=e365] [cursor=pointer]
                - row [ref=e370]:
                  - cell "Festival Jazz sur le Fleuve Publié" [ref=e371]:
                    - generic [ref=e372]:
                      - generic [ref=e373]: Festival Jazz sur le Fleuve
                      - 'generic "En ligne : la page publique est visible et la billetterie est ouverte." [ref=e374]': Publié
                  - cell "mer. 18 nov. 2026 à 18:00 Saint-Louis" [ref=e377]:
                    - generic [ref=e378]:
                      - time [ref=e379]: mer. 18 nov. 2026 à 18:00
                      - generic [ref=e380]: Saint-Louis
                  - cell "22 / 400 6 % rempli" [ref=e381]:
                    - generic [ref=e382]:
                      - generic [ref=e383]: 22 / 400
                      - generic [ref=e384]: 6 % rempli
                  - cell "0 0 % des vendus" [ref=e385]:
                    - generic [ref=e386]:
                      - generic [ref=e387]: "0"
                      - generic [ref=e388]: 0 % des vendus
                  - cell "201 000 F CFA" [ref=e389]
                  - cell "201 000 F CFA" [ref=e390]
                  - cell [ref=e391]:
                    - generic [ref=e392]:
                      - button "Clôture" [ref=e393] [cursor=pointer]
                      - button "Télécharger le rapport PDF de Festival Jazz sur le Fleuve" [ref=e399] [cursor=pointer]
                      - button "Exporter les ventes de Festival Jazz sur le Fleuve en CSV" [ref=e404] [cursor=pointer]
                - row [ref=e409]:
                  - cell "Concert des Lumières de Gorée Publié" [ref=e410]:
                    - generic [ref=e411]:
                      - generic [ref=e412]: Concert des Lumières de Gorée
                      - 'generic "En ligne : la page publique est visible et la billetterie est ouverte." [ref=e413]': Publié
                  - cell "sam. 7 nov. 2026 à 18:30 Gorée" [ref=e416]:
                    - generic [ref=e417]:
                      - time [ref=e418]: sam. 7 nov. 2026 à 18:30
                      - generic [ref=e419]: Gorée
                  - cell "11 / 250 4 % rempli" [ref=e420]:
                    - generic [ref=e421]:
                      - generic [ref=e422]: 11 / 250
                      - generic [ref=e423]: 4 % rempli
                  - cell "0 0 % des vendus" [ref=e424]:
                    - generic [ref=e425]:
                      - generic [ref=e426]: "0"
                      - generic [ref=e427]: 0 % des vendus
                  - cell "84 000 F CFA" [ref=e428]
                  - cell "84 000 F CFA" [ref=e429]
                  - cell [ref=e430]:
                    - generic [ref=e431]:
                      - button "Clôture" [ref=e432] [cursor=pointer]
                      - button "Télécharger le rapport PDF de Concert des Lumières de Gorée" [ref=e438] [cursor=pointer]
                      - button "Exporter les ventes de Concert des Lumières de Gorée en CSV" [ref=e443] [cursor=pointer]
                - row [ref=e448]:
                  - cell "Nuit du Sabar — édition d’automne Publié" [ref=e449]:
                    - generic [ref=e450]:
                      - generic [ref=e451]: Nuit du Sabar — édition d’automne
                      - 'generic "En ligne : la page publique est visible et la billetterie est ouverte." [ref=e452]': Publié
                  - cell "ven. 6 nov. 2026 à 23:15 Dakar" [ref=e455]:
                    - generic [ref=e456]:
                      - time [ref=e457]: ven. 6 nov. 2026 à 23:15
                      - generic [ref=e458]: Dakar
                  - cell "82 / 300 27 % rempli" [ref=e459]:
                    - generic [ref=e460]:
                      - generic [ref=e461]: 82 / 300
                      - generic [ref=e462]: 27 % rempli
                  - cell "60 73 % des vendus" [ref=e463]:
                    - generic [ref=e464]:
                      - generic [ref=e465]: "60"
                      - generic [ref=e466]: 73 % des vendus
                  - cell "351 000 F CFA" [ref=e467]
                  - cell "351 000 F CFA" [ref=e468]
                  - cell [ref=e469]:
                    - generic [ref=e470]:
                      - button "Clôture" [ref=e471] [cursor=pointer]
                      - button "Télécharger le rapport PDF de Nuit du Sabar — édition d’automne" [ref=e477] [cursor=pointer]
                      - button "Exporter les ventes de Nuit du Sabar — édition d’automne en CSV" [ref=e482] [cursor=pointer]
                - row [ref=e487]:
                  - cell "Brunch électro des Almadies Terminé" [ref=e488]:
                    - generic [ref=e489]:
                      - generic [ref=e490]: Brunch électro des Almadies
                      - 'generic "L’événement est passé : la vente est close, le bilan reste consultable." [ref=e491]': Terminé
                  - cell "lun. 2 nov. 2026 à 12:00 Dakar" [ref=e494]:
                    - generic [ref=e495]:
                      - time [ref=e496]: lun. 2 nov. 2026 à 12:00
                      - generic [ref=e497]: Dakar
                  - cell "10 / 80 13 % rempli" [ref=e498]:
                    - generic [ref=e499]:
                      - generic [ref=e500]: 10 / 80
                      - generic [ref=e501]: 13 % rempli
                  - cell "8 80 % des vendus" [ref=e502]:
                    - generic [ref=e503]:
                      - generic [ref=e504]: "8"
                      - generic [ref=e505]: 80 % des vendus
                  - cell "150 000 F CFA" [ref=e506]
                  - cell "150 000 F CFA" [ref=e507]
                  - cell [ref=e508]:
                    - generic [ref=e509]:
                      - button "Clôture" [ref=e510] [cursor=pointer]
                      - button "Télécharger le rapport PDF de Brunch électro des Almadies" [ref=e516] [cursor=pointer]
                      - button "Exporter les ventes de Brunch électro des Almadies en CSV" [ref=e521] [cursor=pointer]
          - region [ref=e527]:
            - heading "Activité récente" [level=2] [ref=e528]
            - list [ref=e531]:
              - listitem [ref=e532]:
                - generic [ref=e537]:
                  - paragraph [ref=e538]: "Billet vendu : Nuit du Sabar — édition d’automne"
                  - paragraph [ref=e539]: Billet TCK-20261106-07D0EAF410 · 5 000 F CFA
                - time [ref=e540]: ven. 6 nov. 2026 à 22:21
              - listitem [ref=e541]:
                - generic [ref=e546]:
                  - paragraph [ref=e547]: "Billet vendu : Nuit du Sabar — édition d’automne"
                  - paragraph [ref=e548]: Billet TCK-20261106-A776006B86 · 5 000 F CFA
                - time [ref=e549]: ven. 6 nov. 2026 à 22:21
              - listitem [ref=e550]:
                - generic [ref=e555]:
                  - paragraph [ref=e556]: "Billet vendu : Nuit du Sabar — édition d’automne"
                  - paragraph [ref=e557]: Billet TCK-20261106-FFEB086BC2 · 5 000 F CFA
                - time [ref=e558]: ven. 6 nov. 2026 à 22:21
              - listitem [ref=e559]:
                - generic [ref=e564]:
                  - paragraph [ref=e565]: "Billet vendu : Nuit du Sabar — édition d’automne"
                  - paragraph [ref=e566]: Billet TCK-20261106-CD7DE71C2C · 5 000 F CFA
                - time [ref=e567]: ven. 6 nov. 2026 à 22:21
              - listitem [ref=e568]:
                - generic [ref=e573]:
                  - paragraph [ref=e574]: "Billet vendu : Nuit du Sabar — édition d’automne"
                  - paragraph [ref=e575]: Billet TCK-20261106-1A6F34FC6F · 15 000 F CFA
                - time [ref=e576]: ven. 6 nov. 2026 à 22:21
              - listitem [ref=e577]:
                - generic [ref=e582]:
                  - paragraph [ref=e583]: "Billet vendu : Nuit du Sabar — édition d’automne"
                  - paragraph [ref=e584]: Billet TCK-20261106-5905459F87 · 15 000 F CFA
                - time [ref=e585]: ven. 6 nov. 2026 à 22:21
              - listitem [ref=e586]:
                - generic [ref=e591]:
                  - paragraph [ref=e592]: "Billet vendu : Nuit du Sabar — édition d’automne"
                  - paragraph [ref=e593]: Billet TCK-20261106-D5BE9C8D22 · 15 000 F CFA
                - time [ref=e594]: ven. 6 nov. 2026 à 22:21
              - listitem [ref=e595]:
                - generic [ref=e600]:
                  - paragraph [ref=e601]: "Billet vendu : Nuit du Sabar — édition d’automne"
                  - paragraph [ref=e602]: Billet TCK-20261106-02B7CDD398 · 5 000 F CFA
                - time [ref=e603]: ven. 6 nov. 2026 à 22:21
              - listitem [ref=e604]:
                - generic [ref=e610]:
                  - paragraph [ref=e611]: Commande CMD-DEMO-1794003675480-27F3D1
                  - paragraph [ref=e612]: Sur place · 15 000 F CFA
                - time [ref=e613]: ven. 6 nov. 2026 à 22:21
              - listitem [ref=e614]:
                - generic [ref=e623]:
                  - paragraph [ref=e624]: Entrée validée
                  - paragraph [ref=e625]: Nuit du Sabar — édition d’automne · contrôle à l’entrée
                - time [ref=e626]: ven. 6 nov. 2026 à 22:18
              - listitem [ref=e627]:
                - generic [ref=e636]:
                  - paragraph [ref=e637]: Entrée validée
                  - paragraph [ref=e638]: Nuit du Sabar — édition d’automne · contrôle à l’entrée
                - time [ref=e639]: ven. 6 nov. 2026 à 22:17
              - listitem [ref=e640]:
                - generic [ref=e649]:
                  - paragraph [ref=e650]: Entrée validée
                  - paragraph [ref=e651]: Nuit du Sabar — édition d’automne · contrôle à l’entrée
                - time [ref=e652]: ven. 6 nov. 2026 à 22:15
              - listitem [ref=e653]:
                - generic [ref=e662]:
                  - paragraph [ref=e663]: Entrée validée
                  - paragraph [ref=e664]: Nuit du Sabar — édition d’automne · contrôle à l’entrée
                - time [ref=e665]: ven. 6 nov. 2026 à 22:14
              - listitem [ref=e666]:
                - generic [ref=e675]:
                  - paragraph [ref=e676]: Entrée validée
                  - paragraph [ref=e677]: Nuit du Sabar — édition d’automne · contrôle à l’entrée
                - time [ref=e678]: ven. 6 nov. 2026 à 22:12
  - alert [ref=e679]
  - dialog [active] [ref=e682]:
    - generic [ref=e683]:
      - generic [ref=e689]:
        - heading "Rapport de clôture" [level=2] [ref=e690]
        - paragraph [ref=e691]: Brunch électro des Almadies
      - button "Fermer" [ref=e692] [cursor=pointer]
    - generic [ref=e698]:
      - generic [ref=e699]:
        - generic [ref=e700]:
          - generic [ref=e701]: CLOTURE-75E7B0BC-20261106
          - paragraph [ref=e702]:
            - text: Généré le
            - time [ref=e703]: ven. 6 nov. 2026 à 22:31
        - list [ref=e704]:
          - listitem [ref=e705]: lun. 2 nov. 2026 à 12:00
          - listitem [ref=e708]:
            - generic [ref=e712]: Rooftop de la Pointe des Almadies, Dakar
      - generic [ref=e713]:
        - generic [ref=e714]:
          - paragraph [ref=e716]: Billets vendus
          - paragraph [ref=e723]:
            - generic [ref=e724]: 10 / 80
          - paragraph [ref=e725]: "Remplissage : 13 %"
        - generic [ref=e726]:
          - paragraph [ref=e728]: Entrées validées
          - paragraph [ref=e736]: "8"
          - paragraph [ref=e737]: "Présence : 80 %"
        - generic [ref=e738]:
          - paragraph [ref=e740]: Paiements confirmés
          - paragraph [ref=e745]: "7"
          - paragraph [ref=e746]: "Ventes en ligne : 150 000 F CFA"
        - generic [ref=e747]:
          - paragraph [ref=e749]: Net à reverser
          - paragraph [ref=e754]:
            - generic [ref=e755]: 150 000 F CFA
      - region [ref=e756]:
        - heading "Ventes par catégorie" [level=3] [ref=e757]
        - table [ref=e760]:
          - caption [ref=e761]: Ventes par catégorie
          - rowgroup [ref=e762]:
            - row [ref=e763]:
              - columnheader "Catégorie" [ref=e764]
              - columnheader "Prix unitaire" [ref=e765]
              - columnheader "Quota" [ref=e766]
              - columnheader "Vendus" [ref=e767]
              - columnheader "Entrées" [ref=e768]
              - columnheader "Ventes en ligne" [ref=e769]
          - rowgroup [ref=e770]:
            - row [ref=e771]:
              - cell "Brunch" [ref=e772]
              - cell "15 000 F CFA" [ref=e773]
              - cell "80" [ref=e774]
              - cell "10" [ref=e775]
              - cell "8" [ref=e776]
              - cell "150 000 F CFA" [ref=e777]
      - region [ref=e778]:
        - heading "Synthèse comptable" [level=3] [ref=e779]
        - generic [ref=e780]:
          - generic [ref=e781]:
            - term [ref=e782]: Ventes en ligne, prix des billets
            - definition [ref=e783]: 150 000 F CFA
          - generic [ref=e784]:
            - term [ref=e785]: Net à reverser au partenaire
            - definition [ref=e786]:
              - generic [ref=e787]: 150 000 F CFA
          - generic [ref=e788]:
            - term [ref=e789]: Dont disponible
            - definition [ref=e790]: 0 F CFA
          - generic [ref=e791]:
            - term [ref=e792]: Dont en attente
            - definition [ref=e793]: 150 000 F CFA
          - generic [ref=e794]:
            - term [ref=e795]: Frais de service payés par l’acheteur, non déduits
            - definition [ref=e796]: 7 500 F CFA
          - generic [ref=e797]:
            - term [ref=e798]: Espèces au guichet, 0 billet, hors plateforme, pour information
            - definition [ref=e799]: 0 F CFA
    - generic [ref=e802]:
      - paragraph [ref=e803]: Document généré par Event Village
      - generic [ref=e804]:
        - button "Export CSV / Excel" [ref=e805] [cursor=pointer]
        - button "Télécharger le PDF" [ref=e811] [cursor=pointer]
```

# Test source

```ts
  184 |                 await context.addInitScript(stretchTimers, screen.slowTimers);
  185 |             }
  186 |             if (screen.injectError) {
  187 |                 record.notes.push(`état d'erreur simulé : réponses ${screen.injectError} remplacées par un 500 (erreurs de console attendues, ignorées)`);
  188 |                 await page.route(screen.injectError, (route) => route.fulfill({
  189 |                     status: 500,
  190 |                     contentType: 'application/json; charset=utf-8',
  191 |                     body: JSON.stringify({ error: 'Erreur simulée par les tests de bout en bout.', code: 'E2E_SIMULATED_ERROR' }),
  192 |                 }));
  193 |             }
  194 |             const stubs: StubResponse[] = [...(screen.stubResponse ? [screen.stubResponse] : []), ...(screen.stubResponses ?? [])];
  195 |             for (const stub of stubs) {
  196 |                 record.notes.push(`réponse simulée : ${stub.method ?? 'toute méthode'} ${stub.url} remplacée par HTTP ${stub.status} ${JSON.stringify(stub.body).slice(0, 160)}`);
  197 |                 await page.route(stub.url, async (route) => {
  198 |                     if (!methodMatches(stub.method, route.request().method())) {
  199 |                         await route.fallback();
  200 |                         return;
  201 |                     }
  202 |                     await route.fulfill({ status: stub.status, contentType: 'application/json; charset=utf-8', body: JSON.stringify(stub.body) });
  203 |                 });
  204 |             }
  205 |             for (const hold of screen.holdRequests ?? []) {
  206 |                 record.notes.push(`requête retenue (jamais servie) : ${hold.method ?? 'toute méthode'} ${hold.url}`);
  207 |                 await page.route(hold.url, async (route) => {
  208 |                     if (!methodMatches(hold.method, route.request().method())) {
  209 |                         await route.fallback();
  210 |                         return;
  211 |                     }
  212 |                     // Retenue jusqu'à la fermeture de la page : ni réponse ni erreur (réseau lent, téléchargement en cours)
  213 |                     await new Promise<void>((resolve) => { page.once('close', () => resolve()); });
  214 |                 });
  215 |             }
  216 |             if (screen.fakePush) {
  217 |                 const subscription = screen.fakePush === 'granted' ? await fakePushSubscriber() : null;
  218 |                 record.notes.push(screen.fakePush === 'granted'
  219 |                     ? `push simulé (granted) : permission accordée au clic sans fenêtre, inscription du service worker et pushManager.subscribe remplacés ; abonnement du faux service push ${subscription?.endpoint ?? '?'} ; configuration VAPID, route d'inscription et base réelles`
  220 |                     : screen.fakePush === 'denied'
  221 |                         ? 'push simulé (denied) : Notification.permission = « denied », appels à requestPermission comptés'
  222 |                         : 'push simulé (unsupported) : window.PushManager et window.Notification supprimés');
  223 |                 await context.addInitScript(installFakePush, { mode: screen.fakePush, subscription });
  224 |             }
  225 |             if (screen.fakeCamera) {
  226 |                 const mode = screen.fakeCamera === 'barcode-detector' ? 'barcode-detector' : fakeScanMode();
  227 |                 record.notes.push(`caméra simulée (${mode})${mode === 'barcode-detector' ? ' : faux BarcodeDetector, payload posé par le test' : ''}`);
  228 |                 await context.addInitScript(installFakeCamera, { mode });
  229 |             }
  230 |             if (screen.offline === 'before-load') {
  231 |                 record.notes.push('connexion coupée avant le chargement (collecte d’erreurs arrêtée)');
  232 |                 guard.freeze();
  233 |                 await context.setOffline(true);
  234 |             }
  235 |             const response = await page.goto(record.url, { waitUntil: 'load' });
  236 |             record.status = response ? response.status() : null;
  237 |             if (screen.expectStatus !== undefined) {
  238 |                 expect(record.status, `statut HTTP du document ${record.url}`).toBe(screen.expectStatus);
  239 |             }
  240 |             if (screen.offline === 'after-load') {
  241 |                 record.notes.push('connexion coupée après le chargement (collecte d’erreurs arrêtée)');
  242 |                 guard.freeze();
  243 |                 await context.setOffline(true);
  244 |             }
  245 |             const sc = { page, context, guard, ids: demo };
  246 |             if (screen.ready) await screen.ready(sc);
  247 |             await settle(page, guard, record.notes);
  248 |             if (screen.actions) {
  249 |                 await screen.actions(sc);
  250 |                 await settle(page, guard, record.notes);
  251 |             }
  252 |             if (screen.id === 'cloche-ouverte' && vue === 'mobile') {
  253 |                 const problem = await markAllOnOneLine(page);
  254 |                 if (problem) record.blocking.push(problem);
  255 |             }
  256 |             const checks = await runPageChecks(page, { mobile: vue === 'mobile', axe: true });
  257 |             record.blocking.push(...checks.blocking);
  258 |             record.warnings.push(...checks.warnings);
  259 |             record.axeDetails = checks.axeDetails;
  260 |             record.smallTextDetails = checks.smallTextDetails;
  261 |             record.metrics = checks.metrics;
  262 |             const shot = await capture(page, screen, file);
  263 |             record.captured = true;
  264 |             await testInfo.attach(file, { path: shot, contentType: 'image/png' });
  265 |         } catch (err) {
  266 |             record.error = err instanceof Error ? err.message.split('\n')[0] : String(err);
  267 |             if (!record.captured && !page.isClosed()) {
  268 |                 await capture(page, screen, file).then(
  269 |                     async (shot) => {
  270 |                         record.captured = true;
  271 |                         record.notes.push('capture prise après l’erreur (état de la page au moment de l’échec)');
  272 |                         await testInfo.attach(file, { path: shot, contentType: 'image/png' });
  273 |                     },
  274 |                     (shotErr: Error) => { record.notes.push(`capture impossible après l’erreur : ${shotErr.message.split('\n')[0]}`); },
  275 |                 );
  276 |             }
  277 |             throw err;
  278 |         } finally {
  279 |             record.blocking.push(...guard.blockingIssues());
  280 |             record.warnings.push(...guard.nonBlockingIssues());
  281 |             record.durationMs = Date.now() - started;
  282 |             writeCaptureRecord(record);
  283 |         }
> 284 |         expect(record.blocking, `contrôles bloquants de ${file}`).toEqual([]);
      |                                                                   ^ Error: contrôles bloquants de partenaire-rapport-cloture__ordinateur__clair.png
  285 |     });
  286 | }
  287 | 
  288 | for (const theme of THEMES) {
  289 |     for (const role of ROLE_ORDER) {
  290 |         const screens = SCREENS.filter((s) => s.role === role);
  291 |         if (screens.length === 0) continue;
  292 |         test.describe(`${theme.key} · ${role}`, () => {
  293 |             test.use({ colorScheme: theme.colorScheme, evTheme: theme.key, evRole: role });
  294 | 
  295 |             for (const screen of screens) {
  296 |                 if (screen.serviceWorkers === 'allow') {
  297 |                     // Lot 7 (D7) : service worker autorisé seulement dans le contexte de cet écran
  298 |                     test.describe(`${screen.id} (service worker autorisé)`, () => {
  299 |                         test.use({ serviceWorkers: 'allow' });
  300 |                         defineCapture(screen, theme, role);
  301 |                     });
  302 |                 } else {
  303 |                     defineCapture(screen, theme, role);
  304 |                 }
  305 |             }
  306 |         });
  307 |     }
  308 | }
  309 | 
```