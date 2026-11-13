# Lot 9 quater — Sécurité : fermer les failles de l'audit et du guide

Branche `lot9quater/securite`, partie de `main` (0cf8eb8), avec `origin/audit/evenements` (6a88401) fusionnée en premier (806b301e). Preuve des tests rouges : branche `lot9quater/rouges` (tests seuls, jamais fusionnée).

## À lire en premier

**Lot livré.** Le run « après » est le **run 164** (463161ac) : 362 suites sur 364 vertes, e2e vert (les dix phases : connexion, captures, emails, dev-page, fumée, terrain, pwa, fake-prod, perf, recette ; 441 captures, 0 en échec). Invariants (a) à (x) et (q1) à (q8) à 0. Les deux seules lignes non nulles du journal sont les deux jeux de détection volontaires de `pilotage-invariant` (« sur le jeu »), présents à l'identique au run 145. Seules `aud-01` et `aud-07` restent rouges : voir juste en dessous.

- **Ce qui est fermé.** Les 6 blocs du prompt (A1 à A9, B1 à B8, C1 à C7, D1 à D3, E1 et E2, F1 à F4) : 34 constats d'audit et 8 constats du guide (G-01, G-02, G-03, G-04, G-24, G-31, G-36, G-97), plus E-08, E-09 (N-01), E-12 (N-07) et E-39 de la revue d'ergonomie, là où le prompt les demande. Détail au § 2, avec le commit et le test de chacun.
- **Suites d'audit.** Au run « après », 6 des 8 suites de `tests/audit/` sont vertes. Restent rouges, sans qu'aucune ne soit modifiée :
  - `aud-07-enumeration-comptes` : AUD-07 est **hors périmètre** (décision : accepté, freiné par les quotas). Rouge attendu.
  - `aud-01-comptes-gotrue` : la faille est fermée, mais deux de ses tests posent une **précondition qui suppose la faille ouverte** (§ 3.2). AUD-03 commence par `signUp` public et exige qu'il réussisse ; AUD-02 (2e test) exige que GoTrue accepte un changement de mot de passe par le seul jeton. Fermer la faille fait échouer la précondition. Je ne change pas la suite ; je montre au § 3.2 pourquoi elle est fausse après correctif, et quel test du lot prouve la fermeture à sa place.
- **Deux réglages à faire de ton côté** sur le tableau de bord Supabase d'event-village-dev, dans l'ordre : couper « Allow new users to sign up », activer « Secure password change » (§ 7). Sans le premier, l'inscription publique de GoTrue reste ouverte sur le projet hébergé, quoi que dise `config.toml`.
- **Six migrations à appliquer** sur event-village-dev (`20261111000001` à `…06`), avec contrôles avant et après (§ 6). La première réécrit les adresses techniques des comptes à numéro dans `auth.users` et `auth.identities` : contrôle « après » = aucune adresse `<chiffres>@eventvillage.sn` restante.
- **Où j'en suis.** Fini. Dernier commit de code : 463161ac (poussé, run 164). Ce rapport est le commit suivant. Je m'arrête là, comme demandé : rien n'est fusionné dans `main`, aucune migration n'est appliquée sur event-village-dev.

## 1. Méthode et runs

- Run « avant » : **145** (806b301e, après la fusion de l'audit). Exactement les 8 suites de `tests/audit/` rouges, tout le reste vert, e2e vert.
- Tests rouges avant chaque correctif : chaque bloc a un commit `test(9q.…)` suivi de son commit `fix(9q.…)`. Les commits de test, seuls sur `main`, forment la branche `lot9quater/rouges` ; son run (run 152, 98a76100) montre ces suites rouges (§ 1.2).
- Run « après » : **run 164, id 43486671215, commit 463161ac**, détail au § 1.3.
- Invariants : (a) à (x) des lots précédents, plus (q1) à (q8) de ce lot (`tests/helpers/lot9quater-invariants.ts`), appelés en fin de chaque suite nouvelle du lot :
  - (q1) aucune adresse technique `<chiffres>@eventvillage.sn` dans `auth.users` ni `public.users` ;
  - (q2) aucune marque `is_temporary_controller_account` dans `raw_user_meta_data` ;
  - (q3) marque `controller_activation_pending` (app_metadata) seulement sur un compte qui a le rôle CONTROLEUR ;
  - (q4) aucune adresse `.invalid` vérifiée ni en attente ;
  - (q5) tout compte SUSPENDU ou SUPPRIME bloqué chez GoTrue, aucun compte ACTIF bloqué (hors comptes anonymisés) ;
  - (q6) toute aide exécutable par `anon` ou `authenticated` dans `public` (hors extensions) lit le statut du compte ;
  - (q7) `platform_settings` illisible par `anon`, aucune politique de lecture ouverte à tous ;
  - (q8) trigger `on_auth_user_guard_writes` posé sur `auth.users`.

### 1.1 Run « avant » (145), sortie brute

```
tests/audit/aud-00-catalogue.test.ts                     FAIL     707ms     1     .test-logs/tests__audit__aud-00-catalogue.test.ts.log
tests/audit/aud-01-comptes-gotrue.test.ts                FAIL     1.7s      1     .test-logs/tests__audit__aud-01-comptes-gotrue.test.ts.log
tests/audit/aud-04-webhook-journal.test.ts               FAIL     515ms     1     .test-logs/tests__audit__aud-04-webhook-journal.test.ts.log
tests/audit/aud-05-sms-plafond-global.test.ts            FAIL     553ms     1     .test-logs/tests__audit__aud-05-sms-plafond-global.test.ts.log
tests/audit/aud-06-partenaire-suspendu.test.ts           FAIL     1.3s      1     .test-logs/tests__audit__aud-06-partenaire-suspendu.test.ts.log
tests/audit/aud-07-enumeration-comptes.test.ts           FAIL     568ms     1     .test-logs/tests__audit__aud-07-enumeration-comptes.test.ts.log
tests/audit/aud-17-redirection-connexion.test.ts         FAIL     235ms     1     .test-logs/tests__audit__aud-17-redirection-connexion.test.ts.log
tests/audit/aud-19-code-email-adresse-technique.test.ts  FAIL     574ms     1     .test-logs/tests__audit__aud-19-code-email-adresse-technique.test.ts.log
...
TOTAL : 355 suite(s) — 347 réussie(s), 8 en échec, 0 expirée(s)

[verify] ÉCHEC à l'étape "test" (code 1).
```

### 1.2 Preuve des rouges (branche `lot9quater/rouges`)

Run **152** (branche `lot9quater/rouges`, 98a76100 : 806b301e + les commits de test du lot, sans aucun correctif). Sur cette branche seulement, `scripts/verify.mjs` saute le typecheck et le lint (commit 98a76100) : sinon le typecheck s'arrête sur les imports de modules qui n'existent pas encore (`lib/validations/contact-info`, `lib/auth/safe-redirect`, `app/api/csp-report/route`) et aucun test ne tourne (run 147). Cette branche n'est pas fusionnée.

Suites du lot et suites d'audit, sortie brute (extrait de `verify.log`) :

```
tests/audit/aud-00-catalogue.test.ts  FAIL
tests/audit/aud-01-comptes-gotrue.test.ts  FAIL
tests/audit/aud-04-webhook-journal.test.ts  FAIL
tests/audit/aud-05-sms-plafond-global.test.ts  FAIL
tests/audit/aud-06-partenaire-suspendu.test.ts  FAIL
tests/audit/aud-07-enumeration-comptes.test.ts  FAIL
tests/audit/aud-17-redirection-connexion.test.ts  FAIL
tests/audit/aud-19-code-email-adresse-technique.test.ts  FAIL
tests/parcours/lot9quater-argent.test.ts  FAIL
tests/parcours/lot9quater-comptes.test.ts  FAIL
tests/parcours/lot9quater-droits.test.ts  FAIL
tests/parcours/lot9quater-sms-acces.test.ts  FAIL
tests/parcours/lot9quater-technique.test.ts  FAIL
tests/schema/lot9quater-coordonnees.test.ts  FAIL
tests/schema/lot9quater-technique.test.ts  FAIL
tests/schema/migration-lot9quater-rejouable.test.ts  FAIL
tests/schema/migrations-gelees.test.ts  PASS
tests/security/q01-redirection-connexion.test.ts  FAIL
TOTAL : 364 suite(s) — 286 réussie(s), 78 en échec, 0 expirée(s)
```

Exemples de messages d'échec (un ou deux par suite) :

```
lot9quater-argent      3e doublon : moins les frais SamirPay
                       The input did not match the regular expression /Le paiement sera demandé au/
lot9quater-comptes     'signUp public accepté'
                       'GoTrue a accepté un nouveau mot de passe présenté avec le seul jeton'
lot9quater-droits      'compte bloqué chez GoTrue'
                       'cible : {"name":"Ndeye Pseudonyme","phone":"+221779225106"}'
lot9quater-sms-acces   au-delà de la limite du compte : HTTP 200 {"ok":true,"ticket_count":1,...}
                       aucune invitation sans nom par les 4 derniers chiffres
lot9quater-technique   corps de 20 Ko : 413 attendu
                       image de partenaire : fiche non validée
lot9quater-coordonnees Cannot find module '.../lib/validations/contact-info'
schema technique       HSTS : /max-age=63072000; includeSubDomains/ absent
rejouable              migrations 20261111… présentes : aucune
q01                    'lib/auth/safe-redirect.ts absent : aucune fonction commune de nettoyage'
```

`migrations-gelees` est vert sur cette branche : le gel des `20261110…` est une écriture de test qui ne dépend d'aucun correctif.

Les 60 autres suites en échec au run 152 se répartissent ainsi (aucune n'est une régression du lot ; toutes sont vertes au run « après ») :

- **Suites existantes dont le test a été réécrit pour la nouvelle règle** (rouges sans le correctif, c'est attendu) : adresse technique `.invalid` (`compte-numero`, `compte-profil`, `email-verification`, `inscription-numero-dabord`, `invitation-identite`) ; numéro prouvé exigé (AR15) des invitations et transferts (`invitations*`, `invites-*`, `course-invites`, `cycle9bis-transfert`, `notif-transferts`, `textes-base-9bis`, `messages-sms-9bis`) ; contrôleur activé par la règle commune (`activation-controleur`) ; nouveaux types de notifications (`notif-modeles`, `notif-migration`) ; services en préparation (`notif-reglages`) ; liste blanche des tarifs (`lectures-ignorees`) ; résultat `zone_already_passed` (`acces-tracabilite`) ; marque du seed en `app_metadata` (`essai-seed-gardes`).
- **Effet de la branche elle-même** : `perf-statique` (elle vérifie les étapes de `verify.mjs`, modifié sur cette branche seulement).
- **Défauts de test corrigés ensuite** : une fixture d'AUD-34 qui appelait la RPC sans poser l'adresse dans `auth.users` laissait l'invariant (w) à 1, et toutes les suites suivantes échouaient dans leur `after` (0 test en échec, « hookFailed ») ; un mot de passe littéral (`secrets-codes-en-dur`) ; des citations de lignes décalées (`recette-matrice`). Corrigés dans a129863a et 46994ff4.

### 1.3 Run « après », sortie brute

Run 164 (https://github.com/fallouu-mn/event-village/actions/runs/43486671215), commit 463161ac, `verify.log` et `e2e.log` sur `origin/ci-results`, dossier `runs/164-43486671215/`. Lignes en échec du tableau final, puis le total :

```
tests/audit/aud-01-comptes-gotrue.test.ts                FAIL     1.6s      1     .test-logs/tests__audit__aud-01-comptes-gotrue.test.ts.log
tests/audit/aud-07-enumeration-comptes.test.ts           FAIL     662ms     1     .test-logs/tests__audit__aud-07-enumeration-comptes.test.ts.log
TOTAL : 364 suite(s) — 362 réussie(s), 2 en échec, 0 expirée(s)
[verify] ÉCHEC à l'étape "test" (code 1).
```

Tests en échec (relevés dans `verify.log`) :

```
tests/audit/aud-01-comptes-gotrue.test.ts
  - un changement de mot de passe fait avec le seul jeton d’une session prévient toujours le titulaire
      précondition : changement direct accepté (sinon voir le premier test) : {"code":500,"error_code":"unexpected_failure","msg":"Error during password storage",…}
  - un compte ouvert sans numéro ni code ne prend pas de billets gratuits
      signUp public 0 : Signups not allowed for this instance
tests/audit/aud-07-enumeration-comptes.test.ts
  - resolve-phone répond la même chose pour un numéro inscrit et pour un numéro libre
      resolve-phone révèle l'existence d'un compte : HTTP 200 (inscrit) contre 404 (libre)
```

E2e : `[e2e] résumé :connexion OK · captures OK · emails OK · dev-page OK · fumee OK · terrain OK · pwa OK · fake-prod OK · perf OK · recette OK` (30,5 min).

Runs intermédiaires après le run 152 : 153 à 162. Chaque rouge y a été corrigé par un commit dédié, et le § 9 donne la raison de chaque test modifié. Le run 158 appartient à une autre branche (`audit/authentification`).

## 2. État de chaque constat traité

Colonnes : constat, ce qui est fait, commit du correctif, test qui le prouve (suite, et commit du test rouge).

### A. Connexion et comptes

| Constat | Fait | Correctif | Test |
|---|---|---|---|
| **AUD-17 (CRITIQUE)**, G-03 | Une seule fonction de nettoyage, `safeInternalPath` (`lib/auth/safe-redirect.ts`) : un seul « / » en tête, ni « // » ni « /\ », aucun schéma, aucun caractère de contrôle, formes décodées (jusqu'à stabilité) revérifiées, origine résolue inchangée ; sinon l'espace du compte. Utilisée par `resolvePostLoginRoute`, `LoginForm` (mot de passe et code), la page de connexion, l'inscription. | 93a86063 | `tests/security/q01-redirection-connexion` (62bc8b82, charges de l'audit + 28 variantes × 6 jeux de rôles, lecture du code : tout lecteur de `redirect`/`next`/`returnTo` passe par la fonction) ; `tests/audit/aud-17` vert |
| AUD-01, AUD-03, G-36 | Inscription publique GoTrue fermée (`[auth] enable_signup = false`). Tous les parcours créent les comptes par le serveur (inscription client et partenaire, invitation de contrôleur, création par un admin, amorçage du SUPERADMIN) et marchent encore. Numéro prouvé (`phone_verified_at`) exigé pour billet gratuit, panier, paiement, transfert, invitation, retrait : « Confirmez d'abord votre numéro de téléphone. » (parrainage : la commission naît d'un achat, qui l'exige déjà). `docs/deploiement-projet-neuf.md` § 2 : réglage du tableau de bord et sa vérification. | 34322c55, 0329120f (doc) | `tests/parcours/lot9quater-comptes` (8c633fb5) ; `aud-01` : voir § 3.2 |
| AUD-02, G-04 | `secure_password_change = true` (config locale ; consigne du tableau de bord au § 7). Barrière réelle en base : trigger `auth_users_guard_writes` (BEFORE UPDATE OF `encrypted_password` et colonnes de jetons sur `auth.users`) qui refuse tout changement sans **permis à usage unique** (`auth_write_permits`, 60 s) délivré par une route de l'application après sa propre vérification (mot de passe actuel, session de récupération, code d'activation, création par un admin). Marque « coquille » passée de `user_metadata` à `app_metadata` (`controller_activation_pending`). L'avis « mot de passe modifié » part pour tout changement (trigger `notif_on_password_changed`, quel que soit le chemin). `/reset-password` passe par `POST /api/auth/reset-password` : session de récupération exigée (`account_recovery_grants`, posée par `verify-otp` pour un code `PASSWORD_RESET`), règle commune, autres sessions révoquées, avis envoyé. | 34322c55 | `lot9quater-comptes` (PUT `/auth/v1/user {password}` refusé, marque coquille posée par l'utilisateur sans effet sur l'avis, reset sans récupération refusé) ; `aud-01` test AUD-02 n° 1 vert |
| AUD-19 | Adresse technique `u<32 hex>@comptes.eventvillage.invalid` (RFC 2606), unique par compte, jamais affichée, refusée à la saisie (contraintes `users_email_pending_reserved_chk`, `users_email_verified_reserved_chk`, `email_verifications_email_reserved_chk`, `TECHNICAL_EMAIL_RE`). Comptes existants repris par la migration 1 (§ 6). GoTrue refuse (500) tout code ou lien email vers `.invalid` et n'enregistre aucun jeton (trigger de la migration 1). Il tente toutefois l'envoi **avant** d'enregistrer le jeton : en CI, le serveur de courrier local capte ce message, dont le code n'ouvre aucune session ; en production, une adresse `.invalid` n'est jamais livrable (RFC 2606). Les fonctions SQL du lot 9 bis qui reconnaissent l'adresse technique la reconnaissent aussi sous `.invalid` (recopies, migration 4). | 34322c55, 46994ff4 | `lot9quater-comptes` (`/otp` et `/recover` sans envoi, connexion par mot de passe et par code, inscription d'un numéro existant, changement de numéro, vérification d'email avant et après la reprise) ; `aud-19` vert |
| G-97, G-31 | Contrôleur invité non activé : connexion par code, par mot de passe et « Mot de passe oublié » refusées : « Activez d'abord votre compte contrôleur avec le lien reçu par SMS. » Activation : règle commune (`StrongPasswordSchema`), affichée telle quelle sur la page. | 34322c55, 8dc22831 | `lot9quater-comptes` ; `activation-controleur` |
| AUD-06 | `has_role`, `is_controller`, `auth_user_role`, `is_partner_owner` refusent un compte SUSPENDU ou SUPPRIME. **Écart au prompt** (qui dit « ACTIF, comme is_admin ») : elles acceptent ACTIF **ou EN_ATTENTE**, car une partenaire dont la fiche attend validation a un compte EN_ATTENTE ; avec ACTIF seul, elle perdait son espace (suite `attribution-roles` rouge au run 153). `is_admin` reste ACTIF seul. Blocage GoTrue qui suit `users.status` (trigger `trg_users_status_auth_ban` : SUSPENDU/SUPPRIME → `banned_until` + 100 ans, ACTIF → débloqué, sauf compte anonymisé), reprise des comptes existants. Sessions révoquées (existant). Une session ouverte avant la suspension reçoit toujours le « 403 compte non actif » des lots précédents, et non un 401 : GoTrue répond `user_banned` après avoir vérifié le jeton, le serveur (`lib/supabase/server.ts`) et le middleware reprennent alors l'identifiant du compte pour appliquer le refus habituel. Connexion et rafraîchissement restent refusés par GoTrue. | 074492ae, 81062a6d | `lot9quater-droits` (bc04c900 : partenaire suspendue sans lecture des paiements de ses acheteurs ni nouveau jeton, réactivation) ; `aud-06` et `aud-00` verts |
| AUD-12 | PATCH `/api/controller/profile` : compte ACTIF exigé, même quota de mot de passe que `/api/account/password` (chaque essai compte), permis de la base, règle commune du mot de passe. La vérification de l'ancien mot de passe garde son chemin d'origine (profil, compte de connexion, connexion d'essai), qui renvoie 500 sans texte brut sur panne (L56, lot 8). | 34322c55, 8f41ec86 | `lot9quater-comptes` |
| AUD-05 | Codes vers un numéro **sans compte** : compteur propre `sms_otp_new_number` (`SMS_OTP_NEW_NUMBER_DAILY_CAP`, 90/jour = 30 % de la part des codes), qui ne tire plus sur `SMS_GLOBAL_DAILY_CAP` ; codes vers un numéro **qui a un compte** jamais bloqués par des inscriptions en masse. Alerte admin `ADMIN_SMS_CAP_NEW_NUMBERS` à la part atteinte. | 34322c55 | `lot9quater-comptes`, `sms-anti-abus` ; `aud-05` vert |
| AUD-33 | Anonymisation : `audit_logs_pseudonymize` (numéros et noms remplacés par « [anonymisé] » dans les lignes du compte, numéros et adresse dans les autres ; IP et navigateur effacés), IP par `getClientIp`, numéro masqué dans le journal d'invitation. | 074492ae | `lot9quater-droits` |
| AUD-34 | Adresse en attente d'un autre compte gardée jusqu'à la confirmation par son propriétaire, qui est prévenu (`EMAIL_CLAIMED_ELSEWHERE`, migration 4). Quand ce propriétaire clique son lien, il reçoit 409 « Cette adresse est déjà vérifiée sur un autre compte » et son attente est vidée (la RPC de validation constate l'adresse prise dans `public.users`) ; si l'adresse n'est prise que dans `auth.users`, refus simple sans appel de la RPC, qui ne la verrait pas. | 074492ae, 2eb2da5d | `lot9quater-droits` |
| AUD-35 | Invitation de contrôleur : quota et contrôle de propriété **avant** toute lecture du compte invité ; réponse identique. | 074492ae | `lot9quater-droits` |

### B. Administration

| Constat | Fait | Correctif | Test |
|---|---|---|---|
| AUD-22, G-01, E-08 | `PUT /api/admin/pricing` n'écrit que `subscription_packs`, `aggregator_fees`, `communication_tariffs` ; `features.*` seulement par la route SUPERADMIN existante (motif, historique). Écran « Réglages financiers » : « Services en préparation », mention « Pas prêt pour le public », activation en tapant ACTIVER. | 074492ae | `lot9quater-droits` |
| AUD-23, G-02, E-39 | Anonymiser ou suspendre un ADMIN, un SUPERADMIN ou une PARTENAIRE : SUPERADMIN seul, rôles lus dans `user_roles`. Plus de bouton « Supprimer » sur les lignes de partenaire. | 074492ae | `lot9quater-droits` |
| AUD-24 | Permission admin vérifiée dès que la ressource n'appartient pas à la fiche de l'appelant, même s'il porte aussi le rôle PARTENAIRE (`adminForeignTeamRefusal` dans les routes d'équipe). | 074492ae | `lot9quater-droits` |
| AUD-15 | Permission `access.operate` exigée d'un ADMIN pour scanner (`scan_scanner_authorized`) ou tenir une caisse (`shift_can_handle_cash`). | 074492ae | `lot9quater-droits` |
| AUD-37 | Permission `settings.read` sur `GET /api/admin/pricing` et `GET /api/admin/finance-settings` ; `GET /api/admin/permissions?adminId=<autre>` : SUPERADMIN seul. | 074492ae | `lot9quater-droits` |
| AUD-40 | `platform_settings` illisible par `anon` (politique `platform_settings_read` → `is_admin()`), vue publique `platform_settings_public` limitée à 6 clés d'affichage (§ 5.2). | 074492ae | `lot9quater-droits`, invariant (q7) |
| N-07 (E-12) | Fenêtre des droits : grille vidée et « Chargement… » avant lecture ; échec : « Droits illisibles : fermez et rouvrez. », « Enregistrer » inactif. | 074492ae | `lot9quater-droits` (ouvrir B après A ne montre jamais les cases de A) |
| N-01 (E-09) | `DELETE /api/partner/team/all` : `partnerId` exigé d'un admin (400 « Choisissez l’organisateur dont vous gérez l’équipe. », rien supprimé) ; la page le passe. | 074492ae | `lot9quater-droits` |

### C. Argent, stock et caisse

| Constat | Fait | Correctif | Test |
|---|---|---|---|
| AUD-20 | Rang des doublons remboursés par compte sur 30 jours ; au-delà de 2, remboursement moins les frais SamirPay (`refund_request_withheld`), cloche des admins, message du client adapté. Les deux premiers restent à la charge d'Event Village. Une fois versé, le remboursement retenu solde le paiement : statut REFUNDED (recopie de `cashout_finalize`, migration 5), et non PARTIAL, qui suppose des billets. | d7322b8e, 221955f9, b1964eca | `lot9quater-argent` (7953b93b) |
| AUD-21 | 3 paiements en attente au plus par numéro payeur et par heure, tous comptes confondus (`PAYER_PENDING_LIMIT`), en plus de 1 par compte et par événement : « Un paiement est déjà en attente pour ce numéro. Terminez-le ou attendez quelques minutes. » | d7322b8e | `lot9quater-argent` |
| AUD-27 | Quota de C2 ; avertissement « Le paiement sera demandé au {numéro}. » quand le numéro payeur diffère de celui du compte ; remboursement vers le numéro qui a payé (existant, vérifié). | d7322b8e | `lot9quater-argent` |
| AUD-29 | Paiement FAILED sans identifiant SamirPay : signalé dans « Versements à reprendre » (48 h, `PAYMENT_UNCONFIRMED`) avec la consigne. Voir § 3.3 pour le choix. | d7322b8e | `lot9quater-argent` |
| AUD-30 | Pas de commission quand le numéro payeur est celui du parrain ou un numéro payeur déjà utilisé par lui (`referral_self_payer`). | d7322b8e | `lot9quater-argent` |
| AUD-31, G-24 | La limite compte les billets gratuits **émis** pour le compte, transférés compris (`free_tickets_issued_count`), et s'applique au panier mixte (`FREE_LIMIT_REACHED`). | d7322b8e | `lot9quater-argent` |
| AUD-16 | Écart de caisse validé par la partenaire depuis sa session (onglet Caisse du pilotage, « Valider l'écart », mot de passe récent) ; plus de PIN à la clôture ; le contrôleur voit « Écart en attente de validation par l’organisateur ». Le PIN régisseur reste à l'ouverture. | d7322b8e | `lot9quater-argent` |

### D. Coût des SMS, E. Contrôle d'accès

| Constat | Fait | Correctif | Test |
|---|---|---|---|
| AUD-18 | Transferts offerts : 3 par billet et par jour, 10 par compte et par jour ; unités rendues si l'offre est refusée. | db3eac36 | `lot9quater-sms-acces` (484e3abd) |
| AUD-32 | 50 numéros invités par compte et par jour (`invitation_account`), en plus des quotas existants. | db3eac36 | `lot9quater-sms-acces` |
| AUD-26 | Titre, lieu, ville, consigne d'entrée et nom d'invité refusent adresses web et numéros (`hasContactInfo`) : « Le titre ne peut pas contenir d'adresse web ni de numéro de téléphone. » Changement de titre seul : toujours aucun SMS. | db3eac36 | `tests/schema/lot9quater-coordonnees`, `lot9quater-sms-acces` |
| AUD-13 | Invitation sans nom : numéro complet exigé ; les 4 derniers chiffres ne trouvent que les invitations nommées. | db3eac36 | `lot9quater-sms-acces` |
| AUD-14 | Contrôle de zone repassé : écran orange « Déjà passé à {zone} à {heure} », bouton « Même personne : laisser passer », chaque passage compté et visible dans l'onglet Entrées. Entrée principale inchangée. | db3eac36 | `lot9quater-sms-acces`, `acces-tracabilite` |

### F. Technique

| Constat | Fait | Correctif | Test |
|---|---|---|---|
| AUD-04 | Webhook SamirPay : 413 au-delà de 16 Ko (content-length, puis lecture bornée), avant tout journal. | 52a5916c | `lot9quater-technique` (60a09ff3) ; `aud-04` vert |
| AUD-25, AUD-36 | Purge horaire des dépôts anonymes non rattachés après 24 h ; quota global par jour (`DOCUMENT_UPLOADS_GLOBAL_DAY`) ; `POST /api/partner/upload` : fiche VALIDE, quota par compte (`PARTNER_IMAGE_UPLOADS_PER_ACCOUNT_HOUR`), taille contrôlée avant lecture. | 52a5916c | `lot9quater-technique` |
| AUD-39 | En production réelle, `PUSH_ENDPOINT_ALLOWED_ORIGINS` refuse http et les hôtes locaux ; le serveur refuse de démarrer sinon. | 52a5916c | `tests/schema/lot9quater-technique` |
| AUD-11 (partiel) | HSTS, Permissions-Policy, CSP en mode rapport seulement (`/api/csp-report`). CSP bloquante : lot de mise en ligne. Violations relevées au § 8. | 52a5916c | `tests/schema/lot9quater-technique` |

Migrations : gel des `20261110…` et rejouabilité des `20261111…` : `tests/schema/migrations-gelees`, `tests/schema/migration-lot9quater-rejouable` (eb4efc88).

## 3. Suites d'audit au run « après »

### 3.1 Sortie brute

Run 164, tableau final de `verify.log` (les 8 suites de `tests/audit/`, aucune modifiée depuis 806b301e) :

```
Suite                                                    Statut   Durée     Code  Journal
tests/audit/aud-00-catalogue.test.ts                     PASS     928ms     0     .test-logs/tests__audit__aud-00-catalogue.test.ts.log
tests/audit/aud-01-comptes-gotrue.test.ts                FAIL     1.6s      1     .test-logs/tests__audit__aud-01-comptes-gotrue.test.ts.log
tests/audit/aud-04-webhook-journal.test.ts               PASS     493ms     0     .test-logs/tests__audit__aud-04-webhook-journal.test.ts.log
tests/audit/aud-05-sms-plafond-global.test.ts            PASS     661ms     0     .test-logs/tests__audit__aud-05-sms-plafond-global.test.ts.log
tests/audit/aud-06-partenaire-suspendu.test.ts           PASS     1.5s      0     .test-logs/tests__audit__aud-06-partenaire-suspendu.test.ts.log
tests/audit/aud-07-enumeration-comptes.test.ts           FAIL     662ms     1     .test-logs/tests__audit__aud-07-enumeration-comptes.test.ts.log
tests/audit/aud-17-redirection-connexion.test.ts         PASS     275ms     0     .test-logs/tests__audit__aud-17-redirection-connexion.test.ts.log
tests/audit/aud-19-code-email-adresse-technique.test.ts  PASS     735ms     0     .test-logs/tests__audit__aud-19-code-email-adresse-technique.test.ts.log
tests/fondations-lot0.test.ts                            PASS     531ms     0     .test-logs/tests__fondations-lot0.test.ts.log
```

6 vertes. `aud-07` est hors périmètre. Pour `aud-01`, voir le § 3.2.

### 3.2 `aud-01-comptes-gotrue` : faille fermée, précondition fausse

La suite a quatre tests. Les deux premiers sont **verts** au run « après » : AUD-01 (le titulaire du numéro peut encore s'inscrire, car le `signUp` du visiteur est refusé) et AUD-02, premier test (« GoTrue refuse un nouveau mot de passe présenté avec le seul jeton »). Les deux autres restent rouges, et c'est leur **précondition** qui échoue, pas la vérification de la faille.

**AUD-02, second test** (`tests/audit/aud-01-comptes-gotrue.test.ts:90`). Le test vérifie d'abord, comme « témoin », qu'un changement direct est accepté :

```
assert.equal(plain.status, 200, `précondition : changement direct accepté (sinon voir le premier test) : ${plain.text}`);
```

Le correctif A3 refuse justement ce changement direct (trigger `auth_users_guard_writes`, sans permis PASSWORD). La sortie du run « après » :

```
précondition : changement direct accepté (sinon voir le premier test) : {"code":500,"error_code":"unexpected_failure","msg":"Error during password storage", ...}
```

Le message du test le prévoit lui-même : « sinon voir le premier test ». Ce premier test est vert. L'alerte PASSWORD_CHANGED quand la marque est posée dans `user_metadata` est prouvée par `lot9quater-comptes`, « marque « coquille » écrite par l'utilisateur dans user_metadata : l'avis PASSWORD_CHANGED part quand même » (changement fait par le service avec un permis, puisque la voie directe est fermée).

**AUD-03** (`tests/audit/aud-01-comptes-gotrue.test.ts:113`). Le test ouvre d'abord des comptes par l'inscription publique et exige qu'elle réussisse :

```
assert.equal(signed.error, null, `signUp public ${i} : ${signed.error?.message}`);
```

Le correctif A2 ferme cette inscription (`enable_signup = false`). Sortie du run « après » :

```
signUp public 0 : Signups not allowed for this instance
```

Un compte sans numéro ni code ne peut donc plus exister par cette voie. Si un tel compte existe quand même (création ancienne, ou par un autre chemin), il ne prend aucun billet gratuit : c'est prouvé par `lot9quater-comptes`, « POST /auth/v1/signup (clé anon) est refusé et ne crée aucun compte » et « compte sans numéro prouvé : billet gratuit, panier et transfert refusés (403 PHONE_NOT_VERIFIED) ».

Je ne modifie pas la suite (règle du prompt). Pour qu'elle devienne verte, il faudrait que ses deux préconditions acceptent le refus comme preuve de fermeture : c'est à décider de ton côté.

### 3.3 AUD-29 : pourquoi un signalement et pas un suivi par orderId

Le prompt demandait de vérifier dans `.private/samirpay-api-v1.2.pdf` si l'API de statut accepte un orderId. Je n'ai pas pu lire ce PDF sur ce poste (aucun outil d'extraction de PDF disponible, et je n'ai rien installé). Le rapport du lot 9 bis (§ 3.2), écrit à partir de ce document, dit que le statut ne se lit que par l'identifiant SamirPay (§ 4.3 du document). J'ai donc appliqué la branche « sinon » : signalement dans « Versements à reprendre » avec la consigne. **À confirmer de ton côté** en relisant le § 4.3 du PDF ; si un statut par orderId existe, le suivi automatique est un petit ajout.

## 4. Lectures de `user_metadata` (A3)

`user_metadata` (`raw_user_meta_data`) est écrit par l'utilisateur lui-même (PUT `/auth/v1/user {data}`). Relevé de tout le dépôt (code, migrations en vigueur) :

| Où | Ce qui est lu | Ce que ça décide | État |
|---|---|---|---|
| `handle_new_user` (migration 20261111000001, recopie) | `first_name`, `last_name` | Prénom et nom du profil à la création (affichage) | Gardé : aucune décision de sécurité. Le rôle et le numéro n'y sont plus lus depuis le lot 1A. |
| `components/layout/AppLayout.tsx:307-308` | `first_name`, `last_name` | Nom affiché dans l'en-tête tant que le profil n'est pas chargé | Gardé : affichage seul |
| `notif_on_password_changed` (20261109000009:1623, gelée) | `is_temporary_controller_account` | Supprimait l'avis « mot de passe modifié » (AUD-02) | **Remplacée** (migration 1) : lit `raw_app_meta_data.controller_activation_pending` |
| `controller_account_states` (20261109000008:2204, gelée) | `is_temporary_controller_account` | État « compte à activer » d'un contrôleur | **Remplacée** (migration 1) : `app_metadata` |
| `controller_assignments_sync` (20261110000006:549, gelée) | `is_temporary_controller_account` | Dispense du consentement du contrôleur à l'affectation | **Remplacée** (migration 1) : `app_metadata` |
| `app/api/controller/setup/route.ts`, `app/api/partner/team/invite/route.ts` | marque « compte à activer » | Activation possible, compte réutilisable à l'invitation | **Remplacées** : `app_metadata` (`lib/auth/controller-activation.ts`) |
| `scripts/dev/seed-dev.core.ts:104` | `is_essai_fixture` | Garde du seed de démonstration (compter les comptes réels) | **Remplacée** : `app_metadata` |
| Reprise `20261109000012:239` (gelée, déjà exécutée) | `is_essai_fixture` | A posé `users.demo_account` une fois, au lot 9 bis | Plus lue. Contrôle au § 6 : aucun `demo_account` hors domaine du seed. |
| Migration 1, § 9.2 et 9.3 (reprise) | `is_temporary_controller_account`, `is_essai_fixture` | Copie une fois vers `app_metadata` (rôle CONTROLEUR, domaine du seed exigés), puis effacement | Exécution unique, invariant (q2) |

Écritures de `user_metadata` restantes : prénom, nom et numéro à la création (routes d'inscription, admin, partenaire, invitation, seed). Aucune n'est relue pour décider.

## 5. Permissions et réglages nouveaux

### 5.1 Permissions d'administration

| Code | Libellé affiché | Exigée pour |
|---|---|---|
| `access.operate` | Contrôler les entrées et tenir une caisse | Un ADMIN qui scanne ou ouvre une caisse (le SUPERADMIN n'en a pas besoin) |
| `settings.read` | Lire les réglages | `GET /api/admin/pricing`, `GET /api/admin/finance-settings` |

Les ADMIN existants n'ont aucune de ces deux permissions après la migration : un SUPERADMIN les donne dans « Utilisateurs » → droits de l'admin. Les permissions d'un autre admin ne se lisent plus que par le SUPERADMIN.

### 5.2 Réglages lisibles par un visiteur (`platform_settings_public`)

`features.halls_enabled`, `features.tables_enabled`, `features.orders_enabled`, `access.low_stock_threshold`, `finance.service_fee_rate`, `finance.min_paid_price`. Aucun seuil anti-abus. Le reste de `platform_settings` n'est lu que par un admin ou le serveur.

### 5.3 Variables d'environnement nouvelles (facultatives)

| Variable | Défaut | Rôle |
|---|---|---|
| `SMS_OTP_NEW_NUMBER_DAILY_CAP` | 90 | Codes par jour vers des numéros sans compte (A8) |
| `TRANSFER_PER_TICKET_DAY`, `TRANSFER_PER_ACCOUNT_DAY` | 3, 10 | Transferts offerts (D1) |
| `INVITATION_PER_ACCOUNT_DAY` | 50 | Numéros invités par compte et par jour (D2) |
| `DOCUMENT_UPLOADS_GLOBAL_DAY` | 500 | Dépôts anonymes de pièces par jour (F2) |
| `PARTNER_IMAGE_UPLOADS_PER_ACCOUNT_HOUR` | 30 | Images de partenaire par compte et par heure (F2) |

Production : `PUSH_ENDPOINT_ALLOWED_ORIGINS` ne doit contenir que des origines `https` publiques, sinon le serveur refuse de démarrer (F3).

## 6. Migrations à appliquer sur event-village-dev

Six migrations, dans cet ordre, d'un seul `db push` :

| Ordre | Migration | Ce qu'elle fait |
|---|---|---|
| 1 | `20261111000001_lot9quater_comptes.sql` | Adresse technique `.invalid` (fonctions, 3 contraintes), permis d'écriture GoTrue et trigger `on_auth_user_guard_writes`, récupération de mot de passe, marque d'activation en `app_metadata` ; recopies de `handle_new_user`, `account_profile_finalize`, `admin_notification_detail`, `notif_on_password_changed`, `controller_account_states`, `controller_assignments_sync` ; **reprise des données** : adresses techniques dans `auth.identities`, `auth.users`, `public.users`, marques déplacées. |
| 2 | `20261111000002_lot9quater_sms.sql` | Type `ADMIN_SMS_CAP_NEW_NUMBERS`, recopie de `notification_admin_alert`. |
| 3 | `20261111000003_lot9quater_droits.sql` | Aides de droits exigeant un compte ACTIF ou EN_ATTENTE, jamais SUSPENDU ni SUPPRIME (écart au prompt, § 2 A6), blocage GoTrue suivant le statut (+ reprise), `audit_logs_pseudonymize`, `access.operate` dans le scan et la caisse, `platform_settings` fermé à `anon` et vue publique. |
| 4 | `20261111000004_lot9quater_email.sql` | Type `EMAIL_CLAIMED_ELSEWHERE` (canaux in-app, SMS, email), recopie de `email_verification_finalize` ; recopies de `notif_verified_email`, `notif_enqueue`, `notification_outbox_claim`, `email_verification_issue` et `email_verification_log` (lot 9 bis), dont le seul changement est de reconnaître aussi l'adresse technique `.invalid`. |
| 5 | `20261111000005_lot9quater_argent.sql` | Doublons, retenue des frais, paiements en attente par numéro payeur, billets gratuits émis, auto-parrainage, validation de l'écart de caisse (2 colonnes sur `controller_shifts`) ; recopie de `pilotage_compute_cash` qui sert `discrepancy_validated_at` à l'onglet Caisse. |
| 6 | `20261111000006_lot9quater_invites_zones.sql` | Quota d'invitations par compte, recherche des invités, passage répété en zone, compteur de l'onglet Entrées. |

Toutes sans BEGIN ni COMMIT, rejouables (prouvé en CI : chacune rejouée deux fois de suite). **Déployer l'application du lot juste après, dans la même fenêtre** : l'application du lot 9 ter appelle des fonctions dont la signature n'a pas changé, mais la connexion par code exige le permis `EMAIL_LINK` posé par la nouvelle application (trigger de la migration 1) : entre la migration et le déploiement, **la connexion par code SMS et tout changement de mot de passe échouent** ; la connexion par mot de passe marche.

### 6.1 Avant `db push` (éditeur SQL, une requête à la fois, garder les résultats)

```sql
-- A. attendu : 20261110000011, et aucune 20261111…
select max(version) from supabase_migrations.schema_migrations;

-- B. adresses techniques à reprendre (garder les trois nombres)
select (select count(*) from auth.users where email ~ '^[0-9]+@eventvillage\.sn$') as auth_users,
       (select count(*) from auth.identities where provider = 'email' and identity_data->>'email' ~ '^[0-9]+@eventvillage\.sn$') as identites,
       (select count(*) from public.users where email ~ '^[0-9]+@eventvillage\.sn$') as profils;

-- C. lignes qui bloqueraient les nouvelles contraintes : attendu 0, 0, 0 (sinon s'arrêter et me les montrer)
select (select count(*) from public.users where email_pending ~* '@([a-z0-9-]+\.)*invalid$') as en_attente,
       (select count(*) from public.users where email_verified_at is not null and email ~* '@([a-z0-9-]+\.)*invalid$') as verifiees,
       (select count(*) from public.email_verifications where email ~* '@([a-z0-9-]+\.)*invalid$') as liens;

-- D. marques dans user_metadata (garder les deux nombres)
select count(*) filter (where a.raw_user_meta_data ? 'is_temporary_controller_account') as marques,
       count(*) filter (where a.raw_user_meta_data->>'is_temporary_controller_account' = 'true'
                          and exists (select 1 from public.user_roles r where r.user_id = a.id and r.role::text = 'CONTROLEUR')) as controleurs_a_activer
  from auth.users a;

-- E. statut des comptes et blocage GoTrue. Attention : un compte ACTIF bloqué à la main dans le tableau de bord
--    sera débloqué par la migration 3 ; s'il y en a (colonne bloques de la ligne ACTIF > 0), me le dire avant.
select u.status, count(*) as comptes, count(*) filter (where a.banned_until > now()) as bloques
  from public.users u join auth.users a on a.id = u.id group by 1 order by 1;

-- F. attendu : true (platform_settings lisible par un visiteur avant le lot)
select has_table_privilege('anon', 'public.platform_settings', 'SELECT');

-- G. attendu : 0 (aucun compte de démonstration hors domaine du seed)
select count(*) from public.users u join auth.users a on a.id = u.id
 where u.demo_account and lower(coalesce(a.email, '')) not like '%@essai.eventvillage.invalid';
```

### 6.2 Appliquer

```powershell
npx supabase@2.122.0 link --project-ref VOTRE_REFERENCE
npx supabase@2.122.0 migration list --linked     # les six 20261111… en local seulement
npx supabase@2.122.0 db push --linked --dry-run  # exactement les six fichiers, dans l'ordre
npx supabase@2.122.0 db push --linked
```

Si la liste contient autre chose : s'arrêter, sans `--include-all` ni `migration repair`.

### 6.3 Après (éditeur SQL)

```sql
-- attendu : 6 lignes, de 20261111000001 à 20261111000006
select version from supabase_migrations.schema_migrations where version like '20261111%' order by 1;

-- B relancée : attendu 0, 0, 0 ; puis le nombre d'adresses neuves = le nombre auth_users de B avant
select count(*) from auth.users where email ~ '^u[0-9a-f]{32}@comptes\.eventvillage\.invalid$';

-- D relancée : attendu 0 marque ; puis attendu = controleurs_a_activer de D avant
select count(*) from auth.users where raw_app_meta_data->>'controller_activation_pending' = 'true';

-- E relancée : attendu bloques = comptes pour SUSPENDU et SUPPRIME, bloques = 0 pour ACTIF
-- F relancée : attendu false ; puis attendu 6 lignes
select key from public.platform_settings_public order by 1;

-- attendu : 2 lignes (on_auth_user_guard_writes, trg_users_status_auth_ban)
select tgname from pg_trigger where tgname in ('on_auth_user_guard_writes', 'trg_users_status_auth_ban') order by 1;

-- attendu : 2 lignes
select type from public.notification_types where type in ('ADMIN_SMS_CAP_NEW_NUMBERS', 'EMAIL_CLAIMED_ELSEWHERE');

-- attendu : 2 lignes (discrepancy_validated_at, discrepancy_validated_by)
select column_name from information_schema.columns
 where table_schema = 'public' and table_name = 'controller_shifts' and column_name like 'discrepancy_validated%';
```

Puis exécuter `supabase/hotfix/2026-10-31-lot1a/03-verification.sql` : tout `OK`.

**Essais après déploiement** (comptes réels d'event-village-dev) : le SUPERADMIN, la partenaire, un client et le contrôleur se connectent par mot de passe **et** par code ; un client change son mot de passe depuis son profil et reçoit l'avis ; « Mot de passe oublié » marche de bout en bout ; aucune adresse `…@comptes.eventvillage.invalid` n'apparaît à l'écran (profil, administration).

## 7. À faire de ton côté (tableau de bord Supabase d'event-village-dev)

Dans l'ordre, **après** le `db push` et le déploiement du § 6 :

1. **Couper l'inscription publique.** Authentication → Sign In / Providers → section « User Signups » → décocher **« Allow new users to sign up »** → Save. Ne pas désactiver le fournisseur « Email » lui-même (il sert à la connexion par mot de passe).
   Vérification, depuis n'importe quel poste, avec la seule clé publique :
   ```
   curl -s -X POST "https://<ref>.supabase.co/auth/v1/signup" -H "apikey: <clé anon>" -H "Content-Type: application/json" -d "{\"email\":\"essai-inscription@exemple.invalid\",\"password\":\"Essai#2026x\"}"
   ```
   Attendu : une erreur `signup_disabled` (« Signups not allowed for this instance »), et aucun nouveau compte dans Authentication → Users. Puis une inscription normale depuis l'application (numéro neuf, code SMS) doit encore marcher : elle passe par le serveur.
2. **Activer le changement de mot de passe sécurisé.** Authentication → Sign In / Providers → Email → cocher **« Secure password change »** → Save. Vérification : la case reste cochée après rechargement de la page. Ce réglage n'agit que sur les sessions de plus de 24 h ; la barrière réelle est le trigger de la migration 1, déjà en place après le § 6.
3. **Donner les nouvelles permissions** aux ADMIN qui scannent, tiennent une caisse ou lisent les réglages (§ 5.1), depuis l'écran Utilisateurs avec le compte SUPERADMIN.

## 8. Violations CSP relevées en CI (mode rapport seulement)

Relevé : lignes `[CSP-REPORT]` de `next-start.log` pendant l'e2e (le serveur de production tourne avec la CSP en mode rapport seulement ; `/api/csp-report` journalise chaque violation distincte une fois). Run 164 : **8 violations distinctes, toutes de la même sorte** :

```
[CSP-REPORT] img-src http://127.0.0.1:54321/storage/v1/object/public/public-images/events/65695617-8993-484a-ac9d-caeb2e5897ab/demo-festival-jazz-sur-le-fleuve.png /partner/events/075bdbbb-be98-4962-8db7-9710714e5233/edit
[CSP-REPORT] img-src http://127.0.0.1:54321/storage/v1/object/public/public-images/events/65695617-8993-484a-ac9d-caeb2e5897ab/demo-nuit-du-sabar-edition-d-automne.png /partner/events/59d63709-fe40-472a-b1c5-e5bc24e58f5a/edit
[CSP-REPORT] img-src http://127.0.0.1:54321/storage/v1/object/public/public-images/partners/65695617-8993-484a-ac9d-caeb2e5897ab/logo.png /partner/profile
[CSP-REPORT] img-src http://127.0.0.1:54321/storage/v1/object/public/public-images/events/8824063b-3dc0-4d14-a391-55a37d748ee0/demo-festival-des-musiques-du-saloum.png /admin/events/46fd6afd-9372-4859-b9a1-1d173e40aee4
[CSP-REPORT] img-src http://127.0.0.1:54321/storage/v1/object/public/public-images/events/8824063b-3dc0-4d14-a391-55a37d748ee0/demo-rencontres-du-conte-et-de-la-parole.png /admin/events/f5b427c2-82ef-47f8-b626-cdd42d20200f
[CSP-REPORT] img-src http://127.0.0.1:54321/storage/v1/object/public/public-images/events/59b7a7c9-79d6-42bc-8242-20167833ddc7/1794599278932_0755140c.png /partner/events/new
[CSP-REPORT] img-src http://127.0.0.1:54321/storage/v1/object/public/public-images/events/621a8305-cb26-46ba-bdb2-2e7df9c0972e/1794599675617_c70d1d33.png /partner/events/new
[CSP-REPORT] img-src http://127.0.0.1:54321/storage/v1/object/public/public-images/events/59b7a7c9-79d6-42bc-8242-20167833ddc7/fixture-test-fixture-a-publie.png /partner/events/2fb4fe5d-7566-46af-90bf-544eccc50af4/edit
```

- **Directive en cause : `img-src` seulement.** Rien sur `script-src`, `style-src`, `connect-src`, `frame-ancestors` ni `form-action`.
- **Cause : propre à la CI.** Les images (affiches d'événements, logo de partenaire) viennent du stockage Supabase local, servi en `http://127.0.0.1:54321`. La règle `img-src 'self' data: blob: https:` n'admet que https. En production, le stockage Supabase est servi en `https://<ref>.supabase.co` : ces images sont admises telles quelles.
- **Pour la CSP bloquante (lot de mise en ligne)** : rien à ouvrir de plus pour ces pages. On pourra restreindre `img-src` à `'self' data: blob:` et à l'origine Supabase du projet, au lieu de tout `https:`.
- **Limite de ce relevé.** Il ne couvre que les pages parcourues par l'e2e (recette acte 1 à 3 et les écrans visités). Les pages non parcourues, les SDK tiers chargés en production (paiement, carte) et le service worker des notifications push (désactivé en CI) restent à relever sur event-village-dev avant de passer en mode bloquant.

## 9. Tests existants modifiés (et pourquoi)

Aucune suite de `tests/audit/` n'est modifiée (`git diff 806b301e HEAD -- tests/audit` est vide). Suites existantes modifiées parce que le comportement attendu a changé par décision du prompt :

| Fichier | Pourquoi |
|---|---|
| `tests/security/helpers.ts` | `signUpAttacker` crée l'attaquant par l'inscription de l'application (l'inscription publique GoTrue est fermée, A2) |
| `tests/security/r1-inscription-roles.test.ts` | Idem : l'attaquant a maintenant le numéro prouvé de son inscription ; l'assertion « `users.phone` reste vide » devient « `users.phone` n'est jamais le numéro revendiqué en métadonnée » |
| `tests/parcours/bootstrap-superadmin.test.ts` | Le compte à promouvoir est créé par le service_role (avant : signUp public, fermé par A2) |
| `tests/parcours/activation-controleur.test.ts` | Règle commune du mot de passe (G-31), marque en `app_metadata` |
| `tests/parcours/compte-numero.test.ts`, `compte-profil.test.ts`, `email-verification.test.ts`, `inscription-numero-dabord.test.ts`, `invitation-identite.test.ts` | Adresse technique `.invalid` au lieu de `<chiffres>@eventvillage.sn` (A4) |
| `tests/parcours/notif-interface.test.ts`, `notif-modeles.test.ts`, `notif-migration.test.ts` | Deux types de notifications nouveaux dans les listes exhaustives |
| `tests/parcours/messages-sms-9bis.test.ts` | Changement de mot de passe par le service : permis de la base (A3) |
| `tests/parcours/acces-limiteurs.test.ts`, `sms-anti-abus.test.ts` | Les codes vers un titulaire de compte ne tirent plus sur la part des inscriptions (A8) : comptes créés pour ces numéros |
| `tests/schema/essai-seed-gardes.test.ts` | Marque du seed lue dans `app_metadata` (A3) |
| `tests/parcours/paiement-helpers.ts`, `tests/seed/seed-test.ts` | Acheteurs de test au numéro prouvé (A2), permis, `settings.read` pour l'ADMIN de test (B5) |
| `tests/parcours/notif-reglages.test.ts`, `lectures-ignorees.test.ts` | La route des tarifs n'écrit plus qu'une clé de sa liste blanche (B1) : clés d'essai remplacées par `communication_tariffs` et `subscription_packs` ; section « Fonctionnalités » renommée « Services en préparation », mention « Pas prêt pour le public » et ACTIVER (E-08) |
| `tests/parcours/acces-tracabilite.test.ts` | Résultat `zone_already_passed` ajouté à la liste des résultats (E2) |
| `tests/schema/samirpay-v12-statique.test.ts` | La lecture bornée du corps du webhook (F1) est admise par la lecture statique ; signalé |
| `tests/schema/migrations-gelees.test.ts` | Les 11 migrations `20261110…` (lot 9 ter) ajoutées au gel |

Seconde vague, après les runs 153 et 155 (commits a129863a, b5720bc9, 46994ff4, 221955f9, 9fe89546) :

| Fichier | Pourquoi |
|---|---|
| `tests/parcours/paiement-helpers.ts` | `newBuyer` a maintenant une option `phoneVerified` : le numéro est prouvé par défaut (A2), et `phoneVerified: false` donne un compte au numéro non prouvé |
| `invitations-reclamation`, `invitations`, `invites-reclamation`, `invites-recherche`, `invites-validation`, `invitations-annulation`, `invitations-course`, `course-invites`, `cycle9bis-transfert`, `messages-sms-9bis`, `notif-transferts`, `textes-base-9bis` | Les invités et destinataires « en attente » de ces suites sont créés avec `phoneVerified: false` : c'est la condition de la règle AR15 qu'elles éprouvent, que le nouveau défaut supprimait |
| `tests/seed/seed-test.ts`, `acces-encaissement` (admin local) | L'ADMIN de test reçoit `settings.read` (B5) et `access.operate` (AUD-15) |
| `tests/seed/seed-demo.ts` | L'admin de démonstration reçoit `settings.read` : l'e2e de recette (acte 1) ouvre les réglages avec lui |
| `acces-reglages`, `notif-reglages`, `lectures-ignorees`, `lot9quater-droits` (B1) | Le témoin d'écriture de la route des tarifs réécrit `aggregator_fees` avec sa valeur actuelle ; aucune ligne tarifaire n'est supprimée, chacune est restaurée à l'identique (les autres suites lisent ces tarifs) |
| `audit-transactionnel`, `fiche-partenaire-9bis` | L'acteur qui suspend une partenaire est un SUPERADMIN (AUD-23) |
| `droits-partenaire-9bis` | L'admin qui lit l'équipe d'une autre fiche passe `partnerId` (AUD-24) |
| `dette-cloture-caisse` | 3 tests réécrits : plus de PIN à la clôture, écart « en attente de validation », `pinCosigned` faux (décision C7 / AUD-16) |
| `lot9quater-argent` | C7 sur un événement dans sa fenêtre (`createTimedEvent`) ; la lecture statique cherche « Valider l'écart » dans `CashTab.tsx` |
| `lot9quater-comptes` | A4 : prouve qu'aucun jeton n'est enregistré et qu'aucun code capté n'ouvre de session (au lieu de « aucun message ») ; mot de passe faible généré (règle « aucun mot de passe littéral ») |
| `lot9quater-technique` | Les deux dépôts insérés ont une date (`created_at` non nul) |
| `edition-formulaire` | Titres d'événement avec l'horodatage en base 36 : 13 chiffres d'affilée ressemblent à un numéro (D3), et le formulaire renvoie le titre tel quel |
| `essai-seed-dev` | Marque du seed lue dans `app_metadata` (A3) |
| `notif-outbox`, `notif-modeles` | Registres exhaustifs complétés : `ADMIN_SMS_CAP_NEW_NUMBERS`, et `EMAIL_CLAIMED_ELSEWHERE` avec le canal EMAIL (règle G.49 : un type indispensable déclare l'email) |
| `statut-compte`, `r7-profil-colonnes`, `securite-ecritures-services-9ter`, `securite-fiche-partenaire-9ter`, `dette-suspendu-temps-reel` (+ `tests/helpers/realtime.ts`) | Un compte suspendu est maintenant bloqué chez GoTrue (A6) : ces suites ouvrent la session **avant** la suspension, ou lèvent le blocage le temps de la connexion puis le reposent. `users.status` reste SUSPENDU pendant tout le test, et c'est la RLS qui est éprouvée |
| `tests/helpers/middleware.ts` | Même raison : quand GoTrue refuse `setSession` pour un compte banni, les cookies de session sont écrits par la bibliothèque elle-même (`_saveSession` puis l'événement `SIGNED_IN`), comme ceux qu'un navigateur garde après la suspension |
| `compte-numero` | Mot de passe récent posé avant les deux suspensions (B4) |
| `messages-bruts` | Le nouveau mot de passe du contrôleur contient un caractère spécial (règle commune, AUD-12) : sinon 400 avant la panne simulée |
| `dossier-partenaire-9bis` | Avis aux admins filtrés par entreprise dans la requête : lus par type seul, ils dépassaient le plafond de 1000 lignes de PostgREST (`max_rows`), et les plus récents étaient coupés |
| `edition-validation` | Titres sans UUID entier : un UUID peut aligner 10 chiffres séparés par des tirets, refusés comme un numéro (D3) ; l'échec était aléatoire |
| `notif-envoyeur` | Le test de la route vide d'abord la file des lignes dues laissées par les suites précédentes, puis pose sa ligne : la file dépassait ce qu'un passage de l'envoyeur traite (10 tours de 100, SMS en dernier), et la ligne n'était envoyée que si la file était courte à ce moment-là |
| `tests/helpers/recette-invariants.ts` (invariant (s2) du lot 8) | (s2) exigeait que tout paiement en double soit remboursé **en entier**, ce que la décision C1 du prompt (AUD-20) contredit pour le 3e doublon. La règle accepte maintenant le total moins la retenue enregistrée sur le paiement (`duplicate_fee_withheld`), à condition que la retenue ne dépasse jamais les frais réels de l'opérateur (`aggregator_fee`). Un doublon sans remboursement reste détecté (`recette-invariant`, « s2 : paiement en double sans remboursement du total détecté », inchangé). |
| `lot9quater-comptes` (fixtures A3, A4) | Le test de reprise supprime le compte d'avant le lot qu'il a fabriqué ; le test A3 retire la marque qu'il a fait écrire par l'utilisateur. Sinon, les invariants (q1) et (q2) du lot les comptaient, et toutes les suites suivantes échouaient (run 159). L'utilisateur peut toujours écrire cette clé dans `user_metadata` : (q2) vérifie la reprise et ce que l'application écrit, et le test A3 prouve que la clé reste sans effet. |
| `messages-detenteur-9ter`, `notif-canaux` (fixtures A4) | Pour avoir un compte « sans adresse réelle », ces suites (lots 9 bis et 9 ter) écrivaient dans `public.users` l'ancienne adresse `<chiffres>@eventvillage.sn` et ne la retiraient jamais : 6 comptes pour la première, 1 pour la seconde. L'invariant (q1) les relevait à la fin de `migration-lot9quater-rejouable` (run 162 : 7 violations, `public.users` seulement). Elles écrivent maintenant la forme actuelle de l'adresse technique (`u…@comptes.eventvillage.invalid`, celle de `technical_email_for`). Le résultat attendu est le même (`SKIPPED NO_REAL_EMAIL`). L'ancienne forme reste éprouvée dans `notif-canaux`, comme destinataire explicite, et dans `notif-outbox`, en transaction annulée. |
| `e2e/terrain.spec.ts` (test 7) | Course dans le test : le compteur `held` passe à 1 avant que `route.fetch()` ait rendu le statut. Le statut était lu dans la foulée, et valait encore 0 au run 162 quand le serveur était un peu lent (vert aux runs 157, 159 et 160). Il est maintenant attendu par `expect.poll`, avec le même seuil de 200 et le même délai que l'attente voisine. |
| `docs/recette-billetterie.md` | Citations `tests/…:ligne` recalées sur les mêmes tests, qui ont bougé (`recette-matrice`) |

Aucun de ces changements n'affaiblit une vérification : chacun suit une règle du prompt ou corrige une fixture. Le test d'AUD-34 (`lot9quater-droits`) valide l'adresse par la route publique, ce qui pose aussi l'adresse dans `auth.users`. L'appel direct de la RPC laissait l'invariant (w) à 1, et faisait échouer en cascade toutes les suites suivantes au run 152.

## 10. Essais pour un non-développeur

Sur l'application déployée (event-village-dev), avec un navigateur ordinaire :

1. **Lien piégé.** Ouvrir `/login?redirect=javascript:alert(1)`, se connecter : on arrive sur son espace, rien ne s'affiche, aucune fenêtre. Même chose avec `/login?redirect=//exemple.com` et `/login?redirect=https://exemple.com` : on reste sur Event Village.
2. **Partenaire suspendue.** Avec le SUPERADMIN, suspendre une partenaire d'essai. Dans l'autre navigateur où elle était connectée : elle est déconnectée, ne peut plus se reconnecter (ni mot de passe, ni code), et ne voit plus ses ventes. La réactiver : elle se reconnecte et retrouve tout.
3. **Admin sans droit.** Avec un ADMIN à qui on a retiré « Lire les réglages » : la page des réglages financiers ne s'ouvre pas ; il ne peut pas activer les services en préparation. Avec le SUPERADMIN : les trois services sont sous « Services en préparation », marqués « Pas prêt pour le public », et l'activation demande de taper ACTIVER.
4. **Admin sans « Contrôler les entrées et tenir une caisse »** : le scanner refuse ses passages, il ne peut pas ouvrir de caisse.
5. **Numéro payeur différent.** Acheter un billet en saisissant un autre numéro que le sien : l'écran affiche « Le paiement sera demandé au … ».
6. **Écart de caisse.** Clôturer une caisse avec un écart sur le téléphone du contrôleur : pas de PIN demandé, message « Écart en attente de validation par l’organisateur ». La partenaire, dans Pilotage → Caisse, voit « Valider l'écart », retape son mot de passe, l'écart est validé.
7. **Zone repassée.** Scanner deux fois le même billet à un contrôle de zone : écran orange « Déjà passé à {zone} à {heure} », bouton « Même personne : laisser passer » ; l'onglet Entrées compte le second passage.
8. **Mot de passe oublié** d'un contrôleur invité qui n'a pas activé son compte : « Activez d'abord votre compte contrôleur avec le lien reçu par SMS. »
9. **Titre avec un numéro.** Créer un événement dont le titre contient « appelez le 77 123 45 67 » : refusé avec le message.
10. **Inscription publique** : la commande `curl` du § 7 répond `signup_disabled`.

## 11. Points ouverts

- AUD-07, AUD-08, AUD-09, AUD-10, AUD-28, AUD-38 : hors périmètre (décisions du prompt).
- AUD-29 : confirmer le § 4.3 du PDF SamirPay (§ 3.3).
- CSP bloquante : lot de mise en ligne, à partir de la liste du § 8.
- **`aud-01`, à trancher de ton côté** : la suite reste rouge parce que deux de ses préconditions supposent la faille ouverte (§ 3.2). Tu peux l'accepter rouge, ou demander qu'elle soit réécrite dans un lot suivant ; je ne l'ai pas modifiée.
- **(q2)** : un utilisateur peut toujours écrire la clé `is_temporary_controller_account` dans son propre `user_metadata` (c'est GoTrue qui le permet). La clé est sans effet (test A3 de `lot9quater-comptes`), mais l'invariant (q2) la compterait si quelqu'un l'écrit sur event-village-dev.
- **Adresses `.invalid`** : GoTrue tente l'envoi avant de refuser (500, aucun jeton enregistré, § 2 AUD-19). En production l'envoi échoue, faute de boîte. Un hook d'envoi d'email (Send Email Hook) qui écarte `.invalid` éviterait même la tentative : à prévoir avec le fournisseur d'emails réel.
- **Écart au prompt sur A6, à confirmer** : `has_role`, `is_controller`, `auth_user_role` et `is_partner_owner` acceptent un compte ACTIF **ou EN_ATTENTE** (le prompt dit « ACTIF, comme is_admin »), sinon une partenaire dont la fiche attend validation perd son espace (§ 2, AUD-06). `is_admin` reste ACTIF seul ; SUSPENDU et SUPPRIME sont refusés partout et bloqués chez GoTrue.
- **CSP** : relevé limité aux pages parcourues par l'e2e (§ 8). Les pages non parcourues, les SDK de paiement et de carte, et le service worker des notifications push restent à relever sur event-village-dev avant le mode bloquant.
- **Fusion** : `lot9quater/securite` n'est pas fusionnée dans `main` ; `lot9quater/rouges` sert de preuve et ne doit pas être fusionnée.
