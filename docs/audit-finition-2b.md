# Contre-vérification — finition 2b (création d'un événement) et déconnexion sans réseau

Branche `audit/finition-2b`, partie de `main` à `08d854851`, qui contient la finition 2b et le lot sécurité « déconnexion
sans réseau ». Elle vit dans un dossier séparé.

**Tests seulement : aucun correctif.** Rien n'est fusionné. Aucun test ne vise un projet distant, et `.env.local` n'est
pas lu.

Six suites `tests/audit/cvf2b-*.test.ts` jouent l'attaquant, une par point de la consigne. Leurs aides sont dans
`cvf2b-12-helpers.ts`, `cvf2b-34-helpers.ts` et `cvf2b-56-helpers.ts`. Les comptes et les événements sont montés par le
service_role sur la base locale de la CI. L'attaquante passe ensuite par :
- les vraies routes de l'application ;
- la REST de Supabase et les fonctions de la base, avec sa clé publique et son jeton ;
- pour les points 5 et 6, la vraie bibliothèque d'authentification et les vrais modules de l'application, dans un
  navigateur simulé dans Node (stockage, IndexedDB, BroadcastChannel entre « onglets », service worker exécuté dans
  `node:vm`).

**Une suite verte veut dire « attaque bloquée », un test rouge « trou ».**

## À lire en premier

- **CI complète : run 338** (6692f7aab).
  - 472 suites, dont les 6 de la contre-vérification. Les **468 autres sont vertes**, l'e2e complet aussi (11 phases),
    et le poids JavaScript tient dans ses budgets.
  - Seules 4 suites d'audit sont rouges : **82 attaques, 66 bloquées, 16 trous.**
  - Le run rapide 337 a donné exactement les mêmes 16 rouges (plus le 4b, défaut de montage corrigé, voir § 4).
- **Trois trous de gravité élevée**, tous dans la déconnexion. Ils laissent sur un téléphone partagé les billets hors
  ligne de A, **avec leurs codes d'entrée**, que la page publique `/billet/hors-ligne` montre au suivant :
  - **6.4** : un téléchargement des billets en cours pendant « Se déconnecter » les réécrit après la purge ;
  - **6.5** : après « Déconnecter tous mes appareils » lancé depuis un autre appareil, le téléphone n'efface rien ;
  - **6.2** (moyenne, à traiter avec eux) : dans les autres onglets, l'administration, le scanner et le portefeuille
    restent à l'écran après la déconnexion.
- **Deux trous de cadence des SMS** (moyenne) : la règle « au plus 2 SMS par détenteur » se contourne.
  - **4d** : un changement enregistré pendant l'envoi du SMS précédent n'attend pas l'heure (2 SMS à 11 min d'écart).
  - **4f** : dans la dernière heure, reporter le début de quelques minutes rouvre le plafond : **4 SMS au même détenteur
    en 37 s**, et c'est répétable.
- **Création avec zones (point 1) et soumission (point 3) : tout est bloqué**, par la route comme par la base.
  - Point 1 : 18 sur 18.
  - Point 3 : 23 sur 23, courses comprises.
- **Deux trous déjà connus et documentés**, reconfirmés :
  - 6.6 et 6.7 : un jeton d'accès reste valable jusqu'à son échéance (1 h au plus, `lib/auth/sessions.ts:7`) ;
  - 5.d : le brouillon reste au repos quand la session se ferme à l'insu du navigateur (`docs/apres-lancement.md:53`).

## Résultats par point

Légende de la gravité :
- **Élevée** : une donnée qui donne accès (code d'entrée) reste lisible par un autre.
- **Moyenne** : abus réel, mais borné ou demandant un compte organisatrice.
- **Faible** : donnée au repos jamais montrée à un autre compte, ou affichage.

### 1. Création avec zones dans la même transaction — `cvf2b-1-zones-creation` : 18 sur 18, BLOQUÉE

| Attaque | Résultat |
|---|---|
| Zones ou portes visant les catégories, zones ou portes d'un autre événement ou d'une autre partenaire (`category_ids`, `id` de zone, `gates[].id`), par la route et par `event_create` | BLOQUÉE : refus par le schéma de la route ; en base, références étrangères ignorées ou INVALID_INPUT ; rien d'écrit, victime intacte |
| Indice de catégorie hors limites (-1, 2, 99, 100, 1.5, '0', null, true, [0]…), route et base | BLOQUÉE (INVALID_INPUT, `zones.0.category_refs`) |
| Zone sans catégorie, 21 zones, 51 portes (témoin à 20 et 50) | BLOQUÉE (ZONE_WITHOUT_CATEGORY, TOO_MANY_ZONES, TOO_MANY_GATES), rien d'écrit |
| Fiche EN_ATTENTE, REJETE, SUSPENDU (témoin : VALIDE) | BLOQUÉE par la route et par la base |
| Session de l'attaquante : RPC `event_create`, `event_zones_write`, `event_zones_save`, `event_zones_form_refusal` ; REST sur `event_zones`, `event_gates`, `zone_categories` | BLOQUÉE (fonctions réservées au service_role, tables sans écriture) |
| Scanner : zones créées avec l'événement ou ajoutées après | BLOQUÉE : même configuration lue, mêmes verdicts sur 11 passages (mauvaise zone, valide, déjà utilisé, carré), catégorie ajoutée après comprise |

### 2. Couleur, consigne, prix — `cvf2b-2-couleur-prix` : 9 sur 13

Chaque valeur est essayée par six chemins :
- les routes de création, de nouvelle catégorie et de modification ;
- en base, `event_create`, `ticket_category_create` et `ticket_category_update`.

Un témoin prouve d'abord que les six chemins acceptent une valeur légitime.

| Attaque | Résultat |
|---|---|
| Couleur hors palette (44 variantes : casse, espaces, caractère invisible, cyrillique, `#RGB`, `rgb()`, `hsl()`, noms CSS, nombre, tableau…) | BLOQUÉE par les six chemins |
| **Couleur de la palette confondable avec un verdict du scanner** | **TROU** (2 tests) : OR |
| Consigne trop longue (61 caractères visibles et variantes) | BLOQUÉE |
| **Consigne avec caractères de contrôle** | **TROU** |
| **Consigne avec contrôles bidirectionnels** | **TROU** |
| Consigne avec balises HTML | BLOQUÉE : jamais interprétée (aucun rendu HTML de la consigne) |
| Prix sous le minimum (minimum − 1, 1, négatif, décimal, texte, `NaN`, `Infinity`, `null`…) par les six chemins | BLOQUÉE |
| Prix d'une catégorie déjà vendue passé à 0 ou sous le minimum | BLOQUÉE (PRICE_LOCKED_AFTER_SALES) |
| Session de l'attaquante : REST sur `ticket_categories`, RPC des cinq fonctions des catégories | BLOQUÉE |

**2b — couleur OR, confondable avec l'ambre « hors fenêtre » du scanner. TROU, gravité faible.**
```
couleurs choisissables confondables avec un verdict (seuil 25 de la finition 2b) :
  - OR à 24 du orange « mauvaise zone »
  - OR à 5.1 du ambre « hors fenêtre »
couleur OR (5,1 de l'ambre « hors fenêtre », 24,0 de l'orange « mauvaise zone ») écrite :
  - OR par route POST /api/partner/events : HTTP 201 … ; enregistré "OR"
  - OR par route POST …/categories : HTTP 201 … ; enregistré "OR"
  - OR par route PATCH …/categories/[id] : HTTP 200 … ; enregistré "OR"
  - OR par base event_create / ticket_category_create / ticket_category_update : {"ok":true,…} ; enregistré "OR"
```
- La couleur automatique évite OR, mais le choix manuel reste ouvert. Le rapport de la 2b l'assume (« choix manuel
  possible »).
- Impact borné : la couleur n'est qu'un bandeau sur l'écran d'une entrée validée. Le contrôleur pourrait toutefois
  croire à un « hors fenêtre ».
- *Correctif proposé* : retirer OR de la palette choisissable (ou l'éclaircir), puisque l'écart de 25 fixé par la 2b
  n'est tenu que par la couleur automatique.

**2c — caractères de contrôle et contrôles bidirectionnels dans la consigne. TROU, gravité faible.**
```
consignes enregistrées avec des caractères de contrôle (les noms de zone et de porte les refusent : [[:cntrl:]]) :
  - "Entrée\u0007 VIP" par les six chemins : enregistré "Entrée\u0007 VIP" (HTTP 201 / 200 / {"ok":true})
  - "Bracelet \u001b[31mrouge\u001b[0m" par les six chemins : enregistré tel quel
  - "Porte\b\b\b B" par les six chemins : enregistré tel quel
  - "Zone\u007f A" par les six chemins : enregistré tel quel
```
- Les contrôles bidirectionnels (U+202E, U+2066 à U+2069, U+200F) sont eux aussi enregistrés par les six chemins.
- La consigne s'affiche en très grand sur l'écran du contrôleur et sur la fiche admin. Un U+202E y inverse le texte
  affiché, et l'organisatrice peut ainsi faire lire au contrôleur autre chose que ce qui est écrit.
- Seuls ses propres contrôleurs sont touchés.
- *Correctif proposé* : refuser dans la consigne `[[:cntrl:]]` et les contrôles bidirectionnels (U+200E, U+200F, U+202A
  à U+202E, U+2066 à U+2069), dans `ticket_category_normalize` et dans le schéma, comme pour les noms de zone et de porte.

### 3. Soumission depuis le formulaire — `cvf2b-3-soumission` : 23 sur 23, BLOQUÉE

| Attaque | Résultat |
|---|---|
| Route de soumission avec un manque à la fois (affiche, repère, aucune catégorie, seule catégorie désactivée, début passé, dates de vente incohérentes) puis tous ensemble | BLOQUÉE : 422 qui nomme le manque, l'événement reste BROUILLON, aucune ligne d'historique ni d'avis |
| Formulaire : manque ajouté par les routes de modification (affiche retirée ou en espaces, repère retiré, catégorie désactivée ou supprimée, dates absentes ou incohérentes) puis envoi | BLOQUÉE |
| Création « déjà soumise » (`status`, drapeau d'envoi dans le corps) | BLOQUÉE : jamais hors du brouillon |
| REST et RPC avec la session de l'organisatrice : statut écrit, historique, catégorie, `event_transition`, `event_status_apply`, `event_update`… | BLOQUÉE (42501) |
| Soumettre, retirer, publier ou compléter l'événement d'une autre (y compris `actor_id` = la victime) | BLOQUÉE |
| Courses (4 tours, `Promise.all`) : un manque ajouté pendant la soumission | BLOQUÉE : jamais EN_ATTENTE avec un manque (verrous sérialisés) |

### 4. Avis de date et de lieu — `cvf2b-4-avis-cadence` : 6 sur 8

| Attaque | Résultat |
|---|---|
| Fenêtre « Prévenir » évitée : PUT direct sans aperçu | BLOQUÉE : le serveur prévient chaque détenteur quand même |
| Drapeaux de silence dans le corps ou le patch (`notify`, `silent`, `notify_holders`…) | BLOQUÉE (INVALID_BODY, UNKNOWN_FIELD) |
| Repasser au brouillon ou en attente pour modifier sans prévenir | BLOQUÉE (TRANSITION_NOT_ALLOWED) |
| Six onglets sur la même version, enregistrements simultanés | BLOQUÉE : 1 accepté, 5 × 409 EDIT_CONFLICT, 1 SMS par détenteur |
| Onglets obstinés : date, lieu, ville et petits pas du repère en alternance, deux heures simulées | BLOQUÉE : 1 SMS par heure glissante |
| **Changement enregistré pendant l'envoi du SMS précédent** | **TROU** (4d) |
| Dernière heure : rafales parallèles, puis report du début au-delà d'une heure | BLOQUÉE : 2 SMS au plus |
| **Dernière heure : report du début de quelques minutes** | **TROU** (4f) |

*Note sur le montage du 4b.* Au run 337, le seul enregistrement accepté était un déplacement du repère de 150 m. Or un
déplacement de 200 m ou moins ne prévient pas, par règle (`20261119000006:690-699`). Le test a donc compté 0 SMS : c'est
un défaut du montage, pas un trou, puisque la propriété attaquée tenait (1 accepté, 5 refusés). Les six onglets
n'envoient plus que des changements qui préviennent, et le test exige toujours exactement 1 SMS (6692f7aab).

**4d — avis enregistré pendant l'envoi du SMS précédent. TROU, gravité moyenne.**
```
TROU : 2 SMS au même détenteur en moins d'une heure (changement enregistré pendant l'envoi du précédent, non retenu) :
SENT créée 20:46:27.345 due 20:56:27.345 partie 20:57:27.364 ["end_time"] |
SENT créée 20:46:27.400 due 20:56:27.400 partie 21:08:27.423 ["location"]
```
- La retenue d'une heure ne regarde que les avis PENDING (`20261119000006:714-716`), et `last_sent_at` n'est posé qu'au
  passage SENT (`f2acv_avis_de_lieu.sql:1032`). Or l'envoyeur ne marque les lignes qu'en fin de lot
  (`lib/notifications/dispatcher.ts:627-634`).
- Pendant l'envoi d'un lot (de quelques secondes à quelques minutes avec beaucoup de détenteurs), un nouveau changement
  part donc 10 min plus tard au lieu d'attendre l'heure. Les deux SMS sont partis à 11 min d'écart.
- *Correctif proposé* : compter aussi les avis SENDING (ou poser `last_sent_at` à la réservation) dans la retenue d'une
  heure de `event_update`.

**4f — dernière heure : un report du début de quelques minutes rouvre le plafond de 2. TROU, gravité moyenne.**
```
TROU : 4 SMS au même détenteur en 37 s (plafond de 2 rouvert par un report du début) :
SENT 20:46:28.649 ["end_time"] | SENT 20:46:28.713 ["end_time"] | SKIPPED(LAST_HOUR_CAP) 20:46:28.747 ["end_time"] |
SKIPPED(LAST_HOUR_CAP) 20:47:05.110 ["start_time"] | SENT 20:47:05.261 ["end_time"] | SENT 20:47:05.353 ["end_time"]
```
- Le plafond de la dernière heure compte depuis `LEAST(ancien, nouveau début) − 1 h` (`20261119000006:187, 794`).
  Reporter le début d'une vingtaine de minutes sort de cette fenêtre les deux SMS déjà partis, et le compteur repart.
- Répétable : chaque report rouvre deux SMS. Il n'est borné que par le plafond de 30 SMS par jour et par numéro
  (`lib/sms/sms-guard.ts`), qui est la limite générale.
- Si la règle voulue est « 2 SMS dans la dernière heure du début en vigueur », c'est conforme à sa lettre. La consigne
  dit « jamais plus de 2 » : le test applique celle-ci.
- *Correctif proposé* : compter le plafond sur les SMS d'avis envoyés au détenteur dans l'heure glissante (ou depuis la
  première entrée dans la dernière heure), sans dépendre de l'heure de début.

### 5. Brouillon dans le navigateur — `cvf2b-5-brouillon` : 3 sur 5

| Attaque | Résultat |
|---|---|
| Le compte B (même équipe, même événement, en création et en modification) reprend le brouillon de A, même recopié sous la clé de B | BLOQUÉE : clé et contenu propres au compte ; contenu étranger refusé et effacé |
| La purge couvre toutes les clés du module | BLOQUÉE |
| **Connexion de B sans déconnexion de A (onglet resté ouvert)** | **TROU** (5c) |
| **Session de A close à l'insu du navigateur, page rechargée, puis connexion de B** | **TROU connu** (5d) |
| « Se déconnecter » dans l'onglet 1 : l'onglet 2 reçoit SIGNED_OUT, efface les brouillons, son formulaire s'arrête | BLOQUÉE (vraie bibliothèque, BroadcastChannel) |

**5c et 5d — brouillon de A gardé au repos pendant la session de B. TROU, gravité faible (5d déjà connu).**
```
[CVF2B-5] c. branche « SIGNED_IN d'un autre compte » d'AuthProvider : else if (event === 'SIGNED_IN' && nextUserId &&
  previousUserId && nextUserId !== previousUserId) { void clearOfflineStore(); }
[CVF2B-5] c. brouillon de A lisible en clair dans localStorage pendant la session de B :
  {"v":1,"userId":"f0de16e1-…","eventId":"fc2ab4c2-…","savedAt":"…","data":{"title":"Gala privé de A",…}}
[CVF2B-5] d. purges des brouillons dans l'écouteur : 1 ; hors SIGNED_OUT et hors condition sur previousUserId : 0 ;
  lastUserIdRef remis à null à chaque chargement : true
```
- B ne voit jamais le brouillon de A **dans l'application** (5a). Mais le brouillon reste lisible dans le stockage par
  les outils du navigateur, sur un poste partagé.
- Le changement de compte n'efface que les billets hors ligne (`AuthProvider.tsx:198-199`). Après un rechargement, la
  mémoire du compte précédent est perdue (`:134`).
- *Correctif proposé* : à toute connexion, effacer les brouillons dont le compte n'est pas celui qui se connecte (et
  borner leur durée de vie, comme l'envisage `apres-lancement.md`).

### 6. Déconnexion sans réseau — `cvf2b-6-deconnexion` : 7 sur 15

| Attaque | Résultat |
|---|---|
| L'onglet 2 reçoit SIGNED_OUT et efface billets hors ligne et mémoire du contrôle | BLOQUÉE |
| **Autres onglets : un écran personnel déjà affiché reste à l'écran** | **TROU** (6.2) |
| Purge réelle d'IndexedDB à la déconnexion et à la désignation d'un autre compte | BLOQUÉE |
| **Téléchargement des billets en vol pendant « Se déconnecter »** | **TROU** (6.4) |
| **« Déconnecter tous mes appareils » depuis un autre appareil : billets hors ligne du téléphone** | **TROU** (6.5) |
| **Ancien jeton d'accès après « Se déconnecter » (révocation faite)** | **TROU connu** (6.6) |
| **Jeton d'accès de l'autre appareil après « Déconnecter tous mes appareils »** | **TROU connu** (6.7) |
| **Abonnements push des autres appareils après « Déconnecter tous mes appareils »** | **TROU** (6.8) |
| **SIGNED_OUT venu d'ailleurs : abonnement push de ce navigateur** | **TROU** (6.9) |
| Retour du réseau, deux onglets, rafraîchissement de l'onglet 2 parti avant la déconnexion (réponse avant ou après la révocation) | BLOQUÉE : aucune session rouverte, jetons révoqués, aucune requête avec l'ancien jeton |
| Scanner : mémoire du contrôle (QR en attente compris), codes, liste de billets, jeton explicite | BLOQUÉE : tout effacé, rien sur l'appareil, cookies seulement |
| Service worker (`public/sw.js` exécuté) après une session complète : pages et API personnelles en cache | BLOQUÉE : rien de personnel en cache |
| Inventaire : une seule base IndexedDB (purgée en entier), caches écrits par le seul service worker | BLOQUÉE |
| **Inventaire : clés de stockage web liées au compte, effacées à la déconnexion** | **TROU** (6.13b) |

**6.4 — téléchargement des billets en vol pendant « Se déconnecter ». TROU, gravité élevée.**
```
[CVF2B-6] 4. à la déconnexion : {"userId":null,"lots":[]} ; issue du téléchargement : saved ;
  page hors ligne ensuite : compte A, 1 billet(s) ;
  IndexedDB : [{"userId":"b742aa08-…","ticketId":"cbbd2686-…","codes":"123456654321111111222222"}]
après la déconnexion, la réponse en vol a réécrit le compte courant et le lot de A (OfflineTicketsSync.downloadIfNeeded :
setCurrentOfflineUser puis saveOfflineLot sans vérifier que la session existe encore)
```
- La réponse arrive après la purge et réécrit le compte courant et le lot de A (`OfflineTicketsSync.tsx:124`, puis
  `:155-156`).
- `/billet/hors-ligne`, page publique sans session, remontre ensuite le billet et ses codes d'entrée.
- *Correctif proposé* : abandonner l'écriture du lot si une déconnexion a eu lieu depuis le début du téléchargement
  (génération de session vérifiée juste avant `setCurrentOfflineUser` et `saveOfflineLot`, dans la même transaction).

**6.5 — « Déconnecter tous mes appareils » depuis un autre appareil. TROU, gravité élevée.**
```
[CVF2B-6] 5. middleware « / » : HTTP 200, cookies posés ["sb-127-auth-token.0=(vide)","sb-127-auth-token.1=(vide)"] ;
  cookies de session restants [] ; événements de la page : INITIAL_SESSION
[CVF2B-6] 5. purge d'AuthProvider sans SIGNED_OUT : false ; /billet/hors-ligne lit listCurrentOfflineLots sans session :
  true ; billets montrés : compte A, [{"ticket":"EV-CVF2B-0001","codes":"123456654321111111222222"}]
le téléphone ne reçoit pas SIGNED_OUT (événements : INITIAL_SESSION ; cookies effacés par le middleware) et AuthProvider
ne purge rien sans lui : les billets hors ligne de A restent et /billet/hors-ligne les montre
```
- C'est le cas pour lequel le bouton existe (téléphone perdu ou partagé) : la session est bien révoquée, mais les
  billets et leurs codes restent montrés sur le téléphone.
- *Correctif proposé* : au chargement, quand la session est absente (INITIAL_SESSION sans utilisateur) alors qu'un compte
  hors ligne est enregistré, effacer les billets hors ligne, la mémoire du contrôle et les brouillons. Le middleware
  peut aussi le signaler par un en-tête ou un cookie, quand il efface une session révoquée.

**6.2 — autres onglets : écran personnel gardé après la déconnexion. TROU, gravité moyenne.**
```
[CVF2B-6] 2. Mes billets, Profil, Notifications, Commandes, Espace partenaire : garde sur la perte du compte
[CVF2B-6] 2. Administration (app/admin/layout.tsx, components/admin/AdminStepUpGate.tsx) : AUCUNE garde
[CVF2B-6] 2. Contrôleur (scanner, profil) (app/controller/layout.tsx) : AUCUNE garde
[CVF2B-6] 2. Portefeuille (app/wallet/page.tsx) : AUCUNE garde
[CVF2B-6] 2. AuthProvider masque la page sur SIGNED_OUT dans tous les onglets : false ;
  écran « déconnecté » posé seulement par signOut : true
```
- Plus aucune requête ne passe, mais ce qui est affiché reste lisible : liste des comptes en administration, scanner,
  soldes.
- *Correctif proposé* : poser l'écran « Vous êtes déconnecté » dans AuthProvider sur tout SIGNED_OUT (pas seulement dans
  l'onglet du bouton), ou ajouter la garde de perte du compte aux trois espaces.

**6.6 et 6.7 — jeton d'accès encore accepté par la REST après la révocation. TROU connu, gravité moyenne.**
```
[CVF2B-6] 6. révocation : fait ; GoTrue /user avec l'ancien jeton : refusé ;
  REST avec l'ancien jeton : HTTP 200 [{"id":"e29e6d5c-…","phone":"+221766486747"}]
[CVF2B-6] 7. révocation partout : fait ; autre appareil — GoTrue : refusé, rafraîchissement : refusé,
  REST : HTTP 200 [{"id":"1a958799-…","phone":"+221766486912"}]
```
- PostgREST ne vérifie que la signature et l'échéance (`jwt_expiry = 3600`). Le comportement est écrit dans
  `lib/auth/sessions.ts:7-8`. Les droits restent relus en base à chaque requête.
- *Correctif proposé* : refuser dans les politiques (ou une fonction appelée par `db_pre_request`) tout jeton dont la
  session (`session_id` du jeton) n'existe plus dans `auth.sessions`, ou ramener `jwt_expiry` à quelques minutes.

**6.8 et 6.9 — abonnements push gardés. TROU, gravité moyenne.**
```
[CVF2B-6] 8. révocation partout : fait ; abonnements push du compte restants :
  [{"id":"f9adc2a1-…","user_agent":"Téléphone partagé (CVF2B-6)"}]
[CVF2B-6] 9. signOut retire l'abonnement : true ; branche SIGNED_OUT :
  { void clearOfflineStore(); clearAllScanMemory(); clearAllDrafts(); }
```
- Les notifications du compte (billets, changements d'événement) continuent d'arriver sur le téléphone partagé.
- *Correctif proposé* : supprimer les `push_subscriptions` du compte dans `sign-out-global` (sauf celle de l'appareil qui
  le demande), et appeler `unsubscribePush` dans la branche SIGNED_OUT d'AuthProvider.

**6.13b — liens et QR de paiement gardés dans l'onglet. TROU, gravité faible.**
```
[CVF2B-6] 13b. lib/payments/payment-client.ts : liens et QR de paiement de l'opérateur pour un paiement du compte
  (sessionStorage « event-village:paiement: ») — liée au compte, JAMAIS effacée à la déconnexion
```
- La donnée est lisible seulement par les outils du navigateur, dans l'onglet du paiement.
- *Correctif proposé* : effacer les clés `event-village:paiement:` dans la purge de la déconnexion.

## Ce qui n'est pas couvert

- **Hors de portée de Node :**
  - rendu React : les écouteurs d'AuthProvider, les gardes d'écran des points 5c, 5d, 6.2 et 6.9, et l'arrêt du
    formulaire sont vérifiés par lecture du code, les purges par les vraies fonctions ;
  - vrai service worker du navigateur et cache HTTP (les routes `/api/*` sont `no-store`) ;
  - onglet gelé ou en cache de retour, WebView sans BroadcastChannel.
- **Non testés, mais déduits du code :**
  - un SMS juste avant la dernière heure, puis deux dans la dernière heure, donneraient 3 SMS en une dizaine de
    minutes (il faudrait 10 minutes réelles d'attente) ;
  - les numéros sans compte suivent le même code que 4d et 4f ;
  - le minuteur de 0,8 s du formulaire de l'onglet 2 pourrait réécrire un brouillon entre la purge et le démontage ;
  - une liste `/api/tickets` en vol pourrait reposer le compte hors ligne courant (variante de 6.4).
- **Hors de la consigne :** une catégorie active sans canal de vente satisfait la règle « au moins une catégorie
  active » de la soumission.

## Fichiers

| Fichier | Contenu |
|---|---|
| `tests/audit/cvf2b-1-zones-creation.test.ts` | point 1, sortie `[CVF2B-1]` |
| `tests/audit/cvf2b-2-couleur-prix.test.ts` | point 2, sortie `[CVF2B-2]` |
| `tests/audit/cvf2b-12-helpers.ts` | aides des points 1 et 2 (routes, traces en base, écart de couleur CIEDE2000) |
| `tests/audit/cvf2b-3-soumission.test.ts` | point 3, sortie `[CVF2B-3]` |
| `tests/audit/cvf2b-4-avis-cadence.test.ts` | point 4, sortie `[CVF2B-4]` |
| `tests/audit/cvf2b-34-helpers.ts` | aides des points 3 et 4 (comptage des SMS par la boîte d'envoi) |
| `tests/audit/cvf2b-5-brouillon.test.ts` | point 5 (sans base), sortie `[CVF2B-5]` |
| `tests/audit/cvf2b-6-deconnexion.test.ts` | point 6, sortie `[CVF2B-6]` |
| `tests/audit/cvf2b-56-helpers.ts` | navigateur simulé (stockage, IndexedDB, onglets) |

Les suites qui écrivent en base finissent par `assertFinition1Invariants`. Journaux bruts : `ci-results`,
`runs/338-44172096581/test-logs/tests__audit__cvf2b-*.log` (run complet) et `runs/337-44168886361/` (run rapide).
