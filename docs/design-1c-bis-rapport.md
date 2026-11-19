# Design 1c bis — Restes du design 1c

Branche `design-1c/bis`, partie de `main` à `362855155` (fusion du design 1c). Une migration :
`20261124000001_d1cbis_restes.sql`.

## Fusion du design 1c

- `design-1c/pro` est fusionnée dans `main` en `--no-ff` (`362855155`), sans conflit : `main` n'avait pas bougé depuis
  `fce22b609`. L'arbre fusionné est identique à celui du run 444, qui était vert.
- Décisions 1 à 6 du rapport du design 1c : validées par l'utilisateur le 19/11.
- Run complet de `main` : __RUN_MAIN__.

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

__APPLICATION__

## Runs

__RUNS__

## Tests

- **Nouveaux** : `tests/parcours/d1cbis-fiche-heure`, `tests/schema/d1cbis-horloge`, `tests/schema/migration-d1cbis-restes`.
- **Modifiés (signalés)** :
  - `design1b-fiche` et `design1b-hydratation` : l'état de la billetterie passe par `withClock` (règle plus stricte) ;
  - `finance-remboursement-billet` : brut, remboursements et net servis par « Mes événements » ;
  - `notif-reglages` : nouveau message du refus ;
  - `f3b-ecrans` : `pathToFileURL` ;
  - recette : ligne citée de `finance-remboursement-billet` recalée.

## Points ouverts

__OUVERTS__
