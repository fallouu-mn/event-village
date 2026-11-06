# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · organisateur >> partenaire-rapport-cloture — Rapport de clôture d’un événement terminé (modale du tableau de bord)
- Location: e2e/captures.spec.ts:159:9

# Error details

```
Error: contrôles bloquants de partenaire-rapport-cloture__ordinateur__sombre.png

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
          - button "Basculer le thème" [pressed] [ref=e88] [cursor=pointer]
    - generic [ref=e96]:
      - banner [ref=e97]:
        - link "Rechercher un événement, un concert, un restaurant…" [ref=e99] [cursor=pointer]:
          - /url: /explore
        - button "Notifications, 97 non lues" [ref=e106] [cursor=pointer]:
          - generic [ref=e110]: "97"
      - main [ref=e111]:
        - generic [ref=e113]:
          - generic [ref=e115]:
            - generic [ref=e116]:
              - generic [ref=e117]: Espace organisateur
              - heading "Baobab Scène" [level=1] [ref=e119]
              - paragraph [ref=e120]: Ventes, entrées et solde de vos événements, mis à jour par le serveur.
            - generic [ref=e121]:
              - button "Actualiser" [ref=e122] [cursor=pointer]
              - link "Export comptable" [ref=e130] [cursor=pointer]:
                - /url: /api/partner/reports/accounting?format=csv
              - link "Scanner des billets" [ref=e134] [cursor=pointer]:
                - /url: /partner/scan
          - status [ref=e143]:
            - generic [ref=e149]:
              - paragraph [ref=e150]: Période d’essai gratuite en cours
              - generic [ref=e151]:
                - text: 150 jours offerts, jusqu’au
                - time [ref=e152]: mar. 5 janv. 2027
                - text: .
          - region [ref=e153]:
            - heading "Indicateurs" [level=2] [ref=e154]
            - generic [ref=e155]:
              - generic [ref=e156]:
                - paragraph [ref=e158]: Ventes en ligne
                - paragraph [ref=e163]: 978 000 F CFA
                - paragraph [ref=e164]: Prix des billets vendus en ligne, tous événements.
              - generic [ref=e165]:
                - paragraph [ref=e167]: Net partenaire
                - paragraph [ref=e172]: 828 000 F CFA
                - paragraph [ref=e173]: Après 150 000 F CFA de remboursements.
              - generic [ref=e174]:
                - paragraph [ref=e176]: Billets vendus
                - paragraph [ref=e180]: "130"
                - paragraph [ref=e181]: 68 entrées validées aux portes.
              - generic [ref=e182]:
                - paragraph [ref=e184]: Disponible au retrait
                - paragraph [ref=e189]: 0 F CFA
                - paragraph [ref=e190]: "Déjà versé : 0 F CFA."
            - paragraph [ref=e191]:
              - text: Les ventes en espèces au guichet (110 000 F CFA) et les invitations n’alimentent pas le solde.
              - link "Voir mes finances" [ref=e192] [cursor=pointer]:
                - /url: /partner/finance
          - region [ref=e194]:
            - generic [ref=e195]:
              - generic [ref=e196]:
                - heading "Mes événements" [level=2] [ref=e197]
                - generic [ref=e200]: 8 au total
              - link "Tous mes événements" [ref=e202] [cursor=pointer]:
                - /url: /partner/events
            - table [ref=e206]:
              - caption [ref=e207]: Ventes, entrées et rapports par événement
              - rowgroup [ref=e208]:
                - row [ref=e209]:
                  - columnheader "Événement" [ref=e210]
                  - columnheader "Date et lieu" [ref=e211]
                  - columnheader "Vendus / capacité" [ref=e212]
                  - columnheader "Entrées" [ref=e213]
                  - columnheader "Ventes en ligne" [ref=e214]
                  - columnheader "Net partenaire" [ref=e215]
                  - columnheader "Rapports" [ref=e216]
              - rowgroup [ref=e217]:
                - row [ref=e218]:
                  - cell "Concert acoustique au jardin Brouillon" [ref=e219]:
                    - generic [ref=e220]:
                      - generic [ref=e221]: Concert acoustique au jardin
                      - generic "En cours de rédaction par l’organisateur, visible de lui seul." [ref=e222]: Brouillon
                  - cell "mer. 16 déc. 2026 à 19:00 Dakar" [ref=e225]:
                    - generic [ref=e226]:
                      - time [ref=e227]: mer. 16 déc. 2026 à 19:00
                      - generic [ref=e228]: Dakar
                  - cell "0 / 100 0 % rempli" [ref=e229]:
                    - generic [ref=e230]:
                      - generic [ref=e231]: 0 / 100
                      - generic [ref=e232]: 0 % rempli
                  - cell "0 0 % des vendus" [ref=e233]:
                    - generic [ref=e234]:
                      - generic [ref=e235]: "0"
                      - generic [ref=e236]: 0 % des vendus
                  - cell "0 F CFA" [ref=e237]
                  - cell "0 F CFA" [ref=e238]
                  - cell [ref=e239]:
                    - generic [ref=e240]:
                      - button "Clôture" [ref=e241] [cursor=pointer]
                      - button "Télécharger le rapport PDF de Concert acoustique au jardin" [ref=e247] [cursor=pointer]
                      - button "Exporter les ventes de Concert acoustique au jardin en CSV" [ref=e252] [cursor=pointer]
                - row [ref=e257]:
                  - cell "Matinée gospel et chorales En attente de validation" [ref=e258]:
                    - generic [ref=e259]:
                      - generic [ref=e260]: Matinée gospel et chorales
                      - generic "Soumis à l’équipe Event Village, qui vérifie la fiche avant validation." [ref=e261]: En attente de validation
                  - cell "lun. 30 nov. 2026 à 10:00 Dakar" [ref=e264]:
                    - generic [ref=e265]:
                      - time [ref=e266]: lun. 30 nov. 2026 à 10:00
                      - generic [ref=e267]: Dakar
                  - cell "0 / 300 0 % rempli" [ref=e268]:
                    - generic [ref=e269]:
                      - generic [ref=e270]: 0 / 300
                      - generic [ref=e271]: 0 % rempli
                  - cell "0 0 % des vendus" [ref=e272]:
                    - generic [ref=e273]:
                      - generic [ref=e274]: "0"
                      - generic [ref=e275]: 0 % des vendus
                  - cell "0 F CFA" [ref=e276]
                  - cell "0 F CFA" [ref=e277]
                  - cell [ref=e278]:
                    - generic [ref=e279]:
                      - button "Clôture" [ref=e280] [cursor=pointer]
                      - button "Télécharger le rapport PDF de Matinée gospel et chorales" [ref=e286] [cursor=pointer]
                      - button "Exporter les ventes de Matinée gospel et chorales en CSV" [ref=e291] [cursor=pointer]
                - row [ref=e296]:
                  - cell "Croisière musicale vers Gorée Annulé" [ref=e297]:
                    - generic [ref=e298]:
                      - generic [ref=e299]: Croisière musicale vers Gorée
                      - 'generic "Annulé : les participants sont prévenus et les billets payés sont remboursés." [ref=e300]': Annulé
                  - cell "mar. 24 nov. 2026 à 17:30 Dakar" [ref=e303]:
                    - generic [ref=e304]:
                      - time [ref=e305]: mar. 24 nov. 2026 à 17:30
                      - generic [ref=e306]: Dakar
                  - cell "0 / 120 0 % rempli" [ref=e307]:
                    - generic [ref=e308]:
                      - generic [ref=e309]: 0 / 120
                      - generic [ref=e310]: 0 % rempli
                  - cell "0 0 % des vendus" [ref=e311]:
                    - generic [ref=e312]:
                      - generic [ref=e313]: "0"
                      - generic [ref=e314]: 0 % des vendus
                  - cell "150 000 F CFA" [ref=e315]
                  - cell "0 F CFA" [ref=e316]
                  - cell [ref=e317]:
                    - generic [ref=e318]:
                      - button "Clôture" [ref=e319] [cursor=pointer]
                      - button "Télécharger le rapport PDF de Croisière musicale vers Gorée" [ref=e325] [cursor=pointer]
                      - button "Exporter les ventes de Croisière musicale vers Gorée en CSV" [ref=e330] [cursor=pointer]
                - row [ref=e335]:
                  - cell "Soirée Kora & Lumières Publié" [ref=e336]:
                    - generic [ref=e337]:
                      - generic [ref=e338]: Soirée Kora & Lumières
                      - 'generic "En ligne : la page publique est visible et la billetterie est ouverte." [ref=e339]': Publié
                  - cell "lun. 23 nov. 2026 à 20:30 Dakar" [ref=e342]:
                    - generic [ref=e343]:
                      - time [ref=e344]: lun. 23 nov. 2026 à 20:30
                      - generic [ref=e345]: Dakar
                  - cell "5 / 150 3 % rempli" [ref=e346]:
                    - generic [ref=e347]:
                      - generic [ref=e348]: 5 / 150
                      - generic [ref=e349]: 3 % rempli
                  - cell "0 0 % des vendus" [ref=e350]:
                    - generic [ref=e351]:
                      - generic [ref=e352]: "0"
                      - generic [ref=e353]: 0 % des vendus
                  - cell "42 000 F CFA" [ref=e354]
                  - cell "42 000 F CFA" [ref=e355]
                  - cell [ref=e356]:
                    - generic [ref=e357]:
                      - button "Clôture" [ref=e358] [cursor=pointer]
                      - button "Télécharger le rapport PDF de Soirée Kora & Lumières" [ref=e364] [cursor=pointer]
                      - button "Exporter les ventes de Soirée Kora & Lumières en CSV" [ref=e369] [cursor=pointer]
                - row [ref=e374]:
                  - cell "Festival Jazz sur le Fleuve Publié" [ref=e375]:
                    - generic [ref=e376]:
                      - generic [ref=e377]: Festival Jazz sur le Fleuve
                      - 'generic "En ligne : la page publique est visible et la billetterie est ouverte." [ref=e378]': Publié
                  - cell "mer. 18 nov. 2026 à 18:00 Saint-Louis" [ref=e381]:
                    - generic [ref=e382]:
                      - time [ref=e383]: mer. 18 nov. 2026 à 18:00
                      - generic [ref=e384]: Saint-Louis
                  - cell "22 / 400 6 % rempli" [ref=e385]:
                    - generic [ref=e386]:
                      - generic [ref=e387]: 22 / 400
                      - generic [ref=e388]: 6 % rempli
                  - cell "0 0 % des vendus" [ref=e389]:
                    - generic [ref=e390]:
                      - generic [ref=e391]: "0"
                      - generic [ref=e392]: 0 % des vendus
                  - cell "201 000 F CFA" [ref=e393]
                  - cell "201 000 F CFA" [ref=e394]
                  - cell [ref=e395]:
                    - generic [ref=e396]:
                      - button "Clôture" [ref=e397] [cursor=pointer]
                      - button "Télécharger le rapport PDF de Festival Jazz sur le Fleuve" [ref=e403] [cursor=pointer]
                      - button "Exporter les ventes de Festival Jazz sur le Fleuve en CSV" [ref=e408] [cursor=pointer]
                - row [ref=e413]:
                  - cell "Concert des Lumières de Gorée Publié" [ref=e414]:
                    - generic [ref=e415]:
                      - generic [ref=e416]: Concert des Lumières de Gorée
                      - 'generic "En ligne : la page publique est visible et la billetterie est ouverte." [ref=e417]': Publié
                  - cell "sam. 7 nov. 2026 à 18:30 Gorée" [ref=e420]:
                    - generic [ref=e421]:
                      - time [ref=e422]: sam. 7 nov. 2026 à 18:30
                      - generic [ref=e423]: Gorée
                  - cell "11 / 250 4 % rempli" [ref=e424]:
                    - generic [ref=e425]:
                      - generic [ref=e426]: 11 / 250
                      - generic [ref=e427]: 4 % rempli
                  - cell "0 0 % des vendus" [ref=e428]:
                    - generic [ref=e429]:
                      - generic [ref=e430]: "0"
                      - generic [ref=e431]: 0 % des vendus
                  - cell "84 000 F CFA" [ref=e432]
                  - cell "84 000 F CFA" [ref=e433]
                  - cell [ref=e434]:
                    - generic [ref=e435]:
                      - button "Clôture" [ref=e436] [cursor=pointer]
                      - button "Télécharger le rapport PDF de Concert des Lumières de Gorée" [ref=e442] [cursor=pointer]
                      - button "Exporter les ventes de Concert des Lumières de Gorée en CSV" [ref=e447] [cursor=pointer]
                - row [ref=e452]:
                  - cell "Nuit du Sabar — édition d’automne Publié" [ref=e453]:
                    - generic [ref=e454]:
                      - generic [ref=e455]: Nuit du Sabar — édition d’automne
                      - 'generic "En ligne : la page publique est visible et la billetterie est ouverte." [ref=e456]': Publié
                  - cell "ven. 6 nov. 2026 à 23:15 Dakar" [ref=e459]:
                    - generic [ref=e460]:
                      - time [ref=e461]: ven. 6 nov. 2026 à 23:15
                      - generic [ref=e462]: Dakar
                  - cell "82 / 300 27 % rempli" [ref=e463]:
                    - generic [ref=e464]:
                      - generic [ref=e465]: 82 / 300
                      - generic [ref=e466]: 27 % rempli
                  - cell "60 73 % des vendus" [ref=e467]:
                    - generic [ref=e468]:
                      - generic [ref=e469]: "60"
                      - generic [ref=e470]: 73 % des vendus
                  - cell "351 000 F CFA" [ref=e471]
                  - cell "351 000 F CFA" [ref=e472]
                  - cell [ref=e473]:
                    - generic [ref=e474]:
                      - button "Clôture" [ref=e475] [cursor=pointer]
                      - button "Télécharger le rapport PDF de Nuit du Sabar — édition d’automne" [ref=e481] [cursor=pointer]
                      - button "Exporter les ventes de Nuit du Sabar — édition d’automne en CSV" [ref=e486] [cursor=pointer]
                - row [ref=e491]:
                  - cell "Brunch électro des Almadies Terminé" [ref=e492]:
                    - generic [ref=e493]:
                      - generic [ref=e494]: Brunch électro des Almadies
                      - 'generic "L’événement est passé : la vente est close, le bilan reste consultable." [ref=e495]': Terminé
                  - cell "lun. 2 nov. 2026 à 12:00 Dakar" [ref=e498]:
                    - generic [ref=e499]:
                      - time [ref=e500]: lun. 2 nov. 2026 à 12:00
                      - generic [ref=e501]: Dakar
                  - cell "10 / 80 13 % rempli" [ref=e502]:
                    - generic [ref=e503]:
                      - generic [ref=e504]: 10 / 80
                      - generic [ref=e505]: 13 % rempli
                  - cell "8 80 % des vendus" [ref=e506]:
                    - generic [ref=e507]:
                      - generic [ref=e508]: "8"
                      - generic [ref=e509]: 80 % des vendus
                  - cell "150 000 F CFA" [ref=e510]
                  - cell "150 000 F CFA" [ref=e511]
                  - cell [ref=e512]:
                    - generic [ref=e513]:
                      - button "Clôture" [ref=e514] [cursor=pointer]
                      - button "Télécharger le rapport PDF de Brunch électro des Almadies" [ref=e520] [cursor=pointer]
                      - button "Exporter les ventes de Brunch électro des Almadies en CSV" [ref=e525] [cursor=pointer]
          - region [ref=e531]:
            - heading "Activité récente" [level=2] [ref=e532]
            - list [ref=e535]:
              - listitem [ref=e536]:
                - generic [ref=e541]:
                  - paragraph [ref=e542]: "Billet vendu : Nuit du Sabar — édition d’automne"
                  - paragraph [ref=e543]: Billet TCK-20261106-07D0EAF410 · 5 000 F CFA
                - time [ref=e544]: ven. 6 nov. 2026 à 22:21
              - listitem [ref=e545]:
                - generic [ref=e550]:
                  - paragraph [ref=e551]: "Billet vendu : Nuit du Sabar — édition d’automne"
                  - paragraph [ref=e552]: Billet TCK-20261106-A776006B86 · 5 000 F CFA
                - time [ref=e553]: ven. 6 nov. 2026 à 22:21
              - listitem [ref=e554]:
                - generic [ref=e559]:
                  - paragraph [ref=e560]: "Billet vendu : Nuit du Sabar — édition d’automne"
                  - paragraph [ref=e561]: Billet TCK-20261106-FFEB086BC2 · 5 000 F CFA
                - time [ref=e562]: ven. 6 nov. 2026 à 22:21
              - listitem [ref=e563]:
                - generic [ref=e568]:
                  - paragraph [ref=e569]: "Billet vendu : Nuit du Sabar — édition d’automne"
                  - paragraph [ref=e570]: Billet TCK-20261106-CD7DE71C2C · 5 000 F CFA
                - time [ref=e571]: ven. 6 nov. 2026 à 22:21
              - listitem [ref=e572]:
                - generic [ref=e577]:
                  - paragraph [ref=e578]: "Billet vendu : Nuit du Sabar — édition d’automne"
                  - paragraph [ref=e579]: Billet TCK-20261106-1A6F34FC6F · 15 000 F CFA
                - time [ref=e580]: ven. 6 nov. 2026 à 22:21
              - listitem [ref=e581]:
                - generic [ref=e586]:
                  - paragraph [ref=e587]: "Billet vendu : Nuit du Sabar — édition d’automne"
                  - paragraph [ref=e588]: Billet TCK-20261106-5905459F87 · 15 000 F CFA
                - time [ref=e589]: ven. 6 nov. 2026 à 22:21
              - listitem [ref=e590]:
                - generic [ref=e595]:
                  - paragraph [ref=e596]: "Billet vendu : Nuit du Sabar — édition d’automne"
                  - paragraph [ref=e597]: Billet TCK-20261106-D5BE9C8D22 · 15 000 F CFA
                - time [ref=e598]: ven. 6 nov. 2026 à 22:21
              - listitem [ref=e599]:
                - generic [ref=e604]:
                  - paragraph [ref=e605]: "Billet vendu : Nuit du Sabar — édition d’automne"
                  - paragraph [ref=e606]: Billet TCK-20261106-02B7CDD398 · 5 000 F CFA
                - time [ref=e607]: ven. 6 nov. 2026 à 22:21
              - listitem [ref=e608]:
                - generic [ref=e614]:
                  - paragraph [ref=e615]: Commande CMD-DEMO-1794003675480-27F3D1
                  - paragraph [ref=e616]: Sur place · 15 000 F CFA
                - time [ref=e617]: ven. 6 nov. 2026 à 22:21
              - listitem [ref=e618]:
                - generic [ref=e627]:
                  - paragraph [ref=e628]: Entrée validée
                  - paragraph [ref=e629]: Nuit du Sabar — édition d’automne · contrôle à l’entrée
                - time [ref=e630]: ven. 6 nov. 2026 à 22:18
              - listitem [ref=e631]:
                - generic [ref=e640]:
                  - paragraph [ref=e641]: Entrée validée
                  - paragraph [ref=e642]: Nuit du Sabar — édition d’automne · contrôle à l’entrée
                - time [ref=e643]: ven. 6 nov. 2026 à 22:17
              - listitem [ref=e644]:
                - generic [ref=e653]:
                  - paragraph [ref=e654]: Entrée validée
                  - paragraph [ref=e655]: Nuit du Sabar — édition d’automne · contrôle à l’entrée
                - time [ref=e656]: ven. 6 nov. 2026 à 22:15
              - listitem [ref=e657]:
                - generic [ref=e666]:
                  - paragraph [ref=e667]: Entrée validée
                  - paragraph [ref=e668]: Nuit du Sabar — édition d’automne · contrôle à l’entrée
                - time [ref=e669]: ven. 6 nov. 2026 à 22:14
              - listitem [ref=e670]:
                - generic [ref=e679]:
                  - paragraph [ref=e680]: Entrée validée
                  - paragraph [ref=e681]: Nuit du Sabar — édition d’automne · contrôle à l’entrée
                - time [ref=e682]: ven. 6 nov. 2026 à 22:12
  - alert [ref=e683]
  - dialog [active] [ref=e686]:
    - generic [ref=e687]:
      - generic [ref=e693]:
        - heading "Rapport de clôture" [level=2] [ref=e694]
        - paragraph [ref=e695]: Brunch électro des Almadies
      - button "Fermer" [ref=e696] [cursor=pointer]
    - generic [ref=e702]:
      - generic [ref=e703]:
        - generic [ref=e704]:
          - generic [ref=e705]: CLOTURE-75E7B0BC-20261106
          - paragraph [ref=e706]:
            - text: Généré le
            - time [ref=e707]: ven. 6 nov. 2026 à 22:34
        - list [ref=e708]:
          - listitem [ref=e709]: lun. 2 nov. 2026 à 12:00
          - listitem [ref=e712]:
            - generic [ref=e716]: Rooftop de la Pointe des Almadies, Dakar
      - generic [ref=e717]:
        - generic [ref=e718]:
          - paragraph [ref=e720]: Billets vendus
          - paragraph [ref=e727]:
            - generic [ref=e728]: 10 / 80
          - paragraph [ref=e729]: "Remplissage : 13 %"
        - generic [ref=e730]:
          - paragraph [ref=e732]: Entrées validées
          - paragraph [ref=e740]: "8"
          - paragraph [ref=e741]: "Présence : 80 %"
        - generic [ref=e742]:
          - paragraph [ref=e744]: Paiements confirmés
          - paragraph [ref=e749]: "7"
          - paragraph [ref=e750]: "Ventes en ligne : 150 000 F CFA"
        - generic [ref=e751]:
          - paragraph [ref=e753]: Net à reverser
          - paragraph [ref=e758]:
            - generic [ref=e759]: 150 000 F CFA
      - region [ref=e760]:
        - heading "Ventes par catégorie" [level=3] [ref=e761]
        - table [ref=e764]:
          - caption [ref=e765]: Ventes par catégorie
          - rowgroup [ref=e766]:
            - row [ref=e767]:
              - columnheader "Catégorie" [ref=e768]
              - columnheader "Prix unitaire" [ref=e769]
              - columnheader "Quota" [ref=e770]
              - columnheader "Vendus" [ref=e771]
              - columnheader "Entrées" [ref=e772]
              - columnheader "Ventes en ligne" [ref=e773]
          - rowgroup [ref=e774]:
            - row [ref=e775]:
              - cell "Brunch" [ref=e776]
              - cell "15 000 F CFA" [ref=e777]
              - cell "80" [ref=e778]
              - cell "10" [ref=e779]
              - cell "8" [ref=e780]
              - cell "150 000 F CFA" [ref=e781]
      - region [ref=e782]:
        - heading "Synthèse comptable" [level=3] [ref=e783]
        - generic [ref=e784]:
          - generic [ref=e785]:
            - term [ref=e786]: Ventes en ligne, prix des billets
            - definition [ref=e787]: 150 000 F CFA
          - generic [ref=e788]:
            - term [ref=e789]: Net à reverser au partenaire
            - definition [ref=e790]:
              - generic [ref=e791]: 150 000 F CFA
          - generic [ref=e792]:
            - term [ref=e793]: Dont disponible
            - definition [ref=e794]: 0 F CFA
          - generic [ref=e795]:
            - term [ref=e796]: Dont en attente
            - definition [ref=e797]: 150 000 F CFA
          - generic [ref=e798]:
            - term [ref=e799]: Frais de service payés par l’acheteur, non déduits
            - definition [ref=e800]: 7 500 F CFA
          - generic [ref=e801]:
            - term [ref=e802]: Espèces au guichet, 0 billet, hors plateforme, pour information
            - definition [ref=e803]: 0 F CFA
    - generic [ref=e806]:
      - paragraph [ref=e807]: Document généré par Event Village
      - generic [ref=e808]:
        - button "Export CSV / Excel" [ref=e809] [cursor=pointer]
        - button "Télécharger le PDF" [ref=e815] [cursor=pointer]
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
      |                                                                   ^ Error: contrôles bloquants de partenaire-rapport-cloture__ordinateur__sombre.png
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