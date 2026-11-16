# Finition 2a — Fin retenue, carte, affiche (et sécurité de la fiche suspendue)

Branche `finition-2a/fin-carte-affiche`, partie de `main` à `c248e17f`, dans son propre dossier (`event-village-finition2a`). Rien n'est fusionné. Le dossier de recette n'a pas été touché.

## À lire en premier

**La sécurité d'abord (§ 1).** Deux failles corrigées en premier, chacune avec un test rouge puis vert :

1. **Fiche SUSPENDU (1a).** Une partenaire dont la fiche est suspendue gardait l'écriture sur ses événements. Seule la remise en ligne lui était déjà refusée (lot 9 bis). Elle pouvait :
   - modifier l'événement, ses catégories de billets et ses zones ;
   - inviter ;
   - générer le PIN régisseur ;
   - annuler l'événement ;
   - le soumettre ou le retirer de la validation ;
   - rembourser.

   Désormais ses événements sont en lecture seule pour elle, quel que soit leur statut, à la route **et** en base :
   - 17 actions d'écriture refusées par la route, avec le texte demandé suivi du contact du support (§ 4.1) ;
   - 10 fonctions d'écriture de la base refusent aussi. Le PIN régisseur passe par une fonction nouvelle qui refuse de même, seule écriture du PIN par l'application. Un déclencheur bloque la suppression directe d'un événement ;
   - elle lit toujours tout ;
   - un admin qui a `events.write` garde ses actions ;
   - ses contrôleurs scannent toujours (règle A9).

   Test : `f2a-fiche-suspendue`. Il essaie une modification valide (« Modifier » puis « Enregistrer »), chaque route d'écriture, puis chaque fonction appelée directement.
2. **Affiche (1b).** L'image déposée était gardée telle quelle dans le stockage public. Ses métadonnées l'accompagnaient donc, lisibles par n'importe quel visiteur : position GPS de la prise de vue, modèle du téléphone, date. Désormais l'image est réencodée par sharp : en WebP, 1 600 px au plus de côté, sans aucune métadonnée (test : position GPS posée dans l'image d'essai, absente du fichier stocké). De plus :
   - à l'enregistrement, le serveur vérifie que le fichier existe vraiment dans le dossier de la partenaire ;
   - l'affiche remplacée est effacée ;
   - les affiches de brouillons abandonnés sont purgées au bout de 7 jours, jamais une affiche citée par un événement (testé).
3. **Erreurs de ma part, trouvées et corrigées avant le run « après » final (rien n'a été appliqué hors CI) :**
   - **Remboursements.** Dans la recopie de `ticket_refund_request` (migration 1), le contrôle de la fiche utilisait l'alias `t` alors que la fonction déclare une variable `t`. PL/pgSQL aurait refusé la référence comme ambiguë : **toute demande de remboursement aurait échoué**. Corrigé (alias `tk`).
   - **Purge des affiches.** Elle comparait les adresses complètes. Une affiche encore citée, mais sous une autre forme d'adresse ou avec un nom ancien hors du format actuel, aurait pu être effacée. La comparaison se fait maintenant par chemin de stockage, sur l'affiche et la galerie de tous les événements (§ 1.2).
   - **Ordre des refus à la création.** Une fiche non validée recevait « affiche introuvable » avant « profil non validé ». L'affiche n'est désormais vérifiée que pour une fiche VALIDE.
   - **Tests de la finition.** Au run 222, `f2a-fiche-suspendue` s'arrêtait au montage : colonne `origin` au lieu de `sale_channel`, catégorie différente de celle qu'attend l'aide `freeTicket`, et un témoin admin passant par `event_update`, que l'administration n'utilise jamais. Montage corrigé et preuve des rouges refaite (§ 6). Au run 224, la partie route de ce test s'arrêtait sur la création, déjà refusée sur `main` avec un autre code. Le rouge ne montrait donc pas qu'une modification passait par la route. J'ai ajouté l'essai « modification valide » et refait la preuve.
   - **Premier verify complet de la branche (run 226) : 4 suites existantes rouges, 3 causes, toutes corrigées (§ 6) :**
     - Mon déclencheur sur la table du PIN régisseur refusait aussi le compte de service. L'aide de test qui pose un PIN le temps d'une ouverture de caisse échouait donc dans `cvf1-4-proprietaire` (suite d'audit) et `cvf1c-t2-caisse`. Je l'ai retiré : il doublait la fonction `event_regisseur_pin_store`, seule écriture du PIN par l'application, qui refuse déjà la partenaire suspendue en base. Un test statique vérifie maintenant que l'application n'écrit jamais le PIN directement.
     - `edition-formulaire` déplaçait le repère d'un événement publié de 3,5 km et attendait « personne n'est prévenu ». Avec la règle des 200 m demandée, c'est un changement de lieu. Le test déplace désormais le repère de 100 m (champ libre) ; le cas au-delà de 200 m est couvert par `f2a-carte`.
     - `lot9quater-technique` déposait une suite d'octets qui n'était pas un PNG valide. Le serveur la refuse maintenant (« Image illisible »). Le test dépose une vraie image.
4. Aucune autre faille trouvée. La route nouvelle (recherche de lieu) et les routes modifiées vérifient droit, propriété et état (§ 1.3). `tests/audit/` et `tests/audit-auth/` sont verts au run final 231 (26 suites).

**Ce qui change pour les organisatrices :**
- **Position du lieu obligatoire pour soumettre** un événement (pas pour un brouillon). Le refus le dit : « L’événement est incomplet : Placez le repère du lieu sur la carte (étape Accès). »
- **Fin retenue affichée.** Sous les dates du formulaire, « Fin retenue : {jour} à {heure} » quand aucune heure de fin n'est saisie. C'est la même fin partout : base, catalogue, onglet Équipe, « Mes soirées », fiche admin, nouvel onglet « Infos ».
- **Carte de l'étape Accès** :
  - aucun repère tant que rien n'est choisi ;
  - carte placée sur la ville choisie ;
  - recherche « Rechercher un lieu » ;
  - sur téléphone, la page défile d'un doigt ;
  - un repère déplacé de plus de 200 m après validation prévient les détenteurs comme un changement de lieu.
- **Affiche :** format conseillé et aperçu du recadrage des cartes du site.

**À faire avant le déploiement (§ 10) :**
- appliquer **trois migrations `20261116…`** (§ 5) ;
- régler `NOMINATIM_CONTACT` sur Vercel ;
- relire la liste des affiches que la première purge effacera (contrôle E du § 5.1). C'est la seule opération qui supprime des fichiers existants.

**Runs (§ 6) :**
- « avant » : 220 sur `42cd983d` (code de `main` et captures « avant »). verify vert. Le job s'est arrêté à la limite de 75 min pendant le parcours e2e, après les captures. La limite passe à 90 min, justifiée au § 6 ;
- preuve des rouges : run 229 sur `c3359807` (tests de la finition sur le code de `main`). Exactement les 5 suites f2a rouges, pour les bonnes raisons ; les 417 autres vertes. Sur `main`, la fiche suspendue modifie son événement publié par la route (HTTP 200) comme par la base ;
- « après » : run 231 sur `94a195dd`, **vert** :
  - verify : 423 suites sur 423, dont les 26 de `tests/audit/` et `tests/audit-auth/` ;
  - parcours e2e vert : 500 captures, aucun échec ; les 55 captures sautées sont les mêmes que sur `main` ;
  - durée : 81 min.

Invariants à 0. Budgets JavaScript respectés et non relevés. Captures 390 et 1440 px, clair et sombre (§ 7).

**Fichiers existants modifiés pour les tests, chacun justifié au § 8.2 :**
- 13 fichiers de test ou d'aide aux tests ;
- le script d'essai `seed-dev` ;
- 2 documents dont les citations de lignes ont été recalées.

Aucune assertion de sécurité existante affaiblie. Dans les tests de la finition, une seule vérification a été remplacée : celle de l'écriture directe du PIN refusée, puisque le déclencheur est retiré. Elle est remplacée par le refus de la fonction et par un contrôle statique (§ 1.1).

## 1. Sécurité

### 1.1 Fiche SUSPENDU : événements en lecture seule pour la partenaire (1a)

**Avant.** La suspension d'une fiche partenaire coupait la publication (lot 9 bis, R5) et le scan de la propriétaire (finition 1). Mais toutes les autres écritures sur ses événements passaient : modification, catégories, zones, invitations, PIN régisseur, annulation, transitions, remboursements.

**Maintenant**, pour une partenaire dont la fiche est SUSPENDU :

- **Route.** `requireActiveSession` appelle `partnerFicheRefusal` sur toute route `/api/partner/*`. Pour une écriture, il répond `403 PARTNER_SUSPENDED` avec « Votre compte organisateur est suspendu : vos événements ne sont plus modifiables. Contactez le support. » suivi du contact lu dans les réglages (§ 4.1). Une écriture, c'est toute méthode autre que GET sous `/api/partner/events`, sauf l'export des participants (une lecture), plus `/api/partner/upload`. Soit 17 actions :

  | Route | Méthodes |
  |---|---|
  | `/api/partner/events` (création) | POST |
  | `…/[id]` | PUT, DELETE |
  | `…/[id]/transition` | POST |
  | `…/[id]/cancel` | POST |
  | `…/[id]/categories` | POST |
  | `…/[id]/categories/[categoryId]` | PATCH, DELETE |
  | `…/[id]/zones` | PUT |
  | `…/[id]/invitations` | POST |
  | `…/[id]/invitations/[ticketId]` | PATCH |
  | `…/[id]/invitations/[ticketId]/cancel` | POST |
  | `…/[id]/regisseur-pin` | POST |
  | `…/[id]/promotion` | POST |
  | `…/[id]/cash-refunds/[paymentId]` | POST |
  | `…/[id]/tickets/[ticketId]/refund` | POST |
  | `/api/partner/upload` | POST |

- **Base** (migration `20261116000001`). `partner_owner_suspended(événement, acteur)` est vraie si l'acteur est la propriétaire, que sa fiche est SUSPENDU et qu'elle n'a pas `events.write`. Elle est contrôlée au début de chaque fonction d'écriture :
  - `event_create` et `event_update` ;
  - `event_transition` et `event_cancel` ;
  - `ticket_category_guard` (création, modification, suppression de catégorie, enregistrement des zones) ;
  - `ticket_invitation_create`, `_cancel` et `_guest_name_set` ;
  - `event_cash_refund_mark` et `ticket_refund_request` (côté propriétaire).

  Le PIN régisseur passe par la nouvelle fonction `event_regisseur_pin_store`, qui refuse de même ; c'est la seule écriture du PIN par l'application. La suppression directe d'un événement est refusée par `trg_events_suspended_owner_delete`, car la route supprime un brouillon sans passer par une fonction.

  Pas de déclencheur sur la table du PIN : une première version en avait un. Il refusait aussi le compte de service, c'est-à-dire la plateforme elle-même, que rien ne bloque sur les autres tables. Il a cassé l'aide de deux suites existantes (run 226) et je l'ai retiré.
- **Ce qui reste permis :**
  - toutes ses lectures (pilotage, ventes, entrées, export) ;
  - les actions d'un admin `events.write` ;
  - le scan de ses contrôleurs (A9).

**Test `f2a-fiche-suspendue`.** Il construit un brouillon, un événement publié avec catégories, zones, billets, invitation et PIN, puis suspend la fiche. Ensuite il vérifie :
- « Modifier » puis « Enregistrer » avec une modification valide (titre, version lue de l'événement) : 403, texte exact suivi du contact, titre inchangé ;
- chaque route d'écriture, trouvée en parcourant les fichiers de route : 403, texte exact suivi du contact ;
- un instantané de l'événement, des catégories, zones, billets, PIN et du brouillon, inchangé ;
- chaque fonction appelée directement : refusée ;
- le PIN par `event_regisseur_pin_store` : refusé ; la suppression directe du brouillon : refusée ;
- aucune écriture directe du PIN dans `lib/` ni `app/` (contrôle statique : sur `main`, il trouve celle de `lib/shifts/shift.service.ts`) ;
- les lectures : 200 ;
- un admin qui modifie : accepté ;
- un scan de contrôleur : « valide ».

### 1.2 Affiche : métadonnées, fichier réel, effacement (1b)

**Avant.** `POST /api/partner/upload` gardait les octets reçus. Une photo prise au téléphone emportait donc sa position GPS dans le stockage public. Par ailleurs :
- le serveur acceptait d'enregistrer l'adresse d'une affiche sans vérifier que le fichier existait ;
- l'affiche remplacée restait ;
- les brouillons abandonnés laissaient leurs affiches.

**Maintenant :**
- **Réencodage** par sharp : orientation appliquée, réduite à 1 600 px au plus de côté, jamais agrandie, WebP qualité 82. Une garde contre les images géantes (40 millions de pixels) est en place. sharp ne recopie aucune métadonnée : EXIF et GPS, XMP, IPTC, profil ICC. Le fichier est rangé sous `events/<partenaire>/<horodatage>_<8 caractères>.webp`. Une image illisible est refusée : « Image illisible : choisissez une autre image JPEG, PNG ou WebP. »
- **Existence vérifiée** à l'enregistrement, à la création et à la modification quand l'affiche change. Le fichier doit exister dans le dossier de la partenaire, sinon `400 IMAGE_NOT_FOUND` « L’affiche n’a pas été trouvée : déposez-la de nouveau. » À la création, la vérification ne s'applique qu'à une fiche VALIDE : une autre fiche reçoit d'abord son propre refus (profil non validé, suspendu).
- **Affiche remplacée effacée** si aucun événement ne la cite plus (affiche ou galerie, de tous les événements, y compris la galerie de l'événement lui-même). Un échec est journalisé et la purge la reprend.
- **Purge des affiches orphelines** par la tâche planifiée existante `events-finish`, toutes les 15 min : fichiers du dossier `events/` de plus de 7 jours qu'aucun événement ne cite, 200 au plus par passage. La comparaison se fait par **chemin de stockage**, décodé, quel que soit l'hôte de l'adresse et sans filtre sur le nom. Une affiche citée n'est jamais effacée, même ancienne ou écrite autrement (correction faite pendant la finition, voir « À lire en premier »).
- **Navigateur** : l'image est réduite avant l'envoi, sur la page de création seulement. Elle est redessinée dans un canvas, sans bibliothèque. Une photo de téléphone tient ainsi sous la limite de 5 Mo. Le serveur réencode de toute façon.

**Test `f2a-affiche` :**
- JPEG 3 200 × 2 000 avec un bloc GPS (précondition vérifiée sur l'image d'essai) et une marque texte → fichier WebP de 1 600 px de large, sans EXIF, XMP, IPTC ni ICC, marque absente ;
- un PNG de 300 × 200 n'est pas agrandi ;
- affiche absente → `IMAGE_NOT_FOUND` et son texte ;
- remplacement → ancienne effacée, sauf si un autre événement la cite ;
- purge → orpheline de plus de 7 jours effacée ; affiche citée et affiche récente gardées.

### 1.3 Droits des routes nouvelles ou modifiées

| Route | Droit | Propriété | État |
|---|---|---|---|
| `GET /api/partner/places/search` (nouvelle) | session active ; organisateur (PARTENAIRE, ADMIN, SUPERADMIN), sinon 403 ; sans session 401 | sans objet (aucune donnée d'un tiers) | quota par compte et par heure (429) ; recherche de 3 à 120 caractères (400) ; règles de la fiche partenaire de `requireActiveSession` |
| Écritures de `/api/partner/events/*` et `/api/partner/upload` | inchangé | inchangée (`requireEventAccess`, fonctions de la base) | **fiche SUSPENDU : 403 PARTNER_SUSPENDED**, route et base |
| `PUT /api/partner/events/[id]` | inchangé | inchangée | position contrôlée (schéma et base) ; affiche vérifiée |
| `POST /api/partner/events/[id]/transition` | inchangé | inchangée | soumission sans position refusée (base) |
| `GET /api/partner/events/[id]` (lu par l'onglet Infos) | inchangé (`events.read`) | inchangée | inchangé |

La recherche passe par le serveur et jamais par le navigateur : aucune adresse ni contact du service n'est exposé à l'écran.

## 2. État de chaque point

| Point | État | Preuve |
|---|---|---|
| 1a Fiche SUSPENDU en lecture seule (route et base) | Fait | `f2a-fiche-suspendue` |
| 1b Affiche réencodée, vérifiée, effacée, purgée ; format conseillé et aperçu ; réduction dans le navigateur | Fait | `f2a-affiche`, `f2a-ecrans` |
| 2 Fin retenue : une seule règle (`event_end_at`) partout ; formulaire, fiche admin, onglet Infos | Fait | `f2a-fin-retenue`, `f2a-ecrans` |
| 3 Carte : repère, centre de la ville, défilement au doigt, recherche de lieu, position en base, 200 m, fiche admin et Infos | Fait | `f2a-carte`, `f2a-ecrans` |
| Hors périmètre | Noté | `docs/apres-lancement.md`, section « Fin retenue, carte, affiche (finition 2a) » |

## 3. Ce qui existait, ce qui change

### 3.1 Fin retenue (E-01)

La règle de la base, `event_end_at`, est la seule :
- fin saisie ;
- date de fin sans heure : ce jour à 23:59 ;
- aucune fin : début + 6 h, heure de Dakar.

La vente, le scan, le catalogue et la tâche `events-finish` la suivaient déjà. Les fonctions de la finition 1 calculaient autre chose : « jour de fin, sinon jour du début, à 23:59 ». Pour un événement à 22:00 sans fin, l'onglet Équipe et « Mes soirées » le disaient passé à 23:59, au lieu de 04:00 le lendemain. Pour un événement à 10:00, il restait en cours jusqu'à 23:59 au lieu de 16:00.

- **Base** (migration `20261116000002`) : `partner_team_view` et `controller_evenings` recopiées avec `event_end_at`. Ce changement règle « passé » dans l'onglet Équipe, les chiffres des soirées passées et « Mes soirées ». Elles rendent aussi `end_at`.
- **Écrans** : `retainedEnd` (`lib/events/event-end.ts`) donne la même fin, prête à afficher :
  - le formulaire montre « Fin retenue : … » et son aide quand aucune heure de fin n'est saisie ;
  - la fiche admin montre la fin calculée et son explication, plus jamais « Non précisée (fin de journée) » ;
  - le nouvel onglet **« Infos »** du pilotage montre dates, fin retenue, lieu et informations pratiques. L'onglet « Entrées » garde son nom.
- **Commentaires** de `events-finish` et du catalogue : « fin saisie ; date de fin sans heure : ce jour à 23:59 ; sinon début + 6 h ».

Test `f2a-fin-retenue`, pour un début à 22:00 sans fin et un début à 10:00 sans fin : mêmes heures en base, au catalogue, dans l'équipe (événement et affectation, « passé »), dans « Mes soirées » et dans la fiche admin. 04:00 le lendemain et 16:00 le jour même.

### 3.2 Carte de l'étape Accès

- **Repère** : aucun tant que rien n'est choisi (l'ancienne carte posait un repère sur Dakar). La carte se place sur le **centre fixe de la ville choisie** (26 villes de la liste), sinon sur le pays entier. « Position choisie » remplace « Position enregistrée », suivi du nom du lieu quand il vient de la recherche.
- **Téléphone** : un doigt fait défiler la page, car le glisser de la carte est désactivé au toucher. Deux doigts déplacent et zooment la carte. « Déplacer la carte » rend le glisser à un doigt, « Terminer » le rend à la page. Toucher la carte place le repère, sans glisser. Boutons de zoom de 44 px.
- **Recherche de lieu** : champ « Rechercher un lieu » et bouton « Rechercher » ; aucune recherche à la frappe, Entrée lance la recherche sans envoyer le formulaire. 5 lieux au plus, au Sénégal. Toucher un lieu place le repère. Mention « Lieux : © contributeurs OpenStreetMap ». Service injoignable : « Recherche indisponible pour le moment : touchez la carte pour placer le repère. »
- **Route serveur** `GET /api/partner/places/search` :
  - session d'organisateur ;
  - quota par compte (`PLACE_SEARCHES_PER_ACCOUNT_HOUR`, 60 par défaut, compté à chaque recherche) ;
  - réponses gardées 30 jours (`place_search_cache`) ;
  - **une requête par seconde au plus** vers le service, toutes instances confondues : créneau réservé en base par `place_search_slot`, espacement de 1,1 s ;
  - `countrycodes=sn`, `limit=5`, `accept-language=fr`, puis filtre sur les bornes du pays ;
  - application identifiée par `User-Agent: EventVillage/1.0 (+<adresse du site>; <NOMINATIM_CONTACT>)` ;
  - adresse du service réglable (`NOMINATIM_URL`, instance publique d'OpenStreetMap par défaut).

  En CI, aucun appel réel : `.env.test` et `.env.e2e` pointent vers une adresse injoignable, et la suite `f2a-carte` monte son propre service simulé.
- **Position, serveur et base :**
  - latitude et longitude **ensemble ou aucune**, et dans une modification elles voyagent ensemble ;
  - **bornes du Sénégal** : latitude 12,2 à 16,8, longitude −17,6 à −11,3 ;
  - position **obligatoire pour soumettre**, pas pour un brouillon ;
  - après validation, le repère se déplace mais **ne se retire plus** ;
  - un événement ancien sans repère reste modifiable tant que la modification ne touche pas la position.

  Le schéma partagé et la base appliquent les mêmes codes et les mêmes textes : `POSITION_INCOMPLETE`, `POSITION_OUT_OF_BOUNDS`, `POSITION_REQUIRED`. À la soumission, le manque est listé avec les autres ; le code est `POSITION_REQUIRED` quand c'est le seul.
- **Repère déplacé après validation** (VALIDE, PUBLIE, SUSPENDU) :
  - **plus de 200 m** : changement de lieu (champ `position`). Mêmes avis aux détenteurs (cloche, push, SMS et email regroupés à 10 minutes, tout de suite si le début est à moins d'une heure). Le SMS dit « … change de lieu : {lieu}. Vos billets restent valables. » L'administration reçoit son alerte « lieu », comme pour un nom de lieu changé ;
  - **moins de 200 m** : personne n'est prévenu.

  Distance par la formule de haversine (`geo_distance_m`).
- **Fiche admin et onglet Infos** : petite carte du lieu (chargée à la demande) et « Voir l’itinéraire » (itinéraire Google Maps, comme la page publique).

**Politique d'usage de Nominatim** (« Nominatim Usage Policy (aka Geocoding Policy) », https://operations.osmfoundation.org/policies/nominatim/, aucune date de mise à jour affichée). Citations exactes et leur traduction dans l'application :

| Exigence (citée) | Ce que fait l'application |
|---|---|
| « No heavy uses (an absolute maximum of 1 request per second). » | Créneau réservé en base avant chaque appel, espacé de 1,1 s, toutes instances confondues ; au-delà de 4 s d'attente, « Recherche indisponible… » |
| « Provide a valid HTTP Referer or User-Agent identifying the application » | `User-Agent: EventVillage/1.0 (+<site>; <contact>)` |
| « Clearly display attribution as suitable for your medium. » | « Lieux : © contributeurs OpenStreetMap » sous la recherche ; mention des tuiles sur la carte |
| « Results must be cached on your side. » | Réponses gardées 30 jours ; une recherche déjà faite ne rappelle pas le service |
| « This is not yet supported by Nominatim and you must not implement such a service on the client side using the API. » (saisie semi-automatique) | Aucune recherche à la frappe : un appel par appui sur « Rechercher » |
| « As a general rule, bulk geocoding of larger amounts of data is not encouraged. » | Aucun traitement en masse ; quota par compte |
| « Data is provided under the ODbL license which requires to share alike » | Résultats affichés avec la mention ; les données ne sont pas redistribuées |

### 3.3 Affiche dans le formulaire

- Aide : « Format conseillé : paysage, 1 600 × 1 000 pixels (proportion des cartes du site), recadré au centre. JPEG, PNG ou WebP, 5 Mo au plus. Obligatoire pour soumettre l’événement à la validation. »
- L'aperçu montre l'image dans le cadre des cartes du site (16:10, recadré au centre), avec « Aperçu sur les cartes du site ».

## 4. Textes exacts nouveaux

### 4.1 Fiche SUSPENDU

- « Votre compte organisateur est suspendu : vos événements ne sont plus modifiables. Contactez le support. », suivi du contact :
  - « Support : WhatsApp 77 123 45 67, téléphone 77 …, adresse. Aide : https://…/aide », avec les moyens réglés par le SUPERADMIN ;
  - ou, réglages illisibles : « Aide et contact : https://…/aide ».

### 4.2 Affiche

- « Format conseillé : paysage, 1 600 × 1 000 pixels (proportion des cartes du site), recadré au centre. JPEG, PNG ou WebP, 5 Mo au plus. Obligatoire pour soumettre l’événement à la validation. »
- « Aperçu sur les cartes du site »
- « L’affiche n’a pas été trouvée : déposez-la de nouveau. »
- « Image illisible : choisissez une autre image JPEG, PNG ou WebP. »

### 4.3 Fin retenue

- « Fin retenue : {jour} à {heure} », par exemple « Fin retenue : sam. 15 nov. 2026 à 04:00 »
- « La vente s’arrête à cette heure. Indiquez l’heure de fin si votre événement dure plus longtemps. »
- Fiche admin et onglet Infos, sous la fin :
  - « Aucune fin saisie : 6 heures après le début. »
  - « Aucune heure de fin saisie : fin du jour indiqué, à 23:59. »
- Onglet « Infos » :
  - titres « Dates et horaires » (« Heure de Dakar. ») et « Lieu » ;
  - libellés « Début », « Fin », « Lieu ».

### 4.4 Carte et recherche de lieu

- « Position sur la carte » ; « Obligatoire pour soumettre l’événement à la validation. »
- « Rechercher un lieu » (exemple dans le champ : « Par exemple : Grand Théâtre, Dakar ») ; bouton « Rechercher »
- « Lieux : © contributeurs OpenStreetMap »
- « Recherche indisponible pour le moment : touchez la carte pour placer le repère. »
- « Aucun lieu trouvé : essayez un autre nom ou le quartier, ou touchez la carte pour placer le repère. »
- « Saisissez au moins 3 caractères, par exemple le nom de la salle ou du quartier. »
- « Trop de recherches en une heure : touchez la carte pour placer le repère. »
- Réponses de la route que l'écran ne montre pas en usage normal (il contrôle avant d'appeler, et le champ s'arrête à 120 caractères) : « Saisissez au moins 3 caractères pour rechercher un lieu. » ; « Recherche trop longue : 120 caractères au plus. »
- Aide sur téléphone : « Touchez la carte pour placer le repère à l’entrée du lieu. Un doigt fait défiler la page ; deux doigts, ou « Déplacer la carte », déplacent la carte. »
- Aide sur ordinateur : « Cliquez sur la carte ou déplacez le repère pour indiquer l’entrée du lieu. Vous pouvez aussi saisir les coordonnées. »
- « Déplacer la carte » / « Terminer »
- « Position choisie » ou « Position choisie : {lieu trouvé} »
- « La position du lieu est incomplète : touchez la carte pour placer le repère. »
- « Le repère doit être placé au Sénégal : touchez la carte à l’emplacement du lieu. »
- À la soumission : « L’événement est incomplet : Placez le repère du lieu sur la carte (étape Accès). »
- « Le repère du lieu ne peut plus être retiré après la validation : déplacez-le si le lieu change. »
- Exemples des champs Latitude et Longitude : « Par exemple : 14.6937 », « Par exemple : -17.4441 » (avant : « 14.6937 » et « -17.4441 », qui, dans des champs désormais vides au départ, ressemblaient à une position déjà choisie)
- « Coordonnées illisibles : saisissez deux nombres, par exemple 14.6937 et -17.4441. »
- « Coordonnées hors du Sénégal : latitude entre 12,2 et 16,8, longitude entre -17,6 et -11,3. »
- « Votre position est hors du Sénégal : touchez la carte à l’emplacement du lieu. »
- Fiche admin : « Aucun repère sur la carte. »
- Onglet Infos : « Aucun repère sur la carte : placez-le depuis « Modifier », étape Accès. »
- « Voir l’itinéraire »
- Avis aux détenteurs, repère déplacé de plus de 200 m seulement :
  - cloche et push : « « {titre} » : nouvel emplacement sur la carte : {lieu}. Vos billets restent valables. » ;
  - SMS : « {titre} change de lieu : {lieu}. Vos billets restent valables. {lien} ».

## 5. Migrations à appliquer sur event-village-dev

| Ordre | Migration | Ce qu'elle fait |
|---|---|---|
| 1 | `20261116000001_f2a_fiche_suspendue.sql` | 1a :<br>• `partner_owner_suspended`, `partner_actor_suspended` ;<br>• déclencheur `trg_events_suspended_owner_delete` ;<br>• fonction `event_regisseur_pin_store` ;<br>• recopies avec le contrôle de la fiche : `ticket_category_guard`, `event_create`, `event_update`, `event_transition`, `event_cancel`, `ticket_invitation_create`, `ticket_invitation_cancel`, `ticket_invitation_guest_name_set`, `event_cash_refund_mark`, `ticket_refund_request`. |
| 2 | `20261116000002_f2a_fin_retenue.sql` | 2 : recopies de `partner_team_view` et `controller_evenings` avec `event_end_at` (et `end_at` rendu). |
| 3 | `20261116000003_f2a_carte.sql` | 3 :<br>• `geo_distance_m`, `event_position_refusal` ;<br>• recopies de `event_create`, `event_update` et `event_transition` (versions de la migration 1) avec les règles de position et les 200 m ;<br>• recopie de `notif_events_admin_change_alert` (alerte « lieu » au-delà de 200 m) et déclencheur recréé avec latitude et longitude ;<br>• tables `place_search_cache` et `place_search_throttle`, fonction `place_search_slot`. |

Toutes sont sans BEGIN ni COMMIT et rejouables. C'est prouvé en CI par `migration-finition2a-rejouable`, qui rejoue chacune deux fois dans une transaction annulée. Les migrations jusqu'à `20261115…` sont inchangées : `migrations-gelees` a reçu les empreintes des lots 9 quinquies et finition 1. Aucune ne modifie de donnée existante. Les fonctions et les deux tables nouvelles sont réservées au service_role : RLS sans politique, aucun droit pour anon et authenticated.

**Déployer l'application de la branche juste après, dans la même fenêtre.** Entre les deux, l'ancienne application fonctionne. Trois différences seulement :
- une partenaire suspendue est refusée par la base, avec le texte de la base (sans le contact). Seule exception : l'ancienne route du PIN régisseur l'écrit directement dans la table, sans fonction. Une partenaire suspendue peut donc encore changer son PIN pendant ces minutes ;
- une soumission sans repère est refusée, et l'ancien écran affiche le message général de la liste des manques ;
- une position hors du Sénégal est refusée.

### 5.1 Avant `db push` (éditeur SQL, une requête à la fois, garder les résultats)

```sql
-- A. attendu : 20261115000014, et aucune 20261116…
select max(version) from supabase_migrations.schema_migrations;

-- B. événements sans repère, par statut (garder les nombres). Un BROUILLON sans repère devra en recevoir un pour être
--    soumis ; un événement EN_ATTENTE, VALIDE ou PUBLIE sans repère reste modifiable et publiable.
select status::text, count(*) filter (where latitude is null or longitude is null) as sans_repere, count(*) as total
  from public.events group by 1 order by 1;

-- C. positions incomplètes ou hors du Sénégal (garder la liste) : attendu 0 ligne. S'il y en a : rien ne bloque ; ces
--    événements restent modifiables tant que la modification ne touche pas la position ; corriger le repère ensuite.
select id, title, status::text, latitude, longitude from public.events
 where (latitude is null) <> (longitude is null)
    or (latitude is not null and (latitude not between 12.2 and 16.8 or longitude not between -17.6 and -11.3));

-- D. fiches SUSPENDU et leurs événements en cours (garder la liste) : en lecture seule pour elles dès le déploiement.
select pa.id, pa.company_name,
       count(e.id) filter (where e.status::text in ('BROUILLON', 'EN_ATTENTE', 'VALIDE', 'PUBLIE')) as evenements_en_cours
  from public.partners pa left join public.events e on e.partner_id = pa.id
 where pa.status::text = 'SUSPENDU' group by 1, 2 order by 2;

-- E. affiches que le premier passage de events-finish effacera après le déploiement (garder la liste ; 200 au plus par
--    passage, un passage toutes les 15 min) : fichiers du dossier events de plus de 7 jours qu'aucun événement ne cite.
select o.name, o.created_at
  from storage.objects o
 where o.bucket_id = 'public-images' and o.name like 'events/%/%' and o.created_at < now() - interval '7 days'
   and not exists (
        select 1 from public.events e
         where split_part(split_part(e.image_url, '/storage/v1/object/public/public-images/', 2), '?', 1) = o.name
            or exists (select 1 from unnest(e.gallery_urls) g
                        where split_part(split_part(g, '/storage/v1/object/public/public-images/', 2), '?', 1) = o.name))
 order by o.created_at;

-- F. événements sans fin saisie (garder le nombre) : leur fin, dans l'onglet Équipe et « Mes soirées », passe de
--    « jour du début à 23:59 » à « début + 6 h », la règle de la vente et du scan.
select count(*) from public.events where end_date is null;

-- G. attendu : 0 ligne (tables nouvelles absentes)
select table_name from information_schema.tables
 where table_schema = 'public' and table_name in ('place_search_cache', 'place_search_throttle');
```

E est un contrôle de lecture. La purge compare les chemins décodés (`%20` devient une espace). Un nom de fichier encodé dans une adresse peut donc sortir dans E sans être effacé. Le contraire est impossible : la purge ne voit pas plus d'orphelines que E.

### 5.2 Appliquer

```powershell
cd C:\Users\DELL\Documents\event-village
git switch main                    # après fusion de finition-2a/fin-carte-affiche
npx supabase migration list        # les trois 20261116… en attente, rien d'autre
npx supabase db push --dry-run     # exactement 20261116000001, 000002, 000003, dans l'ordre
npx supabase db push
```

### 5.3 Après (éditeur SQL)

```sql
-- A. attendu : 20261116000003
select max(version) from supabase_migrations.schema_migrations;

-- B. fonctions nouvelles : attendu 6 lignes, anon = false, authenticated = false, service_role = true
select p.proname, has_function_privilege('anon', p.oid, 'EXECUTE') as anon,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated,
       has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('partner_owner_suspended', 'partner_actor_suspended', 'event_regisseur_pin_store',
                     'geo_distance_m', 'event_position_refusal', 'place_search_slot')
 order by 1;

-- C. tables de la recherche : attendu 2 lignes, rls = true, anon = false, authenticated = false ; une ligne de cadence
select c.relname, c.relrowsecurity as rls,
       has_table_privilege('anon', c.oid, 'SELECT') as anon, has_table_privilege('authenticated', c.oid, 'SELECT') as authenticated
  from pg_class c where c.relnamespace = 'public'::regnamespace and c.relname in ('place_search_cache', 'place_search_throttle');
select count(*) from public.place_search_throttle;   -- attendu : 1

-- D. déclencheurs : attendu 2 lignes ; celui de l'alerte cite latitude et longitude
select tgname, pg_get_triggerdef(oid) from pg_trigger
 where tgname in ('trg_events_admin_change_alert', 'trg_events_suspended_owner_delete')
 order by 1;

-- E. fin retenue : attendu true, true
select bool_and(prosrc like '%public.event_end_at(e.id) AS end_at%') from pg_proc
 where proname in ('partner_team_view', 'controller_evenings');
select bool_and(prosrc not like '%COALESCE(e.end_date, e.start_date) + COALESCE(e.end_time, time ''23:59'')%') from pg_proc
 where proname in ('partner_team_view', 'controller_evenings');

-- F. règles de position (sans écriture) : attendu POSITION_OUT_OF_BOUNDS, POSITION_INCOMPLETE, null ; distance ≈ 100
select public.event_position_refusal(48.85, 2.35)->>'code',
       public.event_position_refusal(14.7, null)->>'code',
       public.event_position_refusal(14.6928, -17.4467)->>'code',
       round(public.geo_distance_m(14.6928, -17.4467, 14.6937, -17.4467)::numeric);

-- G. nombres de B avant : inchangés (aucune donnée modifiée)
select status::text, count(*) filter (where latitude is null or longitude is null) as sans_repere, count(*) as total
  from public.events group by 1 order by 1;
```

Puis `03-verification.sql`, comme aux lots précédents.

## 6. Runs

| Run | Commit | Rôle | Résultat |
|---|---|---|---|
| 220 | `42cd983d` | « avant » : code de `main` et captures « avant » (étape Accès, onglet Infos) | verify vert en 2 462 s. Le parcours e2e était en cours, acte 5 de la recette passé, quand le job s'est arrêté à la limite de 75 min (75 min 32 s). Les captures « avant » du § 7 sont faites |
| 221 | `f96da9e5` | preuve des rouges, première version | annulé par l'envoi de la suivante. Les tests appelaient la modification sans la version lue de l'événement (`expected_updated_at`) et auraient été rouges pour cette seule raison |
| 222 | `d5eb6b3b` | preuve des rouges (tests seuls sur le code de `main`) | exactement les 5 suites f2a rouges, les 417 autres vertes. Les rouges sont les bons pour `f2a-affiche` (photo stockée telle quelle : `jpeg 3200×2000 exif=true`), `f2a-fin-retenue`, `f2a-carte` et `f2a-ecrans`. **Pas pour `f2a-fiche-suspendue`**, arrêtée au montage (« À lire en premier », point 3) : preuve refaite |
| 223 | `103e9b76` | preuve complétée : alerte de l'administration (200 m), mention « © » acceptée en entité HTML | annulé par l'envoi suivant |
| 224 | `fe6cb2cb` | preuve des rouges, montage de `f2a-fiche-suspendue` corrigé et catégorie de `f2a-carte` | Exactement les 5 suites f2a rouges, les 417 autres vertes, invariants à 0, parcours e2e vert. Rouges pour les bonnes raisons :<br>• affiche stockée telle quelle ; affiche absente acceptée (200) ; ancienne affiche et orpheline de 8 jours gardées ;<br>• fin absente de l'onglet Équipe ;<br>• route de recherche absente ; position partielle acceptée (200) ; soumission sans repère acceptée ; repère déplacé de plus de 200 m : 0 détenteur prévenu sur 2, aucune alerte de l'administration ;<br>• textes et fichiers des écrans absents ;<br>• base : `event_update` accepte de changer le titre d'un événement publié pour la partenaire suspendue.<br>Exception : la partie route de `f2a-fiche-suspendue` s'arrête sur la création, déjà refusée sur `main` avec un autre code (`PARTNER_NOT_VALIDATED`). Essai « modification valide » ajouté, preuve refaite |
| 225 | `52321629` | premier « après » | annulé après un quart d'heure par l'envoi des deux captures « après » ajoutées (formulaire vide : ni fin retenue ni carte visibles) |
| 226 | `3bc06641` | « après » | verify : 419 suites sur 423. Les suites f2a sont vertes. 4 suites existantes sont rouges, pour 3 causes corrigées ensuite (« À lire en premier », point 3), dont la suite d'audit `cvf1-4-proprietaire`. Parcours e2e arrêté par mon envoi suivant, après 446 captures sans échec : une erreur de calendrier de ma part, le run approchait de sa fin. Les captures « après » relues au § 7 viennent de ce run. Budget JavaScript respecté |
| 227 | `cff4c68a` | preuve des rouges avec l'essai « modification valide » | annulé par l'envoi suivant (déclencheur du PIN retiré, test adapté) |
| 228, 230 | `115e3801`, `68240260` | « après » | annulés par les envois suivants : corrections du run 226, puis exemples des coordonnées. 228 n'a pas été publié |
| 229 | `c3359807` | preuve des rouges finale (mêmes fichiers de test que la branche livrée pour les suites f2a) | Exactement les 5 suites f2a rouges, les 417 autres vertes, invariants à 0, parcours e2e vert. 4 suites rouges pour les mêmes raisons qu'au run 224. `f2a-fiche-suspendue` : sur `main`, la route accepte « Modifier » puis « Enregistrer » (HTTP 200, titre d'un événement publié changé) et la base accepte `event_update`. La faille est donc prouvée aux deux niveaux |
| 231 | `94a195dd` | **« après » final** | **Vert.** verify : 423 suites sur 423 en 2 615 s, dont `tests/audit/` et `tests/audit-auth/` (26 suites), les 5 suites f2a, le rejeu des migrations et les 4 suites rouges au run 226. Invariants à 0. Parcours e2e vert : 500 captures, fumée, recette ; les 55 captures sautées sont les mêmes qu'au run 219 sur `main`. Budget JavaScript identique au run 226. Job : 81 min |

**Budget JavaScript (mesure de la CI, runs 226 et 231, identiques, contre `main` au run 219).** Budgets non relevés.

| Page | `main` | Branche | Budget |
|---|---|---|---|
| Accueil `/` | 226 271 | 226 271 | 226 342 |
| Page publique d'un événement | 232 573 | 232 897 (+324) | 233 316 |
| Billets | 249 662 | 249 662 | 250 417 |
| Scanner | 233 757 | 233 757 | 234 911 |
| Billet hors ligne | 221 822 | 221 822 | 224 268 |

Octets compressés (gzip). En local, l'accueil semblait dépasser son budget de 146 octets. Le build local de `main` donne exactement le même nombre (226 488) : c'est un effet de l'environnement local, la CI le confirme.

**Durée maximale du job : 90 min au lieu de 75.**
- Runs 217 à 219 : 63 à 73 min.
- Le run 220 a dépassé la limite alors que verify était vert et que le parcours e2e avançait normalement.
- La finition ajoute environ 2 min de tests.

Aucun contrôle n'est allégé : la limite ne sert qu'à arrêter un job bloqué. Même pratique qu'aux lots 7 et 8, déjà justifiée dans leurs rapports. Commit `ci(f2a)`.

## 7. Captures avant et après

Dossier `runs/<run>/captures/` de la branche `ci-results`. Chaque écran existe en 390 px (`mobile`) et 1 440 px (`ordinateur`), en clair et en sombre.

| Écran | Capture | Avant (run 220) | Après (run 226) |
|---|---|---|---|
| Formulaire, haut de l'étape Informations | `partenaire-creation` | titre, catégorie, description | inchangé. Le format conseillé de l'affiche et la fin retenue sont plus bas : voir `partenaire-creation-fin-retenue` |
| Formulaire, étape Accès | `partenaire-creation-acces` | repère posé d'office sur Dakar, aucune recherche | « Position sur la carte », « Obligatoire pour soumettre… », « Rechercher un lieu » et « Rechercher », mention OpenStreetMap, aide au doigt (téléphone) ou à la souris (ordinateur) |
| Fiche admin | `admin-fiche-en-attente` | « Dates et lieu » en texte, sans carte ni « Voir l’itinéraire ». L'événement capturé a une fin saisie, donc « Non précisée (fin de journée) » ne s'y voit pas ; on l'aurait lu pour un événement sans fin | fin affichée ; petite carte avec le repère et le nom du lieu ; « Voir l’itinéraire » |
| Pilotage, onglet Infos | `pilotage-infos` | l'onglet n'existait pas : la page s'ouvrait sur l'Aperçu | onglet « Infos » entre « Aperçu » et « Ventes » : « Dates et horaires » (« Heure de Dakar. »), début et fin, puis « Lieu » avec la petite carte |
| Étape Accès, recherche et carte (après seulement) | `partenaire-creation-carte` | — | recherche, « Ma position », carte sans repère, « Déplacer la carte » sur téléphone, boutons de zoom de 44 px, champs Latitude et Longitude vides |
| Étape Informations, début à 22:00 sans fin (après seulement) | `partenaire-creation-fin-retenue` | — | « Fin retenue : ven. 27 nov. 2026 à 04:00 » et son aide sous les dates ; format conseillé de l'affiche (visible sur ordinateur) |

J'ai relu les 24 captures (6 écrans, 390 et 1 440 px, clair et sombre). Rien de cassé ni de coupé, les couleurs du système de design en clair comme en sombre. Une seule correction : les exemples des champs Latitude et Longitude (§ 4.4). Je l'ai vérifiée sur les captures du run final 231 : « Par exemple : 14.6937 » et « Par exemple : -17.4441 », en 390 et 1 440 px, clair et sombre.

Trois choses qui ne viennent pas de la finition :
- les cartes ont un fond gris, avant comme après : la CI ne charge pas les tuiles d'OpenStreetMap ;
- « mm/dd/yyyy » dans les champs de date vides : c'est le navigateur de la CI, réglé en anglais. Un téléphone en français affiche « jj/mm/aaaa » ;
- « Leaflet | © contributeurs OpenStreetMap » au pied des cartes : mention choisie au lot 8, la même que sur la page publique (§ 11).

## 8. Tests

### 8.1 Tests nouveaux

| Suite | Ce qu'elle prouve |
|---|---|
| `tests/parcours/f2a-fiche-suspendue.test.ts` | 1a, § 1.1 |
| `tests/parcours/f2a-affiche.test.ts` | 1b, § 1.2 |
| `tests/parcours/f2a-fin-retenue.test.ts` | 2, § 3.1 |
| `tests/parcours/f2a-carte.test.ts` | 3, recherche (service simulé), position (route et base), 200 m (détenteurs et administration) |
| `tests/schema/f2a-ecrans.test.ts` | Textes et comportements visibles : carte sans repère par défaut, « Position choisie », défilement au doigt, villes, recherche, fin retenue, format conseillé, petite carte et « Voir l’itinéraire » |
| `tests/schema/migration-finition2a-rejouable.test.ts` | Les trois migrations rejouées deux fois, sans BEGIN ni COMMIT |

### 8.2 Tests existants modifiés (et pourquoi)

| Fichier | Modification | Pourquoi |
|---|---|---|
| `tests/schema/migrations-gelees.test.ts` | Empreintes des 14 migrations `20261112…` et des 14 `20261115…` ajoutées | Les migrations de ces lots sont désormais gelées |
| `tests/parcours/cycle-helpers.ts` | `storedPosterUrl` (affiche réellement déposée) ; `TEST_EVENT_POSITION` (Dakar), position par défaut des brouillons (`position: null` pour s'en passer) ; la soumission par `advanceEventTo` pose cette position sur un événement qui n'en a pas | 1b : une adresse factice est refusée (`IMAGE_NOT_FOUND`). 3 : la soumission exige une position. Les événements de test des autres lots sont insérés sans position puis soumis par cette aide |
| `tests/parcours/edition-formulaire.test.ts`, `edition-services.test.ts`, `messages-changement-9bis.test.ts` | Affiche réellement déposée (`storedPosterUrl`) au lieu d'une adresse factice | 1b : le serveur vérifie que le fichier existe. Aucune assertion changée |
| `tests/parcours/edition-validation.test.ts` | Test des coordonnées : la règle « latitude −90 à 90, longitude −180 à 180 » est remplacée par les bornes du Sénégal et la paire complète. La création acceptée par la route dépose une vraie affiche (`storedPosterUrl`) | La règle demandée par la finition. L'ancien test acceptait (−90, 180), hors du Sénégal. Depuis 1b, le serveur vérifie que l'affiche existe |
| `tests/parcours/edition-formulaire.test.ts`, test « champs libres d'un PUBLIÉ » | Repère déplacé de 100 m au lieu de 3,5 km, après contrôle du repère de départ (run 226) | 3 : au-delà de 200 m, c'est un changement de lieu et les détenteurs sont prévenus (règle demandée, testée par `f2a-carte`). Le test garde son sens : un champ libre ne prévient personne |
| `tests/parcours/lot9quater-technique.test.ts` | Image d'essai : un vrai PNG produit par sharp (run 226) | 1b : le serveur décode et réencode chaque dépôt. L'ancienne suite d'octets n'était pas un PNG valide et reçoit désormais « Image illisible » (400). Aucune assertion changée |
| `tests/parcours/lot9quinquies-ecrans.test.ts` | Contrôle « contactez le support toujours suivi du lien d'aide » : `supportSentenceOrHelp` reconnu comme `contactSupport` | Il finit toujours par le lien `/aide`. La fiche suspendue l'ajoute après le texte imposé « … Contactez le support. ». Aucune autre règle du contrôle changée |
| `tests/helpers/design-files.ts` | `components/partner/pilotage/InfosTab.tsx` ajouté à la liste | Tout `.tsx` nouveau doit suivre les règles du système de design, et elles passent |
| `e2e/support/screens.ts` | Captures `partenaire-creation-acces` et `pilotage-infos` (avant et après), `partenaire-creation-carte` et `partenaire-creation-fin-retenue` (après) | Captures demandées. Le formulaire vide ne montre ni la fin retenue ni la carte sous la recherche |
| `e2e/fumee.spec.ts`, `e2e/recette.spec.ts` | Le repère est placé en touchant la carte à l'étape Accès, puis « Position choisie » est vérifié | 3 : la soumission exige une position. Aucune autre étape changée |
| `e2e/support/service.ts` | Position du lieu (Dakar par défaut) dans l'événement créé par `event_create` | Même raison |
| `scripts/dev/seed-dev.core.ts` | Position du lieu | Même raison : `essai-seed-dev` soumet ses événements |
| `docs/recette-billetterie.md`, `docs/parcours-evenement-complet.md` | Citations « fichier:ligne » recalées sur les fichiers de test modifiés | `recette-matrice` vérifie que chaque ligne citée ouvre un test |

Les suites de la finition elle-même ont aussi bougé après leur première écriture :
- appels de modification avec la version lue de l'événement, avant le run 221 ;
- test de l'alerte de l'administration ajouté après le run 222, et la mention « © » acceptée écrite `&copy;` (règle « emoji » du système de design) ;
- montage de `f2a-fiche-suspendue` corrigé : billet d'invitation lu par `sale_channel`, catégorie « Entrée libre », témoin admin par une transition puisque `event_update` refuse tout admin ;
- catégorie « Entrée libre » dans `f2a-carte` ;
- après le run 224, un essai ajouté à `f2a-fiche-suspendue` : « Modifier » puis « Enregistrer » avec une modification valide. Le test des routes envoie un corps générique à chacune : il prouvait le refus en tête, pas qu'une écriture valide passait par la route sur `main` ;
- après le run 226, `f2a-fiche-suspendue` ne vérifie plus qu'une écriture directe du PIN est refusée, puisque le déclencheur est retiré (§ 1.1). Il vérifie à la place que `event_regisseur_pin_store` refuse la partenaire suspendue, et que l'application n'écrit jamais le PIN directement (contrôle statique, rouge sur `main`).

En dehors du remplacement du dernier point, aucune assertion de règle n'a changé ni n'a été affaiblie. Tout est passé par une nouvelle preuve des rouges (§ 6, run 229).

## 9. Essais pour un non-développeur

1. **Fiche suspendue.**
   - En admin, suspendre la fiche d'une organisatrice.
   - Se connecter avec son compte, ouvrir un événement, « Modifier », changer le titre, « Enregistrer ». Message attendu : « Votre compte organisateur est suspendu : vos événements ne sont plus modifiables. Contactez le support. » suivi du contact.
   - Même message pour : ajouter une catégorie, inviter, générer le code PIN, annuler l'événement, soumettre un brouillon. Rien ne change.
   - Le pilotage, les ventes et l'export restent lisibles.
   - Un contrôleur de cet événement scanne un billet : accepté.
   - Réactiver la fiche : tout redevient modifiable.
2. **Affiche sans position GPS.**
   - Prendre une photo avec un téléphone dont la localisation est activée, puis la déposer comme affiche.
   - Ouvrir l'affiche depuis la page publique, l'enregistrer, regarder ses propriétés (Windows : clic droit, Propriétés, Détails). Attendu : aucune position, aucun modèle d'appareil ; format WebP, 1 600 pixels au plus.
3. **Affiche remplacée.**
   - Noter l'adresse de l'affiche d'un brouillon, en déposer une autre et enregistrer.
   - L'ancienne adresse ne s'ouvre plus.
4. **Fin retenue.**
   - Créer un brouillon commençant à 22:00, sans heure de fin. Sous les dates : « Fin retenue : {le lendemain} à 04:00 » et l'aide.
   - À 10:00 : « … à 16:00 ».
   - La fiche admin et l'onglet « Infos » montrent la même fin, avec « Aucune fin saisie : 6 heures après le début. »
5. **Carte, téléphone.**
   - À l'étape Accès, ville Dakar : la carte est sur Dakar, sans repère.
   - Faire glisser un doigt sur la carte : la page défile.
   - Deux doigts : la carte bouge.
   - « Déplacer la carte » : un doigt déplace la carte. « Terminer ».
   - Toucher la carte : repère et « Position choisie ».
6. **Recherche.**
   - Saisir « Grand Théâtre », appuyer sur « Rechercher » : 5 lieux au plus, au Sénégal, avec « Lieux : © contributeurs OpenStreetMap ».
   - Toucher un lieu : repère et « Position choisie : {lieu} ».
7. **Position obligatoire pour soumettre.**
   - Enregistrer un brouillon sans repère : accepté.
   - Le soumettre depuis la liste : « L’événement est incomplet : Placez le repère du lieu sur la carte (étape Accès). »
   - Placer le repère, soumettre : accepté.
8. **Repère déplacé.** Sur un événement publié avec des billets :
   - déplacer le repère de quelques dizaines de mètres : aucun SMS ;
   - le déplacer de plusieurs rues (plus de 200 m) : 10 minutes après, les détenteurs reçoivent « … change de lieu : … » et l'administration une alerte « lieu ».
9. **Fiche admin et onglet Infos.** Petite carte avec le repère. « Voir l’itinéraire » ouvre l'itinéraire dans Google Maps.

## 10. À faire de ton côté

1. Lire « À lire en premier » et décider de la fusion. Je ne fusionne pas.
2. Après fusion, appliquer les trois migrations sur event-village-dev (§ 5), avec les contrôles avant et après. Je peux le faire sur ta demande, comme pour la finition 1.
3. **Vercel :**
   - `NOMINATIM_CONTACT` : une adresse de contact joignable d'Event Village. La politique de Nominatim demande d'identifier l'application ; le contact est recommandé.
   - Facultatif : `NOMINATIM_URL` pour un autre service, et `PLACE_SEARCHES_PER_ACCOUNT_HOUR` (60 par défaut).
4. **Avant le déploiement**, relire la liste du contrôle E du § 5.1 : le premier passage de `events-finish` effacera ces fichiers.
5. Prévenir les organisatrices que le repère du lieu est désormais demandé pour soumettre un événement.
6. Relire les captures « après » (§ 7).
7. Trancher deux points du § 11 :
   - les remboursements en espèces d'une fiche suspendue : garder le blocage ou rouvrir cette seule action ;
   - la mention « Leaflet » au pied des cartes : la garder ou la retirer.

## 11. Points ouverts et décisions prises

- **Remboursements en espèces d'une fiche suspendue.** `event_cash_refund_mark` est bloqué pour elle, comme toute écriture demandée. Or seule l'organisatrice marque « Remboursé » : tant que sa fiche est suspendue, les remboursements en espèces d'un événement annulé ne peuvent pas être notés. À trancher : garder ce blocage ou rouvrir cette seule action.
- **Bornes rectangulaires.** Le rectangle demandé (12,2–16,8 ; −17,6 à −11,3) contient la Gambie : un repère placé en Gambie est accepté.
- **Code de la soumission.** `POSITION_REQUIRED` quand la position est le seul manque, sinon `SUBMIT_INCOMPLETE` avec la position dans la liste. Le texte liste tous les manques dans les deux cas.
- **Événements validés avant la finition sans repère :** modifiables et publiables ; le repère n'est exigé qu'à la soumission. Noté dans `docs/apres-lancement.md`.
- **Molette de la souris :** la carte du formulaire ne zoome plus à la molette (boutons + et −, double-clic), comme la carte publique, pour que la molette fasse défiler la page.
- **Latitude et longitude** restent saisissables au clavier : c'est l'alternative au glisser et à la recherche.
- **Alerte de l'administration au-delà de 200 m.** Ajoutée pour que « changement de lieu » vaille pour tout le monde ; testée.
- **Purge et formulaire resté ouvert plus de 7 jours.** Une affiche déposée mais jamais enregistrée est effacée au bout de 7 jours. L'organisatrice qui enregistre ensuite reçoit « L’affiche n’a pas été trouvée : déposez-la de nouveau. » Seul cas non couvert : un enregistrement qui tombe exactement entre la lecture des affiches citées et l'effacement, pendant un passage de la purge. L'événement garderait alors une adresse d'image absente. Il faudrait un formulaire ouvert depuis plus de 7 jours et un enregistrement à la même seconde que le passage : je ne l'ai pas verrouillé.
- **Mention « Leaflet » des cartes.** Le pied des cartes affiche « Leaflet | © contributeurs OpenStreetMap », choix du lot 8, sur la page publique comme sur les cartes de la finition. « Leaflet » est le nom de la bibliothèque des cartes : un mot technique pour une organisatrice. Le retirer tient en une ligne par carte (seule la mention OpenStreetMap est exigée). Je ne l'ai pas fait sans ton accord, puisque c'était une décision d'un lot précédent.
- **PIN régisseur pendant la fenêtre de déploiement.** Voir § 5 : l'ancienne route écrit le PIN directement. Une partenaire suspendue peut le changer entre la migration et le déploiement.
- **Fiche suspendue et recherche de lieu.** La recherche est une lecture : une fiche SUSPENDU peut encore l'utiliser (quota par compte), sans pouvoir enregistrer. Une fiche EN_ATTENTE ou REJETE reçoit 403 `PARTNER_NOT_VALIDATED`, et le service de recherche n'est pas appelé (`cvf2a-3` a). *Corrigé après la contre-vérification (R3) : ce paragraphe disait à tort « suspendue ou non validée ».*
