# Lot Carte B — Données sûres, fond de carte Stadia, Explorer Liste / Carte / Calendrier

Branche `carte-b/explorer`, partie de `main` à `75e20d52f`. Non fusionnée. **Aucune migration** (la lecture publique
s'appuie sur les colonnes existantes : `events.latitude`, `longitude`, `poster_color`, `poster_blur`, et sur
`home_featured_public`). Une contre-vérification indépendante suit.

## À lire en premier

### Sécurité : trous trouvés et corrigés

| # | Trou | Correctif | Test rouge puis vert |
|---|---|---|---|
| S1 | **Arrêt de vente d'une catégorie sans effet sur les pages publiques** (trou de l'état des lieux du 21/11) : ajout, modification (dont `is_active: false`, prix, quota, dates de vente) et suppression d'une catégorie (`/api/partner/events/[id]/categories…`) n'invalidaient rien ; l'Explorer, l'accueil, la fiche (et la carte) gardaient jusqu'à **60 s** l'ancien prix d'appel, « Gratuit » ou une catégorie arrêtée. | `invalidatePublicEvent(eventId, …)` après chaque écriture réussie (`lib/events/event.service.ts`). | `tests/schema/carte-b-invalidation.test.ts` (3 cas) ; bout en bout : `e2e/carte-b.responsive.spec.ts` « arrêt de vente… moins de 5 s » |
| S2 | **Suspension d'une partenaire sans effet immédiat sur les pages publiques** (trouvé pendant le lot) : `partner_status_set` suspend en cascade ses événements publiés (lot 9 bis, R5), mais la route ne vidait aucun cache : des événements **suspendus** restaient affichés comme en vente (catalogue, accueil, fiche) jusqu’à 60 s ; l’achat lui-même restait refusé par la base. La réactivation qui les rétablit, de même. | Invalidation quand la cascade a suspendu ou rétabli au moins un événement (`app/api/admin/partners/[id]/status/route.ts`). | `tests/schema/carte-b-invalidation.test.ts` (1 cas) |
| S3 | **Politique de sécurité du contenu trop large pour les images** (`img-src … https:` : n'importe quel hôte). | `img-src` limitée au site, `data:`, `blob:`, au stockage Supabase du projet, aux photos de démonstration déjà admises par `next/image`, et à **l'hôte des tuiles choisi** (`https://tiles.stadiamaps.com` par défaut). | `tests/schema/carte-b-ecrans.test.ts` « CSP » |

Le commit « tests seuls » `de3fdd414` (aucun correctif) a été poussé d'abord : run **592** rouge (§ 6, sorties brutes).
La lecture publique de la carte (B0) est neuve : elle ne rend que des champs listés et vérifiés champ par champ (§ 2).

### Résultat

**Run complet 617** (commit `3c7c721e4b`) **entièrement vert** : 588 suites (4 tâches : 147, 147, 146, 148 ; 0 en échec,
0 expirée), dont les 65 suites de `tests/audit/` et `tests/audit-auth/` (aucune assertion changée) ; construction ; budgets
JS de toutes les routes tenus **sans relèvement** (`/explore` : budget créé) ; e2e complet vert (783 cas dans la phase
principale, fumée, recette, terrain…) ; contrôle responsive **sans défaut** et e2e du lot 207/207 ; mesure mobile au-dessus
de 90 partout (accueil 92, fiche 91, Mes billets 90 ; processeur ×3,6 à ×4,0). Preuves d'invalidation de bout en bout :
suspension retirée de la carte en **27 ms**, arrêt de vente visible sur l'Explorer en **39 ms** et sur la carte en
**54 ms** (seuil de la consigne : 5 s ; avant le lot : 59 305 ms).

Après la relecture des captures du run 617, trois retouches visuelles de la carte d'Explorer (§ 5), dans le module
chargé à la demande seulement : runs rapides **618** (écrans, design, responsive 207/207 sans défaut, budgets, mobile
94/91/91) et **619** (empilement sous la barre des catégories ; responsive 207/207 sans défaut).

Branche **non fusionnée**, **aucune migration**.

## 1. Ce qui a été livré

### B0 — Données sûres (`GET /api/events/carte`)

- Lecture publique, **lecture seule**, sans session (`app/api/events/carte/route.ts`), réponse `no-store`.
- Données lues par le serveur (`lib/events/map-data.server.ts`) : colonnes choisies une à une (`MAP_SELECT`), statut
  `PUBLIE` et position non nulle **exigés par la requête**, puis revérifiés (`toMapEntry`) : fin retenue à venir (un
  événement en cours reste), position lisible et au Sénégal (mêmes bornes que `event_position_refusal`). Mise en avant lue
  par `home_featured_public` (placements actifs valides, sans auteur ni motif).
- **Cache de 60 s sous l'étiquette `catalogue-public`** : la même invalidation que le catalogue (`invalidatePublicEvent`,
  appelée après chaque changement de statut, de date, de lieu, de catégorie, de mise en avant et, depuis ce lot, de
  catégorie de billets et de statut de la partenaire). Une suspension ou une annulation retire l'événement aussitôt.
- Sortie : `{ events, total, truncated }`, chaque événement réduit à **identifiant, titre, début, fin retenue, prix
  d'appel, couleur et petite image floutée de l'affiche, mise en avant, latitude, longitude** (`PUBLIC_MAP_FIELDS`). Copie
  champ par champ (`publicOnly`) : une entrée qui porterait davantage ne peut rien faire sortir de plus. Ni la partenaire
  (nom, compte, téléphone, adresse électronique), ni le lieu en clair, ni la description, ni un nombre de places.
- Paramètres : `zone=<sud>,<ouest>,<nord>,<est>` (ramenée aux bornes du Sénégal ; illisible → 400), `du`/`au` (calendrier :
  93 jours au plus ; illisible → 400), filtres de l'Explorer (`q`, `quand`, `categorie`, `gratuit`, `ville`, même lecture
  que la page). **300 résultats au plus** (`truncated`).
- Trous d'invalidation corrigés : S1 et S2 ci-dessus.

### B1 — Fond de carte Stadia

- `lib/map/tiles.ts` : « Alidade Smooth » en clair, « Alidade Smooth Dark » en sombre (tuiles raster, Leaflet, aucune
  nouvelle bibliothèque). **Aucune clé** dans le code du navigateur : authentification par domaine chez Stadia ; sur
  `localhost`, Stadia sert sans clé (volume limité) pour la recette.
- Réglages : `NEXT_PUBLIC_MAP_TILE_URL` (clair), `NEXT_PUBLIC_MAP_TILE_URL_DARK` (sombre ; défaut : celle du clair si elle
  est donnée, sinon Alidade Smooth Dark), `NEXT_PUBLIC_MAP_TILE_ATTRIBUTION` (défaut : « © Stadia Maps © OpenMapTiles
  © contributeurs OpenStreetMap », avec les liens exigés).
- Une seule aide pour **toutes** les cartes (`components/map/themedTiles.ts`) : Explorer, aperçu de l'accueil, fiche de
  l'événement, étape Accès de la création. Mention des fonds toujours visible, thème suivi sans recréer la carte.
- Aucune tuile avant l'ouverture de la vue Carte (Explorer) ou avant que l'aperçu de l'accueil soit visible ; tuiles en
  échec (4 échecs sans aucune réussite) → retour à la Liste avec « La carte ne peut pas s'afficher pour le moment ».
- CSP : S3. Mesure de performance : `*tiles.stadiamaps.com*` ajouté au blocage (`e2e/perf.spec.ts`,
  `scripts/e2e/perf-mobile.mjs`, `scripts/e2e/perf-profil.mjs`). En CI et en e2e, le verrou réseau sert une tuile neutre
  locale à la place de toute image d'un autre hôte (`e2e/support/network.ts`, inchangé) : aucune tuile d'Internet.

### B2 — Explorer : Liste / Carte / Calendrier

- Onglets accessibles avec l'indicateur orange qui glisse (mêmes règles que `components/ui/Tabs.tsx` : rôle tablist,
  flèches, Début, Fin, 44 px, translation de 250 ms coupée si « réduire les animations » ; écrits dans
  `app/explore/ExploreView.tsx` pour ne pas charger le module partagé des onglets) ; mêmes filtres partagés (recherche,
  date, catégorie, gratuit, ville) ; vue gardée dans l'adresse (`?vue=carte`, `?vue=calendrier` ;
  `lib/events/explore-view.ts`). La carte et le calendrier forment un seul module chargé à l'ouverture de leur onglet
  (`components/explore/lazy.ts`, `next/dynamic` sans rendu serveur) : **rien au premier chargement d'Explorer**. Leaflet
  est chargé par `import('leaflet')` (morceau existant) et sa feuille de style comme fichier statique
  (`public/leaflet/leaflet-1.9.4.css`, copie exacte vérifiée ; préfixe `/leaflet/` servi sans session).
- **Carte** (`components/explore/ExploreMap.tsx`) : points regroupés avec leur nombre (grille de 64 px, sans
  bibliothèque : `lib/map/cluster.ts`) ; pastilles « Gratuit », « Dès 5 000 F » ; « À la une » en orange ; repère touché
  ou survolé agrandi en orange. Téléphone : feuille en bas de la carte avec la vignette de l'événement et « Voir
  l'événement ». Ordinateur : liste à gauche synchronisée avec la zone visible, survol ou focus d'une vignette = repère mis
  en évidence, repère touché = vignette ramenée dans la liste. « Rechercher dans cette zone » après un déplacement.
  « Autour de moi » : la position du téléphone sert **seulement** à centrer la carte (jamais envoyée ni enregistrée ; hors
  du Sénégal : message). Choix rapide : Tout le Sénégal, Dakar, Almadies, Plateau, Ngor, Ouakam, Mermoz, Sacré-Cœur, Saly,
  Mbour, Thiès, Saint-Louis, Kaolack, Ziguinchor. Clavier : repères focalisables (Tabulation, puis Entrée ou Espace) et
  nommés pour les lecteurs d'écran (titre, date, prix ; « 8 événements : agrandir »), boutons de zoom, anneau de focus ;
  la Liste reste l'alternative complète (annoncée aux lecteurs d'écran). « Réduire les animations » :
  zoom et déplacements sans animation. Temps réel : un signal du catalogue relit la carte ouverte.
- **Calendrier** (`components/explore/ExploreCalendar.tsx`) : mois qui défilent (le mois en cours et le suivant, puis un
  de plus à l'approche du bas, douze au plus) ; vignette ronde de l'affiche par jour (image floutée et couleur déjà
  stockées : aucune grande image), vignettes empilées et « +n » ; aujourd'hui en orange, jours passés atténués ; toucher un
  jour ouvre une feuille avec ses événements (« Acheter » mène à la fiche ; élément `<dialog>` natif en fenêtre modale :
  focus gardé, Échap, focus rendu au jour touché) ; « Ce week-end » (feuille du vendredi soir au
  dimanche) et « Ce mois-ci » ; chaque jour qui a des événements se lit « samedi 13 décembre, 3 événements ».

### Accueil — « Partout au Sénégal »

- Section rendue avec « Près de chez vous » dans l'îlot déjà chargé après la page (`components/events/HomeDiscovery.tsx`,
  `components/events/HomeSenegalMap.tsx`) : aucun code de plus au premier chargement de l'accueil. L'aperçu (carte immobile,
  points orange sans texte, plus gros pour un groupe) n'est monté que lorsque sa place devient visible : Leaflet, sa feuille
  de style, les tuiles et les événements ne sont demandés qu'alors. « Ouvrir la carte » mène à la vue Carte.

## 2. Tests de visibilité et d'invalidation

| Suite | Ce qu'elle prouve |
|---|---|
| `tests/parcours/carte-b-visibilite.test.ts` (base locale, lecture réelle `readMapEntries` puis `selectMapEvents`) | Rendu : publié, à venir, avec position. **Jamais rendus** : brouillon, en attente, validé, suspendu, annulé, terminé (statut TERMINE, même encore dans ses heures), publié mais fini (fin passée avant le passage de la tâche planifiée), publié sans position (événement ancien), et les événements BROUILLON, TERMINE, ANNULE du seed de test. **Aucun champ en trop** : chaque événement a exactement `PUBLIC_MAP_FIELDS` ; ni nom de la partenaire (raison sociale, nom commercial), ni téléphone, ni adresse électronique, ni identifiant de partenaire ou de compte, ni lieu en clair, ni description dans la réponse. Suspension : retiré à la lecture suivante. Zone et période. |
| `tests/schema/carte-b-donnees.test.ts` (sans base) | Mêmes règles sur des lignes fabriquées (tous les statuts, positions absentes, incomplètes, illisibles, hors du Sénégal, bornes comprises) ; prix d'appel sur les seules catégories achetables (vente arrêtée, guichet seul, complète, close) ; une entrée « polluée » de champs en trop n'en fait rien sortir ; zone ramenée au Sénégal ; filtres ; limite de 300 ; paramètres illisibles refusés ; requête PUBLIE et position non nulle, cache étiqueté `catalogue-public`, route sans session ni écriture. |
| `tests/schema/carte-b-invalidation.test.ts` | Invalidation après l'ajout, la modification et la suppression d'une catégorie, et après la cascade de la suspension ou de la réactivation d'une partenaire (rouge sur `de3fdd414`, vert ensuite). |
| `e2e/carte-b.responsive.spec.ts` | De bout en bout, serveur construit : **arrêt de vente** d'une catégorie visible sur l'Explorer ET sur la carte **en moins de 5 s** ; **suspension** par l'administration : l'événement quitte la carte **en moins de 5 s**, et la réponse n'a que les champs publics ; aucune tuile demandée avant la vue Carte (ni sur l'accueil avant que l'aperçu soit visible) ; mention Stadia visible ; tuiles refusées → retour à la Liste, message simple ; repère trouvé par son nom et ouvert au clavier (Entrée) ; liste de l'ordinateur ramenée à la zone visible et survol mis en évidence ; calendrier et feuille d'un jour ; aperçu de l'accueil ; captures. |
| `tests/schema/carte-b-ecrans.test.ts` (sans base) | Fond Stadia clair et sombre, aucune clé, réglages, origines pour la CSP ; toutes les cartes par l'aide commune ; CSP limitée ; tuiles Stadia bloquées par la mesure ; vue gardée dans l'adresse ; carte et calendrier par `next/dynamic` (aucun import statique, ni Leaflet dans la page) ; tuiles en échec → Liste ; regroupement ; « Autour de moi » jamais envoyé ni gardé (ni stockage, ni cookie, ni lecture avec les coordonnées) ; libellés du calendrier ; accueil sans Leaflet. |

## 3. Tests existants modifiés (signalés)

| Suite | Modification | Raison |
|---|---|---|
| `tests/schema/design1b-catalogue.test.ts` | « bouton Liste / Carte prévu mais non rendu » (`SHOW_MAP_TOGGLE === false`) devient « onglets Liste / Carte / Calendrier, carte et calendrier à la demande ». | Le lot rend la carte réelle : le drapeau `SHOW_MAP_TOGGLE` est retiré, les trois onglets le remplacent ; l'exigence de légèreté est gardée (chargement à la demande vérifié). |
| `tests/parcours/f2b-pied-cartes.test.ts` | Préfixe « Leaflet » retiré et mention d'OpenStreetMap vérifiés dans l'aide commune (`components/map/themedTiles.ts`, `lib/map/tiles.ts`) au lieu des deux fichiers ; les deux cartes doivent passer par l'aide. | La pose du fond et de la mention est désormais à un seul endroit pour toutes les cartes ; la mention de Stadia garde « contributeurs OpenStreetMap ». |
| `tests/parcours/perf-statique.test.ts` | `/explore` ajoutée aux routes mesurées et budgétées (fausse construction complétée de sa page). | Consigne : créer un budget pour `/explore`. |
| `tests/helpers/design-files.ts` (liste, pas une assertion) | Les cinq écrans nouveaux du lot ajoutés : ils passent les règles du système de design et d'accessibilité de `design-systeme`. | Règle des lots : tout écran nouveau y figure. |
| `e2e/perf.spec.ts`, `scripts/e2e/perf-mobile.mjs`, `scripts/e2e/perf-profil.mjs` | `*tiles.stadiamaps.com*` ajouté au blocage des tuiles. | Consigne. |
| `scripts/js-budget.mjs` (outil, pas un test) | Détail par fichier, nombre d'entrées de la table des morceaux, relevé des morceaux chargeables. | Enquête du § 4 ; garde les prochaines enquêtes courtes. |

Aucune assertion de `tests/audit/` ni de `tests/audit-auth/` n'est modifiée.



## 4. Poids JavaScript et mesure mobile, avant et après

### Poids du premier chargement (gzip, octets ; `scripts/js-budget.mjs`)

| Route | Avant (run 589, code de `main`) | Après (run complet 617) | Budget | Écart |
|---|---|---|---|---|
| `/` | 224 697 | 224 719 | 226 342 (inchangé) | +22 |
| `/events/[id]` | 233 279 | 233 302 | 233 316 (inchangé) | +23 |
| `/tickets` | 248 326 | 248 349 | 250 417 (inchangé) | +23 |
| `/controller/scanner` | 234 636 | 234 659 | 234 911 (inchangé) | +23 |
| `/billet/hors-ligne` | 223 731 | 223 754 | 224 268 (inchangé) | +23 |
| `/explore` | 233 712 (mesurée, sans budget) | 234 826 | **235 712 (créé)** | +1 114 |

- **La carte et le calendrier ne pèsent rien au premier chargement** d'Explorer ni de l'accueil : un seul module chargé à
  l'ouverture de l'onglet (`components/explore/lazy.ts`) ; Leaflet par `import('leaflet')` (morceau déjà existant de la
  bibliothèque), sa feuille de style en fichier statique ; l'aperçu de l'accueil voyage avec l'îlot « Près de chez
  vous », déjà chargé après la page.
- `/explore` +1 114 octets : les onglets (indicateur qui glisse, clavier), la vue dans l'adresse, les deux chargeurs à la
  demande et le passage des filtres. Budget **créé** à 235 712 (avant + 2 000), comme demandé ; aucun budget existant
  relevé.
- +22 à +23 octets sur toutes les routes : la table des morceaux chargeables (`webpack.js`, 3 365 → 3 387 octets), qui
  gagne **une** entrée (le module de la carte et du calendrier). Voir l'enquête ci-dessous.

### Enquête sur le poids commun (runs 595 à 615)

Le premier montage (trois modules à la demande, feuille de Leaflet importée) ajoutait +69 octets à **toutes** les routes ;
`/events/[id]`, dont le budget n'avait que 37 octets de marge, le dépassait. Un relevé ajouté à `scripts/js-budget.mjs`
(détail par fichier, puis liste des morceaux chargeables avec leur taille et des repères de contenu) a été lancé sur la
branche de preuve (code de `main`) et sur le lot :

| Run | Montage | Entrées de la table | `webpack.js` |
|---|---|---|---|
| 600, 609, 614 (`main`) | — | 49 (dont **deux variantes** du morceau de la carte de la fiche) | 3 365 |
| 595 à 601 | 3 modules, puis 1 module qui importe le module de la carte de la fiche | 51, et un morceau commun de 3 930 octets dans le premier chargement d'Explorer | 3 433 |
| 608 | 1 module ; Explorer ne partage plus les filtres, les champs ni les dates avec la page | 51 | 3 402 |
| 613 | fond de carte pris dans le module de la fiche, aperçu dans l'îlot de l'accueil | **52** : le module + deux **nouvelles variantes** du morceau de la fiche (webpack en fait une par point d'import dont les modules disponibles diffèrent) | 3 418 |
| 615 | Explorer et l'aperçu n'importent plus le module de la fiche : `import('leaflet')`, feuille statique | 51 : le module + un morceau commun aux cartes (fond de carte et fournisseur du thème) | 3 401 |
| 616, 617 | fond de carte : thème lu sur la page (plus de fournisseur du thème dans les morceaux des cartes) | **50** : le seul module de la carte et du calendrier | 3 387 |

Leçon pour les lots suivants : chaque nouveau morceau chargé à la demande coûte ~18 octets à **toutes** les routes ;
importer un module déjà chargeable depuis un nouvel endroit peut en créer une variante (même coût) ;
`node scripts/js-budget.mjs` imprime désormais la table et ses morceaux pour le vérifier.

### Mesure mobile (Lighthouse, médiane de 5 passages, seuil 90)

| Run | Processeur | Accueil | Fiche | Mes billets |
|---|---|---|---|---|
| 589 (avant, code de `main`) | ×5,1 à ×5,7 | 92 | 90 | 86 (page non touchée) |
| 595 | ×6,4 à ×7,4 (inexploitable) | 84 | 85 | 85 |
| 599 | ×4,2 à ×5,1 | 93 | 92 | 90 |
| 604 | ×3,5 à ×3,9 | 92 | 92 | 89 (page non touchée) |
| 613 | ×4,7 à ×5,1 | 91 | 92 | 91 |
| 615 | ×4,4 à ×4,9 | 93 | 92 | 91 |
| 616 | ×4,5 à ×5,6 | 91 | 90 | 91 |
| **617 (run complet)** | ×3,6 à ×4,0 | **92** | **91** | **90** |

Réaction au toucher (run 617) : 104 ms au plus sur les puces d'Explorer (seuil 200 ms).

## 5. Défauts trouvés par les tests du lot et corrigés

| Défaut | Trouvé par | Correctif |
|---|---|---|
| Carte compacte d'Explorer à 320 px : « Bientôt en vente » dépassait de la carte (défaut existant, révélé par l'événement de test dont la vente est arrêtée). | Contrôle responsive, run 594 | Un état de la vente passe à la ligne ; un montant reste sur une ligne (`components/events/EventCard.tsx`). |
| Repères de la carte : boutons nommés par leur seul texte visible (« Dès 7 500 F ») ; le titre de l'événement n'était qu'une info-bulle, jamais lu. | e2e, run 604 | `aria-label` complet (titre, date, prix ; « 8 événements : agrandir »). |
| Repères focalisables mais **inactifs au clavier** : dans Leaflet 1.9, Entrée n'ouvre qu'une bulle liée, jamais l'action du toucher. | e2e, run 608 | Entrée et Espace branchés sur l'action du repère et du groupe. |
| Feuille du téléphone posée sur la mention des fonds (deux lignes à 360 px) ; boutons de zoom de la fiche sur la mention. | Relecture des captures | Feuille et zoom relevés au-dessus de la mention. |
| Feuille du téléphone à 360 px : titre coupé et pastille « Dès 7 500 F » sur trois lignes (lien « Voir l'événement » en colonne) ; « Rechercher dans cette zone » sur le bouton de zoom. | Relecture des captures du run complet 617 | Lien sous le texte, pastille sur une ligne ; bouton de zone à l'écart du zoom. |
| Quand la carte défile sous la barre des catégories collée en haut, « Rechercher dans cette zone » passait par-dessus la barre. | Relecture des captures du run 618 | Zone de la carte isolée (contexte d'empilement propre). |

## 6. Runs

| Run | Commit | Mode | Résultat |
|---|---|---|---|
| 589 | `87ddb930b` | rapide + mesure (« avant ») | Poids et mesure « avant » ; rouge seulement par Mes billets 86 (page non touchée, processeur ×5,1 à ×5,7) |
| 592 | `de3fdd414` (tests seuls) | rapide + responsive | **Rouge voulu** : 4/4 tests d'invalidation (sortie ci-dessous) ; e2e rouge au montage (affiche refusée), refait en 594 |
| 594 | `bb4c48225` (branche de preuve `carte-b/rouges`) | responsive | **Rouge voulu** : arrêt de vente visible sur l'Explorer après **59 305 ms** |
| 595 à 613 | | rapide + responsive + mesure | Travail : montage des tests, captures, poids (§ 4), défauts du § 5 |
| 615 | `af18bf96cc` | rapide (96 suites) + responsive + mesure | **Vert** : 207/207 e2e responsive, contrôle responsive sans défaut, budgets tenus, mobile 93/92/91 |
| 616 | `2882665c54` | rapide (96 suites) + responsive + mesure | **Vert** : table des morceaux à 50 entrées, `/events/[id]` 233 302, mobile 91/90/91, 207/207 |
| **617** | `3c7c721e4b` | **complet** | **Vert** : 588 suites, e2e complet, responsive, budgets, mobile 92/91/90 (§ À lire en premier) |
| 618 | `9a69d05f63` | rapide (écrans, design, responsive, mesure) | **Vert** : 5 suites, 207/207, contrôle responsive sans défaut, budgets (`/events/[id]` 233 300), mobile 94/91/91 (×5,2 à ×5,7) |
| 619 | `7afcfb14a9` | rapide (écrans, design, responsive) | **Vert** : 2 suites, 207/207, contrôle responsive sans défaut ; suspension 48 ms, arrêt de vente 49 ms (Explorer) et 73 ms (carte) |

Sortie brute du run 592 (`runs/592-44981825312/test-logs/tests__schema__carte-b-invalidation.test.ts.log`, extrait) :

```
not ok 1 - createTicketCategory : invalidatePublicEvent(eventId, …) après le succès de ticket_category_create
  error: "createTicketCategory : invalidation absente après ticket_category_create (le prix d'appel et « Complet » restaient en cache 60 s)"
not ok 2 - updateTicketCategory : invalidatePublicEvent(eventId, …) après le succès de ticket_category_update
  error: "updateTicketCategory : invalidation absente après ticket_category_update (le prix d'appel et « Complet » restaient en cache 60 s)"
not ok 3 - deleteTicketCategory : invalidatePublicEvent(eventId, …) après le succès de ticket_category_delete
  error: "deleteTicketCategory : invalidation absente après ticket_category_delete (le prix d'appel et « Complet » restaient en cache 60 s)"
not ok 1 - PATCH /api/admin/partners/[id]/status : invalidation quand des événements ont été suspendus ou rétablis
# pass 0
# fail 4
```

Sortie brute du run 594 (`runs/594-44983787802/jobs/responsive/e2e.log`, extrait) :

```
[carte-b] arrêt de vente visible sur l'Explorer après 59305 ms
  ✘    3 [responsive] › e2e/carte-b.responsive.spec.ts:61:9 › carte B · invalidation › arrêt de vente d’une catégorie : l’Explorer suit en moins de 5 s (1.5m)
    Error: l’Explorer montre l’arrêt de vente en moins de 5 s
```

Après correctif (run 615, `runs/615-44999607475/jobs/responsive/e2e.log`) :

```
[carte-b] suspension visible sur la carte après 31 ms
[carte-b] arrêt de vente visible sur l'Explorer après 76 ms
[carte-b] arrêt de vente visible sur la carte après 89 ms
  207 passed (18.1m)
```

## 7. Ce que Fallou doit faire chez Stadia avant la préproduction

1. Créer (ou ouvrir) le compte Stadia Maps de l'entreprise : <https://client.stadiamaps.com/>.
2. Dans « Manage Properties », créer une propriété « Event Village » et y **déclarer les domaines** du site, sans
   `https://` ni chemin : le domaine de préproduction et celui de production (par exemple `preprod.eventvillage.sn` et
   `eventvillage.sn`, plus `www.eventvillage.sn` si le site y répond). C'est l'authentification par domaine : **aucune clé
   n'est à mettre dans l'application**.
3. Vérifier l'offre : l'offre gratuite couvre un volume limité de tuiles par mois ; choisir l'offre payante adaptée avant
   l'ouverture au public (le tableau de bord de Stadia montre la consommation).
4. Rien à régler dans l'application pour Stadia : l'adresse et la mention sont celles de Stadia par défaut. Les variables
   `NEXT_PUBLIC_MAP_TILE_URL`, `NEXT_PUBLIC_MAP_TILE_URL_DARK` et `NEXT_PUBLIC_MAP_TILE_ATTRIBUTION` ne servent que pour
   changer de fournisseur ; elles se règlent avant la construction de l'application (l'hôte choisi est alors le seul admis
   pour les images de tuiles par la politique de sécurité).
5. Recette : sur `localhost`, la carte fonctionne sans rien déclarer (volume limité par Stadia). Après le déploiement en
   préproduction, ouvrir Explorer › Carte : si le fond reste gris et que l'application revient sur la Liste avec « La
   carte ne peut pas s'afficher pour le moment », le domaine n'est pas (encore) déclaré chez Stadia.

## 8. Essais pour un non-développeur

Sur un téléphone puis sur un ordinateur, en clair puis en sombre (bouton du thème en haut) :

1. **Explorer › Liste** : la liste habituelle ; les filtres (Aujourd'hui, Ce week-end, Gratuit, catégories, ville) marchent
   comme avant.
2. Toucher **Carte** : l'adresse de la page finit par `?vue=carte`. La carte du Sénégal s'affiche avec des repères ; un
   repère groupé montre un nombre (toucher : la carte se rapproche). Les repères montrent « Gratuit » ou « Dès … F » ; un
   événement « À la une » est en orange. En bas à droite : « © Stadia Maps © OpenMapTiles © contributeurs OpenStreetMap ».
3. Sur le téléphone, toucher un repère : une feuille monte en bas avec l'événement et « Voir l'événement ». Toucher
   « Fermer ».
4. Sur l'ordinateur : la liste de gauche ne montre que les événements de la partie visible de la carte ; passer la souris
   sur un événement de la liste met son repère en orange. Déplacer la carte : « Rechercher dans cette zone » apparaît.
5. « Aller à » : choisir Almadies, puis Saint-Louis : la carte s'y place. « Autour de moi » : le téléphone demande la
   permission ; accepter : la carte se centre sur vous (si vous êtes au Sénégal) ; refuser : un message invite à choisir
   une ville.
6. Choisir un filtre (par exemple « Gratuit ») : la carte ne garde que les événements gratuits ; revenir sur **Liste** :
   le même filtre est appliqué.
7. Toucher **Calendrier** : les mois défilent ; aujourd'hui est entouré d'orange ; un jour avec des événements montre de
   petites pastilles d'affiches (et « +2 » s'il y en a plus). Toucher ce jour : la feuille montre ses événements avec
   « Acheter ». Essayer « Ce week-end » et « Ce mois-ci ».
8. **Accueil** : descendre jusqu'à « Partout au Sénégal » : la carte apparaît quand on arrive dessus ; « Ouvrir la carte »
   ouvre Explorer sur la Carte.
9. Côté organisatrice, arrêter la vente d'une catégorie de billets d'un événement publié : sur Explorer (Liste et Carte),
   son prix change en quelques secondes. Côté administration, suspendre un événement : il disparaît de la carte en quelques
   secondes.
10. Lecteur d'écran (VoiceOver ou TalkBack) sur le Calendrier : un jour se lit « samedi 13 décembre, 3 événements ».

## 9. Captures

Dossier `docs/carte-b-captures/` (job responsive du dernier run, 619, `e2e/carte-b.responsive.spec.ts` ; fichiers
`cb-<écran>__<largeur>__<thème>.jpg`, thèmes `clair` et `sombre`) :

| Écran | Fichiers |
|---|---|
| Explorer, Liste | `cb-explorer-liste__360__*.jpg` |
| Carte au Sénégal | `cb-carte-senegal__360__*.jpg` |
| Carte zoomée (Dakar) | `cb-carte-zoomee__360__*.jpg` |
| Feuille du téléphone (repère touché) | `cb-feuille-telephone__360__*.jpg` |
| Liste synchronisée et survol (ordinateur) | `cb-liste-synchronisee__1440__*.jpg` |
| Calendrier | `cb-calendrier__360__*.jpg`, `cb-calendrier__1440__*.jpg` |
| Feuille d'un jour | `cb-calendrier-jour__360__*.jpg`, `cb-calendrier-jour__1440__*.jpg` |
| Aperçu de l'accueil | `cb-accueil-apercu__360__*.jpg`, `cb-accueil-apercu__1440__*.jpg` |

En CI, aucune tuile ne vient d'Internet : le verrou réseau de l'e2e sert une tuile neutre (gris clair) à la place de toute
image d'un autre hôte. Le fond des cartes est donc uni sur les captures, en clair comme en sombre ; repères, groupes,
pastilles, mention des fonds, feuilles et listes sont les vrais. Le fond Stadia se voit en recette (localhost, sans clé) et
en préproduction (domaine déclaré, § 7).

## 10. Ce qui change pour les autres lots

- **Fond de carte** : toutes les cartes Leaflet (fiche, administration, pilotage, étape Accès) passent sur Stadia, clair ou
  sombre selon le thème, par `components/map/themedTiles.ts` (`addThemedTiles`, `setTilesTheme`, `useMapTheme`). Une
  nouvelle carte doit passer par cette aide (test `f2b-pied-cartes`).
- **Politique de sécurité du contenu** : `img-src` n'accepte plus « https: » entier. Une nouvelle source d'images
  externe doit y être ajoutée (`next.config.mjs`), sinon elle sera signalée (rapport seulement aujourd'hui, bloquant au lot
  de mise en ligne).
- **Middleware** : `/leaflet/` public (fichiers de la bibliothèque : feuille de style 1.9.4, icônes de repère). Une montée
  de version de Leaflet doit recopier `node_modules/leaflet/dist/leaflet.css` sous le nouveau nom (le test
  `carte-b-ecrans` compare les deux et la version).
- **Invalidation** : les écritures des catégories de billets et le statut d'une partenaire invalident désormais les pages
  publiques (catalogue, accueil, fiche, carte). Une nouvelle écriture qui change ce qu'affiche le catalogue doit appeler
  `invalidatePublicEvent` après son succès.
- **Poids** : `/explore` a un budget (235 712). `scripts/js-budget.mjs` imprime le détail par fichier, le nombre
  d'entrées de la table des morceaux et la liste des morceaux chargeables : un nouveau morceau chargé à la demande coûte
  ~18 octets à toutes les routes (`/events/[id]` n'a plus que 14 octets de marge).
- **Carte compacte** (`EventCard`) : un état de la vente long passe à la ligne (montants inchangés).
- Rien de modifié dans le catalogue des avis ni dans l'outillage des captures (consigne : session de la finition 5 en
  parallèle). Fichiers partagés touchés, à surveiller à la fusion : `app/globals.css` (règles des repères et de l'aperçu,
  marge du zoom de la fiche), `components/events/EventCard.tsx`, `components/events/HomeDiscovery.tsx`, `next.config.mjs`,
  `middleware.ts`, `e2e/perf.spec.ts` et `scripts/e2e/perf-mobile.mjs` / `perf-profil.mjs` (une adresse ajoutée au
  blocage).

## 11. Points ouverts

Voir `docs/apres-lancement.md`, section « Carte et calendrier d'Explorer (lot Carte B) » : salles et restaurants sur la
carte (lot suivant), événements publiés sans position (absents de la carte et du calendrier), recherche d'adresse
refusée, liste de plus de 300 événements, libellé « Sponsorisé », titre de « Partout au Sénégal » rendu par l'îlot,
déclaration du domaine chez Stadia.

Branche **non fusionnée**, aucune migration. Branche de preuve `carte-b/rouges` (code de `main` + tests et relevés du
lot) : ne pas fusionner.
