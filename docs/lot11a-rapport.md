# Lot 11a — Tables : argent et sécurité

Branche `lot11a/tables-argent`, partie de `lot10a/salles-argent` à `11cc55a10` (décision : la 10a sera fusionnée avant la 11a ; les recopies de fonctions communes gardent ainsi les ajouts des salles). Non fusionnée. Aucun écran : le service reste fermé par son interrupteur (`features.tables_enabled`). Migrations `20261123000101` à `…108` (les numéros `20261123000001…` sont pris par la design 1b), sans BEGIN ni COMMIT, rejouables, non appliquées sur event-village-dev.

## À lire en premier : failles trouvées et corrigées

Chacune a un test rouge d'abord (run 380, 0/5, typage compris ; F9 : run 388), puis vert.

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
| F9 | **Nouvelle.** Une partenaire en attente ou suspendue créait zones et tables. | Une zone ou une table appartient à un établissement, que seule une fiche VALIDE crée. | `l11a-tables` (création par la route) |

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

Un test (`migration-lot11a-rejouable`) vérifie qu'aucune recopie ne perd une ligne de la définition précédente : il deviendra rouge si la 10a change ces fonctions sans que la 11a soit recopiée.

## Mise en service (event-village-dev)

1. Appliquer d'abord les migrations de la 10a.
2. Planifier la nouvelle tâche : rejouer `supabase/ops/schedule-crons.sql` (10 tâches, dont `ev_tables`).

```sql
-- Avant
-- A. Dernière migration : 20261122000007 (lot 10a)
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
-- A. Huit versions 20261123000101 à …108
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
| `tests/helpers/finance-invariants.ts` (règle e) | un paiement de table impossible à honorer (`refund_reason`) est remboursé sans vente, comme pour les salles | paiement arrivé trop tard |
| `docs/recette-billetterie.md` | quatre lignes citées recalées (acces-securite-urgente 211 → 216 et 228 → 233, interrupteurs 362 → 378, notif-modeles 518 → 535) | contrôle `recette-matrice` |

## Runs

| Run | Commit | Mode | Résultat |
|---|---|---|---|
| 380 | `7bcba06a9` | rapide, tests seuls | rouge voulu : 0/5, typage rouge (modules absents) |
| 384 | `e921cc900` | rapide, 35 suites | 8/35 : le déclencheur des zones lisait un champ propre aux tables ; un paiement de table remboursé sans vente comptait comme vente manquante (invariant global, d'où les autres suites) ; tâche à la minute 4 ; rappel hors de sa fenêtre selon l'heure |
| 386 | `c7ad76401` | rapide, 36 suites | 32/36 : l'aide de préparation des réservations (paramètres SQL non typés) |
| 387 | `709ad7d20` | rapide, 6 suites | **vert, 6/6** (avec 386 : les 36 suites du lot vertes) |
| 388 | `517a04697` | rapide, 2 suites | rouge voulu : création d'un établissement par une fiche non validée (F9) |

## Points ouverts (lot 11b et suivants)

- Écrans : recherche, fiche, plan de salle, réservation, paiement, espace de l'établissement, validation dans l'administration, carte ; l'ancienne page `/restaurants/[id]/tables` ne correspond plus aux routes (service fermé).
- Validation des établissements avec le droit `partners.validate`, comme les salles (droit propre à décider en 10b).
- Fermetures exceptionnelles (jours fériés, congés) : non prévues.
- Les SMS optionnels (rappel) ne partent pas la nuit : la règle existante les **saute**, elle ne les reporte pas à 8 h (seul le SMS groupé des administrateurs est reporté).
- Une absence marquée par erreur ne se corrige pas encore (à prévoir avec l'écran de l'établissement).
