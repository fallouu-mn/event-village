# Finition 5 — Mode sombre vérifié, liens précis des notifications, mesure fiable

Branche `finition-5/sombre-liens-mesure`, partie de `main` à `75e20d52f`. **Fusionnée dans `main` le 22/11 (`64089e9f1`),
run complet de `main` 621 entièrement vert** (§ 11). **Aucune migration** : les
liens des avis sont calculés côté application (catalogue `lib/notifications/catalog.ts`), aucune donnée nouvelle n'était
nécessaire. Branche de preuve jetable `finition-5/preuve-faussee` (§ 6) supprimée après lecture (distante et locale).

## À lire en premier

**Sécurité.** Aucune faille trouvée dans le code existant. Les deux routes nouvelles (lecture d'un billet, lecture d'un
retrait) exigent la session et ne lisent que les objets du compte : un billet ou un retrait d'autrui, un identifiant
deviné ou mal formé reçoivent **exactement la même réponse** 404 « Cet élément n'est plus disponible » (même statut, même
corps) ; test réel `tests/parcours/f5-pages-arrivee.test.ts`. Le garde-fou existant `statut-compte` a rattrapé un oubli
de ce lot avant toute fusion (run 598) : `GET /api/tickets/[id]` déléguait le contrôle du statut du compte à la liste au
lieu de l'appeler elle-même ; corrigé (`requireActiveSession` en tête de route), vert au run 602. Aucune suite de
`tests/audit/` ni de `tests/audit-auth/` modifiée.

**Ce qui change pour l'utilisateur.**

1. **Sombre vérifié.** Depuis le design 1a, les captures « sombre » des pages connectées sortaient en clair (cause § 1).
   Corrigé, et prouvé à chaque capture : la classe `dark` et la couleur du fond sont lues sur la page, contrôle bloquant.
   Premier état des lieux réel du sombre (run 591) : **416 captures sombres, 0 défaut** aux contrôles (axe-core WCAG 2.2 AA
   dont le contraste, cibles 44 px, textes 14 px) ; **contrôle responsive 184 résultats, 0 défaut**, preuve du thème
   comprise. La relecture humaine a trouvé des défauts de finition, corrigés (§ 2). Sombre « dernière génération » :
   fond noir profond `#0A0A0A`, cartes `#141414` et fenêtres `#1C1C1C` un cran au-dessus, séparateurs discrets `#262626`,
   orange `#F05A1A` seul accent ; contrastes : 95 couples mesurés, 0 sous le seuil.
2. **Liens précis.** Cloche, push et email ouvrent **l'objet exact** : le billet, les billets d'un événement, le retrait,
   le transfert à accepter, le dossier d'une partenaire, la réservation (salles, tables : déjà précis), la commande (déjà
   précis, pages du lot 12b). Tous les types du catalogue sont passés en revue par un test (§ 4). Objet absent : page claire
   « Cet élément n'est plus disponible » avec un lien utile, jamais une erreur. Après la connexion, l'adresse complète
   revient (`?tab=`, `?rappel=1`).
3. **Mesure fiable.** Une mesure mobile faite sur une machine trop rapide (ralentissement calculé au-delà de ×6) ou hors de
   la plage habituelle est déclarée **faussée** et refaite dans le même job, deux fois au plus ; si elle reste faussée, le
   job dit « MESURE FAUSSÉE, À RELANCER » au lieu de « HORS SEUIL ». Seuils, calibration, médiane de 5 et délai inchangés.
   Preuve dans un vrai job : § 6.

**Tests modifiés** (comportement voulu qui change, aucune assertion d'audit) : liste au § 8.

**Run complet final** : **605** (`ea324bcf8`) : 587 / 588 suites, e2e vert (787 captures clair et sombre, 0 en échec),
responsive 190 / 0 défaut, budgets JS tenus, mesure mobile OK (90 / 92 / 93, tentative 1 valide). Seule rouge : la matrice
de recette, dont des numéros de ligne cités étaient décalés par les tests modifiés ; corrigé et vérifié par un run rapide
(§ 9).

## 1. Sombre : cause et correctif de l'outillage

**Cause** (relevée au lot 11b, `docs/lot11b-rapport.md`, section Captures). `e2e/auth.setup.ts` connectait chaque compte
en thème clair ; `ThemeProvider` recopiait ce choix dans le cookie `ev-theme=light` ; `context.storageState` enregistrait
ce cookie avec la session ; ensuite, pour chaque capture « sombre », le cookie l'emportait sur `localStorage['ev-theme']`
posé par les fixtures, car le script anti-flash lit le cookie en premier (`lib/theme.ts`, `THEME_BOOT_SCRIPT`). Les
pages sans compte sortaient bien en sombre ; toutes les pages connectées, en clair. Défaut présent depuis le cookie de
thème (design 1a, 17/11).

**Correctif** (`22a96d770`) :

- `e2e/auth.setup.ts` : le cookie `ev-theme` est retiré avant l'enregistrement de l'état de connexion (le choix du thème
  n'est pas une donnée de session) ;
- `e2e/support/fixtures.ts`, `prepareContext` : le cookie du thème demandé est posé dans chaque contexte (en plus de
  `localStorage`), sur l'hôte de l'application ;
- **preuve sur la page**, bloquante : `e2e/support/theme-check.ts` lit la classe `dark` de `<html>` et la couleur de fond
  calculée de `<body>` (luminance ≤ 0,05 en sombre, ≥ 0,8 en clair) ; branchée dans `e2e/captures.spec.ts` (la lecture est
  gardée dans l'index de chaque capture, champ `themeLu`) et dans `e2e/responsive.spec.ts` (à chaque largeur) ;
- ligne de commit **`ci-captures: oui`** (avec `ci-responsive: oui`) : captures en thème sombre seulement
  (`EV_CAPTURES_THEMES=sombre`) dans le job responsive du mode rapide, publiées sur `ci-results` ; sans elle, il fallait
  un run complet pour voir une capture. Job responsive porté à 90 minutes.

Tests : `tests/schema/f5-sombre-outillage.test.ts` (ordre de lecture du script anti-flash, cookie retiré et posé, preuve
bloquante dans les deux specs, luminances de la charte reconnues, page claire capturée sous « sombre » refusée, ligne
`ci-captures` ; `verify.yml` lu en YAML, après le run 590 refusé par GitHub pour un `\n` devenu retour à la ligne).

Preuve : run **591** (avant les couleurs) : contrôle responsive 184 résultats (page × thème), **0 défaut bloquant**, la
preuve du thème comprise, pages connectées en sombre comprises ; captures sombres **416 / 416**, 0 en échec, axe
« aucune » règle relevée sur les 210 écrans. Run **598** (après les couleurs et les pages d'arrivée) : contrôle responsive
**190 résultats, 0 défaut** (les trois pages d'arrivée comprises) ; captures sombres **416 / 416, 0 en échec**.

## 2. Défauts du sombre trouvés et corrigés

Les contrôles automatiques (contraste axe, 44 px, 14 px, défilement, chevauchements) n'ont relevé **aucun** défaut en
sombre au run 591. La relecture humaine des captures (échantillon de 19 écrans : portefeuille, cloche, pilotage, finances,
administration, scanner, plans de salle, paiement, profil ; téléphone et ordinateur) a relevé ceci :

| # | Défaut vu | Correctif | Commit |
|---|---|---|---|
| S1 | Fond `#121212` gris foncé, cartes `#1A1A1A` presque confondues, séparateurs `#333333` trop marqués : rendu « gris » plutôt que noir profond. | Jetons sombres : fond `#0A0A0A`, cartes `#141414`, fenêtres `#1C1C1C`, puits `#1F1F1F`, séparateurs `#262626`, liseré du focus `#0A0A0A` (charte `docs/design/jetons.css` et `direction.md`, `app/globals.css`, `theme-color`, page d'erreur racine). Contrastes : 95 couples, 0 sous le seuil. | `25fd3786b` |
| S2 | Survol des avis et des filtres de la cloche en `bg-background` : plus sombre que le panneau en sombre (effet « trou »), invisible en clair (blanc sur blanc). | `bg-muted` : un cran plus clair en sombre, visible en clair. | `67996efe0` |
| S3 | Même survol sur le bouton icône « fantôme » (partagé), l'en-tête du contrôleur, l'envoi d'image et les ancres des réglages. | `bg-muted`. | `ce578ff32` |
| S4 | Icône soleil du choix du thème en jaune « attention » : accent décoratif autre que l'orange. | Orange de la marque (`text-primary-text`). | `3f4099a92` |

Gardé volontairement :

- **couleurs des affiches** et **couleurs de catégorie des billets** (bande du billet noire, blanche, or… choisie par
  l'organisatrice, la même qu'au scanner) : ce sont des données, pas des accents ;
- **scanner** : plein écran et catégories sur leurs jetons `--scan-*`, identiques en clair et en sombre (contraste ≥ 7:1,
  inchangé) ; **QR** toujours noir sur blanc ;
- **couleurs d'état** (succès, attention, erreur, information) des badges, bandeaux et pastilles des chiffres clés : couleurs
  fonctionnelles, les mêmes en clair ; l'orange reste le seul accent décoratif.

Captures avant et après (téléphone et ordinateur), branche `ci-results` : **avant** `runs/591-44981196820/captures/`,
**après** `runs/598-44986040920/captures/`, fichiers `<écran>__mobile__sombre.png` et `<écran>__ordinateur__sombre.png` ;
contrôle responsive : `captures-responsive/<page>__<largeur>__sombre.jpg` des mêmes runs. Écrans relus, avant et après :
`mes-billets`, `cloche-ouverte`, `org-tables-plan`, `paiement-modale`, `admin-accueil-a-faire`, `scanner-accueil` (téléphone),
`pilotage-ventes`, `partenaire-tableau-de-bord` (ordinateur). Couleurs lues sur les captures (pixels, avant → après) :

| Écran | Zone | Avant (591) | Après (598) |
|---|---|---|---|
| `pilotage-ventes__ordinateur__sombre` | fond de page | `#121212` | `#0A0A0A` |
| `pilotage-ventes__ordinateur__sombre` | barre latérale (carte) | `#1A1A1A` | `#141414` |
| `pilotage-ventes__ordinateur__sombre` | tableau des ventes (carte) | `#1A1A1A` | `#141414` |
| `cloche-ouverte__mobile__sombre` | panneau de la cloche (fenêtre) | `#222222` | `#1C1C1C` |

Hors périmètre (couleurs en dur dans du code **non affiché** : `EventCancellationBanner`, variante « verre » de
`components/ui/Input.tsx`) et écrans des commandes (12b : `app/restaurants/[id]/menu`, `app/partner/products`,
`app/partner/orders`, palettes brutes, service fermé) : `docs/apres-lancement.md`.

## 3. Pages d'arrivée des avis

| Page | Objet | Lecture | Absent, d'autrui, deviné |
|---|---|---|---|
| `/tickets/<id>` | le billet du compte qui porte cet identifiant (transfert reçu ou rendu, billet contrôlé, annulé, remboursé) ; sinon les billets du compte pour l'événement qui le porte (achat, invitation, rappel, annulation, remboursement : plusieurs billets possibles). Mêmes cartes que « Mes billets » (QR, transfert, remboursement, hors ligne). | `GET /api/tickets` appelée par le serveur avec la session de la requête, puis recherche dans les billets du compte (`app/tickets/focus-read.ts`) ; route `GET /api/tickets/[id]` pour un billet | page « Cet élément n'est plus disponible », lien « Voir mes billets » |
| `/partner/finance/retraits/<envoi>` | un retrait de l'organisatrice, par l'envoi (`cashout_id`) que portent les avis | `GET /api/finance/withdrawals/[id]` (filtre `user_id` = compte de la session) ; statut, montants, opérateur, **ce qu'il reste à faire** | même page, lien « Voir mes finances » ; un retrait du portefeuille ouvert ici : même page |
| `/wallet/retraits/<envoi>` | un retrait du parrainage | même route | même page, lien « Voir mon portefeuille » |

Sans session : connexion, puis retour à la page (et désormais avec les paramètres : `middleware.ts`, adresse relue par
`safeInternalPath`). « Mes billets » (page mesurée) n'est pas modifiée : les pages d'arrivée ont leur propre vue
(`components/tickets/TicketsFocusView.tsx`). Page commune `components/ui/UnavailableItem.tsx` : même texte et même réponse
pour tous les cas, aucun indice sur l'existence de l'objet ; les routes qu'elles lisent répondent un vrai 404 au corps
unique.

**Poids JavaScript** (budgets non relevés). Au run 596, toutes les routes avaient pris environ 50 octets (82 octets
bruts) et la fiche événement dépassait son budget de 13 octets (233 329 pour 233 316). Première hypothèse, fausse : le
nombre de pages nouvelles (une seule route `/tickets/<id>` et aucune page `not-found` séparée, `1412664f5`, n'ont rien changé :
233 328 au run 598). Cause réelle : les deux modales de transfert importées par `next/dynamic` dans la vue des pages
d'arrivée ajoutaient deux entrées au moteur de chargement commun à toutes les routes ; importées directement
(`TicketsFocusView`, page non budgétée), le poids revient sous le budget : run **602**, fiche événement 233 282 octets
(budget 233 316), toutes les routes dans leur budget (§ 9). La route unique et la page
« plus disponible » rendue par la page sont gardées : plus simples, même réponse dans tous les cas ; conséquence, ces pages
répondent 200 avec la page « plus disponible » (`docs/apres-lancement.md`).

Liens tolérants : un avis déjà en file sans l'identifiant attendu (données d'avant ce lot) se replie sur la page la plus
précise disponible (billets de l'événement, historique, finances) ; un lien ne fait jamais échouer un envoi.

Contrôle responsive : les trois pages y sont ajoutées (billet réel du compte de démonstration ; page « plus disponible »
au portefeuille et aux finances), comme l'exige `design1c-responsive` pour toute route.

## 4. Tous les types d'avis et leur lien

Revue de **tout** le catalogue par `tests/schema/f5-liens-avis.test.ts` : pour chaque type à lien, le lien de l'exemple
contient l'identifiant de l'objet dès que l'avis en porte un ; sinon le type figure dans la liste des exceptions avec sa
raison (et une exception qui deviendrait inutile fait échouer le test). Sortie : 159 types à lien passés en revue, 31 sans
objet propre.

**SMS.** Le contrat des SMS (G3) tient un segment GSM-7 avec une URL de 27 caractères. Un lien d'objet ajoute 40 à 50
caractères : mesuré au pire cas pour chaque SMS (script de la session, valeurs maximales de G3), **tous** les SMS de billets,
transferts, rappels, annulations et du pilotage dépasseraient un segment (de 163 à 204 caractères). Les SMS gardent donc leur
lien vers la liste ; ceux des **tables** gardent leur lien court vers la réservation (`/t/<code>`, lot 11b). Codes courts
pour les autres objets : `docs/apres-lancement.md`.

(Tableau complet ci-dessous, généré depuis le catalogue ; `<billet>`, `<événement>`… = identifiant pris dans les données de
l'avis.)

| Type | Canaux | Lien (cloche, push, email) | Objet |
|---|---|---|---|
| `PURCHASE_CONFIRMED` | cloche, SMS, email, push | `/tickets/<événement>` | objet exact |
| `FREE_TICKETS_CONFIRMED` | cloche, SMS, email, push | `/tickets/<événement>` | objet exact |
| `COUNTER_RECEIPT` | SMS | — | SMS seul, sans lien |
| `INVITATION_RECEIVED` | SMS, cloche, push, email | `/tickets/<événement>` | objet exact |
| `TRANSFER_OFFERED` | SMS, cloche, push, email | `/tickets?tab=recus#recu-<transfert>` | objet exact |
| `TRANSFER_CANCELLED` | SMS, cloche, push, email | `/tickets?tab=recus` | sans objet propre : transfert retiré par l’expéditeur : plus rien à ouvrir, onglet « Reçus » |
| `TRANSFER_EXPIRED` | cloche, push, email, SMS | `/tickets/<billet>` | objet exact |
| `TRANSFER_CLAIMED_SENDER` | cloche, push, email, SMS | `/tickets?tab=a-venir` | sans objet propre : le billet a quitté le compte de l’expéditeur : billets restants |
| `TRANSFER_RECEIVED` | cloche, push, email | `/tickets/<billet>` | objet exact |
| `TICKET_SCANNED` | cloche, push, email | `/tickets/<billet>` | objet exact |
| `EVENT_CANCELLED` | cloche, SMS, email, push | `/tickets/<événement>` | objet exact |
| `EVENT_SUSPENDED_HOLDER` | cloche, push, email, SMS | `/events/<événement>` | objet exact |
| `EVENT_REACTIVATED_HOLDER` | cloche, push, email, SMS | `/events/<événement>` | objet exact |
| `EVENT_CHANGED` | cloche, push, SMS, email | `/events/<événement>` | objet exact |
| `REMINDER_J1` | cloche, push, SMS, email | `/tickets/<événement>` | objet exact |
| `REMINDER_H3` | cloche, push, SMS, email | `/tickets/<événement>` | objet exact |
| `REFUND_REQUESTED` | cloche, SMS, email, push | `/tickets/<événement>` | objet exact |
| `REFUND_PAID` | cloche, SMS, email, push | `/tickets/<événement>` | objet exact |
| `PASSWORD_CHANGED` | cloche, SMS, email, push | `/profile` | l’objet est la page elle-même (compte, profil, aide, supervision) |
| `PHONE_CHANGED` | SMS, email | `/profile` | l’objet est la page elle-même (compte, profil, aide, supervision) |
| `EMAIL_CLAIMED_ELSEWHERE` | cloche, SMS, email, push | `/profile` | l’objet est la page elle-même (compte, profil, aide, supervision) |
| `PUSH_TEST` | push | `/profile/notifications` | l’objet est la page elle-même (compte, profil, aide, supervision) |
| `EVENT_VALIDATED` | cloche, SMS, email, push | `/partner/events/<événement>` | objet exact |
| `EVENT_REJECTED` | cloche, SMS, email, push | `/partner/events/<événement>` | objet exact |
| `EVENT_SUSPENDED` | cloche, SMS, email, push | `/partner/events/<événement>` | objet exact |
| `EVENT_REACTIVATED` | cloche, SMS, email, push | `/partner/events/<événement>` | objet exact |
| `EVENT_PUBLISHED_BY_ADMIN` | cloche, push, email, SMS | `/partner/events/<événement>` | objet exact |
| `FIRST_TICKET_SOLD` | cloche, push, SMS, email | `/partner/events/<événement>?tab=ventes` | objet exact |
| `NEW_ORDER` | cloche | `/partner/events/<événement>?tab=ventes` | objet exact |
| `CATEGORY_SOLD_OUT` | cloche, push, SMS, email | `/partner/events/<événement>?tab=ventes` | objet exact |
| `EVENT_SOLD_OUT` | cloche, push, SMS, email | `/partner/events/<événement>?tab=ventes` | objet exact |
| `SHIFT_DISCREPANCY` | cloche, SMS, push, email | `/partner/events/<événement>?tab=caisse` | objet exact |
| `WITHDRAWAL_PAID` | cloche, SMS, email, push | `/partner/finance/retraits/<envoi>` | objet exact |
| `WITHDRAWAL_REJECTED` | cloche, SMS, email, push | `/partner/finance/retraits/<envoi>` | objet exact |
| `WITHDRAWAL_UNCERTAIN` | cloche, SMS, push, email | `/partner/finance/retraits/<envoi>` | objet exact |
| `CANCEL_REFUNDS_DONE` | cloche, email, push, SMS | `/partner/events/<événement>?tab=cloture` | objet exact |
| `CANCEL_REFUNDS_BLOCKED` | cloche, email, push, SMS | `/partner/events/<événement>?tab=cloture` | objet exact |
| `PARTNER_REGISTERED_ACK` | cloche, SMS, email, push | `/partner/dashboard` | sans objet propre : l’objet est le compte partenaire lui-même : son tableau de bord |
| `PARTNER_VALIDATED` | cloche, SMS, email, push | `/partner/dashboard` | sans objet propre : l’objet est le compte partenaire lui-même : son tableau de bord |
| `PARTNER_REJECTED` | cloche, SMS, email, push | `/partner/dashboard` | sans objet propre : l’objet est le compte partenaire lui-même : son tableau de bord (dossier à compléter) |
| `PARTNER_SUSPENDED` | cloche, SMS, email, push | `/partner/dashboard` | sans objet propre : l’objet est le compte partenaire lui-même : son tableau de bord |
| `PARTNER_REACTIVATED` | cloche, SMS, email, push | `/partner/dashboard` | sans objet propre : l’objet est le compte partenaire lui-même : son tableau de bord |
| `TRIAL_STARTED` | cloche, email, push | `/partner/dashboard` | sans objet propre : l’objet est le compte partenaire lui-même : son tableau de bord |
| `SUBSCRIPTION_ACTIVATED` | cloche, email, push | `/partner/subscription` | sans objet propre : l’objet est l’abonnement du compte : sa page |
| `PAYMENT_SUCCESS` | cloche, email, push | `/orders` | sans objet propre : paiement d’une commande : pages de commande du lot 12b (service fermé), liste des commandes |
| `HALL_RESERVATION_PENDING` | cloche, push, email, SMS | `/halls/reservations/<réservation>` | objet exact |
| `HALL_RESERVATION_REQUESTED` | cloche, push, email, SMS | `/partner/halls/reservations/<réservation>` | objet exact |
| `HALL_RESERVATION_CONFIRMED` | cloche, push, email, SMS | `/halls/reservations/<réservation>` | objet exact |
| `HALL_BALANCE_PAID` | cloche, push, email, SMS | `/halls/reservations/<réservation>` | objet exact |
| `HALL_BALANCE_REMINDER` | cloche, push, email, SMS | `/halls/reservations/<réservation>` | objet exact |
| `HALL_PAYMENT_DEADLINE_PASSED` | cloche, push, email, SMS | `/halls/reservations/<réservation>` | objet exact |
| `HALL_RESERVATION_CANCELLED` | cloche, push, email, SMS | `/halls/reservations/<réservation>` | objet exact |
| `HALL_RESERVATION_CANCELLED_PRO` | cloche, push, email, SMS | `/partner/halls/reservations/<réservation>` | objet exact |
| `HALL_PAYMENT_REFUNDED` | cloche, push, email, SMS | `/halls/reservations/<réservation>` | objet exact |
| `HALL_REFUND_PAID` | cloche, push, email, SMS | `/halls/reservations/<réservation>` | objet exact |
| `HALL_EVE_REMINDER` | cloche, push, email, SMS | `/halls/reservations/<réservation>` | objet exact |
| `HALL_EARNINGS_AVAILABLE` | cloche, push, email, SMS | `/partner/halls/reservations/<réservation>` | objet exact |
| `HALL_VALIDATION_DECIDED` | cloche, push, email, SMS | `/partner/halls/<salle>` | objet exact |
| `TABLE_RESERVATION_CONFIRMED` | cloche, push, email, SMS | `/tables/reservations/<réservation>` | objet exact |
| `TABLE_REQUEST_SENT` | cloche, push, email, SMS | `/tables/reservations/<réservation>` | objet exact |
| `TABLE_REQUEST_TO_ANSWER` | cloche, push, email, SMS | `/partner/tables/reservations/<réservation>` | objet exact |
| `TABLE_NEW_RESERVATION` | cloche, push, email, SMS | `/partner/tables/reservations/<réservation>` | objet exact |
| `TABLE_REQUEST_REFUSED` | cloche, push, email, SMS | `/tables/reservations/<réservation>` | objet exact |
| `TABLE_REQUEST_EXPIRED` | cloche, push, email, SMS | `/tables/reservations/<réservation>` | objet exact |
| `TABLE_HOLD_EXPIRED` | cloche, push, email, SMS | `/tables/reservations/<réservation>` | objet exact |
| `TABLE_RESERVATION_CANCELLED` | cloche, push, email, SMS | `/tables/reservations/<réservation>` | objet exact |
| `TABLE_RESERVATION_CANCELLED_PRO` | cloche, push, email, SMS | `/partner/tables/reservations/<réservation>` | objet exact |
| `TABLE_NO_SHOW` | cloche, push, email, SMS | `/tables/reservations/<réservation>` | objet exact |
| `TABLE_PAYMENT_REFUNDED` | cloche, push, email, SMS | `/tables/reservations/<réservation>` | objet exact |
| `TABLE_REMINDER` | cloche, push, email, SMS | `/tables/reservations/<réservation>?rappel=1` | objet exact |
| `TABLE_CLIENT_COMING` | cloche, push, email, SMS | `/partner/tables/reservations/<réservation>` | objet exact |
| `TABLE_REFUND_PAID` | cloche, push, email, SMS | `/tables/reservations/<réservation>` | objet exact |
| `VENUE_VALIDATION_DECIDED` | cloche, push, email, SMS | `/partner/tables/<établissement>` | objet exact |
| `PROMOTION_DECIDED` | cloche, email, push, SMS | `/partner/events/<événement>` | objet exact |
| `CONTROLLER_ASSIGNED` | cloche, push, SMS, email | `/controller/scanner` | sans objet propre : le scanner ouvre lui-même l’événement du poste affecté |
| `CONTROLLER_UNASSIGNED` | cloche, push, SMS, email | `/controller/scanner` | sans objet propre : affectation retirée : le scanner montre les postes restants |
| `CONTROLLER_REMINDER` | cloche, push, SMS, email | `/controller/scanner` | sans objet propre : le scanner ouvre lui-même l’événement du poste affecté |
| `SHIFT_CLOSED_BY_OTHER` | cloche, push, email, SMS | `/controller/scanner` | sans objet propre : caisse fermée : le scanner montre l’état du poste |
| `CONTROLLER_ACTIVATED` | cloche, SMS, email, push | `/controller/scanner` | l’objet est la page elle-même (compte, profil, aide, supervision) |
| `ADMIN_EVENT_SUBMITTED` | cloche, push, email | `/admin/events/<événement>` | objet exact |
| `ORDER_RECEIVED` | cloche, push, email, SMS | `/orders/<commande>` | objet exact |
| `ORDER_ACCEPTED` | cloche, push, email, SMS | `/orders/<commande>` | objet exact |
| `ORDER_PREPARING` | cloche, push, email, SMS | `/orders/<commande>` | objet exact |
| `ORDER_READY` | cloche, push, email, SMS | `/orders/<commande>` | objet exact |
| `ORDER_ON_THE_WAY` | cloche, push, email | `/orders/<commande>` | objet exact |
| `ORDER_HANDED_OVER` | cloche, push, email, SMS | `/orders/<commande>` | objet exact |
| `ORDER_CANCELLED` | cloche, push, email, SMS | `/orders/<commande>` | objet exact |
| `ORDER_PAYMENT_REFUNDED` | cloche, push, email, SMS | `/orders/<commande>` | objet exact |
| `ORDER_REFUND_PAID` | cloche, push, email, SMS | `/orders/<commande>` | objet exact |
| `ORDER_PICKUP_REMINDER` | cloche, push, email, SMS | `/orders/<commande>` | objet exact |
| `ORDER_NOT_COLLECTED` | cloche, push, email, SMS | `/orders/<commande>` | objet exact |
| `ORDER_NEW` | cloche, push, email, SMS | `/partner/orders/<commande>` | objet exact |
| `ORDER_CANCELLED_PRO` | cloche, push, email, SMS | `/partner/orders/<commande>` | objet exact |
| `ORDER_HANDED_OVER_PRO` | cloche, push, email, SMS | `/partner/orders/<commande>` | objet exact |
| `ORDER_COURIER_ASSIGNED` | cloche, push, email, SMS | `/courier/orders/<commande>` | objet exact |
| `ORDER_COURIER_CANCELLED` | cloche, push, email, SMS | `/courier/orders` | sans objet propre : course retirée au livreur : plus rien à ouvrir (pages du lot 12b) |
| `ORDER_COURIER_INVITED` | cloche, push, email | `/courier/invitations/<invitation>` | objet exact |
| `ADMIN_VENUE_SUBMITTED` | cloche, push, email | `/admin/venues/<établissement>` | objet exact |
| `ADMIN_HALL_SUBMITTED` | cloche, push, email | `/admin/halls/<salle>` | objet exact |
| `ADMIN_HALL_CHANGED` | cloche, push, email | `/admin/halls/<salle>` | objet exact |
| `ADMIN_PERMISSIONS_CHANGED` | cloche, push, email, SMS | `/admin/mes-droits` | sans objet propre : l’objet est la page « Mes droits » de l’administrateur |
| `ADMIN_PERMISSIONS_ALERT` | cloche, push, email, SMS | `/admin/users` | sans objet propre : liste des administrateurs (aucune fiche par compte ; après-lancement) |
| `ADMIN_PARTNER_REGISTERED` | cloche, push, email | `/admin/dashboard?partenaires=ALL&dossier=<partenaire>` | objet exact |
| `ADMIN_REFUND_TO_RETRY` | cloche, push, email | `/admin/finance#versements-a-reprendre` | sans objet propre : file « Versements à reprendre » des finances (aucune fiche par versement ; après-lancement) |
| `ADMIN_DUPLICATE_PAYMENT` | cloche, push, email | `/admin/finance#remboursements-a-verser` | sans objet propre : file « Remboursements à verser » (aucune fiche par paiement ; après-lancement) |
| `ADMIN_CASHOUT_UNCERTAIN` | cloche, push, email | `/admin/finance#versements-a-reprendre` | sans objet propre : file « Versements à reprendre » (aucune fiche par versement ; après-lancement) |
| `ADMIN_WITHDRAWAL_REJECTED` | cloche, email | `/admin/finance#du-aux-partenaires` | sans objet propre : file « Dû aux partenaires » (aucune fiche par retrait ; après-lancement) |
| `ADMIN_FINANCE_DEBT` | cloche, email | `/admin/finance#creances` | sans objet propre : file « Créances » (aucune fiche par créance ; après-lancement) |
| `ADMIN_NOTIFICATION_FAILED` | cloche, email | `/admin/notifications/<envoi d’avis>` | objet exact |
| `ADMIN_SMS_DAILY_THRESHOLD` | cloche, email | `/admin/notifications` | l’objet est la page elle-même (compte, profil, aide, supervision) |
| `ADMIN_SMS_CAP_GLOBAL` | cloche, email | `/admin/notifications` | l’objet est la page elle-même (compte, profil, aide, supervision) |
| `ADMIN_SMS_CAP_NON_OTP` | cloche, email | `/admin/notifications` | l’objet est la page elle-même (compte, profil, aide, supervision) |
| `ADMIN_SMS_CAP_NEW_NUMBERS` | cloche, email | `/admin/notifications` | l’objet est la page elle-même (compte, profil, aide, supervision) |
| `ADMIN_SMS_OPTIONAL_80` | cloche, email | `/admin/notifications` | l’objet est la page elle-même (compte, profil, aide, supervision) |
| `ADMIN_SMS_FORECAST` | cloche, email | `/admin/notifications` | l’objet est la page elle-même (compte, profil, aide, supervision) |
| `REFUND_DELAYED` | cloche, SMS, email, push | `/tickets/<événement>` | objet exact |
| `WITHDRAWAL_DELAYED` | cloche, SMS, email, push | `/partner/finance/retraits/<envoi>` | objet exact |
| `ADMIN_CASHOUT_TO_RESUME` | cloche, push, email | `/admin/finance#versements-a-reprendre` | sans objet propre : file « Versements à reprendre » (aucune fiche par versement ; après-lancement) |
| `PAYMENT_REFUND_STARTED` | cloche, SMS, email, push | `/tickets/<événement>` | objet exact |
| `ADMIN_PARTNER_RESUBMITTED` | cloche, push, email | `/admin/dashboard?partenaires=ALL&dossier=<partenaire>` | objet exact |
| `EVENT_CLOSED_HOLDER` | cloche, SMS, email, push | `/tickets/<événement>` | objet exact |
| `EVENT_CLOSED_BY_ADMIN` | cloche, SMS, email, push | `/partner/events/<événement>` | objet exact |
| `SHIFT_OPEN_AT_END` | cloche, push, SMS, email | `/partner/events/<événement>?tab=caisse` | objet exact |
| `TRANSFER_REVOKED` | SMS, cloche, push, email | `/tickets?tab=recus` | sans objet propre : transfert retiré : plus rien à ouvrir, onglet « Reçus » |
| `TRANSFER_DECLINED_SENDER` | cloche, push, email, SMS | `/tickets/<billet>` | objet exact |
| `TRANSFER_RECIPIENT_CHANGED` | cloche, push, email, SMS | `/tickets/<billet>` | objet exact |
| `CONTROLLER_INVITATION` | SMS, cloche, push, email | `/invitations#invitation-<invitation>` | objet exact |
| `CONTROLLER_INVITATION_ACCEPTED` | cloche, push, email, SMS | `/partner/team` | sans objet propre : équipe de la partenaire (aucune ancre par invitation ; après-lancement) |
| `CONTROLLER_INVITATION_DECLINED` | cloche, push, email, SMS | `/partner/team` | sans objet propre : équipe de la partenaire (aucune ancre par invitation ; après-lancement) |
| `CONTROLLER_INVITATION_EXPIRED` | cloche, push, email, SMS | `/partner/team` | sans objet propre : équipe de la partenaire (aucune ancre par invitation ; après-lancement) |
| `CONTROLLER_BECAME_ADMIN` | cloche, push, email, SMS | `/partner/team` | l’objet est la page elle-même (compte, profil, aide, supervision) |
| `EVENT_CANCELLED_BY_ADMIN` | cloche, SMS, email, push | `/partner/events/<événement>?tab=cloture` | objet exact |
| `ADMIN_EVENT_CANCELLED` | cloche, email | `/admin/events/<événement>` | objet exact |
| `CONTROLLER_EVENT_CANCELLED` | cloche, SMS, email, push | `/controller/scanner` | sans objet propre : événement annulé : le scanner montre les postes restants |
| `CONTROLLER_EVENT_CHANGED` | cloche, SMS, email, push | `/controller/scanner` | sans objet propre : le scanner ouvre lui-même l’événement du poste affecté |
| `CONTROLLER_EVENT_STATUS` | cloche, email, SMS, push | `/controller/scanner` | sans objet propre : le scanner ouvre lui-même l’événement du poste affecté |
| `TICKET_CANCELLED` | cloche, SMS, email, push | `/tickets/<billet>` | objet exact |
| `ACCOUNT_SUSPENDED` | cloche, SMS, email, push | `/aide` | l’objet est la page elle-même (compte, profil, aide, supervision) |
| `ACCOUNT_REACTIVATED` | cloche, SMS, email, push | `/login` | l’objet est la page elle-même (compte, profil, aide, supervision) |
| `ADMIN_EVENT_CHANGED` | cloche, email | `/admin/events/<événement>` | objet exact |
| `EVENT_SUBMITTED_ACK` | cloche, email, push | `/partner/events/<événement>` | objet exact |
| `EVENT_FINISHED` | cloche, email, push | `/partner/events/<événement>?tab=cloture` | objet exact |
| `CLOSING_REPORT_READY` | cloche, email, push | `/partner/events/<événement>?tab=cloture` | objet exact |
| `FUNDS_AVAILABLE` | cloche, email, push, SMS | `/partner/finance` | sans objet propre : l’objet est le solde du compte : les finances |
| `TICKET_REFUNDED_HOLDER` | SMS, cloche, push, email | `/tickets/<billet>` | objet exact |
| `ADMIN_EVENT_PUBLISHED` | cloche, email | `/admin/events/<événement>` | objet exact |
| `ADMIN_EVENT_WITHDRAWN` | cloche, email | `/admin/events/<événement>` | objet exact |
| `SCAN_REFUSALS_ALERT` | cloche, push, email, SMS | `/partner/events/<événement>?tab=entrees` | objet exact |
| `ADMIN_REVIEW_SMS` | SMS | `/admin/dashboard` | l’objet est la page elle-même (compte, profil, aide, supervision) |
| `ACCOUNT_LOGIN_FAILURES` | SMS, email | `/forgot-password` | l’objet est la page elle-même (compte, profil, aide, supervision) |
| `EMAIL_ADDED` | SMS, email | `/aide` | l’objet est la page elle-même (compte, profil, aide, supervision) |
| `CASH_REFUND_MARKED_BY_ADMIN` | cloche, push, email, SMS | `/partner/events/<événement>?tab=cloture` | objet exact |
| `SUPERADMIN_PROMOTED` | cloche, SMS, email | `/admin/users` | liste des comptes (aucune fiche par compte ; après-lancement) |
| `ADMIN_BACKUP_CODE_USED` | SMS, email | `/admin/securite` | l’objet est la page elle-même (compte, profil, aide, supervision) |
| `ADMIN_PHONE_CHANGED` | SMS, email | `/profile` | l’objet est la page elle-même (compte, profil, aide, supervision) |
| `ADMIN_PHONE_CONFIRMED` | cloche, SMS, email | `/profile` | l’objet est la page elle-même (compte, profil, aide, supervision) |
| `SALES_UPDATE_SMS` | SMS | — | SMS seul, sans lien |
| `PARTNER_DAILY_SUMMARY` | cloche, SMS, email, push | `/partner/events/<événement>?tab=ventes` | objet exact |
| `ENTRY_WELCOME` | cloche, SMS, email, push | `/events/<événement>` | objet exact |
| `ENTRY_THANKS` | cloche, SMS, email, push | `/events/<événement>` | objet exact |
| `PARTNER_REFUND_REQUESTS` | cloche, SMS, email, push | `/partner/events/<événement>?tab=ventes` | objet exact |

## 5. Textes : dire quoi faire ensuite

Relecture des 157 textes de la cloche. La plupart disent déjà l'étape suivante. Complétés (`2081cf947`) : événement
suspendu par l'administration (« ouvrez la page Aide et joignez le support »), inscription partenaire reçue (« vous serez
prévenu de la décision ici et par email »), période d'essai (« créez votre premier événement depuis votre tableau de
bord »), nouvelle candidature (« examinez son dossier puis validez-le ou refusez-le »), remboursement à reprendre
(« reprenez-le depuis les finances »), envoi d'avis en échec (« ouvrez l'envoi pour en voir la cause »). Le panneau de la
cloche n'a ni flou ni animation coûteuse (transform et opacité seulement) ; en sombre, survol corrigé (S2).

## 6. Mesure fiable

Module pur `scripts/e2e/perf-mobile-seuils.mjs` (`MESURE_FIABLE`, `causesMesureFaussee`, `decisionTentative`,
`etatFinal`, `tentativesRows`), boucle dans `scripts/e2e/perf-mobile.mjs` :

- une **tentative** = les 5 tours Lighthouse (calibration à chaque tour, inchangée : ×4 pour un indice de 2 000) ;
- elle est **faussée** si un tour au moins a un ralentissement calculé au-delà de ×6, un indice de puissance hors de
  1 000 à 3 000, ou un indice illisible ;
- faussée → **refaite** dans le même job, 2 fois au plus, et seulement si le temps restant le permet (durée de la tentative
  précédente + 20 %, plus 2 minutes gardées pour les chargements réels et les touchers) ; délai de l'étape inchangé (15 min ;
  une tentative dure de 2 min 40 à 3 min 30 aux runs 585 et 602) ; une reprise non lancée faute de temps est dite telle quelle ;
- exception : faussée seulement parce que la machine est **trop rapide** (mesure plus sévère que la référence) **et** seuils
  tenus → acceptée, rien à refaire ;
- restée faussée : le rapport commence par « MESURE FAUSSÉE, À RELANCER », les mesures Lighthouse hors seuil sont écrites
  « FAUSSÉ (non concluant) », le verdict dit « MESURE FAUSSÉE, À RELANCER — aucune conclusion sur les seuils », une
  annotation d'erreur l'affiche sur la page du run, `run.txt` porte `perf_mobile_mesure=faussee-a-relancer` ; le job reste
  rouge (rien n'est prouvé). Un CLS mesuré, un toucher ou une erreur fatale hors seuil (ralentissement fixe ×4,
  indépendants de la calibration) restent de **vrais** « HORS SEUIL » ;
- **journal de chaque tentative** : `perf/tentatives.tsv` (tour, indice, ralentissement, cause, scores, décision) et
  `perf/lighthouse-tentatives.tsv` (passages bruts de toutes les tentatives) ; `lighthouse.tsv` et `calibration.tsv` gardent
  la tentative retenue ; `run.txt` porte aussi `perf_mobile_tentatives`.

Seuils, calibration, médiane de 5 : **inchangés**, vérifié par `tests/schema/f5-mesure-fiable.test.ts` (plus les tests
existants `design1b-perf-mobile` et `design1e-ci-perf`, inchangés). Le test vérifie aussi la décision (3 tentatives au plus,
exceptions), le verdict (« FAUSSÉE » au lieu de « HORS SEUIL », vrais défauts gardés), le texte du rapport et le journal.

**Preuve dans un vrai job** : branche jetable `finition-5/preuve-faussee` (la branche du lot + une seule ligne : `EV_PERF_PREUVE_FAUSSEE=1` dans
l'étape de mesure du job perf ; l'interrupteur fait lire à la **décision de la tentative 1 seulement** un indice simulé de
3 600, sans changer le ralentissement appliqué ni les scores ; un test interdit cette variable dans les workflows du dépôt).
Run **596** (`54d6d7238`, job perf, `ci-results` `runs/596-44983952289/perf/`) :

```
tentative	tour	indice_puissance	ralentissement_cpu	etat_tour	cause	scores	decision
1	1	3600	7.20	faussé	tour 1 : machine trop rapide, indice 3600 → ralentissement ×7,20 (plage habituelle : indice 1000 à 3000, ralentissement ×6 au plus)	accueil 91 ; fiche 91 ; mes-billets 88	faussée : refaite
1	2	3600	7.20	faussé	tour 2 : machine trop rapide, indice 3600 → ralentissement ×7,20 (…)	accueil 96 ; fiche 90 ; mes-billets 87	faussée : refaite
1	3	3600	7.20	faussé	tour 3 : machine trop rapide, indice 3600 → ralentissement ×7,20 (…)	accueil 92 ; fiche 92 ; mes-billets 92	faussée : refaite
1	4	3600	7.20	faussé	tour 4 : machine trop rapide, indice 3600 → ralentissement ×7,20 (…)	accueil 94 ; fiche 91 ; mes-billets 93	faussée : refaite
1	5	3600	7.20	faussé	tour 5 : machine trop rapide, indice 3600 → ralentissement ×7,20 (…)	accueil 96 ; fiche 95 ; mes-billets 93	faussée : refaite
2	1	1736	3.47	valide		accueil 94 ; fiche 94 ; mes-billets 94	valide
2	2	1781	3.56	valide		accueil 96 ; fiche 91 ; mes-billets 93	valide
2	3	1804	3.61	valide		accueil 94 ; fiche 91 ; mes-billets 90	valide
2	4	1902	3.80	valide		accueil 94 ; fiche 85 ; mes-billets 92	valide
2	5	1844	3.69	valide		accueil 94 ; fiche 95 ; mes-billets 88	valide
```

Extrait de `perf/lighthouse.txt` :

```
Tentatives de la mesure Lighthouse (finition 5 : faussée si un tour sort de la plage, refaite 2 fois au plus ; journal perf/tentatives.tsv) :
  tentative 1 : FAUSSÉE, refaite
    · tour 1 : machine trop rapide, indice 3600 → ralentissement ×7,20 (plage habituelle : indice 1000 à 3000, ralentissement ×6 au plus)
    (… tours 2 à 5 identiques)
  tentative 2 : valide

! PREUVE (EV_PERF_PREUVE_FAUSSEE=1) : la décision de la tentative 1 a lu un indice simulé de 3 600 (machine trop rapide) ; ralentissement appliqué et scores réels inchangés.
VERDICT : OK — tous les seuils sont tenus
```

`run.txt` : `perf_mobile=success`, `perf_mobile_mesure=ok`, `perf_mobile_tentatives=2`. Durée de la mesure : 520 s (deux
tentatives, chargements réels, rendu et touchers), sous le délai de 15 minutes de l'étape. Le cas « restée faussée » (trois
tentatives faussées, verdict « MESURE FAUSSÉE, À RELANCER ») est prouvé par le test (§ 6, `f5-mesure-fiable`) : la machine
réelle de ce run était dans la plage dès la tentative 2. Le run 596 était rouge pour une autre raison (poids JavaScript de
la fiche événement dépassé de 13 octets, corrigé : § 3 et § 9).

**Cas réel** (sans interrupteur), run **602** de la branche (job perf) : la machine de la CI était trop rapide à chaque tour
(indices 3 482 à 3 835, ralentissement ×6,96 à ×7,67, scores 80 à 90). Tentative 1 faussée, refaite ; tentative 2
faussée aussi ; verdict **« MESURE FAUSSÉE, À RELANCER — aucune conclusion sur les seuils »**, `run.txt` :
`perf_mobile_mesure=faussee-a-relancer`, `perf_mobile_tentatives=2` ; toucher mesuré normalement (64 ms, OK). Avant ce lot,
ce job aurait conclu « HORS SEUIL » sur l'accueil (85), la fiche (86) et Mes billets (85). Défaut relevé sur ce run et
corrigé (`ea324bcf8`) : la seconde reprise n'a pas été lancée faute de temps (407 s restantes pour 430 s estimées, dont
3 minutes gardées pour la suite) et le rapport écrivait « tentative 2 : FAUSSÉE, refaite » ; désormais 2 minutes gardées
(chargements réels et touchers : environ 1 min 45) et une reprise non lancée est dite telle quelle (« reprise non lancée,
temps insuffisant dans le délai de l'étape »).

## 7. Migrations et contrôles

Aucune migration. Rien à appliquer sur event-village-dev. Contrôle après fusion : aucun (pas de changement de base).

## 8. Tests modifiés (signalés)

Changement de comportement voulu : les liens des avis. Aucune suite de `tests/audit/` ni `tests/audit-auth/` touchée.

| Suite | Modification | Raison |
|---|---|---|
| `tests/parcours/notif-modeles.test.ts` | Liens attendus de 21 types (billet, billets de l'événement, retrait, transfert, dossier, réservation, invitation) ; substitution des identifiants `:ticket`, `:transfer`, `:cashout`, `:partner`, `:invitation`, `:reservation` (en plus de `:event`, `:outbox`) ; lien N1 de `TICKET_REFUNDED_HOLDER`. | Liens de l'objet exact (point 2). |
| `tests/parcours/confirmation-achat.test.ts` | Bouton des emails de confirmation : chemin attendu par cas (`buttonPath`) au lieu de `/tickets?tab=a-venir`. | Idem. |
| `tests/parcours/notif-canaux.test.ts` | Bouton de l'email d'achat, lien du push d'annulation (billets de l'événement) ; push « entrée validée » : billet fixe pour connaître le lien attendu. | Idem. |
| `tests/parcours/notif-pros.test.ts` | `actionUrl` des trois avis de retrait : page du retrait. | Idem. |
| `tests/parcours/notif-rappels.test.ts` | `actionUrl` et lien du push des rappels J-1 et H-3 : billets de l'événement. | Idem. |
| `tests/parcours/notif-transferts.test.ts` | `actionUrl` de l'offre de transfert : ancre du transfert dans « Reçus ». | Idem. |
| `tests/parcours/notif-admins.test.ts` | `actionUrl` de la candidature : dossier de la partenaire. | Idem. |
| `tests/parcours/email-regle-envoi.test.ts` | Bouton de l'email d'invitation : billets de l'événement. | Idem. |
| `tests/schema/design1b-billets.test.ts` | Liste des types qui mènent encore à un onglet de « Mes billets » réduite à ceux dont l'objet n'est plus au compte (et à l'offre de transfert, ancre permise). | Idem. |
| `tests/schema/design1e-orange.test.ts` | Fond sombre attendu `#0A0A0A` au lieu de `#121212`. | Consigne : « fond noir profond ». |
| `tests/helpers/design-files.ts` | Nouveaux fichiers d'interface ajoutés à la liste des fichiers soumis aux règles du système de design. | Règle du projet (contrat Q). |

Outillage (aucune assertion changée) : `e2e/support/responsive-pages.ts` (trois pages d'arrivée ajoutées au contrôle
responsive), `e2e/captures.spec.ts` et `e2e/responsive.spec.ts` (preuve du thème, bloquante), `e2e/support/fixtures.ts` et
`e2e/auth.setup.ts` (cookie du thème), `.github/workflows/verify.yml` (ligne `ci-captures`), `scripts/ci-verdict.mjs`
(captures du mode rapide, état de la mesure dans `run.txt`).

Suites nouvelles : `tests/schema/f5-sombre-outillage.test.ts`, `tests/schema/f5-liens-avis.test.ts`,
`tests/schema/f5-mesure-fiable.test.ts`, `tests/parcours/f5-pages-arrivee.test.ts`.

## 9. Runs

Journaux, captures et mesures : branche `ci-results`, dossier `runs/<n>-<id>/`.

| Run | Commit | Type | Résultat |
|---|---|---|---|
| 590 | `4b6963a6c` | rapide | workflow refusé par GitHub (un `
` devenu retour à la ligne dans `verify.yml`) : aucun job ; corrigé `4a3bc6449`, test YAML ajouté |
| 591 | `4a3bc6449` | rapide + responsive + captures sombres | **état des lieux du sombre avant couleurs** : responsive 184/0 défaut, captures sombres 416/416 (0 échec, axe « aucune ») ; job des suites rouge (typecheck TS2353 dans `f5-mesure-fiable`, JSDoc incomplète, corrigé `6a6bc12b2`) |
| 593, 596 | branche de preuve | perf seul | 593 : build refusé (lien `<a>` vers `/tickets` de la page hors ligne, règle déclenchée par `/tickets/[id]`, corrigé `417e4fc73` et `3b95076f5`) ; **596 : preuve de la mesure faussée refaite** (§ 6) ; poids JavaScript de la fiche +13 octets (§ 3) |
| 597 | — | rapide | remplacé par le 598 (code déjà corrigé depuis), sans conclusion |
| 598 | `a26ea4c9b` + ci | rapide (106 suites) + responsive + captures sombres + perf | 105/106 (`statut-compte` : contrôle du statut du compte dans `GET /api/tickets/[id]`, corrigé) ; **responsive 190/0, captures sombres après 416/416, 0 échec** ; poids JavaScript de la fiche +12 octets (hypothèse du nombre de pages écartée) |
| 602 | `7f3051a2a`(+ci) | rapide ciblé + perf | suites vertes ; **poids JavaScript dans les budgets** (fiche 233 282 / 233 316) ; mesure réellement faussée (machine à ×7), verdict « MESURE FAUSSÉE, À RELANCER » (§ 6), défaut de la reprise corrigé `ea324bcf8` |
| **605** | **`ea324bcf8`** | **complet** | **587 / 588 suites** ; seule rouge `tests/schema/recette-matrice` (numéros de ligne cités par `docs/recette-billetterie.md`, décalés par les tests modifiés ; corrigé, run rapide ci-dessous) ; contrôle des lots : 588 suites attendues, 588 exécutées (en échec par cette seule suite) ; **build vert**, **budgets JS tenus** ; **e2e vert** : 787 captures en clair et en sombre, 0 en échec (preuve du thème comprise), fumée et autres phases vertes ; **responsive 190 résultats, 0 défaut** ; **mesure mobile OK dès la tentative 1** (indices 2 641 à 2 899, ralentissement ×5,28 à ×5,8 : dans la plage) : accueil 90, fiche 92, Mes billets 93, toucher OK |
| **610** | `07abcd44c` | rapide | après la correction des numéros de ligne de la matrice et le rapport : **8 / 8 suites vertes** (`recette-matrice`, les quatre suites f5, `confirmation-achat`, `notif-canaux`, `email-regle-envoi`), typecheck et lint verts |

Poids JavaScript au run 605 (octets gzip ; budget) : `/` 224 700 (226 342), `/events/[id]` 233 282 (233 316),
`/tickets` 250 348 (250 417), `/controller/scanner` 234 639 (234 911), `/billet/hors-ligne` 223 748 (224 268).
Aucun budget relevé.

## 10. À faire de ton côté

- Rien : fusion faite sur feu vert, aucune migration à appliquer, branche de preuve supprimée.

## 11. Fusion dans main (22/11)

Sur feu vert : branche jetable `finition-5/preuve-faussee` supprimée (distante et locale) ; aucun run en cours sur `main`
avant la poussée ; `main` n'avait pas bougé depuis `75e20d52f` ; fusion `64089e9f1` (`--no-ff`, arbre identique à la tête
de la branche `e4296771a`, run 611 de la branche vert), sans ligne `ci-rapide` : vérification complète.

Run de `main` **621** (`64089e9f1`), `ci-results` `runs/621-45029570510/` : **vert**.

| Contrôle | Résultat |
|---|---|
| Suites | **588 / 588** réussies ; contrôle des lots OK (588 attendues, 588 exécutées dans 4 lots) |
| Typecheck, lint, build | verts |
| Poids JavaScript (gzip ; budget) | `/` 224 700 (226 342), `/events/[id]` 233 282 (233 316), `/tickets` 250 348 (250 417), `/controller/scanner` 234 639 (234 911), `/billet/hors-ligne` 223 748 (224 268) : tous tenus, aucun relevé |
| e2e | vert : 787 captures en clair et en sombre, **0 en échec** (preuve du thème comprise), fumée et autres phases vertes |
| Contrôle responsive | 190 résultats (page × thème), **0 défaut** |
| Mesure mobile | **OK**, tentative 1 valide (indices 1 568 à 2 041, ralentissement ×3,14 à ×4,08 : dans la plage) ; accueil 93, fiche 93, Mes billets 93 ; toucher OK ; `perf_mobile_mesure=ok`, `perf_mobile_tentatives=1` |

Aucune migration : rien à appliquer sur event-village-dev. Worktree de la finition retiré.
