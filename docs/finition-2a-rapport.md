# Finition 2a — Fin retenue, carte, affiche (et sécurité de la fiche suspendue)

Branche `finition-2a/fin-carte-affiche`, partie de `main` à `c248e17f`, dans son propre dossier (`event-village-finition2a`). Rien n'est fusionné. Le dossier de recette n'a pas été touché.

## Correctifs de la contre-vérification (16 novembre) : à lire avant tout

Consigne « Correctifs de la contre-vérification — finition 2a » : six trous (T1 à T6) et trois remarques (R1 à R3) du rapport d'audit `docs/audit-finition-2a.md`. Ta consigne s'arrêtait à « R3. Corrige le § 11 du » ; j'ai complété R3 par la remarque correspondante du rapport d'audit (§ 3, « Rapport de la finition, § 11 »).

Ce qui a été fait, dans l'ordre :
- la branche d'audit `audit/finition-2a` est fusionnée en avance rapide (`768dc956`) ; ses suites `cvf2a-*` servent de tests rouges ;
- un commit par point, dans l'ordre de la consigne ;
- migrations `20261116000004` à `20261116000008`, sans BEGIN ni COMMIT, rejouables ; les trois premières (`…01` à `…03`) ne sont pas touchées.

Aucune assertion des suites `cvf2a-*` n'est changée. Seule exception, décidée par toi : le montage de `cvf2a-2` e (§ C.9).

### La sécurité d'abord

Les six trous sont fermés, chacun à la route et en base, avec un test rouge puis vert :

1. **T1, équipe d'une fiche SUSPENDU.** L'équipe est désormais en lecture seule pour la partenaire.
   - **Routes.** `/api/partner/team/*` et `/api/partner/shifts/*` comptent parmi les écritures refusées : 403 `PARTNER_SUSPENDED`, avec le texte et le contact du support.
   - **Base.** La fiche est contrôlée en tête de chaque fonction d'équipe : réglages, porte, point d'entrée, espèces, invitation, renvoi, annulation, effacement, retraits.
   - **Écritures directes supprimées.** Les écritures que des routes faisaient directement dans `event_controllers` passent par trois fonctions nouvelles, gardées de la même façon.
   - **Admin.** Un admin muni de `events.write` garde ses actions.
2. **T2, écart d'une caisse.** La validation d'un écart est refusée à une fiche SUSPENDU, à la route et en base. Un admin muni de `events.write` peut valider l'écart ; jusqu'ici, seule la propriétaire le pouvait.
3. **T3 et T4, changement de lieu.**
   - **Position annoncée.** L'événement garde sa dernière position annoncée : posée à la validation, mise à jour au départ de chaque SMS « change de lieu ». La règle des 200 m se mesure depuis elle, et l'alerte « lieu » de l'administration suit la même règle.
   - **Retour du repère.** Si le repère revient à moins de 200 m de la position annoncée, l'avis en attente est annulé sur tous les canaux.
   - **Cadence.** Au plus un avis de changement de lieu par heure glissante, pour le SMS comme pour le push ; les changements suivants partent ensemble à l'heure dite.
   - **Formulaire.** Le bandeau le dit avant d'enregistrer.
4. **T5, affiche.** Seul un fichier produit par la route de dépôt est accepté comme affiche (`horodatage_8 caractères.webp`), dans le formulaire, à la route et en base. Le script `scripts/reencode-posters.ts` réencode une fois les affiches d'avant la finition encore citées (§ C.4).
5. **T6, effacement d'un fichier cité.** La purge et l'effacement d'une affiche remplacée lisent toutes les colonnes de la base qui citent le stockage (dix colonnes, § C.5). Les salles, les produits et le profil (logo, couverture) refusent une adresse du dossier `events/`.

Les remarques sont aussi traitées :
- **R1.** Le caractère nul et les caractères de contrôle sont retirés de la recherche de lieu. Une recherche indisponible (503) ne compte plus dans le quota.
- **R2.** `ProductService` applique une liste blanche des champs. La partenaire est toujours celle de la session, et le statut n'est jamais pris du corps. C'était une faille réelle sur un service fermé.
- **R3.** Le § 11 de ce rapport est corrigé.

### Runs
- **Avant : 235** (`768dc956`, même commit que la tête après l'avance rapide). 425 suites sur 428 ; seules `cvf2a-1`, `cvf2a-2` et `cvf2a-4` sont rouges (T1 à T6). L'e2e est vert.
- **Preuve des rouges : 239.** Branche `finition-2a/cv-rouges` : les huit suites nouvelles sur `768dc956`, sans aucun correctif. 425 sur 436 : exactement les 11 rouges attendus, `cvf2a-1`, `-2`, `-4` et les 8 suites `f2acv-*`. Un premier essai, le run 237, était faussé par une erreur de mon test (« Erreurs », 1).
- **Après : 240** (`b2445ce1`). **Vert** :
  - 436 suites sur 436, dont les 31 de `tests/audit/` et `tests/audit-auth/` (les 26 d'avant et les 5 `cvf2a-*`) ;
  - invariants à 0 ;
  - e2e vert : 465 captures, fumée, terrain, recette ;
  - budgets JS identiques à `main`, non relevés.

### Décisions prises, à relire
1. **Trois routes de contrôle signalées par l'audit.**
   - Incidents de scan : refusés à la propriétaire d'un événement dont la fiche n'est pas VALIDE, comme le scan.
   - Clôture de sa caisse : gardée, car l'argent encaissé doit pouvoir être déclaré.
   - Activation d'un compte de contrôleur : gardée, car c'est le compte du contrôleur et non un événement.
2. **Services fermés (salles, produits, commandes, tables).** Leurs écritures restent permises à une fiche suspendue : à trancher à leur ouverture (§ C.1, et `docs/apres-lancement.md`).
3. **Admin et écart de caisse.** Un admin `events.write` valide l'écart, sans motif à saisir (l'onglet Caisse n'a pas de champ motif) ; l'action est journalisée ADMIN.
4. **Avis de lieu en un seul message.** Un changement qui touche au lieu part désormais ensemble dans l'application, en push, par SMS et par email, à la fin de la fenêtre de 10 minutes. Avant, l'application et le push partaient tout de suite. Sans cela, l'aller-retour annulé aurait laissé une notification fausse, et le push n'aurait pas eu la cadence. Les changements de date et de titre seuls partent comme avant.
5. **Cadence et nom du lieu.** La cadence d'une heure vaut pour tout SMS « change de lieu » : nom du lieu, ville, adresse ou repère. Si elle ne valait que pour le repère, changer le nom du lieu en boucle referait la rafale de T4.
6. **Cadence et début proche.** La cadence l'emporte même à moins d'une heure du début. Un second changement de lieu dans l'heure attend la fin de l'heure (§ C.3).
7. **Réencodage par un script.** Le réencodage des affiches anciennes est un script à lancer une fois, et non une tâche planifiée : un test impose que chaque route de tâche soit planifiée par pg_cron. Le script tourne à blanc par défaut.

### Erreurs de ma part, trouvées et corrigées
1. **Ligne forgée dans un test (la plus lourde).** Mon test T6 (`f2acv-stockage-cite` b) posait à la main, pour un brouillon, une ligne de copie publique (`public_event_state`), puis la retirait en fin de test.
   - Sur le code d'avant correctif (preuve des rouges, run 237), le test échouait avant de la retirer. L'invariant x13 (« résumé public faux ») a alors fait échouer 38 suites étrangères aux correctifs.
   - Même avec le correctif, d'autres suites qui tournent en même temps pouvaient voir la ligne.
   - J'ai retiré ce cas : la lecture de cette colonne est vérifiée par l'inventaire (a), et les remises à zéro sont dans un `finally`. La preuve des rouges est refaite (run 239).
2. **Deux tests existants figeaient l'ancienne structure (run 236) :**
   - la liste exacte des migrations 20261116… du test de rejouabilité ;
   - l'inventaire de `notif-migration`, qui cherchait l'envoi E7-E8 dans `event_update` alors que je l'avais déplacé dans `event_change_notify`.

   Je ne les avais pas mis à jour avant d'envoyer. C'est corrigé (§ C.9).
3. **Mon test des avis de lieu (`f2acv-avis-de-lieu`, run 236) :**
   - le cas d lisait `changed_fields`, que la route ne rend pas ;
   - le cas c comparait les coordonnées au chiffre près ; or le repère passe par les données du message (15 chiffres significatifs) : 14.695500000000001 y devient 14.6955.

   Les deux sont corrigés sans affaiblir la règle (comparaison à 10⁻⁶ degré, une dizaine de centimètres).
4. **Typage de deux tests pour la preuve des rouges.** La vérification s'arrête à la première erreur de typage. Sur l'ancien code, le module de réencodage n'existe pas et les signatures de `ProductService` sont typées. Corrigé avant le premier run des rouges, sans changer d'assertion.
5. **Montages e2e (run 238).** Je n'avais pas vu que les montages de la fumée, du terrain et de l'acte 10 de la recette créent leurs événements par `event_create` avec l'affiche de la graine, au nom libre. La règle stricte de T5 les a refusés. Une aide dépose désormais une copie au nom de la route (§ C.9).
6. **Ancien test des commandes (run 238).** `tests/partner-orders-m9` créait un produit suspendu en passant le statut dans le corps, ce que R2 refuse désormais. Le montage passe par `setProductStatus` (§ C.9).

### C.1 T1 : chaque écriture de /api/partner/* et /api/controller/*, avec sa garde

Inventaire tiré des fichiers par `tests/parcours/f2acv-ecritures-fiche.test.ts` : 51 écritures partenaire, 11 de contrôle. Une écriture nouvelle sans décision fait échouer ce test.

| Écriture | Fiche SUSPENDU (route) | Garde en base (fiche contrôlée en tête) |
|---|---|---|
| `DELETE /api/partner/team/*` | 403 `PARTNER_SUSPENDED` | `event_controllers_remove` (nouvelle) |
| `DELETE /api/partner/team/all` | 403 `PARTNER_SUSPENDED` | `event_controllers_remove` (nouvelle) |
| `DELETE /api/partner/team/controller/*` | 403 `PARTNER_SUSPENDED` | `atomic_partner_remove_controller` (auteur ajouté) |
| `DELETE /api/partner/team/invitations/*` | 403 `PARTNER_SUSPENDED` | `controller_invitation_clear` |
| `PATCH /api/partner/team/assignments` | 403 `PARTNER_SUSPENDED` | `controller_assignments_sync` (+ `controller_invitation_create`) |
| `PATCH /api/partner/team/assignments/*` | 403 `PARTNER_SUSPENDED` | `event_controller_set_cash` |
| `PATCH /api/partner/team/entry-point` | 403 `PARTNER_SUSPENDED` | `event_controller_entry_point_set` (nouvelle) |
| `PATCH /api/partner/team/gate` | 403 `PARTNER_SUSPENDED` | `event_controller_gate_set` |
| `PATCH /api/partner/team/settings` | 403 `PARTNER_SUSPENDED` | `event_controller_settings_set` |
| `POST /api/partner/shifts/*/validate-discrepancy` | 403 `PARTNER_SUSPENDED` | `shift_discrepancy_validate` |
| `POST /api/partner/team/invitations/*/cancel` | 403 `PARTNER_SUSPENDED` | `controller_invitation_cancel` |
| `POST /api/partner/team/invitations/*/resend` | 403 `PARTNER_SUSPENDED` | `controller_invitation_resend` |
| `POST /api/partner/team/invite` | 403 `PARTNER_SUSPENDED` | `controller_invitation_create`, `event_controllers_add` (nouvelle) |

Événements (finition 2a, 1a, inchangé) : 17 écritures refusées par la route (403 `PARTNER_SUSPENDED`), et en base par les fonctions du § 1.1 : `DELETE /api/partner/events/*`, `DELETE /api/partner/events/*/categories/*`, `PATCH /api/partner/events/*/categories/*`, `PATCH /api/partner/events/*/invitations/*`, `POST /api/partner/events`, `POST /api/partner/events/*/cancel`, `POST /api/partner/events/*/cash-refunds/*`, `POST /api/partner/events/*/categories`, `POST /api/partner/events/*/invitations`, `POST /api/partner/events/*/invitations/*/cancel`, `POST /api/partner/events/*/promotion`, `POST /api/partner/events/*/regisseur-pin`, `POST /api/partner/events/*/tickets/*/refund`, `POST /api/partner/events/*/transition`, `POST /api/partner/upload`, `PUT /api/partner/events/*`, `PUT /api/partner/events/*/zones`.

| Écriture gardée pour une fiche SUSPENDU | Raison |
|---|---|
| `DELETE /api/partner/halls/*` | service des salles fermé (interrupteur, 404) : à trancher à son ouverture |
| `DELETE /api/partner/products/*` | service des produits fermé (interrupteur, 404) : à trancher à son ouverture |
| `DELETE /api/partner/tables/*` | service des tables fermé (interrupteur, 404) : à trancher à son ouverture |
| `DELETE /api/partner/tables/reservations/*` | service des tables fermé (interrupteur, 404) : à trancher à son ouverture |
| `PATCH /api/partner/orders/*` | service des commandes fermé (interrupteur, 404) : à trancher à son ouverture |
| `PATCH /api/partner/products/*` | service des produits fermé (interrupteur, 404) : à trancher à son ouverture |
| `PATCH /api/partner/profile` | profil de la fiche (présentation, coordonnées) : pas un événement ; images contrôlées (T6) |
| `PATCH /api/partner/tables/*` | service des tables fermé (interrupteur, 404) : à trancher à son ouverture |
| `PATCH /api/partner/tables/reservations/*` | service des tables fermé (interrupteur, 404) : à trancher à son ouverture |
| `POST /api/partner/activation` | période d’essai du compte (idempotente) : aucun événement, aucune équipe |
| `POST /api/partner/documents/upload` | pièces du dossier : une fiche suspendue peut devoir compléter son dossier |
| `POST /api/partner/dossier/complete` | complément du dossier, même raison |
| `POST /api/partner/events/*/participants-export` | lecture envoyée en POST (export de la liste des participants) |
| `POST /api/partner/halls` | service des salles fermé (interrupteur, 404) : à trancher à son ouverture |
| `POST /api/partner/halls/reservations/*/status` | service des salles fermé (interrupteur, 404) : à trancher à son ouverture |
| `POST /api/partner/products` | service des produits fermé (interrupteur, 404) : à trancher à son ouverture |
| `POST /api/partner/products/*/status` | service des produits fermé (interrupteur, 404) : à trancher à son ouverture |
| `POST /api/partner/register` | inscription d’une organisatrice (aucune fiche encore) |
| `POST /api/partner/tables` | service des tables fermé (interrupteur, 404) : à trancher à son ouverture |
| `POST /api/partner/tables/reservations` | service des tables fermé (interrupteur, 404) : à trancher à son ouverture |
| `PUT /api/partner/halls/*` | service des salles fermé (interrupteur, 404) : à trancher à son ouverture |

| Écriture de contrôle | Propriétaire d’un événement à fiche non VALIDE |
|---|---|
| `PATCH /api/controller/profile` | gardée : profil du contrôleur lui-même (nom) : aucun événement |
| `POST /api/controller/counter-sale` | refusée, 403 `PARTNER_NOT_VALIDATED` (`ownEventFicheRefusal`) |
| `POST /api/controller/counter-sale/quote` | refusée, 403 `PARTNER_NOT_VALIDATED` (`ownEventFicheRefusal`) |
| `POST /api/controller/gate` | refusée, 403 `PARTNER_NOT_VALIDATED` (`ownEventFicheRefusal`) |
| `POST /api/controller/scan` | refusée, 403 `PARTNER_NOT_VALIDATED` (`ownEventFicheRefusal`) |
| `POST /api/controller/scan/guests` | refusée, 403 `PARTNER_NOT_VALIDATED` (`ownEventFicheRefusal`) |
| `POST /api/controller/scan/incidents` | refusée, 403 `PARTNER_NOT_VALIDATED` (`ownEventFicheRefusal`) **(décision T1, nouveau)** |
| `POST /api/controller/scan/lookup` | refusée, 403 `PARTNER_NOT_VALIDATED` (`ownEventFicheRefusal`) |
| `POST /api/controller/setup` | gardée : activation du compte d’un contrôleur (mot de passe) : son compte, aucun événement |
| `POST /api/controller/shifts/close` | gardée : clôture de SA caisse ouverte : l’argent encaissé doit pouvoir être déclaré même après la suspension (sinon la caisse reste ouverte et le contrôleur ne peut plus être retiré) |
| `POST /api/controller/shifts/open` | refusée, 403 `PARTNER_NOT_VALIDATED` (`ownEventFicheRefusal`) |

### C.2 T2 : écart d'une caisse

`POST /api/partner/shifts/[id]/validate-discrepancy`, une fois le mot de passe saisi :
- **fiche SUSPENDU :** refus par la route (garde de la fiche), puis par `shift_discrepancy_validate` (`PARTNER_SUSPENDED`) ;
- **admin muni de `events.write` :** l'écart est validé, journalisé `SHIFT_DISCREPANCY_VALIDATED` avec le rôle ADMIN ;
- **admin sans la permission ou tiers :** « Caisse introuvable », comme avant.

### C.3 T3 et T4 : changement de lieu

Ce qui est enregistré (table `event_place_notices`, une ligne par événement, serveur seulement) :
- la position annoncée ;
- l'heure du départ du dernier avis de lieu ;
- les champs de lieu retenus par la cadence, et l'heure de leur départ.

| Situation | Avant | Maintenant |
|---|---|---|
| Repère déplacé par pas de 150 m | Personne n'est prévenu : chaque pas est mesuré depuis le précédent | Avis dès que le repère est à plus de 200 m de la position annoncée ; alerte « lieu » aux admins |
| Aller de 300 m puis retour, dans les 10 minutes | Un SMS « change de lieu » part quand même | L'avis en attente est annulé sur tous les canaux (`NO_LONGER_RELEVANT`) ; rien ne part |
| Allers-retours de 300 m, chaque SMS parti | 4 SMS et 4 push en moins d'une heure | Le premier part. Les suivants sont retenus jusqu'à une heure après lui et partent ensemble, si le lieu a encore changé ; un retour à la position annoncée efface la retenue |
| Changement de date ou de titre seul | Notification dans l'application tout de suite ; SMS 10 minutes après | Inchangé |
| Changement qui touche au lieu | Application et push tout de suite ; SMS 10 minutes après | Tout part ensemble 10 minutes après (application, push, SMS, email), ou tout de suite si le début est à moins d'une heure, sauf retenue d'une heure |

La position annoncée :
- **pose :** au passage à VALIDE (le repère validé) ; un événement validé sans repère prend son premier repère ;
- **mise à jour :** au départ (SENT, ou UNCERTAIN : peut-être remis) de chaque SMS « change de lieu » ;
- **pour les événements déjà validés :** la migration la pose au repère actuel, et rien n'est envoyé.

L'avis retenu est libéré par l'envoyeur à chacun de ses passages (chaque minute). À ce moment :
- le repère compte seulement s'il est encore à plus de 200 m de la position annoncée ;
- le nom, la ville et l'adresse retenus comptent tels quels ;
- l'avis part aux porteurs, aux numéros sans compte et aux contrôleurs, avec les valeurs actuelles.

Textes exacts nouveaux :
- **Bandeau du formulaire** (événement validé ou publié) :
  - « Déplacer le repère de plus de 200 m prévient les détenteurs de billets par SMS. » ;
  - la première ligne devient « Description, programme, informations pratiques et affiche : modifiables librement. » (« et position » retiré : la position n'est plus libre).
- **Résumé après enregistrement**, changement de lieu :
  - « {n} détenteurs de billets seront prévenus à {heure}, dans l’application et par SMS (vos corrections d’ici là y seront regroupées). » ;
  - au singulier : « 1 détenteur de billets sera prévenu à {heure}, dans l’application et par SMS (vos corrections d’ici là y seront regroupées). »
- **Résumé, avis retenu :** « Le changement de lieu sera annoncé aux détenteurs de billets à {heure} : un seul avis de changement de lieu part par heure. » Seul, ou après le résumé des autres changements.

### C.4 T5 : affiche

**Règle.** Est accepté comme affiche un fichier du dossier `events/<id de la partenaire>/` du compartiment public, nommé `13 chiffres_8 caractères hexadécimaux.webp`. C'est le nom que donne la route de dépôt, qui réencode toujours. La règle est contrôlée à trois endroits :
- formulaire et route (`IMAGE_ORIGIN_INVALID`) ;
- vérification d'existence ;
- base (`event_poster_path_ok`, appelée par `event_create`, et par `event_update` quand l'affiche change).

Une affiche déjà enregistrée, renvoyée telle quelle par le formulaire, reste acceptée : modifier un autre champ d'un événement ancien ne bloque pas.

**Réencodage des affiches anciennes : `scripts/reencode-posters.ts`.** À lancer une fois, après la fusion et les migrations.

Ce que le script fera :
1. **Recensement.** Il relève chaque événement dont l'affiche est un fichier de `events/<dossier>/` qui ne porte pas le nom de la route.
2. **Pour chaque fichier, une seule fois même s'il est cité par plusieurs événements :**
   - lecture, puis réencodage identique à la route (orientation appliquée, 1 600 px au plus, WebP 82, sans métadonnée) ;
   - dépôt dans le même dossier, sous un nom de la route ;
   - chaque événement qui cite encore l'ancienne adresse prend la nouvelle (`event_poster_reencoded`, comparaison puis écriture). C'est journalisé `EVENT_POSTER_REENCODED` (SYSTEM), sans alerte « affiche » aux admins ;
   - l'ancien fichier est effacé s'il n'est plus cité nulle part (§ C.5).
3. **Fichier absent ou illisible :** il est signalé et laissé tel quel. L'organisatrice redéposera son affiche.

Comment le lancer :
- **à blanc, par défaut :** la liste seulement, rien n'est écrit ;
- **`--appliquer` :** pour de bon, 50 fichiers par passage ;
- **rejouable :** un passage de plus ne trouve rien à refaire (seuls les fichiers absents sont signalés de nouveau).

Contrôle avant et après (éditeur SQL du tableau de bord de Supabase) :
```sql
-- Affiches d'avant la finition encore citées (avant : n ; après --appliquer : seulement les fichiers absents signalés)
SELECT count(*) AS affiches_anciennes,
       count(DISTINCT image_url) AS fichiers
  FROM public.events
 WHERE image_url LIKE '%/storage/v1/object/public/public-images/events/%'
   AND image_url !~ '/[0-9]{13}_[0-9a-f]{8}[.]webp([?#].*)?$';
-- Journal du réencodage (après)
SELECT count(*) FROM public.audit_logs WHERE action = 'EVENT_POSTER_REENCODED';
```

### C.5 T6 : colonnes qui citent le stockage

Recherche dans tout le schéma. `tests/parcours/f2acv-stockage-cite.test.ts` relit le schéma à chaque run : une colonne nouvelle au nom d'adresse ou d'image, non lue, fait échouer le test. Toutes ces colonnes sont lues par `storage_public_citations`, donc par la purge et par l'effacement d'une affiche remplacée.

| Colonne | Contenu | Refuse `events/` |
|---|---|---|
| `events.image_url` | affiche | non (c'est l'affiche) |
| `events.gallery_urls` | galerie (non modifiable, servie par l'API publique) | non modifiable |
| `public_event_state.image_url` | copie publique de l'affiche | copie |
| `halls.images` | images d'une salle | oui (HallService) |
| `products.images` | images d'un produit | oui (ProductService) |
| `partners.logo_url`, `partners.cover_url` | logo, couverture du profil | oui (PATCH /api/partner/profile) |
| `partners.id_card_url`, `partners.business_doc_url` | pièces d'avant le lot 1C | aucune écriture de l'application |
| `users.avatar_url` | photo du compte (compartiment `avatars`) | écrite par la seule route de la photo |

`partner_documents.object_path` cite le compartiment privé des pièces (`partner_documents`), jamais `public-images` : sans effet sur les affiches, elle n'est pas lue.

### C.6 Remarques R1, R2, R3

- **R1, recherche de lieu.** `normalizePlaceQuery` retire :
  - le caractère nul et les caractères de contrôle (C0, suppression, C1) ; la tabulation et les retours à la ligne deviennent des espaces ;
  - les caractères invisibles de mise en forme (sens de lecture, largeur nulle).

  Le service ne reçoit plus `%00`, et la réponse est de nouveau gardée (l'écriture du cache échouait sur le nul). Une recherche indisponible (503 : service en panne, injoignable, ou attente trop longue) rend son unité de quota.
- **R2, `ProductService`.** Création et modification passent par une liste blanche stricte : `category_id`, `name`, `description`, `price`, `is_daily_special`, `daily_special_date`, `stock_quantity`, `is_stock_managed`, `images`.
  - Tout autre champ est refusé (400 `FIELD_NOT_EDITABLE`), dont `partner_id`, `status`, `id` et `created_at`.
  - La partenaire est toujours celle de la session.
  - Le statut prend sa valeur par défaut à la création et ne change que par la route du statut (valeur contrôlée).
  - Une catégorie d'une autre organisatrice est refusée ; le produit d'une autre donne 404.
  - L'écran des produits n'envoie que des champs de la liste : il n'est pas touché.
- **R3.** § 11 corrigé : seule la fiche SUSPENDU cherche un lieu. EN_ATTENTE et REJETE reçoivent 403 `PARTNER_NOT_VALIDATED`.

### C.7 Migrations 20261116000004 à 20261116000008 (à appliquer après les trois premières)

| Migration | Contenu | Donnée écrite |
|---|---|---|
| `…04_f2acv_equipe_suspendue` | `partner_team_owner_suspended` ; 9 fonctions d'équipe recopiées, fiche contrôlée en tête ; 3 fonctions nouvelles ; `atomic_partner_remove_controller` à 3 paramètres | aucune |
| `…05_f2acv_ecart_caisse` | `shift_discrepancy_validate` : fiche SUSPENDU refusée, admin `events.write` admis | aucune |
| `…06_f2acv_avis_de_lieu` | table `event_place_notices` et 2 déclencheurs ; `event_change_notify`, `event_place_notice_revert`, `event_place_notices_release` ; `event_update` et l'alerte des admins recopiées | une ligne par événement validé avec repère (position annoncée = repère actuel) |
| `…07_f2acv_affiche_format` | `event_poster_path_ok` stricte ; `event_poster_reencoded` ; alerte des admins recopiée (réencodage sans alerte) | aucune |
| `…08_f2acv_stockage_cite` | `storage_public_citations` | aucune |

Contrôles (éditeur SQL), avant puis après :
```sql
-- A. Avant : événements validés avec repère (ce que la migration 06 remplira)
SELECT count(*) FROM public.events WHERE status::text IN ('VALIDE','PUBLIE','SUSPENDU') AND latitude IS NOT NULL AND longitude IS NOT NULL;
-- B. Après : même nombre de positions annoncées
SELECT count(*) FROM public.event_place_notices WHERE announced_latitude IS NOT NULL;
-- C. Après : fonctions et déclencheurs
SELECT count(*) FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname IN (
  'partner_team_owner_suspended','event_controller_entry_point_set','event_controllers_remove','event_controllers_add',
  'event_change_notify','event_place_notice_revert','event_place_notices_release','event_poster_reencoded','storage_public_citations');  -- 9
SELECT tgname FROM pg_trigger WHERE tgname IN ('trg_events_place_announce','trg_notification_outbox_place_sent') ORDER BY 1;  -- 2 lignes
SELECT pg_get_function_identity_arguments('public.atomic_partner_remove_controller'::regproc);  -- p_partner_id uuid, p_controller_id uuid, p_actor_id uuid
-- D. Après : affiche, règle stricte
SELECT public.event_poster_path_ok('https://x/storage/v1/object/public/public-images/events/00000000-0000-4000-8000-000000000000/ancienne.jpg', '00000000-0000-4000-8000-000000000000');  -- false
SELECT public.event_poster_path_ok('https://x/storage/v1/object/public/public-images/events/00000000-0000-4000-8000-000000000000/1794809026783_1a2b3c4d.webp', '00000000-0000-4000-8000-000000000000');  -- true
-- E. Après : adresses citées lues par la purge
SELECT jsonb_array_length(public.storage_public_citations());
```

### C.8 Runs

| Run | Commit | Contenu | Résultat |
|---|---|---|---|
| 235 | `768dc956` | « avant » : finition 2a et suites de la contre-vérification (même commit que la tête après l'avance rapide) | 425 suites sur 428. Rouges : exactement `cvf2a-1`, `cvf2a-2`, `cvf2a-4` (T1 à T6). e2e vert |
| 236 | `bfbd6b41` | T1 à T4 seulement | 428 sur 432. `cvf2a-1` (T1, T2) et `cvf2a-4` (T3, T4) **verts**. `cvf2a-2` rouge, attendu : T5 et T6 n'y étaient pas encore. Trois échecs de ma part : voir « Erreurs ». e2e vert, budgets JS inchangés |
| 237 | `11da84ee` (branche `finition-2a/cv-rouges`) | premier essai de la preuve des rouges : les 8 suites nouvelles sur `768dc956`, sans aucun correctif | 387 sur 436. Les 11 rouges attendus le sont pour la bonne raison : `cvf2a-1`, `-2`, `-4` et les 8 suites. Exemples : petits pas sans alerte `[0,0,0,0]`, `%00` envoyé au service, fonctions absentes, écritures de l'équipe et validation d'écart acceptées. Mais **38 suites étrangères en échec**, toutes par l'invariant x13, à cause d'une ligne forgée par mon test T6 (voir « Erreurs », 1). Preuve refaite au run 239 |
| 238 | `ad216558` | tous les points | **435 sur 436** : toutes les suites `cvf2a-*` et `f2acv-*` vertes. En échec : l'ancien test des commandes (`tests/partner-orders-m9`, test 4), et l'e2e (fumée étape 11, terrain, recette acte 10), pour une seule cause chacun : voir « Erreurs », 5 et 6. Captures toutes faites (465, 55 ignorées comme au run 235) |
| 239 | `7dfea8eb` (branche `finition-2a/cv-rouges`) | preuve des rouges refaite (mêmes 8 fichiers que la branche livrée) | **425 sur 436 : exactement les 11 rouges attendus**, `cvf2a-1`, `cvf2a-2`, `cvf2a-4` et les 8 suites `f2acv-*`. Aucun autre échec, invariants à 0, e2e vert. Sorties brutes ci-dessous |
| 240 | `b2445ce1` | « après » | **436 sur 436, vert.** 31 suites d'audit vertes, invariants à 0. e2e vert : captures 465, 55 ignorées comme au run 235 ; fumée, terrain, recette. Budgets JS octet pour octet ceux de `main` |

Sorties brutes des rouges, run 239 (code d'avant correctif ; extraits des journaux `test-logs/tests__parcours__f2acv-*.log`) :
```
== f2acv-ecritures-fiche
[F2ACV-T1] écritures directes de l'équipe : app/api/partner/team/[eventId]/route.ts : event_controllers.delete ; app/api/partner/team/all/route.ts : event_controllers.delete ; app/api/partner/team/e
== f2acv-equipe-suspendue
[F2ACV-T1] event_controller_set_cash (fiche SUSPENDU) → {"ok":true,"changed":true,"event_id":"05befe36-9878-4fdd-9055-926a092f95f7","open_shift":false,"assignment_id":"254b584f-51e8-4824-8d6a-ecf004
[F2ACV-T1] event_controller_entry_point_set (fiche SUSPENDU) → {"ok":false,"code":"SQL_ERROR","message":"PGRST202 Could not find the function public.event_controller_entry_point_set(p) in the schema
[F2ACV-T1] event_controllers_add (fiche SUSPENDU) → {"ok":false,"code":"SQL_ERROR","message":"PGRST202 Could not find the function public.event_controllers_add(p) in the schema cache"}
[F2ACV-T1] controller_invitation_resend (fiche SUSPENDU) → {"ok":true,"phone":"+221772972585","expires_at":"2026-11-19T13:29:34.754456+00:00","send_count":2,"invitation_id":"6b7f8f39-71cd-4dae-be5a-
[F2ACV-T1] controller_invitation_cancel (fiche SUSPENDU) → {"ok":true,"status":"CANCELLED","invitation_id":"6b7f8f39-71cd-4dae-be5a-d13bbbd3ecbb"}
== f2acv-ecart-caisse
[F2ACV-T2] POST /api/partner/shifts/[id]/validate-discrepancy (fiche SUSPENDU) → HTTP 200 {"ok":true,"shift_id":"84d422a2-8599-4b7c-afbd-903baf931982","discrepancy":500,"validated_at":"2026-11-16T13
[F2ACV-T2] shift_discrepancy_validate (fiche SUSPENDU) → {"ok":false,"code":"ALREADY_VALIDATED","message":"L'écart de cette caisse est déjà validé."}
[F2ACV-T2] POST validate-discrepancy (admin events.write, fiche SUSPENDU) → HTTP 404 {"error":"Caisse introuvable.","code":"SHIFT_NOT_FOUND"}
== f2acv-avis-de-lieu
[F2ACV-T34] alertes « lieu » après chaque pas de 150 m : [0,0,0,0]
== f2acv-affiche-format
[F2ACV-T5] PUT affiche d'avant la finition → HTTP 200 {"success":true,"event":{"id":"1bf27615-9042-4e9b-a5e0-fec7669414be","city":"Dakar","slug":null,"title":"TEST Cycle f2acv-affiche-route 17948357
[F2ACV-T5] event_update nom libre → {"ok":true,"event":{"id":"40e13ae1-71f1-44a8-8ed9-7ca49914a299","city":"Dakar","slug":null,"title":"TEST Cycle f2acv-affiche-base 1794835762479","status":"BROUILL
      error: "Cannot find module '/home/runner/work/event-village/event-village/lib/events/poster-reencode' imported from /home/runner/work/event-village/event-village/tests/parcours/f2acv-affiche-for
== f2acv-stockage-cite
      error: 'function "public.storage_public_citations()" does not exist'
[F2ACV-T6] après la purge : {"photo":false,"piece":false,"orpheline":false}
[F2ACV-T6] PATCH profile logo du dossier events/ → HTTP 200 {"success":true,"partner":{"id":"dd791a12-b2a6-486b-b7bd-459d044eb089","company_name":"TEST Finance f2acv-stockage 1794835782600","commerc
[F2ACV-T6] PATCH profile couverture du dossier events/ → HTTP 200 {"success":true,"partner":{"id":"dd791a12-b2a6-486b-b7bd-459d044eb089","company_name":"TEST Finance f2acv-stockage 1794835782600","c
[F2ACV-T6] PATCH profile logo du dossier events/ encodé → HTTP 200 {"success":true,"partner":{"id":"dd791a12-b2a6-486b-b7bd-459d044eb089","company_name":"TEST Finance f2acv-stockage 1794835782600",
== f2acv-recherche
[F2ACV-R1] recherche avec un nul → HTTP 200 {"results":[{"label":"Stade\u0000 Demba\u0007 Diop 36167cfc, Dakar, Sénégal","latitude":14.7,"longitude":-17.45}],"attribution":"© contributeurs OpenSt
      error: 'caractère de contrôle envoyé au service : /search?q=Stade%00+Demba%07+Diop+36167cfc&format=jsonv2&countrycodes=sn&limit=5&accept-language=fr'
[F2ACV-R1] quota 1 : indisponible → 503 ; puis → 429 ; puis → 429
== f2acv-produits
[F2ACV-R2] création avec partner_id d’une autre → accepté
[F2ACV-R2] création avec statut → accepté
[F2ACV-R2] création avec identifiant → accepté
[F2ACV-R2] création avec date de création → accepté
[F2ACV-R2] modification avec partner_id → accepté
```

### C.9 Tests modifiés, et pourquoi

| Fichier | Changement | Raison |
|---|---|---|
| `tests/audit/cvf2a-2-affiche.test.ts` (e, deux essais) | Logo et couverture posés directement en base, au lieu de `PATCH /api/partner/profile` | Ta décision. Le profil refuse désormais une adresse du dossier `events/` (T6), donc la précondition « le profil accepte cette image » ne pouvait plus tenir. La donnée ancienne est posée en base, comme la salle et le produit le sont déjà dans ce même test. Les vérifications d'attaque sont inchangées : fichier gardé au remplacement et à la purge |
| `tests/parcours/cycle-helpers.ts` (`posterUrl`) | Nom par défaut au format de la route (`horodatage_8 caractères.webp`) au lieu de `<uuid>.png` | T5 : seul ce nom est accepté comme affiche. L'aide ne donne qu'une adresse, sans fichier, comme avant |
| `tests/schema/migration-finition2a-rejouable.test.ts` | Liste des migrations 20261116… complétée (04 à 08) | Le test fige la liste exacte. Les cinq nouvelles y sont donc aussi rejouées deux fois en transaction annulée |
| `tests/parcours/notif-migration.test.ts` (inventaire K1) | Envoi E7-E8 cherché dans `event_change_notify` | Le code de l'envoi a été déplacé de `event_update` dans cette fonction |
| `tests/partner-orders-m9.test.ts` (test 4) | Produit créé puis suspendu par `setProductStatus`, au lieu de `status: 'SUSPENDU'` dans le corps de la création | R2 : le statut n'est jamais pris du corps. La vérification (commande refusée pour un produit suspendu) est inchangée |
| `e2e/support/service.ts`, `scripts/e2e/terrain-setup.ts` | Aide `routePosterOfPartner` : copie de la plus ancienne affiche de la partenaire, réencodée en WebP sous un nom de la route | T5 : les montages e2e créaient des événements par `event_create` avec l'affiche de la graine (`fixture-<slug>.png`), refusée désormais. Même image sur les captures |

Suites nouvelles : `f2acv-ecritures-fiche`, `f2acv-equipe-suspendue`, `f2acv-ecart-caisse`, `f2acv-avis-de-lieu`, `f2acv-affiche-format`, `f2acv-stockage-cite`, `f2acv-recherche`, `f2acv-produits`.

### C.10 Captures avant et après

Un seul écran change : le bandeau du formulaire d'un événement validé ou publié (capture `partenaire-edition`).
- **Avant :** run 235. On y lit « Description, programme, informations pratiques, affiche et position : modifiables librement. »
- **Après :** runs 238 et 240. Première ligne sans « et position », puis la ligne « Déplacer le repère de plus de 200 m prévient les détenteurs de billets par SMS. »
- **Formats :** 390 et 1 440 px, clair et sombre.

J'ai relu les quatre captures « après ». Le bandeau garde ses couleurs (jetons du système de design) et se lit en clair comme en sombre. À 390 px, la nouvelle ligne tient sur trois lignes, sans défilement horizontal. Aucun mot technique.

Le résumé affiché après l'enregistrement (heure de l'avis de lieu) n'est pas capturé. Il n'apparaît qu'après un enregistrement, et les captures n'écrivent jamais en base. Ses textes exacts sont au § C.3.

### C.11 Essais pour un non-développeur (event-village-dev, après le déploiement)

1. **Équipe d'une fiche suspendue (T1).**
   1. L'admin suspend la fiche d'une organisatrice de test.
   2. Connecté avec ce compte, dans « Équipe », change la porte d'un contrôleur.
   3. Attendu : « Votre compte organisateur est suspendu : vos événements ne sont plus modifiables. Contactez le support. » suivi du contact ; rien ne change.
2. **Écart de caisse (T2).**
   1. Même fiche suspendue, onglet « Caisse » du pilotage, « Valider l'écart » : même refus.
   2. Connecté en admin muni de « Gérer les événements », sur la même page : l'écart est validé.
3. **Changement de lieu (T3, T4).** Sur un événement publié, avec un billet de test à ton numéro :
   1. déplace le repère deux fois de 150 m dans la même direction : 10 minutes après, un seul SMS « change de lieu » ;
   2. déplace-le de 300 m puis remets-le à sa place avant 10 minutes : aucun SMS ;
   3. déplace-le encore moins d'une heure après un SMS : le formulaire dit « Le changement de lieu sera annoncé aux détenteurs de billets à {heure} : un seul avis de changement de lieu part par heure. », et le SMS arrive à cette heure-là.
4. **Bandeau (T3).** Ouvre « Modifier » sur un événement publié : le bandeau dit « Déplacer le repère de plus de 200 m prévient les détenteurs de billets par SMS. »
5. **Affiches anciennes (T5).** Lance le script à blanc (§ C.12) : il liste les affiches qu'il réencoderait.

### C.12 À faire de ton côté (complète le § 10)

1. **Décider la fusion** de la finition 2a, avec ces correctifs.
2. **Migrations.** Après la fusion, appliquer sur event-village-dev les huit migrations `20261116000001` à `…08`, dans l'ordre : contrôles du § 5 pour 01 à 03, du § C.7 pour 04 à 08.
3. **Réencodage des affiches anciennes**, après le déploiement, avec les variables du projet chargées dans le terminal :
   1. `npx tsx scripts/reencode-posters.ts` (à blanc) : relire la liste ;
   2. puis `npx tsx scripts/reencode-posters.ts --appliquer`, à relancer jusqu'à « Restants pour un passage suivant : 0 » ;
   3. contrôle SQL avant et après au § C.4.
4. **Décisions à trancher :**
   - écritures des services fermés (salles, produits, commandes, tables) pour une fiche suspendue, à leur ouverture ;
   - cadence d'une heure même à moins d'une heure du début (§ C.3), ou passage immédiat dans ce cas ;
   - même cadence pour les SMS « change de date » ? Non demandé ; un aller-retour de date refait une rafale.

La suite de ce rapport, à partir de « À lire en premier », est celle de la finition 2a (15 et 16 novembre). Elle est inchangée, hormis le § 11, corrigé pour R3.

---

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
