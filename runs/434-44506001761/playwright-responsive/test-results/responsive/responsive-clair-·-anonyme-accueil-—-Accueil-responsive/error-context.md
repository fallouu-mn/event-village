# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> clair · anonyme >> accueil — Accueil
- Location: e2e/responsive.spec.ts:69:21

# Error details

```
Error: contrôles responsive de accueil (clair)

expect(received).toEqual(expected) // deep equality

- Expected  -  1
+ Received  + 14

- Array []
+ Array [
+   "320 px : texte tronqué sans le texte entier : span.truncate « Dakar · Esplanade de la Corniche Ouest » (points de suspension, texte entier absent) ; span.truncate « Mbour · Place du Marché Central » (points de suspension, texte entier absent) ; span.truncate « Kaolack · Centre culturel régional » (points de suspension, texte entier absent) ; span.truncate « Saint-Louis · Quai des Pêcheurs » (points de suspension, texte entier absent) ; h3.line-clamp-2.font-bold « Gala des entrepreneurs du Saloum » (lignes limitées, texte entier absent) ; span.truncate « Kaolack · Salle des Palétuviers » (points de suspension, texte entier absent) ; span.truncate « Gorée · Place du Gouvernement » (points de suspension, texte entier absent) ; span.truncate « Saly · Promenade des Filaos » (points de suspension, texte entier absent) ; span.truncate « Foundiougne · Terrasse des Pirogues » (points de suspension, texte entier absent) ; span.truncate « Dakar · Jardin de la Maison des Arts » (points de suspension, texte entier absent) ; span.truncate « Dakar · Salle de test, Dakar » (points de suspension, texte entier absent) ; span.truncate « Dakar · Esplanade de la Corniche Ouest » (points de suspension, texte entier absent)",
+   "320 px : textes qui se chevauchent : a.rounded-sm « Gala des entrepreneurs du Saloum » sur span.truncate « jeu. 10 déc. · 19:30 » (40×18 px) ; span.truncate « Foundiougne · Terrasse des Pirogues » sur span.truncate « Dakar · Jardin de la Maison des Arts » (26×18 px) ; span.truncate « Dakar · Jardin de la Maison des Arts » sur span.truncate « Dakar · Salle de test, Dakar » (12×18 px) ; span.truncate « Dakar · Esplanade de la Corniche Ouest » sur span.truncate « Gorée · Place du Gouvernement » (28×18 px) ; span.truncate « jeu. 19 nov. · 11:30 » sur h2.text-xl.font-bold « Près de chez vous » (115×14 px) ; h2.text-xl.font-bold « Près de chez vous » sur span.truncate « Dakar · Esplanade de la Corniche Ouest » (129×3 px) ; span.truncate « Dakar · Esplanade de la Corniche Ouest » sur p.text-sm.text-muted-foreground « Les prochains événements dans votre ville. » (244×8 px) ; span.truncate « Gorée · Place du Gouvernement » sur p.text-sm.text-muted-foreground « Les prochains événements dans votre ville. » (7×8 px) ; span « Concerts & Musique » sur label.text-sm.font-semibold « Votre ville » (39×7 px) ; h3.mb-1.text-base « Choisissez votre ville » sur small.pointer-events-none.absolute « En cours » (20×6 px) ; span.text-lg.font-extrabold « 01 » sur p.mb-5.max-w-sm « Les événements proches de chez vous apparaîtront i » (22×13 px) ; small.mt-0.5.text-caption « DÉC » sur p.mb-5.max-w-sm « Les événements proches de chez vous apparaîtront i » (25×10 px)",
+   "360 px : texte tronqué sans le texte entier : span.truncate « Dakar · Esplanade de la Corniche Ouest » (points de suspension, texte entier absent) ; span.truncate « Mbour · Place du Marché Central » (points de suspension, texte entier absent) ; span.truncate « Kaolack · Centre culturel régional » (points de suspension, texte entier absent) ; span.truncate « Saint-Louis · Quai des Pêcheurs » (points de suspension, texte entier absent) ; span.truncate « Kaolack · Salle des Palétuviers » (points de suspension, texte entier absent) ; span.truncate « Gorée · Place du Gouvernement » (points de suspension, texte entier absent) ; span.truncate « Saly · Promenade des Filaos » (points de suspension, texte entier absent) ; span.truncate « Foundiougne · Terrasse des Pirogues » (points de suspension, texte entier absent) ; span.truncate « Dakar · Jardin de la Maison des Arts » (points de suspension, texte entier absent) ; span.truncate « Dakar · Esplanade de la Corniche Ouest » (points de suspension, texte entier absent) ; span.truncate « Gorée · Place du Gouvernement » (points de suspension, texte entier absent) ; span.truncate « Kaolack · Centre culturel régional » (points de suspension, texte entier absent)",
+   "360 px : textes qui se chevauchent : span.truncate « Foundiougne · Terrasse des Pirogues » sur span « Concerts & Musique » (10×12 px)",
+   "390 px : texte tronqué sans le texte entier : span.truncate « Dakar · Esplanade de la Corniche Ouest » (points de suspension, texte entier absent) ; span.truncate « Mbour · Place du Marché Central » (points de suspension, texte entier absent) ; span.truncate « Kaolack · Centre culturel régional » (points de suspension, texte entier absent) ; span.truncate « Saint-Louis · Quai des Pêcheurs » (points de suspension, texte entier absent) ; span.truncate « Gorée · Place du Gouvernement » (points de suspension, texte entier absent) ; span.truncate « Foundiougne · Terrasse des Pirogues » (points de suspension, texte entier absent) ; span.truncate « Dakar · Jardin de la Maison des Arts » (points de suspension, texte entier absent) ; span.truncate « Dakar · Esplanade de la Corniche Ouest » (points de suspension, texte entier absent) ; span.truncate « Dakar · Esplanade de la Corniche Ouest » (points de suspension, texte entier absent) ; span.truncate « Dakar · Jardin de la Maison des Arts » (points de suspension, texte entier absent) ; span.truncate « Foundiougne · Terrasse des Pirogues » (points de suspension, texte entier absent)",
+   "768 px : texte tronqué sans le texte entier : span.truncate « Foundiougne · Terrasse des Pirogues » (points de suspension, texte entier absent) ; span.truncate « Dakar · Jardin de la Maison des Arts » (points de suspension, texte entier absent)",
+   "768 px : textes qui se chevauchent : span.hidden.whitespace-nowrap « Event Village » sur span.truncate « Rechercher un événement, un concert, un restaurant » (46×18 px)",
+   "1024 px : texte hors de l’écran : span.truncate « Kaolack · Centre culturel régional » de 872 à 1093 px (fenêtre 1024 px) ; span.truncate « Kaolack · Salle des Palétuviers » de 872 à 1072 px (fenêtre 1024 px) ; span.truncate « Dakar · Jardin de la Maison des Arts » de 872 à 1104 px (fenêtre 1024 px) ; span.truncate « Kaolack · Centre culturel régional » de 812 à 1032 px (fenêtre 1024 px) ; span.truncate « Kaolack · Centre culturel régional » de 812 à 1032 px (fenêtre 1024 px)",
+   "1024 px : texte tronqué sans le texte entier : p.truncate.text-sm « Petite-Côte Événements » (points de suspension, texte entier absent) ; h3.line-clamp-2.font-bold « Marché gourmand de la Petite-Côte » (lignes limitées, texte entier absent) ; span.truncate « mar. 24 nov. · 10:00 » (points de suspension, texte entier absent) ; span.truncate « Mbour · Place du Marché Central » (points de suspension, texte entier absent) ; span.truncate « ven. 20 nov. · 21:00 » (points de suspension, texte entier absent) ; span.truncate « Kaolack · Centre culturel régional » (points de suspension, texte entier absent) ; span.truncate « mar. 1 déc. · 18:00 » (points de suspension, texte entier absent) ; span.truncate « Saint-Louis · Quai des Pêcheurs » (points de suspension, texte entier absent) ; h3.line-clamp-2.font-bold « Gala des entrepreneurs du Saloum » (lignes limitées, texte entier absent) ; span.truncate « jeu. 10 déc. · 19:30 » (points de suspension, texte entier absent) ; span.truncate « Kaolack · Salle des Palétuviers » (points de suspension, texte entier absent) ; span.truncate.text-sm « Dès » (points de suspension, texte entier absent)",
+   "1024 px : textes qui se chevauchent : a.rounded-sm « Marché gourmand de la Petite-Côte » sur span.truncate « mar. 24 nov. · 10:00 » (98×18 px) ; span.truncate « Mbour · Place du Marché Central » sur span.truncate « Kaolack · Centre culturel régional » (36×18 px) ; a.rounded-sm « Gala des entrepreneurs du Saloum » sur span.truncate « jeu. 10 déc. · 19:30 » (67×18 px) ; span.truncate « Saint-Louis · Quai des Pêcheurs » sur span.truncate « Kaolack · Salle des Palétuviers » (30×18 px) ; span.whitespace-nowrap.text-base « 10 000 F CFA » sur span.truncate.text-sm « Dès » (4×18 px) ; a.rounded-sm « Concert des Lumières de Gorée » sur span.truncate « ven. 20 nov. · 06:45 » (30×18 px) ; a.rounded-sm « Carnaval des enfants de Saly » sur span.truncate « sam. 19 déc. · 15:00 » (12×18 px) ; a.rounded-sm « Dîner-spectacle au bord du Saloum » sur span.truncate « ven. 27 nov. · 20:00 » (44×18 px) ; a.rounded-sm « Dîner-spectacle au bord du Saloum » sur span.truncate « Saly · Promenade des Filaos » (31×18 px) ; a.rounded-sm « Dîner-spectacle au bord du Saloum » sur span.truncate « Foundiougne · Terrasse des Pirogues » (40×18 px) ; span.truncate « Gorée · Place du Gouvernement » sur span.truncate « Saly · Promenade des Filaos » (37×18 px) ; span.truncate « Saly · Promenade des Filaos » sur span.truncate « Foundiougne · Terrasse des Pirogues » (7×18 px)",
+   "1440 px : texte tronqué sans le texte entier : span.truncate « Mbour · Place du Marché Central » (points de suspension, texte entier absent) ; span.truncate « Kaolack · Centre culturel régional » (points de suspension, texte entier absent) ; span.truncate « Saint-Louis · Quai des Pêcheurs » (points de suspension, texte entier absent) ; span.truncate « Gorée · Place du Gouvernement » (points de suspension, texte entier absent) ; span.truncate « Foundiougne · Terrasse des Pirogues » (points de suspension, texte entier absent) ; span.truncate « Dakar · Jardin de la Maison des Arts » (points de suspension, texte entier absent) ; span.truncate « Dakar · Esplanade de la Corniche Ouest » (points de suspension, texte entier absent) ; span.truncate « Gorée · Place du Gouvernement » (points de suspension, texte entier absent) ; span.truncate « Kaolack · Centre culturel régional » (points de suspension, texte entier absent) ; span.truncate « Mbour · Place du Marché Central » (points de suspension, texte entier absent) ; span.truncate « Dakar · Esplanade de la Corniche Ouest » (points de suspension, texte entier absent) ; span.truncate « Gorée · Place du Gouvernement » (points de suspension, texte entier absent)",
+   "1440 px : textes qui se chevauchent : h2.text-xl.font-bold « Près de chez vous » sur h3.text-lg.font-bold « Festivals » (74×13 px) ; h3.text-lg.font-bold « Festivals » sur p.text-sm.text-muted-foreground « Les prochains événements dans votre ville. » (74×4 px) ; p.mb-5.max-w-sm « Les événements proches de chez vous apparaîtront i » sur p.truncate.text-sm « Petite-Côte Événements » (88×14 px) ; span.whitespace-nowrap.text-base « 7 500 F CFA » sur p.text-base.font-semibold « Wave et Orange Money » (71×9 px) ; span.truncate.text-sm « Dès » sur p.text-base.font-semibold « QR code dynamique » (26×8 px) ; h2.text-xl.font-bold « Parrainez vos proches » sur p.truncate.text-sm « Saloum Culture » (27×10 px) ; p.max-w-2xl.text-base « Partagez votre lien de parrainage : vous recevez 5 » sur a.rounded-sm « Dîner-spectacle au bord du Saloum » (131×14 px) ; p.max-w-2xl.text-base « Partagez votre lien de parrainage : vous recevez 5 » sur a.rounded-sm « Gala des entrepreneurs du Saloum » (171×14 px) ; strong.tabular-nums.text-foreground-strong « 5 % » sur a.rounded-sm « Gala des entrepreneurs du Saloum » (27×14 px) ; a.rounded-sm « Dîner-spectacle au bord du Saloum » sur p.max-w-2xl.text-base « Partagez votre lien de parrainage : vous recevez 5 » (131×4 px) ; a.rounded-sm « Gala des entrepreneurs du Saloum » sur p.max-w-2xl.text-base « Partagez votre lien de parrainage : vous recevez 5 » (95×4 px) ; a.rounded-sm « Gala des entrepreneurs du Saloum » sur strong.tabular-nums.text-foreground-strong « 12 mois » (20×4 px)",
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
          - paragraph [ref=f5e11]: Menu principal
          - generic [ref=f5e12]:
            - link "Accueil" [ref=f5e13] [cursor=pointer]:
              - /url: /
            - link "Explorer" [ref=f5e18] [cursor=pointer]:
              - /url: /explore
            - link "Mes billets" [ref=f5e23] [cursor=pointer]:
              - /url: /tickets
            - link "Portefeuille" [ref=f5e27] [cursor=pointer]:
              - /url: /wallet
        - generic [ref=f5e32]:
          - paragraph [ref=f5e33]: Espaces métier
          - link "Devenir partenaire" [ref=f5e35] [cursor=pointer]:
            - /url: /partner/register
      - generic [ref=f5e41]:
        - link "Se connecter" [ref=f5e42] [cursor=pointer]:
          - /url: /login
        - button "Basculer le thème" [ref=f5e48] [cursor=pointer]
    - generic [ref=f5e52]:
      - banner [ref=f5e53]:
        - link "Rechercher un événement, un concert, un restaurant…" [ref=f5e55] [cursor=pointer]:
          - /url: /explore
        - button "Notifications" [ref=f5e62] [cursor=pointer]
      - main [ref=f5e66]:
        - generic [ref=f5e68]:
          - region [ref=f5e69]:
            - heading "Vos prochaines sorties au Sénégal" [level=1] [ref=f5e70]
            - paragraph [ref=f5e71]: "Concerts, festivals, soirées et rencontres : choisissez votre place, payez avec Wave ou Orange Money et présentez votre billet à l’entrée."
            - search [ref=f5e72]:
              - generic [ref=f5e73]: Rechercher un événement
              - searchbox "Rechercher un événement" [ref=f5e75]
              - button "Rechercher" [ref=f5e76] [cursor=pointer]
            - navigation "Raccourcis" [ref=f5e77]:
              - list [ref=f5e78]:
                - listitem [ref=f5e79]:
                  - link "Aujourd’hui" [ref=f5e80] [cursor=pointer]:
                    - /url: /explore?quand=aujourdhui
                - listitem [ref=f5e81]:
                  - link "Ce week-end" [ref=f5e82] [cursor=pointer]:
                    - /url: /explore?quand=weekend
                - listitem [ref=f5e83]:
                  - link "Cette semaine" [ref=f5e84] [cursor=pointer]:
                    - /url: /explore?quand=semaine
                - listitem [ref=f5e85]:
                  - link "Gratuit" [ref=f5e86] [cursor=pointer]:
                    - /url: /explore?gratuit=1
          - region [ref=f5e87]:
            - generic [ref=f5e88]:
              - generic [ref=f5e89]:
                - heading "Populaires" [level=2] [ref=f5e90]
                - paragraph [ref=f5e91]: Les événements les plus demandés des 7 derniers jours.
                - status [ref=f5e92]: En direct
              - link "Tout voir" [ref=f5e94] [cursor=pointer]:
                - /url: /explore
            - list [ref=f5e97]:
              - listitem [ref=f5e98]:
                - article [ref=f5e99]:
                  - generic [ref=f5e100]:
                    - generic: En cours
                    - generic [aria-hidden] [ref=f5e101]:
                      - generic [ref=f5e102]: "19"
                      - generic [ref=f5e103]: NOV
                  - generic [ref=f5e104]:
                    - paragraph [ref=f5e105]: Baobab Scène
                    - heading [level=3] [ref=f5e106]:
                      - link "Nuit du Sabar — édition d’automne" [ref=f5e107] [cursor=pointer]:
                        - /url: /events/1b6b9b15-31a6-41c3-856d-f27700d91f21
                    - paragraph [ref=f5e108]:
                      - generic [ref=f5e111]: jeu. 19 nov. · 11:30
                    - paragraph [ref=f5e112]:
                      - generic [ref=f5e116]: Dakar · Esplanade de la Corniche Ouest
                    - generic [ref=f5e117]: Concerts & Musique
                    - paragraph [ref=f5e120]:
                      - generic [ref=f5e121]: Dès
                      - generic [ref=f5e122]: 5 000 F CFA
              - listitem [ref=f5e123]:
                - article [ref=f5e124]:
                  - generic [ref=f5e125]:
                    - generic: En cours
                    - generic [aria-hidden] [ref=f5e126]:
                      - generic [ref=f5e127]: "24"
                      - generic [ref=f5e128]: NOV
                  - generic [ref=f5e129]:
                    - paragraph [ref=f5e130]: Petite-Côte Événements
                    - heading [level=3] [ref=f5e131]:
                      - link "Marché gourmand de la Petite-Côte" [ref=f5e132] [cursor=pointer]:
                        - /url: /events/443f461a-20fa-48ca-8fb2-0e78e955a227
                    - paragraph [ref=f5e133]:
                      - generic [ref=f5e136]: mar. 24 nov. · 10:00
                    - paragraph [ref=f5e137]:
                      - generic [ref=f5e141]: Mbour · Place du Marché Central
                    - generic [ref=f5e142]: Gastronomie & Tables
                    - paragraph [ref=f5e145]:
                      - generic [ref=f5e146]: Dès
                      - generic [ref=f5e147]: 1 000 F CFA
              - listitem [ref=f5e148]:
                - article [ref=f5e149]:
                  - generic [ref=f5e150]:
                    - generic: En cours
                    - generic [aria-hidden] [ref=f5e151]:
                      - generic [ref=f5e152]: "20"
                      - generic [ref=f5e153]: NOV
                  - generic [ref=f5e154]:
                    - paragraph [ref=f5e155]: Saloum Culture
                    - heading [level=3] [ref=f5e156]:
                      - link "Nuit du slam de Kaolack" [ref=f5e157] [cursor=pointer]:
                        - /url: /events/3a49764e-0398-4710-9551-0d00aeb9d709
                    - paragraph [ref=f5e158]:
                      - generic [ref=f5e161]: ven. 20 nov. · 21:00
                    - paragraph [ref=f5e162]:
                      - generic [ref=f5e166]: Kaolack · Centre culturel régional
                    - generic [ref=f5e167]:
                      - generic [ref=f5e168]: Dernières places
                      - generic [ref=f5e170]: Concerts & Musique
                    - paragraph [ref=f5e172]:
                      - generic [ref=f5e173]: Dès
                      - generic [ref=f5e174]: 3 000 F CFA
              - listitem [ref=f5e175]:
                - article [ref=f5e176]:
                  - generic [ref=f5e177]:
                    - generic: En cours
                    - generic [aria-hidden] [ref=f5e178]:
                      - generic [ref=f5e179]: "01"
                      - generic [ref=f5e180]: DÉC
                  - generic [ref=f5e181]:
                    - paragraph [ref=f5e182]: Baobab Scène
                    - heading [level=3] [ref=f5e183]:
                      - link "Festival Jazz sur le Fleuve" [ref=f5e184] [cursor=pointer]:
                        - /url: /events/cbf928d9-6a7a-4bcf-822d-29f5e71c0fbe
                    - paragraph [ref=f5e185]:
                      - generic [ref=f5e188]: mar. 1 déc. · 18:00
                    - paragraph [ref=f5e189]:
                      - generic [ref=f5e193]: Saint-Louis · Quai des Pêcheurs
                    - generic [ref=f5e194]: Festivals
                    - paragraph [ref=f5e197]:
                      - generic [ref=f5e198]: Dès
                      - generic [ref=f5e199]: 7 500 F CFA
              - listitem [ref=f5e200]:
                - article [ref=f5e201]:
                  - generic [ref=f5e202]:
                    - generic: En cours
                    - generic [aria-hidden] [ref=f5e203]:
                      - generic [ref=f5e204]: "10"
                      - generic [ref=f5e205]: DÉC
                  - generic [ref=f5e206]:
                    - paragraph [ref=f5e207]: Saloum Culture
                    - heading [level=3] [ref=f5e208]:
                      - link "Gala des entrepreneurs du Saloum" [ref=f5e209] [cursor=pointer]:
                        - /url: /events/7ca533ac-74ae-4832-9915-bd2e9b953dba
                    - paragraph [ref=f5e210]:
                      - generic [ref=f5e213]: jeu. 10 déc. · 19:30
                    - paragraph [ref=f5e214]:
                      - generic [ref=f5e218]: Kaolack · Salle des Palétuviers
                    - generic [ref=f5e219]: Salles & Réceptions
                    - paragraph [ref=f5e222]:
                      - generic [ref=f5e223]: Dès
                      - generic [ref=f5e224]: 10 000 F CFA
              - listitem [ref=f5e225]:
                - article [ref=f5e226]:
                  - generic [ref=f5e227]:
                    - generic: En cours
                    - generic [aria-hidden] [ref=f5e228]:
                      - generic [ref=f5e229]: "20"
                      - generic [ref=f5e230]: NOV
                  - generic [ref=f5e231]:
                    - paragraph [ref=f5e232]: Baobab Scène
                    - heading [level=3] [ref=f5e233]:
                      - link "Concert des Lumières de Gorée" [ref=f5e234] [cursor=pointer]:
                        - /url: /events/3e0f741a-d31d-4cde-af85-7cca6884a434
                    - paragraph [ref=f5e235]:
                      - generic [ref=f5e238]: ven. 20 nov. · 06:45
                    - paragraph [ref=f5e239]:
                      - generic [ref=f5e243]: Gorée · Place du Gouvernement
                    - generic [ref=f5e244]: Concerts & Musique
                    - paragraph [ref=f5e247]:
                      - generic [ref=f5e248]: Dès
                      - generic [ref=f5e249]: 6 000 F CFA
              - listitem [ref=f5e250]:
                - article [ref=f5e251]:
                  - generic [ref=f5e252]:
                    - generic: En cours
                    - generic [aria-hidden] [ref=f5e253]:
                      - generic [ref=f5e254]: "19"
                      - generic [ref=f5e255]: DÉC
                  - generic [ref=f5e256]:
                    - paragraph [ref=f5e257]: Petite-Côte Événements
                    - heading [level=3] [ref=f5e258]:
                      - link "Carnaval des enfants de Saly" [ref=f5e259] [cursor=pointer]:
                        - /url: /events/bcfd2b46-6d47-44f0-be8a-df3ed43885b3
                    - paragraph [ref=f5e260]:
                      - generic [ref=f5e263]: sam. 19 déc. · 15:00
                    - paragraph [ref=f5e264]:
                      - generic [ref=f5e268]: Saly · Promenade des Filaos
                    - generic [ref=f5e269]: Festivals
                    - paragraph [ref=f5e272]:
                      - generic [ref=f5e273]: Dès
                      - generic [ref=f5e274]: 2 000 F CFA
              - listitem [ref=f5e275]:
                - article [ref=f5e276]:
                  - generic [ref=f5e277]:
                    - generic: En cours
                    - generic [aria-hidden] [ref=f5e278]:
                      - generic [ref=f5e279]: "27"
                      - generic [ref=f5e280]: NOV
                  - generic [ref=f5e281]:
                    - paragraph [ref=f5e282]: Saloum Culture
                    - heading [level=3] [ref=f5e283]:
                      - link "Dîner-spectacle au bord du Saloum" [ref=f5e284] [cursor=pointer]:
                        - /url: /events/2aec4c3d-87ae-459b-bdeb-3592df1949ae
                    - paragraph [ref=f5e285]:
                      - generic [ref=f5e288]: ven. 27 nov. · 20:00
                    - paragraph [ref=f5e289]:
                      - generic [ref=f5e293]: Foundiougne · Terrasse des Pirogues
                    - generic [ref=f5e294]: Salles & Réceptions
                    - paragraph [ref=f5e297]:
                      - generic [ref=f5e298]: Dès
                      - generic [ref=f5e299]: 25 000 F CFA
              - listitem [ref=f5e300]:
                - article [ref=f5e301]:
                  - generic [ref=f5e302]:
                    - generic: En cours
                    - generic [aria-hidden] [ref=f5e303]:
                      - generic [ref=f5e304]: "06"
                      - generic [ref=f5e305]: DÉC
                  - generic [ref=f5e306]:
                    - paragraph [ref=f5e307]: Baobab Scène
                    - heading [level=3] [ref=f5e308]:
                      - link "Soirée Kora & Lumières" [ref=f5e309] [cursor=pointer]:
                        - /url: /events/51729819-f190-4aed-8679-5f33482543fa
                    - paragraph [ref=f5e310]:
                      - generic [ref=f5e313]: dim. 6 déc. · 20:30
                    - paragraph [ref=f5e314]:
                      - generic [ref=f5e318]: Dakar · Jardin de la Maison des Arts
                    - generic [ref=f5e319]: Concerts & Musique
                    - paragraph [ref=f5e322]:
                      - generic [ref=f5e323]: Dès
                      - generic [ref=f5e324]: 6 000 F CFA
          - region [ref=f5e325]:
            - generic [ref=f5e326]:
              - generic [ref=f5e327]:
                - heading "Cette semaine" [level=2] [ref=f5e328]
                - paragraph [ref=f5e329]: Aujourd’hui et les six prochains jours.
              - link "Tout voir (4)" [ref=f5e330] [cursor=pointer]:
                - /url: /explore?quand=semaine
            - list [ref=f5e333]:
              - listitem [ref=f5e334]:
                - article [ref=f5e335]:
                  - generic [ref=f5e336]:
                    - generic: En cours
                    - generic [aria-hidden] [ref=f5e337]:
                      - generic [ref=f5e338]: "19"
                      - generic [ref=f5e339]: NOV
                  - generic [ref=f5e340]:
                    - paragraph [ref=f5e341]: Baobab Scène
                    - heading [level=3] [ref=f5e342]:
                      - link "Nuit du Sabar — édition d’automne" [ref=f5e343] [cursor=pointer]:
                        - /url: /events/1b6b9b15-31a6-41c3-856d-f27700d91f21
                    - paragraph [ref=f5e344]:
                      - generic [ref=f5e347]: jeu. 19 nov. · 11:30
                    - paragraph [ref=f5e348]:
                      - generic [ref=f5e352]: Dakar · Esplanade de la Corniche Ouest
                    - generic [ref=f5e353]: Concerts & Musique
                    - paragraph [ref=f5e356]:
                      - generic [ref=f5e357]: Dès
                      - generic [ref=f5e358]: 5 000 F CFA
              - listitem [ref=f5e359]:
                - article [ref=f5e360]:
                  - generic [ref=f5e361]:
                    - generic: En cours
                    - generic [aria-hidden] [ref=f5e362]:
                      - generic [ref=f5e363]: "20"
                      - generic [ref=f5e364]: NOV
                  - generic [ref=f5e365]:
                    - paragraph [ref=f5e366]: Baobab Scène
                    - heading [level=3] [ref=f5e367]:
                      - link "Concert des Lumières de Gorée" [ref=f5e368] [cursor=pointer]:
                        - /url: /events/3e0f741a-d31d-4cde-af85-7cca6884a434
                    - paragraph [ref=f5e369]:
                      - generic [ref=f5e372]: ven. 20 nov. · 06:45
                    - paragraph [ref=f5e373]:
                      - generic [ref=f5e377]: Gorée · Place du Gouvernement
                    - generic [ref=f5e378]: Concerts & Musique
                    - paragraph [ref=f5e381]:
                      - generic [ref=f5e382]: Dès
                      - generic [ref=f5e383]: 6 000 F CFA
              - listitem [ref=f5e384]:
                - article [ref=f5e385]:
                  - generic [ref=f5e386]:
                    - generic: En cours
                    - generic [aria-hidden] [ref=f5e387]:
                      - generic [ref=f5e388]: "20"
                      - generic [ref=f5e389]: NOV
                  - generic [ref=f5e390]:
                    - paragraph [ref=f5e391]: Saloum Culture
                    - heading [level=3] [ref=f5e392]:
                      - link "Nuit du slam de Kaolack" [ref=f5e393] [cursor=pointer]:
                        - /url: /events/3a49764e-0398-4710-9551-0d00aeb9d709
                    - paragraph [ref=f5e394]:
                      - generic [ref=f5e397]: ven. 20 nov. · 21:00
                    - paragraph [ref=f5e398]:
                      - generic [ref=f5e402]: Kaolack · Centre culturel régional
                    - generic [ref=f5e403]:
                      - generic [ref=f5e404]: Dernières places
                      - generic [ref=f5e406]: Concerts & Musique
                    - paragraph [ref=f5e408]:
                      - generic [ref=f5e409]: Dès
                      - generic [ref=f5e410]: 3 000 F CFA
              - listitem [ref=f5e411]:
                - article [ref=f5e412]:
                  - generic [ref=f5e413]:
                    - generic: En cours
                    - generic [aria-hidden] [ref=f5e414]:
                      - generic [ref=f5e415]: "24"
                      - generic [ref=f5e416]: NOV
                  - generic [ref=f5e417]:
                    - paragraph [ref=f5e418]: Petite-Côte Événements
                    - heading [level=3] [ref=f5e419]:
                      - link "Marché gourmand de la Petite-Côte" [ref=f5e420] [cursor=pointer]:
                        - /url: /events/443f461a-20fa-48ca-8fb2-0e78e955a227
                    - paragraph [ref=f5e421]:
                      - generic [ref=f5e424]: mar. 24 nov. · 10:00
                    - paragraph [ref=f5e425]:
                      - generic [ref=f5e429]: Mbour · Place du Marché Central
                    - generic [ref=f5e430]: Gastronomie & Tables
                    - paragraph [ref=f5e433]:
                      - generic [ref=f5e434]: Dès
                      - generic [ref=f5e435]: 1 000 F CFA
          - region [ref=f5e436]:
            - generic [ref=f5e437]:
              - heading "Par catégorie" [level=2] [ref=f5e438]
              - list [ref=f5e439]:
                - listitem [ref=f5e440]:
                  - link "Concerts & Musique 6" [ref=f5e441] [cursor=pointer]:
                    - /url: /explore?categorie=CONCERT
                    - text: Concerts & Musique
                    - generic [ref=f5e442]: "6"
                - listitem [ref=f5e443]:
                  - link "Festivals 3" [ref=f5e444] [cursor=pointer]:
                    - /url: /explore?categorie=FESTIVAL
                    - text: Festivals
                    - generic [ref=f5e445]: "3"
                - listitem [ref=f5e446]:
                  - link "Gastronomie & Tables 1" [ref=f5e447] [cursor=pointer]:
                    - /url: /explore?categorie=FOOD
                    - text: Gastronomie & Tables
                    - generic [ref=f5e448]: "1"
                - listitem [ref=f5e449]:
                  - link "Salles & Réceptions 2" [ref=f5e450] [cursor=pointer]:
                    - /url: /explore?categorie=SALLE
                    - text: Salles & Réceptions
                    - generic [ref=f5e451]: "2"
            - generic [ref=f5e452]:
              - generic [ref=f5e453]:
                - heading "Concerts & Musique" [level=3] [ref=f5e454]
                - 'link "Tout voir : Concerts & Musique" [ref=f5e455] [cursor=pointer]':
                  - /url: /explore?categorie=CONCERT
                  - text: Tout voir
              - list [ref=f5e458]:
                - listitem [ref=f5e459]:
                  - article [ref=f5e460]:
                    - generic [ref=f5e461]:
                      - generic: En cours
                      - generic [aria-hidden] [ref=f5e462]:
                        - generic [ref=f5e463]: "19"
                        - generic [ref=f5e464]: NOV
                    - generic [ref=f5e465]:
                      - paragraph [ref=f5e466]: Baobab Scène
                      - heading [level=3] [ref=f5e467]:
                        - link "Nuit du Sabar — édition d’automne" [ref=f5e468] [cursor=pointer]:
                          - /url: /events/1b6b9b15-31a6-41c3-856d-f27700d91f21
                      - paragraph [ref=f5e469]:
                        - generic [ref=f5e472]: jeu. 19 nov. · 11:30
                      - paragraph [ref=f5e473]:
                        - generic [ref=f5e477]: Dakar · Esplanade de la Corniche Ouest
                      - generic [ref=f5e478]: Concerts & Musique
                      - paragraph [ref=f5e481]:
                        - generic [ref=f5e482]: Dès
                        - generic [ref=f5e483]: 5 000 F CFA
                - listitem [ref=f5e484]:
                  - article [ref=f5e485]:
                    - generic [ref=f5e486]:
                      - generic: En cours
                      - generic [aria-hidden] [ref=f5e487]:
                        - generic [ref=f5e488]: "20"
                        - generic [ref=f5e489]: NOV
                    - generic [ref=f5e490]:
                      - paragraph [ref=f5e491]: Baobab Scène
                      - heading [level=3] [ref=f5e492]:
                        - link "Concert des Lumières de Gorée" [ref=f5e493] [cursor=pointer]:
                          - /url: /events/3e0f741a-d31d-4cde-af85-7cca6884a434
                      - paragraph [ref=f5e494]:
                        - generic [ref=f5e497]: ven. 20 nov. · 06:45
                      - paragraph [ref=f5e498]:
                        - generic [ref=f5e502]: Gorée · Place du Gouvernement
                      - generic [ref=f5e503]: Concerts & Musique
                      - paragraph [ref=f5e506]:
                        - generic [ref=f5e507]: Dès
                        - generic [ref=f5e508]: 6 000 F CFA
                - listitem [ref=f5e509]:
                  - article [ref=f5e510]:
                    - generic [ref=f5e511]:
                      - generic: En cours
                      - generic [aria-hidden] [ref=f5e512]:
                        - generic [ref=f5e513]: "20"
                        - generic [ref=f5e514]: NOV
                    - generic [ref=f5e515]:
                      - paragraph [ref=f5e516]: Saloum Culture
                      - heading [level=3] [ref=f5e517]:
                        - link "Nuit du slam de Kaolack" [ref=f5e518] [cursor=pointer]:
                          - /url: /events/3a49764e-0398-4710-9551-0d00aeb9d709
                      - paragraph [ref=f5e519]:
                        - generic [ref=f5e522]: ven. 20 nov. · 21:00
                      - paragraph [ref=f5e523]:
                        - generic [ref=f5e527]: Kaolack · Centre culturel régional
                      - generic [ref=f5e528]:
                        - generic [ref=f5e529]: Dernières places
                        - generic [ref=f5e531]: Concerts & Musique
                      - paragraph [ref=f5e533]:
                        - generic [ref=f5e534]: Dès
                        - generic [ref=f5e535]: 3 000 F CFA
                - listitem [ref=f5e536]:
                  - article [ref=f5e537]:
                    - generic [ref=f5e538]:
                      - generic: En cours
                      - generic [aria-hidden] [ref=f5e539]:
                        - generic [ref=f5e540]: "06"
                        - generic [ref=f5e541]: DÉC
                    - generic [ref=f5e542]:
                      - paragraph [ref=f5e543]: Baobab Scène
                      - heading [level=3] [ref=f5e544]:
                        - link "Soirée Kora & Lumières" [ref=f5e545] [cursor=pointer]:
                          - /url: /events/51729819-f190-4aed-8679-5f33482543fa
                      - paragraph [ref=f5e546]:
                        - generic [ref=f5e549]: dim. 6 déc. · 20:30
                      - paragraph [ref=f5e550]:
                        - generic [ref=f5e554]: Dakar · Jardin de la Maison des Arts
                      - generic [ref=f5e555]: Concerts & Musique
                      - paragraph [ref=f5e558]:
                        - generic [ref=f5e559]: Dès
                        - generic [ref=f5e560]: 6 000 F CFA
            - generic [ref=f5e561]:
              - generic [ref=f5e562]:
                - heading "Festivals" [level=3] [ref=f5e563]
                - 'link "Tout voir : Festivals" [ref=f5e564] [cursor=pointer]':
                  - /url: /explore?categorie=FESTIVAL
                  - text: Tout voir
              - list [ref=f5e567]:
                - listitem [ref=f5e568]:
                  - article [ref=f5e569]:
                    - generic [ref=f5e570]:
                      - generic: En cours
                      - generic [aria-hidden] [ref=f5e571]:
                        - generic [ref=f5e572]: "01"
                        - generic [ref=f5e573]: DÉC
                    - generic [ref=f5e574]:
                      - paragraph [ref=f5e575]: Baobab Scène
                      - heading [level=3] [ref=f5e576]:
                        - link "Festival Jazz sur le Fleuve" [ref=f5e577] [cursor=pointer]:
                          - /url: /events/cbf928d9-6a7a-4bcf-822d-29f5e71c0fbe
                      - paragraph [ref=f5e578]:
                        - generic [ref=f5e581]: mar. 1 déc. · 18:00
                      - paragraph [ref=f5e582]:
                        - generic [ref=f5e586]: Saint-Louis · Quai des Pêcheurs
                      - generic [ref=f5e587]: Festivals
                      - paragraph [ref=f5e590]:
                        - generic [ref=f5e591]: Dès
                        - generic [ref=f5e592]: 7 500 F CFA
                - listitem [ref=f5e593]:
                  - article [ref=f5e594]:
                    - generic [ref=f5e595]:
                      - generic: En cours
                      - generic [aria-hidden] [ref=f5e596]:
                        - generic [ref=f5e597]: "15"
                        - generic [ref=f5e598]: DÉC
                    - generic [ref=f5e599]:
                      - paragraph [ref=f5e600]: Petite-Côte Événements
                      - heading [level=3] [ref=f5e601]:
                        - link "Festival des rythmes de Casamance" [ref=f5e602] [cursor=pointer]:
                          - /url: /events/cc1135a5-96d5-4d4d-ac8f-0ff8c6cf3ce6
                      - paragraph [ref=f5e603]:
                        - generic [ref=f5e606]: mar. 15 déc. · 17:00
                      - paragraph [ref=f5e607]:
                        - generic [ref=f5e611]: Ziguinchor · Esplanade du Port
                      - generic [ref=f5e612]: Festivals
                      - paragraph [ref=f5e615]:
                        - generic [ref=f5e616]: Dès
                        - generic [ref=f5e617]: 5 000 F CFA
                - listitem [ref=f5e618]:
                  - article [ref=f5e619]:
                    - generic [ref=f5e620]:
                      - generic: En cours
                      - generic [aria-hidden] [ref=f5e621]:
                        - generic [ref=f5e622]: "19"
                        - generic [ref=f5e623]: DÉC
                    - generic [ref=f5e624]:
                      - paragraph [ref=f5e625]: Petite-Côte Événements
                      - heading [level=3] [ref=f5e626]:
                        - link "Carnaval des enfants de Saly" [ref=f5e627] [cursor=pointer]:
                          - /url: /events/bcfd2b46-6d47-44f0-be8a-df3ed43885b3
                      - paragraph [ref=f5e628]:
                        - generic [ref=f5e631]: sam. 19 déc. · 15:00
                      - paragraph [ref=f5e632]:
                        - generic [ref=f5e636]: Saly · Promenade des Filaos
                      - generic [ref=f5e637]: Festivals
                      - paragraph [ref=f5e640]:
                        - generic [ref=f5e641]: Dès
                        - generic [ref=f5e642]: 2 000 F CFA
            - generic [ref=f5e643]:
              - generic [ref=f5e644]:
                - heading "Gastronomie & Tables" [level=3] [ref=f5e645]
                - 'link "Tout voir : Gastronomie & Tables" [ref=f5e646] [cursor=pointer]':
                  - /url: /explore?categorie=FOOD
                  - text: Tout voir
              - list [ref=f5e649]:
                - listitem [ref=f5e650]:
                  - article [ref=f5e651]:
                    - generic [ref=f5e652]:
                      - generic: En cours
                      - generic [aria-hidden] [ref=f5e653]:
                        - generic [ref=f5e654]: "24"
                        - generic [ref=f5e655]: NOV
                    - generic [ref=f5e656]:
                      - paragraph [ref=f5e657]: Petite-Côte Événements
                      - heading [level=3] [ref=f5e658]:
                        - link "Marché gourmand de la Petite-Côte" [ref=f5e659] [cursor=pointer]:
                          - /url: /events/443f461a-20fa-48ca-8fb2-0e78e955a227
                      - paragraph [ref=f5e660]:
                        - generic [ref=f5e663]: mar. 24 nov. · 10:00
                      - paragraph [ref=f5e664]:
                        - generic [ref=f5e668]: Mbour · Place du Marché Central
                      - generic [ref=f5e669]: Gastronomie & Tables
                      - paragraph [ref=f5e672]:
                        - generic [ref=f5e673]: Dès
                        - generic [ref=f5e674]: 1 000 F CFA
            - generic [ref=f5e675]:
              - generic [ref=f5e676]:
                - heading "Salles & Réceptions" [level=3] [ref=f5e677]
                - 'link "Tout voir : Salles & Réceptions" [ref=f5e678] [cursor=pointer]':
                  - /url: /explore?categorie=SALLE
                  - text: Tout voir
              - list [ref=f5e681]:
                - listitem [ref=f5e682]:
                  - article [ref=f5e683]:
                    - generic [ref=f5e684]:
                      - generic: En cours
                      - generic [aria-hidden] [ref=f5e685]:
                        - generic [ref=f5e686]: "27"
                        - generic [ref=f5e687]: NOV
                    - generic [ref=f5e688]:
                      - paragraph [ref=f5e689]: Saloum Culture
                      - heading [level=3] [ref=f5e690]:
                        - link "Dîner-spectacle au bord du Saloum" [ref=f5e691] [cursor=pointer]:
                          - /url: /events/2aec4c3d-87ae-459b-bdeb-3592df1949ae
                      - paragraph [ref=f5e692]:
                        - generic [ref=f5e695]: ven. 27 nov. · 20:00
                      - paragraph [ref=f5e696]:
                        - generic [ref=f5e700]: Foundiougne · Terrasse des Pirogues
                      - generic [ref=f5e701]: Salles & Réceptions
                      - paragraph [ref=f5e704]:
                        - generic [ref=f5e705]: Dès
                        - generic [ref=f5e706]: 25 000 F CFA
                - listitem [ref=f5e707]:
                  - article [ref=f5e708]:
                    - generic [ref=f5e709]:
                      - generic: En cours
                      - generic [aria-hidden] [ref=f5e710]:
                        - generic [ref=f5e711]: "10"
                        - generic [ref=f5e712]: DÉC
                    - generic [ref=f5e713]:
                      - paragraph [ref=f5e714]: Saloum Culture
                      - heading [level=3] [ref=f5e715]:
                        - link "Gala des entrepreneurs du Saloum" [ref=f5e716] [cursor=pointer]:
                          - /url: /events/7ca533ac-74ae-4832-9915-bd2e9b953dba
                      - paragraph [ref=f5e717]:
                        - generic [ref=f5e720]: jeu. 10 déc. · 19:30
                      - paragraph [ref=f5e721]:
                        - generic [ref=f5e725]: Kaolack · Salle des Palétuviers
                      - generic [ref=f5e726]: Salles & Réceptions
                      - paragraph [ref=f5e729]:
                        - generic [ref=f5e730]: Dès
                        - generic [ref=f5e731]: 10 000 F CFA
          - region [ref=f5e732]:
            - generic [ref=f5e733]:
              - generic [ref=f5e734]:
                - heading "Près de chez vous" [level=2] [ref=f5e735]
                - paragraph [ref=f5e736]: Les prochains événements dans votre ville.
              - generic [ref=f5e737]:
                - generic [ref=f5e738]: Votre ville
                - combobox "Votre ville" [ref=f5e741] [cursor=pointer]:
                  - option "Choisir une ville" [disabled] [selected]
                  - option "Dakar"
                  - option "Foundiougne"
                  - option "Gorée"
                  - option "Kaolack"
                  - option "Mbour"
                  - option "Saint-Louis"
                  - option "Saly"
                  - option "Ziguinchor"
            - generic [ref=f5e742]:
              - heading "Choisissez votre ville" [level=3] [ref=f5e747]
              - paragraph [ref=f5e748]: Les événements proches de chez vous apparaîtront ici. Votre choix est gardé pour vos prochaines visites.
          - region [ref=f5e749]:
            - heading "Comment ça marche" [level=2] [ref=f5e750]
            - list [ref=f5e751]:
              - listitem [ref=f5e752]:
                - generic [ref=f5e756]:
                  - paragraph [ref=f5e757]: Wave et Orange Money
                  - paragraph [ref=f5e758]: Payez depuis votre téléphone, le billet arrive aussitôt dans « Mes billets ».
              - listitem [ref=f5e759]:
                - generic [ref=f5e767]:
                  - paragraph [ref=f5e768]: QR code dynamique
                  - paragraph [ref=f5e769]: "Un code renouvelé en continu : une capture d’écran ne passe pas l’entrée."
              - listitem [ref=f5e770]:
                - generic [ref=f5e775]:
                  - paragraph [ref=f5e776]: Remboursement automatique
                  - paragraph [ref=f5e777]: "Événement annulé : les billets payés en ligne sont remboursés."
          - region [ref=f5e778]:
            - generic [ref=f5e785]:
              - heading "Parrainez vos proches" [level=2] [ref=f5e786]
              - paragraph [ref=f5e787]:
                - text: "Partagez votre lien de parrainage : vous recevez"
                - strong [ref=f5e788]: 5 %
                - text: de la part d’Event Village sur les achats en ligne de vos filleuls pendant
                - strong [ref=f5e789]: 12 mois
                - text: ", et"
                - strong [ref=f5e790]: 2 %
                - text: sur ceux des personnes qu’ils parrainent.
            - link "Obtenir mon lien" [ref=f5e791] [cursor=pointer]:
              - /url: /wallet
          - region [ref=f5e796]:
            - generic [ref=f5e797]:
              - paragraph [ref=f5e798]: Espace organisateur
              - heading "Vous organisez des événements ? Vendez vos billets avec Event Village." [level=2] [ref=f5e799]
              - list [ref=f5e800]:
                - listitem [ref=f5e801]:
                  - generic [ref=f5e805]: Création et publication de vos événements, validées par notre équipe
                - listitem [ref=f5e806]:
                  - generic [ref=f5e810]: Ventes et entrées suivies en direct, contrôleurs et caisses sur place
                - listitem [ref=f5e811]:
                  - generic [ref=f5e815]: Fonds versés sur votre compte après l’événement
              - link "Devenir partenaire" [ref=f5e817] [cursor=pointer]:
                - /url: /partner/register
          - generic [ref=f5e822]:
            - generic [ref=f5e823]:
              - generic [ref=f5e824]:
                - paragraph [ref=f5e825]: Event Village
                - paragraph [ref=f5e826]: Billetterie et événements au Sénégal.
              - navigation "Liens du pied de page" [ref=f5e827]:
                - list [ref=f5e828]:
                  - listitem [ref=f5e829]:
                    - link "Explorer" [ref=f5e830] [cursor=pointer]:
                      - /url: /explore
                  - listitem [ref=f5e832]:
                    - link "Mes billets" [ref=f5e833] [cursor=pointer]:
                      - /url: /tickets
                  - listitem [ref=f5e835]:
                    - link "Devenir partenaire" [ref=f5e836] [cursor=pointer]:
                      - /url: /partner/register
            - paragraph [ref=f5e838]: Event Village, 2026. Tous droits réservés.
  - alert [ref=f5e839]
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
      |                                                                                        ^ Error: contrôles responsive de accueil (clair)
  107 |                 });
  108 |             }
  109 |         });
  110 |     }
  111 | }
  112 | 
```