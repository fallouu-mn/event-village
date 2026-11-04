# Guide de l'organisateur : les entrées

Ce guide explique comment préparer et tenir les entrées d'un événement avec Event Village : les contrôleurs, le scanner, la saisie manuelle, la caisse, le guichet, et ce qu'il faut faire quand le réseau tombe. Il décrit l'application telle qu'elle est livrée au lot 7.

En bref :

- chaque contrôleur scanne avec son téléphone, dans l'application, connecté à Internet ;
- le résultat s'affiche en plein écran, en couleur, avec un titre en grand ; le téléphone vibre (sur Android) ; **aucun son** n'est émis ;
- **sans réseau, aucune entrée n'est validée** : il faut faire patienter et rétablir le réseau ;
- le spectateur, lui, peut afficher son billet **sans réseau**, s'il l'a ouvert avec du réseau avant d'arriver.

---

## 1. Avant l'événement

### 1.1 Inviter les contrôleurs

Dans votre espace partenaire, page **Équipe** :

1. **Inviter un contrôleur** : son numéro de téléphone (prénom, nom et email sont facultatifs), le ou les événements qu'il contrôlera, et l'option **Encaissement des espèces** s'il doit encaisser (caisse, guichet).
2. Le contrôleur reçoit un SMS avec un **code d'activation valable 24 heures** et un lien. Il ouvre le lien, saisit le code et choisit son mot de passe (8 caractères au moins, avec une majuscule, une minuscule et un chiffre).
3. Tant que le compte n'est pas activé, la page Équipe affiche « Activation en attente ». Si le code a expiré ou s'est perdu, invitez de nouveau le même numéro : un nouveau code est envoyé, l'ancien ne marche plus.

Faites-le **plusieurs jours avant** : un contrôleur qui active son compte le jour même, devant la file, perd du temps.

Pour changer ses événements ou l'encaissement des espèces : page Équipe, **Gérer les affectations**.

### 1.2 Attribuer une porte à chaque contrôleur

Dans la page de pilotage de l'événement (**Mes événements**, puis l'événement), onglet **Équipe** : renseignez le **Point d'entrée** de chaque contrôleur (par exemple « Porte Nord », « Entrée VIP »).

- Avec une porte, l'en-tête du scanner affiche le compteur de cette porte : « Porte Nord : 312 entrées » (toutes les entrées validées à cette porte, par tous ses contrôleurs).
- Sans porte, il affiche les entrées du contrôleur lui-même : « Vos entrées : 12 ».

### 1.3 Générer le code PIN régisseur (si vous encaissez des espèces)

Onglet **Caisse** de la page de pilotage : **Générer le code PIN**. Le code ne s'affiche **qu'une fois** : notez-le et gardez-le pour le régisseur (la personne qui remet et reprend les espèces).

Le PIN co-signe la clôture d'une caisse **quand le montant compté ne correspond pas** aux encaissements enregistrés. Sans PIN, une caisse avec écart ne peut pas être clôturée. Il peut aussi être saisi, facultativement, à l'ouverture d'une caisse.

### 1.4 Le matériel

- **Un téléphone par contrôleur**, chargé, avec une batterie externe pour les longues soirées. Luminosité de l'écran au maximum en plein soleil.
- **Android de préférence** : il vibre à chaque résultat. Un iPhone fonctionne aussi, mais Safari ne permet pas la vibration : le contrôleur doit alors regarder l'écran à chaque scan. L'écran est fait pour se lire d'un coup d'œil, à un mètre.
- **Un routeur 4G dédié par entrée**, si possible sur un opérateur différent de celui de la majorité du public : quand des milliers de personnes arrivent au même endroit, le réseau mobile sature. Prévoyez un **routeur de secours** (ou un second opérateur) à portée de main.
- L'application est en HTTPS : la caméra ne s'ouvre que sur l'adresse officielle de l'application.

Le contrôleur peut installer l'application sur son téléphone (`docs/installer-application.md`) : elle s'ouvre alors depuis une icône, en plein écran.

### 1.5 L'essai de la veille

Chaque contrôleur, sur son propre téléphone :

1. se connecte et ouvre le scanner ;
2. vérifie que son événement et sa porte apparaissent sur l'écran **Commencer le contrôle** ;
3. lance la caméra et scanne un billet de l'événement.

La veille, le contrôle n'est pas encore ouvert (par défaut, il ouvre **6 heures avant le début** et ferme 6 heures après la fin) : le scan affiche « Contrôle pas encore ouvert ». C'est normal, et c'est une bonne vérification : la caméra lit, le serveur répond, l'écran plein s'affiche, le téléphone vibre.

Vérifiez aussi le routeur 4G sur place, à l'endroit exact de chaque entrée.

### 1.6 Prévenir les spectateurs

Le billet n'existe que dans l'application (rubrique **Mes billets**). Son QR code change toutes les 20 secondes : une capture d'écran n'est pas acceptée. L'email de confirmation et la notification de rappel, quelques heures avant le début, le disent déjà. Répétez-le dans votre communication :

> Ouvrez votre billet dans l'application, avec du réseau, avant d'arriver : il restera disponible même sans connexion.

Voir la section 8 pour ce que voit le spectateur.

---

## 2. Le jour J : démarrer le contrôle

Le contrôleur ouvre le scanner :

1. Écran **Commencer le contrôle** : il choisit l'événement (les événements ouverts au contrôle sont en tête) ; l'écran rappelle sa porte et précise que « le téléphone vibre à chaque résultat ; aucun son n'est émis ».
2. Il touche **Commencer le contrôle**. Ce premier toucher autorise aussi la vibration et ouvre la caméra. Ensuite, **aucun bouton à toucher** entre deux billets : l'écran revient tout seul au scan.

En haut de l'écran : le nom de l'événement, le compteur (« Porte Nord : 312 entrées »), et l'état du réseau (**En ligne** ou **Hors ligne**). Deux boutons : changer d'événement, se déconnecter.

En bas : **Derniers scans** (à déplier) donne au contrôleur ses entrées, ses refus par motif et ses 20 derniers scans, et **Réglages de cet appareil** permet de régler le temps d'affichage d'une entrée validée.

La caméra se met en veille après 3 minutes sans lecture, pour la batterie : touchez **Reprendre le contrôle**. Elle s'arrête aussi quand l'application passe en arrière-plan (appel, autre application, écran verrouillé) : au retour, un seul toucher sur **Reprendre le contrôle** la rallume. Le bouton de torche apparaît si le téléphone en a une.

Le contrôleur peut quitter l'application sans rien perdre : après un appel, un passage par une autre page, un rechargement ou la fermeture puis la réouverture de l'application, il retrouve le même événement et le même mode (caméra ou saisie manuelle), sans repasser par le choix de l'événement. Le compteur et les derniers scans sont relus sur le serveur. Un billet scanné juste avant la sortie, dont la réponse n'est pas arrivée, est renvoyé au retour (dans les 2 minutes) sans risque de double entrée : l'écran affiche son résultat avec la mention « Résultat retrouvé ». Si l'événement n'est plus ouvert au contrôle, l'écran de choix revient avec un message. Tout est effacé à la déconnexion.

---

## 3. Ce que voit le contrôleur

Chaque scan affiche un résultat **plein écran** : une couleur, une grande icône, un titre en grand. La couleur n'est jamais le seul signe : l'icône et le titre changent aussi.

| Écran | Titre affiché | Vibration (Android) | Que faire |
|---|---|---|---|
| **Vert**, texte noir | « Entrée validée », puis le **nom du titulaire** en très grand, la catégorie et le numéro du billet | une impulsion courte | Laisser entrer. L'écran revient au scan après 1,5 s (réglable : 1, 1,5, 2 ou 3 s). |
| **Brun-rouge foncé**, texte blanc | « Billet déjà utilisé », avec l'heure : « Entré à 21:04 », ou « Déjà validé par vous à 21:04 » si ce contrôleur vient de le valider | trois impulsions | Refuser. Si c'est le même spectateur qui vient d'entrer par vous, c'est un double passage du même billet. |
| **Rouge foncé**, texte blanc | le motif : « Billet invalide », « Billet annulé », « Billet remboursé », « Billet d'un autre événement », « QR expiré : demandez au client de rafraîchir son billet », « QR dynamique requis (billet ouvert dans l'application) », « Paiement requis », « Saisie manuelle refusée » | trois impulsions | Refuser. Pour « QR expiré » : souvent une capture d'écran ou un billet transféré à quelqu'un d'autre ; demandez au spectateur d'ouvrir son billet dans l'application. |
| **Bleu foncé**, texte blanc | « Encaissement requis : 5 000 F CFA » | deux impulsions longues | Le billet n'est pas encore payé : il se règle sur place, en espèces. Voir la section 6. L'écran attend une décision. |
| **Jaune**, texte noir | « Contrôle pas encore ouvert » ou « Événement terminé » | deux impulsions longues | Hors des heures de contrôle : personne n'entre avec ce billet pour l'instant. |
| **Rouge foncé**, icône différente | « Événement annulé » ou « Événement suspendu » | trois impulsions | Aucune entrée possible. Prévenez l'organisation. |
| **Gris anthracite**, texte blanc | « Vérification impossible », « Hors ligne : rien n'est validé », « Réseau trop lent : rien n'est validé »… | **aucune** | Le billet n'est pas en cause : **ne refusez pas** le spectateur pour ce motif. Faites patienter et réessayez (section 4). |

Un refus reste affiché 3 secondes. Toucher l'écran passe tout de suite au billet suivant, sauf pour un encaissement, qui attend une action.

Si le même QR est relu dans les 20 secondes qui suivent une entrée validée, il n'est pas renvoyé : l'écran dit « Même billet que l'entrée validée à 21:04 : présentez le billet suivant. »

**Aucun son** : l'application n'en émet jamais, ni au scan, ni au résultat. Dans une file bruyante, le contrôleur se fie à la vibration et à l'écran. Sur iPhone, seulement à l'écran.

---

## 4. Réseau lent, réseau coupé

Chaque scan doit être confirmé par le serveur. C'est ce qui empêche deux portes d'accepter le même billet. Il n'y a donc **jamais de validation sans réseau**.

### Réseau lent

1. Juste après la lecture, l'écran affiche **« Envoi… »**.
2. Au-delà d'une seconde et demie, **« Réseau lent »** : « Ne refaites pas scanner : nouvel essai automatique (essai 2 sur 3) ». L'application réessaie seule, jusqu'à 3 fois.
3. Un même scan renvoyé plusieurs fois ne compte **jamais deux entrées**, même si la réponse s'est perdue en route.
4. Si les 3 essais échouent : écran gris, « Réseau trop lent : rien n'est validé » ou « Réseau indisponible : rien n'est validé ». Le billet n'a pas été validé : on peut le scanner de nouveau.

### Réseau coupé

Le téléphone du contrôleur affiche un bandeau rouge permanent :

> **Hors ligne : aucune entrée ne peut être validée**
> Faites patienter, passez sur le routeur de secours, puis reprenez.

La caméra continue de lire, mais chaque lecture affiche « Hors ligne : rien n'est validé ». La saisie manuelle et le guichet ne fonctionnent pas non plus.

Que faire, dans l'ordre :

1. **Faire patienter** la file. Ne laissez entrer personne « à vue » : un billet accepté sans le serveur pourrait l'être aussi à une autre porte.
2. **Passer sur le routeur de secours** (ou sur un autre opérateur), puis vérifier que l'en-tête repasse à **En ligne**.
3. **Reprendre** le scan. Les coupures subies par le téléphone sont déclarées automatiquement au retour du réseau : vous les retrouvez dans la page de pilotage, onglet **Entrées**, section « Incidents techniques ».

Pour un spectateur qui n'a pas pu afficher son billet : la saisie manuelle (section 5), une fois le réseau du contrôleur revenu.

Le réseau qui compte est celui du **contrôleur**. Celui du spectateur peut être saturé : son billet s'affiche quand même s'il l'a ouvert avant d'arriver (section 8).

---

## 5. La saisie manuelle

Pour un spectateur sans téléphone, avec un téléphone éteint ou cassé, ou dont le billet n'est pas enregistré sur son téléphone. Il faut le **numéro du billet** (de la forme `TCK-20261101-XXXXXXXXXX`) et une **pièce d'identité**. Le numéro figure dans Mes billets, sur la page du billet hors ligne, sur le PDF du billet et dans l'email de confirmation (les 10 premiers numéros d'une commande).

Sur le scanner, bouton **Saisie manuelle** :

1. Saisir le numéro, puis **Vérifier le billet**. Rien n'est encore validé : l'écran affiche le **titulaire**, la catégorie, l'état du billet et le **résultat prévu**.
2. Comparer le nom de la pièce d'identité au titulaire affiché.
3. Si c'est le bon : cocher **Pièce d'identité conforme au titulaire**, puis **Pièce conforme, valider l'entrée**. Le résultat plein écran s'affiche comme pour un scan.

Ce qui peut arriver :

- « Aucun billet de cet événement ne porte ce numéro » : vérifier la saisie avec le spectateur. Rien n'a été validé.
- « Entrée impossible : … » (billet déjà utilisé, annulé…) : le bouton de validation n'apparaît pas. Ne laissez pas entrer avec ce billet.
- Un billet transféré change de numéro : seul le numéro du **nouveau** titulaire marche.
- Chaque vérification est enregistrée. Un contrôleur peut en faire 20 par minute au plus.
- La saisie manuelle demande du réseau. Par défaut, seul un contrôleur affecté à l'événement peut l'utiliser.

---

## 6. La caisse (espèces)

Seulement pour un contrôleur autorisé à encaisser (option **Encaissement des espèces**). Son scanner a alors un onglet **Caisse**.

**Ouvrir la caisse** (avec le régisseur) : saisir le **fonds de caisse** remis pour rendre la monnaie (0 s'il n'y en a pas). Le code PIN du régisseur est facultatif à ce moment-là.

**Encaisser** : quand un scan affiche « Encaissement requis : 5 000 F CFA » :

- **J'ai reçu 5 000 F CFA : valider l'entrée** : l'encaissement et l'entrée sont enregistrés ensemble ;
- **Annuler : le spectateur ne paie pas** : rien n'est enregistré.

Si la caisse est fermée, le bouton devient **Ouvrir ma caisse pour encaisser**. Un contrôleur qui n'est pas autorisé à encaisser voit : « orientez le spectateur vers la caisse de l'événement ». Si l'encaissement échoue, l'écran le dit : « Rien n'a été encaissé ni validé : ne laissez pas entrer le spectateur. » Un encaissement relancé après une coupure n'est jamais compté deux fois.

L'onglet Caisse affiche en permanence : fonds de caisse, espèces encaissées et **total attendu en caisse**, calculés par le serveur.

**Clôturer la caisse** (avec le régisseur) : compter les espèces, mettre de côté le fonds de caisse, saisir le reste. Si le montant ne correspond pas aux encaissements enregistrés, l'application demande une **justification** (10 caractères au moins) et le **code PIN du régisseur**, saisi par le régisseur lui-même. Le **Z de caisse** s'affiche ensuite et peut être imprimé. Vous suivez toutes les caisses dans l'onglet Caisse de la page de pilotage.

---

## 7. Le guichet (vente sur place)

Onglet **Guichet** du scanner, visible pour un contrôleur autorisé à encaisser, quand la vente au guichet est ouverte sur la plateforme. Il faut une caisse ouverte (sinon : **Ouvrir ma caisse**).

1. Choisir les billets par catégorie (prix et places disponibles affichés).
2. Le **total** est calculé par le serveur.
3. Numéro de l'acheteur : facultatif, pour lui envoyer un reçu par SMS. Le billet n'est rattaché à aucun compte.
4. **J'ai reçu … : valider la vente**. Chaque billet vendu au guichet est une **entrée immédiate** : il n'y a rien à scanner ensuite.

Si le réseau coupe pendant la vente : « la vente n'est pas confirmée. Réessayez, elle ne sera pas comptée deux fois. »

---

## 8. Côté spectateur : le billet hors ligne

À partir de **24 heures avant le début**, quand le spectateur ouvre l'application (ou son billet) **avec du réseau**, le billet s'enregistre tout seul sur son téléphone. Sa carte dans Mes billets indique alors **« Disponible hors ligne »**. Plus tôt, elle indique « Disponible hors ligne à partir du … » ; dans la fenêtre, tant que le billet n'est pas enregistré, « Ouvrez ce billet avec du réseau avant d'arriver ».

À l'entrée, même sans réseau, il affiche son billet :

- par le lien **Afficher mes billets hors ligne** de Mes billets, ou **Afficher ce billet hors ligne** sur la carte du billet ;
- ou en ouvrant l'application : si l'accueil ou Mes billets ne peut pas se charger parce que le réseau est coupé, l'application ouvre d'elle-même la page **Billet hors ligne**. Si le réseau est seulement saturé (la page tourne sans s'ouvrir), mieux vaut utiliser le lien ci-dessus, ou, sur Android, le raccourci **Billets hors ligne** de l'icône (appui long).

Il y voit le QR, qui **change toutes les 20 secondes**, le numéro du billet, et les rappels : capture d'écran refusée, numéro et pièce d'identité en cas de problème. Si l'heure de son téléphone est fausse, l'application en tient compte : le code affiché reste celui qu'attend le contrôle.

Si le billet n'est pas enregistré sur son téléphone, l'application ne montre **aucun QR** et le dit : « Ce billet n'est pas enregistré sur ce téléphone. Reconnectez-vous au réseau, ou présentez votre numéro de billet et votre pièce d'identité au contrôle. » Passez alors par la saisie manuelle.

Un billet **transféré** à quelqu'un d'autre ne s'affiche plus chez l'ancien titulaire, et ses anciens codes sont refusés au scan (« QR expiré »). Le billet est aussi effacé du téléphone à la déconnexion.

Sur iPhone, le spectateur doit ouvrir l'application installée sur l'écran d'accueil, et non Safari : les deux ne partagent pas le billet enregistré (`docs/installer-application.md`).

---

## 9. Pendant et après l'événement

- **Page de pilotage**, onglet **Entrées** : entrées et refus par contrôleur et par porte, incidents techniques, en direct.
- **Onglet Caisse** : caisses ouvertes et clôturées, écarts.
- Un contrôleur qui change d'événement touche le bouton de changement en haut du scanner. En fin de service, il se déconnecte (bouton en haut à droite) : il est déconnecté de tous ses appareils.
- Vous pouvez aussi scanner depuis votre espace partenaire (menu **Scanner les billets**). Mais l'écran pensé pour la file (plein écran, vibrations, saisie manuelle autorisée par défaut, caisse) est celui du contrôleur.

---

## 10. Liste de contrôle

**Quelques jours avant**

- [ ] Contrôleurs invités, comptes activés (plus de « Activation en attente »).
- [ ] Porte renseignée pour chaque contrôleur.
- [ ] Encaissement des espèces donné aux seuls contrôleurs qui tiennent une caisse.
- [ ] Code PIN régisseur généré et remis au régisseur (si espèces).
- [ ] Message aux spectateurs : « ouvrez votre billet avec du réseau avant d'arriver ».

**La veille**

- [ ] Essai de chaque téléphone : connexion, événement visible, caméra, écran plein, vibration.
- [ ] Routeurs 4G testés à chaque entrée, routeur de secours chargé.
- [ ] Téléphones et batteries externes chargés.

**Le jour J**

- [ ] Fonds de caisse remis, caisses ouvertes avec le régisseur.
- [ ] En cas de bandeau « Hors ligne » : faire patienter, routeur de secours, reprendre. Jamais d'entrée « à vue ».
- [ ] Spectateur sans billet affichable : numéro du billet et pièce d'identité, saisie manuelle.
- [ ] En fin de soirée : clôture des caisses avec le régisseur, Z de caisse.
