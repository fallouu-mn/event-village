# Contre-vérification du lot 12a — Commandes : argent et sécurité

Branche auditée : `lot12a/commandes-argent` à `14b7a718f` (rapport `docs/lot12a-rapport.md`, lu seulement pour repérer
ses affirmations). Branche de preuve : `lot12a/cv-rouges`, partie de `14b7a718f`, **jamais fusionnée** ; tests seuls,
aucun correctif, branche du lot non modifiée, aucun appel au projet distant, aucune migration appliquée, `.env.local`
non lu. Disque C: presque plein (12 à 280 Mo libres) : worktree partiel (fichiers racine, mes suites, ce rapport),
`node_modules` relié par jonction à celui du dossier du lot ; le code du lot lu dans git.

Suites : `tests/audit/cv12a-1-trous` (un test par trou), `cv12a-2-gardes` (garde-fous éprouvés, invariants du lot et
des livraisons précédentes à la fin), `cv12a-3-statique` (recopies, SMS). **Vert = attaque BLOQUÉE, rouge = TROU.**
Mise en place par les aides du lot (`tests/parcours/l12a-helpers.ts` : comptes, établissements, produits, décision de
l'administration, horloge par écriture locale sous le drapeau des fonctions) ; chaque attaque passe par une route
serveur avec le jeton de l'attaquant, ou par la REST avec la clé anon et ce jeton ; jamais par la clé de service.
Faux SamirPay, faux SMS. Interrupteur des commandes ouvert seulement pendant les suites, valeur d'origine remise.

## Verdict

**Aucun trou critique ni élevé ; 2 trous moyens, 7 faibles.** L'argent, le stock, les états, le code de remise et le
cloisonnement REST tiennent sous attaque et sous concurrence ; les 9 recopies n'ont perdu aucune ligne ; F1 à F8 sont
fermées par les routes qu'elles visaient. Les deux trous moyens rouvrent chacun une promesse du lot par une voie que ses
tests ne couvraient pas : **T1** (adresse et téléphone d'un client qui n'a jamais payé montrés à la partenaire, F5 par
la liste des commandes closes) et **T2** (produit réglementé ou partenaire suspendue : le contrôle n'existe qu'au
paiement de la première part). À corriger avant la fusion ; les faibles peuvent suivre dans le même passage.

| # | Trou | Gravité | Point |
|---|---|---|---|
| T1 | Commande **jamais payée** (annulée par le client avant le paiement, ou échue) : listée (« closes ») et lisible par la partenaire **avec l'adresse et le téléphone du client**, pendant 7 jours | moyenne | 5, 6, F5 |
| T2 | **Solde payé en ligne** sans le contrôle d'une commande payable : produit devenu réglementé (paiement créé **et** confirmé), fiche de la partenaire suspendue ; commande payable à la remise dont le produit devient réglementé : acceptée et remise | moyenne | 1, 7 |
| T3 | Même produit répété sur plusieurs lignes : « 1 à 99 » contrôlé par ligne ; **297 portions** du plat du jour tenues par une seule commande non payée (30 lignes : 2 970) | faible | 1, 2 |
| T4 | Invitation d'un livreur : le **prénom** du titulaire de n'importe quel numéro rendu à la partenaire, avant tout accord (et dans la liste de ses livreurs) ; invitations sans limite | faible | 6 |
| T5 | Tableau de bord et métriques de la partenaire : commandes **jamais payées** listées (numéro, montant, mode, date ; sans coordonnées) | faible | 5, F5 |
| T6 | `POST /api/orders/[id]/code` sans interrupteur : nouveau code envoyé par SMS **service fermé** | faible | 5 |
| T7 | 9 aides internes (code en clair, clôture, remise, stock, historique, remboursement) **exécutables par service_role**, donc appelables en RPC avec la clé de service sans contrôle d'acteur ni d'état | faible | 3, 4 |
| T8 | `GET /api/partner/products/[id]` (ancienne route gardée) : produit **non publié** d'une autre partenaire lu, avec stock et décision de l'administration | faible | 5, 10 |
| T9 | Envoi immédiat du code : **un seul journal par commande** ; les nouveaux codes envoyés ensuite ne laissent aucune trace | faible | 4, 8 |

## Runs

| Run | Commit | Mode | Résultat |
|---|---|---|---|
| 553 | `470fb8543` | rapide, 3 suites | `cv12a-1-trous` **0/9** : T1 à T7 rouges, chacun pour la raison visée ; `cv12a-2-gardes` 6/7 : G1 à G6 verts, G7 rouge sur sa dernière vérification seulement (4 SMS de code, 1 ligne au journal), devenue le trou T9 ; invariants du lot et des livraisons précédentes : **0 violation** ; `cv12a-3-statique` **3/3** |
| 554 | `5e5228c56` | rapide, 2 suites | `cv12a-1-trous` **0/12** : les 12 tests de trou rouges (T1 à T9, dont T2a à T2d), chacun pour la raison visée ; `cv12a-2-gardes` **7/7** ; invariants (o1 à o7 du lot, financiers, accès, avis… jusqu'au lot 11a) : **0 violation** |

Journaux bruts : branche `ci-results`, `runs/553-44896795027/test-logs/` et `runs/554-44897364974/test-logs/`.

## 1. Argent : BLOQUÉ, sauf T2

| Attaque | Résultat |
|---|---|
| Quantités −1, 0, 2,5, « 2.5 », 100, « 1e2 », « 99999999999 », « +3 », « 3 » avec espace, « 0x10 » (route) | BLOQUÉE (G4) : toutes refusées, aucune commande |
| Montants envoyés par le navigateur | BLOQUÉE (lecture : `orderInput` ne transmet que des choix ; `order_quote_compute` relit prix et suppléments ; G3 : paiement de 5 000 = **5 250** relus sur la commande) |
| Produit d'un autre établissement de la même partenaire ; d'une autre partenaire ; supplément d'un autre produit | BLOQUÉE (G4) |
| Frais de service, acompte, minimum de zone, plat du jour payé en entier | BLOQUÉE (lecture `20261130000004:428-433`, `:346-348`, `:356-360` ; exemples du lot recalculés à la main : 10 750 → frais 538 ; acompte 4 003,5 → 4 004) |
| Paiement après l'annulation par le client, webhook rejoué | BLOQUÉE (G3) : `ANNULEE_CLIENT`, payé 0, **un** remboursement de 5 250, paiement jamais SUCCESS |
| Paiement créé et confirmé une seule fois (verrou de l'établissement puis du paiement, `ALREADY_CONFIRMED`) | BLOQUÉE (lecture `20261130000005:231-253` ; tous les chemins — webhook, réconciliation, sondage, annulation — passent par `order_payment_confirm` : `lib/payments/confirmation.service.ts:86,188-193`, `confirmOtherPayment` refuse ORDER) |
| Solde payé à la remise jamais compté (noté `onsite_amount`, aucune ligne de paiement) | BLOQUÉE (lecture `20261130000006:374-386`) |
| Remboursement par le moteur (part de la partenaire reprise, Wave à Event Village, parrainage par `fin_refund_apply`), une fois par paiement (`REFUND-ORDER-<paiement>`) | BLOQUÉE (lecture `20261130000006:42-103`) |
| Recettes disponibles 48 h après l'heure prévue ; aucun versement incertain relancé (envoi par `CashoutService.send`, échec repris par la tâche des versements) | BLOQUÉE (recopie `fin_payout_available_at`, `lib/orders/booking.ts:109-118`) |
| Invariants financiers et du lot (o1 à o7) après toutes mes suites | BLOQUÉE : 0 violation (run 553) |
| Solde d'une commande dont le produit est devenu réglementé ; solde payé à une partenaire suspendue | **TROU T2** |

## 2. Stock et portions : BLOQUÉ, sauf T3

| Attaque | Résultat |
|---|---|
| Deux clients sur la dernière portion en même temps | BLOQUÉE (G2) : une 201, une 409 ; vendues 1/1 |
| Portion rendue à l'expiration, puis tâche deux fois | BLOQUÉE (G2) : vendues 0/1, jamais sous zéro (`stock_released_at`) |
| 6 créations simultanées, même client, deux établissements | BLOQUÉE (G1) : 201 ×3, 429 ×3 ; 3 en attente de paiement |
| Stock jamais rendu après la remise ni pour une non retirée | BLOQUÉE (lecture `20261130000004:160`, `20261130000006:137-139`) |
| Même produit sur 3 lignes de 99 | **TROU T3** |

## 3. États : BLOQUÉ (T7 : défense en profondeur)

| Attaque | Résultat |
|---|---|
| Partenaire, livreur, tiers : `UPDATE orders SET order_state = 'REMISE'` par la REST | BLOQUÉE (G5) : aucune ligne, commande inchangée |
| Écriture directe avec la clé de service | BLOQUÉE (garde `trg_0_orders_flow_guard`, test du lot) |
| Remise : 5 codes faux puis le bon ; ancien code après un nouveau ; 4e nouveau code | BLOQUÉE (G7) : `WRONG_CODE` ×4, `CODE_LOCKED` ×2 (le bon code compris), ancien code 409, 429 `TOO_MANY_CODES`, remise avec le dernier code seulement |
| Annulation client après le début de la préparation ; sans réponse à 15 min ; non retirée à 24 h ; plat du jour pour demain | BLOQUÉE (lecture `20261130000006:238-241`, `:946-982`, `20261130000004:424-426` ; tests du lot) |
| Aides internes appelées directement avec la clé de service | **T7** |

## 4. Code de remise : BLOQUÉ, sauf T9 (journal)

| Attaque | Résultat |
|---|---|
| Code dans la réponse de la route de la partenaire (étape « prête ») ou du client (nouveau code) | BLOQUÉE (G7 ; `deliverHandoverCode` retire le code dans un `finally`, `lib/orders/booking.ts:139-163`) |
| Code en clair dans la boîte d'envoi, le journal d'audit, le journal des envois | BLOQUÉE (G7) |
| Code dans la cloche, le push, l'email, même glissé dans les données | BLOQUÉE (S3) |
| Clé `private.order_code_key`, `order_code_hash`, `order_issue_code` par la REST (partenaire, livreur, tiers) | BLOQUÉE (G5) : schéma non exposé, fonctions refusées |
| Deviner les 10 000 codes : 5 essais, 3 nouveaux codes, soit 20 essais au plus par commande (0,2 %) | BLOQUÉE ; par la clé de service seulement : T7 (`order_code_hash` sert d'oracle) |
| Chaque envoi journalisé | **TROU T9** |

## 5. Accès : BLOQUÉ, sauf T1, T5, T6, T8

| Attaque | Résultat |
|---|---|
| Partenaire, livreur, tiers : lecture REST de `orders`, `order_items`, `order_state_history` ; insertion d'une ligne ; `order_view`, `order_partner_action` par RPC | BLOQUÉE (G5) |
| Produit (`is_regulated`, prix) et portions modifiés par la REST | BLOQUÉE (G5) |
| Livreur invité qui n'a pas accepté : commande confiée, liste | BLOQUÉE (G6) : 404 `COURIER_NOT_FOUND`, liste vide |
| Anciennes politiques `orders_insert`, `orders_update`, `order_items_insert`, `products_manage`, branche partenaire de `orders_read` | BLOQUÉE : toutes retirées (`0003_rls.sql:240-266` ; retraits `20261105000006:143`, `20261110000001:43-46`, `20261130000003:380-395`) |
| Commande jamais payée vue par la partenaire | **TROU T1** (routes des commandes), **T5** (tableau de bord, métriques) |
| Nouveau code service fermé | **TROU T6** |
| Produit non publié d'une autre partenaire | **TROU T8** |

## 6. Données : BLOQUÉ, sauf T1, T4

| Attaque | Résultat |
|---|---|
| Adresse, téléphone ou nom du client dans un avis à la partenaire ou au livreur | BLOQUÉE (lecture `order_notif_data`, `20261130000004:63-92` : ni adresse, ni téléphone, ni nom) |
| Masquage 7 jours après la remise | BLOQUÉE (lecture `20261130000006:985-993` ; test du lot) |
| Coordonnées d'une commande jamais payée | **TROU T1** |
| Prénom d'un compte à partir de son numéro | **TROU T4** |

## 7. Produits réglementés : BLOQUÉ au devis, à la création, à la ligne et à la première part ; T2 ailleurs

Devis et création (`20261130000004:284-287`), insertion d'une ligne (`trg_b_order_items_regulated_guard`), première part
(`order_payable_refusal`, création et confirmation) : BLOQUÉE (lecture ; tests du lot). Solde (création, confirmation)
et commande payable à la remise : **TROU T2**.

## 8. Avis : BLOQUÉ, sauf T9

| Contrôle | Résultat |
|---|---|
| SMS au pire cas : nom d'établissement de 120 caractères (ç, ’, « », émoji, autre écriture), zone et table longues, montants de 999 999 999 F, 2 970 articles, chaque mode, origine et paiement (1 080 rendus) + 3 textes du code | BLOQUÉE (S2) : tous en GSM-7, un segment ; le plus long fait 145 septets (mesure locale) |
| Canaux : 17 types en file, le SMS de « prête à retirer » et « en route » remplacé par l'envoi immédiat du code | conforme (lecture `20261130000007:31-48`, catalogue) |
| Nuit : SEND partout, sauf « remise par le livreur » (partenaire) et « invitation » (DEFER) | cohérent entre la base et le catalogue (voir aussi « points écartés ») |

## 9. Recopies : aucune ligne perdue

S1 (vert, run 553) : pour chacune des 9 fonctions, toute ligne de la dernière définition de main est dans la recopie du
lot, sauf 8 lignes **élargies** (liste allongée d'ORDER ou des réglages `orders.*`), déclarées une à une avec leur
remplaçante. main n'a aucune migration absente de la branche (`git diff --name-only origin/lot12a/commandes-argent
origin/main -- supabase/migrations` : seules les 8 migrations du lot). Comparaison brute (script local, mêmes règles) :

```
== finance_setting_set: main 50 lignes, lot 53 ; perdues/changées 1 ; ajoutées 4
   -  'halls.max_pending_per_client') THEN
   +  'halls.max_pending_per_client',
   +  'orders.service_fee_rate', 'orders.commission_rate', 'orders.deposit_default_percent', 'orders.hold_minutes',
   +  'orders.response_minutes', 'orders.max_unpaid_per_client', 'orders.pickup_grace_hours', 'orders.pickup_warning_hours',
   +  'orders.contact_retention_days', 'orders.code_max_attempts', 'orders.code_resend_max', 'orders.prep_minutes_default') THEN
== fin_setting_valid: main 87 lignes, lot 99 ; perdues/changées 0 ; ajoutées 12
== platform_settings_defaults: main 17 lignes, lot 17 ; perdues/changées 1 ; ajoutées 1
   -  WHERE s.key ~ '^(finance|access|notif|features|support|halls|tables)\.'
   +  WHERE s.key ~ '^(finance|access|notif|features|support|halls|tables|orders)\.'
== fin_payout_available_at: main 31 lignes, lot 33 ; perdues/changées 1 ; ajoutées 3
   -  table_reservation_id
   +  table_reservation_id, order_id
== calculate_referral_commissions: main 93 lignes, lot 97 ; perdues/changées 0 ; ajoutées 4
== finance_admin_earned: main 84 lignes, lot 84 ; perdues/changées 1 ; ajoutées 1
   -  COALESCE(sum(CASE WHEN p.payment_target::text IN ('HALL_RESERVATION', 'TABLE_RESERVATION')
   +  COALESCE(sum(CASE WHEN p.payment_target::text IN ('HALL_RESERVATION', 'TABLE_RESERVATION', 'ORDER')
== finance_admin_payments: main 77 lignes, lot 77 ; perdues/changées 2 ; ajoutées 2
== notif_cashouts_notify: main 288 lignes, lot 300 ; perdues/changées 0 ; ajoutées 12
== notification_sync_log: main 64 lignes, lot 65 ; perdues/changées 0 ; ajoutées 1
```

À la fusion : le lot 11b redéfinit aussi `notif_cashouts_notify` (`20261129000004_l11b_avis.sql`, branche
`lot11b/tables-ecrans`) ; la recopie de l'un des deux lots devra reprendre l'autre.

## 10. Failles F1 à F8 de l'ancien code

| Faille | Constat |
|---|---|
| F1 statut écrit par la partenaire | fermée : actions seulement par `order_partner_action` (action inconnue 400) ; aucune écriture REST (G5) ; garde en base |
| F2 lecture REST par la partenaire | fermée (G5) ; aucune ancienne politique ne la rouvre (§ 5) |
| F3 quantité négative | fermée (G4) ; voisin : T3 (somme par produit) |
| F4 produit d'une autre partenaire | fermée (G4), y compris un autre établissement de la même partenaire ; voisin : T8 (lecture d'un produit d'autrui par l'ancienne route) |
| F5 commandes non payées listées, avec nom et téléphone | fermée pour les commandes **en attente** de paiement ; **rouverte** pour les commandes jamais payées **closes** (T1) et par le tableau de bord et les métriques (T5) |
| F6 confirmation générique, échec qui annule | fermée (§ 1) |
| F7 montant lu sur la commande écrite par la route | fermée : montant relu sur la commande figée en base (G3) |
| F8 réglementés, stock, plafond, expiration | fermée pour la première part (G1, G2) ; voisins : T2, T3 |

Ancien code encore présent qui lit les commandes avec le rôle de service : `GET /api/orders` (le client, ses commandes
seulement : conforme), `GET /api/admin/services` (administration : conforme), tableau de bord et métriques de la
partenaire (T5), `hooks/usePartnerOrders.ts` (REST, ne lit plus rien : écran à refaire au 12b, comme le dit le lot).

## Détail des trous

### T1 — Commande jamais payée : listée et lisible par la partenaire, adresse et téléphone compris (moyenne)

Attaque : un client passe une commande en livraison (adresse, téléphone), puis l'annule avant de payer ; une seconde
échoue sans paiement. La partenaire lit `GET /api/partner/orders?filter=closed` et `GET /api/partner/orders/[id]`.

Sortie brute (run 553) :

```
not ok 1 - T1 — commande jamais payée (annulée avant paiement, puis échue) : ni listée ni lisible par la partenaire, ni son adresse ni son téléphone
  commandes jamais payées vues par la partenaire : liste closed : {"id":"0035bd59-9da4-4db2-ad67-89a0ed698c6c","state":"EXPIREE","contact":{"phone":"+221773106743","address":"Villa 7, cité Keur Gorgui"}} | liste closed : {"id":"7799b5bc-50cf-4a6a-a11e-f18cc142b213","state":"ANNULEE_CLIENT","contact":{"phone":"+221773106743","address":"Villa 7, cité Keur Gorgui"}} | GET /api/partner/orders/7799b5bc-50cf-4a6a-a11e-f18cc142b213 : HTTP 200 {"state":"ANNULEE_CLIENT","contact":{"phone":"+221773106743","address":"Villa 7, cité Keur Gorgui"}} | GET /api/partner/orders/0035bd59-9da4-4db2-ad67-89a0ed698c6c : HTTP 200 {"state":"EXPIREE","contact":{"phone":"+221773106743","address":"Villa 7, cité Keur Gorgui"}}
```

En cause : `order_view` n'écarte que l'état `EN_ATTENTE_PAIEMENT` (`20261130000006_l12a_etapes.sql:815`), de même
`order_partner_list` (`:882`) et `order_partner_action` (`:479`). Une commande close sans avoir été transmise
(`EXPIREE`, `ANNULEE_CLIENT` / `ANNULEE_EV` depuis l'attente) garde ses coordonnées 7 jours.

Correctif proposé : la partenaire ne voit une commande que si elle lui a été transmise : `o.received_at IS NOT NULL`
(posé au paiement de la première part ou à la création d'une commande payable à la remise) dans `order_view`
(« PARTNER »), `order_partner_list` et `order_partner_action`, à la place du test sur l'état ; masquer aussi tout de
suite les coordonnées d'une commande close sans transmission (`order_expire_hold`, `order_close_apply`).

### T2 — Solde et commande payable à la remise sans le contrôle d'une commande payable (moyenne)

Attaques : (a) acompte payé, commande acceptée, produit marqué réglementé par l'administration, puis le client lance le
solde ; (b) même chose, fiche de la partenaire suspendue ; (c) solde lancé, produit marqué réglementé, puis paiement
confirmé ; (d) commande payable à la remise, produit marqué réglementé, la partenaire l'accepte, la sert et la remet.

Sortie brute (runs 553 et 554) :

```
not ok 2 - T2a — solde en ligne refusé quand un produit de la commande est devenu réglementé (décision de l’administration après l’acompte)
  solde d'une commande au produit réglementé ouvert au paiement en ligne : HTTP 201 {"amount":7350,"facial":7000,"status":"PENDING"}
not ok 3 - T2b — solde en ligne refusé quand la fiche de la partenaire est suspendue (comme la première part)
  solde payé en ligne à une partenaire suspendue : HTTP 201 {"amount":5880,"status":"PENDING"}
not ok 4 - T2c — solde confirmé après que le produit est devenu réglementé : remboursé, jamais compté (comme la première part)
  solde d'un produit devenu réglementé encaissé : paid_goods 3600 → 12000 sur 12000, paiement SUCCESS, payment_status SUCCESS
not ok 5 - T2d — commande payable à la remise dont un produit devient réglementé : la partenaire ne peut plus l’accepter ni la remettre
  produit réglementé accepté puis remis par la plateforme : ACCEPTER 200 ACCEPTEE → PRETE 200 PRETE → REMETTRE 200 REMISE ; état final REMISE, noté sur place 7000
```

En cause : `order_payment_create`, branche SOLDE (`20261130000005_l12a_paiement.sql:158-169`) et `order_payment_confirm`,
branche SOLDE (`:270-278`) n'appellent jamais `order_payable_refusal` (appelée pour la première part seulement,
`:151-154` et `:268`) ; `order_partner_action` ACCEPTER ne regarde que l'établissement (`20261130000006:510-514`), et la
remise rien. Le rapport du lot annonce le refus « au paiement si l'administration les a marqués entre-temps » ; la
décision du client est « jamais commandé, payé ni livré en ligne ».

Correctif proposé : appeler `order_payable_refusal` dans les deux branches SOLDE (création : refus ; confirmation :
remboursement en entier, comme pour la première part) ; à ACCEPTER et à REMETTRE, refuser une commande dont un produit
est réglementé (`product_regulated`) : clôture `REFUSEE` par le système, tout rendu, sans faute de la partenaire, avis
au client.

### T3 — Même produit sur plusieurs lignes (faible)

Sortie brute (run 553) :

```
not ok 5 - T3 — même produit sur plusieurs lignes : plus de 99 unités refusées (pas 297 portions du plat du jour tenues sans payer)
  3 lignes × 99 du même plat acceptées : 297/300 portions tenues par une commande non payée (HTTP 201, état EN_ATTENTE_PAIEMENT)
```

En cause : la borne 1 à 99 est vérifiée par ligne (`20261130000004_l12a_devis_commande.sql:276`), 30 lignes par
commande (`:265`), le même produit pouvant revenir sur chacune ; le stock et les portions sont ensuite pris sur la
somme (`:326-343`). Un compte vérifié tient ainsi 2 970 unités par commande, 3 commandes à la fois, renouvelables toutes
les 15 minutes. Même borné à 99 par produit, 3 × 99 = 297 portions restent tenues sans payer : le plafond par client ne
protège pas un plat du jour à quelques dizaines de portions (à trancher, voir plus bas).

Correctif proposé : borner la somme des quantités par produit (99) dans `order_quote_compute`, ou refuser un même
produit avec les mêmes suppléments sur deux lignes ; décider d'un plafond de portions tenues par client.

### T4 — Prénom de n'importe quel compte rendu à la partenaire (faible)

Sortie brute (run 553) :

```
not ok 6 - T4 — invitation d’un livreur : le prénom d’un compte quelconque n’est pas rendu à la partenaire à partir de son seul numéro
  prénom du titulaire du numéro rendu à la partenaire avant tout accord : HTTP 201 {"success":true,"invitation":{"id":"f857a706-7136-4e1d-a58f-a3da112da936","firstName":"Ndeye-Sokhna","statusLabel":"Invitation envoyée"}}
```

En cause : `order_courier_invite` rend `first_name` (`20261130000006_l12a_etapes.sql:701`), relayé par
`app/api/partner/couriers/route.ts:69` ; la liste (`:31-37`) montre aussi le prénom des invités qui n'ont pas accepté
ou ont refusé. Une partenaire déroule des numéros et obtient, pour chacun, l'existence d'un compte actif (404 / 201) et
le prénom ; chaque essai envoie une invitation (aucune limite).

Correctif proposé : ne rendre le prénom qu'une fois l'invitation acceptée (réponse d'invitation sans prénom ; liste :
prénom des seuls livreurs ACTIVE ou retirés après accord) ; limiter les invitations par partenaire et par jour.

### T5 — Commandes jamais payées au tableau de bord et aux métriques de la partenaire (faible)

Sortie brute (run 553) :

```
not ok 7 - T5 — tableau de bord et métriques de la partenaire : aucune commande jamais payée
  commande jamais payée montrée à la partenaire : GET /api/partner/metrics recentOrders : [{"id":"f704c0f4-2414-4136-b054-1b2853e6df67","order_number":"CMD-261121-79DE05","total_amount":3150,"order_status":"EN_ATTENTE","delivery_mode":"RETRAIT","created_at":"2026-11-21T11:01:49.575589+00:00"}] | GET /api/partner/dashboard : commande non payée dans recentOrders
```

En cause : lecture directe par le rôle de service, sans condition d'état : `app/api/partner/metrics/route.ts:51-56`,
`lib/partner/partner-dashboard.service.ts:608-616` (les comptes de commandes incluent aussi les non payées).

Correctif proposé : même règle que T1 (`received_at` non vide ; ou passer par `order_partner_list`) pour la liste et les
comptes.

### T6 — Nouveau code envoyé service fermé (faible)

Sortie brute (run 553) :

```
not ok 8 - T6 — service des commandes fermé : POST /api/orders/[id]/code répond 404, aucun SMS
  service fermé, nouveau code envoyé quand même : HTTP 200 {"success":true,"message":"Un nouveau code vous est envoyé par SMS. L’ancien ne marche plus.","resendsLeft":2} ; SMS de la commande 1 → 2
```

En cause : `app/api/orders/[id]/code/route.ts:16` (session seulement, pas de `guardFeature`) ; `order_code_resend` ne
lit pas `features.orders_enabled`. La route n'est dans aucune des deux listes de `tests/parcours/interrupteurs.test.ts`
(contrairement à la lecture et à l'annulation, sorties de l'interrupteur à dessein). Service fermé, la partenaire ne
peut de toute façon pas remettre : le SMS ne sert à rien.

Correctif proposé : `guardFeature('orders', …)` après la session, et la route ajoutée à la liste des routes gardées du
test des interrupteurs.

### T7 — Aides internes exécutables par la clé de service (faible)

Sortie brute (run 553) :

```
not ok 9 - T7 — aides internes des commandes non appelables en RPC par la clé de service (contrôle du catalogue)
  exécutables par service_role, donc appelables par POST /rest/v1/rpc/… avec la clé de service, sans contrôle d'acteur ni d'état : order_close_apply(uuid,text,text,uuid,text,text,numeric,boolean), order_code_delivery(uuid,text,text), order_code_hash(uuid,text), order_handover_apply(uuid,uuid,text,text,boolean), order_issue_code(uuid), order_log_state(uuid,text,text,uuid,text,text), order_refund_payment(uuid,numeric,text), order_release_stock(uuid), order_set_en_route(uuid,uuid,text,integer)
```

En cause : `GRANT EXECUTE … TO service_role` (`20261130000003:412`, `20261130000004:624-625`,
`20261130000006:1005-1006`, `:1019-1023`). Exemples : `order_issue_code` rend un code en clair et remet les essais à 0 ;
`order_close_apply` clôt une commande payée en « non retirée » à 0 % ; `order_handover_apply` remet sans contrôle de
l'auteur ; `order_code_hash` sert d'oracle pour les 10 000 codes. Contrôle du catalogue seulement : aucune attaque avec
la clé de service (consigne). La règle 1A.3 de `03-verification.sql` exige l'exécution par service_role des fonctions
**du schéma public**, d'où ces droits.

Correctif proposé : déplacer ces aides dans le schéma `private` (non exposé par l'API, hors du champ de la règle 1A.3,
`search_path` fixé), appelées seulement par les fonctions publiques ; ou les retirer à service_role et les inscrire dans
une liste d'aides internes de la règle 1A.3.

### T8 — Produit non publié d'une autre partenaire lu (faible)

Sortie brute (run 554) :

```
not ok 10 - T8 — GET /api/partner/products/[id] : le produit non publié d’une autre partenaire n’est pas lisible
  produit non publié d'une autre partenaire lu : HTTP 200 {"id":"696efa61-2198-4d93-a5fc-66bfae52060e","partner_id":"d7288fab-d3aa-44df-8021-faacacd91742","name":"Plat en préparation (non publié)","status":"INDISPONIBLE","stock_quantity":42,"price":9900}
```

En cause : `ProductService.getProductById` sans condition de partenaire (`lib/products/product.service.ts:182`),
appelée par `app/api/partner/products/[id]/route.ts:20` ; route de l'ancien code gardée par le lot (rapport § 2), dans le
même module que F4. Les produits `DISPONIBLE` sont publics par la politique `products_read` ; ceux qui ne le sont pas
(brouillon, suspendu), leur stock et la décision de l'administration ne devraient pas l'être.

Correctif proposé : `getProductById(productId, partnerId)` avec `.eq('partner_id', partnerId)` (404 sinon).

### T9 — Nouveaux codes envoyés sans journal (faible)

Sortie brute (run 553, G7, puis run 554, T9) :

```
envois du code journalisés : [{"id":"3e1d85f2-a8e1-42e9-85d2-e8a3c26ad66b","idempotency_key":"ORDER_HANDOVER_CODE:3b756b77-812d-4da1-a5c6-775c033b69dc:SMS", … "template_data":{"purpose":"ORDER_HANDOVER"},"status":"SENT", …}]   (4 SMS de code envoyés, 1 ligne)
not ok 11 - T9 — chaque SMS de code de remise est journalisé (code de retrait, puis nouveau code demandé par le client)
  2 SMS de code envoyés, 1 ligne(s) au journal : [{"idempotency_key":"ORDER_HANDOVER_CODE:cab0caec-e7e6-4fe1-a673-619e411eb7fb:SMS","status":"SENT","created_at":"2026-11-21T11:08:14.658714+00:00"}]
```

En cause : `deliverHandoverCode` journalise avec `ref: String(r.order_id)` (`lib/orders/booking.ts:156`) ;
`notification_sync_log` prend pour clé `ORDER_HANDOVER_CODE:<ref>:SMS` avec `ON CONFLICT DO NOTHING`
(`20261130000007_l12a_avis.sql`, fonction `notification_sync_log`) : le code de retrait (ou « en route ») est journalisé,
chaque nouveau code ensuite part sans trace (le contrat E7 veut un journal par envoi immédiat). Le code, lui, n'est
jamais stocké (G7 vert).

Correctif proposé : une référence par envoi, par exemple `<commande>:<étape>:<code_resends>`.

## Garde-fous verts (runs 553 et 554)

```
ok 1 - G1 — plafond de 3 non payées sous concurrence : 6 créations simultanées sur 2 établissements, 3 acceptées
ok 2 - G2 — dernière portion : deux clients en même temps, une seule commande ; rendue une seule fois à l’expiration
ok 3 - G3 — paiement arrivé après l’annulation par le client, webhook rejoué : remboursé en entier une seule fois, jamais compté
ok 4 - G4 — quantités mal formées, produit d’un autre établissement ou d’une autre partenaire, supplément d’un autre produit : refusés
ok 5 - G5 — REST : partenaire, livreur et tiers ne lisent ni n’écrivent les commandes ; clé et fonctions du code inaccessibles
ok 6 - G6 — livreur invité qui n’a pas accepté : aucune commande confiée, rien de visible
ok 1 - S1 — les 9 recopies gardent chaque ligne de leur dernière définition de main (lignes élargies déclarées)
ok 2 - S2 — SMS des commandes : un segment GSM-7 au pire cas (nom de 120 caractères, montants de 999 999 999 F, 2 970 articles)
ok 3 - S3 — cloche, push et email des avis ORDER_* : jamais un code de remise, même glissé dans les données
[INVARIANT-FIN] cv12a-2-gardes — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] cv12a-2-gardes — (g)(h)(i) : 0 violation(s)
[INVARIANT-NOTIF] cv12a-2-gardes — (m)(n)(o) : 0 violation(s)
[INVARIANT-LOT12A] cv12a-2-gardes — (o1)(o2)(o3)(o4)(o5)(o6)(o7) : 0 violation(s)   (run 554)
```

G7 (code de remise : 5 essais, blocage même avec le bon code, 3 nouveaux codes, ancien code refusé, remise avec le
dernier, rien en clair dans les réponses, la boîte d'envoi ni le journal) : toutes ses vérifications de sécurité vertes
au run 553 ; seule sa dernière ligne (nombre de journaux) a échoué, sortie en T9. Au run 554 (vérification du journal ramenée à « au moins une ligne », le compte étant T9) : `ok 7 - G7 — code de remise : absent des réponses, de la boîte d’envoi et du journal ; 5 essais puis blocage ; 3 nouveaux codes au plus`.

## Points écartés après vérification

- **Code renvoyé à la partenaire** : la fonction en base rend le code à la route de l'étape « prête », mais la route le
  retire avant de répondre (`finally`) ; aucune autre route ne le relaie (G7).
- **Autre chemin de confirmation d'un paiement de commande** (générique, réconciliation, annulation, sondage) : tous
  passent par `order_payment_confirm` ; le chemin générique refuse ORDER (création et confirmation).
- **Fuite du code par le journal ou la garde des SMS** : `sendOrderCode` journalise sans le texte ; la garde ne stocke
  jamais le message (`lib/sms/mtarget.service.ts:75,156-175`).
- **Interrupteurs mis en cache** : lus à chaque appel (`lib/features/flags.ts:9`) ; T6 n'est pas un effet de cache.
- **Client lisant `code_hash` de sa propre commande par la REST** : empreinte HMAC avec une clé illisible ; sans effet.
- **Administration lisant adresse et téléphone par la REST** (`orders_read` : `is_admin()`) : règle d'avant le lot,
  limitée aux administrateurs ; `order_view` les cache à l'administration. Noté, non compté.
- **Rappel de retrait envoyé la nuit** (SEND) : un report (DEFER) le ferait souvent arriver après la clôture ; cohérent
  avec le délai de 24 h. À revoir seulement si le client veut éviter tout SMS de nuit (rappel avancé hors nuit).
- **Commande restée ouverte** (livraison ratée, préparation jamais finie) : coordonnées jamais masquées et commande
  jamais close ; décision 4 du lot (question posée au client, rien d'automatique). Noté.
- **Tâche `order_tick` en une seule transaction** : une erreur sur une commande arrête tout le passage ; aucune entrée
  trouvée qui la provoque. Remarque de robustesse, non comptée.

## À trancher (hors trous)

1. Portions tenues sans payer : 3 commandes de 15 minutes renouvelables suffisent à tenir un plat du jour de quelques
   dizaines de portions, même après T3. Plafond de portions par client, ou prise des portions au paiement seulement ?
2. Invitation d'un livreur : faut-il que la partenaire connaisse le prénom avant l'accord (confort) ? Le correctif T4
   propose « après l'accord ».

## Fichiers

- `tests/audit/cv12a-1-trous.test.ts`, `cv12a-2-gardes.test.ts`, `cv12a-3-statique.test.ts` (branche `lot12a/cv-rouges`).
- Ce rapport. Le worktree partiel a été retiré à la fin (jonction `node_modules` retirée seule, celle du lot intacte).
