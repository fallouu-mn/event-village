# Design 1e — Orange de marque, navigation fluide et vitesse

Branche `design-1e/identite`, partie de `main` à `2ec11bb66` (designs 1a à 1d, finition 4, lot 10b, connexion et langue
des tests). **Non fusionnée** (consigne). **Aucune migration.** Le catalogue des avis, les pages des tables, des salles et
des commandes ne sont pas touchés, sauf par les jetons de couleur et la coquille commune (en-tête, barre du bas, menu,
barre latérale).

## À lire en premier — reprise du 21/11 (décisions de l'utilisateur)

**État final : FUSIONNÉ dans `main`** le 21/11 (`be1494ba5`, sur `2ec11bb66` inchangé), feu vert de l'utilisateur sous
condition « run complet entièrement vert avec Mes billets ≥ 90 ». **Aucune migration.** Preuve de la branche : **run complet
571** (`a01769ad7`) entièrement vert : tests 570/570 (sécurité, `tests/audit/`, `tests/audit-auth/` compris), e2e sans aucun
échec (captures, fumée, terrain, recette, perf avec la preuve des lectures sûres), contrôle responsive 0 défaut, budgets
JavaScript tenus sans relèvement, mesure mobile accueil **90**, fiche **93**, Mes billets **91** (machine rapide, ×4,9 à
×5,5). Run complet de `main` après la fusion : **run complet 572 (`be1494ba5`) vert** : tests 570/570, e2e, responsive (0 défaut), budgets, mesure mobile accueil **91**, fiche **93**, Mes billets **93** (machine rapide, ×4,9 à ×5,6). Worktree retiré.

| Contrôle | Run complet 557 (`ad9ea6db7`) | Run complet 561 (`aa877ec32`) | **Run complet 571 (`a01769ad7`)** |
|---|---|---|---|
| Tests | 569/569 | 569/569 | **570/570** |
| Contrôle responsive | 0 défaut | 0 défaut | **0 défaut** |
| E2E (captures, fumée, terrain, recette…) | verts | verts | **verts** |
| E2E phase « perf » | verte | rouge (défaut de l'outil, corrigé) | **verte** |
| Mesure mobile | 93 / 94 / **91** | 91 / 90 / **92** | **90 / 93 / 91** |
| Poids JavaScript | rouge (+44 o) | tenus | **tenus** |

Historique (runs 557 et 561) :

| Contrôle | Run complet 557 (`ad9ea6db7`) | Run complet 561 (`aa877ec32`) |
|---|---|---|
| Tests (4 lots, migrations depuis zéro, sécurité et audits compris) | 569/569 verts | **569/569 verts** |
| Contrôle responsive | 0 défaut | **0 défaut** |
| E2E captures (ordinateur compris), fumée, terrain, recette, emails, pwa, déconnexion | **verts** (point A réglé) | **verts** |
| E2E phase « perf » (`e2e/perf.spec.ts`) | verte | **rouge : 1 test, défaut de l'outil de test** (ci-dessous) |
| Mesure mobile (client de mesure fixe, seuils et calibration inchangés) | accueil 93, fiche 94, **Mes billets 91** | accueil 91, fiche 90, **Mes billets 92** (×4,6 à ×5,2) |
| Poids JavaScript | rouge : `/billet/hors-ligne` +44 octets | **tenus, budgets non relevés** |

- **Le seul rouge du run 561 — corrigé (décision du 21/11)** : `e2e/perf.spec.ts:391`, « Accueil : premier affichage
  utile », s'arrêtait sur `request.sizes: Target page, context or browser has been closed`. Le test poussait chaque lecture de
  taille de script (`req.sizes()`) dans une liste sans gestionnaire d'erreur et ne l'attendait que plus tard ; une lecture en
  cours quand la page se fermait laissait une promesse rejetée sans gestionnaire, qui cassait le test, puis la passe suivante ne
  pouvait plus ouvrir de contexte (`browser.newContext : Failed to find browser context`). Ce n'était pas une mesure hors
  seuil (première apparition sur les 40 derniers runs publiés ; `e2e/perf.spec.ts` n'était pas modifié par ce lot).
  **Correctif** : toute lecture de requête du test passe par `e2e/support/request-read.ts` (`readRequest`), dont la promesse ne
  rejette jamais : page, contexte ou navigateur déjà fermés → **seule cette requête est ignorée** (comptée et notée dans le
  journal) ; toute autre erreur reste gardée et fait échouer la mesure comme avant. **Aucun seuil ni aucune mesure changés.**
  **Preuves** : `tests/schema/design1e-lecture-requetes.test.ts` (rejet « page fermée » ignoré même si personne n'attend la
  promesse, autre erreur relancée, plus aucune lecture de requête hors du module) et `e2e/lecture-requetes-perf.spec.ts`
  (vrai Chromium, projet perf : un serveur local retient le corps d'un script, la taille est demandée puis le contexte fermé
  pendant le téléchargement ; sur 5 passes, la lecture non protégée rejette avec le message exact du run 561, la lecture sûre
  ignore la requête, aucun rejet non géré, et un nouveau contexte s'ouvre et charge une page). Essai local : 5/5 passes.
- **Règle temporaire de Mes billets : LEVÉE** (décision de l'utilisateur du 21/11), sur deux runs complets avec le client de
  mesure fixe (Awa Sow, 10 billets à venir, 30 passés) : Mes billets **91** (run 557) et **92** (run 561) ; confirmé par le
  run complet 571 (**91**). **Le seuil de 90 est
  de nouveau bloquant pour toutes les pages, Mes billets compris** : un run où une page mesurée est sous 90 n'est plus accepté
  pour une fusion. Aucun code ne portait cette exception (la mesure rendait déjà le run rouge sous 90) ; l'entrée « Mes billets
  au seuil » de `docs/apres-lancement.md` est close.
- **93 reste un objectif** (décision du 21/11) : atteint au job « perf » (93 au run 533 ; 92 au run 552), pas aux runs complets.
  Le profil processeur du run 559 ne montre plus de coût propre à l'application au-dessus de quelques millisecondes sur Mes
  billets. Ce qui reste : le framework, le client Supabase (report refusé le 21/11) et le dessin du QR (≈ 28 ms ; report
  refusé le 21/11, l'entrée passe avant le score).

### Ce qui a été fait après les décisions du 21/11

| Point | Changement | Commit |
|---|---|---|
| A | Espaces organisatrice et administration : bouton du compte réduit à l'avatar (44 × 44 px, nom accessible gardé) | `ce636ffeb` |
| A | `scroll-padding-top` retiré ; `e2e/captures.spec.ts` fait ses contrôles page en haut (position fixe), puis la capture reprend sa position. **Aucune règle d'axe changée** (modification du test signalée) | `ce636ffeb` |
| B | Premier affichage de Mes billets : billets **à venir** seulement (règle commune `lib/tickets/periode.ts`, `GET /api/tickets?periode=a-venir` : sous-ensemble du même compte, après les mêmes contrôles de session) ; « Tous mes billets » et « Historique » chargent la liste complète à leur ouverture | `ea7573c4a` |
| B | Portefeuille affiché par 10, la suite au défilement (et par un bouton « Afficher les billets suivants » pour le clavier) | `ea7573c4a` |
| B (sécurité, hors ligne) | Enregistrement hors ligne de **tous** les billets inchangé (synchronisation de fond, liste complète). La réconciliation de Mes billets, qui **efface** les billets absents de la liste, ne tourne plus qu'avec la liste **complète** : jamais avec les seuls billets à venir (sinon les billets passés enregistrés seraient effacés). Test : `tests/schema/design1e-mes-billets.test.ts` (rouge 0/5, puis vert) ; suites hors ligne, déconnexion et `tests/security` vertes | `ea7573c4a` |
| B (mesure) | Client de mesure dédié **Awa Sow** (`clientMesure`), semé une fois par `seed:demo` : **10 billets à venir, 30 passés**, achetés par le paiement simulé ; connecté par la phase « connexion » (`.auth/mesure.json`) ; le même au job « perf » et au run complet ; aucune phase de l'e2e ne s'en sert. Seuils et calibration inchangés | `ea7573c4a` |
| B | Dates de Dakar écrites sans `Intl` (35 ms au premier `Intl.DateTimeFormat`, profil du run 552), comparées à `Intl` sur 3 000 instants ; module compacté pour tenir le budget de `/billet/hors-ligne` | `ad9ea6db7`, `b9df49c17` |

Tests modifiés en plus de la section 8 (signalés) : `tests/schema/design1b-billets.test.ts` (règle « à venir » lue dans
`lib/tickets/periode.ts`), `tests/schema/design1b-chargement.test.ts` (portée de `readTicketsOnServer`), `e2e/captures.spec.ts`
(contrôles page en haut).

Section 9 (décisions prises seul) : **validée par l'utilisateur le 21/11.** Logo : inchangé (décision). Client Supabase à la
demande : non (décision).

## État au premier rapport (run complet 543, avant les décisions du 21/11)

**Lot livré sur sa branche, run complet ROUGE sur deux points, documentés ci-dessous (trois tentatives
chacun, règle du mode autonome). Non fusionné.** Dernier run complet **543** (`20885b296`), machine normale (×3,5 à
×4) :

| Contrôle | Résultat |
|---|---|
| Tests (4 lots, migrations depuis zéro) | **568/568 verts**, contrôle des lots OK (sécurité, `tests/audit/`, `tests/audit-auth/` compris) |
| Poids JavaScript | **tenus, budgets non relevés** (section 6) |
| Contrôle responsive (150 pages × thèmes, 320 à 1 440 px) | **0 défaut** |
| E2E : fumée, terrain, recette, emails, pwa, déconnexion, connexion-course, fake-prod, perf | **verts** |
| E2E : captures | **rouge** : 9 captures de l'ordinateur (organisatrice et administration), règle axe « target-size » (point A) |
| Mesure mobile | **rouge** : accueil **94**, fiche **90**, Mes billets **86** (point B) |

- **Point A — cible « partiellement masquée » sur ordinateur (bloquant non levé).** Dans les espaces pro et
  l'administration, quand la page est défilée de quelques dizaines de pixels, le haut du contenu passe sous l'en-tête
  collant, et une cible du haut à droite (bouton d'en-tête de page, « Supprimer l'image ») se retrouve sous le **nouveau
  bouton du compte** de l'en-tête (sur main, il n'y avait à cet endroit que la cloche) : axe la déclare « partiellement
  masquée par une autre cible ». Le résultat dépend de la position de défilement à l'instant de la capture : 2, puis 4,
  puis 9 écrans selon les runs (537, 540, 543). Tentatives : marge de défilement sous l'en-tête (`scroll-padding-top`),
  panneau du compte retiré quand il est fermé, bouton du compte ramené à 44 px. Pistes pour la suite, à décider :
  (1) bouton du compte en icône seule (avatar) dans l'en-tête des espaces pro, comme la cloche ; (2) retirer
  `scroll-padding-top`, qui a fait défiler davantage les écrans « en tête » (les captures de l'accueil de
  l'administration ne sont tombées qu'avec lui) ; (3) faire défiler la capture jusqu'en haut avant le contrôle axe.
  Ce n'est pas une faille, ni un défaut pour un utilisateur (qui fait défiler la page), mais c'est un contrôle bloquant
  de la CI : **je ne l'ai pas contourné**.
- **Point B — vitesse.** Pendant le travail (job « perf », base sans l'e2e complet) : **accueil 95, fiche 95, Mes billets
  93** (run 533). Au run complet, la base a vécu tout l'e2e (le compte du client y a beaucoup plus de billets) :
  **Mes billets 86** [85 ; 84 ; 91 ; 86 ; 89] (main : 88), avec deux passages sur cinq à un affichage principal de 2,3 à
  2,4 s ; temps de blocage 455 ms (main : 479). Les runs 537 et 540 sont **inexploitables** (machine très rapide,
  indice 3 100 à 3 660, ralentissement ×6,3 à ×7,3 : les trois pages baissent ensemble, comme au run 488 du design 1d).
  **La cible de 93 n'est pas tenue au run complet** : la règle temporaire de Mes billets **n'est pas levée** (point 6 de
  la consigne) ; le seuil de 90 reste non bloquant pour Mes billets seul jusqu'à décision.

- **Sécurité : aucune faille trouvée pendant le lot.** Deux points de sécurité ont été relus, sans défaut :
  - la suite d'audit `tests/audit/cvf2b-6-deconnexion` (inventaire des stockages du navigateur) a signalé au run 526 une
    écriture nouvelle, celle de la barre latérale repliée. C'est une valeur fixe (« replie ») sans aucune donnée du
    compte, comme le thème : classée « sans lien avec le compte » dans l'inventaire (test complété, signalé en section 8) ;
  - le correctif de vitesse sur la session (point 5.2) ne touche ni la déconnexion ni les effacements : il n'ignore que le
    second avis d'une **même** session (même jeton d'accès), après les effacements, qui restent inchangés. La suite
    `tests/parcours/securite-deconnexion` et les suites d'audit `tests/audit/` et `tests/audit-auth/` restent vertes.
- **Disque du poste plein** pendant le lot (0 Mo libre sur C:). J'ai supprimé seulement mon propre dossier de build
  (`event-village-design1e/.next`, 1,2 Go, régénérable) et rien d'autre ; il reste environ 1,3 Go. Plus aucun build
  local n'était possible : build, poids JavaScript, mesures et captures ont été faits en CI. **À faire par vous :**
  libérer de la place sur C: (je n'ai rien supprimé qui ne soit pas à moi).
- **Outil ajouté à la CI** pour mesurer au lieu de deviner : la ligne `ci-perf: oui` d'un commit en mode rapide lance la
  mesure mobile seule (job « perf », mêmes seuils, même calibration), suivie d'un **profil processeur** qui nomme le
  module et le code de chaque fonction coûteuse (diagnostic, hors verdict). C'est ce profil qui a trouvé les causes de la
  section 5.
- **Décisions prises seul** (mode autonome), à confirmer : section 9.
- **Tests modifiés, signalés** : section 8.

## 1. Orange de marque

Valeurs calées par mesure de contraste (`tests/schema/design1e-orange.test.ts`, sortie brute `[D1E-ORANGE]` ;
`docs/design/outils/contraste.mjs` : 95 couples, 0 sous le seuil). Référence du client ≈ #F26522 (blanc 3,15:1, trop
juste) : retenu **#F05A1A**, même teinte à 1,4° près (17,9° contre 19,3°), saturation 0,88, plus profond et plus vif
que l'ancien #FF8A3D.

| Rôle | Jeton | Clair | Sombre | Contraste mesuré | Seuil |
|---|---|---|---|---|---|
| Orange de la marque (accents, onglet actif, focus) | `--brand`, `--ring` | #F05A1A | #F05A1A | — | — |
| Bouton principal, fond | `--primary` | #F05A1A | #F05A1A | — | — |
| Survol du bouton principal | `--primary-hover` | #E8561A | #E8561A | — | — |
| Bouton principal en grande taille : blanc gras ≥ 19 px | `--primary-foreground-large` | #FFFFFF | #FFFFFF | 3,40:1 (survol 3,63:1) | 3:1 |
| Petits boutons et pastilles sur orange | `--primary-foreground`, `--brand-foreground` | #1A1A1A | #1A1A1A | 5,12:1 (survol 4,79:1) | 4,5:1 |
| Orange foncé en texte (liens, « Voir tout », bouton secondaire) | `--primary-text` | #C2410C | #FA7036 | clair 5,18 (blanc) / 4,75 (gris) / 4,68 (teinté) ; sombre 6,63 / 6,16 / 5,63 / 5,36 / 5,91 | 4,5:1 |
| Dégradé signature (un par écran), texte blanc gras ≥ 19 px | `--gradient-from` → `--gradient-to` | #F05A1A → #D9480F | idem | 3,40:1 au pire point (21 positions) | 3:1 |
| Barre du bas flottante | `--nav-bar` | #FFFFFF | #000000 | — | — |

- Bouton secondaire : fond de carte, **texte orange foncé** (`text-primary-text`). Bouton principal : orange plein, texte
  #1A1A1A en petite et moyenne taille, **blanc gras de 19 px en grande taille** (`size="lg"`).
- En sombre, l'orange des boutons et des accents est le même ; pour les **petits textes** orange sur fonds sombres,
  #F05A1A tombait à 4,46:1 sur le gris des puits (#262626) : #FA7036, même teinte, tient 5,36:1 au pire.
- Plus de rose : dégradé tout orange, ombre orangée. **Le logo n'est pas changé** (section 9).
- Jetons renommés : aucun ; un jeton ajouté (`--primary-foreground-large`) et un pour la barre (`--nav-bar`) ; les
  alias restent. `app/global-error.tsx` et l'image de partage suivent le nouvel orange.

## 2. Téléphone et tablette (< 1024 px)

- **Barre du bas flottante** en pilule (`components/layout/BottomNav.tsx`) : blanche en clair, noire en sombre, ombre ;
  **pastille orange qui glisse** d'un onglet à l'autre (transform, ressort de 250 ms), dès le toucher ; onglet actif en
  #1A1A1A sur l'orange ; **point rouge sur « Notifications »** quand il y a du nouveau (le compteur de la cloche est
  partagé, aucun appel de plus ; annoncé « nouvelles notifications ») ; cibles de 44 px ; zone sûre de l'iPhone
  (`max(8 px, env(safe-area-inset-bottom))`). Client : Accueil, Explorer, Billets, Notifications (« Avis »), Portefeuille.
- **Menu** (`components/layout/PushMenu.tsx`) : la page **recule** (0,86, coins arrondis de 28 px, ombre) et glisse vers la
  droite ; le menu apparaît derrière, sur l'orange, entrées en **blanc gras de 19 px**, petits libellés en #1A1A1A ;
  fermeture en touchant la page, en glissant vers la gauche, par Échap ou par le bouton ; **focus piégé** (page rendue
  inerte, Tab qui tourne dans le menu, focus rendu au bouton) ; 280 ms. Chargé à la **première ouverture** seulement.
- La barre d'achat de la fiche est recalée juste au-dessus de la barre flottante.

## 3. Ordinateur (≥ 1024 px)

- **En-tête** : rubriques (Accueil, Explorer, Mes billets, Commandes si ouvert, Portefeuille) avec un **trait orange qui
  glisse** sous la rubrique active et **suit le survol** (et le focus au clavier) ; **menu du compte qui s'ouvre en
  glissant** (profil, services, espaces métier, thème, « Se déconnecter »). La recherche de l'en-tête revient à 1 280 px
  (à 1 024 px, l'en-tête débordait de 6 px).
- **Espaces organisatrice et administration** (`components/layout/ProSidebar.tsx`) : barre latérale avec **surlignage de
  la rubrique active qui glisse**, **repliable en icônes** (la barre glisse par transform, les icônes restent en place),
  **choix gardé sur l'appareil** (localStorage dans try/catch, posé avant le premier affichage : aucun saut),
  **info-bulles** en mode replié. Chargée seulement dans ces espaces.
- Survols doux : cartes d'événement qui se soulèvent (transform), boutons.
- **Cloche** (demande du 21/11) : **panneau qui glisse** depuis la droite (plein écran qui monte du bas sur téléphone,
  **fermé en glissant vers le bas**), **avis groupés par jour** (« Aujourd'hui », « Hier », puis la date, heure de Dakar),
  « Tout marquer comme lu », **compteur qui s'anime une fois** à chaque nouveau nombre. Chaque avis mène au lien servi
  par le serveur : le bon onglet (« Mes billets › Reçus », etc.) ; le billet, la réservation ou la commande **précis**
  demandent un lien par avis dans le catalogue, hors du périmètre (docs/apres-lancement.md). Panneau chargé au survol ou
  à l'ouverture (`components/layout/NotificationPanel.tsx`).
- Toutes les animations : 150 à 300 ms, transform et opacity seulement (visibility pour masquer), jamais en boucle,
  coupées par « réduire les animations » (vérifié par `tests/schema/design1e-navigation.test.ts`, qui a d'ailleurs
  attrapé une ombre animée, corrigée).

## 4. Couleur des affiches

`pickPosterColor` (`lib/events/poster-color.ts`), à la manière d'une palette « vibrant / muted » : la teinte **vive** la
plus présente (saturation ≥ 0,45, ni trop sombre ni trop claire), sinon la teinte **sourde** (≥ 0,15), **gris seulement
sans aucune teinte sur 1 % des pixels** ; puis l'assombrissement existant (contraste ≥ 4,5:1 avec le blanc inchangé).
Sortie brute `[D1E-AFFICHES]` : fond blanc et sujet rouge-orangé → #d14029 (au lieu du gris) ; fond crème, bleu et jaune →
#1f4fd8 ; fond noir et prune sourde → #673c58 ; noir et blanc → #757575. Le script des affiches existantes reste
rejouable ; `docs/essai-local.md` (8.20) indique de le lancer avec `npx tsx --env-file=.env.local scripts/poster-styles.ts`.

## 5. Vitesse

Mesure inchangée : `scripts/e2e/perf-mobile.mjs`, Lighthouse 13.6.0, médiane de 5 passages, seuils (90 ; 2,5 s ; 0,1 ;
200 ms) et calibration (×4 pour un indice de 2 000) **non modifiés** (`tests/schema/design1e-ci-perf.test.ts` le vérifie).
Pendant le travail : job « perf » (mode rapide, même script ; la base n'a pas vécu l'e2e complet, les notes se comparent
entre runs de ce job). Preuve finale : le run complet (section « À lire en premier »).

### Causes trouvées (mesurées, pas devinées) et correctifs

Requêtes du chargement de Mes billets (rapport Lighthouse du run 519) et profil processeur par fonction (runs 523 à 530,
au téléphone de référence ×4) :

| # | Cause | Effet mesuré | Correctif | Commit |
|---|---|---|---|---|
| 1 | `LinkButton` gardait le préchargement de next/link : `/explore?_rsc` chargé et décodé pendant le chargement de **chaque** page | requête et décodage pendant le chargement | préchargement à l'intention (IntentLink), comme la coquille depuis le design 1b | `32dce92a1` |
| 2 | Session annoncée deux fois au chargement (INITIAL_SESSION puis SIGNED_IN, même jeton) | `/api/auth/me` lu deux fois, page entière redessinée | doublon **exact** ignoré, après les effacements (inchangés) | `32dce92a1` |
| 3 | Temps réel de la cloche ouvert pendant le chargement | abonnement et relecture des notifications pendant le chargement | ouvert une fois la page chargée et le téléphone libre (comme Mes billets) | `32dce92a1` |
| 4 | `lib/format.ts` construisait 5 formateurs Intl à son chargement | 52 ms d'un bloc (profil du run 526) | construits au premier usage | `aff58cd71` |
| 5 | Le premier `Intl.NumberFormat` (prix en F CFA) | 43 à 45 ms au premier prix affiché, fiche et Mes billets (profil du run 530) | entiers groupés sans Intl, même texte (2 033 valeurs comparées) | `b0a50da4b` |
| 6 | Tri des villes de l'accueil : un comparateur recréé à chaque comparaison | 27 ms (profil du run 530) | un seul `Intl.Collator` | `b0a50da4b` |
| 7 | Coquille redessinée à chaque changement de session ou de réglage | rendus de la barre du bas, des rubriques et de la cloche | `React.memo` sur ce qu'elles affichent | `aff58cd71` |
| 8 | Nouvelle coquille (+4,9 Ko gzip au run 525, budgets dépassés) | poids de chaque page | panneau de la cloche, menu et barre latérale chargés à la demande | `c61726b65` |

Pistes de la consigne examinées et non retenues :
- **Client Supabase chargé à la demande** (le morceau partagé `6140`, 54 Ko gzip, 72 % inutilisé au chargement) : la
  session, l'écoute de fin de session dans tous les onglets et la déconnexion sans réseau en dépendent dès le premier
  instant (`signOut` l'appelle sans attendre). Le retarder exige un chargement qui marche hors ligne et une déconnexion
  qui attend le client : risque de sécurité pour un gain qui n'était plus nécessaire après les causes 1 à 7. Non fait ;
  à décider si une marge plus grande est voulue.
- **Regrouper les morceaux communs** : le morceau `6140` apparu avec le lot 10b est ce client Supabase ; rien à
  regrouper de plus sans la piste précédente.
- **Rendu du portefeuille** : vignettes et carte mémorisée (design 1b) déjà en place ; le profil ne montre plus de coût
  propre au portefeuille au-delà du QR (≈ 30 ms, `qrcode`).

### Mesures mobiles (Lighthouse, médiane de 5 passages, seuils et calibration inchangés)

| Run | Commit | Type | Ralentissement (médiane) | Accueil | Fiche | Mes billets | Temps de blocage Mes billets |
|---|---|---|---|---|---|---|---|
| 519 (main) | `2ec11bb66` | complet, référence « avant » | ×3,68 | 92 | 90 | **88** | 479 ms |
| 521 | `87516cc62` | job perf, code de main | ×4,80 | 90 | 90 | 89 | 437 ms |
| 523 | `f9e937694` | job perf, orange | ×4,18 | 92 | 91 | 90 | 428 ms |
| 525 | `db0cfa32a` | job perf, coquille | ×3,86 | 92 | 92 | 88 | 473 ms |
| 526 | `c61726b65` | job perf, causes 1 à 3, 8 | ×4,86 (machine rapide) | 89 | 91 | 91 | 370 ms |
| 530 | `aff58cd71` | job perf, causes 4 et 7 | ×3,81 | 93 | 91 | 91 | 388 ms |
| 533 | `b0a50da4b` | job perf, causes 5 et 6 | ×3,77 | **95** | **95** | **93** | 306 ms |

Détail du run 533 : accueil [93 ; 96 ; 95 ; 93 ; 99], fiche [90 ; 92 ; 95 ; 95 ; 98], Mes billets [85 ; 93 ; 95 ; 93 ; 98] ;
LCP 1,07 s, 2,11 s et 0,95 s ; aucun saut de mise en page ; toucher sous 200 ms.

### Runs complets

| Run | Commit | Ralentissement | Accueil | Fiche | Mes billets | Autres résultats |
|---|---|---|---|---|---|---|
| 519 (main, référence) | `2ec11bb66` | ×3,68 | 92 | 90 | 88 (TBT 479 ms) | — |
| 537 | `1e6821255` | ×6,3 à ×7,05 (inexploitable) | 85 | 84 | 84 | tests 568/568, responsive 0 défaut ; e2e : captures, fumée, terrain rouges |
| 540 | `81b2a96e3` | ×6,7 à ×7,3 (inexploitable) | 87 | 88 | 87 | tests 568/568, responsive 0 défaut ; fumée et terrain réparés ; 2 captures de l'ordinateur rouges |
| **543** | `20885b296` | ×3,5 à ×4 | **94** | **90** | **86** (TBT 455 ms) | tests 568/568, responsive 0 défaut ; 9 captures de l'ordinateur rouges (point A) |

Causes des rouges e2e du run 537, toutes corrigées au run 540 : texte blanc de 14 px sur l'orange des boutons du scanner
(3,39:1, un vrai défaut de contraste : le blanc n'est plus permis qu'en grand texte) ; barre du bas à 68 px quand un
libellé passe sur deux lignes (barre d'achat recouverte : hauteur fixe de 64 px) ; panneau des notifications cherché
sous le rôle « région » par les captures, la fumée et le terrain (il est devenu une fenêtre modale) ; page reculée
(inerte) comptée dans les cibles du menu ouvert.

**Écart entre le job « perf » et le run complet pour Mes billets (93 contre 86)** : même code, même mesure ; seule la
base diffère (le run complet mesure après tout l'e2e). Le profil processeur n'est pas lancé au run complet ; le lancer
dans le job e2e (diagnostic) dirait quelle part revient au portefeuille plus fourni.

## 6. Poids JavaScript (gzip, octets ; budgets inchangés)

| Route | Avant (run 519) | Run 525 (coquille entière dans chaque page) | Après (run 533) | Budget | Marge après |
|---|---|---|---|---|---|
| `/` | 223 301 | 228 186 (dépassé) | 224 085 | 226 342 | 2 257 |
| `/events/[id]` | 231 868 | 236 756 (dépassé) | 232 638 | 233 316 | 678 |
| `/tickets` | 246 277 | 251 161 (dépassé) | 247 012 | 250 417 | 3 405 |
| `/controller/scanner` | 233 194 | 238 077 (dépassé) | 233 967 | 234 911 | 944 |
| `/billet/hors-ligne` | 223 340 | 228 224 (dépassé) | 223 936 | 224 268 | 332 |

La nouvelle coquille coûte environ 0,6 à 0,8 Ko gzip à chaque page (barre du bas, rubriques, menu du compte) ; le menu
du téléphone, la barre latérale et le panneau des notifications sont chargés à la demande. Budgets **non relevés**.

## 7. Captures

Dossier `docs/design-1e-captures/` : `avant/` (run 519 de main : accueil, fiche « ce soir », Mes billets, tableau de bord
de l'organisatrice, à 360, 768 et 1 440 px, clair et sombre) et `apres/` (job responsive, `e2e/design1e-captures.responsive.spec.ts` :
accueil, fiche, Mes billets, menu ouvert, barre du bas, en-tête avec survol, menu du compte, panneau des notifications,
tableau de bord avec barre latérale ouverte et repliée, à 360, 1 024 et 1 440 px, clair et sombre).

Les captures « après » viennent du run complet 543 (job responsive). Fichiers : `d1e-<écran>__<largeur>__<thème>.jpg`,
écrans `accueil`, `fiche`, `mes-billets` (360, 1 024, 1 440 px), `menu-ouvert` et `barre-du-bas` (360 px), `entete-survol`
et `menu-du-compte` (1 024, 1 440 px), `notifications` (360, 1 024, 1 440 px), `org-barre-ouverte` et `org-barre-repliee`
(1 024, 1 440 px), `org-tableau-de-bord` (360 px) ; clair et sombre. Les captures « avant » n'existent qu'à 360, 768 et
1 440 px (celles du contrôle responsive de main).

Relecture faite sur ces captures (et corrigée) : « Portefeuille » coupé « Portefeuil / le » à 360 px (césure douce,
« Porte-feuille ») ; icône de déconnexion rouge sur l'orange du menu (pastille blanche) ; captures « sombre » des comptes
connectés rendues en clair (cookie de thème de l'état de connexion, défaut de l'outillage déjà présent sur main : le
spec des captures pose le cookie du thème voulu).

## 8. Tests

### Nouvelles suites

| Suite | Ce qu'elle vérifie | Rouge avant le code |
|---|---|---|
| `tests/schema/design1e-orange.test.ts` | chaque paire couleur / texte des jetons, clair et sombre, contre les seuils de la consigne ; dégradé sur 21 positions ; Button | oui, 0/7 puis 7/7 |
| `tests/schema/design1e-navigation.test.ts` | durées 150-300 ms, transform / opacity seuls, jamais en boucle, réduire les animations ; barre du bas, menu, en-tête, barre latérale, panneau ; groupement par jour | écrite avec le code ; a attrapé une ombre animée |
| `tests/schema/design1e-affiches.test.ts` | couleur vive, sourde, gris seulement sans couleur, contraste ≥ 4,5:1, script rejouable | oui, 2/8 puis 8/8 |
| `tests/schema/design1e-vitesse.test.ts` | causes 1 à 6 de la section 5 ; sorties de `lib/format.ts` identiques | formateurs : oui (rouge puis vert) ; causes 1 à 3 et tri des villes : écrits avec le correctif (la preuve est la mesure) |
| `tests/schema/design1e-ci-perf.test.ts` | job « perf » : mode rapide seulement, mêmes étapes, même script, seuils et calibration inchangés, profil hors verdict | écrite avec le job |
| `e2e/design1e-captures.responsive.spec.ts` | captures du rapport ; menu en dialogue, page inerte, Échap rend le focus ; barre latérale repliée gardée au rechargement | — |

### Tests existants modifiés (avec la raison)

| Suite | Modification | Raison |
|---|---|---|
| `tests/schema/design1c-responsive.test.ts` | liste `needs` du verdict avec `perf` | nouveau job de la CI |
| `tests/parcours/design-systeme.test.ts` | valeurs de l'orange (#F05A1A) ; `--primary` n'est plus exigé différent en sombre (c'est `--primary-text` qui bascule) ; LinkButton peut passer par IntentLink (qui enveloppe next/link) | consigne : même orange en sombre ; cause 1 de la section 5 |
| `tests/parcours/f2b-telephone.test.ts` | barre « Navigation rapide » lue dans `BottomNav.tsx` (même libellé, même classe) | barre déplacée dans son composant |
| `tests/schema/design1b-fiche.test.ts` | décalage de la barre d'achat : 3,25 rem + max(0,5 rem, zone sûre) | barre du bas flottante |
| `tests/parcours/notif-cloche.test.ts`, `tests/parcours/notif-interface.test.ts`, `tests/parcours/dette-interface-lot7.test.ts` | chaînes figées, pied et « Tout marquer comme lu » cherchés dans la cloche ET `components/layout/NotificationPanel.tsx` | panneau sorti de la cloche (poids de chaque page) |
| `tests/audit/cvf2b-6-deconnexion.test.ts` | inventaire 13b : écriture de la barre latérale classée « sans lien avec le compte » | valeur fixe sans donnée du compte, comme le thème |
| `tests/helpers/design-files.ts` | nouveaux fichiers de la coquille dans la liste du système de design | règle du garde-fou |
| `e2e/support/screens.ts` (cloche ouverte), `e2e/support/parcours.ts` (`openBell`) | panneau cherché sous le rôle « dialog » au lieu de « région » | le panneau est une fenêtre modale (piège du focus) |
| `e2e/support/checks.ts` | les éléments d'une zone inerte (page reculée derrière le menu ouvert) ne sont plus comptés comme cibles | ni clic ni focus possibles sur une zone inerte |
| `tests/schema/design1e-orange.test.ts` (ajout, run 537) | le blanc sur l'orange disparaît si la classe locale réduit le texte d'un bouton principal « lg » | défaut de contraste du scanner (3,39:1), rouge puis vert |

Aucune assertion relâchée sur la sécurité, l'argent ou l'accessibilité : chaque modification suit un déplacement de code
ou une valeur demandée par la consigne.

## 9. Décisions prises pendant le lot (à confirmer)

1. **Orange #F05A1A** plutôt que #F26522 exact (3,15:1 pour le blanc, sans marge) ; **#FA7036** pour les petits textes
   orange en sombre.
2. **Logo inchangé** (dégradé orange → rose) : le changer touche les icônes installées, l'image de partage et les
   courriels ; décision du client (docs/apres-lancement.md).
3. **« Notifications » dans la barre du bas du client** (la consigne demande son point) ; « Commandes » passe dans le
   menu et les rubriques de l'ordinateur (cinq onglets au plus).
4. **Plus de barre latérale pour le client sur ordinateur** : rubriques dans l'en-tête (consigne du point 3) ; la barre
   latérale reste pour l'organisatrice et l'administration.
5. **Barre latérale repliée** : « Se déconnecter » et le thème n'y sont plus visibles (barre dépliée, page Profil).
6. **Job « perf » en mode rapide** (`ci-perf: oui`) et **profil processeur** ajoutés à la CI.

## 10. Essais pour un non-développeur

Sur un téléphone (ou un navigateur réglé sur une largeur de téléphone), puis sur un ordinateur :

1. **Couleurs** : l'accueil, la fiche et Mes billets sont dans le nouvel orange ; le grand bouton « Réserver » est orange
   avec un texte blanc épais ; les petits boutons orange ont un texte noir ; les liens « Voir tout » sont orange foncé.
   En mode sombre, même orange sur fond noir.
2. **Barre du bas** : touchez « Explorer » puis « Billets » : la pastille orange glisse d'un onglet à l'autre. Avec une
   notification non lue, un point rouge apparaît sur « Avis ».
3. **Menu** : touchez les trois traits en haut à gauche : la page recule vers la droite, le menu orange apparaît derrière.
   Touchez la page, ou glissez vers la gauche, ou appuyez sur Échap (clavier) : il se referme.
4. **Cloche** : touchez la cloche : le panneau monte du bas (téléphone) ou glisse depuis la droite (ordinateur) ; les avis
   sont rangés sous « Aujourd'hui », « Hier »… ; sur téléphone, glissez le panneau vers le bas pour le fermer. Touchez
   un avis : vous arrivez au bon onglet.
5. **Ordinateur, en-tête** : passez la souris sur les rubriques : le trait orange suit la souris, puis revient sous la
   rubrique de la page. Cliquez sur votre nom en haut à droite : le menu du compte glisse.
6. **Espace organisatrice** (compte organisatrice, ordinateur) : cliquez l'icône en haut de la barre latérale : la barre
   se replie en icônes ; passez la souris sur une icône : son nom s'affiche ; rechargez la page : elle reste repliée.
7. **Réduire les animations** (réglage du téléphone ou de l'ordinateur) : tout s'ouvre et se ferme sans mouvement.
8. **Affiches** : après le script de la section 4 (`docs/essai-local.md`, 8.20), les cartes prennent une couleur de leur
   affiche (jamais un gris pour une affiche en couleurs).
