# Lot 12c — Commandes : écrans de la partenaire et vérification des produits

Branche `lot12c/partenaire` (worktree `event-village-lot12c`), partie de `main` 953914229a, `main` 774e19a34a (lot 11c-b)
fusionnée en cours de lot. **Non fusionnée dans `main`, aucune migration appliquée** (consigne). Chemins relatifs au
dépôt ; `M/` = `supabase/migrations/`.

Résultat : **run complet 732** (branche à jour avec `main` 5b7f3399ca) : qualité, e2e, contrôle responsive (247 tests, 0
défaut bloquant, écrans du lot contrôlés et capturés dans les deux thèmes), budgets (toutes les pages budgétées en légère
baisse) et mesure mobile (94 / 91 / 92) verts ; tests 634/636, les deux rouges (contrôles statiques : appel de
`requireActiveSession` dans chaque route, numéros de ligne de la recette) corrigés et **verts au run rapide 734**. Quatre
migrations `20261224000001` à `…04`, **non appliquées**. Une décision à valider : les trois fonctions des réglages ne sont
pas recopiées (voir ci-dessous).

---

## À lire en premier

### Migrations (4, intervalle 20261224…, à appliquer dans l'ordre, après celles de `main`)

| Fichier | Contenu |
|---|---|
| `M/20261224000001_l12c_verification.sql` | colonnes `products.review_state`, `review_words`, `review_requested_at`, `archived_at` et `order_delivery_zones.archived_at` ; réglage `orders.review_keywords` (18 mots par défaut) et `order_review_keywords_set` / `_valid` ; aides `private.order_text_fold`, `order_review_words`, `order_catalog_owner`, `order_product_review_notify` ; **recopies** de `product_regulated`, `products_order_guard`, `order_product_regulation_decide` ; nouvelles `order_product_save`, `order_product_remove` ; avis `ADMIN_PRODUCT_REVIEW`, `PRODUCT_REVIEW_DECIDED` |
| `M/20261224000002_l12c_zones_supplements.sql` | `order_delivery_zone_set`, `order_delivery_zone_remove`, `order_delivery_zones_reorder`, `product_option_set`, `product_option_remove` (aucune recopie) |
| `M/20261224000003_l12c_devis.sql` | **recopie** de `order_quote_compute` (produit archivé, produit « à vérifier ») |
| `M/20261224000004_l12c_journee.sql` | `order_partner_day` (« Ma journée », lecture seule) |

- Sans `BEGIN` ni `COMMIT`, rejouables (rejouées dans une transaction annulée par `l12c-catalogue`, L) ; fonctions
  publiques au **rôle de service seulement**, aides `private` à **aucun** rôle de l'API (contrôlé par `l12c-statique` S3).
- **Une seule recopie par fonction dans le lot**, depuis sa dernière définition, sans ligne perdue (`l12c-statique` S1) :

  | Fonction | Dernière définition recopiée | Changement |
  |---|---|---|
  | `product_regulated` | `M/20261130000002_l12a_catalogue.sql:86-94` | vrai aussi tant que le produit est « à vérifier » (1 ligne élargie) |
  | `products_order_guard` | `M/20261130000002_l12a_catalogue.sql:96-139` | bloc ajouté : état « à vérifier », mots trouvés et archivage écrits seulement par les fonctions en base |
  | `order_product_regulation_decide` | `M/20261130000002_l12a_catalogue.sql:373-415` | la décision efface l'état « à vérifier », avis à la partenaire (2 lignes élargies) |
  | `order_quote_compute` | `M/20261130000004_l12a_devis_commande.sql:196-456` | 2 refus ajoutés (archivé, à vérifier), aucune ligne retirée |

- **Écart à la consigne, voulu et à valider : `finance_setting_set`, `fin_setting_valid` et `platform_settings_defaults`
  ne sont PAS recopiées.** La suite d'audit `tests/audit/cv12a-3-statique.test.ts` (S1) exige **une seule** recopie de
  ces fonctions après `main` (`lotDefs.length === 1` pour tout fichier ≥ 20261130000001) : les recopier une deuxième
  fois la ferait passer au rouge, et ses assertions ne se changent pas. Même solution que le lot 11c-a
  (`M/20261201000001`) : fonction propre `order_review_keywords_set` (super-administrateur actif, motif historisé par
  `platform_settings_history`, mêmes refus). `platform_settings_defaults` couvre déjà le préfixe `orders`
  (`M/20261130000001_l12a_reglages.sql:226`). Le réglage n'est donc pas modifiable par la page générique des réglages
  (elle ne sert plus cette clé : c'est une liste) mais par la page « Produits à vérifier ».
- **« À vérifier » posé par une fonction en base, pas par un déclencheur sur toute écriture.** Plusieurs suites
  existantes, dont la suite d'audit `cv12a-1-trous` (T2c « Vin de palme », T2d « Bière blonde ») et `l12a-commandes`
  (« Vin rouge », « Bière pression », « Cigarettes »), créent ces produits par une écriture directe du rôle de service et
  attendent qu'ils soient commandables avant de les rendre réglementés : un déclencheur sur toute écriture les ferait
  échouer. L'état est donc posé par `order_product_save` (création et modification d'un produit par sa partenaire) et
  `product_option_set` (supplément), seuls chemins d'écriture de la partenaire ; la garde `products_order_guard` refuse
  à toute autre écriture de poser, d'effacer ou de modifier l'état et l'archivage (testé : écriture directe refusée), et
  `l12c-statique` S4 vérifie qu'aucun code applicatif n'écrit `products` directement, sauf le statut.

### Failles

**Aucune faille de sécurité nouvelle trouvée** dans le code des commandes du lot 12a en le reprenant (routes de la
partenaire, fonctions en base, garde des fiches). Défauts et durcissements traités dans le lot, chacun prouvé par
`l12c-catalogue` :

| Défaut de l'existant | Correction | Preuve |
|---|---|---|
| Supprimer un produit déjà vendu : erreur 500 (clé étrangère `order_items.product_id … ON DELETE RESTRICT`, `M/0001_initial_schema.sql:497`) — relevé par l'état des lieux | `order_product_remove` : archivé (retiré de la carte, gardé dans l'historique) ; un produit jamais vendu est supprimé avec ses suppléments et ses portions (la garde des portions refusait aussi cette suppression) | G |
| Prix d'un produit accepté jusqu'à 100 000 000 F avec des centimes par la route, refusé ensuite par la contrainte de la base (`products_price_franc_chk`) en erreur générique | prix entier de 0 à 10 000 000 F à la route ET en base (`INVALID_PRICE`) | E |
| Coordonnées du client (adresse, téléphone, consignes) servies à la partenaire jusqu'à 7 jours après la remise | servies seulement pendant la commande ouverte (décision du client du 26/11), la base masquant toujours au bout de 7 jours | J |
| Aucun chemin pour écrire zones et suppléments : les seules écritures étaient faites par le rôle de service (tests) | fonctions en base bornées, propriétaire, fiche VALIDE ; écritures REST toujours refusées | H, I, L |
| Contournements possibles du futur « à vérifier » si l'état était écrit par la route | état posé et effacé seulement par les fonctions en base ; la garde refuse toute autre écriture ; un supplément ou une description avec un mot de la liste le pose aussi | B |

### Tests existants modifiés (tous signalés ; aucune suite de `tests/audit/` ni `tests/audit-auth/` touchée)

| Fichier | Avant | Après | Raison |
|---|---|---|---|
| `tests/parcours/partenaire-lot7.test.ts:783` (garde-fou SCENARIO 15) | exige `import { usePartnerOrders } from 'hooks/usePartnerOrders'` dans le tableau de bord | exige **l'absence** de cet import et la lecture de `/api/partner/orders/day` et `/api/partner/orders?filter=open` | consigne (point 6) : la partenaire ne lit plus les commandes par REST depuis le 12a, le crochet ne rendait plus rien ; il est supprimé |
| `tests/parcours/partenaire-lot7.test.ts:926` (A21) | « le code mentionne toujours Realtime ou connected » (mot lu de `usePartnerOrders`) | la carte des commandes dit l'heure de sa dernière mise à jour (`openOrders.updatedAt`, `formatTime(...)`) | plus de temps réel des commandes pour la partenaire |
| `tests/schema/f3b-ecrans.test.ts` (menu de l'administration) | `partners.validate` → aucune entrée ; liste exacte du SUPERADMIN sans `/admin/products` | `partners.validate` → `/admin/products` ; `/admin/products` ajouté après `/admin/halls` | entrée « Produits à vérifier » ajoutée au menu (sinon la page n'est atteignable que par les avis) |
| `tests/parcours/notif-modeles.test.ts`, `tests/parcours/notif-outbox.test.ts` (table G2 du contrat) | — | 2 lignes ajoutées : `ADMIN_PRODUCT_REVIEW`, `PRODUCT_REVIEW_DECIDED` | nouveaux types d'avis (même pratique que les lots 11c-a et 12a) ; aucune assertion existante changée |

### Fichiers partagés touchés

- `lib/orders/booking.ts` : **ajouts seulement** (fin du fichier : `ORDER_CLOSED_STATES`, `partnerOrderView`). Le code de
  refus `PRODUCT_UNDER_REVIEW` (devis) prend le statut par défaut de `orderRefusalStatus` (409) : je n'ai pas modifié son
  `switch` (« ajouts seulement ») ; le 12b peut l'ajouter aux 400 s'il le souhaite.
- `lib/notifications/catalog.ts`, `catalog-types.ts`, `outbox-labels.ts` : 2 types ajoutés.
- `lib/device/device-prefs.ts` : préférence du son des commandes (clé sous `event-village:appareil:`, effacée à la
  déconnexion comme les autres ; seul fichier où une écriture du stockage est admise par `cvf2b-6`). Conflit de fusion
  avec le 11c-b réglé en gardant les deux blocs.
- `components/layout/admin-nav.ts` (menu de l'administration, chargé à la demande, hors des pages budgétées).
- `app/api/admin/finance-settings/route.ts` : ne sert plus `orders.review_keywords`.
- `app/api/partner/orders/route.ts`, `app/api/partner/orders/[id]/route.ts` : coordonnées du client retirées d'une
  commande terminée ; `onsiteAmount` dans la réponse d'une action.
- `lib/products/product.service.ts` : création, modification, retrait par les fonctions en base ; « épuisé » admis à la
  main ; prix entier ≤ 10 000 000 ; établissement à la création seulement.
- `tests/helpers/design-files.ts`, `e2e/support/responsive-pages.ts` : écrans du lot.
- **Non touchés** (consigne) : `app/orders/**`, `app/restaurants/**`, `app/api/orders/route.ts`,
  `private.order_issue_code`, `products_read`, `components/layout/AppLayout.tsx`.

### Pour le lot 12b (en parallèle)

- Le menu public du 12b doit exclure les produits **archivés** (`products.archived_at IS NOT NULL`) et montrer les
  produits « à vérifier » comme non commandables : `product_regulated` les dit déjà réglementés, et le devis refuse avec
  `PRODUCT_UNDER_REVIEW` (« … est en cours de vérification par Event Village : il ne se commande pas encore en ligne. »).
- Zones : `order_delivery_zones.archived_at` (zone retirée qui a servi) ; ne proposer que `is_active AND archived_at IS NULL`.

---

## Écrans livrés

Tous derrière l'interrupteur `features.orders_enabled` (layouts de garde existants), sauf la page de l'administration.
Jetons du système de design seulement (contrôle `design-systeme`, 889 cas verts en local), aucun montant calculé dans le
navigateur, refus du serveur affichés tels quels, animations 150-300 ms en `motion-safe:` (coupées si « réduire les
animations »), cibles tactiles de 44 px au moins.

| Adresse | Contenu |
|---|---|
| `/partner/products` | « Ma carte » : choix de l'établissement (puces), grille de cartes (photo ou illustration, prix en grand, pastilles de disponibilité, « Plat du jour » avec la jauge des portions du jour mis en tête, « Réglementé » et sa sorte, « En vérification » avec la raison, « Refusé à la vente »), filtres par catégorie, état vide illustré « Ajoutez votre premier plat », changement rapide de disponibilité (disponible, indisponible, épuisé, suspendu), « Retirer » (supprimé s'il n'a jamais été vendu, archivé sinon : la fenêtre le dit avant), bandeaux (fiche suspendue en lecture seule, établissement en attente de validation, commandes fermées, produits en vérification) |
| `/partner/products/new`, `/partner/products/<id>` | formulaire : établissement choisi à la création puis verrouillé (« L'établissement ne change pas »), photo, nom, description, catégorie (création sur place), prix entier, suivi du stock, plat du jour et portions du jour (vendues / servies par la base), case « réglementé » avec l'explication AVANT de cocher et la sorte, suppléments (ajout, prix, masquer, retirer), aperçu « vue client » ; produit d'une autre partenaire ou archivé : « Cet élément n'est plus disponible » |
| `/partner/products/vente` | « Réglages de vente » par établissement : ouvert à la commande, modes (livraison, retrait, sur place avec la liste des tables de l'établissement et un lien pour les gérer), acompte (10 à 90 %, défaut de la plateforme rappelé), paiement à la remise, préparation (10 à 240 min) ; zones de livraison en liste (nom, frais, minimum, active, ordre par glisser au doigt ou à la souris, et boutons « Monter » / « Descendre » au clavier), retrait expliqué (supprimée, désactivée car une commande en cours l'utilise, ou retirée) |
| `/partner/orders` | « Commandes » : relecture de la route serveur toutes les 5 s **tant que la page est visible** (arrêt quand elle est cachée, relecture au retour) — plus aucun temps réel REST ; « Ma journée » (commandes du jour, à accepter, recette du jour avec la part payée en ligne et sur place, plats bientôt épuisés), servie par la base ; colonnes Reçues / En préparation / Prêtes / En route sur tablette et ordinateur, onglets avec compteurs sur téléphone ; une carte par commande (numéro en grand, mode, lignes, montant servi, heure demandée mise en avant pour une commande pour plus tard), qui glisse d'une colonne à l'autre ; nouvelle commande : courte animation, halo, **son** (Web Audio, après un premier toucher comme l'exige le navigateur ; bouton pour couper, préférence gardée sur l'appareil) et **vibration** ; compte à rebours des 15 minutes en anneau, vert → orange (5 min) → rouge (2 min) avec le texte (« Répondez tout de suite »), annoncé aux changements de palier seulement ; onglet « Terminées » ; bandeau de lecture seule d'une fiche suspendue |
| `/partner/orders/<id>` | fiche : étapes avec heures, lignes et suppléments, consignes, montants servis (articles, livraison, total, payé, reste à encaisser, remboursé), heure demandée et estimée, mode, zone ou table ; coordonnées du client **seulement pendant la commande ouverte** (« masquées une fois la commande terminée » ensuite) ; actions selon l'état : accepter (minutes), refuser (motif envoyé au client), préparer, prête, confier à un livreur actif ou « Je livre moi-même », partir, remettre (code en **4 grandes cases**, essais restants, blocage expliqué, « Reste reçu en espèces » avec le montant servi ; vibration au bon code, coche animée), annuler (motif) ; commande absente ou d'une autre partenaire : « Cet élément n'est plus disponible » |
| `/partner/orders/livreurs` | inviter par numéro, invitations (nom masqué avant l'accord), livreurs actifs, retirer (fenêtre : ses livraisons pas encore parties lui sont retirées) |
| `/partner/dashboard` | carte « commandes » lue par `/api/partner/orders/day` et `/api/partner/orders` (relue toutes les 30 s pendant la visibilité), heure de mise à jour ; `hooks/usePartnerOrders.ts` supprimé |
| `/admin/products` (menu « Produits à vérifier », droit `partners.validate`) | file des produits à vérifier et des produits marqués « réglementé » sans décision : photo, texte et suppléments avec **les mots trouvés surlignés** (même règle que la base : sans accents, début de mot, pluriel), établissement, partenaire, date ; « Autoriser à la vente » / « Refuser à la vente » avec motif (fenêtre qui dit les conséquences) ; historique des décisions ; liste des mots (modifiable par un super-administrateur, avec motif) ; `?produit=<id>` (lien de l'avis) met la carte en vue |

## Serveur ajouté

| Route | Fonction en base | Règles |
|---|---|---|
| `GET /api/partner/catalog` | — (rôle de service, partenaire de la session) | établissements (réglages, zones non archivées, tables actives), catégories, produits non archivés avec suppléments, portions du jour, « réglementé », décision, « à vérifier » ; état de la fiche |
| `POST /api/partner/products`, `PATCH /api/partner/products/[id]` | `order_product_save` | liste blanche (zod) puis la base : fiche VALIDE (SUSPENDU : lecture seule), établissement de la partenaire, choisi à la création et jamais changé (`VENUE_LOCKED`), catégorie de la partenaire, prix entier 0 à 10 000 000, stock entier, 10 images au plus, sorte exigée si « réglementé » ; « à vérifier » posé quand un mot de la liste apparaît dans le nom ou la description (jamais effacé par une modification) ; avis aux administrateurs |
| `GET /api/partner/products/[id]` | — | produit complet ; archivé ou d'une autre : 404 |
| `DELETE /api/partner/products/[id]` | `order_product_remove` | jamais vendu : supprimé avec suppléments et portions ; vendu : archivé (avant : erreur 500 de clé étrangère) |
| `POST /api/partner/products/[id]/status` | (écriture du statut) | « épuisé » admis à la main |
| `GET/POST /api/partner/products/categories` | — | 2 à 60 caractères, 50 au plus, nom déjà pris : la catégorie existante |
| `POST /api/partner/products/[id]/options`, `PATCH`/`DELETE …/options/[optionId]` | `product_option_set`, `product_option_remove` | prix entier 0 à 1 000 000, 20 au plus, produit de la partenaire non archivé ; nom avec un mot de la liste : produit « à vérifier » ; le prix figé des lignes ne change jamais |
| `POST/PUT /api/partner/venues/[id]/zones`, `PATCH`/`DELETE …/zones/[zoneId]` | `order_delivery_zone_set`, `order_delivery_zones_reorder`, `order_delivery_zone_remove` | nom 2 à 80 caractères (unique dans l'établissement), frais entiers 0 à 100 000, minimum entier 0 à 10 000 000, 50 zones ; retrait : supprimée, désactivée si une commande ouverte l'utilise, archivée si seules des commandes terminées l'ont utilisée ; ordre complet exigé |
| `GET /api/partner/orders/day` | `order_partner_day` | jour de Dakar ; jamais une commande non transmise ; état de la fiche |
| `GET /api/partner/orders`, `GET /api/partner/orders/[id]` | `order_partner_list`, `order_view` (12a, inchangées) | coordonnées retirées d'une commande terminée (`contactHidden`) |
| `GET /api/admin/products/review` | — | droit `partners.validate` ; file, historique (journal `PRODUCT_REGULATION_DECIDED`), liste des mots |
| `POST /api/admin/products/[id]/regulation` | `order_product_regulation_decide` (recopiée) | la décision efface « à vérifier » ; avis `PRODUCT_REVIEW_DECIDED` |
| `PUT /api/admin/products/keywords` | `order_review_keywords_set` | super-administrateur ; 1 à 100 mots distincts (une fois pliés), 2 à 40 caractères ; motif |

Avis : `ADMIN_PRODUCT_REVIEW` (administrateurs `partners.validate`, cloche et email, reporté la nuit, lien
`/admin/products?produit=<id>`) ; `PRODUCT_REVIEW_DECIDED` (partenaire, cloche, notification du téléphone et email, lien
`/partner/products/<id>`, texte selon la décision et la case de la partenaire). Aucun SMS.

Garde des fiches suspendues : chaque écriture ajoutée est sous `/api/partner/products/*` ou `/api/partner/venues/*`,
déjà refusées à une fiche SUSPENDU par `partnerEventWrite` (`l12c-statique` S5) ; les fonctions en base refusent aussi
(`PARTNER_SUSPENDED`).

## Tests et accès

### Suites ajoutées

`tests/parcours/l12c-statique.test.ts` (sans base) :

| | Contrôle |
|---|---|
| S1 | 4 recopies, **une seule fois chacune** dans le lot, aucune ligne perdue de leur dernière définition (lignes élargies déclarées une à une) — sortie `[L12C-S1] aucune ligne perdue` |
| S2 | non recopiées : `finance_setting_set`, `fin_setting_valid`, `platform_settings_defaults`, `order_partner_action`, `order_view`, `order_partner_list`, `order_create`, `private.order_issue_code` ; règle `products_read` non touchée |
| S3 | sans `BEGIN`/`COMMIT` ; chaque fonction publique retirée à `PUBLIC, anon, authenticated` et donnée au seul rôle de service ; chaque aide `private` retirée à tous, rôle de service compris, jamais donnée ; `search_path` fixé partout |
| S4 | aucune écriture directe de `products` dans `app/` et `lib/`, sauf le statut (`writeProduct`) ; création, modification, retrait par `order_product_save` / `order_product_remove` |
| S5 | chaque écriture ajoutée est refusée à une fiche SUSPENDU par la garde de la fiche ; `catalog` et `orders/day` sont des lectures |
| S6 | les 2 avis ont dans le catalogue les canaux, le public, la politique, le droit et la règle de nuit de la base |

`tests/parcours/l12c-catalogue.test.ts` (base locale, faux SamirPay ; montants attendus calculés à la main) :

| | Ce qui est essayé | Attendu |
|---|---|---|
| A | « Bière Gazelle 65 cl » par la route ; 7 noms et descriptions (« BIERES fraîches », « Vin de palme », « vinaigrette », « gingembre », « WHISKY » dans la description, « l'alcool », « Chicha et cigarettes ») | état posé, mots trouvés exacts, « vinaigrette » et « gingembre » non ; administrateur `partners.validate` prévenu (cloche, email) ; devis et création refusés `PRODUCT_UNDER_REVIEW` |
| B | renommer sans le mot, champ `review_state` dans le corps, statut changé deux fois, écriture directe de l'état et de l'archivage, supplément « Bière en plus » sur un plat propre, description modifiée avec « vin » | l'état reste ; `FIELD_NOT_EDITABLE` ; écritures directes refusées par la base ; supplément → « à vérifier », devis refusé ; modification → « à vérifier » |
| C | décision sans droit, sans motif, puis « autoriser », puis « refuser » une autre bière et la renommer | 403, `REASON_REQUIRED` ; autoriser : état effacé, commandable, partenaire prévenue (cloche, push, email, `AUTORISE`), historique ; refuser : `REGULATED_PRODUCT`, même renommé |
| D | commande payable à la remise, produit renommé avec « bière » avant l'acceptation ; commande à payer, supplément « Rhum » ajouté avant le paiement | acceptation refusée `REGULATED_ORDER_REFUSED`, commande refusée ; paiement refusé |
| E | prix 2 500,5 / 10 000 001 / −1, prix 2,5 en base, stock −3, « réglementé » sans sorte, établissement d'une autre partenaire, changement d'établissement (route et base), produit d'une autre (lecture, modification, retrait) | tous refusés (`INVALID_INPUT`, `INVALID_PRICE`, `REGULATED_KIND_REQUIRED`, `VENUE_NOT_FOUND`, `FIELD_NOT_EDITABLE`, `VENUE_LOCKED`, 404) ; prix inchangé |
| F | fiche SUSPENDU (remise VALIDE dans un `finally`) : création, supplément, zone par les routes ; enregistrement, zone, supplément, retrait par la base | routes 403 `PARTNER_SUSPENDED` ; base `PARTNER_SUSPENDED` ; catalogue et journée lisibles (`partnerStatus` SUSPENDU) ; produit inchangé |
| G | retrait d'un plat du jour jamais vendu (supplément, portions) ; retrait d'un plat vendu | supprimé avec suppléments et portions ; vendu : archivé, ligne de commande gardée, devis `PRODUCT_UNAVAILABLE`, hors catalogue, 404, modification `PRODUCT_ARCHIVED` |
| H | supplément à 1 000 001, −1, 2,5, « beaucoup » ; supplément sur le produit d'une autre ; commande avec « Frites » à 300 F puis prix passé à 900 F ; 21e supplément | refusés ; 404 ; ligne figée (4 300 / 8 600 F, option à 300 F), nouveau devis à 4 900 F ; `TOO_MANY_OPTIONS` |
| I | zones : nom d'une lettre, frais 100 001 / 2,5 / −5, minimum 10 000 001, établissement d'une autre, nom en double ; devis sous le minimum puis au-dessus ; frais changés après une commande ; retrait d'une zone d'une commande ouverte, puis après la fin de la commande, puis d'une zone jamais servie ; ordre complet puis partiel | refusés (`INVALID_ZONE`, `INVALID_FEE`, `INVALID_MINIMUM`, `VENUE_NOT_FOUND`, `ZONE_EXISTS`) ; `BELOW_MINIMUM` puis 10 000 + 1 500 = 11 500 F ; frais figés à 1 500 F ; `DEACTIVATED` (zone plus proposée), `ARCHIVED`, `DELETED` ; ordre suivi, ordre partiel `INVALID_ORDER` |
| J | acompte 5 / 95 / 33,5 % puis 40 % ; commande non payée ; commande sur place payable à la remise avec téléphone, puis remise ; livreur d'une autre partenaire ; code de remise faux cinq fois puis bon | acompte refusé, puis 4 000 / 6 000 F sur 10 000 F ; commande non payée absente de la liste et 404 ; téléphone pendant la commande ouverte, plus après (`contactHidden`, aussi dans la liste des terminées) ; journée +1 remise, +5 000 F, +5 000 F sur place ; `COURIER_NOT_FOUND` ; essais restants 4, 3, 2, 1, puis blocage, bon code refusé `CODE_LOCKED` |
| K | liste des mots : page générique des réglages, administrateur sans le rôle, valeurs invalides (1 lettre, doublon après pliage, vide, 101 mots, nombre, « ; », texte seul), sans motif, puis ajout de « bissap fermenté » | absente de la page générique ; 403 ; `INVALID_VALUE` ; `FORBIDDEN` ; `REASON_REQUIRED` ; produit suivant « à vérifier » avec ce mot ; motif historisé ; liste remise dans un `finally` |
| L | les 4 migrations rejouées (transaction annulée) après un réglage changé ; fonctions et tables par la session du navigateur | aucune erreur, réglage gardé, droits inchangés ; 10 fonctions refusées à la session, aucune écriture REST des zones, suppléments ni produits |

### Runs

| Run | Commit | Mode | Résultat |
|---|---|---|---|
| 725 | d6a389cbfd | rapide, 106 suites qui citent les tables, écrans et avis touchés | 103/106 : table G2 des avis (notif-modeles, notif-outbox) et `{x.error.message}` rendu (design1b-mots) → corrigés ; `l12c-catalogue` (12 groupes) et `l12c-statique` verts du premier coup |
| 726 | 9c8ca6a3fe | rapide, 19 suites + responsive + captures + mesure | suites vertes ; responsive : thème clair du spec du lot vert (36 captures), thème sombre refusé à la connexion (429, limite par adresse) → une seule connexion ; mesure faussée (machine trop rapide) |
| 730 | 261a369cfa | rapide, 3 suites + responsive + captures | **vert** : 247 tests du responsive, 196 résultats sans défaut bloquant, spec du lot vert dans les deux thèmes, 72 captures |
| **732** | **6e1ca5f9fb** | **complet** (branche à jour avec `main` 5b7f3399ca) | qualité verte ; tests **634/636** ; e2e vert (toutes les phases) ; responsive vert (247 tests, 0 défaut bloquant) ; budgets et mesure mobile verts. Rouges : `statut-compte` (les 7 routes du lot appelaient `requireActiveSession` par l'aide commune, la règle du lot 1B.6 exige l'appel dans chaque fichier) et `recette-matrice` (trois numéros de ligne cités par la recette, décalés par les ajouts du lot) |
| 734 | 256da29e82 | rapide : les 2 suites rouges + `l12c-catalogue`, `l12c-statique`, `f2acv-ecritures-fiche`, `interrupteurs` | **vert** : 6/6, typage et lint ; avec le run complet 732, plus aucune suite rouge |

En local (sans base) pendant le lot : typage, lint, `design-systeme` (889 cas), `design1c-responsive`, `design1b-mots`,
`l12c-statique`, `cv12a-3-statique`, `cv11cb-3-statique`, `cv11cc-3-statique`, `cvcb3-3-statique`, `f3b-ecrans`,
`recette-matrice`, `statut-compte` (partie statique) verts.

Suites d'audit : aucune modifiée ; toutes celles qui citent les tables touchées tournent dans les runs ci-dessus et au run
complet (`cv12a-1`, `cv12a-2`, `cv12a-3`, `cv11a-4`, `cv11a-5`, `cvcb-3`, `cvf2b-6`, `cvf4-*`, `cv9qq-4`…), vertes.

## Poids JavaScript et mesure mobile, avant et après

Octets gzip du premier chargement des pages budgétées (`js-budget.tsv`). Avant : run complet 723 (contenu de `main`
après la fusion du 11c-b, 4b47cf1361). Après : run complet 732 du lot (6e1ca5f9fb). **Aucun budget relevé.**

| Route | Avant (723) | Après (732) | Écart | Budget | Marge |
|---|---|---|---|---|---|
| `/` | 215 613 | 215 534 | −79 | 226 342 | 10 808 |
| `/events/[id]` | 224 570 | 224 474 | −96 | 233 316 | 8 842 |
| `/tickets` | 241 692 | 240 911 | −781 | 250 417 | 9 506 |
| `/controller/scanner` | 225 297 | 225 198 | −99 | 234 911 | 9 713 |
| `/billet/hors-ligne` | 214 237 | 214 148 | −89 | 224 268 | 10 120 |
| `/explore` | 226 459 | 225 887 | −572 | 235 712 | 9 825 |

Aucune page budgétée n'importe de code du lot ; la baisse vient du découpage des morceaux partagés par webpack après la
suppression de `hooks/usePartnerOrders.ts` et du client temps réel des commandes (non vérifié module par module).

Mesure mobile (Lighthouse, médiane de 5 passages, seuil 90) :

| Page | Avant (723) | Après (732) | TBT médian avant → après |
|---|---|---|---|
| Accueil | 93 | 94 | 307 → 292 ms |
| Fiche d'un événement | 93 | 91 | 279 → 342 ms |
| Mes billets | 91 | 92 | 372 → 356 ms |

La fiche perd 2 points sur une page que le lot ne touche pas (aucun octet de plus, −96 octets) : variation de la machine
de CI (règle de la mesure mobile : rien à reprendre). Le run rapide 726 avait une mesure faussée (machine trop rapide,
ralentissement ×6,7 à ×7,2) : non retenue.

## Captures

Publiées sur la branche `ci-results` (`runs/<n>/captures-responsive/l12c-<écran>__<largeur>__<thème>.jpg`), 12 écrans ×
3 largeurs (390, 768, 1 440 px) × 2 thèmes = 72 captures par run, chacune après le contrôle responsive (0 défaut
bloquant) : `commandes` (téléphone : onglets ; tablette et ordinateur : colonnes), `commande-recue` (anneau, « Accepter »),
`saisie-code` (4 grandes cases, « reste à encaisser »), `livreurs`, `catalogue`, `produit` (suppléments, aperçu « vue
client »), `produit-verification`, `nouveau-produit`, `reglages`, `zones`, `tableau-de-bord`, `admin-produits` (mots
surlignés).

Relues à l'œil pendant le lot (run 726, thème clair ; run 730, thème sombre) ; corrigé après lecture : boutons des cartes
de commande trop serrés dans les colonnes de la tablette (empilés), choix de disponibilité tronqué sur la carte du plat du
jour, « 1 remises », « minimum aucun ». Reste visible et accepté : à 1 440 px avec le menu latéral, les quatre colonnes
sont étroites (le numéro complet de la commande passe sur deux lignes) ; le numéro court reste en grand.

## Essais pour un non-développeur

Sur un projet où les migrations du lot sont appliquées, service des commandes ouvert (Réglages de la plateforme →
« Commandes de repas »), avec un compte partenaire validé qui a un établissement validé.

1. **Ma carte** (menu « Produits et menu ») : ajouter un plat « Yassa poulet », 3 500 F, avec la photo. Il apparaît dans
   la grille avec son prix en grand. Ajouter le supplément « Frites » à 500 F.
2. **Produit à vérifier** : ajouter « Bière Gazelle ». Après l'enregistrement, un bandeau bleu « En vérification par
   Event Village » explique que le mot « bière » demande une vérification. Le renommer « Gazelle » : le bandeau reste.
3. **Côté administration** (menu « Produits à vérifier ») : la bière y est, le mot « Bière » surligné. « Refuser à la
   vente », motif « Boisson alcoolisée ». Côté partenaire, une notification arrive ; la carte affiche « Refusé à la
   vente » ; le produit reste affiché avec son prix mais ne se commande pas.
4. **Réglages de vente** : ouvrir la commande, cocher Livraison et Retrait, acompte 40 %. Essayer 95 % : refus en clair
   (« L'acompte est compris entre 10 et 90 % »). Ajouter les zones « Almadies » (1 500 F, minimum 5 000 F) et
   « Mermoz » ; les réordonner en les faisant glisser.
5. **Commandes** (menu « Commandes ») sur une tablette posée au comptoir : toucher l'écran une fois (le son s'active).
   Depuis un autre téléphone, passer une commande « à payer à la remise » : une carte arrive avec un halo et un son,
   l'anneau vert compte les 15 minutes. Toucher « Accepter », puis « Commencer la préparation », puis « Marquer prête » :
   la carte change de colonne.
6. **Remise** : le client reçoit un code par SMS. Ouvrir la commande, taper un faux code : « Code incorrect. Il reste 4
   essais. » Taper le bon code, cocher « Reste reçu en espèces » : coche animée, commande remise ; ses coordonnées
   disparaissent de la fiche.
7. **Livreurs** (bouton depuis les commandes) : inviter un numéro de téléphone qui a un compte ; l'invitation apparaît
   avec un nom masqué jusqu'à l'accord.
8. **Retirer un produit** : retirer un plat jamais commandé (il disparaît) ; retirer un plat déjà vendu : il est archivé
   (il disparaît de la carte et reste dans l'historique des commandes).
9. **Fiche suspendue** (par l'administration) : la carte, les réglages et les commandes restent visibles avec un bandeau
   jaune, sans bouton d'enregistrement ; toute action est refusée.

## Autres idées

- **Revue de la carte après un changement de la liste des mots** : un bouton « Revoir les produits existants » dans la
  page de l'administration (aujourd'hui seuls les produits enregistrés ensuite sont comparés : `docs/apres-lancement.md`).
- **Mode comptoir** plein écran de l'écran des commandes (sans menu, grands boutons, écran gardé allumé par l'API Wake
  Lock) pour une tablette posée en permanence.
- **Impression du bon de cuisine** (format ticket 58/80 mm) à l'acceptation d'une commande.
- **Rupture en un geste** depuis « Ma journée » : « Plus de Thiéboudienne » met le plat du jour à zéro portion.
- **Temps de préparation appris** : proposer à l'acceptation la durée médiane des dernières commandes de l'établissement.
- **Statistiques** (lot 12e) : plats les plus vendus, heures de pointe, part payée en ligne et sur place.
- **Rappel sonore** d'une commande reçue sans réponse à 5 et 2 minutes de la fin du délai (en plus de l'anneau).
- **Archive** des produits retirés, avec « Remettre en vente » (décision du client à prendre).
