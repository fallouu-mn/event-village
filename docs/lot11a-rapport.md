# Lot 11a — Tables : argent et sécurité

Branche `lot11a/tables-argent`, partie de `lot10a/salles-argent` à `11cc55a10` (décision : la 10a sera fusionnée avant la 11a ; les recopies de fonctions communes gardent ainsi les ajouts des salles). Avant le run complet final : `main` (`c011e2cb8`) et la 10a corrigée (`182a7d914`, contre-vérification T1 à T6) fusionnées dans la branche. Non fusionnée dans main. Aucun écran : le service reste fermé par son interrupteur (`features.tables_enabled`). Migrations `20261123000101` à `…109` (les numéros `20261123000001…` sont pris par la design 1b), sans BEGIN ni COMMIT, rejouables, non appliquées sur event-village-dev.

## À lire en premier : failles trouvées et corrigées

Chacune a un test rouge d'abord (run 380, 0/5, typage compris ; F9 : run 388 ; F10 à F13 : runs 395 et 397), puis vert.

| # | Faille | Correctif | Test |
|---|---|---|---|
| F1 | La route prenait la **première table venue**, même trop petite ou déjà prise ; une réservation pouvait n'avoir **aucune table** et échappait alors à la règle anti-chevauchement (T1). Supprimer une table mettait aussi ses réservations « sans table ». | Une seule fonction en base, `table_reserve` (plus petite table libre qui convient, verrou de l'établissement, contrainte d'exclusion) ; contrainte : une réservation qui tient une table a toujours une table ; une table réservée ne se supprime plus. | `l11a-tables` A |
| F2 | Une table envoyée par le client n'était vérifiée ni pour son partenaire ni pour sa capacité (T2). **Nouvelle** : une partenaire pouvait créer une table dans la zone **d'une autre partenaire** (clé étrangère seule). | Table et zone de cet établissement seulement, capacité de la table ; déclencheur : établissement de la même partenaire, zone du même établissement. | `l11a-tables` A |
| F3 | Acompte fixé à **5 000 F par personne en dur**, calculé par la route ; le paiement lisait ce montant sur la ligne écrite par la route (T3). | Acompte par personne réglé par l'établissement, frais 5 % : calculés et relus en base (`table_payment_create`). | `l11a-tables` A, B |
| F4 | Un paiement **sur place** était marqué « payé » (SUCCESS), comme un encaissement (T4). | Enregistré sur la réservation seulement (`table_onsite_payment_record`) : jamais une ligne de paiement, jamais une écriture au grand livre ; anciennes lignes remises en attente. | `l11a-tables` B, invariant t6 |
| F5 | Aucune expiration : une demande non payée bloquait sa table **indéfiniment** (T5) ; créneau de 2 h en dur ; ni date passée ni horaires contrôlés (T6). | Attente de 15 min, réponse sous 2 h, absence à 30 min : tâche `ev_tables` toutes les 5 minutes ; créneau par établissement ; horaires par jour, plages de nuit comprises. | `l11a-tables` A, `l11a-annulation` C4, C5 |
| F6 | La partenaire écrivait **n'importe quel statut** (confirmée sans paiement, terminée) ; la modération et la confirmation de paiement écrivaient l'état directement, sans verrou ni journal ; un échec de paiement annulait la réservation (C1, C2). | Garde en base : état, argent, table, date, personnes ne changent que par les fonctions du lot (verrou de l'établissement, journal `audit_logs`) ; toute autre écriture est refusée, même avec la clé de service. | `l11a-tables` A, B |
| F7 | **Nouvelle.** La route publique d'un restaurant prenait la **première partenaire venue** quand le nom ne correspondait pas, et inventait des zones d'exemple ; toutes les tables actives étaient lisibles par tous, sans validation. | Lecture par établissement, actif et validé seulement (REST et route). | `r31-tables-lecture`, `interrupteurs` |
| F8 | **Nouvelle.** `POST /api/partner/tables/reservations` créait une réservation par `create_table_reservation_atomic`, sans contrôle d'établissement, d'heure ni d'argent ; la suppression d'une réservation par la partenaire était aussi ouverte au client, sans aucun remboursement. | Route et fonction retirées ; annulation par `table_reservation_cancel` (client, établissement, Event Village), remboursement par le moteur financier. | `l11a-tables` A, `l11a-annulation` |
| F9 | **Nouvelle.** Une partenaire **suspendue** créait zones et tables (une fiche en attente était déjà refusée par la garde des fiches, 403). | Une zone ou une table appartient à un établissement, que seule une fiche VALIDE crée. | `l11a-tables` (création par la route) |
| F10 | **Équivalent du T1 de la contre-vérification de la 10a.** Routes partenaire des tables : vérifiées, déjà limitées à la fiche de la session (aucun trou, test de preuve). Mais `GET /api/restaurants/[id]/menu` prenait **la première partenaire venue** pour un identifiant inconnu, et servait les produits d'une fiche en attente. | Fiche VALIDE seulement, jamais de repli (404). | `l11a-tables` (routes) |
| F11 | **Équivalent du T2.** Payer une demande dont l'attente était échue la **reprenait sans refaire les contrôles** (établissement suspendu, table retirée, horaires changés) ; un paiement confirmé après la suspension de l'établissement était accepté. | `table_hold_refusal` : tous les contrôles de la réservation refaits à la création du paiement et à sa confirmation ; sinon refus, ou remboursement en entier. | `l11a-tables` (relance) |
| F12 | **Équivalent du T5.** Le nombre de demandes en attente se comptait sans verrou par client : deux demandes simultanées dans deux établissements passaient la limite ; une attente relancée ne la comptait pas. | Verrou par client avant de compter, à la réservation et à la relance. | `l11a-tables` (T5, T2) |
| F13 | **Équivalent du T6.** Avec une commission sur l'acompte (réglage, 0 % au lancement), l'invariant (d) et les relevés de l'administration la comptaient pour les salles seulement. | Migration 109 : relevés et invariant étendus aux tables. | `l11a-tables` (T6) |

Lecture des réservations (C3) : déjà limitée au client, à la partenaire propriétaire et à l'admin avec son code ; vérifiée par `r31`, et toute écriture REST est maintenant refusée (droits retirés).

## Formules (en base), avec un exemple

Exemple : acompte de 5 000 F par personne, 4 personnes, frais de service 5 %, Wave 1,5 %, commission 0 %.

| Montant | Formule | Exemple |
|---|---|---|
| Acompte | acompte par personne × personnes (gratuit si l'établissement n'en demande pas) | 20 000 |
| Frais de service (client) | arrondi au franc supérieur (acompte × 5 %) | 1 000 |
| À payer | acompte + frais | **21 000** |
| Frais Wave | 21 000 × 1,5 %, à la charge d'Event Village (§78) | 315 |
| Part de l'établissement | acompte − commission (0 %) | 20 000 |
| Revenu net d'Event Village | frais + commission − frais Wave | 685 |

Arrondi : 1 234 F × 3 = 3 702, frais 185,1 → 186, à payer 3 888. La part de l'établissement va au grand livre, disponible 48 h après la **fin du créneau** ; la commission de parrainage suit la même règle (§82).

## Règles

| Situation | Résultat |
|---|---|
| Confirmation automatique, table libre | confirmée tout de suite (gratuite) ou au paiement de l'acompte |
| Acceptation manuelle | « En attente de réponse » ; sans réponse sous 2 h (jamais après l'heure) : annulée, tout rendu |
| Acompte non payé en 15 min | « Non payée à temps », table rendue ; un paiement arrivé après est remboursé en entier |
| Client annule au moins 2 h avant | tout rendu (acompte et frais) |
| Client annule moins de 2 h avant | rien rendu, l'établissement garde l'acompte |
| Établissement, Event Village, refus | tout rendu (motif obligatoire) |
| Client absent 30 min après l'heure | « Absent », table libérée, acompte gardé ; l'établissement peut aussi le marquer après l'heure |
| 3 demandes en attente | la 4e est refusée |
| Paiement sur place | enregistré sur la réservation, jamais compté |

Créneau : 2 h par défaut, 30 à 360 min par quart d'heure au choix de l'établissement. Heure au quart d'heure, 1 à 50 personnes, 90 jours au plus. Le créneau entier doit être dans les horaires (plages réunies d'un jour à l'autre : 19:00-02:00 accepte 23:30-01:30).

## États d'une réservation

| État en base | Ce que voient les gens | Tient la table |
|---|---|---|
| EN_ATTENTE_PAIEMENT | En attente de paiement | oui (15 min) |
| EN_ATTENTE_ACCEPTATION | En attente de réponse de l'établissement | oui (2 h) |
| CONFIRMEE | Confirmée | oui |
| ARRIVEE | Client arrivé | oui |
| ABSENT | Absent | non |
| EXPIREE | Non payée à temps | non |
| SANS_REPONSE | Sans réponse de l'établissement | non |
| REFUSEE | Refusée par l'établissement | non |
| ANNULEE_CLIENT / _ETABLISSEMENT / _EV | Annulée par le client / l'établissement / Event Village | non |

## Messages

Chaque étape prévient la bonne personne sur les quatre canaux (cloche, push, email, SMS d'un segment GSM-7), sans mot technique :
- client : table réservée, demande envoyée, demande refusée, sans réponse, acompte non payé à temps, annulation, absence, paiement remboursé, rappel 3 h avant ;
- établissement : nouvelle réservation, demande à accepter, annulation, décision sur l'établissement ;
- administrateurs : établissement à valider (cloche, push, email ; SMS groupé existant, reporté à 8 h la nuit).

Remboursement versé : avis existant « Remboursement versé ». Règles existantes gardées : les SMS indispensables partent tout de suite ; le rappel est optionnel (préférences, plafond, pas de SMS la nuit).

## Modèle pour les tables d'un événement (lot 11c)

Une zone ou une table portera `event_id`, exclusif de `venue_id`, et un prix par table. La réservation garde sa table, son créneau et la même contrainte d'exclusion : rien à refaire dans les fonctions d'argent.

## Migrations

| Fichier | Contenu |
|---|---|
| `…101_l11a_reglages` | 10 réglages `tables.*` ; recopies de `finance_setting_set`, `fin_setting_valid`, `platform_settings_defaults` |
| `…102_l11a_etablissements` | `venues` (validation, position, créneau, acompte, confirmation), horaires, zones et tables rattachées, lecture |
| `…103_l11a_reservations_schema` | état détaillé, créneau, garde des écritures, exclusion, reprise des anciennes lignes ; suppression de `create_table_reservation_atomic` |
| `…104_l11a_reserver` | `table_reserve`, `venue_hours_set`, avis |
| `…105_l11a_paiement` | `table_payment_create`, `table_payment_confirm` ; recopies de `fin_payout_available_at`, `calculate_referral_commissions` |
| `…106_l11a_annulation` | annuler, répondre, présence, paiement sur place, tâche ; recopie de `notif_cashouts_notify` |
| `…107_l11a_validation` | `venue_validation_decide`, avis aux administrateurs ; recopie de `notif_admin_review_sms` |
| `…108_l11a_messages` | 14 types d'avis ; avis générique sans les tables |
| `…109_l11a_releves` | commission des tables dans les relevés ; recopies de `finance_admin_earned`, `finance_admin_payments` |

Un test (`migration-lot11a-rejouable`) vérifie qu'aucune recopie ne perd une ligne de la définition précédente : il deviendra rouge si la 10a change ces fonctions sans que la 11a soit recopiée.

## Mise en service (event-village-dev)

1. Appliquer d'abord les migrations de la 10a (`20261122000001` à `…12`).
2. Planifier la nouvelle tâche : rejouer `supabase/ops/schedule-crons.sql` (10 tâches, dont `ev_tables`).

```sql
-- Avant
-- A. Dernière migration : 20261122000012 (lot 10a corrigé)
select max(version) from supabase_migrations.schema_migrations;
-- B. Rien du lot : 0, 0
select count(*) from pg_proc where pronamespace = 'public'::regnamespace and (proname like 'table\_%' or proname like 'venue\_%');
select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'venues';
-- C. À noter : tables, réservations existantes (reprises : closes une fois), recouvrements des anciennes « terminées »
select (select count(*) from public.restaurant_tables), (select count(*) from public.table_reservations),
       (select count(*) from public.table_reservations a join public.table_reservations b
          on b.table_id = a.table_id and b.id > a.id and a.status::text = 'TERMINEE' and b.status::text = 'TERMINEE'
         and tsrange(a.reservation_date + a.reservation_time, a.reservation_date + a.reservation_time + interval '2 hours')
          && tsrange(b.reservation_date + b.reservation_time, b.reservation_date + b.reservation_time + interval '2 hours'));

-- Après
-- A. Neuf versions 20261123000101 à …109
select version from supabase_migrations.schema_migrations where version like '20261123%' order by 1;
-- B. Fonctions du lot réservées au rôle de service : anon false, authenticated false
select p.proname, has_function_privilege('anon', p.oid, 'execute'), has_function_privilege('authenticated', p.oid, 'execute')
  from pg_proc p where p.pronamespace = 'public'::regnamespace and (p.proname like 'table\_%' or p.proname like 'venue\_%') order by 1;
-- C. 10 réglages tables.*
select key, value from public.platform_settings where key like 'tables.%' order by 1;
-- D. Réservations reprises, garde et exclusion présentes : états ; true, true, false
select booking_state, status, count(*) from public.table_reservations group by 1, 2;
select exists (select 1 from pg_trigger where tgname = 'trg_0_table_reservations_guard'),
       exists (select 1 from pg_constraint where conname = 'no_overlapping_table_slots'),
       exists (select 1 from pg_constraint where conname = 'no_overlapping_table_reservations');
-- E. RLS des nouvelles tables : true, true
select relname, relrowsecurity from pg_class where relname in ('venues', 'venue_opening_hours');
-- F. 14 types d'avis
select type, channels from public.notification_types where type like 'TABLE\_%' or type like '%VENUE\_%' order by 1;
```

Puis `03-verification.sql`.

## Tests existants modifiés (signalés)

| Test | Modification | Pourquoi |
|---|---|---|
| `acces-securite-urgente`, `dette-publication-reservations`, `securite-ecritures-services-9ter`, `r25-commandes-idor` | table rattachée à un établissement ; réservation préparée par l'aide `tests/helpers/table-fixtures.ts` (écriture locale avec le drapeau des fonctions en base) | garde des écritures (F6), établissements |
| `finance-cibles` | idem ; après un échec de paiement, la réservation reste en attente (au lieu d'annulée) | F6, comme les salles |
| `interrupteurs` | établissement validé ; route publique par établissement ; POST partenaire retiré ; routes des établissements ajoutées à la liste | F7, F8 |
| `r3-fonctions-rpc` | `create_table_reservation_atomic` retirée ; 20 fonctions du lot ajoutées | fonction supprimée |
| `migration-lot10a-rejouable` | « après toutes les autres » devient « après toutes celles d'avant » | migrations du lot suivant |
| `notif-modeles`, `notif-outbox`, `notif-migration` | 14 types (registre, textes exacts, émetteurs), SMS groupé avec les établissements | messages |
| `planification-crons`, `essai-cron-local` | tâche `ev_tables` ajoutée (minute 3 : la minute 4 est vérifiée par `essai-cron-local`) | F5 |
| `f2acv-ecritures-fiche` | inventaire des écritures partenaire : POST des réservations retiré, routes des établissements ajoutées | F8, F9 |
| `tests/helpers/finance-invariants.ts` (règles e et d) | un paiement de table impossible à honorer (`refund_reason`) est remboursé sans vente, comme pour les salles ; la commission d'une table est comptée comme celle d'une salle | paiement arrivé trop tard, F13 |
| `scripts/run-tests.mjs` (lanceur, pas un test) | `--list` écrit la liste d'un bloc et sort après l'écriture | run 389 : liste tronquée à 400 lignes sur 507, lot 4 arrêté |
| `app/admin/finance-settings/page.tsx`, `components/admin/finance/EarnedDetail.tsx` | anciens noms de couleur remplacés par leurs équivalents exacts de la charte | contrôle du design 1a sur les fichiers modifiés |
| `docs/recette-billetterie.md` | quatre lignes citées recalées (acces-securite-urgente 211 → 216 et 228 → 233, interrupteurs 362 → 378, notif-modeles 518 → 535) | contrôle `recette-matrice` |

## Runs

| Run | Commit | Mode | Résultat |
|---|---|---|---|
| 380 | `7bcba06a9` | rapide, tests seuls | rouge voulu : 0/5, typage rouge (modules absents) |
| 384 | `e921cc900` | rapide, 35 suites | 8/35 : le déclencheur des zones lisait un champ propre aux tables ; un paiement de table remboursé sans vente comptait comme vente manquante (invariant global, d'où les autres suites) ; tâche à la minute 4 ; rappel hors de sa fenêtre selon l'heure |
| 386 | `c7ad76401` | rapide, 36 suites | 32/36 : l'aide de préparation des réservations (paramètres SQL non typés) |
| 387 | `709ad7d20` | rapide, 6 suites | **vert, 6/6** (avec 386 : les 36 suites du lot vertes) |
| 388 | `517a04697` | rapide, 2 suites | rouge voulu : création d'un établissement par une fiche non validée (F9) |
| 389 | `2a6bdee43` | complet | 365/366 exécutées ; rouge : mon test F9 attendait mon propre refus pour une fiche en attente (la garde existante répondait déjà 403) et lisait la boîte d'envoi sans filtre (limite de 1 000 lignes) ; lot 4 non exécuté (liste des suites tronquée par le lanceur) |
| 395 | `81cb2e377` | rapide, 1 suite | rouge voulu : F10 (menu) et F11 (relance) ; routes partenaire vertes (aucun trou) |
| 397 | `7be7be551` | rapide, 3 suites | rouge voulu : F12 et F13 ; F10, F11 verts ; lint rouge (anciens noms de couleur, contrôle venu de main) |
| 398, 399 | `37716a37c`, `a1613410f` | rapide, 18 et 5 suites | 17/18 (l'aide de préparation n'avait ni horaires ni validation, désormais exigés au paiement), puis **vert 5/5** |
| 400 | `ac9d87038` | **complet** | **vert : 507/507 en 39 min 9 s**, 4 lots contrôlés (507 attendues, 507 exécutées), suites d'audit dont cv10a, e2e, captures, budgets JS ; invariants à 0 |

## Points ouverts (lot 11b et suivants)

- Écrans : recherche, fiche, plan de salle, réservation, paiement, espace de l'établissement, validation dans l'administration, carte ; l'ancienne page `/restaurants/[id]/tables` ne correspond plus aux routes (service fermé).
- Validation des établissements avec le droit `partners.validate`, comme les salles (droit propre à décider en 10b).
- Fermetures exceptionnelles (jours fériés, congés) : non prévues.
- Les SMS optionnels (rappel) ne partent pas la nuit : la règle existante les **saute**, elle ne les reporte pas à 8 h (seul le SMS groupé des administrateurs est reporté).
- Une absence marquée par erreur ne se corrige pas encore (à prévoir avec l'écran de l'établissement).
- Supprimer une zone utilisée par des réservations est refusé par la garde (message générique) : à proposer comme « désactiver » à l'écran.

## Correctifs de la contre-vérification

Contre-vérification : `docs/audit-lot11a.md` (branche `audit/lot11a`, `1c4ad9b27`), fusionnée dans cette branche (`5476147f7`), puis main à jour (`4e043098b`, fusion `da51d1a35`). Ses suites `tests/audit/cv11a-1` à `-5` sont les tests rouges, **assertions inchangées**. Migrations `20261123000110` à `…113`, sans BEGIN ni COMMIT, rejouables ; chaque fonction recopiée part de sa dernière définition (fichier et lignes cités en tête de migration).

| # | Trou (gravité) | Correctif | Commit |
|---|---|---|---|
| T1 | Attente reprise ou prolongée de 15 min par un paiement refusé (plafond du numéro payeur) (moyenne) | `table_payment_create` : le plafond de 3 paiements en attente par numéro est contrôlé **avant** de reprendre ou de prolonger l'attente ; après lui, plus aucun refus (migration 110) | `96912febb` |
| T2 | Réservations gratuites sans limite : 6 tables sur 6 pour un compte (moyenne) | Au plus `tables.max_pending_per_client` (3) réservations **à venir non payées** par client : attente de paiement en cours, demande sans acompte payé en attente de réponse, gratuite confirmée dont l'heure n'est pas passée (`table_client_unpaid_refusal`) ; **une seule table par client et par créneau** dans un établissement (`table_client_slot_refusal`, « Vous avez déjà une table dans cet établissement à cette heure-là. ») ; sous le verrou par client, à la réservation et à la relance d'une attente échue (migration 111) | `1a9eabf0c` |
| T3 | Demande payée jamais acceptée, annulée à moins de 2 h : 0 F rendu (moyenne) | Une demande « En attente de réponse » annulée par le client est remboursée **en entier**, quelle que soit l'heure ; la règle des 2 h ne vaut que pour une réservation confirmée (migration 112) | `217a8e8f5` |
| T4 | Remboursement promis alors qu'il est déjà impossible (faible) | `tableCancellationText` reçoit l'heure de la réservation : à moins de 2 h, « Réservation à moins de 2 h de l'heure : si vous annulez, l'acompte payé ne sera pas remboursé. » | `b206740b0` |
| T5 | Acceptation par un établissement ou une partenaire suspendus (faible) | `table_reservation_respond` : l'acceptation refait les contrôles de `table_reserve` (établissement actif et validé, partenaire VALIDE) ; sinon demande refusée (par le système), client remboursé en entier, avis du refus ; route : 409 (migration 113) | `254bb13e3` |
| T6 | Menu par nom partiel (faible) | `GET /api/restaurants/[id]/menu` : identifiant exact d'une partenaire VALIDE seulement ; tout nom (complet, partiel, « rest-<nom> ») : 404 ; panne de lecture : 500 au lieu d'un 404 muet. Aucune colonne d'identifiant public (slug) n'existe | `0b5b334da` |
| T7 | Les 22 réglages `halls.*` et `tables.*` refusés par la route du SUPERADMIN (moyenne) | `PUT /api/admin/finance-settings` accepte `halls.*` et `tables.*` ; validation inchangée (`finance_setting_set` → `fin_setting_valid`) | `bf167b0fe` |
| Constat | `DELETE /api/partner/tables/[id]` sur la table d'une autre : 200 sans rien supprimer | 404 « Table introuvable. » (« Zone introuvable. » avec `?type=zone`) quand aucune ligne n'est supprimée | `81e1dd810` |

### Choix à connaître

- T2 : une demande dont l'acompte est **payé** et qui attend la réponse de l'établissement **n'est plus comptée** dans la limite (de l'argent est engagé ; avant, toute demande en attente l'était). Le message des demandes en attente est inchangé ; dès qu'une gratuite confirmée est comptée : « Vous avez déjà 3 réservations à venir sans acompte payé. Annulez-en une pour réserver une autre table. » Libellé du réglage : « Réservations non payées au plus par client » (page des réglages, catalogue).
- T4 : le texte est calculé au moment de la réservation ; un client qui réserve à 2 h 05 et paie 10 minutes plus tard lit encore la règle des 2 h (la règle appliquée à l'annulation, elle, reste exacte).

### Tests ajoutés et modifiés (signalés)

| Test | Modification | Pourquoi |
|---|---|---|
| `tests/parcours/l11a-cv-correctifs.test.ts` (nouvelle) | 13 tests : T2 (créneau, limite, annulée ou passée, demande payée, relance, demandes simultanées), T3, T5, T6, T7 (les 22 réglages : même valeur 200, hors bornes 400 et valeur inchangée), constat | autour de chaque correctif |
| `tests/parcours/l11a-cv-correctifs.test.ts` | T2 relance : l'attente non reprise se prouve par son **échéance** restée passée, pas par son état (`7403c5079`) | défaut de **mon** test au run 410 : attente échue jamais passée par la tâche, donc encore « En attente de paiement » ; le refus 429 était vérifié juste avant |
| `tests/parcours/l11a-helpers.ts` (`releasePending`) | clôt aussi les réservations gratuites confirmées du client (« Annulée par le client ») | `l11a-tables` partage un client entre ses tests : la nouvelle limite aurait refusé ses réservations à partir du 4e test |
| `tests/schema/l11a-textes.test.ts` | test ajouté : texte d'annulation avec l'heure (moins de 2 h, 2 h pile, 3 h réglées, sans acompte, date illisible) | T4 |
| `tests/schema/migration-lot11a-rejouable.test.ts` | migrations 110 à 113 ajoutées à la liste | liste exacte des migrations du lot |
| `tests/security/r3-fonctions-rpc.test.ts` | `table_client_unpaid_refusal`, `table_client_slot_refusal` ajoutées (réservées au rôle de service) | fonctions nouvelles |

Aucune assertion de `tests/audit/cv11a-*` n'a changé.

### Runs

| Run | Commit | Mode | Résultat |
|---|---|---|---|
| 410 | `2595ceee6` | rapide, 62 suites (52 d'audit dont cv11a-1 à 5, et les suites du lot touchées) | 61/62 : **les 5 suites cv11a vertes** ; seul rouge, mon test T2 relance (voir ci-dessus) ; typecheck et lint verts |
| 412 | `7403c5079` | rapide, `l11a-cv-correctifs` | **vert, 13/13** |
| 413 | `a2c926b35` | **complet** | **vert : 513/513** (4 lots, 513 attendues, 513 exécutées), build, budgets JS, e2e (connexion, captures, courriels, fumée, terrain, PWA, déconnexion, recette, perf) ; 39 min 36 s |

Run 413, sorties brutes des anciens trous :

```
[CV11A] 2.3c : {"relances":[{"http":429,"code":"PAYER_PENDING_LIMIT","payment":false,"state":"EXPIREE","hold":null},{"http":429,"code":"PAYER_PENDING_LIMIT","payment":false,"state":"EXPIREE","hold":null},{"http":429,"code":"PAYER_PENDING_LIMIT","payment":false,"state":"EXPIREE","hold":null}],"paiementsDeLaReservation":0,"rival":"OK"}
[CV11A] 2.3d : {"http":429,"code":"PAYER_PENDING_LIMIT","before":"2026-11-18T17:54:51.31084+00:00","after":"2026-11-18T17:54:51.31084+00:00","gainedMin":0,"payment":false}
[CV11A] 2.3e : {"replies":["OK","CLIENT_SLOT_TAKEN","CLIENT_SLOT_TAKEN","CLIENT_SLOT_TAKEN","CLIENT_SLOT_TAKEN","CLIENT_SLOT_TAKEN"],"held":["CONFIRMEE"],"rival":"OK"}
[CV11A] 3.3b : {"avant":"EN_ATTENTE_ACCEPTATION","http":200,"message":"Réservation annulée. Vous êtes remboursé de 21 000 F CFA sur votre compte de paiement.","state":"ANNULEE_CLIENT","paid":21000,"rendu":21000}
[CV11A] 3.3c : {"cancellation":"Réservation à moins de 2 h de l’heure : si vous annulez, l’acompte payé ne sera pas remboursé."}
[CV11A] 4.6a : {"accept":"HTTP 409 {\"error\":\"Cet établissement n’accepte plus de réservation pour le moment : la demande est refusée et le client remboursé en entier.\",\"code\":\"VENUE_NOT_AVAILABLE\"}","state":"REFUSEE"}
[CV11A] 4.6b : {"accept":"HTTP 409 {\"error\":\"Cet établissement n’accepte plus de réservation pour le moment : la demande est refusée et le client remboursé en entier.\",\"code\":\"VENUE_NOT_AVAILABLE\"}","state":"REFUSEE"}
[CV11A] 4.7b : {"partial":"404 ","fragment":"404 "}
[CV11A] 5.2b : {"halls.balance_due_days":200,"halls.cancel_moderee_full_days":200, … 22 réglages halls.* et tables.* : 200}
[INVARIANT-LOT11A] cv11a-2-reservation — (t1)(t2)(t3)(t4)(t5)(t6) : 0 violation(s)
TOTAL : 513 suite(s) — 513 réussie(s), 0 en échec, 0 expirée(s)
[ci-lots] contrôle : 513 suite(s) attendue(s) (run-tests.mjs --list), 513 exécutée(s) dans 4 lot(s)
[e2e] résumé :connexion OK · captures OK · emails OK · dev-page OK · fumee OK · terrain OK · pwa OK · deconnexion OK · fake-prod OK · perf OK · recette OK
```

Journaux bruts : branche `ci-results`, `runs/410-44359885385/`, `runs/412-44362137408/`, `runs/413-44363052881/`.

### Mise en service (event-village-dev)

Migrations à appliquer : `20261123000101` à `…113` (lot 11a et correctifs), puis `supabase/ops/schedule-crons.sql` (tâche `ev_tables`). **Non appliquées le 18/11** : la migration `20261123000001` (design 1b) n'est pas encore appliquée sur event-village-dev (dernière : `20261122000012`, `migration list --linked`) ; elle doit passer avant celles-ci. Contrôles « avant » : `docs/lot11a-rapport.md`, Mise en service, requêtes A à C.

Contrôles « avant » (18/11, `db query --linked`, lecture seule) :

```
A  dernière migration                        : 20261122000012
A2 versions 20261123*                        : aucune (ni 20261123000001 du design 1b, ni celles du lot)
B  fonctions table_/venue_, table venues      : 0, 0
C  tables, réservations, recouvrements       : 0, 0, 0
```
