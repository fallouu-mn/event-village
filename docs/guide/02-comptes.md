# 02 — Comptes : inscription, connexion, mot de passe, numéro, email, suspension

> Guide complet de l'application Event Village, état de `main` à `0889df6` (lots 1 à 9 ter). Source de vérité : le code.
> Chaque fait porte sa preuve `fichier:ligne` (chemins relatifs au dépôt ; `M/` = `supabase/migrations/`).
> Ce qui n'a pas pu être établi est marqué **NON VÉRIFIÉ**. Données d'exemple fictives : « Fatou Diop », numéro `77 000 00 00`
> (forme enregistrée `+221770000000`), adresse `fatou@exemple.sn`.
> Les messages (canaux, heures calmes, plafonds) sont détaillés dans `10-notifications.md` ; les quotas chiffrés dans
> `13-limites-quotas-securite.md`. Les écarts relevés en écrivant ce fichier sont listés dans `15-constats.md`.

## Sommaire

| N° | Scénario |
|---|---|
| 02.1 | Inscription client, étape 1 : numéro et code SMS |
| 02.2 | Inscription client, étape 2 : code, profil, email facultatif, parrainage |
| 02.3 | Connexion par mot de passe (numéro ou email) |
| 02.4 | Connexion par code SMS |
| 02.5 | Trop d'essais à la connexion : verrou de l'écran et refus du serveur |
| 02.6 | Mot de passe oublié par téléphone (code SMS) |
| 02.7 | Mot de passe oublié par email (lien) |
| 02.8 | Choisir le nouveau mot de passe (`/reset-password`) |
| 02.9 | Changer son mot de passe une fois connecté |
| 02.10 | Mot de passe redemandé avant une action sensible (10 minutes) |
| 02.11 | Changer de numéro de téléphone |
| 02.12 | Modifier prénom, nom ; ajouter, changer ou retirer l'email |
| 02.13 | Vérifier son adresse email (lien) et renvoyer le lien |
| 02.14 | Photo de profil |
| 02.15 | Préférences de notification par sujet |
| 02.16 | Page « Mon profil » : ce qu'elle montre ; déconnexion |
| 02.17 | Suspension d'un compte (non partenaire) par un administrateur |
| 02.18 | Réactivation d'un compte suspendu |
| 02.19 | « Supprimer » un compte : anonymisation par un administrateur |
| 02.20 | Récapitulatif des quotas du compte (codes, connexions, liens) |

Règles communes à tout le fichier :

- **Numéro accepté** : mobile sénégalais 70, 75, 76, 77 ou 78 suivi de 7 chiffres ; espaces, tirets, points, parenthèses
  et préfixes `+221`, `00221`, `221` acceptés, puis enregistré sous la forme `+221…` (`lib/validations/auth.ts:13-28`,
  `:30`, `:36-39`). Texte commun d'un numéro refusé : « Numéro de mobile sénégalais invalide. Exemple : 77 123 45 67. »
  (`lib/validations/auth.ts:8`).
- **Mot de passe robuste** (inscription, changement, réinitialisation) : 8 caractères au moins, une majuscule, un chiffre,
  un caractère spécial (`lib/validations/auth.ts:93-97`). Messages : « Le mot de passe doit contenir au moins 8
  caractères », « Le mot de passe doit contenir au moins une majuscule », « Le mot de passe doit contenir au moins un
  chiffre », « Le mot de passe doit contenir au moins un caractère spécial (!@#$...) » (`lib/validations/auth.ts:94-97`).
  La liste affichée sous le champ (« Robustesse du mot de passe ») : « Au moins 8 caractères », « Au moins une majuscule
  (A-Z) », « Au moins un chiffre (0-9) », « Au moins un caractère spécial (!@#$...) »
  (`components/auth/PasswordStrengthChecklist.tsx:8-11`, `:39`).
- **Code SMS** : 6 chiffres tirés au hasard (`app/api/auth/send-otp/route.ts:14-16`), jamais stocké en clair (empreinte
  HMAC liée au numéro, `lib/auth/otp-store.ts:37-41`), 5 essais au plus par code (`lib/auth/otp-store.ts:25`,
  `M/20261102000002_lot5_dette.sql:484`, `:521-531`), seul le dernier code non utilisé d'un numéro et d'un objet est
  valable (`M/20261102000002_lot5_dette.sql:509-514`). Un code ne vaut que pour son objet : connexion, inscription,
  réinitialisation, changement de numéro, retrait, activation de contrôleur (`lib/auth/otp-store.ts:28`).
- **Adresse technique** : un compte sans email vérifié a pour identifiant de connexion interne
  `<numéro sans +>@eventvillage.sn` (ex. `221770000000@eventvillage.sn`) ; elle n'est jamais montrée comme son email
  (`lib/auth/account-sync.ts:16-18`, `components/profile/ProfileForm.tsx:27`, `app/profile/page.tsx:235`).

---

## 02.1 Inscription client, étape 1 : numéro et code SMS

1. **Qui, où.** Visiteur non connecté. `/register` (page publique, `middleware.ts:54-66`). On y arrive par « Créer un
   compte client » sous « Pas encore de compte ? » sur `/login` (`components/auth/LoginForm.tsx:721-728`), avec la
   destination conservée (`?redirect=`) si elle est un chemin interne autre que l'accueil
   (`components/auth/LoginForm.tsx:93-95`, `:724`). Un lien de parrainage `?ref=CODE` préremplit le code et ouvre
   « Plus d'options » (`app/register/page.tsx:146-154`). En-tête : « Étape 1 sur 2 : votre numéro », titre « Créer un
   compte », texte « Commencez par votre numéro : nous vous envoyons un code par SMS pour le vérifier. »
   (`app/register/page.tsx:334-337`). Bouton « Recevoir le code par SMS » (`app/register/page.tsx:448`).
2. **Ce qu'il saisit.** « Numéro de téléphone (Sénégal) », obligatoire, exemple affiché `77 123 45 67`, aide « Mobile
   sénégalais : 70, 75, 76, 77 ou 78. Le code arrive par SMS sur ce numéro. » (`app/register/page.tsx:425-439`).
   Numéro invalide : « Numéro de mobile sénégalais invalide. Exemple : 77 123 45 67. »
   (`app/register/page.tsx:206-209`, `lib/validations/auth.ts:8`, `:132-134`).
3. **Ce que fait le système.** `POST /api/auth/register/start` : si le numéro a déjà un compte, aucun SMS ne part
   (`app/api/auth/register/start/route.ts:45-52`) ; sinon réservation anti-abus (numéro, adresse IP, plafond global,
   voir 13) **avant** d'enregistrer le code (`:54-57`), code d'objet « inscription » valable **600 s (10 min)**
   (`:13-14`, `:59-60`), envoi immédiat du SMS, journalisé sans le code (`:64-68`). **Aucun compte n'est créé à cette
   étape** (`:20-23`). La réponse donne le délai avant un nouveau code : **60 s** (`:15-16`, `:77-82`). L'écran passe à
   l'étape 2 avec le bandeau « Code envoyé par SMS au {numéro}. » (`app/register/page.tsx:229`).
   Exemple : « Code envoyé par SMS au +221770000000. »
4. **Messages envoyés.**

   | Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
   |---|---|---|---|---|
   | Le numéro saisi | SMS | Indispensable (envoi synchrone, hors boîte d'envoi) | Immédiat | « Event Village : votre code de vérification est {code}. Valable 10 minutes. » — ex. « Event Village : votre code de vérification est 123456. Valable 10 minutes. » (74 caractères, 1 segment GSM-7) (`lib/notifications/catalog.ts:1800-1804`, type `OTP_REGISTER` `:1689`) |

5. **Ce que voient les autres rôles.** Rien : aucun compte n'existe encore. L'envoi apparaît dans le journal des envois
   synchrones (type `OTP_REGISTER`, sans le code) (`app/api/auth/register/start/route.ts:62-68`) ; voir 10 et 11
   (supervision).
6. **Refus.**
   - Numéro déjà inscrit : « Ce numéro de téléphone est déjà associé à un compte. Veuillez vous connecter. »
     (`app/api/auth/register/start/route.ts:49`), avec le bouton « Recevoir un code de connexion » qui mène à `/login`
     (`app/register/page.tsx:216-219`, `:363-366`). Ce bouton ouvre la connexion en mode mot de passe, pas le code :
     voir 15 (constat W2-04).
   - Trop de SMS (numéro : 3 par 15 min et 10 par jour ; IP : 10 par heure et 30 par jour ; plafond global) :
     « Trop de demandes de SMS. Réessayez dans {n} minute(s). », ou « L'envoi de SMS est momentanément suspendu.
     Réessayez plus tard ou contactez le support. » (`lib/sms/sms-guard.ts:164-193`, limites `lib/env.ts:57-62`).
     Exemple : « Trop de demandes de SMS. Réessayez dans 12 minutes. »
   - Garde indisponible : « Service SMS momentanément indisponible. » (`lib/sms/sms-guard.ts:161-163`).
   - SMS non parti : « Impossible d'envoyer le code de vérification par SMS. Vérifiez votre numéro et réessayez. »
     (`app/api/auth/register/start/route.ts:71-74`).
   - Panne : « Inscription momentanément impossible. Réessayez dans un instant. » (`:85-88`) ; réseau coupé côté
     téléphone : « Connexion impossible : le code n’a pas pu être envoyé. Vérifiez votre réseau puis réessayez. »
     (`app/register/page.tsx:232`).
7. **Preuves et essai.** Fichiers cités ci-dessus. Recette : essai 7 (`docs/recette-billetterie.md:421-437`).

## 02.2 Inscription client, étape 2 : code, profil, email facultatif, parrainage

1. **Qui, où.** Même personne, même page `/register`, en-tête « Étape 2 sur 2 : code et profil », texte « Saisissez le
   code reçu, puis vos informations : votre compte est créé dès que le code est vérifié. »
   (`app/register/page.tsx:334-340`). Rappel du numéro et bouton « Modifier le numéro » (`:456-463`). Bouton final
   « Créer mon compte », grisé tant que le code n'a pas 6 chiffres (`:596-606`).
2. **Ce qu'il saisit.**

   | Champ (libellé exact) | Obligatoire | Limites et aide | Preuve |
   |---|---|---|---|
   | « Code reçu par SMS » | oui | 6 chiffres ; aide « 6 chiffres, envoyés au {numéro}. » ; bouton « Nouveau code dans {n} s » puis « Recevoir un nouveau code » | `app/register/page.tsx:465-495` |
   | « Prénom » (exemple `Moussa`) | oui | 2 à 80 caractères | `app/register/page.tsx:499-508`, `lib/validations/auth.ts:147` |
   | « Nom » (exemple `Diop`) | oui | 2 à 80 caractères | `app/register/page.tsx:509-517`, `lib/validations/auth.ts:148` |
   | « Mot de passe » (« 8 caractères au moins ») | oui | règle robuste, bouton « Afficher le mot de passe » ; aucune confirmation demandée | `app/register/page.tsx:520-545`, `lib/validations/auth.ts:139-143`, `:154` |
   | « Adresse email (facultative) » (exemple `client@domaine.com`) | non | 254 caractères ; aide « Recommandé : recevez vos billets et confirmations par email » ; domaine `eventvillage.sn` refusé | `app/register/page.tsx:548-564`, `lib/validations/auth.ts:151-153` |
   | « Code de parrainage (facultatif) » sous « Plus d’options : code de parrainage » | non | 64 caractères, mis en capitales, exemple `ex : EV-AMB-1234` | `app/register/page.tsx:566-594`, `lib/validations/auth.ts:155` |

   Messages des champs : « Saisissez le code à 6 chiffres reçu par SMS. » (`app/register/page.tsx:247-249`) ; « Le prénom
   doit contenir au moins 2 caractères », « Le prénom est trop long », « Le nom doit contenir au moins 2 caractères »,
   « Le nom est trop long » (`lib/validations/auth.ts:147-148`) ; « Adresse email invalide » ; « Cette adresse est
   réservée. Saisissez votre propre adresse email. » (`lib/validations/auth.ts:5`, `:151-152`) ; « Code de parrainage
   invalide » (`:155`). Une erreur d'email ou de parrainage s'affiche sous le champ, qui prend le focus
   (`app/register/page.tsx:189-194`, `:276-281`).
3. **Ce que fait le système.** `POST /api/auth/register`, dans cet ordre (`app/api/auth/register/route.ts:66-84`,
   commentaire de tête) :
   1. contrôle du profil (aucun essai de code consommé) ;
   2. code absent : refus ; code mal formé : refus (`:110-118`) ;
   3. compte déjà existant pour le numéro ou l'email : refus (`:126-130`) ; code de parrainage inconnu : refus, le
      code SMS reste valable (`:132-147`) ;
   4. quota de vérification par numéro (10 essais par 15 min, voir 13), puis vérification **et consommation** du code
      d'inscription (`:149-165`) ;
   5. création du compte de connexion avec l'adresse technique, numéro et email confirmés (`:167-179`), puis du profil :
      rôle `CLIENT`, statut **`ACTIF`**, statut de parrainage `STANDARD`, **numéro vérifié** (`phone_verified_at`)
      (`:193-205`) ; si le profil échoue, le compte de connexion est retiré pour permettre une nouvelle inscription
      (`:206-215`) ;
   6. parrainage : relation « client à client » créée avec les taux du barème actif du statut du parrain ; une erreur
      est journalisée et n'empêche pas l'inscription (`:20-64`, `:217-223`) ; détail dans `09-parrainage.md` ;
   7. adresse saisie : elle n'est **pas** l'identifiant de connexion ; elle est mise « en attente » (`email_pending`) et
      un lien de vérification valable 24 h part au mieux (`:120-124`, `:198-199`, `:225-235`) ; voir 02.13.

   Puis l'écran ouvre la session avec l'adresse technique et le mot de passe (`app/register/page.tsx:289-303`). Sans
   email : redirection immédiate vers la destination conservée, sinon l'accueil (`:305-310`). Avec email : le
   formulaire disparaît, l'en-tête dit « Votre compte est créé et votre numéro est vérifié. » et un bandeau donne le sort
   du lien, avec le bouton « Continuer » (`:338-339`, `:396-413`) :
   - lien parti : « Vérifiez votre adresse email » / « Un lien de vérification a été envoyé à {adresse}. Il est valable
     24 heures. » (`app/register/page.tsx:98-100`) — ex. « Un lien de vérification a été envoyé à fatou@exemple.sn. Il
     est valable 24 heures. » ;
   - envoi des emails non configuré : « Adresse enregistrée, non vérifiée » / « L’envoi des emails n’est pas encore
     disponible. Votre adresse est enregistrée : vous pourrez la vérifier plus tard. » (`:101-106`) ;
   - autre échec : « Adresse enregistrée, non vérifiée » / « Le lien n’a pas pu être envoyé. Renvoyez-le depuis votre
     profil. » (`:108`).
4. **Messages envoyés.**

   | Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
   |---|---|---|---|---|
   | Adresse saisie (si elle existe et si l'envoi d'emails est configuré) | Email | Indispensable (envoi synchrone) | Immédiat, délai d'envoi 5 s au plus | Objet « Vérifiez votre adresse email — Event Village » ; titre « Vérifiez votre adresse email » ; texte « Vous avez indiqué cette adresse pour votre compte Event Village. Confirmez-la pour recevoir vos billets et vos confirmations par email. » ; bouton « Vérifier mon adresse » ; note « Ce lien est valable 24 heures et ne sert qu’une fois. Si vous n’êtes pas à l’origine de cette demande, ignorez ce message : l’adresse ne sera pas ajoutée. » (`lib/notifications/catalog.ts:1822-1828`, `:1835-1847` ; `lib/email/verification.ts:30-31`, `:150-158`) |

   Aucun SMS de bienvenue n'est envoyé : la route n'envoie aucun SMS (`app/api/auth/register/route.ts:82-84`).
5. **Ce que voient les autres rôles.** Le nouveau compte apparaît dans la liste des utilisateurs de l'administration
   (rôle Client, statut actif) au rechargement (`app/admin/users/page.tsx:417-464`). Le parrain voit son filleul selon
   `09-parrainage.md`.
6. **Refus (texte exact).**
   - Code absent : « Saisissez le code reçu par SMS pour créer votre compte. » (`app/api/auth/register/route.ts:112`).
   - Code mal formé : « Le code de vérification comporte 6 chiffres. » (`:117`).
   - Code faux : « Code de vérification incorrect ou expiré. » ; expiré : « Le code a expiré. Demandez-en un nouveau. » ;
     5 essais faux : « Trop de tentatives infructueuses. Veuillez demander un nouveau code. » suivi à l'écran de
     « Demandez un nouveau code. » (`lib/auth/otp-store.ts:105-113`, `app/register/page.tsx:277-278`).
   - Quota de vérification : « Trop de tentatives de vérification pour ce numéro. Réessayez plus tard. »
     (`app/api/auth/register/route.ts:155-158`).
   - Compte existant : « Ce numéro de téléphone ou cet email est déjà associé à un compte. Veuillez vous connecter. »,
     avec « Recevoir un code de connexion » (`app/api/auth/register/route.ts:14`, `:128-130` ;
     `app/register/page.tsx:283`).
   - Parrainage inconnu : « Code de parrainage inconnu. Vérifiez-le ou laissez le champ vide. » sous le champ
     (`app/api/auth/register/route.ts:141-146`).
   - Création impossible (le code est déjà consommé) : « Création du compte impossible pour le moment. Demandez un nouveau
     code et réessayez. » (`:186-189`, `:211-214`) ; panne : « Inscription momentanément impossible. Réessayez dans un
     instant. » (`:246-251`).
   - Session non ouverte après création : bandeau « Compte créé : connectez-vous pour continuer » / « Votre numéro est
     vérifié, mais la session n’a pas pu s’ouvrir automatiquement. » et bouton « Se connecter »
     (`app/register/page.tsx:371-383`).
   - Réseau coupé pendant la création : « Connexion interrompue : votre compte n’a peut-être pas été créé. Réessayez, ou
     connectez-vous si vous avez déjà terminé. » (`app/register/page.tsx:313`).
7. **Preuves et essai.** Fichiers cités. Recette : essais 7 et 49 (`docs/recette-billetterie.md:421-437`, `:1153`).

## 02.3 Connexion par mot de passe (numéro ou email)

1. **Qui, où.** Tout titulaire d'un compte. `/login`, titre « Connexion », texte « Accédez à vos billets, commandes,
   réservations et portefeuille. » (`app/login/page.tsx:33-37`). Onglet « Mot de passe » (sélectionné par défaut)
   (`components/auth/LoginForm.tsx:126`, `:553`). Bouton « Se connecter » (`:630`). Liens : « Mot de passe oublié ? »
   (`:605-607`), « Créer un compte client » (`:722-728`), carte « Espace professionnel » / « Organisateurs, salles et
   restaurants : devenir partenaire » vers `/partner/register` (`:731-745`).
2. **Ce qu'il saisit.** « Email ou téléphone » (exemple `77 123 45 67 ou adresse email`, aide « Le numéro sénégalais ou
   l’adresse email de votre compte. ») et « Mot de passe » (`components/auth/LoginForm.tsx:582-609`). Les deux sont
   obligatoires : « Veuillez renseigner votre identifiant et votre mot de passe. » (`:316-319`). Côté serveur :
   identifiant de 3 à 254 caractères, mot de passe de 200 caractères au plus (`app/api/auth/login/route.ts:17-21`).
   L'email qui marche est celui du compte de connexion : l'adresse technique, ou l'adresse **vérifiée** (02.13) ; une
   adresse seulement « en attente » ne permet pas de se connecter (`app/api/auth/register/route.ts:120-124`,
   `app/api/account/email/verify/route.ts:62-70`).
3. **Ce que fait le système.** `POST /api/auth/login` : quota par adresse IP **avant** toute lecture (30 par heure, voir
   13) (`app/api/auth/login/route.ts:65-75`) ; un numéro est traduit en identifiant de connexion côté serveur, jamais
   rendu au navigateur (`:47-62`, `:90-94`) ; la session est posée en cookies et la saisie compte comme « mot de passe
   saisi récemment » pour 10 minutes (02.10) (`lib/auth/password-confirm.ts:97-143`). L'écran relit la session puis
   (`components/auth/LoginForm.tsx:355-365`, `:268-306`) :
   - compte **suspendu** : l'appareil est détaché du push, la session fermée, message (voir 6) ;
   - sinon destination : celle demandée (`?redirect=`), sinon selon le rôle : administrateur → `/admin`, partenaire →
     `/partner`, contrôleur → `/controller/scanner`, client → `/` (`lib/auth/resolve-post-login-route.ts:1-21`) ;
     redirection 400 ms après (`components/auth/LoginForm.tsx:303-305`).
4. **Messages envoyés.** Aucun.
5. **Ce que voient les autres rôles.** Rien.
6. **Refus (texte exact).**
   - Numéro inconnu **ou** mauvais mot de passe (même réponse, pour ne pas révéler si un compte existe) :
     « Identifiant ou mot de passe incorrect. » (`app/api/auth/login/route.ts:23-26`), affiché avec le décompte « ({n}
     tentative(s) restante(s) avant verrouillage temporaire) » (`components/auth/LoginForm.tsx:231-235`, `:342-343`).
     Exemple : « Identifiant ou mot de passe incorrect. (4 tentatives restantes avant verrouillage temporaire) ».
   - Compte banni (compte anonymisé, 02.19) : « Ce compte n’est plus actif. Veuillez contacter le support. »
     (`app/api/auth/login/route.ts:37-38`).
   - Email non confirmé : « Votre adresse email n’est pas encore confirmée. » (`:35-36`).
   - Quota IP : « Trop de tentatives de connexion depuis cette connexion. Réessayez plus tard. » (`:70-74`) ; limite de
     Supabase Auth : « Trop de tentatives. Patientez quelques instants avant de réessayer. » (`:39-40`).
   - Panne : « Connexion impossible pour le moment. Réessayez dans un instant. » (`:28-30`).
   - Compte suspendu : « Votre compte est suspendu. Veuillez contacter le support. » (`components/auth/LoginForm.tsx:280-286`).
   - Session illisible : « Connexion acceptée, mais la session n’a pas pu s’ouvrir sur cet appareil. Rechargez la page,
     puis réessayez. » (`:359-363`) ; réseau : « Échec de la connexion. Vérifiez votre réseau, puis réessayez. »
     (`:366-369`).
   - Messages venant d'une redirection (`?error=`) : « Accès restreint aux Administrateurs et Superadministrateurs. »,
     « Accès restreint aux Partenaires professionnels validés. », « Accès restreint aux Contrôleurs autorisés. »,
     « Accès réservé aux contrôleurs. », « Votre compte contrôleur a été désactivé ou révoqué par l'organisateur. »,
     « Le lien a expiré : demandez un nouveau code. » (`components/auth/LoginForm.tsx:55-62`) ; messages d'information
     (`?message=`, `?reset=`) : « Compte activé avec succès. Connectez-vous avec votre mot de passe. », « Ce compte est déjà
     activé : connectez-vous. », « Mot de passe modifié : connectez-vous avec le nouveau. » (`:82-90`).
7. **Preuves et essai.** Fichiers cités. Recette : essai 2 (`docs/recette-billetterie.md:337-350`).

## 02.4 Connexion par code SMS

1. **Qui, où.** Titulaire d'un compte. `/login`, onglet « Code SMS » (`components/auth/LoginForm.tsx:566`). Boutons
   « Recevoir le code SMS » (`:662`), puis « Valider et se connecter » (`:688`), « Modifier le numéro » (`:699`),
   « Renvoyer ({n} s) » puis « Renvoyer le code » (`:711`).
2. **Ce qu'il saisit.** « Numéro de téléphone (Sénégal) », exemple `77 123 45 67`, aide « Un code à 6 chiffres vous sera
   envoyé gratuitement par SMS. » (`:641-651`) ; puis le code, sous « Saisissez le code reçu par SMS » (`:667-677`).
   Numéro invalide : « Numéro de mobile sénégalais invalide. Exemple : 77 123 45 67. » (`:381-385`). Code incomplet :
   « Veuillez saisir le code complet à 6 chiffres. » (`:440-444`).
3. **Ce que fait le système.**
   1. `POST /api/auth/resolve-phone` dit seulement si un compte porte ce numéro (quota : 30 par heure et par IP)
      (`app/api/auth/resolve-phone/route.ts:12-33`, `:62-69`) ;
   2. `POST /api/auth/send-otp` : réservation anti-abus, code d'objet « connexion » valable **10 minutes**, SMS
      immédiat (`app/api/auth/send-otp/route.ts:38-43`, `:81-105`). Bandeau « Code de confirmation envoyé par SMS au
      {numéro}. » et renvoi possible après **60 s** (`components/auth/LoginForm.tsx:423-425`). Exemple : « Code de
      confirmation envoyé par SMS au +221770000000. » ;
   3. `POST /api/auth/verify-otp` : quota de 10 vérifications par 15 min et par numéro, avant la vérification
      (`app/api/auth/verify-otp/route.ts:38-50`) ; le code est vérifié et consommé ; seuls les codes de connexion,
      d'inscription ou de réinitialisation sont acceptés ici (`:52-62`, `lib/auth/otp-store.ts:31`) ; le numéro est
      marqué vérifié s'il ne l'était pas (`app/api/auth/verify-otp/route.ts:66-79`) ; un jeton de session à usage
      unique est rendu (`:115-129`) ; l'écran ouvre la session avec ce jeton, puis même suite qu'en 02.3 (compte suspendu
      refusé, redirection selon le rôle) (`components/auth/LoginForm.tsx:468-493`).

   Une connexion par code **ne vaut pas** « mot de passe saisi récemment » : la première action sensible demandera le mot
   de passe (02.10) (`lib/auth/password-confirm.ts:8-9` : seules la confirmation et la connexion par mot de passe
   l'écrivent).
4. **Messages envoyés.**

   | Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
   |---|---|---|---|---|
   | Le numéro du compte | SMS | Indispensable (synchrone) | Immédiat | « Event Village : votre code de vérification est {code}. Valable 10 minutes. » (74 caractères, 1 segment) (`lib/notifications/catalog.ts:1800-1804`, type `OTP_LOGIN` `:1688`) |

5. **Ce que voient les autres rôles.** Rien (envoi journalisé sans le code, type `OTP_LOGIN`,
   `app/api/auth/send-otp/route.ts:18-19`, `:99-105`).
6. **Refus (texte exact).**
   - Numéro sans compte : « Aucun compte n'est associé à ce numéro de téléphone. Veuillez vous inscrire. »
     (`app/api/auth/resolve-phone/route.ts:62-67`). Cette réponse révèle qu'un numéro n'a pas de compte (décision
     conservée, voir 13).
   - Quota de recherche : « Trop de requêtes depuis cette connexion. Par sécurité, réessayez plus tard. »
     (`app/api/auth/resolve-phone/route.ts:28-33`).
   - Quotas SMS : textes de 02.1 ; SMS non parti : « Impossible d'envoyer le code SMS. Réessayez dans un instant. »
     (`components/auth/LoginForm.tsx:418-420`).
   - Code faux, expiré, 5 essais : textes de 02.2 ; à l'écran, un code faux ajoute le décompte de 02.5
     (`components/auth/LoginForm.tsx:457-466`).
   - Quota de vérification : « Trop de tentatives de vérification pour ce numéro. Réessayez plus tard. »
     (`app/api/auth/verify-otp/route.ts:45-49`).
   - Code accepté sans session : « Code accepté, mais la connexion n’a pas pu s’ouvrir. Demandez un nouveau code et
     réessayez. » (`components/auth/LoginForm.tsx:106`, `:471-486`).
   - Panne : « Vérification momentanément impossible. Demandez un nouveau code. » (`app/api/auth/verify-otp/route.ts:73-78`).
7. **Preuves et essai.** Fichiers cités. Recette : essai 2.

## 02.5 Trop d'essais à la connexion : verrou de l'écran et refus du serveur

1. **Qui, où.** Toute personne sur `/login`, `/forgot-password` ou `/reset-password`.
2. **Ce qu'il saisit.** Des identifiants ou des codes faux.
3. **Ce que fait le système.**
   - **Verrou du navigateur** (confort seulement, le serveur reste l'autorité) : 5 échecs → saisie bloquée **60 s**,
     mémorisée dans le navigateur et relue au rechargement (`components/auth/LoginForm.tsx:34-36`, `:49-52`,
     `:144-173`, `:218-229`) ; même règle, compteurs distincts, sur « Mot de passe oublié » (`app/forgot-password/page.tsx:47-51`)
     et « Nouveau mot de passe » (`app/reset-password/page.tsx:33-37`). Bandeau « Saisie temporairement bloquée » /
     « Trop de tentatives infructueuses. Pour protéger votre compte et votre portefeuille, la saisie est bloquée pendant
     quelques instants. » / « Nouvel essai possible dans {n} s » ; bouton « Bloqué ({n} s) » ; avant le blocage,
     « {n} tentative(s) échouée(s) sur 5 » / « La saisie sera bloquée pendant 60 secondes au bout de 5 échecs. » ; à la
     fin, « Accès déverrouillé. Vous pouvez à nouveau saisir vos identifiants. » (`components/auth/LoginForm.tsx:190`,
     `:514-538`, `:630`).
   - **Refus du serveur** : quotas en base, voir 13 (connexion par mot de passe : 30 par heure et par IP ; recherche de
     numéro : 30 par heure et par IP ; vérification de code : 10 par 15 min et par numéro ; SMS de code : 3 par 15 min et
     10 par jour et par numéro). Un refus 429 du serveur déclenche aussi le bandeau de blocage.
4. **Messages envoyés.** Aucun.
5. **Ce que voient les autres rôles.** Rien.
6. **Écart.** Pour l'envoi d'un code (connexion et mot de passe oublié), l'écran lit un champ `remainingSeconds` que le
   serveur ne renvoie pas (il renvoie `retryAfterSeconds`) : le décompte affiché est toujours 60 s, même quand le serveur
   impose d'attendre jusqu'à 15 minutes ou au lendemain ; pendant le blocage, le message du serveur est masqué
   (`components/auth/LoginForm.tsx:398-403`, `:414-420`, `:571-573` ; `app/forgot-password/page.tsx:264-269` ;
   `lib/sms/sms-http.ts:12-16` ; `lib/security/quota-http.ts:17`). Constat W2-01.
7. **Preuves.** Fichiers cités.

## 02.6 Mot de passe oublié par téléphone (code SMS)

1. **Qui, où.** Titulaire d'un compte non connecté. `/forgot-password` (lien « Mot de passe oublié ? » de `/login`),
   titre « Mot de passe oublié », en-tête « Étape 1 sur 2 » puis « Étape 2 sur 2 » (`app/forgot-password/page.tsx:407-414`).
2. **Ce qu'il saisit.** « Email ou numéro de téléphone » (exemple `ex : email@domaine.com ou 77 123 45 67`) ; dès qu'un
   numéro est reconnu : aide « Récupération par code envoyé par SMS à ce numéro. », texte « Entrez votre numéro de
   téléphone pour recevoir un code SMS. », bouton « Envoyer le code SMS » (`:61-67`, `:388-393`, `:486-520`). Ni
   numéro ni email reconnu : « Saisissez une adresse email ou un numéro de téléphone sénégalais valide. » (`:289-294`).
   Étape 2 : « Code demandé pour le {numéro} », bouton « Valider le code », « Modifier le numéro », « Renvoyer ({n} s) »
   / « Renvoyer le code » (`:527-577`).
3. **Ce que fait le système.** `POST /api/auth/send-otp` avec l'objet « réinitialisation » : si **aucun compte** ne porte
   le numéro, la réponse est la même que pour un compte existant et **aucun SMS ne part** (pour ne rien révéler)
   (`app/api/auth/send-otp/route.ts:59-79`) ; sinon réservation anti-abus, code valable **10 minutes**, SMS immédiat
   (`:81-105`). L'écran affiche dans les deux cas « Si un compte est associé à ce numéro, un code de récupération vient
   de lui être envoyé par SMS. » (`app/forgot-password/page.tsx:275-279`). Code valide : il est consommé, une session de
   récupération s'ouvre, l'écran mémorise l'accès pour 15 minutes dans l'onglet, puis passe à `/reset-password` (02.8)
   (`:313-374`, `app/reset-password/page.tsx:98-108`).
4. **Messages envoyés.**

   | Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
   |---|---|---|---|---|
   | Le numéro, s'il a un compte | SMS | Indispensable (synchrone) | Immédiat | « Event Village : votre code de réinitialisation du mot de passe est {code}. Valable 10 minutes. » — ex. avec 123456 : 94 caractères, 1 segment (`lib/notifications/catalog.ts:1807-1808`, type `OTP_PASSWORD_RESET` `:1690`) |

5. **Ce que voient les autres rôles.** Rien à cette étape.
6. **Refus.** Quotas SMS et de vérification : textes de 02.1 et 02.4. SMS non parti : « Impossible d'envoyer le SMS de
   réinitialisation. » (`app/api/auth/send-otp/route.ts:111-117`). Code faux : « Code de vérification incorrect ou
   expiré. » + « ({n} tentative(s) restante(s) avant verrouillage) » (`app/forgot-password/page.tsx:176-178`, `:330`).
   Code accepté sans session : « Code accepté, mais la connexion n’a pas pu s’ouvrir. Demandez un nouveau code et
   réessayez. » (`:45`, `:336-355`). Réseau : « Impossible d'envoyer le code SMS. Vérifiez votre réseau, puis
   réessayez. » (`:282`) ; « Échec de la vérification du code. Vérifiez votre réseau, puis réessayez. » (`:377`).
   Remarque : l'étape de vérification n'indique pas l'objet du code ; un code de connexion encore valable est donc aussi
   accepté ici (`app/forgot-password/page.tsx:314-318`, `app/api/auth/verify-otp/route.ts:56-58`).
7. **Preuves et essai.** Recette : essai 8 (`docs/recette-billetterie.md:440-456`).

## 02.7 Mot de passe oublié par email (lien)

1. **Qui, où.** `/forgot-password`, en saisissant une adresse : aide « Récupération par lien envoyé à cette adresse
   email. », texte « Entrez votre adresse email pour recevoir un lien de récupération. », bouton « Envoyer le lien de
   récupération » (`app/forgot-password/page.tsx:389-390`, `:497-498`, `:515-516`).
2. **Ce qu'il saisit.** Une adresse ; contrôle minimal (présence de « @ » et d'un point) : « Adresse email invalide.
   Vérifiez votre saisie. » (`:196-200`).
3. **Ce que fait le système.** Demande de lien au service d'authentification (Supabase Auth), retour prévu vers
   `/reset-password` (`:205-211`). L'écran passe **toujours** à « Lien envoyé », même en cas d'erreur ou d'adresse
   inconnue, pour ne rien révéler (`:213-233`). Le lien n'arrive que si l'adresse est l'identifiant de connexion du
   compte, c'est-à-dire une adresse **vérifiée** (02.13) ; une adresse seulement en attente ne reçoit rien
   (`app/api/auth/register/route.ts:120-124`). Écran : « Lien envoyé » / « Si un compte correspond à cette adresse, un lien
   de récupération vient de lui être envoyé. Ouvrez-le pour choisir un nouveau mot de passe. » ; « Que faire ensuite ? » :
   « Ouvrez l'email reçu de no-reply@eventvillage.sn. », « Choisissez « Réinitialiser mon mot de passe ». », « Le lien
   expire dans 60 minutes. Pensez à vérifier le dossier des courriers indésirables. » ; bouton « Modifier l'adresse
   email » ; « Retour à la connexion » (`app/forgot-password/page.tsx:582-615`).
4. **Messages envoyés.**

   | Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
   |---|---|---|---|---|
   | L'adresse, si c'est l'identifiant de connexion d'un compte | Email (envoyé par Supabase Auth, pas par la boîte d'envoi) | Indispensable | Immédiat | **NON VÉRIFIÉ** : le modèle de cet email n'est pas dans le dépôt (modèles personnalisés commentés dans `supabase/config.toml:224-233`) ; l'expéditeur, le libellé du bouton et la durée de 60 minutes annoncés par l'écran ne sont pas prouvés pour le projet hébergé (durée locale : `otp_expiry = 3600`, `supabase/config.toml:211-212`). Constat W2-06. |

5. **Ce que voient les autres rôles.** Rien.
6. **Refus.** Limite de Supabase Auth : bandeau de blocage de 60 s (`app/forgot-password/page.tsx:215-221`).
7. **Preuves.** Fichiers cités.

## 02.8 Choisir le nouveau mot de passe (`/reset-password`)

1. **Qui, où.** La personne qui vient de 02.6 ou 02.7. `/reset-password`, « Vérification de la session sécurisée… »
   pendant le contrôle (`app/reset-password/page.tsx:316-329`), puis titre « Nouveau mot de passe », texte « Choisissez un
   mot de passe fort pour sécuriser votre compte. » (`:337-341`). Bouton « Définir le nouveau mot de passe » (`:448`).
   Note : « Après confirmation, toutes vos sessions sont fermées, sur tous vos appareils, pour garantir la sécurité de
   votre compte. » (`:456`).
2. **Ce qu'il saisit.** « Nouveau mot de passe » (« 8 caractères au moins ») avec la liste de robustesse, « Confirmer le
   mot de passe » (« Le même mot de passe ») ; indication « Les mots de passe correspondent » ou « Les mots de passe ne
   correspondent pas » (`:376-436`). Bouton grisé tant que les critères ne sont pas remplis (`:445`). Messages : « Votre
   mot de passe ne respecte pas tous les critères de sécurité. », « Les mots de passe ne correspondent pas. » (`:247-255`).
3. **Ce que fait le système.** La page s'ouvre si une session existe (récupération par code ou lien) ; sans session
   au bout de 4 s : retour à `/login?error=session_expired` (« Le lien a expiré : demandez un nouveau code. »)
   (`:91-147`, `components/auth/LoginForm.tsx:61`). Le nouveau mot de passe est posé par le navigateur
   (`app/reset-password/page.tsx:260-261`) ; puis l'appareil est détaché du push, **toutes les sessions** du compte sont
   révoquées (`/api/auth/sign-out-global`, journal `USER_SESSIONS_REVOKED`), la session locale fermée, message « Mot de
   passe mis à jour avec succès. Veuillez vous connecter. » et retour à `/login?reset=success` (« Mot de passe modifié :
   connectez-vous avec le nouveau. ») (`:285-302` ; `app/api/auth/sign-out-global/route.ts:22-27` ;
   `lib/auth/sessions.ts:14-31` ; `components/auth/LoginForm.tsx:88-90`). Les jetons déjà émis restent valables jusqu'à
   leur expiration (1 h au plus) (`lib/auth/sessions.ts:7-8`).
4. **Messages envoyés.** Le changement du mot de passe déclenche l'avis `PASSWORD_CHANGED` (déclencheur en base sur le
   compte de connexion) (`M/20261109000009_lot9bis_messages.sql:1608-1635`, `M/20261103000006_lot6_pros_admin.sql:945-950`).

   | Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
   |---|---|---|---|---|
   | Le titulaire | Cloche (application) | Indispensable | File d'attente, immédiat | « Mot de passe modifié » / « Le mot de passe de votre compte a été défini ou modifié. Si ce n'est pas vous, contactez le support. » (lien `/profile`) (`lib/notifications/catalog.ts:874-880`) |
   | Le titulaire | SMS | Indispensable | File d'attente, immédiat (jamais retenu en heures calmes : voir 10) | « Event Village : le mot de passe de votre compte a été défini ou modifié. Si ce n'est pas vous, contactez le support. » (116 caractères, 1 segment) (`lib/notifications/catalog.ts:881`) |
   | Le titulaire, si adresse vérifiée | Email | Indispensable | File d'attente | Texte : voir `10-notifications.md`, type `PASSWORD_CHANGED` |

   Registre : famille indispensable, canaux application, SMS, email ; **bloqué pour un compte suspendu**
   (`M/20261103000002_lot6_outbox.sql:95`, `lib/notifications/catalog.ts:875`).
5. **Ce que voient les autres rôles.** Les autres appareils du titulaire perdent leur session au plus tard dans l'heure.
6. **Refus (texte exact).** « Choisissez un mot de passe différent de l'ancien. », « Ce mot de passe est trop faible.
   Choisissez-en un plus long ou moins courant. », « Votre demande de récupération a expiré. Recommencez depuis « Mot de
   passe oublié ». », « Trop de tentatives. Patientez quelques instants avant de réessayer. », « Impossible de mettre à
   jour le mot de passe. Réessayez dans un instant. » (`app/reset-password/page.tsx:48-62`) ; exception : « Une erreur
   inattendue s'est produite. Réessayez dans un instant. » (`:305`).
   Écart : cette page accepte **n'importe quelle session ouverte** et ne redemande ni l'ancien mot de passe ni une
   confirmation récente ; la robustesse n'y est contrôlée que dans le navigateur (constat W2-05).
7. **Preuves et essai.** Recette : essai 8.

## 02.9 Changer son mot de passe une fois connecté

1. **Qui, où.** Tout compte actif connecté. `/profile`, bloc « Mot de passe » (« Les autres appareils seront
   déconnectés. »), bouton « Changer de mot de passe » (`components/profile/ProfileForm.tsx:309-317`). Boîte « Changer
   mon mot de passe », sous-titre « Les autres appareils seront déconnectés ; celui-ci reste connecté. », boutons
   « Annuler », « Changer le mot de passe », puis « Fermer » (`components/profile/PasswordChangeDialog.tsx:176-203`).
2. **Ce qu'il saisit.** « Mot de passe actuel », « Nouveau mot de passe » (aide « 8 caractères au moins, dont une
   majuscule, un chiffre et un caractère spécial. » et liste de robustesse), « Confirmer le nouveau mot de passe », bouton
   « Afficher les mots de passe » (`:43`, `:163-259`). Messages : « Saisissez votre mot de passe actuel. », « Saisissez le
   nouveau mot de passe. », « Mot de passe trop faible : 8 caractères au moins, dont une majuscule, un chiffre et un
   caractère spécial. », « Le nouveau mot de passe doit être différent de l’actuel. », « Saisissez de nouveau le nouveau
   mot de passe. », « Les deux saisies du nouveau mot de passe sont différentes. » (`:115-124`).
3. **Ce que fait le système.** `POST /api/account/password` (`app/api/account/password/route.ts:156-168`) : compte actif
   et session identifiée ; contrôle du nouveau mot de passe ; quota de **5 essais par 15 minutes** partagé avec 02.10 ;
   vérification de l'actuel sans laisser de session ; pose du nouveau par la session courante ; puis, en une
   transaction : **autres sessions révoquées, celle-ci gardée et comptée comme mot de passe saisi récemment**, journal
   `ACCOUNT_PASSWORD_CHANGED` (`:67-143`, `M/20261109000011_lot9bis_textes.sql:27-79`). Succès : « Mot de passe changé »
   / « Mot de passe modifié. Vos autres appareils sont déconnectés. » (`app/api/account/password/route.ts:18`,
   `components/profile/PasswordChangeDialog.tsx:205-210`).
4. **Messages envoyés.** Avis `PASSWORD_CHANGED` (même tableau qu'en 02.8), un seul par canal : il part du déclencheur en
   base, pas de la route (`M/20261109000011_lot9bis_textes.sql:25`).
5. **Ce que voient les autres rôles.** Les autres appareils du titulaire sont déconnectés au plus tard dans l'heure.
6. **Refus (texte exact).** « Mot de passe actuel incorrect. » (`app/api/account/password/route.ts:116-119`) ; « Le
   nouveau mot de passe doit être différent de l’actuel. » (`:96-101`) ; « Ce mot de passe est trop faible.
   Choisissez-en un autre. » (`:124-128`) ; quota : « Trop de tentatives. Réessayez dans quelques minutes. » + « Nouvel
   essai possible dans {n} min. » (`:109-114`, `components/profile/PasswordChangeDialog.tsx:47-54`) ; session :
   « Votre session ne permet pas ce changement. Reconnectez-vous puis recommencez. » (`:73-79`) ; compte non actif :
   « Votre compte n'est pas actif. Contactez le support. » (`lib/auth/session.ts:56-63`) ; panne de vérification :
   « Vérification momentanément impossible. Réessayez dans un instant. » (`:145-150`) ; mot de passe changé mais
   sessions non fermées : « Mot de passe changé, mais les autres appareils n’ont pas pu être déconnectés. Réessayez. »
   (`:21-25`) ; autre panne : « Votre mot de passe n’a pas pu être changé. Réessayez dans un instant. » (`:19`).
7. **Preuves et essai.** Recette : essai 76 (`docs/recette-billetterie.md:1634-1650`).

## 02.10 Mot de passe redemandé avant une action sensible (10 minutes)

1. **Qui, où.** Tout compte connecté qui lance une action protégée. Boîte « Confirmez votre mot de passe », sous-titre
   « Par sécurité, cette action demande votre mot de passe. », boutons « Annuler » et « Confirmer »
   (`components/auth/PasswordConfirmDialog.tsx:110-128`).
2. **Ce qu'il saisit.** « Mot de passe », bouton « Afficher le mot de passe » ; aide propre à l'action ou, par défaut,
   « Votre saisie reste valable 10 minutes sur cet appareil. » (`:131-156`). Vide : « Saisissez votre mot de passe. »
   (`:82-86`).
3. **Ce que fait le système.** La saisie est vérifiée sans laisser de session de plus, puis enregistrée **pour la
   session de cet appareil**, valable **10 minutes** (`lib/auth/password-confirm.ts:22-23`, `:38-71`, `:151-157` ;
   `app/api/account/password-confirm/route.ts:68-76`). L'action est relancée telle quelle (`:17-20` du composant).
   **Actions protégées** (refus 403 « Par sécurité, saisissez votre mot de passe pour continuer. » tant qu'il n'y a pas
   de saisie de moins de 10 minutes, `lib/auth/password-confirm.ts:25`, `:163-186`) :

   | Action | Où | Aide de la boîte | Preuve |
   |---|---|---|---|
   | Transférer un billet | Mes billets | « Le billet sera envoyé juste après. » | `app/api/tickets/[id]/transfer/route.ts:32`, `components/tickets/TransferModal.tsx:228` |
   | Changer de numéro (envoi du code **et** confirmation) | Mon profil | « Le code sera envoyé à votre nouveau numéro juste après. » / « Votre code sera vérifié juste après. » | `app/api/account/phone/start/route.ts:32-34`, `app/api/account/phone/confirm/route.ts:42-44`, `components/profile/PhoneChangeDialog.tsx:202` |
   | Changer, ajouter ou retirer l'adresse email | Mon profil | « Votre profil sera enregistré juste après. » | `app/api/account/profile/route.ts:64-76`, `components/profile/ProfileForm.tsx:326` |
   | Constater qu'un versement n'est pas parti (SUPERADMIN) | Administration, Finances | « Le constat sera enregistré juste après. » | `app/api/admin/cashouts/[id]/not-sent/route.ts:36-41`, `M/20261110000005_lot9ter_argent.sql:91-98`, `components/admin/RefundsToRetry.tsx:542` |

   **Ce qui compte comme saisie récente** : la connexion par mot de passe (`lib/auth/password-confirm.ts:97-143`), cette
   boîte, un changement de mot de passe réussi (`M/20261109000011_lot9bis_textes.sql:63-70`). **Ne compte pas** : la
   connexion par code SMS, l'ouverture de session juste après l'inscription (connexion faite dans le navigateur,
   `app/register/page.tsx:298`). Le changement de mot de passe (02.9) demande l'ancien mot de passe à chaque fois, sans
   utiliser ce délai.
4. **Messages envoyés.** Aucun.
5. **Ce que voient les autres rôles.** Rien.
6. **Refus (texte exact).** « Mot de passe incorrect. » sous le champ (`app/api/account/password-confirm/route.ts:50-52`) ;
   quota (5 par 15 min, partagé avec 02.9) : « Trop de tentatives. Réessayez dans quelques minutes. » + « Nouvel essai
   possible dans {n} min. » (`:36-46`, `components/auth/PasswordConfirmDialog.tsx:47-54`) ; sans session :
   « Authentification requise. » (`:20-23`) ; panne : « Vérification momentanément impossible. Réessayez dans un
   instant. » dans le bandeau « Confirmation impossible » (`:56-64`, `components/auth/PasswordConfirmDialog.tsx:157-161`).
   Fermer la boîte annule l'action : profil « Adresse email non modifiée : saisissez votre mot de passe pour la
   changer. » (`components/profile/ProfileForm.tsx:191-195`) ; numéro « Changement de numéro interrompu : votre mot de
   passe est demandé pour continuer. » (`components/profile/PhoneChangeDialog.tsx:193-196`).
7. **Preuves et essai.** Recette : essais 66, 67 (`docs/recette-billetterie.md:1452-1486`).

## 02.11 Changer de numéro de téléphone

1. **Qui, où.** Compte actif connecté. `/profile`, bloc « Numéro de téléphone » (« Un code envoyé au nouveau numéro
   confirme le changement. »), bouton « Changer de numéro » (`components/profile/ProfileForm.tsx:299-307`). Boîte
   « Changer de numéro », « Étape 1 sur 2 : votre nouveau numéro » puis « Étape 2 sur 2 : le code reçu par SMS » ;
   boutons « Annuler », « Recevoir le code », puis « Renvoyer le code », « Confirmer », « Modifier le numéro »
   (`components/profile/PhoneChangeDialog.tsx:163-244`).
2. **Ce qu'il saisit.** « Nouveau numéro de téléphone » (exemple `77 123 45 67`, aide « Votre numéro actuel reste celui
   du compte tant que le code n’est pas confirmé. ») (`:218-233`) ; puis le code à 6 chiffres (« Code envoyé au
   {numéro} ») avec la mention « Une fois le numéro changé, vos autres appareils seront déconnectés et votre ancien numéro
   recevra un SMS d’information. » (`:238-254`). Messages : « Numéro de mobile sénégalais invalide. Exemple : 77 123 45
   67. » (`:117-125`) ; « Saisissez les 6 chiffres du code reçu par SMS. » (`:127-134`) ; info « Code envoyé par SMS. Il
   reste valable 10 minutes. » (`:105`).
3. **Ce que fait le système.**
   - Envoi (`POST /api/account/phone/start`) : compte actif, **mot de passe saisi depuis moins de 10 minutes** (02.10),
     refus si c'est déjà le numéro du compte ou s'il appartient à un autre compte, quota de **5 demandes par jour et par
     compte**, réservation SMS, code d'objet « changement de numéro » valable **10 minutes** envoyé **au nouveau
     numéro** (`app/api/account/phone/start/route.ts:28-87`).
   - Confirmation (`POST /api/account/phone/confirm`) : session identifiée, mot de passe récent, quota de 10
     vérifications par 15 min sur le nouveau numéro, code vérifié et consommé, numéro libre ; l'adresse technique suit
     le numéro si le compte n'a pas d'email vérifié (`app/api/account/phone/confirm/route.ts:32-117`). Puis en une
     transaction (`M/20261109000004_lot9bis_droits.sql:750-871`) : nouveau numéro enregistré et vérifié ; **autres
     sessions révoquées** (celle-ci gardée) ; **transferts en attente vers l'ancien numéro annulés** (billet rendu à
     l'expéditeur, prévenu ; invitation non réclamée annulée et place rendue, sans avis) ; SMS à l'ancien numéro ; email
     au compte ; journal `ACCOUNT_PHONE_CHANGED` (numéros masqués).
   - **Retraits bloqués 24 heures** après le changement (comptes partenaire et parrainage, tous moyens de retrait) :
     « Retrait impossible pendant 24 h après un changement de numéro. Réessayez après le {date à heure}. »
     (`M/20261110000005_lot9ter_argent.sql:383-391`). Exemple : « … Réessayez après le 13/11/2026 à 09:30. » La boîte ne
     le signale pas (constat W2-07).
   - Écran : « Numéro modifié. Vos autres appareils ont été déconnectés. » (`components/profile/ProfileForm.tsx:215-218`).
4. **Messages envoyés.**

   | Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
   |---|---|---|---|---|
   | Nouveau numéro | SMS | Indispensable (synchrone) | Immédiat | « Event Village : votre code de vérification est {code}. Valable 10 minutes. » (type `OTP_PHONE_CHANGE`, `lib/notifications/catalog.ts:1692`, `:1802-1804`) |
   | Ancien numéro | SMS | Indispensable | File d'attente, immédiat, envoyé même si le compte est suspendu | « Event Village : le numéro de votre compte a été modifié. Si ce n'est pas vous, contactez le support. » (100 caractères, 1 segment) (`lib/notifications/catalog.ts:886-894`, `M/20261109000004_lot9bis_droits.sql:840-847`) |
   | Le compte, si adresse vérifiée | Email | Indispensable | File d'attente | Fond « Numéro de téléphone modifié » ; texte : voir 10, type `PHONE_CHANGED` (`M/20261109000004_lot9bis_droits.sql:850-857`) |
   | Expéditeur d'un transfert en attente vers l'ancien numéro | Cloche, push, email | Indispensable | File d'attente | « Transfert annulé » / « Le destinataire de votre billet pour « {titre} » a changé de numéro : le transfert est annulé et le billet reste dans vos billets. » — ex. « … pour « Concert Test » … » (`lib/notifications/catalog.ts:1455-1462`) |

5. **Ce que voient les autres rôles.** L'expéditeur d'un transfert en attente voit le billet redevenir transférable
   (`M/20261109000004_lot9bis_droits.sql:828-831`) ; voir `07-billets.md`. L'administration voit le nouveau numéro au
   rechargement.
6. **Refus (texte exact).** « Ce numéro est déjà celui de votre compte. » (`app/api/account/phone/start/route.ts:50-52`) ;
   « Ce numéro est déjà associé à un compte. » (`:54-56`) ; « Trop de demandes de changement de numéro aujourd’hui.
   Réessayez demain. » (`:62-67`) ; quotas SMS (02.1) ; « Impossible d’envoyer le code par SMS. Réessayez. » (`:79-82`) ;
   code faux, expiré, 5 essais : textes de 02.2 ; « Trop de tentatives de vérification pour ce numéro. Réessayez plus
   tard. » (`app/api/account/phone/confirm/route.ts:64-69`) ; « Votre numéro a été modifié entre-temps. Recommencez le
   changement. » (`:26`) ; « Le changement n’a pas pu aboutir. Réessayez avec le même numéro ; si le problème persiste,
   contactez le support. » (`:27`) ; « Votre session ne permet pas ce changement. Reconnectez-vous puis recommencez. »
   (`:39-41`) ; « Votre numéro n’a pas pu être changé. Réessayez dans un instant. » (`:24`). Le refus s'affiche dans le
   bandeau « Changement impossible » ou sous le champ (`components/profile/PhoneChangeDialog.tsx:41-52`, `:257-262`).
7. **Preuves et essai.** Recette : essais 67 et 74 (`docs/recette-billetterie.md:1470-1486`, `:1597-1612`).

## 02.12 Modifier prénom, nom ; ajouter, changer ou retirer l'email

1. **Qui, où.** Compte actif connecté. `/profile`, section « Mes informations », bouton « Enregistrer le profil »
   (`components/profile/ProfileForm.tsx:221-297`).
2. **Ce qu'il saisit.** « Prénom » et « Nom » : 2 à 80 caractères (« Prénom : 2 caractères au moins. », « Prénom : 80
   caractères au plus. », de même pour « Nom ») ; « Adresse email » : 254 caractères, vide permis, aide « Recommandé :
   recevez vos billets et confirmations par email » ; refus « Adresse email invalide. », « Adresse email trop longue. »,
   « Cette adresse est réservée. Saisissez votre propre adresse email. » (`lib/validations/account.ts:6-25`,
   `components/profile/ProfileForm.tsx:226-262`). Le champ email montre l'adresse en attente, sinon l'adresse réelle,
   jamais l'adresse technique (`:69-77`).
3. **Ce que fait le système.** `PATCH /api/account/profile` (`app/api/account/profile/route.ts:30-121`) :
   - prénom et nom seuls : enregistrés, aucun mot de passe demandé ;
   - adresse **changée** (nouvelle, ou retirée) : mot de passe saisi depuis moins de 10 minutes (02.10) ;
   - nouvelle adresse : mise **en attente** ; l'adresse vérifiée actuelle reste l'identifiant de connexion mais **perd sa
     vérification** (plus d'emails jusqu'à la vérification de la nouvelle) ; liens précédents fermés ; un lien de
     vérification part (`M/20261109000010_lot9bis_email.sql:701-708`, `:722-727` ; route `:101-110`) ;
   - adresse vidée : retour à l'adresse technique, rien en attente ni vérifié (`app/api/account/profile/route.ts:52-60`,
     `M/20261109000010_lot9bis_email.sql:694-698`) ;
   - journal `ACCOUNT_PROFILE_UPDATED` avec le nom des champs seulement (`M/20261109000010_lot9bis_email.sql:729-730`).
   Écran : « Profil enregistré. » ; sort du lien sous l'adresse : « Un lien de vérification a été envoyé à {adresse}. Il
   est valable 24 heures. », ou le texte « L’envoi des emails n’est pas encore disponible… », ou « Le lien n’a pas pu être
   envoyé. Renvoyez-le depuis votre profil. » (`components/profile/ProfileForm.tsx:67`, `:88-97`, `:138`). Badge « Email
   vérifié » ou « Email non vérifié » + « Renvoyer le lien » (`:263-285`).
4. **Messages envoyés.** Le lien de vérification (tableau de 02.2). Aucun avis à l'ancienne adresse ni au numéro
   (aucune mise en file dans `M/20261109000010_lot9bis_email.sql:651-736`).
5. **Ce que voient les autres rôles.** Le nouveau nom au rechargement (administration, listes de l'organisateur).
6. **Refus (texte exact).** « Cette adresse email est déjà associée à un compte. » (`app/api/account/profile/route.ts:22`) ;
   « Votre profil a été modifié entre-temps. Rechargez la page et recommencez. » (`:23`) ; « Saisissez une adresse
   email : aucun numéro n’est associé à votre compte. » (`:53-55`) ; « L’enregistrement n’a pas pu aboutir. Réessayez
   avec la même adresse ; si le problème persiste, contactez le support. » (`:24`) ; « Votre profil n’a pas pu être
   enregistré. Réessayez dans un instant. » (`:21`) ; bandeau « Enregistrement impossible » (`ProfileForm.tsx:289-293`).
7. **Preuves et essai.** Recette : essai 66 (`docs/recette-billetterie.md:1452-1466`).

## 02.13 Vérifier son adresse email (lien) et renvoyer le lien

1. **Qui, où.** Le titulaire, depuis l'email reçu : `{APP_URL}/verify-email?t={jeton}` (page publique,
   `middleware.ts:41`, `:65`). Titre « Vérifier mon adresse email », texte « Confirmez l’adresse indiquée pour votre compte
   Event Village. Rien n’est validé tant que vous n’avez pas appuyé sur le bouton. », bouton « Confirmer mon adresse »,
   puis « Ouvrir mon profil » (`app/verify-email/page.tsx:97-141`). Renvoi : `/profile`, « Renvoyer le lien »
   (`components/profile/ProfileForm.tsx:271-283`).
2. **Ce qu'il saisit.** Rien : un appui sur le bouton.
3. **Ce que fait le système.** Le jeton est lu puis retiré de la barre d'adresse ; **rien n'est validé au chargement**
   (les antivirus de messagerie ouvrent les liens) (`app/verify-email/page.tsx:16-21`, `:51-60`). Au bouton : contrôle du
   lien, adresse libre, l'adresse devient l'identifiant de connexion et l'adresse vérifiée du compte, la même adresse en
   attente sur d'autres comptes leur est retirée, journal `ACCOUNT_EMAIL_VERIFIED` ; **aucune session n'est ouverte**
   (`app/api/account/email/verify/route.ts:35-99`, `M/20261109000010_lot9bis_email.sql:1022-1043`). Succès : « Adresse
   vérifiée » / « Adresse vérifiée. Vous recevrez désormais vos billets et vos confirmations par email. »
   (`app/verify-email/page.tsx:40`, `:105-109`). Lien : valable **24 heures**, un seul usage, le dernier émis annule les
   précédents ; jeton de 256 bits dont seule l'empreinte est en base (`lib/email/verification.ts:13-15`, `:129-137` ;
   `M/20261109000010_lot9bis_email.sql:811-817`). Renvoi : 3 liens par heure et par compte, 5 par jour et par adresse
   (`lib/env.ts:116-118`, `M/20261109000010_lot9bis_email.sql:800-809`) ; « Lien envoyé à {adresse}. Il est valable 24
   heures. » (`components/profile/ProfileForm.tsx:204`). Sans clé d'envoi d'emails, rien n'est tenté et aucun quota n'est
   consommé (`lib/email/verification.ts:103-108`). Un compte de démonstration ne reçoit aucun lien hors simulation
   (`:110-126`).
4. **Messages envoyés.** L'email de vérification (tableau de 02.2) à chaque renvoi.
5. **Ce que voient les autres rôles.** Rien ; les emails des autres messages partent désormais à cette adresse (voir 10).
   Les interrupteurs Email des préférences deviennent actifs (02.15).
6. **Refus (texte exact).** « Ce lien n’est pas valable. Demandez un nouveau lien depuis votre profil. », « Ce lien a
   expiré (24 heures). Demandez un nouveau lien depuis votre profil. », « Ce lien a déjà servi. », « Cette adresse est
   déjà vérifiée sur un autre compte Event Village. », « Votre profil a été modifié entre-temps. Demandez un nouveau lien
   depuis votre profil. » (`app/api/account/email/verify/route.ts:17-23`, `app/verify-email/page.tsx:33-38`), dans le
   bandeau « Vérification impossible » ; panne : bandeau « Vérification interrompue », « La vérification n’a pas pu
   aboutir. Réessayez dans un instant. » (`app/verify-email/page.tsx:81`, `:115-119`). Renvoi : « Aucune adresse email à
   vérifier : ajoutez d’abord une adresse dans votre profil. », « Cette adresse est déjà vérifiée sur un autre compte
   Event Village. », « L’envoi des emails n’est pas encore disponible. Votre adresse est enregistrée : vous pourrez la
   vérifier plus tard. », « Le lien n’a pas pu être envoyé. Réessayez dans quelques minutes. », « Trop de liens demandés.
   Réessayez dans {n} minute(s). » (`app/api/account/email/resend/route.ts:12-29`). Exemple : « Trop de liens demandés.
   Réessayez dans 42 minutes. »
7. **Preuves et essai.** Recette : essai 66.

## 02.14 Photo de profil

1. **Qui, où.** Compte actif. `/profile`, sous l'avatar : « Choisir une photo », « Supprimer la photo » (confirmation
   « Supprimer votre photo ? » / « Vos initiales s’afficheront à la place de votre photo. »), aide « JPEG, PNG ou WebP, 2
   Mo au plus. » (`components/profile/AvatarEditor.tsx:89-122`).
2. **Ce qu'il saisit.** Un fichier image. Refus côté écran : « Format non pris en charge. Choisissez une photo JPEG, PNG
   ou WebP. », « Cette photo dépasse 2 Mo. Choisissez une photo plus légère. » (`:35`, `:39`).
3. **Ce que fait le système.** Type lu dans le contenu du fichier, 2 Mo au plus, 20 envois par heure et par compte ;
   image recadrée en carré de 256 px, réencodée en WebP **sans métadonnées** (ni position GPS) ; nom tiré au hasard dans
   le dossier du compte ; l'ancienne photo est supprimée (`app/api/account/avatar/route.ts:16-22`, `:52-118`, `:138-145`).
   Toasts « Photo de profil enregistrée. » et « Photo de profil supprimée. » (`AvatarEditor.tsx:48`, `:64`).
4. **Messages envoyés.** Aucun.
5. **Ce que voient les autres rôles.** La photo est publique (dossier public des photos) (`M/20261108000004_lot9_compte.sql:14`).
6. **Refus (texte exact).** « La photo dépasse la taille maximale autorisée (2 Mo). », « Format non pris en charge :
   formats acceptés JPEG, PNG et WebP. », « Aucune photo fournie. », « Trop d’envois de photo pour le moment. Réessayez
   plus tard. », « Votre photo n’a pas pu être enregistrée. Réessayez dans un instant. »
   (`app/api/account/avatar/route.ts:26-28`, `:69`, `:81`), dans le bandeau « Photo non enregistrée »
   (`AvatarEditor.tsx:108-112`).
7. **Preuves et essai.** Recette : essai 68 (`docs/recette-billetterie.md:1488-1499`).

## 02.15 Préférences de notification par sujet

1. **Qui, où.** Compte actif ou en attente. `/profile` → « Préférences de notification » (« Rappels, changements
   d’événement, SMS et notifications push sur cet appareil ») (`app/profile/page.tsx:267-275`) → `/profile/notifications`,
   titre « Préférences de notification », texte « Choisissez comment Event Village vous prévient. Les messages
   indispensables partent toujours. » (`app/profile/notifications/page.tsx:254-258`). Carte de l'appareil pour le push
   (`:260`, détail dans 10).
2. **Ce qu'il saisit.** Une bascule par sujet et par canal, section « Vous choisissez » (« Pour chaque sujet, activez ou
   coupez un canal. Un canal coupé n’envoie plus rien sur ce sujet ; vous gardez les autres. ») (`:276-344`). Canaux :
   « Application », « SMS », « Email », « Notifications push » (`app/api/notifications/preferences/route.ts:46-51`).
   Sujets (`:31-44`) :

   | Sujet | Description affichée | Qui le voit |
   |---|---|---|
   | « Rappels avant l’événement » | « La veille et quelques heures avant le début d’un événement dont vous avez un billet (et, pour un contrôleur, la veille de chaque affectation). » | tous |
   | « Suspension et reprise d’un événement » | « Suspension ou reprise d’un événement dont vous avez un billet. » | tous |
   | « Activité de vos ventes » | « Premier billet vendu, nouvelles commandes, catégories et événements complets. » | partenaires seulement (`:116`, `:151-156`) |

   Section « Toujours envoyées » (« Ces messages protègent votre compte, votre argent et vos billets : ils ne se
   désactivent pas. ») : « Codes de connexion », « Confirmations d’achat et reçus », « Billets transférés »,
   « Annulations », « Remboursements », « Sécurité du compte », « Changements de date ou de lieu »
   (`app/api/notifications/preferences/route.ts:54-62`, `app/profile/notifications/page.tsx:346-366`).
3. **Ce que fait le système.** Absence de réglage = canal activé (`route.ts:12-14`). Chaque bascule est enregistrée
   aussitôt ; toast « {sujet} : {canal} activé. » ou « … désactivé. » — ex. « Rappels avant l’événement : SMS
   désactivé. » (`page.tsx:183-236`). Un canal coupé produit des lignes « non envoyé, préférence coupée » dans la boîte
   d'envoi, jamais une absence (`route.ts:19-21`). Sans adresse vérifiée : bandeau « Emails non disponibles » / « Ajoutez
   et vérifiez une adresse email dans votre profil pour recevoir ces emails. » avec « Ouvrir mon profil », et chaque
   bascule Email grisée « Adresse email non vérifiée » (`page.tsx:52`, `:283-291`, `:323-331` ; `route.ts:128-133`).
4. **Messages envoyés.** Aucun. (Notification d'essai du push : voir 10.)
5. **Ce que voient les autres rôles.** Rien.
6. **Refus (texte exact).** « Préférence inconnue : seuls les rappels, la suspension et la reprise d’un événement et
   l’activité des ventes se règlent, canal par canal. Les messages indispensables sont toujours envoyés. »
   (`route.ts:64-65`) ; « Vos préférences de notification sont momentanément indisponibles. Réessayez dans un instant. »
   (`:81-87`) ; échec d'une bascule : toast « « {canal} » pour « {sujet} » n’a pas été modifié. {raison} » et retour de
   la bascule (`page.tsx:224-228`) ; compte suspendu : refus 403 (`route.ts:19`, `lib/auth/session.ts:56-63`).
7. **Preuves.** Fichiers cités.

## 02.16 Page « Mon profil » : ce qu'elle montre ; déconnexion

1. **Qui, où.** Tout compte connecté. `/profile`, titre « Mon profil », texte « Vos coordonnées, l’affichage de
   l’application, vos notifications et vos accès. » (`app/profile/page.tsx:210-213`).
2. **Contenu.** Avatar, nom complet, badges « Ambassadeur Event Village », « Partenaire validé » ou « Partenaire en
   attente de validation » ; téléphone au format « +221 77 000 00 00 » (« Non renseigné » sinon) ; email réel seulement ;
   rôles (« Client », « Partenaire », « Contrôleur », « Administrateur », « Super-administrateur ») ; statut « Compte
   actif », « Compte en attente de validation », « Compte suspendu » (`:46-64`, `:215-260`). Formulaire « Mes
   informations » (02.11, 02.12, 02.9). Section « Réglages et espaces » : « Préférences de notification », « Mes
   paiements » (« L’historique de vos paiements et de vos remboursements »), « Portefeuille de parrainage » (« Vos gains de
   parrainage et vos demandes de retrait »), et selon les rôles « Espace partenaire », « Contrôle des billets »,
   « Administration » (`:164-206`, `:264-285`). « Affichage » : « Clair », « Sombre », « Système » (`:66-70`, `:287-310`).
   Bouton « Se déconnecter » (`:312-320`). Non connecté : « Connectez-vous pour voir votre profil » (`:125-137`) ;
   profil illisible : « Votre profil n’a pas pu être chargé » (`:140-150`).
3. **Déconnexion.** Billets hors ligne et mémoire du contrôle effacés de l'appareil, appareil détaché du push, puis
   session fermée **sur cet appareil seulement** (`components/providers/AuthProvider.tsx:215-232`). Il n'existe aucun
   bouton « déconnecter tous mes appareils » ; cette révocation globale n'est faite qu'après une réinitialisation du mot
   de passe (02.8) (`app/reset-password/page.tsx:290-297`, seul appel de `/api/auth/sign-out-global`).
4. **Messages envoyés.** Aucun.
5–6. Sans objet.
7. **Preuves.** Fichiers cités.

## 02.17 Suspension d'un compte (non partenaire) par un administrateur

1. **Qui, où.** ADMIN muni de la permission « utilisateurs (écriture) » (`users.write`) ou SUPERADMIN, compte actif.
   `/admin/users`, bouton « Suspendre » sur la ligne (absent pour un partenaire, un SUPERADMIN, un compte effacé ; pour un
   ADMIN, seulement si l'acteur est SUPERADMIN) (`app/admin/users/page.tsx:515-533`). Un partenaire se suspend depuis sa
   fiche : « Voir la fiche partenaire » ou « Statut géré depuis la fiche partenaire » (`:500-513`) ; voir
   `03-partenaire.md`.
2. **Ce qu'il saisit.** Boîte « Suspendre le compte », texte « {prénom} {nom} ne pourra plus se connecter : ses sessions
   sont fermées. Ses billets payés restent valables à l’entrée. Il est prévenu avec votre motif. », champ « Motif de la
   suspension », aide « Au moins 3 caractères. Ce motif est communiqué au titulaire du compte. », 500 caractères au plus,
   bouton « Suspendre le compte » (`app/admin/users/page.tsx:904-925`). Motif trop court : « Le motif doit contenir au
   moins 3 caractères. » (`components/ui/ReasonDialog.tsx:9`, `:64-65`).
3. **Ce que fait le système.** En une transaction (`M/20261109000004_lot9bis_droits.sql:456-529`) : statut `SUSPENDU`,
   **toutes les sessions révoquées**, journal `USER_STATUS_SET` (acteur, ancien et nouveau statut, motif), avis
   `ACCOUNT_SUSPENDED` avec le motif. Toast de l'admin : « Le compte de {prénom} {nom} a été suspendu. »
   (`app/admin/users/page.tsx:227-231`).
   **Ce que vit la personne suspendue :**
   - les jetons déjà émis restent valables jusqu'à une heure (`lib/auth/sessions.ts:7-8`) ; toute route qui exige un
     compte actif répond « Votre compte n'est pas actif. Contactez le support. » (`lib/auth/session.ts:56-63`) ;
   - à une nouvelle connexion (mot de passe ou code), le mot de passe ou le code sont acceptés, puis l'écran ferme la
     session et affiche « Votre compte est suspendu. Veuillez contacter le support. »
     (`components/auth/LoginForm.tsx:280-286`) ;
   - ses billets payés restent valables à l'entrée (texte de l'avis ; voir `05-equipe-controle-acces.md` et `07-billets.md`) ;
   - les autres messages qui lui sont destinés sont bloqués pendant la suspension, sauf ceux marqués « envoyés malgré la
     suspension » (ex. `ACCOUNT_SUSPENDED`, `ACCOUNT_REACTIVATED`, `PHONE_CHANGED`) (`lib/notifications/catalog.ts:875`,
     `:1578`, `:1589`, `:887`) ; liste complète dans 10.
   **Écart** : la fermeture de la session sur le téléphone efface les billets hors ligne enregistrés
   (`components/providers/AuthProvider.tsx:177-182`), alors que l'avis invite à présenter ce billet hors ligne. Certain
   quand la personne essaie de se reconnecter (`LoginForm.tsx:283` ferme la session) ; probable à l'expiration du jeton
   (bibliothèque d'authentification, `node_modules/@supabase/auth-js/dist/main/GoTrueClient.js:4111-4117`). Constat
   W2-02, à confirmer par l'essai 73.
4. **Messages envoyés.** Registre : indispensable, application + SMS + email, envoyé malgré la suspension
   (`M/20261109000003_lot9bis_registre.sql:79`).

   | Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
   |---|---|---|---|---|
   | Titulaire suspendu | SMS | Indispensable | File d'attente, immédiat | « Event Village : votre compte est suspendu. Motif : {motif, 35 caractères au plus, sans ponctuation finale}. Vos billets payés restent valables à l'entrée. Contactez le support. » — ex. « Event Village : votre compte est suspendu. Motif : Paiements contestés. Vos billets payés restent valables à l'entrée. Contactez le support. » (140 caractères, 1 segment ; motif long tronqué par « ... », 160 au plus) (`lib/notifications/catalog.ts:1584`, `:153-160`) |
   | Titulaire suspendu | Cloche | Indispensable | File d'attente (lisible seulement après réactivation : il ne peut plus se connecter) | « Compte suspendu » / « Votre compte est suspendu. Motif : {motif}. Vos billets payés restent valables à l'entrée : présentez le billet hors ligne déjà enregistré sur votre téléphone, ou donnez le numéro du billet avec une pièce d'identité. Contactez le support. » (lien `/billet/hors-ligne`) (`lib/notifications/catalog.ts:1577-1583`) |
   | Titulaire, si adresse vérifiée | Email | Indispensable | File d'attente | Voir 10, type `ACCOUNT_SUSPENDED` |

5. **Ce que voient les autres rôles.** L'administration : badge « Suspendu », bouton « Réactiver » au rechargement
   (`app/admin/users/page.tsx:454-464`, `:531`). Le journal d'audit porte la ligne `USER_STATUS_SET`.
6. **Refus (texte exact).** « Ce compte est celui d’un partenaire : suspendez-le ou réactivez-le depuis sa fiche
   partenaire, avec un motif. » ; « Seul un superadmin peut créer un administrateur ou changer ce rôle. » ; « Indiquez le
   motif de la suspension (3 caractères au moins). » ; « Changement de statut réservé à un administrateur habilité. » ;
   « Utilisateur cible introuvable. » ; « Changement de statut incomplet. » (`M/20261109000004_lot9bis_droits.sql:474-499`) ;
   réseau : « Le serveur ne répond pas. Vérifiez votre connexion, puis réessayez. » (`app/admin/users/page.tsx:236`). Même
   statut : rien n'est écrit, aucun avis (`M/20261109000004_lot9bis_droits.sql:500-503`).
7. **Preuves et essai.** Recette : essai 73 (`docs/recette-billetterie.md:1578-1595`).

## 02.18 Réactivation d'un compte suspendu

1. **Qui, où.** Même administrateur, `/admin/users`, bouton « Réactiver » (`app/admin/users/page.tsx:531`).
2. **Ce qu'il saisit.** Boîte « Réactiver le compte », texte « {prénom} {nom} retrouvera l’accès à son compte. Il est
   prévenu avec votre motif. », champ « Motif de la réactivation » (3 caractères au moins à l'écran), bouton « Réactiver
   le compte » (`:912-921`).
3. **Ce que fait le système.** Statut `ACTIF`, journal `USER_STATUS_SET` avec le motif, avis `ACCOUNT_REACTIVATED` (seulement
   depuis `SUSPENDU`) ; aucune session n'est rouverte (`M/20261109000004_lot9bis_droits.sql:505-524`). Toast : « Le compte
   de {prénom} {nom} a été réactivé avec succès. » (`app/admin/users/page.tsx:227-230`). La personne se reconnecte
   normalement (02.3, 02.4). Côté serveur, le motif n'est pas exigé pour une réactivation (`:497-499`).
4. **Messages envoyés.**

   | Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
   |---|---|---|---|---|
   | Titulaire | SMS | Indispensable | File d'attente, immédiat | « Event Village : votre compte est réactivé. Vous pouvez de nouveau vous connecter : {APP_URL}/login » — ex. avec `https://app.exemple.sn` : 111 caractères, 1 segment (89 caractères + l'adresse de l'application) (`lib/notifications/catalog.ts:1592`) |
   | Titulaire | Cloche | Indispensable | File d'attente | « Compte réactivé » / « Votre compte est réactivé : vous pouvez de nouveau vous connecter. » (lien `/login`) (`:1591`) |
   | Titulaire, si adresse vérifiée | Email | Indispensable | File d'attente | Voir 10, type `ACCOUNT_REACTIVATED` |

   **Écart** : la boîte annonce « Il est prévenu avec votre motif. », mais l'avis de réactivation ne contient pas le motif
   (`M/20261109000004_lot9bis_droits.sql:523`, `lib/notifications/catalog.ts:1591-1592`). Constat W2-03.
5. **Ce que voient les autres rôles.** Badge « Actif » dans l'administration au rechargement.
6. **Refus.** Ceux de 02.17 (sauf le motif).
7. **Preuves et essai.** Recette : essai 73.

## 02.19 « Supprimer » un compte : anonymisation par un administrateur

Il n'existe **aucune suppression par la personne elle-même** : aucune route du compte ne le permet (dossier
`app/api/account/` : photo, invitations de contrôle, email, mot de passe, confirmation, paiements, numéro, profil).

1. **Qui, où.** ADMIN muni de `users.write` ou SUPERADMIN. `/admin/users`, bouton « Supprimer » (info-bulle
   « Anonymiser définitivement ce compte (RGPD) ») (`app/admin/users/page.tsx:534-543`). Boîte « Anonymiser
   définitivement ce compte ? », texte « Attention : Cette action va anonymiser définitivement cet utilisateur (conformité
   RGPD). Ses données personnelles seront effacées et il sera banni, mais son historique financier sera conservé. Cette
   action est irréversible. », boutons « Anonymiser & Supprimer », « Annuler » (`:928-938`).
2. **Ce qu'il saisit.** Rien.
3. **Ce que fait le système.** `POST /api/admin/users/{id}/anonymize` (`app/api/admin/users/[id]/anonymize/route.ts:13-40`) :
   compte de connexion renommé (`{id}@deleted.eventvillage.sn`, numéro fictif `+999…`), **banni 100 ans**, nom
   « Utilisateur Supprimé » ; sessions révoquées ; profil effacé (prénom, nom, email, numéro `000000000`), statut
   `SUPPRIME` (repli `SUSPENDU` si l'écriture échoue) ; retrait des droits d'administration, des affectations et du rôle
   de contrôleur, des codes SMS ; journal `ANONYMIZE_USER` ; commandes, billets et caisses conservés
   (`lib/admin/admin.service.ts:304-487`). Toast : « Le compte de {prénom} {nom} a été définitivement anonymisé (RGPD). »
   (`app/admin/users/page.tsx:309`). La ligne affiche « Données effacées » et « Compte Anonymisé & Banni »
   (`:463`, `:547-551`, `lib/labels/account.ts:23`).
4. **Messages envoyés.** Aucun avis à la personne (aucune mise en file dans `lib/admin/admin.service.ts:309-487`).
5. **Ce que voient les autres rôles.** Le nom « Utilisateur Supprimé » partout où le compte apparaît.
6. **Refus (texte exact).** « Impossible de supprimer votre propre compte administrateur. »
   (`lib/admin/admin.service.ts:313-315`) ; « Seul un Superadmin peut supprimer un compte SUPERADMIN. » (`:328-330`) ;
   « Révocation des sessions du compte anonymisé impossible. » (`:360-362`) ; « Anonymisation incomplète : retrait
   impossible ({liste}). Relancez l'anonymisation ; une caisse ouverte doit d'abord être clôturée. » (`:452-462`) ;
   panne : « Anonymisation momentanément impossible. Réessayez. » (`route.ts:38`). La personne anonymisée qui tente de se
   connecter par mot de passe reçoit « Ce compte n’est plus actif. Veuillez contacter le support. »
   (`app/api/auth/login/route.ts:37-38`) ; par code : « Aucun compte n'est associé à ce numéro de téléphone. Veuillez vous
   inscrire. » (son numéro est effacé). Écarts (bouton offert sur un compte partenaire ; contrôle serveur sur l'ancien
   rôle) : constat W2-09.
7. **Preuves.** Fichiers cités.

## 02.20 Récapitulatif des quotas du compte (codes, connexions, liens)

Valeurs par défaut des variables d'environnement (`lib/env.ts`), fenêtres fixes ; détail et messages dans 13.

| Ce qui est compté | Limite par défaut | Preuve |
|---|---|---|
| SMS de code par numéro | 3 par 15 min, 10 par jour | `lib/env.ts:57-58`, `lib/sms/sms-guard.ts:87-91` |
| SMS de code par adresse IP | 10 par heure, 30 par jour | `lib/env.ts:59-60`, `lib/sms/sms-guard.ts:92-97` |
| Vérifications de code par numéro | 10 par 15 min | `lib/env.ts:85` |
| Essais sur un même code | 5 | `M/20261102000002_lot5_dette.sql:484` |
| Validité d'un code (connexion, inscription, réinitialisation, numéro, retrait) | 10 min | `app/api/auth/send-otp/route.ts:88`, `app/api/auth/register/start/route.ts:14`, `app/api/account/phone/start/route.ts:24`, `app/api/withdrawals/otp/route.ts:109` |
| Validité du code d'activation d'un contrôleur | 24 h | `app/api/partner/team/invite/route.ts:482` |
| Connexions par mot de passe par IP | 30 par heure | `lib/env.ts:115` |
| Recherches « ce numéro a-t-il un compte ? » par IP | 30 par heure | `lib/env.ts:84` |
| Confirmations et changements de mot de passe par compte | 5 par 15 min | `lib/env.ts:113` |
| Changements de numéro par compte | 5 par jour | `lib/env.ts:110` |
| Liens de vérification d'email | 3 par heure et par compte, 5 par jour et par adresse | `lib/env.ts:117-118` |
| Photos de profil par compte | 20 par heure | `lib/env.ts:111` |
| Verrou de l'écran (navigateur) | 5 échecs → 60 s | `components/auth/LoginForm.tsx:49-50` |
| Mot de passe « récent » | 10 min, par appareil | `lib/auth/password-confirm.ts:23` |
| Retraits après changement de numéro | bloqués 24 h | `M/20261110000005_lot9ter_argent.sql:383-391` |
