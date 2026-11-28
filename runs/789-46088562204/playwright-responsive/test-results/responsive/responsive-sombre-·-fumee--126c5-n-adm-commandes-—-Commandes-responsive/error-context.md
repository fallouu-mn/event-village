# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> sombre · fumee-superadmin >> adm-commandes — Commandes
- Location: e2e/responsive.spec.ts:77:21

# Error details

```
Error: contrôles responsive de adm-commandes (sombre)

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "1440 px : 20 texte(s) < 14 px hors exemption (mentions et légendes admises exclues) : 12 px « Petite-Côte Événements » (td.px-4.py-3 > span.break-words > span.block.text-xs) ; 12 px « Petite-Côte Événements » (td.px-4.py-3 > span.break-words > span.block.text-xs) ; 12 px « Petite-Côte Événements » (td.px-4.py-3 > span.break-words > span.block.text-xs) ; 12 px « Petite-Côte Événements » (td.px-4.py-3 > span.break-words > span.block.text-xs) ; 12 px « Petite-Côte Événements » (td.px-4.py-3 > span.break-words > span.block.text-xs)",
+ ]
```

# Page snapshot

```yaml
- generic [active] [ref=f2e1]:
  - generic [ref=f2e2]:
    - complementary [ref=f2e4]:
      - generic [ref=f2e5]:
        - link "Event Village, accueil" [ref=f2e7] [cursor=pointer]:
          - /url: /
          - generic [ref=f2e8]: Event Village
        - button "Replier la barre latérale" [expanded] [ref=f2e11] [cursor=pointer]
      - navigation "Navigation principale" [ref=f2e16]:
        - generic [ref=f2e17]: Administration
        - link "Tableau de bord" [ref=f2e22] [cursor=pointer]:
          - /url: /admin/dashboard
        - generic [ref=f2e29]:
          - paragraph [ref=f2e30]: Gestion
          - generic [ref=f2e31]:
            - link "Événements" [ref=f2e32] [cursor=pointer]:
              - /url: /admin/events
            - link "Comptes" [ref=f2e36] [cursor=pointer]:
              - /url: /admin/users
            - link "Catalogues et services" [ref=f2e43] [cursor=pointer]:
              - /url: /admin/services
            - link "Salles à valider" [ref=f2e49] [cursor=pointer]:
              - /url: /admin/halls
            - link "Produits à vérifier" [ref=f2e55] [cursor=pointer]:
              - /url: /admin/products
            - link "Commandes" [ref=f2e60] [cursor=pointer]:
              - /url: /admin/orders
        - generic [ref=f2e65]:
          - paragraph [ref=f2e66]: Finances
          - link "Finance" [ref=f2e68] [cursor=pointer]:
            - /url: /admin/finance
        - generic [ref=f2e72]:
          - paragraph [ref=f2e73]: Engagement
          - generic [ref=f2e74]:
            - link "Parrainage" [ref=f2e75] [cursor=pointer]:
              - /url: /admin/referral
            - link "Campagnes" [ref=f2e80] [cursor=pointer]:
              - /url: /admin/communications
            - link "À la une" [ref=f2e85] [cursor=pointer]:
              - /url: /admin/a-la-une
        - generic [ref=f2e89]:
          - paragraph [ref=f2e90]: Système
          - generic [ref=f2e91]:
            - link "Réglages" [ref=f2e92] [cursor=pointer]:
              - /url: /admin/finance-settings
            - link "Journal d’audit" [ref=f2e97] [cursor=pointer]:
              - /url: /admin/audit
            - link "Notifications" [ref=f2e102] [cursor=pointer]:
              - /url: /admin/notifications
            - link "Scanner" [ref=f2e109] [cursor=pointer]:
              - /url: /scan
            - link "Sécurité du compte" [ref=f2e117] [cursor=pointer]:
              - /url: /admin/securite
        - link "Retour au site" [ref=f2e123] [cursor=pointer]:
          - /url: /
      - generic [ref=f2e128]:
        - link "Elhadji SuperAdmin Super-administrateur" [ref=f2e129] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=f2e131]: ES
          - generic [ref=f2e132]:
            - generic [ref=f2e133]: Elhadji SuperAdmin
            - generic [ref=f2e134]: Super-administrateur
        - generic [ref=f2e135]:
          - button "Se déconnecter" [ref=f2e136] [cursor=pointer]
          - button "Basculer le thème" [pressed] [ref=f2e141] [cursor=pointer]
    - generic [ref=f2e149]:
      - banner [ref=f2e150]:
        - link "Rechercher un événement…" [ref=f2e152] [cursor=pointer]:
          - /url: /explore
        - generic [ref=f2e157]:
          - button "Notifications, 65 non lues" [ref=f2e159] [cursor=pointer]:
            - generic [ref=f2e163]: "65"
          - button "Elhadji SuperAdmin" [ref=f2e165] [cursor=pointer]:
            - generic [aria-hidden] [ref=f2e166]: ES
      - main [ref=f2e168]:
        - generic [ref=f2e170]:
          - generic [ref=f2e173]:
            - heading "Commandes" [level=1] [ref=f2e174]
            - paragraph [ref=f2e175]: "Toutes les commandes des établissements : suivez les étapes, annulez et remboursez, décidez après l’absence d’un client et répondez aux signalements."
          - generic [ref=f2e176]:
            - group "Groupe de commandes" [ref=f2e177]:
              - button "À décider" [ref=f2e178] [cursor=pointer]
              - button "En cours" [ref=f2e179] [cursor=pointer]
              - button "Terminées" [ref=f2e180] [cursor=pointer]
              - button "Annulées" [ref=f2e181] [cursor=pointer]
              - button "Non payées" [ref=f2e182] [cursor=pointer]
              - button "Toutes" [pressed] [ref=f2e183] [cursor=pointer]:
                - generic [aria-hidden] [ref=f2e184]: ✓
                - text: Toutes
            - search [ref=f2e185]:
              - generic [ref=f2e186]:
                - generic [ref=f2e187]: Rechercher une commande
                - textbox "Rechercher une commande" [ref=f2e189]
                - paragraph [ref=f2e190]: Numéro de commande, nom de l’établissement ou de la partenaire.
              - button "Rechercher" [ref=f2e191] [cursor=pointer]
          - generic [ref=f2e197]:
            - paragraph [ref=f2e198]: 27 commandes
            - region "Commandes des établissements" [ref=f2e200]:
              - table [ref=f2e201]:
                - caption [ref=f2e202]: Commandes des établissements
                - rowgroup [ref=f2e203]:
                  - row [ref=f2e204]:
                    - columnheader "Commande" [ref=f2e205]
                    - columnheader "État" [ref=f2e206]
                    - columnheader "À suivre" [ref=f2e207]
                    - columnheader "Établissement" [ref=f2e208]
                    - columnheader "Remise" [ref=f2e209]
                    - columnheader "Client" [ref=f2e210]
                    - columnheader "Créée le" [ref=f2e211]
                    - columnheader "Total" [ref=f2e212]
                    - columnheader "Payé en ligne" [ref=f2e213]
                    - columnheader "Remboursé" [ref=f2e214]
                - rowgroup [ref=f2e215]:
                  - row [ref=f2e216]:
                    - cell [ref=f2e217]:
                      - link "CMD-261128-CD1E67" [ref=f2e218] [cursor=pointer]:
                        - /url: /admin/orders/934286fc-dc68-4917-bea5-a944390ca106
                    - cell "Annulée par le client" [ref=f2e219]
                    - cell "—" [ref=f2e222]
                    - cell "Chez Fatou ee4c0d Petite-Côte Événements" [ref=f2e223]:
                      - generic [ref=f2e224]:
                        - text: Chez Fatou ee4c0d
                        - generic [ref=f2e225]: Petite-Côte Événements
                    - cell "Retrait" [ref=f2e226]
                    - cell "Birame ClientBis" [ref=f2e227]
                    - cell [ref=f2e228]:
                      - time [ref=f2e229]: sam. 28 nov. 2026 à 00:44
                    - cell "3 000 F CFA" [ref=f2e230]
                    - cell "0 F CFA" [ref=f2e231]
                    - cell "—" [ref=f2e232]
                  - row [ref=f2e233]:
                    - cell [ref=f2e234]:
                      - link "CMD-261128-D734BF" [ref=f2e235] [cursor=pointer]:
                        - /url: /admin/orders/b0bcfb65-c2e1-4d9c-a412-bb53735730a8
                    - cell "Annulée par le client" [ref=f2e236]
                    - cell "—" [ref=f2e239]
                    - cell "Chez Fatou ee4c0d Petite-Côte Événements" [ref=f2e240]:
                      - generic [ref=f2e241]:
                        - text: Chez Fatou ee4c0d
                        - generic [ref=f2e242]: Petite-Côte Événements
                    - cell "Retrait" [ref=f2e243]
                    - cell "Birame ClientBis" [ref=f2e244]
                    - cell [ref=f2e245]:
                      - time [ref=f2e246]: sam. 28 nov. 2026 à 00:44
                    - cell "3 000 F CFA" [ref=f2e247]
                    - cell "0 F CFA" [ref=f2e248]
                    - cell "—" [ref=f2e249]
                  - row [ref=f2e250]:
                    - cell [ref=f2e251]:
                      - link "CMD-261128-88F46B" [ref=f2e252] [cursor=pointer]:
                        - /url: /admin/orders/bc81f730-abe0-4bab-8aaf-cabc224acd5f
                    - cell "Retirée" [ref=f2e253]
                    - cell "—" [ref=f2e256]
                    - cell "Chez Fatou ee4c0d Petite-Côte Événements" [ref=f2e257]:
                      - generic [ref=f2e258]:
                        - text: Chez Fatou ee4c0d
                        - generic [ref=f2e259]: Petite-Côte Événements
                    - cell "Retrait" [ref=f2e260]
                    - cell "Birame ClientBis" [ref=f2e261]
                    - cell [ref=f2e262]:
                      - time [ref=f2e263]: sam. 28 nov. 2026 à 00:44
                    - cell "3 900 F CFA" [ref=f2e264]
                    - cell "4 095 F CFA" [ref=f2e265]
                    - cell "—" [ref=f2e266]
                  - row [ref=f2e267]:
                    - cell [ref=f2e268]:
                      - link "CMD-261128-FE91E4" [ref=f2e269] [cursor=pointer]:
                        - /url: /admin/orders/5c0f1462-4148-4b89-b81e-772a038c0392
                    - cell "Annulée par le client" [ref=f2e270]
                    - cell "—" [ref=f2e273]
                    - cell "Chez Fatou ee4c0d Petite-Côte Événements" [ref=f2e274]:
                      - generic [ref=f2e275]:
                        - text: Chez Fatou ee4c0d
                        - generic [ref=f2e276]: Petite-Côte Événements
                    - cell "Retrait" [ref=f2e277]
                    - cell "Birame ClientBis" [ref=f2e278]
                    - cell [ref=f2e279]:
                      - time [ref=f2e280]: sam. 28 nov. 2026 à 00:43
                    - cell "3 000 F CFA" [ref=f2e281]
                    - cell "0 F CFA" [ref=f2e282]
                    - cell "—" [ref=f2e283]
                  - row [ref=f2e284]:
                    - cell [ref=f2e285]:
                      - link "CMD-261128-7AE08C" [ref=f2e286] [cursor=pointer]:
                        - /url: /admin/orders/ec186e9a-9ad7-4c98-a12f-62938428da41
                    - cell "Annulée par le client" [ref=f2e287]
                    - cell "—" [ref=f2e290]
                    - cell "Chez Fatou ee4c0d Petite-Côte Événements" [ref=f2e291]:
                      - generic [ref=f2e292]:
                        - text: Chez Fatou ee4c0d
                        - generic [ref=f2e293]: Petite-Côte Événements
                    - cell "Retrait" [ref=f2e294]
                    - cell "Birame ClientBis" [ref=f2e295]
                    - cell [ref=f2e296]:
                      - time [ref=f2e297]: sam. 28 nov. 2026 à 00:43
                    - cell "3 000 F CFA" [ref=f2e298]
                    - cell "0 F CFA" [ref=f2e299]
                    - cell "—" [ref=f2e300]
                  - row [ref=f2e301]:
                    - cell [ref=f2e302]:
                      - link "CMD-261128-E9128F" [ref=f2e303] [cursor=pointer]:
                        - /url: /admin/orders/a31cc8bb-fedc-4918-9fae-fd29feb6355f
                    - cell "Retirée" [ref=f2e304]
                    - cell "—" [ref=f2e307]
                    - cell "Chez Fatou ee4c0d Petite-Côte Événements" [ref=f2e308]:
                      - generic [ref=f2e309]:
                        - text: Chez Fatou ee4c0d
                        - generic [ref=f2e310]: Petite-Côte Événements
                    - cell "Retrait" [ref=f2e311]
                    - cell "Birame ClientBis" [ref=f2e312]
                    - cell [ref=f2e313]:
                      - time [ref=f2e314]: sam. 28 nov. 2026 à 00:42
                    - cell "3 900 F CFA" [ref=f2e315]
                    - cell "4 095 F CFA" [ref=f2e316]
                    - cell "—" [ref=f2e317]
                  - row [ref=f2e318]:
                    - cell [ref=f2e319]:
                      - link "CMD-261128-6683A7" [ref=f2e320] [cursor=pointer]:
                        - /url: /admin/orders/0435d8ce-58e0-4c76-a711-435df0813a64
                    - cell "Annulée par le client" [ref=f2e321]
                    - cell "—" [ref=f2e324]
                    - cell "Chez Fatou ee4c0d Petite-Côte Événements" [ref=f2e325]:
                      - generic [ref=f2e326]:
                        - text: Chez Fatou ee4c0d
                        - generic [ref=f2e327]: Petite-Côte Événements
                    - cell "Retrait" [ref=f2e328]
                    - cell "Birame ClientBis" [ref=f2e329]
                    - cell [ref=f2e330]:
                      - time [ref=f2e331]: sam. 28 nov. 2026 à 00:42
                    - cell "3 000 F CFA" [ref=f2e332]
                    - cell "0 F CFA" [ref=f2e333]
                    - cell "—" [ref=f2e334]
                  - row [ref=f2e335]:
                    - cell [ref=f2e336]:
                      - link "CMD-261128-A376DE" [ref=f2e337] [cursor=pointer]:
                        - /url: /admin/orders/003168ac-d4c5-4ee5-903e-df840d93544e
                    - cell "Annulée par le client" [ref=f2e338]
                    - cell "—" [ref=f2e341]
                    - cell "Chez Fatou ee4c0d Petite-Côte Événements" [ref=f2e342]:
                      - generic [ref=f2e343]:
                        - text: Chez Fatou ee4c0d
                        - generic [ref=f2e344]: Petite-Côte Événements
                    - cell "Retrait" [ref=f2e345]
                    - cell "Birame ClientBis" [ref=f2e346]
                    - cell [ref=f2e347]:
                      - time [ref=f2e348]: sam. 28 nov. 2026 à 00:42
                    - cell "3 000 F CFA" [ref=f2e349]
                    - cell "0 F CFA" [ref=f2e350]
                    - cell "—" [ref=f2e351]
                  - row [ref=f2e352]:
                    - cell [ref=f2e353]:
                      - link "CMD-261128-86E24B" [ref=f2e354] [cursor=pointer]:
                        - /url: /admin/orders/82dbf0d0-d3a0-47a9-961e-88185fd2f79f
                    - cell "Servie" [ref=f2e355]
                    - cell "—" [ref=f2e358]
                    - cell "Chez Fatou 5c4e48 Saloum Culture" [ref=f2e359]:
                      - generic [ref=f2e360]:
                        - text: Chez Fatou 5c4e48
                        - generic [ref=f2e361]: Saloum Culture
                    - cell "Sur place" [ref=f2e362]
                    - cell "Awa Sarr" [ref=f2e363]
                    - cell [ref=f2e364]:
                      - time [ref=f2e365]: sam. 28 nov. 2026 à 00:41
                    - cell "2 000 F CFA" [ref=f2e366]
                    - cell "0 F CFA" [ref=f2e367]
                    - cell "—" [ref=f2e368]
                  - row [ref=f2e369]:
                    - cell [ref=f2e370]:
                      - link "CMD-261128-175118" [ref=f2e371] [cursor=pointer]:
                        - /url: /admin/orders/d639dda9-07a7-495c-a6f3-347463e77583
                    - cell "Servie" [ref=f2e372]
                    - cell "—" [ref=f2e375]
                    - cell "Chez Fatou 5c4e48 Saloum Culture" [ref=f2e376]:
                      - generic [ref=f2e377]:
                        - text: Chez Fatou 5c4e48
                        - generic [ref=f2e378]: Saloum Culture
                    - cell "Sur place" [ref=f2e379]
                    - cell "Awa Sarr" [ref=f2e380]
                    - cell [ref=f2e381]:
                      - time [ref=f2e382]: sam. 28 nov. 2026 à 00:41
                    - cell "3 000 F CFA" [ref=f2e383]
                    - cell "0 F CFA" [ref=f2e384]
                    - cell "—" [ref=f2e385]
                  - row [ref=f2e386]:
                    - cell [ref=f2e387]:
                      - link "CMD-261128-CD92AE" [ref=f2e388] [cursor=pointer]:
                        - /url: /admin/orders/5713f8f4-626c-498f-ad38-4dd7bd691dd4
                    - cell "Acceptée" [ref=f2e389]
                    - cell "—" [ref=f2e392]
                    - cell "Le Baobab 872243 Saloum Culture" [ref=f2e393]:
                      - generic [ref=f2e394]:
                        - text: Le Baobab 872243
                        - generic [ref=f2e395]: Saloum Culture
                    - cell "Retrait" [ref=f2e396]
                    - cell "Awa Sarr" [ref=f2e397]
                    - cell [ref=f2e398]:
                      - time [ref=f2e399]: sam. 28 nov. 2026 à 00:41
                    - cell "10 500 F CFA" [ref=f2e400]
                    - cell "0 F CFA" [ref=f2e401]
                    - cell "—" [ref=f2e402]
                  - row [ref=f2e403]:
                    - cell [ref=f2e404]:
                      - link "CMD-261128-80C728" [ref=f2e405] [cursor=pointer]:
                        - /url: /admin/orders/28057a3f-17ff-481c-9961-c95be6be9521
                    - cell "En route" [ref=f2e406]
                    - cell "—" [ref=f2e409]
                    - cell "Chez Fatou 5c4e48 Saloum Culture" [ref=f2e410]:
                      - generic [ref=f2e411]:
                        - text: Chez Fatou 5c4e48
                        - generic [ref=f2e412]: Saloum Culture
                    - cell "Livraison" [ref=f2e413]
                    - cell "Awa Sarr" [ref=f2e414]
                    - cell [ref=f2e415]:
                      - time [ref=f2e416]: sam. 28 nov. 2026 à 00:41
                    - cell "10 500 F CFA" [ref=f2e417]
                    - cell "0 F CFA" [ref=f2e418]
                    - cell "—" [ref=f2e419]
                  - row [ref=f2e420]:
                    - cell [ref=f2e421]:
                      - link "CMD-261128-B18AC9" [ref=f2e422] [cursor=pointer]:
                        - /url: /admin/orders/ba3b8c47-a78c-44e5-8ac3-5cc03c2718d5
                    - cell "En préparation" [ref=f2e423]
                    - cell "À décider Signalement" [ref=f2e426]:
                      - generic [ref=f2e427]:
                        - generic [ref=f2e428]: À décider
                        - generic [ref=f2e433]: Signalement
                    - cell "Le Baobab 872243 Saloum Culture" [ref=f2e438]:
                      - generic [ref=f2e439]:
                        - text: Le Baobab 872243
                        - generic [ref=f2e440]: Saloum Culture
                    - cell "Retrait" [ref=f2e441]
                    - cell "Awa Sarr" [ref=f2e442]
                    - cell [ref=f2e443]:
                      - time [ref=f2e444]: sam. 28 nov. 2026 à 00:41
                    - cell "4 500 F CFA" [ref=f2e445]
                    - cell "0 F CFA" [ref=f2e446]
                    - cell "—" [ref=f2e447]
                  - row [ref=f2e448]:
                    - cell [ref=f2e449]:
                      - link "CMD-261128-F12342" [ref=f2e450] [cursor=pointer]:
                        - /url: /admin/orders/b121549c-9b68-4601-9ec1-b602722835e6
                    - cell "Prête" [ref=f2e451]
                    - cell "—" [ref=f2e454]
                    - cell "Chez Fatou 5c4e48 Saloum Culture" [ref=f2e455]:
                      - generic [ref=f2e456]:
                        - text: Chez Fatou 5c4e48
                        - generic [ref=f2e457]: Saloum Culture
                    - cell "Retrait" [ref=f2e458]
                    - cell "Awa Sarr" [ref=f2e459]
                    - cell [ref=f2e460]:
                      - time [ref=f2e461]: sam. 28 nov. 2026 à 00:41
                    - cell "7 000 F CFA" [ref=f2e462]
                    - cell "0 F CFA" [ref=f2e463]
                    - cell "—" [ref=f2e464]
                  - row [ref=f2e465]:
                    - cell [ref=f2e466]:
                      - link "CMD-261128-C2CAB5" [ref=f2e467] [cursor=pointer]:
                        - /url: /admin/orders/a110fd1b-ab6b-40a0-bde5-1361f6886e70
                    - cell "En préparation" [ref=f2e468]
                    - cell "—" [ref=f2e471]
                    - cell "Le Baobab 872243 Saloum Culture" [ref=f2e472]:
                      - generic [ref=f2e473]:
                        - text: Le Baobab 872243
                        - generic [ref=f2e474]: Saloum Culture
                    - cell "Retrait" [ref=f2e475]
                    - cell "Awa Sarr" [ref=f2e476]
                    - cell [ref=f2e477]:
                      - time [ref=f2e478]: sam. 28 nov. 2026 à 00:41
                    - cell "3 500 F CFA" [ref=f2e479]
                    - cell "0 F CFA" [ref=f2e480]
                    - cell "—" [ref=f2e481]
                  - row [ref=f2e482]:
                    - cell [ref=f2e483]:
                      - link "CMD-261128-CF1B54" [ref=f2e484] [cursor=pointer]:
                        - /url: /admin/orders/426492b1-4c99-45bd-a86e-62d738badae4
                    - cell "En préparation" [ref=f2e485]
                    - cell "—" [ref=f2e488]
                    - cell "Chez Fatou 5c4e48 Saloum Culture" [ref=f2e489]:
                      - generic [ref=f2e490]:
                        - text: Chez Fatou 5c4e48
                        - generic [ref=f2e491]: Saloum Culture
                    - cell "Retrait" [ref=f2e492]
                    - cell "Awa Sarr" [ref=f2e493]
                    - cell [ref=f2e494]:
                      - time [ref=f2e495]: sam. 28 nov. 2026 à 00:41
                    - cell "4 000 F CFA" [ref=f2e496]
                    - cell "0 F CFA" [ref=f2e497]
                    - cell "—" [ref=f2e498]
                  - row [ref=f2e499]:
                    - cell [ref=f2e500]:
                      - link "CMD-261128-5F892F" [ref=f2e501] [cursor=pointer]:
                        - /url: /admin/orders/8a7914ff-f0fd-4740-9a9b-cce9d3bde29a
                    - cell "Acceptée" [ref=f2e502]
                    - cell "—" [ref=f2e505]
                    - cell "Chez Fatou 5c4e48 Saloum Culture" [ref=f2e506]:
                      - generic [ref=f2e507]:
                        - text: Chez Fatou 5c4e48
                        - generic [ref=f2e508]: Saloum Culture
                    - cell "Sur place" [ref=f2e509]
                    - cell "Awa Sarr" [ref=f2e510]
                    - cell [ref=f2e511]:
                      - time [ref=f2e512]: sam. 28 nov. 2026 à 00:41
                    - cell "4 500 F CFA" [ref=f2e513]
                    - cell "0 F CFA" [ref=f2e514]
                    - cell "—" [ref=f2e515]
                  - row [ref=f2e516]:
                    - cell [ref=f2e517]:
                      - link "CMD-261128-39401E" [ref=f2e518] [cursor=pointer]:
                        - /url: /admin/orders/1240c5d0-afce-4f9a-aea8-9e10b0927d87
                    - cell "Reçue" [ref=f2e519]
                    - cell "—" [ref=f2e522]
                    - cell "Chez Fatou 5c4e48 Saloum Culture" [ref=f2e523]:
                      - generic [ref=f2e524]:
                        - text: Chez Fatou 5c4e48
                        - generic [ref=f2e525]: Saloum Culture
                    - cell "Sur place" [ref=f2e526]
                    - cell "Awa Sarr" [ref=f2e527]
                    - cell [ref=f2e528]:
                      - time [ref=f2e529]: sam. 28 nov. 2026 à 00:41
                    - cell "12 000 F CFA" [ref=f2e530]
                    - cell "0 F CFA" [ref=f2e531]
                    - cell "—" [ref=f2e532]
                  - row [ref=f2e533]:
                    - cell [ref=f2e534]:
                      - link "CMD-261128-FAB905" [ref=f2e535] [cursor=pointer]:
                        - /url: /admin/orders/e8d34b1d-ae36-49bf-b429-e5048f388553
                    - cell "Reçue" [ref=f2e536]
                    - cell "—" [ref=f2e539]
                    - cell "Chez Fatou 5c4e48 Saloum Culture" [ref=f2e540]:
                      - generic [ref=f2e541]:
                        - text: Chez Fatou 5c4e48
                        - generic [ref=f2e542]: Saloum Culture
                    - cell "Retrait" [ref=f2e543]
                    - cell "Awa Sarr" [ref=f2e544]
                    - cell [ref=f2e545]:
                      - time [ref=f2e546]: sam. 28 nov. 2026 à 00:41
                    - cell "9 000 F CFA" [ref=f2e547]
                    - cell "0 F CFA" [ref=f2e548]
                    - cell "—" [ref=f2e549]
                  - row [ref=f2e550]:
                    - cell [ref=f2e551]:
                      - link "CMD-261128-CC3B9A" [ref=f2e552] [cursor=pointer]:
                        - /url: /admin/orders/12931380-1178-4a16-a0d8-8550325d2a58
                    - cell "En route" [ref=f2e553]
                    - cell "À décider Client absent" [ref=f2e556]:
                      - generic [ref=f2e557]:
                        - generic [ref=f2e558]: À décider
                        - generic [ref=f2e563]: Client absent
                    - cell "Le Baobab 872243 Saloum Culture" [ref=f2e571]:
                      - generic [ref=f2e572]:
                        - text: Le Baobab 872243
                        - generic [ref=f2e573]: Saloum Culture
                    - cell "Livraison" [ref=f2e574]
                    - cell "Awa Sarr" [ref=f2e575]
                    - cell [ref=f2e576]:
                      - time [ref=f2e577]: sam. 28 nov. 2026 à 00:41
                    - cell "5 500 F CFA" [ref=f2e578]
                    - cell "0 F CFA" [ref=f2e579]
                    - cell "—" [ref=f2e580]
            - navigation "Pages de la liste des commandes" [ref=f2e581]:
              - button "Précédente" [disabled] [ref=f2e582]
              - paragraph [ref=f2e587]: Page 1 sur 2
              - button "Suivante" [ref=f2e588] [cursor=pointer]
  - alert [ref=f2e593]
```

# Test source

```ts
  24  | import { fakeScanMode, installFakeCamera } from './support/fake-camera';
  25  | import {
  26  |     PHONE_MAX_WIDTH, RESPONSIVE_CAPTURE_WIDTHS, RESPONSIVE_LANDSCAPE, RESPONSIVE_PAGES, RESPONSIVE_WIDTHS, type ResponsivePage,
  27  | } from './support/responsive-pages';
  28  | import { runResponsiveChecks } from './support/responsive-checks';
  29  | import { keepHomeOutOfServicesWindow } from './support/services-switch';
  30  | import { readTheme, themeProblem } from './support/theme-check';
  31  | 
  32  | const RESULTS = path.join(E2E_OUTPUT_DIR, 'responsive');
  33  | const SHOTS = path.join(E2E_OUTPUT_DIR, 'captures-responsive');
  34  | 
  35  | const THEMES: ReadonlyArray<{ key: ThemeKey; colorScheme: 'light' | 'dark' }> = [
  36  |     { key: 'clair', colorScheme: 'light' },
  37  |     { key: 'sombre', colorScheme: 'dark' },
  38  | ];
  39  | 
  40  | interface Size { width: number; height: number; paysage?: boolean }
  41  | 
  42  | function sizesFor(p: ResponsivePage, theme: ThemeKey): Size[] {
  43  |     const base: Size[] = RESPONSIVE_WIDTHS
  44  |         .filter((w) => theme === 'clair' || RESPONSIVE_CAPTURE_WIDTHS.includes(w.width))
  45  |         .map((w) => ({ width: w.width, height: w.height }));
  46  |     const land: Size[] = p.paysage ? RESPONSIVE_LANDSCAPE.map((w) => ({ width: w.width, height: w.height, paysage: true })) : [];
  47  |     return [...base, ...land];
  48  | }
  49  | 
  50  | /** Page stable : polices chargées, réseau au repos (plafond 3 s, noté sinon), deux images d'affichage. */
  51  | async function settle(page: Page, notes: string[], at: string): Promise<void> {
  52  |     await page.evaluate(() => document.fonts.ready.then(() => true));
  53  |     await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => { notes.push(`${at} : réseau jamais au repos en 3 s (attente plafonnée)`); });
  54  |     await page.waitForFunction(() => Array.from(document.images).every((img) => img.complete), undefined, { timeout: 5_000 })
  55  |         .catch(() => { notes.push(`${at} : images encore en chargement après 5 s`); });
  56  |     await page.evaluate(() => new Promise<void>((resolve) => { requestAnimationFrame(() => requestAnimationFrame(() => resolve())); }));
  57  | }
  58  | 
  59  | interface ResponsiveRecord {
  60  |     page: string;
  61  |     titre: string;
  62  |     groupe: string;
  63  |     role: CaptureRole;
  64  |     theme: ThemeKey;
  65  |     url: string | null;
  66  |     sizes: Array<{ size: string; blocking: string[]; warnings: string[]; capture: string | null }>;
  67  |     notes: string[];
  68  |     error: string | null;
  69  | }
  70  | 
  71  | for (const theme of THEMES) {
  72  |     const roles = Array.from(new Set(RESPONSIVE_PAGES.map((p) => p.role)));
  73  |     for (const role of roles) {
  74  |         test.describe(`${theme.key} · ${role}`, () => {
  75  |             test.use({ colorScheme: theme.colorScheme, evTheme: theme.key, evRole: role });
  76  |             for (const p of RESPONSIVE_PAGES.filter((x) => x.role === role)) {
  77  |                 test(`${p.id} — ${p.titre}`, async ({ page, context, guard, servicesLock }) => {
  78  |                     test.setTimeout(240_000);
  79  |                     const record: ResponsiveRecord = { page: p.id, titre: p.titre, groupe: p.groupe, role, theme: theme.key, url: null, sizes: [], notes: [], error: null };
  80  |                     try {
  81  |                         // Lot 10b (lot 11b : salles et tables) : verrou des services avant tout chargement (attente ajoutée au délai du test)
  82  |                         await servicesLock.enter(p.services ? 'services' : 'autres');
  83  |                         if (servicesLock.waitedMs >= 1_000) record.notes.push(`attente du verrou des services : ${Math.round(servicesLock.waitedMs / 1000)} s`);
  84  |                         if (p.services) {
  85  |                             record.notes.push('page des services : interrupteurs features.halls_enabled et features.tables_enabled ouverts le temps du test (e2e/support/services-switch.ts)');
  86  |                             await keepHomeOutOfServicesWindow(page);
  87  |                         }
  88  |                         const demo: DemoIds | null = p.needsIds ? readDemoIds() : null;
  89  |                         record.url = p.path(demo);
  90  |                         guard.configure({ allowFailures: p.allowFailures ?? [], ignoreConsoleErrors: false });
  91  |                         if (p.fakeCamera) await context.addInitScript(installFakeCamera, { mode: fakeScanMode() });
  92  |                         for (const size of sizesFor(p, theme.key)) {
  93  |                             const at = size.paysage ? `${size.width}×${size.height} px (paysage)` : `${size.width} px`;
  94  |                             await page.setViewportSize({ width: size.width, height: size.height });
  95  |                             const response = await page.goto(record.url, { waitUntil: 'load' });
  96  |                             if (p.expectStatus !== undefined) expect(response?.status(), `statut HTTP de ${record.url}`).toBe(p.expectStatus);
  97  |                             if (p.ready) await p.ready(page);
  98  |                             else await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 30_000 });
  99  |                             if (p.actions) await p.actions(page);
  100 |                             await settle(page, record.notes, at);
  101 |                             const checks = await runResponsiveChecks(page, { width: size.width, phone: !size.paysage && size.width <= PHONE_MAX_WIDTH });
  102 |                             const blocking = checks.blocking.map((b) => (size.paysage ? b.replace(`${size.width} px`, at) : b));
  103 |                             // Finition 5 (point 1) : thème demandé vraiment affiché (classe dark et fond lus sur la page), bloquant
  104 |                             const themeIssue = themeProblem(await readTheme(page), theme.key, at);
  105 |                             if (themeIssue) blocking.push(themeIssue);
  106 |                             let capture: string | null = null;
  107 |                             if (size.paysage || RESPONSIVE_CAPTURE_WIDTHS.includes(size.width)) {
  108 |                                 fs.mkdirSync(SHOTS, { recursive: true });
  109 |                                 capture = `${p.id}__${size.paysage ? `${size.width}x${size.height}` : size.width}__${theme.key}.jpg`;
  110 |                                 await page.screenshot({ path: path.join(SHOTS, capture), type: 'jpeg', quality: 80, animations: 'disabled', caret: 'hide', scale: 'css' });
  111 |                             }
  112 |                             record.sizes.push({ size: at, blocking, warnings: checks.warnings, capture });
  113 |                         }
  114 |                     } catch (err) {
  115 |                         record.error = err instanceof Error ? err.message.split('\n')[0] : String(err);
  116 |                         throw err;
  117 |                     } finally {
  118 |                         // Erreurs de la page (console, requêtes) : notées, déjà bloquantes dans les captures
  119 |                         record.notes.push(...guard.blockingIssues().map((i) => `erreur de la page : ${i}`));
  120 |                         fs.mkdirSync(RESULTS, { recursive: true });
  121 |                         fs.writeFileSync(path.join(RESULTS, `${p.id}__${theme.key}.json`), `${JSON.stringify(record, null, 1)}\n`, 'utf8');
  122 |                     }
  123 |                     const blocking = record.sizes.flatMap((s) => s.blocking);
> 124 |                     expect(blocking, `contrôles responsive de ${p.id} (${theme.key})`).toEqual([]);
      |                                                                                        ^ Error: contrôles responsive de adm-commandes (sombre)
  125 |                 });
  126 |             }
  127 |         });
  128 |     }
  129 | }
  130 | 
```