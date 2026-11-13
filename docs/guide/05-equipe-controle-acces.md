# 05 — Équipe de contrôle, zones et portes, scanner, guichet et caisse, tableau des entrées

> Guide complet de l'application Event Village, état de `main` à `0889df6` (lots 1 à 9 ter). Source de vérité : le code.
> Chaque fait porte sa preuve `fichier:ligne` (chemins relatifs au dépôt ; `M/` = `supabase/migrations/`).
> Ce qui n'a pas pu être établi est marqué **NON VÉRIFIÉ**. Données d'exemple fictives : partenaire « Concert Test
> Prod » (gérante « Fatou Diop »), contrôleur « Moussa Sow » (numéro `77 000 00 00`, forme enregistrée `+221770000000`),
> événement « Concert Test », adresse de l'application `https://app.eventvillage.sn` (celle des tests, 27 caractères).
> Les messages (canaux, heures calmes, plafonds) sont détaillés dans `10-notifications.md` ; les quotas chiffrés dans
> `13-limites-quotas-securite.md` ; la création des catégories dans `04-evenement-cycle.md` (04.15) ; le billet du
> client (QR tournant, billet hors ligne) dans `07-billets.md` ; les espèces à rembourser après une annulation dans
> `08-argent.md`. Les écarts relevés en écrivant ce fichier sont dans `15-constats.md` (identifiants W5-xx de la note
> de travail).

## Sommaire

| N° | Scénario |
|---|---|
| 05.1 | Les deux écrans de l'équipe et les états d'un membre |
| 05.2 | Inviter un nouveau numéro (compte créé, SMS d'activation) |
| 05.3 | Le contrôleur active son compte (`/controller/setup`) |
| 05.4 | Renvoyer le SMS d'activation ; expiration du code |
| 05.5 | Inviter un compte existant qui n'est pas contrôleur (consentement) |
| 05.6 | Contrôleur déjà actif : connu de la partenaire (affectation directe) ou venu d'une autre partenaire (consentement) |
| 05.7 | Le titulaire répond à l'invitation (`/invitations`) : accepter, refuser, invitation expirée |
| 05.8 | Affecter un contrôleur à plusieurs événements, « Gérer les affectations », permission espèces par événement |
| 05.9 | Onglet Équipe du pilotage : point d'entrée, permission espèces d'une affectation |
| 05.10 | Retirer un contrôleur : d'un événement, de tous les événements, de l'équipe (ce qu'il voit, reçoit, sa session) |
| 05.11 | Zones et portes : zone par défaut, types ENTRÉE et CONTRÔLE DE ZONE, catégories admises, portes |
| 05.12 | Porte d'un contrôleur, « Peut changer de porte », changement de porte par le contrôleur |
| 05.13 | Couleur et consigne d'entrée d'une catégorie : où elles se règlent, où elles s'affichent |
| 05.14 | Fenêtre d'ouverture du contrôle |
| 05.15 | Scanner : écran « Commencer le contrôle » |
| 05.16 | Scanner : lire un QR, chaque résultat (vert, orange, rouge, jaune, gris), texte exact et vibration |
| 05.17 | Scanner : incidents techniques, hors ligne, scan sans réponse, reprise après une sortie |
| 05.18 | Saisie manuelle d'un numéro de billet |
| 05.19 | Billet hors ligne présenté au contrôle |
| 05.20 | Liste des invités (invité sans smartphone) |
| 05.21 | Guichet : vente en espèces à l'entrée |
| 05.22 | Code PIN régisseur : générer, régénérer |
| 05.23 | Ouvrir sa caisse |
| 05.24 | Clôturer sa caisse : sans écart, avec écart (justification et PIN), Z de caisse |
| 05.25 | Fermer la caisse d'un contrôleur : par la partenaire ou par un admin |
| 05.26 | Caisse encore ouverte à la fin de l'événement |
| 05.27 | Onglet Entrées du pilotage (tableau de bord des entrées) |
| 05.28 | Alerte de refus en série à une porte |
| 05.29 | Scan par la partenaire (`/partner/scan`) et par l'administration |
| 05.30 | Tableau récapitulatif des messages de ce fichier |

Règles communes à tout le fichier :

- **Qui gère l'équipe.** Toutes les routes de l'équipe exigent une session active et le rôle partenaire, ou un admin :
  lecture avec la permission `events.read`, écriture avec `events.write` (SUPERADMIN toujours) ; un admin sans la
  permission reçoit `PERMISSION_MISSING` sans effet (`app/api/partner/team/team-access.ts:1-16`). Une partenaire n'agit
  que sur ses propres événements (`app/api/partner/team/invite/route.ts:200-207`,
  `app/api/partner/team/assignments/route.ts:114-129`).
- **Événements où l'on peut affecter un contrôleur** : seulement « Validé » ou « Publié »
  (`lib/events/event-status.ts:13-23`). Sinon : « Ce contrôleur ne peut pas être affecté à cet événement car l'événement
  n'est pas encore confirmé. » (`lib/events/event-status.ts:28-29`), avec le détail « L'événement "{titre}" est en
  statut {statut}. Seuls les événements confirmés (VALIDÉ ou PUBLIÉ) peuvent être affectés. »
  (`app/api/partner/team/invite/route.ts:211-216`) — ex. « L'événement "Concert Test" est en statut TERMINE. Seuls les
  événements confirmés (VALIDÉ ou PUBLIÉ) peuvent être affectés. ».
- **Une affectation** = une ligne « contrôleur × événement » avec la permission espèces, le point d'entrée, la porte et
  le droit de changer de porte (`M/20261110000009_lot9ter_zones.sql:85-90`). Toute nouvelle affectation inscrit
  durablement le lien « cette partenaire a déjà eu ce contrôleur dans son équipe » (jamais effacé), qui décide du
  consentement en 05.6 (`M/20261110000006_lot9ter_equipe_messages.sql:42-81`, `:87-97`).
- **Messages aux contrôleurs** : chaque affectation nouvelle met en file `CONTROLLER_ASSIGNED` (cloche, push, email par
  affectation, et **un seul SMS regroupé** par opération, même pour plusieurs événements) ; chaque retrait met en file
  `CONTROLLER_UNASSIGNED` de la même façon et annule les rappels de la veille encore en attente
  (`M/20261109000010_lot9bis_email.sql:1082-1150`). Un retrait en cascade (événement ou compte supprimé) ne prévient
  personne (`:1118-1121`). L'email ne part qu'à une adresse vérifiée (voir `10-notifications.md`).
- **Le scan est décidé par le serveur** en une seule opération sous verrou ; l'écran n'affiche que la réponse
  (`app/api/controller/scan/route.ts:118-139`, `M/20261110000009_lot9ter_zones.sql:903-1272`).

---

## 05.1 Les deux écrans de l'équipe et les états d'un membre

1. **Qui, où.** Partenaire validée.
   - **`/partner/team`**, menu « Équipe » : titre « Équipe de contrôle », description « {n} membre(s) · {m}
     affectation(s) sur vos événements. » (ex. « 1 membre · 2 affectations sur vos événements. ») ou, avant lecture,
     « Les contrôleurs qui scannent les billets à l’entrée de vos événements. » ; boutons « Actualiser » et « Inviter un
     contrôleur » (`app/partner/team/page.tsx:533-556`). Recherche « Rechercher un contrôleur » (« Nom ou numéro ») et
     filtre « Événement » (« Tous les événements » + événements assignables) dès qu'il y a un membre (`:574-590`).
     Colonnes « Membre », « État », « Événements », « Actions » (`:423-527`).
   - **Pilotage d'un événement**, onglet « Équipe » (`app/partner/events/[id]/page.tsx:54-60`) : formulaire « Inviter un
     contrôleur » pour CET événement, éditeur « Zones et portes », liste « Contrôleurs affectés »
     (`components/partner/pilotage/TeamTab.tsx:422-498`).
2. **Ce qu'il saisit.** Rien pour lire.
3. **Ce que fait le système.** `/partner/team` lit `GET /api/partner/team/all` : un membre par compte, ses affectations,
   et les invitations encore en attente (titulaire au nom masqué, aucune affectation)
   (`app/api/partner/team/all/route.ts:133-296`). États d'un membre, lus dans le compte réel
   (`M/20261109000008_lot9bis_cycle.sql:2189-2215`, `app/api/partner/team/all/route.ts:61-76`) :

   | État affiché | Sens | Badge | Preuve |
   |---|---|---|---|
   | « Actif » | compte activé ou compte établi | vert | `app/partner/team/page.tsx:453` |
   | « Activation en attente » | compte créé par l'invitation, mot de passe jamais choisi ; bouton « Renvoyer le SMS » | orange | `:451-452`, `:494-505` |
   | « Invitation en attente » + « Jusqu’au {date} » | compte existant invité, pas encore d'accord ; à la place des actions : « Affecté dès qu’il accepte l’invitation dans l’application. » | bleu | `:444-450`, `:487-489` |

   Chaque membre montre « Encaissement espèces autorisé » (au moins une affectation l'autorise) ou « Sans encaissement
   espèces », et ses événements en pastilles avec une croix « Retirer {nom} de {titre} » (`:434-436`, `:458-481`).
   Le nom affiché est « Prénom Nom », ou « Contrôleur » s'il est vide (`:115-117`). Le compteur « membres » ne compte que
   les contrôleurs affectés, pas les invitations en attente (`app/api/partner/team/all/route.ts:284-293`).
4. **Messages envoyés.** Aucun.
5. **Ce que voient les autres rôles.** La page se relit d'elle-même quand le statut d'un événement change (temps réel
   sur l'historique des statuts) ; les invitations, affectations et retraits faits ailleurs ne la relisent pas
   (« Actualiser ») (`app/partner/team/page.tsx:196-205`). Un admin avec `events.read` lit l'équipe de toutes les
   partenaires (`app/api/partner/team/all/route.ts:144-146`, `:150-175`). Dans le pilotage, l'onglet Équipe est en
   lecture seule pour un admin (`can_manage` = propriétaire seule) (`M/20261102000005_lot5_pilotage.sql:750`,
   `components/partner/pilotage/TeamTab.tsx:320`).
6. **Refus.** Lecture impossible : « Équipe indisponible » et « Réessayer » ; échec d'une relecture : « {erreur} La liste
   affichée est celle de la dernière lecture réussie. » (`app/partner/team/page.tsx:558-572`). Aucun membre : « Aucun
   contrôleur dans votre équipe » / « Invitez vos contrôleurs : ils reçoivent un code par SMS et scannent les billets à
   l’entrée. », bouton « Inviter un premier contrôleur » s'il existe un événement assignable (`:610-616`).
7. **Preuves et essai.** Fichiers cités. Recette : essais 15 et 86 (`docs/recette-billetterie.md:571-588`, `:1847-1863`).

---

## 05.2 Inviter un nouveau numéro (compte créé, SMS d'activation)

1. **Qui, où.** Partenaire propriétaire (ou admin `events.write`). Deux portes d'entrée :
   - `/partner/team`, bouton « Inviter un contrôleur » : fenêtre « Inviter un contrôleur » / « Il reçoit un code
     d’activation par SMS. » (`app/partner/team/page.tsx:720-728`) ;
   - pilotage, onglet « Équipe », section « Inviter un contrôleur » / « Le contrôleur reçoit un SMS avec son accès au
     scanner de cet événement. », affichée seulement si l'événement est Validé ou Publié ; sinon bandeau « Affectation
     de contrôleurs indisponible » / « Les contrôleurs ne peuvent être affectés qu’à un événement validé ou publié. »
     (`components/partner/pilotage/TeamTab.tsx:423-431`).
2. **Ce qu'il saisit.**

   | Champ | Obligatoire | Aide, limite | Erreur à l'écran | Preuve |
   |---|---|---|---|---|
   | « Prénom », « Nom » | non (« Facultatif ») | exemples « Ex : Moussa », « Ex : Diop » ; 60 caractères dans le pilotage ; vide → prénom « Contrôleur » | — | `app/partner/team/page.tsx:733-736` ; `components/partner/pilotage/TeamTab.tsx:434-435`, `:343` ; `app/api/partner/team/invite/route.ts:59` |
   | « Numéro du contrôleur » (`/partner/team`) ou « Téléphone du contrôleur » (pilotage) | oui | « 77 123 45 67 » | `/partner/team` : « Numéro sénégalais de 9 chiffres requis (ex : 77 123 45 67). » ; pilotage : « Saisissez un numéro sénégalais à 9 chiffres (par exemple 77 123 45 67). » ; serveur : « Numéro de mobile sénégalais invalide. Exemple : 77 123 45 67. » | `app/partner/team/page.tsx:284`, `:737-750` ; `components/partner/pilotage/TeamTab.tsx:334`, `:436-450` ; `lib/validations/auth.ts:8`, `:30` ; `app/api/partner/team/invite/route.ts:107-113` |
   | « Événements à assigner * ({n} sur {m}) » (`/partner/team` seulement) | oui, au moins un | cases à cocher des événements Validés ou Publiés, présélection s'il n'y en a qu'un ; « Tout sélectionner » / « Tout désélectionner » | « Sélectionnez au moins un événement. » ; serveur « Veuillez sélectionner au moins un événement. » | `app/partner/team/page.tsx:239-242`, `:285`, `:759-773` ; `app/api/partner/team/invite/route.ts:101-103` |
   | « Encaissement des espèces » / « Autorise la vente de billets au guichet. » (`/partner/team`) ; « Autoriser l’encaissement en espèces » (pilotage) | non | même valeur pour tous les événements cochés | — | `app/partner/team/page.tsx:776-782` ; `components/partner/pilotage/TeamTab.tsx:451-459` |

   Sans événement assignable, `/partner/team` affiche « Aucun événement disponible » / « Un contrôleur ne peut être
   affecté qu’à un événement validé ou publié. Faites valider un événement pour l’affecter. » et « Voir mes
   événements » (`app/partner/team/page.tsx:752-757`). Bouton : « Inviter le contrôleur » ou « Inviter sur {n}
   événements » (`:784-786`).
3. **Ce que fait le système** (`POST /api/partner/team/invite`), dans cet ordre :
   1. quota de la partenaire (20 invitations par heure), pris à chaque essai (`app/api/partner/team/invite/route.ts:177-188`,
      `lib/env.ts:88`) ;
   2. événements à elle et Validés ou Publiés (`:190-216`) ;
   3. quota du numéro (3 par jour, toutes partenaires), pris seulement si un message part et rendu sinon (`app/api/partner/team/invite/route.ts:240-257`,
      `:570-579`, `lib/env.ts:89`) ;
   4. aucun compte pour ce numéro : création d'un compte « coquille » (adresse de connexion technique
      `221770000000@eventvillage.sn`, mot de passe aléatoire inconnu, statut actif, rôles CLIENT et CONTRÔLEUR, marque
      « compte temporaire ») ; si un compte de connexion existe déjà pour ce numéro ou cette adresse : refus
      (`app/api/partner/team/invite/route.ts:329-407`) ;
   5. affectations aux événements cochés, en une instruction, avec la permission espèces ; journal
      `CONTROLLER_INVITED` (`app/api/partner/team/invite/route.ts:409-474`) ;
   6. code d'activation à 6 chiffres valable **24 h**, enregistré haché ; les codes précédents de ce numéro sont échus
      (`app/api/partner/team/invite/route.ts:476-506`) ;
   7. **SMS envoyé tout de suite** (pendant la requête), puis inscrit au journal des envois sans le code ni le lien
      (`app/api/partner/team/invite/route.ts:508-536`, `lib/sms/mtarget.service.ts:188-195`, `lib/notifications/sync-log.ts:1-9`).

   Le code n'est jamais renvoyé à la partenaire (`app/api/partner/team/invite/route.ts:564`). Réponse affichée en toast :

   | Cas | Texte exact | Preuve |
   |---|---|---|
   | SMS parti | « Contrôleur créé et assigné sur l'événement. SMS avec code d'activation envoyé. » (ou « … sur {n} événements. … ») | `:538-553` |
   | SMS non parti | « Contrôleur créé et assigné sur l'événement. SMS non envoyé : {raison}. Renvoyez l’invitation plus tard. » ; {raison} ∈ « trop d’envois vers ce numéro aujourd’hui », « limite d’envois de votre compte atteinte pour aujourd’hui », « limite d’envois de la plateforme atteinte pour aujourd’hui », « le service SMS n’a pas confirmé l’envoi » | `:30-37`, `:553` |

   Le membre apparaît « Activation en attente » (05.1).
4. **Messages envoyés.**

   | Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
   |---|---|---|---|---|
   | Numéro invité | SMS | indispensable (envoi direct, hors boîte d'envoi) | immédiat, pendant la requête ; aucune plage de nuit ; soumis à la garde SMS (part non prioritaire du plafond global) | `CONTROLLER_INVITE` : « Event Village : Bonjour {prénom}, code d'activation {code} (24 h) pour scanner les billets : {lien} » ; sans prénom saisi : « Event Village : code d'activation {code} (24 h) pour scanner les billets : {lien} ». Ex. « Event Village : Bonjour Moussa, code d'activation 483920 (24 h) pour scanner les billets : https://app.eventvillage.sn/controller/setup?phone=%2B221770000000 » (157 caractères GSM-7, 1 segment) |
   | Contrôleur (nouveau compte) | cloche, push, email | indispensable | file | `CONTROLLER_ASSIGNED` : titre « Nouvelle affectation », texte « Vous contrôlez l'entrée de « {titre} » le {date}[, point d'entrée {porte}][. Encaissement des espèces autorisé]. » ; push et email ne partent que s'il y a un appareil abonné ou une adresse vérifiée (jamais pour un compte neuf : adresse technique) |
   | Contrôleur (nouveau compte) | SMS | indispensable | file, puis **sauté** : « Déjà prévenu par l'invitation » (motif `COVERED_BY_INVITATION`) si le SMS d'invitation est parti dans l'heure | aucun second SMS |

   Preuves : `lib/notifications/catalog.ts:1694`, `:1796-1816` (texte), `:1113-1137` ; prénom translittéré et coupé à 9
   signes (`:1811-1813`) ; `M/20261109000010_lot9bis_email.sql:523-530` (saut) et `:531-535` (email : adresse réelle
   et vérifiée seulement) ; `lib/notifications/outbox-labels.ts:65` ; `tests/parcours/notif-controleurs.test.ts:366-405`.
   Longueur : 124 + longueur du prénom (9 au plus) + longueur de l'adresse de l'application, ou 114 + longueur de
   l'adresse sans prénom ; avec une adresse de 27 caractères, 141 (sans prénom) à 160 (prénom coupé « Mariam... ») :
   toujours 1 segment ; avec une adresse plus longue, le SMS passe à 2 segments (le lien n'est jamais coupé) — mesure faite sur le rendu du code (`smsSegments`,
   `lib/notifications/sms-format.ts:73-85`). Question A3 de la recette : voir `00-index.md`.
5. **Ce que voient les autres rôles.** Le contrôleur ne peut rien faire avant l'activation (05.3) : son compte n'a pas
   de mot de passe connu. L'admin `notifications.read` voit l'envoi dans `/admin/notifications` (type « Invitation d'un
   contrôleur », statut, motif), sans le code (`lib/notifications/outbox-labels.ts:176`,
   `M/20261103000008_lot6_supervision.sql:127-130` ; voir `11-admin-superadmin.md`).
6. **Refus.**

   | Cas | Message | Preuve |
   |---|---|---|
   | Quota de la partenaire | « Limite d'invitations atteinte : maximum {n} par heure. Réessayez plus tard. » ({n} = 20) | `app/api/partner/team/invite/route.ts:186-188` |
   | Quota du numéro | « Trop d'invitations envoyées à ce numéro aujourd'hui (maximum {n} par jour). » ({n} = 3) | `:253-255` |
   | Garde des quotas indisponible | « Service momentanément indisponible. Réessayez dans un instant. » | `lib/security/quota-http.ts:11-15` |
   | Événement d'une autre partenaire | « Vous n'êtes pas propriétaire de tous les événements sélectionnés. » | `app/api/partner/team/invite/route.ts:200-206` |
   | Événement introuvable | « Un ou plusieurs événements sélectionnés sont introuvables. » | `:196-198` |
   | Compte de connexion déjà existant pour ce numéro ou cette adresse | « Un compte existe déjà avec cet email ou ce numéro. Invitez-le par le numéro de téléphone de son profil, ou contactez le support. » | `:344-352` |
   | Deux comptes portent ce numéro | « Plusieurs comptes correspondent à ce numéro. Contactez le support. » | `:128-134` |
   | Compte non actif (suspendu…) | « Ce numéro ne peut pas être invité pour le moment. Contactez le support si besoin. » (journal `CONTROLLER_INVITE_REFUSED_INACTIVE`) | `:264-273`, `lib/auth/account-status.ts:33-36` |
   | Panne | « Erreur interne du serveur. » ; à l'écran, sinon « L’invitation n’a pas pu être envoyée. » / « Invitation impossible pour le moment. » | `app/api/partner/team/invite/route.ts:567-569` ; `app/partner/team/page.tsx:308` ; `components/partner/pilotage/TeamTab.tsx:355` |

7. **Preuves et essai.** Fichiers cités. Recette : essai 15 (`docs/recette-billetterie.md:571-588`).

---

## 05.3 Le contrôleur active son compte (`/controller/setup`)

1. **Qui, où.** Le titulaire du numéro, sans être connecté : lien du SMS
   `{adresse}/controller/setup?phone=%2B221…`, page publique (`middleware.ts:31`, `:63`). Titre « Activer votre compte
   contrôleur », texte « Saisissez le code reçu par SMS avec l’invitation, puis choisissez votre mot de passe. »
   (`app/controller/setup/page.tsx:174-175`). Le numéro est prérempli depuis le lien (`:88`).
2. **Ce qu'il saisit.**

   | Champ | Aide | Erreur à l'écran | Preuve |
   |---|---|---|---|
   | « Numéro de téléphone » | « 77 123 45 67 » | « Indiquez le numéro qui a reçu l’invitation. » | `app/controller/setup/page.tsx:186-196`, `:105-108` |
   | « Code d’activation reçu par SMS » (6 cases) | « Le code est valable 24 heures. Sans code, demandez une nouvelle invitation à votre organisateur. » | « Saisissez les 6 chiffres du code reçu par SMS. » | `:198-204`, `:109-112` |
   | « Mot de passe » | « 8 caractères au moins, avec une majuscule, une minuscule et un chiffre. » et liste des règles cochées en direct | « Le mot de passe doit comporter au moins 8 caractères, une majuscule, une minuscule et un chiffre. » | `:206-247`, `:113-116` |
   | « Confirmer le mot de passe » | — | « Les mots de passe ne correspondent pas. » | `:249-257`, `:117-120` |

   Bouton « Activer mon compte » ; lien « Compte déjà activé ? » « Se connecter » (`:259-267`).
3. **Ce que fait le système** (`POST /api/controller/setup`) : quota de 10 essais par heure et par numéro, compté avant
   la vérification du code (`app/api/controller/setup/route.ts:45-56`, `lib/env.ts:86`) ; vérification du code ; compte du
   numéro ; refus d'un compte suspendu ; affectation existante exigée ; compte encore « coquille » exigé ; rôle
   CONTRÔLEUR assuré ; mot de passe posé ; numéro marqué vérifié ; marque « temporaire » retirée ; avis
   `CONTROLLER_ACTIVATED` mis en file (`:58-215`). Réponse « Mot de passe défini. Vous pouvez maintenant vous
   connecter. » (`:214`). L'écran affiche « Compte activé » / « Connexion en cours, vous allez arriver sur le
   scanner. », connecte la personne et l'envoie sur `/controller/scanner` ; si la connexion automatique échoue :
   `/login?message=account_activated` (`app/controller/setup/page.tsx:139-142`, `:156-160`). Aucune alerte « mot de
   passe modifié » pour cette première pose (`M/20261109000009_lot9bis_messages.sql:1600-1628`).
4. **Messages envoyés.**

   | Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
   |---|---|---|---|---|
   | Contrôleur | cloche | indispensable | file | `CONTROLLER_ACTIVATED` : « Compte activé » / « Votre compte est activé : vous pouvez scanner les billets. » |
   | Contrôleur | SMS | indispensable | file | « Event Village : votre compte est activé. Vous pouvez vous connecter et scanner les billets. » (91 caractères, 1 segment) |
   | Contrôleur | email | indispensable | file, seulement vers une adresse vérifiée (jamais l'adresse technique) | même titre et texte que la cloche |

   Preuves : `lib/notifications/catalog.ts:1182-1188` ; `app/api/controller/setup/route.ts:205-210` ;
   `tests/parcours/notif-controleurs.test.ts:422`.
5. **Ce que voient les autres rôles.** La partenaire voit le membre passer à « Actif » à la relecture de `/partner/team`
   (05.1). Aucun avis à la partenaire.
6. **Refus (messages exacts du serveur, affichés dans « Activation impossible »).**

   | Cas | Message | Preuve |
   |---|---|---|
   | Numéro illisible | « Numéro de téléphone sénégalais invalide. » | `app/api/controller/setup/route.ts:40` |
   | Trop d'essais | « Trop de tentatives d’activation pour ce numéro. Réessayez plus tard. » | `:52-55` |
   | Code faux, expiré, épuisé | textes communs des codes (voir `02-comptes.md`) | `:64-68` |
   | Aucun compte | « Aucun compte associé à ce numéro. » | `:86` |
   | Compte suspendu | « Ce compte est suspendu : l’activation est impossible. Contactez l’organisateur ou le support. » | `:91-95` |
   | Aucune affectation | « Aucune invitation contrôleur trouvée pour ce numéro. » | `:111` |
   | Compte qui a déjà un mot de passe | « Ce compte possède déjà un mot de passe actif. Veuillez vous connecter avec vos identifiants existants. » ; l'écran renvoie aussitôt vers `/login?message=already_configured` | `:126-133` ; `app/controller/setup/page.tsx:130-133` |
   | Mot de passe non posé | « Impossible de définir le mot de passe. Demandez une nouvelle invitation à votre organisateur. » | `app/api/controller/setup/route.ts:166-170` |
   | Réseau | « Connexion impossible : vérifiez votre réseau, puis réessayez. Si le problème continue, demandez une nouvelle invitation. » | `app/controller/setup/page.tsx:143-146` |

7. **Preuves et essai.** Recette : essai 29 (`docs/recette-billetterie.md:807-822`).

---

## 05.4 Renvoyer le SMS d'activation ; expiration du code

1. **Qui, où.** Partenaire.
   - `/partner/team` : bouton « Renvoyer le SMS », montré **seulement** pour un membre « Activation en attente »
     (`app/partner/team/page.tsx:494-505`).
   - Pilotage, onglet Équipe : bouton « Renvoyer l’invitation par SMS » sur **chaque** contrôleur affecté, quel que soit
     son état (`components/partner/pilotage/TeamTab.tsx:280-284`) — voir le refus ci-dessous.
2. **Ce qu'il saisit.** Rien : la demande reprend le numéro, le premier événement et la permission espèces
   (`app/partner/team/page.tsx:337-349`, `components/partner/pilotage/TeamTab.tsx:203-210`).
3. **Ce que fait le système.** Même route qu'en 05.2 avec « renvoi » : pour un compte encore « coquille », nouveau code
   de 24 h, anciens codes échus tout de suite (seul le dernier code active le compte), nouveau SMS ; les quotas de 05.2
   s'appliquent (`app/api/partner/team/invite/route.ts:476-506`, `:517-536`). Toast : « Droits mis à jour sur
   l'événement. SMS avec code d'activation envoyé. » (le compte et l'affectation existent déjà) (`:540-553`).
   **Expiration** : un code non utilisé en 24 h ne vaut plus ; il faut renvoyer le SMS (`:482`). Le compte « coquille »
   et ses affectations restent tant que la partenaire ne le retire pas. **NON VÉRIFIÉ** : aucune tâche de nettoyage
   des comptes jamais activés n'a été trouvée (recherche de `is_temporary_controller_account` dans `lib/`, `app/`,
   `scripts/` et les migrations : seulement les usages cités ici).
4. **Messages envoyés.** Le SMS `CONTROLLER_INVITE` de 05.2, avec le nouveau code. Rien d'autre (aucune affectation
   nouvelle).
5. **Ce que voient les autres rôles.** Rien de neuf.
6. **Refus.** Contrôleur déjà activé : « Ce contrôleur a déjà activé son compte : aucun SMS n’est renvoyé. »
   (`app/api/partner/team/invite/route.ts:170-175`) ; c'est ce que reçoit la partenaire qui touche « Renvoyer
   l’invitation par SMS » dans le pilotage pour un contrôleur actif (constat W5-01). Quotas : 05.2. Écran : sinon
   « L’invitation n’a pas pu être renvoyée. » / « Renvoi de l’invitation impossible. »
   (`app/partner/team/page.tsx:353`, `components/partner/pilotage/TeamTab.tsx:213`).
7. **Preuves et essai.** Fichiers cités.

---

## 05.5 Inviter un compte existant qui n'est pas contrôleur (consentement)

1. **Qui, où.** Partenaire, mêmes formulaires qu'en 05.2, avec le numéro d'un client déjà inscrit.
2. **Ce qu'il saisit.** Les champs de 05.2. Prénom, nom et email saisis ne sont **jamais** appliqués à un compte existant
   (`app/api/partner/team/invite/route.ts:94-96`).
3. **Ce que fait le système.**
   1. Premier envoi : rien n'est écrit ; la réponse demande une confirmation (`app/api/partner/team/invite/route.ts:276-290`).
      Fenêtre « Compte existant » ; sous-titre « Invitation à contrôler, sans nouveau compte » (`/partner/team`) ou « Ce
      numéro correspond déjà à un compte Event Village. » (pilotage) ; « Titulaire du compte » / « Titulaire » = nom
      masqué (2 premières lettres du prénom + « *** », initiale du nom + « *** », ou « Titulaire du compte »),
      « Numéro » / « Téléphone » (`app/partner/team/page.tsx:791-826`, `components/partner/pilotage/TeamTab.tsx:510-549`,
      `lib/security/mask.ts:6-14`). Texte du serveur : « Ce numéro appartient déjà à un compte Event Village ({nom
      masqué}). Confirmez-vous l'affectation de ce titulaire comme contrôleur de vos événements ? Son identité et ses
      identifiants ne seront pas modifiés. » — ex. « … (Mo*** D***). … » (`app/api/partner/team/invite/route.ts:288`),
      suivi, sur `/partner/team`, de « Un seul compte, rien n’est perdu » / « Cette personne garde ses billets,
      commandes et son portefeuille. Elle reçoit une invitation par SMS et ne contrôle vos événements qu’après l’avoir
      acceptée dans l’application. » (`app/partner/team/page.tsx:817-822`), ou, dans le pilotage, « La personne garde
      son compte, ses billets et son historique. Elle reçoit une invitation par SMS et ne contrôle cet événement qu’après
      l’avoir acceptée dans l’application. » (`components/partner/pilotage/TeamTab.tsx:544-546`). Boutons « Annuler »
      et « Envoyer l’invitation ». Le texte du serveur parle d'« affectation » alors qu'une invitation part (constat
      W5-02).
   2. « Envoyer l’invitation » : invitation enregistrée, valable **72 h** ; une invitation encore en attente de la même
      partenaire pour le même compte est remplacée (passée « expirée ») ; **aucun rôle ni aucune affectation** avant
      l'accord ; journal `CONTROLLER_INVITATION_CREATED` ; avis mis en file dans la même opération
      (`M/20261109000008_lot9bis_cycle.sql:179-197`, `:1988-2068` ; `app/api/partner/team/controller-invitation.ts:34-76`).
      Toast : « Invitation envoyée : {nom masqué} doit l’accepter dans l’application avant d’être affecté. »
      (`app/api/partner/team/invite/route.ts:307-316`).
4. **Messages envoyés.**

   | Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
   |---|---|---|---|---|
   | Titulaire invité | SMS | indispensable | file (boîte d'envoi) | `CONTROLLER_INVITATION` : « Event Village : {organisateur} vous invite à scanner les billets de {titre}[, et {n} autre(s)]. Répondez sur {adresse}/invitations » — ex. « Event Village : Concert Test Prod vous invite à scanner les billets de Concert Test. Répondez sur https://app.eventvillage.sn/invitations » (137 caractères, 1 segment) |
   | Titulaire invité | cloche, push, email | indispensable | file | titre « Invitation de {organisateur} », texte « {organisateur} vous invite à contrôler l'entrée de « {titre} »[ et {n} autre(s) événement(s)]. Répondez avant le {date d'expiration}. » — ex. « Concert Test Prod vous invite à contrôler l'entrée de « Concert Test ». Répondez avant le lun. 16 nov. 2026 à 18:30. » ; lien `/invitations` |

   {organisateur} = nom commercial de la partenaire, sinon sa raison sociale ; coupé à 18 signes dans le SMS, comme le
   titre (`M/20261109000008_lot9bis_cycle.sql:2014-2015`, `lib/notifications/catalog.ts:1465-1487`). Question A5 de la recette : voir `00-index.md`.
5. **Ce que voient les autres rôles.** `/partner/team` montre la personne « Invitation en attente » « Jusqu’au {date} »,
   sans affectation (`app/api/partner/team/all/route.ts:91-131`). L'onglet Équipe du pilotage ne montre **pas** les
   invitations en attente (liste des seules affectations) (constat W5-03).
6. **Refus.** Compte non actif : « Ce numéro ne peut pas être invité pour le moment. Contactez le support si besoin. »
   (05.2). Refus de la base : « Invitation incomplète : choisissez au moins un événement. », « Organisateur
   introuvable. », « Ce compte n’est pas actif : il ne peut pas être invité. », « Vous n’êtes pas propriétaire de tous
   les événements sélectionnés. », « Seuls les événements validés ou publiés peuvent être affectés. » ; admin
   invitant pour plusieurs organisateurs à la fois : « Les événements d’une invitation appartiennent à un seul
   organisateur. » (`app/api/partner/team/controller-invitation.ts:22-28`, `:47-54`). Quota du numéro : pris à
   l'envoi confirmé seulement (`app/api/partner/team/invite/route.ts:246-257`).
7. **Preuves et essai.** Recette : essai 86 pour la fenêtre (`docs/recette-billetterie.md:1847-1863`).

---

## 05.6 Contrôleur déjà actif : connu de la partenaire ou venu d'une autre partenaire

1. **Qui, où.** Partenaire, formulaire de 05.2 avec le numéro d'un contrôleur déjà activé.
2. **Ce qu'il saisit.** Les champs de 05.2.
3. **Ce que fait le système.** La route cherche si **chaque** partenaire des événements demandés a déjà eu ce contrôleur
   dans son équipe (lien durable de la règle commune) (`app/api/partner/team/invite/route.ts:218-238`) :
   - **Déjà connu** : affectation **directe**, sans confirmation ni invitation. Toast : « Contrôleur assigné avec succès
     sur l'événement. Le contrôleur est prévenu dans l'application et par SMS. » ; si toutes les affectations
     existaient déjà : « Droits mis à jour sur l'événement. Aucune nouvelle affectation : aucun SMS n'est envoyé. »
     (la permission espèces est alors mise à jour) (`:427-474`, `:538-550`).
   - **Jamais connu** (contrôleur d'une autre partenaire) : même chemin qu'en 05.5, avec le texte « Ce numéro appartient
     déjà à un compte Event Village ({nom masqué}). Ce titulaire n’a jamais contrôlé vos événements : il doit accepter
     votre invitation dans l’application avant d’être affecté. Confirmez-vous l’envoi de l’invitation ? »
     (`:287`) ; puis invitation de 72 h et `CONTROLLER_INVITATION`.
   La même règle protège la modification des affectations (05.8) et la base elle-même (refus
   `CONTROLLER_CONSENT_REQUIRED`) (`M/20261110000006_lot9ter_equipe_messages.sql:543-555`).
4. **Messages envoyés.** Connu : `CONTROLLER_ASSIGNED` (cloche, push, email par affectation ; un SMS regroupé) :
   « Event Village : affectation à l'entrée de {titre}, {date}[, point {porte}][, et {n} autre(s)]. {adresse}/login » —
   ex. « Event Village : affectation à l'entrée de Concert Test, ven. 20 nov. à 20:00. https://app.eventvillage.sn/login »
   (111 caractères, 1 segment) (`lib/notifications/catalog.ts:1113-1137`). Jamais connu : messages de 05.5.
5. **Ce que voient les autres rôles.** Le contrôleur voit l'événement dans son scanner à la relecture (05.15).
6. **Refus.** Ceux de 05.2 et 05.5.
7. **Preuves et essai.** Recette : essai 86 (`docs/recette-billetterie.md:1847-1863`).

---

## 05.7 Le titulaire répond à l'invitation (`/invitations`)

1. **Qui, où.** Le titulaire invité, connecté (page protégée), par le lien du SMS ou de la cloche ; **aucune entrée de
   menu** ne mène à cette page (voir `01-roles-menus-ecrans.md`, 01.14). Titre « Invitations à contrôler », texte « Un
   organisateur vous propose de contrôler l’entrée de ses événements. Rien ne change sur votre compte tant que vous
   n’avez pas accepté. » (`app/invitations/page.tsx:99-102`). Chaque invitation : nom de l'organisateur, « Vous invite à
   contrôler l’entrée de {n} événement(s). », liste des événements avec leur date, « À accepter avant le {date} »,
   boutons « Accepter l’invitation » et « Refuser » (`:139-189`).
2. **Ce qu'il saisit.** Un choix. « Refuser » ouvre « Refuser cette invitation ? » / « {organisateur} ne pourra pas vous
   affecter à ses événements. L’organisateur pourra vous inviter de nouveau plus tard. », boutons « Refuser
   l’invitation » et « Revenir » (`:193-203`).
3. **Ce que fait le système** (`POST /api/account/controller-invitations/{id}`, une seule opération) :
   - **Accepter** : rôles CLIENT et CONTRÔLEUR ajoutés sans rien toucher d'autre ; affectations créées pour les
     événements de l'invitation **encore** Validés ou Publiés (un événement passé entre-temps à un autre statut est
     ignoré), avec la permission espèces demandée ; invitation « acceptée » ; journal
     `CONTROLLER_INVITATION_ACCEPTED` (`M/20261109000008_lot9bis_cycle.sql:2121-2141`). Toast « Invitation acceptée :
     vous pouvez contrôler l’entrée de ces événements. » ; bandeau « Vous contrôlez maintenant les événements de
     {organisateur} » / « Le scanner est accessible depuis votre compte, sans nouvelle inscription. » et bouton « Ouvrir
     le scanner » (`app/api/account/controller-invitations/[id]/route.ts:52-59`, `app/invitations/page.tsx:104-112`).
   - **Refuser** : invitation « refusée », rien d'autre ; journal `CONTROLLER_INVITATION_DECLINED` ; toast « Invitation
     refusée. » (`M/20261109000008_lot9bis_cycle.sql:2114-2119`).
   - **Expiration** : une invitation de plus de 72 h n'est plus servie (« Aucune invitation en attente » / « Quand un
     organisateur vous invite à contrôler ses événements, vous recevez un SMS et l’invitation apparaît ici. ») ; elle
     passe « expirée » quand on tente d'y répondre (`M/20261109000008_lot9bis_cycle.sql:2108-2112`, `:2176-2178` ;
     `app/invitations/page.tsx:132-137`). Aucun avis d'expiration.
4. **Messages envoyés.** Acceptation : `CONTROLLER_ASSIGNED` pour chaque affectation créée (cloche, push, email ; un SMS
   regroupé : 05.6), car la création passe par le même déclencheur (`M/20261109000008_lot9bis_cycle.sql:2125-2135`).
   Refus : aucun. **Aucun avis à la partenaire**, ni à l'acceptation ni au refus (constat W5-04).
5. **Ce que voient les autres rôles.** La partenaire voit, en relisant `/partner/team`, le membre « Actif » avec ses
   affectations (acceptation) ou plus rien (refus, expiration) (`app/api/partner/team/all/route.ts:91-131`).
6. **Refus (bandeau « Réponse non enregistrée »).** « Invitation introuvable. » (invitation d'un autre compte comprise,
   sans indice) ; « Cette invitation a expiré. » ; « Cette invitation a déjà reçu une réponse. » ; « Votre compte
   n’est pas actif. Contactez le support. » ; corps illisible : « Réponse illisible : indiquez si vous acceptez
   l’invitation. » ; panne : « Réponse à l’invitation momentanément impossible. Réessayez. »
   (`app/api/account/controller-invitations/[id]/route.ts:13-18`, `:31-39`, `:60-65`). Lecture impossible :
   « Impossible d’afficher vos invitations » (`app/invitations/page.tsx:125-131`).
7. **Preuves et essai.** Recette : essai 86 (`docs/recette-billetterie.md:1847-1863`).

---

## 05.8 Affecter à plusieurs événements, « Gérer les affectations », permission espèces par événement

1. **Qui, où.** Partenaire, `/partner/team`, bouton « Gérer » d'un membre (sauf invitation en attente) : fenêtre « Gérer
   les affectations » / « Contrôleur : {nom} » (`app/partner/team/page.tsx:491-493`, `:674-717`).
2. **Ce qu'il saisit.** Liste « Événements autorisés ({n} sur {m} assignables) » : cases des événements Validés ou
   Publiés, plus ses affectations actuelles devenues non assignables, marquées « À retirer » (on peut les décocher, pas
   les recocher) (`:367-384`, `:138-189`, `:690-700`). Pour chaque événement coché, interrupteur « Encaisse : {titre} »
   / « Le contrôleur peut vendre des billets au guichet de cet événement. » (`:701-715`). Sans événement :
   « Aucun événement validé ou publié n’accepte de contrôleur pour le moment. » (`:690-692`). Boutons « Annuler » et
   « Enregistrer ».
3. **Ce que fait le système** (`PATCH /api/partner/team/assignments`) : retraits, ajouts et permission espèces de
   chaque événement **en une seule opération** (tout ou rien) et journal `CONTROLLER_ASSIGNMENTS_UPDATED`
   (`app/api/partner/team/assignments/route.ts:303-334`, `M/20261110000006_lot9ter_equipe_messages.sql:489-584`).
   Un événement ajouté doit être Validé ou Publié (`app/api/partner/team/assignments/route.ts:220-241`). Un compte
   jamais connu de la partenaire suit le consentement de 05.6 (`:243-301`). Toast « Affectations mises à jour. »
   (`app/partner/team/page.tsx:394`).
4. **Messages envoyés.** Ajouts : `CONTROLLER_ASSIGNED` (05.6) ; retraits : `CONTROLLER_UNASSIGNED` (05.10) ; un seul
   SMS regroupé par sorte pour toute l'opération (`M/20261109000010_lot9bis_email.sql:1104-1113`, `:1133-1142`).
   Changement de la seule permission espèces : **aucun message**.
5. **Ce que voient les autres rôles.** Le scanner du contrôleur relit ses affectations à son retour dans l'application
   (05.17) ; un événement retiré le ramène à l'écran de choix (05.10).
6. **Refus.** Un seul interrupteur « espèces » pour tout (ancien format) : « Le droit d’encaisser se règle événement par
   événement : envoyez assignments avec can_accept_cash pour chacun. » ; événement d'une autre partenaire : « Vous
   n'êtes pas propriétaire de l'événement {id}. » ; « Contrôleur introuvable. » ; compte non actif : « Ce numéro ne
   peut pas être affecté pour le moment. Contactez le support si besoin. » ; caisse ouverte sur un événement retiré :
   « Ce contrôleur a une caisse ouverte : clôturez-la avant de le retirer. » ; refus de la base « Ce contrôleur doit
   d’abord accepter votre invitation. » (`app/api/partner/team/assignments/route.ts:88-95`, `:125-129`, `:138-151`,
   `:315-325` ; `lib/shifts/shift.service.ts:120-125` ; `M/20261110000006_lot9ter_equipe_messages.sql:552-554`). Écran,
   sinon : « Les affectations n’ont pas pu être mises à jour. » (`app/partner/team/page.tsx:399`).
7. **Preuves et essai.** Recette : section 8.8 du guide de recette citée par les essais 77 et 86 (**NON VÉRIFIÉ** :
   numéro d'essai propre à cet écran non trouvé dans `docs/recette-billetterie.md`).

---

## 05.9 Onglet Équipe du pilotage : point d'entrée, permission espèces d'une affectation

1. **Qui, où.** Partenaire propriétaire, pilotage de l'événement, onglet « Équipe », section « Contrôleurs affectés » /
   « Chaque scan garde le point d’entrée du contrôleur ; la permission espèces vaut pour cette affectation seulement. »
   (`components/partner/pilotage/TeamTab.tsx:478-498`). Chaque carte : nom, numéro (« Numéro inconnu » s'il manque),
   « {n} entrée(s) validée(s) · dernière activité le {date} », badges « Compte inactif » et « Caisse ouverte »
   (`:224-251`). Un admin voit la même liste sans boutons (`:320`).
2. **Ce qu'il saisit.**
   - Événement **sans zone** : champ « Point d’entrée » (exemple « Porte Nord, Entrée VIP… », 80 caractères), bouton
     « Enregistrer » actif seulement après un changement (`:258-273`). Vide = effacé.
   - Événement **à zones** : la liste « Porte » remplace ce champ (05.12).
   - Interrupteur « Espèces autorisées » / « Espèces non autorisées » (`:43-67`, `:275`).
3. **Ce que fait le système.**
   - Point d'entrée : écrit sur l'affectation et recopié sur chaque scan de ce contrôleur au moment du scan ; il nomme
     le compteur du scanner (« Porte Nord : 12 entrées ») (`app/api/partner/team/entry-point/route.ts:15-78`,
     `app/api/controller/scans/route.ts:28-34`). Toast « Point d’entrée de {nom} : {point}. » ou « Point d’entrée de
     {nom} effacé. » (`components/partner/pilotage/TeamTab.tsx:178`).
   - Permission espèces de **cette** affectation, journalisée (`app/api/partner/team/assignments/[id]/route.ts:10-56`,
     `M/20261109000004_lot9bis_droits.sql:274-330`). Toast « {nom} peut encaisser des espèces. » ou « {nom} ne peut plus
     encaisser d’espèces. » ; si une caisse reste ouverte : « Une caisse est encore ouverte pour ce contrôleur : elle
     devra être clôturée normalement. » (`components/partner/pilotage/TeamTab.tsx:191-193`). Le retrait du droit
     n'interrompt pas la caisse : au scanner, l'onglet « Guichet » disparaît, l'onglet « Caisse » reste tant que la
     caisse est ouverte, avec « Droit d’encaisser retiré » / « Vous n’encaissez plus sur cet événement : clôturez votre
     caisse ouverte pour remettre les espèces. » (`app/controller/scanner/page.tsx:984-997`, `:1141-1148`).
4. **Messages envoyés.** Aucun (ni pour le point d'entrée, ni pour la permission espèces).
5. **Ce que voient les autres rôles.** Le contrôleur voit le nouveau point d'entrée et la nouvelle permission en relisant
   ses affectations (au retour dans l'application ou à l'écran de départ).
6. **Refus.** Point d'entrée : « Point d’entrée invalide (80 caractères au plus). » ; « Événement introuvable. » ;
   événement à zones : « Cet événement a des portes : choisissez la porte du contrôleur dans la liste. » ; « Ce
   contrôleur n’est pas affecté à cet événement. » ; panne : « Modification momentanément indisponible. »
   (`app/api/partner/team/entry-point/route.ts:35-76`). Écran, sinon : « Modification du point d’entrée impossible. ».
   Espèces : « Données invalides : canAcceptCash doit valoir vrai ou faux. » ; « Affectation introuvable. » ; admin sans
   `events.write` : « Action non autorisée : votre compte n’a pas la permission « Gérer les événements ». » ; « Votre
   compte n’est pas actif. » ; panne : « Modification de la permission espèces impossible pour le moment. »
   (`app/api/partner/team/assignments/[id]/route.ts:31-56`, `M/20261109000004_lot9bis_droits.sql:290-321`).
7. **Preuves et essai.** Recette : essai 15 (`docs/recette-billetterie.md:571-588`).

---

## 05.10 Retirer un contrôleur : d'un événement, de tous les événements, de l'équipe

1. **Qui, où.** Partenaire (ou admin `events.write`). Trois actions :

   | Action | Où | Fenêtre de confirmation (texte exact) | Preuve |
   |---|---|---|---|
   | Retirer d'**un** événement | `/partner/team` : croix « Retirer {nom} de {titre} » sur la pastille ; pilotage : « Retirer de l’événement » | `/partner/team` : « Retirer de cet événement ? » / « {nom} ne pourra plus contrôler « {titre} ». Ses autres affectations et l’historique de ses scans sont conservés. », bouton « Retirer de l’événement » ; pilotage : « Retirer ce contrôleur de l’événement ? » / « Il perd l’accès au scanner pour cet événement. Ses autres affectations et l’historique de ses scans sont conservés. » | `app/partner/team/page.tsx:462-477`, `:623-637` ; `components/partner/pilotage/TeamTab.tsx:285-287`, `:499-508` |
   | Retirer de **tous** ses événements | `/partner/team`, icône « Retirer de tous les événements » | « Retirer de tous vos événements ? » / « {nom} sera retiré de {n} événement(s). Son compte et son historique restent intacts. », bouton « Retirer de tous les événements » | `app/partner/team/page.tsx:506-514`, `:640-654` |
   | **Supprimer de l'équipe** | `/partner/team`, icône « Supprimer de l’équipe » | « Supprimer le contrôleur de l’équipe ? » / « {nom} ne contrôlera plus vos événements. S’il ne contrôle pour aucun autre organisateur, son accès au scanner est fermé aussitôt. Pour le réintégrer, invitez-le à nouveau. », bouton « Supprimer le contrôleur » | `app/partner/team/page.tsx:515-523`, `:657-671` |

2. **Ce qu'il saisit.** Une confirmation.
3. **Ce que fait le système.**
   - Un événement : l'affectation de cet événement est supprimée ; journal `CONTROLLER_REMOVED` ; « Contrôleur retiré de
     l’événement. » (`app/api/partner/team/[eventId]/route.ts:94-161`) ; dans le pilotage, toast « {nom} est retiré de
     l’événement. » (`components/partner/pilotage/TeamTab.tsx:387`).
   - Tous les événements : toutes ses affectations chez cette partenaire, en une instruction ; journal
     `CONTROLLER_REMOVED_ALL` ; « Contrôleur retiré de {n} événement(s) du partenaire. » ; s'il n'en avait aucune :
     « Aucune affectation active trouvée pour ce partenaire. » (`app/api/partner/team/all/route.ts:311-417`). Le rôle
     CONTRÔLEUR est **gardé**.
   - Supprimer de l'équipe : mêmes suppressions en une opération ; si le contrôleur n'a plus **aucune** affectation,
     toutes partenaires confondues, son rôle CONTRÔLEUR est retiré, **toutes ses sessions sont fermées** (il est
     déconnecté de tous ses appareils, espace client compris ; le jeton déjà émis reste lisible au plus 1 h mais les
     droits sont relus à chaque requête) et les codes SMS en attente de son numéro sont effacés ; journal
     `CONTROLLER_DELETED` ; « Contrôleur retiré de l’équipe. »
     (`app/api/partner/team/controller/[controllerId]/route.ts:79-146`, `M/20261102000002_lot5_dette.sql:356-404`,
     `lib/auth/sessions.ts:1-11`). Le lien « déjà eu dans l'équipe » reste : une nouvelle invitation par la même
     partenaire l'affecte directement (05.6) (`M/20261110000006_lot9ter_equipe_messages.sql:15-17`).
   - Dans tous les cas : les rappels de la veille encore en attente pour ces affectations sont annulés
     (`M/20261109000010_lot9bis_email.sql:1144-1148`) ; l'historique des scans est conservé.
4. **Messages envoyés.**

   | Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
   |---|---|---|---|---|
   | Contrôleur | cloche, push, email (une par affectation retirée) | indispensable | file | `CONTROLLER_UNASSIGNED` : « Affectation retirée » / « Vous ne contrôlez plus l'entrée de « {titre} ». » — ex. « Vous ne contrôlez plus l'entrée de « Concert Test ». » |
   | Contrôleur | SMS (un seul pour l'opération) | indispensable | file | « Event Village : votre affectation à l'entrée de {titre} est retirée[, et {n} autre(s)]. » — ex. « Event Village : votre affectation à l'entrée de Concert Test est retirée. » (73 caractères, 1 segment) |

   Preuves : `lib/notifications/catalog.ts:1138-1153` ; `M/20261109000010_lot9bis_email.sql:1123-1143`. Aucun message
   n'annonce la fermeture des sessions.
5. **Ce que voit le contrôleur.**
   - En plein contrôle : le scan suivant est refusé « Vous ne contrôlez plus cet événement » (écran gris, message « Vous
     n’êtes pas autorisé à contrôler cet événement. »), puis ses affectations sont relues et l'écran revient au choix
     avec « Contrôle précédent non repris » / « Vous n’êtes plus affecté à l’événement que vous contrôliez : choisissez un
     événement. » (`components/scan/scan-client.ts:150-155`, `:381-383` ; `app/api/controller/scan/route.ts:215-217` ;
     `app/controller/scanner/page.tsx:440-447`, `:737`, `:958-963`).
   - Sans plus aucune affectation (rôle gardé) : « Aucun événement assigné » / « Vous serez informé lorsqu’un nouvel
     événement vous sera assigné. », bouton « Retour à l’accueil » (`app/controller/scanner/page.tsx:920-938`).
   - Rôle retiré : déconnecté ; à la reconnexion, `/controller/...` le renvoie à l'accueil avec « Cet espace est réservé
     aux contrôleurs dont le compte est actif. » (`middleware.ts:239-258`, `lib/auth/access-errors.ts:11`).
6. **Refus.**

   | Cas | Message | Preuve |
   |---|---|---|
   | Caisse ouverte sur un événement concerné (rien n'est retiré) | « Ce contrôleur a une caisse ouverte : clôturez-la avant de le retirer. » | `lib/shifts/shift.service.ts:113-125` ; `app/api/partner/team/[eventId]/route.ts:143-145` ; `app/api/partner/team/all/route.ts:378-381` ; `app/api/partner/team/controller/[controllerId]/route.ts:84-86` |
   | Affectation inconnue ou d'un autre événement | « Affectation introuvable pour cet événement. » | `app/api/partner/team/[eventId]/route.ts:90-92` |
   | Événement d'une autre partenaire | « Non autorisé à modifier l’équipe de cet événement. » | `:131-133` |
   | Contrôleur hors de l'équipe | « Ce contrôleur ne fait pas partie de cette équipe. » | `app/api/partner/team/controller/[controllerId]/route.ts:90-92` |
   | Admin sans organisateur précisé (cas de `/partner/team`, qui ne le précise pas) | « Précisez l’organisateur dont le contrôleur doit être retiré (paramètre partnerId). » | `app/api/partner/team/controller/[controllerId]/route.ts:72-77` ; `app/partner/team/page.tsx:660-661` |
   | Sessions non fermées | « Rôle Contrôleur retiré, mais la révocation des sessions a échoué. Réessayez. » | `app/api/partner/team/controller/[controllerId]/route.ts:111-113` |
   | Panne | « Retrait du contrôleur momentanément impossible. » ; écran, sinon « Le retrait n’a pas pu être fait. » / « La suppression n’a pas pu être faite. » / « Retrait impossible pour le moment. » | `app/api/partner/team/controller/[controllerId]/route.ts:147-150` ; `app/partner/team/page.tsx:629`, `:646`, `:663` ; `components/partner/pilotage/TeamTab.tsx:391` |

7. **Preuves et essai.** Fichiers cités. **NON VÉRIFIÉ** : aucun essai de `docs/recette-billetterie.md` ne porte sur le
   retrait (recherche de « Retirer » dans les essais 1 à 93).

---

## 05.11 Zones et portes

1. **Qui, où.** Partenaire propriétaire, pilotage, onglet « Équipe », section « Zones et portes » / « Sans zone, une seule
   entrée « Entrée » admet toutes les catégories : rien à régler. Ajoutez des zones pour séparer les accès (carré VIP,
   backstage). » (`components/partner/zones/ZonesEditor.tsx:214-218`).
2. **Ce qu'il saisit.**
   - **Zone par défaut** : sans zone, encadré « Une seule entrée, toutes les catégories » / « Tous vos contrôleurs
     compostent les billets de toutes les catégories. » et bouton « Configurer des zones », qui prépare **sans rien
     enregistrer** une zone « Entrée » (type Entrée, toutes les catégories) avec une porte « Entrée » (`:172-175`,
     `:238-252`).
   - Par zone : « Nom de la zone » (obligatoire, 40 caractères) ; « Type » : « Entrée » / « Composte le billet : la
     personne entre. » ou « Contrôle de zone » / « Vérifie la catégorie sans composter. Un billet jamais composté est
     signalé « Pas encore entré ». » ; « Catégories admises » (cases, chaque catégorie précédée de sa pastille de couleur
     et du nom de la couleur, « · vente fermée » si inactive) ; « Portes » : « Nom de la porte » (40 caractères), aide
     « Déjà utilisée au contrôle » pour une porte déjà scannée (sans bouton pour la retirer), « Ajouter une porte »,
     « Retirer la zone {nom} » (`:66-69`, `:255-357`, `lib/scan/scan-result.ts:174`).
   - Boutons : « Ajouter une zone » (20 au plus), « Enregistrer les zones » (actif après un changement), « Annuler les
     modifications », « Revenir à une seule entrée » (fenêtre « Revenir à une seule entrée ? » / « Les zones et les portes
     seront supprimées. Tous les contrôleurs pourront de nouveau composter toutes les catégories. », boutons « Supprimer
     les zones » et « Garder les zones ») (`components/partner/zones/ZonesEditor.tsx:71`, `:368-401`).
3. **Ce que fait le système.** Enregistrement de toute la configuration en une opération, journal `EVENT_ZONES_UPDATED`,
   réponse « Zones enregistrées. » (`app/api/partner/events/[id]/zones/route.ts:120-152`,
   `M/20261110000009_lot9ter_zones.sql:468-750`). Règles :
   - **ENTRÉE** composte le billet (la personne entre) ; **CONTRÔLE DE ZONE** vérifie la catégorie sans jamais
     composter (`M/20261110000009_lot9ter_zones.sql:120-121`, `:1133-1172`).
   - Toute catégorie (active ou non) doit entrer par au moins une zone Entrée ; une catégorie créée **après** les zones
     est admise automatiquement par toutes les zones Entrée, jamais par une zone Contrôle (`:143-166`, `:633-646`).
   - Une porte déjà utilisée au contrôle ne peut être ni supprimée ni déplacée ; une zone déjà utilisée ne change plus de
     type et ne se supprime plus ; une porte où des contrôleurs sont affectés ne se supprime pas (`:664-698`). Donc
     « Revenir à une seule entrée » est refusé dès qu'une porte a servi ou qu'un contrôleur y est affecté.
   - Une porte renommée renomme le point d'entrée des contrôleurs qui y sont affectés (`:735-738`).
   - **Contrôleurs sans porte** : sur un événement à zones, un contrôleur sans porte ne peut ni scanner ni vendre ; la
     section l'annonce : « Contrôleur sans porte » / « 1 contrôleur sans porte : il ne peut pas scanner tant que vous ne
     lui attribuez pas une porte. » (ou « {n} contrôleurs sans porte : ils ne peuvent pas scanner… »)
     (`components/partner/zones/ZonesEditor.tsx:222-230`, `M/20261110000009_lot9ter_zones.sql:200-203`, `:1526-1531`).
4. **Messages envoyés.** Aucun.
5. **Ce que voient les autres rôles.** Contrôleurs : leur porte et leur zone sur l'écran de départ (05.15), le résultat
   des zones au scan (05.16). Admin : lecture seule (`M/20261110000009_lot9ter_zones.sql:406-412`).
6. **Refus (bandeau « Zones non enregistrées », focus sur le champ en cause).**

   | Cas | Message | Preuve |
   |---|---|---|
   | Plus de 20 zones / 50 portes | « 20 zones au plus par événement. » / « 50 portes au plus par événement. » | `M/20261110000009_lot9ter_zones.sql:508`, `:519` |
   | Nom vide ou trop long | « Donnez à chaque zone un nom de 1 à 40 caractères. » / « Donnez à chaque porte un nom de 1 à 40 caractères. » | `:525`, `:553` |
   | Doublon | « Deux zones portent le nom {nom} : choisissez des noms différents. » / « Deux portes portent le nom {nom} : choisissez des noms différents. » | `:569`, `:579` |
   | Zone sans porte / sans catégorie | « La zone {nom} n’a aucune porte : ajoutez-en au moins une. » / « La zone {nom} n’admet aucune catégorie : cochez-en au moins une. » | `:588`, `:595` |
   | Aucune zone Entrée | « Il faut au moins une zone de type Entrée : c’est là que les billets sont compostés. » | `:603` |
   | Catégorie sans entrée | « La catégorie {nom} n’entre par aucune zone de type Entrée : cochez-la dans une zone d’entrée. » | `:643-644` |
   | Porte déjà utilisée | « La porte {nom} a déjà servi au contrôle : elle ne peut être ni supprimée ni changée de zone. » | `:670`, `:685` |
   | Porte affectée | « Des contrôleurs sont affectés à la porte {nom} : changez d’abord leur porte dans l’équipe. » | `:673` |
   | Zone déjà utilisée | « La zone {nom} a déjà servi au contrôle : son type ne peut plus changer et elle ne peut plus être supprimée. » | `:697` |
   | Statut, droits (bandeau « Zones en lecture seule » à l'ouverture) | « Seul l’organisateur modifie les zones de son événement. » ; « Votre compte n’est pas actif. » ; « Les zones d’un événement terminé ou annulé ne peuvent plus être modifiées. » ; « L’événement est en cours de validation : retirez-le de la validation pour modifier ses zones. » | `:406-412`, `:609-622` ; `components/partner/zones/ZonesEditor.tsx:219-221` |
   | Autre | « Demande invalide. » ; panne « Zones momentanément indisponibles. » ; écran, sinon « Enregistrement impossible pour le moment. » | `app/api/partner/events/[id]/zones/route.ts:11`, `:141-143` ; `components/partner/zones/ZonesEditor.tsx:201` |

7. **Preuves et essai.** Recette : essais 77 et 81 (`docs/recette-billetterie.md:1657-1678`, `:1750-1768`).

---

## 05.12 Porte d'un contrôleur, « Peut changer de porte », changement de porte

1. **Qui, où.** Partenaire propriétaire, pilotage, onglet « Équipe », carte du contrôleur d'un événement à zones
   (`components/partner/pilotage/TeamTab.tsx:70-138`, `:254-256`). Contrôleur : écran de départ du scanner, bouton
   « Changer de porte » (`components/scan/ScannerStartScreen.tsx:197-199`).
2. **Ce qu'il saisit.**
   - Partenaire : liste « Porte » (« Aucune porte », puis « {porte} — {zone} »), interrupteur « Peut changer de porte » /
     « Le contrôleur choisit lui-même sa porte dans le scanner. », bouton « Enregistrer » (`components/partner/pilotage/TeamTab.tsx:113-136`,
     `:409-412`).
   - Contrôleur autorisé : fenêtre « Choisir ma porte », une option par porte « {porte} · {zone} ({Entrée | Contrôle de
     zone}) », bouton « Enregistrer cette porte » (`components/scan/ScannerStartScreen.tsx:86-118`).
3. **Ce que fait le système.**
   - Partenaire : porte et droit enregistrés ; le point d'entrée prend le nom de la porte (retirée : effacé) ; journal
     `CONTROLLER_GATE_SET` ; toast « Porte de {nom} : {porte}. » ou « Porte de {nom} retirée. »
     (`M/20261110000009_lot9ter_zones.sql:759-825`, `app/api/partner/team/gate/route.ts:30-79`, `components/partner/pilotage/TeamTab.tsx:104`).
   - Contrôleur : sans code PIN, journal `CONTROLLER_GATE_CHANGED` ; toast « Votre porte : {porte}. »
     (`M/20261110000009_lot9ter_zones.sql:832-877`, `components/scan/ScannerStartScreen.tsx:70-73`).
   - Porte changée pendant le contrôle : le scan suivant n'écrit rien et affiche l'écran gris « Votre porte a changé » /
     « Le contrôle reprend avec votre nouvelle porte : scannez de nouveau. » ; les affectations sont relues
     (`M/20261110000009_lot9ter_zones.sql:200-209`, `components/scan/CombatFlashOverlay.tsx:102-106`,
     `components/scan/scan-client.ts:394-395`, `app/controller/scanner/page.tsx:737`).
4. **Messages envoyés.** Aucun (`M/20261110000009_lot9ter_zones.sql:753-758`).
5. **Ce que voient les autres rôles.** La partenaire voit la porte choisie par le contrôleur à la relecture de l'onglet.
6. **Refus.** Partenaire : « Porte inconnue : choisissez une porte de cet événement. » ; « Ce contrôleur n’est pas affecté
   à cet événement. » ; « Événement introuvable. » ; « Votre compte n’est pas actif. » ; « Affectation invalide :
   événement, contrôleur et porte requis. » ; panne « Modification momentanément indisponible. » ; écran, sinon
   « Modification de la porte impossible. » (`M/20261110000009_lot9ter_zones.sql:784-813`,
   `app/api/partner/team/gate/route.ts:50`, `:77`, `components/partner/pilotage/TeamTab.tsx:107`). Contrôleur (bandeau « Porte non changée ») :
   « L’organisateur ne vous autorise pas à changer de porte. » ; « Vous n’êtes pas affecté à cet événement. » ; « Porte
   inconnue : choisissez une porte de cet événement. » ; « Choix de porte invalide : événement et porte requis. » ;
   panne « Changement de porte momentanément impossible. » / « Portes momentanément indisponibles : réessayez. »
   (`M/20261110000009_lot9ter_zones.sql:848-866`, `app/api/controller/gates/route.ts:34`,
   `app/api/controller/gate/route.ts:42`, `:59`, `components/scan/ScannerStartScreen.tsx:56`).
7. **Preuves et essai.** Recette : essais 77 et 81 (`docs/recette-billetterie.md:1657-1678`, `:1750-1768`).

---

## 05.13 Couleur et consigne d'entrée d'une catégorie (question A1)

1. **Qui, où.** **Seule** la partenaire propriétaire, dans le **formulaire de modification de l'événement** :
   `/partner/events/<id>/edit` (bouton « Modifier » de la carte de l'événement ou du pilotage), étape « Billets »
   (titre « Billetterie »), sur une catégorie **déjà enregistrée** : bloc « Au contrôle des entrées », champs
   « Couleur au contrôle » et « Consigne d’entrée », puis « Enregistrer la catégorie »
   (`app/partner/events/[id]/page.tsx:217-221`, `components/events/EventForm.tsx:84`, `:1127-1138`,
   `components/events/EventTicketing.tsx:243`, `:381-406`). Le bouton « Modifier » n'apparaît que pour un événement
   Brouillon, Validé, Publié ou Suspendu (`M/20261109000008_lot9bis_cycle.sql:438`).
   **Aucun autre écran ne permet de les régler** : ni la création de l'événement (le bloc n'apparaît qu'une fois la
   catégorie enregistrée ; le serveur refuserait ces champs à la création, `components/events/EventTicketing.tsx:25-26`,
   `lib/validations/event.ts:516-522`), ni l'onglet Équipe du pilotage (l'éditeur des zones les **montre** seulement :
   pastille et nom de la couleur, `components/partner/zones/ZonesEditor.tsx:294-311`), ni l'administration (« Seul
   l’organisateur modifie la billetterie de son événement. », `M/20261108000001_lot9_securite.sql:537-540`).
2. **Ce qu'il saisit.** « Couleur au contrôle » : « Aucune couleur », « Blanc », « Or », « Argent », « Rose »,
   « Turquoise », « Bleu nuit », « Violet », « Noir » ; aide « Bande de couleur montrée au contrôleur avec le nom de la
   catégorie. ». « Consigne d’entrée » : exemple « Par exemple : Remettre bracelet doré », aide « Facultative, 60
   caractères au plus. Affichée en gros au contrôleur quand le billet est validé à l’entrée. »
   (`components/events/EventTicketing.tsx:55-58`, `:381-406`, `lib/scan/scan-result.ts:208-220`). Détail des champs et
   des refus : `04-evenement-cycle.md`, 04.15.
3. **Ce que fait le système.** Enregistrées sur la catégorie (espaces répétés ramenés à un seul, vide = effacée) ; jamais
   lisibles par le public ni par un client (`M/20261110000011_lot9ter_stock.sql:436-457`,
   `M/20261110000009_lot9ter_zones.sql:104-112`, `:136-139`). Couleurs à l'écran du scanner : Blanc #FFFFFF, Or
   #FACC15, Argent #D4D4D8, Rose #F9A8D4, Turquoise #67E8F9, Bleu nuit #1E3A8A (texte blanc), Violet #581C87 (texte
   blanc), Noir #000000 (texte blanc) ; jamais rouge, vert ni orange, réservés aux verdicts (`app/globals.css:85-100`,
   `lib/scan/scan-result.ts:203-207`).
4. **Messages envoyés.** Aucun : un changement de couleur ou de consigne ne prévient personne
   (`M/20261110000006_lot9ter_equipe_messages.sql:30-34`).
5. **Ce que voient les autres rôles.** Contrôleur, scanner plein écran : sur « Entrée validée », le nom de la catégorie en
   très grand sur sa bande de couleur, la consigne en gros dessous ; sur « Accès autorisé » (contrôle de zone), la bande
   sans la consigne (la consigne n'est servie que pour une entrée validée) (`components/scan/CombatFlashOverlay.tsx:209-285`,
   `M/20261110000009_lot9ter_zones.sql:1266-1270`). Scan de la partenaire : la consigne en gras sur une entrée validée
   (`components/scan/ScanResultPanel.tsx:109-111`).
6. **Refus.** « Choisissez une couleur dans la liste. » ; « La consigne d’entrée ne dépasse pas 60 caractères. »
   (`M/20261110000011_lot9ter_stock.sql:438-457`) ; statut : voir 04.15.
7. **Preuves et essai.** Recette : essai 77, étape 1 (`docs/recette-billetterie.md:1657-1678`). Question A1 de la recette :
   voir `00-index.md`.

---

## 05.14 Fenêtre d'ouverture du contrôle

1. **Qui, où.** Réglages SUPERADMIN « Ouverture du contrôle avant le début » et « Fermeture du contrôle après la fin »
   (`app/admin/finance-settings/page.tsx:77-78` ; voir `11-admin-superadmin.md`).
2. **Ce qu'il saisit.** Un nombre d'heures de 0 à 48 ; valeurs initiales **6 h** et **6 h**
   (`docs/guide/11-admin-superadmin.md:506-507`).
3. **Ce que fait le système.** Le contrôle (scan, saisie manuelle, liste des invités, guichet, ouverture de caisse) est
   ouvert si l'événement est **Publié**, ou **Terminé** tant que la fenêtre court, et seulement entre (début − heures
   avant) et (fin + heures après) ; la fin est la date et l'heure de fin saisies, sinon début + 6 h (voir 04). Un
   événement Validé jamais publié puis passé à Terminé n'ouvre jamais le contrôle. Annulé : `event_cancelled` ;
   Suspendu : `event_suspended` (`M/20261102000003_lot5_cycle.sql:857-868`, `M/20261110000007_lot9ter_evenements.sql:122-145`).
   Le scanner reçoit cet état du serveur pour chaque affectation et se relit seul à l'heure d'ouverture et de fermeture
   (`app/api/controller/assignments/route.ts:23-41`, `M/20261109000008_lot9bis_cycle.sql:693-740`,
   `app/controller/scanner/page.tsx:200-203`).
4. **Messages envoyés.** Aucun.
5. **Ce que voit le contrôleur** (bandeau à la place de la caméra, `app/controller/scanner/page.tsx:234-263`) :

   | Situation | Titre | Texte |
   |---|---|---|
   | Avant l'ouverture | « Contrôle pas encore ouvert » | « Contrôle ouvert à partir du {date} à {heure}. Le scan s’activera de lui-même à cette heure. » |
   | Après la fermeture | « Contrôle fermé » | « Contrôle fermé depuis le {date} à {heure} : les scans ne sont plus autorisés sur cet événement. » |
   | Non publié | « Événement non publié » | « Le contrôle ouvrira quand l’événement sera publié. » |
   | Annulé | « Événement annulé » | « Événement annulé : aucune entrée n’est possible, les billets sont remboursés. » |
   | Suspendu | « Événement suspendu » | « Les contrôles d’accès sont suspendus sur cet événement. » |
   | État absent | « État du contrôle inconnu » | « Le serveur n’a pas indiqué si le contrôle est ouvert : rechargez la page. » |

   Sur l'écran de départ, un événement fermé porte « {À venir | Non publié | Terminé | Suspendu | Annulé} : contrôle
   fermé » (`app/controller/scanner/page.tsx:225-232`, `components/scan/ScannerStartScreen.tsx:171`).
6. **Refus.** Un scan hors fenêtre donne « Contrôle pas encore ouvert » ou « Événement terminé » (05.16).
7. **Preuves et essai.** Recette : essai 72 (`docs/recette-billetterie.md:1560-1576`).

---

## 05.15 Scanner : écran « Commencer le contrôle »

1. **Qui, où.** Contrôleur actif (rôle CONTRÔLEUR, compte actif ; admin aussi) : `/controller/scanner`, page d'arrivée
   après la connexion d'un contrôleur (`middleware.ts:213-217`, `:239-258`). Thème sombre forcé, en-tête « Mon espace
   client », cloche, nom du contrôleur (`app/controller/layout.tsx:44-84`). Titre « Commencer le contrôle », texte
   « {prénom nom}, choisissez l’événement, vérifiez votre porte, puis lancez la caméra. »
   (`components/scan/ScannerStartScreen.tsx:140-143`).
2. **Ce qu'il saisit.** « Événement à contrôler » : un bouton radio par affectation (titre, date, lieu ; « {état} :
   contrôle fermé » pour un événement fermé) (`:147-175`). Phrase sous la liste (`:186-196`) :
   - événement à zones avec porte : « Votre porte : {porte} · {zone} ({Entrée | Contrôle de zone}). Le compteur
     affichera les {entrées | contrôles} de cette porte. Le téléphone vibre à chaque résultat ; aucun son n’est émis. » ;
   - sans zone, point d'entrée réglé : « Votre porte : {point}. Le compteur affichera les entrées de cette porte. Le
     téléphone vibre à chaque résultat ; aucun son n’est émis. » ;
   - sans point : « Aucune porte ne vous est attribuée : le compteur affichera vos propres entrées. Le téléphone vibre à
     chaque résultat ; aucun son n’est émis. » ;
   - événement à zones sans porte : bandeau « Aucune porte attribuée » / « Cet événement a des portes : demandez à
     l’organisateur de vous en attribuer une avant de scanner. » (`:180-184`).
   Boutons « Changer de porte » (si autorisé, 05.12) et « Commencer le contrôle » (`:200-206`). Ce premier toucher
   autorise la vibration et ouvre la caméra (`:3-6`).
3. **Ce que fait le système.** Lit les affectations (`GET /api/controller/assignments`) avec, pour chacune, l'état du
   contrôle, la permission espèces, la caisse ouverte, la porte, le guichet activé ou non
   (`app/api/controller/assignments/route.ts:1-123`). Après « Commencer » : en-tête compact (titre, compteur « {porte} :
   {n} entrée(s) » ou « {porte} : {n} contrôle(s) », « En ligne » / « Hors ligne », « Changer d’événement »,
   « Se déconnecter ») ; onglets « Contrôle », « Guichet » (permission espèces et guichet activé), « Caisse » (permission
   espèces, ou caisse encore ouverte) ; boutons « Caméra » / « Saisie manuelle » ; « Liste des invités » (porte d'entrée
   ou sans zone) ; « Derniers scans » avec « Vous : {n} entrée(s), {m} refus » ; « Réglages de cet appareil » : « Retour
   au scan après une entrée validée » (1 ; 1,5 ; 2 ou 3 s, 1,5 s par défaut) / « Un refus reste affiché 3 secondes.
   Touchez l’écran pour revenir tout de suite. » (`components/scan/ScanStatusBar.tsx:36-60`,
   `app/controller/scanner/page.tsx:186-192`, `:982-997`, `:1076-1137`, `components/scan/ScanHistoryList.tsx:53-91`).
   L'événement, le mode et l'onglet sont retenus 24 h sur l'appareil (`lib/scan/scan-session.ts:62`).
4. **Messages envoyés.** Aucun.
5. **Ce que voient les autres rôles.** La partenaire voit « Contrôleurs actifs » et la dernière activité dans le pilotage
   dès le premier scan (05.27).
6. **Refus.** Aucune affectation : « Aucun événement assigné » / « Vous serez informé lorsqu’un nouvel événement vous
   sera assigné. » (`app/controller/scanner/page.tsx:920-938`). Lecture impossible : « Vos événements n’ont pas pu être
   chargés », avec « Impossible de charger les événements. » ou « Réseau indisponible : vos événements n’ont pas pu être
   chargés. » (`:296`, `:335`, `:905-915`). Contrôle précédent non repris : 05.10 et 05.14.
7. **Preuves et essai.** Recette : essais 30 et 77 (`docs/recette-billetterie.md:824-838`, `:1657-1678`).

---

## 05.16 Scanner : chaque résultat, son texte exact, sa couleur et sa vibration

1. **Qui, où.** Contrôleur, scanner, mode « Caméra » : « Présentez le QR » (`components/scan/CameraQrScanner.tsx:558`).
2. **Ce qu'il saisit.** Rien : la caméra lit le QR du billet (`EVT1:{billet}:{code}`, code qui change toutes les 20 s,
   tolérance d'un pas avant ou après) (`lib/security/totp.ts:14-15`, `:73-95`).
3. **Ce que fait le système.** Une clé unique par lecture ; le serveur décide dans cet ordre, et s'arrête au premier
   refus : droit du scanneur sur l'événement → porte → forme du QR → billet de cet événement → code dynamique et version
   du billet → état et fenêtre de l'événement → (porte de contrôle de zone : refus du billet puis verdict de zone, jamais
   de compostage) → statut du billet → transfert en attente → paiement → mauvaise zone à une porte d'entrée →
   compostage. Chaque lecture laisse une ligne au journal des scans, sauf un problème de porte, la relance d'une même lecture
   (verdict d'origine rendu) et un renvoi après une sortie de l'application (`M/20261110000009_lot9ter_zones.sql:903-1272`). Le même QR qu'une entrée validée relu dans les 20 s est
   ignoré, avec « Même billet que l’entrée validée à {HH:MM} : présentez le billet suivant. »
   (`app/controller/scanner/page.tsx:187`, `:801-806`). Quota : 30 scans par 10 s par scanneur (`lib/env.ts:82`).
   Résultat en **plein écran**, vibration selon la catégorie, aucun son ; retour automatique (entrée validée et accès
   autorisé : réglage de l'appareil ; autres : 3 s), « Retour automatique au scan · touchez pour passer »
   (`components/scan/CombatFlashOverlay.tsx:174-180`, `:310-317` ; `lib/hardware/feedback.ts:1-24`).

   Couleurs (fond / texte) : vert #4ADE80 / noir ; rouge « déjà utilisé » #991B1B / blanc ; rouge « refus » #7F1D1D /
   blanc ; jaune « hors fenêtre » #FBBF24 / noir ; orange « orientation » #FB923C / noir ; gris « technique » #27272A /
   blanc (`app/globals.css:70-81`). Vibrations : **une impulsion courte** (60 ms) ; **trois impulsions marquées**
   (120-60-120-60-120 ms) ; **deux impulsions longues** (250-100-250 ms) ; **aucune** pour un incident technique ; aucune
   sur un iPhone ou un navigateur sans vibration (`lib/hardware/feedback.ts:16-24`, `:44-54`).

   | Résultat | Fond | Titre exact | Lignes affichées | Vibration | Preuve |
   |---|---|---|---|---|---|
   | Entrée validée (`valid`) | vert | « Entrée validée » | sans couleur, consigne ni zone : nom du porteur en grand (« Porteur non renseigné » s'il manque ; « Vente au guichet » ; nom de l'invité ou « Invité »), puis « {catégorie} · {numéro} » ; avec l'un d'eux : catégorie en très grand sur sa bande de couleur, consigne en gros, « Zone : {zone} · {porte} », nom, numéro ; badge « Invitation » ou « Gratuit » selon l'origine | courte | `components/scan/CombatFlashOverlay.tsx:118`, `:207-277`, `:308` ; `M/20261110000009_lot9ter_zones.sql:1107-1114`, `:1266-1270` |
   | Accès autorisé (`zone_ok`, porte de contrôle de zone, billet déjà entré et admis) | vert | « Accès autorisé » | catégorie sur sa bande, « Zone : {zone} », « Entré à {HH:MM}, {porte} », nom ; rien n'est composté | courte | `:207`, `:279-285` ; `lib/scan/scan-result.ts:69` |
   | Billet déjà utilisé (`already_used`) | rouge foncé | « Billet déjà utilisé » | « Déjà utilisé à {HH:MM}, {porte} » (porte de la 1re entrée ; un nom qui commence par Porte, Portail, Entrée, Accès ou Guichet est gardé tel quel, sinon « porte {nom} ») ; « Déjà validé par vous à {HH:MM} » si c'est le même contrôleur il y a moins de 30 s ; nom ; « Billet : {catégorie} · {numéro} » | trois | `components/scan/CombatFlashOverlay.tsx:119`, `:201-206`, `:289-299` ; `lib/scan/scan-result.ts:189-199` ; `app/controller/scanner/page.tsx:1183-1184` |
   | Billet invalide (`invalid`) | rouge | « Billet invalide » | aucun billet affiché (billet inconnu) | trois | `lib/scan/scan-result.ts:54` |
   | Billet annulé (`cancelled`) | rouge | « Billet annulé » | nom, billet | trois | `:55` |
   | Billet remboursé (`refunded`, remboursé ou en cours) | rouge | « Billet remboursé » | nom, billet | trois | `:56` |
   | Billet d’un autre événement (`wrong_event`) | rouge | « Billet d’un autre événement » | aucun billet affiché | trois | `:57` |
   | QR expiré (`qr_expired` : capture d'écran, ancien QR après transfert ou régénération) | rouge | « QR expiré : demandez au client d’ouvrir son billet dans l’application » | nom, billet | trois | `:63` |
   | QR non dynamique (`dynamic_qr_required` : identifiant nu, autre QR) | rouge | « QR dynamique requis (billet ouvert dans l’application) » | — | trois | `:64` ; `app/api/controller/scan/route.ts:180-184` |
   | Paiement requis (`payment_required`) | rouge | « Paiement requis » | nom, billet | trois | `:62` |
   | Transfert en cours (`transfer_pending`) | rouge | « Transfert en cours » | nom, billet (le texte d'explication prévu n'est jamais affiché : constat W5-13) | trois | `:66`, `:83` |
   | Saisie manuelle refusée (`manual_entry_refused`) | rouge | « Saisie manuelle refusée » | — | trois | `:65` |
   | Mauvaise zone (`wrong_zone`) | orange | « Accès refusé : billet {catégorie} » (« Accès refusé » sans catégorie) | « Présentez-vous à : {zone 1}[ ou {zone 2}] » ou « Aucune zone n’admet ce billet : appelez l’organisateur. » ; nom ; billet ; rien n'est composté | deux longues | `components/scan/CombatFlashOverlay.tsx:125`, `:186-188`, `:213-216` ; `app/api/controller/scan/route.ts:48-53` |
   | Pas encore entré (`not_entered`, porte de contrôle, billet jamais composté) | orange | « Pas encore entré » | « Passez d’abord par : {zone d'entrée} » | deux longues | `lib/scan/scan-result.ts:68` ; `M/20261110000009_lot9ter_zones.sql:236-298` |
   | Contrôle pas encore ouvert (`event_not_open`) | jaune | « Contrôle pas encore ouvert » | nom, billet | deux longues | `lib/scan/scan-result.ts:61` |
   | Événement terminé (`event_ended`) | jaune | « Événement terminé » | nom, billet | deux longues | `:60` |
   | Événement annulé (`event_cancelled`) | rouge (icône calendrier barré) | « Événement annulé » | nom, billet | trois | `components/scan/CombatFlashOverlay.tsx:122`, `:131-134` |
   | Événement suspendu (`event_suspended`) | rouge (icône interdit) | « Événement suspendu » | nom, billet | trois | `:129-132`, `:185` |

   Ordre : un billet annulé ou remboursé dont le QR est périmé donne « Billet annulé » / « Billet remboursé » (pas « QR
   expiré ») ; un QR valable hors fenêtre donne l'état de l'événement avant celui du billet ; à une porte d'entrée, les
   refus rouges passent avant la mauvaise zone (`M/20261110000009_lot9ter_zones.sql:1115-1131`, `:1232-1242`).
4. **Messages envoyés.** Aucun au porteur ni au contrôleur. Une série de refus à une porte peut alerter la partenaire
   (05.28).
5. **Ce que voient les autres rôles.** Le titulaire voit son billet passer à « Utilisé » ; la partenaire voit l'entrée ou
   le refus en direct dans l'onglet « Entrées » (05.27). Le résultat compté pour le compteur de porte et « Vous : … » est
   relu sur le serveur (`app/controller/scanner/page.tsx:20-21`).
6. **Refus.** Ceux du tableau. Problèmes de porte et incidents : 05.17.
7. **Preuves et essai.** Recette : essais 30, 31, 28, 77, 81 (`docs/recette-billetterie.md:824-854`, `:790-803`,
   `:1657-1678`, `:1750-1768`).

---

## 05.17 Scanner : incidents techniques, hors ligne, scan sans réponse, reprise

1. **Qui, où.** Contrôleur, scanner.
2. **Ce qu'il saisit.** Rien.
3. **Ce que fait le système.** Pendant l'envoi : « Envoi… », puis après 1,5 s « Réseau lent » / « Ne refaites pas
   scanner : nouvel essai automatique (essai {n} sur 3). » ; trois essais au plus (4, 6 puis 8 s), avec la **même clé** :
   le serveur rend le verdict d'origine, jamais une seconde entrée (`app/controller/scanner/page.tsx:184-185`,
   `:1003-1016` ; `components/scan/scan-client.ts:36-41`, `:213-249`). Écran **gris**, sans vibration, jamais compté
   comme refus, avec « Le billet n’est pas en cause. Ne refusez pas le spectateur pour ce motif : faites patienter et
   réessayez. » (`components/scan/CombatFlashOverlay.tsx:123`, `:301-306`) :

   | Cas | Titre | Texte | Preuve |
   |---|---|---|---|
   | Téléphone hors ligne (rien n'est envoyé) | « Hors ligne : rien n’est validé » | « Hors ligne : rien n’est validé. Faites patienter le spectateur et reprenez au retour du réseau. » | `components/scan/scan-client.ts:208-211`, `:386-387` |
   | Coupure ou délai dépassé (le billet a pu être composté) | « Résultat inconnu : scannez de nouveau » | « Réseau trop lent : résultat inconnu. Scannez de nouveau le même billet. » ou « Erreur réseau : réessayez » | `:240-242`, `:388-392` |
   | Session expirée | « Session expirée » | « Session expirée : reconnectez-vous pour continuer le contrôle. » | `:147-149`, `:379-380` |
   | Droit retiré | « Vous ne contrôlez plus cet événement » | « Vous n’êtes pas autorisé à contrôler cet événement. » | `:150-155`, `:381-383` |
   | Cadence | « Trop de scans : patientez quelques secondes » | idem | `app/api/controller/scan/route.ts:94-97` |
   | Panne du serveur | « Erreur serveur : réessayez » | « Contrôle momentanément indisponible. » ou le texte de la panne | `:88-92`, `:114-117` |
   | Aucune porte | « Aucune porte affectée » | « Demandez à l’organisateur de vous attribuer une porte. Rien n’a été validé. » | `components/scan/scan-client.ts:394-395` ; `components/scan/CombatFlashOverlay.tsx:102-106` |
   | Porte changée | « Votre porte a changé » | « Le contrôle reprend avec votre nouvelle porte : scannez de nouveau. » | idem |
   | Porte inconnue | « Porte inconnue » | « Choisissez une porte de cet événement. » | idem |
   | Renvoi sans trace en base | « Scan non traité : scannez le billet de nouveau » | « Aucune entrée enregistrée. » | `lib/scan/scan-result.ts:73`, `:80` |

   - **Hors ligne** : bandeau permanent « Hors ligne : aucune entrée ne peut être validée » / « Faites patienter, passez
     sur le routeur de secours, puis reprenez. » ; la saisie manuelle et la liste des invités sont désactivées
     (« Hors ligne : la saisie manuelle reprendra au retour du réseau. », « Hors ligne : la liste des invités reprendra
     au retour du réseau. ») ; **aucune validation hors ligne** (`app/controller/scanner/page.tsx:1059`, `:1106`,
     `:1199-1205`).
   - **Scan sans réponse** : la clé et la lecture restent 2 minutes sur l'appareil et sont renvoyées au retour du réseau
     ou de l'application, en demandant **seulement** le verdict d'origine (jamais un compostage) : bandeau « Scan sans
     réponse » / « Billet lu à {HH:MM} sans réponse : renvoi au retour du réseau, sans double entrée. », ou après
     2 minutes « Billet lu à {HH:MM} sans réponse : vérifiez « Derniers scans » ou scannez-le de nouveau. » ; un
     verdict retrouvé s'affiche avec « Résultat retrouvé : billet lu à {HH:MM}. » et attend un toucher
     (`lib/scan/scan-session.ts:64`, `app/controller/scanner/page.tsx:757`, `:765`, `:1066-1070`, `:1165-1168`,
     `components/scan/CombatFlashOverlay.tsx:252-256`, `app/api/controller/scan/route.ts:41-42`).
   - **Caméra** : coupée après 3 minutes sans lecture (« Caméra en veille » / « Aucun billet lu depuis 3 minutes : la
     caméra est coupée pour la batterie. ») et en arrière-plan (« Caméra coupée » / « Application en arrière-plan : la
     caméra est coupée, votre contrôle reste ouvert. ») ; au retour : « Contrôle retrouvé » / « Même événement, même
     mode : rallumez la caméra. » ; refus d'accès : « Accès à la caméra refusé. Autorisez la caméra dans les réglages du
     navigateur, ou passez en saisie manuelle. » (`components/scan/CameraQrScanner.tsx:41`, `:72-76`, `:111-116`).
   - Les coupures et délais rencontrés sont envoyés plus tard au serveur (20 au plus par envoi) et apparaissent dans
     « Incidents techniques » du pilotage (`app/controller/scanner/page.tsx:197`, `:520-540`, `:669` ; 05.27).
4. **Messages envoyés.** Aucun.
5. **Ce que voient les autres rôles.** Partenaire : « Incidents techniques » dans l'onglet Entrées.
6. **Refus.** Ceux du tableau.
7. **Preuves et essai.** Recette : essais 32, 34, 35 (`docs/recette-billetterie.md:856-920`).

---

## 05.18 Saisie manuelle d'un numéro de billet

1. **Qui, où.** Contrôleur, scanner, bouton « Saisie manuelle » (`app/controller/scanner/page.tsx:1089-1098`). Le
   réglage SUPERADMIN « Saisie manuelle d’un numéro de billet » décide qui peut l'utiliser : « Contrôleur affecté seul »
   (valeur initiale) ou « Contrôleur affecté, partenaire et admin » (`app/admin/finance-settings/page.tsx:47-50`,
   `:79` ; `docs/guide/11-admin-superadmin.md:508`).
2. **Ce qu'il saisit.** En deux temps (`components/scan/ManualEntryForm.tsx:70-170`) :
   1. « Numéro du billet » (exemple « TCK-20261101-XXXXXXXXXX », aide « Spectateur sans téléphone : saisissez le numéro
      imprimé sur son billet, puis vérifiez le titulaire avant de valider. », 4 caractères au moins), bouton « Vérifier
      le billet » ;
   2. fiche « Billet {numéro} » : « Titulaire », « Catégorie », « Billet » (statut), « Résultat prévu » ; si l'entrée est
      possible, case obligatoire « Pièce d’identité conforme au titulaire » / « Le nom sur la pièce correspond au
      titulaire ci-dessus. Obligatoire. », puis « Pièce conforme, valider l’entrée » ; « Nouvelle vérification ».
3. **Ce que fait le système.** La vérification ne composte rien et prévoit le résultat (mêmes règles que le scan, porte
   comprise) ; quota de 20 vérifications par minute (`app/api/controller/scan/lookup/route.ts:35-70`,
   `lib/env.ts:103`, `M/20261110000009_lot9ter_zones.sql:1281-1414`). La validation passe par la voie du scan avec la
   clé créée à la vérification et « pièce vérifiée » ; résultat plein écran comme en 05.16
   (`app/controller/scanner/page.tsx:812-820`, `app/api/controller/scan/route.ts:201-208`). Sans pièce vérifiée, ou
   hors du périmètre du réglage : « Saisie manuelle refusée » (`M/20261110000009_lot9ter_zones.sql:1064-1080`).
4. **Messages envoyés.** Aucun.
5. **Ce que voient les autres rôles.** Pilotage : l'entrée, avec la méthode « Saisie manuelle » (`lib/scan/scan-result.ts:154-160`).
6. **Refus.** « Aucun billet de cet événement ne porte ce numéro » / « Vérifiez la saisie avec le spectateur. Aucune
   entrée n’a été validée. » ; entrée impossible : « Entrée impossible : {résultat prévu} » / « Ne laissez pas entrer le
   spectateur avec ce billet. » ; porte de contrôle, billet déjà entré : « Accès autorisé » / « Billet déjà entré, admis
   dans cette zone : laissez passer le spectateur. » ; orientation : « Ce billet n’est pas admis dans cette zone :
   orientez le spectateur vers la zone de son billet. » ou « Ce billet n’a pas encore été validé à l’entrée : orientez
   le spectateur vers une porte d’entrée. » (`components/scan/ManualEntryForm.tsx:104-169`). « Vérification
   impossible » : « Session expirée : reconnectez-vous pour continuer le contrôle. », « Vous n’êtes pas autorisé à
   vérifier un billet de cet événement. », « Trop de vérifications : patientez quelques secondes. », « Réseau trop
   lent : réessayez la vérification. », « Réseau indisponible : réessayez la vérification. », « Hors ligne : la
   vérification reprendra au retour du réseau. » (`components/scan/scan-client.ts:278-322`).
7. **Preuves et essai.** Recette : essai 33 (`docs/recette-billetterie.md:871-887`).

---

## 05.19 Billet hors ligne présenté au contrôle

1. **Qui, où.** Le titulaire ouvre son billet sans réseau (voir `07-billets.md`) ; le contrôleur le scanne normalement.
2. **Ce qu'il saisit.** Rien.
3. **Ce que fait le système.** Le billet hors ligne affiche un QR calculé d'avance avec le **même secret** que le QR en
   ligne (codes téléchargés de 24 h avant le début jusqu'à la fin du contrôle) : le scanner le traite comme un QR
   ordinaire (`lib/tickets/offline-codes.service.ts:1-11`, `:38-44`, `lib/security/totp.ts:73-95`). Si le billet a
   changé depuis le téléchargement (transfert, annulation, remboursement, régénération), sa version ne correspond plus :
   « QR expiré… », « Billet annulé » ou « Billet remboursé » (`M/20261110000009_lot9ter_zones.sql:1115-1126`). C'est le
   **téléphone du client** qui peut être hors ligne, pas le scanner : le scanner exige le réseau (05.17).
4. **Messages envoyés.** Aucun.
5. **Ce que voient les autres rôles.** Comme un scan ordinaire.
6. **Refus.** Ceux de 05.16.
7. **Preuves et essai.** Recette : essais 26 et 32 (`docs/recette-billetterie.md:756-771`, `:856-869`).

---

## 05.20 Liste des invités (invité sans smartphone)

1. **Qui, où.** Contrôleur, scanner, bouton « Liste des invités », à une porte d'entrée ou sans zone, inactif hors ligne
   (`app/controller/scanner/page.tsx:993`, `:1100-1108`). Titre « Liste des invités », texte « Invitations pas encore
   acceptées dans l’application. Saisissez les 4 derniers chiffres ou le numéro complet. »
   (`components/scan/GuestListPanel.tsx:164-170`).
2. **Ce qu'il saisit.** « Numéro de l’invité » (aide « Exemple : 4567 ou 77 123 45 67. Chaque recherche est enregistrée
   à votre nom. »), « Rechercher » ; puis « Choisir » sur un invité (nom en grand ou « Invité sans nom », catégorie,
   « {n} billet(s) ») ; écran de l'invité : bandeau « Vérifiez la pièce d’identité » / « Comparez le nom avec la pièce
   d’identité de la personne avant de valider. », case « J’ai vérifié la pièce d’identité », « Valider l’entrée d’une
   personne », « Retour à la liste », « Fermer la liste » (`:126-216`).
3. **Ce que fait le système.** Recherche parmi les invitations **valides, sans porteur** (non acceptées dans
   l'application) dont la dernière invitation vise ce numéro ; 10 groupes au plus, jamais le numéro en clair ; quota de
   30 recherches par heure ; chaque recherche est journalisée (`GUEST_LIST_SEARCH`) (`M/20261110000008_lot9ter_invites.sql:51-152`,
   `lib/env.ts:108`). Validation : une personne à la fois, par la voie du scan (méthode « Liste des invités »), pièce
   vérifiée obligatoire et même périmètre que la saisie manuelle ; le billet est composté et l'invitation close ; s'il
   reste des billets pour cet invité : « Encore {n} billets pour cet invité. » ou « Encore 1 billet pour cet invité. »
   (`M/20261110000009_lot9ter_zones.sql:1103-1106`, `:1198-1218`, `:1243-1262` ; `components/scan/GuestListPanel.tsx:105-123`,
   `:135-139`). Plein écran comme en 05.16, avec le nom de l'invité.
4. **Messages envoyés.** Aucun (billet sans porteur) (`M/20261110000009_lot9ter_zones.sql:1243-1245`).
5. **Ce que voient les autres rôles.** Pilotage : carte « Liste des invités » et section « Validations par la liste des
   invités » (05.27) ; l'invitation n'est plus réclamable.
6. **Refus.** « Saisissez les 4 derniers chiffres ou le numéro complet de l’invité. » ; « Vous n’êtes pas autorisé à
   consulter la liste des invités de cet événement. » ; « Trop de recherches dans l’heure : réessayez dans {n} min. » ;
   « Liste des invités momentanément indisponible. Réessayez. » ; « Réseau indisponible : réessayez la recherche. » ;
   aucun résultat : « Aucune invitation non utilisée pour ce numéro. » ; plus de 10 : « Plusieurs invités
   correspondent » / « Plusieurs invités correspondent : saisissez le numéro complet. »
   (`app/api/controller/scan/guests/route.ts:12`, `:54`, `:85-92` ; `components/scan/GuestListPanel.tsx:83-89`, `:187-195`).
   Billet qui n'est pas une invitation : « Billet invalide » ; transfert d'un porteur en cours : « Transfert en cours »
   (`M/20261110000009_lot9ter_zones.sql:1103-1106`, `:1198-1210`).
7. **Preuves et essai.** Recette : essai 78 (`docs/recette-billetterie.md:1680-1700`).

---

## 05.21 Guichet : vente en espèces à l'entrée

1. **Qui, où.** Contrôleur affecté **avec la permission espèces**, réglage SUPERADMIN « Vente au guichet en espèces »
   activé (valeur initiale : activé), caisse ouverte : scanner, onglet « Guichet » (`app/controller/scanner/page.tsx:987`,
   `:996`, `app/admin/finance-settings/page.tsx:80`, `docs/guide/11-admin-superadmin.md:509`).
2. **Ce qu'il saisit.** Les catégories actives vendues au guichet, avec prix et disponibilité, « Sur place uniquement »
   pour une catégorie non vendue en ligne, « N’entre pas par votre porte » (inactive) à une porte qui ne l'admet pas ;
   boutons « Retirer un billet {catégorie} » / « Ajouter un billet {catégorie} » (50 par catégorie au plus) ;
   « Numéro de l’acheteur (facultatif) » / « Pour être prévenu en cas de changement ou d’annulation. Le billet n’est
   rattaché à aucun compte. » ; total « À encaisser » calculé par le serveur ; bouton « J’ai reçu {montant} : valider la
   vente » (« Choisissez au moins un billet » sans sélection) (`components/scan/CounterSalePanel.tsx:45`, `:204-272`).
3. **Ce que fait le système.** Vente au **prix facial, sans frais**, en une opération avec une clé unique (une relance
   rend la même vente) : paiement « ESPECES » hors plateforme rattaché à la caisse, billets créés **déjà « Utilisé »**
   (vente = entrée immédiate, ligne « Guichet » au journal des scans, porte du vendeur), total attendu de la caisse
   augmenté ; journal `COUNTER_SALE` (`M/20261110000009_lot9ter_zones.sql:1426-1645`). Message « Vente enregistrée : {n}
   entrée(s), {montant} encaissés.[ Reçu SMS envoyé à l’acheteur. | Le reçu SMS n’a pas pu être envoyé.] »
   (`components/scan/CounterSalePanel.tsx:160-166`). Les espèces ne passent pas par le solde de la partenaire (voir
   `08-argent.md`).
4. **Messages envoyés.**

   | Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
   |---|---|---|---|---|
   | Numéro de l'acheteur, s'il est saisi | SMS | indispensable | file | `COUNTER_RECEIPT` : « Event Village : achat au guichet pour {titre}, {n} billet(s), {montant}. Entrée validée. Réf. {réf.}. » — ex. « Event Village : achat au guichet pour Concert Test, 2 billets, 10 000 F CFA. Entrée validée. Réf. 1F6E2B9C. » (107 caractères, 1 segment) |

   Preuves : `lib/notifications/catalog.ts:690-694` ; `M/20261110000009_lot9ter_zones.sql:1625-1633` ({réf.} = 8
   premiers signes de l'identifiant du paiement).
5. **Ce que voient les autres rôles.** Partenaire : « Au guichet » et « Entrées validées » (05.27), « Espèces
   encaissées » dans l'onglet Caisse (05.24).
6. **Refus (bandeau « Vente non enregistrée »).**

   | Cas | Message | Preuve |
   |---|---|---|
   | Guichet désactivé ou pas de permission | « Vente au guichet fermée » / « La vente au guichet est désactivée pour la plateforme. » ou « Votre affectation n’autorise pas l’encaissement d’espèces. » ; serveur : « La vente au guichet est désactivée. », « Permission espèces requise. » | `components/scan/CounterSalePanel.tsx:188-193` ; `M/20261110000009_lot9ter_zones.sql:1474-1482` |
   | Caisse fermée | « Caisse fermée » + « Ouvrir ma caisse » ; serveur « Ouvrez une caisse avant de vendre. » | `components/scan/CounterSalePanel.tsx:195-200` ; `M/20261110000009_lot9ter_zones.sql:1491` |
   | Pas affecté | « Vente réservée au contrôleur affecté à l’événement. » | `app/api/controller/counter-sale/route.ts:51` |
   | Contrôle fermé | « Cet événement n'est pas ouvert à la vente au guichet. » | `M/20261110000009_lot9ter_zones.sql:1510-1511` |
   | Catégorie non vendue au guichet | « Une catégorie de ce panier n'est pas vendue au guichet. » | `:1521-1522` |
   | Sans porte / porte de contrôle / catégorie non admise | « Aucune porte ne vous est attribuée : demandez à l’organisateur de vous en attribuer une. Rien n’a été vendu. » ; « La vente au guichet se fait à une porte d’entrée : demandez à l’organisateur de changer votre porte. » ; « {catégorie} n’entre pas par cette porte[ : vendez-la à {zone}[ ou {zone}]]. » ; « Ces catégories n’entrent pas par cette porte : {liste}. » | `:1526-1563` |
   | Stock, quantités | « Vente impossible : vérifiez les catégories et les quantités. » | `:1576-1578` |
   | Numéro de l'acheteur | « Numéro de l’acheteur invalide : mobile sénégalais attendu. » | `app/api/controller/counter-sale/route.ts:160-163` |
   | Réseau | « Réseau indisponible : la vente n’est pas confirmée. Réessayez, elle ne sera pas comptée deux fois. » | `components/scan/CounterSalePanel.tsx:173` |

7. **Preuves et essai.** Recette : essai 36 (`docs/recette-billetterie.md:924-940`).

---

## 05.22 Code PIN régisseur : générer, régénérer

1. **Qui, où.** Partenaire propriétaire, admin `events.write` ou SUPERADMIN : pilotage, onglet « Caisse », section « Code
   PIN régisseur » / « Le PIN est exigé à l’ouverture de chaque caisse et co-signe une clôture avec écart. Il n’est
   affiché qu’une fois, à sa génération. » (`components/partner/pilotage/CashTab.tsx:160-186`,
   `app/api/partner/events/[id]/regisseur-pin/route.ts:15-60`). État : « Un code est en place depuis le {date}. » ou
   « Aucun code PIN : vos contrôleurs ne peuvent ni ouvrir ni clôturer de caisse. » (ce dernier texte est trop large :
   une clôture **sans écart** n'exige pas de PIN, constat W5-05). Bouton « Générer le code PIN » ou « Régénérer le code
   PIN ».
2. **Ce qu'il saisit.** Une confirmation : « Générer un nouveau code PIN ? » / « L’ancien code cesse aussitôt d’être
   valable. Le nouveau code ne sera affiché qu’une seule fois. », bouton « Générer le code » ; si des caisses sont
   ouvertes, seconde confirmation « Des caisses sont ouvertes » / « Une caisse est ouverte : son contrôleur devra utiliser
   le nouveau code pour clôturer. » (ou « {n} caisses sont ouvertes : leurs contrôleurs devront utiliser le nouveau code
   pour clôturer. »), bouton « Générer quand même » (`components/partner/pilotage/CashTab.tsx:216-233`).
3. **Ce que fait le système.** Code de **6 chiffres** tiré au hasard, enregistré seulement sous forme hachée avec un sel
   propre à l'événement ; l'ancien cesse aussitôt de valoir ; journal `REGISSEUR_PIN_GENERATED` ou
   `REGISSEUR_PIN_REGENERATED` (`lib/shifts/shift.service.ts:244-285`). Fenêtre « Nouveau code PIN régisseur » / « Notez-le
   maintenant : il ne sera plus affiché. », le code en grand, « Copier le code » (« Code copié »), « J’ai noté le code » ;
   toast « Nouveau code PIN régisseur généré. » (`components/partner/pilotage/CashTab.tsx:93-127`, `:234-254`). Aucune condition de statut de
   l'événement (**NON VÉRIFIÉ** au-delà de `generateRegisseurPin`, qui n'en lit aucun).
4. **Messages envoyés.** Aucun : le code est remis de vive voix au régisseur.
5. **Ce que voient les autres rôles.** Contrôleurs : rien ; ils en ont besoin à l'ouverture (05.23) et pour une clôture
   avec écart (05.24).
6. **Refus.** « Non autorisé à générer le code PIN pour cet événement. » ; « Événement introuvable. » ; panne
   « Génération du code PIN momentanément impossible. » ; « Le code n’a pas été renvoyé par le serveur. Réessayez. » ;
   écran, sinon « Génération du code PIN impossible. » ; copie impossible : « Copie impossible : notez le code affiché. »
   (`lib/shifts/shift.service.ts:250-263`, `app/api/partner/events/[id]/regisseur-pin/route.ts:73`, `components/partner/pilotage/CashTab.tsx:99`,
   `:112`, `:126`).
7. **Preuves et essai.** Recette : essai 15 (`docs/recette-billetterie.md:571-588`).

---

## 05.23 Ouvrir sa caisse

1. **Qui, où.** Contrôleur affecté avec la permission espèces : scanner, onglet « Caisse » (« Caisse fermée » /
   « Encaissement en espèces bloqué » / « Ouvrez votre caisse avec le régisseur avant de vendre au guichet. », bouton
   « Ouvrir ma caisse »), ou onglet « Guichet » (`components/scan/ScannerShiftBanner.tsx:76-97`,
   `components/scan/CounterSalePanel.tsx:195-200`).
2. **Ce qu'il saisit.** Fenêtre « Ouvrir ma caisse » (sous-titre : titre de l'événement)
   (`components/shifts/ShiftModals.tsx:115-156`) :

   | Champ | Aide | Erreur à l'écran |
   |---|---|---|
   | « Fonds de caisse remis par le régisseur (F CFA) » (0 par défaut) | « Montant en espèces remis pour rendre la monnaie. 0 si aucun fonds n’est remis. » | « Saisissez un montant entier en francs, sans virgule (par exemple 2 750). » |
   | « Code PIN du régisseur » (masqué, 8 chiffres au plus, obligatoire) | « PIN obligatoire : le régisseur le saisit lui-même pour confirmer l’ouverture de la caisse. » | « Saisissez le code PIN du régisseur. » ; « Le code PIN du régisseur compte de 4 à 8 chiffres. » |

   Boutons « Annuler » et « Ouvrir la caisse » (`components/shifts/ShiftModals.tsx:81-83`, `:124-155`).
3. **Ce que fait le système.** Contrôle ouvert (05.14), droit d'encaisser, PIN vérifié (5 essais par quart d'heure),
   puis caisse « Ouverte » (une seule par contrôleur et par événement) avec le fonds de caisse ; journal `SHIFT_OPENED`
   (`lib/shifts/shift.service.ts:319-350`, `M/20261109000008_lot9bis_cycle.sql:746-787`, `lib/env.ts:90`). L'onglet
   affiche alors « Caisse ouverte », « Fonds de caisse », « Encaissé », « Total attendu en caisse » et « Clôturer ma
   caisse » (`components/scan/ScannerShiftBanner.tsx:40-72`).
4. **Messages envoyés.** Aucun.
5. **Ce que voient les autres rôles.** Partenaire, onglet « Caisse » : « Caisses ouvertes », la session « Ouverte » ;
   onglet Équipe : badge « Caisse ouverte » (`components/partner/pilotage/CashTab.tsx:147-152`, `components/partner/pilotage/TeamTab.tsx:246-251`).
6. **Refus (bandeau « Ouverture refusée »).**

   | Cas | Message | Preuve |
   |---|---|---|
   | Contrôle fermé | « Cet événement est annulé. » ; « Cet événement est terminé. » ; « Cet événement est suspendu. » ; « Cet événement n’est pas encore ouvert au contrôle. » ; sinon « Cet événement n’est pas ouvert : aucune caisse ne peut être ouverte. » | `lib/shifts/shift.service.ts:221-226`, `:185` |
   | Pas le droit | « Ouverture de caisse réservée au contrôleur affecté avec la permission espèces, au partenaire propriétaire ou à un admin. » | `lib/shifts/shift.service.ts:186` |
   | Fonds négatif | « Le fond de caisse doit être positif ou nul. » | `lib/shifts/shift.service.ts:187` |
   | Déjà ouverte | « Une session de caisse est déjà ouverte pour cet événement. Clôturez-la avant d’en ouvrir une nouvelle. » | `lib/shifts/shift.service.ts:188` |
   | PIN | « Saisissez le code PIN du régisseur. » ; « Code PIN régisseur incomplet (4 à 8 chiffres). » ; « Code PIN régisseur incorrect. » ; « Trop de tentatives de code PIN. Réessayez dans {n} s. » ; « Vérification du code PIN momentanément indisponible. » | `lib/shifts/shift.service.ts:190`, `:291-317` |
   | Aucun PIN généré | « Aucun code PIN régisseur pour cet événement : l’organisateur le génère dans l’onglet Caisse du pilotage. » | `lib/shifts/shift.service.ts:181`, `:306-308` |
   | Réseau | « Réseau indisponible : la caisse n’est pas ouverte. Réessayez. » | `components/shifts/ShiftModals.tsx:106` |

7. **Preuves et essai.** Recette : essai 36 (`docs/recette-billetterie.md:924-940`).

---

## 05.24 Clôturer sa caisse : sans écart, avec écart, Z de caisse

1. **Qui, où.** Le contrôleur de la caisse : scanner, onglet « Caisse », « Clôturer ma caisse » ; fenêtre « Clôturer ma
   caisse » / « Décompte des espèces avec le régisseur » (`components/shifts/ShiftModals.tsx:244-256`). L'onglet reste
   visible tant que la caisse est ouverte, même après le retrait de la permission espèces (05.9).
2. **Ce qu'il saisit.** Rappel « Fonds de caisse », « Espèces encaissées (enregistrées) », « Total attendu en caisse » ;
   champ « Espèces encaissées comptées, hors fonds de caisse (F CFA) » / « Comptez les espèces avec le régisseur, mettez
   de côté le fonds de caisse, puis saisissez le reste. » (erreur « Saisissez le montant compté, en francs entiers, sans
   virgule. ») ; bouton « Clôturer la caisse » (`:204`, `:258-292`). Si le montant diffère des encaissements enregistrés,
   le serveur renvoie l'écart et la fenêtre ajoute : bandeau « Écart constaté » / « Écart de {montant} avec les
   encaissements enregistrés. Justifiez l’écart ; le régisseur co-signe la clôture avec son code PIN. » ; « Justification
   de l’écart » (« 10 caractères au moins (par exemple : monnaie rendue en trop à un spectateur). », 1 000 au plus) ;
   « Code PIN du régisseur » (« Le régisseur saisit lui-même son code. ») ; bouton « Clôturer avec l’écart »
   (`:293-327`).
3. **Ce que fait le système.** Écart = compté − attendu (négatif : il manque des espèces). Sans écart : clôture directe,
   **sans PIN**. Avec écart : justification et PIN exigés, contrôlés à nouveau sous verrou ; clôture « co-signée »
   (`lib/shifts/shift.service.ts:386-454`, `M/20261109000008_lot9bis_cycle.sql:792-946`). Journal `SHIFT_CLOSED`.
   Fenêtre « Caisse clôturée » / « Z de caisse » : « Événement », « Contrôleur », « Ouverture », « Clôture », « Fonds de
   caisse », « Encaissements enregistrés », « Encaissements comptés », « Écart » (« Aucun écart » ou le montant),
   « Justification : … », puis « Clôture co-signée par le code PIN du régisseur. » ou « Clôture sans co-signature (aucun
   écart). » ; boutons « Imprimer le Z » et « Terminé » (`components/shifts/ShiftModals.tsx:341-386`). La dernière caisse
   fermée d'un événement Terminé déclenche l'avis du rapport de clôture (`CLOSING_REPORT_READY`, voir 04 et 10)
   (`M/20261109000009_lot9bis_messages.sql:43-45`).
4. **Messages envoyés.**

   | Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
   |---|---|---|---|---|
   | Partenaire propriétaire, seulement s'il y a un écart | cloche, push, email | indispensable (part aussi à un compte suspendu) | file | `SHIFT_DISCREPANCY` : « Écart de caisse » / « La caisse de {contrôleur} pour « {titre} » est fermée avec un écart de {écart signé}.[ Justification : {justification}] » — ex. « La caisse de Moussa Sow pour « Concert Test » est fermée avec un écart de -2 500 F CFA. Justification : Erreur de monnaie rendue. » |
   | Idem | SMS | indispensable | file | « Event Village : caisse de {contrôleur} fermée ({titre}) avec un écart de {écart signé}. {adresse}/partner/events » — ex. « Event Village : caisse de Moussa Sow fermée (Concert Test) avec un écart de -2 500 F CFA. https://app.eventvillage.sn/partner/events » (132 caractères, 1 segment) |

   Preuves : `lib/notifications/catalog.ts:966-979` ; `M/20261109000008_lot9bis_cycle.sql:897-917` ({contrôleur} =
   « Prénom Nom », sinon « votre contrôleur »).
5. **Ce que voient les autres rôles.** Partenaire, onglet « Caisse » : la session « Clôturée », « Déclaré », « Écart »
   et la justification ; « Écart cumulé » / « Déclaré moins attendu, caisses clôturées » ; le Z détaillé est dans
   l'onglet « Clôture » (`components/partner/pilotage/CashTab.tsx:35-55`, `:147-158`, `:205-213`).
6. **Refus (bandeau « Clôture refusée »).** « Un écart de caisse doit être justifié (10 caractères au moins). » ; « Le
   code PIN régisseur est obligatoire pour co-signer une clôture avec écart. » ; « La justification est limitée à 1 000
   caractères. » ; « Le montant déclaré doit être un nombre entier de francs, positif ou nul. » ; « Code PIN régisseur
   incorrect. » ; « Aucun code PIN régisseur pour cet événement : l’organisateur le génère dans l’onglet Caisse du
   pilotage. » ; « Cette session de caisse est déjà clôturée. » ; « Session de caisse introuvable. » ; panne « Clôture
   de caisse momentanément impossible. » ; réseau « Réseau indisponible : la caisse n’est pas clôturée. Réessayez. »
   (`lib/shifts/shift.service.ts:193-205`, `app/api/controller/shifts/close/route.ts:82`,
   `components/shifts/ShiftModals.tsx:235`).
7. **Preuves et essai.** Recette : essais 37 et 38 (`docs/recette-billetterie.md:942-973`).

---

## 05.25 Fermer la caisse d'un contrôleur : par la partenaire ou par un admin

1. **Qui, où.** Partenaire propriétaire, ou admin `events.write` (SUPERADMIN toujours) : pilotage, onglet « Caisse »,
   bouton « Fermer cette caisse » sur chaque session « Ouverte » (masqué pour un admin sans la permission)
   (`components/partner/pilotage/CashTab.tsx:56-71`, `:85-87`).
2. **Ce qu'il saisit.** Fenêtre « Fermer cette caisse » / « Caisse de {contrôleur} : décompte des espèces remises », mêmes
   champs et même règle d'écart qu'en 05.24 (`components/shifts/ShiftModals.tsx:246-247`).
3. **Ce que fait le système.** Même clôture qu'en 05.24, journalisée au rôle « PARTENAIRE » ou « ADMIN » ; toast
   « Caisse fermée. » et Z de caisse (`M/20261109000008_lot9bis_cycle.sql:824-840`, `components/partner/pilotage/CashTab.tsx:256-270`).
4. **Messages envoyés.**

   | Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
   |---|---|---|---|---|
   | Contrôleur de la caisse | cloche, push, email | indispensable (part aussi à un compte suspendu) | file | `SHIFT_CLOSED_BY_OTHER` : « Caisse fermée » / « Votre caisse pour « {titre} » a été fermée par {l'organisateur | l'administration}.[ Montant déclaré : {montant}.] » — ex. « Votre caisse pour « Concert Test » a été fermée par l'organisateur. Montant déclaré : 47 500 F CFA. » |
   | Partenaire, s'il y a un écart | cloche, SMS, push, email | indispensable | file | `SHIFT_DISCREPANCY` (05.24) |

   Preuves : `lib/notifications/catalog.ts:1167-1181` ; `M/20261109000008_lot9bis_cycle.sql:919-932`. Aucun SMS au
   contrôleur.
5. **Ce que voient les autres rôles.** Le contrôleur voit « Caisse fermée » dans son onglet Caisse à la relecture ;
   l'onglet disparaît s'il n'a plus la permission espèces (`app/controller/scanner/page.tsx:986`, `:1253-1265`).
6. **Refus.** Admin sans `events.write` : « Action non autorisée : votre compte n’a pas la permission « Gérer les
   événements ». » ; autres refus de 05.24 (`M/20261109000008_lot9bis_cycle.sql:832-835`,
   `lib/shifts/shift.service.ts:204`).
7. **Preuves et essai.** **NON VÉRIFIÉ** : aucun essai de `docs/recette-billetterie.md` ne fait fermer une caisse par la
   partenaire (recherche de « Fermer cette caisse »).

---

## 05.26 Caisse encore ouverte à la fin de l'événement

1. **Qui, où.** Automatique : passage de l'événement à « Terminé » (tâche de fin depuis Publié, ou clôture par
   l'administration depuis Suspendu ; voir 04 et 12) alors qu'au moins une caisse est ouverte.
2. **Ce qu'il saisit.** Rien.
3. **Ce que fait le système.** La caisse reste ouverte ; elle se ferme comme en 05.24 (contrôleur) ou 05.25
   (partenaire, admin) : la clôture ne dépend pas du statut de l'événement (`M/20261109000008_lot9bis_cycle.sql:792-946`).
   Tant qu'elle est ouverte, le contrôleur ne peut pas être retiré (05.10) et le rapport de clôture attend la dernière
   caisse (`M/20261109000009_lot9bis_messages.sql:43-45`). Depuis Publié, cet avis **remplace** l'avis de fin
   d'événement ; **jamais** à l'annulation (`:65-67`, `:334-372`).
4. **Messages envoyés.**

   | Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
   |---|---|---|---|---|
   | Partenaire propriétaire | cloche, push, email | indispensable (part aussi à un compte suspendu) | file, au passage à Terminé | `SHIFT_OPEN_AT_END` : « Caisse encore ouverte » / « « {titre} » est terminé et 1 caisse reste ouverte. Fermez-la dans l'onglet Caisse du pilotage. » (ou « … et {n} caisses restent ouvertes. Fermez-les dans l'onglet Caisse du pilotage. ») |
   | Idem | SMS | indispensable | file | « Event Village : {titre} est terminé et 1 caisse reste ouverte. Fermez-la dans le pilotage : {adresse}/partner/events » — ex. « Event Village : Concert Test est terminé et 1 caisse reste ouverte. Fermez-la dans le pilotage : https://app.eventvillage.sn/partner/events » (139 caractères, 1 segment) |

   Preuves : `lib/notifications/catalog.ts:1419-1438` ; `M/20261109000009_lot9bis_messages.sql:362-370`. Aucun avis au
   contrôleur.
5. **Ce que voient les autres rôles.** Contrôleur : son onglet « Caisse » reste ouvert pour clôturer (05.24).
6. **Refus.** Sans objet.
7. **Preuves et essai.** Recette : essai 71 (`docs/recette-billetterie.md:1543-1558`) pour le passage à Terminé
   (**NON VÉRIFIÉ** : l'essai ne prévoit pas de caisse ouverte).

---

## 05.27 Onglet Entrées du pilotage (tableau de bord des entrées)

1. **Qui, où.** Partenaire propriétaire, ou admin `events.read` : pilotage, onglet « Entrées »
   (`app/partner/events/[id]/page.tsx:57`, `components/partner/pilotage/EntriesTab.tsx:78-195`).
2. **Ce qu'il saisit.** Rien.
3. **Ce que fait le système.** Tous les chiffres viennent du serveur (`M/20261110000010_lot9ter_pilotage.sql:500-766`) ;
   l'onglet se relit à chaque scan, incident, caisse ou changement de statut de l'événement (temps réel) et toutes les
   60 s (`app/partner/events/[id]/page.tsx:92-98`, `components/partner/pilotage/EntriesTab.tsx:79-84`). Contenu :
   - cartes « Entrées validées » (« Scans acceptés, guichet compris »), « Au guichet » (« Billets vendus et validés sur
     place »), « Refus » (« Tentatives refusées au contrôle »), « Liste des invités » (« Entrées validées par la liste,
     pièce vérifiée »), « Débit » (« Moyenne des 5 dernières minutes »), « Contrôleurs actifs » (« {n} sur {m} », « Un
     scan dans les 10 dernières minutes ») ; « Mis à jour à {heure} » (`components/partner/pilotage/EntriesTab.tsx:117-130`) ;
   - alertes de refus (05.28) ;
   - « Tentatives multiples » / « Même billet présenté plusieurs fois en moins de dix minutes, ou billet déjà utilisé. »,
     bandeau « Billets présentés plusieurs fois » / « Vérifiez ces billets avec vos contrôleurs : il peut s’agir d’une
     capture d’écran partagée. » ; colonnes « Billet », « Catégorie », « Tentatives », « Dernier résultat », « Dernière
     tentative » (`:46-52`, `:138-151`) ;
   - « Par contrôleur » : « Contrôleur », « Point d’entrée » (ou « Porte » sur un événement à zones), « Entrées »,
     « Refus », « Incidents », « Dernière activité » ; vide : « Aucun scan pour le moment » / « Les entrées s’affichent
     ici dès le premier scan, sans recharger la page. » (`:26-44`, `:153-164`) ;
   - « Débit par minute » (30 dernières minutes) ; « Incidents techniques » / « Coupures réseau, délais dépassés ou
     erreurs du serveur rencontrés par les scanners (sans effet sur les billets). » (« Coupure réseau », « Délai de
     réponse dépassé », « Trop de scans rapprochés », « Erreur du serveur », « Contrôle anti-abus indisponible »)
     (`:166-192`, `components/partner/pilotage/types.ts:308-318`) ;
   - « Par zone » (« Entrés sur attendus. Les attendus sont les billets des catégories admises dans la zone : une
     catégorie admise dans deux zones compte dans les deux. »), « Par porte » ou « Par point d’entrée », « Par
     catégorie », « Par origine », « Flux par quart d’heure », « Refus par motif », « Validations par la liste des
     invités » (`components/partner/pilotage/EntriesBreakdown.tsx:170-250`). Motifs de refus : libellés de 05.16, plus
     « Scanneur non autorisé sur cet événement » (`lib/scan/scan-result.ts:138-141`,
     `M/20261110000010_lot9ter_pilotage.sql:79-112`).
4. **Messages envoyés.** Aucun (sauf l'alerte de 05.28).
5. **Ce que voient les autres rôles.** Les mêmes vues figées entrent dans le rapport de clôture (voir 04)
   (`M/20261110000010_lot9ter_pilotage.sql:27-30`).
6. **Refus.** Lecture impossible : « Entrées indisponibles » et « Réessayer » (`components/partner/pilotage/EntriesTab.tsx:98-100`) ; admin sans
   `events.read` : refus du pilotage (voir 11).
7. **Preuves et essai.** Recette : essais 39 et 82 (`docs/recette-billetterie.md:977-991`, `:1770-1786`).

---

## 05.28 Alerte de refus en série à une porte

1. **Qui, où.** Automatique, à chaque refus enregistré au contrôle.
2. **Ce qu'il saisit.** Rien. Réglages SUPERADMIN « Alerte de refus à une porte : nombre de refus » (valeur initiale
   **10**, de 3 à 500) et « … : durée observée » (**5 min**, de 1 à 60) (`app/admin/finance-settings/page.tsx:82-83`,
   `docs/guide/11-admin-superadmin.md:511-512`).
3. **Ce que fait le système.** Comptent les billets invalides, déjà utilisés, annulés, remboursés, d'un autre événement,
   à paiement requis, au QR expiré ou non dynamique, en attente de transfert, en mauvaise zone ou pas encore entrés ; ne
   comptent pas les droits du scanneur, la saisie manuelle refusée, l'encaissement ni l'état ou l'horaire de l'événement
   (`M/20261110000010_lot9ter_pilotage.sql:60-74`). Quand une porte (ou un point d'entrée, ou « Point d’entrée non
   précisé ») atteint le seuil dans la durée observée, **une** alerte part à la partenaire propriétaire, **au plus une
   fois par porte et par durée** (`:880-956`). L'aide du réglage n'énumère pas « paiement requis » ni les QR refusés
   (constat W5-14). Le verdict du scan n'en dépend jamais.
4. **Messages envoyés.**

   | Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
   |---|---|---|---|---|
   | Partenaire propriétaire | cloche, push, email | indispensable | file | `SCAN_REFUSALS_ALERT` : « Refus en série à une porte » / « {porte} : {n} refus en {m} minute(s) pour « {titre} ». Vérifiez la porte avec vos contrôleurs. » — ex. « Porte principale : 10 refus en 5 minutes pour « Concert Test ». Vérifiez la porte avec vos contrôleurs. » ; lien : onglet Entrées du pilotage |
   | — | SMS | — | — | aucun SMS |

   Preuves : `lib/notifications/catalog.ts:1678-1688` ; `M/20261110000010_lot9ter_pilotage.sql:28-30`, `:938-947`.
5. **Ce que voient les autres rôles.** Onglet Entrées : bandeau rouge « Beaucoup de refus à {porte} » / « {n} refus dans
   les {m} dernières minutes. Vérifiez avec le contrôleur : faux billets, mauvaise porte ou billets déjà utilisés. » (ou
   « … dans la dernière minute. … »), tant que le seuil est atteint (`components/partner/pilotage/EntriesTab.tsx:62-65`,
   `:132-136`, `M/20261110000010_lot9ter_pilotage.sql:705-727`). Aucun avis au contrôleur ni à l'administration.
6. **Refus.** Sans objet. Compte de la partenaire suspendu : avis non envoyé (règle du registre).
7. **Preuves et essai.** Recette : essai 82 (`docs/recette-billetterie.md:1770-1786`).

---

## 05.29 Scan par la partenaire (`/partner/scan`) et par l'administration

1. **Qui, où.** Partenaire : menu « Scanner les billets », `/partner/scan` « Contrôle des entrées » (voir 01) ;
   administration : scanner de l'admin (voir `11-admin-superadmin.md`, 11.18 : il ne liste que les événements de la
   fiche partenaire du compte, donc un admin sans fiche ni affectation de contrôleur ne peut rien y scanner, constat W1-07).
2. **Ce qu'il saisit.** L'un de ses événements dont le contrôle est ouvert ; sur un événement à zones, une « Porte de
   contrôle » dans la liste ; caméra ou saisie manuelle (`app/partner/scan/page.tsx:1-40`).
3. **Ce que fait le système.** Même voie que le contrôleur (`/api/controller/scan`), mêmes règles et résultats ; carte de
   résultat (pas le plein écran) avec la consigne d'entrée et « Saisie manuelle, pièce d’identité vérifiée »
   (`components/scan/ScanResultPanel.tsx:1-134`). La saisie manuelle et la liste des invités n'acceptent la partenaire
   et l'admin que si le réglage « Saisie manuelle d’un numéro de billet » vaut « Contrôleur affecté, partenaire et
   admin » ; sinon « Saisie manuelle refusée » (`M/20261110000009_lot9ter_zones.sql:1064-1080`,
   `M/20261110000008_lot9ter_invites.sql:97-103`). Pas de caisse ni de guichet pour la partenaire : la vente au guichet
   exige une affectation avec la permission espèces (`M/20261110000009_lot9ter_zones.sql:1477-1482`).
4. **Messages envoyés.** Aucun.
5. **Ce que voient les autres rôles.** Les scans comptent dans l'onglet Entrées, au nom de la partenaire.
6. **Refus.** Ceux de 05.16 à 05.18.
7. **Preuves et essai.** Recette : essai 39 (`docs/recette-billetterie.md:977-991`).

---

## 05.30 Tableau récapitulatif des messages de ce fichier

| Type | Déclencheur | Destinataire | Canaux | Famille | Scénario |
|---|---|---|---|---|---|
| `CONTROLLER_INVITE` | invitation d'un nouveau numéro, renvoi | numéro invité | SMS direct, immédiat | indispensable | 05.2, 05.4 |
| `CONTROLLER_INVITATION` | invitation d'un compte existant (consentement) | titulaire | SMS, cloche, push, email | indispensable | 05.5, 05.6 |
| `CONTROLLER_ASSIGNED` | affectation nouvelle (directe, « Gérer », acceptation) | contrôleur | cloche, push, email par affectation ; 1 SMS regroupé (sauté après une invitation de moins d'une heure) | indispensable | 05.2, 05.6, 05.7, 05.8 |
| `CONTROLLER_ACTIVATED` | activation du compte | contrôleur | cloche, SMS, email | indispensable | 05.3 |
| `CONTROLLER_UNASSIGNED` | retrait d'affectation | contrôleur | cloche, push, email par affectation ; 1 SMS regroupé | indispensable | 05.8, 05.10 |
| `CONTROLLER_REMINDER` | veille de l'événement | contrôleur | cloche, push, SMS, email | optionnel (« Rappels ») | voir 10 et 12 |
| `CONTROLLER_EVENT_CANCELLED`, `CONTROLLER_EVENT_CHANGED`, `CONTROLLER_EVENT_STATUS` | annulation, changement de date ou de lieu, suspension ou reprise | contrôleurs affectés | voir 04 et 10 | indispensable | voir 04 |
| `COUNTER_RECEIPT` | vente au guichet avec numéro | numéro de l'acheteur | SMS | indispensable | 05.21 |
| `SHIFT_DISCREPANCY` | clôture avec écart | partenaire | cloche, SMS, push, email | indispensable | 05.24, 05.25 |
| `SHIFT_CLOSED_BY_OTHER` | caisse fermée par la partenaire ou un admin | contrôleur | cloche, push, email | indispensable | 05.25 |
| `SHIFT_OPEN_AT_END` | passage à Terminé avec caisse ouverte | partenaire | cloche, push, SMS, email | indispensable | 05.26 |
| `SCAN_REFUSALS_ALERT` | refus en série à une porte | partenaire | cloche, push, email | indispensable | 05.28 |

Preuves : `lib/notifications/catalog.ts:690-694`, `:966-979`, `:1113-1188`, `:1419-1438`, `:1465-1487`, `:1522-1556`,
`:1678-1694`. Aucun avis : réglage du point d'entrée, de la porte, de la permission espèces, des zones, de la couleur et
de la consigne ; génération du PIN ; acceptation ou refus d'une invitation (côté partenaire) ; expiration d'une
invitation.
