# Contre-vérification du lot Carte B (carte et calendrier d'Explorer)

Branche auditée : `origin/carte-b/explorer` à `bf4298ac9d` (rapport `docs/carte-b-rapport.md`), lue sans la modifier.
Tests de preuve : branche `carte-b/cv-rouges` (partie de `bf4298ac9d`, **jamais fusionnée**), commits de tests `211119c6e7`, `83666c7f59` (G4) et `866585379f` (T5).
Aucun build local, aucun appel au projet distant, aucune migration, `.env.local` non lu. Le rapport du lot n'a servi qu'à
repérer ses affirmations ; chacune a été relue dans le code et éprouvée par un test (vert = attaque bloquée, rouge = trou).

## Verdict

**Lot acceptable pour la fusion après correction de T1** (une fonction, deux lignes : § 1.1) ; **T5**, antérieur au lot
mais dans le périmètre du point 3, se corrige par une ligne du middleware (§ 1.5) et doit l'être avant la mise en ligne. Les autres trous sont
faibles : des pages publiques gardent jusqu'à 60 s un état périmé (fiche d'un événement fini ou d'une partenaire
renommée, « en vente » d'une catégorie qui vient d'être épuisée) ; aucun ne laisse acheter ce qui ne doit pas l'être
(la base refuse) ni ne fait sortir une donnée non publique. Ce que le lot a livré tient : la lecture publique de la carte
ne rend que des champs publics d'événements publiés à venir, quels que soient les paramètres ; ses invalidations (S1, S2)
et celles de `event_update` et de l'annulation se voient en 13 à 37 ms ; la CSP des images est exacte ; `/leaflet/`
n'ouvre rien d'autre ; toutes les cartes passent par l'aide commune avec la mention des fonds.

| # | Trou | Gravité | Test (rouge) | Sortie |
|---|---|---|---|---|
| T1 | « Autour de moi » puis « Rechercher dans cette zone » : la zone envoyée au serveur est **centrée sur la position du téléphone** (à quelques mètres près) | **Moyenne** | `cvcb-1-trous` T1 ; e2e `cvcb.responsive` T1 | § 1.1 |
| T2 | Fin d'un événement par la tâche planifiée (`/api/cron/events-finish`) : **aucune invalidation** | Faible | `cvcb-1-trous` T2 ; e2e T2 | § 1.2 |
| T3 | Nouveau nom commercial (ou logo) de la partenaire : **aucune invalidation** (antérieur au lot) | Faible | `cvcb-1-trous` T3 ; e2e T3 | § 1.3 |
| T4 | Ventes (paiement confirmé, billets gratuits, guichet, réservations posées ou rendues) : **aucune invalidation** (« Complet », prix d'appel de la carte) | Faible | `cvcb-1-trous` T4 | § 1.4 |
| T5 | Images de `public/images/` **refusées sans session** (redirection vers `/login`) : logos Wave et Orange Money de la fiche, affiche de repli, **image de partage** du site (antérieur au lot) | **Moyenne** | `cvcb-4-images` ; e2e `cvcb.responsive` G4 | § 1.5 |

Aucun trou critique ni élevé. Lecture publique (point 1), règle `img-src` elle-même (point 3), middleware `/leaflet/`
(point 4), cartes et mention (point 6) et poids (point 7) : garde-fous verts (§ 3). Deux écarts de rapport sans gravité
(§ 4).

## Runs

| Run | Commit | Mode | Résultat |
|---|---|---|---|
| **624** | `211119c6e7` (tests seuls) | rapide (`cvcb-1`, `cvcb-2`, `cvcb-3`) + responsive | `cvcb-1-trous` **4/4 rouges** (bonne raison) ; `cvcb-2-gardes` 15/15 verts ; `cvcb-3-base` 5/5 verts ; e2e : 212 réussis dont G1, G2, G3, G5, G6 verts ; **T1, T2, T3 rouges** (bonne raison) ; G4 rouge pour un **défaut du test** (verrou réseau du contexte : `net::ERR_BLOCKED_BY_CLIENT at https://localhost:35143/`) |
| 625 | `83666c7f59` (G4 corrigé) | rapide (`cvcb-2`) + responsive | Annulé par la poussée du premier état de ce rapport (même branche) |
| **626** | `c47e3344a1` | rapide (`cvcb-2`) + responsive | `cvcb-2-gardes` vert ; e2e : 212 réussis ; T1 (6,8 m), T2 (52 025 ms), T3 (50 466 ms) rouges comme au run 624 ; G2 `{"position":14,"dates":13,"affiche":35,"titre":20,"annulation":18}` ms ; **G4 rouge pour la bonne raison** : violations `img-src` sur les logos de paiement de la fiche, d'où **T5** |
| **627** | `866585379f` (T5) | rapide (`cvcb-4`, `cvcb-3`) | typecheck et lint OK ; `cvcb-4-images` **rouge** (bonne raison : 4 fichiers de `public/images/` redirigés, tous les autres de `public/` servis) ; `cvcb-3-base` 5/5 verts |

Journaux bruts : branche `ci-results`, `runs/624-45046978376`, `runs/626-45066654312`, `runs/627-45070308183` (`jobs/rapide/verify.log`, `jobs/responsive/e2e.log`,
`jobs/responsive/next-start.log`).

## 1. Trous

### 1.1 T1 — « Autour de moi » : la position quitte le téléphone (moyenne)

**Affirmation du lot** : « la position du téléphone sert **seulement** à centrer la carte (jamais envoyée ni enregistrée) »
(rapport, B2) ; même promesse dans le code (`lib/events/map-client.ts:7-8`, `components/explore/ExploreMap.tsx:224`).

**Ce qui se passe** : « Autour de moi » centre la carte sur la position (`ExploreMap.tsx:206-208`, `goTo(latitude,
longitude, 13)`), ce qui fait apparaître « Rechercher dans cette zone » (`setMoved(true)`, et aussi `zoomend` à la ligne 154).
Toucher ce bouton — le geste naturel juste après — envoie `zoneOf(map)` (`:199-203`), c'est-à-dire les bornes de la vue
centrée sur la position, arrondies à 4 décimales (`map-client.ts:17`, `:24`). Le centre de la zone redonne la position à
quelques mètres près ; elle part dans l'adresse de `GET /api/events/carte` (journaux d'accès de l'hébergeur et du CDN).

**Preuve** :

```
# cvcb-1-trous (run 624, jobs/rapide/verify.log)
not ok 1 - la zone envoyée par « Rechercher dans cette zone » juste après « Autour de moi » ne permet pas de retrouver la position à 1 km près
  error: 'position retrouvée au centre de la zone envoyée : écart médian 2.5 m, maximal 4.9 m (exemple : /api/events/carte?zone=14.6702%2C-17.4935%2C14.7698%2C-17.4265)'

# e2e, vrai serveur, position simulée 14.72153 ; -17.46831 (run 624, jobs/responsive/e2e.log)
[cvcb] « Rechercher dans cette zone » après « Autour de moi » : /api/events/carte?zone=14.6783%2C-17.4988%2C14.7648%2C-17.4377 ; centre à 6.8 m de la position
  ✘   13 [responsive] › e2e/cvcb.responsive.spec.ts:181:9 › cvcb · « Autour de moi » › T1 — puis « Rechercher dans cette zone » : la zone envoyée ne doit pas permettre de retrouver la position (≥ 1 km)
```

« Autour de moi » seul n'envoie rien (G1 vert : `0 requête(s) hors tuiles, 18 tuile(s) ; porteuses de la position : 0`,
ni stockage ni cookie) : c'est le geste suivant, proposé par l'écran, qui fait partir la position.

**Correctif proposé** (deux lignes, aucune autre lecture touchée) : arrondir la zone **vers l'extérieur** à une grille
grossière avant de l'écrire dans l'adresse, par exemple au 1/20 de degré (≈ 5,5 km, le grain d'une tuile au zoom 13) :

```ts
// lib/events/map-client.ts
const GRID = 0.05;
const down = (n: number) => (Math.floor(n / GRID) * GRID).toFixed(2);
const up = (n: number) => (Math.ceil(n / GRID) * GRID).toFixed(2);
if (opts.zone) params.set('zone', [down(opts.zone.south), down(opts.zone.west), up(opts.zone.north), up(opts.zone.east)].join(','));
```

La zone demandée ne peut que s'agrandir (aucun événement visible perdu ; la liste de l'ordinateur reste filtrée sur la
vue exacte dans le navigateur, `ExploreMap.tsx:321`). Les adresses deviennent aussi plus stables d'un déplacement à l'autre. À défaut,
ne pas proposer « Rechercher dans cette zone » après « Autour de moi » ne suffit pas : un glisser d'un pixel la rouvre.

### 1.2 T2 — fin par la tâche planifiée sans invalidation (faible)

`app/api/cron/events-finish/route.ts:25` passe à TERMINE les événements publiés finis (`events_finish_overdue`), retire
leur placement « À la une » par la base, et rend `ids` (`:44`) ; rien n'est invalidé. La carte et le catalogue ne montrent
déjà plus un événement fini (filtre sur l'heure à chaque lecture : `map-data.ts` `selectMapEvents`,
`catalog-cache.server.ts` `cachedCatalogEvents`), mais la **fiche** garde l'état « publié », sans le bandeau « Événement
terminé », jusqu'à 60 s après le passage de la tâche.

**Preuve** :

```
# cvcb-1-trous (run 624)
not ok 1 - GET /api/cron/events-finish : invalidatePublicEvent après events_finish_overdue quand des événements sont passés à TERMINE
  error: "app/api/cron/events-finish/route.ts : invalidatePublicEvent n'est pas importé (aucune invalidation après le passage à TERMINE)"

# e2e : fiche préparée (publiée, fin passée), vraie route de la tâche (Bearer CRON_SECRET), statut TERMINE en base
[cvcb] fin planifiée visible sur la fiche après 51891 ms
  ✘   15 [responsive] › e2e/cvcb.responsive.spec.ts:246:9 › cvcb · invalidation › T2 — fin par la tâche planifiée : la fiche montre « Événement terminé » en moins de 5 s (52.5s)
```

**Correctif proposé** : après la boucle, si `finished > 0`, `invalidatePublicEvent(null, 'fin planifiée')` puis la fiche de
chaque identifiant rendu (étendre `invalidatePublicEvent` à une liste, ou `revalidatePath('/events/[id]', 'page')`).

### 1.3 T3 — profil de la partenaire sans invalidation (faible, antérieur au lot)

`PATCH /api/partner/profile` (`app/api/partner/profile/route.ts:208`, `partner_profile_update`) change la raison sociale, le
nom commercial et le logo. La fiche les affiche (organisateur : `lib/events/event-detail.server.ts:229`, `:239`) et le
texte cherché d'Explorer et de la carte porte sur ce nom (`map-data.ts` `f.subtitle`) ; rien n'est invalidé. Les cartes
d'Explorer et de l'accueil reçoivent le nom (`subtitle`) mais ne l'affichent pas (`components/events/EventCard.tsx`).

**Preuve** :

```
# cvcb-1-trous (run 624)
not ok 1 - PATCH /api/partner/profile : invalidatePublicEvent après partner_profile_update (nom commercial, raison sociale, logo affichés)
  error: "app/api/partner/profile/route.ts : invalidatePublicEvent n'est pas importé (la fiche garde l'ancien nom et l'ancien logo, la recherche par nom l'ancien nom, jusqu'à 60 s)"

# e2e : partenaire de démonstration « organisateur3 », vraie route, nom rétabli à la fin
[cvcb] nouveau nom commercial visible sur la fiche après 50082 ms (événement 3331e9f5-9f1c-412e-9f69-e05033c9016a)
[cvcb] nom commercial rétabli : HTTP 200
  ✘   16 [responsive] › e2e/cvcb.responsive.spec.ts:278:9 › cvcb · invalidation › T3 — nouveau nom commercial de la partenaire : la fiche suit en moins de 5 s (50.9s)
```

**Correctif proposé** : après le succès, si `company_name`, `commercial_name` ou `logo_url` font partie de `update`,
`invalidatePublicEvent(null, 'profil de la partenaire')` (l'étiquette `fiche-publique` couvre toutes les fiches).

### 1.4 T4 — ventes sans invalidation (faible)

Aucune écriture du stock n'invalide les pages publiques : `checkout_create_payment` (réservation posée,
`held_quantity`), `payment_confirm` (`lib/payments/confirmation.service.ts:69`), `payment_release` (`:148`),
`free_tickets_claim`, `counter_sale` (guichet), `stock_reservations_expire` (tâches planifiées `stock-reservations` et
`payments-reconcile`). Une catégorie épuisée reste « en vente », avec son prix d'appel sur la carte, jusqu'à 60 s sur le
catalogue, l'accueil et la carte (l'achat lui-même est refusé par la base ; la fiche relit son stock en temps réel par
`GET /api/events/[id]`). Le lot a corrigé le cas des écritures **des catégories** (S1), pas celui des ventes.

**Preuve** (statique ; une preuve de bout en bout demanderait un paiement complet, hors de ce périmètre) :

```
# cvcb-1-trous (run 624)
not ok 1 - confirmTicketPayment : invalidatePublicEvent après payment_confirm (« Complet », prix d’appel de la carte, tranches de la fiche)
  error: "lib/payments/confirmation.service.ts : aucune invalidation après payment_confirm (une vente qui épuise une catégorie reste « en vente » jusqu'à 60 s sur le catalogue, l'accueil et la carte)"
```

**Correctif proposé** : invalider quand une vente fait passer une catégorie à zéro place, ou quand une réservation rendue
la fait repartir de zéro (les RPC rendent déjà les catégories touchées) ; au besoin regrouper (une invalidation par
événement toutes les 5 s au plus) pour ne pas vider le cache à chaque billet un soir d'affluence.

### 1.5 T5 — images de `public/images/` refusées sans session (moyenne, antérieur au lot)

**Affirmation à éprouver** (point 3 de la consigne) : les images de l'application s'affichent toujours. La règle `img-src`
du lot est juste ; c'est le **middleware** qui bloque : `/images/` n'est pas dans `PUBLIC_PREFIXES` (`middleware.ts:6-35` ;
`/branding/`, `/icons/`, `/leaflet/` y sont). Sans session, chaque fichier de `public/images/` reçoit une redirection
vers `/login?redirect=…` (`middleware.ts:247-249`) :

- `/images/paiement/wave.webp` et `om.webp` : logos « Payer avec » de la fiche et de l'écran de paiement
  (`components/payment/OperatorLogo.tsx:14-15`, balise `<img>` directe, design 1c du 19/11) : **cassés pour tout visiteur
  non connecté** ;
- `/images/event-placeholder.svg` : affiche de repli des écrans publics, servie sans optimiseur
  (`lib/events/event-image.ts:11`) ;
- `/images/og-image.png` : **image de partage** du site (`app/layout.tsx:40`, `:42`, `lib/events/share-preview.server.ts:38`),
  lue sans session par WhatsApp, Facebook ou X : l'aperçu d'un lien partagé n'a pas d'image quand cette image sert.

Sous HTTP de même origine (CI), la redirection reste dans l'origine : l'image est cassée sans que la CSP le signale. Sous
HTTPS derrière un relais (mesure mobile, G4), la redirection est construite à partir de `req.url` en `http://` : la CSP la
signale avec l'adresse de départ — c'est l'origine des deux lignes `[CSP-REPORT] img-src …/images/paiement/…` du run 617.

**Preuve** :

```
# e2e G4, vrai navigateur, https://localhost:44293 (run 626, jobs/responsive/e2e.log)
[cvcb] CSP sous HTTPS (https://localhost:44293) : 5 violation(s) ["img-src https://localhost:44293/images/paiement/wave.webp report /events/67e2945b-1504-418f-a816-a052ef21f418","img-src https://localhost:44293/images/paiement/om.webp report /events/67e2945b-1504-418f-a816-a052ef21f418","script-src eval report /login","connect-src https://localhost:44293/tickets?_rsc=1CyHGnH5jT2WZH4K report /aide", …]
  ✘   17 [responsive] › e2e/cvcb.responsive.spec.ts:372:9 › cvcb · CSP › G4 — aucune violation img-src sous HTTPS de même origine (accueil, Explorer, fiche, salles, tables, connexion, aide)

# cvcb-4-images, middleware sans session (run 627)
not ok 1 - chaque fichier de public/ est servi à un visiteur sans session (aucune redirection vers /login)
  error: |-
    images refusées sans session (logos de paiement, affiche de repli, image de partage) :
    /images/event-placeholder.svg → HTTP 307 vers /login?redirect=%2Fimages%2Fevent-placeholder.svg
    /images/og-image.png → HTTP 307 vers /login?redirect=%2Fimages%2Fog-image.png
    /images/paiement/om.webp → HTTP 307 vers /login?redirect=%2Fimages%2Fpaiement%2Fom.webp
    /images/paiement/wave.webp → HTTP 307 vers /login?redirect=%2Fimages%2Fpaiement%2Fwave.webp
```

**Correctif proposé** : ajouter `'/images/'` à `PUBLIC_PREFIXES` (fichiers statiques seulement : aucune page ni route
sous `/images`). Le test `cvcb-4-images` passe alors au vert. Accessoirement, construire l'adresse de `/login` à partir de
l'hôte et du protocole transmis par le relais (`x-forwarded-proto`) éviterait une redirection en `http://` derrière un
relais qui ne les réécrit pas.

## 2. Écritures qui changent la carte, le catalogue, l'accueil ou la fiche

| Écriture | Où | Invalidation | Preuve |
|---|---|---|---|
| Statut : soumission, validation, publication, suspension et réactivation par l'administration, retrait, clôture (`event_transition`) | `lib/events/event-lifecycle.service.ts:132` (routes partenaire et admin `…/transition`) | Oui | e2e du lot : suspension retirée de la carte en 27 à 48 ms (runs 617, 619) |
| Annulation, par la partenaire ou l'administration (`event_cancel`) | `lib/events/event-cancellation.service.ts:121` | Oui | e2e G2 « annulation » (22 ms, run 624) |
| Modification : titre, catégorie, description, dates et heures, lieu, ville, **position**, **affiche**, jauge, programme, infos pratiques (`event_update`) | `lib/events/event.service.ts:468` | Oui | e2e G2 « position », « dates », « affiche », « titre » (15, 13, 37 et 29 ms, run 624) |
| Catégories de billets : ajout, modification (arrêt de vente, prix, quota, dates de vente), suppression | `lib/events/event.service.ts:528`, `:562`, `:579` (S1 du lot) | Oui | e2e du lot : 39 à 89 ms (Explorer et carte) |
| « À la une » : ajout, ordre, période, retrait (`home_featured_*`) | `lib/events/featured.server.ts:223` | Oui | lecture (super-administrateur avec identité vérifiée : pas de bout en bout) |
| Statut de la partenaire (suspension en cascade de ses événements publiés, rétablissement) | `app/api/admin/partners/[id]/status/route.ts:121`, si `events_suspended` ou `events_restored` non vides (tableaux d'identifiants : `20261117000001_f3a_securite.sql:190`, `:198`) | Oui | test statique du lot + lecture de la RPC (pas de bout en bout : suspendre une partenaire de démonstration couperait les sessions des autres tests) |
| **Fin par la tâche planifiée** (`events_finish_overdue`, placement « À la une » retiré) | `app/api/cron/events-finish/route.ts` | **Non** | **T2** |
| **Profil de la partenaire** (nom, raison sociale, logo) | `app/api/partner/profile/route.ts` | **Non** | **T3** |
| **Ventes et réservations** (6 écritures, § 1.4) | paiement, billets gratuits, guichet, tâches planifiées | **Non** | **T4** |
| Ré-encodage des affiches (`event_poster_reencoded`), styles d'affiche (`poster_style_put`, rattrapage) | `scripts/reencode-posters.ts`, `lib/events/poster-styles-backfill.ts` | Non | Écarté : scripts de maintenance lancés hors du serveur Next (aucune invalidation possible) ; le cache expire en 60 s |
| Dépôt d'une affiche (`poster_style_put` par la route de dépôt) | `app/api/partner/upload/route.ts:106` | Sans objet | Le fichier est neuf : aucun événement publié ne le cite encore ; son style entre dans l'événement par `event_update` (invalidé) |
| Suppression d'un événement | `lib/events/event.service.ts` (garde `events_delete_guard`, EV423) | Sans objet | Brouillons jamais soumis seulement : rien de public |
| Promotion approuvée (`events.is_featured`, `featured_until`) | `app/api/admin/promotions/route.ts:81` | Sans objet | Colonnes lues par aucune page publique |

## 3. Garde-fous verts

| Point | Garde-fou | Ce qu'il prouve | Résultat |
|---|---|---|---|
| 1 | `cvcb-2-gardes` G1 (sans base) | 80 adresses piégées (zone énorme, négative, `NaN`, `Infinity`, 3 ou 5 nombres, hexadécimal, `;DROP TABLE`, `%00`, 5 000 chiffres ; dates impossibles, années 0 et 275 760, 94 jours ; `q` de 100 000 caractères, `' OR 1=1 --`, `),or(status.neq.PUBLIE`, `%`, `_`, `\`, RTL ; catégorie inconnue, `BROUILLON` ; paramètres répétés ; `status`, `select`, `limit`, `or`, `order` ignorés) sur 6 000 entrées de 10 statuts, positions absentes, illisibles ou hors du Sénégal, couleurs et images piégées, secrets dans les champs internes : jamais d'exception, refus ou zone ramenée au Sénégal et période ≤ 93 jours, jamais un non-publié, fini ou hors Sénégal, jamais un champ hors liste ni un secret, 300 au plus ; 2 880 combinaisons de filtres ; 2 000 lectures piégées en moins de 10 s | Vert (run 624) |
| 1 | `cvcb-3-base` B1 (base locale) | Un événement de chaque statut, publié fini, publié sans position ; **tous avec une position valide** sauf le dernier ; description, lieu et coordonnées de la partenaire secrets ; lecture réelle `readMapEntries` puis 10 000+ combinaisons de filtres et adresses piégées : seul le publié à venir sort, champs publics seulement | Vert (run 624) |
| 1 | `cvcb-2-gardes` G2 | Route : `GET` seul, ni session, ni cookie, ni en-tête lus, aucune écriture, `no-store` ; lecture en base sans paramètre, colonnes sans téléphone, adresse électronique, compte, description, adresse, infos pratiques, jauge | Vert (run 624) |
| 1 | e2e G5 (vrai serveur) | 19 adresses piégées : 200 ou 400, jamais 500, moins de 5 s, `no-store`, champs publics seulement ; `POST`, `PUT`, `PATCH`, `DELETE` → 405 | Vert (run 624) : `{"200":13,"400":6}`, aucun 500 |
| 2 | e2e G2 (vrai serveur) | Position, dates, affiche, titre (`event_update`) et annulation visibles en moins de 5 s | Vert (run 624) : `{"position":15,"dates":13,"affiche":37,"titre":29,"annulation":22}` ms |
| 3 | `cvcb-2-gardes` G3 | `img-src` exactement : `'self'`, `data:`, `blob:`, stockage Supabase, `images.unsplash.com`, `plus.unsplash.com`, hôte des tuiles ; aucune autre politique (middleware, pages, balises) ; concordance `next.config.mjs` ↔ `lib/map/tiles.ts` avec des adresses de tuiles réglées ; aucune image d'un autre hôte écrite dans le code | Vert (run 624) |
| 3 | e2e G4 (HTTPS de même origine, relais HTTP/2 de la mesure) | Accueil, Explorer (liste et carte), fiche (logos de paiement, carte du lieu), salles, tables, connexion, aide : aucune violation `img-src` **Rouge (run 626)** → T5 (§ 1.5) |
| 3 | Run complet 617 (`next-start.log` des jobs e2e et responsive) | Sur tout l'e2e (783 cas) et le responsive : aucune violation `img-src` en HTTP (la redirection vers `/login` y reste de même origine, l'image cassée n'est donc pas signalée) ; deux lignes `img-src` (logos de paiement) sous le relais HTTPS de la mesure mobile, expliquées par T5 | voir T5 |
| 4 | `cvcb-3-base` B2 (middleware) | Fichiers de `/leaflet/` servis sans session ; `../`, `%2e%2e`, `.%2e`, `x/../..`, majuscules, préfixe collé, requête ou ancre : jamais laissés passer vers une page ou une route protégée | Vert (run 624) |
| 4 | e2e G3 (requêtes HTTP brutes, chemins non normalisés) | 135 chemins détournés (`..%2f`, `%2e%2e%2f`, `..%5c`, `..\`, `//`, `%252e`, `..;`, `%2f`…) vers 9 pages et routes protégées : aucune réponse 2xx hors de la page de connexion | Vert (run 624) : `{"401":12,"404":76,"307→200":20,"308→307→200":15,"308→401":12}` (les 2xx sont la page de connexion après redirection) |
| 5 | e2e G1 ; `cvcb-2-gardes` G5 | « Autour de moi » seul : aucune requête hors tuiles, aucun stockage, aucun cookie ne porte la position ; rappel de `getCurrentPosition` sans envoi ni stockage ni journal | Vert (run 624) |
| 6 | `cvcb-2-gardes` G4 | Les 4 fichiers qui créent une carte (`ExploreMap`, `SenegalMapPreview`, `EventMap`, `MapPicker`) posent le fond par `addThemedTiles` ; un seul `tileLayer` ; mention jamais coupée ni masquée par une feuille de style ; aucune adresse de tuiles hors de `lib/map/tiles.ts` ; aucune clé | Vert (run 624) |
| 6 | e2e G6 ; e2e du lot | Fiche : aucune tuile avant « Afficher la carte », mention Stadia visible ensuite ; Explorer : aucune tuile avant la vue Carte ; accueil : aucune tuile avant l'aperçu (e2e du lot, runs 617 et 619) | Vert (run 624) |
| 7 | `cvcb-2-gardes` G6 ; relevé du run 617 | Carte et calendrier dans un seul module chargé par `next/dynamic`, importé par aucun autre fichier ; calendrier et carte ne lisent que `GET /api/events/carte` et n'affichent que ses champs ; premier chargement conforme au rapport (§ 4, écart 1 pour l'îlot) | Vert (run 624) |

## 4. Écarts du rapport du lot (sans gravité)

1. **Îlot de l'accueil plus lourd de 3 047 octets gzip.** Le premier chargement de l'accueil et d'Explorer est bien celui
   du rapport (relevé `scripts/js-budget.mjs` du run 617, job e2e : `/` 224 719, `/events/[id]` 233 302, `/explore`
   234 826, table des morceaux à 50 entrées). Mais l'aperçu de la carte (`SenegalMapPreview`, importé sans `import()` par
   `components/events/HomeSenegalMap.tsx:6`) entre dans le morceau de l'îlot « Près de chez vous », chargé après la page à
   chaque visite de l'accueil : comparaison des morceaux chargeables du run 614 (code de `main`) et du run 617, un morceau
   de 6 144 octets disparaît et un de **9 191** octets apparaît, marqué `tiles.stadiamaps.com, ev-point`. Le rapport dit
   « aucun code de plus au premier chargement » (vrai au sens du budget) sans chiffrer ce surcoût d'après chargement.
2. **Test cité qui n'existe pas.** `next.config.mjs:46` renvoie à `tests/schema/carte-b-fond.test.ts` pour la concordance
   des origines de tuiles avec `lib/map/tiles.ts` ; ce fichier n'existe pas. `carte-b-ecrans` ne la vérifie qu'avec les
   réglages par défaut ; `cvcb-2-gardes` G3 la vérifie avec des adresses réglées (vert).

## 5. Points écartés

| Point | Pourquoi écarté |
|---|---|
| Injection de filtre dans la requête à la base (`q`, `ville`, `categorie`…) | Impossible par construction : `readMapEntries()` ne reçoit aucun paramètre (`map-data.server.ts:41`), la requête est fixe (statut PUBLIE, position non nulle) et mise en cache sans clé par requête ; les filtres s'appliquent en mémoire (`selectMapEvents`). Prouvé par `cvcb-2-gardes` G2 et par les adresses piégées sur le vrai serveur (G5). |
| Le texte cherché (`q`) porte aussi sur le nom de la partenaire et le lieu, que la carte ne rend pas : on peut tester si un événement « contient » un nom | Ces données sont déjà publiques (fiche : lieu et organisateur affichés ; liste d'Explorer : même recherche). Aucune donnée non publique n'est atteinte (B1 : 10 000+ combinaisons sur données réelles, description et coordonnées de la partenaire jamais trouvées). |
| Tuiles demandées à Stadia autour de la position après « Autour de moi » | Inhérent à toute carte centrée sur un lieu : au zoom 13, une tuile couvre environ 5 km ; c'est le même grain que choisir un quartier dans « Aller à ». Ni la position exacte ni un identifiant ne partent chez Stadia (G1 : aucune autre requête, aucun stockage, aucun cookie). À mentionner dans la politique de confidentialité (Stadia reçoit les tuiles vues). |
| Formulaires de la partenaire et de l'administration (`MapPicker`, cartes des salles et établissements) : tuiles dès l'affichage | Écrans d'outils où la carte est l'objet de l'écran ; la règle « aucune tuile avant le geste » vise les écrans publics (Explorer, accueil, fiche : verts). |
| Chemins `/leaflet/..%2fadmin` et voisins laissés passer par le middleware | Le préfixe les laisse passer (l'URL ne décode pas `%2f`), mais le routeur de Next ne les relie à aucune page : 404 sur le vrai serveur (G3). |
| G4, `connect-src …/tickets?_rsc=…` depuis `/aide` | Préchargement par Next d'un lien vers une page protégée (`/tickets`) pour un visiteur sans session : redirection vers `/login` attendue ; signalée seulement parce que le relais de test la construit en `http://`. Aucune donnée, aucune image. |
| `script-src eval` sur `/login` | Déjà relevé avant le lot (runs précédents) ; hors du périmètre images. |
| Politique de sécurité du contenu en mode rapport seulement | Décision antérieure (lot 9 quater, AUD-11 : la politique bloquante est pour le lot de mise en ligne) ; la règle `img-src` resserrée par le lot est exacte (G3, G4). |
| Événements publiés sans position absents de la carte et du calendrier | Choix documenté (rapport du lot, § 11 ; `docs/apres-lancement.md`). |
