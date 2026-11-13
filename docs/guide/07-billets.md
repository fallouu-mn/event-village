# 07 — Billets : Mes billets, QR tournant, PDF, hors ligne, transferts, invitations, client suspendu

> Guide complet de l'application Event Village, état de `main` à `0889df6` (lots 1 à 9 ter). Source de vérité : le code.
> Chaque fait porte sa preuve `fichier:ligne` (chemins relatifs au dépôt ; `M/` = `supabase/migrations/`).
> Ce qui n'a pas pu être établi est marqué **NON VÉRIFIÉ**. Données d'exemple fictives : cliente « Fatou Diop »
> (numéro `77 000 00 00`), son amie « Awa Ndiaye » (numéro `77 000 00 01`), événement « Concert Test »
> (samedi 5 décembre 2026 à 20:00), catégories « Standard », « VIP ».
> L'achat est dans `06-achat-paiement.md` ; le contrôle à l'entrée (scanner, saisie manuelle, liste des invités) dans
> `05-equipe-controle-acces.md` ; les remboursements dans `08-argent.md` ; le remboursement après un report dans
> `04-evenement-cycle.md` (04.14) ; les messages dans `10-notifications.md`. Écarts : `15-constats.md` (W6-xx).

## Sommaire

| N° | Scénario |
|---|---|
| 07.1 | Mes billets : accès, onglets, mise à jour en direct |
| 07.2 | La carte d'un billet : informations, statuts, prix, bandeaux |
| 07.3 | Le QR tournant (20 secondes) et ce qui l'empêche |
| 07.4 | Le billet en PDF |
| 07.5 | Le billet hors ligne : enregistrement, page `/billet/hors-ligne`, états |
| 07.6 | Transférer un billet (envoi) |
| 07.7 | Recevoir un billet transféré : onglet « Reçus », numéro à confirmer, accepter |
| 07.8 | Refuser un billet reçu |
| 07.9 | Annuler un transfert (expéditrice) |
| 07.10 | Transfert non accepté en 48 h : expiration |
| 07.11 | Le destinataire change de numéro pendant le transfert |
| 07.12 | Transfert puis remboursement (transfert en attente, ou déjà accepté) |
| 07.13 | Invitations : envoi par la partenaire, nom de l'invité |
| 07.14 | Invitation reçue par un numéro qui a un compte vérifié |
| 07.15 | Invitation reçue par un numéro sans compte : réclamation après inscription |
| 07.16 | Modifier le nom d'un invité |
| 07.17 | Annuler une invitation ; invitation refusée par l'invité |
| 07.18 | Billet d'un client suspendu |

Règles communes à tout le fichier :

- **Statuts d'un billet** (`lib/tickets/ticket-status.ts:23-49`) : `VALIDE` « Valable » (« Billet valable : présentez son
  code d’entrée au contrôle. »), `UTILISE` « Utilisé » (« Ce billet a déjà été contrôlé à l’entrée. »), `ANNULE`
  « Annulé » (« Ce billet est annulé : il ne donne plus accès à l’événement. »), `REMBOURSE` « Remboursé » (« Ce billet a
  été remboursé : il ne donne plus accès à l’événement. »), `REMBOURSEMENT_EN_COURS` « Remboursement en cours » (« Le
  remboursement de ce billet est en cours : vous serez prévenu dès le versement. »). Valeur inconnue : « Statut
  inconnu ».
- **Origine d'un billet** (canal) : en ligne (payé ou panier mixte), gratuit (`FREE`), guichet (`COUNTER`), invitation
  (`INVITATION`) (`M/20261102000002_lot5_dette.sql:38-51`).
- **Le serveur décide de ce que la carte montre** : QR seulement si le contrôle l'accepterait, « Transférer » seulement
  si le transfert est permis (`M/20261109000008_lot9bis_cycle.sql:1789-1830`, `app/api/tickets/route.ts:148-157`).
- **Transfert** = vers un **numéro de téléphone sénégalais** seulement, gratuit, 48 h pour accepter, sans lien ni jeton ;
  l'ancien lien de réclamation `/tickets/claim/{jeton}` renvoie vers « Reçus » et la route répond « Ce lien n'est plus
  utilisé. Connectez-vous avec le numéro auquel le billet a été envoyé, puis ouvrez « Mes billets ». »
  (`app/tickets/claim/[token]/page.tsx:1-13`, `app/api/tickets/claim/[token]/route.ts:13-36`).

---

## 07.1 Mes billets : accès, onglets, mise à jour en direct

1. **Qui, où.** Client connecté, compte actif : menu « Mes billets » → `/tickets` (01.2). Non connecté : renvoi à la
   connexion (`middleware.ts:170-186`) ; la page dit aussi « Connectez-vous pour voir vos billets » / « Vos billets
   électroniques et leur QR code d’entrée sont liés à votre compte. » + « Se connecter » (`app/tickets/page.tsx:259-271`).
2. **Ce qu'il saisit.** Les onglets et boutons :
   - en-tête « Mes billets » / « Présentez le QR code de votre billet à l’entrée. Il se renouvelle tout seul : gardez la
     page ouverte. », indicateur « En direct », boutons « Afficher mes billets hors ligne », « Comment marche le
     transfert ? », « Réserver un billet » (`app/tickets/page.tsx:277-295`) ;
   - onglets « À venir » (billets valables d'un événement pas encore fini), « Tous mes billets », « Historique »
     (utilisés, remboursés, annulés ou événement passé), « Reçus » (billets transférés ou invitations à accepter, avec
     leur nombre) (`:75`, `:246-257`). L'onglet est dans l'adresse (`?tab=a-venir`, `tous`, `historique`, `recus`). Au
     premier chargement, si un billet attend dans « Reçus » et qu'aucun onglet n'est demandé, « Reçus » s'ouvre
     (`:186-205`).
   - « Comment marche le transfert ? » ouvre « Comment marche le transfert ? » / « Donnez un billet à un proche en
     trois étapes. » : « Indiquez le destinataire », « Il est prévenu par SMS », « Le billet est à lui », « Capture
     d’écran : refusée », « Transfert : accepté », foire aux questions, « J’ai compris »
     (`components/tickets/TransferExplainerModal.tsx:23-45`, `:66-135`).
3. **Ce que fait le système.**
   - Liste lue sur le serveur (billets du compte de la session seulement), du plus récent au plus ancien ; un transfert
     échu pas encore traité par la tâche horaire est expiré à la lecture (`app/api/tickets/route.ts:37-84`).
   - « À venir » : billet valable et événement pas fini (fin saisie, sinon début + 6 h) (`app/api/tickets/route.ts:204-206`).
   - **Direct** : abonnement aux billets du compte et à ses nouvelles notifications ; émission, contrôle, transfert,
     remboursement relisent la liste sans recharger (`app/tickets/page.tsx:217-226`). Relecture ratée : « Vos billets
     n’ont pas pu être mis à jour » / « {message} Les billets affichés sont ceux du dernier chargement ; le QR code reste
     valable. » + « Réessayer » (`:318-331`).
   - Après chaque chargement, les billets enregistrés hors ligne sont confrontés à la liste (billet disparu, transféré,
     composté ou d'une autre version : copie locale supprimée) (`:180-184`).
   - Vides : « Aucun billet à venir » / « Vos prochains billets apparaîtront ici dès l’achat, sans recharger la page. » ;
     « Vous n’avez encore aucun billet » / « Choisissez un événement dans le catalogue : votre billet arrive ici aussitôt
     payé. » ; « Aucun billet dans l’historique » / « Les billets utilisés, remboursés ou d’événements passés
     apparaîtront ici. » ; bouton « Explorer les événements » (`:79-92`, `:392-400`).
4. **Messages envoyés.** Aucun.
5. **Ce que voient les autres rôles.** Rien de cette page.
6. **Refus.** Erreur : « Impossible d’afficher vos billets » + « Connexion impossible : vérifiez votre réseau, puis
   réessayez. » ou « Impossible de charger vos billets. » ; autre compte demandé : « Vous ne pouvez consulter que vos
   propres billets. » ; compte non actif : « Votre compte n'est pas actif. Contactez le support. »
   (`app/tickets/page.tsx:94`, `:338-344`, `app/api/tickets/route.ts:43-47`, `:86-89`, `lib/auth/session.ts:56-63`).
7. **Preuves et essai.** Fichiers cités. Recette : essais 16, 24 (`docs/recette-billetterie.md:592-609`, `:724-739`).

## 07.2 La carte d'un billet : informations, statuts, prix, bandeaux

1. **Qui, où.** Le porteur, dans Mes billets (07.1).
2. **Ce qu'il saisit.** Les boutons de la carte : « Transférer » (07.6), « WhatsApp », « Lien », « PDF » (07.4), « Aide
   au transfert » (`components/tickets/TicketCard.tsx:718-774`).
3. **Ce que fait le système.**
   - **En-tête** : affiche de l'événement, pastille du statut du billet (ou « Transfert en attente »), pastille du statut
     de l'événement s'il n'est pas Publié ; titre, organisateur (`TicketCard.tsx:483-511`).
   - **Infos** : « Date » (ex. « 05 DÉC 2026 »), « Heure d’accès » (heure de début ; « 20:00 » si aucune n'est
     enregistrée, constat W6-11), « Lieu », « Catégorie », « Prix » (« Invitation » pour une invitation, « Gratuit »
     pour 0, sinon le montant), « Frais de service » (si plus de 0) (`TicketCard.tsx:520-551`,
     `app/api/tickets/route.ts:195-238`).
   - **Bandeaux** : « Remboursement retardé, l’équipe Event Village s’en occupe. » quand un remboursement attend l'équipe
     (`TicketCard.tsx:553-555`) ; après un report de plus de 24 h, « L’événement a été reporté de plus de 24 h :
     remboursement total possible ({montant}, frais de service compris) jusqu’au {date et heure}. » + « Me faire
     rembourser » (scénario 04.14) (`:556-565`).
   - **Zone du code** selon l'état (`TicketCard.tsx:569-714`) : transfert en cours (07.6) ; événement suspendu ou
     terminé : le texte du serveur à la place du QR, « Événement suspendu : l’entrée n’est pas possible pour le
     moment. » ou « Événement terminé. » (`M/20261109000008_lot9bis_cycle.sql:1811-1815`) ; billet valable : QR (07.3) ;
     billet utilisé : « Ce billet a déjà été contrôlé à l’entrée. » et « Contrôlé le {date et heure} » ; autre statut :
     sa phrase (règle commune).
   - **Partage** : « WhatsApp » et « Lien » ne partagent que l'adresse de l'événement, jamais le numéro du billet :
     message « {titre} sur Event Village : {adresse}/events/{id} » ; toasts « Lien de l’événement copié. » ou « Copie
     impossible sur cet appareil. » (`TicketCard.tsx:350-374`).
4. **Messages envoyés.** Aucun.
5. **Ce que voient les autres rôles.** Rien.
6. **Refus.** Voir 07.3, 07.4.
7. **Preuves et essai.** Fichiers cités. Recette : essai 24 (`docs/recette-billetterie.md:724-739`).

## 07.3 Le QR tournant (20 secondes) et ce qui l'empêche

1. **Qui, où.** Le porteur d'un billet valable, sur sa carte (07.2), le jour du contrôle.
2. **Ce qu'il saisit.** Rien : il présente l'écran.
3. **Ce que fait le système.**
   - Le QR contient « EVT1:{identifiant du billet}:{code à 6 chiffres} » ; le code change toutes les **20 secondes** ;
     le téléphone redemande le code au serveur juste après chaque changement ; aucun QR fixe n'existe
     (`app/api/tickets/[id]/live-code/route.ts:12-21`, `:60-65`, `lib/security/totp.ts:14`,
     `components/tickets/TicketCard.tsx:244-326`). Sous le QR : numéro du billet, « Code renouvelé toutes les 20 s »
     et le compte à rebours, « Une capture d’écran n’est pas acceptée au contrôle. », « Sans téléphone : numéro du
     billet et pièce d’identité au contrôle. », « Billet authentique, émis par Event Village », « Présentez ce code au
     contrôle, billet ouvert dans l’application. » (`TicketCard.tsx:629-697`).
   - Le contrôle accepte le code du pas voisin ; au-delà, le QR n'est plus affiché (`TicketCard.tsx:339-341`).
   - **Réseau coupé** : si le billet est enregistré sur le téléphone (07.5), le QR est calculé localement à l'heure du
     serveur : « Hors connexion : billet enregistré », « Code calculé sur ce téléphone, renouvelé toutes les 20 s. Une
     capture d’écran n’est pas acceptée. » ; sinon « Connexion requise pour afficher le code d’entrée. » et « Le code
     s’affichera dès le retour du réseau. Une capture d’écran n’est pas acceptée. » ; nouvel essai toutes les 5 secondes
     (`TicketCard.tsx:115`, `:291-299`, `:328-345`, `:611-664`).
   - Quota : 60 codes par minute et par compte ; au-delà, la carte attend le délai indiqué (`app/api/tickets/[id]/live-code/route.ts:28-32`,
     `lib/env.ts:83`, `TicketCard.tsx:287-290`).
   - Après un transfert accepté, le billet reçoit un **nouveau numéro, un nouveau QR et un nouveau secret** : l'ancien
     code de l'expéditrice ne sert plus (`M/20261105000003_lot7_securite.sql:363-400`).
4. **Messages envoyés.** Aucun (au contrôle : `TICKET_SCANNED`, 05 et 10).
5. **Ce que voient les autres rôles.** Le contrôleur lit le QR (05).
6. **Refus (texte exact).** Billet plus valable, transféré ou annulé : « Ce billet n’a plus de code d’entrée. Actualisez
   la page. » ; côté serveur : « Ce billet n’est plus valable à l’entrée. », « Événement suspendu : l’entrée n’est pas
   possible pour le moment. », « Événement annulé : ce billet n’est plus valable à l’entrée. », « Ce billet est en cours
   de transfert. », « Billet introuvable. » (billet d'un autre compte, même réponse), « Trop de demandes : patientez
   quelques secondes. », « Code momentanément indisponible. » (`app/api/tickets/[id]/live-code/route.ts:26-59`,
   `TicketCard.tsx:281-286`).
7. **Preuves et essai.** Fichiers cités. Recette : essais 24, 28 (`docs/recette-billetterie.md:724-739`, `:790-804`).

## 07.4 Le billet en PDF

1. **Qui, où.** Le porteur, bouton « PDF » de la carte (grisé si le code n'est pas présentable ou si un transfert est en
   cours) ; un administrateur peut aussi obtenir le PDF d'un billet (`components/tickets/TicketCard.tsx:752-762`,
   `app/api/tickets/[id]/pdf/route.ts:51-54`).
2. **Ce qu'il saisit.** Rien.
3. **Ce que fait le système.**
   - Fichier « Billet-EventVillage-{numéro}.pdf » (ex. « Billet-EventVillage-TCK-20261113-3F9A1C7E2B.pdf ») ; toast
     « Billet PDF téléchargé. » ; bouton « Génération… » pendant le calcul (`TicketCard.tsx:376-418`).
   - **Aucun QR dans le PDF** : il porte « EVENT VILLAGE », « BILLET OFFICIEL D’ACCÈS -- BILLETTERIE SÉCURISÉE »,
     « STATUT : VALABLE », titre, « Organisé par : {organisateur} », « DATE DE L’ÉVÉNEMENT », « HEURE D’ACCÈS », « LIEU
     ET SALLE », « CATÉGORIE », « TITULAIRE DU BILLET », « PRIX DU BILLET » (montant « {n} FCFA » ou « Gratuit »), pour
     un billet payant « Frais de service : {frais} FCFA - Total payé :{total} FCFA », « NUMÉRO DE BILLET : {numéro} »,
     encadré « ACCÈS AU CONTRÔLE » : « Avec votre téléphone », « Ouvrez le billet dans l’application Event Village et
     présentez le QR dynamique, », « renouvelé toutes les 20 secondes. Une capture d’écran n’est pas acceptée. »,
     « Entrée sans téléphone : présentez une pièce d’identité au contrôle », « Le contrôleur saisit ce numéro et vérifie
     la pièce au nom du titulaire : », le numéro en gros, « Aucun QR code sur ce document : imprimé ou photographié, il ne
     suffit pas pour entrer. », « Titulaire : {nom} », pied « Billet nominatif : QR dynamique de l’application ou pièce
     d’identité du titulaire au contrôle. » et « Event Village Sénégal -- Plateforme officielle de billetterie --
     {email du support} » (`app/api/tickets/[id]/pdf/route.ts:104-138`, `lib/tickets/ticket-pdf.service.ts:73-215`).
   - Titulaire : prénom et nom du compte, à défaut son numéro ou son email.
   - Une invitation est imprimée « Gratuit » (la carte dit « Invitation ») ; « Total payé :» sans espace après les
     deux-points (constat W6-05).
4. **Messages envoyés.** Aucun.
5. **Ce que voient les autres rôles.** Rien.
6. **Refus (texte exact).** Écran : billet non valable → sa phrase de statut ; événement suspendu ou terminé → le texte du
   serveur (07.2) ou « Le billet n’est pas présentable à l’entrée pour le moment. » ; transfert en cours : « Ce billet
   est en cours de transfert : le PDF sera disponible si le transfert est annulé. » ; échec : « Le billet PDF n’a pas pu
   être généré. Réessayez dans un instant. » ; réseau : « Connexion impossible : le PDF n’a pas été téléchargé. Vérifiez
   votre réseau, puis réessayez. » (`TicketCard.tsx:376-418`). Serveur : « Billet introuvable. », « Accès refusé. Vous
   n’êtes pas le propriétaire de ce billet. », « Ce billet n'est plus valide et ne peut pas être téléchargé. », « Ce
   billet est actuellement engagé dans un transfert en attente et son accès est verrouillé. », « Billet momentanément
   indisponible : réessayez dans un instant. » (`app/api/tickets/[id]/pdf/route.ts:10`, `:49-63`, `:151-157`). Le
   serveur ne contrôle pas le statut de l'événement : seul l'écran grise le bouton (constat W6-06).
7. **Preuves et essai.** Fichiers cités. Recette : essai 23 (`docs/recette-billetterie.md:706-721`).

## 07.5 Le billet hors ligne : enregistrement, page `/billet/hors-ligne`, états

1. **Qui, où.** Le porteur d'un billet valable, téléphone **avec du réseau** avant d'arriver. Bouton « Afficher mes
   billets hors ligne » (Mes billets) ou « Afficher ce billet hors ligne » (carte) → `/billet/hors-ligne?id={billet}`,
   page publique servie même sans réseau (`app/tickets/page.tsx:283-286`, `components/tickets/TicketCard.tsx:671-688`,
   `middleware.ts:27`).
2. **Ce qu'il saisit.** Rien : l'enregistrement est automatique.
3. **Ce que fait le système.**
   - **Fenêtre** : codes téléchargeables de **24 h avant le début** jusqu'à la fin du contrôle (fin de l'événement + le
     réglage « Fermeture du contrôle après la fin ») ; chaque téléchargement couvre au plus 48 h de codes de 20 s
     (`M/20261105000004_lot7_billet_hors_ligne.sql:238-271`, `:357-381`). Conditions : billet valable, événement Publié,
     aucun transfert en cours (`:344-355`). Quota : 12 téléchargements par heure et par billet, 60 par compte
     (`lib/tickets/offline-codes.service.ts:105-119`, `lib/env.ts:100-101`).
   - **Quand** : à l'ouverture de l'application (compte client), à chaque retour du réseau, et à l'affichage de la carte
     quand le serveur dit le billet disponible (`components/tickets/OfflineTicketsSync.tsx:1-17`,
     `TicketCard.tsx:208-242`). Les codes sont calculés par le serveur ; le secret du billet ne quitte jamais le serveur ;
     le lot est gardé dans le téléphone (`lib/tickets/offline-codes.service.ts:1-12`).
   - **Indicateur de la carte** (`components/tickets/offline/OfflineStatusBadge.tsx:41-57`,
     `lib/tickets/offline-clock.ts:172-188`) : « Disponible hors ligne » ; « Enregistrement du billet sur ce
     téléphone… » ; « Ouvrez ce billet avec du réseau avant d’arriver » ; « Disponible hors ligne à partir du {date et
     heure} » (ex. « Disponible hors ligne à partir du ven. 4 déc. 2026 à 20:00 ») ou « Disponible hors ligne la veille
     de l’événement » ; « Ce billet n’est pas enregistré sur ce téléphone. Reconnectez-vous au réseau, ou présentez votre
     numéro de billet et votre pièce d’identité au contrôle. » ; « Codes expirés : ouvrez le billet avec du réseau ».
   - **Page hors ligne** : « Billet hors ligne » / « Le billet enregistré sur ce téléphone s’affiche ici, même sans
     réseau. Présentez son QR au contrôle dès qu’il apparaît. » ; QR calculé à l'heure du serveur ; « Autres billets
     enregistrés sur ce téléphone » ; billet absent : « Pour l’avoir sans réseau, ouvrez Mes billets avec du réseau avant
     d’arriver : le billet s’enregistre tout seul sur ce téléphone, dès la veille de l’événement. » ; heure du téléphone
     reculée : « L’heure de ce téléphone a reculé depuis l’enregistrement du billet : le code ne peut plus être calculé.
     Remettez l’heure automatique, ou ouvrez le billet avec du réseau. » ; conseil iPhone : « Sur iPhone, ouvrez Event
     Village depuis son icône de l’écran d’accueil, avec du réseau, avant d’arriver : le billet y reste disponible sans
     réseau. » (`app/billet/hors-ligne/page.tsx:93-160`, `components/tickets/offline/OfflineTicketView.tsx:150-182`).
   - **Effacement** : copies locales supprimées à la déconnexion et à la connexion d'un autre compte sur le même
     téléphone (`components/providers/AuthProvider.tsx:173-185`), au transfert (07.6), et quand le billet change
     (07.1).
4. **Messages envoyés.** Aucun. Les avis de confirmation et de rappel H-3 conseillent d'ouvrir le billet avec du
   réseau avant d'arriver (`lib/notifications/catalog.ts:582-585`, 10).
5. **Ce que voient les autres rôles.** Le contrôleur lit ce QR comme un QR en ligne (05).
6. **Refus (texte exact).** Navigateur sans stockage : « Stockage hors ligne indisponible sur ce téléphone. » / « Ce
   navigateur ne permet pas de garder le billet sur le téléphone (navigation privée, stockage effacé ou plein). »
   (`lib/tickets/offline-store.ts:28`, `app/billet/hors-ligne/page.tsx:109-116`) ; serveur : « Les codes hors ligne sont
   disponibles de 24 h avant le début de l'événement jusqu'à la fin du contrôle des entrées. », « Cet événement n'est
   pas ouvert : les codes hors ligne ne sont pas disponibles. », « Ce billet est en cours de transfert : les codes hors
   ligne ne sont pas disponibles. », « Trop de téléchargements des codes hors ligne : réessayez plus tard. »
   (`M/20261105000004_lot7_billet_hors_ligne.sql:344-372`, `lib/tickets/offline-codes.service.ts:110-119`).
7. **Preuves et essai.** Fichiers cités. Recette : essais 25, 26, 32 (`docs/recette-billetterie.md:740-772`, `:856-870`).

## 07.6 Transférer un billet (envoi)

1. **Qui, où.** Le porteur d'un billet valable, non composté, sans transfert en cours, événement Publié (ou Validé) et
   pas fini : bouton « Transférer » de la carte (`M/20261109000008_lot9bis_cycle.sql:1820-1822`,
   `components/tickets/TicketCard.tsx:720-730`). Fenêtre « Transférer ce billet », sous-titre « Billet {numéro} ·
   {catégorie} » (`components/tickets/TransferModal.tsx:233-240`).
2. **Ce qu'il saisit.** « Numéro de téléphone du destinataire » (obligatoire, exemple « 77 123 45 67 »), aide « Le
   destinataire recevra un SMS. Il devra se connecter avec ce numéro pour accepter le billet sous 48 h. » ; encadré
   « Transfert gratuit » ; « Ce qui se passe ensuite » : « Dès l’acceptation, un nouveau QR code est créé pour votre
   proche ; le vôtre ne sert plus. », « Sans acceptation sous 48 h, le billet vous revient automatiquement. », « Vous
   pouvez annuler le transfert tant qu’il n’est pas accepté. » ; boutons « Annuler » et « Envoyer le billet ». Erreurs de
   l'écran : « Saisissez le numéro de téléphone du destinataire. », « Numéro invalide : saisissez un numéro de téléphone
   (par exemple 77 123 45 67). » (`components/tickets/TransferModal.tsx:61`, `:124-136`, `:186-210`, `:276-320`).
   **Mot de passe redemandé** s'il n'a pas été saisi depuis 10 minutes sur cette session : la boîte de mot de passe
   s'ouvre (« Le billet sera envoyé juste après. »), puis le même transfert repart une fois ; fermée sans mot de passe :
   « Transfert interrompu : votre mot de passe est demandé pour continuer. » (`app/api/tickets/[id]/transfer/route.ts:28-33`,
   02.10).
3. **Ce que fait le système** (`M/20261109000008_lot9bis_cycle.sql:1406-1512`, `lib/tickets/ticket-transfer.service.ts:184-219`) :
   - numéro normalisé en +221 ; un email est refusé ; échéance = maintenant + **48 h** ;
   - dans une seule transaction : transfert « en attente », **billet verrouillé** (plus de QR, plus de PDF, plus de
     transfert), offre au destinataire mise en file ;
   - la copie hors ligne du billet est supprimée du téléphone de l'expéditrice (`components/tickets/TransferModal.tsx:174-179`).
   - Écran : toast « Transfert lancé vers {numéro} », ex. « Transfert lancé vers +221770000001. » ; bandeau « Transfert
     lancé » / « Le billet est réservé pour le numéro {numéro}, qui va recevoir un SMS. », « À accepter avant {date et
     heure} », « Votre billet » « Verrouillé jusqu’à l’acceptation », « S’il n’est pas accepté sous 48 h, le billet vous
     revient automatiquement. Vous pouvez annuler le transfert depuis la carte du billet tant qu’il n’est pas accepté. »,
     boutons « Prévenir mon proche » (message prêt à partager : « Je vous ai transféré un billet pour « {titre} » sur
     Event Village. Connectez-vous avec votre numéro, puis ouvrez Mes billets, onglet Reçus, pour l'accepter sous 48 h :
     {adresse}/tickets?tab=recus ») et « Terminer ».
   - La carte affiche « Transfert en attente », « Transfert en cours vers {numéro masqué} » (ex. « +221***01 »), « Le code
     d’entrée est suspendu. Dès que le destinataire accepte le billet, il lui appartient. » et « Annuler le transfert »
     (`components/tickets/TicketCard.tsx:569-593`, `app/api/tickets/route.ts:109-124`).
   - L'échéance de 48 h ne tient pas compte du début de l'événement : un transfert lancé 2 h avant le début laisse le
     billet verrouillé jusqu'à l'acceptation ou l'annulation (constat W6-08).
4. **Messages envoyés.**

   | Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
   |---|---|---|---|---|
   | Numéro du destinataire (compté sur le quota SMS de l'expéditrice) | SMS | Indispensable | File d'attente, minute suivante | `TRANSFER_OFFERED` : « Event Village : un billet {titre, 20 car.} vous est transféré. Connectez-vous avec ce numéro avant le {date courte} : {adresse}/tickets » — ex. « Event Village : un billet Concert Test vous est transféré. Connectez-vous avec ce numéro avant le 15 nov. à 18:30 : https://app.exemple.sn/tickets » (146 caractères, 1 segment) |
   | Compte dont le numéro vérifié est la cible | Cloche, push, email | Indispensable (bloqué si ce compte est suspendu) | Idem | « Un billet vous est transféré » / « Un billet pour « Concert Test » vous attend. Acceptez-le avant le dim. 15 nov. 2026 à 18:30. » (lien « Reçus ») |

   Preuves : `lib/notifications/catalog.ts:708-717`, `M/20261109000008_lot9bis_cycle.sql:1482-1502`.
5. **Ce que voient les autres rôles.** Le destinataire : 07.7. La partenaire : rien (le billet reste vendu).
6. **Refus (texte exact).** « Le billet se transfère vers un numéro de téléphone. », « Numéro de téléphone du
   destinataire invalide. », « Vous ne pouvez pas transférer un billet à votre propre numéro. », « Vous n'êtes pas le
   porteur de ce billet. », « Seul un billet valide peut être transféré. », « Ce billet a déjà servi à l'entrée. », « Cet
   événement n'accepte plus les transferts de billets. », « Ce billet est déjà engagé dans un transfert en attente. »,
   « Billet introuvable. », « Transfert momentanément impossible. Réessayez. » ; réseau : « Connexion impossible :
   vérifiez votre réseau, puis réessayez. » (`M/20261109000008_lot9bis_cycle.sql:1424-1473`,
   `app/api/tickets/[id]/transfer/route.ts:47-86`).
7. **Preuves et essai.** Fichiers cités. Recette : essai 27 (`docs/recette-billetterie.md:773-789`).

## 07.7 Recevoir un billet transféré : onglet « Reçus », numéro à confirmer, accepter

1. **Qui, où.** Awa, connectée avec le numéro visé, Mes billets → « Reçus » (lien du SMS : `/tickets`, qui ouvre
   « Reçus » quand un billet attend) (07.1).
2. **Ce qu'il saisit.**
   - Si son numéro n'a jamais été confirmé par un code SMS : bandeau « Un billet vous attend peut-être. Confirmez votre
     numéro pour le voir. » / « Par sécurité, un billet transféré ne s’affiche qu’après la confirmation de votre numéro
     par un code SMS. », bouton « Confirmer mon numéro » → fenêtre « Confirmer mon numéro » / « Un code par SMS prouve
     que ce numéro est bien le vôtre. » ; après le code : « Numéro confirmé. Les billets qui vous attendent s’affichent
     maintenant. » (`components/tickets/IncomingTransfers.tsx:210-222`, `:390`, `components/tickets/PhoneVerifyDialog.tsx:155-172`).
   - Chaque billet : « Envoyé par {prénom} {initiale}. » (ex. « Envoyé par Fatou D. »), événement, lieu, « {catégorie} ·
     {prix} » (ou « · Gratuit »), « À accepter avant le {date et heure} » ; boutons « Accepter le billet » et
     « Refuser » ; confirmation « Accepter ce billet ? » / « Le billet pour « {titre} » rejoint vos billets avec un nouveau
     QR code. L’expéditeur est prévenu et ne peut plus l’utiliser. » (`components/tickets/IncomingTransfers.tsx:257-367`,
     `M/20261110000008_lot9ter_invites.sql:706-714`).
3. **Ce que fait le système** (`M/20261110000008_lot9ter_invites.sql:527-664`) :
   - identité : le compte connecté doit être actif et avoir **ce numéro, vérifié par code** ; sinon le transfert est
     invisible (`M/20261103000002_lot6_outbox.sql:446-460`) ;
   - transfert encore en attente, non échu, événement Publié ou Validé ;
   - le billet passe au compte d'Awa avec un **nouveau numéro, un nouveau QR et un nouveau secret** ; l'ancien code de
     Fatou ne sert plus (`M/20261105000003_lot7_securite.sql:363-400`) ;
   - les rappels en attente de Fatou pour cet événement sont annulés si elle n'y a plus de billet valable.
   - Toast « Billet ajouté à vos billets. » (`app/api/tickets/transfers/[id]/claim/route.ts:25`).
4. **Messages envoyés.**

   | Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
   |---|---|---|---|---|
   | Expéditrice (Fatou) | Cloche, push, email | Indispensable | File d'attente | `TRANSFER_CLAIMED_SENDER` : « Billet accepté » / « Votre billet pour « Concert Test » a été accepté par son destinataire. » |
   | Destinataire (Awa) | Cloche, push, email | Indispensable | Idem | `TRANSFER_RECEIVED` : « Billet reçu » / « Le billet {nouveau numéro} pour « {titre} » du {date et heure} est ajouté à Mes billets. » — ex. « Le billet TCK-20261113-9E4B1C7A2F pour « Concert Test » du sam. 5 déc. 2026 à 20:00 est ajouté à Mes billets. » ; email avec catégorie et numéro |

   Aucun SMS. Preuves : `lib/notifications/catalog.ts:731-762`, `M/20261110000008_lot9ter_invites.sql:634-649`.
5. **Ce que voient les autres rôles.** Fatou : le billet disparaît de ses billets (en direct) ; sa copie hors ligne est
   supprimée à la relecture. La partenaire : le titulaire change dans l'export des participants (04.23).
6. **Refus (texte exact).** « Confirmez d'abord votre numéro par un code SMS. » (la fenêtre de confirmation s'ouvre),
   « Ce transfert est introuvable. » (y compris pour un autre compte), « Ce transfert n'est plus en attente. », « Ce
   billet ne peut plus être accepté : le délai est dépassé. », « Vous êtes déjà le propriétaire de ce billet. »,
   « L’expéditeur n’est plus le propriétaire de ce billet. », « Ce billet n’est plus transférable. », « Cet événement
   n’accepte plus de transfert. », « Acceptation du billet momentanément impossible. Réessayez. » ; écran : « Action
   non effectuée » (`lib/tickets/ticket-transfer.service.ts:154-170`, `app/api/tickets/transfers/[id]/claim/route.ts:26-33`,
   `components/tickets/IncomingTransfers.tsx:175-205`).
7. **Preuves et essai.** Fichiers cités. Recette : essai 27 (`docs/recette-billetterie.md:773-789`).

## 07.8 Refuser un billet reçu

1. **Qui, où.** Awa, onglet « Reçus », bouton « Refuser » ; confirmation « Refuser ce billet ? » / « Le billet pour
   « {titre} » reste à son expéditeur, qui est prévenu. Vous ne pourrez plus l’accepter. », bouton « Refuser le billet »
   (`components/tickets/IncomingTransfers.tsx:373-382`).
2. **Ce qu'il saisit.** La confirmation.
3. **Ce que fait le système.** Transfert « refusé », billet déverrouillé et rendu à Fatou (son QR revient) ; toast
   « Billet refusé : il reste à son expéditeur. » (`M/20261109000008_lot9bis_cycle.sql:1319-1403`,
   `app/api/tickets/transfers/[id]/decline/route.ts:29`).
4. **Messages envoyés.** Fatou : cloche, push, email `TRANSFER_DECLINED_SENDER` « Billet refusé » / « Le destinataire a
   refusé votre billet pour « Concert Test » : il reste dans vos billets. » (indispensable, file)
   (`lib/notifications/catalog.ts:1448-1454`).
5. **Ce que voient les autres rôles.** Fatou retrouve son billet libre, en direct.
6. **Refus.** Mêmes textes que 07.7 ; panne : « Refus du billet momentanément impossible. Réessayez. » (`app/api/tickets/transfers/[id]/decline/route.ts:41`).
7. **Preuves et essai.** Fichiers cités. Aucun essai dédié.

## 07.9 Annuler un transfert (expéditrice)

1. **Qui, où.** Fatou, carte du billet en transfert, « Annuler le transfert » ; confirmation « Annuler ce transfert ? » /
   « Le billet reste à vous et son code d’entrée revient sur cette page. {numéro masqué} ne pourra plus l’accepter. »,
   boutons « Annuler le transfert » et « Garder le transfert » (`components/tickets/TicketCard.tsx:445-476`, `:792-802`).
2. **Ce qu'il saisit.** La confirmation.
3. **Ce que fait le système.** Transfert « annulé », billet déverrouillé, secret **inchangé** (le QR de Fatou revient) ;
   toast « Transfert annulé : votre billet est de nouveau disponible. » (`M/20261109000008_lot9bis_cycle.sql:2509-2565`).
4. **Messages envoyés.**

   | Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
   |---|---|---|---|---|
   | Numéro du destinataire | SMS | Indispensable | File | `TRANSFER_CANCELLED` : « Event Village : le transfert du billet Concert Test a été annulé par son propriétaire. » (86 caractères) |
   | Compte vérifié de ce numéro | Cloche, push, email | Indispensable | File | « Transfert annulé » / « Le transfert du billet pour « Concert Test » a été annulé par son propriétaire. » |

   Preuves : `lib/notifications/catalog.ts:718-724`.
5. **Ce que voient les autres rôles.** Le billet disparaît de « Reçus » chez Awa.
6. **Refus (texte exact).** « Ce transfert a déjà été réclamé : il ne peut plus être annulé. », « Ce transfert est déjà
   annulé. », « Ce transfert a déjà expiré. », « Vous n'êtes pas l'émetteur de ce transfert. », « Transfert
   introuvable. », « Ce transfert est introuvable. Actualisez la page. », « Annulation momentanément impossible.
   Réessayez. » ; réseau : « Connexion impossible : le transfert n’a pas été annulé. Vérifiez votre réseau, puis
   réessayez. » (`lib/tickets/ticket-transfer.service.ts:148-152`, `M/20261109000008_lot9bis_cycle.sql:2525-2537`,
   `TicketCard.tsx:445-476`).
7. **Preuves et essai.** Fichiers cités. Aucun essai dédié.

## 07.10 Transfert non accepté en 48 h : expiration

1. **Qui, où.** Personne : passé l'échéance.
2. **Ce qu'il saisit.** Rien.
3. **Ce que fait le système.** Transfert « expiré », billet déverrouillé et rendu à Fatou ; fait par la tâche horaire
   (minute 17), ou plus tôt quand Fatou ouvre Mes billets, relance un transfert, ou quand Awa tente d'accepter ou de
   refuser (`M/20261109000008_lot9bis_cycle.sql:949-1003`, `:1515-1575`, `app/api/tickets/route.ts:51-65`, 12.6). Une
   acceptation tardive reçoit « Ce billet ne peut plus être accepté : le délai est dépassé. ».
4. **Messages envoyés.** Fatou : cloche, push, email `TRANSFER_EXPIRED` « Transfert expiré » / « Votre billet pour
   « Concert Test » n'a pas été accepté à temps : il reste dans vos billets. » (indispensable ; même clé pour la tâche et
   la lecture : jamais deux fois) (`lib/notifications/catalog.ts:725-730`). Aucun SMS ; rien au destinataire.
5. **Ce que voient les autres rôles.** Le billet quitte « Reçus » chez Awa.
6. **Refus.** Sans objet.
7. **Preuves et essai.** Fichiers cités. Aucun essai dédié.

## 07.11 Le destinataire change de numéro pendant le transfert

1. **Qui, où.** Awa (qui a un compte) change le numéro de son compte (02.11) alors qu'un transfert attend sur l'ancien.
2. **Ce qu'il saisit.** Le changement de numéro (02.11).
3. **Ce que fait le système.** Dans la même transaction que le changement : tout transfert « en attente » vers l'ancien
   numéro est annulé ; un vrai transfert rend le billet à Fatou (déverrouillé) ; une invitation non réclamée est
   annulée et sa place rendue au stock, sans avis (`M/20261109000004_lot9bis_droits.sql:740-840`). Un transfert vers le
   **nouveau** numéro devient visible pour elle (numéro vérifié par le code du changement).
4. **Messages envoyés.** Fatou : cloche, push, email `TRANSFER_RECIPIENT_CHANGED` « Transfert annulé » / « Le
   destinataire de votre billet pour « Concert Test » a changé de numéro : le transfert est annulé et le billet reste
   dans vos billets. » (`lib/notifications/catalog.ts:1455-1464`). Messages du changement de numéro lui-même : 02.11.
5. **Ce que voient les autres rôles.** Fatou retrouve son billet libre.
6. **Refus.** Sans objet. Un changement de numéro de l'**expéditrice** n'a aucun effet sur ses transferts (recherche dans
   `account_phone_finalize` : seuls les transferts vers l'ancien numéro sont lus).
7. **Preuves et essai.** Fichiers cités. Recette : essai 74 (`docs/recette-billetterie.md:1597-1614`).

## 07.12 Transfert puis remboursement (transfert en attente, ou déjà accepté)

1. **Qui, où.** La partenaire (jusqu'à la fin de l'événement) ou un administrateur ayant la permission de rembourser,
   depuis le pilotage de l'événement (08) ; ou l'annulation de l'événement (04.19).
2. **Ce qu'il saisit.** Le remboursement (08).
3. **Ce que fait le système** (`M/20261110000006_lot9ter_equipe_messages.sql:207-440`) :
   - **Transfert encore en attente** : annulé dans la même transaction, billet déverrouillé puis remboursé ; le
     destinataire est prévenu (sauf annulation de l'événement, où chacun reçoit l'avis d'annulation) (`:362-399`).
   - **Transfert déjà accepté** : l'argent revient toujours à **l'acheteuse d'origine** (sur le compte qui a payé),
     jamais au porteur actuel ; le porteur actuel est prévenu que son billet est annulé (`:344-353`, `:420-440`).
4. **Messages envoyés.**

   | Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
   |---|---|---|---|---|
   | Destinataire d'un transfert en attente | SMS au numéro + cloche, push, email au compte vérifié | Indispensable | File | `TRANSFER_REVOKED` : « Event Village : le billet Concert Test qui vous était transféré a été remboursé à son acheteur. Le transfert est annulé. » (120 caractères) ; cloche « Transfert annulé » / « Le billet pour « Concert Test » a été remboursé à son acheteur : le transfert est annulé. » |
   | Porteur actuel d'un billet transféré et accepté | SMS, cloche, push, email | Indispensable, envoyé même suspendu | File | `TICKET_REFUNDED_HOLDER` : « Event Village : votre billet {catégorie} pour {titre} a été annulé. Le remboursement est versé à l'acheteur d'origine. » — ex. « Event Village : votre billet VIP pour Concert Test a été annulé. Le remboursement est versé à l'acheteur d'origine. » (115 caractères) ; cloche « Billet annulé » / « Votre billet VIP pour « Concert Test » du sam. 5 déc. 2026 à 20:00 a été annulé. Le remboursement est versé à l'acheteur d'origine. » |
   | Acheteuse d'origine | voir 08 | Indispensable | — | `REFUND_REQUESTED`, `REFUND_PAID` |

   Preuves : `lib/notifications/catalog.ts:1440-1447`, `:1642-1652`.
5. **Ce que voient les autres rôles.** Le billet passe « Remboursement en cours » puis « Remboursé » chez son porteur.
6. **Refus.** Ceux du remboursement (08).
7. **Preuves et essai.** Fichiers cités. Recette : essai 83 (`docs/recette-billetterie.md:1788-1804`).

## 07.13 Invitations : envoi par la partenaire, nom de l'invité

1. **Qui, où.** La partenaire propriétaire (ou un admin ayant `events.write`, ou le SUPERADMIN), compte actif, événement
   **Validé ou Publié** : « Mes événements » → l'événement → onglet « Invitations », bloc « Inviter par SMS » /
   « Chaque numéro reçoit un SMS avec un lien vers Mes billets. Sans compte, ses billets l’attendent jusqu’à son
   inscription avec ce numéro. » (`app/partner/events/[id]/page.tsx:51-56`, `:260`,
   `components/partner/pilotage/InvitationsTab.tsx:273-274`). Autre statut : « Envoi d’invitations indisponible » / « Les
   invitations ne peuvent être envoyées que pour un événement validé ou publié. » (`:624-627`).
2. **Ce qu'il saisit.**

   | Champ (libellé exact) | Obligatoire | Aide, limites, erreurs exactes | Preuve |
   |---|---|---|---|
   | « Catégorie » (« Choisir une catégorie »), options « {nom} · {n} restants » ou « · complet » ou « · vente fermée » (grisées), groupes « Sans canal de vente » et « En vente en ligne ou au guichet » | oui | aide « Toute catégorie peut être distribuée ; les places sont prises sur son stock. » ; « Choisissez une catégorie encore disponible. » | `InvitationsTab.tsx:125-130`, `:190-197`, `:220`, `:278-296` |
   | « Billets par numéro » | oui | 1 à 4 ; « Choisissez de 1 à 4 billets par numéro. » | `lib/validations/invitation.ts:9-16` |
   | « Numéro {n} » (exemple « 77 123 45 67 »), 1 à 10 lignes (« Ajouter un numéro », « Retirer le numéro {n} ») | oui | « Numéro {n} : saisissez un numéro sénégalais à 9 chiffres (par exemple 77 123 45 67). », « Numéro {n} : ce numéro figure deux fois dans la liste. », « Saisissez au moins un numéro de téléphone. », « 10 numéros au plus par envoi. » | `InvitationsTab.tsx:92`, `:104-122`, `lib/validations/invitation.ts:37-58` |
   | « Nom de l’invité {n} » (compteur « {n} / 60 ») | non | aide « Facultatif, 60 caractères au plus. Montré au contrôleur qui consulte la liste des invités. » ; « Le nom de l’invité ne doit pas dépasser 60 caractères. », « Le nom de l’invité contient un caractère non permis. » | `InvitationsTab.tsx:332-341`, `lib/validations/invitation.ts:15-35` |

   Bouton « Envoyer les invitations » → confirmation « Confirmer l’envoi » / « Un SMS part aussitôt vers chaque numéro
   et les places sont prises sur le stock de la catégorie. » avec le récapitulatif (« Catégorie », « Numéros » / « Invité »,
   « Billets par numéro », « Billets au total ») (`InvitationsTab.tsx:384-425`).
3. **Ce que fait le système** (`M/20261110000008_lot9ter_invites.sql:262-447`) :
   - contrôles : stock et catégorie active, événement pas fini ; les canaux de vente, les dates de vente et le maximum
     par commande **ne s'appliquent pas** aux invitations (`:364-372`) ;
   - quotas : 50 invitations par événement et par heure, 3 par numéro et par jour (tous organisateurs confondus)
     (`lib/env.ts:105-106`, `M/20261110000008_lot9ter_invites.sql:374-385`) ;
   - stock vendu augmenté du total ; pour chaque numéro, {quantité} billets « Invitation », prix 0, avec le nom de
     l'invité s'il est donné : rattachés **directement** au compte si ce numéro appartient à un compte vérifié (07.14),
     sinon en attente de réclamation jusqu'à la **fin de l'événement** (07.15) (`M/20261110000008_lot9ter_invites.sql:387-415`) ;
   - journal : numéros masqués, nombre de noms, jamais les noms (`M/20261110000008_lot9ter_invites.sql:436-447`).
   - Écran : « Invitations envoyées » / « {n} billets pour {m} numéros. », ex. « 2 billets pour 1 numéro. » (`InvitationsTab.tsx:378-380`).
     Historique « Historique des invitations » / « Les numéros sont masqués. Une invitation non scannée peut être
     annulée : la place revient au stock et l’invité est prévenu par SMS. » : colonnes « Catégorie », « Numéro »
     (« +221***01 »), « Invité » (nom ou « — »), « Envoi », « Canal et prix » (« Invitation · 0 F CFA »), « Statut »
     (« Envoyée », « Entrée validée », « Refusée », « Annulée »), « Action » (« Modifier le nom », « Annuler
     l’invitation ») ; 50 par page (`InvitationsTab.tsx:494-563`, `M/20261110000008_lot9ter_invites.sql:460-513`).
4. **Messages envoyés.**

   | Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
   |---|---|---|---|---|
   | Chaque numéro invité (un SMS par numéro, hors quota du compte) | SMS | Indispensable | File, minute suivante | `INVITATION_RECEIVED` : « Event Village : {n} invitation(s) pour {titre, 28 car.} le {date courte}. Connectez-vous avec ce numéro : {adresse}/tickets » — ex. « Event Village : 2 invitations pour Concert Test le sam. 5 déc. à 20:00. Connectez-vous avec ce numéro : https://app.exemple.sn/tickets » (134 caractères, 1 segment). L'organisateur n'est pas nommé. |
   | Compte vérifié de ce numéro | Cloche, push, email | Indispensable | Idem | « Invitation reçue » / « 2 invitations pour « Concert Test » le sam. 5 déc. 2026 à 20:00 : vos billets sont dans Mes billets. » (lien `/tickets?tab=recus`) |

   Le nom de l'invité n'entre dans aucun message. Preuves : `lib/notifications/catalog.ts:695-707`,
   `M/20261110000008_lot9ter_invites.sql:417-430`.
5. **Ce que voient les autres rôles.** Le contrôleur voit les invitations non réclamées dans la liste des invités, avec
   le nom (05). La fiche publique perd les places distribuées.
6. **Refus (texte exact).** « Limite d'invitations atteinte pour cet événement. Réessayez plus tard. », « Ce numéro a déjà
   reçu le maximum d'invitations aujourd'hui. » (+ « Nouvel essai possible dans environ {n} minutes. »), « Envoi refusé »
   (problèmes de stock, ex. « Plus assez de places « VIP » disponibles. »), « Cet événement n’accepte pas d’invitations
   pour le moment. », « Vous n’avez pas le droit d’envoyer des invitations pour cet événement. » ; réponse perdue :
   « Envoi non confirmé » / « La connexion a été interrompue. Consultez l’historique ci-dessous avant de recommencer. » ;
   panne : « Les invitations sont momentanément indisponibles. » (`lib/tickets/invitation.service.ts:46-49`,
   `:156-163`, `InvitationsTab.tsx:132-172`, `M/20261110000008_lot9ter_invites.sql:356-358`).
7. **Preuves et essai.** Fichiers cités. Recette : essais 62, 78 (`docs/recette-billetterie.md:1383-1400`, `:1680-1701`).

## 07.14 Invitation reçue par un numéro qui a un compte vérifié

1. **Qui, où.** Awa, dont le compte porte le numéro invité, confirmé par code.
2. **Ce qu'il saisit.** Rien.
3. **Ce que fait le système.** Les billets sont **à son compte dès l'envoi**, sans étape d'acceptation : ils
   apparaissent dans « À venir » avec le prix « Invitation » et un QR (`M/20261110000008_lot9ter_invites.sql:394-410`,
   `components/tickets/TicketCard.tsx:168`). Elle peut les transférer comme tout billet (07.6).
4. **Messages envoyés.** SMS au numéro et cloche, push, email au compte (07.13). La cloche ouvre « Reçus », où ces
   billets ne sont **pas** (ils sont dans « À venir ») (constat W6-07).
5. **Ce que voient les autres rôles.** La partenaire : ligne « Envoyée » dans l'historique.
6. **Refus.** Sans objet.
7. **Preuves et essai.** Fichiers cités. Recette : essai 62 (`docs/recette-billetterie.md:1383-1400`).

## 07.15 Invitation reçue par un numéro sans compte : réclamation après inscription

1. **Qui, où.** Une personne invitée sur un numéro sans compte (ou dont le compte n'a jamais confirmé ce numéro).
2. **Ce qu'il saisit.** Elle crée un compte avec ce numéro (inscription avec code SMS, 02.1 et 02.2), puis Mes billets →
   « Reçus ».
3. **Ce que fait le système.**
   - Jusque-là, chaque billet est « Invitation », sans porteur, en attente de réclamation vers ce numéro, **jusqu'à la fin
     de l'événement** (`M/20261110000008_lot9ter_invites.sql:412-415`).
   - Dans « Reçus » : « Invitation de L’organisateur de l’événement », « {catégorie} · Invitation », « À accepter avant
     le {date et heure de fin} » ; « Accepter le billet » → « Accepter ce billet ? » / « L’invitation pour « {titre} »
     rejoint vos billets avec son QR code. » (`M/20261110000008_lot9ter_invites.sql:706-714`,
     `components/tickets/IncomingTransfers.tsx:265-367`). Acceptée : billet à son compte, nouveau numéro et nouveau QR
     (07.7).
   - **Déjà entrée sans téléphone** grâce à la liste des invités (05) avant de réclamer : la ligne dit « Entrée déjà
     validée à la porte le {date} à {heure}. », bouton « Ajouter à mes billets » → « Ajouter ce billet à vos billets ? »
     / « Ce billet a déjà servi à l’entrée : il apparaîtra comme utilisé. » ; le billet est rattaché sans changer de
     numéro (`M/20261110000008_lot9ter_invites.sql:572-597`, `components/tickets/IncomingTransfers.tsx:303-334`, `:358-366`).
   - Après la fin de l'événement, l'invitation ne peut plus être acceptée (délai dépassé).
4. **Messages envoyés.** Le SMS de 07.13 à l'envoi ; à l'acceptation, cloche, push, email `TRANSFER_RECEIVED` (07.7) ;
   aucun avis à la partenaire.
5. **Ce que voient les autres rôles.** La partenaire : « Envoyée », puis « Entrée validée » après le contrôle.
6. **Refus.** Ceux de 07.7.
7. **Preuves et essai.** Fichiers cités. Recette : essais 63, 78 (`docs/recette-billetterie.md:1401-1418`, `:1680-1701`).

## 07.16 Modifier le nom d'un invité

1. **Qui, où.** Mêmes droits que l'envoi ; historique des invitations, « Modifier le nom » sur une invitation
   « Envoyée » ; fenêtre « Nom de l’invité », champ « Nom de l’invité » (aide de 07.13) (`InvitationsTab.tsx:452-470`,
   `:578-600`).
2. **Ce qu'il saisit.** Le nom (vide = retirer le nom), 60 caractères au plus.
3. **Ce que fait le système.** Nom enregistré sur ce billet seulement ; journal sans le nom ; toast « Nom de l’invité
   enregistré. » (`M/20261110000008_lot9ter_invites.sql:164-248`).
4. **Messages envoyés.** Aucun.
5. **Ce que voient les autres rôles.** Le contrôleur voit le nouveau nom dans la liste des invités (05).
6. **Refus (texte exact).** « Ce billet a déjà été utilisé : le nom ne peut plus être modifié. », « Cette invitation ne
   peut plus être modifiée. », « Invitation introuvable. », « Vous n’avez pas le droit de modifier les invitations de
   cet événement. », « Modification impossible pour le moment. » (`M/20261110000008_lot9ter_invites.sql:215-233`,
   `InvitationsTab.tsx:468`).
7. **Preuves et essai.** Fichiers cités. Recette : essai 78 (`docs/recette-billetterie.md:1680-1701`).

## 07.17 Annuler une invitation ; invitation refusée par l'invité

1. **Qui, où.** Annulation : mêmes droits que l'envoi, historique, « Annuler l’invitation » sur une invitation
   « Envoyée » ; confirmation « Annuler cette invitation ? » / « Le billet {catégorie} de {numéro masqué} ne sera plus
   valable. La place revient au stock et l’invité est prévenu par SMS. », boutons « Annuler l’invitation » et « Garder
   l’invitation » (`InvitationsTab.tsx:474-488`, `:566-575`). Refus par l'invité : « Reçus » → « Refuser » →
   « Refuser cette invitation ? » / « L’invitation pour « {titre} » est annulée et la place rendue à l’organisateur. Vous
   ne pourrez plus l’accepter. », bouton « Refuser l’invitation » (`components/tickets/IncomingTransfers.tsx:373-382`).
2. **Ce qu'il saisit.** La confirmation.
3. **Ce que fait le système.**
   - Annulation : billet « Annulé », réclamation en attente annulée, une place rendue au stock, journal ; statut de
     l'événement non contrôlé ; toast « Invitation annulée : la place revient au stock. »
     (`M/20261109000009_lot9bis_messages.sql:977-1077`, `InvitationsTab.tsx:479`).
   - Refus par l'invité : billet « Annulé », place rendue, statut « Refusée » dans l'historique, toast « Invitation
     refusée. » ; **aucun avis** à la partenaire (`M/20261109000008_lot9bis_cycle.sql:1388-1395`).
4. **Messages envoyés** (annulation seulement).

   | Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
   |---|---|---|---|---|
   | Porteur (invitation réclamée ou numéro vérifié) | Cloche, SMS, email | Indispensable, envoyé même suspendu | File | `TICKET_CANCELLED` (invitation) : SMS « Event Village : votre invitation pour {titre, 30 car.} du {date courte} est annulée par l'organisateur. » — ex. « Event Village : votre invitation pour Concert Test du sam. 5 déc. à 20:00 est annulée par l'organisateur. » (105 caractères) ; cloche « Invitation annulée » / « Votre invitation pour « Concert Test » du sam. 5 déc. 2026 à 20:00 est annulée par l'organisateur. » |
   | Numéro d'une invitation non réclamée | SMS seul | Indispensable | File | même SMS |

   Le texte dit « l'organisateur » même quand un administrateur annule. Preuves : `lib/notifications/catalog.ts:1555-1575`,
   `M/20261109000009_lot9bis_messages.sql:1058-1074`.
5. **Ce que voient les autres rôles.** Le billet disparaît de « Reçus » ou passe « Annulé » chez l'invité.
6. **Refus (texte exact).** « Ce billet a déjà été scanné : l’invitation ne peut plus être annulée. », « Cette invitation
   ne peut plus être annulée. », « Invitation introuvable. », « Vous n’avez pas le droit d’annuler les invitations de cet
   événement. », « Annulation impossible pour le moment. » (`M/20261109000009_lot9bis_messages.sql:1019-1038`,
   `InvitationsTab.tsx:484`).
7. **Preuves et essai.** Fichiers cités. Recette : essai 93 (`docs/recette-billetterie.md:1974-1992`).

## 07.18 Billet d'un client suspendu

1. **Qui, où.** Un client dont le compte a été suspendu par l'administration (02.17), porteur de billets.
2. **Ce qu'il saisit.** Rien (il ne peut plus se connecter).
3. **Ce que fait le système.**
   - **Ses billets restent valables** : ni annulés ni remboursés ; le contrôle (QR, saisie manuelle du numéro avec pièce
     d'identité, liste des invités) ne lit jamais le statut du compte du porteur : `ticket_scan` et
     `ticket_manual_lookup` ne joignent le compte que pour son nom (`M/20261110000009_lot9ter_zones.sql:903-1280`,
     `:1281-1425`, `:997`, `:1089`) ; le seul contrôle de statut du fichier hors guichet (`:853`) porte sur le contrôleur.
   - Mais **il ne peut plus afficher son QR** : Mes billets, le code tournant, le PDF et le téléchargement hors ligne
     exigent un compte actif ; les jetons déjà émis restent valables jusqu'à une heure (`lib/auth/session.ts:47-66`,
     `app/api/tickets/route.ts:39-40`, `app/api/tickets/[id]/live-code/route.ts:23-24`, 02.17). Réponse : « Votre compte
     n'est pas actif. Contactez le support. ».
   - **Billet hors ligne** : s'il a été enregistré avant (07.5), la page `/billet/hors-ligne` l'affiche sans le
     serveur… tant que la session n'est pas fermée sur le téléphone : une déconnexion (ou une nouvelle tentative de
     connexion, qui ferme la session) efface les copies locales (`components/providers/AuthProvider.tsx:177-182`) —
     écart déjà relevé par W2 (W2-02).
   - **Entrée sans téléphone** : numéro du billet + pièce d'identité au contrôle (05).
   - Ses messages sont bloqués pendant la suspension, sauf ceux envoyés malgré tout (confirmation d'achat,
     remboursements, billet annulé…) (10).
4. **Messages envoyés.** `ACCOUNT_SUSPENDED` (02.17) : SMS « Event Village : votre compte est suspendu. Motif : {motif}.
   Vos billets payés restent valables à l'entrée. Contactez le support. » et cloche qui conseille « présentez le billet
   hors ligne déjà enregistré sur votre téléphone, ou donnez le numéro du billet avec une pièce d'identité »
   (`lib/notifications/catalog.ts:1577-1587`).
5. **Ce que voient les autres rôles.** Le contrôleur : billet valable, nom du titulaire comme d'habitude (05).
   La partenaire : rien de changé dans ses ventes.
6. **Refus.** Transférer, accepter un transfert, demander un remboursement après report : refusés (compte non actif).
   Les transferts en attente **vers** lui restent invisibles tant qu'il est suspendu (identité exigeant un compte actif,
   `M/20261103000002_lot6_outbox.sql:453-456`).
7. **Preuves et essai.** Fichiers cités. Recette : essai 73 (`docs/recette-billetterie.md:1578-1596`).

---

## NON VÉRIFIÉ (récapitulatif)

- Effacement des billets hors ligne d'un client suspendu à l'expiration de son jeton sans reconnexion (W2-02, essai 73).
- Envoi effectif des SMS d'invitation et de transfert (dépend de la boîte d'envoi et des plafonds, 10 et 13).
