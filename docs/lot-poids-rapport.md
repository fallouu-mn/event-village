# Lot poids — retrouver une vraie marge de JavaScript avant les écrans des commandes

Branche `lot-poids/marge`, partie de `main` à `dfac0c9ad`, `main` refusionnée après le lot Carte B (`c3a5f0ada`, puis
`64a261116`). **Fusionnée dans `main` le 25/11/2026** (feu vert de l'utilisateur), en `--no-ff` : commit de fusion
**`71a42f01a`**, sur `main` à `64a261116` (inchangé depuis la carte B). **Run complet de `main` 646 entièrement vert** :
- 602 suites (151 + 150 + 150 + 151) ;
- e2e : 787 captures, 0 en échec ; fumée, terrain, recette, déconnexion et connexion-course OK ;
- contrôle responsive : 190 résultats, 0 défaut ;
- budgets : mêmes octets qu'au run 643 sur les six routes ;
- mesure mobile 92 / 91 / 90, valide dès la tentative 1. Mes billets est au seuil, médiane de
  [90 ; 89 ; 93 ; 89 ; 93]. Au run 643, la mesure était 94 / 95 / 94, avec exactement le même JavaScript (code
  identique, mêmes octets) : l'écart vient de la variation d'une mesure à l'autre.

**Aucune migration.** Aucun budget relevé ; seuils, calibration et
médiane de la mesure mobile inchangés. Déconnexion, client Supabase de la session et dessin du QR : non touchés.

## À lire en premier

**Objectif atteint, largement.** Marge d'au moins **9 746 octets gzip** sur chaque route budgétée (objectif : 3 000), contre
34 à 1 997 avant. Run complet final **643** (`33c74dbad`) **entièrement vert** : 602 suites, e2e (783 captures, 0 en échec,
fumée, terrain, recette, déconnexion), contrôle responsive 190 / 0 défaut, budgets, mesure mobile **94 / 95 / 94** dès la
tentative 1.

**Quatre économies réelles sur le code commun à toutes les pages, sans rien retirer à l'utilisateur** (§ 2) :

| Économie | Gain par route |
|---|---|
| Fusion des classes (`cn`) sans la configuration complète de tailwind-merge — même résultat, prouvé | ~2 300 |
| Pas de polyfill `Buffer` dans le navigateur | 6 644 |
| Gabarit `app/template.tsx` en composant client, même balisage | 721 |
| Table des morceaux : empreintes de 8 caractères, une variante de la carte d'un lieu en moins | ~280 |

Et la demande complémentaire : l'aperçu de la carte de l'accueil n'est plus dans l'îlot « Près de chez vous » (**−3 080**),
il est chargé à l'apparition de sa place.

**Un point à connaître (sécurité du stockage, choix validé le 25/11).** Le retrait du polyfill `Buffer` touche
l'environnement que Next donne aux bibliothèques du navigateur, dont `@supabase/storage-js` (une ligne, jamais empruntée
ici). Le client Supabase de la session n'est pas touché. Comme demandé, les parcours qui touchent aux fichiers, au stockage
et à la session ont été vérifiés au run complet : **tous verts** (§ 5.2) ; le polyfill n'avait pas à être remis.

**Un rouge rencontré et corrigé** : au premier run complet (641), une suite appelait `cn` hors construction (sous Node), où la
table des classes n'était pas calculée. Corrigé (§ 2.1) et vert au run 643.

**Tests existants modifiés** (attentes de l'ancien montage, aucune assertion d'audit) : § 8. Aucune suite de `tests/audit/`
ni de `tests/audit-auth/` modifiée.

## 1. Poids par route, avant et après

Mesure : `scripts/js-budget.mjs` (gzip niveau 9 des fichiers .js distincts de `/layout` ∪ `/template` ∪ la page),
inchangée.

| Route | Budget (inchangé) | Avant le lot (run 629, `main` dfac0c9ad) | `main` actuel (run 640, carte B fusionnée) | Après (run complet 643) | Gain sur `main` actuel | Marge après |
|---|---|---|---|---|---|---|
| `/` | 226 342 | 224 700 | 224 716 | 214 995 | −9 721 | **11 347** |
| `/events/[id]` | 233 316 | 233 282 | 233 299 | 223 570 | −9 729 | **9 746** |
| `/tickets` | 250 417 | 250 348 | 250 365 | 239 915 | −10 450 | **10 502** |
| `/controller/scanner` | 234 911 | 234 639 | 234 656 | 224 874 | −9 782 | **10 037** |
| `/billet/hors-ligne` | 224 268 | 223 748 | 223 765 | 213 992 | −9 773 | **10 276** |
| `/explore` | 235 712 | 233 715 | 234 823 | 225 502 | −9 321 | **10 210** |

Marges avant le lot : 1 642, 34, 69, 272, 520 et 1 997 octets.

Table des morceaux chargeables (`webpack.js`) : 49 entrées sur `main` actuel, **49** après (une variante de la carte d'un
lieu en moins, le morceau de l'aperçu de l'accueil en plus) ; `webpack.js` 3 379 → 3 145 octets (empreintes de 8 caractères).

Fichiers communs qui ont changé (code commun, chargé par toutes les routes ; runs 629 → 643) :

| Fichier | Avant | Après | Cause |
|---|---|---|---|
| morceau de tailwind-merge (`24909.js`) | 6 969 | — (disparu) | § 2.1 (table et moteur, ~4 600, répartis dans les morceaux communs) |
| code client de Next (`96140.js`) | 54 113 | 47 469 | § 2.2 (polyfill `Buffer`) |
| `app/template.js` | 997 | 276 | § 2.3 |
| `webpack.js` | 3 363 | 3 145 | § 2.3 |

## 2. Économies, une par une

Chaque gain est lu sur le run qui l'introduit, contre le run précédent (même mesure).

### 2.1 Fusion des classes sans la configuration complète de tailwind-merge (pistes 1 et 3)

**Constat.** `components/ui/cn.ts` (117 fichiers l'emploient, dont la coquille) appelait `extendTailwindMerge`. Le paquet
embarque sa configuration complète — toutes les classes possibles de Tailwind, avec leurs règles — dans le JavaScript de
**chaque** page : morceau `24909.js`, 6 969 octets gzip au run 629. Mesure locale, minifié comme en production : moteur
seul 1 540 octets, configuration 5 400.

**Économie.** La fusion n'a besoin, pour une classe, que de son groupe (`p`, `px`, `bg-color`, `font-size`…) et des
groupes en conflit. Ces données sont calculées par tailwind-merge lui-même (même configuration qu'avant, `text-caption`
compris), pour les seules classes écrites dans le code (976 classes, 139 groupes), par `scripts/cn-classes.cjs` :
- dans toute construction webpack (navigateur, serveur, développement), un chargeur (`scripts/cn-classes-loader.cjs`,
  branché dans `next.config.mjs`) remplace `components/ui/cn-classes.ts` par la table calculée : même table des deux côtés,
  aucun écart à l'hydratation ; en développement, la table suit les fichiers modifiés ;
- hors construction (tests sous Node, scripts), `components/ui/cn-classes.ts` calcule la même table au chargement avec le
  même générateur (ajouté après le run 641, voir plus bas).

**En développement (`npm run dev`, recette locale), la fusion marche aussi** : `npm run dev` lance `next dev` avec webpack
(sans Turbopack), donc le chargeur remplace `cn-classes.ts` comme au build, côté navigateur et côté serveur. Ce n'est pas
le calcul hors construction qui sert ici : celui-ci ne concerne que les tests et scripts sous Node. Preuve : le test
« npm run dev » de `tests/schema/poids-cn.test.ts`, ajouté à la fusion. Il exécute la vraie fonction `webpack` de
`next.config.mjs` en phase `next dev` (`dev: true`, navigateur et serveur) et vérifie que la règle s'applique au fichier.
Il vérifie aussi que le chargeur rend la table calculée, et qu'aucun script ne passe par Turbopack, qui ignorerait cette
règle.

`cn.ts` reprend pas à pas l'algorithme de tailwind-merge 2.6.1 (`mergeClassList`, `parseClassName`, `sortModifiers`).
Garde-fou : `cn` refuse une table vide (la fusion ne doit jamais cesser en silence) ; le générateur refuse une autre version
de tailwind-merge tant que l'algorithme n'a pas été revérifié.

**Même résultat, prouvé.** `tests/schema/poids-cn.test.ts` compare le nouveau `cn` à l'ancien (tailwind-merge 2.6.1, même
extension) : **toutes les paires** de classes du code (1 010 025), **150 000 suites** tirées au hasard (modificateurs,
variante arbitraire, `!`, valeurs négatives, suffixes `/…`, propriétés arbitraires, mots hors Tailwind, blancs multiples)
et **chaque mot des sources** classé par tailwind-merge : **0 écart**. Le test sait échouer : une mutation volontaire
(conflits ignorés) donne 2 431 écarts. Une classe absente des sources n'a pas de CSS (Tailwind ne la produit pas) : elle est
gardée telle quelle — seul cas où la chaîne de classes peut différer, sans effet à l'écran.

**Rouge du run complet 641, corrigé.** Toutes les suites, l'e2e, la mesure et le contrôle responsive étaient verts, sauf
`tests/schema/design1e-orange.test.ts` : cette suite appelle `cn` sous Node, hors webpack, où `cn-classes.ts` était alors le
fichier vide du dépôt ; sans table, `text-sm` ne retirait plus `text-[1.1875rem]`. En production la table était bien là
(captures et mesure vertes), mais le comportement hors construction différait : corrigé (`819ab19d7`, calcul de la table
hors construction, refus d'une table vide partout, test : le fichier du dépôt importé tel quel donne la même table et le
même `cn` que tailwind-merge). Vert au run 643.

**Gain mesuré** (run 631 contre 629) : `/` −2 256, `/events/[id]` −2 283, `/tickets` −2 984, `/controller/scanner` −2 316,
`/billet/hors-ligne` −2 307, `/explore` −1 873 octets gzip. La table pèse 3 242 octets dans le code commun, le moteur ~1 400.

### 2.2 Pas de polyfill `Buffer` dans le navigateur (piste 3)

**Constat** (relevé du run 631). Le polyfill `next/dist/compiled/buffer` était dans le morceau du code client de Next
(`96140.js`), donc dans toutes les pages. Next fournit `Buffer` (ProvidePlugin) à tout module du navigateur qui le cite.
Balayage de toutes les dépendances du navigateur : **une seule** ligne le cite, dans `@supabase/storage-js` (`toBase64` :
`if (typeof Buffer !== "undefined") return Buffer.from(data).toString("base64"); return btoa(data);`), qui encode les
métadonnées d'un téléversement. Aucun code du navigateur n'emploie `supabase.storage` : tous les téléversements passent par
les routes du serveur (`components/ui/ImageUpload.tsx` → `/api/partner/upload` pour l'affiche, les photos des salles et des
établissements, le logo et les produits ; formulaires des pièces des partenaires et de la photo du compte). Ni le code client
de Next, ni React, ni aucun autre paquet ne cite `Buffer`.

**Économie.** `Buffer` retiré du ProvidePlugin de la construction du **navigateur** (`next.config.mjs`) ; serveur et Edge
inchangés. Si un téléversement par `supabase.storage` était un jour fait depuis le navigateur, la bibliothèque prendrait sa
voie navigateur prévue (`btoa`). **Le client Supabase de la session n'est pas touché** (aucun fichier de `lib/supabase/`,
aucune option du client). Garde-fou : `tests/schema/poids-buffer.test.ts` refuse toute nouvelle référence à `Buffer` dans
les dépendances du navigateur ou dans le code qu'il charge (fichiers « use client » et tout ce qu'ils importent), et tout
emploi de `supabase.storage` côté navigateur.

**Gain mesuré** (run 634 contre 631) : `96140.js` 54 113 → 47 469 octets, soit **−6 644 sur toutes les routes**. Le relevé
l'estimait à ~2 100 : il répartit le poids d'un fichier au prorata des sources, et ce polyfill est déjà minifié (7 803
octets gzip à lui seul, mesuré ensuite sur le fichier). Vérification des parcours concernés : § 5.2.

### 2.3 Table des morceaux et gabarit (piste 4)

- **Empreintes de 8 caractères.** `webpack.js`, chargé par toutes les pages, garde l'empreinte de chaque morceau chargeable
  (16 caractères, réglage de Next). Morceaux chargeables du navigateur nommés `[name].[contenthash:8].js` : les noms restent
  uniques (numéro du morceau) et changent avec le contenu ; fichiers du premier chargement, serveur et développement
  inchangés ; le service worker repère les ressources sans dépendre de cette longueur. `webpack.js` : 3 393 → 3 124 octets
  (**−269 sur toutes les routes**, run 634).
- **Une variante de moins.** Sur `main`, la carte d'un lieu (`components/ui/EventMap`) existait en deux morceaux
  (`65905`, `88286`) : six `import()` à six endroits (fiche ×2, pilotage, trois pages d'administration, tous en
  `ssr: false`). Tous passent par `components/ui/event-map-load.ts` : **un seul morceau**, une entrée de moins (run 634).
- **Gabarit qui n'emporte plus 400 numéros.** `app/template.js`, chargé par toutes les pages, pesait 997 octets pour un
  module vide : son contenu était la liste d'environ 400 numéros de morceaux (relevé du run 634). `app/template.tsx` étant
  un composant serveur, son morceau du navigateur était vide, et webpack fusionne les morceaux identiques : il le fusionnait
  avec tous les morceaux vides de l'application (segments sans composant client), dont il portait les numéros. Le gabarit
  devient un composant client au **même balisage** (`<div className="ev-page-enter">`, aucun état, aucun import) :
  997 → 276 octets, **−721 sur toutes les routes** (run 635).

### 2.4 Aperçu de la carte de l'accueil chargé à l'apparition de sa place (demande complémentaire)

**Constat** (contre-vérification de la carte B, confirmé au run 637 de `carte-b/explorer` et au run 640 de `main`) :
l'îlot « Près de chez vous », chargé après la page, portait le code de l'aperçu (`SenegalMapPreview` importé sans
`import()`) : morceau `34326`, 9 240 octets gzip.

**Deux montages mesurés** (branche jetable `lot-poids/essai-apercu` = ce lot + `carte-b/explorer` 2d9c86983, jamais
fusionnée, supprimée ensuite) :

| Montage | Table | Îlot | Téléchargé à l'apparition de la section | Module de la carte d'Explorer |
|---|---|---|---|---|
| Avant (run 637, carte B seule) | 49 | 9 240 | — (aperçu dans l'îlot) | 10 302 |
| A — aperçu ajouté au module d'Explorer (`lazy.ts`), run 638 | 50 | 6 181 | 10 770 + 206 | 10 770 |
| **B — aperçu dans son propre morceau, run 639 (retenu, validé le 25/11)** | 50 | **6 160** | **3 392** | 10 303 (inchangé) |

(Ces deux essais portent encore la variante de la carte d'un lieu supprimée au § 2.3 dans le décompte « 49 » de la carte B
seule : d'où 50, et 49 au run final.)

Le montage A, suggéré par la consigne, ne crée pas de variante du module d'Explorer, mais un **reste** de 206 octets propre
à l'accueil : l'icône `Search`, déjà chargée par la page Explorer (donc retirée du morceau quand on vient d'Explorer) et
absente de l'accueil. Les deux montages coûtent la même entrée de table (~9 octets par route depuis les empreintes de 8
caractères) ; B fait télécharger trois fois moins et ne touche pas le module d'Explorer. Supprimer le reste de A demanderait
de dupliquer l'icône dans le module ou de faire charger `Search` par l'accueil : écarté.

**Retenu : B.** `components/events/HomeSenegalMap.tsx` demande `import('@/components/explore/SenegalMapPreview')` quand la
place de l'aperçu devient visible (même `IntersectionObserver`, même seuil 0,1, place réservée inchangée : aucun saut de
mise en page) ; chargement impossible : l'aperçu est retiré et la section garde son bouton, comme pour des tuiles absentes.
**Gain : îlot −3 080 octets gzip** ; l'aperçu (3 392) n'est téléchargé que si la section apparaît à l'écran. Audit `cvcb-2`
inchangé et vert.

## 3. Essayé sans gain, ou écarté

- **Icônes (piste 2).** Aucune bibliothèque d'icônes n'entre en entier : `lucide-react` 0.441 est dans la liste
  `optimizePackageImports` par défaut de Next 15.5 (`node_modules/next/dist/server/config.js`), seules les icônes importées
  sont construites. Les 26 icônes de la coquille pèsent ~2 100 octets gzip ensemble (relevé : 2 976 pour toutes celles du
  code commun). Retirer leurs attributs `key` aléatoires (~400 octets, peu compressibles) a été écarté : lucide passe les
  tracés en tableau d'enfants (`Icon.js`), les clés y sont nécessaires (avertissements de React sinon), et il faudrait
  réécrire un paquet tiers au build.
- **Menu du compte au premier geste.** `components/layout/AccountMenu.tsx` (~1 100 octets) ne sert qu'au clic, mais il porte
  le bouton « Se déconnecter » : non touché (règle du lot).
- **Table des classes limitée à `app/` et `components/`** (dossiers lus par Tailwind) : 38 classes de moins seulement, gain
  négligeable ; l'univers garde aussi `lib/` et `hooks/`.
- **Aides de développement.** `compiler.removeConsole` : 7 `console.log`, 16 `console.info`, 1 `console.debug` dans tout le
  code, presque tous côté serveur : gain négligeable. Les 214 `console.warn` et 680 `console.error` sont des diagnostics
  voulus par les lots précédents (« journalisé ») : gardés.
- **Polyfills de Next.** Hors `Buffer` (§ 2.2), le seul polyfill servi aux navigateurs modernes est `polyfill-module`
  (596 octets gzip : `trimStart`, `flat`, `Promise.finally`, `Object.fromEntries`…) ; `polyfill-nomodule` (39,5 Ko) ne va
  qu'aux navigateurs sans modules et n'est pas compté. Le retirer, ou relever la cible de transpilation (`browserslist`
  absent : cible par défaut de Next, Chrome 64 et Safari 12), empêcherait l'application de s'ouvrir sur des téléphones anciens
  qui l'affichent aujourd'hui : c'est une décision de produit, pas une économie « sans rien retirer ». Non fait ; voir § 7.
- **Doublons de versions.** Aucun paquet du navigateur en deux versions dans `package-lock.json` (Supabase 2.114.0 partout,
  `clsx`, `tslib`, `cookie`, `@zxing/*`, `qrcode.react`, `leaflet` : une version chacun).
- **Modules en double dans un même premier chargement : trouvés, NON traités (piste pour un lot suivant).** Le relevé du
  run 635 montre, par route, 11 à 20 modules présents à la fois dans le morceau du layout (ou un morceau commun) et dans
  celui de la page, donc téléchargés deux fois : ~1 900 (`/explore`) à ~3 300 (`/tickets`) octets gzip estimés ; sur la
  fiche : `components/ui/Toast.tsx` (~650), `hooks/useRealtimeRefresh.ts` (~440), `lib/ui/warm-when-idle.ts` (~350),
  `IconButton`, `LinkButton`, `IntentLink`, le cœur de `lucide-react` (`Icon`, `createLucideIcon`) et `clsx`. Cause : Next
  construit le layout et chaque page comme des entrées séparées, et webpack ne met en commun que les groupes de modules
  au-dessus d'un seuil de taille. Le traiter demande de régler la découpe des morceaux de Next (groupe commun aux entrées) et
  de revérifier toutes les routes : hors du temps de ce lot, l'objectif étant déjà dépassé de trois fois. Voir § 7.
- **Supabase** (~70 Ko du code commun : `GoTrueClient`, `storage-js`, `postgrest-js`, `realtime-js`, `GoTrueAdminApi`,
  `webauthn`, `iceberg-js`…) : client de la session, hors du lot (décision du 21/11). C'est désormais le plus gros poste du
  code commun après React et le routeur de Next.

## 4. Mesure mobile, avant et après

Lighthouse mobile, médiane de 5 passages, seuil 90 ; seuils, calibration et médiane inchangés.

| Run | Processeur | Accueil | Fiche | Mes billets |
|---|---|---|---|---|
| 629 (avant, `main` dfac0c9ad) | ×3,7 à ×3,9 | 94 | 91 | 91 |
| 640 (`main` actuel, carte B fusionnée) | ×4,4 à ×4,9 | 90 | 93 | 92 |
| 631 (fusion des classes) | ×3,6 à ×4,1 | 93 | 92 | 90 |
| 634 (polyfill, table) | ×3,2 à ×3,8 | 94 | 92 | 92 |
| 635 (gabarit) | ×3,6 à ×4,0 | 94 | 90 | 93 |
| 641 (run complet, après fusion de `main`) | ×3,1 à ×4,0 | 93 | 92 | 91 |
| **643 (run complet final)** | ×3,7 à ×4,0 | **94** | **95** | **94** |

Tentative 1 valide au run 643 (aucune mesure faussée). Les écarts d'un run à l'autre suivent surtout la machine (colonne
« Processeur ») ; aucun run du lot sous le seuil.

## 5. Preuve que l'écran et le comportement sont inchangés

### 5.1 Écrans

- **Fusion des classes** : équivalence exacte avec tailwind-merge sur toutes les classes du code (§ 2.1), donc mêmes classes
  sur tous les écrans ; captures et contrôle responsive verts.
- **Run complet 643** : e2e **783 captures, 0 en échec** (clair et sombre, contrôles axe-core et contraste compris) ;
  contrôle responsive **190 résultats, 0 défaut** (320 à 1 440 px, 33 pages publiques, 19 d'administration, 39 de
  l'organisatrice, 4 du scanner) ; aucune erreur d'hydratation ni `ReferenceError` dans `next-start.log` ni dans l'e2e.
- **Gabarit** : même `<div className="ev-page-enter">` autour de chaque page (`tests/parcours/perf-statique.test.ts`,
  `tests/schema/poids-morceaux.test.ts`).
- **Aperçu de l'accueil** : même section, même place réservée, même déclenchement (audit `cvcb-2` vert sans changement) ;
  captures de l'accueil vertes.

### 5.2 Parcours des fichiers, du stockage et de la session (demandé pour le retrait du polyfill `Buffer`)

Run complet 643, tous verts :

| Parcours | Où | Résultat |
|---|---|---|
| Dépôt d'une affiche | e2e `fumee.spec.ts` « créer, soumettre, valider, publier, acheter, scanner, piloter » (dépôt à la ligne 161) ; e2e `recette.spec.ts` acte 2 (dépôt ligne 448) | vert |
| Photos des salles et des établissements, logo, produits | même composant que l'affiche (`components/ui/ImageUpload.tsx` → `/api/partner/upload`), exercé par les deux parcours ci-dessus ; captures « Fiche d'une salle validée (photo…) » | vert |
| Pièces des partenaires | e2e `recette.spec.ts` acte 2 « inscription avec pièces, validation » (pièce d'identité et document de l'entreprise) | vert |
| Photo du compte | `tests/parcours/compte-photo.test.ts` (route du serveur, pannes du stockage comprises) ; capture « Profil du client (identité, photo, numéro) » | vert |
| Affiche côté serveur | `tests/parcours/f2a-affiche.test.ts`, `tests/audit/cvf2a-1-fiche.test.ts` | vert |
| Connexion | e2e : 11 connexions de rôles (`auth.setup.ts`), `connexion-course.spec.ts` ; suites `lot9quinquies-connexion`, `connexion-serveur` | vert |
| Déconnexion | e2e `deconnexion.spec.ts` « Se déconnecter sans réseau, deux heures après la connexion, puis retour du réseau » ; `tests/parcours/securite-deconnexion.test.ts`, `tests/audit/cvf2b-6-deconnexion.test.ts` | vert |
| Hors ligne (service worker, billets) | e2e `terrain.spec.ts` (13 parcours, dont la coquille hors ligne) | vert |

Aucun journal ne contient `Buffer is not defined`. Le polyfill n'avait pas à être remis.

## 6. Runs

| Run | Commit | Contenu | Résultat |
|---|---|---|---|
| 629 | `1e2c25e4d` | outillage seul (code de `main`) : relevé « avant » | vert (rapide + mesure) |
| 631 | `6be65c4e8` | fusion des classes | rapide rouge : `f2b-brouillon-local` seul (date figée, § 8) ; mesure et responsive verts |
| 634 | `0949b005d` | polyfill `Buffer`, empreintes, carte d'un lieu | rapide rouge : `client-interface` seul (attente de l'ancien montage, § 8) ; mesure et responsive verts |
| 635 | `1b864da2c` | gabarit | **entièrement vert** |
| 638, 639 | branche jetable | aperçu, montages A et B | verts (rapide + mesure + responsive pour 638) |
| 641 | `ba50ffac5` | run complet après fusion de `main` (carte B) | rouge : `design1e-orange` seul (§ 2.1) ; e2e, mesure, responsive, budgets verts |
| **643** | `33c74dbad` | **run complet final** | **entièrement vert** : 602 suites, e2e 783 captures, responsive 190 / 0, budgets, mesure 94 / 95 / 94 |
| 645 | `f7ccf916e` | test « npm run dev » (§ 2.1) | vert (rapide) |
| **646** | `71a42f01a` | **fusion dans `main`, run complet de `main`** | **entièrement vert** : 602 suites, e2e 787 captures, responsive 190 / 0, budgets (octets identiques au 643), mesure 92 / 91 / 90 (tentative 1) |

## 7. Conseils pour les lots suivants

- **Lire le poids par module, pas deviner.** Le job `perf` (ligne `ci-perf: oui`) construit avec `EV_ANALYSE_POIDS=1` :
  `scripts/poids-modules.mjs` relève les modules de chaque morceau (lecture seule du graphe, aucun fichier servi changé) et
  `scripts/poids-rapport.mjs` imprime, pour le code commun et pour chaque route, le poids par fichier, par paquet et par
  module, les modules en double dans un même premier chargement, les fichiers dont le poids ne s'explique pas par leurs
  modules, et le contenu des morceaux chargeables. Le texte est publié avec le run
  (`runs/<n>/jobs/perf/poids-rapport.log` sur `ci-results`). L'estimation par module sous-estime un paquet déjà minifié
  (cas du polyfill) : le gain réel se lit sur `scripts/js-budget.mjs`.
- **Un nouveau `import()` coûte à toutes les routes** (~9 octets par entrée de la table de `webpack.js` depuis ce lot, ~18
  avant). Pour un module déjà chargeable, passer par **une seule fonction de chargement** (modèle :
  `components/ui/event-map-load.ts`) : chaque `import()` écrit à un autre endroit peut créer une variante, ou un reste, du
  même morceau (§ 2.4).
- **Classes Tailwind.** `cn` fusionne comme avant, avec une table calculée au build : rien à faire en ajoutant des classes.
  Si tailwind-merge change de version, `scripts/cn-classes.cjs` refuse de construire tant que l'algorithme de
  `components/ui/cn.ts` n'a pas été revérifié (`tests/schema/poids-cn.test.ts`).
- **Prochaine économie identifiée : les modules en double** entre le morceau du layout et celui de chaque page (~1 900 à
  3 300 octets par route, § 3) ; le relevé « modules en double » de `scripts/poids-rapport.mjs` les liste route par route.
- **`Buffer` côté navigateur : interdit** (`tests/schema/poids-buffer.test.ts`). Un téléversement direct par
  `supabase.storage` depuis le navigateur demanderait de revoir ce choix.
- **Ce qui sert au geste part au geste.** Les lots précédents ont déjà sorti du premier chargement la recherche, le menu, la
  barre latérale des organisatrices, les avis, les billets hors ligne et la barre de progression ; garder ce modèle
  (`warmWhenIdle`, chargement au survol ou au focus) pour les écrans des commandes et des abonnements.
- **Décision possible (non prise) : cible des navigateurs.** Sans `browserslist`, Next vise Chrome 64 et Safari 12 (2018) :
  le code est réécrit pour eux (`?.`, `??`, classes…) et `polyfill-module` (596 octets) est servi partout. Relever la cible
  allégerait toutes les pages, mais l'application ne s'ouvrirait plus du tout sur ces anciens téléphones : à décider avec la
  connaissance du parc des clientes.

## 8. Tests ajoutés ou modifiés

**Ajoutés**
- `tests/schema/poids-cn.test.ts` : fusion des classes identique à tailwind-merge (paires, suites au hasard, mots des
  sources), chargeur, branchement en `next dev` (navigateur et serveur, sans Turbopack), table hors construction, refus
  d'une table vide, plus d'import de tailwind-merge dans l'application.
- `tests/schema/poids-buffer.test.ts` : `Buffer` absent du navigateur (dépendances et code chargé), pas de `supabase.storage`
  côté navigateur.
- `tests/schema/poids-morceaux.test.ts` : empreintes de 8 caractères (navigateur, production), lecture de la table par
  `js-budget.mjs` (numéros distincts), un seul `import()` de la carte d'un lieu, gabarit client au même balisage, service
  worker indépendant de la longueur des empreintes.

**Repris tels quels de la branche `carte-b/explorer`** avant sa fusion (puis arrivés par `main`) : `scripts/js-budget.mjs`,
`scripts/js-budget.json`, `tests/parcours/perf-statique.test.ts`. `scripts/js-budget.mjs` reconnaît ensuite les empreintes
de 8 caractères et compte les numéros distincts de la table (aucune attente de test changée).

**Modifiés (signalés)**
- `tests/parcours/f2b-brouillon-local.test.ts` : le brouillon était écrit au 16/11/2026 **en dur** ; depuis le 23/11 il
  dépasse les 7 jours de conservation et le test était rouge sur **toutes** les branches. Corrigé ici (run 631), et de la
  même façon par le lot Carte B ; à la fusion de `main`, sa version a été gardée.
- `tests/parcours/client-interface.test.ts` : la fiche charge la carte par `next/dynamic` via `loadEventMap()` (chargeur
  unique, § 2.3) ; même garde-fou (jamais d'import statique), plus la vérification que le chargeur fait bien l'`import()`.
- `tests/schema/carte-b-ecrans.test.ts` : attentes de l'ancien montage de l'aperçu remplacées (aperçu hors de l'îlot, chargé
  à l'apparition de sa place dans son propre morceau ; `lazy.ts` inchangé).

Aucune suite de `tests/audit/` ni de `tests/audit-auth/` modifiée.
