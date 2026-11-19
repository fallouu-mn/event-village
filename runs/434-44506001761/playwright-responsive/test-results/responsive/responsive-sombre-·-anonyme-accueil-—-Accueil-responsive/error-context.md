# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> sombre · anonyme >> accueil — Accueil
- Location: e2e/responsive.spec.ts:69:21

# Error details

```
Error: contrôles responsive de accueil (sombre)

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 8

- Array []
+ Array [
+   "360 px : texte tronqué sans le texte entier : span.truncate « Dakar · Esplanade de la Corniche Ouest » (points de suspension, texte entier absent) ; span.truncate « Mbour · Place du Marché Central » (points de suspension, texte entier absent) ; span.truncate « Kaolack · Centre culturel régional » (points de suspension, texte entier absent) ; span.truncate « Saint-Louis · Quai des Pêcheurs » (points de suspension, texte entier absent) ; span.truncate « Kaolack · Salle des Palétuviers » (points de suspension, texte entier absent) ; span.truncate « Gorée · Place du Gouvernement » (points de suspension, texte entier absent) ; span.truncate « Saly · Promenade des Filaos » (points de suspension, texte entier absent) ; span.truncate « Foundiougne · Terrasse des Pirogues » (points de suspension, texte entier absent) ; span.truncate « Dakar · Jardin de la Maison des Arts » (points de suspension, texte entier absent) ; span.truncate « Dakar · Esplanade de la Corniche Ouest » (points de suspension, texte entier absent) ; span.truncate « Gorée · Place du Gouvernement » (points de suspension, texte entier absent) ; span.truncate « Kaolack · Centre culturel régional » (points de suspension, texte entier absent)",
+   "360 px : textes qui se chevauchent : span.truncate « Foundiougne · Terrasse des Pirogues » sur span « Concerts & Musique » (10×12 px)",
+   "768 px : texte tronqué sans le texte entier : span.truncate « Foundiougne · Terrasse des Pirogues » (points de suspension, texte entier absent) ; span.truncate « Dakar · Jardin de la Maison des Arts » (points de suspension, texte entier absent)",
+   "768 px : textes qui se chevauchent : span.hidden.whitespace-nowrap « Event Village » sur span.truncate « Rechercher un événement, un concert, un restaurant » (46×18 px)",
+   "1440 px : texte tronqué sans le texte entier : span.truncate « Mbour · Place du Marché Central » (points de suspension, texte entier absent) ; span.truncate « Kaolack · Centre culturel régional » (points de suspension, texte entier absent) ; span.truncate « Saint-Louis · Quai des Pêcheurs » (points de suspension, texte entier absent) ; span.truncate « Gorée · Place du Gouvernement » (points de suspension, texte entier absent) ; span.truncate « Foundiougne · Terrasse des Pirogues » (points de suspension, texte entier absent) ; span.truncate « Dakar · Jardin de la Maison des Arts » (points de suspension, texte entier absent) ; span.truncate « Dakar · Esplanade de la Corniche Ouest » (points de suspension, texte entier absent) ; span.truncate « Gorée · Place du Gouvernement » (points de suspension, texte entier absent) ; span.truncate « Kaolack · Centre culturel régional » (points de suspension, texte entier absent) ; span.truncate « Mbour · Place du Marché Central » (points de suspension, texte entier absent) ; span.truncate « Dakar · Esplanade de la Corniche Ouest » (points de suspension, texte entier absent) ; span.truncate « Gorée · Place du Gouvernement » (points de suspension, texte entier absent)",
+   "1440 px : textes qui se chevauchent : h2.text-xl.font-bold « Près de chez vous » sur h3.text-lg.font-bold « Festivals » (74×13 px) ; h3.text-lg.font-bold « Festivals » sur p.text-sm.text-muted-foreground « Les prochains événements dans votre ville. » (74×4 px) ; p.mb-5.max-w-sm « Les événements proches de chez vous apparaîtront i » sur p.truncate.text-sm « Petite-Côte Événements » (88×14 px) ; span.whitespace-nowrap.text-base « 7 500 F CFA » sur p.text-base.font-semibold « Wave et Orange Money » (71×9 px) ; span.truncate.text-sm « Dès » sur p.text-base.font-semibold « QR code dynamique » (26×8 px) ; h2.text-xl.font-bold « Parrainez vos proches » sur p.truncate.text-sm « Saloum Culture » (27×10 px) ; p.max-w-2xl.text-base « Partagez votre lien de parrainage : vous recevez 5 » sur a.rounded-sm « Dîner-spectacle au bord du Saloum » (131×14 px) ; p.max-w-2xl.text-base « Partagez votre lien de parrainage : vous recevez 5 » sur a.rounded-sm « Gala des entrepreneurs du Saloum » (171×14 px) ; strong.tabular-nums.text-foreground-strong « 5 % » sur a.rounded-sm « Gala des entrepreneurs du Saloum » (27×14 px) ; a.rounded-sm « Dîner-spectacle au bord du Saloum » sur p.max-w-2xl.text-base « Partagez votre lien de parrainage : vous recevez 5 » (131×4 px) ; a.rounded-sm « Gala des entrepreneurs du Saloum » sur p.max-w-2xl.text-base « Partagez votre lien de parrainage : vous recevez 5 » (95×4 px) ; a.rounded-sm « Gala des entrepreneurs du Saloum » sur strong.tabular-nums.text-foreground-strong « 12 mois » (20×4 px)",
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
          - paragraph [ref=f2e11]: Menu principal
          - generic [ref=f2e12]:
            - link "Accueil" [ref=f2e13] [cursor=pointer]:
              - /url: /
            - link "Explorer" [ref=f2e18] [cursor=pointer]:
              - /url: /explore
            - link "Mes billets" [ref=f2e23] [cursor=pointer]:
              - /url: /tickets
            - link "Portefeuille" [ref=f2e27] [cursor=pointer]:
              - /url: /wallet
        - generic [ref=f2e32]:
          - paragraph [ref=f2e33]: Espaces métier
          - link "Devenir partenaire" [ref=f2e35] [cursor=pointer]:
            - /url: /partner/register
      - generic [ref=f2e41]:
        - link "Se connecter" [ref=f2e42] [cursor=pointer]:
          - /url: /login
        - button "Basculer le thème" [pressed] [ref=f2e48] [cursor=pointer]
    - generic [ref=f2e56]:
      - banner [ref=f2e57]:
        - link "Rechercher un événement, un concert, un restaurant…" [ref=f2e59] [cursor=pointer]:
          - /url: /explore
        - button "Notifications" [ref=f2e66] [cursor=pointer]
      - main [ref=f2e70]:
        - generic [ref=f2e72]:
          - region [ref=f2e73]:
            - heading "Vos prochaines sorties au Sénégal" [level=1] [ref=f2e74]
            - paragraph [ref=f2e75]: "Concerts, festivals, soirées et rencontres : choisissez votre place, payez avec Wave ou Orange Money et présentez votre billet à l’entrée."
            - search [ref=f2e76]:
              - generic [ref=f2e77]: Rechercher un événement
              - searchbox "Rechercher un événement" [ref=f2e79]
              - button "Rechercher" [ref=f2e80] [cursor=pointer]
            - navigation "Raccourcis" [ref=f2e81]:
              - list [ref=f2e82]:
                - listitem [ref=f2e83]:
                  - link "Aujourd’hui" [ref=f2e84] [cursor=pointer]:
                    - /url: /explore?quand=aujourdhui
                - listitem [ref=f2e85]:
                  - link "Ce week-end" [ref=f2e86] [cursor=pointer]:
                    - /url: /explore?quand=weekend
                - listitem [ref=f2e87]:
                  - link "Cette semaine" [ref=f2e88] [cursor=pointer]:
                    - /url: /explore?quand=semaine
                - listitem [ref=f2e89]:
                  - link "Gratuit" [ref=f2e90] [cursor=pointer]:
                    - /url: /explore?gratuit=1
          - region [ref=f2e91]:
            - generic [ref=f2e92]:
              - generic [ref=f2e93]:
                - heading "Populaires" [level=2] [ref=f2e94]
                - paragraph [ref=f2e95]: Les événements les plus demandés des 7 derniers jours.
                - status [ref=f2e96]: En direct
              - link "Tout voir" [ref=f2e98] [cursor=pointer]:
                - /url: /explore
            - list [ref=f2e101]:
              - listitem [ref=f2e102]:
                - article [ref=f2e103]:
                  - generic [ref=f2e104]:
                    - generic: En cours
                    - generic [aria-hidden] [ref=f2e105]:
                      - generic [ref=f2e106]: "19"
                      - generic [ref=f2e107]: NOV
                  - generic [ref=f2e108]:
                    - paragraph [ref=f2e109]: Baobab Scène
                    - heading [level=3] [ref=f2e110]:
                      - link "Nuit du Sabar — édition d’automne" [ref=f2e111] [cursor=pointer]:
                        - /url: /events/1b6b9b15-31a6-41c3-856d-f27700d91f21
                    - paragraph [ref=f2e112]:
                      - generic [ref=f2e115]: jeu. 19 nov. · 11:30
                    - paragraph [ref=f2e116]:
                      - generic [ref=f2e120]: Dakar · Esplanade de la Corniche Ouest
                    - generic [ref=f2e121]: Concerts & Musique
                    - paragraph [ref=f2e124]:
                      - generic [ref=f2e125]: Dès
                      - generic [ref=f2e126]: 5 000 F CFA
              - listitem [ref=f2e127]:
                - article [ref=f2e128]:
                  - generic [ref=f2e129]:
                    - generic: En cours
                    - generic [aria-hidden] [ref=f2e130]:
                      - generic [ref=f2e131]: "24"
                      - generic [ref=f2e132]: NOV
                  - generic [ref=f2e133]:
                    - paragraph [ref=f2e134]: Petite-Côte Événements
                    - heading [level=3] [ref=f2e135]:
                      - link "Marché gourmand de la Petite-Côte" [ref=f2e136] [cursor=pointer]:
                        - /url: /events/443f461a-20fa-48ca-8fb2-0e78e955a227
                    - paragraph [ref=f2e137]:
                      - generic [ref=f2e140]: mar. 24 nov. · 10:00
                    - paragraph [ref=f2e141]:
                      - generic [ref=f2e145]: Mbour · Place du Marché Central
                    - generic [ref=f2e146]: Gastronomie & Tables
                    - paragraph [ref=f2e149]:
                      - generic [ref=f2e150]: Dès
                      - generic [ref=f2e151]: 1 000 F CFA
              - listitem [ref=f2e152]:
                - article [ref=f2e153]:
                  - generic [ref=f2e154]:
                    - generic: En cours
                    - generic [aria-hidden] [ref=f2e155]:
                      - generic [ref=f2e156]: "20"
                      - generic [ref=f2e157]: NOV
                  - generic [ref=f2e158]:
                    - paragraph [ref=f2e159]: Saloum Culture
                    - heading [level=3] [ref=f2e160]:
                      - link "Nuit du slam de Kaolack" [ref=f2e161] [cursor=pointer]:
                        - /url: /events/3a49764e-0398-4710-9551-0d00aeb9d709
                    - paragraph [ref=f2e162]:
                      - generic [ref=f2e165]: ven. 20 nov. · 21:00
                    - paragraph [ref=f2e166]:
                      - generic [ref=f2e170]: Kaolack · Centre culturel régional
                    - generic [ref=f2e171]:
                      - generic [ref=f2e172]: Dernières places
                      - generic [ref=f2e174]: Concerts & Musique
                    - paragraph [ref=f2e176]:
                      - generic [ref=f2e177]: Dès
                      - generic [ref=f2e178]: 3 000 F CFA
              - listitem [ref=f2e179]:
                - article [ref=f2e180]:
                  - generic [ref=f2e181]:
                    - generic: En cours
                    - generic [aria-hidden] [ref=f2e182]:
                      - generic [ref=f2e183]: "01"
                      - generic [ref=f2e184]: DÉC
                  - generic [ref=f2e185]:
                    - paragraph [ref=f2e186]: Baobab Scène
                    - heading [level=3] [ref=f2e187]:
                      - link "Festival Jazz sur le Fleuve" [ref=f2e188] [cursor=pointer]:
                        - /url: /events/cbf928d9-6a7a-4bcf-822d-29f5e71c0fbe
                    - paragraph [ref=f2e189]:
                      - generic [ref=f2e192]: mar. 1 déc. · 18:00
                    - paragraph [ref=f2e193]:
                      - generic [ref=f2e197]: Saint-Louis · Quai des Pêcheurs
                    - generic [ref=f2e198]: Festivals
                    - paragraph [ref=f2e201]:
                      - generic [ref=f2e202]: Dès
                      - generic [ref=f2e203]: 7 500 F CFA
              - listitem [ref=f2e204]:
                - article [ref=f2e205]:
                  - generic [ref=f2e206]:
                    - generic: En cours
                    - generic [aria-hidden] [ref=f2e207]:
                      - generic [ref=f2e208]: "10"
                      - generic [ref=f2e209]: DÉC
                  - generic [ref=f2e210]:
                    - paragraph [ref=f2e211]: Saloum Culture
                    - heading [level=3] [ref=f2e212]:
                      - link "Gala des entrepreneurs du Saloum" [ref=f2e213] [cursor=pointer]:
                        - /url: /events/7ca533ac-74ae-4832-9915-bd2e9b953dba
                    - paragraph [ref=f2e214]:
                      - generic [ref=f2e217]: jeu. 10 déc. · 19:30
                    - paragraph [ref=f2e218]:
                      - generic [ref=f2e222]: Kaolack · Salle des Palétuviers
                    - generic [ref=f2e223]: Salles & Réceptions
                    - paragraph [ref=f2e226]:
                      - generic [ref=f2e227]: Dès
                      - generic [ref=f2e228]: 10 000 F CFA
              - listitem [ref=f2e229]:
                - article [ref=f2e230]:
                  - generic [ref=f2e231]:
                    - generic: En cours
                    - generic [aria-hidden] [ref=f2e232]:
                      - generic [ref=f2e233]: "20"
                      - generic [ref=f2e234]: NOV
                  - generic [ref=f2e235]:
                    - paragraph [ref=f2e236]: Baobab Scène
                    - heading [level=3] [ref=f2e237]:
                      - link "Concert des Lumières de Gorée" [ref=f2e238] [cursor=pointer]:
                        - /url: /events/3e0f741a-d31d-4cde-af85-7cca6884a434
                    - paragraph [ref=f2e239]:
                      - generic [ref=f2e242]: ven. 20 nov. · 06:45
                    - paragraph [ref=f2e243]:
                      - generic [ref=f2e247]: Gorée · Place du Gouvernement
                    - generic [ref=f2e248]: Concerts & Musique
                    - paragraph [ref=f2e251]:
                      - generic [ref=f2e252]: Dès
                      - generic [ref=f2e253]: 6 000 F CFA
              - listitem [ref=f2e254]:
                - article [ref=f2e255]:
                  - generic [ref=f2e256]:
                    - generic: En cours
                    - generic [aria-hidden] [ref=f2e257]:
                      - generic [ref=f2e258]: "19"
                      - generic [ref=f2e259]: DÉC
                  - generic [ref=f2e260]:
                    - paragraph [ref=f2e261]: Petite-Côte Événements
                    - heading [level=3] [ref=f2e262]:
                      - link "Carnaval des enfants de Saly" [ref=f2e263] [cursor=pointer]:
                        - /url: /events/bcfd2b46-6d47-44f0-be8a-df3ed43885b3
                    - paragraph [ref=f2e264]:
                      - generic [ref=f2e267]: sam. 19 déc. · 15:00
                    - paragraph [ref=f2e268]:
                      - generic [ref=f2e272]: Saly · Promenade des Filaos
                    - generic [ref=f2e273]: Festivals
                    - paragraph [ref=f2e276]:
                      - generic [ref=f2e277]: Dès
                      - generic [ref=f2e278]: 2 000 F CFA
              - listitem [ref=f2e279]:
                - article [ref=f2e280]:
                  - generic [ref=f2e281]:
                    - generic: En cours
                    - generic [aria-hidden] [ref=f2e282]:
                      - generic [ref=f2e283]: "27"
                      - generic [ref=f2e284]: NOV
                  - generic [ref=f2e285]:
                    - paragraph [ref=f2e286]: Saloum Culture
                    - heading [level=3] [ref=f2e287]:
                      - link "Dîner-spectacle au bord du Saloum" [ref=f2e288] [cursor=pointer]:
                        - /url: /events/2aec4c3d-87ae-459b-bdeb-3592df1949ae
                    - paragraph [ref=f2e289]:
                      - generic [ref=f2e292]: ven. 27 nov. · 20:00
                    - paragraph [ref=f2e293]:
                      - generic [ref=f2e297]: Foundiougne · Terrasse des Pirogues
                    - generic [ref=f2e298]: Salles & Réceptions
                    - paragraph [ref=f2e301]:
                      - generic [ref=f2e302]: Dès
                      - generic [ref=f2e303]: 25 000 F CFA
              - listitem [ref=f2e304]:
                - article [ref=f2e305]:
                  - generic [ref=f2e306]:
                    - generic: En cours
                    - generic [aria-hidden] [ref=f2e307]:
                      - generic [ref=f2e308]: "06"
                      - generic [ref=f2e309]: DÉC
                  - generic [ref=f2e310]:
                    - paragraph [ref=f2e311]: Baobab Scène
                    - heading [level=3] [ref=f2e312]:
                      - link "Soirée Kora & Lumières" [ref=f2e313] [cursor=pointer]:
                        - /url: /events/51729819-f190-4aed-8679-5f33482543fa
                    - paragraph [ref=f2e314]:
                      - generic [ref=f2e317]: dim. 6 déc. · 20:30
                    - paragraph [ref=f2e318]:
                      - generic [ref=f2e322]: Dakar · Jardin de la Maison des Arts
                    - generic [ref=f2e323]: Concerts & Musique
                    - paragraph [ref=f2e326]:
                      - generic [ref=f2e327]: Dès
                      - generic [ref=f2e328]: 6 000 F CFA
          - region [ref=f2e329]:
            - generic [ref=f2e330]:
              - generic [ref=f2e331]:
                - heading "Cette semaine" [level=2] [ref=f2e332]
                - paragraph [ref=f2e333]: Aujourd’hui et les six prochains jours.
              - link "Tout voir (4)" [ref=f2e334] [cursor=pointer]:
                - /url: /explore?quand=semaine
            - list [ref=f2e337]:
              - listitem [ref=f2e338]:
                - article [ref=f2e339]:
                  - generic [ref=f2e340]:
                    - generic: En cours
                    - generic [aria-hidden] [ref=f2e341]:
                      - generic [ref=f2e342]: "19"
                      - generic [ref=f2e343]: NOV
                  - generic [ref=f2e344]:
                    - paragraph [ref=f2e345]: Baobab Scène
                    - heading [level=3] [ref=f2e346]:
                      - link "Nuit du Sabar — édition d’automne" [ref=f2e347] [cursor=pointer]:
                        - /url: /events/1b6b9b15-31a6-41c3-856d-f27700d91f21
                    - paragraph [ref=f2e348]:
                      - generic [ref=f2e351]: jeu. 19 nov. · 11:30
                    - paragraph [ref=f2e352]:
                      - generic [ref=f2e356]: Dakar · Esplanade de la Corniche Ouest
                    - generic [ref=f2e357]: Concerts & Musique
                    - paragraph [ref=f2e360]:
                      - generic [ref=f2e361]: Dès
                      - generic [ref=f2e362]: 5 000 F CFA
              - listitem [ref=f2e363]:
                - article [ref=f2e364]:
                  - generic [ref=f2e365]:
                    - generic: En cours
                    - generic [aria-hidden] [ref=f2e366]:
                      - generic [ref=f2e367]: "20"
                      - generic [ref=f2e368]: NOV
                  - generic [ref=f2e369]:
                    - paragraph [ref=f2e370]: Baobab Scène
                    - heading [level=3] [ref=f2e371]:
                      - link "Concert des Lumières de Gorée" [ref=f2e372] [cursor=pointer]:
                        - /url: /events/3e0f741a-d31d-4cde-af85-7cca6884a434
                    - paragraph [ref=f2e373]:
                      - generic [ref=f2e376]: ven. 20 nov. · 06:45
                    - paragraph [ref=f2e377]:
                      - generic [ref=f2e381]: Gorée · Place du Gouvernement
                    - generic [ref=f2e382]: Concerts & Musique
                    - paragraph [ref=f2e385]:
                      - generic [ref=f2e386]: Dès
                      - generic [ref=f2e387]: 6 000 F CFA
              - listitem [ref=f2e388]:
                - article [ref=f2e389]:
                  - generic [ref=f2e390]:
                    - generic: En cours
                    - generic [aria-hidden] [ref=f2e391]:
                      - generic [ref=f2e392]: "20"
                      - generic [ref=f2e393]: NOV
                  - generic [ref=f2e394]:
                    - paragraph [ref=f2e395]: Saloum Culture
                    - heading [level=3] [ref=f2e396]:
                      - link "Nuit du slam de Kaolack" [ref=f2e397] [cursor=pointer]:
                        - /url: /events/3a49764e-0398-4710-9551-0d00aeb9d709
                    - paragraph [ref=f2e398]:
                      - generic [ref=f2e401]: ven. 20 nov. · 21:00
                    - paragraph [ref=f2e402]:
                      - generic [ref=f2e406]: Kaolack · Centre culturel régional
                    - generic [ref=f2e407]:
                      - generic [ref=f2e408]: Dernières places
                      - generic [ref=f2e410]: Concerts & Musique
                    - paragraph [ref=f2e412]:
                      - generic [ref=f2e413]: Dès
                      - generic [ref=f2e414]: 3 000 F CFA
              - listitem [ref=f2e415]:
                - article [ref=f2e416]:
                  - generic [ref=f2e417]:
                    - generic: En cours
                    - generic [aria-hidden] [ref=f2e418]:
                      - generic [ref=f2e419]: "24"
                      - generic [ref=f2e420]: NOV
                  - generic [ref=f2e421]:
                    - paragraph [ref=f2e422]: Petite-Côte Événements
                    - heading [level=3] [ref=f2e423]:
                      - link "Marché gourmand de la Petite-Côte" [ref=f2e424] [cursor=pointer]:
                        - /url: /events/443f461a-20fa-48ca-8fb2-0e78e955a227
                    - paragraph [ref=f2e425]:
                      - generic [ref=f2e428]: mar. 24 nov. · 10:00
                    - paragraph [ref=f2e429]:
                      - generic [ref=f2e433]: Mbour · Place du Marché Central
                    - generic [ref=f2e434]: Gastronomie & Tables
                    - paragraph [ref=f2e437]:
                      - generic [ref=f2e438]: Dès
                      - generic [ref=f2e439]: 1 000 F CFA
          - region [ref=f2e440]:
            - generic [ref=f2e441]:
              - heading "Par catégorie" [level=2] [ref=f2e442]
              - list [ref=f2e443]:
                - listitem [ref=f2e444]:
                  - link "Concerts & Musique 6" [ref=f2e445] [cursor=pointer]:
                    - /url: /explore?categorie=CONCERT
                    - text: Concerts & Musique
                    - generic [ref=f2e446]: "6"
                - listitem [ref=f2e447]:
                  - link "Festivals 3" [ref=f2e448] [cursor=pointer]:
                    - /url: /explore?categorie=FESTIVAL
                    - text: Festivals
                    - generic [ref=f2e449]: "3"
                - listitem [ref=f2e450]:
                  - link "Gastronomie & Tables 1" [ref=f2e451] [cursor=pointer]:
                    - /url: /explore?categorie=FOOD
                    - text: Gastronomie & Tables
                    - generic [ref=f2e452]: "1"
                - listitem [ref=f2e453]:
                  - link "Salles & Réceptions 2" [ref=f2e454] [cursor=pointer]:
                    - /url: /explore?categorie=SALLE
                    - text: Salles & Réceptions
                    - generic [ref=f2e455]: "2"
            - generic [ref=f2e456]:
              - generic [ref=f2e457]:
                - heading "Concerts & Musique" [level=3] [ref=f2e458]
                - 'link "Tout voir : Concerts & Musique" [ref=f2e459] [cursor=pointer]':
                  - /url: /explore?categorie=CONCERT
                  - text: Tout voir
              - list [ref=f2e462]:
                - listitem [ref=f2e463]:
                  - article [ref=f2e464]:
                    - generic [ref=f2e465]:
                      - generic: En cours
                      - generic [aria-hidden] [ref=f2e466]:
                        - generic [ref=f2e467]: "19"
                        - generic [ref=f2e468]: NOV
                    - generic [ref=f2e469]:
                      - paragraph [ref=f2e470]: Baobab Scène
                      - heading [level=3] [ref=f2e471]:
                        - link "Nuit du Sabar — édition d’automne" [ref=f2e472] [cursor=pointer]:
                          - /url: /events/1b6b9b15-31a6-41c3-856d-f27700d91f21
                      - paragraph [ref=f2e473]:
                        - generic [ref=f2e476]: jeu. 19 nov. · 11:30
                      - paragraph [ref=f2e477]:
                        - generic [ref=f2e481]: Dakar · Esplanade de la Corniche Ouest
                      - generic [ref=f2e482]: Concerts & Musique
                      - paragraph [ref=f2e485]:
                        - generic [ref=f2e486]: Dès
                        - generic [ref=f2e487]: 5 000 F CFA
                - listitem [ref=f2e488]:
                  - article [ref=f2e489]:
                    - generic [ref=f2e490]:
                      - generic: En cours
                      - generic [aria-hidden] [ref=f2e491]:
                        - generic [ref=f2e492]: "20"
                        - generic [ref=f2e493]: NOV
                    - generic [ref=f2e494]:
                      - paragraph [ref=f2e495]: Baobab Scène
                      - heading [level=3] [ref=f2e496]:
                        - link "Concert des Lumières de Gorée" [ref=f2e497] [cursor=pointer]:
                          - /url: /events/3e0f741a-d31d-4cde-af85-7cca6884a434
                      - paragraph [ref=f2e498]:
                        - generic [ref=f2e501]: ven. 20 nov. · 06:45
                      - paragraph [ref=f2e502]:
                        - generic [ref=f2e506]: Gorée · Place du Gouvernement
                      - generic [ref=f2e507]: Concerts & Musique
                      - paragraph [ref=f2e510]:
                        - generic [ref=f2e511]: Dès
                        - generic [ref=f2e512]: 6 000 F CFA
                - listitem [ref=f2e513]:
                  - article [ref=f2e514]:
                    - generic [ref=f2e515]:
                      - generic: En cours
                      - generic [aria-hidden] [ref=f2e516]:
                        - generic [ref=f2e517]: "20"
                        - generic [ref=f2e518]: NOV
                    - generic [ref=f2e519]:
                      - paragraph [ref=f2e520]: Saloum Culture
                      - heading [level=3] [ref=f2e521]:
                        - link "Nuit du slam de Kaolack" [ref=f2e522] [cursor=pointer]:
                          - /url: /events/3a49764e-0398-4710-9551-0d00aeb9d709
                      - paragraph [ref=f2e523]:
                        - generic [ref=f2e526]: ven. 20 nov. · 21:00
                      - paragraph [ref=f2e527]:
                        - generic [ref=f2e531]: Kaolack · Centre culturel régional
                      - generic [ref=f2e532]:
                        - generic [ref=f2e533]: Dernières places
                        - generic [ref=f2e535]: Concerts & Musique
                      - paragraph [ref=f2e537]:
                        - generic [ref=f2e538]: Dès
                        - generic [ref=f2e539]: 3 000 F CFA
                - listitem [ref=f2e540]:
                  - article [ref=f2e541]:
                    - generic [ref=f2e542]:
                      - generic: En cours
                      - generic [aria-hidden] [ref=f2e543]:
                        - generic [ref=f2e544]: "06"
                        - generic [ref=f2e545]: DÉC
                    - generic [ref=f2e546]:
                      - paragraph [ref=f2e547]: Baobab Scène
                      - heading [level=3] [ref=f2e548]:
                        - link "Soirée Kora & Lumières" [ref=f2e549] [cursor=pointer]:
                          - /url: /events/51729819-f190-4aed-8679-5f33482543fa
                      - paragraph [ref=f2e550]:
                        - generic [ref=f2e553]: dim. 6 déc. · 20:30
                      - paragraph [ref=f2e554]:
                        - generic [ref=f2e558]: Dakar · Jardin de la Maison des Arts
                      - generic [ref=f2e559]: Concerts & Musique
                      - paragraph [ref=f2e562]:
                        - generic [ref=f2e563]: Dès
                        - generic [ref=f2e564]: 6 000 F CFA
            - generic [ref=f2e565]:
              - generic [ref=f2e566]:
                - heading "Festivals" [level=3] [ref=f2e567]
                - 'link "Tout voir : Festivals" [ref=f2e568] [cursor=pointer]':
                  - /url: /explore?categorie=FESTIVAL
                  - text: Tout voir
              - list [ref=f2e571]:
                - listitem [ref=f2e572]:
                  - article [ref=f2e573]:
                    - generic [ref=f2e574]:
                      - generic: En cours
                      - generic [aria-hidden] [ref=f2e575]:
                        - generic [ref=f2e576]: "01"
                        - generic [ref=f2e577]: DÉC
                    - generic [ref=f2e578]:
                      - paragraph [ref=f2e579]: Baobab Scène
                      - heading [level=3] [ref=f2e580]:
                        - link "Festival Jazz sur le Fleuve" [ref=f2e581] [cursor=pointer]:
                          - /url: /events/cbf928d9-6a7a-4bcf-822d-29f5e71c0fbe
                      - paragraph [ref=f2e582]:
                        - generic [ref=f2e585]: mar. 1 déc. · 18:00
                      - paragraph [ref=f2e586]:
                        - generic [ref=f2e590]: Saint-Louis · Quai des Pêcheurs
                      - generic [ref=f2e591]: Festivals
                      - paragraph [ref=f2e594]:
                        - generic [ref=f2e595]: Dès
                        - generic [ref=f2e596]: 7 500 F CFA
                - listitem [ref=f2e597]:
                  - article [ref=f2e598]:
                    - generic [ref=f2e599]:
                      - generic: En cours
                      - generic [aria-hidden] [ref=f2e600]:
                        - generic [ref=f2e601]: "15"
                        - generic [ref=f2e602]: DÉC
                    - generic [ref=f2e603]:
                      - paragraph [ref=f2e604]: Petite-Côte Événements
                      - heading [level=3] [ref=f2e605]:
                        - link "Festival des rythmes de Casamance" [ref=f2e606] [cursor=pointer]:
                          - /url: /events/cc1135a5-96d5-4d4d-ac8f-0ff8c6cf3ce6
                      - paragraph [ref=f2e607]:
                        - generic [ref=f2e610]: mar. 15 déc. · 17:00
                      - paragraph [ref=f2e611]:
                        - generic [ref=f2e615]: Ziguinchor · Esplanade du Port
                      - generic [ref=f2e616]: Festivals
                      - paragraph [ref=f2e619]:
                        - generic [ref=f2e620]: Dès
                        - generic [ref=f2e621]: 5 000 F CFA
                - listitem [ref=f2e622]:
                  - article [ref=f2e623]:
                    - generic [ref=f2e624]:
                      - generic: En cours
                      - generic [aria-hidden] [ref=f2e625]:
                        - generic [ref=f2e626]: "19"
                        - generic [ref=f2e627]: DÉC
                    - generic [ref=f2e628]:
                      - paragraph [ref=f2e629]: Petite-Côte Événements
                      - heading [level=3] [ref=f2e630]:
                        - link "Carnaval des enfants de Saly" [ref=f2e631] [cursor=pointer]:
                          - /url: /events/bcfd2b46-6d47-44f0-be8a-df3ed43885b3
                      - paragraph [ref=f2e632]:
                        - generic [ref=f2e635]: sam. 19 déc. · 15:00
                      - paragraph [ref=f2e636]:
                        - generic [ref=f2e640]: Saly · Promenade des Filaos
                      - generic [ref=f2e641]: Festivals
                      - paragraph [ref=f2e644]:
                        - generic [ref=f2e645]: Dès
                        - generic [ref=f2e646]: 2 000 F CFA
            - generic [ref=f2e647]:
              - generic [ref=f2e648]:
                - heading "Gastronomie & Tables" [level=3] [ref=f2e649]
                - 'link "Tout voir : Gastronomie & Tables" [ref=f2e650] [cursor=pointer]':
                  - /url: /explore?categorie=FOOD
                  - text: Tout voir
              - list [ref=f2e653]:
                - listitem [ref=f2e654]:
                  - article [ref=f2e655]:
                    - generic [ref=f2e656]:
                      - generic: En cours
                      - generic [aria-hidden] [ref=f2e657]:
                        - generic [ref=f2e658]: "24"
                        - generic [ref=f2e659]: NOV
                    - generic [ref=f2e660]:
                      - paragraph [ref=f2e661]: Petite-Côte Événements
                      - heading [level=3] [ref=f2e662]:
                        - link "Marché gourmand de la Petite-Côte" [ref=f2e663] [cursor=pointer]:
                          - /url: /events/443f461a-20fa-48ca-8fb2-0e78e955a227
                      - paragraph [ref=f2e664]:
                        - generic [ref=f2e667]: mar. 24 nov. · 10:00
                      - paragraph [ref=f2e668]:
                        - generic [ref=f2e672]: Mbour · Place du Marché Central
                      - generic [ref=f2e673]: Gastronomie & Tables
                      - paragraph [ref=f2e676]:
                        - generic [ref=f2e677]: Dès
                        - generic [ref=f2e678]: 1 000 F CFA
            - generic [ref=f2e679]:
              - generic [ref=f2e680]:
                - heading "Salles & Réceptions" [level=3] [ref=f2e681]
                - 'link "Tout voir : Salles & Réceptions" [ref=f2e682] [cursor=pointer]':
                  - /url: /explore?categorie=SALLE
                  - text: Tout voir
              - list [ref=f2e685]:
                - listitem [ref=f2e686]:
                  - article [ref=f2e687]:
                    - generic [ref=f2e688]:
                      - generic: En cours
                      - generic [aria-hidden] [ref=f2e689]:
                        - generic [ref=f2e690]: "27"
                        - generic [ref=f2e691]: NOV
                    - generic [ref=f2e692]:
                      - paragraph [ref=f2e693]: Saloum Culture
                      - heading [level=3] [ref=f2e694]:
                        - link "Dîner-spectacle au bord du Saloum" [ref=f2e695] [cursor=pointer]:
                          - /url: /events/2aec4c3d-87ae-459b-bdeb-3592df1949ae
                      - paragraph [ref=f2e696]:
                        - generic [ref=f2e699]: ven. 27 nov. · 20:00
                      - paragraph [ref=f2e700]:
                        - generic [ref=f2e704]: Foundiougne · Terrasse des Pirogues
                      - generic [ref=f2e705]: Salles & Réceptions
                      - paragraph [ref=f2e708]:
                        - generic [ref=f2e709]: Dès
                        - generic [ref=f2e710]: 25 000 F CFA
                - listitem [ref=f2e711]:
                  - article [ref=f2e712]:
                    - generic [ref=f2e713]:
                      - generic: En cours
                      - generic [aria-hidden] [ref=f2e714]:
                        - generic [ref=f2e715]: "10"
                        - generic [ref=f2e716]: DÉC
                    - generic [ref=f2e717]:
                      - paragraph [ref=f2e718]: Saloum Culture
                      - heading [level=3] [ref=f2e719]:
                        - link "Gala des entrepreneurs du Saloum" [ref=f2e720] [cursor=pointer]:
                          - /url: /events/7ca533ac-74ae-4832-9915-bd2e9b953dba
                      - paragraph [ref=f2e721]:
                        - generic [ref=f2e724]: jeu. 10 déc. · 19:30
                      - paragraph [ref=f2e725]:
                        - generic [ref=f2e729]: Kaolack · Salle des Palétuviers
                      - generic [ref=f2e730]: Salles & Réceptions
                      - paragraph [ref=f2e733]:
                        - generic [ref=f2e734]: Dès
                        - generic [ref=f2e735]: 10 000 F CFA
          - region [ref=f2e736]:
            - generic [ref=f2e737]:
              - generic [ref=f2e738]:
                - heading "Près de chez vous" [level=2] [ref=f2e739]
                - paragraph [ref=f2e740]: Les prochains événements dans votre ville.
              - generic [ref=f2e741]:
                - generic [ref=f2e742]: Votre ville
                - combobox "Votre ville" [ref=f2e745] [cursor=pointer]:
                  - option "Choisir une ville" [disabled] [selected]
                  - option "Dakar"
                  - option "Foundiougne"
                  - option "Gorée"
                  - option "Kaolack"
                  - option "Mbour"
                  - option "Saint-Louis"
                  - option "Saly"
                  - option "Ziguinchor"
            - generic [ref=f2e746]:
              - heading "Choisissez votre ville" [level=3] [ref=f2e751]
              - paragraph [ref=f2e752]: Les événements proches de chez vous apparaîtront ici. Votre choix est gardé pour vos prochaines visites.
          - region [ref=f2e753]:
            - heading "Comment ça marche" [level=2] [ref=f2e754]
            - list [ref=f2e755]:
              - listitem [ref=f2e756]:
                - generic [ref=f2e760]:
                  - paragraph [ref=f2e761]: Wave et Orange Money
                  - paragraph [ref=f2e762]: Payez depuis votre téléphone, le billet arrive aussitôt dans « Mes billets ».
              - listitem [ref=f2e763]:
                - generic [ref=f2e771]:
                  - paragraph [ref=f2e772]: QR code dynamique
                  - paragraph [ref=f2e773]: "Un code renouvelé en continu : une capture d’écran ne passe pas l’entrée."
              - listitem [ref=f2e774]:
                - generic [ref=f2e779]:
                  - paragraph [ref=f2e780]: Remboursement automatique
                  - paragraph [ref=f2e781]: "Événement annulé : les billets payés en ligne sont remboursés."
          - region [ref=f2e782]:
            - generic [ref=f2e789]:
              - heading "Parrainez vos proches" [level=2] [ref=f2e790]
              - paragraph [ref=f2e791]:
                - text: "Partagez votre lien de parrainage : vous recevez"
                - strong [ref=f2e792]: 5 %
                - text: de la part d’Event Village sur les achats en ligne de vos filleuls pendant
                - strong [ref=f2e793]: 12 mois
                - text: ", et"
                - strong [ref=f2e794]: 2 %
                - text: sur ceux des personnes qu’ils parrainent.
            - link "Obtenir mon lien" [ref=f2e795] [cursor=pointer]:
              - /url: /wallet
          - region [ref=f2e800]:
            - generic [ref=f2e801]:
              - paragraph [ref=f2e802]: Espace organisateur
              - heading "Vous organisez des événements ? Vendez vos billets avec Event Village." [level=2] [ref=f2e803]
              - list [ref=f2e804]:
                - listitem [ref=f2e805]:
                  - generic [ref=f2e809]: Création et publication de vos événements, validées par notre équipe
                - listitem [ref=f2e810]:
                  - generic [ref=f2e814]: Ventes et entrées suivies en direct, contrôleurs et caisses sur place
                - listitem [ref=f2e815]:
                  - generic [ref=f2e819]: Fonds versés sur votre compte après l’événement
              - link "Devenir partenaire" [ref=f2e821] [cursor=pointer]:
                - /url: /partner/register
          - generic [ref=f2e826]:
            - generic [ref=f2e827]:
              - generic [ref=f2e828]:
                - paragraph [ref=f2e829]: Event Village
                - paragraph [ref=f2e830]: Billetterie et événements au Sénégal.
              - navigation "Liens du pied de page" [ref=f2e831]:
                - list [ref=f2e832]:
                  - listitem [ref=f2e833]:
                    - link "Explorer" [ref=f2e834] [cursor=pointer]:
                      - /url: /explore
                  - listitem [ref=f2e836]:
                    - link "Mes billets" [ref=f2e837] [cursor=pointer]:
                      - /url: /tickets
                  - listitem [ref=f2e839]:
                    - link "Devenir partenaire" [ref=f2e840] [cursor=pointer]:
                      - /url: /partner/register
            - paragraph [ref=f2e842]: Event Village, 2026. Tous droits réservés.
  - alert [ref=f2e843]
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
      |                                                                                        ^ Error: contrôles responsive de accueil (sombre)
  107 |                 });
  108 |             }
  109 |         });
  110 |     }
  111 | }
  112 | 
```