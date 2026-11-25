# Lot Carte B3 — salles et restaurants sur la carte, zone approximative des particuliers

Branche `carte-b3/lieux` (depuis `main` 76e09fb733), worktree `event-village-carteb3`. Non fusionnée ; migration
`20261210000001` **non appliquée** : une contre-vérification indépendante suit.

## À lire en premier

**Failles trouvées (avant ce lot, l'adresse exacte d'un lieu tenu par un particulier était lisible par tous).** La
décision du client du 21/11 (zone de 300 m, adresse seulement après une réservation confirmée) n'était pas tenue :

| N° | Faille | Preuve rouge (run 652, tests seuls, `db8986c5ab`) | Correctif |
|---|---|---|---|
| F1 | REST : `halls` (toutes colonnes) et `venues` (`address`, `latitude`, `longitude`) lisibles par un visiteur et toute personne connectée. | `cb3-adresse-particuliers` F1 : `address: 'Villa cb309e21a3d rue des Manguiers'` rendu, « erreur : aucune ». | Colonnes REST sans adresse ni position (migration, § 3). |
| F2 | Recherche publique (`hall_search`, `venue_search`) : le texte cherché était comparé à l'adresse ; on retrouvait l'adresse d'un particulier par essais. | F2 : « la recherche « cb309e21a3d » retrouve la salle par son adresse ». | Recopies : adresse comparée pour un lieu professionnel seulement. |
| F3 | Routes publiques (`/api/halls`, `/api/halls/[id]`, `/api/tables`, `/api/tables/[id]`, `/api/restaurants/[id]/tables`), fiche publique (adresse, point exact, lien « Voir l'itinéraire » vers Google Maps). | F3 : adresse et coordonnées exactes dans les réponses. | `lib/lieux/position-publique.ts` : centre de la zone et aucune adresse pour un particulier ; fiche sans itinéraire. |
| F4 | Écran de réservation du client : adresse donnée dès la réservation en attente de paiement (et après annulation). | F4 : adresse dans la réservation « à payer ». | Adresse seulement si confirmée (salle : acompte ou tout payé ; table : confirmée ou arrivée). |

Run 652 : 8/8 rouges, chacun pour sa raison (sortie au § 4.1). Run 653 (correctifs) : 89/89 vertes, dont ces 8.

**Choix à valider par le client.** Rien ne distinguait un particulier : chaque salle et chaque établissement porte
maintenant « Qui accueille ? » (`host_kind`). **Par défaut : chez un particulier**, lieux existants compris (protection par
défaut). Un établissement professionnel doit le déclarer pour montrer son adresse et son point (rappel dans
`docs/apres-lancement.md`).

<!-- VERDICT -->

## 1. Étape 0 (avant de coder)

**Comment un particulier se reconnaissait : il ne se reconnaissait pas.**
- `partners` : aucun type de partenaire ; l'inscription exige un document d'entreprise (RCCM ou NINEA,
  `lib/validations/auth.ts:242`) ; `partner_activities` décrit les activités, pas la nature du lieu.
- `halls` (0001 + 10a + 10b) et `venues` (11a, `kind` RESTAURANT / BAR / ESPACE) : aucun champ.
- Décision : champ par lieu `host_kind` (un même partenaire peut louer une villa et tenir un restaurant), choisi dans le
  formulaire, PARTICULIER par défaut.

**Où l'adresse et la position exactes étaient lisibles sans réservation confirmée.**

| Endroit | Avant | Preuve |
|---|---|---|
| REST `halls` | toutes les colonnes (droits par défaut de Supabase, règle `halls_read_public` : salles publiques) | aucune restriction de colonnes dans les migrations ; F1 rouge |
| REST `venues` | `address, latitude, longitude` dans `GRANT SELECT (…)` | `20261129000009_l11b_cv_lectures_etablissements.sql:54-58` ; F1 rouge |
| Recherche | `hall_search` / `venue_search` : `address ILIKE` et `address`, `latitude`, `longitude` rendus | `20261126000002_l10b_salles.sql:377`, `20261129000002_l11b_fermetures_disponibilites.sql:540` ; F2 rouge |
| Routes publiques | `searchHalls`, `publicHall`, `searchVenues`, `publicVenue`, `/api/restaurants/[id]/tables` | `lib/halls/queries.ts`, `lib/tables/queries.ts` ; F3 rouge |
| Fiche publique (page, données de la page) | adresse dans l'en-tête et la section « Adresse », petite carte au point exact, `https://www.google.com/maps/dir/?api=1&destination=<lat>,<lng>` | `app/halls/(catalogue)/[id]/page.tsx:82-160`, `app/tables/(catalogue)/[id]/page.tsx:94-210` |
| Carte de la fiche | `components/event-page/VenueMap.tsx` (repère au point donné) | rendue au point exact par la fiche |
| Vignettes de recherche | `HallCard`, `VenueCard` : « ville · adresse » | `components/halls/client/HallCard.tsx:18`, `components/tables/client/VenueCard.tsx:31` |
| Image de partage | aucune pour les lieux (`lib/og` : événements seulement) ; titre et description de la page sans adresse | `generateMetadata` des deux fiches |
| Écran de réservation | `hallAddress` / `venueAddress` dans tous les états | `lib/halls/queries.ts:289`, `lib/tables/queries.ts:305` ; F4 rouge |
| Profil de la partenaire | `partners.address` hors de la vue publique `public_partners` | `20261102000001_lot5_securite.sql:35-44` (rien à corriger) |

**Interrupteurs.** `features.halls_enabled` (salles) et `features.tables_enabled` (établissements), lus à chaque requête
(`lib/features/flags.ts`). Effet sur la carte : une couche dont le service est fermé n'est pas proposée (pastille absente,
`GET /api/lieux/carte?couche=…` en 404 comme les autres lectures publiques des services) ; Événements toujours proposés.
Fermés par défaut : en production, la carte reste celle des événements tant que l'administration n'ouvre rien.

## 2. Ce qui a été fait

### 2.1 Base (`supabase/migrations/20261210000001_cb3_lieux_particuliers.sql`, rejouable, sans BEGIN ni COMMIT)
1. `halls.host_kind`, `venues.host_kind` : `PARTICULIER` (défaut) ou `PROFESSIONNEL`.
2. Zone : `zone_latitude`, `zone_longitude` = centre d'un cercle de 300 m qui **contient** le vrai point : décalage tiré une
   fois (80 à 220 m, direction au hasard, tirage pris dans `gen_random_uuid`), **stocké** ; retiré seulement quand la position
   change ; toute écriture directe de la zone est annulée (déclencheurs `trg_halls_zone`, `trg_venues_zone`). La même zone à
   chaque lecture : aucune moyenne ne retrouve le point. Lieux existants remplis (seules les colonnes de zone sont écrites).
3. REST : `address`, `latitude`, `longitude` (et la zone) retirées des colonnes lisibles par `anon` et `authenticated` sur
   `halls` et `venues`. Aucun écran ne lit ces tables par le navigateur (grep : aucun `from('halls')` / `from('venues')` dans
   un fichier `'use client'`).
4. `hall_search`, `venue_search` : recopies de la dernière définition (fichiers et lignes cités en tête ; test « aucune
   ligne perdue ») ; adresse d'un particulier jamais comparée ni rendue, centre de la zone à la place du point, champ
   `exact`.

### 2.2 Serveur
- `lib/lieux/position-publique.ts` : point exact (professionnel) ou centre de zone (particulier), jamais les deux ;
  adresse des seuls lieux professionnels. Utilisé par les fiches, les recherches, `/api/restaurants/[id]/tables`.
- `GET /api/lieux/carte` (public, `middleware.ts`) : `couche=salles|restaurants`, zone, filtres (salle : date, jours,
  invités ; restaurant : date, heure, personnes). Colonnes choisies une à une, copie champ par champ
  (`PUBLIC_PLACE_FIELDS` : id, type, name, area, photos, price, capacity, lat, lng, exact, hours), 300 au plus. Rien de la
  partenaire. Cache de 60 s sous l'étiquette `lieux-publics` ; la position publique est décidée AVANT le cache (le vrai
  point d'un particulier n'y entre pas). Disponibilité par les recherches des lots 10b et 11b (sans cache).
- Invalidation immédiate (`lib/lieux/cache-lieux.server.ts`) : décisions de l'administration (valider, refuser,
  suspendre, réactiver) sur les salles et les établissements, création, modification (nom, prix, photos, position,
  horaires, retrait, particulier ou professionnel), suppression, renvoi en validation, tables (places), statut de la
  partenaire.
- Adresse exacte : écran de réservation du client seulement une fois confirmée (`HALL_ADDRESS_STATES`,
  `TABLE_ADDRESS_STATES`) ; la partenaire et l'administration la voient toujours. Avis de confirmation
  (`HALL_RESERVATION_CONFIRMED`, `TABLE_RESERVATION_CONFIRMED`) : « Adresse : … » ajoutée à l'envoi (application, email,
  notification), seulement si la réservation est encore confirmée et que l'avis va à sa cliente
  (`lib/lieux/adresse-confirmee.server.ts`) ; le SMS garde son texte court et son lien vers la réservation.

### 2.3 Écrans (skill `ui-ux-pro-max` invoqué avant)
- Carte d'Explorer (`components/explore/ExploreMap.tsx`, module chargé à l'ouverture de la carte) : pastilles Événements,
  Salles, Restaurants (boutons à bascule, icône, nombre dans la zone « Salles · 12 », barre orange d'Explorer qui se
  déploie), gardées dans l'adresse (`couches=`) ; filtres propres à chaque couche ; repères distincts par la forme
  (billet, bâtiment avec « Dès 150 000 F/jour », couverts avec le nom ; pointillé pour un particulier), nom accessible
  complet (« Salle Teranga, jusqu'à 250 personnes, dès 150 000 F par jour, zone approximative, Thiès ») ; zone de 300 m
  dessinée dès le zoom 13 ; regroupements mixtes ; feuille du téléphone (photos qui glissent, sans défilement automatique,
  « Ouvert maintenant · ferme à 23 h », « Adresse exacte après réservation », lien vers la fiche) ; liste de l'ordinateur
  par couche, survol = repère mis en avant ; état vide illustré « Élargir la zone ». Calendrier et aperçu de l'accueil
  inchangés (événements seulement).
- Fiches (`components/lieux/PlaceMap.tsx`, même chargeur que la carte de la fiche d'un événement) : particulier = cercle
  en pointillé, « Adresse exacte après réservation », section « Quartier », aucun itinéraire ; professionnel = repère au
  point et « Voir l'itinéraire ».
- Formulaires de la partenaire : « Qui accueille ? » (Chez un particulier, présélectionné ; Lieu professionnel).
  Administration : ligne « Accueil ». Réservation du client : adresse et « Voir l'itinéraire » une fois confirmée ; avant,
  la ville et « L'adresse exacte vous sera donnée dès que votre réservation sera confirmée. ».

## 3. Tests de vie privée et d'invalidation

| Suite | Ce qu'elle prouve | Résultat |
|---|---|---|
| `tests/security/cb3-adresse-particuliers.test.ts` | F1 REST (anon et cliente connectée), F2 recherche, F3 routes publiques, F4 écrans de réservation (en attente, autre cliente, confirmée, annulée) | run 652 (tests seuls) : 8/8 **rouges** ; run 653 : 8/8 vertes |
| `tests/parcours/cb3-carte-lieux.test.ts` | lieux publics seulement (attente, refusé, suspendu, retiré, sans position, partenaire suspendue : jamais), retrait à la lecture suivante ; 0 champ en trop, rien de la partenaire ; zone : même centre sur 5 lectures, écart 80-220 m, vrai point absent, écriture directe de la zone ignorée, nouvelle position = nouvelle zone, 200 tirages de la base entre 80 et 220 m ; point exact d'un professionnel ; 400 / 404 ; disponibilité | run 653 : 15/15 |
| `tests/schema/migration-carte-b3-rejouable.test.ts` | migration rejouable deux fois, sans BEGIN/COMMIT, après les lots précédents ; recopies `hall_search`, `venue_search` sans ligne perdue (3 lignes remplacées chacune, listées) ; lignes citées = dernière définition | run 653 : vert |
| `tests/schema/carte-b3-ecrans.test.ts` | contrat public (copie champ par champ), « Ouvert maintenant », zone des lieux envoyée sur la grille T1, aucune adresse lue, aucune nouvelle importation à la demande, repères (forme, échappement, nom accessible), fiches (itinéraire du seul professionnel) | poste : 16/16 ; run 657 : vert |
| `e2e/carte-b3.responsive.spec.ts` | salle validée sur la carte en moins de 5 s, suspendue retirée en moins de 5 s ; zone et jamais le point ; fiche publique (visiteur sans cookie), recherche, fiche de l'API, carte : ni adresse, ni point exact, ni lien d'itinéraire ; couches dans l'adresse ; captures | runs 654 et 657 (voir ci-dessous) |

Sorties (extraits bruts) :

```
run 652 — tests/security/cb3-adresse-particuliers.test.ts (tests seuls, avant correctif)
    not ok 1 - halls : visiteur et cliente connectée ne lisent ni l’adresse ni la position
        halls lisible par la REST (erreur : aucune)
        +     address: 'Villa cb309e21a3d rue des Manguiers',
    not ok 2 - venues : visiteur et cliente connectée ne lisent ni l’adresse ni la position
        +     address: 'Maison cb309e21a3d allée des Filaos',
    not ok 1 - salles : chercher un mot de l’adresse ne retrouve pas la salle
      error: 'la recherche « cb309e21a3d » retrouve la salle par son adresse : HTTP 200 {"success":true,"total":1,…
    not ok 2 - établissements : chercher un mot de l’adresse ne retrouve pas l’établissement
    not ok 1 - GET /api/halls et /api/halls/[id]            (+ 'Villa cb309e21a3d rue des Manguiers', 'cb309e21a3d')
    not ok 2 - GET /api/tables, /api/tables/[id], /api/restaurants/[id]/tables
    not ok 1 - salle : en attente de paiement = pas d’adresse ; …   (réservation en attente de paiement : adresse rendue)
    not ok 2 - table : acompte à payer = pas d’adresse ; …
# pass 0
# fail 8

run 653 — mêmes 8 tests après correctifs
    ok 1 - halls : visiteur et cliente connectée ne lisent ni l’adresse ni la position
    ok 2 - venues : visiteur et cliente connectée ne lisent ni l’adresse ni la position
    ok 1 - salles : chercher un mot de l’adresse ne retrouve pas la salle
    ok 2 - établissements : chercher un mot de l’adresse ne retrouve pas l’établissement
    ok 1 - GET /api/halls et /api/halls/[id]
    ok 2 - GET /api/tables, /api/tables/[id], /api/restaurants/[id]/tables
    ok 1 - salle : en attente de paiement = pas d’adresse ; autre cliente = rien ; confirmée = adresse
    ok 2 - table : acompte à payer = pas d’adresse ; confirmée = adresse ; annulée = plus d’adresse
# pass 8
# fail 0

run 653 — tests/parcours/cb3-carte-lieux.test.ts
ok 1 - A — seuls les lieux publics sont sur la carte                     (3 sous-tests)
ok 2 - B — aucun champ en trop, rien de la partenaire, jamais d’adresse  (3)
ok 3 - C — zone d’un particulier : fixe, autour du vrai point, jamais lui (6, dont 200 tirages entre 80 et 220 m)
ok 4 - D — route publique                                                (2)
ok 5 - E — disponibilité                                                 (1)
# tests 15
# pass 15

run 657 — e2e/carte-b3.responsive.spec.ts (job responsive)
[carte-b3] salle validée visible sur la carte après 18 ms
[carte-b3] centre de la zone à 163.6 m du vrai point
[carte-b3] salle suspendue retirée de la carte après 13 ms
  ✓ … salle de particulier validée : sur la carte en moins de 5 s, zone et jamais le point ; suspendue : retirée en moins de 5 s
  ✓ … captures · clair › couches, repères des trois types, zone d’un particulier, feuille du téléphone (360 px)
  ✓ … captures · clair › liste de l’ordinateur et survol d’un lieu (1 440 px)
  ✓ … captures · clair › fiches : zone d’un particulier, point d’un lieu professionnel (360 et 1 440 px)
  ✓ … (les trois mêmes en sombre)
  229 passed (17.5m)
Contrôle responsive : 190 résultat(s) (page × thème), 0 défaut(s) bloquant(s).
```
(Run 654 : mêmes preuves, 20 ms / 19 ms, zone à 203,3 m.)

Invalidation : chaque décision de l'administration et chaque écriture de la partenaire vident l'étiquette `lieux-publics`
(liste au § 2.2) ; le run 657 mesure 18 ms entre la validation et la présence sur la carte, 13 ms entre la suspension et
le retrait (limite : 5 s). Les tests de la base (`cb3-carte-lieux` A) prouvent la règle de la lecture elle-même (retrait
à la lecture suivante après suspension, retrait, partenaire suspendue).

## 4. Runs

| Run | Commit | Contenu | Résultat |
|---|---|---|---|
| 652 | `db8986c5ab` | tests seuls (preuve des failles) | `cb3-adresse-particuliers` 8/8 rouges, chacun pour sa raison |
| 653 | `6e1bbc6e8b` | rapide : migration + serveur, 89 suites (toutes celles qui citent `halls`, `venues`, les recherches, le middleware, les avis, les privilèges des fonctions, `tests/audit` concernés) | **89/89 vertes** (typecheck, lint OK) |
| 654 | `90038c5c5a` | rapide (46 suites des écrans) + responsive | rapide 46/46 ; responsive **0 défaut** ; e2e 225/226 : seul rouge, le test des fiches (élément détaché pendant le défilement), corrigé |
| 657 | `1a06bac145` | rapide (7 suites) + responsive | **entièrement vert** : 229 e2e, responsive 0 défaut |
<!-- RUN_COMPLET -->

## 5. Poids JS et mesure mobile

<!-- POIDS -->

## 6. Captures (clair et sombre)

Publiées sur `ci-results`, `runs/657-45617083800/…/captures-responsive/` (relues) :

| Écran | Clair | Sombre |
|---|---|---|
| Couches et repères des trois types (Thiès : salle de particulier en pointillé avec sa zone, salle professionnelle, pastilles « Salles · 2 ») | `cb3-couches-reperes__360__clair.jpg` | `cb3-couches-reperes__360__sombre.jpg` |
| Zone d'un particulier et repère d'un restaurant (couverts, pointillé, cercle) | `cb3-repere-restaurant__360__clair.jpg` | `cb3-repere-restaurant__360__sombre.jpg` |
| Feuille du téléphone (photos, prix, capacité, « Adresse exacte après réservation », « Voir la salle ») | `cb3-feuille-lieu__360__clair.jpg` | `cb3-feuille-lieu__360__sombre.jpg` |
| Liste de l'ordinateur par couche, survol = repère mis en avant, « Ouvert maintenant · ferme à 2 h » | `cb3-liste-ordinateur__1440__clair.jpg` | `cb3-liste-ordinateur__1440__sombre.jpg` |
| Fiche d'une salle de particulier (« Quartier », cercle, aucun itinéraire) | `cb3-fiche-salle-particulier__{360,1440}__clair.jpg` | `…__sombre.jpg` |
| Fiche d'un restaurant de particulier | `cb3-fiche-restaurant-particulier__{360,1440}__clair.jpg` | `…__sombre.jpg` |
| Fiche d'une salle professionnelle (adresse, repère, « Voir l'itinéraire ») | `cb3-fiche-salle-pro__{360,1440}__clair.jpg` | `…__sombre.jpg` |

Relecture des captures du run 654 : sur le téléphone, les filtres des couches poussaient la carte hors de l'écran →
repliés derrière « Filtrer les salles et les restaurants » (run 657). Tests et captures de la carte B (`cb-*`) toujours verts
(services fermés pendant ces tests).

## 7. Tests modifiés

| Fichier | Modification | Raison |
|---|---|---|
| `e2e/carte-b.responsive.spec.ts`, `e2e/cvcb.responsive.spec.ts` | `test.beforeEach` : verrou des services, groupe « autres » (une ligne) ; **aucune assertion changée** | La carte d'Explorer dépend maintenant des interrupteurs des services ; ces tests doivent tourner interrupteurs à leur valeur d'origine (fermés), jamais pendant un test des services (sinon les couches Salles et Restaurants apparaissent et le nom de la région change). |
| `tests/helpers/design-files.ts` | ajout de `MapLayers.tsx`, `MapPlaceCard.tsx`, `PlaceMap.tsx` | Nouveaux écrans soumis aux règles du système de design (contrat Q). |

Aucun fichier de `tests/audit/` ni de `tests/audit-auth/` n'a été modifié ; `tests/audit/cvcb-2-gardes.test.ts` (règles
de la carte B : aucune lecture directe, « Autour de moi », champs publics) passe sans changement (runs 653, 654, 657).
`tests/schema/carte-b-ecrans.test.ts` passe sans changement (le code de la carte garde les formes qu'il vérifie).

## 8. Essais pour un non-développeur

Sur un environnement de recette où la migration est appliquée, services des salles et des tables ouverts par le
Superadmin (Administration › Réglages › Services).

1. **Particulier par défaut.** Compte partenaire › Salles › Ajouter : la question « Qui accueille ? » propose « Chez un
   particulier » (déjà coché) et « Lieu professionnel ». Placez le repère sur votre maison, enregistrez, faites valider la
   salle par l'administration.
2. **La carte ne montre qu'une zone.** Sans être connecté : Explorer › Carte. Les boutons « Événements », « Salles »,
   « Restaurants » apparaissent avec leur nombre. Approchez-vous de votre salle : un repère en forme de bâtiment, au bord en
   pointillé, et un cercle orange en pointillé d'environ 300 m. Le repère n'est PAS sur votre maison (il est décalé de 80
   à 220 m) ; rechargez la page plusieurs fois : il reste au même endroit.
3. **La fiche ne donne pas l'adresse.** Touchez le repère : la feuille montre les photos (glissez-les), le prix par jour et
   « Adresse exacte après réservation ». « Voir la salle » : la fiche montre le quartier, la phrase « Salle chez un
   particulier : l'adresse exacte vous est donnée dès que votre réservation est confirmée », un cercle sur la petite carte,
   et aucun bouton « Voir l'itinéraire ».
4. **L'adresse arrive à la confirmation.** Avec un compte client, réservez : tant que l'acompte n'est pas payé, l'écran de
   la réservation dit « L'adresse exacte vous sera donnée dès que votre réservation sera confirmée. ». Payez l'acompte :
   l'adresse et « Voir l'itinéraire » apparaissent, et l'avis « Réservation confirmée » (application, email) se termine par
   « Adresse : … ». Annulez : l'adresse disparaît de l'écran.
5. **Une autre cliente ne voit rien.** Avec un deuxième compte client, ouvrez le lien de la réservation de la première :
   « introuvable ».
6. **Lieu professionnel.** Modifiez la salle : « Lieu professionnel ». Sur la carte, le bâtiment a un trait plein, sans
   cercle, à l'endroit exact ; la fiche montre l'adresse et « Voir l'itinéraire ».
7. **Disparition en moins de 5 secondes.** Administration › Salles : suspendez la salle (motif). Rechargez la carte : elle
   n'y est plus. Réactivez : elle revient.
8. **Couches.** Sur la carte, touchez « Salles » : les bâtiments disparaissent et l'adresse de la page garde
   `couches=evenements,restaurants` (partagez-la : la même carte s'ouvre). Fermez le service des salles (Réglages) : le
   bouton « Salles » n'est plus proposé.
9. **Filtres.** Couche « Restaurants » : choisissez une date, une heure et un nombre de personnes : seuls les
   établissements qui ont une table libre restent. Rien dans la zone : un dessin, « Rien à afficher dans cette zone » et
   « Élargir la zone ».

