# Design 1b — Pages publiques

Branche `design-1b/public`, partie de `main` à `28ef60f07` (design 1a fusionné), avec `main` fusionné ensuite (`7b1284dfc`). Non fusionnée. Une seule migration, celle de « À la une » (`20261122000001_d1b_a_la_une.sql`), **non appliquée** sur event-village-dev. Ni la finance ni les salles ne sont touchées.

## En bref

**État au run 376 : rouge, je m'arrête ici.**
- Ce qui passe : tous les tests (504 suites), les budgets JS, les captures et le toucher.
- Ce qui reste rouge, et demande une décision :
  1. Lighthouse mobile ≥ 90 et LCP < 2,5 s ne sont pas tenus sur l'accueil et la fiche ; sur « Mes billets », seul le score manque (voir « Mesures de performance ») ;
  2. après l'annulation d'un événement, sa fiche en cache montre l'avis jusqu'à 60 s plus tard (recette, acte 7) ;
  3. l'ancienne mesure du scanner : 261 Ko de JavaScript avant l'affichage utile, pour un plafond de 255 Ko.

- **Performance mesurée en CI.** Une nouvelle étape bloquante du job e2e mesure Lighthouse mobile, LCP, CLS et le toucher. Mesures avant / après plus bas.
- **Pages publiques préparées par le serveur.**
  - L'accueil est statique et revalidé toutes les 60 s.
  - La fiche est pré-rendue à la demande et revalidée toutes les 60 s.
  - Explorer lit un catalogue gardé en cache 60 s.
  - Rien de personnel n'entre dans le HTML en cache.
- **JavaScript en baisse**, budgets non relevés : voir le tableau des poids.
- **Garde-fou des mots** : un test sur le code et les modèles de messages, et un contrôle de chaque écran capturé.
- **Décisions à relire** : section « Décisions ».

## Ce qui est fait

### 1. Performance
- **Mesure en CI** (`scripts/e2e/perf-mobile.mjs`, étape `perf-mobile` du job e2e, bloquante) :
  - Lighthouse 13.6.0, préréglage mobile (4G lente simulée, processeur ×4), 3 passages par page sur l'accueil, la fiche et « Mes billets » connecté ;
  - médiane du score (≥ 90), du LCP (< 2,5 s) et du CLS (< 0,1) ;
  - CLS réel mesuré dans le navigateur ;
  - toucher sur une puce de l'accueil et un onglet de Mes billets (< 200 ms).
  - Résultats : `runs/<n>/perf/lighthouse.txt` et `.tsv`.
- **Rendu côté serveur.**
  - Accueil : composant serveur (`revalidate = 60`).
  - Fiche : pré-rendue à la demande (`revalidate = 60`). Le vrai 404 est gardé.
  - Explorer : rendu à chaque requête selon les filtres, catalogue gardé 60 s.
- **Îlots personnels chargés après la page** : ville du visiteur, session, panier, paiement en attente.
- **Images.**
  - `priority` seulement sur l'image principale.
  - `sizes` réglés.
  - Place réservée partout.
  - Carte du lieu chargée au toucher.
- **Liens** préchargés par `next/link`. **Une seule police.**
- **Mise à jour immédiate** des filtres d'Explorer (même règle que le serveur), puis données du serveur.

### 2. Garde-fou des mots
- **`tests/schema/design1b-mots`** :
  - chaque modèle de message (chaque type × chaque canal, avec son exemple), les SMS synchrones et les emails de compte ;
  - le texte affiché de tous les écrans (texte JSX, attributs lus, toasts) ;
  - jamais un message ou un code d'erreur brut rendu.
- **`e2e/support/checks.ts`** : le même motif s'applique à chaque texte visible de tous les écrans capturés (390 et 1 440 px, clair et sombre). Les mots refusés :
  - RPC, API, token, null, undefined, NaN ;
  - UUID et identifiants bruts ;
  - « erreur 500 », « HTTP 500 », « Failed to fetch »… ;
  - les statuts en capitales.
- **Corrigé** :
  - « Erreur 404 » sur la fiche, retiré par la réécriture de la fiche ;
  - « Envoyé par Un utilisateur » (Mes billets) ;
  - « FCFA » dans le billet PDF ;
  - toute coupure réseau d'un toast (« Failed to fetch »), remplacée par une phrase.
- **Relu** : 329 rendus de modèles de messages et 246 fichiers d'écran, plus de 13 500 textes : aucune faute.
- **Exceptions déclarées**, à reprendre ailleurs, hors du design 1b : identifiants bruts affichés sur trois écrans de la finance de l'administration (lot exclu par la consigne) et sur la page de développement.

### 3. Accueil et « À la une »
- **Sections, dans l'ordre :**
  1. accroche et recherche ;
  2. « En ce moment », seulement s'il y en a ;
  3. « À la une » : défilement au doigt en CSS seul, première carte plus grande ;
  4. cette semaine ;
  5. gratuits ;
  6. par catégorie ;
  7. près de chez vous (îlot du visiteur) ;
  8. comment ça marche ;
  9. parrainage, avec les taux réels de `referral_config` (pas de bloc sans ligne active) ;
  10. organisateurs, avec le seul grand bouton en dégradé de la page.
- **Retiré** : « Billetterie officielle au Sénégal », promesse non prouvée.
- **« À la une »**, choisi par le Superadmin : page `/admin/a-la-une`.
  - Actions : ajouter, monter et descendre, dates d'affichage, motif obligatoire, retirer avec confirmation, journal.
  - Seuls des événements publiés et à venir.
  - Retrait automatique à l'annulation, à la suspension et à la fin (trigger, plus exclusion à la lecture).
  - Étiquette « À la une » ; le champ « Sponsorisé » est prévu mais fermé à la saisie.
  - Sans choix : les plus vendus de la semaine.
- **Base** : table `home_featured`.
  - RLS sans politique, aucune écriture directe.
  - Fonctions SECURITY DEFINER qui revérifient le Superadmin et son identité récente.
  - Lecture publique sans auteur ni motif, réservée au serveur.

### 4. Cartes d'événement
- **Contenu** : affiche, date en pastille, « Gratuit », « Gratuit ou dès … », « Dès … ».
- **« Dernières places »** quand il reste au plus 10 % de la jauge en ligne.
- **Transition carte → fiche** par l'API View Transitions du navigateur, sans bibliothèque. Coupée si « réduire les animations ».

### 5. Explorer
- **Filtres** :
  - date : aujourd'hui, ce week-end, cette semaine ;
  - catégorie, gratuit, ville ;
  - tri par prix.
- **Fonctionnement** : filtres dans l'adresse, pagination par « Voir plus » (un lien qui marche aussi sans JavaScript).
- **Bouton Liste / Carte** prévu mais masqué jusqu'à la carte réelle.

### 6. Fiche
- **Contenu** : affiche en grand, trois lignes d'infos, programme, catégories en cartes avec la couleur de leur catégorie au scanner.
- **Petite carte** avec le nom de l'événement sur le repère.
- **Barre d'achat fixe** sur téléphone dès l'ouverture.
- **Ligne « Remboursement »** seulement quand une règle vraie s'applique (annulation, report de plus de 24 h).

### 7. Achat et paiement
- **Fenêtre d'achat** :
  - Wave et Orange Money en grands boutons à leurs couleurs, rien de présélectionné ;
  - numéro prérempli ;
  - récapitulatif, frais compris, avant l'unique bouton « Payer ».
- **Bandeau de paiement en attente** :
  - il reste tant que le serveur bloque un nouvel achat ;
  - « Suivre le paiement » et « Annuler ce paiement », avec confirmation ;
  - les cas 409 et 503 dits en mots simples.
- **Après la réussite** : retour à « Mes billets » avec la petite fête.

### 8. Mes billets
- **Façon Wallet** :
  - couleur de la catégorie, bord perforé ;
  - glisser d'un billet à l'autre, avec boutons et clavier ;
  - compte à rebours.
- **QR en grand** sur fond blanc, écran gardé allumé quand le navigateur le permet. Une page web ne peut pas régler la luminosité du téléphone : le texte invite à la monter.
- **« Disponible sans réseau »** seulement quand le lot hors ligne est vraiment prêt.
- **Petite fête après l'achat**, annoncée par « Vos billets sont là. ».
- **« Mes paiements »** : « Remboursement en cours » dès qu'un billet est en remboursement.
- **Transfert** : « Prévenir par WhatsApp » vers le numéro du destinataire, avec l'adresse du site et la vraie échéance.
- **Liens des avis** vers le bon onglet.
- **Mots justes** : « Envoyé par Un utilisateur » corrigé, « F CFA » dans le PDF.

### 9. Profil
- **Mise en page** : sections en cartes.
- **Réabonnement automatique** : un téléphone dont la permission de notification est déjà accordée se réabonne seul à la reconnexion, après « Déconnecter tous mes appareils », sauf si les notifications de cet appareil ont été désactivées.

### 10. Animations
- **Mouvements** :
  - entrées de page, listes en cascade, pression au toucher ;
  - indicateur d'onglet qui glisse ;
  - fenêtres et feuilles qui montent ;
  - toasts.
- **Règles** : 150 à 300 ms, déplacement et transparence seulement, jamais bloquantes. Tout est coupé si « réduire les animations ».

### 11. « En cours »
- **Règle** : entre le début et la fin retenue (`event_end_at`, la même que la vente et le scanner), calculée sur le téléphone. Le badge change à la bonne minute, page ouverte, et reste juste malgré le cache de 60 s.
- **Où il apparaît** :
  - badge au point qui pulse sur les cartes (fixe si « réduire les animations ») ;
  - rangée « En ce moment » ;
  - « En cours · se termine vers … » sur la fiche.
- **Achat** : seulement si la vente en ligne est ouverte, sinon « Billets au guichet sur place » s'il y en a.
- **Test** : début 22:00 sans fin, et 22:00 → 05:00.

## Mesures de performance, avant / après

Mesures de `scripts/e2e/perf-mobile.mjs`, par Lighthouse 13.6.0, préréglage mobile : 4G lente simulée, processeur ×4, médiane de 3 passages. « Avant » : `main` sans le design 1b (run 370). « Après » : la branche (run 376).

| Page | Score avant | Score après | LCP avant | LCP après | CLS (après) | Seuils |
|---|---|---|---|---|---|---|
| Accueil | 96 | 86 | 0,91 s | 2,61 s | 0,000 (réel 0,052) | ≥ 90 ; < 2,5 s ; < 0,1 |
| Fiche | 85 | 85 | 4,33 s | 3,06 s | 0,000 (réel 0,098) | idem |
| Mes billets | 73 | 85 | 5,49 s | 0,99 s | 0,000 | idem |
| Toucher (le plus long) | 96 ms | 120 ms | | | | < 200 ms |

**Pourquoi l'accueil recule.** Avant, l'élément du LCP était le titre, un simple texte. C'est maintenant l'affiche de la première carte « À la une », plus grande.

**Ce qui borne encore les trois pages.**
- **En mesure réelle, le LCP est court** : la réponse du serveur, l'attente et le chargement de l'affiche prennent moins de 200 ms.
- **En simulation, il dépasse 2,5 s**, pour deux raisons :
  - le serveur de la CI (`next start`) sert la page en **HTTP/1.1**, que Lighthouse simule avec 6 connexions ;
  - chaque page charge **27 à 38 fichiers JavaScript** (311 à 391 Ko transférés), et l'affiche passe après eux.
- **Le temps de blocage** (TBT) est de 384 à 588 ms : c'est l'hydratation de React.

**Gains déjà faits** :
- pages préparées par le serveur ;
- `fetchpriority="high"` sur l'image principale ;
- CSS écrit dans la page (deux feuilles bloquaient l'affichage, environ 300 ms chacune) ;
- QR des billets mémoïsé ;
- îlots chargés à la demande.

**Pistes, à décider** :
1. Mesurer en **HTTP/2**, comme la production : un petit relais TLS devant `next start` dans la CI.
2. **Regrouper les morceaux JavaScript** (réglage de `splitChunks`) et réduire l'hydratation des pages publiques (moins d'îlots).
3. Ou **ajuster les seuils** à ce que mesure ce serveur.

## Poids JavaScript (gzip, budgets non relevés)

| Route | Avant (run 363 de `main`) | Après (mesure locale) | Après (CI, run complet) | Budget |
|---|---|---|---|---|
| `/` | 225 297 | 219 123 | 219 332 | 226 342 |
| `/events/[id]` | 231 939 | 228 879 | 229 085 | 233 316 |
| `/tickets` | 249 629 | 247 176 | 247 410 | 250 417 |
| `/controller/scanner` | 231 707 | 231 116 | 231 334 | 234 911 |
| `/billet/hors-ligne` | 221 127 | 221 604 | 221 707 | 224 268 |

## Captures

Run 376 : 664 captures dans `ci-results`, `runs/376-44282916087/captures/`, chaque écran à 390 et 1 440 px, en clair et en sombre :
- `accueil` ;
- `explorer-semaine-gratuits`, `explorer-concerts` ;
- `evenement-publie`, `fiche-en-cours` ;
- `paiement-modale`, `fiche-paiement-en-attente` ;
- `mes-billets`, `mes-billets-qr-grand`, `mes-billets-fete` ;
- `mes-paiements` ;
- `profil` ;
- `admin-a-la-une`.

## Runs

| Run | Commit | Mode | Résultat |
|---|---|---|---|
| 370 | `eee134623` | complet, branche jetable : `main` + mesure seule | **mesure « avant »** (le run est rouge par construction) |
| 372 | `4cfcfb25b` | rapide, 85 suites | 82/85 ; corrigé |
| 373 | `407d217a0` | complet | 5 suites, 41 échecs e2e, mesure rouge ; corrigé |
| 374 | `1607c1616` | complet | 2 suites, 5 échecs e2e, mesure rouge ; corrigé |
| 376 | `bef65f021` | complet | **tests 504/504**, budgets JS tenus, captures vertes, toucher OK ; restent les seuils Lighthouse et LCP, l'acte 7 de la recette et l'ancienne mesure du scanner |

**Sur `main`, en chemin.**
- Les runs 367 et 371, après la fusion du design 1a, étaient rouges sur l'e2e.
- Les correctifs `7b1284dfc` et `c011e2cb8` les règlent :
  - chargements à la demande hors ligne ;
  - panneau d'onglet ;
  - captures du design 1a ;
  - transitions à 0 s quand l'appareil demande de réduire les animations.
- Cette dernière cause, trouvée en reproduisant le test « terrain 9 » en local : la règle à 0,01 ms rendait toute modification de style transitionnée.
- **Le run complet 375 de `main` est vert.**

## Décisions à relire

1. **Seuil « Dernières places »** : il reste au plus 10 % de la jauge en ligne (au moins 1). L'ancien seuil absolu de 10 places n'est plus lu par les cartes. La graine de démonstration vend désormais 18 places sur 20.
2. **Explorer** :
   - « Ce week-end » va du vendredi 18:00 au lundi 00:00 ;
   - « Cette semaine » couvre 7 jours glissants ;
   - le tri par prix est ajouté.
3. **« À la une »** :
   - « Sponsorisé » est prévu en base mais refusé à la saisie ;
   - le mot de passe et le code administrateur de moins de 10 minutes sont exigés à chaque écriture ;
   - la lecture publique est réservée au serveur.

   L'ancien système (`is_featured`, `sponsored_promotions`) n'est plus lu par aucune page : il est obsolète, à retirer dans un lot à part. Migration `20261122000001` **non appliquée** sur event-village-dev.
4. **Cache de 60 s.**
   - Un changement de titre, d'heure ou d'état apparaît sur la fiche dans les 60 s.
   - Le stock, la vente et le statut d'achat sont relus en direct par la billetterie.
   - **Annulation** : l'avis public apparaît dans les 60 s. Pour l'afficher tout de suite, il faudrait invalider le cache de la fiche à chaque changement d'état (décision attendue).
5. **Guichet** : « Billets au guichet sur place » s'affiche quand la vente en ligne est fermée et qu'une catégorie vendue au guichet a des places. `sale_counter` vaut vrai par défaut.
6. **Notifications** : le réabonnement automatique vaut pour tout compte qui se reconnecte sur un téléphone où la permission est déjà accordée, sauf si cet appareil a été désactivé. Le réglage d'appareil `ev-push-appareil` ne contient aucune donnée du compte : il est classé dans l'inventaire de `cvf2b-6`, sans qu'aucune assertion ne change.
7. **QR en grand** : une page web ne peut pas régler la luminosité du téléphone. Le fond est blanc, l'écran reste allumé quand le navigateur le permet, et un texte invite à monter la luminosité.
8. **Mesure CI** :
   - le délai du job e2e passe de 60 à 70 min ;
   - le toucher est mesuré sur les puces d'Explorer, car l'accueil n'en a plus ;
   - le lock a été régénéré avec npm 10.9.9, celui de la CI.
9. **Poste de travail** : le disque était plein.
   - J'ai supprimé les dossiers de build et de dépendances que j'avais créés, ainsi que les restes de remballages git ratés.
   - J'ai coupé le remballage automatique de git dans ce dépôt (`gc.auto 0`, `maintenance.auto false`).

## Tests

- **Nouveaux** :
  - `tests/schema/design1b-en-cours`, `design1b-mots`, `design1b-perf-mobile`, `design1b-catalogue`, `design1b-fiche`, `design1b-billets`, `migration-d1b-a-la-une-rejouable` ;
  - `tests/parcours/design1b-catalogue-api`, `design1b-fiche`, `design1b-billets`, `design1b-a-la-une`.
- **Adaptés, à exigence égale** :
  - `stock-public-9ter` : seuil relatif ;
  - `decouverte-ecrans` : Explorer et accueil rendus par le serveur ;
  - `client-interface` ;
  - `evenement-404` : la page de la fiche est servie en cache, sans session lue ;
  - `cycle-visibilite` ;
  - `finance-affichage` ;
  - `notif-modeles`, `notif-canaux`, `notif-rappels`, `confirmation-achat` : liens vers les onglets ;
  - `notif-interface` : import à la demande du client push ;
  - `cvf2b-6` : écrivain du panier, réglage d'appareil ;
  - `f3b-ecrans` : `/admin/a-la-une` ;
  - `admin-parrainage` : aides réseau communes ;
  - `paiement-operateur` : « carte » en mot isolé.
- **Recette** : lignes citées recalées.
- **Captures et e2e** :
  - captures du design 1b ajoutées et graine « Dernières places » ajustée ;
  - `perf.spec` : nouveau marqueur de l'accueil, pages préparées par le serveur ;
  - `recette` : attente du cache de 60 s, adresse affichée avec la ville ;
  - `terrain` 9 : diagnostic ajouté au message.

## Essais pour un non-développeur

1. **Accueil sur un téléphone.**
   - La rangée « À la une » défile au doigt, et sa première carte est plus grande.
   - Le seul grand bouton orange et rose est « Organiser un événement ».
2. **« En cours »** : pendant un événement, sa carte porte « En cours » avec un point qui pulse. Sur sa fiche : « En cours · se termine vers … ». Le badge disparaît tout seul à l'heure de fin.
3. **Explorer** : touchez « Cette semaine », puis « Gratuit » ; l'écran se met à jour tout de suite. « Voir plus » ajoute des cartes.
4. **Fiche** :
   - la barre « Choisir mes billets » est en bas dès l'ouverture ;
   - les catégories ont leur couleur ;
   - la petite carte porte le nom de l'événement.
5. **Achat** : Wave et Orange Money sont en grands boutons. Si un paiement attend déjà, le bandeau propose « Annuler ce paiement ».
6. **Mes billets** :
   - glissez d'un billet à l'autre ;
   - touchez le QR : il s'affiche en grand sur fond blanc ;
   - après un achat, une petite fête et « Vos billets sont là. ».
7. **Profil** : sections en cartes. Après « Déconnecter tous mes appareils », reconnectez-vous : les notifications reviennent seules si elles étaient autorisées.
8. **Administration** : en Superadmin, ouvrez « À la une » et ajoutez, ordonnez ou retirez un événement publié. Chaque action entre au journal.
9. **Réduire les animations** : activez le réglage sur le téléphone. Plus aucun mouvement, et le point « En cours » est fixe.
