# Lot 11c-a — Tables d'un événement : argent et sécurité

Branche `lot11c/tables-argent`, partie de `main` à `71a42f01a7` (lot poids fusionné). **Non fusionnée.** Aucun écran :
le service reste fermé par son interrupteur propre (`features.event_tables_enabled`) ; les suites l'ouvrent le temps de
leur passage. Migrations `20261201000001` à `…006`, sans BEGIN ni COMMIT, rejouables, **non appliquées** sur
event-village-dev. Contre-vérification indépendante à venir avant toute fusion.

## À lire en premier

### Défauts trouvés et corrigés

Aucune faille dans le code existant. Les défauts ci-dessous sont dans **le code de ce lot**. D1 à D8 ont été trouvés
en écrivant ses tests, avant leur premier passage en CI (run rapide 2, run 649), et corrigés avant ce run. Chacun a son
test, d'abord écrit comme « attendu correct » (`todo`). Faute de run avant le correctif, **aucune sortie rouge** n'est
montrée pour eux. D9 a été trouvé par le run 649 : sa sortie rouge est donnée sous le tableau.

| # | Défaut | Correctif | Test |
|---|---|---|---|
| D1 | L'invariant global des paiements (« billets émis = quantités réservées ») devenait rouge dès la première table vendue (1 réservation, 6 billets). | Invariant adapté : une table réservée compte ses places (signalé). | `payment-invariants` (a), `l11c-tables` |
| D2 | L'invariant de la recette (« billet en ligne d'une catégorie non vendue en ligne ») rougissait pour chaque place de table. | Les places de table sont hors de cette règle ; `lot11c-invariants` (e) vérifie qu'elles ont leur vente (signalé). | `recette-invariants` (t1) |
| D3 | La borne de `event_tables.max_per_account` était inconnue de `fin_setting_valid` (non recopiée), et la valeur d'origine absente de la page des réglages. | `event_tables_setting_valid`, `event_tables_settings_defaults` ; la route des réglages fusionne les valeurs d'origine. | `f3b-reglages` (adapté), `l11c-tables` A |
| D4 | La route du porteur (`POST /api/tickets/[id]/refund`) répondait **500** sur une place de table. | Refus connu : 409 `TABLE_SEAT_NOT_ALONE`. | `l11c-tables` D |
| D5 | Retirer une table qui avait connu une simple tentative de paiement : **500** (clé étrangère). | Les attentes closes perdent leur table (`ON DELETE SET NULL`) ; un paiement arrivé ensuite est remboursé en entier (« table retirée ») ; une table déjà vendue est refusée en clair (`TABLE_SOLD`). | `l11c-tables` D |
| D6 | L'annulation d'un événement remboursait la table, mais la vente restait active (« Ma table », liste de la porte). | `trg_events_tables_cancelled` : vente close (`REFUNDED`, `EVENT_CANCELLED`) dans la transaction de l'annulation. | `l11c-tables` E |
| D7 | Un billet ordinaire pouvait être passé dans un type de table (clé de service) : place sans vente. | Garde des billets : refus `EVT11`. | `l11c-tables` D bis |
| D8 | Arrêter un type de table vendu libérait ses places dans la jauge : billets en trop possibles. | Un type de table arrêté garde ses tables vendues ou en paiement dans la jauge (`event_seats_refusal`, `ticket_category_create` et `_update`). | `l11c-tables` D bis |
| D9 | Le devis sans table choisie (cas normal sans plan) répondait **500** : `event_table_quote` lisait les champs d'une table jamais lue. | L'objet de la table n'est construit que si une table est choisie. | `l11c-tables` C (devis) |

Sortie rouge de D9 (run 649, `tests/parcours/l11c-tables.test.ts`) :

```
[API event tables quote] event_table_quote : 55000 record "t" is not assigned yet
    not ok 1 - devis : prix 150 000, 25 000 par personne, frais = arrondi supérieur du taux, total ; opérateur inconnu refusé
        HTTP 500 {"success":false,"error":"Le prix ne peut pas être calculé pour le moment.","code":"QUOTE_UNAVAILABLE"}
        500 !== 200
```

Le run 649 a aussi montré deux erreurs **dans le test** lui-même, sans défaut du code :
- le test du remboursement refusé pour une place entrée laissait cette place `UTILISE` sans scan accepté. L'invariant
  commun (g) du contrôle d'accès devenait rouge dans les 17 suites lancées après (`billet UTILISE : 0 scan(s)
  accepté(s)`). La place est remise en `VALIDE` après le contrôle. La suite vérifie désormais aussi les invariants
  communs dans son `after`, pour voir ce genre d'erreur chez elle ;
- le paiement tardif était attendu en `REFUND_PENDING`, mais le versement simulé était déjà fait (`REFUNDED`). Les deux
  sont acceptés, comme dans `paiement-confirmation`.

Deux autres changements de conception ont été faits pendant le lot.

- **Aides internes dans `private`.** Leçon T7 du lot 12a : `event_table_issue`, appelé directement avec la clé de
  service, aurait émis des billets sans paiement. Toutes les aides du lot sont dans le schéma `private`, hors de
  l'API ; `migration-lot11c-rejouable` le vérifie.
- **`finance_setting_set` non recopié.** La suite d'audit `cv12a-3` (S1) exige une seule recopie après main, et ses
  assertions ne changent pas : les réglages du lot ont leurs propres fonctions.

Point connu, antérieur au lot et non corrigé : pour les **billets**, arrêter une catégorie déjà vendue libère encore
ses places dans la jauge. D8 ne corrige que les types de tables ; la règle des billets est inchangée (noté dans
`docs/apres-lancement.md`).

### Le modèle (décisions du client du 25/11)

- Une table d'un événement (« Table VIP, 6 places, 150 000 F ») est un **lot de N billets** vendu par le **moteur des
  billets** : paiement de cible `TICKET`, montants de `finance_compute` (prix de la table + 5 % de frais du client,
  `finance.service_fee_rate` comme les billets, aucune commission). Annulation de l'événement (`event_cancel`),
  suspension de l'organisatrice, grand livre, parrainage, scanner, QR hors ligne, transfert et règle de nuit
  s'appliquent **sans code nouveau**.
- Un **type** de table est une catégorie de billets `kind = 'TABLE'` : places par table (2 à 20), prix **total** de la
  table, ce qui est compris (texte), minimum sur place (texte seulement, jamais encaissé), **mode de paiement**
  (`FULL`, `DEPOSIT`, `NONE` : colonne et contrôle posés ; seul `FULL` accepté au lot 11c-a). Un type n'est **jamais**
  vendu comme billet : `sale_online` et `sale_counter` sont faux par contrainte, si bien que la fiche, le catalogue,
  la carte, le prix d'appel, l'achat de billets, la caisse et les billets gratuits l'ignorent sans être recopiés.
- Chaque **table** (`event_tables`) a un numéro unique dans l'événement, un type, une zone facultative et une position
  sur le plan (géométrie des tables du lot 11b). Plan facultatif : avec plan, le client choisit une table précise ;
  sans plan, il choisit un type et reçoit la plus petite table libre.
- La **vente** d'une table (`event_table_bookings`) émet **N billets** reliés (`tickets.event_table_booking_id`), un
  par invité, au compte qui a payé (le titulaire) ; prix et frais répartis au franc près. Le titulaire envoie les places
  par le **transfert existant**, ou fait entrer ses invités avec lui.
- **Pas d'annulation par le client.** Annulation de la soirée : tout est rendu (`event_cancel`, inchangé). Report de
  plus de 24 h : le titulaire demande le remboursement de **toute la table** ; une place ne se rembourse jamais seule.

### Ce qui change pour les lots existants

- **Jauge en places** : Σ quotas des billets + Σ tables × places ≤ capacité, à la création et à la modification d'une
  catégorie, d'un type, des tables et de la capacité (`ticket_category_create`, `ticket_category_update`,
  `event_update` recopiées) ; capacité obligatoire dès qu'un type de table existe.
- **Réglages** : `finance_setting_set` n'est **pas** recopié. La suite d'audit `cv12a-3` (S1) n'admet qu'une recopie
  de cette fonction après main. Une fonction propre, `event_tables_setting_set`, règle les deux clés du lot. La route
  des réglages du super-administrateur l'appelle pour ces clés, et la page des réglages affiche leurs libellés.
- **Aides internes dans le schéma `private`** (leçon T7 de la contre-vérification du lot 12a) : `event_table_issue`,
  `event_table_checkout`, `event_table_sold_notify`, les refus, les prix, l'état d'une table et le drapeau d'écriture ne
  sont appelables par aucun rôle de l'API, clé de service comprise.
- **Modèle prévu au lot 11a abandonné** : il oubliait l'annulation et le report (rapport 11a et commentaire de la
  migration `20261123000102` corrigés, commentaire seul).

## Décisions prises (à valider si besoin)

| Sujet | Décision | Pourquoi |
|---|---|---|
| Interrupteur | `features.event_tables_enabled`, fermé ; `features.tables_enabled` reste celui des restaurants | Ouvrir les tables d'événement ne doit pas ouvrir les restaurants |
| Création d'un type | Avec ses N tables d'un coup (1 à 200), numérotées sur les plus petits numéros libres ; 500 tables au plus par événement | Un type sans table n'a pas de sens ; l'organisatrice renumérote ensuite sur le plan |
| Tables et plan | Enregistrés **en entier** (liste complète des tables, zones, plan montré), tout vérifié avant la première écriture, écritures annulées ensemble au moindre refus (règles de `venue_plan_set`, T7 du lot 11b) | Pas de plan à moitié enregistré |
| Plan montré | Exige que **toutes** les tables soient placées | Avec plan, le client choisit sur le plan : une table hors plan serait introuvable |
| Zones du plan | Les zones d'accès (`event_zones`) reçoivent un rectangle sur le plan ; badge du scanner « Table 12 · Carré VIP » (zone, sinon type) | Une zone d'accès est déjà la zone VIP du scanner |
| Figé | Prix et places d'un type dès la première vente **ou attente** ; table vendue ou en attente jamais retirée, renumérotée ni changée de type | Le client a payé ce qu'il a vu |
| Configuration | Refusée si fiche ou compte suspendu, événement en attente de validation, suspendu, terminé ou annulé (`ticket_category_guard` + événement suspendu) | Mêmes règles que la billetterie, plus la suspension |
| Achat | Un paiement = une table, payée en entier ; mêmes règles que les billets : un paiement en attente par compte et par événement, 3 par numéro payeur et par heure, garde `finance.payment_hold_minutes` | Un seul chemin d'argent |
| Tables par compte | 2 au plus par compte et par événement (`event_tables.max_per_account`) | Éviter l'accaparement ; réglable |
| Paiement tardif | Attente de table échue = paiement **remboursé en entier**, même si la table est encore libre | Consigne (« paiement tardif → remboursement entier ») ; plus simple à vérifier |
| Report | Remboursement de la table entière à la demande du titulaire, jusqu'au nouveau début ; refusé si une place a servi ; transferts en attente annulés ; la table revient en vente | Décision 5 du client |
| Signalement à l'administration | `ADMIN_EVENT_TABLES_CHANGED` (4 canaux) pour tout type ou table ajouté, modifié ou supprimé après validation, une fois par enregistrement ; l'alerte des catégories de billets ne part plus pour un type de table | Décision 8, sans double alerte |
| Rappel des places | La veille de l'événement (jour de Dakar), à partir de 10 h, au titulaire qui garde au moins une place à envoyer en plus de la sienne ; facultatif (Rappels) | Pas d'avis inutile |

## Migrations

| Fichier | Contenu |
|---|---|
| `…01_l11c_reglages` | `features.event_tables_enabled` (false), `event_tables.max_per_account` (2) ; `event_tables_setting_set`, `_valid`, `event_tables_settings_defaults` |
| `…02_l11c_schema` | `ticket_categories` : `kind`, `seats_per_unit`, `included_text`, `onsite_note`, `payment_mode` (contrainte) ; `event_tables`, `event_table_plans`, rectangle des `event_zones` ; `stock_reservations.event_table_id` (une attente active par table) ; `event_table_bookings` (une vente active par table) ; `tickets.event_table_booking_id` ; gardes d'écriture ; schéma `private` ; RLS |
| `…03_l11c_configuration` | `event_table_type_save`, `event_table_type_delete`, `event_tables_save`, jauge en places ; recopies `ticket_category_create`, `ticket_category_update`, `event_update` ; alertes aux administrateurs (déclencheurs recréés) |
| `…04_l11c_vente` | `event_table_offer`, `event_table_quote`, `event_table_config`, `event_table_checkout`, `event_table_issue`, `event_table_sold_notify`, « Ma table », porte, badge ; recopies `checkout_create_payment`, `payment_confirm` |
| `…05_l11c_remboursement` | recopies `ticket_refund_request` (place seule refusée), `ticket_postponement_refund_open` ; `event_table_postponement_window`, `event_table_postponement_refund` ; annulation de l'événement : ventes closes (`trg_events_tables_cancelled`) |
| `…06_l11c_avis` | 4 types d'avis ; `event_table_seats_reminders` |

Chaque recopie part de la **dernière** définition (fichier et lignes cités en tête de migration). Le test
`migration-lot11c-rejouable` vérifie trois choses :
- aucune ligne n'est perdue (lignes remplacées listées une à une : la somme des quotas devient une somme de places) ;
- chaque migration se rejoue deux fois ;
- les droits sont les bons : fonctions publiques au rôle de service seulement, `private` fermé à tous, tables sous RLS
  sans droit pour `anon` ni `authenticated`.

### Contrôles prévus sur event-village-dev (avant / après)

```sql
-- Avant : dernière migration de main ; rien du lot
select max(version) from supabase_migrations.schema_migrations;                                  -- 20261130000008 (ou plus récent de main)
select to_regclass('public.event_tables'), to_regclass('public.event_table_bookings');            -- null, null
select count(*) from information_schema.columns where table_name = 'ticket_categories' and column_name = 'kind'; -- 0

-- Après
select version from supabase_migrations.schema_migrations where version like '20261201%' order by 1; -- 6 versions
select key, value from public.platform_settings where key in ('features.event_tables_enabled', 'event_tables.max_per_account');
                                                                                                  -- false, 2
select kind, count(*) from public.ticket_categories group by 1;                                   -- TICKET seulement
select relname, relrowsecurity, has_table_privilege('anon', oid, 'select'), has_table_privilege('authenticated', oid, 'select')
  from pg_class where relname in ('event_tables', 'event_table_plans', 'event_table_bookings');   -- true, false, false (×3)
select p.proname, has_function_privilege('anon', p.oid, 'execute') a, has_function_privilege('authenticated', p.oid, 'execute') u,
       has_function_privilege('service_role', p.oid, 'execute') s
  from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname like 'event_table%'
   and p.prorettype <> 'trigger'::regtype order by 1;                                             -- 14 lignes : false, false, true
select count(*) from pg_proc where pronamespace = 'private'::regnamespace
   and (proname like 'event_table%' or proname = 'event_seats_refusal');                          -- 13
select has_schema_privilege('service_role', 'private', 'usage');                                  -- false
select tgname from pg_trigger where tgname in ('trg_0_event_tables_guard', 'trg_0_event_table_plans_guard', 'trg_0_event_table_bookings_guard',
       'trg_0_ticket_categories_table_guard', 'trg_0_tickets_event_table_guard', 'trg_0_stock_reservations_table_guard',
       'trg_event_tables_admin_alert', 'trg_ticket_categories_tables_admin_alert', 'trg_events_tables_cancelled') order by 1; -- 9
select type, channels, night_policy from public.notification_types where type like '%EVENT_TABLE%' order by 1;
                                                                                                  -- 4 types, 4 canaux ; SEND pour EVENT_TABLE_CONFIRMED, DEFER sinon
```

Puis `03-verification.sql`. Aucune tâche planifiée nouvelle (le rappel des places passe par `/api/cron/reminders`).

## Routes du serveur

| Route | Qui | Ce qu'elle fait |
|---|---|---|
| `GET /api/partner/events/[id]/tables` | organisatrice (ou administration) | types (tous), tables et leur état (VENDUE, EN_ATTENTE, LIBRE), zones, jauge en places, ventes |
| `PUT /api/partner/events/[id]/tables` | organisatrice | liste complète des tables, zones du plan, plan montré (tout ou rien) |
| `POST /api/partner/events/[id]/tables/types` | organisatrice | nouveau type avec ses N tables |
| `PATCH` / `DELETE /api/partner/events/[id]/tables/types/[typeId]` | organisatrice | modification (prix et places figés après vente) ; suppression sans vente |
| `GET /api/events/[id]/tables` | tous, sans session | offre : types, prix de la table, prix par personne, frais, total, tables restantes, plan (LIBRE ou PRISE), heure de lecture |
| `POST /api/events/[id]/tables/quote` | tous | devis d'un type ou d'une table, avec l'opérateur |
| `POST /api/events/[id]/tables/checkout` | client connecté, numéro vérifié | achat (clé d'idempotence, garde, SamirPay) ; `expires_at` pour le compte à rebours |
| `GET /api/event-tables`, `GET /api/event-tables/[bookingId]` | titulaire | « Ma table » : places envoyées, en attente, à envoyer, entrées, prénoms des invités, remboursement possible, lien WhatsApp sans jeton |
| `POST /api/event-tables/[bookingId]/refund` | titulaire | remboursement de la table entière après un report de plus de 24 h |
| `GET /api/events/[id]/tables/door` | propriétaire, contrôleurs, administration habilitée au scan | liste de la porte (prénom et initiale) |
| `POST /api/controller/scan` | inchangée | champ `table` ajouté pour une place de table : « Table 12 · Carré VIP », places entrées |

Aucune lecture REST nouvelle. Les montants et les places sont lus et calculés en base ; le navigateur n'envoie que des
identifiants, l'opérateur et le numéro du payeur. Le **signal temps réel** d'une table prise est celui qui existe déjà :
le stock public du type (`public_category_stock`, lu en temps réel par la fiche) change à chaque attente, vente ou
libération ; l'écran relit alors l'offre (`read_at` : heure de lecture en base).

## Avis : textes exacts

Lien de l'application `https://app.eventvillage.sn` (27 caractères). « Pire cas » : titre de 64 caractères (tronqué à
30), table 999, 20 places, 120 tables vendues. Tous en GSM-7, un segment (au plus 147 caractères, sous la marge de 155).

| Type | Destinataire | Nuit | Cloche (titre — contenu) | SMS (exemple) | Caractères exemple / pire cas |
|---|---|---|---|---|---|
| `EVENT_TABLE_CONFIRMED` | titulaire | tout de suite | **Table réservée** — Votre table 12 (Table VIP, 6 places) pour « Nuit Blanche » est réservée. Total payé : 157 500 F CFA. Envoyez les places à vos invités depuis Mes billets : chacun aura son billet. | Event Village : table 12 réservée pour Nuit Blanche, 6 places. Envoyez-les à vos invités : https://app.eventvillage.sn/tickets | 126 / 146 |
| `EVENT_TABLE_SOLD` | organisatrice (groupé, série de 30 min) | reporté (sauf événement à moins de 12 h) | **Table vendue** — Une table vendue pour « Nuit Blanche » : 6 places, +150 000 F CFA. (plusieurs : **Tables vendues** — 3 tables vendues pour « … » depuis 21:10 : 18 places, +450 000 F CFA.) | Event Village : une table vendue pour Nuit Blanche (6 places). https://app.eventvillage.sn/partner/events | 105 / 128 |
| `EVENT_TABLE_SEATS_REMINDER` | titulaire (facultatif, Rappels) | reporté | **Vos invités attendent leurs places** — Il vous reste 4 places à envoyer pour votre table 12 à « Nuit Blanche », demain à 20:00. Envoyez-les depuis Mes billets : chaque invité aura son billet. | Event Village : il vous reste 4 places à envoyer pour la table 12, Nuit Blanche demain. https://app.eventvillage.sn/tickets | 123 / 143 |
| `ADMIN_EVENT_TABLES_CHANGED` | administrateurs (events.read) | reporté | **Tables modifiées après validation** — « Nuit Blanche » de Sabar Events : tables ou types de tables ajoutés, modifiés ou retirés après validation. Vérifiez la fiche. | Event Village : tables modifiées après validation pour Nuit Blanche. Vérifiez la fiche : https://app.eventvillage.sn/admin/events | 129 / 146 |

Liens : le titulaire va vers les billets de l'événement (`/tickets/<événement>`, où sont ses places, en attendant
« Ma table » du lot 11c-b) ; l'organisatrice vers les ventes de son événement ; l'administration vers la fiche de
l'événement. Remboursements : avis existants des billets (`REFUND_*`, `TICKET_*`, `EVENT_CANCELLED`).

## Risques R1 à R14 : garde-fou et preuve

Numérotation de l'état des lieux (`docs/lot11c-etat-des-lieux.md` § 3 d).

| # | Risque | Garde-fou | Preuve (suite) |
|---|---|---|---|
| R1 | Double vente d'une même table | Type puis tables verrouillés (`FOR UPDATE`) à l'attente ; index uniques partiels : une seule attente active et une seule vente active par table ; tables relues sous verrou par `payment_confirm`, table déjà vendue ou attente échue = remboursement entier | `l11c-tables` C (deux achats simultanés de la même table : un seul gagnant, 409 TABLE_TAKEN), invariant (b) |
| R2 | Montant calculé hors de la base | `finance_compute` sur le prix du type lu sous verrou ; la route n'envoie qu'identifiants, opérateur et numéro ; prix et frais des N billets répartis en base | `l11c-tables` C (devis, répartition au franc près de 100 001 F sur 6 places), invariant (c) |
| R3 | Remboursement en double | Un paiement = une table ; remboursement de la table = `refund_request(paiement)` (clé `REFUND-<paiement>`, plafond au reste) ; une place ne se rembourse jamais seule (`TABLE_SEAT_NOT_ALONE`) ; vente passée REFUNDED sous verrou (2ᵉ demande : `ALREADY_REFUNDED`) | `l11c-tables` D (place seule refusée à l’organisatrice, à la titulaire, au super-administrateur et par la route), E (2ᵉ demande 409), invariant (d) |
| R4 | Invités : données | Aucune lecture REST (RLS sans politique) ; « Ma table » au seul titulaire (404 sinon) ; prénom et initiale seulement, numéro d'un transfert en attente réduit à ses 2 derniers chiffres ; porte : qui peut scanner l'événement | `l11c-tables` F (« Ma table » d’un autre compte : 404 ; numéro jamais en entier ; porte : « Awa A. », 403 pour un client), `migration-lot11c-rejouable` (RLS, droits) |
| R5 | Revente | Transfert gratuit existant (QR tournant, révocation) ; lien WhatsApp sans aucun jeton (adresse publique de l'événement) | `l11c-tables` F (lien WhatsApp : seulement l’adresse de l’événement) |
| R6 | Événement annulé | Vente en cible `TICKET` avec `event_id` : `event_cancel` (inchangée) la rembourse ; invariant (d) | `l11c-tables` E (annulation : total remboursé, places en remboursement, vente close), invariant (d) |
| R7 | Événement reporté | Table entière, à la demande du titulaire, si le début a bougé de plus de 24 h après l'achat et avant le nouveau début ; refus si une place est entrée ; place seule refusée, et plus proposée dans « Mes billets » | `l11c-tables` E (report de 48 h : refus avant, 404 autre compte, 409 place entrée, 200 total, transfert annulé, table de nouveau en vente ; report de 23 h : 409) |
| R8 | Organisatrice suspendue | Garde des fiches (middleware, `/api/partner/events/*`) ; en base `ticket_category_guard` (fiche ou compte suspendu) et événement SUSPENDU refusé ; vente refusée hors PUBLIE ; paiement tardif sur événement suspendu remboursé (`payment_confirm`, inchangé) | `l11c-tables` D (fiche suspendue : 403 sur POST, PATCH, PUT ; événement suspendu : achat et configuration refusés) |
| R9 | Prix ou places changés après une vente | Refus en base (`PRICE_LOCKED_AFTER_SALES`) et déclencheur qui refuse même la clé de service ; table vendue ou en attente jamais retirée, renumérotée ni changée de type (`TABLE_SOLD`) | `l11c-tables` B (écritures directes par la clé de service : EVT11), D (TABLE_SOLD, PRICE_LOCKED_AFTER_SALES) |
| R10 | Accaparement | Un paiement en attente par compte et par événement, 3 par numéro payeur et par heure, garde courte ; 2 tables au plus par compte et par événement | `l11c-tables` C (une table par compte : 409 TABLE_LIMIT) |
| R11 | Interrupteur partagé avec les restaurants | `features.event_tables_enabled`, propre ; fermé : configuration et vente refusées (404), offre vide ; ventes existantes, « Ma table », porte et remboursement restent ouverts | `l11c-tables` A (service fermé : 404 à la configuration et à l’achat, offre vide), `edition-services` (aucune table sans type) |
| R12 | Validation contournée | Types figés pendant la validation (`WITHDRAW_TO_EDIT`) ; tout type ou table ajouté, modifié ou supprimé après validation signalé aux administrateurs (`ADMIN_EVENT_TABLES_CHANGED`) | `l11c-tables` D (en attente de validation : WITHDRAW_TO_EDIT), F (ADMIN_EVENT_TABLES_CHANGED, aucun ADMIN_EVENT_CHANGED) |
| R13 | Versement trop tôt | Part de l'organisatrice disponible après l'événement, gelée si suspendue (cible `TICKET`, inchangé) | suites existantes du grand livre et des versements (cible TICKET inchangée) ; `l11c-tables` F (commission de parrainage = 5 % du revenu net) |
| R14 | Minimum de consommation | Texte seulement (`onsite_note`, 120 caractères), jamais un montant ; aucune colonne d'argent | `l11c-tables` B (création : minimum sur place en texte) ; contrainte `ticket_categories_kind_chk` |

Invariants (`tests/helpers/lot11c-invariants.ts`, appelés à la fin de chaque suite du lot) :
- (a) places vendues ≤ jauge ;
- (b) une seule vente ou attente active par table ;
- (c) N billets par table vendue, prix et frais des billets égaux à ceux du paiement ;
- (d) remboursement unique, et aucun paiement de table réussi sur un événement annulé sans remboursement ;
- (e) aucune place de table sans sa vente.

## Tests

**Nouveaux** :
- `tests/parcours/l11c-tables.test.ts` : 27 tests, sections A à F et D bis ; son `after` vérifie les invariants du lot
  puis les invariants communs (avis, cycle, contrôle d'accès, finances, paiements) ;
- `tests/parcours/l11c-helpers.ts` ;
- `tests/helpers/lot11c-invariants.ts` : invariants (a) à (e) ;
- `tests/schema/migration-lot11c-rejouable.test.ts` : rejeu, recopies, droits, RLS.

Aucune assertion de `tests/audit/` ni de `tests/audit-auth/` n'a changé.

**Modifiés (signalés)** :

| Test | Modification | Pourquoi |
|---|---|---|
| `tests/parcours/edition-services.test.ts` | En-tête mis à jour ; nouveau test : la fiche ne reçoit aucune table tant qu'aucun type n'existe (`GET /api/events/[id]/tables` : open faux, listes vides). Les mots « Tables VIP » et « Réservation de tables » restent interdits dans le formulaire, ses pages, la fiche, la carte et le pilotage. | Consigne (« Tables VIP » seulement quand des tables existent) : le nom d'un type de table vient de la base, jamais du code des pages |
| `tests/helpers/payment-invariants.ts` (a) | Billets attendus = Σ quantité × places par unité (1 pour une catégorie de billets) | D1 : une table réservée émet ses N places |
| `tests/helpers/recette-invariants.ts` (t1) | Places de table exclues de la règle « billet en ligne d'une catégorie non vendue en ligne » | D2 : un type de table n'est jamais vendu comme billet ; `lot11c-invariants` (e) vérifie que chaque place a sa vente |
| `tests/parcours/f3b-reglages.test.ts` | Les bornes des clés `event_tables.*` sont lues par `event_tables_setting_valid` | D3 : `fin_setting_valid` n'est pas recopié (suite d'audit `cv12a-3`, S1) |
| `tests/parcours/notif-modeles.test.ts` | 4 types au registre attendu (G2) et 6 textes SMS exacts | Avis du lot |
| `tests/parcours/notif-outbox.test.ts` | 4 types au registre | Avis du lot |
| `tests/parcours/notif-migration.test.ts` | 3 émetteurs à l'inventaire : `event_table_sold_notify`, `event_table_seats_reminders`, `trg_event_tables_admin_alert` | Avis du lot |
| `tests/security/r3-fonctions-rpc.test.ts` | Bloc du lot 11c-a : 14 fonctions publiques refusées à `anon` et `authenticated` (42501) | Fonctions nouvelles |
| `tests/schema/zones-schema.test.ts` | Liste exacte des colonnes de `event_zones` : + `plan_x`, `plan_y`, `plan_w`, `plan_h` (numeric, facultatives) | Rectangle d'une zone sur le plan des tables (`20261201000002_l11c_schema.sql:89-92`) ; rouge au run complet 651 |

Autres fichiers existants modifiés :
- `docs/lot11a-rapport.md` (§ Modèle) et commentaire d'en-tête de `20261123000102_l11a_etablissements.sql` : modèle
  abandonné, et pourquoi. Commentaire seul, aucune instruction ne change.
- `lib/events/event.service.ts` : suppression d'un type de table par la route des billets, refusée en clair (409).
- `app/api/admin/finance-settings/route.ts`, `lib/settings/catalog.ts`, `app/admin/finance-settings/page.tsx` : les deux
  réglages du lot (libellés, bornes, valeurs d'origine).
- `app/api/tickets/[id]/refund/route.ts` : refus `TABLE_SEAT_NOT_ALONE` (D4).
- `app/api/controller/scan/route.ts` : badge de table.
- `app/api/cron/reminders/route.ts` : rappel des places à envoyer.
- `lib/notifications/*` : 4 avis.
- `docs/recette-billetterie.md` (§34) : lignes citées de `edition-services` recalées (+5 et +17, après le test ajouté) ;
  `recette-matrice` les vérifie.

## Ce que la base donne déjà aux écrans, et idées pour 11c-b et 11c-c

**Déjà prêt dans les réponses du serveur** (téléphone et ordinateur) :
- **Devis lisible.** `price`, `price_per_person` (et `price_per_person_exact`), `service_fee`, `service_fee_rate`, `total`.
  Exemple : « Table VIP · 6 places · 150 000 F, soit 25 000 F par personne ».
- **Tables restantes vraies** (`remaining_tables`), état LIBRE ou PRISE de chaque table du plan, `read_at`. Le signal
  temps réel existant (stock public du type) dit à l'écran de relire l'offre.
- **Compte à rebours.** `expires_at` de l'achat donne « Table gardée 9:42 » ; `hold_minutes` est aussi dans l'offre.
- **« Ma table ».** Places `ENVOYEE`, `EN_ATTENTE` (avec les 2 derniers chiffres du numéro et la fin de l'offre),
  `A_ENVOYER`, `ENTREE`, `REMBOURSEE` ; prénoms des invités ; compteurs ; fenêtre de remboursement après un report ;
  `whatsapp_url` sans jeton.
- **Refus en mots simples, prêts à afficher** (`error`), avec un code stable (`code`) :
  - « Cette table vient d’être prise, choisissez-en une autre. »
  - « Toutes les tables « Table VIP » sont prises. »
  - « Vous avez déjà 2 tables pour cet événement : c’est le maximum par compte. »
  - « Le choix de la table n’est pas proposé pour cet événement : choisissez un type de table, son numéro vous sera
    donné. »

**Idées pour 11c-b (client)**
- Bascule « Billets | Tables » sur la fiche ; sur téléphone, le plan en plein écran avec pincement, et une feuille du
  bas qui garde le devis visible pendant qu'on touche les tables.
- Table choisie entourée, avec numéro et places ; une table prise pendant qu'on regarde se grise avec une courte
  animation et « La table 7 vient d’être prise » (animation coupée si le téléphone le demande).
- Sur ordinateur, le plan à gauche et le devis collant à droite ; survol d'une table : type, places, prix par personne.
- Après le paiement : « Envoyez vos 5 places » en tête de « Ma table ». Une rangée d'avatars (pointillés pour les places
  à envoyer), le partage au carnet du téléphone (Contact Picker quand il existe) ou par WhatsApp. Le soir même : « 3/6
  entrés ».
- Rappel du jour même au titulaire et aux invités (rappel existant de la veille et H-3) ; QR hors ligne déjà en place.
- Invité : sa place affiche « Table 12 · Carré VIP » et le prénom du titulaire (« invité par Awa D. »).

**Idées pour 11c-c (organisatrice, porte, administration)**
- Éditeur du plan avec gabarits : « 10 tables rondes en 2 rangées », « carré VIP de 4 tables », alignement
  automatique, copie du plan d'un événement précédent. Jauge en places affichée en direct (billets + tables ≤ capacité),
  refus du serveur affiché tel quel.
- Tableau des ventes : plan coloré par état (libre, en paiement, vendue) et liste triable. Tables vendues, places
  entrées, recette des tables hors frais, `sales` de la configuration.
- Liste de la porte en gros caractères, recherche par numéro, version imprimable (sans réseau) ; au scanner, le badge
  « Table 12 · Carré VIP » et « 3/6 entrés ».
- Administration : sur la fiche de l'événement, les types de tables, la jauge en places et l'historique des changements
  après validation (avis `ADMIN_EVENT_TABLES_CHANGED`).
- Page des réglages : les deux réglages du lot sont libellés (section « Tables des événements ») ; à reprendre dans la
  maquette de la page si elle change.

<!-- RUNS -->
