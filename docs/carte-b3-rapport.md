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

**Verdict.** Run complet 665 (`31e8cec880`) : build, budgets, e2e (787 captures, 0 en échec), responsive (190
résultats, 0 défaut ; tests du lot verts) et mesure mobile **valide** (93 / 94 / 93, 1re tentative) ; tests : 3 suites
anciennes rouges (une dans chacun des lots 1, 2 et 4 ; lot 3 vert), toutes dues à la position obligatoire (§ 4). Corrigées sans changer une assertion, puis run
rapide 669 (`660d741d78`) **vert** : les 3 suites, `messages-bruts` et les 5 suites du lot, typecheck et lint. Aucun
fichier de `tests/audit/` ni de `tests/audit-auth/` modifié. Branche non fusionnée, migration non appliquée.

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

**Sorties brutes du run rapide 669** (`runs/669-45675171702/verify.log`) :

```
tests/schema/recette-matrice.test.ts               PASS     552ms     0
tests/parcours/interrupteurs.test.ts               PASS     4.2s      0
tests/parcours/f2acv-stockage-cite.test.ts         PASS     2.5s      0
tests/partner-halls-m7.test.ts                     PASS     1.8s      0
tests/parcours/messages-bruts.test.ts              PASS     2.8s      0
tests/parcours/cb3-position-obligatoire.test.ts    PASS     1.7s      0
tests/security/cb3-lieux-publics.test.ts           PASS     1.7s      0
tests/parcours/cb3-carte-lieux.test.ts             PASS     1.7s      0
tests/schema/migration-carte-b3-rejouable.test.ts  PASS     791ms     0
tests/schema/carte-b3-ecrans.test.ts               PASS     561ms     0
TOTAL : 10 suite(s) — 10 réussie(s), 0 en échec, 0 expirée(s)
typecheck  OK     code 0   44 s
lint       OK     code 0   14 s
```

```
== cb3-position-obligatoire
    ok 1 - salle créée par la route : refusée sans position, rien créé ; acceptée avec
    ok 2 - établissement créé par la route (venue_create) : refusé sans position, rien créé ; accepté avec
    ok 3 - renvoi d’une salle refusée (hall_submit) : position seule manquante = refus simple ; placée = en attente
    ok 4 - renvoi d’un établissement refusé (venue_submit) : position seule manquante = refus simple ; avec d’autres manques, elle est nommée
    ok 5 - événement : soumission sans position refusée avec la phrase seule ; placée = en attente
ok 1 - A — envoi en validation sans position refusé (phrase du client)
    ok 1 - halls : validation non exigée, insertion sans position → en attente ; avec position → validé
    ok 2 - venues : validation non exigée, insertion sans position → en attente ; avec position → validé
ok 2 - B — inséré sans position : jamais validé d’office
    ok 1 - salle : VALIDER refusé, puis accepté une fois placée ; route de l’administration aussi
    ok 2 - établissement : VALIDER refusé, puis accepté une fois placé
    ok 3 - déjà publié sans position : suspension puis RÉACTIVATION acceptées (reste en ligne)
    ok 4 - événement : EN_ATTENTE → VALIDE refusé sans position, accepté une fois placé
ok 3 - C — l’administration ne valide jamais un dossier sans position
    ok 1 - salle (PUT) et établissement (PATCH) : 400 POSITION_REQUIRED, position gardée
ok 4 - D — une position ne se retire pas par les routes de la partenaire
    ok 1 - événement publié sans position : has_position false ; placé : true
ok 5 - E — pilotage : bandeau de la position manquante
== cb3-lieux-publics
    ok 1 - halls : visiteur et cliente connectée ne lisent ni l’adresse ni la position par la REST
    ok 2 - venues : visiteur et cliente connectée ne lisent ni l’adresse ni la position par la REST
ok 1 - F1 (gardée) — REST : adresse et position jamais lisibles directement
    ok 1 - « adresse » : salle et établissement retrouvés
    ok 2 - « quartier » : salle et établissement retrouvés
ok 2 - P1 — recherche publique : par l’adresse et par le quartier (décision du 25/11)
    ok 1 - GET /api/halls/[id] et la recherche des salles
    ok 2 - GET /api/tables/[id], /api/restaurants/[id]/tables et la recherche des établissements
    ok 3 - carte d’Explorer : point exact
ok 3 - P2 — routes publiques : adresse et point exacts pour tout le monde
    ok 1 - salle : en attente de paiement = adresse ; autre cliente = rien
    ok 2 - table : acompte à payer = adresse ; autre cliente = rien
ok 4 - P3 — écran de réservation : l’adresse dès la réservation ; une autre cliente ne lit rien
    ok 1 - recherches, fiches, tables, carte : ni nom légal, ni téléphone, ni adresse électronique, ni pièces
ok 5 - R (gardée) — rien de la partenaire dans les réponses publiques
== migration-carte-b3-rejouable
    ok 1 - les migrations du lot sont exactement celles-ci, après celles des lots précédents
    ok 2 - aucune recopie des fonctions de la session 11c-a (event_update, ticket_category_create, ticket_category_update)
    ok 3 - 20261210000001_cb3_lieux_publics.sql : sans BEGIN ni COMMIT, appliquée deux fois de plus sans erreur
    ok 4 - recopie de halls_validation_guard (20261210000001) : aucune ligne de la dernière définition précédente perdue
    ok 5 - recopie de hall_submit (20261210000001) : aucune ligne de la dernière définition précédente perdue
    ok 6 - recopie de venues_validation_guard (20261210000001) : aucune ligne de la dernière définition précédente perdue
    ok 7 - recopie de venue_create (20261210000001) : aucune ligne de la dernière définition précédente perdue
    ok 8 - recopie de venue_submit (20261210000001) : aucune ligne de la dernière définition précédente perdue
    ok 9 - recopie de hall_validation_decide (20261210000001) : aucune ligne de la dernière définition précédente perdue
    ok 10 - recopie de venue_validation_decide (20261210000001) : aucune ligne de la dernière définition précédente perdue
    ok 11 - recopie de event_transition (20261210000001) : aucune ligne de la dernière définition précédente perdue
    ok 12 - la tête de la migration cite le fichier et les lignes de chaque recopie
    ok 13 - les lignes citées sont bien la dernière définition précédente
```

`cb3-carte-lieux` (A à E, 12 sous-tests) et `carte-b3-ecrans` (7 blocs, 23 sous-tests) : tous `ok` (même journal).

**Responsive (run complet 665, `responsive.log`)** :

```
[carte-b3] salle validée visible sur la carte après 18 ms
[carte-b3] salle suspendue retirée de la carte après 13 ms
  ✓   12 [responsive] › e2e/carte-b3.responsive.spec.ts:81:9 › carte B3 · validation, lieu public, suspension › salle validée : sur la carte en moins de 5 s à son point exact, adresse et itinéraire publics ; suspendue : retirée en moins de 5 s (3.1s)
  ✓   15 [responsive] › … › carte B3 · captures · clair › couches, repères des trois types, feuille du téléphone (360 px) (5.1s)
  ✓   18 [responsive] › … › carte B3 · captures · clair › liste de l’ordinateur et survol d’un lieu (1 440 px) (3.1s)
  ✓   21 [responsive] › … › carte B3 · captures · clair › fiches : adresse, carte au point exact, « Voir l’itinéraire » (360 et 1 440 px) (8.3s)
  ✓   24 [responsive] › … › carte B3 · captures · sombre › couches, repères des trois types, feuille du téléphone (360 px) (19.9s)
  ✓   27 [responsive] › … › carte B3 · captures · sombre › liste de l’ordinateur et survol d’un lieu (1 440 px) (4.6s)
  ✓   30 [responsive] › … › carte B3 · captures · sombre › fiches : adresse, carte au point exact, « Voir l’itinéraire » (360 et 1 440 px) (8.4s)
Contrôle responsive : 190 résultat(s) (page × thème), 0 défaut(s) bloquant(s).
```

**Tests du run complet 665** (fin de chaque `jobs/tests-<n>/verify.log`) :

```
lot 1 : TOTAL : 152 suite(s) — 151 réussie(s), 1 en échec, 0 expirée(s)   (recette-matrice)
lot 2 : TOTAL : 152 suite(s) — 151 réussie(s), 1 en échec, 0 expirée(s)   (f2acv-stockage-cite)
lot 3 : vert (job_tests-3=resultat:success)
lot 4 : TOTAL : 151 suite(s) — 150 réussie(s), 1 en échec, 0 expirée(s)   (partner-halls-m7)
e2e : connexion OK · captures OK · emails OK · dev-page OK · fumee OK · terrain OK · pwa OK · deconnexion OK · connexion-course OK · fake-prod OK · perf OK · recette OK
[e2e] index des captures : .e2e-captures/captures/index.txt (787 entrée(s), 0 en échec)
```

## 4. Runs

| Run | Commit | Contenu | Résultat |
|---|---|---|---|
| 652 | `db8986c5ab` | tests seuls (preuve des failles, décision du 21/11) | `cb3-adresse-particuliers` 8/8 rouges, chacun pour sa raison |
| 653 | `6e1bbc6e8b` | rapide : migration + serveur (décision du 21/11), 89 suites | 89/89 vertes |
| 654 | `90038c5c5a` | rapide (46 suites des écrans) + responsive | rapide 46/46 ; responsive 0 défaut ; e2e 225/226 (fiches : élément détaché pendant le défilement), corrigé |
| 657 | `1a06bac145` | rapide (7 suites) + responsive | entièrement vert |
| 658 | `e4ddfcc601` | **complet** (décision du 21/11) | tests 4 lots, build, budgets, e2e complet verts ; responsive 0 défaut mais 1 test rouge (survol d'un lieu caché dans un regroupement, sombre) ; mesure mobile **faussée** (machine trop rapide aux 3 tentatives) |
| 661 | `e0cf98af8b` | **complet** (décision du 21/11 + regroupement allumé) | **entièrement vert** : tests, build, budgets, e2e, responsive 229/229 et 0 défaut ; mesure mobile **valide** dès la 1re tentative : accueil 95, fiche 95, Mes billets 96 |
| 665 | `31e8cec880` | **complet** (version finale : décisions du 25/11, poids corrigé) | build, budgets, e2e (787 captures, 0 en échec), responsive 190 résultats / 0 défaut (tests du lot verts), mesure **valide** dès la 1re tentative (93 / 94 / 93) ; tests : lot 3 vert, lots 1, 2 et 4 : **1 suite rouge chacun** (`recette-matrice`, `f2acv-stockage-cite`, `partner-halls-m7`), voir ci-dessous |
| 669 | `660d741d78` | rapide (10 suites) | **vert** : les 3 suites corrigées, `messages-bruts`, les 5 suites du lot, typecheck, lint |

**Les trois suites rouges du run 665**, toutes dues à la position obligatoire (décision du client du 25/11) :

- `tests/partner-halls-m7.test.ts` (lot 4) et `tests/parcours/f2acv-stockage-cite.test.ts` (lot 2) créent une salle par
  `HallService.createHall` sans position : `POSITION_REQUIRED` (« Placez votre lieu sur la carte avant d’envoyer. »).
  Correction : position ajoutée à l'appel ; assertions inchangées.
- `tests/schema/recette-matrice.test.ts` (lot 1) : « la ligne n'ouvre pas un test : tests/parcours/interrupteurs.test.ts:399 ».
  `docs/recette-billetterie.md` cite cette ligne ; les deux lignes ajoutées pour la position dans `interrupteurs` l'avaient
  décalée. Correction : la position est posée sur les lignes existantes (aucun décalage) ; le document n'est pas modifié.

## 5. Poids JS et mesure mobile

**Écart constaté au run 658 (budgets tous tenus)** : accueil +419, Explorer +86, fiche d'un événement +1 182 octets gzip
par rapport à `main` (run 646). Mesuré ici en local, module par module (`EV_ANALYSE_POIDS=1`, `scripts/poids-rapport.mjs`,
`main` 76e09fb733 et la branche construits sur le poste avec la même version de Next 15.5.28).

**Cause : aucun code nouveau au premier chargement, mais un regroupement de webpack qui a basculé.**
- `components/ui/cn-classes.ts` (table des classes de la fusion `cn`, chargée par toutes les pages) est calculée au
  build à partir de **toutes** les sources du projet. Les classes nouvelles des écrans du lot (pastilles des couches,
  vignette d'un lieu, dessin de l'état vide, icônes SVG) l'ont fait passer de 13 868 à 14 089 octets de source (+221).
- Dans `main`, webpack formait un morceau partagé `Button.tsx` (5 224) + `cn.ts` (5 924) + `cn-classes.ts` (13 868),
  chargé par toutes les pages. Avec +221, `cn.ts` et la table atteignent **seuls** 20 013 octets, au-delà du seuil de
  20 000 octets de webpack (`minSize`) : ils ont formé leur propre morceau, et `Button.tsx`, trop petit seul, a été
  **recopié dans chaque page** (doublon visible dans le relevé : `components/ui/Button.tsx [66269.js ; app/page.js]`).
- S'y ajoutait, pour Explorer, le petit code qui gardait `couches=` dans l'adresse quand un filtre change
  (`lib/events/explore-view.ts`, +350 octets de source).

**Corrections.**
1. `next.config.mjs` : règle de découpage `ui-base` (navigateur, construction seulement) qui garde `Button`, `cn` et la
   table dans UN morceau partagé, comme avant, quel que soit le seuil.
2. `couches=` : `lib/events/explore-view.ts` revient à `main` ; la carte (module chargé à l'ouverture de la vue Carte)
   remet les couches choisies dans l'adresse quand un filtre la change. **Les couches ne pèsent rien au premier
   chargement d'Explorer.**

| Route (octets gzip, poste) | `main` | branche avant | branche après | écart final |
|---|---|---|---|---|
| `/` (accueil) | 215 044 | 215 461 | 215 113 | +69 |
| `/events/[id]` (fiche) | 223 597 | 223 963 | 223 667 | +70 |
| `/tickets` (Mes billets) | 239 906 | 241 050 | 239 972 | +66 |
| `/controller/scanner` | 224 892 | 225 395 | 224 960 | +68 |
| `/billet/hors-ligne` | 214 052 | 214 557 | 214 115 | +63 |
| `/explore` | 225 565 | 225 659 | 225 630 | +65 |

Part propre de chaque route (hors code commun) après correction : identique à `main` à ±4 octets (Explorer : −1).
**Reste +63 à +70 octets gzip, tous dans le code commun : la table des classes** (+221 octets de source), qui grandit
avec toute classe Tailwind nouvelle du projet, chargée ou non. Ce n'est pas du code des couches ; le retirer demanderait
de réécrire les écrans du lot avec des classes déjà présentes ailleurs (19 classes : `aspect-[2/1]`, `bg-card/90`,
`scale-x-0`, `origin-center`, `fill-brand-vif/10`, `min-w-[8.5rem]`, …). Budgets (mesure du poste) : marge ≥ 9 649 octets sur chaque route (la plus juste : fiche d'un événement).

**Mesure CI (run complet 665, `31e8cec880`).** Budgets du build de la CI (`js-budget.tsv`, sortie brute) :

```
route	fichiers	octets_gzip	octets_bruts	budget	statut
/	17	215068	728629	226342	OK
/events/[id]	17	223645	757182	233316	OK
/tickets	20	239990	808320	250417	OK
/controller/scanner	16	224947	763783	234911	OK
/billet/hors-ligne	15	214066	730110	224268	OK
/explore	18	225578	758427	235712	OK
```

Écart avec `main` 76e09fb733 construit sur le poste (même commande, tableau ci-dessus) : +24 / +48 / +84 / +55 / +14 / +13 octets gzip ; les écarts annoncés au
départ (accueil +419, Explorer +86, fiche +1 182) ont disparu. Marge la plus juste : 9 671 octets (fiche d'un événement).

**Mesure mobile : valide, pas « faussée ».** Run 661 (version précédente) : valide dès la 1re tentative (95 / 95 / 96).
Run 665 (version finale), sortie brute de `perf-mobile.log` :

```
[perf-mobile] tentative 1 (208 s) : valide
  OK — score Lighthouse mobile : médiane 93 sur 5 passage(s) [95 ; 93 ; 93 ; 93 ; 95] (seuil ≥ 90)
  OK — score Lighthouse mobile : médiane 94 sur 5 passage(s) [96 ; 96 ; 94 ; 94 ; 93] (seuil ≥ 90)
  OK — score Lighthouse mobile : médiane 93 sur 5 passage(s) [95 ; 92 ; 93 ; 93 ; 93] (seuil ≥ 90)
  OK — réaction au toucher (mesure témoin : de l'appui à l'image qui suit le clic) : 90 ms (seuil < 200 ms)
Tentatives de la mesure Lighthouse (finition 5 : faussée si un tour sort de la plage, refaite 2 fois au plus ; journal perf/tentatives.tsv) :
  tentative 1 : valide
```

Accueil 93, fiche 94, Mes billets 93 (seuil 90), toucher 90 ms. La mesure « faussée » du run 658 (machine trop rapide
aux trois tentatives) ne s'est pas reproduite.

## 6. Captures (clair et sombre)

Run complet 665, `ci-results` : `runs/665-45654126829/captures-responsive/cb3-<écran>__<largeur>__<thème>.jpg`,
16 fichiers (8 écrans × clair et sombre) :

| Écran | Fichiers | Ce qu'on y voit |
|---|---|---|
| `couches-reperes` | 360 px | boutons « Événements · n », « Salles · n », « Restaurants · n » ; repères des salles (bâtiment, « Dès … F/jour ») à Thiès |
| `feuille-lieu` | 360 px | feuille du téléphone d'une salle : photo (ou dessin neutre), nom, « Salle · Thiès », prix, capacité, « Voir la salle » |
| `repere-restaurant` | 360 px | repère d'un établissement (couverts) |
| `liste-ordinateur` | 1 440 px | liste à côté de la carte, survol d'un lieu |
| `fiche-salle` | 360 et 1 440 px | « Adresse » en clair, petite carte avec le repère au point exact, « Voir l'itinéraire » |
| `fiche-restaurant` | 360 et 1 440 px | même chose pour un établissement, à côté du bloc « Réserver une table » |

Relues sur le poste (6 captures, clair et sombre) : aucune zone, aucun texte de zone, adresse et itinéraire visibles. Le
fond de carte est gris dans la CI (tuiles non chargées, comme aux lots Carte B et B2).

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
| `tests/parcours/f2acv-stockage-cite.test.ts`, `tests/partner-halls-m7.test.ts` (salles créées par `HallService.createHall`) | position dans l'appel (même ligne) ; aucune assertion changée (run 665) | décision du 25/11 : création d'une salle sans position refusée |
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
