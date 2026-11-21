# Lot 12a — Commandes : argent et sécurité

Branche `lot12a/commandes-argent`, partie de `main` à `2ec11bb66`. Non fusionnée. Aucun écran : le service reste fermé par
son interrupteur (`features.orders_enabled`), les tests l'ouvrent le temps de leur passage. Migrations `20261130000001` à
`…08`, sans BEGIN ni COMMIT, rejouables, **non appliquées** sur event-village-dev. Une contre-vérification indépendante
suit.

## À lire en premier

### Failles de l'ancien code des commandes (trouvées et corrigées)

Aucun état des lieux du lot 12 n'existait dans `docs/` : relevé fait en lecture seule le 21/11 (§ 2). Chaque trou a un
test rouge sur `main`, sur la branche de preuve `lot12a/rouges` (main + la seule suite `l12a-failles-existant`), puis vert
sur la branche du lot.

| # | Faille | Correctif | Test |
|---|---|---|---|
| F1 | La partenaire écrivait **n'importe quel statut** (`PATCH /api/partner/orders/[id] { order_status }`) : une commande jamais payée passait « livrée ». | Chaque étape par `order_partner_action` en base (verrou, état attendu, journal, historique) ; garde : plus aucune écriture d'une commande d'établissement hors des fonctions en base, même avec la clé de service. | `l12a-failles-existant` F1, `l12a-commandes` D |
| F2 | La partenaire lisait **par REST** toutes ses commandes, avec l'adresse du client (`orders_read`), donc aussi en temps réel. | `orders_read` : le client et l'administration seulement ; la partenaire et le livreur lisent par les routes serveur (`order_view`, `order_partner_list`, `order_courier_list`). | F2, `l12a-commandes` D, `dette-publication-reservations` |
| F3 | Une **quantité négative** faisait une remise : 10 000 F de produits pour 2 000 F (`POST /api/orders/create`, total calculé par la route). | Devis et commande en base (`order_quote_compute`, `order_create`) : quantités 1 à 99, prix et suppléments relus en base, montants envoyés par le navigateur ignorés. | F3, `l12a-commandes` A |
| F4 | Un **produit d'une autre partenaire** était vendu sous le nom de la partenaire choisie (identifiant de partenaire pris dans le corps). | Produits de l'établissement choisi seulement (même partenaire, contrôle en base et déclencheur). | F4, `l12a-commandes` A |
| F5 | La liste de la partenaire montrait les commandes **jamais payées**, avec le nom complet et le téléphone du client, sans limite de durée. | Liste par la base : jamais une commande non payée ; adresse et téléphone seulement pour la commande, masqués 7 jours après la remise (tâche `ev_orders`). | F5, `l12a-commandes` C |
| F6 | La confirmation d'un paiement de commande écrivait la commande « payée, confirmée » par un chemin générique, sans verrou ni contrôle ; un échec de paiement l'annulait (sans rendre le stock). | `order_payment_confirm` en base (une seule fois, montant relu, commande encore payable, sinon remboursement en entier) ; l'échec d'un paiement ne touche plus la commande. | `finance-cibles`, `l12a-commandes` B, C, E |
| F7 | Le montant d'un paiement de commande était lu sur la commande écrite par la route. | `order_payment_create` relit la part payée au départ (ou le solde) sur la commande figée en base. | `l12a-commandes` A, B |
| F8 | Aucun produit réglementé, aucun stock tenu sous verrou, aucun plafond, aucune expiration. | Voir § 4 et § 5. | `l12a-commandes` A, C |

Résultats des runs : § 10.

### Ce qui change pour les autres lots

- **Recopies de fonctions communes** (dernière définition, aucune ligne perdue : `migration-lot12a-rejouable`) :
  `finance_setting_set`, `fin_setting_valid` (lot 10b), `platform_settings_defaults`, `fin_payout_available_at`,
  `calculate_referral_commissions`, `finance_admin_earned`, `finance_admin_payments` (lot 11a), `notif_cashouts_notify`
  (lot 10b). Si le lot 11b ou le design 1e changent l'une d'elles avant la fusion, la recopie du lot 12a est à refaire (le
  test devient rouge).
- La table `orders` porte aussi les **commandes de billets payés à l'entrée** (lot 4 : `tickets.order_id`,
  `ticket_cash_checkin`) : sans établissement ni état détaillé, elles restent écrites comme avant. Rien ne change pour la
  billetterie.
- La partenaire ne reçoit plus les commandes **en temps réel** (conséquence de F2) : l'ancienne page `/partner/orders` et
  `usePartnerOrders` sont à refaire au lot 12b (`docs/apres-lancement.md`).
- **Garde des fiches** : une fiche SUSPENDU est en lecture seule aussi pour les commandes, les produits, les livreurs et
  les réglages de vente (`partnerEventWrite`).

## 2. Relevé de l'existant : réutilisé, remplacé, retiré

| Élément | Décision |
|---|---|
| Tables `products`, `product_categories`, `orders`, `order_items`, types `order_status_enum`, `delivery_mode_enum`, `payment_type_enum` | **Réutilisés**, complétés (établissement, réglementé, état détaillé, montants figés, étapes, code, livreur). `order_status` reste lisible, dérivé de `order_state`. |
| Établissements `venues` et horaires `venue_opening_hours` (lot 11a) | **Réutilisés** : un établissement vend (sorte BOUTIQUE ajoutée) ; heure « au plus tôt » et créneau contrôlés par `venue_open_covers` ; validation par l'administration (`venue_validation_decide`). |
| Tables et zones du restaurant (lot 11a) | **Réutilisées** pour une commande sur place (table de l'établissement). |
| Moteur financier (lot 3) : grand livre, `refund_request`, `fin_refund_apply`, versements | **Réutilisé** : vente au grand livre au succès, remboursement par la même mécanique que les tables. |
| Boîte d'envoi, catalogue des avis, règle de nuit (lots 6, finition 4), envoi immédiat journalisé des codes (lot 6, contrat E7 : `renderSyncSms`, `notification_sync_log`) | **Réutilisés** : 17 types nouveaux en file, 1 envoi immédiat (`ORDER_HANDOVER_CODE`). |
| `POST /api/orders/create` | **Remplacée** (même chemin) : `order_create`. |
| `GET/PATCH /api/partner/orders[/id]` | **Remplacées** : lecture par la base, actions par `order_partner_action`. |
| Paiement ORDER par le chemin générique (`PaymentService.createPayment`, `confirmOtherPayment`, `releaseOther`) | **Remplacé** : `startOrderPayment` / `order_payment_create`, `order_payment_confirm`. |
| `lib/orders/order.service.ts` (total calculé par le serveur applicatif, statut écrit directement, stock rendu sans verrou) | **Retiré**. |
| Politiques `orders_insert`, `order_items_insert`, branche partenaire de `orders_read` | **Retirées** (aucune écriture REST ; lecture REST : client et administration). |
| Commandes de repas de l'ancien code (sans établissement, sans billet rattaché) | **Closes une fois** par la migration 03 (« Annulée par Event Village » si elles étaient en cours ; adresse effacée). Contrôle avant : § 9. |
| `GET /api/restaurants/[id]/menu`, routes des produits de la partenaire | **Gardées** telles quelles (écrans 12b). |

## 3. Schéma

| Objet | Contenu (migration) |
|---|---|
| `venues` (02) | `orders_open`, `order_modes` (LIVRAISON, RETRAIT, SUR_PLACE), `order_deposit_allowed`, `order_deposit_percent` (10 à 90, vide = réglage), `order_pay_on_handover`, `order_prep_minutes` ; sorte BOUTIQUE. Écrits par `order_venue_settings_set`. |
| `products` (02) | `venue_id` (même partenaire, jamais changé ensuite), `is_regulated` + `regulated_kind` (ALCOOL, TABAC : case de la partenaire), `regulated_admin` (décision de l'administration, écrite seulement par `order_product_regulation_decide`) ; prix en F CFA entiers (contrainte NOT VALID : anciennes lignes non réécrites). Réglementé = case de la partenaire OU décision de l'administration. |
| `product_options` (02) | suppléments : nom, prix ajouté par unité (F CFA entiers). |
| `product_daily_portions` (02) | portions du plat du jour par jour de Dakar : `portions`, `sold` (`sold ≤ portions`) ; écrites seulement par les fonctions en base. |
| `order_delivery_zones` (02) | zones de livraison d'un établissement : frais fixes (0 à 100 000) et minimum de commande. |
| `orders` (03) | `venue_id`, `order_state` (seule source ; `order_status` dérivé), `zone_id`, `onsite_table_id` / `onsite_label`, `asap`, `scheduled_for` (heure prévue), `estimated_at` (heure estimée), `prep_minutes` ; argent figé : `items_amount`, `delivery_fee`, `goods_total`, `deposit_percent`, `first_goods`, `first_fee`, `service_fee_rate`, `commission_rate` ; encaissé : `paid_goods`, `paid_fees`, `refunded_amount` ; `onsite_amount` (noté, jamais compté) ; `contact_phone`, `delivery_address`, `delivery_notes`, `contact_masked_at` ; `hold_expires_at`, `response_due_at`, `stock_taken`, `stock_released_at` ; `code_hash`, `code_issued_at`, `code_attempts`, `code_resends` ; `courier_user_id` ; heure de chaque étape : `received_at`, `accepted_at`, `preparing_at`, `ready_at`, `en_route_at`, `handed_over_at`, `pickup_warned_at`, `closed_at` ; `cancel_origin`, `cancel_reason`, `cancelled_by`, `partner_fault`, `refund_percent`. |
| `order_items` (03) | `base_price`, `options` (copie : nom et prix), `unit_price` = prix + suppléments, `total_price` = unitaire × quantité (1 à 99), `portion_day`, `stock_managed`. Une ligne d'un produit réglementé est refusée par un déclencheur, même sous le drapeau des fonctions. |
| `order_state_history` (03) | chaque changement d'état : de, vers, heure, auteur (CLIENT, PARTENAIRE, LIVREUR, ADMIN, SUPERADMIN, SYSTEM), note. |
| `partner_couriers` (03) | livreurs d'une partenaire : PENDING (invité), ACTIVE (a accepté), DECLINED, REMOVED. Rôle de service seul. |
| `private.order_code_key` (03) | 32 octets tirés une fois ; `order_code_hash` = HMAC-SHA256(commande:code, clé). Ni le rôle de service ni la clé de service ne lisent la clé ni n'appellent `order_code_hash`, `order_issue_code`, `order_code_delivery` : une copie complète des tables publiques ne permet pas d'essayer les 10 000 codes hors de la base. |

Garde (`trg_0_orders_flow_guard`, `trg_0_order_items_flow_guard`, `trg_0_order_state_history_guard`) : toute insertion,
suppression ou modification d'une commande d'établissement, de ses lignes ou de son historique est refusée hors des
fonctions en base (drapeau de transaction `event_village.order_flow`). Lecture REST : le client (les siennes) et
l'administration ; aucune écriture REST.

## 4. Règles d'argent, avec exemples chiffrés

Réglages (décisions du client) : frais de service 5 % payés par le client **sur ce qui est payé en ligne**, arrondis au
franc supérieur ; commission 0 % au lancement ; acompte 30 % par défaut (réglable par établissement, 10 à 90 %) ; frais
Wave 1,5 % à la charge d'Event Village ; recettes disponibles 48 h après l'heure prévue de la remise (délai existant).

| Cas | Calcul | Exemple (vérifié par `l12a-commandes`) |
|---|---|---|
| Payé en entier, retrait | articles = Σ (prix + suppléments) × quantité ; frais = arrondi sup (articles × 5 %) | 2 × (3 500 + 500) + 2 750 = **10 750** ; frais 537,5 → **538** ; à payer **11 288** ; Wave 169,32 ; part de la partenaire 10 750 ; net Event Village 368,68 |
| Acompte 30 %, livraison | total = articles + frais de zone ; acompte = arrondi sup (total × 30 %) ; frais sur l'acompte | 12 345 + zone 1 000 = **13 345** ; acompte 4 003,5 → **4 004** ; frais 200,2 → **201** ; maintenant **4 205** ; solde **9 341** |
| Solde payé en ligne | solde + arrondi sup (solde × 5 %) | 9 341 + 467,05 → 468 = **9 809** |
| Solde payé à la remise | noté sur la commande (`onsite_amount`), jamais une ligne de paiement ni une écriture au grand livre | 9 341 noté |
| Payé à la remise (si l'établissement l'accepte), sur place | rien en ligne, aucuns frais | 6 000 notés à la remise |
| Plat du jour | toujours payé en entier en ligne ; pour aujourd'hui seulement | acompte refusé |
| Minimum de la zone | articles ≥ minimum de la zone (frais de zone non comptés) | zone 5 000 : 4 000 refusé |

| Situation | Argent |
|---|---|
| Client annule avant le début de la préparation (en attente de paiement, reçue, acceptée) | tout rendu (articles et frais) |
| Client, après le début de la préparation | refusé (« La préparation a commencé… ») ; seule voie : Event Village annule pour faute de la partenaire |
| Partenaire annule ou refuse (motif) | tout rendu ; faute de la partenaire notée |
| Event Village annule (droit des remboursements ; motif) | tout rendu ; faute de la partenaire notée (oui par défaut) |
| Sans réponse de la partenaire sous 15 minutes | annulée, tout rendu |
| Non payée à temps (15 minutes) | close, produits et portions rendus, rien à rendre |
| Paiement arrivé après la clôture, ou second paiement de la même part | remboursé en entier (`metadata.refund_reason`), jamais compté |
| Commande prête non retirée 24 h après l'heure prévue | close sans remboursement (client prévenu 2 h avant) ; produits non rendus au stock |

Remboursement (`order_refund_payment`, même mécanique que les tables) : part de la partenaire (prix moins commission)
reprise au grand livre, frais de service et commission rendus par Event Village, frais de l'opérateur (1,5 %) à la
charge d'Event Village (`aggregator_fee_bearer = EVENT_VILLAGE`), commission de parrainage régularisée
(`fin_refund_apply`) ; une fois par paiement (clé `REFUND-ORDER-<paiement>`). Exemple : 11 288 rendus = 10 750 (part de la
partenaire) + 538 (frais) ; les 169,32 de frais Wave restent à Event Village. Aucun versement incertain n'est relancé
automatiquement : l'envoi passe par `CashoutService.send` ; un échec est repris par la tâche des versements existante.

Stock et portions : pris une seule fois à la création, sous le verrou de l'établissement puis du client, dans un ordre
fixe (portions par produit et jour, puis produits par identifiant) ; rendus une seule fois (`stock_released_at`) à
l'expiration, au refus, à l'annulation ; jamais après la remise ni pour une commande non retirée. Plafond : au plus 3
commandes non payées par client (en attente de paiement, ou payables à la remise et pas encore remises), compté sous le
verrou du client.

## 5. États et règles

| État (`order_state`) | Libellé | Heure gardée | Suivant |
|---|---|---|---|
| EN_ATTENTE_PAIEMENT | En attente de paiement | création | RECUE (paiement), EXPIREE (15 min), ANNULEE_* |
| RECUE | Reçue | `received_at` | ACCEPTEE, REFUSEE, SANS_REPONSE (15 min), ANNULEE_* |
| ACCEPTEE | Acceptée | `accepted_at` (+ heure estimée) | EN_PREPARATION, PRETE, ANNULEE_* |
| EN_PREPARATION | En préparation | `preparing_at` | PRETE, ANNULEE_PARTENAIRE / _EV |
| PRETE | Prête | `ready_at` | EN_ROUTE (livraison), REMISE (retrait contre code, sur place), NON_RETIREE |
| EN_ROUTE | En route | `en_route_at` (+ heure estimée) | REMISE (contre code), ANNULEE_PARTENAIRE / _EV |
| REMISE | Livrée / Retirée / Servie | `handed_over_at` | — |
| NON_RETIREE, EXPIREE, REFUSEE, SANS_REPONSE, ANNULEE_CLIENT, ANNULEE_PARTENAIRE, ANNULEE_EV | Non retirée, Non payée à temps, Refusée, Sans réponse, Annulée | `closed_at` | — |

- **Heure** : « au plus tôt » (l'établissement doit être ouvert pendant toute la préparation) ou créneau au quart d'heure,
  dans les horaires, au moins après la préparation, 7 jours au plus. Heure estimée recalculée à l'acceptation (minutes de
  préparation), à la préparation et au départ du livreur (minutes de trajet). `GET /api/orders/[id]` sert la frise des
  étapes (libellé, heure ou rien) pour le suivi animé du lot 12b.
- **Code de remise** (4 chiffres, tirage cryptographique) : retrait, envoyé quand la commande est prête ; livraison, au
  départ du livreur ; sur place, aucun code. 5 essais ; ensuite la remise est bloquée jusqu'à un nouveau code demandé par
  le client (3 au plus) ; chaque essai faux est journalisé. Le code n'est gardé qu'en empreinte. La fonction en base le
  rend une seule fois à la route serveur, qui l'envoie aussitôt au client par **SMS immédiat** (`ORDER_HANDOVER_CODE`,
  comme les codes à usage unique) puis le retire de la réponse : il n'est jamais renvoyé à la partenaire, au livreur ni au
  navigateur, et n'entre jamais dans la boîte d'envoi (contrainte existante `notification_outbox_no_secret_chk`) ; l'envoi
  est journalisé sans le code (`{ purpose: ORDER_HANDOVER }`). La cloche, le push et l'email disent « donnez le code reçu
  par SMS ». Garde des SMS : indispensable, limites par destinataire seulement (un restaurant actif n'est jamais bloqué par
  la limite par compte déclencheur).
- **Livreurs** : membres de l'équipe de la partenaire, invités par leur numéro (compte actif existant), livreurs après leur
  accord seulement ; retirés, ils ne voient plus rien et les commandes pas encore parties leur sont retirées.
- **Produits réglementés** (alcool, tabac) : affichés avec leur prix ; refusés au devis, à la création (en base), à
  l'insertion d'une ligne (déclencheur) et au paiement si l'administration les a marqués entre-temps (remboursement en
  entier).
- **Plat du jour** : portions par jour (jamais sous ce qui est vendu), payé en entier, pour aujourd'hui seulement ; il
  s'arrête seul à la fin du jour.
- **Coordonnées** : adresse, téléphone et consignes du client visibles par la partenaire et le livreur de la commande
  seulement (le livreur, tant que la commande est ouverte), masqués 7 jours après la remise (ou la fin de la commande) par
  la tâche `ev_orders`.
- **Fiche SUSPENDU** : lecture seule (garde des fiches et refus en base).

## 6. Routes serveur

Chacune vérifie la session (compte actif), puis l'interrupteur, puis le droit ou la propriété en base ; un objet d'autrui
répond « Commande introuvable » (404).

| Route | Qui | Fonction en base |
|---|---|---|
| `POST /api/orders/quote` | client | `order_quote` (rien n'est tenu) |
| `POST /api/orders/create` | client (numéro vérifié) | `order_create` |
| `GET /api/orders/[id]` | client (sans interrupteur) | `order_view` : étapes et heures, heure estimée, lignes, montants, code envoyé ou non (jamais le code) |
| `POST /api/orders/[id]/cancel` | client (sans interrupteur) | `order_cancel` origine CLIENT |
| `POST /api/orders/[id]/code` | client | `order_code_resend` |
| `POST /api/payments/create` (ORDER ; `part: SOLDE` pour le solde) | client | `order_payment_create` ; confirmation par le webhook et la réconciliation : `order_payment_confirm` |
| `GET /api/partner/orders`, `GET /api/partner/orders/[id]` | partenaire | `order_partner_list`, `order_view` |
| `PATCH /api/partner/orders/[id]` | partenaire | `order_partner_action` |
| `PATCH /api/partner/venues/[id]/orders` | partenaire | `order_venue_settings_set` |
| `POST /api/partner/products/[id]/portions` | partenaire | `order_daily_portions_set` |
| `GET/POST /api/partner/couriers`, `DELETE /api/partner/couriers/[userId]` | partenaire | `order_courier_invite`, `order_courier_remove` |
| `GET /api/courier/orders`, `GET/PATCH /api/courier/orders/[id]` | livreur ACTIF | `order_courier_list`, `order_view`, `order_courier_action` |
| `POST /api/courier/invitations/[id]` | invité | `order_courier_respond` |
| `POST /api/admin/orders/[id]/cancel` | admin `refunds.manage` | `order_cancel` origine EVENT_VILLAGE |
| `POST /api/admin/products/[id]/regulation` | admin `partners.validate` | `order_product_regulation_decide` |
| `PATCH /api/admin/services` (table orders) | admin `events.write` | `order_cancel` (commande jamais payée) |
| `/api/cron/orders` (tâche `ev_orders`, 3-59/5, avec `ev_tables`) | tâche | `order_tick` |

## 7. Avis : textes exacts

17 types en file, tous sur la cloche, le push et l'email (même texte que la cloche, push tronqué à 160 caractères), et le
SMS sauf l'invitation d'un livreur ; pour « en route » et « prête à retirer », le SMS de l'étape est le **code**, envoyé
tout de suite (`ORDER_HANDOVER_CODE`, tableau ci-dessous) et jamais mis en file. Chaque avis mène à la commande : `/orders/<id>` (client), `/partner/orders/<id>` (partenaire),
`/courier/orders/<id>` (livreur), `/courier/invitations/<id>` (invitation). Nuit (finition 4) : SEND = part tout de suite
(le client attend sa commande en ce moment) ; DEFER = SMS et push reportés à la fin de la plage. Tous les SMS ci-dessous
sont en GSM-7, **un segment** au pire cas (rendu réel du catalogue, nom d'établissement de 45 caractères, numéro de
commande de 17 caractères ; mesuré avec `smsSegments`, 0 échec). Données d'exemple : commande CMD-261205-A1B2C3, « Chez
Fatou, cuisine du Sénégal et grillades », code 4821.

| Type (nuit) | Cloche (titre : texte) | SMS |
|---|---|---|
| ORDER_RECEIVED (SEND) | Commande reçue : Votre commande CMD-… est transmise à « Chez Fatou… ». L’établissement l’accepte au plus tard à 12:15 ; sans réponse, elle est annulée et vous êtes remboursé. Suivez chaque étape depuis la commande. | Event Village : commande CMD-261205-A1B2C3 transmise à Chez Fatou, cuisine du Sé.... Réponse avant 12:15, sinon remboursée. |
| ORDER_ACCEPTED (SEND) | Commande acceptée : « Chez Fatou… » a accepté votre commande CMD-…, prévue vers 12:45. Au départ du livreur, vous recevrez le code à lui donner. Reste à payer à la remise : 875 000 F CFA. (retrait : « Quand elle sera prête, vous recevrez le code à donner au comptoir. » ; sur place : « Elle vous sera servie sur place. ») | Event Village : Chez Fatou, cuisine du Sé... a accepté la commande CMD-261205-A1B2C3. Prévue vers 12:45. |
| ORDER_PREPARING (SEND) | Commande en préparation : Votre commande CMD-… est en préparation chez « Chez Fatou… », prévue vers 12:45. Elle ne peut plus être annulée. | Event Village : commande CMD-261205-A1B2C3 en préparation chez Chez Fatou, cuisine du Sé.... Prévue vers 12:45. |
| ORDER_READY (SEND) | Commande prête — retrait : Votre commande CMD-… vous attend chez « Chez Fatou… ». Donnez au comptoir le code reçu par SMS. Reste à payer sur place : 875 000 F CFA. ; livraison : Votre commande CMD-… est prête chez « Chez Fatou… » : le livreur part bientôt. Vous recevrez alors le code à lui donner. ; sur place : Votre commande CMD-… est prête : elle vous est servie dans un instant. | retrait : le code (envoi immédiat, ci-dessous) ; livraison : Event Village : votre commande CMD-261205-A1B2C3 est terminée chez Chez Fatou, cuisine du Sé..., le livreur part dans un instant. ; sur place : Event Village : votre commande CMD-261205-A1B2C3 est terminée : elle vous est servie dans un instant. |
| ORDER_ON_THE_WAY (SEND ; cloche, push, email) | Commande en route : Votre commande CMD-… est en route, arrivée prévue vers 12:45. À son arrivée, donnez au livreur le code reçu par SMS. Reste à payer au livreur : 875 000 F CFA. | le code (envoi immédiat, ci-dessous) |
| ORDER_HANDED_OVER (SEND) | Commande livrée (retirée, servie) : Votre commande CMD-… de « Chez Fatou… » est livrée. Merci et à bientôt ! | Event Village : commande CMD-261205-A1B2C3 de Chez Fatou, cuisine du Séné... livrée. Merci et à la prochaine ! |
| ORDER_CANCELLED (SEND) | Commande annulée : Votre commande CMD-… chez « Chez Fatou… » est annulée par l’établissement. Motif : Rupture de poisson frais ce midi. Vous êtes remboursé de 1 312 500 F CFA sur votre compte de paiement. (par Event Village, par vous ; refusée : « … ne peut pas préparer votre commande … » ; sans réponse : « … n’a pas répondu à temps : votre commande … est annulée. » ; non payée à temps : « Le paiement de la commande … n’est pas arrivé à temps : elle est annulée et rien ne vous est pris. Vous pouvez la refaire. ») | Event Village : commande CMD-261205-A1B2C3 annulée par Chez Fatou, cuisine du.... 1 312 500 F CFA remboursés. (autres origines : « annulée par notre équipe. », « annulée. », « … ne peut pas préparer la commande … », « … n'a pas répondu : commande … annulée. », « paiement non arrivé à temps : commande … annulée, rien ne vous est pris. ») |
| ORDER_PAYMENT_REFUNDED (SEND) | Paiement remboursé : Votre paiement de 1 312 500 F CFA pour la commande CMD-… est arrivé alors qu’elle n’était plus possible (annulée, déjà payée ou établissement fermé). Il vous est remboursé sur votre compte Orange Money. | Event Village : votre paiement de 1 312 500 F CFA pour la commande CMD-261205-A1B2C3 n'a pas pu servir. Il vous est remboursé sur Orange Money. |
| ORDER_REFUND_PAID (SEND) | Remboursement versé : 1 312 500 F CFA pour la commande CMD-… vous ont été versés sur votre compte Orange Money. | Event Village : 1 312 500 F CFA versés sur votre compte Orange Money : remboursement de la commande CMD-261205-A1B2C3. |
| ORDER_PICKUP_REMINDER (SEND) | Commande à retirer : Votre commande CMD-… vous attend chez « Chez Fatou… ». Retirez-la avant le dim. 6 déc. 2026 à 12:45 : ensuite, elle est close sans remboursement. | Event Village : commande CMD-261205-A1B2C3 à retirer chez Chez Fatou, cuisine... avant le 6 déc. à 12:45, sinon close sans remboursement. |
| ORDER_NOT_COLLECTED (SEND) | Commande non retirée : Votre commande CMD-… n’a pas été retirée à temps chez « Chez Fatou… » : elle est close, sans remboursement. | Event Village : commande CMD-261205-A1B2C3 non retirée à temps chez Chez Fatou, cuisine du Séné... : close, sans remboursement. |
| ORDER_NEW (SEND, partenaire) | Nouvelle commande : Commande CMD-… chez « Chez Fatou… » : 12 articles, 1 250 000 F CFA. Livraison (zone Almadies et Ngor). À encaisser à la remise : 875 000 F CFA. Acceptez-la ou refusez-la avant 12:15 ; sans réponse, elle est annulée et le client remboursé. | Event Village : nouvelle commande CMD-261205-A1B2C3 : 12 articles, 1 250 000 F CFA. Répondez avant 12:15, sinon elle sera annulée. |
| ORDER_CANCELLED_PRO (SEND, partenaire) | Commande annulée : La commande CMD-… est annulée par Event Village. Motif : … Ne la préparez pas. (par le client ; faute de réponse : « … le client est remboursé. Pensez à répondre plus vite aux prochaines. » ; non retirée : « Commande non retirée : … elle est close. Ce que le client a payé vous reste. ») | Event Village : commande CMD-261205-A1B2C3 annulée par Event Village. Ne la préparez pas. (et les variantes « par le client », « annulée faute de réponse. Le client est remboursé. », « non retirée à temps : elle est close. ») |
| ORDER_HANDED_OVER_PRO (DEFER, partenaire) | Commande livrée : Votre livreur a remis la commande CMD-… au client. | Event Village : votre livreur a remis la commande CMD-261205-A1B2C3 au client. |
| ORDER_COURIER_ASSIGNED (SEND, livreur) | Livraison à faire : Commande CMD-… à livrer pour « Chez Fatou… », zone Almadies et Ngor. Ouvrez-la pour l’adresse et le téléphone du client ; à la remise, demandez-lui son code. | Event Village : commande CMD-261205-A1B2C3 à livrer pour Chez Fatou, cuisine..., zone Almadies et Ngor. Adresse dans l'application. |
| ORDER_COURIER_CANCELLED (SEND, livreur) | Livraison annulée : La livraison de la commande CMD-… est annulée ou confiée à quelqu’un d’autre : ne la livrez pas. | Event Village : livraison de la commande CMD-261205-A1B2C3 annulée ou confiée à un autre livreur : ne la livrez pas. |
| ORDER_COURIER_INVITED (DEFER, invité ; pas de SMS) | Invitation à livrer : « Chez Fatou… » vous invite à livrer ses commandes avec Event Village. Acceptez ou refusez l’invitation ; vous verrez seulement les livraisons qui vous sont confiées. | — |

Envoi immédiat du code (`ORDER_HANDOVER_CODE`, SMS seulement, journalisé sans le code, un segment GSM-7) :

| Étape | SMS (code 4821, commande CMD-261205-A1B2C3) |
|---|---|
| Prête à retirer | Event Village : votre commande CMD-261205-A1B2C3 vous attend. Donnez le code 4821 au comptoir pour la retirer, à personne d'autre. (130 caractères) |
| En route | Event Village : votre commande CMD-261205-A1B2C3 est en route. Donnez le code 4821 au livreur à son arrivée, pas avant. (119) |
| Nouveau code demandé par le client | Event Village : nouveau code de la commande CMD-261205-A1B2C3 : 4821. L'ancien ne marche plus. Donnez-le seulement à la remise. (127) |

Un paiement de commande n'envoie plus l'avis générique « Paiement confirmé » (`trg_payments_other_success`, ORDER exclu) ni
« Remboursement lancé » (`notif_cashouts_notify`) : les avis de la commande les remplacent.

## 8. Migrations

| Fichier | Contenu |
|---|---|
| `…01_l12a_reglages` | 12 réglages `orders.*` ; recopies de `finance_setting_set` et `fin_setting_valid` (20261126000002, lot 10b), `platform_settings_defaults` (20261123000101) |
| `…02_l12a_catalogue` | réglages de vente des établissements, sorte BOUTIQUE ; produits : établissement, prix entier, réglementé et décision de l'administration ; options ; portions du plat du jour ; zones de livraison ; `order_venue_settings_set`, `order_daily_portions_set`, `order_product_regulation_decide`, `product_regulated` ; lecture, aucune écriture REST |
| `…03_l12a_commandes_schema` | colonnes des commandes et des lignes, historique, livreurs, clé du code (schéma `private`), `order_code_hash`, état dérivé, garde, reprise des anciennes commandes de repas, lecture (client et administration) |
| `…04_l12a_devis_commande` | verrous, données et envoi des avis, historique, stock rendu ; `order_quote_compute`, `order_quote`, `order_create` |
| `…05_l12a_paiement` | `order_payable_refusal`, `order_expire_hold`, `order_payment_create`, `order_payment_confirm` ; recopies de `fin_payout_available_at`, `calculate_referral_commissions` (20261123000105) |
| `…06_l12a_etapes` | remboursement, clôture, annulation, code (émission, remise, nouveau code), actions de la partenaire et du livreur, livreurs, lectures serveur, `order_tick` ; recopie de `notif_cashouts_notify` (20261126000003) |
| `…07_l12a_avis` | 17 types d'avis (canaux, classement de nuit) et l'envoi immédiat `ORDER_HANDOVER_CODE` ; `trg_payments_other_success` (ORDER exclu) ; recopie de `notification_sync_log` (20261120000005, objet ORDER_HANDOVER) |
| `…08_l12a_releves` | commission des commandes dans les relevés ; recopies de `finance_admin_earned`, `finance_admin_payments` (20261123000109) |

Toutes les fonctions du lot sont réservées au rôle de service (`r3-fonctions-rpc`, `migration-lot12a-rejouable`) ;
`order_code_hash` et `order_issue_code` ne sont même pas ouvertes au rôle de service. Plus la tâche planifiée `ev_orders`
(`supabase/ops/schedule-crons.sql`, minute 2, toutes les 5 minutes).

## 9. Mise en service : contrôles avant et après (event-village-dev)

Ordre : les migrations de main d'abord (dernière attendue `20261127000001`), puis celles des lots fusionnés avant celui-ci
(11b : `20261129…`), puis `20261130000001` à `…08`, puis `schedule-crons.sql` (11 tâches) une fois les secrets Vault
`ev_app_url` et `ev_cron_secret` créés.

```sql
-- Avant
-- A. Dernière migration appliquée (attendu : 20261127000001, ou 20261129… si le lot 11b est passé avant)
select max(version) from supabase_migrations.schema_migrations;
-- B. Rien du lot : 0, 0
select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname like 'order\_%';
select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'order_state';
-- C. Anciennes commandes qui seront closes (repas, sans billet) et commandes de billets, intactes : à noter
select (select count(*) from public.orders o where not exists (select 1 from public.tickets t where t.order_id = o.id)) as repas,
       (select count(*) from public.orders o where not exists (select 1 from public.tickets t where t.order_id = o.id)
           and o.order_status::text not in ('LIVREE', 'REJETEE', 'ANNULEE')) as repas_en_cours,
       (select count(*) from public.orders o where exists (select 1 from public.tickets t where t.order_id = o.id)) as billets;
-- D. Paiements de commande en attente ou payés non clos (seront remboursés s'ils arrivent : à noter)
select status, count(*) from public.payments where payment_target::text = 'ORDER' group by 1;
-- E. Produits à prix non entier (la contrainte NOT VALID les laisse, mais ils ne se commandent pas)
select count(*) from public.products where price <> trunc(price);

-- Après
-- A. Huit versions 20261130000001 à …08
select version from supabase_migrations.schema_migrations where version like '20261130%' order by 1;
-- B. Fonctions du lot réservées au rôle de service : anon false, authenticated false (au moins 28 lignes)
select p.proname, has_function_privilege('anon', p.oid, 'execute'), has_function_privilege('authenticated', p.oid, 'execute')
  from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname like 'order\_%' order by 1;
-- C. 12 réglages orders.*
select key, value from public.platform_settings where key like 'orders.%' order by 1;
-- D. Anciennes commandes de repas closes (aucune sans état), commandes de billets sans état (intactes)
select order_state, count(*) from public.orders group by 1 order by 1;
select count(*) from public.orders o where o.order_state is null and not exists (select 1 from public.tickets t where t.order_id = o.id);  -- 0
-- E. Garde, clé du code, RLS : true, true, true, true, true
select exists (select 1 from pg_trigger where tgname = 'trg_0_orders_flow_guard'),
       exists (select 1 from pg_trigger where tgname = 'trg_b_order_items_regulated_guard'),
       exists (select 1 from private.order_code_key),
       (select relrowsecurity from pg_class where oid = 'public.order_state_history'::regclass),
       (select relrowsecurity from pg_class where oid = 'public.partner_couriers'::regclass);
-- F. orders_read sans la branche partenaire (la définition ne cite pas is_partner_owner)
select pg_get_expr(polqual, polrelid) from pg_policy where polname = 'orders_read';
-- G. 18 types ORDER_* (17 en file, ORDER_HANDOVER_CODE en envoi immédiat : sync_only true), nuit
select type, channels, night_policy from public.notification_types where type like 'ORDER\_%' order by 1;
```

Puis `03-verification.sql` (comme aux lots précédents) et `schedule-crons.sql` : 11 lignes actives dont `ev_orders`.

## 10. Tests et preuves

Suites du lot :

| Suite | Contenu |
|---|---|
| `tests/parcours/l12a-failles-existant` | F1 à F5 par les routes et la lecture REST, corps acceptés par l'ancien comme par le nouveau code (preuve des rouges) |
| `tests/parcours/l12a-commandes` (37 cas) | A. devis et commande (exemples chiffrés, montants du navigateur ignorés, réglementés : case, décision de l'administration, insertion directe refusée ; produit d'autrui, quantités 0, -1, 2,5, 100 ; stock, portions, minimum, plafond de 3 sous verrou, modes et paiements refusés) ; B. paiement, double confirmation sans effet, frise des étapes et heures, heure estimée, code par SMS immédiat (jamais en base, en file ni dans une réponse ; envoi journalisé sans le code), codes devinés (5 essais, blocage, nouveau code), solde en ligne ou sur place, partenaire sans commande non payée, réponse tardive ; C. annulations et remboursements (11 288 rendus, Wave 169,32 à Event Village, vente reprise), parrainage annulé, tâche (attente échue, paiement arrivé trop tard remboursé, sans réponse, rappel puis non retirée, masquage à 7 jours, tâche sans secret refusée) ; D. accès d'autrui (autre partenaire, autre client, livreur d'une autre équipe, invité non d'accord, retiré ; REST ; garde même pour le rôle de service ; fiche SUSPENDU) ; E. concurrence (deux créations de paiement, deux confirmations, deux paiements encaissés, deux remises, deux annulations) |
| `tests/schema/migration-lot12a-rejouable` | 8 migrations sans BEGIN ni COMMIT, appliquées deux fois de plus dans une transaction annulée ; 9 recopies sans ligne perdue ; fonctions réservées au rôle de service, clé du code et fonctions du code fermées même au rôle de service |
| `tests/helpers/lot12a-invariants` | o1 à o7 (montants, encaissé, état et argent, vente au grand livre, portions et stock, code, aucun code en clair), appelés en fin de suite après les invariants de toutes les livraisons précédentes (financier compris) |

Runs :

| Run | Commit | Mode | Résultat |
|---|---|---|---|
| 528 | `adb6f124d` (`lot12a/rouges` = main + la suite des trous) | rapide | **rouge voulu, 0/5**, chacun pour la bonne raison (extrait brut ci-dessous) ; typecheck et lint verts |
| 529 | `c42554db9` | rapide, 23 suites | 8 migrations appliquées sans erreur ; 19 suites vertes ; rouges : le code dans les données d'un avis refusé par la contrainte existante `notification_outbox_no_secret_chk` (étapes « prête » et « en route » en 500), textes exacts des SMS non déclarés (notif-modeles), minute 2 de `ev_orders` vérifiée par essai-cron-local, régularisation du parrainage mal vérifiée par mon test |
| 532 | `b998f9868` | rapide, 12 suites | code par SMS immédiat : vert ; restent 2 erreurs de mon test (chiffres d'un retrait pris pour une livraison ; forme de la régularisation) et le compte des envois journalisés (notif-migration) |
| 535 | `8c1529f4e` | rapide, 2 suites | **vert** : `l12a-commandes` 37/37, `notif-migration` 20/20 |

Extrait brut du run 528 (`runs/528-44863009363/jobs/rapide/verify.log`, branche `ci-results`) :

```
not ok 1 - F1 … error: 'commande jamais payée écrite « livrée » par la partenaire (HTTP 200)'
not ok 2 - F2 … lecture REST de la commande et de l’adresse du client par la partenaire : [{"id":"ebb6cf3b-…","delivery_address":"Villa 3, Ouakam"}]
not ok 3 - F3 … commande créée avec une quantité négative (HTTP 200) : {"success":true,"order":{…,"totalAmount":2000,"totalFormatted":"2 000 FCFA"}}
not ok 4 - F4 … commande créée chez une partenaire avec le produit d’une autre (HTTP 200)
not ok 5 - F5 … commande jamais payée listée à la partenaire (HTTP 200)
# pass 0
# fail 5
```

Run complet : voir la fin de cette section.

## 11. Tests existants modifiés (signalés)

Aucune assertion de `tests/audit/` ni de `tests/audit-auth/` n'est changée.

| Test | Modification | Pourquoi |
|---|---|---|
| `partner-orders-m9` (tests 2 à 5) | passent par `order_create`, `order_partner_action`, `order_cancel` au lieu de `OrderService` (retiré) ; mêmes intentions et mêmes montants (13 000 + 1 000 → 14 000, frais 700) ; le test 3 suit les étapes jusqu'à la remise contre code ; le test 4 attend « n'est plus disponible » au lieu de « est suspendu » | ancien service retiré (F1, F3, F4) |
| `finance-cibles` (commande) | commande créée par `order_create` ; payée : « reçue » (ancien statut EN_ATTENTE) au lieu de « confirmée » ; échec du paiement : la commande reste en attente de paiement (au lieu d'annulée) | F6 |
| `pannes-absences` (commande) | commande créée par `order_create` (payable à la remise : reçue, visible de la partenaire) ; la panne vise l'appel `rpc/order_view` (la route ne lit plus la table par REST) | F2, F5 |
| `dette-publication-reservations` | le témoin temps réel des commandes est le client (la partenaire ne lit plus par REST) ; la partenaire propriétaire rejoint les tiers qui ne reçoivent rien ; la sonde RLS attend la commande visible du client seulement ; le cas « suspendu » est éprouvé sur le client | F2 (consigne : aucune lecture REST des commandes par la partenaire) |
| `interrupteurs` | routes nouvelles ajoutées aux listes (réglages de vente, portions, livreurs, devis, routes du livreur) | couverture |
| `f2acv-ecritures-fiche` | les écritures des commandes et des produits ne sont plus « gardées » pour une fiche SUSPENDU : elles sont refusées (`partnerEventWrite`) | fiche SUSPENDU = lecture seule |
| `r3-fonctions-rpc` | 28 fonctions du lot ajoutées (réservées au rôle de service) | couverture |
| `notif-modeles`, `notif-outbox`, `notif-migration` | 17 types et l'envoi immédiat ajoutés (registre, textes exacts des SMS avec des valeurs courtes, émetteurs) ; `sendOrderCode` admise dans la liste des envois SMS immédiats (module `lib/orders/booking.ts`) | avis du lot |
| `planification-crons`, `essai-cron-local` | tâche `ev_orders` (minute 2) | tâche planifiée |
| `tests/helpers/finance-invariants.ts` (règles d et e) | la commission et le paiement impossible à honorer (`refund_reason`) d'une commande sont traités comme ceux d'une salle ou d'une table | paiements de commande en base |
| `docs/deploiement-projet-neuf.md` | tâche `ev_orders`, 11 tâches | tâche planifiée |

## 12. Points à faire trancher par le client

1. **Code de remise** : envoyé par SMS seulement (envoi immédiat, comme un code de connexion) ; la cloche, le push et
   l'email disent « donnez le code reçu par SMS ». La plateforme interdit déjà tout code dans la boîte d'envoi (lot 6) :
   le mettre dans le push ou l'email demanderait d'assouplir cette règle. Exemple du 21/11 respecté dans le SMS : « Donnez
   le code 4821 au livreur à son arrivée, pas avant. »
2. **Frais de service sur ce qui est payé en ligne** : avec un acompte, 5 % sur l'acompte, puis 5 % sur le solde s'il est
   payé en ligne ; rien sur un paiement à la remise (Event Village ne gagne rien sur ces commandes).
3. **Délai de réponse de la partenaire : 15 minutes** (réglage `orders.response_minutes`), puis annulation et
   remboursement. Proposition, non fixée par la décision du 18/11.
4. **Commande prête non retirée** : seule la commande **à retirer** et **prête** est close à 24 h sans remboursement ; une
   commande jamais marquée prête par la partenaire ne l'est pas. Une **livraison ratée** (client absent) n'a pas de règle
   automatique (§ `apres-lancement`).
5. **Recettes disponibles** 48 h après l'heure **prévue** de la remise (comme les billets après la fin de l'événement),
   même si la remise n'est jamais confirmée ; Event Village peut annuler et rembourser pendant ce délai.
6. **Produit non vérifié par l'administration** : commandable tant que ni la partenaire ni l'administration ne l'ont marqué
   réglementé. Autre choix possible : tout produit d'une catégorie « boissons » vérifié avant d'être vendu.
7. **Plafond des non payées** : les commandes payables à la remise et pas encore remises comptent (protection contre les
   fausses commandes).
8. **Annulation par le client après acceptation** (mais avant la préparation) : gratuite, comme décidé ; la partenaire qui
   veut s'en protéger passe en préparation dès l'acceptation.
9. **Livreur** : invité par son numéro, livreur après son accord ; la partenaire peut aussi livrer elle-même (étape « en
   route » par la partenaire).
