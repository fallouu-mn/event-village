# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · anonyme >> accueil-dernieres-places — Accueil — badge « Dernières places » d’un événement presque complet
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
          - button "Basculer le thème" [pressed] [ref=e23] [cursor=pointer]
          - link "Se connecter" [ref=e31] [cursor=pointer]:
            - /url: /login
      - main [ref=e35]:
        - generic [ref=e37]:
          - generic [ref=e39]:
            - generic [ref=e40]:
              - paragraph [ref=e41]: Billetterie officielle au Sénégal
              - heading "Découvrez, réservez et vivez les événements qui comptent." [level=1] [ref=e45]
              - paragraph [ref=e46]: "Concerts, festivals, soirées et rencontres : choisissez votre place, payez en quelques secondes et présentez votre billet à l’entrée."
              - search [ref=e47]:
                - generic [ref=e49]:
                  - generic [ref=e50]: Rechercher un événement
                  - searchbox "Rechercher un événement" [ref=e52]
                - button "Explorer" [ref=e53] [cursor=pointer]
            - list [ref=e59]:
              - listitem [ref=e60]:
                - generic [ref=e64]:
                  - paragraph [ref=e65]: Wave et Orange Money
                  - paragraph [ref=e66]: Payez depuis votre téléphone, le billet arrive aussitôt.
              - listitem [ref=e67]:
                - generic [ref=e75]:
                  - paragraph [ref=e76]: QR code dynamique
                  - paragraph [ref=e77]: "Un code renouvelé en continu : une capture d’écran ne passe pas l’entrée."
              - listitem [ref=e78]:
                - generic [ref=e83]:
                  - paragraph [ref=e84]: Remboursement automatique
                  - paragraph [ref=e85]: "Événement annulé : les billets payés en ligne sont remboursés."
          - region [ref=e86]:
            - generic [ref=e87]:
              - generic [ref=e88]:
                - heading "À l’affiche" [level=2] [ref=e89]
                - status [ref=e90]: En direct
              - link "Tous les événements" [ref=e92] [cursor=pointer]:
                - /url: /explore
            - group "Catégorie" [ref=e97]:
              - button "Tous" [pressed] [ref=e98] [cursor=pointer]
              - button "Concerts & Musique" [ref=e99] [cursor=pointer]
              - button "Festivals" [ref=e100] [cursor=pointer]
              - button "Gastronomie & Tables" [ref=e101] [cursor=pointer]
              - button "Salles & Réceptions" [ref=e102] [cursor=pointer]
            - list [ref=e103]:
              - listitem [ref=e104]:
                - article [ref=e105]:
                  - generic [ref=e107]:
                    - generic [ref=e108]:
                      - generic [aria-hidden] [ref=e109]:
                        - generic [ref=e110]: "12"
                        - generic [ref=e111]: NOV
                      - generic [ref=e112]:
                        - paragraph [ref=e113]: Baobab Scène
                        - heading [level=3] [ref=e114]:
                          - link "Nuit du Sabar — édition d’automne" [ref=e115] [cursor=pointer]:
                            - /url: /events/85690298-786f-4083-b859-7ca5fd3b3c1f
                    - generic [ref=e116]: Concerts & Musique
                    - list [ref=e119]:
                      - listitem [ref=e120]:
                        - generic [ref=e123]: 12 NOV 2026 à 16:15
                      - listitem [ref=e124]:
                        - generic [ref=e128]: Dakar · Esplanade de la Corniche Ouest
                    - generic [ref=e130]:
                      - paragraph [ref=e131]: À partir de
                      - paragraph [ref=e132]: 5 000 F CFA
              - listitem [ref=e136]:
                - article [ref=e137]:
                  - generic [ref=e139]:
                    - generic [ref=e140]:
                      - generic [aria-hidden] [ref=e141]:
                        - generic [ref=e142]: "13"
                        - generic [ref=e143]: NOV
                      - generic [ref=e144]:
                        - paragraph [ref=e145]: Baobab Scène
                        - heading [level=3] [ref=e146]:
                          - link "Concert des Lumières de Gorée" [ref=e147] [cursor=pointer]:
                            - /url: /events/24d366d1-c199-44c8-acd6-6a072744f8f3
                    - generic [ref=e148]: Concerts & Musique
                    - list [ref=e151]:
                      - listitem [ref=e152]:
                        - generic [ref=e155]: 13 NOV 2026 à 11:30
                      - listitem [ref=e156]:
                        - generic [ref=e160]: Gorée · Place du Gouvernement
                    - generic [ref=e162]:
                      - paragraph [ref=e163]: À partir de
                      - paragraph [ref=e164]: 6 000 F CFA
              - listitem [ref=e168]:
                - article [ref=e169]:
                  - generic [ref=e171]:
                    - generic [ref=e172]:
                      - generic [aria-hidden] [ref=e173]:
                        - generic [ref=e174]: "17"
                        - generic [ref=e175]: NOV
                      - generic [ref=e176]:
                        - paragraph [ref=e177]: Petite-Côte Événements
                        - heading [level=3] [ref=e178]:
                          - link "Marché gourmand de la Petite-Côte" [ref=e179] [cursor=pointer]:
                            - /url: /events/99c8d165-4f0c-4768-a916-4d4034871461
                    - generic [ref=e180]: Gastronomie & Tables
                    - list [ref=e183]:
                      - listitem [ref=e184]:
                        - generic [ref=e187]: 17 NOV 2026 à 10:00
                      - listitem [ref=e188]:
                        - generic [ref=e192]: Mbour · Place du Marché Central
                    - generic [ref=e194]:
                      - paragraph [ref=e195]: À partir de
                      - paragraph [ref=e196]: 1 000 F CFA
              - listitem [ref=e200]:
                - article [ref=e201]:
                  - generic [ref=e203]:
                    - generic [ref=e204]:
                      - generic [aria-hidden] [ref=e205]:
                        - generic [ref=e206]: "20"
                        - generic [ref=e207]: NOV
                      - generic [ref=e208]:
                        - paragraph [ref=e209]: Saloum Culture
                        - heading [level=3] [ref=e210]:
                          - link "Dîner-spectacle au bord du Saloum" [ref=e211] [cursor=pointer]:
                            - /url: /events/c9c62430-fa69-4962-ad37-b8fc631c58f3
                    - generic [ref=e212]: Salles & Réceptions
                    - list [ref=e215]:
                      - listitem [ref=e216]:
                        - generic [ref=e219]: 20 NOV 2026 à 20:00
                      - listitem [ref=e220]:
                        - generic [ref=e224]: Foundiougne · Terrasse des Pirogues
                    - generic [ref=e226]:
                      - paragraph [ref=e227]: À partir de
                      - paragraph [ref=e228]: 25 000 F CFA
              - listitem [ref=e232]:
                - article [ref=e233]:
                  - generic [ref=e235]:
                    - generic [ref=e236]:
                      - generic [aria-hidden] [ref=e237]:
                        - generic [ref=e238]: "24"
                        - generic [ref=e239]: NOV
                      - generic [ref=e240]:
                        - paragraph [ref=e241]: Baobab Scène
                        - heading [level=3] [ref=e242]:
                          - link "Festival Jazz sur le Fleuve" [ref=e243] [cursor=pointer]:
                            - /url: /events/2dfe81c8-c9a9-42cd-b489-f9972fb1bb88
                    - generic [ref=e244]: Festivals
                    - list [ref=e247]:
                      - listitem [ref=e248]:
                        - generic [ref=e251]: 24 NOV 2026 à 18:00
                      - listitem [ref=e252]:
                        - generic [ref=e256]: Saint-Louis · Quai des Pêcheurs
                    - generic [ref=e258]:
                      - paragraph [ref=e259]: À partir de
                      - paragraph [ref=e260]: 7 500 F CFA
              - listitem [ref=e264]:
                - article [ref=e265]:
                  - generic [ref=e267]:
                    - generic [ref=e268]:
                      - generic [aria-hidden] [ref=e269]:
                        - generic [ref=e270]: "29"
                        - generic [ref=e271]: NOV
                      - generic [ref=e272]:
                        - paragraph [ref=e273]: Baobab Scène
                        - heading [level=3] [ref=e274]:
                          - link "Soirée Kora & Lumières" [ref=e275] [cursor=pointer]:
                            - /url: /events/b4f9758d-e1ca-4041-84a6-4fdafd90654a
                    - generic [ref=e276]: Concerts & Musique
                    - list [ref=e279]:
                      - listitem [ref=e280]:
                        - generic [ref=e283]: 29 NOV 2026 à 20:30
                      - listitem [ref=e284]:
                        - generic [ref=e288]: Dakar · Jardin de la Maison des Arts
                    - generic [ref=e290]:
                      - paragraph [ref=e291]: À partir de
                      - paragraph [ref=e292]: 6 000 F CFA
              - listitem [ref=e296]:
                - article [ref=e297]:
                  - generic [ref=e299]:
                    - generic [ref=e300]:
                      - generic [aria-hidden] [ref=e301]:
                        - generic [ref=e302]: "02"
                        - generic [ref=e303]: DÉC
                      - generic [ref=e304]:
                        - paragraph [ref=e305]: Orga B (test)
                        - heading [level=3] [ref=e306]:
                          - link "TEST Spectacle B (publié, à venir)" [ref=e307] [cursor=pointer]:
                            - /url: /events/46f4867e-d7ab-40e5-a264-2294f68c3208
                    - generic [ref=e308]: Concerts & Musique
                    - list [ref=e311]:
                      - listitem [ref=e312]:
                        - generic [ref=e315]: 02 DÉC 2026 à 20:00
                      - listitem [ref=e316]:
                        - generic [ref=e320]: Dakar · Salle de test, Dakar
                    - generic [ref=e322]:
                      - paragraph [ref=e323]: À partir de
                      - paragraph [ref=e324]: 4 000 F CFA
              - listitem [ref=e328]:
                - article [ref=e329]:
                  - generic [ref=e331]:
                    - generic [ref=e332]:
                      - generic [aria-hidden] [ref=e333]:
                        - generic [ref=e334]: "03"
                        - generic [ref=e335]: DÉC
                      - generic [ref=e336]:
                        - paragraph [ref=e337]: Saloum Culture
                        - heading [level=3] [ref=e338]:
                          - link "Gala des entrepreneurs du Saloum" [ref=e339] [cursor=pointer]:
                            - /url: /events/588945d3-864e-4a86-860a-b4b297ecc6f0
                    - generic [ref=e340]: Salles & Réceptions
                    - list [ref=e343]:
                      - listitem [ref=e344]:
                        - generic [ref=e347]: 03 DÉC 2026 à 19:30
                      - listitem [ref=e348]:
                        - generic [ref=e352]: Kaolack · Salle des Palétuviers
                    - generic [ref=e354]:
                      - paragraph [ref=e355]: À partir de
                      - paragraph [ref=e356]: 10 000 F CFA
          - region [ref=e360]:
            - generic [ref=e361]:
              - heading "Populaires" [level=2] [ref=e362]
              - paragraph [ref=e363]: Les événements les plus demandés des 7 derniers jours.
            - list [ref=e364]:
              - listitem [ref=e365]:
                - article [ref=e366]:
                  - generic [ref=e368]:
                    - generic [ref=e369]:
                      - generic [aria-hidden] [ref=e370]:
                        - generic [ref=e371]: "12"
                        - generic [ref=e372]: NOV
                      - generic [ref=e373]:
                        - paragraph [ref=e374]: Baobab Scène
                        - heading [level=3] [ref=e375]:
                          - link "Nuit du Sabar — édition d’automne" [ref=e376] [cursor=pointer]:
                            - /url: /events/85690298-786f-4083-b859-7ca5fd3b3c1f
                    - generic [ref=e377]: Concerts & Musique
                    - list [ref=e380]:
                      - listitem [ref=e381]:
                        - generic [ref=e384]: 12 NOV 2026 à 16:15
                      - listitem [ref=e385]:
                        - generic [ref=e389]: Dakar · Esplanade de la Corniche Ouest
                    - generic [ref=e391]:
                      - paragraph [ref=e392]: À partir de
                      - paragraph [ref=e393]: 5 000 F CFA
              - listitem [ref=e397]:
                - article [ref=e398]:
                  - generic [ref=e400]:
                    - generic [ref=e401]:
                      - generic [aria-hidden] [ref=e402]:
                        - generic [ref=e403]: "17"
                        - generic [ref=e404]: NOV
                      - generic [ref=e405]:
                        - paragraph [ref=e406]: Petite-Côte Événements
                        - heading [level=3] [ref=e407]:
                          - link "Marché gourmand de la Petite-Côte" [ref=e408] [cursor=pointer]:
                            - /url: /events/99c8d165-4f0c-4768-a916-4d4034871461
                    - generic [ref=e409]: Gastronomie & Tables
                    - list [ref=e412]:
                      - listitem [ref=e413]:
                        - generic [ref=e416]: 17 NOV 2026 à 10:00
                      - listitem [ref=e417]:
                        - generic [ref=e421]: Mbour · Place du Marché Central
                    - generic [ref=e423]:
                      - paragraph [ref=e424]: À partir de
                      - paragraph [ref=e425]: 1 000 F CFA
              - listitem [ref=e429]:
                - article [ref=e430]:
                  - generic [ref=e432]:
                    - generic [ref=e433]:
                      - generic [aria-hidden] [ref=e434]:
                        - generic [ref=e435]: "24"
                        - generic [ref=e436]: NOV
                      - generic [ref=e437]:
                        - paragraph [ref=e438]: Baobab Scène
                        - heading [level=3] [ref=e439]:
                          - link "Festival Jazz sur le Fleuve" [ref=e440] [cursor=pointer]:
                            - /url: /events/2dfe81c8-c9a9-42cd-b489-f9972fb1bb88
                    - generic [ref=e441]: Festivals
                    - list [ref=e444]:
                      - listitem [ref=e445]:
                        - generic [ref=e448]: 24 NOV 2026 à 18:00
                      - listitem [ref=e449]:
                        - generic [ref=e453]: Saint-Louis · Quai des Pêcheurs
                    - generic [ref=e455]:
                      - paragraph [ref=e456]: À partir de
                      - paragraph [ref=e457]: 7 500 F CFA
              - listitem [ref=e461]:
                - article [ref=e462]:
                  - generic [ref=e464]:
                    - generic [ref=e465]:
                      - generic [aria-hidden] [ref=e466]:
                        - generic [ref=e467]: "03"
                        - generic [ref=e468]: DÉC
                      - generic [ref=e469]:
                        - paragraph [ref=e470]: Saloum Culture
                        - heading [level=3] [ref=e471]:
                          - link "Gala des entrepreneurs du Saloum" [ref=e472] [cursor=pointer]:
                            - /url: /events/588945d3-864e-4a86-860a-b4b297ecc6f0
                    - generic [ref=e473]: Salles & Réceptions
                    - list [ref=e476]:
                      - listitem [ref=e477]:
                        - generic [ref=e480]: 03 DÉC 2026 à 19:30
                      - listitem [ref=e481]:
                        - generic [ref=e485]: Kaolack · Salle des Palétuviers
                    - generic [ref=e487]:
                      - paragraph [ref=e488]: À partir de
                      - paragraph [ref=e489]: 10 000 F CFA
              - listitem [ref=e493]:
                - article [ref=e494]:
                  - generic [ref=e496]:
                    - generic [ref=e497]:
                      - generic [aria-hidden] [ref=e498]:
                        - generic [ref=e499]: "13"
                        - generic [ref=e500]: NOV
                      - generic [ref=e501]:
                        - paragraph [ref=e502]: Baobab Scène
                        - heading [level=3] [ref=e503]:
                          - link "Concert des Lumières de Gorée" [ref=e504] [cursor=pointer]:
                            - /url: /events/24d366d1-c199-44c8-acd6-6a072744f8f3
                    - generic [ref=e505]: Concerts & Musique
                    - list [ref=e508]:
                      - listitem [ref=e509]:
                        - generic [ref=e512]: 13 NOV 2026 à 11:30
                      - listitem [ref=e513]:
                        - generic [ref=e517]: Gorée · Place du Gouvernement
                    - generic [ref=e519]:
                      - paragraph [ref=e520]: À partir de
                      - paragraph [ref=e521]: 6 000 F CFA
              - listitem [ref=e525]:
                - article [ref=e526]:
                  - generic [ref=e528]:
                    - generic [ref=e529]:
                      - generic [aria-hidden] [ref=e530]:
                        - generic [ref=e531]: "12"
                        - generic [ref=e532]: DÉC
                      - generic [ref=e533]:
                        - paragraph [ref=e534]: Petite-Côte Événements
                        - heading [level=3] [ref=e535]:
                          - link "Carnaval des enfants de Saly" [ref=e536] [cursor=pointer]:
                            - /url: /events/e42adac2-88ed-4d26-81a2-f40223ccaee4
                    - generic [ref=e537]: Festivals
                    - list [ref=e540]:
                      - listitem [ref=e541]:
                        - generic [ref=e544]: 12 DÉC 2026 à 15:00
                      - listitem [ref=e545]:
                        - generic [ref=e549]: Saly · Promenade des Filaos
                    - generic [ref=e551]:
                      - paragraph [ref=e552]: À partir de
                      - paragraph [ref=e553]: 2 000 F CFA
              - listitem [ref=e557]:
                - article [ref=e558]:
                  - generic [ref=e560]:
                    - generic [ref=e561]:
                      - generic [aria-hidden] [ref=e562]:
                        - generic [ref=e563]: "20"
                        - generic [ref=e564]: NOV
                      - generic [ref=e565]:
                        - paragraph [ref=e566]: Saloum Culture
                        - heading [level=3] [ref=e567]:
                          - link "Dîner-spectacle au bord du Saloum" [ref=e568] [cursor=pointer]:
                            - /url: /events/c9c62430-fa69-4962-ad37-b8fc631c58f3
                    - generic [ref=e569]: Salles & Réceptions
                    - list [ref=e572]:
                      - listitem [ref=e573]:
                        - generic [ref=e576]: 20 NOV 2026 à 20:00
                      - listitem [ref=e577]:
                        - generic [ref=e581]: Foundiougne · Terrasse des Pirogues
                    - generic [ref=e583]:
                      - paragraph [ref=e584]: À partir de
                      - paragraph [ref=e585]: 25 000 F CFA
              - listitem [ref=e589]:
                - article [ref=e590]:
                  - generic [ref=e592]:
                    - generic [ref=e593]:
                      - generic [aria-hidden] [ref=e594]:
                        - generic [ref=e595]: "29"
                        - generic [ref=e596]: NOV
                      - generic [ref=e597]:
                        - paragraph [ref=e598]: Baobab Scène
                        - heading [level=3] [ref=e599]:
                          - link "Soirée Kora & Lumières" [ref=e600] [cursor=pointer]:
                            - /url: /events/b4f9758d-e1ca-4041-84a6-4fdafd90654a
                    - generic [ref=e601]: Concerts & Musique
                    - list [ref=e604]:
                      - listitem [ref=e605]:
                        - generic [ref=e608]: 29 NOV 2026 à 20:30
                      - listitem [ref=e609]:
                        - generic [ref=e613]: Dakar · Jardin de la Maison des Arts
                    - generic [ref=e615]:
                      - paragraph [ref=e616]: À partir de
                      - paragraph [ref=e617]: 6 000 F CFA
              - listitem [ref=e621]:
                - article [ref=e622]:
                  - generic [ref=e624]:
                    - generic [ref=e625]:
                      - generic [aria-hidden] [ref=e626]:
                        - generic [ref=e627]: "02"
                        - generic [ref=e628]: DÉC
                      - generic [ref=e629]:
                        - paragraph [ref=e630]: Orga B (test)
                        - heading [level=3] [ref=e631]:
                          - link "TEST Spectacle B (publié, à venir)" [ref=e632] [cursor=pointer]:
                            - /url: /events/46f4867e-d7ab-40e5-a264-2294f68c3208
                    - generic [ref=e633]: Concerts & Musique
                    - list [ref=e636]:
                      - listitem [ref=e637]:
                        - generic [ref=e640]: 02 DÉC 2026 à 20:00
                      - listitem [ref=e641]:
                        - generic [ref=e645]: Dakar · Salle de test, Dakar
                    - generic [ref=e647]:
                      - paragraph [ref=e648]: À partir de
                      - paragraph [ref=e649]: 4 000 F CFA
              - listitem [ref=e653]:
                - article [ref=e654]:
                  - generic [ref=e656]:
                    - generic [ref=e657]:
                      - generic [aria-hidden] [ref=e658]:
                        - generic [ref=e659]: "08"
                        - generic [ref=e660]: DÉC
                      - generic [ref=e661]:
                        - paragraph [ref=e662]: Petite-Côte Événements
                        - heading [level=3] [ref=e663]:
                          - link "Festival des rythmes de Casamance" [ref=e664] [cursor=pointer]:
                            - /url: /events/8a83f29e-3e1f-41cc-8663-b84512b0d348
                    - generic [ref=e665]: Festivals
                    - list [ref=e668]:
                      - listitem [ref=e669]:
                        - generic [ref=e672]: 08 DÉC 2026 à 17:00
                      - listitem [ref=e673]:
                        - generic [ref=e677]: Ziguinchor · Esplanade du Port
                    - generic [ref=e679]:
                      - paragraph [ref=e680]: À partir de
                      - paragraph [ref=e681]: 5 000 F CFA
          - region [ref=e685]:
            - generic [ref=e686]:
              - generic [ref=e687]:
                - heading "Près de chez vous" [level=2] [ref=e688]
                - paragraph [ref=e689]: Les prochains événements dans votre ville.
              - generic [ref=e690]:
                - generic [ref=e691]: Votre ville
                - combobox "Votre ville" [ref=e694] [cursor=pointer]:
                  - option "Choisir une ville" [disabled] [selected]
                  - option "Dakar"
                  - option "Foundiougne"
                  - option "Gorée"
                  - option "Kaolack"
                  - option "Mbour"
                  - option "Saint-Louis"
                  - option "Saly"
                  - option "Ziguinchor"
            - generic [ref=e695]:
              - heading "Choisissez votre ville" [level=3] [ref=e700]
              - paragraph [ref=e701]: Les événements proches de chez vous apparaîtront ici. Votre choix est gardé pour vos prochaines visites.
          - region [ref=e702]:
            - generic [ref=e703]:
              - paragraph [ref=e704]: Espace organisateur
              - heading "Vous organisez des événements ? Vendez vos billets avec Event Village." [level=2] [ref=e705]
              - list [ref=e706]:
                - listitem [ref=e707]:
                  - generic [ref=e711]: Création et publication de vos événements, validées par notre équipe
                - listitem [ref=e712]:
                  - generic [ref=e716]: Ventes et entrées suivies en direct, contrôleurs et caisses sur place
                - listitem [ref=e717]:
                  - generic [ref=e721]: Fonds versés sur votre compte après l’événement
              - link "Devenir partenaire" [ref=e723] [cursor=pointer]:
                - /url: /partner/register
          - generic [ref=e728]:
            - generic [ref=e729]:
              - generic [ref=e730]:
                - paragraph [ref=e731]: Event Village
                - paragraph [ref=e732]: Billetterie et événements au Sénégal.
              - navigation "Liens du pied de page" [ref=e733]:
                - list [ref=e734]:
                  - listitem [ref=e735]:
                    - link "Explorer" [ref=e736] [cursor=pointer]:
                      - /url: /explore
                  - listitem [ref=e738]:
                    - link "Mes billets" [ref=e739] [cursor=pointer]:
                      - /url: /tickets
                  - listitem [ref=e741]:
                    - link "Devenir partenaire" [ref=e742] [cursor=pointer]:
                      - /url: /partner/register
            - paragraph [ref=e744]: Event Village, 2026. Tous droits réservés.
    - navigation "Navigation rapide" [ref=e745]:
      - generic [ref=e746]:
        - link "Accueil" [ref=e747] [cursor=pointer]:
          - /url: /
        - link "Explorer" [ref=e752] [cursor=pointer]:
          - /url: /explore
        - link "Billets" [ref=e757] [cursor=pointer]:
          - /url: /tickets
        - link "Portefeuille" [ref=e761] [cursor=pointer]:
          - /url: /wallet
  - alert [ref=e766]
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