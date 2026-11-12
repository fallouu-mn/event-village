# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> clair · anonyme >> accueil-dernieres-places — Accueil — badge « Dernières places » d’un événement presque complet
- Location: e2e/captures.spec.ts:185:9

# Error details

```
Error: [e2e] demo-ids.json : events.dernieresPlaces absent (graine v4 du lot 9 ter, fix(9t.seed))
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
        - generic [ref=e16]:
          - button "Notifications" [ref=e18] [cursor=pointer]
          - button "Basculer le thème" [ref=e23] [cursor=pointer]
          - link "Se connecter" [ref=e27] [cursor=pointer]:
            - /url: /login
      - main [ref=e31]:
        - generic [ref=e33]:
          - generic [ref=e35]:
            - generic [ref=e36]:
              - paragraph [ref=e37]: Billetterie officielle au Sénégal
              - heading "Découvrez, réservez et vivez les événements qui comptent." [level=1] [ref=e41]
              - paragraph [ref=e42]: "Concerts, festivals, soirées et rencontres : choisissez votre place, payez en quelques secondes et présentez votre billet à l’entrée."
              - search [ref=e43]:
                - generic [ref=e45]:
                  - generic [ref=e46]: Rechercher un événement
                  - searchbox "Rechercher un événement" [ref=e48]
                - button "Explorer" [ref=e49] [cursor=pointer]
            - list [ref=e55]:
              - listitem [ref=e56]:
                - generic [ref=e60]:
                  - paragraph [ref=e61]: Wave et Orange Money
                  - paragraph [ref=e62]: Payez depuis votre téléphone, le billet arrive aussitôt.
              - listitem [ref=e63]:
                - generic [ref=e71]:
                  - paragraph [ref=e72]: QR code dynamique
                  - paragraph [ref=e73]: "Un code renouvelé en continu : une capture d’écran ne passe pas l’entrée."
              - listitem [ref=e74]:
                - generic [ref=e79]:
                  - paragraph [ref=e80]: Remboursement automatique
                  - paragraph [ref=e81]: "Événement annulé : les billets payés en ligne sont remboursés."
          - region [ref=e82]:
            - generic [ref=e83]:
              - generic [ref=e84]:
                - heading "À l’affiche" [level=2] [ref=e85]
                - status [ref=e86]: En direct
              - link "Tous les événements" [ref=e88] [cursor=pointer]:
                - /url: /explore
            - group "Catégorie" [ref=e93]:
              - button "Tous" [pressed] [ref=e94] [cursor=pointer]
              - button "Concerts & Musique" [ref=e95] [cursor=pointer]
              - button "Festivals" [ref=e96] [cursor=pointer]
              - button "Gastronomie & Tables" [ref=e97] [cursor=pointer]
              - button "Salles & Réceptions" [ref=e98] [cursor=pointer]
            - list [ref=e99]:
              - listitem [ref=e100]:
                - article [ref=e101]:
                  - generic [ref=e103]:
                    - generic [ref=e104]:
                      - generic [aria-hidden] [ref=e105]:
                        - generic [ref=e106]: "12"
                        - generic [ref=e107]: NOV
                      - generic [ref=e108]:
                        - paragraph [ref=e109]: Baobab Scène
                        - heading [level=3] [ref=e110]:
                          - link "Nuit du Sabar — édition d’automne" [ref=e111] [cursor=pointer]:
                            - /url: /events/2434a00a-ba99-4ec2-aa98-892ac2b8c627
                    - generic [ref=e112]: Concerts & Musique
                    - list [ref=e115]:
                      - listitem [ref=e116]:
                        - generic [ref=e119]: 12 NOV 2026 à 12:45
                      - listitem [ref=e120]:
                        - generic [ref=e124]: Dakar · Esplanade de la Corniche Ouest
                    - generic [ref=e126]:
                      - paragraph [ref=e127]: À partir de
                      - paragraph [ref=e128]: 5 000 F CFA
              - listitem [ref=e132]:
                - article [ref=e133]:
                  - generic [ref=e135]:
                    - generic [ref=e136]:
                      - generic [aria-hidden] [ref=e137]:
                        - generic [ref=e138]: "13"
                        - generic [ref=e139]: NOV
                      - generic [ref=e140]:
                        - paragraph [ref=e141]: Baobab Scène
                        - heading [level=3] [ref=e142]:
                          - link "Concert des Lumières de Gorée" [ref=e143] [cursor=pointer]:
                            - /url: /events/bee25d2e-9f0d-4058-b4f4-0b09ff39a4f0
                    - generic [ref=e144]: Concerts & Musique
                    - list [ref=e147]:
                      - listitem [ref=e148]:
                        - generic [ref=e151]: 13 NOV 2026 à 08:00
                      - listitem [ref=e152]:
                        - generic [ref=e156]: Gorée · Place du Gouvernement
                    - generic [ref=e158]:
                      - paragraph [ref=e159]: À partir de
                      - paragraph [ref=e160]: 6 000 F CFA
              - listitem [ref=e164]:
                - article [ref=e165]:
                  - generic [ref=e167]:
                    - generic [ref=e168]:
                      - generic [aria-hidden] [ref=e169]:
                        - generic [ref=e170]: "17"
                        - generic [ref=e171]: NOV
                      - generic [ref=e172]:
                        - paragraph [ref=e173]: Petite-Côte Événements
                        - heading [level=3] [ref=e174]:
                          - link "Marché gourmand de la Petite-Côte" [ref=e175] [cursor=pointer]:
                            - /url: /events/d2dbe96b-43c6-4721-bf33-5370d0fc7a71
                    - generic [ref=e176]: Gastronomie & Tables
                    - list [ref=e179]:
                      - listitem [ref=e180]:
                        - generic [ref=e183]: 17 NOV 2026 à 10:00
                      - listitem [ref=e184]:
                        - generic [ref=e188]: Mbour · Place du Marché Central
                    - generic [ref=e190]:
                      - paragraph [ref=e191]: À partir de
                      - paragraph [ref=e192]: 1 000 F CFA
              - listitem [ref=e196]:
                - article [ref=e197]:
                  - generic [ref=e199]:
                    - generic [ref=e200]:
                      - generic [aria-hidden] [ref=e201]:
                        - generic [ref=e202]: "20"
                        - generic [ref=e203]: NOV
                      - generic [ref=e204]:
                        - paragraph [ref=e205]: Saloum Culture
                        - heading [level=3] [ref=e206]:
                          - link "Dîner-spectacle au bord du Saloum" [ref=e207] [cursor=pointer]:
                            - /url: /events/994773f5-e810-4266-859c-5dcc5b4b0c35
                    - generic [ref=e208]: Salles & Réceptions
                    - list [ref=e211]:
                      - listitem [ref=e212]:
                        - generic [ref=e215]: 20 NOV 2026 à 20:00
                      - listitem [ref=e216]:
                        - generic [ref=e220]: Foundiougne · Terrasse des Pirogues
                    - generic [ref=e222]:
                      - paragraph [ref=e223]: À partir de
                      - paragraph [ref=e224]: 25 000 F CFA
              - listitem [ref=e228]:
                - article [ref=e229]:
                  - generic [ref=e231]:
                    - generic [ref=e232]:
                      - generic [aria-hidden] [ref=e233]:
                        - generic [ref=e234]: "24"
                        - generic [ref=e235]: NOV
                      - generic [ref=e236]:
                        - paragraph [ref=e237]: Baobab Scène
                        - heading [level=3] [ref=e238]:
                          - link "Festival Jazz sur le Fleuve" [ref=e239] [cursor=pointer]:
                            - /url: /events/e36ff04d-4e1c-4ba2-8507-ab702194836f
                    - generic [ref=e240]: Festivals
                    - list [ref=e243]:
                      - listitem [ref=e244]:
                        - generic [ref=e247]: 24 NOV 2026 à 18:00
                      - listitem [ref=e248]:
                        - generic [ref=e252]: Saint-Louis · Quai des Pêcheurs
                    - generic [ref=e254]:
                      - paragraph [ref=e255]: À partir de
                      - paragraph [ref=e256]: 7 500 F CFA
              - listitem [ref=e260]:
                - article [ref=e261]:
                  - generic [ref=e263]:
                    - generic [ref=e264]:
                      - generic [aria-hidden] [ref=e265]:
                        - generic [ref=e266]: "29"
                        - generic [ref=e267]: NOV
                      - generic [ref=e268]:
                        - paragraph [ref=e269]: Baobab Scène
                        - heading [level=3] [ref=e270]:
                          - link "Soirée Kora & Lumières" [ref=e271] [cursor=pointer]:
                            - /url: /events/d5b0190e-3cd4-44a8-a864-56862d368422
                    - generic [ref=e272]: Concerts & Musique
                    - list [ref=e275]:
                      - listitem [ref=e276]:
                        - generic [ref=e279]: 29 NOV 2026 à 20:30
                      - listitem [ref=e280]:
                        - generic [ref=e284]: Dakar · Jardin de la Maison des Arts
                    - generic [ref=e286]:
                      - paragraph [ref=e287]: À partir de
                      - paragraph [ref=e288]: 6 000 F CFA
              - listitem [ref=e292]:
                - article [ref=e293]:
                  - generic [ref=e295]:
                    - generic [ref=e296]:
                      - generic [aria-hidden] [ref=e297]:
                        - generic [ref=e298]: "02"
                        - generic [ref=e299]: DÉC
                      - generic [ref=e300]:
                        - paragraph [ref=e301]: Orga B (test)
                        - heading [level=3] [ref=e302]:
                          - link "TEST Spectacle B (publié, à venir)" [ref=e303] [cursor=pointer]:
                            - /url: /events/a0bc41f6-6d63-47e1-95be-7908fd7fea7e
                    - generic [ref=e304]: Concerts & Musique
                    - list [ref=e307]:
                      - listitem [ref=e308]:
                        - generic [ref=e311]: 02 DÉC 2026 à 20:00
                      - listitem [ref=e312]:
                        - generic [ref=e316]: Dakar · Salle de test, Dakar
                    - generic [ref=e318]:
                      - paragraph [ref=e319]: À partir de
                      - paragraph [ref=e320]: 4 000 F CFA
              - listitem [ref=e324]:
                - article [ref=e325]:
                  - generic [ref=e327]:
                    - generic [ref=e328]:
                      - generic [aria-hidden] [ref=e329]:
                        - generic [ref=e330]: "03"
                        - generic [ref=e331]: DÉC
                      - generic [ref=e332]:
                        - paragraph [ref=e333]: Saloum Culture
                        - heading [level=3] [ref=e334]:
                          - link "Gala des entrepreneurs du Saloum" [ref=e335] [cursor=pointer]:
                            - /url: /events/a839903b-b9cd-42dc-a4ca-703de00cc803
                    - generic [ref=e336]: Salles & Réceptions
                    - list [ref=e339]:
                      - listitem [ref=e340]:
                        - generic [ref=e343]: 03 DÉC 2026 à 19:30
                      - listitem [ref=e344]:
                        - generic [ref=e348]: Kaolack · Salle des Palétuviers
                    - generic [ref=e350]:
                      - paragraph [ref=e351]: À partir de
                      - paragraph [ref=e352]: 10 000 F CFA
          - region [ref=e356]:
            - generic [ref=e357]:
              - heading "Populaires" [level=2] [ref=e358]
              - paragraph [ref=e359]: Les événements les plus demandés des 7 derniers jours.
            - list [ref=e360]:
              - listitem [ref=e361]:
                - article [ref=e362]:
                  - generic [ref=e364]:
                    - generic [ref=e365]:
                      - generic [aria-hidden] [ref=e366]:
                        - generic [ref=e367]: "12"
                        - generic [ref=e368]: NOV
                      - generic [ref=e369]:
                        - paragraph [ref=e370]: Baobab Scène
                        - heading [level=3] [ref=e371]:
                          - link "Nuit du Sabar — édition d’automne" [ref=e372] [cursor=pointer]:
                            - /url: /events/2434a00a-ba99-4ec2-aa98-892ac2b8c627
                    - generic [ref=e373]: Concerts & Musique
                    - list [ref=e376]:
                      - listitem [ref=e377]:
                        - generic [ref=e380]: 12 NOV 2026 à 12:45
                      - listitem [ref=e381]:
                        - generic [ref=e385]: Dakar · Esplanade de la Corniche Ouest
                    - generic [ref=e387]:
                      - paragraph [ref=e388]: À partir de
                      - paragraph [ref=e389]: 5 000 F CFA
              - listitem [ref=e393]:
                - article [ref=e394]:
                  - generic [ref=e396]:
                    - generic [ref=e397]:
                      - generic [aria-hidden] [ref=e398]:
                        - generic [ref=e399]: "17"
                        - generic [ref=e400]: NOV
                      - generic [ref=e401]:
                        - paragraph [ref=e402]: Petite-Côte Événements
                        - heading [level=3] [ref=e403]:
                          - link "Marché gourmand de la Petite-Côte" [ref=e404] [cursor=pointer]:
                            - /url: /events/d2dbe96b-43c6-4721-bf33-5370d0fc7a71
                    - generic [ref=e405]: Gastronomie & Tables
                    - list [ref=e408]:
                      - listitem [ref=e409]:
                        - generic [ref=e412]: 17 NOV 2026 à 10:00
                      - listitem [ref=e413]:
                        - generic [ref=e417]: Mbour · Place du Marché Central
                    - generic [ref=e419]:
                      - paragraph [ref=e420]: À partir de
                      - paragraph [ref=e421]: 1 000 F CFA
              - listitem [ref=e425]:
                - article [ref=e426]:
                  - generic [ref=e428]:
                    - generic [ref=e429]:
                      - generic [aria-hidden] [ref=e430]:
                        - generic [ref=e431]: "24"
                        - generic [ref=e432]: NOV
                      - generic [ref=e433]:
                        - paragraph [ref=e434]: Baobab Scène
                        - heading [level=3] [ref=e435]:
                          - link "Festival Jazz sur le Fleuve" [ref=e436] [cursor=pointer]:
                            - /url: /events/e36ff04d-4e1c-4ba2-8507-ab702194836f
                    - generic [ref=e437]: Festivals
                    - list [ref=e440]:
                      - listitem [ref=e441]:
                        - generic [ref=e444]: 24 NOV 2026 à 18:00
                      - listitem [ref=e445]:
                        - generic [ref=e449]: Saint-Louis · Quai des Pêcheurs
                    - generic [ref=e451]:
                      - paragraph [ref=e452]: À partir de
                      - paragraph [ref=e453]: 7 500 F CFA
              - listitem [ref=e457]:
                - article [ref=e458]:
                  - generic [ref=e460]:
                    - generic [ref=e461]:
                      - generic [aria-hidden] [ref=e462]:
                        - generic [ref=e463]: "03"
                        - generic [ref=e464]: DÉC
                      - generic [ref=e465]:
                        - paragraph [ref=e466]: Saloum Culture
                        - heading [level=3] [ref=e467]:
                          - link "Gala des entrepreneurs du Saloum" [ref=e468] [cursor=pointer]:
                            - /url: /events/a839903b-b9cd-42dc-a4ca-703de00cc803
                    - generic [ref=e469]: Salles & Réceptions
                    - list [ref=e472]:
                      - listitem [ref=e473]:
                        - generic [ref=e476]: 03 DÉC 2026 à 19:30
                      - listitem [ref=e477]:
                        - generic [ref=e481]: Kaolack · Salle des Palétuviers
                    - generic [ref=e483]:
                      - paragraph [ref=e484]: À partir de
                      - paragraph [ref=e485]: 10 000 F CFA
              - listitem [ref=e489]:
                - article [ref=e490]:
                  - generic [ref=e492]:
                    - generic [ref=e493]:
                      - generic [aria-hidden] [ref=e494]:
                        - generic [ref=e495]: "13"
                        - generic [ref=e496]: NOV
                      - generic [ref=e497]:
                        - paragraph [ref=e498]: Baobab Scène
                        - heading [level=3] [ref=e499]:
                          - link "Concert des Lumières de Gorée" [ref=e500] [cursor=pointer]:
                            - /url: /events/bee25d2e-9f0d-4058-b4f4-0b09ff39a4f0
                    - generic [ref=e501]: Concerts & Musique
                    - list [ref=e504]:
                      - listitem [ref=e505]:
                        - generic [ref=e508]: 13 NOV 2026 à 08:00
                      - listitem [ref=e509]:
                        - generic [ref=e513]: Gorée · Place du Gouvernement
                    - generic [ref=e515]:
                      - paragraph [ref=e516]: À partir de
                      - paragraph [ref=e517]: 6 000 F CFA
              - listitem [ref=e521]:
                - article [ref=e522]:
                  - generic [ref=e524]:
                    - generic [ref=e525]:
                      - generic [aria-hidden] [ref=e526]:
                        - generic [ref=e527]: "12"
                        - generic [ref=e528]: DÉC
                      - generic [ref=e529]:
                        - paragraph [ref=e530]: Petite-Côte Événements
                        - heading [level=3] [ref=e531]:
                          - link "Carnaval des enfants de Saly" [ref=e532] [cursor=pointer]:
                            - /url: /events/c4c1e3e1-e971-47e9-a409-8b8f976f43d2
                    - generic [ref=e533]: Festivals
                    - list [ref=e536]:
                      - listitem [ref=e537]:
                        - generic [ref=e540]: 12 DÉC 2026 à 15:00
                      - listitem [ref=e541]:
                        - generic [ref=e545]: Saly · Promenade des Filaos
                    - generic [ref=e547]:
                      - paragraph [ref=e548]: À partir de
                      - paragraph [ref=e549]: 2 000 F CFA
              - listitem [ref=e553]:
                - article [ref=e554]:
                  - generic [ref=e556]:
                    - generic [ref=e557]:
                      - generic [aria-hidden] [ref=e558]:
                        - generic [ref=e559]: "20"
                        - generic [ref=e560]: NOV
                      - generic [ref=e561]:
                        - paragraph [ref=e562]: Saloum Culture
                        - heading [level=3] [ref=e563]:
                          - link "Dîner-spectacle au bord du Saloum" [ref=e564] [cursor=pointer]:
                            - /url: /events/994773f5-e810-4266-859c-5dcc5b4b0c35
                    - generic [ref=e565]: Salles & Réceptions
                    - list [ref=e568]:
                      - listitem [ref=e569]:
                        - generic [ref=e572]: 20 NOV 2026 à 20:00
                      - listitem [ref=e573]:
                        - generic [ref=e577]: Foundiougne · Terrasse des Pirogues
                    - generic [ref=e579]:
                      - paragraph [ref=e580]: À partir de
                      - paragraph [ref=e581]: 25 000 F CFA
              - listitem [ref=e585]:
                - article [ref=e586]:
                  - generic [ref=e588]:
                    - generic [ref=e589]:
                      - generic [aria-hidden] [ref=e590]:
                        - generic [ref=e591]: "29"
                        - generic [ref=e592]: NOV
                      - generic [ref=e593]:
                        - paragraph [ref=e594]: Baobab Scène
                        - heading [level=3] [ref=e595]:
                          - link "Soirée Kora & Lumières" [ref=e596] [cursor=pointer]:
                            - /url: /events/d5b0190e-3cd4-44a8-a864-56862d368422
                    - generic [ref=e597]: Concerts & Musique
                    - list [ref=e600]:
                      - listitem [ref=e601]:
                        - generic [ref=e604]: 29 NOV 2026 à 20:30
                      - listitem [ref=e605]:
                        - generic [ref=e609]: Dakar · Jardin de la Maison des Arts
                    - generic [ref=e611]:
                      - paragraph [ref=e612]: À partir de
                      - paragraph [ref=e613]: 6 000 F CFA
              - listitem [ref=e617]:
                - article [ref=e618]:
                  - generic [ref=e620]:
                    - generic [ref=e621]:
                      - generic [aria-hidden] [ref=e622]:
                        - generic [ref=e623]: "02"
                        - generic [ref=e624]: DÉC
                      - generic [ref=e625]:
                        - paragraph [ref=e626]: Orga B (test)
                        - heading [level=3] [ref=e627]:
                          - link "TEST Spectacle B (publié, à venir)" [ref=e628] [cursor=pointer]:
                            - /url: /events/a0bc41f6-6d63-47e1-95be-7908fd7fea7e
                    - generic [ref=e629]: Concerts & Musique
                    - list [ref=e632]:
                      - listitem [ref=e633]:
                        - generic [ref=e636]: 02 DÉC 2026 à 20:00
                      - listitem [ref=e637]:
                        - generic [ref=e641]: Dakar · Salle de test, Dakar
                    - generic [ref=e643]:
                      - paragraph [ref=e644]: À partir de
                      - paragraph [ref=e645]: 4 000 F CFA
              - listitem [ref=e649]:
                - article [ref=e650]:
                  - generic [ref=e652]:
                    - generic [ref=e653]:
                      - generic [aria-hidden] [ref=e654]:
                        - generic [ref=e655]: "08"
                        - generic [ref=e656]: DÉC
                      - generic [ref=e657]:
                        - paragraph [ref=e658]: Petite-Côte Événements
                        - heading [level=3] [ref=e659]:
                          - link "Festival des rythmes de Casamance" [ref=e660] [cursor=pointer]:
                            - /url: /events/ef87a867-c2be-4fe2-899b-38dde295b8cc
                    - generic [ref=e661]: Festivals
                    - list [ref=e664]:
                      - listitem [ref=e665]:
                        - generic [ref=e668]: 08 DÉC 2026 à 17:00
                      - listitem [ref=e669]:
                        - generic [ref=e673]: Ziguinchor · Esplanade du Port
                    - generic [ref=e675]:
                      - paragraph [ref=e676]: À partir de
                      - paragraph [ref=e677]: 5 000 F CFA
          - region [ref=e681]:
            - generic [ref=e682]:
              - generic [ref=e683]:
                - heading "Près de chez vous" [level=2] [ref=e684]
                - paragraph [ref=e685]: Les prochains événements dans votre ville.
              - generic [ref=e686]:
                - generic [ref=e687]: Votre ville
                - combobox "Votre ville" [ref=e690] [cursor=pointer]:
                  - option "Choisir une ville" [disabled] [selected]
                  - option "Dakar"
                  - option "Foundiougne"
                  - option "Gorée"
                  - option "Kaolack"
                  - option "Mbour"
                  - option "Saint-Louis"
                  - option "Saly"
                  - option "Ziguinchor"
            - generic [ref=e691]:
              - heading "Choisissez votre ville" [level=3] [ref=e696]
              - paragraph [ref=e697]: Les événements proches de chez vous apparaîtront ici. Votre choix est gardé pour vos prochaines visites.
          - region [ref=e698]:
            - generic [ref=e699]:
              - paragraph [ref=e700]: Espace organisateur
              - heading "Vous organisez des événements ? Vendez vos billets avec Event Village." [level=2] [ref=e701]
              - list [ref=e702]:
                - listitem [ref=e703]:
                  - generic [ref=e707]: Création et publication de vos événements, validées par notre équipe
                - listitem [ref=e708]:
                  - generic [ref=e712]: Ventes et entrées suivies en direct, contrôleurs et caisses sur place
                - listitem [ref=e713]:
                  - generic [ref=e717]: Fonds versés sur votre compte après l’événement
              - link "Devenir partenaire" [ref=e719] [cursor=pointer]:
                - /url: /partner/register
          - generic [ref=e724]:
            - generic [ref=e725]:
              - generic [ref=e726]:
                - paragraph [ref=e727]: Event Village
                - paragraph [ref=e728]: Billetterie et événements au Sénégal.
              - navigation "Liens du pied de page" [ref=e729]:
                - list [ref=e730]:
                  - listitem [ref=e731]:
                    - link "Explorer" [ref=e732] [cursor=pointer]:
                      - /url: /explore
                  - listitem [ref=e734]:
                    - link "Mes billets" [ref=e735] [cursor=pointer]:
                      - /url: /tickets
                  - listitem [ref=e737]:
                    - link "Devenir partenaire" [ref=e738] [cursor=pointer]:
                      - /url: /partner/register
            - paragraph [ref=e740]: Event Village, 2026. Tous droits réservés.
    - navigation "Navigation rapide" [ref=e741]:
      - generic [ref=e742]:
        - link "Accueil" [ref=e743] [cursor=pointer]:
          - /url: /
        - link "Explorer" [ref=e748] [cursor=pointer]:
          - /url: /explore
        - link "Billets" [ref=e753] [cursor=pointer]:
          - /url: /tickets
        - link "Portefeuille" [ref=e757] [cursor=pointer]:
          - /url: /wallet
  - alert [ref=e762]
```

# Test source

```ts
  393 |     cashoutFeesReal: 4290,
  394 |     cashoutFeesEstimated: 4200,
  395 |     gap: 90,
  396 |     cashoutFeeRate: 1.5,
  397 |     cashoutCount: 12,
  398 |     cashinFeesReal: null,
  399 |     cashinNote: 'Frais réels non fournis par SamirPay pour ce mode d’encaissement : comparez avec votre tableau de bord SamirPay.',
  400 | };
  401 | /** Lot 9 bis : réponses imposées des deux écrans « Versements à reprendre » (fumee-superadmin, B114). */
  402 | const CASHOUTS_STUBS: StubResponse[] = [
  403 |     { url: RECONCILIATION_URL, method: 'GET', status: 200, body: EMPTY_RECONCILIATION },
  404 |     { url: REFUNDS_URL, method: 'GET', status: 200, body: CASHOUTS_TO_RESUME },
  405 | ];
  406 | 
  407 | /**
  408 |  * Lot 9 bis : « Versements à reprendre » de /admin/finance (RefundsToRetry, contrat 5.1) chargé : titre exact, ligne
  409 |  * « Retrait » (retraits compris, R10), conseil exact d'un versement incertain sans identifiant (B2), puis un bouton
  410 |  * « Renvoyer » par ligne où can_resend n'est pas faux et un « Marquer versé » par ligne où can_mark_paid est vrai
  411 |  * (R51 : boutons conditionnés), et plus aucun « Relancer » (route retry supprimée, B4). Lot 9 ter (A.2.6) : un
  412 |  * « Constater non versé » par ligne où can_mark_not_sent est vrai (jamais grisé, absent ailleurs).
  413 |  */
  414 | async function cashoutsReady(page: Page): Promise<{ resend: Locator; markPaid: Locator; markNotSent: Locator }> {
  415 |     await expect(page.getByRole('heading', { name: /^versements à reprendre$/i })).toBeVisible();
  416 |     await expect(page.getByText(/^retrait$/i).filter({ visible: true }).first(), 'ligne « Retrait » (retraits compris, R10)').toBeVisible();
  417 |     await expect(page.getByText(ADVICE_UNCERTAIN_NO_ID).filter({ visible: true }).first(), 'conseil d’un versement incertain sans identifiant (B2)').toBeVisible();
  418 |     const resend = page.getByRole('button', { name: /^renvoyer/i }).filter({ visible: true });
  419 |     const markPaid = page.getByRole('button', { name: /^marquer versé/i }).filter({ visible: true });
  420 |     await expect(resend, 'un bouton « Renvoyer » par ligne où can_resend n’est pas faux').toHaveCount(CASHOUTS_RESENDABLE);
  421 |     await expect(markPaid, 'un bouton « Marquer versé » par ligne où can_mark_paid est vrai').toHaveCount(CASHOUTS_MARKABLE);
  422 |     await expect(page.getByRole('button', { name: /^relancer/i }), 'plus aucun « Relancer » (B4)').toHaveCount(0);
  423 |     const markNotSent = page.getByRole('button', { name: /^constater non versé/i }).filter({ visible: true });
  424 |     await expect(markNotSent, 'un bouton « Constater non versé » par ligne où can_mark_not_sent est vrai (lot 9 ter, A.2.4)').toHaveCount(CASHOUTS_NOT_SENT);
  425 |     return { resend, markPaid, markNotSent };
  426 | }
  427 | 
  428 | // ── Lot 9 : invitations, découverte, compte ─────────────────────────────────
  429 | 
  430 | /** Onglet « Invitations » du pilotage ouvert par ?tab=invitations (libellés figés, contrat 5.1). */
  431 | async function invitationsReady(page: Page): Promise<void> {
  432 |     await expect(page.getByRole('tab', { name: /^invitations/i })).toHaveAttribute('aria-selected', 'true');
  433 |     await expect(page.getByRole('button', { name: /^envoyer les invitations$/i })).toBeVisible();
  434 | }
  435 | 
  436 | /** Section « Près de chez vous » de l'accueil (contrat 5.2). */
  437 | function nearbySection(page: Page): Locator {
  438 |     return page.locator('section').filter({ has: page.getByRole('heading', { name: /^près de chez vous/i }) });
  439 | }
  440 | 
  441 | // ── Lot 9 bis : versements, droits, transferts, email (contrat 7.3) ─────────
  442 | 
  443 | const TRANSFER_URL = /\/api\/tickets\/[^/]+\/transfer$/;
  444 | /** Contrat 4.2 : refus d'une action sensible sans mot de passe saisi depuis moins de 10 minutes (R57). */
  445 | const PASSWORD_CONFIRMATION_REQUIRED = {
  446 |     error: 'Par sécurité, saisissez votre mot de passe pour continuer.', code: 'PASSWORD_CONFIRMATION_REQUIRED',
  447 | };
  448 | /** Aide exacte de PasswordChangeDialog (contrat 5.42). */
  449 | const PASSWORD_RULES_HELP = '8 caractères au moins, dont une majuscule, un chiffre et un caractère spécial.';
  450 | /** Jeton factice de /verify-email : la page ne valide rien au chargement (contrat 4.6), il n'est jamais envoyé. */
  451 | const VERIFY_EMAIL_TOKEN = 'e2e-jeton-factice-jamais-envoye-0123456789abcdef';
  452 | const VERIFY_EMAIL_API = '/api/account/email/verify';
  453 | 
  454 | /** Boîte de dialogue ouverte, modale simple ou de confirmation (ConfirmDialog). */
  455 | function anyDialog(page: Page, name?: RegExp): Locator {
  456 |     return name
  457 |         ? page.getByRole('dialog', { name }).or(page.getByRole('alertdialog', { name }))
  458 |         : page.getByRole('dialog').or(page.getByRole('alertdialog'));
  459 | }
  460 | 
  461 | /** Fiche partenaire d'un compte organisateur du seed de démonstration (erreur explicite si le seed ne l'a pas écrite). */
  462 | function partnerIdOf(i: DemoIds | null, key: DemoAccountKey): string {
  463 |     const id = ids(i).accounts[key].partnerId;
  464 |     if (!id) throw new Error(`[e2e] demo-ids.json : accounts.${key}.partnerId absent (fiche partenaire du seed de démonstration)`);
  465 |     return id;
  466 | }
  467 | 
  468 | /** Écran existant prolongé d'un contrôle après ses propres actions. */
  469 | function withExtraActions(screen: Screen, extra: (c: ScreenContext) => Promise<void>): Screen {
  470 |     return {
  471 |         ...screen,
  472 |         actions: async (c) => {
  473 |             if (screen.actions) await screen.actions(c);
  474 |             await extra(c);
  475 |         },
  476 |     };
  477 | }
  478 | 
  479 | /** Requêtes déjà parties vers un chemin d'API, lues dans le minutage des ressources de la page. */
  480 | async function requestsTo(page: Page, pathname: string): Promise<number> {
  481 |     return page.evaluate((p) => performance.getEntriesByType('resource').filter((e) => new URL(e.name).pathname === p).length, pathname);
  482 | }
  483 | 
  484 | // ── Lot 9 ter : zones, portes, liste des invités, stock, versements (contrat 7.1 à 7.4) ──
  485 | 
  486 | /** Clés de la graine v4 (D.3.2, fix(9t.seed), vague F), absentes de DemoIds jusque-là. */
  487 | type Lot9terEventKey = 'zones' | 'dernieresPlaces';
  488 | 
  489 | /** Événement de la graine v4 lu par sa clé ; erreur explicite tant que le seed ne l'a pas écrit (capture rouge). */
  490 | function seedEvent(i: DemoIds | null, key: Lot9terEventKey): DemoEvent {
  491 |     const events = ids(i).events as Partial<Record<string, DemoEvent>>;
  492 |     const event = events[key];
> 493 |     if (!event?.id) throw new Error(`[e2e] demo-ids.json : events.${key} absent (graine v4 du lot 9 ter, fix(9t.seed))`);
      |                           ^ Error: [e2e] demo-ids.json : events.dernieresPlaces absent (graine v4 du lot 9 ter, fix(9t.seed))
  494 |     return event;
  495 | }
  496 | 
  497 | /** Plein écran du résultat (CombatFlashOverlay). */
  498 | function scanOverlay(page: Page): Locator {
  499 |     return page.locator('[data-scan-state="result"]');
  500 | }
  501 | 
  502 | /** Jeton scan-used du lot 9 ter (#991B1B, C.2.4), tel que getComputedStyle le rend. */
  503 | const SCAN_USED_RED = 'rgb(153, 27, 27)';
  504 | 
  505 | /** Zones et portes des réponses imposées du scanner : identifiants inconnus de la base (C.6). */
  506 | const ZONE_ENTREE_VIP = { id: '00000000-0000-4000-8000-000000000911', name: 'Entrée VIP', kind: 'ENTREE', implicit: false };
  507 | const ZONE_ENTREE_GENERALE = { id: '00000000-0000-4000-8000-000000000912', name: 'Entrée générale', kind: 'ENTREE', implicit: false };
  508 | const ZONE_CARRE_VIP = { id: '00000000-0000-4000-8000-000000000913', name: 'Carré VIP', kind: 'CONTROLE', implicit: false };
  509 | const GATE_VIP = { id: '00000000-0000-4000-8000-000000000921', name: 'Porte VIP' };
  510 | const GATE_NORD = { id: '00000000-0000-4000-8000-000000000922', name: 'Porte Nord' };
  511 | const GATE_ACCES_CARRE = { id: '00000000-0000-4000-8000-000000000923', name: 'Accès carré' };
  512 | const SCAN_TICKET_VIP = { ...SCAN_TICKET, category: 'VIP' };
  513 | /** Consigne d'entrée de la capture scanner-accepte-consigne (C.6, mot pour mot). */
  514 | const ENTRY_INSTRUCTION_VIP = 'Remettre bracelet doré — orienter vers le carré VVIP';
  515 | 
  516 | /** Texte exact de GATE_REQUIRED au scan (contrat 11.3). */
  517 | const GATE_REQUIRED_MESSAGE = 'Aucune porte ne vous est attribuée : demandez à l’organisateur de vous en attribuer une. Rien n’a été validé.';
  518 | 
  519 | /** Plein écran attendu : résultat, famille de couleur (data-scan-category) et textes exacts de C.2.4. */
  520 | async function expectScanLines(page: Page, category: string, lines: readonly string[]): Promise<void> {
  521 |     const overlay = scanOverlay(page);
  522 |     await expect(overlay, `famille du résultat (C.2.4) : ${category}`).toHaveAttribute('data-scan-category', category);
  523 |     for (const line of lines) {
  524 |         await expect(overlay.getByText(line, { exact: true }).first(), `texte exact du plein écran (C.2.4) : « ${line} »`).toBeVisible();
  525 |     }
  526 | }
  527 | 
  528 | const GUESTS_URL = /\/api\/controller\/scan\/guests$/;
  529 | /** Réponse imposée de POST /api/controller/scan/guests (C.6) : deux billets d'un même invité, identifiants inconnus de la base. */
  530 | const GUEST_SEARCH_STUB = {
  531 |     items: [{
  532 |         guest_name: 'Awa Diop', category: 'VIP', ticket_count: 2,
  533 |         ticket_ids: ['00000000-0000-4000-8000-000000000941', '00000000-0000-4000-8000-000000000942'],
  534 |     }],
  535 |     truncated: false,
  536 | };
  537 | 
  538 | /**
  539 |  * Liste des invités du scanner (C.3.5) : ouverture hors du groupe « Mode de contrôle », saisie des 4 derniers chiffres,
  540 |  * recherche envoyée avec `query` (corps de la route, C.3.4), carte de l'invité de la réponse imposée.
  541 |  */
  542 | async function searchGuestList(page: Page): Promise<void> {
  543 |     await page.getByRole('button', { name: /^liste des invités$/i }).click();
  544 |     await expect(page.getByRole('heading', { name: /^liste des invités$/i })).toBeVisible();
  545 |     await page.getByLabel(/^numéro de l.invité/i).fill('4567');
  546 |     const sent = page.waitForRequest((r) => GUESTS_URL.test(new URL(r.url()).pathname) && r.method() === 'POST');
  547 |     await page.getByRole('button', { name: /^rechercher$/i }).click();
  548 |     const body = (await sent).postDataJSON() as { query?: unknown } | null;
  549 |     expect(body?.query, 'recherche envoyée avec les 4 chiffres saisis (C.3.4)').toBe('4567');
  550 |     await expect(page.getByText('Awa Diop', { exact: true }).first()).toBeVisible();
  551 |     await expect(page.getByText('2 billets', { exact: true }).first()).toBeVisible();
  552 |     await expect(page.getByRole('button', { name: /^choisir/i }), 'un bouton « Choisir » par invité trouvé').toHaveCount(1);
  553 | }
  554 | 
  555 | /** Lot 9 ter (B.6) : retrait en cours depuis 2 h, marqué retardé par le serveur. */
  556 | const TWO_HOURS_AGO = new Date(Date.now() - 2 * 3_600_000).toISOString();
  557 | 
  558 | /** Réponse imposée de GET /api/finance/balance (B.6) : un retrait PROCESSING retardé, identifiant inconnu de la base. */
  559 | function delayedWithdrawalBalance(account: 'ORGANISATEUR' | 'PARRAINAGE'): Record<string, unknown> {
  560 |     return {
  561 |         account_kind: account, available: 4000, pending: 0, next_available_at: null, in_progress: 6000, debt: 0, frozen: 0,
  562 |         withdrawable: 4000, withdrawal_min_amount: 5000, withdrawal_fee_rate: 1, history: [],
  563 |         withdrawals: [{
  564 |             id: '00000000-0000-4000-8000-000000000901', gross_amount: 6000, fee_amount: 60, net_amount: 5940, status: 'PROCESSING',
  565 |             operator: 'WAVE', phone_number: '771234567', withdrawal_method: 'MOBILE_MONEY', created_at: TWO_HOURS_AGO, processed_at: null,
  566 |             rejection_reason: null, effective_status: 'PROCESSING', delayed: true,
  567 |         }],
  568 |     };
  569 | }
  570 | 
  571 | /** Badge « Retardé » et phrase des deux écrans de retraits (0.9). */
  572 | async function delayedWithdrawalReady(page: Page): Promise<void> {
  573 |     await expect(page.getByText('Retardé', { exact: true }).filter({ visible: true }).first(), 'badge « Retardé » (delayed servi par le serveur)').toBeVisible();
  574 |     const phrase = page.getByText('Retardé : l’équipe Event Village s’en occupe.', { exact: true }).filter({ visible: true }).first();
  575 |     await expect(phrase).toBeVisible();
  576 |     await revealCenter(phrase);
  577 | }
  578 | 
  579 | /**
  580 |  * Fiche admin imposée (B.6) au format d'AdminEventsService.getEventSheet : événement SUSPENDU dont la fin est passée,
  581 |  * seule action « Clore l’événement » avec motif. Identifiants inconnus de la base : une clôture envoyée par erreur ne
  582 |  * toucherait aucun événement réel.
  583 |  */
  584 | const CLOSING_SHEET = {
  585 |     event: {
  586 |         id: '00000000-0000-4000-8000-000000000931', title: 'Festival des Lumières de Saint-Louis', status: 'SUSPENDU',
  587 |         description: 'Trois scènes sur les quais, musiques mandingues et mbalax jusqu’à l’aube.', category: 'FESTIVAL', image_url: null,
  588 |         start_date: '2026-11-01', start_time: '20:00', end_date: '2026-11-02', end_time: '02:00', location: 'Quai Henri Jay', city: 'Saint-Louis',
  589 |         capacity: 800, program: [], practical_info: null, created_at: '2026-10-10T09:00:00.000Z', updated_at: '2026-11-01T18:00:00.000Z',
  590 |     },
  591 |     categories: [{
  592 |         id: '00000000-0000-4000-8000-000000000932', name: 'Standard', description: null, price: 5000, total_quantity: 600,
  593 |         sale_start: null, sale_end: null, max_per_order: 10, sale_online: true, sale_counter: true, is_active: true,
```