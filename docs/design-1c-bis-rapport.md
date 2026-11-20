# Design 1c bis — Restes du design 1c

Branche `design-1c/bis`, partie de `main` à `362855155` (fusion du design 1c). Une migration :
`20261124000001_d1cbis_restes.sql`.

## Fusion du design 1c

- `design-1c/pro` est fusionnée dans `main` en `--no-ff` (`362855155`), sans conflit : `main` n'avait pas bougé depuis
  `fce22b609`. L'arbre fusionné est identique à celui du run 444, qui était vert.
- Décisions 1 à 6 du rapport du design 1c : validées par l'utilisateur le 19/11.
- Run complet de `main` : **run 449 rouge sur une seule mesure.** Mes billets fait 89 au téléphone de référence, pour un seuil de 90 (machine lente : ralentissement ×3,7). L'arbre est identique à celui du run 444, où la même page faisait 90 et le run était vert. Le reste du run 449 est vert : 536/536 suites, e2e, budgets JS, responsive à 0 défaut. **À relancer** (job e2e du run 449) : je ne peux pas relancer un job de la CI moi-même..

## 1. « Mes événements » : brut → remboursements → recettes nettes

- **Migration** : `partner_events_overview` sert `revenue_online_gross` (Σ VENTE du grand livre, compte ORGANISATEUR) et
  `revenue_online_refunded` (−Σ REMBOURSEMENT). C'est la même convention que le pilotage (`online_gross`,
  `refunded_online`). `revenue_online` (recettes nettes) ne change pas : une seule déduction.
- **Écran** : « Ventes en ligne (brut) », puis « Recettes nettes » avec « Ventes en ligne moins … de remboursements. »,
  comme le tableau de bord.
- **Preuve en base** : `finance-remboursement-billet`. Après trois remboursements réels, brut, remboursements et net
  servis sont égaux au grand livre, et net = brut − remboursements.

## 2. Message de la base

`finance_setting_set` refuse désormais par « Seul un super-administrateur actif peut modifier les réglages. »
(avant : « Seul un SUPERADMIN actif modifie les réglages de la plateforme. »). Rien d'autre ne change dans la fonction :
le test `migration-d1cbis-restes` compare chaque recopie à l'original.

## 3. Erreur 418 de la fiche « en cours »

**Cause.** La fiche est mise en cache 60 s (`unstable_cache` et page revalidée). Elle portait l'état de la billetterie
calculé à l'heure de sa préparation : vente ouverte ou close, disponibilité, achat possible, guichet, remboursement d'un
report. Une même fiche n'était donc pas la même avant et après une fin de vente, et la page en cache ne suivait plus
l'heure du téléphone.

**Correctif.**
- `withClock(fiche, heure)` (`lib/events/event-detail.ts`) calcule l'état de la billetterie depuis les seuls faits sans
  heure : dates de vente, début, fin, statut, stock, report de plus de 24 h, catégorie vendue au guichet.
- **Seule la fiche sans heure est mise en cache** (`buildPublicEventSnapshot`, clé `fiche-publique-v2`). Rien n'y est
  ouvert ni fermé.
- **La route de l'API** applique l'heure du serveur. Son contrat ne change pas.
- **La billetterie** applique l'heure du téléphone après le chargement, et la fait avancer aux bornes de la vente. Son
  premier rendu est neutre : le stock seul, une ligne gardée, aucune barre d'achat. Il est donc identique au HTML en
  cache.
- La ligne « Paiement » de la page ne dépend plus de l'heure.

**Test qui reproduit le cas** (`tests/parcours/d1cbis-fiche-heure`) : la fiche en cache est lue avant puis après une fin
de vente réelle (5 s).

| Run | Commit | Résultat |
|---|---|---|
| 450 | `5a4cf2b6b` (tests seuls) | **rouge** comme attendu : à la fin de la vente, la fiche en cache change (`purchasable`, `salesEnded`, `hasAvailableTickets`, catégories) et dit « achat possible ». Le test 3 était rouge aussi, mais seulement parce que le champ `clockKnown` n'existait pas encore. |
| 453 | `46f10588f` (correctif) | les 10 suites citées **vertes**, dont `d1cbis-fiche-heure` ; typecheck rouge sur un champ manquant d'une fiche de test, corrigé en `7018a060e` |

Dans le navigateur, la capture « fiche en cours » rechargée 3 fois dans chacune de ses 4 vues reste le témoin de l'e2e.

## 4. `f3b-ecrans` sous Windows

Les trois `import(path.join(ROOT, …))` passent par `pathToFileURL(…).href`. Sur ce poste Windows : 27/27, contre 6
rouges avant. Aucune assertion n'a changé.

## Application sur event-village-dev

event-village-dev (`rswkzklxrqswimcxghch`), le 19/11. Contrôles en lecture seule par `supabase db query --linked`.

| Contrôle | Avant | Après |
|---|---|---|
| A. Dernière migration | `20261123000113` | `20261124000001` |
| A2. Versions `20261124*` | aucune | `20261124000001` |
| B. « Mes événements » sert le brut et les remboursements | non | oui |
| C. Ancien message des réglages | présent | absent |
| C2. Nouveau message | absent | présent |
| D. Droits de `partner_events_overview` (anon / authenticated / service_role) | f/f/t | f/f/t |
| D2. Droits de `finance_setting_set` | f/f/t | f/f/t |
| E. SECURITY DEFINER et `search_path=public` des deux fonctions | oui | oui |
| F. Partenaires actifs où recettes nettes = brut − remboursements | — | 1 sur 1 |

- **Dry-run** : exactement `20261124000001_d1cbis_restes.sql`.
- **`db push`** : appliquée sans erreur.
- **`03-verification.sql`** : 20/20 OK.

## Runs

| Run | Commit | Mode | Résultat |
|---|---|---|---|
| 449 | `362855155` (main) | complet | rouge sur une mesure : Mes billets 89 (seuil 90) ; 536/536, e2e et responsive verts |
| 450 | `5a4cf2b6b` | rapide | rouge attendu (tests seuls de l'erreur 418) |
| 453 | `46f10588f` | rapide | 10/10 suites vertes ; typecheck rouge (fiche de test), corrigé |
| 454 | `a8d12f2c1` | rapide | vert (migration, 6/6) |
| 455 | `06f8dd64d` | complet | rouge : `cv11a-5-recopies` (message déclaré remplacé depuis) ; accueil 89 (page non touchée par le lot) |
| 461 | `cb63333ba` | complet | 538/539 ; e2e (635 captures), mesures (accueil 94, fiche 94, Mes billets 91, toucher 96 ms), budgets JS et responsive (0 défaut) verts ; 1 suite rouge, `f2b-recherche-cadence` (ci-dessous) |

**`f2b-recherche-cadence` au run 461.** Les six recherches en parallèle ont été déclarées « indisponible » sans aucun
appel au service (sortie brute : `six en parallèle : 0 servie(s), 6 indisponible(s) ; 0 appel(s)`) : le limiteur
partagé de la recherche de lieu était déjà occupé. Cette suite n'avait échoué sur aucun des 60 runs précédents, et
aucun fichier du lot ne touche la recherche de lieu. Ce rapport la relance seule (run rapide du commit du rapport).

Poids JavaScript au run 461 (budgets non relevés) : `/` 220 320, `/events/[id]` 230 254 (233 316 permis : +457 octets
pour `withClock`), `/tickets` 242 883, `/controller/scanner` 231 751, `/billet/hors-ligne` 222 006.

## Tests

- **Nouveaux** : `tests/parcours/d1cbis-fiche-heure`, `tests/schema/d1cbis-horloge`, `tests/schema/migration-d1cbis-restes`.
- **Modifiés (signalés)** :
  - `design1b-fiche` et `design1b-hydratation` : l'état de la billetterie passe par `withClock` (règle plus stricte) ;
  - `finance-remboursement-billet` : brut, remboursements et net servis par « Mes événements » ;
  - `notif-reglages` : nouveau message du refus ;
  - `cv11a-5-recopies` (audit du lot 11a) : la ligne du message est déclarée remplacée, et sa remplaçante doit être en
    base ;
  - `f3b-ecrans` : `pathToFileURL` ;
  - recette : ligne citée de `finance-remboursement-billet` recalée.

## Points ouverts

- **Run 449 de `main`** : à relancer (une seule mesure sous le seuil, d'un point).
- **Mesure mobile au bord du seuil** : Mes billets (89 à 91) et l'accueil (89 à 94) varient d'un run à l'autre selon la
  machine. Un point sous 90 suffit à rendre un run rouge. À décider : reprendre le rendu de Mes billets, ou revoir la
  mesure.
- **`f2b-recherche-cadence`** : un échec isolé ; à surveiller.
- **Lot 10b** : s'il redéfinit `finance_setting_set` après `20261124000001`, il doit garder le nouveau message
  (`cv11a-5-recopies` et `migration-d1cbis-restes` le diront).
