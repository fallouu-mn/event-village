# Lot Carte B3 — salles et restaurants sur la carte, lieux publics, position obligatoire

Branche `carte-b3/lieux` (depuis `main` 76e09fb733), worktree `event-village-carteb3`. Non fusionnée ; migration
`20261210000001` **non appliquée** : une contre-vérification indépendante suit.

## À lire en premier

**Deux décisions du client du 25/11 ont changé le lot en cours de route.**

1. **L'application est entièrement publique.** Plus de zone approximative de 300 m ni de distinction particulier /
   professionnel : toutes les salles et tous les établissements validés sont montrés à leur position exacte, avec
   l'adresse et « Voir l'itinéraire » sur leur fiche, pour tout le monde. Tout ce que le lot avait construit pour la
   décision du 21/11 (zone stockée et décalée, champ « Qui accueille ? », adresse cachée jusqu'à la confirmation,
   adresse ajoutée aux avis de confirmation) est **retiré** ; la migration, appliquée nulle part, a été réécrite sans ces
   parties (aucune suppression ajoutée). Les recherches, fiches, écrans de réservation et avis reviennent exactement à
   l'état de `main`.
2. **La position exacte est obligatoire pour ce qui est publié** (événement, salle, établissement) : refus en base à
   l'envoi en validation et à la validation par l'administration, position exigée dans les formulaires, bandeau pour ce
   qui est déjà publié sans position (qui reste en ligne).

**Ce qui reste des failles du lot.** F1 est **gardée** : `address`, `latitude`, `longitude` des salles et des
établissements ne sont plus lisibles par la REST (clé anon, jeton d'une cliente) ; tout passe par les routes du serveur,
colonne par colonne. La règle « rien de la partenaire (nom légal, téléphone, adresse électronique, pièces) dans les
réponses publiques » est gardée et testée sur toutes les lectures publiques des lieux. F2 (recherche sur l'adresse),
F3 (adresse et point sur les routes publiques) et F4 (adresse sur l'écran de réservation) **ne sont plus des failles**
(décision du 25/11) : leurs tests vérifient maintenant que ces données sont rendues (§ 3).

<!-- VERDICT -->

## 1. Étape 0 (avant de coder) et ce qu'elle devient

Constat d'origine (run 652, tests seuls, `db8986c5ab`, 8/8 rouges) : l'adresse et la position exactes d'une salle ou d'un
établissement validé étaient lisibles par la REST (F1), comparées au texte cherché (F2), rendues par les routes publiques
et la fiche (F3), et données sur l'écran de réservation dès la réservation (F4). Avec la décision du 25/11, seul F1
reste un défaut : l'adresse est publique, mais elle sort par les routes du serveur, pas par une lecture directe de la
table.

| Endroit | `main` | Ce lot |
|---|---|---|
| REST `halls` | toutes les colonnes (droits par défaut, règle `halls_read_public`) | colonnes choisies, **sans** `address`, `latitude`, `longitude` (F1) |
| REST `venues` | `address, latitude, longitude` dans `GRANT SELECT (…)` (`20261129000009…:54-58`) | même liste **sans** ces trois colonnes (F1) |
| Recherche (`hall_search`, `venue_search`) | adresse comparée et rendue | inchangée (décision du 25/11 : recherche par l'adresse et le quartier ; il n'existe pas de colonne « quartier », le quartier fait partie de l'adresse) |
| Fiches, `/api/restaurants/[id]/tables` | adresse, point exact, « Voir l'itinéraire » | inchangés |
| Écran de réservation | adresse dans tous les états | inchangé |

**Position avant ce lot.** Événements : la finition 2a exigeait déjà la position à la soumission
(`event_transition`, `POSITION_REQUIRED`) et interdisait de la retirer après validation ; rien n'empêchait
l'administration de valider un événement en attente qui l'avait perdue. Salles : `hall_submit` (renvoi d'une salle
refusée) la comptait parmi les manques ; la création (route) ne l'exigeait pas côté serveur ; une salle insérée sans
position pouvait être validée. Établissements : position « conseillée » dans le formulaire, exigée nulle part.

**Interrupteurs.** `features.halls_enabled` (salles) et `features.tables_enabled` (établissements), lus à chaque requête
(`lib/features/flags.ts`). Une couche dont le service est fermé n'est pas proposée sur la carte (pastille absente,
`GET /api/lieux/carte?couche=…` en 404 comme les autres lectures publiques des services) ; Événements toujours proposés.
Fermés par défaut : en production, la carte reste celle des événements tant que l'administration n'ouvre rien.

## 2. Ce qui a été fait

### 2.1 Base (`supabase/migrations/20261210000001_cb3_lieux_publics.sql`, rejouable, sans BEGIN ni COMMIT)

1. **REST (F1)** : `address`, `latitude`, `longitude` retirées des colonnes lisibles par `anon` et `authenticated` sur
   `halls` et `venues`. Aucun écran ne lit ces tables par le navigateur.
2. **Envoi en validation refusé sans position**, avec la phrase du client « Placez votre lieu sur la carte avant
   d'envoyer. » (code `POSITION_REQUIRED`) :
   - `venue_create` (la création d'un établissement est son envoi en validation) : refus en dernier contrôle, toute la
     création est annulée ;
   - `hall_submit`, `venue_submit` (renvoi d'un lieu refusé) : position seule manquante = la phrase seule ; avec d'autres
     manques, « la position sur la carte » est nommée dans la liste ;
   - `event_transition` (brouillon → en attente) : le refus de la finition 2a garde son code, avec la phrase du client ;
   - création d'une salle : il n'existe pas de fonction en base (insertion par le service) ; la route la refuse
     (`HallService.createHall`, après les contrôles du nom, de la capacité, du statut de la partenaire et des photos) ;
   - `halls_validation_guard`, `venues_validation_guard` : un lieu inséré sans position n'est **jamais validé d'office**,
     même quand la validation n'est pas exigée (réglages `halls.validation_required`, `tables.validation_required`) : il
     attend en validation.
3. **Validation refusée sans position** (`POSITION_REQUIRED`) : `hall_validation_decide` et `venue_validation_decide`
   (décision VALIDER ; une RÉACTIVATION de ce qui était déjà publié reste possible), `event_transition`
   (EN_ATTENTE → VALIDE par l'administration).
4. Recopies (8 fonctions, chaque fois la **dernière** définition, fichier et lignes cités en tête de la migration) :
   `halls_validation_guard` (`20261126000006…:20-51`), `hall_submit` (`20261126000006…:54-110`),
   `venues_validation_guard` (`20261129000001…:77-112`), `venue_create` (`…:155-256`), `venue_submit` (`…:261-314`),
   `hall_validation_decide` (`20261126000001…:20-93`), `venue_validation_decide` (`…:99-168`), `event_transition`
   (`20261116000003…:826-983`). Test « aucune ligne perdue » : 5 lignes remplacées en tout, listées dans
   `tests/schema/migration-carte-b3-rejouable.test.ts`. **Aucune des trois fonctions recopiées par la session 11c-a**
   (`event_update`, `ticket_category_create`, `ticket_category_update`) n'est touchée (test dédié), et la 11c-a ne touche
   aucune des huit fonctions ci-dessus.

### 2.2 Serveur

- `GET /api/lieux/carte` (public, `middleware.ts`) : `couche=salles|restaurants`, zone, filtres (salle : date, jours,
  invités ; restaurant : date, heure, personnes). Colonnes choisies une à une (ni adresse, ni rien de la partenaire hormis
  son statut, lu pour la condition de visibilité), copie champ par champ (`PUBLIC_PLACE_FIELDS` : id, type, name, area,
  photos, price, capacity, lat, lng, hours), position exacte, 300 au plus. Cache de 60 s sous l'étiquette
  `lieux-publics`. Disponibilité par les recherches des lots 10b et 11b (sans cache).
- Invalidation immédiate (`lib/lieux/cache-lieux.server.ts`) : décisions de l'administration (valider, refuser,
  suspendre, réactiver) sur les salles et les établissements, création, modification (nom, prix, photos, position,
  horaires, retrait), suppression, renvoi en validation, tables (places), statut de la partenaire.
- Position jamais retirée par les routes de la partenaire : `PUT /api/partner/halls/[id]` et
  `PATCH /api/partner/venues/[id]` refusent une position vide (400 `POSITION_REQUIRED`, « La position de votre lieu sur
  la carte est obligatoire : déplacez le repère si le lieu change. »). Pour un événement, c'était déjà le cas depuis la
  finition 2a après la validation.
- Pilotage d'un événement : `GET /api/partner/events/[id]/pilotage/overview` ajoute `has_position` (lu après la fonction
  `pilotage_overview`, qui a déjà refusé tout autre que la propriétaire ou l'administration).
- Codes : `POSITION_REQUIRED` rendu en 400 par les routes des salles et des établissements.

### 2.3 Écrans (skill `ui-ux-pro-max` invoqué au début du lot)

- Carte d'Explorer (`components/explore/ExploreMap.tsx`, module chargé à l'ouverture de la carte) : pastilles Événements,
  Salles, Restaurants (boutons à bascule, icône, nombre dans la zone « Salles · 12 »), gardées dans l'adresse
  (`couches=`) ; filtres propres à chaque couche ; repères distincts par la forme (billet, bâtiment avec « Dès 150 000
  F/jour », couverts avec le nom), chacun à sa position exacte ; nom accessible complet ; regroupements mixtes ; un
  regroupement qui cache le lieu survolé ou choisi s'allume à sa place (run 658) ; feuille du téléphone (photos qui
  glissent, « Ouvert maintenant · ferme à 23 h », lien vers la fiche) ; liste de l'ordinateur par couche ; état vide
  illustré « Élargir la zone ».
- Fiches des salles et des établissements, écrans de réservation : ceux de `main` (adresse, carte au point exact,
  « Voir l'itinéraire »).
- Formulaires (salle, établissement, événement) : à côté de l'adresse, « L'adresse et la position de votre lieu seront
  visibles par tous sur la carte et sur sa fiche. » ; position sur la carte obligatoire, erreur à côté de la carte (salle
  et événement : déjà le cas ; établissement : passe de « conseillée » à obligatoire, « Placez votre lieu sur la carte
  avant d'envoyer. »).
- Bandeaux de la position manquante (ton « attention », bouton « Placer sur la carte » vers le formulaire) : pilotage
  d'un événement envoyé ou publié sans position (« Ajoutez la position de votre événement pour qu'il apparaisse sur la
  carte », étape Accès) ; fiche d'une salle (« Ajoutez la position de votre salle pour qu'elle apparaisse sur la
  carte ») ; planning d'un établissement (« Ajoutez la position de votre établissement pour qu'il apparaisse sur la
  carte »). Chacun rappelle que l'élément reste visible dans sa liste et par son lien.

### 2.4 Éléments déjà publiés sans position (point 3 de la consigne)

| Source | Événements | Salles | Établissements |
|---|---|---|---|
| Base de test (fixtures `tests/helpers/fixture-data.ts`, insérées par `tests/seed/seed-test.ts`) | 6, tous avec une position (même point de Dakar, écrit sans condition) | aucune | aucun |
| Seed de démonstration (`tests/seed/seed-demo.ts`) | 23, tous avec une position | 3, toutes avec une position | 4, tous avec une position |
| `supabase/seed.sql` | aucun | aucune | aucun |

**Aucun** élément des fixtures ni du seed n'est donc concerné (la position y est un champ obligatoire du type des
données). Les éléments sans position n'existent que dans les tests qui en créent volontairement. La base
`event-village-dev` n'a pas été lue par ce lot.

## 3. Tests

| Suite | Ce qu'elle prouve |
|---|---|
| `tests/security/cb3-lieux-publics.test.ts` (renommée, ex-`cb3-adresse-particuliers`) | F1 gardée : REST anon et cliente connectée, ni adresse ni position, sur `halls` et `venues`. Décision du 25/11 : recherche par un mot de l'adresse **et** par le quartier (salle et établissement retrouvés) ; fiches, `/api/restaurants/[id]/tables`, recherches et carte : adresse et point exacts ; écran de réservation : adresse dès la réservation en attente de paiement, rien pour une autre cliente. Règle gardée : ni nom légal, ni téléphone, ni adresse électronique, ni champ de pièces de la partenaire dans les sept lectures publiques. |
| `tests/parcours/cb3-position-obligatoire.test.ts` (nouvelle) | A. envoi sans position refusé avec la phrase du client : salle et établissement créés par la route (rien d'écrit, la création de l'établissement est annulée en entier), renvoi d'une salle et d'un établissement refusés (fonction et route ; avec d'autres manques, la position est nommée), soumission d'un événement ; avec la position : accepté. B. inséré sans position, validation non exigée : jamais validé d'office (salle, établissement) ; avec position : validé. C. l'administration ne valide ni une salle, ni un établissement, ni un événement sans position ; une suspension puis une réactivation de ce qui était publié sans position restent possibles. D. une position ne se retire pas par les routes de la partenaire. E. `has_position` du pilotage (bandeau). |
| `tests/parcours/cb3-carte-lieux.test.ts` | lieux publics seulement (attente, refusé, suspendu, retiré, sans position, partenaire suspendue : jamais), retrait à la lecture suivante ; 0 champ en trop, rien de la partenaire ; **position exacte**, la même à chaque lecture, position déplacée rendue telle quelle ; 400 / 404 ; disponibilité. |
| `tests/schema/migration-carte-b3-rejouable.test.ts` | migration rejouable deux fois, sans BEGIN/COMMIT, après les lots précédents ; 8 recopies sans ligne perdue (5 lignes remplacées, listées) ; lignes citées = dernière définition ; aucune recopie des fonctions de la 11c-a. |
| `tests/schema/carte-b3-ecrans.test.ts` | contrat public, « Ouvert maintenant », grille T1, colonnes lues par la carte ; **aucune trace** de zone ou de particulier dans `app/`, `components/`, `lib/` ; fiches avec carte au point exact et itinéraire ; textes du client mot pour mot ; phrase des trois formulaires ; position exigée ; services ; bandeaux. Poste : 23/23. |
| `e2e/carte-b3.responsive.spec.ts` | **invalidation gardée** : salle validée sur la carte en moins de 5 s, suspendue retirée en moins de 5 s ; point exact sur la carte ; fiche servie à un visiteur sans cookie : adresse et itinéraire vers le point exact ; recherche par un mot de l'adresse ; rien de la partenaire ; couches dans l'adresse ; survol d'un lieu regroupé ; captures. |

<!-- SORTIES -->

## 4. Runs

| Run | Commit | Contenu | Résultat |
|---|---|---|---|
| 652 | `db8986c5ab` | tests seuls (preuve des failles, décision du 21/11) | `cb3-adresse-particuliers` 8/8 rouges, chacun pour sa raison |
| 653 | `6e1bbc6e8b` | rapide : migration + serveur (décision du 21/11), 89 suites | 89/89 vertes |
| 654 | `90038c5c5a` | rapide (46 suites des écrans) + responsive | rapide 46/46 ; responsive 0 défaut ; e2e 225/226 (fiches : élément détaché pendant le défilement), corrigé |
| 657 | `1a06bac145` | rapide (7 suites) + responsive | entièrement vert |
| 658 | `e4ddfcc601` | **complet** (décision du 21/11) | tests 4 lots, build, budgets, e2e complet verts ; responsive 0 défaut mais 1 test rouge (survol d'un lieu caché dans un regroupement, sombre) ; mesure mobile **faussée** (machine trop rapide aux 3 tentatives) |
| 661 | `e0cf98af8b` | **complet** (décision du 21/11 + regroupement allumé) | **entièrement vert** : tests, build, budgets, e2e, responsive 229/229 et 0 défaut ; mesure mobile **valide** dès la 1re tentative : accueil 95, fiche 95, Mes billets 96 |
<!-- RUN_COMPLET -->

## 5. Poids JS et mesure mobile

<!-- POIDS -->

## 6. Captures (clair et sombre)

<!-- CAPTURES -->

## 7. Tests modifiés (décision du client du 25/11 : lieux publics, position obligatoire)

| Fichier | Modification | Raison |
|---|---|---|
| `tests/security/cb3-adresse-particuliers.test.ts` → `cb3-lieux-publics.test.ts` | F2, F3, F4 inversés (l'adresse et le point DOIVENT être rendus) ; F1 gardé ; règle de la partenaire étendue aux sept lectures publiques | décision du 25/11 : adresse et position publiques |
| `tests/parcours/cb3-carte-lieux.test.ts` | bloc C (zone de 300 m, tirages, écriture de la zone) remplacé par « position exacte pour tous » ; plus de salle « professionnelle » ; la salle « sans position » est validée avec une position puis la perd (une salle sans position ne peut plus être validée) | décision du 25/11 (les deux) |
| `tests/schema/carte-b3-ecrans.test.ts`, `tests/schema/migration-carte-b3-rejouable.test.ts` | réécrits pour la nouvelle migration et les nouveaux écrans | décision du 25/11 (les deux) |
| `e2e/carte-b3.responsive.spec.ts` | preuves de la zone remplacées par celles du point exact, de l'adresse et de l'itinéraire publics ; invalidation (< 5 s) gardée telle quelle ; captures renommées (`fiche-salle`, `fiche-restaurant`) | décision du 25/11 : application publique |
| `tests/parcours/l10a-helpers.ts` (`newHall`), `tests/parcours/l11a-helpers.ts` (`newVenue`), `tests/helpers/table-fixtures.ts` | position par défaut (Dakar) ; `position: null` pour un lieu sans position | décision du 25/11 : l'administration ne valide plus un lieu sans position ; ces aides valident leurs lieux (elles servent aussi aux suites d'audit, qui ne sont pas modifiées) |
| `tests/parcours/finance-cibles`, `interrupteurs`, `l10b-salles` (établissement), `lot9quinquies-cv-salles`, `tests/partner-halls-m7`, `tests/ux-performance-and-double-click` | position ajoutée aux lieux insérés puis validés ; **aucune assertion changée** | même raison |
| `tests/parcours/l10b-salles.test.ts` (salles créées par la route) | position dans le corps des créations ; avant le test du renvoi incomplet, la position est retirée par la clé de service (salle d'avant la décision) : l'assertion « une photo au moins… la position sur la carte » est inchangée | décision du 25/11 : la route refuse une salle sans position et ne retire plus une position |
| `tests/parcours/l11b-tables.test.ts` (création par la route) | position dans le corps ; aucune assertion changée | décision du 25/11 : `venue_create` refuse sans position |
| `tests/helpers/design-files.ts` | `components/lieux/PlaceMap.tsx` retiré de la liste (fichier supprimé) | décision du 25/11 : plus de petite carte de zone |

Aucun fichier de `tests/audit/` ni de `tests/audit-auth/` n'a été modifié. Les suites d'audit qui créent des lieux sans
position par la route ou en base restent compatibles : un refus de création leur suffit (`cv10a-4`, `cv11a-1`,
`cv11b-2`), et l'insertion directe sans position reste acceptée (en attente : `cv11a-4`, `cvf2a-2`) ; c'est la raison du
choix « jamais validé d'office » plutôt qu'un refus à l'insertion (§ 9).

## 8. Essais pour un non-développeur

Sur un environnement de recette où la migration est appliquée, services des salles et des tables ouverts par le
Superadmin (Administration › Réglages › Services).

1. **Tout est public.** Sans être connecté : Explorer › Carte. Les boutons « Événements », « Salles », « Restaurants »
   apparaissent avec leur nombre. Chaque salle (bâtiment) et chaque restaurant (couverts) est à son adresse exacte.
   Touchez un repère : photos, prix, « Voir la salle ». La fiche montre l'adresse, la petite carte au bon endroit et
   « Voir l'itinéraire ».
2. **Recherche par le quartier.** Salles › recherche : tapez le nom d'un quartier écrit dans l'adresse d'une salle (par
   exemple « Mermoz ») : la salle apparaît. Même chose dans Restaurants.
3. **La phrase des formulaires.** Compte partenaire › Salles › Ajouter : sous l'adresse, « L'adresse et la position de
   votre lieu seront visibles par tous sur la carte et sur sa fiche. ». Même phrase pour un établissement et pour un
   événement (étape Accès).
4. **Position obligatoire.** Enregistrez une salle sans toucher la carte : l'erreur s'affiche à côté de la carte, rien
   n'est envoyé. Même chose pour un établissement. Pour un événement : « Soumettre » sans repère est refusé avec
   « Placez votre lieu sur la carte avant d'envoyer. ».
5. **L'administration ne valide pas sans position.** (Lieu déjà en attente sans position, s'il en existe.) Administration ›
   Salles › Valider : « La salle n'a pas de position sur la carte : la partenaire doit la placer avant la validation. ».
6. **Bandeau.** Un événement, une salle ou un établissement déjà en ligne sans position : la partenaire voit en haut de
   son pilotage (ou de sa fiche) « Ajoutez la position de votre … pour qu'il apparaisse sur la carte » et « Placer sur la
   carte ». L'élément reste en ligne (liste, lien) ; une fois placé, il apparaît sur la carte.
7. **Disparition en moins de 5 secondes.** Administration › Salles : suspendez une salle (motif). Rechargez la carte : elle
   n'y est plus. Réactivez : elle revient.
8. **Couches.** Sur la carte, touchez « Salles » : les bâtiments disparaissent et l'adresse de la page garde
   `couches=evenements,restaurants` (partagez-la : la même carte s'ouvre). Fermez le service des salles (Réglages) : le
   bouton « Salles » n'est plus proposé.
9. **Filtres.** Couche « Restaurants » : choisissez une date, une heure et un nombre de personnes : seuls les
   établissements qui ont une table libre restent. Rien dans la zone : un dessin, « Rien à afficher dans cette zone » et
   « Élargir la zone ».

## 9. Points ouverts

- **Salle insérée directement en base sans position** : acceptée (en attente, jamais validée d'office, l'administration
  ne peut pas la valider). Un refus à l'insertion casserait des suites d'audit qui insèrent des lieux sans position
  (`cvf2a-2` pour une salle, `cv11a-4` pour un établissement). Aucun écran n'insère ainsi : la route de la partenaire
  refuse.
- **Éléments déjà publiés sans position** : restent en ligne, hors de la carte, avec le bandeau ; aucun rappel par
  message (`docs/apres-lancement.md`).
- Refus de validation sans position : rendu en 422 par la route des transitions d'un événement (code déjà connu de la
  finition 2a) ; en 409 par la route de décision d'une salle ou d'un établissement, comme les autres refus de décision.
