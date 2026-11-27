# Lot 12b — Commandes : écrans du client

Branche `lot12b/client` (depuis main `5b7f3399ca`, lot 11c-b fusionné ; puis main fusionné : lot 12c `85a1c85f57`, ajout
« fermeture » du 12c `b52a9c255e`, documentation `2a65f5e55d`), worktree `event-village-lot12b`. **Non fusionnée ;
aucune migration appliquée.** Service toujours fermé par `features.orders_enabled` (les tests l'ouvrent le temps de leur
passage).

**État des correctifs après contre-vérification (27/11)** : T1, T2 et T3 verts (runs 777 et 779) ; run complet **779**
(`d59605b18f`, branche à jour avec main `2a65f5e55d`) : 644 suites sur 645, e2e 783 passés, responsive 0 défaut et
246 passés, **mesure mobile valide** (accueil 92, fiche 93, Mes billets 92, toucher 80 ms), budgets tenus ; deux rouges
sans défaut du code : `recette-matrice` (deux références de lignes de `docs/recette-billetterie.md` décalées par les
tests modifiés, recalées) et une capture intermittente de `carte-b3` (Explorer, sombre, 360 px ; verte aux runs 774, 776,
777), toutes deux rejouées au run **780** (`dc248c877`) : **vert** (matrice, typage, lint, responsive 249 passés, 0 défaut, `carte-b3` vert). Migrations à appliquer : liste dans la section ci-dessous.

**État du lot (26-27/11)** : run complet 752 vert sauf deux points ; `recette-matrice` corrigée (verte aux runs 755, 760 et 764) ; mesure
mobile de la fiche à 89 aux runs 752 et 760, **94 pour main comme pour la branche sur la même machine** (run 763, mesure
A/B) ; mesure relancée au run 764 non concluante (machine hors plage). Point 7.

## Correctifs après contre-vérification (27/11)

Contre-vérification : `docs/audit-lot12b.md` (branche `lot12b/cv-rouges`, 591991e241), trois trous : T1 élevé à la fusion,
T2 moyen, T3 faible ; aucun critique. Branche à jour avec `origin/main` (lot 12c `85a1c85f57` : fusion `f4736a30f4`, trois
conflits attendus résolus en gardant les deux lots ; ajout « fermeture » du 12c `b52a9c255e` : fusion `14d43a79ea` ;
documentation `2a65f5e55d` : fusion `d59605b18f`). Suites de l'audit reprises telles quelles (`bed373124b`), sans les
cinq migrations du 12c recopiées (elles viennent de main, blobs identiques vérifiés).

### À lire en premier (signalements)

1. **Migrations renommées** (aucune n'est appliquée nulle part) : `20261222000001-003` → **`20261226000001-003`**, mêmes
   contenus et même ordre, après celles du 12c. Le correctif T1, l'idée 9 et l'alignement sur le devis du 12c sont dans
   `20261226000002` ; la clé liée dans `20261226000003`. Plus aucun `to_jsonb(ligne)` (les colonnes du 12c existent avant).
2. **Liste blanche des aides modifiée** (comme la carte B3 pour `listed_venue`) :

   | Fichier | Avant | Après |
   |---|---|---|
   | `supabase/hotfix/2026-10-31-lot1a/03-verification.sql` | 10 aides, dernière `('listed_venue')` ; contrôle `= 10` | 12 aides : `+ ('product_public'), ('product_owner_or_admin')` ; contrôle `= 12` |
   | `tests/schema/fonctions-privileges.test.ts` (`RLS_HELPER_WHITELIST`) | `… 'partner_listed', 'listed_venue'` | `… 'partner_listed', 'listed_venue', 'product_public', 'product_owner_or_admin'` |

3. **Tests existants modifiés** (aucune assertion de `tests/audit/` ni `tests/audit-auth/` changée sans accord) :

   | Test | Avant | Après | Raison |
   |---|---|---|---|
   | `tests/audit/cvf2b-6-deconnexion.test.ts:631` (**accord du 27/11**) | `what: 'opérateur et numéro de paiement, recherches récentes de l’appareil (localStorage)'` | `what: 'opérateur et numéro de paiement, recherches récentes, panier des commandes (plats, suppléments, notes) de l’appareil (localStorage)'` | description seule (compte et purge inchangés) ; exigée par `cv12b-3` T3 |
   | `tests/audit/cv12b-3-statique.test.ts:111` et `:137` (**accord du 27/11**) | noms `20261222000001…003` | noms `20261226000001…003` | migrations renommées ; aucune assertion changée |
   | `tests/schema/fonctions-privileges.test.ts` | 10 aides | 12 aides | point 2 |
   | `tests/parcours/notif-modeles.test.ts:303-306` | liens `/orders/<id>` de ORDER_ACCEPTED et ORDER_READY | `…?payer=solde` (reste à payer) et `…?comptoir=1` (retrait) | idées 11 et 12 |
   | `tests/parcours/l12c-statique.test.ts:30` (**fichier du 12c**) | migrations du 12c : `>= 20261224000001` et `< 20261228` | `< 20261226` | les migrations renommées du 12b tombaient dans l'intervalle du 12c (S2 lisait `order_issue_code` et `products_read` du 12b comme du 12c, run 773) |
   | `e2e/lot12c.responsive.spec.ts` (**fichier du 12c**) | ouvre et remet `features.orders_enabled` lui-même | `openOrdersService` / `releaseOrdersService` (`e2e/support/orders-service.ts`), un nom par thème | point 7 de la consigne |
   | `tests/schema/migration-lot12b-rejouable.test.ts`, `tests/schema/l12b-ecrans-statique.test.ts` (6 et nouveaux 8 à 13), `tests/parcours/l12b-produits-rest.test.ts` (C), `tests/parcours/l12b-commandes-client.test.ts` (A bis, E), `tests/helpers/design-files.ts`, `e2e/lot12b.responsive.spec.ts` | suites du lot | noms des migrations, règles par les aides (plus de `listed_venue` ni de `to_jsonb` dans les règles), contrôles ajoutés | correctifs et idées |

4. **Constat sans correctif (point 4 de la consigne)** : `public.order_payable_refusal`
   (`20261130000005_l12a_paiement.sql:27-55`, fonction du 12a) ne lit pas les fermetures exceptionnelles : une commande
   **créée juste avant la pose d'une fermeture** reste payable (seuls établissement actif, validé, ouvert à la vente,
   partenaire VALIDE et produits réglementés sont vérifiés). Le correctif du 12c refuse le **devis** et donc la création
   pendant une fermeture, pas le paiement d'une commande déjà créée. Non recopiée (consigne) : à traiter par le lot qui
   possède la fonction ; d'ici là, la partenaire refuse la commande si elle ferme.
5. **Spec e2e d'un autre lot rouge au run 774 (sans lien avec le lot)** : `e2e/lot11cc.responsive.spec.ts:303-305` lit
   « Commencer le contrôle » puis clique alors que la page vient de passer à « Reprendre le contrôle » (course du spec,
   vue une fois, verte aux runs 777 et 779).

### Trous et correctifs

| Trou | Correctif | Commit | Preuve |
|---|---|---|---|
| **T1** (élevé à la fusion) : règles REST des suppléments et portions cassées par les droits par colonne du 12c | deux aides `SECURITY DEFINER`, `STABLE`, `search_path` fixé, modèle `listed_venue` : `product_public(produit)` (DISPONIBLE, établissement listé, non retiré) et `product_owner_or_admin(produit)` (conditions de `is_partner_owner` écrites en clair : invariant q6 du lot 9 quater, run 773) ; EXECUTE à anon, authenticated, service_role, retiré à PUBLIC ; `products_read`, `product_options_read`, `product_daily_portions_read` passent par elles, sans sous-requête ni ligne entière | `e43aa7664b`, `d5082cc898` | run 777 : `cv12b-1` T1 vert (« anon / client / propriétaire : products 1, product_options 1, product_daily_portions 1 ligne(s) », `policies_whole_row` 0) ; `l12b-produits-rest` 2/2 |
| **T2** (moyen) : commande acceptée pendant une fermeture exceptionnelle | fonction du 12c (`order_quote_compute`) : correctif de l'autre session (`dfab43a69f`, dans main `b52a9c255e`, fusionné ici `14d43a79ea`) ; **carte alignée** sur ce devis (ci-dessous) | `14d43a79ea`, `2b624f87a6` | run 777 : `cv12b-1` T2 vert (« tout de suite » et 19:00 pendant la fermeture : HTTP 409 `VENUE_CLOSED` ; première fenêtre de la carte 18:26 pour une fermeture jusqu'à 17:56 et 30 min de préparation) |
| **T3** (faible) : panier et notes gardés après une fin de session silencieuse | `DEVICE_ORDER_CART_PREFIX` dans la portée « paiement » de `clearDevicePrefs` (page chargée sans session, cvf2b 6.5), comme les demandes des tables et les prénoms des invités | `b7846278fa` | run 777 : `cv12b-3` T3 vert (« clés avant [panier, paiement] ; après [] ») |
| Observation : clé d'idempotence d'un paiement | liée à sa commande : la même clé pour une autre commande (ou un achat de billets) → `IDEMPOTENCY_KEY_REUSED`, « Cette demande de paiement ne correspond pas à cette commande : rechargez la page et réessayez. » (409), jamais le paiement de l'autre | `f862d4db25` | run 777 : test E de `l12b-commandes-client` (« HTTP 409 … IDEMPOTENCY_KEY_REUSED ») |
| Fusion e2e (audit § 4.2) | spec du 12c par le compteur partagé ; un nom par thème dans les deux specs (avec deux workers, le thème qui finit le premier refermait le service sous les pas de l'autre : défaut latent du spec 12b aussi) ; spec 12b **sans connexion par la route** (état rejoué du second client du seed : au run 776, le quota de 30 connexions par adresse et par heure du job responsive était dépassé et `lot11cc` refusé) | `8b036a06fb`, `c90f040c55` | run 777 : responsive 249 passés, 0 défaut bloquant |

Vérifié sur la base réunie (`l12b-produits-rest`, partie C, et `cv12b-1` T1) : anon, client et propriétaire lisent
produit, suppléments et portions d'un établissement listé **sans erreur** ; rien d'une partenaire suspendue, d'un
établissement suspendu ou non listé, d'un produit sans établissement ni d'un produit retiré (sauf la propriétaire).

### Carte alignée sur le devis du 12c (ajout du 27/11)

Le 12c (`20261224000003`, dans main) refuse une commande dont la préparation tombe dans une fermeture exceptionnelle
(`VENUE_CLOSED` : fermeture qui touche `[heure - préparation, heure + 1 min)`). À la minute près, une heure t est
refusée quand `début ≤ t < fin + préparation`. `order_venue_menu` retire donc chaque fermeture des heures proposées
jusqu'à sa fin **plus la préparation** ; « tout de suite » aux mêmes bornes que le devis (`2b624f87a6`). Le premier
créneau proposé, et chaque heure de « Autre heure », sont acceptés par le devis. Preuve (run 777, `l12b-commandes-client`,
A bis) :

```
[L12B-CV] fermeture jusqu’à 2026-11-28T18:00, préparation 30 min : première fenêtre ["2026-11-28T18:30","2026-12-04T15:58"], premiers créneaux ["2026-11-28T18:30","2026-11-28T18:45","2026-11-28T19:00","2026-11-28T19:15"], tout de suite false
[L12B-CV] heures proposées essayées au devis : 55, refusées []
```

et 18 h 15 refusé par le devis (`VENUE_CLOSED`). L'en-tête de la carte dit « Fermé exceptionnellement » pendant une
fermeture (la capture du run 777 montrait « Ouvert maintenant », d'après les seuls horaires : `554dae61f4`).

### Idées faites (expérience du client)

| Idée | Ce qui change | Où | Preuve |
|---|---|---|---|
| 8. Prix changé en un geste | au refus `ORDER_PRICE_CHANGED`, le devis affiché est gardé, le nouveau relu : ancien et nouveau prix ligne par ligne (frais compris) et un seul bouton « Commander à 4 095 F CFA » | `MenuView`, `CartPanel`, `priceChanges` (deux lectures comparées, aucun calcul) | statique 8 ; e2e capture `prix-change` |
| 9. Fermeture annoncée | `order_venue_menu` rend `ordering.closed_until` (fermetures qui se suivent réunies) ; bandeau « Fermé exceptionnellement jusqu’au 28/11 à 18 h — commandez pour plus tard », premier créneau proposé (accepté par le devis) et retenu ; badge « Fermé exceptionnellement » | migration 02, `MenuView`, `MenuHeader` | statique 9 ; A bis (base) ; e2e `fermeture` |
| 10. Heure estimée | « Prête vers 13 h 05 », « Livrée vers 13 h 25 », « Servie demain vers 20 h » : heure de la base (devis `scheduled_for`, commande `estimated_at`), dans le panier et dans Mes commandes | `etaLabel` (`lib/orders/client-view.ts`) | statique 10 ; A bis ; e2e `panier-devis`, `mes-commandes` |
| 11. Montrer au comptoir | `CounterCode` (Modal plein écran) : 4 chiffres en très grand, écran gardé allumé (Wake Lock), retour automatique après 90 s, texte non sélectionnable, ni copie ni menu ; « Montrer au livreur » en livraison ; avis « commande prête » (retrait) → `/orders/<id>?comptoir=1` (jamais le code dans le lien) | `CounterCode`, `HandoverCode`, catalogue | statique 11 ; e2e `mode-comptoir` (le code n'est pas dans l'adresse) |
| 12. Solde en un geste | avis « commande acceptée » avec un reste à payer → `/orders/<id>?payer=solde` : panneau du solde ouvert et amené à l'écran, montant relu en base | `OrderTracking`, page, catalogue | statique 12 ; e2e `solde-depuis-avis` |
| 13. Visuels par catégorie | huit dessins locaux (`public/images/plats/` : plat, poisson, grillade, boisson, dessert, entrée, sandwich, petit-déjeuner), choisis par le serveur d'après la catégorie puis le nom (`lib/orders/dish-visual.ts`), servis dans une table à part `menu.visuals` (la fiche d'un plat garde exactement ses champs : audit `cv12b-2` G6, run 774) | `ProductVisual` | statique 13 ; e2e `carte`, `non-commandable` |

### Autres idées (classées par valeur)

1. **Commande groupée au bureau** : un lien de panier partagé (chacun ajoute ses plats, un seul paie, la base sépare les
   lignes par personne) ; c'est l'usage le plus fréquent à midi.
2. **Créneau garanti au retrait** : réserver un quart d'heure de retrait avec une capacité par créneau tenue par la base
   (fin des files au comptoir aux heures de pointe).
3. **Pourboire du livreur** à la remise, payé avec le solde, reversé en entier (ligne à part du grand livre).
4. **Allergènes et piment** sur la fiche du plat (champs de la partenaire, filtres de la carte).

### Migrations à appliquer après la fusion, dans l'ordre

Aucune n'est appliquée. Le 12c d'abord (déjà dans main), puis le 12b :

1. `supabase/migrations/20261224000001_l12c_verification.sql`
2. `supabase/migrations/20261224000002_l12c_zones_supplements.sql`
3. `supabase/migrations/20261224000003_l12c_devis.sql` (version de main `b52a9c255e`, avec `VENUE_CLOSED`)
4. `supabase/migrations/20261224000004_l12c_journee.sql`
5. `supabase/migrations/20261224000005_l12c_cv_correctifs.sql`
6. `supabase/migrations/20261226000001_l12b_code_visible.sql`
7. `supabase/migrations/20261226000002_l12b_carte_des_plats.sql`
8. `supabase/migrations/20261226000003_l12b_garde_prix.sql`

Puis `supabase/hotfix/2026-10-31-lot1a/03-verification.sql` : tous les points OK (12 aides).

### Poids JavaScript et mesure mobile (correctifs)

**Aucun budget relevé.** Avant : run de main **775** (`b52a9c255e`, lots 12c et ajout « fermeture »). Après : run
complet **779**. Octets gzip du premier chargement :

| Route | Main (775) | Branche (779) | Écart | Fichiers | Budget |
|---|---|---|---|---|---|
| `/` (accueil) | 215 558 | 215 586 | +28 | 18 → 18 | 226 342 |
| `/events/[id]` (fiche) | 224 498 | 224 521 | +23 | 17 → 17 | 233 316 |
| `/tickets` (Mes billets) | 240 935 | 240 959 | +24 | 20 → 20 | 250 417 |
| `/controller/scanner` | 225 222 | 225 250 | +28 | 16 → 16 | 234 911 |
| `/billet/hors-ligne` | 214 172 | 214 200 | +28 | 15 → 15 | 224 268 |
| `/explore` | 225 911 | 226 213 | +302 | 19 → 19 | 235 712 |

+23 à +28 o partout : le lien de la coquille et, depuis les correctifs, la clé du panier dans la purge sans session
(`device-prefs-purge.ts`, chargé par chaque page avec `AuthProvider`). Explorer +302 o : section du panier des
préférences de l'appareil (inchangé depuis le run 752). Les écrans des correctifs (carte, suivi, Mes commandes, mode
comptoir) ne sont pas dans le premier chargement des pages budgétées ; les dessins des plats sont des fichiers SVG
locaux (5 841 o en tout), pas du JavaScript.

**Mesure mobile** (Lighthouse mobile, médiane de 5 passages, seuil 90 inchangé) :

| Page | Main (775) | Branche (779) |
|---|---|---|
| Accueil | 95 [95 ; 95 ; 97 ; 95 ; 93] | 92 [90 ; 96 ; 92 ; 94 ; 91] |
| Fiche « ce soir » | 94 [92 ; 96 ; 94 ; 94 ; 97] | 93 [93 ; 87 ; 95 ; 94 ; 89] |
| Mes billets | 94 [90 ; 94 ; 94 ; 92 ; 97] | 92 [93 ; 92 ; 94 ; 84 ; 92] |
| Toucher (le plus long) | 96 ms | 80 ms |

Mesure valide à la première tentative, tous les seuils tenus.

### Runs des correctifs

| Run | Commit | Mode | Résultat | Cause et suite donnée |
|---|---|---|---|---|
| 772 | `4ee59f4137` | rapide (42 suites, base réunie) | rouge | typage : une chaîne coupée dans le journal de `l12b-produits-rest` → `ae96656b38` |
| 773 | `ae96656b38` | rapide (42 suites) | rouge | invariant q6 du lot 9 quater (`product_owner_or_admin` ne lisait pas le statut du compte) ; `l12c-statique` S2 (borne de ses migrations) ; T2 rouge attendu → `d5082cc898` |
| 774 | `8b51c75bd0` | rapide (46 suites, responsive, captures) | rouge | `cv12b-2` G6 (champ `visual` de trop dans la fiche d'un plat) ; requête de l'idée 9 (`uuid`) ; contrôle « prix changé » à 390 px ; `lot11cc` (course de son spec) → `699cf8fcd2` |
| 776 | `5cb50b8c9c` | rapide (10 suites, responsive, captures) | rouge | T2 rouge attendu (correctif du 12c pas encore dans main) ; bandeau de fermeture trouvé deux fois ; `lot11cc` refusé par le quota de connexion → `c90f040c55` ; main fusionné, carte alignée (`14d43a79ea`, `2b624f87a6`) |
| 777 | `bc6d1dbee7` | rapide (46 suites, responsive, captures) | **vert** | 46/46 (T1, T2, T3 verts), responsive 249 passés, 0 défaut, 80 captures ; capture de la fermeture : badge « Ouvert maintenant » → `554dae61f4` |
| 779 | `d59605b18f` | **complet** | rouge (2 points sans défaut du code) | 644/645 (`recette-matrice` : références de lignes), e2e 783, responsive 246 passés et `carte-b3` intermittent, 0 défaut, mesure valide 92/93/92, budgets tenus |
| 780 | `dc248c877` | rapide (`recette-matrice`, responsive, captures) | **vert** | références recalées (`fonctions-privileges.test.ts:97`, `notif-modeles.test.ts:593`) ; responsive rejoué |

Captures du run 779 (`ci-results`, `runs/779-46038324126/captures-responsive/`) : **80 captures du lot**, dont 16 nouvelles
(`l12b-prix-change`, `l12b-mode-comptoir`, `l12b-solde-depuis-avis`, `l12b-fermeture` × 390 et 1 440 px × clair et
sombre) ; `l12b-carte` et `l12b-non-commandable` montrent les dessins des plats sans photo, `l12b-panier-devis`
l'heure estimée.

## À lire en premier

**Migrations** (intervalle `20261226…` : **renommées le 27/11**, d'abord `20261222000001-003`, pour passer après celles du
12c ; voir « Correctifs après contre-vérification » ; sans BEGIN ni COMMIT, rejouables : appliquées deux fois de plus dans une
transaction annulée par `tests/schema/migration-lot12b-rejouable.test.ts`) :

| Fichier | Contenu |
|---|---|
| `20261226000001_l12b_code_visible.sql` | clé `private.order_code_enc_key` (32 octets tirés une fois) ; table `private.order_codes` (code chiffré `pgp_sym_encrypt` AES-256, empreinte au moment de l'émission) ; **seule recopie du lot** : `private.order_issue_code` depuis `20261130000006_l12a_etapes.sql:281-299` (aucune ligne perdue, contrôlé) ; déclencheur `private.order_codes_clear` (code effacé dès que `orders.code_hash` repasse à vide ou change) ; fonction nouvelle `order_code_reveal` |
| `20261226000002_l12b_carte_des_plats.sql` | fonction nouvelle `order_venue_menu(établissement)` ; règles REST `products_read` (`0003_rls.sql:237-238`), `product_options_read` et `product_daily_portions_read` (`20261130000002:425-430`) limitées aux établissements listés |
| `20261226000003_l12b_garde_prix.sql` | colonne `orders.client_request_key` (index unique par client) ; enveloppes `order_create_checked` et `order_payment_start` (aucune recopie de `order_create` ni `order_payment_create`) |

Droits : les quatre fonctions publiques nouvelles au rôle de service seulement ; les aides et tables de `private` à aucun
rôle de l'API (clé de service comprise) ; `supabase/hotfix/2026-10-31-lot1a/03-verification.sql` inchangé et vérifié par
le test de migration (aucune fonction ajoutée à la liste blanche). Fonctions du 12c jamais touchées
(`order_quote_compute`, `product_regulated`, `products_order_guard`, `order_product_regulation_decide`), ni les 9 recopies
du 12a suivies par `cv12a-3-statique` S1 (contrôlé).

**Failles et constats** :

1. **Lecture REST des produits ouverte à tous (existant, corrigé)** : `products_read` (`0003_rls.sql:237`) laissait lire
   avec la clé anon tout produit DISPONIBLE, y compris d'une **partenaire suspendue**, d'un **établissement suspendu** et
   les produits sans établissement ; suppléments et portions suivaient. Suite `tests/parcours/l12b-produits-rest.test.ts`,
   **prouvée rouge sur main** par la branche de preuve `lot12b/rouges` (`93cd6e705a` = main `5b7f3399ca` + cette seule
   suite ; à ne pas fusionner), run **738**, sortie brute :

   ```
   seul le produit d’un établissement listé
   + actual - expected
     [
       'bf01f9c4-778c-4070-b16b-ae3f176ca6a4',
   +   'b93729ae-7142-4027-8595-69935f9f3ac9',
   +   'e2781b5f-4459-4b17-983a-64209fb88783',
   +   '388816d1-3501-4dd1-b117-c2bb9da72a60'
     ]
   not ok 1 - REST des produits (clé anon et autre compte)
   # pass 0
   # fail 1
   ```

   Quatre produits lus avec la clé anon au lieu d'un : ceux de l'établissement suspendu, de la partenaire suspendue et le
   produit sans établissement en trop. Verte avec la migration `20261226000002` (runs du lot).
2. **Route publique de la carte** : servait les produits d'une partenaire (aucun établissement) et une **photo d'un site
   extérieur** (Unsplash) pour chaque produit sans image ; remplacée par `order_venue_menu` (établissement listé et ouvert à
   la commande, aucun champ interne, aucune image extérieure) ; test A et test statique.
3. **Constat sans correctif (hors de mon périmètre)** : `order_quote_compute` ne vérifie pas les **fermetures
   exceptionnelles** (`venue_closures`) ; une commande « forgée » pendant une fermeture passe. La carte du 12b retire déjà
   les fermetures des heures proposées et coupe « Tout de suite ». À corriger dans la recopie du 12c (fonction interdite au
   12b) : `docs/apres-lancement.md`.
4. **Défaut d'écran trouvé par l'e2e (corrigé, jamais livré)** : le paiement depuis le suivi envoyait `part: 'PREMIER'`,
   valeur refusée par le schéma de `POST /api/payments/create` (`ACOMPTE`, `SOLDE`, `INTEGRAL`) : aucun paiement possible
   depuis l'écran (run 745). Corrigé (`5adf34e4c3` : première part sans `part`, solde avec `SOLDE`) et contrôlé par
   `tests/schema/l12b-ecrans-statique.test.ts` (4 bis) ; parcours de paiement vert à l'écran au run 750.
5. **Fusion avec le 12c (e2e)** : `e2e/lot12c.responsive.spec.ts` ouvre `features.orders_enabled` puis le remet à sa
   valeur d'avant ; s'il tourne en même temps que le spec du 12b, il peut refermer le service sous ses pas (cause du run
   722 pour les tables). Le 12b ajoute le compteur partagé `e2e/support/orders-service.ts` : le spec du 12c doit l'utiliser
   à la fusion.

6. **À vérifier après la fusion avec le 12c** : le 12c ferme la lecture REST des colonnes `review_state`, `review_words`,
   `review_requested_at` et `archived_at` (droits par colonne). La règle de lignes `products_read` du 12b lit
   `to_jsonb(products.*) ->> 'archived_at'` (**réponse de la contre-vérification, T1 : faux pour les sous-requêtes des
   règles des suppléments et des portions ; corrigé, voir « Correctifs après contre-vérification »**) ; d'après le
   fonctionnement de PostgreSQL, les droits par colonne ne
   s'appliquent pas aux expressions d'une règle de lignes, mais rien ne l'a vérifié ici : relancer
   `tests/parcours/l12b-produits-rest.test.ts` et `l12b-commandes-client.test.ts` sur la base fusionnée. Les écrans du 12b
   ne lisent jamais les produits par la REST (contrôle 6 de `l12b-ecrans-statique`). Les produits retirés
   (`archived_at`) et « à vérifier » (`review_state`) sont lus sans dépendre de l'existence des colonnes ; le refus
   `PRODUCT_UNDER_REVIEW` du devis du 12c reçoit la phrase « Ce produit est en cours de vérification et ne peut pas être
   commandé pour l'instant. »

7. **Run complet pas entièrement vert : mesure mobile de la fiche à 89 (seuil 90) aux runs 752 et 760.** Tout le reste
   du run complet 752 est vert sauf `recette-matrice` (deux références de lignes, corrigées et vertes au run 755 et 760) :
   635 suites sur 636, e2e 783 passés, responsive 0 défaut, 64 captures, budgets tenus (aucun relevé). La fiche n'est
   pas touchée par le lot (+39 o, comme l'accueil) mais son temps de blocage est plus haut que sur main sur trois runs
   (détail dans « Poids JavaScript et mesure mobile »). Trois essais faits : je m'arrête. **Décision attendue** : relancer
   la mesure (job perf du run 760), ou me demander de chercher plus loin la cause (comparaison de main et de la branche
   sur la même machine, par une branche de mesure). Ne pas fusionner avant.
   **Décision du 27/11 : chercher la cause.** Mesure A/B sur la même machine (run 763) : **fiche à 94 des deux côtés**
   (TBT 254 ms main, 269 ms branche ; mêmes 23 scripts chargés, mêmes temps par fichier) ; aucune cause dans le lot,
   aucun correctif. Mesure seule relancée au run 764 : **non concluante** (machine de la CI hors de la plage aux
   3 tentatives, les trois pages baissent ensemble ; toucher non mesuré). Arrêt sur ces chiffres ; la prochaine mesure
   valide (job perf relancé ou run complet) reste à faire avant la fusion.

**Tests existants modifiés** (aucune suite d'audit `tests/audit/` ni `tests/audit-auth/` modifiée) :

| Test | Avant | Après | Raison |
|---|---|---|---|
| `tests/parcours/interrupteurs.test.ts` (PUBLIC_GETS, préparation) | carte lue par l'identifiant de la partenaire, produit sans établissement | carte lue par l'identifiant de l'établissement, produit de l'établissement ouvert à la commande | la carte des plats est celle d'un établissement (consigne) |
| `tests/parcours/l11a-cv-correctifs.test.ts` (T6) | identifiant de la partenaire → 200 | identifiant de l'établissement → 200 ; nom, nom partiel, « rest-… », **identifiant de la partenaire** → 404 | même exigence (identifiant exact seulement), sur l'établissement |
| `tests/parcours/client-interface.test.ts` (entrée « Restaurants et tables ») | lien en `/restaurants/…` | lien `/tables` ou `/restaurants/…` | le lien de la coquille mène à la recherche des établissements (consigne) ; même exigence d'interrupteur |
| `e2e/carte-b3.responsive.spec.ts:96` | 10 champs publics d'un lieu | 11 champs (`orders`), faux pour une salle | nouveau champ public de la carte des lieux (bouton « Commander ») |

Outil de test partagé modifié : **`e2e/support/responsive-checks.ts`** (« texte coupé ») : un texte sous la ligne de
flottaison d'un conteneur qui défile en hauteur (corps d'une fenêtre) n'est plus compté « coupé » par la fenêtre
(`overflow-hidden`) qui contient ce conteneur ; le contrôle en largeur ne change pas (`fd485a64c5`). Avant : toute fenêtre
dont le contenu dépasse la hauteur de l'écran était signalée (feuille du panier à 390 px, run 737), alors que ce contenu
s'atteint en faisant défiler. Le contrôle responsive des 194 pages reste à 0 défaut bloquant (runs 742 à 750).

Assertions d'audit gardées telles quelles et vertes : `cv11a-4-droits:339-346` (identifiant partiel → 404),
`cvf2b-6-deconnexion:200` (`app/orders/page.tsx` garde sur la perte du compte) et 13b (écritures du stockage web : toutes
dans `lib/device/device-prefs.ts`), `cv12a-1/2/3`, `cv11a-4`, `r25` (le compte vient de la session).

**Fichiers partagés touchés** : `components/layout/AppLayout.tsx` (une ligne : « Restaurants et tables » →
`/tables`) ; `lib/device/device-prefs.ts` (ajout : lecture et écriture brutes du panier) ; `lib/notifications/catalog.ts`
(texte de la cloche du code) ; `lib/validations/payment.ts` (champ facultatif `expectedAmount`) ;
`app/api/payments/create/route.ts`, `app/api/payments/[transactionId]/status/route.ts` ; `lib/lieux/carte-lieux*.ts`,
`components/explore/MapPlaceCard.tsx` (chargés en différé par Explorer) ; `app/tables/(catalogue)/[id]/page.tsx` (encart
« Commander ») ; `tests/helpers/design-files.ts`, `e2e/support/responsive-pages.ts` (lignes voisines de celles du 12c :
conflit attendu à la fusion, les deux listes sont à garder) ; `docs/apres-lancement.md` ; `docs/recette-billetterie.md`
(deux références de lignes recalées : `interrupteurs.test.ts:399` → `:405`, A37 vers la barre du panier de la nouvelle
carte `MenuView.tsx:307` ; signalé par `recette-matrice` au run 752, aucune assertion modifiée). `lib/orders/booking.ts` : **non
touché** (aides du client dans `lib/orders/client-view.ts`, sans dépendance serveur).

## Écrans livrés

| Écran | Adresse | Ce qu'il fait |
|---|---|---|
| Carte des plats | `/restaurants/<établissement>/menu` (page serveur, 404 si l'établissement n'est pas listé ou ne prend pas de commande) | en-tête de l'établissement (photo, « Ouvert maintenant », horaires du jour, délai de préparation, modes de remise) ; bandeau « Plat du jour » avec jauge (« Plus que 12 portions aujourd'hui ») ; onglets de catégories collants qui suivent le défilement ; grandes photos (ou visuel dessiné localement, jamais une image extérieure) ; pastilles douces « Épuisé », « Indisponible », « Momentanément suspendu » ; réglementé : prix + « Non commandable en ligne » + « Vente sur place uniquement » ; en vérification : prix + « En cours de vérification » |
| Fiche d'un plat | fenêtre (feuille du bas sur téléphone) | suppléments, quantité 1 à 99, note pour la cuisine, « Ajouter 1 Yassa poulet au panier » ; petite animation vers le panier (transformation et opacité, coupée si « réduire les animations ») |
| Panier et devis | feuille du bas (téléphone), colonne collante (ordinateur) | montants = devis de la base (`POST /api/orders/quote`) relu 350 ms après chaque changement, requêtes dépassées annulées ; total qui s'anime quand il change ; refus du serveur affichés tels quels, plat fautif mis en évidence ; visiteur : « Connectez-vous pour voir le total exact » |
| Finaliser | même panneau | mode (« À emporter » par défaut s'il est proposé ; livraison avec zone, frais et minimum, adresse, numéro ; sur place avec la liste des tables ou « Où êtes-vous ? ») ; heure en puces « Tout de suite », « Midi · 12 h 15 », « Ce soir · 19 h », « Autre heure » (jour, puis heure au quart d'heure, 7 jours, dans les horaires moins les fermetures) ; part : « Tout payer », « Acompte de 30 % », « À la remise » (selon l'établissement ; plat du jour : tout payer) ; commentaire ; « Commander » envoie la clé d'idempotence et le total affiché |
| Suivi | `/orders/<commande>` | à payer : compte à rebours (« À payer dans 14:32 ») et paiement (opérateur et numéro mémorisés, montant servi) ; ensuite frise des étapes avec l'heure de chacune et une courte animation à chaque étape, heure estimée en grand (« Prévue vers 13 h 15 ») ; code de remise en quatre grandes cases (« Montrez ce code à la remise. », « Recevoir un nouveau code »), au-dessus de la frise quand la remise est attendue ; paiement du reste en ligne ; annulation avant la préparation, montants rendus affichés avant de confirmer ; adresse, table ou zone ; lignes avec suppléments ; payé, frais, reste, remboursé ; fin (motif, remboursement) ; relecture toutes les 10 s tant que la page est visible ; commande absente ou d'autrui : « Cet élément n'est plus disponible » |
| Mes commandes | `/orders` | onglets d'origine gardés ; repas en « En cours », « Terminées » et « Non payées à temps » (repliée) ; « Suivre », « Consulter », « Commander à nouveau » ; état vide illustré |
| Accès | fiche `/tables/<établissement>`, carte d'Explorer | encart « Commander » quand l'établissement prend des commandes (lu par le serveur ; erreur : pas de bouton) ; lien « Commander chez … » sur la vignette et la feuille de la carte des lieux (champ public `orders`) ; lien « Restaurants et tables » de la coquille vers `/tables` ; « Commandes » (`/orders`) reste dans le menu principal |

Ajouts du 26/11 : « Commander à nouveau » (`?reprendre=<commande>` : mêmes plats et suppléments encore disponibles, les
autres signalés dans une bannière, devis relu) ; paiement mémorisé (même mécanisme que les tables du 11c-b) ; panier
gardé sur l'appareil 24 h (lignes et mode seulement, jamais un prix, effacé à la déconnexion ; relu par le devis à la
reprise).

## Serveur ajouté

| Élément | Détail |
|---|---|
| `order_venue_menu(établissement)` | carte publique (établissement, vente, horaires, fenêtres d'heure, « tout de suite », zones, tables, catégories, produits avec disponibilité calculée, portions du jour, suppléments actifs) ; rien si service fermé, établissement inactif, non validé, fermé à la commande ou partenaire non VALIDE ; aucun stock exact, aucune décision de l'administration ; produits retirés exclus |
| `order_code_reveal(p)` | code du client de la commande (compte actif), commande ouverte prête à retirer ou en route, code émis et toujours valable (empreinte revérifiée) ; « Commande introuvable » pour tout autre compte |
| `private.order_issue_code` (recopie), `private.order_codes`, `private.order_codes_clear` | code chiffré à l'émission, remplacé à chaque nouveau code, effacé à la remise et à la fin |
| `order_create_checked(p)` | enveloppe de `order_create` : verrous dans le même ordre, même clé → même commande, montants affichés comparés dans la transaction (rien de créé s'ils diffèrent) |
| `order_payment_start(p)` | enveloppe de `order_payment_create` : même clé → même paiement, montant affiché comparé dans la transaction (aucun paiement s'il diffère) |
| `GET /api/restaurants/[id]/menu` | carte par établissement (avant : par partenaire, photo extérieure) |
| `POST /api/orders/quote` | champ `total` calculé par le serveur (l'écran n'additionne rien) |
| `POST /api/orders/create` | en-tête `Idempotency-Key`, `expectedTotal`, `expectedToPay` ; refus « Le prix de votre commande a changé : 5 250 F CFA. Vérifiez avant de payer. » |
| `POST /api/payments/create` (ORDER) | en-tête `Idempotency-Key`, `expectedAmount` ; refus « Le montant à payer a changé : … » ; paiement déjà en attente : `PAYMENT_PENDING` avec le paiement |
| `GET /api/orders/[id]/code` | code du client, `Cache-Control: no-store, private, max-age=0`, rien dans le journal |
| `GET /api/orders` | repas sur `order_state` : libellé, groupe, lien `/orders/<id>`, établissement ; commandes de billets exclues ; lien des réservations de table corrigé (`/tables/reservations/<id>`) |
| `GET /api/payments/[id]/status` | succès et « Réessayer » d'un paiement de commande vers `/orders/<commande>` |
| Cloche | « Donnez … le code reçu par SMS, visible aussi dans votre commande. » (prête à retirer, en route) ; aucun type nouveau |

## Tests et accès

| Suite | Contenu |
|---|---|
| `tests/parcours/l12b-commandes-client.test.ts` | A carte (contenu, champs internes absents, aucune photo extérieure ; 404 : partenaire suspendue, établissement suspendu, fermé à la commande, partiel, inconnu, illisible, identifiant de la partenaire, service fermé) ; C code (le code du SMS pour le client seulement ; autre client, partenaire, livreur : 404 ; jamais dans le suivi, la fiche ou la liste de la partenaire, ni la liste du livreur ; sans cache ; chiffré, jamais en clair ; clé de service sans accès à `private` ; nouveau code ; effacé à la remise, à l'annulation et à la livraison) ; D prix changé entre devis et commande (rien de créé, stock intact), total forgé, prix dans les lignes ignoré, double clic, requêtes simultanées et rejeu avec la même clé (une commande), clé d'un autre compte, clé illisible ; E montant affiché faux (aucun paiement), même clé (même paiement), autre demande pendant l'attente (`PAYMENT_PENDING`), acompte 30 % puis solde avec le vrai webhook, plus rien à payer ; annulation (montant rendu, commande d'autrui 404) ; F réglementé : carte, devis, commande, paiement après décision de l'administration ; G Mes commandes (groupe, lien, non payée à temps, rien d'un autre compte, suivi d'autrui 404) |
| `tests/parcours/l12b-produits-rest.test.ts` | REST des produits, suppléments et portions avec la clé anon et un autre compte ; la propriétaire lit les siens (prouvée rouge sur main, run 738) |
| `tests/schema/migration-lot12b-rejouable.test.ts` | ordre, rejouable deux fois, seule recopie sans ligne perdue (lignes citées 281-299 vérifiées), aucune autre fonction redéfinie (12c, 12a S1, cœur des commandes), droits, règles de lecture |
| `tests/schema/l12b-ecrans-statique.test.ts` | aucune image extérieure ; route du code sans cache ni journal ; aucun stockage direct ni trace dans les écrans ; aucun calcul de montant dans le navigateur ; panier gardé sans prix ; lien de la coquille ; modules sans dépendance serveur ; part du paiement conforme au schéma ; `PRODUCT_UNDER_REVIEW` ; aucune lecture REST des produits |
| `e2e/lot12b.responsive.spec.ts` | parcours entier à l'écran, clair et sombre, 390 et 1 440 px (voir Captures) ; une seule connexion du client pour tout le spec |

Accès vérifiés : commande, code et annulation d'un autre compte : 404 ; code jamais lisible par la partenaire ni le
livreur (routes et listes) ; carte d'une partenaire suspendue ou d'un établissement non listé ou fermé à la commande :
404 ; REST des produits fermée pour ces cas avec la clé anon ; `private` fermé à la clé de service ; aucune fonction
ajoutée à la liste blanche de `03-verification` (fonctions publiques nouvelles au rôle de service seulement).

## Poids JavaScript et mesure mobile

**Aucun budget relevé.** Avant : run de main **724** (`5b7f3399ca`). Après : run complet **752** (`6be47e3c2a`). Octets
gzip du premier chargement, budgets inchangés :

| Route | Avant (724) | Après (752) | Écart | Fichiers | Budget |
|---|---|---|---|---|---|
| `/` (accueil) | 215 613 | 215 656 | +43 | 18 → 18 | 226 342 |
| `/events/[id]` (fiche) | 224 570 | 224 609 | +39 | 17 → 17 | 233 316 |
| `/tickets` (Mes billets) | 241 692 | 241 731 | +39 | 21 → 21 | 250 417 |
| `/controller/scanner` | 225 297 | 225 340 | +43 | 16 → 16 | 234 911 |
| `/billet/hors-ligne` | 214 237 | 214 280 | +43 | 15 → 15 | 224 268 |
| `/explore` | 226 459 | 226 766 | +307 | 19 → 19 | 235 712 |

- **+39 à +43 o partout** : le lien « Restaurants et tables » de la coquille (`/tables` au lieu de l'établissement
  d'exemple) et l'identifiant de la route ; aucun module ajouté au premier chargement (seule la ligne 184 de
  `AppLayout.tsx` a changé).
- **Explorer +307 o, même nombre de fichiers** : les préférences de l'appareil (`lib/device/device-prefs.ts`) sont
  partagées par Explorer ; la section du panier y ajoute deux fonctions courtes (lecture et écriture, 710 caractères).
  Les runs 731 et 733 montraient un fichier de plus sur Explorer (le découpage de webpack regroupait autrement les
  préférences au-delà de son seuil de 20 000 o) : la mise en forme du panier est passée dans `lib/orders/device-store.ts`,
  chargé à la demande par la carte seule, et la section de `device-prefs.ts` réduite au strict nécessaire (run 737 :
  19 fichiers, +307 o).
- Les écrans du lot (carte, suivi, Mes commandes) ne sont pas budgétés ; aucun n'entre dans le premier chargement des
  pages mesurées.

**Mesure mobile** (Lighthouse mobile, médiane de 5 passages, seuil 90 inchangé) :

| Page | Avant (724) | Après (752) | Après, mesure refaite (760) |
|---|---|---|---|
| Accueil | 92 [92 ; 92 ; 89 ; 96 ; 90] | 93 [89 ; 93 ; 93 ; 93 ; 92] | 91 [91 ; 91 ; 93 ; 91 ; 92] |
| Fiche « ce soir » | 95 [95 ; 95 ; 93 ; 93 ; 95] | **89** [86 ; 88 ; 89 ; 94 ; 91] | **89** [88 ; 91 ; 89 ; 86 ; 95] |
| Mes billets | 92 [92 ; 96 ; 93 ; 90 ; 92] | 92 [91 ; 92 ; 94 ; 91 ; 93] | 90 [87 ; 92 ; 90 ; 91 ; 90] |
| Toucher (le plus long) | 80 ms | 80 ms | 88 ms |

La fiche n'est pas touchée par le lot (+39 o, comme l'accueil) ; son affichage principal est identique (2,11 s avant et
après) et sa note varie d'un run à l'autre sur le même code (branche : 91, 92, 93 aux runs 731, 733, 737 ; main : 90 au
run 720, 95 au run 724). Selon la règle en vigueur (un point de moins sur une page non touchée : on relance la mesure,
rien d'autre), la mesure a été refaite sans aucune modification de code : au run 755 elle est « faussée, à relancer » (machine de la CI trop rapide aux trois tentatives, voir Runs), puis relancée au run 760 (mesure valide, machine dans la plage) : **fiche encore à 89**.

Ce que montrent les relevés de la fiche (temps de blocage, TBT, médiane Lighthouse) : main 224 et 250 ms (runs 728,
724) ; lot 12b 315, 400 et 434 ms (737, 752, 760) ; lot 12c 296 ms (753). Le profil processeur de la fiche
(`perf/profil-fiche.txt`) charge les **mêmes fichiers** sur la branche que sur les branches 11c et 12c (aucun morceau
nouveau), dans des proportions comparables (moteur de React, chargeur de webpack, morceau commun) ; le lien
« Restaurants et tables » de la coquille est dans le menu de bureau (`hidden lg:flex`), donc ni affiché ni préchargé sur
mobile. Je n'ai trouvé aucun mécanisme par lequel le lot alourdit la fiche, mais l'écart de temps de blocage avec main
est répété sur trois runs : **je ne peux pas l'écarter**. Trois essais faits sur ce blocage (752, 755, 760) : arrêt,
décision à prendre (voir « À lire en premier », point 7).

**Mesure A/B sur la même machine (décision du 27/11, run 763, vert).** Branche jetable `lot12b/mesure-ab` (`4aae949c5d`,
jamais fusionnée) : son job de mesure construit la branche (`06780285fd`) et main (`5b7f3399ca`, lot 11c-b fusionné en
`774e19a34a` puis documentation) dans le même job, même `.env.test`, même commande de build, puis démarre les deux
contre la même base (main sur le port 3001). `scripts/e2e/perf-ab.mjs` (même mécanique Lighthouse que la mesure
officielle : préréglage mobile, relais HTTP/2, hôtes externes bloqués) mesure la fiche « ce soir » 5 tours ; à chaque
tour, une calibration de la machine, puis main, puis la branche, au même ralentissement (indice 1 902 à 1 693, ×3,81 à
×3,39). Sorties : `ci-results`, `runs/763-45986607226/perf/` (`ab.txt`, `ab-fiche.tsv`, `ab-scripts.tsv`,
`ab-profil.txt`…).

| Fiche, même machine | Main (`5b7f3399ca`) | Branche (`06780285fd`) | Écart |
|---|---|---|---|
| Score Lighthouse | **94** [88 ; 94 ; 95 ; 94 ; 96] | **94** [94 ; 94 ; 94 ; 94 ; 93] | 0 |
| TBT | 254 ms [405 ; 254 ; 251 ; 278 ; 190] | 269 ms [269 ; 256 ; 262 ; 273 ; 306] | +15 ms |
| LCP | 2 118 ms [2 439 ; 2 118 ; 1 818 ; 1 824 ; 2 118] | 2 113 ms [2 113 ; 2 121 ; 2 115 ; 1 813 ; 1 816] | −5 ms |
| FCP | 981 ms | 922 ms | −59 ms |
| CLS | 0,000 | 0,000 | 0 |
| JS transféré | 238 887 o | 238 927 o | +40 o |
| Scripts exécutés / longues tâches | 5 / 5 | 5 / 6 | — |

Profils processeur de la fiche (5 par côté, en alternance, ×4, 4G simulée) : mêmes 23 scripts chargés des deux côtés
(aucun seulement d'un côté) ; temps par fichier égaux à quelques millisecondes près (moteur de React 195,3 / 194,9 ms ;
chargeur de webpack 173,7 / 161,7 ms ; morceau commun 70,5 / 67,5 ms ; mise en page commune 10,4 / 13,0 ms ;
`ui-base` 12,3 / 10,7 ms). **Conclusion : sur la même machine, la fiche de la branche et celle de main sont identiques**
(même note, même code exécuté) ; les 89 des runs 752 et 760 et les 95 de main aux runs 724 et 728 viennent des machines
de la CI, différentes d'un run à l'autre. Comme le prévoit la décision : mesure seule relancée, run **764** (`5d392ba9d5`) : **non concluant**, les 15 tours de ses
3 tentatives sont faussés (machine de la CI trop rapide, indice 3 107 à 3 709 pour une plage de 1 000 à 3 000, ralentissement
×6,21 à ×7,42) ; les trois pages baissent ensemble (accueil 89 [89 ; 91 ; 91 ; 89 ; 89], fiche 87 [87 ; 87 ; 91 ; 85 ; 86],
Mes billets 87 [86 ; 88 ; 90 ; 86 ; 87]) et le toucher n'a pas été mesuré faute de temps après les reprises. Le run sort
« hors seuil » au lieu de « faussée, à relancer » parce que le toucher manque. Arrêt sur ces chiffres (décision).

## Captures

Run complet **752**, branche `ci-results`, dossier `runs/752-45948214851/captures-responsive/` : **64 captures du lot**
(`l12b-<écran>__<largeur>__<thème>.jpg`, 390 et 1 440 px, clair et sombre), prises par `e2e/lot12b.responsive.spec.ts`
sur un établissement de test (« Chez Fatou », organisatrice 3) :

| Écran | Ce qu'on y voit |
|---|---|
| `carte` | carte des plats, onglets des catégories, panier vide |
| `plat-du-jour` | encart du plat du jour et portions restantes |
| `non-commandable` | boisson réglementée « Non commandable en ligne » et dessert « Épuisé » |
| `fiche-plat` | fiche d'un plat avec suppléments (Piment, Frites) et remarque |
| `panier-devis` | panier avec sous-total, frais de service et total relus au serveur |
| `sur-place` | mode « Sur place » et liste des tables |
| `choix-heure` | « Autre heure » : jour et heure |
| `paiement` | page de la commande, compte à rebours et choix de l'opérateur |
| `suivi-recue`, `suivi-acceptee`, `suivi-preparation` | frise du suivi à chaque étape |
| `code` | code de remise affiché en grand au-dessus de la frise (commande prête) |
| `suivi-retiree` | commande remise, demande d'avis |
| `annulation`, `annulee` | confirmation d'annulation puis commande annulée |
| `mes-commandes` | Mes commandes : en cours et passées, « Commander à nouveau » |

Les photos des plats en test sont l'affiche de démonstration des événements (aucune photo venue d'un site extérieur,
contrôlé par `l12b-ecrans-statique` 1).

Contrôle responsive du même run : public 33 pages, 297 contrôles, 0 défaut ; administration 19 pages, 0 défaut ;
organisatrice 40 pages, 0 défaut ; scanner 5 pages, 0 défaut. Les trois écrans du lot sont exclus de la liste générale
(`e2e/support/responsive-pages.ts`) parce que le spec du lot les contrôle avec des données réelles (mêmes contrôles,
mêmes largeurs).

## Runs

| Run | Commit | Mode | Résultat | Cause et suite donnée |
|---|---|---|---|---|
| 729 | `66e430aff4` | rapide (serveur) | rouge | `client-interface` attendait l'ancien lien `/restaurants/…` de la coquille → test modifié (signalé) |
| 731 | `74743508ea` | rapide (écrans, responsive, captures) | rouge | `carte-b3` : liste exacte des champs publics (ajout `orders`) → spec modifié (signalé) ; « Piment » ambigu → texte exact ; Explorer +1 fichier |
| 733 | `f79bad5273` | rapide | rouge | mode par défaut « Livraison » demandait une zone → « À emporter » par défaut ; Explorer toujours +1 fichier |
| 737 | `dbd8048790` | rapide | rouge | Explorer revenu à 19 fichiers ; faux « texte coupé » dans une fenêtre qui défile → contrôle responsive corrigé (signalé) |
| 738 | `93cd6e705a` | preuve (`lot12b/rouges`) | rouge attendu | faille 1 prouvée sur main : la clé anon lit 4 produits au lieu de 1 |
| 742 | `fd485a64c5` | rapide | rouge | champ « Heure » ambigu dans le spec ; fenêtre d'annulation de rôle `alertdialog` |
| 745 | `145529d80e` | rapide | rouge | aucun paiement créé depuis le suivi : `part: 'PREMIER'` refusé par le schéma → **défaut réel de l'écran** (faille 4), corrigé + contrôle 4 bis |
| 747 | `5b8c77ed36` | rapide | annulé | remplacé par 748 (poussée suivante) |
| 748 | `5adf34e4c3` | rapide | rouge | « Wave » ambigu une fois l'opérateur mémorisé (« Numéro Wave du payeur ») → libellé exact |
| 750 | `871ff3acc9` | rapide (écrans, responsive, captures) | **vert** | parcours entier à 390 et 1 440 px |
| 752 | `6be47e3c2a` | **complet** | rouge | 635/636 suites (seule `recette-matrice` : deux références de lignes de `docs/recette-billetterie.md` périmées par le lot) ; e2e 783 passés ; responsive 0 défaut ; budgets OK ; mesure : fiche 89 |
| 755 | `e19e67a57e` | rapide (`recette-matrice` + mesure) | rouge (mesure faussée) | références recalées (`interrupteurs.test.ts:405`, `MenuView.tsx:307`), aucune assertion modifiée : typecheck, lint et `recette-matrice` OK ; mesure **faussée, à relancer** : machine de la CI hors de la plage du téléphone de référence aux 3 tentatives (indice 3 312 à 3 645, plage 1 000 à 3 000), aucune conclusion sur les seuils |
| 764 | `5d392ba9d5` | rapide (`recette-matrice` + mesure) | rouge (non concluant) | matrice OK ; 15 tours faussés sur 15 (indice 3 107 à 3 709) : accueil 89, fiche 87, Mes billets 87, toucher non mesuré |
| 763 | `4aae949c5d` (`lot12b/mesure-ab`, jetable) | mesure A/B (main et branche, même job) | **vert** | fiche main 94, branche 94 ; TBT 254 / 269 ms ; mêmes 23 scripts ; aucun écart imputable au lot |
| 760 | `1aa357304b` | rapide (`recette-matrice` + mesure) | rouge (mesure hors seuil) | matrice OK ; mesure valide : accueil 91, **fiche 89**, Mes billets 90, toucher 88 ms ; 3e essai sur ce blocage, arrêt |

## Essais pour un non-développeur

Sur une base de recette où le service des commandes est ouvert et un établissement prend des commandes :

1. Ouvrez la fiche de l'établissement (Restaurants et tables) : un encart « Commander » apparaît. Touchez-le.
2. La carte s'ouvre : vérifiez le plat du jour et ses portions restantes, une boisson alcoolisée affichée avec son prix et
   « Non commandable en ligne », un dessert « Épuisé » sans bouton d'ajout.
3. Ajoutez un plat avec un supplément : le panier montre le sous-total, les frais de service et le total ; changez la
   quantité, le total se met à jour (c'est le serveur qui calcule).
4. « Finaliser » : essayez « Sur place » (liste des tables), « Autre heure » (jour et heure), puis « À emporter »,
   « Tout de suite », « Tout payer », « Commander ».
5. Sur la page de la commande : compte à rebours de 15 minutes ; payez avec Wave (numéro prérempli au 2e achat).
6. Côté restaurant, acceptez, préparez, puis « Prête » : la frise s'allume étape par étape ; le code de 4 chiffres
   s'affiche en grand en haut de la page, le même que dans le SMS. « Recevoir un nouveau code » : le nouveau code remplace
   l'ancien à l'écran.
7. Remettez la commande avec ce code : le code disparaît, l'étape « Retirée » s'allume.
8. Passez une seconde commande « À la remise », puis « Annuler la commande » : la fenêtre dit ce qui est rendu ;
   confirmez.
9. Mes commandes : les deux commandes sont dans « Terminées » avec « Commander à nouveau » ; touchez-le : le panier se
   remplit avec les plats encore disponibles.
10. Déconnectez-vous puis revenez sur la carte : le panier gardé a disparu.

## Autres idées

- Montrer dans le panier le montant exact du solde futur (frais compris) par une lecture « devis du solde » en base.
- Avis « commande prête » avec un lien qui ouvre le code en grand (écran plein, pour le comptoir ou le livreur).
- Plats du jour sur l'accueil et recherche par plat (lot 12e) en réutilisant `order_venue_menu`.
- QR de table : la liste des tables du 12b est déjà servie (`spots`) ; le QR n'aurait qu'à préremplir la table.
- Visuels par catégorie (dessins locaux) pour les restaurants qui n'ont pas encore de photos de plats.
- Suivi en temps réel par un canal dédié (signal comme celui des tables) au lieu de la relecture toutes les 10 s.
