# Lot 9 quinquies — Authentification : sûre et simple

Branche `lot9quinquies/authentification`, partie de `main` (ed2dc7ed), avec `origin/audit/authentification` (fc7bbe3) fusionnée en premier (5804e530). Preuve des tests rouges : branche `lot9quinquies/rouges` (tests seuls, jamais fusionnée).

## À lire en premier

**Correctifs de la contre-vérification (14/11).** Les cinq trous trouvés par la contre-vérification sont fermés (section suivante) : code administrateur exigé aussi par la base (REST et temps réel), identifiants de GoTrue secrets, send-otp REGISTER, affectations d'une fiche non validée, blocage de partner-halls-m7. Run « après » : **run 181** (commit de ce rapport), tout vert sauf `aud-07` (ignorée). Quatre migrations de plus (`20261112000011` à `…14`) : **quatorze** à appliquer, avec contrôles (§ 6). À faire en plus (§ 7) : fournisseur Téléphone fermé et limite de connexions par IP sur le tableau de bord. Rien n'est fusionné, aucune migration n'est appliquée.

**Lot livré.** Le run « après » est le **run 174** (e5e0df6f) : **379 suites sur 379 vertes**, les 3 suites `tests/audit-auth/` comprises, budgets de poids JavaScript respectés, `verify` OK en 5 étapes, e2e vert (les dix phases ; 441 captures, 0 en échec). Invariants (a) à (x), (q1) à (q8) et les nouveaux (p1) à (p3) à 0. Les deux seules lignes non nulles du journal sont les deux jeux de détection volontaires de `pilotage-invariant` (« sur le jeu »), présents à l'identique aux lots précédents.

- **Ce qui est fait.** D1 (SMS aux admins), A1 à A9, B1 à B6, C1 à C3 : les 13 constats de l'audit que le prompt traite (AUTH-01 à AUTH-12 et AUTH-14 ; AUTH-13 et AUTH-15 sont hors périmètre) et les trous T1 à T5. Détail au § 2, avec le commit du correctif et le test de chacun.
- **Suites d'audit.** Les 3 suites de `tests/audit-auth/` sont vertes au run « après », sans aucune modification (`git diff 5804e530 HEAD -- tests/audit tests/audit-auth` est vide). Les 8 suites de `tests/audit/` restent vertes.
- **Quatorze migrations à appliquer** sur event-village-dev (`20261112000001` à `…14`, dont 11 à 14 pour les correctifs de la contre-vérification), avec contrôles avant et après (§ 6). **Avant** : vérifier que chaque ADMIN et SUPERADMIN a un numéro `+221…` sur son compte (contrôle B du § 6.1). Sans numéro, il ne peut plus recevoir le code administrateur et n'ouvre plus l'administration.
- **À faire de ton côté** (§ 7) : longueur minimale 10 dans le tableau de bord Supabase, remplir le contact du support (réglages, section « Contact du support »), déployer l'application juste après les migrations.
- **Où j'en suis.** Fini. Dernier commit de code : e5e0df6f (poussé, run 174). Ce rapport est le commit suivant. Je m'arrête là, comme demandé : rien n'est fusionné dans `main`, aucune migration n'est appliquée sur event-village-dev.

## Correctifs de la contre-vérification

La contre-vérification (suites `tests/audit-auth/cv9qq-1` à `-6`, a7d994e8 puis 417d2b2d ; run 177) a trouvé cinq trous. Chacun a d'abord eu son test rouge (5202973c, aucun code de l'application modifié ; run 178), puis son correctif. Run « après » : **run 181**, sur le commit de ce rapport (code identique au run 180, plus le compte des aides du hotfix 03 et les citations de la recette) : 390 suites sur 390 vertes, `aud-07` ignorée comme avant ; les 6 suites `cv9qq-*` et les 8 suites de `tests/audit/` sont vertes ; e2e vert (dix phases).

### Preuve des rouges (run 178, 5202973c), sortie brute

```
tests/audit-auth/cv9qq-1-code-admin.test.ts                   FAIL     6.4s      1
tests/audit-auth/cv9qq-2-essais-connexion.test.ts             FAIL     5.2s      1
tests/audit-auth/cv9qq-6-compte-suspendu.test.ts              FAIL     1.9s      1
tests/parcours/lot9quinquies-cv-admin-rest.test.ts            FAIL     32.0s     1
tests/parcours/lot9quinquies-cv-controleur.test.ts            FAIL     3.6s      1
tests/parcours/lot9quinquies-cv-gotrue.test.ts                FAIL     3.1s      1
tests/parcours/lot9quinquies-cv-inscription.test.ts           FAIL     3.0s      1
TOTAL : 390 suite(s) — 382 réussie(s), 8 en échec, 0 expirée(s)

[CV-1a] 44 relation(s) lues par un ADMIN sans code ; fuites : admin_signals, controller_shifts, event_cancellations, event_status_history, events, hall_reservations, order_items, orders, participant_exports, partners, payments, platform_settings, referral_comm…
[CV-1e] controller/profile d'un ADMIN : sans code 200  ; avec code 200
[CV-2a] GoTrue directement : mot de passe, adresse réelle : accepté ; mot de passe, adresse en capitales : accepté ; mot de passe, numéro : refus 422 phone_provider_disabled ; …
[CV-2b] auth.users : {"total":1377,"with_phone":1372,"not_alias":1377,"same_as_profile":1375,"from_id":2}
[CV-2c] après création : GoTrue AUTRE ADRESSE, numéro PRÉSENT ; profil adresse réelle
[CV-4] scans selon la fiche : {"VALIDE":{"controleur":"200/…"},"EN_ATTENTE":{"controleur":"200/…","partenaire":"200/…"},"REJETE":{"controleur":"200/…"} …
[CV-5] 15 tours × 4 : blocages mutuels 0 ; autres écarts 0
```

(La 8e suite rouge du run 178, `recette-matrice`, venait des citations `fichier:ligne` décalées par les imports ajoutés ; recalées en 466d3451.)

### Point 1 — code administrateur exigé aussi par la base (REST et temps réel)

- **Constat.** Un jeton ADMIN ou SUPERADMIN qui n'avait pas passé le code lisait par PostgREST 44 relations, dont `payments`, `partners`, `events`, `orders`, `platform_settings`, et recevait les signaux admin en temps réel : le code n'était exigé que par les routes de l'application. `GET /api/controller/profile` répondait 200 sans le code.
- **Cause.** `is_admin()` et `is_superadmin()` ne regardaient que le rôle et le statut du compte ; toutes les politiques réservées aux admins passent par elles.
- **Correctif** (e89b8bdf, 8885a35c ; migration 11). Table `admin_session_codes` (une ligne par session de GoTrue : `session_id` du jeton, heure du code). `admin_session_code_valid()` est vraie si la session du jeton a passé le code depuis moins de 12 h. `is_admin()` et `is_superadmin()` l'exigent : toute politique de lecture réservée aux admins l'exige donc, REST et temps réel compris (le temps réel évalue la RLS avec le jeton de l'abonné). Le code posé par la fenêtre de l'administration (`admin_step_up_check`, `admin_device_verified`) inscrit la session. Un admin garde ses propres données (les branches « mon compte » des politiques ne passent pas par `is_admin`). `GET /api/controller/profile` exige le code pour un compte admin.
- **Tests.** `lot9quinquies-cv-admin-rest` (a : balayage de toutes les relations lisibles par `authenticated`, admin sans code contre client ; b : témoin après le code ; c : code de plus de 12 h ; d : temps réel ; e : `controller/profile`), `cv9qq-1`.

### Point 2 — identifiants de GoTrue secrets

- **Constat.** GoTrue, appelé directement avec la clé publique et l'adresse réelle d'une victime, acceptait les essais sans la limite de 10 échecs par compte et ouvrait la session. 1 377 comptes sur 1 377 avaient une adresse de connexion connue (adresse réelle, ou tirée de l'identifiant du compte).
- **Correctif** (9bff76c6, 292b3f9a, e9f49f3b ; migration 12).
  - `auth.users.email` est **toujours** une adresse technique `k<40 hexadécimaux>@comptes.eventvillage.invalid`, tirée d'une empreinte HMAC-SHA256 de l'identifiant du compte avec une clé de 32 octets tirée au hasard par la migration. La clé est dans le schéma `private`, que l'API n'expose pas et qu'aucun rôle de l'API ne lit. Sans la clé, l'adresse ne se recalcule pas.
  - L'adresse réelle reste dans `public.users`. `POST /api/auth/login` fait la correspondance (numéro ou adresse → compte → identifiant GoTrue relu par l'API d'administration) ; une adresse saisie n'est jamais envoyée telle quelle à GoTrue.
  - Garanti par la base : un déclencheur avant toute mise à jour de `auth.users` remet l'adresse technique (et l'identité email de GoTrue) ; `handle_new_user` la pose juste après la création. Les appels de l'application qui écrivent encore une adresse dans `auth.users` (`updateUserById`) restent, sans effet sur l'identifiant ; à simplifier plus tard.
  - Inscription client et inscription partenaire : la session est ouverte côté serveur avec l'identifiant GoTrue (plus de connexion du navigateur avec l'adresse saisie).
  - **Numéro : option « connexion par téléphone fermée côté GoTrue ».** `auth.users.phone` garde le numéro : GoTrue en garantit l'unicité, sur laquelle reposent le changement de numéro (lot 9, AM1) et les invariants de synchronisation. Vider les numéros aurait retiré cette garantie. GoTrue refuse toute connexion par numéro (`phone_provider_disabled`, prouvé en CI ; `/auth/v1/settings` rend `external.phone = false`).
  - **Hook de vérification du mot de passe** (« Password Verification Attempt ») : réservé aux offres Team et Enterprise de Supabase. Je ne l'ai pas ajouté : l'offre d'event-village-dev n'est pas établie, et le correctif n'en dépend pas (GoTrue ne connaît plus d'identifiant devinable).
  - **Reprise des comptes existants** dans la migration, avec contrôles avant et après (NOTICE) ; la migration échoue d'elle-même si un compte garde une autre adresse.
- **Tests.** `lot9quinquies-cv-gotrue` (a : un attaquant qui connaît le numéro et l'adresse réelle d'une victime, en clair, en capitales, numéro avec et sans `+`, code par SMS, n'ouvre aucune session par GoTrue ; témoin : la connexion de l'application marche ; b : tous les comptes ont l'adresse d'empreinte, fournisseur Téléphone fermé ; c : création et mise à jour gardent l'empreinte), `cv9qq-2`.

### Point 3 — send-otp, objet REGISTER

- **Constat.** `POST /api/auth/send-otp` avec l'objet REGISTER envoyait un SMS à un numéro déjà inscrit, compte SUSPENDU compris.
- **Correctif** (d1ed977e). Refus avant tout SMS pour un numéro qui a déjà un compte, quel que soit son statut : 409 `PHONE_ALREADY_REGISTERED`, exactement la réponse de `/api/auth/register/start` (même constante, `lib/auth/existing-account.ts`). Les autres objets ne changent pas.
- **Tests.** `lot9quinquies-cv-inscription` (REGISTER, SIGNUP, INSCRIPTION ; comptes ACTIF et SUSPENDU ; réponse identique à `register/start`, aucun SMS), `cv9qq-6`.

### Point 4 — affectations de contrôleurs d'une fiche ni VALIDE ni SUSPENDU

- **Constat.** Fiche remise EN_ATTENTE ou REJETE : la contrôleuse affectée, et la partenaire affectée à son propre événement, scannaient encore (200).
- **Correctif** (aabfa107, e9f49f3b ; migration 13). `scan_scanner_authorized`, par où passent toutes les RPC du contrôle d'accès (scan, liste d'invités, recherche, codes hors ligne, portes, caisse), exige que la fiche de l'événement soit VALIDE ou SUSPENDU pour un contrôleur affecté et pour la partenaire. La lecture des billets par la REST suit la même règle : branche contrôleur de `tickets_read` par l'aide RLS `controller_assignment_active(uuid)`, qui ne répond que pour le compte appelant (elle ne dit rien de la fiche d'un événement où l'on n'est pas affecté). SUSPENDU garde les affectations, comme la garde des fiches. ADMIN (`access.operate`) et SUPERADMIN ne sont pas concernés.
- **Tests.** `lot9quinquies-cv-controleur` (VALIDE : 200 ; EN_ATTENTE et REJETE : refus pour la contrôleuse et pour la partenaire ; SUSPENDU : 200), `cv9qq-4`.

### Point 5 — partner-halls-m7 (blocage mutuel)

- **Cause.** Pas les déclencheurs de `partners`. Deux réservations simultanées qui se chevauchent sur la même salle : la contrainte d'exclusion `no_overlapping_hall_reservations` vérifie le chevauchement **après** avoir inscrit la ligne dans son index ; chaque transaction attend alors la fin de l'autre, d'où le blocage mutuel (40P01) au lieu d'un refus propre.
- **Correctif** (4c625471 ; migration 14). `check_hall_availability` prend d'abord un verrou consultatif par salle (`pg_advisory_xact_lock`, clé tirée de l'identifiant de la salle) : les réservations d'une même salle passent l'une après l'autre ; la seconde voit la première et reçoit le refus « salle déjà réservée ».
- **Tests.** `partner-halls-m7` est gardé tel quel et vert. `lot9quinquies-cv-salles` (15 tours de 4 réservations simultanées) : **0 blocage au run 178 déjà, avant le correctif** ; la fenêtre est trop étroite pour être reproduite à coup sûr. La cause est établie par le raisonnement ci-dessus, pas par une reproduction ; le correctif rend le blocage impossible par construction.

### Effets à connaître

- **Script de développement** `scripts/dev/essai-fiche-partenaire.mjs` : il se connectait chez GoTrue avec l'adresse `partenaire@essai.eventvillage.invalid` et la seule clé publique. Il ne marche plus, par construction : c'est précisément l'attaque fermée au point 2.
- **Fenêtre entre la migration 12 et le déploiement** : l'application d'avant envoie l'adresse saisie à GoTrue ; la connexion par adresse et la connexion après l'inscription échouent tant que la nouvelle application n'est pas déployée. La connexion par numéro marche dans les deux versions (la route serveur relit l'identifiant GoTrue).
- **Administrateurs** : après la migration 11, un admin dont la session n'a pas passé le code ne lit plus rien d'admin par la REST ni par le temps réel. Les écrans de l'administration passent déjà par la fenêtre du code ; une session ouverte avant la migration doit repasser le code une fois.

## 1. Méthode et runs

- Run « avant » : **169** (id 43518906758, 5804e530, après la fusion de l'audit). Exactement les 3 suites `auth-01`, `auth-02`, `auth-03` rouges, tout le reste vert (les 8 suites de `tests/audit/` comprises), e2e vert.
- Tests rouges avant chaque correctif : chaque point a un commit `test(9qq.…)` suivi de son commit `fix(9qq.…)`. Les suites nouvelles du lot, seules sur la base 5804e530, forment la branche `lot9quinquies/rouges` ; son run (run 172) les montre rouges (§ 1.2).
- Run « après » : **run 174, id 43549193996, commit e5e0df6f**, détail au § 1.3.
- Travail séquentiel, un commit par point (test, puis correctif). Les poussées ont été groupées quand un run de la branche tournait : une poussée l'aurait annulé (`cancel-in-progress`).
- Invariants : (a) à (x) des lots précédents, (q1) à (q8) du lot 9 quater, plus trois nouveaux (`tests/helpers/lot9quinquies-invariants.ts`), appelés en fin de chaque suite nouvelle du lot :
  - (p1) au plus une ligne `ADMIN_REVIEW_SMS` en attente (PENDING) par admin ;
  - (p2) au moins 30 minutes entre deux SMS `ADMIN_REVIEW_SMS` envoyés au même admin ;
  - (p3) aucun SMS `ADMIN_REVIEW_SMS` envoyé entre 22 h et 8 h (heure de Dakar).
- Aucun test contre un projet distant : tout tourne sur le Supabase local de la CI. `.env.local` et `.private/` n'ont pas été lus.

### 1.1 Run « avant » (169), sortie brute

```
tests/audit-auth/auth-01-connexion-essais-par-compte.test.ts  FAIL     1.7s      1     .test-logs/tests__audit-auth__auth-01-connexion-essais-par-compte.test.ts.log
tests/audit-auth/auth-02-mot-de-passe-cree-par-admin.test.ts  FAIL     534ms     1     .test-logs/tests__audit-auth__auth-02-mot-de-passe-cree-par-admin.test.ts.log
tests/audit-auth/auth-03-delai-attente-affiche.test.ts        FAIL     235ms     1     .test-logs/tests__audit-auth__auth-03-delai-attente-affiche.test.ts.log
tests/audit/aud-00-catalogue.test.ts                          PASS     668ms     0     .test-logs/tests__audit__aud-00-catalogue.test.ts.log
tests/audit/aud-01-comptes-gotrue.test.ts                     PASS     1.4s      0     .test-logs/tests__audit__aud-01-comptes-gotrue.test.ts.log
tests/audit/aud-04-webhook-journal.test.ts                    PASS     343ms     0     .test-logs/tests__audit__aud-04-webhook-journal.test.ts.log
tests/audit/aud-05-sms-plafond-global.test.ts                 PASS     441ms     0     .test-logs/tests__audit__aud-05-sms-plafond-global.test.ts.log
tests/audit/aud-06-partenaire-suspendu.test.ts                PASS     1.0s      0     .test-logs/tests__audit__aud-06-partenaire-suspendu.test.ts.log
tests/audit/aud-07-enumeration-comptes.test.ts                PASS     292ms     0     .test-logs/tests__audit__aud-07-enumeration-comptes.test.ts.log
tests/audit/aud-17-redirection-connexion.test.ts              PASS     195ms     0     .test-logs/tests__audit__aud-17-redirection-connexion.test.ts.log
tests/audit/aud-19-code-email-adresse-technique.test.ts       PASS     474ms     0     .test-logs/tests__audit__aud-19-code-email-adresse-technique.test.ts.log
...
TOTAL : 367 suite(s) — 364 réussie(s), 3 en échec, 0 expirée(s)
[verify] ÉCHEC à l'étape "test" (code 1).
```

### 1.2 Preuve des rouges (branche `lot9quinquies/rouges`)

Run **172** (https://github.com/fallouu-mn/event-village/actions/runs/43531650963, branche `lot9quinquies/rouges`, caaf38e6). Contenu : la base 5804e530, plus les seules suites nouvelles du lot (`tests/parcours/lot9quinquies-*`, `tests/schema/migration-lot9quinquies-rejouable`) et leurs aides (`tests/helpers/lot9quinquies-invariants.ts`, `tests/helpers/admin-step-up.ts`, qui n'écrit rien si les tables du lot manquent, `writeLocal` de `tests/helpers/db.ts`), **sans aucun correctif** (commit 4d696a71). Sur cette branche seulement, `scripts/verify.mjs` saute le typecheck et le lint (commit caaf38e6, même changement de deux lignes qu'au lot 9 quater) : sinon le typecheck s'arrête sur les modules qui n'existent pas encore et aucun test ne tourne. Cette branche n'est pas fusionnée.

Lignes en échec du tableau final, sortie brute (extrait de `verify.log`) :

```
tests/audit-auth/auth-01-connexion-essais-par-compte.test.ts  FAIL     2.0s      1     .test-logs/tests__audit-auth__auth-01-connexion-essais-par-compte.test.ts.log
tests/audit-auth/auth-02-mot-de-passe-cree-par-admin.test.ts  FAIL     642ms     1     .test-logs/tests__audit-auth__auth-02-mot-de-passe-cree-par-admin.test.ts.log
tests/audit-auth/auth-03-delai-attente-affiche.test.ts        FAIL     247ms     1     .test-logs/tests__audit-auth__auth-03-delai-attente-affiche.test.ts.log
tests/parcours/lot9quinquies-activation.test.ts               FAIL     4.4s      1     .test-logs/tests__parcours__lot9quinquies-activation.test.ts.log
tests/parcours/lot9quinquies-admin.test.ts                    FAIL     3.2s      1     .test-logs/tests__parcours__lot9quinquies-admin.test.ts.log
tests/parcours/lot9quinquies-codes.test.ts                    FAIL     2.8s      1     .test-logs/tests__parcours__lot9quinquies-codes.test.ts.log
tests/parcours/lot9quinquies-connexion.test.ts                FAIL     5.8s      1     .test-logs/tests__parcours__lot9quinquies-connexion.test.ts.log
tests/parcours/lot9quinquies-ecrans.test.ts                   FAIL     2.2s      1     .test-logs/tests__parcours__lot9quinquies-ecrans.test.ts.log
tests/parcours/lot9quinquies-fiche-partenaire.test.ts         FAIL     3.8s      1     .test-logs/tests__parcours__lot9quinquies-fiche-partenaire.test.ts.log
tests/parcours/lot9quinquies-messages.test.ts                 FAIL     2.8s      1     .test-logs/tests__parcours__lot9quinquies-messages.test.ts.log
tests/parcours/lot9quinquies-mot-de-passe.test.ts             FAIL     2.4s      1     .test-logs/tests__parcours__lot9quinquies-mot-de-passe.test.ts.log
tests/parcours/lot9quinquies-recuperation-email.test.ts       FAIL     2.7s      1     .test-logs/tests__parcours__lot9quinquies-recuperation-email.test.ts.log
tests/parcours/lot9quinquies-recuperation.test.ts             FAIL     2.9s      1     .test-logs/tests__parcours__lot9quinquies-recuperation.test.ts.log
tests/parcours/lot9quinquies-sms-admins.test.ts               FAIL     3.0s      1     .test-logs/tests__parcours__lot9quinquies-sms-admins.test.ts.log
tests/parcours/perf-statique.test.ts                          FAIL     4.1s      1     .test-logs/tests__parcours__perf-statique.test.ts.log
tests/schema/migration-lot9quinquies-rejouable.test.ts        FAIL     5.8s      1     .test-logs/tests__schema__migration-lot9quinquies-rejouable.test.ts.log
TOTAL : 379 suite(s) — 363 réussie(s), 16 en échec, 0 expirée(s)
[verify] ÉCHEC à l'étape "test" (code 1).
```

Premier message d'échec de chaque suite (tronqué) :

```
auth-01            aucun refus par compte après 20 mauvais mots de passe venus de 20 adresses : 1:401/INVALID_CREDENTIALS 2:401/…
auth-02            compte créé avec un mot de passe de 6 minuscules et chiffres (HTTP 200) : aucune règle de mot de passe sur ce chemin
auth-03            délai lu dans un champ que le serveur n'envoie jamais :
                   components/auth/LoginForm.tsx:396 setLockoutRemaining(resolveData.remainingSeconds || LOCKOUT_DURATION_SECONDS);
activation (A2)    {"success":true,…,"message":"Utilisateur avec le rôle CLIENT créé avec succès."}   (mot de passe de l'admin accepté)
admin (A3, A4)     {"success":true,"users":[…]}   (administration ouverte sans mot de passe ni code)
codes (A5, A6)     réglage support.whatsapp absent (migration 20261112000003)
connexion (A1)     compte connu : 429 au 11e essai
ecrans (B1-B6)     trois réglages
fiche (A9)         routes ouvertes à une fiche EN_ATTENTE : POST activation : 403 {"error":"Le compte partenaire doit d'abord être validé…"}, …
messages (C2, C3)  SMS EMAIL_ADDED mis en file : []
mot-de-passe (A7)  accepté à tort : Senegal2026! (12 caractères) ; accepté à tort : Teranga!!2026 (13 caractères)
recuperation-email Cannot find module '…/app/api/auth/forgot-password/route'
recuperation (A8)  session volée : {"ok":true,"message":"Mot de passe modifié. Connectez-vous avec le nouveau."}
sms-admins (D1)    SUPERADMIN : une ligne ADMIN_REVIEW_SMS ([])
rejouable          migrations 20261112… présentes : aucune
```

`perf-statique` est rouge par l'effet de la branche elle-même (elle vérifie les étapes de `verify.mjs`, modifié sur cette branche seulement), comme au lot 9 quater. Toutes les autres suites sont vertes : les suites existantes que le lot modifie ne sont pas sur cette branche (elles sont dans leur version d'avant le lot). Les commits de test du lot, sur la branche principale, précèdent chacun leur correctif (§ 2).

### 1.3 Run « après », sortie brute

Run 174 (https://github.com/fallouu-mn/event-village/actions/runs/43549193996), commit e5e0df6f, `verify.log` et `e2e.log` sur `origin/ci-results`, dossier `runs/174-43549193996/`. Aucune ligne en échec dans le tableau final ; suites d'audit et suites du lot, puis le total :

```
tests/audit-auth/auth-01-connexion-essais-par-compte.test.ts  PASS     1.4s      0     .test-logs/tests__audit-auth__auth-01-connexion-essais-par-compte.test.ts.log
tests/audit-auth/auth-02-mot-de-passe-cree-par-admin.test.ts  PASS     516ms     0     .test-logs/tests__audit-auth__auth-02-mot-de-passe-cree-par-admin.test.ts.log
tests/audit-auth/auth-03-delai-attente-affiche.test.ts        PASS     211ms     0     .test-logs/tests__audit-auth__auth-03-delai-attente-affiche.test.ts.log
tests/audit/aud-00-catalogue.test.ts                          PASS     684ms     0     .test-logs/tests__audit__aud-00-catalogue.test.ts.log
tests/audit/aud-01-comptes-gotrue.test.ts                     PASS     1.4s      0     .test-logs/tests__audit__aud-01-comptes-gotrue.test.ts.log
tests/audit/aud-04-webhook-journal.test.ts                    PASS     350ms     0     .test-logs/tests__audit__aud-04-webhook-journal.test.ts.log
tests/audit/aud-05-sms-plafond-global.test.ts                 PASS     472ms     0     .test-logs/tests__audit__aud-05-sms-plafond-global.test.ts.log
tests/audit/aud-06-partenaire-suspendu.test.ts                PASS     1.1s      0     .test-logs/tests__audit__aud-06-partenaire-suspendu.test.ts.log
tests/audit/aud-07-enumeration-comptes.test.ts                PASS     309ms     0     .test-logs/tests__audit__aud-07-enumeration-comptes.test.ts.log
tests/audit/aud-17-redirection-connexion.test.ts              PASS     196ms     0     .test-logs/tests__audit__aud-17-redirection-connexion.test.ts.log
tests/audit/aud-19-code-email-adresse-technique.test.ts       PASS     501ms     0     .test-logs/tests__audit__aud-19-code-email-adresse-technique.test.ts.log
tests/parcours/lot9quinquies-activation.test.ts               PASS     3.5s      0     .test-logs/tests__parcours__lot9quinquies-activation.test.ts.log
tests/parcours/lot9quinquies-admin.test.ts                    PASS     4.3s      0     .test-logs/tests__parcours__lot9quinquies-admin.test.ts.log
tests/parcours/lot9quinquies-codes.test.ts                    PASS     2.5s      0     .test-logs/tests__parcours__lot9quinquies-codes.test.ts.log
tests/parcours/lot9quinquies-connexion.test.ts                PASS     5.2s      0     .test-logs/tests__parcours__lot9quinquies-connexion.test.ts.log
tests/parcours/lot9quinquies-ecrans.test.ts                   PASS     1.9s      0     .test-logs/tests__parcours__lot9quinquies-ecrans.test.ts.log
tests/parcours/lot9quinquies-fiche-partenaire.test.ts         PASS     3.1s      0     .test-logs/tests__parcours__lot9quinquies-fiche-partenaire.test.ts.log
tests/parcours/lot9quinquies-messages.test.ts                 PASS     2.4s      0     .test-logs/tests__parcours__lot9quinquies-messages.test.ts.log
tests/parcours/lot9quinquies-mot-de-passe.test.ts             PASS     2.1s      0     .test-logs/tests__parcours__lot9quinquies-mot-de-passe.test.ts.log
tests/parcours/lot9quinquies-recuperation-email.test.ts       PASS     2.6s      0     .test-logs/tests__parcours__lot9quinquies-recuperation-email.test.ts.log
tests/parcours/lot9quinquies-recuperation.test.ts             PASS     2.6s      0     .test-logs/tests__parcours__lot9quinquies-recuperation.test.ts.log
tests/parcours/lot9quinquies-sms-admins.test.ts               PASS     2.8s      0     .test-logs/tests__parcours__lot9quinquies-sms-admins.test.ts.log
tests/schema/migration-lot9quinquies-rejouable.test.ts        PASS     4.1s      0     .test-logs/tests__schema__migration-lot9quinquies-rejouable.test.ts.log
tests/schema/migrations-gelees.test.ts                        PASS     236ms     0     .test-logs/tests__schema__migrations-gelees.test.ts.log
TOTAL : 379 suite(s) — 379 réussie(s), 0 en échec, 0 expirée(s)
[JS-BUDGET] / : 216984 octets gzip (217,0 Ko), 17 fichier(s) JS, 748076 octets bruts — budget 217000 octets (217,0 Ko) : OK
[JS-BUDGET] /events/[id] : 223288 octets gzip (223,3 Ko), 17 fichier(s) JS, 771317 octets bruts — budget 224000 octets (224,0 Ko) : OK
[JS-BUDGET] /tickets : 239540 octets gzip (239,5 Ko), 20 fichier(s) JS, 820574 octets bruts — budget 241000 octets (241,0 Ko) : OK
[JS-BUDGET] /controller/scanner : 224971 octets gzip (225,0 Ko), 17 fichier(s) JS, 776613 octets bruts — budget 226000 octets (226,0 Ko) : OK
[JS-BUDGET] /billet/hors-ligne : 212571 octets gzip (212,6 Ko), 15 fichier(s) JS, 737468 octets bruts — budget 215000 octets (215,0 Ko) : OK
[verify] OK — 5 étapes réussies en 1465s.
```

Invariants, lignes non nulles du journal (toutes les autres sont à 0 ; `[INVARIANT-LOT9QUINQUIES] … (p) : 0 violation(s)` dans chacune des 12 suites nouvelles) :

```
[INVARIANT-CYCLE] pilotage-invariant — billet UTILISE sans scan : 1 violation(s) (l) sur le jeu
[INVARIANT-CYCLE] pilotage-invariant — paiement espèces détaché : 1 violation(s) (l) sur le jeu
```

E2e : `[e2e] résumé :connexion OK · captures OK · emails OK · dev-page OK · fumee OK · terrain OK · pwa OK · fake-prod OK · perf OK · recette OK` (27,4 min ; 441 captures, 0 en échec).

Runs intermédiaires : 170 (af548078, 258 suites rouges : aides de test qui écrivaient par une transaction en lecture seule, build cassé), 171 (b45e918c, 15 suites rouges et 3 captures), 173 (c3cc0f5b, tests et e2e verts, budget de poids dépassé de 198 et 204 octets). Chaque rouge a été corrigé par un commit dédié (§ 2, « Correctifs de CI ») et le § 9 donne la raison de chaque test modifié. Le run 172 appartient à la branche `lot9quinquies/rouges` (§ 1.2).

## 2. État de chaque point

Colonnes : point, ce qui est fait, commit du correctif, test qui le prouve (suite, et commit du test rouge). Toutes les suites citées sont vertes au run « après ».

### D1. SMS aux administrateurs

| Point | Ce qui est fait | Correctif | Test |
|---|---|---|---|
| D1 | Type `ADMIN_REVIEW_SMS` (indispensable, SMS seul, audience admin). Déclencheurs en base : candidature (fiche EN_ATTENTE créée), dossier complété après refus (`resubmitted_at`), événement passé de BROUILLON à EN_ATTENTE. Destinataires : SUPERADMIN, et ADMIN qui a `partners.validate` (partenaires) ou `events.write` (événements). Premier SMS dans la minute ; la suite est regroupée dans **une** ligne en attente par admin (compteurs), envoyée au plus tôt 30 minutes après le SMS précédent ; de 22 h à 8 h (Dakar), l'envoi est reporté à 8 h. | 3506c391 | `lot9quinquies-sms-admins` (6c02d8d4) : candidature par la vraie route → SMS au SUPERADMIN et à l'ADMIN `partners.validate`, rien à l'ADMIN sans ; trois candidatures en 10 min → deux SMS (le premier, puis le regroupé à +30 min) ; candidature à 23 h → SMS à 8 h ; événement soumis → ADMIN `events.write`, rien à celui qui n'a que `partners.validate`. Invariants (p1) à (p3). |

### A. Sécurité des comptes

| Point | Ce qui est fait | Correctif | Test |
|---|---|---|---|
| A1 (AUTH-01, T3) | 10 échecs par compte et par 15 minutes (fenêtre glissante). L'essai est réservé **avant** la vérification du mot de passe, sous verrou (`auth_login_attempt_begin`/`_end`) : des essais en parallèle ne dépassent pas la limite. Clé : le compte réel, ou une empreinte de l'identifiant inconnu (même réponse pour un numéro inconnu : aucune énumération). 11e essai : 429 `LOGIN_ACCOUNT_LOCKED`, `retryAfterSeconds` réel, même le bon mot de passe est refusé. Au 10e échec : avis `ACCOUNT_LOGIN_FAILURES` (SMS et email), une fois par jour (Dakar). Un succès ne compte pas comme un échec. | ad5cd57b | `auth-01` (audit) ; `lot9quinquies-connexion` (4754e46b) |
| A2 (AUTH-02, T2) | L'admin ne saisit plus de mot de passe : un champ `password` envoyé est refusé (400 `PASSWORD_NOT_ALLOWED`). Le compte est créé avec un mot de passe aléatoire jamais montré et la marque `account_activation_pending` ; SMS avec un lien `/activation?t=…` de 24 h à usage unique (empreinte en base) ; écran `/activation` où la personne choisit son mot de passe (règle A7). Liste des utilisateurs : badge « Activation en attente » et bouton « Renvoyer le lien ». Connexion refusée tant que le compte n'est pas activé, avec le message qui le dit. | b6c99df2 | `auth-02` (audit) ; `lot9quinquies-activation` (dbf3d262) |
| A3 (AUTH-05) | Code SMS administrateur exigé des ADMIN et SUPERADMIN (premier SUPERADMIN compris) sur un nouvel appareil et après 12 h. Texte du chef de projet (§ 4). Appareil = cookie httpOnly `ev_admin_device` (seule son empreinte est en base), ou la session elle-même pour un client par jeton. Code à 6 chiffres, 10 minutes, 5 essais, usage unique, empreinte HMAC dans sa propre table `admin_step_up_codes`. Le code administrateur n'ouvre jamais de session. | af548078, 555c9360 | `lot9quinquies-admin` (ef13f21f) |
| A4 (AUTH-04) | Administration : 30 minutes sans activité → mot de passe redemandé dans une fenêtre, sans quitter la page (`AdminStepUpGate`) ; 12 h → mot de passe et code SMS. Mot de passe redemandé : 5 échecs par 15 minutes, une saisie juste ne compte pas. La page reste rendue sous la fenêtre. Cookies de session `Secure` dès que l'application est en HTTPS (serveur : `secureCookies()` ; navigateur : constante calculée à la construction), pas en local. Sessions des clients inchangées. Le délai d'inactivité se règle par `ADMIN_IDLE_TIMEOUT_MINUTES` (5 à 240, 30 par défaut ; 240 en e2e seulement, à ne pas poser en production). | af548078, 629de74d, a82d37be | `lot9quinquies-admin` (ef13f21f) : 403 mot de passe, puis 403 code SMS, puis 200 ; IDLE ; 12 h ; cookies Secure |
| A5 (T1) | Compte SUSPENDU refusé **avant** toute réservation de SMS (send-otp) et avant toute écriture ou lien de session (verify-otp) : 403 `ACCOUNT_SUSPENDED` « Votre compte est suspendu. » suivi du contact du support, ou du lien `{lien}/aide` si aucun contact n'est renseigné. | 509049fc | `lot9quinquies-codes` (28c08693) |
| A6 (AUTH-14) | verify-otp ne rend plus que `{ success, verified, token_hash, user: { id } }` : ni adresse, ni numéro, ni rôle. | 509049fc | `lot9quinquies-codes` (28c08693), 4e test |
| A7 (AUTH-11) | Règle commune (`lib/auth/password-rules.ts`, partagée avec les écrans) : 10 à 64 caractères, **aucune composition imposée** ; refus des mots de passe évidents (répétitions, suites de chiffres, numéro de téléphone, mots courants dont des mots sénégalais) et de la liste SecLists des 10 000 mots de passe courants (licence MIT), complétée de mots sénégalais (`common-passwords.data.ts`, serveur seulement), avec ou sans chiffres autour. GoTrue : `minimum_password_length = 10`. S'applique aux nouveaux mots de passe seulement (inscription, changement, récupération, activation, contrôleur) : les mots de passe existants restent valables. Écrans : liste de contrôle « 10 caractères au moins », « 64 au plus », « Pas un mot de passe courant ». | 0825dca5, 88e8a874 | `lot9quinquies-mot-de-passe` (5c29667e) |
| A8 | L'autorisation « Mot de passe oublié » est liée à la session **ouverte par le code** : `account_recovery_consume` exige une session créée après la vérification du code (`auth.sessions.created_at ≥ issued_at`). 10 minutes, usage unique. Une session déjà ouverte (volée) ne peut plus choisir le mot de passe. | edccc76e | `lot9quinquies-recuperation` (b45437b2) |
| A9 | `is_partner_owner` exige une fiche **VALIDE** (SUSPENDU gardé pour les lectures, décision du lot 6). Garde centrale dans `requireActiveSession` (`lib/auth/partner-fiche-guard.ts`) : une fiche EN_ATTENTE ou REJETE n'a que sa liste blanche (§ 3). | 8ad2a57e, b64da898 | `lot9quinquies-fiche-partenaire` (67230928) : fiche remise EN_ATTENTE, chaque route `/api/partner` hors liste blanche → 403 `PARTNER_NOT_VALIDATED` (transition comprise, quel que soit le corps) ; scan refusé ; REST refusée ; REJETE ; témoin VALIDE |

### B. Simplicité et aide

| Point | Ce qui est fait | Correctif | Test |
|---|---|---|---|
| B1 (AUTH-06) | Réglages SUPERADMIN « Numéro WhatsApp du support », « Téléphone du support », « Email du support » (réglages financiers, section « Contact du support »), validés en base (format `+…` E.164, adresse email). `essai:check-reel` exige au moins un contact (et relève une inactivité). Page publique `/aide` : contact lu dans les réglages et 5 réponses courtes. Chaque « contactez le support » du serveur est suivi du contact ou du lien `{lien}/aide` (`contactSupport()`), et les écrans renvoient vers `/aide`. SMS `PASSWORD_CHANGED` : « Si ce n'est pas vous : Mot de passe oublié sur {lien}/forgot-password ». | 223dcf65 | `lot9quinquies-ecrans` (eb29c88b) ; `essai-check-reel` ; `notif-modeles` |
| B2 (AUTH-08, T5) | « Mot de passe oublié » par email : le lien part de l'application par Resend (`POST /api/auth/forgot-password`), même expéditeur, modèle en français, 60 minutes, usage unique, réponse toujours neutre, quotas par IP (10/h) et par adresse (3/h). Seule une adresse **vérifiée** d'un compte ACTIF reçoit le lien. `POST /api/auth/reset-password { token, password }` sans session ; les autres sessions sont fermées et l'avis part. GoTrue n'envoie plus aucun email : le trigger `auth_users_guard_writes` exige le permis `EMAIL_LINK` pour tout jeton email (`/auth/v1/recover` refusé, aucun jeton). Le SMTP de Supabase devient inutile (`docs/deploiement-projet-neuf.md`). | f5ee3450 | `lot9quinquies-recuperation-email` (961624d1) |
| B3 (AUTH-03, E-56) | Connexion, mot de passe oublié, inscription partenaire et fenêtres du compte lisent `retryAfterSeconds` (`retryAfterOf`) et disent le délai réel : secondes jusqu'à 2 minutes, puis minutes, puis heures (`lib/format-delay.ts`). | 4a1d54ee | `auth-03` (audit) ; `notif-interface` (dc1ded51) |
| B4 (AUTH-07) | « Se déconnecter » ne ferme que cet appareil (portée locale), scanner compris (« cet appareil seulement »). Profil : « Déconnecter tous mes appareils » avec la confirmation « Vos billets hors ligne seront effacés sur les autres téléphones. » | ab0e75b2 | `lot9quinquies-ecrans` (eb29c88b) |
| B5 | Aide sous le champ de connexion : « Email : seulement si votre adresse a été vérifiée. Sinon, utilisez votre numéro. » Profil : bandeau « Adresse email non vérifiée » avec « Recevoir le lien de vérification ». | 444b2701 | `lot9quinquies-ecrans` ; `email-verification` |
| B6 | « Recevoir un code de connexion » (inscription, numéro déjà inscrit) ouvre l'onglet « Code SMS » de la connexion, numéro prérempli (gardé hors de l'adresse de la page). | 444b2701 | `lot9quinquies-ecrans` |

### C. Messages

| Point | Ce qui est fait | Correctif | Test |
|---|---|---|---|
| C1 (AUTH-10) | SMS de code : « Event Village : votre code est {code}. Ne le donnez à personne. Valable 10 minutes. » ; variante de réinitialisation. | 76c32069 | `textes-sms-9bis`, `notif-modeles` (21cf52ce) |
| C2 (AUTH-09) | Nouvelle adresse email vérifiée : SMS `EMAIL_ADDED` au numéro du compte (déclencheur sur l'usage du lien de vérification). Changement d'adresse : email à l'**ancienne** adresse vérifiée (aucune des deux adresses dans le message). | 6e91f373 | `lot9quinquies-messages` (39e69841) |
| C3 | Inscription partenaire : SMS d'accusé `PARTNER_REGISTERED_ACK`. | 6e91f373 | `lot9quinquies-messages` (39e69841) |

### Correctifs de CI

| Commit | Objet |
|---|---|
| a8875fbb, 555c9360 | Run 170 (258 suites rouges) : les aides de test écrivaient par `inspect()`, qui est en lecture seule → `writeLocal()`. Build : la page admin (composant client) tirait `node:crypto` par `admin-auth` → `ADMIN_PERMISSIONS` dans `lib/admin/permissions.ts`. Le code administrateur dans sa propre table (la contrainte `otp_codes_purpose_check` est gelée par la garde du lot 9 ter). Détail au § 9. |
| b45e918c | Gel des migrations `20261111…` (empreintes de `main` ed2dc7ed) ; `20261112000001` à `…10` rejouées deux fois (transaction annulée). |
| 61fe5cf9 | Run 171 : la liste des utilisateurs (`GET /api/admin/users`) lisait l'état d'activation de tous les comptes d'un seul filtre `in` : « URI too long », 500. Lecture par lots de 100. |
| b64da898 | Run 171, **trou réel trouvé par le test A9** : la base ne refuse à une fiche non validée que la soumission et la publication d'un événement ; retrait, annulation et autres transitions restaient ouverts à une fiche EN_ATTENTE. La route de transition refuse maintenant toute transition d'une fiche ni VALIDE ni SUSPENDU, avant de lire le corps (texte de la base gardé pour la soumission et la publication). |
| 629de74d | Run 171 : le mot de passe redemandé dans l'administration comptait 5 saisies par 15 minutes, **justes comprises** : un admin qui rouvre souvent l'administration (et la fixture ADMIN des tests de sécurité) était bloqué. Ne comptent plus que les échecs, par le même compteur que la connexion (A1), avec une clé distincte et sans l'avis `ACCOUNT_LOGIN_FAILURES`. |
| cc362b15 | Run 171, contrat K2 du lot 6 (aucun appel direct aux adaptateurs hors de l'envoyeur et des envois synchrones nommés) : les deux emails synchrones du lot (lien « Mot de passe oublié », avis à l'ancienne adresse) rangés dans `lib/email/`, comme l'email de vérification existant ; le code administrateur passe par `sendOtp` (type `OTP_ADMIN` par le journal). |
| 7c4c49fc | Run 173 (tests 379/379, e2e vert) : budgets de poids JavaScript dépassés de 198 octets gzip sur `/` et de 204 sur `/tickets`. « Déconnecter tous mes appareils » passe du fournisseur commun (chargé sur toutes les pages) à la page Profil, seule à s'en servir ; la fenêtre « Confirmer mon numéro » de l'onglet Reçus est chargée à la demande. Les budgets ne sont pas relevés. |
| 601bea14, 2a0bf440, e5e0df6f | Suite du run 173 : le cookie de session du navigateur (A4) recevait `secure`, `sameSite` et `path` calculés à chaque page ; le code figurait dans trois fichiers communs. La règle « Secure en HTTPS » est maintenant calculée une fois à la construction (`next.config.mjs`, clé `env`, `NEXT_PUBLIC_SESSION_COOKIE_SECURE` depuis `NEXT_PUBLIC_APP_URL`, même règle que le serveur) ; le navigateur ne reçoit qu'une constante, chemin et SameSite restent les valeurs par défaut de `@supabase/ssr`. Mesure locale (même construction que la CI : la mesure d'avant correction y donnait exactement les 217 198 octets du run 173) : `/` 216 982 octets gzip pour 217 000, `/tickets` 239 554 pour 241 000. |
| a82d37be | Run 171, e2e : la fenêtre de l'administration ne rendait la page qu'après la lecture de l'état de la session ; la page n'était plus rendue côté serveur, Chrome créait les champs de date hors du document et les affichait en `mm/dd/yyyy` malgré `lang="fr"` (capture `admin-notifications`, contrôle 8.2 t). La page est maintenant rendue tout de suite, la fenêtre se pose par-dessus, et une page ouverte verrouillée est rechargée après l'étape (ses premières lectures avaient été refusées par le serveur). |

## 3. A9 : droits de la partenaire selon sa fiche

### 3.1 Inventaire des usages de `is_partner_owner` (sortie du test, run 174)

```
[A9-INVENTAIRE] fonction | ticket_category_private_read(p_event uuid)
[A9-INVENTAIRE] politique | public.event_cancellations : event_cancellations_select (SELECT)
[A9-INVENTAIRE] politique | public.event_status_history : event_status_history_read (SELECT)
[A9-INVENTAIRE] politique | public.events : events_read_public (SELECT)
[A9-INVENTAIRE] politique | public.hall_reservations : hall_reservations_read (SELECT)
[A9-INVENTAIRE] politique | public.halls : halls_read_public (SELECT)
[A9-INVENTAIRE] politique | public.order_items : order_items_read (SELECT)
[A9-INVENTAIRE] politique | public.orders : orders_read (SELECT)
[A9-INVENTAIRE] politique | public.participant_exports : participant_exports_owner_admin_select (SELECT)
[A9-INVENTAIRE] politique | public.partner_activities : partner_activities_read (SELECT)
[A9-INVENTAIRE] politique | public.payments : payments_read (SELECT)
[A9-INVENTAIRE] politique | public.product_categories : product_categories_read (SELECT)
[A9-INVENTAIRE] politique | public.products : products_read (SELECT)
[A9-INVENTAIRE] politique | public.refunds : refunds_read (SELECT)
[A9-INVENTAIRE] politique | public.restaurant_tables : restaurant_tables_read (SELECT)
[A9-INVENTAIRE] politique | public.restaurant_zones : restaurant_zones_read (SELECT)
[A9-INVENTAIRE] politique | public.table_reservations : table_reservations_read (SELECT)
[A9-INVENTAIRE] politique | public.tickets : tickets_read (SELECT)
[A9-INVENTAIRE] total : 18
```

Les 18 usages sont des **lectures** (politiques SELECT et une fonction de lecture) : depuis le lot 9 ter, aucune écriture REST n'est ouverte dans `public` (R29). Statut de fiche exigé pour chacun : VALIDE ou SUSPENDU (lectures gardées, décision du lot 6) ; une fiche EN_ATTENTE ou REJETE ne lit plus rien par ces politiques. Pour `events_read_public` et `halls_read_public`, seule la branche « propriétaire » passe par `is_partner_owner` : un événement publié et une salle active restent lisibles de tous.

Toutes ces politiques et fonctions passent par `is_partner_owner`, qui exige maintenant une fiche VALIDE ou SUSPENDU : elles sont donc toutes fermées à une fiche EN_ATTENTE ou REJETE, sans en réécrire une seule.

### 3.2 Statut de fiche exigé, par route de l'application

| Route | VALIDE | SUSPENDU | EN_ATTENTE | REJETE |
|---|---|---|---|---|
| `GET /api/partner/dashboard` | oui | oui (lecture) | oui | oui |
| `GET /api/partner/profile` | oui | oui (lecture) | oui | non |
| `GET /api/partner/documents/signed-url` | oui | oui (lecture) | oui | oui |
| `POST /api/partner/dossier/complete` | oui | oui | oui | oui (c'est le complément de dossier) |
| `POST /api/partner/events`, `POST /api/partner/upload` | oui | refus propre à la route (lot 9 quater) | refus propre à la route, 403 `PARTNER_NOT_VALIDATED` | idem |
| `POST /api/partner/events/*/transition` | oui | publication refusée (lot 9 quater), le reste permis | 403 `PARTNER_NOT_VALIDATED` pour toute transition, avant la lecture du corps | idem |
| toute autre route `/api/partner/*`, et `/api/controller/*` pour un compte qui n'est pas CONTRÔLEUR | oui | lectures oui, actions refusées par leurs contrôles (lot 9 quater A6) | 403 `PARTNER_NOT_VALIDATED` | 403 `PARTNER_NOT_VALIDATED` |
| REST (PostgREST) : tables protégées par `is_partner_owner` | oui | oui | non | non |

La garde ne s'applique ni aux ADMIN et SUPERADMIN, ni aux comptes sans le rôle PARTENAIRE.

## 4. Textes des SMS nouveaux ou modifiés

Mesurés avec `smsSegments` au pire cas : adresse de l'application de 27 caractères (`https://aaaaaaaaaaaaaaaaaaa`), code de 8 chiffres, variables à leur longueur maximale (nom de société 80 caractères, coupé par `smsVar`), compteurs à 999. Tous en GSM-7, **un segment**.

| Type | Septets | Texte (pire cas) |
|---|---|---|
| `ADMIN_REVIEW_SMS`, une candidature | 157 | Event Village : nouvelle demande de partenaire "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW...". Vérifiez son dossier : https://aaaaaaaaaaaaaaaaaaa/admin/dashboard |
| `ADMIN_REVIEW_SMS`, regroupé | 137 | Event Village : 999 demande(s) de partenaire et 999 événement(s) attendent votre validation : https://aaaaaaaaaaaaaaaaaaa/admin/dashboard |
| `ADMIN_REVIEW_SMS`, partenaires seuls | 117 | Event Village : 999 demande(s) de partenaire attendent votre validation : https://aaaaaaaaaaaaaaaaaaa/admin/dashboard |
| `ADMIN_REVIEW_SMS`, événements seuls | 105 | Event Village : 999 événement(s) attendent votre validation : https://aaaaaaaaaaaaaaaaaaa/admin/dashboard |
| `ACCOUNT_LOGIN_FAILURES` (A1) | 160 | Event Village : plusieurs connexions ont échoué sur votre compte. Si ce n'est pas vous, changez votre mot de passe : https://aaaaaaaaaaaaaaaaaaa/forgot-password |
| `ACCOUNT_ACTIVATION` (A2) | 144 | Event Village : votre compte est créé. Choisissez votre mot de passe sous 24 h : https://aaaaaaaaaaaaaaaaaaa/activation?t=AAAAAAAAAAAAAAAAAAAAAA |
| `OTP_ADMIN` (A3) | 90 | Event Village : code administrateur 12345678. Ne le donnez à personne. Valable 10 minutes. |
| `OTP_LOGIN`, `OTP_REGISTER`, `OTP_PHONE_CHANGE`, `OTP_AUTH_HOOK` (C1) | 85 | Event Village : votre code est 12345678. Ne le donnez à personne. Valable 10 minutes. |
| `OTP_PASSWORD_RESET` (C1) | 105 | Event Village : votre code de réinitialisation est 12345678. Ne le donnez à personne. Valable 10 minutes. |
| `EMAIL_ADDED` (C2) | 119 | Event Village : une adresse email a été ajoutée à votre compte. Si ce n'est pas vous : https://aaaaaaaaaaaaaaaaaaa/aide |
| `PARTNER_REGISTERED_ACK` (C3) | 127 | Event Village : votre demande de compte partenaire WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW... est enregistrée. Réponse sous 48 h. |
| `PASSWORD_CHANGED` (B1) | 153 | Event Village : le mot de passe de votre compte a été modifié. Si ce n'est pas vous : Mot de passe oublié sur https://aaaaaaaaaaaaaaaaaaa/forgot-password |
| `PHONE_CHANGED` (B1) | 112 | Event Village : le numéro de votre compte a été modifié. Si ce n'est pas vous : https://aaaaaaaaaaaaaaaaaaa/aide |
| `EMAIL_CLAIMED_ELSEWHERE` (B1) | 152 | Event Village : l'adresse email en attente sur votre compte a été validée par un autre compte. Si c'est votre adresse : https://aaaaaaaaaaaaaaaaaaa/aide |
| `PARTNER_SUSPENDED` (B1) | 142 | Event Village : votre compte partenaire est suspendu. Motif : WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW... Aide : https://aaaaaaaaaaaaaaaaaaa/aide |
| `ACCOUNT_SUSPENDED` (B1) | 159 | Event Village : votre compte est suspendu. Motif : WWWWWWWWWWWWWWWWWWWWWWWWWWWWWW... Billets payés valables à l'entrée. Aide : https://aaaaaaaaaaaaaaaaaaa/aide |

**Retouches aux textes du prompt** (sinon plus d'un segment ou hors GSM-7) :

- A1 : « plusieurs tentatives de connexion ont échoué » (169 septets) → « plusieurs connexions ont échoué » (160).
- C3 : « reçue » contient `ç`, hors GSM-7 (le SMS passait en UCS-2, 2 segments) → « enregistrée ».
- `PASSWORD_CHANGED` : « défini ou modifié » (163) → « modifié » (153).
- D1 : les guillemets « » sont hors GSM-7 → guillemets droits `"…"`.
- D1 : le texte regroupé omet la partie à zéro (« 3 demande(s) de partenaire attendent… » plutôt que « 3 demande(s) de partenaire et 0 événement(s) ») ; une candidature seule donne le texte nominatif.
- `ACCOUNT_SUSPENDED` et `PARTNER_SUSPENDED` : motif coupé à 33 et 40 caractères pour garder « Aide : {lien}/aide » dans le segment.

Emails nouveaux : « Choisir un nouveau mot de passe — Event Village » (B2 : « Ce lien est valable 60 minutes et ne sert qu’une fois. ») ; « Adresse email de votre compte modifiée — Event Village » (C2, à l'ancienne adresse) ; `ACCOUNT_LOGIN_FAILURES` et `EMAIL_ADDED` ont aussi leur email (règle G.49).

## 5. Réglages, variables et permissions

- Réglages nouveaux (`platform_settings`, SUPERADMIN, écran des réglages financiers, section « Contact du support ») : `support.whatsapp`, `support.phone` (format `+221…`, E.164), `support.email`. Vides par défaut ; `essai:check-reel` signale « point à traiter » tant qu'aucun n'est rempli.
- Constante de construction, à ne pas poser : `NEXT_PUBLIC_SESSION_COOKIE_SECURE`, calculée par `next.config.mjs` depuis `NEXT_PUBLIC_APP_URL` (`true` quand l'adresse commence par `https://`). Conséquence : **`NEXT_PUBLIC_APP_URL` doit être la bonne adresse HTTPS au moment de la construction** sur l'hébergeur, sinon le cookie de session du navigateur part sans l'attribut Secure.
- Variable d'environnement nouvelle, facultative : `ADMIN_IDLE_TIMEOUT_MINUTES` (5 à 240, 30 par défaut). **Ne pas la poser en production** : 30 minutes est la valeur du prompt. La CI e2e la met à 240 (le parcours dure plus de 30 minutes).
- Aucune permission nouvelle. Le SMS D1 suit les permissions existantes `partners.validate` et `events.write`.

## 6. Migrations à appliquer sur event-village-dev

Quatorze migrations, dans cet ordre, d'un seul `db push` :

| Ordre | Migration | Ce qu'elle fait |
|---|---|---|
| 1 | `20261112000001_lot9quinquies_admin_sms.sql` | Type `ADMIN_REVIEW_SMS`, `notif_admin_review_due`, `notif_admin_review_sms`, déclencheurs `trg_partners_admin_review_sms` (partners) et `trg_event_status_admin_review_sms` (event_status_history). |
| 2 | `20261112000002_lot9quinquies_connexion.sql` | Table `auth_login_attempts`, `auth_login_attempt_begin`/`_end`, type `ACCOUNT_LOGIN_FAILURES`. |
| 3 | `20261112000003_lot9quinquies_support.sql` | Clés `support.whatsapp`, `support.phone`, `support.email` (vides) ; recopies de `fin_setting_valid` et `finance_setting_set` (+ ces trois clés). |
| 4 | `20261112000004_lot9quinquies_recuperation.sql` | `account_recovery_grants.issued_at`, `account_recovery_open`, `account_recovery_consume` (session ouverte après le code). |
| 5 | `20261112000005_lot9quinquies_fiche_partenaire.sql` | Recopie de `is_partner_owner` : fiche VALIDE ou SUSPENDU exigée. |
| 6 | `20261112000006_lot9quinquies_comptes_admin.sql` | Table `account_activations`, `account_activation_issue`/`_consume`, types `ACCOUNT_ACTIVATION` et `OTP_ADMIN` ; recopies de `notification_sync_log` et `notif_on_password_changed` (pas d'avis « mot de passe modifié » à l'activation). |
| 7 | `20261112000007_lot9quinquies_admin_step_up.sql` | Tables `admin_devices`, `admin_session_activity`, `admin_step_up_codes` ; `admin_step_up_code_store`/`_check`, `admin_step_up_check`, `admin_device_verified`. |
| 8 | `20261112000008_lot9quinquies_messages.sql` | Types `EMAIL_ADDED`, `PARTNER_REGISTERED_ACK` ; déclencheur `trg_email_verification_used`. |
| 9 | `20261112000009_lot9quinquies_check_reel.sql` | Recopie de `essai_check_reel` (+ champ `support`). |
| 10 | `20261112000010_lot9quinquies_recuperation_email.sql` | Table `password_reset_links`, `password_reset_link_issue`/`_consume` ; recopie de `auth_users_guard_writes` (permis `EMAIL_LINK` pour tout jeton email). |
| 11 | `20261112000011_lot9quinquies_admin_code_rls.sql` | Table `admin_session_codes`, `admin_session_code_valid()` ; recopies de `is_admin`, `is_superadmin` (code de la session exigé, moins de 12 h), `admin_step_up_check`, `admin_device_verified`. |
| 12 | `20261112000012_lot9quinquies_identifiants_gotrue.sql` | Schéma `private`, clé `private.auth_login_key` (tirée au hasard), `private.auth_login_alias`, déclencheur `on_auth_user_login_alias` sur `auth.users` ; recopie de `handle_new_user` ; **reprise de tous les comptes** (`auth.users.email` et identités email → adresse d'empreinte), contrôles avant et après dans la migration. |
| 13 | `20261112000013_lot9quinquies_affectations_fiche.sql` | Aide RLS `controller_assignment_active` ; recopies de `scan_scanner_authorized` et de la politique `tickets_read`. |
| 14 | `20261112000014_lot9quinquies_salles_concurrence.sql` | Recopie de `check_hall_availability` (verrou consultatif par salle). |

Toutes sans BEGIN ni COMMIT, rejouables (prouvé en CI : `migration-lot9quinquies-rejouable`, chacune rejouée deux fois de suite). Aucune ne touche aux données existantes, sauf l'ajout de trois clés vides à `platform_settings` et la migration 12, qui remplace l'adresse de connexion de **tous** les comptes dans `auth.users` et `auth.identities` (les adresses réelles de `public.users` ne bougent pas). La clé de la migration 12 est tirée une seule fois : rejouer la migration ne change aucune adresse. Les migrations jusqu'à `20261111…` sont inchangées (`migrations-gelees`).

**Déployer l'application du lot juste après, dans la même fenêtre.** Entre les migrations et le déploiement : « Mot de passe oublié » **par email** échoue (l'ancienne application passe par GoTrue, que la migration 10 ferme) ; le reste marche (connexion, code SMS, « Mot de passe oublié » par SMS). Depuis la migration 12, la connexion par **adresse email** et la connexion juste après une inscription échouent aussi tant que l'application n'est pas déployée ; la connexion par numéro marche. Une partenaire dont la fiche n'est pas VALIDE perd l'accès REST à ses événements dès la migration 5, ce qui est voulu.

### 6.1 Avant `db push` (éditeur SQL, une requête à la fois, garder les résultats)

```sql
-- A. attendu : 20261111000006, et aucune 20261112…
select max(version) from supabase_migrations.schema_migrations;

-- B. administrateurs et numéro : attendu, pour chaque ligne, numero_valable = true.
--    Un ADMIN ou SUPERADMIN sans numéro +221 ne pourra plus recevoir le code administrateur (A3) :
--    lui poser son numéro AVANT le déploiement, sinon il n'ouvre plus l'administration.
select u.id, r.role, u.status, (u.phone ~ '^\+221[0-9]{9}$') as numero_valable
  from public.users u join public.user_roles r on r.user_id = u.id
 where r.role::text in ('ADMIN', 'SUPERADMIN') order by 2, 1;

-- C. fiches partenaires par statut (garder les nombres) : les fiches EN_ATTENTE et REJETE perdront l'accès REST (A9)
select status, count(*) from public.partners group by 1 order by 1;

-- D. attendu : 0 ligne (aucune des tables nouvelles n'existe encore)
select tablename from pg_tables where schemaname = 'public'
   and tablename in ('auth_login_attempts', 'account_activations', 'admin_devices', 'admin_session_activity',
                     'admin_step_up_codes', 'password_reset_links', 'admin_session_codes');

-- E. comptes de connexion (garder les nombres) : total, avec un numéro, avec l'adresse du profil
--    (attendu après la migration 12 : même total, 0 avec l'adresse du profil)
select count(*) as total,
       count(*) filter (where coalesce(a.phone, '') <> '') as avec_numero,
       count(*) filter (where exists (select 1 from public.users u where u.id = a.id and lower(u.email) = lower(a.email))) as adresse_du_profil
  from auth.users a;

-- F. attendu : 0 ligne (le schéma private n'existe pas encore)
select nspname from pg_namespace where nspname = 'private';
```

### 6.2 Appliquer

```powershell
npx supabase@2.122.0 link --project-ref VOTRE_REFERENCE
npx supabase@2.122.0 migration list --linked     # les quatorze 20261112… en local seulement
npx supabase@2.122.0 db push --linked --dry-run  # exactement les quatorze fichiers, dans l'ordre
npx supabase@2.122.0 db push --linked
```

Si la liste contient autre chose : s'arrêter, sans `--include-all` ni `migration repair`.

La migration 12 affiche deux lignes `NOTICE` (« Identifiants GoTrue, avant : … » et « … après : … ») : les garder. Si un compte garde une autre adresse, elle s'arrête d'elle-même avec « reprise incomplète des identifiants GoTrue » et rien n'est changé.

### 6.3 Après (éditeur SQL)

```sql
-- attendu : 14 lignes, de 20261112000001 à 20261112000014
select version from supabase_migrations.schema_migrations where version like '20261112%' order by 1;

-- attendu : 7 lignes
select tablename from pg_tables where schemaname = 'public'
   and tablename in ('auth_login_attempts', 'account_activations', 'admin_devices', 'admin_session_activity',
                     'admin_step_up_codes', 'password_reset_links', 'admin_session_codes') order by 1;

-- attendu : 6 lignes
select type from public.notification_types
 where type in ('ADMIN_REVIEW_SMS', 'ACCOUNT_LOGIN_FAILURES', 'ACCOUNT_ACTIVATION', 'OTP_ADMIN', 'EMAIL_ADDED', 'PARTNER_REGISTERED_ACK')
 order by 1;

-- attendu : 3 lignes (trg_email_verification_used, trg_event_status_admin_review_sms, trg_partners_admin_review_sms)
select tgname from pg_trigger
 where tgname in ('trg_partners_admin_review_sms', 'trg_event_status_admin_review_sms', 'trg_email_verification_used') order by 1;

-- attendu : 3 lignes, valeurs vides tant que le § 7 n'est pas fait
select key, value from public.platform_settings where key like 'support.%' order by 1;

-- attendu : true (la fiche est lue)
select pg_get_functiondef('public.is_partner_owner(uuid)'::regprocedure) like '%VALIDE%';

-- C relancée : mêmes nombres qu'avant (aucune fiche modifiée)
select status, count(*) from public.partners group by 1 order by 1;

-- E relancée (migration 12) : même total qu'avant, adresse_du_profil = 0, adresse_d_empreinte = total
select count(*) as total,
       count(*) filter (where coalesce(a.phone, '') <> '') as avec_numero,
       count(*) filter (where exists (select 1 from public.users u where u.id = a.id and lower(u.email) = lower(a.email))) as adresse_du_profil,
       count(*) filter (where a.email ~ '^k[0-9a-f]{40}@comptes\.eventvillage\.invalid$') as adresse_d_empreinte
  from auth.users a;

-- attendu : 0 (aucune identité email avec une autre adresse que celle du compte)
select count(*) from auth.identities i join auth.users a on a.id = i.user_id
 where i.provider = 'email' and i.identity_data->>'email' is distinct from a.email;

-- attendu : true, true, true (migrations 11, 13, 14)
select pg_get_functiondef('public.is_admin()'::regprocedure) like '%admin_session_code_valid%',
       pg_get_functiondef('public.scan_scanner_authorized(uuid, uuid)'::regprocedure) like '%VALIDE%',
       pg_get_functiondef('public.check_hall_availability()'::regprocedure) like '%pg_advisory_xact_lock%';

-- attendu : 1 ligne, on_auth_user_login_alias
select tgname from pg_trigger where tgname = 'on_auth_user_login_alias';
```

Puis exécuter `supabase/hotfix/2026-10-31-lot1a/03-verification.sql` : tout `OK`.

## 7. À faire de ton côté

Dans l'ordre :

1. **Avant les migrations** : contrôle B du § 6.1. Chaque ADMIN et SUPERADMIN doit avoir un numéro `+221…` qui reçoit les SMS.
2. **Migrations** (§ 6.2), puis **déploiement de l'application du lot**, dans la même fenêtre. Ne pas poser `ADMIN_IDLE_TIMEOUT_MINUTES` en production. Vérifier que `NEXT_PUBLIC_APP_URL` est l'adresse `https://…` de l'application **avant** la construction (§ 5).
3. **Longueur minimale du mot de passe** sur le tableau de bord Supabase d'event-village-dev : Authentication → Sign In / Providers → Email → « Minimum password length » = **10**, « Password requirements » : aucune exigence → Save. (Pendant de `minimum_password_length = 10` dans `supabase/config.toml`, qui ne s'applique qu'au Supabase local.)
4. **Contact du support** : avec le SUPERADMIN, Réglages financiers → section « Contact du support » : remplir au moins un des trois (WhatsApp, téléphone au format `+221…`, email). Vérification : la page `/aide` (sans être connecté) affiche le contact ; `npm run essai:check-reel` ne signale plus le support.
5. **SMTP de Supabase** : rien à configurer, il est devenu inutile (Supabase n'envoie plus aucun email). Les emails partent par Resend, avec la configuration déjà en place.
6. **Première connexion à l'administration** après le déploiement : chaque admin (SUPERADMIN compris) devra saisir son mot de passe puis le code reçu par SMS sur son appareil. Depuis la migration 11, tant que ce n'est pas fait, sa session ne lit rien d'admin, ni par l'écran, ni par la REST, ni en temps réel.
7. **Fournisseur Téléphone fermé** (point 2 de la contre-vérification) : tableau de bord d'event-village-dev → Authentication → Sign In / Providers → **Phone** : désactivé → Save. Vérification, dans un navigateur : `https://VOTRE_REFERENCE.supabase.co/auth/v1/settings?apikey=CLE_ANON` doit montrer `"phone":false` dans `external`. L'application n'en a pas besoin : les codes SMS passent par MTarget, pas par GoTrue.
8. **Limite de connexions par IP** : Authentication → Rate Limits → « Sign-ups and sign-ins » (par 5 minutes et par IP) → **300** → Save. Attention : les connexions de l'application arrivent chez GoTrue depuis l'adresse du **serveur** de l'application, pas depuis celle de chaque utilisateur. Cette limite plafonne donc toutes les connexions de l'application ensemble ; une valeur basse (30, le défaut) bloquerait tout le monde aux heures de pointe. La vraie protection est celle de l'application (essais par IP et 10 échecs par compte), et GoTrue ne connaît plus d'identifiant devinable. Si le journal du serveur montre des refus « rate limit » de GoTrue à la connexion, relever cette valeur.

## 8. Décisions et écarts

- **Fiche SUSPENDU** : `is_partner_owner` la garde (lectures), décision du lot 6 ; ses actions restent refusées par leurs contrôles (lot 9 quater, A6).
- **Second facteur aussi hors de `/api/admin`** : un compte ADMIN ou SUPERADMIN doit avoir passé le code pour agir sur les routes de compte (`requireActiveSession`, mode ACCOUNT), sinon le second facteur se contournerait par les autres routes. Un client n'est pas concerné. La REST (PostgREST) n'est pas concernée : depuis le lot 9 ter, elle n'ouvre aucune écriture dans `public`.
- **Mot de passe redemandé (A4)** : 5 échecs par 15 minutes et par compte ; une saisie juste ne compte pas (le prompt ne fixe pas de nombre).
- **Fenêtre de l'administration** : la page est rendue sous la fenêtre (le serveur refuse ses lectures tant que l'étape manque), plutôt que masquée ; une page ouverte verrouillée est rechargée après l'étape.
- **Code administrateur** : 6 chiffres (comme les autres codes de l'application) ; le texte du prompt ne fixe pas la longueur. La mesure du § 4 prend 8 chiffres, le pire cas des codes de l'application.
- **`essai:check-reel`** : le contrôle du support est lu dans la même RPC que le reste (`essai_check_reel`, champ `support`), plutôt que par une seconde lecture REST.
- **Message d'une fonction SQL** : le remboursement refusé par la base dit encore « Contactez le support. » (texte d'une fonction gelée) ; l'écran qui l'affiche donne le lien `/aide` à côté.
- **Script d'opérateur** `scripts/reset-test-password` : garde sa règle de 14 caractères au moins (plus stricte que A7), pour les comptes d'essai seulement.
- **Mots de passe existants** : restent valables ; A7 s'applique aux nouveaux.

## 9. Tests existants modifiés (et pourquoi)

Jusqu'au run 174, aucune suite de `tests/audit/` ni de `tests/audit-auth/` n'était modifiée. Les correctifs de la contre-vérification en modifient quatre, pour la connexion de préparation seulement (troisième vague ci-dessous, à relire).

| Fichier | Pourquoi |
|---|---|
| `tests/helpers/fixtures.ts` (`signInAs`), `tests/parcours/paiement-helpers.ts` (`newBuyer`) | Ces aides ouvrent leurs sessions directement chez GoTrue, sans la fenêtre de l'administration. Elles appellent `stepUpTestSession` (`tests/helpers/admin-step-up.ts`) : la session vaut « mot de passe et code administrateur saisis sur cet appareil » (écriture en base locale de `admin_devices` et `admin_session_activity`). Sans effet pour un compte qui n'est pas admin. `password_confirmations` n'est pas écrite : le « mot de passe récent » des actions sensibles reste à prouver par chaque suite. Les suites qui prouvent le second facteur (`lot9quinquies-admin`) ouvrent leurs sessions sans cette aide. |
| `tests/security/helpers.ts` | Aide `adminStepUpThroughRoutes` : une session ADMIN ou SUPERADMIN passe le second facteur **par les vraies routes** (mot de passe, puis code lu dans le faux SMS), sans service_role ; la règle « attaquant anonyme seulement » des tests de sécurité est gardée. Appelée par `stepUpFixture` (seconde vague ci-dessous). |
| `tests/helpers/db.ts` | Nouvelle aide `writeLocal()` : `inspect()` est en lecture seule (run 170). Même garde (base locale seulement). |
| `tests/helpers/design-files.ts` | Les quatre écrans nouveaux (`/aide`, `/activation`, `AdminStepUpGate`, liste de contrôle) ajoutés à la liste du système de design. |
| `droits-admin-9bis`, `email-verification`, `lot9quater-comptes`, `attribution-roles` | Création d'un compte par un admin : plus de mot de passe envoyé (A2), activation par le lien. |
| `compte-mot-de-passe` | Aide du mot de passe (`PASSWORD_HINT`) : plus de composition imposée (A7). |
| `notif-interface` | Le formulaire de connexion lit `retryAfterSeconds` (`retryAfterOf`) et plus `remainingSeconds`, que le serveur n'envoie jamais : l'ancien contrôle encodait AUTH-03 (B3). |
| `notif-modeles`, `textes-sms-9bis` | Types nouveaux dans les registres exhaustifs ; textes C1 (« Ne le donnez à personne. ») ; `PASSWORD_CHANGED`, `PHONE_CHANGED`, `EMAIL_CLAIMED_ELSEWHERE`, `PARTNER_SUSPENDED`, `ACCOUNT_SUSPENDED` avec le lien `/aide` ou `/forgot-password` (B1). |
| `email-regle-envoi` | `ADMIN_REVIEW_SMS` exclu de la règle G.49 : SMS regroupé qui double trois avis admin ayant déjà leur email ; `PHONE_CHANGED` dans l'application. |
| `compte-numero`, `notif-canaux`, `notif-cloche`, `notif-envoyeur`, `notif-pros`, `sms-plafond-optionnel`, `paiement-prix-minimum`, `messages-comptes-9bis`, `lot9bis-fonds-suspension` | Textes cités mot pour mot : « contactez le support » suivi du lien `/aide` (B1), textes SMS modifiés. |
| `email-verification` | Textes B5 (bandeau « Adresse email non vérifiée »). |
| `tests/schema/essai-check-reel.test.ts` | Réponse de la RPC avec le champ `support: { filled: 1 }` (B1). |
| `tests/schema/migrations-gelees.test.ts` | Les 6 migrations `20261111…` (lot 9 quater) ajoutées au gel, empreintes de `main` ed2dc7ed. |
| `e2e/auth.setup.ts`, `.github/workflows/verify.yml` | L'e2e passe le code administrateur (lu dans le faux MTarget) ; `ADMIN_IDLE_TIMEOUT_MINUTES=240` dans `.env.e2e` seulement. |
| `docs/recette-billetterie.md` | Citations `tests/…:ligne` recalées sur les mêmes tests, qui ont bougé (`recette-matrice`). |

Seconde vague, après le run 171 (commits 6a082a19, cc362b15, c3cc0f5b) :

| Fichier | Pourquoi |
|---|---|
| `tests/parcours/invitation-identite.test.ts` | A6 : verify-otp ne rend plus l'adresse. Le test vérifie que le lien de réinitialisation vise le compte du client par `user.id`, et qu'aucune adresse n'est rendue. |
| `tests/parcours/notif-outbox.test.ts` | Registre exhaustif du contrat : 5 types nouveaux (`ADMIN_REVIEW_SMS`, `ACCOUNT_LOGIN_FAILURES`, `ACCOUNT_ACTIVATION`, `OTP_ADMIN`, `EMAIL_ADDED`) et canal SMS de `PARTNER_REGISTERED_ACK` (C3). |
| `tests/parcours/notif-pros.test.ts` | C3 remplace la « décision 14 » du lot 6 (pas de SMS « inscription reçue », jugé doublon du code) par le SMS d'accusé que demande le prompt : le test attend maintenant la ligne SMS de l'accusé et son texte exact, après le SMS du code. |
| `tests/parcours/notif-migration.test.ts` | Contrat K2 : la route du code administrateur ajoutée aux routes synchrones (méthode `sendOtp`), le lien d'activation (`lib/auth/account-activation.ts`) et la méthode `sendAccountActivation` nommés dans la liste. Les deux emails synchrones n'y sont pas ajoutés : ils ont été rangés dans `lib/email/`. |
| `tests/parcours/pannes-absences.test.ts` (A26, A32) | Panne simulée de la table `partners` : elle est maintenant arrêtée par la garde de la fiche (A9), qui lit `partners` avant la route : 503 `PARTNER_UNAVAILABLE`, journalisée, jamais 404. La règle éprouvée (une panne n'est jamais présentée comme une absence) est la même ; seuls le code et le texte attendus changent. |
| `tests/security/helpers.ts`, `tests/security/r23-reglages-lot7.test.ts` | Le second facteur des fixtures ADMIN et SUPERADMIN n'est plus passé à chaque connexion, mais par `stepUpFixture`, appelé par la seule suite qui appelle une route de l'administration (le témoin de `r23`). Les autres suites de sécurité n'utilisent que la REST, que le second facteur ne concerne pas ; un code par suite dépassait la limite de 3 SMS par numéro et par 15 minutes. Le passage se fait toujours par les vraies routes, sans service_role. |
| `tests/parcours/lot9quinquies-sms-admins.test.ts` (test 4) | Défaut du test : il envoyait aussi à l'ADMIN `partners.validate` la ligne regroupée laissée par les tests 2 et 3, d'où un SMS « demande(s) de partenaire » sans rapport. Contrôle maintenant direct : aucune ligne et aucun SMS d'événement pour cet admin. |
| `tests/parcours/lot9quinquies-ecrans.test.ts` (suite du lot) | B4 : l'appel à `/api/auth/sign-out-global` est cherché dans la page Profil, où il a été déplacé (poids JavaScript, run 173). |
| `e2e/support/screens.ts` | Captures `profil-mot-de-passe` (aide de la règle A7) et `profil-email-non-verifie` (bandeau « Adresse email non vérifiée » et bouton « Recevoir le lien de vérification », B5). |
| `docs/recette-billetterie.md` | Citations recalées une seconde fois, par le nom du test (les lignes avaient encore bougé). |

Troisième vague, correctifs de la contre-vérification (5202973c, 292b3f9a, 466d3451, e9f49f3b, bf8a9617) :

| Fichier | Pourquoi |
|---|---|
| `tests/helpers/gotrue-email.ts` (nouveau), 52 suites (`signInWithPassword`, 65 lignes) | Point 2 : GoTrue ne connaît plus l'adresse réelle. Les suites qui ouvrent une session directement chez GoTrue passent par `gotrueEmail()`, qui lit l'identifiant d'empreinte dans la base locale. Aucune vérification n'est retirée : c'est la connexion de préparation qui change. |
| `tests/audit/aud-01` (l. 99), `tests/audit/aud-06` (l. 86), `tests/audit-auth/cv9qq-3`, `tests/audit-auth/cv9qq-helpers.ts` | **Suites d'audit modifiées, à relire.** Seul changement : l'adresse passée à `signInWithPassword` devient `await gotrueEmail(…)`. Avec l'adresse réelle, GoTrue refuse toujours. Les attaques d'`aud-01` (mot de passe changé par le seul jeton) et d'`aud-06` (reconnexion d'une partenaire suspendue) seraient alors devenues vertes **sans rien prouver**. Avec l'identifiant, elles jouent l'attaquant le plus fort, celui qui connaît l'identifiant secret, et restent probantes. Aucune assertion n'est changée. `aud-01` l. 164 et 170 et `cv9qq-2 c` gardent l'adresse réelle : elles éprouvent justement l'attaque avec l'adresse connue. |
| `tests/seed/seed-demo.ts`, `scripts/reset-test-password.ts` | Même raison : identifiant relu par le rôle de service. |
| `tests/helpers/admin-step-up.ts`, `tests/helpers/realtime.ts`, `tests/security/helpers.ts` (`signInFixture`), `securite-ecritures-services-9ter`, `bootstrap-superadmin` | Point 1 : le code de la session est exigé par la base. `stepUpTestSession` inscrit aussi la session dans `admin_session_codes`. `signedInClient` le passe sauf `{ stepUp: false }` (témoin du temps réel). `bootstrap-superadmin` vérifie en plus que `is_superadmin()` est faux avant le code. |
| `compte-numero`, `compte-profil`, `email-verification`, `lot9quater-comptes` (A4 et reprise), `invitation-identite` | Point 2 : `auth.users.email` n'est plus l'adresse du profil. Les tests lisent l'adresse du profil derrière l'identifiant (`profileEmailBehindGotrue`, qui vérifie aussi l'empreinte). Dans `compte-profil`, « adresse prise dans auth.users seulement » attend maintenant 200 (aucune adresse réelle n'y est jamais). La désynchronisation vérifie que l'identifiant GoTrue ne bouge pas. Le constat AM1 est réécrit : l'appel vers l'email d'un autre compte ne touche aucun des deux identifiants (le refus 409 `EMAIL_TAKEN` repose sur `account_identity_taken`, lu avant tout appel). |
| `tests/helpers/lot9-invariants.ts` (v6), `tests/helpers/lot9bis-invariants.ts` (w14), `lot9-invariant`, `lot9bis-invariant` | Les invariants « adresse de connexion = adresse du profil » deviennent « identifiant d'empreinte, ou égale au profil ». Leurs jeux de détection sont réécrits sur la règle nouvelle. |
| `essai-comptes-demo` (I1) | La reprise de l'identifiant est neutralisée dans la transaction annulée du test, qui pose volontairement une adresse de démonstration. |
| `lot9quinquies-cv-gotrue` (b, après le run 178) | Option retenue pour le numéro : fournisseur Téléphone fermé, au lieu de numéros vidés. Le test vérifie `external.phone = false` au lieu d'un nombre de numéros nul. |
| `fonctions-privileges`, `r3-fonctions-rpc`, `supabase/hotfix/2026-10-31-lot1a/03-verification.sql` | Point 4 : 8e aide RLS `controller_assignment_active` sur la liste blanche (et compte des aides de 7 à 8 dans le contrôle 1A.3 du hotfix), comme le lot 7 l'avait fait pour la 7e. |
| `migration-lot9quinquies-rejouable` | Migrations 11 à 14 ajoutées à la liste du lot. |
| `docs/recette-billetterie.md` | Citations recalées une troisième et une quatrième fois (466d3451, puis 10 citations au commit de ce rapport). |

Aucun de ces changements n'affaiblit une vérification : chacun suit une règle du prompt (textes, création sans mot de passe, second facteur) ou corrige une aide de test.

## 10. Essais pour un non-développeur

Sur l'application déployée (event-village-dev), avec un navigateur ordinaire et un téléphone qui reçoit les SMS :

1. **SMS au SUPERADMIN sur une candidature.** Depuis un autre navigateur, faire une demande de compte partenaire (8 h – 22 h). Dans la minute, le téléphone du SUPERADMIN reçoit « Event Village : nouvelle demande de partenaire "…". Vérifiez son dossier : …/admin/dashboard ». La partenaire reçoit « …votre demande de compte partenaire … est enregistrée. Réponse sous 48 h. » Deux autres demandes dans les 10 minutes : un seul SMS de plus, 30 minutes après le premier, qui les compte.
2. **10 mauvais mots de passe.** Sur un compte d'essai, se tromper 10 fois de mot de passe : au 11e essai, même avec le bon mot de passe, « Trop d'essais… Réessayez dans N minutes. » (délai en minutes, pas en secondes). Le téléphone du compte reçoit une fois « Event Village : plusieurs connexions ont échoué sur votre compte… ».
3. **Code administrateur sur un nouvel appareil.** Se connecter avec le SUPERADMIN depuis un navigateur jamais utilisé (ou une fenêtre privée) et ouvrir l'administration : le mot de passe est redemandé, puis un code arrive par SMS « Event Village : code administrateur …. Ne le donnez à personne. Valable 10 minutes. » ; après le code, l'administration s'ouvre. Rester 30 minutes sans rien faire : une fenêtre redemande le mot de passe, la page reste derrière.
4. **Mot de passe oublié par email.** Sur la page « Mot de passe oublié », onglet email, saisir une adresse **vérifiée** : un email en français « Choisir un nouveau mot de passe — Event Village » arrive, avec un lien valable 60 minutes. Le lien permet de choisir un mot de passe une seule fois ; une seconde ouverture est refusée. Avec une adresse inconnue : le même message à l'écran, aucun email.
5. **Créer un ADMIN.** Avec le SUPERADMIN, Utilisateurs → créer un ADMIN : il n'y a plus de champ mot de passe. Le nouvel admin reçoit « Event Village : votre compte est créé. Choisissez votre mot de passe sous 24 h : … ». Dans la liste : « Activation en attente », bouton « Renvoyer le lien ». Il ouvre le lien, choisit son mot de passe (refus de « Senegal2026! », accord de « ma soirée au théâtre »), se connecte, puis passe le code administrateur.
6. **Compte suspendu.** Suspendre un compte d'essai, puis demander un code de connexion pour son numéro : « Votre compte est suspendu. » avec le contact du support, et aucun SMS.
7. **Page d'aide.** Sans être connecté, ouvrir `/aide` : le contact du support et cinq réponses courtes.
8. **Déconnexion.** Se connecter sur deux appareils ; « Se déconnecter » sur l'un ne ferme pas l'autre. Profil → « Déconnecter tous mes appareils » : confirmation « Vos billets hors ligne seront effacés sur les autres téléphones. », puis l'autre appareil est déconnecté.

## 11. Points ouverts

- **AUTH-13, AUTH-15** : hors périmètre (décision du prompt).
- **Admin sans numéro, ou qui a perdu son téléphone** : il ne peut plus ouvrir l'administration (§ 6.1 B), ni changer son numéro depuis son profil (les routes de compte d'un admin demandent aussi le code). Aucun écran ne permet à un autre admin de changer ce numéro, et il n'y a pas de code de secours : le seul recours est la base (éditeur SQL du tableau de bord). À décider : un écran de changement de numéro par le SUPERADMIN, ou des codes de secours imprimés.
- **Liste des mots de passe courants** : SecLists 10 000 (MIT) plus une liste de mots sénégalais, écrite à la main ; elle peut être élargie.
- **Fusion** : `lot9quinquies/authentification` n'est pas fusionnée dans `main` ; `lot9quinquies/rouges` sert de preuve et ne doit pas être fusionnée.
- **Script de développement** `scripts/dev/essai-fiche-partenaire.mjs` : ne se connecte plus (connexion directe chez GoTrue avec l'adresse, fermée au point 2). À réécrire pour passer par `POST /api/auth/login`, ou à retirer.
- **Blocage de partner-halls-m7** : le nouveau test ne l'a pas reproduit (0 sur 60 essais avant le correctif). La cause est établie par le raisonnement, et le verrou par salle rend le blocage impossible.
- **Appels `updateUserById({ email })` de l'application** : sans effet sur l'identifiant depuis le point 2. À retirer plus tard ; je les ai laissés pour ne pas toucher aux parcours de compte dans ce correctif.
- **Hook de vérification du mot de passe** de Supabase : offres Team et Enterprise seulement ; non ajouté.
