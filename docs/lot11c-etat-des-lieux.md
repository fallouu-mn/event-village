# Lot 11c — Tables d'un événement : état des lieux (étape 1, sans code)

Lecture seule, 25/11/2026, sur **main `71a42f01a7`** (fusion du lot poids), lue dans une copie extraite par
`git archive` (aucune branche, aucun commit, aucun run, aucune migration, aucune commande vers Supabase, `.env.local`
non lu). Chemins relatifs à la racine du dépôt ; `M/` = `supabase/migrations/`. Pour une fonction redéfinie plusieurs
fois, la citation est celle de sa **dernière** définition.

Ce fichier n'est pas commité.

---

## 0. En bref

1. **Le CDC cite le produit en une ligne et rien de plus** (§34, §51, §52, §54, §100, §112) : ni prix, ni lien avec
   les billets, ni entrée, ni annulation. Presque toutes les règles sont à décider.
2. **Deux moteurs existent, aucun ne fait le produit seul.**
   - Le moteur des **billets** porte tout ce qui touche un événement : jauge, stock, paiement, QR, scanner, transfert,
     annulation, report, suspension, versement après l'événement, parrainage.
   - Le moteur des **tables des établissements** (11a/11b) porte le plan de salle, la table précise et l'anti-double
     réservation.
   - Le modèle prévu en 11a (`event_id` sur `restaurant_tables`, même réservation, « rien à refaire dans les fonctions
     d'argent », `docs/lot11a-rapport.md:81-83`, `M/20261123000102_l11a_etablissements.sql:25-27`) **est faux sur un
     point grave** : l'annulation d'un événement ne rembourse que les paiements de billets
     (`payment_target = 'TICKET'`, `M/20261116000001_f2a_fiche_suspendue.sql:1160-1164`). Une table payée par le
     circuit des établissements ne serait **pas remboursée** à l'annulation, pas suspendue avec l'organisatrice, et pas
     concernée par le report.
3. **Défaut recommandé : la table est un « lot de N billets ».**
   - La vente passe par le moteur des billets : un paiement donne N billets, un par invité, reliés à une table précise.
   - On reprend des tables 11b seulement le **plan de salle** (composant et géométrie), pas leur réservation ni leur
     argent.
   - Gain : annulation, report, suspension, scanner, QR hors ligne, transfert, grand livre, parrainage et règle de nuit
     fonctionnent déjà.
4. **Découpage proposé** : 11c-a argent et sécurité (gros), contre-vérification, puis 11c-b écrans du client (moyen)
   et 11c-c écrans de l'organisatrice, de la porte et de l'administration (moyen).

---

## 1. Ce que dit le cahier des charges (`docs/CDC-V3.md`)

### 1.1 Citations mot pour mot

| § | Ligne | Texte exact |
|---|---|---|
| §1 | 24 | « Elle permet notamment : […] acheter des tickets ; réserver des tables ; […] » |
| §34 | 169-170 | « ## 34. SERVICES ASSOCIÉS — Un événement peut proposer : ticketing ; tables ; communication ; promotion. » |
| §49 | 227-228 | « ## 49. PRINCIPE — restaurants ; bars autorisés ; espaces événementiels ; organisateurs. » |
| §51 | 233-234 | « ## 51. ÉVÉNEMENT — zones ; catégories ; tables ; capacité ; prix ; conditions. » |
| §52 | 236-237 | « ## 52. DISPONIBILITÉ — disponible ; en attente ; réservé ; acompte payé ; moratoire ; payé ; annulé ; occupé. » |
| §53 | 239-240 | « ## 53. RÉSERVATION — date ; heure ; personnes ; zone ; table. » |
| §54 | 242-243 | « ## 54. ACOMPTE — paiement intégral ; acompte ; aucun paiement immédiat. » |
| §55 | 245-246 | « ## 55. PAIEMENT HORS PLATEFORME — Le Client peut payer directement au Partenaire lorsque cette option est autorisée. Le système enregistre l'information mais ne comptabilise pas ce paiement comme un encaissement Event Village. » |
| §37 | 182-184 | « Le ticketing peut utiliser le modèle : **Prix du ticket + frais de service**. Exemple : Ticket 1 000 FCFA ; Frais 5 % = 50 FCFA ; Total 1 050 FCFA. » |
| §39-40 | 189-193 | « Chaque ticket possède un QR Code unique. » ; « Le Contrôleur scanne le QR Code. Résultat : 🟢 VALIDE ou 🔴 INVALIDE / DÉJÀ UTILISÉ. » |
| §41 | 195-196 | « Le système doit gérer : annulation ; remboursement ; régularisation financière ; régularisation des commissions de parrainage. » |
| §100 | 392-393 | Transactions éligibles au parrainage : « […] ticketing ; réservation de salles ; réservation de tables ; […] » |
| §112 | 432-433 | « ## 112. RÉSERVATION DE TABLES — Gratuit pour le Partenaire au lancement. Commission ; promotion ; services Premium. » |
| Annexe E | 739 | « \| Réservation table \| Gratuit au lancement \| Commission \| » |
| Annexe H | 759 | « 4. ÉVÉNEMENTS + TICKETING → 5. RÉSERVATION TABLES + SALLES » |

### 1.2 Réponse (question a)

**Le CDC nomme le produit sans le décrire.**
- §51 liste six mots : zones, catégories, tables, capacité, prix, conditions.
- §52 et §54 sont communs aux restaurants et aux événements.
- §112 dit « gratuit pour le partenaire au lancement », puis « commission » plus tard.

**Ce qui manque pour construire :**

| Manque | Pourquoi c'est bloquant |
|---|---|
| Prix par table ou par personne | Le calcul et l'affichage en dépendent. |
| Ce qui est compris (entrées, bouteilles, minimum de consommation) | Un minimum payé sur place est hors plateforme (§55) : litige possible. |
| Lien table ↔ billets d'entrée | Le CDC ne dit pas si une table donne l'entrée. |
| Paiement intégral ou acompte, délai, solde | §54 ouvre trois modes ; aucun n'est choisi pour un événement. |
| Annulation par le client, annulation ou report de l'événement | §41 s'applique aux tickets ; rien pour les tables. |
| Partage des places, noms des invités | Rien. |
| Validation par l'administration | Rien (les catégories de billets sont validées avec l'événement). |
| Taux : frais client, commission | §37 donne 5 % pour les billets ; §112 donne « commission » sans taux. |

**Historique** : l'audit initial l'avait relevé (`docs/audit-evenementiel-cdc-v3.md:135` : « la réservation de tables
liée à un événement (§51) n'est pas modélisée »). Le lot 5 a ensuite **retiré l'option** de l'interface (voir § 2.4).

---

## 2. Ce qui existe (preuves)

### 2.1 Billetterie d'un événement

| Sujet | Ce qui existe | Preuve |
|---|---|---|
| Catégories | `ticket_categories` : prix, `total_quantity`, `sold_quantity`, `held_quantity` (`sold + held ≤ total`), fenêtre de vente, `max_per_order`, vente en ligne ou au guichet, couleur et consigne de scan | `M/0001_initial_schema.sql:312` ; `M/20260907000001_ticket_categories_hold_cart.sql:6-17` ; `M/20261106000001_lot8_canaux.sql:45-46` ; `M/20261110000009_lot9ter_zones.sql:104,108` |
| Jauge de l'événement | `events.capacity`. Contrôlée **seulement quand on règle les quotas** : Σ des quotas actifs ≤ jauge (`QUOTA_ABOVE_CAPACITY`). Rien à l'achat. | `M/0001_initial_schema.sql:306` ; `ticket_category_update`, `M/20261121000008_cvf2b_consigne_controle.sql:131`, contrôle `:262-272` ; création `M/20261119000002_f2b_couleur_consigne.sql:111` |
| Anti-survente | Verrou des catégories `FOR UPDATE ORDER BY id`, verrou par compte et événement, verrou par numéro payeur ; `ticket_sale_problems` : événement PUBLIE, catégorie active, fenêtre ouverte, `total − sold − held ≥ qté` | `checkout_create_payment`, `M/20261111000005_lot9quater_argent.sql:636` (`:658`, `:682`, `:695`) ; `M/20261106000001_lot8_canaux.sql:211` (`:271`) |
| Attente du paiement | `stock_reservations` (ACTIVE, CONVERTED, RELEASED, EXPIRED), réglage `finance.payment_hold_minutes` (10 min), purge par tâche | `M/20261031000013_lot2_reservations.sql:43-104`, `:229` ; `lib/payments/checkout.service.ts:103-107` ; `supabase/ops/schedule-crons.sql:103` |
| Montant | Calculé **en base** : `finance_compute` (frais = arrondi supérieur de prix × `finance.service_fee_rate`, 5 %), `finance_quote` pour le devis ; le moteur accepte déjà les cibles `TABLE_RESERVATION` et `ORDER` | `M/20261101000003_lot3_moteur.sql:47`, `:67`, `:122` ; `M/20261101000002_lot3_reglages.sql:61-62` |
| Paiement → billets | `payment_confirm` : verrou de l'événement, puis du paiement, puis des catégories. Si l'événement est ANNULE, SUSPENDU ou TERMINE, si le stock est perdu ou si le paiement est en double : remboursement. Sinon : billets émis et `PURCHASE_CONFIRMED`. | `M/20261125000003_f4_ventes.sql:146` (`:181`, `:252`, `:270-272`) |
| Grand livre, parrainage | Crédit VENTE au succès ; commissions sur le revenu net, toutes cibles | `M/20261101000004_lot3_grand_livre.sql:263,299` ; `calculate_referral_commissions`, `M/20261130000005_l12a_paiement.sql:429` (branche tables `:471-475`) |
| Billet | `tickets` : `user_id` seul (pas de nom ni de téléphone du porteur, sauf `guest_name` des invitations). QR tournant (TOTP), codes hors ligne pour 48 h. | `M/0001_initial_schema.sql:351` ; `M/20261110000008_lot9ter_invites.sql:31-39` ; `lib/security/totp.ts` ; `M/20261105000004_lot7_billet_hors_ligne.sql:278` |
| Transfert | Gratuit, de personne à personne, avec expiration ; **aucune revente** | `ticket_transfer_initiate`, `M/20261109000008_lot9bis_cycle.sql:1406` ; avis `TRANSFER_RECEIVED`, `lib/notifications/catalog.ts:834` |
| Remboursement | `refund_request` (paiement), `ticket_refund_request` (billet) ; clés uniques `REFUND-<paiement>` et `REFUND-TKT-<billet>` ; montant plafonné au reste ; commissions de parrainage reprises | `M/20261101000005_lot3_remboursements.sql:194` (`:92,118,158,203,218,224`) ; `M/20261116000001_f2a_fiche_suspendue.sql:1683` ; `M/20261106000004_lot8_commissions.sql:123` |
| Annulation de l'événement | `event_cancel` : transferts révoqués, paiements **`TICKET`** remboursés, billets annulés, avis `EVENT_CANCELLED` | `M/20261116000001_f2a_fiche_suspendue.sql:1050` (`:1152-1170`) |
| Report | Le porteur peut demander le remboursement si le début a bougé de plus de 24 h depuis l'achat, jusqu'au nouveau début. L'argent va à l'acheteur d'origine. **Cible `TICKET` seulement.** | `ticket_postponement_refund_open`, `M/20261109000006_lot9bis_argent.sql:515` (`:539-541`) ; `app/api/tickets/[id]/refund/route.ts` |
| Client qui annule | **Impossible** pour un billet (seul le report ouvre la demande) | `app/api/tickets/[id]/refund/route.ts` (« seul un report ouvre cette demande au porteur ») |
| Organisatrice suspendue | Ses événements PUBLIE passent SUSPENDU (cascade), ventes arrêtées, paiement tardif remboursé, soldes gelés, écritures refusées | `partner_status_set`, `M/20261117000001_f3a_securite.sql:25` (`:127-140`) ; `M/20261110000005_lot9ter_argent.sql:269` ; `M/20261116000001_f2a_fiche_suspendue.sql:18,112` |
| Scanner | `ticket_scan` ; un seul passage accepté par billet ; zones et portes (`event_zones` ENTREE ou CONTROLE, `zone_categories` : quelles catégories entrent dans quelle zone, verdict `wrong_zone`) ; jamais de validation hors ligne | `M/20261115000009_cvf1_verdict_hors_plage.sql:165` ; `M/20261110000009_lot9ter_zones.sql:38-91` ; `app/controller/scanner/page.tsx:14-16` |
| Validation | BROUILLON → EN_ATTENTE exige une catégorie active ; catégories figées en attente ; ajout ou changement après validation signalé aux administrateurs | `event_transition`, `M/20261116000003_f2a_carte.sql:826` (`:933-947`) ; `M/20261109000009_lot9bis_messages.sql:1148` ; `M/20261110000006` (`:150`) |
| Nuit | SMS et push des types `night_policy = 'DEFER'` reportés à la fin de la nuit (01:00-07:00) ; **jamais si l'événement commence dans moins de 12 h** ; `PURCHASE_CONFIRMED` part tout de suite | `notification_outbox_claim`, `M/20261125000006_f4_evenement_proche.sql:272-290` ; `M/20261125000001_f4_registre.sql:41`, `:115-128` |
| Rappel | `REMINDER_J1` « Rappel la veille » (facultatif) | `lib/notifications/catalog.ts:927` |
| Écrans | Fiche `app/events/[id]/page.tsx`, achat `components/event-page/EventTicketing.tsx`, paiement `app/paiement/[id]/page.tsx`, pilotage `app/partner/events/[id]/page.tsx`, éditeur des catégories `components/events/EventTicketing.tsx`, scanner `app/controller/scanner/page.tsx` | — |

### 2.2 Tables des établissements (lots 11a et 11b)

| Sujet | Ce qui existe | Preuve |
|---|---|---|
| Schéma | `venues`, `restaurant_zones`, `restaurant_tables` (numéro unique par établissement, capacité ≤ 50), `table_reservations` (créneau `slot` en tsrange, 11 états) | `M/20261123000102_l11a_etablissements.sql:34,186-199` ; `M/20261123000103_l11a_reservations_schema.sql:28-93` |
| Anti-double réservation | Contrainte d'exclusion `no_overlapping_table_slots` (même table, créneaux qui se chevauchent) ; garde : aucune écriture hors des fonctions du lot | `M/20261123000103_l11a_reservations_schema.sql:186-192`, `:139` |
| Verrous | Verrou de l'établissement puis du client ; `table_lock_reservation` | `M/20261123000104_l11a_reserver.sql:91` ; `M/20261123000106_l11a_annulation.sql:175` |
| Devis et argent | `table_quote` : **acompte par personne** + frais `tables.service_fee_rate` ; pas de prix par table ni de paiement en entier ; `table_payment_create`, `table_payment_confirm` | `M/20261129000003_l11b_reservations.sql:251` ; `M/20261123000111_l11a_cv_limite_client.sql:268` ; `M/20261123000105_l11a_paiement.sql:205` |
| Annulation et remboursement | `table_reservation_cancel` (aperçu exigé), `table_refund_payment` (clé `REFUND-TABLE-<paiement>`), fermetures avec empreinte | `M/20261129000007_l11b_cv_absence_annulation.sql:78` ; `M/20261123000106_l11a_annulation.sql:30` ; `M/20261129000006` |
| Réglages | 10 réglages `tables.*` : `service_fee_rate` 5, `commission_rate` 0, `validation_required` true, `slot_minutes` 120, `hold_minutes` 15, `response_minutes` 120, `no_show_minutes` 30, `cancel_free_hours` 2, `max_pending_per_client` 3, `reminder_hours` 2 ; interrupteur `features.tables_enabled` (fermé) | `M/20261123000101_l11a_reglages.sql:16-26` ; `M/20261129000004_l11b_avis.sql:35-37` ; `M/20261105000001_lot7_reglages.sql:36` ; `lib/settings/catalog.ts:79-87` |
| Plan de salle | Positions en % (tables : centre, forme RONDE/CARREE/RECTANGLE, rotation ; zones : rectangle) ; écriture tout ou rien `venue_plan_set` ; lecture `venue_floor` (LIBRE, PRISE, HORS_CAPACITE) ; **un composant** `FloorPlan` (modes vue, choix, édition ; doigt, souris, clavier) | `M/20261129000001_l11b_etablissements.sql:50-70` ; `M/20261129000008_l11b_cv_plan_tout_ou_rien.sql:16` ; `M/20261129000002_l11b_fermetures_disponibilites.sql:417` ; `components/tables/plan/FloorPlan.tsx:47,355,574`, `floor-geometry.ts` |
| Arrivée | Pas de QR : la partenaire marque « Client arrivé » ou « Absent » à la main | `M/20261129000007_l11b_cv_absence_annulation.sql:17` |
| Avis | 16 types `TABLE_*` sur 4 canaux, nuit réglée | `M/20261123000108_l11a_messages.sql:22-36` ; `M/20261129000004_l11b_avis.sql:23-33` ; `lib/notifications/catalog.ts:1447-1616` |
| Lien avec un événement | **Aucun** : pas d'`event_id` sur zones, tables, réservations ni paiements de tables | recherche sur tout `M/` |

### 2.3 Ce qui bloque le modèle prévu en 11a

`docs/lot11a-rapport.md:81-83` prévoit « une zone ou une table portera `event_id`, exclusif de `venue_id` […] rien à
refaire dans les fonctions d'argent ». La lecture du code montre l'inverse :

1. **Annulation de l'événement** : seuls les paiements `TICKET` sont remboursés
   (`M/20261116000001_f2a_fiche_suspendue.sql:1160-1161`). Une table payée en `TABLE_RESERVATION` resterait payée.
2. **Report** : le droit au remboursement exige `target = 'TICKET'` (`M/20261109000006_lot9bis_argent.sql:539-541`).
3. **Suspension** : la cascade touche les événements et les ventes de billets (`M/20261117000001_f3a_securite.sql:127-140`).
   `table_hold_refusal` regarde l'établissement, pas l'événement.
4. **Entrée** : une réservation de table n'a ni QR ni scan.
5. **Argent** : `table_quote` ne connaît que l'acompte par personne ; le créneau, l'absence à 30 min et
   « gratuit jusqu'à 2 h avant » n'ont pas de sens pour une soirée.
6. **Garde** : `restaurant_venue_guard` exige un établissement pour toute nouvelle zone ou table
   (`M/20261123000102_l11a_etablissements.sql:199` et commentaire `:20-21`).
7. **Interrupteur** : tout le circuit 11a/11b dépend de `features.tables_enabled`. Ouvrir les tables d'événement par
   lui ouvrirait aussi les restaurants.

### 2.4 Garde-fou du lot 5 à modifier (signalé d'avance)

`tests/parcours/edition-services.test.ts`, en tête du fichier, aux lignes 2-16 et 165-178 :
- force `events.services` à `{ ticketing: true, tableBooking: false, communication: false }` ;
- interdit les mots « Tables VIP » et « Réservation de tables » dans le formulaire d'événement, la fiche publique, la
  carte et le pilotage (`:254`, `:260-261`).

Le lot 11c devra modifier ce test, en le signalant. Recommandation : ne pas réutiliser la colonne `events.services`
(`M/20260902000003_event_services_promotions.sql:1`). La présence de types de tables suffit.

---

## 3. Réponses aux questions

### b. Réutiliser ou construire

| Élément | Verdict | Détail |
|---|---|---|
| Moteur de prix `finance_compute` / `finance_quote` | **tel quel** | Prix de la table + 5 % de frais, en base |
| Paiement, attente, purge, confirmation atomique (`checkout_create_payment`, `stock_reservations`, `payment_confirm`) | **à étendre** | Attente et vente d'une **table précise** ; N billets émis à la confirmation |
| Billets, QR tournant, hors ligne, transfert | **tel quel** | Un billet par place ; partage = transfert existant |
| Scanner, zones, portes (`event_zones`, `zone_categories`) | **tel quel** + un affichage | Badge « Table 12 · Carré VIP » sur l'écran de scan |
| Annulation, report, suspension, gel des soldes | **tel quel** si la vente reste en `TICKET` | Plus une règle « table entière » au report (§ 4.5) |
| Remboursements, grand livre, parrainage | **tel quel** | Clés d'idempotence existantes |
| Avis et règle de nuit | **tel quel** + 3 types nouveaux | § 4.8 |
| Plan de salle 11b (`FloorPlan.tsx`, `floor-geometry.ts`, règles de `venue_plan_set`) | **composant réutilisé**, écriture recopiée | Fonction neuve pour l'événement, même règle tout ou rien |
| `restaurant_tables`, `table_reservations`, `table_quote`, `table_reserve` | **non réutilisés** | § 2.3 |
| Réglages `tables.*` | **non réutilisés** | Ils règlent les restaurants (créneau, absence, acompte par personne) |
| **Neuf** | — | Table d'un événement (numéro, places, zone, position), lien table ↔ billets, jauge comptée en places, partage guidé, liste de la porte, écrans |

### c. Billets et jauge

**Une table vendue donne-t-elle l'entrée à ses N personnes ?** Recommandation : **oui**. Elle émet N billets d'entrée,
dont la catégorie « Table VIP — 6 places » est admise dans la zone VIP (`zone_categories`). Personne ne paie un billet
en plus. Sans cela, l'invité devrait acheter un billet ET avoir une place à table : double paiement et confusion à la
porte.

**Comment ne pas vendre plus d'entrées que la jauge ?**
1. À la configuration :
   - modifier le contrôle existant pour compter Σ (quota des billets) + Σ (tables × places) ≤ `events.capacity` ;
   - même code d'erreur `QUOTA_ABOVE_CAPACITY` et même message, en places
     (`M/20261121000008_cvf2b_consigne_controle.sql:262-272`) ;
   - à reprendre aussi dans la création d'une catégorie (`M/20261119000002_f2b_couleur_consigne.sql:111`).
2. À la vente : le stock des tables se compte en **tables** (une table = une unité). Le quota des billets ne bouge pas.
   La jauge est donc tenue par construction : chaque stock est plafonné et la somme des plafonds ≤ jauge.
3. Une jauge vide (`capacity` NULL) n'est pas contrôlée aujourd'hui. Recommandation : **jauge obligatoire dès qu'un
   type de table existe**.
4. « Complet » public (`public_event_state`, `M/20261102000006_lot5_temps_reel.sql:149`) : les tables ont leur propre
   état (« Plus que 2 tables », « Complet »). Les billets épuisés ne cachent pas les tables, et inversement.

### d. Risques d'argent et de sécurité

| # | Risque | Garde-fou existant | À créer |
|---|---|---|---|
| R1 | Double vente d'une même table | Verrou des catégories, attente, `payment_confirm` qui rembourse un paiement impossible à honorer | Attente sur la **table précise** (index unique partiel : une seule attente ou vente active par table) ; table relue sous verrou à la confirmation ; paiement tardif → remboursement entier |
| R2 | Montant calculé hors de la base | `finance_compute` en base ; la route n'envoie jamais de montant | Prix lu sur le type de table ; aucun montant ni nombre de places accepté du client |
| R3 | Remboursement en double | Clés `REFUND-<paiement>` et `REFUND-TKT-<billet>` ; plafond au reste ; `source_key` unique du grand livre | **Un paiement par table** ; remboursement de la table = `refund_request(paiement)` ; jamais billet par billet pour une table |
| R4 | Invités : données et accès | `guest_name` fermé à la REST ; transfert avec expiration ; transferts révoqués à l'annulation | Nom et numéro de l'invité visibles du titulaire et, pour la porte, du propriétaire et des contrôleurs (prénom et initiale) ; aucun accès REST |
| R5 | Revente | Transfert gratuit, QR tournant (une capture ne suffit pas), `security_version` | Rien de neuf. Une revente en espèces hors plateforme ne s'empêche pas ; le transfert garde la trace du porteur |
| R6 | Événement annulé | `event_cancel` rembourse les paiements `TICKET` | Rester en `TICKET` (sinon la table est oubliée : § 2.3) ; test : aucun paiement de table réussi sur un événement annulé sans remboursement |
| R7 | Événement reporté | Droit ouvert par billet si le début bouge de plus de 24 h | Règle **table entière** : le titulaire demande, tous les billets non utilisés sont annulés, la table est libérée ; refus si une place a déjà servi |
| R8 | Organisatrice suspendue | Cascade PUBLIE → SUSPENDU, ventes coupées, paiement tardif remboursé, soldes gelés | Écritures des tables d'événement derrière `partner_owner_suspended` et la garde des fiches (leçon du 11b, F1) |
| R9 | Prix ou places changés après une vente | Quota jamais sous le vendu (`QUOTA_BELOW_SOLD`) | Prix et places figés dès la première vente ; table vendue ou en attente impossible à supprimer ou renuméroter |
| R10 | Accaparement (attentes sans payer) | Plafond de 3 paiements en attente par numéro payeur, `max_per_order` | Au plus 2 tables par commande et par compte et événement (réglage) |
| R11 | Interrupteur partagé avec les restaurants | `features.tables_enabled` | Interrupteur propre `features.event_tables_enabled` (fermé) |
| R12 | Validation contournée | Catégories figées en attente ; ajout après validation signalé | Mêmes règles pour les types de tables |
| R13 | Versement trop tôt | Part de l'organisatrice disponible après l'événement, gelée si suspendue | Rien de neuf (cible `TICKET`) |
| R14 | Minimum de consommation | — | Texte d'information seulement, jamais un montant encaissé ni promis par Event Village (§55) |

---

## 4. Modèle proposé (défaut recommandé à chaque point)

### 4.1 Ce qu'est une table d'événement

- **Type de table** : nom (« Table VIP », « Carré Or »), places (2 à 20), **prix total de la table**, quantité, zone
  d'accès, couleur de scan, « ce qui est compris » (texte court, 3 lignes au plus, par exemple « 1 bouteille de
  champagne, 2 softs, accès carré VIP »).
  - Stockage : une ligne de `ticket_categories` avec `kind = 'TABLE'` et `seats_per_unit = N`. La fenêtre de vente,
    la validation, le stock public et le guichet sont ainsi repris.
- **Table** : numéro, type, position facultative sur le plan. Table neuve `event_tables` (`event_id`, `category_id`,
  `number`, colonnes du plan 11b). Le nombre de tables d'un type = sa quantité.
- **Défauts** :
  - prix **par table** (et non par personne) ;
  - ce qui est compris = texte d'information ;
  - **pas de minimum de consommation encaissé**, seulement affiché.
- **Zones** (VIP, carré, terrasse) : `event_zones` existe pour l'accès (`M/20261110000009_lot9ter_zones.sql:38`).
  Une zone d'accès sert aussi de zone de plan (rectangle coloré).
- **Plan de salle** : facultatif, comme en 11b (`floor_plan_enabled`). Sans plan, le client choisit un **type** et la
  table est attribuée (la plus petite libre, par numéro). Avec plan, il touche une table libre.

### 4.2 Paiement

- **En entier** (défaut). L'acompte (§54) ajoute un solde, une échéance, une relance et un remboursement partiel :
  c'est le modèle des salles (`halls.balance_due_days`, 10a), à faire plus tard si le client le demande.
- **Frais client 5 %** sur le prix de la table : réglage existant `finance.service_fee_rate`, comme les billets. Les
  frais restent cohérents sur une même fiche.
- **Commission 0 %** au lancement (§112 « gratuit au lancement »). Le moteur des billets n'a pas de commission ; en
  ajouter une est un petit lot à part, le jour où le client la fixe.
- **Délai pour payer** : `finance.payment_hold_minutes` (10 min), comme les billets ; table rendue à l'échéance.
- **Paiement sur place (§55)** : non au lancement. Une table « payée sur place » serait réservée sans argent engagé :
  accaparement facile.
- Une table se paie **seule** (un paiement = une table). Le panier mixte billets + table viendra plus tard.

### 4.3 Entrée

- **Un billet par invité** (défaut), pas un QR de groupe. Raisons :
  - les invités arrivent séparément ;
  - le scanner compte un passage par billet ;
  - le QR hors ligne est personnel ;
  - la jauge reste juste.
- Le titulaire reçoit les N billets. Sur « Mes billets », ils sont regroupés en **« Ma table »**, avec « Envoyer une
  place ».
- **Partage** :
  - on reprend le transfert existant (numéro de l'invité ; prénom facultatif pour la liste de la porte) ;
  - avis `TRANSFER_RECEIVED` à l'invité ;
  - lien WhatsApp préparé (texte et lien vers l'application, aucun jeton dans le lien) ;
  - une place non envoyée reste au titulaire, qui peut faire entrer ses invités avec lui (il montre deux QR) ;
  - **rappel facultatif au titulaire** la veille s'il reste des places non envoyées.
- **Scanner** : résultat habituel + badge « Table 12 · Carré VIP » et la consigne de la catégorie.

### 4.4 Annulation par le client

- **Pas d'annulation libre** (défaut), comme les billets. Une soirée se prépare (bouteilles, placement) et un
  remboursement tardif coûte à l'organisatrice.

### 4.5 Événement annulé, reporté ; organisatrice suspendue

- **Annulé** : remboursement entier (prix et frais) par `event_cancel`, sans code neuf si la vente reste en `TICKET`.
  Avis `EVENT_CANCELLED` au titulaire et aux invités (texte : « le titulaire est remboursé »).
- **Reporté de plus de 24 h** : le **titulaire** peut se faire rembourser **toute la table** jusqu'au nouveau début.
  Les billets non utilisés sont annulés, transferts compris ; l'argent va au compte qui a payé.
- **Suspendue** : comme les billets (vente coupée, paiement tardif remboursé, soldes gelés). Aucune création ni
  modification de table.

### 4.6 Côté organisatrice

**Création** : dans l'éditeur de billetterie, un onglet « Tables » à côté de « Billets ».
- Types de tables, numéros générés (1 à N, modifiables), plan facultatif (éditeur 11b).
- Contrôle de jauge en direct (« 180 places sur 200 : 120 en billets, 60 en tables »).

**Ventes en temps réel** : tableau « Tables » du pilotage.
- Vendues, en attente, libres ; places envoyées ou non ; recette.
- Même relecture que le pilotage actuel (règle R49, « Mis à jour à… »).

**Liste de la porte** :
- table, titulaire (prénom et initiale), places entrées / N, prénoms des invités ;
- recherche par numéro de table ;
- export ou impression pour un contrôle sans réseau ;
- réservée à la propriétaire et à ses contrôleurs.

### 4.7 Scanner et administration

- **Scanner** : aucun circuit neuf (billets). Badge de table, compteur « 3/6 entrés » pour la table.
- **Administration** :
  - **validation avec l'événement** (défaut), comme les catégories : types figés en attente, ajout après validation
    signalé ;
  - fiche de l'événement à l'administration : tables vendues et remboursements ;
  - pas de file de validation à part.

### 4.8 Avis (4 canaux, règle de nuit de la finition 4)

| Moment | Destinataire | Type | Nuit |
|---|---|---|---|
| Table payée | titulaire | **neuf** `EVENT_TABLE_CONFIRMED` (« Table 12 réservée, 6 places, envoyez-les à vos invités ») | tout de suite (comme `PURCHASE_CONFIRMED`) |
| Place reçue | invité | `TRANSFER_RECEIVED` existant (texte « place à la table 12 de … ») | existant |
| Table vendue | organisatrice | **neuf** `EVENT_TABLE_SOLD`, groupé comme `notif_sale_recorded` | reporté (DEFER) ; l'exception « moins de 12 h » s'applique |
| Places non envoyées, la veille | titulaire | **neuf** `EVENT_TABLE_SEATS_REMINDER` (facultatif) | reporté |
| Rappel du jour | titulaire et invités | `REMINDER_J1` existant | existant |
| Paiement tardif remboursé, annulation, report, remboursement versé | titulaire | types existants des billets | existants |

Contraintes : tous les SMS en GSM-7 et 155 caractères au plus (règle `l11b-cv-sms-marge`), sans mot technique. L'avis
mène à « Ma table ».

---

## 5. Découpage proposé

| Lot | Contenu | Taille |
|---|---|---|
| **11c-a — argent et sécurité** | `kind`/`seats_per_unit` sur les catégories, `event_tables`, interrupteur propre ; jauge en places (création et modification) ; attente et vente d'une table précise dans `checkout_create_payment` et `payment_confirm` (N billets reliés à la table) ; règle « table entière » au report ; gardes (suspension, prix figé, table vendue non supprimable, limites) ; écriture du plan tout ou rien ; validation avec l'événement ; 3 types d'avis ; invariants (places vendues ≤ jauge, une vente active par table, aucun paiement de table sur événement annulé sans remboursement) ; recopies de fonctions vérifiées ligne à ligne (`migration-lot11c-rejouable`) ; test `edition-services` modifié et signalé. **Contre-vérification indépendante ensuite.** | **gros** |
| **11c-b — écrans du client** | Onglet « Tables » de la fiche, plan au toucher ou choix du type, devis de la base, paiement, confirmation, « Ma table » dans Mes billets, partage par numéro et WhatsApp, report. Captures téléphone et ordinateur, clair et sombre ; mesure mobile ≥ 90 sur la fiche événement. | **moyen** |
| **11c-c — organisatrice, porte, administration** | Onglet « Tables » de l'éditeur (types, numéros, plan 11b), contrôle de jauge en direct, tableau des ventes, liste de la porte (recherche, impression), badge du scanner, vue de l'administration. | **moyen** |

**Ordre** : 11c-a → contre-vérification → correctifs → 11c-b et 11c-c (parallélisables, fichiers distincts sauf
`app/events/[id]/page.tsx`).

---

## 6. Questions au client (mots simples, réponse recommandée)

1. **Prix** : un prix pour toute la table, ou un prix par personne ?
   → *Recommandé : un prix pour toute la table (ex. « Table VIP 6 places : 150 000 F »).*
2. **Ce qui est compris** : les bouteilles sont-elles comprises dans le prix, ou faut-il un « minimum de
   consommation » à payer sur place ?
   → *Recommandé : tout est compris dans le prix payé en ligne ; un minimum sur place est seulement écrit sur la
   fiche, Event Village ne l'encaisse pas.*
3. **Paiement** : tout payer en ligne tout de suite, ou une avance puis le reste plus tard ?
   → *Recommandé : tout payer tout de suite (l'avance pourra venir plus tard).*
4. **Entrée** : chaque invité reçoit son propre billet sur son téléphone, ou le client entre avec tout son groupe sur
   un seul code ?
   → *Recommandé : un billet par invité, envoyé par le client à ses amis avec leur numéro (ou par WhatsApp).*
5. **Annulation** : le client peut-il annuler sa table et être remboursé ?
   → *Recommandé : non, comme les billets ; remboursement complet si la soirée est annulée, ou reportée de plus de
   24 h (toute la table).*
6. **Choix de la table** : le client choisit sa table précise sur un plan, ou seulement le type de table ?
   → *Recommandé : au choix de l'organisatrice ; sans plan, le client choisit le type et reçoit un numéro.*
7. **Argent d'Event Village** : faut-il prendre une commission sur les tables, en plus des frais de 5 % payés par le
   client ?
   → *Recommandé : aucune commission au lancement, 5 % de frais pour le client, comme pour les billets.*
8. **Vérification** : Event Village vérifie-t-il les tables en même temps que la soirée, avant la mise en vente ?
   → *Recommandé : oui, en même temps que l'événement ; toute table ajoutée après est signalée à l'équipe.*

---

## 7. Expérience et beauté (propositions, non codées)

Charte : `docs/design/direction.md` (orange de marque, un seul grand bouton en dégradé par page, couleur jamais seule
porteuse d'information, frais affichés avant le paiement, aucune promesse fausse).

**Sur la fiche d'un événement**

- **Bascule « Billets | Tables »** en haut du bloc d'achat. Une ligne par type de table : nom, « 6 places »,
  prix total, puis « soit 25 000 F par personne » en petit, ce qui est compris, places restantes vraies (« Plus que
  2 tables », jamais inventé).
- **Plan au toucher** : zones en aplats teintés (VIP, carré, terrasse) avec leur nom écrit, tables numérotées.
  - Les états se lisent sans la couleur : libre = contour plein, prise = hachurée et « Prise », la mienne = coche.
  - Pincer pour zoomer sur téléphone ; survol avec prix et places sur ordinateur ; flèches au clavier (déjà dans
    `FloorPlan`).
  - Le plan se relit toutes les 20 s ; une table prise pendant qu'on regarde se grise avec une courte animation et un
    message « La table 7 vient d'être prise ».
- **Feuille de choix** : sur téléphone, feuille glissante du bas ; sur ordinateur, panneau collant à droite du plan.
  - Contenu : numéro, zone, places, compris, devis de la base (prix + frais = total).
  - Un seul grand bouton « Réserver la table 12 ».
- **Compte à rebours** de l'attente de paiement (« Table gardée 9:42 ») : discret, en tête du paiement. À 1 minute,
  il passe en avertissement, avec texte et icône.

**Après le paiement**

- **Confirmation** : coche animée, carte de la table, puis tout de suite « Envoyez vos 5 places ».
- **« Ma table »** dans Mes billets :
  - une carte par table, avec une rangée de 6 avatars (soi + invités) ; les places non envoyées sont en pointillé
    avec « + Inviter » ;
  - partage par numéro (carnet du téléphone si le navigateur le permet) ou **WhatsApp** (message prêt : « Je t'invite
    à la table 12 de “Nuit Blanche”, samedi 22 h. Ta place : … ») ;
  - compteur « 4/6 places envoyées », puis « 2/6 entrés » le soir même.
- **Jour J** :
  - rappel la veille et, s'il reste des places non envoyées, rappel au titulaire ;
  - le matin, accès rapide au QR depuis l'avis ;
  - QR lisible hors ligne (déjà en place).

**Organisatrice**

- Éditeur de plan avec gabarits (« 10 tables rondes en 2 rangées »), copie d'un événement précédent, aperçu
  « vue client » sur téléphone et ordinateur.
- Tableau des ventes : plan coloré par état et liste triable.
- Liste de la porte en gros caractères, recherche par numéro, version imprimable.

**Accessibilité** :
- noms accessibles « Table 12, 6 places, libre » (leçon du run 549 du 11b) ;
- cibles de 44 px ;
- animations coupées si le téléphone le demande.

---

## 8. Points ouverts pour le prompt de construction

- Le nom en base doit éviter la confusion avec les tables des établissements (`event_tables` et non
  `restaurant_tables` ; types d'avis préfixés `EVENT_TABLE_`).
- Le rapport 11a (`docs/lot11a-rapport.md:81-83`) et le commentaire de `M/20261123000102_l11a_etablissements.sql:25-27`
  décrivent un modèle qui oublie l'annulation et le report (§ 2.3). À corriger dans le rapport du lot 11c.
- Panier mixte billets + table, acompte, commission, paiement sur place : hors 11c, à reprendre sur demande du client.
