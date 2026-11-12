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
    - complementary [ref=e3]:
      - link "Event Village, accueil" [ref=e5] [cursor=pointer]:
        - /url: /
        - generic [ref=e11]:
          - generic [ref=e12]: EVENT
          - generic [ref=e13]: VILLAGE
      - navigation "Navigation principale" [ref=e14]:
        - generic [ref=e15]:
          - paragraph [ref=e16]: Menu principal
          - generic [ref=e17]:
            - link "Accueil" [ref=e18] [cursor=pointer]:
              - /url: /
            - link "Explorer" [ref=e23] [cursor=pointer]:
              - /url: /explore
            - link "Mes billets" [ref=e28] [cursor=pointer]:
              - /url: /tickets
            - link "Portefeuille" [ref=e32] [cursor=pointer]:
              - /url: /wallet
        - generic [ref=e37]:
          - paragraph [ref=e38]: Espaces métier
          - link "Devenir partenaire" [ref=e40] [cursor=pointer]:
            - /url: /partner/register
      - generic [ref=e46]:
        - link "Se connecter" [ref=e47] [cursor=pointer]:
          - /url: /login
        - button "Basculer le thème" [pressed] [ref=e53] [cursor=pointer]
    - generic [ref=e61]:
      - banner [ref=e62]:
        - link "Rechercher un événement, un concert, un restaurant…" [ref=e64] [cursor=pointer]:
          - /url: /explore
        - button "Notifications" [ref=e71] [cursor=pointer]
      - main [ref=e75]:
        - generic [ref=e77]:
          - generic [ref=e79]:
            - generic [ref=e80]:
              - paragraph [ref=e81]: Billetterie officielle au Sénégal
              - heading "Découvrez, réservez et vivez les événements qui comptent." [level=1] [ref=e85]
              - paragraph [ref=e86]: "Concerts, festivals, soirées et rencontres : choisissez votre place, payez en quelques secondes et présentez votre billet à l’entrée."
              - search [ref=e87]:
                - generic [ref=e89]:
                  - generic [ref=e90]: Rechercher un événement
                  - searchbox "Rechercher un événement" [ref=e92]
                - button "Explorer" [ref=e93] [cursor=pointer]
            - list [ref=e99]:
              - listitem [ref=e100]:
                - generic [ref=e104]:
                  - paragraph [ref=e105]: Wave et Orange Money
                  - paragraph [ref=e106]: Payez depuis votre téléphone, le billet arrive aussitôt.
              - listitem [ref=e107]:
                - generic [ref=e115]:
                  - paragraph [ref=e116]: QR code dynamique
                  - paragraph [ref=e117]: "Un code renouvelé en continu : une capture d’écran ne passe pas l’entrée."
              - listitem [ref=e118]:
                - generic [ref=e123]:
                  - paragraph [ref=e124]: Remboursement automatique
                  - paragraph [ref=e125]: "Événement annulé : les billets payés en ligne sont remboursés."
          - region [ref=e126]:
            - generic [ref=e127]:
              - generic [ref=e128]:
                - heading "À l’affiche" [level=2] [ref=e129]
                - status [ref=e130]: En direct
              - link "Tous les événements" [ref=e132] [cursor=pointer]:
                - /url: /explore
            - group "Catégorie" [ref=e137]:
              - button "Tous" [pressed] [ref=e138] [cursor=pointer]
              - button "Concerts & Musique" [ref=e139] [cursor=pointer]
              - button "Festivals" [ref=e140] [cursor=pointer]
              - button "Gastronomie & Tables" [ref=e141] [cursor=pointer]
              - button "Salles & Réceptions" [ref=e142] [cursor=pointer]
            - list [ref=e143]:
              - listitem [ref=e144]:
                - article [ref=e145]:
                  - generic [ref=e147]:
                    - generic [ref=e148]:
                      - generic [aria-hidden] [ref=e149]:
                        - generic [ref=e150]: "12"
                        - generic [ref=e151]: NOV
                      - generic [ref=e152]:
                        - paragraph [ref=e153]: Baobab Scène
                        - heading [level=3] [ref=e154]:
                          - link "Nuit du Sabar — édition d’automne" [ref=e155] [cursor=pointer]:
                            - /url: /events/a38a7700-a9df-4ab9-b54e-acd70e970dd2
                    - generic [ref=e156]: Concerts & Musique
                    - list [ref=e159]:
                      - listitem [ref=e160]:
                        - generic [ref=e163]: 12 NOV 2026 à 15:15
                      - listitem [ref=e164]:
                        - generic [ref=e168]: Dakar · Esplanade de la Corniche Ouest
                    - generic [ref=e170]:
                      - paragraph [ref=e171]: À partir de
                      - paragraph [ref=e172]: 5 000 F CFA
              - listitem [ref=e176]:
                - article [ref=e177]:
                  - generic [ref=e179]:
                    - generic [ref=e180]:
                      - generic [aria-hidden] [ref=e181]:
                        - generic [ref=e182]: "13"
                        - generic [ref=e183]: NOV
                      - generic [ref=e184]:
                        - paragraph [ref=e185]: Baobab Scène
                        - heading [level=3] [ref=e186]:
                          - link "Concert des Lumières de Gorée" [ref=e187] [cursor=pointer]:
                            - /url: /events/81c765d8-1f83-4ba0-82c8-ad939df26ce3
                    - generic [ref=e188]: Concerts & Musique
                    - list [ref=e191]:
                      - listitem [ref=e192]:
                        - generic [ref=e195]: 13 NOV 2026 à 10:30
                      - listitem [ref=e196]:
                        - generic [ref=e200]: Gorée · Place du Gouvernement
                    - generic [ref=e202]:
                      - paragraph [ref=e203]: À partir de
                      - paragraph [ref=e204]: 6 000 F CFA
              - listitem [ref=e208]:
                - article [ref=e209]:
                  - generic [ref=e211]:
                    - generic [ref=e212]:
                      - generic [aria-hidden] [ref=e213]:
                        - generic [ref=e214]: "17"
                        - generic [ref=e215]: NOV
                      - generic [ref=e216]:
                        - paragraph [ref=e217]: Petite-Côte Événements
                        - heading [level=3] [ref=e218]:
                          - link "Marché gourmand de la Petite-Côte" [ref=e219] [cursor=pointer]:
                            - /url: /events/94608e0c-4e6f-468b-bf7a-c25a5fbc5562
                    - generic [ref=e220]: Gastronomie & Tables
                    - list [ref=e223]:
                      - listitem [ref=e224]:
                        - generic [ref=e227]: 17 NOV 2026 à 10:00
                      - listitem [ref=e228]:
                        - generic [ref=e232]: Mbour · Place du Marché Central
                    - generic [ref=e234]:
                      - paragraph [ref=e235]: À partir de
                      - paragraph [ref=e236]: 1 000 F CFA
              - listitem [ref=e240]:
                - article [ref=e241]:
                  - generic [ref=e243]:
                    - generic [ref=e244]:
                      - generic [aria-hidden] [ref=e245]:
                        - generic [ref=e246]: "20"
                        - generic [ref=e247]: NOV
                      - generic [ref=e248]:
                        - paragraph [ref=e249]: Saloum Culture
                        - heading [level=3] [ref=e250]:
                          - link "Dîner-spectacle au bord du Saloum" [ref=e251] [cursor=pointer]:
                            - /url: /events/31b81592-49d4-42bc-a4ed-6f37f80633cc
                    - generic [ref=e252]: Salles & Réceptions
                    - list [ref=e255]:
                      - listitem [ref=e256]:
                        - generic [ref=e259]: 20 NOV 2026 à 20:00
                      - listitem [ref=e260]:
                        - generic [ref=e264]: Foundiougne · Terrasse des Pirogues
                    - generic [ref=e266]:
                      - paragraph [ref=e267]: À partir de
                      - paragraph [ref=e268]: 25 000 F CFA
              - listitem [ref=e272]:
                - article [ref=e273]:
                  - generic [ref=e275]:
                    - generic [ref=e276]:
                      - generic [aria-hidden] [ref=e277]:
                        - generic [ref=e278]: "24"
                        - generic [ref=e279]: NOV
                      - generic [ref=e280]:
                        - paragraph [ref=e281]: Baobab Scène
                        - heading [level=3] [ref=e282]:
                          - link "Festival Jazz sur le Fleuve" [ref=e283] [cursor=pointer]:
                            - /url: /events/93ef0d5c-dad2-4708-87b0-f78f0e90734f
                    - generic [ref=e284]: Festivals
                    - list [ref=e287]:
                      - listitem [ref=e288]:
                        - generic [ref=e291]: 24 NOV 2026 à 18:00
                      - listitem [ref=e292]:
                        - generic [ref=e296]: Saint-Louis · Quai des Pêcheurs
                    - generic [ref=e298]:
                      - paragraph [ref=e299]: À partir de
                      - paragraph [ref=e300]: 7 500 F CFA
              - listitem [ref=e304]:
                - article [ref=e305]:
                  - generic [ref=e307]:
                    - generic [ref=e308]:
                      - generic [aria-hidden] [ref=e309]:
                        - generic [ref=e310]: "29"
                        - generic [ref=e311]: NOV
                      - generic [ref=e312]:
                        - paragraph [ref=e313]: Baobab Scène
                        - heading [level=3] [ref=e314]:
                          - link "Soirée Kora & Lumières" [ref=e315] [cursor=pointer]:
                            - /url: /events/e495bdb6-0db2-418e-bbb7-a893bf5d23a8
                    - generic [ref=e316]: Concerts & Musique
                    - list [ref=e319]:
                      - listitem [ref=e320]:
                        - generic [ref=e323]: 29 NOV 2026 à 20:30
                      - listitem [ref=e324]:
                        - generic [ref=e328]: Dakar · Jardin de la Maison des Arts
                    - generic [ref=e330]:
                      - paragraph [ref=e331]: À partir de
                      - paragraph [ref=e332]: 6 000 F CFA
              - listitem [ref=e336]:
                - article [ref=e337]:
                  - generic [ref=e339]:
                    - generic [ref=e340]:
                      - generic [aria-hidden] [ref=e341]:
                        - generic [ref=e342]: "02"
                        - generic [ref=e343]: DÉC
                      - generic [ref=e344]:
                        - paragraph [ref=e345]: Orga B (test)
                        - heading [level=3] [ref=e346]:
                          - link "TEST Spectacle B (publié, à venir)" [ref=e347] [cursor=pointer]:
                            - /url: /events/9fbcaba8-3d66-4776-b794-17320c318442
                    - generic [ref=e348]: Concerts & Musique
                    - list [ref=e351]:
                      - listitem [ref=e352]:
                        - generic [ref=e355]: 02 DÉC 2026 à 20:00
                      - listitem [ref=e356]:
                        - generic [ref=e360]: Dakar · Salle de test, Dakar
                    - generic [ref=e362]:
                      - paragraph [ref=e363]: À partir de
                      - paragraph [ref=e364]: 4 000 F CFA
              - listitem [ref=e368]:
                - article [ref=e369]:
                  - generic [ref=e371]:
                    - generic [ref=e372]:
                      - generic [aria-hidden] [ref=e373]:
                        - generic [ref=e374]: "03"
                        - generic [ref=e375]: DÉC
                      - generic [ref=e376]:
                        - paragraph [ref=e377]: Saloum Culture
                        - heading [level=3] [ref=e378]:
                          - link "Gala des entrepreneurs du Saloum" [ref=e379] [cursor=pointer]:
                            - /url: /events/d48a5003-8c88-4809-a9ee-3134e1f60538
                    - generic [ref=e380]: Salles & Réceptions
                    - list [ref=e383]:
                      - listitem [ref=e384]:
                        - generic [ref=e387]: 03 DÉC 2026 à 19:30
                      - listitem [ref=e388]:
                        - generic [ref=e392]: Kaolack · Salle des Palétuviers
                    - generic [ref=e394]:
                      - paragraph [ref=e395]: À partir de
                      - paragraph [ref=e396]: 10 000 F CFA
          - region [ref=e400]:
            - generic [ref=e401]:
              - heading "Populaires" [level=2] [ref=e402]
              - paragraph [ref=e403]: Les événements les plus demandés des 7 derniers jours.
            - list [ref=e404]:
              - listitem [ref=e405]:
                - article [ref=e406]:
                  - generic [ref=e408]:
                    - generic [ref=e409]:
                      - generic [aria-hidden] [ref=e410]:
                        - generic [ref=e411]: "12"
                        - generic [ref=e412]: NOV
                      - generic [ref=e413]:
                        - paragraph [ref=e414]: Baobab Scène
                        - heading [level=3] [ref=e415]:
                          - link "Nuit du Sabar — édition d’automne" [ref=e416] [cursor=pointer]:
                            - /url: /events/a38a7700-a9df-4ab9-b54e-acd70e970dd2
                    - generic [ref=e417]: Concerts & Musique
                    - list [ref=e420]:
                      - listitem [ref=e421]:
                        - generic [ref=e424]: 12 NOV 2026 à 15:15
                      - listitem [ref=e425]:
                        - generic [ref=e429]: Dakar · Esplanade de la Corniche Ouest
                    - generic [ref=e431]:
                      - paragraph [ref=e432]: À partir de
                      - paragraph [ref=e433]: 5 000 F CFA
              - listitem [ref=e437]:
                - article [ref=e438]:
                  - generic [ref=e440]:
                    - generic [ref=e441]:
                      - generic [aria-hidden] [ref=e442]:
                        - generic [ref=e443]: "17"
                        - generic [ref=e444]: NOV
                      - generic [ref=e445]:
                        - paragraph [ref=e446]: Petite-Côte Événements
                        - heading [level=3] [ref=e447]:
                          - link "Marché gourmand de la Petite-Côte" [ref=e448] [cursor=pointer]:
                            - /url: /events/94608e0c-4e6f-468b-bf7a-c25a5fbc5562
                    - generic [ref=e449]: Gastronomie & Tables
                    - list [ref=e452]:
                      - listitem [ref=e453]:
                        - generic [ref=e456]: 17 NOV 2026 à 10:00
                      - listitem [ref=e457]:
                        - generic [ref=e461]: Mbour · Place du Marché Central
                    - generic [ref=e463]:
                      - paragraph [ref=e464]: À partir de
                      - paragraph [ref=e465]: 1 000 F CFA
              - listitem [ref=e469]:
                - article [ref=e470]:
                  - generic [ref=e472]:
                    - generic [ref=e473]:
                      - generic [aria-hidden] [ref=e474]:
                        - generic [ref=e475]: "24"
                        - generic [ref=e476]: NOV
                      - generic [ref=e477]:
                        - paragraph [ref=e478]: Baobab Scène
                        - heading [level=3] [ref=e479]:
                          - link "Festival Jazz sur le Fleuve" [ref=e480] [cursor=pointer]:
                            - /url: /events/93ef0d5c-dad2-4708-87b0-f78f0e90734f
                    - generic [ref=e481]: Festivals
                    - list [ref=e484]:
                      - listitem [ref=e485]:
                        - generic [ref=e488]: 24 NOV 2026 à 18:00
                      - listitem [ref=e489]:
                        - generic [ref=e493]: Saint-Louis · Quai des Pêcheurs
                    - generic [ref=e495]:
                      - paragraph [ref=e496]: À partir de
                      - paragraph [ref=e497]: 7 500 F CFA
              - listitem [ref=e501]:
                - article [ref=e502]:
                  - generic [ref=e504]:
                    - generic [ref=e505]:
                      - generic [aria-hidden] [ref=e506]:
                        - generic [ref=e507]: "03"
                        - generic [ref=e508]: DÉC
                      - generic [ref=e509]:
                        - paragraph [ref=e510]: Saloum Culture
                        - heading [level=3] [ref=e511]:
                          - link "Gala des entrepreneurs du Saloum" [ref=e512] [cursor=pointer]:
                            - /url: /events/d48a5003-8c88-4809-a9ee-3134e1f60538
                    - generic [ref=e513]: Salles & Réceptions
                    - list [ref=e516]:
                      - listitem [ref=e517]:
                        - generic [ref=e520]: 03 DÉC 2026 à 19:30
                      - listitem [ref=e521]:
                        - generic [ref=e525]: Kaolack · Salle des Palétuviers
                    - generic [ref=e527]:
                      - paragraph [ref=e528]: À partir de
                      - paragraph [ref=e529]: 10 000 F CFA
              - listitem [ref=e533]:
                - article [ref=e534]:
                  - generic [ref=e536]:
                    - generic [ref=e537]:
                      - generic [aria-hidden] [ref=e538]:
                        - generic [ref=e539]: "13"
                        - generic [ref=e540]: NOV
                      - generic [ref=e541]:
                        - paragraph [ref=e542]: Baobab Scène
                        - heading [level=3] [ref=e543]:
                          - link "Concert des Lumières de Gorée" [ref=e544] [cursor=pointer]:
                            - /url: /events/81c765d8-1f83-4ba0-82c8-ad939df26ce3
                    - generic [ref=e545]: Concerts & Musique
                    - list [ref=e548]:
                      - listitem [ref=e549]:
                        - generic [ref=e552]: 13 NOV 2026 à 10:30
                      - listitem [ref=e553]:
                        - generic [ref=e557]: Gorée · Place du Gouvernement
                    - generic [ref=e559]:
                      - paragraph [ref=e560]: À partir de
                      - paragraph [ref=e561]: 6 000 F CFA
              - listitem [ref=e565]:
                - article [ref=e566]:
                  - generic [ref=e568]:
                    - generic [ref=e569]:
                      - generic [aria-hidden] [ref=e570]:
                        - generic [ref=e571]: "12"
                        - generic [ref=e572]: DÉC
                      - generic [ref=e573]:
                        - paragraph [ref=e574]: Petite-Côte Événements
                        - heading [level=3] [ref=e575]:
                          - link "Carnaval des enfants de Saly" [ref=e576] [cursor=pointer]:
                            - /url: /events/b13e78e6-b564-4bb7-a795-c4d90347e2ed
                    - generic [ref=e577]: Festivals
                    - list [ref=e580]:
                      - listitem [ref=e581]:
                        - generic [ref=e584]: 12 DÉC 2026 à 15:00
                      - listitem [ref=e585]:
                        - generic [ref=e589]: Saly · Promenade des Filaos
                    - generic [ref=e591]:
                      - paragraph [ref=e592]: À partir de
                      - paragraph [ref=e593]: 2 000 F CFA
              - listitem [ref=e597]:
                - article [ref=e598]:
                  - generic [ref=e600]:
                    - generic [ref=e601]:
                      - generic [aria-hidden] [ref=e602]:
                        - generic [ref=e603]: "20"
                        - generic [ref=e604]: NOV
                      - generic [ref=e605]:
                        - paragraph [ref=e606]: Saloum Culture
                        - heading [level=3] [ref=e607]:
                          - link "Dîner-spectacle au bord du Saloum" [ref=e608] [cursor=pointer]:
                            - /url: /events/31b81592-49d4-42bc-a4ed-6f37f80633cc
                    - generic [ref=e609]: Salles & Réceptions
                    - list [ref=e612]:
                      - listitem [ref=e613]:
                        - generic [ref=e616]: 20 NOV 2026 à 20:00
                      - listitem [ref=e617]:
                        - generic [ref=e621]: Foundiougne · Terrasse des Pirogues
                    - generic [ref=e623]:
                      - paragraph [ref=e624]: À partir de
                      - paragraph [ref=e625]: 25 000 F CFA
              - listitem [ref=e629]:
                - article [ref=e630]:
                  - generic [ref=e632]:
                    - generic [ref=e633]:
                      - generic [aria-hidden] [ref=e634]:
                        - generic [ref=e635]: "29"
                        - generic [ref=e636]: NOV
                      - generic [ref=e637]:
                        - paragraph [ref=e638]: Baobab Scène
                        - heading [level=3] [ref=e639]:
                          - link "Soirée Kora & Lumières" [ref=e640] [cursor=pointer]:
                            - /url: /events/e495bdb6-0db2-418e-bbb7-a893bf5d23a8
                    - generic [ref=e641]: Concerts & Musique
                    - list [ref=e644]:
                      - listitem [ref=e645]:
                        - generic [ref=e648]: 29 NOV 2026 à 20:30
                      - listitem [ref=e649]:
                        - generic [ref=e653]: Dakar · Jardin de la Maison des Arts
                    - generic [ref=e655]:
                      - paragraph [ref=e656]: À partir de
                      - paragraph [ref=e657]: 6 000 F CFA
              - listitem [ref=e661]:
                - article [ref=e662]:
                  - generic [ref=e664]:
                    - generic [ref=e665]:
                      - generic [aria-hidden] [ref=e666]:
                        - generic [ref=e667]: "02"
                        - generic [ref=e668]: DÉC
                      - generic [ref=e669]:
                        - paragraph [ref=e670]: Orga B (test)
                        - heading [level=3] [ref=e671]:
                          - link "TEST Spectacle B (publié, à venir)" [ref=e672] [cursor=pointer]:
                            - /url: /events/9fbcaba8-3d66-4776-b794-17320c318442
                    - generic [ref=e673]: Concerts & Musique
                    - list [ref=e676]:
                      - listitem [ref=e677]:
                        - generic [ref=e680]: 02 DÉC 2026 à 20:00
                      - listitem [ref=e681]:
                        - generic [ref=e685]: Dakar · Salle de test, Dakar
                    - generic [ref=e687]:
                      - paragraph [ref=e688]: À partir de
                      - paragraph [ref=e689]: 4 000 F CFA
              - listitem [ref=e693]:
                - article [ref=e694]:
                  - generic [ref=e696]:
                    - generic [ref=e697]:
                      - generic [aria-hidden] [ref=e698]:
                        - generic [ref=e699]: "08"
                        - generic [ref=e700]: DÉC
                      - generic [ref=e701]:
                        - paragraph [ref=e702]: Petite-Côte Événements
                        - heading [level=3] [ref=e703]:
                          - link "Festival des rythmes de Casamance" [ref=e704] [cursor=pointer]:
                            - /url: /events/89aa13c6-dd92-4e0e-9f82-4ade04be4059
                    - generic [ref=e705]: Festivals
                    - list [ref=e708]:
                      - listitem [ref=e709]:
                        - generic [ref=e712]: 08 DÉC 2026 à 17:00
                      - listitem [ref=e713]:
                        - generic [ref=e717]: Ziguinchor · Esplanade du Port
                    - generic [ref=e719]:
                      - paragraph [ref=e720]: À partir de
                      - paragraph [ref=e721]: 5 000 F CFA
          - region [ref=e725]:
            - generic [ref=e726]:
              - generic [ref=e727]:
                - heading "Près de chez vous" [level=2] [ref=e728]
                - paragraph [ref=e729]: Les prochains événements dans votre ville.
              - generic [ref=e730]:
                - generic [ref=e731]: Votre ville
                - combobox "Votre ville" [ref=e734] [cursor=pointer]:
                  - option "Choisir une ville" [disabled] [selected]
                  - option "Dakar"
                  - option "Foundiougne"
                  - option "Gorée"
                  - option "Kaolack"
                  - option "Mbour"
                  - option "Saint-Louis"
                  - option "Saly"
                  - option "Ziguinchor"
            - generic [ref=e735]:
              - heading "Choisissez votre ville" [level=3] [ref=e740]
              - paragraph [ref=e741]: Les événements proches de chez vous apparaîtront ici. Votre choix est gardé pour vos prochaines visites.
          - region [ref=e742]:
            - generic [ref=e743]:
              - paragraph [ref=e744]: Espace organisateur
              - heading "Vous organisez des événements ? Vendez vos billets avec Event Village." [level=2] [ref=e745]
              - list [ref=e746]:
                - listitem [ref=e747]:
                  - generic [ref=e751]: Création et publication de vos événements, validées par notre équipe
                - listitem [ref=e752]:
                  - generic [ref=e756]: Ventes et entrées suivies en direct, contrôleurs et caisses sur place
                - listitem [ref=e757]:
                  - generic [ref=e761]: Fonds versés sur votre compte après l’événement
              - link "Devenir partenaire" [ref=e763] [cursor=pointer]:
                - /url: /partner/register
          - generic [ref=e768]:
            - generic [ref=e769]:
              - generic [ref=e770]:
                - paragraph [ref=e771]: Event Village
                - paragraph [ref=e772]: Billetterie et événements au Sénégal.
              - navigation "Liens du pied de page" [ref=e773]:
                - list [ref=e774]:
                  - listitem [ref=e775]:
                    - link "Explorer" [ref=e776] [cursor=pointer]:
                      - /url: /explore
                  - listitem [ref=e778]:
                    - link "Mes billets" [ref=e779] [cursor=pointer]:
                      - /url: /tickets
                  - listitem [ref=e781]:
                    - link "Devenir partenaire" [ref=e782] [cursor=pointer]:
                      - /url: /partner/register
            - paragraph [ref=e784]: Event Village, 2026. Tous droits réservés.
  - alert [ref=e785]
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