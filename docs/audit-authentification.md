# Audit de l'authentification — sécurité, expérience et messages

**Branche :** `audit/authentification`, depuis `main` = `691d199` (lots 1 à 9 ter, guide, revue d'ergonomie). Revue seulement : **aucun code de l'application n'a changé.** Seuls ajouts : `tests/audit-auth/` (trois suites qui prouvent des écarts) et ce rapport ; plus deux lignes de `.github/workflows/verify.yml` (déclencheur `audit/**`, repris à l'identique de la branche `audit/evenements`, `c210575`), sans lesquelles la branche n'a pas de run.
**Référentiel :** OWASP ASVS 4.0.3, chapitres V2 (authentification), V3 (sessions), V4 (droits).
**Méthode :** lecture du code de `main` (routes `app/api/auth/**`, `app/api/account/**`, écrans de connexion, d'inscription, de récupération et de profil, `lib/auth/**`, `supabase/config.toml`, catalogue des messages), tests rouges en CI. Aucune lecture de `.env.local` ni de `.private/`, aucune requête vers un projet distant. Travail mené seul, sans agents (limite d'usage).
**Périmètre exclu, déjà traité ailleurs :** ce que corrige le lot 9 quater (AUD-01, 02, 03, 05, 06, 12, 17, 19, 33, 34, 35, G-03, G-04, G-36, G-97), AUD-07 (accepté), et ce qui est déjà décidé pour le prochain lot d'ergonomie (D1, A7, E-56, E-57, E-62). Ces sujets ne sont repris que là où le plan du lot 9 quater laisse un trou (section 4).
`M/` = `supabase/migrations/`. Chemins relatifs au dépôt, lignes de `main` 691d199.

---

## À lire en premier

**État général.**
1. Le socle est sérieux : codes SMS hachés, 5 essais par code, codes liés à leur usage, compte créé seulement après le code, numéro → compte jamais révélé à la connexion, mot de passe redemandé pour les actions sensibles, autres appareils déconnectés au changement de mot de passe.
2. Le lot 9 quater ferme les failles graves déjà connues (redirection après connexion, inscription publique de GoTrue, mot de passe changé sans l'ancien, comptes suspendus encore actifs, adresse technique).
3. Il reste deux trous de sécurité qui ne dépendent pas de l'hébergeur : **aucune limite d'essais de mot de passe par compte** (AUTH-01, prouvé) et **aucun second facteur pour les admins**, dont le mot de passe peut être choisi faible par un autre admin (AUTH-02, prouvé ; AUTH-05).
4. Les sessions ne finissent jamais (cookie de 400 jours, lisible par le script de la page, sans délai d'inactivité) : acceptable pour un client sur son téléphone, pas pour un SUPERADMIN sur un ordinateur partagé (AUTH-04).
5. Pour un utilisateur non technicien, le plus gênant est ailleurs : **aucun moyen de joindre le support** alors que tous les messages de sécurité disent « contactez le support » (AUTH-06), des délais d'attente faux (AUTH-03), « Se déconnecter » qui ferme tous les appareils et efface les billets hors ligne des autres téléphones (AUTH-07), et la récupération par email qui passe par un canal non configuré (AUTH-08).

**Les 10 points les plus importants.**

| # | Constat | Catégorie | Priorité | Effort |
|---|---|---|---|---|
| 1 | AUTH-01 — aucune limite d'essais de mot de passe par compte (prouvé) | sécurité ÉLEVÉE | P1 | S |
| 2 | AUTH-02 — un admin choisit librement le mot de passe d'un autre compte, sans règle, jamais changé (prouvé) | sécurité ÉLEVÉE | P1 | M |
| 3 | AUTH-05 — aucun second facteur pour ADMIN et SUPERADMIN | sécurité ÉLEVÉE | P1 | M |
| 4 | AUTH-06 — « Contactez le support » sans aucun moyen de contact pour un client | expérience | P1 | S |
| 5 | AUTH-08 — « Mot de passe oublié » par email passe par le SMTP de Supabase, pas par Resend : inutilisable sans configuration | message | P1 | S |
| 6 | AUTH-04 — session sans fin : cookie de 400 jours, sans `HttpOnly`, sans délai d'inactivité, même pour un SUPERADMIN | sécurité MOYENNE | P1 (admins) | M |
| 7 | AUTH-03 — délai d'attente faux sur trois écrans après une limite (prouvé) | expérience | P1 | S |
| 8 | AUTH-07 — « Se déconnecter » ferme tous les appareils sans le dire et efface les billets hors ligne des autres téléphones | expérience | P2 | S |
| 9 | AUTH-09 — aucun avis quand une adresse email est ajoutée ou changée (elle devient identifiant et canal de récupération) | message | P2 | S |
| 10 | AUTH-10 — le SMS de code ne dit pas « ne le donnez à personne » (sauf le code de retrait) | message | P2 | S |

Trous du plan du lot 9 quater : section 4 (cinq points, dont le message trompeur au compte suspendu qui se connecte par code).

---

## 1. Parcours, un par un

Colonnes : **Étape | Écran | Messages envoyés | Sécurité | Expérience | Proposition**. « Cloche » = notification dans l'application. « Indisp. » = message indispensable (part même la nuit, hors plafond optionnel).

### 1.1 Inscription client

| Étape | Écran | Messages envoyés | Sécurité | Expérience | Proposition |
|---|---|---|---|---|---|
| 1. Numéro | `/register`, « Étape 1 sur 2 : votre numéro », champ « Numéro de téléphone (Sénégal) », bouton « Recevoir le code par SMS » (`app/register/page.tsx:334`, `:427-448`) | SMS au numéro : « Event Village : votre code de vérification est {code}. Valable 10 minutes. » (`lib/notifications/catalog.ts:1800-1804`), indisp., immédiat, part la nuit | Aucun compte créé à cette étape (`app/api/auth/register/start/route.ts:18-26`) ; numéro déjà inscrit → 409 sans SMS (`:46-52`, AUD-07 accepté) ; garde SMS par numéro, IP et plafond (`:56`) | Clavier téléphone (`type="tel"`, `inputMode="tel"`, `autocomplete="tel"`, `:428-430`) ; numéro inscrit → bouton « Recevoir un code de connexion » (`:365`) | Ajouter « Ne le donnez à personne. » au SMS (AUTH-10) |
| 2. Code et profil | même page, « Étape 2 sur 2 : code et profil » : code, prénom, nom, mot de passe, email facultatif, code de parrainage facultatif (`:454-589`) | si une adresse est saisie : email de vérification (lien 24 h) au mieux, seulement si Resend est configuré (`app/api/auth/register/route.ts:78-80`) | Code vérifié et consommé avant toute création (`:149-160`), 10 vérifications par 15 min et par numéro (`lib/env.ts:85`) ; mot de passe : 8 caractères, majuscule, chiffre, caractère spécial (`lib/validations/auth.ts:93-97`), en dessous de l'ASVS (AUTH-11) ; code de parrainage inconnu signalé (`:132-146`, énumération des codes, FAIBLE) | Code en 6 cases, clavier numérique, `autocomplete="one-time-code"`, collage du code (`components/auth/OtpInput.tsx:20-21`, `:123-133`) ; « Afficher le mot de passe » (`:534-541`) ; `autocomplete="new-password"` (`:529`) ; liste de contrôle de la force du mot de passe (`components/auth/PasswordStrengthChecklist.tsx`) | Mot de passe : 12 caractères sans règle de composition, refus des mots de passe courants (AUTH-11) |
| 3. Compte créé | message de succès, puis « Continuer » si une adresse a été saisie (`:395-410`) | aucun message de bienvenue | Compte ACTIF, numéro vérifié | La personne ne sait pas que son email ne servira à se connecter qu'après le lien (A7 décidé) | — (A7) |

### 1.2 Inscription partenaire

| Étape | Écran | Messages envoyés | Sécurité | Expérience | Proposition |
|---|---|---|---|---|---|
| 1. Dossier | `/partner/register`, deux étapes (dossier et pièces, puis code) | SMS de code au gérant (même texte que 1.1) | Quota par IP 10 par heure (`app/api/partner/register/route.ts:61-68`, `lib/env.ts:87`) ; pièces déposées avant le compte (AUD-25, lot 9 quater F2) | Délai de renvoi lu dans `remainingSeconds`, que le serveur n'envoie pas (`app/partner/register/page.tsx:323`, AUTH-03) | AUTH-03 |
| 2. Code et création | même écran | Partenaire : « Inscription reçue » — cloche et email seulement (`lib/notifications/catalog.ts:1012-1016`) ; admins `partners.read` et SUPERADMIN : « Nouvelle candidature », cloche, push, email (`:1198-1203`) | Code vérifié avant `createUser` (`route.ts:157-170`) ; session ouverte par mot de passe côté serveur (`:274`) | L'email de la partenaire n'est pas encore vérifié : son accusé de réception ne part en pratique que dans la cloche ; aucun SMS ne lui dit que son dossier est reçu ni le délai d'examen | AUTH-12 : SMS d'accusé de réception à la partenaire (le SMS aux admins est déjà décidé, D1) |
| 3. Attente | tableau de bord en attente | à la décision : « Compte partenaire validé » cloche, SMS, email (`:1018-1023`) ; refus : `PARTNER_REJECTED` cloche, SMS, email (`:1025-1030`) | — | Validation et refus sont bien prévenus par SMS | — |

### 1.3 Connexion par mot de passe

| Étape | Écran | Messages envoyés | Sécurité | Expérience | Proposition |
|---|---|---|---|---|---|
| Avec le numéro | `/login`, onglet « Mot de passe », champ « Email ou téléphone » (`components/auth/LoginForm.tsx:582-592`) | aucun | Correspondance numéro → compte faite par le serveur (`app/api/auth/login/route.ts:51-62`) ; même refus pour un numéro inconnu et un mauvais mot de passe (`:94`, `:25`) ; **limite par IP seulement** : 30 par heure (`:66-75`, `lib/env.ts:115`), IP lue dans `x-forwarded-for` (AUD-09) ; **aucune limite par compte** (AUTH-01) | `autocomplete="username"` puis `"current-password"` (`:586`, `:599`) ; « Afficher le mot de passe » (`:610-618`) ; lien « Mot de passe oublié ? » à côté du champ (`:604-608`) ; verrou de 5 échecs pendant 60 s **dans le navigateur seulement** (`:49-52`) | AUTH-01 |
| Avec l'email vérifié | même écran | aucun | Identifiant = adresse de connexion de GoTrue (`route.ts:91-93`) | fonctionne | — |
| Avec l'email non vérifié | même écran | aucun | L'adresse en attente n'est pas un identifiant (`app/api/auth/register/route.ts:120-123`) : refus 401 « Identifiant ou mot de passe incorrect. » | La personne ne comprend pas pourquoi (constaté par le chef de projet le 13/11) | A7 décidé ; voir aussi AUTH-08 |
| Compte suspendu | même écran | aucun | Main : la route ouvre la session, l'écran la ferme (`LoginForm.tsx:280-287`) ; lot 9 quater A6 : bannissement dans GoTrue | « Votre compte est suspendu. Veuillez contacter le support. » sans moyen de contact (AUTH-06) | AUTH-06 |
| Nouvel appareil | — | **aucun avis** | Une connexion depuis un appareil inconnu passe inaperçue | Les grandes applications préviennent | AUTH-13 (P3) |

### 1.4 Connexion par code SMS

| Étape | Écran | Messages envoyés | Sécurité | Expérience | Proposition |
|---|---|---|---|---|---|
| Demande du code | onglet « Code SMS », « Numéro de téléphone (Sénégal) », « Recevoir le code SMS » (`LoginForm.tsx:640-663`) | SMS « Event Village : votre code de vérification est {code}. Valable 10 minutes. », indisp., immédiat | `/api/auth/resolve-phone` dit si le numéro a un compte (AUD-07 accepté) ; garde SMS : 3 par 15 min et 10 par jour par numéro, 10 par heure et 30 par jour par IP (`lib/env.ts:57-60`) | Succès affiché avec le numéro brut « +221… » (`:425`) ; délai après une limite lu dans `remainingSeconds` (`:400`, `:416`, AUTH-03) | AUTH-03 ; afficher le numéro au format 77 123 45 67 |
| Saisie du code | 6 cases, « Valider et se connecter », « Modifier le numéro », « Renvoyer le code » après 60 s (`:666-713`) | aucun | Code haché HMAC, comparaison en temps constant, 5 essais par code, consommé une fois (`lib/auth/otp-store.ts:1-20`, `:25`) ; 10 vérifications par 15 min et par numéro (`app/api/auth/verify-otp/route.ts:41-50`) : au plus environ 50 essais par jour sur 900 000 codes ; la réponse rend **toute la ligne du compte** (`select('*')`, `:82-86`, `:131-139`) et l'adresse technique (`:136`) | `autocomplete="one-time-code"` et collage ; pas de lecture automatique du SMS sur Android (WebOTP) | AUTH-14 (rendre seulement l'identifiant et le jeton) |
| Compte suspendu | — | le SMS de code part quand même | Lot 9 quater A6 : bannissement ; mais le code est envoyé et la vérification ouvre un lien de session avant tout contrôle de statut (`verify-otp/route.ts:97-129`) | Après A6, l'écran dira « Code accepté, mais la connexion n'a pas pu s'ouvrir… » (`LoginForm.tsx:106`, `:479-484`) au lieu de « compte suspendu » | Trou T1 (section 4) |

### 1.5 Mot de passe oublié

| Étape | Écran | Messages envoyés | Sécurité | Expérience | Proposition |
|---|---|---|---|---|---|
| Par SMS | `/forgot-password`, un seul champ email ou téléphone, le mode se choisit selon la saisie (`app/forgot-password/page.tsx:489-517`) | SMS « Event Village : votre code de réinitialisation du mot de passe est {code}. Valable 10 minutes. » (`catalog.ts:1807-1808`) | Réponse neutre, qu'un compte existe ou non (`app/api/auth/send-otp/route.ts:21-22`, `:73-77`) ; aucun SMS pour un numéro sans compte | Message « Si un compte est associé à ce numéro, un code de récupération vient de lui être envoyé par SMS. » (`:279`) ; délai après limite lu dans `remainingSeconds` (`:266-267`, AUTH-03) | AUTH-03 |
| Par email | même écran | **email de GoTrue** (`supabase.auth.resetPasswordForEmail`, `:211`), pas Resend | Réponse toujours identique (`:29`) | Ne part que si l'adresse est vérifiée et si le **SMTP de Supabase** est configuré : sans SMTP propre, Supabase n'envoie qu'aux membres de l'organisation et limite à quelques messages par heure (local : `email_sent = 2`, `supabase/config.toml`) ; la personne voit « Vérifiez votre boîte de réception » et ne reçoit rien | AUTH-08 |
| Nouveau mot de passe | `/reset-password` | `PASSWORD_CHANGED` cloche, SMS, email (`catalog.ts:874-883`) | Lot 9 quater A3 / G-04 : session de récupération seule, règle commune, autres sessions révoquées, avis | — | — |
| Autres appareils | — | — | Déconnectés (`app/reset-password/page.tsx:293`, `/api/auth/sign-out-global`) ; le jeton déjà émis reste valable 1 h au plus (`lib/auth/sessions.ts:7-8`, décision du 9 bis, point 17) | — | — |

### 1.6 Changement de mot de passe et mot de passe redemandé

| Étape | Écran | Messages envoyés | Sécurité | Expérience | Proposition |
|---|---|---|---|---|---|
| Profil, « Changer mon mot de passe » | fenêtre `components/profile/PasswordChangeDialog.tsx` | `PASSWORD_CHANGED` cloche, SMS, email : « Event Village : le mot de passe de votre compte a été défini ou modifié. Si ce n'est pas vous, contactez le support. » (`catalog.ts:874-883`) | Mot de passe actuel exigé, 5 essais par 15 min et par compte, nouveau ≠ ancien, autres sessions révoquées, session courante gardée (`app/api/account/password/route.ts:96-141`) — conforme ASVS 2.1.5, 2.1.6, 3.3.3 | Message de succès « Mot de passe modifié. Vos autres appareils sont déconnectés. » (`:18`) ; le SMS renvoie vers un support injoignable (AUTH-06) | AUTH-06 |
| Mot de passe redemandé | `components/auth/PasswordConfirmDialog.tsx` | — | Saisie de moins de **10 minutes**, liée à la session (`lib/auth/password-confirm.ts:22-25`, `:163-186`) ; exigée pour : transfert de billet, changement de numéro (envoi et confirmation), ajout ou changement d'email (`app/api/account/profile/route.ts:74`), constat « non versé » du SUPERADMIN ; une connexion par mot de passe vaut saisie récente (`:136`), **une connexion par code SMS non** | Texte « Par sécurité, saisissez votre mot de passe pour continuer. » (`:25`) ; un compte qui ne se connecte que par code doit connaître son mot de passe | — |

### 1.7 Numéro et email

| Étape | Écran | Messages envoyés | Sécurité | Expérience | Proposition |
|---|---|---|---|---|---|
| Changement de numéro | `components/profile/PhoneChangeDialog.tsx` | code au **nouveau** numéro ; puis `PHONE_CHANGED` SMS à l'**ancien** numéro et email : « Event Village : le numéro de votre compte a été modifié. Si ce n'est pas vous, contactez le support. » (`catalog.ts:886-895`) | Mot de passe récent (`app/api/account/phone/start/route.ts:16`, `confirm/route.ts:43`), 5 demandes par jour (`lib/env.ts:110`), autres sessions révoquées (`confirm/route.ts:126`), retraits bloqués 24 h ; « Ce numéro est déjà associé à un compte. » (`start/route.ts:38`, énumération pour un connecté, FAIBLE) | Clair | AUTH-06 (support) |
| Ajout ou changement d'email | profil | lien de vérification (Resend), 24 h | Mot de passe récent (`profile/route.ts:74`) ; adresse en attente jusqu'au lien | **Aucun avis au numéro du compte** quand l'adresse est ajoutée puis vérifiée, alors qu'elle devient identifiant de connexion et canal de récupération | AUTH-09 |
| Vérification, renvoi, lien expiré | `/verify-email`, « Renvoyer le lien » | — | Jeton haché, usage unique, 24 h ; 3 liens par heure et par compte, 5 par jour et par adresse (`app/api/account/email/resend/route.ts:56-58`, `lib/env.ts:117-118`) ; refus clairs : « Ce lien a expiré (24 heures). Demandez un nouveau lien depuis votre profil. » (`app/api/account/email/verify/route.ts:18-22`) | Bons messages ; mais si Resend refuse l'envoi (`EMAIL_REJECTED`, constaté sur event-village-dev le 12/11), la personne ne le sait pas en dehors du profil | AUTH-08 |

### 1.8 Sessions

| Étape | Écran | Messages envoyés | Sécurité | Expérience | Proposition |
|---|---|---|---|---|---|
| Durée | — | — | Jeton d'accès 1 h, renouvellement tournant (`supabase/config.toml` : `jwt_expiry = 3600`, `enable_refresh_token_rotation = true`) ; **aucune durée maximale ni délai d'inactivité** (pas de `[auth.sessions]`) ; cookie `@supabase/ssr` **400 jours, `httpOnly: false`, `sameSite: lax`, sans `secure` explicite** (`node_modules/@supabase/ssr/dist/main/utils/constants.js:4-11`, aucune option posée dans `lib/supabase/`) | Le client reste connecté sur son téléphone, ce qui lui convient | AUTH-04 : durée et inactivité pour les rôles ADMIN, SUPERADMIN et partenaire |
| « Se déconnecter » | profil (`app/profile/page.tsx:310-320`), scanner | — | `supabase.auth.signOut()` sans portée = **global** (`components/providers/AuthProvider.tsx:224` ; `node_modules/@supabase/auth-js/dist/main/GoTrueClient.js:3405`) : toutes les sessions du compte sont fermées | Le profil ne le dit pas ; les autres appareils effacent leurs billets hors ligne quand ils voient la session fermée (`AuthProvider.tsx:179-180`) | AUTH-07 |
| « Tous les appareils », appareil perdu | aucun bouton dans le profil (`/api/auth/sign-out-global` n'est appelé que par `/reset-password`) | — | Seule voie : changer le mot de passe, ou « Se déconnecter » (global, sans le savoir) | La personne qui a perdu son téléphone ne trouve pas d'action « Déconnecter mes autres appareils » ni la liste de ses appareils | AUTH-07 |
| Jeton après suspension | — | — | Valable jusqu'à 1 h (décision 9 bis point 17) ; lot 9 quater : 403 côté serveur pour un compte banni | — | — |

### 1.9 Suspension et réactivation

| Étape | Écran | Messages envoyés | Sécurité | Expérience | Proposition |
|---|---|---|---|---|---|
| Client suspendu | `/admin/users`, motif obligatoire | `ACCOUNT_SUSPENDED` cloche, SMS, email : « Event Village : votre compte est suspendu. Motif : {motif}. Vos billets payés restent valables à l'entrée. Contactez le support. » (`catalog.ts:1577-1586`) | Sessions révoquées ; bannissement GoTrue au lot 9 quater (A6) | Billets hors ligne effacés à la fermeture de session (G-05 du guide) ; « Contactez le support » sans contact (AUTH-06) | AUTH-06 |
| Réactivation | idem | `ACCOUNT_REACTIVATED` : « Event Village : votre compte est réactivé. Vous pouvez de nouveau vous connecter : {lien}/login » (`:1588-1594`) | Débannissement (A6) | L'écran admin annonce que le motif est transmis, le message ne le contient pas (G-06, guide) | — |
| Partenaire suspendue | fiche partenaire | `PARTNER_SUSPENDED`, `PARTNER_REACTIVATED` (`catalog.ts:1036-1049`) | Cascade sur ses événements ; A6 | — | — |
| Admin suspendu | `/admin/users` | idem `ACCOUNT_SUSPENDED` | `is_admin()` exige un compte actif depuis le 9 ter ; A6 pour le reste | — | — |

### 1.10 Contrôleur invité, consentement

| Étape | Écran | Messages envoyés | Sécurité | Expérience | Proposition |
|---|---|---|---|---|---|
| Activation | `/controller/setup` | SMS d'invitation immédiat (guide, A3) | Lot 9 quater A5 (G-97) et A7 (AUD-12) | — | — |
| Compte existant | `/invitations`, accepter ou refuser | `CONTROLLER_INVITE` en file | Consentement exigé (lot 9 ter, 0.5) | — | — |

### 1.11 Premier SUPERADMIN, création d'un ADMIN

| Étape | Écran | Messages envoyés | Sécurité | Expérience | Proposition |
|---|---|---|---|---|---|
| Bootstrap | `scripts/bootstrap-superadmin.ts` | aucun | Refus si un SUPERADMIN existe ; audit `SUPERADMIN_BOOTSTRAP` ; **aucun second facteur** possible (`supabase/config.toml` : `[auth.mfa.totp] enroll_enabled = false`) | Le script affiche l'adresse du projet lue dans l'environnement (`scripts/bootstrap-superadmin.ts:26-27`) | AUTH-05 |
| Création d'un ADMIN ou d'un compte par un admin | `/admin/users`, « Mot de passe temporaire » (`app/admin/users/page.tsx:649-668`) | **aucun message au titulaire** | Mot de passe choisi par l'admin, **aucune règle** côté serveur (`app/api/admin/users/route.ts:125-130`, `:157-160`), minimum GoTrue 6 caractères ; jamais changé à la première connexion ; l'admin créateur le connaît (AUTH-02, prouvé) | Le titulaire reçoit son mot de passe hors application, par un canal non défini | AUTH-02 |
| Premiers pas d'un ADMIN | `/admin` | — | Aucune permission par défaut (lot 9 bis, B32) | — | — |

### 1.12 Anonymisation

| Étape | Écran | Messages envoyés | Sécurité | Expérience | Proposition |
|---|---|---|---|---|---|
| Par un admin | `/admin/users`, « Supprimer » | aucun | Lot 9 quater B2 (AUD-23) et A9 (AUD-33) | — | — |
| Par la personne | **aucun** | — | — | Un client ne peut pas demander la suppression de son compte depuis l'application (droit à l'effacement, loi sénégalaise sur les données personnelles) | AUTH-15 (P3) |

### 1.13 Verrous et quotas vus par l'utilisateur

| Étape | Écran | Messages envoyés | Sécurité | Expérience | Proposition |
|---|---|---|---|---|---|
| Limite de SMS de code | connexion, oubli, inscription partenaire | — | Serveur : 429 avec `retryAfterSeconds` et `Retry-After` (`lib/sms/sms-http.ts:13-16`) | Ces trois écrans lisent `remainingSeconds` : « 60 s » affiché pour une attente d'une heure ou d'un jour (AUTH-03, prouvé) | AUTH-03 |
| Limite de connexion par mot de passe | connexion | — | 429 `retryAfterSeconds` lu correctement (`LoginForm.tsx:338`) | « Nouvel essai possible dans {n} s » avec barre de progression (`:516-530`) | — |
| Verrou du navigateur | connexion, oubli | — | Confort seulement (localStorage) | Avertissement « {n} tentatives échouées sur 5 » (`:534-538`) : bien | — |
| Changement de mot de passe, numéro, email | fenêtres du profil | — | `retryAfterSeconds` lu (`PasswordChangeDialog.tsx:50`, `PhoneChangeDialog.tsx:48`) | correct | — |

---

## 2. Constats AUTH-01 à AUTH-15

Gravité pour la sécurité (CRITIQUE, ÉLEVÉE, MOYENNE, FAIBLE) ; priorité pour l'expérience et les messages (P1 avant la mise en ligne, P2 juste après, P3 plus tard). Effort : S (moins d'un jour), M (quelques jours), L (une semaine ou plus).

### AUTH-01 — Aucune limite d'essais de mot de passe par compte
- **Catégorie :** sécurité, **ÉLEVÉE**, P1, effort S. ASVS V2.2.1.
- **Preuve :** `tests/audit-auth/auth-01-connexion-essais-par-compte.test.ts` (rouge : 20 mauvais mots de passe sur un même compte depuis 20 adresses, aucun refus). Code : seul quota `password_login_ip` (`app/api/auth/login/route.ts:66-75`), 30 par heure et par IP (`lib/env.ts:115`), IP lue dans `x-forwarded-for` (AUD-09, renvoyé au lot de mise en ligne). Le verrou de 5 échecs n'existe que dans le navigateur (`components/auth/LoginForm.tsx:49-52`).
- **Risque :** un attaquant qui connaît le numéro ou l'adresse d'un admin essaie des mots de passe sans fin en changeant d'adresse. Avec la règle actuelle (8 caractères) et sans second facteur (AUTH-05), c'est le chemin le plus court vers un compte privilégié. Ce trou ne dépend pas de l'hébergeur : même avec la vraie IP (AUD-09 fermé), un réseau de machines le contourne.
- **Proposition :** compteur d'échecs par compte (`password_login_account`, clé = identifiant du compte résolu côté serveur, ou identifiant saisi s'il n'existe pas, pour ne pas révéler l'existence) : 10 échecs par 15 minutes, puis 429 avec le délai ; SMS « Plusieurs tentatives de connexion ont échoué sur votre compte » au 10e échec (une fois par jour).
- **Critère :** la suite `auth-01` passe au vert ; un compte qui a reçu 10 mauvais mots de passe répond 429 au 11e, quelle que soit l'adresse ; le bon mot de passe passe après le délai.

### AUTH-02 — Un admin choisit librement le mot de passe d'un autre compte
- **Catégorie :** sécurité, **ÉLEVÉE**, P1, effort M. ASVS V2.1.1, V2.3.1.
- **Preuve :** `tests/audit-auth/auth-02-mot-de-passe-cree-par-admin.test.ts` (rouge : un mot de passe de 6 minuscules et chiffres tiré au hasard est accepté, HTTP 200 au run 158). Code : `app/api/admin/users/route.ts:125-130` (présence seule), `:157-160` (`createUser` tel quel) ; écran « Mot de passe temporaire » (`app/admin/users/page.tsx:649`), rien ne le rend temporaire. Le lot 9 quater (A5) applique la règle à l'activation d'un contrôleur, pas à ce chemin.
- **Risque :** comptes ADMIN créés avec des mots de passe faibles ou réutilisés, connus d'une autre personne pour toujours, transmis par un canal non défini.
- **Proposition :** pas de mot de passe saisi par l'admin. Le compte est créé sans mot de passe utilisable, et le titulaire reçoit un SMS avec un lien d'activation à usage unique (même parcours que le contrôleur invité), où il choisit son mot de passe selon la règle commune. À défaut : règle commune côté serveur et changement imposé à la première connexion.
- **Critère :** `auth-02` vert ; aucun compte ne peut être créé avec un mot de passe connu d'un autre que son titulaire ; le titulaire reçoit un SMS d'activation.

### AUTH-03 — Délai d'attente faux après une limite, sur trois écrans
- **Catégorie :** expérience, P1, effort S.
- **Preuve :** `tests/audit-auth/auth-03-delai-attente-affiche.test.ts` (rouge sur les 3 écrans). Le serveur rend `retryAfterSeconds` (`lib/security/quota-http.ts:17`, `lib/sms/sms-http.ts:13`) et jamais `remainingSeconds` ; les écrans lisent `remainingSeconds` : `components/auth/LoginForm.tsx:400`, `:416` ; `app/forgot-password/page.tsx:266-267` ; `app/partner/register/page.tsx:323`. Constat W2-01 du guide, non repris par le lot 9 quater.
- **Proposition :** lire `retryAfterSeconds` ; afficher le délai en minutes ou en heures au-delà de 120 s (« Réessayez dans 45 minutes. »).
- **Critère :** `auth-03` vert ; après 10 codes dans la journée, l'écran affiche l'heure réelle de la prochaine possibilité.

### AUTH-04 — Sessions sans fin, cookie lisible par la page
- **Catégorie :** sécurité, **MOYENNE**, P1 pour les rôles ADMIN et SUPERADMIN, P2 pour les autres, effort M. ASVS V3.3.2, V3.4.1, V3.4.2.
- **Preuve :** `supabase/config.toml` (aucune section `[auth.sessions]` : ni `timebox` ni `inactivity_timeout`) ; options par défaut de `@supabase/ssr` 0.12.5 : `maxAge` 400 jours, `httpOnly: false`, aucune option `secure` (`node_modules/@supabase/ssr/dist/main/utils/constants.js:4-11`) ; aucune option posée dans `lib/supabase/`.
- **Risque :** un SUPERADMIN qui oublie de se déconnecter d'un ordinateur partagé reste connecté indéfiniment ; un script injecté (comme AUD-17) lit le jeton de session. `httpOnly` est imposé par le client navigateur de Supabase : la mesure réaliste est la durée.
- **Proposition :** dans le tableau de bord Supabase (offre payante), durée maximale de session et délai d'inactivité ; à défaut, côté application : pour ADMIN et SUPERADMIN, mot de passe redemandé après 12 h de session et après 30 minutes d'inactivité sur `/admin` ; cookies `secure` en production ; CSP bloquante (lot de mise en ligne).
- **Critère :** une session SUPERADMIN inactive 30 minutes doit redemander le mot de passe avant toute action admin.

### AUTH-05 — Aucun second facteur pour les comptes privilégiés
- **Catégorie :** sécurité, **ÉLEVÉE**, P1, effort M. ASVS V2.2 (niveau 2), V4.3.1.
- **Preuve :** `supabase/config.toml` : `[auth.mfa.totp] enroll_enabled = false`, `verify_enabled = false` ; `[auth.mfa.phone]` idem ; aucun écran d'inscription d'un second facteur.
- **Risque :** le mot de passe seul protège le SUPERADMIN, qui ouvre les services, règle les frais et valide les partenaires (et peut être le client, non développeur).
- **Proposition :** second facteur obligatoire pour ADMIN et SUPERADMIN : code par application (TOTP) ou, plus simple pour le client, code SMS demandé à chaque nouvelle session admin (le parcours de code existe déjà).
- **Critère :** un ADMIN qui ouvre `/admin` sur un nouvel appareil doit saisir un second code.

### AUTH-06 — « Contactez le support » sans aucun moyen de le joindre
- **Catégorie :** expérience et message, P1, effort S.
- **Preuve :** textes `PASSWORD_CHANGED`, `PHONE_CHANGED`, `ACCOUNT_SUSPENDED` (`lib/notifications/catalog.ts:879-881`, `:891-893`, `:1581-1584`) ; refus de connexion « Votre compte est suspendu. Veuillez contacter le support. » (`components/auth/LoginForm.tsx:284`) ; aucun lien, numéro ni adresse de support pour un client dans l'application (seule l'adresse servie aux partenaires : `app/partner/dashboard/page.tsx:469`, `app/partner/subscription/page.tsx:61-63`).
- **Risque :** la victime d'une prise de compte (mot de passe ou numéro changé par un autre) ne sait pas quoi faire ; c'est le moment où il faut agir vite.
- **Proposition :** un numéro WhatsApp ou une adresse du support, réglable par le SUPERADMIN, ajouté à ces messages et à une page « Aide » ; dans `PASSWORD_CHANGED`, ajouter l'action immédiate : « Si ce n'est pas vous : Mot de passe oublié sur {lien} ».
- **Critère :** chaque message qui dit « contactez le support » donne un moyen de contact ; la page de connexion d'un compte suspendu aussi.

### AUTH-07 — « Se déconnecter » ferme tous les appareils sans le dire
- **Catégorie :** expérience, P2, effort S. (ASVS V3.3.4, partiel.)
- **Preuve :** `components/providers/AuthProvider.tsx:224` (`signOut()` sans portée = `global`, `GoTrueClient.js:3405`) ; effacement des billets hors ligne à la déconnexion (`:217`) et, sur les autres appareils, à l'événement `SIGNED_OUT` (`:179-180`) ; aucun bouton « Déconnecter mes autres appareils » ni liste des appareils (`/api/auth/sign-out-global` appelé seulement par `app/reset-password/page.tsx:293`).
- **Risque :** un client qui se déconnecte d'un ordinateur perd la session de son téléphone, et ses billets hors ligne au prochain chargement, parfois devant l'entrée d'un événement.
- **Proposition :** « Se déconnecter » ferme seulement cet appareil (`scope: 'local'`) ; ajouter dans le profil « Déconnecter tous mes appareils » (confirmation, puis appel de `/api/auth/sign-out-global`). Le texte du scanner (« Vous serez déconnecté de tous vos appareils ») suit le choix.
- **Critère :** se déconnecter sur un ordinateur laisse la session et les billets hors ligne du téléphone ; le bouton dédié ferme toutes les sessions.

### AUTH-08 — La récupération par email ne passe pas par le service d'email de l'application
- **Catégorie :** message, P1, effort S (configuration) à M (passage par Resend).
- **Preuve :** `app/forgot-password/page.tsx:207-211` : `supabase.auth.resetPasswordForEmail` envoie par le SMTP de Supabase Auth, pas par Resend ; `supabase/config.toml` : `[auth.rate_limit] email_sent = 2` (local). Aucun modèle de cet email dans le dépôt (NON VÉRIFIÉ sur le projet hébergé : SMTP personnalisé, modèle, limite).
- **Risque :** sans SMTP personnalisé, Supabase n'envoie qu'aux membres de l'organisation du projet et en très petit nombre : un client qui choisit « par email » ne reçoit rien, alors que l'écran dit « Vérifiez votre boîte de réception ». Les autres emails (vérification, notifications) passent par Resend, avec un autre expéditeur.
- **Proposition :** soit configurer le SMTP personnalisé de Supabase avec le même domaine que Resend (et un modèle en français), soit envoyer le lien de récupération par la route de l'application et Resend, comme le lien de vérification.
- **Critère :** sur event-village-dev, un compte à email vérifié reçoit l'email de récupération en français, du même expéditeur que les autres emails.

### AUTH-09 — Aucun avis quand une adresse email est ajoutée ou changée
- **Catégorie :** message, P2, effort S. ASVS V2.2.3 (partiel).
- **Preuve :** le registre ne contient aucun type d'avis pour l'adresse email (seuls `PASSWORD_CHANGED`, `PHONE_CHANGED`, `EMAIL_VERIFICATION` : `lib/notifications/catalog.ts:874`, `:886`) ; la validation du lien change l'adresse de connexion (`app/api/account/email/verify/route.ts:65`).
- **Risque :** une personne qui a un instant le téléphone déverrouillé (session ouverte et mot de passe connu) ajoute son adresse, la vérifie, puis récupère le compte par email : le titulaire n'est prévenu de rien.
- **Proposition :** SMS indispensable au numéro du compte à la validation d'une nouvelle adresse : « Event Village : une adresse email a été ajoutée à votre compte. Si ce n'est pas vous, contactez le support. » ; email à l'ancienne adresse vérifiée en cas de changement.
- **Critère :** la vérification d'une adresse met en file un SMS au numéro du compte.

### AUTH-10 — Le SMS de code ne dit pas de ne pas le communiquer
- **Catégorie :** message, P2, effort S.
- **Preuve :** `lib/notifications/catalog.ts:1800-1808` : connexion, inscription et réinitialisation sans mention ; seul le code de retrait dit « Ne le donnez à personne. » (`:1806`).
- **Risque :** arnaque par téléphone (« donnez-moi le code que vous venez de recevoir »), fréquente sur les comptes Mobile Money.
- **Proposition :** « Event Village : votre code est {code}. Ne le donnez à personne, même à Event Village. Valable 10 minutes. » (à mesurer : un segment GSM-7).
- **Critère :** les trois SMS de code contiennent l'avertissement et tiennent en un segment.

### AUTH-11 — Règle de mot de passe en dessous de l'ASVS
- **Catégorie :** sécurité, **FAIBLE**, P2, effort S. ASVS V2.1.1, V2.1.7, V2.1.9.
- **Preuve :** `lib/validations/auth.ts:93-97` : 8 caractères, majuscule, chiffre, caractère spécial ; aucune liste de mots de passe compromis ; GoTrue 6 caractères (`supabase/config.toml`, `minimum_password_length = 6`, `password_requirements = ""`).
- **Proposition :** 12 caractères minimum, sans obligation de composition, refus des 10 000 mots de passe les plus courants (liste dans le dépôt) ; même règle dans GoTrue (`minimum_password_length = 12`) pour qu'aucun chemin ne l'évite. Limite haute 64 au moins, sans troncature (GoTrue utilise bcrypt, limité à 72 octets : NON VÉRIFIÉ qu'il refuse au-delà).
- **Critère :** « Senegal2026! » refusé (mot de passe courant), « ma soirée au théâtre » accepté.

### AUTH-12 — La partenaire n'a pas d'accusé de réception par SMS
- **Catégorie :** message, P2, effort S.
- **Preuve :** `PARTNER_REGISTERED_ACK` : cloche et email seulement (`lib/notifications/catalog.ts:1012-1016`) ; l'email de la partenaire n'est pas encore vérifié à ce moment (adresse en attente), donc l'accusé ne part en pratique que dans la cloche.
- **Proposition :** SMS « Event Village : votre demande de compte partenaire {société} est reçue. Nous l'examinons sous 48 h. » (le SMS aux admins est déjà décidé, D1).
- **Critère :** une inscription partenaire met en file un SMS à son numéro.

### AUTH-13 — Aucun avis de connexion depuis un nouvel appareil
- **Catégorie :** message, P3, effort M. ASVS V2.2.3 (partiel).
- **Preuve :** aucun type d'avis de connexion au registre ; `POST /api/auth/login` et `/api/auth/verify-otp` n'émettent rien.
- **Proposition :** pour ADMIN, SUPERADMIN et partenaire d'abord : cloche et email (pas de SMS, coût) à la première connexion d'un appareil inconnu.
- **Critère :** une connexion admin depuis un navigateur jamais vu met en file un avis.

### AUTH-14 — La vérification du code rend toute la ligne du compte
- **Catégorie :** sécurité, **FAIBLE**, P2, effort S. ASVS V8.3.1 (données non nécessaires), lien avec AUD-19 et A4.
- **Preuve :** `app/api/auth/verify-otp/route.ts:82-86` (`select('*')`), `:131-139` (`user: userProfile`, `email: targetEmail`).
- **Risque :** la réponse expose au navigateur des champs internes (adresse technique, adresse en attente, statut, rôle, champs de parrainage) ; le lot 9 quater (A4) veut une adresse technique « jamais affichée ».
- **Proposition :** rendre seulement `{ verified, token_hash, user: { id } }`.
- **Critère :** la réponse de `verify-otp` ne contient ni `email` ni aucune colonne autre que l'identifiant.

### AUTH-15 — Pas de suppression de compte par la personne elle-même
- **Catégorie :** expérience, P3, effort M.
- **Preuve :** aucune route ni aucun écran de suppression côté client ; seule l'anonymisation par un admin existe (`app/api/admin/users/route.ts`, DELETE).
- **Proposition :** « Supprimer mon compte » dans le profil (mot de passe récent, confirmation tapée), qui crée une demande traitée par l'anonymisation existante.
- **Critère :** un client peut demander la suppression de son compte depuis son profil.

---

## 3. Grille ASVS 4.0.3, V2 et V3 (et V4 pour les admins)

| Exigence | État | Preuve |
|---|---|---|
| 2.1.1 mot de passe de 12 caractères au moins | non (8) | `lib/validations/auth.ts:94`, AUTH-11 |
| 2.1.2 au moins 64 caractères permis | partielle (aucune limite à l'inscription, 200 au changement) | `app/api/account/password/route.ts:30-32` |
| 2.1.3 pas de troncature | NON VÉRIFIÉ (bcrypt de GoTrue, 72 octets) | AUTH-11 |
| 2.1.4 tout caractère Unicode permis | respectée | `lib/validations/auth.ts:93-97` |
| 2.1.5 la personne peut changer son mot de passe | respectée | `app/api/account/password/route.ts` |
| 2.1.6 changement avec l'ancien et le nouveau | respectée (profil) ; récupération : lot 9 quater A3 | `:96-118` |
| 2.1.7 refus des mots de passe compromis | non | AUTH-11 |
| 2.1.8 indicateur de force | respectée | `components/auth/PasswordStrengthChecklist.tsx` |
| 2.1.9 pas de règle de composition | non | `lib/validations/auth.ts:95-97` |
| 2.1.10 pas de rotation périodique imposée | respectée | — |
| 2.1.11 collage et gestionnaires de mots de passe | respectée | `autocomplete` `current-password`, `new-password`, `username` |
| 2.1.12 afficher le mot de passe | respectée | `LoginForm.tsx:610-618`, `app/register/page.tsx:534-541` |
| 2.2.1 anti-automatisation efficace | partielle (IP seulement à la connexion ; codes bien protégés) | AUTH-01 |
| 2.2.2 facteur faible (SMS) seulement en complément | partielle : le code SMS est un facteur de connexion à lui seul (choix adapté au public, à garder sous quotas) | `app/api/auth/verify-otp/route.ts` |
| 2.2.3 avis après un changement sensible | partielle : mot de passe et numéro oui ; email et nouvel appareil non | AUTH-09, AUTH-13 |
| 2.3.1 mot de passe initial généré, temporaire, changé à la première utilisation | non | AUTH-02 |
| 2.5.1 secret d'activation pas envoyé en clair | respectée (codes et liens à usage unique) | `lib/auth/otp-store.ts` |
| 2.5.2 pas d'indice de mot de passe ni de question secrète | respectée | — |
| 2.5.4 pas de compte partagé ou par défaut | respectée | bootstrap unique |
| 2.5.6 récupération sûre | partielle (lot 9 quater A3, G-04) ; email : AUTH-08 | — |
| 2.7.2 code hors bande de durée courte | respectée (10 minutes) | `app/api/auth/send-otp/route.ts:88` |
| 2.7.3 code à usage unique | respectée | `lib/auth/otp-store.ts:88-103` |
| 2.7.6 code aléatoire sûr | respectée (`randomInt`) | `send-otp/route.ts:14-16` |
| 2.8.4 un code ne sert qu'une fois, essais limités | respectée (5 essais, verrou de ligne) | `lib/auth/otp-store.ts:17-19` |
| 3.2.1 nouveau jeton à chaque connexion | respectée (GoTrue) | — |
| 3.2.2 jeton de 128 bits au moins | respectée (GoTrue) | — |
| 3.2.3 jeton rangé de façon sûre dans le navigateur | partielle (cookie lisible par la page, exigé par le client Supabase) | AUTH-04 |
| 3.3.1 la déconnexion invalide la session | respectée (globale) | `AuthProvider.tsx:224` |
| 3.3.2 nouvelle authentification après 12 h ou 30 min d'inactivité (niveau 2) | non | AUTH-04 |
| 3.3.3 fermer les autres sessions après un changement de mot de passe | respectée | `app/api/account/password/route.ts:133-141` |
| 3.3.4 voir et fermer ses sessions | partielle (fermeture globale implicite, aucune liste) | AUTH-07 |
| 3.4.1 attribut `Secure` | NON VÉRIFIÉ en production (aucune option posée) | AUTH-04 |
| 3.4.2 attribut `HttpOnly` | non (exigé par le client Supabase du navigateur) | AUTH-04 |
| 3.4.3 attribut `SameSite` | respectée (`lax`) | `@supabase/ssr` |
| 3.7.1 nouvelle authentification avant une action sensible | respectée (mot de passe de moins de 10 minutes) | `lib/auth/password-confirm.ts:163-186` |
| 4.3.1 interfaces d'administration protégées par un second facteur | non | AUTH-05 |

---

## 4. Trous du plan du lot 9 quater

Le plan (consigne `lot9quater-spec.md`, contrat de travail de la session du lot) a été lu ; les points ci-dessous ne sont couverts ni par lui ni par une décision déjà prise.

| # | Trou | Lien | Proposition |
|---|---|---|---|
| T1 | A6 bannit le compte suspendu dans GoTrue, mais `send-otp` lui envoie toujours un code (SMS payé) et `verify-otp` crée le lien de session avant tout contrôle de statut (`app/api/auth/verify-otp/route.ts:97-129`). Après A6, la vérification échouera chez GoTrue et l'écran dira « Code accepté, mais la connexion n'a pas pu s'ouvrir. Demandez un nouveau code et réessayez. » (`components/auth/LoginForm.tsx:106`) : la personne redemande des codes en boucle. | A6, AUD-06 | Refus avant le SMS et avant le lien, pour un compte SUSPENDU : « Votre compte est suspendu. » + contact (AUTH-06). |
| T2 | A5 refuse la connexion d'un contrôleur non activé et applique la règle commune à l'activation, mais le compte créé par un admin (`app/api/admin/users/route.ts`) garde un mot de passe libre et jamais changé. | A5, G-31 | AUTH-02. |
| T3 | Aucun bloc ne compte les échecs de mot de passe par compte ; AUD-08 et AUD-09 sont renvoyés au lot de mise en ligne, mais une limite par compte ne dépend pas de l'IP. | AUD-08, AUD-09 | AUTH-01. |
| T4 | A4 veut une adresse technique « jamais affichée », mais `verify-otp` la rend au navigateur (`email: targetEmail`, et `user` complet) ; le contrat de A4 ne cite pas cette réponse. | A4, AUD-19 | AUTH-14. |
| T5 | A3 garantit l'avis « mot de passe modifié » sur tout chemin, mais la récupération par email (chemin de G-04) dépend d'un email qui ne part pas sans SMTP configuré. | A3, G-04 | AUTH-08. |

---

## 5. Ce qui est bien fait et doit rester

- **Codes SMS :** six chiffres tirés par `randomInt`, valables 10 minutes, rangés en empreinte HMAC liée au numéro, comparés en temps constant, 5 essais par code sous verrou de ligne, consommés une seule fois, liés à leur usage (un code de retrait n'ouvre jamais de session) (`lib/auth/otp-store.ts`, `app/api/auth/verify-otp/route.ts:52-62`).
- **Inscription :** aucun compte avant le code ; un tiers ne bloque plus l'inscription d'un numéro (`app/api/auth/register/start/route.ts:18-26`, `app/api/auth/register/route.ts:66-84`).
- **Connexion :** correspondance numéro → compte faite par le serveur, même réponse pour un numéro inconnu et un mauvais mot de passe (`app/api/auth/login/route.ts:51-62`, `:94`).
- **Récupération par SMS :** réponse neutre, aucun SMS pour un numéro sans compte (`app/api/auth/send-otp/route.ts:73-77`).
- **Mot de passe redemandé** pour le transfert, le numéro, l'email et le constat « non versé », lié à la session, 10 minutes (`lib/auth/password-confirm.ts`).
- **Changement de mot de passe :** ancien mot de passe exigé, quota par compte, autres appareils déconnectés, avis par SMS, cloche et email (`app/api/account/password/route.ts`).
- **Changement de numéro :** code au nouveau numéro, SMS à l'ancien, sessions révoquées (`app/api/account/phone/**`).
- **Vérification de l'email :** jeton haché, usage unique, 24 h, quotas par compte et par adresse, refus en clair (`app/api/account/email/**`).
- **Garde fermée par défaut :** une garde de quota indisponible refuse (503), jamais un passage (`lib/security/quota-http.ts:3`).
- **Écrans :** code en 6 cases avec clavier numérique, `autocomplete="one-time-code"` et collage ; « Afficher le mot de passe » ; bons `autocomplete` pour les gestionnaires ; cibles de 44 px ; avertissement « tentatives restantes » ; inscription client en 2 étapes claires (« Étape 1 sur 2 », « Étape 2 sur 2 »).

---

## 6. Run CI de la branche

**Run 158** (`5c07019`, tests seuls ; `runs/158-43463648066` sur `origin/ci-results`) : job 3 244 s ; verify **346 suites vertes sur 350** ; build, budget JS et **e2e verts dans leurs 10 phases** (connexion, captures, emails, dev-page, fumée, terrain, PWA, fake-prod, perf, recette).

Les 4 suites rouges :

| Suite | Raison | Bonne raison ? |
|---|---|---|
| `tests/audit-auth/auth-01-connexion-essais-par-compte.test.ts` | « aucun refus par compte après 20 mauvais mots de passe venus de 20 adresses » : les 20 essais répondent `401/INVALID_CREDENTIALS` | oui (AUTH-01) |
| `tests/audit-auth/auth-02-mot-de-passe-cree-par-admin.test.ts` | « compte créé avec le mot de passe… (HTTP 200) : aucune règle de mot de passe sur ce chemin » ; réponse `{"success":true, …, "message":"Utilisateur avec le rôle CLIENT créé avec succès."}` | oui (AUTH-02) |
| `tests/audit-auth/auth-03-delai-attente-affiche.test.ts` | 3 écrans lisent `remainingSeconds` (LoginForm, forgot-password, partner/register) ; le contrôle « aucune route ne rend remainingSeconds » passe | oui (AUTH-03) |
| `tests/schema/secrets-codes-en-dur.test.ts` | « mots de passe littéraux : tests/audit-auth/auth-02-mot-de-passe-cree-par-admin.test.ts:30 » : la première version d'AUTH-02 écrivait le mot de passe faible en clair | **non : défaut de mon test**, corrigé (valeur tirée au hasard, `randomBytes(3)`) ; suite verte en local (3/3) |

**Run 160** (`3a08c48`, correctif du test et rapport ; `runs/160-43473085708`) : job 3 415 s ; verify **346/350** ; e2e vert dans ses 10 phases. `secrets-codes-en-dur` est verte. Les 3 suites `tests/audit-auth/` sont rouges pour les mêmes raisons qu'au run 158. Une 4e suite a rougi :

- `tests/partner-halls-m7.test.ts`, cas 2 (« Deux réservations simultanées… -> 1 Succès, 1 Échec ») : « Le message de rejet doit expliciter le conflit de calendrier (Reçu: Échec création réservation: deadlock detected) ». Le module des salles est fermé par défaut et cette branche n'y touche pas (`git diff origin/main..HEAD` ne change que `docs/`, `tests/audit-auth/` et le déclencheur de `.github/workflows/verify.yml`). La suite était verte au run 158 (même code, à une valeur de test près) et n'a échoué dans aucun des 40 runs précédents de `origin/ci-results` : **échec intermittent d'un test de concurrence existant**, sans lien avec l'audit. C'est néanmoins un constat : deux réservations concurrentes peuvent se bloquer mutuellement (« deadlock ») au lieu de donner un refus clair. À traiter avec AUD-28, avant l'ouverture des salles (lot 10).

**Run de confirmation** : le run de ce commit doit montrer exactement les 3 suites `tests/audit-auth/` rouges ; son résultat est ajouté ci-dessous, dans un commit marqué `[skip ci]`.
