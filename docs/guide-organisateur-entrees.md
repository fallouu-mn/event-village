# Guide de l'organisateur : les entrées

Ce guide explique comment préparer et tenir les entrées d'un événement avec Event Village : les contrôleurs, le scanner, la saisie manuelle, la caisse, le guichet, et ce qu'il faut faire quand le réseau tombe. Il décrit l'application telle qu'elle est livrée au lot 9 ter. Depuis ce lot, vous pouvez aussi découper le lieu en zones (« Entrée générale », « Carré VIP »…), donner une porte à chaque contrôleur, choisir une couleur et une consigne par catégorie, et faire entrer un invité sans smartphone par la liste des invités : sections 11 à 17.

En bref :

- chaque contrôleur scanne avec son téléphone, dans l'application, connecté à Internet ;
- **un billet = une seule entrée** : un billet validé à l'entrée est définitivement utilisé ; il n'y a ni sortie ni retour ;
- avec une seule porte et sans zone, **il n'y a rien à régler** : toutes les catégories entrent par la même porte (section 11) ;
- le résultat s'affiche en plein écran, en couleur (vert : on entre ; orange : mauvais endroit ; rouge : refus), avec un titre en grand ; le téléphone vibre (sur Android) ; **aucun son** n'est émis ;
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

Un contrôleur qui a déjà un compte Event Village et qui n'a **jamais contrôlé vos événements** (il travaille, par exemple, pour un autre organisateur) n'est plus affecté d'office : il doit accepter votre invitation dans son application. Voir la section 16.

### 1.2 Attribuer une porte à chaque contrôleur

Dans la page de pilotage de l'événement (**Mes événements**, puis l'événement), onglet **Équipe**, section « Contrôleurs affectés ». Ce que vous voyez dépend de vos zones (section 13).

**Événement sans zone** (le cas le plus fréquent, section 11) : renseignez, si vous le voulez, le **Point d'entrée** de chaque contrôleur, en texte libre (par exemple « Porte Nord », « Entrée VIP »). Ce n'est qu'un nom pour le compteur : tous les contrôleurs compostent toutes les catégories.

**Événement avec des zones** : le champ « Point d'entrée » est remplacé par :

1. la liste **Porte** : « Aucune porte », puis une ligne par porte de la forme « Porte Nord — Entrée générale » (la porte, puis sa zone) ;
2. l'interrupteur **Peut changer de porte** : « Le contrôleur choisit lui-même sa porte dans le scanner. » Laissé éteint, seul vous pouvez changer sa porte ;
3. le bouton **Enregistrer**. Le message confirme : « Porte de Mamadou Sall : Porte Nord. » (ou « Porte de Mamadou Sall retirée. »).

Un contrôleur sans porte, sur un événement à zones, **ne peut pas scanner**. L'onglet le signale par un bandeau « Contrôleur sans porte » : « 1 contrôleur sans porte : il ne peut pas scanner tant que vous ne lui attribuez pas une porte. » Plusieurs contrôleurs peuvent partager la même porte.

Le compteur en haut du scanner :

- Avec une porte (ou un point d'entrée), il affiche le compteur de cette porte : « Porte Nord : 312 entrées » (toutes les entrées validées à cette porte, par tous ses contrôleurs). À une porte de « Contrôle de zone » (section 13), il compte les contrôles : « Accès carré : 40 contrôles ».
- Sans porte ni point d'entrée, il affiche les entrées du contrôleur lui-même : « Vos entrées : 12 entrées ».

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

1. Écran **Commencer le contrôle** : il choisit l'événement (les événements ouverts au contrôle sont en tête) ; l'écran rappelle sa porte et précise que « le téléphone vibre à chaque résultat ; aucun son n'est émis ». Sur un événement à zones, il lit par exemple : « Votre porte : Porte Nord · Entrée générale (Entrée). Le compteur affichera les entrées de cette porte. » Sans porte attribuée, un bandeau « Aucune porte attribuée » lui dit : « Cet événement a des portes : demandez à l’organisateur de vous en attribuer une avant de scanner. » Si vous l'y autorisez, un bouton **Changer de porte** ouvre la fenêtre « Choisir ma porte » ; il choisit sa porte puis touche **Enregistrer cette porte**.
2. Il touche **Commencer le contrôle**. Ce premier toucher autorise aussi la vibration et ouvre la caméra. Ensuite, **aucun bouton à toucher** entre deux billets : l'écran revient tout seul au scan.

En haut de l'écran : le nom de l'événement, le compteur (« Porte Nord : 312 entrées »), et l'état du réseau (**En ligne** ou **Hors ligne**). Deux boutons : changer d'événement, se déconnecter.

En bas : **Derniers scans** (à déplier) donne au contrôleur ses entrées, ses refus par motif et ses 20 derniers scans, et **Réglages de cet appareil** permet de régler le temps d'affichage d'une entrée validée.

La caméra se met en veille après 3 minutes sans lecture, pour la batterie : touchez **Reprendre le contrôle**. Elle s'arrête aussi quand l'application passe en arrière-plan (appel, autre application, écran verrouillé) : au retour, un seul toucher sur **Reprendre le contrôle** la rallume. Le bouton de torche apparaît si le téléphone en a une.

Le contrôleur peut quitter l'application sans rien perdre : après un appel, un passage par une autre page, un rechargement ou la fermeture puis la réouverture de l'application, il retrouve le même événement et le même mode (caméra ou saisie manuelle), sans repasser par le choix de l'événement. Le compteur et les derniers scans sont relus sur le serveur. Un billet scanné juste avant la sortie, dont la réponse n'est pas arrivée, est renvoyé au retour (dans les 2 minutes) sans risque de double entrée : l'écran affiche son résultat avec la mention « Résultat retrouvé ». Si l'événement n'est plus ouvert au contrôle, l'écran de choix revient avec un message. Tout est effacé à la déconnexion.

---

## 3. Ce que voit le contrôleur

Chaque scan affiche un résultat **plein écran** : une couleur, une grande icône, un titre en grand. La couleur n'est jamais le seul signe : l'icône et le titre changent aussi. Trois familles, lisibles à un mètre : **vert**, on laisse passer ; **orange**, la personne n'est pas au bon endroit ; **rouge**, on refuse. C'est toujours le serveur qui décide ; l'écran ne fait qu'afficher sa réponse.

| Écran | Titre affiché | Vibration (Android) | Que faire |
|---|---|---|---|
| **Vert**, texte noir | « Entrée validée ». Sans couleur, consigne ni zone (section 12), comme avant : le **nom du titulaire** en très grand, la catégorie et le numéro du billet. Sinon, dans l'ordre : le **nom de la catégorie** en très grand, sur une bande de sa couleur ; la **consigne d'entrée** en gros (« Remettre bracelet doré — orienter vers le carré VIP ») ; la zone et la porte (« Zone : Entrée générale · Porte Nord ») ; le titulaire ; le numéro du billet | une impulsion courte | Laisser entrer et appliquer la consigne. L'écran revient au scan après 1,5 s (réglable : 1, 1,5, 2 ou 3 s). |
| **Vert**, icône de bouclier | « Accès autorisé », à une porte de « Contrôle de zone » (section 13) : la catégorie, « Zone : Carré VIP », puis l'heure et la porte de l'entrée : « Entré à 21:04, Porte Nord » | une impulsion courte | Laisser passer. Le billet est déjà entré : rien n'est composté une seconde fois. |
| **Orange**, texte noir | « Accès refusé : billet SIMPLE » (la catégorie du billet), puis la zone où se présenter : « Présentez-vous à : Entrée générale ». Si aucune zone n'admet ce billet : « Aucune zone n’admet ce billet : appelez l’organisateur. » | deux impulsions longues | Ne pas laisser passer ici : orienter la personne. Rien n'est composté, le billet reste valable pour la bonne zone. |
| **Orange**, texte noir | « Pas encore entré », à une porte de « Contrôle de zone », puis « Passez d’abord par : Entrée générale » | deux impulsions longues | Le billet n'a jamais été validé à une entrée : envoyer la personne à l'entrée d'abord. |
| **Rouge**, texte blanc | « Billet déjà utilisé », avec l'heure et la porte de la première entrée : « Déjà utilisé à 21:04, Porte Nord » (sans porte connue : « Déjà utilisé à 21:04 »), ou « Déjà validé par vous à 21:04 » si ce même contrôleur l'a validé il y a moins de 30 secondes | trois impulsions | Refuser. « Déjà validé par vous » : c'est un double passage du même billet, à l'instant, à votre porte. |
| **Rouge foncé**, texte blanc | le motif : « Billet invalide », « Billet annulé », « Billet remboursé », « Billet d'un autre événement », « QR expiré : demandez au client de rafraîchir son billet », « QR dynamique requis (billet ouvert dans l'application) », « Paiement requis », « Saisie manuelle refusée » | trois impulsions | Refuser. Pour « QR expiré » : souvent une capture d'écran ou un billet transféré à quelqu'un d'autre ; demandez au spectateur d'ouvrir son billet dans l'application. |
| **Bleu foncé**, texte blanc | « Encaissement requis : 5 000 F CFA » | deux impulsions longues | Le billet n'est pas encore payé : il se règle sur place, en espèces. Voir la section 6. L'écran attend une décision. |
| **Jaune**, texte noir | « Contrôle pas encore ouvert » ou « Événement terminé » | deux impulsions longues | Hors des heures de contrôle : personne n'entre avec ce billet pour l'instant. |
| **Rouge foncé**, icône différente | « Événement annulé » ou « Événement suspendu » | trois impulsions | Aucune entrée possible. Prévenez l'organisation. |
| **Gris anthracite**, texte blanc | « Vérification impossible », « Hors ligne : rien n'est validé », « Réseau trop lent : rien n'est validé »… | **aucune** | Le billet n'est pas en cause : **ne refusez pas** le spectateur pour ce motif. Faites patienter et réessayez (section 4). |
| **Gris anthracite**, icône de porte fermée | Un problème de porte du contrôleur, jamais du billet : « Aucune porte affectée » (« Demandez à l’organisateur de vous attribuer une porte. Rien n’a été validé. »), « Votre porte a changé » (« Le contrôle reprend avec votre nouvelle porte : scannez de nouveau. »), « Porte inconnue » (« Choisissez une porte de cet événement. ») | **aucune** | Ne pas refuser le spectateur. Attribuer une porte au contrôleur (section 1.2), ou scanner de nouveau. Rien n'a été validé. |

Sur un écran vert, un **badge discret** indique l'origine du billet : « Invitation » ou « Gratuit » ; rien pour un billet acheté en ligne ou au guichet. Il ne change aucune règle : une invitation ou un billet gratuit a exactement les droits de sa catégorie (mêmes zones, même consigne).

Un écran vert revient tout seul au scan après le temps réglé sur l'appareil. Un écran orange ou un refus reste affiché 3 secondes. Toucher l'écran passe tout de suite au billet suivant, sauf pour un encaissement, qui attend une action.

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

**Sur un événement à zones** (section 13), la vente au guichet vaut entrée : elle se fait seulement à une porte d'une zone de type « Entrée », et seulement pour les catégories que cette zone admet. Une catégorie qui n'entre pas par la porte du vendeur est grisée, avec la mention « N’entre pas par votre porte ». Si la vente est refusée, un bandeau « Vente non enregistrée » donne la raison, par exemple « VIP n’entre pas par cette porte : vendez-la à Entrée VIP. » (le nom de la zone d'entrée qui admet cette catégorie) ou « La vente au guichet se fait à une porte d’entrée : demandez à l’organisateur de changer votre porte. »

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

- **Page de pilotage**, onglet **Entrées** : le tableau de bord des entrées, en direct (détail ci-dessous).
- **Onglet Caisse** : caisses ouvertes et clôturées, écarts.
- Un contrôleur qui change d'événement touche le bouton de changement en haut du scanner. En fin de service, il se déconnecte (bouton en haut à droite) : il est déconnecté de tous ses appareils.
- Vous pouvez aussi scanner depuis votre espace partenaire (menu **Scanner les billets**). Sur un événement à zones, choisissez d'abord la **Porte de contrôle** : « Choisissez la porte où vous contrôlez : la règle des zones s’applique à vos scans. » Mais l'écran pensé pour la file (plein écran, vibrations, saisie manuelle autorisée par défaut, liste des invités, caisse) est celui du contrôleur.

### Le tableau de bord des entrées (onglet Entrées)

Il se met à jour à chaque scan, et de lui-même toutes les minutes. Sous les chiffres, « Mis à jour à 21:32 » donne l'heure de la dernière lecture. Tous les nombres sont calculés par le serveur.

En haut, six cartes :

- « Entrées validées » (« Scans acceptés, guichet compris »), « Au guichet » (« Billets vendus et validés sur place »), « Refus » (« Tentatives refusées au contrôle ») ;
- « Liste des invités » : le nombre d'entrées validées par la liste (« Entrées validées par la liste, pièce vérifiée »), section 15 ;
- « Débit » : par exemple « 2,2 par minute » (« Moyenne des 5 dernières minutes ») ;
- « Contrôleurs actifs » : par exemple « 3 sur 4 » (« Un scan dans les 10 dernières minutes »).

Plus bas :

- **Par contrôleur** : entrées et refus de chacun ; sur un événement à zones, la colonne « Porte ».
- **Par zone** (événement à zones) : « Entrés sur attendus. Les attendus sont les billets des catégories admises dans la zone : une catégorie admise dans deux zones compte dans les deux. » Une zone de contrôle s'affiche « Carré VIP (contrôle de zone) », avec les billets contrôlés sur les billets déjà entrés.
- **Par porte** (ou **Par point d’entrée** sans zone) : zone, entrées, refus, débit (« 1,4 par minute ») et contrôleurs actifs de chaque porte.
- **Par catégorie** et **Par origine** (« En ligne », « Guichet », « Gratuit », « Invitation ») : entrés sur attendus.
- **Flux par quart d’heure**, **Refus par motif** (dont « Mauvaise zone » et « Pas encore entré »), **Validations par la liste des invités** (heure, invité, catégorie, porte, contrôleur), **Débit par minute** sur les 30 dernières minutes, **Incidents techniques**.

Un contrôle réussi à une porte de « Contrôle de zone » (« Accès autorisé ») n'est ni une entrée ni un refus.

### L'alerte de refus

Quand une porte enregistre **beaucoup de refus en peu de temps** (par défaut **10 refus en 5 minutes**), vous recevez une alerte :

- dans l'onglet Entrées, un bandeau rouge par porte : « Beaucoup de refus à Porte Sud », « 12 refus dans les 5 dernières minutes. Vérifiez avec le contrôleur : faux billets, mauvaise porte ou billets déjà utilisés. » ;
- dans la cloche de l'application, en notification sur le téléphone, et par email si votre adresse est vérifiée : « Refus en série à une porte », « Porte Sud : 12 refus en 5 minutes pour « Grande soirée ». Vérifiez la porte avec vos contrôleurs. » **Aucun SMS.**

Au plus une alerte par porte et par durée observée : si la porte reste au-dessus du seuil, une nouvelle alerte part ensuite. Comptent les billets invalides, déjà utilisés, annulés, remboursés, d'un autre événement, en attente de transfert, présentés dans la mauvaise zone ou pas encore entrés ; ne comptent pas les refus liés au téléphone ou aux droits du contrôleur, à l'encaissement ni aux horaires de l'événement. L'alerte ne change jamais le résultat d'un scan.

Le seuil et la durée sont réglés par l'équipe Event Village (le Superadmin, page **Réglages de la plateforme**, section « Contrôle d’accès » : « Alerte de refus à une porte : nombre de refus », de 3 à 500, et « Alerte de refus à une porte : durée observée », de 1 à 60 minutes), pour tous les événements. Demandez-lui si le seuil ne convient pas à votre public.

### Après l'événement : rapport de clôture et export

- Le **rapport de clôture** (onglet Clôture, et son PDF) reprend les mêmes vues, figées : par zone, par porte, par catégorie, par origine, flux par quart d'heure, refus par motif, validations par la liste des invités. Le PDF ajoute les tableaux « Entrées par zone », « Entrées par origine » et « Entrées par porte ». Aucun nom d'invité n'y figure.
- L'**export des participants** : « Fichier CSV : nom, catégorie, origine, statut du billet, heure d’entrée, zone et porte. Aucune donnée de paiement ni numéro de billet. » Un invité sans compte entré par la liste y figure sous « Invité, entré par la liste » : son nom n'est jamais exporté.

---

## 10. Liste de contrôle

**Quelques jours avant**

- [ ] Contrôleurs invités, comptes activés (plus de « Activation en attente »).
- [ ] Contrôleurs venus d'un autre organisateur : invitation acceptée dans leur application (section 16).
- [ ] Couleur et consigne d'entrée de chaque catégorie, si elles vous servent (section 12).
- [ ] Une seule porte : rien à régler (section 11). Sinon : zones et portes enregistrées (section 13), « Zones enregistrées. ».
- [ ] Porte renseignée pour chaque contrôleur ; sur un événement à zones, aucun bandeau « Contrôleur sans porte ». « Peut changer de porte » seulement pour qui doit circuler.
- [ ] Carré VIP : bracelets en nombre suffisant à l'entrée, ou un contrôleur avec téléphone au carré (section 14).
- [ ] Nom de l'invité saisi pour chaque invité qui risque de venir sans smartphone (section 15).
- [ ] Encaissement des espèces donné aux seuls contrôleurs qui tiennent une caisse.
- [ ] Code PIN régisseur généré et remis au régisseur (si espèces).
- [ ] Message aux spectateurs : « ouvrez votre billet avec du réseau avant d'arriver ».

**La veille**

- [ ] Essai de chaque téléphone : connexion, événement visible, « Votre porte : … » exacte, caméra, écran plein, vibration.
- [ ] Routeurs 4G testés à chaque entrée (et au carré VIP s'il a un contrôle de zone), routeur de secours chargé.
- [ ] Téléphones et batteries externes chargés.

**Le jour J**

- [ ] Fonds de caisse remis, caisses ouvertes avec le régisseur.
- [ ] En cas de bandeau « Hors ligne » : faire patienter, routeur de secours, reprendre. Jamais d'entrée « à vue ».
- [ ] Écran orange : orienter la personne vers la zone indiquée, sans confisquer le billet.
- [ ] Spectateur sans billet affichable : numéro du billet et pièce d'identité, saisie manuelle.
- [ ] Invité sans smartphone : « Liste des invités », pièce d'identité, une personne à la fois.
- [ ] Bandeau ou alerte « Beaucoup de refus à … » : aller voir la porte et son contrôleur.
- [ ] En fin de soirée : clôture des caisses avec le régisseur, Z de caisse.

**Après**

- [ ] Rapport de clôture relu (onglet Clôture) ; export des participants si besoin.

---

## 11. Le cas le plus simple : une seule porte

C'est le cas le plus fréquent : une porte, plusieurs catégories (par exemple SIMPLE, VIP et VVIP). **Vous n'avez rien à régler.** Un événement sans zone a d'office une zone unique, « Entrée », qui admet toutes les catégories : chaque contrôleur composte tous les billets de l'événement, comme avant le lot 9 ter.

Dans la page de pilotage, onglet **Équipe**, la section « Zones et portes » le dit : « Une seule entrée, toutes les catégories », « Tous vos contrôleurs compostent les billets de toutes les catégories. »

Même avec une seule porte, deux réglages peuvent vous servir :

- la **couleur** et la **consigne d'entrée** de chaque catégorie (section 12), pour que le contrôleur voie d'un coup d'œil qui est VIP et quoi lui remettre ;
- le **point d'entrée** de chaque contrôleur (section 1.2), pour avoir un compteur par porte.

Ne créez des zones que si certaines catégories ne doivent **pas** passer par certaines portes, ou si vous voulez contrôler l'accès à un espace réservé avec un téléphone (section 14).

---

## 12. Préparer ses catégories

### Couleur et consigne d'entrée

Elles se règlent dans la fiche de l'événement : **Mes événements**, l'événement, **Modifier**, étape **Billets**, sur une catégorie **déjà créée** (pas au moment de la création). Dans le groupe « Au contrôle des entrées » :

- **Couleur au contrôle** : « Aucune couleur », « Blanc », « Or », « Argent », « Rose », « Turquoise », « Bleu nuit », « Violet » ou « Noir ». Aide : « Bande de couleur montrée au contrôleur avec le nom de la catégorie. »
- **Consigne d'entrée** : « Facultative, 60 caractères au plus. Affichée en gros au contrôleur quand le billet est validé à l’entrée. » Exemples : « Remettre bracelet doré — orienter vers le carré VIP », « Bracelet violet, accompagner au carré VIP ».

Puis **Enregistrer la catégorie**. Choisir « Aucune couleur » ou vider la consigne les efface. En cas d'erreur : « Choisissez une couleur dans la liste. » ou « La consigne d’entrée ne dépasse pas 60 caractères. »

Bon à savoir :

- La palette ne contient ni rouge, ni vert, ni orange : ces couleurs sont réservées au résultat du scan. Le nom s'écrit en noir ou en blanc selon la couleur, pour rester lisible ; la bande est cernée de noir sur l'écran vert.
- La couleur n'est **jamais le seul signe** : le nom de la catégorie est toujours écrit en très grand sur la bande. Donnez à vos catégories des couleurs bien différentes (par exemple Blanc, Or, Violet) et des noms courts.
- La consigne ne s'affiche que sur l'écran vert « Entrée validée », jamais sur « Accès autorisé » ni sur « Billet déjà utilisé ».
- Changer la couleur ou la consigne ne prévient personne : ni l'équipe Event Village, ni les acheteurs.

### Vendre plus de places, ou à un autre prix

Sous la quantité de chaque catégorie, l'aide rappelle : « Pour vendre des places supplémentaires à un autre prix, créez une nouvelle catégorie. » Pour rouvrir une catégorie épuisée, augmentez sa **quantité mise en vente**. Si la **jauge** de l'événement ne le permet pas, le refus dit quoi faire, par exemple : « Les quantités mises en vente des catégories actives totaliseraient 29 places. Augmentez d’abord la capacité totale de l’événement (actuellement 27). » Augmentez alors la jauge, puis la quantité : la catégorie redevient disponible au public sans qu'il ait à recharger la page.

---

## 13. Préparer ses zones et ses portes

Une **zone** est un espace du lieu (« Entrée générale », « Carré VIP », « Backstage »). Chaque zone a un **type**, la liste des **catégories admises**, et une ou plusieurs **portes** (« Porte Nord », « Porte Sud », « Accès carré »). Chaque contrôleur travaille à une porte (section 1.2).

Les deux types :

| Type | Ce qu'il fait | Écran du contrôleur |
|---|---|---|
| **Entrée** | « Composte le billet : la personne entre. » Un billet d'une catégorie admise est validé, une seule fois. | Vert « Entrée validée » ; orange « Accès refusé : billet … » pour une catégorie non admise (rien n'est composté) |
| **Contrôle de zone** | « Vérifie la catégorie sans composter. Un billet jamais composté est signalé « Pas encore entré ». » Il accepte un billet déjà entré. | Vert « Accès autorisé » ; orange « Accès refusé : billet … » ou « Pas encore entré » |

À une porte d'entrée, un refus rouge (billet déjà utilisé, annulé, remboursé, faux…) passe toujours avant l'orange. À un contrôle de zone, un billet annulé ou remboursé est refusé en rouge.

### Pas à pas

Page de pilotage de l'événement, onglet **Équipe**, section « Zones et portes » :

1. **Configurer des zones** : l'écran prépare, sans rien enregistrer, une zone « Entrée » de type Entrée, avec toutes les catégories cochées et une porte « Entrée ».
2. Pour chaque zone : **Nom de la zone** (40 caractères au plus), **Type** (« Entrée » ou « Contrôle de zone »), **Catégories admises** (cases à cocher ; chaque catégorie est suivie du nom de sa couleur, par exemple « VIP · Or »), **Portes** (un **Nom de la porte** par porte, et **Ajouter une porte**).
3. **Ajouter une zone** pour la suivante, puis **Enregistrer les zones**. Le message « Zones enregistrées. » confirme.
4. Attribuez ensuite une porte à chaque contrôleur (section 1.2).

Les règles, vérifiées à l'enregistrement (le bandeau « Zones non enregistrées » donne la raison) :

- chaque zone a au moins une porte : « La zone Carré VIP n’a aucune porte : ajoutez-en au moins une. » ;
- chaque zone admet au moins une catégorie : « La zone Carré VIP n’admet aucune catégorie : cochez-en au moins une. » ;
- il y a au moins une zone de type Entrée : « Il faut au moins une zone de type Entrée : c’est là que les billets sont compostés. » ;
- **chaque catégorie entre par au moins une zone de type Entrée** : « La catégorie VVIP n’entre par aucune zone de type Entrée : cochez-la dans une zone d’entrée. » ;
- deux zones, ou deux portes, ne portent pas le même nom ; 20 zones et 50 portes au plus.

Une catégorie créée **après** les zones est admise d'office par toutes les zones d'entrée, jamais par un contrôle de zone : vérifiez ses cases.

Une fois le contrôle commencé, ce qui a servi est protégé : « La porte Porte Nord a déjà servi au contrôle : elle ne peut être ni supprimée ni changée de zone. » ; une zone qui a servi ne change plus de type et ne se supprime plus. Une porte où des contrôleurs sont affectés ne se supprime pas : « Des contrôleurs sont affectés à la porte Porte Nord : changez d’abord leur porte dans l’équipe. »

Les zones ne se modifient pas pendant la validation de l'événement (« L’événement est en cours de validation : retirez-le de la validation pour modifier ses zones. »), ni après sa fin ou son annulation. Seul l'organisateur les modifie : l'équipe Event Village les voit en lecture seule.

**Revenir à une seule entrée** supprime les zones et les portes, après confirmation : « Les zones et les portes seront supprimées. Tous les contrôleurs pourront de nouveau composter toutes les catégories. »

---

## 14. Protéger un carré VIP : deux façons

Le billet VIP entre par la même porte que les autres. La question est : comment empêcher un spectateur SIMPLE d'entrer ensuite dans le carré VIP ? Deux façons.

**(a) Le bracelet remis à l'entrée.** À l'entrée, l'écran vert du billet VIP affiche la consigne « Remettre bracelet doré — orienter vers le carré VIP ». Le contrôleur remet le bracelet. À l'entrée du carré, un agent **sans téléphone** laisse passer les bracelets dorés.

**(b) Une zone « Contrôle de zone ».** Le carré a sa propre porte, tenue par un contrôleur **avec téléphone**, qui scanne de nouveau le billet : VIP déjà entré, vert « Accès autorisé » ; SIMPLE, orange « Accès refusé : billet SIMPLE » et « Présentez-vous à : Entrée générale » ; billet jamais passé à l'entrée, orange « Pas encore entré ».

| | (a) Bracelet | (b) Contrôle de zone |
|---|---|---|
| Personnel au carré | un agent, sans téléphone | un contrôleur avec son compte et un téléphone |
| Matériel | bracelets (un par billet VIP) | téléphone chargé, réseau au carré |
| Ce que fait le spectateur | montre son bracelet | montre de nouveau son billet dans l'application |
| Risque | un bracelet peut être donné à quelqu'un d'autre ou perdu ; le compte des bracelets est à faire à la main | file plus lente au carré ; sans réseau au carré, rien n'est vérifié (section 4) |
| Ce que vous suivez | les entrées VIP à la porte | en plus, les contrôles du carré dans le tableau de bord (« Carré VIP (contrôle de zone) ») |

Les deux peuvent se combiner : bracelet remis à l'entrée **et** contrôle au carré.

### Exemple complet : soirée SIMPLE, VIP, VVIP avec une seule porte

Trois catégories : SIMPLE, VIP, VVIP. Une seule porte d'entrée, « Porte principale ». Un carré réservé aux VIP et VVIP.

**Façon (a), le bracelet, pas à pas :**

1. Étape **Billets** de la fiche de l'événement (section 12) : SIMPLE en « Blanc », sans consigne ; VIP en « Or », consigne « Remettre bracelet doré — orienter vers le carré VIP » ; VVIP en « Violet », consigne « Bracelet violet, accompagner au carré VIP ». **Enregistrer la catégorie** pour chacune.
2. Aucune zone à créer (section 11).
3. Onglet **Équipe** : affecter les contrôleurs ; **Point d'entrée** « Porte principale » pour chacun (facultatif, pour le compteur).
4. Le soir : une réserve de bracelets dorés et violets à la porte ; un agent à l'entrée du carré.

À la porte, un billet VIP affiche en vert « VIP » en très grand sur une bande or, puis la consigne. Un SIMPLE affiche « SIMPLE » sur une bande blanche, sans consigne.

**Façon (b), le contrôle de zone, pas à pas :**

1. Étape **Billets** : mêmes couleurs ; consigne VIP « Orienter vers le carré VIP » par exemple (facultative).
2. Onglet **Équipe**, « Zones et portes », **Configurer des zones** :
   - zone 1 : nom « Entrée générale », type **Entrée**, catégories SIMPLE, VIP et VVIP cochées, porte « Porte principale » ;
   - **Ajouter une zone** : nom « Carré VIP », type **Contrôle de zone**, catégories VIP et VVIP cochées (SIMPLE décochée), porte « Accès carré » ;
   - **Enregistrer les zones**.
3. Dans « Contrôleurs affectés » : les contrôleurs de la porte reçoivent « Porte principale — Entrée générale » ; celui du carré reçoit « Accès carré — Carré VIP ». **Enregistrer** pour chacun.
4. Le soir : à la Porte principale, tout le monde entre et le billet est composté. À l'Accès carré, le contrôleur scanne de nouveau : VIP et VVIP passent (« Accès autorisé », avec l'heure et la porte de leur entrée), SIMPLE est orienté (« Accès refusé : billet SIMPLE »).

Le contrôleur du carré n'a pas de bouton « Liste des invités » et ne peut pas vendre au guichet : un invité sans smartphone passe d'abord par la Porte principale (section 15).

---

## 15. Les invités sans smartphone

Une invitation envoyée à un numéro arrive par SMS ; l'invité l'accepte dans l'application. S'il vient **sans smartphone**, ou sans l'avoir acceptée, le contrôleur le retrouve dans la **liste des invités**.

### À l'envoi : le nom de l'invité

Page de pilotage, onglet **Invitations**, « Inviter par SMS » : pour chaque ligne, **Numéro 1** et **Nom de l’invité 1** (« Facultatif, 60 caractères au plus. Montré au contrôleur qui consulte la liste des invités. »), puis **Ajouter un numéro** (10 au plus). La fenêtre « Confirmer l’envoi » montre la colonne « Invité » à côté de chaque numéro.

Le nom n'apparaît jamais dans le SMS. Dans l'historique des invitations, **Modifier le nom** permet de le corriger tant que le billet n'est pas utilisé (« Nom de l’invité enregistré. ») ; ensuite : « Ce billet a déjà été utilisé : le nom ne peut plus être modifié. »

### À la porte : « Liste des invités »

Sur le scanner du contrôleur, le bouton **Liste des invités** apparaît sous « Caméra » et « Saisie manuelle », à une porte d'entrée (ou sans zone), jamais à une porte de contrôle de zone. Sans réseau, il est inactif : « Hors ligne : la liste des invités reprendra au retour du réseau. »

1. L'écran rappelle : « Invitations pas encore acceptées dans l’application. Saisissez les 4 derniers chiffres ou le numéro complet. » Le contrôleur saisit le **Numéro de l’invité** (« Exemple : 4567 ou 77 123 45 67. Chaque recherche est enregistrée à votre nom. ») puis touche **Rechercher**.
2. Chaque invité trouvé s'affiche avec son nom en grand (« Invité sans nom » si vous n'en avez pas saisi), sa catégorie et son nombre de billets (« 1 billet », « 2 billets »). Le numéro n'est jamais affiché. Trop de réponses : « Plusieurs invités correspondent : saisissez le numéro complet. » Aucune : « Aucune invitation non utilisée pour ce numéro. »
3. **Choisir** : le nom s'affiche en très grand, avec le bandeau « Vérifiez la pièce d’identité » : « Comparez le nom avec la pièce d’identité de la personne avant de valider. »
4. Le contrôleur coche **J’ai vérifié la pièce d’identité**, puis touche **Valider l’entrée d’une personne**. L'écran vert s'affiche comme pour un scan, avec le nom de l'invité et le badge « Invitation ».
5. S'il reste des billets pour ce numéro : « Encore 1 billet pour cet invité. » La case se décoche : **une personne à la fois**, chacune avec sa pièce.

**Fermer la liste** revient à la caméra.

Bon à savoir :

- Une invitation a exactement les droits de sa catégorie : un invité SIMPLE présenté à une porte qui n'admet pas SIMPLE reçoit l'écran orange, et rien n'est validé.
- La validation par la liste est une vraie entrée : le billet est composté une fois pour toutes. Un second passage, par la liste, par le numéro ou par le QR, affiche « Billet déjà utilisé ». Deux contrôleurs qui valident le même invité au même instant : une seule entrée, l'autre voit « Billet déjà utilisé ».
- Si l'invité ouvre plus tard l'application, son billet apparaît dans **Mes billets**, onglet **Reçus**, avec « Entrée déjà validée à la porte le … à … » et le bouton **Ajouter à mes billets** : « Ce billet a déjà servi à l’entrée : il apparaîtra comme utilisé. »
- Un contrôleur fait **30 recherches par heure** au plus ; au-delà : « Trop de recherches dans l’heure : réessayez dans 12 min. » Chaque recherche est enregistrée à son nom, sans le numéro saisi.
- Par défaut, seuls les contrôleurs affectés à l'événement consultent la liste (même règle que la saisie manuelle, section 5).
- Vous suivez ces entrées à part dans l'onglet Entrées : carte « Liste des invités » et tableau « Validations par la liste des invités » (section 9).

---

## 16. L'équipe

**Un contrôleur venu d'un autre organisateur.** Quand vous invitez un numéro qui appartient déjà à un compte Event Village, et que ce compte n'a **jamais contrôlé vos événements**, la fenêtre « Compte existant » s'ouvre : « Ce numéro appartient déjà à un compte Event Village (Fa*** N***). Ce titulaire n’a jamais contrôlé vos événements : il doit accepter votre invitation dans l’application avant d’être affecté. Confirmez-vous l’envoi de l’invitation ? » Touchez **Envoyer l’invitation** : « Invitation envoyée : Fa*** N*** doit l’accepter dans l’application avant d’être affecté. » Le contrôleur ouvre **Invitations à contrôler** dans son application et touche **Accepter l’invitation** ; il est alors affecté. Un contrôleur qui a déjà travaillé une fois sur l'un de vos événements est affecté directement, comme avant, même si vous l'aviez retiré entre-temps.

**Plusieurs contrôleurs à la même porte.** C'est possible et sans risque : le serveur garantit qu'un billet n'est composté qu'une fois. Si trois contrôleurs scannent le même billet au même instant, un seul voit l'écran vert ; les autres voient « Billet déjà utilisé », avec l'heure et la porte de l'entrée.

**Changer de porte.** Vous changez la porte d'un contrôleur dans l'onglet Équipe (section 1.2). Il ne la change lui-même que si vous avez activé « Peut changer de porte ». Sinon, sa tentative est refusée : « L’organisateur ne vous autorise pas à changer de porte. » Si vous changez sa porte pendant le contrôle, son prochain scan affiche l'écran gris « Votre porte a changé » : il scanne de nouveau, rien n'a été validé entre-temps.

---

## 17. Ce qui n'existe pas

Ces fonctions ne sont **pas** dans l'application ; n'organisez pas votre soirée en comptant dessus :

- **sorties et réentrées** : un billet validé à l'entrée est définitivement utilisé ; une personne qui sort ne peut pas rentrer avec le même billet ;
- **événements sur plusieurs jours** avec un même billet ;
- **billets nominatifs** : le nom affiché est celui du titulaire du compte (ou de l'invité), mais le billet n'est pas vérifié contre une identité, sauf en saisie manuelle et par la liste des invités ;
- **places numérotées** ;
- **scan sans réseau côté contrôleur** : sans réseau, rien n'est validé (section 4).
