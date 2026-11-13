# 01. Rôles, menus et écrans

Ce fichier décrit, pour chaque rôle, ce que la personne voit dans l’application : les entrées du menu latéral et de la
barre du bas dans l’ordre affiché, la page ouverte par chaque entrée, ce qu’elle montre et ce qu’on peut y faire, les
pages présentes mais pas encore utilisables, et la façon de passer d’un espace à l’autre. Le détail des actions est
dans les fichiers de chaque domaine (02 comptes, 03 partenaire, 04 événements, 05 contrôle, 06 achat, 07 billets,
08 argent, 09 parrainage, 10 notifications, 11 administration).

Source : le code de `main` (`0889df6`). Les preuves sont données en `fichier:ligne`, `M/` = `supabase/migrations/`.
Les textes entre guillemets « » sont recopiés tels quels du code.

## Sommaire

- 01.0 Mécanique commune : la coquille de l’application et les contrôles d’accès
- 01.1 à 01.4 Visiteur, client, accès refusé, retour après connexion
- 01.5 à 01.8 Partenaire en attente, validé, refusé, suspendu
- 01.9 Contrôleur
- 01.10 et 01.11 ADMIN (avec et sans chaque permission) et SUPERADMIN
- 01.12 Passer d’un espace à l’autre (comptes à plusieurs rôles)
- 01.13 Pages présentes mais pas encore utilisables
- 01.14 Pages qu’aucun menu n’ouvre
- Preuves complémentaires

---

## 01.0 Mécanique commune

### La coquille de l’application

Toutes les pages, sauf l’espace contrôleur (`/controller/…`) et le billet hors ligne (`/billet/hors-ligne`), sont
affichées dans la même coquille (`components/layout/AppLayout.tsx:325-329`, `app/layout.tsx:76`) :

| Zone | Quand | Contenu |
|---|---|---|
| Barre latérale | écran de 1024 px et plus | logo, menu du rôle, puis en bas : nom et sous-titre du compte (lien vers `/profile`), bouton « Se déconnecter », bascule de thème ; sans session : bouton « Se connecter » (`AppLayout.tsx:375-410`) |
| Tiroir | écran de moins de 1024 px, bouton « Ouvrir le menu » | même menu ; sous 640 px, un champ « Rechercher un événement » qui ouvre `/explore` (`AppLayout.tsx:413-473`, `:437-446`) |
| En-tête | toujours | champ « Rechercher un événement, un concert, un restaurant… » vers `/explore` (640 px et plus), cloche des notifications, bouton « Scanner » vers `/controller/scanner` si le compte a le rôle CONTRÔLEUR (640 px et plus), bascule de thème (moins de 1024 px), avatar vers `/profile` ou icône « Se connecter » (`AppLayout.tsx:477-540`) |
| Barre du bas | écran de moins de 1024 px | 5 entrées au plus, choisies selon l’espace (voir chaque rôle) (`AppLayout.tsx:331-337`, `:549-571`) |

Le sous-titre sous le nom du compte est « Ambassadeur » pour un ambassadeur, sinon le libellé du rôle principal :
« Super administrateur », « Administrateur », « Partenaire », « Contrôleur », « Client » (`AppLayout.tsx:81-91`,
`:321`). Le nom affiché est le prénom et le nom ; à défaut, la partie avant « @ » d’une adresse email réelle ; sinon
« Mon compte » (`AppLayout.tsx:311-313`).

La cloche (`components/notifications/NotificationBell.tsx`) : sans session, elle ouvre `/login` (`:329-332`) ; avec
session, elle ouvre un panneau « Notifications » avec les filtres « Toutes » et « Non lues (n) », et deux liens « Voir
toutes les notifications » (`/notifications`) et « Préférences » (`/profile/notifications`) (`:366`, `:393-399`,
`:491-496`). Son nom pour les lecteurs d’écran : « Notifications, {n} non lue(s) » (`:312-314`).

Les entrées des services hors billetterie (salles, tables, repas) n’apparaissent que si leur interrupteur SUPERADMIN
est ouvert (`features.halls_enabled`, `features.tables_enabled`, `features.orders_enabled`), et restent masquées tant
que les interrupteurs ne sont pas lus (`AppLayout.tsx:49-75`). Les trois interrupteurs valent `false` à l’installation
(`M/20261105000001_lot7_reglages.sql:34-39`). Leur valeur actuelle sur event-village-dev : NON VÉRIFIÉ (aucune lecture
de base distante autorisée) ; ce guide suppose les trois services fermés.

### Les contrôles d’accès

1. **Le filtre des adresses** (`middleware.ts`) s’applique à chaque page :
   - Pages ouvertes sans session : `/`, `/explore`, `/login`, `/register`, `/forgot-password`, `/reset-password`,
     `/halls`, `/partner/register`, `/controller/setup`, `/verify-email`, toute adresse commençant par `/events/`,
     `/halls/` ou `/restaurants/`, et `/billet/hors-ligne` (`middleware.ts:4-28`, `:54-66`, `:107-111`).
   - Toute autre page sans session renvoie vers `/login?redirect=<page demandée>` (`middleware.ts:171-186`).
   - Avec session, `/login`, `/register` et `/forgot-password` renvoient vers l’espace du compte : ADMIN ou
     SUPERADMIN → `/admin/dashboard` ; sinon PARTENAIRE → `/partner/dashboard` ; sinon CONTRÔLEUR →
     `/controller/scanner` ; sinon `/` (`middleware.ts:112-115`, `:208-219`).
   - `/admin…` exige ADMIN ou SUPERADMIN (`:224-229`) ; `/scan` et `/partner/scan` exigent CONTRÔLEUR, ADMIN,
     SUPERADMIN ou PARTENAIRE (`:232-237`) ; `/controller…` exige CONTRÔLEUR, ADMIN ou SUPERADMIN **et** un compte
     au statut actif (`:240-259`) ; les autres `/partner…` exigent PARTENAIRE, ADMIN ou SUPERADMIN (`:262-267`).
   - Les rôles sont lus dans la table des rôles (`user_roles`), jamais dans le profil modifiable (`:192-205`). Si la
     lecture échoue : retour à l’accueil avec un message (`:198-204`).
2. **Les gardes des pages** : l’espace partenaire a sa propre garde (`app/partner/layout.tsx`, voir 01.5) ; l’espace
   administration n’a pas de garde de page en plus du filtre (aucun `app/admin/layout.tsx`) : chaque écran demande ses
   données à une route qui vérifie le rôle, le statut actif et la permission (voir 11).
3. **Les routes du serveur** : 121 routes appellent `requireActiveSession` (relevé par recherche dans `app/api`), qui
   refuse tout compte dont le statut n’est pas « actif » avec « Votre compte n'est pas actif. Contactez le support. »
   (`lib/auth/session.ts:47-65`). Quelques routes admettent aussi le statut « en attente » : notifications,
   préférences, abonnement push, renvoi du lien de vérification d’email, et côté partenaire le tableau de bord, la
   création d’événement (pour répondre « profil non validé »), le profil, le complément de dossier et la consultation
   des pièces (`app/api/notifications/route.ts:92`, `app/api/notifications/preferences/route.ts:103`,
   `app/api/push/subscriptions/route.ts:58`, `app/api/account/email/resend/route.ts:32`,
   `app/api/partner/dashboard/route.ts:18`, `app/api/partner/events/route.ts:72`, `app/api/partner/profile/route.ts:115`,
   `app/api/partner/dossier/complete/route.ts:39`, `app/api/partner/documents/signed-url/route.ts:63`).

### Messages de refus affichés à l’accueil

Quand le filtre refuse une page à une personne connectée, il la renvoie sur l’accueil `/?error=<clé>` et l’accueil
affiche un bandeau orange (`components/layout/AccessNotice.tsx:13-17`, `app/page.tsx:157`) :

| Situation | Texte exact (`lib/auth/access-errors.ts:7-13`) |
|---|---|
| Page `/admin…` sans rôle ADMIN ni SUPERADMIN | « Cet espace est réservé aux administrateurs. » |
| Page `/partner…` sans rôle PARTENAIRE, ADMIN ni SUPERADMIN | « Cet espace est réservé aux partenaires. » |
| Page `/scan` ou `/partner/scan` sans rôle de contrôle | « Le contrôle des billets est réservé aux contrôleurs et aux organisateurs. » |
| Page `/controller…` sans rôle ou compte non actif | « Cet espace est réservé aux contrôleurs dont le compte est actif. » |
| Lecture des rôles impossible | « Vérification de vos droits impossible pour le moment. Réessayez dans un instant. » |

---

## 01.1 Visiteur (sans compte ou non connecté)

**Menu latéral** (`AppLayout.tsx:129-135`, `:138-141`, `:207-209`, `:363-369`) :

| Section | Entrée | Page | Ce qu’elle montre, ce qu’on y fait |
|---|---|---|---|
| Menu principal | Accueil | `/` | Bandeau « Découvrez, réservez et vivez les événements qui comptent. », recherche « Artiste, lieu, organisateur… » et bouton « Explorer », liste « À l’affiche », découverte (populaires, près de chez vous), encart « Vous organisez des événements ? Vendez vos billets avec Event Village. » avec « Devenir partenaire » (`app/page.tsx:170-196`, `:220`, `:318-340`) |
| | Explorer | `/explore` | « Explorer les événements » : catalogue des événements à venir, recherche et filtres, mise à jour en direct (`app/explore/page.tsx:193-194`) |
| | Mes billets | `/tickets` | renvoi vers la connexion (page protégée) |
| | Commandes | `/orders` | masquée tant que les trois services sont fermés |
| | Portefeuille | `/wallet` | renvoi vers la connexion |
| Services et espaces | Salles de fête ; Restaurants et tables | `/halls` ; `/restaurants/rest-terrou-bi/tables` | masquées tant que leur service est fermé |
| Espaces métier | Devenir partenaire | `/partner/register` | inscription d’un organisateur (voir 03) |

Bas de la barre latérale : « Se connecter ». **Barre du bas** : Accueil, Explorer, Billets, (Achats si un service est
ouvert), Portefeuille (`AppLayout.tsx:129-135`, `:337`, libellés courts `:132-133`).

### Scénario 01.1 — Un visiteur ouvre une page réservée

1. Qui, où : visiteur non connecté ; il touche « Mes billets », « Portefeuille », ou saisit `/profile`, `/notifications`, `/admin/…`.
2. Ce qu’il saisit : rien.
3. Ce que fait le système : le filtre l’envoie vers `/login?redirect=<page>` ; après connexion il revient à la page demandée (`middleware.ts:183-185`). Les fiches d’événement (`/events/…`) restent ouvertes (`middleware.ts:108-111`).
4. Messages envoyés : aucun.
5. Ce que voient les autres rôles : rien.
6. Impossible : voir une page protégée sans compte. Les pages client gardent un état « Connectez-vous… » (ex. « Connectez-vous pour voir vos billets », `app/tickets/page.tsx:264`) qui n’apparaît que si la session expire pendant la visite.
7. Preuves : `middleware.ts:171-186`. Essai 3 de `docs/recette-billetterie.md`.

---

## 01.2 Client (compte actif, rôle CLIENT seul)

**Menu latéral** : identique au visiteur, avec les pages accessibles (`AppLayout.tsx:363-369`) :

| Section | Entrée | Page | Ce qu’elle montre, ce qu’on y fait |
|---|---|---|---|
| Menu principal | Accueil | `/` | comme le visiteur |
| | Explorer | `/explore` | comme le visiteur |
| | Mes billets | `/tickets` | « Mes billets » ; onglets « À venir », « Tous mes billets », « Historique », « Reçus » ; QR tournant, PDF, hors ligne, transfert (voir 07) (`app/tickets/page.tsx:253-256`, `:278-279`) |
| | Commandes (si un service est ouvert) | `/orders` | « Mes commandes et réservations » ; onglets Tables, Salles, Repas selon les services ouverts (`app/orders/page.tsx:41-43`, `:169-170`) ; page introuvable si les trois sont fermés (`app/orders/layout.tsx:15`) |
| | Portefeuille | `/wallet` | « Portefeuille de parrainage » : soldes, retrait, lien de parrainage, « Mes retraits », « Historique du compte » (voir 09) (`app/wallet/page.tsx:593-594`, `:1001`, `:1077`, `:1118`) |
| Services et espaces | (si ouverts) Salles de fête, Restaurants et tables | voir 01.13 | |
| Espaces métier | Devenir partenaire | `/partner/register` | voir 03 |

Bas de la barre latérale : nom, « Client » (ou « Ambassadeur »), « Se déconnecter », thème. **Barre du bas** : Accueil,
Explorer, Billets, (Achats), Portefeuille.

Autres écrans du client, sans entrée de menu mais atteints par l’avatar, la cloche ou un lien :

| Page | Accès | Contenu |
|---|---|---|
| `/profile` « Mon profil » | avatar, nom en bas de la barre latérale | identité, rôle et statut, formulaire du profil, raccourcis « Préférences de notification », « Mes paiements », « Portefeuille de parrainage », thème, « Se déconnecter » (`app/profile/page.tsx:164-179`, `:211-212`, `:265-285`, `:316-322`) |
| `/profile/notifications` « Préférences de notification » | profil, cloche | « Choisissez comment Event Village vous prévient. Les messages indispensables partent toujours. » (voir 02 et 10) (`app/profile/notifications/page.tsx:255-256`) |
| `/profile/payments` « Mes paiements » | profil | historique des paiements et remboursements (`app/profile/payments/page.tsx:77`) |
| `/notifications` « Notifications » | cloche | liste complète, mise à jour en direct (`app/notifications/page.tsx:344-345`) |
| `/paiement/<id>` | après un achat | page d’attente du paiement (voir 06) |
| `/invitations` « Invitations à contrôler » | lien du SMS ou de la notification | voir 01.14 et 05 |

### Scénario 01.2 — Un client ouvre un espace qui n’est pas le sien

1. Qui, où : client connecté ; il saisit `/admin/dashboard`, `/partner/dashboard`, `/scan` ou `/controller/scanner`.
2. Ce qu’il saisit : rien.
3. Ce que fait le système : le filtre le renvoie sur l’accueil avec une clé d’erreur ; rien n’est enregistré côté écran (le filtre écrit seulement une trace serveur en cas de panne de lecture des rôles, `middleware.ts:199`).
4. Messages envoyés : aucun.
5. Ce que voient les autres rôles : rien.
6. Refus affiché sur l’accueil : « Cet espace est réservé aux administrateurs. », « Cet espace est réservé aux partenaires. », « Le contrôle des billets est réservé aux contrôleurs et aux organisateurs. » ou « Cet espace est réservé aux contrôleurs dont le compte est actif. ».
7. Preuves : `middleware.ts:224-267`, `lib/auth/access-errors.ts:7-13`.

### Scénario 01.3 — Un client suspendu se reconnecte

1. Qui, où : client dont le compte a été suspendu par un admin (voir 11.4 et 02) ; il ouvre `/login`.
2. Ce qu’il saisit : numéro ou email et mot de passe.
3. Ce que fait le système : la route de connexion par mot de passe ne lit pas le statut du compte et ouvre une session (`app/api/auth/login/route.ts:88-101`) ; un test du lot 6 l’écrit aussi : « GoTrue délivre encore un jeton » (`tests/parcours/dette-suspendu-temps-reel.test.ts:5-6`). Mais l’écran de connexion relit aussitôt le statut : pour un compte `SUSPENDU`, il détache l’appareil du push, **ferme la session** et reste sur `/login` (`components/auth/LoginForm.tsx:269-287` ; appelé après la connexion par mot de passe, `:365`, et par code, `:489`). La fermeture de session efface aussi les billets hors ligne de l’appareil (voir 02.17 et 07.18). Seul un appel direct à la route, hors écran, garde une session ; chaque action qui exige un compte actif lui est alors refusée.
4. Messages envoyés : aucun à la connexion.
5. Ce que voient les autres rôles : rien.
6. Refus : à l’écran de connexion, « Votre compte est suspendu. Veuillez contacter le support. » (`components/auth/LoginForm.tsx:283-284`). Hors écran (session ouverte par appel direct, ou jeton encore valable au moment de la suspension) : « Votre compte n'est pas actif. Contactez le support. » sur chaque route protégée (`lib/auth/session.ts:56-63`). Écart : le serveur de connexion ne refuse pas lui-même un compte suspendu, seul l’écran le fait (constat W1-04 de `15-constats.md`).
7. Preuves : ci-dessus. Essai 73. *(Passe de cohérence : scénario recalé sur `LoginForm.tsx:269-287`, que 02.17 et 03.10 citaient déjà.)*

### Scénario 01.4 — Retour à l’espace après connexion

1. Qui, où : toute personne qui se connecte depuis `/login`.
2. Ce qu’il saisit : identifiant et mot de passe, ou code (voir 02).
3. Ce que fait le système : sans adresse de retour, une page d’authentification ouverte avec une session renvoie vers `/admin/dashboard` (ADMIN ou SUPERADMIN), sinon `/partner/dashboard` (PARTENAIRE), sinon `/controller/scanner` (CONTRÔLEUR), sinon `/`.
4. Messages envoyés : aucun.
5. Ce que voient les autres rôles : rien.
6. Impossible : rester sur `/login`, `/register` ou `/forgot-password` une fois connecté.
7. Preuves : `middleware.ts:208-219`. Essai 2.

---

## 01.5 Partenaire en attente de validation

Après l’inscription (voir 03), le compte a les rôles CLIENT et PARTENAIRE, le statut « en attente » et une fiche
partenaire « en attente » (`app/api/partner/register/route.ts:200-206`, `M/20261109000004_lot9bis_droits.sql:589-605`).

**Dans l’espace partenaire** (`/partner/…`), le menu latéral est le menu complet de la partenaire (voir 01.6), mais la
garde de l’espace ramène toute page autre que `/partner`, `/partner/dashboard` et `/partner/profile` (et leurs
sous-pages) vers le tableau de bord ; `/partner/scan` reste ouvert (`app/partner/layout.tsx:13-17`, `:44-49`, `:55-57`).

| Page ouverte | Ce qu’elle montre |
|---|---|
| `/partner/dashboard` | bandeau « Compte en cours de vérification » : « Vos pièces sont vérifiées par l’équipe Event Village. Vous recevrez un SMS dès la validation de votre compte ; vous pourrez alors créer et publier vos événements. En attendant, votre profil reste modifiable. », bouton « Voir mon profil » (`app/partner/dashboard/page.tsx:452-462`) |
| `/partner/profile` | « Page professionnelle » affichée avec son formulaire (`app/partner/profile/page.tsx:160-161`) ; la lecture admet le statut « en attente », mais l’enregistrement exige un compte actif : « Enregistrer » est refusé avec « Votre compte n'est pas actif. Contactez le support. » (`app/api/partner/profile/route.ts:114-115`, `:136-137`), malgré le « votre profil reste modifiable » du bandeau (voir 03.4, constat W3-01) |

**Dans l’espace client**, la section « Espaces métier » propose « Espace partenaire » (`AppLayout.tsx:201-202`) et le
profil affiche le badge « Partenaire en attente de validation » (`app/profile/page.tsx:220-224`). Les routes qui
exigent un compte actif refusent le statut « en attente » : par exemple, acheter un billet répond « Votre compte n'est
pas actif. Contactez le support. » (`app/api/checkout/route.ts:15`, `lib/auth/session.ts:51-63`).

### Scénario 01.5 — Une partenaire en attente ouvre « Événements »

1. Qui, où : partenaire en attente, espace partenaire, menu « Gestion » > « Événements ».
2. Ce qu’elle saisit : rien.
3. Ce que fait le système : la garde de l’espace la renvoie sur `/partner/dashboard` (côté navigateur). Le serveur reste juge : une création d’événement est refusée.
4. Messages envoyés : aucun.
5. Ce que voient les autres rôles : rien.
6. Refus serveur à la création : « Votre profil d’organisateur doit être validé avant de créer un événement. » (`app/api/partner/events/route.ts:87-92`).
7. Preuves : `app/partner/layout.tsx:55-57`. Essai 80.

---

## 01.6 Partenaire validée

**Menu latéral dans l’espace partenaire** (`AppLayout.tsx:144-160`, `:352-361`) :

| Section | Entrée | Page | Ce qu’elle montre, ce qu’on y fait |
|---|---|---|---|
| Gestion | Tableau de bord | `/partner/dashboard` | « Ventes, entrées et solde de vos événements. » ; boutons « Actualiser », « Export comptable », « Scanner des billets » ; indicateurs « Ventes en ligne », « Net partenaire », « Billets vendus »… ; période d’essai ; étapes du premier événement (voir 03) (`app/partner/dashboard/page.tsx:405-432`, `:486-520`) |
| | Événements | `/partner/events` | « Mes événements » : « Soumettez, publiez et pilotez vos événements. » ; chaque événement ouvre son pilotage `/partner/events/<id>` (ventes, équipe, caisses, remboursements) (voir 04, 05, 08) (`app/partner/events/page.tsx:203-204`) |
| | Produits et menu | `/partner/products` | masquée (service des repas fermé) |
| | Salles de fête | `/partner/halls` | masquée (service des salles fermé) |
| | Tables | `/partner/tables` | masquée (service des tables fermé) |
| | Commandes | `/partner/orders` | masquée (service des repas fermé) |
| | Équipe | `/partner/team` | « Équipe de contrôle » : invitations, affectations, retraits (voir 05) (`app/partner/team/page.tsx:535`) |
| Outils | Finances | `/partner/finance` | « Finances » : « Ventes en ligne de vos événements. Les ventes en espèces et les invitations n’alimentent pas ce solde. » ; solde, retraits (voir 08) (`app/partner/finance/page.tsx:533-534`) |
| | Statistiques | `/partner/stats` | « Statistiques » : « Données réelles isolées à votre espace partenaire » (`app/partner/stats/page.tsx:162-168`) |
| | Scanner les billets | `/partner/scan` | « Contrôle des entrées » : choix d’un événement dont le contrôle est ouvert, caméra ou saisie manuelle (voir 05) (`app/partner/scan/page.tsx:430-434`) |
| | Calendrier | `/partner/calendar` | « Calendrier Événementiel » : « Visualisez le planning de vos événements et réservations. » ; bouton « Nouvel événement » ; affiche tous les événements de la partenaire (`app/partner/calendar/page.tsx:15-33`, `:41-52`) |
| | Abonnement | `/partner/subscription` | « Abonnement » : période d’essai, offre actuelle, offres publiées (voir 01.13) |
| | Profil partenaire | `/partner/profile` | « Page professionnelle » (voir 03) |
| (pied) | Retour au site | `/` | revient à l’espace client |

**Barre du bas dans l’espace partenaire** : Accueil (`/partner/dashboard`), Billetterie (`/partner/events`), Scanner
(`/partner/scan`), Finances, Profil (`/partner/profile`) (`AppLayout.tsx:161-167`, `:331-332`).

**Dans l’espace client**, la partenaire voit le menu client, la section « Espaces métier » avec « Espace partenaire »
(`AppLayout.tsx:201-202`), et dans son profil le raccourci « Espace partenaire » et le badge « Partenaire validé »
(`app/profile/page.tsx:180-187`, `:223`). La barre du bas reste celle du client.

---

## 01.7 Partenaire refusée

Après un refus (voir 03 et 11.7), le statut du compte redevient « actif » et la fiche passe « refusée »
(`M/20261109000006_lot9bis_argent.sql:837-841`, fonction `partner_status_set`). La garde de l’espace ne bloque que le statut « en
attente » : le menu partenaire complet reste ouvert (`app/partner/layout.tsx:55`). Le tableau de bord affiche :

- titre « Demande de compte partenaire refusée », « Motif : {motif} » (ou « Aucun motif n’a été précisé. ») ;
- si le dossier n’a jamais été complété : « Vous pouvez compléter votre dossier une fois : il repasse alors en
  vérification. » et le bouton « Compléter mon dossier » ;
- sinon : « Votre dossier a déjà été complété une fois. Contactez le support pour la suite. » et « Contacter le
  support » si l’adresse du support est configurée (`app/partner/dashboard/page.tsx:463-476`, `:278`).

Exemple rempli : « Motif : Pièce d’identité illisible. Vous pouvez compléter votre dossier une fois : il repasse alors
en vérification. »

Le profil affiche « Partenaire en attente de validation » (`app/profile/page.tsx:223`), alors que le dossier est refusé :
écart noté dans les constats. Créer un événement est refusé par le serveur (« Votre profil d’organisateur doit être
validé avant de créer un événement. », `app/api/partner/events/route.ts:87-92`).

---

## 01.8 Partenaire suspendue

La suspension (voir 11.8 et 03) met la fiche « suspendue », le compte au statut « suspendu », ferme ses sessions et
suspend ses événements en ligne (`M/20261109000006_lot9bis_argent.sql:837-841`, `:855-857`, fonction
`partner_status_set` ; `app/api/admin/partners/[id]/status/route.ts:38-44`).

### Scénario 01.8 — Une partenaire suspendue revient dans l’application

1. Qui, où : partenaire suspendue. Si elle se reconnecte par l’écran `/login`, l’écran ferme aussitôt la session et affiche « Votre compte est suspendu. Veuillez contacter le support. » (voir 01.3, `components/auth/LoginForm.tsx:280-285`) : elle n’atteint aucune page. Le cas ci-dessous est celui d’un onglet resté ouvert sur `/partner/dashboard` avec un jeton encore valable (au plus une heure après la fermeture de ses sessions : durée du jeton `jwt_expiry = 3600` de la configuration locale, `supabase/config.toml:152`, projet distant NON VÉRIFIÉ), ou d’une session ouverte hors écran.
2. Ce qu’elle saisit : rien.
3. Ce que fait le système : le menu partenaire s’affiche (la garde ne regarde que le statut « en attente »), mais le tableau de bord lit une route qui n’admet que les comptes actifs ou en attente : elle répond 403.
4. Messages envoyés : aucun à ce moment (l’avis de suspension `PARTNER_SUSPENDED` est parti à la suspension, voir 11.8).
5. Ce que voient les autres rôles : rien.
6. Écran affiché : « Tableau de bord indisponible » avec « Votre compte n'est pas actif. Contactez le support. Aucun chiffre n’est affiché tant que le serveur n’a pas répondu. » Le bandeau prévu « Compte partenaire suspendu » (« Vos événements en ligne sont suspendus et vos fonds sont gelés jusqu’à la réactivation du compte. Contactez le support Event Village. ») n’est donc jamais affiché : écart noté dans les constats. Les autres pages partenaire lisent des routes qui exigent un compte actif et affichent le même refus.
7. Preuves : `app/api/partner/dashboard/route.ts:18`, `lib/auth/session.ts:56-63`, `app/partner/dashboard/page.tsx:436-441`, `:477-482`, `components/partner/useServerData.ts:45-48`. Essai 55.

---

## 01.9 Contrôleur

Un contrôleur a les rôles CLIENT et CONTRÔLEUR (création par invitation, voir 05, ou par un admin, voir 11.2).

**Espace contrôleur** (`/controller/…`) : thème sombre forcé, pas de barre latérale ni de barre du bas ; un en-tête
avec (`app/controller/layout.tsx:49-98`) :

- « Mon espace client » (flèche, vers `/`, info-bulle « Basculer vers l’espace client (billetterie, réservations,
  commandes) ») ;
- la cloche ; le nom (vers `/controller/profile`) ;
- hors de l’écran de scan, « Se déconnecter », qui demande « Se déconnecter ? » / « Vous serez déconnecté de tous vos
  appareils. Vous devrez vous reconnecter pour accéder au scanner. » / « Déconnexion ».

| Page | Contenu |
|---|---|
| `/controller/scanner` | scanner des événements affectés (voir 05) ; sans affectation : « Aucun événement assigné » / « Vous serez informé lorsqu’un nouvel événement vous sera assigné. » et « Retour à l’accueil » (`app/controller/scanner/page.tsx:920-933`) |
| `/controller/profile` « Mon profil » | « Vos informations, vos événements et la sécurité du compte. » ; bouton « Préférences de notification » ; « Mon événement » ou « Mes événements (n) » ; « Changer le mot de passe » avec la règle « 8 caractères au moins, avec une majuscule, une minuscule et un chiffre. » (`app/controller/profile/page.tsx:187-188`, `:238-245`, `:283-286`) |
| `/controller/setup` « Activer votre compte contrôleur » | activation d’un nouveau contrôleur par le code du SMS (voir 05) (`app/controller/setup/page.tsx:174-175`) |

**Dans l’espace client**, le contrôleur voit :

- le menu client, et dans « Espaces métier » : « Scanner les billets » (`/controller/scanner`) (`AppLayout.tsx:203-204`) ;
- le bouton « Scanner » de l’en-tête (640 px et plus) (`AppLayout.tsx:508-514`) ;
- la **barre du bas du contrôleur** : Accueil, Explorer, Scanner (`/controller/scanner`), Billets (`/tickets`),
  Profil (`/controller/profile`) (`AppLayout.tsx:178-184`, `:335-336`) ;
- dans son profil, le raccourci « Contrôle des billets », qui ouvre `/partner/scan` et non le scanner du contrôleur
  (`app/profile/page.tsx:189-196`). Pour un contrôleur sans fiche partenaire, cette page affiche « Accès réservé aux
  partenaires. » puis « Contrôleur d’un événement ? Utilisez le scanner contrôleur, depuis votre espace contrôleur. »
  et « Ouvrir le scanner contrôleur » (`app/api/partner/events/route.ts:21-22`, `app/partner/scan/page.tsx:150`,
  `:452-462`) : écart noté dans les constats.

Un contrôleur dont le compte n’est pas actif ne peut ouvrir aucune page `/controller…` (« Cet espace est réservé aux
contrôleurs dont le compte est actif. », `middleware.ts:240-259`).

---

## 01.10 ADMIN

**Dans l’espace administration** (`/admin/…`), menu latéral (`AppLayout.tsx:211-242`, `:339-351`) :

| Section | Entrée | Page | Permission qui ouvre les données (détail dans 11) |
|---|---|---|---|
| (badge) | « Administration » | — | — |
| | Tableau de bord | `/admin/dashboard` | `statistics.read` (indicateurs), `events.read` (compteur), `partners.read` (candidatures) |
| Gestion | Événements | `/admin/events` | `events.read` ; actions : `events.write` |
| | Utilisateurs | `/admin/users` | `users.read` ; actions : `users.write` |
| | Catalogues et services | `/admin/services` | `events.read` |
| Finances | Finance | `/admin/finance` | `payments.read` ; versements : `refunds.manage` |
| | Tarification | `/admin/pricing` | aucune (simple renvoi) |
| Engagement | Parrainage | `/admin/referral` | `referrals.manage` (taux) et `users.read` (liste) |
| | Communications | `/admin/communications` | `communications.manage` |
| Système | Journal d’audit | `/admin/audit` | SUPERADMIN seulement (entrée absente pour un ADMIN) |
| | Notifications | `/admin/notifications` | `notifications.read` ; relance : `notifications.write` |
| | Scanner | `/scan` | aucune (renvoi vers `/partner/scan`, voir 11.18) |
| (pied) | Retour au site | `/` | — |

**Barre du bas dans l’espace administration** : Accueil (`/admin/dashboard`), Validation (`/admin/events`), Comptes
(`/admin/users`), Finance (`/admin/finance`), et Audit pour le SUPERADMIN seulement (`AppLayout.tsx:170-176`,
`:333-334`).

Le menu ne dépend pas des permissions : un ADMIN voit toutes les entrées ci-dessus (sauf le journal) même sans aucune
permission ; c’est chaque écran qui dit le refus (`AppLayout.tsx:211-242` ne lit que les rôles). La page « Réglages de
la plateforme » (`/admin/finance-settings`) n’est dans aucun menu : on l’ouvre par le bouton « Réglages de la
plateforme » de la page Finance ou par « Ouvrir les Réglages de la plateforme » de la page Tarification
(`app/admin/finance/page.tsx:177-179`, `app/admin/pricing/page.tsx:34-36`).

**ADMIN sans permission** (compte créé par un SUPERADMIN, aucune ligne de permission : rien n’est accordé par défaut,
`app/api/admin/users/route.ts:178-185` n’ajoute que le rôle) — ce qu’il voit sur chaque écran :

| Écran | Ce qui s’affiche sans la permission |
|---|---|
| Tableau de bord | « Indicateurs indisponibles » ; « Événements à valider » vaut « — » avec « Votre compte n’a pas accès à la modération des événements. » ; « Candidatures indisponibles » avec « Votre compte n’a pas l’autorisation de consulter les partenaires. » (`app/admin/dashboard/page.tsx:236-238`, `:259-261`, `:488-492`, `:551-557`, `:612-618`) |
| Événements, Utilisateurs, Catalogues, Finance, Communications | message de la route, sur le modèle « Action non autorisée : votre compte n’a pas la permission « {libellé} ». », par exemple « Action non autorisée : votre compte n’a pas la permission « Consulter les événements ». » (`lib/admin/permission-labels.ts:33-35`) |
| Finance, bloc « Versements à reprendre » | « Reprise des versements réservée » / « Votre compte n’a pas la permission de gérer les remboursements et les versements. » (`components/admin/RefundsToRetry.tsx:425-429`) |
| Parrainage | liste vide « Aucun utilisateur trouvé. » sans dire pourquoi, et bandeau « Taux et durées du parrainage indisponibles » (`app/admin/referral/page.tsx:83-86`, `:101-109`, `:297-302`) |
| Notifications | « Accès refusé » / « Vous n'avez pas la permission de consulter les notifications. » avec « Retour à l’administration » (`app/admin/notifications/page.tsx:98`, `:428-436`) |
| Réglages de la plateforme | lecture seule, ouverte à tout ADMIN (voir 11.13) |

**ADMIN avec une permission** : chaque permission ouvre un écran ou des boutons précis. Le tableau complet (ce
qu’elle ouvre, ce qu’elle bloque, avec preuves) est en 11, section « Les 16 permissions ».

**Dans l’espace client**, l’ADMIN voit le menu client et, dans « Espaces métier », dix entrées dans cet ordre :
« Administration », « Événements à valider », « Utilisateurs et rôles », « Catalogues et services », « Finance et
rapprochement », « Parrainage et ambassadeurs », « Tarification », « Communications et campagnes », « Notifications »,
« Scanner de contrôle » (`AppLayout.tsx:189-200`) — le SUPERADMIN en a onze : « Journal d’audit » s’intercale avant
« Notifications ». Son profil propose « Espace partenaire », « Contrôle des billets » et « Administration »
(`app/profile/page.tsx:180-206`). « Espace partenaire » ouvre `/partner/dashboard`, qui affiche pour un admin sans
fiche partenaire « Tableau de bord indisponible » / « Profil partenaire introuvable. Aucun chiffre n’est affiché tant
que le serveur n’a pas répondu. » (`app/api/partner/dashboard/route.ts:48-50`,
`lib/partner/partner-dashboard.service.ts:580`, `app/partner/dashboard/page.tsx:436-441`).

Un ADMIN dont le compte n’est pas actif passe le filtre des pages (qui ne lit que les rôles), mais toutes les routes
d’administration répondent « Votre compte n'est pas actif. Contactez le support. »
(`lib/admin/admin-auth.ts:177-188`).

---

## 01.11 SUPERADMIN

Même coquille que l’ADMIN, avec en plus :

- l’entrée « Journal d’audit » dans la section Système et l’entrée « Audit » dans la barre du bas
  (`AppLayout.tsx:198`, `:237`, `:334`) ; le raccourci « Journal d’audit » du tableau de bord
  (`app/admin/dashboard/page.tsx:647-651`) ;
- toutes les permissions (`lib/admin/admin-auth.ts:59-60`, `:223-224`) ;
- les boutons « Modifier » des Réglages de la plateforme, « Permissions » sur un compte ADMIN, la création d’un ADMIN
  ou d’un SUPERADMIN, et les actions sur un compte ADMIN (voir 11).

---

## 01.12 Passer d’un espace à l’autre

| Depuis | Vers | Comment (texte exact) | Preuve |
|---|---|---|---|
| Espace client | Espace partenaire | menu « Espaces métier » > « Espace partenaire » ; profil > « Espace partenaire » | `AppLayout.tsx:201-202` ; `app/profile/page.tsx:180-187` |
| Espace client | Administration | « Espaces métier » > « Administration » ; profil > « Administration » | `AppLayout.tsx:190` ; `app/profile/page.tsx:200-206` |
| Espace client | Scanner du contrôleur | « Espaces métier » > « Scanner les billets » (contrôleur sans rôle admin ni partenaire) ; bouton « Scanner » de l’en-tête ; barre du bas « Scanner » | `AppLayout.tsx:203-204`, `:508-514`, `:181` |
| Espace partenaire | Espace client | pied du menu « Retour au site » | `AppLayout.tsx:357-359` |
| Administration | Espace client | pied du menu « Retour au site » | `AppLayout.tsx:346-348` |
| Administration | Pilotage d’un événement | fiche admin d’un événement > « Ouvrir le pilotage » (`events.read`) | `app/admin/events/[id]/page.tsx:554-558` |
| Espace contrôleur | Espace client | en-tête « Mon espace client » | `app/controller/layout.tsx:52-59` |
| Espace contrôleur | Préférences | profil contrôleur > « Préférences de notification » (ouvre `/profile/notifications`, dans la coquille client) | `app/controller/profile/page.tsx:238-240` |

Règles pour un compte à plusieurs rôles (`AppLayout.tsx:117-121`, `:187-209`, `:331-337`) :

- Rôle ADMIN ou SUPERADMIN : la section « Espaces métier » montre la liste d’administration, jamais « Espace
  partenaire » ni « Scanner les billets », même si le compte est aussi partenaire ou contrôleur.
- Partenaire et contrôleur : la section montre « Espace partenaire » (hors de l’espace partenaire) ; le scanner reste
  joignable par le bouton « Scanner » de l’en-tête.
- « Devenir partenaire » n’apparaît que pour un compte sans rôle PARTENAIRE, ADMIN, SUPERADMIN ni CONTRÔLEUR.
- Barre du bas : dans l’espace partenaire, celle de la partenaire ; dans l’administration, celle de l’admin ; ailleurs,
  celle du contrôleur si le compte a le rôle CONTRÔLEUR, sinon celle du client.
- Un ADMIN qui ouvre une page `/partner/…` sans être partenaire voit le menu client (avec ses entrées
  d’administration), pas le menu partenaire (`AppLayout.tsx:352`).

---

## 01.13 Pages présentes mais pas encore utilisables

| Page | Où elle apparaît | Ce qu’elle affiche aujourd’hui | Preuve |
|---|---|---|---|
| Salles côté client `/halls`, `/halls/<id>` | menu « Salles de fête », accueil « Voir les salles », pied de page « Salles » : seulement si `features.halls_enabled` | service fermé : page « Erreur 404 » / « Page introuvable » / « Cette page n’existe pas ou n’est pas disponible. Vérifiez l’adresse, ou repartez de l’accueil. » avec « Retour à l’accueil » et « Voir les événements » | `app/halls/layout.tsx:13` ; `app/not-found.tsx:16-27` ; `app/page.tsx:343-357`, `:372-377` |
| Tables côté client `/restaurants/<id>/tables` | menu « Restaurants et tables » (si `features.tables_enabled`) ; le lien vise toujours `/restaurants/rest-terrou-bi/tables` | service fermé : « Page introuvable » ; service ouvert : page d’un restaurant d’exemple fixe (écart noté) | `AppLayout.tsx:140` ; `app/restaurants/[id]/tables/layout.tsx:13` |
| Menu d’un restaurant `/restaurants/<id>/menu` | aucun menu ; si `features.orders_enabled` | service fermé : « Page introuvable » ; ouvert : « Menu & Commande Traiteur — {restaurant} » | `app/restaurants/[id]/menu/layout.tsx:13` ; `app/restaurants/[id]/menu/page.tsx:145-147` |
| Commandes client `/orders` | menu « Commandes » si au moins un service est ouvert | les trois fermés : « Page introuvable » | `app/orders/layout.tsx:15` |
| Partenaire « Produits et menu » `/partner/products` | menu « Gestion », si `features.orders_enabled` | fermé : « Page introuvable » ; ouvert : « Produits & Menu » | `app/partner/products/layout.tsx:13` ; `app/partner/products/page.tsx:118-121` |
| Partenaire « Salles de fête » `/partner/halls` | si `features.halls_enabled` | fermé : « Page introuvable » ; ouvert : « Reservation de Salles » | `app/partner/halls/layout.tsx:13` ; `app/partner/halls/page.tsx:202-205` |
| Partenaire « Tables » `/partner/tables` | si `features.tables_enabled` | fermé : « Page introuvable » ; ouvert : « Tables & Zones » | `app/partner/tables/layout.tsx:13` ; `app/partner/tables/page.tsx:364-367` |
| Partenaire « Commandes » `/partner/orders` | si `features.orders_enabled` | fermé : « Page introuvable » ; ouvert : « Commandes » | `app/partner/orders/layout.tsx:13` ; `app/partner/orders/page.tsx:211-214` |
| Partenaire « Abonnement » `/partner/subscription` | toujours (menu « Outils ») | période d’essai (« Période d’essai gratuite en cours », « Période d’essai terminée » : « Terminée le {date}. Contactez le support pour choisir une offre. », « Période d’essai non démarrée » : « Elle démarre automatiquement à votre première visite du tableau de bord, une fois votre compte validé. »), « Offre actuelle » (« Aucune offre attribuée : vous utilisez la plateforme pendant votre période d’essai. »), « Offres disponibles ». Aucune migration ne crée d’offre et aucun écran d’administration n’en publie : la page affiche « Aucune offre n’est encore publiée » / « Les offres d’abonnement Event Village apparaîtront ici dès leur publication. » tant qu’aucune offre n’est saisie en base | `app/partner/subscription/page.tsx:80-81`, `:110-200` ; `app/api/partner/subscription/route.ts:113-115` ; recherche `INSERT INTO public.subscription_plans` sans résultat dans `supabase/migrations` |
| Admin « Catalogues et services » `/admin/services` | menu « Gestion » | onglets « Événements » (renvoi vers l’écran Événements), « Salles de fête », « Restaurants et tables », « Produits et traiteurs », « Commandes », en lecture ; un service fermé affiche « Service désactivé » / « Ce service est fermé par son interrupteur : il est masqué au public. Les données restent consultables ici. » | `app/admin/services/page.tsx:30-36`, `:227-231`, `:298-312` |
| Admin « Tarification » `/admin/pricing` | menu « Finances » | simple renvoi : « Les montants appliqués aux ventes et aux retraits ont une seule source : les Réglages de la plateforme. » | `app/admin/pricing/page.tsx:22-41` |
| Admin « Communications » `/admin/communications` | menu « Engagement » | brouillons seulement : « Envoi des campagnes désactivé » | voir 11.15 |

Le lot prévu pour chacun de ces services est dans `14-non-implemente.md`.

---

## 01.14 Pages qu’aucun menu n’ouvre

| Page | Comment on y arrive | Preuve |
|---|---|---|
| `/invitations` « Invitations à contrôler » | lien de la notification et du SMS d’invitation d’un compte existant (« Répondez sur {lien}/invitations ») | `lib/notifications/catalog.ts:1467`, `:1480` ; recherche de `/invitations` dans `app` et `components` : aucun lien de menu |
| `/tickets/claim/<jeton>` | ancien lien de réclamation : redirige vers `/tickets?tab=recus` | `app/tickets/claim/[token]/page.tsx:12` |
| `/billet/hors-ligne` « Billet hors ligne » | page autonome, sans menu ni session, mise en cache par l’application | `AppLayout.tsx:77-78` ; `middleware.ts:25-27` ; `app/billet/hors-ligne/page.tsx:95` |
| `/verify-email` « Vérifier mon adresse email » | lien de l’email de vérification | `app/verify-email/page.tsx:98-99` |
| `/paiement/<id>` | après le choix du moyen de paiement | voir 06 |
| `/admin/finance-settings` « Réglages de la plateforme » | bouton de la page Finance ou de la page Tarification | voir 01.10 |
| `/admin/notifications/<id>` | ligne de la supervision | voir 11.16 |
| `/admin/events/<id>` | bouton « Examiner » de la liste | voir 11.9 |
| `/partner/events/new`, `/partner/events/<id>`, `…/edit`, `…/team`, `…/caisse` | boutons de « Mes événements », du calendrier et du pilotage | voir 04 et 05 |
| `/scan` | ancienne adresse, redirige vers `/partner/scan` | `app/scan/page.tsx:4` |

---

## Essais du cahier de recette liés à ce fichier

Essai 2 (chaque compte arrive sur son espace), essai 3 (visiteur), essai 53 (admin sans droit), essai 57 (journal
réservé au superadmin), essai 73 (client suspendu), essai 80 (partenaire en attente).

## NON VÉRIFIÉ

- État actuel des interrupteurs `features.*` et des autres réglages sur event-village-dev (lecture de base interdite).
- Rendu réel des pages à 390 px et 1024 px : décrit d’après les classes de mise en page du code, pas d’après une capture.
