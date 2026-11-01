# LOT 4 — RAPPORT

**Objet :** contrôle d'accès. Ce lot couvre :
- le QR dynamique et le scan ;
- l'encaissement en espèces, la caisse et le guichet ;
- le PIN régisseur et les limiteurs ;
- la traçabilité des scans, avec le complément « données pour le pilotage ».

Il traite aussi les points ouverts 2 (identité lue dans le corps de la requête) et 9 (statut ambassadeur modifiable par un ADMIN) du lot 3.

**Branche :** `fix/evenementiel`. Aucun push sur `main`. Rien n'a été exécuté contre le projet Supabase distant : tous les tests tournent en CI sur Supabase local. Migrations du dépôt uniquement (`20261101000009` à `…14`), appliquées et testées en CI.

**Date :** 31 octobre 2026.

**Résultat :** **vert.** Run 41 (`41256842470`, commit `3143f36`) : 91 suites sur 91 (620 sous-tests, aucun échec, aucun test ignoré), typecheck, lint et build compris. Au run 34 (référence « avant »), les 12 nouvelles suites des tâches 4.0 à 4.10 étaient en échec, et elles seules. Les références « avant » du complément et des réglages `access.*` sont les runs 36 et 40. L'invariant étendu (a) à (i) donne 0 violation à la fin de chacune des 13 suites du lot.

Deux défauts ont été corrigés en cours de lot, avec un test rouge pour chacun :
- un défaut de concurrence du lot 3 sur les retraits, révélé au run 36 ;
- un écart relevé pendant la rédaction de ce rapport, après le run 38 vert : les réglages `access.*` n'étaient pas modifiables par le SUPERADMIN, mais l'étaient par un ADMIN via `/api/admin/pricing`.

---

## À lire en premier

1. **Deux nouvelles variables d'environnement, obligatoires en production** (`lib/env.ts`, `docs/deploiement-projet-neuf.md`, `.env.example`, `.env.test.example`) :
   - `TICKET_TOTP_MASTER_KEY` : clé des codes dynamiques des billets ;
   - `REGISSEUR_PIN_KEY` : clé du hachage des PIN régisseur.

   Chacune fait au moins 32 caractères et doit être un secret dédié : le serveur refuse de démarrer s'il manque l'une d'elles, ou si elle reprend une autre clé (hook, service_role, OTP, cron, SamirPay). Il n'y a aucun repli. À générer avec `openssl rand -hex 32`. Changer `REGISSEUR_PIN_KEY` invalide tous les PIN en cours ; changer `TICKET_TOTP_MASTER_KEY` invalide les codes affichés, qui se régénèrent d'eux-mêmes en 20 s. Le `.env.test` local de chaque poste doit recevoir ces deux valeurs.
2. **Seul le QR dynamique de l'application ouvre l'entrée à la caméra.**
   - Il a la forme `EVT1:<billet>:<code à 6 chiffres>`. Le code change toutes les 20 s et reste accepté un pas avant ou après.
   - Un numéro de billet, un QR statique, un UUID seul ou un ancien format donnent `dynamic_qr_required`. Le billet n'est pas composté.
   - Le PDF n'a plus de QR : il porte le numéro et la mention « Entrée sans téléphone : présentez une pièce d'identité au contrôle ».
   - La **saisie manuelle** du numéro est une voie distincte. Elle est réservée par défaut au contrôleur affecté, exige la case « pièce d'identité vérifiée » et est journalisée (`ticket_scans.method = 'MANUAL'`, `identity_verified`).
   - Le partage d'un billet ne diffuse plus que le lien de l'événement.
   - Un transfert entre particuliers régénère le numéro, le QR et le secret du billet.
3. **Une seule voie de scan : `POST /api/controller/scan`**, pour le contrôleur affecté, le partenaire propriétaire et l'admin. `/partner/scan` l'utilise ; `/api/tickets/verify` est supprimée.
   - Le droit du scanneur est vérifié avant le code : un scanneur non autorisé reçoit 403 `SCAN_FORBIDDEN`, sans aucune donnée du billet.
   - Le compostage est atomique : deux scans simultanés donnent un seul `valid`.
   - Le paiement est contrôlé : un billet impayé donne `payment_required`, un billet « à régler sur place » donne `cash_required`.
   - Le scan n'est possible que dans une fenêtre réglable, 6 h avant le début et 6 h après la fin par défaut, et pour un événement PUBLIE. Un événement suspendu, annulé ou terminé est refusé, encaissement compris.
4. **Caisse et espèces.**
   - L'encaissement au scan (`PUT /api/controller/scan`, RPC `ticket_cash_checkin`) et la vente au guichet (`POST /api/controller/counter-sale`, RPC `counter_sale`) sont des transactions uniques en base. Elles exigent une caisse ouverte pour tous les rôles et appliquent le prix facial, sans frais Event Village. Le paiement est rattaché à la caisse (`payments.shift_id`), sans écriture au grand livre.
   - Une seule caisse ouverte par contrôleur et par événement (index unique).
   - Plus aucun repli en mémoire dans `ShiftService`.
   - Tant qu'une caisse est ouverte, le retrait d'un contrôleur est refusé en 409 `CONTROLLER_HAS_OPEN_SHIFT` sur tous les chemins, y compris le retrait du rôle (trigger en base).
5. **PIN régisseur.** Il est haché avec `REGISSEUR_PIN_KEY` et un sel propre à l'événement.
   - La génération exige `{ confirm: true }`. Si une caisse est ouverte, elle est refusée en 409 `OPEN_SHIFTS` sauf confirmation explicite (`confirmOpenShifts`). Elle est journalisée.
   - **Exploitation : les anciens PIN sont supprimés par la migration `…11`.** Chaque organisateur doit en régénérer un avant son prochain événement.
6. **Limiteurs.**
   - `lib/security/rate-limiter.ts` est supprimé, ainsi que les tables `rate_limits` et `auth_rate_limits`.
   - Toutes les limites passent par `reserveQuota` : compteur en base, atomique, toutes les tentatives comptées. Le refus est fermé : 429 au-delà du seuil, 503 si le compteur est indisponible.
   - Les SMS non OTP ont une limite par compte déclencheur, et une part du plafond quotidien est réservée à l'OTP.
7. **Traçabilité et pilotage.**
   - Chaque tentative tranchée par le serveur (acceptée, refusée ou interdite) écrit une ligne `ticket_scans`, avec :
     - l'événement, le billet et la catégorie ;
     - le scanneur et son rôle au moment du scan ;
     - le résultat, la saisie manuelle et le point d'entrée ;
     - l'horodatage et l'empreinte du payload (jamais le payload lui-même).
   - Le point d'entrée (« Porte A ») est un champ de l'affectation, modifiable par le partenaire (`PATCH /api/partner/team/entry-point`). Il est recopié sur chaque scan.
   - Seuls le partenaire propriétaire et les admins lisent `ticket_scans`, par API comme par Realtime (publication `supabase_realtime`). Le partenaire B ne reçoit rien des scans de A.
   - L'écran de pilotage n'est pas construit : il est prévu au lot 5.
8. **Failles corrigées, avec un test pour chacune :**
   - commande, salle et table étaient créées au nom du `clientId` reçu, sans session. Elles le sont désormais au nom de la session active ;
   - un ADMIN avec `users.write` changeait le statut ambassadeur, et pouvait aussi supprimer puis recréer la ligne `users` d'un compte par REST (politique `users_admin_manage`, R15) ;
   - un ADMIN avec `pricing.manage` écrivait les réglages `access.*` par `/api/admin/pricing`, sans validation ni historique (relevé pendant la rédaction de ce rapport, section 2, 4.4).
9. **Contrats d'API modifiés**, à connaître pour le front et le scanner :
   - `POST /api/controller/scan` reçoit `{ eventId, payload }` ou `{ eventId, manualTicketNumber, identityVerified: true }` et répond `{ result, scan_id, ticket?, amount_due?, message }`. `result` appartient à l'union partagée de `lib/scan/scan-result.ts`. Les champs `qr_code`, `scan_result` et `stats` n'existent plus ;
   - `PUT /api/controller/scan` reçoit `{ scanId, eventId }` (encaissement d'un scan `cash_required`) ;
   - `GET /api/tickets/<id>/live-code` répond `{ payload, step_seconds, expires_in }`, au porteur seul (404 sinon, 409 si le billet n'est plus VALIDE) ;
   - `POST /api/controller/counter-sale` et `PATCH /api/partner/team/entry-point` sont nouvelles ;
   - `/api/tickets/verify` et `/api/events/<id>/tickets/purchase` sont supprimées ;
   - `GET /api/tickets` ne renvoie plus `qr_code` et ajoute `eventId` ;
   - la génération du PIN exige `{ confirm: true }` ;
   - `/api/admin/users` refuse `referralStatus` à un ADMIN : 403 `REFERRAL_STATUS_SUPERADMIN_ONLY`, et 400 `INVALID_REFERRAL_STATUS` pour une valeur inconnue ;
   - `/api/admin/partners/<id>/status` répond 409 `STATUS_UNCHANGED` pour un statut identique, sans SMS ;
   - `/api/admin/finance-settings` et sa page gèrent aussi les clés `access.*`. La page s'intitule désormais « Réglages de la plateforme ».
10. **Correctif d'un défaut du lot 3** (migration `…14`). Deux demandes de retrait simultanées pouvaient être acceptées toutes les deux, et le solde devenir négatif. La lecture du solde utilisait `now()`, l'heure de début de la transaction, au lieu de l'heure réelle une fois le verrou obtenu. Le défaut est apparu au run 36 (`finance-retraits`, cas 4) ; il est corrigé et testé.
11. **Incident de commit, corrigé.**
    - Le commit `9e2a324` (test du complément) a embarqué par erreur trois suppressions déjà indexées : la route `/api/tickets/verify`, la route d'émission par le staff et la suite `paiement-guichet`. Le typecheck du run 35 a échoué.
    - Le commit `e4fb3aa` les a restaurées à l'identique.
    - Leur suppression a ensuite été faite explicitement dans les commits de correctif 4.3 et 4.6, où elle est justifiée.
12. **Découpage des commits.** Comme aux lots 2 et 3 : un commit de tests rouges par tâche, puis un commit de correctifs par tâche. Les commits intermédiaires ne compilent pas isolément ; seule la tête est vérifiée par la CI. Les migrations `…10` (scan) et `…11` (caisse) sont committées avec 4.1 et 4.5, mais servent aussi aux tâches 4.3, 4.4, 4.6, 4.7 et 4.9.

---

## 1. Commits

| Commit | Message |
|---|---|
| 1c700d5 | test(infra)[4]: outils des suites du contrôle d'accès (réglages access.*, événement à horaire précis, contrôleur affecté, billets à régler sur place, routes de scan, de caisse et de code dynamique) ; invariant (b) : un billet à régler sur place n'est pas une violation |
| 0f7713b | test(securite)[4.0]: commande, salle et table toujours au nom de la session (clientId du corps ignoré, 401 sans session, 403 compte suspendu) ; statut ambassadeur modifiable par le seul SUPERADMIN, valeur validée, plus de voie REST pour un admin |
| d5d7946 | test(acces)[4.1]: caméra : QR dynamique EVT1 seulement, identifiant nu refusé ; saisie manuelle distincte (contrôleur affecté, pièce vérifiée, journalisée) ; PDF sans QR ; partage sans numéro ; ancien propriétaire refusé après transfert ; legacy dynamic-qr-totp test 6 réécrit (refus attendu) |
| a27b91d | test(acces)[4.2]: clés TICKET_TOTP_MASTER_KEY et REGISSEUR_PIN_KEY obligatoires sans repli ; secret par billet émis, lu et régénéré au transfert ; tolérance ±1 pas de 20 s, comparaison en temps constant ; live-code réservé au porteur |
| debf301 | test(acces)[4.3]: voie de scan unique : partenaire B refusé sans information, double scan simultané → un seul valide, billet impayé → paiement exigé, partenaire et admin par la RPC atomique ; /api/tickets/verify supprimée |
| 0c491ca | test(acces)[4.4]: scan et encaissement refusés hors de la fenêtre réglée (6 h avant le début, 6 h après la fin), pour un événement non PUBLIE, suspendu ou ANNULE |
| f8db641 | test(caisse)[4.5]: encaissement espèces transactionnel (commande réellement impayée, montant par billet, caisse ouverte pour tous les rôles, prix facial sans frais EV, rien composté en cas d'échec) ; une seule caisse ouverte ; contraintes RESTRICT |
| 8962c61 | test(caisse)[4.6]: vente au guichet en espèces (contrôleur affecté, permission espèces, caisse ouverte, contrôles de vente, billet valide, caisse incrémentée, revenu Event Village nul, rien au grand livre) |
| 8e6df75 | test(caisse)[4.7]: résumé de caisse réservé à son contrôleur, au partenaire propriétaire et à l'admin ; PIN régisseur salé par événement, régénération confirmée et journalisée, refusée caisse ouverte ; retrait d'un contrôleur refusé sur tous les chemins tant qu'une caisse est ouverte |
| 1a861d1 | test(securite)[4.8]: quotas en base et fail-closed sur le scan, l'encaissement, live-code, resolve-phone, verify-otp, controller/setup, partner/register, l'invitation et le PIN ; SMS : limite par compte, part du plafond réservée à l'OTP, compteurs OTP séparés ; plus de RateLimiter |
| 6611f15 | test(acces)[4.9]: ticket_scans pour chaque tentative (empreinte, jamais le payload), union de résultats partagée, 429 rate_limited ; écran du contrôleur : erreurs techniques jamais affichées comme billet invalide, 401 vers la connexion, scan en pause pendant l'encaissement |
| fbcd9b2 | test(acces)[4.10]: invariant du contrôle (g) un scan accepté par billet composté, (h) caisse = somme de ses encaissements, (i) aucun frais ni revenu ni grand livre hors plateforme ; garde-fou : chaque règle détecte une violation fabriquée |
| 9e2a324 | test(acces)[4.complément]: données de pilotage dans ticket_scans (catégorie, rôle du scanneur, point d'entrée de l'affectation recopié au scan, horodatage), index par événement, lecture API et Realtime réservée au partenaire propriétaire et aux admins (le partenaire B ne reçoit rien des scans de A) |
| e4fb3aa | revert(acces)[4]: restaure trois fichiers supprimés par erreur dans 9e2a324 (route /api/tickets/verify, route /api/events/[id]/tickets/purchase, suite paiement-guichet) ; leur suppression relève des correctifs 4.3 et 4.6, pas du commit de test du complément |
| a2354dc | fix(securite)[4.0]: commande, salle et table créées au nom de la session (requireActiveSession, clientId du corps ignoré) ; statut ambassadeur modifiable par le seul SUPERADMIN, valeur validée ; plus d'écriture REST d'un admin sur users (politique users_admin_manage, INSERT et DELETE retirés) |
| b44b69f | fix(acces)[4.1]: QR dynamique seul accepté à la caméra, saisie manuelle distincte (contrôleur affecté, pièce vérifiée, journalisée) ; PDF sans QR avec mention de la pièce d'identité ; partage limité au lien de l'événement ; transfert P2P atomique qui régénère numéro, QR et secret (ticket_transfer_claim) ; migration du scan (ticket_scans, ticket_scan) introduite ici |
| 73dec52 | fix(acces)[4.2]: code dynamique dérivé de TICKET_TOTP_MASTER_KEY et du secret du billet (plus de dérivation depuis le hook ou la service_role), tolérance ±1 pas de 20 s, comparaison en temps constant ; live-code réservé au porteur ; TICKET_TOTP_MASTER_KEY et REGISSEUR_PIN_KEY obligatoires sans repli, seuils de quota déclarés |
| bbc629c | fix(acces)[4.3]: voie de scan unique /api/controller/scan pour le contrôleur affecté, le partenaire propriétaire et l'admin (droit vérifié avant le code, aucune donnée sinon, compostage atomique par ticket_scan, paiement contrôlé) ; /api/tickets/verify supprimée ; /partner/scan sur la même route et le même composant de résultat |
| 8464b74 | feat(acces)[4.4]: réglages access.* (fenêtre de scan 6 h avant et après, périmètre de la saisie manuelle, vente au guichet) réservés au SUPERADMIN ; scan et encaissement refusés hors fenêtre, pour un événement non PUBLIE, suspendu ou ANNULE (scan_event_problem) |
| bc0c116 | fix(caisse)[4.5]: encaissement espèces transactionnel avec compostage (ticket_cash_checkin : commande réellement impayée, montant par billet, caisse ouverte pour tous les rôles, prix facial sans frais EV) ; une seule caisse ouverte par contrôleur et événement ; RESTRICT ; ShiftService sans repli en mémoire |
| 764feff | feat(caisse)[4.6]: vente au guichet en espèces (counter_sale : contrôleur affecté, permission espèces, caisse ouverte, contrôles de vente, paiement hors plateforme rattaché à la caisse, aucun frais ni grand livre) ; ancienne route /api/events/[id]/tickets/purchase et sa suite 410 supprimées |
| 977f0ec | fix(caisse)[4.7]: résumé de caisse réservé à son contrôleur, au partenaire propriétaire et à l'admin ; PIN régisseur haché avec REGISSEUR_PIN_KEY et un sel par événement, régénération confirmée, refusée caisse ouverte sauf confirmation, journalisée ; retrait d'un contrôleur refusé en 409 sur tous les chemins tant qu'une caisse est ouverte |
| 4cd6d05 | fix(securite)[4.8]: quotas en base, fail-closed, partout (resolve-phone, verify-otp, controller/setup, partner/register, invitation ; scan, encaissement, live-code et PIN dans leurs tâches) ; RateLimiter supprimé ; SMS : limite par compte déclencheur, compteurs OTP séparés, part du plafond quotidien réservée à l'OTP |
| af8900d | feat(acces)[4.9]: écran du contrôleur sur l'union de résultats partagée : erreurs techniques (401, 403, 429, 5xx, réseau) jamais présentées comme billet invalide, sans voix ni compteur ; 401 vers la connexion ; saisie manuelle avec pièce vérifiée ; scan en pause pendant la confirmation espèces, refus d'encaissement affiché avec des actions explicites |
| 13657c1 | feat(acces)[4.complément]: données du pilotage dans ticket_scans (catégorie, rôle du scanneur, point d'entrée recopié au scan), point d'entrée d'affectation modifiable par le partenaire, index par événement, lecture API et Realtime réservée au partenaire propriétaire et aux admins |
| be07a4f | test(legacy)[4]: suites legacy alignées sur le lot 4 (cas reposant sur l'ancien TOTP, /api/tickets/verify, RateLimiter, l'ancien corps de scan ou les replis mémoire de caisse remplacés par un commentaire citant la suite de remplacement ; ticket-scanned-notifications supprimée) |
| 00a193c | fix(finance)[4.correctif-lot3]: retraits simultanés : withdrawal_request lit le solde disponible à l'heure réelle (clock_timestamp) une fois le verrou obtenu, et non à now() (début de transaction), qui laissait passer deux retraits dépassant le solde (constaté au run 36, finance-retraits cas 4) |
| 4ce90c5 | fix(caisse)[4.6]: commentaire de la route du guichet reformulé (il citait l'ancienne route supprimée, relevé par le contrôle statique du run 37) |
| 93d6bdb | fix(acces)[4.1]: saisie manuelle : toute valeur de identityVerified autre que true donne manual_entry_refused (et non un 400 de validation), conformément au contrat (run 37) |
| bf93a56 | test(acces)[4.3]: statut-compte retire en fin de cas l'affectation temporaire de CONTROLLER_A (fixture partagée : r8-controleur-lectures voyait un billet hors de l'affectation de référence, run 37) ; signalé au rapport |
| e2bee8e | test(acces)[4.10]: invariant (g) : droit du scanneur évalué au moment du scan (scanner_role recopié sur la ligne), un retrait ultérieur de l'affectation ne rend pas le scan illégitime ; signalé au rapport |
| d1cd169 | test(acces)[4.4]: réglages access.* modifiables par le SUPERADMIN par la route et la page des réglages (lecture ADMIN et SUPERADMIN, écriture SUPERADMIN seul, valeurs validées, historique) ; R16 : aucune écriture directe d'une clé access.* par un ADMIN (garde-fou) |
| 75ec7b1 | test(securite)[4.4]: /api/admin/pricing (ADMIN avec pricing.manage, écriture en service_role sans validation ni historique) ne modifie ni ne crée de clé access.* ; témoin sur une clé ordinaire |
| 3143f36 | fix(acces)[4.4]: réglages access.* modifiables par le seul SUPERADMIN : /api/admin/finance-settings lit et accepte les clés access.* (validation et historique par finance_setting_set, inchangés), la page des réglages les présente dans une section « Contrôle d'accès » (libellés, aides, choix du périmètre de la saisie manuelle) ; /api/admin/pricing refuse les clés access.* (403 ACCESS_SETTING), comme les finance.* |

Ce rapport est ajouté par le commit qui suit le dernier de cette liste.

**Écriture des tests.** Les suites rouges ont été écrites à partir d'un contrat commun rédigé avant toute écriture : RPC, routes, codes de résultat, réglages, seuils. Les nouvelles suites sont des fichiers nouveaux. Elles ont été typecheckées sans les correctifs dans une copie propre du dépôt, puis committées avant tout correctif. Les modules réécrits au lot 4 y sont importés dynamiquement, pour que le typecheck passe avant les tests.

### Tests existants modifiés (signalement)

- **`tests/helpers/payment-invariants.ts`**, règle (b) de l'invariant du lot 2, commit `1c700d5` : un billet VALIDE « à régler sur place » d'une commande impayée (sans paiement, commande non SUCCESS) n'est plus une violation. Cet état est désormais légitime : le billet attend l'encaissement au contrôle. C'est un assouplissement, signalé comme tel. Il est compensé par l'invariant (h), qui exige que le total de chaque caisse soit égal aux paiements qui y sont rattachés, et par `acces-encaissement` (paiement créé à l'encaissement, et à ce moment seulement).
- **`tests/parcours/statut-compte.test.ts`**, commits `bbc629c` et `bf93a56`. Le cas « compte suspendu » vérifiait un billet par `/api/tickets/verify`, route supprimée par 4.3. Il passe désormais par la saisie manuelle de `/api/controller/scan`, sur un événement à horaire précis du partenaire A, avec CONTROLLER_A affecté pour le cas.
  - L'affectation est retirée en fin de cas (`finally`). Sans ce retrait, `r8-controleur-lectures`, qui s'exécute après, voyait un billet hors de l'affectation de référence (run 37).
  - L'assertion sur le refus d'un compte suspendu est inchangée.
- **`tests/parcours/pin-regisseur.test.ts`**, commit `977f0ec` : `generateRegisseurPin(…, { confirm: true })`. La confirmation est désormais obligatoire (4.7) ; aucune caisse n'est ouverte dans ce cas. Les assertions sont inchangées.
- **`tests/security/r3-fonctions-rpc.test.ts`**, commit `bbc629c` : `atomic_ticket_checkin` (supprimée) est retirée de la liste. Les 7 RPC du lot 4 y sont ajoutées et doivent être refusées à anon et à un client connecté. Le test devient plus strict.
- **`tests/partner-auth-complete.test.ts`**, test 22, commit `4cd6d05`. Il appelait `RateLimiter`, supprimé par 4.8, et passe désormais par `reserveQuota`, avec la même intention de blocage après 5 tentatives.
  - Avant : la 5ᵉ tentative verrouillait.
  - Après : 5 tentatives acceptées, la 6ᵉ refusée (`EXCEEDED`, délai d'attente > 0). Le seuil réel de l'application est fixé par les quotas de la section 3.
- **`tests/parcours/paiement-guichet.test.ts`** : suite supprimée, commit `764feff`. Elle vérifiait que l'ancienne route d'émission par le staff répondait 410. La route est supprimée et remplacée par la vente au guichet. `acces-guichet` vérifie l'absence de l'ancienne route et le nouveau parcours.
- **`tests/parcours/acces-reglages.test.ts`** (suite nouvelle), commit `75ec7b1` : elle a été complétée après son premier commit rouge (`d1cd169`, run 39), avant tout correctif, par le cas `/api/admin/pricing`. Le test est plus strict ; aucun cas n'a été retiré ni assoupli.
- **`tests/helpers/access-invariants.ts`**, règle (g), commit `e2bee8e`. Ce helper est nouveau au lot 4, mais il a été modifié après le commit rouge. Le droit du scanneur est désormais évalué au moment du scan, par le rôle recopié sur la ligne (`scanner_role`), et non plus à l'instant de la vérification. Une affectation retirée après un scan légitime le faisait passer pour illégitime. La règle reste « exactement un scan accepté, par un scanneur autorisé pour l'événement ».

---

## 2. Par tâche : grep, test rouge, correctif, test vert

Avant correctif : run CI 34 (`41251376110`, commit `fbcd9b2`), tests de 4.0 à 4.10 dans leur version finale, sans aucun correctif. Deux tâches ont leur propre run rouge :
- le complément pilotage et le défaut du lot 3 : run 36 (`41253809236`, commit `e4fb3aa`) ;
- les réglages `access.*` (4.4) : run 40 (`41256384288`, commit `75ec7b1`).

Après : run 41 (`41256842470`, commit `3143f36`). Greps exécutés sur l'arbre du commit rouge correspondant. Journaux bruts sur la branche `ci-results`, `runs/<n>-<id>/`.

**Lecture des blocs « avant ».**
- Les nouvelles suites échouent souvent d'abord sur l'absence d'un module, d'une RPC, d'un réglage ou d'un corps de requête du contrat (`HTTP 400 {"error":"Required"}`, `… is not a function`). C'est un rouge réel mais structurel.
- Les défauts de fond apparaissent dans les cas qui n'en dépendent pas :
  - commande créée sans session ;
  - statut ambassadeur changé par un ADMIN ;
  - ligne `users` supprimée par un ADMIN ;
  - QR dessiné dans le PDF ;
  - numéro du billet partagé ;
  - réglages `access.*` absents de la route du SUPERADMIN, et écrits par `/api/admin/pricing`.
- `relation "public.ticket_scans" does not exist` est l'erreur levée par l'invariant du contrôle en `after()`, la table n'existant pas encore.
- Quelques cas sont verts avant correctif : ce sont des garde-fous, ils ne prouvent rien seuls. Ils sont visibles dans les blocs :
  - `clientId` d'un autre compte ignoré quand une session existe ;
  - attribution par le SUPERADMIN ;
  - cas 1 de R15 ;
  - cas qui ne dépendent pas du contrat dans `acces-caisse-pin` ;
  - les 4 clés `access.*` existent déjà ;
  - R16 entier (politique posée par la migration `…09`).

### 4.0 — Sécurité urgente : identité du client, statut ambassadeur

```text
$ git grep -n -E clientId fbcd9b2 -- app/api/orders/create app/api/halls/reserve app/api/restaurants/reserve-table
fbcd9b2:app/api/halls/reserve/route.ts:26:            clientId?: string;
fbcd9b2:app/api/halls/reserve/route.ts:35:        const effectiveUserId = userId || body.clientId;
fbcd9b2:app/api/orders/create/route.ts:26:            clientId?: string;
fbcd9b2:app/api/orders/create/route.ts:35:        const effectiveUserId = userId || body.clientId;
fbcd9b2:app/api/restaurants/reserve-table/route.ts:30:            clientId?: string;
fbcd9b2:app/api/restaurants/reserve-table/route.ts:39:        const effectiveUserId = userId || body.clientId;
(code de sortie 0)

$ git grep -n -E 'referralStatus|referral_status' fbcd9b2 -- app/api/admin/users/route.ts
fbcd9b2:app/api/admin/users/route.ts:24:        const referralFilter = searchParams.get('referralStatus');
fbcd9b2:app/api/admin/users/route.ts:39:                referral_status,
fbcd9b2:app/api/admin/users/route.ts:50:            query = query.eq('referral_status', referralFilter as any);
fbcd9b2:app/api/admin/users/route.ts:156:            referral_status: 'STANDARD',
fbcd9b2:app/api/admin/users/route.ts:201:        let body: { userId?: string; role?: string; roles?: unknown; referralStatus?: 'STANDARD' | 'AMBASSADEUR'; status?: string };
fbcd9b2:app/api/admin/users/route.ts:208:        const { userId, role, roles: requestedRoles, referralStatus, status } = body;
fbcd9b2:app/api/admin/users/route.ts:266:        if (referralStatus) updatePayload.referral_status = referralStatus;
fbcd9b2:app/api/admin/users/route.ts:301:            oldValue: { roles: targetCurrentRoles, role: targetUser.role, referral_status: targetUser.referral_status, status: targetUser.status },
(code de sortie 0)

$ git grep -n -E users_admin_manage fbcd9b2 -- supabase/migrations
fbcd9b2:supabase/migrations/0003_rls.sql:92:CREATE POLICY "users_admin_manage" ON users
(code de sortie 0)
```

**Correctif** (`a2354dc`).
- `POST /api/orders/create`, `/api/halls/reserve` et `/api/restaurants/reserve-table` lisent le client par `requireActiveSession` : 401 sans session ou avec un jeton invalide, 403 `ACCOUNT_NOT_ACTIVE` pour un compte suspendu. Le `clientId` du corps est ignoré, et les pages appelantes ne l'envoient plus.
- `/api/admin/users` refuse `referralStatus` à tout autre que le SUPERADMIN (403 `REFERRAL_STATUS_SUPERADMIN_ONLY`) et valide la valeur (400 `INVALID_REFERRAL_STATUS` ; avant, une valeur inconnue provoquait une erreur 500 de l'enum).
- Migration `…12` : la politique `users_admin_manage` est supprimée, et `INSERT`, `DELETE` et `TRUNCATE` sur `users` sont retirés à anon et à authenticated. Un ADMIN ne peut plus supprimer puis recréer la ligne d'un compte avec un autre statut.

**parcours/acces-securite-urgente**

Run 34 (avant correctif) :

```text
    ok 1 - commande (POST /api/orders/create) : le clientId d'un autre compte n'est jamais utilisé
    not ok 2 - commande (POST /api/orders/create) : sans session (clientId seul) → 401, rien n'est créé
        → sans session : HTTP 200 {"success":true,"order":{"id":"092846af-65a3-42b0-ba26-601a7ebd6282","orderNumber":"CMD-1793488388101-7970","totalAmount":5000,"totalFormatted":"5 000 FCFA"}}
        → 200 !== 401
    not ok 3 - commande (POST /api/orders/create) : jeton invalide et clientId d'un autre → 401, rien n'est créé
        → jeton invalide : HTTP 200 {"success":true,"order":{"id":"20a975d6-043b-41e8-8807-beddc975fbc1","orderNumber":"CMD-1793488388118-4945","totalAmount":5000,"totalFormatted":"5 000 FCFA"}}
        → 200 !== 401
    not ok 4 - commande (POST /api/orders/create) : compte SUSPENDU → 403 ACCOUNT_NOT_ACTIVE, rien n'est créé
        → compte SUSPENDU : HTTP 200 {"success":true,"order":{"id":"bc8a6902-1a34-4fa6-b0b3-970411b2fe7d","orderNumber":"CMD-1793488388137-7342","totalAmount":5000,"totalFormatted":"5 000 FCFA"}}
        → 200 !== 403
    ok 5 - réservation de salle (POST /api/halls/reserve) : le clientId d'un autre compte n'est jamais utilisé
    not ok 6 - réservation de salle (POST /api/halls/reserve) : sans session (clientId seul) → 401, rien n'est créé
        → sans session : HTTP 200 {"success":true,"reservation":{"id":"15f11d88-2f4c-4110-9919-7c57e08df06d","totalAmount":100000,"depositAmount":30000,"balanceAmount":70000,"depositFormatted":"30 000 FCFA","totalFormatted":"100 000 FCFA","moratoriumDate":"2026-11-02"}}
        → 200 !== 401
    not ok 7 - réservation de salle (POST /api/halls/reserve) : jeton invalide et clientId d'un autre → 401, rien n'est créé
        → jeton invalide : HTTP 200 {"success":true,"reservation":{"id":"0bcae073-9107-449c-985d-3c276c5df209","totalAmount":100000,"depositAmount":30000,"balanceAmount":70000,"depositFormatted":"30 000 FCFA","totalFormatted":"100 000 FCFA","moratoriumDate":"2026-11-02"}}
        → 200 !== 401
    not ok 8 - réservation de salle (POST /api/halls/reserve) : compte SUSPENDU → 403 ACCOUNT_NOT_ACTIVE, rien n'est créé
        → compte SUSPENDU : HTTP 200 {"success":true,"reservation":{"id":"598f0b68-fff6-483f-a7da-c942333d7e1a","totalAmount":100000,"depositAmount":30000,"balanceAmount":70000,"depositFormatted":"30 000 FCFA","totalFormatted":"100 000 FCFA","moratoriumDate":"2026-11-02"}}
        → 200 !== 403
    ok 9 - réservation de table (POST /api/restaurants/reserve-table) : le clientId d'un autre compte n'est jamais utilisé
    not ok 10 - réservation de table (POST /api/restaurants/reserve-table) : sans session (clientId seul) → 401, rien n'est créé
        → sans session : HTTP 500 {"error":"Impossible d'enregistrer la réservation."}
        → 500 !== 401
    not ok 11 - réservation de table (POST /api/restaurants/reserve-table) : jeton invalide et clientId d'un autre → 401, rien n'est créé
        → jeton invalide : HTTP 500 {"error":"Impossible d'enregistrer la réservation."}
        → 500 !== 401
    not ok 12 - réservation de table (POST /api/restaurants/reserve-table) : compte SUSPENDU → 403 ACCOUNT_NOT_ACTIVE, rien n'est créé
        → compte SUSPENDU : HTTP 500 {"error":"Impossible d'enregistrer la réservation."}
        → 500 !== 403
not ok 1 - 4.0 — commandes et réservations : client = session ACTIVE, clientId ignoré
    not ok 1 - un ADMIN qui a users.write ne change pas referral_status (tiers ni lui-même) ; valeur inchangée
        → ADMIN → AMBASSADEUR sur un tiers : HTTP 200 {"success":true,"user":{"id":"88224d21-8a71-4c35-ba05-f577db23bc30","first_name":"Awa","last_name":"Acheteuseurgciblead","phone":"+221771953043","email":"parcours-pay-urg-cible-admin-46cdfde6a9@test.eventvillage.local","role":"CLIENT","status":"ACTIF","ref
        → 200 !== 403
    ok 2 - le SUPERADMIN attribue puis retire le statut ambassadeur
    not ok 3 - une valeur hors STANDARD / AMBASSADEUR → 400, valeur inchangée
        → referralStatus "VIP" : HTTP 500 {"error":"invalid input value for enum referral_status: \"VIP\""}
        → 500 !== 400
not ok 2 - 4.0 — statut ambassadeur réservé au SUPERADMIN
not ok 3 - /home/runner/work/event-village/event-village/tests/parcours/acces-securite-urgente.test.ts
        → relation "public.ticket_scans" does not exist
# pass 4
# fail 11
```

Run 41 (après correctif) :

```text
    ok 1 - commande (POST /api/orders/create) : le clientId d'un autre compte n'est jamais utilisé
    ok 2 - commande (POST /api/orders/create) : sans session (clientId seul) → 401, rien n'est créé
    ok 3 - commande (POST /api/orders/create) : jeton invalide et clientId d'un autre → 401, rien n'est créé
    ok 4 - commande (POST /api/orders/create) : compte SUSPENDU → 403 ACCOUNT_NOT_ACTIVE, rien n'est créé
    ok 5 - réservation de salle (POST /api/halls/reserve) : le clientId d'un autre compte n'est jamais utilisé
    ok 6 - réservation de salle (POST /api/halls/reserve) : sans session (clientId seul) → 401, rien n'est créé
    ok 7 - réservation de salle (POST /api/halls/reserve) : jeton invalide et clientId d'un autre → 401, rien n'est créé
    ok 8 - réservation de salle (POST /api/halls/reserve) : compte SUSPENDU → 403 ACCOUNT_NOT_ACTIVE, rien n'est créé
    ok 9 - réservation de table (POST /api/restaurants/reserve-table) : le clientId d'un autre compte n'est jamais utilisé
    ok 10 - réservation de table (POST /api/restaurants/reserve-table) : sans session (clientId seul) → 401, rien n'est créé
    ok 11 - réservation de table (POST /api/restaurants/reserve-table) : jeton invalide et clientId d'un autre → 401, rien n'est créé
    ok 12 - réservation de table (POST /api/restaurants/reserve-table) : compte SUSPENDU → 403 ACCOUNT_NOT_ACTIVE, rien n'est créé
ok 1 - 4.0 — commandes et réservations : client = session ACTIVE, clientId ignoré
    ok 1 - un ADMIN qui a users.write ne change pas referral_status (tiers ni lui-même) ; valeur inchangée
    ok 2 - le SUPERADMIN attribue puis retire le statut ambassadeur
    ok 3 - une valeur hors STANDARD / AMBASSADEUR → 400, valeur inchangée
ok 2 - 4.0 — statut ambassadeur réservé au SUPERADMIN
# pass 15
# fail 0
```

**security/r15-statut-ambassadeur**

Run 34 (avant correctif) :

```text
    ok 1 - un ADMIN ne passe pas un compte AMBASSADEUR par update ni par upsert
    not ok 2 - un ADMIN ne supprime pas la ligne d’un compte et ne la recrée pas AMBASSADEUR (users_admin_manage)
        → suppression acceptée : [{"id":"06f810cb-d5bd-402e-85db-3d74300a3330"}]
not ok 1 - R15 — statut ambassadeur hors de portée d’un ADMIN par REST
# pass 1
# fail 1
```

Run 41 (après correctif) :

```text
    ok 1 - un ADMIN ne passe pas un compte AMBASSADEUR par update ni par upsert
    ok 2 - un ADMIN ne supprime pas la ligne d’un compte et ne la recrée pas AMBASSADEUR (users_admin_manage)
ok 1 - R15 — statut ambassadeur hors de portée d’un ADMIN par REST
# pass 2
# fail 0
```

### 4.1 — QR caméra dynamique seul, saisie manuelle, PDF, partage, transfert

```text
$ git grep -n -E 'isDynamic|TCK-|EV-QR-' fbcd9b2 -- lib/security/totp.ts
fbcd9b2:lib/security/totp.ts:112: * Ex: EVT1:EV-QR-47fae32a8901:482910
fbcd9b2:lib/security/totp.ts:122:    isDynamic: boolean;
fbcd9b2:lib/security/totp.ts:131:                isDynamic: true,
fbcd9b2:lib/security/totp.ts:143:                isDynamic: true,
fbcd9b2:lib/security/totp.ts:152:        isDynamic: false,
(code de sortie 0)

$ git grep -n -E 'qrPayload|qr_code' fbcd9b2 -- 'app/api/tickets/[id]/pdf/route.ts' lib/tickets/ticket-pdf.service.ts
fbcd9b2:app/api/tickets/[id]/pdf/route.ts:136:            qrPayload: ticket.qr_code || ticket.ticket_number,
fbcd9b2:lib/tickets/ticket-pdf.service.ts:18:    qrPayload: string;
fbcd9b2:lib/tickets/ticket-pdf.service.ts:75:            data.qrPayload || data.ticketNumber,
(code de sortie 0)

$ git grep -n -E 'wa\.me|whatsapp|clipboard' fbcd9b2 -- components/tickets/TicketCard.tsx
fbcd9b2:components/tickets/TicketCard.tsx:131:      navigator.clipboard.writeText(ticketNumber);
fbcd9b2:components/tickets/TicketCard.tsx:139:    window.open(`https://wa.me/?text=${encoded}`, '_blank');
(code de sortie 0)
```

**Correctif** (`b44b69f`, migration `…10`).
- `parseTicketPayload` n'accepte que `EVT1:<UUID>:<6 chiffres>`. Tout autre contenu caméra donne `dynamic_qr_required`, sans compostage.
- Saisie manuelle :
  - corps distinct, `{ manualTicketNumber, identityVerified }`. Seule la valeur `true` vaut pièce vérifiée ; toute autre valeur donne `manual_entry_refused` (correction `93d6bdb`, run 37) ;
  - périmètre réglé par `access.manual_entry_scope` : contrôleur affecté par défaut, STAFF possible ;
  - journalisée dans `ticket_scans` (`method = 'MANUAL'`, `identity_verified`) ; la réponse porte `is_manual_entry`.
- Le PDF ne dessine plus de QR. Il porte le numéro et la mention de la pièce d'identité.
- `TicketCard` partage le lien de l'événement seulement, et affiche le payload de live-code, rafraîchi selon `expires_in`.
- Le transfert entre particuliers est accepté par la RPC `ticket_transfer_claim`, en une transaction : changement de porteur, nouveaux `ticket_number`, `qr_code` et `totp_secret`. L'ancien QR et l'ancien numéro sont refusés.

**parcours/acces-qr**

Run 34 (avant correctif) :

```text
    not ok 1 - caméra : identifiant nu (numéro TCK-…, QR statique EV-QR-…, UUID seul, ancien format) → dynamic_qr_required, billet non composté
        → payload « TCK-20261031-1547059824 » : HTTP 400 {"error":"Required"}
        → 400 !== 200
    not ok 2 - parseTicketPayload : EVT1 + UUID du billet + 6 chiffres, rien d’autre ; buildTicketPayload produit ce format
        → lib/security/totp.ts doit exporter parseTicketPayload
        → + 'undefined'
        → - 'function'
not ok 1 - 4.1 Format du QR caméra
    not ok 1 - sans pièce d’identité vérifiée (absente, false, "true") → manual_entry_refused, billet non composté
        → identityVerified=undefined : HTTP 400 {"error":"Required"}
        → 400 !== 200
    not ok 2 - contrôleur non affecté (identité cochée) → 403 SCAN_FORBIDDEN, aucune donnée du billet, billet non composté
        → HTTP 400 {"error":"Required"}
        → 400 !== 403
    not ok 3 - périmètre réglé : partenaire propriétaire refusé en ASSIGNED_CONTROLLER (manual_entry_refused), accepté en STAFF
        → réglage access.manual_entry_scope absent de platform_settings
    not ok 4 - saisie valide (contrôleur affecté, identité vérifiée) → valid, marquée MANUAL dans la réponse et dans ticket_scans
        → HTTP 400 {"error":"Required"}
        → 400 !== 200
not ok 2 - 4.1 Saisie manuelle
    not ok 1 - identifiants régénérés ; ancien QR et ancien numéro refusés ; le QR du nouveau porteur passe
        → totp.generateTicketCode is not a function
not ok 3 - 4.1 Transfert P2P
    not ok 1 - aucun QR (ni image ni matrice de modules), numéro du billet et mention « pièce d’identité »
        → le PDF ne doit plus dessiner de QR : 431 rectangles pleins (modules d’une matrice)
not ok 4 - 4.1 PDF du billet
    not ok 1 - partage WhatsApp et copie : lien de l’événement, jamais le numéro du billet ni le QR
        → TicketCard.tsx:125 : le partage ne doit diffuser ni le numéro du billet ni le QR :
        → const handleShare = () => {
        → const shareText = `Mon billet officiel pour ${eventTitle} (N° ${ticketNumber}) sur Event Village : https://event-village.sn/tickets`;
        → if (navigator.share) {
    not ok 2 - QR affiché = payload du code dynamique (live-code), rafraîchi selon expires_in, jamais un QR statique par défaut
        → le QR ne doit pas être initialisé avec le qr_code statique ou le numéro
not ok 5 - 4.1 Carte billet (contrôle statique)
not ok 6 - /home/runner/work/event-village/event-village/tests/parcours/acces-qr.test.ts
        → relation "public.ticket_scans" does not exist
# pass 0
# fail 10
```

Run 41 (après correctif) :

```text
    ok 1 - caméra : identifiant nu (numéro TCK-…, QR statique EV-QR-…, UUID seul, ancien format) → dynamic_qr_required, billet non composté
    ok 2 - parseTicketPayload : EVT1 + UUID du billet + 6 chiffres, rien d’autre ; buildTicketPayload produit ce format
ok 1 - 4.1 Format du QR caméra
    ok 1 - sans pièce d’identité vérifiée (absente, false, "true") → manual_entry_refused, billet non composté
    ok 2 - contrôleur non affecté (identité cochée) → 403 SCAN_FORBIDDEN, aucune donnée du billet, billet non composté
    ok 3 - périmètre réglé : partenaire propriétaire refusé en ASSIGNED_CONTROLLER (manual_entry_refused), accepté en STAFF
    ok 4 - saisie valide (contrôleur affecté, identité vérifiée) → valid, marquée MANUAL dans la réponse et dans ticket_scans
ok 2 - 4.1 Saisie manuelle
    ok 1 - identifiants régénérés ; ancien QR et ancien numéro refusés ; le QR du nouveau porteur passe
ok 3 - 4.1 Transfert P2P
    ok 1 - aucun QR (ni image ni matrice de modules), numéro du billet et mention « pièce d’identité »
ok 4 - 4.1 PDF du billet
    ok 1 - partage WhatsApp et copie : lien de l’événement, jamais le numéro du billet ni le QR
    ok 2 - QR affiché = payload du code dynamique (live-code), rafraîchi selon expires_in, jamais un QR statique par défaut
ok 5 - 4.1 Carte billet (contrôle statique)
# pass 10
# fail 0
```

### 4.2 — Secret du code dynamique

```text
$ git grep -n -E 'SUPABASE_AUTH_HOOK_SECRET|SERVICE_ROLE_KEY|===' fbcd9b2 -- lib/security/totp.ts
fbcd9b2:lib/security/totp.ts:19:    const masterKey = process.env.SUPABASE_AUTH_HOOK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
fbcd9b2:lib/security/totp.ts:20:    if (!masterKey) throw new Error('Clé de dérivation des QR dynamiques absente (SUPABASE_AUTH_HOOK_SECRET ou SUPABASE_SERVICE_ROLE_KEY).');
fbcd9b2:lib/security/totp.ts:32:    const now = typeof timestampSecondsOrMs === 'number'
fbcd9b2:lib/security/totp.ts:77:    if (typeof options?.timestamp === 'number') {
fbcd9b2:lib/security/totp.ts:79:    } else if (typeof options?.timestampSeconds === 'number') {
fbcd9b2:lib/security/totp.ts:101:        if (expectedCode === cleanToken) {
fbcd9b2:lib/security/totp.ts:141:        if (parts.length === 2 && /^\d{6}$/.test(parts[1])) {
(code de sortie 0)

$ git grep -n -E totp_secret fbcd9b2 -- app lib
fbcd9b2:app/api/controller/scan/route.ts:144:            const secret = (ticket as any).totp_secret || deriveTicketTotpSecret(ticket.id);
fbcd9b2:app/api/tickets/[id]/live-code/route.ts:61:        const secret = (ticket as any).totp_secret || deriveTicketTotpSecret(ticket.id);
fbcd9b2:app/api/tickets/claim/[token]/route.ts:10: * Ne retourne AUCUN secret sensible (pas de hash, pas de totp_secret, pas de qr_code).
fbcd9b2:app/api/tickets/verify/route.ts:140:            const secret = (ticket as any).totp_secret || deriveTicketTotpSecret(ticket.id);
fbcd9b2:lib/tickets/ticket-transfer.service.ts:710:                totp_secret: newTotpSecret,
fbcd9b2:lib/tickets/ticket-transfer.service.ts:731:                        totp_secret: newTotpSecret,
(code de sortie 0)

$ git grep -n -E 'deriveTicketTotpSecret\(' fbcd9b2 -- app lib
fbcd9b2:app/api/controller/scan/route.ts:144:            const secret = (ticket as any).totp_secret || deriveTicketTotpSecret(ticket.id);
fbcd9b2:app/api/tickets/[id]/live-code/route.ts:61:        const secret = (ticket as any).totp_secret || deriveTicketTotpSecret(ticket.id);
fbcd9b2:app/api/tickets/verify/route.ts:140:            const secret = (ticket as any).totp_secret || deriveTicketTotpSecret(ticket.id);
fbcd9b2:lib/security/totp.ts:17:export function deriveTicketTotpSecret(ticketId: string): string {
(code de sortie 0)
```

**Correctif** (`73dec52`).
- `lib/security/totp.ts` est réécrit. La clé du billet est HMAC-SHA256(`TICKET_TOTP_MASTER_KEY`, `ticket-totp:v2:<billet>:<totp_secret>`). Il n'y a plus de dérivation depuis `SUPABASE_AUTH_HOOK_SECRET` ni depuis la service_role.
- Le code fait 6 chiffres, avec un pas de 20 s et une tolérance de ±1 pas. La comparaison se fait en temps constant (`timingSafeEqual`).
- `tickets.totp_secret` (64 caractères hexadécimaux) est généré à l'émission, lu par le scan et par live-code, et régénéré au transfert.
- `TICKET_TOTP_MASTER_KEY` et `REGISSEUR_PIN_KEY` sont obligatoires dans `lib/env.ts`, sans repli.
- `GET /api/tickets/<id>/live-code` est réservé au porteur (404 pour tout autre compte) et limité par quota.

**parcours/acces-totp**

Run 34 (avant correctif) :

```text
    not ok 1 - TICKET_TOTP_MASTER_KEY et REGISSEUR_PIN_KEY présentes dans l’environnement de test et validées au démarrage
        → TICKET_TOTP_MASTER_KEY absente ou trop courte dans .env.test (à déclarer dans .env.test.example)
    not ok 2 - obligatoires, sans repli, d’au moins 32 caractères
        → Missing expected exception: getServerEnv doit refuser un environnement sans TICKET_TOTP_MASTER_KEY
    not ok 3 - distinctes des autres secrets (OTP, hook SMS, service_role) et l’une de l’autre
        → Missing expected exception: TICKET_TOTP_MASTER_KEY identique à OTP_HASH_SECRET doit être refusée
    not ok 4 - déclarées dans .env.example, .env.test.example et docs/deploiement-projet-neuf.md
        → TICKET_TOTP_MASTER_KEY absente de .env.example
not ok 1 - 4.2 Secrets dédiés (lib/env.ts)
    not ok 1 - lib/security/totp.ts : clé maître dédiée lue par lib/env, ni hook SMS ni service_role, timingSafeEqual
        → totp.ts ne doit plus lire SUPABASE_AUTH_HOOK_SECRET
    not ok 2 - PIN régisseur : REGISSEUR_PIN_KEY, ni hook SMS ni service_role ; aucune autre dérivation depuis ces secrets
        → shift.service.ts ne doit plus dériver le PIN du hook SMS ni de la clé service_role
    not ok 3 - billet émis par le checkout : totp_secret aléatoire de 64 hexadécimaux ; colonne NOT NULL avec défaut
        → totp_secret du billet émis : null
    not ok 4 - verifyTicketCode : pas de 20 s, tolérance ±1 pas, code de plus de 40 s refusé, code d’un autre billet refusé
        → totp.generateTicketCode is not a function
not ok 2 - 4.2 Code dynamique : implémentation
    not ok 1 - code de plus de 40 s (passé ou futur) → qr_expired, non composté ; code de −15 s → valid
        → totp.generateTicketCode is not a function
    not ok 2 - la colonne seule ne permet pas de calculer un code : TOTP « naïf » sur totp_secret refusé
        → totp.generateTicketCode is not a function
    not ok 3 - transfert : code de l’ancien secret refusé, ancien porteur sans live-code, nouveau porteur accepté
        → totp.generateTicketCode is not a function
not ok 3 - 4.2 Code dynamique au scan
    not ok 1 - porteur : payload EVT1:<UUID>:<6 chiffres>, step_seconds 20, expires_in du serveur ; payload accepté au scan
        → payload du live-code : HTTP 200 {"success":true,"ticket_id":"dc6137f0-3246-4a20-8774-e8b7f7300842","qr_payload":"EVT1:EV-QR-bea5de0d76f140349af2611819a592e1:791018","totp_code":"791018","expires_in":10,"step_seconds":20}
    not ok 2 - tout autre compte → 404 : autre client, contrôleur affecté, partenaire propriétaire, administrateur
        → autre client : HTTP 403 {"error":"Accès non autorisé à ce billet."}
        → 403 !== 404
    not ok 3 - billet composté : plus de live-code
        → totp.generateTicketCode is not a function
not ok 4 - 4.2 live-code
not ok 5 - /home/runner/work/event-village/event-village/tests/parcours/acces-totp.test.ts
        → relation "public.ticket_scans" does not exist
# pass 0
# fail 14
```

Run 41 (après correctif) :

```text
    ok 1 - TICKET_TOTP_MASTER_KEY et REGISSEUR_PIN_KEY présentes dans l’environnement de test et validées au démarrage
    ok 2 - obligatoires, sans repli, d’au moins 32 caractères
    ok 3 - distinctes des autres secrets (OTP, hook SMS, service_role) et l’une de l’autre
    ok 4 - déclarées dans .env.example, .env.test.example et docs/deploiement-projet-neuf.md
ok 1 - 4.2 Secrets dédiés (lib/env.ts)
    ok 1 - lib/security/totp.ts : clé maître dédiée lue par lib/env, ni hook SMS ni service_role, timingSafeEqual
    ok 2 - PIN régisseur : REGISSEUR_PIN_KEY, ni hook SMS ni service_role ; aucune autre dérivation depuis ces secrets
    ok 3 - billet émis par le checkout : totp_secret aléatoire de 64 hexadécimaux ; colonne NOT NULL avec défaut
    ok 4 - verifyTicketCode : pas de 20 s, tolérance ±1 pas, code de plus de 40 s refusé, code d’un autre billet refusé
ok 2 - 4.2 Code dynamique : implémentation
    ok 1 - code de plus de 40 s (passé ou futur) → qr_expired, non composté ; code de −15 s → valid
    ok 2 - la colonne seule ne permet pas de calculer un code : TOTP « naïf » sur totp_secret refusé
    ok 3 - transfert : code de l’ancien secret refusé, ancien porteur sans live-code, nouveau porteur accepté
ok 3 - 4.2 Code dynamique au scan
    ok 1 - porteur : payload EVT1:<UUID>:<6 chiffres>, step_seconds 20, expires_in du serveur ; payload accepté au scan
    ok 2 - tout autre compte → 404 : autre client, contrôleur affecté, partenaire propriétaire, administrateur
    ok 3 - billet composté : plus de live-code
ok 4 - 4.2 live-code
# pass 14
# fail 0
```

### 4.3 — Voie de scan unique

```text
$ git grep -n -E tickets/verify fbcd9b2 -- app components hooks lib
fbcd9b2:app/api/tickets/verify/route.ts:43: * POST /api/tickets/verify
fbcd9b2:app/api/tickets/verify/route.ts:120:            console.warn(`[tickets/verify] compte ${user.id} hors périmètre de l'événement ${ticket.event_id}`);
fbcd9b2:app/api/tickets/verify/route.ts:220:            console.warn('[tickets/verify] Erreur notification scan client:', notifErr);
fbcd9b2:app/partner/scan/page.tsx:53:      const res = await fetch('/api/tickets/verify', {
(code de sortie 0)

$ git grep -n -E atomic_ticket_checkin fbcd9b2 -- app lib
fbcd9b2:app/api/controller/scan/route.ts:24: * - pg_advisory_xact_lock anti-double-scan (atomic_ticket_checkin)
fbcd9b2:app/api/controller/scan/route.ts:283:            const { data: lockResult, error: lockErr } = await supabase.rpc('atomic_ticket_checkin', {
fbcd9b2:app/api/controller/scan/route.ts:289:                console.error('[controller/scan] RPC atomic_ticket_checkin error:', lockErr.message);
fbcd9b2:app/api/controller/scan/route.ts:508:        const { data: lockResult, error: lockErr } = await supabase.rpc('atomic_ticket_checkin', {
(code de sortie 0)

$ git grep -n -E 'isControllerArea|CONTROLEUR'"'"', '"'"'ADMIN'"'"', '"'"'SUPERADMIN'"'"'\]' fbcd9b2 -- middleware.ts
fbcd9b2:middleware.ts:78:    const isControllerArea = pathname.startsWith('/controller') || pathname.startsWith('/api/controller');
fbcd9b2:middleware.ts:138:    if (!(isAuthPage || isAdminArea || isScanArea || isControllerArea || isPartnerArea)) {
fbcd9b2:middleware.ts:190:    if (isControllerArea) {
fbcd9b2:middleware.ts:201:        if (!dbProfile || dbProfile.status !== 'ACTIF' || !hasAnyRole(roles, ['CONTROLEUR', 'ADMIN', 'SUPERADMIN'])) {
(code de sortie 0)
```

**Correctif** (`bbc629c`). Toute la décision est prise par la RPC `ticket_scan`, en une transaction, dans cet ordre :
1. droit du scanneur sur l'événement, avec un refus `SCAN_FORBIDDEN` qui ne contient aucune donnée du billet ;
2. billet et événement ;
3. code dynamique ;
4. statut et fenêtre de l'événement ;
5. statut du billet ;
6. paiement ;
7. compostage atomique.

Le scanneur autorisé est le contrôleur affecté, le partenaire propriétaire ou l'admin. Autres changements :
- La route `/api/controller/scan` est commune aux trois. Le middleware y admet le PARTENAIRE, ainsi qu'à `/api/controller/shifts`.
- `/partner/scan` utilise la même route et le même composant de résultat.
- `/api/tickets/verify` et la RPC `atomic_ticket_checkin` sont supprimées.

**parcours/acces-scan**

Run 34 (avant correctif) :

```text
    not ok 1 - partenaire B ou contrôleur de B visant l’événement de A → 403 SCAN_FORBIDDEN, sans donnée du billet
        → totp.generateTicketCode is not a function
    not ok 2 - partenaire B présentant un billet de A sur son propre événement → wrong_event, sans donnée du billet
        → totp.generateTicketCode is not a function
not ok 1 - 4.3 Périmètre du scanneur
    not ok 1 - double scan simultané depuis deux portes → un seul valid, l’autre already_used, une seule ligne acceptée
        → totp.generateTicketCode is not a function
    not ok 2 - billet payant sans paiement ni commande, scanné par le partenaire propriétaire → payment_required, non composté
        → totp.generateTicketCode is not a function
    not ok 3 - partenaire propriétaire : valid par la même route, données du billet renvoyées, ligne acceptée à son nom
        → totp.generateTicketCode is not a function
    not ok 4 - administrateur : valid par la même route
        → totp.generateTicketCode is not a function
not ok 2 - 4.3 Compostage atomique
    not ok 1 - middleware : /api/controller/scan ouvert au PARTENAIRE, fermé au CLIENT
        → partenaire : HTTP 403 (le middleware doit laisser passer, la route vérifie la propriété)
    not ok 2 - /api/tickets/verify supprimée et plus appelée nulle part
        → app/api/tickets/verify doit être supprimée
    not ok 3 - /partner/scan appelle /api/controller/scan et partage un composant de résultat avec le scanner contrôleur
        → app/partner/scan/page.tsx doit appeler /api/controller/scan
not ok 3 - 4.3 Voie unique
not ok 4 - /home/runner/work/event-village/event-village/tests/parcours/acces-scan.test.ts
        → relation "public.ticket_scans" does not exist
# pass 0
# fail 9
```

Run 41 (après correctif) :

```text
    ok 1 - partenaire B ou contrôleur de B visant l’événement de A → 403 SCAN_FORBIDDEN, sans donnée du billet
    ok 2 - partenaire B présentant un billet de A sur son propre événement → wrong_event, sans donnée du billet
ok 1 - 4.3 Périmètre du scanneur
    ok 1 - double scan simultané depuis deux portes → un seul valid, l’autre already_used, une seule ligne acceptée
    ok 2 - billet payant sans paiement ni commande, scanné par le partenaire propriétaire → payment_required, non composté
    ok 3 - partenaire propriétaire : valid par la même route, données du billet renvoyées, ligne acceptée à son nom
    ok 4 - administrateur : valid par la même route
ok 2 - 4.3 Compostage atomique
    ok 1 - middleware : /api/controller/scan ouvert au PARTENAIRE, fermé au CLIENT
    ok 2 - /api/tickets/verify supprimée et plus appelée nulle part
    ok 3 - /partner/scan appelle /api/controller/scan et partage un composant de résultat avec le scanner contrôleur
ok 3 - 4.3 Voie unique
# pass 9
# fail 0
```

**parcours/statut-compte**

Run 34 (code non corrigé, version du test antérieure à son adaptation dans un commit de correctif : pas un test rouge) :

```text
    ok 1 - invitation d’un compte SUSPENDU par le partenaire A → refus explicite, journalisé, statut inchangé
    ok 2 - invitation avec l’email d’un compte existant et un autre numéro → compte distinct, identifiants du titulaire intacts
    ok 3 - affectation d’un compte SUSPENDU par le partenaire A → refus explicite, journalisé, statut inchangé
    ok 4 - retrait d’un contrôleur SUSPENDU par le partenaire A → retiré, statut inchangé
    ok 5 - partenaire SUSPENDU → /api/partner/events refusé (ACCOUNT_NOT_ACTIVE)
    ok 6 - client SUSPENDU → /api/tickets/[id]/live-code refusé (ACCOUNT_NOT_ACTIVE)
    ok 7 - activation d’essai d’un partenaire par un autre compte → refusée
    ok 8 - liste des billets : le paramètre userId ne donne pas accès aux billets d’un autre compte
    ok 9 - vérification de billet : refusée à un CLIENT et au partenaire d’un autre événement, acceptée pour le contrôleur affecté
    ok 10 - toutes les routes /api/partner/* et /api/tickets/* passent par le helper commun
ok 1 - Statut des comptes sur les routes partenaire et billets
# pass 10
# fail 0
```

Run 41 (après correctif) :

```text
    ok 1 - invitation d’un compte SUSPENDU par le partenaire A → refus explicite, journalisé, statut inchangé
    ok 2 - invitation avec l’email d’un compte existant et un autre numéro → compte distinct, identifiants du titulaire intacts
    ok 3 - affectation d’un compte SUSPENDU par le partenaire A → refus explicite, journalisé, statut inchangé
    ok 4 - retrait d’un contrôleur SUSPENDU par le partenaire A → retiré, statut inchangé
    ok 5 - partenaire SUSPENDU → /api/partner/events refusé (ACCOUNT_NOT_ACTIVE)
    ok 6 - client SUSPENDU → /api/tickets/[id]/live-code refusé (ACCOUNT_NOT_ACTIVE)
    ok 7 - activation d’essai d’un partenaire par un autre compte → refusée
    ok 8 - liste des billets : le paramètre userId ne donne pas accès aux billets d’un autre compte
    ok 9 - vérification de billet : refusée à un CLIENT et au partenaire d’un autre événement, acceptée pour le contrôleur affecté
    ok 10 - toutes les routes /api/partner/* et /api/tickets/* passent par le helper commun
ok 1 - Statut des comptes sur les routes partenaire et billets
# pass 10
# fail 0
```

**security/r3-fonctions-rpc**

Run 34 (code non corrigé, version du test antérieure à son adaptation dans un commit de correctif : pas un test rouge) :

```text
    ok 1 - anon : rpc(validate_and_check_in_ticket) refusée
    ok 2 - authenticated (compte CLIENT) : rpc(validate_and_check_in_ticket) refusée
    ok 3 - anon : rpc(calculate_referral_commissions) refusée
    ok 4 - authenticated (compte CLIENT) : rpc(calculate_referral_commissions) refusée
    ok 5 - anon : rpc(activate_partner_trial) refusée
    ok 6 - authenticated (compte CLIENT) : rpc(activate_partner_trial) refusée
    ok 7 - anon : rpc(has_admin_permission) refusée
    ok 8 - authenticated (compte CLIENT) : rpc(has_admin_permission) refusée
    ok 9 - anon : rpc(create_hall_reservation_atomic) refusée
    ok 10 - authenticated (compte CLIENT) : rpc(create_hall_reservation_atomic) refusée
    ok 11 - anon : rpc(create_table_reservation_atomic) refusée
    ok 12 - authenticated (compte CLIENT) : rpc(create_table_reservation_atomic) refusée
    ok 13 - anon : rpc(atomic_ticket_checkin) refusée
    ok 14 - authenticated (compte CLIENT) : rpc(atomic_ticket_checkin) refusée
    ok 15 - anon : rpc(atomic_partner_remove_controller) refusée
    ok 16 - authenticated (compte CLIENT) : rpc(atomic_partner_remove_controller) refusée
    ok 17 - anon : rpc(generate_referral_code) refusée
    ok 18 - authenticated (compte CLIENT) : rpc(generate_referral_code) refusée
    ok 19 - anon : rpc(ticket_sale_problems) refusée
    ok 20 - authenticated (compte CLIENT) : rpc(ticket_sale_problems) refusée
    ok 21 - anon : rpc(checkout_create_payment) refusée
    ok 22 - authenticated (compte CLIENT) : rpc(checkout_create_payment) refusée
    ok 23 - anon : rpc(payment_release) refusée
    ok 24 - authenticated (compte CLIENT) : rpc(payment_release) refusée
    ok 25 - anon : rpc(stock_reservations_expire) refusée
    ok 26 - authenticated (compte CLIENT) : rpc(stock_reservations_expire) refusée
    ok 27 - anon : rpc(refund_request) refusée
    ok 28 - authenticated (compte CLIENT) : rpc(refund_request) refusée
    ok 29 - anon : rpc(payment_confirm) refusée
    ok 30 - authenticated (compte CLIENT) : rpc(payment_confirm) refusée
    ok 31 - anon : rpc(free_tickets_claim) refusée
    ok 32 - authenticated (compte CLIENT) : rpc(free_tickets_claim) refusée
    ok 33 - anon : rpc(payment_webhook_record) refusée
    ok 34 - authenticated (compte CLIENT) : rpc(payment_webhook_record) refusée
    ok 35 - anon : rpc(finance_setting_set) refusée
    ok 36 - authenticated (compte CLIENT) : rpc(finance_setting_set) refusée
    ok 37 - anon : rpc(fin_setting) refusée
    ok 38 - authenticated (compte CLIENT) : rpc(fin_setting) refusée
    ok 39 - anon : rpc(finance_compute) refusée
    ok 40 - authenticated (compte CLIENT) : rpc(finance_compute) refusée
    ok 41 - anon : rpc(finance_quote) refusée
    ok 42 - authenticated (compte CLIENT) : rpc(finance_quote) refusée
    ok 43 - anon : rpc(finance_account_balance) refusée
    ok 44 - authenticated (compte CLIENT) : rpc(finance_account_balance) refusée
    ok 45 - anon : rpc(ticket_refund_request) refusée
    ok 46 - authenticated (compte CLIENT) : rpc(ticket_refund_request) refusée
    ok 47 - anon : rpc(cashout_finalize) refusée
    ok 48 - authenticated (compte CLIENT) : rpc(cashout_finalize) refusée
    ok 49 - anon : rpc(withdrawal_request) refusée
    ok 50 - authenticated (compte CLIENT) : rpc(withdrawal_request) refusée
    ok 51 - anon : rpc(referral_commissions_release) refusée
    ok 52 - authenticated (compte CLIENT) : rpc(referral_commissions_release) refusée
    ok 53 - anon : rpc(finance_partner_summary) refusée
    ok 54 - authenticated (compte CLIENT) : rpc(finance_partner_summary) refusée
    ok 55 - anon : rpc(finance_platform_revenue) refusée
    ok 56 - authenticated (compte CLIENT) : rpc(finance_platform_revenue) refusée
ok 1 - R3 — RPC métier non appelables par anon / authenticated
    ok 1 - anon et authenticated : rpc(is_admin) acceptée
    ok 2 - anon et authenticated : rpc(is_superadmin) acceptée
    ok 3 - anon et authenticated : rpc(is_controller) acceptée
    ok 4 - anon et authenticated : rpc(has_role) acceptée
    ok 5 - anon et authenticated : rpc(is_partner_owner) acceptée
    ok 6 - anon et authenticated : rpc(auth_user_role) acceptée
ok 2 - R3 — aides RLS toujours appelables (sinon les politiques échouent)
# pass 62
# fail 0
```

Run 41 (après correctif) :

```text
    ok 1 - anon : rpc(validate_and_check_in_ticket) refusée
    ok 2 - authenticated (compte CLIENT) : rpc(validate_and_check_in_ticket) refusée
    ok 3 - anon : rpc(calculate_referral_commissions) refusée
    ok 4 - authenticated (compte CLIENT) : rpc(calculate_referral_commissions) refusée
    ok 5 - anon : rpc(activate_partner_trial) refusée
    ok 6 - authenticated (compte CLIENT) : rpc(activate_partner_trial) refusée
    ok 7 - anon : rpc(has_admin_permission) refusée
    ok 8 - authenticated (compte CLIENT) : rpc(has_admin_permission) refusée
    ok 9 - anon : rpc(create_hall_reservation_atomic) refusée
    ok 10 - authenticated (compte CLIENT) : rpc(create_hall_reservation_atomic) refusée
    ok 11 - anon : rpc(create_table_reservation_atomic) refusée
    ok 12 - authenticated (compte CLIENT) : rpc(create_table_reservation_atomic) refusée
    ok 13 - anon : rpc(atomic_partner_remove_controller) refusée
    ok 14 - authenticated (compte CLIENT) : rpc(atomic_partner_remove_controller) refusée
    ok 15 - anon : rpc(generate_referral_code) refusée
    ok 16 - authenticated (compte CLIENT) : rpc(generate_referral_code) refusée
    ok 17 - anon : rpc(ticket_sale_problems) refusée
    ok 18 - authenticated (compte CLIENT) : rpc(ticket_sale_problems) refusée
    ok 19 - anon : rpc(checkout_create_payment) refusée
    ok 20 - authenticated (compte CLIENT) : rpc(checkout_create_payment) refusée
    ok 21 - anon : rpc(payment_release) refusée
    ok 22 - authenticated (compte CLIENT) : rpc(payment_release) refusée
    ok 23 - anon : rpc(stock_reservations_expire) refusée
    ok 24 - authenticated (compte CLIENT) : rpc(stock_reservations_expire) refusée
    ok 25 - anon : rpc(refund_request) refusée
    ok 26 - authenticated (compte CLIENT) : rpc(refund_request) refusée
    ok 27 - anon : rpc(payment_confirm) refusée
    ok 28 - authenticated (compte CLIENT) : rpc(payment_confirm) refusée
    ok 29 - anon : rpc(free_tickets_claim) refusée
    ok 30 - authenticated (compte CLIENT) : rpc(free_tickets_claim) refusée
    ok 31 - anon : rpc(payment_webhook_record) refusée
    ok 32 - authenticated (compte CLIENT) : rpc(payment_webhook_record) refusée
    ok 33 - anon : rpc(finance_setting_set) refusée
    ok 34 - authenticated (compte CLIENT) : rpc(finance_setting_set) refusée
    ok 35 - anon : rpc(fin_setting) refusée
    ok 36 - authenticated (compte CLIENT) : rpc(fin_setting) refusée
    ok 37 - anon : rpc(finance_compute) refusée
    ok 38 - authenticated (compte CLIENT) : rpc(finance_compute) refusée
    ok 39 - anon : rpc(finance_quote) refusée
    ok 40 - authenticated (compte CLIENT) : rpc(finance_quote) refusée
    ok 41 - anon : rpc(finance_account_balance) refusée
    ok 42 - authenticated (compte CLIENT) : rpc(finance_account_balance) refusée
    ok 43 - anon : rpc(ticket_refund_request) refusée
    ok 44 - authenticated (compte CLIENT) : rpc(ticket_refund_request) refusée
    ok 45 - anon : rpc(cashout_finalize) refusée
    ok 46 - authenticated (compte CLIENT) : rpc(cashout_finalize) refusée
    ok 47 - anon : rpc(withdrawal_request) refusée
    ok 48 - authenticated (compte CLIENT) : rpc(withdrawal_request) refusée
    ok 49 - anon : rpc(referral_commissions_release) refusée
    ok 50 - authenticated (compte CLIENT) : rpc(referral_commissions_release) refusée
    ok 51 - anon : rpc(finance_partner_summary) refusée
    ok 52 - authenticated (compte CLIENT) : rpc(finance_partner_summary) refusée
    ok 53 - anon : rpc(finance_platform_revenue) refusée
    ok 54 - authenticated (compte CLIENT) : rpc(finance_platform_revenue) refusée
    ok 55 - anon : rpc(ticket_scan) refusée
    ok 56 - authenticated (compte CLIENT) : rpc(ticket_scan) refusée
    ok 57 - anon : rpc(ticket_cash_checkin) refusée
    ok 58 - authenticated (compte CLIENT) : rpc(ticket_cash_checkin) refusée
    ok 59 - anon : rpc(counter_sale) refusée
    ok 60 - authenticated (compte CLIENT) : rpc(counter_sale) refusée
    ok 61 - anon : rpc(shift_open) refusée
    ok 62 - authenticated (compte CLIENT) : rpc(shift_open) refusée
    ok 63 - anon : rpc(ticket_transfer_claim) refusée
    ok 64 - authenticated (compte CLIENT) : rpc(ticket_transfer_claim) refusée
    ok 65 - anon : rpc(scan_scanner_authorized) refusée
    ok 66 - authenticated (compte CLIENT) : rpc(scan_scanner_authorized) refusée
    ok 67 - anon : rpc(scan_event_problem) refusée
    ok 68 - authenticated (compte CLIENT) : rpc(scan_event_problem) refusée
ok 1 - R3 — RPC métier non appelables par anon / authenticated
    ok 1 - anon et authenticated : rpc(is_admin) acceptée
    ok 2 - anon et authenticated : rpc(is_superadmin) acceptée
    ok 3 - anon et authenticated : rpc(is_controller) acceptée
    ok 4 - anon et authenticated : rpc(has_role) acceptée
    ok 5 - anon et authenticated : rpc(is_partner_owner) acceptée
    ok 6 - anon et authenticated : rpc(auth_user_role) acceptée
ok 2 - R3 — aides RLS toujours appelables (sinon les politiques échouent)
# pass 74
# fail 0
```

### 4.4 — Fenêtre de scan, statut de l'événement, réglages access.*

```text
$ git grep -n -E 'isEventEligibleForController|start_date|end_date' fbcd9b2 -- app/api/controller/scan/route.ts
fbcd9b2:app/api/controller/scan/route.ts:6:import { isEventEligibleForController } from '@/lib/events/event-status';
fbcd9b2:app/api/controller/scan/route.ts:94:                events (id, title, start_date, location, partner_id, status),
fbcd9b2:app/api/controller/scan/route.ts:187:        if (eventData?.status && !isEventEligibleForController(eventData.status)) {
(code de sortie 0)
```

**Correctif** (`8464b74`, migration `…09`).
- Réglages `access.*` (section 3), écrits par `finance_setting_set`. Un ADMIN ne peut pas les écrire directement (RLS).
- `scan_event_problem` et `scan_window` refusent le scan et l'encaissement :
  - `event_not_open` hors fenêtre avant le début, ou pour un événement non PUBLIE ;
  - `event_ended` après la fenêtre ou pour un événement TERMINE ;
  - `event_suspended` ;
  - `event_cancelled`.

**parcours/acces-fenetre**

Run 34 (avant correctif) :

```text
    not ok 1 - 8 h avant le début → event_not_open
        → totp.generateTicketCode is not a function
    not ok 2 - 5 h avant le début, en cours, 5 h après la fin → valid
        → totp.generateTicketCode is not a function
    not ok 3 - fin + 6 h dépassée → event_ended
        → totp.generateTicketCode is not a function
not ok 1 - 4.4 Fenêtre de scan (réglages par défaut : 6 h avant, 6 h après)
    not ok 1 - non PUBLIE (VALIDE non publié, BROUILLON) → event_not_open
        → totp.generateTicketCode is not a function
    not ok 2 - ANNULE → event_cancelled ; SUSPENDU → event_suspended ; TERMINE → event_ended
        → totp.generateTicketCode is not a function
not ok 2 - 4.4 Statut de l’événement
    not ok 1 - access.scan_window_before_hours : un événement dans 8 h s’ouvre avec 10 h, pas avec 6 h
        → réglage access.scan_window_before_hours absent de platform_settings
    not ok 2 - access.scan_window_after_hours : un événement fini il y a 3 h se ferme avec 2 h, reste ouvert avec 6 h
        → réglage access.scan_window_after_hours absent de platform_settings
not ok 3 - 4.4 Fenêtre réglable
    not ok 1 - billet « à régler sur place » scanné cash_required, puis événement ANNULE → encaissement refusé, rien d’écrit
        → ouverture de caisse : HTTP 400 {"error":"Required"}
        → 400 !== 200
not ok 4 - 4.4 Encaissement sur un événement annulé
not ok 5 - /home/runner/work/event-village/event-village/tests/parcours/acces-fenetre.test.ts
        → relation "public.ticket_scans" does not exist
# pass 0
# fail 8
```

Run 41 (après correctif) :

```text
    ok 1 - 8 h avant le début → event_not_open
    ok 2 - 5 h avant le début, en cours, 5 h après la fin → valid
    ok 3 - fin + 6 h dépassée → event_ended
ok 1 - 4.4 Fenêtre de scan (réglages par défaut : 6 h avant, 6 h après)
    ok 1 - non PUBLIE (VALIDE non publié, BROUILLON) → event_not_open
    ok 2 - ANNULE → event_cancelled ; SUSPENDU → event_suspended ; TERMINE → event_ended
ok 2 - 4.4 Statut de l’événement
    ok 1 - access.scan_window_before_hours : un événement dans 8 h s’ouvre avec 10 h, pas avec 6 h
    ok 2 - access.scan_window_after_hours : un événement fini il y a 3 h se ferme avec 2 h, reste ouvert avec 6 h
ok 3 - 4.4 Fenêtre réglable
    ok 1 - billet « à régler sur place » scanné cash_required, puis événement ANNULE → encaissement refusé, rien d’écrit
ok 4 - 4.4 Encaissement sur un événement annulé
# pass 8
# fail 0
```

**Réglages `access.*` modifiables par le SUPERADMIN** (écart relevé pendant la rédaction de ce rapport, après le run 38 vert). La route `/api/admin/finance-settings` et sa page n'acceptaient que les clés `finance.*` : le SUPERADMIN ne pouvait changer les réglages `access.*` que par la base. En revanche, un ADMIN qui a `pricing.manage` les écrivait sans contrôle par `/api/admin/pricing`. Tests rouges `d1cd169` et `75ec7b1`.

```text
$ git grep -n -E 'startsWith|like\('"'"'key'"'"'' d1cd169 -- app/api/admin/finance-settings/route.ts
d1cd169:app/api/admin/finance-settings/route.ts:20:        supabase.from('platform_settings').select('key, value, description, updated_by, updated_at').like('key', 'finance.%').order('key'),
d1cd169:app/api/admin/finance-settings/route.ts:22:            .like('key', 'finance.%').order('changed_at', { ascending: false }).limit(100),
d1cd169:app/api/admin/finance-settings/route.ts:35:    key: z.string().startsWith('finance.'),
(code de sortie 0)

$ git grep -c -E 'access\.' d1cd169 -- app/admin/finance-settings/page.tsx
(code de sortie 1)

$ git grep -n -E finance-settings d1cd169 -- app components
d1cd169:app/admin/finance-settings/page.tsx:5: * GET / PUT /api/admin/finance-settings. Lecture : ADMIN et SUPERADMIN ; modification : SUPERADMIN
d1cd169:app/admin/finance-settings/page.tsx:115:      const res = await fetch('/api/admin/finance-settings', { cache: 'no-store' });
d1cd169:app/admin/finance-settings/page.tsx:169:      const res = await fetch('/api/admin/finance-settings', {
d1cd169:app/admin/finance/page.tsx:152:            href="/admin/finance-settings"
d1cd169:app/api/admin/finance-settings/route.ts:25:        console.error('[API /api/admin/finance-settings] lecture impossible :', error?.message ?? histErr?.message);
d1cd169:app/api/admin/finance-settings/route.ts:60:        console.error('[API /api/admin/finance-settings] écriture impossible :', error?.message);
d1cd169:app/api/admin/pricing/route.ts:54:        // Lot 3 : les réglages financiers (finance.*) ne passent que par /api/admin/finance-settings
d1cd169:app/api/admin/pricing/route.ts:57:            return NextResponse.json({ error: 'Réglage financier : utilisez /api/admin/finance-settings (SUPERADMIN).', code: 'FINANCE_SETTING' }, { status: 403 });
(code de sortie 0)
```

**Correctif** (`3143f36`).
- La route lit et accepte `finance.*` et `access.*`. La validation des valeurs et l'historique restent dans `finance_setting_set`, inchangés.
- La page présente deux sections, « Finance » et « Contrôle d'accès », avec libellés, aides et un choix pour le périmètre de la saisie manuelle. Ce travail d'interface est passé par le skill ui-ux-pro-max.
- `/api/admin/pricing` refuse les clés `access.*` (403 `ACCESS_SETTING`), comme les `finance.*`.

**parcours/acces-reglages**

Run 40 (avant correctif) :

```text
    ok 1 - les 4 clés access.* existent avec leur valeur par défaut
    not ok 2 - GET : l’ADMIN et le SUPERADMIN lisent les réglages access.* et leur historique
        → ADMIN : access.manual_entry_scope absent de la réponse (clés reçues : finance.aggregator_fee_rate.ORANGE_MONEY, finance.aggregator_fee_rate.WAVE, finance.cancellation_aggregator_fee_bearer, finance.payout_delay_hours, finance.payout_hold_enabled, finance.referral_availability_days, finance.service_f
    not ok 3 - PUT : 403 pour l’ADMIN (valeur inchangée), 200 pour le SUPERADMIN (valeur appliquée et historisée)
        → SUPERADMIN : HTTP 400 {"error":"Réglage invalide (clé finance.*, valeur, motif d’au moins 3 caractères).","details":{"formErrors":[],"fieldErrors":{"key":["Invalid input: must start with \"finance.\""]}}}
        → 400 !== 200
    not ok 4 - PUT SUPERADMIN : chaque type de réglage (choix, entier, booléen) est appliqué
        → access.manual_entry_scope = "STAFF" : HTTP 400 {"error":"Réglage invalide (clé finance.*, valeur, motif d’au moins 3 caractères).","details":{"formErrors":[],"fieldErrors":{"key":["Invalid input: must start with \"finance.\""]}}}
        → 400 !== 200
    ok 5 - PUT SUPERADMIN : valeur hors bornes ou clé inconnue refusées, sans effet
    not ok 6 - POST /api/admin/pricing : un ADMIN qui a pricing.manage n’écrit ni ne crée de clé access.* (403, sans effet)
        → access.scan_window_before_hours par /api/admin/pricing : HTTP 200 {"success":true,"key":"access.scan_window_before_hours","message":"Grille tarifaire \"access.scan_window_before_hours\" mise à jour avec succès."}
        → 200 !== 403
    not ok 7 - page /admin/finance-settings : les 4 clés access.* ont un libellé (contrôle statique)
        → access.manual_entry_scope : aucun libellé dans la page des réglages
not ok 1 - Réglages access.* (contrat A du lot 4)
# pass 2
# fail 5
```

Run 41 (après correctif) :

```text
    ok 1 - les 4 clés access.* existent avec leur valeur par défaut
    ok 2 - GET : l’ADMIN et le SUPERADMIN lisent les réglages access.* et leur historique
    ok 3 - PUT : 403 pour l’ADMIN (valeur inchangée), 200 pour le SUPERADMIN (valeur appliquée et historisée)
    ok 4 - PUT SUPERADMIN : chaque type de réglage (choix, entier, booléen) est appliqué
    ok 5 - PUT SUPERADMIN : valeur hors bornes ou clé inconnue refusées, sans effet
    ok 6 - POST /api/admin/pricing : un ADMIN qui a pricing.manage n’écrit ni ne crée de clé access.* (403, sans effet)
    ok 7 - page /admin/finance-settings : les 4 clés access.* ont un libellé (contrôle statique)
ok 1 - Réglages access.* (contrat A du lot 4)
# pass 7
# fail 0
```

**security/r16-reglages-acces**

Run 40 (garde-fou : vert avant correctif) :

```text
    ok 1 - un ADMIN ne modifie pas une clé access.* par REST (update ni upsert)
    ok 2 - un ADMIN ne crée ni ne supprime de clé access.* par REST
ok 1 - R16 — réglages du contrôle d’accès
# pass 2
# fail 0
```

Run 41 (après correctif) :

```text
    ok 1 - un ADMIN ne modifie pas une clé access.* par REST (update ni upsert)
    ok 2 - un ADMIN ne crée ni ne supprime de clé access.* par REST
ok 1 - R16 — réglages du contrôle d’accès
# pass 2
# fail 0
```

### 4.5 — Encaissement espèces transactionnel

```text
$ git grep -n -E 'recordCashPayment|getActiveShift|order_id' fbcd9b2 -- app/api/controller/scan/route.ts
fbcd9b2:app/api/controller/scan/route.ts:92:                order_id,
fbcd9b2:app/api/controller/scan/route.ts:241:            if (ticket.order_id) {
fbcd9b2:app/api/controller/scan/route.ts:245:                    .eq('id', ticket.order_id)
fbcd9b2:app/api/controller/scan/route.ts:276:                            order_id: order.id,
fbcd9b2:app/api/controller/scan/route.ts:416:    order_id:  z.string().uuid('order_id invalide.').optional(),
fbcd9b2:app/api/controller/scan/route.ts:444:        const { ticket_id: ticketId, order_id: orderId } = parse.data;
fbcd9b2:app/api/controller/scan/route.ts:450:            .select('id, event_id, status, price, order_id, ticket_number, user_id, events(status, partner_id, title, location), ticket_categories(name)')
fbcd9b2:app/api/controller/scan/route.ts:459:        const targetOrderId = orderId || ticket.order_id;
fbcd9b2:app/api/controller/scan/route.ts:460:        if (targetOrderId && ticket.order_id && ticket.order_id !== targetOrderId) {
fbcd9b2:app/api/controller/scan/route.ts:495:            const activeShift = await ShiftService.getActiveShift(user.id, ticket.event_id);
fbcd9b2:app/api/controller/scan/route.ts:565:            await ShiftService.recordCashPayment(activeShiftId, ticket.price);
fbcd9b2:app/api/controller/scan/route.ts:575:            newValue: { payment: 'CASH', amount: ticket.price, order_id: orderId, shift_id: activeShiftId },
(code de sortie 0)

$ git grep -n -E 'memory|Memory|catch \{' fbcd9b2 -- lib/shifts/shift.service.ts
fbcd9b2:lib/shifts/shift.service.ts:46:// Fallback in-memory ledger si table ou colonnes PostgREST pas encore en cache
fbcd9b2:lib/shifts/shift.service.ts:48:const memoryShifts = new Map<string, Shift>();
fbcd9b2:lib/shifts/shift.service.ts:338:        memoryShifts.set(shiftData.id, shiftData);
fbcd9b2:lib/shifts/shift.service.ts:360:                memoryShifts.set(inserted.id, inserted);
fbcd9b2:lib/shifts/shift.service.ts:389:                memoryShifts.set(data.id, data);
fbcd9b2:lib/shifts/shift.service.ts:392:        } catch {
fbcd9b2:lib/shifts/shift.service.ts:397:        for (const shift of Array.from(memoryShifts.values())) {
fbcd9b2:lib/shifts/shift.service.ts:415:        let shift = memoryShifts.get(shiftId);
fbcd9b2:lib/shifts/shift.service.ts:440:                    memoryShifts.set(updated.id, updated);
fbcd9b2:lib/shifts/shift.service.ts:471:        let shift: Shift | null = memoryShifts.get(shiftId) || null;
fbcd9b2:lib/shifts/shift.service.ts:479:        } catch {}
fbcd9b2:lib/shifts/shift.service.ts:522:        memoryShifts.set(shiftId, updatedShift);
fbcd9b2:lib/shifts/shift.service.ts:572:        let shift: Shift | null = memoryShifts.get(shiftId) || null;
fbcd9b2:lib/shifts/shift.service.ts:580:        } catch {}
fbcd9b2:lib/shifts/shift.service.ts:634:        } catch {}
fbcd9b2:lib/shifts/shift.service.ts:637:        for (const s of Array.from(memoryShifts.values())) {
fbcd9b2:lib/shifts/shift.service.ts:684:        } catch {}
fbcd9b2:lib/shifts/shift.service.ts:687:        for (const s of Array.from(memoryShifts.values())) {
fbcd9b2:lib/shifts/shift.service.ts:734:        } catch {}
fbcd9b2:lib/shifts/shift.service.ts:737:        for (const s of Array.from(memoryShifts.values())) {
fbcd9b2:lib/shifts/shift.service.ts:758:    static _clearMemory(): void {
fbcd9b2:lib/shifts/shift.service.ts:759:        memoryShifts.clear();
(code de sortie 0)
```

**Correctif** (`bc0c116`, migration `…11`). `ticket_cash_checkin` vérifie, puis écrit, dans une seule transaction :
- **contrôles :**
  - le scan `cash_required` du même scanneur et du même événement ;
  - une commande réellement impayée ;
  - une caisse ouverte, quel que soit le rôle (contrôleur, partenaire ou admin) ;
  - un événement toujours dans sa fenêtre ;
- **écritures :**
  - le montant du billet au prix facial, sans frais Event Village ;
  - un paiement hors plateforme rattaché à la caisse (`payments.shift_id`) ;
  - le total de la caisse incrémenté ;
  - le compostage.

En cas d'échec, rien n'est écrit et rien n'est composté. Autres changements :
- Une seule caisse ouverte par contrôleur et par événement (`uq_controller_shifts_one_open`).
- Clés étrangères en `ON DELETE RESTRICT` : `controller_shifts.event_id` et `tickets.order_id`.
- `ShiftService` est réécrit sans repli en mémoire. `shift_open` ouvre la caisse sous verrou.

**parcours/acces-encaissement**

Run 34 (avant correctif) :

```text
    not ok 1 - commande de 3 billets à régler sur place : cash_required au prix du billet, encaissement billet par billet, commande SUCCESS au dernier
        → ouverture de caisse : HTTP 400 {"error":"Required"}
        → 400 !== 200
    not ok 2 - commande de 2 billets VIP : un seul réglé → paid_amount = prix d’un billet, commande toujours impayée
        → ouverture de caisse : HTTP 400 {"error":"Required"}
        → 400 !== 200
    not ok 3 - commande payée entre le scan et l’encaissement : refus CASH_ALREADY_PAID, rien n’est composté ni encaissé
        → ouverture de caisse : HTTP 400 {"error":"Required"}
        → 400 !== 200
    not ok 4 - sans caisse ouverte : refus CASH_NO_OPEN_SHIFT pour le contrôleur, le partenaire propriétaire et l’admin, billet non composté
        → code dynamique du billet indisponible (lib/security/totp.ts, contrat C du lot 4) : totp.generateTicketCode is not a function
    not ok 5 - ouverture de caisse : partenaire propriétaire et admin ouvrent et encaissent ; contrôleur sans permission espèces refusé
        → ouverture de caisse : HTTP 400 {"error":"Required"}
        → 400 !== 200
    not ok 6 - scan d’un autre scanneur ou de plus de 5 minutes : refusé, billet non composté ; un scan frais du même scanneur passe
        → ouverture de caisse : HTTP 400 {"error":"Required"}
        → 400 !== 200
    not ok 7 - échec de l’encaissement (caisse fermée ou billet devenu non valable après le scan) : rien n’est composté, aucun paiement
        → ouverture de caisse : HTTP 400 {"error":"Required"}
        → 400 !== 200
    not ok 8 - ouvertures simultanées pour le même contrôleur et le même événement : une seule caisse OUVERT
        → au moins une ouverture acceptée : [[400,{"error":"Required"}],[400,{"error":"Required"}],[400,{"error":"Required"}],[400,{"error":"Required"}]]
not ok 1 - Encaissement espèces au scan
    not ok 1 - ShiftService sans repli en mémoire ni erreur avalée
        → replis mémoire ou erreurs avalées :
        → lib/shifts/shift.service.ts:48 (registre de caisse en mémoire) const memoryShifts = new Map<string, Shift>();
        → lib/shifts/shift.service.ts:48 (Map en mémoire) const memoryShifts = new Map<string, Shift>();
        → lib/shifts/shift.service.ts:338 (registre de caisse en mémoire) memoryShifts.set(shiftData.id, shiftData);
    not ok 2 - route de scan : encaissement délégué à ticket_cash_checkin (plus de compostage puis mise à jour de commande en TypeScript)
        → app/api/controller/scan/route.ts : l’encaissement passe par la RPC ticket_cash_checkin
    not ok 3 - schéma : index unique partiel des caisses OUVERT, ON DELETE RESTRICT sur controller_shifts.event_id, tickets.order_id et payments.shift_id
        → index unique partiel (controller_id, event_id) WHERE status = 'OUVERT' attendu :
        → CREATE UNIQUE INDEX controller_shifts_pkey ON public.controller_shifts USING btree (id)
        → CREATE INDEX idx_shifts_controller_event_status ON public.controller_shifts USING btree (controller_id, event_id, status)
        → CREATE INDEX idx_shifts_event_status ON public.controller_shifts USING btree (event_id, status)
    not ok 4 - RPC shift_open et ticket_cash_checkin : SECURITY DEFINER, search_path = public, réservées au service_role
        → fonction shift_open absente
not ok 2 - Contrôles statiques et schéma de la caisse
not ok 3 - /home/runner/work/event-village/event-village/tests/parcours/acces-encaissement.test.ts
        → relation "public.ticket_scans" does not exist
# pass 0
# fail 12
```

Run 41 (après correctif) :

```text
    ok 1 - commande de 3 billets à régler sur place : cash_required au prix du billet, encaissement billet par billet, commande SUCCESS au dernier
    ok 2 - commande de 2 billets VIP : un seul réglé → paid_amount = prix d’un billet, commande toujours impayée
    ok 3 - commande payée entre le scan et l’encaissement : refus CASH_ALREADY_PAID, rien n’est composté ni encaissé
    ok 4 - sans caisse ouverte : refus CASH_NO_OPEN_SHIFT pour le contrôleur, le partenaire propriétaire et l’admin, billet non composté
    ok 5 - ouverture de caisse : partenaire propriétaire et admin ouvrent et encaissent ; contrôleur sans permission espèces refusé
    ok 6 - scan d’un autre scanneur ou de plus de 5 minutes : refusé, billet non composté ; un scan frais du même scanneur passe
    ok 7 - échec de l’encaissement (caisse fermée ou billet devenu non valable après le scan) : rien n’est composté, aucun paiement
    ok 8 - ouvertures simultanées pour le même contrôleur et le même événement : une seule caisse OUVERT
ok 1 - Encaissement espèces au scan
    ok 1 - ShiftService sans repli en mémoire ni erreur avalée
    ok 2 - route de scan : encaissement délégué à ticket_cash_checkin (plus de compostage puis mise à jour de commande en TypeScript)
    ok 3 - schéma : index unique partiel des caisses OUVERT, ON DELETE RESTRICT sur controller_shifts.event_id, tickets.order_id et payments.shift_id
    ok 4 - RPC shift_open et ticket_cash_checkin : SECURITY DEFINER, search_path = public, réservées au service_role
ok 2 - Contrôles statiques et schéma de la caisse
# pass 12
# fail 0
```

### 4.6 — Vente au guichet

```text
$ git ls-tree --name-only -r fbcd9b2 -- 'app/api/events/[id]/tickets'
app/api/events/[id]/tickets/purchase/route.ts
(code de sortie 0)
```

**Correctif** (`764feff`, correction `4ce90c5`). Le guichet passe par `POST /api/controller/counter-sale` et la RPC `counter_sale` :
- **conditions :**
  - réglage `access.counter_sale_enabled` actif ;
  - contrôleur affecté, avec la permission espèces ;
  - caisse ouverte ;
  - contrôles de vente : catégorie active, stock sous verrou ;
- **effets :**
  - billet VALIDE au prix facial ;
  - paiement hors plateforme rattaché à la caisse, total de la caisse incrémenté ;
  - aucun frais, aucun revenu Event Village, aucune écriture au grand livre.

Le billet va au compte du numéro de l'acheteur s'il existe, sinon au vendeur (point ouvert 12). L'ancienne route d'émission par le staff et sa suite sont supprimées.

**parcours/acces-guichet**

Run 34 (avant correctif) :

```text
    not ok 1 - vente sans caisse ouverte : refusée, aucun billet ni paiement
        → POST /api/controller/counter-sale absente (contrat E du lot 4) : Cannot find module '/home/runner/work/event-village/event-village/app/api/controller/counter-sale/route' imported from /home/runner/work/event-village/event-village/tests/parcours/paiement-helpers.ts
    not ok 2 - contrôleur sans permission espèces, ou non affecté à l’événement : refusé
        → POST /api/controller/counter-sale absente (contrat E du lot 4) : Cannot find module '/home/runner/work/event-village/event-village/app/api/controller/counter-sale/route' imported from /home/runner/work/event-village/event-village/tests/parcours/paiement-helpers.ts
    not ok 3 - réglage access.counter_sale_enabled = false : refusé
        → ouverture de caisse : HTTP 400 {"error":"Required"}
        → 400 !== 200
    not ok 4 - vente réussie : billets VALIDE payés hors plateforme au prix facial, caisse créditée, revenu EV nul, aucune écriture au grand livre, stock décrémenté
        → ouverture de caisse : HTTP 400 {"error":"Required"}
        → 400 !== 200
    not ok 5 - catégorie inactive, stock insuffisant ou panier en partie impossible : refusé sans rien vendre
        → ouverture de caisse : HTTP 400 {"error":"Required"}
        → 400 !== 200
    not ok 6 - propriétaire des billets : compte du buyerPhone s’il existe, sinon le vendeur
        → ouverture de caisse : HTTP 400 {"error":"Required"}
        → 400 !== 200
not ok 1 - Vente au guichet en espèces
    not ok 1 - /api/events/[id]/tickets/purchase n’existe plus et n’est plus référencée
        → app/api/events/[id]/tickets/purchase/route.ts doit être supprimée (remplacée par /api/controller/counter-sale)
        → true !== false
    not ok 2 - RPC counter_sale : SECURITY DEFINER, search_path = public, réservée au service_role
        → fonction counter_sale absente
not ok 2 - Ancienne route d’émission par le staff et RPC du guichet
not ok 3 - /home/runner/work/event-village/event-village/tests/parcours/acces-guichet.test.ts
        → relation "public.ticket_scans" does not exist
# pass 0
# fail 8
```

Run 41 (après correctif) :

```text
    ok 1 - vente sans caisse ouverte : refusée, aucun billet ni paiement
    ok 2 - contrôleur sans permission espèces, ou non affecté à l’événement : refusé
    ok 3 - réglage access.counter_sale_enabled = false : refusé
    ok 4 - vente réussie : billets VALIDE payés hors plateforme au prix facial, caisse créditée, revenu EV nul, aucune écriture au grand livre, stock décrémenté
    ok 5 - catégorie inactive, stock insuffisant ou panier en partie impossible : refusé sans rien vendre
    ok 6 - propriétaire des billets : compte du buyerPhone s’il existe, sinon le vendeur
ok 1 - Vente au guichet en espèces
    ok 1 - /api/events/[id]/tickets/purchase n’existe plus et n’est plus référencée
    ok 2 - RPC counter_sale : SECURITY DEFINER, search_path = public, réservée au service_role
ok 2 - Ancienne route d’émission par le staff et RPC du guichet
# pass 8
# fail 0
```

### 4.7 — Résumé de caisse, PIN régisseur, retrait d'un contrôleur

```text
$ git grep -n -E 'HOOK_SECRET|SERVICE_ROLE|createHmac' fbcd9b2 -- lib/shifts/shift.service.ts
fbcd9b2:lib/shifts/shift.service.ts:52:    const salt = process.env.SUPABASE_AUTH_HOOK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
fbcd9b2:lib/shifts/shift.service.ts:53:    if (!salt) throw new Error('Sel du PIN régisseur absent (SUPABASE_AUTH_HOOK_SECRET ou SUPABASE_SERVICE_ROLE_KEY).');
fbcd9b2:lib/shifts/shift.service.ts:58:    return crypto.createHmac('sha256', getSalt()).update(pin.trim()).digest('hex');
(code de sortie 0)

$ git grep -n -E 'hasActiveShift|atomic_partner_remove_controller' fbcd9b2 -- app/api/partner/team app/api/admin/users
fbcd9b2:app/api/partner/team/assignments/route.ts:189:            const hasOpenShift = await ShiftService.hasActiveShift(controllerId, toRemove);
fbcd9b2:app/api/partner/team/controller/[controllerId]/route.ts:69:        const hasOpenShift = await ShiftService.hasActiveShift(controllerId, partnerEventIds);
fbcd9b2:app/api/partner/team/controller/[controllerId]/route.ts:82:        const { data: rpcResult, error: rpcErr } = await supabase.rpc('atomic_partner_remove_controller', {
(code de sortie 0)
```

**Correctif** (`977f0ec`).
- Le résumé de caisse est réservé à son contrôleur, au partenaire propriétaire et à l'admin (404 sinon).
- Le PIN est haché par HMAC avec `REGISSEUR_PIN_KEY` et un sel par événement (`event_regisseur_pins.pin_salt`). Il est renvoyé une seule fois en clair. Sa vérification est limitée par quota.
- La génération exige `{ confirm: true }`. Avec une caisse ouverte, elle répond 409 `OPEN_SHIFTS` (avec leur nombre), sauf `{ confirmOpenShifts: true }`. Elle est journalisée.
- Le trigger `controller_removal_guard` (`EV409`) refuse, tant qu'une caisse du contrôleur est OUVERT :
  - la suppression d'une affectation ;
  - le retrait du rôle CONTROLEUR.

  Les cinq chemins (équipe d'un événement, équipe complète, affectations, contrôleur, admin) répondent 409 `CONTROLLER_HAS_OPEN_SHIFT`.

**parcours/acces-caisse-pin**

Run 34 (avant correctif) :

```text
    ok 1 - lisible par son contrôleur, le partenaire propriétaire et un admin
    not ok 2 - 404 pour un autre contrôleur (même du même événement), un autre partenaire, une caisse inexistante
        → autre contrôleur du même événement : 404 attendu, reçu HTTP 200 {"success":true,"summary":{"shift_id":"1e049673-0c5a-4106-8609-28ff41b95d16","controller_id":"50a0776f-2e54-4b29-aae5-2ecbd555b302","controller_name":"Ibrahima Controleur","controller_phone":"+221777131711","event_id":"96ff1a8e-986f-4a2
        → 200 !== 404
    not ok 3 - le middleware laisse passer le partenaire propriétaire et l’admin vers la route du résumé
        → partenaire propriétaire : middleware → HTTP 403  (refusé)
        → false !== true
not ok 1 - Résumé de caisse (Z) : son contrôleur, le partenaire propriétaire, un admin ; 404 sinon
    not ok 1 - régénération sans { confirm: true } : refusée, PIN inchangé ; partenaire non propriétaire refusé
        → corps vide : régénération refusée attendue, reçu HTTP 200 {"success":true,"pin":"881857","event_id":"4316e2e0-ea42-474b-bcc9-626e7972b7fc","message":"Code PIN régisseur généré avec succès. Notez-le bien : il ne sera plus affiché en clair."}
    not ok 2 - caisse ouverte : 409 OPEN_SHIFTS, puis acceptée avec confirmOpenShifts ; chaque génération journalisée sans PIN ni haché
        → caisse ouverte : 409 attendu, reçu HTTP 200 {"success":true,"pin":"472432","event_id":"de5effe5-ab94-463c-917a-76d67266030d","message":"Code PIN régisseur généré avec succès. Notez-le bien : il ne sera plus affiché en clair."}
        → 200 !== 409
    not ok 3 - haché = HMAC(REGISSEUR_PIN_KEY, regisseur-pin:v2:<événement>:<sel>:<pin>), sel propre à chaque événement
        → le haché ne doit plus être HMAC(secret du hook SMS, PIN) : même PIN = même haché sur tous les événements
    not ok 4 - le haché du PIN n’est ni copié dans controller_shifts ni renvoyé par les routes
        → controller_shifts.regisseur_pin_used : plus de copie du haché
        → + 'fa2fdc9742d667565ff3b87e1b86506086728a132b28415faac6dfffc5ed91a1'
        → - null
not ok 2 - PIN régisseur
    not ok 1 - service_role : DELETE event_controllers : refusé (CONTROLLER_HAS_OPEN_SHIFT), affectation et rôle conservés
        → service_role : DELETE event_controllers : la base doit refuser le retrait
    not ok 2 - RPC atomic_partner_remove_controller : refusé (CONTROLLER_HAS_OPEN_SHIFT), affectation et rôle conservés
        → RPC atomic_partner_remove_controller : la base doit refuser le retrait
    not ok 3 - DELETE /api/partner/team/[eventId] : refusé (409 CONTROLLER_HAS_OPEN_SHIFT), affectation et rôle conservés
        → DELETE /api/partner/team/[eventId] : 409 attendu, reçu HTTP 200 {"success":true,"message":"Contrôleur retiré de l'événement."}
        → 200 !== 409
    not ok 4 - DELETE /api/partner/team/all : refusé (409 CONTROLLER_HAS_OPEN_SHIFT), affectation et rôle conservés
        → DELETE /api/partner/team/all : 409 attendu, reçu HTTP 200 {"success":true,"message":"Contrôleur retiré de 1 événement(s) du partenaire.","removed_count":1}
        → 200 !== 409
    not ok 5 - PATCH /api/partner/team/assignments (aucun événement) : refusé (409 CONTROLLER_HAS_OPEN_SHIFT), affectation et rôle conservés
        → PATCH /api/partner/team/assignments (aucun événement) : 409 attendu, reçu HTTP 400 {"error":"Ce contrôleur a une session de caisse ouverte, clôturez-la avant de le retirer.","code":"OPEN_SHIFT_EXISTS"}
        → 400 !== 409
    not ok 6 - service_role : DELETE user_roles CONTROLEUR : refusé (CONTROLLER_HAS_OPEN_SHIFT), affectation et rôle conservés
        → service_role : DELETE user_roles CONTROLEUR : la base doit refuser le retrait
    not ok 7 - PATCH /api/admin/users (rôle CLIENT) : refusé (409 CONTROLLER_HAS_OPEN_SHIFT), affectation et rôle conservés
        → PATCH /api/admin/users (rôle CLIENT) : 409 attendu, reçu HTTP 200 {"success":true,"user":{"id":"fa34b36b-5ca2-45d8-b344-eb80ea5a132a","first_name":"Ibrahima","last_name":"Controleur","phone":"+221774722688","email":"parcours-pay-ctrl-retrait-9c538acc09@test.eventvillage.local","role":"CLIENT","statu
        → 200 !== 409
    not ok 8 - DELETE /api/partner/team/controller/[controllerId] : refusé (409 CONTROLLER_HAS_OPEN_SHIFT), affectation et rôle conservés
        → DELETE /api/partner/team/controller/[controllerId] : 409 attendu, reçu HTTP 400 {"error":"Ce contrôleur a une session de caisse ouverte, clôturez-la avant de le retirer.","code":"OPEN_SHIFT_EXISTS"}
        → 400 !== 409
    ok 9 - caisse fermée : chaque chemin de retrait est accepté
not ok 3 - Retrait d’un contrôleur qui a une caisse OUVERT
not ok 4 - /home/runner/work/event-village/event-village/tests/parcours/acces-caisse-pin.test.ts
        → relation "public.ticket_scans" does not exist
# pass 2
# fail 14
```

Run 41 (après correctif) :

```text
    ok 1 - lisible par son contrôleur, le partenaire propriétaire et un admin
    ok 2 - 404 pour un autre contrôleur (même du même événement), un autre partenaire, une caisse inexistante
    ok 3 - le middleware laisse passer le partenaire propriétaire et l’admin vers la route du résumé
ok 1 - Résumé de caisse (Z) : son contrôleur, le partenaire propriétaire, un admin ; 404 sinon
    ok 1 - régénération sans { confirm: true } : refusée, PIN inchangé ; partenaire non propriétaire refusé
    ok 2 - caisse ouverte : 409 OPEN_SHIFTS, puis acceptée avec confirmOpenShifts ; chaque génération journalisée sans PIN ni haché
    ok 3 - haché = HMAC(REGISSEUR_PIN_KEY, regisseur-pin:v2:<événement>:<sel>:<pin>), sel propre à chaque événement
    ok 4 - le haché du PIN n’est ni copié dans controller_shifts ni renvoyé par les routes
ok 2 - PIN régisseur
    ok 1 - service_role : DELETE event_controllers : refusé (CONTROLLER_HAS_OPEN_SHIFT), affectation et rôle conservés
    ok 2 - RPC atomic_partner_remove_controller : refusé (CONTROLLER_HAS_OPEN_SHIFT), affectation et rôle conservés
    ok 3 - DELETE /api/partner/team/[eventId] : refusé (409 CONTROLLER_HAS_OPEN_SHIFT), affectation et rôle conservés
    ok 4 - DELETE /api/partner/team/all : refusé (409 CONTROLLER_HAS_OPEN_SHIFT), affectation et rôle conservés
    ok 5 - PATCH /api/partner/team/assignments (aucun événement) : refusé (409 CONTROLLER_HAS_OPEN_SHIFT), affectation et rôle conservés
    ok 6 - service_role : DELETE user_roles CONTROLEUR : refusé (CONTROLLER_HAS_OPEN_SHIFT), affectation et rôle conservés
    ok 7 - PATCH /api/admin/users (rôle CLIENT) : refusé (409 CONTROLLER_HAS_OPEN_SHIFT), affectation et rôle conservés
    ok 8 - DELETE /api/partner/team/controller/[controllerId] : refusé (409 CONTROLLER_HAS_OPEN_SHIFT), affectation et rôle conservés
    ok 9 - caisse fermée : chaque chemin de retrait est accepté
ok 3 - Retrait d’un contrôleur qui a une caisse OUVERT
# pass 16
# fail 0
```

**parcours/pin-regisseur**

Run 34 (code non corrigé, version du test antérieure à son adaptation dans un commit de correctif : pas un test rouge) :

```text
ok 1 - PIN régisseur : génération, vérification du bon PIN, refus d'un PIN erroné
ok 2 - PIN régisseur : un partenaire non propriétaire ne peut pas générer le PIN
# pass 2
# fail 0
```

Run 41 (après correctif) :

```text
ok 1 - PIN régisseur : génération, vérification du bon PIN, refus d'un PIN erroné
ok 2 - PIN régisseur : un partenaire non propriétaire ne peut pas générer le PIN
# pass 2
# fail 0
```

### 4.8 — Limiteurs

```text
$ git grep -n -E 'RateLimiter\.' fbcd9b2 -- app lib
fbcd9b2:app/api/auth/resolve-phone/route.ts:29:        const limitCheck = await RateLimiter.isRateLimited(normalizedPhone);
fbcd9b2:app/api/auth/resolve-phone/route.ts:54:            await RateLimiter.recordFailedAttempt(normalizedPhone);
fbcd9b2:app/api/auth/resolve-phone/route.ts:61:        await RateLimiter.resetAttempts(normalizedPhone);
fbcd9b2:app/api/auth/verify-otp/route.ts:36:        const limitCheck = await RateLimiter.isRateLimited(`otp_verify_${normalizedPhone}`);
fbcd9b2:app/api/auth/verify-otp/route.ts:55:            await RateLimiter.recordFailedAttempt(`otp_verify_${normalizedPhone}`);
fbcd9b2:app/api/auth/verify-otp/route.ts:60:        await RateLimiter.resetAttempts(`otp_verify_${normalizedPhone}`);
fbcd9b2:app/api/controller/scan/route.ts:43:        const scanLimit = await RateLimiter.checkAndRecord(scanRateKey, {
fbcd9b2:app/api/controller/setup/route.ts:46:        const { limited, remainingSeconds } = await RateLimiter.isRateLimited(rateLimitKey, { failClosed: true });
fbcd9b2:app/api/controller/setup/route.ts:56:            const attempt = await RateLimiter.recordFailedAttempt(rateLimitKey, { failClosed: true });
fbcd9b2:app/api/controller/setup/route.ts:150:        await RateLimiter.resetAttempts(rateLimitKey);
fbcd9b2:app/api/partner/register/route.ts:26:        const limitCheck = await RateLimiter.isRateLimited(`register_${clientIp}`);
fbcd9b2:app/api/partner/register/route.ts:43:            await RateLimiter.recordFailedAttempt(`register_${clientIp}`);
fbcd9b2:app/api/partner/register/route.ts:111:            await RateLimiter.recordFailedAttempt(`register_${clientIp}`);
fbcd9b2:app/api/partner/register/route.ts:218:        await RateLimiter.resetAttempts(`register_${clientIp}`);
fbcd9b2:app/api/partner/team/invite/route.ts:96:            RateLimiter.isRateLimited(partnerDailyRateKey, { maxAttempts: 20, windowSeconds: 86400, lockoutSeconds: 86400, failClosed: true }),
fbcd9b2:app/api/partner/team/invite/route.ts:97:            RateLimiter.isRateLimited(partnerHourlyRateKey, { maxAttempts: 20, windowSeconds: 3600, lockoutSeconds: 3600 }),
fbcd9b2:app/api/partner/team/invite/route.ts:98:            RateLimiter.isRateLimited(phoneRateKey, { maxAttempts: 3, windowSeconds: 86400, lockoutSeconds: 86400 }),
fbcd9b2:app/api/partner/team/invite/route.ts:412:            RateLimiter.recordAttempt(partnerDailyRateKey),
fbcd9b2:app/api/partner/team/invite/route.ts:413:            RateLimiter.recordAttempt(partnerHourlyRateKey),
fbcd9b2:app/api/partner/team/invite/route.ts:414:            RateLimiter.recordAttempt(phoneRateKey),
fbcd9b2:lib/shifts/shift.service.ts:130:        const rateCheck = await RateLimiter.isRateLimited(rateLimitKey, {
fbcd9b2:lib/shifts/shift.service.ts:169:            await RateLimiter.recordFailedAttempt(rateLimitKey, {
(code de sortie 0)

$ git grep -n -E 'category|max:' fbcd9b2 -- lib/sms/sms-guard.ts
fbcd9b2:lib/sms/sms-guard.ts:24:    category?: SmsCategory;
fbcd9b2:lib/sms/sms-guard.ts:34:    constructor(readonly recipient: string, readonly category: SmsCategory) {}
fbcd9b2:lib/sms/sms-guard.ts:50:        { scope: 'sms_phone', bucket: recipient, windowSecs: DAY, max: env.SMS_PER_PHONE_DAY },
fbcd9b2:lib/sms/sms-guard.ts:51:        { scope: 'sms_global', bucket: 'all', windowSecs: DAY, max: env.SMS_GLOBAL_DAILY_CAP },
fbcd9b2:lib/sms/sms-guard.ts:53:    if ((ctx.category ?? 'TRANSACTIONAL') === 'OTP') {
fbcd9b2:lib/sms/sms-guard.ts:55:            { scope: 'sms_otp_phone', bucket: recipient, windowSecs: 900, max: env.SMS_OTP_PER_PHONE_15MIN },
fbcd9b2:lib/sms/sms-guard.ts:56:            { scope: 'sms_otp_phone', bucket: recipient, windowSecs: DAY, max: env.SMS_OTP_PER_PHONE_DAY },
fbcd9b2:lib/sms/sms-guard.ts:60:                { scope: 'sms_otp_ip', bucket: ctx.ip, windowSecs: 3600, max: env.SMS_OTP_PER_IP_HOUR },
fbcd9b2:lib/sms/sms-guard.ts:61:                { scope: 'sms_otp_ip', bucket: ctx.ip, windowSecs: DAY, max: env.SMS_OTP_PER_IP_DAY },
fbcd9b2:lib/sms/sms-guard.ts:70:    const first = await reserveQuota([{ scope: 'sms_alert', bucket: 'global_cap', windowSecs: DAY, max: 1 }], 'alerte plafond SMS');
fbcd9b2:lib/sms/sms-guard.ts:102:    const category = ctx.category ?? 'TRANSACTIONAL';
fbcd9b2:lib/sms/sms-guard.ts:104:    const result = await reserveQuota(rulesFor(recipient, ctx), `SMS ${category}`);
fbcd9b2:lib/sms/sms-guard.ts:105:    if (result.allowed) return { ok: true, reservation: new SmsReservation(recipient, category) };
fbcd9b2:lib/sms/sms-guard.ts:110:        await raiseGlobalCapAlert({ category });
(code de sortie 0)
```

**Correctif** (`4cd6d05`, migration `…12`).
- `reserveQuota` (compteur en base, atomique, refus fermé) s'applique à :
  - resolve-phone, verify-otp, controller/setup, partner/register et l'invitation ;
  - le scan, l'encaissement, live-code et le PIN, chacun dans sa tâche.
- `lib/security/rate-limiter.ts` et les tables `rate_limits` et `auth_rate_limits` sont supprimés.
- Garde SMS :
  - limite par compte déclencheur (`SMS_PER_ACCOUNT_DAY`) ;
  - compteurs OTP séparés des notifications ;
  - part du plafond quotidien réservée à l'OTP (`SMS_GLOBAL_OTP_RESERVED_PERCENT`) : les SMS non OTP s'arrêtent à (100 − part) %.
- Un changement de statut partenaire identique ne renvoie plus de SMS (409 `STATUS_UNCHANGED`, point 5 du lot 1C).

**parcours/acces-limiteurs**

Run 34 (avant correctif) :

```text
    not ok 1 - rafale au-delà de SCAN_PER_SCANNER_10S → 429 rate_limited ; compteur en base, pas en mémoire de l’instance
        → scans acceptés par le quota : 400, 400, 400, 429/RATE_LIMIT_EXCEEDED, 400, 400
        → 5 !== 4
not ok 1 - 4.8 — scan : quota par scanneur en base
    not ok 1 - encaissement (PUT /api/controller/scan) : CASH_COLLECT_PER_SCANNER_MIN par scanneur
        → encaissement : tentative 3 au-delà de la limite (400, 400, 400)
        → 400 !== 429
    not ok 2 - live-code : LIVE_CODE_PER_USER_MIN par utilisateur
        → live-code : tentative 3 au-delà de la limite (200, 200, 200)
        → 200 !== 429
    not ok 3 - resolve-phone : RESOLVE_PHONE_PER_IP_HOUR par IP, numéros différents
        → resolve-phone : tentative 3 au-delà de la limite (404, 404, 404)
        → 404 !== 429
    not ok 4 - verify-otp : VERIFY_OTP_PER_PHONE_15MIN par numéro, depuis des IP différentes
        → verify-otp : tentative 3 au-delà de la limite (400, 400, 400)
        → 400 !== 429
    not ok 5 - controller/setup : CONTROLLER_SETUP_PER_PHONE_HOUR par numéro, depuis des IP différentes
        → controller/setup : tentative 3 au-delà de la limite (400, 400, 400)
        → 400 !== 429
    not ok 6 - partner/register : PARTNER_REGISTER_PER_IP_HOUR par IP (première valeur de x-forwarded-for), aucun SMS
        → partner/register : tentative 3 au-delà de la limite (400/INVALID_DOCUMENT_UPLOAD, 400/INVALID_DOCUMENT_UPLOAD, 400/INVALID_DOCUMENT_UPLOAD)
        → 400 !== 429
    not ok 7 - invitation : INVITE_PER_PARTNER_HOUR par partenaire
        → invitation par partenaire : tentative 3 au-delà de la limite (201, 201, 201)
        → 201 !== 429
    not ok 8 - invitation : INVITE_PER_PHONE_DAY par numéro invité, tous partenaires confondus
        → deuxième invitation du même numéro : HTTP 201 {"success":true,"assignments":[{"id":"72ffbc7e-da02-4014-831e-c39b6558d60b","event_id":"0f3a3ce7-9d9b-4aee-801f-06c7c4beb383","user_id":"32040852-988e-4b85-97cc-48d260f28afe","can_accept_cash":false,"created_at":"2026-10-31T23:13:02.163971+00:00"}],"assi
        → 201 !== 429
    not ok 9 - PIN régisseur : vérification limitée par reserveQuota (REGISSEUR_PIN_PER_SHIFT_15MIN), contrôle statique
        → aucun module de lib/ ne limite la vérification du PIN par reserveQuota avec REGISSEUR_PIN_PER_SHIFT_15MIN
not ok 2 - 4.8 — quotas en base sur chaque route
    not ok 1 - EXECUTE retiré sur quota_reserve → 503 sur scan, encaissement, live-code, resolve-phone, verify-otp, setup, register, invitation
        → routes qui ne refusent pas en 503 quand la garde est indisponible :
        → scan : HTTP 400 {"error":"Required"}
        → encaissement : HTTP 400 {"error":"Required"}
        → live-code : HTTP 200 {"success":true,"ticket_id":"47bec47a-5dc5-43b3-a949-372da7da8f32","qr_payload":"EVT1:EV-QR-b3d31ebc7d4943e79b9c988a6825b8e1:362051","totp_code":"362051","expir
not ok 3 - 4.8 — garde de quota indisponible : refus (fail-closed)
    not ok 1 - des notifications vers un numéro n’épuisent plus son quota OTP
        → OTP après 2 notifications au même numéro : HTTP 429 {"error":"Trop de demandes de SMS. Réessayez dans 47 minutes.","code":"SMS_RATE_LIMITED","retryAfterSeconds":2818}
        → 429 !== 200
    not ok 2 - un compte déclencheur au-delà de SMS_PER_ACCOUNT_DAY est bloqué (invitations d’un partenaire)
        → SMS reçus par invité (limite de 2 SMS pour le compte du partenaire) : 1, 1, 1
        → 1,
        → 1,
        → +   1
    not ok 3 - plafond global presque atteint par des SMS non OTP : les non OTP s’arrêtent à 70 %, les OTP utilisent tout le plafond
        → SMS non OTP envoyés avant l'arrêt (plafond 10, part OTP 30 %) : 10
        → 10 !== 7
not ok 4 - 4.8 — anti-abus SMS
    not ok 1 - lib/security/rate-limiter.ts n’existe plus
        → lib/security/rate-limiter.ts existe encore
        → true !== false
    not ok 2 - plus aucun import ni usage de RateLimiter dans app/, lib/, components/, hooks/, tests/ (legacy comprises) ni middleware.ts
        → références à RateLimiter :
        → app/api/auth/resolve-phone/route.ts:28 const { RateLimiter } = await import('@/lib/security/rate-limiter');
        → app/api/auth/resolve-phone/route.ts:29 const limitCheck = await RateLimiter.isRateLimited(normalizedPhone);
        → app/api/auth/resolve-phone/route.ts:54 await RateLimiter.recordFailedAttempt(normalizedPhone);
    not ok 3 - variables de quota déclarées dans lib/env.ts et réglées dans .env.test.example (valeurs du contrat)
        → variables absentes :
        → lib/env.ts : SCAN_PER_SCANNER_10S
        → .env.test.example : SCAN_PER_SCANNER_10S=30
        → lib/env.ts : CASH_COLLECT_PER_SCANNER_MIN
not ok 5 - 4.8 — contrôles statiques
not ok 6 - /home/runner/work/event-village/event-village/tests/parcours/acces-limiteurs.test.ts
        → relation "public.ticket_scans" does not exist
# pass 0
# fail 17
```

Run 41 (après correctif) :

```text
    ok 1 - rafale au-delà de SCAN_PER_SCANNER_10S → 429 rate_limited ; compteur en base, pas en mémoire de l’instance
ok 1 - 4.8 — scan : quota par scanneur en base
    ok 1 - encaissement (PUT /api/controller/scan) : CASH_COLLECT_PER_SCANNER_MIN par scanneur
    ok 2 - live-code : LIVE_CODE_PER_USER_MIN par utilisateur
    ok 3 - resolve-phone : RESOLVE_PHONE_PER_IP_HOUR par IP, numéros différents
    ok 4 - verify-otp : VERIFY_OTP_PER_PHONE_15MIN par numéro, depuis des IP différentes
    ok 5 - controller/setup : CONTROLLER_SETUP_PER_PHONE_HOUR par numéro, depuis des IP différentes
    ok 6 - partner/register : PARTNER_REGISTER_PER_IP_HOUR par IP (première valeur de x-forwarded-for), aucun SMS
    ok 7 - invitation : INVITE_PER_PARTNER_HOUR par partenaire
    ok 8 - invitation : INVITE_PER_PHONE_DAY par numéro invité, tous partenaires confondus
    ok 9 - PIN régisseur : vérification limitée par reserveQuota (REGISSEUR_PIN_PER_SHIFT_15MIN), contrôle statique
ok 2 - 4.8 — quotas en base sur chaque route
    ok 1 - EXECUTE retiré sur quota_reserve → 503 sur scan, encaissement, live-code, resolve-phone, verify-otp, setup, register, invitation
ok 3 - 4.8 — garde de quota indisponible : refus (fail-closed)
    ok 1 - des notifications vers un numéro n’épuisent plus son quota OTP
    ok 2 - un compte déclencheur au-delà de SMS_PER_ACCOUNT_DAY est bloqué (invitations d’un partenaire)
    ok 3 - plafond global presque atteint par des SMS non OTP : les non OTP s’arrêtent à 70 %, les OTP utilisent tout le plafond
ok 4 - 4.8 — anti-abus SMS
    ok 1 - lib/security/rate-limiter.ts n’existe plus
    ok 2 - plus aucun import ni usage de RateLimiter dans app/, lib/, components/, hooks/, tests/ (legacy comprises) ni middleware.ts
    ok 3 - variables de quota déclarées dans lib/env.ts et réglées dans .env.test.example (valeurs du contrat)
ok 5 - 4.8 — contrôles statiques
# pass 17
# fail 0
```

**partner-auth-complete**

Run 34 (code non corrigé, version du test antérieure à son adaptation dans un commit de correctif : pas un test rouge) :

```text
ok 1 - 1. Register Partenaire : Schéma strict avec documents obligatoires (Bucket Privé) et statut initial EN_ATTENTE
ok 2 - 2. OTP Validation : Code conforme et vérification
ok 3 - 3. OTP Invalide : Détection et rejet
ok 4 - 4. OTP Expiré : Rejet après dépassement de validité
ok 5 - 5. Login Valide : Rôle résolu côté serveur
ok 6 - 6. Login Mauvais Mot de Passe : Échec d'authentification
ok 7 - 7. Accès Partner Autorisé : Rôle PARTENAIRE -> /partner/*
ok 8 - 8. Accès Client → /partner Interdit
ok 9 - 9. Accès Partner → /admin Interdit
ok 10 - 10. Accès Admin → /admin Autorisé
ok 11 - 11. Accès Contrôleur → /partner/scan Autorisé
ok 12 - 12. Accès Client → /partner/scan Interdit
ok 13 - 13. Upload Document Autorisé : Dossier propriétaire auth.uid()
ok 14 - 14. Accès Document Autre Partenaire Interdit (Isolation Cross-Tenant)
ok 15 - 15. Validation Partenaire : Statut VALIDE et Notification
ok 16 - 16. Refus Partenaire : Statut REJETE avec motif conservé
ok 17 - 17. Suspension Partenaire : Statut SUSPENDU et blocage d'accès
ok 18 - 18. Réactivation Partenaire : Statut ACTIF restauré
ok 19 - 19. Reset Password : Token / OTP sécurisé
ok 20 - 20. Sensitive Action OTP : Protection des retraits
ok 21 - 21. Audit Log : Journalisation inaltérable des actions partenaires
ok 22 - 22. Anti-Brute-Force : RateLimiter bloque après 5 échecs consécutifs
ok 23 - 23. Première Activation : Durée 60 jours Standard vs 90 jours Founder
ok 24 - 24. Période d'Essai Idempotente : Non recalculée sur les connexions suivantes
# pass 24
# fail 0
```

Run 41 (après correctif) :

```text
ok 1 - 1. Register Partenaire : Schéma strict avec documents obligatoires (Bucket Privé) et statut initial EN_ATTENTE
ok 2 - 2. OTP Validation : Code conforme et vérification
ok 3 - 3. OTP Invalide : Détection et rejet
ok 4 - 4. OTP Expiré : Rejet après dépassement de validité
ok 5 - 5. Login Valide : Rôle résolu côté serveur
ok 6 - 6. Login Mauvais Mot de Passe : Échec d'authentification
ok 7 - 7. Accès Partner Autorisé : Rôle PARTENAIRE -> /partner/*
ok 8 - 8. Accès Client → /partner Interdit
ok 9 - 9. Accès Partner → /admin Interdit
ok 10 - 10. Accès Admin → /admin Autorisé
ok 11 - 11. Accès Contrôleur → /partner/scan Autorisé
ok 12 - 12. Accès Client → /partner/scan Interdit
ok 13 - 13. Upload Document Autorisé : Dossier propriétaire auth.uid()
ok 14 - 14. Accès Document Autre Partenaire Interdit (Isolation Cross-Tenant)
ok 15 - 15. Validation Partenaire : Statut VALIDE et Notification
ok 16 - 16. Refus Partenaire : Statut REJETE avec motif conservé
ok 17 - 17. Suspension Partenaire : Statut SUSPENDU et blocage d'accès
ok 18 - 18. Réactivation Partenaire : Statut ACTIF restauré
ok 19 - 19. Reset Password : Token / OTP sécurisé
ok 20 - 20. Sensitive Action OTP : Protection des retraits
ok 21 - 21. Audit Log : Journalisation inaltérable des actions partenaires
ok 22 - 22. Anti-Brute-Force : le quota en base bloque la 6e tentative après 5
ok 23 - 23. Première Activation : Durée 60 jours Standard vs 90 jours Founder
ok 24 - 24. Période d'Essai Idempotente : Non recalculée sur les connexions suivantes
# pass 24
# fail 0
```

### 4.9 — Traçabilité des tentatives, écran du scanneur

```text
$ git grep -n -E 'logAudit|TICKET_SCAN' fbcd9b2 -- app/api/controller/scan/route.ts
fbcd9b2:app/api/controller/scan/route.ts:355:        await AdminService.logAudit({
fbcd9b2:app/api/controller/scan/route.ts:358:            action: 'TICKET_SCAN',
fbcd9b2:app/api/controller/scan/route.ts:569:        await AdminService.logAudit({
(code de sortie 0)

$ git grep -n -E 'res\.status|\|\| '"'"'invalid'"'"'|speak' fbcd9b2 -- app/controller/scanner/page.tsx
fbcd9b2:app/controller/scanner/page.tsx:483:            let finalResult: ScanResult = data.scan_result || 'invalid';
(code de sortie 0)
```

**Correctif** (`b44b69f` pour la table, `af8900d` pour l'écran).
- Chaque tentative tranchée écrit une ligne `ticket_scans`, refus et interdictions (`forbidden`) compris. On y trouve le résultat, la méthode (QR ou saisie manuelle) et l'empreinte SHA-256 du payload, jamais le payload lui-même. Les refus de quota (429) et les erreurs techniques n'en écrivent pas (point ouvert 19).
- Le type de résultat est unique et partagé par l'API et les deux écrans (`lib/scan/scan-result.ts`).
- Une erreur technique (401, 403, 429, 5xx, réseau) n'est jamais présentée comme « billet invalide » : elle ne déclenche ni voix ni compteur de refus. Un 401 renvoie à la connexion.
- Le scan est mis en pause pendant la confirmation d'un encaissement. Un refus d'encaissement reste affiché, avec des actions explicites.
- L'écran est passé par le skill ui-ux-pro-max. Il n'a pas été vérifié en navigateur (point ouvert 18).

**parcours/acces-tracabilite**

Run 34 (avant correctif) :

```text
    not ok 1 - une ligne par tentative (acceptée ou refusée), complète, sans payload en clair ; scan_id = ligne du journal
        → totp.generateTicketCode is not a function
    not ok 2 - colonnes du contrat ; journal illisible par un compte connecté (service_role seul)
        → ticket_scans : Could not find the table 'public.ticket_scans' in the schema cache
        → +   code: 'PGRST205',
        → +   details: null,
        → +   hint: null,
not ok 1 - 4.9 Journal ticket_scans
    not ok 1 - type ScanResult = exactement l’union du contrat
        → lib/scan/scan-result.ts doit exister
not ok 2 - 4.9 Union des résultats (lib/scan/scan-result.ts)
    not ok 1 - SCAN_PER_SCANNER_10S déclaré dans .env.test.example ; rafale au-delà → 429 rate_limited
        → SCAN_PER_SCANNER_10S dans .env.test.example
not ok 3 - 4.9 Quota par scanneur
    not ok 1 - le statut HTTP de la réponse est lu ; 401 renvoie vers la connexion
        → le statut HTTP de /api/controller/scan doit être lu (res.status / res.ok)
    not ok 2 - erreurs techniques traitées à part : jamais « invalide » par défaut, ni voix Wolof de rejet, ni compteur de refus
        → résultat technique rate_limited traité explicitement
    not ok 3 - caméra en pause pendant une confirmation d’encaissement espèces
        → la caméra doit être suspendue (prop ou rendu conditionnel) tant qu’une confirmation espèces est en attente
    not ok 4 - l’union des résultats est importée de lib/scan/scan-result (API et interfaces)
        → app/controller/scanner/page.tsx (ou son composant de résultat) importe lib/scan/scan-result
not ok 4 - 4.9 Scanner contrôleur (contrôle statique)
not ok 5 - /home/runner/work/event-village/event-village/tests/parcours/acces-tracabilite.test.ts
        → relation "public.ticket_scans" does not exist
# pass 0
# fail 8
```

Run 41 (après correctif) :

```text
    ok 1 - une ligne par tentative (acceptée ou refusée), complète, sans payload en clair ; scan_id = ligne du journal
    ok 2 - colonnes du contrat ; journal illisible par un compte connecté (service_role seul)
ok 1 - 4.9 Journal ticket_scans
    ok 1 - type ScanResult = exactement l’union du contrat
ok 2 - 4.9 Union des résultats (lib/scan/scan-result.ts)
    ok 1 - SCAN_PER_SCANNER_10S déclaré dans .env.test.example ; rafale au-delà → 429 rate_limited
ok 3 - 4.9 Quota par scanneur
    ok 1 - le statut HTTP de la réponse est lu ; 401 renvoie vers la connexion
    ok 2 - erreurs techniques traitées à part : jamais « invalide » par défaut, ni voix Wolof de rejet, ni compteur de refus
    ok 3 - caméra en pause pendant une confirmation d’encaissement espèces
    ok 4 - l’union des résultats est importée de lib/scan/scan-result (API et interfaces)
ok 4 - 4.9 Scanner contrôleur (contrôle statique)
# pass 8
# fail 0
```

### 4.10 — Invariant du contrôle d'accès

```text
$ git grep -n -E 'ACCESS_INVARIANT_SQL|assertAccessInvariants' fbcd9b2 -- tests/helpers
fbcd9b2:tests/helpers/access-invariants.ts:16:export const ACCESS_INVARIANT_SQL = `
fbcd9b2:tests/helpers/access-invariants.ts:65:    return inspect(async (db) => (await db.query<Violation>(ACCESS_INVARIANT_SQL)).rows);
fbcd9b2:tests/helpers/access-invariants.ts:69:export async function assertAccessInvariants(label: string): Promise<void> {
(code de sortie 0)
```

**Correctif.** Aucun code de production : l'invariant (g)(h)(i) est un contrôle des tests (section 4). Il est vérifié en `after()` par chaque suite du lot, après les invariants des lots 2 et 3. La suite `acces-invariant` vérifie que chaque règle détecte une violation fabriquée. La règle (g) a été modifiée après le commit rouge (`e2bee8e`, voir section 1).

**parcours/acces-invariant**

Run 34 (avant correctif) :

```text
    not ok 1 - chaque règle détecte une violation fabriquée (transaction annulée)
        → relation "public.ticket_scans" does not exist
not ok 1 - Invariant du contrôle (g)(h)(i)
        → relation "public.ticket_scans" does not exist
# pass 0
# fail 1
```

Run 41 (après correctif) :

```text
    ok 1 - chaque règle détecte une violation fabriquée (transaction annulée)
ok 1 - Invariant du contrôle (g)(h)(i)
# pass 1
# fail 0
```

### Complément — Données pour le pilotage

```text
$ git grep -n -E 'entry_point|ticket_scans' e4fb3aa -- supabase/migrations app lib
(code de sortie 1)
```

**Correctif** (`13657c1`, migration `…13`).
- `event_controllers.entry_point` : 80 caractères au plus, modifiable par le partenaire propriétaire ou l'admin (`PATCH /api/partner/team/entry-point`, 404 sinon).
- Le trigger `ticket_scans_enrich` recopie sur chaque ligne, au moment du scan, la catégorie, le rôle du scanneur (CONTROLEUR, PARTENAIRE ou ADMIN) et le point d'entrée de son affectation.
- Index : `(event_id, created_at)` (migration `…10`), `(event_id, scanner_id, created_at)` et `(event_id, category_id)` (`…13`).
- Lecture par API et par Realtime : RLS `ticket_scans_owner_admin_select` (partenaire propriétaire et admins), table ajoutée à la publication `supabase_realtime`.
- L'écran de pilotage n'est pas construit (lot 5).

**parcours/acces-pilotage**

Run 36 (tests du complément, avant son correctif) :

```text
    not ok 1 - point d’entrée : modifiable par le partenaire propriétaire seulement, recopié sur le scan avec la catégorie et le rôle du scanneur
        → Cannot find module '/home/runner/work/event-village/event-village/app/api/partner/team/entry-point/route' imported from /home/runner/work/event-village/event-village/tests/parcours/paiement-helpers.ts
    not ok 2 - index par événement et période, et par événement et scanneur
        → index (event_id, created_at) : 
    not ok 3 - lecture par l’API : partenaire propriétaire oui, partenaire B et client non
        → journal d’une tentative : Could not find the function public.scan_log(p_accepted, p_amount, p_event, p_hash, p_identity, p_method, p_result, p_scanner, p_ticket) in the schema cache
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.scan_log with parameters p_accepted, p_amount, p_event, p_hash, p_identity, p_method, p_result, p_scanner, p_ticket or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 4 - Realtime : le partenaire propriétaire reçoit les scans de son événement, le partenaire B rien
        → journal d’une tentative : Could not find the function public.scan_log(p_accepted, p_amount, p_event, p_hash, p_identity, p_method, p_result, p_scanner, p_ticket) in the schema cache
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.scan_log with parameters p_accepted, p_amount, p_event, p_hash, p_identity, p_method, p_result, p_scanner, p_ticket or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
not ok 1 - Données de pilotage : ticket_scans
        → relation "public.ticket_scans" does not exist
# pass 0
# fail 4
```

Run 41 (après correctif) :

```text
    ok 1 - point d’entrée : modifiable par le partenaire propriétaire seulement, recopié sur le scan avec la catégorie et le rôle du scanneur
    ok 2 - index par événement et période, et par événement et scanneur
    ok 3 - lecture par l’API : partenaire propriétaire oui, partenaire B et client non
    ok 4 - Realtime : le partenaire propriétaire reçoit les scans de son événement, le partenaire B rien
ok 1 - Données de pilotage : ticket_scans
# pass 4
# fail 0
```

### Correctif d'un défaut du lot 3 — retraits simultanés

```text
$ git grep -n -E 'available_at <= (now|clock_timestamp)\(\)' e4fb3aa -- supabase/migrations
e4fb3aa:supabase/migrations/20261101000004_lot3_grand_livre.sql:321:    SELECT COALESCE(sum(amount) FILTER (WHERE available_at <= now()), 0),
e4fb3aa:supabase/migrations/20261101000006_lot3_commissions.sql:142:     WHERE kind = 'COMMISSION' AND status = 'PENDING' AND available_at <= now();
e4fb3aa:supabase/migrations/20261101000006_lot3_commissions.sql:231:           AND rc.available_at <= now()
e4fb3aa:supabase/migrations/20261101000007_lot3_retraits.sql:109:     WHERE owner_id = v_user AND account_kind = v_kind AND available_at <= now();
e4fb3aa:supabase/migrations/20261101000008_lot3_rapports.sql:31:           COALESCE(sum(l.amount) FILTER (WHERE l.entry_type IN ('VENTE', 'REMBOURSEMENT') AND l.available_at <= now()), 0) AS available,
(code de sortie 0)
```

**Correctif** (`00a193c`, migration `…14`). `withdrawal_request` lit le solde disponible avec `available_at <= clock_timestamp()` une fois le verrou du compte obtenu, et non plus avec `now()`.

Pourquoi : `now()` est l'heure de début de la transaction. Une demande concurrente commencée avant la validation de la première attendait le verrou, puis ignorait le débit de celle-ci, daté plus tard que son propre `now()`.

Les autres lectures `available_at <= now()` relevées par le grep (soldes affichés, libération des commissions, rapports) ne décident pas d'un débit sous verrou. Elles ne sont pas modifiées. La suite `finance-retraits` n'est pas modifiée : son cas 4 (« deux retraits simultanés ») a révélé le défaut au run 36.

**parcours/finance-retraits**

Run 36 (défaut de concurrence du lot 3 révélé, avant son correctif) :

```text
    ok 1 - solde organisateur : prix faciaux des billets payés en ligne seulement ; vente espèces et invitation n’ajoutent rien
    ok 2 - fonds en attente jusqu’à la fin de l’événement + 48 h ; disponibles dès la confirmation si payout_hold_enabled = false (non rétroactif)
    ok 3 - date de fin absente : date de début à 23:59 (Africa/Dakar) + 48 h
    not ok 4 - deux retraits simultanés qui dépassent ensemble le solde : un seul accepté
        → une seule demande acceptée : [{"ok":true,"status":"PROCESSING","cashout_id":"73888a56-6c2d-426f-ae29-56cb6c008313","fee_amount":60,"net_amount":5940,"gross_amount":6000,"withdrawal_id":"b2d23aee-f407-4ae5-a47f-cbe73f48d8a0"},{"ok":true,"status":"PROCESSING","cashout_id":"0d33ff84-2c21-41ba-bfef-ddaa
        → 2 !== 1
    ok 5 - montants et comptes refusés : BELOW_MINIMUM (seuil 5 000 F), INVALID_AMOUNT, INSUFFICIENT_BALANCE, NOT_PARTNER
    ok 6 - virement bancaire refusé tant que finance.withdrawal_bank_enabled est désactivé (BANK_DISABLED)
    ok 7 - frais de 1 % arrondis au FCFA supérieur ; cashout WITHDRAWAL-<id> au montant net, vers le numéro déclaré
    ok 8 - délai dépassé après envoi : cashout INCERTAIN, aucun second envoi, retrait non REJECTED, solde toujours réservé
    ok 9 - refus explicite de SamirPay : retrait REJECTED, écriture RETRAIT_ANNULE, solde rendu
    ok 10 - solde de parrainage distinct du solde organisateur ; retirable au FCFA inférieur ; commissions allouées
    ok 11 - compte SUSPENDU : retrait, code de retrait et solde refusés (ACCOUNT_NOT_ACTIVE)
    ok 12 - Idempotency-Key : même clé → même retrait, un seul cashout, un seul envoi ; RPC : DUPLICATE avant le contrôle du solde
    ok 13 - GET /api/finance/balance : disponible, en attente, retraits en cours et historique ; 401 sans session
    ok 14 - contrôle statique : plus d’envoi d’argent hors du module de cashout, plus de request_withdrawal
    ok 15 - ancienne RPC request_withdrawal supprimée
not ok 1 - Lot 3.6 — soldes et retraits
not ok 2 - /home/runner/work/event-village/event-village/tests/parcours/finance-retraits.test.ts
        → invariant financier violé :
        → (e) d993bda2-d76a-4db3-a8b2-bd81581e90dd/ORGANISATEUR : solde total -2000.00, disponible -2000.00
        → +     detail: 'solde total -2000.00, disponible -2000.00',
        → +     objet: 'd993bda2-d76a-4db3-a8b2-bd81581e90dd/ORGANISATEUR',
# pass 14
# fail 1
```

Run 41 (après correctif) :

```text
    ok 1 - solde organisateur : prix faciaux des billets payés en ligne seulement ; vente espèces et invitation n’ajoutent rien
    ok 2 - fonds en attente jusqu’à la fin de l’événement + 48 h ; disponibles dès la confirmation si payout_hold_enabled = false (non rétroactif)
    ok 3 - date de fin absente : date de début à 23:59 (Africa/Dakar) + 48 h
    ok 4 - deux retraits simultanés qui dépassent ensemble le solde : un seul accepté
    ok 5 - montants et comptes refusés : BELOW_MINIMUM (seuil 5 000 F), INVALID_AMOUNT, INSUFFICIENT_BALANCE, NOT_PARTNER
    ok 6 - virement bancaire refusé tant que finance.withdrawal_bank_enabled est désactivé (BANK_DISABLED)
    ok 7 - frais de 1 % arrondis au FCFA supérieur ; cashout WITHDRAWAL-<id> au montant net, vers le numéro déclaré
    ok 8 - délai dépassé après envoi : cashout INCERTAIN, aucun second envoi, retrait non REJECTED, solde toujours réservé
    ok 9 - refus explicite de SamirPay : retrait REJECTED, écriture RETRAIT_ANNULE, solde rendu
    ok 10 - solde de parrainage distinct du solde organisateur ; retirable au FCFA inférieur ; commissions allouées
    ok 11 - compte SUSPENDU : retrait, code de retrait et solde refusés (ACCOUNT_NOT_ACTIVE)
    ok 12 - Idempotency-Key : même clé → même retrait, un seul cashout, un seul envoi ; RPC : DUPLICATE avant le contrôle du solde
    ok 13 - GET /api/finance/balance : disponible, en attente, retraits en cours et historique ; 401 sans session
    ok 14 - contrôle statique : plus d’envoi d’argent hors du module de cashout, plus de request_withdrawal
    ok 15 - ancienne RPC request_withdrawal supprimée
ok 1 - Lot 3.6 — soldes et retraits
# pass 15
# fail 0
```

---

## 3. Réglages créés

### Réglages en base (`platform_settings`)

Les clés sont créées par la migration `20261101000009_lot4_reglages_acces.sql`, sous la forme `{"value": …}`, avec les mêmes règles qu'au lot 3 :
- **Modification** : SUPERADMIN actif uniquement, par `PUT /api/admin/finance-settings` ou la page `/admin/finance-settings` (section « Contrôle d'accès »). La RPC `finance_setting_set` valide la valeur et exige un motif ; chaque modification est historisée dans `platform_settings_history`.
- **Lecture** : ADMIN et SUPERADMIN.
- **Refusé** :
  - l'écriture directe par un ADMIN (RLS, R16) ;
  - l'écriture par `/api/admin/pricing` (403 `ACCESS_SETTING`) ;
  - toute clé `access.*` inconnue (`UNKNOWN_KEY`).

Les valeurs sont lues au moment de chaque scan, encaissement ou vente.

| Clé | Défaut | Valeurs admises | Effet |
|---|---|---|---|
| `access.manual_entry_scope` | `ASSIGNED_CONTROLLER` | `ASSIGNED_CONTROLLER` (contrôleur affecté seul), `STAFF` (contrôleur affecté, partenaire propriétaire et admin) | qui peut valider un billet par saisie manuelle de son numéro, toujours avec pièce d'identité vérifiée |
| `access.scan_window_before_hours` | 6 | entier de 0 à 48 (heures) | ouverture du scan et de l'encaissement : début de l'événement − N heures |
| `access.scan_window_after_hours` | 6 | entier de 0 à 48 (heures) | fermeture : fin de l'événement + N heures |
| `access.counter_sale_enabled` | true | booléen | vente au guichet en espèces |

### Variables d'environnement (`lib/env.ts`)

Secrets obligatoires, sans valeur par défaut. Le serveur refuse de démarrer s'ils manquent ou s'ils sont réutilisés :

| Variable | Défaut | Valeurs admises |
|---|---|---|
| `TICKET_TOTP_MASTER_KEY` | aucun (obligatoire) | chaîne de 32 caractères au moins, différente de `OTP_HASH_SECRET`, `REGISSEUR_PIN_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_AUTH_HOOK_SECRET`, `CRON_SECRET`, `SAMIRPAY_SECRET_KEY` et `SAMIRPAY_API_KEY` |
| `REGISSEUR_PIN_KEY` | aucun (obligatoire) | mêmes règles |

Seuils des quotas : entiers strictement positifs, avec une valeur par défaut dans `lib/env.ts`, comme au lot 1C. Un dépassement donne 429 avec `Retry-After`. Si le compteur est indisponible, la réponse est 503 (refus fermé).

| Variable | Défaut | Portée |
|---|---|---|
| `SCAN_PER_SCANNER_10S` | 30 | scans par scanneur (contrôleur, partenaire, admin) sur 10 s |
| `CASH_COLLECT_PER_SCANNER_MIN` | 20 | encaissements espèces par scanneur et par minute |
| `LIVE_CODE_PER_USER_MIN` | 60 | codes dynamiques demandés par compte et par minute |
| `RESOLVE_PHONE_PER_IP_HOUR` | 30 | résolutions numéro → compte, par IP et par heure |
| `VERIFY_OTP_PER_PHONE_15MIN` | 10 | vérifications de code OTP, par numéro, sur 15 min |
| `CONTROLLER_SETUP_PER_PHONE_HOUR` | 10 | activations de compte contrôleur, par numéro et par heure |
| `PARTNER_REGISTER_PER_IP_HOUR` | 10 | inscriptions partenaire, par IP et par heure |
| `INVITE_PER_PARTNER_HOUR` | 20 | invitations de contrôleurs, par partenaire et par heure |
| `INVITE_PER_PHONE_DAY` | 3 | invitations reçues par un numéro et par jour, tous partenaires confondus |
| `REGISSEUR_PIN_PER_SHIFT_15MIN` | 5 | vérifications du PIN régisseur, sur 15 min |
| `SMS_PER_ACCOUNT_DAY` | 30 | SMS non OTP déclenchés par un compte connecté et par jour (invitations, équipe, transferts, billets gratuits) |
| `SMS_GLOBAL_OTP_RESERVED_PERCENT` | 30 | entier de 0 à 100 : part du plafond quotidien `SMS_GLOBAL_DAILY_CAP` réservée à l'OTP |

---

## 4. Requêtes des invariants et leur sortie

Chaque suite du lot vérifie trois invariants à sa fin, sur la base locale et en lecture seule : celui du lot 2 (a)(b)(c), puis celui du lot 3 (d)(e)(f), puis celui du lot 4 (`tests/helpers/access-invariants.ts`) :
- **(g)** tout billet UTILISE a exactement une ligne `ticket_scans` acceptée. Elle a été faite par un scanneur autorisé pour l'événement au moment du scan : contrôleur affecté, partenaire propriétaire ou admin, rôle recopié sur la ligne. Aucun scan accepté ne porte sur un billet qui n'est pas UTILISE ;
- **(h)** pour chaque caisse, le total attendu est égal à la somme des paiements hors plateforme qui lui sont rattachés (encaissements au scan et ventes au guichet) ;
- **(i)** aucun paiement hors plateforme n'a de frais de service, de frais d'agrégateur, de revenu Event Village ni de reversement, ni d'écriture au grand livre.

Requêtes, telles que définies dans les helpers :

```sql
-- (a)(b)(c) : tests/helpers/payment-invariants.ts (INVARIANT_SQL, $1 = vérification après purge)
WITH reserved AS (
    SELECT payment_id, sum(quantity)::int AS qty FROM public.stock_reservations GROUP BY payment_id
), issued AS (
    SELECT payment_id, count(*)::int AS n FROM public.tickets WHERE payment_id IS NOT NULL GROUP BY payment_id
), active AS (
    SELECT category_id,
           sum(quantity) FILTER (WHERE status = 'ACTIVE')::int AS q_active,
           sum(quantity) FILTER (WHERE status = 'ACTIVE' AND expires_at > now())::int AS q_live
      FROM public.stock_reservations GROUP BY category_id
)
SELECT 'a' AS regle, p.id::text AS objet,
       format('paiement %s : %s billet(s) émis pour %s réservé(s)', p.status, coalesce(i.n, 0), coalesce(r.qty, 0)) AS detail
  FROM public.payments p
  LEFT JOIN reserved r ON r.payment_id = p.id
  LEFT JOIN issued i ON i.payment_id = p.id
 WHERE p.status IN ('SUCCESS', 'PARTIAL') AND p.payment_target = 'TICKET' AND p.is_platform_payment
   AND (coalesce(i.n, 0) = 0 OR coalesce(i.n, 0) <> coalesce(r.qty, 0))
UNION ALL
SELECT 'b', t.id::text, format('billet %s à %s F sans paiement SUCCESS ni PARTIAL (%s)', t.status, t.price, coalesce(p.status::text, 'aucun paiement'))
  FROM public.tickets t
  LEFT JOIN public.payments p ON p.id = t.payment_id
 WHERE t.price > 0 AND t.status IN ('VALIDE', 'UTILISE')
   AND (p.id IS NULL OR p.status NOT IN ('SUCCESS', 'PARTIAL'))
   -- Lot 4 : billet « à régler sur place » (commande impayée, encaissement au contrôle) : état légitime
   AND NOT (t.payment_id IS NULL AND t.status = 'VALIDE' AND EXISTS (
           SELECT 1 FROM public.orders o WHERE o.id = t.order_id AND o.payment_status <> 'SUCCESS'))
UNION ALL
SELECT 'c', c.id::text, format('sold %s + held %s > total %s', c.sold_quantity, c.held_quantity, c.total_quantity)
  FROM public.ticket_categories c
 WHERE c.sold_quantity + c.held_quantity > c.total_quantity
UNION ALL
SELECT 'c', c.id::text, format('held %s ≠ réservations %s : %s', c.held_quantity,
       CASE WHEN $1::boolean THEN 'ACTIVE non échues' ELSE 'ACTIVE' END,
       CASE WHEN $1::boolean THEN coalesce(a.q_live, 0) ELSE coalesce(a.q_active, 0) END)
  FROM public.ticket_categories c
  LEFT JOIN active a ON a.category_id = c.id
 WHERE c.held_quantity <> CASE WHEN $1::boolean THEN coalesce(a.q_live, 0) ELSE coalesce(a.q_active, 0) END
ORDER BY 1, 2

-- (d)(e)(f) : tests/helpers/finance-invariants.ts (FINANCE_INVARIANT_SQL)
WITH refund_sums AS (
    SELECT payment_id,
           sum(net_revenue_reversal) AS reversal,
           sum(amount) FILTER (WHERE status = 'PROCESSED' AND settlement = 'PLATEFORME') AS refunded
      FROM public.refunds WHERE payment_id IS NOT NULL GROUP BY payment_id
), confirmed AS (
    SELECT p.* FROM public.payments p
     WHERE p.is_platform_payment AND p.status IN ('SUCCESS', 'PARTIAL', 'REFUNDED')
), credited AS (
    -- paiements passés par SUCCESS (un panier non honorable va de PENDING à REFUND_PENDING puis REFUNDED, sans billet)
    SELECT p.* FROM confirmed p
     WHERE p.status IN ('SUCCESS', 'PARTIAL')
        OR (p.status = 'REFUNDED' AND (p.payment_target <> 'TICKET' OR EXISTS (SELECT 1 FROM public.tickets t WHERE t.payment_id = p.id)))
), accounts AS (
    SELECT owner_id, account_kind, sum(amount) AS total,
           coalesce(sum(amount) FILTER (WHERE available_at <= now()), 0) AS available
      FROM public.finance_ledger GROUP BY owner_id, account_kind
), sales AS (
    SELECT payment_id, count(*) AS n, sum(amount) AS amount FROM public.finance_ledger
     WHERE entry_type = 'VENTE' GROUP BY payment_id
), regul AS (
    SELECT regularizes_id, sum(amount) AS amount FROM public.referral_commissions
     WHERE kind = 'REGULARISATION' GROUP BY regularizes_id
)
SELECT 'd' AS regle, p.id::text AS objet, format('%s : montants financiers absents (facial %s)', p.payment_target, p.facial_amount) AS detail
  FROM confirmed p WHERE p.facial_amount IS NULL
UNION ALL
SELECT 'd', p.id::text, format('total %s ≠ facial %s + service %s', p.amount, p.facial_amount, p.service_fee)
  FROM confirmed p WHERE p.facial_amount IS NOT NULL AND p.amount <> p.facial_amount + p.service_fee
UNION ALL
SELECT 'd', p.id::text, format('reversement %s ≠ facial %s', p.partner_payout_amount, p.facial_amount)
  FROM confirmed p WHERE p.facial_amount IS NOT NULL AND p.payment_target <> 'SUBSCRIPTION' AND p.partner_payout_amount <> p.facial_amount
UNION ALL
SELECT 'd', p.id::text, format('net EV %s ≠ %s − agrégateur %s', p.net_event_village_revenue,
       CASE WHEN p.payment_target = 'SUBSCRIPTION' THEN p.facial_amount ELSE p.service_fee END, p.aggregator_fee)
  FROM confirmed p WHERE p.facial_amount IS NOT NULL
   AND p.net_event_village_revenue <> round((CASE WHEN p.payment_target = 'SUBSCRIPTION' THEN p.facial_amount ELSE p.service_fee END) - p.aggregator_fee, 2)
UNION ALL
SELECT 'd', p.id::text, format('part remboursée du net %s ≠ Σ des remboursements %s', p.refunded_net_revenue, coalesce(r.reversal, 0))
  FROM confirmed p LEFT JOIN refund_sums r ON r.payment_id = p.id
 WHERE p.facial_amount IS NOT NULL AND p.refunded_net_revenue <> coalesce(r.reversal, 0)
UNION ALL
SELECT 'd', p.id::text, format('montant remboursé %s ≠ Σ des remboursements versés %s', p.refunded_amount, coalesce(r.refunded, 0))
  FROM confirmed p LEFT JOIN refund_sums r ON r.payment_id = p.id
 WHERE p.facial_amount IS NOT NULL AND p.refunded_amount <> coalesce(r.refunded, 0)
UNION ALL
SELECT 'd', p.id::text, format('statut %s incohérent avec %s remboursé sur %s', p.status, p.refunded_amount, p.amount)
  FROM confirmed p
 WHERE p.facial_amount IS NOT NULL AND (
       (p.status = 'SUCCESS' AND p.refunded_amount > 0)
    OR (p.status = 'PARTIAL' AND NOT (p.refunded_amount > 0 AND p.refunded_amount < p.amount))
    OR (p.status = 'REFUNDED' AND p.refunded_amount < p.amount AND p.payment_target = 'TICKET' AND EXISTS (SELECT 1 FROM public.tickets t WHERE t.payment_id = p.id)))
UNION ALL
SELECT 'e', a.owner_id::text || '/' || a.account_kind, format('solde total %s, disponible %s', a.total, a.available)
  FROM accounts a WHERE a.total < 0 OR a.available < 0
UNION ALL
SELECT 'e', a.owner_id::text || '/' || a.account_kind,
       format('finance_account_balance %s ≠ grand livre (disponible %s, en attente %s)', b.v, a.available, a.total - a.available)
  FROM accounts a CROSS JOIN LATERAL (SELECT public.finance_account_balance(a.owner_id, a.account_kind) AS v) b
 WHERE (b.v->>'available')::numeric <> a.available OR (b.v->>'pending')::numeric <> a.total - a.available
UNION ALL
SELECT 'e', p.id::text, format('écritures VENTE : %s pour %s, reversement %s', coalesce(s.n, 0), coalesce(s.amount, 0), p.partner_payout_amount)
  FROM credited p LEFT JOIN sales s ON s.payment_id = p.id
 WHERE p.payment_target <> 'SUBSCRIPTION' AND p.partner_id IS NOT NULL AND p.partner_payout_amount > 0
   AND (coalesce(s.n, 0) <> 1 OR s.amount <> p.partner_payout_amount)
UNION ALL
SELECT 'e', s.payment_id::text, 'écriture VENTE sans paiement plateforme confirmé'
  FROM sales s WHERE NOT EXISTS (SELECT 1 FROM credited p WHERE p.id = s.payment_id)
UNION ALL
SELECT 'f', c.id::text, format('commission %s (%s) sur paiement REFUNDED : régularisations %s', c.amount, c.status, coalesce(g.amount, 0))
  FROM public.referral_commissions c
  JOIN public.payments p ON p.id = c.payment_id
  LEFT JOIN regul g ON g.regularizes_id = c.id
 WHERE p.status = 'REFUNDED' AND c.kind = 'COMMISSION' AND c.status <> 'CANCELLED'
   AND coalesce(g.amount, 0) <> -c.amount
ORDER BY 1, 2

-- (g)(h)(i) : tests/helpers/access-invariants.ts (ACCESS_INVARIANT_SQL)
WITH accepted AS (
    SELECT s.ticket_id, count(*) AS n,
           count(*) FILTER (WHERE s.scanner_role IN ('CONTROLEUR', 'PARTENAIRE', 'ADMIN') AND s.event_id = t.event_id) AS authorized
      FROM public.ticket_scans s
      JOIN public.tickets t ON t.id = s.ticket_id
     WHERE s.accepted
     GROUP BY s.ticket_id
), shift_cash AS (
    SELECT shift_id, sum(amount) AS amount FROM public.payments
     WHERE shift_id IS NOT NULL AND NOT is_platform_payment AND status = 'SUCCESS'
     GROUP BY shift_id
)
SELECT 'g' AS regle, t.id::text AS objet,
       format('billet UTILISE : %s scan(s) accepté(s), dont %s par un scanneur autorisé', coalesce(a.n, 0), coalesce(a.authorized, 0)) AS detail
  FROM public.tickets t
  LEFT JOIN accepted a ON a.ticket_id = t.id
 WHERE t.status = 'UTILISE' AND (coalesce(a.n, 0) <> 1 OR coalesce(a.authorized, 0) <> 1)
UNION ALL
SELECT 'g', a.ticket_id::text, format('scan accepté sur un billet %s', t.status)
  FROM accepted a JOIN public.tickets t ON t.id = a.ticket_id
 WHERE t.status <> 'UTILISE'
UNION ALL
SELECT 'h', c.id::text, format('caisse %s : total attendu %s, paiements rattachés %s', c.status, c.expected_cash_total, coalesce(sc.amount, 0))
  FROM public.controller_shifts c
  LEFT JOIN shift_cash sc ON sc.shift_id = c.id
 WHERE c.expected_cash_total <> coalesce(sc.amount, 0)
UNION ALL
SELECT 'i', p.id::text,
       format('hors plateforme : frais %s, agrégateur %s, brut %s, net %s, reversement %s', p.service_fee, p.aggregator_fee,
              p.gross_event_village_revenue, p.net_event_village_revenue, p.partner_payout_amount)
  FROM public.payments p
 WHERE NOT p.is_platform_payment
   AND (p.service_fee <> 0 OR p.aggregator_fee <> 0 OR p.gross_event_village_revenue <> 0
        OR p.net_event_village_revenue <> 0 OR p.partner_payout_amount <> 0)
UNION ALL
SELECT 'i', p.id::text, format('hors plateforme : %s écriture(s) au grand livre', count(l.id))
  FROM public.payments p JOIN public.finance_ledger l ON l.payment_id = p.id
 WHERE NOT p.is_platform_payment
 GROUP BY p.id
ORDER BY 1, 2
```

Sortie brute, run 41 (`41256842470`, commit `3143f36`), lignes `[INVARIANT]`, `[INVARIANT-FIN]` et `[INVARIANT-ACCES]` des 13 suites du lot :

```text
# tests__parcours__acces-caisse-pin.test.ts.log
[INVARIANT] acces-caisse-pin — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] acces-caisse-pin — purge des réservations échues : {"expired":0}
[INVARIANT] acces-caisse-pin — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] acces-caisse-pin — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] acces-caisse-pin — (g)(h)(i) : 0 violation(s)
# tests__parcours__acces-encaissement.test.ts.log
[INVARIANT] acces-encaissement — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] acces-encaissement — purge des réservations échues : {"expired":0}
[INVARIANT] acces-encaissement — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] acces-encaissement — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] acces-encaissement — (g)(h)(i) : 0 violation(s)
# tests__parcours__acces-fenetre.test.ts.log
[INVARIANT] acces-fenetre — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] acces-fenetre — purge des réservations échues : {"expired":0}
[INVARIANT] acces-fenetre — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] acces-fenetre — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] acces-fenetre — (g)(h)(i) : 0 violation(s)
# tests__parcours__acces-guichet.test.ts.log
[INVARIANT] acces-guichet — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] acces-guichet — purge des réservations échues : {"expired":0}
[INVARIANT] acces-guichet — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] acces-guichet — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] acces-guichet — (g)(h)(i) : 0 violation(s)
# tests__parcours__acces-invariant.test.ts.log
[INVARIANT] acces-invariant — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] acces-invariant — purge des réservations échues : {"expired":0}
[INVARIANT] acces-invariant — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] acces-invariant — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] acces-invariant — (g)(h)(i) : 0 violation(s)
# tests__parcours__acces-limiteurs.test.ts.log
[INVARIANT] acces-limiteurs — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] acces-limiteurs — purge des réservations échues : {"expired":0}
[INVARIANT] acces-limiteurs — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] acces-limiteurs — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] acces-limiteurs — (g)(h)(i) : 0 violation(s)
# tests__parcours__acces-pilotage.test.ts.log
[INVARIANT] acces-pilotage — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] acces-pilotage — purge des réservations échues : {"expired":0}
[INVARIANT] acces-pilotage — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] acces-pilotage — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] acces-pilotage — (g)(h)(i) : 0 violation(s)
# tests__parcours__acces-qr.test.ts.log
[INVARIANT] acces-qr — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] acces-qr — purge des réservations échues : {"expired":0}
[INVARIANT] acces-qr — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] acces-qr — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] acces-qr — (g)(h)(i) : 0 violation(s)
# tests__parcours__acces-reglages.test.ts.log
[INVARIANT] acces-reglages — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] acces-reglages — purge des réservations échues : {"expired":0}
[INVARIANT] acces-reglages — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] acces-reglages — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] acces-reglages — (g)(h)(i) : 0 violation(s)
# tests__parcours__acces-scan.test.ts.log
[INVARIANT] acces-scan — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] acces-scan — purge des réservations échues : {"expired":0}
[INVARIANT] acces-scan — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] acces-scan — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] acces-scan — (g)(h)(i) : 0 violation(s)
# tests__parcours__acces-securite-urgente.test.ts.log
[INVARIANT] acces-securite-urgente — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] acces-securite-urgente — purge des réservations échues : {"expired":0}
[INVARIANT] acces-securite-urgente — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] acces-securite-urgente — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] acces-securite-urgente — (g)(h)(i) : 0 violation(s)
# tests__parcours__acces-totp.test.ts.log
[INVARIANT] acces-totp — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] acces-totp — purge des réservations échues : {"expired":0}
[INVARIANT] acces-totp — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] acces-totp — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] acces-totp — (g)(h)(i) : 0 violation(s)
# tests__parcours__acces-tracabilite.test.ts.log
[INVARIANT] acces-tracabilite — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] acces-tracabilite — purge des réservations échues : {"expired":0}
[INVARIANT] acces-tracabilite — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] acces-tracabilite — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] acces-tracabilite — (g)(h)(i) : 0 violation(s)
```

---

## 5. Suites legacy touchées

Les suites `tests/legacy/` sont en quarantaine : `npm test` ne les exécute pas, mais elles sont typecheckées. Le lot 4 a supprimé ou changé des API qu'elles appelaient :
- `generateTotp`, `verifyTotp`, `deriveTicketTotpSecret`, `buildDynamicQrPayload` et `parseDynamicQrPayload` ;
- `RateLimiter` et `ShiftService.recordCashPayment` ;
- `/api/tickets/verify` et la RPC `atomic_ticket_checkin` ;
- l'ancien corps du scan, `{ qr_code }` et `PUT { ticket_id, order_id }`.

Avant la remise en état : 25 erreurs `tsc`, toutes dans `tests/legacy/`, réparties sur 9 suites. Après : aucune erreur (sortie de la CI en section 6).

Commits `d5d7946` (test 6 de `dynamic-qr-totp`) et `be07a4f` (remise en état), sortie brute :

```text
$ git show --format= --name-status d5d7946 -- tests/legacy
M	tests/legacy/dynamic-qr-totp.test.ts
$ git show --format= --shortstat d5d7946 -- tests/legacy
 1 file changed, 14 insertions(+), 10 deletions(-)
$ git show --format= --name-status be07a4f -- tests/legacy
M	tests/legacy/controller-14-points.test.ts
M	tests/legacy/controller-multi-role.test.ts
M	tests/legacy/controller-shifts-z.test.ts
M	tests/legacy/dynamic-qr-totp.test.ts
M	tests/legacy/scanner-security-hardening.test.ts
M	tests/legacy/security-fixes.test.ts
M	tests/legacy/ticket-pdf-and-exports.test.ts
D	tests/legacy/ticket-scanned-notifications.test.ts
M	tests/legacy/ticket-transfer-phase3-claim.test.ts
M	tests/legacy/ticket-transfers-phase1-schema.test.ts
$ git show --format= --shortstat be07a4f -- tests/legacy
 10 files changed, 73 insertions(+), 1332 deletions(-)
```

**Règle appliquée.** Un cas est supprimé s'il remplit l'une de ces conditions :
- il appelle un symbole, une route ou une RPC supprimés ;
- il envoie un corps de requête retiré, qui l'empêche d'atteindre son sujet (la route répond 400 sur le schéma avant toute décision).

Chaque cas supprimé est remplacé, à sa place, par `// [lot 4 — cas supprimé] <cas> : <raison> ; couvert par <suite active>`, ou « non couvert : … ». Les assertions des cas conservés ne sont pas modifiées. Un cas qui appelle une route existante, et dont seul le résultat a changé, est conservé et signalé plus bas.

**Suite réécrite à la demande du lot (commit `d5d7946`)** : `dynamic-qr-totp`, test 6. Il attendait qu'un numéro de billet seul (`TCK-…`) soit composté comme une « saisie manuelle », c'est-à-dire le contournement du QR dynamique. Il attend désormais `dynamic_qr_required`, aucune donnée de billet, et un billet resté VALIDE (`checked_in_at` nul). La saisie manuelle a son propre corps, couvert par `acces-qr`.

**Suite supprimée** :

| Suite | Justification | Remplacement |
|---|---|---|
| `ticket-scanned-notifications` (cas 2, 4 et 5 ; 1 et 3 supprimés au lot 1B) | 4 : `/api/tickets/verify`, route supprimée ; 2 : corps `{ qr_code: <numéro> }` et champ `scan_result`, tous deux retirés ; 5 : double scan du billet du cas 2, même contrat. Il ne reste aucun cas. | compostage et `already_used` : `acces-scan`. Notification `TICKET_SCANNED` : **non couverte** (point ouvert 10) |

**Cas supprimés** (le reste de la suite est conservé) :

| Suite | Cas supprimés | Raison | Couvert par |
|---|---|---|---|
| `controller-shifts-z` | 4, 6, 7, 9 | 4 : `PUT { ticket_id, order_id }` retiré ; 6 : `recordCashPayment` supprimé ; 7 : il clôturait la caisse du cas 6 ; 9 : `{ qr_code }` et `scan_result` | `acces-encaissement`, `acces-guichet`, `acces-scan`. Clôture avec écart et justification : **non couverte** (point ouvert 4) |
| `dynamic-qr-totp` | 1 à 5, 7 | anciennes fonctions TOTP, ancienne réponse de live-code, `/api/tickets/verify` | `acces-totp`, `acces-scan` |
| `scanner-security-hardening` | 1, 2, 3, 5 | `RateLimiter`, ancien code dynamique, champ `stats` retiré, tolérance de ±40 s devenue ±1 pas de 20 s | `acces-limiteurs`, `acces-totp`, `acces-scan`. Statistiques du scanneur : **non couvertes** |
| `security-fixes` | 1.1, 2.1, 2.2, 3.1 | 1.1 : IDOR impossible par construction, l'encaissement ne reçoit plus de commande ; 2.1 : `{ qr_code }` ; 2.2 et 3.1 : `RateLimiter` | `acces-encaissement`, `acces-scan`, `acces-limiteurs` |
| `ticket-pdf-and-exports` | TEST 12 | `generateTotp`, `verifyTotp`, `atomic_ticket_checkin` | `acces-totp`, `acces-scan` |
| `ticket-transfer-phase3-claim` | 7, 8, 9, 10, 17, 18 | anciennes fonctions TOTP ; 8 à 10 lisaient le billet du cas 7 ; 18 : `atomic_ticket_checkin` | `acces-totp`, `acces-qr` (identifiants régénérés), `acces-scan`. `security_version + 1` : **non couvert** |
| `ticket-transfers-phase1-schema` | TEST 11 | anciennes fonctions TOTP, `atomic_ticket_checkin` | `acces-totp`, `acces-scan` |
| `controller-14-points` | TEST 9, TEST 10 | `{ qr_code }`, `scan_result` ; 400 devenu 200 `event_ended`, `unauthorized` devenu 403 `SCAN_FORBIDDEN` | `acces-fenetre`, `acces-scan` |

**Préparation alignée** (aucun cas supprimé) :
- `controller-multi-role` et `security-fixes` : les remises à zéro `RateLimiter.resetAttempts` sont remplacées par un helper local, `resetQuota(scope, bucket)`, qui efface les lignes correspondantes de `quota_counters`. Correspondance :
  - `sms_invite_phone` → `invite_phone` ;
  - `sms_invite_partner` → `invite_partner` ;
  - `sms_daily_quota_partner` → `sms_account`.
- `controller-shifts-z` : les appels `ShiftService._clearMemory()` sont retirés (il n'y a plus de mémoire).
- `scanner-security-hardening` : les remises à zéro du `before()` et de l'`after()` sont retirées. Aucun cas conservé n'appelle plus le scan ni l'invitation.

**Assertions devenues fausses dans des cas conservés** (non modifiées, conformément à la règle) :
- `controller-shifts-z`, cas 1. `POST regisseur-pin` sans `{ confirm: true }` répond 400 `CONFIRMATION_REQUIRED`, alors que le cas attend 200. En conséquence :
  - cas 3 : 409 `PIN_NOT_SET` au lieu de 401 ;
  - cas 5 : aucune caisse ouverte.
- `controller-shifts-z`, cas 2 : 409 `EVENT_NOT_OPEN`, alors que le cas attend 400.
- `controller-shifts-z`, cas 8 : 409 `CONTROLLER_HAS_OPEN_SHIFT`, alors que le cas attend 400 `OPEN_SHIFT_EXISTS`. Son `after()` supprime `events` avant `controller_shifts`, ce que la RESTRICT refuse.
- `security-fixes`, TEST 3.2 : le message de refus vient désormais de `requireActiveSession`.

**Suites hors de la liste tsc, non modifiées, sur l'ancien contrat** (à supprimer ou réécrire à leur sortie de quarantaine) :
- `client-ticket-lifecycle` : tests 10, 11, 16 et 17 ;
- `controller-complete-workflow` : cas 3 et 4 ;
- `controller-event-status-hotfix` : TEST 8 et TEST 9 ;
- `controller-realtime-sync` : TEST C et TEST E.

---

## 6. Sortie brute de `npm run verify` et CI

Run de référence : **https://github.com/fallouu-mn/event-village/actions/runs/41256842470** (run 41, commit `3143f36`). Sortie complète : `docs/lot4-logs/ci-run41-verify.log`. Runs rouges de référence : `docs/lot4-logs/ci-run34-verify.log`, `ci-run36-verify.log` et `ci-run40-verify.log`.

```text

> event-village@1.0.0 verify
> node scripts/verify.mjs


═══════════════ verify › typecheck : npm run typecheck ═══════════════

> event-village@1.0.0 typecheck
> tsc --noEmit


═══════════════ verify › lint : npm run lint ═══════════════

> event-village@1.0.0 lint
> next lint

✔ No ESLint warnings or errors

═══════════════ verify › test : npm run test ═══════════════

> event-village@1.0.0 test
> node scripts/run-tests.mjs

[run-tests] 91 suite(s) — garde-fou : tests/helpers/env.ts — délai/suite : 600.0s
[… 6269 lignes de sortie des suites, intégralement dans docs/lot4-logs/ci-run41-verify.log …]
═══════════════════ RÉCAPITULATIF ═══════════════════
Suite                                                Statut   Durée     Code  Journal
tests/auth-rbac.test.ts                              PASS     290ms     0     .test-logs/tests__auth-rbac.test.ts.log
tests/e2e-scenarios.test.ts                          PASS     593ms     0     .test-logs/tests__e2e-scenarios.test.ts.log
tests/fondations-lot0.test.ts                        PASS     497ms     0     .test-logs/tests__fondations-lot0.test.ts.log
tests/notifications-and-documents.test.ts            PASS     236ms     0     .test-logs/tests__notifications-and-documents.test.ts.log
tests/parcours/acces-caisse-pin.test.ts              PASS     3.4s      0     .test-logs/tests__parcours__acces-caisse-pin.test.ts.log
tests/parcours/acces-encaissement.test.ts            PASS     3.0s      0     .test-logs/tests__parcours__acces-encaissement.test.ts.log
tests/parcours/acces-fenetre.test.ts                 PASS     1.9s      0     .test-logs/tests__parcours__acces-fenetre.test.ts.log
tests/parcours/acces-guichet.test.ts                 PASS     2.2s      0     .test-logs/tests__parcours__acces-guichet.test.ts.log
tests/parcours/acces-invariant.test.ts               PASS     539ms     0     .test-logs/tests__parcours__acces-invariant.test.ts.log
tests/parcours/acces-limiteurs.test.ts               PASS     3.7s      0     .test-logs/tests__parcours__acces-limiteurs.test.ts.log
tests/parcours/acces-pilotage.test.ts                PASS     18.2s     0     .test-logs/tests__parcours__acces-pilotage.test.ts.log
tests/parcours/acces-qr.test.ts                      PASS     2.0s      0     .test-logs/tests__parcours__acces-qr.test.ts.log
tests/parcours/acces-reglages.test.ts                PASS     1.5s      0     .test-logs/tests__parcours__acces-reglages.test.ts.log
tests/parcours/acces-scan.test.ts                    PASS     2.1s      0     .test-logs/tests__parcours__acces-scan.test.ts.log
tests/parcours/acces-securite-urgente.test.ts        PASS     2.2s      0     .test-logs/tests__parcours__acces-securite-urgente.test.ts.log
tests/parcours/acces-totp.test.ts                    PASS     2.0s      0     .test-logs/tests__parcours__acces-totp.test.ts.log
tests/parcours/acces-tracabilite.test.ts             PASS     3.0s      0     .test-logs/tests__parcours__acces-tracabilite.test.ts.log
tests/parcours/achat-serveur.test.ts                 PASS     685ms     0     .test-logs/tests__parcours__achat-serveur.test.ts.log
tests/parcours/anonymisation-debogage.test.ts        PASS     811ms     0     .test-logs/tests__parcours__anonymisation-debogage.test.ts.log
tests/parcours/attribution-roles.test.ts             PASS     1.3s      0     .test-logs/tests__parcours__attribution-roles.test.ts.log
tests/parcours/bootstrap-superadmin.test.ts          PASS     636ms     0     .test-logs/tests__parcours__bootstrap-superadmin.test.ts.log
tests/parcours/changement-role-admin.test.ts         PASS     1.0s      0     .test-logs/tests__parcours__changement-role-admin.test.ts.log
tests/parcours/documents-inscription.test.ts         PASS     2.0s      0     .test-logs/tests__parcours__documents-inscription.test.ts.log
tests/parcours/email-optionnel.test.ts               PASS     999ms     0     .test-logs/tests__parcours__email-optionnel.test.ts.log
tests/parcours/filtres-postgrest.test.ts             PASS     609ms     0     .test-logs/tests__parcours__filtres-postgrest.test.ts.log
tests/parcours/finance-affichage.test.ts             PASS     1.5s      0     .test-logs/tests__parcours__finance-affichage.test.ts.log
tests/parcours/finance-annulation.test.ts            PASS     2.5s      0     .test-logs/tests__parcours__finance-annulation.test.ts.log
tests/parcours/finance-cibles.test.ts                PASS     1.8s      0     .test-logs/tests__parcours__finance-cibles.test.ts.log
tests/parcours/finance-commissions.test.ts           PASS     5.2s      0     .test-logs/tests__parcours__finance-commissions.test.ts.log
tests/parcours/finance-hors-plateforme.test.ts       PASS     1.6s      0     .test-logs/tests__parcours__finance-hors-plateforme.test.ts.log
tests/parcours/finance-invariant.test.ts             PASS     551ms     0     .test-logs/tests__parcours__finance-invariant.test.ts.log
tests/parcours/finance-moteur.test.ts                PASS     1.6s      0     .test-logs/tests__parcours__finance-moteur.test.ts.log
tests/parcours/finance-rapports.test.ts              PASS     1.5s      0     .test-logs/tests__parcours__finance-rapports.test.ts.log
tests/parcours/finance-reglages.test.ts              PASS     1.5s      0     .test-logs/tests__parcours__finance-reglages.test.ts.log
tests/parcours/finance-remboursement-billet.test.ts  PASS     2.0s      0     .test-logs/tests__parcours__finance-remboursement-billet.test.ts.log
tests/parcours/finance-retraits.test.ts              PASS     6.9s      0     .test-logs/tests__parcours__finance-retraits.test.ts.log
tests/parcours/invitation-identite.test.ts           PASS     1.6s      0     .test-logs/tests__parcours__invitation-identite.test.ts.log
tests/parcours/otp-hachage.test.ts                   PASS     547ms     0     .test-logs/tests__parcours__otp-hachage.test.ts.log
tests/parcours/otp-objet.test.ts                     PASS     1.6s      0     .test-logs/tests__parcours__otp-objet.test.ts.log
tests/parcours/otp-serveur.test.ts                   PASS     907ms     0     .test-logs/tests__parcours__otp-serveur.test.ts.log
tests/parcours/paiement-confirmation.test.ts         PASS     1.8s      0     .test-logs/tests__parcours__paiement-confirmation.test.ts.log
tests/parcours/paiement-controles.test.ts            PASS     2.1s      0     .test-logs/tests__parcours__paiement-controles.test.ts.log
tests/parcours/paiement-gratuits.test.ts             PASS     1.5s      0     .test-logs/tests__parcours__paiement-gratuits.test.ts.log
tests/parcours/paiement-operateur.test.ts            PASS     977ms     0     .test-logs/tests__parcours__paiement-operateur.test.ts.log
tests/parcours/paiement-reconciliation.test.ts       PASS     1.6s      0     .test-logs/tests__parcours__paiement-reconciliation.test.ts.log
tests/parcours/paiement-remboursement.test.ts        PASS     2.1s      0     .test-logs/tests__parcours__paiement-remboursement.test.ts.log
tests/parcours/paiement-reservation.test.ts          PASS     2.1s      0     .test-logs/tests__parcours__paiement-reservation.test.ts.log
tests/parcours/paiement-retour.test.ts               PASS     742ms     0     .test-logs/tests__parcours__paiement-retour.test.ts.log
tests/parcours/paiement-statut.test.ts               PASS     1.4s      0     .test-logs/tests__parcours__paiement-statut.test.ts.log
tests/parcours/paiement-webhook.test.ts              PASS     2.4s      0     .test-logs/tests__parcours__paiement-webhook.test.ts.log
tests/parcours/pin-regisseur.test.ts                 PASS     534ms     0     .test-logs/tests__parcours__pin-regisseur.test.ts.log
tests/parcours/realtime-scanner.test.ts              PASS     13.3s     0     .test-logs/tests__parcours__realtime-scanner.test.ts.log
tests/parcours/revocation-sessions.test.ts           PASS     1.9s      0     .test-logs/tests__parcours__revocation-sessions.test.ts.log
tests/parcours/roles-fraicheur.test.ts               PASS     1.0s      0     .test-logs/tests__parcours__roles-fraicheur.test.ts.log
tests/parcours/roles-metadonnees.test.ts             PASS     711ms     0     .test-logs/tests__parcours__roles-metadonnees.test.ts.log
tests/parcours/sms-anti-abus.test.ts                 PASS     681ms     0     .test-logs/tests__parcours__sms-anti-abus.test.ts.log
tests/parcours/statut-compte.test.ts                 PASS     2.5s      0     .test-logs/tests__parcours__statut-compte.test.ts.log
tests/partner-auth-complete.test.ts                  PASS     508ms     0     .test-logs/tests__partner-auth-complete.test.ts.log
tests/partner-halls-m7.test.ts                       PASS     1.3s      0     .test-logs/tests__partner-halls-m7.test.ts.log
tests/partner-orders-m9.test.ts                      PASS     1.5s      0     .test-logs/tests__partner-orders-m9.test.ts.log
tests/payment.test.ts                                PASS     260ms     0     .test-logs/tests__payment.test.ts.log
tests/roles-isolation.test.ts                        PASS     254ms     0     .test-logs/tests__roles-isolation.test.ts.log
tests/samirpay-contrat.test.ts                       PASS     3.7s      0     .test-logs/tests__samirpay-contrat.test.ts.log
tests/scanner-combat-ui.test.ts                      PASS     443ms     0     .test-logs/tests__scanner-combat-ui.test.ts.log
tests/scanner-wolof-audio.test.ts                    PASS     452ms     0     .test-logs/tests__scanner-wolof-audio.test.ts.log
tests/schema/fonctions-privileges.test.ts            PASS     354ms     0     .test-logs/tests__schema__fonctions-privileges.test.ts.log
tests/schema/hotfix-identique.test.ts                PASS     253ms     0     .test-logs/tests__schema__hotfix-identique.test.ts.log
tests/schema/hotfix-scripts.test.ts                  PASS     494ms     0     .test-logs/tests__schema__hotfix-scripts.test.ts.log
tests/schema/reset-test-password.test.ts             PASS     306ms     0     .test-logs/tests__schema__reset-test-password.test.ts.log
tests/schema/rls-toutes-tables.test.ts               PASS     286ms     0     .test-logs/tests__schema__rls-toutes-tables.test.ts.log
tests/schema/secrets-codes-en-dur.test.ts            PASS     317ms     0     .test-logs/tests__schema__secrets-codes-en-dur.test.ts.log
tests/security/anon-uniquement.test.ts               PASS     247ms     0     .test-logs/tests__security__anon-uniquement.test.ts.log
tests/security/r1-inscription-roles.test.ts          PASS     1.4s      0     .test-logs/tests__security__r1-inscription-roles.test.ts.log
tests/security/r10-user-roles.test.ts                PASS     798ms     0     .test-logs/tests__security__r10-user-roles.test.ts.log
tests/security/r11-storage-documents.test.ts         PASS     783ms     0     .test-logs/tests__security__r11-storage-documents.test.ts.log
tests/security/r12-reglages-finance.test.ts          PASS     604ms     0     .test-logs/tests__security__r12-reglages-finance.test.ts.log
tests/security/r13-parrainage-relations.test.ts      PASS     838ms     0     .test-logs/tests__security__r13-parrainage-relations.test.ts.log
tests/security/r14-retraits-insertion.test.ts        PASS     672ms     0     .test-logs/tests__security__r14-retraits-insertion.test.ts.log
tests/security/r15-statut-ambassadeur.test.ts        PASS     677ms     0     .test-logs/tests__security__r15-statut-ambassadeur.test.ts.log
tests/security/r16-reglages-acces.test.ts            PASS     526ms     0     .test-logs/tests__security__r16-reglages-acces.test.ts.log
tests/security/r2-otp-codes.test.ts                  PASS     485ms     0     .test-logs/tests__security__r2-otp-codes.test.ts.log
tests/security/r3-fonctions-rpc.test.ts              PASS     724ms     0     .test-logs/tests__security__r3-fonctions-rpc.test.ts.log
tests/security/r4-ecritures-directes.test.ts         PASS     577ms     0     .test-logs/tests__security__r4-ecritures-directes.test.ts.log
tests/security/r5-lectures-anon.test.ts              PASS     583ms     0     .test-logs/tests__security__r5-lectures-anon.test.ts.log
tests/security/r6-roles-jeton.test.ts                PASS     755ms     0     .test-logs/tests__security__r6-roles-jeton.test.ts.log
tests/security/r7-profil-colonnes.test.ts            PASS     957ms     0     .test-logs/tests__security__r7-profil-colonnes.test.ts.log
tests/security/r8-controleur-lectures.test.ts        PASS     661ms     0     .test-logs/tests__security__r8-controleur-lectures.test.ts.log
tests/security/r9-partenaire-ecritures.test.ts       PASS     585ms     0     .test-logs/tests__security__r9-partenaire-ecritures.test.ts.log
tests/sms-formatage.test.ts                          PASS     366ms     0     .test-logs/tests__sms-formatage.test.ts.log
tests/superadmin-complete.test.ts                    PASS     409ms     0     .test-logs/tests__superadmin-complete.test.ts.log
tests/ux-performance-and-double-click.test.ts        PASS     792ms     0     .test-logs/tests__ux-performance-and-double-click.test.ts.log
──────────────────────────────────────────────────────
TOTAL : 91 suite(s) — 91 réussie(s), 0 en échec, 0 expirée(s)

═══════════════ verify › build : npm run build ═══════════════

> event-village@1.0.0 build
> next build

  ▲ Next.js 14.2.35
  - Experiments (use with caution):
    · instrumentationHook

   Creating an optimized production build ...
<w> [webpack.cache.PackFileCacheStrategy] Serializing big strings (108kiB) impacts deserialization performance (consider using Buffer instead and decode when needed)
<w> [webpack.cache.PackFileCacheStrategy] Serializing big strings (259kiB) impacts deserialization performance (consider using Buffer instead and decode when needed)
 ✓ Compiled successfully
   Linting and checking validity of types ...
   Collecting page data ...
   Generating static pages (0/53) ...
[getServerSessionUser] Erreur session: B [Error]: Dynamic server usage: Route /api/partner/orders couldn't be rendered statically because it used `request.headers`. See more info here: https://nextjs.org/docs/messages/dynamic-server-error
    at V (/home/runner/work/event-village/event-village/node_modules/next/dist/compiled/next-server/app-route.runtime.prod.js:6:21778)
    at Object.get (/home/runner/work/event-village/event-village/node_modules/next/dist/compiled/next-server/app-route.runtime.prod.js:6:29465)
    at o (/home/runner/work/event-village/event-village/.next/server/chunks/8272.js:1:12180)
    at d (/home/runner/work/event-village/event-village/.next/server/chunks/3138.js:1:920)
    at l (/home/runner/work/event-village/event-village/.next/server/chunks/3138.js:1:445)
    at c (/home/runner/work/event-village/event-village/.next/server/app/api/partner/orders/route.js:1:568)
    at /home/runner/work/event-village/event-village/node_modules/next/dist/compiled/next-server/app-route.runtime.prod.js:6:38417
    at /home/runner/work/event-village/event-village/node_modules/next/dist/server/lib/trace/tracer.js:140:36
    at NoopContextManager.with (/home/runner/work/event-village/event-village/node_modules/next/dist/compiled/@opentelemetry/api/index.js:1:7062)
    at ContextAPI.with (/home/runner/work/event-village/event-village/node_modules/next/dist/compiled/@opentelemetry/api/index.js:1:518) {
  description: "Route /api/partner/orders couldn't be rendered statically because it used `request.headers`. See more info here: https://nextjs.org/docs/messages/dynamic-server-error",
  digest: 'DYNAMIC_SERVER_USAGE'
}
   Generating static pages (13/53) 
   Generating static pages (26/53) 
   Generating static pages (39/53) 
 ✓ Generating static pages (53/53)
   Finalizing page optimization ...
   Collecting build traces ...

Route (app)                                             Size     First Load JS
┌ ○ /                                                   6.45 kB         119 kB
├ ○ /_not-found                                         177 B          87.8 kB
├ ○ /admin                                              177 B          87.8 kB
├ ○ /admin/audit                                        4.53 kB         108 kB
├ ○ /admin/communications                               5.56 kB         109 kB
├ ○ /admin/dashboard                                    13.1 kB         117 kB
├ ○ /admin/finance                                      7.23 kB         192 kB
├ ○ /admin/finance-settings                             7.07 kB         192 kB
├ ○ /admin/pricing                                      5.2 kB          109 kB
├ ○ /admin/referral                                     6.81 kB         110 kB
├ ○ /admin/services                                     5.96 kB         110 kB
├ ○ /admin/users                                        25.5 kB         142 kB
├ ƒ /api/admin/audit                                    0 B                0 B
├ ƒ /api/admin/communications                           0 B                0 B
├ ƒ /api/admin/events/[id]/cancel                       0 B                0 B
├ ƒ /api/admin/finance-settings                         0 B                0 B
├ ƒ /api/admin/finance/reconciliation                   0 B                0 B
├ ƒ /api/admin/metrics                                  0 B                0 B
├ ƒ /api/admin/partners                                 0 B                0 B
├ ƒ /api/admin/partners/[id]/status                     0 B                0 B
├ ƒ /api/admin/permissions                              0 B                0 B
├ ƒ /api/admin/pricing                                  0 B                0 B
├ ƒ /api/admin/promotions                               0 B                0 B
├ ƒ /api/admin/refunds/[id]/retry                       0 B                0 B
├ ƒ /api/admin/services                                 0 B                0 B
├ ƒ /api/admin/shifts/audit                             0 B                0 B
├ ƒ /api/admin/users                                    0 B                0 B
├ ƒ /api/admin/users/[id]/anonymize                     0 B                0 B
├ ƒ /api/auth/me                                        0 B                0 B
├ ƒ /api/auth/register                                  0 B                0 B
├ ƒ /api/auth/resolve-phone                             0 B                0 B
├ ƒ /api/auth/send-otp                                  0 B                0 B
├ ƒ /api/auth/sign-out-global                           0 B                0 B
├ ƒ /api/auth/sms-hook                                  0 B                0 B
├ ƒ /api/auth/verify-otp                                0 B                0 B
├ ƒ /api/checkout                                       0 B                0 B
├ ƒ /api/checkout/quote                                 0 B                0 B
├ ƒ /api/controller/assignments                         0 B                0 B
├ ƒ /api/controller/counter-sale                        0 B                0 B
├ ƒ /api/controller/profile                             0 B                0 B
├ ƒ /api/controller/scan                                0 B                0 B
├ ƒ /api/controller/setup                               0 B                0 B
├ ƒ /api/controller/shifts/[id]/summary                 0 B                0 B
├ ƒ /api/controller/shifts/active                       0 B                0 B
├ ƒ /api/controller/shifts/close                        0 B                0 B
├ ƒ /api/controller/shifts/open                         0 B                0 B
├ ƒ /api/cron/moratoriums                               0 B                0 B
├ ƒ /api/cron/payments-reconcile                        0 B                0 B
├ ƒ /api/cron/referral-commissions                      0 B                0 B
├ ƒ /api/cron/stock-reservations                        0 B                0 B
├ ƒ /api/cron/ticket-transfers                          0 B                0 B
├ ƒ /api/events                                         0 B                0 B
├ ƒ /api/events/[id]                                    0 B                0 B
├ ƒ /api/finance/balance                                0 B                0 B
├ ƒ /api/halls                                          0 B                0 B
├ ƒ /api/halls/[id]                                     0 B                0 B
├ ƒ /api/halls/reserve                                  0 B                0 B
├ ƒ /api/notifications                                  0 B                0 B
├ ƒ /api/notifications/[id]/read                        0 B                0 B
├ ƒ /api/orders                                         0 B                0 B
├ ƒ /api/orders/create                                  0 B                0 B
├ ƒ /api/partner/activation                             0 B                0 B
├ ƒ /api/partner/dashboard                              0 B                0 B
├ ƒ /api/partner/documents/signed-url                   0 B                0 B
├ ƒ /api/partner/documents/upload                       0 B                0 B
├ ƒ /api/partner/events                                 0 B                0 B
├ ƒ /api/partner/events/[id]                            0 B                0 B
├ ƒ /api/partner/events/[id]/cancel                     0 B                0 B
├ ƒ /api/partner/events/[id]/cancellation               0 B                0 B
├ ƒ /api/partner/events/[id]/categories                 0 B                0 B
├ ƒ /api/partner/events/[id]/categories/[categoryId]    0 B                0 B
├ ƒ /api/partner/events/[id]/promotion                  0 B                0 B
├ ƒ /api/partner/events/[id]/regisseur-pin              0 B                0 B
├ ƒ /api/partner/events/[id]/shifts                     0 B                0 B
├ ƒ /api/partner/events/[id]/status                     0 B                0 B
├ ƒ /api/partner/events/[id]/tickets/[ticketId]/refund  0 B                0 B
├ ƒ /api/partner/finance                                0 B                0 B
├ ƒ /api/partner/halls                                  0 B                0 B
├ ƒ /api/partner/halls/[id]                             0 B                0 B
├ ƒ /api/partner/halls/reservations/[id]/status         0 B                0 B
├ ƒ /api/partner/metrics                                0 B                0 B
├ ƒ /api/partner/orders                                 0 B                0 B
├ ƒ /api/partner/orders/[id]                            0 B                0 B
├ ƒ /api/partner/products                               0 B                0 B
├ ƒ /api/partner/products/[id]                          0 B                0 B
├ ƒ /api/partner/products/[id]/status                   0 B                0 B
├ ƒ /api/partner/profile                                0 B                0 B
├ ƒ /api/partner/register                               0 B                0 B
├ ƒ /api/partner/reports/accounting                     0 B                0 B
├ ƒ /api/partner/reports/closing                        0 B                0 B
├ ƒ /api/partner/reports/closing/pdf                    0 B                0 B
├ ƒ /api/partner/stats                                  0 B                0 B
├ ƒ /api/partner/subscription                           0 B                0 B
├ ƒ /api/partner/tables                                 0 B                0 B
├ ƒ /api/partner/tables/[id]                            0 B                0 B
├ ƒ /api/partner/tables/reservations                    0 B                0 B
├ ƒ /api/partner/tables/reservations/[id]               0 B                0 B
├ ƒ /api/partner/team/[eventId]                         0 B                0 B
├ ƒ /api/partner/team/all                               0 B                0 B
├ ƒ /api/partner/team/assignments                       0 B                0 B
├ ƒ /api/partner/team/controller/[controllerId]         0 B                0 B
├ ƒ /api/partner/team/entry-point                       0 B                0 B
├ ƒ /api/partner/team/invite                            0 B                0 B
├ ƒ /api/partner/upload                                 0 B                0 B
├ ƒ /api/payments/[transactionId]/cancel                0 B                0 B
├ ƒ /api/payments/[transactionId]/status                0 B                0 B
├ ƒ /api/payments/create                                0 B                0 B
├ ƒ /api/referrals/my-stats                             0 B                0 B
├ ƒ /api/restaurants/[id]/menu                          0 B                0 B
├ ƒ /api/restaurants/[id]/tables                        0 B                0 B
├ ƒ /api/restaurants/reserve-table                      0 B                0 B
├ ƒ /api/tickets                                        0 B                0 B
├ ƒ /api/tickets/[id]/live-code                         0 B                0 B
├ ƒ /api/tickets/[id]/pdf                               0 B                0 B
├ ƒ /api/tickets/[id]/transfer                          0 B                0 B
├ ƒ /api/tickets/claim-free                             0 B                0 B
├ ƒ /api/tickets/claim/[token]                          0 B                0 B
├ ƒ /api/tickets/transfers/[id]/cancel                  0 B                0 B
├ ƒ /api/webhooks/samirpay                              0 B                0 B
├ ƒ /api/withdrawals/otp                                0 B                0 B
├ ƒ /api/withdrawals/request                            0 B                0 B
├ ○ /controller/profile                                 5.94 kB         110 kB
├ ○ /controller/scanner                                 13.2 kB         199 kB
├ ○ /controller/setup                                   4.59 kB         168 kB
├ ƒ /events/[id]                                        10.7 kB         201 kB
├ ○ /explore                                            3.94 kB         116 kB
├ ○ /forgot-password                                    8.87 kB         194 kB
├ ○ /halls                                              5.26 kB         114 kB
├ ƒ /halls/[id]                                         5.83 kB         196 kB
├ ○ /login                                              10.4 kB         196 kB
├ ○ /notifications                                      5.93 kB         178 kB
├ ○ /orders                                             6.04 kB         178 kB
├ ƒ /paiement/[id]                                      8.89 kB         238 kB
├ ○ /partner                                            177 B          87.8 kB
├ ○ /partner/calendar                                   4.53 kB         108 kB
├ ○ /partner/dashboard                                  13.6 kB         186 kB
├ ○ /partner/events                                     12.3 kB         121 kB
├ ƒ /partner/events/[id]/caisse                         8.07 kB         117 kB
├ ƒ /partner/events/[id]/edit                           6.66 kB         128 kB
├ ƒ /partner/events/[id]/team                           5.03 kB         182 kB
├ ○ /partner/events/new                                 9.57 kB         131 kB
├ ○ /partner/finance                                    9.89 kB         194 kB
├ ○ /partner/halls                                      9.51 kB         118 kB
├ ƒ /partner/halls/[id]/edit                            4.74 kB         126 kB
├ ○ /partner/halls/new                                  4.23 kB         126 kB
├ ○ /partner/orders                                     11.7 kB         184 kB
├ ○ /partner/products                                   8.78 kB         118 kB
├ ○ /partner/products/new                               3.89 kB         125 kB
├ ○ /partner/profile                                    4.34 kB        99.2 kB
├ ○ /partner/register                                   9.53 kB         126 kB
├ ○ /partner/scan                                       5.29 kB         117 kB
├ ○ /partner/stats                                      5.49 kB         100 kB
├ ○ /partner/subscription                               5.8 kB          109 kB
├ ○ /partner/tables                                     11.2 kB         119 kB
├ ○ /partner/team                                       9.35 kB         187 kB
├ ○ /profile                                            6.95 kB         179 kB
├ ○ /register                                           9.09 kB         194 kB
├ ○ /reset-password                                     7.65 kB         180 kB
├ ƒ /restaurants/[id]/menu                              4.95 kB         195 kB
├ ƒ /restaurants/[id]/tables                            5.32 kB         195 kB
├ ○ /scan                                               177 B          87.8 kB
├ ○ /tickets                                            10.9 kB         240 kB
├ ƒ /tickets/claim/[token]                              4.58 kB         227 kB
└ ○ /wallet                                             11.3 kB         196 kB
+ First Load JS shared by all                           87.6 kB
  ├ chunks/2117-488d789e9004e22c.js                     31.9 kB
  ├ chunks/fd9d1056-270721ac51469ce4.js                 53.6 kB
  └ other shared chunks (total)                         2.1 kB


ƒ Middleware                                            87.6 kB

○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand


[verify] OK — 4 étapes réussies en 231s.
```

| Run | Commit | Résultat | Rôle |
|---|---|---|---|
| [33 · 41245588430](https://github.com/fallouu-mn/event-village/actions/runs/41245588430) | 7e75925 | succès | rapport du lot 3, point de départ du lot 4 : 77 suites vertes sur 77 |
| [34 · 41251376110](https://github.com/fallouu-mn/event-village/actions/runs/41251376110) | fbcd9b2 | échec attendu | **référence « avant »** des tâches 4.0 à 4.10 : tests dans leur version finale, sans aucun correctif. 12 suites en échec sur 89, exactement les 12 nouvelles suites (11 `acces-*` et `r15`). Les 77 autres sont vertes |
| [35 · 41253534545](https://github.com/fallouu-mn/event-village/actions/runs/41253534545) | 9e2a324 | échec (incident) | typecheck en échec : trois suppressions embarquées par erreur dans le commit du test du complément (« À lire en premier », point 11) |
| [36 · 41253809236](https://github.com/fallouu-mn/event-village/actions/runs/41253809236) | e4fb3aa | échec attendu | **référence « avant » du complément** : fichiers restaurés, test du complément ajouté. 14 suites en échec sur 90 : les 12 du run 34, `acces-pilotage` et `finance-retraits` (défaut de concurrence du lot 3 révélé) |
| [37 · 41254268822](https://github.com/fallouu-mn/event-village/actions/runs/41254268822) | 00a193c | échec | correctifs 4.0 à 4.10, complément, legacy et correctif du lot 3 : 86 suites vertes sur 89. Restaient `acces-guichet` (commentaire citant l'ancienne route), `acces-qr` (`identityVerified: "true"` → 400) et `r8-controleur-lectures` (affectation laissée par `statut-compte`), corrigés par `4ce90c5`, `93d6bdb` et `bf93a56` |
| [38 · 41254769074](https://github.com/fallouu-mn/event-village/actions/runs/41254769074) | e2bee8e | succès | 89 suites vertes sur 89, migrations `…09` à `…14` appliquées. L'écart sur les réglages `access.*` a été relevé ensuite, pendant la rédaction de ce rapport |
| [39 · 41255836941](https://github.com/fallouu-mn/event-village/actions/runs/41255836941) | d1cd169 | échec attendu | première version du test des réglages `access.*` : seule `acces-reglages` en échec sur 91 |
| [40 · 41256384288](https://github.com/fallouu-mn/event-village/actions/runs/41256384288) | 75ec7b1 | échec attendu | **référence « avant » des réglages `access.*`** (cas `/api/admin/pricing` ajouté) : seule `acces-reglages` en échec sur 91, R16 vert (garde-fou) |
| [41 · 41256842470](https://github.com/fallouu-mn/event-village/actions/runs/41256842470) | 3143f36 | succès | **référence « après »** : correctifs 4.0 à 4.10, complément, correctif du lot 3, réglages `access.*` et suites legacy ; migrations `20261101000009` à `…14` appliquées sans erreur. 91 suites vertes sur 91, 620 sous-tests, aucun échec ni test ignoré |

---

## 7. Points ouverts

1. **Transferts entre particuliers : replis en mémoire.** `claimTransfer` passe par la base et la RPC `ticket_transfer_claim`. En revanche, `initiateTransfer`, `getClaimTransferInfo`, `cancelTransfer`, `expireOverdueTransfers`, `getTransferRecord` et `isTicketLocked` (`lib/tickets/ticket-transfer.service.ts`) gardent un repli en mémoire. C'est contraire à la règle « aucun repli silencieux ». Hors du périmètre de ce lot, à traiter.
2. **Billets « à régler sur place »** : aucun parcours de production n'en émet aujourd'hui. Le checkout est en ligne seulement, et les tests les créent directement. L'encaissement au scan est en place et testé, mais il ne sert qu'à des billets créés hors de l'application. Il faut décider si un mode « payer sur place » doit exister.
3. **Permission espèces** : `event_controllers.can_accept_cash` vaut `false` par défaut. Les contrôleurs déjà affectés doivent recevoir cette permission du partenaire avant de pouvoir encaisser ou vendre au guichet (refus `NO_CASH_PERMISSION`).
4. **Clôture de caisse et PIN** : la génération du PIN et la clôture par `/api/controller/shifts/close` (écart, justification, co-signature par PIN, alerte) ne sont pas des RPC transactionnelles. La clôture n'est plus couverte par aucune suite active : seule `controller-shifts-z`, en quarantaine, l'appelait (section 5).
5. **Retrait d'un contrôleur par un admin** : sur `DELETE /api/partner/team/controller/<id>`, un ADMIN sans profil partenaire appelle `atomic_partner_remove_controller` avec `p_partner_id` nul. La RPC ne retire rien, et la route continue comme si le retrait avait eu lieu. C'est un comportement antérieur, non corrigé.
6. **Rôles en partie modifiés sur un refus 409** : `setUserRoles` ajoute les nouveaux rôles avant de retirer les anciens. Si le retrait de CONTROLEUR est refusé (caisse ouverte), les rôles ajoutés restent.
7. **`DELETE /api/partner/team/<eventId>`** ne compare pas l'événement de l'URL à celui de l'affectation. Le droit est vérifié sur l'événement de l'affectation : ce n'est pas une faille, mais une incohérence d'API.
8. **Anonymisation d'un compte** : la suppression des rôles d'un contrôleur qui a une caisse ouverte est refusée par le trigger `controller_removal_guard`. L'anonymisation d'un tel compte échoue donc en 409 tant que la caisse n'est pas clôturée. C'est voulu, mais non testé.
9. **Écran `/partner/scan`** : il liste les événements PUBLIE du partenaire connecté. Un admin sans profil partenaire n'a donc aucun événement à y choisir. L'API, elle, l'accepte sur tout événement.
10. **Couverture perdue** :
    - la notification `TICKET_SCANNED` après compostage (`notifyScanned`) n'est plus testée depuis la suppression de `ticket-scanned-notifications` ;
    - `security_version + 1` au transfert n'est plus vérifié ;
    - les statistiques du scanneur (`stats.scanned_today`) ont disparu de la réponse du scan. Il faut confirmer que c'est voulu : le lot 5 lira `ticket_scans`.
11. **SMS** : la limite par compte ne s'applique pas aux envois de masse de l'admin (communications), qui ont leur propre circuit. L'OTP reste limité par numéro et par IP, pas par compte. Le compteur de tentatives d'un code OTP n'est pas incrémenté de façon atomique.
12. **Guichet** : le billet vendu va au compte du numéro de l'acheteur s'il existe, sinon au compte du vendeur. Ce choix est à valider, car un billet « au nom du contrôleur » peut prêter à confusion.
13. **Défauts du lot 3 encore ouverts sur les autres cibles** (point 3 du lot 3) : la salle facture le solde au lieu de l'acompte, et une table réservée hors plateforme passe SUCCESS sans encaissement. Seule l'identité du client (point 2) est corrigée ici (4.0).
14. **Interface** :
    - le bouton du statut ambassadeur reste affiché à un ADMIN, alors que l'action est refusée en 403 ;
    - l'écran du scanneur, la carte billet, le PDF et la page des réglages n'ont pas été vérifiés en navigateur (contrôles statiques seulement).
15. **Suites legacy** : plusieurs suites conservées gardent l'ancien contrat du scan ou de live-code, ou des assertions devenues fausses. Elles sont listées en section 5 et ne sont pas modifiées, conformément à la règle. Elles sont à revoir à leur sortie de quarantaine.
16. **Dépendance du lecteur** : `@zxing/browser` (0.2) et `@zxing/library` (0.23) restent utilisés par l'écran de scan. Leur maintenance est à surveiller.
17. **Exploitation** :
    - régénérer les PIN régisseur ;
    - déclarer `TICKET_TOTP_MASTER_KEY` et `REGISSEUR_PIN_KEY` ;
    - vérifier que la publication Realtime `supabase_realtime` existe sur le projet de production. La migration `…13` y ajoute `ticket_scans`.
18. **Vérification visuelle** : aucun écran du lot n'a été ouvert en navigateur. Seuls des contrôles statiques et les tests d'API ont été faits.
19. **Tentatives non journalisées** : un refus de quota (429 `rate_limited`) ou une erreur technique (5xx) n'écrit pas de ligne `ticket_scans`. Ce ne sont pas des décisions sur un billet, et le résultat `rate_limited` n'est pas admis par la contrainte de la table. Pour le pilotage du lot 5, il faut décider si ces tentatives doivent être comptées.

Le lot 5 n'a pas été commencé.
