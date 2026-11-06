# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · organisateur >> partenaire-rapport-cloture — Rapport de clôture d’un événement terminé (modale du tableau de bord)
- Location: e2e/captures.spec.ts:159:9

# Error details

```
Error: contrôles bloquants de partenaire-rapport-cloture__mobile__sombre.png

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 7

- Array []
+ Array [
+   "valeur technique affichée : CLOTURE — ex. texte : « CLOTURE-7AEA2CF2-20261106 »",
+   "46 texte(s) < 14 px hors exemption (mentions et légendes admises exclues) : 12 px « CLOTURE-7AEA2CF2-20261106 » (div.space-y-1.min-w-0 > div.flex.items-center > span.text-xs.font-mono) ; 12 px « lun. 2 nov. 2026 à 12:00 » (div.space-y-1.min-w-0 > div.flex.flex-wrap > span.flex.items-center) ; 12 px « Rooftop de la Pointe des Almadies » (div.space-y-1.min-w-0 > div.flex.flex-wrap > span.flex.items-center) ; 12 px « , » (div.space-y-1.min-w-0 > div.flex.flex-wrap > span.flex.items-center) ; 12 px « Dakar » (div.space-y-1.min-w-0 > div.flex.flex-wrap > span.flex.items-center)",
+   "axe-core color-contrast (serious, 4 nœud(s)) : Elements must meet minimum color contrast ratio thresholds",
+   "axe-core scrollable-region-focusable (serious, 2 nœud(s)) : Scrollable region must have keyboard access",
+   "axe-core target-size (serious, 1 nœud(s)) : All touch targets must be 24px large, or leave sufficient space",
+ ]
```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e2]:
    - generic [ref=e3]:
      - banner [ref=e4]:
        - generic [ref=e5]:
          - button "Ouvrir le menu" [ref=e6] [cursor=pointer]
          - link "Event Village, accueil" [ref=e10] [cursor=pointer]:
            - /url: /
        - generic [ref=e16]:
          - button "Notifications, 97 non lues" [ref=e18] [cursor=pointer]:
            - generic [ref=e22]: "97"
          - button "Basculer le thème" [pressed] [ref=e24] [cursor=pointer]
          - link "Mon profil (Mariama Ndiaye)" [ref=e32] [cursor=pointer]:
            - /url: /profile
            - generic [aria-hidden] [ref=e33]: MN
      - main [ref=e35]:
        - generic [ref=e37]:
          - generic [ref=e39]:
            - generic [ref=e40]:
              - generic [ref=e41]: Espace organisateur
              - heading "Baobab Scène" [level=1] [ref=e43]
              - paragraph [ref=e44]: Ventes, entrées et solde de vos événements, mis à jour par le serveur.
            - generic [ref=e45]:
              - button "Actualiser" [ref=e46] [cursor=pointer]
              - link "Export comptable" [ref=e54] [cursor=pointer]:
                - /url: /api/partner/reports/accounting?format=csv
              - link "Scanner des billets" [ref=e58] [cursor=pointer]:
                - /url: /partner/scan
          - status [ref=e67]:
            - generic [ref=e73]:
              - paragraph [ref=e74]: Période d’essai gratuite en cours
              - generic [ref=e75]:
                - text: 150 jours offerts, jusqu’au
                - time [ref=e76]: mar. 5 janv. 2027
                - text: .
          - region [ref=e77]:
            - heading "Indicateurs" [level=2] [ref=e78]
            - generic [ref=e79]:
              - generic [ref=e80]:
                - paragraph [ref=e82]: Ventes en ligne
                - paragraph [ref=e87]: 978 000 F CFA
                - paragraph [ref=e88]: Prix des billets vendus en ligne, tous événements.
              - generic [ref=e89]:
                - paragraph [ref=e91]: Net partenaire
                - paragraph [ref=e96]: 828 000 F CFA
                - paragraph [ref=e97]: Après 150 000 F CFA de remboursements.
              - generic [ref=e98]:
                - paragraph [ref=e100]: Billets vendus
                - paragraph [ref=e104]: "130"
                - paragraph [ref=e105]: 68 entrées validées aux portes.
              - generic [ref=e106]:
                - paragraph [ref=e108]: Disponible au retrait
                - paragraph [ref=e113]: 0 F CFA
                - paragraph [ref=e114]: "Déjà versé : 0 F CFA."
            - paragraph [ref=e115]:
              - text: Les ventes en espèces au guichet (110 000 F CFA) et les invitations n’alimentent pas le solde.
              - link "Voir mes finances" [ref=e116] [cursor=pointer]:
                - /url: /partner/finance
          - region [ref=e118]:
            - generic [ref=e119]:
              - generic [ref=e120]:
                - heading "Mes événements" [level=2] [ref=e121]
                - generic [ref=e124]: 8 au total
              - link "Tous mes événements" [ref=e126] [cursor=pointer]:
                - /url: /partner/events
            - list "Ventes, entrées et rapports par événement" [ref=e129]:
              - listitem [ref=e130]:
                - generic [ref=e131]: Concert acoustique au jardin
                - generic [ref=e132]:
                  - term [ref=e133]: Événement
                  - definition [ref=e134]:
                    - generic [ref=e135]:
                      - generic [ref=e136]: Concert acoustique au jardin
                      - generic "En cours de rédaction par l’organisateur, visible de lui seul." [ref=e137]: Brouillon
                  - term [ref=e140]: Date et lieu
                  - definition [ref=e141]:
                    - generic [ref=e142]:
                      - time [ref=e143]: mer. 16 déc. 2026 à 19:00
                      - generic [ref=e144]: Dakar
                  - term [ref=e145]: Vendus / capacité
                  - definition [ref=e146]:
                    - generic [ref=e147]:
                      - generic [ref=e148]: 0 / 100
                      - generic [ref=e149]: 0 % rempli
                  - term [ref=e150]: Entrées
                  - definition [ref=e151]:
                    - generic [ref=e152]:
                      - generic [ref=e153]: "0"
                      - generic [ref=e154]: 0 % des vendus
                  - term [ref=e155]: Ventes en ligne
                  - definition [ref=e156]: 0 F CFA
                  - term [ref=e157]: Net partenaire
                  - definition [ref=e158]: 0 F CFA
                  - term [ref=e159]: Rapports
                  - definition [ref=e160]:
                    - generic [ref=e161]:
                      - button "Clôture" [ref=e162] [cursor=pointer]
                      - button "Télécharger le rapport PDF de Concert acoustique au jardin" [ref=e168] [cursor=pointer]
                      - button "Exporter les ventes de Concert acoustique au jardin en CSV" [ref=e173] [cursor=pointer]
              - listitem [ref=e178]:
                - generic [ref=e179]: Matinée gospel et chorales
                - generic [ref=e180]:
                  - term [ref=e181]: Événement
                  - definition [ref=e182]:
                    - generic [ref=e183]:
                      - generic [ref=e184]: Matinée gospel et chorales
                      - generic "Soumis à l’équipe Event Village, qui vérifie la fiche avant validation." [ref=e185]: En attente de validation
                  - term [ref=e188]: Date et lieu
                  - definition [ref=e189]:
                    - generic [ref=e190]:
                      - time [ref=e191]: lun. 30 nov. 2026 à 10:00
                      - generic [ref=e192]: Dakar
                  - term [ref=e193]: Vendus / capacité
                  - definition [ref=e194]:
                    - generic [ref=e195]:
                      - generic [ref=e196]: 0 / 300
                      - generic [ref=e197]: 0 % rempli
                  - term [ref=e198]: Entrées
                  - definition [ref=e199]:
                    - generic [ref=e200]:
                      - generic [ref=e201]: "0"
                      - generic [ref=e202]: 0 % des vendus
                  - term [ref=e203]: Ventes en ligne
                  - definition [ref=e204]: 0 F CFA
                  - term [ref=e205]: Net partenaire
                  - definition [ref=e206]: 0 F CFA
                  - term [ref=e207]: Rapports
                  - definition [ref=e208]:
                    - generic [ref=e209]:
                      - button "Clôture" [ref=e210] [cursor=pointer]
                      - button "Télécharger le rapport PDF de Matinée gospel et chorales" [ref=e216] [cursor=pointer]
                      - button "Exporter les ventes de Matinée gospel et chorales en CSV" [ref=e221] [cursor=pointer]
              - listitem [ref=e226]:
                - generic [ref=e227]: Croisière musicale vers Gorée
                - generic [ref=e228]:
                  - term [ref=e229]: Événement
                  - definition [ref=e230]:
                    - generic [ref=e231]:
                      - generic [ref=e232]: Croisière musicale vers Gorée
                      - 'generic "Annulé : les participants sont prévenus et les billets payés sont remboursés." [ref=e233]': Annulé
                  - term [ref=e236]: Date et lieu
                  - definition [ref=e237]:
                    - generic [ref=e238]:
                      - time [ref=e239]: mar. 24 nov. 2026 à 17:30
                      - generic [ref=e240]: Dakar
                  - term [ref=e241]: Vendus / capacité
                  - definition [ref=e242]:
                    - generic [ref=e243]:
                      - generic [ref=e244]: 0 / 120
                      - generic [ref=e245]: 0 % rempli
                  - term [ref=e246]: Entrées
                  - definition [ref=e247]:
                    - generic [ref=e248]:
                      - generic [ref=e249]: "0"
                      - generic [ref=e250]: 0 % des vendus
                  - term [ref=e251]: Ventes en ligne
                  - definition [ref=e252]: 150 000 F CFA
                  - term [ref=e253]: Net partenaire
                  - definition [ref=e254]: 0 F CFA
                  - term [ref=e255]: Rapports
                  - definition [ref=e256]:
                    - generic [ref=e257]:
                      - button "Clôture" [ref=e258] [cursor=pointer]
                      - button "Télécharger le rapport PDF de Croisière musicale vers Gorée" [ref=e264] [cursor=pointer]
                      - button "Exporter les ventes de Croisière musicale vers Gorée en CSV" [ref=e269] [cursor=pointer]
              - listitem [ref=e274]:
                - generic [ref=e275]: Soirée Kora & Lumières
                - generic [ref=e276]:
                  - term [ref=e277]: Événement
                  - definition [ref=e278]:
                    - generic [ref=e279]:
                      - generic [ref=e280]: Soirée Kora & Lumières
                      - 'generic "En ligne : la page publique est visible et la billetterie est ouverte." [ref=e281]': Publié
                  - term [ref=e284]: Date et lieu
                  - definition [ref=e285]:
                    - generic [ref=e286]:
                      - time [ref=e287]: lun. 23 nov. 2026 à 20:30
                      - generic [ref=e288]: Dakar
                  - term [ref=e289]: Vendus / capacité
                  - definition [ref=e290]:
                    - generic [ref=e291]:
                      - generic [ref=e292]: 5 / 150
                      - generic [ref=e293]: 3 % rempli
                  - term [ref=e294]: Entrées
                  - definition [ref=e295]:
                    - generic [ref=e296]:
                      - generic [ref=e297]: "0"
                      - generic [ref=e298]: 0 % des vendus
                  - term [ref=e299]: Ventes en ligne
                  - definition [ref=e300]: 42 000 F CFA
                  - term [ref=e301]: Net partenaire
                  - definition [ref=e302]: 42 000 F CFA
                  - term [ref=e303]: Rapports
                  - definition [ref=e304]:
                    - generic [ref=e305]:
                      - button "Clôture" [ref=e306] [cursor=pointer]
                      - button "Télécharger le rapport PDF de Soirée Kora & Lumières" [ref=e312] [cursor=pointer]
                      - button "Exporter les ventes de Soirée Kora & Lumières en CSV" [ref=e317] [cursor=pointer]
              - listitem [ref=e322]:
                - generic [ref=e323]: Festival Jazz sur le Fleuve
                - generic [ref=e324]:
                  - term [ref=e325]: Événement
                  - definition [ref=e326]:
                    - generic [ref=e327]:
                      - generic [ref=e328]: Festival Jazz sur le Fleuve
                      - 'generic "En ligne : la page publique est visible et la billetterie est ouverte." [ref=e329]': Publié
                  - term [ref=e332]: Date et lieu
                  - definition [ref=e333]:
                    - generic [ref=e334]:
                      - time [ref=e335]: mer. 18 nov. 2026 à 18:00
                      - generic [ref=e336]: Saint-Louis
                  - term [ref=e337]: Vendus / capacité
                  - definition [ref=e338]:
                    - generic [ref=e339]:
                      - generic [ref=e340]: 22 / 400
                      - generic [ref=e341]: 6 % rempli
                  - term [ref=e342]: Entrées
                  - definition [ref=e343]:
                    - generic [ref=e344]:
                      - generic [ref=e345]: "0"
                      - generic [ref=e346]: 0 % des vendus
                  - term [ref=e347]: Ventes en ligne
                  - definition [ref=e348]: 201 000 F CFA
                  - term [ref=e349]: Net partenaire
                  - definition [ref=e350]: 201 000 F CFA
                  - term [ref=e351]: Rapports
                  - definition [ref=e352]:
                    - generic [ref=e353]:
                      - button "Clôture" [ref=e354] [cursor=pointer]
                      - button "Télécharger le rapport PDF de Festival Jazz sur le Fleuve" [ref=e360] [cursor=pointer]
                      - button "Exporter les ventes de Festival Jazz sur le Fleuve en CSV" [ref=e365] [cursor=pointer]
              - listitem [ref=e370]:
                - generic [ref=e371]: Concert des Lumières de Gorée
                - generic [ref=e372]:
                  - term [ref=e373]: Événement
                  - definition [ref=e374]:
                    - generic [ref=e375]:
                      - generic [ref=e376]: Concert des Lumières de Gorée
                      - 'generic "En ligne : la page publique est visible et la billetterie est ouverte." [ref=e377]': Publié
                  - term [ref=e380]: Date et lieu
                  - definition [ref=e381]:
                    - generic [ref=e382]:
                      - time [ref=e383]: sam. 7 nov. 2026 à 17:30
                      - generic [ref=e384]: Gorée
                  - term [ref=e385]: Vendus / capacité
                  - definition [ref=e386]:
                    - generic [ref=e387]:
                      - generic [ref=e388]: 11 / 250
                      - generic [ref=e389]: 4 % rempli
                  - term [ref=e390]: Entrées
                  - definition [ref=e391]:
                    - generic [ref=e392]:
                      - generic [ref=e393]: "0"
                      - generic [ref=e394]: 0 % des vendus
                  - term [ref=e395]: Ventes en ligne
                  - definition [ref=e396]: 84 000 F CFA
                  - term [ref=e397]: Net partenaire
                  - definition [ref=e398]: 84 000 F CFA
                  - term [ref=e399]: Rapports
                  - definition [ref=e400]:
                    - generic [ref=e401]:
                      - button "Clôture" [ref=e402] [cursor=pointer]
                      - button "Télécharger le rapport PDF de Concert des Lumières de Gorée" [ref=e408] [cursor=pointer]
                      - button "Exporter les ventes de Concert des Lumières de Gorée en CSV" [ref=e413] [cursor=pointer]
              - listitem [ref=e418]:
                - generic [ref=e419]: Nuit du Sabar — édition d’automne
                - generic [ref=e420]:
                  - term [ref=e421]: Événement
                  - definition [ref=e422]:
                    - generic [ref=e423]:
                      - generic [ref=e424]: Nuit du Sabar — édition d’automne
                      - 'generic "En ligne : la page publique est visible et la billetterie est ouverte." [ref=e425]': Publié
                  - term [ref=e428]: Date et lieu
                  - definition [ref=e429]:
                    - generic [ref=e430]:
                      - time [ref=e431]: ven. 6 nov. 2026 à 22:15
                      - generic [ref=e432]: Dakar
                  - term [ref=e433]: Vendus / capacité
                  - definition [ref=e434]:
                    - generic [ref=e435]:
                      - generic [ref=e436]: 82 / 300
                      - generic [ref=e437]: 27 % rempli
                  - term [ref=e438]: Entrées
                  - definition [ref=e439]:
                    - generic [ref=e440]:
                      - generic [ref=e441]: "60"
                      - generic [ref=e442]: 73 % des vendus
                  - term [ref=e443]: Ventes en ligne
                  - definition [ref=e444]: 351 000 F CFA
                  - term [ref=e445]: Net partenaire
                  - definition [ref=e446]: 351 000 F CFA
                  - term [ref=e447]: Rapports
                  - definition [ref=e448]:
                    - generic [ref=e449]:
                      - button "Clôture" [ref=e450] [cursor=pointer]
                      - button "Télécharger le rapport PDF de Nuit du Sabar — édition d’automne" [ref=e456] [cursor=pointer]
                      - button "Exporter les ventes de Nuit du Sabar — édition d’automne en CSV" [ref=e461] [cursor=pointer]
              - listitem [ref=e466]:
                - generic [ref=e467]: Brunch électro des Almadies
                - generic [ref=e468]:
                  - term [ref=e469]: Événement
                  - definition [ref=e470]:
                    - generic [ref=e471]:
                      - generic [ref=e472]: Brunch électro des Almadies
                      - 'generic "L’événement est passé : la vente est close, le bilan reste consultable." [ref=e473]': Terminé
                  - term [ref=e476]: Date et lieu
                  - definition [ref=e477]:
                    - generic [ref=e478]:
                      - time [ref=e479]: lun. 2 nov. 2026 à 12:00
                      - generic [ref=e480]: Dakar
                  - term [ref=e481]: Vendus / capacité
                  - definition [ref=e482]:
                    - generic [ref=e483]:
                      - generic [ref=e484]: 10 / 80
                      - generic [ref=e485]: 13 % rempli
                  - term [ref=e486]: Entrées
                  - definition [ref=e487]:
                    - generic [ref=e488]:
                      - generic [ref=e489]: "8"
                      - generic [ref=e490]: 80 % des vendus
                  - term [ref=e491]: Ventes en ligne
                  - definition [ref=e492]: 150 000 F CFA
                  - term [ref=e493]: Net partenaire
                  - definition [ref=e494]: 150 000 F CFA
                  - term [ref=e495]: Rapports
                  - definition [ref=e496]:
                    - generic [ref=e497]:
                      - button "Clôture" [ref=e498] [cursor=pointer]
                      - button "Télécharger le rapport PDF de Brunch électro des Almadies" [ref=e504] [cursor=pointer]
                      - button "Exporter les ventes de Brunch électro des Almadies en CSV" [ref=e509] [cursor=pointer]
          - region [ref=e515]:
            - heading "Activité récente" [level=2] [ref=e516]
            - list [ref=e519]:
              - listitem [ref=e520]:
                - generic [ref=e525]:
                  - paragraph [ref=e526]: "Billet vendu : Nuit du Sabar — édition d’automne"
                  - paragraph [ref=e527]: Billet TCK-20261106-AFD0D7FF32 · 5 000 F CFA
                - time [ref=e528]: ven. 6 nov. 2026 à 21:31
              - listitem [ref=e529]:
                - generic [ref=e534]:
                  - paragraph [ref=e535]: "Billet vendu : Nuit du Sabar — édition d’automne"
                  - paragraph [ref=e536]: Billet TCK-20261106-F8F80CA495 · 5 000 F CFA
                - time [ref=e537]: ven. 6 nov. 2026 à 21:31
              - listitem [ref=e538]:
                - generic [ref=e543]:
                  - paragraph [ref=e544]: "Billet vendu : Nuit du Sabar — édition d’automne"
                  - paragraph [ref=e545]: Billet TCK-20261106-A0E5C0E90A · 5 000 F CFA
                - time [ref=e546]: ven. 6 nov. 2026 à 21:31
              - listitem [ref=e547]:
                - generic [ref=e552]:
                  - paragraph [ref=e553]: "Billet vendu : Nuit du Sabar — édition d’automne"
                  - paragraph [ref=e554]: Billet TCK-20261106-40697CB989 · 5 000 F CFA
                - time [ref=e555]: ven. 6 nov. 2026 à 21:31
              - listitem [ref=e556]:
                - generic [ref=e561]:
                  - paragraph [ref=e562]: "Billet vendu : Nuit du Sabar — édition d’automne"
                  - paragraph [ref=e563]: Billet TCK-20261106-B03D1C44F2 · 15 000 F CFA
                - time [ref=e564]: ven. 6 nov. 2026 à 21:31
              - listitem [ref=e565]:
                - generic [ref=e570]:
                  - paragraph [ref=e571]: "Billet vendu : Nuit du Sabar — édition d’automne"
                  - paragraph [ref=e572]: Billet TCK-20261106-2124CD6580 · 15 000 F CFA
                - time [ref=e573]: ven. 6 nov. 2026 à 21:31
              - listitem [ref=e574]:
                - generic [ref=e579]:
                  - paragraph [ref=e580]: "Billet vendu : Nuit du Sabar — édition d’automne"
                  - paragraph [ref=e581]: Billet TCK-20261106-B679089A0D · 15 000 F CFA
                - time [ref=e582]: ven. 6 nov. 2026 à 21:31
              - listitem [ref=e583]:
                - generic [ref=e588]:
                  - paragraph [ref=e589]: "Billet vendu : Nuit du Sabar — édition d’automne"
                  - paragraph [ref=e590]: Billet TCK-20261106-3818540BA6 · 5 000 F CFA
                - time [ref=e591]: ven. 6 nov. 2026 à 21:31
              - listitem [ref=e592]:
                - generic [ref=e598]:
                  - paragraph [ref=e599]: Commande CMD-DEMO-1794000670198-40C2AC
                  - paragraph [ref=e600]: Sur place · 15 000 F CFA
                - time [ref=e601]: ven. 6 nov. 2026 à 21:31
              - listitem [ref=e602]:
                - generic [ref=e611]:
                  - paragraph [ref=e612]: Entrée validée
                  - paragraph [ref=e613]: Nuit du Sabar — édition d’automne · contrôle à l’entrée
                - time [ref=e614]: ven. 6 nov. 2026 à 21:28
              - listitem [ref=e615]:
                - generic [ref=e624]:
                  - paragraph [ref=e625]: Entrée validée
                  - paragraph [ref=e626]: Nuit du Sabar — édition d’automne · contrôle à l’entrée
                - time [ref=e627]: ven. 6 nov. 2026 à 21:27
              - listitem [ref=e628]:
                - generic [ref=e637]:
                  - paragraph [ref=e638]: Entrée validée
                  - paragraph [ref=e639]: Nuit du Sabar — édition d’automne · contrôle à l’entrée
                - time [ref=e640]: ven. 6 nov. 2026 à 21:25
              - listitem [ref=e641]:
                - generic [ref=e650]:
                  - paragraph [ref=e651]: Entrée validée
                  - paragraph [ref=e652]: Nuit du Sabar — édition d’automne · contrôle à l’entrée
                - time [ref=e653]: ven. 6 nov. 2026 à 21:24
              - listitem [ref=e654]:
                - generic [ref=e663]:
                  - paragraph [ref=e664]: Entrée validée
                  - paragraph [ref=e665]: Nuit du Sabar — édition d’automne · contrôle à l’entrée
                - time [ref=e666]: ven. 6 nov. 2026 à 21:22
    - navigation "Navigation rapide" [ref=e667]:
      - generic [ref=e668]:
        - link "Accueil" [ref=e669] [cursor=pointer]:
          - /url: /partner/dashboard
        - link "Billetterie" [ref=e676] [cursor=pointer]:
          - /url: /partner/events
        - link "Scanner" [ref=e680] [cursor=pointer]:
          - /url: /partner/scan
        - link "Finances" [ref=e688] [cursor=pointer]:
          - /url: /partner/finance
        - link "Profil" [ref=e692] [cursor=pointer]:
          - /url: /partner/profile
  - alert [ref=e697]
  - dialog [active] [ref=e700]:
    - generic [ref=e701]:
      - generic [ref=e707]:
        - heading "Rapport de Clôture & Bilan Z" [level=2] [ref=e708]
        - paragraph [ref=e709]: Brunch électro des Almadies
      - button "Fermer" [ref=e710] [cursor=pointer]
    - generic [ref=e716]:
      - generic [ref=e717]:
        - generic [ref=e718]:
          - generic [ref=e719]:
            - generic [ref=e720]: CLOTURE-7AEA2CF2-20261106
            - generic [ref=e721]: Clôture Certifiée
          - heading "Brunch électro des Almadies" [level=4] [ref=e723]
          - generic [ref=e724]:
            - generic [ref=e725]: lun. 2 nov. 2026 à 12:00
            - generic [ref=e728]: Rooftop de la Pointe des Almadies, Dakar
        - generic [ref=e732]:
          - generic [ref=e733]: Net Partenaire à Reverser
          - text: 150 000 F CFA
      - generic [ref=e734]:
        - generic [ref=e735]:
          - generic [ref=e736]: Billets Vendus
          - generic [ref=e743]: 10 / 80
          - paragraph [ref=e744]: "Taux de remplissage : 13%"
        - generic [ref=e745]:
          - generic [ref=e746]: Entrées Validées (Scan)
          - generic [ref=e754]: 8 entrées
          - paragraph [ref=e755]: "Taux de présence : 80%"
        - generic [ref=e756]:
          - generic [ref=e757]: Paiements Confirmés
          - generic [ref=e761]: 7 transactions
          - paragraph [ref=e762]: "Ventes en ligne : 150 000 F CFA"
      - generic [ref=e763]:
        - heading "1. Ventilation des Ventes par Catégorie" [level=5] [ref=e764]
        - table [ref=e766]:
          - rowgroup [ref=e767]:
            - row [ref=e768]:
              - columnheader "Formule / Catégorie" [ref=e769]
              - columnheader "Prix Unit." [ref=e770]
              - columnheader "Alloués" [ref=e771]
              - columnheader "Vendus" [ref=e772]
              - columnheader "Compostés" [ref=e773]
              - columnheader "Ventes en ligne" [ref=e774]
          - rowgroup [ref=e775]:
            - row [ref=e776]:
              - cell "Brunch" [ref=e777]
              - cell "15 000 F CFA" [ref=e778]
              - cell "80" [ref=e779]
              - cell "10" [ref=e780]
              - cell "8" [ref=e781]
              - cell "150 000 F CFA" [ref=e782]
      - generic [ref=e783]:
        - heading "2. Synthèse Comptable & Reversement Net" [level=5] [ref=e784]
        - generic [ref=e788]:
          - generic [ref=e789]:
            - generic [ref=e790]: "Ventes en ligne (prix faciaux des billets) :"
            - generic [ref=e791]: 150 000 F CFA
          - generic [ref=e792]:
            - generic [ref=e793]: "Montant Net à Reverser au Partenaire :"
            - generic [ref=e794]: 150 000 F CFA
          - generic [ref=e795]: "Dont disponible : 0 F CFA · en attente : 150 000 F CFA"
          - generic [ref=e797]:
            - generic [ref=e798]: "Frais de service payés par l'acheteur (non déduits) :"
            - generic [ref=e799]: 7 500 F CFA
          - generic [ref=e800]:
            - generic [ref=e801]: "Ventes espèces au guichet (0 billet, hors plateforme, informatif) :"
            - generic [ref=e802]: 0 F CFA
    - generic [ref=e804]:
      - generic [ref=e805]: Document certifié Event Village • Conforme CDC V3.0
      - generic [ref=e810]:
        - button "Export CSV / Excel" [ref=e811] [cursor=pointer]
        - button "Télécharger PDF Officiel" [ref=e817] [cursor=pointer]
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
      |                                                                   ^ Error: contrôles bloquants de partenaire-rapport-cloture__mobile__sombre.png
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