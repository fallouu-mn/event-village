# Contre-vérification du lot 10a — Salles : argent et sécurité

Branche `audit/lot10a`, partie de `lot10a/salles-argent` à `11cc55a10` (rapport `docs/lot10a-rapport.md`). Tests seuls,
aucun correctif, rien fusionné, aucun test distant, `.env.local` non lu. Interrupteur des salles ouvert seulement dans
les suites (`openHallsService`, valeur d'origine remise à la fin).

Suites : `tests/audit/cv10a-1-argent`, `-2-reservation`, `-3-annulation`, `-4-droits` (+ `cv10a-helpers.ts`). Chaque
test décrit le comportement sûr : **vert = BLOQUÉE, rouge = TROU**. Le temps qui passe est simulé comme dans les suites du
lot (`l10a-annulation.test.ts:212`) : on recule une échéance ou la date de création d'un paiement, jamais l'horloge.

## Résumé : 6 trous, aucun critique

| # | Trou | Gravité | Point |
|---|---|---|---|
| T1 | `GET /api/partner/halls/[id]` : toute session lit n'importe quelle salle (même non validée) avec **toutes ses réservations** (client, note, montants) et le téléphone de la partenaire | **élevée** | 4 |
| T2 | Une réservation échue est relancée par un simple paiement, **sans contrôle** de la salle (suspendue), de la partenaire (suspendue) ni de la limite de 3 attentes | moyenne | 2 |
| T3 | L'acompte confirmé **après** l'échéance du solde est encaissé, puis la tâche annule d'office : **126 000 F perdus** (règle stricte) | **élevée** | 1 |
| T4 | Acompte proposé alors que le solde est dû **10 à 29 minutes** plus tard (réservation à J-7 + quelques minutes) | moyenne | 1 |
| T5 | Limite de 3 réservations non payées contournée par des réservations simultanées (5 tenues sur 10 demandes) | faible | 2 |
| T6 | Un paiement avec commission (réglage `halls.commission_rate` > 0) viole l'invariant financier (d) de la plateforme ; la répartition elle-même est juste | faible | 1 |

T1 existait avant le lot (`git show 0f8a7ccd2:lib/halls/hall.service.ts:136`) ; le lot ne l'a pas fermé alors qu'il
traitait la lecture des salles (F6).

## 1. Argent

| Attaque | Résultat |
|---|---|
| Montants et autre client dans le corps de la réservation (`totalAmount: 1`, `commission_rate: 100`, `client_id` d'un autre…) | BLOQUÉE : 420 000 / 126 000 / 294 000, client de la session |
| Montant dans le corps du paiement (`amount: 1`) | BLOQUÉE : 126 000 |
| Salle sans prix : validation, puis prix retiré après validation ; prix 0, −5, 0,5, vide par la route | BLOQUÉE : `PRICE_MISSING` (409), 400 |
| À l'heure sans prix horaire | BLOQUÉE : `HOURLY_NOT_OFFERED` |
| Acompte 0 (pourcentage, fixe), 0,5 %, −10 %, 101 %, fixe −1 ou 10,5 ; écriture directe en base | BLOQUÉE : 400 ; contrainte `halls_deposit_chk` |
| Acompte 100 % : « acompte » et « solde » demandés | BLOQUÉE : `FULL_PAYMENT_REQUIRED`, `DEPOSIT_FIRST` ; intégral 105 000 |
| Acompte fixe 5 000 000 F pour 100 000 F | BLOQUÉE : plafonné, paiement en une fois (105 000) |
| 22 durées et dates invalides par la route (−1, 0, 31, 2³¹, 1e21, 1,5, « abc », vide, 25 h, 23:30 + 1 h, 24:00, 10:15, 99:99, 22:00 + 3 h, 2027-13-45, 2027-02-30, + 600 jours, 1900) | BLOQUÉE : toutes 400, aucune réservation |
| Unités en texte par la fonction (`'99999999999'`, `'-5'`, `'1e3'`, `'2.5'`, `''`) | BLOQUÉE (`' 3'` lu 3 jours, sans effet d'argent) |
| Salle à 3 F : 4 F en deux paiements, 3 F pour la salle ; annulation à 50 % | BLOQUÉE : 2 F rendus ; la salle rend 2 F sur 3 (arrondi ≤ 0,5 F par paiement) |
| Commission 10 % + parrain, acompte 126 000 puis 50 % rendu (transaction annulée) | BLOQUÉE pour l'argent : salle 108 000 puis −54 000, Event Village 16 110 net puis −9 000, commission 805,50 puis 402,75 ; **TROU T6** pour l'invariant |
| Solde avant l'acompte | BLOQUÉE : `DEPOSIT_FIRST`, aucun paiement |
| Acompte, acompte et intégral lancés en même temps | BLOQUÉE : `201`, `PAYMENT_PENDING` ×2 |
| Acompte abandonné (61 min) puis payé après un intégral | BLOQUÉE : rendu en entier (126 000), aucune vente |
| Solde payé deux fois | BLOQUÉE : second rendu (294 000) |
| Webhook rejoué 3 fois | BLOQUÉE : une vente (200 000) |
| Paiement après l'expiration, date reprise par un autre | BLOQUÉE : rendu 210 000, l'autre garde la date |
| Paiement après l'annulation par le client | BLOQUÉE : rendu 210 000 |
| Réservation à J-7 + quelques minutes | **TROU T4** |
| Acompte lancé avant l'échéance du solde, confirmé après | **TROU T3** |
| Annulations simultanées (client ×3, salle, Event Village, tâche) | BLOQUÉE : une seule (200), 63 000 + 147 000 |
| Annulation par la salle d'une réservation payée en deux fois ; seconde annulation ; second remboursement direct du même paiement | BLOQUÉE : 126 000 + 294 000 = payé, salle à 0, Wave gardé par Event Village ; `NOT_CANCELLABLE` ; idempotent |

### T3 — acompte confirmé après l'échéance, perdu (élevée)

Réservation stricte à 20 jours, acompte lancé avant l'échéance du solde, Wave confirme une minute après l'échéance :
`hall_payment_confirm` encaisse (`ACOMPTE_PAYE`), le solde est refusé (`BALANCE_DEADLINE_PASSED`), la tâche passe la
réservation en « Délai de paiement dépassé » et applique la règle à l'échéance : 0 % rendu. La tâche attend un **solde**
lancé avant l'échéance (`20261122000005:251`), jamais un **acompte**.

```
[CV10A] 1.7d : {"confirm":"ACOMPTE_PAYE","solde":"409 BALANCE_DEADLINE_PASSED","state":"DELAI_DEPASSE","paid":126000,"refunded":0}
    not ok 4 - acompte lancé avant l’échéance du solde, confirmé après : le client ne perd pas son acompte
      error: 'acompte encaissé après l’échéance puis réservation annulée d’office : 126000 F perdus (DELAI_DEPASSE, solde 409 BALANCE_DEADLINE_PASSED)'
```

Correctif : dans `hall_payment_confirm`, un acompte confirmé après `balance_due_at` est remboursé en entier (comme un
paiement impossible à honorer) au lieu d'être encaissé.

### T4 — acompte proposé à quelques minutes de l'échéance du solde (moyenne)

`hall_quote` n'exige le paiement en une fois qu'à moins de 7 jours (`v_start - v_now < 7 jours`) : une réservation faite à
J-7 + 10 min propose un acompte avec un solde dû 10 minutes plus tard ; s'il n'est pas payé à temps, la règle s'applique
(modérée 50 %, stricte 0 %).

```
[CV10A] 1.7c : {"full":false,"balance_due_at":"2026-11-18T12:30:00+00:00","dueInMin":10,"deposit":6300}
    not ok 3 - acompte proposé quand le solde est dû quelques minutes plus tard (réservation à J-7 + quelques minutes)
      error: 'acompte de 6300 F proposé, solde dû dans 29 min'      (run 382 ; 10 min au run 381)
```

Correctif : `hall_quote` exige le paiement en une fois tant que l'échéance du solde tombe dans moins de 24 h (marge à
régler).

### T6 — commission et invariant financier (faible)

La répartition est juste au franc près (ci-dessus), mais l'invariant (d) du lot 3 suppose « reversement = facial » et
« net EV = service − agrégateur » ; dès qu'un administrateur règle `halls.commission_rate` au-dessus de 0, chaque paiement
de salle est signalé. Au run 379, le paiement laissé en base a rendu rouges **toutes** les suites suivantes ; le cas tourne
désormais dans une transaction annulée.

```
[CV10A] 1.5b : {"rate":5,...,"pay":{"amount":"126000.00","facial_amount":"120000.00","service_fee":"6000.00","partner_payout_amount":"108000.00","aggregator_fee":"1890.00","net_event_village_revenue":"16110.00"},"vente":"108000.00","comm":"805.50",...,"refund":{"amount":"63000.00","facial_part":"54000.00","service_part":"9000.00","net_revenue_reversal":"9000.00"},"rembt":"-54000.00","commAfter":"402.75","sponsorLedger":"402.75"}
    not ok 2 - un paiement de salle avec commission respecte l’invariant financier (d) de la plateforme
        invariant (d) violé par un paiement avec commission : [{"regle":"d","objet":"3cbd7207-…","detail":"reversement 108000.00 ≠ facial 120000.00"},{"regle":"d","objet":"3cbd7207-…","detail":"net EV 16110.00 ≠ 6000.00 − agrégateur 1890.00"}]
```

Correctif : étendre l'invariant (d) (et les relevés qui le supposent) à « reversement = facial − commission » et « net
EV = service + commission − agrégateur » pour les paiements de salle.

## 2. Réservation

| Attaque | Résultat |
|---|---|
| 8 clients, même journée, en même temps | BLOQUÉE : une 200, sept `SLOT_TAKEN` |
| 3 jours contre heures et journées en même temps | BLOQUÉE : un créneau tenu, aucun chevauchement |
| Créneaux qui se touchent (22:00–24:00 la veille, lendemain, 10–12 puis 12–14) ; recouvrements (23:00 le dernier jour, 13:30) | BLOQUÉE : acceptés ; `SLOT_TAKEN` |
| Heure de Dakar : journée d'aujourd'hui, 00:00 aujourd'hui ; échéance du solde ; même devis sous UTC, Kiritimati (+14), Los Angeles, Dakar | BLOQUÉE : `DATE_PASSED` ; J-7 00:00 UTC ; devis identiques |
| Partenaire EN_ATTENTE, SUSPENDU, REJETE ; salle SUSPENDUE, inactive, en attente, refusée | BLOQUÉE : `HALL_NOT_AVAILABLE` |
| Réservation échue relancée par un paiement : salle suspendue, partenaire suspendue | **TROU T2** |
| Date passée (hier, aujourd'hui, 1970, période commencée hier) | BLOQUÉE : `DATE_PASSED` |
| 4e attente à la suite | BLOQUÉE : `TOO_MANY_PENDING` |
| 10 salles réservées en même temps | **TROU T5** |
| 3 attentes + 2 réservations échues relancées | **TROU T2** |
| Autre client dans le corps ; payer la réservation d'un autre ; réserver sa propre salle | BLOQUÉE : client de la session ; `RESERVATION_NOT_FOUND` ; `OWN_HALL` |

### T2 — relance d'une réservation échue sans contrôle (moyenne)

`hall_payment_create` remet une réservation `EXPIREE` (ou une attente échue) en attente si la date est libre
(`20261122000004:125-148`), sans refaire les contrôles de `hall_quote`/`hall_reserve` : salle suspendue ou désactivée,
partenaire suspendue, limite de 3 attentes. Un client relance ainsi des dates sur une salle fermée par l'administration
et tient plus de 3 dates sans payer.

```
[CV10A] 2.2 relance salle suspendue : 201 {"success":true,"payment_id":"7b17b6f7-…","status":"PENDING","amount":63000,… → EN_ATTENTE_PAIEMENT
    not ok 7 - réservation échue relancée par un paiement après la suspension de la salle : refusée
      error: 'paiement lancé sur une salle suspendue'
[CV10A] 2.2 relance partenaire suspendue : 201 {"success":true,"payment_id":"0949ad22-…","status":"PENDING","amount":210000,…
    not ok 8 - réservation échue relancée par un paiement après la suspension de la partenaire : refusée
      error: 'paiement lancé chez une partenaire suspendue'
[CV10A] 2.4c : {"relances":[201,201],"held":"5"}
    not ok 3 - 3 attentes, puis deux réservations échues relancées par un paiement : au plus 3 dates tenues sans paiement
      error: '5 dates tenues sans paiement par le même client'
```

Correctif : avant de reprendre la date, `hall_payment_create` refait les contrôles de disponibilité de `hall_quote` (salle,
validation, partenaire) et la limite de 3 attentes du client.

### T5 — limite de 3 attentes, réservations simultanées (faible)

Le verrou de `hall_reserve` est par salle ; le compte des attentes du client n'est pas protégé : 10 demandes simultanées
sur 10 salles en laissent passer 5.

```
[CV10A] 2.4b : {"replies":[200,429,200,200,429,200,200,429,429,429],"pending":5}
    not ok 2 - 10 salles différentes réservées en même temps : au plus 3 attentes
      error: '5 réservations non payées tiennent des dates en même temps'
```

Correctif : prendre aussi un verrou par client (`pg_advisory_xact_lock` sur `client_id`) avant de compter ses attentes.

## 3. Annulation : tout BLOQUÉ

Réservation à l'heure (10 500 F payés), annulée par la route du client, quelques minutes de part et d'autre du seuil
(« plus » : 9,6 min au-delà, « moins » : 20,4 min en deçà, run 381) :

```
[CV10A] 3.1 SOUPLE 7 plus : {"start":"2026-11-25 12:30","marginMin":9.6,"pct":100,"refunded":10500,…}
[CV10A] 3.1 SOUPLE 7 moins : {"start":"2026-11-25 12:00","marginMin":-20.4,"pct":50,"refunded":5250,…}
[CV10A] 3.1 MODEREE 30 plus : {…"pct":100,"refunded":10500…}     3.1 MODEREE 30 moins : {…"pct":50,"refunded":5250…}
[CV10A] 3.1 MODEREE 7 plus : {…"pct":50,"refunded":5250…}        3.1 MODEREE 7 moins : {…"pct":0,"refunded":0…}
[CV10A] 3.1 STRICTE 30 plus : {…"pct":50,"refunded":5250…}       3.1 STRICTE 30 moins : {…"pct":0,"refunded":0…}
```

| Attaque | Résultat |
|---|---|
| Client qui annule la réservation payée d'un autre | BLOQUÉE : 404, rien ne bouge |
| Salle qui annule ou « vérifie » la réservation d'une autre salle ; route de l'administration | BLOQUÉE : 404, 404, 403 ; motif de contrôle seul refusé (`REASON_REQUIRED`) |
| Annulation après le début (client, salle) ; après la fin (Event Village) | BLOQUÉE : `ALREADY_STARTED` ×2, `ALREADY_ENDED`, aucun remboursement |
| Délai dépassé : tâche ×3, route de la tâche ×2 et annulation du client en même temps | BLOQUÉE : un remboursement (63 000) |
| Solde lancé avant l'échéance, confirmé > 1 h après, réservation annulée pour délai | BLOQUÉE : solde rendu (294 000), aucune vente |
| Solde lancé avant l'échéance, confirmé dans l'heure | BLOQUÉE : payée, la tâche n'annule pas |

## 4. Droits et données

| Attaque | Résultat |
|---|---|
| REST : réservation, paiement (numéro payeur), compte du client, réservations imbriquées dans la salle, versements — par un autre client, une autre salle, un visiteur, un administrateur sans code | BLOQUÉE : 0 ligne partout (versements : 42501) |
| REST : compte (nom, numéro) du client par sa propre salle | BLOQUÉE ; la salle lit le numéro payeur de ses paiements (`payments_read`, comme pour les billets : constat) |
| `GET /api/partner/halls/[id]` par un autre client, une autre salle ; salle non validée | **TROU T1** |
| `/api/halls/[id]`, `/api/halls`, `/api/partner/halls` d'une autre partenaire, `/api/orders` ; `/api/admin/services` sans code | BLOQUÉE ; 403 |
| Droits d’exécution des 20 fonctions (`hall_*`, `check_hall_availability`, `finance_setting_set`, `calculate_referral_commissions`, `fin_payout_available_at`) | BLOQUÉE : anon et authenticated à false |
| Appel REST de chaque fonction (16) par visiteur, client, salle, administrateur avec code | BLOQUÉE : aucun accepté |
| Validation par un admin sans `partners.validate`, sans code, suspendu ; par la partenaire ; par un client ; par la fonction | BLOQUÉE : 403 (`PERMISSION_MISSING`, `ADMIN_PASSWORD_REQUIRED`, `ACCOUNT_NOT_ACTIVE`…), `FORBIDDEN` |
| Statut de validation écrit par la partenaire (modification, création) ; création par une partenaire suspendue, en attente, refusée | BLOQUÉE : reste en attente ; 403 |
| Prix ×10, acompte 100 %, règle stricte, frais 20 %, part intermédiaire 10 % après la réservation | BLOQUÉE : solde 294 000, remboursement 63 000 + 147 000 (règle figée) |

### T1 — réservations d'une salle lues par n'importe quelle session (élevée)

La route exige une session active, puis `HallService.getHallById` lit par la clé de service
`'*, partners(company_name, phone, user_id), hall_reservations(*)'` sans vérifier le propriétaire
(`lib/halls/hall.service.ts:205`) : identifiant du client, note libre (numéro de téléphone dans le test), montants, motifs
d'annulation de toutes les réservations, téléphone et compte de la partenaire, salles non validées comprises.

```
[CV10A] 4.2 un autre client : HTTP 200 {"success":true,"hall":{"id":"f2ca317a-…","partner_id":"df613426-…",…,"validation_status":"VALIDEE",…
    not ok 1 - GET /api/partner/halls/[id] par un autre client : ni réservations, ni identité, ni note du client
      error: 'réservation 9b390a9a-25e6-40e0-a572-45a4df23169d révélée'
    not ok 2 - GET /api/partner/halls/[id] par une autre salle : ni réservations, ni identité, ni note du client
      error: 'réservation 9b390a9a-25e6-40e0-a572-45a4df23169d révélée'
    not ok 3 - GET /api/partner/halls/[id] d’une salle non validée par un autre client : introuvable
      error: 'HTTP 200 {"success":true,"hall":{"id":"20dc3ecb-…",…,"validation_status":"EN_ATTENTE_VALIDATION",…'
```

Correctif : la route n'accepte que la partenaire propriétaire (`partner_id` résolu depuis la session, sinon 404) et ne
renvoie que les colonnes utiles.

## Défauts de montage corrigés pendant l'audit (aucune assertion d'attaque changée)

| Run | Défaut | Correctif |
|---|---|---|
| 379 | Le cas « commission 10 % » laissait un paiement qui viole l'invariant (d) : toutes les suites suivantes rouges à leur contrôle de fin | cas rejoué dans une transaction annulée (constat gardé : T6) |
| 379 | « Administrateur sans code » : seul `admin_session_codes` retiré, les routes lisent aussi `admin_devices` et `admin_session_activity` | les trois retirés |
| 381 | Empreinte du jeton de rappel factice refusée (`payments_callback_token_hash_check`) | 64 caractères hexadécimaux |

## Runs

| Run | Commit | Mode | Résultat |
|---|---|---|---|
| 379 | `1009830f0` | rapide : cv10a + audit (41 suites) | rouge ; défauts de montage ci-dessus, cascade de l'invariant (d) |
| 381 | `1a78fab07` | rapide : cv10a + audit (41 suites) | 38/41 : seules cv10a-1, -2, -4 rouges (trous) ; cv10a-3 et les 37 autres suites d'audit vertes |
| 382 | `3b597ef51` | rapide : cv10a-1 | 21/24 : les 3 rouges sont T3, T4, T6 |
| **383** | `4e4903cfd` | **complet** (4 lots, 488 suites) | **485/488** ; seules cv10a-1 (21/24), cv10a-2 (15/19), cv10a-4 (9/12) rouges, exactement les tests des trous T1 à T6 ; cv10a-3 (14/14) et les 37 autres suites d'audit vertes ; build, budgets JS, e2e verts ; 38 min 13 s |

Run 383, mêmes trous, valeurs du jour : T5 `{"replies":[200,429,200,429,200,429,429,429,200,429],"pending":4}` (4 attentes
au lieu de 5 : la course dépend de l'ordre d'arrivée) ; T2 `{"relances":[201,201],"held":"5"}` ; T4 solde dû dans 23 min ;
T3 `{"confirm":"ACOMPTE_PAYE","solde":"409 BALANCE_DEADLINE_PASSED","state":"DELAI_DEPASSE","paid":126000,"refunded":0}`.
Journaux bruts : branche `ci-results`, `runs/383-44305228735/test-logs/tests__audit__cv10a-*.log`.
