# Lot 10a — Salles : argent et sécurité

Branche `lot10a/salles-argent`, partie de `main` à `0f8a7ccd2`. Non fusionnée. Aucun écran : le service reste fermé par son interrupteur (`features.halls_enabled`). Migrations `20261122000001` à `…07`, sans BEGIN ni COMMIT, rejouables, non appliquées sur event-village-dev.

## À lire en premier : failles trouvées et corrigées

Chacune a un test rouge d'abord (run 356, 0/6), puis vert.

| # | Faille | Correctif | Test |
|---|---|---|---|
| F1 | La route de réservation calculait l'argent : une salle sans prix par jour donnait une réservation à **0 F** (S1) ; un acompte de 0 % devenait 30 % (S2) ; une salle inactive, non validée ou d'une partenaire suspendue se réservait (S3). | Une seule fonction en base, `hall_reserve` ; le corps de la requête ne fixe aucun montant. | `l10a-salles` A |
| F2 | Le premier paiement demandait le **solde** avant l'acompte, puis marquait toute la réservation payée (S4). | `hall_payment_create` (montant relu sur la réservation), `hall_payment_confirm` (« payée » au total encaissé). | `l10a-salles` B |
| F3 | **Nouvelle.** Un échec ou un abandon du paiement du solde **annulait** une réservation dont l'acompte était payé, sans remboursement. | Un paiement de salle en échec ne touche plus la réservation. | `l10a-salles` B, `finance-cibles` |
| F4 | Annulation après paiement : aucun remboursement ; le moteur financier ignorait les salles (S6). Moratoire de 2 jours codé en dur (S5). | Remboursement par le moteur financier ; délai du solde par la tâche existante. | `l10a-annulation` |
| F5 | La salle pouvait confirmer une réservation **non payée** (C1). | Confirmation par le paiement seulement ; la salle ne fait que vérifier. | `l10a-salles` B, `partner-halls-m7` |
| F6 | **Nouvelle.** Toute salle active était lisible par tous, même non validée ; la route publique la servait, même d'une partenaire suspendue. | Lecture REST limitée aux salles actives et validées ; routes publiques et réservation exigent en plus une partenaire validée. | `r30-salles-lecture` |
| F7 | **Nouvelle.** Une partenaire non validée ou suspendue pouvait créer une salle. | Partenaire VALIDE exigée. | `l10a-salles` A |
| F8 | **Nouvelle.** Les avis partaient d'un déclencheur : « demande » dès l'attente de 15 minutes, « annulation » à chaque attente échue ; un remboursement de salle envoyait le texte des billets (« aucun billet n'a pu être émis »). | Avis envoyés par les fonctions du parcours ; texte propre aux salles. | `l10a-salles`, `l10a-textes` |
| F9 | La modération de l'administration écrivait l'état d'une réservation directement. | Passe par `hall_reservation_cancel` (verrou, journal), seulement pour une attente non payée. | `dette-admin-services` |

`create_hall_reservation_atomic`, jamais appelée, calculait 100 000 F par défaut : supprimée.

## Formules (en base, `hall_quote`), avec un exemple

Exemple : 200 000 F par jour, 2 jours, acompte 30 %, frais de service 5 %, Wave 1,5 %, commission 0 %.

| Montant | Formule | Exemple |
|---|---|---|
| Prix | prix unitaire × jours (ou heures) | 400 000 |
| Frais de service (client) | arrondi au franc supérieur (prix × 5 %) | 20 000 |
| Total | prix + frais | 420 000 |
| Acompte (prix) | arrondi sup. (prix × 30 %), ou montant fixe plafonné au prix ; prix entier à moins de 7 jours | 120 000 |
| Frais de l'acompte | arrondi sup. (acompte × 5 %), jamais plus que les frais | 6 000 |
| Acompte payé | acompte + ses frais | **126 000** |
| Solde | total − acompte payé | **294 000** (280 000 + 14 000) |
| Échéance du solde | début − 7 jours | J-7 à 00:00 (Dakar) |

Pour chaque paiement (montant A, prix F, frais S) :
- frais Wave = A × 1,5 %, à la charge d'Event Village (§78) ;
- commission = F × 0 % ;
- part de la salle = F − commission ;
- revenu d'Event Village = S + commission − frais Wave.

Pour l'acompte : frais Wave 1 890, part de la salle 120 000, Event Village 4 110. Pour le solde : 4 410, 280 000 et 9 590.

La part de la salle va au grand livre et devient disponible 48 h après la **fin** de la réservation, comme les billets. La commission de parrainage (§100) suit la même règle.

**Annulation** : pourcentage de ce que le client a payé, frais compris.
- Exemple, règle modérée entre 7 et 30 jours avant : 50 %, soit 63 000 + 147 000 = 210 000 rendus.
- La salle rend la moitié de sa part (60 000 + 140 000). Event Village rend la moitié des frais et garde les frais Wave.
- La commission de parrainage est recalculée au prorata (§82).

## Règles d'annulation

« Jusqu'à N jours avant » = au moins N × 24 h avant le début. La règle est figée sur la réservation et affichée avant le paiement.

| Règle | Remboursement |
|---|---|
| Souple | tout jusqu'à 7 jours avant, 50 % ensuite |
| Modérée | tout jusqu'à 30 jours, 50 % jusqu'à 7 jours, rien ensuite |
| Stricte | 50 % jusqu'à 30 jours, rien ensuite |
| Par la salle ou Event Village | tout, toujours (motif obligatoire) |
| Délai de paiement dépassé | règle de la salle, évaluée à l'instant de l'échéance (J-7) : souple 100 %, modérée 50 %, stricte 0 % |

## États d'une réservation

| État en base | Ce que voient les gens | Tient la date |
|---|---|---|
| EN_ATTENTE_PAIEMENT | En attente de paiement (15 minutes) | oui |
| ACOMPTE_PAYE | Acompte payé | oui |
| PAYEE | Payée | oui |
| EXPIREE | Non payée à temps | non |
| DELAI_DEPASSE | Délai de paiement dépassé | non |
| ANNULEE_CLIENT / _SALLE / _EV | Annulée par le client / la salle / Event Village | non |

L'ancien état (`status`) est dérivé de l'état en base. Un paiement arrivé après la reprise de la date est remboursé en entier.

## Migrations

| Fichier | Contenu |
|---|---|
| `…01_l10a_reglages` | 11 réglages `halls.*` ; recopie de `finance_setting_set` et `fin_setting_valid` |
| `…02_l10a_salles_schema` | validation des salles, acompte, règle, position, état détaillé, créneaux, exclusion, lecture publique |
| `…03_l10a_reserver` | `hall_quote`, `hall_reserve` ; suppression de `create_hall_reservation_atomic` |
| `…04_l10a_paiement` | `hall_payment_create`, `hall_payment_confirm` ; recopies de `fin_payout_available_at` et `calculate_referral_commissions` |
| `…05_l10a_annulation` | remboursement partiel, annulation, tâche du délai ; recopie de `notif_cashouts_notify` |
| `…06_l10a_validation` | `hall_validation_decide` |
| `…07_l10a_messages` | 9 types d'avis ; retrait de `trg_hall_reservations_notify` ; avis générique sans les salles |

## Contrôles avant et après (event-village-dev, à la mise en service)

```sql
-- Avant
-- A. Dernière migration : 20261120000009 (ou une 20261121… si la contre-vérification de la 2b passe avant)
select max(version) from supabase_migrations.schema_migrations;
-- B. Rien du lot : 0 ; colonne absente
select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname like 'hall\_%' and proname <> 'hall_slot';
select count(*) from information_schema.columns where table_name = 'hall_reservations' and column_name = 'booking_state';
-- C. À noter : salles et réservations existantes
select (select count(*) from public.halls), (select count(*) from public.hall_reservations);

-- Après
-- A. Sept versions 20261122000001 à …07
select version from supabase_migrations.schema_migrations where version like '20261122%' order by 1;
-- B. Fonctions du lot réservées au rôle de service : anon false, authenticated false
select p.proname, has_function_privilege('anon', p.oid, 'execute'), has_function_privilege('authenticated', p.oid, 'execute')
  from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname like 'hall\_%' order by 1;
-- C. 11 réglages halls.*
select key, value from public.platform_settings where key like 'halls.%' order by 1;
-- D. Salles existantes en attente de validation (à valider par l'administration) ; réservations reprises
select validation_status, count(*) from public.halls group by 1;
select booking_state, status, count(*) from public.hall_reservations group by 1, 2;
-- E. Exclusion sur les créneaux présente, ancienne retirée : true, false
select exists (select 1 from pg_constraint where conname = 'no_overlapping_hall_slots'),
       exists (select 1 from pg_constraint where conname = 'no_overlapping_hall_reservations');
-- F. Neuf types d'avis des salles
select type, channels from public.notification_types where type like 'HALL\_%' order by 1;
```

Puis `03-verification.sql`.

## Tests existants modifiés (signalés)

| Test | Modification | Pourquoi |
|---|---|---|
| `r3-fonctions-rpc` | `create_hall_reservation_atomic` retirée de la liste ; fonctions du lot ajoutées | fonction supprimée |
| `finance-cibles` | réservation par `hall_reserve`, part « INTEGRAL » ; après un échec, la réservation reste en attente (au lieu d'annulée) | F2, F3 |
| `interrupteurs`, `lot9quinquies-cv-salles` | salle validée ; service ouvert le temps de la suite ; dates à venir | validation, interrupteur |
| `partner-halls-m7` | idem ; montants avec les frais de service (378 000 / 132 300 / 245 700) ; échéance J-7 ; la salle ne confirme plus sans paiement | décisions du client, C1 |
| `ux-performance-and-double-click` | salle validée, service ouvert, dates à venir | idem |
| `notif-migration`, `notif-modeles`, `notif-outbox` | types et canaux des avis des salles ; textes exacts des 5 SMS des salles ajoutés au contrat de `notif-modeles` | F8 |
| `tests/helpers/finance-invariants.ts` (règle e) | un paiement de salle impossible à honorer (`refund_reason`) est remboursé sans vente, comme un panier de billets | paiement arrivé trop tard |
| `lot9quinquies-cv-salles` | en plus : l'attente du gagnant est rendue à chaque tour | au plus 3 réservations non payées par client (nouvelle garde) |
| `docs/recette-billetterie.md` | deux lignes citées recalées (interrupteurs 358 → 362, notif-modeles 510 → 518) | contrôle `recette-matrice` |

## Runs

| Run | Commit | Mode | Résultat |
|---|---|---|---|
| 356 | `7b5f3f8d3` | rapide, tests seuls | rouge voulu : 0/6 |
| 358 | `47fd1efb6` | rapide, 30 suites | 7/30 : un invariant financier (paiement de salle remboursé sans vente), valeurs d'origine des réglages, lecture publique des salles par anon, limite de 3 attentes dans les tests, contrat des SMS |
| 359 | `f91eb2a27` | rapide, 30 suites | **vert, 30/30** |
| 360 | `39b63bf9b` | complet | 482/484, e2e et budgets JS verts ; rouges : mon test de concurrence (un client gagnait plusieurs tours et atteignait la limite de 3 attentes), deux lignes citées par `docs/recette-billetterie.md` décalées par les ajouts du lot |
| 364 | `5f4b7b7b6` | **complet** | **vert : 484/484 en 39 min 19 s** ; 37 suites d'audit (`tests/audit`, `tests/audit-auth`), e2e, captures, budgets JS ; invariants à 0 |

Les runs 357 et 361 à 363 appartiennent à d'autres sessions.

## Points ouverts (lot 10b)

- Écrans : catalogue, fiche, calendrier, paiement, espace partenaire, validation dans l'administration, carte.
- Une salle validée puis modifiée reste validée (une salle refusée puis modifiée repasse en attente) : nouvel examen à décider.
- Validation des salles avec le droit `partners.validate` (pas de droit propre, pour ne pas toucher la grille des droits).
- Le remboursement versé envoie l'avis générique « Remboursement versé » (lien vers l'historique des billets).
- Au plus 3 réservations non payées par client à la fois (garde contre le blocage des dates) : valeur à confirmer.
- Lecture REST : une salle validée d'une partenaire ensuite suspendue reste lisible (catalogue public) ; elle n'est plus servie ni réservable.
