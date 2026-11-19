# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> sombre · organisateur >> org-pilotage-entrees — Pilotage — Entrées
- Location: e2e/responsive.spec.ts:69:21

# Error details

```
Error: contrôles responsive de org-pilotage-entrees (sombre)

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 4

- Array []
+ Array [
+   "768 px : textes qui se chevauchent : span.hidden.whitespace-nowrap « Event Village » sur span.truncate « Rechercher un événement, un concert, un restaurant » (46×18 px)",
+   "1440 px : texte tronqué sans le texte entier : span.block.truncate « Mariama Ndiaye » (points de suspension, texte entier absent)",
+ ]
```

# Page snapshot

```yaml
- generic [active] [ref=f2e1]:
  - generic [ref=f2e2]:
    - complementary [ref=f2e3]:
      - link "Event Village, accueil" [ref=f2e5] [cursor=pointer]:
        - /url: /
        - generic [ref=f2e6]: Event Village
      - navigation "Navigation principale" [ref=f2e9]:
        - generic [ref=f2e10]:
          - paragraph [ref=f2e11]: Gestion
          - generic [ref=f2e12]:
            - link "Tableau de bord" [ref=f2e13] [cursor=pointer]:
              - /url: /partner/dashboard
            - link "Événements" [ref=f2e20] [cursor=pointer]:
              - /url: /partner/events
            - link "Équipe" [ref=f2e24] [cursor=pointer]:
              - /url: /partner/team
        - generic [ref=f2e31]:
          - paragraph [ref=f2e32]: Outils
          - generic [ref=f2e33]:
            - link "Finances" [ref=f2e34] [cursor=pointer]:
              - /url: /partner/finance
            - link "Statistiques" [ref=f2e38] [cursor=pointer]:
              - /url: /partner/stats
            - link "Scanner les billets" [ref=f2e42] [cursor=pointer]:
              - /url: /partner/scan
            - link "Calendrier" [ref=f2e50] [cursor=pointer]:
              - /url: /partner/calendar
            - link "Abonnement" [ref=f2e54] [cursor=pointer]:
              - /url: /partner/subscription
            - link "Profil partenaire" [ref=f2e59] [cursor=pointer]:
              - /url: /partner/profile
        - link "Retour au site" [ref=f2e65] [cursor=pointer]:
          - /url: /
      - generic [ref=f2e71]:
        - link "Mariama Ndiaye Partenaire" [ref=f2e72] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=f2e73]: MN
          - generic [ref=f2e74]:
            - generic [ref=f2e75]: Mariama Ndiaye
            - generic [ref=f2e76]: Partenaire
        - generic [ref=f2e77]:
          - button "Se déconnecter" [ref=f2e78] [cursor=pointer]
          - button "Basculer le thème" [ref=f2e83] [cursor=pointer]
    - generic [ref=f2e87]:
      - banner [ref=f2e88]:
        - link "Rechercher un événement, un concert, un restaurant…" [ref=f2e90] [cursor=pointer]:
          - /url: /explore
        - button "Notifications, 99+ non lues" [ref=f2e97] [cursor=pointer]:
          - generic [ref=f2e101]: 99+
      - main [ref=f2e102]:
        - generic [ref=f2e104]:
          - generic [ref=f2e105]:
            - link "Mes événements" [ref=f2e107] [cursor=pointer]:
              - /url: /partner/events
            - generic [ref=f2e112]:
              - generic [ref=f2e113]:
                - generic [ref=f2e114]:
                  - 'generic "En ligne : la page publique est visible et la billetterie est ouverte." [ref=f2e115]': Publié
                  - status [ref=f2e118]: En direct
                - heading "Nuit du Sabar — édition d’automne" [level=1] [ref=f2e120]
                - paragraph [ref=f2e121]:
                  - generic [ref=f2e122]:
                    - generic [ref=f2e123]: jeu. 19 nov. 2026 à 11:30
                    - generic [ref=f2e126]: Esplanade de la Corniche Ouest, Dakar
              - generic [ref=f2e130]:
                - link "Modifier" [ref=f2e131] [cursor=pointer]:
                  - /url: /partner/events/1b6b9b15-31a6-41c3-856d-f27700d91f21/edit
                - button "Annuler l’événement" [ref=f2e137] [cursor=pointer]
          - generic [ref=f2e143]:
            - tablist "Rubriques du pilotage" [ref=f2e146]:
              - tab "Aperçu" [ref=f2e147] [cursor=pointer]
              - tab "Infos" [ref=f2e149] [cursor=pointer]
              - tab "Ventes" [ref=f2e151] [cursor=pointer]
              - tab "Invitations" [ref=f2e153] [cursor=pointer]
              - tab "Entrées" [selected] [ref=f2e155] [cursor=pointer]
              - tab "Équipe" [ref=f2e157] [cursor=pointer]
              - tab "Caisse" [ref=f2e159] [cursor=pointer]
              - tab "Clôture" [ref=f2e161] [cursor=pointer]
            - tabpanel "Entrées" [ref=f2e163]:
              - generic [ref=f2e164]:
                - generic [ref=f2e165]:
                  - generic [ref=f2e166]:
                    - paragraph [ref=f2e168]: Entrées validées
                    - paragraph [ref=f2e173]: "61"
                    - paragraph [ref=f2e174]: Scans acceptés, guichet compris
                  - generic [ref=f2e175]:
                    - paragraph [ref=f2e177]: Au guichet
                    - paragraph [ref=f2e184]: "17"
                    - paragraph [ref=f2e185]: Billets vendus et validés sur place
                  - generic [ref=f2e186]:
                    - paragraph [ref=f2e188]: Refus
                    - paragraph [ref=f2e193]: "10"
                    - paragraph [ref=f2e194]: Tentatives refusées au contrôle
                  - generic [ref=f2e195]:
                    - paragraph [ref=f2e197]: Liste des invités
                    - paragraph [ref=f2e202]: "0"
                    - paragraph [ref=f2e203]: Entrées validées par la liste, pièce vérifiée
                  - generic [ref=f2e204]:
                    - paragraph [ref=f2e206]: Débit
                    - paragraph [ref=f2e211]: 0,0 par minute
                    - paragraph [ref=f2e212]: Moyenne des 5 dernières minutes
                  - generic [ref=f2e213]:
                    - paragraph [ref=f2e215]: Contrôleurs actifs
                    - paragraph [ref=f2e222]: 0 sur 3
                    - paragraph [ref=f2e223]: Un scan dans les 10 dernières minutes
                - paragraph [ref=f2e224]:
                  - text: Mis à jour à
                  - time [ref=f2e225]: 10:44
                - region [ref=f2e226]:
                  - generic [ref=f2e228]:
                    - heading "Tentatives multiples" [level=2] [ref=f2e229]
                    - paragraph [ref=f2e230]: Même billet présenté plusieurs fois en moins de dix minutes, ou billet déjà utilisé.
                  - status [ref=f2e231]:
                    - generic [ref=f2e236]:
                      - paragraph [ref=f2e237]: Billets présentés plusieurs fois
                      - generic [ref=f2e238]: "Vérifiez ces billets avec vos contrôleurs : il peut s’agir d’une capture d’écran partagée."
                  - table [ref=f2e241]:
                    - caption [ref=f2e242]: Billets présentés plusieurs fois
                    - rowgroup [ref=f2e243]:
                      - row [ref=f2e244]:
                        - columnheader "Billet" [ref=f2e245]
                        - columnheader "Catégorie" [ref=f2e246]
                        - columnheader "Tentatives" [ref=f2e247]
                        - columnheader "Dernier résultat" [ref=f2e248]
                        - columnheader "Dernière tentative" [ref=f2e249]
                    - rowgroup [ref=f2e250]:
                      - row [ref=f2e251]:
                        - cell "TCK-20261119-1EE371419D" [ref=f2e252]
                        - cell "Pass soirée" [ref=f2e253]
                        - cell "2" [ref=f2e254]
                        - cell "Billet d’un autre événement" [ref=f2e255]
                        - cell [ref=f2e256]:
                          - time [ref=f2e257]: 10:03
                      - row [ref=f2e258]:
                        - cell "TCK-20261119-9CF053A72D" [ref=f2e259]
                        - cell "Prévente" [ref=f2e260]
                        - cell "2" [ref=f2e261]
                        - cell "Billet déjà utilisé" [ref=f2e262]
                        - cell [ref=f2e263]:
                          - time [ref=f2e264]: 09:58
                      - row [ref=f2e265]:
                        - cell "TCK-20261119-1701FB4ED8" [ref=f2e266]
                        - cell "Prévente" [ref=f2e267]
                        - cell "3" [ref=f2e268]
                        - cell "Billet déjà utilisé" [ref=f2e269]
                        - cell [ref=f2e270]:
                          - time [ref=f2e271]: 09:56
                - region [ref=f2e272]:
                  - generic [ref=f2e274]:
                    - heading "Par contrôleur" [level=2] [ref=f2e275]
                    - paragraph [ref=f2e276]: Entrées, refus et incidents de chaque compte qui a scanné.
                  - table [ref=f2e279]:
                    - caption [ref=f2e280]: Entrées par contrôleur
                    - rowgroup [ref=f2e281]:
                      - row [ref=f2e282]:
                        - columnheader "Contrôleur" [ref=f2e283]
                        - columnheader "Point d’entrée" [ref=f2e284]
                        - columnheader "Entrées" [ref=f2e285]
                        - columnheader "Refus" [ref=f2e286]
                        - columnheader "Incidents" [ref=f2e287]
                        - columnheader "Dernière activité" [ref=f2e288]
                    - rowgroup [ref=f2e289]:
                      - row [ref=f2e290]:
                        - cell "Ibrahima Gueye" [ref=f2e291]
                        - cell "Entrée principale" [ref=f2e292]
                        - cell "32" [ref=f2e293]
                        - cell "5" [ref=f2e294]
                        - cell "2" [ref=f2e295]
                        - cell [ref=f2e296]:
                          - time [ref=f2e297]: jeu. 19 nov. 2026 à 10:31
                      - row [ref=f2e298]:
                        - cell "Lamine Cissé" [ref=f2e299]
                        - cell "Entrée principale" [ref=f2e300]
                        - cell "22" [ref=f2e301]
                        - cell "4" [ref=f2e302]
                        - cell "1" [ref=f2e303]
                        - cell [ref=f2e304]:
                          - time [ref=f2e305]: jeu. 19 nov. 2026 à 10:27
                      - row [ref=f2e306]:
                        - cell "Seynabou Ba" [ref=f2e307]
                        - cell "Entrée VIP" [ref=f2e308]
                        - cell "7" [ref=f2e309]
                        - cell "1" [ref=f2e310]
                        - cell "0" [ref=f2e311]
                        - cell [ref=f2e312]:
                          - time [ref=f2e313]: jeu. 19 nov. 2026 à 10:23
                - generic [ref=f2e314]:
                  - region [ref=f2e315]:
                    - heading "Par point d’entrée" [level=2] [ref=f2e318]
                    - table [ref=f2e321]:
                      - caption [ref=f2e322]: Entrées par point d’entrée
                      - rowgroup [ref=f2e323]:
                        - row [ref=f2e324]:
                          - columnheader "Point d’entrée" [ref=f2e325]
                          - columnheader "Entrées" [ref=f2e326]
                          - columnheader "Refus" [ref=f2e327]
                          - columnheader "Débit" [ref=f2e328]
                          - columnheader "Contrôleurs" [ref=f2e329]
                      - rowgroup [ref=f2e330]:
                        - row [ref=f2e331]:
                          - cell "Entrée principale" [ref=f2e332]
                          - cell "54" [ref=f2e333]
                          - cell "9" [ref=f2e334]
                          - cell "0,0 par minute" [ref=f2e335]
                          - cell "0 actif sur 2" [ref=f2e336]
                        - row [ref=f2e337]:
                          - cell "Entrée VIP" [ref=f2e338]
                          - cell "7" [ref=f2e339]
                          - cell "1" [ref=f2e340]
                          - cell "0,0 par minute" [ref=f2e341]
                          - cell "0 actif sur 1" [ref=f2e342]
                  - generic [ref=f2e343]:
                    - region [ref=f2e344]:
                      - heading "Par catégorie" [level=2] [ref=f2e347]
                      - list "Entrées par catégorie" [ref=f2e348]:
                        - listitem [ref=f2e349]:
                          - generic [ref=f2e350]:
                            - generic [ref=f2e351]: Prévente
                            - generic [ref=f2e352]: 14 entrés sur 22
                        - listitem [ref=f2e355]:
                          - generic [ref=f2e356]:
                            - generic [ref=f2e357]: Standard
                            - generic [ref=f2e358]: 40 entrés sur 50
                        - listitem [ref=f2e361]:
                          - generic [ref=f2e362]:
                            - generic [ref=f2e363]: VIP
                            - generic [ref=f2e364]: 6 entrés sur 10
                        - listitem [ref=f2e367]:
                          - generic [ref=f2e368]:
                            - generic [ref=f2e369]: Carré presse
                            - generic [ref=f2e370]: 1 entré sur 1
                        - listitem [ref=f2e373]:
                          - generic [ref=f2e374]:
                            - generic [ref=f2e375]: Invités de la production
                            - generic [ref=f2e376]: 0 entré sur 0
                    - region [ref=f2e378]:
                      - heading "Par origine" [level=2] [ref=f2e381]
                      - list "Entrées par origine" [ref=f2e382]:
                        - listitem [ref=f2e383]:
                          - generic [ref=f2e384]:
                            - generic [ref=f2e385]: En ligne
                            - generic [ref=f2e386]: 44 entrés sur 66
                        - listitem [ref=f2e389]:
                          - generic [ref=f2e390]:
                            - generic [ref=f2e391]: Guichet
                            - generic [ref=f2e392]: 17 entrés sur 17
                        - listitem [ref=f2e395]:
                          - generic [ref=f2e396]:
                            - generic [ref=f2e397]: Gratuit
                            - generic [ref=f2e398]: 0 entré sur 0
                        - listitem [ref=f2e400]:
                          - generic [ref=f2e401]:
                            - generic [ref=f2e402]: Invitation
                            - generic [ref=f2e403]: 0 entré sur 0
                    - region [ref=f2e405]:
                      - generic [ref=f2e407]:
                        - heading "Flux par quart d’heure" [level=2] [ref=f2e408]
                        - paragraph [ref=f2e409]: Heure de Dakar.
                      - list "Entrées par quart d’heure" [ref=f2e410]:
                        - listitem [ref=f2e411]:
                          - generic [ref=f2e412]:
                            - time [ref=f2e414]: jeu. 19 nov. 2026 à 08:45
                            - generic [ref=f2e415]: 5 entrées
                        - listitem [ref=f2e418]:
                          - generic [ref=f2e419]:
                            - time [ref=f2e421]: jeu. 19 nov. 2026 à 09:00
                            - generic [ref=f2e422]: 10 entrées
                        - listitem [ref=f2e425]:
                          - generic [ref=f2e426]:
                            - time [ref=f2e428]: jeu. 19 nov. 2026 à 09:15
                            - generic [ref=f2e429]: 11 entrées
                        - listitem [ref=f2e432]:
                          - generic [ref=f2e433]:
                            - time [ref=f2e435]: jeu. 19 nov. 2026 à 09:30
                            - generic [ref=f2e436]: 11 entrées
                        - listitem [ref=f2e439]:
                          - generic [ref=f2e440]:
                            - time [ref=f2e442]: jeu. 19 nov. 2026 à 09:45
                            - generic [ref=f2e443]: 7 entrées4 refus
                        - listitem [ref=f2e446]:
                          - generic [ref=f2e447]:
                            - time [ref=f2e449]: jeu. 19 nov. 2026 à 10:00
                            - generic [ref=f2e450]: 5 entrées6 refus
                        - listitem [ref=f2e453]:
                          - generic [ref=f2e454]:
                            - time [ref=f2e456]: jeu. 19 nov. 2026 à 10:15
                            - generic [ref=f2e457]: 11 entrées
                        - listitem [ref=f2e460]:
                          - generic [ref=f2e461]:
                            - time [ref=f2e463]: jeu. 19 nov. 2026 à 10:30
                            - generic [ref=f2e464]: 1 entrée
                    - region [ref=f2e467]:
                      - heading "Refus par motif" [level=2] [ref=f2e470]
                      - list "Refus par motif" [ref=f2e471]:
                        - listitem [ref=f2e472]:
                          - generic [ref=f2e473]:
                            - generic [ref=f2e474]: Billet déjà utilisé
                            - generic [ref=f2e475]: 3 refus
                        - listitem [ref=f2e478]:
                          - generic [ref=f2e479]:
                            - generic [ref=f2e480]: QR expiré
                            - generic [ref=f2e481]: 2 refus
                        - listitem [ref=f2e484]:
                          - generic [ref=f2e485]:
                            - generic [ref=f2e486]: Billet d’un autre événement
                            - generic [ref=f2e487]: 2 refus
                        - listitem [ref=f2e490]:
                          - generic [ref=f2e491]:
                            - generic [ref=f2e492]: QR dynamique requis
                            - generic [ref=f2e493]: 1 refus
                        - listitem [ref=f2e496]:
                          - generic [ref=f2e497]:
                            - generic [ref=f2e498]: Billet invalide
                            - generic [ref=f2e499]: 1 refus
                        - listitem [ref=f2e502]:
                          - generic [ref=f2e503]:
                            - generic [ref=f2e504]: Saisie manuelle refusée
                            - generic [ref=f2e505]: 1 refus
                  - region [ref=f2e508]:
                    - generic [ref=f2e510]:
                      - heading "Validations par la liste des invités" [level=2] [ref=f2e511]
                      - paragraph [ref=f2e512]: Entrées validées par un contrôleur avec la liste des invités, pièce d’identité vérifiée.
                    - paragraph [ref=f2e513]: Aucune entrée validée par la liste des invités.
                - region [ref=f2e514]:
                  - generic [ref=f2e516]:
                    - heading "Débit par minute" [level=2] [ref=f2e517]
                    - paragraph [ref=f2e518]: Entrées de chaque minute sur les 30 dernières minutes, heure de Dakar.
                  - list "Entrées par minute" [ref=f2e519]:
                    - listitem [ref=f2e520]:
                      - generic [ref=f2e521]:
                        - time [ref=f2e523]: 10:15
                        - generic [ref=f2e524]: 0 entrée
                    - listitem [ref=f2e526]:
                      - generic [ref=f2e527]:
                        - time [ref=f2e529]: 10:16
                        - generic [ref=f2e530]: 1 entrée
                    - listitem [ref=f2e533]:
                      - generic [ref=f2e534]:
                        - time [ref=f2e536]: 10:17
                        - generic [ref=f2e537]: 1 entrée
                    - listitem [ref=f2e540]:
                      - generic [ref=f2e541]:
                        - time [ref=f2e543]: 10:18
                        - generic [ref=f2e544]: 1 entrée
                    - listitem [ref=f2e547]:
                      - generic [ref=f2e548]:
                        - time [ref=f2e550]: 10:19
                        - generic [ref=f2e551]: 1 entrée
                    - listitem [ref=f2e554]:
                      - generic [ref=f2e555]:
                        - time [ref=f2e557]: 10:20
                        - generic [ref=f2e558]: 0 entrée
                    - listitem [ref=f2e560]:
                      - generic [ref=f2e561]:
                        - time [ref=f2e563]: 10:21
                        - generic [ref=f2e564]: 1 entrée
                    - listitem [ref=f2e567]:
                      - generic [ref=f2e568]:
                        - time [ref=f2e570]: 10:22
                        - generic [ref=f2e571]: 0 entrée
                    - listitem [ref=f2e573]:
                      - generic [ref=f2e574]:
                        - time [ref=f2e576]: 10:23
                        - generic [ref=f2e577]: 1 entrée
                    - listitem [ref=f2e580]:
                      - generic [ref=f2e581]:
                        - time [ref=f2e583]: 10:24
                        - generic [ref=f2e584]: 1 entrée
                    - listitem [ref=f2e587]:
                      - generic [ref=f2e588]:
                        - time [ref=f2e590]: 10:25
                        - generic [ref=f2e591]: 1 entrée
                    - listitem [ref=f2e594]:
                      - generic [ref=f2e595]:
                        - time [ref=f2e597]: 10:26
                        - generic [ref=f2e598]: 0 entrée
                    - listitem [ref=f2e600]:
                      - generic [ref=f2e601]:
                        - time [ref=f2e603]: 10:27
                        - generic [ref=f2e604]: 1 entrée
                    - listitem [ref=f2e607]:
                      - generic [ref=f2e608]:
                        - time [ref=f2e610]: 10:28
                        - generic [ref=f2e611]: 1 entrée
                    - listitem [ref=f2e614]:
                      - generic [ref=f2e615]:
                        - time [ref=f2e617]: 10:29
                        - generic [ref=f2e618]: 1 entrée
                    - listitem [ref=f2e621]:
                      - generic [ref=f2e622]:
                        - time [ref=f2e624]: 10:30
                        - generic [ref=f2e625]: 0 entrée
                    - listitem [ref=f2e627]:
                      - generic [ref=f2e628]:
                        - time [ref=f2e630]: 10:31
                        - generic [ref=f2e631]: 1 entrée
                    - listitem [ref=f2e634]:
                      - generic [ref=f2e635]:
                        - time [ref=f2e637]: 10:32
                        - generic [ref=f2e638]: 0 entrée
                    - listitem [ref=f2e640]:
                      - generic [ref=f2e641]:
                        - time [ref=f2e643]: 10:33
                        - generic [ref=f2e644]: 0 entrée
                    - listitem [ref=f2e646]:
                      - generic [ref=f2e647]:
                        - time [ref=f2e649]: 10:34
                        - generic [ref=f2e650]: 0 entrée
                    - listitem [ref=f2e652]:
                      - generic [ref=f2e653]:
                        - time [ref=f2e655]: 10:35
                        - generic [ref=f2e656]: 0 entrée
                    - listitem [ref=f2e658]:
                      - generic [ref=f2e659]:
                        - time [ref=f2e661]: 10:36
                        - generic [ref=f2e662]: 0 entrée
                    - listitem [ref=f2e664]:
                      - generic [ref=f2e665]:
                        - time [ref=f2e667]: 10:37
                        - generic [ref=f2e668]: 0 entrée
                    - listitem [ref=f2e670]:
                      - generic [ref=f2e671]:
                        - time [ref=f2e673]: 10:38
                        - generic [ref=f2e674]: 0 entrée
                    - listitem [ref=f2e676]:
                      - generic [ref=f2e677]:
                        - time [ref=f2e679]: 10:39
                        - generic [ref=f2e680]: 0 entrée
                    - listitem [ref=f2e682]:
                      - generic [ref=f2e683]:
                        - time [ref=f2e685]: 10:40
                        - generic [ref=f2e686]: 0 entrée
                    - listitem [ref=f2e688]:
                      - generic [ref=f2e689]:
                        - time [ref=f2e691]: 10:41
                        - generic [ref=f2e692]: 0 entrée
                    - listitem [ref=f2e694]:
                      - generic [ref=f2e695]:
                        - time [ref=f2e697]: 10:42
                        - generic [ref=f2e698]: 0 entrée
                    - listitem [ref=f2e700]:
                      - generic [ref=f2e701]:
                        - time [ref=f2e703]: 10:43
                        - generic [ref=f2e704]: 0 entrée
                    - listitem [ref=f2e706]:
                      - generic [ref=f2e707]:
                        - time [ref=f2e709]: 10:44
                        - generic [ref=f2e710]: 0 entrée
                - region [ref=f2e712]:
                  - generic [ref=f2e714]:
                    - heading "Incidents techniques" [level=2] [ref=f2e715]
                    - paragraph [ref=f2e716]: Coupures réseau, délais dépassés ou erreurs du serveur rencontrés par les scanners (sans effet sur les billets).
                  - table [ref=f2e719]:
                    - caption [ref=f2e720]: Incidents techniques par contrôleur
                    - rowgroup [ref=f2e721]:
                      - row [ref=f2e722]:
                        - columnheader "Contrôleur" [ref=f2e723]
                        - columnheader "Incident" [ref=f2e724]
                        - columnheader "Nombre" [ref=f2e725]
                        - columnheader "Dernier" [ref=f2e726]
                    - rowgroup [ref=f2e727]:
                      - row [ref=f2e728]:
                        - cell "Ibrahima Gueye" [ref=f2e729]
                        - cell "Coupure réseau" [ref=f2e730]
                        - cell "2" [ref=f2e731]
                        - cell [ref=f2e732]:
                          - time [ref=f2e733]: 10:01
                      - row [ref=f2e734]:
                        - cell "Lamine Cissé" [ref=f2e735]
                        - cell "Délai de réponse dépassé" [ref=f2e736]
                        - cell "1" [ref=f2e737]
                        - cell [ref=f2e738]:
                          - time [ref=f2e739]: 09:54
  - alert [ref=f2e740]
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
      |                                                                                        ^ Error: contrôles responsive de org-pilotage-entrees (sombre)
  107 |                 });
  108 |             }
  109 |         });
  110 |     }
  111 | }
  112 | 
```