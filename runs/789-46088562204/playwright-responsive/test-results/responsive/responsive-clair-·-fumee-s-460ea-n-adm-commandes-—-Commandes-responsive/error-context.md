# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> clair · fumee-superadmin >> adm-commandes — Commandes
- Location: e2e/responsive.spec.ts:77:21

# Error details

```
Error: contrôles responsive de adm-commandes (clair)

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 4

- Array []
+ Array [
+   "320 px : défilement horizontal (largeur du document 334 px, fenêtre 320 px)",
+   "1440 px : 20 texte(s) < 14 px hors exemption (mentions et légendes admises exclues) : 12 px « Petite-Côte Événements » (td.px-4.py-3 > span.break-words > span.block.text-xs) ; 12 px « Petite-Côte Événements » (td.px-4.py-3 > span.break-words > span.block.text-xs) ; 12 px « Petite-Côte Événements » (td.px-4.py-3 > span.break-words > span.block.text-xs) ; 12 px « Petite-Côte Événements » (td.px-4.py-3 > span.break-words > span.block.text-xs) ; 12 px « Petite-Côte Événements » (td.px-4.py-3 > span.break-words > span.block.text-xs)",
+ ]
```

# Page snapshot

```yaml
- generic [active] [ref=f5e1]:
  - generic [ref=f5e2]:
    - complementary [ref=f5e4]:
      - generic [ref=f5e5]:
        - link "Event Village, accueil" [ref=f5e7] [cursor=pointer]:
          - /url: /
          - generic [ref=f5e8]: Event Village
        - button "Replier la barre latérale" [expanded] [ref=f5e11] [cursor=pointer]
      - navigation "Navigation principale" [ref=f5e16]:
        - generic [ref=f5e17]: Administration
        - link "Tableau de bord" [ref=f5e22] [cursor=pointer]:
          - /url: /admin/dashboard
        - generic [ref=f5e29]:
          - paragraph [ref=f5e30]: Gestion
          - generic [ref=f5e31]:
            - link "Événements" [ref=f5e32] [cursor=pointer]:
              - /url: /admin/events
            - link "Comptes" [ref=f5e36] [cursor=pointer]:
              - /url: /admin/users
            - link "Catalogues et services" [ref=f5e43] [cursor=pointer]:
              - /url: /admin/services
            - link "Salles à valider" [ref=f5e49] [cursor=pointer]:
              - /url: /admin/halls
            - link "Produits à vérifier" [ref=f5e55] [cursor=pointer]:
              - /url: /admin/products
            - link "Commandes" [ref=f5e60] [cursor=pointer]:
              - /url: /admin/orders
        - generic [ref=f5e65]:
          - paragraph [ref=f5e66]: Finances
          - link "Finance" [ref=f5e68] [cursor=pointer]:
            - /url: /admin/finance
        - generic [ref=f5e72]:
          - paragraph [ref=f5e73]: Engagement
          - generic [ref=f5e74]:
            - link "Parrainage" [ref=f5e75] [cursor=pointer]:
              - /url: /admin/referral
            - link "Campagnes" [ref=f5e80] [cursor=pointer]:
              - /url: /admin/communications
            - link "À la une" [ref=f5e85] [cursor=pointer]:
              - /url: /admin/a-la-une
        - generic [ref=f5e89]:
          - paragraph [ref=f5e90]: Système
          - generic [ref=f5e91]:
            - link "Réglages" [ref=f5e92] [cursor=pointer]:
              - /url: /admin/finance-settings
            - link "Journal d’audit" [ref=f5e97] [cursor=pointer]:
              - /url: /admin/audit
            - link "Notifications" [ref=f5e102] [cursor=pointer]:
              - /url: /admin/notifications
            - link "Scanner" [ref=f5e109] [cursor=pointer]:
              - /url: /scan
            - link "Sécurité du compte" [ref=f5e117] [cursor=pointer]:
              - /url: /admin/securite
        - link "Retour au site" [ref=f5e123] [cursor=pointer]:
          - /url: /
      - generic [ref=f5e128]:
        - link "Elhadji SuperAdmin Super-administrateur" [ref=f5e129] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=f5e131]: ES
          - generic [ref=f5e132]:
            - generic [ref=f5e133]: Elhadji SuperAdmin
            - generic [ref=f5e134]: Super-administrateur
        - generic [ref=f5e135]:
          - button "Se déconnecter" [ref=f5e136] [cursor=pointer]
          - button "Basculer le thème" [ref=f5e141] [cursor=pointer]
    - generic [ref=f5e145]:
      - banner [ref=f5e146]:
        - link "Rechercher un événement…" [ref=f5e148] [cursor=pointer]:
          - /url: /explore
        - generic [ref=f5e153]:
          - button "Notifications, 65 non lues" [ref=f5e155] [cursor=pointer]:
            - generic [ref=f5e159]: "65"
          - button "Elhadji SuperAdmin" [ref=f5e161] [cursor=pointer]:
            - generic [aria-hidden] [ref=f5e162]: ES
      - main [ref=f5e164]:
        - generic [ref=f5e166]:
          - generic [ref=f5e169]:
            - heading "Commandes" [level=1] [ref=f5e170]
            - paragraph [ref=f5e171]: "Toutes les commandes des établissements : suivez les étapes, annulez et remboursez, décidez après l’absence d’un client et répondez aux signalements."
          - generic [ref=f5e172]:
            - group "Groupe de commandes" [ref=f5e173]:
              - button "À décider" [ref=f5e174] [cursor=pointer]
              - button "En cours" [ref=f5e175] [cursor=pointer]
              - button "Terminées" [ref=f5e176] [cursor=pointer]
              - button "Annulées" [ref=f5e177] [cursor=pointer]
              - button "Non payées" [ref=f5e178] [cursor=pointer]
              - button "Toutes" [pressed] [ref=f5e179] [cursor=pointer]:
                - generic [aria-hidden] [ref=f5e180]: ✓
                - text: Toutes
            - search [ref=f5e181]:
              - generic [ref=f5e182]:
                - generic [ref=f5e183]: Rechercher une commande
                - textbox "Rechercher une commande" [ref=f5e185]
                - paragraph [ref=f5e186]: Numéro de commande, nom de l’établissement ou de la partenaire.
              - button "Rechercher" [ref=f5e187] [cursor=pointer]
          - generic [ref=f5e193]:
            - paragraph [ref=f5e194]: 27 commandes
            - region "Commandes des établissements" [ref=f5e196]:
              - table [ref=f5e197]:
                - caption [ref=f5e198]: Commandes des établissements
                - rowgroup [ref=f5e199]:
                  - row [ref=f5e200]:
                    - columnheader "Commande" [ref=f5e201]
                    - columnheader "État" [ref=f5e202]
                    - columnheader "À suivre" [ref=f5e203]
                    - columnheader "Établissement" [ref=f5e204]
                    - columnheader "Remise" [ref=f5e205]
                    - columnheader "Client" [ref=f5e206]
                    - columnheader "Créée le" [ref=f5e207]
                    - columnheader "Total" [ref=f5e208]
                    - columnheader "Payé en ligne" [ref=f5e209]
                    - columnheader "Remboursé" [ref=f5e210]
                - rowgroup [ref=f5e211]:
                  - row [ref=f5e212]:
                    - cell [ref=f5e213]:
                      - link "CMD-261128-CD1E67" [ref=f5e214] [cursor=pointer]:
                        - /url: /admin/orders/934286fc-dc68-4917-bea5-a944390ca106
                    - cell "Annulée par le client" [ref=f5e215]
                    - cell "—" [ref=f5e218]
                    - cell "Chez Fatou ee4c0d Petite-Côte Événements" [ref=f5e219]:
                      - generic [ref=f5e220]:
                        - text: Chez Fatou ee4c0d
                        - generic [ref=f5e221]: Petite-Côte Événements
                    - cell "Retrait" [ref=f5e222]
                    - cell "Birame ClientBis" [ref=f5e223]
                    - cell [ref=f5e224]:
                      - time [ref=f5e225]: sam. 28 nov. 2026 à 00:44
                    - cell "3 000 F CFA" [ref=f5e226]
                    - cell "0 F CFA" [ref=f5e227]
                    - cell "—" [ref=f5e228]
                  - row [ref=f5e229]:
                    - cell [ref=f5e230]:
                      - link "CMD-261128-D734BF" [ref=f5e231] [cursor=pointer]:
                        - /url: /admin/orders/b0bcfb65-c2e1-4d9c-a412-bb53735730a8
                    - cell "Annulée par le client" [ref=f5e232]
                    - cell "—" [ref=f5e235]
                    - cell "Chez Fatou ee4c0d Petite-Côte Événements" [ref=f5e236]:
                      - generic [ref=f5e237]:
                        - text: Chez Fatou ee4c0d
                        - generic [ref=f5e238]: Petite-Côte Événements
                    - cell "Retrait" [ref=f5e239]
                    - cell "Birame ClientBis" [ref=f5e240]
                    - cell [ref=f5e241]:
                      - time [ref=f5e242]: sam. 28 nov. 2026 à 00:44
                    - cell "3 000 F CFA" [ref=f5e243]
                    - cell "0 F CFA" [ref=f5e244]
                    - cell "—" [ref=f5e245]
                  - row [ref=f5e246]:
                    - cell [ref=f5e247]:
                      - link "CMD-261128-88F46B" [ref=f5e248] [cursor=pointer]:
                        - /url: /admin/orders/bc81f730-abe0-4bab-8aaf-cabc224acd5f
                    - cell "Retirée" [ref=f5e249]
                    - cell "—" [ref=f5e252]
                    - cell "Chez Fatou ee4c0d Petite-Côte Événements" [ref=f5e253]:
                      - generic [ref=f5e254]:
                        - text: Chez Fatou ee4c0d
                        - generic [ref=f5e255]: Petite-Côte Événements
                    - cell "Retrait" [ref=f5e256]
                    - cell "Birame ClientBis" [ref=f5e257]
                    - cell [ref=f5e258]:
                      - time [ref=f5e259]: sam. 28 nov. 2026 à 00:44
                    - cell "3 900 F CFA" [ref=f5e260]
                    - cell "4 095 F CFA" [ref=f5e261]
                    - cell "—" [ref=f5e262]
                  - row [ref=f5e263]:
                    - cell [ref=f5e264]:
                      - link "CMD-261128-FE91E4" [ref=f5e265] [cursor=pointer]:
                        - /url: /admin/orders/5c0f1462-4148-4b89-b81e-772a038c0392
                    - cell "Annulée par le client" [ref=f5e266]
                    - cell "—" [ref=f5e269]
                    - cell "Chez Fatou ee4c0d Petite-Côte Événements" [ref=f5e270]:
                      - generic [ref=f5e271]:
                        - text: Chez Fatou ee4c0d
                        - generic [ref=f5e272]: Petite-Côte Événements
                    - cell "Retrait" [ref=f5e273]
                    - cell "Birame ClientBis" [ref=f5e274]
                    - cell [ref=f5e275]:
                      - time [ref=f5e276]: sam. 28 nov. 2026 à 00:43
                    - cell "3 000 F CFA" [ref=f5e277]
                    - cell "0 F CFA" [ref=f5e278]
                    - cell "—" [ref=f5e279]
                  - row [ref=f5e280]:
                    - cell [ref=f5e281]:
                      - link "CMD-261128-7AE08C" [ref=f5e282] [cursor=pointer]:
                        - /url: /admin/orders/ec186e9a-9ad7-4c98-a12f-62938428da41
                    - cell "Annulée par le client" [ref=f5e283]
                    - cell "—" [ref=f5e286]
                    - cell "Chez Fatou ee4c0d Petite-Côte Événements" [ref=f5e287]:
                      - generic [ref=f5e288]:
                        - text: Chez Fatou ee4c0d
                        - generic [ref=f5e289]: Petite-Côte Événements
                    - cell "Retrait" [ref=f5e290]
                    - cell "Birame ClientBis" [ref=f5e291]
                    - cell [ref=f5e292]:
                      - time [ref=f5e293]: sam. 28 nov. 2026 à 00:43
                    - cell "3 000 F CFA" [ref=f5e294]
                    - cell "0 F CFA" [ref=f5e295]
                    - cell "—" [ref=f5e296]
                  - row [ref=f5e297]:
                    - cell [ref=f5e298]:
                      - link "CMD-261128-E9128F" [ref=f5e299] [cursor=pointer]:
                        - /url: /admin/orders/a31cc8bb-fedc-4918-9fae-fd29feb6355f
                    - cell "Retirée" [ref=f5e300]
                    - cell "—" [ref=f5e303]
                    - cell "Chez Fatou ee4c0d Petite-Côte Événements" [ref=f5e304]:
                      - generic [ref=f5e305]:
                        - text: Chez Fatou ee4c0d
                        - generic [ref=f5e306]: Petite-Côte Événements
                    - cell "Retrait" [ref=f5e307]
                    - cell "Birame ClientBis" [ref=f5e308]
                    - cell [ref=f5e309]:
                      - time [ref=f5e310]: sam. 28 nov. 2026 à 00:42
                    - cell "3 900 F CFA" [ref=f5e311]
                    - cell "4 095 F CFA" [ref=f5e312]
                    - cell "—" [ref=f5e313]
                  - row [ref=f5e314]:
                    - cell [ref=f5e315]:
                      - link "CMD-261128-6683A7" [ref=f5e316] [cursor=pointer]:
                        - /url: /admin/orders/0435d8ce-58e0-4c76-a711-435df0813a64
                    - cell "Annulée par le client" [ref=f5e317]
                    - cell "—" [ref=f5e320]
                    - cell "Chez Fatou ee4c0d Petite-Côte Événements" [ref=f5e321]:
                      - generic [ref=f5e322]:
                        - text: Chez Fatou ee4c0d
                        - generic [ref=f5e323]: Petite-Côte Événements
                    - cell "Retrait" [ref=f5e324]
                    - cell "Birame ClientBis" [ref=f5e325]
                    - cell [ref=f5e326]:
                      - time [ref=f5e327]: sam. 28 nov. 2026 à 00:42
                    - cell "3 000 F CFA" [ref=f5e328]
                    - cell "0 F CFA" [ref=f5e329]
                    - cell "—" [ref=f5e330]
                  - row [ref=f5e331]:
                    - cell [ref=f5e332]:
                      - link "CMD-261128-A376DE" [ref=f5e333] [cursor=pointer]:
                        - /url: /admin/orders/003168ac-d4c5-4ee5-903e-df840d93544e
                    - cell "Annulée par le client" [ref=f5e334]
                    - cell "—" [ref=f5e337]
                    - cell "Chez Fatou ee4c0d Petite-Côte Événements" [ref=f5e338]:
                      - generic [ref=f5e339]:
                        - text: Chez Fatou ee4c0d
                        - generic [ref=f5e340]: Petite-Côte Événements
                    - cell "Retrait" [ref=f5e341]
                    - cell "Birame ClientBis" [ref=f5e342]
                    - cell [ref=f5e343]:
                      - time [ref=f5e344]: sam. 28 nov. 2026 à 00:42
                    - cell "3 000 F CFA" [ref=f5e345]
                    - cell "0 F CFA" [ref=f5e346]
                    - cell "—" [ref=f5e347]
                  - row [ref=f5e348]:
                    - cell [ref=f5e349]:
                      - link "CMD-261128-86E24B" [ref=f5e350] [cursor=pointer]:
                        - /url: /admin/orders/82dbf0d0-d3a0-47a9-961e-88185fd2f79f
                    - cell "Servie" [ref=f5e351]
                    - cell "—" [ref=f5e354]
                    - cell "Chez Fatou 5c4e48 Saloum Culture" [ref=f5e355]:
                      - generic [ref=f5e356]:
                        - text: Chez Fatou 5c4e48
                        - generic [ref=f5e357]: Saloum Culture
                    - cell "Sur place" [ref=f5e358]
                    - cell "Awa Sarr" [ref=f5e359]
                    - cell [ref=f5e360]:
                      - time [ref=f5e361]: sam. 28 nov. 2026 à 00:41
                    - cell "2 000 F CFA" [ref=f5e362]
                    - cell "0 F CFA" [ref=f5e363]
                    - cell "—" [ref=f5e364]
                  - row [ref=f5e365]:
                    - cell [ref=f5e366]:
                      - link "CMD-261128-175118" [ref=f5e367] [cursor=pointer]:
                        - /url: /admin/orders/d639dda9-07a7-495c-a6f3-347463e77583
                    - cell "Servie" [ref=f5e368]
                    - cell "—" [ref=f5e371]
                    - cell "Chez Fatou 5c4e48 Saloum Culture" [ref=f5e372]:
                      - generic [ref=f5e373]:
                        - text: Chez Fatou 5c4e48
                        - generic [ref=f5e374]: Saloum Culture
                    - cell "Sur place" [ref=f5e375]
                    - cell "Awa Sarr" [ref=f5e376]
                    - cell [ref=f5e377]:
                      - time [ref=f5e378]: sam. 28 nov. 2026 à 00:41
                    - cell "3 000 F CFA" [ref=f5e379]
                    - cell "0 F CFA" [ref=f5e380]
                    - cell "—" [ref=f5e381]
                  - row [ref=f5e382]:
                    - cell [ref=f5e383]:
                      - link "CMD-261128-CD92AE" [ref=f5e384] [cursor=pointer]:
                        - /url: /admin/orders/5713f8f4-626c-498f-ad38-4dd7bd691dd4
                    - cell "Acceptée" [ref=f5e385]
                    - cell "—" [ref=f5e388]
                    - cell "Le Baobab 872243 Saloum Culture" [ref=f5e389]:
                      - generic [ref=f5e390]:
                        - text: Le Baobab 872243
                        - generic [ref=f5e391]: Saloum Culture
                    - cell "Retrait" [ref=f5e392]
                    - cell "Awa Sarr" [ref=f5e393]
                    - cell [ref=f5e394]:
                      - time [ref=f5e395]: sam. 28 nov. 2026 à 00:41
                    - cell "10 500 F CFA" [ref=f5e396]
                    - cell "0 F CFA" [ref=f5e397]
                    - cell "—" [ref=f5e398]
                  - row [ref=f5e399]:
                    - cell [ref=f5e400]:
                      - link "CMD-261128-80C728" [ref=f5e401] [cursor=pointer]:
                        - /url: /admin/orders/28057a3f-17ff-481c-9961-c95be6be9521
                    - cell "En route" [ref=f5e402]
                    - cell "—" [ref=f5e405]
                    - cell "Chez Fatou 5c4e48 Saloum Culture" [ref=f5e406]:
                      - generic [ref=f5e407]:
                        - text: Chez Fatou 5c4e48
                        - generic [ref=f5e408]: Saloum Culture
                    - cell "Livraison" [ref=f5e409]
                    - cell "Awa Sarr" [ref=f5e410]
                    - cell [ref=f5e411]:
                      - time [ref=f5e412]: sam. 28 nov. 2026 à 00:41
                    - cell "10 500 F CFA" [ref=f5e413]
                    - cell "0 F CFA" [ref=f5e414]
                    - cell "—" [ref=f5e415]
                  - row [ref=f5e416]:
                    - cell [ref=f5e417]:
                      - link "CMD-261128-B18AC9" [ref=f5e418] [cursor=pointer]:
                        - /url: /admin/orders/ba3b8c47-a78c-44e5-8ac3-5cc03c2718d5
                    - cell "En préparation" [ref=f5e419]
                    - cell "À décider Signalement" [ref=f5e422]:
                      - generic [ref=f5e423]:
                        - generic [ref=f5e424]: À décider
                        - generic [ref=f5e429]: Signalement
                    - cell "Le Baobab 872243 Saloum Culture" [ref=f5e434]:
                      - generic [ref=f5e435]:
                        - text: Le Baobab 872243
                        - generic [ref=f5e436]: Saloum Culture
                    - cell "Retrait" [ref=f5e437]
                    - cell "Awa Sarr" [ref=f5e438]
                    - cell [ref=f5e439]:
                      - time [ref=f5e440]: sam. 28 nov. 2026 à 00:41
                    - cell "4 500 F CFA" [ref=f5e441]
                    - cell "0 F CFA" [ref=f5e442]
                    - cell "—" [ref=f5e443]
                  - row [ref=f5e444]:
                    - cell [ref=f5e445]:
                      - link "CMD-261128-F12342" [ref=f5e446] [cursor=pointer]:
                        - /url: /admin/orders/b121549c-9b68-4601-9ec1-b602722835e6
                    - cell "Prête" [ref=f5e447]
                    - cell "—" [ref=f5e450]
                    - cell "Chez Fatou 5c4e48 Saloum Culture" [ref=f5e451]:
                      - generic [ref=f5e452]:
                        - text: Chez Fatou 5c4e48
                        - generic [ref=f5e453]: Saloum Culture
                    - cell "Retrait" [ref=f5e454]
                    - cell "Awa Sarr" [ref=f5e455]
                    - cell [ref=f5e456]:
                      - time [ref=f5e457]: sam. 28 nov. 2026 à 00:41
                    - cell "7 000 F CFA" [ref=f5e458]
                    - cell "0 F CFA" [ref=f5e459]
                    - cell "—" [ref=f5e460]
                  - row [ref=f5e461]:
                    - cell [ref=f5e462]:
                      - link "CMD-261128-C2CAB5" [ref=f5e463] [cursor=pointer]:
                        - /url: /admin/orders/a110fd1b-ab6b-40a0-bde5-1361f6886e70
                    - cell "En préparation" [ref=f5e464]
                    - cell "—" [ref=f5e467]
                    - cell "Le Baobab 872243 Saloum Culture" [ref=f5e468]:
                      - generic [ref=f5e469]:
                        - text: Le Baobab 872243
                        - generic [ref=f5e470]: Saloum Culture
                    - cell "Retrait" [ref=f5e471]
                    - cell "Awa Sarr" [ref=f5e472]
                    - cell [ref=f5e473]:
                      - time [ref=f5e474]: sam. 28 nov. 2026 à 00:41
                    - cell "3 500 F CFA" [ref=f5e475]
                    - cell "0 F CFA" [ref=f5e476]
                    - cell "—" [ref=f5e477]
                  - row [ref=f5e478]:
                    - cell [ref=f5e479]:
                      - link "CMD-261128-CF1B54" [ref=f5e480] [cursor=pointer]:
                        - /url: /admin/orders/426492b1-4c99-45bd-a86e-62d738badae4
                    - cell "En préparation" [ref=f5e481]
                    - cell "—" [ref=f5e484]
                    - cell "Chez Fatou 5c4e48 Saloum Culture" [ref=f5e485]:
                      - generic [ref=f5e486]:
                        - text: Chez Fatou 5c4e48
                        - generic [ref=f5e487]: Saloum Culture
                    - cell "Retrait" [ref=f5e488]
                    - cell "Awa Sarr" [ref=f5e489]
                    - cell [ref=f5e490]:
                      - time [ref=f5e491]: sam. 28 nov. 2026 à 00:41
                    - cell "4 000 F CFA" [ref=f5e492]
                    - cell "0 F CFA" [ref=f5e493]
                    - cell "—" [ref=f5e494]
                  - row [ref=f5e495]:
                    - cell [ref=f5e496]:
                      - link "CMD-261128-5F892F" [ref=f5e497] [cursor=pointer]:
                        - /url: /admin/orders/8a7914ff-f0fd-4740-9a9b-cce9d3bde29a
                    - cell "Acceptée" [ref=f5e498]
                    - cell "—" [ref=f5e501]
                    - cell "Chez Fatou 5c4e48 Saloum Culture" [ref=f5e502]:
                      - generic [ref=f5e503]:
                        - text: Chez Fatou 5c4e48
                        - generic [ref=f5e504]: Saloum Culture
                    - cell "Sur place" [ref=f5e505]
                    - cell "Awa Sarr" [ref=f5e506]
                    - cell [ref=f5e507]:
                      - time [ref=f5e508]: sam. 28 nov. 2026 à 00:41
                    - cell "4 500 F CFA" [ref=f5e509]
                    - cell "0 F CFA" [ref=f5e510]
                    - cell "—" [ref=f5e511]
                  - row [ref=f5e512]:
                    - cell [ref=f5e513]:
                      - link "CMD-261128-39401E" [ref=f5e514] [cursor=pointer]:
                        - /url: /admin/orders/1240c5d0-afce-4f9a-aea8-9e10b0927d87
                    - cell "Reçue" [ref=f5e515]
                    - cell "—" [ref=f5e518]
                    - cell "Chez Fatou 5c4e48 Saloum Culture" [ref=f5e519]:
                      - generic [ref=f5e520]:
                        - text: Chez Fatou 5c4e48
                        - generic [ref=f5e521]: Saloum Culture
                    - cell "Sur place" [ref=f5e522]
                    - cell "Awa Sarr" [ref=f5e523]
                    - cell [ref=f5e524]:
                      - time [ref=f5e525]: sam. 28 nov. 2026 à 00:41
                    - cell "12 000 F CFA" [ref=f5e526]
                    - cell "0 F CFA" [ref=f5e527]
                    - cell "—" [ref=f5e528]
                  - row [ref=f5e529]:
                    - cell [ref=f5e530]:
                      - link "CMD-261128-FAB905" [ref=f5e531] [cursor=pointer]:
                        - /url: /admin/orders/e8d34b1d-ae36-49bf-b429-e5048f388553
                    - cell "Reçue" [ref=f5e532]
                    - cell "—" [ref=f5e535]
                    - cell "Chez Fatou 5c4e48 Saloum Culture" [ref=f5e536]:
                      - generic [ref=f5e537]:
                        - text: Chez Fatou 5c4e48
                        - generic [ref=f5e538]: Saloum Culture
                    - cell "Retrait" [ref=f5e539]
                    - cell "Awa Sarr" [ref=f5e540]
                    - cell [ref=f5e541]:
                      - time [ref=f5e542]: sam. 28 nov. 2026 à 00:41
                    - cell "9 000 F CFA" [ref=f5e543]
                    - cell "0 F CFA" [ref=f5e544]
                    - cell "—" [ref=f5e545]
                  - row [ref=f5e546]:
                    - cell [ref=f5e547]:
                      - link "CMD-261128-CC3B9A" [ref=f5e548] [cursor=pointer]:
                        - /url: /admin/orders/12931380-1178-4a16-a0d8-8550325d2a58
                    - cell "En route" [ref=f5e549]
                    - cell "À décider Client absent" [ref=f5e552]:
                      - generic [ref=f5e553]:
                        - generic [ref=f5e554]: À décider
                        - generic [ref=f5e559]: Client absent
                    - cell "Le Baobab 872243 Saloum Culture" [ref=f5e567]:
                      - generic [ref=f5e568]:
                        - text: Le Baobab 872243
                        - generic [ref=f5e569]: Saloum Culture
                    - cell "Livraison" [ref=f5e570]
                    - cell "Awa Sarr" [ref=f5e571]
                    - cell [ref=f5e572]:
                      - time [ref=f5e573]: sam. 28 nov. 2026 à 00:41
                    - cell "5 500 F CFA" [ref=f5e574]
                    - cell "0 F CFA" [ref=f5e575]
                    - cell "—" [ref=f5e576]
            - navigation "Pages de la liste des commandes" [ref=f5e577]:
              - button "Précédente" [disabled] [ref=f5e578]
              - paragraph [ref=f5e583]: Page 1 sur 2
              - button "Suivante" [ref=f5e584] [cursor=pointer]
  - alert [ref=f5e589]
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
      |                                                                                        ^ Error: contrôles responsive de adm-commandes (clair)
  125 |                 });
  126 |             }
  127 |         });
  128 |     }
  129 | }
  130 | 
```