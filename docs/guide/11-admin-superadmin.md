# 11. Administration et SUPERADMIN

Ce fichier décrit l’espace d’administration : qui y entre, chaque permission (ce qu’elle ouvre, ce qu’elle bloque),
chaque page du menu, la création d’un compte et d’un ADMIN, l’attribution des permissions, le démarrage du premier
SUPERADMIN, le journal d’audit, et tous les réglages SUPERADMIN avec leur valeur initiale et leurs bornes. Le menu
lui-même (ordre des entrées, barre du bas) est décrit en 01.10 et 01.11.

Source : le code de `main` (`0889df6`). Preuves en `fichier:ligne`, `M/` = `supabase/migrations/` (la dernière
définition d’une fonction fait foi). Textes recopiés tels quels ; exemples remplis avec des données fictives.

## Sommaire

- 11.0 Qui entre dans l’administration
- 11.0 bis Les 16 permissions
- 11.1 Démarrer le premier SUPERADMIN
- 11.2 Créer un compte (contrôleur, client, ADMIN, SUPERADMIN)
- 11.3 Attribuer les permissions d’un ADMIN
- 11.4 Suspendre ou réactiver un compte (hors partenaire)
- 11.5 Supprimer (anonymiser) un compte
- 11.6 à 11.8 Partenaires : valider, refuser, suspendre, réactiver
- 11.9 Événements : file de validation et fiche
- 11.10 Catalogues et services
- 11.11 Finance et rapprochement
- 11.12 Tarification
- 11.13 Réglages de la plateforme (SUPERADMIN) : tableau complet des clés
- 11.14 Parrainage et ambassadeurs
- 11.15 Communications et campagnes
- 11.16 Supervision des notifications et relance
- 11.17 Journal d’audit
- 11.18 Scanner de contrôle de l’admin
- 11.19 Messages reçus par un admin
- 11.20 Ce qu’aucun écran d’administration ne permet

---

## 11.0 Qui entre dans l’administration

Trois verrous successifs :

1. **Le filtre des pages** : `/admin…` et `/api/admin…` exigent le rôle ADMIN ou SUPERADMIN dans la table des rôles ;
   sinon « Cet espace est réservé aux administrateurs. » (page) ou « Accès non autorisé : Rôle Administrateur requis. »
   (route) (`middleware.ts:117`, `:224-229`, `lib/auth/access-errors.ts:8`).
2. **La vérification des routes** `verifyAdminAuth` (`lib/admin/admin-auth.ts:86-269`) :
   - sans session : « Authentification requise pour accéder aux ressources d'administration. » (`:128-135`) ;
   - compte au statut autre qu’actif : « Votre compte n'est pas actif. Contactez le support. » (`:179-188`) ;
   - ni ADMIN ni SUPERADMIN : « Accès restreint aux administrateurs autorisés. », et une ligne
     `UNAUTHORIZED_ACCESS_ATTEMPT` dans le journal (`:190-207`) ;
   - action réservée au SUPERADMIN : « Opération réservée exclusivement au SUPERADMIN. » (`:210-218`) ;
   - permission absente : « Action non autorisée : votre compte n’a pas la permission « {libellé} ». » (code
     `PERMISSION_MISSING`) (`:241-246`, `lib/admin/permission-labels.ts:33-35`). Exemple : « Action non autorisée :
     votre compte n’a pas la permission « Consulter les comptes ». » ;
   - panne de lecture : « Vérification du compte momentanément impossible. » (`:151-170`, `:230-236`).
3. **La base** : les fonctions SQL qui agissent pour un admin appellent `admin_can(acteur, permission)` : vrai pour un
   SUPERADMIN, ou pour un ADMIN qui a la ligne de permission ; jamais lu dans le rôle du profil
   (`M/20261109000004_lot9bis_droits.sql:73-84`).

Le SUPERADMIN a toutes les permissions sans ligne en base (`lib/admin/admin-auth.ts:59-60`, `:223-224`). Un ADMIN
n’a que les permissions cochées pour lui ; à la création, il n’en a aucune (11.2). L’écran masque les boutons selon les
permissions servies par `/api/auth/me` (`app/api/auth/me/route.ts:55-63`,
`components/providers/AuthProvider.tsx:247`), mais le menu ne les lit pas (01.10).

## 11.0 bis Les 16 permissions

Libellés exacts : `lib/admin/permission-labels.ts:8-25`. Liste : `lib/admin/admin-auth.ts:23-42`.

| Permission (libellé écran) | Ce qu’elle ouvre | Sans elle |
|---|---|---|
| `users.read` « Consulter les comptes » | liste de `/admin/users` (`app/api/admin/users/route.ts:55`) ; liste de `/admin/referral` (même route) | Utilisateurs : bandeau rouge avec le refus ; Parrainage : « Aucun utilisateur trouvé. » |
| `users.write` « Gérer les comptes » | boutons « Créer un Compte / Admin », « Suspendre » / « Réactiver », « Supprimer » (`app/admin/users/page.tsx:76`, `:354-363`, `:515-545`) ; routes POST, PATCH, DELETE et anonymisation (`app/api/admin/users/route.ts:114`, `:264`, `:473`, `app/api/admin/users/[id]/anonymize/route.ts:17`) ; RPC du statut (`M/20261109000004_lot9bis_droits.sql`, `admin_user_status_set`) | boutons masqués ; route : refus `PERMISSION_MISSING` |
| `partners.read` « Consulter les partenaires et leurs contacts » | candidatures du tableau de bord (`app/api/admin/partners/route.ts:17`) ; pièces du dossier (`app/api/partner/documents/signed-url/route.ts:75`) ; lien « Voir la fiche partenaire » (`app/admin/users/page.tsx:85`, `:141-166`) ; export des participants avec contacts (`M/20261110000010_lot9ter_pilotage.sql:982-990`) ; avis `ADMIN_PARTNER_REGISTERED`, `ADMIN_PARTNER_RESUBMITTED` | « Candidatures indisponibles » / « Votre compte n’a pas l’autorisation de consulter les partenaires. » ; export avec contacts : « Action non autorisée : votre compte n’a pas la permission « Consulter les partenaires et leurs contacts ». » |
| `partners.validate` « Valider les partenaires » | « Valider », « Refuser », « Valider la candidature », « Réactiver » (`app/admin/dashboard/page.tsx:165`, `:417-426`, `:676-690`) ; route du statut sauf suspension (`app/api/admin/partners/[id]/status/route.ts:73-77`) | boutons masqués |
| `partners.suspend` « Suspendre les partenaires » | « Suspendre » sur la fiche d’un partenaire validé (`app/admin/dashboard/page.tsx:166`, `:671-675`) | bouton masqué |
| `events.read` « Consulter les événements » | `/admin/events` et sa fiche (`app/api/admin/events/route.ts:30`, `app/api/admin/events/[id]/route.ts:18`) ; compteur « Événements à valider » ; onglets de `/admin/services` (`app/api/admin/services/route.ts:15`) ; « Ouvrir le pilotage » et lecture du pilotage d’un événement d’une partenaire (`app/admin/events/[id]/page.tsx:554-558`, `M/20261109000004_lot9bis_droits.sql:135-157`, `lib/auth/event-access.ts:55`) ; lecture de l’équipe et des caisses (`app/api/partner/team/[eventId]/route.ts:25`, `app/api/partner/events/[id]/shifts/route.ts:28`) ; avis `ADMIN_EVENT_*` | listes : refus `PERMISSION_MISSING` ; pilotage : « Action non autorisée : votre compte n’a pas la permission « Consulter les événements ». » (`M/20261109000004_lot9bis_droits.sql:166-181`) |
| `events.write` « Gérer les événements » | boutons de transition et « Annuler l’événement » de la fiche (`app/admin/events/[id]/page.tsx:326`, `:537-551`) ; routes de transition et d’annulation (`app/api/admin/events/[id]/transition/route.ts:25`, `…/cancel/route.ts:26`) ; actions SQL de l’admin (`M/20261109000008_lot9bis_cycle.sql:399`) ; équipe de contrôle d’un événement (invitation, affectation, porte, retrait) (`app/api/partner/team/invite/route.ts:82`, `…/assignments/route.ts:75`, `…/entry-point/route.ts:27`, `…/controller/[controllerId]/route.ts:47`) ; PIN régisseur (`app/api/partner/events/[id]/regisseur-pin/route.ts:37`) ; fermeture d’une caisse par l’admin (`app/api/controller/shifts/close/route.ts:52`) ; droit d’encaisser d’un contrôleur (`M/20261109000004_lot9bis_droits.sql:27-30`) | boutons masqués ; routes : refus `PERMISSION_MISSING` |
| `payments.read` « Consulter les paiements » | `/admin/finance` (rapprochement) (`app/api/admin/finance/reconciliation/route.ts:17`) ; avis `ADMIN_FINANCE_DEBT` | « Rapprochement indisponible » avec le refus |
| `refunds.manage` « Gérer les remboursements » | bloc « Versements à reprendre » : « Renvoyer », « Marquer versé » (`app/api/admin/refunds/route.ts:193`, `app/api/admin/cashouts/[id]/resend/route.ts:22`, `…/mark-paid/route.ts:21`) ; remboursement d’un billet par l’admin à tout moment (`M/20261110000006_lot9ter_equipe_messages.sql:287-289`, `app/api/partner/events/[id]/tickets/[ticketId]/refund/route.ts:44`, `…/tickets/lookup/route.ts:62`, `:97`) ; avis `ADMIN_REFUND_TO_RETRY`, `ADMIN_CASHOUT_*`, `ADMIN_DUPLICATE_PAYMENT`, `ADMIN_WITHDRAWAL_REJECTED` | « Reprise des versements réservée » |
| `referrals.manage` « Gérer le parrainage » | lecture des taux et durées sur `/admin/referral` (`app/api/admin/referral/config/route.ts:18`) | « Taux et durées du parrainage indisponibles » |
| `communications.manage` « Gérer les communications » | `/admin/communications` (`app/api/admin/communications/route.ts:14`, `:39`) | refus affiché dans l’historique et à l’enregistrement |
| `statistics.read` « Consulter les statistiques » | indicateurs du tableau de bord (`app/api/admin/metrics/route.ts:33`) | « Indicateurs indisponibles » |
| `pricing.manage` « Gérer les tarifs » | route POST `/api/admin/pricing` (`app/api/admin/pricing/route.ts:42`) ; **aucun écran ne l’appelle** (`app/admin/pricing/page.tsx:20-43`) | rien de visible |
| `notifications.read` « Consulter les envois de messages » | `/admin/notifications`, détail et compteurs (`app/api/admin/notifications/route.ts:25`, `…/[id]/route.ts:61`, `…/stats/route.ts:32`) ; avis `ADMIN_NOTIFICATION_FAILED`, `ADMIN_SMS_*` | « Accès refusé » / « Vous n'avez pas la permission de consulter les notifications. » |
| `notifications.write` « Relancer les envois de messages » | bouton « Relancer » du détail (`app/api/admin/notifications/[id]/retry/route.ts:23`, `app/admin/notifications/[id]/page.tsx:313-340`) | bouton masqué |
| `shifts.read` « Consulter les écarts de caisse » | route GET `/api/admin/shifts/audit` (`app/api/admin/shifts/audit/route.ts:14`) ; **aucun écran ne l’appelle** (recherche de `admin/shifts/audit` dans `app` et `components` sans résultat) | rien de visible |

Réservé au SUPERADMIN quelle que soit la permission : journal d’audit (`app/api/admin/audit/route.ts:18`) ;
attribution des permissions (`app/api/admin/permissions/route.ts:48`) ; modification des réglages
(`app/api/admin/finance-settings/route.ts:58`, `M/20261110000002_lot9ter_reglages.sql:131-136`) ; création d’un ADMIN
ou d’un SUPERADMIN, ajout ou retrait du rôle ADMIN, statut d’un compte ADMIN (`app/api/admin/users/route.ts:136-140`,
`:338-361`) ; statut Ambassadeur (`app/api/admin/users/route.ts:286-301`) ; « Constater non versé »
(`app/api/admin/cashouts/[id]/not-sent/route.ts:33-35`).

Ouvert à tout ADMIN sans permission : lecture des Réglages de la plateforme (`app/api/admin/finance-settings/route.ts:23`),
lecture des tarifs (`app/api/admin/pricing/route.ts:16`), liste des permissions (`app/api/admin/permissions/route.ts:13`).

---

## 11.1 Démarrer le premier SUPERADMIN

1. **Qui, où** : un opérateur technique, sur un poste qui a les variables du projet visé (clé de service), en ligne de
   commande. Aucun écran. Commande : `npx tsx scripts/bootstrap-superadmin.ts --phone +221770000000 --operator "Fatou Diop"`
   ou `--email <adresse> --operator "<nom>"`, avec `--allow-existing` pour ajouter un SUPERADMIN quand il en existe déjà
   (`scripts/bootstrap-superadmin.ts:4-8`, `:18-35`). L’exemple du script porte un numéro réel, non recopié ici.
2. **Ce qu’il saisit** : l’email ou le téléphone d’un compte qui existe déjà (créé par l’inscription normale), et son
   propre nom pour la traçabilité. Erreurs exactes :
   - sans email ni téléphone, ou sans opérateur : « Usage : npx tsx scripts/bootstrap-superadmin.ts (--email <email> | --phone <téléphone>) --operator "<nom>" [--allow-existing] » (`scripts/bootstrap-superadmin.ts:22-25`) ;
   - « Un SUPERADMIN existe déjà : créez les suivants depuis l'administration, ou passez --allow-existing. » (`lib/admin/bootstrap-superadmin.ts:46-48`) ;
   - « Aucun compte ne correspond : le compte doit d'abord être créé par l'inscription normale. » (`:56`).
   La recherche par email compare l’adresse enregistrée sur le compte (`users.email`) : pour un compte sans adresse
   vérifiée, c’est l’adresse technique du numéro ; la recherche par téléphone est donc la plus sûre (`:50-53`).
3. **Ce que fait le système** : ajoute le rôle SUPERADMIN, met le profil au rôle SUPERADMIN et au statut actif, écrit
   une ligne `SUPERADMIN_BOOTSTRAP` au journal avec le nom de l’opérateur ; affiche « Projet ciblé : {adresse du projet} »
   puis « SUPERADMIN attribué : {identifiant} ({email ou téléphone}) » (`lib/admin/bootstrap-superadmin.ts:58-77`,
   `scripts/bootstrap-superadmin.ts:26-34`). Si le journal ne s’écrit pas : « Rôle attribué mais journalisation
   impossible : {détail} » (`:75`).
4. **Messages envoyés** : aucun.
5. **Ce que voient les autres rôles** : le compte, à sa prochaine lecture du profil, voit l’administration complète.
6. **Impossible** : promouvoir un compte inexistant ; créer un second SUPERADMIN sans `--allow-existing`. Les
   SUPERADMIN suivants se créent depuis `/admin/users` (11.2).
7. **Preuves** : ci-dessus. Pas d’essai associé dans `docs/recette-billetterie.md`.

---

## 11.2 Créer un compte

1. **Qui, où** : ADMIN muni de `users.write` ou SUPERADMIN ; `/admin/users` (menu « Gestion » > « Utilisateurs »),
   bouton « Créer un Compte / Admin » (`app/admin/users/page.tsx:354-363`). La fenêtre s’intitule « Créer un Compte
   Métier », sous-titre « Attribution de rôle sécurisée et synchronisation instantanée » (`:567-568`).
2. **Ce qu’il saisit** (`app/admin/users/page.tsx:573-799`) :
   - « Prénom * » (exemple affiché « Ex : Moussa ») et « Nom * » (« Ex : Diop ») ;
   - « Numéro de Téléphone (Sénégal) * » avec le préfixe « +221 » (« 77 123 45 67 ») ; un numéro sans « + » reçoit
     « +221 » devant, zéros de tête et espaces retirés (`app/api/admin/users/route.ts:142`) ;
   - « Email (Optionnel) » (« contact@domaine.sn ») ;
   - « Mot de passe temporaire * » avec bouton « Afficher » / « Masquer » ;
   - « Rôle Attribué * » : « CONTRÔLEUR » (« Scanner de billets sur site (/scan) »), « CLIENT STANDARD »
     (« Utilisateur public standard ») ; pour le SUPERADMIN seulement, en plus « ADMINISTRATEUR » (« Supervision avec
     permissions ») et « SUPERADMIN » (« Accès maître absolu HQ ») ; rôle choisi par défaut : CONTRÔLEUR (`:102`,
     `:678-778`) ;
   - une note selon le rôle, par exemple pour un contrôleur « Routage : Redirigé automatiquement vers le scanner de
     billets (/scan) dès sa connexion. » (`:792-806`) ;
   - bouton « Créer le compte {rôle} », par exemple « Créer le compte Contrôleur » (`:828`).

   Erreurs exactes de la route (`app/api/admin/users/route.ts:113-245`) :
   « Nom, prénom, téléphone et mot de passe requis. » ; « Rôle inconnu : {rôle}. » ; « Seul un superadmin peut créer
   un administrateur ou changer ce rôle. » (ADMIN ou SUPERADMIN demandé par un non-SUPERADMIN, avant toute création) ;
   « Adresse email invalide. » ; « Cette adresse est réservée. Saisissez votre propre adresse email. » (adresse du
   domaine technique, `lib/validations/auth.ts:5`) ; « Cet email est déjà associé à un compte. » ; « Ce numéro de
   téléphone est déjà associé à un compte. » ; « Ce numéro de téléphone ou cet email est déjà associé à un compte. » ;
   « Compte non créé. Vérifiez les informations saisies et réessayez. » ; « Compte créé mais attribution du rôle
   impossible. Réessayez. ». Aucune règle de mot de passe n’est vérifiée par la route : seule celle du service
   d’authentification s’applique (6 caractères au minimum dans la configuration locale, `supabase/config.toml:169`,
   valeur du projet distant NON VÉRIFIÉ), alors que la règle de l’application (8 caractères, majuscule, chiffre,
   caractère spécial, `lib/validations/auth.ts:88-96`) se dit appliquée « à TOUS les flux (inscription, reset,
   admin) » : écart noté dans les constats.
3. **Ce que fait le système** : crée le compte de connexion (numéro et adresse technique confirmés), donne le rôle choisi
   en plus de CLIENT par la fonction `user_roles_set` (qui écrit `ROLES_SET` au journal), enregistre le profil au statut
   actif, l’adresse saisie en attente de vérification, et écrit `CREATE_USER` au journal (`app/api/admin/users/route.ts:150-229`,
   `lib/auth/roles.ts:110`). Un ADMIN créé n’a **aucune permission** : il faut ensuite les cocher (11.3). Le mot de
   passe « temporaire » n’est jamais redemandé : aucun changement n’est imposé à la première connexion (recherche de
   `must_change` et de « temporaire » sans autre résultat que ce libellé) : noté dans les constats.
4. **Messages envoyés** :

   | Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
   |---|---|---|---|---|
   | Nouveau titulaire, si une adresse est saisie | email | indispensable (lien de vérification, voir 02) | immédiat, au mieux ; l’échec n’empêche pas la création | voir 02 (vérification de l’email) |
   | Nouveau titulaire | SMS | — | aucun | aucun SMS ne part : l’admin doit lui transmettre le mot de passe lui-même (`app/api/admin/users/route.ts:213-237`) |
   | Admin qui crée | écran | — | immédiat | « Le compte {rôle} de {prénom} {nom} a été créé avec succès. », ex. « Le compte Contrôleur de Fatou Diop a été créé avec succès. » (`app/admin/users/page.tsx:189`) |

5. **Ce que voient les autres rôles** : le compte apparaît dans la liste au rechargement. Un contrôleur créé ainsi
   n’est affecté à aucun événement : son scanner affiche « Aucun événement assigné » (01.9).
6. **Impossible** : un ADMIN ne peut créer ni ADMIN ni SUPERADMIN (boutons absents, refus serveur). L’écran ne propose
   pas le rôle PARTENAIRE (la route l’accepte, `app/api/admin/users/route.ts:37`).
7. **Preuves** : ci-dessus.

---

## 11.3 Attribuer les permissions d’un ADMIN

1. **Qui, où** : SUPERADMIN ; `/admin/users`, ligne d’un compte ADMIN non supprimé, bouton « Permissions »
   (`app/admin/users/page.tsx:486-498`).
2. **Ce qu’il saisit** : fenêtre « Permissions Granulaires », sous-titre « Attribution des droits d'administration pour
   {prénom} {nom} », texte « Sélectionnez les permissions spécifiques que cet administrateur est autorisé à exercer au
   quotidien. » ; 16 cases, une par permission, avec son libellé ; « Annuler » ou « Enregistrer les permissions »
   (`app/admin/users/page.tsx:838-899`). Les cases cochées reflètent les permissions lues pour ce compte (`:244-258`).
3. **Ce que fait le système** : remplace en une seule transaction toutes les permissions du compte par la liste cochée
   (les valeurs inconnues sont écartées) et écrit `UPDATE_PERMISSIONS` au journal avec l’avant et l’après
   (`app/api/admin/permissions/route.ts:64-71`, `M/20261108000001_lot9_securite.sql:579-622`). L’effet est immédiat
   côté serveur ; l’écran de l’ADMIN masque ou montre les boutons à sa prochaine lecture du profil (rechargement).
4. **Messages envoyés** : aucun à l’ADMIN concerné. À l’écran : « Les permissions de l'administrateur {prénom} {nom}
   ont été enregistrées. », ex. « Les permissions de l'administrateur Fatou Diop ont été enregistrées. »
   (`app/admin/users/page.tsx:276`).
5. **Ce que voient les autres rôles** : l’ADMIN concerné voit ses écrans changer au rechargement ; les avis aux admins
   suivent la nouvelle liste dès l’envoi suivant (`M/20261103000002_lot6_outbox.sql:402-421`).
6. **Refus exacts** : « Opération réservée exclusivement au SUPERADMIN. » (autre compte) ; « Administrateur cible
   introuvable. » ; « Le Superadmin dispose de toutes les permissions par défaut. » (cible SUPERADMIN) ;
   « Permissions non enregistrées. Réessayez. » ; « adminId et tableau de permissions requis. »
   (`app/api/admin/permissions/route.ts:48`, `:59-85`).
7. **Preuves** : ci-dessus. Essai 53 (admin sans droit).

---

## 11.4 Suspendre ou réactiver un compte (hors partenaire)

1. **Qui, où** : ADMIN muni de `users.write` (comptes non ADMIN) ou SUPERADMIN (tous sauf un SUPERADMIN) ;
   `/admin/users`, bouton « Suspendre » ou « Réactiver » de la ligne (`app/admin/users/page.tsx:515-532`). Pour un
   compte partenaire, la ligne affiche « Voir la fiche partenaire » (avec `partners.read`) ou « Statut géré depuis la
   fiche partenaire », jamais « Suspendre » (`:500-513`).
2. **Ce qu’il saisit** : fenêtre « Suspendre le compte » (ou « Réactiver le compte »), texte « {prénom} {nom} ne pourra
   plus se connecter : ses sessions sont fermées. Ses billets payés restent valables à l’entrée. Il est prévenu avec
   votre motif. » (ou « {prénom} {nom} retrouvera l’accès à son compte. Il est prévenu avec votre motif. »), champ
   « Motif de la suspension » (ou « Motif de la réactivation »), aide « Au moins 3 caractères. Ce motif est communiqué
   au titulaire du compte. », 500 caractères au plus ; bouton « Suspendre le compte » / « Réactiver le compte »
   (`app/admin/users/page.tsx:904-925`). Moins de 3 caractères : « Le motif doit contenir au moins 3 caractères. »
   (`components/ui/ReasonDialog.tsx:64-65`).
3. **Ce que fait le système** : la fonction `admin_user_status_set` change le statut, ferme toutes les sessions à la
   suspension, écrit `USER_STATUS_SET` au journal et met l’avis en file, dans une seule transaction
   (`app/api/admin/users/route.ts:397-413`, `M/20261109000004_lot9bis_droits.sql:456-530`).
4. **Messages envoyés** (détail des canaux : 10, types `ACCOUNT_SUSPENDED`, `ACCOUNT_REACTIVATED`) :

   | Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
   |---|---|---|---|---|
   | Titulaire suspendu | SMS | indispensable (envoyé malgré la suspension) | file d’envoi | « Event Village : votre compte est suspendu. Motif : {motif}. Vos billets payés restent valables à l'entrée. Contactez le support. » ; ex. « Event Village : votre compte est suspendu. Motif : Paiements contestés. Vos billets payés restent valables à l'entrée. Contactez le support. » (`lib/notifications/catalog.ts:1577-1586`, `M/20261109000003_lot9bis_registre.sql:79`) |
   | Titulaire suspendu | cloche, email | indispensable | file d’envoi | titre « Compte suspendu », « Votre compte est suspendu. Motif : {motif}. Vos billets payés restent valables à l'entrée : présentez le billet hors ligne déjà enregistré sur votre téléphone, ou donnez le numéro du billet avec une pièce d'identité. Contactez le support. » |
   | Titulaire réactivé | SMS | indispensable | file d’envoi | « Event Village : votre compte est réactivé. Vous pouvez de nouveau vous connecter : {lien}/login » (`lib/notifications/catalog.ts:1588-1595`) |
   | Titulaire réactivé | cloche, email | indispensable | file d’envoi | titre « Compte réactivé », « Votre compte est réactivé : vous pouvez de nouveau vous connecter. » |
   | Admin | écran | — | immédiat | « Le compte de {prénom} {nom} a été suspendu. » ; « Le compte de {prénom} {nom} a été réactivé avec succès. » (`app/admin/users/page.tsx:228-231`) |

   Le motif de la réactivation n’est repris dans aucun message : la fonction ne le transmet que pour la suspension
   (`M/20261109000004_lot9bis_droits.sql:517-523`, `admin_user_status_set` : motif transmis seulement si
   `ACCOUNT_SUSPENDED`), alors que l’écran annonce « Il est prévenu avec votre motif » : écart noté.
5. **Ce que voient les autres rôles** : le titulaire est déconnecté ; s’il essaie de se reconnecter, l’écran de
   connexion ferme aussitôt la session et affiche « Votre compte est suspendu. Veuillez contacter le support. »
   (01.3, `components/auth/LoginForm.tsx:280-285`). Le serveur de connexion, lui, ne refuse pas le compte : une session
   ouverte hors écran reçoit « Votre compte n'est pas actif. Contactez le support. » sur toute action protégée (écart
   noté). Ses billets payés restent valables à l’entrée (voir 05 et 07).
6. **Refus exacts** : « Indiquez le motif de la suspension (3 caractères au moins). » ; « Ce compte est celui d’un
   partenaire : suspendez-le ou réactivez-le depuis sa fiche partenaire, avec un motif. » ; « Seul un superadmin peut
   créer un administrateur ou changer ce rôle. » (compte ADMIN visé par un ADMIN) ; « Impossible de modifier un compte
   SUPERADMIN sans être soi-même SUPERADMIN. » ; « Statut invalide : ACTIF ou SUSPENDU. » ; « Utilisateur cible
   introuvable. » (`app/api/admin/users/route.ts:276-282`, `:329`, `:349-373`, `:405-411`).
7. **Preuves** : ci-dessus. Essai 73.

---

## 11.5 Supprimer (anonymiser) un compte

1. **Qui, où** : ADMIN muni de `users.write` ou SUPERADMIN ; `/admin/users`, bouton « Supprimer » (info-bulle
   « Anonymiser définitivement ce compte (RGPD) »), proposé sur toute ligne non SUPERADMIN, non déjà supprimée, et non
   ADMIN pour un ADMIN — y compris un compte partenaire (`app/admin/users/page.tsx:515`, `:534-544`).
2. **Ce qu’il saisit** : confirmation « Anonymiser définitivement ce compte ? » / « Attention : Cette action va
   anonymiser définitivement cet utilisateur (conformité RGPD). Ses données personnelles seront effacées et il sera
   banni, mais son historique financier sera conservé. Cette action est irréversible. » ; « Annuler » ou « Anonymiser
   & Supprimer » (`app/admin/users/page.tsx:928-938`).
3. **Ce que fait le système** (`lib/admin/admin.service.ts:309-495`) : refuse son propre compte ; remplace l’email et le
   téléphone de connexion par des valeurs synthétiques et bannit le compte pour 100 ans ; ferme les sessions ; met le
   profil à « Utilisateur Supprimé », statut « supprimé » (repli sur « suspendu » si l’écriture échoue) ; retire les
   permissions, les rôles ADMIN, SUPERADMIN et CONTRÔLEUR, les affectations de contrôle et les codes en cours ; garde
   commandes, billets, caisses et paiements ; écrit `ANONYMIZE_USER` au journal. Le rôle PARTENAIRE et la fiche
   partenaire ne sont pas touchés (aucune ligne de nettoyage ne les vise, `:430-436`).
4. **Messages envoyés** : aucun au titulaire. À l’écran : « Le compte de {prénom} {nom} a été définitivement anonymisé
   (RGPD). » (`app/admin/users/page.tsx:309`). La ligne affiche ensuite « Données effacées » et « Compte Anonymisé &
   Banni » (`:463`, `:547-551`).
5. **Ce que voient les autres rôles** : le titulaire ne peut plus se connecter (compte banni). Une caisse ouverte bloque
   le retrait du rôle CONTRÔLEUR.
6. **Refus exacts** : « Impossible de supprimer votre propre compte administrateur. » ; « Seul un Superadmin peut
   supprimer un compte SUPERADMIN. » ; « Révocation des sessions du compte anonymisé impossible. » ; « Anonymisation
   incomplète : retrait impossible ({liste}). Relancez l'anonymisation ; une caisse ouverte doit d'abord être
   clôturée. » ; « Anonymisation momentanément impossible. Réessayez. » (`lib/admin/admin.service.ts:313-330`, `:361`,
   `:461` ; `app/api/admin/users/[id]/anonymize/route.ts:38`). Le serveur ne refuse pas à un ADMIN l’anonymisation
   d’un autre ADMIN (seul l’écran masque le bouton) et compare le rôle du profil, pas la table des rôles : écart noté.
7. **Preuves** : ci-dessus.

---

## 11.6 Valider une candidature partenaire

Détail du parcours partenaire : 03. Côté admin :

1. **Qui, où** : ADMIN muni de `partners.read` (pour voir) et `partners.validate` (pour agir), ou SUPERADMIN ;
   `/admin/dashboard`, section « Candidatures des partenaires », onglets « En attente », « Validés », « Refusés »,
   « Tous » (il n’y a pas d’onglet des suspendus) ; boutons « Dossier », « Valider », « Refuser »
   (`app/admin/dashboard/page.tsx:405-427`, `:594-639`). La fiche « Dossier du partenaire » montre Structure (« Raison
   sociale », « Nom commercial », « Ville », « Adresse », « NINEA », « RCCM »), « Responsable du compte » (« Numéro
   vérifié » ou « Numéro non vérifié »), « Présentation de l’activité », « Pièces justificatives » (« Pièce d’identité »,
   « NINEA ou RCCM », bouton « Ouvrir ») (`:658-855`).
2. **Ce qu’il saisit** : « Valider la candidature ? » / « « {raison sociale} » pourra créer des événements et vendre des
   billets. Le responsable est prévenu par SMS. » ; bouton « Valider la candidature » (`:864-876`).
3. **Ce que fait le système** : la fonction `partner_status_set` passe la fiche « validée », le compte « actif », écrit
   `PARTNER_STATUS_SET` au journal et met l’avis en file (`app/api/admin/partners/[id]/status/route.ts:38-44`,
   `:80-82`).
4. **Messages envoyés** (type `PARTNER_VALIDATED`, indispensable, `M/20261103000002_lot6_outbox.sql:113`) :

   | Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
   |---|---|---|---|---|
   | Partenaire | SMS | indispensable | file d’envoi | « Event Village : votre compte partenaire {nom} est validé. Connectez-vous : {lien}/login » ; ex. « Event Village : votre compte partenaire Concert Test est validé. Connectez-vous : {lien}/login » (`lib/notifications/catalog.ts:1018-1024`) |
   | Partenaire | cloche, email | indispensable | file d’envoi | titre « Compte partenaire validé », « Votre compte partenaire « {nom} » est validé. Vous pouvez créer et publier vos événements. » |
   | Admin | écran | — | immédiat | « Le partenaire « {raison sociale} » a été validé avec succès. » (`lib/messages/toast-messages.ts:9-10`) |

5. **Ce que voient les autres rôles** : le tableau de bord admin se recharge en direct à chaque nouvelle candidature
   (`app/admin/dashboard/page.tsx:289-295`) ; la partenaire voit son espace complet au rechargement.
6. **Refus** : sans `partners.validate`, boutons absents et refus serveur `PERMISSION_MISSING`
   (`app/api/admin/partners/[id]/status/route.ts:73-77`) ; transition interdite : message de la fonction (code
   `TRANSITION_NOT_ALLOWED`) ; panne : « Mise à jour du partenaire momentanément impossible. ».
7. **Preuves** : ci-dessus. Essai 10.

## 11.7 Refuser une candidature

1. **Qui, où** : comme 11.6 ; bouton « Refuser ».
2. **Ce qu’il saisit** : « Refuser la candidature » / « « {raison sociale} » sera prévenu par SMS avec votre motif. »,
   champ « Motif du refus », aide « Au moins 3 caractères. Par exemple : NINEA manquant ou illisible, activité non
   éligible. », bouton « Refuser la candidature » (`app/admin/dashboard/page.tsx:878-892`).
3. **Ce que fait le système** : fiche « refusée » avec le motif, compte « actif » ; la partenaire pourra compléter son
   dossier une fois (03). Sur la fiche, le bandeau « Motif du refus » affiche « {motif} Le partenaire peut compléter son
   dossier une fois depuis son tableau de bord. » ou « … Le partenaire a déjà complété son dossier une fois. »
   (`:700-707`).
4. **Messages envoyés** (type `PARTNER_REJECTED`) :

   | Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
   |---|---|---|---|---|
   | Partenaire | SMS | indispensable | file d’envoi | « Event Village : votre demande de compte partenaire n'est pas acceptée. Motif : {motif}. » ; ex. « … Motif : Pièce d’identité illisible. » (`lib/notifications/catalog.ts:1025-1035`) |
   | Partenaire | cloche, email | indispensable | file d’envoi | « Demande refusée » : « Votre demande de compte partenaire n'est pas acceptée. Motif : {motif} Vous pouvez compléter votre dossier une fois depuis votre tableau de bord. » |
   | Admin | écran | — | immédiat | « La demande du partenaire « {raison sociale} » a été refusée. » (`lib/messages/toast-messages.ts:11-12`) |

5. **Ce que voient les autres rôles** : la partenaire voit le bandeau « Demande de compte partenaire refusée » (01.7).
   Quand elle complète son dossier, les admins `partners.read` reçoivent `ADMIN_PARTNER_RESUBMITTED` (11.19).
6. **Refus** : motif de moins de 3 caractères : « Le motif doit contenir au moins 3 caractères. ».
7. **Preuves** : ci-dessus.

## 11.8 Suspendre ou réactiver un partenaire

1. **Qui, où** : suspendre : `partners.suspend` ; réactiver : `partners.validate` ; ou SUPERADMIN. Fiche « Dossier du
   partenaire » (ouverte depuis le tableau de bord ou par « Voir la fiche partenaire » de `/admin/users`), boutons
   « Suspendre » (partenaire validé) et « Réactiver » (partenaire suspendu) (`app/admin/dashboard/page.tsx:671-680`,
   `:388-403`).
2. **Ce qu’il saisit** (`components/admin/PartnerStatusDialog.tsx:55-71`) :
   - « Suspendre le partenaire » / « « {nom} » ne pourra plus vendre : ses événements en ligne sont suspendus et ses
     fonds sont gelés jusqu’à la réactivation. Il est prévenu avec votre motif. » ; « Motif de la suspension » ;
   - « Réactiver le partenaire » / « « {nom} » retrouve son compte. Seuls les événements suspendus avec le compte
     reviennent en ligne ; un événement suspendu pour une autre raison, ou terminé entre-temps, reste suspendu. » ;
     « Motif de la réactivation » ;
   - aide commune « Au moins 3 caractères. Ce motif est communiqué au partenaire et enregistré au journal. ».
3. **Ce que fait le système** : fiche et compte suspendus, sessions fermées, événements publiés suspendus en cascade,
   fonds gelés ; à la réactivation, seuls les événements suspendus par la cascade reviennent (détail : 03 et 04)
   (`app/api/admin/partners/[id]/status/route.ts:38-44`, `:104-111`).
4. **Messages envoyés** (types `PARTNER_SUSPENDED`, `PARTNER_REACTIVATED`, et pour les acheteurs voir 04) :

   | Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
   |---|---|---|---|---|
   | Partenaire suspendu | SMS | indispensable | file d’envoi | « Event Village : votre compte partenaire est suspendu. Motif : {motif}. Contactez le support. » (`lib/notifications/catalog.ts:1036-1042`) |
   | Partenaire réactivé | SMS | indispensable | file d’envoi | « Event Village : votre compte partenaire est réactivé. Connectez-vous : {lien}/login » (`:1043-1049`) |
   | Partenaire | cloche, email | indispensable | file d’envoi | « Compte suspendu » : « Votre compte partenaire est suspendu. Motif : {motif}. Contactez le support. » ; « Compte réactivé » : « Votre compte partenaire est réactivé. Vous pouvez de nouveau publier vos événements. » |
   | Admin | écran | — | immédiat | « {nom} est suspendu. Événements suspendus avec le compte : {n}. » ; « {nom} est réactivé. Événements remis en ligne : {n}. » suivi de « Restés suspendus : {n}. » s’il y en a (`app/admin/dashboard/page.tsx:376-386`) ; ex. « Concert Test est suspendu. Événements suspendus avec le compte : 1. » |

   Le motif de la réactivation n’est repris dans aucun message (le modèle `PARTNER_REACTIVATED` n’a pas de motif),
   contrairement à l’aide de la fenêtre : écart noté.
5. **Ce que voient les autres rôles** : la partenaire est déconnectée ; à sa reconnexion, l’écran de connexion ferme
   la session (« Votre compte est suspendu. Veuillez contacter le support. ») ; un onglet resté ouvert montre un tableau
   de bord en erreur (01.8) ; ses événements disparaissent d’Explorer.
6. **Refus** : motif manquant (code `REASON_REQUIRED`), transition interdite (`TRANSITION_NOT_ALLOWED`), permission
   absente : message de la route ; panne : « Mise à jour du partenaire momentanément impossible. »
   (`app/api/admin/partners/[id]/status/route.ts:13-20`, `:84-95`).
7. **Preuves** : ci-dessus. Essai 55.

---

## 11.9 Événements : file de validation et fiche

Toutes les transitions et leurs messages sont décrites en 04 ; ici, ce que voit et fait l’admin.

**Liste `/admin/events`** (`events.read`) : titre « Événements », « Examinez les soumissions des organisateurs, puis
suivez chaque événement tout au long de son cycle de vie. » ; recherche « Rechercher par titre » (100 caractères au
plus) ; onglets dans l’ordre « En attente de validation », « Publié », « Validé », « Suspendu », « Brouillon »,
« Terminé », « Annulé », « Tous » ; 20 lignes par page ; colonnes « Événement », « Organisateur », « Date »,
« Statut », « Soumis le » (« Jamais soumis ») et bouton « Examiner » (sur téléphone « Examiner la fiche ») ; mise à
jour en direct à chaque soumission ou changement de statut (`app/admin/events/page.tsx:35`, `:40`, `:165-172`,
`:204-252`, `:331-353`, `lib/events/event-status.ts:75-111`). Liste vide de l’onglet par défaut : « Aucun événement à
valider » / « Les nouvelles soumissions des organisateurs apparaissent ici en direct. » (`:306-312`).

**Fiche `/admin/events/<id>`** (`events.read`) : statut, catégorie, organisateur et date ; sections « Dates et lieu »
(« Début », « Fin », « Lieu », « Jauge déclarée »), « Description », « Programme », « Catégories et prix » (prix ou
« Gratuit », quota, période de vente, « Par commande », canaux, « Active » / « Inactive »), « Affiche »,
« Organisateur », « Historique des statuts » (`app/admin/events/[id]/page.tsx:597-745`). Un événement sans date de fin
affiche « Fin : Non précisée (fin de journée) » (`:600`) alors que la fin retenue par le serveur est le début plus 6 h
(`M/20261109000008_lot9bis_cycle.sql`, `event_end_from_v2` et `event_end_at`) : écart noté. Bandeau du dernier motif
« Motif du refus » ou « Motif de la suspension » avec « Communiqué à l’organisateur le {date}. » (`:568-579`).

Boutons (seulement avec `events.write`, d’après les actions servies par la base, `M/20261109000008_lot9bis_cycle.sql`
`event_actions`, et la table des transitions `M/20261102000003_lot5_cycle.sql:49-65`,
`M/20261109000008_lot9bis_cycle.sql:203-210`, `M/20261110000007_lot9ter_evenements.sql:232-234`) :

| Statut | Boutons de l’admin | Confirmation (titre, texte) |
|---|---|---|
| En attente de validation | « Refuser » (motif), « Valider » | « Refuser l’événement » : « L’événement revient en brouillon chez l’organisateur, qui voit votre motif sur sa fiche et peut le soumettre de nouveau. » ; « Valider l’événement ? » : « L’organisateur est prévenu et pourra publier l’événement. La fiche ne repasse pas en validation. » |
| Validé | « Publier » (sauf si la fin est passée), « Annuler l’événement » | « Publier l’événement ? » : « La page publique devient visible de tous et la billetterie s’ouvre selon les dates de vente. » |
| Publié | « Suspendre » (motif), « Terminer », « Annuler l’événement » | « Suspendre l’événement » : « La vente et le contrôle d’accès s’arrêtent immédiatement. L’organisateur et les détenteurs de billets sont prévenus ; seul l’organisateur voit le motif. » ; « Terminer l’événement ? » : « La vente est close. Le contrôle des entrées reste possible jusqu’à la fermeture de la fenêtre de scan. » |
| Suspendu | « Réactiver » (avant la fin), « Clore l’événement » (motif, après la fin), « Annuler l’événement » | « Réactiver l’événement ? » : « La page publique, la vente et le contrôle d’accès reprennent. L’organisateur et les détenteurs de billets sont prévenus. » ; motif « Motif de la clôture » |

Textes de succès : « Événement validé : l’organisateur peut maintenant le publier. », « Refus envoyé : l’organisateur
voit votre motif. », « Événement suspendu : la vente et le contrôle d’accès sont arrêtés. », « Événement réactivé : la
vente reprend. », « Événement publié. », « Événement terminé. » (`app/admin/events/[id]/page.tsx:183-234`). Autres
boutons : « Ouvrir le pilotage » (`events.read`) et « Page publique » (événement publié, suspendu, annulé ou terminé,
sauf un validé jamais publié) (`:552-563`, `:477`). L’annulation ouvre la fenêtre d’annulation (titre à retaper) puis le
suivi des remboursements : voir 04 et 08.

Messages : `EVENT_VALIDATED`, `EVENT_REJECTED`, `EVENT_SUSPENDED`, `EVENT_REACTIVATED`, `EVENT_PUBLISHED_BY_ADMIN`,
`EVENT_CLOSED_BY_ADMIN`, `EVENT_CANCELLED_BY_ADMIN` et les avis aux détenteurs : textes dans 04 et 10
(`lib/notifications/catalog.ts:902-935`, `:1409`, `:1491`). Exemple, SMS de validation : « Event Village : votre
événement {titre} est validé. Publiez-le depuis votre espace : {lien}/partner/events » ; « Event Village : votre
événement Concert Test est validé. Publiez-le depuis votre espace : {lien}/partner/events ».

Essais : 12, 13, 70, 71, 90, 92.

---

## 11.10 Catalogues et services

`/admin/services` (`events.read`) : « Catalogues et services » / « Vue d’ensemble, en lecture, des salles, tables,
produits et commandes des partenaires. » ; onglets « Événements » (bandeau « La modération des événements a son propre
écran » et bouton « Ouvrir les événements »), « Salles de fête », « Restaurants et tables », « Produits et traiteurs »,
« Commandes » ; liste vide : « Aucun élément » / « Aucun partenaire n’a encore rien enregistré dans ce catalogue. » ;
service fermé : « Service désactivé » (`app/admin/services/page.tsx:30-36`, `:227-268`, `:276-312`). L’écran n’écrit
rien. La route PATCH (`events.write`, journal `UPDATE_SERVICE_STATUS`) existe sans écran
(`app/api/admin/services/route.ts:104-105`).

## 11.11 Finance et rapprochement

`/admin/finance` (`payments.read`), détail des chiffres et formules : 08. Titre « Rapprochement financier », boutons
« Réglages de la plateforme » et « Actualiser » ; cartes « Volume encaissé », « Frais de service perçus », « Frais
agrégateur (SamirPay) », « Revenu net Event Village », « Reversements partenaires », « Remboursements versés »,
« Commissions de parrainage », « Revenu net après parrainage », « Retraits versés », « Écarts de rapprochement » ;
section « Frais SamirPay » ; bloc « Versements à reprendre » (`refunds.manage`) ; tableau « Paiements rapprochés » avec
les filtres « Statut » (« Tous les paiements encaissés », « Confirmés », « Partiellement remboursés », « Remboursement
en cours », « Remboursés ») et période (« Tout », « 30 jours », « 7 jours ») (`app/admin/finance/page.tsx:42-53`,
`:161-166`, `:172-193`, `:224-260`, `:266-310`, `:318-335`). Dans « Versements à reprendre », « Constater non versé »
est réservé au SUPERADMIN et demande le mot de passe récent (`app/api/admin/refunds/route.ts:217-218`, `:239`,
`app/api/admin/cashouts/[id]/not-sent/route.ts:33-37`). Essais 56, 58, 75, 84.

## 11.12 Tarification

`/admin/pricing` : simple renvoi. « Tarification » / « Les montants appliqués aux ventes et aux retraits ont une seule
source : les Réglages de la plateforme. » ; bandeau « Réglages de la plateforme » : « Les frais de service, les taux
des opérateurs et les règles de retrait se règlent dans les Réglages de la plateforme. Chaque modification y est
historisée et ne s’applique qu’aux opérations futures. » ; bouton « Ouvrir les Réglages de la plateforme »
(`app/admin/pricing/page.tsx:22-41`). La route POST `/api/admin/pricing` (`pricing.manage`) écrit toute clé qui ne
commence ni par `finance.`, ni par `access.`, ni par `notif.` : elle accepte donc les interrupteurs `features.*`, que
seul le SUPERADMIN doit changer (`app/api/admin/pricing/route.ts:60-68`, `:82-88`) : écart noté (sans écran).

---

## 11.13 Réglages de la plateforme (SUPERADMIN)

### Scénario 11.13 — Modifier un réglage

1. **Qui, où** : SUPERADMIN pour modifier ; tout ADMIN pour lire. Page `/admin/finance-settings` « Réglages de la
   plateforme », ouverte par « Réglages de la plateforme » (page Finance) ou « Ouvrir les Réglages de la plateforme »
   (Tarification) ; aucune entrée de menu (01.10). Description pour un ADMIN : « Lecture seule : seul un
   superadministrateur peut modifier ces réglages. Chaque modification est historisée et ne s’applique qu’aux opérations
   futures. » ; pour le SUPERADMIN : « Chaque modification est historisée et ne s’applique qu’aux opérations futures. »
   (`app/admin/finance-settings/page.tsx:300-310`). Quatre sections : « Finance », « Contrôle d’accès »,
   « Notifications », « Fonctionnalités » (`:104-110`). Chaque ligne : libellé, aide, « Modifié le {date} », valeur, et
   pour le SUPERADMIN un bouton « Modifier » (`:346-366`).
2. **Ce qu’il saisit** : « Nouvelle valeur » (liste « Activé » / « Désactivé », liste de choix, ou nombre), « Motif »
   obligatoire (300 caractères au plus, exemple « Ex : décision du comité du 15 novembre », aide « 3 caractères au
   moins ; visible dans l’historique. »), puis « Enregistrer » ou « Annuler » (`:370-426`). Erreurs de l’écran :
   « Saisissez une valeur numérique. » ; « Indiquez le motif de la modification (3 caractères au moins). » (`:255-271`).
   Erreurs du serveur : « Réglage invalide (clé finance.*, access.*, notif.* ou features.*, valeur, motif d’au moins 3
   caractères). » ; « Réglage inconnu. » ; « Seul un SUPERADMIN actif modifie les réglages de la plateforme. » ;
   « Valeur refusée pour {clé} : {valeur} », ex. « Valeur refusée pour finance.service_fee_rate : 60 » ; « Réglage non
   enregistré. » (`app/api/admin/finance-settings/route.ts:66-83`, `M/20261110000002_lot9ter_reglages.sql:117-139`).
   Un 403 sans texte donne « Seul un superadministrateur peut modifier ce réglage. » (`page.tsx:281-285`).
3. **Ce que fait le système** : vérifie la clé (liste fermée), le rôle SUPERADMIN et le statut actif, les bornes, puis
   enregistre ; un déclencheur écrit l’ancienne valeur, la nouvelle, l’auteur et le motif dans l’historique
   (`M/20261110000002_lot9ter_reglages.sql:107-146`, `M/20261101000002_lot3_reglages.sql:29-56`). La valeur s’applique
   aux opérations suivantes, jamais aux passées. Les interrupteurs `features.*` sont relus à chaque requête : effet
   immédiat (`lib/features/flags.ts:9-11`).
4. **Messages envoyés** : aucun. À l’écran : « Réglage « {libellé} » enregistré. Il s’applique aux prochaines
   opérations. », ex. « Réglage « Frais de service » enregistré. Il s’applique aux prochaines opérations. »
   (`page.tsx:288`). La section « Historique des modifications » montre les 100 dernières : libellé, « {avant} →
   {après} », date et motif (`app/api/admin/finance-settings/route.ts:28-29`, `page.tsx:437-460`) ; vide : « Aucune
   modification enregistrée. ».
5. **Ce que voient les autres rôles** : les clients, partenaires et contrôleurs voient l’effet à la prochaine opération
   (frais, garde des places, fenêtre de scan, menus des services…).
6. **Impossible** : modifier sans être SUPERADMIN actif ; une valeur hors bornes ; une clé hors liste. Sous les frais de
   retrait, l’écran avertit sans bloquer : « Frais de retrait sous le coût réel » / « Attention : les frais de retrait
   ({taux} %) sont inférieurs aux frais SamirPay constatés ({taux constaté} %). Chaque retrait coûte alors de l’argent à
   Event Village. » ; sans frais constatés : « Frais SamirPay réels pas encore constatés. » (`page.tsx:186-202`).
7. **Preuves** : ci-dessus. Essais 52 et 53.

### Tableau complet des réglages

« Valeur initiale » = valeur posée par la migration à l’installation (`ON CONFLICT DO NOTHING` : une valeur déjà
présente n’est pas écrasée). La valeur actuelle de event-village-dev se lit sur l’écran : NON VÉRIFIÉ ici. Bornes :
`M/20261110000002_lot9ter_reglages.sql:59-100` (dernière définition de `fin_setting_valid`). Libellés et aides :
`app/admin/finance-settings/page.tsx:64-98`.

| Clé | Libellé à l’écran | Valeur initiale (preuve) | Valeurs admises |
|---|---|---|---|
| `finance.service_fee_rate` | Frais de service | 5 % (reprend `ticketing_fee_config`, 5,0, sinon 5) (`M/20261101000002_lot3_reglages.sql:61-63`, `M/0012_platform_financial_settings.sql:12-13`) | nombre de 0 à 50 |
| `finance.payment_hold_minutes` | Durée de garde des places pendant un paiement (minutes) | 10 (`M/20261109000001_lot9bis_reglages.sql:33`) | entier de 5 à 60 |
| `finance.min_paid_price` | Prix minimum d’un billet payant (F CFA) | 100 (`…lot9bis_reglages.sql:35`) | entier de 1 à 100 000 |
| `finance.aggregator_fee_rate.WAVE` | Frais agrégateur Wave | 1,5 % (`…lot3_reglages.sql:64`) | nombre de 0 à 10 |
| `finance.aggregator_fee_rate.ORANGE_MONEY` | Frais agrégateur Orange Money | 1,5 % (`…lot3_reglages.sql:65`) | nombre de 0 à 10 |
| `finance.cancellation_aggregator_fee_bearer` | Frais agrégateur d’une annulation | Event Village (`…lot3_reglages.sql:66`) | « Event Village » ou « Organisateur » |
| `finance.payout_hold_enabled` | Délai de garde des ventes | Activé (`…lot3_reglages.sql:67`) | Activé / Désactivé |
| `finance.payout_delay_hours` | Délai après la fin de l’événement | 48 h (`…lot3_reglages.sql:68`) | entier de 0 à 720 |
| `finance.withdrawal_fee_rate` | Frais de retrait | 1 % (`…lot3_reglages.sql:69`) | nombre de 0 à 10 |
| `finance.withdrawal_min_amount` | Montant minimum de retrait | 5 000 F CFA (`…lot3_reglages.sql:70`) | entier de 0 à 10 000 000 (l’aide de l’écran ne donne pas ces bornes) |
| `finance.withdrawal_bank_enabled` | Retraits par virement bancaire | Désactivé (`…lot3_reglages.sql:71`) | Activé / Désactivé |
| `finance.referral_availability_days` | Délai de validation des commissions | 7 jours (`…lot3_reglages.sql:72`) | entier de 7 à 14 |
| `access.scan_window_before_hours` | Ouverture du contrôle avant le début | 6 h (`M/20261101000009_lot4_reglages_acces.sql:14`) | entier de 0 à 48 |
| `access.scan_window_after_hours` | Fermeture du contrôle après la fin | 6 h (`…lot4_reglages_acces.sql:15`) | entier de 0 à 48 |
| `access.manual_entry_scope` | Saisie manuelle d’un numéro de billet | Contrôleur affecté seul (`…lot4_reglages_acces.sql:13`) | « Contrôleur affecté seul » ou « Contrôleur affecté, partenaire et admin » |
| `access.counter_sale_enabled` | Vente au guichet en espèces | Activé (`…lot4_reglages_acces.sql:16`) | Activé / Désactivé |
| `access.low_stock_threshold` | Seuil « bientôt complet » | 10 places (`M/20261102000006_lot5_temps_reel.sql:33`) | entier de 1 à 1000 |
| `access.refusal_alert_threshold` | Alerte de refus à une porte : nombre de refus | 10 (`M/20261110000002_lot9ter_reglages.sql:40-41`) | entier de 3 à 500 |
| `access.refusal_alert_minutes` | Alerte de refus à une porte : durée observée | 5 min (`…lot9ter_reglages.sql:42-43`) | entier de 1 à 60 |
| `notif.reminder_j1_enabled` | Rappel la veille | Activé (`M/20261103000003_lot6_reglages.sql:22`) | Activé / Désactivé |
| `notif.reminder_j1_hour` | Heure du rappel de la veille | 10 h (`…lot6_reglages.sql:24`) | entier de 6 à 20 |
| `notif.reminder_h3_enabled` | Rappel avant le début | Activé (`…lot6_reglages.sql:26`) | Activé / Désactivé |
| `notif.reminder_h3_hours` | Heures avant le début | 3 h (`…lot6_reglages.sql:28`) | entier de 1 à 12 |
| `notif.j1_sms` | SMS du rappel de la veille | Toujours (`…lot6_reglages.sql:30`) | « Toujours », « Seulement sans notification push », « Jamais » |
| `notif.h3_sms` | SMS du rappel avant le début | Seulement sans notification push (`…lot6_reglages.sql:32`) | idem |
| `notif.sms_quiet_start` | Début de la plage sans SMS | 22 h (`…lot6_reglages.sql:34`) | entier de 0 à 23 |
| `notif.sms_quiet_end` | Fin de la plage sans SMS | 8 h (`…lot6_reglages.sql:36`) | entier de 0 à 23 ; début = fin : aucune plage |
| `notif.sms_optional_daily_cap` | Plafond quotidien des SMS optionnels | 700 (`M/20261105000001_lot7_reglages.sql:30`) | entier de 0 à 1 000 000 ; 0 : aucun SMS optionnel |
| `notif.sms_essential_daily_alert` | Seuil d’alerte des SMS indispensables du jour | 2 000 (`M/20261109000001_lot9bis_reglages.sql:37`) | entier de 1 à 1 000 000 |
| `notif.free_ticket_reminder_sms` | SMS des rappels pour les billets gratuits | Jamais (`…lot7_reglages.sql:32`) | « Jamais » ou « Comme un billet payant » |
| `features.halls_enabled` | Salles de fête | Désactivé (`…lot7_reglages.sql:34`) | Activé / Désactivé |
| `features.tables_enabled` | Réservation de tables | Désactivé (`…lot7_reglages.sql:36`) | Activé / Désactivé |
| `features.orders_enabled` | Commandes de repas | Désactivé (`…lot7_reglages.sql:38`) | Activé / Désactivé |

Clé retirée : `notif.sms_daily_alert` (2 000), supprimée au lot 7 (`M/20261105000001_lot7_reglages.sql:45`) ; l’alerte
part désormais à 80 % du plafond optionnel (`app/admin/finance-settings/page.tsx:7-8`).

Clés anciennes encore en base mais affichées nulle part et lues par aucun calcul de la billetterie :
`subscription_packs`, `aggregator_fees`, `communication_tariffs`, `withdrawal_rules` (`M/0007_superadmin_complete.sql:30-55`),
`platform_commission_rate`, `ticketing_fee_config`, `order_commission_config`, `hall_fee_config`,
`withdrawal_fee_config` (`M/0012_platform_financial_settings.sql:5-27`). La page Tarification l’écrit pour les trois
premières (`app/admin/pricing/page.tsx:6-11`) ; pour les autres, « lues par aucun calcul » est NON VÉRIFIÉ au-delà de
`ticketing_fee_config`, relu une seule fois par la migration du lot 3.

Les taux et durées du parrainage (`referral_config`) ne sont pas des réglages de cette page et ne se modifient nulle
part (11.14).

---

## 11.14 Parrainage et ambassadeurs

1. **Qui, où** : `/admin/referral` (menu « Engagement » > « Parrainage ») ; en-tête « Console Superadmin HQ »,
   « Gestion des Ambassadeurs & Parrainage » (`app/admin/referral/page.tsx:157-172`).
2. **Ce qu’il voit et saisit** : cartes « Utilisateurs » (« {n} compte(s) standard »), « Ambassadeurs actifs » (« Taux
   ambassadeur : N1 {taux}, N2 {taux} »), « Durée du parrainage » ; bandeau « La personnalisation des taux n’est pas
   disponible pour le moment. » ; « Répertoire des Utilisateurs » / « Attribuez le statut Ambassadeur pour débloquer
   les commissions N1/N2 majorées. » ; recherche « Rechercher par nom, email, téléphone... » ; filtres « Tous »,
   « Ambassadeurs », « Standard » ; par ligne, le rôle brut (« CLIENT », « PARTENAIRE »…), « ⭐ Ambassadeur VIP » ou
   « Parrainage Standard », et le bouton « Promouvoir Ambassadeur ⭐ » ou « Rétrograder » (`:189-232`, `:236-360`).
3. **Ce que fait le système** : le bouton change le statut de parrainage du compte, réservé au SUPERADMIN
   (`app/api/admin/users/route.ts:286-301`) ; journal `UPDATE_USER`. Effet sur les commissions : 09.
4. **Messages envoyés** : aucun au titulaire. À l’écran : « Le statut Ambassadeur a bien été attribué à {prénom}
   {nom}. » ou « Le statut Ambassadeur a été retiré pour {prénom} {nom}. » (`app/admin/referral/page.tsx:139-142`).
5. **Ce que voient les autres rôles** : le titulaire voit « Ambassadeur » sous son nom et le badge « Ambassadeur Event
   Village » dans son profil (01.0, `app/profile/page.tsx:220`).
6. **Refus** : un ADMIN voit le bouton mais reçoit « Seul un SUPERADMIN peut modifier le statut ambassadeur. » (avec
   `users.write`) ou le refus de permission (sans) : écart noté. Sans `users.read`, la liste reste vide sans
   explication.
7. **Preuves** : ci-dessus. Essai 51.

## 11.15 Communications et campagnes

1. **Qui, où** : `communications.manage` ; `/admin/communications` « Campagnes de communication » / « Préparez un
   message pour les clients ou les partenaires. Les campagnes sont enregistrées en brouillon : aucun envoi ne part de
   cette page. » ; bandeau « Envoi des campagnes désactivé » : « L’envoi aux destinataires sera ouvert avec le lot des
   communications (préférences et désabonnement). En attendant, chaque campagne reste un brouillon. »
   (`app/admin/communications/page.tsx:200-221`).
2. **Ce qu’il saisit** : « Titre » (120 caractères, « Ex : soirée de gala, information de sécurité ») ; « Expéditeur »
   (« Event Village Info (actualités et événements) » par défaut, « Event Village Sénégal (annonces nationales) »,
   « Support officiel (transactions et sécurité) ») ; « Destinataires » (« Tous les clients inscrits » par défaut, « Tous
   les partenaires », « Ambassadeurs seulement ») ; « Canaux » (SMS coché par défaut, Email) ; « Message » (1000
   caractères, compteur, aide « Les termes offensants sont refusés par une modération automatique. ») ; bouton
   « Enregistrer le brouillon » (`:34-50`, `:115-119`, `:233-300`). Erreurs : « Indiquez un titre et un message. » ;
   « Choisissez au moins un canal. » ; « Le message contient des termes interdits ou offensants : {mots} » ;
   « Enregistrement de la campagne impossible. » (`:156-166`, `app/api/admin/communications/route.ts:65-75`, `:110-113`).
3. **Ce que fait le système** : compte les numéros visés (« Tous les clients inscrits » = tous les comptes qui ont un
   numéro, quels que soient leurs rôles), enregistre la campagne en brouillon, journal `SAVE_COMMUNICATION_DRAFT`
   (`app/api/admin/communications/route.ts:77-126`).
4. **Messages envoyés** : aucun. À l’écran : « Brouillon enregistré : l’envoi immédiat est désactivé. » et « « {titre} »
   : {n} destinataire(s) ciblé(s), aucun message envoyé. » (`page.tsx:34`, `:227-231`).
5. **Ce que voient les autres rôles** : rien.
6. **Impossible** : envoyer une campagne (lot des communications, voir 14).
7. **Preuves** : ci-dessus.

## 11.16 Supervision des notifications et relance

1. **Qui, où** : `notifications.read` ; `/admin/notifications` « Notifications » / « Supervision des envois :
   application, SMS, email et notifications push. Chiffres arrêtés à l’heure de Dakar. » ; compteurs « SMS
   aujourd'hui », « SMS optionnels aujourd'hui », « SMS ce mois-ci » ; onglets de statut « Toutes », « En attente »,
   « En cours d'envoi », « Envoyée », « En échec », « Non envoyée », « Annulée », « Incertaine » ; filtres
   « Rechercher » (« Numéro, email ou titre de l’événement »), « Canal », « Type », « Du », « Au » ; colonnes « Date »,
   « Type », « Canal », « Destinataire » (masqué), « Statut », « Motif », « Détail » ; tableau « Par jour et par canal »
   (`app/admin/notifications/page.tsx:344-413`, `:445-537`, `lib/notifications/outbox-labels.ts:13-21`).
2. **Ce qu’il saisit** : filtres ; dans le détail `/admin/notifications/<id>`, bouton « Relancer »
   (`notifications.write`), confirmation « Relancer cette notification ? » / « Elle repartira au prochain passage de
   l'envoyeur. » (`app/admin/notifications/[id]/page.tsx:445-449`, `:533-540`).
3. **Ce que fait le système** : la relance remet la ligne en attente ; elle repart au prochain passage de l’envoyeur
   (voir 12). Les SMS envoyés tout de suite (codes et invitation d’un nouveau contrôleur) apparaissent aussi dans la
   liste, avec « Origine : Envoi immédiat journalisé (code à usage unique ou invitation) » (`:476`,
   `lib/notifications/sync-log.ts:1-8`).
4. **Messages envoyés** : à l’écran « Notification remise en attente : elle repartira au prochain passage de
   l’envoyeur. » (`[id]/page.tsx:369`).
5. **Ce que voient les autres rôles** : le destinataire reçoit le message au passage suivant.
6. **Impossible** : relancer une ligne « Incertaine » (« Remise non confirmée » : « Le fournisseur a peut-être remis ce
   message : il n’est jamais renvoyé, ni automatiquement ni à la main, pour éviter un doublon. ») ou un code ou une
   invitation en échec (« Relance non proposée » : « Un code à usage unique ou une invitation ne se renvoie pas : la
   personne doit en demander un nouveau. ») (`[id]/page.tsx:457-466`).
7. **Preuves** : ci-dessus. Essai 54. Détail des statuts et motifs : 10.

## 11.17 Journal d’audit

1. **Qui, où** : SUPERADMIN seul ; `/admin/audit` (menu « Système » > « Journal d’audit », barre du bas « Audit ») ; un
   ADMIN qui saisit l’adresse voit « Réservé au superadmin » / « Seul un compte superadmin peut consulter le journal
   d’audit. Si vous en avez besoin, adressez-vous à votre superadmin. » (`app/admin/audit/page.tsx:138-142`,
   `app/api/admin/audit/route.ts:18`).
2. **Ce qu’il saisit** : filtre « Action » (« Toutes les actions », « INSERT (Création) », « UPDATE (Modification) »,
   « STATUS_CHANGE (Changement Statut) », « UPDATE_PERMISSIONS (Droits RBAC) », « UPDATE_PRICING (Tarifs) »,
   « SEND_COMMUNICATION (Campagne) ») ; filtre « Entité / Objet » (« Tous les objets », partenaires, utilisateurs,
   permissions, tarifs, communications, paiements) (`page.tsx:151-181`). Les actions réellement écrites sont aussi
   `CREATE_USER`, `UPDATE_USER`, `ROLES_SET`, `USER_STATUS_SET`, `ANONYMIZE_USER`, `PARTNER_STATUS_SET`,
   `SAVE_COMMUNICATION_DRAFT`, `SUPERADMIN_BOOTSTRAP`… ; « STATUS_CHANGE » et « SEND_COMMUNICATION » ne sont écrites
   nulle part (recherche dans `app`, `lib` et les migrations) : écart noté.
3. **Ce que fait le système** : lit les 100 dernières lignes (`page.tsx:61`, `route.ts:27-36`) ; colonnes
   « Horodatage », « Utilisateur », « Rôle à l’action », « Action », « Objet », « ID Objet », « Détails JSON » ; détail
   avec « Ancienne Valeur (Old Value) », « Nouvelle Valeur (New Value) », « Métadonnées » (`page.tsx:214-305`).
4. **Messages envoyés** : aucun.
5. **Ce que voient les autres rôles** : rien.
6. **Impossible** : modifier ou supprimer une ligne (aucun bouton) ; panne : « Journal d’audit indisponible » / « La
   lecture du journal a échoué. Rien ne permet de dire qu’il est vide : réessayez. » (`page.tsx:198-203`).
7. **Preuves** : ci-dessus. Essai 57.

## 11.18 Scanner de contrôle de l’admin

1. **Qui, où** : ADMIN ou SUPERADMIN ; menu « Système » > « Scanner » (ou « Espaces métier » > « Scanner de contrôle »),
   adresse `/scan`, qui redirige vers `/partner/scan` (`app/scan/page.tsx:4`, `AppLayout.tsx:200`, `:239`).
2. **Ce qu’il saisit** : le choix d’un événement ouvert au contrôle parmi **ses propres** événements de partenaire.
3. **Ce que fait le système** : la page lit la liste des événements de la fiche partenaire du compte ; pour un admin
   sans fiche partenaire, la lecture échoue (`lib/events/event.service.ts:191-204`, `app/api/partner/events/route.ts:32-58`).
4. **Messages envoyés** : aucun.
5. **Ce que voient les autres rôles** : rien.
6. **Écran affiché** pour un admin sans fiche partenaire : « Lecture de vos événements impossible pour le moment. »,
   puis « Contrôleur d’un événement ? Utilisez le scanner contrôleur, depuis votre espace contrôleur. » et « Ouvrir le
   scanner contrôleur » (`app/partner/scan/page.tsx:150`, `:452-462`). Le scanner du contrôleur ne liste que les
   événements auxquels le compte est affecté (`app/api/controller/assignments/route.ts:71-90`) : sans affectation, « Aucun
   événement assigné ». L’admin ne peut donc scanner que s’il est affecté comme contrôleur : écart noté.
7. **Preuves** : ci-dessus.

---

## 11.19 Messages reçus par un admin

Destinataires : tout compte actif SUPERADMIN, et tout compte actif ADMIN qui a la permission du type
(`M/20261103000002_lot6_outbox.sql:402-421`). Tous ces types sont « indispensables » ; aucun n’a de canal SMS. Canaux et
textes : 10 (registre `M/20261103000002_lot6_outbox.sql:129-138` et suivants, catalogue `lib/notifications/catalog.ts`).

| Type | Libellé | Permission requise | Preuve |
|---|---|---|---|
| `ADMIN_EVENT_SUBMITTED` | Événement à valider | `events.read` | `catalog.ts:1189-1197` |
| `ADMIN_EVENT_PUBLISHED` | Événement publié par l’organisateur | `events.read` | `catalog.ts:1653-1665` |
| `ADMIN_EVENT_WITHDRAWN` | Soumission retirée par l’organisateur | `events.read` | `catalog.ts:1666-1678` |
| `ADMIN_EVENT_CHANGED` | Événement modifié après validation | `events.read` | `catalog.ts:1597-1609` |
| `ADMIN_EVENT_CANCELLED` | Événement annulé par l’organisateur | `events.read` | `catalog.ts:1508-1521` |
| `ADMIN_PARTNER_REGISTERED` | Nouvelle candidature partenaire | `partners.read` | `catalog.ts:1198-1203` |
| `ADMIN_PARTNER_RESUBMITTED` | Dossier partenaire complété | `partners.read` | `catalog.ts:1391-1397` |
| `ADMIN_REFUND_TO_RETRY` | Remboursement à reprendre | `refunds.manage` | `catalog.ts:1204-1218` |
| `ADMIN_DUPLICATE_PAYMENT` | Paiement en double remboursé | `refunds.manage` | `catalog.ts:1219-1224` |
| `ADMIN_CASHOUT_UNCERTAIN` | Versement incertain | `refunds.manage` | `catalog.ts:1225-1230` |
| `ADMIN_CASHOUT_TO_RESUME` | Versement à reprendre | `refunds.manage` | `catalog.ts:1342-1364` |
| `ADMIN_WITHDRAWAL_REJECTED` | Retrait refusé par l’opérateur | `refunds.manage` | `catalog.ts:1231-1236` |
| `ADMIN_FINANCE_DEBT` | Créance sur un compte | `payments.read` | `catalog.ts:1237-1249` |
| `ADMIN_NOTIFICATION_FAILED` | Envoi en échec | `notifications.read` | `catalog.ts:1250-1262` |
| `ADMIN_SMS_DAILY_THRESHOLD` | Volume de SMS indispensables élevé | `notifications.read` | `catalog.ts:1263-1271` |
| `ADMIN_SMS_CAP_GLOBAL` | Plafond de SMS atteint | `notifications.read` | `catalog.ts:1272-1280` |
| `ADMIN_SMS_CAP_NON_OTP` | Quota de SMS hors code atteint | `notifications.read` | `catalog.ts:1281-1291` |
| `ADMIN_SMS_OPTIONAL_80` | SMS optionnels à 80 % du plafond | `notifications.read` | `catalog.ts:1292-1302` |
| `ADMIN_SMS_FORECAST` | Rappels de demain au-delà du budget SMS | `notifications.read` | `catalog.ts:1303-1313` |

Exemple, cloche de l’avis `ADMIN_EVENT_SUBMITTED` : « Événement à valider » / « « {titre} » de {organisateur} attend
votre validation. » ; « « Concert Test » de Fatou Diop attend votre validation. » (`catalog.ts:1192-1195`). Essai 90.

Un ADMIN sans aucune permission ne reçoit aucun de ces avis.

## 11.20 Ce qu’aucun écran d’administration ne permet

| Besoin | État | Preuve |
|---|---|---|
| Changer les rôles d’un compte existant (ajouter CONTRÔLEUR, retirer ADMIN…) | la route PATCH accepte `roles`, aucun écran ne l’envoie ; le menu dit pourtant « Utilisateurs et rôles » | `app/api/admin/users/route.ts:304-312` ; `app/admin/users/page.tsx:214-218` (seuls `status` et `reason` sont envoyés) ; `AppLayout.tsx:192` |
| Modifier les taux et durées du parrainage | « La personnalisation des taux n’est pas disponible pour le moment. » | `app/admin/referral/page.tsx:231-233` |
| Publier des offres d’abonnement | aucune page, aucune route d’écriture | 01.13 |
| Lire les écarts de caisse consolidés (`shifts.read`) | route sans écran | `app/api/admin/shifts/audit/route.ts:13-14` |
| Gérer les mises en avant (`/api/admin/promotions`) | route sans écran (recherche dans `app` et `components` sans résultat) | `app/api/admin/promotions/route.ts:9-31` |
| Envoyer une campagne | désactivé | 11.15 |

## NON VÉRIFIÉ

- Valeurs actuelles des réglages et des interrupteurs sur event-village-dev.
- Règle de mot de passe du service d’authentification du projet distant (seule la configuration locale est lue).
- Lecture des clés anciennes de `platform_settings` (hors `ticketing_fee_config`) par du code : seules les recherches
  ci-dessus ont été faites.
