# Design 1c — Espace organisatrice et administration

Branche `design-1c/pro`, partie de `main` à `fce22b609` (lot 11a fusionné). Aucune migration. Les modèles de messages
(finition 4) et les écrans des salles (lot 10b) ne sont pas touchés. Les alias des anciens noms de couleur sont gardés.
Non fusionné.

## En bref

**État final : run complet 444 (`0865e4aec`) vert.** Tests 536/536, e2e (635 captures, fumée, terrain, recette), mesures mobiles (accueil 91, fiche 93, Mes billets 90, toucher 96 ms), budgets JavaScript tenus sans relèvement, contrôle responsive à 0 défaut sur 124 résultats.

- **Contrôle responsive en CI** (nouveau) : 62 pages × 6 largeurs (320, 360, 390, 768, 1024, 1440 px), en clair et en
  sombre, plus le scanner en paysage. Le premier passage (run 434, avant les corrections) relevait 484 défauts
  bloquants ; il n'en reste aucun.
- **Organisatrice** : toutes les pages à la charte, chiffres du tableau de bord animés une fois, création en 5 étapes
  nommées, textes justes (retraits, « Recettes nettes », caisse, email, 24 h, statistiques, activités).
- **Scanner** : sa mise en page à lui, disposition en paysage, vibrations distinctes « validé » et « refusé », budget
  JavaScript tenu.
- **Administration** : toutes les pages à la charte (zéro couleur en dur), « super-administrateur » partout, nouvelle
  fenêtre « Changer le rôle ».
- **Paiement** : logos Wave et Orange Money optimisés, sur l'écran de paiement et sur la fiche (« Payer avec »).
- **Budgets JavaScript non relevés**, aucune animation en boucle, aucun mot technique (garde-fous verts).

## 1. Responsive

**Contrôle** : `e2e/responsive.spec.ts`, pages dans `e2e/support/responsive-pages.ts`, règles dans
`e2e/support/responsive-checks.ts`. Chaque page est rechargée à chaque largeur. Bloquants :
- défilement horizontal de la page ;
- texte hors de l'écran, coupé par son conteneur, ou tronqué (points de suspension, lignes limitées) sans le texte
  entier à côté ;
- textes qui se chevauchent (dans la même couche : une barre fixe passe au-dessus du contenu, c'est voulu) ;
- tableau visible jusqu'à 390 px (des cartes sont attendues) ;
- cibles de moins de 44 px, textes de moins de 14 px hors mentions, mots techniques (contrôles communs des captures).

**Pages** : 20 publiques et espace client, 23 de l'organisatrice (dont les 8 onglets du pilotage), 15 de
l'administration, 4 du scanner (départ et caméra en marche, en portrait et en paysage 640 × 360 et 844 × 390).
Exclusions déclarées, vérifiées par `tests/schema/design1c-responsive` (toute route de `app/` est contrôlée ou exclue
avec sa raison) : salles, tables, menus, produits et commandes (lot 10b) ; redirections ; liens à jeton à usage unique ;
vitrine interne du design.

**CI** : job `responsive` à part, parce que l'e2e prend déjà ≈ 38 min de ses 47. Il reprend les étapes de l'e2e
(ancres YAML), puis les seules phases « connexion » et « responsive » (`EV_E2E_PHASES`, environ 10 min avec 3
navigateurs). Il est requis par le verdict au run complet. Pendant le travail, une ligne `ci-responsive: oui` le lance
aussi en mode rapide.

**Captures** : 360, 768 et 1440 px, en clair et en sombre, plus le paysage du scanner : JPEG dans
`ci-results/runs/<n>/captures-responsive/` (380 fichiers au run 444). Résumé par page et par
taille : `responsive.tsv` et `responsive.txt`.

| Run | État | Défauts bloquants |
|---|---|---|
| 434 | départ (main + contrôle seul) | 484 : public 74, organisatrice 213, administration 197, scanner 0 |
| 439 | toutes les corrections | 0 ; 2 arrêts du test « scanner démarré » (voir plus bas) |
| 444 | run complet | 0 défaut, 124 résultats (566 contrôles taille × thème) |

**Causes principales du run 434, corrigées** :
- **En-tête commun** : à 768 px, « Event Village » passait sous la recherche (le logo rétrécissait) ; nom du compte,
  rôle et entrées du menu tronqués. La recherche dit maintenant « Rechercher un événement… » (plus « restaurant »,
  service fermé : constat G-48).
- **`DataList`** : tableau affiché dès 768 px dans une boîte qui masquait son débordement, d'où des colonnes entières
  coupées à 768 et 1 024 px. Désormais des cartes jusqu'à `lg` (`xl` pour les tableaux larges des pages à menu
  latéral), des cellules qui passent à la ligne, et un tableau trop large qui défile dans sa boîte, jamais la page.
- **Cartes d'événement, billet, vignette** : titre, date, lieu et organisateur entiers (retour à la ligne).
- **Fiche** : sous 390 px, le grand bouton passe sous le montant (19 px gras, jamais plus petit).
- **Administration** : textes de 10 à 12 px, emails qui débordaient à 320 px, journal en tableau.
- **Organisatrice** : activité récente tronquée, tableaux de la caisse et des ventes.
- **Composants** : badge d'état tronqué, bulle de la carte qui sortait du cadre à 320 px.
- **Faux défauts levés** : les sections de l'accueil hors écran (`content-visibility: auto`) n'ont pas de mise en
  page ; le contrôle les rend le temps de la mesure.

## 2. Organisatrice

- **Pages** : tableau de bord, mes événements, création et modification, pilotage (8 onglets), équipe, caisse,
  finances, portefeuille, statistiques et calendrier (couleurs en dur réécrites aux jetons, calendrier en liste du mois
  sur téléphone), profil, abonnement, inscription, scanner de l'organisatrice.
- **Chiffres qui s'animent une fois** : les quatre indicateurs du tableau de bord comptent de 0 à la valeur en 700 ms,
  une seule fois. Rien ne bouge si le téléphone demande de réduire les animations. La valeur réelle est lue par les
  lecteurs d'écran, et sa place est réservée (aucun saut).
- **Création** : « Étape n sur 5 — {titre} », pastilles numérotées (faite, en cours), un seul grand bouton en dégradé,
  sur « Envoyer pour validation ».
- **Textes** :
  - retraits (finances et portefeuille) : « Montant envoyé : … » ; « Versé le … » seulement pour un retrait versé ;
  - « Recettes nettes » est le seul nom du net. Le détail est toujours brut → remboursements → net, sans double
    déduction, à l'écran et dans le PDF de clôture (l'ancien `revenue.online` du rapport était déjà net : G-26) ;
  - caisse : « Récapitulatif de caisse » au lieu de « Z » ; écart en mots (« Il manque 2 000 F CFA »,
    « 2 000 F CFA de trop », « Aucun écart ») ; PIN de 6 chiffres ;
  - email « obligatoire » à l'inscription et au profil (« Vos confirmations et rapports y arrivent. ») ;
  - « Les retraits sont bloqués 24 h après un changement de numéro. », annoncé avant de valider le changement ;
  - lien « Statistiques de ventes » masqué tant qu'il n'y a aucune vente ;
  - activités à l'inscription : organisateur d'abord, services fermés (dont « Restaurant ») en dernier.

## 3. Scanner

- **Mise en page à lui** (`app/controller/layout.tsx`) : ni en-tête ni barre du bas de l'application, sombre forcé.
- **Paysage** : caméra à gauche, commandes à droite ; le carré de la caméra est limité à la hauteur de l'écran (rien à
  faire défiler pour viser).
- **Vibrations** : 60 ms pour « validé » ; trois impulsions (420 ms) pour un refus ; rien pour un incident technique.
- **Budget** `/controller/scanner` inchangé (234 911 octets) : 231 751 octets au run 444 (231 683 avant).

## 4. Administration

- **Toutes les pages aux jetons de la charte**, dont comptes, journal et parrainage, réécrits entièrement (plus aucune
  couleur en dur ni ancien nom dans `app/admin` et `components/admin`) ; pas de grand bouton en dégradé.
- **« Super-administrateur »** dans les libellés, les écrans et les refus des routes de l'administration. Le glossaire
  et le guide suivent.
- **Fenêtre « Changer le rôle »** : titre en question, quatre rôles en cartes avec une phrase chacun, qui est prévenu
  (SMS d'alerte à chaque super-administrateur), « Passer en … » et « Garder le rôle actuel ». Nouvelle capture
  `admin-changer-role`.
- **Plus aucun identifiant brut** : finance (« Réf. interne … » pour un paiement sans référence SamirPay ; l'exception
  du design 1b est retirée) et journal (données techniques repliées).

## 5. Paiement

- **Fichiers** : logos du client gardés tels quels dans `docs/design/paiement/` (empreintes SHA-256 vérifiées).
  Réduits à 128 × 128 et réencodés en WebP : Wave 465 Ko → 6,0 Ko, Orange Money 15 Ko → 3,0 Ko. Jamais recadrés ni
  recolorés : le test compare chaque pixel à la source réduite.
- **Affichage** : sur une pastille blanche dans les deux thèmes (nouveau jeton `op-logo`, le cadre blanc d'Orange Money
  reste propre en sombre), nom toujours écrit à côté. Fenêtre de paiement, suivi du paiement (« Opérateur »), fiche
  (« Payer avec »), choix de l'opérateur de retrait.

## Poids JavaScript (gzip, budgets non relevés)

| Route | Avant (run 431 de main) | Après (run 444) | Budget |
|---|---|---|---|
| `/` | 220 320 | 220 320 | 226 342 |
| `/events/[id]` | 229 669 | 229 797 | 233 316 |
| `/tickets` | 242 902 | 242 883 | 250 417 |
| `/controller/scanner` | 231 683 | 231 751 | 234 911 |
| `/billet/hors-ligne` | 222 006 | 222 006 | 224 268 |

Mesures mobiles au run 444 (seuils inchangés, médiane de 5 passages) : accueil 91 (LCP 1,81 s, CLS 0,053), fiche 93, Mes billets 90 ; toucher 96 ms.

## Runs

| Run | Commit | Mode | Résultat |
|---|---|---|---|
| 434 | `d005db649` | rapide + responsive | rapide vert ; responsive rouge : 484 défauts (état de départ) |
| 435 | `610ebb0e9` | rapide | vert |
| 439 | `0de0ee8c0` | rapide + responsive | rapide vert ; responsive : 0 défaut, 2 arrêts du « scanner démarré » |
| 441 | `5fe5d5d89` | complet | **rouge** : tests 532/536, 23 captures, responsive arrêté (voir plus bas) ; budgets JS et mesures verts |
| 444 | `0865e4aec` | complet | **vert** : tests 536/536, e2e, mesures, budgets JS, responsive 0 défaut |

**Run complet 441, rouge, corrigé au run 444.**
- **Quatre suites** : des contrôles statiques que le poste local ne lance pas, parce que la suite entière exige la base.
  Elles sont adaptées à exigence égale (section « Tests »), et les lignes citées par la recette sont recalées.
- **16 captures de la création et de l'édition, sur téléphone** : le trait qui relie deux pastilles passait au-dessus
  de la pastille précédente et interceptait le toucher. Il passe désormais derrière et ne reçoit plus le toucher.
- **6 captures des fiches d'événement de l'administration** : la boîte de `DataList` qui peut défiler n'était pas
  atteignable au clavier (axe `scrollable-region-focusable`). Elle devient une zone nommée et focalisable.
- **Fiche « en cours », ordinateur clair : erreur d'hydratation React n° 418.** Elle existe aussi au run 437 de
  finition-4, qui ne contient pas le design 1c : c'est un défaut intermittent antérieur, absent du run 444. Cause
  probable : la fiche est servie depuis un cache de 60 s alors que l'état de la billetterie dépend de l'heure. À
  traiter à part.
- **Job responsive** : arrêté par une panne réseau d'Ubuntu pendant l'installation de Chromium, avant tout contrôle.

**Arrêts du run 439.** La page est rechargée à chaque largeur, et le scanner reprend le contrôle déjà démarré (reprise
du lot 7, A10). L'écran de départ n'apparaissait donc qu'au premier chargement. Le test accepte désormais les deux états
et touche « Reprendre le contrôle » s'il est proposé. Aucune règle du contrôle n'a changé.

## Décisions à relire

1. **PIN régisseur** : le serveur ne génère que des codes de 6 chiffres mais en acceptait de 4 à 8 à la saisie. La
   règle passe à 6 chiffres. Aucun test ni seed n'emploie une autre longueur.
2. **Email du profil de l'organisatrice** : obligatoire à l'inscription, il pouvait être vidé au profil. Un email vidé
   est maintenant refusé.
3. **Retrait refusé ou annulé** : « Montant prévu : … », puisque rien n'est parti.
4. **Création sur téléphone** : la règle de la finition 2b (nom de chaque étape visible) ne tient pas à 320 px avec des
   cases de 44 px. Seul le nom de l'étape courante est écrit en toutes lettres, sous « Étape n sur 5 » ; tous les noms à
   partir de 640 px.
5. **`DataList`** : cartes jusqu'à `lg` partout par défaut (avant : `md`).
6. **Message des 24 h** : il s'affiche aussi pour un client qui change de numéro ; c'est vrai pour les retraits du
   parrainage.

## Points ouverts (hors de ce lot)

- **Modèles de messages qui disent encore « Superadmin »** (`lib/notifications/catalog.ts`, finition 4) : alerte
  « Nouveau Superadmin », code de secours utilisé, numéro changé, code du numéro administrateur (« Donnez-le seulement
  au Superadmin »). Le SMS d'écart de caisse dit encore « +2 500 F ».
- **Message renvoyé par la base** : « Seul un SUPERADMIN actif modifie les réglages de la plateforme. »
  (`20261123000101_l11a_reglages.sql`). Le changer demande une migration.
- **Mes événements** : le brut et les remboursements ne sont pas servis par `partner_events_overview` ; seules les
  « Recettes nettes » s'affichent. Il faut une migration.
- **Journal** : les données avant/après restent en JSON, repliées sous « Détail technique » (pas de libellés par champ).
- **Poste Windows** : 6 tests de `tests/schema/f3b-ecrans` échouent en local (`import()` d'un chemin Windows) ; ils
  passent sous Linux en CI.

## Tests

- **Nouveaux** : `tests/schema/design1c-responsive`, `design1c-paiement`, `design1c-scanner`,
  `design1c-organisatrice`, `design1c-administration` ; capture e2e `admin-changer-role`.
- **Modifiés (signalés)** :
  - `design1b-fiche` : place réservée sous la barre d'achat, plus haute sous 390 px ;
  - `design-jetons` : jeton `op-logo` ajouté à la liste comparée ;
  - `f3b-ecrans` 6 bis : la règle s'inverse, « super-administrateur » est exigé ;
  - `f3d-ecrans`, `f3d-telephone`, `argent9ter-non-verse`, `droits-admin-9bis`, recette acte 1 : nouveau mot dans les
    textes attendus ;
  - `admin-audit-lot9` : le témoin exige maintenant qu'aucun identifiant ne soit affiché ;
  - `design-systeme` : journal 4 → 3 éléments en police à chasse fixe (cellule d'identifiant retirée) ;
  - `terrain` : écart dit en mots ; recette acte 5 : nom de l'étape ;
  - `screens` : retrait retardé (« Montant envoyé », aucun « Versé »), exception des identifiants bruts retirée ;
  - `lot9quater-argent` : composant renommé `CashSummaryModal` ;
  - `email-verification` : « Vos confirmations et rapports y arrivent. » ;
  - `f2b-telephone` : décision 4 ci-dessus ;
  - `admin-audit` (run 441) : le journal est une `DataList` ; les colonnes se lisent dans `header: '…'` et non plus dans
    `<th>`, la colonne de l'utilisateur s'appelle « Auteur » (le nom, jamais l'identifiant), la liste vide dit « Aucune
    entrée » et l'heure passe par `formatDateTime` ;
  - `lot9quater-droits` (run 441) : « Suspendre » et « Supprimer » partagent un bloc sous `!isPartner` ; le motif
    accepte le fragment, l'exigence ne change pas ;
  - `partenaire-profil-rpc` (run 441) : l'email ne se vide plus (décision 2) ; un test prouve le refus pour `null`, une
    chaîne vide et des espaces, sans aucune écriture ;
  - `docs/recette-billetterie.md` : lignes citées recalées (`recette-matrice`).
