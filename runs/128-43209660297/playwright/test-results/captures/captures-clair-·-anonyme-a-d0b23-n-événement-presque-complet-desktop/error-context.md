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
        - button "Basculer le thème" [ref=e53] [cursor=pointer]
    - generic [ref=e57]:
      - banner [ref=e58]:
        - link "Rechercher un événement, un concert, un restaurant…" [ref=e60] [cursor=pointer]:
          - /url: /explore
        - button "Notifications" [ref=e67] [cursor=pointer]
      - main [ref=e71]:
        - generic [ref=e73]:
          - generic [ref=e75]:
            - generic [ref=e76]:
              - paragraph [ref=e77]: Billetterie officielle au Sénégal
              - heading "Découvrez, réservez et vivez les événements qui comptent." [level=1] [ref=e81]
              - paragraph [ref=e82]: "Concerts, festivals, soirées et rencontres : choisissez votre place, payez en quelques secondes et présentez votre billet à l’entrée."
              - search [ref=e83]:
                - generic [ref=e85]:
                  - generic [ref=e86]: Rechercher un événement
                  - searchbox "Rechercher un événement" [ref=e88]
                - button "Explorer" [ref=e89] [cursor=pointer]
            - list [ref=e95]:
              - listitem [ref=e96]:
                - generic [ref=e100]:
                  - paragraph [ref=e101]: Wave et Orange Money
                  - paragraph [ref=e102]: Payez depuis votre téléphone, le billet arrive aussitôt.
              - listitem [ref=e103]:
                - generic [ref=e111]:
                  - paragraph [ref=e112]: QR code dynamique
                  - paragraph [ref=e113]: "Un code renouvelé en continu : une capture d’écran ne passe pas l’entrée."
              - listitem [ref=e114]:
                - generic [ref=e119]:
                  - paragraph [ref=e120]: Remboursement automatique
                  - paragraph [ref=e121]: "Événement annulé : les billets payés en ligne sont remboursés."
          - region [ref=e122]:
            - generic [ref=e123]:
              - generic [ref=e124]:
                - heading "À l’affiche" [level=2] [ref=e125]
                - status [ref=e126]: En direct
              - link "Tous les événements" [ref=e128] [cursor=pointer]:
                - /url: /explore
            - group "Catégorie" [ref=e133]:
              - button "Tous" [pressed] [ref=e134] [cursor=pointer]
              - button "Concerts & Musique" [ref=e135] [cursor=pointer]
              - button "Festivals" [ref=e136] [cursor=pointer]
              - button "Gastronomie & Tables" [ref=e137] [cursor=pointer]
              - button "Salles & Réceptions" [ref=e138] [cursor=pointer]
            - list [ref=e139]:
              - listitem [ref=e140]:
                - article [ref=e141]:
                  - generic [ref=e143]:
                    - generic [ref=e144]:
                      - generic [aria-hidden] [ref=e145]:
                        - generic [ref=e146]: "12"
                        - generic [ref=e147]: NOV
                      - generic [ref=e148]:
                        - paragraph [ref=e149]: Baobab Scène
                        - heading [level=3] [ref=e150]:
                          - link "Nuit du Sabar — édition d’automne" [ref=e151] [cursor=pointer]:
                            - /url: /events/2434a00a-ba99-4ec2-aa98-892ac2b8c627
                    - generic [ref=e152]: Concerts & Musique
                    - list [ref=e155]:
                      - listitem [ref=e156]:
                        - generic [ref=e159]: 12 NOV 2026 à 12:45
                      - listitem [ref=e160]:
                        - generic [ref=e164]: Dakar · Esplanade de la Corniche Ouest
                    - generic [ref=e166]:
                      - paragraph [ref=e167]: À partir de
                      - paragraph [ref=e168]: 5 000 F CFA
              - listitem [ref=e172]:
                - article [ref=e173]:
                  - generic [ref=e175]:
                    - generic [ref=e176]:
                      - generic [aria-hidden] [ref=e177]:
                        - generic [ref=e178]: "13"
                        - generic [ref=e179]: NOV
                      - generic [ref=e180]:
                        - paragraph [ref=e181]: Baobab Scène
                        - heading [level=3] [ref=e182]:
                          - link "Concert des Lumières de Gorée" [ref=e183] [cursor=pointer]:
                            - /url: /events/bee25d2e-9f0d-4058-b4f4-0b09ff39a4f0
                    - generic [ref=e184]: Concerts & Musique
                    - list [ref=e187]:
                      - listitem [ref=e188]:
                        - generic [ref=e191]: 13 NOV 2026 à 08:00
                      - listitem [ref=e192]:
                        - generic [ref=e196]: Gorée · Place du Gouvernement
                    - generic [ref=e198]:
                      - paragraph [ref=e199]: À partir de
                      - paragraph [ref=e200]: 6 000 F CFA
              - listitem [ref=e204]:
                - article [ref=e205]:
                  - generic [ref=e207]:
                    - generic [ref=e208]:
                      - generic [aria-hidden] [ref=e209]:
                        - generic [ref=e210]: "17"
                        - generic [ref=e211]: NOV
                      - generic [ref=e212]:
                        - paragraph [ref=e213]: Petite-Côte Événements
                        - heading [level=3] [ref=e214]:
                          - link "Marché gourmand de la Petite-Côte" [ref=e215] [cursor=pointer]:
                            - /url: /events/d2dbe96b-43c6-4721-bf33-5370d0fc7a71
                    - generic [ref=e216]: Gastronomie & Tables
                    - list [ref=e219]:
                      - listitem [ref=e220]:
                        - generic [ref=e223]: 17 NOV 2026 à 10:00
                      - listitem [ref=e224]:
                        - generic [ref=e228]: Mbour · Place du Marché Central
                    - generic [ref=e230]:
                      - paragraph [ref=e231]: À partir de
                      - paragraph [ref=e232]: 1 000 F CFA
              - listitem [ref=e236]:
                - article [ref=e237]:
                  - generic [ref=e239]:
                    - generic [ref=e240]:
                      - generic [aria-hidden] [ref=e241]:
                        - generic [ref=e242]: "20"
                        - generic [ref=e243]: NOV
                      - generic [ref=e244]:
                        - paragraph [ref=e245]: Saloum Culture
                        - heading [level=3] [ref=e246]:
                          - link "Dîner-spectacle au bord du Saloum" [ref=e247] [cursor=pointer]:
                            - /url: /events/994773f5-e810-4266-859c-5dcc5b4b0c35
                    - generic [ref=e248]: Salles & Réceptions
                    - list [ref=e251]:
                      - listitem [ref=e252]:
                        - generic [ref=e255]: 20 NOV 2026 à 20:00
                      - listitem [ref=e256]:
                        - generic [ref=e260]: Foundiougne · Terrasse des Pirogues
                    - generic [ref=e262]:
                      - paragraph [ref=e263]: À partir de
                      - paragraph [ref=e264]: 25 000 F CFA
              - listitem [ref=e268]:
                - article [ref=e269]:
                  - generic [ref=e271]:
                    - generic [ref=e272]:
                      - generic [aria-hidden] [ref=e273]:
                        - generic [ref=e274]: "24"
                        - generic [ref=e275]: NOV
                      - generic [ref=e276]:
                        - paragraph [ref=e277]: Baobab Scène
                        - heading [level=3] [ref=e278]:
                          - link "Festival Jazz sur le Fleuve" [ref=e279] [cursor=pointer]:
                            - /url: /events/e36ff04d-4e1c-4ba2-8507-ab702194836f
                    - generic [ref=e280]: Festivals
                    - list [ref=e283]:
                      - listitem [ref=e284]:
                        - generic [ref=e287]: 24 NOV 2026 à 18:00
                      - listitem [ref=e288]:
                        - generic [ref=e292]: Saint-Louis · Quai des Pêcheurs
                    - generic [ref=e294]:
                      - paragraph [ref=e295]: À partir de
                      - paragraph [ref=e296]: 7 500 F CFA
              - listitem [ref=e300]:
                - article [ref=e301]:
                  - generic [ref=e303]:
                    - generic [ref=e304]:
                      - generic [aria-hidden] [ref=e305]:
                        - generic [ref=e306]: "29"
                        - generic [ref=e307]: NOV
                      - generic [ref=e308]:
                        - paragraph [ref=e309]: Baobab Scène
                        - heading [level=3] [ref=e310]:
                          - link "Soirée Kora & Lumières" [ref=e311] [cursor=pointer]:
                            - /url: /events/d5b0190e-3cd4-44a8-a864-56862d368422
                    - generic [ref=e312]: Concerts & Musique
                    - list [ref=e315]:
                      - listitem [ref=e316]:
                        - generic [ref=e319]: 29 NOV 2026 à 20:30
                      - listitem [ref=e320]:
                        - generic [ref=e324]: Dakar · Jardin de la Maison des Arts
                    - generic [ref=e326]:
                      - paragraph [ref=e327]: À partir de
                      - paragraph [ref=e328]: 6 000 F CFA
              - listitem [ref=e332]:
                - article [ref=e333]:
                  - generic [ref=e335]:
                    - generic [ref=e336]:
                      - generic [aria-hidden] [ref=e337]:
                        - generic [ref=e338]: "02"
                        - generic [ref=e339]: DÉC
                      - generic [ref=e340]:
                        - paragraph [ref=e341]: Orga B (test)
                        - heading [level=3] [ref=e342]:
                          - link "TEST Spectacle B (publié, à venir)" [ref=e343] [cursor=pointer]:
                            - /url: /events/a0bc41f6-6d63-47e1-95be-7908fd7fea7e
                    - generic [ref=e344]: Concerts & Musique
                    - list [ref=e347]:
                      - listitem [ref=e348]:
                        - generic [ref=e351]: 02 DÉC 2026 à 20:00
                      - listitem [ref=e352]:
                        - generic [ref=e356]: Dakar · Salle de test, Dakar
                    - generic [ref=e358]:
                      - paragraph [ref=e359]: À partir de
                      - paragraph [ref=e360]: 4 000 F CFA
              - listitem [ref=e364]:
                - article [ref=e365]:
                  - generic [ref=e367]:
                    - generic [ref=e368]:
                      - generic [aria-hidden] [ref=e369]:
                        - generic [ref=e370]: "03"
                        - generic [ref=e371]: DÉC
                      - generic [ref=e372]:
                        - paragraph [ref=e373]: Saloum Culture
                        - heading [level=3] [ref=e374]:
                          - link "Gala des entrepreneurs du Saloum" [ref=e375] [cursor=pointer]:
                            - /url: /events/a839903b-b9cd-42dc-a4ca-703de00cc803
                    - generic [ref=e376]: Salles & Réceptions
                    - list [ref=e379]:
                      - listitem [ref=e380]:
                        - generic [ref=e383]: 03 DÉC 2026 à 19:30
                      - listitem [ref=e384]:
                        - generic [ref=e388]: Kaolack · Salle des Palétuviers
                    - generic [ref=e390]:
                      - paragraph [ref=e391]: À partir de
                      - paragraph [ref=e392]: 10 000 F CFA
          - region [ref=e396]:
            - generic [ref=e397]:
              - heading "Populaires" [level=2] [ref=e398]
              - paragraph [ref=e399]: Les événements les plus demandés des 7 derniers jours.
            - list [ref=e400]:
              - listitem [ref=e401]:
                - article [ref=e402]:
                  - generic [ref=e404]:
                    - generic [ref=e405]:
                      - generic [aria-hidden] [ref=e406]:
                        - generic [ref=e407]: "12"
                        - generic [ref=e408]: NOV
                      - generic [ref=e409]:
                        - paragraph [ref=e410]: Baobab Scène
                        - heading [level=3] [ref=e411]:
                          - link "Nuit du Sabar — édition d’automne" [ref=e412] [cursor=pointer]:
                            - /url: /events/2434a00a-ba99-4ec2-aa98-892ac2b8c627
                    - generic [ref=e413]: Concerts & Musique
                    - list [ref=e416]:
                      - listitem [ref=e417]:
                        - generic [ref=e420]: 12 NOV 2026 à 12:45
                      - listitem [ref=e421]:
                        - generic [ref=e425]: Dakar · Esplanade de la Corniche Ouest
                    - generic [ref=e427]:
                      - paragraph [ref=e428]: À partir de
                      - paragraph [ref=e429]: 5 000 F CFA
              - listitem [ref=e433]:
                - article [ref=e434]:
                  - generic [ref=e436]:
                    - generic [ref=e437]:
                      - generic [aria-hidden] [ref=e438]:
                        - generic [ref=e439]: "17"
                        - generic [ref=e440]: NOV
                      - generic [ref=e441]:
                        - paragraph [ref=e442]: Petite-Côte Événements
                        - heading [level=3] [ref=e443]:
                          - link "Marché gourmand de la Petite-Côte" [ref=e444] [cursor=pointer]:
                            - /url: /events/d2dbe96b-43c6-4721-bf33-5370d0fc7a71
                    - generic [ref=e445]: Gastronomie & Tables
                    - list [ref=e448]:
                      - listitem [ref=e449]:
                        - generic [ref=e452]: 17 NOV 2026 à 10:00
                      - listitem [ref=e453]:
                        - generic [ref=e457]: Mbour · Place du Marché Central
                    - generic [ref=e459]:
                      - paragraph [ref=e460]: À partir de
                      - paragraph [ref=e461]: 1 000 F CFA
              - listitem [ref=e465]:
                - article [ref=e466]:
                  - generic [ref=e468]:
                    - generic [ref=e469]:
                      - generic [aria-hidden] [ref=e470]:
                        - generic [ref=e471]: "24"
                        - generic [ref=e472]: NOV
                      - generic [ref=e473]:
                        - paragraph [ref=e474]: Baobab Scène
                        - heading [level=3] [ref=e475]:
                          - link "Festival Jazz sur le Fleuve" [ref=e476] [cursor=pointer]:
                            - /url: /events/e36ff04d-4e1c-4ba2-8507-ab702194836f
                    - generic [ref=e477]: Festivals
                    - list [ref=e480]:
                      - listitem [ref=e481]:
                        - generic [ref=e484]: 24 NOV 2026 à 18:00
                      - listitem [ref=e485]:
                        - generic [ref=e489]: Saint-Louis · Quai des Pêcheurs
                    - generic [ref=e491]:
                      - paragraph [ref=e492]: À partir de
                      - paragraph [ref=e493]: 7 500 F CFA
              - listitem [ref=e497]:
                - article [ref=e498]:
                  - generic [ref=e500]:
                    - generic [ref=e501]:
                      - generic [aria-hidden] [ref=e502]:
                        - generic [ref=e503]: "03"
                        - generic [ref=e504]: DÉC
                      - generic [ref=e505]:
                        - paragraph [ref=e506]: Saloum Culture
                        - heading [level=3] [ref=e507]:
                          - link "Gala des entrepreneurs du Saloum" [ref=e508] [cursor=pointer]:
                            - /url: /events/a839903b-b9cd-42dc-a4ca-703de00cc803
                    - generic [ref=e509]: Salles & Réceptions
                    - list [ref=e512]:
                      - listitem [ref=e513]:
                        - generic [ref=e516]: 03 DÉC 2026 à 19:30
                      - listitem [ref=e517]:
                        - generic [ref=e521]: Kaolack · Salle des Palétuviers
                    - generic [ref=e523]:
                      - paragraph [ref=e524]: À partir de
                      - paragraph [ref=e525]: 10 000 F CFA
              - listitem [ref=e529]:
                - article [ref=e530]:
                  - generic [ref=e532]:
                    - generic [ref=e533]:
                      - generic [aria-hidden] [ref=e534]:
                        - generic [ref=e535]: "13"
                        - generic [ref=e536]: NOV
                      - generic [ref=e537]:
                        - paragraph [ref=e538]: Baobab Scène
                        - heading [level=3] [ref=e539]:
                          - link "Concert des Lumières de Gorée" [ref=e540] [cursor=pointer]:
                            - /url: /events/bee25d2e-9f0d-4058-b4f4-0b09ff39a4f0
                    - generic [ref=e541]: Concerts & Musique
                    - list [ref=e544]:
                      - listitem [ref=e545]:
                        - generic [ref=e548]: 13 NOV 2026 à 08:00
                      - listitem [ref=e549]:
                        - generic [ref=e553]: Gorée · Place du Gouvernement
                    - generic [ref=e555]:
                      - paragraph [ref=e556]: À partir de
                      - paragraph [ref=e557]: 6 000 F CFA
              - listitem [ref=e561]:
                - article [ref=e562]:
                  - generic [ref=e564]:
                    - generic [ref=e565]:
                      - generic [aria-hidden] [ref=e566]:
                        - generic [ref=e567]: "12"
                        - generic [ref=e568]: DÉC
                      - generic [ref=e569]:
                        - paragraph [ref=e570]: Petite-Côte Événements
                        - heading [level=3] [ref=e571]:
                          - link "Carnaval des enfants de Saly" [ref=e572] [cursor=pointer]:
                            - /url: /events/c4c1e3e1-e971-47e9-a409-8b8f976f43d2
                    - generic [ref=e573]: Festivals
                    - list [ref=e576]:
                      - listitem [ref=e577]:
                        - generic [ref=e580]: 12 DÉC 2026 à 15:00
                      - listitem [ref=e581]:
                        - generic [ref=e585]: Saly · Promenade des Filaos
                    - generic [ref=e587]:
                      - paragraph [ref=e588]: À partir de
                      - paragraph [ref=e589]: 2 000 F CFA
              - listitem [ref=e593]:
                - article [ref=e594]:
                  - generic [ref=e596]:
                    - generic [ref=e597]:
                      - generic [aria-hidden] [ref=e598]:
                        - generic [ref=e599]: "20"
                        - generic [ref=e600]: NOV
                      - generic [ref=e601]:
                        - paragraph [ref=e602]: Saloum Culture
                        - heading [level=3] [ref=e603]:
                          - link "Dîner-spectacle au bord du Saloum" [ref=e604] [cursor=pointer]:
                            - /url: /events/994773f5-e810-4266-859c-5dcc5b4b0c35
                    - generic [ref=e605]: Salles & Réceptions
                    - list [ref=e608]:
                      - listitem [ref=e609]:
                        - generic [ref=e612]: 20 NOV 2026 à 20:00
                      - listitem [ref=e613]:
                        - generic [ref=e617]: Foundiougne · Terrasse des Pirogues
                    - generic [ref=e619]:
                      - paragraph [ref=e620]: À partir de
                      - paragraph [ref=e621]: 25 000 F CFA
              - listitem [ref=e625]:
                - article [ref=e626]:
                  - generic [ref=e628]:
                    - generic [ref=e629]:
                      - generic [aria-hidden] [ref=e630]:
                        - generic [ref=e631]: "29"
                        - generic [ref=e632]: NOV
                      - generic [ref=e633]:
                        - paragraph [ref=e634]: Baobab Scène
                        - heading [level=3] [ref=e635]:
                          - link "Soirée Kora & Lumières" [ref=e636] [cursor=pointer]:
                            - /url: /events/d5b0190e-3cd4-44a8-a864-56862d368422
                    - generic [ref=e637]: Concerts & Musique
                    - list [ref=e640]:
                      - listitem [ref=e641]:
                        - generic [ref=e644]: 29 NOV 2026 à 20:30
                      - listitem [ref=e645]:
                        - generic [ref=e649]: Dakar · Jardin de la Maison des Arts
                    - generic [ref=e651]:
                      - paragraph [ref=e652]: À partir de
                      - paragraph [ref=e653]: 6 000 F CFA
              - listitem [ref=e657]:
                - article [ref=e658]:
                  - generic [ref=e660]:
                    - generic [ref=e661]:
                      - generic [aria-hidden] [ref=e662]:
                        - generic [ref=e663]: "02"
                        - generic [ref=e664]: DÉC
                      - generic [ref=e665]:
                        - paragraph [ref=e666]: Orga B (test)
                        - heading [level=3] [ref=e667]:
                          - link "TEST Spectacle B (publié, à venir)" [ref=e668] [cursor=pointer]:
                            - /url: /events/a0bc41f6-6d63-47e1-95be-7908fd7fea7e
                    - generic [ref=e669]: Concerts & Musique
                    - list [ref=e672]:
                      - listitem [ref=e673]:
                        - generic [ref=e676]: 02 DÉC 2026 à 20:00
                      - listitem [ref=e677]:
                        - generic [ref=e681]: Dakar · Salle de test, Dakar
                    - generic [ref=e683]:
                      - paragraph [ref=e684]: À partir de
                      - paragraph [ref=e685]: 4 000 F CFA
              - listitem [ref=e689]:
                - article [ref=e690]:
                  - generic [ref=e692]:
                    - generic [ref=e693]:
                      - generic [aria-hidden] [ref=e694]:
                        - generic [ref=e695]: "08"
                        - generic [ref=e696]: DÉC
                      - generic [ref=e697]:
                        - paragraph [ref=e698]: Petite-Côte Événements
                        - heading [level=3] [ref=e699]:
                          - link "Festival des rythmes de Casamance" [ref=e700] [cursor=pointer]:
                            - /url: /events/ef87a867-c2be-4fe2-899b-38dde295b8cc
                    - generic [ref=e701]: Festivals
                    - list [ref=e704]:
                      - listitem [ref=e705]:
                        - generic [ref=e708]: 08 DÉC 2026 à 17:00
                      - listitem [ref=e709]:
                        - generic [ref=e713]: Ziguinchor · Esplanade du Port
                    - generic [ref=e715]:
                      - paragraph [ref=e716]: À partir de
                      - paragraph [ref=e717]: 5 000 F CFA
          - region [ref=e721]:
            - generic [ref=e722]:
              - generic [ref=e723]:
                - heading "Près de chez vous" [level=2] [ref=e724]
                - paragraph [ref=e725]: Les prochains événements dans votre ville.
              - generic [ref=e726]:
                - generic [ref=e727]: Votre ville
                - combobox "Votre ville" [ref=e730] [cursor=pointer]:
                  - option "Choisir une ville" [disabled] [selected]
                  - option "Dakar"
                  - option "Foundiougne"
                  - option "Gorée"
                  - option "Kaolack"
                  - option "Mbour"
                  - option "Saint-Louis"
                  - option "Saly"
                  - option "Ziguinchor"
            - generic [ref=e731]:
              - heading "Choisissez votre ville" [level=3] [ref=e736]
              - paragraph [ref=e737]: Les événements proches de chez vous apparaîtront ici. Votre choix est gardé pour vos prochaines visites.
          - region [ref=e738]:
            - generic [ref=e739]:
              - paragraph [ref=e740]: Espace organisateur
              - heading "Vous organisez des événements ? Vendez vos billets avec Event Village." [level=2] [ref=e741]
              - list [ref=e742]:
                - listitem [ref=e743]:
                  - generic [ref=e747]: Création et publication de vos événements, validées par notre équipe
                - listitem [ref=e748]:
                  - generic [ref=e752]: Ventes et entrées suivies en direct, contrôleurs et caisses sur place
                - listitem [ref=e753]:
                  - generic [ref=e757]: Fonds versés sur votre compte après l’événement
              - link "Devenir partenaire" [ref=e759] [cursor=pointer]:
                - /url: /partner/register
          - generic [ref=e764]:
            - generic [ref=e765]:
              - generic [ref=e766]:
                - paragraph [ref=e767]: Event Village
                - paragraph [ref=e768]: Billetterie et événements au Sénégal.
              - navigation "Liens du pied de page" [ref=e769]:
                - list [ref=e770]:
                  - listitem [ref=e771]:
                    - link "Explorer" [ref=e772] [cursor=pointer]:
                      - /url: /explore
                  - listitem [ref=e774]:
                    - link "Mes billets" [ref=e775] [cursor=pointer]:
                      - /url: /tickets
                  - listitem [ref=e777]:
                    - link "Devenir partenaire" [ref=e778] [cursor=pointer]:
                      - /url: /partner/register
            - paragraph [ref=e780]: Event Village, 2026. Tous droits réservés.
  - alert [ref=e781]
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