# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> clair · organisateur >> org-pilotage-entrees — Pilotage — Entrées
- Location: e2e/responsive.spec.ts:69:21

# Error details

```
Error: contrôles responsive de org-pilotage-entrees (clair)

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 5

- Array []
+ Array [
+   "768 px : textes qui se chevauchent : span.hidden.whitespace-nowrap « Event Village » sur span.truncate « Rechercher un événement, un concert, un restaurant » (46×18 px)",
+   "1024 px : texte tronqué sans le texte entier : span.block.truncate « Mariama Ndiaye » (points de suspension, texte entier absent)",
+   "1440 px : texte tronqué sans le texte entier : span.block.truncate « Mariama Ndiaye » (points de suspension, texte entier absent)",
+ ]
```

# Page snapshot

```yaml
- generic [active] [ref=f5e1]:
  - generic [ref=f5e2]:
    - complementary [ref=f5e3]:
      - link "Event Village, accueil" [ref=f5e5] [cursor=pointer]:
        - /url: /
        - generic [ref=f5e6]: Event Village
      - navigation "Navigation principale" [ref=f5e9]:
        - generic [ref=f5e10]:
          - paragraph [ref=f5e11]: Gestion
          - generic [ref=f5e12]:
            - link "Tableau de bord" [ref=f5e13] [cursor=pointer]:
              - /url: /partner/dashboard
            - link "Événements" [ref=f5e20] [cursor=pointer]:
              - /url: /partner/events
            - link "Équipe" [ref=f5e24] [cursor=pointer]:
              - /url: /partner/team
        - generic [ref=f5e31]:
          - paragraph [ref=f5e32]: Outils
          - generic [ref=f5e33]:
            - link "Finances" [ref=f5e34] [cursor=pointer]:
              - /url: /partner/finance
            - link "Statistiques" [ref=f5e38] [cursor=pointer]:
              - /url: /partner/stats
            - link "Scanner les billets" [ref=f5e42] [cursor=pointer]:
              - /url: /partner/scan
            - link "Calendrier" [ref=f5e50] [cursor=pointer]:
              - /url: /partner/calendar
            - link "Abonnement" [ref=f5e54] [cursor=pointer]:
              - /url: /partner/subscription
            - link "Profil partenaire" [ref=f5e59] [cursor=pointer]:
              - /url: /partner/profile
        - link "Retour au site" [ref=f5e65] [cursor=pointer]:
          - /url: /
      - generic [ref=f5e71]:
        - link "Mariama Ndiaye Partenaire" [ref=f5e72] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=f5e73]: MN
          - generic [ref=f5e74]:
            - generic [ref=f5e75]: Mariama Ndiaye
            - generic [ref=f5e76]: Partenaire
        - generic [ref=f5e77]:
          - button "Se déconnecter" [ref=f5e78] [cursor=pointer]
          - button "Basculer le thème" [ref=f5e83] [cursor=pointer]
    - generic [ref=f5e87]:
      - banner [ref=f5e88]:
        - link "Rechercher un événement, un concert, un restaurant…" [ref=f5e90] [cursor=pointer]:
          - /url: /explore
        - button "Notifications, 99+ non lues" [ref=f5e97] [cursor=pointer]:
          - generic [ref=f5e101]: 99+
      - main [ref=f5e102]:
        - generic [ref=f5e104]:
          - generic [ref=f5e105]:
            - link "Mes événements" [ref=f5e107] [cursor=pointer]:
              - /url: /partner/events
            - generic [ref=f5e112]:
              - generic [ref=f5e113]:
                - generic [ref=f5e114]:
                  - 'generic "En ligne : la page publique est visible et la billetterie est ouverte." [ref=f5e115]': Publié
                  - status [ref=f5e118]: En direct
                - heading "Nuit du Sabar — édition d’automne" [level=1] [ref=f5e120]
                - paragraph [ref=f5e121]:
                  - generic [ref=f5e122]:
                    - generic [ref=f5e123]: jeu. 19 nov. 2026 à 11:30
                    - generic [ref=f5e126]: Esplanade de la Corniche Ouest, Dakar
              - generic [ref=f5e130]:
                - link "Modifier" [ref=f5e131] [cursor=pointer]:
                  - /url: /partner/events/1b6b9b15-31a6-41c3-856d-f27700d91f21/edit
                - button "Annuler l’événement" [ref=f5e137] [cursor=pointer]
          - generic [ref=f5e143]:
            - tablist "Rubriques du pilotage" [ref=f5e146]:
              - tab "Aperçu" [ref=f5e147] [cursor=pointer]
              - tab "Infos" [ref=f5e149] [cursor=pointer]
              - tab "Ventes" [ref=f5e151] [cursor=pointer]
              - tab "Invitations" [ref=f5e153] [cursor=pointer]
              - tab "Entrées" [selected] [ref=f5e155] [cursor=pointer]
              - tab "Équipe" [ref=f5e157] [cursor=pointer]
              - tab "Caisse" [ref=f5e159] [cursor=pointer]
              - tab "Clôture" [ref=f5e161] [cursor=pointer]
            - tabpanel "Entrées" [ref=f5e163]:
              - generic [ref=f5e164]:
                - generic [ref=f5e165]:
                  - generic [ref=f5e166]:
                    - paragraph [ref=f5e168]: Entrées validées
                    - paragraph [ref=f5e173]: "61"
                    - paragraph [ref=f5e174]: Scans acceptés, guichet compris
                  - generic [ref=f5e175]:
                    - paragraph [ref=f5e177]: Au guichet
                    - paragraph [ref=f5e184]: "17"
                    - paragraph [ref=f5e185]: Billets vendus et validés sur place
                  - generic [ref=f5e186]:
                    - paragraph [ref=f5e188]: Refus
                    - paragraph [ref=f5e193]: "10"
                    - paragraph [ref=f5e194]: Tentatives refusées au contrôle
                  - generic [ref=f5e195]:
                    - paragraph [ref=f5e197]: Liste des invités
                    - paragraph [ref=f5e202]: "0"
                    - paragraph [ref=f5e203]: Entrées validées par la liste, pièce vérifiée
                  - generic [ref=f5e204]:
                    - paragraph [ref=f5e206]: Débit
                    - paragraph [ref=f5e211]: 0,0 par minute
                    - paragraph [ref=f5e212]: Moyenne des 5 dernières minutes
                  - generic [ref=f5e213]:
                    - paragraph [ref=f5e215]: Contrôleurs actifs
                    - paragraph [ref=f5e222]: 1 sur 3
                    - paragraph [ref=f5e223]: Un scan dans les 10 dernières minutes
                - paragraph [ref=f5e224]:
                  - text: Mis à jour à
                  - time [ref=f5e225]: 10:39
                - region [ref=f5e226]:
                  - generic [ref=f5e228]:
                    - heading "Tentatives multiples" [level=2] [ref=f5e229]
                    - paragraph [ref=f5e230]: Même billet présenté plusieurs fois en moins de dix minutes, ou billet déjà utilisé.
                  - status [ref=f5e231]:
                    - generic [ref=f5e236]:
                      - paragraph [ref=f5e237]: Billets présentés plusieurs fois
                      - generic [ref=f5e238]: "Vérifiez ces billets avec vos contrôleurs : il peut s’agir d’une capture d’écran partagée."
                  - table [ref=f5e241]:
                    - caption [ref=f5e242]: Billets présentés plusieurs fois
                    - rowgroup [ref=f5e243]:
                      - row [ref=f5e244]:
                        - columnheader "Billet" [ref=f5e245]
                        - columnheader "Catégorie" [ref=f5e246]
                        - columnheader "Tentatives" [ref=f5e247]
                        - columnheader "Dernier résultat" [ref=f5e248]
                        - columnheader "Dernière tentative" [ref=f5e249]
                    - rowgroup [ref=f5e250]:
                      - row [ref=f5e251]:
                        - cell "TCK-20261119-1EE371419D" [ref=f5e252]
                        - cell "Pass soirée" [ref=f5e253]
                        - cell "2" [ref=f5e254]
                        - cell "Billet d’un autre événement" [ref=f5e255]
                        - cell [ref=f5e256]:
                          - time [ref=f5e257]: 10:03
                      - row [ref=f5e258]:
                        - cell "TCK-20261119-9CF053A72D" [ref=f5e259]
                        - cell "Prévente" [ref=f5e260]
                        - cell "2" [ref=f5e261]
                        - cell "Billet déjà utilisé" [ref=f5e262]
                        - cell [ref=f5e263]:
                          - time [ref=f5e264]: 09:58
                      - row [ref=f5e265]:
                        - cell "TCK-20261119-1701FB4ED8" [ref=f5e266]
                        - cell "Prévente" [ref=f5e267]
                        - cell "3" [ref=f5e268]
                        - cell "Billet déjà utilisé" [ref=f5e269]
                        - cell [ref=f5e270]:
                          - time [ref=f5e271]: 09:56
                - region [ref=f5e272]:
                  - generic [ref=f5e274]:
                    - heading "Par contrôleur" [level=2] [ref=f5e275]
                    - paragraph [ref=f5e276]: Entrées, refus et incidents de chaque compte qui a scanné.
                  - table [ref=f5e279]:
                    - caption [ref=f5e280]: Entrées par contrôleur
                    - rowgroup [ref=f5e281]:
                      - row [ref=f5e282]:
                        - columnheader "Contrôleur" [ref=f5e283]
                        - columnheader "Point d’entrée" [ref=f5e284]
                        - columnheader "Entrées" [ref=f5e285]
                        - columnheader "Refus" [ref=f5e286]
                        - columnheader "Incidents" [ref=f5e287]
                        - columnheader "Dernière activité" [ref=f5e288]
                    - rowgroup [ref=f5e289]:
                      - row [ref=f5e290]:
                        - cell "Ibrahima Gueye" [ref=f5e291]
                        - cell "Entrée principale" [ref=f5e292]
                        - cell "32" [ref=f5e293]
                        - cell "5" [ref=f5e294]
                        - cell "2" [ref=f5e295]
                        - cell [ref=f5e296]:
                          - time [ref=f5e297]: jeu. 19 nov. 2026 à 10:31
                      - row [ref=f5e298]:
                        - cell "Lamine Cissé" [ref=f5e299]
                        - cell "Entrée principale" [ref=f5e300]
                        - cell "22" [ref=f5e301]
                        - cell "4" [ref=f5e302]
                        - cell "1" [ref=f5e303]
                        - cell [ref=f5e304]:
                          - time [ref=f5e305]: jeu. 19 nov. 2026 à 10:27
                      - row [ref=f5e306]:
                        - cell "Seynabou Ba" [ref=f5e307]
                        - cell "Entrée VIP" [ref=f5e308]
                        - cell "7" [ref=f5e309]
                        - cell "1" [ref=f5e310]
                        - cell "0" [ref=f5e311]
                        - cell [ref=f5e312]:
                          - time [ref=f5e313]: jeu. 19 nov. 2026 à 10:23
                - generic [ref=f5e314]:
                  - region [ref=f5e315]:
                    - heading "Par point d’entrée" [level=2] [ref=f5e318]
                    - table [ref=f5e321]:
                      - caption [ref=f5e322]: Entrées par point d’entrée
                      - rowgroup [ref=f5e323]:
                        - row [ref=f5e324]:
                          - columnheader "Point d’entrée" [ref=f5e325]
                          - columnheader "Entrées" [ref=f5e326]
                          - columnheader "Refus" [ref=f5e327]
                          - columnheader "Débit" [ref=f5e328]
                          - columnheader "Contrôleurs" [ref=f5e329]
                      - rowgroup [ref=f5e330]:
                        - row [ref=f5e331]:
                          - cell "Entrée principale" [ref=f5e332]
                          - cell "54" [ref=f5e333]
                          - cell "9" [ref=f5e334]
                          - cell "0,0 par minute" [ref=f5e335]
                          - cell "1 actif sur 2" [ref=f5e336]
                        - row [ref=f5e337]:
                          - cell "Entrée VIP" [ref=f5e338]
                          - cell "7" [ref=f5e339]
                          - cell "1" [ref=f5e340]
                          - cell "0,0 par minute" [ref=f5e341]
                          - cell "0 actif sur 1" [ref=f5e342]
                  - generic [ref=f5e343]:
                    - region [ref=f5e344]:
                      - heading "Par catégorie" [level=2] [ref=f5e347]
                      - list "Entrées par catégorie" [ref=f5e348]:
                        - listitem [ref=f5e349]:
                          - generic [ref=f5e350]:
                            - generic [ref=f5e351]: Prévente
                            - generic [ref=f5e352]: 14 entrés sur 22
                        - listitem [ref=f5e355]:
                          - generic [ref=f5e356]:
                            - generic [ref=f5e357]: Standard
                            - generic [ref=f5e358]: 40 entrés sur 50
                        - listitem [ref=f5e361]:
                          - generic [ref=f5e362]:
                            - generic [ref=f5e363]: VIP
                            - generic [ref=f5e364]: 6 entrés sur 10
                        - listitem [ref=f5e367]:
                          - generic [ref=f5e368]:
                            - generic [ref=f5e369]: Carré presse
                            - generic [ref=f5e370]: 1 entré sur 1
                        - listitem [ref=f5e373]:
                          - generic [ref=f5e374]:
                            - generic [ref=f5e375]: Invités de la production
                            - generic [ref=f5e376]: 0 entré sur 0
                    - region [ref=f5e378]:
                      - heading "Par origine" [level=2] [ref=f5e381]
                      - list "Entrées par origine" [ref=f5e382]:
                        - listitem [ref=f5e383]:
                          - generic [ref=f5e384]:
                            - generic [ref=f5e385]: En ligne
                            - generic [ref=f5e386]: 44 entrés sur 66
                        - listitem [ref=f5e389]:
                          - generic [ref=f5e390]:
                            - generic [ref=f5e391]: Guichet
                            - generic [ref=f5e392]: 17 entrés sur 17
                        - listitem [ref=f5e395]:
                          - generic [ref=f5e396]:
                            - generic [ref=f5e397]: Gratuit
                            - generic [ref=f5e398]: 0 entré sur 0
                        - listitem [ref=f5e400]:
                          - generic [ref=f5e401]:
                            - generic [ref=f5e402]: Invitation
                            - generic [ref=f5e403]: 0 entré sur 0
                    - region [ref=f5e405]:
                      - generic [ref=f5e407]:
                        - heading "Flux par quart d’heure" [level=2] [ref=f5e408]
                        - paragraph [ref=f5e409]: Heure de Dakar.
                      - list "Entrées par quart d’heure" [ref=f5e410]:
                        - listitem [ref=f5e411]:
                          - generic [ref=f5e412]:
                            - time [ref=f5e414]: jeu. 19 nov. 2026 à 08:45
                            - generic [ref=f5e415]: 5 entrées
                        - listitem [ref=f5e418]:
                          - generic [ref=f5e419]:
                            - time [ref=f5e421]: jeu. 19 nov. 2026 à 09:00
                            - generic [ref=f5e422]: 10 entrées
                        - listitem [ref=f5e425]:
                          - generic [ref=f5e426]:
                            - time [ref=f5e428]: jeu. 19 nov. 2026 à 09:15
                            - generic [ref=f5e429]: 11 entrées
                        - listitem [ref=f5e432]:
                          - generic [ref=f5e433]:
                            - time [ref=f5e435]: jeu. 19 nov. 2026 à 09:30
                            - generic [ref=f5e436]: 11 entrées
                        - listitem [ref=f5e439]:
                          - generic [ref=f5e440]:
                            - time [ref=f5e442]: jeu. 19 nov. 2026 à 09:45
                            - generic [ref=f5e443]: 7 entrées4 refus
                        - listitem [ref=f5e446]:
                          - generic [ref=f5e447]:
                            - time [ref=f5e449]: jeu. 19 nov. 2026 à 10:00
                            - generic [ref=f5e450]: 5 entrées6 refus
                        - listitem [ref=f5e453]:
                          - generic [ref=f5e454]:
                            - time [ref=f5e456]: jeu. 19 nov. 2026 à 10:15
                            - generic [ref=f5e457]: 11 entrées
                        - listitem [ref=f5e460]:
                          - generic [ref=f5e461]:
                            - time [ref=f5e463]: jeu. 19 nov. 2026 à 10:30
                            - generic [ref=f5e464]: 1 entrée
                    - region [ref=f5e467]:
                      - heading "Refus par motif" [level=2] [ref=f5e470]
                      - list "Refus par motif" [ref=f5e471]:
                        - listitem [ref=f5e472]:
                          - generic [ref=f5e473]:
                            - generic [ref=f5e474]: Billet déjà utilisé
                            - generic [ref=f5e475]: 3 refus
                        - listitem [ref=f5e478]:
                          - generic [ref=f5e479]:
                            - generic [ref=f5e480]: QR expiré
                            - generic [ref=f5e481]: 2 refus
                        - listitem [ref=f5e484]:
                          - generic [ref=f5e485]:
                            - generic [ref=f5e486]: Billet d’un autre événement
                            - generic [ref=f5e487]: 2 refus
                        - listitem [ref=f5e490]:
                          - generic [ref=f5e491]:
                            - generic [ref=f5e492]: QR dynamique requis
                            - generic [ref=f5e493]: 1 refus
                        - listitem [ref=f5e496]:
                          - generic [ref=f5e497]:
                            - generic [ref=f5e498]: Billet invalide
                            - generic [ref=f5e499]: 1 refus
                        - listitem [ref=f5e502]:
                          - generic [ref=f5e503]:
                            - generic [ref=f5e504]: Saisie manuelle refusée
                            - generic [ref=f5e505]: 1 refus
                  - region [ref=f5e508]:
                    - generic [ref=f5e510]:
                      - heading "Validations par la liste des invités" [level=2] [ref=f5e511]
                      - paragraph [ref=f5e512]: Entrées validées par un contrôleur avec la liste des invités, pièce d’identité vérifiée.
                    - paragraph [ref=f5e513]: Aucune entrée validée par la liste des invités.
                - region [ref=f5e514]:
                  - generic [ref=f5e516]:
                    - heading "Débit par minute" [level=2] [ref=f5e517]
                    - paragraph [ref=f5e518]: Entrées de chaque minute sur les 30 dernières minutes, heure de Dakar.
                  - list "Entrées par minute" [ref=f5e519]:
                    - listitem [ref=f5e520]:
                      - generic [ref=f5e521]:
                        - time [ref=f5e523]: 10:10
                        - generic [ref=f5e524]: 1 entrée
                    - listitem [ref=f5e527]:
                      - generic [ref=f5e528]:
                        - time [ref=f5e530]: 10:11
                        - generic [ref=f5e531]: 1 entrée
                    - listitem [ref=f5e534]:
                      - generic [ref=f5e535]:
                        - time [ref=f5e537]: 10:12
                        - generic [ref=f5e538]: 0 entrée
                    - listitem [ref=f5e540]:
                      - generic [ref=f5e541]:
                        - time [ref=f5e543]: 10:13
                        - generic [ref=f5e544]: 1 entrée
                    - listitem [ref=f5e547]:
                      - generic [ref=f5e548]:
                        - time [ref=f5e550]: 10:14
                        - generic [ref=f5e551]: 1 entrée
                    - listitem [ref=f5e554]:
                      - generic [ref=f5e555]:
                        - time [ref=f5e557]: 10:15
                        - generic [ref=f5e558]: 0 entrée
                    - listitem [ref=f5e560]:
                      - generic [ref=f5e561]:
                        - time [ref=f5e563]: 10:16
                        - generic [ref=f5e564]: 1 entrée
                    - listitem [ref=f5e567]:
                      - generic [ref=f5e568]:
                        - time [ref=f5e570]: 10:17
                        - generic [ref=f5e571]: 1 entrée
                    - listitem [ref=f5e574]:
                      - generic [ref=f5e575]:
                        - time [ref=f5e577]: 10:18
                        - generic [ref=f5e578]: 1 entrée
                    - listitem [ref=f5e581]:
                      - generic [ref=f5e582]:
                        - time [ref=f5e584]: 10:19
                        - generic [ref=f5e585]: 1 entrée
                    - listitem [ref=f5e588]:
                      - generic [ref=f5e589]:
                        - time [ref=f5e591]: 10:20
                        - generic [ref=f5e592]: 0 entrée
                    - listitem [ref=f5e594]:
                      - generic [ref=f5e595]:
                        - time [ref=f5e597]: 10:21
                        - generic [ref=f5e598]: 1 entrée
                    - listitem [ref=f5e601]:
                      - generic [ref=f5e602]:
                        - time [ref=f5e604]: 10:22
                        - generic [ref=f5e605]: 0 entrée
                    - listitem [ref=f5e607]:
                      - generic [ref=f5e608]:
                        - time [ref=f5e610]: 10:23
                        - generic [ref=f5e611]: 1 entrée
                    - listitem [ref=f5e614]:
                      - generic [ref=f5e615]:
                        - time [ref=f5e617]: 10:24
                        - generic [ref=f5e618]: 1 entrée
                    - listitem [ref=f5e621]:
                      - generic [ref=f5e622]:
                        - time [ref=f5e624]: 10:25
                        - generic [ref=f5e625]: 1 entrée
                    - listitem [ref=f5e628]:
                      - generic [ref=f5e629]:
                        - time [ref=f5e631]: 10:26
                        - generic [ref=f5e632]: 0 entrée
                    - listitem [ref=f5e634]:
                      - generic [ref=f5e635]:
                        - time [ref=f5e637]: 10:27
                        - generic [ref=f5e638]: 1 entrée
                    - listitem [ref=f5e641]:
                      - generic [ref=f5e642]:
                        - time [ref=f5e644]: 10:28
                        - generic [ref=f5e645]: 1 entrée
                    - listitem [ref=f5e648]:
                      - generic [ref=f5e649]:
                        - time [ref=f5e651]: 10:29
                        - generic [ref=f5e652]: 1 entrée
                    - listitem [ref=f5e655]:
                      - generic [ref=f5e656]:
                        - time [ref=f5e658]: 10:30
                        - generic [ref=f5e659]: 0 entrée
                    - listitem [ref=f5e661]:
                      - generic [ref=f5e662]:
                        - time [ref=f5e664]: 10:31
                        - generic [ref=f5e665]: 1 entrée
                    - listitem [ref=f5e668]:
                      - generic [ref=f5e669]:
                        - time [ref=f5e671]: 10:32
                        - generic [ref=f5e672]: 0 entrée
                    - listitem [ref=f5e674]:
                      - generic [ref=f5e675]:
                        - time [ref=f5e677]: 10:33
                        - generic [ref=f5e678]: 0 entrée
                    - listitem [ref=f5e680]:
                      - generic [ref=f5e681]:
                        - time [ref=f5e683]: 10:34
                        - generic [ref=f5e684]: 0 entrée
                    - listitem [ref=f5e686]:
                      - generic [ref=f5e687]:
                        - time [ref=f5e689]: 10:35
                        - generic [ref=f5e690]: 0 entrée
                    - listitem [ref=f5e692]:
                      - generic [ref=f5e693]:
                        - time [ref=f5e695]: 10:36
                        - generic [ref=f5e696]: 0 entrée
                    - listitem [ref=f5e698]:
                      - generic [ref=f5e699]:
                        - time [ref=f5e701]: 10:37
                        - generic [ref=f5e702]: 0 entrée
                    - listitem [ref=f5e704]:
                      - generic [ref=f5e705]:
                        - time [ref=f5e707]: 10:38
                        - generic [ref=f5e708]: 0 entrée
                    - listitem [ref=f5e710]:
                      - generic [ref=f5e711]:
                        - time [ref=f5e713]: 10:39
                        - generic [ref=f5e714]: 0 entrée
                - region [ref=f5e716]:
                  - generic [ref=f5e718]:
                    - heading "Incidents techniques" [level=2] [ref=f5e719]
                    - paragraph [ref=f5e720]: Coupures réseau, délais dépassés ou erreurs du serveur rencontrés par les scanners (sans effet sur les billets).
                  - table [ref=f5e723]:
                    - caption [ref=f5e724]: Incidents techniques par contrôleur
                    - rowgroup [ref=f5e725]:
                      - row [ref=f5e726]:
                        - columnheader "Contrôleur" [ref=f5e727]
                        - columnheader "Incident" [ref=f5e728]
                        - columnheader "Nombre" [ref=f5e729]
                        - columnheader "Dernier" [ref=f5e730]
                    - rowgroup [ref=f5e731]:
                      - row [ref=f5e732]:
                        - cell "Ibrahima Gueye" [ref=f5e733]
                        - cell "Coupure réseau" [ref=f5e734]
                        - cell "2" [ref=f5e735]
                        - cell [ref=f5e736]:
                          - time [ref=f5e737]: 10:01
                      - row [ref=f5e738]:
                        - cell "Lamine Cissé" [ref=f5e739]
                        - cell "Délai de réponse dépassé" [ref=f5e740]
                        - cell "1" [ref=f5e741]
                        - cell [ref=f5e742]:
                          - time [ref=f5e743]: 09:54
  - alert [ref=f5e744]
```

# Test source

```ts
  6   |  * aussi en paysage), pour que tout ce qui se décide au chargement suive la largeur. En clair : toutes les largeurs ; en
  7   |  * sombre : les largeurs capturées (360, 768, 1440) et le paysage. Les contrôles sont bloquants à chaque largeur contrôlée.
  8   |  *
  9   |  * Captures (JPEG, échelle 1, fenêtre visible) : .e2e-captures/captures-responsive/<page>__<largeur>__<thème>.jpg ;
  10  |  * résultats : .e2e-captures/responsive/<page>__<thème>.json, résumés par scripts/e2e/responsive-resume.mjs
  11  |  * (responsive.tsv et responsive.txt, publiés sur ci-results).
  12  |  */
  13  | import fs from 'node:fs';
  14  | import path from 'node:path';
  15  | import type { Page } from '@playwright/test';
  16  | import { test, expect, type CaptureRole, type ThemeKey } from './support/fixtures';
  17  | import { readDemoIds, E2E_OUTPUT_DIR, type DemoIds } from './support/demo-ids';
  18  | import { fakeScanMode, installFakeCamera } from './support/fake-camera';
  19  | import {
  20  |     PHONE_MAX_WIDTH, RESPONSIVE_CAPTURE_WIDTHS, RESPONSIVE_LANDSCAPE, RESPONSIVE_PAGES, RESPONSIVE_WIDTHS, type ResponsivePage,
  21  | } from './support/responsive-pages';
  22  | import { runResponsiveChecks } from './support/responsive-checks';
  23  | 
  24  | const RESULTS = path.join(E2E_OUTPUT_DIR, 'responsive');
  25  | const SHOTS = path.join(E2E_OUTPUT_DIR, 'captures-responsive');
  26  | 
  27  | const THEMES: ReadonlyArray<{ key: ThemeKey; colorScheme: 'light' | 'dark' }> = [
  28  |     { key: 'clair', colorScheme: 'light' },
  29  |     { key: 'sombre', colorScheme: 'dark' },
  30  | ];
  31  | 
  32  | interface Size { width: number; height: number; paysage?: boolean }
  33  | 
  34  | function sizesFor(p: ResponsivePage, theme: ThemeKey): Size[] {
  35  |     const base: Size[] = RESPONSIVE_WIDTHS
  36  |         .filter((w) => theme === 'clair' || RESPONSIVE_CAPTURE_WIDTHS.includes(w.width))
  37  |         .map((w) => ({ width: w.width, height: w.height }));
  38  |     const land: Size[] = p.paysage ? RESPONSIVE_LANDSCAPE.map((w) => ({ width: w.width, height: w.height, paysage: true })) : [];
  39  |     return [...base, ...land];
  40  | }
  41  | 
  42  | /** Page stable : polices chargées, réseau au repos (plafond 3 s, noté sinon), deux images d'affichage. */
  43  | async function settle(page: Page, notes: string[], at: string): Promise<void> {
  44  |     await page.evaluate(() => document.fonts.ready.then(() => true));
  45  |     await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => { notes.push(`${at} : réseau jamais au repos en 3 s (attente plafonnée)`); });
  46  |     await page.waitForFunction(() => Array.from(document.images).every((img) => img.complete), undefined, { timeout: 5_000 })
  47  |         .catch(() => { notes.push(`${at} : images encore en chargement après 5 s`); });
  48  |     await page.evaluate(() => new Promise<void>((resolve) => { requestAnimationFrame(() => requestAnimationFrame(() => resolve())); }));
  49  | }
  50  | 
  51  | interface ResponsiveRecord {
  52  |     page: string;
  53  |     titre: string;
  54  |     groupe: string;
  55  |     role: CaptureRole;
  56  |     theme: ThemeKey;
  57  |     url: string | null;
  58  |     sizes: Array<{ size: string; blocking: string[]; warnings: string[]; capture: string | null }>;
  59  |     notes: string[];
  60  |     error: string | null;
  61  | }
  62  | 
  63  | for (const theme of THEMES) {
  64  |     const roles = Array.from(new Set(RESPONSIVE_PAGES.map((p) => p.role)));
  65  |     for (const role of roles) {
  66  |         test.describe(`${theme.key} · ${role}`, () => {
  67  |             test.use({ colorScheme: theme.colorScheme, evTheme: theme.key, evRole: role });
  68  |             for (const p of RESPONSIVE_PAGES.filter((x) => x.role === role)) {
  69  |                 test(`${p.id} — ${p.titre}`, async ({ page, context, guard }) => {
  70  |                     test.setTimeout(240_000);
  71  |                     const record: ResponsiveRecord = { page: p.id, titre: p.titre, groupe: p.groupe, role, theme: theme.key, url: null, sizes: [], notes: [], error: null };
  72  |                     try {
  73  |                         const demo: DemoIds | null = p.needsIds ? readDemoIds() : null;
  74  |                         record.url = p.path(demo);
  75  |                         guard.configure({ allowFailures: p.allowFailures ?? [], ignoreConsoleErrors: false });
  76  |                         if (p.fakeCamera) await context.addInitScript(installFakeCamera, { mode: fakeScanMode() });
  77  |                         for (const size of sizesFor(p, theme.key)) {
  78  |                             const at = size.paysage ? `${size.width}×${size.height} px (paysage)` : `${size.width} px`;
  79  |                             await page.setViewportSize({ width: size.width, height: size.height });
  80  |                             const response = await page.goto(record.url, { waitUntil: 'load' });
  81  |                             if (p.expectStatus !== undefined) expect(response?.status(), `statut HTTP de ${record.url}`).toBe(p.expectStatus);
  82  |                             if (p.ready) await p.ready(page);
  83  |                             else await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 30_000 });
  84  |                             if (p.actions) await p.actions(page);
  85  |                             await settle(page, record.notes, at);
  86  |                             const checks = await runResponsiveChecks(page, { width: size.width, phone: !size.paysage && size.width <= PHONE_MAX_WIDTH });
  87  |                             const blocking = checks.blocking.map((b) => (size.paysage ? b.replace(`${size.width} px`, at) : b));
  88  |                             let capture: string | null = null;
  89  |                             if (size.paysage || RESPONSIVE_CAPTURE_WIDTHS.includes(size.width)) {
  90  |                                 fs.mkdirSync(SHOTS, { recursive: true });
  91  |                                 capture = `${p.id}__${size.paysage ? `${size.width}x${size.height}` : size.width}__${theme.key}.jpg`;
  92  |                                 await page.screenshot({ path: path.join(SHOTS, capture), type: 'jpeg', quality: 80, animations: 'disabled', caret: 'hide', scale: 'css' });
  93  |                             }
  94  |                             record.sizes.push({ size: at, blocking, warnings: checks.warnings, capture });
  95  |                         }
  96  |                     } catch (err) {
  97  |                         record.error = err instanceof Error ? err.message.split('\n')[0] : String(err);
  98  |                         throw err;
  99  |                     } finally {
  100 |                         // Erreurs de la page (console, requêtes) : notées, déjà bloquantes dans les captures
  101 |                         record.notes.push(...guard.blockingIssues().map((i) => `erreur de la page : ${i}`));
  102 |                         fs.mkdirSync(RESULTS, { recursive: true });
  103 |                         fs.writeFileSync(path.join(RESULTS, `${p.id}__${theme.key}.json`), `${JSON.stringify(record, null, 1)}\n`, 'utf8');
  104 |                     }
  105 |                     const blocking = record.sizes.flatMap((s) => s.blocking);
> 106 |                     expect(blocking, `contrôles responsive de ${p.id} (${theme.key})`).toEqual([]);
      |                                                                                        ^ Error: contrôles responsive de org-pilotage-entrees (clair)
  107 |                 });
  108 |             }
  109 |         });
  110 |     }
  111 | }
  112 | 
```