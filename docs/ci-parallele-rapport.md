# Lot CI rapide — même contrôle, en parallèle

Branche `ci/parallele`, partie de `main` (46d4d6933). Rien n'est fusionné. Aucun changement de l'application, aucune
migration.

## À lire en premier

- **Le run complet passe de 82 à 91 min, au-delà de la limite de 90 min, à 36 min** (run 316 : 2 148 s jusqu'au
  verdict). Aucun contrôle n'est retiré ni allégé : les mêmes commandes tournent sur 7 runners en même temps au lieu
  d'un seul.
- **Équivalence prouvée** contre un run série de `main` lancé pour l'occasion (run 308) : même liste de 449 suites, mêmes
  statuts, **5 094 tests individuels des deux côtés** (5 093 réussis, 1 ignoré, le même), 565 captures, mêmes poids
  JavaScript au même octet près. L'e2e complet est vert au run 316 (10 phases dont la recette). Au run 308, la limite
  de 90 min a coupé l'e2e pendant la phase perf : la recette n'y a pas tourné.
- **Le verdict passe bien au rouge** : au run 317, une assertion fausse dans un lot rend le verdict rouge ; les
  448 autres suites restent vertes, dans des lots mélangés. Le commit est annulé : le run 320 est vert, sur un arbre
  identique à celui du run 316.
- **Ajout : `evenements-fin-valide` en mode rapide (§ 5 bis).** La cause est un Realtime froid, et la même
  correction de l'aide temps réel la règle. Preuve : 5 runs rapides verts de ce test seul (324, 325, 327, 328, 329),
  là où les runs 279, 321 et 322 échouaient.
- **Une aide de test modifiée** (isolation, voir § 5) : `tests/helpers/realtime.ts`, `ready` attend la réponse du
  serveur Realtime avant de rendre la main. Aucune assertion ni aucun délai changé.
- **Décision à prendre (§ 7)** : la durée dépend maintenant de l'e2e seule (captures : 24 à 27 min selon le runner).
  Avec la version finale, le run varie de 36 min (316) à 41 min (320). Pour tenir 40 min à coup sûr, il faudrait couper les captures en deux jobs.

## 1. Avant / après

| Run | Forme | Tests | e2e | Durée du run | Issue |
|---|---|---|---|---|---|
| 281 (finition 3b) | série, 1 job | 2 612 s (verify) | 2 042 s | 4 908 s (82 min) | vert |
| 300, 306 (autres branches) | série, 1 job | 2 812 s, 3 034 s | coupé | 5 434 s, 5 436 s | annulés à la limite |
| **308 (référence, `main`)** | série, 1 job | **3 085 s**, 449/449 | coupé pendant perf | **5 435 s (90,6 min)** | **annulé à la limite** |
| 312 | parallèle | 516 à 734 s par lot | 2 230 s | 2 534 s (42 min) | vert |
| **316** | **parallèle** | **491 à 673 s par lot** | **1 945 s** | **2 148 s (36 min)** | **vert** |
| 317 (cassé exprès, lots mélangés) | parallèle | 471 à 706 s par lot | 2 418 s (job) | 2 454 s (41 min) | **rouge**, comme voulu |
| **320 (annulation, arbre de 316)** | **parallèle** | **508 à 675 s par lot** | **2 206 s** | **2 465 s (41 min)** | **vert** |

« Durée du run » : du début du premier job à l'assemblage du verdict (`job_elapsed_s` de `run.txt`). La publication
sur `ci-results` ajoute environ 30 s.

Détail du run 316 (secondes depuis le début du run) :

| Job | Début | Durée |
|---|---|---|
| mode | 0 | 9 |
| qualite (typecheck, lint, liste des suites) | 12 | 87 |
| tests 1/4 · 2/4 · 3/4 · 4/4 | 11 à 15 | 491 · 661 · 524 · 673 |
| e2e (build, poids JS, e2e) | 11 | 2 119, dont 1 945 d'e2e |
| verdict | après le dernier | ≈ 40 |

## 2. Les jobs

| Job | Ce qu'il fait | Commande |
|---|---|---|
| `mode` | lit le message du commit : ligne `ci-rapide:` (mode rapide), ligne `ci-lots-graine:` (lots mélangés) | — |
| `qualite` | typecheck, lint ; liste de référence des suites | `verify.mjs --etapes typecheck,lint` ; `run-tests.mjs --list` |
| `tests` 1/4 à 4/4 | un quart des suites, **sur sa propre base Supabase locale** : `supabase start`, `db reset` (toutes les migrations depuis zéro), seed de test, puis les suites ; invariants dans les `after()` de chaque suite, comme avant | `verify.mjs --etapes test --lot k/4` |
| `e2e` | build, poids JavaScript, puis l'e2e complet inchangé (connexion, captures, emails, dev-page, fumée, terrain, pwa, fake-prod, perf, recette) | `verify.mjs --etapes build`, `--etapes js-budget`, `npm run e2e` |
| `verdict` | vert **seulement si tous les jobs sont verts et si les lots couvrent exactement la liste** (chaque suite une fois, en PASS) ; publie un seul dossier par run sur `ci-results` | `scripts/ci-verdict.mjs` |
| `rapide` | mode rapide seulement (à la place de `qualite`, `tests`, `e2e`) : inchangé | `scripts/ci-rapide.mjs` |

60 min au plus par job. L'étape e2e a son propre délai de 47 min, pour laisser le temps de déposer les journaux.

**Répartition des lots.** La liste vient toujours de `run-tests.mjs --list`, la même découverte que le run série.
`scripts/ci-lots.mjs` la partage selon les durées mesurées au run 281 (`scripts/ci-durees.json`) : plus longues
d'abord, chacune dans le lot le moins chargé. On obtient environ 626 s estimées par lot. Une suite nouvelle compte pour
la médiane. Pour rééquilibrer : `node scripts/ci-lots.mjs durees <verify.log d'un run>`. Dans un lot, le lanceur
garde sa règle « suites temps réel avant suites lourdes ».

**`ci-results`** : un seul dossier `runs/<n>-<id>/`, mêmes noms qu'avant.
- `verify.log` contient typecheck et lint, puis **un seul** récapitulatif et **un seul** `TOTAL` (fusionnés), puis le
  build et le poids JS.
- Comme avant : `test-logs/`, `captures/`, `emails/`, `perf/`, `playwright/`, `js-budget.tsv`, `e2e*.log`.
- Nouveau : `jobs/<job>/` garde les journaux bruts de chaque job, dont le `verify.log` de chaque lot.
- `run.txt` :
  - `job_status` est le verdict ;
  - nouvelles lignes `job_<job>` (résultat, début, durée), `etape_<job>_<étape>`, `controle_lots`, `lots`, `graine` ;
  - `build_mesure` disparaît : le build tourne toujours dans le job e2e.

`npm run verify` en local est inchangé (cinq étapes en série).

## 3. Preuve de l'équivalence

Référence : **run 308**, branche `ci/reference-serie` = `main` + la seule ligne de déclencheur `ci/**` (2a1000792), en
série, avec l'ancien workflow.

| | Run 308 (série) | Run 312 | Run 316 | Run 320 |
|---|---|---|---|---|
| Suites (liste triée, statut) | 449, toutes PASS | **identique à 308** | **identique à 308** | **identique à 308** |
| `TOTAL` | 449 — 449 réussies | 449 — 449 | 449 — 449 | 449 — 449 |
| Tests individuels (somme des journaux) | 5 094 : 5 093 pass, 1 skipped, 0 fail | 5 094 : 5 093, 1, 0 | 5 094 : 5 093, 1, 0 | 5 094 : 5 093, 1, 0 |
| Journaux de suite | 449 | 449 | 449 | 449 |
| Contrôle de couverture des lots | — | OK | OK | OK |
| e2e | coupé par la limite pendant perf (recette non lancée) | 10 phases OK | 10 phases OK | 10 phases OK |
| Captures PNG publiées | 565 | 565 | 565 | 565 |
| Poids JS (5 routes) | dans les budgets | identiques, octet pour octet | identiques | identiques |

Comparaison faite sur les fichiers publiés : récapitulatifs de `verify.log`, comptes `# tests/# pass/# fail/# skipped`
de chaque journal de `test-logs/`, `captures/`, `js-budget.tsv`.

**Voisinages différents.** Le run 317 tourne avec la graine 17 : chaque lot y réunit d'autres suites qu'au run 316
(101, 123, 116 et 109 suites par lot). Les 448 suites non cassées y sont toutes vertes.

## 4. Preuve du rouge

**Run 317** (commit 25b5d5bbd) : un test `assert.equal(1, 2, 'échec volontaire')` ajouté à
`tests/schema/ordre-suites.test.ts`, qui tombe dans le lot 2 ; ligne `ci-lots-graine: 17`.
- job `tests 2/4` rouge ; les trois autres lots, `qualite` et `e2e` verts ;
- `verify.log` : `tests/schema/ordre-suites.test.ts FAIL`, puis
  `TOTAL : 449 suite(s) — 448 réussie(s), 1 en échec` et `contrôle EN ÉCHEC` ;
- `run.txt` : `job_status=failure`, `controle_lots=echec`, `graine=17` ; job `verdict` rouge.

Annulé par ff2e27c74 (`git diff ceeeb94fd ff2e27c74` vide : même arbre que le run 316). Run 320 : vert.

Le contrôle de couverture rend aussi le verdict rouge quand tous les jobs sont verts mais qu'une suite manque, est
exécutée deux fois, ou qu'un lot n'a pas de récapitulatif. Run 309 : le lot 4 n'avait pas démarré, 113 suites
manquantes, verdict rouge.

## 5. Isolation des tests : ce qui a changé

**`tests/helpers/realtime.ts` (aide de test, modifiée : signalé).**
- *Constat, run 309 :* `evenements-fin-valide` échoue, 0 message reçu en 20 s. Dans son lot, c'était la première suite
  temps réel, 3 min après le démarrage du conteneur Realtime.
- *Ce qui se passe :* « SUBSCRIBED » n'est que la réponse à la jonction du canal. Le serveur crée ensuite l'abonnement
  aux changements de la base, et annonce le résultat par un message `system` (« Subscribed to PostgreSQL »). Sur un
  Realtime qui vient de démarrer, un changement fait entre les deux est perdu.
- *Pourquoi le run série était vert :* quatre suites temps réel précédaient celle-ci. Elle dépendait donc des autres.
- *Correctif :* `ready` attend aussi cette réponse du serveur, dans le même délai de 20 s. `outcome` reste
  identique à celui de `main`.
- *Première version, corrigée :* elle lisait une réponse « error » du serveur comme un refus. Or quatre suites
  (`temps-reel-billets`, `-public`, `-stock`, `-prives`) s'abonnent exprès à des tables hors publication et attendent
  un canal ouvert qui ne reçoit rien. Elles ont échoué au run 310. La version finale n'y change rien : la réponse est
  seulement écrite dans les états du canal.
- Aucune assertion, aucun délai, aucun test modifié. `tests/parcours/realtime-diagnostic.test.ts` (garde-fou des
  délais) reste vert.

**Jour simulé, file des avis.** Chaque lot a sa propre base : les SMS du jour simulé, la file des avis et les quotas
ne sont plus partagés entre suites de lots différents. Aux runs 312, 316 et 320 (lots équilibrés) et 317 (lots
mélangés), aucune autre suite n'a eu besoin d'un correctif.

### 5 bis. Ajout : `evenements-fin-valide` rouge en mode rapide (runs 279, 321, 322)

- **Constat.** Les trois runs rapides échouent au même endroit, le cas 5 :
  `délai dépassé (20000 ms) : diffusion de la sentinelle — 0 message(s) reçu(s)`. L'état du canal se réduit à
  `SUBSCRIBED`. Le conteneur Realtime avait démarré 3 min (279, 321) et 1 min (322) plus tôt.
- **Cause : un Realtime froid, la même qu'au run 309.** En mode rapide, cette suite est la première (au run 322, la
  seule) à s'abonner aux changements. Le cas 5 s'abonne, attend SUBSCRIBED, puis déclenche le cron **une seule
  fois**. Or le serveur n'a pas encore activé l'abonnement : le changement est perdu. En run complet, en série,
  `acces-pilotage`, `dette-publication-reservations`, `dette-suspendu-temps-reel` et `evenements-en-direct` passaient
  avant et avaient déjà réveillé Realtime : la suite dépendait d'elles.
- **Correctif : celui du § 5, dans l'isolation**, et non un préchauffage dans la CI. Un préchauffage n'aurait corrigé
  que la CI, et la suite serait restée dépendante de l'état du serveur. `ready` attend la réponse du serveur ; le cas
  5 ne déclenche donc le cron qu'une fois l'abonnement actif. L'assertion reste « la sentinelle est diffusée en 20 s,
  l'événement caché ne l'est pas en 3 s ».
- **Preuve : 5 runs rapides de cette seule suite, tous verts.** Ligne
  `ci-rapide: tests/parcours/evenements-fin-valide.test.ts`, sur la ref `ci/rapide-fin-valide` (commits vides, même
  arbre que `ci/parallele`), un run après l'autre :

  | Run | Démarrage de Supabase | Début des tests (typecheck et lint compris) | Cas 5 | Verdict |
  |---|---|---|---|---|
  | 324 | 71 s | 34 s après | ok | vert |
  | 325 | 67 s | 34 s après | ok | vert |
  | 327 | 85 s | 33 s après | ok | vert |
  | 328 | 81 s | 30 s après | ok | vert |
  | 329 | 58 s | 34 s après | ok | vert |

  Avant le correctif, dans les mêmes conditions : 0 sur 3 (279, 321, 322).
- **Pour les autres branches** : `finition-2b/creation` et les autres restent rouges sur ce test en mode rapide tant
  qu'elles n'ont pas le correctif. Il tient en deux commits de `tests/helpers/realtime.ts` (a144c5526, puis acde155e8
  qui le remplace) et arrive avec la fusion de cette branche.

## 6. Autres changements

| Fichier | Changement |
|---|---|
| `.github/workflows/verify.yml` | jobs parallèles (§ 2) ; déclencheur `ci/**` ; ancres YAML pour les étapes communes |
| `scripts/verify.mjs` | options `--etapes`, `--lot`, `--graine`. Sans option, rien ne change. Le tableau des cinq étapes reste littéral : `tests/parcours/perf-statique.test.ts` le lit |
| `scripts/ci-lots.mjs`, `scripts/ci-durees.json` | répartition, contrôle de couverture, récapitulatif fusionné |
| `scripts/ci-verdict.mjs` | assemblage du dossier `ci-results` et verdict |
| `scripts/ci-supabase-start.sh` | démarrage commun, trois tentatives |
| `tests/helpers/realtime.ts` | § 5 |

Trois causes de rouge rencontrées en route, toutes réglées :
- **Run 309, lot 4 : « port 54322 already in use » aux deux tentatives.** C'est le défaut de runner déjà vu aux runs
  81-82 ; les ports de Supabase local sont dans la plage des ports éphémères du noyau. Ils sont maintenant réservés
  (`sysctl ip_local_reserved_ports`) dès le début de chaque job, avant `npm ci`, et le démarrage fait trois
  tentatives.
- **Run 314 : base de l'e2e préparée avant l'installation de Chromium.** Pour gagner une minute, la base de l'e2e (db
  reset, seed de test, seed de démonstration : mêmes commandes) se prépare pendant le build. Or `seed:demo` lance
  Chromium ; installé trop tard, il a bloqué le seed. Chromium est maintenant installé avant.
- **Run 310 : la première version de l'aide temps réel** (§ 5).

Gains sur le chemin critique (job e2e) : Supabase démarre pendant `npm ci`, et la base de l'e2e se prépare pendant le
build. La préparation passe de 325 s (run 309) à 185 s (run 316) avant l'e2e.

## 7. Décision à prendre : la limite basse est l'e2e

Les quatre lots finissent entre 8 et 12 min. Le run dure donc autant que le job e2e : environ 3 min de préparation,
plus l'e2e elle-même, qui a pris de 1 945 à 2 230 s selon les runners (captures : 1 441 à 1 649 s). **Le run varie
donc de 36 à 42 min.**

Pour tenir 40 min à coup sûr, une seule voie sans rien retirer : **couper les captures en deux jobs** (Playwright
`--shard=1/2` et `2/2`, chacun avec sa base, son build et son application). On estime le run à 25-28 min. Mais cela
sort du cadre « un seul job e2e », et l'ordre change : fumée, terrain, perf et recette ne tourneraient plus après
*toutes* les captures sur la même base. Je ne l'ai pas fait sans ton accord.

## 8. À savoir

- **Coût en runners** : 7 jobs par run. Le temps de calcul total (≈ 77 min au run 316) reste proche de celui de
  l'ancien job unique. Dépôt public : pas de facturation. Le plan gratuit limite à 20 jobs simultanés : deux runs
  complets en même temps passent, un troisième attend un peu.
- **Mode rapide** : inchangé (job `rapide`, puis `verdict`), prouvé par les runs 324 à 329. Le commit de ce rapport
  porte aussi une ligne `ci-rapide:`.
- **Branches `ci/reference-serie` et `ci/rapide-fin-valide`** : elles ne servent qu'aux preuves (run 308 ; runs 324
  à 329). Elles peuvent être supprimées après lecture.
- **Mes poussées** : `ci/parallele` a été poussée pendant que le run 308 tournait sur `ci/reference-serie`. Ce sont
  deux refs distinctes, donc deux groupes de concurrence : rien n'a été annulé. Je n'ai jamais poussé pendant un de
  mes runs sur la même branche, ni poussé `main`.
- **Après la fusion** : les branches `finition-*`, `lot*` et les autres prendront ce workflow en se mettant à jour
  depuis `main`.
