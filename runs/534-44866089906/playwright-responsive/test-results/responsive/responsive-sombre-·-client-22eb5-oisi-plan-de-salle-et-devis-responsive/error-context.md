# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> sombre · client >> tables-fiche-plan — Fiche d’un établissement : créneau choisi, plan de salle et devis
- Location: e2e/responsive.spec.ts:76:21

# Error details

```
Error: contrôles responsive de tables-fiche-plan (sombre)

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 4

- Array []
+ Array [
+   "360 px : textes qui se chevauchent : span.block.break-words « Salle climatisée » sur span.break-all.text-sm « 1 » (8×9 px) ; span.block.break-words « Salle climatisée » sur span.break-all.text-sm « 2 » (8×9 px) ; span.block.break-words « Terrasse » sur span.break-all.text-sm « 6 » (8×13 px)",
+   "1440 px : textes qui se chevauchent : span.block.break-words « Salle climatisée » sur span.break-all.text-sm « 1 » (8×9 px) ; span.block.break-words « Salle climatisée » sur span.break-all.text-sm « 2 » (8×9 px) ; span.block.break-words « Terrasse » sur span.break-all.text-sm « 6 » (8×13 px)",
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
            - link "Commandes" [ref=f2e27] [cursor=pointer]:
              - /url: /orders
            - link "Portefeuille" [ref=f2e32] [cursor=pointer]:
              - /url: /wallet
        - generic [ref=f2e37]:
          - paragraph [ref=f2e38]: Services et espaces
          - generic [ref=f2e39]:
            - link "Salles de fête" [ref=f2e40] [cursor=pointer]:
              - /url: /halls
            - link "Restaurants et tables" [ref=f2e46] [cursor=pointer]:
              - /url: /restaurants/rest-terrou-bi/tables
        - generic [ref=f2e51]:
          - paragraph [ref=f2e52]: Espaces métier
          - link "Devenir partenaire" [ref=f2e54] [cursor=pointer]:
            - /url: /partner/register
      - generic [ref=f2e60]:
        - link "Fatou Mbaye Client" [ref=f2e61] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=f2e62]: FM
          - generic [ref=f2e63]:
            - generic [ref=f2e64]: Fatou Mbaye
            - generic [ref=f2e65]: Client
        - generic [ref=f2e66]:
          - button "Se déconnecter" [ref=f2e67] [cursor=pointer]
          - button "Basculer le thème" [ref=f2e72] [cursor=pointer]
    - generic [ref=f2e76]:
      - banner [ref=f2e77]:
        - link "Rechercher un événement…" [ref=f2e79] [cursor=pointer]:
          - /url: /explore
        - button "Notifications, 13 non lues" [ref=f2e86] [cursor=pointer]:
          - generic [ref=f2e90]: "13"
      - main [ref=f2e91]:
        - generic [ref=f2e93]:
          - link "Tous les établissements" [ref=f2e94] [cursor=pointer]:
            - /url: /tables
          - generic [ref=f2e99]:
            - article [ref=f2e100]:
              - region "Photos de La Terrasse du Plateau" [ref=f2e101]:
                - img "Photo 1 sur 2 de La Terrasse du Plateau" [ref=f2e104]
                - button "Photo précédente" [ref=f2e107] [cursor=pointer]
                - button "Photo suivante" [ref=f2e111] [cursor=pointer]
                - generic:
                  - paragraph: Photo 1 sur 2
              - generic [ref=f2e115]:
                - generic [ref=f2e116]: Restaurant
                - heading "La Terrasse du Plateau" [level=1] [ref=f2e118]
                - paragraph [ref=f2e119]:
                  - generic [ref=f2e123]: 8, rue Carnot, Dakar-Plateau, Dakar
                - paragraph [ref=f2e124]: Proposé par Baobab Scène
              - list "L’essentiel" [ref=f2e125]:
                - listitem [ref=f2e126]:
                  - generic [ref=f2e131]:
                    - paragraph [ref=f2e132]: Acompte 5 000 F CFA par personne
                    - paragraph [ref=f2e133]: Payé en ligne pour garder la table, frais de service en plus
                - listitem [ref=f2e134]:
                  - generic [ref=f2e138]:
                    - paragraph [ref=f2e139]: Confirmation immédiate
                    - paragraph [ref=f2e140]: Votre table est confirmée tout de suite
                - listitem [ref=f2e141]:
                  - generic [ref=f2e148]:
                    - paragraph [ref=f2e149]: De 1 à 8 personnes
                    - paragraph [ref=f2e150]: Selon les tables de l’établissement
                - listitem [ref=f2e151]:
                  - generic [ref=f2e156]:
                    - paragraph [ref=f2e157]: Table pour 2 h
                    - paragraph [ref=f2e158]: Durée prévue pour votre repas ou votre soirée
              - region [ref=f2e159]:
                - heading "À propos" [level=2] [ref=f2e160]
                - paragraph [ref=f2e161]: "Cuisine sénégalaise et grillades de la mer au cœur du Plateau : thiéboudiène le midi, poissons braisés le soir. Salle climatisée et terrasse ombragée ; menus de groupe sur demande."
              - region [ref=f2e162]:
                - heading "Horaires" [level=2] [ref=f2e163]
                - list [ref=f2e164]:
                  - listitem [ref=f2e165]:
                    - generic [ref=f2e166]: Lundi
                    - generic [ref=f2e167]:
                      - generic [ref=f2e168]: 12 h à 15 h
                      - generic [ref=f2e169]: 19 h à 23 h 30
                  - listitem [ref=f2e170]:
                    - generic [ref=f2e171]: Mardi
                    - generic [ref=f2e172]:
                      - generic [ref=f2e173]: 12 h à 15 h
                      - generic [ref=f2e174]: 19 h à 23 h 30
                  - listitem [ref=f2e175]:
                    - generic [ref=f2e176]: Mercredi
                    - generic [ref=f2e177]:
                      - generic [ref=f2e178]: 12 h à 15 h
                      - generic [ref=f2e179]: 19 h à 23 h 30
                  - listitem [ref=f2e180]:
                    - generic [ref=f2e181]: Jeudi
                    - generic [ref=f2e182]:
                      - generic [ref=f2e183]: 12 h à 15 h
                      - generic [ref=f2e184]: 19 h à 23 h 30
                  - listitem [ref=f2e185]:
                    - generic [ref=f2e186]: Vendredi
                    - generic [ref=f2e187]:
                      - generic [ref=f2e188]: 12 h à 15 h
                      - generic [ref=f2e189]: 19 h à 23 h 30
                  - listitem [ref=f2e190]:
                    - generic [ref=f2e191]: Samedi · aujourd’hui
                    - generic [ref=f2e192]:
                      - generic [ref=f2e193]: 12 h à 15 h
                      - generic [ref=f2e194]: 19 h à 23 h 30
                  - listitem [ref=f2e195]:
                    - generic [ref=f2e196]: Dimanche
                    - generic [ref=f2e197]:
                      - generic [ref=f2e198]: 12 h à 15 h
                      - generic [ref=f2e199]: 19 h à 23 h 30
                - generic [ref=f2e200]:
                  - heading "Fermetures exceptionnelles à venir" [level=3] [ref=f2e201]
                  - list [ref=f2e206]:
                    - listitem [ref=f2e207]: Mardi 1 décembre, toute la journée
              - region [ref=f2e208]:
                - heading "Adresse" [level=2] [ref=f2e209]
                - paragraph [ref=f2e210]: 8, rue Carnot, Dakar-Plateau, Dakar
                - generic [ref=f2e211]:
                  - img "La Terrasse du Plateau, 8, rue Carnot, Dakar-Plateau, Dakar" [ref=f2e218]:
                    - generic [ref=f2e219]: La Terrasse du Plateau
                  - button "Afficher la carte" [ref=f2e223] [cursor=pointer]
                - link "Voir l’itinéraire" [ref=f2e228] [cursor=pointer]:
                  - /url: https://www.google.com/maps/dir/?api=1&destination=14.6681,-17.4335
              - region [ref=f2e238]:
                - heading "Bon à savoir" [level=2] [ref=f2e239]
                - list [ref=f2e240]:
                  - listitem [ref=f2e241]:
                    - generic [ref=f2e246]:
                      - heading "Annulation" [level=3] [ref=f2e247]
                      - paragraph [ref=f2e248]: "Annulation gratuite jusqu’à 2 h avant l’heure : l’acompte vous est rendu en entier. Après, il est gardé par l’établissement."
                  - listitem [ref=f2e249]:
                    - generic [ref=f2e254]:
                      - heading "Retard" [level=3] [ref=f2e255]
                      - paragraph [ref=f2e256]: Votre table est gardée 30 minutes après l’heure prévue. Au-delà, elle peut être donnée à d’autres clients.
                  - listitem [ref=f2e257]:
                    - generic [ref=f2e262]:
                      - heading "Paiement de l’acompte" [level=3] [ref=f2e263]
                      - paragraph [ref=f2e264]: "Après la réservation, vous avez 15 minutes pour payer par Wave ou Orange Money ; sinon la table est libérée. Des frais de service s’ajoutent : leur montant exact s’affiche avant de réserver."
            - complementary [ref=f2e265]:
              - generic [ref=f2e266]:
                - generic [ref=f2e267]:
                  - heading "Réserver une table" [level=2] [ref=f2e268]
                  - list [ref=f2e269]:
                    - listitem [ref=f2e270]: Acompte 5 000 F CFA par personne
                    - listitem [ref=f2e274]: Confirmation immédiate
                - region [ref=f2e277]:
                  - heading "Combien de personnes ?" [level=3] [ref=f2e279]:
                    - generic [aria-hidden] [ref=f2e280]: "1"
                    - text: Combien de personnes ?
                  - generic [ref=f2e281]:
                    - generic [ref=f2e282]: Personnes
                    - generic [ref=f2e283]:
                      - button "Une personne de moins" [ref=f2e284] [cursor=pointer]
                      - generic [ref=f2e287]:
                        - textbox "Personnes" [ref=f2e288]: "4"
                        - generic [aria-hidden] [ref=f2e289]: personnes
                      - button "Une personne de plus" [ref=f2e290] [cursor=pointer]
                    - paragraph [ref=f2e293]: Tables de 1 à 8 personnes. Plus de 50 ? Contactez l’établissement.
                - region [ref=f2e294]:
                  - heading "Quel jour ?" [level=3] [ref=f2e296]:
                    - generic [aria-hidden] [ref=f2e297]: "2"
                    - text: Quel jour ?
                  - group "Jour" [ref=f2e298]:
                    - generic [ref=f2e300]:
                      - button "Aujourd’hui, samedi 21 novembre" [ref=f2e301] [cursor=pointer]:
                        - generic [ref=f2e302]: Auj.
                        - generic [ref=f2e303]: "21"
                        - generic [ref=f2e304]: nov
                      - button "Demain, dimanche 22 novembre" [ref=f2e305] [cursor=pointer]:
                        - generic [ref=f2e306]: Dem.
                        - generic [ref=f2e307]: "22"
                        - generic [ref=f2e308]: nov
                      - button "lundi 23 novembre" [ref=f2e309] [cursor=pointer]:
                        - generic [ref=f2e310]: lun
                        - generic [ref=f2e311]: "23"
                        - generic [ref=f2e312]: nov
                      - button "mardi 24 novembre" [pressed] [ref=f2e313] [cursor=pointer]:
                        - generic [ref=f2e314]: mar
                        - generic [ref=f2e315]: "24"
                        - generic [ref=f2e316]: nov
                      - button "mercredi 25 novembre" [ref=f2e317] [cursor=pointer]:
                        - generic [ref=f2e318]: mer
                        - generic [ref=f2e319]: "25"
                        - generic [ref=f2e320]: nov
                      - button "jeudi 26 novembre" [ref=f2e321] [cursor=pointer]:
                        - generic [ref=f2e322]: jeu
                        - generic [ref=f2e323]: "26"
                        - generic [ref=f2e324]: nov
                      - button "vendredi 27 novembre" [ref=f2e325] [cursor=pointer]:
                        - generic [ref=f2e326]: ven
                        - generic [ref=f2e327]: "27"
                        - generic [ref=f2e328]: nov
                      - button "samedi 28 novembre" [ref=f2e329] [cursor=pointer]:
                        - generic [ref=f2e330]: sam
                        - generic [ref=f2e331]: "28"
                        - generic [ref=f2e332]: nov
                      - button "dimanche 29 novembre" [ref=f2e333] [cursor=pointer]:
                        - generic [ref=f2e334]: dim
                        - generic [ref=f2e335]: "29"
                        - generic [ref=f2e336]: nov
                      - button "lundi 30 novembre" [ref=f2e337] [cursor=pointer]:
                        - generic [ref=f2e338]: lun
                        - generic [ref=f2e339]: "30"
                        - generic [ref=f2e340]: nov
                      - button "mardi 1 décembre" [ref=f2e341] [cursor=pointer]:
                        - generic [ref=f2e342]: mar
                        - generic [ref=f2e343]: "1"
                        - generic [ref=f2e344]: déc
                      - button "mercredi 2 décembre" [ref=f2e345] [cursor=pointer]:
                        - generic [ref=f2e346]: mer
                        - generic [ref=f2e347]: "2"
                        - generic [ref=f2e348]: déc
                      - button "jeudi 3 décembre" [ref=f2e349] [cursor=pointer]:
                        - generic [ref=f2e350]: jeu
                        - generic [ref=f2e351]: "3"
                        - generic [ref=f2e352]: déc
                      - button "vendredi 4 décembre" [ref=f2e353] [cursor=pointer]:
                        - generic [ref=f2e354]: ven
                        - generic [ref=f2e355]: "4"
                        - generic [ref=f2e356]: déc
                    - generic [ref=f2e357]:
                      - generic [ref=f2e358]: Autre jour
                      - textbox "Autre jour" [ref=f2e360]
                      - paragraph [ref=f2e361]: Jusqu’à 90 jours à l’avance.
                - region [ref=f2e362]:
                  - generic [ref=f2e363]:
                    - heading "À quelle heure ?" [level=3] [ref=f2e364]:
                      - generic [aria-hidden] [ref=f2e365]: "3"
                      - text: À quelle heure ?
                    - paragraph [ref=f2e366]: Table pour 2 h
                  - group "Zone (facultatif)" [ref=f2e367]:
                    - button "Toutes les zones" [pressed] [ref=f2e368] [cursor=pointer]:
                      - generic [aria-hidden] [ref=f2e369]: ✓
                      - text: Toutes les zones
                    - button "Salle climatisée" [ref=f2e370] [cursor=pointer]
                    - button "Terrasse" [ref=f2e375] [cursor=pointer]
                  - status [ref=f2e380]
                  - generic [ref=f2e381]:
                    - generic [ref=f2e382]:
                      - heading "Midi" [level=4] [ref=f2e383]
                      - list [ref=f2e384]:
                        - listitem [ref=f2e385]:
                          - button "12 h" [ref=f2e386] [cursor=pointer]
                        - listitem [ref=f2e388]:
                          - button "12 h 30" [ref=f2e389] [cursor=pointer]
                        - listitem [ref=f2e391]:
                          - button "13 h" [ref=f2e392] [cursor=pointer]
                    - generic [ref=f2e394]:
                      - heading "Soir" [level=4] [ref=f2e395]
                      - list [ref=f2e396]:
                        - listitem [ref=f2e397]:
                          - button "19 h" [ref=f2e398] [cursor=pointer]
                        - listitem [ref=f2e400]:
                          - button "19 h 30" [ref=f2e401] [cursor=pointer]
                        - listitem [ref=f2e403]:
                          - button "20 h" [pressed] [ref=f2e404] [cursor=pointer]
                        - listitem [ref=f2e408]:
                          - button "20 h 30" [ref=f2e409] [cursor=pointer]
                        - listitem [ref=f2e411]:
                          - button "21 h" [ref=f2e412] [cursor=pointer]
                        - listitem [ref=f2e414]:
                          - button "21 h 30" [ref=f2e415] [cursor=pointer]
                - region [ref=f2e417]:
                  - heading "Votre table (facultatif)" [level=3] [ref=f2e419]:
                    - generic [aria-hidden] [ref=f2e420]: "4"
                    - text: Votre table (facultatif)
                  - generic [ref=f2e421]:
                    - paragraph [ref=f2e422]:
                      - generic [ref=f2e428]: Touchez une table libre pour la choisir. Sans choix, l’établissement vous en attribue une qui convient.
                    - generic [ref=f2e429]:
                      - group "Plan de salle de La Terrasse du Plateau à 20 h" [ref=f2e430]:
                        - generic [ref=f2e431]:
                          - generic: Salle climatisée
                          - generic: Terrasse
                          - button "Table 1, 2 places, ne convient pas au nombre de personnes, Pour 2 personnes" [disabled] [ref=f2e432]:
                            - generic [aria-hidden] [ref=f2e434]:
                              - generic [ref=f2e435]: "1"
                              - generic [ref=f2e436]: "2"
                          - button "Table 2, 2 places, ne convient pas au nombre de personnes, Pour 2 personnes" [disabled] [ref=f2e442]:
                            - generic [aria-hidden] [ref=f2e444]:
                              - generic [ref=f2e445]: "2"
                              - generic [ref=f2e446]: "2"
                          - button "Table 3, 2 à 4 places, déjà prise à cette heure, Déjà réservée à cette heure" [disabled] [ref=f2e452]:
                            - generic [aria-hidden] [ref=f2e454]:
                              - generic [ref=f2e455]: "3"
                              - generic [ref=f2e456]: "4"
                          - button "Table 4, 2 à 4 places, libre, 4 places" [ref=f2e466] [cursor=pointer]:
                            - generic [aria-hidden] [ref=f2e468]:
                              - generic [ref=f2e469]: "4"
                              - generic [ref=f2e470]: "4"
                          - button "Table 5, 3 à 6 places, libre, 6 places" [ref=f2e476] [cursor=pointer]:
                            - generic [aria-hidden] [ref=f2e478]:
                              - generic [ref=f2e479]: "5"
                              - generic [ref=f2e480]: "6"
                          - button "Table 6, 2 à 4 places, libre, 4 places" [ref=f2e486] [cursor=pointer]:
                            - generic [aria-hidden] [ref=f2e488]:
                              - generic [ref=f2e489]: "6"
                              - generic [ref=f2e490]: "4"
                          - button "Table 7, 3 à 6 places, libre, 6 places" [ref=f2e496] [cursor=pointer]:
                            - generic [aria-hidden] [ref=f2e498]:
                              - generic [ref=f2e499]: "7"
                              - generic [ref=f2e500]: "6"
                          - button "Table 8, 4 à 8 places, libre, 8 places" [ref=f2e506] [cursor=pointer]:
                            - generic [aria-hidden] [ref=f2e508]:
                              - generic [ref=f2e509]: "8"
                              - generic [ref=f2e510]: "8"
                      - list "Légende du plan" [ref=f2e516]:
                        - listitem [ref=f2e517]:
                          - generic [ref=f2e519]: Libre
                        - listitem [ref=f2e520]:
                          - generic [ref=f2e522]: Votre choix
                        - listitem [ref=f2e523]:
                          - generic [ref=f2e525]: Déjà prise
                        - listitem [ref=f2e526]:
                          - generic [ref=f2e528]: Ne convient pas au groupe
                      - paragraph [ref=f2e529]: "Flèches : déplacer de 1 %. Majuscule et flèches : déplacer de 5 %. Touche R : tourner la table de 15 degrés."
                      - paragraph [ref=f2e530]
                    - paragraph [ref=f2e531]: Aucune table choisie
                - region [ref=f2e532]:
                  - heading "Une demande particulière ?" [level=3] [ref=f2e534]:
                    - generic [aria-hidden] [ref=f2e535]: "5"
                    - text: Une demande particulière ?
                  - generic [ref=f2e536]:
                    - generic [ref=f2e537]:
                      - generic [ref=f2e538]: Demande particulière (facultatif)
                      - generic [ref=f2e539]: 0 / 500
                    - textbox "Demande particulière (facultatif)" [ref=f2e540]:
                      - /placeholder: "Par exemple : anniversaire, chaise haute, table au calme"
                    - paragraph [ref=f2e541]: Transmise à l’établissement avec votre réservation.
                - generic [ref=f2e542]:
                  - paragraph [ref=f2e543]:
                    - generic [ref=f2e548]: Mardi 24 novembre à 20 h · 4 personnes
                  - generic [ref=f2e549]:
                    - status [ref=f2e550]: "Total à payer : 21 000 F CFA."
                    - generic [ref=f2e551]:
                      - generic [ref=f2e552]:
                        - term [ref=f2e553]: Acompte (4 personnes)
                        - definition [ref=f2e554]: 20 000 F CFA
                      - generic [ref=f2e555]:
                        - term [ref=f2e556]: Frais de service
                        - definition [ref=f2e557]: 1 000 F CFA
                      - generic [ref=f2e558]:
                        - term [ref=f2e559]: Total à payer
                        - definition [ref=f2e560]: 21 000 F CFA
                - generic [ref=f2e561]:
                  - button "Réserver et payer l’acompte" [ref=f2e562] [cursor=pointer]
                  - paragraph [ref=f2e564]: Après la réservation, la table vous est gardée 15 minutes, le temps de payer l’acompte par Wave ou Orange Money.
  - alert [ref=f2e565]
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
      |                                                                                        ^ Error: contrôles responsive de tables-fiche-plan (sombre)
  121 |                 });
  122 |             }
  123 |         });
  124 |     }
  125 | }
  126 | 
```