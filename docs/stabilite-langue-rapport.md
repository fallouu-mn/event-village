# Mini-lot stabilité : langue et fuseau des e2e

Branche `stabilite/langue`, partie de main 15a51f663, main d0bbe8caa (design 1d) fusionné dans la branche avant le run complet.

## Cause

Au run 498, la capture admin-notifications sur ordinateur a lu le gabarit de date « mm/dd/yyyy » au lieu de « dd/mm/yyyy ». Le même code était vert aux runs 477, 486 et 494.

Les options `locale` et `timezoneId` de Playwright règlent la page (`navigator.language`, `Intl`), mais pas le gabarit du champ `<input type="date">`. Sous Linux, Chromium prend ce gabarit dans les variables d'environnement LANG et LANGUAGE, et ignore `--lang`. Le format dépendait donc de la machine du CI.

## Changements (tests seulement, aucun code de l'application)

- `e2e/support/devices.ts` :
  - `FR_CONTEXT` règle la langue sur `fr-FR` et le fuseau sur `Africa/Dakar` ;
  - `frBrowserEnv()` reprend l'environnement du processus et y ajoute `LANG`/`LC_ALL=fr_FR.UTF-8`, `LANGUAGE=fr` et `TZ=Africa/Dakar`. Le processus est recopié parce que `launchOptions.env` remplace tout l'environnement.
- `playwright.config.ts` : `FR_CONTEXT` et le lancement français s'appliquent au `use` global et à chacun des 13 projets, y compris `responsive`, `emails` et `dev-page`. Il faut le répéter dans chaque projet parce qu'un `launchOptions` de projet remplace le global.
- Contextes créés à la main : `poster.ts`, `emails.spec.ts` et `dev-page.spec.ts` reçoivent `FR_CONTEXT`. Ceux qui passent par `projectContextOptions`, y compris les nouveaux de la fumée du design 1d, héritent du réglage du projet.
- `expectFrenchDateField` (`screens.ts`) écrit une ligne `[LANGUE]` dans le journal. L'assertion est inchangée.
- Exception, le projet `pwa` : il garde le lancement de main (`args: [HOST_RESOLVER_RULES]`, sans l'environnement LANG/TZ). Son test lance son propre Chromium persistant, qui hérite du `launchOptions` du projet, et avec cet environnement il ne reçoit plus `beforeinstallprompt` : délai dépassé de 120 s aux runs 513 et 516. Ce test fixe déjà fr-FR et Dakar lui-même et n'a aucun champ de date.
- Fichiers laissés tels quels :
  - `e2e/installable.spec.ts` a déjà fr-FR et Dakar. Au run 513, une ligne ajoutée dans ce fichier a décalé les lignes que cite `docs/recette-billetterie.md`, ce qui a fait rougir `recette-matrice`. Le test PWA est aussi tombé en délai dépassé avec l'environnement LANG. Le fichier a été remis comme dans main (22bace61d), et le run rapide 514 est vert.
  - `scripts/e2e/perf-mobile.mjs` lance Lighthouse hors des projets Playwright, et son contexte a déjà fr-FR et Dakar.

## Preuve : run 513, capture admin-notifications

```
[LANGUE] champ de date 390 px, clair : gabarit « dd/mm/yyyy », navigateur fr-FR (fr-FR), fuseau Africa/Dakar, lang de la page « fr »
[LANGUE] champ de date 390 px, sombre : gabarit « dd/mm/yyyy », navigateur fr-FR (fr-FR), fuseau Africa/Dakar, lang de la page « fr »
[LANGUE] champ de date 1440 px, clair : gabarit « dd/mm/yyyy », navigateur fr-FR (fr-FR), fuseau Africa/Dakar, lang de la page « fr »
[LANGUE] champ de date 1440 px, sombre : gabarit « dd/mm/yyyy », navigateur fr-FR (fr-FR), fuseau Africa/Dakar, lang de la page « fr »
```

Les captures correspondantes sont dans `runs/513-44778802975/captures/` : `admin-notifications__{mobile,ordinateur}__{clair,sombre}.png`.

## Runs

| Run | Commit | Résultat |
|---|---|---|
| 513 (complet) | d74d223e8 | Rouge, à cause de `installable.spec.ts` (voir plus haut). La preuve est faite. Mes billets à 89, sur une page non touchée. |
| 514 (rapide) | 22bace61d | Vert |
| 516 (complet, main d0bbe8caa fusionné) | 901aee675 | Rouge : seul le test PWA est en échec (délai dépassé). Mesure mobile verte, responsive vert, 707 captures vertes. |
| 517 (complet, correctif `pwa`) | 8fa28063a | e2e verts (PWA compris), responsive vert. Mesure mobile rouge sur la seule page Mes billets : 88 (accueil 93, fiche 90). |

## Décision : Mes billets à 88 accepté

Le 21/11, l'utilisateur a accepté le 88 de Mes billets au run 517 (option 2). Ce lot ne touche aucun code de l'application. main a aussi Mes billets sous 90 sans ce lot : 89 au run 515 (d0bbe8caa, accepté dans le rapport du design 1d), 88 au run 518 (317785209).

C'est une règle temporaire, jusqu'au Design 1e qui traite Mes billets : pour le run de main qui suit cette fusion, une note de Mes billets sous 90 ne bloque pas à elle seule. Le seuil de 90 lui-même ne change pas.

## Fusion

main 317785209 (rapport du design 1d, documentation seulement) a été fusionné dans la branche, puis la branche a été fusionnée dans main avec `--no-ff`. Le run de main qui suit cette fusion fait foi.
