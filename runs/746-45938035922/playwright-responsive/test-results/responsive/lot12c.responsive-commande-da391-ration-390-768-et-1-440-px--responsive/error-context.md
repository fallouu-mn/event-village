# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: lot12c.responsive.spec.ts >> commandes · clair : catalogue, réglages, zones, commandes, code, livreurs, administration (390, 768 et 1 440 px)
- Location: e2e/lot12c.responsive.spec.ts:204:9

# Error details

```
Error: mode comptoir (390 px) : défauts bloquants
390 px : texte coupé : span.tabular-nums « Pour 07:15 » dépasse de div.relative.min-h-0 «  » ; span.absolute.inset-0 « 15 » dépasse de div.relative.min-h-0 «  » ; span « Délai pour accepter » dépasse de div.relative.min-h-0 «  » ; p.text-sm.tabular-nums « Encore 14 min 58 s » dépasse de div.relative.min-h-0 «  » ; span.font-bold.tabular-nums « 1 » dépasse de div.relative.min-h-0 «  » ; li.break-words « Thiakry » dépasse de div.relative.min-h-0 «  » ; span.font-bold.tabular-nums « 3 » dépasse de div.relative.min-h-0 «  » ; li.break-words « Yassa poulet » dépasse de div.relative.min-h-0 «  » ; p.text-lg.font-bold « 12 000 F CFA » dépasse de div.relative.min-h-0 «  » ; p.text-sm.font-semibold « À encaisser : » dépasse de div.relative.min-h-0 «  » ; span.tabular-nums « 12 000 F CFA » dépasse de div.relative.min-h-0 «  » ; span.min-w-0 « Accepter » dépasse de div.relative.min-h-0 «  »

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "390 px : texte coupé : span.tabular-nums « Pour 07:15 » dépasse de div.relative.min-h-0 «  » ; span.absolute.inset-0 « 15 » dépasse de div.relative.min-h-0 «  » ; span « Délai pour accepter » dépasse de div.relative.min-h-0 «  » ; p.text-sm.tabular-nums « Encore 14 min 58 s » dépasse de div.relative.min-h-0 «  » ; span.font-bold.tabular-nums « 1 » dépasse de div.relative.min-h-0 «  » ; li.break-words « Thiakry » dépasse de div.relative.min-h-0 «  » ; span.font-bold.tabular-nums « 3 » dépasse de div.relative.min-h-0 «  » ; li.break-words « Yassa poulet » dépasse de div.relative.min-h-0 «  » ; p.text-lg.font-bold « 12 000 F CFA » dépasse de div.relative.min-h-0 «  » ; p.text-sm.font-semibold « À encaisser : » dépasse de div.relative.min-h-0 «  » ; span.tabular-nums « 12 000 F CFA » dépasse de div.relative.min-h-0 «  » ; span.min-w-0 « Accepter » dépasse de div.relative.min-h-0 «  »",
+ ]
```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e2]:
    - generic [ref=e3]:
      - banner [ref=e4]:
        - generic [ref=e5]:
          - button "Ouvrir le menu" [ref=e6] [cursor=pointer]
          - link "Event Village, accueil" [ref=e10] [cursor=pointer]:
            - /url: /
        - generic [ref=e13]:
          - button "Notifications, 28 non lues" [ref=e15] [cursor=pointer]:
            - generic [ref=e19]: "28"
          - button "Basculer le thème" [ref=e21] [cursor=pointer]
          - link "Mon profil (Ousmane Faye)" [ref=e25] [cursor=pointer]:
            - /url: /profile
            - generic [aria-hidden] [ref=e26]: OF
      - main [ref=e28]:
        - generic [ref=e30]:
          - generic [ref=e32]:
            - generic [ref=e33]:
              - heading "Commandes" [level=1] [ref=e34]
              - paragraph [ref=e35]: "Gardez cette page ouverte : chaque nouvelle commande sonne et s’affiche ici, mise à jour toutes les 5 secondes."
            - generic [ref=e36]:
              - button "Couper le son des nouvelles commandes" [ref=e37] [cursor=pointer]
              - button "Mode comptoir" [ref=e43] [cursor=pointer]
              - link "Livreurs" [ref=e49] [cursor=pointer]:
                - /url: /partner/orders/livreurs
          - status [ref=e57]:
            - generic [ref=e58]: Mis à jour à 04:14 · son activé
          - region [ref=e59]:
            - heading "Ma journée" [level=2] [ref=e60]
            - generic [ref=e61]:
              - generic [ref=e62]:
                - paragraph [ref=e64]: Commandes reçues aujourd’hui
                - paragraph [ref=e68]: "8"
                - paragraph [ref=e69]: 6 en cours
              - generic [ref=e70]:
                - paragraph [ref=e72]: À accepter
                - paragraph [ref=e81]: "2"
                - paragraph [ref=e82]: Répondez avant la fin du délai
              - generic [ref=e83]:
                - paragraph [ref=e85]: Recette du jour
                - paragraph [ref=e90]: 5 000 F CFA
                - paragraph [ref=e91]: 2 remises · en ligne 0 F CFA · sur place 5 000 F CFA
              - generic [ref=e92]:
                - paragraph [ref=e93]: Bientôt épuisés
                - list [ref=e96]:
                  - listitem [ref=e97]:
                    - generic [ref=e98]: Thiakry
                    - generic [ref=e99]: 3 unités
            - generic [ref=e100]:
              - paragraph [ref=e101]: Plats du jour en vente
              - list [ref=e107]:
                - listitem [ref=e108]:
                  - generic [ref=e109]:
                    - generic [ref=e110]: Thiéboudienne du jour
                    - generic [ref=e111]: 50 restantes
                  - button "Plus de Thiéboudienne du jour" [ref=e112] [cursor=pointer]
          - tablist "Commandes en cours ou terminées" [ref=e119]:
            - tab "En cours , 6" [selected] [ref=e120] [cursor=pointer]:
              - generic [ref=e121]: En cours
              - generic [ref=e122]:
                - generic [ref=e123]: ","
                - text: "6"
            - tab "Terminées" [ref=e124] [cursor=pointer]
          - tabpanel "En cours , 6" [ref=e126]:
            - generic [ref=e127]:
              - tablist "Étapes des commandes" [ref=e129]:
                - tab "Reçues , 3" [selected] [ref=e130] [cursor=pointer]:
                  - generic [ref=e131]: Reçues
                  - generic [ref=e132]:
                    - generic [ref=e133]: ","
                    - text: "3"
                - tab "En préparation , 1" [ref=e134] [cursor=pointer]:
                  - generic [ref=e135]: En préparation
                  - generic [ref=e136]:
                    - generic [ref=e137]: ","
                    - text: "1"
                - tab "Prêtes , 1" [ref=e138] [cursor=pointer]:
                  - generic [ref=e139]: Prêtes
                  - generic [ref=e140]:
                    - generic [ref=e141]: ","
                    - text: "1"
                - tab "En route , 1" [ref=e142] [cursor=pointer]:
                  - generic [ref=e143]: En route
                  - generic [ref=e144]:
                    - generic [ref=e145]: ","
                    - text: "1"
              - tabpanel "Reçues , 3" [ref=e146]:
                - generic [ref=e147]:
                  - article [ref=e148]:
                    - generic [ref=e149]:
                      - generic [ref=e150]:
                        - heading "Commande 400C90" [level=3] [ref=e151]:
                          - generic [ref=e152]: Commande
                          - text: 400C90
                        - paragraph [aria-hidden] [ref=e153]: CMD-261127-400C90
                        - paragraph [ref=e154]:
                          - generic [ref=e155]: Retrait sur place
                      - generic [ref=e159]: Reçue
                    - generic [ref=e163]:
                      - generic [ref=e168]:
                        - text: "15"
                        - generic [ref=e169]: minutes
                      - generic [ref=e170]:
                        - paragraph [ref=e171]:
                          - status [ref=e172]: Délai pour accepter
                        - paragraph [aria-hidden] [ref=e173]: Encore 14 min 58 s
                    - list [ref=e174]:
                      - listitem [ref=e175]:
                        - generic [ref=e176]: 2 ×
                        - text: Bissap maison
                      - listitem [ref=e177]:
                        - generic [ref=e178]: 2 ×
                        - text: Yassa poulet
                    - generic [ref=e179]:
                      - paragraph [ref=e180]: 9 000 F CFA
                      - paragraph [ref=e181]: "À encaisser : 9 000 F CFA"
                    - generic [ref=e182]:
                      - button "Accepter" [ref=e183] [cursor=pointer]
                      - link "Ouvrir la commande CMD-261127-400C90" [ref=e185] [cursor=pointer]:
                        - /url: /partner/orders/f007856f-304a-41d2-9aea-96e1b0230d2b
                        - generic [ref=e186]: Voir ou refuser
                  - article [ref=e190]:
                    - generic [ref=e191]:
                      - generic [ref=e192]:
                        - heading "Commande F742DE" [level=3] [ref=e193]:
                          - generic [ref=e194]: Commande
                          - text: F742DE
                        - paragraph [aria-hidden] [ref=e195]: CMD-261127-F742DE
                        - paragraph [ref=e196]:
                          - generic [ref=e197]: Sur place
                          - generic [ref=e201]: · Terrasse 4
                      - generic [ref=e202]: Reçue
                    - paragraph [ref=e205]:
                      - generic [ref=e210]: Pour 07:15
                    - generic [ref=e212]:
                      - generic [ref=e217]:
                        - text: "15"
                        - generic [ref=e218]: minutes
                      - generic [ref=e219]:
                        - paragraph [ref=e220]:
                          - status [ref=e221]: Délai pour accepter
                        - paragraph [aria-hidden] [ref=e222]: Encore 14 min 58 s
                    - list [ref=e223]:
                      - listitem [ref=e224]:
                        - generic [ref=e225]: 1 ×
                        - text: Thiakry
                      - listitem [ref=e226]:
                        - generic [ref=e227]: 3 ×
                        - text: Yassa poulet
                    - generic [ref=e228]:
                      - paragraph [ref=e229]: 12 000 F CFA
                      - paragraph [ref=e230]: "À encaisser : 12 000 F CFA"
                    - generic [ref=e231]:
                      - button "Accepter" [ref=e232] [cursor=pointer]
                      - link "Ouvrir la commande CMD-261127-F742DE" [ref=e234] [cursor=pointer]:
                        - /url: /partner/orders/c86b743a-aaec-47b1-ac8a-a613d1342325
                        - generic [ref=e235]: Voir ou refuser
                  - article [ref=e239]:
                    - generic [ref=e240]:
                      - generic [ref=e241]:
                        - heading "Commande 087332" [level=3] [ref=e242]:
                          - generic [ref=e243]: Commande
                          - text: "087332"
                        - paragraph [aria-hidden] [ref=e244]: CMD-261127-087332
                        - paragraph [ref=e245]:
                          - generic [ref=e246]: Sur place
                          - generic [ref=e250]: · Table 7
                      - generic [ref=e251]: Acceptée
                    - list [ref=e254]:
                      - listitem [ref=e255]:
                        - generic [ref=e256]: 1 ×
                        - text: Bissap maison
                      - listitem [ref=e257]:
                        - generic [ref=e258]: 1 ×
                        - text: Yassa poulet
                    - generic [ref=e259]:
                      - paragraph [ref=e260]: 4 500 F CFA
                      - paragraph [ref=e261]: "À encaisser : 4 500 F CFA"
                    - generic [ref=e262]:
                      - button "Commencer la préparation" [ref=e263] [cursor=pointer]
                      - link "Ouvrir la commande CMD-261127-087332" [ref=e265] [cursor=pointer]:
                        - /url: /partner/orders/98dc91c8-7e3b-4bd8-a1c9-1adb345e97d1
                        - generic [ref=e266]: Ouvrir
    - navigation "Navigation rapide":
      - generic [ref=e270]:
        - link "Accueil" [ref=e272] [cursor=pointer]:
          - /url: /partner/dashboard
        - link "Billetterie" [ref=e280] [cursor=pointer]:
          - /url: /partner/events
        - link "Scanner" [ref=e285] [cursor=pointer]:
          - /url: /partner/scan
        - link "Finances" [ref=e294] [cursor=pointer]:
          - /url: /partner/finance
        - link "Profil" [ref=e299] [cursor=pointer]:
          - /url: /partner/profile
  - alert [ref=e305]
  - dialog [ref=e308]:
    - generic [ref=e309]:
      - generic [ref=e315]:
        - heading "Mode comptoir" [level=2] [ref=e316]
        - paragraph [ref=e317]: Mis à jour à 04:14
      - button "Fermer" [ref=e318] [cursor=pointer]
    - generic [ref=e324]:
      - generic [ref=e325]:
        - status [ref=e326]: "Cet appareil peut se mettre en veille : réglez sa mise en veille sur « jamais » pendant le service."
        - button "Quitter le mode comptoir" [active] [ref=e327] [cursor=pointer]
      - generic [ref=e333]:
        - region [ref=e334]:
          - heading "Reçues (3)" [level=2] [ref=e335]:
            - text: Reçues
            - generic [ref=e336]: (3)
          - generic [ref=e337]:
            - article "Commande 400C90" [ref=e338]:
              - generic [ref=e339]:
                - generic [ref=e340]:
                  - heading "Commande 400C90" [level=3] [ref=e341]:
                    - generic [ref=e342]: Commande
                    - text: 400C90
                  - paragraph [aria-hidden] [ref=e343]: CMD-261127-400C90
                  - paragraph [ref=e344]:
                    - generic [ref=e345]: Retrait sur place
                - generic [ref=e349]: Reçue
              - generic [ref=e353]:
                - generic [ref=e358]:
                  - text: "15"
                  - generic [ref=e359]: minutes
                - generic [ref=e360]:
                  - paragraph [ref=e361]:
                    - status [ref=e362]: Délai pour accepter
                  - paragraph [aria-hidden] [ref=e363]: Encore 14 min 58 s
              - list [ref=e364]:
                - listitem [ref=e365]:
                  - generic [ref=e366]: 2 ×
                  - text: Bissap maison
                - listitem [ref=e367]:
                  - generic [ref=e368]: 2 ×
                  - text: Yassa poulet
              - generic [ref=e369]:
                - paragraph [ref=e370]: 9 000 F CFA
                - paragraph [ref=e371]: "À encaisser : 9 000 F CFA"
              - generic [ref=e372]:
                - button "Accepter" [ref=e373] [cursor=pointer]
                - link "Ouvrir la commande CMD-261127-400C90" [ref=e375] [cursor=pointer]:
                  - /url: /partner/orders/f007856f-304a-41d2-9aea-96e1b0230d2b
                  - generic [ref=e376]: Voir ou refuser
            - article "Commande F742DE" [ref=e380]:
              - generic [ref=e381]:
                - generic [ref=e382]:
                  - heading "Commande F742DE" [level=3] [ref=e383]:
                    - generic [ref=e384]: Commande
                    - text: F742DE
                  - paragraph [aria-hidden] [ref=e385]: CMD-261127-F742DE
                  - paragraph [ref=e386]:
                    - generic [ref=e387]: Sur place
                    - generic [ref=e391]: · Terrasse 4
                - generic [ref=e392]: Reçue
              - paragraph [ref=e395]:
                - generic [ref=e400]: Pour 07:15
              - generic [ref=e402]:
                - generic [ref=e407]:
                  - text: "15"
                  - generic [ref=e408]: minutes
                - generic [ref=e409]:
                  - paragraph [ref=e410]:
                    - status [ref=e411]: Délai pour accepter
                  - paragraph [aria-hidden] [ref=e412]: Encore 14 min 58 s
              - list [ref=e413]:
                - listitem [ref=e414]:
                  - generic [ref=e415]: 1 ×
                  - text: Thiakry
                - listitem [ref=e416]:
                  - generic [ref=e417]: 3 ×
                  - text: Yassa poulet
              - generic [ref=e418]:
                - paragraph [ref=e419]: 12 000 F CFA
                - paragraph [ref=e420]: "À encaisser : 12 000 F CFA"
              - generic [ref=e421]:
                - button "Accepter" [ref=e422] [cursor=pointer]
                - link "Ouvrir la commande CMD-261127-F742DE" [ref=e424] [cursor=pointer]:
                  - /url: /partner/orders/c86b743a-aaec-47b1-ac8a-a613d1342325
                  - generic [ref=e425]: Voir ou refuser
            - article "Commande 087332" [ref=e429]:
              - generic [ref=e430]:
                - generic [ref=e431]:
                  - heading "Commande 087332" [level=3] [ref=e432]:
                    - generic [ref=e433]: Commande
                    - text: "087332"
                  - paragraph [aria-hidden] [ref=e434]: CMD-261127-087332
                  - paragraph [ref=e435]:
                    - generic [ref=e436]: Sur place
                    - generic [ref=e440]: · Table 7
                - generic [ref=e441]: Acceptée
              - list [ref=e444]:
                - listitem [ref=e445]:
                  - generic [ref=e446]: 1 ×
                  - text: Bissap maison
                - listitem [ref=e447]:
                  - generic [ref=e448]: 1 ×
                  - text: Yassa poulet
              - generic [ref=e449]:
                - paragraph [ref=e450]: 4 500 F CFA
                - paragraph [ref=e451]: "À encaisser : 4 500 F CFA"
              - generic [ref=e452]:
                - button "Commencer la préparation" [ref=e453] [cursor=pointer]
                - link "Ouvrir la commande CMD-261127-087332" [ref=e455] [cursor=pointer]:
                  - /url: /partner/orders/98dc91c8-7e3b-4bd8-a1c9-1adb345e97d1
                  - generic [ref=e456]: Ouvrir
        - region [ref=e460]:
          - heading "En préparation (1)" [level=2] [ref=e461]:
            - text: En préparation
            - generic [ref=e462]: (1)
          - article "Commande A24007" [ref=e464]:
            - generic [ref=e465]:
              - generic [ref=e466]:
                - heading "Commande A24007" [level=3] [ref=e467]:
                  - generic [ref=e468]: Commande
                  - text: A24007
                - paragraph [aria-hidden] [ref=e469]: CMD-261127-A24007
                - paragraph [ref=e470]:
                  - generic [ref=e471]: Retrait sur place
              - generic [ref=e475]: En préparation
            - list [ref=e478]:
              - listitem [ref=e479]:
                - generic [ref=e480]: 4 ×
                - text: Bissap maison
            - generic [ref=e481]:
              - paragraph [ref=e482]: 4 000 F CFA
              - paragraph [ref=e483]: "À encaisser : 4 000 F CFA"
            - generic [ref=e484]:
              - button "Marquer prête" [ref=e485] [cursor=pointer]
              - link "Ouvrir la commande CMD-261127-A24007" [ref=e487] [cursor=pointer]:
                - /url: /partner/orders/f9f50bcc-fd67-49c6-ae8c-d026f2d1e26f
                - generic [ref=e488]: Ouvrir
        - region [ref=e492]:
          - heading "Prêtes (1)" [level=2] [ref=e493]:
            - text: Prêtes
            - generic [ref=e494]: (1)
          - article "Commande D0C375" [ref=e496]:
            - generic [ref=e497]:
              - generic [ref=e498]:
                - heading "Commande D0C375" [level=3] [ref=e499]:
                  - generic [ref=e500]: Commande
                  - text: D0C375
                - paragraph [aria-hidden] [ref=e501]: CMD-261127-D0C375
                - paragraph [ref=e502]:
                  - generic [ref=e503]: Retrait sur place
              - generic [ref=e507]: Prête
            - list [ref=e510]:
              - listitem [ref=e511]:
                - generic [ref=e512]: 2 ×
                - text: Yassa poulet
            - generic [ref=e513]:
              - paragraph [ref=e514]: 7 000 F CFA
              - paragraph [ref=e515]: "À encaisser : 7 000 F CFA"
            - link "Ouvrir la commande CMD-261127-D0C375" [ref=e517] [cursor=pointer]:
              - /url: /partner/orders/897159bc-d0fa-4019-b9b3-acbbb9a06020
              - generic [ref=e518]: Remettre
        - region [ref=e522]:
          - heading "En route (1)" [level=2] [ref=e523]:
            - text: En route
            - generic [ref=e524]: (1)
          - article "Commande 14AE2D" [ref=e526]:
            - generic [ref=e527]:
              - generic [ref=e528]:
                - heading "Commande 14AE2D" [level=3] [ref=e529]:
                  - generic [ref=e530]: Commande
                  - text: 14AE2D
                - paragraph [aria-hidden] [ref=e531]: CMD-261127-14AE2D
                - paragraph [ref=e532]:
                  - generic [ref=e533]: Livraison
                  - generic [ref=e539]: · Almadies
              - generic [ref=e540]: En route
            - list [ref=e543]:
              - listitem [ref=e544]:
                - generic [ref=e545]: 2 ×
                - text: Bissap maison
              - listitem [ref=e546]:
                - generic [ref=e547]: 2 ×
                - text: Yassa poulet
            - generic [ref=e548]:
              - paragraph [ref=e549]: 10 500 F CFA
              - paragraph [ref=e550]: "À encaisser : 10 500 F CFA"
            - link "Ouvrir la commande CMD-261127-14AE2D" [ref=e552] [cursor=pointer]:
              - /url: /partner/orders/344ae366-70af-4ede-9490-a7759548e575
              - generic [ref=e553]: Remettre
```

# Test source

```ts
  1   | /**
  2   |  * Lot 12c — commandes : écrans de la partenaire (catalogue, produit, produit en vérification, nouveau produit, réglages de
  3   |  * vente, zones de livraison, commandes en téléphone, tablette et ordinateur, fiche d'une commande reçue, saisie du code de
  4   |  * remise, livreurs, tableau de bord) et page « Produits à vérifier » de l'administration, de bout en bout sur le serveur
  5   |  * construit (job « responsive » de la CI : nom en « …responsive.spec.ts »).
  6   |  *
  7   |  * Données propres au spec (la graine de démonstration n'est pas touchée) : un établissement neuf de la partenaire de
  8   |  * démonstration « organisateur2 » (lue par aucun autre spec e2e), validé, ouvert 24 h sur 24, qui prend des commandes
  9   |  * (livraison, retrait, sur place, acompte, paiement à la remise) ; trois zones de livraison (une désactivée) ; des produits
  10  |  * enregistrés par la fonction en base (plat du jour avec portions, plat avec suppléments, boisson, dessert presque épuisé,
  11  |  * produit réglementé, « Bière Gazelle » mise « à vérifier » par la base) ; deux livreurs (un actif, une invitation en
  12  |  * attente) ; des commandes dans chaque étape (reçue au plus tôt, reçue pour plus tard, acceptée, en préparation, prête à
  13  |  * retirer avec un reste à payer, en route en livraison, remise), toutes payables à la remise (aucun paiement réel).
  14  |  *
  15  |  * Interrupteur features.orders_enabled : ouvert au début de chaque test et remis à sa valeur d'origine à la fin, sous le
  16  |  * verrou des services (groupe « services » : aucun test du groupe « autres » ne tourne pendant ce temps,
  17  |  * e2e/support/services-switch.ts).
  18  |  *
  19  |  * Pour chaque thème (clair, sombre) et chaque largeur (390, 768 et 1 440 px) : contrôle responsive (0 défaut bloquant) et
  20  |  * capture. Captures : .e2e-captures/captures-responsive/l12c-<écran>__<largeur>__<thème>.jpg (publiées sur ci-results).
  21  |  */
  22  | import fs from 'node:fs';
  23  | import path from 'node:path';
  24  | import { randomUUID } from 'node:crypto';
  25  | import type { Browser, BrowserContext, Page, TestInfo } from '@playwright/test';
  26  | import { test, expect, projectContextOptions, type ThemeKey } from './support/fixtures';
  27  | import { E2E_OUTPUT_DIR, readDemoIds } from './support/demo-ids';
  28  | import { createClientAccount, rpcOk, serviceClient, userIdByEmail, type ControllerAccount } from './support/service';
  29  | import { runResponsiveChecks } from './support/responsive-checks';
  30  | import { requireStorageState, TEST_PASSWORD } from './support/accounts';
  31  | import { APP_URL } from './support/env';
  32  | import { FIXTURE_USERS } from '../tests/helpers/fixture-data';
  33  | 
  34  | test.describe.configure({ mode: 'serial' });
  35  | 
  36  | const SHOTS = path.join(E2E_OUTPUT_DIR, 'captures-responsive');
  37  | const THEMES: ReadonlyArray<{ key: ThemeKey; scheme: 'light' | 'dark' }> = [{ key: 'clair', scheme: 'light' }, { key: 'sombre', scheme: 'dark' }];
  38  | const WIDTHS = [
  39  |     { width: 390, height: 844, phone: true },
  40  |     { width: 768, height: 1024, phone: false },
  41  |     { width: 1440, height: 900, phone: false },
  42  | ] as const;
  43  | const STAMP = randomUUID().slice(0, 6);
  44  | const ALWAYS_OPEN = [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, opens_at: '00:00', closes_at: '24:00' }));
  45  | 
  46  | interface Seeded {
  47  |     venueId: string;
  48  |     venueName: string;
  49  |     products: { yassa: string; biere: string };
  50  |     orders: { recue: { id: string; number: string }; prete: { id: string; number: string } };
  51  | }
  52  | 
  53  | async function settle(page: Page): Promise<void> {
  54  |     await page.evaluate(() => document.fonts.ready.then(() => true));
  55  |     // La page des commandes se relit toutes les 5 s : jamais « réseau au repos » ; attente bornée
  56  |     await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => undefined);
  57  |     await page.evaluate(() => new Promise<void>((r) => { requestAnimationFrame(() => requestAnimationFrame(() => r())); }));
  58  |     await page.waitForTimeout(400); // fin des transitions (≤ 300 ms)
  59  | }
  60  | 
  61  | async function shot(page: Page, name: string, width: number, theme: ThemeKey, full = true): Promise<void> {
  62  |     fs.mkdirSync(SHOTS, { recursive: true });
  63  |     await page.screenshot({ path: path.join(SHOTS, `l12c-${name}__${width}__${theme}.jpg`), type: 'jpeg', quality: 80, caret: 'hide', scale: 'css', fullPage: full });
  64  | }
  65  | 
  66  | async function checkLayout(page: Page, width: number, phone: boolean, label: string): Promise<void> {
  67  |     const r = await runResponsiveChecks(page, { width, phone });
> 68  |     expect(r.blocking, `${label} (${width} px) : défauts bloquants\n${r.blocking.join('\n')}`).toEqual([]);
      |                                                                                                ^ Error: mode comptoir (390 px) : défauts bloquants
  69  | }
  70  | 
  71  | type SessionState = Awaited<ReturnType<BrowserContext['storageState']>>;
  72  | 
  73  | /**
  74  |  * Session de la partenaire, ouverte UNE fois pour tout le spec (run 726 : la seconde connexion, au thème sombre, tombait
  75  |  * sur la limite des connexions par adresse de la phase responsive, 429 LOGIN_RATE_LIMITED) ; reprise par le thème suivant.
  76  |  */
  77  | let partnerSession: SessionState | null = null;
  78  | 
  79  | async function themedContext(browser: Browser, testInfo: TestInfo, scheme: 'light' | 'dark', storageState?: string | SessionState): Promise<BrowserContext> {
  80  |     const context = await browser.newContext({ ...projectContextOptions(testInfo), colorScheme: scheme, ...(storageState ? { storageState } : {}) });
  81  |     await context.addInitScript((value: string) => {
  82  |         try { window.localStorage.setItem('ev-theme', value); } catch { /* document opaque */ }
  83  |         document.cookie = `ev-theme=${value}; path=/`;
  84  |     }, scheme);
  85  |     return context;
  86  | }
  87  | 
  88  | async function login(context: BrowserContext, identifier: string): Promise<void> {
  89  |     const res = await context.request.post(`${APP_URL}/api/auth/login`, { data: { identifier, password: TEST_PASSWORD } });
  90  |     expect(res.status(), `connexion de ${identifier} : ${await res.text()}`).toBe(200);
  91  | }
  92  | 
  93  | async function title(page: Page, name: string | RegExp): Promise<void> {
  94  |     const heading = typeof name === 'string' ? page.getByRole('heading', { level: 1, name, exact: true }) : page.getByRole('heading', { level: 1, name });
  95  |     await expect(heading.first()).toBeVisible({ timeout: 30_000 });
  96  | }
  97  | 
  98  | async function setOrdersService(open: boolean, actor: string): Promise<void> {
  99  |     const { data, error } = await serviceClient().rpc('finance_setting_set', { p_key: 'features.orders_enabled', p_value: { value: open }, p_actor: actor, p_reason: 'Captures du lot 12c' });
  100 |     if (error || (data as { ok?: boolean } | null)?.ok !== true) throw new Error(`[l12c] interrupteur des commandes : ${error?.message ?? JSON.stringify(data)}`);
  101 | }
  102 | 
  103 | /** Heure de Dakar (UTC) au quart d'heure, `hours` heures plus tard, au format attendu par la base. */
  104 | function laterSlot(hours: number): string {
  105 |     const at = new Date(Date.now() + hours * 3600_000);
  106 |     at.setUTCMinutes(Math.ceil(at.getUTCMinutes() / 15) * 15, 0, 0);
  107 |     return at.toISOString().slice(0, 16);
  108 | }
  109 | 
  110 | async function seed(superadmin: string): Promise<Seeded> {
  111 |     const owner = readDemoIds().accounts.organisateur2;
  112 |     const service = serviceClient();
  113 |     const { data: fiche, error: fErr } = await service.from('partners').select('id, status').eq('user_id', owner.userId).order('created_at').limit(1).maybeSingle();
  114 |     if (fErr || !fiche) throw new Error(`[l12c] fiche de organisateur2 : ${fErr?.message ?? 'absente'}`);
  115 |     if (fiche.status !== 'VALIDE') throw new Error(`[l12c] fiche de organisateur2 au statut ${String(fiche.status)} : VALIDE attendu`);
  116 |     const partnerId = String(fiche.id);
  117 | 
  118 |     // Établissement validé, ouvert 24 h sur 24, qui prend des commandes
  119 |     const venueName = `Chez Fatou ${STAMP}`;
  120 |     const { data: venue, error: vErr } = await service.from('venues').insert({
  121 |         partner_id: partnerId, kind: 'RESTAURANT', name: venueName, address: 'Route de la Corniche Ouest', city: 'Dakar',
  122 |         latitude: 14.6937, longitude: -17.4441, confirmation_mode: 'AUTO',
  123 |     }).select('id').single();
  124 |     if (vErr || !venue) throw new Error(`[l12c] établissement : ${vErr?.message}`);
  125 |     const venueId = String(venue.id);
  126 |     await rpcOk('venue_hours_set', { actor_id: owner.userId, venue_id: venueId, hours: ALWAYS_OPEN });
  127 |     await rpcOk('venue_validation_decide', { actor_id: superadmin, venue_id: venueId, decision: 'VALIDER', reason: null });
  128 |     await rpcOk('order_venue_settings_set', {
  129 |         actor_id: owner.userId, venue_id: venueId, orders_open: true, modes: ['LIVRAISON', 'RETRAIT', 'SUR_PLACE'],
  130 |         deposit_allowed: true, deposit_percent: 30, pay_on_handover: true, prep_minutes: 20,
  131 |     });
  132 |     const almadies = await rpcOk('order_delivery_zone_set', { actor_id: owner.userId, venue_id: venueId, name: 'Almadies', fee: 1_500, min_order: 5_000 });
  133 |     await rpcOk('order_delivery_zone_set', { actor_id: owner.userId, venue_id: venueId, name: 'Mermoz – Sacré-Cœur', fee: 1_000, min_order: 0 });
  134 |     await rpcOk('order_delivery_zone_set', { actor_id: owner.userId, venue_id: venueId, name: 'Yoff', fee: 2_000, min_order: 10_000, is_active: false });
  135 |     const zoneId = String((almadies.zone as Record<string, unknown>).id);
  136 | 
  137 |     const { data: cats, error: cErr } = await service.from('product_categories').insert([
  138 |         { partner_id: partnerId, name: `Plats ${STAMP}`, sort_order: 0 },
  139 |         { partner_id: partnerId, name: `Boissons ${STAMP}`, sort_order: 1 },
  140 |         { partner_id: partnerId, name: `Desserts ${STAMP}`, sort_order: 2 },
  141 |     ]).select('id, name');
  142 |     if (cErr || !cats) throw new Error(`[l12c] catégories : ${cErr?.message}`);
  143 |     const cat = (prefix: string) => String(cats.find((c) => String(c.name).startsWith(prefix))!.id);
  144 |     const save = async (fields: Record<string, unknown>): Promise<string> => {
  145 |         const r = await rpcOk('order_product_save', { actor_id: owner.userId, product_id: null, fields: { venue_id: venueId, ...fields } });
  146 |         return String((r.product as Record<string, unknown>).id);
  147 |     };
  148 |     const thieb = await save({ name: 'Thiéboudienne du jour', description: 'Riz au poisson, légumes du marché, sauce tomate.', price: 4_500, category_id: cat('Plats'), is_daily_special: true });
  149 |     const yassa = await save({ name: 'Yassa poulet', description: 'Poulet mariné au citron et aux oignons, riz blanc.', price: 3_500, category_id: cat('Plats') });
  150 |     const bissap = await save({ name: 'Bissap maison', description: 'Fleurs d’hibiscus, menthe fraîche.', price: 1_000, category_id: cat('Boissons') });
  151 |     const thiakry = await save({ name: 'Thiakry', description: 'Couscous de mil au lait caillé.', price: 1_500, category_id: cat('Desserts'), is_stock_managed: true, stock_quantity: 4 });
  152 |     await save({ name: 'Whisky 12 ans', price: 15_000, category_id: cat('Boissons'), is_regulated: true, regulated_kind: 'ALCOOL' });
  153 |     const biere = await save({ name: 'Bière Gazelle 65 cl', description: 'Bière blonde locale, servie fraîche.', price: 1_500, category_id: cat('Boissons') });
  154 |     // Contre-vérification du lot 12c (point 8) : un produit vendu puis archivé, pour « Remettre en vente »
  155 |     const pastels = await save({ name: 'Pastels au thon', description: 'Six chaussons frits, sauce tomate pimentée.', price: 2_000, category_id: cat('Plats') });
  156 |     await rpcOk('product_option_set', { actor_id: owner.userId, product_id: yassa, name: 'Frites', price: 500 });
  157 |     await rpcOk('product_option_set', { actor_id: owner.userId, product_id: yassa, name: 'Sauce piment', price: 0 });
  158 |     await rpcOk('order_daily_portions_set', { actor_id: owner.userId, product_id: thieb, portions: 50 });
  159 | 
  160 |     // Livreurs : un actif, une invitation en attente
  161 |     const courier = await createClientAccount(`l12c-livreur-${STAMP}`);
  162 |     const pending = await createClientAccount(`l12c-invite-${STAMP}`);
  163 |     const inv = await rpcOk('order_courier_invite', { actor_id: owner.userId, phone: courier.phone });
  164 |     await rpcOk('order_courier_respond', { actor_id: courier.userId, invitation_id: inv.invitation_id, accept: true });
  165 |     await rpcOk('order_courier_invite', { actor_id: owner.userId, phone: pending.phone });
  166 | 
  167 |     // Commandes payables à la remise (au plus 3 non payées par client : trois clientes)
  168 |     const clients: ControllerAccount[] = [];
```