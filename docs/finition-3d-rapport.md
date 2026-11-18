# Finition 3d — Recours et suppléance

Branche `finition-3d/recours`, partie de `main` à `46d4d6933`, puis main (`dcc1e3ab2`) et la contre-vérification (`origin/audit/finition-3d`) fusionnées. Non fusionnée dans main. Migrations `20261120000001` à `…09`, sans BEGIN ni COMMIT, rejouables, non appliquées sur event-village-dev.

## Correctifs de la contre-vérification (à lire d'abord)

La contre-vérification (`origin/audit/finition-3d`, rapport `docs/audit-finition-3d.md`) a trouvé 5 trous, aucun critique ; T1 et T2 se cumulent.
- Ses suites `cvf3d-1` à `cvf3d-6` sont fusionnées telles quelles dans la branche : ce sont mes tests rouges, et je n'ai modifié aucune de leurs assertions.
- main a aussi été fusionnée (`dcc1e3ab2` : finition 2b, déconnexion sans réseau, CI en jobs parallèles), sans conflit. Mon commit de limite à 120 min est annulé (`b096bcec5`).
- Un commit par point, migrations `20261120000006` à `…09`.

| # | Trou | Correctif | Commit | Preuve |
|---|---|---|---|---|
| T1 | Un ADMIN changeait lui-même son numéro par l'écran du profil, sans le Superadmin ; le Superadmin changeait le sien de même, sans code récent. | `POST /api/account/phone/start` et `/confirm` refusent tout compte ADMIN ou SUPERADMIN (403, avant le mot de passe et tout SMS), avec un message qui renvoie vers le bon chemin. `account_phone_finalize` refuse aussi en base (`ADMIN_PHONE_PATH`, migration 06). L'écran du profil n'affiche plus « Changer de numéro » pour eux. | `9ca9cf62b` | `cvf3d-1` k, `cvf3d-2` h |
| T2 | Après une révocation, le jeton d'accès déjà ouvert gardait le pouvoir d'administration par la REST et le temps réel, jusqu'à son échéance (1 h au plus). | `admin_session_code_valid()` exige que la session du jeton existe encore dans `auth.sessions` : toute révocation coupe aussitôt la REST, quel que soit son chemin. `revoke_user_sessions` et la révocation de « son propre numéro » effacent les lignes `admin_session_codes` (migration 07). | `7fa1f71b9` | `cvf3d-1` j2, j3 ; `cvf3d-2` i |
| T3 | Un admin inactif depuis 31 minutes, arrêté par les routes, lisait encore par la REST et recevait le temps réel. | `admin_session_code_valid()` exige une activité plus récente que la durée d'inactivité des routes. Cette durée est gardée avec l'activité de la session (`admin_session_activity.idle_secs`, migration 08) : 30 min par défaut, 240 en e2e, comme `ADMIN_IDLE_TIMEOUT_MINUTES`. Les routes, la REST et le temps réel suivent ainsi une seule règle. | `fe49833ff` | `cvf3d-6` b |
| T4 | Un Superadmin créait un compte ADMIN sans redonner ni mot de passe ni code ; la grille des droits non plus. | `POST /api/admin/users` (rôle ADMIN) et `POST /api/admin/permissions` exigent mot de passe et code de moins de 10 minutes (`requireAdminIdentity`). Le rôle ADMIN d'un compte neuf est donné par `admin_account_admin_role`, qui revérifie l'identité en base. `user_roles_set` garde ADMIN comme SUPERADMIN : `ROLE_SCREEN_REQUIRED` hors de « Changer le rôle » et de la création (migration 09). À l'écran, création et grille passent par la fenêtre « mot de passe et code ». | `cd21b1f60` | `cvf3d-3` g |
| T5 | `GET /api/referrals/my-stats` et `DELETE /api/push/subscriptions` servaient un admin qui n'avait pas passé le code. | Les deux passent par `requireActiveSession`, comme le POST du même fichier. La déconnexion n'en dépend pas : elle désabonne le navigateur sur place. | `914e899dc` | `cvf3d-6` a, d |

**Messages nouveaux (T1).**
- ADMIN : « Demandez au super-administrateur de changer votre numéro. »
- SUPERADMIN : « Changez votre numéro depuis « Sécurité du compte », dans l’administration. », avec le lien « Sécurité du compte » sur l'écran du profil.
- Base : « Le rôle d’administrateur se donne à la création du compte ou depuis « Changer le rôle », avec votre mot de passe et le code administrateur. » (T4, refus de `user_roles_set`, non affiché à l'écran : les routes refusent avant).

**Mesure demandée (T2 et T3).** `tests/parcours/f3d-cv-rest-mesure` compte 15 lectures REST de 1 000 lignes du journal (Superadmin), après 3 lectures d'échauffement, et compare les médianes :
- avant : la fonction du lot 9 quinquies, remise le temps de la mesure ;
- après : la version corrigée, remise ensuite et vérifiée à l'identique ;
- résultat : run 343, médiane **430 ms avant, 736 ms après (+306 ms, +71 %)** ; run 347, **520 ms avant, 831 ms après (+310 ms, +60 %)**. Environ 0,3 ms de plus par ligne lue.
- Pourquoi par ligne : la règle de lecture d'`audit_logs` appelle `is_superadmin()` sur chaque ligne, et la fonction relit la session à chaque appel.
- Piste non faite (à décider) : écrire les règles avec `(select is_superadmin())`, évaluée une seule fois par requête. Cela touche toutes les règles de lecture de l'administration.
- La fonction reste STABLE et en SQL : une seule requête, trois lectures sur clé primaire de la session du jeton. Le coût vient du nombre d'appels, pas de la requête.

**Contrôles avant et après des migrations 06 à 09 (event-village-dev).**

```sql
-- Après
-- A. Neuf versions 20261120000001 à …09
select version from supabase_migrations.schema_migrations where version like '20261120%' order by 1;
-- B. Garde du profil client : true
select prosrc like '%ADMIN_PHONE_PATH%' from pg_proc where proname = 'account_phone_finalize' and pronamespace = 'public'::regnamespace;
-- C. Révocation et activité exigées : true, true, true
select prosrc like '%auth.sessions%', prosrc like '%admin_session_activity%', provolatile = 's'
  from pg_proc where proname = 'admin_session_code_valid' and pronamespace = 'public'::regnamespace;
select prosrc like '%admin_session_codes%' from pg_proc where proname = 'revoke_user_sessions' and pronamespace = 'public'::regnamespace;
-- D. Colonne idle_secs présente, bornée
select column_name from information_schema.columns where table_schema = 'public' and table_name = 'admin_session_activity' and column_name = 'idle_secs';
-- E. Rôle ADMIN gardé ; fonction de création réservée au rôle de service : true ; false, false, true
select prosrc like '%Le rôle d’administrateur se donne%' from pg_proc where proname = 'user_roles_set' and pronamespace = 'public'::regnamespace;
select has_function_privilege('anon', p.oid, 'execute'), has_function_privilege('authenticated', p.oid, 'execute'), has_function_privilege('service_role', p.oid, 'execute')
  from pg_proc p where p.proname = 'admin_account_admin_role' and p.pronamespace = 'public'::regnamespace;
```

**Effet à la mise en ligne (T2 et T3).**
- Après l'application de ces migrations, un admin qui lit l'administration en direct (REST, temps réel) doit avoir une session encore ouverte et active depuis moins de 30 minutes.
- Le premier appel d'une page d'administration renouvelle l'activité : un admin qui travaille ne voit rien changer.

**Tests existants modifiés pour ces correctifs (signalés).**

| Test | Modification | Pourquoi |
|---|---|---|
| `tests/parcours/f3b-droits.test.ts`, `f3a-securite.test.ts`, `audit-transactionnel.test.ts` | Le Superadmin de la suite confirme son identité (`confirmIdentity` : mot de passe, puis code reçu par SMS, par les vraies routes). | T4 : créer un ADMIN et régler ses droits l'exigent. Mêmes assertions. |
| `tests/parcours/lot9quinquies-activation.test.ts`, `ecritures-ignorees.test.ts` | Superadmin neuf de la suite, qui confirme son identité, au lieu de la fixture SUPERADMIN. | Même raison. Les codes partent à son numéro, pas à celui de la fixture, qui sert à toutes les suites. |
| `tests/parcours/droits-admin-9bis.test.ts` | Le témoin « un SUPERADMIN ajoute et retire ADMIN en direct par `user_roles_set` » devient le refus `ROLE_SCREEN_REQUIRED`, rôles inchangés. | T4 : ce chemin est fermé. Le refus pour un acteur ADMIN est inchangé. |
| `tests/parcours/cvf1c-t1-promotion.test.ts` | `user_roles_set` en direct : refus `ROLE_SCREEN_REQUIRED` vérifié ; puis appel avec le drapeau de l'écran, dans une transaction, pour garder les assertions d'origine (caisse ouverte, promotion concurrente). | T4. |
| `tests/parcours/notif-envoyeur.test.ts` | Version de main (correctif de la 2b) ; mon correctif du même test est retiré. | Doublon (voir plus bas). |
| `tests/parcours/droits-admin-9bis.test.ts` (témoin de création) | Le Superadmin confirme son identité avant de créer un ADMIN. | T4. Mêmes assertions. Rouge au run 343. |
| `tests/parcours/dette-roles-otp.test.ts` (C4, caisse ouverte) | Refus `ROLE_SCREEN_REQUIRED` vérifié sans le drapeau de l'écran ; puis appel avec le drapeau, dans une transaction, comme `admin_role_change`. | T4. Assertion d'origine (`CONTROLLER_HAS_OPEN_SHIFT`, aucun rôle modifié) inchangée. Rouge au run 343. |
| `tests/schema/f3b-ecrans.test.ts` (E-37, « Superadmin » à l'écran) | La phrase dictée « Demandez au super-administrateur de changer votre numéro. » est admise, comme celle du point 2. | T1 : phrase de la consigne. Rouge au run 343. |
| `tests/schema/migration-finition2b-rejouable.test.ts` | « Les migrations de la 2b passent après toutes les autres » ne regarde plus les migrations `20261120…` de la 3d. | La 2b est fusionnée et appliquée avant la 3d. Rouge au run 343. |
| `docs/recette-billetterie.md` (A33) | Lignes de `ecritures-ignorees` décalées de 5. | Contrôle `recette-matrice`. Rouge au run 343. |
| `tests/security/helpers.ts` (`signUpAttacker`) | Un autre numéro est tiré si le premier est déjà pris (409 `PHONE_ALREADY_REGISTERED`), trois essais au plus. | `r27-avatars` rouge au run 346, fragilité notée depuis le run 285 ; ligne de `docs/apres-lancement.md` marquée corrigée. Aucune assertion changée. |

Écran des comptes : l'enregistrement des droits appelle `fetch` dans son gestionnaire, comme avant T4. Le contrôle A1 du lot 8 (« aucune réussite annoncée sans appel réseau ») ne reconnaît que `fetch` ; il avait attrapé `sendJson` au run 343.

Garde-fous ajoutés :
- `f3d-ecrans` : chemin du numéro selon le rôle, écran du profil, routes du profil, écran des comptes, routes de T4 et de T5 ;
- `migration-finition3d-rejouable` : migrations 06 à 09 ;
- R3 : `admin_account_admin_role` ;
- `f3d-cv-rest-mesure`.

**`notif-envoyeur`** (consigne : corriger la fragilité sans affaiblir l'assertion, 5 runs rapides verts).
- **Correctif.** La finition 2b l'avait déjà corrigé dans main (`882977c18`). Son vidage compte en base les lignes encore dues et repasse jusqu'à zéro, autrement dit jusqu'à ce qu'un passage n'examine plus rien. Il pose aussi, à chaque essai, 2 500 lignes que la réservation examine sans les réserver, ce qui rejoue le cas d'échec. Mon correctif (`6e66795e7`) faisait la même chose sans la charge ; combiné par la fusion, il déclarait deux fois une variable. Je l'ai retiré (`54b51cdba`) : le fichier est celui de main.
- **Pourquoi la 3d l'avait fait tomber** (runs 306 et 319). Mes suites laissent une quinzaine de Superadmins actifs. Chaque alerte destinée aux Superadmins part ensuite à chacun d'eux, et la file grossit pour les suites suivantes. La suite durait 134 et 172 s sur les runs de la 3d, contre 22 à 65 s ailleurs.
- **Essais.** Sur ta décision, les 5 runs rapides de ce test seul sont remplacés par le run complet final : `notif-envoyeur` y est vert (runs 343, 346 et 347).

**Runs des correctifs.**

| Run | Commit | Mode | Résultat | Ce qu'il montre |
|---|---|---|---|---|
| 343 | `898957a38` | complet (jobs parallèles) | 473/479 ; 56 min 24 s | suites `cvf3d` et d'audit vertes, e2e vert. 6 rouges dus à T1 et T4 : `admin-parrainage` (contrôle A1 : `sendJson` non reconnu comme appel réseau), `droits-admin-9bis` et `dette-roles-otp` (chemins fermés par T4), `f3b-ecrans` (phrase dictée de T1), `migration-finition2b-rejouable` (migrations 20261120…), `recette-matrice` (lignes décalées) |
| 346 | `f6d63a23f` | complet | 478/479 ; 45 min 6 s | les 6 corrigés ; seul rouge `r27-avatars` : numéro du compte d'essai déjà pris (409), fragilité notée depuis le run 285 |
| 347 | `a22f48007` | complet | **479/479, vert** ; 38 min 9 s | voir ci-dessous |

Les runs 344 et 345 appartiennent à d'autres sessions. Sur ta consigne, aucun run rapide pour ces correctifs : tout a été poussé en une fois, puis vérifié par runs complets.

**Run complet final (CI en jobs parallèles).** **Run 347** (`a22f48007`) : **vert**, 479 suites sur 479, en **38 min 9 s** (4 lots de tests, qualité et e2e en parallèle, tous verts).
- 37 suites d'audit vertes : 28 de `tests/audit` (dont `cvf3d-1` à `cvf3d-6`) et 9 de `tests/audit-auth`.
- e2e : recette 10/10, 581 tests d'écran, 616 captures, fumée et mesures vertes ; budgets JS tenus, aucun relevé.
- Invariants à 0 (les seules violations du journal sont celles du jeu d'essai de `pilotage-invariant`, qui contrôle le contrôle).

## À lire en premier

### 1. Failles trouvées, corrigées d'abord (rouge puis vert)

| # | Faille | Effet avant | Correctif | Preuve |
|---|---|---|---|---|
| F1 | `GET /api/controller/assignments` ne passait pas par `requireActiveSession`. | Un compte admin lisait les affectations sans aucun contrôle de son second facteur (code administrateur) ni de son inactivité. | La route passe par `requireActiveSession`, en mode ADMIN pour un compte admin. | `f3d-securite` rouge au run 288, vert au run 290 (au run 289, seule F4 restait rouge dans cette suite). |
| F2 | Routes partenaire, contrôleur, retraits et finance (`/api/partner`, `/api/controller`, `/api/withdrawals`, `/api/finance`) utilisées par un compte admin. | La règle des 30 minutes sans activité ne s'y appliquait pas : une session admin oubliée y restait ouverte. C'est le point 1 de la consigne. | Mode ADMIN sur ces quatre préfixes (`adminIdleScope`) : inactivité contrôlée par le serveur, fenêtre de mot de passe posée sur les pages partenaire et contrôleur d'un compte admin. | Inventaire de toutes ces routes lues sur le disque (chaque méthode) : rouge au run 288, vert au run 290. |
| F3 | Relecture automatique comptée comme une activité. | Une page d'administration laissée ouverte relisait ses données toutes les 60 s ; chaque relecture remettait l'inactivité à zéro côté serveur : la règle des 30 minutes ne se déclenchait jamais. | La fenêtre de sécurité ajoute à chaque appel `/api/` l'âge de la dernière saisie (en-tête `x-ev-input-age`) ; plus d'une minute sans saisie : l'appel est servi sans compter comme activité. | `f3d-securite`, runs 288 à 290. |
| F4 | `GET /api/partner/documents/signed-url` lisait ses paramètres avant la session. | Une session admin inactive recevait « 400 paramètres requis » au lieu d'être arrêtée (aucune donnée rendue, mais contrôle dans le mauvais ordre). | Session contrôlée d'abord ; le dépôt par jeton reste sans session. | Run 289 rouge, run 290 vert. |
| F5 | Rôles ADMIN et SUPERADMIN donnés ou retirés par `PATCH /api/admin/users` (et `user_roles_set` en base). | Un SUPERADMIN déjà connecté nommait ou retirait un SUPERADMIN sans redonner son mot de passe ni le code administrateur au moment de l'action, sans motif et sans alerte aux autres Superadmins. | Un seul chemin : « Changer le rôle » (`admin_role_change`). Le PATCH répond 409 `ROLE_SCREEN_REQUIRED` ; `user_roles_set` refuse SUPERADMIN hors de `admin_role_change` ; plus de création directe d'un SUPERADMIN. | `f3d-role` rouge au run 297, vert au run 302. |

Aucune faille trouvée dans les points 2, 4 et 5. Les 31 suites de `tests/audit/` et `tests/audit-auth/` sont vertes : runs 289, 299 et 305, puis au run complet 319.

### 2. Ce qui change pour l'administration

- **Inactivité.** Un admin inactif depuis 30 minutes doit redonner son mot de passe, aussi sur les pages partenaire et contrôleur.
- **Téléphone perdu.**
  - Un ADMIN : le Superadmin change son numéro depuis Comptes. Il faut un motif, et le code reçu au nouveau numéro, que l'ADMIN lui dicte.
  - Le Superadmin : « J'ai perdu mon téléphone » dans la fenêtre du code. Son mot de passe et un code de secours remplacent le SMS. Il change ensuite son numéro, prouvé par un code reçu au nouveau.
- **Codes de secours.** Page « Sécurité du compte » du Superadmin : 10 codes à usage unique, montrés une seule fois. Ils sont proposés après la double vérification.
- **Changer le rôle.** Bouton sur la ligne d'un compte, pour le Superadmin seulement : mot de passe, code et motif. Chaque Superadmin est alerté par SMS d'une nomination.
- **Suppléance.**
  - L'admin marque rendues les espèces d'un événement annulé, avec un motif ; l'organisatrice est prévenue.
  - Il choisit l'organisatrice dans une liste, sur la page Équipe.
  - Il valide un écart de caisse.
- **Accueil.** Une seule ligne pour l'argent dans « À faire aujourd'hui ».

## État de chaque point

| Point | État | Où |
|---|---|---|
| 1. Règle des 30 minutes sur les routes partenaire et contrôleur d'un admin | Fait, tests verts | `lib/admin/step-up.ts`, `lib/auth/session.ts`, `lib/admin/input-age.ts`, `components/admin/AdminAccountStepUp.tsx`, `tests/parcours/f3d-securite.test.ts` |
| 2a. Le Superadmin change le numéro d'un ADMIN | Fait, tests verts | `POST /api/admin/users/[id]/phone/start` et `/confirm`, `lib/admin/phone-change.ts`, migration `…05`, `components/admin/PhoneChangeFlow.tsx` |
| 2b. Codes de secours du Superadmin | Fait, tests verts | `GET` et `POST /api/admin/security/backup-codes`, migration `…04`, `components/admin/BackupCodesPanel.tsx`, page `/admin/securite` |
| 2c. « J'ai perdu mon téléphone » | Fait, tests verts | `POST /api/admin/step-up/recovery`, `POST /api/admin/security/phone/start` et `/confirm`, `components/admin/AdminStepUpGate.tsx` |
| 2d. Tests d'attaque | Faits, verts | `tests/parcours/f3d-telephone.test.ts` (section 2d) |
| 3. Changer le rôle | Fait, tests verts | `POST /api/admin/users/[id]/role`, migration `…03`, `components/admin/RoleChangeDialog.tsx`, `components/admin/IdentityConfirm.tsx` |
| 4a. Espèces marquées rendues par un admin | Fait, tests verts | `POST /api/admin/events/[id]/cash-refunds/[paymentId]`, migration `…02`, `components/partner/pilotage/CashRefundsList.tsx` |
| 4b. Page Équipe d'un admin, lien depuis la fiche | Fait, tests verts | `GET /api/partner/team/organizers`, migration `…01`, `components/partner/team/OrganizerPicker.tsx`, `app/admin/events/[id]/page.tsx` |
| 4c. « Valider l'écart » pour un admin events.write | Vérifié : **absent** pour tout admin (la section était cachée). Ajouté. | `components/partner/pilotage/CashTab.tsx` |
| 5. Une seule ligne pour l'argent (décision 12) | Fait, tests verts | `lib/admin/todo.ts` (`todoMoneyLine`), `components/admin/TodoToday.tsx` |

### Point 2 en détail

**2a. Le Superadmin change le numéro d'un ADMIN** (Comptes, « Changer le numéro » sur la ligne d'un ADMIN).
- Jamais le numéro d'un Superadmin (409 `TARGET_IS_SUPERADMIN`), jamais le sien par cet écran (409 `SELF_TARGET`).
- Mot de passe et code administrateur du Superadmin, saisis depuis moins de 10 minutes et revérifiés en base (`admin_identity_check`).
- Motif obligatoire, de 3 à 500 caractères.
- Un code part au **nouveau** numéro. Le numéro n'est changé qu'avec ce code (5 essais, 10 minutes), par le même Superadmin dans la même session.
- Ensuite :
  - toutes les sessions et tous les appareils de l'ADMIN sont révoqués ;
  - un SMS part à l'ancien et au nouveau numéro ;
  - le journal reçoit `ADMIN_PHONE_CHANGE_REQUESTED`, puis `ADMIN_PHONE_CHANGED`.
- Quotas :
  - 3 demandes par jour pour un même compte ;
  - 10 par jour pour un même Superadmin ;
  - 10 vérifications de code par 15 minutes.

**2b. Codes de secours** (page « Sécurité du compte », `/admin/securite`, menu du Superadmin).
- 10 codes à usage unique de 10 caractères (`ABCDE-FGH23`), sans 0, O, 1 ni I.
- Créés avec le mot de passe et le code administrateur. Montrés une seule fois, sous « Imprimez-les ou notez-les en lieu sûr ».
- Rangés en empreinte seulement, liée au compte. En créer de nouveaux annule les anciens. Le nombre restant est affiché.
- Proposés après le code reçu par SMS, tant que le Superadmin n'en a aucun (« Créer mes codes maintenant » ou « Plus tard »).
- Un ADMIN n'en a pas (403).

**2c. « J'ai perdu mon téléphone »** (dans la fenêtre du code administrateur).
- Le mot de passe et un code de secours remplacent le SMS.
- 5 échecs par 15 minutes ; ensuite, même le bon code est refusé (429). Un seul message pour un mot de passe ou un code faux.
- Le code est consommé une seule fois, sous verrou. L'appareil est reconnu.
- À chaque usage :
  - un SMS d'alerte part à l'ancien numéro ;
  - un email part, si une adresse réelle existe ;
  - le journal reçoit `ADMIN_BACKUP_CODE_USED`.
- La page « Sécurité du compte » s'ouvre ensuite (« Code de secours accepté ») pour changer son numéro. Ce changement est prouvé par un code reçu au nouveau numéro. Ses autres sessions et appareils sont révoqués ; la session en cours reste. Un SMS part à l'ancien et au nouveau numéro.
- Un ADMIN qui clique « J'ai perdu mon téléphone » lit : « Demandez au Superadmin de changer votre numéro de téléphone. »

**2d. Attaques, toutes refusées** (`f3d-telephone`) :
- usurpation : un ADMIN, même muni de users.write, un client, ou un Superadmin sans mot de passe ni code récents. Refusés, aucun SMS envoyé.
- code de secours rejoué : refusé ;
- code deviné : 5 essais faux, puis 429 même avec le bon code ;
- Superadmin qui vise un autre Superadmin, ou lui-même par Comptes : 409 ;
- ADMIN qui vise quiconque : 403 ;
- changement sans preuve du nouveau numéro :
  - code faux 5 fois : demande close ;
  - demande d'un autre Superadmin : refusée ;
  - finalisation directe en base sans code vérifié : refusée ;
- nouveau numéro déjà pris : 409, aucun SMS ;
- quotas : 429 au-delà de 3 demandes par jour pour un même compte.

### Point 3 en détail

- **Qui.** Le Superadmin seulement (un ADMIN : 403 `SUPERADMIN_ONLY`).
- **Changements permis.** Client → ADMIN, ADMIN → client, ADMIN → SUPERADMIN, SUPERADMIN → ADMIN. Client → SUPERADMIN se fait en deux temps. Une organisatrice : refusé.
- **Conditions.** Mot de passe et code administrateur. Motif obligatoire.
- **Contrôleur promu.** La confirmation de la finition 1 (« il quitte les équipes de contrôle ») s'affiche d'abord ; rien ne change avant « Confirmer ».
- **Réponse.** L'écran ne dit « fait » que si le serveur rend le rôle demandé.
- **Dernier Superadmin.** Jamais retiré : vérifié sous verrou. Deux retraits simultanés : mon test le vérifie en base, dans une transaction annulée ; `cvf3d-3` c les joue pour de vrai (verte).
- **Son propre rôle.** Seulement pour quitter le rôle de Superadmin.
- **Retrait d'un rôle.** Droits, sessions, appareils et codes de secours sont retirés.
- **Nomination d'un Superadmin.** SMS et cloche à chaque Superadmin actif, auteur compris. Journal `ADMIN_ROLE_CHANGED` avec le motif.
- **Après une promotion en ADMIN.** La grille des droits s'ouvre aussitôt.

### Point 4 en détail

**4a. Espèces rendues, marquées par un admin.**
- Qui : un admin « Gérer les remboursements » (refunds.manage, revérifié en base) ou le Superadmin. À tout moment, fiche suspendue comprise. Événement annulé seulement.
- Motif obligatoire, de 3 à 500 caractères. Journal `CASH_REFUND_MARKED` avec le rôle de l'admin et `by_admin`.
- L'organisatrice est prévenue par cloche, push et email, avec le motif.
- Le client reçoit exactement ce qu'il reçoit quand l'organisatrice marque : aujourd'hui, rien. Mesuré par instantanés de la boîte d'envoi.
- Marquer deux fois rend `ALREADY_MARKED`, sans second avis.

**4b. Page Équipe d'un admin.**
- Liste des organisatrices avec recherche (sans accents, 20 au plus, « précisez la recherche » au-delà), droit events.read. Fini « ?partnerId= » à taper.
- « Changer d'organisatrice » ramène à la liste.
- Sur la fiche admin d'un événement, le lien « Équipe de cet événement » ouvre l'onglet Équipe du pilotage.

**4c. « Valider l'écart ».**
- La route et la base le permettaient à un admin events.write depuis la finition 2a, mais l'onglet Caisse cachait la section « Écarts à valider » à **tout** admin.
- Elle s'affiche désormais pour la propriétaire, le Superadmin et un admin events.write : même règle que « Fermer cette caisse ».

## Textes nouveaux

### Écrans

**Fenêtre du code administrateur.**
- « J’ai perdu mon téléphone ».
- Superadmin :
  - consigne : « Saisissez votre mot de passe et l’un de vos codes de secours. Le code ne servira qu’une fois ; un SMS d’alerte part à votre ancien numéro. » ;
  - champs « Mot de passe » et « Code de secours » ;
  - boutons « Utiliser le code de secours » et « Retour au code par SMS ».
- Un ADMIN lit « Téléphone perdu » : « Demandez au Superadmin de changer votre numéro de téléphone. Il vous fera saisir un code reçu sur votre nouveau numéro. »
- Proposition après la double vérification :
  - titre : « Créez vos codes de secours » ;
  - texte : « Si vous perdez votre téléphone, un code de secours remplace le code reçu par SMS. Sans eux, vous ne pourrez plus ouvrir l’administration. » ;
  - boutons : « Créer mes codes maintenant », « Plus tard ».

**Page « Sécurité du compte »** (`/admin/securite`).
- Description : « Vos codes de secours et votre numéro de téléphone, pour ne jamais perdre l’accès à l’administration. »
- Codes de secours :
  - texte : « Si vous perdez votre téléphone, un code de secours remplace le code reçu par SMS pour ouvrir l’administration. Chaque code ne sert qu’une fois. » ;
  - nombre restant : « Il vous reste 7 codes sur 10, créés le … » ; sans code : « Aucun code de secours : si vous perdez votre téléphone, vous ne pourrez plus ouvrir l’administration. » ;
  - boutons : « Créer mes codes de secours », « Remplacer mes codes » (« Remplacer vos codes annule les anciens. »).
- Codes affichés :
  - « Imprimez-les ou notez-les en lieu sûr » ;
  - « Ils ne s’afficheront plus jamais. Gardez-les loin de votre téléphone. » ;
  - boutons « Imprimer » et « J’ai noté mes codes ».
- Après un code de secours :
  - titre : « Code de secours accepté » ;
  - texte : « Changez maintenant votre numéro de téléphone, plus bas : un code part au nouveau numéro. Pensez aussi à remplacer vos codes de secours. »
- Mon numéro de téléphone : « Numéro actuel : … Le code administrateur arrive à ce numéro. »
- Un ADMIN lit « Réservé au Superadmin » : « Si vous perdez votre téléphone, demandez au Superadmin de changer votre numéro : il vous dictera la marche à suivre. »

**Changement de numéro** (page Sécurité et « Changer le numéro de {nom} »).
- Sous-titre de la fenêtre : « Pour un administrateur qui a perdu son téléphone. Le nouveau numéro est prouvé par un code ; ensuite il est déconnecté de tous ses appareils. »
- Champ « Nouveau numéro (Sénégal) » ; aide : « Un code part à ce numéro : l’administrateur vous le dicte. » ou « Un code part à ce numéro pour prouver qu’il est bien le vôtre. »
- « Motif (obligatoire) ».
- Bouton « Envoyer le code au nouveau numéro ».
- Saisie du code : « Demandez à {nom} les 6 chiffres reçus au {numéro}. Le code est valable 10 minutes. » ; bouton « Valider le nouveau numéro ».
- « Numéro changé » :
  - ADMIN : « Le nouveau numéro de {nom} est enregistré. Il est déconnecté de tous ses appareils et doit se reconnecter. Un SMS est parti à l’ancien et au nouveau numéro. »
  - Superadmin : « Votre nouveau numéro est enregistré. Vos autres appareils sont déconnectés. Un SMS est parti à l’ancien et au nouveau numéro. »

**Changer le rôle.**
- Titres : « Changer le rôle de {nom} » ou « Quitter le rôle de Superadmin ».
- Effets dits pour chaque choix (`roleChangeEffect`), par exemple : « Il aura tous les droits, dont les réglages et les rôles. Chaque Superadmin reçoit un SMS d’alerte. »
- Création d'un compte : « Pour nommer un Superadmin : créez un administrateur, puis « Changer le rôle » sur sa ligne. »

**Suppléance.**
- Espèces : « Marquer rendu », fenêtre « Marquer ces espèces rendues ? » avec « Motif (obligatoire) » ; bandeau « À la place de l’organisatrice ».
- Équipe : « Choisissez l’organisatrice », « Rechercher une organisatrice », « Changer d’organisatrice », « Seules les 20 premières sont affichées : précisez la recherche. »
- Fiche d'un événement : « Équipe de cet événement ».

**Accueil.**
- « Argent qui attend : 2 versements à reprendre, 3 créances » ; variantes « aucun versement à reprendre », « aucune créance », « versements à reprendre (compteur indisponible) ».
- Bouton « Voir l’argent qui attend ».

### SMS (un segment GSM-7 chacun)

Textes exacts vérifiés par `notif-modeles` (table G3) ; alphabet et segment par `textes-sms-9bis`. Le code au nouveau numéro est un envoi synchrone, hors de ces deux tests : il a son propre garde-fou dans `f3d-ecrans`.

| Avis | Destinataire | Texte |
|---|---|---|
| `SUPERADMIN_PROMOTED` | chaque Superadmin | Event Village : Awa Ndiaye est maintenant Superadmin, nommé par Moussa Diop. Si ce n'est pas prévu, réagissez tout de suite. |
| `ADMIN_BACKUP_CODE_USED` | ancien numéro du Superadmin | Event Village : un code de secours de votre compte Superadmin vient de servir. Si ce n'est pas vous, alertez tout de suite un autre Superadmin. |
| `ADMIN_PHONE_CHANGED` (ADMIN) | ancien numéro | Event Village : le Superadmin a remplacé ce numéro sur votre compte administrateur. Ce téléphone ne sert plus pour vos codes. |
| `ADMIN_PHONE_CHANGED` (Superadmin) | ancien numéro | Event Village : le numéro de votre compte Superadmin a été remplacé. Si ce n'est pas vous, alertez tout de suite un autre Superadmin. |
| `ADMIN_PHONE_CONFIRMED` (ADMIN) | nouveau numéro | Event Village : ce numéro est maintenant celui de votre compte administrateur. Reconnectez-vous avec votre mot de passe. |
| `ADMIN_PHONE_CONFIRMED` (Superadmin) | nouveau numéro | Event Village : ce numéro est maintenant celui de votre compte Superadmin. Vos autres appareils sont déconnectés. |
| `OTP_ADMIN_PHONE` | nouveau numéro | Event Village : code {code} pour confirmer ce numéro sur un compte administrateur. Donnez-le seulement au Superadmin. Valable 10 minutes. |

### Cloche, push et emails

- **`CASH_REFUND_MARKED_BY_ADMIN`** (organisatrice : cloche, push, email).
  - Titre : « Espèces marquées rendues par l’administration ».
  - Texte : « L'administration a marqué rendues les espèces de la vente {référence} ({montant}) pour « {événement} ». Motif : {motif}. »
- **`SUPERADMIN_PROMOTED`** (cloche et email ; email ajouté après le run 306).
  - Titre : « Nouveau Superadmin ».
  - Texte : « {nom} est maintenant Superadmin, nommé par {auteur}. Si ce n’est pas prévu, réagissez tout de suite : changez son rôle depuis Comptes. »
- **`ADMIN_BACKUP_CODE_USED`** (email).
  - Objet : « Code de secours utilisé ».
  - Texte : « Un code de secours de votre compte Superadmin vient de servir pour ouvrir l’administration. Il vous en reste {n}. Si ce n’est pas vous, alertez tout de suite un autre Superadmin et créez de nouveaux codes. »
- **`ADMIN_PHONE_CONFIRMED`** (cloche et email au compte, seul email d'un changement de numéro ; ajouté après le run 306).
  - Titre : « Numéro de téléphone changé ».
  - ADMIN : « Le Superadmin a remplacé le numéro de votre compte administrateur. Les codes administrateur arrivent désormais sur ce numéro. »
  - Superadmin : « Le numéro de votre compte Superadmin a été remplacé. Vos autres appareils sont déconnectés. »

## Migrations

| Fichier | Contenu |
|---|---|
| `20261120000001_f3d_equipe.sql` | `f3d_fold` (texte sans accents ni casse) et `admin_organizers_search` (organisatrices validées ou suspendues, recherche, 20 au plus + indicateur). Lecture seule. |
| `20261120000002_f3d_especes.sql` | Type d'avis `CASH_REFUND_MARKED_BY_ADMIN` ; `event_cash_refund_mark_admin` (admin actif, refunds.manage revérifié, motif, événement annulé, marque, journal, avis, une transaction). La fonction de l'organisatrice ne change pas. |
| `20261120000003_f3d_role.sql` | `admin_identity_check` ; type `SUPERADMIN_PROMOTED` ; `user_roles_set` recopiée avec une seule garde ajoutée (SUPERADMIN seulement par `admin_role_change`) ; `admin_role_change`. |
| `20261120000004_f3d_codes_secours.sql` | Table `admin_backup_codes` (empreintes ; RLS, aucun accès hors rôle de service) ; type `ADMIN_BACKUP_CODE_USED` ; `admin_backup_codes_generate`, `admin_backup_codes_status`, `admin_backup_code_use`. |
| `20261120000005_f3d_numero_admin.sql` | Table `admin_phone_changes` (RLS, rôle de service seulement) ; types `ADMIN_PHONE_CHANGED`, `ADMIN_PHONE_CONFIRMED`, `OTP_ADMIN_PHONE` ; `notification_sync_log` recopiée (un type de plus) ; `admin_phone_change_start`, `…_verify`, `…_finalize`. |

Toutes les fonctions sont en SECURITY DEFINER, avec un `search_path` fixé, et seul le rôle de service peut les exécuter (`r3-fonctions-rpc` : les 11 fonctions de la finition ; `notification_sync_log` et `user_roles_set` déjà sous ce garde-fou). Chaque migration est appliquée deux fois de plus sans erreur (`migration-finition3d-rejouable`).

**Ordre avec les branches en cours.** Depuis le début de la 3d, main a reçu la finition 2b (`1a4348cac`) puis la déconnexion (`bbed17fb0`). Ce qu'il faut savoir :
- **Migrations.** Les dernières de main sont les `20261119000001` à `…08` de la 2b. Les miennes (`20261120…`) passent après : **aucune renumérotation**.
- **Fonctions recopiées.** Ni la 2b ni la déconnexion ne redéfinissent `user_roles_set` ou `notification_sync_log`, que je recopie.
- **Essai de fusion** (`git merge-tree`, sans rien écrire), entre ma branche à `449bd09c0` et main à `bbed17fb0`. **Un seul conflit**, dans `.github/workflows/verify.yml` : ma limite à 120 min. Fusion automatique pour `catalog.ts`, `AdminStepUpGate.tsx` (la déconnexion change la ligne « Se déconnecter », que je n'ai pas touchée), `app/admin/events/[id]/page.tsx`, `screens.ts`, `design-files.ts` et `r3-fonctions-rpc`.
- **Branche `ci/parallele`** (autre session). Elle récrit `verify.yml` en jobs parallèles. Si elle arrive dans main avant la 3d, garder sa version et abandonner mon commit `449bd09c0`.

## Contrôles avant et après (event-village-dev, lecture seule)

```sql
-- Avant
-- A. Dernière migration appliquée : 20261118000003 (finition 3b), ou la dernière de la 2b si elle est appliquée avant
select max(version) from supabase_migrations.schema_migrations;
-- B. Rien de la finition : 0 ligne
select proname from pg_proc where pronamespace = 'public'::regnamespace
   and proname in ('f3d_fold', 'admin_organizers_search', 'event_cash_refund_mark_admin', 'admin_identity_check', 'admin_role_change',
                   'admin_backup_codes_generate', 'admin_backup_codes_status', 'admin_backup_code_use',
                   'admin_phone_change_start', 'admin_phone_change_verify', 'admin_phone_change_finalize');
select to_regclass('public.admin_backup_codes') as codes, to_regclass('public.admin_phone_changes') as numeros;  -- null, null
-- C. Superadmins actifs (à noter, doit rester identique)
select count(*) from public.user_roles ur join public.users u on u.id = ur.user_id where ur.role = 'SUPERADMIN' and u.status = 'ACTIF';

-- Après
-- A. Cinq versions 20261120000001 à …05
select version from supabase_migrations.schema_migrations where version like '20261120%' order by 1;
-- B. Onze fonctions réservées au rôle de service : anon false, authenticated false, service_role true
select p.proname, has_function_privilege('anon', p.oid, 'execute') as anon,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated,
       has_function_privilege('service_role', p.oid, 'execute') as service_role
  from pg_proc p where p.pronamespace = 'public'::regnamespace
   and p.proname in ('f3d_fold', 'admin_organizers_search', 'event_cash_refund_mark_admin', 'admin_identity_check', 'admin_role_change',
                     'admin_backup_codes_generate', 'admin_backup_codes_status', 'admin_backup_code_use',
                     'admin_phone_change_start', 'admin_phone_change_verify', 'admin_phone_change_finalize')
 order by 1;
-- C. Deux tables, RLS active, aucun droit pour anon et authenticated : t, f, f (deux lignes)
select c.relname, c.relrowsecurity, has_table_privilege('anon', c.oid, 'select') as anon, has_table_privilege('authenticated', c.oid, 'select') as authenticated
  from pg_class c where c.oid in ('public.admin_backup_codes'::regclass, 'public.admin_phone_changes'::regclass);
-- D. Six types d'avis
select type, channels from public.notification_types
 where type in ('CASH_REFUND_MARKED_BY_ADMIN', 'SUPERADMIN_PROMOTED', 'ADMIN_BACKUP_CODE_USED', 'ADMIN_PHONE_CHANGED', 'ADMIN_PHONE_CONFIRMED', 'OTP_ADMIN_PHONE')
 order by 1;
-- E. Garde du rôle SUPERADMIN présente dans user_roles_set : true
select prosrc like '%ROLE_SCREEN_REQUIRED%' from pg_proc where proname = 'user_roles_set' and pronamespace = 'public'::regnamespace;
-- F. Superadmins actifs : même nombre qu'avant (requête C d'avant)
-- G. Aucun code de secours ni changement de numéro avant tout usage : 0, 0
select (select count(*) from public.admin_backup_codes), (select count(*) from public.admin_phone_changes);
```

**H. Invariant (i1)** : lancer la requête `I1_SQL` de `tests/helpers/finition3d-invariants.ts`. Elle doit rendre 0 ligne ; elle lit tout et n'écrit rien. Puis `03-verification.sql`.

## Runs

Résultats sur la branche `origin/ci-results`, dossier `runs/<numéro>-<identifiant>/`. Les runs « rapides » ne lancent que les suites nommées dans le commit ; le run complet lance tout (suites, e2e, captures, recette, budgets JS).

| Run | Commit | Mode | Résultat | Ce qu'il montre |
|---|---|---|---|---|
| 288 | `04b6ee5ac` | rapide | rouge voulu, 0/1 | point 1 : inventaire des routes, F1 à F3 |
| 289 | `8985acba6` | rapide | 57/59 | point 1 vert avec les 31 suites d'audit ; F4 trouvée (`signed-url`), trois fichiers d'écran non déclarés |
| 290 | `8f920c5e5` | rapide | vert, 6/6 | F4 corrigée |
| 291 | `bdd715727` | rapide | rouge voulu, 0/2 | points 5 et 4b |
| 292 | `21c3292dd` | rapide | 19/21 | 5 et 4b verts ; rouge voulu du 4c ; `evenements-fin-valide` (temps réel, sans lien) |
| 293 | `fb3b6f804` | rapide | 2/3 | 4c vert ; rouge voulu du 4a |
| 294 | `ad4554975` | rapide | 22/25 | 4a : mon test de parité mal fenêtré, table G2 incomplète |
| 296 | `7dbc9b5ab` | rapide | vert, 4/4 | 4a vert |
| 297 | `b2df93b70` | rapide | rouge voulu, 0/1 | point 3, F5 |
| 299 | `fc8a3f102` | rapide | 63/66 | point 3 vert avec les 31 suites d'audit ; un SMS terminé par « .. », table G3, auteur attendu dans `cvf1c-t1-promotion` |
| 301 | `c4a71bf84` | rapide | 4/5 | `cvf1c-t1-promotion` : attente du verrou sur le mauvais nom de fonction |
| 302 | `9329fd21c` | rapide | vert, 2/2 | point 3 vert |
| 304 | `14b4c7764` | rapide | rouge voulu, 0/4 | point 2 : routes, fonctions, migrations et écrans absents |
| 305 | `77b0f39c6` | rapide | vert, 46/46 | point 2 vert, avec les 31 suites d'audit, `f3b-securite` (inventaire de `/api/admin` : les nouvelles routes refusent un ADMIN sans droit), `f3d-role`, `f3d-securite` et les suites de l'étape de sécurité |
| 306 | `479cb42e3` | complet | **coupé à 90 min** (limite du job), 452/455, captures 24/28 | voir « Erreurs » 8 à 10 ; la recette e2e allait finir (actes 8 et 9 passés) ; captures de la 3d vertes sauf `admin-especes-rendues` |
| 311 | `4e5b741e9` | rapide | 14/15 | corrections du run 306 vertes (`email-regle-envoi`, canaux G2, `f3d-telephone`, captures) ; `notif-migration` : contrôle E7 limité à app/ (voir « Erreurs » 11) |
| 313 | `53b33a099` | rapide | vert, 2/2 | contrôle E7 étendu |
| 319 | `449bd09c0` | complet | **454/455**, e2e vert (561 captures, recette 10/10), budgets tenus ; 107 min | seul rouge : `notif-envoyeur`, fragilité connue (ci-dessous) ; 31 suites d'audit et suites `f3d-…` vertes ; invariants à 0 |

Les runs 295, 298, 300, 303, 307 et 312 appartiennent à d'autres sessions.

**Limite du job : 90 → 120 minutes — abandonnée** : main a fusionné `ci/parallele` (jobs parallèles) ; le commit est annulé (`b096bcec5`). Texte d'origine : commit à part ( `.github/workflows/verify.yml`), décidée après le run 306. Les runs complets 300 (autre session) et 306 ont été coupés à 90 minutes en fin de recette. L'étape verify a pris 3 034 s, contre 2 612 au run 281. Le CI est plus lent : les suites de migrations rejouables passent de 7 à 20 s chacune. Les 6 suites de la 3d ajoutent environ 45 s. Le découpage en jobs parallèles est noté dans `docs/apres-lancement.md`.

Une autre session le prépare déjà sur `ci/parallele` (`acde155e8`) : `verify.yml` y est récrit en jobs de 60 minutes au plus. **Si `ci/parallele` est fusionnée avant la 3d, abandonner mon commit de limite à 120 min** : il entrerait en conflit et n'aurait plus d'objet.

**`notif-envoyeur`, runs 306 et 319.** « la ligne due est envoyée une fois par la route » : même échec qu'aux runs 252 et 274, déjà noté dans `docs/apres-lancement.md` (file des avis laissée par les suites précédentes). **Corrigé depuis** : la 3d n'y touche pas dans le code, mais ses suites laissent une quinzaine de Superadmins actifs, qui grossissent la file. La cause et le correctif de main (2b) sont dans « Correctifs de la contre-vérification » ; la suite est verte aux runs 343, 346 et 347.

**Conséquence (run 319).** 454 suites sur 455. Remplacé par le run complet final, en tête du rapport.

**Run 292, échec sans lien.** `evenements-fin-valide` (diffusion Supabase Realtime, 20 s dépassées) : même fragilité qu'aux runs 43 à 130 et 279, déjà notée dans `docs/apres-lancement.md`. Ce chemin n'est pas touché par la 3d.

**Budgets JS** (gzip, run 319), aucun relevé : « / » 225 503 octets (budget 226 342) ; « /events/[id] » 232 129 (233 316) ; « /tickets » 248 835 (250 417) ; « /controller/scanner » 232 988 (234 911) ; « /billet/hors-ligne » 221 054 (224 268).

## Captures

Sept écrans, 28 images, dans `runs/319-44127638161/captures/` : `<écran>__mobile__clair.png`, `__mobile__sombre.png`, `__ordinateur__clair.png`, `__ordinateur__sombre.png`. Mobile : 390 px ; ordinateur : 1440 px. Chaque image passe les contrôles bloquants : cibles de 44 px, textes de 14 px au moins, accessibilité (axe), aucun code brut. Réponses imposées : aucune écriture réelle.

| Écran | Ce qu'il montre | Vues |
|---|---|---|
| `admin-securite` | « Sécurité du compte » : « Il vous reste 7 codes sur 10 », son numéro | 4 |
| `admin-codes-de-secours` | 10 codes montrés une fois, « Imprimez-les ou notez-les en lieu sûr » | 4 |
| `admin-numero-apres-secours` | « Code de secours accepté », puis code envoyé au nouveau numéro | 4 |
| `admin-telephone-perdu` | fenêtre du code administrateur, « J’ai perdu mon téléphone » ouvert | 4 |
| `admin-equipe-organisatrices` | page Équipe d'un admin, liste des organisatrices avec recherche | 4 |
| `admin-especes-rendues` | événement annulé, « Marquer rendu » et motif (non confirmé) | 4 |
| `admin-ecart-a-valider` | onglet Caisse, « Écarts à valider » et « Valider l’écart » pour un admin | 4 |

Point 5 : la ligne unique de l'argent apparaît dans la capture existante `admin-accueil-a-faire`.

Pas de capture de « Changer le rôle » ni de « Changer le numéro » : ces fenêtres s'ouvrent sur la liste remplie de `/admin/users`, qui n'est pas sur le système de design (badges de 10 px, noms de 12 px) et ne passe pas les contrôles bloquants. Le changement de numéro est le même composant que celui de `admin-numero-apres-secours`. Les deux boutons sont prouvés par `f3d-ecrans`.

## Tests existants modifiés (signalés)

Aucune assertion de sécurité n'est affaiblie. Chaque modification suit un chemin que la consigne ferme ou ajoute.

| Test | Modification | Pourquoi |
|---|---|---|
| `tests/parcours/cvf1c-t1-promotion.test.ts` | Promotion par « Changer le rôle » (mot de passe, code, motif) avec un Superadmin neuf de la suite, au lieu du PATCH avec le Superadmin du seed ; auteur attendu = ce Superadmin ; attente du verrou sur `admin_role_change`. | Le PATCH ne donne plus le rôle ADMIN (F5). Mêmes assertions sur l'effet (affectations, invitations, caisse ouverte). |
| `tests/parcours/dette-roles-otp.test.ts` | Cas « contrôleur à caisse ouverte » joué par « Changer le rôle » (409 `CONTROLLER_HAS_OPEN_SHIFT` gardé) ; le PATCH est vérifié refusé (409 `ROLE_SCREEN_REQUIRED`). | Même raison. Un refus de plus est vérifié. |
| `tests/parcours/droits-admin-9bis.test.ts` | Témoin R71 : promotion et rétrogradation par « Changer le rôle » ; PATCH refusé vérifié. | Même raison. |
| `tests/parcours/notif-modeles.test.ts` | Table G2 : 6 types ajoutés ; table G3 : 6 textes SMS exacts ajoutés. | Nouveaux avis. Aucune ligne existante changée. |
| `tests/parcours/notif-migration.test.ts` | `lib/admin/phone-change.ts` ajouté à la liste nominative des envois synchrones (`sendOtp` seul) ; contrôle E7 (journal `log:`) étendu aux fichiers de cette liste hors de app/. | Code au nouveau numéro d'un administrateur, envoyé comme les autres codes, avec journal. |
| `tests/parcours/notif-outbox.test.ts` | Table G2 : 6 types ajoutés. | Nouveaux avis. |
| `tests/schema/f3b-ecrans.test.ts` | Menu du Superadmin : `/admin/securite` ajouté en fin de liste. | Nouvelle page « Sécurité du compte ». Les menus d'un ADMIN sont inchangés. |
| `tests/helpers/design-files.ts` | 9 fichiers d'écran déclarés : `AdminAccountStepUp`, mises en page du scanner et du profil contrôleur, `OrganizerPicker`, `IdentityConfirm`, `RoleChangeDialog`, page Sécurité, `BackupCodesPanel`, `PhoneChangeFlow`. | Garde-fou du système de design : chaque nouveau fichier y passe. |
| `tests/security/r3-fonctions-rpc.test.ts` | Bloc « finition 3d » ajouté : 11 fonctions. | Garde-fou : réservées au rôle de service. |

`e2e/support/screens.ts` : 7 écrans ajoutés, aucun existant changé.

Nouveau garde-fou, vert dès l'écriture (`be41abb82`) : texte, alphabet et segment du SMS `OTP_ADMIN_PHONE` (`f3d-ecrans`).

## Décisions prises, à relire

1. **Codes de secours proposés tant qu'il n'y en a aucun.** Je propose les codes après chaque code SMS réussi tant que le Superadmin n'en a aucun valable, pas seulement à la toute première double vérification. « Plus tard » ferme la fenêtre.
2. **Codes de secours : 10 caractères de 32 signes**, soit 50 bits. Les signes ambigus 0, O, 1 et I sont exclus. Majuscules ou minuscules, avec ou sans tiret ni espace : la saisie est normalisée.
3. **Un seul message** pour un mot de passe faux et pour un code de secours faux : on ne révèle pas lequel des deux est juste.
4. **Changement de son propre numéro par le Superadmin.** Il passe par la page « Sécurité du compte », avec la preuve du nouveau numéro. Il marche aussi sans code de secours, avec le code SMS habituel, s'il a encore son téléphone. L'avis à l'ancien numéro ne dit donc pas « après un code de secours ».
5. **Alerte de nomination.** Elle part à chaque Superadmin actif, auteur compris (trace sur son propre téléphone), jamais au promu.
6. **4a, ce que reçoit le client.** Exactement ce qu'il reçoit quand l'organisatrice marque ; aujourd'hui, aucun message. La consigne demande « le même avis » : je n'en ai pas inventé un.
7. **4c.** La consigne disait « vérifie, sinon ajoute » : le bouton manquait pour tout admin. Je l'ai ajouté, avec la même règle que « Fermer cette caisse ».

## Erreurs de ma part, trouvées et corrigées

1. **Run 289.** Les trois nouveaux fichiers d'écran du point 1 n'étaient pas déclarés au système de design ; corrigé (`8f920c5e5`). Le même run a montré F4, qui n'est pas une erreur de ma part mais une faille ancienne.
2. **Run 291.** Mon premier test du 4c était mal borné : il cherchait le bouton près d'une garde qui n'existait pas. La vraie cause est plus simple : la section était cachée à tout admin. J'ai réécrit le test, rouge (run 292), puis corrigé l'écran (run 293).
3. **Run 294.** Mon test de parité des avis au client comptait, dans une fenêtre d'une seconde, les avis de l'annulation faite juste avant. Je le mesure désormais par instantanés de la boîte d'envoi. Le type `CASH_REFUND_MARKED_BY_ADMIN` manquait aussi aux tables G2.
4. **Run 299.**
   - SMS `SUPERADMIN_PROMOTED` : un nom tronqué suivi d'un point donnait « .. » ; j'utilise désormais `endWithPeriod`.
   - Texte absent de la table G3.
   - `cvf1c-t1-promotion` attendait l'ancien auteur.
5. **Run 301.** `cvf1c-t1-promotion` attendait le verrou sous le nom `user_roles_set`, alors que la promotion passe par `admin_role_change`. Le test patientait 8 s pour rien et la requête dépassait son délai (57014).
6. **Avant la poussée du point 2** (non poussé, corrigé dans le commit) :
   - l'avis à l'ancien numéro et la cloche disaient « remplacé après un code de secours » ;
   - c'est faux quand le Superadmin change son numéro avec son code SMS habituel ;
   - le texte dit désormais seulement « a été remplacé ».
7. **Relecture du rapport.** Le code envoyé au nouveau numéro (`OTP_ADMIN_PHONE`) n'était couvert par aucun test du segment GSM-7 : la liste des envois synchrones de `textes-sms-9bis` est fixe. J'ai ajouté le garde-fou dans `f3d-ecrans` ; il est vert dès l'écriture.
8. **Run 306, règle G.49.** Tout avis indispensable non synchrone doit aussi partir par email (`email-regle-envoi`). `SUPERADMIN_PROMOTED` et `ADMIN_PHONE_CONFIRMED` partent maintenant aussi par email, à l'adresse vérifiée. `ADMIN_PHONE_CHANGED` déclare l'email, mais sa ligne à l'ancien numéro reste SMS seul, comme `PHONE_CHANGED`. Le compte reçoit un seul email par changement ; c'est prouvé dans `f3d-telephone` (`33a3f3146`).
9. **Run 306, liste blanche.** Mon envoi direct du code (`mTargetService.sendOtp`) dans `lib/admin/phone-change.ts` n'était pas dans la liste nominative de `notif-migration`. Je l'y ai ajouté : `sendOtp` seul, avec le journal `log:`.
10. **Run 306, accessibilité.** Le bouton « Marquer rendu » avait pour nom accessible « Marquer rendues les espèces… » : le texte visible n'y figurait pas tel quel (WCAG 2.5.3, axe `label-content-name-mismatch`). C'est la capture `admin-especes-rendues` qui l'a bloqué, dans ses 4 vues. Il s'appelle maintenant « Marquer rendu : espèces de la vente … » (`4e5b741e9`).
11. **Run 311.** En ajoutant `lib/admin/phone-change.ts` à la liste nominative, j'ai fait tomber le contrôle E7 de `notif-migration`. Il compte les appels `.sendOtp(` de app/ et en exige au moins autant que d'entrées dans la liste : 8 pour 9. Le contrôle lit désormais app/ et les fichiers de la liste hors de app/ ; mon envoi est donc vérifié lui aussi (journal `log:`).

## Essais pour un non-développeur

À faire sur event-village-dev après la fusion et l'application des migrations. Prévoir un compte Superadmin, un compte ADMIN et deux téléphones.

1. **Inactivité (point 1).** Connecté en admin, ouvrez la page Équipe ou le pilotage d'un événement. Ne touchez à rien pendant 31 minutes, puis cliquez : le mot de passe est redemandé, et la page reste dessous.
2. **Codes de secours (2b).**
   - Superadmin, menu « Sécurité du compte », « Créer mes codes de secours » ; mot de passe et code SMS.
   - Les 10 codes s'affichent une fois ; notez-en deux.
   - Rechargez la page : les codes ne s'affichent plus, « Il vous reste 10 codes sur 10 ».
3. **Téléphone perdu (2c).**
   - Dans une fenêtre privée, connectez-vous en Superadmin. Dans la fenêtre du code, cliquez « J’ai perdu mon téléphone », puis saisissez le mot de passe et un code noté.
   - La page « Sécurité du compte » s'ouvre. L'ancien téléphone reçoit un SMS d'alerte, et un email part si l'adresse est réelle.
   - Recommencez avec le même code : refusé.
4. **Son propre numéro (2c).** Sur cette page, saisissez un nouveau numéro. Le code arrive sur le nouveau téléphone ; validez. Les deux téléphones reçoivent un SMS, et l'autre navigateur est déconnecté.
5. **Numéro d'un ADMIN (2a).**
   - Comptes, ligne de l'ADMIN, « Changer le numéro » ; saisissez un motif.
   - L'ADMIN lit le code sur son nouveau téléphone et vous le dicte.
   - Après validation, il est déconnecté partout ; ses deux numéros reçoivent un SMS.
6. **Attaques simples (2d).**
   - Sur la ligne d'un Superadmin, ou sur la vôtre, il n'y a pas de bouton « Changer le numéro ».
   - Un ADMIN qui clique « J’ai perdu mon téléphone » lit qu'il doit s'adresser au Superadmin.
   - Cinq codes de secours faux : « Trop d’essais ».
7. **Changer le rôle (3).**
   - Comptes, ligne d'un ADMIN, « Changer le rôle », « Superadmin », motif, mot de passe et code : chaque Superadmin reçoit un SMS.
   - Seul Superadmin, essayez « Quitter le rôle de Superadmin » : refusé.
8. **Espèces (4a).** Sur un événement annulé qui a des ventes au guichet, en admin « Gérer les remboursements » : « Marquer rendu », puis un motif. L'organisatrice reçoit la cloche et l'email avec le motif ; l'acheteur ne reçoit rien.
9. **Équipe (4b).** En admin, ouvrez la page Équipe : la liste des organisatrices s'affiche, avec recherche. Sur la fiche d'un événement, « Équipe de cet événement » ouvre l'onglet Équipe.
10. **Écart (4c).** En admin « Gérer les événements », ouvrez l'onglet Caisse d'un événement dont une caisse a un écart non validé : « Valider l’écart » est là.
11. **Accueil (5).** « À faire aujourd'hui » n'a plus qu'une ligne pour l'argent. « Voir l’argent qui attend » descend au bloc détaillé.

## À faire de ton côté

1. Relire ce rapport et la section « Correctifs de la contre-vérification », puis décider de la fusion (main déjà fusionnée dans la branche).
2. Décider pour la lecture REST de l'administration (+60 à +71 % sur 1 000 lignes, environ +0,3 s) : la garder, ou écrire les règles avec `(select is_superadmin())`.
3. Après la fusion : `migration list`, puis `db push --dry-run`. On doit voir exactement les 9 migrations `20261120…` ; ensuite les contrôles ci-dessus (ceux des points et ceux de la contre-vérification).
4. Chaque Superadmin réel crée ses codes de secours dès la mise en ligne (page « Sécurité du compte »).
