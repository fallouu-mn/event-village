# Lot « Stabilité » — erreur d'hydratation n° 418 et tests intermittents

Branche `stabilite/hydratation` (depuis main f7bf7ad94), **non fusionnée**. Aucune migration. Aucun budget relevé.
Branche jetable `stabilite/hydratation-preuve` (main + test seul), jamais fusionnée : preuve rouge sur main.

## 1. En bref

| Échec de la consigne | Cause | Correctif | État |
|---|---|---|---|
| React n° 418 (fiche en cours run 767, Explorer en double run 775, calendrier run 787) | **Défaut de React** : la canary embarquée par Next 15.5.28 (`19.2.0-canary-0bdb9206-20250818`) rejoue un élément HTML dont les enfants (composants client pas encore chargés) se sont suspendus pendant l'hydratation, **sans remettre le curseur d'hydratation en arrière** ; React réclame alors un mauvais nœud | Corrigé en amont (issue react #35210, correctif « [Fiber] Correctly handle replaying when hydrating », #35494) ; embarqué par **Next 16.4.6** seulement (Next 15.5.29, dernière 15.x, garde la même canary) | **Décision du 28/11 : montée en Next 16 dans un lot à part.** Reproduit et prouvé rouge sur main ; contrôle durable en place |
| — (trouvé en chemin) | `useFeatureFlags` initialisait son état avec le cache du module | `useSyncExternalStore`, valeur du serveur `null` pendant l'hydratation | Corrigé |
| carte-b3 : repère introuvable (runs 746, 779) | « Aller à » choisi avant que Leaflet soit chargé : choix perdu | Lieu gardé et appliqué à la création de la carte ; test qui attend `data-ev-carte="prete"` | Corrigé, 3 relances vertes |
| lot11cc : « Commencer » puis « Reprendre » (run 774) | Reprise de session dans un `useEffect` : écran de départ peint une image | `useLayoutEffect` (scanner du contrôleur et scan du partenaire) ; clic sur `start.or(resume)` | Corrigé, 3 relances vertes |
| — (trouvé au run 784) | Spec lot12b : « Prévue vers » attendu même après minuit | Test : « Prévue (le <date>) vers HH h MM » | Corrigé (test) |

## 2. Erreur n° 418 : démarche, preuve, cause

### 2.1 Les hypothèses de la consigne ne la reproduisent pas

`e2e/hydratation.responsive.spec.ts` (job responsive) charge l'accueil, Explorer, la fiche de « ce soir » et la fiche d'un
événement **en cours pour le serveur** (créé par le test, début avancé de 20 min par le compte de service), en clair et en
sombre, à 390 px (tactile) et 1 440 px, navigateur à **Tokyo** (serveur en UTC = Dakar), avec ces horloges et conditions :
heure réelle ; juste après la minute suivante ; juste après **minuit à Dakar** ; une seconde après le début ; deux heures après
(« en cours ») ; heure figée à +2 h et trois rechargements (copie exacte de la capture fiche-en-cours) ; morceaux JavaScript
retardés ; réseau « Slow 4G » + processeur ×4 ; processeur ×6. Toute erreur d'hydratation (console ou exception) fait échouer
le test ; Explorer doit avoir **un seul** champ « Rechercher un événement », la fiche un seul titre.

```
run 784 (714557837, test seul)
[hydratation] clair · 390 px : 36 chargements, 0 en échec
[hydratation] clair · 1440 px : 36 chargements, 0 en échec
[hydratation] sombre · 390 px : 36 chargements, 0 en échec
[hydratation] sombre · 1440 px : 36 chargements, 0 en échec
run 787 (5e2423a78) — 16 tests de 19 chargements, tous « 0 en échec » (304 chargements)
run 790 (e44cf5312) — mêmes 304 + « page tardive » 96 : tous « 0 en échec »
```

Lecture du code (fiche, Explorer, accueil, gabarit) : les textes d'heure étaient déjà calculés après le montage (design 1b,
1c bis, 1d), rien n'est lu dans le stockage pendant le rendu, aucune date formatée selon le fuseau de l'appareil. L'erreur
du run 767 est « #418 **HTML** » (structure), pas « text ».

### 2.2 Ce qui l'a fait apparaître : le contrôle durable, puis la sonde

Le contrôle responsive, rendu bloquant par ce lot (§ 3), l'a attrapée en conditions réelles au run 787, sur une page dont le
contenu **n'est pas rendu par le serveur** (squelette jusqu'à la lecture) — l'écart était donc dans le gabarit :

```
run 787 — 1) [responsive] › e2e/responsive.spec.ts:78:21 › clair · organisateur › org-calendrier — Calendrier
+   "erreur d'hydratation sur org-calendrier à 768 px : exception sur /partner/calendar : Error: Minified React error #418; visit https://react.dev/errors/418?args[]=HTML&args[]= …",
```

La sonde (`e2e/support/hydration.ts`) enveloppe le constructeur `Error` : à l'instant où React crée l'erreur, elle relève le
dernier nœud que React a rattaché à un composant, les nœuds suivants, et toutes les écritures faites dans le document avant
(avec la pile). Groupe « page tardive » : seuls les morceaux `/_next/static/chunks/app/…` (pages et gabarits de segment) sont
retardés, la racine arrive à l'heure.

```
run 802 — rechargements répétés · clair · 390 px · org-calendrier (organisateur) · morceaux retardés de 1200 ms · chargement 1/8
  exception sur /partner/calendar : Error: Minified React error #418; … args[]=HTML …
  écart à 1275 ms
    dernier nœud rattaché : span.sr-only   (« Mon compte », fin de l'en-tête)
      composants parents : span < button < div < V{pathname,loggedIn,avatar,displayName,subtitle,sections,onSignOut,themeToggle} < div < header < …
    suivant (non rattaché) : main.mx-auto.w-full.max-w-7xl.flex-1
      enfants du parent (✓ = rattaché) : header.sticky.top-0.z-20.flex ✓ | main.mx-auto.w-full.max-w-7xl.flex-1
    suivant (non rattaché) : div.ev-page-enter
  écritures dans le document avant l'écart (7) :
    23 ms data= sur … > <!--$?-->            $RC (/partner/calendar:2:105)
    30-31 ms removeChild ×3, insertBefore ×2  $RV (/partner/calendar:1:25401…25676)
    31 ms data= sur … > <!--$~-->            $RV (/partner/calendar:1:25711)
```

Occurrences reproduites : run 796 (2), run 802 (4), run 809 (1, **sur main**). Toujours la même signature : l'en-tête
d'AppLayout est hydraté, l'écart commence au `<main>` dont l'enfant est un composant client dont le morceau n'est pas encore
arrivé (le gabarit `app/template.tsx`, puis la page) ; aucun script n'a écrit dans `<main>`.

### 2.3 Preuve rouge sur main

Branche `stabilite/hydratation-preuve` = main f7bf7ad94 + la spec, la sonde et la ligne de CI, **aucun correctif** :

```
run 809 (8854ef4e2, id 46122540801) — responsive : failure
[hydratation] page tardive · clair · 390 px : 36 chargements, 1 en échec
[hydratation] ÉCHEC clair · 390 px · fiche-ce-soir (anonyme) · morceaux de page retardés de 2500 ms · chargement 3/3 :
  exception sur /events/5f003f37-b65b-4592-b9fd-9fa6f9cda574 : Error: Minified React error #418; … args[]=HTML …
  écart à 2546 ms
    dernier nœud rattaché : path   (chevron du menu du compte, fin de l'en-tête)
    suivant (non rattaché) : main.mx-auto.w-full.max-w-7xl.flex-1
      enfants du parent (✓ = rattaché) : header.sticky.top-0.z-20.flex ✓ | main.mx-auto.w-full.max-w-7xl.flex-1
    suivant (non rattaché) : div.ev-page-enter
    suivant (non rattaché) : <!--$-->
```

C'est la page de l'échec du run 767 (fiche de « ce soir »).

### 2.4 Cause

Next lance l'hydratation dans une transition (`node_modules/next/dist/client/app-index.js:223` : `startTransition(() =>
hydrateRoot(…))`). Quand un composant client n'est pas encore chargé, React suspend l'élément HTML qui le contient, puis le
**rejoue** à l'arrivée du morceau ; la canary embarquée ne remet pas le curseur d'hydratation en arrière et réclame le mauvais
nœud → n° 418 « HTML », et React refait toute la page (au run 775, l'ancien `<input>` du serveur et le nouveau sont restés :
deux champs « Rechercher un événement », ids `_R_…_` du serveur et `_r_0_` du navigateur). Plus le morceau arrive tard
(machine chargée, CI à deux workers), plus c'est probable : ≈ une page sur mille en run complet, 1 à 2 % des chargements
« page tardive ».

```
node_modules/next/dist/compiled/react-dom/package.json:73    "react": "19.2.0-canary-0bdb9206-20250818"   (Next 15.5.28, projet)
unpkg next@15.5.29 …/react-dom/package.json:73              "react": "19.2.0-canary-0bdb9206-20250818"   (dernière 15.x, « backport »)
unpkg next@16.4.6  …/react-dom/package.json:73              "react": "19.3.0-canary-278794d7-20261002"   (« latest »)
```

Sources : issue react #35210, fermée le 13/01/2026 par « [Fiber] Correctly handle replaying when hydrating (#35494) » ; un
autre projet décrit la même erreur intermittente sur Next 15.5.29 et 0 décalage après Next 16.4.6 (rostand-dev, PR #109 ;
mesures de son auteur, non vérifiées ici).

**Décision du 28/11** (question posée) : montée en Next 16 dans un **lot à part** (ruptures : middleware renommé proxy,
réglages, Node ≥ 20.9 ; poids et mesure à contrôler). D'ici là, l'erreur reste possible en conditions réelles ; le contrôle
durable la signale (page en échec, avec son nom). Aucun `suppressHydrationWarning` posé (§ 6).

Les groupes de stress (page tardive, rechargements répétés, flux retardé) restent dans la spec, lancés **à la demande** :
ligne `ci-hydratation: stress` du commit (variable `EV_HYDRATATION_STRESS=1` du job responsive). Ils serviront de preuve au
lot Next 16 (0 erreur attendu). Les scénarios des hypothèses de la consigne (§ 2.1) tournent à chaque run.

Scénario « flux retardé » (document coupé avant le premier bloc différé par un script bloquant servi en retard) : 0 erreur
sur 36 au run 809 alors que le document était bien coupé (`explorer … document coupé 3/3 fois`), noté pour le lot Next 16.

### 2.5 Défaut trouvé en chemin : `useFeatureFlags`

`lib/features/client.ts` : `useState(resolved)` — un composant hydraté **après** la première lecture de `GET /api/features`
démarrait avec les interrupteurs lus alors que le serveur avait rendu « pas encore lus ». Écart réel seulement si un service
est ouvert et si l'interrupteur change ce qui est rendu (liste des activités de `/partner/register`, menus). Corrigé par
`useSyncExternalStore(subscribe, clientFlags, serverFlags)` : `null` pendant l'hydratation, puis la valeur lue ; un composant
monté plus tard (navigation dans l'application) l'a tout de suite. Pas de preuve rouge en navigateur : dans les combinaisons
réelles des interrupteurs (salles et tables ouvertes ensemble), l'ordre des activités ne change pas ; garde-fou statique.

## 3. Contrôle durable

- `e2e/support/hydration.ts` : `HYDRATION_ERROR_RE` = `/Minified React error #(418|423|425)\b|Hydration failed|hydrating|did not match/i`,
  `watchHydration(page)` (console `error`/`warning` et exceptions).
- `e2e/responsive.spec.ts` : toute erreur d'hydratation fait **échouer** la page (avant : seulement notée), message
  « erreur d'hydratation sur `<page>` à `<largeur>` : … » ; une erreur arrivée après le relevé de la dernière largeur y est
  rattachée ; relevé de la sonde imprimé au journal.
- `e2e/captures.spec.ts` : même relevé dans les contrôles bloquants, « erreur d'hydratation sur `<écran>` (`<vue>`, `<thème>`) »,
  relevé de la sonde dans le journal et les notes de la capture.
- La recette n'est pas modifiée : ses numéros de ligne sont figés par la matrice de recette.

## 4. Tests intermittents

### 4.1 carte-b3 (runs 746, 779)

Contexte d'erreur du run 779 (`playwright-responsive/…/error-context.md`) : « Thiès » choisi, mais carte au zoom minimal
(« Zoom arrière » désactivé), repères regroupés (`18 événements et lieux : agrandir`) :

```
  - option "Thiès" [selected]
  - region "Carte des événements et des lieux":
      - 'button "18 événements et lieux : agrandir"': "18"
      - button "Zoom arrière" [disabled]
```

Cause : la liste « Aller à » est utilisable avant le chargement de Leaflet ; `choosePlace` trouvait `mapRef.current` nul, le
déplacement était perdu, puis la carte se créait sur tout le Sénégal. Défaut réel (un utilisateur rapide perd son choix).
Correctif (`components/explore/ExploreMap.tsx`) : `pendingPlaceRef`, appliqué à la création de la carte (sans animation) ;
état exposé (`aria-busy`, `data-ev-carte="chargement|prete"`). Test : attend `data-ev-carte="prete"` avant « Aller à »
(deux tests).

### 4.2 lot11cc (run 774)

Cause : `app/controller/scanner/page.tsx`, reprise de session (A10) dans un `useEffect`, après la peinture : l'écran
« Commencer le contrôle » s'affichait une image puis la caméra (« Reprendre le contrôle ») le remplaçait. Le test lisait
« Commencer » et cliquait pendant qu'il disparaissait ; un contrôleur pouvait le toucher aussi. Correctif : `useLayoutEffect`
(décision avant l'affichage), et même correctif dans `app/partner/scan/page.tsx` (même schéma). Test : un seul clic sur
`start.or(resume)`, résolu au moment de l'action.

### 4.3 lot12b, minuit (run 784, trouvé pendant le lot)

```
Locator: getByTestId('heure-estimee')
Expected substring: "Prévue vers"
Received string:    "Prévue le sam. 28 nov. 2026 vers 00 h 06"
```

L'écran est juste (`OrderTracking`, `whenText` : date affichée quand l'heure estimée n'est pas aujourd'hui ; données lues par
le navigateur, aucun risque d'hydratation). Test : `/Prévue (le .+ )?vers \d{2} h \d{2}/`.

## 5. Runs

Résultats lus par l'API GitHub et les fichiers bruts de ci-results (jamais de `git fetch` de ci-results).

| Run | Commit | Objet | Résultat |
|---|---|---|---|
| 784 | 714557837 | test seul (hypothèses) | responsive rouge : hydratation 144 / 0 erreur ; seul rouge lot12b « Prévue vers » (minuit) |
| 787 | 5e2423a78 | correctifs carte et scanner, contrôle durable, reproduction élargie | rapide vert (32 suites) ; captures sombres 416/416 ; responsive rouge : n° 418 org-calendrier 768 px (contrôle durable) |
| 790 | e44cf5312 | + page tardive | entièrement vert (aucune occurrence) |
| 796 | f88613fbb | + correctif `useFeatureFlags`, sonde, suite statique | 2 × n° 418 (page tardive, rechargement) ; reste vert |
| 800 | 5a06584a5 | sonde affinée | entièrement vert (aucune occurrence) |
| 802 | 1c8a55daf | + rechargements répétés | 4 × n° 418 avec relevé précis ; reste vert |
| 809 | 8854ef4e2 (preuve) | **main + test seul**, stress | **rouge : n° 418 fiche de « ce soir »** |
| 810 | 041fe0d6a | **relance n°1** | responsive 265 OK (12 stress sautés) ; captures sombres 415/416 : `pilotage-apercu` mobile, axe `document-title` (page sans `<title>` au contrôle ; titre du gabarit racine, hors lot) |
| 819 | 5a901d3e3 | **relance n°2** | **entièrement vert** : responsive 265, captures sombres 416/416 |
| 820 | 8ebaceeaf | **relance n°3** | **entièrement vert** : responsive 265 (12 stress sautés), captures sombres 416/416, rapide 34 suites (job_status=success) |
| [[RUN_COMPLET_NUM]] | [[RUN_COMPLET_SHA]] | **run complet** (rapport) | [[RUN_COMPLET]] |

Trois relances : carte-b3, lot11cc et lot12b n'ont échoué dans aucune (810, 819, 820) ; le n° 418 n'est apparu
dans aucune (hors groupes de stress, sautés).

## 6. Poids et mesure mobile

Seul code chargé par toutes les pages : `lib/features/client.ts` (`useSyncExternalStore` au lieu de `useState`) et
`app/controller/scanner/page.tsx`, `app/partner/scan/page.tsx` (`useLayoutEffect`) ; `components/explore/ExploreMap.tsx` est
chargé à l'ouverture de la carte seulement.

| Route | main, run 782 (gzip / budget) | lot, run complet [[RUN_COMPLET_NUM]] |
|---|---|---|
| `/` | 215 587 / 226 342 | [[P_ACCUEIL]] |
| `/events/[id]` | 224 522 / 233 316 | [[P_FICHE]] |
| `/tickets` | 240 960 / 250 417 | [[P_BILLETS]] |
| `/controller/scanner` | 225 251 / 234 911 | [[P_SCANNER]] |
| `/billet/hors-ligne` | 214 201 / 224 268 | [[P_HORS_LIGNE]] |
| `/explore` | 226 214 / 235 712 | [[P_EXPLORER]] |

Mesure mobile (Lighthouse, médiane de 5) : main run 782 accueil 94, fiche 93, Mes billets 93 ; lot [[MESURE]].

`suppressHydrationWarning` : aucun nouveau ; seuls ceux d'avant le lot restent (`app/layout.tsx` `<html>`/`<body>`, thème posé
avant l'affichage ; `components/ui/ThemeToggle.tsx`) — vérifié par `tests/schema/stabilite-hydratation.test.ts`.

## 7. Tests modifiés (signalés)

| Fichier | Avant | Après | Raison |
|---|---|---|---|
| `e2e/carte-b3.responsive.spec.ts` (2 tests) | « Aller à » dès que les couches sont visibles | attend aussi `[data-ev-carte="prete"]` | état réel de la carte (consigne, point 4) |
| `e2e/lot11cc.responsive.spec.ts` l. 303-305 | lit `resume.isVisible()` puis clique `start` ou `resume` | `start.or(resume)` vérifié puis cliqué | libellé transitoire (consigne, point 5) |
| `e2e/lot12b.responsive.spec.ts` l. 323 | `toContainText('Prévue vers')` | `toContainText(/Prévue (le .+ )?vers \d{2} h \d{2}/)` | heure estimée après minuit (run 784) |
| `e2e/responsive.spec.ts` | erreurs de la page notées | erreur d'hydratation **bloquante** + sonde | contrôle durable (consigne, point 3) |
| `e2e/captures.spec.ts` | exceptions déjà bloquantes | + erreur d'hydratation nommée, sonde | contrôle durable |

Ajoutés : `e2e/hydratation.responsive.spec.ts`, `e2e/support/hydration.ts`, `tests/schema/stabilite-hydratation.test.ts`.
`tests/audit/` et `tests/audit-auth/` : aucune modification. CI : ligne `ci-hydratation: stress` (`.github/workflows/verify.yml`,
job « mode » et étape responsive).

## 8. Commits

```
713802f85 fix(stabilité): carte d'Explorer — lieu « Aller à » choisi avant que la carte soit prête gardé et appliqué
3e9466fbf fix(stabilité): scanner — reprise de session décidée avant l'affichage
102d11198 test(stabilité): contrôle durable — erreur d'hydratation bloquante dans le contrôle responsive, nommée dans les captures
4069b512e test(stabilité): spec lot12b — heure estimée après minuit acceptée
2c3023ea1 fix(stabilité): useFeatureFlags — valeur du serveur (null) pendant l'hydratation
714557837, f22694a56, e44cf5312, d8f5dbaa4, f88613fbb, 5a06584a5, 1c8a55daf, e16f20e43 : reproduction, sonde, suite statique
5e2423a78, 041fe0d6a, 5a901d3e3, 8ebaceeaf : runs rapides (commits vides)
```

## 9. Points ouverts

1. **Lot Next 16** (décision du 28/11) : Next 16.4.6, puis `ci-hydratation: stress` doit donner 0 erreur ; ruptures
   (middleware → proxy, réglages, Node ≥ 20.9), poids et mesure à contrôler.
2. Jusque-là, un n° 418 reste possible en conditions réelles (≈ une page sur mille en run complet) ; le contrôle responsive et
   les captures le signalent avec le nom de la page. Consigne habituelle : relance du job, avec le relevé de la sonde au journal.
3. Capture `pilotage-apercu` mobile sombre, axe `document-title`, vue une fois (run 810), pas revue aux runs 819 et
   820 : à surveiller (hors lot).
4. Branche `stabilite/hydratation-preuve` : jetable, gardée sur le dépôt pour la preuve ; à supprimer quand vous voulez.
