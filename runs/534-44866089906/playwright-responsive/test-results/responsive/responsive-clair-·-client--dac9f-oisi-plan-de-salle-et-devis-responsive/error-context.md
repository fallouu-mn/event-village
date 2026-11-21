# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> clair · client >> tables-fiche-plan — Fiche d’un établissement : créneau choisi, plan de salle et devis
- Location: e2e/responsive.spec.ts:76:21

# Error details

```
Error: contrôles responsive de tables-fiche-plan (clair)

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 7

- Array []
+ Array [
+   "320 px : textes qui se chevauchent : span.block.break-words « Salle climatisée » sur span.break-all.text-sm « 1 » (8×14 px) ; span.block.break-words « Salle climatisée » sur span.break-all.text-sm « 2 » (8×14 px) ; span.block.break-words « Salle climatisée » sur span.break-all.text-sm « 3 » (8×14 px) ; span.block.break-words « Terrasse » sur span.break-all.text-sm « 6 » (8×17 px)",
+   "360 px : textes qui se chevauchent : span.block.break-words « Salle climatisée » sur span.break-all.text-sm « 1 » (8×9 px) ; span.block.break-words « Salle climatisée » sur span.break-all.text-sm « 2 » (8×9 px) ; span.block.break-words « Terrasse » sur span.break-all.text-sm « 6 » (8×13 px)",
+   "390 px : textes qui se chevauchent : span.block.break-words « Salle climatisée » sur span.break-all.text-sm « 1 » (8×5 px) ; span.block.break-words « Salle climatisée » sur span.break-all.text-sm « 2 » (8×5 px) ; span.block.break-words « Terrasse » sur span.break-all.text-sm « 6 » (8×10 px)",
+   "1024 px : textes qui se chevauchent : span.break-all.text-sm « 6 » sur span.block.break-words « Terrasse » (8×10 px) ; span.break-all.text-sm « 1 » sur span.block.break-words « Salle climatisée » (8×12 px) ; span.break-all.text-sm « 2 » sur span.block.break-words « Salle climatisée » (4×12 px) ; span.block.break-words « Salle climatisée » sur small.inline-flex.items-center « 2 » (7×3 px) ; span.block.break-words « Terrasse » sur small.inline-flex.items-center « 4 » (7×5 px) ; small.inline-flex.items-center « 4 » sur span.block.break-words « Terrasse » (5×10 px) ; small.inline-flex.items-center « 2 » sur span.block.break-words « Salle climatisée » (7×12 px) ; span.block.break-words « Terrasse » sur span.break-all.text-sm « 7 » (8×13 px) ; span.block.break-words « Salle climatisée » sur span.break-all.text-sm « 4 » (7×15 px)",
+   "1440 px : textes qui se chevauchent : span.block.break-words « Salle climatisée » sur span.break-all.text-sm « 1 » (8×9 px) ; span.block.break-words « Salle climatisée » sur span.break-all.text-sm « 2 » (8×9 px) ; span.block.break-words « Terrasse » sur span.break-all.text-sm « 6 » (8×13 px)",
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
            - link "Commandes" [ref=f5e27] [cursor=pointer]:
              - /url: /orders
            - link "Portefeuille" [ref=f5e32] [cursor=pointer]:
              - /url: /wallet
        - generic [ref=f5e37]:
          - paragraph [ref=f5e38]: Services et espaces
          - generic [ref=f5e39]:
            - link "Salles de fête" [ref=f5e40] [cursor=pointer]:
              - /url: /halls
            - link "Restaurants et tables" [ref=f5e46] [cursor=pointer]:
              - /url: /restaurants/rest-terrou-bi/tables
        - generic [ref=f5e51]:
          - paragraph [ref=f5e52]: Espaces métier
          - link "Devenir partenaire" [ref=f5e54] [cursor=pointer]:
            - /url: /partner/register
      - generic [ref=f5e60]:
        - link "Fatou Mbaye Client" [ref=f5e61] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=f5e62]: FM
          - generic [ref=f5e63]:
            - generic [ref=f5e64]: Fatou Mbaye
            - generic [ref=f5e65]: Client
        - generic [ref=f5e66]:
          - button "Se déconnecter" [ref=f5e67] [cursor=pointer]
          - button "Basculer le thème" [ref=f5e72] [cursor=pointer]
    - generic [ref=f5e76]:
      - banner [ref=f5e77]:
        - link "Rechercher un événement…" [ref=f5e79] [cursor=pointer]:
          - /url: /explore
        - button "Notifications, 13 non lues" [ref=f5e86] [cursor=pointer]:
          - generic [ref=f5e90]: "13"
      - main [ref=f5e91]:
        - generic [ref=f5e93]:
          - link "Tous les établissements" [ref=f5e94] [cursor=pointer]:
            - /url: /tables
          - generic [ref=f5e99]:
            - article [ref=f5e100]:
              - region "Photos de La Terrasse du Plateau" [ref=f5e101]:
                - img "Photo 1 sur 2 de La Terrasse du Plateau" [ref=f5e104]
                - button "Photo précédente" [ref=f5e107] [cursor=pointer]
                - button "Photo suivante" [ref=f5e111] [cursor=pointer]
                - generic:
                  - paragraph: Photo 1 sur 2
              - generic [ref=f5e115]:
                - generic [ref=f5e116]: Restaurant
                - heading "La Terrasse du Plateau" [level=1] [ref=f5e118]
                - paragraph [ref=f5e119]:
                  - generic [ref=f5e123]: 8, rue Carnot, Dakar-Plateau, Dakar
                - paragraph [ref=f5e124]: Proposé par Baobab Scène
              - list "L’essentiel" [ref=f5e125]:
                - listitem [ref=f5e126]:
                  - generic [ref=f5e131]:
                    - paragraph [ref=f5e132]: Acompte 5 000 F CFA par personne
                    - paragraph [ref=f5e133]: Payé en ligne pour garder la table, frais de service en plus
                - listitem [ref=f5e134]:
                  - generic [ref=f5e138]:
                    - paragraph [ref=f5e139]: Confirmation immédiate
                    - paragraph [ref=f5e140]: Votre table est confirmée tout de suite
                - listitem [ref=f5e141]:
                  - generic [ref=f5e148]:
                    - paragraph [ref=f5e149]: De 1 à 8 personnes
                    - paragraph [ref=f5e150]: Selon les tables de l’établissement
                - listitem [ref=f5e151]:
                  - generic [ref=f5e156]:
                    - paragraph [ref=f5e157]: Table pour 2 h
                    - paragraph [ref=f5e158]: Durée prévue pour votre repas ou votre soirée
              - region [ref=f5e159]:
                - heading "À propos" [level=2] [ref=f5e160]
                - paragraph [ref=f5e161]: "Cuisine sénégalaise et grillades de la mer au cœur du Plateau : thiéboudiène le midi, poissons braisés le soir. Salle climatisée et terrasse ombragée ; menus de groupe sur demande."
              - region [ref=f5e162]:
                - heading "Horaires" [level=2] [ref=f5e163]
                - list [ref=f5e164]:
                  - listitem [ref=f5e165]:
                    - generic [ref=f5e166]: Lundi
                    - generic [ref=f5e167]:
                      - generic [ref=f5e168]: 12 h à 15 h
                      - generic [ref=f5e169]: 19 h à 23 h 30
                  - listitem [ref=f5e170]:
                    - generic [ref=f5e171]: Mardi
                    - generic [ref=f5e172]:
                      - generic [ref=f5e173]: 12 h à 15 h
                      - generic [ref=f5e174]: 19 h à 23 h 30
                  - listitem [ref=f5e175]:
                    - generic [ref=f5e176]: Mercredi
                    - generic [ref=f5e177]:
                      - generic [ref=f5e178]: 12 h à 15 h
                      - generic [ref=f5e179]: 19 h à 23 h 30
                  - listitem [ref=f5e180]:
                    - generic [ref=f5e181]: Jeudi
                    - generic [ref=f5e182]:
                      - generic [ref=f5e183]: 12 h à 15 h
                      - generic [ref=f5e184]: 19 h à 23 h 30
                  - listitem [ref=f5e185]:
                    - generic [ref=f5e186]: Vendredi
                    - generic [ref=f5e187]:
                      - generic [ref=f5e188]: 12 h à 15 h
                      - generic [ref=f5e189]: 19 h à 23 h 30
                  - listitem [ref=f5e190]:
                    - generic [ref=f5e191]: Samedi · aujourd’hui
                    - generic [ref=f5e192]:
                      - generic [ref=f5e193]: 12 h à 15 h
                      - generic [ref=f5e194]: 19 h à 23 h 30
                  - listitem [ref=f5e195]:
                    - generic [ref=f5e196]: Dimanche
                    - generic [ref=f5e197]:
                      - generic [ref=f5e198]: 12 h à 15 h
                      - generic [ref=f5e199]: 19 h à 23 h 30
                - generic [ref=f5e200]:
                  - heading "Fermetures exceptionnelles à venir" [level=3] [ref=f5e201]
                  - list [ref=f5e206]:
                    - listitem [ref=f5e207]: Mardi 1 décembre, toute la journée
              - region [ref=f5e208]:
                - heading "Adresse" [level=2] [ref=f5e209]
                - paragraph [ref=f5e210]: 8, rue Carnot, Dakar-Plateau, Dakar
                - generic [ref=f5e211]:
                  - img "La Terrasse du Plateau, 8, rue Carnot, Dakar-Plateau, Dakar" [ref=f5e218]:
                    - generic [ref=f5e219]: La Terrasse du Plateau
                  - button "Afficher la carte" [ref=f5e223] [cursor=pointer]
                - link "Voir l’itinéraire" [ref=f5e228] [cursor=pointer]:
                  - /url: https://www.google.com/maps/dir/?api=1&destination=14.6681,-17.4335
              - region [ref=f5e238]:
                - heading "Bon à savoir" [level=2] [ref=f5e239]
                - list [ref=f5e240]:
                  - listitem [ref=f5e241]:
                    - generic [ref=f5e246]:
                      - heading "Annulation" [level=3] [ref=f5e247]
                      - paragraph [ref=f5e248]: "Annulation gratuite jusqu’à 2 h avant l’heure : l’acompte vous est rendu en entier. Après, il est gardé par l’établissement."
                  - listitem [ref=f5e249]:
                    - generic [ref=f5e254]:
                      - heading "Retard" [level=3] [ref=f5e255]
                      - paragraph [ref=f5e256]: Votre table est gardée 30 minutes après l’heure prévue. Au-delà, elle peut être donnée à d’autres clients.
                  - listitem [ref=f5e257]:
                    - generic [ref=f5e262]:
                      - heading "Paiement de l’acompte" [level=3] [ref=f5e263]
                      - paragraph [ref=f5e264]: "Après la réservation, vous avez 15 minutes pour payer par Wave ou Orange Money ; sinon la table est libérée. Des frais de service s’ajoutent : leur montant exact s’affiche avant de réserver."
            - complementary [ref=f5e265]:
              - generic [ref=f5e266]:
                - generic [ref=f5e267]:
                  - heading "Réserver une table" [level=2] [ref=f5e268]
                  - list [ref=f5e269]:
                    - listitem [ref=f5e270]: Acompte 5 000 F CFA par personne
                    - listitem [ref=f5e274]: Confirmation immédiate
                - region [ref=f5e277]:
                  - heading "Combien de personnes ?" [level=3] [ref=f5e279]:
                    - generic [aria-hidden] [ref=f5e280]: "1"
                    - text: Combien de personnes ?
                  - generic [ref=f5e281]:
                    - generic [ref=f5e282]: Personnes
                    - generic [ref=f5e283]:
                      - button "Une personne de moins" [ref=f5e284] [cursor=pointer]
                      - generic [ref=f5e287]:
                        - textbox "Personnes" [ref=f5e288]: "4"
                        - generic [aria-hidden] [ref=f5e289]: personnes
                      - button "Une personne de plus" [ref=f5e290] [cursor=pointer]
                    - paragraph [ref=f5e293]: Tables de 1 à 8 personnes. Plus de 50 ? Contactez l’établissement.
                - region [ref=f5e294]:
                  - heading "Quel jour ?" [level=3] [ref=f5e296]:
                    - generic [aria-hidden] [ref=f5e297]: "2"
                    - text: Quel jour ?
                  - group "Jour" [ref=f5e298]:
                    - generic [ref=f5e300]:
                      - button "Aujourd’hui, samedi 21 novembre" [ref=f5e301] [cursor=pointer]:
                        - generic [ref=f5e302]: Auj.
                        - generic [ref=f5e303]: "21"
                        - generic [ref=f5e304]: nov
                      - button "Demain, dimanche 22 novembre" [ref=f5e305] [cursor=pointer]:
                        - generic [ref=f5e306]: Dem.
                        - generic [ref=f5e307]: "22"
                        - generic [ref=f5e308]: nov
                      - button "lundi 23 novembre" [ref=f5e309] [cursor=pointer]:
                        - generic [ref=f5e310]: lun
                        - generic [ref=f5e311]: "23"
                        - generic [ref=f5e312]: nov
                      - button "mardi 24 novembre" [pressed] [ref=f5e313] [cursor=pointer]:
                        - generic [ref=f5e314]: mar
                        - generic [ref=f5e315]: "24"
                        - generic [ref=f5e316]: nov
                      - button "mercredi 25 novembre" [ref=f5e317] [cursor=pointer]:
                        - generic [ref=f5e318]: mer
                        - generic [ref=f5e319]: "25"
                        - generic [ref=f5e320]: nov
                      - button "jeudi 26 novembre" [ref=f5e321] [cursor=pointer]:
                        - generic [ref=f5e322]: jeu
                        - generic [ref=f5e323]: "26"
                        - generic [ref=f5e324]: nov
                      - button "vendredi 27 novembre" [ref=f5e325] [cursor=pointer]:
                        - generic [ref=f5e326]: ven
                        - generic [ref=f5e327]: "27"
                        - generic [ref=f5e328]: nov
                      - button "samedi 28 novembre" [ref=f5e329] [cursor=pointer]:
                        - generic [ref=f5e330]: sam
                        - generic [ref=f5e331]: "28"
                        - generic [ref=f5e332]: nov
                      - button "dimanche 29 novembre" [ref=f5e333] [cursor=pointer]:
                        - generic [ref=f5e334]: dim
                        - generic [ref=f5e335]: "29"
                        - generic [ref=f5e336]: nov
                      - button "lundi 30 novembre" [ref=f5e337] [cursor=pointer]:
                        - generic [ref=f5e338]: lun
                        - generic [ref=f5e339]: "30"
                        - generic [ref=f5e340]: nov
                      - button "mardi 1 décembre" [ref=f5e341] [cursor=pointer]:
                        - generic [ref=f5e342]: mar
                        - generic [ref=f5e343]: "1"
                        - generic [ref=f5e344]: déc
                      - button "mercredi 2 décembre" [ref=f5e345] [cursor=pointer]:
                        - generic [ref=f5e346]: mer
                        - generic [ref=f5e347]: "2"
                        - generic [ref=f5e348]: déc
                      - button "jeudi 3 décembre" [ref=f5e349] [cursor=pointer]:
                        - generic [ref=f5e350]: jeu
                        - generic [ref=f5e351]: "3"
                        - generic [ref=f5e352]: déc
                      - button "vendredi 4 décembre" [ref=f5e353] [cursor=pointer]:
                        - generic [ref=f5e354]: ven
                        - generic [ref=f5e355]: "4"
                        - generic [ref=f5e356]: déc
                    - generic [ref=f5e357]:
                      - generic [ref=f5e358]: Autre jour
                      - textbox "Autre jour" [ref=f5e360]
                      - paragraph [ref=f5e361]: Jusqu’à 90 jours à l’avance.
                - region [ref=f5e362]:
                  - generic [ref=f5e363]:
                    - heading "À quelle heure ?" [level=3] [ref=f5e364]:
                      - generic [aria-hidden] [ref=f5e365]: "3"
                      - text: À quelle heure ?
                    - paragraph [ref=f5e366]: Table pour 2 h
                  - group "Zone (facultatif)" [ref=f5e367]:
                    - button "Toutes les zones" [pressed] [ref=f5e368] [cursor=pointer]:
                      - generic [aria-hidden] [ref=f5e369]: ✓
                      - text: Toutes les zones
                    - button "Salle climatisée" [ref=f5e370] [cursor=pointer]
                    - button "Terrasse" [ref=f5e375] [cursor=pointer]
                  - status [ref=f5e380]
                  - generic [ref=f5e381]:
                    - generic [ref=f5e382]:
                      - heading "Midi" [level=4] [ref=f5e383]
                      - list [ref=f5e384]:
                        - listitem [ref=f5e385]:
                          - button "12 h" [ref=f5e386] [cursor=pointer]
                        - listitem [ref=f5e388]:
                          - button "12 h 30" [ref=f5e389] [cursor=pointer]
                        - listitem [ref=f5e391]:
                          - button "13 h" [ref=f5e392] [cursor=pointer]
                    - generic [ref=f5e394]:
                      - heading "Soir" [level=4] [ref=f5e395]
                      - list [ref=f5e396]:
                        - listitem [ref=f5e397]:
                          - button "19 h" [ref=f5e398] [cursor=pointer]
                        - listitem [ref=f5e400]:
                          - button "19 h 30" [ref=f5e401] [cursor=pointer]
                        - listitem [ref=f5e403]:
                          - button "20 h" [pressed] [ref=f5e404] [cursor=pointer]
                        - listitem [ref=f5e408]:
                          - button "20 h 30" [ref=f5e409] [cursor=pointer]
                        - listitem [ref=f5e411]:
                          - button "21 h" [ref=f5e412] [cursor=pointer]
                        - listitem [ref=f5e414]:
                          - button "21 h 30" [ref=f5e415] [cursor=pointer]
                - region [ref=f5e417]:
                  - heading "Votre table (facultatif)" [level=3] [ref=f5e419]:
                    - generic [aria-hidden] [ref=f5e420]: "4"
                    - text: Votre table (facultatif)
                  - generic [ref=f5e421]:
                    - paragraph [ref=f5e422]:
                      - generic [ref=f5e428]: Touchez une table libre pour la choisir. Sans choix, l’établissement vous en attribue une qui convient.
                    - generic [ref=f5e429]:
                      - group "Plan de salle de La Terrasse du Plateau à 20 h" [ref=f5e430]:
                        - generic [ref=f5e431]:
                          - generic: Salle climatisée
                          - generic: Terrasse
                          - button "Table 1, 2 places, ne convient pas au nombre de personnes, Pour 2 personnes" [disabled] [ref=f5e432]:
                            - generic [aria-hidden] [ref=f5e434]:
                              - generic [ref=f5e435]: "1"
                              - generic [ref=f5e436]: "2"
                          - button "Table 2, 2 places, ne convient pas au nombre de personnes, Pour 2 personnes" [disabled] [ref=f5e442]:
                            - generic [aria-hidden] [ref=f5e444]:
                              - generic [ref=f5e445]: "2"
                              - generic [ref=f5e446]: "2"
                          - button "Table 3, 2 à 4 places, déjà prise à cette heure, Déjà réservée à cette heure" [disabled] [ref=f5e452]:
                            - generic [aria-hidden] [ref=f5e454]:
                              - generic [ref=f5e455]: "3"
                              - generic [ref=f5e456]: "4"
                          - button "Table 4, 2 à 4 places, libre, 4 places" [ref=f5e466] [cursor=pointer]:
                            - generic [aria-hidden] [ref=f5e468]:
                              - generic [ref=f5e469]: "4"
                              - generic [ref=f5e470]: "4"
                          - button "Table 5, 3 à 6 places, libre, 6 places" [ref=f5e476] [cursor=pointer]:
                            - generic [aria-hidden] [ref=f5e478]:
                              - generic [ref=f5e479]: "5"
                              - generic [ref=f5e480]: "6"
                          - button "Table 6, 2 à 4 places, libre, 4 places" [ref=f5e486] [cursor=pointer]:
                            - generic [aria-hidden] [ref=f5e488]:
                              - generic [ref=f5e489]: "6"
                              - generic [ref=f5e490]: "4"
                          - button "Table 7, 3 à 6 places, libre, 6 places" [ref=f5e496] [cursor=pointer]:
                            - generic [aria-hidden] [ref=f5e498]:
                              - generic [ref=f5e499]: "7"
                              - generic [ref=f5e500]: "6"
                          - button "Table 8, 4 à 8 places, libre, 8 places" [ref=f5e506] [cursor=pointer]:
                            - generic [aria-hidden] [ref=f5e508]:
                              - generic [ref=f5e509]: "8"
                              - generic [ref=f5e510]: "8"
                      - list "Légende du plan" [ref=f5e516]:
                        - listitem [ref=f5e517]:
                          - generic [ref=f5e519]: Libre
                        - listitem [ref=f5e520]:
                          - generic [ref=f5e522]: Votre choix
                        - listitem [ref=f5e523]:
                          - generic [ref=f5e525]: Déjà prise
                        - listitem [ref=f5e526]:
                          - generic [ref=f5e528]: Ne convient pas au groupe
                      - paragraph [ref=f5e529]: "Flèches : déplacer de 1 %. Majuscule et flèches : déplacer de 5 %. Touche R : tourner la table de 15 degrés."
                      - paragraph [ref=f5e530]
                    - paragraph [ref=f5e531]: Aucune table choisie
                - region [ref=f5e532]:
                  - heading "Une demande particulière ?" [level=3] [ref=f5e534]:
                    - generic [aria-hidden] [ref=f5e535]: "5"
                    - text: Une demande particulière ?
                  - generic [ref=f5e536]:
                    - generic [ref=f5e537]:
                      - generic [ref=f5e538]: Demande particulière (facultatif)
                      - generic [ref=f5e539]: 0 / 500
                    - textbox "Demande particulière (facultatif)" [ref=f5e540]:
                      - /placeholder: "Par exemple : anniversaire, chaise haute, table au calme"
                    - paragraph [ref=f5e541]: Transmise à l’établissement avec votre réservation.
                - generic [ref=f5e542]:
                  - paragraph [ref=f5e543]:
                    - generic [ref=f5e548]: Mardi 24 novembre à 20 h · 4 personnes
                  - generic [ref=f5e549]:
                    - status [ref=f5e550]: "Total à payer : 21 000 F CFA."
                    - generic [ref=f5e551]:
                      - generic [ref=f5e552]:
                        - term [ref=f5e553]: Acompte (4 personnes)
                        - definition [ref=f5e554]: 20 000 F CFA
                      - generic [ref=f5e555]:
                        - term [ref=f5e556]: Frais de service
                        - definition [ref=f5e557]: 1 000 F CFA
                      - generic [ref=f5e558]:
                        - term [ref=f5e559]: Total à payer
                        - definition [ref=f5e560]: 21 000 F CFA
                - generic [ref=f5e561]:
                  - button "Réserver et payer l’acompte" [ref=f5e562] [cursor=pointer]
                  - paragraph [ref=f5e564]: Après la réservation, la table vous est gardée 15 minutes, le temps de payer l’acompte par Wave ou Orange Money.
  - alert [ref=f5e565]
```

# Test source

```ts
  20  | import path from 'node:path';
  21  | import type { Page } from '@playwright/test';
  22  | import { test, expect, type CaptureRole, type ThemeKey } from './support/fixtures';
  23  | import { readDemoIds, E2E_OUTPUT_DIR, type DemoIds } from './support/demo-ids';
  24  | import { fakeScanMode, installFakeCamera } from './support/fake-camera';
  25  | import {
  26  |     PHONE_MAX_WIDTH, RESPONSIVE_CAPTURE_WIDTHS, RESPONSIVE_LANDSCAPE, RESPONSIVE_PAGES, RESPONSIVE_WIDTHS, type ResponsivePage,
  27  | } from './support/responsive-pages';
  28  | import { runResponsiveChecks } from './support/responsive-checks';
  29  | import { keepHomeOutOfServicesWindow } from './support/services-switch';
  30  | 
  31  | const RESULTS = path.join(E2E_OUTPUT_DIR, 'responsive');
  32  | const SHOTS = path.join(E2E_OUTPUT_DIR, 'captures-responsive');
  33  | 
  34  | const THEMES: ReadonlyArray<{ key: ThemeKey; colorScheme: 'light' | 'dark' }> = [
  35  |     { key: 'clair', colorScheme: 'light' },
  36  |     { key: 'sombre', colorScheme: 'dark' },
  37  | ];
  38  | 
  39  | interface Size { width: number; height: number; paysage?: boolean }
  40  | 
  41  | function sizesFor(p: ResponsivePage, theme: ThemeKey): Size[] {
  42  |     const base: Size[] = RESPONSIVE_WIDTHS
  43  |         .filter((w) => theme === 'clair' || RESPONSIVE_CAPTURE_WIDTHS.includes(w.width))
  44  |         .map((w) => ({ width: w.width, height: w.height }));
  45  |     const land: Size[] = p.paysage ? RESPONSIVE_LANDSCAPE.map((w) => ({ width: w.width, height: w.height, paysage: true })) : [];
  46  |     return [...base, ...land];
  47  | }
  48  | 
  49  | /** Page stable : polices chargées, réseau au repos (plafond 3 s, noté sinon), deux images d'affichage. */
  50  | async function settle(page: Page, notes: string[], at: string): Promise<void> {
  51  |     await page.evaluate(() => document.fonts.ready.then(() => true));
  52  |     await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => { notes.push(`${at} : réseau jamais au repos en 3 s (attente plafonnée)`); });
  53  |     await page.waitForFunction(() => Array.from(document.images).every((img) => img.complete), undefined, { timeout: 5_000 })
  54  |         .catch(() => { notes.push(`${at} : images encore en chargement après 5 s`); });
  55  |     await page.evaluate(() => new Promise<void>((resolve) => { requestAnimationFrame(() => requestAnimationFrame(() => resolve())); }));
  56  | }
  57  | 
  58  | interface ResponsiveRecord {
  59  |     page: string;
  60  |     titre: string;
  61  |     groupe: string;
  62  |     role: CaptureRole;
  63  |     theme: ThemeKey;
  64  |     url: string | null;
  65  |     sizes: Array<{ size: string; blocking: string[]; warnings: string[]; capture: string | null }>;
  66  |     notes: string[];
  67  |     error: string | null;
  68  | }
  69  | 
  70  | for (const theme of THEMES) {
  71  |     const roles = Array.from(new Set(RESPONSIVE_PAGES.map((p) => p.role)));
  72  |     for (const role of roles) {
  73  |         test.describe(`${theme.key} · ${role}`, () => {
  74  |             test.use({ colorScheme: theme.colorScheme, evTheme: theme.key, evRole: role });
  75  |             for (const p of RESPONSIVE_PAGES.filter((x) => x.role === role)) {
  76  |                 test(`${p.id} — ${p.titre}`, async ({ page, context, guard, servicesLock }) => {
  77  |                     test.setTimeout(240_000);
  78  |                     const record: ResponsiveRecord = { page: p.id, titre: p.titre, groupe: p.groupe, role, theme: theme.key, url: null, sizes: [], notes: [], error: null };
  79  |                     try {
  80  |                         // Lot 10b (lot 11b : salles et tables) : verrou des services avant tout chargement (attente ajoutée au délai du test)
  81  |                         await servicesLock.enter(p.services ? 'services' : 'autres');
  82  |                         if (servicesLock.waitedMs >= 1_000) record.notes.push(`attente du verrou des services : ${Math.round(servicesLock.waitedMs / 1000)} s`);
  83  |                         if (p.services) {
  84  |                             record.notes.push('page des services : interrupteurs features.halls_enabled et features.tables_enabled ouverts le temps du test (e2e/support/services-switch.ts)');
  85  |                             await keepHomeOutOfServicesWindow(page);
  86  |                         }
  87  |                         const demo: DemoIds | null = p.needsIds ? readDemoIds() : null;
  88  |                         record.url = p.path(demo);
  89  |                         guard.configure({ allowFailures: p.allowFailures ?? [], ignoreConsoleErrors: false });
  90  |                         if (p.fakeCamera) await context.addInitScript(installFakeCamera, { mode: fakeScanMode() });
  91  |                         for (const size of sizesFor(p, theme.key)) {
  92  |                             const at = size.paysage ? `${size.width}×${size.height} px (paysage)` : `${size.width} px`;
  93  |                             await page.setViewportSize({ width: size.width, height: size.height });
  94  |                             const response = await page.goto(record.url, { waitUntil: 'load' });
  95  |                             if (p.expectStatus !== undefined) expect(response?.status(), `statut HTTP de ${record.url}`).toBe(p.expectStatus);
  96  |                             if (p.ready) await p.ready(page);
  97  |                             else await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 30_000 });
  98  |                             if (p.actions) await p.actions(page);
  99  |                             await settle(page, record.notes, at);
  100 |                             const checks = await runResponsiveChecks(page, { width: size.width, phone: !size.paysage && size.width <= PHONE_MAX_WIDTH });
  101 |                             const blocking = checks.blocking.map((b) => (size.paysage ? b.replace(`${size.width} px`, at) : b));
  102 |                             let capture: string | null = null;
  103 |                             if (size.paysage || RESPONSIVE_CAPTURE_WIDTHS.includes(size.width)) {
  104 |                                 fs.mkdirSync(SHOTS, { recursive: true });
  105 |                                 capture = `${p.id}__${size.paysage ? `${size.width}x${size.height}` : size.width}__${theme.key}.jpg`;
  106 |                                 await page.screenshot({ path: path.join(SHOTS, capture), type: 'jpeg', quality: 80, animations: 'disabled', caret: 'hide', scale: 'css' });
  107 |                             }
  108 |                             record.sizes.push({ size: at, blocking, warnings: checks.warnings, capture });
  109 |                         }
  110 |                     } catch (err) {
  111 |                         record.error = err instanceof Error ? err.message.split('\n')[0] : String(err);
  112 |                         throw err;
  113 |                     } finally {
  114 |                         // Erreurs de la page (console, requêtes) : notées, déjà bloquantes dans les captures
  115 |                         record.notes.push(...guard.blockingIssues().map((i) => `erreur de la page : ${i}`));
  116 |                         fs.mkdirSync(RESULTS, { recursive: true });
  117 |                         fs.writeFileSync(path.join(RESULTS, `${p.id}__${theme.key}.json`), `${JSON.stringify(record, null, 1)}\n`, 'utf8');
  118 |                     }
  119 |                     const blocking = record.sizes.flatMap((s) => s.blocking);
> 120 |                     expect(blocking, `contrôles responsive de ${p.id} (${theme.key})`).toEqual([]);
      |                                                                                        ^ Error: contrôles responsive de tables-fiche-plan (clair)
  121 |                 });
  122 |             }
  123 |         });
  124 |     }
  125 | }
  126 | 
```