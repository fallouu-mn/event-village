# Lot 12d — Commandes : espace du livreur, administration des commandes et finitions

Branche `lot12d/livreur-admin` (worktree `event-village-lot12d`), partie de `main` à `f7bf7ad94` (lots 12a, 12b et 12c
fusionnés). **Non fusionnée. Aucune migration appliquée** (ni sur event-village-dev, ni ailleurs). Le service reste fermé
par `features.orders_enabled` ; les tests l'ouvrent le temps de leur passage.

État : **run complet 807 vert** (commit `ae42468b5`, 56 min 36 s) : 648 suites sur 648, e2e 783 tests (fumée,
captures), responsive 253 tests dont le spec du lot (0 défaut bloquant), budgets JS OK, mesure mobile valide à la
première tentative. Runs du lot : rapides 789, 793, 797, 801, 803 ; complets 805 (rouge, 3 points corrigés, voir
§ Tests et accès) et 807 (vert). Résultats : `ci-results/runs/807-46113663294/`.

---

## À lire en premier

### 1. Migrations (6, intervalle `20261228…`, sans BEGIN ni COMMIT, rejouables)

| Fichier | Contenu |
|---|---|
| `20261228000001_l12d_schema.sql` | `orders` : appels du livreur (`delivery_calls`, `last_call_at`) et absence du client (`absent_reported_at`, `absent_wait_until`, `absent_escalated_at`, `absent_decision`, `absent_decided_at`, `absent_decided_by`) ; table `order_issues` (signalements, un seul ouvert par commande : index unique partiel ; REST fermée) ; table `order_closure_keeps` (« Garder » une commande pendant une fermeture ; REST fermée) ; `venues` : pause (`orders_paused_until`, `orders_paused_by`, `orders_pause_end_notified`) ; `products` : `allergens` (liste fermée de 14) et `spice_level` (0 à 3), non lisibles par la REST (droits par colonne du 12c) |
| `20261228000002_l12d_livreur.sql` | recopie de `order_view` ; `order_courier_day` ; `order_courier_invitation_view` ; avis A6/A7 par déclencheur sur `partner_couriers` (`private.order_courier_status_notify`, `private.order_person_short`) |
| `20261228000003_l12d_absence_signalement.sql` | `private.order_admin_allowed` / `order_admin_role` (droits par `admin_can`, règle 1B.8) ; `order_delivery_step` (APPEL, ABSENT) ; `order_watch_tick` ; `order_absence_decide` ; recopie de `private.order_close_apply` ; `order_issue_report` ; `order_issue_close` |
| `20261228000004_l12d_administration.sql` | `order_admin_list` (filtres et pagination en base) ; `order_admin_view` (fiche complète) |
| `20261228000005_l12d_fermetures_pause.sql` | recopie de `order_payable_refusal` ; `private.order_closure_hits`, `order_closure_orders`, `order_closure_keep`, déclencheur d'avis sur `venue_closures` ; `order_venue_pause`, `order_partner_pauses` ; `private.order_pause_refusal`, recopies de `order_quote` et `order_create_checked` ; recopie de `order_venue_menu` ; `order_product_details_set` |
| `20261228000006_l12d_avis.sql` | 13 types d'avis (registre `notification_types`) |

Fonctions publiques au seul rôle de service ; aides du schéma `private` à aucun rôle (clé de service comprise) : contrôlé
en base par `tests/schema/migration-lot12d-rejouable.test.ts` et sans base par `tests/parcours/l12d-statique.test.ts` (S3).
**Si le lot « avis » phase 2 (`20261230…`) fusionne avant celui-ci**, renommer ces six migrations au-dessus des siennes
avant la fusion (le test statique et le test « rejouable » repèrent les fichiers par `_l12d_`, sans dépendre des numéros).

### 2. Recopies (6), chacune UNE seule fois, depuis sa dernière définition

| Fonction | Dernière définition recopiée | Changement (lignes ajoutées ; lignes remplacées déclarées) |
|---|---|---|
| `public.order_view` | `20261130000006_l12a_etapes.sql:843-920` | téléphone du client pour le livreur seulement en route (1 ligne remplacée par 2) ; adresse de l'établissement (1 ligne remplacée) ; absence, appels, « Client absent » possible, signalement, « Signaler un problème » possible (ajouts) |
| `private.order_close_apply` | `20261130000006_l12a_etapes.sql:121-206` | avis propres d'une décision sur une absence (`p_notice = 'ABSENT'`) : ajouts seuls |
| `public.order_payable_refusal` | `20261130000005_l12a_paiement.sql:27-55` | paiement refusé (`VENUE_CLOSED`) quand l'heure de la commande, préparation comprise, tombe dans une fermeture : ajouts seuls |
| `public.order_quote` | `20261130000004_l12a_devis_commande.sql:461-476` | devis refusé pendant la pause (`ORDERS_PAUSED`, par `private.order_pause_refusal`) : ajouts seuls |
| `public.order_create_checked` | `20261226000003_l12b_garde_prix.sql:52-104` | création refusée pendant la pause, avant tout verrou ni écriture : ajouts seuls |
| `public.order_venue_menu` | `20261226000002_l12b_carte_des_plats.sql:44-192` | fin de la pause en cours ; allergènes et piment de chaque plat : ajouts seuls |

Preuve « aucune ligne perdue » : `tests/parcours/l12d-statique.test.ts` S1 (sortie locale du 28/11 : `order_view : 69
lignes d'origine, 0 perdue(s) ; order_close_apply : 71, 0 ; order_payable_refusal : 21, 0 ; order_quote : 8, 0 ;
order_create_checked : 43, 0 ; order_venue_menu : 118, 0`). Les recopies sont produites par un script qui insère les lignes
nouvelles dans le texte exact de la source (aucune ressaisie).

**Pourquoi la pause n'est pas dans `order_quote_compute`** : la première version (run 789) la recopiait ;
`tests/audit/cv12c-3-statique.test.ts` (S1, audit : assertion intouchable) prend comme « définition précédente » la
dernière définition **hors du lot 12c**, donc toute recopie postérieure d'`order_quote_compute` le fait échouer. La pause
est donc refusée dans les deux enveloppes appelées par les routes (`order_quote` pour le devis, `order_create_checked`
pour la création) ; `order_create` n'est appelée par aucune route (seulement par `order_create_checked`). Constat pour la
suite : ce contrôle d'audit empêchera tout lot futur de recopier `order_quote_compute`, `product_regulated`,
`products_order_guard` ou `order_product_regulation_decide` (à signaler aux auteurs de l'audit du 12c).

**Fonctions volontairement NON recopiées** (S2) : `order_courier_action` et `order_courier_remove` (réservées au 12d par le
lot avis, mais inutile de les toucher : « Appeler » et « Client absent » passent par la fonction nouvelle
`order_delivery_step`, les avis A6/A7 par un déclencheur), `order_courier_respond`, `order_product_save` (allergènes par
`order_product_details_set`), `order_cancel`, `order_partner_action`, `order_tick` (la tâche appelle en plus
`order_watch_tick`), `order_quote_compute` et `order_create` (voir ci-dessus), `finance_setting_set`,
`notification_outbox_claim` (recopiée par le lot avis). Le délai d'attente du
client absent (30 minutes) est une constante de `order_delivery_step` (décision du client), pas un réglage : un réglage
demandait de recopier `finance_setting_set`, déjà recopiée par le 12a (S1 de `tests/audit/cv12a-3-statique.test.ts`).

### 3. Failles de sécurité

**Aucune faille de sécurité trouvée** dans l'existant touché par le lot. Contrôlé (tests de `tests/parcours/l12d-livreur-admin.test.ts`) :
livreur d'une autre partenaire ou retiré (ni lecture, ni appel, ni absence, ni remise), adresse et téléphone après la fin,
code jamais visible du livreur ni de l'administration, invitation lisible par l'invité seul, signalement d'autrui,
liste et fiche de l'administration sans droit (`FORBIDDEN`), données personnelles sans `users.read`, colonnes nouvelles
fermées à la REST, fonctions fermées à anon et authenticated.

Deux constats corrigés (argent et vie privée, pas des failles d'accès) :
1. **Paiement possible d'une commande dont l'heure tombe dans une fermeture exceptionnelle posée après sa création**
   (constat « T2 bis » de la contre-vérification du 12b, non corrigé jusqu'ici) : `order_payable_refusal` refuse désormais
   (`VENUE_CLOSED`), à la création du paiement comme à sa confirmation. Preuve : test G (paiement 409 `VENUE_CLOSED`, aucun
   paiement créé).
2. **Téléphone du client lu par le livreur dès que la commande lui était confiée** (avant son départ) : servi seulement en
   route (décision du client : « téléphone du client seulement pendant la livraison »). Preuve : test A1.

### 4. Tests existants modifiés

| Fichier | Avant | Après | Raison |
|---|---|---|---|
| `tests/schema/f3b-ecrans.test.ts` | `[['payments.read'], ['/admin/finance']],` et `[['refunds.manage'], ['/admin/finance']],` ; liste du SUPERADMIN `… '/admin/products', '/admin/finance', …` | `[['payments.read'], ['/admin/orders', '/admin/finance']],` et `[['refunds.manage'], ['/admin/orders', '/admin/finance']],` ; `… '/admin/products', '/admin/orders', '/admin/finance', …` | entrée « Commandes » du menu de l'administration (droit `payments.read` ou `refunds.manage`) |
| `tests/parcours/notif-modeles.test.ts` | tables G2 et G3 sans les types du lot | G2 : 13 lignes ajoutées (types du lot, canaux, public, compte suspendu, lien, titre) ; G3 : textes exacts des SMS du lot ajoutés | chaque type du catalogue doit figurer dans G2, chaque SMS dans G3 (ajouts seuls) |
| `tests/parcours/notif-outbox.test.ts` | registre sans les types du lot | 13 lignes ajoutées | registre SQL = contrat (ajouts seuls) |
| `tests/parcours/email-regle-envoi.test.ts` | `G49_EXCLUDED` : 5 types | + 9 petites étapes (`ORDER_COURIER_ANSWERED`, `ORDER_COURIER_REMOVED`, `ORDER_COURIER_RETURN`, `ORDER_CLIENT_ABSENT_PRO`, `ORDER_ABSENCE_DECIDED_PRO`, `ORDER_ISSUE_PRO`, `ORDER_ISSUE_CLOSED`, `ORDER_CLOSURE_ORDERS`, `ORDER_PAUSE_ENDED`) | règle G.49 (tout avis indispensable aussi par email) contre la décision du client : « cloche et notification pour les petites étapes » ; même mécanisme que le 12c (`PRODUCT_DECISION_SMS`, `ADMIN_ORDER_REFUND_BLOCKED`) |
| `tests/helpers/design-files.ts`, `e2e/support/responsive-pages.ts` | — | écrans du lot ajoutés (ajouts seuls) | contrôle du design et du responsive des écrans nouveaux |
| `docs/recette-billetterie.md` (lu par `recette-matrice`) | `email-regle-envoi.test.ts:121`, `:315`, `:536` ; `notif-modeles.test.ts:593` | `:125`, `:319`, `:540` ; `:607` | numéros de ligne décalés par les ajouts ci-dessus (aucune assertion changée) |

`tests/audit/` et `tests/audit-auth/` : aucune assertion changée.

### 5. Fichiers partagés touchés

| Fichier | Changement |
|---|---|
| `components/layout/AppLayout.tsx` (coquille des six routes budgétées) | entrée « Mes livraisons » pour un livreur actif, lue dans le profil déjà chargé (`profile.courier_active`), icône déjà importée (`ShoppingBag`), aucun module ni appel ajouté ; masquée service fermé |
| `components/providers/AuthProvider.tsx` | type `UserProfile.courier_active` (aucun code exécuté de plus) |
| `app/api/auth/me/route.ts` | `profile.courier_active: true` pour un livreur ACTIF d'une partenaire VALIDE (champ absent sinon) |
| `lib/orders/booking.ts` | « Client absent » pour une livraison close « non retirée » ; statuts HTTP des refus nouveaux ; champs `refund_amount`, `calls`, `paused_until` passés dans un refus |
| `lib/notifications/catalog.ts`, `catalog-types.ts`, `outbox-labels.ts` | 13 avis ajoutés (ajouts seuls, aucune ligne existante changée) |
| `lib/orders/menu.server.ts`, `lib/orders/menu-types.ts` | carte servie : `pausedUntil`, `allergens`, `spiceLevel` |
| `lib/products/catalog.service.ts` | lecture du catalogue de la partenaire : `allergens`, `spiceLevel` (les lectures faisaient déjà `select('*')`) |
| `components/tables/editor/ClosuresView.tsx` (écran des fermetures du lot 11b) | section « Commandes prévues pendant cette fermeture » ; `?fermeture=` met la fermeture en vue |
| `components/orders/partner/**` (12c), `components/orders/client/**` (12b) | pause, appel et absence, signalement, allergènes (voir § Écrans) |
| `components/layout/admin-nav.ts` | « Commandes » (`/admin/orders`) avec `payments.read` ou `refunds.manage` |
| `app/api/courier/orders/route.ts` | journée du livreur (`orders` inchangé, `done` et `invitations` en plus) |
| `app/api/courier/orders/[id]/route.ts`, `app/api/partner/orders/[id]/route.ts` | actions `APPEL` et `ABSENT` |
| `app/api/courier/invitations/[id]/route.ts` | lecture `GET` |
| `app/api/cron/orders/route.ts` | appelle `order_watch_tick` après `order_reminders` |
| `tests/helpers/design-files.ts`, `e2e/support/responsive-pages.ts` | écrans du lot ajoutés |

Aucun écran de la fiche publique ni d'Explorer n'est touché. `app/admin/services/page.tsx` n'est pas touché (page propre
`/admin/orders`).

### 6. Pour la fusion

- **Lot avis phase 2** : conflits textuels attendus (ajouts des deux côtés) dans `lib/notifications/catalog.ts`,
  `catalog-types.ts`, `outbox-labels.ts`, `tests/parcours/notif-modeles.test.ts` ; renommer les migrations du 12d si
  l'avis fusionne d'abord ; aucune fonction recopiée par les deux lots (`order_close_apply` est recopiée ici seulement).
- **Lot stabilité** : aucun fichier commun connu (fiche, Explorer non touchés).
- Migrations à appliquer sur event-village-dev **après** un run de main vert : `20261228000001` à `006`, dans l'ordre ;
  `supabase/hotfix/2026-10-31-lot1a/03-verification.sql` doit rester entièrement OK (non rejoué ici, aucune migration appliquée ; S3 et le test « rejouable » contrôlent les mêmes droits) (aucune fonction ouverte à anon ou
  authenticated, aucune règle de lecture nouvelle).

---

## Écrans livrés

### Livreur (téléphone, dehors, souvent en plein soleil)

- **`/courier/orders` — Mes livraisons** : invitations à répondre en tête, puis les livraisons groupées par état (« En
  route », « Client absent », « Prêtes à partir », « En cuisine »), puis « Terminées aujourd'hui » (sans adresse ni
  téléphone). Carte de livraison : numéro, établissement, zone, heure prévue, adresse ; « À encaisser : X F CFA »
  seulement s'il reste quelque chose à encaisser (montant servi par la base). Relecture toutes les 15 s.
- **`/courier/orders/<id>`** : une action principale à la fois, boutons de 56 px au moins, contraste fort. Frise des
  étapes qui avance (barre en `scaleX` 300 ms, étape franchie qui « pulse », coupées par « réduire les animations »).
  Avant le départ : adresse de l'établissement et « Itinéraire vers l'établissement », « Le numéro du client s'affiche
  quand vous partez », « Je pars » (durée de trajet facultative 10/20/30/45 min). En route : adresse, consignes,
  téléphone, « Appeler le client » (appel compté, puis le téléphone s'ouvre), « Itinéraire » en un geste (application de
  cartes) ; code en 4 grandes cases (clavier numérique, collage accepté) ; case obligatoire « Reste reçu en espèces :
  X F CFA » quand il reste à encaisser ; « Client absent » seulement après deux appels, avec confirmation ; attente avec
  compte à rebours (« Le client peut encore arriver : saisissez son code s'il se présente ») ; puis « L'équipe Event
  Village décide. Rapportez la commande à l'établissement. » (la remise avec le code reste possible). Refus du serveur
  affichés tels quels. Livraison absente, d'un autre livreur ou d'une autre partenaire : « Cet élément n'est plus
  disponible ».
- **`/courier/invitations/<id>`** : nom de l'établissement, ses établissements, « Accepter » / « Refuser » ; état déjà
  répondu.
- **Menu** : « Mes livraisons » dans les espaces métier pour un livreur actif.

### Administration

- **`/admin/orders`** (page propre) : puces « À décider » (client absent à décider ou signalement ouvert), « En cours »,
  « Terminées », « Annulées », « Non payées », « Toutes » ; recherche (numéro, établissement, partenaire) ; pagination
  servie par la base ; cartes sur téléphone, tableau sur ordinateur ; pastilles « À décider », « Signalement », « Client
  absent » ; nom du client entier seulement avec « Consulter les comptes » (prénom et initiale sinon).
- **`/admin/orders/<id>`** : frise des étapes (heure, auteur en mots, note), contenu, paiements, remboursements, montants
  servis par la base, client (nom, numéro, adresse seulement avec `users.read`, sinon « Données personnelles masquées »),
  signalement à traiter (réponse au client), « Annuler et rembourser » (motif, faute de l'établissement, bouton qui écrit
  le montant : « Rembourser 6 300 F CFA »), décision après une absence (« Rembourser tout », « Rembourser une part » en
  pourcentage, « Ne rien rembourser » + motif → aperçu demandé à la base → « Confirmer : rembourser X F CFA » ; montant
  changé entre-temps : refus et nouveau montant).

### Partenaire

- **Fermetures** (`/partner/tables/edition/<établissement>/fermetures`) : sous chaque fermeture à venir, « Commandes
  prévues pendant cette fermeture » (numéro, heure, articles, montant payé), « Annuler et rembourser » (motif prérempli
  « Fermeture exceptionnelle : … ») ou « Garder » ; rien d'automatique.
- **Pause** (écran des commandes et mode comptoir) : « Plus de commandes pendant 15 / 30 / 60 minutes » en un geste,
  « Pause jusqu'à 13 h 30 », « Reprendre maintenant » ; choix de l'établissement s'il y en a plusieurs.
- **Fiche d'une commande** : quand la partenaire livre elle-même, « Appeler le client » (compté) et « Client absent » ;
  bandeaux d'absence et du signalement du client.
- **Produit** : « Allergènes et piment » (14 allergènes à cocher, niveau de piment).

### Client

- **Suivi d'une commande** : « Signaler un problème » après le début de la préparation (motifs en puces : Retard,
  Commande incomplète, Erreur dans la commande, Autre ; texte court), puis « Signalement envoyé », puis « Signalement
  traité » avec la réponse de l'équipe ; bandeau « Le livreur n'arrive pas à vous joindre » / « L'équipe Event Village
  décide de la suite ».
- **Carte des plats** : bandeau « Ce restaurant reprend les commandes à 13 h 30 » ; allergènes et piment sur la fiche du
  plat ; filtre « Sans piment » ; le devis refusé pendant la pause affiche le message de la base tel quel.

---

## Serveur ajouté

| Fonction | Rôle |
|---|---|
| `order_delivery_step(p)` | `APPEL` : appel compté (un appel compte 30 s au moins après le précédent : deux touches rapprochées ne font pas deux appels) ; `ABSENT` : deux appels au moins, une fois, commande en route ; livreur de la commande (membre ACTIF) ou partenaire propriétaire ; avis |
| `order_watch_tick()` | attente de 30 min échue → décision de l'équipe (administrateurs `refunds.manage` prévenus, livreur prié de rapporter) ; fin de pause → établissement prévenu ; idempotente |
| `order_absence_decide(p)` | `refunds.manage` ou super-administrateur ; `TOUT` / `PART` (1-99 %) / `RIEN` + motif ; `preview` (montant, rien d'écrit) ; décision exigeant le montant affiché (`expected_amount`) ; une seule fois sous concurrence ; commande close « non retirée » (stock gardé : plat préparé), remboursement par le moteur financier (même calcul que `order_refund_payment`) |
| `order_issue_report(p)` / `order_issue_close(p)` | signalement (client, préparation commencée, ou remise depuis moins de 48 h ; un ouvert ; 3 au plus) / réponse de l'équipe (`refunds.manage`) |
| `order_admin_list(p)` / `order_admin_view(p)` | liste paginée et fiche (droits `payments.read` ou `refunds.manage` ; données personnelles avec `users.read`) |
| `order_courier_day(p)` / `order_courier_invitation_view(p)` | journée du livreur ; une invitation adressée au compte |
| `order_closure_orders(p)` / `order_closure_keep(p)` | commandes transmises et ouvertes dont l'heure, préparation comprise, touche la fermeture ; « Garder » |
| `order_venue_pause(p)` / `order_partner_pauses(p)` | pause 15/30/60 min (0 = reprendre) ; état de chaque établissement |
| `order_product_details_set(p)` | allergènes (liste fermée) et piment d'un produit non archivé de la partenaire |

Routes : `GET /api/courier/orders` (journée), `PATCH /api/courier/orders/[id]` (+ `APPEL`, `ABSENT`),
`GET /api/courier/invitations/[id]`, `PATCH /api/partner/orders/[id]` (+ `APPEL`, `ABSENT`),
`GET|POST /api/partner/orders/pause`, `GET|POST /api/partner/venues/closures/[id]/orders`,
`PUT /api/partner/products/[id]/details`, `POST /api/orders/[id]/issue`, `GET /api/admin/orders`,
`GET /api/admin/orders/[id]`, `POST /api/admin/orders/[id]/absence`, `POST /api/admin/orders/issues/[id]` ; chaque route
du livreur et de la partenaire : session active puis interrupteur des commandes ; routes de l'administration :
`verifyAdminAuth` (étape de sécurité) puis droit vérifié en base.

---

## Avis ajoutés (13)

Règle : étape importante sur les 4 canaux (SMS d'un segment GSM-7 au pire cas), petite étape en cloche et notification
du téléphone ; nuit : SEND (part tout de suite) ou DEFER (SMS et push reportés à la fin de la nuit) ; prénom et initiale
seulement pour nommer une personne ; lien vers l'objet exact.

| Type | Canaux | Nuit | Texte (cloche) | Lien |
|---|---|---|---|---|
| `ORDER_COURIER_ANSWERED` | IN_APP, PUSH | DEFER | Livreur ajouté — Moussa D. a accepté de livrer vos commandes. Vous pouvez maintenant lui confier une livraison. | `/partner/orders/livreurs?invitation=<invitation>` |
| `ORDER_COURIER_REMOVED` | IN_APP, PUSH | DEFER | Vous ne livrez plus — « Chez Fatou, cuisine du Sénégal et grillades » vous a retiré de ses livreurs : ses commandes ne vous sont plus confiées. Une livraison déjà partie reste à terminer avec l’établissement. | `/courier/orders?equipe=<invitation>` |
| `ORDER_COURIER_RETURN` | IN_APP, PUSH | SEND | Rapportez la commande — Le client de la commande CMD-261205-A1B2C3 reste absent après 30 minutes. Rapportez la commande à « Chez Fatou, cuisine du Sénégal et grillades » : l’équipe Event Village décide de la suite. S’il revient avant, vous pouvez encore la remettre avec son code. | `/courier/orders/<id>` |
| `ORDER_CLIENT_ABSENT` | IN_APP, PUSH, EMAIL, SMS | SEND | Le livreur n’arrive pas à vous joindre — Le livreur de votre commande CMD-261205-A1B2C3 vous a appelé deux fois sans réponse. Il attend jusqu’à 13:15 : rappelez le numéro qui vous a appelé et donnez-lui votre code. Ensuite, l’équipe Event Village décide de la suite. | `/orders/<id>` |
| `ORDER_CLIENT_ABSENT_PRO` | IN_APP, PUSH | SEND | Client absent — Votre livreur ne joint pas le client de la commande CMD-261205-A1B2C3. Il attend jusqu’à 13:15 ; ensuite, l’équipe Event Village décide de la suite et vous prévient. | `/partner/orders/<id>` |
| `ORDER_ABSENCE_DECIDED` | IN_APP, PUSH, EMAIL, SMS | DEFER | Commande non livrée — Votre commande CMD-261205-A1B2C3 n’a pas pu vous être remise : vous étiez absent. Vous êtes remboursé de 656 250 F CFA sur votre compte de paiement. Motif : Le client a rappelé après le départ du livreur. | `/orders/<id>` |
| `ORDER_ABSENCE_DECIDED_PRO` | IN_APP, PUSH | DEFER | Absence du client : décision — Commande CMD-261205-A1B2C3 close après l’absence du client. Le client n’est pas remboursé. Motif : Deux appels et une attente de 30 minutes sans réponse. | `/partner/orders/<id>` |
| `ORDER_ISSUE_PRO` | IN_APP, PUSH | SEND | Problème signalé — Le client de la commande CMD-261205-A1B2C3 signale un retard. L’équipe Event Village s’en occupe et peut vous contacter. | `/partner/orders/<id>` |
| `ORDER_ISSUE_CLOSED` | IN_APP, PUSH | DEFER | Signalement traité — L’équipe Event Village a traité votre signalement sur la commande CMD-261205-A1B2C3. Sa réponse est dans la commande. | `/orders/<id>` |
| `ORDER_CLOSURE_ORDERS` | IN_APP, PUSH | SEND | Commandes pendant la fermeture — 3 commandes sont prévues pendant la fermeture de « Chez Fatou, cuisine du Sénégal et grillades ». Pour chacune, choisissez : annuler et rembourser, ou garder. | `/partner/tables/edition/<id>/fermetures?fermeture=<id>` |
| `ORDER_PAUSE_ENDED` | IN_APP, PUSH | SEND | Commandes reprises — La pause est finie : « Chez Fatou, cuisine du Sénégal et grillades » reçoit de nouveau des commandes. | `/partner/orders?etablissement=<établissement>` |
| `ADMIN_ORDER_ABSENT` | IN_APP, EMAIL | DEFER | Absence à décider — Le client de la commande CMD-261205-A1B2C3 chez « Chez Fatou, cuisine du Sénégal et grillades » est resté absent à la livraison. Décidez : rembourser tout, une part, ou rien. | `/admin/orders/<id>` |
| `ADMIN_ORDER_ISSUE` | IN_APP, EMAIL | DEFER | Signalements à traiter — Un client signale une commande incomplète sur la commande CMD-261205-A1B2C3. Les autres signalements de l’heure sont dans la liste « À décider » des commandes. | `/admin/orders/<commande>` |

SMS (un segment GSM-7, pire cas contrôlé par `tests/parcours/l12d-statique.test.ts` S5 et par S2 de
`tests/audit/cv12a-3-statique.test.ts`, qui rend chaque avis `ORDER_*` avec SMS dans 72 variantes) :
- `ORDER_CLIENT_ABSENT` (143) : Event Village : commande CMD-261205-A1B2C3, le livreur n'a pas pu vous joindre. Il attend jusqu'à 13:15 : rappelez le numéro qui vous a appelé.
- `ORDER_ABSENCE_DECIDED` (110) : Event Village : commande CMD-261205-A1B2C3 non livrée, client absent. Remboursement de 656 250 F CFA en cours.
- `ORDER_ABSENCE_DECIDED rien` (117) : Event Village : commande CMD-261205-A1B2C3 non livrée, client absent. Aucun remboursement : motif dans l'application.

Non fait (consigne) : SMS de l'invitation d'un livreur (`ORDER_COURIER_INVITED`, lot avis).

---

## Tests et accès

### Suites nouvelles (toutes vertes au run 807)

| Suite | Contenu |
|---|---|
| `tests/parcours/l12d-livreur-admin.test.ts` | 13 tests, groupes A à J : coordonnées du livreur (téléphone en route seulement, rien après la fin, code jamais visible), livreur d'une autre partenaire ou retiré (avis A7), invitation (invité seul, réponse une fois, avis A6 avec prénom et initiale), reste en espèces (remise unique sous concurrence), client absent (deux appels, touches rapprochées = un appel, attente, décision une seule fois, montant écrit exigé, stock gardé), signaler un problème (trop tôt, d'autrui, motif, doublon, avis, réponse de l'équipe), annuler et rembourser (`refunds.manage`, deux annulations simultanées : une seule passe, un seul remboursement par paiement), administration (droits, filtres, pagination en base, nom, numéro et adresse du client avec `users.read` seulement, frise), fermeture (commandes prévues, propriétaire seul, « Garder », avis, paiement refusé), pause (15/30/60, propriétaire seul, devis refusé avec l'heure de reprise, bandeau, fin automatique, avis de fin une fois), allergènes et piment (écriture contrôlée par la base, carte, REST fermée), « Mes livraisons » (`courier_active` pour un livreur actif seulement) |
| `tests/parcours/l12d-statique.test.ts` | 6 tests sans base : S1 six recopies (une seule chacune, depuis la dernière définition, aucune ligne perdue, remplacements déclarés) ; S2 fonctions jamais recopiées ; S3 fonctions nouvelles absentes avant le lot et droits (service seul, `private` à personne) ; S4 sans BEGIN ni COMMIT, registre des avis = catalogue ; S5 SMS d'un segment au pire cas, prénom et initiale, jamais de code ; S6 écrans sans lecture REST des commandes ni des produits, sans calcul de montant |
| `tests/schema/migration-lot12d-rejouable.test.ts` | 3 tests : six migrations dans l'intervalle, après celles de main ; appliquées deux fois de plus sans erreur ; droits en base (publiques au rôle de service seul, `private` à personne, tables et colonnes nouvelles fermées à la REST) |
| `e2e/lot12d.responsive.spec.ts` | livreur, administration, partenaire et client, 390 et 1 440 px, clair et sombre ; aucune connexion (sessions préparées par la graine, à cause du quota de connexion par IP) ; compteur partagé `e2e/support/orders-service.ts` |

### Accès contrôlés

| Qui | Ce qui est refusé |
|---|---|
| anon, authenticated | toutes les fonctions du lot ; tables `order_issues`, `order_closure_keeps` et colonnes nouvelles d'`orders`, `products`, `venues` par la REST |
| livreur | commande d'une autre partenaire ; commande après son retrait ; téléphone du client avant le départ et après la fin ; code de remise ; absence avant deux appels ; deuxième absence |
| client | signalement avant la préparation, sur la commande d'autrui, deuxième signalement ouvert |
| partenaire | pause, commandes d'une fermeture et « Garder » sur l'établissement d'une autre |
| administration | liste et fiche sans `payments.read` ni `refunds.manage` (`FORBIDDEN`) ; annulation et décision d'absence sans `refunds.manage` ; nom entier, numéro et adresse du client sans `users.read` |

### Run complet 805 (rouge) et corrections

1. `recette-matrice` : `docs/recette-billetterie.md` cite des numéros de ligne de `email-regle-envoi` et `notif-modeles`, décalés par les ajouts du lot → références recalées (121/315/536 → 125/319/540 ; 593 → 607).
2. Captures `org-tables-fermetures` : la section « Commandes prévues » interrogeait le serveur service fermé (404 en console) → elle ne lit plus rien quand le service des commandes est fermé.
3. Spec du lot : fiche d'un plat à 1 440 px, l'aide du champ des notes passait sous le pied fixe de la fenêtre (défilement normal, pas un défaut d'écran) → le contrôle se fait une fois la fenêtre défilée en bas.

---

## Poids JS et mesure mobile

### Poids JS (gzip, octets) — budgets jamais relevés

| Route | Avant (main, run 783) | Après (run 807) | Écart | Budget |
|---|---|---|---|---|
| `/` | 215 587 | 215 721 | +134 | 226 342 |
| `/events/[id]` | 224 522 | 225 569 | +1 047 | 233 316 |
| `/tickets` | 240 960 | 240 612 | −348 | 250 417 |
| `/controller/scanner` | 225 251 | 225 385 | +134 | 234 911 |
| `/billet/hors-ligne` | 214 201 | 214 335 | +134 | 224 268 |
| `/explore` | 226 214 | 226 348 | +134 | 235 712 |

Les +134 octets communs aux six routes : entrée « Mes livraisons » de la coquille. Les +1 047 de la fiche d'un événement :
aucun écran de la fiche n'est touché, cause non isolée (probablement le découpage des morceaux partagés par Next) ; marge
restante 7 747 octets. Budgets inchangés.

### Mesure mobile (médiane de 5 passages, seuil ≥ 90)

| Page | Avant (main, run 783) | Run complet 805 | Après (run 807) |
|---|---|---|---|
| Accueil | 96 | 92 | 95 |
| Fiche d'un événement | 93 | 94 | 93 |
| Mes billets | 93 | 94 | 90 [89 ; 95 ; 90 ; 89 ; 92] |

Mesure valide à la première tentative aux deux runs complets. Mes billets passe juste (90) au run 807 : page non touchée
par le lot (son poids baisse de 348 octets) et 94 au run 805, dont le code ne diffère que par la section des fermetures,
le spec e2e et la recette : variation de la machine de la CI. LCP, CLS et toucher dans les seuils sur les trois pages.

---

## Captures

56 captures dans `ci-results/runs/807-46113663294/captures-responsive/`, nommées `l12d-<écran>__<largeur>__<thème>.jpg`
(390 et 1 440 px, clair et sombre) :

| Espace | Écrans |
|---|---|
| Livreur | `l12d-livreur-liste`, `l12d-livreur-livraison`, `l12d-livreur-code`, `l12d-livreur-client-absent`, `l12d-livreur-invitation` |
| Administration | `l12d-admin-liste`, `l12d-admin-fiche`, `l12d-admin-decision` |
| Partenaire | `l12d-partenaire-fermeture`, `l12d-partenaire-pause` |
| Client | `l12d-client-signalement`, `l12d-client-signalement-envoye`, `l12d-client-carte-pause`, `l12d-client-allergenes` |

Contrôle responsive général du run 807 : 198 résultats (page × thème), 0 défaut bloquant (public 33 pages, administration
21 dont « Commandes », organisatrice 40, scanner 5).

---

## Essais pour un non-développeur

Sur event-village-dev, après application des migrations et ouverture du service des commandes (réglages de la plateforme),
avec un compte partenaire validé (un établissement qui prend des commandes en livraison, paiement à la remise accepté),
un compte livreur et un compte client :

1. **Inviter un livreur** : partenaire → Commandes → Livreurs → inviter le numéro du livreur. Le livreur voit l'invitation
   dans « Mes livraisons » (ou par la cloche), touche « Accepter ». La partenaire reçoit « Livreur ajouté » (cloche).
2. **Livrer** : client → carte du restaurant → commander en livraison, payer à la remise. Partenaire → accepter, « Prête »,
   choisir le livreur. Livreur → « Mes livraisons » → la commande → « Je pars ». Le client reçoit le code par SMS.
   Livreur : vérifier que le numéro du client n'apparaît qu'après « Je pars ». Saisir le code, cocher « Reste reçu en
   espèces : … », « Remettre la commande ». La commande passe dans « Terminées aujourd'hui », sans adresse.
3. **Client absent** : refaire une livraison ; livreur → « Appeler le client » deux fois (à 30 s d'intervalle) ; « Client
   absent » apparaît ; le confirmer. Le client reçoit le SMS « le livreur n'a pas pu vous joindre… ». Le compte à rebours
   de 30 minutes s'affiche ; après 30 minutes (tâche des commandes toutes les 5 min), « L'équipe Event Village décide ».
4. **Décider** : administrateur avec « Gérer les remboursements » → Commandes → « À décider » → la commande → « Rembourser
   une part », 50 %, motif → « Voir le montant rendu » → le bouton écrit le montant → confirmer. Le client reçoit la
   décision (SMS compris), la partenaire aussi (cloche).
5. **Signaler** : client → une commande en préparation → « Signaler un problème » → « Retard » → envoyer. La partenaire voit
   « Le client signale : retard » ; l'administration voit la commande dans « À décider » → répondre → le client voit la
   réponse dans sa commande.
6. **Fermeture** : client → commander pour demain midi (payé). Partenaire → Tables → l'établissement → Fermetures → fermer
   demain de 11 h à 14 h. La commande apparaît sous la fermeture : « Garder » ou « Annuler et rembourser ».
7. **Pause** : partenaire → Commandes → « Pause des commandes » → 15 min. Client → carte du restaurant : bandeau « Ce
   restaurant reprend les commandes à … » ; essayer de commander : message de pause. Après 15 min, tout revient seul.
8. **Allergènes** : partenaire → un produit → « Allergènes et piment » → cocher « Arachides », « Pimenté » → enregistrer.
   Client → carte → le plat : allergènes et piment affichés ; filtre « Sans piment ».

---

## Idées (classées par valeur)

1. **« Je suis devant chez vous »** (livreur, un geste) : avis immédiat au client (notification et SMS) avant même le
   premier appel ; c'est le moyen le plus sûr de faire baisser les absences et donc les remboursements à trancher.
2. **Appel masqué** entre le livreur et le client (numéro relais) : ni le numéro du client ni celui du livreur ne
   circulent ; les deux appels exigés avant « Client absent » deviennent vérifiables par l'équipe.
3. **Preuve de passage** au moment de « Client absent » (position du téléphone, photo facultative de la porte) jointe à la
   fiche de l'administration : décision de l'équipe plus rapide et plus juste.
4. **Récapitulatif de fin de journée du livreur** : espèces encaissées par commande et total à remettre au restaurant
   (montants servis par la base), avec « Remis au restaurant » confirmé par la partenaire.
5. **Pause proposée automatiquement** quand des commandes reçues attendent une réponse depuis plus de 10 minutes (« Vous
   êtes débordé ? Pause de 15 minutes ») : moins de commandes « sans réponse » remboursées.
6. **Réponses types aux signalements** dans l'administration (retard confirmé, produit remplacé, geste commercial) et
   **bon d'achat** comme alternative au remboursement, pour garder le client.
7. **Tournée du livreur** : plusieurs livraisons d'une même zone regroupées, itinéraire à plusieurs arrêts.
8. **Filtre par allergène** sur la carte (« sans arachides », « sans gluten ») et mention « peut contenir des traces »,
   sur les mêmes données que le filtre « Sans piment ».

---

## Hors périmètre (reporté dans `docs/apres-lancement.md`)

Retrait par un proche, commande groupée, statistiques et plats du jour sur l'accueil (12e), suivi GPS du livreur ; voir
aussi la section « Commandes : livreur et administration (lot 12d) » de `docs/apres-lancement.md`.
