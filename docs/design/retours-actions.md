# Retours des actions : inventaire

> Design, phase 0. Toutes les actions de l'application (chaque bouton qui enregistre, envoie, supprime, paie,
> scanne…), le retour qu'elles donnent aujourd'hui et ce qu'il faudra. Code lu sur `main` à `fdaa6c365`
> (branche `design-0/identite`), en lecture seule ; services fermés (salles, commandes, abonnements) exclus.
> Les numéros de ligne sont ceux de ce commit. Relevé en deux parties, chaque ligne vérifiée dans le code ;
> deux lignes recontrôlées à la main (`components/events/EventTicketing.tsx:639-642`, `app/tickets/page.tsx:111`, `:115`).

## La règle (cible pour toute l'application)

| Situation | Retour attendu |
|---|---|
| Réussite | Toast court qui se ferme seul (4 s), en bas sur téléphone, en haut à droite sur ordinateur. Si l'écran suivant dit déjà le résultat (page de succès du paiement) : rien de plus. |
| Erreur d'un champ | Sous le champ, reliée au champ (`aria-describedby`), focus sur le premier champ en erreur. Jamais en toast. |
| Erreur générale (réseau, serveur) | Toast qui reste, avec « Réessayer ». Une phrase qui dit ce qui s'est passé et quoi faire. |
| Action importante | Confirmation avant (le bouton dit ce qui va se passer), puis toast avec « Annuler » si l'action se défait vraiment (6 s). Pas d'« Annuler » après un paiement, un versement ou un SMS parti. |
| Pour tous | Un seul système (`components/ui/Toast.tsx`), 3 toasts au plus, lisibles en clair et en sombre, annoncés (`status` / `alert`), jamais de code technique (« erreur 500 », « Failed to fetch », codes en capitales). |
| Scanner du contrôleur | Inchangé : résultat plein écran, couleurs fixes. |

Maquette de la règle : `maquettes/toasts.html`.

## Aujourd'hui, en bref

- **160 actions relevées** : 73 côté public, client et contrôleur ; 87 côté organisatrice (56) et administration (31).
- **Un seul système de toasts existe déjà**, mais toutes les erreurs se ferment seules après 3,5 à 8 s, aucune n'a
  « Réessayer », aucun toast n'a « Annuler », et jusqu'à 4 toasts s'empilent (`components/ui/Toast.tsx:174`, `:184`).
- **Réussite** : 147 actions sur 160 ont un retour ; 13 n'ont qu'un changement visible ou rien du tout (par exemple
  « Supprimer la catégorie », « Recevoir un nouveau code »).
- **Erreurs** : 10 actions publiques et 3 exports n'ont aucun retour d'erreur ; 13 erreurs de champ côté
  organisatrice et administration s'affichent hors du champ ; sur la connexion et l'inscription, les erreurs de champ
  sont en bandeau.
- **Codes techniques** : 48 actions peuvent afficher un code (« (erreur NNN) », « Failed to fetch », JSON brut) ;
  le même défaut existe dans plusieurs chargements de page.
- **Confirmation** : 7 actions importantes partent sans confirmation, dont le transfert d'un billet, la clôture de
  caisse et l'enregistrement d'un événement publié qui envoie des SMS aux détenteurs.
- `alert()`, `window.confirm()`, `prompt()` : aucun.

Le détail, écran par écran, suit. Chaque partie finit par ses écarts les plus gênants.

## 1. Public, client et contrôleur

- 73 actions relevées sur 23 écrans ou fenêtres (code lu dans event-village-design0, branche design-0/identite = main fdaa6c365).
- Réussite : 62 ont un retour explicite (28 par toast, les autres par un message dans la page ou un écran de résultat) ; 11 n’ont qu’un changement visible ou ouvrent une autre application.
- Erreur : 10 n’ont aucun retour d’erreur (cloche des notifications, 4 déconnexions, « WhatsApp », « Ouvrir Wave », torche, réglage du scanner). Toutes les erreurs en toast se ferment seules (3,5 à 8 s), aucune n’a « Réessayer ».
- Codes techniques : 22 actions peuvent en afficher un (18 « (erreur NNN) », 4 texte brut du navigateur du type « Failed to fetch ») ; en plus « Erreur 404 » sur 2 pages et « (erreur NNN) » dans 9 chargements.
- Actions importantes : 2 sans aucune confirmation (transfert de billet, clôture de caisse) ; 3 confirmées seulement par l’écran lui-même, sans fenêtre (payer, retirer, vendre au guichet). Les envois de code SMS demandés par la personne ne sont pas comptés.
- alert() et window.confirm() : 0 (la seule `confirm()` trouvée est une fonction locale, app/verify-email/page.tsx:68).

### Accueil (/)

| Action | Fait | Réussite aujourd’hui | Erreur aujourd’hui | Confirmation | Fichier | Ce qu’il faudra |
|---|---|---|---|---|---|---|
| « Votre ville » (liste « Près de chez vous ») | enregistre (compte) ou garde sur l’appareil | la liste se recharge, aucun message | sous le champ : texte du serveur ou « Connexion impossible : vérifiez votre réseau, puis réessayez. » | non | components/events/HomeDiscovery.tsx:262 (229-241, 150) | Changement visible suffisant (toast court si compte). Panne réseau : toast qui reste + « Réessayer », pas sous le champ. Annuler : inutile (on rechoisit). |

### Événement (/events/[id])

| Action | Fait | Réussite aujourd’hui | Erreur aujourd’hui | Confirmation | Fichier | Ce qu’il faudra |
|---|---|---|---|---|---|---|
| Icône « Partager l’événement » | partage ou copie | feuille de partage du téléphone, sinon toast « Lien de l’événement copié. » | toast qui se ferme : « Le partage n’a pas abouti. Copiez l’adresse de la page. » / « Le lien n’a pas pu être copié. Copiez l’adresse de la page. » | non | app/events/[id]/page.tsx:805, 811, 814 | Conforme. Annuler : sans objet. |
| « Réserver N billets gratuits » (téléphone : « Réserver (N) ») | réserve | toast « Billet gratuit réservé. » / « N billets gratuits réservés. » puis Mes billets | toast qui se ferme : texte du serveur, « Réponse inattendue du serveur. Patientez un instant puis réessayez. », réseau ; « Le paiement n’a pas pu être lancé (erreur NNN). » possible | non | app/events/[id]/page.tsx:734, 730, 749, 753-762, 769 ; lib/payments/payment-client.ts:251 | Réussite conforme. Panne : toast qui reste + « Réessayer ». Place épuisée : message près de la formule. Sans code. Annuler : non (billets émis aussitôt). |
| « Acheter N billets (X F CFA) » (téléphone : « Acheter (X) ») | ouvre le paiement | fenêtre « Paiement sécurisé » | visiteur : toast d’erreur « Connectez-vous pour acheter un billet. » qui suit sur la page de connexion, laquelle ne dit rien ; total absent : toast « Calcul du total en cours : patientez un instant. » | — | app/events/[id]/page.tsx:697, 779 | Pas un toast d’erreur : message d’information sur la page de connexion (« Connectez-vous pour finir votre achat »). Annuler : sans objet. |

Calcul du total (automatique aux boutons « + » / « − ») : bandeau « Total indisponible » + « Réessayer », avec « Le total n’a pas pu être calculé (erreur NNN). » possible (L641, 1108-1121). Retours automatiques à l’ouverture (panier repris, sélection gardée) : toasts L514, 527, 531, 536, 557, 561. Chargement : « L’événement n’a pas pu être chargé (erreur NNN). » (L448) ; page introuvable : « Erreur 404 » affiché (L331).

### Fenêtre « Paiement sécurisé » (ouverte depuis /events/[id])

| Action | Fait | Réussite aujourd’hui | Erreur aujourd’hui | Confirmation | Fichier | Ce qu’il faudra |
|---|---|---|---|---|---|---|
| « Payer X F CFA avec Wave » (ou « … avec Orange Money », « Payer X », « Continuer avec … ») | paie (demande envoyée à l’opérateur) | écran « Wave est ouvert » / « Demande Wave créée », puis page de suivi ; panier gratuit : toast « Billets réservés : retrouvez-les dans votre espace billets. » | opérateur manquant et numéro : sous le champ ; refus et pannes : bandeau rouge dans la fenêtre (reste, bouton « Masquer le message d’erreur ») ; « (erreur NNN) » possible | oui de fait : récapitulatif et total dans la fenêtre, puis code secret chez l’opérateur | components/payment/PaymentModal.tsx:610-647, 705-709, 757-759, 504-547, 437 ; lib/payments/payment-client.ts:251 | Écran de résultat suffisant. Champs : conforme. Panne réseau ou serveur : toast qui reste + « Réessayer » (ou garder le bandeau). Sans code. Annuler : oui tant que non validé (« Annuler ce paiement » sur la page de suivi). |

### Suivi du paiement (/paiement/[id])

| Action | Fait | Réussite aujourd’hui | Erreur aujourd’hui | Confirmation | Fichier | Ce qu’il faudra |
|---|---|---|---|---|---|---|
| « Annuler ce paiement » (rouge si la réservation est échue, discret sinon) | annule | toast « Paiement annulé : la réservation a été libérée. » (ou « Ce paiement n’était plus en attente : voici son statut à jour. », « Votre paiement vient d’être confirmé. ») + statut à jour à l’écran | toast qui se ferme : vérification impossible, session expirée (puis connexion), « Annulation impossible (erreur NNN). Réessayez. », réseau | oui, « Annuler ce paiement ? » (« Annuler ce paiement » / « Continuer le paiement ») | app/paiement/[id]/page.tsx:651, 655, 658, 662, 664, 668, 672 ; fenêtre 1065 | Écran de résultat suffisant (le toast fait doublon). Erreur : toast qui reste + « Réessayer », sans code. Annuler : non (réservation libérée, il faut racheter). |
| « Ouvrir Wave » / « Rouvrir Wave » (lien) | ouvre l’opérateur | l’application s’ouvre, la page se met à jour seule | rien si le lien ne s’ouvre pas (NON VÉRIFIÉ : comportement sans l’application installée) | non | app/paiement/[id]/page.tsx:891-899 | Rien à ajouter en réussite ; dire quand l’ouverture échoue. Annuler : sans objet. |

« Actualiser le statut » et « Réessayer maintenant » relisent le statut (écran mis à jour, conforme). Paiement confirmé : écran « Paiement confirmé » et redirection en 6 s : écran de résultat suffisant.

### Mes billets (/tickets) : carte du billet

| Action | Fait | Réussite aujourd’hui | Erreur aujourd’hui | Confirmation | Fichier | Ce qu’il faudra |
|---|---|---|---|---|---|---|
| « Annuler le transfert » | annule le transfert | toast « Transfert annulé : votre billet est de nouveau disponible. » | toast qui se ferme : texte du serveur, « Le transfert n’a pas pu être annulé (erreur NNN). », réseau, « Ce transfert est introuvable. Actualisez la page. » | oui, « Annuler ce transfert ? » | components/tickets/TicketCard.tsx:463, 469, 472, 447 ; fenêtre 796 | Réussite conforme. Erreur : toast qui reste + « Réessayer », sans code. Annuler : non (refaire un transfert = nouveau SMS). |
| « Me faire rembourser » | rembourse (billet annulé) | toast « Remboursement demandé : vous recevrez un SMS dès qu’il est versé. » + liste relue | toast qui se ferme : texte du serveur, « Le remboursement n’a pas pu être demandé (erreur NNN). », réseau ; la fenêtre reste ouverte derrière | oui, « Me faire rembourser ? » (« Garder mon billet ») | components/tickets/TicketCard.tsx:430, 436, 439 ; fenêtre 781 | Réussite conforme. Erreur : toast qui reste + « Réessayer », sans code. Annuler : non (billet annulé, argent en route). |
| « PDF » (« Télécharger le billet en PDF ») | télécharge | toast « Billet PDF téléchargé. » | toast qui se ferme : texte du serveur ou « Le billet PDF n’a pas pu être généré. Réessayez dans un instant. », réseau | non | components/tickets/TicketCard.tsx:411, 398, 414 | Réussite conforme. Erreur : toast qui reste + « Réessayer ». Annuler : sans objet. |
| « WhatsApp » | partage | WhatsApp s’ouvre | rien (fenêtre bloquée : silence) | non | components/tickets/TicketCard.tsx:350-354 | Toast d’erreur si l’ouverture échoue. Annuler : sans objet. |
| « Lien » | partage ou copie | feuille de partage, sinon toast « Lien de l’événement copié. » | toast « Copie impossible sur cet appareil. » | non | components/tickets/TicketCard.tsx:369, 372 | Conforme. Annuler : sans objet. |

« Transférer » ouvre la fenêtre ci-dessous ; « Afficher ce billet hors ligne » et « Aide au transfert » sont de la navigation. Chargement de la liste : « (erreur NNN) » possible (app/tickets/page.tsx:111, 115).

### Mes billets : fenêtre « Transférer ce billet »

| Action | Fait | Réussite aujourd’hui | Erreur aujourd’hui | Confirmation | Fichier | Ce qu’il faudra |
|---|---|---|---|---|---|---|
| « Envoyer le billet » | transfère + SMS au destinataire | écran « Transfert lancé » dans la fenêtre + toast « Transfert lancé vers {numéro}. » | forme du numéro : sous le champ ; refus du serveur et réseau : bandeau « Transfert impossible » ; « Réponse inattendue du serveur (erreur NNN). » | non (mot de passe redemandé s’il date de plus de 10 min) | components/tickets/TransferModal.tsx:174, 241-269, 297, 300-304, 157 | Confirmation avant (« Envoyer ce billet au 77… ? »). Écran de résultat suffisant (retirer le toast). Refus qui vise le numéro : sous le champ. Réseau : toast qui reste. Annuler : oui tant que non accepté, mais le SMS est déjà parti. |
| « Prévenir mon proche » | partage ou copie | feuille de partage, sinon toast « Message copié : collez-le dans la conversation de votre choix. » | toast « Le message n’a pas pu être copié. Prévenez votre proche directement. » | non | components/tickets/TransferModal.tsx:117, 120 | Conforme. Annuler : sans objet. |
| « Confirmer » (fenêtre « Confirmez votre mot de passe ») | vérifie le mot de passe | la fenêtre se ferme, le transfert repart | mot de passe faux : sous le champ ; autres : bandeau « Confirmation impossible » ; fermeture : bandeau « Transfert interrompu : votre mot de passe est demandé pour continuer. » | — | components/auth/PasswordConfirmDialog.tsx:143, 159-163 ; components/tickets/TransferModal.tsx:221 | Conforme ; panne : toast qui reste. Annuler : sans objet. |

### Mes billets : onglet « Reçus »

| Action | Fait | Réussite aujourd’hui | Erreur aujourd’hui | Confirmation | Fichier | Ce qu’il faudra |
|---|---|---|---|---|---|---|
| « Accepter le billet » / « Ajouter à mes billets » | accepte | toast (texte du serveur ou « Billet ajouté à vos billets. ») + liste relue | bandeau « Action non effectuée » (reste) ; « Le billet n’a pas pu être accepté (erreur NNN). » ; numéro non confirmé : ouvre « Confirmer mon numéro » | oui, « Accepter ce billet ? » / « Ajouter ce billet à vos billets ? » | components/tickets/IncomingTransfers.tsx:200, 193, 205, 228-232 ; fenêtre 364 | Réussite conforme. Panne : toast qui reste + « Réessayer », sans code. Annuler : non (expéditeur prévenu, nouveau QR). |
| « Refuser » | refuse | toast (texte du serveur ou « Billet refusé. ») | bandeau « Action non effectuée » ; « Le billet n’a pas pu être refusé (erreur NNN). » | oui, « Refuser ce billet ? » / « Refuser cette invitation ? » | components/tickets/IncomingTransfers.tsx:167, 164, 172 ; fenêtre 379 | Idem. Annuler : non (expéditeur prévenu ; invitation annulée, place rendue). |
| « Recevoir le code » / « Renvoyer le code » (fenêtre « Confirmer mon numéro ») | envoie un SMS | bandeau « Code envoyé par SMS. Il reste valable 10 minutes. » | bandeau « Vérification impossible » ; « Le code n’a pas pu être envoyé (erreur NNN). » | non (demandé par la personne) | components/tickets/PhoneVerifyDialog.tsx:87, 170, 82, 190-194 | Message dans la fenêtre suffisant ; panne : toast qui reste ; sans code. Annuler : non (SMS parti). |
| « Confirmer » (même fenêtre) | valide le code | fenêtre fermée + toast « Numéro confirmé. Les billets qui vous attendent s’affichent maintenant. » | bandeau pour tout, code faux compris (« Saisissez les 6 chiffres du code reçu par SMS. ») ; « Le code n’a pas pu être vérifié (erreur NNN). » | — | components/tickets/PhoneVerifyDialog.tsx:101, 113, 190-194 ; components/tickets/IncomingTransfers.tsx:394 | Code faux : sous le champ ; sans code. Annuler : sans objet. |

Chargement de l’onglet : « (erreur NNN) » possible (components/tickets/IncomingTransfers.tsx:110, 113).

### Connexion (/login)

| Action | Fait | Réussite aujourd’hui | Erreur aujourd’hui | Confirmation | Fichier | Ce qu’il faudra |
|---|---|---|---|---|---|---|
| « Se connecter » | se connecte | arrivée sur l’espace du compte (après 0,4 s) | bandeau en haut du formulaire pour tout : champs vides, « Identifiant ou mot de passe incorrect. (N tentatives restantes…) », réseau (compté comme un échec) ; blocage : bandeau « Saisie temporairement bloquée » | — | components/auth/LoginForm.tsx:597-599, 334, 251, 362, 387, 541-557 | Écran de résultat suffisant. Champs vides : sous les champs. Réseau : toast qui reste + « Réessayer », sans compter d’échec. |
| « Recevoir le code SMS » / « Renvoyer le code » | envoie un SMS | bandeau vert « Code de confirmation envoyé par SMS au +221… » | bandeau : numéro invalide, « Aucun compte associé… », envoi impossible, réseau | non | components/auth/LoginForm.tsx:448, 601-603, 402, 423, 442, 451 | Numéro invalide : sous le champ ; panne : toast qui reste. Annuler : non (SMS parti). |
| « Valider et se connecter » | valide le code | arrivée sur l’espace du compte | bandeau « Code incorrect ou expiré. » (cases en rouge) ; réseau | — | components/auth/LoginForm.tsx:489, 465, 500, 522 | Code faux : sous les cases ; réseau : toast qui reste. Annuler : sans objet. |

### Inscription (/register)

| Action | Fait | Réussite aujourd’hui | Erreur aujourd’hui | Confirmation | Fichier | Ce qu’il faudra |
|---|---|---|---|---|---|---|
| « Recevoir le code par SMS » / « Recevoir un nouveau code » | envoie un SMS | étape 2 + bandeau « Code envoyé par SMS au … » / « Nouveau code envoyé au … » | bandeau en haut : numéro invalide, déjà inscrit (+ « Recevoir un code de connexion »), « Le code n’a pas pu être envoyé (erreur NNN). Réessayez. », réseau | non | app/register/page.tsx:234, 414-416, 213, 225, 237, 381-392 | Numéro invalide : sous le champ ; sans code ; panne : toast qui reste. Annuler : non (SMS parti). |
| « Créer mon compte » | s’inscrit | arrivée sur la page demandée, ou bandeau du lien email + « Continuer » | code SMS, email, parrainage : sous le champ ; prénom, nom, mot de passe : bandeau en haut ; « Le compte n’a pas pu être créé (erreur NNN). » ; réseau | — | app/register/page.tsx:503-505, 586, 613, 271, 280, 336, 419-436 | Prénom, nom, mot de passe : sous le champ ; sans code ; panne : toast qui reste. Annuler : sans objet. |

### Mot de passe oublié (/forgot-password)

| Action | Fait | Réussite aujourd’hui | Erreur aujourd’hui | Confirmation | Fichier | Ce qu’il faudra |
|---|---|---|---|---|---|---|
| « Envoyer le lien de récupération » | envoie un email | écran « Lien envoyé » | bandeau : « Adresse email invalide. Vérifiez votre saisie. », serveur, réseau | — | app/forgot-password/page.tsx:583-609, 201, 224, 231, 473-475 | Écran de résultat suffisant ; email invalide : sous le champ ; panne : toast qui reste. |
| « Envoyer le code SMS » / « Renvoyer le code » (et « Continuer » si la saisie n’est pas reconnue) | envoie un SMS | étape 2 + bandeau « Si un compte est associé à ce numéro, un code de récupération vient de lui être envoyé par SMS. » | bandeau : numéro invalide, « Saisissez une adresse email ou un numéro de téléphone sénégalais valide. », serveur, réseau | — | app/forgot-password/page.tsx:279, 478-480, 249, 293, 271, 282 | Erreurs de saisie : sous le champ ; panne : toast qui reste. Annuler : non (SMS parti). |
| « Valider le code » | valide le code | page « Nouveau mot de passe » | bandeau : code faux + tentatives restantes, session non ouverte, réseau (compté comme un échec) | — | app/forgot-password/page.tsx:331, 339, 352, 378 | Code faux : sous les cases ; réseau : toast qui reste, sans compter d’échec. |

### Nouveau mot de passe (/reset-password)

| Action | Fait | Réussite aujourd’hui | Erreur aujourd’hui | Confirmation | Fichier | Ce qu’il faudra |
|---|---|---|---|---|---|---|
| « Définir le nouveau mot de passe » | change le mot de passe, ferme toutes les sessions | toast « Mot de passe mis à jour avec succès. Veuillez vous connecter. » + connexion avec le bandeau « Mot de passe modifié : connectez-vous avec le nouveau. » (double) | bandeau en haut : règle, correspondance (bouton inactif avant), refus du serveur, « Une erreur inattendue s’est produite. Réessayez dans un instant. » (comptée comme un échec) ; correspondance dite en direct sous la confirmation | non (note : toutes les sessions sont fermées) | app/reset-password/page.tsx:286, 335, 404-406, 282, 312, 340, 462-471 | Un seul retour (le bandeau de la connexion suffit) ; réseau : toast qui reste. Annuler : non (sessions fermées). |

### Vérifier mon adresse email (/verify-email)

| Action | Fait | Réussite aujourd’hui | Erreur aujourd’hui | Confirmation | Fichier | Ce qu’il faudra |
|---|---|---|---|---|---|---|
| « Confirmer mon adresse » | valide l’adresse | bandeau « Adresse vérifiée » + « Ouvrir mon profil » | bandeau « Vérification impossible » (lien non valable, expiré, déjà servi) ou « Vérification interrompue » (panne, bouton gardé) | — | app/verify-email/page.tsx:105-119 | Conforme : écran de résultat suffisant. |

### Activer mon compte (/activation)

| Action | Fait | Réussite aujourd’hui | Erreur aujourd’hui | Confirmation | Fichier | Ce qu’il faudra |
|---|---|---|---|---|---|---|
| « Activer mon compte » | active le compte | bandeau « Compte activé » + « Aller à la connexion » | mot de passe : sous le champ ; « Les deux mots de passe ne correspondent pas. » sous le premier champ, pas sous la confirmation ; lien refusé ou panne : bandeau « Activation impossible » / « Activation interrompue » | — | app/activation/page.tsx:61, 65, 130, 107-117 | Écran de résultat suffisant ; non-correspondance sous « Confirmer le mot de passe ». |

### Invitations à contrôler (/invitations)

| Action | Fait | Réussite aujourd’hui | Erreur aujourd’hui | Confirmation | Fichier | Ce qu’il faudra |
|---|---|---|---|---|---|---|
| « Accepter l’invitation » | accepte (rôle contrôleur) | toast (texte du serveur ou « Invitation acceptée. ») + bandeau « Vous contrôlez maintenant les événements de … » + « Ouvrir le scanner » | bandeau « Réponse non enregistrée » | non | app/invitations/page.tsx:84, 104-112, 114-118 | Un seul retour (le bandeau suffit) ; panne : toast qui reste. Annuler : non (aucun bouton pour se retirer). |
| « Refuser » | refuse | toast (texte du serveur ou « Invitation refusée. ») | bandeau « Réponse non enregistrée » | oui, « Refuser cette invitation ? » | app/invitations/page.tsx:84, 89 ; fenêtre 197 | Conforme ; panne : toast qui reste. Annuler : non (l’organisateur doit réinviter). |

### Mon profil (/profile)

| Action | Fait | Réussite aujourd’hui | Erreur aujourd’hui | Confirmation | Fichier | Ce qu’il faudra |
|---|---|---|---|---|---|---|
| « Choisir une photo » | envoie la photo | toast « Photo de profil enregistrée. » | bandeau « Photo non enregistrée » (format, taille, refus, réseau) | non | components/profile/AvatarEditor.tsx:48, 35, 39, 108-112 | Réussite conforme ; panne : toast qui reste + « Réessayer ». Annuler : oui (« Supprimer la photo »). |
| « Supprimer la photo » | supprime | toast « Photo de profil supprimée. » | bandeau « Photo non enregistrée » | oui, « Supprimer votre photo ? » | components/profile/AvatarEditor.tsx:64, 68 ; fenêtre 117 | Conforme. Annuler : non (fichier effacé, à renvoyer). |
| « Enregistrer le profil » | enregistre | toast « Profil enregistré. » (+ bandeau du lien si l’email change) | sous le champ (prénom, nom, email, email pris) ; sinon bandeau « Enregistrement impossible » ; mot de passe demandé pour changer l’email | non | components/profile/ProfileForm.tsx:139, 153, 297-301, 195 | Conforme ; panne : toast qui reste. Annuler : en ressaisissant (email : lien déjà envoyé). |
| « Recevoir le lien de vérification » | envoie un email | bandeau « Lien envoyé à … Il est valable 24 heures. » | bandeau (texte du serveur) | non | components/profile/ProfileForm.tsx:205, 210, 294-296 | Message dans la page voulu (il doit rester lisible) : conforme. Annuler : non (email parti). |
| « Recevoir le code » / « Renvoyer le code » (fenêtre « Changer de numéro ») | envoie un SMS au nouveau numéro | étape 2 + bandeau « Code envoyé par SMS. Il reste valable 10 minutes. » | numéro invalide, pris ou inchangé : sous le champ (étape 1 seulement) ; sinon bandeau « Changement impossible » | non (mot de passe redemandé) | components/profile/PhoneChangeDialog.tsx:107, 112-113, 123, 231, 259-264 | Conforme ; panne : toast qui reste. Annuler : non (SMS parti). |
| « Confirmer » (même fenêtre) | change le numéro | fenêtre fermée + toast « Numéro modifié. Vos autres appareils ont été déconnectés. » | bandeau « Changement impossible » (code faux compris, cases en rouge) | non (texte d’avertissement + code reçu) | components/profile/PhoneChangeDialog.tsx:132, 152, 256 ; components/profile/ProfileForm.tsx:218 | Code faux : sous les cases. Annuler : non (autres appareils déconnectés, SMS à l’ancien numéro). |
| « Changer le mot de passe » (fenêtre « Changer mon mot de passe ») | change le mot de passe | bandeau « Mot de passe changé » dans la fenêtre | sous le champ (actuel faux, trop faible, saisies différentes) ; sinon bandeau « Changement impossible » | — | components/profile/PasswordChangeDialog.tsx:209-214, 227, 243, 260, 264-268 | Conforme (écran de résultat). Annuler : non (autres appareils déconnectés). |
| « Clair » / « Sombre » / « Système » | règle l’affichage | changement visible | — | — | app/profile/page.tsx:321-339 | Conforme. |
| « Se déconnecter » | se déconnecte (cet appareil) | page de connexion | rien (console seulement) ; les billets hors ligne du téléphone sont effacés sans le dire | non | app/profile/page.tsx:346 ; components/providers/AuthProvider.tsx:237, 246-255 | Prévenir quand des billets hors ligne seront effacés. Annuler : non. |
| « Déconnecter tous mes appareils » | déconnecte partout | page de connexion | texte rouge sous le bouton ; texte brut du navigateur possible (« Failed to fetch ») ; pas d’état « en cours » | oui, « Déconnecter tous mes appareils ? » | app/profile/page.tsx:356, 365, 368 | Bouton occupé pendant l’envoi ; erreur : toast qui reste + « Réessayer », jamais le texte brut. Annuler : non. |

### Préférences de notification (/profile/notifications)

| Action | Fait | Réussite aujourd’hui | Erreur aujourd’hui | Confirmation | Fichier | Ce qu’il faudra |
|---|---|---|---|---|---|---|
| Interrupteurs par sujet et canal (ex. « SMS ») | enregistre | toast « {Sujet} : {canal} activé. » / « … désactivé. » | double : message sous l’interrupteur + toast qui se ferme « « X » pour « Y » n’a pas été modifié. … » ; « Préférence non enregistrée (erreur NNN). » | non | app/profile/notifications/page.tsx:229, 227, 218, 333 | Un seul retour : toast qui reste + « Réessayer » ; sans code. Annuler : oui (rebasculer). |
| « Activer les notifications » | s’abonne (push) | toast « Notifications activées sur cet appareil. » + carte à jour | bandeau « Action impossible » ; texte brut du navigateur possible (« Failed to fetch ») | non (autorisation du navigateur) | components/notifications/PushDeviceCard.tsx:107, 108-112, 193-197 | Réussite conforme ; panne : toast qui reste, jamais le texte brut. Annuler : oui (« Désactiver »). |
| « Désactiver » | se désabonne | toast « Notifications désactivées sur cet appareil. » | bandeau « Action impossible » ; texte brut possible | non | components/notifications/PushDeviceCard.tsx:123, 127 | Idem. Annuler : oui (réactiver). |
| « Envoyer une notification d'essai » | envoie | toast (texte du serveur ou « Notification d’essai envoyée : elle arrive dans la minute. ») | bandeau ; « La notification d’essai n’a pas pu être envoyée (erreur NNN). » ; réseau | non | components/notifications/PushDeviceCard.tsx:140, 142, 146 | Réussite conforme ; erreur : toast qui reste, sans code. Annuler : sans objet. |

Chargement : « (erreur NNN) » possible (app/profile/notifications/page.tsx:98, 101).

### Notifications (/notifications) et cloche de l’en-tête

| Action | Fait | Réussite aujourd’hui | Erreur aujourd’hui | Confirmation | Fichier | Ce qu’il faudra |
|---|---|---|---|---|---|---|
| « Marquer comme lue » | enregistre | la carte passe en lue (liste relue) | toast qui se ferme « Cette notification n’a pas pu être marquée comme lue. Réessayez. » ; réseau | non | app/notifications/page.tsx:278, 284 | Changement visible suffisant ; erreur : toast qui reste + « Réessayer ». Annuler : non. |
| « Tout marquer comme lu » | enregistre | toast « Toutes vos notifications sont marquées comme lues. » | toast qui se ferme « Vos notifications n’ont pas pu être marquées comme lues. Réessayez. » ; réseau | non | app/notifications/page.tsx:303, 300, 307 | Réussite conforme ; erreur : toast qui reste. Annuler : non (pas de « non lu »). |
| Cloche : « Tout marquer comme lu » | enregistre | compteur à 0 tout de suite | rien : le compteur revient sans explication | non | components/notifications/NotificationBell.tsx:284-301 | Toast d’erreur qui reste. Annuler : non. |
| Cloche : coche « Marquer comme lue : {titre} » | enregistre | la ligne passe en lue | rien (console) | non | components/notifications/NotificationBell.tsx:264-282 | Toast d’erreur qui reste. Annuler : non. |

Chargement de la page : « (erreur NNN) » possible (app/notifications/page.tsx:123, 129).

### Portefeuille de parrainage (/wallet)

| Action | Fait | Réussite aujourd’hui | Erreur aujourd’hui | Confirmation | Fichier | Ce qu’il faudra |
|---|---|---|---|---|---|---|
| « Copier mon lien » | copie | toast « Lien de parrainage copié. » + bouton « Lien copié » 2 s | toast « Copie impossible : sélectionnez le lien et copiez-le manuellement. » | non | app/wallet/page.tsx:458, 462 | Conforme. Annuler : sans objet. |
| « Recevoir le code de confirmation » / « Renvoyer un code » | envoie un SMS (code du retrait) | toast « Code de confirmation envoyé par SMS. » + étape du code avec récapitulatif | opérateur, numéro, montant : sous le champ ; autres : bandeau rouge ; « Le code de confirmation n’a pas pu être envoyé (erreur NNN). » ; réseau | non | app/wallet/page.tsx:508, 493-498, 511, 701-706, 758, 786, 811 | Champs : conforme ; panne : toast qui reste, sans code. Annuler : non (SMS parti). |
| « Confirmer le retrait » | retire (argent) | écran « Retrait versé » / « Retrait en cours de traitement » / « Retrait refusé par l’opérateur » | code faux : sous le champ ; autres champs : retour au formulaire, sous le champ ; sinon bandeau rouge ; « Le retrait n’a pas pu être demandé (erreur NNN). » ; réseau « Connexion interrompue : la demande n’a peut-être pas abouti… » | oui de fait : récapitulatif (montant, frais, « Vous recevrez ») + code SMS, pas de fenêtre | app/wallet/page.tsx:935-990, 537-546, 563, 906 | Écran de résultat suffisant ; sans code ; panne : toast qui reste + « Réessayer ». Annuler : non (argent versé ou réservé). |

Chargement du solde : « Le solde n’a pas pu être chargé (erreur NNN). » (L400).

### Navigation commune (menu et en-tête)

| Action | Fait | Réussite aujourd’hui | Erreur aujourd’hui | Confirmation | Fichier | Ce qu’il faudra |
|---|---|---|---|---|---|---|
| Icône « Se déconnecter » (menu ordinateur et téléphone) | se déconnecte | page de connexion | rien ; billets hors ligne effacés sans le dire | non | components/layout/AppLayout.tsx:400, 467 ; components/providers/AuthProvider.tsx:237 | Prévenir quand des billets hors ligne seront effacés. Annuler : non. |
| « Basculer le thème » | règle l’affichage | changement visible | — | — | components/ui/ThemeToggle.tsx:25 | Conforme. |

### Contrôleur : activation (/controller/setup)

| Action | Fait | Réussite aujourd’hui | Erreur aujourd’hui | Confirmation | Fichier | Ce qu’il faudra |
|---|---|---|---|---|---|---|
| « Activer mon compte » | active le compte (code SMS + mot de passe) | écran « Compte activé », puis scanner (ou connexion avec « Compte activé avec succès… ») | tout en bandeau « Activation impossible » : numéro, code, règle, correspondance (aussi sous la confirmation) ; « Activation impossible (erreur NNN). Réessayez. » ; réseau | — | app/controller/setup/page.tsx:111, 115, 119, 123, 141, 150, 185-189, 261 | Écran de résultat suffisant ; erreurs de champ sous le champ ; sans code ; panne : toast qui reste. |

### Contrôleur : profil et en-tête (/controller/profile, /controller/*)

| Action | Fait | Réussite aujourd’hui | Erreur aujourd’hui | Confirmation | Fichier | Ce qu’il faudra |
|---|---|---|---|---|---|---|
| « Modifier le mot de passe » | change le mot de passe | toast « Mot de passe modifié. » + champs vidés | tout en bandeau « Mot de passe non modifié » (actuel vide ou faux, règle, correspondance) ; « Mot de passe non modifié (erreur NNN). » ; réseau | — | app/controller/profile/page.tsx:174, 151, 155, 159, 171, 180, 294-298 | Erreurs de champ sous le champ ; sans code ; panne : toast qui reste. Annuler : non. |
| Icône « Se déconnecter » (en-tête, hors scanner) | se déconnecte | page de connexion | rien (aucune capture d’erreur) ; pas d’état « en cours » | oui, « Se déconnecter ? » | app/controller/layout.tsx:54-66, 103, 127 | Bouton occupé ; erreur : toast qui reste. Annuler : non. |

Chargement du profil : « Profil indisponible (erreur NNN). » (app/controller/profile/page.tsx:121).

### Contrôleur : scanner (/controller/scanner), contrôle

Le résultat d’un scan reste en plein écran (couleurs fixes) : aucun toast proposé à la place.

| Action | Fait | Réussite aujourd’hui | Erreur aujourd’hui | Confirmation | Fichier | Ce qu’il faudra |
|---|---|---|---|---|---|---|
| « Commencer le contrôle » | démarre la caméra | écran du scanner | — | — | components/scan/ScannerStartScreen.tsx:204-206 | Retour clair. |
| « Enregistrer cette porte » (fenêtre « Choisir ma porte », par « Changer de porte ») | enregistre | toast « Votre porte : {nom}. » + fenêtre fermée | bandeau « Porte non changée » ; texte brut du navigateur possible (« Failed to fetch ») | non | components/scan/ScannerStartScreen.tsx:83, 88, 98, 57-63 | Réussite conforme ; panne : message clair, jamais le texte brut. Annuler : oui (rechoisir, si l’organisateur le permet). |
| Lecture d’un QR (caméra) | scanne | « Envoi… », « Réseau lent », puis plein écran coloré + vibration ; même billet en moins de 20 s : « Même billet que l’entrée validée à … : présentez le billet suivant. » | plein écran neutre (« Résultat inconnu : scannez de nouveau », « Hors ligne : rien n’est validé »…) ; session expirée : renvoi à la connexion sans explication | — | app/controller/scanner/page.tsx:820, 1088-1092, 1021-1033, 1234-1259, 386 | Plein écran clair, à garder. Session expirée : dire « Reconnectez-vous pour reprendre le contrôle » sur la connexion. Annuler : non (entrée validée). |
| « Vérifier le billet » (saisie manuelle) | vérifie (lecture seule) | fiche du titulaire + « Résultat prévu » | bandeau « Aucun billet de cet événement ne porte ce numéro » / « Vérification impossible » | — | components/scan/ManualEntryForm.tsx:104-114, 116-177 | Retour clair. |
| « Pièce conforme, valider l’entrée » | valide l’entrée | plein écran du résultat | plein écran | oui de fait : case « Pièce d’identité conforme au titulaire » obligatoire | components/scan/ManualEntryForm.tsx:132-154 | Retour clair. Annuler : non (entrée validée). |
| « Rechercher » (« Liste des invités ») | recherche (comptée dans le quota) | liste, ou « Aucune invitation non utilisée pour ce numéro. » | bandeau « Recherche impossible » | — | components/scan/GuestListPanel.tsx:83, 89, 187, 194 | Retour clair. |
| « Valider l’entrée d’une personne » | valide l’entrée | plein écran du résultat, puis billet suivant du même invité | plein écran | oui de fait : case « J’ai vérifié la pièce d’identité » | components/scan/GuestListPanel.tsx:143-155 | Retour clair. Annuler : non. |
| « Même personne : laisser passer » (plein écran « Déjà passé dans cette zone ») | valide un nouveau passage | nouveau plein écran | plein écran | oui de fait (le plein écran lui-même) | components/scan/CombatFlashOverlay.tsx:317-326 | Retour clair. Annuler : non. |
| Icône ou bouton « Se déconnecter » | se déconnecte | page de connexion | rien (aucune capture d’erreur) ; pas d’état « en cours » | oui, « Se déconnecter ? » | app/controller/scanner/page.tsx:849-859, 897, 906 ; components/scan/ScanStatusBar.tsx:59 | Bouton occupé ; erreur : toast qui reste. Annuler : non. |
| « Torche éteinte » / « Torche allumée » | allume la torche | libellé du bouton | rien (console) | — | components/scan/CameraQrScanner.tsx:481, 544-553 | Dire « Torche indisponible » en cas de refus. |
| « Retour au scan après une entrée validée » (« Réglages de cet appareil ») | enregistre sur l’appareil | valeur choisie | rien (console) | — | app/controller/scanner/page.tsx:861-868, 1144-1151 | Conforme (réglage local). |

« Changer d’événement » (icône) ramène à l’écran de choix sans confirmation (rien n’est perdu côté serveur). « Caméra » / « Saisie manuelle », « Reprendre le contrôle », « Changer de caméra » et « Réessayer » (caméra indisponible) sont locaux, avec des messages clairs (« Caméra indisponible », « Démarrage de la caméra… »).

### Contrôleur : scanner, guichet et caisse

| Action | Fait | Réussite aujourd’hui | Erreur aujourd’hui | Confirmation | Fichier | Ce qu’il faudra |
|---|---|---|---|---|---|---|
| « J’ai reçu X F CFA : valider la vente » (onglet Guichet) | vend en espèces (entrées immédiates, reçu SMS) | bandeau « Vente enregistrée : N entrées, X encaissés. Reçu SMS envoyé à l’acheteur. » | bandeau « Vente non enregistrée » (texte du serveur ou « Vente refusée. ») ; réseau « Réseau indisponible : la vente n’est pas confirmée… » ; numéro d’acheteur refusé en bandeau (NON VÉRIFIÉ : texte du serveur) | oui de fait : libellé du bouton + « À encaisser », pas de fenêtre | components/scan/CounterSalePanel.tsx:165, 252, 157, 173, 251, 269-272 | Réussite : bandeau ou toast court ; panne : toast qui reste + « Réessayer ». Annuler : non (entrées validées, argent encaissé, SMS parti). |
| « Ouvrir la caisse » (fenêtre « Ouvrir ma caisse ») | ouvre la caisse | fenêtre fermée, bandeau d’état « Caisse ouverte depuis … », aucun message | montant et PIN : sous le champ ; sinon bandeau « Ouverture refusée » ; réseau | oui de fait : PIN du régisseur | components/shifts/ShiftModals.tsx:133, 149, 98-99, 106, 123 ; components/scan/ScannerShiftBanner.tsx:32-71 | Toast court « Caisse ouverte » ; panne : toast qui reste. Annuler : non (seulement clôturer). |
| « Clôturer la caisse » / « Clôturer avec l’écart » | clôture la caisse | fenêtre « Caisse clôturée » (Z de caisse) | montant : sous le champ ; écart : bandeau « Écart constaté » + justification ; justification refusée : bandeau « Clôture refusée », pas sous la zone de texte ; réseau | non (pas de confirmation séparée) | components/shifts/ShiftModals.tsx:201, 223-229, 232, 274, 284, 289-308, 337-374 | Confirmation avant (irréversible) ; justification refusée sous la zone de texte ; écran de résultat suffisant. Annuler : non (caisse clôturée). |
| « Imprimer le Z » | imprime | fenêtre d’impression du navigateur | — | — | components/shifts/ShiftModals.tsx:346 | Conforme. |

### Écrans sans action, chargements et services fermés

- Explorer (/explore) : recherche et filtres seulement ; chargement en échec avec « Réponse inattendue du serveur (erreur NNN). » / « Le catalogue n’a pas pu être chargé (erreur NNN). » possible (lib/events/catalog-client.ts:108, 112), même source que l’accueil.
- Aide (/aide) : liens WhatsApp, téléphone et email seulement. Billet hors ligne (/billet/hors-ligne), Mes paiements (/profile/payments), Mes soirées (/profile/soirees) : lecture seule.
- Page introuvable : « Erreur 404 » affiché (app/not-found.tsx:16 et app/events/[id]/page.tsx:331).
- Redirections : /scan vers /partner/scan ; /tickets/claim/[token] vers /tickets?tab=recus.
- Services fermés, hors périmètre : salles (/halls), commandes (/orders), restaurants (/restaurants/[id]/menu et /tables), abonnements (côté partenaire) ; pages de développement /dev/paiements.

### Écarts à la règle les plus gênants

1. Erreurs d’argent et de billet en toast qui disparaît seul, sans « Réessayer » : annulation de paiement, remboursement, annulation de transfert, réservation gratuite, PDF (app/paiement/[id]/page.tsx:662-672 ; components/tickets/TicketCard.tsx:436-439, 469-472 ; app/events/[id]/page.tsx:753-769).
2. Codes techniques : « (erreur NNN) » possible dans 18 actions (retrait, paiement, remboursement, annulation, transfert, inscription, activation et mot de passe du contrôleur…), « Failed to fetch » brut dans 4 (push ×2, « Déconnecter tous mes appareils », choix de porte), « Erreur 404 » sur 2 pages.
3. Transfert de billet sans confirmation alors qu’il envoie un SMS et verrouille le billet ; double réussite (écran + toast) ; refus du numéro en bandeau au lieu de sous le champ (components/tickets/TransferModal.tsx:174, 300).
4. Erreurs de champ en bandeau en haut du formulaire : connexion (champs, numéro, code), inscription (prénom, nom, mot de passe), mot de passe oublié, activation et profil du contrôleur, codes SMS de « Confirmer mon numéro » et de « Changer de numéro ».
5. Coupure réseau comptée comme un échec d’identification (connexion, mot de passe oublié, nouveau mot de passe) : la saisie peut être bloquée 60 s sans faute de la personne (components/auth/LoginForm.tsx:387 ; app/forgot-password/page.tsx:378 ; app/reset-password/page.tsx:340).
6. Échecs silencieux : cloche (« Tout marquer comme lu », coche « Marquer comme lue » : le compteur revient sans explication), déconnexions du contrôleur (aucune capture), « WhatsApp », torche.
7. Visiteur qui touche « Acheter » : toast d’erreur puis page de connexion qui ne dit pas pourquoi ; scanner en session expirée : même renvoi muet (app/events/[id]/page.tsx:697 ; app/controller/scanner/page.tsx:386).
8. Trois styles pour la même panne réseau (toast qui se ferme, bandeau qui reste, texte rouge sous un bouton) et doubles retours : préférences (toast + message sous l’interrupteur), mot de passe réinitialisé (toast + bandeau), invitation acceptée (toast + bandeau), paiement annulé (toast + écran).
9. Clôture de caisse irréversible sans confirmation, justification d’écart refusée en bandeau (components/shifts/ShiftModals.tsx:226, 274).
10. « Se déconnecter » efface les billets hors ligne du téléphone sans prévenir ; « Déconnecter tous mes appareils » et les déconnexions du contrôleur n’ont pas d’état « en cours » (double appui possible) (components/providers/AuthProvider.tsx:237 ; app/profile/page.tsx:357-372).

## 2. Organisatrice et administration

- **87 actions relevées** (56 côté organisatrice, 31 côté administration ; services fermés exclus), plus 6 chargements automatiques signalés par un toast et 6 écrans dont le chargement peut afficher « (erreur {statut}) » (finances et page professionnelle de l’organisatrice ; réglages, liste et détail des notifications, communications côté admin). Code lu dans event-village-design0 (branche design-0/identite).
- **Réussite** : 85 actions sur 87 ont un retour (54 par toast, 31 par un message dans la page, une fenêtre ou un changement d’écran) ; 2 n’ont rien (« Supprimer la catégorie », « Recevoir un nouveau code ») ; 4 ont un doublon (toast + bandeau ou fenêtre).
- **Erreur** : 25 erreurs générales passent par un toast qui se ferme seul, sans « Réessayer » ; 8 erreurs générales (réseau, serveur) s’écrivent sous un champ « Motif » ou « Nom » ; 13 erreurs de champ sont dites hors du champ (bandeau ou toast) ; 3 actions n’ont aucun retour d’erreur dans l’application (les exports du tableau de bord) et 3 ont un cas muet.
- **Code technique** : 26 actions peuvent en montrer un : statut HTTP « (erreur {statut}) » quand le serveur ne renvoie pas de texte (18), JSON brut avec un code en capitales dans un nouvel onglet (3), message anglais du navigateur comme « Failed to fetch » (5).
- **Confirmation** : 5 actions importantes partent sans confirmation (« Enregistrer les modifications » d’un événement publié, « Valider l’écart », « Enregistrer » un réglage de la plateforme, « Enregistrer les permissions », « Renvoyer le lien ») ; 3 autres ne passent que par leur fenêtre de saisie (dossier complété une seule fois, invitation d’un contrôleur, création d’un compte). Aucun toast ne propose « Annuler » ; la dernière colonne dit, par « Annuler : … », si une annulation après coup serait possible.
- **alert()** : 0 ; **window.confirm()** : 0 ; **prompt()** : 0 (ni dans ce périmètre, ni ailleurs dans app/ et components/).

### Organisatrice — Inscription (/partner/register)

| Action | Fait | Réussite aujourd'hui | Erreur aujourd'hui | Confirmation | Fichier | Ce qu'il faudra |
|---|---|---|---|---|---|---|
| « Envoyer mon dossier » | Envoie les pièces et le code SMS | Écran « Vérifiez votre numéro » (étape 2) | Champs : sous le champ + liste en tête ; serveur, réseau : bandeau en tête ; « Dossier non enregistré (erreur {statut}). » | Non | app/partner/register/page.tsx:242, 449, 482 | Écran de résultat suffisant ; erreur générale : toast qui reste + « Réessayer » ; retirer « (erreur N) ». Annuler : sans objet (rien n’est créé) |
| « Vérifier le code » | Crée le compte et la fiche | Écran « Dossier reçu » | Bandeau « Code non accepté » au-dessus du code ; pièces expirées : retour au formulaire avec bandeau | Non | app/partner/register/page.tsx:415, 457, 291 | Écran suffisant ; code faux : sous le champ du code ; réseau : toast qui reste. Annuler : non |
| « Renvoyer le code » | Renvoie le SMS | Bandeau vert « Nouveau code envoyé par SMS. L’ancien ne fonctionne plus. » | Bandeau « Code non accepté » ; « Nouveau code non envoyé (erreur {statut}). » | Non | app/partner/register/page.tsx:330, 459, 323 | Toast court ; retirer « (erreur N) ». Annuler : non (SMS parti) |
| « Se déconnecter » (déjà connecté) | Déconnecte | Retour à /login | Aucune (redirigé dans tous les cas) | Non | app/partner/register/page.tsx:403 ; components/providers/AuthProvider.tsx:254 | Écran de résultat suffisant |

### Organisatrice — Tableau de bord (/partner/dashboard)

| Action | Fait | Réussite aujourd'hui | Erreur aujourd'hui | Confirmation | Fichier | Ce qu'il faudra |
|---|---|---|---|---|---|---|
| (automatique, non comptée) démarrage de l’essai | Active l’essai | Bandeau « Période d’essai gratuite en cours » | Toast : texte du serveur, « La période d’essai n’a pas pu démarrer. Rechargez la page pour réessayer. » ou « Connexion impossible : la période d’essai démarrera à votre prochaine visite. » | — | app/partner/dashboard/page.tsx:301, 307, 487 | Toast qui reste + « Réessayer » |
| « Compléter mon dossier » puis « Envoyer mon dossier » | Renvoie les pièces (une seule fois) | Toast : texte du serveur ou « Dossier envoyé : il est de nouveau en cours de vérification. » | Pièces, NINEA, RCCM : sous le champ ; serveur, réseau : bandeau « Dossier non envoyé » dans la fenêtre | Fenêtre de saisie « Compléter mon dossier » (« Une seule fois »), pas de confirmation séparée | app/partner/dashboard/page.tsx:675, 211, 246 | OK ; erreur générale : toast qui reste ; confirmation conseillée (envoi unique). Annuler : non (admins prévenus) |
| Icône « Rapport PDF » (« Télécharger le rapport PDF de {titre} ») | Télécharge | Nouvel onglet avec le PDF | Rien dans l’application ; l’onglet montre le JSON brut, code « CLOSING_REPORT_UNAVAILABLE » | Non | app/partner/dashboard/page.tsx:384 | Télécharger dans la page + toast court ; erreur : toast qui reste + « Réessayer », jamais de JSON |
| Icône « Export CSV » (« Exporter les ventes de {titre} en CSV ») | Exporte | Nouvel onglet ou fichier | Idem, code « ACCOUNTING_EXPORT_UNAVAILABLE » | Non | app/partner/dashboard/page.tsx:392 | Idem |
| Lien « Export comptable » | Exporte tout | Nouvel onglet ou fichier | Idem (JSON brut) | Non | app/partner/dashboard/page.tsx:421-428 | Idem |
| « Clôture » puis « Export CSV / Excel » | Télécharge | Toast « Fichier comptable téléchargé. » | Bandeau « Le téléchargement n’a pas abouti » dans la fenêtre | Non | components/partner/ClosingReportModal.tsx:135, 156 | OK ; erreur : toast qui reste + « Réessayer » |
| « Clôture » puis « Télécharger le PDF » | Télécharge | Toast « Rapport de clôture téléchargé. » | Idem | Non | components/partner/ClosingReportModal.tsx:135, 156 | Idem |

### Organisatrice — Mes événements (/partner/events)

| Action | Fait | Réussite aujourd'hui | Erreur aujourd'hui | Confirmation | Fichier | Ce qu'il faudra |
|---|---|---|---|---|---|---|
| « Soumettre à la validation » | Soumet | Toast « Événement soumis : l’équipe Event Village va vérifier la fiche. » | Fiche incomplète : fenêtre « Soumission impossible : il manque des informations » ; sinon toast | Non | app/partner/events/page.tsx:149, 162, 360 | OK ; erreur générale : toast qui reste ; toast avec « Annuler » (= retirer de la validation) |
| « Retirer de la validation » | Repasse en brouillon | Toast « Événement retiré de la validation : vous pouvez de nouveau le modifier. » | Toast | Non | app/partner/events/page.tsx:149, 162 | OK ; « Annuler » possible (resoumettre) |
| « Publier » | Publie | Toast « Événement publié : la page publique est en ligne et la billetterie est ouverte. » | Toast (la fenêtre reste ouverte) | Oui « Publier l’événement ? » | app/partner/events/page.tsx:149, 162, 312 | Erreur : toast qui reste. Annuler : non (aucun retour en arrière) |
| « Supprimer le brouillon » | Supprime | Toast « Brouillon supprimé. » | Toast | Oui « Supprimer ce brouillon ? » | app/partner/events/page.tsx:189, 193, 386 | Erreur : toast qui reste. Annuler : non (définitif) |
| « Annuler l’événement » | Annule, rembourse, prévient | Toast : texte du serveur ou « Événement annulé. Les participants sont prévenus et les remboursements sont lancés. » | Avis, motif : sous le champ ; refus, réseau : bandeau « L’annulation n’a pas abouti » dans la fenêtre | Oui « Annuler l’événement ? » + titre à retaper | components/events/EventCancelDialog.tsx:145, 231, 244, 247 | Erreur générale : toast qui reste. Annuler : non (avis public parti, remboursements lancés) |

### Organisatrice — Créer ou modifier un événement (/partner/events/new, /partner/events/[id]/edit)

| Action | Fait | Réussite aujourd'hui | Erreur aujourd'hui | Confirmation | Fichier | Ce qu'il faudra |
|---|---|---|---|---|---|---|
| « Enregistrer le brouillon » | Crée l’événement | Toast « Brouillon enregistré. Soumettez-le à la validation depuis la liste de vos événements. » + retour à la liste | Sous chaque champ + récapitulatif en tête ; réseau : « Connexion impossible : rien n’a été enregistré… » ; « Le serveur a refusé la demande (erreur {statut}). » si la réponse est illisible | Non | components/events/EventForm.tsx:751, 948-954 ; components/events/EventTicketing.tsx:472 | OK ; erreur générale : toast qui reste ; retirer « (erreur N) ». Annuler : en supprimant le brouillon |
| « Enregistrer les modifications » | Modifie ; prévient les détenteurs (application + SMS) | Toast « Modifications enregistrées. » + bandeau « Modifications enregistrées » (détenteurs prévenus) : doublon | Sous le champ + récapitulatif ; conflit : bandeau « L’événement a été modifié entre-temps » ; « (erreur {statut}) » possible | Non (seul un bandeau d’information avant) | components/events/EventForm.tsx:778, 893, 904 | Un seul retour ; confirmation quand des détenteurs seront prévenus. Annuler : non (avis parti ; lieu : avis groupé à l’heure) |
| « Créer la catégorie » | Crée | Bandeau vert « Catégorie créée. » dans la carte | Sous le champ + bandeau rouge dans la carte ; « (erreur {statut}) » possible | Non | components/events/EventTicketing.tsx:605, 709, 472 | Toast court ; erreur générale : toast qui reste |
| « Enregistrer la catégorie » | Modifie | Bandeau « Catégorie enregistrée. » | Idem | Non | components/events/EventTicketing.tsx:617, 709 | Idem ; « Annuler » possible (rien n’est envoyé) |
| « Retirer de la vente » (proposé si la suppression est refusée) | Ferme la vente de la catégorie | Bandeau « Catégorie retirée de la vente. » | Bandeau rouge ; « (erreur {statut}) » possible | Non | components/events/EventTicketing.tsx:627, 714 | Toast avec « Annuler » (interrupteur « Catégorie active ») |
| Icône « Supprimer la catégorie {nom} » | Supprime | Rien : la carte disparaît | Bandeau rouge dans la carte ; « (erreur {statut}) » possible | Oui « Supprimer cette catégorie ? » | components/events/EventTicketing.tsx:639-642, 740 | Toast court. Annuler : non (définitif) |
| Affiche (dépôt d’image) | Dépose l’image | Aperçu de l’image | Sous le champ (réseau compris) | Non | components/ui/ImageUpload.tsx:96, 198 | OK ; réseau : toast qui reste |
| (automatique, non comptée) relecture des verrous après une catégorie | Relit | — | Toast « Les règles de la jauge n’ont pas pu être relues : rechargez la page pour les voir à jour. » | — | components/events/EventForm.tsx:601 | Toast qui reste + « Réessayer » |

Sortie avec des modifications non enregistrées : fenêtre « Quitter sans enregistrer ? » (components/events/EventForm.tsx:1289).

### Organisatrice — Pilotage d’un événement, en-tête (/partner/events/[id])

| Action | Fait | Réussite aujourd'hui | Erreur aujourd'hui | Confirmation | Fichier | Ce qu'il faudra |
|---|---|---|---|---|---|---|
| « Publier », « Soumettre à la validation » ou « Retirer de la validation » (selon le statut) | Change le statut | Toast générique « Statut de l’événement mis à jour. » | Toast ; pas de liste des manques (la liste des événements la montre) | « Publier » : oui « Publier l’événement ? » ; les autres : non | app/partner/events/[id]/page.tsx:116, 121, 276 | Message précis comme dans la liste ; erreur : toast qui reste. Annuler : non pour « Publier » |
| « Annuler l’événement » | Annule | Même fenêtre et mêmes retours que dans Mes événements | Idem | Oui (titre à retaper) | app/partner/events/[id]/page.tsx:225, 321 ; components/events/EventCancelDialog.tsx:145 | Idem. Annuler : non |

### Organisatrice — Pilotage, onglet Ventes (?tab=ventes)

| Action | Fait | Réussite aujourd'hui | Erreur aujourd'hui | Confirmation | Fichier | Ce qu'il faudra |
|---|---|---|---|---|---|---|
| « Rechercher le billet » | Cherche le billet | Fiche du billet | Bandeau rouge, numéro vide compris (« Saisissez le numéro du billet. ») | Non | components/partner/pilotage/TicketRefundPanel.tsx:192, 272 | Numéro vide : sous le champ |
| « Rembourser ce billet » ou « Annuler ce billet gratuit » | Rembourse ou annule | Bandeau dans la page : « Remboursement versé », « Remboursement envoyé », « Billet annulé », « Billet annulé, à vous de rembourser »… | Refus : bandeau « Remboursement refusé » (textes clairs) ; serveur, réseau : bandeau « Remboursement non confirmé » dans la confirmation | Oui : motif (« Motif du remboursement ») puis « Confirmer le remboursement ? » | components/partner/pilotage/TicketRefundPanel.tsx:226, 273, 347 | Écran de résultat suffisant ; erreur générale : toast qui reste. Annuler : non (argent versé) |

### Organisatrice — Pilotage, onglet Invitations (?tab=invitations)

| Action | Fait | Réussite aujourd'hui | Erreur aujourd'hui | Confirmation | Fichier | Ce qu'il faudra |
|---|---|---|---|---|---|---|
| « Envoyer les invitations » | Crée des billets, envoie des SMS | Bandeau « Invitations envoyées » ({n} billets pour {n} numéros) | Sous catégorie, numéro, quantité + bandeau (« Vérifiez le formulaire », « Limite d’envoi atteinte », « Envoi non confirmé »…) | Oui « Confirmer l’envoi » | components/partner/pilotage/InvitationsTab.tsx:378, 373, 394 | Toast court ; erreur générale : toast qui reste. Annuler : non (SMS parti) ; chaque invitation reste annulable |
| « Modifier le nom » puis « Enregistrer » | Renomme l’invité | Toast « Nom de l’invité enregistré. » | Sous le champ, même pour le réseau et le serveur | Non | components/partner/pilotage/InvitationsTab.tsx:464, 468, 598 | Erreur générale : toast qui reste, pas sous le champ ; « Annuler » possible |
| « Annuler l’invitation » | Annule le billet, SMS à l’invité | Toast « Invitation annulée : la place revient au stock. » | Toast | Oui « Annuler cette invitation ? » | components/partner/pilotage/InvitationsTab.tsx:479, 484, 569 | Erreur : toast qui reste. Annuler : non (SMS parti) |

### Organisatrice — Équipe (onglet Équipe du pilotage, ?tab=equipe, et page /partner/team)

| Action | Fait | Réussite aujourd'hui | Erreur aujourd'hui | Confirmation | Fichier | Ce qu'il faudra |
|---|---|---|---|---|---|---|
| « Inviter un contrôleur » puis « Inviter » (ou « Inviter sur {n} événements ») | Invite par SMS | Toast : texte du serveur ou « Invitation envoyée. » | Numéro mal saisi : sous le champ ; refus du serveur, même sur un champ : toast | Fenêtre de saisie ; numéro déjà inscrit : « Ce numéro a déjà un compte » puis « Envoyer l’invitation » | components/partner/team/TeamDialogs.tsx:109, 114, 153, 175 | Erreur de champ : sous le champ ; générale : toast qui reste. Annuler : par « Annuler l’invitation » (SMS déjà parti) |
| « Modifier » puis « Enregistrer » | Règle porte, changement de porte, espèces | Toast « Réglages de {nom} enregistrés. Ils s’appliquent à son prochain retour dans le scanner. » | Toast | Seulement pour retirer les espèces avec une caisse ouverte : « Retirer le droit d’encaisser ? » | components/partner/team/TeamDialogs.tsx:234, 239, 292 | Erreur : toast qui reste ; toast avec « Annuler » (rien n’est envoyé) |
| « Retirer de cet événement » (onglet seulement) | Retire, SMS + avis | Toast « {nom} ne contrôle plus « {événement} ». Il ne peut plus scanner ses billets. » | Toast | Oui « Retirer {nom} de « {événement} » ? » | components/partner/team/TeamPanel.tsx:193, 215, 569 | Erreur : toast qui reste. Annuler : non (SMS parti) |
| « Retirer de l’équipe » | Retire, ferme l’accès au scanner | Toast « {nom} est retiré de votre équipe : … » | Toast | Oui « Retirer {nom} de votre équipe ? » | components/partner/team/TeamPanel.tsx:197-199, 215, 582 | Idem. Annuler : non (SMS, déconnexion) |
| « Renvoyer le SMS d’activation » | Renvoie un SMS | Toast : texte du serveur ou « SMS renvoyé. » | Toast | Oui « Renvoyer le code à {nom} ? » | components/partner/team/TeamPanel.tsx:205, 215, 596 | Erreur : toast qui reste. Annuler : non (SMS parti) |
| « Renvoyer l’invitation » | Renvoie un SMS | Toast : texte du serveur ou « C’est fait. » | Toast | Oui « Renvoyer l’invitation à {nom} ? » | components/partner/team/TeamPanel.tsx:210, 215, 603 | Repli « C’est fait. » trop vague ; erreur : toast qui reste. Annuler : non |
| « Annuler l’invitation » | Annule, aucun SMS | Toast : texte du serveur ou « C’est fait. » | Toast | Oui « Annuler l’invitation de {nom} ? » | components/partner/team/TeamPanel.tsx:210, 215, 610 | Idem. Annuler : non (réinviter renvoie un SMS) |
| « Effacer » (invitation expirée ou refusée) | Efface de la liste | Toast : texte du serveur ou « C’est fait. » | Toast | Oui « Effacer cette invitation ? » | components/partner/team/TeamPanel.tsx:210, 215, 617 | Toast avec « Annuler » plutôt qu’une confirmation (NON VÉRIFIÉ : effacement définitif côté serveur) |
| « Enregistrer les zones » | Enregistre zones et portes | Toast : texte du serveur ou « Zones enregistrées. » | Bandeau « Zones non enregistrées » ; le champ fautif reçoit le focus, pas le message | Non | components/partner/zones/ZonesEditor.tsx:195, 365 | Erreur de champ : sous le champ ; générale : toast qui reste |
| « Revenir à une seule entrée » | Supprime les zones | Toast idem | Bandeau | Oui « Revenir à une seule entrée ? » | components/partner/zones/ZonesEditor.tsx:195, 365, 395 | Erreur : toast qui reste. Annuler : non (zones et portes supprimées) |

Admin qui agit sur l’équipe d’une organisatrice (?partnerId=) : un « Motif » est exigé ; dans les fenêtres de confirmation, un motif de moins de 5 caractères laisse le bouton sans effet et rien n’est dit (components/partner/team/TeamDialogs.tsx:39-41, 321).

### Organisatrice — Pilotage, onglet Caisse (?tab=caisse)

| Action | Fait | Réussite aujourd'hui | Erreur aujourd'hui | Confirmation | Fichier | Ce qu'il faudra |
|---|---|---|---|---|---|---|
| « Générer le code PIN » ou « Régénérer le code PIN » | Génère le PIN régisseur | Toast « Nouveau code PIN régisseur généré. » + fenêtre « Nouveau code PIN régisseur » : doublon | Toast (« Génération du code PIN impossible. », texte du serveur, ou « Le code n’a pas été renvoyé par le serveur. Réessayez. ») | Oui « Générer un nouveau code PIN ? » puis, si besoin, « Des caisses sont ouvertes » | components/partner/pilotage/CashTab.tsx:180, 175, 188, 301 | Fenêtre suffisante ; erreur : toast qui reste. Annuler : non (ancien code invalidé) |
| « Copier le code » | Copie le PIN | Toast « Code PIN copié. » + bouton « Code copié » | Toast « Copie impossible : notez le code affiché. » | Non | components/partner/pilotage/CashTab.tsx:199, 202 | Libellé du bouton suffisant |
| « Fermer cette caisse » puis « Clôturer la caisse » (ou « Clôturer avec l’écart ») | Clôture la caisse d’un contrôleur | Toast « Caisse fermée. » + fenêtre « Caisse clôturée » (Z) : doublon | Montant : sous le champ ; justification manquante, refus, réseau : bandeau « Clôture refusée » | Fenêtre de saisie (montant compté) | components/partner/pilotage/CashTab.tsx:345 ; components/shifts/ShiftModals.tsx:274, 284, 340 | Justification : sous le champ ; générale : toast qui reste. Annuler : non |
| « Valider l’écart » | Valide un écart d’espèces | Toast « Écart validé. » | Toast ; mot de passe trop ancien : fenêtre « Confirmez votre mot de passe » | Non | components/partner/pilotage/CashTab.tsx:98, 105, 141 | Confirmation (irréversible) ; erreur : toast qui reste. Annuler : non (aucune route pour revenir) |

### Organisatrice — Pilotage, onglet Clôture (?tab=cloture) et événement annulé

| Action | Fait | Réussite aujourd'hui | Erreur aujourd'hui | Confirmation | Fichier | Ce qu'il faudra |
|---|---|---|---|---|---|---|
| « Exporter les participants » | Exporte un CSV (journalisé) | Toast « Export téléchargé. Il est enregistré dans le journal des exports. » | Finalité absente : sous le choix ; autre : bandeau « L’export n’a pas abouti » | Non | components/partner/pilotage/ClosingTab.tsx:136, 235, 243 | Erreur générale : toast qui reste |
| Case « Remboursé » (ventes au guichet d’un événement annulé) | Marque des espèces rendues | Toast « Vente {réf.} marquée remboursée. » | Bandeau « Marquage non enregistré » dans la confirmation | Oui « Marquer cette vente remboursée ? » | components/partner/pilotage/CashRefundsList.tsx:94-96, 229, 209 | Erreur générale : toast qui reste. Annuler : non (« définitif ») |

### Organisatrice — Finances (/partner/finance)

| Action | Fait | Réussite aujourd'hui | Erreur aujourd'hui | Confirmation | Fichier | Ce qu'il faudra |
|---|---|---|---|---|---|---|
| « Recevoir le code de confirmation » | Prépare un retrait, code SMS | Toast « Code de confirmation envoyé par SMS. » + étape « Code SMS » | Montant : sous le champ ; autre : bandeau « Retrait impossible » ; « Le code de confirmation n’a pas pu être envoyé (erreur {statut}). » | Non | app/partner/finance/page.tsx:460, 444, 646 | Retirer « (erreur N) » ; erreur générale : toast qui reste |
| « Renvoyer un code » | Renvoie le code | Même toast | Mêmes retours | Non | app/partner/finance/page.tsx:829, 460 | Idem |
| « Confirmer le retrait » | Retire de l’argent | Écran « Retrait versé », « Retrait en cours de traitement » ou « Retrait refusé par l’opérateur » | Code : sous le code ; montant, numéro : sous le champ ; autre : bandeau « Retrait impossible » ; « Le retrait n’a pas pu être demandé (erreur {statut}). » | Oui : récapitulatif + code SMS | app/partner/finance/page.tsx:851-865, 488, 820 | Écran de résultat suffisant ; retirer « (erreur N) ». Annuler : non (argent versé) |

Chargement du solde : « Le solde n’a pas pu être chargé (erreur {statut}). » (app/partner/finance/page.tsx:383).

### Organisatrice — Page professionnelle (/partner/profile)

| Action | Fait | Réussite aujourd'hui | Erreur aujourd'hui | Confirmation | Fichier | Ce qu'il faudra |
|---|---|---|---|---|---|---|
| « Enregistrer » | Enregistre la page | Toast « Page professionnelle enregistrée. » | Sous le champ + bandeau « Profil non enregistré » avec le même texte ; « Profil non enregistré (erreur {statut}). » | Non | app/partner/profile/page.tsx:149, 139-141, 340 | Un seul message (sous le champ) ; retirer « (erreur N) » |
| « Logo », « Photo de couverture » (dépôt) | Dépose l’image | Aperçu | Sous le champ | Non | components/ui/ImageUpload.tsx:96, 198 | OK |

Chargement : « Profil indisponible (erreur {statut}). » (app/partner/profile/page.tsx:80).

### Organisatrice — Statistiques (/partner/stats) et Calendrier (/partner/calendar)

| Action | Fait | Réussite aujourd'hui | Erreur aujourd'hui | Confirmation | Fichier | Ce qu'il faudra |
|---|---|---|---|---|---|---|
| « Appliquer » (période personnalisée) | Affiche les chiffres | Chiffres | Dates vides : rien ; serveur : bloc rouge dans la page, non annoncé | Non | app/partner/stats/page.tsx:117, 221 | Dates vides : sous le champ ; générale : toast qui reste |
| (automatique, non comptée) chargement du calendrier | Lit | Calendrier | Réseau : toast « Impossible de charger le calendrier des événements. » ; refus du serveur : rien (calendrier vide) | — | app/partner/calendar/page.tsx:31 | Toast qui reste + « Réessayer » |

### Organisatrice — Contrôle des entrées (/partner/scan)

| Action | Fait | Réussite aujourd'hui | Erreur aujourd'hui | Confirmation | Fichier | Ce qu'il faudra |
|---|---|---|---|---|---|---|
| Lecture d’un QR (mode « Caméra ») | Valide une entrée | Panneau de résultat (4 s) | Même panneau (refus, « Incident technique : le billet n’est pas en cause… ») | Non | app/partner/scan/page.tsx:584 ; components/scan/ScanResultPanel.tsx:88-106 | Écran de résultat suffisant |
| « Vérifier le billet » (saisie manuelle) | Cherche le billet | Bandeau « Accès autorisé » ou aperçu | Bandeaux « Aucun billet de cet événement ne porte ce numéro », « Vérification impossible » | Non | components/scan/ManualEntryForm.tsx:105, 111, 158 | Écran suffisant |
| « Pièce conforme, valider l’entrée » | Valide l’entrée | Panneau de résultat | Panneau de résultat | Case « pièce vérifiée » exigée | components/scan/ManualEntryForm.tsx:152 ; app/partner/scan/page.tsx:584 | Écran suffisant |
| « Ouvrir ma caisse » puis « Ouvrir la caisse » | Ouvre la caisse | La fenêtre se ferme, le guichet apparaît, aucun message | PIN : sous le champ ; autre : bandeau « Ouverture refusée » | Non | components/shifts/ShiftModals.tsx:123, 149 ; app/partner/scan/page.tsx:572 | Toast court « Caisse ouverte » |
| « J’ai reçu {montant} : valider la vente » | Vend au guichet | Bandeau « Vente enregistrée » | Bandeau « Vente non enregistrée » | Non (montant dans le libellé) | components/scan/CounterSalePanel.tsx:252, 251 | Écran suffisant. Annuler : par un remboursement (onglet Ventes) |

### Administration — Fenêtre de sécurité (toutes les pages /admin)

| Action | Fait | Réussite aujourd'hui | Erreur aujourd'hui | Confirmation | Fichier | Ce qu'il faudra |
|---|---|---|---|---|---|---|
| « Continuer » (mot de passe) | Vérifie | La fenêtre se ferme | Bandeau « Vérification impossible » au-dessus du champ | — | components/admin/AdminStepUpGate.tsx:192, 196 | Sous le champ |
| « Recevoir le code par SMS » | Envoie un code | Écran de saisie du code | Bandeau | Non | components/admin/AdminStepUpGate.tsx:201, 192 | OK |
| « Valider le code » | Vérifie | La fenêtre se ferme | Bandeau au-dessus du code | — | components/admin/AdminStepUpGate.tsx:209, 192 | Sous le champ |
| « Recevoir un nouveau code » | Renvoie un code | Rien | Bandeau | Non | components/admin/AdminStepUpGate.tsx:212 | Toast court « Nouveau code envoyé » |
| « Se déconnecter » | Déconnecte | Retour à /login | Aucune | Non | components/admin/AdminStepUpGate.tsx:215-217 | Écran suffisant |

### Administration — Tableau de bord, candidatures des partenaires (/admin/dashboard)

| Action | Fait | Réussite aujourd'hui | Erreur aujourd'hui | Confirmation | Fichier | Ce qu'il faudra |
|---|---|---|---|---|---|---|
| « Valider » ou « Valider la candidature » | Valide, SMS au responsable | Toast « Le partenaire « {nom} » a été validé avec succès. » | Toast | Oui « Valider la candidature ? » | app/admin/dashboard/page.tsx:335, 332, 877 | Erreur : toast qui reste. Annuler : non (SMS parti) |
| « Refuser » | Refuse, SMS avec motif | Toast « La demande du partenaire « {nom} » a été refusée. » | Sous le champ « Motif du refus », même réseau et serveur | Oui « Refuser la candidature » (motif) | app/admin/dashboard/page.tsx:352, 891, 898 | Erreur générale : toast qui reste. Annuler : non (SMS parti) |
| « Suspendre » (dossier) | Suspend, gèle les fonds | Toast « {nom} est suspendu. Événements suspendus avec le compte : {n}. » | Sous le champ « Motif de la suspension » | Oui « Suspendre le partenaire » (motif) | app/admin/dashboard/page.tsx:383 ; components/admin/PartnerStatusDialog.tsx:57, 120 | Idem. Annuler : non (prévenu) ; « Réactiver » existe |
| « Réactiver » (dossier) | Réactive | Toast « {nom} est réactivé. Événements remis en ligne : {n}. » | Sous le champ « Motif de la réactivation » | Oui « Réactiver le partenaire » (motif) | app/admin/dashboard/page.tsx:386 ; components/admin/PartnerStatusDialog.tsx:64, 120 | Idem. Annuler : non (prévenu) |
| « Ouvrir » (pièce d’identité, NINEA ou RCCM) | Ouvre la pièce | Nouvel onglet | Toast « Impossible d'accéder au document justificatif sur le stockage sécurisé. » ; onglet bloqué par le navigateur : rien (NON VÉRIFIÉ) | Non | app/admin/dashboard/page.tsx:209, 212 | Erreur : toast qui reste + « Réessayer » |
| « Actualiser » | Relit chiffres et liste | Chiffres et liste mis à jour | Jusqu’à 2 toasts identiques « Impossible d'actualiser les données du tableau de bord d'administration. » | Non | app/admin/dashboard/page.tsx:230, 271 | Un seul toast qui reste + « Réessayer » |

Lien `?dossier=` d’un partenaire absent de la liste : toast (automatique, non compté) (app/admin/dashboard/page.tsx:404).

### Administration — Événements (/admin/events) et fiche d’un événement (/admin/events/[id])

| Action | Fait | Réussite aujourd'hui | Erreur aujourd'hui | Confirmation | Fichier | Ce qu'il faudra |
|---|---|---|---|---|---|---|
| « Valider » | Valide | Toast « Événement validé : l’organisateur peut maintenant le publier. » | Bandeau « Action impossible » dans la fenêtre | Oui « Valider l’événement ? » | app/admin/events/[id]/page.tsx:433, 200, 811 | Erreur générale : toast qui reste. Annuler : non (organisateur prévenu) |
| « Refuser » | Renvoie en brouillon | Toast « Refus envoyé : l’organisateur voit votre motif. » | Sous le champ « Motif du refus » | Oui « Refuser l’événement » (motif) | app/admin/events/[id]/page.tsx:433, 207, 831 | Erreur générale : toast qui reste. Annuler : non |
| « Publier » | Publie | Toast « Événement publié. » | Bandeau dans la fenêtre | Oui « Publier l’événement ? » | app/admin/events/[id]/page.tsx:433, 228, 811 | Idem. Annuler : non |
| « Suspendre » | Arrête vente et contrôle | Toast « Événement suspendu : la vente et le contrôle d’accès sont arrêtés. » | Sous le champ « Motif de la suspension » | Oui « Suspendre l’événement » (motif) | app/admin/events/[id]/page.tsx:433, 214, 831 | Idem. Annuler : non (détenteurs prévenus) |
| « Réactiver » | Remet en vente | Toast « Événement réactivé : la vente reprend. » | Bandeau dans la fenêtre | Oui « Réactiver l’événement ? » | app/admin/events/[id]/page.tsx:433, 222, 811 | Idem. Annuler : non (prévenus) |
| « Terminer » | Clôt la vente | Toast « Événement terminé. » | Bandeau dans la fenêtre | Oui « Terminer l’événement ? » | app/admin/events/[id]/page.tsx:433, 235, 811 | Idem. Annuler : non |
| « Clore l’événement » (événement suspendu) | Termine | Toast « Événement terminé. » | Sous le champ « Motif de la clôture » | Oui, fenêtre de motif titrée « Terminer l’événement ? » | app/admin/events/[id]/page.tsx:433, 824-831 | Titre de la fenêtre à revoir ; erreur générale : toast qui reste |
| « Annuler l’événement » | Annule, rembourse | Même fenêtre que l’organisatrice | Idem | Oui + titre à retaper | app/admin/events/[id]/page.tsx:563, 834 ; components/events/EventCancelDialog.tsx:143-145 | Idem. Annuler : non |
| (automatique, non comptée) mise à jour en direct | Relit | — | Toasts « La liste n’a pas pu être mise à jour… », « La fiche n’a pas pu être actualisée… » | — | app/admin/events/page.tsx:151 ; app/admin/events/[id]/page.tsx:380 | Toast qui reste + « Réessayer » |

« Ouvrir le pilotage » mène au pilotage de l’organisatrice : mêmes actions et mêmes retours (sections ci-dessus) ; dans Équipe, l’admin donne un motif.

### Administration — Finance, versements à reprendre (/admin/finance)

| Action | Fait | Réussite aujourd'hui | Erreur aujourd'hui | Confirmation | Fichier | Ce qu'il faudra |
|---|---|---|---|---|---|---|
| « Renvoyer » | Relance un versement | Bandeau « Versement envoyé », « Versement confirmé » ou « Versement non parti » | Saisie refusée : bandeau dans la fenêtre ; autre : bandeau « Renvoi refusé » ; « Décision refusée par le serveur (erreur {statut}). » ; réseau : « Résultat inconnu » | Oui « Renvoyer ce versement ? » + justification | components/admin/RefundsToRetry.tsx:413, 529, 277, 454 | Toast court ; retirer « (erreur N) » ; champs : message sous le champ (aujourd’hui bouton grisé sans texte). Annuler : non (argent parti) |
| « Marquer versé » | Marque payé | Bandeau « Versement marqué versé » | Idem (« Marquage refusé ») | Oui « Marquer ce versement versé ? » | components/admin/RefundsToRetry.tsx:273, 413, 529 | Idem. Annuler : non |
| « Constater non versé » | Annule un retrait ou constate | Bandeau « Retrait annulé » ou « Versement constaté non versé » | Idem (« Constat refusé ») ; mot de passe non saisi : bandeau « Mot de passe non saisi » | Oui « Constater que ce versement n’est pas parti ? » + mot de passe | components/admin/RefundsToRetry.tsx:128-129, 262, 413, 529 | Idem. Annuler : non (montant rendu au bénéficiaire) |

### Administration — Réglages de la plateforme (/admin/finance-settings)

| Action | Fait | Réussite aujourd'hui | Erreur aujourd'hui | Confirmation | Fichier | Ce qu'il faudra |
|---|---|---|---|---|---|---|
| « Modifier » puis « Enregistrer » | Change un réglage (frais, taux, services) | Toast « Réglage « {libellé} » enregistré. Il s’applique aux prochaines opérations. » | Tout dans un bandeau « Réglage non enregistré » (valeur, motif, « ACTIVER » compris) ; « Réglage non enregistré (erreur {statut}). » | Non (seul « Tapez ACTIVER » pour ouvrir un service) | app/admin/finance-settings/page.tsx:311, 458, 307 | Champs : sous le champ ; confirmation ; toast avec « Annuler » (ancienne valeur) |

Chargement : « Réglages indisponibles (erreur {statut}). » (app/admin/finance-settings/page.tsx:242).

### Administration — Notifications (/admin/notifications, /admin/notifications/[id])

| Action | Fait | Réussite aujourd'hui | Erreur aujourd'hui | Confirmation | Fichier | Ce qu'il faudra |
|---|---|---|---|---|---|---|
| « Relancer » (détail) | Remet en file d’envoi | Toast « Notification remise en attente : elle repartira au prochain passage de l’envoyeur. » | Bandeau « Relance impossible » ; « La relance a échoué (erreur {statut}). » | Oui « Relancer cette notification ? » | app/admin/notifications/[id]/page.tsx:369, 453, 363, 536 | Retirer « (erreur N) » ; erreur générale : toast qui reste. Annuler : non |

Chargements : « Chargement impossible (erreur {statut}). », « Réponse inattendue du serveur (erreur {statut}). », « Détail indisponible (erreur {statut}). » (app/admin/notifications/page.tsx:125, 128 ; app/admin/notifications/[id]/page.tsx:288, 293).

### Administration — Comptes (/admin/users)

| Action | Fait | Réussite aujourd'hui | Erreur aujourd'hui | Confirmation | Fichier | Ce qu'il faudra |
|---|---|---|---|---|---|---|
| « Créer un Compte / Admin » puis « Créer le compte {rôle} » | Crée, SMS d’activation | Toast « Compte {rôle} de {prénom} {nom} créé. Le lien d’activation est parti par SMS (valable 24 heures). » (SMS raté : toast d’erreur) | Champs vides : bulle du navigateur (champs natifs, pas Field.tsx) ; refus du serveur : toast ; réseau : toast « Failed to fetch » (anglais) | Fenêtre de saisie | app/admin/users/page.tsx:194, 196, 206 | Champs : sous le champ ; erreur générale : toast qui reste, en français. Annuler : non (SMS parti) |
| « Renvoyer le lien » | Renvoie un SMS | Toast « Nouveau lien d’activation envoyé à {nom}. » | Toast (texte du serveur, « Le SMS n’est pas parti. Réessayez dans un instant. » ou « Failed to fetch ») | Non | app/admin/users/page.tsx:224, 225, 228 | Confirmation (SMS) ; erreur : toast qui reste. Annuler : non |
| « Permissions » puis « Enregistrer les permissions » | Change les droits d’un admin | Toast « Les permissions de l'administrateur {nom} ont été enregistrées. » | Toast (« Failed to fetch » possible) | Non | app/admin/users/page.tsx:316, 320 | Confirmation ; toast avec « Annuler » |
| « Suspendre » ou « Réactiver » (compte non partenaire) | Suspend (sessions fermées) ou réactive | Toast « Le compte de {nom} a été suspendu. » ou « … a été réactivé avec succès. » | Sous le champ « Motif », même réseau et serveur | Oui « Suspendre le compte » ou « Réactiver le compte » (motif) | app/admin/users/page.tsx:256-260, 977 | Erreur générale : toast qui reste. Annuler : non (titulaire prévenu) |
| « Supprimer » | Anonymise le compte (RGPD) | Toast « Le compte de {nom} a été définitivement anonymisé (RGPD). » | Toast (« Failed to fetch » possible) | Oui « Anonymiser définitivement ce compte ? » (« Anonymiser & Supprimer ») | app/admin/users/page.tsx:349, 354, 987 | Erreur : toast qui reste. Annuler : non (irréversible) |

### Administration — Communications (/admin/communications)

| Action | Fait | Réussite aujourd'hui | Erreur aujourd'hui | Confirmation | Fichier | Ce qu'il faudra |
|---|---|---|---|---|---|---|
| « Enregistrer le brouillon » | Enregistre une campagne (envoi désactivé) | Toast « Brouillon enregistré : l’envoi immédiat est désactivé. » + bandeau vert identique : doublon | Tout dans un bandeau « Brouillon non enregistré » (titre, message, canal compris) ; « Brouillon non enregistré (erreur {statut}). » | Non | app/admin/communications/page.tsx:187, 229, 292, 182 | Un seul retour ; champs : sous le champ ; retirer « (erreur N) » |

Chargement : « Historique indisponible (erreur {statut}). » (app/admin/communications/page.tsx:128).

### Administration — Parrainage (/admin/referral)

| Action | Fait | Réussite aujourd'hui | Erreur aujourd'hui | Confirmation | Fichier | Ce qu'il faudra |
|---|---|---|---|---|---|---|
| « Promouvoir Ambassadeur ⭐ » ou « Rétrograder » | Change le statut de parrainage | Toast « Le statut Ambassadeur a bien été attribué à {nom}. » ou « … a été retiré pour {nom}. » | Toast avec message brut possible (« Failed to fetch », erreur de lecture JSON en anglais) | Non | app/admin/referral/page.tsx:139-143, 147 | Toast avec « Annuler » (action inverse, aucun message envoyé) ; jamais de message anglais |

### Lecture seule et services fermés

- Sans action qui écrit : /admin/audit (journal), /admin/services (catalogues, lecture), /admin/pricing (renvoi vers les réglages), chiffres de /admin/finance, liste de /admin/notifications, /admin/events (liste).
- Services fermés, non inventoriés : /partner/halls, /partner/orders, /partner/products, /partner/tables, /partner/subscription.

### Écarts à la règle les plus gênants

1. Erreurs générales en toast qui disparaît seul, sans « Réessayer », sur 25 actions dont valider une candidature (app/admin/dashboard/page.tsx:332), retirer un contrôleur (components/partner/team/TeamPanel.tsx:215), générer un PIN et valider un écart (components/partner/pilotage/CashTab.tsx:188, 105) : l’échec passe facilement inaperçu.
2. Actions importantes sans confirmation : modifier un événement publié prévient les détenteurs par SMS (components/events/EventForm.tsx:760-778), « Valider l’écart » est irréversible, réglages de la plateforme, permissions d’un admin, « Renvoyer le lien » (SMS).
3. Les trois exports du tableau de bord de l’organisatrice ouvrent un onglet qui, en cas d’échec, montre le JSON brut avec un code en capitales (app/partner/dashboard/page.tsx:384, 392, 421).
4. « (erreur {statut}) » dans 18 messages, dont le retrait d’argent (app/partner/finance/page.tsx:444, 488) et la reprise des versements (components/admin/RefundsToRetry.tsx:277) ; message anglais « Failed to fetch » dans Comptes et Parrainage (app/admin/users/page.tsx:205 ; app/admin/referral/page.tsx:146).
5. Erreurs réseau ou serveur écrites sous le champ « Motif » de toutes les fenêtres de motif (refuser, suspendre, réactiver un partenaire, un événement, un compte : components/ui/ReasonDialog.tsx:112) et sous « Nom de l’invité » : on croit que son texte est en cause.
6. Erreurs de saisie hors du champ : réglages (app/admin/finance-settings/page.tsx:458), communications (app/admin/communications/page.tsx:292), zones (components/partner/zones/ZonesEditor.tsx:365), justification d’écart (components/shifts/ShiftModals.tsx:274), code SMS (inscription, fenêtre de sécurité), création de compte (bulles du navigateur puis toast).
7. « Annuler » après coup jamais proposé, même sans dégât possible : « Effacer » une invitation, réglages d’un contrôleur, « Retirer de la vente », Ambassadeur, réglages, permissions, nom d’un invité.
8. Réussites dites de trois façons (54 toasts, 31 bandeaux ou écrans, 2 fois rien : « Supprimer la catégorie », « Recevoir un nouveau code ») et 4 doublons (components/events/EventForm.tsx:778 et 893 ; app/admin/communications/page.tsx:187 et 229 ; PIN et Z de caisse).
9. Admin sur l’équipe d’une organisatrice : avec un motif de moins de 5 caractères, le bouton de confirmation ne fait rien et rien n’est dit (components/partner/team/TeamDialogs.tsx:321).
10. Messages pauvres ou répétés : « C’est fait. » (components/partner/team/TeamPanel.tsx:210), « Statut de l’événement mis à jour. » sans la liste des manques dans le pilotage (app/partner/events/[id]/page.tsx:116-121), deux toasts identiques à « Actualiser » (app/admin/dashboard/page.tsx:230, 271).
