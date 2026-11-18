# Contre-vérification du lot 11a — Tables : argent et sécurité

Branche `audit/lot11a`, partie de `lot11a/tables-argent` à `1348a0a31` (rapport `docs/lot11a-rapport.md`), qui contient
déjà la 10a corrigée (`182a7d914`). Tests seuls, aucun correctif, rien fusionné, aucun test distant, `.env.local` non lu.
Interrupteur des tables ouvert seulement dans les suites (`openTablesService`, valeur d'origine remise à la fin).

Suites : `tests/audit/cv11a-1-argent`, `-2-reservation`, `-3-delais`, `-4-droits`, `-5-recopies` (+ `cv11a-helpers.ts`).
Chaque test décrit le comportement sûr : **vert = BLOQUÉE, rouge = TROU**. Le temps est simulé comme dans les suites du
lot (`shiftReservation` : écriture locale avec le drapeau des fonctions en base ; date de création d'un paiement
vieillie), jamais l'horloge. Faux SamirPay.

## Résumé : 7 trous, aucun critique

| # | Trou | Gravité | Point |
|---|---|---|---|
| T1 | Une attente échue est **reprise**, ou une attente en cours **prolongée de 15 min**, par un appel de paiement **refusé** (plafond de 3 paiements en attente par numéro payeur) : la table est tenue sans fin, sans aucun paiement | moyenne | 2, 3 |
| T2 | Réservations **gratuites** à confirmation automatique (réglage par défaut) : **aucune limite** ; un seul compte tient toutes les tables d'un établissement (6 sur 6), le client suivant reçoit « Aucune table libre » | moyenne | 2 |
| T3 | Demande **payée mais jamais acceptée** par l'établissement, annulée par le client à moins de 2 h : **0 F rendu**, l'établissement garde 21 000 F | moyenne | 1, 3 |
| T4 | Réservation avec acompte prise à 1 h de l'heure : le client lit « Acompte remboursé si vous annulez au moins 2 h avant », ce qui est déjà impossible | faible | 3 |
| T5 | Un établissement **suspendu** par l'administration, ou une partenaire dont la fiche est **suspendue**, accepte encore une demande payée : réservation confirmée | faible | 4 |
| T6 | `GET /api/restaurants/[id]/menu` : un nom partiel (`rest-e`, `cv11a`) rend le menu de « la première partenaire venue » dont le nom le contient (F10 du lot fermé pour les identifiants inconnus seulement) | faible | 4 |
| T7 | Point 5 : la route `PUT /api/admin/finance-settings` refuse au SUPERADMIN **les 22 réglages `halls.*` et `tables.*`** (12 + 10), dont `halls.full_payment_margin_hours`, alors que l'écran les propose ; défaut présent dans main depuis la 10a. Les **recopies** de la 11a, elles, n'ont rien perdu | moyenne | 5 |

Aucun équivalent de T1 (lecture des réservations par n'importe qui), T3 (acompte perdu par la tâche) ni T6 (invariant
de commission) de la contre-vérification de la 10a. Équivalent de T2 (relance sans contrôle) : fermé par la 11a, sauf
par le chemin du plafond du numéro payeur (T1 ci-dessus). Équivalent de T4 (seuil à quelques minutes) : T4 ci-dessus,
pour le texte seulement. Équivalent de T5 (course sur la limite de 3) : fermé (10 demandes simultanées → 3).

## 1. Argent : tout BLOQUÉ, sauf T3

| Attaque | Résultat |
|---|---|
| Montants, taux, état, payé et autre client dans le corps de la réservation (`totalAmount: 1`, `deposit_amount: 0`, `commission_rate: 100`, `client_id` d'un autre, `booking_state: CONFIRMEE`) | BLOQUÉE : 3 702 + 186 = 3 888 calculés en base, client de la session, « En attente de paiement » |
| Montant, part et cible dans le corps du paiement (`amount: 1`, `part: SOLDE`) | BLOQUÉE : 3 888 |
| 22 saisies : personnes 0, −1, 51, 2³¹, 1e21, 4,5, « 4.5 », « 4abc », vrai, [4], vide, nul, « 1e1 » ; heures 24:00, 20:07, 20:00:30, 25:00 ; dates 30 février, epoch, infinity, −infinity, 1900 | BLOQUÉE : toutes 400, aucune réservation |
| Acompte 0, 99, 50,5, −100, 1 000 001 F par personne (route) ; 0 écrit en base | BLOQUÉE : 400 ; contrainte 23514 |
| Acompte maximal 1 000 000 × 50 | BLOQUÉE : 50 000 000 + 2 500 000 = 52 500 000, paiement créé à ce montant |
| Deux paiements du même acompte (le premier abandonné 61 min puis payé) | BLOQUÉE : second rendu (21 000), une vente, établissement 20 000 |
| Demande payée close (sans réponse, refus, annulation par Event Village), puis un paiement plus ancien confirmé | BLOQUÉE ×3 : 42 000 encaissés, 42 000 rendus, établissement 0 |
| Client qui annule pendant que le paiement est en cours, paiement confirmé ensuite | BLOQUÉE : rendu 21 000 |
| Paiement lancé avant l'heure, confirmé après le début du créneau | BLOQUÉE : rendu 21 000, jamais confirmée |
| Annulations simultanées (client ×3, établissement, Event Village, tâche), puis `table_refund_payment` rejoué | BLOQUÉE : une 200, un remboursement de 21 000, un versement |
| Paiement sur place 150 000 sur une réservation payée, puis annulation ; 10 000 001 et « 1e5 » | BLOQUÉE : aucune ligne de paiement, grand livre inchangé (10 écritures avant et après), seul l'acompte rendu ; 400, 400 |
| Paiement sur place 77 777 sur une réservation gratuite | BLOQUÉE : aucune ligne de paiement ; relevé de l'établissement inchangé |
| Grand livre et parrainage, 1 234 × 3 | BLOQUÉE : 3 888 ; Wave 58,32 ; net Event Village 127,68 ; vente 3 702 disponible le 29/12 22:00 (fin + 48 h) ; commission 6,38 ; annulation : 3 702 + 186 rendus, établissement 0, parrain 0, commission annulée, invariants sans violation |
| Commission 3 % (transaction annulée) : 3 702 × 3 % = 111,06 | BLOQUÉE : part 3 590,94, client remboursé 3 888, écart de l'établissement −0,06 F (arrondi au franc de la part rendue), invariants sans violation |
| Demande payée non acceptée, annulée par le client à 1 h 30 | **TROU T3** (point 3) |

## 2. Réservation : tout BLOQUÉ, sauf T1 et T2

| Attaque | Résultat |
|---|---|
| 8 clients sur la dernière table en même temps | BLOQUÉE : une 200, sept 409 `NO_TABLE_FREE` |
| Plage de nuit 19:00-02:00, créneau 90 min : 23:00, 00:30 le lendemain, 21:30 (se touchent) ; 00:15, 22:00 (chevauchent) | BLOQUÉE : OK, OK, OK ; `NO_TABLE_FREE` ×2 |
| 8 demandes simultanées par-dessus minuit (23:30 la veille, 00:00 le lendemain) | BLOQUÉE : une seule |
| Ouvert seulement le jour J 19:00-02:00 : 00:30 le lendemain ; 01:00 le matin de J ; 19:00 le lendemain ; 01:15 le lendemain (finit à 02:15) | BLOQUÉE : OK ; `OUTSIDE_HOURS` ×3 |
| Heure de Dakar : 30 min dans le passé ; 90 jours + 1 h ; 89 jours ; date et heure avec fuseau (`…T23:30:00-05:00`, `20:00+05:00`) | BLOQUÉE : `DATE_PASSED`, `DATE_TOO_FAR`, OK ; fuseau ignoré (`2026-12-31 20:00`) |
| Table trop petite, sous le minimum, d'un autre établissement de la même partenaire, d'une autre partenaire, retirée ; zone d'ailleurs ; table hors de la zone ; 7 personnes sans table | BLOQUÉE : `TABLE_TOO_SMALL` ×2, `TABLE_NOT_FOUND` ×4, `ZONE_NOT_FOUND`, `NO_TABLE_FITS` |
| Établissement en attente, refusé, suspendu, inactif ; partenaire suspendue ou en attente ; établissement inconnu ; identifiant illisible (route) | BLOQUÉE : `VENUE_NOT_AVAILABLE` ×6, `VENUE_NOT_FOUND`, 404 |
| 10 demandes simultanées dans 10 établissements | BLOQUÉE : 3 tenues |
| 2 attentes + 3 attentes échues relancées en même temps | BLOQUÉE : 3 tenues (201 une fois, 429 deux fois) |
| 4e demande à la suite ; autre client dans le corps | BLOQUÉE : 429 `TOO_MANY_PENDING` ; client de la session |
| Payer la réservation d'un autre | BLOQUÉE : 404 |
| Relance d'une attente échue avec un numéro payeur au plafond | **TROU T1** |
| Prolongation d'une attente en cours par le même chemin | **TROU T1** |
| 6 réservations gratuites du même compte au même créneau | **TROU T2** |

### T1 — attente reprise ou prolongée sans paiement (moyenne)

`table_payment_create` (`supabase/migrations/20261123000105_l11a_paiement.sql:153-172`) remet la réservation
« En attente de paiement » avec une nouvelle échéance de 15 min (`UPDATE … hold_expires_at = now() + 15 min`), **puis**
contrôle le plafond de 3 paiements en attente par numéro payeur et rend `PAYER_PENDING_LIMIT` sans lever d'erreur : la
transaction est validée, l'attente reprise ou prolongée reste, aucun paiement n'est créé. Le client qui a lancé 3
acomptes sur son propre numéro (puis les a laissés échoir) tient ensuite n'importe quelle table en rappelant le
paiement toutes les 14 minutes.

```
[CV11A] 2.3c : {"relances":[{"http":429,"code":"PAYER_PENDING_LIMIT","payment":false,"state":"EN_ATTENTE_PAIEMENT","hold":"2026-11-18T16:11:58.712655+00:00"},{"http":429,"code":"PAYER_PENDING_LIMIT","payment":false,"state":"EN_ATTENTE_PAIEMENT","hold":"2026-11-18T16:11:58.727451+00:00"},{"http":429,"code":"PAYER_PENDING_LIMIT","payment":false,"state":"EN_ATTENTE_PAIEMENT","hold":"2026-11-18T16:11:58.745093+00:00"}],"paiementsDeLaReservation":0,"rival":"NO_TABLE_FREE"}
    not ok 3 - relance d’une attente échue quand le numéro payeur a déjà 3 paiements en attente : la table n’est pas reprise sans paiement
      error: 'table reprise et tenue sans aucun paiement (429 PAYER_PENDING_LIMIT), le rival reçoit NO_TABLE_FREE'
[CV11A] 2.3d : {"http":429,"code":"PAYER_PENDING_LIMIT","before":"2026-11-18T15:57:59.158499+00:00","after":"2026-11-18T16:11:59.176534+00:00","gainedMin":14,"payment":false}
    not ok 4 - même plafond du numéro payeur : une attente en cours est prolongée sans paiement à chaque appel
      error: 'attente prolongée de 14 min par un appel refusé (429 PAYER_PENDING_LIMIT)'
```

Correctif : dans `table_payment_create`, contrôler le plafond du numéro payeur (comme tout refus) **avant** de reprendre
ou de prolonger l'attente.

### T2 — réservations gratuites sans limite (moyenne)

La limite de `table_reserve` (`20261123000104_l11a_reserver.sql:284-290`) ne compte que les demandes « En attente de
paiement » et « En attente de réponse ». Une réservation gratuite à confirmation automatique (réglage par défaut d'un
établissement) est confirmée tout de suite et n'est jamais comptée : un compte tient toutes les tables, sans rien
risquer (l'absence d'une réservation gratuite ne coûte rien).

```
[CV11A] 2.3e : {"replies":["OK","OK","OK","OK","OK","OK"],"held":["CONFIRMEE","CONFIRMEE","CONFIRMEE","CONFIRMEE","CONFIRMEE","CONFIRMEE"],"rival":"NO_TABLE_FREE"}
    not ok 5 - réservations gratuites, confirmation automatique (réglage par défaut) : un client ne tient pas plus de 3 tables sans payer
      error: '6 tables tenues sans payer par un seul compte, le client suivant reçoit NO_TABLE_FREE'
```

Correctif : compter aussi les réservations gratuites confirmées à venir du client dans la limite (ou une limite
réglable propre : par exemple une table par client et par créneau).

## 3. Délais : tout BLOQUÉ, sauf T3 et T4

| Attaque | Résultat |
|---|---|
| Attente de paiement : 1 min avant la fin, 1 min après | BLOQUÉE : « En attente de paiement », puis « Non payée à temps » |
| Paiement lancé à la dernière seconde, attente échue, puis confirmé, table libre | BLOQUÉE : confirmée, 21 000 payés, rien de perdu |
| Réponse : 1 min avant l'échéance (tâche, puis acceptation) ; 1 min après (acceptation) | BLOQUÉE : acceptée ; 409 `RESPONSE_TOO_LATE`, « Sans réponse », 21 000 rendus |
| Acceptation et tâche ×3 en même temps, échéance dépassée | BLOQUÉE : « Sans réponse », un remboursement de 21 000 |
| Annulation à 2 h 03 / 1 h 57 de l'heure | BLOQUÉE : 21 000 / 0, messages justes |
| Absence : 29 min (rien) ; 31 min, « Client arrivé » en même temps que 2 tâches | BLOQUÉE : confirmée ; un seul état (« Absent », l'arrivée répond 409), 0 rendu |
| Tâche : 4 passages de la fonction et 2 de la route en même temps, puis 2 de plus (attente, demande, absence) | BLOQUÉE : aucune erreur ni blocage mutuel, « Non payée à temps », « Sans réponse » (une fois 21 000), « Absent » |
| Route de la tâche sans secret, faux secret, clé de service | BLOQUÉE : 401 ×3 |
| Demande payée non acceptée, annulée à 1 h 30 | **TROU T3** |
| Texte d'annulation d'une réservation prise à 1 h de l'heure | **TROU T4** |

### T3 — demande jamais acceptée, acompte gardé (moyenne)

`table_reservation_cancel` (`20261123000106_l11a_annulation.sql:250-252`) applique la règle du client (rien rendu à
moins de 2 h) aussi à une demande « En attente de réponse » : l'établissement n'a jamais accepté, mais garde
l'acompte. Il suffit qu'il tarde à répondre pour qu'un client pressé annule.

```
[CV11A] 3.3b : {"avant":"EN_ATTENTE_ACCEPTATION","http":200,"message":"Réservation annulée. L’acompte n’est pas remboursé : l’annulation arrive moins de 2 h avant l’heure.","state":"ANNULEE_CLIENT","paid":21000,"rendu":0}
    not ok 2 - demande payée pas encore acceptée par l’établissement, annulée par le client à 1 h 30 de l’heure : acompte rendu
      error: |-
        0 F rendus : l’établissement garde 21000 F sur une demande qu’il n’a jamais acceptée
      expected: 21000
      actual: 0
```

Correctif : une demande « En attente de réponse » annulée par le client est remboursée en entier, quelle que soit
l'heure.

### T4 — remboursement promis alors qu'il est déjà impossible (faible)

```
[CV11A] 3.3c : {"cancellation":"Acompte remboursé si vous annulez au moins 2 h avant l’heure, rien ensuite."}
    not ok 3 - réservation avec acompte prise à 1 h de l’heure : le client n’est pas assuré d’un remboursement impossible
      error: 'réservation à 1 h de l’heure, le client lit : « Acompte remboursé si vous annulez au moins 2 h avant l’heure, rien ensuite. »'
```

Correctif : `tableCancellationText` (`lib/tables/booking.ts:45`) reçoit l'heure de la réservation et annonce, à moins de
2 h, que l'acompte payé ne sera pas remboursé.

## 4. Droits et données : tout BLOQUÉ, sauf T5 et T6

| Attaque | Résultat |
|---|---|
| REST par un autre client, une autre partenaire, un visiteur, un administrateur sans code : réservation (note, client), paiement (numéro), compte du client, réservations imbriquées dans l'établissement et dans la table, versements, journal, établissement en attente, ses tables et ses horaires | BLOQUÉE : 0 ligne partout (versements : 42501) ; la propriétaire lit sa réservation, pas le compte du client |
| Liste des réservations filtrée sur l'établissement d'une autre ; client ; visiteur ; établissements et tables d'une autre | BLOQUÉE : liste vide ; 403 ; 401 ; rien |
| 6 actions + suppression par une autre partenaire ; les mêmes par le client ; annulation par un autre client ; modification de l'établissement et de la table d'une autre | BLOQUÉE : 404 ×7, 403 ×7, 404, 400, 400 ; rien ne bouge |
| Annulation et validation par l'administration : sans code, sans le droit, par une partenaire, par un client | BLOQUÉE : 403 ×8 |
| Droits d'exécution des 33 fonctions `table_*`, `venue_*`, `venues_*`, `restaurant_*` et des recopies | BLOQUÉE : anon et authenticated à false |
| 18 fonctions appelées par la REST (visiteur, client, partenaire, administrateur avec code) | BLOQUÉE : aucune acceptée ; rien ne bouge |
| Clé de service (comme une route) : état, ancien statut, payé, remboursé, table, date, personnes, échéance, sur place, état du paiement, client, suppression, insertion | BLOQUÉE : 42501 ×13 ; la note seule reste modifiable (voulu) |
| REST de la partenaire (état) et du client (note, payé) | BLOQUÉE : 42501 |
| Actions inventées (CONFIRMEE, TERMINEE, EN_ATTENTE, vide, « accepter  ») ; création par la partenaire | BLOQUÉE : 400 ×5 ; plus de POST |
| Statut de validation écrit par la route, la REST, la clé de service, la création (route et service) ; table et horaires écrits par la REST | BLOQUÉE : reste « En attente de validation », jamais validé ; 42501 ×2 |
| Validation par la fonction : partenaire, client, administrateur sans `partners.validate`, administrateur suspendu, inconnu | BLOQUÉE : `FORBIDDEN` ×5 |
| `/api/restaurants/[id]/tables` : inconnu, illisible, en attente, refusé, suspendu, inactif, partenaire suspendue ; établissement validé | BLOQUÉE : 404 ×7 ; 200 sans aucune donnée de réservation |
| Établissement suspendu, ou fiche de la partenaire suspendue, puis demande payée acceptée | **TROU T5** |
| Menu par nom partiel | **TROU T6** |

Constat (sans effet) : `DELETE /api/partner/tables/[id]` sur la table d'une autre répond 200 sans rien supprimer
(`lib/tables/table.service.ts:191`, suppression filtrée par partenaire, 0 ligne) : faux succès à corriger avec
l'écran.

### T5 — acceptation par un établissement ou une partenaire suspendus (faible)

`table_reservation_respond` ne vérifie que le compte de la partenaire (actif) : ni l'établissement (suspendu « ne reçoit
plus de nouvelles réservations », rapport du lot), ni la fiche.

```
[CV11A] 4.6a : {"accept":"HTTP 200 {\"success\":true,\"state\":\"Confirmée\",\"refundAmount\":0}","state":"CONFIRMEE"}
    not ok 1 - établissement suspendu par l’administration : la partenaire n’accepte plus une demande payée en attente
      error: 'demande acceptée par un établissement suspendu'
[CV11A] 4.6b : {"accept":"HTTP 200 {\"success\":true,\"state\":\"Confirmée\",\"refundAmount\":0}","state":"CONFIRMEE"}
    not ok 2 - fiche de la partenaire suspendue : elle n’accepte plus une demande payée en attente
      error: 'demande acceptée par une partenaire suspendue'
```

Correctif : l'acceptation refait `table_hold_refusal` (établissement validé et actif, partenaire VALIDE) et, sinon,
refuse la demande avec remboursement en entier.

### T6 — menu par nom partiel (faible)

`app/api/restaurants/[id]/menu/route.ts:39-46` : pour un identifiant qui n'est pas un UUID, `ilike '%…%'` puis
`limit(1)`. Les produits rendus sont ceux d'une partenaire VALIDE (publics), d'où la gravité faible.

```
[CV11A] 4.7b : {"partial":"200 Orga A (test)","fragment":"200 Finance cv11a-argent"}
    not ok 2 - /api/restaurants/[id]/menu : un nom partiel (« rest-e ») ne désigne pas « la première partenaire venue »
      error: '« rest-e » rend un restaurant : 200 Orga A (test)'
```

Correctif : égalité sur un identifiant public unique (slug enregistré), jamais une recherche « contient » limitée à une
ligne.

## 5. Recopies de fonctions et réglages des salles (demande complémentaire)

Vérifié d'abord : main (`4e043098b`) n'a aucune migration absente de cette branche
(`git diff --name-only HEAD origin/main -- supabase/migrations` ne cite que les 9 fichiers de la 11a). La « dernière
version dans main » d'une fonction est donc sa dernière définition dans un fichier antérieur à `20261123000101`.

| Contrôle | Résultat |
|---|---|
| 9 recopies : chaque ligne de la version de main (commentaires et blancs retirés) présente dans le corps en base (`pg_proc.prosrc`) après toutes les migrations ; corps en base = version de la 11a | BLOQUÉE ×9 : **aucune ligne perdue** |
| Lignes de main remplacées : 11 au total, chacune par sa version élargie aux tables, listée dans le test avec sa remplaçante (présente en base) | BLOQUÉE : `'halls.full_payment_margin_hours') THEN` → `'halls.full_payment_margin_hours',` (liste prolongée des `tables.*`) ; `'halls.validation_required') THEN` → `…, 'tables.validation_required') THEN` ; filtre des défauts `…|halls)\.` → `…|halls|tables)\.` ; `hall_reservation_id` → `hall_reservation_id,` + `table_reservation_id` ; `= 'HALL_RESERVATION'` → `IN ('HALL_RESERVATION', 'TABLE_RESERVATION')` (avis de remboursement, relevés ×3) ; SMS groupé des admins : `VENUE_SUBMITTED` ajouté, compte des partenaires identique pour les anciennes sortes |
| 12 réglages `halls.*` (clés de `finance_setting_set` de main) : en base, lus par `GET /api/admin/finance-settings`, dans `platform_settings_defaults`, modifiables par le SUPERADMIN par la fonction, valeurs invalides (−1, 10⁹, « abc » ; « abc », 5 pour un booléen) refusées, valeur inchangée | BLOQUÉE ×12 (`halls.full_payment_margin_hours` : 24, `INVALID_VALUE` ×3, inchangé) |
| `PUT /api/admin/finance-settings` par le SUPERADMIN, même valeur, pour les 12 `halls.*` et les 10 `tables.*` | **TROU T7** : 22 refusés sur 22 |

```
[CV11A] 5.1 finance_setting_set : {"main":"20261122000010_l10a_cv_paiement_en_une_fois.sql","l11a":"20261123000101_l11a_reglages.sql","lignesMain":38,"perdues":[],"remplacantesAbsentes":[],"versionEnBaseDifferenteDe11a":0}
[CV11A] 5.1 fin_setting_valid : {"main":"20261122000010_l10a_cv_paiement_en_une_fois.sql","l11a":"20261123000101_l11a_reglages.sql","lignesMain":69,"perdues":[],"remplacantesAbsentes":[],"versionEnBaseDifferenteDe11a":0}
[CV11A] 5.1 platform_settings_defaults : {"main":"20261122000001_l10a_reglages.sql",…,"lignesMain":9,"perdues":[],…}
[CV11A] 5.1 fin_payout_available_at : {"main":"20261122000004_l10a_paiement.sql",…,"lignesMain":20,"perdues":[],…}
[CV11A] 5.1 calculate_referral_commissions : {"main":"20261122000004_l10a_paiement.sql",…,"lignesMain":81,"perdues":[],…}
[CV11A] 5.1 notif_cashouts_notify : {"main":"20261122000005_l10a_annulation.sql",…,"lignesMain":236,"perdues":[],…}
[CV11A] 5.1 notif_admin_review_sms : {"main":"20261112000001_lot9quinquies_admin_sms.sql",…,"lignesMain":75,"perdues":[],…}
[CV11A] 5.1 finance_admin_earned : {"main":"20261122000012_l10a_cv_releves.sql",…,"lignesMain":76,"perdues":[],…}
[CV11A] 5.1 finance_admin_payments : {"main":"20261122000012_l10a_cv_releves.sql",…,"lignesMain":69,"perdues":[],…}
[CV11A] 5.2b : {"halls.balance_due_days":"400 Réglage invalide (clé finance.*, access.*, notif.*, features.* ou support.*, valeur, motif d’au moins 3 caractères).", … "halls.full_payment_margin_hours":"400 Réglage invalide (clé finance.*, …", … "tables.cancel_free_hours":"400 Réglage invalide (clé finance.*, …", …}
    not ok 2 - route de l’administration (PUT, SUPERADMIN, même valeur) : chaque réglage des salles et des tables est enregistrable
      error: |-
        réglages refusés par la route du SUPERADMIN : 22 sur 22
```

### T7 — réglages des salles et des tables non modifiables par l'écran (moyenne)

`app/api/admin/finance-settings/route.ts:71-72` (`PutSchema`) n'accepte que `^(finance|access|notif|features|support)\.`,
alors que `finance_setting_set`, la lecture (`SETTING_KEYS_FILTER`) et la page (`app/admin/finance-settings/page.tsx:113`)
connaissent `halls.*` et `tables.*`. Même ligne dans main (`git show origin/main:app/api/admin/finance-settings/route.ts`,
ligne 72) : défaut de la 10a, repris tel quel par la 11a. Aucun argent en jeu, mais les décisions du client « en
réglage » (frais, commission, acompte, délais, validation obligatoire, marge de paiement en une fois) ne se changent
pas depuis l'administration.

Correctif : ajouter `halls` et `tables` à l'expression de `PutSchema` (et au message), la validation restant celle de
`fin_setting_valid`.

## Runs

| Run | Commit | Mode | Résultat |
|---|---|---|---|
| 405 | `4028160d6` | rapide : cv11a-1..4 + tests/audit + tests/audit-auth (51 suites) | 48/51 : seules cv11a-2 (10/13), cv11a-3 (8/10), cv11a-4 (11/14) rouges, exactement les tests des trous T1 à T6 ; cv11a-1 (15/15) et les 47 autres suites d'audit vertes ; typecheck et lint verts ; invariants à 0 |
| 407 | `d82f957eb` | rapide : cv11a-5 | 10/11 : seul le test de la route PUT (T7) rouge ; 9 recopies et 12 réglages verts |

Aucun défaut de montage : aucune assertion changée entre les runs. Journaux bruts : branche `ci-results`,
`runs/405-44340472669/test-logs/tests__audit__cv11a-*.log`, `runs/407-44345344275/test-logs/tests__audit__cv11a-5-recopies.test.ts.log`.
