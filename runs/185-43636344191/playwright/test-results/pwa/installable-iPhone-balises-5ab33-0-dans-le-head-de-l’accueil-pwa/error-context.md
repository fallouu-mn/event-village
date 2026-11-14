# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: installable.spec.ts >> iPhone : balises apple-mobile-web-app et icône apple-touch 180×180 dans le <head> de l’accueil
- Location: e2e/installable.spec.ts:193:5

# Error details

```
Error: meta apple-mobile-web-app-capable = yes

expect(received).toEqual(expected) // deep equality

- Expected  - 3
+ Received  + 1

- Array [
-   "yes",
- ]
+ Array []
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
                        - generic [ref=e106]: "14"
                        - generic [ref=e107]: NOV
                      - generic [ref=e108]:
                        - paragraph [ref=e109]: Baobab Scène
                        - heading [level=3] [ref=e110]:
                          - link "Nuit du Sabar — édition d’automne" [ref=e111] [cursor=pointer]:
                            - /url: /events/96b46b91-1716-4ba7-9bd0-ab9ce1ef8f5f
                    - generic [ref=e112]: Concerts & Musique
                    - list [ref=e115]:
                      - listitem [ref=e116]:
                        - generic [ref=e119]: 14 NOV 2026 à 21:45
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
                        - generic [ref=e138]: "14"
                        - generic [ref=e139]: NOV
                      - generic [ref=e140]:
                        - paragraph [ref=e141]: Orga A (test)
                        - heading [level=3] [ref=e142]:
                          - link "Fumée — Concert des Parcelles 21.14.25" [ref=e143] [cursor=pointer]:
                            - /url: /events/acd0e5c1-e9d8-4d43-aab3-3369cb12f613
                    - generic [ref=e144]: Concerts & Musique
                    - list [ref=e147]:
                      - listitem [ref=e148]:
                        - generic [ref=e151]: 14 NOV 2026 à 23:15
                      - listitem [ref=e152]:
                        - generic [ref=e156]: Dakar · Esplanade des Parcelles Assainies
                    - generic [ref=e158]:
                      - paragraph [ref=e159]: À partir de
                      - paragraph [ref=e160]: 5 000 F CFA
              - listitem [ref=e164]:
                - article [ref=e165]:
                  - generic [ref=e167]:
                    - generic [ref=e168]:
                      - generic [aria-hidden] [ref=e169]:
                        - generic [ref=e170]: "15"
                        - generic [ref=e171]: NOV
                      - generic [ref=e172]:
                        - paragraph [ref=e173]: Baobab Scène
                        - heading [level=3] [ref=e174]:
                          - link "Concert des Lumières de Gorée" [ref=e175] [cursor=pointer]:
                            - /url: /events/a05e499f-7133-4857-b3fe-4b452b1bc11d
                    - generic [ref=e176]: Concerts & Musique
                    - list [ref=e179]:
                      - listitem [ref=e180]:
                        - generic [ref=e183]: 15 NOV 2026 à 17:00
                      - listitem [ref=e184]:
                        - generic [ref=e188]: Gorée · Place du Gouvernement
                    - generic [ref=e190]:
                      - paragraph [ref=e191]: À partir de
                      - paragraph [ref=e192]: 6 000 F CFA
              - listitem [ref=e196]:
                - article [ref=e197]:
                  - generic [ref=e199]:
                    - generic [ref=e200]:
                      - generic [aria-hidden] [ref=e201]:
                        - generic [ref=e202]: "15"
                        - generic [ref=e203]: NOV
                      - generic [ref=e204]:
                        - paragraph [ref=e205]: Orga A (test)
                        - heading [level=3] [ref=e206]:
                          - link "Terrain — fumee prolongee 21.14.45" [ref=e207] [cursor=pointer]:
                            - /url: /events/33b91fb0-de91-4a48-a3d0-2577efdcdd99
                    - generic [ref=e208]: Concerts & Musique
                    - list [ref=e211]:
                      - listitem [ref=e212]:
                        - generic [ref=e215]: 15 NOV 2026 à 17:15
                      - listitem [ref=e216]:
                        - generic [ref=e220]: Dakar · Esplanade des Parcelles Assainies
                    - generic [ref=e222]:
                      - paragraph [ref=e223]: À partir de
                      - paragraph [ref=e224]: 5 000 F CFA
              - listitem [ref=e228]:
                - article [ref=e229]:
                  - generic [ref=e231]:
                    - generic [ref=e232]:
                      - generic [aria-hidden] [ref=e233]:
                        - generic [ref=e234]: "15"
                        - generic [ref=e235]: NOV
                      - generic [ref=e236]:
                        - paragraph [ref=e237]: Orga A (test)
                        - heading [level=3] [ref=e238]:
                          - link "Terrain — écart +5 min 21.15.51" [ref=e239] [cursor=pointer]:
                            - /url: /events/d8a467dc-4755-4076-929a-4de08b9bfd1f
                    - generic [ref=e240]: Concerts & Musique
                    - list [ref=e243]:
                      - listitem [ref=e244]:
                        - generic [ref=e247]: 15 NOV 2026 à 17:15
                      - listitem [ref=e248]:
                        - generic [ref=e252]: Dakar · Esplanade des Parcelles Assainies
                    - generic [ref=e254]:
                      - paragraph [ref=e255]: À partir de
                      - paragraph [ref=e256]: Gratuit
              - listitem [ref=e260]:
                - article [ref=e261]:
                  - generic [ref=e263]:
                    - generic [ref=e264]:
                      - generic [aria-hidden] [ref=e265]:
                        - generic [ref=e266]: "15"
                        - generic [ref=e267]: NOV
                      - generic [ref=e268]:
                        - paragraph [ref=e269]: Orga A (test)
                        - heading [level=3] [ref=e270]:
                          - link "Terrain — mesure du scan 21.18.00" [ref=e271] [cursor=pointer]:
                            - /url: /events/190b2e4f-5583-44f6-be11-3bec6c9db963
                    - generic [ref=e272]: Concerts & Musique
                    - list [ref=e275]:
                      - listitem [ref=e276]:
                        - generic [ref=e279]: 15 NOV 2026 à 17:20
                      - listitem [ref=e280]:
                        - generic [ref=e284]: Dakar · Esplanade des Parcelles Assainies
                    - generic [ref=e286]:
                      - paragraph [ref=e287]: À partir de
                      - paragraph [ref=e288]: Gratuit
              - listitem [ref=e292]:
                - article [ref=e293]:
                  - generic [ref=e295]:
                    - generic [ref=e296]:
                      - generic [aria-hidden] [ref=e297]:
                        - generic [ref=e298]: "15"
                        - generic [ref=e299]: NOV
                      - generic [ref=e300]:
                        - paragraph [ref=e301]: Orga A (test)
                        - heading [level=3] [ref=e302]:
                          - link "Terrain — plein ecran 21.19.50" [ref=e303] [cursor=pointer]:
                            - /url: /events/1e702b82-5262-4c74-b209-34851c3b0a4c
                    - generic [ref=e304]: Concerts & Musique
                    - list [ref=e307]:
                      - listitem [ref=e308]:
                        - generic [ref=e311]: 15 NOV 2026 à 17:20
                      - listitem [ref=e312]:
                        - generic [ref=e316]: Dakar · Esplanade des Parcelles Assainies
                    - generic [ref=e318]:
                      - paragraph [ref=e319]: À partir de
                      - paragraph [ref=e320]: Gratuit
              - listitem [ref=e324]:
                - article [ref=e325]:
                  - generic [ref=e327]:
                    - generic [ref=e328]:
                      - generic [aria-hidden] [ref=e329]:
                        - generic [ref=e330]: "15"
                        - generic [ref=e331]: NOV
                      - generic [ref=e332]:
                        - paragraph [ref=e333]: Orga A (test)
                        - heading [level=3] [ref=e334]:
                          - link "Terrain — taille du lot 21.19.52" [ref=e335] [cursor=pointer]:
                            - /url: /events/4d011608-4622-4c98-973e-4f3f9d0c4e7a
                    - generic [ref=e336]: Concerts & Musique
                    - list [ref=e339]:
                      - listitem [ref=e340]:
                        - generic [ref=e343]: 15 NOV 2026 à 17:20
                      - listitem [ref=e344]:
                        - generic [ref=e348]: Dakar · Esplanade des Parcelles Assainies
                    - generic [ref=e350]:
                      - paragraph [ref=e351]: À partir de
                      - paragraph [ref=e352]: Gratuit
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
                        - generic [ref=e367]: "14"
                        - generic [ref=e368]: NOV
                      - generic [ref=e369]:
                        - paragraph [ref=e370]: Baobab Scène
                        - heading [level=3] [ref=e371]:
                          - link "Nuit du Sabar — édition d’automne" [ref=e372] [cursor=pointer]:
                            - /url: /events/96b46b91-1716-4ba7-9bd0-ab9ce1ef8f5f
                    - generic [ref=e373]: Concerts & Musique
                    - list [ref=e376]:
                      - listitem [ref=e377]:
                        - generic [ref=e380]: 14 NOV 2026 à 21:45
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
                        - generic [ref=e399]: "19"
                        - generic [ref=e400]: NOV
                      - generic [ref=e401]:
                        - paragraph [ref=e402]: Petite-Côte Événements
                        - heading [level=3] [ref=e403]:
                          - link "Marché gourmand de la Petite-Côte" [ref=e404] [cursor=pointer]:
                            - /url: /events/9f2e235a-c3fe-4611-9925-1a341879917e
                    - generic [ref=e405]: Gastronomie & Tables
                    - list [ref=e408]:
                      - listitem [ref=e409]:
                        - generic [ref=e412]: 19 NOV 2026 à 10:00
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
                        - generic [ref=e431]: "15"
                        - generic [ref=e432]: NOV
                      - generic [ref=e433]:
                        - paragraph [ref=e434]: Orga A (test)
                        - heading [level=3] [ref=e435]:
                          - link "Terrain — mesure du scan 21.18.00" [ref=e436] [cursor=pointer]:
                            - /url: /events/190b2e4f-5583-44f6-be11-3bec6c9db963
                    - generic [ref=e437]: Concerts & Musique
                    - list [ref=e440]:
                      - listitem [ref=e441]:
                        - generic [ref=e444]: 15 NOV 2026 à 17:20
                      - listitem [ref=e445]:
                        - generic [ref=e449]: Dakar · Esplanade des Parcelles Assainies
                    - generic [ref=e451]:
                      - paragraph [ref=e452]: À partir de
                      - paragraph [ref=e453]: Gratuit
              - listitem [ref=e457]:
                - article [ref=e458]:
                  - generic [ref=e460]:
                    - generic [ref=e461]:
                      - generic [aria-hidden] [ref=e462]:
                        - generic [ref=e463]: "26"
                        - generic [ref=e464]: NOV
                      - generic [ref=e465]:
                        - paragraph [ref=e466]: Baobab Scène
                        - heading [level=3] [ref=e467]:
                          - link "Festival Jazz sur le Fleuve" [ref=e468] [cursor=pointer]:
                            - /url: /events/83abdf63-6ab7-443b-ba05-6dea6ff69fe7
                    - generic [ref=e469]: Festivals
                    - list [ref=e472]:
                      - listitem [ref=e473]:
                        - generic [ref=e476]: 26 NOV 2026 à 18:00
                      - listitem [ref=e477]:
                        - generic [ref=e481]: Saint-Louis · Quai des Pêcheurs
                    - generic [ref=e483]:
                      - paragraph [ref=e484]: À partir de
                      - paragraph [ref=e485]: 7 500 F CFA
              - listitem [ref=e489]:
                - article [ref=e490]:
                  - generic [ref=e492]:
                    - generic [ref=e493]:
                      - generic [aria-hidden] [ref=e494]:
                        - generic [ref=e495]: "15"
                        - generic [ref=e496]: NOV
                      - generic [ref=e497]:
                        - paragraph [ref=e498]: Saloum Culture
                        - heading [level=3] [ref=e499]:
                          - link "Nuit du slam de Kaolack" [ref=e500] [cursor=pointer]:
                            - /url: /events/b1e9809a-0b4c-48de-80a5-e4608b196321
                    - generic [ref=e501]:
                      - generic [ref=e502]: Dernières places
                      - generic [ref=e504]: Concerts & Musique
                    - list [ref=e506]:
                      - listitem [ref=e507]:
                        - generic [ref=e510]: 15 NOV 2026 à 21:00
                      - listitem [ref=e511]:
                        - generic [ref=e515]: Kaolack · Centre culturel régional
                    - generic [ref=e517]:
                      - paragraph [ref=e518]: À partir de
                      - paragraph [ref=e519]: 3 000 F CFA
              - listitem [ref=e523]:
                - article [ref=e524]:
                  - generic [ref=e526]:
                    - generic [ref=e527]:
                      - generic [aria-hidden] [ref=e528]:
                        - generic [ref=e529]: "05"
                        - generic [ref=e530]: DÉC
                      - generic [ref=e531]:
                        - paragraph [ref=e532]: Saloum Culture
                        - heading [level=3] [ref=e533]:
                          - link "Gala des entrepreneurs du Saloum" [ref=e534] [cursor=pointer]:
                            - /url: /events/5c18633c-99c8-4d29-b21c-76b8b6aa102e
                    - generic [ref=e535]: Salles & Réceptions
                    - list [ref=e538]:
                      - listitem [ref=e539]:
                        - generic [ref=e542]: 05 DÉC 2026 à 19:30
                      - listitem [ref=e543]:
                        - generic [ref=e547]: Kaolack · Salle des Palétuviers
                    - generic [ref=e549]:
                      - paragraph [ref=e550]: À partir de
                      - paragraph [ref=e551]: 10 000 F CFA
              - listitem [ref=e555]:
                - article [ref=e556]:
                  - generic [ref=e558]:
                    - generic [ref=e559]:
                      - generic [aria-hidden] [ref=e560]:
                        - generic [ref=e561]: "15"
                        - generic [ref=e562]: NOV
                      - generic [ref=e563]:
                        - paragraph [ref=e564]: Baobab Scène
                        - heading [level=3] [ref=e565]:
                          - link "Concert des Lumières de Gorée" [ref=e566] [cursor=pointer]:
                            - /url: /events/a05e499f-7133-4857-b3fe-4b452b1bc11d
                    - generic [ref=e567]: Concerts & Musique
                    - list [ref=e570]:
                      - listitem [ref=e571]:
                        - generic [ref=e574]: 15 NOV 2026 à 17:00
                      - listitem [ref=e575]:
                        - generic [ref=e579]: Gorée · Place du Gouvernement
                    - generic [ref=e581]:
                      - paragraph [ref=e582]: À partir de
                      - paragraph [ref=e583]: 6 000 F CFA
              - listitem [ref=e587]:
                - article [ref=e588]:
                  - generic [ref=e590]:
                    - generic [ref=e591]:
                      - generic [aria-hidden] [ref=e592]:
                        - generic [ref=e593]: "14"
                        - generic [ref=e594]: DÉC
                      - generic [ref=e595]:
                        - paragraph [ref=e596]: Petite-Côte Événements
                        - heading [level=3] [ref=e597]:
                          - link "Carnaval des enfants de Saly" [ref=e598] [cursor=pointer]:
                            - /url: /events/4c003f55-e665-4494-97f3-3c8a3326367d
                    - generic [ref=e599]: Festivals
                    - list [ref=e602]:
                      - listitem [ref=e603]:
                        - generic [ref=e606]: 14 DÉC 2026 à 15:00
                      - listitem [ref=e607]:
                        - generic [ref=e611]: Saly · Promenade des Filaos
                    - generic [ref=e613]:
                      - paragraph [ref=e614]: À partir de
                      - paragraph [ref=e615]: 2 000 F CFA
              - listitem [ref=e619]:
                - article [ref=e620]:
                  - generic [ref=e622]:
                    - generic [ref=e623]:
                      - generic [aria-hidden] [ref=e624]:
                        - generic [ref=e625]: "22"
                        - generic [ref=e626]: NOV
                      - generic [ref=e627]:
                        - paragraph [ref=e628]: Saloum Culture
                        - heading [level=3] [ref=e629]:
                          - link "Dîner-spectacle au bord du Saloum" [ref=e630] [cursor=pointer]:
                            - /url: /events/67c31b89-4eb1-4e8b-a468-22054410e355
                    - generic [ref=e631]: Salles & Réceptions
                    - list [ref=e634]:
                      - listitem [ref=e635]:
                        - generic [ref=e638]: 22 NOV 2026 à 20:00
                      - listitem [ref=e639]:
                        - generic [ref=e643]: Foundiougne · Terrasse des Pirogues
                    - generic [ref=e645]:
                      - paragraph [ref=e646]: À partir de
                      - paragraph [ref=e647]: 25 000 F CFA
              - listitem [ref=e651]:
                - article [ref=e652]:
                  - generic [ref=e654]:
                    - generic [ref=e655]:
                      - generic [aria-hidden] [ref=e656]:
                        - generic [ref=e657]: "01"
                        - generic [ref=e658]: DÉC
                      - generic [ref=e659]:
                        - paragraph [ref=e660]: Baobab Scène
                        - heading [level=3] [ref=e661]:
                          - link "Soirée Kora & Lumières" [ref=e662] [cursor=pointer]:
                            - /url: /events/c82e4b37-a7b2-4c61-b4b5-cd413e445505
                    - generic [ref=e663]: Concerts & Musique
                    - list [ref=e666]:
                      - listitem [ref=e667]:
                        - generic [ref=e670]: 01 DÉC 2026 à 20:30
                      - listitem [ref=e671]:
                        - generic [ref=e675]: Dakar · Jardin de la Maison des Arts
                    - generic [ref=e677]:
                      - paragraph [ref=e678]: À partir de
                      - paragraph [ref=e679]: 6 000 F CFA
          - region [ref=e683]:
            - generic [ref=e684]:
              - generic [ref=e685]:
                - heading "Près de chez vous" [level=2] [ref=e686]
                - paragraph [ref=e687]: Les prochains événements dans votre ville.
              - generic [ref=e688]:
                - generic [ref=e689]: Votre ville
                - combobox "Votre ville" [ref=e692] [cursor=pointer]:
                  - option "Choisir une ville" [disabled] [selected]
                  - option "Dakar"
                  - option "Foundiougne"
                  - option "Gorée"
                  - option "Kaolack"
                  - option "Mbour"
                  - option "Saint-Louis"
                  - option "Saly"
                  - option "Ziguinchor"
            - generic [ref=e693]:
              - heading "Choisissez votre ville" [level=3] [ref=e698]
              - paragraph [ref=e699]: Les événements proches de chez vous apparaîtront ici. Votre choix est gardé pour vos prochaines visites.
          - region [ref=e700]:
            - generic [ref=e701]:
              - paragraph [ref=e702]: Espace organisateur
              - heading "Vous organisez des événements ? Vendez vos billets avec Event Village." [level=2] [ref=e703]
              - list [ref=e704]:
                - listitem [ref=e705]:
                  - generic [ref=e709]: Création et publication de vos événements, validées par notre équipe
                - listitem [ref=e710]:
                  - generic [ref=e714]: Ventes et entrées suivies en direct, contrôleurs et caisses sur place
                - listitem [ref=e715]:
                  - generic [ref=e719]: Fonds versés sur votre compte après l’événement
              - link "Devenir partenaire" [ref=e721] [cursor=pointer]:
                - /url: /partner/register
          - generic [ref=e726]:
            - generic [ref=e727]:
              - generic [ref=e728]:
                - paragraph [ref=e729]: Event Village
                - paragraph [ref=e730]: Billetterie et événements au Sénégal.
              - navigation "Liens du pied de page" [ref=e731]:
                - list [ref=e732]:
                  - listitem [ref=e733]:
                    - link "Explorer" [ref=e734] [cursor=pointer]:
                      - /url: /explore
                  - listitem [ref=e736]:
                    - link "Mes billets" [ref=e737] [cursor=pointer]:
                      - /url: /tickets
                  - listitem [ref=e739]:
                    - link "Devenir partenaire" [ref=e740] [cursor=pointer]:
                      - /url: /partner/register
            - paragraph [ref=e742]: Event Village, 2026. Tous droits réservés.
    - navigation "Navigation rapide" [ref=e743]:
      - generic [ref=e744]:
        - link "Accueil" [ref=e745] [cursor=pointer]:
          - /url: /
        - link "Explorer" [ref=e750] [cursor=pointer]:
          - /url: /explore
        - link "Billets" [ref=e755] [cursor=pointer]:
          - /url: /tickets
        - link "Portefeuille" [ref=e759] [cursor=pointer]:
          - /url: /wallet
  - alert [ref=e764]
```

# Test source

```ts
  103 |     await cdp.detach();
  104 |     return (out.installabilityErrors ?? []).map((e) => `${e.errorId}${e.errorArguments?.length ? ` (${e.errorArguments.map((a) => `${a.name}=${a.value}`).join(', ')})` : ''}`);
  105 | }
  106 | 
  107 | test.describe.configure({ mode: 'default' });
  108 | 
  109 | test('Chromium reconnaît l’application installable (beforeinstallprompt, aucune erreur d’installabilité)', async ({}, testInfo) => {
  110 |     const context = await persistentContext(testInfo, 'profil');
  111 |     try {
  112 |         const seen = observe(context);
  113 |         const page = context.pages()[0] ?? await context.newPage();
  114 |         await page.goto('/');
  115 |         await page.waitForFunction(() => ((window as unknown as { __evInstallPrompts?: number }).__evInstallPrompts ?? 0) > 0, null, { timeout: 15_000 })
  116 |             .catch((err: unknown) => {
  117 |                 throw new Error(`beforeinstallprompt jamais reçu en 15 s (${err instanceof Error ? err.message.split('\n')[0] : String(err)})`);
  118 |             });
  119 |         const errors = await installabilityErrors(context, page);
  120 |         console.log(`[e2e][pwa] Page.getInstallabilityErrors : ${errors.length === 0 ? 'aucune' : errors.join(' ; ')}`);
  121 |         expect(errors, 'Page.getInstallabilityErrors : liste vide attendue').toEqual([]);
  122 | 
  123 |         await expect.poll(() => seen.filter((r) => r.type === 'manifest' && r.path === '/manifest.json').map((r) => r.status), {
  124 |             message: 'manifest demandé par Chromium (type « manifest ») vers /manifest.json', timeout: 15_000,
  125 |         }).toContain(200);
  126 |         const manifest = await fetchFromPage(page, '/manifest.json', true);
  127 |         expect(manifest.status, 'manifest servi').toBe(200);
  128 |         const icons = (JSON.parse(manifest.text ?? '{}') as { icons?: ManifestIcon[] }).icons ?? [];
  129 |         expect(icons.length, 'icônes déclarées dans le manifest').toBeGreaterThan(0);
  130 |         const iconPaths = new Set(icons.map((i) => new URL(i.src, APP_URL).pathname));
  131 |         await expect.poll(() => seen.filter((r) => iconPaths.has(r.path) && r.status === 200).map((r) => r.path), {
  132 |             message: `au moins une icône déclarée demandée par Chromium et servie en 200 (${Array.from(iconPaths).join(', ')})`, timeout: 15_000,
  133 |         }).not.toEqual([]);
  134 |         for (const icon of icons) {
  135 |             const got = await fetchFromPage(page, icon.src, false);
  136 |             const size = pngSize(got.head);
  137 |             expect.soft({ src: icon.src, status: got.status, type: got.contentType.split(';')[0], size: size ? `${size.width}x${size.height}` : null },
  138 |                 `icône ${icon.src} servie sans session`).toEqual({ src: icon.src, status: 200, type: 'image/png', size: icon.sizes ?? null });
  139 |         }
  140 |         const failed = seen.filter((r) => r.status >= 400);
  141 |         expect(failed.map((r) => `${r.status} ${r.url}`), 'aucune réponse en erreur pendant le chargement de l’accueil').toEqual([]);
  142 |     } finally {
  143 |         await context.close();
  144 |     }
  145 | });
  146 | 
  147 | test('témoin négatif : manifest servi sans icône → Chromium signale l’icône manquante', async ({}, testInfo) => {
  148 |     const context = await persistentContext(testInfo, 'profil-temoin');
  149 |     try {
  150 |         await context.route('**/manifest.json', async (route) => {
  151 |             const original = await route.fetch();
  152 |             const body = (await original.json()) as Record<string, unknown>;
  153 |             delete body.icons;
  154 |             await route.fulfill({ status: 200, contentType: 'application/manifest+json', body: JSON.stringify(body) });
  155 |         });
  156 |         const page = context.pages()[0] ?? await context.newPage();
  157 |         await page.goto('/');
  158 |         await expect.poll(() => installabilityErrors(context, page), {
  159 |             message: 'manifest sans icône : manifest-missing-suitable-icon ou no-acceptable-icon attendu (sinon : headless shell, faux positif)', timeout: 15_000,
  160 |         }).toEqual(expect.arrayContaining([expect.stringMatching(/^(manifest-missing-suitable-icon|no-acceptable-icon)/)]));
  161 |     } finally {
  162 |         await context.close();
  163 |     }
  164 | });
  165 | 
  166 | test('manifest servi : id, scope, start_url, standalone, couleurs, icônes 192 et 512 dont une maskable (contrat 4.5)', async ({ page, guard }) => {
  167 |     await page.goto('/manifest.json');
  168 |     const got = await fetchFromPage(page, '/manifest.json', true);
  169 |     expect(got.status, 'manifest servi sans session').toBe(200);
  170 |     const m = JSON.parse(got.text ?? '{}') as Record<string, unknown> & { icons?: ManifestIcon[] };
  171 |     const scope = String(m.scope ?? '');
  172 |     expect.soft(m.id, 'id').toBe('/');
  173 |     expect.soft(scope, 'scope').toBe('/');
  174 |     expect.soft(String(m.start_url ?? '').startsWith(scope || '\u0000'), `start_url « ${String(m.start_url)} » dans le scope « ${scope} »`).toBe(true);
  175 |     expect.soft(m.display, 'display').toBe('standalone');
  176 |     expect.soft(String(m.theme_color ?? ''), 'theme_color #RRGGBB').toMatch(/^#[0-9A-Fa-f]{6}$/);
  177 |     expect.soft(String(m.background_color ?? ''), 'background_color #RRGGBB').toMatch(/^#[0-9A-Fa-f]{6}$/);
  178 |     const icons = m.icons ?? [];
  179 |     const purposeOf = (i: ManifestIcon) => (i.purpose ?? 'any').split(/\s+/);
  180 |     expect.soft(icons.some((i) => i.sizes === '192x192' && purposeOf(i).includes('any')), 'icône 192×192 « any »').toBe(true);
  181 |     expect.soft(icons.some((i) => i.sizes === '512x512' && purposeOf(i).includes('any')), 'icône 512×512 « any »').toBe(true);
  182 |     const maskable = icons.filter((i) => purposeOf(i).includes('maskable'));
  183 |     expect.soft(maskable.length, 'au moins une icône « maskable »').toBeGreaterThan(0);
  184 |     for (const icon of maskable) {
  185 |         const bytes = await fetchFromPage(page, icon.src, false);
  186 |         const size = pngSize(bytes.head);
  187 |         expect.soft({ status: bytes.status, type: bytes.contentType.split(';')[0], size: size ? `${size.width}x${size.height}` : null, colorType: size?.colorType ?? null },
  188 |             `icône maskable ${icon.src} : 200, PNG opaque (type de couleur 2), ${icon.sizes ?? '?'}`).toEqual({ status: 200, type: 'image/png', size: icon.sizes ?? null, colorType: 2 });
  189 |     }
  190 |     expect(guard.blockingIssues(), 'aucune erreur du navigateur').toEqual([]);
  191 | });
  192 | 
  193 | test('iPhone : balises apple-mobile-web-app et icône apple-touch 180×180 dans le <head> de l’accueil', async ({ page, guard }) => {
  194 |     await page.goto('/');
  195 |     const head = await page.evaluate(() => ({
  196 |         appleIcons: Array.from(document.querySelectorAll('link[rel="apple-touch-icon"]')).map((l) => l.getAttribute('href') ?? ''),
  197 |         capable: Array.from(document.querySelectorAll('meta[name="apple-mobile-web-app-capable"]')).map((m) => m.getAttribute('content') ?? ''),
  198 |         title: Array.from(document.querySelectorAll('meta[name="apple-mobile-web-app-title"]')).map((m) => m.getAttribute('content') ?? ''),
  199 |         manifests: Array.from(document.querySelectorAll('link[rel="manifest"]')).map((l) => l.getAttribute('href') ?? ''),
  200 |     }));
  201 |     console.log(`[e2e][pwa] <head> : ${JSON.stringify(head)}`);
  202 |     expect.soft(head.appleIcons.length, `exactement un link[rel=apple-touch-icon] (trouvés : ${JSON.stringify(head.appleIcons)})`).toBe(1);
> 203 |     expect.soft(head.capable, 'meta apple-mobile-web-app-capable = yes').toEqual(['yes']);
      |                                                                          ^ Error: meta apple-mobile-web-app-capable = yes
  204 |     expect.soft(head.title.length === 1 && head.title[0].trim().length > 0, `meta apple-mobile-web-app-title renseignée (${JSON.stringify(head.title)})`).toBe(true);
  205 |     expect.soft(head.manifests, 'link[rel=manifest] vers /manifest.json').toEqual(['/manifest.json']);
  206 |     for (const href of head.appleIcons) {
  207 |         const bytes = await fetchFromPage(page, href, false);
  208 |         const size = pngSize(bytes.head);
  209 |         expect.soft({ href, status: bytes.status, type: bytes.contentType.split(';')[0], size: size ? `${size.width}x${size.height}` : null },
  210 |             `icône apple-touch ${href}`).toEqual({ href, status: 200, type: 'image/png', size: '180x180' });
  211 |     }
  212 |     expect(guard.blockingIssues(), 'aucune erreur du navigateur').toEqual([]);
  213 | });
  214 | 
```