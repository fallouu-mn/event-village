# Contre-vérification du lot 10b — Salles : écrans et parcours complet

Branche `lot10b/rouges` (jamais fusionnée), partie de `lot10b/salles-ecrans` à `2e5be7ad6`. Tests seuls, aucun
correctif, branche du lot non modifiée, aucune migration appliquée, aucun appel au projet distant, `.env.local` non lu.
Le rapport du lot (`docs/lot10b-rapport.md`) n'a servi qu'à repérer ses affirmations : chacune a été revérifiée dans le
code et par un test.

Suites : `tests/audit/cv10b-1-droits`, `-2-visibilite`, `-3-avis` (+ `cv10b-helpers.ts`). Chaque test décrit le
comportement sûr : **vert = attaque BLOQUÉE, rouge = TROU**. Routes appelées par leurs gestionnaires réels (session par
jeton) ; attaques REST avec la clé anon et le jeton de l'attaquant, jamais la clé de service.

Run rapide **456** (`9ff97d079`, `ci-rapide` des 3 suites) : typecheck OK, lint OK, **19 tests, 11 verts (G1 à G7), 8
rouges (T1 à T8)**, chaque rouge sur le comportement visé, aucune précondition en défaut ; invariants du lot 10a et
financiers verts en fin de suite.

```
1-droits.log: # tests 8 # pass 6 # fail 2
2-visibilite.log: # tests 5 # pass 3 # fail 2
3-avis.log: # tests 6 # pass 2 # fail 4
TOTAL : 3 suite(s) — 0 réussie(s), 3 en échec, 0 expirée(s)
typecheck  OK     code 0   39 s
lint       OK     code 0   12 s
```

## Résumé : 8 trous, aucun critique, aucun élevé

| # | Trou | Gravité | Point |
|---|---|---|---|
| T1 | Fiche partenaire SUSPENDU (compte ACTIF) : modifier une salle validée, la supprimer, **annuler la réservation payée d'un client** restent ouverts | moyenne | 1 |
| T5 | La **note du client** d'une réservation **non payée** (texte libre, ici son numéro) est lue par la salle par la REST, alors que l'écran la cache jusqu'au paiement | moyenne | 5 |
| T2 | Un administrateur qui n'a que `halls.validate` lit le **téléphone et l'email** de la partenaire (contacts réservés à `partners.read`) | faible | 1, 2 |
| T3 | Réglage `halls.validation_required` désactivé : une salle restée **non validée** est réservable (invisible mais réservable) | faible | 6 |
| T4 | Salle d'une partenaire **suspendue** : 404 dans l'application, mais lisible par **n'importe qui** par la REST | faible | 1, 6 |
| T6 | Salle validée modifiée (prix, nom, adresse, photos) : avis aux administrateurs **sans SMS** (3 canaux sur 4) | faible | 5 |
| T7 | Rappels du solde écrits en dur à J-10 et J-8 de la date : avec `halls.balance_due_days` = 14 (réglage admis 1 à 60), **aucun rappel** avant l'échéance | faible | 4, 5 |
| T8 | Rappel du solde mis en file de jour, **SMS envoyé la nuit** si l'envoyeur passe dans la plage du réglage (nuit non revérifiée à l'envoi) | faible | 5 |

Écartés après vérification (pas de test rouge) : `hall_reservation_cancel` lit encore `has_admin_permission` (ancienne
fonction sur `users.role`), mais `users.role` est recopié de `user_roles` par le trigger `sync_user_roles_to_jwt`
(`20261031000010_lot1c5_roles_hors_metadonnees.sql:33`) : pas de refus à tort pour un ADMIN. La suspension officielle
(`partner_status_set`, `20261117000001_f3a_securite.sql:104-105`) suspend aussi le compte et révoque ses sessions : T1 ne se
produit que si la fiche est SUSPENDU avec un compte resté ACTIF (état prévu par la garde du lot 9 quinquies), d'où
« moyenne » et non « élevée ».

## 1. Routes et fonctions nouvelles : session, droit, propriété, état

| Attaque | Résultat |
|---|---|
| Autre partenaire : GET, PUT (`name`, `price_per_day: 1`), DELETE, renvoi en validation de la salle d'autrui | BLOQUÉE : 404 `HALL_NOT_FOUND` ×4, salle inchangée (G1) |
| Autre partenaire : détail d'une réservation, calendrier filtré `?hall=<salle d'autrui>`, CANCEL, CONFIRM, recettes | BLOQUÉE : 404, `reservations: []`, 404, 404, `rows: []` ; réservation toujours `ACOMPTE_PAYE` (G1) |
| Autre client : détail, aperçu d'annulation, annulation, « Mes réservations » | BLOQUÉE : 404 ×3, absente de sa liste (G2) |
| Fiche SUSPENDU, compte ACTIF : PUT, DELETE, annulation | **TROU T1** |
| Fonctions nouvelles (`hall_submit`, `hall_search`, `hall_calendar`, `hall_cancel_preview`, `hall_partner_earnings`) | réservées au rôle de service (`20261126000002:535-544`), propriété contrôlée en base (`hall_submit:267`, `hall_cancel_preview:464`, `hall_partner_earnings:502`) |

```
[CV10B] G1 réservation d’autrui : {"detail":"HTTP 404 …RESERVATION_NOT_FOUND","list":"HTTP 200 {…\"reservations\":[]}","cancel":"HTTP 404 …RESERVATION_NOT_FOUND","confirm":"HTTP 404 …RESERVATION_NOT_FOUND","earnings":"HTTP 200 {…\"rows\":[]}"}
[CV10B] G2 client d’autrui : {"detail":"HTTP 404 …","preview":"HTTP 404 …","cancel":"HTTP 404 …"}
```

### T1 — fiche SUSPENDU : les écritures des salles restent ouvertes (moyenne)

La règle du lot 9 quinquies (`lib/auth/partner-fiche-guard.ts:7-11`) : fiche SUSPENDU = lectures gardées, toute
écriture refusée. `partnerEventWrite` (`:86-95`) ne vise que `/api/partner/events`, `upload`, `team`, `shifts` ;
l'inventaire des écritures (`tests/parcours/f2acv-ecritures-fiche.test.ts:65-68`) laisse les salles « à trancher à son
ouverture » — le lot 10b ouvre le service sans trancher. En base, `hall_reservation_cancel` (origine `SALLE`,
`20261122000005:189-192`) ne contrôle que le compte ACTIF, pas la fiche ; `updateHall` et `deleteHall` passent par
`assertOwnHall` (`lib/halls/hall.service.ts:258-267`), sans statut.

```
[CV10B] T1 fiche suspendue : {"put":"HTTP 200 {\"success\":true,\"hall\":{…\"name\":\"Salle renommée pendant la suspension\",…\"price_per_day\":1000000,…\"validation_status\":\"VALIDEE\"…","cancel":"HTTP 200 {\"success\":true,\"message\":\"Réservation annulée. Le client est remboursé de 94 500 F CFA.\"…}","del":"HTTP 200 {\"success\":true}", …"salle":{"name":"Salle renommée pendant la suspension","price_per_day":1000000,"validation_status":"VALIDEE"},"salle_supprimee":true,"reservation":"ANNULEE_SALLE"}
    not ok 1 - modifier une salle validée, la supprimer, annuler une réservation payée → 403 PARTNER_SUSPENDED attendu
        modification d'une salle validée par une fiche SUSPENDU : HTTP 200 {"success":true,"hall":{…
        200 !== 403
```

La salle reste VALIDEE avec son nouveau prix : à la réactivation de la fiche, elle revient en vente sans nouvel examen.

Correctif : ajouter les écritures `/api/partner/halls*` à `partnerEventWrite` (refus `PARTNER_SUSPENDED`, mise à jour
de l'inventaire `f2acv`) ; en base, exiger la fiche VALIDE dans `hall_reservation_cancel` pour l'origine `SALLE`
(l'annulation d'une salle suspendue passe par Event Village).

## 2. Droit « Valider les salles et les établissements »

| Attaque | Résultat |
|---|---|
| Droit donné d'office (migrations, seed) | BLOQUÉE : aucune insertion dans `admin_permissions` ; en base de test, un seul titulaire, le compte de la suite ; le Superadmin l'a, comme tous les droits (`admin_can`, `20261109000004:73-83`) (G3) |
| Admin avec `events.read`, `events.write`, `partners.validate` mais sans `halls.validate` : file, fiche, décision | BLOQUÉE : 403 `PERMISSION_MISSING` ×3 (G3) |
| Refus avec motif de 3 caractères | BLOQUÉE : refusé (`REASON_REQUIRED`, 5 caractères au moins) |
| Refus avec motif, par un admin avec le droit | accepté (200) ; journal `HALL_VALIDATION_DECIDED`, auteur et motif (G3) |
| Établissements de tables | même droit en route (`app/api/admin/venues/[id]/validation/route.ts:20`) et en base (`20261126000001:117-118`) |
| Contacts de la partenaire lus avec `halls.validate` seul | **TROU T2** |

```
[CV10B] G3 sans halls.validate : {"list":"HTTP 403 …\"code\":\"PERMISSION_MISSING\",\"permission\":\"halls.validate\"}","sheet":"HTTP 403 …","decide":"HTTP 403 …"}
[CV10B] G3 journal : [{"user_id":"26b255e0-…","action":"HALL_VALIDATION_DECIDED","metadata":{"reason":"Photos floues, adresse absente.","decision":"REFUSER"}}]
```

### T2 — contacts de la partenaire sans `partners.read` (faible)

`adminHall` (`lib/halls/queries.ts:574` et `:602`) rend `partners.phone` et `partners.email` à toute personne qui a
`halls.validate`. Partout ailleurs, les contacts d'une partenaire demandent `partners.read` (« Voir … contacts »,
`lib/admin/permission-labels.ts:36` ; `app/api/admin/partners/route.ts:17`).

```
[CV10B] T2 fiche de décision (halls.validate seul) : {"partner":{"id":"157f659b-…","name":"Finance cv10b-proprio","validated":true,"phone":"+221777104562","email":"parcours-pay-part-cv10b-proprio-3b6bfb26fb@test.eventvillage.local","city":"Dakar"}}
    not ok 1 - fiche de décision lue avec halls.validate seul : ni téléphone ni email de la partenaire attendus
```

Correctif : la route passe `auth.permissions.includes('partners.read')` à `adminHall`, qui ne rend téléphone et email
qu'avec ce droit (sinon `null`, et l'écran affiche « réservé au droit Consulter les partenaires »).

## 3. Photos

| Attaque | Résultat |
|---|---|
| Photo du dossier d'une autre partenaire, du dossier `misc/`, nom non réencodé (`photo.jpg`), chemin `../<autre partenaire>/…`, adresse externe | BLOQUÉE : 400 `IMAGE_ORIGIN_INVALID` ×5, salle inchangée (G4) |
| 13 photos | BLOQUÉE : 400 (12 au plus) |
| Type, taille | route de dépôt seule productrice des noms admis : octets JPEG/PNG/WebP reconnus, 5 Mo (`app/api/partner/upload/route.ts:12`, `:76-81`), fiche VALIDE exigée (`:48`) |
| Métadonnées, position GPS | réencodage `sharp` sans `withMetadata` (`lib/images/encode-image.ts:17-23`) : seuls les pixels sont stockés |
| Écriture directe dans le stockage ou dans `halls.images` | aucune politique d'écriture sur `storage.objects` pour `public-images` ; plus aucune politique d'écriture sur `halls` (`20261110000001_lot9ter_rls.sql:38`) |

Réserve : une photo déjà enregistrée sur la salle avant le lot reste acceptée telle quelle (`hall.service.ts:89`) ;
elle n'a pas été réencodée. À reprendre par le script de réencodage des affiches si des salles existent en production.

## 4. Argent

| Attaque | Résultat |
|---|---|
| `totalAmount: 1`, `depositAmount: 1`, `price_amount: 1`, `amount: 1`… dans le corps de la réservation | BLOQUÉE : 180 000 / 9 000 / 189 000 / 56 700 / 132 300, identiques au devis (G6) |
| Montant du paiement | lu en base (`hall_payment_create`) ; `startHallPayment` refuse un montant absent ou nul (`lib/halls/hall-payment.service.ts:65-66`) |
| Échéance du solde | calculée en base (`hall_quote`, `halls.balance_due_days`) : devis `balanceDueAt` = J-7 (`2027-01-21` pour le `2027-01-28`) |
| Aperçu d'annulation contre remboursement réel | BLOQUÉE : aperçu 56 700 (100 %), annulation 56 700, `refunded_amount` 56 700 (G6) |
| Rappels du solde quand le réglage d'échéance change | **TROU T7** (section 5) |

```
[CV10B] G6 devis / réservation : {"quote":{…"priceAmount":180000,"serviceFeeAmount":9000,"totalAmount":189000,"depositAmount":56700,"balanceAmount":132300,"balanceDueAt":"2027-01-21T00:00:00+00:00"…},"reservation":{"price":180000,"fee":9000,"total":189000,"deposit":56700,"balance":132300}}
[CV10B] G6 aperçu / annulation : {"preview":{"refundAmount":56700,"refundPercent":100,"paidAmount":56700,"keptAmount":0,…},"cancel":{…"refundAmount":56700}},"refunded":56700}
```

## 5. Avis

| Étape | Résultat |
|---|---|
| Réservation demandée (client), acompte reçu (client, salle) | 4 canaux chacun (G7) |
| Données d'un avis à la salle | aucun numéro ni email du client (`hall_notif_data`, `20261122000004:22-44`) (G7) |
| Réservation non payée lue par la salle (route) | prénom seul, ni téléphone ni note (G7) |
| Réservation non payée lue par la salle (REST) | **TROU T5** |
| Salle validée modifiée | **TROU T6** |
| Rappels du solde avec une autre échéance | **TROU T7** |
| Rappel envoyé pendant la nuit | **TROU T8** |
| Autres types du parcours | 4 canaux en base (`20261122000007:19-27`, `20261126000003:28-35`) ; salle à valider : 3 canaux + SMS groupé `ADMIN_REVIEW_SMS` reporté à la fin de la nuit |

```
[CV10B] G7 canaux : {"pending":["EMAIL","IN_APP","PUSH","SMS"],"confirmed":["EMAIL","IN_APP","PUSH","SMS"],"toHall":["EMAIL","IN_APP","PUSH","SMS"]}
[CV10B] G7 route salle, réservation non payée : {"clientName":"Awa","clientPhone":null,"notes":null}
```

### T5 — note du client non payée lue par la REST (moyenne)

L'écran ne donne à la salle le téléphone et la note du client qu'après paiement (`lib/halls/queries.ts:412-423`). La
politique `hall_reservations_read` (`0003_rls.sql:177-182`, jamais resserrée) laisse la propriétaire lire **toutes les
colonnes** de toutes les réservations de ses salles avec son jeton, attentes non payées comprises : note, `client_id`.

```
[CV10B] T5 REST de la salle : {"error":null,"rows":[{"id":"c1659973-…","booking_state":"EN_ATTENTE_PAIEMENT","client_id":"0a0e841b-…","notes":"Appelez-moi au 777112889"}]}
    not ok 1 - jeton de la salle + clé anon : la note (et le numéro qu’elle porte) ne doit pas être lisible avant paiement
```

Correctif : retirer la branche `is_partner_owner(partner_id)` de `hall_reservations_read` (la salle lit par ses routes
serveur, qui appliquent la règle) ; à défaut, retirer à `authenticated` le droit de colonne sur `notes`.

### T6 — salle validée modifiée sans SMS (faible)

`ADMIN_HALL_CHANGED` est déclaré sur 3 canaux (`20261126000003:37`) et `halls_notify_admins` (`:66-88`) ne passe pas
par le SMS groupé, contrairement à `ADMIN_HALL_SUBMITTED` (`:63`).

```
[CV10B] T6 salle validée modifiée : {"channels":["EMAIL","IN_APP","PUSH"],"changes":{"city":"Dakar","changes":["PRIX"],…},"refsBefore":["1b5d80b2-…:1902"],"newGroupedRefs":[]}
      error: 'salle validée modifiée : aucun SMS aux administrateurs (canaux EMAIL, IN_APP, PUSH)'
```

Correctif : un élément `HALL_CHANGED` dans `notif_admin_review_sms` (compté avec les salles, reporté à la fin de la
nuit), appelé par `halls_notify_admins` au même endroit que `ADMIN_HALL_CHANGED`.

### T7 — rappels du solde écrits en dur (faible)

`hall_reservations_tick` rappelle à J-10 puis J-8 **de la date** (`20261126000003:254-264`) et seulement avant
l'échéance (`now() < balance_due_at`). L'échéance suit le réglage `halls.balance_due_days` (1 à 60) : dès 11 jours,
l'échéance tombe avant J-10 et aucun rappel ne part jamais.

```
[CV10B] T7 échéance à J-14 : {"start":"2026-12-06","balance_due_at":"2026-11-22T00:00:00+00:00","hoursLeft":57,"tick":{"reminders":0,…},"reminders":0}
      error: 'solde dû dans 57 h, aucun rappel (rappels à J-10 et J-8 de la date seulement)'
```

Correctif : garder J-10 et J-8 pour l'échéance par défaut, mais caler les rappels sur l'échéance
(`balance_due_at - 3 jours` puis `- 1 jour`) quand elle tombe avant ; ou borner `halls.balance_due_days` à 7 au plus.

### T8 — rappel du solde envoyé la nuit (faible)

La tâche ne met les rappels en file que de jour (`20261126000003:219-220`), mais l'envoyeur ne revérifie la plage de
nuit qu'au SMS de la famille OPTIONAL et à `ADMIN_REVIEW_SMS` (`20261123000002_main414_nuit_sms_admins.sql:274-287`).
Un rappel mis en file à 21 h 59, ou relancé après un échec, part en pleine nuit : même défaut que le run 414.

```
[CV10B] T8 envoi simulé la nuit : {"plage":"22 h - 8 h","envoyeur":"2026-11-21T22:30:00.000Z","row":{"status":"SENT","sent_at":"2026-11-21T22:30:00+00:00","due_at":"2026-11-19T15:08:34.300864+00:00","decision":{…"family":"ESSENTIAL",…"outcome":"SEND","delivery":{…"outcome":"SENT","encoding":"GSM7","segments":1}}}}
```

Correctif : dans `notification_outbox_claim`, appliquer le report de nuit (cas `DEFER`, comme `ADMIN_NIGHT`) aux SMS de
`HALL_BALANCE_REMINDER`, `HALL_EVE_REMINDER` et `HALL_EARNINGS_AVAILABLE`.

## 6. Salle non validée, refusée ou suspendue

| Attaque | Résultat |
|---|---|
| Salle EN_ATTENTE, REFUSEE, SUSPENDUE, retirée de la vente : recherche, fiche, calendrier, devis, réservation | BLOQUÉE : absente, 404, ≥ 400, ≥ 400, refusée, pour les 4 (G5) |
| Salle suspendue après la réservation : acompte | BLOQUÉE : 409 `HALL_NOT_AVAILABLE`, aucun paiement créé (G5) |
| Validation désactivée, salle restée en attente | **TROU T3** |
| Salle d'une partenaire suspendue par la REST | **TROU T4** |

```
[CV10B] G5 acompte sur salle suspendue : HTTP 409 {"success":false,"error":"Cette salle n’est pas ouverte à la réservation pour le moment.","code":"HALL_NOT_AVAILABLE"}
```

### T3 — salle non validée réservable quand la validation est désactivée (faible)

`hall_quote` (`20261122000010:206-209`) et `hall_booking_refusal` (`20261122000009:36-38`) n'exigent `VALIDEE` que si
`halls.validation_required` est vrai ; la recherche et la fiche l'exigent toujours (`20261126000002:373`,
`lib/halls/queries.ts:133`). Une salle en attente au moment où le Superadmin désactive la validation devient réservable
par un lien direct, sans examen. La décision du client est « validation obligatoire ».

```
      error: 'salle non validée réservée : {"ok":true,…"hall_id":"96ce12cd-…",…"booking_state":"EN_ATTENTE_PAIEMENT",…"reservation_id":"7786e48c-…",…'
```

Correctif : exiger `validation_status = 'VALIDEE'` dans `hall_quote` et `hall_booking_refusal` quel que soit le réglage
(le réglage désactivé valide déjà les salles à la création et au renvoi).

### T4 — salle d'une partenaire suspendue lisible par la REST (faible)

`halls_read_public` (`20261122000002_l10a_salles_schema.sql:277-281`) : `is_active AND validation_status = 'VALIDEE'`,
sans le statut de la partenaire. Après `partner_status_set` (SUSPENDU), la fiche de l'application répond 404 mais la
REST anonyme rend la salle (toutes ses colonnes).

```
[CV10B] T4 REST anonyme : {"error":null,"rows":[{"id":"aeda1389-…","name":"TEST Salle 10a e85c66c1","partner_id":"d72151af-…","price_per_day":200000,"validation_status":"VALIDEE","is_active":true}]}
```

Correctif : ajouter `EXISTS (SELECT 1 FROM partners pa WHERE pa.id = partner_id AND pa.status = 'VALIDE')` à la branche
publique de `halls_read_public` (ou retirer la lecture anonyme : toutes les lectures publiques passent par le serveur).

## Suites et runs

| Run | Commit | Mode | Résultat |
|---|---|---|---|
| 456 | `9ff97d079` (tests seuls) | rapide, 3 suites cv10b | typecheck OK, lint OK ; 19 tests : G1-G7 verts, T1-T8 rouges |

Branche `lot10b/rouges` à ne pas fusionner. Les suites cv10b deviennent le contrôle « après » des correctifs.
