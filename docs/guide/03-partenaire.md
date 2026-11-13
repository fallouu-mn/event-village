# 03 — Partenaire : inscription, validation, suspension, essai, profil, abonnement, tableau de bord, finances

> Guide complet de l'application Event Village, état de `main` à `0889df6` (lots 1 à 9 ter). Source de vérité : le code.
> Chaque fait porte sa preuve `fichier:ligne` (chemins relatifs au dépôt ; `M/` = `supabase/migrations/`).
> Ce qui n'a pas pu être établi est marqué **NON VÉRIFIÉ**. Données d'exemple fictives : gérante « Fatou Diop »,
> structure « Concert Test Prod », numéro `77 000 00 00` (forme enregistrée `+221770000000`), événement « Concert Test ».
> Les messages (canaux, heures calmes, plafonds) sont détaillés dans `10-notifications.md` ; les quotas chiffrés dans
> `13-limites-quotas-securite.md` ; le traitement des retraits côté administration (« Versements à reprendre »,
> « Renvoyer », « Marquer versé », « Constater non versé ») dans `08-argent.md`. Les écarts relevés en écrivant ce
> fichier sont listés dans `15-constats.md` (identifiants W3-xx de la note de travail).

## Sommaire

| N° | Scénario |
|---|---|
| 03.1 | Ouvrir l'inscription partenaire (visiteur, ou compte déjà connecté) |
| 03.2 | Inscription, étape 1 : le dossier (structure, gérant, NINEA, RCCM, pièces) |
| 03.3 | Inscription, étape 2 : le code SMS, création du dossier, écran « Dossier reçu » |
| 03.4 | Partenaire en attente : ce qu'elle voit et ce qu'elle peut faire |
| 03.5 | Administration : la file des candidatures et la fiche « Dossier du partenaire » |
| 03.6 | Administration : valider une candidature |
| 03.7 | Administration : refuser une candidature avec un motif |
| 03.8 | Partenaire refusée : compléter son dossier (une seule fois) |
| 03.9 | Second refus après un complément |
| 03.10 | Administration : suspendre une partenaire (cascade sur ses événements, sessions, fonds) |
| 03.11 | Administration : réactiver une partenaire suspendue |
| 03.12 | Période d'essai |
| 03.13 | Profil partenaire (« Page professionnelle ») |
| 03.14 | Abonnement |
| 03.15 | Tableau de bord |
| 03.16 | Statistiques |
| 03.17 | Calendrier |
| 03.18 | Finances : les soldes (disponible, en attente, gelé, à compenser, retraits en cours) |
| 03.19 | Demander un retrait (devis, code SMS, confirmation) |
| 03.20 | Retrait refusé avant l'envoi (minimum, solde, gel, verrou de 24 h, compte, quotas) |
| 03.21 | Suivi d'un retrait : versé, refusé par l'opérateur, en vérification, retardé |
| 03.22 | « Recettes disponibles » : l'avis de fin de garde |
| 03.23 | Tableau des états du dossier partenaire et de qui peut les changer |

Règles communes à tout le fichier :

- **Deux statuts distincts.** La fiche partenaire a son statut (`EN_ATTENTE`, `VALIDE`, `REJETE`, `SUSPENDU`,
  `M/0001_initial_schema.sql:39-44`) ; le compte de la personne a le sien (`ACTIF`, `SUSPENDU`, `EN_ATTENTE`,
  `M/0001_initial_schema.sql:32-36`). L'inscription met les deux à « en attente »
  (`M/20261109000004_lot9bis_droits.sql:593`, `:604`) ; la validation, le refus et la réactivation remettent le
  compte `ACTIF`, la suspension le met `SUSPENDU` (`M/20261109000006_lot9bis_argent.sql:838-841`).
- **Compte « en attente » et routes de l'espace.** La plupart des routes de l'espace partenaire exigent un compte
  `ACTIF` et répondent sinon « Votre compte n'est pas actif. Contactez le support. » (`lib/auth/session.ts:51`,
  `:56-62`). Seules quelques routes acceptent aussi un compte `EN_ATTENTE` : tableau de bord, lecture du profil,
  complément du dossier, liste des événements, pièces (`app/api/partner/dashboard/route.ts:18`,
  `app/api/partner/profile/route.ts:115`, `app/api/partner/dossier/complete/route.ts:39`,
  `app/api/partner/documents/signed-url/route.ts:63`).
- **Messages au partenaire.** L'email ne part que vers une adresse vérifiée (l'adresse saisie à l'inscription attend son
  lien de vérification) ; voir `10-notifications.md`. Tous les avis de ce fichier sont de la famille « indispensable »
  (aucun sujet de préférence) sauf mention contraire (`lib/notifications/catalog.ts:289`).

---

## 03.1 Ouvrir l'inscription partenaire (visiteur, ou compte déjà connecté)

1. **Qui, où.** Toute personne. URL `/partner/register`, page publique (`middleware.ts:62`) ; la mise en page de
   l'espace partenaire la laisse passer sans contrôle (`app/partner/layout.tsx:23-25`). Le menu affiche « Devenir
   partenaire » à tout compte qui n'est ni partenaire, ni administrateur, ni contrôleur
   (`components/layout/AppLayout.tsx:207-209`) ; voir `01-roles-menus-ecrans.md`. En-tête : badge « Espace
   professionnel », titre « Devenir partenaire Event Village », texte « Publiez vos événements et vendez vos billets en
   ligne, avec des reversements par SamirPay. Votre dossier est vérifié par notre équipe avant l’ouverture de votre
   espace. » (`app/partner/register/page.tsx:378-382`). Indication d'étape : « Étape 1 sur 2 : votre dossier »
   (`:384-388`).
2. **Ce qu'il saisit.** Rien à cette étape. Si la personne est **déjà connectée**, le formulaire est remplacé par
   l'encart « Vous êtes déjà connecté » : « Ce formulaire crée un compte professionnel distinct, avec un autre numéro de
   téléphone. Votre compte actuel n’est pas transformé en compte partenaire. » puis « Pour inscrire votre structure,
   déconnectez-vous, puis revenez sur cette page avec le numéro professionnel. », boutons « Se déconnecter » et
   « Retour à l’accueil » (`app/partner/register/page.tsx:390-405`).
3. **Ce que fait le système.** Rien n'est enregistré. Un compte client existant n'est jamais converti en partenaire : il
   faut un autre numéro (`app/partner/register/page.tsx:26-27`, `:394`).
4. **Messages envoyés.** Aucun.
5. **Ce que voient les autres rôles.** Rien.
6. **Refus.** Sans objet. En bas du formulaire, « Déjà partenaire ? » et le lien « Se connecter » vers `/login`
   (`app/partner/register/page.tsx:608-611`).
7. **Preuves et essai.** Fichiers cités. Recette : essai 9 (`docs/recette-billetterie.md:460-476`).

## 03.2 Inscription, étape 1 : le dossier (structure, gérant, NINEA, RCCM, pièces)

1. **Qui, où.** Visiteur non connecté, `/partner/register`, formulaire en trois blocs : « 1. Votre structure », « 2. Le
   gérant et le compte », « 3. Pièces justificatives » (`app/partner/register/page.tsx:496-594`). Bouton « Envoyer mon
   dossier », précédé de « Un code vous est d’abord envoyé par SMS au téléphone professionnel ; le dossier n’est
   enregistré qu’une fois ce code saisi. » (`:603-606`).
2. **Ce qu'il saisit.**

   | Champ (libellé exact) | Obligatoire | Limites, aide, message d'erreur exact | Preuve |
   |---|---|---|---|
   | « Raison sociale » (exemple `Nom légal de la société`) | oui | 2 caractères au moins ; erreur « La raison sociale est requise » | `app/partner/register/page.tsx:502-503`, `lib/validations/auth.ts:213` |
   | « Nom commercial (enseigne) » (exemple `Nom connu du public`) | non | vide : la raison sociale est reprise | `app/partner/register/page.tsx:504-505`, `app/api/partner/register/route.ts:224` |
   | « Activités proposées » (aide « Touchez une ou plusieurs activités. ») | oui | une au moins, « Organisation d’événements et festivals » cochée d'office ; huit choix : « Organisation d’événements et festivals », « Salle de fête et de réception », « Restaurant », « Traiteur et buffet », « Prestataire (son, lumière, scène) », « Pâtisserie et desserts », « Établissement alimentaire », « Autre service événementiel » ; erreur « Sélectionnez au moins un type d'activité » | `app/partner/register/page.tsx:105`, `:508-541`, `lib/partner/activity-labels.ts:7-16`, `lib/validations/auth.ts:218` |
   | « Présentation de votre structure » | oui | 10 à 2 000 caractères, compteur ; aide « 10 caractères au moins : capacité d’accueil, prestations, spécialités. » ; erreur « Une brève description de votre activité est requise » | `app/partner/register/page.tsx:543-545`, `lib/validations/auth.ts:215` |
   | « Adresse » (exemple `Boulevard Martin Luther King`) | oui | 3 caractères au moins ; erreur « L'adresse de l'établissement est requise » | `app/partner/register/page.tsx:547-548`, `lib/validations/auth.ts:216` |
   | « Ville » (exemple `Dakar`) | marqué obligatoire | prérempli « Dakar » ; laissé vide, la fiche reçoit « Dakar » sans message | `app/partner/register/page.tsx:104`, `:549-550`, `lib/validations/auth.ts:217`, `app/api/partner/register/route.ts:227` |
   | « NINEA (facultatif) » | non | 40 caractères au plus, aucun contrôle de format ; refus serveur « Le NINEA et le RCCM font 40 caractères au plus. » | `app/partner/register/page.tsx:553`, `app/api/partner/register/route.ts:31-32`, `:86-94`, `M/20261109000004_lot9bis_droits.sql:540` |
   | « RCCM (facultatif) » | non | mêmes règles que le NINEA | `app/partner/register/page.tsx:554`, `M/20261109000004_lot9bis_droits.sql:542` |
   | « Prénom », « Nom » | oui | 2 caractères au moins ; erreurs « Le prénom du gérant est requis », « Le nom du gérant est requis » | `app/partner/register/page.tsx:564-567`, `lib/validations/auth.ts:221-222` |
   | « Téléphone professionnel » (exemple `77 800 00 00`) | oui | mobile sénégalais 70, 75, 76, 77, 78 ; aide « Le code de vérification est envoyé à ce numéro. Il ne doit pas déjà servir à un compte. » ; erreur « Numéro de mobile sénégalais invalide. Exemple : 77 123 45 67. » | `app/partner/register/page.tsx:568-570`, `lib/validations/auth.ts:8`, `:82-87`, `:223` |
   | « Email professionnel » (exemple `direction@etablissement.sn`) | **oui** | aide « Recommandé : recevez vos billets et confirmations par email. Un lien de vérification vous est envoyé ; l’adresse ne reçoit rien d’autre tant qu’elle n’est pas vérifiée. » ; erreur « Adresse email professionnelle requise » ; domaine `eventvillage.sn` refusé par le serveur : « Cette adresse est réservée. Saisissez votre propre adresse email. » (l'aide dit « Recommandé » pour un champ obligatoire : constat W3-08) | `app/partner/register/page.tsx:571-573`, `lib/validations/auth.ts:5`, `:224`, `app/api/partner/register/route.ts:82-84` |
   | « Mot de passe » | oui | règle robuste (voir `02-comptes.md`, règles communes), liste « Robustesse du mot de passe » sous les champs | `app/partner/register/page.tsx:574-579`, `lib/validations/auth.ts:93-97`, `:225` |
   | « Confirmer le mot de passe » | oui | erreur « Les mots de passe ne correspondent pas. » ; vide : « Veuillez confirmer le mot de passe » | `app/partner/register/page.tsx:208`, `:576-577`, `lib/validations/auth.ts:226` |
   | « Pièce d’identité du gérant » (aide « CNI ou passeport en cours de validité. ») | oui | PDF, JPEG, PNG ou WebP, 10 Mo au plus ; absente : « Joignez la pièce d’identité du gérant (CNI ou passeport). » | `app/partner/register/page.tsx:209`, `:591` |
   | « Document de l’entreprise » (aide « Extrait RCCM ou attestation NINEA. ») | oui | mêmes formats ; absent : « Joignez le document de l’entreprise (RCCM ou NINEA). » | `app/partner/register/page.tsx:210`, `:592` |

   Le bloc des pièces dit : « Les deux pièces sont obligatoires. Elles sont rangées dans un espace privé, lues seulement par
   l’équipe qui valide votre dossier. PDF, JPEG, PNG ou WebP, 10 Mo au plus. » (`app/partner/register/page.tsx:587-589`).
   Un fichier choisi s'affiche « Fichier choisi : {nom du fichier} », par exemple « Fichier choisi : cni-fatou.pdf »
   (`:360-365`). Si un champ manque, un récapitulatif s'affiche en tête : « Le dossier n’est pas complet : corrigez les
   champs signalés. », avec un lien vers chaque champ (`:211-213`, `:479-494`).
3. **Ce que fait le système.**
   - Tout le formulaire est contrôlé **avant** le moindre envoi de fichier (`app/partner/register/page.tsx:199-214`).
   - Chaque pièce est déposée (`POST /api/partner/documents/upload`) avec les messages de progression « Envoi de la pièce
     d’identité… » puis « Envoi du document d’entreprise… » (`app/partner/register/page.tsx:220-223`). Le serveur lit le
     vrai type du fichier dans son contenu (pas dans son nom) et le range dans un espace privé, sous un chemin tiré au
     hasard ; il rend un jeton de dépôt valable **2 heures** (`lib/partners/documents.ts:17`, `:28-34`, `:41-53`,
     `app/api/partner/documents/upload/route.ts:53-64`, `:86-92`). Une pièce déjà déposée pour le même fichier est
     réutilisée tant que son jeton a encore plus de 2 minutes de validité (`app/partner/register/page.tsx:75-76`,
     `:157-161`).
   - Puis l'« appel 1 » (`POST /api/partner/register` sans code) : quota d'inscription par adresse IP, formulaire,
     pièces, compte existant, puis réservation anti-abus du SMS et code d'objet « inscription » valable **10 minutes**,
     enregistré avant l'envoi (`app/api/partner/register/route.ts:57-71`, `:73-153`). **Rien n'est créé** à cette étape :
     ni compte, ni fiche, ni avis aux administrateurs (`:36-37`, `:117-118`). Message de progression « Envoi du code de
     vérification… » (`app/partner/register/page.tsx:226`). L'écran passe à l'étape 2 (03.3).
4. **Messages envoyés.**

   | Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
   |---|---|---|---|---|
   | Téléphone professionnel saisi | SMS | Indispensable (envoi direct, journalisé sans le code) | Immédiat | « Event Village : votre code de vérification est {code}. Valable 10 minutes. » — ex. « Event Village : votre code de vérification est 123456. Valable 10 minutes. » (74 caractères, 1 segment) (`lib/notifications/catalog.ts:1800-1804`, type `OTP_REGISTER`, `app/api/partner/register/route.ts:136-140`) |

5. **Ce que voient les autres rôles.** Rien : aucun dossier n'apparaît chez l'administration avant le code
   (`app/api/partner/register/route.ts:36-37`). L'envoi du SMS apparaît dans la supervision des envois (type
   `OTP_REGISTER`) ; voir `10-notifications.md`.
6. **Refus.**
   - Numéro ou email déjà utilisé par un compte : « Ce numéro de téléphone ou cet email est déjà associé à un compte.
     Veuillez vous connecter. », sans SMS (`app/api/partner/register/route.ts:111-116`).
   - Pièce : fichier vide ou de plus de 10 Mo : « Le fichier est vide ou dépasse la taille maximale autorisée (10 Mo). » ;
     autre format : « Format de fichier non supporté. Formats acceptés : PDF, JPEG, PNG, WebP. » ; trop de dépôts depuis la
     même connexion (20 par heure) : « Trop de dépôts depuis cette connexion. Réessayez plus tard. » ; échec du stockage :
     « Échec du dépôt du fichier. Réessayez. » (`app/api/partner/documents/upload/route.ts:33-41`, `:53-64`, `:71-84`,
     `lib/env.ts:68`). Dépôt refusé sans texte du serveur : « Dépôt de la pièce d’identité impossible. Réessayez. » ou
     « Dépôt du document d’entreprise impossible. Réessayez. » (`app/partner/register/page.tsx:168-171`).
   - Pièce introuvable, déjà utilisée ou expirée (jeton) : par exemple « Le dépôt de la pièce d’identité a expiré :
     déposez-la à nouveau. » ; l'écran oublie alors les jetons et redéposera les pièces
     (`lib/partners/documents.ts:81-92`, `:95-101`, `app/partner/register/page.tsx:236-240`).
   - Trop d'inscriptions depuis la même connexion (10 par heure, chaque tentative compte) : « Trop de tentatives
     d’inscription depuis cette connexion. Réessayez plus tard. » ; garde indisponible : « Service momentanément
     indisponible. Réessayez dans un instant. » (`app/api/partner/register/route.ts:58-70`, `lib/env.ts:87`,
     `lib/security/quota-http.ts:10-19`).
   - Trop de SMS (numéro, IP, plafond global) : textes communs du garde SMS, voir `02-comptes.md` (02.1) et 13.
   - SMS non parti : « Impossible d'envoyer le code de vérification SMS. Vérifiez votre numéro et réessayez. » ; code non
     préparé : « Impossible de préparer le code de vérification. Réessayez. » (`app/api/partner/register/route.ts:127-147`).
   - Réseau coupé : « Connexion impossible : vérifiez votre réseau, puis réessayez. Les pièces déjà déposées ne seront pas
     renvoyées. » (`app/partner/register/page.tsx:248-252`).
7. **Preuves et essai.** Fichiers cités. Recette : essai 9 (`docs/recette-billetterie.md:460-476`).

## 03.3 Inscription, étape 2 : le code SMS, création du dossier, écran « Dossier reçu »

1. **Qui, où.** Même personne, même page. Indication « Étape 2 sur 2 : le code reçu par SMS », titre « Vérifiez votre
   numéro », texte « Code envoyé au {numéro}. Saisissez-le pour envoyer votre dossier. » (ex. « Code envoyé au
   +221770000000. Saisissez-le pour envoyer votre dossier. ») et « Le code à 6 chiffres reste valable 10 minutes. Votre
   dossier n’est enregistré qu’après sa vérification. » (`app/partner/register/page.tsx:386`, `:446-450`). Champ « Code
   reçu par SMS », boutons « Vérifier le code » et « Renvoyer le code ({n} s) » puis « Renvoyer le code » après 60 s
   (`:74`, `:458-474`).
2. **Ce qu'il saisit.** Le code à 6 chiffres. Moins de 6 chiffres : « Saisissez les 6 chiffres du code reçu par SMS. »
   (`app/partner/register/page.tsx:264-267`).
3. **Ce que fait le système.**
   - L'« appel 2 » renvoie le même dossier avec le code (`app/partner/register/page.tsx:276-281`). Le serveur vérifie le
     code **avant toute écriture** (quota de 10 vérifications par 15 minutes et par numéro, puis 5 essais par code)
     (`app/api/partner/register/route.ts:155-171`, `lib/env.ts:85`).
   - Il crée alors le compte de connexion (numéro confirmé ; l'identifiant interne est l'adresse technique du numéro,
     l'adresse saisie attend sa vérification), donne le rôle PARTENAIRE, puis, **en une seule transaction**, le profil
     (compte `EN_ATTENTE`, numéro vérifié), la fiche (`EN_ATTENTE`, numéro vérifié, NINEA, RCCM), les activités, le
     rattachement des deux pièces (usage unique) et le journal `PARTNER_REGISTRATION`
     (`app/api/partner/register/route.ts:173-239`, `M/20261109000004_lot9bis_droits.sql:559-641`). Si l'une de ces
     écritures échoue, le compte de connexion est retiré pour que le numéro puisse se réinscrire (`:241-254`).
   - Le lien de vérification de l'email part (valable 24 heures) ; un échec n'empêche pas l'inscription
     (`app/api/partner/register/route.ts:258-267`).
   - La session est ouverte côté serveur (`app/api/partner/register/route.ts:269-283`).
   - L'écran affiche le badge « En attente de validation », le titre « Dossier reçu », « Votre numéro est vérifié. Notre
     équipe examine votre dossier et vos pièces. », puis soit « Un lien de vérification a été envoyé à {adresse}. Il est
     valable 24 heures. » (ex. « Un lien de vérification a été envoyé à fatou@exemple.sn. Il est valable 24 heures. »),
     soit « Le lien n’a pas pu être envoyé. Renvoyez-le depuis votre profil. ». Liste : « 1. Vérification des pièces, en
     général sous 24 à 48 heures. », « 2. Un SMS vous prévient dès la validation de votre compte. », « 3. Vous créez et
     publiez votre premier événement depuis votre espace. ». Bouton « Ouvrir mon espace partenaire » si la session est
     ouverte, sinon « Aller à la connexion » (`app/partner/register/page.tsx:407-439`).
4. **Messages envoyés.**

   | Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
   |---|---|---|---|---|
   | La nouvelle partenaire | Cloche (in-app), email si l'adresse est vérifiée | Indispensable (`PARTNER_REGISTERED_ACK`) | File d'envoi, dans la transaction de création | Titre « Inscription reçue » ; « Votre demande de compte partenaire « {structure} » est en cours d'examen. » — ex. « Votre demande de compte partenaire « Concert Test Prod » est en cours d'examen. » ; pas de SMS (doublon du code) (`lib/notifications/catalog.ts:1012-1017`, `M/20261103000006_lot6_pros_admin.sql:645-650`, `app/api/partner/register/route.ts:210-213`) |
   | Administrateurs ayant la permission « Consulter les partenaires et leurs contacts » (`partners.read`) | Cloche, push, email | Indispensable (`ADMIN_PARTNER_REGISTERED`) | File d'envoi | Titre « Nouvelle candidature » ; « {structure} demande un compte partenaire. » — ex. « Concert Test Prod demande un compte partenaire. » ; lien `/admin/dashboard` (`lib/notifications/catalog.ts:1198-1203`, `M/20261103000006_lot6_pros_admin.sql:651-655`) |
   | Adresse email saisie | Email (envoi direct) | Indispensable (`EMAIL_VERIFICATION`) | Immédiat | Objet « Vérifiez votre adresse email — Event Village », bouton « Vérifier mon adresse » (`lib/notifications/catalog.ts:1822-1828`) ; détail dans 02 (02.13) |

5. **Ce que voient les autres rôles.** Le tableau de bord d'administration se recharge de lui-même : une nouvelle fiche
   écrit un signal `PARTNER_REGISTERED` (`M/20261102000006_lot5_temps_reel.sql:459-469`,
   `app/admin/dashboard/page.tsx:291-295`) ; la candidature apparaît dans l'onglet « En attente » (03.5).
6. **Refus.**
   - Code faux : « Code de vérification incorrect ou expiré. » ; expiré : « Le code a expiré. Demandez-en un nouveau. » ;
     trop d'essais : « Trop de tentatives infructueuses. Veuillez demander un nouveau code. » ; trop de vérifications pour
     ce numéro : « Trop de tentatives de vérification pour ce numéro. Réessayez plus tard. »
     (`lib/auth/otp-store.ts:105-113`, `app/api/partner/register/route.ts:95-97`, `:161-166`). Bandeau « Code non
     accepté » (`app/partner/register/page.tsx:453-455`).
   - Pièces consommées ou expirées entre-temps : « Pièces justificatives déjà utilisées ou expirées : déposez-les à
     nouveau. » ; numéro pris entre-temps : message de compte existant ; dans les deux cas l'écran revient au formulaire
     (`app/api/partner/register/route.ts:187-194`, `:248-252`, `app/partner/register/page.tsx:283-292`).
   - Échec technique : « Inscription momentanément impossible. Réessayez. » ; rôle non posé : « Erreur lors de la
     configuration du compte partenaire. » (`app/api/partner/register/route.ts:202-208`, `:242-245`).
   - Renvoi du code : passe par `POST /api/auth/send-otp` (objet inscription) ; succès « Nouveau code envoyé par SMS.
     L’ancien ne fonctionne plus. » ; refus : texte du serveur, ou « Nouveau code non envoyé (erreur {code}). Réessayez
     plus tard. » (`app/partner/register/page.tsx:309-335`). Sur un refus pour quota, l'écran lit un champ que la route
     ne renvoie pas : le décompte n'est pas appliqué (constat W3-09, même cause que W2-01).
   - Page perdue (rechargée) avant la saisie du code : « Le dossier est à envoyer de nouveau : un nouveau code vous sera
     adressé. » (`app/partner/register/page.tsx:268-272`).
7. **Preuves et essai.** Fichiers cités. Recette : essai 9 (`docs/recette-billetterie.md:460-476`).

## 03.4 Partenaire en attente : ce qu'elle voit et ce qu'elle peut faire

1. **Qui, où.** Partenaire dont la fiche est `EN_ATTENTE` (compte `EN_ATTENTE`), connectée. Elle peut se connecter : la
   connexion ne refuse que les comptes suspendus (`components/auth/LoginForm.tsx:279-286`). Après connexion, elle arrive
   sur `/partner/dashboard` (`middleware.ts:210-214`).
2. **Ce qu'il saisit.** Rien d'obligatoire.
3. **Ce que fait le système.**
   - Seules `/partner`, `/partner/dashboard` et `/partner/profile` restent ouvertes ; toute autre page de l'espace
     ramène au tableau de bord (`app/partner/layout.tsx:13-17`, `:55-57`).
   - Bandeau « Compte en cours de vérification » : « Vos pièces sont vérifiées par l’équipe Event Village. Vous recevrez
     un SMS dès la validation de votre compte ; vous pourrez alors créer et publier vos événements. En attendant, votre
     profil reste modifiable. », bouton « Voir mon profil » (`app/partner/dashboard/page.tsx:452-462`).
   - **Écart** : la page profil s'ouvre (lecture admise), mais « Enregistrer » est refusé par le serveur, qui exige un
     compte `ACTIF` : bandeau « Profil non enregistré » avec « Votre compte n'est pas actif. Contactez le support. »
     (`app/api/partner/profile/route.ts:136-139`, `lib/auth/session.ts:51-62`, `app/partner/profile/page.tsx:339-343`).
     Le bandeau du tableau de bord et l'attendu de l'essai 9 (« le profil reste modifiable ») sont donc faux : constat
     W3-01. Même refus pour le dépôt du logo (`app/api/partner/upload/route.ts:21`).
   - La période d'essai ne démarre pas tant que la fiche n'est pas validée (03.12).
4. **Messages envoyés.** Aucun.
5. **Ce que voient les autres rôles.** L'administration voit le dossier dans « En attente » (03.5).
6. **Refus.** Créer un événement par l'adresse directe : la page ramène au tableau de bord ; le serveur refuse de toute
   façon : « Votre profil d’organisateur doit être validé avant de créer un événement. »
   (`app/api/partner/events/route.ts:87-92`). Changer elle-même le statut de sa fiche par l'accès direct aux données :
   refusé depuis le lot 9 ter (`M/20261110000001_lot9ter_rls.sql:8-9`, `:35`).
7. **Preuves et essai.** Fichiers cités. Recette : essais 9 et 80 (`docs/recette-billetterie.md:460-476`, `:1722-1745`).

## 03.5 Administration : la file des candidatures et la fiche « Dossier du partenaire »

1. **Qui, où.** ADMIN ou SUPERADMIN. `/admin/dashboard`, section « Candidatures des partenaires » : « Validez ou refusez
   les organisateurs, restaurants et gestionnaires de salles après examen de leur dossier. »
   (`app/admin/dashboard/page.tsx:596-597`). Carte « Partenaires à valider » dans « À traiter » (`:534`). Onglets « En
   attente », « Validés », « Refusés », « Tous » (`:129`, `:405-410`) : **aucun onglet « Suspendus »**, une partenaire
   suspendue ne se voit que dans « Tous » (constat W3-10). Depuis `/admin/users`, le lien « Voir la fiche partenaire »
   ouvre `/admin/dashboard?partenaires=ALL&dossier={id}` (`app/admin/users/page.tsx:504-511`).
2. **Ce qu'il saisit.** Rien. Bouton « Dossier » sur chaque ligne (`app/admin/dashboard/page.tsx:413-416`).
3. **Ce que fait le système.** La liste est lue avec la permission « Consulter les partenaires et leurs contacts »
   (`app/api/admin/partners/route.ts:17`). La fenêtre « Dossier du partenaire » montre : badge de statut et activités ;
   pour un dossier refusé, « Motif du refus » avec le motif (ou « Aucun motif enregistré. ») et « Le partenaire a déjà
   complété son dossier une fois. » ou « Le partenaire peut compléter son dossier une fois depuis son tableau de bord. » ;
   « Structure » (Raison sociale, Nom commercial, Ville, Adresse, NINEA, RCCM, « Non renseigné » si vide) ; « Responsable
   du compte » (Nom, téléphone avec « Numéro vérifié » ou « Numéro non vérifié », Email) ; « Présentation de l’activité » ;
   « Pièces justificatives » (« Pièce d’identité », « NINEA ou RCCM », ou « Absente »)
   (`app/admin/dashboard/page.tsx:662-850`). Une pièce s'ouvre par un lien signé valable 5 minutes
   (`app/api/partner/documents/signed-url/route.ts:24-37`).
   Boutons selon le statut : « Valider la candidature » et « Refuser » (dossier en attente, permission « Valider les
   partenaires ») ; « Suspendre » (validé, permission « Suspendre les partenaires ») ; « Réactiver » (suspendu, permission
   « Valider les partenaires ») ; « Fermer » (`app/admin/dashboard/page.tsx:165-166`, `:666-690`).
4. **Messages envoyés.** Aucun.
5. **Ce que voient les autres rôles.** Rien.
6. **Refus.** Sans la permission de lecture : « Action non autorisée : votre compte n’a pas la permission « Consulter
   les partenaires et leurs contacts ». » (`lib/admin/permission-labels.ts:11`, `:33-35`). Identifiant de lien inconnu :
   « Ce partenaire n’apparaît pas dans la liste affichée. Choisissez l’onglet « Tous » puis ouvrez son dossier. »
   (`app/admin/dashboard/page.tsx:401`).
7. **Preuves et essai.** Fichiers cités. Recette : essai 10 (`docs/recette-billetterie.md:478-492`).

## 03.6 Administration : valider une candidature

1. **Qui, où.** ADMIN avec « Valider les partenaires » (`partners.validate`), ou SUPERADMIN. `/admin/dashboard`, bouton
   « Valider » sur la ligne ou « Valider la candidature » dans la fiche ; fenêtre « Valider la candidature ? » : « « {structure} »
   pourra créer des événements et vendre des billets. Le responsable est prévenu par SMS. », bouton « Valider la
   candidature » (`app/admin/dashboard/page.tsx:417-421`, `:864-876`).
2. **Ce qu'il saisit.** Rien (aucun motif).
3. **Ce que fait le système.** `PATCH /api/admin/partners/{id}/status` avec `VALIDE` (`app/admin/dashboard/page.tsx:322-336`,
   `app/api/admin/partners/[id]/status/route.ts:66-82`). En une transaction : compte `ACTIF`, fiche `VALIDE`
   (« vérifiée »), journal `PARTNER_STATUS_SET` ; l'avis part par le déclencheur des statuts
   (`M/20261109000006_lot9bis_argent.sql:824-827`, `:838-852`, `:916-925`, `M/20261103000006_lot6_pros_admin.sql:663-664`).
   Toast « Le partenaire « {structure} » a été validé avec succès. » (`lib/messages/toast-messages.ts:9-10`).
4. **Messages envoyés.**

   | Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
   |---|---|---|---|---|
   | La partenaire | Cloche, SMS, email si vérifié | Indispensable (`PARTNER_VALIDATED`) | File d'envoi | Cloche : « Compte partenaire validé » ; « Votre compte partenaire « {structure} » est validé. Vous pouvez créer et publier vos événements. » ; SMS : « Event Village : votre compte partenaire {structure} est validé. Connectez-vous : {adresse}/login » — ex. « Event Village : votre compte partenaire Concert Test Prod est validé. Connectez-vous : https://app.exemple.sn/login » (115 caractères avec cette adresse fictive : 70 + nom tronqué à 30 + lien ; 1 segment) (`lib/notifications/catalog.ts:1018-1024`) |

5. **Ce que voient les autres rôles.** La ligne quitte « En attente » (rechargement après l'action,
   `app/admin/dashboard/page.tsx:333-335`). La partenaire, au prochain chargement, voit son espace complet ; à sa
   première visite du tableau de bord, l'essai démarre (03.12).
6. **Refus.** Fiche déjà validée : « Le partenaire est déjà dans ce statut. » ; dossier refusé : « Un dossier refusé doit
   d’abord être complété par le partenaire : il revient alors en attente de validation. » ; sans permission : « Action non
   autorisée : votre compte n’a pas la permission « Valider les partenaires ». » ; compte de l'auteur non actif ou non
   admin : « Action réservée aux administrateurs. » ; panne : « Mise à jour du partenaire momentanément impossible. »
   (`M/20261109000006_lot9bis_argent.sql:799-827`, `app/api/admin/partners/[id]/status/route.ts:73-96`).
7. **Preuves et essai.** Fichiers cités. Recette : essai 10 (`docs/recette-billetterie.md:478-492`).

## 03.7 Administration : refuser une candidature avec un motif

1. **Qui, où.** ADMIN avec « Valider les partenaires », ou SUPERADMIN. Bouton « Refuser » (ligne ou fiche) ; fenêtre
   « Refuser la candidature » : « « {structure} » sera prévenu par SMS avec votre motif. », champ « Motif du refus », aide
   « Au moins 3 caractères. Par exemple : NINEA manquant ou illisible, activité non éligible. », bouton « Refuser la
   candidature » (`app/admin/dashboard/page.tsx:422-426`, `:878-892`).
2. **Ce qu'il saisit.** Motif obligatoire, 3 à 500 caractères à l'écran (le serveur admet 1 000) ; trop court : « Le motif
   doit contenir au moins 3 caractères. » (`components/ui/ReasonDialog.tsx:9`, `:50-51`, `:64-65`,
   `M/20261109000006_lot9bis_argent.sql:828-835`).
3. **Ce que fait le système.** Fiche `REJETE` avec le motif, compte remis `ACTIF` (la personne peut se connecter et voit
   son tableau de bord), journal ; seul un dossier `EN_ATTENTE` peut être refusé
   (`M/20261109000006_lot9bis_argent.sql:816-819`, `:838-852`). Toast « La demande du partenaire « {structure} » a été
   refusée. » (`lib/messages/toast-messages.ts:11-12`).
4. **Messages envoyés.**

   | Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
   |---|---|---|---|---|
   | La partenaire | Cloche, SMS, email si vérifié | Indispensable (`PARTNER_REJECTED`) | File d'envoi | Cloche : « Demande refusée » ; « Votre demande de compte partenaire n'est pas acceptée. Motif : {motif}. Vous pouvez compléter votre dossier une fois depuis votre tableau de bord. » ; SMS : « Event Village : votre demande de compte partenaire n'est pas acceptée. Motif : {motif tronqué à 60}. » — ex. « Event Village : votre demande de compte partenaire n'est pas acceptée. Motif : NINEA illisible, merci de déposer un document lisible. » (133 caractères, 1 segment ; au plus 140) (`lib/notifications/catalog.ts:1025-1035`, `M/20261103000006_lot6_pros_admin.sql:667-669`) |

   Le SMS coupe un motif long par « ... » : la fenêtre dit « prévenu par SMS avec votre motif » (constat W3-12, mineur).
5. **Ce que voient les autres rôles.** La partenaire voit au tableau de bord le bandeau « Demande de compte partenaire
   refusée » : « Motif : {motif} Vous pouvez compléter votre dossier une fois : il repasse alors en vérification. » et le
   bouton « Compléter mon dossier » (`app/partner/dashboard/page.tsx:464-476`). Sans motif enregistré : « Aucun motif n’a
   été précisé. » (`:471`).
6. **Refus.** Dossier non en attente : « Seul un dossier en attente peut être refusé. Pour un partenaire validé,
   utilisez la suspension. » ; motif absent ou trop court : « Indiquez le motif (3 caractères au moins). » ; motif trop long :
   « Le motif est limité à 1 000 caractères. » (`M/20261109000006_lot9bis_argent.sql:816-835`). L'erreur s'affiche dans la
   fenêtre (`app/admin/dashboard/page.tsx:338-351`).
7. **Preuves et essai.** Fichiers cités. Recette : aucun essai dédié (le refus d'un événement est l'essai 12, voir 04).

## 03.8 Partenaire refusée : compléter son dossier (une seule fois)

1. **Qui, où.** Partenaire `REJETE` n'ayant jamais complété son dossier. `/partner/dashboard`, bouton « Compléter mon
   dossier » du bandeau de refus (`app/partner/dashboard/page.tsx:278`, `:466-469`). Fenêtre « Compléter mon dossier »,
   sous-titre « Une seule fois : votre dossier repasse en vérification. », texte « Déposez de nouveau vos deux pièces, en
   tenant compte du motif du refus. PDF, JPEG, PNG ou WebP, 10 Mo au plus. Après cet envoi, le dossier ne pourra plus être
   complété ici. », boutons « Annuler » et « Envoyer mon dossier » (`:214-243`).
2. **Ce qu'il saisit.** « Pièce d’identité du gérant » et « Document de l’entreprise » (obligatoires, mêmes aides et
   erreurs qu'à l'inscription) ; « NINEA (facultatif) » et « RCCM (facultatif) », 40 caractères au plus : « Le NINEA fait
   40 caractères au plus. », « Le RCCM fait 40 caractères au plus. » (`app/partner/dashboard/page.tsx:154-163`,
   `:234-241`). Un NINEA ou un RCCM laissé vide garde l'ancienne valeur (`M/20261109000004_lot9bis_droits.sql:700`).
3. **Ce que fait le système.** Dépôt des deux pièces (« Envoi de la pièce d’identité… », « Envoi du document de
   l’entreprise… »), puis « Envoi du dossier… » vers `POST /api/partner/dossier/complete` (`app/partner/dashboard/page.tsx:166-175`).
   En une transaction : pièces rattachées et remplacées, fiche `EN_ATTENTE`, date du complément posée, compte
   `EN_ATTENTE`, motif du refus gardé, journal `PARTNER_DOSSIER_RESUBMITTED`, avis aux administrateurs
   (`M/20261109000004_lot9bis_droits.sql:647-722`). Toast « Dossier envoyé : il est de nouveau en cours de
   vérification. » puis rechargement (`app/api/partner/dossier/complete/route.ts:83`, `app/partner/dashboard/page.tsx:670-677`).
   La partenaire retombe dans la situation 03.4.
4. **Messages envoyés.**

   | Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
   |---|---|---|---|---|
   | Administrateurs avec `partners.read` | Cloche, push, email | Indispensable (`ADMIN_PARTNER_RESUBMITTED`) | File d'envoi | Titre « Dossier complété » ; « {structure} a complété son dossier refusé : il attend un nouvel examen. » — ex. « Concert Test Prod a complété son dossier refusé : il attend un nouvel examen. » (`lib/notifications/catalog.ts:1391-1396`, `M/20261109000004_lot9bis_droits.sql:710-714`) |
   | La partenaire | — | — | — | Aucun avis : un retour en attente n'en déclenche pas (`M/20261103000006_lot6_pros_admin.sql:673-674`) |

5. **Ce que voient les autres rôles.** Le dossier revient dans l'onglet « En attente » au rechargement. Aucun signal en
   direct n'est écrit pour un complément (le signal n'existe qu'à la création d'une fiche) : la file ne se recharge pas
   d'elle-même, seule la cloche prévient (`M/20261102000006_lot5_temps_reel.sql:477-479` ; constat W3-10).
6. **Refus.** Complément déjà fait : « Votre dossier a déjà été complété une fois. Contactez le support. » ; dossier non
   refusé : « Seul un dossier refusé peut être complété. » ; pièces consommées ou expirées : « Pièces justificatives déjà
   utilisées ou expirées : déposez-les à nouveau. » ; pièce manquante côté serveur : « Déposez la pièce d’identité et le
   document de l’entreprise. » ; panne : « Envoi du dossier momentanément impossible. Réessayez. » ; repli de l'écran :
   « Dossier non envoyé. Réessayez. » sous le titre « Dossier non envoyé » (`M/20261109000004_lot9bis_droits.sql:682-686`,
   `:715-717`, `app/api/partner/dossier/complete/route.ts:11-17`, `app/partner/dashboard/page.tsx:174-177`, `:244-247`).
7. **Preuves et essai.** Fichiers cités. Recette : aucun essai dédié.

## 03.9 Second refus après un complément

1. **Qui, où.** Administrateur, comme en 03.7, sur un dossier revenu en attente après complément.
2. **Ce qu'il saisit.** Un motif.
3. **Ce que fait le système.** Même refus (03.7). La date du complément reste posée : le bouton « Compléter mon dossier »
   n'est plus proposé (`app/partner/dashboard/page.tsx:278`). Le bandeau dit « Votre dossier a déjà été complété une fois.
   Contactez le support pour la suite. » et propose « Contacter le support » (lien email vers l'adresse de support du
   serveur) si elle est configurée (`:469`, `:474`, `app/api/partner/dashboard/route.ts:45-47`). L'administration lit
   « Le partenaire a déjà complété son dossier une fois. » (`app/admin/dashboard/page.tsx:703-705`).
4. **Messages envoyés.** Le même `PARTNER_REJECTED` que 03.7, dont la cloche et l'email disent encore « Vous pouvez
   compléter votre dossier une fois depuis votre tableau de bord. », ce qui n'est plus possible (constat W3-02)
   (`lib/notifications/catalog.ts:1029-1032`).
5. **Ce que voient les autres rôles.** Comme 03.7.
6. **Refus.** Toute nouvelle validation est impossible : « Un dossier refusé doit d’abord être complété par le partenaire :
   il revient alors en attente de validation. » (`M/20261109000006_lot9bis_argent.sql:824-827`). Aucun écran ne permet de
   rouvrir le dossier : seule la voie « support » reste (NON VÉRIFIÉ : aucune procédure hors code trouvée).
7. **Preuves et essai.** Fichiers cités.

## 03.10 Administration : suspendre une partenaire (cascade sur ses événements, sessions, fonds)

1. **Qui, où.** ADMIN avec « Suspendre les partenaires » (`partners.suspend`), ou SUPERADMIN. Fiche « Dossier du
   partenaire » d'une partenaire `VALIDE`, bouton « Suspendre » (`app/admin/dashboard/page.tsx:671-675`). Depuis
   `/admin/users`, la ligne d'un partenaire n'a pas de bouton « Suspendre » : « Statut géré depuis la fiche partenaire »,
   et la route refuse « Ce compte est celui d’un partenaire : suspendez-le ou réactivez-le depuis sa fiche partenaire, avec
   un motif. » (`app/admin/users/page.tsx:504-511`, `app/api/admin/users/route.ts:253`, `:356-371`).
   Fenêtre « Suspendre le partenaire » : « « {structure} » ne pourra plus vendre : ses événements en ligne sont suspendus et
   ses fonds sont gelés jusqu’à la réactivation. Il est prévenu avec votre motif. », champ « Motif de la suspension », aide
   « Au moins 3 caractères. Ce motif est communiqué au partenaire et enregistré au journal. », bouton « Suspendre le
   partenaire » (`components/admin/PartnerStatusDialog.tsx:55-62`).
2. **Ce qu'il saisit.** Motif obligatoire, 3 à 1 000 caractères (`components/admin/PartnerStatusDialog.tsx:40-42`,
   `M/20261109000006_lot9bis_argent.sql:828-835`).
3. **Ce que fait le système.** En une transaction (`M/20261109000006_lot9bis_argent.sql:772-934`) :
   - compte `SUSPENDU`, fiche `SUSPENDU` avec le motif (`:838-852`) ;
   - **toutes les sessions** de la personne sont fermées (`:855-857`) : elle est déconnectée partout et ne peut plus se
     reconnecter (« Votre compte est suspendu. Veuillez contacter le support. », `components/auth/LoginForm.tsx:279-286`) ;
   - **cascade** : chaque événement `PUBLIE` de la partenaire passe `SUSPENDU` avec le motif « Organisateur suspendu »
     (acteur ADMIN), et une trace est gardée pour la réactivation (`:861-874`). Les événements en brouillon, en attente,
     validés, terminés ou annulés ne bougent pas ;
   - journal `PARTNER_STATUS_SET` avec la liste des événements suspendus (`:916-925`).
   - **Fonds** : le compte suspendu ne peut plus rien retirer (« Compte inactif. », `M/20261110000005_lot9ter_argent.sql:349-351`) ;
     en plus, l'argent déjà disponible d'un événement suspendu est « gelé » (03.18). Avec le délai de garde par défaut,
     l'argent d'un événement n'est disponible que 48 h après sa fin (`M/20261101000002_lot3_reglages.sql:67-68`,
     `M/20261101000004_lot3_grand_livre.sql:107-133`) : pour un événement suspendu avant sa fin, rien n'est encore
     disponible, donc rien n'apparaît comme « gelé ».
   - Toast « {structure} est suspendu. Événements suspendus avec le compte : {n}. » — ex. « Concert Test Prod est suspendu.
     Événements suspendus avec le compte : 1. » (`app/admin/dashboard/page.tsx:376-381`).
4. **Messages envoyés.**

   | Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
   |---|---|---|---|---|
   | La partenaire | Cloche, SMS, email si vérifié | Indispensable, envoyé même au compte suspendu (`PARTNER_SUSPENDED`) | File d'envoi | Cloche : « Compte suspendu » ; « Votre compte partenaire est suspendu. Motif : {motif}. Contactez le support. » ; SMS : « Event Village : votre compte partenaire est suspendu. Motif : {motif tronqué à 60}. Contactez le support. » — ex. « Event Village : votre compte partenaire est suspendu. Motif : Signalements de fraude en cours d'examen. Contactez le support. » (125 caractères, 1 segment ; au plus 145) (`lib/notifications/catalog.ts:1036-1042`, `M/20261103000006_lot6_pros_admin.sql:670-672`) |
   | La partenaire, par événement | — | — | — | Aucun avis « événement suspendu » par événement : la cascade les supprime (`M/20261109000009_lot9bis_messages.sql:55-57`, `:171-176`) |
   | Porteurs de billets de chaque événement suspendu | Cloche, push, email | Optionnel, sujet « Mises à jour des événements » (`EVENT_SUSPENDED_HOLDER`) | File d'envoi | « Événement suspendu » ; « « {titre} » est suspendu pour le moment. Vos billets restent valables, vous serez prévenu de la suite. » (`lib/notifications/catalog.ts:811-816`) ; voir 04 et 10 |
   | Contrôleurs affectés | Cloche, email | Indispensable (`CONTROLLER_EVENT_STATUS`) | File d'envoi | « Événement suspendu » ; « « {titre} » est suspendu : le contrôle d'accès est fermé jusqu'à nouvel avis. » (`lib/notifications/catalog.ts:1541-1548`) |

5. **Ce que voient les autres rôles.** Les événements suspendus quittent Explorer et ne sont plus en vente (voir 04). La
   partenaire, déconnectée, ne voit ni sa cloche ni le bandeau « Compte partenaire suspendu » de son tableau de bord
   (« Motif : {motif}. Vos événements en ligne sont suspendus et vos fonds sont gelés jusqu’à la réactivation du compte.
   Contactez le support Event Village. », `app/partner/dashboard/page.tsx:477-482`) : ce bandeau n'est jamais visible
   tant qu'elle est suspendue (constat W3-04). Seuls le SMS et l'email lui parviennent.
6. **Refus.** Partenaire non validée : « Seul un partenaire validé peut être suspendu. » ; sans permission : « Action non
   autorisée : votre compte n’a pas la permission « Suspendre les partenaires ». » ; motif : comme 03.7 ; échec affiché
   dans la fenêtre, repli « Le changement de statut a échoué. Réessayez dans un instant. »
   (`M/20261109000006_lot9bis_argent.sql:820-823`, `app/api/admin/partners/[id]/status/route.ts:73-77`,
   `components/admin/PartnerStatusDialog.tsx:98-101`).
7. **Preuves et essai.** Fichiers cités. Recette : essai 55 (`docs/recette-billetterie.md:1256-1270`).

## 03.11 Administration : réactiver une partenaire suspendue

1. **Qui, où.** ADMIN avec « Valider les partenaires » (et non « Suspendre »), ou SUPERADMIN. Fiche d'une partenaire
   `SUSPENDU`, bouton « Réactiver » (`app/admin/dashboard/page.tsx:676-680`, `app/api/admin/partners/[id]/status/route.ts:73`).
   Fenêtre « Réactiver le partenaire » : « « {structure} » retrouve son compte. Seuls les événements suspendus avec le
   compte reviennent en ligne ; un événement suspendu pour une autre raison, ou terminé entre-temps, reste suspendu. »,
   champ « Motif de la réactivation », aide « Au moins 3 caractères. Ce motif est communiqué au partenaire et enregistré au
   journal. », bouton « Réactiver le partenaire » (`components/admin/PartnerStatusDialog.tsx:63-69`).
2. **Ce qu'il saisit.** Motif obligatoire, 3 à 1 000 caractères (`M/20261109000006_lot9bis_argent.sql:828-832`).
3. **Ce que fait le système.** Compte `ACTIF`, fiche `VALIDE`, motif de suspension effacé
   (`M/20261109000006_lot9bis_argent.sql:838-852`). Pour chaque événement suspendu par la cascade : s'il est resté
   suspendu sans autre changement depuis **et** que sa fin n'est pas passée, il revient `PUBLIE` (« Organisateur
   réactivé ») ; sinon il reste suspendu (fini entre-temps, ou modifié par ailleurs) (`:875-913`). Un événement resté
   suspendu et fini se clôt par l'administration (voir 04). Les sessions ne sont pas rouvertes : la partenaire se
   reconnecte. Toast « {structure} est réactivé. Événements remis en ligne : {n}. » suivi, s'il y a lieu, de « Restés
   suspendus : {m}. » (`app/admin/dashboard/page.tsx:382-384`).
4. **Messages envoyés.**

   | Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
   |---|---|---|---|---|
   | La partenaire | Cloche, SMS, email si vérifié | Indispensable (`PARTNER_REACTIVATED`) | File d'envoi | Cloche : « Compte réactivé » ; « Votre compte partenaire est réactivé. Vous pouvez de nouveau publier vos événements. » ; SMS : « Event Village : votre compte partenaire est réactivé. Connectez-vous : {adresse}/login » — ex. « Event Village : votre compte partenaire est réactivé. Connectez-vous : https://app.exemple.sn/login » (99 caractères avec cette adresse fictive, 1 segment) (`lib/notifications/catalog.ts:1043-1049`). **Le motif saisi n'y figure pas**, contrairement à ce que dit la fenêtre (constat W3-03) |
   | Porteurs des événements remis en ligne | Cloche, push, email | Optionnel (`EVENT_REACTIVATED_HOLDER`) | File d'envoi | « Événement de nouveau en ligne » ; « « {titre} » reprend comme prévu. Vos billets restent valables. » (`lib/notifications/catalog.ts:817-821`) |
   | Contrôleurs affectés | Cloche, email | Indispensable (`CONTROLLER_EVENT_STATUS`) | File d'envoi | « Événement de nouveau en ligne » ; « « {titre} » reprend : votre affectation est maintenue. » (`lib/notifications/catalog.ts:1549`) |

5. **Ce que voient les autres rôles.** Les événements rétablis réapparaissent dans Explorer (voir 04).
6. **Refus.** Fiche non suspendue : « Le partenaire est déjà dans ce statut. » ou refus de transition
   (`M/20261109000006_lot9bis_argent.sql:810-827`) ; motif : comme 03.7.
7. **Preuves et essai.** Fichiers cités. Recette : essai 55 (`docs/recette-billetterie.md:1256-1270`).

## 03.12 Période d'essai

1. **Qui, où.** Partenaire `VALIDE`, à sa première visite de `/partner/dashboard` après la validation : l'écran appelle
   lui-même `POST /api/partner/activation` (`app/partner/dashboard/page.tsx:280-310`).
2. **Ce qu'il saisit.** Rien.
3. **Ce que fait le système.** La fonction de démarrage, sans effet si l'essai a déjà commencé, pose le début et la fin :
   **60 jours**, ou **90 jours** pour une fiche « fondateur » (`M/20261103000006_lot6_pros_admin.sql:826-905`). Aucun
   écran ne permet de marquer une fiche « fondateur » (NON VÉRIFIÉ : seule la colonne existe, aucune route ne l'écrit dans
   `app/` ni `lib/`). Le tableau de bord affiche ensuite « Période d’essai gratuite en cours » : « {n} jours offerts,
   jusqu’au {date}. » — ex. « 60 jours offerts, jusqu’au mar. 12 janv. 2027. » (`app/partner/dashboard/page.tsx:484-490`).
   **L'essai n'a aucun effet** : aucune règle de l'application ne lit sa date de fin (création, publication et vente
   restent possibles après), et aucun rappel n'est envoyé ; renvoyé au lot 13 (recherche de `trial_ends_at` dans `app/`,
   `lib/` et les migrations : lecture d'affichage seulement, `app/api/partner/subscription/route.ts:97-136`,
   `lib/partner/partner-dashboard.service.ts:478-495` ; `docs/parcours-evenement-complet.md:4223`, point R56).
4. **Messages envoyés.**

   | Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
   |---|---|---|---|---|
   | La partenaire | Cloche, email si vérifié (pas de SMS) | Indispensable (`TRIAL_STARTED`) | File d'envoi, une fois par fiche | « Période d'essai activée » ; « Votre période d'essai de {n} jours commence aujourd'hui. » — ex. « Votre période d'essai de 60 jours commence aujourd'hui. » (`lib/notifications/catalog.ts:1050-1056`, `M/20261103000006_lot6_pros_admin.sql:899-904`) |

5. **Ce que voient les autres rôles.** Rien.
6. **Refus.** Fiche non validée : « Le compte partenaire doit d'abord être validé par un administrateur. » ; échec :
   « Activation de la période d’essai momentanément impossible. », affiché en toast tel quel, sinon « La période d’essai
   n’a pas pu démarrer. Rechargez la page pour réessayer. » ; réseau : « Connexion impossible : la période d’essai
   démarrera à votre prochaine visite. » (`app/api/partner/activation/route.ts:57-72`, `app/partner/dashboard/page.tsx:293-307`).
7. **Preuves et essai.** Fichiers cités. Recette : aucun essai dédié.

## 03.13 Profil partenaire (« Page professionnelle »)

1. **Qui, où.** Partenaire `VALIDE` (ou refusée : compte actif). Menu « Profil partenaire » ou barre du bas « Profil »,
   `/partner/profile` (`components/layout/AppLayout.tsx:159`, `:166`). Titre « Page professionnelle », texte « Votre
   présentation publique sur Event Village : nom, activités, contact et visuels. » (`app/partner/profile/page.tsx:160-161`).
2. **Ce qu'il saisit.**

   | Champ (libellé exact) | Obligatoire | Limites et aide | Preuve |
   |---|---|---|---|
   | « Nom de l’entreprise » (exemple `Event Prestige Dakar`) | oui | 2 à 150 caractères | `app/partner/profile/page.tsx:199-208`, `app/api/partner/profile/route.ts:59` |
   | « Nom commercial (enseigne) » | non | 150 caractères | `app/partner/profile/page.tsx:209-216`, `app/api/partner/profile/route.ts:60` |
   | « Présentation » | non | 2 000 caractères, compteur | `app/partner/profile/page.tsx:218-227`, `app/api/partner/profile/route.ts:61` |
   | « Activités » (« Touchez une activité pour l’ajouter ou la retirer. Une activité au moins. ») | oui | mêmes huit activités qu'à l'inscription | `app/partner/profile/page.tsx:229-264`, `app/api/partner/profile/route.ts:70-72` |
   | « Téléphone » (aide « Numéro mobile sénégalais, affiché aux clients et aux organisateurs. ») | non | mobile sénégalais | `app/partner/profile/page.tsx:272-282`, `app/api/partner/profile/route.ts:178-185` |
   | « Email professionnel » | non | adresse valide, 200 caractères | `app/partner/profile/page.tsx:284-292`, `app/api/partner/profile/route.ts:67` |
   | « Adresse », « Ville » | non | 200 et 2 à 80 caractères | `app/partner/profile/page.tsx:293-310`, `app/api/partner/profile/route.ts:62-63` |
   | « Logo » (« Image carrée de préférence. JPEG, PNG ou WebP, 5 Mo au plus. ») et « Photo de couverture » (« Format paysage. JPEG, PNG ou WebP, 5 Mo au plus. ») | non | image déposée depuis cette page | `app/partner/profile/page.tsx:313-336`, `app/api/partner/profile/route.ts:186-193` |

   Erreurs du serveur : « {Champ} : {détail} », par exemple « Le nom commercial : 150 caractères au plus. », « Le numéro de
   téléphone : numéro mobile sénégalais attendu (par exemple 77 123 45 67). », « Les activités : choisissez au moins une
   activité. », « Le logo : déposez l’image depuis cette page (stockage Event Village). »
   (`app/api/partner/profile/route.ts:27-40`, `:47-80`, `:182`, `:189`).
3. **Ce que fait le système.** « Enregistrer » écrit fiche et activités en une transaction ; toast « Page professionnelle
   enregistrée. » (`app/api/partner/profile/route.ts:194-210`, `app/partner/profile/page.tsx:149`, `:346-350`). Le nom de
   l'entreprise est modifiable librement après validation, sans nouvel examen ; NINEA, RCCM et pièces ne sont ni
   affichés ni modifiables ici (constat W3-13, à décider).
4. **Messages envoyés.** Aucun.
5. **Ce que voient les autres rôles.** Les visiteurs voient le nouveau nom et les visuels sur les pages publiques au
   rechargement (voir 04 et 06).
6. **Refus.** Compte non actif (partenaire en attente) : « Votre compte n'est pas actif. Contactez le support. » (03.4,
   constat W3-01) ; échec : « Le profil n’a pas pu être enregistré. Réessayez dans un instant. » ; affichage : bandeau
   « Profil non enregistré » (`app/api/partner/profile/route.ts:84-90`, `app/partner/profile/page.tsx:339-343`). Lecture
   impossible : « Profil momentanément indisponible. Réessayez. » (`app/api/partner/profile/route.ts:126-129`).
7. **Preuves et essai.** Fichiers cités. Recette : essai 9 (attendu sur le profil, faux pour un compte en attente).

## 03.14 Abonnement

1. **Qui, où.** Partenaire `VALIDE` (ou refusée). Menu « Abonnement », `/partner/subscription`
   (`components/layout/AppLayout.tsx:158`). Titre « Abonnement », texte « Votre offre actuelle et votre période d’essai. »,
   bouton « Actualiser » (`app/partner/subscription/page.tsx:79-94`).
2. **Ce qu'il saisit.** Rien : la page est en lecture seule.
3. **Ce que fait le système.** Affiche, selon le cas :
   - « Période d’essai gratuite en cours » (badge « Fondateur » si c'est le cas, « {n} jours restants »), « Début : {date} »,
     « Fin : {date} », barre « {p} % de la période écoulée · durée totale : {n} jours » (`app/partner/subscription/page.tsx:112-153`) ;
   - « Période d’essai terminée » : « Terminée le {date}. Contactez le support pour choisir une offre. » (`:155-160`) ;
   - « Période d’essai non démarrée » : « Elle démarre automatiquement à votre première visite du tableau de bord, une
     fois votre compte validé. » (`:162-167`) ;
   - « Offre actuelle » : nom et prix de l'offre, ou « Aucune offre attribuée : vous utilisez la plateforme pendant votre
     période d’essai. » (`:169-185`) ;
   - « Offres disponibles » : offres publiées, prix (« {montant} par mois », « par trimestre », « par an », ou « Gratuit »),
     caractéristiques (« Événements illimités », « Jusqu’à {n} événements », « Statistiques avancées »…), puis « Le
     changement d’offre se fait avec l’équipe Event Village : il n’est pas encore possible en ligne. » et « Contacter le
     support » (email prérempli « Changer d’offre ») ; sans offre : « Aucune offre n’est encore publiée »
     (`:187-241`, `app/api/partner/subscription/route.ts:11-24`, `:44-80`).
   Aucun bouton ne permet de souscrire. Le serveur sait encaisser un abonnement (réservé à une fiche validée) et poser son
   échéance, mais aucun écran n'y mène (`lib/payments/payment.service.ts:138-160`, `lib/payments/confirmation.service.ts:101-130`) ;
   renvoyé au lot 13. Aucune limite d'offre (nombre d'événements…) n'est appliquée (recherche de `max_events` : affichage
   seulement).
4. **Messages envoyés.** Aucun depuis cette page. (`SUBSCRIPTION_ACTIVATED`, « Votre pack « {offre} » est activé pour
   {n} jours. », n'est atteignable que par ce paiement sans écran : `lib/notifications/catalog.ts:1057-1062`.)
5. **Ce que voient les autres rôles.** Rien.
6. **Refus.** Non partenaire : « Accès réservé aux partenaires. » ; panne : « Abonnement momentanément indisponible. »
   (`app/api/partner/subscription/route.ts:86-112`).
7. **Preuves et essai.** Fichiers cités. Recette : aucun essai.

## 03.15 Tableau de bord

1. **Qui, où.** Partenaire (tout statut). Menu « Tableau de bord » ou barre du bas « Accueil », `/partner/dashboard`
   (`components/layout/AppLayout.tsx:145`, `:162`). En-tête « Espace partenaire », titre = nom commercial (sinon raison
   sociale), texte « Ventes, entrées et solde de vos événements. », boutons « Actualiser », « Export comptable » (fichier
   CSV) et « Scanner des billets » (`app/partner/dashboard/page.tsx:404-435`).
2. **Ce qu'il saisit.** Rien.
3. **Ce que fait le système.** Une seule lecture serveur (`GET /api/partner/dashboard`) fournit tous les chiffres
   (`app/partner/dashboard/page.tsx:3-15`, `:261-270`). Blocs, dans l'ordre :
   - bandeaux du compte (en attente 03.4, refusé 03.7, suspendu 03.10) et de l'essai (03.12) ;
   - « Première utilisation » : étapes « Compléter votre page publique », « Créer l’événement », « Ajouter l’affiche »,
     « Ajouter une catégorie de billets », « Soumettre à la validation », « Validation par Event Village », « Publier
     l’événement », chacune cochée par le serveur (`components/partner/onboarding/FirstEventSteps.tsx:40-73`) ;
   - quatre indicateurs : « Ventes en ligne » (« Prix des billets vendus en ligne, tous événements. »), « Net partenaire »
     (« Après {montant} de remboursements. »), « Billets vendus » (« {n} entrées validées aux portes. »), « Disponible au
     retrait » (« Déjà versé : {montant}. ») ; puis « Les ventes en espèces au guichet ({montant}) et les invitations
     n’alimentent pas le solde. » et « Voir mes finances » (`app/partner/dashboard/page.tsx:495-538`) ;
   - « Mes événements » : par événement, statut, date et lieu, « Vendus / capacité », « Entrées », « Ventes en ligne »,
     « Net partenaire », et « Clôture » (rapport), rapport PDF et export CSV ; vide : « Aucun événement pour le moment »,
     bouton « Créer un événement » seulement pour une fiche validée (`:315-399`, `:540-582`) ;
   - « Activité récente » (ventes, entrées, retraits) ; « Commandes en direct » seulement si le service des commandes est
     ouvert (`:584-650`).
   En cas d'échec : « Tableau de bord indisponible » sans aucun chiffre, ou « Actualisation impossible » avec les derniers
   chiffres lus (`:437-450`).
4. **Messages envoyés.** Aucun (sauf le démarrage de l'essai, 03.12).
5. **Ce que voient les autres rôles.** Rien.
6. **Refus.** Non partenaire : « Accès réservé aux partenaires. » ; panne : « Tableau de bord momentanément
   indisponible. » (`app/api/partner/dashboard/route.ts:35-38`, `:54`).
7. **Preuves et essai.** Fichiers cités. Recette : essais 39 à 41 pour les rapports (voir 04 et 05).

## 03.16 Statistiques

1. **Qui, où.** Partenaire `VALIDE`. Menu « Statistiques », `/partner/stats` (`components/layout/AppLayout.tsx:155`).
   Titre « Statistiques », sous-titre « Données réelles isolées à votre espace partenaire », bouton « Actualiser »
   (`app/partner/stats/page.tsx:160-178`).
2. **Ce qu'il saisit.** Une période : « Aujourd'hui », « 7 derniers jours », « 30 derniers jours » (par défaut), « Mois en
   cours », « Personnalisé » (deux dates et « Appliquer ») (`app/partner/stats/page.tsx:72-78`, `:104`, `:181-211`).
3. **Ce que fait le système.** Affiche « CA Total », « Billets vendus », « Commandes », « Réservations salles »,
   « Répartition des revenus » (Billetterie, Commandes, Salles), « Commandes par statut », « Événements » (nombre et
   répartition par statut), « Billetterie » (« {n} vendus », « Billets utilisés », « Revenus billetterie »), « Catalogue
   Produits » (`app/partner/stats/page.tsx:245-385`). Les revenus sont le net organisateur des ventes en ligne de la
   période (`app/api/partner/stats/route.ts:62-80`). Limites (constat W3-07) : les événements et leurs billets ne sont
   comptés que pour les événements **créés** dans la période (`app/api/partner/stats/route.ts:42-51`, `:71`) ; les
   statuts d'événement s'affichent en code brut (« PUBLIE », « BROUILLON ») (`app/partner/stats/page.tsx:330-334`) ; les
   blocs commandes, salles et produits s'affichent même si ces services sont fermés.
4. **Messages envoyés.** Aucun.
5. **Ce que voient les autres rôles.** Rien.
6. **Refus.** « Accès refusé. », « Profil introuvable. », panne « Statistiques momentanément indisponibles. »
   (`app/api/partner/stats/route.ts:25`, `:39`, `:131`).
7. **Preuves et essai.** Fichiers cités. Recette : aucun essai.

## 03.17 Calendrier

1. **Qui, où.** Partenaire `VALIDE`. Menu « Calendrier », `/partner/calendar` (`components/layout/AppLayout.tsx:157`).
   Titre « Calendrier Événementiel », texte « Visualisez le planning de vos événements et réservations. », bouton
   « Nouvel événement » (`app/partner/calendar/page.tsx:37-55`).
2. **Ce qu'il saisit.** Une date dans le calendrier (« Sélectionnez une date », « Cliquez sur une date »,
   `components/events/EventCalendar.tsx:142`, `:168`).
3. **Ce que fait le système.** Place chaque événement de la partenaire (tous statuts) à sa date de **début** ; aucune
   réservation n'est lue malgré le texte (`app/partner/calendar/page.tsx:15-33` ; constat W3-14). Échec :
   « Impossible de charger le calendrier des événements. » (`:31`).
4. **Messages envoyés.** Aucun.
5. **Ce que voient les autres rôles.** Rien.
6. **Refus.** « Nouvel événement » mène à la création ; pour une fiche non validée le serveur refuse (03.4).
7. **Preuves et essai.** Fichiers cités.

## 03.18 Finances : les soldes (disponible, en attente, gelé, à compenser, retraits en cours)

1. **Qui, où.** Partenaire `VALIDE` (compte actif). Menu « Finances » ou barre du bas « Finances », `/partner/finance`
   (`components/layout/AppLayout.tsx:154`, `:165`). Titre « Finances », texte « Ventes en ligne de vos événements. Les
   ventes en espèces et les invitations n’alimentent pas ce solde. », boutons « Statistiques de ventes » et « Actualiser »
   (`app/partner/finance/page.tsx:531-551`).
2. **Ce qu'il saisit.** Rien.
3. **Ce que fait le système.** Tout vient de `GET /api/finance/balance?account=ORGANISATEUR`, lu dans le grand livre du
   compte « organisateur » (`app/api/finance/balance/route.ts:13-33`, `M/20261110000007_lot9ter_evenements.sql:154-195`) :

   | Bloc à l'écran | Ce qu'il contient | Preuve |
   |---|---|---|
   | « Disponible au retrait » — « Montant que vous pouvez retirer dès maintenant. » | Somme des écritures échues, **moins le gel**, arrondie au franc inférieur | `app/partner/finance/page.tsx:575-579`, `M/20261110000007_lot9ter_evenements.sql:192` |
   | « Fonds gelés : {montant}. » — « Un de vos événements est suspendu : ses ventes ne sont pas retirables tant qu’il l’est. » (seulement si le gel est positif) | Net déjà échu des événements `SUSPENDU`, calculé à chaque lecture (rien n'est écrit : le dégel est immédiat à la reprise) ; un événement annulé n'est pas gelé | `app/partner/finance/page.tsx:580-584`, `M/20261110000005_lot9ter_argent.sql:269-292` |
   | « En attente » — « Prochaine disponibilité : {date}. », ou « Les ventes deviennent disponibles après la fin de l’événement et le délai de garde. » | Écritures non encore échues. Une vente en ligne est disponible à la **fin de l'événement + 48 h** (réglage « délai de garde », 0 à 720 h ; désactivable) ; la fin par défaut d'un événement sans fin est début + 6 h | `app/partner/finance/page.tsx:586-593`, `M/20261101000004_lot3_grand_livre.sql:107-133`, `M/20261101000002_lot3_reglages.sql:67-68`, `M/20261110000002_lot9ter_reglages.sql:83`, `M/20261109000008_lot9bis_cycle.sql:476-488` |
   | « Retraits en cours » — « Montant réservé sur votre solde, frais compris, pendant l’envoi vers Wave ou Orange Money. » | Montant **brut** des retraits en attente ou en cours d'envoi | `app/partner/finance/page.tsx:595-600`, `M/20261110000007_lot9ter_evenements.sql:177-179` |
   | « À compenser » — « Remboursement à compenser : déduit de vos prochaines ventes. » ou « Aucune somme à compenser. » | Créances restantes (remboursement plus grand que le solde) | `app/partner/finance/page.tsx:602-608`, `M/20261110000007_lot9ter_evenements.sql:180-181` |
   | « Mes retraits » — « Vos 20 dernières demandes. » | Statut (« En attente », « En cours d’envoi », « Versé », « Refusé, montant rendu », « Annulé », ou « Retardé » avec « Retardé : l’équipe Event Village s’en occupe. »), opérateur, numéro masqué, dates, « Motif : {motif} » si refusé, brut, « Versé : {net} · frais : {frais} » | `app/partner/finance/page.tsx:294-305`, `:893-938`, `lib/finance/ledger.ts:60-72`, `:125-156` |
   | « Historique du compte » — « Les 50 dernières écritures, de la plus récente à la plus ancienne. » | « Vente en ligne », « Remboursement d’un billet », « Retrait demandé », « Retrait refusé : montant rendu », « Compensation d’une créance »…, avec l'événement, et « · en attente, disponible le {date} » | `app/partner/finance/page.tsx:265-289`, `:941-990` |

   Le gel ne touche que l'argent **déjà disponible** : avec le délai de garde par défaut, un événement suspendu avant sa
   fin n'a encore rien de disponible, donc « Fonds gelés » ne s'affiche que si le délai de garde est désactivé ou si
   l'événement est suspendu après fin + 48 h (impossible en temps normal : un événement fini passe Terminé, voir 04).
4. **Messages envoyés.** Aucun.
5. **Ce que voient les autres rôles.** L'administration voit le rapprochement dans `/admin/finance` (voir 08).
6. **Refus.** Non partenaire : « Compte organisateur réservé aux partenaires. » ; compte non actif : « Votre compte n'est
   pas actif. Contactez le support. » ; panne : « Solde momentanément indisponible. » ; écran : « Solde indisponible » ou
   « Actualisation impossible » (`app/api/finance/balance/route.ts:14-33`, `app/partner/finance/page.tsx:555-565`).
7. **Preuves et essai.** Fichiers cités. Recette : essais 42 et 70 (`docs/recette-billetterie.md:1026-1041`, `:1525`).

## 03.19 Demander un retrait (devis, code SMS, confirmation)

1. **Qui, où.** Partenaire `VALIDE`, compte actif. `/partner/finance`, bloc « Demander un retrait » : « Wave ou Orange
   Money. Le minimum, les frais et le montant que vous recevrez sont affichés avant l’envoi du code. » ; étapes « Demande »,
   « Code SMS », « Suivi » (`app/partner/finance/page.tsx:614-642`, `:340-344`).
2. **Ce qu'il saisit.**

   | Champ (libellé exact) | Obligatoire | Limites, aide, erreur exacte | Preuve |
   |---|---|---|---|
   | « Recevoir sur » : Wave ou Orange Money | oui | « Choisissez Wave ou Orange Money. » | `app/partner/finance/page.tsx:419`, `:658-698` |
   | « Numéro {Wave ou Orange Money ou Mobile Money} qui reçoit le retrait » (exemple `77 123 45 67`, prérempli avec le numéro du compte, modifiable) | oui | aide « Mobile sénégalais de 9 chiffres. Le code de confirmation part au numéro de votre compte. » ; « Numéro invalide : mobile sénégalais de 9 chiffres commençant par 70, 75, 76, 77 ou 78. » | `app/partner/finance/page.tsx:403-408`, `:420`, `:702-720` |
   | « Montant à retirer (F CFA) » (exemple `Ex : 50000`) | oui | entier ; aide « Disponible : {montant}. Les frais sont déduits du montant versé. » ; « Indiquez un montant entier en francs CFA. », « Le minimum de retrait est de {minimum}. », « Le montant dépasse votre solde disponible au retrait ({montant}). » | `app/partner/finance/page.tsx:421-425`, `:722-740` |

   Avant tout code, la ligne de devis dit : « Minimum de retrait : {minimum}. Frais : {taux} ({frais}). Vous recevrez
   {net}. » — ex. pour 6 000 F : « Minimum de retrait : 5 000 F CFA. Frais : 1 % (60 F CFA). Vous recevrez 5 940 F CFA. » ;
   sous le minimum : « Le minimum de retrait est de 5 000 F CFA. » et le bouton reste inactif
   (`app/partner/finance/page.tsx:742-756`, `:758-770`). Bouton « Recevoir le code de confirmation », ou « Aucun montant
   disponible au retrait » si rien n'est retirable (`:769`).
3. **Ce que fait le système.**
   - **Règles** (une seule fonction, relue à chaque étape) : compte `ACTIF` ; fiche `VALIDE` ; montant entier ≥ minimum
     (réglage, **5 000 F** par défaut, 0 à 10 000 000) ; montant ≤ disponible ; montant ≤ disponible moins le gel ; pas de
     changement de numéro depuis moins de 24 h ; frais = montant × taux (réglage, **1 %** par défaut, 0 à 10 %)
     **arrondis au franc supérieur** ; net = montant − frais (`M/20261110000005_lot9ter_argent.sql:318-405`,
     `M/20261101000002_lot3_reglages.sql:69-70`, `M/20261110000002_lot9ter_reglages.sql:84-85`). Les frais sont payés par
     la partenaire (déduits du versement). Les frais propres de SamirPay sur le versement : voir 08.
   - **Code** (`POST /api/withdrawals/otp`) : le devis est recalculé **avant** tout SMS ; un refus n'envoie rien. Accepté,
     un code d'objet « retrait » valable 10 minutes part **au numéro du compte** (jamais au numéro de versement)
     (`app/api/withdrawals/otp/route.ts:64-134`). Toast « Code de confirmation envoyé par SMS. » ; l'écran affiche
     « Montant demandé », « Vers {opérateur} · +221 {numéro} », « Frais de retrait ({taux}) », « Vous recevrez » (devis du
     serveur), champ « Code de confirmation », aide « Code à 6 chiffres envoyé par SMS au +221 {numéro masqué}. », boutons
     « Confirmer le retrait », « Renvoyer un code », « Modifier la demande » (`app/partner/finance/page.tsx:452-461`, `:773-847`).
   - **Confirmation** (`POST /api/withdrawals/request`, clé anti-doublon) : code vérifié, puis, sous verrou du compte, les
     règles sont relues ; le retrait est créé, **le montant brut est réservé tout de suite** (débit du grand livre), un
     versement Mobile Money au montant net est préparé puis envoyé aussitôt (`app/api/withdrawals/request/route.ts:43-117`,
     `M/20261109000006_lot9bis_argent.sql:649-764`, `lib/payments/withdrawal.service.ts:55-80`). Le virement bancaire est
     fermé par défaut (« Les retraits par virement bancaire ne sont pas ouverts. », `M/20261109000006_lot9bis_argent.sql:681-683`,
     `M/20261101000002_lot3_reglages.sql:71`). Une même clé ne crée jamais deux retraits.
   - Écran « Suivi » : « Retrait versé » (« Le montant net a été envoyé sur votre compte Mobile Money. »), « Retrait refusé
     par l’opérateur » (« Le montant a été rendu à votre solde disponible. Vérifiez le numéro puis refaites une
     demande. ») ou « Retrait en cours de traitement » (« Le montant reste réservé jusqu’à la confirmation de l’opérateur.
     Il ne sera jamais versé deux fois ; suivez son état dans « Mes retraits ». »), avec « Montant demandé », « Frais de
     retrait », « Montant versé » et « Nouvelle demande » (`app/partner/finance/page.tsx:849-889`).
4. **Messages envoyés.**

   | Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
   |---|---|---|---|---|
   | Numéro du compte | SMS | Indispensable (envoi direct `OTP_WITHDRAWAL`, journalisé sans le code) | Immédiat, à « Recevoir le code de confirmation » | « Event Village : votre code de retrait est {code}. Valable 10 minutes. Ne le donnez à personne. » — ex. « Event Village : votre code de retrait est 123456. Valable 10 minutes. Ne le donnez à personne. » (94 caractères, 1 segment) (`lib/notifications/catalog.ts:1691`, `:1805-1806`, `app/api/withdrawals/otp/route.ts:114-119`) |
   | La partenaire | voir 03.21 | | Après l'envoi | Avis du résultat |

5. **Ce que voient les autres rôles.** L'administration voit le versement dans `/admin/finance` (voir 08).
6. **Refus.** Voir 03.20.
7. **Preuves et essai.** Fichiers cités. Recette : essais 42 et 43 (`docs/recette-billetterie.md:1026-1058`).

## 03.20 Retrait refusé avant l'envoi (minimum, solde, gel, verrou de 24 h, compte, quotas)

1. **Qui, où.** Même écran (03.19). Un refus sur le montant s'affiche sous le champ montant ; les autres dans le bandeau
   « Retrait impossible » (`app/partner/finance/page.tsx:316-323`, `:443-458`, `:645-649`).
2. **Ce qu'il saisit.** Comme 03.19.
3. **Ce que fait le système.** Aucun code, aucun SMS, aucune réservation tant que le devis refuse
   (`app/api/withdrawals/otp/route.ts:96-99`).
4. **Messages envoyés.** Aucun.
5. **Ce que voient les autres rôles.** Rien.
6. **Refus (textes exacts du serveur).**

   | Cas | Texte | Preuve |
   |---|---|---|
   | Sous le minimum | « Le minimum de retrait est de {minimum} F CFA. » — ex. « Le minimum de retrait est de 5 000 F CFA. » | `M/20261110000005_lot9ter_argent.sql:357-363` |
   | Solde insuffisant | « Solde disponible insuffisant. » | `:367-371` |
   | Gel (événement suspendu) | « Une partie de vos fonds est gelée : un de vos événements est suspendu. » | `:374-381` |
   | Numéro du compte changé il y a moins de 24 h | « Retrait impossible pendant 24 h après un changement de numéro. Réessayez après le {JJ/MM/AAAA} à {HH:MM}. » — ex. « Retrait impossible pendant 24 h après un changement de numéro. Réessayez après le 14/11/2026 à 15:30. » (24 h fixes après le dernier changement, deux comptes, tous moyens) | `:383-392`, voir `02-comptes.md` (02.11) |
   | Compte non actif (suspendu) | « Compte inactif. » ou, avant même le calcul, « Votre compte n'est pas actif. Contactez le support. » | `:349-351`, `lib/auth/session.ts:56-62` |
   | Fiche non validée | « Aucun compte organisateur validé. » ; non partenaire : « Compte organisateur réservé aux partenaires. » | `M/20261110000005_lot9ter_argent.sql:352-355`, `app/api/withdrawals/otp/route.ts:89-91` |
   | Montant non entier ou frais égaux au montant | « Montant entier en FCFA attendu. », « Montant trop faible après frais. » | `M/20261110000005_lot9ter_argent.sql:340-342`, `:397-400` |
   | Numéro de versement invalide (serveur) | « Choisissez Wave ou Orange Money et un numéro mobile sénégalais (9 chiffres). » | `app/api/withdrawals/request/route.ts:73-79` |
   | Code faux, expiré, trop d'essais | « Code de vérification incorrect ou expiré. », « Le code a expiré. Demandez-en un nouveau. », « Trop de tentatives infructueuses. Veuillez demander un nouveau code. » | `lib/auth/otp-store.ts:105-113`, `app/api/withdrawals/request/route.ts:85-89` |
   | Plus de 10 demandes par heure (chaque demande compte, même refusée) | « Trop de demandes de retrait. Réessayez dans {n} min. » ; garde indisponible : « Retrait momentanément indisponible. » | `app/api/withdrawals/request/route.ts:50-58`, `lib/env.ts:93` |
   | Trop de SMS de code | textes communs du garde SMS (voir 02 et 13) | `app/api/withdrawals/otp/route.ts:103-104` |
   | SMS non parti | « Impossible d’envoyer le code par SMS. Réessayez. » | `app/api/withdrawals/otp/route.ts:120-123` |
   | Réseau coupé | « Connexion impossible : le code n’a pas pu être envoyé. Réessayez. » ; pendant la confirmation : « Connexion interrompue : la demande n’a peut-être pas abouti. Réessayez, elle ne sera pas dupliquée. » | `app/partner/finance/page.tsx:463`, `:514` |

7. **Preuves et essai.** Fichiers cités. Recette : essai 43 (`docs/recette-billetterie.md:1043-1058`), essai 67 pour le
   changement de numéro.

## 03.21 Suivi d'un retrait : versé, refusé par l'opérateur, en vérification, retardé

1. **Qui, où.** Partenaire, `/partner/finance`, « Mes retraits » ; cloche.
2. **Ce qu'il saisit.** Rien.
3. **Ce que fait le système.** L'issue du versement change le statut affiché : versé (« Versé ») ; refusé par l'opérateur
   (« Refusé, montant rendu » : le brut revient au solde) ; incertain (le montant reste réservé, jamais relancé sans
   vérification) ; bloqué hors simulation, incertain, ou en attente depuis plus de 30 minutes : badge « Retardé » et
   « Retardé : l’équipe Event Village s’en occupe. » (`lib/finance/ledger.ts:60-72`, `app/partner/finance/page.tsx:294-305`).
   La reprise par l'administration est décrite dans 08.
4. **Messages envoyés.**

   | Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
   |---|---|---|---|---|
   | La partenaire | Cloche, SMS, email si vérifié, push | Indispensable, même compte suspendu (`WITHDRAWAL_PAID`) | File d'envoi, à la confirmation de l'opérateur | « Retrait versé » ; « Votre retrait de {montant} a été versé sur votre compte {opérateur}. » ; SMS « Event Village : votre retrait de 5 940 F CFA a été versé sur votre compte Wave. » (79 caractères, 1 segment) (`lib/notifications/catalog.ts:979-985`, `M/20261109000007_lot9bis_versements.sql:494-502`) |
   | La partenaire | Cloche, SMS, email, push | Indispensable (`WITHDRAWAL_REJECTED`) | File d'envoi | « Retrait refusé » ; « Votre retrait de {montant} a été refusé par l'opérateur. Le montant est revenu sur votre solde. » ; SMS « Event Village : votre retrait de {montant} a été refusé par l'opérateur. Le montant est revenu sur votre solde. » (ex. 113 caractères, 1 segment) (`lib/notifications/catalog.ts:986-992`, `M/20261109000007_lot9bis_versements.sql:523-531`) |
   | Administrateurs avec `refunds.manage` | Cloche, email | Indispensable (`ADMIN_WITHDRAWAL_REJECTED`) | File d'envoi | « Retrait refusé par l'opérateur » ; « Le retrait de {montant} a été refusé ; le montant est revenu sur le solde du bénéficiaire. » (`lib/notifications/catalog.ts:1231-1236`) |
   | La partenaire | Cloche, SMS, push, email | Indispensable (`WITHDRAWAL_UNCERTAIN`) | File d'envoi | « Retrait en vérification » ; « Votre retrait de {montant} est en vérification auprès de l'opérateur. Aucune action n'est nécessaire. » ; SMS « Event Village : votre retrait de 5 940 F CFA est en vérification auprès de l'opérateur. Aucune action de votre part. » (116 caractères) (`lib/notifications/catalog.ts:993-999`) |
   | La partenaire | Cloche, SMS, email, push | Indispensable (`WITHDRAWAL_DELAYED`), un seul par versement | File d'envoi | « Retrait retardé » ; « Votre retrait de {montant} est retardé. L'équipe Event Village s'en occupe : le montant reste réservé et vous serez prévenu du versement. » ; SMS « Event Village : votre retrait de 5 940 F CFA est retardé. L'équipe Event Village s'en occupe, aucune action de votre part. » (122 caractères) (`lib/notifications/catalog.ts:1330-1340`, `M/20261109000007_lot9bis_versements.sql:575-583`) |

   Le lien de ces avis mène à `/partner/finance` pour un retrait organisateur, à `/wallet` pour un retrait de parrainage
   (`lib/notifications/catalog.ts:388`). Avis aux administrateurs (versement incertain, à reprendre) : voir 08 et 10.
5. **Ce que voient les autres rôles.** L'administration : section « Versements à reprendre » de `/admin/finance` (voir 08).
6. **Refus.** Sans objet.
7. **Preuves et essai.** Fichiers cités. Recette : essais 75 et 93 (`docs/recette-billetterie.md:1615-1630`, `:1974-1990`).

## 03.22 « Recettes disponibles » : l'avis de fin de garde

1. **Qui, où.** Partenaire dont un événement est Terminé et dont toutes les ventes en ligne sont devenues disponibles.
2. **Ce qu'il saisit.** Rien.
3. **Ce que fait le système.** La tâche des contrôles quotidiens des notifications cherche les événements terminés depuis
   moins de 30 jours, avec au moins une vente en ligne et plus aucune vente en attente, et prévient une fois par
   événement (au plus 100 par passage) (`M/20261109000009_lot9bis_messages.sql:1341-1361`). Fréquence de la tâche :
   voir `12-taches-planifiees.md`.
4. **Messages envoyés.**

   | Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
   |---|---|---|---|---|
   | La partenaire | Cloche, email si vérifié | Indispensable (`FUNDS_AVAILABLE`), sans montant | Tâche planifiée, une fois par événement | « Recettes disponibles » ; « Les recettes de « {titre} » sont disponibles sur votre solde : vous pouvez demander un retrait. » — ex. « Les recettes de « Concert Test » sont disponibles sur votre solde : vous pouvez demander un retrait. » (`lib/notifications/catalog.ts:1634-1640`) |

5. **Ce que voient les autres rôles.** Rien.
6. **Refus.** Sans objet.
7. **Preuves et essai.** Fichiers cités.

## 03.23 Tableau des états du dossier partenaire et de qui peut les changer

| De | Vers | Qui | Motif | Effets | Avis à la partenaire | Preuve |
|---|---|---|---|---|---|---|
| (aucun) | En attente | La personne, à l'inscription (code SMS vérifié) | — | compte en attente | `PARTNER_REGISTERED_ACK` | `M/20261109000004_lot9bis_droits.sql:559-641` |
| En attente | Validé | ADMIN `partners.validate`, SUPERADMIN | non | compte actif | `PARTNER_VALIDATED` | `M/20261109000006_lot9bis_argent.sql:824-827` |
| En attente | Refusé | ADMIN `partners.validate`, SUPERADMIN | oui (3 à 1 000) | compte actif | `PARTNER_REJECTED` | `:816-819` |
| Refusé | En attente | La partenaire, **une seule fois** (complément) | — | compte en attente | aucun (admins : `ADMIN_PARTNER_RESUBMITTED`) | `M/20261109000004_lot9bis_droits.sql:647-722` |
| Validé | Suspendu | ADMIN `partners.suspend`, SUPERADMIN | oui | compte suspendu, sessions fermées, événements publiés suspendus, retraits impossibles | `PARTNER_SUSPENDED` | `M/20261109000006_lot9bis_argent.sql:820-874` |
| Suspendu | Validé | ADMIN `partners.validate`, SUPERADMIN | oui (non transmis) | compte actif, événements de la cascade rétablis s'ils sont intacts et non finis | `PARTNER_REACTIVATED` | `:875-913` |

Toute autre transition est refusée (`M/20261109000006_lot9bis_argent.sql:814-827`). La partenaire ne peut jamais changer
elle-même le statut de sa fiche (`M/20261110000001_lot9ter_rls.sql:8-9`, `:35` ; essai 80). Un compte partenaire ne se
suspend pas depuis `/admin/users` (03.10).
