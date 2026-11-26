# Lot 11c-c — Tables d'un événement : écrans de l'organisatrice, de la porte et de l'administration

Branche `lot11c/tables-organisatrice`, partie de `main` à `f0054b4893` (lot 11c-a fusionné). Worktree
`event-village-lot11cc`, `node_modules` en jonction vers la recette. Rien n'est fusionné, aucune migration n'est appliquée.

## À lire en premier

1. **Une migration, signalée : `20261215000001_l11cc_lectures_tables.sql`.** Elle était indispensable : aucune réponse du
   serveur ne disait, par table vendue, qui en est titulaire, combien de places sont envoyées et entrées, quelles tables ont
   été remboursées, ni pourquoi l'organisatrice ne peut pas modifier ses tables. La migration **ajoute deux fonctions de
   lecture** et ne recopie ni ne modifie aucune fonction, table, politique ou donnée :
   - `public.event_table_report(p)` : lecture de l'éditeur, du pilotage et de l'administration, avec l'accès du pilotage
     (`pilotage_access` : propriétaire, ou administration avec `events.read`). Une autre organisatrice, une cliente ou un
     contrôleur d'un autre événement reçoivent 404, comme pour un événement inconnu. Les titulaires sont donnés en prénom et
     initiale, jamais avec téléphone, courriel ni nom complet (test qui le vérifie).
   - `private.event_table_edit_refusal(événement, compte)` : les mêmes refus, dans le même ordre, que la garde des écritures
     (`event_table_refusal`, `ticket_category_guard`), mais sans verrou. Un test vérifie que le code lu par l'écran est celui
     que rend l'écriture dans trois cas : en attente de validation, service fermé, événement suspendu.
   - Aucun `BEGIN` ni `COMMIT`, rejouable (testé deux fois de plus dans une transaction annulée). Droits : la fonction
     publique au rôle de service seulement, l'aide de `private` à aucun rôle de l'API.
2. **Aucune faille trouvée** dans le périmètre. Deux défauts d'affichage hérités du lot 11c-a sont corrigés, détails en
   § « Défauts corrigés » :
   - les types de tables apparaissaient comme des catégories de billets, dans le formulaire de modification et sur la fiche
     de l'administration ;
   - le texte d'aide de la capacité était resté à l'ancienne règle.
3. **Tests existants modifiés (signalés)** :
   - `tests/security/r3-fonctions-rpc.test.ts` : `event_table_report` ajoutée à la liste du lot 11c-a (ajout seul) ;
   - `tests/parcours/evenements-verrous-ecran.test.ts` : textes attendus de la jauge mis à jour (même plancher, la règle
     compte les tables) ;
   - `tests/helpers/design-files.ts` et `e2e/support/responsive-pages.ts` : ajouts seulement.
   - `e2e/support/screens.ts` : la capture `admin-cloture-motif`, qui impose une fiche fictive, impose aussi la lecture des
     tables de cet événement (aucune table) ; détail en § « Tests existants modifiés ».

   Aucune assertion de `tests/audit/` ni de `tests/audit-auth/` n'est changée.
4. **Fichiers partagés avec les sessions parallèles** (la carte B3 en fusion, puis le lot 11c-b), touchés au plus juste :
   - `components/tables/plan/FloorPlan.tsx` : une prop facultative `labels`. Sans elle, le rendu reste celui du lot 11b.
   - `app/partner/events/[id]/page.tsx` : l'onglet « Tables » est ajouté en dernier. Aucun onglet existant ne bouge.
   - `components/events/EventForm.tsx` : un onglet « Billets | Tables » dans l'étape « Billets ».

   La fiche publique, Mes billets, Explorer et la coquille commune ne sont pas touchés.
5. **Runs.**
   - Run complet final **698** (`ba2abc6f80`) entièrement vert :
     - 619 suites sur 619 ;
     - e2e : 787 captures, fumée, terrain, recette, mesure ;
     - responsive : 194 résultats, 0 défaut ;
     - budgets respectés ;
     - mesure mobile 92 / 92 / 94.
   - Le run complet précédent, **695**, était rouge sur une seule capture existante. Correctif signalé, voir § « Tests
     existants modifiés ».
6. **Poids du scanner : +890 octets gzip par rapport à main** (run 691 de main : 224 947 ; run 698 : 225 837). Budget
   234 911, il reste 9 074 octets, aucun budget n'est relevé.
   - Le badge n'en est pas la cause : le `page.js` du scanner **diminue** de 836 octets.
   - L'écart vient du découpage des morceaux partagés par webpack : `40209.js` (8 423 o) devient `42643.js` (7 097 o)
     plus un morceau nouveau, `52946.js` (3 005 o).
   - Charger la liste de la porte par un seul `import()` (`load-door.ts`, run 698) n'a rien changé.
   - Il faudrait l'analyse module par module du lot poids (`EV_ANALYSE_POIDS=1`, artefact non publié) pour trouver le
     module déplacé. C'est porté dans `docs/apres-lancement.md`. À décider : accepter cet écart ou ouvrir l'analyse.

## Écrans livrés

### 1. Éditeur de l'organisatrice : onglet « Tables » de l'étape « Billets »

Il est proposé dès que le service est ouvert, ou dès que l'événement a des tables, qui restent lisibles service fermé. Il
se charge à l'ouverture de l'onglet, par le chargeur unique `components/event-tables/load.ts`.

- **Jauge en places en direct** : « 152 places sur 200 : 80 en billets, 72 en tables ». Le chiffre est lu sur la réponse du
  serveur (`private.event_seats_gauge`, la règle unique de la base) et relu après chaque enregistrement. La barre se remplit
  en deux teintes, chaque part a son nombre écrit, et les places libres sont affichées. Sans capacité, l'écran demande de la
  renseigner.
- **Types de tables** : nom, places (2 à 20), prix de la table, ce qui est compris, minimum sur place (texte), nombre de
  tables à la création.
  - « Soit 25 000 F par personne » vient du serveur. Pour un type enregistré, c'est sa réponse. Pendant la saisie, c'est
    l'aperçu `GET …/tables/price`, qui applique la règle de la base sans rien écrire.
  - Après la première vente ou attente, le prix et les places sont verrouillés, avec un cadenas et la raison écrite.
  - Actions : « Arrêter la vente » / « Remettre en vente », et « Retirer » (type jamais vendu).
  - État vide illustré : « Créez votre premier type de table ».
- **Tables et plan**, deux vues :
  - « Plan » : le plan partagé du lot 11b en mode édition (doigt, souris, clavier, flèches du panneau), avec les zones
    d'accès en rectangles.
    - Gabarits en un geste : « N tables en 2 rangées », « Carré de 4 tables », cercle, ligne, sur tout le plan ou sur une
      moitié.
    - Alignement automatique sur une grille douce de 2,5 %, qui se coupe. Un pas de clavier avance d'un cran de grille,
      jamais sur place.
    - « Montrer le plan aux clients » exige que toutes les tables soient placées, sinon un message nomme le nombre de tables
      à placer.
    - Aperçu « vue client », sur téléphone et sur ordinateur.
  - « Liste et numéros » : numéro, type et zone de chaque table, ajout d'une table, retrait, « Renuméroter » (de haut en
    bas puis de gauche à droite). Une table vendue ou en paiement garde son numéro et son type : champs verrouillés, raison
    écrite.
  - Enregistrement tout ou rien (`PUT`), avec une barre collante « Changements non enregistrés ». La garde de sortie du
    formulaire compte « Tables et plan ».
- **Copie du plan d'un événement précédent** de la même organisatrice, sur un événement encore sans table :
  `POST …/tables/copy`. La base vérifie la propriété des deux événements, puis chaque écriture passe par les fonctions
  habituelles. Au moindre refus, les types créés par la copie sont retirés.
- **États** : la lecture seule, avec la raison du serveur, couvre l'événement en attente de validation (« Retirez
  l'événement de la validation pour modifier ses tables. »), la fiche ou l'événement suspendu, l'événement terminé ou
  annulé, et le service fermé. Le formulaire bloquait déjà l'événement en attente de validation avant d'afficher l'étape.

### 2. Pilotage : onglet « Tables », ajouté en dernier

- **Indicateurs qui s'animent** :
  - tables vendues sur le total, avec le nombre en paiement et le nombre de libres ;
  - places entrées sur les places vendues ;
  - recette des tables hors frais, sans commission ;
  - tables remboursées.
- **Plan coloré par état** : libre, en paiement, vendue, vendue avec des invités arrivés. Chaque état a une icône sur la
  table et une légende en mots, en plus de la couleur. Toucher une table ouvre son détail.
- **Liste triable** par numéro, type, titulaire, places envoyées ou places entrées. Le tableau du système de design
  s'affiche sur ordinateur, des cartes sur téléphone, avec le même groupe « Trier par ».
- « Mis à jour à … » donne l'heure de lecture en base. L'onglet est relu au même signal temps réel que le reste du
  pilotage.
- Liens « Liste de la porte » et « Imprimer ».

### 3. Liste de la porte

- Deux pages : `/partner/events/[id]/porte` pour l'organisatrice (et l'administration, qui ouvre le pilotage), et
  `/controller/porte/[id]` pour les contrôleurs affectés. Le scanner affiche un lien « Liste des tables » dès que
  l'événement a une table vendue (`tables_sold` des affectations).
- Gros caractères (« Table 12 », « 3/6 », titulaire), recherche par numéro de table. Une table touchée s'ouvre avec les
  prénoms et initiales de ses invités.
- Mode plein écran à fort contraste : thème sombre forcé, caractères agrandis. Le plein écran du navigateur est utilisé
  quand il existe.
- Version imprimable pour une porte sans réseau. La feuille d'impression ne garde que la liste, en noir sur blanc, avec une
  case par place. `?imprimer=1` ouvre l'impression.
- La route existante `GET /api/events/[id]/tables/door` vérifie le droit de scanner.

### 4. Scanner

- Sur une place de table, le badge « Table 12 · Carré VIP » et « 3/6 entrés » apparaît dans le plein écran du contrôleur
  (`CombatFlashOverlay`) et dans la carte du scan de l'organisatrice (`ScanResultPanel`). Il est très gros, avec un épais
  liseré, et ses textes sont soumis à la mesure du contraste du plein écran (`data-scan-contrast`).
- Rien ne change pour un billet ordinaire.
- Le scanner budgété ne charge rien des écrans des tables. Le badge n'ajoute que la lecture du champ `table` de la réponse,
  et le plein écran est chargé à part, comme avant.

### 5. Administration : fiche d'un événement

La section « Tables » montre :

- la jauge en places ;
- les tables vendues, la recette hors frais, les tables remboursées et le montant remboursé ;
- le plan montré ou non ;
- les types (places, prix de la table, prix par personne, vendues sur total, vente) ;
- les tables remboursées (motif, date) ;
- « Changements après validation » : chaque enregistrement signalé par l'avis `ADMIN_EVENT_TABLES_CHANGED`, dont le lien
  mène à cette fiche.

Elle passe par la route `GET /api/admin/events/[id]/tables` (`events.read`). C'est un composant léger, sans plan : la fiche
ne charge pas les écrans de l'organisatrice.

## Défauts corrigés

| Défaut | Correctif | Preuve |
|---|---|---|
| Les types de tables (catégories `kind = TABLE`) étaient listés comme catégories de billets dans le formulaire de modification (onglet Billets, écran « Vérifier ») et sur la fiche de l'administration. | Ils sont écartés côté formulaire (`isTicketCategory`) et côté serveur (`.neq('kind', 'TABLE')` dans la fiche de l'administration). Ils ont leur onglet et leur section. | `l11cc-ecrans` G, `l11cc-ecrans-statique` 6 |
| Le texte d'aide de la capacité parlait encore de « la somme des quantités des catégories actives » (point laissé au 11c-c par le lot 11c-a). | Nouveau texte : « places mises en vente, billets et tables compris ». Même plancher, toujours servi par le serveur. | `evenements-verrous-ecran` (modifié, signalé) |

## Tests et accès

Suites nouvelles :

- **`tests/parcours/l11cc-ecrans.test.ts`** (base locale, 12 tests). Le service est ouvert par la suite puis remis ; la
  suite appelle `checkLot11cInvariants` et `assertNotificationInvariants` dans son `after`. Contenu :
  - **A. Lecture.**
    - Contenu exact pour la propriétaire : jauge `{ capacity: 100, seats: 38, table_seats: 18, ticket_seats: 20, free: 62 }`,
      type figé, vente « Awa D. » avec `counts { sent: 1, pending: 0, to_send: 5, entered: 0, given: 1 }`, totaux (recette
      150 000 hors frais).
    - Aucun téléphone, courriel ni nom complet dans la réponse.
    - Autre organisatrice, titulaire, cliente, contrôleur d'un autre événement : **404 EVENT_NOT_FOUND**, sans données. Sans
      session : **401**.
    - Administration `events.read` : 200, lecture seule (`ADMIN_CANNOT_EDIT`) avec l'historique. Sans la permission :
      **403 PERMISSION_MISSING**.
    - Route `/api/admin/events/[id]/tables` refusée à la propriétaire et à une cliente (**403**).
    - Un type ajouté après validation ajoute une ligne à l'historique.
  - **B. Refus d'écriture.** Le refus lu par l'écran est celui de l'écriture : `WITHDRAW_TO_EDIT` (texte exact),
    `SERVICE_UNAVAILABLE`, `EVENT_SUSPENDED`.
  - **C. Porte.** Contrôleur affecté : 200, « Awa D. », invitée « Mariama S. », 0/6. Contrôleur d'un autre événement,
    autre organisatrice, cliente : **403**.
  - **D. Aperçu du prix.** 25 000 exact, 33 333 arrondi, 50 001 (moitié vers le haut, comme `round()` de la base). Bornes :
    400. Cliente : 403.
  - **E. Copie.**
    - Types, numéros et positions repris ; le plan n'est pas montré après la copie.
    - Seconde copie : **409 TABLES_NOT_EMPTY**.
    - Source ou cible d'une autre organisatrice : **404**, et rien n'est écrit chez elle. Copie sur soi-même ou identifiant
      illisible : 400.
  - **F.** `tables_sold` des affectations.
  - **G.** Fiche de l'administration sans les types de tables parmi les catégories.
- **`tests/schema/l11cc-ecrans-statique.test.ts`** (sans base) :
  - gabarits : 1 à 40 tables, positions distinctes, dans le cadre, sur la grille ;
  - renumérotation ; règle du prix par personne, citée depuis la base ;
  - un seul `import()` pour les écrans et un seul pour la porte ; aucun import statique ailleurs ; le scanner n'importe
    rien des tables ;
  - aucune multiplication ni division d'un prix ou d'un nombre de places dans les écrans ;
  - migration : deux fonctions nouvelles, aucune recopie, droits ;
  - pilotage : onglet ajouté en dernier ; filtre des types de tables ; feuille d'impression ; prop facultative du plan.
- **`tests/schema/migration-lot11cc-rejouable.test.ts`** (base) : rejouable deux fois dans une transaction annulée,
  placée après la 11c-a, droits.
- **`e2e/lot11cc.responsive.spec.ts`** (job responsive). Données propres à « organisatrice3 », obtenues par le vrai achat,
  le faux SamirPay et le vrai webhook. Il contrôle à 0 défaut et capture l'éditeur, le pilotage, la porte, la porte du
  contrôleur et la fiche de l'administration, en clair et en sombre, à 390 et 1 440 px. Il vérifie aussi :
  - la jauge exacte « 152 places sur 200 : 80 en billets, 72 en tables » ;
  - le prix verrouillé ;
  - le lien « Liste des tables » du scanner ;
  - le badge du plein écran (réponse de scan imposée, caméra simulée).

Lignes brutes du run complet 698 (`jobs/tests-*/verify.log`) :

```
tests/parcours/l11cc-ecrans.test.ts                           PASS     7.3s      0     .test-logs/tests__parcours__l11cc-ecrans.test.ts.log
tests/schema/l11cc-ecrans-statique.test.ts                    PASS     683ms     0     .test-logs/tests__schema__l11cc-ecrans-statique.test.ts.log
tests/schema/migration-lot11cc-rejouable.test.ts         PASS     435ms     0     .test-logs/tests__schema__migration-lot11cc-rejouable.test.ts.log
tests/security/r3-fonctions-rpc.test.ts                       PASS     2.9s      0     .test-logs/tests__security__r3-fonctions-rpc.test.ts.log
tests/parcours/evenements-verrous-ecran.test.ts               PASS     3.9s      0     .test-logs/tests__parcours__evenements-verrous-ecran.test.ts.log
tests/parcours/l11c-tables.test.ts                     PASS     14.4s     0     .test-logs/tests__parcours__l11c-tables.test.ts.log
tests/audit/cv11c-1-trous.test.ts                             PASS     3.1s      0     .test-logs/tests__audit__cv11c-1-trous.test.ts.log
tests/audit/cv11c-2-gardes.test.ts                     PASS     4.7s      0     .test-logs/tests__audit__cv11c-2-gardes.test.ts.log
tests/audit/cv11c-3-statique.test.ts                          PASS     337ms     0     .test-logs/tests__audit__cv11c-3-statique.test.ts.log
TOTAL : 155 suite(s) — 155 réussie(s), 0 en échec, 0 expirée(s)   (lots 1, 2 et 3)
TOTAL : 154 suite(s) — 154 réussie(s), 0 en échec, 0 expirée(s)   (lot 4)
```

`l11cc-ecrans` (journal du run 698) :

```
ok 1 - A. Lecture des tables pour les écrans
ok 2 - B. Le refus lu par l’écran est celui de l’écriture
ok 3 - C. Liste de la porte
ok 4 - D. Aperçu du prix par personne (serveur)
ok 5 - E. Copie des tables d’un événement précédent
ok 6 - F. Scanner : tables vendues de l’événement affecté
ok 7 - G. Fiche de l’administration
# tests 12
# pass 12
# fail 0
```

`tests/audit/` et `tests/audit-auth/` sont tous verts au run 698, sans aucune assertion changée.

### Tests existants modifiés (signalés)

| Fichier | Changement | Pourquoi |
|---|---|---|
| `tests/security/r3-fonctions-rpc.test.ts` | `['event_table_report', { p: {} }]` ajouté à la liste du lot 11c-a | Fonction nouvelle, réservée au rôle de service (refus 42501 pour anon et authenticated, prouvé). |
| `tests/parcours/evenements-verrous-ecran.test.ts` | Trois textes attendus de la jauge : « la somme des quantités des catégories actives » devient « les places mises en vente, billets et tables compris » ; « Facultative. » devient « Facultative sans table. » | Point laissé au 11c-c par le lot 11c-a. Le plancher (servi par le serveur, `event_edit_locks`) est inchangé, seul le texte change. |
| `e2e/support/screens.ts` (capture `admin-cloture-motif`) | Lecture `GET /api/admin/events/<id>/tables` imposée (aucune table) | La capture impose une fiche d'événement fictive, inconnue de la base. La section « Tables » demandait ses tables et recevait 404, une erreur de console bloquante (run 695). Le même écran impose déjà la fiche. |
| `tests/helpers/design-files.ts` | 9 fichiers ajoutés | Les fichiers du lot passent aux règles du système de design. |
| `e2e/support/responsive-pages.ts` | 2 pages ajoutées (`org-porte-tables`, `scan-porte-tables`) | Les pages nouvelles entrent dans le contrôle responsive. |

## Poids JavaScript et mesure mobile

Mesure du premier chargement (`js-budget.tsv`, octets gzip). La consigne demandait « avant / après » : le premier
tableau compare au run 691 de **main avant le lot** (après la carte B3), le second au run 676 de main (11c-a, avant la carte
B3) pour mémoire.

| Route | main 691 | lot 698 | Écart | Budget |
|---|---|---|---|---|
| `/` | 215 068 | 215 115 | +47 | 226 342 |
| `/events/[id]` | 223 745 | 223 792 | +47 | 233 316 |
| `/tickets` | 239 990 | 239 785 | −205 | 250 417 |
| `/controller/scanner` | 224 947 (16 fichiers) | 225 837 (17 fichiers) | **+890** | 234 911 |
| `/billet/hors-ligne` | 214 066 | 214 113 | +47 | 224 268 |
| `/explore` | 225 578 | 225 625 | +47 | 235 712 |

Le +47 commun aux routes est l'entrée du morceau des tables dans la table des morceaux de webpack (`webpack.js`), plus
`ui-base` (+29 : classes nouvelles du système). Détail du scanner (lignes `[JS-BUDGET]` brutes) :

```
main 691 : 8423 static/chunks/40209.js · 15902 static/chunks/app/controller/scanner/page.js · 6090 ui-base.js · 3149 webpack.js · table des morceaux : 49 entrées
lot  698 : 7097 static/chunks/42643.js · 3005 static/chunks/52946.js · 15066 static/chunks/app/controller/scanner/page.js · 6119 ui-base.js · 3167 webpack.js · table des morceaux : 51 entrées
```

Pour mémoire, au run 676 (main du 11c-a) : `/` 214 995, `/events/[id]` 223 570, `/tickets` 239 915,
`/controller/scanner` 224 874, `/billet/hors-ligne` 213 992, `/explore` 225 502.

Mesure mobile (`perf/lighthouse.tsv`, médianes) :

| Page | main 676 | main 691 | lot 695 | lot 698 |
|---|---|---|---|---|
| Accueil | 94 | 91 | 91 | 92 |
| Fiche | 92 | 91 | 91 | 92 |
| Mes billets | 94 | 91 | 91 | 94 |

Aucune de ces pages n'est touchée par le lot. Seuil 90 tenu à chaque run.

## Captures

52 captures du lot, dans `ci-results`, `runs/698-45754411698/captures-responsive/l11cc-*.jpg` (aussi aux runs 693 et
695). Elles existent en clair et en sombre, à 390 et 1 440 px :

- `editeur` (onglet « Tables », types figés, jauge) et `jauge` (la jauge seule) ;
- `plan-edition` (gabarits, grille douce, une table choisie) ;
- `vue-client` (aperçu téléphone ou ordinateur) ;
- `type-fige` (prix et places verrouillés, « Soit 25 000 F CFA par personne. ») ;
- `pilotage` (indicateurs, plan coloré, liste triable) ;
- `porte`, `porte-table-ouverte`, `porte-plein-ecran` (fort contraste) et `porte-impression` (feuille d'impression,
  noir sur blanc) ;
- `porte-controleur` ;
- `scanner-badge` (plein écran du contrôleur : « Table 3 · Carré VIP », « 3/6 entrés ») ;
- `admin` (section « Tables » de la fiche).

Relecture des captures du run 693 : un défaut d'accord (« 1 vendues ») et un cadenas pour « Plan montré aux clients » sur
la fiche de l'administration, corrigés avant le run complet.

Les captures de l'e2e habituel (787 entrées, 0 en échec au run 698) comprennent les pages de la porte à l'état vide
(« ce soir » n'a pas de table).

## Runs

Les run_id sont lisibles sur `https://github.com/fallouu-mn/event-village/actions/runs/<run_id>`.

| Run | Commit | Mode | Résultat |
|---|---|---|---|
| 684 | `d4ec0a1595` | rapide (77 suites + responsive) | Rouge sur `l11cc-ecrans` : achat d'une table précise quand le plan n'est pas montré, refus attendu `TABLE_CHOICE_UNAVAILABLE` (erreur du test). Responsive : 194 résultats, 0 défaut. Spec e2e rouge : entrée d'une place déjà envoyée → « invalid ». |
| 687 | `ad3a20a165` | rapide | Tests verts. Spec e2e rouge : nom accessible de l'étape (« Étape 4 : Billetterie »). |
| 688, 689, 690, 692 | `aa269d545e` à `4e097dc758`, puis la version qui vise le texte visible | rapide | Tests verts, responsive à 0 défaut. Spec e2e rouge à chaque fois sur une seule assertion du spec : espaces insécables du montant, tableau masqué sur téléphone, reprise du contrôle au second passage. |
| 693 | `0ef714fd49` | rapide | **Vert** : spec e2e clair et sombre, responsive 0 défaut. |
| 695 | `dae4d7a895` (fusion de main avec la carte B3) | **complet** | 4 lots de tests verts, build, budgets, responsive et mesure (91 / 91 / 91) verts. e2e rouge : 4 captures `admin-cloture-motif` (erreur de console 404 de la section « Tables » sur la fiche fictive). |
| 698 | `ba2abc6f80` | **complet** | **Entièrement vert** : 619 suites, e2e (787 captures, fumée, terrain, recette), responsive (194, 0 défaut), budgets, mesure 92 / 92 / 94. |

Résumé brut du run 698 (`run.txt`, `e2e.log`, `responsive.txt`) :

```
build=success
js_budget=success
e2e_seed=success
e2e=success
perf_mobile=success
responsive=success
perf_mobile_mesure=ok
[e2e] index des captures : .e2e-captures/captures/index.txt (787 entrée(s), 0 en échec)
[e2e] résumé :connexion OK · captures OK · emails OK · dev-page OK · fumee OK · terrain OK · pwa OK · deconnexion OK · connexion-course OK · fake-prod OK · perf OK · recette OK
Contrôle responsive : 194 résultat(s) (page × thème), 0 défaut(s) bloquant(s).
```

Aucune construction locale. Seuls le typecheck, le lint et les suites sans base ont tourné en local.

## Essais pour un non-développeur

Ouvrir d'abord le service des tables : réglages du super-administrateur, section « Tables des événements », interrupteur
ouvert. Ensuite, avec un compte d'organisatrice et un événement publié qui a une capacité :

1. **Créer des tables.**
   - Mes événements → l'événement → « Modifier » → étape « Billets » → onglet « Tables ».
   - « Créer un type de table » : « Carré VIP », 6 places, 150 000.
   - Attendu sous le prix : « Soit 25 000 F par personne ». Indiquer 4 tables, puis « Ajouter le type ».
   - Attendu : la jauge passe, par exemple, à « … places sur 200 : … en billets, 24 en tables ».
2. **Placer les tables.**
   - Vue « Plan » → « Gabarits en un geste » : type « Carré VIP », « Carré de 4 tables », « Disposer ».
   - Déplacer une table au doigt ou à la souris : elle se pose sur la grille.
   - Activer « Montrer le plan aux clients », puis « Enregistrer les tables ».
3. **Voir le refus quand une table manque.** Ajouter une table dans « Liste et numéros », puis activer « Montrer le plan aux
   clients ». Attendu : « Placez toutes les tables sur le plan avant de le montrer aux clients : 1 table reste à placer. »
4. **Vérifier le prix figé.** Après une vente, « Modifier » le type. Attendu : prix et places grisés avec un cadenas, et la
   phrase « Figé : une table de ce type est vendue ou en cours de paiement… ».
5. **Suivre au pilotage.**
   - Mes événements → l'événement → onglet « Tables » (le dernier).
   - Attendu : le plan coloré (« Vendue », « En paiement », « Libre »), la liste qu'on trie en touchant « Titulaire » ou
     « Places entrées », la recette des tables et « Mis à jour à … ».
6. **Tenir la porte.**
   - « Liste de la porte » : taper un numéro de table, toucher la table pour voir ses invités.
   - « Plein écran » pour le fort contraste, « Imprimer » pour la feuille papier, à vérifier dans l'aperçu avant impression.
7. **Scanner une place de table.** Comme contrôleur affecté, scanner une place. Attendu : « Table 3 · Carré VIP » et
   « 1/6 entrés » en très gros sous le verdict. Un billet ordinaire s'affiche comme avant.
8. **Contrôler côté administration.**
   - Administration → Événements → la fiche de l'événement → section « Tables ».
   - Après un changement de prix par l'organisatrice, une ligne de plus dans « Changements après validation ».
9. **Vérifier les accès.**
   - Une autre organisatrice qui colle l'adresse de la liste de la porte ou du pilotage voit « introuvable » ou « non
     autorisé ».
   - Un contrôleur d'un autre événement, sur `/controller/porte/<identifiant>`, voit « Liste réservée à l'organisatrice et à
     son équipe de contrôle. »

## Autres idées

- **Pour la porte**, le soir même :
  - un mode « file d'attente » qui trie les tables dont les invités ne sont pas encore tous arrivés ;
  - un compteur global « 38/72 places des tables entrées ».
- **Plan** : poignée de rotation directe sur la table, et sélection de plusieurs tables pour les déplacer ensemble.
- **Rappel à l'organisatrice** la veille : « 3 tables encore libres », avec un lien vers « Arrêter la vente » ou la baisse
  du nombre de tables.
- **Export** des tables vendues (numéro, titulaire, places) au format tableur pour le traiteur, sans téléphone.
- **Copie du plan** : proposer aussi la copie d'un plan de restaurant du lot 11b (même géométrie), quand l'organisatrice
  est aussi un établissement.
