# Contre-vérification — finition 3d (recours et suppléance de l'administration)

Branche `audit/finition-3d`, partie de `finition-3d/recours` à `bd1098255` (commit du rapport de la 3d). Ce commit n'était pas encore poussé par la session de la 3d au moment de l'audit : il est arrivé sur origin avec ma branche, sans changer `origin/finition-3d/recours` (`449bd09c0`).

- Je n'ai écrit que des tests : `tests/audit/cvf3d-1` à `cvf3d-6`, aides `tests/audit/cvf3d-helpers.ts`. Aucun correctif, rien de fusionné.
- Aucun test distant. Je n'ai pas lu `.env.local`.
- Chaque test appelle les routes réelles de l'application sur la base locale de la CI, et affirme le comportement **sûr** : un test rouge est un trou.
- Le temps est simulé par écriture en base locale : demande expirée, code de l'appareil vieilli, inactivité.

## À lire en premier

Cinq trous, aucun critique : 9 attaques rouges sur 44. Les 35 autres sont bloquées, dont les 31 suites d'audit existantes, toutes vertes.

| # | Trou | Points | Gravité | Correctif proposé (une phrase) |
|---|---|---|---|---|
| T1 | Un ADMIN change lui-même son numéro par l'écran du profil, sans le Superadmin. Le Superadmin change le sien de la même façon, sans le code de moins de 10 minutes qu'exige « Sécurité du compte ». | 1k, 2h | **Élevée** | Refuser `/api/account/phone/start` et `/confirm` (et `account_phone_finalize` en base) à tout compte ADMIN ou SUPERADMIN, en renvoyant vers les écrans de la 3d. |
| T2 | Après la révocation, le jeton d'accès déjà ouvert garde le pouvoir d'administration, par la REST et le temps réel, jusqu'à son expiration (1 heure au plus) : ADMIN dont le Superadmin change le numéro, session restée sur le téléphone perdu d'un Superadmin. | 1j2, 1j3, 2i | **Élevée** | Effacer les lignes `admin_session_codes` du compte dans `revoke_user_sessions` et dans la révocation du changement de son propre numéro, et faire exiger par `admin_session_code_valid()` que la session existe encore dans `auth.sessions`. |
| T3 | Un admin inactif depuis 31 minutes est arrêté par les routes, mais lit toujours par la REST et reçoit le temps réel. | 6b | Moyenne | Faire exiger par `admin_session_code_valid()` une activité de moins de 30 minutes (`admin_session_activity`), comme `admin_step_up_check`. |
| T4 | Un Superadmin crée un compte ADMIN (`POST /api/admin/users`) sans redonner ni mot de passe ni code. « Changer le rôle » les exige pour faire d'un client un ADMIN : le rapport de la 3d annonce « un seul chemin ». | 3g | Moyenne | Appeler `requireAdminIdentity` dans `POST /api/admin/users` quand le rôle demandé est ADMIN, et garder ADMIN dans `user_roles_set` comme SUPERADMIN. |
| T5 | Deux routes de compte servent un admin qui n'a pas passé le code : `GET /api/referrals/my-stats` (ses chiffres de parrainage) et `DELETE /api/push/subscriptions` (retrait d'un de ses appareils pour les notifications). | 6a, 6d | Faible | Passer ces deux méthodes par `requireActiveSession`. |

T1 et T2 se cumulent. Avec le mot de passe et une session ouverte depuis moins de 12 heures, un tiers met son propre numéro sur le compte (T1) : les codes administrateur suivants lui arrivent. La révocation ne coupe pas tout de suite ce qu'il a déjà ouvert (T2).

## Résultat par point

**BLOQUÉE** : l'attaque est refusée et rien ne change. **TROU** : l'attaque passe ; la sortie brute du test rouge suit. Sorties : `runs/333-44160481453/test-logs/` sur `origin/ci-results`.

### 1. Changement du numéro d'un ADMIN par le SUPERADMIN (`cvf3d-1-numero-admin`)

| Attaque | Résultat |
|---|---|
| a. Superadmin sans mot de passe récent | BLOQUÉE : 403 `PASSWORD_CONFIRMATION_REQUIRED`, aucun SMS, aucune demande |
| b. Mot de passe redonné, code de plus de 10 minutes | BLOQUÉE : 403 `ADMIN_CODE_CONFIRMATION_REQUIRED`, aucun SMS |
| c. Code périmé (demande de plus de 10 minutes) | BLOQUÉE : 410 `CODE_EXPIRED`, numéro inchangé |
| d. Nouveau numéro non prouvé : code d'une autre demande, demande remplacée, demande d'un autre Superadmin | BLOQUÉE : 400 `INVALID_CODE`, 409 `REQUEST_CLOSED`, 404 `REQUEST_NOT_FOUND` |
| e. Code deviné, un à un puis 8 essais en parallèle | BLOQUÉE : `400 ×4` puis `429 TOO_MANY_ATTEMPTS` ; en parallèle, 5 essais comptés, pas plus ; le bon code ensuite donne 409 |
| f. Cible SUPERADMIN ; g. cible soi-même | BLOQUÉE : 409 `TARGET_IS_SUPERADMIN`, 409 `SELF_TARGET`, aucun SMS |
| h. ADMIN muni de users.write, identité confirmée, qui vise un ADMIN, un client, lui-même, ou valide une demande | BLOQUÉE : 403 partout, aucun SMS |
| i. Simultané : deux validations du bon code ; deux débuts ; validation et nouveau début | BLOQUÉE : un seul changement ; une seule demande ouverte ; numéro de connexion et numéro du compte toujours identiques |
| j1. Révocation : routes de l'application, rafraîchissement, sessions, appareils | BLOQUÉE : `/api/auth/me` 401, route admin 401, rafraîchissement refusé, 0 session, 0 appareil |
| j2. Révocation : jeton d'accès déjà ouvert, par la REST | **TROU (T2)** |
| j3. Révocation : abonnement temps réel ouvert avant | **TROU (T2)** |
| k. L'ADMIN change lui-même son numéro par l'écran du profil | **TROU (T1)** |

```
[CVF3D-1j1] changement : HTTP 200 {"ok":true,"sessions_revoked":3} ; /api/auth/me : HTTP 401 … ; rafraîchissement : 400 Invalid Refresh Token: Refresh Token Not Found ; sessions : 0 ; appareils : 0
[CVF3D-1j2] comptes d'autrui lus par la REST : avant le changement 20 et 20 ; après : 20 et 20 ; lignes admin_session_codes restantes : 3
  → jeton de la session révoquée : 20 compte(s) d'autrui encore lus par la REST
[CVF3D-1j3] sentinelle 6b8d0864-… : reçue par le témoin ; reçue par l'ADMIN visé après la révocation : OUI
  → ADMIN visé, session révoquée : aucun signal d'administration : 1 message(s) reçu(s)
[CVF3D-1k] ADMIN (code de l'appareil vieux de 2 h, aucun Superadmin) : début HTTP 200 {"ok":true,"message":"Code de confirmation envoyé par SMS au nouveau numéro."} ; SMS au nouveau numéro : 1 ; validation HTTP 200 {"ok":true} ; numéro du compte : +221773739435 (avant : +221773739169)
  → numéro de l'ADMIN changé sans le Superadmin (+221773739435)
```

- **Cause de T2.** `revoke_user_sessions` supprime `auth.sessions` et révoque les jetons de rafraîchissement. Les routes de l'application refusent donc aussitôt le jeton, car GoTrue ne trouve plus la session. Mais `is_admin()` ne regarde que `admin_session_codes` (lot 9 quinquies), que personne n'efface ; PostgREST et le temps réel ne vérifient que la signature et l'échéance du jeton (`jwt_expiry = 3600`).
- **Cause de T1.** `ProfileForm` propose « Changer de numéro » à tout compte. Les routes `/api/account/phone/*` ne demandent à un admin que le code de l'appareil (12 h) et un mot de passe de 10 minutes : ni le Superadmin, ni un code récent.

### 2. Codes de secours et « J'ai perdu mon téléphone » (`cvf3d-2-codes-secours`)

| Attaque | Résultat |
|---|---|
| a. Rejouer un code, un à un et deux fois en parallèle | BLOQUÉE : 403 `BACKUP_CODE_INVALID` ; un seul usage en parallèle ; 8 codes restants |
| b. Deviner : 5 faux puis le bon ; 10 faux en parallèle puis le bon | BLOQUÉE : `403 ×5` puis 429 ; en parallèle, 5 essais évalués au plus ; aucun code consommé |
| c. Anciens codes après régénération | BLOQUÉE : 403 ; les nouveaux codes passent |
| d. Régénérer sans mot de passe récent, puis sans code récent | BLOQUÉE : 403 `PASSWORD_CONFIRMATION_REQUIRED`, puis `ADMIN_CODE_CONFIRMATION_REQUIRED` ; les anciens codes restent valables |
| e. Relire les codes après l'affichage : base, REST, réponses, console | BLOQUÉE. En base : empreintes HMAC à clé du serveur, aucune calculable par un SHA-256 simple ; aucun code au journal ni dans la boîte d'envoi. En REST : la table et les 3 fonctions sont refusées (Superadmin et anonyme). Le GET ne rend que `remaining` et `generated_at`. Aucun code sur la console du serveur. |
| f. ADMIN non Superadmin ; Superadmin rétrogradé puis renommé | BLOQUÉE : 403 `SUPERADMIN_ONLY` / `NO_BACKUP_CODES` ; les anciens codes sont annulés à la rétrogradation et le restent |
| g. Ouvrir sans mot de passe ET code valides : mot de passe faux, code faux, code d'un autre Superadmin, sans session, compte client | BLOQUÉE : 403 / 401, l'administration reste fermée, aucun code consommé ; témoin : les deux justes ouvrent |
| h. Le Superadmin change son numéro par l'écran du profil, avec un code vieux de 2 heures | **TROU (T1)** |
| i. Session du téléphone perdu, après le code de secours et le changement de numéro | **TROU (T2)** |

```
[CVF3D-2h] « Sécurité du compte » : HTTP 403 {"error":"Par sécurité, saisissez le code administrateur reçu par SMS pour continuer.","code":"ADMIN_CODE_CONFIRMATION_REQUIRED"} ; écran client : début HTTP 200 {"ok":true,…}, validation HTTP 200 {"ok":true} ; numéro du compte : +221773757414 (avant : +221773757173)
  → numéro du Superadmin changé sans code récent, par l'écran client (+221773757414)
[CVF3D-2i] changement : HTTP 200 {"ok":true,"sessions_revoked":2} ; session du téléphone perdu : route HTTP 401 …, rafraîchissement 400 Invalid Refresh Token: Refresh Token Not Found, comptes d'autrui par la REST avant 20 puis 20
  → session du téléphone perdu, révoquée : 20 compte(s) d'autrui encore lus par la REST
```

2i est le cas exact que la 3d veut couvrir. Le Superadmin reprend la main avec son code de secours et change de numéro. Pendant encore une heure au plus, la session ouverte sur le téléphone perdu lit tout ce que lit un Superadmin, par la REST.

### 3. Changer le rôle (`cvf3d-3-role`)

| Attaque | Résultat |
|---|---|
| a. Par un ADMIN muni de users.write, identité confirmée | BLOQUÉE : 403 `SUPERADMIN_ONLY`, rôles inchangés |
| b. Superadmin sans mot de passe récent, puis sans code récent | BLOQUÉE : 403, rôles inchangés, rien au journal |
| c. Dernier SUPERADMIN : deux retraits croisés simultanés (×2), deux départs simultanés (×2), le dernier qui se retire. Les autres SUPERADMIN actifs sont suspendus le temps du test, puis remis. | BLOQUÉE : il reste un SUPERADMIN actif après chaque scénario ; le dernier reçoit 409 `LAST_SUPERADMIN` |
| d. Promotion en SUPERADMIN : alerte ; autres chemins (création, PATCH `roles`, PATCH `role`) | BLOQUÉE : chaque SUPERADMIN actif est prévenu, SMS compris pour l'auteur, jamais le promu ; les 3 autres chemins donnent 409 `ROLE_SCREEN_REQUIRED` |
| e. Réponse « fait » sans changement : deux Superadmins, deux sens opposés en même temps ; « déjà ce rôle » | BLOQUÉE : une seule réponse « fait », qui dit les rôles en base ; 409 `NO_CHANGE` |
| f. Contrôleur promu ADMIN | BLOQUÉE : confirmation d'abord ; ensuite rôle CONTROLEUR retiré, 0 affectation, invitation en attente CANCELLED |
| g. Création d'un compte ADMIN par un Superadmin sans mot de passe ni code récents | **TROU (T4)** |

```
[CVF3D-3g] SUPERADMIN (code de l'appareil vieux de 2 h, aucun mot de passe redemandé) : écran « Changer le rôle » HTTP 403 {"error":"Par sécurité, saisissez votre mot de passe pour continuer.","code":"PASSWORD_CONFIRMATION_REQUIRED"} ; création d'un compte ADMIN HTTP 200 {"success":true,"userId":"3c47917c-…","activation":"SENT",…} ; rôles du compte créé : ADMIN, CLIENT
  → rôle ADMIN donné sans mot de passe ni code récents, par la création d'un compte (3c47917c-99ea-4895-8820-76bc2e3f6ed7)
```

Le compte créé n'a aucun droit tant qu'on ne lui en donne pas. Mais la grille des droits (`POST /api/admin/permissions`) n'exige pas non plus de mot de passe ni de code récents : une session de Superadmin laissée ouverte suffit pour se fabriquer un ADMIN durable. La route des droits est hors du périmètre de la 3d ; je le signale sans test.

### 4. Espèces marquées rendues par un admin (`cvf3d-4-especes`)

Toutes BLOQUÉES :
- **a. Droits.** Sans refunds.manage (events.write seul) : 403. Compte suspendu : 403. Rien d'écrit.
- **b. Motif.** Absent, blanc, 2 caractères, 501 caractères, `null`, nombre : 400, rien d'écrit.
- **c. Paiement visé.** Paiement d'un autre événement : 404 `PAYMENT_NOT_FOUND`. Événement non annulé : 409 `EVENT_NOT_CANCELLED`. Paiement inconnu : 404.
- **d. Déjà marqué** (par l'organisatrice, puis par un autre admin) : `ALREADY_MARKED`. Auteur et motif d'origine gardés ; aucun second journal ni avis.
- **e. Trois marquages en parallèle** (deux admins) : une seule marque, un journal, un avis.
- **f. Montant et client inchangeables.** Champs en plus (montant, client, événement, statut) : 400. Après un marquage, aucune colonne du paiement n'a changé.

### 5. Choix de l'organisatrice dans Équipe (`cvf3d-5-equipe`)

Toutes BLOQUÉES :
- **a. Admin sans events.read** : la liste et l'équipe donnent 403.
- **b. Admin events.read seulement.** Il lit (témoin). Ses 10 écritures sur l'équipe de l'organisatrice choisie donnent toutes 403, et l'équipe ne change pas : inviter, réglages, affectations (liste et une), point d'entrée, porte, retirer un contrôleur, vider un événement ou toute l'équipe, effacer une invitation.
- **c. Partenaire.** La liste lui est refusée (403). Avec `?partnerId=` d'une autre, elle reçoit sa propre équipe, sans aucune donnée de l'autre. Avec `?eventId=` d'une autre : 404. Une invitation sur l'événement d'une autre est refusée, sans aucune invitation créée.
- **d. Contenu de la liste** : elle ne rend que `partner_id`, `name`, `city` et `status`, sans numéro, adresse ni compte.

### 6. Inactivité et routes de compte sans le code (`cvf3d-6-inactivite`)

| Attaque | Résultat |
|---|---|
| a. Balayage, lu sur le disque, de chaque route qui lit une session, hors administration et hors routes partenaire et contrôleur (inventaires de f3b-securite et f3d-securite) | 42 méthodes refusées faute de code. Exceptions, non appelées : `auth/me` (la fenêtre du code en a besoin) et `account/password-confirm` (mot de passe de cette fenêtre). **TROU (T5)** : `GET /api/referrals/my-stats` servi |
| b. Admin inactif depuis 31 minutes | Route partenaire refusée (403 `IDLE`, témoin) ; **TROU (T3)** : la REST et le temps réel servent toujours |
| c. Relecture automatique (`x-ev-input-age: 120`) sur une route contrôleur | BLOQUÉE : servie à 29 minutes sans compter comme activité, refusée à 31 minutes |
| d. `DELETE /api/push/subscriptions` avec un corps valide, sans le code | **TROU (T5)** (run 334) |

```
[CVF3D-6a] refusées faute de code : 42 ; exceptions non appelées : account/password-confirm#POST (…) ; auth/me#GET (…)
[CVF3D-6a] autres réponses (rien de servi) : DELETE /api/push/subscriptions → 400 INVALID_BODY | GET /api/tickets/claim/[token] → 410 CLAIM_LINK_RETIRED
[CVF3D-6a] SERVIES sans le code : GET /api/referrals/my-stats → 200  {"success":true,"referralCode":"EV-779522","referralLink":"http://127.0.0.1:3000/register?ref=EV-779522","isAmbassador":false,…
[CVF3D-6b] avant : 20 compte(s) d'autrui par la REST ; après 31 minutes sans activité : route partenaire HTTP 403 {…"code":"ADMIN_PASSWORD_REQUIRED","reason":"IDLE"} ; REST 20 compte(s) d'autrui ; temps réel : signal d'administration reçu OUI
  → admin inactif depuis 31 minutes : 20 compte(s) d'autrui encore lus par la REST
[CVF3D-6d] admin sans le code : POST (témoin, contrôlé) HTTP 403 {…"code":"ADMIN_SMS_REQUIRED","reason":"NEW_DEVICE"} ; DELETE HTTP 200 {"removed":false}
  → DELETE servi sans le code
```

- **6d.** Au balayage, `DELETE /api/push/subscriptions` a répondu 400, parce que le corps était vide. En lisant la route : cette méthode lit la session par `getServerSessionUser`, sans contrôle du second facteur, alors que le POST du même fichier est contrôlé. Mon inventaire statique classait le fichier comme contrôlé ; d'où l'attaque 6d, avec un corps valide.
- **`GET /api/tickets/claim/[token]`** répond 410 à tous, sans rien lire : rien à signaler.

## Runs

Résultats sur `origin/ci-results`, dossier `runs/<numéro>-<identifiant>/`.

| Run | Commit | Mode | Résultat |
|---|---|---|---|
| 333 | `440fbf0a2` | rapide, 37 suites (mes 6 et les 31 d'audit) | 33/37. Les 31 suites d'audit sont vertes. Rouges : cvf3d-1 (j2, j3, k), cvf3d-2 (h, i), cvf3d-3 (g), cvf3d-6 (a, b), soit exactement les trous ci-dessus. typecheck et lint OK. |
| 334 | `8b5acac30` | rapide, cvf3d-6 | rouge voulu : a, b et d rouges, c verte. 6d confirme T5 : `DELETE` servi sans le code. |
RUN_COMPLET_LIGNE

## Remarques

- **Couverture des tests de la 3d.** Le rapport de la 3d annonce « dernier Superadmin vérifié sous verrou, deux retraits simultanés compris ». Son test (`f3d-role`) ne fait qu'un appel en base, dans une transaction annulée. Mon attaque 3c joue les deux retraits simultanés pour de vrai, par la route, deux fois chacun : bloquée.
- **Limite de T2 et T3.** J'ai prouvé la **lecture** (table `users`, abonnements à `admin_signals`). Je n'ai pas cherché d'écriture directe par la REST : les écritures d'administration passent par des fonctions réservées au rôle de service.
- **Ordre des contrôles.** Je n'ai trouvé aucune route de compte qui lise ses paramètres avant la session, hormis le cas de `DELETE /api/push/subscriptions` ci-dessus.
