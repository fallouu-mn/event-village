# Contre-vérification du lot 11b — Tables : écrans, plan de salle, fermetures et absences

Branche auditée : `lot11b/tables-ecrans` à `bc9651634` (rapport `docs/lot11b-rapport.md`, lu seulement pour repérer ses
affirmations). Branche de preuve : `lot11b/cv-rouges`, partie de `bc9651634`, **jamais fusionnée** ; tests seuls, aucun
correctif, branche du lot non modifiée, aucun appel au projet distant, aucune migration appliquée, `.env.local` non lu,
aucun build local (typecheck, lint et la suite sans base seulement ; tout le reste par la CI). `node_modules` relié par
jonction à celui du dossier `event-village-lot11b`.

Suites : `tests/audit/cv11b-1-trous` (un test par trou), `cv11b-2-gardes` (garde-fous éprouvés ; invariants financiers
et du lot 11a à la fin), `cv11b-3-statique` (sans base : appareil, SMS au pire cas, recopies, nuit). **Vert = attaque
BLOQUÉE, rouge = TROU.** Mise en place par les aides du lot 11a (`tests/parcours/l11a-helpers.ts` : comptes,
établissements, tables, décision de l'administration, temps simulé par `shiftReservation`, écriture locale sous le
drapeau des fonctions) ; chaque attaque passe par une route serveur avec le jeton de l'attaquant, ou par la REST avec la
clé anon et ce jeton ; jamais par la clé de service. Faux SamirPay, faux SMS. Interrupteur des tables ouvert seulement
pendant les suites, valeur d'origine remise.

## Verdict

**Aucun trou critique ni élevé ; 3 trous moyens, 5 faibles.** Le cloisonnement des routes, la fiche suspendue (et son
exception de remboursement), le lien court, la concurrence des fermetures, des tâches et des réservations, le service
fermé, la validation, les photos et les 9 recopies tiennent sous attaque ; invariants financiers et du lot 11a à 0
violation. Les trois trous moyens touchent l'argent ou les données du client par des chemins que les tests du lot ne
couvraient pas : **T1** (la fermeture se confirme sur le seul nombre de réservations : l'affirmation « liste identique à
l'aperçu exigée » est fausse), **T2** (« Client absent » marquable dès l'heure, acompte gardé, alors que chaque avis
promet la table « gardée jusqu'à » l'heure + 30 min) et **T8** (paiements des clients, numéro du payeur compris, lisibles
par l'établissement par la REST : la règle du téléphone du lot est contournée ; politique antérieure au lot). À corriger
avant la fusion ; les faibles peuvent suivre dans le même passage.

| # | Trou | Gravité | Point |
|---|---|---|---|
| T1 | Fermeture confirmée sur le **seul nombre** de réservations de l'aperçu : une réservation annulée et une autre prise entre-temps → la nouvelle, jamais montrée, est annulée (et le montant rendu peut différer de l'aperçu) | moyenne | 3 |
| T2 | « Client absent » accepté **5 minutes après l'heure**, acompte de 21 000 gardé, alors que la règle est 30 min et que confirmation, nouvelle réservation et rappel promettent « table gardée jusqu'à 14 h 57 » | moyenne | 3 |
| T8 | **Paiements** d'une réservation de table (numéro du payeur, compte du client, montant, état) et remboursements lus par l'établissement par la **REST**, pour une attente de paiement ou une réservation annulée | moyenne | 1, 6 |
| T3 | Aperçu « vous récupérez 21 000 F », l'heure gratuite passe pendant la confirmation : annulation acceptée avec **0 F** rendu, sans nouvelle confirmation | faible | 3 |
| T4 | Téléphone d'un client « arrivé » donné à l'établissement **3 jours après** la fin du créneau (l'état `ARRIVEE` ne se clôt jamais) | faible | 6 |
| T5 | Demande particulière du client (« Allergie aux arachides, anniversaire de Fatou ») **laissée sur l'appareil** quand la session se ferme à l'insu du navigateur | faible | 6 |
| T6 | Établissement **non public** et ses tables lus par sa propriétaire par la REST (aucune donnée d'autrui) | faible | 1 |
| T7 | Plan de salle **refusé** (404) mais à moitié enregistré : la table placée avant la table refusée garde sa nouvelle position | faible | 8 |

## Runs

| Run | Commit | Mode | Résultat |
|---|---|---|---|
| 562 | `822dcb1bf` | rapide, 3 suites | `cv11b-1-trous` **0/6** : T1, T2, T3, T4, T6, T7 rouges, chacun pour la raison visée ; `cv11b-2-gardes` 11/12 : G1, G2, G4 à G12 verts, **G3 rouge sur une seule vérification** (`paiementsProprio : 1` : la propriétaire lit par la REST le paiement de son client), devenue le trou T8 ; `cv11b-3-statique` 3/4 : T5 rouge, S1 à S3 verts ; invariants : **0 violation** ; typecheck et lint verts |
| 564 | `0e58d8d16` | rapide, 2 suites | `cv11b-1-trous` **0/7** : T1 à T4, T6, T7 rouges pour les mêmes raisons qu'au run 562, **T8 rouge** (deux paiements lus, numéro du payeur compris) ; `cv11b-2-gardes` **12/12** ; invariants : **0 violation** ; typecheck et lint verts |

Journaux bruts : branche `ci-results`, `runs/562-44914128597/jobs/rapide/verify.log` et `runs/564-44914733747/jobs/rapide/verify.log`.
Modification de mes propres tests entre les deux runs (signalée) : la vérification des paiements sortie de G3 (garde-fou)
pour devenir le test T8 ; aucune autre assertion changée.

## 1. Accès : BLOQUÉ, sauf T6

| Attaque | Résultat |
|---|---|
| Autre partenaire, identifiants de l'établissement : fiche, modification, renvoi, plan (direct et depuis son propre établissement avec la table et la zone d'autrui), aperçu et création d'une fermeture, retrait d'une fermeture, planning, détail d'une réservation, accepter, refuser, annuler (PATCH et DELETE), paiement sur place, modifier et supprimer une table, créer une zone et une table dans l'établissement d'autrui ; recettes et liste | BLOQUÉE (G1) : 18 essais, tous refusés : `404 VENUE_NOT_FOUND` (fiche, renvoi, plan, aperçu, fermeture, planning), `404 TABLE_NOT_FOUND` (plan depuis son établissement, suppression), `404 CLOSURE_NOT_FOUND`, `404 RESERVATION_NOT_FOUND` (détail, accepter, refuser, annuler, sur place), `400` (modifier l'établissement ou la table, créer zone ou table chez autrui : déclencheurs de la base) ; établissement, table, demande, fermeture, zones inchangés ; recettes et liste sans rien d'autrui |
| Autre client : détail, aperçu d'annulation, « J'arrive », annulation ; sans session | BLOQUÉE (G2) : `404 RESERVATION_NOT_FOUND` ×4, `401 AUTH_REQUIRED` sans session ; liste de l'autre client sans la réservation |
| REST (anon, tiers, propriétaire) : établissement non public, ses tables ; fermetures ; réservations (propriétaire, tiers, anon) ; paiements | BLOQUÉE (G3) : établissement non public et ses tables : 0 ligne (anon, tiers) ; `venue_closures` : `permission denied` (propriétaire, anon) ; `table_reservations` : 0 ligne pour la propriétaire, un tiers, anon ; le client lit la sienne (1). **Paiements : lisibles par la propriétaire → TROU T8** |
| REST : écritures (photos et plan montré d'un établissement, position d'une table, fermeture insérée, état et code court d'une réservation) ; 15 fonctions du lot appelées par la propriétaire et par anon | BLOQUÉE (G3) : 4 écritures `erreur 42501` ; 15 fonctions (`venue_create`, `venue_submit`, `venue_plan_set`, `venue_owner_refusal`, `venue_closure_preview/create/delete`, `venue_search`, `venue_slots`, `venue_floor`, `table_cancel_preview`, `table_client_coming`, `table_partner_earnings`, `table_quote`, `table_short_code`) : « refusé / refusé » ; base inchangée |
| Fiche SUSPENDU : modifier, créer, plan, fermer, retirer une fermeture, renvoyer, modifier une table, « Client arrivé », annuler (PATCH et DELETE), paiement sur place | BLOQUÉE (G4) : 11 écritures, toutes `403 PARTNER_SUSPENDED` ; réservations et fermeture inchangées |
| Exception voulue : demande payée **acceptée** par une fiche suspendue | BLOQUÉE (G4), comme voulu : `HTTP 409 VENUE_NOT_AVAILABLE` « la demande est refusée et le client remboursé en entier » ; demande `REFUSEE`, payé 21 000, rendu 21 000, un remboursement de 21 000 |
| Propriétaire, REST, sur **son** établissement non public et ses tables | **TROU T6** |

## 2. Lien court `/t/<code>` : BLOQUÉ

| Attaque | Résultat |
|---|---|
| Sans session ; code d'un autre client ; code vu par une autre partenaire ; code inconnu ; code mal formé (`ABC'--`) ; code en majuscules | BLOQUÉE (G5) : sans session `401 AUTH_REQUIRED` ; les 5 autres cas : `HTTP 404 {"success":false,"error":"Réservation introuvable.","code":"RESERVATION_NOT_FOUND"}`, corps identiques ; client → `/tables/reservations/<id>`, propriétaire → `/partner/tables/reservations/<id>` |
| Énumération par le temps de réponse | écartée : médianes sur 15 essais (base locale de la CI) 6,3 ms pour le code d'autrui (2 lectures) contre 4,6 ms pour un code inconnu (1 lecture). L'écart n'apprend que « ce code existe », rien sur la réservation ; avec 27,5 milliards de codes et une session exigée, l'énumération n'est pas réaliste. Durcissement possible : lire la fiche partenaire dans tous les cas |
| Énumération par le volume | écartée : 31⁷ ≈ 27,5 milliards de codes, la page exige une session, aucun code ne donne quoi que ce soit à un compte qui n'est ni le client ni la propriétaire (`lib/tables/short-link.ts:13-24`) |

## 3. Argent : BLOQUÉ, sauf T1, T2 et T3

| Attaque | Résultat |
|---|---|
| Deux fermetures en même temps sur la même réservation (jour entier et plage 19:00-23:00) | BLOQUÉE (G6a) : `201` + `409 PREVIEW_CHANGED (0 au lieu de 1)` ; `ANNULEE_ETABLISSEMENT`, rendu 21 000, **un** remboursement de 21 000 (verrou de l'établissement, liste relue sous le verrou) |
| Fermeture et annulation par le client en même temps | BLOQUÉE (G6b) : annulation `200` (21 000 rendus), fermeture `409 PREVIEW_CHANGED` ; un seul remboursement de 21 000 |
| Attente de paiement en cours touchée par la fermeture, paiement arrivé ensuite | BLOQUÉE (G6c) : l'attente est dans l'aperçu (1 réservation, 0 F) ; réservation `ANNULEE_ETABLISSEMENT`, payé 0, paiement arrivé ensuite rendu en entier, une fois (21 000) |
| Demande sans réponse à l'échéance : deux tâches et l'acceptation en même temps | BLOQUÉE (G7a) : acceptation `409 NOT_PENDING` ; `SANS_REPONSE`, rendu 21 000, un remboursement |
| Absence à 31 min : deux tâches et « Client absent » en même temps | BLOQUÉE (G7b) : « Client absent » `409 NOT_CONFIRMED` (une tâche est passée avant) ; `ABSENT`, rendu 0, aucun remboursement, un avis par canal (`IN_APP`, `PUSH`, `SMS`, `EMAIL`) |
| Montant venu du navigateur | BLOQUÉE (lecture : aucune route du lot ne transmet un montant à la base, sauf le paiement sur place, noté sur la réservation et jamais compté : `table_onsite_payment_record`, inchangé depuis le lot 11a ; aperçu, fermeture, annulation, remboursement : montants relus en base) |
| Invariants financiers et du lot 11a après chaque suite | BLOQUÉE : `[INVARIANT…] … 0 violation(s)` à la fin de chaque suite (financiers d à f, accès g à i, cycle j à l, avis m à o, terrain p et q, lot 11a), runs 562 et 564 |
| Fermeture confirmée alors que la liste a changé depuis l'aperçu (même nombre) | **TROU T1** |
| « Client absent » marqué 5 minutes après l'heure, acompte gardé | **TROU T2** |
| Aperçu « tout rendu », heure gratuite passée pendant la confirmation : 0 rendu | **TROU T3** |

## 4. Créneaux : BLOQUÉ

| Attaque | Résultat |
|---|---|
| Cinq clients sur la même table au même créneau, en même temps | BLOQUÉE (G8a) : `["ok","SLOT_TAKEN","SLOT_TAKEN","SLOT_TAKEN","SLOT_TAKEN"]`, une seule ligne qui tient la table |
| Même client, même établissement, créneaux qui se chevauchent sur deux tables ; 4ᵉ réservation non payée | BLOQUÉE (G8b) : `CLIENT_SLOT_TAKEN` ; trois attentes acceptées, la 4ᵉ `TOO_MANY_PENDING` |
| Fermeture exceptionnelle en base : fonction, route, paiement d'une attente échue reprise ; horaires (23:30 avec fermeture à 23:00) | BLOQUÉE (G8c) : fonction `VENUE_CLOSED`, route `409 VENUE_CLOSED`, paiement de l'attente échue `409 VENUE_CLOSED` (recopie de `table_hold_refusal`), 23:30 `OUTSIDE_HOURS` ; rien payé |

## 5. Service fermé : BLOQUÉ

| Service fermé (`features.tables_enabled` faux) | Résultat (G9) |
|---|---|
| Fermés : recherche, fiche, pastilles, plan public, devis, réservation (route), paiement d'une attente, création et modification d'établissement, plan de salle, fermeture, création et modification de table | `404 NOT_FOUND` ×13 ; `table_reserve` en base : `SERVICE_CLOSED` |
| Ouverts : « Mes réservations », détail, aperçu d'annulation, annulation, lien court, planning, détail de l'établissement, recettes | `200` ×8 ; aucun paiement passé par l'attente (payé 0) |

Rien d'autre ne s'ouvre par les routes laissées ouvertes : elles ne lisent ou ne modifient qu'une réservation existante
(relevé de toutes les routes qui appellent `guardFeature('tables', …)` : chaque écriture nouvelle en a un).

## 6. Données : BLOQUÉ, sauf T4 et T5

| Attaque | Résultat |
|---|---|
| Planning, détail, aperçu de fermeture, avis de l'établissement : nom de famille, numéro, email des clients | BLOQUÉE (G10) : « Awa N. », « Modou F. » ; téléphone pour la réservation confirmée, `null` pour l'attente de paiement (planning et détail) ; aperçu : prénoms et initiales ; avis à l'établissement (`TABLE_NEW_RESERVATION`, 4 canaux) : aucun nom de famille, numéro ni email |
| Administration : file et fiche sans `halls.validate` ; client ; contacts de la partenaire sans et avec `partners.read` | BLOQUÉE (G10) : `403`, `403`, client `403` ; contacts `[null, null]` sans `partners.read`, présents avec |
| Téléphone d'un client « arrivé » trois jours après son créneau | **TROU T4** |
| Demande particulière gardée sur l'appareil après une session fermée à l'insu du navigateur | **TROU T5** |

## 7. Validation : BLOQUÉ

| Établissement | Fiche | Recherche | Pastilles | Réserver | REST anon |
|---|---|---|---|---|---|
| en attente | 404 | absent | 404 | `VENUE_NOT_AVAILABLE` | 0 |
| refusé | 404 | absent | 404 | `VENUE_NOT_AVAILABLE` | 0 |
| suspendu | 404 | absent | 404 | `VENUE_NOT_AVAILABLE` | 0 |
| partenaire suspendue | 404 | absent | 404 | `VENUE_NOT_AVAILABLE` | 0 |

Refusé puis modifié : `200 → REFUSEE` (G11). File et décision : `halls.validate` exigé (G10, `403` sans).

## 8. Photos et plan : BLOQUÉ, sauf T7

| Attaque | Résultat |
|---|---|
| Photos : dossier d'une autre partenaire, adresse extérieure, nom non réencodé, remontée `../` vers le dossier d'autrui, dossier des affiches ; création avec la photo d'autrui | BLOQUÉE (G12a) : `400 IMAGE_ORIGIN_INVALID` ×6, photos inchangées (préfixe `venues/<partenaire>/` et nom `^\d{13}_[0-9a-f]{8}\.webp$`, `lib/tables/table.service.ts:35-49`) |
| Plan : x = 101, x = −1, zone qui déborde (60 + 50), rotation de 7°, forme inconnue, plan d'un autre établissement | BLOQUÉE (G12b) : `400` ×5 (schéma de la route ; zone qui déborde : `400 INVALID_PLAN` de la contrainte en base), `404 VENUE_NOT_FOUND` ; table et zone non écrites |
| Plan refusé (table d'autrui en 2ᵉ position) : la table placée avant est-elle écrite ? | **TROU T7** |

## 9. Avis : BLOQUÉ

| Contrôle | Résultat |
|---|---|
| SMS au pire cas **réel** (S1) : lien `https://app.eventvillage.sn` (27 caractères), 52 500 000 F, 50 personnes, nom de 70 caractères et nom hors GSM-7 (« – », « ’ », « Î », « ô », « ç »), motif de 227 caractères, 4 origines, 4 décisions, les 15 types des tables, dont `TABLE_CLIENT_COMING` et `TABLE_REFUND_PAID` (absents des cas du test du lot `l11a-textes`, qui prend aussi un lien de 23 caractères et 9 999 999 F) | BLOQUÉE : tous GSM-7, un segment ; maximum 160 (`TABLE_RESERVATION_CANCELLED`, origine Event Village : **au ras de la limite**), puis 155 |
| Canaux (S3) : `TABLE_CLIENT_COMING`, `TABLE_REFUND_PAID` : 4 canaux au catalogue et en base | BLOQUÉE |
| Nuit (S3) : seuls `TABLE_RESERVATION_CONFIRMED`, `TABLE_NEW_RESERVATION`, `VENUE_VALIDATION_DECIDED`, `TABLE_REMINDER` passent en `DEFER` (`TABLE_CLIENT_COMING` créé en `DEFER`) ; demande à accepter, demande envoyée, annulations, absence, sans réponse : jamais | BLOQUÉE ; `notif_event_soon` rend urgent l'avis d'une réservation à moins de 12 h ou en cours (lecture `20261129000004:100-109`, vérifiée par le lot) |
| Étapes et canaux : absence (G7b : 4 canaux, une fois), nouvelle réservation (G10 : 4 canaux), annulation par fermeture (test du lot, 4 canaux) | BLOQUÉE |

## 10. Recopies : aucune ligne perdue

Suite S2 (multiensemble des lignes, commentaires ôtés ; dernière définition de main = branche à `2ec11bb66`, main n'a
pas bougé depuis) :

| Fonction | Dernière version de main | Lignes main → lot | Perdues |
|---|---|---|---|
| `venues_validation_guard` | `20261123000102_l11a_etablissements.sql` | 24 → 23 | `IF OLD.validation_status = 'REFUSEE' THEN`, `NEW.validation_status := 'EN_ATTENTE_VALIDATION';`, `END IF;` : le retour automatique en attente, **retrait annoncé** (refusé modifié reste refusé, G11) |
| `table_reserve` | `20261123000111_l11a_cv_limite_client.sql` | 171 → 174 | aucune |
| `table_hold_refusal` | `20261123000105_l11a_paiement.sql` | 35 → 38 | aucune |
| `table_reservation_presence` | `20261123000106_l11a_annulation.sql` | 39 → 42 | aucune |
| `table_reservation_cancel` | `20261123000112_l11a_cv_annulation_demande.sql` | 52 → 55 | aucune |
| `table_notif_data` | `20261123000104_l11a_reserver.sql` | 17 → 22 | aucune |
| `notif_event_soon` | `20261125000006_f4_evenement_proche.sql` | 11 → 21 | aucune |
| `notif_cashouts_notify` | `20261126000003_l10b_avis.sql` | 280 → 291 | aucune (ni aucune ligne de la version de la finition 4, `20261125000003_f4_ventes.sql`) |
| `storage_public_citations` | `20261116000008_f2acv_stockage_cite.sql` | 14 → 15 | aucune |

## Trous

### T1 — Fermeture confirmée sur le seul nombre de réservations (moyenne)

Attaque (`cv11b-1-trous`, T1) : réservation A payée ; aperçu de la fermeture du jour (A seule) ; A annulée par son
client, B prise et payée par un autre client le même jour ; confirmation avec `expected_count: 1`.

```
[CV11B] T1 fermeture confirmée après changement de la liste : {"apercu":["1b91d544-ebfa-4732-b925-548a2ce8d2bb"],"annuleeEntreTemps":"1b91d544-ebfa-4732-b925-548a2ce8d2bb","priseEntreTemps":"be71d1cb-ba79-475e-83c7-b31af5ba79ee","confirmation":"HTTP 201 {\"success\":true,\"closure\":{\"id\":\"35c2333c-64d1-4510-93e1-531d1d80ebef\",\"startsAt\":\"2026-12-31T00:00:00\",\"endsAt\":\"2027-01-01T00:00:00\",\"cancelled\":1,\"refundTotal\":21000}}","B":{"etat":"ANNULEE_ETABLISSEMENT","rendu":21000,"motif":"Fermeture exceptionnelle : Travaux de cuisine imprévus"}}
      error: 'confirmation acceptée alors que la liste a changé (B jamais montrée) : HTTP 201 {"success":true,"closure":{"id":"35c2333c-64d1-4510-93e1-531d1d80ebef","startsAt":"2026-12-31T00:00:00","endsAt":"2027-01-01T00:00:00","cancelled":1,"refundTotal":21000}}'
```

Cause : `supabase/migrations/20261129000002_l11b_fermetures_disponibilites.sql:259` (`IF jsonb_array_length(v_touched) <>
v_expected`) ; `lib/tables/table.service.ts:118` (`expected_count` seul) ; le rapport du lot dit « liste identique à
l'aperçu exigée ». Conséquence : l'établissement confirme une liste et un montant (`refund_total`) qu'il n'a pas vus ;
une réservation de 10 personnes à la place d'une de 4 rend 52 500 F au lieu des 21 000 annoncés, à la charge de
l'établissement pour sa part. Les deux sont remboursées en entier : aucun client lésé en argent.

Correctif proposé : l'aperçu rend aussi une empreinte de la liste (`md5` des `reservation_id` triés et des montants
rendus) ; la confirmation l'envoie (`expected_hash`) et `venue_closure_create` la recalcule sous le verrou
(`PREVIEW_CHANGED` sinon).

### T2 — « Client absent » dès l'heure, acompte gardé (moyenne)

Attaque (T2) : réservation payée (21 000), commencée il y a 5 minutes ; l'établissement envoie `{ action: 'ABSENT' }`.

```
[CV11B] T2 absent marqué 5 min après l’heure : {"regle":"30 min","promesse":{"held_until":"14:57","starts":"14:27"},"boutonAbsent":true,"reponse":"HTTP 200 {\"success\":true,\"state\":\"Absent\",\"refundAmount\":0}","etat":"ABSENT","paye":21000,"rendu":0,"cashouts":0}
      error: 'absent accepté 5 min après l’heure (règle : 30 min, table promise « gardée jusqu’à 14:57 ») : HTTP 200 {"success":true,"state":"Absent","refundAmount":0}'
```

Cause : `supabase/migrations/20261129000003_l11b_reservations.sql:329` (`v_action = 'ABSENT' AND v_now < lower(r.slot)`,
recopie inchangée du lot 11a) et le bouton `lib/tables/queries.ts:574` (`absent: … now >= start`). Le lot 11b a fait de
la garde une promesse écrite : `TABLE_RESERVATION_CONFIRMED` « Elle vous est gardée jusqu'à 20 h 30 » (cloche et SMS,
`lib/notifications/catalog.ts:1420-1422`), `TABLE_NEW_RESERVATION` à l'établissement « la table est gardée jusqu'à »
(`:1450`), rappel, « J'arrive ». Un client en retard de 5 minutes perd son acompte et sa table peut être revendue.

Correctif proposé : `ABSENT` refusé (`TOO_EARLY`) tant que `v_now < lower(r.slot) + tables.no_show_minutes` ; même borne
pour le bouton (`queries.ts:574`). Si le client prévient qu'il ne viendra pas, c'est son annulation, pas une absence.

### T8 — Paiements des clients lus par l'établissement par la REST (moyenne)

Attaque (`cv11b-2-gardes` G3 au run 562, puis T8) : jeton de la propriétaire, clé anon, `payments` filtré sur ses
réservations de table : une attente de paiement (téléphone caché au planning et au détail) et une réservation annulée.

```
[CV11B] G3 lectures REST : {…,"paiementsProprio":"1",…}
      error: 'paiementsProprio : 1'
[CV11B] T8 REST de l’établissement sur les paiements de ses clients : {"paiements":[{"table_reservation_id":"54c2d5ee-bdf2-4b16-ab2d-dfd87f74ee4b","status":"PENDING","amount":21000,"payer_phone":"777125090","client_id":"3d257b06-7fb6-45a3-80e7-484195cb9e5f","operator":"WAVE"},{"table_reservation_id":"a611c0e2-d441-4345-8801-4c901470ef1b","status":"REFUNDED","amount":21000,"payer_phone":"777123521","client_id":"1c9dde87-d714-4421-87aa-f248e3086139","operator":"WAVE"}],"remboursementsLisibles":3,"telephoneAuDetailDeLAttente":null}
      error: |-
        paiements des clients lus par l’établissement : [{"table_reservation_id":"54c2d5ee-…","status":"PENDING","amount":21000,…
```

Cause : politique `payments_read` de `supabase/migrations/0003_rls.sql:274-279` (`OR (partner_id IS NOT NULL AND
is_partner_owner(partner_id))`), jamais reprise depuis, et `refunds_read` (`:287-291`, même règle) ;
`table_payment_create` pose `partner_id` de l'établissement sur le paiement. La propriétaire lit toutes les colonnes,
dont `payer_phone` (numéro de paiement du client, souvent son numéro) et `client_id`, quel que soit l'état : la règle du
lot (« téléphone seulement pour une réservation qui tient la table ») et le point 1 (aucune lecture REST des recettes
par l'établissement) sont contournés. Antérieur au lot (vaut aussi pour les billets et les salles), mais dans son
périmètre pour les tables.

Correctif proposé : `payments_read` et `refunds_read` réduites au client et à l'administration (les recettes de
l'établissement passent déjà par `table_partner_earnings` et les routes serveur) ; à défaut, retirer
`payer_phone`, `client_id` et `metadata` des colonnes lisibles par `authenticated`. Grep fait : aucune lecture de
`payments` ni de `refunds` hors des routes serveur (`components`, `hooks`, `app` hors `app/api` : rien).

### T3 — Aperçu d'annulation dépassé sans nouvelle confirmation (faible)

Attaque (T3) : réservation payée qui commence dans 2 h 01 ; aperçu : 21 000 rendus ; deux minutes passent (temps simulé,
comme les suites du lot) ; annulation confirmée en envoyant le montant annoncé.

```
[CV11B] T3 aperçu puis annulation après l’heure gratuite : {"apercu":{"canCancel":true,"message":null,"paidAmount":21000,"refundAmount":21000,"keptAmount":0,"refundPercent":100,"freeUntil":"2026-11-21T14:33","cancelFreeHours":2},"annulation":"HTTP 200 {\"success\":true,\"message\":\"Réservation annulée. L’acompte n’est pas remboursé : l’annulation arrive moins de 2 h avant l’heure.\",\"reservation\":{\"id\":\"af096cba-131c-4eb4-833b-eaafe92d4369\",\"state\":\"Annulée par le client\",\"refundAmount\":0}}","etat":"ANNULEE_CLIENT","rendu":0,"cashouts":0}
      error: 'annulation acceptée avec 0 F rendus au lieu des 21000 F annoncés, sans nouvelle confirmation : HTTP 200 {…"refundAmount":0}}'
```

Cause : `app/api/tables/reservations/[id]/cancel/route.ts:23` et `components/tables/client/useTableCancel.tsx:75`
n'envoient aucun montant attendu ; `table_reservation_cancel` recalcule à l'heure de la confirmation. Le client a
confirmé « vous récupérez 21 000 F » et n'a rien.

Correctif proposé : la route transmet `expected_refund` (montant de l'aperçu) ; la base refuse (`PREVIEW_CHANGED`, avec
le nouveau montant) s'il diffère, et l'écran redemande la confirmation.

### T4 — Téléphone d'un client « arrivé », créneau fini depuis 3 jours (faible)

```
[CV11B] T4 téléphone d’un client arrivé, créneau fini depuis 3 jours : {"etat":"ARRIVEE","creneau":"2026-11-18 14:32:07","detail":{"name":"Eva M.","phone":"+221776726016"},"planning":{"name":"Eva M.","phone":"+221776726016"}}
      error: |-
        téléphone donné pour une réservation finie depuis 3 jours : +221776726016
```

Cause : `lib/tables/queries.ts:499` (`contact = ['EN_ATTENTE_ACCEPTATION', 'CONFIRMEE', 'ARRIVEE']`, sans borne de temps) ;
aucune transition ne clôt `ARRIVEE` (`table_reservations_tick`, `20261123000106:417-476`). L'établissement garde le
numéro de chaque client venu, pour toujours, par le détail et le planning des jours passés.

Correctif proposé : contact seulement si `EN_ATTENTE_ACCEPTATION` ou `CONFIRMEE`, ou `ARRIVEE` avant la fin du créneau
(`now < upper(slot)`).

### T5 — Demande particulière laissée sur l'appareil (faible)

```
[CV11B] T5 appareil après une session fermée à son insu : {"appelDeAuthProvider":"clearDevicePrefs('paiement')","clesRestantes":["event-village:appareil:table-demande:0b8c1f3e-5a2d-4c7b-9e1f-2a3b4c5d6e7f"],"demande":"Allergie aux arachides, anniversaire de Fatou"}
      error: |-
        demande particulière du compte encore sur l’appareil : event-village:appareil:table-demande:0b8c1f3e-5a2d-4c7b-9e1f-2a3b4c5d6e7f
```

Cause : `components/providers/AuthProvider.tsx:229` (page chargée sans session, session close à l'insu du navigateur :
`clearDevicePrefs('paiement')`), et `lib/device/device-prefs-purge.ts` (`'paiement'` ne retire que le numéro de
paiement). Les demandes du lot 11b (`lib/device/device-prefs.ts:101-127`, clé par établissement, pas par compte) sont des
données du compte, comme le numéro de paiement ; le bouton « Se déconnecter » (`SIGNED_OUT`) les efface bien.

Correctif proposé : la portée `'paiement'` (renommée « compte ») retire aussi les clés `table-demande:` ; les
recherches récentes d'un visiteur restent.

### T6 — Établissement non public lu par sa propriétaire par la REST (faible)

```
[CV11B] T6 REST de la propriétaire sur son établissement non public : {"venues":[{"id":"3dfe547c-a4cf-4de9-9ce1-07d3ffb1e767","name":"TEST Restaurant 11a 61780c8f","validation_status":"EN_ATTENTE_VALIDATION","validation_reason":null,"photos":[],"submitted_at":"2026-11-21T14:32:07.513861+00:00"}],"tables":[{"id":"49102b2d-422c-447a-a1be-b8cc70296c84","table_number":"NP1","plan_x":null}],"hours":7,"anon":[]}
      error: |-
        établissement non public lu par la REST : […]
        1 !== 0
```

Cause : `supabase/migrations/20261126000004_l10b_cv_correctifs.sql:43-65` (`venues_read`, `restaurant_zones_read`,
`restaurant_tables_read` : `OR public.is_partner_owner(partner_id)` ; `venue_opening_hours_read` suit `venues`).
Aucune donnée d'autrui (tiers et anon : 0 ligne, G3, G11) ; écart à la règle demandée (« aucune lecture REST des
établissements non publics par l'établissement »). Aucun écran ne lit `venues` ni `restaurant_tables` par le client
navigateur (grep `from('venues')` hors routes serveur : rien).

Correctif proposé : retirer `is_partner_owner(partner_id)` de ces trois politiques (garder `is_admin()`).

### T7 — Plan de salle refusé mais à moitié enregistré (faible)

```
[CV11B] T7 plan refusé : {"reponse":"HTTP 404 {\"success\":false,\"error\":\"Une table du plan n’appartient pas à cet établissement.\",\"code\":\"TABLE_NOT_FOUND\"}","maTable":{"plan_x":"42.00","plan_y":"17.00","plan_shape":"RONDE","plan_rotation":90},"tableDAutrui":{"plan_x":null}}
      error: |-
        plan refusé mais position enregistrée : {"plan_x":"42.00","plan_y":"17.00","plan_shape":"RONDE","plan_rotation":90}
```

Cause : `supabase/migrations/20261129000001_l11b_etablissements.sql:354` et `:364` : `RETURN` dans le bloc, qui garde
les `UPDATE` déjà faits (seule une exception annule le bloc). Aucune écriture du plan d'autrui (`tableDAutrui` nul) ;
l'écran dit « refusé » alors qu'une partie est enregistrée.

Correctif proposé : vérifier toutes les tables et zones avant la première écriture, ou lever une exception dans le bloc
(`RAISE … USING ERRCODE = 'P0001'`) attrapée hors du bloc pour rendre le refus.

## Points écartés après vérification

| Point | Vérification | Conclusion |
|---|---|---|
| Lien court : énumération par le temps de réponse | G5 : 6,3 ms (code d'autrui) contre 4,6 ms (inconnu) | écarté : n'apprend que l'existence d'un code, rien dessus ; durcissement facultatif (même nombre de lectures) |
| Code court tiré par `random()` (non cryptographique) | `20261129000003:33-58` | écarté : le code n'est pas un secret (session et propriété exigées, G5) |
| Fermeture et annulation, deux fermetures, tâche et action en même temps : double remboursement | G6, G7 ; `table_refund_payment` idempotent par paiement (`REFUND-TABLE-<paiement>`), verrou de l'établissement pris par toutes les écritures (`table_lock_reservation`) | écarté |
| Plan public : état « prise » d'une table à n'importe quel créneau | `venue_floor` (`20261129000002:417-465`) | écarté : aucune donnée de client, information déjà donnée par les pastilles |
| Recherche : `table_free_count` pour chaque établissement et chaque heure avant la pagination | `venue_search` (`20261129000002:531-569`) | écarté de la sécurité (coût, pas fuite) ; noté par le lot dans `docs/apres-lancement.md` (calcul groupé) |
| Filtre `available` illisible → erreur | la route n'envoie que `available === '1'` (`app/api/tables/route.ts:32`) | écarté |
| Accepter ou refuser par une fiche suspendue passent la garde de la route | voulu (exception) ; G4 : acceptation refusée et 21 000 rendus ; un refus rend aussi tout | écarté |
| Une table par créneau et par client : par établissement seulement | décision validée le 18/11 (T2 du lot 11a), consigne « dans un même établissement » ; G8b | conforme |
| SMS d'annulation par Event Village à 160 caractères | S1 | conforme, mais sans marge : tout mot ajouté à ce texte le fait passer à 2 segments |
| Remboursements d'un refus en base (`VENUE_NOT_AVAILABLE`, `RESPONSE_TOO_LATE`) non envoyés par la route | `app/api/partner/tables/reservations/[id]/route.ts` (`act`, retour avant `sendTableRefunds`) | écarté : les versements créés sont repris par la tâche des versements ; code du lot 11a |
| Colonnes publiques de `venues` lues par anon (dont `validated_by`, identifiant d'un administrateur) | `GRANT SELECT ON public.venues TO anon, authenticated` (`20261123000102:282`) | remarque hors lot (lot 11a) : aucune donnée de client ; à réduire avec T6 si voulu |
