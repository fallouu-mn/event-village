# Design 1a — Fondations

Branche `design-1a/fondations`, partie de `main` à `08d854851`. `main` y a été fusionné le 18/11 (finition 3d et correctifs cvf2b, `197480d71`) avant la fusion dans `main`. Aucune migration.

Ce lot ne contient ni logique métier, ni route d'API, ni page repeinte. Il touche seulement ce qui est commun à toutes les pages : couleurs, thème, logo, toasts, composants de base, pages spéciales et chargements.

## À lire en premier

- **Rendu des pages.** Les anciens noms de couleur restent des **alias** de la charte : une page pas encore repeinte (lots 1b et 1c) garde son dessin, avec les nouvelles couleurs. Une **règle de lint** interdit les anciens noms dans tout fichier nouveau ou modifié.
- **Décisions à relire** (détail plus bas, section « Décisions ») :
  - `brand-vif` ;
  - en-tête des emails sans image (règle G.51) ;
  - service worker inchangé (contrat 5.3) ;
  - couleurs du manifeste (contrat D24 du lot 7) ;
  - icône maskable à fond uni ;
  - quatre fichiers de la finition 3d, revus après sa fusion ;
  - toasts et barre de progression chargés à la demande, pour tenir les budgets JS.
- **Résultats.**
  - Le run complet 342 était rouge ; ses rouges sont corrigés (section « Runs »).
  - Après la fusion de `main`, tous les budgets JS tiennent en mesure locale, sans relèvement.
  - Le run rapide de fin et le run complet de `main` après fusion sont dans la section « Runs ».

## Ce qui est fait

### 1. Couleurs
- **Jetons de la charte**, en clair et en sombre : `app/globals.css` (canaux « r g b ») et `tailwind.config.ts` (`bg-background`, `text-foreground`, `bg-card`, `bg-primary`…).
- **Anciens noms en alias**, selon la table de `direction.md`, section 2 : `surface` → `card`, `fg` → `foreground-strong`, `brand` → `primary`, `-bg` / `-fg` → `-soft` / `-text`…
- **Règle de lint.** `scripts/design-anciens-noms.mjs` est branché sur `npm run lint` et sur `tests/schema/design-anciens-noms`. L'inventaire figé à `08d854851` liste 151 fichiers qui emploient encore un ancien nom. Un fichier nouveau ou modifié n'en contient aucun.
- **Renommeur.** `scripts/design-renommer.mjs` passe un fichier aux noms de la charte, alias pour alias, avec un rendu identique.
- **Contrastes en CI.** `contraste.mjs --verifier` mesure tout sans réécrire. `tests/schema/design-jetons` prouve que les 84 valeurs de l'application (42 jetons, clair et sombre) sont celles mesurées.
- **Boutons.** Version B en clair, version A en sombre. Le grand bouton en dégradé est la variante `gradient` de `Button` : texte blanc gras de 19 px, un par page.
- **Focus** en deux tons partout : anneau orange, liseré sombre.
- **CSS retiré** : CSS mort et animations décoratives (flottements, zoom lent, dégradé qui défile). Durées ramenées entre 150 et 250 ms.

### 2. Thème
- **Par défaut**, le thème du téléphone. Le choix est mémorisé dans le cookie `ev-theme` (`lib/theme.ts`).
- **Aucun flash.** Un script de `<head>` pose le thème avant le premier affichage. Le gabarit ne lit pas le cookie côté serveur, ce qui garde les pages statiques.
- **Ancien choix** rangé dans `localStorage` : recopié dans le cookie, puis effacé.
- **Inchangés** : le scanner (jetons `scan-*`), le QR (fond blanc) et le billet PDF.

### 3. Logo « Bras levés »
- **En-tête.** Le symbole est une image SVG, ce qui n'ajoute aucun JavaScript. Le nom est en Plus Jakarta Sans, graisse 800, à la couleur du thème.
- **Favicon** : `.ico` en 16, 32 et 48 px, et SVG réduit.
- **Icônes** 192, 512, maskable et apple-touch 180, sous les mêmes noms qu'avant.
- **Manifeste** aux couleurs de la charte.
- **Image de partage** 1200 × 630 (openGraph, twitter).
- **En-tête des emails.**
- **Ancien logo retiré** : anciens SVG et `scripts/generate-pwa-icons.mjs`, qui le redessinait.

### 4. Toasts
- **Un seul système** : `components/ui/Toast.tsx`.
  - Réussite : 4 s, en pause au survol et au focus.
  - Action annulable : 6 s, avec « Annuler ».
  - Erreur générale : reste à l'écran, avec « Réessayer ».
  - Trois toasts au plus. En bas sur téléphone, en haut à droite sur ordinateur. Annoncés aux lecteurs d'écran (`status` ou `alert`).
  - Garde-fou : un message qui ressemble à un code technique est remplacé par une phrase simple. Une coupure réseau (« Failed to fetch ») devient « Connexion impossible. Vérifiez votre réseau, puis réessayez. ».
  - Affichage chargé à la demande. Les cartes, les icônes et la minuterie (`components/ui/ToastCard.tsx`) arrivent au premier toast, ou plus tôt quand le navigateur est libre. Le fournisseur et l'API restent dans le gabarit.
- **Appels repris un par un** : liste plus bas.
- **Autres affichages techniques corrigés** :
  - écran de départ du scanner : plus de « Failed to fetch » ;
  - profil du contrôleur : statut HTTP retiré.

### 5. Composants de base
Tous les composants de `components/ui` sont sur les noms de la charte.
- **Bouton et grand bouton.**
- **Champ** : 48 px de haut ; libellé, aide, et erreur sous le champ avec une icône.
- **Carte** (`Card`) et **carte d'événement** : affiche en 16/10, arrondi de 12 px.
- **Onglets** : soulignés de 3 px à l'orange de la marque, libellé actif foncé et gras.
- **Pastilles** : 12 px, gras.
- **Puces de filtre** (`FilterChip`) : `aria-pressed`, 44 px de haut.
- **Fenêtre et confirmation** : le bouton dit l'action et le montant.
- **Feuille glissante** (`BottomSheet`) : trois hauteurs ; poignée **et** « Tout afficher » (WCAG 2.5.7).
- **Squelette, état vide.**
- **Repère de carte** « Repère » (`MapMarker.ts`, `.ev-repere`) : prix, choisi, « À la une », regroupement.
- **Vitrine** : `app/vitrine-design`, pour les captures. Elle est introuvable sans `EV_VITRINE_DESIGN=1`, que seul l'e2e pose.

### 6. Pages spéciales
- **Gabarit commun** : `components/ui/SpecialPage.tsx`.
- **Page introuvable** : « Cette page n'existe pas ou a été déplacée. », « Retour à l'accueil », « Explorer les événements ».
- **Erreur** : « Quelque chose s'est mal passé de notre côté. », « Réessayer », « Accueil ».
- **Hors ligne** : `/hors-ligne`, ou contenu de la page d'erreur quand le navigateur est sans réseau : « Vous n'avez pas de réseau. Vos billets restent disponibles. », « Mes billets ».
- **Sécurité** : aucune donnée personnelle, aucun détail d'erreur à l'écran. Le service worker ne met rien de nouveau en cache, sauf le symbole public du logo.

### 7. Chargements
- **Nouveaux squelettes** à la forme du contenu : accueil, espace partenaire, pilotage, administration. Ceux d'Explorer, de la fiche, de Mes billets et du tableau de bord partenaire existaient : ils prennent les jetons par `Skeleton`.
- **Barre de progression** orange en haut pendant les changements de page (`NavigationProgress`), sans bibliothèque. Elle est chargée quand le navigateur est libre (`NavigationProgressDifferee`). Dans les toutes premières secondes après l'ouverture d'une page, un changement de page se fait donc sans barre.

## Jetons et contrastes

Valeurs de `docs/design/jetons.css`, identiques dans l'application : `tests/schema/design-jetons` le vérifie. La mesure complète, 89 couples dont aucun sous le seuil, est dans `docs/design/direction.md`, section 2.

| Jeton | Clair | Sombre | Couple mesuré | Contraste (clair / sombre) |
|---|---|---|---|---|
| `background` / `foreground` | #FFFFFF / #3A3A3A | #121212 / #F2F2F2 | texte courant sur le fond | 11,37:1 / 16,73:1 |
| `foreground-strong` | #1A1A1A | #FFFFFF | titres, montants sur le fond | 17,40:1 / 18,73:1 |
| `muted-foreground` | #666666 | #A6A6A6 | texte secondaire sur le fond | 5,74:1 / 7,70:1 |
| `card`, `popover`, `muted` | #FFFFFF, #FFFFFF, #F5F5F5 | #1A1A1A, #222222, #262626 | fonds | — |
| `border`, `input` | #E6E6E6, #858585 | #333333, #7A7A7A | bord des champs sur la carte (≥ 3:1) | 3,69:1 / 4,05:1 |
| `primary` / `primary-foreground` | #C2410C / #FFFFFF (B) | #FF8A3D / #1A1A1A (A) | texte du bouton principal | 5,18:1 / 7,42:1 |
| `primary-text` | #C2410C | #FF8A3D | orange en texte sur le fond | 5,18:1 / 7,99:1 |
| `brand` (`brand-vif`) / `brand-foreground` | #FF8A3D / #1A1A1A | idem | texte sur l'orange de la marque | 7,42:1 / 7,42:1 |
| `gradient-from` → `gradient-to` | #EA580C → #DB2777 | idem | grand bouton (blanc gras 19 px) | 3,56:1 (grand texte) |
| `success`, `warning`, `danger`, `info` (`-soft`, `-text`) | valeurs inchangées | | texte de l'état sur son fond doux | 6,81:1 à 7,60:1 / 6,40:1 à 9,82:1 |

## Toasts remplacés

- **Volume** : 197 appels dans 51 fichiers, tous passés au nouveau système (même API, avec des options en plus).
- **Revue appel par appel** : 25 fichiers modifiés. Les autres gardent leurs appels, déjà conformes.
- **Règles suivies** :
  - « Réessayer » seulement sur une erreur réseau ou serveur qu'on peut relancer telle quelle ;
  - « Annuler » seulement là où une fonction existante défait l'action ;
  - jamais d'« Annuler » ni de « Réessayer » sur un paiement, un remboursement, un transfert ou un SMS ;
  - une erreur de champ va sous le champ.

| Fichier | Changement |
|---|---|
| `app/notifications/page.tsx` | Réessayer (marquer comme lu, tout marquer) |
| `app/profile/notifications/page.tsx` | Réessayer et **Annuler** (préférence de notification) ; statut HTTP retiré |
| `app/events/[id]/page.tsx` | Réessayer sur le calcul du total ; statut HTTP retiré ; achat jamais relancé depuis un toast |
| `app/paiement/[id]/page.tsx` | statut HTTP retiré ; ni Réessayer ni Annuler (paiement) |
| `app/halls/[id]/page.tsx` | « salle déjà réservée » déplacé **sous le champ** « Date de début » ; message brut remplacé |
| `app/restaurants/[id]/tables/page.tsx`, `…/menu/page.tsx` | message brut remplacé par une phrase simple |
| `app/partner/tables/page.tsx`, `app/partner/halls/page.tsx` | Réessayer (chargements, enregistrements, suppressions en erreur réseau) |
| `app/partner/products/page.tsx` | Réessayer ; **Annuler** sur la bascule de stock |
| `app/partner/products/new/page.tsx`, `app/partner/calendar/page.tsx`, `app/partner/orders/page.tsx`, `app/partner/dashboard/page.tsx` | Réessayer (chargement, statut de commande, essai gratuit) |
| `app/partner/events/page.tsx`, `app/partner/events/[id]/page.tsx` | motif refusé **sous le champ** du motif ; Réessayer sur une erreur générale |
| `components/partner/team/TeamPanel.tsx`, `TeamDialogs.tsx` | motif et numéro d'invitation **sous leurs champs**, avec focus ; Réessayer |
| `components/partner/pilotage/InvitationsTab.tsx`, `components/events/EventForm.tsx` | Réessayer (annulation d'invitation, relecture des verrous) |
| `components/tickets/TicketCard.tsx` | Réessayer (PDF, annulation de transfert) ; statut HTTP retiré ; QR gardé sur fond blanc |
| `components/notifications/PushDeviceCard.tsx` | **Annuler** sur la désactivation |
| `app/admin/dashboard/page.tsx`, `app/admin/events/page.tsx` | Réessayer (documents, actualisations, validation d'un partenaire) |
| `app/admin/referral/page.tsx` | Réessayer et **Annuler** (statut Ambassadeur) ; message brut remplacé |

**Gardés en toast, faute de champ désignable :**
- refus de stock par formule (fiche d'un événement) ;
- refus globaux des tables et du menu ;
- refus d'envoi juste après la création d'un événement (`EventForm`) ;
- refus de schéma de l'invitation sans champ précis.

**Revus après la fusion de la finition 3d**, qui modifie les mêmes fichiers. Ils passent par le nouveau système, l'API étant inchangée :
- `app/admin/users/page.tsx` ;
- `app/admin/events/[id]/page.tsx` ;
- `components/partner/pilotage/CashTab.tsx` ;
- `components/partner/pilotage/CashRefundsList.tsx`.

Pas de « Réessayer » ajouté : ce sont des envois de SMS, une anonymisation, des écarts et des remboursements de caisse, qui suivent les règles plus haut. Les messages bruts d'une coupure réseau passent par le garde-fou.

**Fusion de `main`.** 17 fichiers venus de la 3d et de cvf2b employaient d'anciens noms de couleur. Ils sont passés aux noms de la charte par le renommeur, rendu identique.

## Poids JavaScript (gzip, budgets non relevés)

Mesure locale (`npm run build`, puis `scripts/js-budget.mjs`) le 18/11, sur deux bases :
- **avant** : `main` à `197480d71` (3d et cvf2b compris) ;
- **après** : la branche, `main` fusionnée.

La mesure en CI du run complet de `main` après fusion est donnée dans « Runs ».

| Route | Avant | Après, 1er build | Après allègement | Budget |
|---|---|---|---|---|
| `/` | 225 121 | 227 167 (dépasse) | **226 041** | 226 342 |
| `/events/[id]` | 231 777 | 233 430 (dépasse) | **231 194** | 233 316 |
| `/tickets` | 249 450 | 251 225 (dépasse) | **248 491** | 250 417 |
| `/controller/scanner` | 231 519 | 233 214 | **231 323** | 234 911 |
| `/billet/hors-ligne` | 221 064 | 222 143 | **221 017** | 224 268 |

**Ce que pesait le design 1a** dans le gabarit commun à toutes les pages : +1 142 octets (barre de progression 812, toasts +437, thème +238). Sur l'accueil s'y ajoutaient +915 octets : webpack coupe en deux le morceau commun à l'accueil et à Explorer, parce que la vitrine en partage une partie.

**Allègements** (budgets non relevés) :
- l'affichage des toasts est chargé à la demande (environ −1 500 octets sur chaque route) ;
- la barre de progression est chargée quand le navigateur est libre (−800).

**Essayé sans gain** : charger la vitrine en différé, pour supprimer le découpage. Le découpage restait et chaque route prenait 95 octets ; le changement est abandonné.

## Runs

| Run | Commit | Mode | Résultat |
|---|---|---|---|
| 339 | `cebf1dd1f` | rapide, 34 suites | **vert** : 34/34 (design, jetons, anciens noms, 31 suites d'audit) |
| 340 | `d6835e4ed` | rapide, 8 suites | 6/8. Le service worker était cassé par mon changement de version (remise) ; l'icône maskable avait une couche alpha. |
| 341 | `cd4b834e5` | rapide, 2 suites | 1/2. Fond de l'icône maskable en dégradé (règle du fond uni) ; icône régénérée. |
| 342 | `4551926b8` | **complet** | **Rouge**. Corrigé dans `5fd9cc6ec`. Les rouges : |
| | | | • JS : `/` +475, `/tickets` +211 au-dessus du budget ; |
| | | | • `app/loading.tsx` faisait répondre 200 aux pages introuvables : retiré ; |
| | | | • repères en 13 px au lieu de 14 ; |
| | | | • `aria-controls` sans cible : panneau d'onglet ajouté ; |
| | | | • feuille glissante sous la barre du bas : aperçu dans le flux ; |
| | | | • double « Annuler » : « Retour » ; |
| | | | • capture de la page introuvable sur une adresse publique ; |
| | | | • `client-interface`, `notif-interface`, `design-files` : voir « Tests existants modifiés ». |
| — | `a2194e2c0` | fusion de `main` | Conflits `verify.yml` (les deux motifs gardés) et `globals.css` (bloc de la charte gardé, jetons OR de la cvf2b reportés) ; 17 fichiers renommés. |
| 365 | `65e56e655` | rapide, 71 suites : suites du design, `cvf2b-*`, `cvf3d-*`, `tests/audit/`, `tests/audit-auth/`, `f3d-*`, suites qui lisent les fichiers renommés | 70/71. Seule rouge : `client-interface` 7.3. Le test cherchait « Réessayer » dans `app/error.tsx`, alors que le bouton vient maintenant du gabarit commun. Test adapté (`fcc7bed35`), voir « Tests existants modifiés ». Typecheck et lint OK. |
| 366 | `fcc7bed35` | rapide, `client-interface` | **vert** |

Le run complet de fin est celui de `main` après la fusion de cette branche : son résultat, ses poids JS et ses captures figurent dans l'addendum de la branche `design-1b/public`, et dans la réponse à l'utilisateur.

## Captures

Vues : 390 px et 1440 px, en clair et en sombre.
- `design-composants` : en-tête et logo, boutons, grand bouton, champs, cartes, onglets, pastilles, puces, squelettes, état vide, repères, feuille glissante.
- `design-toasts`.
- `design-confirmation`.
- `design-page-introuvable`.
- `design-erreur`.
- `design-hors-ligne`.

## Décisions et écarts (à relire)

1. **`brand-vif`.** Dans l'application, `brand` désignait le bouton principal ; la charte appelle `brand` l'orange de la marque.
   - Tant que les alias vivent, `bg-brand` reste le bouton principal : sinon, chaque bouton actuel passerait en blanc sur orange vif, à 2,35:1.
   - L'orange de la marque s'écrit donc `brand-vif` en Tailwind. Les variables CSS portent exactement les noms de la charte.
   - Le jour où les alias disparaissent, `brand-vif` pourra redevenir `brand`.
2. **Emails sans image.** La règle G.51 (tests `email-regle-envoi` et `email-verification`) interdit toute image dans un email. L'en-tête des emails est donc un carré au dégradé de la marque, suivi du nom en texte gras. Pour avoir le vrai symbole, il faudrait lever G.51.
3. **Service worker.** Le contrat 5.3, testé, interdit d'intercepter d'autres navigations que `/` et `/tickets`.
   - La page hors ligne existe à `/hors-ligne`, et la page d'erreur l'affiche quand le navigateur est sans réseau.
   - Une page ouverte sans réseau en dehors de ces cas reste celle du navigateur.
   - Version du cache gardée à `lot7-1` : les icônes renouvelées sous les mêmes noms reviennent à la revalidation suivante.
4. **Manifeste.** Le contrat D24 du lot 7 fixait le fond à `#F8F9FA` et le thème à `#FF5722`. Les deux passent à `#FFFFFF`. La balise `theme-color` bascule à `#121212` en sombre.
5. **Icône maskable.** Fond uni `#EA580C` jusqu'au bord, et dégradé de la marque dans un disque de 200 px. C'est ce qu'impose la règle « fond uni autour du cercle de sécurité » du lot 7.
6. **Quatre fichiers de la finition 3d** (liste plus haut) : revus après la fusion de `main`, sans « Réessayer » ajouté.
8. **Chargement à la demande.** L'affichage des toasts et la barre de progression ne sont plus dans le JavaScript du premier affichage. Un toast qui arrive avant le préchargement apparaît après le chargement de son petit morceau, en quelques dizaines de millisecondes. La barre manque dans les toutes premières secondes après l'ouverture d'une page.
7. **Inventaire des anciens noms.** Une branche en cours qui modifie un fichier de l'inventaire devra le passer aux noms de la charte avant de fusionner, avec `scripts/design-renommer.mjs`. Rendu identique.

## Tests existants modifiés (signalés)

| Test | Modification | Pourquoi |
|---|---|---|
| `tests/parcours/design-systeme.test.ts` | Règles des jetons réécrites sur la charte. | La direction le prévoyait (section 2). Aucune règle affaiblie : jetons présents, sombre qui bascule, contrastes A/B, grand bouton. |
| `tests/parcours/pwa-manifest.test.ts` | Couleurs D24 : `#FFFFFF`. | Charte. |
| `tests/parcours/hors-ligne-service-worker.test.ts`, `e2e/terrain.spec.ts` | Symbole du logo ajouté à la liste des fichiers publics. | Logo affiché hors ligne. |
| `tests/helpers/design-files.ts` | Nouveaux fichiers d'écran déclarés. | Garde-fou du système de design. |
| `e2e/support/screens.ts` | 6 écrans ajoutés. | Captures du lot. |
| `tests/parcours/client-interface.test.ts` | Texte des boutons d'opérateur en valeurs littérales, dans les deux thèmes (run 342). « Réessayer » de la page d'erreur lu dans `SpecialPage.tsx` quand `app/error.tsx` rend `ErrorContent` branché sur `reset()` (run 365). | Jetons `on-op-*` passés en alias ; libellé écrit dans le gabarit commun des pages spéciales. Même exigence. |
| `tests/parcours/notif-interface.test.ts` | Règle du squelette sur les noms de la charte. | Run 342. |
| `tests/schema/design-toasts.test.ts` | Lit `Toast.tsx` et `ToastCard.tsx` ; cas de la coupure réseau ajouté. | Affichage chargé à la demande ; fusion de la 3d. |

**Tests nouveaux** :
- `tests/schema/design-jetons` ;
- `tests/schema/design-anciens-noms` ;
- `tests/schema/design-toasts`.

## Essais pour un non-développeur

1. **Thème.**
   - Sur un téléphone en mode sombre, ouvrez le site : il s'affiche en sombre dès la première image, sans éclair blanc.
   - Dans le profil, choisissez « Clair », puis rechargez : le choix reste.
2. **Logo.** En haut de chaque page, le symbole aux bras levés et « Event Village ». L'onglet du navigateur montre le même symbole. Partagez un lien sur WhatsApp : l'image de partage apparaît.
3. **Toasts.**
   - Coupez le réseau, puis marquez une notification comme lue : un message d'erreur reste à l'écran, avec « Réessayer ».
   - Rétablissez le réseau et appuyez sur « Réessayer » : c'est fait.
   - Changez une préférence de notification : « Annuler » est proposé pendant 6 secondes.
4. **Erreur sous le champ.** Réservez une salle à une date déjà prise : le message apparaît sous la date, pas dans un toast.
5. **Pages spéciales.**
   - Tapez une adresse qui n'existe pas : « Page introuvable », avec deux boutons.
   - Ouvrez `/hors-ligne` : « Vous n'avez pas de réseau. Vos billets restent disponibles. », avec « Mes billets ».
6. **Chargements.** Sur un réseau lent, passez d'une page à l'autre : une fine barre orange avance en haut, et la page apparaît d'abord en gris clair, à la forme de son contenu.
7. **Accessibilité.**
   - Activez « Réduire les animations » sur le téléphone : plus aucun mouvement.
   - Au clavier, la touche Tab montre un contour orange doublé de sombre sur chaque élément.
