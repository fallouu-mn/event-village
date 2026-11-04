# Installer l'application et ouvrir son billet hors ligne

Event Village est une application web : elle s'ouvre dans le navigateur du téléphone, et peut aussi être **installée sur l'écran d'accueil**, comme une application. Une fois installée, elle s'ouvre depuis son icône, en plein écran, sans barre d'adresse. Il n'y a rien à télécharger dans un magasin d'applications.

L'installation n'est pas obligatoire pour afficher son billet sans réseau sur Android. Elle est **fortement conseillée sur iPhone** (voir plus bas).

Ouvrez toujours l'application à son **adresse officielle, en `https://`**. Sur une adresse non sécurisée (`http://`, adresse IP d'un poste de test), le navigateur refuse l'installation, l'enregistrement du billet hors ligne et la caméra du scanner.

---

## 1. Sur Android (Chrome)

1. Ouvrir l'adresse d'Event Village dans **Chrome**.
2. Toucher le menu (les trois points en haut à droite).
3. Choisir **Installer l'application** (selon la version de Chrome, la ligne peut s'appeler **Ajouter à l'écran d'accueil**), puis confirmer.
4. L'icône **EventVillage** apparaît sur l'écran d'accueil.

Chrome peut aussi proposer l'installation de lui-même, par un bandeau en bas de l'écran.

Raccourci utile : un **appui long** sur l'icône affiche **Billets hors ligne**, qui ouvre directement les billets enregistrés sur le téléphone, sans passer par l'accueil.

## 2. Sur iPhone (Safari)

1. Ouvrir l'adresse d'Event Village dans **Safari**.
2. Toucher le bouton **Partager** (le carré avec une flèche vers le haut).
3. Faire défiler et choisir **Sur l'écran d'accueil**.
4. Garder le nom **Event Village** et toucher **Ajouter**.

Ensuite, **toujours ouvrir Event Village depuis cette icône**, et non depuis Safari :

- **la première fois, avec du réseau**, et **se reconnecter** : l'application installée ne reprend pas la connexion faite dans Safari ;
- c'est l'application installée qui garde le billet enregistré. Un billet enregistré depuis Safari n'est pas visible dans l'application installée, et l'inverse non plus ;
- Safari peut effacer les données d'un site qu'on n'a pas ouvert depuis plusieurs jours (7 jours, selon les règles actuelles d'Apple). L'application installée sur l'écran d'accueil n'est pas soumise à cette règle ;
- sur iPhone, les notifications push ne fonctionnent que dans l'application installée.

---

## 3. Avant d'arriver : enregistrer son billet

Le billet (son QR code) n'existe que dans l'application, rubrique **Mes billets**. Le QR change toutes les 20 secondes : **une capture d'écran n'est pas acceptée** à l'entrée.

À partir de **24 heures avant le début** de l'événement :

1. Ouvrir l'application **avec du réseau** (Wi-Fi ou données mobiles), connecté à son compte.
2. Aller dans **Mes billets**. Le billet s'enregistre tout seul sur le téléphone, en quelques secondes.
3. Attendre que la carte du billet indique **« Disponible hors ligne »**.

Ce que peut indiquer la carte :

| Message sur la carte | Ce que cela veut dire |
|---|---|
| « Disponible hors ligne » | C'est bon : le billet s'affichera même sans réseau. |
| « Disponible hors ligne à partir du … » | Trop tôt : revenir avec du réseau à partir de la date indiquée (la veille de l'événement). |
| « Ouvrez ce billet avec du réseau avant d'arriver » | Le billet n'est pas encore enregistré : rester sur Mes billets, avec du réseau, jusqu'à « Disponible hors ligne ». |
| « Codes expirés : ouvrez le billet avec du réseau » | Rouvrir Mes billets avec du réseau pour recevoir de nouveaux codes. |

Il n'y a rien d'autre à faire : l'application refait l'enregistrement quand il le faut, à chaque ouverture avec du réseau.

## 4. À l'entrée, sans réseau

Pour afficher son billet :

- dans **Mes billets**, toucher **Afficher mes billets hors ligne** (ou **Afficher ce billet hors ligne** sur la carte du billet) ;
- ou ouvrir l'application depuis son icône : si le réseau est coupé et que la page ne peut pas se charger, l'application ouvre d'elle-même la page **Billet hors ligne** ;
- sur Android, l'appui long sur l'icône, puis **Billets hors ligne**.

La page **Billet hors ligne** montre le QR, qui change toutes les 20 secondes, le compte à rebours du prochain code, et le **numéro du billet**. Présenter le QR au contrôleur. L'écran reste allumé pendant l'affichage, si le téléphone le permet ; pensez à monter la luminosité.

Si plusieurs billets sont enregistrés sur le téléphone, la page les liste : toucher celui à présenter.

**L'heure du téléphone** : l'application corrige un téléphone en avance ou en retard, et le signale (« Ce téléphone est en avance de 5 min : le code affiché en tient compte »). En revanche, si l'heure du téléphone a été reculée après l'enregistrement, le code ne peut plus être calculé : remettre l'heure automatique, ou rouvrir le billet avec du réseau.

## 5. Si le billet ne s'affiche pas

Si le billet n'a pas été enregistré avant de perdre le réseau, l'application ne montre **aucun QR** et l'explique :

> Ce billet n'est pas enregistré sur ce téléphone. Reconnectez-vous au réseau, ou présentez votre numéro de billet et votre pièce d'identité au contrôle.

À l'entrée, donner au contrôleur le **numéro du billet** (de la forme `TCK-20261101-XXXXXXXXXX`) et une **pièce d'identité** au nom du titulaire : il peut enregistrer l'entrée à la main. Le numéro figure dans Mes billets, sur le PDF du billet et dans l'email de confirmation. Le PDF n'est pas un billet d'entrée : il ne contient pas de QR.

Autres cas où le billet n'est plus sur le téléphone, ou ne s'y enregistre pas :

- **déconnexion** du compte, ou connexion d'un autre compte sur le même téléphone : les billets enregistrés sont effacés ;
- **transfert** du billet à quelqu'un d'autre : il disparaît du téléphone de l'expéditeur, et ses anciens codes sont refusés à l'entrée ;
- **navigation privée**, stockage du navigateur effacé ou plein : la page le signale (« Stockage hors ligne indisponible sur ce téléphone ») ;
- après la fin de l'événement, les codes expirent.
