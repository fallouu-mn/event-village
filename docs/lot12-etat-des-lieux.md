# État des lieux des lots 12b à 12e — Commandes : écrans et suite

Relevé en **lecture seule** le 26/11/2026, sur `origin/main` à `953914229a` (lot 11c-c fusionné ; la fusion du lot 11c-b
dans `main` est en cours dans une autre session et n'est pas lue ici, sauf son rapport sur `origin/lot11c/tables-client`).
Branche `etat/lot12`, jamais fusionnée sans accord. Aucun test, aucun build, aucun run de CI, aucun appel au projet
distant. Chemins relatifs au dépôt ; `M/` = `supabase/migrations/`.

## À lire en premier

### Verdict

1. **Le dépôt ne découpe pas les lots 12b à 12e.** Ni le cahier des charges, ni les rapports ne les nomment : le seul
   renvoi est « Lots 12b et suivants » (`docs/apres-lancement.md:158`) et, pour deux décisions du client, « au lot 12b »
   (`docs/lot12a-rapport.md:398`, `:403`). Le découpage ci-dessous est **une proposition**, construite à partir de ce
   qui manque, comme pour le lot 11c.
2. **L'argent et la sécurité des commandes sont faits (lot 12a), appliqués sur event-village-dev le 22/11.** Les 28
   fonctions publiques `order_*`, les 10 aides du schéma `private`, les 18 types d'avis `ORDER_*`, la tâche `ev_orders`
   et toutes les routes serveur existent (`docs/lot12a-rapport.md` § 6). **Aucune de ces fonctions n'a été redéfinie
   depuis** : leur dernière définition est toujours dans `M/20261130000001` à `…08`. Rien de cela n'est à refaire.
3. **Il manque tous les écrans, et quelques pièces serveur que le lot 12a n'a pas posées** :
   - aucune route ni fonction n'écrit les **zones de livraison** ni les **suppléments** (`order_delivery_zones`,
     `product_options` : aucun fichier de `app/` ni de `lib/` ne les cite ; les tests les écrivent avec le rôle de service) ;
   - les **routes des produits** ignorent l'établissement, la case « réglementé » et les suppléments
     (`lib/products/product.service.ts:256-264`) ; supprimer un produit déjà vendu échoue en erreur 500
     (`order_items.product_id … ON DELETE RESTRICT`, `M/0001_initial_schema.sql:497`) ;
   - le **menu public** (`GET /api/restaurants/[id]/menu`) lit par partenaire, pas par établissement, sans suppléments,
     sans zones, sans portions restantes, sans la mention « réglementé » ; la page `app/restaurants/[id]/menu/page.tsx`
     calcule le total dans le navigateur et envoie l'ancien corps à `POST /api/orders/create` (sans `venueId`) : elle ne
     peut plus commander ;
   - la **règle de lecture REST des produits** date de la première version : tout produit `DISPONIBLE` est lisible par
     un visiteur, même celui d'une partenaire suspendue ou d'un établissement non validé (`M/0003_rls.sql:237-238`, jamais
     redéfinie) ;
   - la **liste client** `GET /api/orders` lit encore l'ancien statut (`order_status`), montre les commandes jamais
     payées et renvoie vers l'ancien menu (`app/api/orders/route.ts:34-51`, `:114`) ;
   - l'ancienne page `/partner/orders` et le crochet `usePartnerOrders` lisent l'ancien format par la REST, qui ne
     rend plus rien à la partenaire depuis le 12a (`hooks/usePartnerOrders.ts:32-36`, `app/partner/orders/page.tsx:50-77`) ;
   - aucun espace **livreur** (`app/courier` n'existe pas), aucun écran de **vérification des produits** ni
     d'**annulation par Event Village** dans l'administration (les routes existent sans écran) ;
   - les deux décisions du 21/11 confiées « au lot 12b » demandent une migration chacune : **code visible dans
     l'application** (aujourd'hui seule l'empreinte est gardée) et **produits « à vérifier »** par mots-clés.
4. **Toutes les pages budgétées restent hors des lots 12b à 12d**, sauf la coquille commune (menu) si un lot y ajoute une
   entrée : elle est chargée par les six routes budgétées. Le lot 12e (découverte : plats du jour sur l'accueil,
   recherche par produit dans Explorer) touche l'accueil et Explorer.

### Découpage proposé

| Lot | Contenu | Migration | Contre-vérification |
|---|---|---|---|
| **12b — Client** | Menu d'un établissement (lecture publique par la base), panier, devis, commande, paiement (part, solde), suivi animé `/orders/<id>` avec le **code visible**, annulation, nouveau code, liste « Mes commandes » refaite, bouton « Commander » sur la fiche de l'établissement et sur la carte | oui (lecture publique du menu, règle REST des produits, code chiffré) | **obligatoire** (paiement, code de remise, données du client, lecture publique) |
| **12c — Partenaire** | Catalogue (établissement, suppléments, case « réglementé », plat du jour et portions, stock, archiver au lieu de supprimer), **mots-clés « à vérifier »** et l'écran de l'administration qui tranche, réglages de vente de l'établissement, zones de livraison, liste et fiche des commandes (relecture périodique, actions, saisie du code), livreurs, tableau de bord sans `usePartnerOrders` | oui (zones, suppléments, archivage, « à vérifier ») | **obligatoire** (prix, frais de zone, acompte, code, coordonnées, réglementés, fiche suspendue) |
| **12d — Livreur et administration des commandes** | Espace livreur (`/courier/orders`, détail, invitations), liste et fiche des commandes dans l'administration, annulation par Event Village (remboursement), signalement d'un problème par le client (si le client le veut), règle de la livraison ratée (si le client la tranche) | probable (lectures de l'administration ; livraison ratée) | **obligatoire** (adresse et téléphone vus par le livreur, remboursement par l'administration) |
| **12e — Statistiques et découverte** | Statistiques de la partenaire (CDC §73) et de l'administration (§159), plats du jour sur l'accueil (§17), recherche par produit dans Explorer (§16), restes du cahier (acompte en montant fixe §65 si le client le veut) | probable (agrégats) | recommandée, plus légère (lectures d'argent, aucune écriture) |

Le lot 12a avait rangé « écrans du catalogue » et « mots-clés » sous « 12b » ; ici ils vont au **12c** (côté
partenaire), pour que 12b et 12c tournent en même temps sans toucher les mêmes fonctions.

### Ordre conseillé et paires en parallèle

1. **Avant tout lot 12** : fin de la fusion du 11c-b (autre session) ; vérifier sur event-village-dev quelles migrations
   de `main` restent à appliquer (`20261210000001` de la carte B3, `20261215000001-002` du 11c-c : la dernière application
   connue est `20261201000007`, le 25/11).
2. **12b ∥ 12c** : pas de fichier d'écran commun, pas de fonction en base commune (détail § 6). Deux points de contact
   seulement, faciles à fusionner : `lib/orders/booking.ts` (mise en forme des réponses) et la page client du menu, qui
   lit le résultat de la règle « à vérifier » posée par 12c (12b s'appuie sur `product_regulated` et le statut, voir
   § 2.4).
3. **Petit lot de suivi des tables** (`20261220…`) **∥ 12b ou 12c** : il ne touche que l'avis du report
   (`event_change_notify`) et Mes billets ; aucune fonction des commandes. Il doit être **appliqué avant** les migrations
   des lots 12 (horodatage plus ancien).
4. **Lot poids 2 ∥ 12b/12c** (aucune migration, réglage de la découpe des morceaux) ; **à finir avant le 12e**, qui ajoute
   du code à l'accueil et à Explorer.
5. **Contre-vérifications** de 12b et 12c, puis **12d** (il lit les commandes créées et confiées par les écrans du 12b et
   du 12c, et ajoute peut-être une entrée « Mes livraisons » dans la coquille), puis **12e**.
6. **Ouverture du service** (`features.orders_enabled`) : au plus tôt après 12b, 12c et leurs contre-vérifications
   (un produit « à vérifier » ne peut être tranché que par l'écran d'administration du 12c) ; je conseille d'attendre
   le 12d (le livreur et l'annulation par Event Village ont des routes mais pas d'écran).

**Intervalles d'horodatage proposés** (un par lot, au-dessus de la dernière migration de `main`, `20261215000002`) :
suivi des tables `20261220…` (déjà réservé), **12b `20261222…`**, **12c `20261224…`**, **12d `20261228…`**,
**12e `20270104…`**. Les migrations sont appliquées dans l'ordre des horodatages (`docs/deploiement-projet-neuf.md:82` :
jamais `--include-all`). Si deux lots en parallèle fusionnent dans l'ordre inverse de leurs intervalles, celui qui
fusionne en second **renomme ses migrations** au-dessus de la dernière appliquée avant de fusionner (elles ne sont pas
encore appliquées), avec son test « rejouable ».

---

## 1. Ce que dit le cahier des charges (V3.0)

Passages exacts (`docs/CDC-V3.md`), partie IX « Commande et vente » :

> **56. PRÉSENTATION** — Présenter ; publier ; vendre leurs produits (plats du jour, menus, formules, desserts, produits alimentaires autorisés).
> **57. PARTENAIRES CONCERNÉS** — restaurants ; traiteurs ; pâtisseries ; établissements alimentaires ; prestataires autorisés ; organisateurs.
> **58. CATALOGUE** — créer ; modifier ; publier ; désactiver ; supprimer ; fixer le prix ; gérer les quantités.
> **59. PLAT DU JOUR** — Exemple : THIÉBOUDIENNE — 4 500 FCFA — 50 portions — Aujourd'hui.
> **60. PRIX** — Le Partenaire fixe librement le prix dans les limites des règles Event Village.
> **61. DISPONIBILITÉ** — disponible ; indisponible ; épuisé ; temporairement suspendu.
> **62. PANIER** — produit ; quantité ; prix ; livraison ; total ; montant à payer ; solde éventuel.
> **63. COMMANDE** — prénom ; nom ; téléphone ; email ; adresse ; commentaire.
> **64. PAIEMENT INTÉGRAL** — 100 % à la commande.
> **65. ACOMPTE** — pourcentage ; montant fixe.
> **66. PAIEMENT DIFFÉRÉ** — Total – Montant payé = Solde.
> **67. LIVRAISON** — Commande confirmée → Préparation → Prête → En livraison → Livrée.
> **68. RETRAIT** — Commande prête → Client arrive → Commande remise → Commande retirée.
> **69. SUR PLACE** — Commande associée à : une table ; une zone ; un emplacement.
> **70. NOTIFICATIONS** — SMS ; WhatsApp ; notification ; Email (produit, montant, client, téléphone, adresse de livraison).
> **71. PRODUITS INTERDITS** — Alcool etc. : exposer / présenter / afficher le prix autorisés ; vente via Event Village, paiement en ligne, livraison Event Village interdits.
> **72. ANNULATION** — demande ; validation ; annulation ; remboursement ; ajustement financier.
> **73. STATISTIQUES** — commandes ; ventes ; panier moyen ; produits populaires ; livraisons ; annulations ; paiements.

Ailleurs :

> **16. RECHERCHE** — Recherche par : événement ; restaurant ; salle ; prestataire ; produit ; table ; localisation.
> **17. DÉCOUVERTE** — événements populaires ; événements proches ; restaurants ; offres ; plats du jour ; salles ; prestataires.
> **19. COMMANDES** — commande ; produits ; quantité ; montant ; montant payé ; solde ; livraison ; statut.
> **21. HISTORIQUE** — tickets ; commandes ; réservations ; paiements ; commissions ; parrainage.
> **29. TABLEAU DE BORD** — ventes ; réservations ; commandes ; tickets ; revenus ; paiements ; statistiques ; abonnement.
> **108. SERVICES GRATUITS** — … exposition simple gratuite ; plat du jour exposable gratuitement.
> **114. COMMANDES** — Gratuit d'accès. Commission transactionnelle ; abonnement Premium ; services additionnels.
> **115. PRODUITS EXPOSÉS UNIQUEMENT** — Pas de commission sur vente hors plateforme. Monétisation : abonnement ; mise en avant ; visibilité.
> **130. SERVICES** — événements ; tickets ; tables ; salles ; produits ; commandes.
> **140. DONNÉES PRODUIT** — produit_id ; partenaire ; nom ; catégorie ; prix ; stock ; disponibilité ; statut.
> **141. DONNÉES COMMANDE** — commande_id ; client ; partenaire ; produits ; quantité ; total ; payé ; solde ; livraison ; statut.
> **147. COMMANDES** — nouvelle commande ; confirmation ; préparation ; livraison ; retrait ; clôture.
> **159. COMMANDES** — nombre ; ventes ; panier moyen ; produits populaires ; livraisons ; annulations.
> **186. RÈGLES DE COMMANDE** — paiement intégral ; acompte ; paiement différé ; livraison ; retrait ; sur place.
> Chronogramme : « 5 | Commande / Vente | 4-5 sem. ».

### Ce que le lot 12a a déjà livré (et décidé)

Rapport `docs/lot12a-rapport.md` (fusion `5a74fa6b9`, run de main 586 vert, migrations appliquées le 22/11),
contre-vérification `docs/audit-lot12a.md` (T1-T9 corrigés, § 13 du rapport). En bref :

- **Schéma** (§ 3) : réglages de vente des établissements (`venues.orders_open`, `order_modes`, acompte, paiement à la
  remise, préparation), produits rattachés à un établissement, case « réglementé » et décision de l'administration,
  suppléments, portions du plat du jour, zones de livraison, état détaillé et montants figés des commandes, historique,
  livreurs, clé du code dans `private`.
- **Argent** (§ 4) : frais de service 5 % sur ce qui est payé en ligne, commission 0 %, acompte 30 % par défaut (10 à 90 %),
  remboursements par le grand livre, plafond de 3 commandes non payées.
- **États** (§ 5) : `EN_ATTENTE_PAIEMENT → RECUE → ACCEPTEE → EN_PREPARATION → PRETE → EN_ROUTE → REMISE`, et les fins
  (`NON_RETIREE`, `EXPIREE`, `REFUSEE`, `SANS_REPONSE`, `ANNULEE_*`) ; heure de chaque étape servie par
  `GET /api/orders/[id]` « pour le suivi animé du lot 12b » (`docs/lot12a-rapport.md:149`).
- **Routes** (§ 6) : 18 routes, toutes présentes dans `app/api/` (vérifié : `orders/quote`, `orders/create`,
  `orders/[id]`, `orders/[id]/cancel`, `orders/[id]/code`, `partner/orders`, `partner/orders/[id]`,
  `partner/venues/[id]/orders`, `partner/products/[id]/portions`, `partner/couriers`, `partner/couriers/[userId]`,
  `courier/orders`, `courier/orders/[id]`, `courier/invitations/[id]`, `admin/orders/[id]/cancel`,
  `admin/products/[id]/regulation`, `cron/orders`, plus `payments/create` pour `ORDER`).
- **Avis** (§ 7) : 17 types en file et l'envoi immédiat `ORDER_HANDOVER_CODE` ; liens déjà posés vers `/orders/<id>`,
  `/partner/orders/<id>`, `/courier/orders/<id>`, `/courier/invitations/<id>` (`lib/notifications/catalog.ts:1818-2053`).
- **Décisions du 21/11** (§ 12, `docs/lot12a-rapport.md:394-405`) : 1 « Au lot 12b, le client verra aussi son code dans
  l'application, sur sa commande, compte connecté seulement : code gardé chiffré dans `private`, jamais lisible par la
  partenaire ni le livreur, jamais en file, push ni email » ; 3 délai de réponse de 15 minutes « Gardé, à confirmer par le
  client » ; 4 « Livraison ratée : question posée au client » ; 6 « Changé, au lot 12b : détection par mots-clés (bière,
  vin, whisky, liqueur, cigarette, chicha…) → produit « à vérifier », non vendable jusqu'à la décision de
  l'administration » ; 2, 5, 7, 8, 9 validés.

---

## 2. Lot 12b — Écrans du client

### 2.1 Ce que le cahier demande

§56 présenter et vendre ; §61 afficher la disponibilité (disponible, indisponible, épuisé, suspendu) ; §62 panier
(produit, quantité, prix, livraison, total, montant à payer, solde) ; §63 coordonnées (téléphone, adresse, commentaire) ;
§64-66 payer en entier, un acompte, le solde ; §67-69 livraison, retrait, sur place (table, zone, emplacement) ; §71
réglementés affichés avec leur prix, jamais commandés ; §72 annulation et remboursement ; §19 et §21 commandes et
historique du client. Décision 1 du 21/11 : code visible dans l'application.

### 2.2 Ce qui existe déjà (à réutiliser, rien à refaire)

| Besoin | Existant |
|---|---|
| Devis calculé en base | `POST /api/orders/quote` → `order_quote` (`app/api/orders/quote/route.ts`, `M/20261130000004:461`) |
| Création | `POST /api/orders/create` → `order_create` (numéro vérifié exigé, `app/api/orders/create/route.ts:27-30`) ; corps : `venueId, mode, payment?, items[{productId, quantity, optionIds?, notes?}], zoneId?, address?, phone?, onsiteTableId?, onsiteLabel?, scheduledFor?, notes?` |
| Paiement de la part et du solde | `POST /api/payments/create` (`ORDER`, `part: SOLDE`) → `startOrderPayment` (`lib/orders/order-payment.service.ts`) ; confirmation par webhook et réconciliation (`order_payment_confirm`) |
| Suivi | `GET /api/orders/[id]` → `order_view` (étapes et heures, heure estimée, lignes, montants, « code envoyé ») ; ouvert service fermé |
| Annulation | `POST /api/orders/[id]/cancel` → `order_cancel` origine CLIENT (tout rendu avant la préparation) |
| Nouveau code | `POST /api/orders/[id]/code` → `order_code_resend` (3 au plus) |
| Mise en forme des réponses et refus | `lib/orders/booking.ts` (`orderResponse`, `orderRefusal`, `orderStateLabel`) |
| Page « élément plus disponible » | `components/ui/UnavailableItem.tsx` (`docs/apres-lancement.md:189`) |
| Fiche publique d'un établissement | `app/tables/(catalogue)/[id]/page.tsx` (lot 11b ; **derrière l'interrupteur des tables**) ; carte des lieux `GET /api/lieux/carte` (Carte B3) |
| Avis du client | 11 types `ORDER_*` du client, liens vers `/orders/<id>` (`lib/notifications/catalog.ts:1818-1970`) |

### 2.3 Ce qui manque

1. **Menu d'un établissement** : nouvelle lecture publique par établissement (produits de l'établissement, catégories,
   suppléments actifs, plat du jour et portions restantes du jour, statut, mention « réglementé » sans bouton, modes de
   remise, zones et minimum, acompte proposé, horaires). L'actuel `GET /api/restaurants/[id]/menu` lit par partenaire et
   ne sert rien de cela (`app/api/restaurants/[id]/menu/route.ts:51-66`) ; il remplace aussi l'image absente par une photo
   Unsplash (`:72-74`). Contrainte d'audit à garder : un identifiant partiel répond 404 (`tests/audit/cv11a-4-droits.test.ts:339-346`).
2. **Page du menu et panier** : `app/restaurants/[id]/menu/page.tsx` (431 lignes) est à refaire : total calculé dans le
   navigateur (`:73-80`), ancien corps sans établissement (`:92-102`), aucune zone, aucun supplément, aucune heure.
   Le panier doit afficher le devis de la base (comme les tables du 11c-b : aucun montant calculé dans le navigateur).
3. **Paiement** : choix de la part (en entier, acompte, à la remise si l'établissement l'accepte), puis paiement du solde
   depuis la commande.
4. **Suivi `/orders/<id>`** : frise animée des étapes, heure estimée, montants (payé, solde, remboursé), code de remise
   visible (décision 1), « Annuler » tant que la préparation n'a pas commencé, « Recevoir un nouveau code », page
   « Cet élément n'est plus disponible » pour une commande absente ou d'autrui. Ouvert service fermé (comme la route).
5. **« Mes commandes »** : `GET /api/orders` (`app/api/orders/route.ts`) à refaire pour les repas : état détaillé
   (`order_state`) au lieu de `order_status`, commandes non payées échues masquées ou rangées, lien vers `/orders/<id>`
   au lieu de l'ancien menu (`:114`). La page `app/orders/page.tsx` garde ses onglets ; ses libellés (`STATUS_META`,
   `:53-63`) sont ceux de l'ancien format.
6. **Accès** : bouton « Commander » sur la fiche de l'établissement quand `orders_open` (la fiche est derrière
   l'interrupteur des tables : une BOUTIQUE n'y passe pas, voir question Q3) et sur la carte des lieux ; l'entrée du menu
   « Restaurants et tables » pointe encore vers un établissement d'exemple (`components/layout/AppLayout.tsx:184`,
   `'/restaurants/rest-terrou-bi/tables'`).
7. **Code visible dans l'application** (décision 1) : aujourd'hui seule l'empreinte HMAC est gardée
   (`private.order_issue_code`, `M/20261130000006:281-300`), le code est rendu une fois à la route qui l'envoie par SMS.

### 2.4 Migrations probables (intervalle `20261222…`)

| Objet | Contenu | Recopie (dernière définition) |
|---|---|---|
| Code chiffré | table `private.order_codes (order_id, code_enc, issued_at)`, chiffrée avec une clé de `private` (pgcrypto présent : `M/0001_initial_schema.sql:10`) ; écrite par `order_issue_code` ; effacée par un déclencheur quand `orders.code_hash` repasse à vide (fin et remise l'effacent déjà : `M/20261130000006:160` et `:419`) ; lue par une fonction nouvelle `order_code_reveal` (client de la commande, compte actif, commande ouverte, code émis) | `private.order_issue_code` — `M/20261130000006_l12a_etapes.sql:281` (seule recopie, grâce au déclencheur) |
| Menu public | fonction nouvelle `order_venue_menu(venue)` réservée au rôle de service : établissement listé (`listed_venue`, `M/20261210000001:53`), partenaire VALIDE, `orders_open`, produits de l'établissement, suppléments actifs, portions du jour, zones actives | aucune (fonction nouvelle) ; s'appuie sur `product_regulated` (`M/20261130000002:86`) pour la mention « réglementé » |
| Règle REST des produits | `products_read` limitée aux produits d'une partenaire VALIDE et d'un établissement listé (ou sans établissement pour l'ancien code), plus le propriétaire et l'administration | `products_read` — `M/0003_rls.sql:237-238` (jamais redéfinie) ; `product_options_read` et `product_daily_portions_read` suivent (`M/20261130000002:425-431`) |

Si le 12c pose « à vérifier » dans `product_regulated` (recommandé, § 3.4), le menu du 12b le montre sans changement
comme « non commandable en ligne » ; seul le libellé (« en cours de vérification ») est à ajouter après la fusion des deux.

### 2.5 Argent et sécurité (contre-vérification obligatoire)

- **Paiement** : part, solde, double clic, deux onglets, prix changé entre le devis et le paiement (même règle que les
  tables du 11c-b : total affiché comparé au montant créé), solde après une décision « réglementé ».
- **Code de remise** : lisible par le seul client connecté de la commande ; jamais dans une réponse de la partenaire ou du
  livreur, jamais en file, push, email, journal, cache du navigateur ou stockage du téléphone ; effacé à la remise, à la
  fin et à la déconnexion (`tests/audit/cvf2b-6-deconnexion.test.ts:200` suit déjà `app/orders/page.tsx`).
- **Données du client** : adresse et téléphone saisis, gardés seulement le temps de la commande ; rien de la commande
  d'un autre compte (404).
- **Lecture publique** : rien d'une partenaire suspendue ni d'un établissement non validé ; aucun champ interne
  (stock exact, décision de l'administration) dans le menu public.

### 2.6 Avis

Aucun type nouveau. Les liens existants vers `/orders/<id>` mènent enfin à une page. Les SMS ne changent pas (code
toujours par SMS immédiat). À vérifier seulement : le texte de la cloche « donnez le code reçu par SMS » peut dire
« visible aussi dans votre commande » (catalogue, sans migration).

### 2.7 Écrans et pages budgétées

Écrans : `app/restaurants/[id]/menu/page.tsx` (ou nouvelle adresse, Q3), nouveau `app/orders/[id]/`, `app/orders/page.tsx`,
fiche de l'établissement (bouton), carte des lieux (lien). **Pages budgétées : aucune**, à condition de ne pas toucher la
coquille commune (`components/layout/AppLayout.tsx`, chargée par les six routes) ; si « Commandes » revient dans la
barre du bas (question Q10), les six routes sont concernées.

---

## 3. Lot 12c — Écrans de la partenaire et vérification des produits

### 3.1 Ce que le cahier demande

§58 créer, modifier, publier, désactiver, supprimer, fixer le prix, gérer les quantités ; §59 plat du jour et portions ;
§60 prix libre « dans les limites des règles Event Village » ; §61 disponibilité ; §65 acompte ; §67-69 modes de remise ;
§71 produits interdits ; §147 nouvelle commande, confirmation, préparation, livraison, retrait, clôture ; §29 tableau de
bord « commandes ». Décision 6 du 21/11 (mots-clés « à vérifier »).

### 3.2 Ce qui existe déjà

| Besoin | Existant |
|---|---|
| Liste et fiche des commandes | `GET /api/partner/orders?filter=open|closed` → `order_partner_list` ; `GET /api/partner/orders/[id]` → `order_view` (`M/20261130000006:924`, `:843`) |
| Actions | `PATCH /api/partner/orders/[id]` : `ACCEPTER` (minutes), `REFUSER` (motif), `PREPARER`, `PRETE`, `CONFIER` (livreur), `EN_ROUTE` (minutes), `REMETTRE` (code, solde reçu), `ANNULER` (motif) → `order_partner_action` (`M/20261130000006:482`) ; code envoyé par la route (`deliverHandoverCode`) |
| Réglages de vente d'un établissement | `PATCH /api/partner/venues/[id]/orders` → `order_venue_settings_set` (`M/20261130000002:252`) |
| Portions du plat du jour | `POST /api/partner/products/[id]/portions` → `order_daily_portions_set` (`M/20261130000002:318`) |
| Livreurs | `GET/POST /api/partner/couriers`, `DELETE /api/partner/couriers/[userId]` → `order_courier_invite`, `order_courier_remove` (10 invitations par jour) |
| Produits (ancien code, gardé) | `GET/POST /api/partner/products`, `GET/PATCH/DELETE /api/partner/products/[id]`, `POST …/[id]/status` (`lib/products/product.service.ts`, liste blanche R2, statut seulement par `setProductStatus`) |
| Décision « réglementé » | `POST /api/admin/products/[id]/regulation` → `order_product_regulation_decide` (`M/20261130000002:373`), droit `partners.validate` |
| Garde des fiches suspendues | `lib/auth/partner-fiche-guard.ts:120-132` (produits, livreurs, réglages de vente) |
| Avis de la partenaire | `ORDER_NEW`, `ORDER_CANCELLED_PRO`, `ORDER_HANDED_OVER_PRO` (`lib/notifications/catalog.ts:1980-2017`) |
| Écrans à reprendre | `app/partner/orders/page.tsx` (473 lignes, ancien format, temps réel REST), `app/partner/products/page.tsx` (302), `app/partner/products/new/page.tsx` (364), tableau de bord `app/partner/dashboard/page.tsx:274` (`usePartnerOrders`) |

### 3.3 Ce qui manque

1. **Écriture des zones de livraison** (nom, frais fixes, minimum, actives, ordre) : aucune route ni fonction.
2. **Écriture des suppléments** d'un produit : aucune route ni fonction.
3. **Produits** : établissement à la création (jamais changé ensuite : `products_order_guard`, `M/20261130000002:96-138`),
   case « réglementé » et sorte (ALCOOL, TABAC), suppléments ; la liste blanche ne connaît pas ces champs
   (`lib/products/product.service.ts:256-264`). **Supprimer** un produit vendu : erreur 500 (clé étrangère RESTRICT) →
   « archiver » (caché, historique gardé), question Q7.
4. **Mots-clés « à vérifier »** (décision 6) : détection à l'enregistrement, produit non vendable, file de
   l'administration, décision, avis à la partenaire.
5. **Écran de vérification dans l'administration** (produits à vérifier et produits marqués par la partenaire) :
   la route existe sans écran ; l'onglet « Produits et traiteurs » de `app/admin/services/page.tsx:34` est une liste en
   lecture.
6. **Liste et fiche des commandes** `/partner/orders` et `/partner/orders/<id>` : la partenaire ne lit plus les
   commandes par la REST (F2 du lot 12a), donc **plus de temps réel** : relecture périodique de la route serveur
   (`docs/apres-lancement.md:159`), avec un signal sonore tant que la page est ouverte (Q15). Saisie du code à la remise
   (5 essais), solde reçu, motifs.
7. **Livreurs** : écran d'invitation et de retrait (dans « Équipe » ou une page propre).
8. **Tableau de bord** : `usePartnerOrders` ne rend plus rien (REST fermée) ; la carte « commandes » doit lire la route
   serveur. Le test `tests/parcours/partenaire-lot7.test.ts:783` exige l'import de `usePartnerOrders` (garde-fou
   SCENARIO 15) : le changer est une modification de test **à signaler**.

### 3.4 Migrations probables (intervalle `20261224…`)

| Objet | Contenu | Recopie (dernière définition) |
|---|---|---|
| « À vérifier » | colonne `products.review_state` (vide, `A_VERIFIER`) posée par la base à l'enregistrement si le nom ou la description contient un mot de la liste (réglage `orders.review_keywords`) ; `product_regulated` rend vrai tant que le produit est à vérifier → devis, création, ligne, paiement et remise refusent sans autre changement ; la décision de l'administration efface l'état | `product_regulated` — `M/20261130000002:86` ; `products_order_guard` — `:96` (la partenaire ne peut pas effacer l'état) ; `order_product_regulation_decide` — `:373` ; **`order_quote_compute` — `M/20261130000004:196`** (il teste la case en ligne, `:289`, sans passer par `product_regulated`) ; `finance_setting_set` `M/20261130000001:35`, `fin_setting_valid` `:98`, `platform_settings_defaults` `:211` pour le réglage des mots-clés |
| Zones | `order_delivery_zone_set`, `order_delivery_zone_remove` (même partenaire, fiche non suspendue, frais et minimum entiers ; une zone d'une commande ouverte ne s'efface pas) | aucune |
| Suppléments | `product_option_set`, `product_option_remove` (le prix figé des lignes ne change pas) | aucune |
| Archivage | colonne `products.archived_at` ; menu, devis et listes l'excluent | `order_quote_compute` (même recopie que ci-dessus) |
| Avis | 2 types : vérification demandée (administration), décision (partenaire) | insertion dans `notification_types` comme `M/20261130000007` ; aucune recopie de fonction d'envoi |

Une seule recopie de chacune dans le lot (règle S1 des contre-vérifications : `tests/audit/cv12a-3-statique`).

### 3.5 Argent et sécurité (contre-vérification obligatoire)

Prix et suppléments entiers et bornés, frais et minimum des zones, pourcentage d'acompte (10 à 90), produit d'un
établissement d'une autre partenaire, réglementé et « à vérifier » contournés par une modification ou un changement de
statut, code de remise (essais, blocage), solde reçu, coordonnées du client (seulement la commande ouverte, masquées à
7 jours), livreur d'une autre partenaire, fiche suspendue (lecture seule), relecture périodique sans fuite d'une
commande non transmise (T1 et T5 du 12a).

### 3.6 Avis

Deux types nouveaux (proposition) : **vérification d'un produit demandée** (administration `partners.validate` :
cloche, email ; pas de SMS) et **produit vérifié / refusé à la vente** (partenaire : cloche, push, email ; SMS non
conseillé). Lien vers `/admin/…` et `/partner/products/<id>`. Les avis de commande existants ne changent pas.

### 3.7 Écrans et pages budgétées

`app/partner/orders/**`, `app/partner/products/**`, réglages de vente dans la page de l'établissement
(`app/partner/tables/[venueId]` ou page dédiée), zones, livreurs, tableau de bord, une page d'administration des
produits (nouvelle, pour ne pas partager `app/admin/services/page.tsx` avec le 12d). **Pages budgétées : aucune** (les
entrées du menu partenaire existent déjà : `components/layout/AppLayout.tsx:191-194`).

---

## 4. Lot 12d — Espace du livreur et administration des commandes

### 4.1 Ce que le cahier demande

§67 « En livraison → Livrée » ; §72 « demande ; validation ; annulation ; remboursement ; ajustement financier » ; §130
services et §131 finance (remboursements) côté administration ; §70 données de livraison (client, téléphone, adresse).

### 4.2 Ce qui existe déjà

| Besoin | Existant |
|---|---|
| Liste et fiche du livreur | `GET /api/courier/orders` → `order_courier_list` ; `GET/PATCH /api/courier/orders/[id]` → `order_view`, `order_courier_action` (`M/20261130000006:951`, `:648`) |
| Invitation | `POST /api/courier/invitations/[id]` → `order_courier_respond` (`:764`) |
| Annulation par Event Village | `POST /api/admin/orders/[id]/cancel` → `order_cancel` origine EVENT_VILLAGE, droit `refunds.manage` ; `PATCH /api/admin/services` pour une commande jamais payée |
| Avis du livreur | `ORDER_COURIER_ASSIGNED`, `ORDER_COURIER_CANCELLED`, `ORDER_COURIER_INVITED` (liens `/courier/…`) |
| Liste de l'administration | onglet « Commandes » de `app/admin/services/page.tsx` (lecture, ancien `order_status` : `app/api/admin/services/route.ts:65-72`, `:92`) |

### 4.3 Ce qui manque

1. Pages `/courier/orders`, `/courier/orders/<id>` (adresse, téléphone, montant à encaisser, départ, saisie du code),
   `/courier/invitations/<id>` (accepter, refuser) ; accès depuis le menu du compte pour un livreur actif.
2. Administration : liste des commandes par état détaillé, fiche (historique `order_state_history`, paiements,
   remboursements), « Annuler et rembourser » avec motif.
3. Selon les réponses du client : **signalement d'un problème** par le client après le début de la préparation
   (`docs/apres-lancement.md:166`) et **livraison ratée** (`docs/apres-lancement.md:162`).

### 4.4 Migrations probables (intervalle `20261228…`)

Liste de l'administration (filtres, pagination) par une fonction nouvelle plutôt que la lecture REST ; signalement
(table et avis) et livraison ratée (état ou motif, et `order_courier_action` / `order_partner_action` recopiées depuis
`M/20261130000006:648` et `:482`, plus `order_tick` `:978` si un délai automatique est choisi) **seulement si le client
les veut**. Sans ces deux points : peut-être aucune migration.

### 4.5 Argent et sécurité (contre-vérification obligatoire)

Livreur retiré ou d'une autre partenaire, adresse et téléphone après la fin, code (le livreur ne le voit jamais),
solde encaissé par le livreur, annulation par l'administration (droit `refunds.manage`, remboursement une seule fois),
données personnelles dans les listes de l'administration (droit de lecture).

### 4.6 Avis

Aucun nouveau sans les points du client ; un type pour le signalement (administration) et un pour la livraison ratée
(client, partenaire) s'ils sont retenus.

### 4.7 Écrans et pages budgétées

Nouveau `app/courier/**`, pages d'administration des commandes. **La coquille commune** si l'entrée « Mes livraisons »
y est ajoutée : les six routes budgétées la chargent ; l'entrée doit venir de la session déjà lue, sans module ajouté
au premier chargement.

---

## 5. Lot 12e — Statistiques et découverte

### 5.1 Ce que le cahier demande

§73 et §159 (commandes, ventes, panier moyen, produits populaires, livraisons, annulations, paiements) ; §29 tableau de
bord ; §16 recherche par produit ; §17 plats du jour ; §108 plat du jour exposable gratuitement ; §65 acompte en montant
fixe ; §70 WhatsApp (hors V1 : `docs/guide/14-non-implemente.md:31`).

### 5.2 Ce qui existe déjà

`app/partner/stats` et `GET /api/partner/stats`, `GET /api/partner/metrics` (commandes transmises seulement depuis la
contre-vérification T5 : `app/api/partner/metrics/route.ts:54-62`, `lib/partner/partner-dashboard.service.ts:608-620`,
sur l'ancien `order_status`) ; relevés de l'administration (`finance_admin_earned`, `finance_admin_payments`, commission
des commandes : `M/20261130000008`) ; recherche des lieux (`venue_search`, `M/20261210000001:864`).

### 5.3 Ce qui manque

Agrégats propres aux commandes (panier moyen, produits populaires, part payée en ligne et à la remise séparées,
annulations par origine) pour la partenaire et l'administration ; section « Plats du jour » sur l'accueil ; produit dans
la recherche d'Explorer ; acompte en montant fixe (si le client le veut : recopie de `order_quote_compute`,
`M/20261130000004:196`, et de `order_venue_settings_set`, `M/20261130000002:252`).

### 5.4 Migrations, argent, avis, écrans

Fonctions d'agrégats nouvelles (aucune recopie) ; montant fixe d'acompte si retenu. Lectures d'argent seulement :
contre-vérification recommandée (aucune commande non payée, aucune donnée personnelle dans les agrégats). Aucun avis.
**Pages budgétées : accueil (`/`) et Explorer (`/explore`)** : section chargée à l'apparition, comme l'aperçu de la
carte (lot poids) ; à faire après le lot poids 2.

---

## 6. Dépendances et parallélisme

### 6.1 Ce que chaque lot touche

| Élément | 12b | 12c | 12d | 12e | Suivi des tables |
|---|---|---|---|---|---|
| `lib/orders/booking.ts` | oui | oui | oui | — | — |
| `app/api/orders/route.ts`, `app/orders/**` | oui | — | — | — | — |
| `app/restaurants/[id]/menu/**`, `app/api/restaurants/[id]/menu` | oui | — | — | — | — |
| `app/partner/orders/**`, `app/partner/products/**`, `lib/products/product.service.ts`, `hooks/usePartnerOrders.ts`, tableau de bord | — | oui | — | stats | — |
| `app/courier/**` | — | — | oui | — | — |
| `app/admin/services/page.tsx` et `app/api/admin/services/route.ts` | — | évité (page propre) | évité (page propre) | — | — |
| `components/layout/AppLayout.tsx` (coquille) | si Q10 | — | si « Mes livraisons » | — | — |
| `lib/notifications/catalog.ts` | texte seulement | 2 types | selon Q | — | avis du report |
| `app/page.tsx`, `app/explore/**` | — | — | — | oui | — |
| Mes billets | — | — | — | — | oui |
| `private.order_issue_code` | recopie | — | — | — | — |
| `product_regulated`, `products_order_guard`, `order_product_regulation_decide`, `order_quote_compute` | lecture | recopies | — | `order_quote_compute` si montant fixe | — |
| `order_partner_action`, `order_courier_action`, `order_tick` | — | — | si livraison ratée | — | — |
| `finance_setting_set`, `fin_setting_valid`, `platform_settings_defaults` | — | recopie (réglage des mots-clés) | — | — | — |
| `event_change_notify` (`M/20261121000006`), `event_notice_recipient_count` | — | — | — | — | recopie |
| `products_read` (`M/0003_rls.sql:237`) | redéfinie | — | — | — | — |

### 6.2 Paires

- **12b ∥ 12c : oui.** Aucune fonction en base commune ; `lib/orders/booking.ts` en ajouts. Le 12c recopie
  `order_quote_compute` ; le 12b ne doit pas y toucher (le menu public est une fonction nouvelle).
- **12c ∥ 12d : possible**, à condition que chacun ait sa page d'administration et qu'aucun ne recopie
  `order_partner_action` en même temps (la livraison ratée du 12d le ferait : la placer alors après la fusion du 12c).
- **12b ∥ 12d : oui**, sauf la coquille si les deux y ajoutent une entrée.
- **12e** après 12b-12d (il compte ce que les écrans créent) et après le lot poids 2.
- **Suivi des tables ∥ n'importe quel lot 12** (seul point commun : `lib/notifications/catalog.ts`, en ajouts).
- **Lot poids 2 ∥ 12b/12c/12d** ; ses chiffres de référence bougeront avec chaque fusion : relire les octets de `main`
  avant de conclure.

Capacité de CI : pas plus de deux runs complets en même temps (règle des lots précédents) ; une poussée de `main`
annule le run en cours sur `main`.

### 6.3 Tests existants qui citent ces écrans (à signaler s'ils changent)

`tests/parcours/partenaire-lot7.test.ts:783` (import de `usePartnerOrders` exigé), `tests/parcours/temps-reel-hook.test.ts`
(abonnements et crochets), `tests/parcours/dette-publication-reservations.test.ts:5` (publication de `orders`),
`tests/parcours/pilotage-acces.test.ts`, `tests/parcours/interrupteurs.test.ts`, `tests/parcours/f2acv-produits.test.ts`
(liste blanche R2), `tests/parcours/client-interface.test.ts`, `tests/parcours/design-systeme.test.ts`,
`tests/security/r25-commandes-idor.test.ts`, `tests/parcours/l12a-commandes.test.ts`, `tests/parcours/notif-modeles.test.ts`,
`e2e/support/responsive-pages.ts` ; suites d'audit (assertions intouchables sans accord) :
`tests/audit/cv11a-4-droits.test.ts:339-346` (menu par identifiant exact), `tests/audit/cv12a-1-trous.test.ts`
(T1, T5, T8 : routes partenaire), `tests/audit/cv12a-3-statique.test.ts` (une seule recopie par lot),
`tests/audit/cvf2b-6-deconnexion.test.ts:200` (`app/orders/page.tsx`). 43 suites citent `orders`, `order_items`,
`products`, `product_options`, `order_delivery_zones` ou `partner_couriers` : toutes dans les runs rapides des lots
qui changent une règle de ces tables.

---

## 7. Points déjà notés à reprendre

### 7.1 `docs/apres-lancement.md`

| Ligne | Point | Lot proposé |
|---|---|---|
| 158 | Écrans des commandes (panier, devis, paiement, suivi, partenaire, livreur, réglementés dans l'administration) | 12b, 12c, 12d |
| 159 | `/partner/orders` et `usePartnerOrders` : plus de temps réel, relecture périodique | 12c |
| 160 | Produits avec établissement, options, case « réglementé » | 12c |
| 161 | Zones de livraison sur une carte | hors lot (question Q13) |
| 162 | Livraison ratée : rien d'automatique | 12d si le client tranche (Q2) |
| 163 | Code visible dans l'application | 12b |
| 164 | Produits « à vérifier » par mots-clés | 12c |
| 166 | Signalement d'un problème après la préparation | 12d si le client le veut (Q9) |
| 167 | Invitation d'un livreur : essais sur des numéros sans compte | 12c (limite si l'abus apparaît) |
| 151 | « Commandes » hors de la barre du bas (design 1e) | question Q10 |
| 37 | Écritures d'une fiche SUSPENDU pour les commandes | tranché au 12a (lecture seule) : rien à faire |
| 95 | Badges en capitales de l'ancien `StatusBadge` sur les pages partenaire des commandes et produits | 12c (pages refaites) |
| 25 | Purge des images orphelines du dossier des produits | 12c si l'archivage remplace la suppression, sinon plus tard |
| 189 | Pages `/orders/<id>`, `/partner/orders/<id>`, `/courier/…` avec `UnavailableItem` | 12b, 12c, 12d |
| 140, 212 | Valeurs d'origine des réglages recopiées par plusieurs lots (`tables.reminder_hours`, réglages des tables d'un événement hors `finance_setting_set`) | « lot de réglages » : si le 12c recopie `platform_settings_defaults`, il peut aligner `tables.reminder_hours` (2 h) au passage, avec accord |

### 7.2 Petit lot de suivi des tables (`20261220…`)

Contexte : contre-vérification du 11c-b, T2 (`docs/audit-lot11c-b.md:83-104` sur `origin/lot11c/tables-client`) : un
titulaire qui a envoyé toutes ses places n'a plus de billet de la table. Les correctifs du 11c-b rendent « Ma table »
atteignable d'après les ventes et font mener l'avis du report vers les billets de l'événement ; mais l'avis du report
lui-même part aux **détenteurs de billets** (`event_change_notify`, appelé par `event_update`,
`M/20261201000007_l11c_cv_correctifs.sql:808`) : un titulaire sans billet ne le reçoit pas, alors que le remboursement de
toute la table lui est ouvert (`event_table_postponement_refund`, `M/20261201000007:893`). À faire : ajouter les
titulaires de tables actives aux destinataires (une fois par compte, même plafond SMS), lien vers
`/tickets?tab=tables`. Recopies : `event_change_notify` (dernière définition `M/20261121000006_cvf2b_plafond_heure_glissante.sql`)
et le comptage `event_notice_recipient_count` si l'aperçu du nombre de destinataires doit l'inclure. Argent : non (le
remboursement existe) ; données : numéros des titulaires ; contre-vérification légère. **Indépendant des lots 12** ; à
appliquer avant leurs migrations.

### 7.3 Lot poids 2

Pistes notées : modules en double entre le layout et la page, ~1 900 (`/explore`) à ~3 300 (`/tickets`) octets gzip par
route (`docs/lot-poids-rapport.md:215-222`) ; scanner +890 octets après le 11c-c (`docs/apres-lancement.md:226`) ;
fiche +777 et Explorer +580 après le 11c-b, par le découpage d'un morceau partagé (rapport 11c-b). Marges actuelles
(run 718) : `/` 11 225, fiche 9 522, Mes billets 10 630, scanner 9 067, billet hors ligne 10 153, Explorer 10 085 octets
(`docs/lot11c-c-rapport.md:521-531`, avant la fusion du 11c-b). Aucune migration ; utile **avant le 12e** (accueil,
Explorer) et avant toute entrée ajoutée à la coquille (12b/12d).

---

## 8. Questions au client

Mots simples, une recommandation pour chacune. Les numéros sont repris dans les sections ci-dessus.

| # | Question | Ma recommandation |
|---|---|---|
| Q1 | Un restaurant a combien de temps pour accepter une commande avant qu'elle soit annulée et le client remboursé ? (15 minutes aujourd'hui, « à confirmer ») | **15 minutes**, réglable plus tard par Event Village. |
| Q2 | Le livreur arrive, le client ne répond pas : que se passe-t-il ? | Le livreur touche « Client absent » après deux appels ; la commande attend 30 minutes un nouvel essai ; ensuite **Event Village décide** (rembourser ou non) depuis l'administration. Rien d'automatique sur l'argent. |
| Q3 | Où le client commande-t-il ? | Un bouton **« Commander »** sur la page de l'établissement et sur la carte, qui ouvre la **carte des plats** de cet établissement, même si la réservation de tables est fermée (une boutique n'a pas de tables). |
| Q4 | Les clients doivent-ils pouvoir commander pour plus tard (jusqu'à 7 jours) ou seulement « dès que possible » au lancement ? | Les deux, comme prévu au 12a ; « dès que possible » choisi par défaut. |
| Q5 | Liste des mots qui mettent un produit « à vérifier » (bière, vin, whisky, liqueur, cigarette, chicha…) : en ajoute-t-on ? Et si l'équipe ne vérifie pas vite ? | Liste modifiable par Event Village ; le produit reste **non vendable** tant qu'il n'est pas vérifié ; l'équipe est prévenue à chaque produit. |
| Q6 | Acompte : un pourcentage seulement, ou aussi un montant fixe (le cahier dit les deux) ? | **Pourcentage seulement** au lancement ; montant fixe plus tard si un restaurant le demande. |
| Q7 | Un produit déjà vendu peut-il être supprimé ? | Non : il est **archivé** (disparaît de la carte, reste dans l'historique des commandes). |
| Q8 | Le livreur peut-il encaisser le reste à payer en espèces ? | Oui, il confirme « solde reçu » dans l'application ; l'argent va au restaurant, il n'entre pas dans Event Village. |
| Q9 | Après le début de la préparation, le client peut-il signaler un problème (commande en retard, erreur) ? | Oui, un bouton **« Signaler un problème »** qui prévient l'équipe ; aucun remboursement automatique. |
| Q10 | « Commandes » doit-il revenir dans la barre du bas du téléphone ? | Non au lancement : accès par « Commander » sur les établissements et par le menu ; on revoit après les premiers chiffres. |
| Q11 | Quels chiffres pour le restaurant ? | Ceux du cahier : commandes, ventes, panier moyen, plats les plus vendus, livraisons, annulations, en séparant **payé en ligne** et **payé sur place**, sur 7 et 30 jours. |
| Q12 | Montrer les plats du jour sur l'accueil ? | Oui, une section « Plats du jour » seulement s'il y en a, chargée quand on y arrive (pour garder l'accueil rapide). |
| Q13 | Zones de livraison : liste de quartiers ou zone dessinée sur une carte ? | **Liste de quartiers** avec frais et minimum (déjà prévu) ; la carte plus tard. |
| Q14 | Commande sur place : le client choisit sa table dans une liste, ou scanne un QR posé sur la table ? | **Liste** au lancement ; QR de table plus tard. |
| Q15 | Le restaurant doit-il entendre un son à chaque nouvelle commande quand la page est ouverte ? | Oui : son et vibration sur la page des commandes ouverte, plus l'avis déjà prévu (SMS, notification). |
| Q16 | Une livraison faite par le restaurant lui-même, sans livreur invité, est-elle permise ? | Oui (décision 9 du 21/11) : rien à changer, à confirmer seulement. |

## 9. Ce qui n'a pas été vérifié

- Le comportement à l'exécution : aucune base locale, aucun test lancé (consigne).
- Les migrations réellement appliquées sur event-village-dev après le 25/11 (dernière connue : `20261201000007`).
- Le contenu final du lot 11c-b une fois fusionné dans `main` (lu sur sa branche seulement).
