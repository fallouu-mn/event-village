# 08 — L'argent : remboursements, versements à reprendre, frais, retraits, fonds gelés, rapprochement, réglages

> Guide complet de l'application Event Village, état de `main` à `0889df6` (lots 1 à 9 ter). Source de vérité : le code.
> Chaque fait porte sa preuve `fichier:ligne` (chemins relatifs au dépôt ; `M/` = `supabase/migrations/`).
> Ce qui n'a pas pu être établi est marqué **NON VÉRIFIÉ**. Données d'exemple fictives : cliente « Fatou Diop »
> (numéro `77 000 00 00`, affiché masqué `77*****00`), événement « Concert Test » (samedi 5 décembre 2026 à 20:00),
> catégories « Standard » 5 000 F, « VIP » 12 500 F, « Enfant » gratuite ; panier de Fatou payé avec Wave :
> 2 Standard, 1 VIP, 1 Enfant = **23 625 F** (prix 22 500 F + frais de service 1 125 F), frais SamirPay estimés 354,38 F
> (calcul en `06-achat-paiement.md`, 06.21).
> L'achat et le paiement sont dans `06-achat-paiement.md` ; l'annulation d'un événement (fenêtre, champs, avis) et le
> report de plus de 24 h dans `04-evenement-cycle.md` (04.19, 04.14) ; l'écran « Finances » de la partenaire et la
> demande de retrait pas à pas dans `03-partenaire.md` (03.18 à 03.22) ; le Portefeuille et le retrait des commissions
> dans `09-parrainage.md` ; le détail des canaux, heures calmes et plafonds de chaque message dans `10-notifications.md` ;
> la tâche planifiée qui reprend les versements dans `12-taches-planifiees.md` (12.3). Écarts relevés : `15-constats.md`
> (W7-xx).

## Sommaire

| N° | Scénario |
|---|---|
| 08.0 | Vocabulaire et règles communes : versement, ses états, ses motifs de blocage, qui paie quoi |
| 08.1 | La partenaire rembourse un billet payé en ligne (pilotage, onglet « Ventes ») |
| 08.2 | La partenaire annule un billet payé en espèces au guichet : à rembourser par elle-même |
| 08.3 | La partenaire annule un billet gratuit ou une invitation |
| 08.4 | Après la fin de l'événement : seul Event Village (permission « Gérer les remboursements ») rembourse |
| 08.5 | Billet transféré, ou en cours de transfert, puis remboursé |
| 08.6 | Remboursement demandé par le client après un report de plus de 24 h (suite de 04.14) |
| 08.7 | Remboursements d'une annulation d'événement : création, envoi, avancement « Remboursements » |
| 08.8 | Espèces du guichet à rembourser par l'organisateur après une annulation (case « Remboursé ») |
| 08.9 | Effets comptables d'un remboursement : partenaire débitée, créance, revenu Event Village, exemple chiffré |
| 08.10 | La vie d'un versement : envoi, confirmé, refusé, bloqué, incertain, retardé, reprise automatique |
| 08.11 | « Versements à reprendre » : la liste de l'administration |
| 08.12 | « Renvoyer » un versement |
| 08.13 | « Marquer versé » |
| 08.14 | « Constater non versé » (SUPERADMIN, mot de passe) |
| 08.15 | Frais de versement : qui les paie |
| 08.16 | Retraits de la partenaire : demande, minimum, frais, devis, refus, incertain (résumé, exemple chiffré) |
| 08.17 | Fonds gelés (événement suspendu) |
| 08.18 | Soldes de la partenaire : formule de chaque bloc de « Finances » |
| 08.19 | Rapport de clôture : formule de chaque montant |
| 08.20 | `/admin/finance` « Rapprochement financier » : chaque chiffre et sa formule |
| 08.21 | Réglages SUPERADMIN qui touchent l'argent |
| 08.22 | Récapitulatif des messages liés à l'argent |

---

## 08.0 Vocabulaire et règles communes

**Versement** (table `cashouts`) : tout argent qui **sort** d'Event Village vers un compte Wave ou Orange Money, par
SamirPay. Quatre natures, avec leur libellé à l'écran de l'administration (`app/api/admin/refunds/route.ts:41-46`,
`lib/payments/cashout.service.ts:45`) :

| Nature (code) | Libellé « Versement » | Créé par | Montant |
|---|---|---|---|
| `TICKET_REFUND` | « Remboursement d’un billet » | remboursement d'un billet (08.1, 08.4 à 08.6) | prix + frais de service du billet, au plus le reste du paiement |
| `EVENT_CANCELLATION_REFUND` | « Remboursement d’une annulation » | annulation d'un événement (08.7) | reste du paiement entier |
| `REFUND` | « Remboursement d’un paiement » | paiement encaissé sans billet possible, ou payé deux fois (06.16, 06.17) | reste du paiement entier |
| `WITHDRAWAL` | « Retrait » | retrait de la partenaire (08.16) ou du parrain (09) | montant **net** (après frais de retrait) |

Une clé unique par opération empêche tout doublon : `REFUND-TKT-{billet}`, `REFUND-{paiement}`, `WITHDRAWAL-{retrait}`
(`M/20261110000006_lot9ter_equipe_messages.sql:215`, `M/20261101000005_lot3_remboursements.sql:203`,
`M/20261109000006_lot9bis_argent.sql:755`).

**États d'un versement** (`lib/payments/cashout.service.ts:6-14`, `:44`) : « à envoyer » (`A_ENVOYER`), « envoyé »
(`ENVOYE`, SamirPay a donné un identifiant), « confirmé » (`CONFIRME`), « échoué » (`ECHOUE`, refus explicite),
« incertain » (`INCERTAIN` : délai dépassé, erreur serveur, réponse illisible ; **jamais renvoyé automatiquement**).
Un versement « à envoyer » peut porter un **motif de blocage** ; libellés de la liste de l'administration
(`lib/payments/cashout.service.ts:79-88`) :

| Motif (code) | Libellé dans « Versements à reprendre » | Repart seul ? |
|---|---|---|
| `OPERATOR_UNKNOWN` | « opérateur du payeur inconnu » | non : seul « Marquer versé » |
| `PHONE_UNKNOWN` | « numéro du payeur inconnu » | non : seul « Marquer versé » |
| `NAME_UNKNOWN` | « prénom ou nom du bénéficiaire manquant » | non : compléter le profil, puis « Renvoyer » |
| `SOLDE_INSUFFISANT` | « solde du compte partenaire SamirPay insuffisant » | **oui**, dès que le solde SamirPay le couvre (tâche des 5 min) |
| `LIMITE_COMPTE` | « montant hors des limites du compte SamirPay » | non : « Renvoyer » |
| `SIMULATED` | « opération créée en mode simulé : aucun versement » | jamais (hors liste) |
| `ACCOUNT_SUSPENDED` | « compte du bénéficiaire suspendu » | à la réactivation (retrait seulement ; le versement n'est pas marqué bloqué, il est seulement sauté) |

(`lib/payments/cashout.service.ts:276-285`, `:345-350`, `:450-462` ; `app/api/admin/refunds/route.ts:57-58`, `:148-160`.)

**Qui paie quoi** (détail en 08.9 et 08.15) :

| Coût | Payé par |
|---|---|
| Frais de service d'un billet (5 % à l'installation) | l'acheteuse, en plus du prix ; rendus avec le billet en cas de remboursement en ligne |
| Frais SamirPay **de l'encaissement** perdus lors d'un remboursement | réglage « Frais agrégateur d’une annulation » : **Event Village** à l'installation, ou l'organisateur ; toujours Event Village pour un paiement sans billet ou en double |
| Frais SamirPay **du versement** de remboursement | Event Village, sauf les remboursements d'une annulation **décidée par la partenaire** : imputés à la partenaire |
| Frais de retrait (1 % à l'installation) | la partenaire (ou le parrain), déduits du montant versé |
| Frais SamirPay du versement d'un retrait | Event Village |
| Billets payés en espèces | jamais remboursés par Event Village : l'organisateur rend l'argent |

**Statuts d'un billet** liés à l'argent (`lib/tickets/ticket-status.ts:23-50`) : « Valable », « Utilisé », « Annulé »,
« Remboursé » (« Ce billet a été remboursé : il ne donne plus accès à l’événement. »), « Remboursement en cours » (« Le
remboursement de ce billet est en cours : vous serez prévenu dès le versement. »).

---

## 08.1 La partenaire rembourse un billet payé en ligne (pilotage, onglet « Ventes »)

1. **Qui, où.** La partenaire propriétaire de l'événement (compte actif), jusqu'à la **fin** de l'événement ; ou un
   ADMIN muni de « Gérer les remboursements » (`refunds.manage`), ou le SUPERADMIN, à tout moment. Pilotage
   `/partner/events/{id}`, onglet « Ventes », section « Remboursement d’un billet » : « Retrouvez le billet par le numéro
   imprimé dessus. Rien n’est remboursé avant votre confirmation. » (`app/partner/events/[id]/page.tsx:55`, `:259`,
   `components/partner/pilotage/SalesTab.tsx:130-138`, `components/partner/pilotage/TicketRefundPanel.tsx:247-251`).
   L'administration y arrive par la fiche de l'événement, bouton « Ouvrir le pilotage » (permission « Consulter les
   événements ») (`app/admin/events/[id]/page.tsx:552-558`).
2. **Ce qu'il saisit.**

   | Étape | Champ ou bouton (texte exact) | Règles et erreurs exactes | Preuve |
   |---|---|---|---|
   | Recherche | « Numéro du billet » (exemple `TCK-20261101-XXXXXXXXXX`), bouton « Rechercher le billet » | vide : « Saisissez le numéro du billet. » ; moins de 4 ou plus de 60 signes : « Saisissez le numéro complet du billet. » ; billet d'un autre événement ou inconnu : « Billet introuvable pour cet événement. » ; panne : « Recherche du billet momentanément indisponible. » (l'écran : « Recherche du billet impossible pour le moment. » s'il n'a pas de texte) | `TicketRefundPanel.tsx:185-195`, `:254-268`, `app/api/partner/events/[id]/tickets/lookup/route.ts:29-37`, `:100-103`, `:170` |
   | Fiche | « Billet {numéro} », « Catégorie », « Porteur » (prénom et initiale, ou « Vente au guichet »), « Vente » (« En ligne », « Au guichet », « Gratuit », « Invitation »), « État », « Prix », « Frais de service » | rien à saisir | `TicketRefundPanel.tsx:90-95`, `:274-284`, `lookup/route.ts:31-45` |
   | Décision | texte « Event Village verse {prix + frais} au client sur le compte qui a payé. Le billet ne donnera plus accès à l’événement. », bouton « Rembourser ce billet » | — | `TicketRefundPanel.tsx:66-73`, `:285-299` |
   | Motif | fenêtre « Motif du remboursement », sous-titre « Billet {numéro} », champ « Motif » (aide « Au moins 3 caractères. Le motif est conservé avec cette opération. », 500 caractères au plus, compteur), boutons « Continuer » et « Revenir à la fiche » | moins de 3 caractères : « Le motif doit contenir au moins 3 caractères. » ; serveur : « Le motif de remboursement est obligatoire (3 caractères au moins). » | `TicketRefundPanel.tsx:316-329`, `components/ui/ReasonDialog.tsx:9`, `:42-65`, `app/api/partner/events/[id]/tickets/[ticketId]/refund/route.ts:10`, `:53-56` |
   | Confirmation | fenêtre « Confirmer le remboursement ? », même texte, « Billet », « Montant » ({prix + frais}), « Motif », boutons « Rembourser le client » et « Revenir à la fiche » | — | `TicketRefundPanel.tsx:330-347` |

   Exemple : un billet « Standard » de Fatou → « Event Village verse 5 250 F CFA au client sur le compte qui a payé. Le
   billet ne donnera plus accès à l’événement. ».
3. **Ce que fait le système** (une seule opération en base, `ticket_refund_request`,
   `M/20261110000006_lot9ter_equipe_messages.sql:207-477`, dernière définition) :
   - contrôles, dans l'ordre : billet existant ; acteur = propriétaire, administrateur habilité ou porteur (08.6) ;
     compte actif ; partenaire avant la fin de l'événement (fin = fin saisie, sinon début + 6 h) ; billet « Valable » ;
     paiement « Confirmé » ou « Remboursé en partie » (`:281-312`, `:328-339`) ;
   - montant = prix + frais de service du billet, **jamais plus que le reste non remboursé du paiement** (`:333-341`) ;
   - journal `TICKET_REFUND_REQUESTED` (qui, contexte, motif, mode, montant) écrit dans la même opération : sans
     journal, rien n'est fait (`:355-360`) ;
   - un transfert en attente du billet est annulé (08.5) ;
   - un remboursement (`refunds`, statut en attente) et un versement `TICKET_REFUND` vers le **compte Mobile Money qui a
     payé** (opérateur et numéro du paiement, prénom et nom du compte payeur) sont créés ; billet « Remboursement en
     cours » ; une place est rendue à la catégorie (`:449-473`) ;
   - effets comptables immédiats (08.9) : la partenaire est débitée du prix (`:474`) ;
   - puis, si rien ne bloque, le versement part **aussitôt** vers SamirPay (`refund/route.ts:82-85`) ; à la confirmation,
     billet « Remboursé », paiement « Remboursé en partie » ou « Remboursé » (`M/20261109000007_lot9bis_versements.sql:1013-1028`).
   - Résultat affiché (`TicketRefundPanel.tsx:119-137`) :

     | Situation | Titre | Texte exact |
     |---|---|---|
     | Versement confirmé | « Remboursement versé » | « {montant} ont été versés au client. » |
     | Versement parti, en attente de confirmation | « Remboursement envoyé » | « {montant} sont en cours de versement. Le client sera prévenu dès la confirmation. » |
     | Bloqué, incertain, refusé, ou envoi différé | « Remboursement enregistré, versement en attente » | « Les {montant} ne sont pas encore partis. L’équipe Event Village reprend ce versement. » |
     | Déjà demandé (même billet) | « Remboursement déjà enregistré » | « Aucune nouvelle opération : ce remboursement de {montant} avait déjà été demandé. » |

     Exemple : « Remboursement versé » / « 5 250 F CFA ont été versés au client. ». L'onglet relit ensuite ses chiffres.
4. **Messages envoyés.**

   | Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
   |---|---|---|---|---|
   | Le payeur (compte) | cloche, email si vérifié | indispensable (`REFUND_REQUESTED`) | file, à la création du versement | « Remboursement demandé » / « Le remboursement de votre billet pour « {titre} » ({montant}) est en cours. » — ex. « Le remboursement de votre billet pour « Concert Test » (5 250 F CFA) est en cours. » |
   | Le payeur (compte, sinon le numéro du versement) | SMS, cloche, email, push | indispensable (`REFUND_PAID`) | file, à la confirmation | SMS « Event Village : remboursement de {montant} versé sur votre compte {opérateur} ({titre, 30}). » — ex. « Event Village : remboursement de 5 250 F CFA versé sur votre compte Wave (Concert Test). » (88 caractères, 1 segment) ; cloche « Remboursement versé » / « {montant} vous ont été remboursés sur votre compte {opérateur} pour « {titre} ». » |
   | Le payeur | SMS, cloche, email, push | indispensable (`REFUND_DELAYED`), **un seul par versement** | file, si le versement est bloqué, refusé, incertain ou en attente depuis plus de 30 min | 08.10 |
   | Le porteur actuel s'il a reçu le billet par transfert | voir 08.5 | | | |
   | Administrateurs « Gérer les remboursements » et SUPERADMIN | cloche, push, email | indispensable | si bloqué, refusé ou incertain | 08.10 |

   Preuves : `M/20261109000007_lot9bis_versements.sql:383-392`, `:465-477`, `:563-573` ; `lib/notifications/catalog.ts:852-872`.
   La partenaire ne reçoit aucun message pour un remboursement de billet (aucun envoi à son compte dans
   `notif_cashouts_notify` hors annulation, `M/20261109000007_lot9bis_versements.sql:320-587`).
5. **Ce que voient les autres rôles.** Le client : « Remboursement en cours » puis « Remboursé » dans Mes billets
   (onglet de l'historique), et « Remboursement retardé, l’équipe Event Village s’en occupe. » sur la carte si le
   versement est retardé (`components/tickets/TicketCard.tsx:553-555`, `app/api/tickets/route.ts:236`). La partenaire :
   ligne « Remboursement d’un billet » dans l'historique de « Finances » (03.18). L'administration : la ligne du paiement
   dans « Paiements rapprochés » (« Remboursé », 08.20) ; « Versements à reprendre » si le versement n'aboutit pas (08.11).
6. **Ce qui est refusé (textes exacts).** Écran : billet non remboursable : « Ce billet n’est pas remboursable » /
   « Seul un billet encore valable, dont le paiement est confirmé, peut être remboursé. » (`TicketRefundPanel.tsx:305-308`).
   Après envoi, bandeau « Remboursement refusé » (`:218-227`) avec :

   | Cas | Texte | Preuve |
   |---|---|---|
   | État du billet changé depuis la recherche | « Ce billet n’est plus remboursable : son état a changé depuis la recherche. » | `TicketRefundPanel.tsx:99` |
   | Paiement non confirmé | « Le paiement de ce billet ne peut pas être remboursé. » | `:100`, `M/…lot9ter_equipe_messages.sql:330-332` |
   | Paiement déjà entièrement remboursé | « Ce paiement est déjà entièrement remboursé. » | `:101`, `:338` |
   | Partenaire après la fin | « L’événement est terminé : seul Event Village peut encore rembourser ce billet. Contactez le support. » | `:103`, `:290-294` |
   | Tiers | « Remboursement réservé à l’organisateur ou à un administrateur habilité. » | `:104`, `:306-309` |
   | Compte non actif | « Votre compte n’est pas actif. » (ou, avant, « Votre compte n'est pas actif. Contactez le support. ») | `:286`, `lib/auth/session.ts:56-62` |
   | Ni partenaire ni administrateur | « Seul l’organisateur de l’événement ou un administrateur peut rembourser un billet. » | `refund/route.ts:39-41` |
   | Événement d'une autre partenaire | « Cet événement ne vous appartient pas. » | `refund/route.ts:72-74` |
   | Admin sans la permission | « Action non autorisée : votre compte n’a pas la permission « Gérer les remboursements ». » | `refund/route.ts:44-45`, `lib/admin/permission-labels.ts:17`, `:33-35` |
   | Panne | « Remboursement momentanément indisponible. » | `refund/route.ts:64-67`, `:96-99` |
   | Réseau coupé | fenêtre gardée, « Remboursement non confirmé » / « Réseau indisponible : le remboursement n’est pas confirmé. Réessayez, il ne sera pas compté deux fois. » | `TicketRefundPanel.tsx:236-239`, `:346` |

   Un billet « Utilisé » n'est jamais remboursé par ce panneau (seule l'annulation de l'événement rembourse un billet
   déjà utilisé, 08.7).
7. **Preuves et essai.** Fichiers cités. Recette : essai 59 (`docs/recette-billetterie.md:1331-1347`), essai 58 pour un
   versement bloqué.

## 08.2 La partenaire annule un billet payé en espèces au guichet : à rembourser par elle-même

1. **Qui, où.** Mêmes personnes et même panneau que 08.1 ; le billet a été vendu au guichet (« Vente » : « Au
   guichet », « Porteur » : « Vente au guichet »).
2. **Ce qu'il saisit.** Comme 08.1. Texte de la fiche et de la confirmation : « Billet payé hors plateforme : Event
   Village ne verse rien, vous remettez vous-même {prix} au client. Le billet sera annulé. » ; bouton « Rembourser ce
   billet », fenêtre « Confirmer le remboursement ? », bouton « Annuler le billet et rembourser »
   (`TicketRefundPanel.tsx:74-80`). Montant annoncé : le **prix seul** (aucun frais au guichet) (`:113-116`).
3. **Ce que fait le système.** Billet « Annulé », place rendue, une ligne de remboursement « à régler par
   l'organisateur » (montant = prix) est enregistrée, **aucun versement**, aucune écriture au solde de la partenaire (la
   vente en espèces n'y était pas) (`M/20261110000006_lot9ter_equipe_messages.sql:324-327`, `:440-446`). Résultat :
   « Billet annulé, à vous de rembourser » / « Remettez {prix} au client : Event Village ne verse rien pour ce billet. »
   — ex. « Remettez 5 000 F CFA au client : Event Village ne verse rien pour ce billet. » (`TicketRefundPanel.tsx:127-129`).
   Aucun écran ne suit ensuite si l'argent a été rendu (la case « Remboursé » n'existe qu'après une annulation
   d'événement, 08.8 ; constat W7-06).
4. **Messages envoyés.**

   | Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
   |---|---|---|---|---|
   | Porteur avec compte | cloche, SMS, email | indispensable (`TICKET_CANCELLED`, forme « espèces ») | file | SMS « Event Village : votre billet pour {titre, 30} du {date} est annulé. Remboursement par l'organisateur. » — ex. « Event Village : votre billet pour Concert Test du sam. 5 déc. à 20:00 est annulé. Remboursement par l'organisateur. » (115 caractères, 1 segment) ; cloche « Billet annulé » / « Votre billet pour « {titre} » du {date} est annulé. Le remboursement se fait auprès de l'organisateur. » |

   Un billet vendu au guichet sans compte (cas courant) n'a pas de porteur : **aucun message** ne part
   (`M/…lot9ter_equipe_messages.sql:405-420`, condition « porteur ou numéro d'invitation »). Preuves texte :
   `lib/notifications/catalog.ts:1555-1575`.
5. **Ce que voient les autres rôles.** Rapport de clôture : « Remboursé » augmente du prix (08.19). Annulation ultérieure
   de l'événement : voir 08.8 et constat W7-06.
6. **Refus.** Comme 08.1.
7. **Preuves et essai.** Fichiers cités. Recette : aucun essai dédié.

## 08.3 La partenaire annule un billet gratuit ou une invitation

1. **Qui, où.** Comme 08.1 ; billet à 0 F (« Gratuit » ou « Invitation »).
2. **Ce qu'il saisit.** Texte : « Billet gratuit : rien n’est versé. Le billet sera annulé et ne donnera plus accès à
   l’événement. » ; bouton « Annuler ce billet gratuit » ; fenêtre « Motif de l’annulation », puis « Annuler ce billet
   gratuit ? » avec « Montant » « Aucun versement », bouton « Annuler le billet » (`TicketRefundPanel.tsx:81-87`, `:343`).
3. **Ce que fait le système.** Billet « Annulé », place rendue, rien d'autre (`M/…lot9ter_equipe_messages.sql:320-323`,
   `:434-438`). Résultat : « Billet annulé » / « Rien n’a été versé : ce billet gratuit ne donne plus accès à
   l’événement. » (`TicketRefundPanel.tsx:124-126`).
4. **Messages envoyés.** `TICKET_CANCELLED` au porteur (cloche, SMS, email) ou, pour une invitation pas encore réclamée,
   SMS au numéro invité : « Event Village : votre billet gratuit pour Concert Test du sam. 5 déc. à 20:00 est annulé par
   l'organisateur. » (108 caractères, 1 segment) ; « Event Village : votre invitation pour Concert Test du sam. 5 déc. à
   20:00 est annulée par l'organisateur. » (105 caractères, 1 segment) (`lib/notifications/catalog.ts:1567-1572`,
   `M/…lot9ter_equipe_messages.sql:405-420`). Annulation d'une invitation depuis l'onglet « Invitations » : `07-billets.md`.
5. **Ce que voient les autres rôles.** Le billet disparaît des billets valables du porteur.
6. **Refus.** Comme 08.1.
7. **Preuves et essai.** Fichiers cités.

## 08.4 Après la fin de l'événement : seul Event Village rembourse

1. **Qui, où.** Partenaire : même panneau ; administration (« Gérer les remboursements » ou SUPERADMIN) : fiche admin,
   « Ouvrir le pilotage », onglet « Ventes ».
2. **Ce qu'il saisit.** Partenaire : la fiche du billet affiche, à la place du bouton, « Remboursement réservé à Event
   Village » / « L’événement est terminé : seul Event Village peut encore rembourser ce billet. Le client peut contacter
   le support Event Village. » (`TicketRefundPanel.tsx:107-110`, `:301-304`). Administrateur : le bouton reste proposé.
3. **Ce que fait le système.** La fin est la fin saisie, sinon début + 6 h (`M/20261109000008_lot9bis_cycle.sql:476-488`).
   Après elle, la partenaire est refusée ; un admin habilité passe, avant comme après (`M/…lot9ter_equipe_messages.sql:287-295`,
   `lookup/route.ts:58-69`). Le reste est identique à 08.1 à 08.3. L'événement « Terminé » n'empêche rien d'autre.
4. **Messages envoyés.** Comme 08.1 à 08.3.
5. **Ce que voient les autres rôles.** Comme 08.1.
6. **Refus.** Partenaire : « L’événement est terminé : seul Event Village peut encore rembourser ce billet. Contactez le
   support. » ; admin sans la permission : « Action non autorisée : votre compte n’a pas la permission « Gérer les
   remboursements ». ».
7. **Preuves et essai.** Fichiers cités. Aucune page d'administration ne retrouve un billet par son numéro sans passer par
   l'événement (`14-non-implemente.md`).

## 08.5 Billet transféré, ou en cours de transfert, puis remboursé

1. **Qui, où.** Comme 08.1, sur un billet que Fatou a envoyé à un proche.
2. **Ce qu'il saisit.** Comme 08.1.
3. **Ce que fait le système.**
   - **Transfert en attente** : annulé dans la même opération, billet déverrouillé (`M/…lot9ter_equipe_messages.sql:365-399`).
   - **Transfert déjà accepté** : l'argent va toujours au **compte qui a payé** (Fatou), jamais au porteur actuel
     (`:461-470`). Le porteur actuel est prévenu (hors annulation de l'événement) quand il n'est pas le payeur
     (`:345-353`, `:422-432`).
4. **Messages envoyés.**

   | Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
   |---|---|---|---|---|
   | Destinataire d'un transfert en attente (numéro ; compte de ce numéro) | SMS au numéro ; cloche, push, email au compte | `TRANSFER_REVOKED` (registre : voir 10) | file | « Event Village : le billet {titre, 30} qui vous était transféré a été remboursé à son acheteur. Le transfert est annulé. » — ex. « Event Village : le billet Concert Test qui vous était transféré a été remboursé à son acheteur. Le transfert est annulé. » (120 caractères, 1 segment) ; cloche « Transfert annulé » / « Le billet pour « {titre} » a été remboursé à son acheteur : le transfert est annulé. » |
   | Porteur actuel (transfert accepté) | SMS, cloche, push, email | indispensable (`TICKET_REFUNDED_HOLDER`) | file | « Event Village : votre billet {catégorie, 25} pour {titre, 30} a été annulé. Le remboursement est versé à l'acheteur d'origine. » — ex. « Event Village : votre billet Standard pour Concert Test a été annulé. Le remboursement est versé à l'acheteur d'origine. » (120 caractères, 1 segment) ; cloche « Billet annulé » / « Votre billet Standard pour « Concert Test » du sam. 5 déc. 2026 à 20:00 a été annulé. Le remboursement est versé à l'acheteur d'origine. » |
   | Payeur (Fatou) | comme 08.1 | | | `REFUND_REQUESTED`, puis `REFUND_PAID` |

   Preuves : `lib/notifications/catalog.ts:1440-1446`, `:1642-1651`. Un billet en espèces transféré : le porteur reçoit
   `TICKET_REFUNDED_HOLDER` à la place de `TICKET_CANCELLED` (`M/…lot9ter_equipe_messages.sql:405`).
5. **Ce que voient les autres rôles.** Le porteur : billet annulé dans Mes billets.
6. **Refus.** Comme 08.1.
7. **Preuves et essai.** Recette : essai 83 (`docs/recette-billetterie.md:1788-1804`).

## 08.6 Remboursement demandé par le client après un report de plus de 24 h

1. **Qui, où.** Le porteur du billet, dans Mes billets, bouton « Me faire rembourser » (règle d'ouverture du droit,
   textes de la carte et de la fenêtre : `04-evenement-cycle.md`, 04.14).
2. **Ce qu'il saisit.** Une confirmation (`{ confirm: true }`) ; sans elle : « Confirmez la demande de remboursement. »
   (`app/api/tickets/[id]/refund/route.ts:50-57`).
3. **Ce que fait le système.** Même opération que 08.1 avec le motif fixé « Report de l’événement » et le contexte
   « report » (`app/api/tickets/[id]/refund/route.ts:15`, `:70`, `M/…lot9ter_equipe_messages.sql:296-303`) : prix + frais
   de service, versés au **compte qui a payé** (l'acheteur d'origine pour un billet reçu). Le versement part aussitôt
   (`:76-78`) et suit 08.10.
4. **Messages envoyés.** Comme 08.1 (`REFUND_REQUESTED` au payeur, puis `REFUND_PAID`).
5. **Ce que voient les autres rôles.** La partenaire : « Remboursement d’un billet » dans son historique ; son solde est
   débité (08.9).
6. **Refus.** « Ce billet n’ouvre pas de remboursement : l’événement n’a pas été reporté de plus de 24 h, ou il a
   commencé. » ; billet d'un autre : « Billet introuvable. » ; billet déjà traité : « Ce billet ne peut plus être
   remboursé. » ; panne : « Remboursement momentanément indisponible. Réessayez dans un instant. »
   (`app/api/tickets/[id]/refund/route.ts:11`, `:19-33`, `M/…lot9ter_equipe_messages.sql:298-302`).
7. **Preuves et essai.** Recette : essai 14 (`docs/recette-billetterie.md:553-569`).

## 08.7 Remboursements d'une annulation d'événement

1. **Qui, où.** L'annulation elle-même (fenêtre, champs, avis, qui peut annuler) : `04-evenement-cycle.md`, 04.19. Ici :
   ce qu'elle fait de l'argent et où on le suit. Suivi : pilotage `/partner/events/{id}` d'un événement annulé, section
   « Remboursements » / « Avancement des remboursements des billets payés en ligne après l’annulation. », bouton
   « Actualiser l’avancement des remboursements » (`app/partner/events/[id]/page.tsx:252`,
   `components/events/RefundProgress.tsx:63-73`) ; même bloc sur la fiche admin (`app/admin/events/[id]/page.tsx:593`).
2. **Ce qu'il saisit.** Rien (lecture).
3. **Ce que fait le système.**
   - Dans la même opération que l'annulation (`M/20261106000003_lot8_paiement.sql:371-405`) : pour **chaque paiement en
     ligne** de billets confirmé ou remboursé en partie, un remboursement du **reste du paiement** (prix + frais de
     service de tous ses billets, **billets déjà utilisés compris**), versement `EVENT_CANCELLATION_REFUND` vers le
     compte qui a payé (`M/20261101000005_lot3_remboursements.sql:194-257`) ; les billets payés au guichet passent par
     08.2 (à rembourser par l'organisateur) ; gratuits et invitations par 08.3 ; plus aucun billet valable.
   - Après l'annulation, tous les versements créés partent **en lot** : le solde SamirPay est lu une fois, puis chaque
     ligne part tant que le solde estimé la couvre ; au premier manque, cette ligne et les suivantes sont bloquées
     « solde insuffisant » et repartiront seules quand le solde reviendra (`lib/events/event-cancellation.service.ts:120-127`,
     `lib/payments/cashout.service.ts:362-447`). Message à l'auteur : « Événement annulé. {n} remboursement(s)
     envoyé(s)[, {m} en attente ou à vérifier]. » (`lib/events/event-cancellation.service.ts:157`).
   - **Avancement** (`M/20261109000007_lot9bis_versements.sql:598-690`, `components/events/RefundProgress.tsx:87-134`) ;
     chaque carte compte les versements de remboursement (toutes natures) des paiements de l'événement :

     | Carte (texte exact) | Formule | Vue par |
     |---|---|---|
     | « Versés » — « {n} remboursements » | versements confirmés : nombre et somme | tous |
     | « En cours » | à envoyer sans blocage, ou envoyés | tous |
     | « En vérification » — « … : issue à confirmer auprès de l’opérateur » | incertains | tous |
     | « À reprendre » — « … échoués ou bloqués, à reprendre » | échoués, ou à envoyer avec un motif de blocage | administration seule |
     | Bandeau « Retardé : l’équipe Event Village s’en occupe » — « {n} remboursements ({montant}) : versement retardé, repris par l’équipe Event Village. Rien n’est à faire de votre côté. » | versements présents dans « Versements à reprendre » (recoupe les autres cartes) | tous, s'il y en a |
     | « Espèces du guichet rendues par l’organisateur » — « {rendu} sur {total} », « {n} ventes sur {m} cochées « Remboursé » (jamais remboursées par Event Village) » | ventes au guichet (08.8) | tous, s'il y en a |
     | « Billets payés hors plateforme, remboursés par l’organisateur » — « {n} remboursements à régler directement aux participants payés en espèces » | lignes « à régler par l'organisateur » des billets de l'événement | tous, s'il y en a (constat W7-05) |

4. **Messages envoyés.**

   | Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
   |---|---|---|---|---|
   | Détenteurs, acheteurs, contrôleurs, administration | — | — | à l'annulation | 04.19 (`EVENT_CANCELLED`, `EVENT_CANCELLED_BY_ADMIN`, `ADMIN_EVENT_CANCELLED`, `CONTROLLER_EVENT_CANCELLED`) |
   | Chaque payeur remboursé | SMS, cloche, email, push | indispensable (`REFUND_PAID`) | file, à la confirmation de **son** versement | comme 08.1 ; ex. « Event Village : remboursement de 23 625 F CFA versé sur votre compte Wave (Concert Test). » (89 caractères, 1 segment) |
   | Payeur dont le versement traîne | SMS, cloche, email, push | indispensable (`REFUND_DELAYED`) | 08.10 | 08.10 |
   | La partenaire | cloche, email, push | indispensable (`CANCEL_REFUNDS_BLOCKED`), au plus un par jour et par événement | file, au premier blocage ou refus | « Remboursements en attente » / « Des remboursements de « {titre} » sont bloqués : l'administration les reprend. » |
   | La partenaire | cloche, email, push | indispensable (`CANCEL_REFUNDS_DONE`), une fois | file, quand le dernier versement de l'annulation est confirmé | « Remboursements terminés » / « Tous les remboursements en ligne de « {titre} » sont versés. » |

   Preuves : `M/20261109000007_lot9bis_versements.sql:420-430`, `:465-494`, `:512-521` ; `lib/notifications/catalog.ts:1000-1011`.
5. **Ce que voient les autres rôles.** Le client : « Remboursement en cours » puis « Remboursé » sur ses billets ; la
   fiche publique annonce le remboursement automatique (04.19). L'administration : « Versements à reprendre » (08.11).
6. **Refus.** Lecture de l'avancement : admin sans « Consulter les événements » : « Action non autorisée : votre compte
   n’a pas la permission « Consulter les événements ». » ; tiers : « Événement introuvable. » ; panne : « Avancement
   indisponible » (`M/20261109000007_lot9bis_versements.sql:622-633`, `RefundProgress.tsx:83-85`).
7. **Preuves et essai.** Recette : essais 44 et 45 (`docs/recette-billetterie.md:1064-1097`).

## 08.8 Espèces du guichet à rembourser par l'organisateur après une annulation

1. **Qui, où.** Pilotage d'un événement **annulé**, section « Espèces à rembourser par l’organisateur » : « Ventes au
   guichet de cet événement annulé. Event Village ne les rembourse jamais : rendez les espèces à chaque acheteur, puis
   cochez « Remboursé ». » (`app/partner/events/[id]/page.tsx:253`, `components/partner/pilotage/CashRefundsList.tsx:126-135`).
   La propriétaire (compte actif) coche ; l'administration (« Consulter les événements ») lit seulement.
2. **Ce qu'il saisit.** Cartes « Ventes au guichet » ({total}, « {n} ventes à rendre en espèces ») et « Déjà remboursé »
   ({montant}, « {n} ventes cochées « Remboursé » sur {m} ») ; une ligne par vente : « Vente {référence} » (8 premiers
   signes de la vente, en capitales, la même que sur le reçu SMS du guichet), montant, « {n} billets · {numéro masqué} »
   (ou « Numéro non saisi »), « Vendue le {date} par {vendeur} », et la case « Remboursé » (`CashRefundsList.tsx:147-198`,
   `M/20261109000006_lot9bis_argent.sql:398-421`, `M/20261110000009_lot9ter_zones.sql:1632`). Cocher ouvre « Marquer
   cette vente remboursée ? » : « Confirmez-vous avoir rendu {montant} en espèces pour la vente {référence} ? Ce marquage
   est définitif. », « Vente », « Billets », « Acheteur », boutons « Oui, les espèces sont rendues » et « Pas encore »
   (`CashRefundsList.tsx:203-227`).
3. **Ce que fait le système.** La liste est calculée en direct : ventes au guichet confirmées de l'événement, montant
   > 0 (`M/20261109000006_lot9bis_argent.sql:398-404`). La marque est **définitive** (une par vente, jamais décochée) et
   journalisée `CASH_REFUND_MARKED` (`:484-500`). Toast « Vente {référence} marquée remboursée. », ou « La vente {référence}
   était déjà marquée remboursée. » ; la ligne affiche « Remboursé le {date} par {nom} » (`CashRefundsList.tsx:67-79`,
   `:94-96`). Aucun argent ne bouge dans l'application.
4. **Messages envoyés.** Aucun.
5. **Ce que voient les autres rôles.** Administration : même liste, « À rembourser par l’organisateur » au lieu de la
   case, bandeau « Lecture seule » / « Seul l’organisateur de l’événement coche « Remboursé », après avoir rendu les
   espèces. » (`CashRefundsList.tsx:106-109`, `:165-169`). Carte « Espèces du guichet rendues par l’organisateur » de
   l'avancement (08.7).
6. **Refus.** Admin qui tenterait de cocher : « Seul l’organisateur de l’événement marque les espèces rendues. » ;
   événement non annulé : « La liste des espèces à rembourser n’existe que pour un événement annulé. » ; vente hors liste :
   « Vente introuvable dans la liste des espèces à rembourser. » ; compte inactif : « Votre compte n’est pas actif. » ;
   panne : « Le marquage est momentanément impossible. Réessayez dans un instant. » ; écran : « Marquage non enregistré »
   (`M/20261109000006_lot9bis_argent.sql:455-481`, `app/api/partner/events/[id]/cash-refunds/[paymentId]/route.ts:10`,
   `CashRefundsList.tsx:228-232`). Vide : « Aucune vente au guichet » / « Aucun billet n’a été vendu au guichet pour cet
   événement : il n’y a pas d’espèces à rendre. ».
7. **Preuves et essai.** Recette : essai 46 (`docs/recette-billetterie.md:1098-1117`).

## 08.9 Effets comptables d'un remboursement

1. **Qui, où.** Automatique, au moment où le remboursement est **créé** (pas à sa confirmation).
2. **Ce qu'il saisit.** Rien.
3. **Ce que fait le système** (`M/20261101000005_lot3_remboursements.sql:42-82`, dernière définition de
   `fin_refund_apply`) :
   - **Partenaire** : débit « Remboursement d’un billet » du **prix** (part faciale), plus la part des frais SamirPay
     d'encaissement si le réglage « Frais agrégateur d’une annulation » vaut « Organisateur ». Date de l'écriture : la
     plus tardive entre maintenant et la disponibilité de la vente : un remboursement avant la fin de l'événement réduit
     l'argent « En attente », après il réduit le « Disponible ».
   - Si le solde total de la partenaire ne couvre pas le débit, seule la part couverte est débitée ; le reste devient une
     **créance** (« À compenser » dans Finances), reprise automatiquement sur les ventes futures (chaque nouveau crédit
     rembourse d'abord les créances), et les administrateurs reçoivent `ADMIN_FINANCE_DEBT`
     (`M/20261101000004_lot3_grand_livre.sql:166-219`, `:221-261`).
   - **Event Village** : le revenu net du paiement baisse des frais de service rendus (« Event Village » porteur) ou des
     frais de service moins la part des frais SamirPay (« Organisateur » porteur) (`M/…lot9ter_equipe_messages.sql:449-465`,
     `M/20261101000005_lot3_remboursements.sql:219-238`).
   - **Parrainage** : les commissions du paiement sont annulées ou régularisées (09).
   - Paiement sans billet ou payé deux fois (`REFUND`) : frais SamirPay perdus toujours à la charge d'Event Village
     (`M/20261101000005_lot3_remboursements.sql:226-227`).
   - **Exemple chiffré** (taux d'installation, porteur « Event Village »), panier de Fatou (23 625 F, frais SamirPay
     estimés 354,38 F) :

     | Opération | Versé à Fatou | Débit partenaire | Revenu net Event Village du paiement |
     |---|---|---|---|
     | Avant tout remboursement | — | — | 1 125 − 354,38 = 770,62 F |
     | Remboursement d'un « Standard » | 5 000 + 250 = **5 250 F** | **5 000 F** | 770,62 − 250 = 520,62 F (la part SamirPay perdue, 354,38 × 5 250 / 23 625 = 78,75 F, reste chez Event Village) |
     | Même remboursement, porteur « Organisateur » | 5 250 F | 5 000 + 78,75 = **5 078,75 F** | 770,62 − (250 − 78,75) = 599,37 F |
     | Annulation de l'événement (reste du paiement) | **23 625 F** | 22 500 F | 770,62 − 1 125 = −354,38 F |

     À cela s'ajoutent les frais SamirPay **du versement** lui-même (08.15).
4. **Messages envoyés.** Créance : administrateurs « Consulter les paiements » et SUPERADMIN, cloche et email
   (`ADMIN_FINANCE_DEBT`) : « Créance sur un compte » / « Un débit de {montant} sur le compte organisateur dépasse le solde
   disponible : une créance de {reste} sera compensée sur les gains futurs. » — ex. « Un débit de 5 000 F CFA sur le compte
   organisateur dépasse le solde disponible : une créance de 2 000 F CFA sera compensée sur les gains futurs. »
   (`lib/notifications/catalog.ts:1237-1250`, `M/20261103000006_lot6_pros_admin.sql:515-532`).
5. **Ce que voient les autres rôles.** Partenaire : « Finances » (08.18). Administration : « Paiements rapprochés » (08.20).
6. **Refus.** Sans objet.
7. **Preuves et essai.** Fichiers cités. Recette : essai 56.

## 08.10 La vie d'un versement : envoi, confirmé, refusé, bloqué, incertain, retardé, reprise automatique

1. **Qui, où.** Automatique (envoi à la création, puis tâche `ev_payments_reconcile` toutes les 5 minutes, 12.3).
2. **Ce qu'il saisit.** Rien.
3. **Ce que fait le système** (`lib/payments/cashout.service.ts:261-360`, `:450-462`, `:579-601`) :
   - **Avant l'envoi** : rien ne part sans opérateur, numéro, prénom et nom (blocage) ; un retrait d'un compte non actif
     est sauté ; le solde SamirPay est lu : insuffisant → blocage « solde » ; illisible → l'envoi attend la reprise.
   - **Envoi** réservé une seule fois (deux appels simultanés ne font qu'un versement), compteur de tentatives +1.
   - **Réponse** : succès immédiat → « confirmé », effets appliqués (billets « Remboursé », retrait « Versé ») ; identifiant
     reçu → « envoyé », confirmé plus tard par la tâche ; refus « solde insuffisant » ou « hors limites » sans débit →
     blocage (rien n'est débité) ; autre refus explicite → « échoué » (un retrait est alors refusé et son montant rendu au
     solde ; un remboursement reste à reprendre) ; délai dépassé ou réponse illisible → « incertain », **jamais renvoyé
     sans décision humaine**.
   - **Tâche des 5 minutes** (`app/api/cron/payments-reconcile/route.ts:68-88`) : confirme les « envoyés » auprès de
     SamirPay (succès, ou échec/annulation → « échoué ») ; renvoie les « à envoyer » vieux de plus de 5 minutes, sans motif
     ou bloqués faute de solde, en lot (comme 08.7) ; signale **une fois** les versements en attente ou envoyés depuis plus
     de **30 minutes** (`M/20261109000007_lot9bis_versements.sql:121-150`).
   - Un remboursement « échoué » garde son billet « Remboursement en cours » et le débit de la partenaire : rien n'est
     défait ; il attend « Renvoyer » (`M/20261109000007_lot9bis_versements.sql:1029-1031`).
4. **Messages envoyés** (`M/20261109000007_lot9bis_versements.sql:408-585`) :

   | Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
   |---|---|---|---|---|
   | Bénéficiaire d'un remboursement | SMS, cloche, email, push | indispensable (`REFUND_DELAYED`), **un seul par versement** | file, au premier blocage (sauf simulé), refus, incertitude ou retard de 30 min | SMS « Event Village : remboursement de {montant} retardé ("{titre, 30}"). L'équipe Event Village s'en occupe, aucune action de votre part. » — ex. « Event Village : remboursement de 5 250 F CFA retardé ("Concert Test"). L'équipe Event Village s'en occupe, aucune action de votre part. » (135 caractères, 1 segment) ; cloche « Remboursement retardé » / « Le remboursement de {montant} pour « {titre} » est retardé. L'équipe Event Village s'en occupe : vous serez prévenu dès le versement. » |
   | Bénéficiaire d'un retrait | SMS, cloche, email, push | indispensable (`WITHDRAWAL_DELAYED`, `WITHDRAWAL_UNCERTAIN`, `WITHDRAWAL_REJECTED`, `WITHDRAWAL_PAID`) | file | textes en 03.21 |
   | Admins « Gérer les remboursements » et SUPERADMIN | cloche, push, email | indispensable (`ADMIN_REFUND_TO_RETRY`) | remboursement bloqué ou échoué | « Remboursement à reprendre » / « Un remboursement de {montant} est bloqué : {motif}. » ou « … est refusé par l'opérateur. » — ex. « Un remboursement de 5 250 F CFA est bloqué : solde du compte partenaire SamirPay insuffisant. » |
   | Mêmes | cloche, push, email | indispensable (`ADMIN_CASHOUT_TO_RESUME`) | retrait bloqué, ou tout versement en retard de 30 min | « Versement à reprendre » / « Un versement de {montant} ({nature}) attend depuis plus de 30 minutes. » ou « Un retrait de {montant} est bloqué : {motif}. » — ex. « Un versement de 5 250 F CFA (remboursement d’un billet) attend depuis plus de 30 minutes. » |
   | Mêmes | cloche, push, email | indispensable (`ADMIN_CASHOUT_UNCERTAIN`) | versement incertain | « Versement incertain » / « L'issue d'un versement de {montant} est incertaine : vérifiez-le avant toute action. » |
   | Mêmes | cloche, email | indispensable (`ADMIN_WITHDRAWAL_REJECTED`) | retrait échoué | « Retrait refusé par l'opérateur » / « Le retrait de {montant} a été refusé ; le montant est revenu sur le solde du bénéficiaire. » |

   Textes : `lib/notifications/catalog.ts:1204-1236`, `:1314-1363`. Les motifs de la cloche des administrateurs ont leurs
   propres libellés (`lib/notifications/catalog.ts:190-199` ; constat W7-07).
5. **Ce que voient les autres rôles.** Client : « Remboursement retardé, l’équipe Event Village s’en occupe. » sur la
   carte du billet et sur la page du paiement (`components/tickets/TicketCard.tsx:553-555`, `app/paiement/[id]/page.tsx:822-826`) ;
   « Mes paiements » ne le dit que pour un paiement « Remboursement en cours » (constat W7-08). Partenaire : badge
   « Retardé » sur un retrait (03.21).
6. **Refus.** Sans objet.
7. **Preuves et essai.** Recette : essais 58 et 60 (`docs/recette-billetterie.md:1309-1364`).

## 08.11 « Versements à reprendre » : la liste de l'administration

1. **Qui, où.** ADMIN muni de « Gérer les remboursements », ou SUPERADMIN : `/admin/finance`, section « Versements à
   reprendre » : « Remboursements et retraits refusés, bloqués, à l’issue incertaine ou en attente depuis plus de 30
   minutes, du plus ancien au plus récent. » (`app/admin/finance/page.tsx:312`, `components/admin/RefundsToRetry.tsx:404-410`).
   Sans la permission : « Reprise des versements réservée » / « Votre compte n’a pas la permission de gérer les
   remboursements et les versements. » (`:425-429`).
2. **Ce qu'il saisit.** Rien pour lire ; « Actualiser » en haut de page relit aussi la liste (`app/admin/finance/page.tsx:180-191`).
3. **Ce que fait le système.**
   - **Qui entre dans la liste** (`M/20261109000007_lot9bis_versements.sql:86-113`) : remboursement « échoué » (un retrait
     échoué est clos, montant rendu) ; tout « incertain » ; tout « à envoyer » bloqué (sauf simulé) ; « à envoyer » sans
     motif depuis plus de 30 min ; « envoyé » non confirmé depuis plus de 30 min. Seuls les versements du mode du serveur
     (réel ou simulé) sont montrés ; 100 lignes au plus, du plus ancien au plus récent ; au-delà, « Liste incomplète » /
     « Seuls les {n} versements les plus anciens sur {total} sont affichés. Traitez-les pour voir les suivants. »
     (`app/api/admin/refunds/route.ts:203-209`, `RefundsToRetry.tsx:444-448`).
   - **Colonnes** : « Montant », « Versement » (nature + titre de l'événement), « Bénéficiaire » (« {prénom} {initiale}. ·
     {numéro masqué} », ex. « Fatou D. · 77*****00 », sinon « Bénéficiaire inconnu »), « État » (badge + motif), « Depuis
     le », « Reprise » (conseil + boutons) (`RefundsToRetry.tsx:361-370`, `app/api/admin/refunds/route.ts:126-132`).
   - **États et conseils** (`app/api/admin/refunds/route.ts:47-55`, `:143-181`) :

     | État affiché | Conseil exact | Boutons |
     |---|---|---|
     | « Refusé par l’opérateur » | « Refusé par l’opérateur sans débit : vous pouvez le renvoyer. » | « Renvoyer », « Marquer versé » |
     | « Non versé (constaté avec le support SamirPay) » | « Le support SamirPay a confirmé que ce versement n’est pas parti (référence {réf}) : vous pouvez le renvoyer. » | « Renvoyer », « Marquer versé » |
     | « Bloqué » + motif, opérateur ou numéro inconnu | « Aucune destination connue : si le versement a été réglé autrement, marquez-le versé avec sa référence. » | « Marquer versé » |
     | « Bloqué » + « prénom ou nom du bénéficiaire manquant » | « Complétez le prénom et le nom du bénéficiaire, puis renvoyez le versement. » | « Renvoyer », « Marquer versé » |
     | « Bloqué » + autre motif | « Rien n’est parti : renvoyez-le une fois la cause levée. » | « Renvoyer », « Marquer versé » |
     | « En attente depuis plus de 30 min » | « Rien n’est parti : il repart seul dès que le solde SamirPay est lisible, ou renvoyez-le. » | « Renvoyer » (si l'envoi n'a jamais commencé), « Marquer versé » |
     | « Issue incertaine » ou « Envoyé, non confirmé », avec identifiant SamirPay | « Le statut SamirPay est relu avant tout renvoi : renvoyé seulement s’il a échoué. » | « Renvoyer » (après relecture), « Marquer versé » |
     | Mêmes, sans identifiant SamirPay | « Vérifiez auprès du support SamirPay. Si le versement est parti, marquez-le versé avec sa référence. » | « Marquer versé » ; « Constater non versé » pour le SUPERADMIN sur « Issue incertaine » |

   - Vide : « Aucun versement à reprendre. » ; erreur : « Liste indisponible » (`RefundsToRetry.tsx:431-439`).
4. **Messages envoyés.** Aucun depuis la liste (les avis qui y mènent : 08.10).
5. **Ce que voient les autres rôles.** Rien.
6. **Refus.** Panne : « Liste des versements à reprendre momentanément indisponible. » (`app/api/admin/refunds/route.ts:246`).
7. **Preuves et essai.** Recette : essais 58, 75, 84.

## 08.12 « Renvoyer » un versement

1. **Qui, où.** « Gérer les remboursements » ou SUPERADMIN, compte actif ; bouton « Renvoyer » d'une ligne (08.11).
2. **Ce qu'il saisit.** Fenêtre « Renvoyer ce versement ? » : « Le versement repart vers ce bénéficiaire dès votre
   confirmation. » (ou, avec identifiant SamirPay, « Le statut SamirPay est relu d’abord : le versement ne repart que
   s’il a échoué. ») ; rappel « Montant », « Versement », « Bénéficiaire », « État » ; champ « Justification »
   obligatoire, 10 à 500 caractères, aide « 10 caractères au moins, gardée au journal des décisions. » ; le bouton
   « Renvoyer » reste inactif sous 10 caractères (`RefundsToRetry.tsx:393-401`, `:450-500`).
3. **Ce que fait le système** (`lib/payments/cashout.service.ts:476-535`, `M/20261109000007_lot9bis_versements.sql:155-318`) :
   - versement « incertain » ou « envoyé » avec identifiant : le statut SamirPay est relu juste avant ; « succès » →
     confirmé d'office, rien ne repart ; « en cours » → refus ; « échoué » ou « annulé » → renvoi ;
   - nom manquant : relu sur le profil ; toujours absent → refus ;
   - le versement est remis « à envoyer » (motif, identifiant et signal de retard effacés ; remboursement repassé « en
     attente »), journal `CASHOUT_RESENT` avec la justification, puis **un seul** envoi part aussitôt.
   - Résultats (`RefundsToRetry.tsx:113-122`) : « Versement confirmé » / « SamirPay a confirmé le versement : il quitte la
     liste. » ; « Versement envoyé » / « Le versement est parti : la confirmation de SamirPay est attendue. » ; « Versement
     non parti » / « Le renvoi est enregistré, mais le versement n’est pas parti : son nouvel état est affiché dans la
     liste. ». La liste est relue.
4. **Messages envoyés.** Ceux de la nouvelle issue (08.10) ; l'avis de retard au bénéficiaire ne repart pas (un par
   versement).
5. **Ce que voient les autres rôles.** Le bénéficiaire est remboursé ou payé (`REFUND_PAID`, `WITHDRAWAL_PAID`).
6. **Refus (textes exacts du serveur, bandeau « Renvoi refusé » ; refus de saisie dans la fenêtre, « Décision
   refusée »)** :

   | Cas | Texte |
   |---|---|
   | Justification trop courte ou trop longue | « Indiquez la raison (10 caractères au moins). » ; « La raison ne doit pas dépasser 500 caractères. » |
   | Versement déjà confirmé, ou retrait déjà échoué | « Ce versement est déjà clos : aucune décision n’est possible. » |
   | Rien ne prouve qu'il n'est pas parti | « Ce versement ne peut pas être renvoyé : rien ne prouve qu’il n’est pas parti. Vérifiez auprès du support SamirPay, puis marquez-le versé s’il l’est. » |
   | SamirPay dit « en cours » | « SamirPay indique que ce versement est encore en cours : attendez son issue. » |
   | Versement simulé | « Ce versement a été créé en mode simulé : il ne part jamais en réel. » |
   | Opérateur ou numéro inconnu | « Ce versement ne peut pas être renvoyé : l’opérateur ou le numéro du bénéficiaire est inconnu. Marquez-le versé s’il a été réglé autrement. » |
   | Nom toujours manquant | « Le prénom ou le nom du bénéficiaire manque encore : complétez son profil, puis renvoyez le versement. » |
   | Statut SamirPay illisible | « Statut SamirPay momentanément illisible : réessayez dans un instant. » |
   | Remis à envoyer mais envoi en échec | « Versement remis à envoyer, mais l’envoi n’a pas abouti : il repartira automatiquement. » |
   | Droit absent en base | « Action non autorisée. » |
   | Panne | « Renvoi du versement momentanément impossible. » |
   | Réponse perdue | « Résultat inconnu » / « La réponse du serveur n’est pas arrivée : la décision a pu être prise. Relisez la liste avant de recommencer. » |

   Preuves : `M/20261109000007_lot9bis_versements.sql:187-199`, `:224-276`, `lib/payments/cashout.service.ts:479-482`,
   `:510`, `:532`, `app/api/admin/cashouts/[id]/resend/route.ts:32`, `RefundsToRetry.tsx:278-286`.
7. **Preuves et essai.** Recette : essai 75 (`docs/recette-billetterie.md:1615-1633`).

## 08.13 « Marquer versé »

1. **Qui, où.** Comme 08.12 ; bouton « Marquer versé » (proposé sur toutes les lignes, `app/api/admin/refunds/route.ts:238`).
2. **Ce qu'il saisit.** Fenêtre « Marquer ce versement versé ? » : « Vérifiez auprès du support SamirPay que ce versement
   est bien parti, puis indiquez sa référence. Il sera confirmé sans nouvel envoi. » ; « Justification » (10 à 500) ;
   « Référence SamirPay » obligatoire, aide « Référence de la transaction (TX suivi de 8 caractères) ou son identifiant,
   lue dans le tableau de bord SamirPay. » ; « Frais SamirPay (F CFA), facultatif », aide « Frais réellement prélevés,
   s’ils sont connus. », erreur « Indiquez un montant positif ou nul, ou laissez vide. » (`RefundsToRetry.tsx:397-398`,
   `:501-526`).
3. **Ce que fait le système.** Versement « confirmé » sans aucun envoi, référence et frais enregistrés, effets appliqués
   (billets « Remboursé », paiement « Remboursé » ou « Remboursé en partie », retrait « Versé »), journal
   `CASHOUT_MARKED_PAID` (`M/20261109000007_lot9bis_versements.sql:298-317`). Message « Versement marqué versé » / « Le
   versement est confirmé avec la référence indiquée : il quitte la liste. » (`RefundsToRetry.tsx:273`).
4. **Messages envoyés.** `REFUND_PAID` ou `WITHDRAWAL_PAID` au bénéficiaire (passage à « confirmé », 08.1, 03.21) ;
   `CANCEL_REFUNDS_DONE` à la partenaire si c'était le dernier versement d'une annulation.
5. **Ce que voient les autres rôles.** Comme une confirmation normale.
6. **Refus.** « Indiquez la référence SamirPay du versement. » ; « Frais invalides : indiquez un montant positif ou
   nul. » ; SamirPay dit échoué : « SamirPay indique que ce versement a échoué : renvoyez-le plutôt. » ; versement clos :
   « Ce versement est déjà clos : aucune décision n’est possible. » ; panne : « Marquage du versement momentanément
   impossible. » (`lib/payments/cashout.service.ts:485-494`, `M/20261109000007_lot9bis_versements.sql:299-302`,
   `app/api/admin/cashouts/[id]/mark-paid/route.ts:33`).
7. **Preuves et essai.** Recette : essai 75 (dernière phrase).

## 08.14 « Constater non versé » (SUPERADMIN)

1. **Qui, où.** SUPERADMIN actif (avec « Gérer les remboursements »), sur une ligne « Issue incertaine » **sans
   identifiant SamirPay** ; bouton « Constater non versé » (`app/api/admin/refunds/route.ts:217-239`).
2. **Ce qu'il saisit.** Fenêtre « Constater que ce versement n’est pas parti ? » : « À faire seulement si le support
   SamirPay confirme que ce versement n’est jamais parti. Il passera « Non versé » : un remboursement pourra ensuite être
   renvoyé, par un nouvel envoi ; un retrait sera annulé et son montant rendu au bénéficiaire. Rien ne repart
   automatiquement. » ; « Référence du support SamirPay » obligatoire (100 caractères au plus, aide « Numéro du ticket
   ou de l’échange avec le support SamirPay, 100 caractères au plus. ») ; « Motif » (10 à 500, « 10 caractères au moins,
   gardé au journal des décisions. ») (`RefundsToRetry.tsx:393-396`, `:474-499`). Si le mot de passe n'a pas été saisi
   depuis 10 minutes : fenêtre « Confirmez votre mot de passe » / « Par sécurité, cette action demande votre mot de
   passe. », « Le constat sera enregistré juste après. » ; fermée sans saisie : « Mot de passe non saisi » / « Constat
   interrompu : votre mot de passe est demandé pour continuer. » (`RefundsToRetry.tsx:260-264`, `:537-543`,
   `components/auth/PasswordConfirmDialog.tsx:113-114`).
3. **Ce que fait le système** (`M/20261110000005_lot9ter_argent.sql:54-131`) : versement « échoué » (motif « Non versé :
   constaté avec le support SamirPay »), référence et motif gardés ; remboursement « échoué » (il reste dans la liste,
   « Non versé (constaté avec le support SamirPay) », à renvoyer à la main) ; **retrait refusé et brut rendu au solde**
   (il quitte la liste) ; journal `CASHOUT_NOT_SENT`. Rien n'est envoyé. Messages à l'écran : « Versement constaté non
   versé » / « Il reste dans la liste : renvoyez-le quand vous le souhaitez. » ou « Retrait annulé » / « Le montant est
   revenu sur le solde du bénéficiaire, qui peut refaire sa demande. » (`RefundsToRetry.tsx:124-130`).
4. **Messages envoyés.** Ceux d'un échec (08.10) : pour un retrait, `WITHDRAWAL_REJECTED` à la partenaire (« … a été
   refusé par l'opérateur … ») et `ADMIN_WITHDRAWAL_REJECTED` ; pour un remboursement, `ADMIN_REFUND_TO_RETRY` (« … est
   refusé par l'opérateur. ») et `REFUND_DELAYED` au payeur s'il ne l'a pas déjà reçu pour ce versement (`M/20261109000007_lot9bis_versements.sql:505-540`).
   Ces textes parlent d'un refus de l'opérateur alors que rien n'est parti (constat W7-10).
5. **Ce que voient les autres rôles.** Partenaire : retrait « Refusé, montant rendu » avec « Motif : Non versé (constaté
   avec le support SamirPay) » (03.18, `M/20261109000007_lot9bis_versements.sql:1050-1056`).
6. **Refus.** « Seul un superadmin peut constater qu’un versement n’est pas parti. » ; « Par sécurité, saisissez votre mot
   de passe pour continuer. » ; « Indiquez la référence du support SamirPay (100 caractères au plus). » ; « Indiquez la
   raison (10 caractères au moins). » ; « Ce versement n’est plus à l’issue incertaine : relisez la liste. » ; « SamirPay a
   un identifiant pour ce versement : son statut fait foi. Renvoyez-le (le statut est relu d’abord) ou marquez-le
   versé. » ; panne : « Constat momentanément impossible. » (`M/20261110000005_lot9ter_argent.sql:72-111`,
   `app/api/admin/cashouts/[id]/not-sent/route.ts:33-50`).
7. **Preuves et essai.** Recette : essai 84 (`docs/recette-billetterie.md:1805-1829`).

## 08.15 Frais de versement : qui les paie

1. **Qui, où.** Automatique, à la confirmation d'un versement ; chiffres dans `/admin/finance`, section « Frais SamirPay »
   (08.20).
2. **Ce qu'il saisit.** Rien (sauf les frais facultatifs de « Marquer versé », 08.13).
3. **Ce que fait le système.** SamirPay renvoie, pour un transfert, ses frais réels et le débit total ; ils sont
   enregistrés tels quels, jamais inventés (`lib/payments/cashout.service.ts:327-334`,
   `M/20261109000005_lot9bis_samirpay.sql:9-14`). Imputation (`M/20261110000005_lot9ter_argent.sql:151-253`) :

   | Versement | Frais SamirPay du versement payés par |
   |---|---|
   | Remboursement d'une annulation **décidée par la partenaire** | **la partenaire** : écriture « Régularisation » (« Frais SamirPay du remboursement « {titre} » ») datée comme le débit du remboursement ; si son solde ne couvre pas tout, **créance entière** et alerte `ADMIN_FINANCE_DEBT` (`:198-249`) |
   | Remboursement d'une annulation décidée par l'administration | Event Village (`:192-200`) |
   | Remboursement d'un billet (partenaire, admin, report) | Event Village (`:180-182`) |
   | Paiement sans billet ou payé deux fois | Event Village |
   | Retrait (partenaire ou parrain) | Event Village ; la personne paie seulement les **frais de retrait** réglés (1 % à l'installation), qui doivent couvrir ce coût |
   | Frais inconnus (SamirPay ne les donne pas) | rien n'est imputé (`:183-185`) |

   Les frais SamirPay **d'encaissement** perdus lors d'un remboursement suivent le réglage « Frais agrégateur d’une
   annulation » (08.9). Le réglage des frais de retrait avertit le SUPERADMIN, sans bloquer, s'il est sous le coût
   constaté : « Frais de retrait sous le coût réel » / « Attention : les frais de retrait ({taux} %) sont inférieurs aux
   frais SamirPay constatés ({taux constaté} %). Chaque retrait coûte alors de l’argent à Event Village. » (taux constaté
   = frais réels ÷ montants des versements confirmés des 90 derniers jours) (`app/admin/finance-settings/page.tsx:186-202`,
   `lib/admin/finance-reconciliation.ts:45-55`).
4. **Messages envoyés.** `ADMIN_FINANCE_DEBT` en cas de créance (08.9).
5. **Ce que voient les autres rôles.** Partenaire : ligne « Régularisation » dans l'historique de Finances
   (`app/partner/finance/page.tsx:264-273`).
6. **Refus.** Sans objet.
7. **Preuves et essai.** Fichiers cités. **NON VÉRIFIÉ** : montant réel des frais SamirPay d'un transfert (fourni par
   SamirPay au cas par cas).

## 08.16 Retraits de la partenaire : demande, minimum, frais, devis, refus, incertain

1. **Qui, où.** Partenaire validée, compte actif, `/partner/finance`, bloc « Demander un retrait » (pas à pas, textes
   exacts : 03.19 à 03.21). Parrain : Portefeuille (09).
2. **Ce qu'il saisit.** Opérateur (Wave ou Orange Money), numéro qui reçoit, montant entier ; puis code SMS envoyé au
   numéro **du compte** (03.19).
3. **Ce que fait le système.** Règle unique, relue au devis, à l'envoi du code et à la confirmation
   (`M/20261110000005_lot9ter_argent.sql:318-405`), dans cet ordre : compte actif et fiche validée ; montant entier ≥
   **minimum** (5 000 F à l'installation) ; montant ≤ disponible ; montant ≤ disponible − **gel** (08.17) ; pas de
   changement de numéro depuis moins de 24 h ; **frais** = montant × taux (1 %), **arrondis au franc supérieur** ; net =
   montant − frais (> 0). À la confirmation : le **brut est réservé aussitôt** (écriture « Retrait demandé »), un
   versement du **net** part vers le numéro choisi (`M/20261109000006_lot9bis_argent.sql:742-760`). Issues : versé ;
   refusé par l'opérateur → brut rendu (« Retrait refusé : montant rendu ») ; incertain → montant réservé, jamais
   renvoyé sans décision (08.11 à 08.14) ; bloqué ou en retard → « Retardé ». Les frais de retrait restent à Event
   Village (aucune écriture qui les crédite ailleurs ; ils n'apparaissent pas dans `/admin/finance`, constat W7-09).
   Retrait par virement bancaire : fermé (« Les retraits par virement bancaire ne sont pas ouverts. »,
   `M/20261109000006_lot9bis_argent.sql:681-683`) ; aucun écran (14).
   - **Exemple chiffré.** Disponible 22 500 F ; la partenaire demande 22 500 F : frais 1 % = 225 F ; versés 22 275 F ;
     son solde baisse de 22 500 F dès la confirmation. Demande de 6 000 F : frais 60 F, versés 5 940 F. Demande de
     4 999 F : refus « Le minimum de retrait est de 5 000 F CFA. » (espace insécable entre les milliers), aucun code envoyé.
4. **Messages envoyés.** Code `OTP_WITHDRAWAL` (SMS immédiat) ; puis `WITHDRAWAL_PAID`, `WITHDRAWAL_REJECTED`,
   `WITHDRAWAL_UNCERTAIN`, `WITHDRAWAL_DELAYED` : textes en 03.19 et 03.21 ; administrateurs : `ADMIN_CASHOUT_TO_RESUME`,
   `ADMIN_CASHOUT_UNCERTAIN`, `ADMIN_WITHDRAWAL_REJECTED` (08.10).
5. **Ce que voient les autres rôles.** Administration : total « Retraits versés » (08.20) et « Versements à reprendre »
   (08.11). Aucune liste des retraits côté administration (14).
6. **Refus.** Tableau complet en 03.20.
7. **Preuves et essai.** Recette : essais 42, 43, 75 (`docs/recette-billetterie.md:1026-1063`, `:1615-1633`).

## 08.17 Fonds gelés (événement suspendu)

1. **Qui, où.** Partenaire dont un événement est « Suspendu » (par l'administration, ou par la cascade d'une partenaire
   suspendue) ; parrain dont les filleuls ont acheté pour cet événement. Écran : « Finances », ligne « Fonds gelés :
   {montant}. » (03.18) ; Portefeuille (09).
2. **Ce qu'il saisit.** Rien.
3. **Ce que fait le système** (`M/20261110000005_lot9ter_argent.sql:269-308`) : gel = somme, pour chaque événement
   suspendu, du net **déjà disponible** de ses écritures (ventes moins remboursements), jamais négatif. Rien n'est écrit :
   le gel est recalculé à chaque lecture, il disparaît dès la reprise ou l'annulation de l'événement (un événement annulé
   n'est jamais gelé : ses remboursements sont débités). Effet : « Disponible au retrait » = disponible − gel ; un retrait
   au-delà est refusé : « Une partie de vos fonds est gelée : un de vos événements est suspendu. » (parrain : « Une partie
   de vos commissions est gelée : un événement pour lequel vos filleuls ont acheté des billets est suspendu. »)
   (`:374-381`). Le gel ne touche que l'argent déjà disponible : avec le délai de garde par défaut (fin + 48 h), un
   événement suspendu avant sa fin n'a encore rien de disponible, donc rien de gelé.
   - **Exemple.** Délai de garde désactivé par le SUPERADMIN : la vente de Fatou (22 500 F) est disponible tout de suite ;
     « Concert Test » est suspendu → « Fonds gelés : 22 500 F CFA. », « Disponible au retrait » 0 F ; à la reprise, les
     22 500 F redeviennent retirables sans aucune action.
4. **Messages envoyés.** Aucun propre au gel (la suspension de l'événement a ses messages, 04.16).
5. **Ce que voient les autres rôles.** Administration : rien de spécifique.
6. **Refus.** Ci-dessus.
7. **Preuves et essai.** Recette : essais 70 et 87 (`docs/recette-billetterie.md:1525-1542`, `:1865-1882`).

## 08.18 Soldes de la partenaire : formule de chaque bloc de « Finances »

1. **Qui, où.** `/partner/finance` (textes des blocs : 03.18).
2. **Ce qu'il saisit.** Rien.
3. **Ce que fait le système.** Tout vient du « grand livre » du compte organisateur
   (`M/20261110000007_lot9ter_evenements.sql:154-195`) :

   | Bloc | Formule |
   |---|---|
   | « Disponible au retrait » | (somme des écritures dont la date de disponibilité est passée) − gel, arrondi au franc inférieur, jamais négatif |
   | « Fonds gelés » | 08.17 |
   | « En attente » + « Prochaine disponibilité » | somme des écritures à venir ; première date future d'un crédit |
   | « Retraits en cours » | somme des montants **bruts** des retraits en attente ou en cours d'envoi |
   | « À compenser » | reste des créances ouvertes (08.9) |

   Écritures possibles : « Vente en ligne » (+ prix, disponible à la fin de l'événement + 48 h, réglages), « Remboursement
   d’un billet » (−), « Retrait demandé » (− brut), « Retrait refusé : montant rendu » (+), « Régularisation » (− frais
   SamirPay, 08.15), « Compensation d’une créance » (−) (`app/partner/finance/page.tsx:264-273`,
   `M/20261101000004_lot3_grand_livre.sql:107-133`, `:263-301`). Ventes au guichet et invitations : jamais dans ce solde.
4. **Messages envoyés.** `FUNDS_AVAILABLE` quand les recettes d'un événement terminé sont toutes disponibles (03.22).
5. **Ce que voient les autres rôles.** Rien.
6. **Refus.** 03.18.
7. **Preuves et essai.** Recette : essai 42.

## 08.19 Rapport de clôture : formule de chaque montant

1. **Qui, où.** Pilotage, onglet « Clôture », ou fenêtre « Rapport de clôture » du tableau de bord (04.23,
   `components/partner/pilotage/ClosingReportSummary.tsx:14-52`).
2. **Ce qu'il saisit.** Rien.
3. **Ce que fait le système** (`M/20261110000010_lot9ter_pilotage.sql:767-871`, `:445-490` ;
   `M/20261102000005_lot5_pilotage.sql:1184-1243`) :

   | Montant (texte exact) | Formule |
   |---|---|
   | « Montant net organisateur » — « Ventes en ligne, remboursements déduits » | écritures « Vente en ligne » + « Remboursement » de l'événement au compte de la partenaire (sans régularisations ni retraits) |
   | « Disponibilité des fonds » | première date de disponibilité d'une vente de l'événement ; « jusqu’au {date} pour les dernières ventes » si les dates diffèrent ; « Aucune vente en ligne » sinon |
   | « Recettes en ligne » | **même somme** que « Montant net organisateur » (ventes en ligne moins remboursements en ligne) — constat W7-04 |
   | « Recettes en espèces » | somme des ventes hors plateforme confirmées de l'événement (non diminuée des billets en espèces annulés) |
   | « Remboursé » | remboursements en ligne (débits de la partenaire) + remboursements à régler par l'organisateur (billets en espèces annulés, sauf échoués) |
   | « Frais de service payés par les acheteurs » | frais de service des billets payés en ligne encore « Valable » ou « Utilisé » (billets remboursés exclus) |
   | « Déjà disponible / en attente » | part de « Montant net organisateur » dont la date est passée / à venir |

   Exemple, panier de Fatou seul, un « Standard » remboursé avant la fin : « Montant net organisateur » 17 500 F ;
   « Recettes en ligne » 17 500 F ; « Remboursé » 5 000 F ; « Frais de service payés par les acheteurs » 875 F ; « Déjà
   disponible / en attente » 0 F / 17 500 F.
4. **Messages envoyés.** Aucun.
5. **Ce que voient les autres rôles.** L'administration, par « Ouvrir le pilotage ».
6. **Refus.** 04.23.
7. **Preuves et essai.** Recette : essai 41 (`docs/recette-billetterie.md:1009-1024`).

## 08.20 `/admin/finance` « Rapprochement financier » : chaque chiffre et sa formule

1. **Qui, où.** Tout administrateur voit l'entrée « Finance et rapprochement » ; les chiffres exigent « Consulter les
   paiements » (`payments.read`) ; « Versements à reprendre » exige « Gérer les remboursements »
   (`app/api/admin/finance/reconciliation/route.ts:17-18`, `components/layout/AppLayout.tsx:194`). Titre « Rapprochement
   financier », boutons « Réglages de la plateforme » et « Actualiser » (`app/admin/finance/page.tsx:172-194`).
2. **Ce qu'il saisit.** Filtre « Statut » : « Tous les paiements encaissés » (défaut), « Confirmés », « Partiellement
   remboursés », « Remboursement en cours », « Remboursés » ; période « Tout » (défaut), « 30 jours », « 7 jours »
   (date de début = maintenant − 30 ou 7 jours, sans date de fin) (`app/admin/finance/page.tsx:42-54`, `:119-128`). Le
   filtre de statut ne change que les paiements ; la période s'applique à tout, chaque bloc sur sa propre date.
3. **Ce que fait le système** (`lib/admin/admin.service.ts:120-249`, `lib/admin/finance-reconciliation.ts:76-94`) :
   paiements **en ligne** seulement (les espèces n'y sont jamais), statut « Confirmé », « Remboursé en partie »,
   « Remboursé » ou « Remboursement en cours » pour « Tous », date de **création du paiement** dans la période. Montants
   lus tels qu'enregistrés sur chaque paiement à sa création (jamais recalculés au taux du jour).

   | Chiffre (texte exact) | Aide affichée | Formule |
   |---|---|---|
   | « Volume encaissé » | « {n} paiement(s), frais de service compris » | Σ montant payé (prix + frais de service) des paiements retenus |
   | « Frais de service perçus » | « Payés par les acheteurs, montants enregistrés sur chaque paiement » | Σ frais de service (non diminuée des remboursements, constat W7-01) |
   | « Frais agrégateur (SamirPay) » | « Prélevés sur les frais de service » | Σ frais SamirPay **estimés** (taux du réglage au moment du paiement) |
   | « Revenu net Event Village » | « Frais de service moins frais agrégateur, remboursements déduits » | Σ (revenu net du paiement − part annulée par les remboursements, 08.9) |
   | « Reversements partenaires » | « Prix des billets et prestations dus aux partenaires » | Σ part partenaire enregistrée (prix), **non diminuée** des remboursements (constat W7-01) |
   | « Remboursements versés » | « Remboursements confirmés sur la période » | Σ remboursements **versés par la plateforme** (confirmés), date de création du remboursement dans la période |
   | « Commissions de parrainage » | — | Σ commissions N1 + N2 non annulées des paiements retenus (régularisations négatives comprises) |
   | « Revenu net après parrainage » | — | « Revenu net Event Village » − « Commissions de parrainage » |
   | « Retraits versés » | — | Σ montants **nets** des retraits « Versé », date de la **demande** dans la période (frais de retrait non montrés) |
   | « Écarts de rapprochement » | « {n} anomalie(s) » | nombre de paiements où montant payé ≠ part partenaire + revenu brut, ou revenu brut ≠ revenu net + frais SamirPay |

   **Section « Frais SamirPay »** — « Frais réellement prélevés sur les versements confirmés de la période, comparés à
   l’estimation au taux de retrait réglé. » (`app/admin/finance/page.tsx:263-310`) :

   | Chiffre | Formule |
   |---|---|
   | « Frais réels des versements » — « {n} versement(s) aux frais connus » | Σ frais réels des versements confirmés réels (non simulés) aux frais connus, créés dans la période |
   | « Frais estimés » — « Au taux de retrait réglé : {taux} % » | mêmes versements × taux de retrait **actuel** (remboursements compris, constat W7-03) |
   | « Écart (réels moins estimés) » | réels − estimés ; « Les versements coûtent plus que l’estimation. », « … moins que l’estimation. » ou « Aucun écart. » |
   | Mention des encaissements | « Encaissements : Frais réels non fournis par SamirPay pour ce mode d’encaissement : comparez avec votre tableau de bord SamirPay. » |

   **Tableau « Paiements rapprochés »** — « Contrôle automatique, paiement par paiement : total débité = reversement
   partenaire + frais de service ; frais de service = frais agrégateur + revenu net Event Village. » ; colonnes
   « Référence », « Objet · moyen » (« Billetterie », « Commande », « Salle », « Table », « Abonnement » · « Wave »,
   « Orange Money », « SamirPay »), « Statut », « Total débité », « Prix », « Frais de service » (« {montant} ({taux} %) »),
   « Frais agrégateur », « Net Event Village », « Partenaire », « Remboursé », « Parrainage », « Écart » (« Aucun » ou le
   montant), « Date » ; vide : « Aucun paiement encaissé pour cette période. » (`app/admin/finance/page.tsx:315-465`).
   Montants affichés avec leurs centimes (`lib/format.ts:115-122`).

   **Exemple** (seul paiement : celui de Fatou, un « Standard » remboursé) : « Volume encaissé » 23 625 F ; « Frais de
   service perçus » 1 125 F ; « Frais agrégateur (SamirPay) » 354,38 F ; « Revenu net Event Village » 520,62 F ;
   « Reversements partenaires » 22 500 F ; « Remboursements versés » 5 250 F ; « Écarts de rapprochement » « 0 anomalie ».
4. **Messages envoyés.** Aucun.
5. **Ce que voient les autres rôles.** Rien.
6. **Refus.** Sans « Consulter les paiements » : « Action non autorisée : votre compte n’a pas la permission « Consulter
   les paiements ». » dans « Rapprochement indisponible » ; panne : « Rapprochement financier momentanément
   indisponible. » ; réseau : « Connexion impossible : vérifiez votre réseau puis réessayez. » ; partie frais illisible :
   « Frais SamirPay non disponibles » / « La comparaison des frais n’a pas pu être lue. Actualisez la page. »
   (`app/api/admin/finance/reconciliation/route.ts:41`, `app/admin/finance/page.tsx:130-150`, `:196-206`, `:271-274`).
7. **Preuves et essai.** Recette : essai 56 (`docs/recette-billetterie.md:1274-1289`).

## 08.21 Réglages SUPERADMIN qui touchent l'argent

1. **Qui, où.** SUPERADMIN pour modifier, tout ADMIN pour lire : `/admin/finance-settings`, section « Finance » (« Frais,
   délais de disponibilité des ventes, retraits et commissions. ») ; écran, motif obligatoire et historique : 11.13
   (`app/admin/finance-settings/page.tsx:105-110`).
2. **Ce qu'il saisit.** Nouvelle valeur et motif (11.13).
3. **Ce que fait le système.** La valeur vaut pour les **opérations suivantes** ; taux et délais d'un paiement sont
   recopiés sur lui à sa création (`M/20261101000004_lot3_grand_livre.sql:122-123`).

   | Clé et libellé | Valeur initiale | Bornes | Effet sur l'argent |
   |---|---|---|---|
   | `finance.service_fee_rate` « Frais de service » | 5 % | 0 à 50 | frais par billet, au franc supérieur (06.21) |
   | `finance.aggregator_fee_rate.WAVE` / `.ORANGE_MONEY` « Frais agrégateur Wave / Orange Money » | 1,5 % | 0 à 10 | frais SamirPay estimés d'un encaissement, revenu net Event Village |
   | `finance.cancellation_aggregator_fee_bearer` « Frais agrégateur d’une annulation » (« Qui supporte les frais agrégateur quand un billet est remboursé. ») | Event Village | Event Village / Organisateur | 08.9 (constat W7-11) |
   | `finance.payout_hold_enabled` « Délai de garde des ventes » | Activé | oui / non | désactivé : ventes disponibles dès le paiement |
   | `finance.payout_delay_hours` « Délai après la fin de l’événement » | 48 h | 0 à 720 | disponibilité = fin + délai |
   | `finance.withdrawal_fee_rate` « Frais de retrait » | 1 % | 0 à 10 | 08.16, avertissement 08.15 |
   | `finance.withdrawal_min_amount` « Montant minimum de retrait » | 5 000 F | 0 à 10 000 000 | 08.16 |
   | `finance.withdrawal_bank_enabled` « Retraits par virement bancaire » | Désactivé | oui / non | virement accepté par la base, sans écran (14) |
   | `finance.referral_availability_days` « Délai de validation des commissions » | 7 jours | 7 à 14 | 09 |
   | `finance.payment_hold_minutes` « Durée de garde des places pendant un paiement (minutes) » | 10 | 5 à 60 | 06.9 |
   | `finance.min_paid_price` « Prix minimum d’un billet payant (F CFA) » | 100 | 1 à 100 000 | 06.18 |

   Valeurs initiales : `M/20261101000002_lot3_reglages.sql:61-72`, `M/20261109000001_lot9bis_reglages.sql:33-35` ;
   bornes : `M/20261110000002_lot9ter_reglages.sql:59-100` ; libellés : `app/admin/finance-settings/page.tsx:64-75`.
   `access.counter_sale_enabled` (« Vente au guichet en espèces ») ouvre ou ferme les ventes en espèces (05).
4. **Messages envoyés.** Aucun.
5. **Ce que voient les autres rôles.** L'effet, à la prochaine opération.
6. **Refus.** 11.13.
7. **Preuves et essai.** Recette : essai 52. **NON VÉRIFIÉ** : valeurs actuelles sur event-village-dev (lecture de base
   interdite).

## 08.22 Récapitulatif des messages liés à l'argent

| Type | Destinataire | Canaux | Déclencheur | Scénario |
|---|---|---|---|---|
| `REFUND_REQUESTED` | payeur | cloche, email | remboursement d'un billet créé | 08.1 |
| `REFUND_PAID` | payeur (ou numéro du versement) | SMS, cloche, email, push | remboursement confirmé | 08.1, 08.7 |
| `REFUND_DELAYED` | payeur | SMS, cloche, email, push | bloqué, refusé, incertain, ou 30 min ; un par versement | 08.10 |
| `PAYMENT_REFUND_STARTED` | payeur | SMS, cloche, email, push | paiement sans billet ou en double | 06.16, 06.17 |
| `TICKET_CANCELLED` | porteur ou numéro invité | cloche, SMS, email | billet gratuit, invitation ou espèces annulé hors annulation | 08.2, 08.3 |
| `TICKET_REFUNDED_HOLDER` | porteur actuel d'un billet reçu | SMS, cloche, push, email | billet remboursé à l'acheteur d'origine | 08.5 |
| `TRANSFER_REVOKED` | destinataire d'un transfert en attente | SMS ; cloche, push, email | remboursement pendant le transfert | 08.5 |
| `CANCEL_REFUNDS_BLOCKED`, `CANCEL_REFUNDS_DONE` | partenaire | cloche, email, push | remboursements d'une annulation bloqués / tous versés | 08.7 |
| `WITHDRAWAL_PAID`, `_REJECTED`, `_UNCERTAIN`, `_DELAYED` | partenaire ou parrain | SMS, cloche, email, push | issue d'un retrait | 03.21, 08.16 |
| `FUNDS_AVAILABLE` | partenaire | cloche, email | recettes d'un événement terminé disponibles | 03.22 |
| `ADMIN_REFUND_TO_RETRY`, `ADMIN_CASHOUT_TO_RESUME`, `ADMIN_CASHOUT_UNCERTAIN`, `ADMIN_DUPLICATE_PAYMENT` | admins « Gérer les remboursements », SUPERADMIN | cloche, push, email | 08.10, 06.17 | 08.10 |
| `ADMIN_WITHDRAWAL_REJECTED` | mêmes | cloche, email | retrait échoué | 08.10 |
| `ADMIN_FINANCE_DEBT` | admins « Consulter les paiements », SUPERADMIN | cloche, email | créance créée | 08.9 |

Canaux : `lib/notifications/catalog.ts` aux lignes 852, 858, 979, 986, 993, 1000, 1006, 1204, 1219, 1225, 1231, 1237, 1314,
1331, 1342, 1365, 1440, 1555, 1634, 1642. Tous sont indispensables (aucun sujet de préférence). Heures calmes, file et
plafonds : `10-notifications.md`.

---

## NON VÉRIFIÉ (récapitulatif)

- Frais réels de SamirPay sur un transfert, et comportement réel de SamirPay sur « hors limites » et « solde
  insuffisant » (lecture du code et du faux SamirPay seulement).
- Valeurs actuelles des réglages `finance.*` sur event-village-dev.
- Exemples chiffrés : calculés à la main depuis les formules du code, non exécutés.
- Remboursement individuel d'un billet en espèces suivi d'une annulation de l'événement (constat W7-06) : déduit du code,
  non exécuté.

## Essais du cahier de recette liés à ce fichier

14, 41, 42, 43, 44, 45, 46, 52, 56, 58, 59, 60, 70, 75, 83, 84, 87.
