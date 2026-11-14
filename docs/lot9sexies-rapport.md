# Lot 9 sexies — Mise à jour de Next.js et des dépendances

Branche `lot9sexies/dependances`, partie de `main` (d6ea917d). Rien n'est fusionné, aucune migration.

## À lire en premier

- **Faille trouvée et corrigée en premier : déni de service par une liste trop longue (zod, GHSA-mrhx-c7xc-m3w5).** Zod 3 accumule une erreur par élément invalide d'une liste, **même quand la liste a une borne** (`.max`) : zod 3 continue d'examiner chaque élément après avoir refusé la longueur. Mesure sur la version du dépôt (3.25.76) : 200 000 éléments invalides, soit environ 400 Ko de JSON, donnent 200 001 erreurs et une soixantaine de Mo de mémoire. Toute route qui valide une liste venue d'une requête pouvait donc épuiser la mémoire du serveur. L'avis ne parle que des listes sans borne : nos schémas, bornés, étaient exposés aussi. Correctif : zod 4.6.7, qui s'arrête au refus de la longueur (1 erreur, 4 ms), et une borne sur les six listes qui n'en avaient pas. Test rouge d'abord (017038d2), correctif bc5b5670.
- **Next.js 14.2.35 → 15.5.28.** Aucune 14.2.x ne corrige les avis de AUD-10 : la 14.2.35 est la dernière de la ligne 14 et reste vulnérable aux 25 avis. La 15.5.28 est la plus petite version qui les corrige tous (deux avis, dont l'exécution de code à distance par une image SVG, ne sont corrigés qu'à partir de 15.5.28). Elle est figée exactement : un `npm audit fix` l'avait montée en 15.5.29. React reste en 18.
- **`npm audit --omit=dev` : 5 vulnérabilités avant (1 critique, 4 élevées), 0 après.**
- **Budgets de poids JavaScript relevés, sur ta décision.** Le moteur client de Next 15 pèse 14 Ko gzip de plus que celui de Next 14, sur toutes les pages, sans option pour l'alléger. Le code de l'application, lui, n'a pas grossi. Chaque budget est relevé exactement de ce coût, mesuré route par route ; la marge laissée au code de l'application est la même qu'avant (§ 4).
- Run « avant » : **run 184** (main d6ea917d), 390/390, e2e vert, 441 captures. Run « après » : **run 186** (commit de ce rapport) : 391/391, `tests/audit/` et `tests/audit-auth/` vertes, budgets respectés, e2e vert avec ses captures.
- **Deux effets de Next 15 trouvés par l'e2e (run 185) et corrigés** : le billet hors ligne n'était plus mis en cache par le service worker, et la balise iPhone `apple-mobile-web-app-capable` avait disparu (§ 5).

## 1. Versions

| Paquet | Avant | Après | Pourquoi |
|---|---|---|---|
| `next` | 14.2.35 | **15.5.28** (figé) | 25 avis (AUD-10), dont 3 exécutions de code à distance |
| `eslint-config-next` | 14.2.35 | 15.5.28 (figé) | va avec `next` |
| `zod` | 3.25.76 | **4.6.7** | GHSA-mrhx-c7xc-m3w5 (faille ci-dessus) |
| `sharp` | 0.33.5 | **0.35.5** | libvips, libheif, librsvg (3 avis élevés) |
| `postcss` | 8.4.31 (dans next), 8.5.26 | **8.5.33** partout | 4 avis élevés ; next épingle 8.4.31, d'où `overrides` (`next` → `$postcss`) |
| `source-map-js` | 1.2.1 | 1.2.2 | 1 avis élevé (`npm audit fix`, sans `--force`) |
| `react`, `react-dom` | 18.3.1 | inchangés | Next 15 accepte React 18 |

`package-lock.json` est produit par npm 10.9.9, la version de la CI. Jamais `npm audit fix --force`.

## 2. Failles corrigées

| Paquet | Avis | Gravité |
|---|---|---|
| zod | GHSA-mrhx-c7xc-m3w5 (mémoire épuisée par une liste trop longue) | élevée |
| next | les 25 avis listés dans AUD-10, dont GHSA-2464-fhr4-w9xw (code à distance, image SVG), GHSA-2xp9-vwfh-vxw4 (code à distance, AVIF : le format est activé dans `next.config.mjs`), GHSA-p293-qw3h-jr36 (code à distance, serveur Windows), contournement et empoisonnement de cache du middleware, dénis de service des composants serveur | critique |
| postcss | GHSA-qx2v-qp2m-jg93, GHSA-6g55-p6wh-862q, GHSA-fxqj-rqcc-2cmp, GHSA-r28c-9q8g-f849 | élevée |
| sharp | GHSA-f88m-g3jw-g9cj, GHSA-rgj7-g3m4-5g8c, GHSA-wq5f-xc86-pv6w | élevée |
| source-map-js | GHSA-68fv-2mgg-jv7q | élevée |

## 3. Failles restantes et leur risque

En production : **aucune** (`npm audit --omit=dev` : 0).

En développement seulement (9 avis, déjà présents sur `main`, aucun ajouté par le lot) : `@typescript-eslint/*`, `minimatch`, `brace-expansion`, `js-yaml` (chaîne d'ESLint) et `postcss-selector-parser` (Tailwind, à la construction). Ce sont des dénis de service par expression régulière ou par entrée malformée. Ces outils ne tournent que sur un poste de développement ou en CI, sur notre propre code ; ils ne sont pas livrés. Risque réel : nul en production. Ils se corrigent sans changement majeur (`npm audit fix`), mais hors du périmètre demandé (dépendances de production) ; je ne l'ai pas fait pour ne pas changer les règles du lint dans ce lot.

## 4. Budgets de poids JavaScript

Mesure locale, même construction que la CI (`scripts/e2e/build-mesure.mjs`), `main` contre la branche. La mesure locale de `main` retombe sur celle de la CI à 3 octets près (accueil : 216 982 contre 216 985 au run 184).

| Route | Avant | Après | Écart | Budget avant | Budget après |
|---|---|---|---|---|---|
| `/` | 216 982 | 226 324 | +9 342 | 217 000 | 226 342 |
| `/events/[id]` | 223 281 | 232 597 | +9 316 | 224 000 | 233 316 |
| `/tickets` | 239 555 | 248 972 | +9 417 | 241 000 | 250 417 |
| `/controller/scanner` | 224 989 | 233 900 | +8 911 | 226 000 | 234 911 |
| `/billet/hors-ligne` | 212 587 | 221 855 | +9 268 | 215 000 | 224 268 |

D'où vient l'écart, sur l'accueil : le morceau du routeur de Next passe de 32 040 à 46 444 octets (+14 404 : client « flight » de React 19, 145 modules de routeur au lieu de 112), react-dom de 53 826 à 54 429 ; le morceau de Supabase et le code de l'application baissent légèrement. Aucune option de Next 15 ne retire ce surcoût. L'autre voie (charger le client Supabase après l'affichage) changeait le moment où la connexion apparaît : écartée, par ta décision.

## 5. Fichiers changés

**Zod 4 (bc5b5670).** Messages identiques à ceux de zod 3 :
- `lib/validations/zod-messages.ts` (nouveau) : `zodTypeErrors({ required, invalid })` remplace `required_error` et `invalid_type_error`, que zod 4 a retirés. Mêmes messages pour une valeur absente, `null` ou d'un autre type, et pour une liste fermée.
- `lib/validations/account.ts`, `invitation.ts`, `payment.ts`, `transfer.ts`, `lib/env.ts`, et les routes `account/password`, `account/password-confirm`, `auth/activate`, `auth/forgot-password`, `auth/login`, `auth/reset-password`, `controller/shifts/close`, `partner/profile`, `tickets/[id]/transfer`, `withdrawals/otp` : cette aide, ou `error` à la place de `errorMap`.
- `lib/validations/event.ts` : `frenchErrorMap` réécrite sur les codes de zod 4 (`invalid_value`, `invalid_format`, `origin`), mêmes textes français ; `parseWithFrenchErrors` passe la carte par `error`.
- Routes `auth/register`, `controller/profile`, `controller/setup`, `partner/events/[id]/cash-refunds/[paymentId]`, `partner/register`, `partner/team/assignments`, `partner/team/invite`, `withdrawals/request`, page `register` : `error.errors` devient `error.issues`.
- `lib/events/event.service.ts` : `z.record` à deux arguments.
- `lib/validations/auth.ts` et page `partner/register` : `RegisterPartnerFieldsSchema` exporté à part (zod 4 refuse `.omit()` sur un objet qui porte un `.refine()` ; la page utilisait `.innerType()`, soit exactement ces champs).
- Bornes ajoutées, choisies au-dessus de tout usage réel : `event_ids` et `eventIds` des routes `partner/team/assignments` (200, comme la liste `assignments` voisine) et `partner/team/invite` (200) ; `guest_names` des invitations (`MAX_INVITATION_PHONES`, un nom par numéro) ; `activities` de l'inscription partenaire (nombre d'activités possibles).

**Next 15 (f4d5d10a, d3bf5141, 0113a719, 2652002f).** Codemod officiel `next-async-request-api` sur `app/`, puis écritures du codemod simplifiées : `Promise<Promise<X> | X>` → `Promise<X>`, `await Promise.resolve((await x.params))` → `await x.params`, 19 marques `@next-codemod-error` retirées après vérification que l'appelé attend déjà la promesse (`routeParam`, `eventIdOf`, `handleAnonymize`). Le code d'origine acceptait déjà les deux formes.
- Routes (41), second argument typé { params: Promise<…> }, attendu (await) : `account/controller-invitations/[id]`, `admin/cashouts/[id]/mark-paid`, `admin/cashouts/[id]/not-sent`, `admin/cashouts/[id]/resend`, `admin/events/[id]/cancel`, `admin/events/[id]/transition`, `admin/notifications/[id]/retry`, `admin/notifications/[id]`, `admin/partners/[id]/status`, `admin/users/[id]/anonymize`, `controller/shifts/[id]/summary`, `events/[id]`, `halls/[id]`, `notifications/[id]/read`, `partner/events/[id]/cancel`, `partner/events/[id]/cancellation`, `partner/events/[id]/cash-refunds/[paymentId]`, `partner/events/[id]/cash-refunds`, `partner/events/[id]/regisseur-pin`, `partner/events/[id]/shifts`, `partner/events/[id]/tickets/[ticketId]/refund`, `partner/events/[id]/tickets/lookup`, `partner/events/[id]/transition`, `partner/products/[id]`, `partner/products/[id]/status`, `partner/shifts/[id]/validate-discrepancy`, `partner/team/[eventId]`, `partner/team/controller/[controllerId]`, `payments/[transactionId]/cancel`, `payments/[transactionId]/status`, `restaurants/[id]/menu`, `restaurants/[id]/tables`, `tickets/[id]/live-code`, `tickets/[id]/offline-codes`, `tickets/[id]/pdf`, `tickets/[id]/refund`, `tickets/[id]/transfer`, `tickets/claim/[token]`, `tickets/transfers/[id]/cancel`, `tickets/transfers/[id]/claim`, `tickets/transfers/[id]/decline`.
- Pages client (6), params ou searchParams déballés par use() (pour `controller/setup`, le paramètre garde le nom `searchParams` que vérifie `dette-interface-lot7`) : `app/controller/setup/page.tsx`, `app/events/[id]/page.tsx`, `app/halls/[id]/page.tsx`, `app/paiement/[id]/page.tsx`, `app/restaurants/[id]/menu/page.tsx`, `app/restaurants/[id]/tables/page.tsx`.
- Pages serveur (3), params attendu (await) : `app/login/page.tsx`, `app/partner/events/[id]/caisse/page.tsx`, `app/partner/events/[id]/team/page.tsx`.
- Layout (1), params attendu (await), y compris generateMetadata : `app/events/[id]/layout.tsx`.
- `lib/events/pilotage.service.ts` : type `RouteParams` en promesse (contrôle de types de `next build`).
- `public/sw.js` (0113a719) : Next 15 découpe la charge RSC de la page en plusieurs balises `self.__next_f.push(…)`, et une coupure tombait au milieu d'un nom de fichier (« static/chunks/460 » puis « 6-….js »). Le service worker cherchait les ressources de la coquille hors ligne dans ce texte : il retenait le fragment, recevait un 404 et abandonnait toute la mise en cache (« tout ou rien »). Le billet n'était plus disponible hors ligne (run 185 : 8 captures, fumée, terrain, recette). Les morceaux sont recollés avant la recherche, et un chemin sans extension de ressource n'est plus retenu. Version du service worker et nom du cache inchangés.
- `app/layout.tsx` (2652002f) : Next 15 tire désormais `mobile-web-app-capable` de `appleWebApp.capable`, et plus la balise iPhone. `apple-mobile-web-app-capable` est déclarée dans `metadata.other`, à la place de `mobile-web-app-capable` qui y était : même `<head>` qu'avant, une balise de chaque (run 185, phase pwa).
- `next.config.mjs` : `serverExternalPackages` (ex-`experimental.serverComponentsExternalPackages`) ; `experimental.instrumentationHook` retiré (instrumentation chargée d'office).
- `tsconfig.json` : `"target": "ES2017"`, ajouté par `next build` de Next 15.
- `scripts/js-budget.json` : § 4.

**Dépendances (711c17e3).** `package.json`, `package-lock.json`.

## 6. Tests

- Nouveau : `tests/schema/zod-listes-bornees.test.ts`. Il vérifie (1) zod 4.6.6 ou plus récent ; (2) qu'une liste bornée trop longue donne une seule erreur ; (3) qu'aucun `z.array(…)` de `app/`, `lib/`, `components/` n'est sans borne (lecture de l'arbre syntaxique). Rouge sur `main`, sortie brute :
  ```
  ✖ zod installée en 4.6.6 ou plus récent
    AssertionError [ERR_ASSERTION]: zod 3.25.76 : la correction de GHSA-mrhx-c7xc-m3w5 arrive en 4.6.6
  ✖ une liste bornée trop longue donne UNE erreur, pas une par élément
    AssertionError [ERR_ASSERTION]: liste de textes, .max(10) : 200001 erreur(s) pour 200000 éléments (une seule attendue : le refus de la longueur)
  ✖ chaque z.array(…) de app/, lib/ et components/ a une borne (.max ou .length)
    app/api/partner/team/assignments/route.ts:27 (chaîne : optional)
    app/api/partner/team/assignments/route.ts:28 (chaîne : optional)
    app/api/partner/team/invite/route.ts:46 (chaîne : optional)
    app/api/partner/team/invite/route.ts:47 (chaîne : optional)
    lib/validations/auth.ts:220 (chaîne : min)
    lib/validations/invitation.ts:72 (chaîne : optional)
  ℹ pass 0
  ℹ fail 3
  ```
- Modifiés, chacun pour un changement de la dépendance et sans relâcher une vérification :
  - `tests/parcours/evenement-404.test.ts` : la route reçoit `params` en promesse, comme Next 15 l'envoie ; le digest attendu de `notFound()` est lu sur la version installée (Next 15 : `NEXT_HTTP_ERROR_FALLBACK;404`, au lieu du littéral `NEXT_NOT_FOUND`).
  - `tests/parcours/compte-photo.test.ts` : type `Sharp` importé par son nom (sharp 0.35 ne l'expose plus sous `sharp.Sharp`).
  - `tests/parcours/perf-statique.test.ts` : `sharp` épinglé à 0.35.5 au lieu de 0.33.5 ; les binaires Linux restent exigés dans le lock.
  - `docs/recette-billetterie.md` : 8 citations `fichier:ligne` recalées sur les mêmes tests (lignes décalées).
- `tests/audit/` et `tests/audit-auth/` : aucune modification ; toutes vertes au run « après ».

## 7. Runs

| Run | Commit | Résultat |
|---|---|---|
| 184 (« avant ») | d6ea917d (main) | 390/390 ; e2e vert, 441 captures, 0 en échec ; budgets respectés |
| 185 | 37904339 | 388/391 : `evenement-404` (digest de `notFound()`), `perf-statique` (sharp épinglé à 0.33.5), `recette-matrice` (citations décalées) ; e2e : 8 captures du billet hors ligne, fumée, terrain, recette (service worker), pwa (balise iPhone). Budgets non mesurés par `verify` (arrêt à l'étape des tests) |
| 186 (« après ») | commit de ce rapport | tout vert : 391/391, budgets respectés, e2e vert |

Avant de pousser, chaque correction du run 185 a été vérifiée sur une construction locale (même construction que la CI) : les cinq budgets passent, le `<head>` porte les deux balises, et la pré-mise en cache du service worker accepte les 21 ressources de la coquille, sans refus.

## 8. Captures de l'e2e

Comparaison pixel par pixel de toutes les captures du run 185 (Next 15) avec celles du run 184 (`main`), étalonnée sur l'écart entre deux runs du même code (183 et 184 : dates, compteurs, identifiants tirés au hasard). Les écrans demandés, regardés côte à côte : accueil, fiche événement (`evenement-publie`, `fiche-barre-achat`), paiement (`paiement-modale`, `paiement-succes`), Mes billets (`mes-billets`, `mes-billets-recus`), scanner (`controleur-scanner`), pilotage (`pilotage-apercu`), administration (`admin-evenements`). **Rien n'a bougé** : mêmes mises en page, polices, couleurs et composants. Les seuls écarts viennent des données du parcours : heures relatives au moment du run (« 20:15 » contre « 21:45 »), références de paiement, ordre des notifications, compte à rebours du code. Deux cas regardés de près :
- `fiche-barre-achat` : une heure plus longue passe à la ligne et décale la page de quelques pixels ; le pointeur, resté où la capture a cliqué, se trouve alors sur la croix de la bulle de la carte, qui prend son style de survol (`globals.css`, fond `surface-sunken`). Même style qu'avant, autre position du pointeur.
- Billet hors ligne : en échec au run 185, corrigé (§ 5) ; vérifié au run 186.

Depuis le run 185, seuls le service worker, une balise du `<head>` et des tests ont changé : les captures des écrans ci-dessus ne peuvent pas bouger au run 186.

## 9. Effets à connaître

- **Node 20.9 au moins** sur le serveur (sharp 0.35). La CI tourne en Node 22.
- Next 15 : les routes GET ne sont plus mises en cache par défaut (les nôtres étaient déjà `force-dynamic`) ; le cache du routeur côté navigateur ne garde plus les pages dynamiques 30 s (une page revisitée est rechargée) ; `next lint` affiche un avertissement d'obsolescence (il sera retiré en Next 16), sans effet.
- Le Router App de Next 15 embarque React 19, même avec React 18 installé (comme Next 14 embarquait sa propre version de React 18). Aucun usage retiré par React 19 dans le code (`defaultProps`, `propTypes`, références par chaîne : aucun).
- sharp 0.35 règle autrement l'AVIF avec perte (`next/image`) : même rendu attendu, poids des images légèrement différent.

## 10. À faire de ton côté

1. Sur le poste de recette, après avoir récupéré la branche : arrêter le serveur de développement (Windows verrouille le moteur de Next tant qu'il tourne), puis `npm install` (ou `npm ci`), puis relancer.
2. Vérifier que Node est en version 20.9 ou plus récente (`node -v`).
