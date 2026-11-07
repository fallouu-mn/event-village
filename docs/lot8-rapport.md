# LOT 8 — RAPPORT

**Objet :** consolidation et recette de la billetterie. Le lot couvre :
- 8.0 : canaux de vente par catégorie, en ligne et au guichet ;
- 8.1 : mode d'essai pour tester soi-même, avec paiements simulés ;
- 8.2 a à x : la dette relevée aux lots précédents (double paiement, ordre des verrous, plafond des commissions, scan repris, écart de caisse, vraie 404, messages bruts, système de design, suites legacy, `legacy-peer-deps`, taille réelle du lot hors ligne…) ;
- 8.3 : recette complète (matrice CDC, parcours e2e chaîné sur les quatre rôles, cahier de recette manuelle, anomalies).

Hors périmètre, comme demandé : salles, tables, commandes, abonnements ; D79 ; test de charge, audit de sécurité final, déploiement.

**Branche :** `lot8/recette`, créée depuis `main` (`7fdcb32`). Dernier commit de code : `bc864fa`. Le commit de ce rapport ne change que `docs/`. `main` n'a pas bougé. Aucun test n'a été exécuté contre un projet Supabase distant : ni event-village-dev, ni un autre.

**Date :** 7 novembre 2026. Les runs cités vont du 6 au 7 novembre.

---

## À lire en premier

### Verdict : vert, sur le code final

Le **run 107** (`42334500969`, commit `bc864fa`, `job_status=success`, 2 261 s, soit 38 min pour une limite de 60) est le run « après » de référence :
- **`npm run verify`** : 220 suites sur 220, aucun échec ni suite expirée. Sous-tests : 2 859 réussis, 0 en échec, 0 annulé. Sortie : « [verify] OK — 5 étapes réussies en 811s. »
- **`npm run e2e`** : les 10 phases sont vertes.
  - Phases : connexion, captures, emails, dev-page, fumée, terrain (13 sur 13), pwa, fake-prod, perf, **recette**.
  - Captures : 327 sur 327, sans contrôle bloquant en échec.
  - **Recette** : les 8 actes du parcours chaîné (admin, partenaire, client, contrôleur), sur une seule base. Après chaque rôle, les invariants (a) à (t) sont contrôlés : 0 violation.

Deux autres runs verts le précèdent :
- **Run 105** (`a03abe6`) : 220 sur 220.
- **Run 106** (`f488be0`) : 220 sur 220, **même code d'application** que le run 105. C'est le second run exigé (L82) ; depuis, seuls `docs/` et une borne de `recette-matrice` ont changé.

Le run 107 a été relancé parce que la vérification des captures a trouvé trois défauts de ponctuation après le run 105, corrigés par `bc864fa`.

### Runs « avant » et « après »

| | Run « avant » 95 (`db21d1c`) | Run « après » 107 (`bc864fa`) |
|---|---|---|
| Suites verify | 172 sur 219, 47 rouges, tous attendus | 220 sur 220 |
| e2e | captures, dev-page, fumée, terrain et fake-prod en échec ; recette non lancée | 10 phases sur 10 |
| Lot hors ligne transféré | 33 462 octets, sans compression | 16 730 octets, en gzip (section 8) |
| Durée du job | 2 668 s | 2 261 s |

Entre les deux, 114 commits, un par tâche. Les tests rouges ont été committés et vus rouges en CI avant chaque correctif. Seules exceptions, dites en section 2 : A29, le test unitaire d'A41 et T38, écrits dans le même run que leur correctif.

### Défauts trouvés en chemin, que la consigne ne nommait pas

1. **A41, Élevée, depuis le lot 3 : un visiteur sans compte ne pouvait pas commencer un achat.**
   - Le symptôme : sur la fiche, il ajoutait un billet et lisait « Total indisponible : Authentification requise ». Le bouton « Acheter » ne venait jamais.
   - La cause : `/api/checkout/quote`, route publique, était refusée par le middleware.
   - Personne ne l'avait vu : les tests appelaient la route sans le middleware, et la fumée achète en étant connectée.
   - C'est le parcours de recette chaîné qui l'a trouvée, au run 99. Corrigé par `c532ca7`, prouvé par l'acte 4 et par `finance-affichage` A41.
2. **Un second cycle de verrous, que le contrat avait manqué.**
   - Le scan tient le billet, puis l'enregistrement du scan veut un verrou sur la catégorie, par la clé étrangère `ticket_scans.category_id`. Dans le même temps, l'annulation de l'événement tient la catégorie et attend le billet.
   - Rouge au run 96 : `40P01 deadlock detected`.
   - `event_cancel` prend désormais ses catégories en `FOR NO KEY UPDATE` (`621c804`). Le tableau des verrous est rectifié (AM14, section 9).
3. **Messages bruts encore servis par l'API.**
   - A35 : `send-otp` renvoyait le texte du fournisseur SMS, par exemple « Requête refusée par le fournisseur SMS (HTTP 400) ».
   - A36 : un refus de remboursement affichait « Billet UTILISE : … ».
   - Les deux ont été vus rouges en CI (run 97), puis corrigés.
4. **A29 : une notification d'administration donnait un faux motif.** Elle annonçait « informations du bénéficiaire incomplètes » pour un solde SamirPay insuffisant.
5. **T6, un trou de couverture caché par le tableau legacy.**
   - L'invitation d'un contrôleur sur l'événement d'un autre partenaire était annoncée « couverte » à tort.
   - Retirer ce contrôle ne faisait échouer aucun test. Le cas est ajouté (`9642b7c`) et vu vert avant la suppression du dernier fichier legacy.
6. **Le libellé « commissions déduites » sur le net de l'organisateur**, alors qu'il ne paie aucune commission. C'est le même mensonge que le zéro retiré par 8.2 p (`e96dab4`).

### Décisions ★ à lire

- **L28, marquage simulé.**
  - `payments.simulated` et `cashouts.simulated` sont posés en base par un trigger, depuis l'en-tête `x-ev-simulation` du seul client service_role d'un serveur d'essai.
  - Un envoi d'argent est refusé, dans le code et en base, si la marque ne correspond pas au mode du serveur.
  - L'en-tête arrive bien jusqu'à PostgREST 16.5 : c'était SUPPOSÉ, c'est vérifié au run 95.
- **L30, même panier.**
  - Le second paiement réussi est remboursé quand il a les mêmes catégories, les mêmes quantités, le même compte et le même événement, et qu'il a été créé avant la confirmation du premier, sans limite de durée.
  - Un rachat fait après confirmation n'est jamais touché.
- **L34, ordre des verrous** : `events FOR NO KEY UPDATE → paiements → catégories → transferts → billets`. Conséquence : deux confirmations d'un même événement se sérialisent ; avant, elles se sérialisaient par catégorie.
- **L36, plafond des commissions.**
  - N1 = min(calcul, net), N2 = min(calcul, net − N1).
  - Le même budget vaut au remboursement partiel : c'est une extension de la consigne, avec l'exemple chiffré en section 7.

### Ce que je n'ai pas fait, ou pas prouvé

- **Migrations du lot 8 sur event-village-dev :** elles ne sont pas appliquées, je n'ai rien exécuté contre ce projet. Il faut les appliquer à la main avant tout essai manuel : `20261106000001` à `…06`, procédure de `docs/deploiement-projet-neuf.md`, section 3 ter. Il y a un contrôle à faire *avant* `db push`.
- **Guide d'essai et cahier de recette :** `docs/essai-local.md` et le cahier de 61 essais de `docs/recette-billetterie.md` n'ont été déroulés par personne contre event-village-dev. Ils sont relus contre le code, pas joués.
- **Relecture des captures :** c'est une relecture **par agents**, jamais par un humain (section 3). Les corrections ont été revues sur les images du run 105, et sur 9 images du run 107 pour les dernières.
- **Images à ne pas remettre au client en l'état :**
  - `cloche-ouverte` : le masque se décale, et un vrai QR reste visible sous le panneau ;
  - les champs `datetime-local` du formulaire de catégorie : ils s'affichent en format américain dans le Chromium Linux de la CI, mais en français sous Windows. C'est un écart documenté au titre de 8.2 t.
- **Anomalies listées, non corrigées, hors périmètre ou à arbitrer :** 27, dont :
  - **A30, Élevée** : `GET /api/partner/halls/[id]` ne contrôle ni rôle ni propriétaire. Tout compte connecté peut lire les réservations d'une salle et le téléphone du partenaire, quand le service salles est ouvert ; il est fermé aujourd'hui.
  - A24 : `/api/admin/audit` sert tout ADMIN, alors que la RLS le réserve au SUPERADMIN.
  - A33 : des écritures dont l'erreur est ignorée, dans `admin/permissions` et `partner/register`.
- **Ordre des verrous :** les points ouverts PO3 et PO4 restent couverts par `rpcWithRetry`. Aucun test ne joue ces deux cycles.
- **Questions au client, à trancher par toi :** Q1 à Q6, l'outil d'invitations, et le taux N2 (2 % appliqué, alors que l'Annexe A du cahier des charges dit 3 %). Voir la section 12.

### Écarts de méthode, signalés

- **Run 92 :** rouge, il manquait à l'addendum du rapport du lot 7. Il est dans le tableau des runs (section 6).
- **Runs ciblés :** pour mettre au point le parcours de recette, un mode `[recette-seule]` a été ajouté temporairement à la CI (`f6fcebd`). Il a servi aux runs 99 à 103, à 7 min l'essai au lieu de 40. Ces runs finissent toujours en échec, par construction : aucun ne compte comme preuve. Le mode est retiré (`ff4aae0`).
- **Tests existants modifiés :** une vingtaine hors de la liste du contrat, chacun avec avant, après et raison (section 1). Aucune assertion n'est retirée. Un seul contrôle est assoupli : `references` de `e2e/support/checks.ts`, limité au format `CLOTURE-xxxxxxxx-aaaammjj` de l'écran du rapport de clôture, que deux tests imposent.
- **Exécutions locales hors consigne :**
  - Un agent a monté un cluster PostgreSQL 14 jetable sur le poste pour éprouver M1. Ce cluster est local, arrêté puis supprimé, et ne touche aucun projet distant.
  - Un autre agent a vu `npm install --package-lock-only` réécrire `node_modules/.package-lock.json`. Il l'a restauré à l'identique (SHA-256 vérifié).
- **Commits :** deux messages sont inexacts et laissés tels quels, puisque `--amend` est interdit : `dff5778` annonce 16 corrections mineures au lieu de 23, et la phrase de `9212cca` est mal tournée.
- **`docs/lot0-inventaire-suites.md`** est gardé avec une mention historique, alors que le contrat le supprimait : deux rapports gelés y renvoient.

### Comment tester

Voir `docs/essai-local.md`. Après avoir appliqué les migrations du lot 8 sur event-village-dev, il y a deux façons de tester :
- **Mode A, simulé :** paiements simulés sur la page `/dev/paiements` (PC ou téléphone), avec `npm run seed:dev` et `npm run cron:local`.
- **Mode B, sur un build :** avec le faux SamirPay, sur `http://127.0.0.1:4010/`.

Le cahier de recette manuelle est dans `docs/recette-billetterie.md`.

---

## 1. Commits

114 commits depuis `7fdcb32` (point de départ de la branche, égal à `main`), du plus ancien au plus récent. Le dernier est `bc864fa`, qui porte le code final. Le commit de ce rapport viendra après le dernier de cette liste et ne changera que `docs/`.

**Run « après » de référence : le run 107** (`bc864fa`, job vert, 220 suites sur 220, toutes les phases e2e, dont `recette` avec 8 actes sur 8). Il porte le code final, après les dernières corrections de typographie. Les runs 105 (`a03abe6`) et 106 (`f488be0`) sont verts aussi : ce sont les deux runs sur un même code d'application qu'exige L82, le second ne changeant que `docs/`. `bc864fa` change ensuite trois composants et un libellé : le run 107 est donc le seul qui prouve ce code-là, et tous les extraits verts de cette partie viennent de lui.

Commande et sortie (liste complète dans le tableau qui suit) :

```text
$ git log --format='%h%x09%s' 7fdcb32..HEAD | wc -l
114
```

Répartition par type, comptée sur ces 114 lignes : `fix` 54, `test` 50, `docs` 6, `chore` 4.

La colonne « Run » donne les runs CI lancés sur ce commit (`scratchpad/runs-table.txt`, lu sur la branche `ci-results`). Le message est coupé à environ 175 caractères ; le texte complet est dans `git log`. La colonne « Tâche » est tirée du préfixe du message.

| # | Commit | Message (coupé) | Tâche | Run |
|---|---|---|---|---|
| 1 | ef2b36b | test(e2e)[run 92]: fumée, instabilité du run 92 corrigée seule, premier commit du lot 8 : check({ force: true }) sur le radio masqué (sr-only) de la modale de paiement le … | e2e, run 92 |  |
| 2 | a3858d4 | test(infra)[8]: infrastructure de test du lot 8 : tests/helpers/recette-invariants.ts (invariants (r)(s)(t), assertRecetteInvariants enveloppe assertTerrainInvariants, schéma … | infrastructure de test, lot 8 |  |
| 3 | 5e17de5 | test(e2e)[8]-coeur: cœur commun du faux SamirPay et du faux MTarget extrait vers scripts/e2e/fake-core.mjs pour le mode d'essai 8.1, sans effet à l'import ni garde (T29) … | e2e, lot 8, coeur |  |
| 4 | 1f5c16b | test(8.0): canaux de vente par catégorie, rouges : canaux-vente (contrôle en base sur RPC et routes, refus CATEGORY_NOT_SOLD_ONLINE et CATEGORY_NOT_SOLD_AT_COUNTER, rejeu … | 8.0 |  |
| 5 | f1bcb5d | test(8.1): mode d'essai, rouges : essai-integrations, essai-cron-local, essai-env-local, essai-seed-gardes, essai-faux-samirpay (sans base, 123 cas rouges sur le dépôt, tous … | 8.1 |  |
| 6 | d1d316e | test(8.2a): double paiement, rouges : double-paiement (10 cas : webhook tardif, cron, ordre inverse, rejeu, deux connexions, refus de l'opérateur, reprise après panne de … | 8.2 a |  |
| 7 | 9de80df | test(8.2b): ordre des verrous, rouges : course-confirmation-annulation (cycle réel payment_confirm contre event_cancel, ticket_scan, checkout_create_payment … | 8.2 b |  |
| 8 | 19be519 | test(8.2c): plafond des commissions, rouges : commissions-plafond (N1 et N2 plafonnées au net, uncapped_amount, frais à 0 %, remboursement partiel, N1 déjà versée, budget qui … | 8.2 c |  |
| 9 | a6a5dde | test(8.2d): invariants (r)(s), rouges : recette-invariant (violations fabriquées en transaction annulée, garde-fous de chaque règle) | 8.2 d |  |
| 10 | 9398e35 | test(8.2e): replay_only du scan, rouges : scan-renvoi-seulement (route et RPC : aucune écriture en renvoi, not_processed, indicateur mal formé, verrou advisory) … | 8.2 e |  |
| 11 | 3fd6b94 | test(8.2f): écart de caisse rendu au refus de clôture, rouge : dette-cloture-caisse adapté (T14 : JUSTIFICATION_REQUIRED et PIN_REQUIRED portent expected, declared … | 8.2 f |  |
| 12 | ea71aa0 | test(8.2g): diagnostics Realtime, rouge : realtime-diagnostic (statut du conteneur dans les messages d'échec, délais inchangés) | 8.2 g |  |
| 13 | 765ee91 | test(8.2h): vrai 404 d'un événement non public, rouge : evenement-404 (7 statuts, UUID inconnu, identifiants non UUID, panne de lecture) | 8.2 h |  |
| 14 | a3830da | test(8.2i-k): messages bruts et profil contrôleur, rouges : tests/schema/messages-bruts (contrôle statique avec auto-contrôle, 62 fautes imprimées fichier:ligne) … | 8.2 i et k |  |
| 15 | 15aeb6d | test(8.2j): messages des redirections du middleware, rouges : acces-messages (table exacte, clé inconnue non affichée, AccessNotice rendu) ; r6-roles-jeton adapté (T19 … | 8.2 j |  |
| 16 | 4f4541f | test(8.2l): PATCH /api/partner/profile atomique, rouge : partenaire-profil-rpc (une seule RPC transactionnelle, panne simulée, 11 colonnes, activités, liste fermée) | 8.2 l |  |
| 17 | 2923be4 | test(8.2m): lien de PAYMENT_SUCCESS d'un abonnement, rouges : notif-abonnement ; notif-modeles adapté (T7 : second lien admis et compensé par deux tests exacts, type … | 8.2 m |  |
| 18 | e6157ae | test(8.2n): SMS_OPTIONAL_80 et SMS_FORECAST au rechargement en direct, rouges : notif-interface adapté (T10 : filtre à quatre valeurs), temps-reel-prives adapté (T11 … | 8.2 n |  |
| 19 | 6f76c8d | test(8.2o): mention « service désactivé » sur /admin/services, rouge : admin-services-mention (statique, éprouvée sur six copies de la page dont trois fausses) | 8.2 o |  |
| 20 | 88ae17e | test(8.2p): commissionAmount retiré, rouges : partenaire-lot7 adapté (T13 : message périmé, assertion identique, nouveau describe) ; finance-hors-plateforme adapté (T12 … | 8.2 p |  |
| 21 | 3c9326e | test(8.2q): police à chasse fixe et tabular-nums, rouges : design-systeme durci (T16) : font-mono réservé par le dictionnaire MONO_ALLOWED et le contenu MONO_CONTENT, tout … | 8.2 q |  |
| 22 | 78756fe | test(8.2r): ClosingReportModal migré, rouges : design-systeme adapté (T16 : retiré de PRE_LOT5_UI_FILES, describe 8.2 r : mention CDC retirée de l'écran et du PDF … | 8.2 r |  |
| 23 | cd4326e | test(8.2s): barre d'achat fixe, rouge : perf-statique adapté (T17, ajouts seuls) : .ev-page-enter en backwards, sans will-change, avec isolation: isolate, aucune propriété … | 8.2 s |  |
| 24 | 3687cc0 | test(8.2v)[ports]: suites legacy, cas uniques portés (53 tests, annoncés verts sauf l'anomalie A23) : legacy-billet-pdf, legacy-exports-partenaire, equipe-eligibilite … | 8.2 v, ports |  |
| 25 | c805751 | test(8.2x): lot hors ligne réellement compressé, rouge : hors-ligne-codes adapté (T18 : gzip, Vary, no-store, 8 640 codes sous 40 000 octets, [HORS-LIGNE-TRANSFERE] ; T39 … | 8.2 x |  |
| 26 | 1c9807a | test(8.3)[anomalies]: anomalies à corriger, rouges : admin-parrainage (A1 fausse sauvegarde), parrainage-lien (A2 lien mort et code recalculé au lieu d'être lu en base) … | 8.3 d, rouges des anomalies |  |
| 27 | 2769248 | test(8.3)[garde-fous]: preuves ajoutées, annoncées vertes dès l'écriture : parrainage-gardes (A11 : auto-parrainage et boucles), decouverte-recherche (A14 : q et city de la … | 8.3 d, preuves A11, A14, A15 |  |
| 28 | db21d1c | test(e2e)[8]: captures nouvelles écrites avant les correctifs (37), dont /admin/services et ClosingReportModal jamais passés aux contrôles bloquants ; phases dev-page et … | e2e, lot 8 | 95 (échec) |
| 29 | b7b1170 | test(8.2v)[suppression]: 25 suites de tests/legacy supprimées sur 26 (T35), tableau 12.1 relu ligne à ligne et cas portés lus au run 95 : verts, sauf les deux rouges de … | 8.2 v, suppression |  |
| 30 | 310a4d8 | fix(8.1s): mode d'essai côté serveur et scripts. M2 marque payments et cashouts simulés depuis l'en-tête x-ev-simulation, envoyé par le seul client service_role d'un serveur … | 8.1 (serveur) |  |
| 31 | b75d6c7 | fix(8.2j-s): redirections du middleware. Un connecté n'est plus jamais renvoyé vers /login?error=, qui le renvoyait vers son espace : boucle pour un CONTROLEUR SUSPENDU à la … | 8.2 j (serveur) |  |
| 32 | 14501cf | fix(8.2b): ordre unique des verrous, events FOR NO KEY UPDATE puis paiements, catégories, transferts, billets (L34). M3 recopie payment_confirm, qui prend l'événement avant … | 8.2 b |  |
| 33 | bf196db | fix(8.2a): le second paiement réussi d'un même panier est remboursé par le cashout existant, avec avis REFUND_PAID et alerte ADMIN_DUPLICATE_PAYMENT, sous le verrou de … | 8.2 a |  |
| 34 | 48f2e44 | fix(8.2m): la notification PAYMENT_SUCCESS d'un abonnement mène à /partner/subscription au lieu de /orders (L57). M3 ajoute payment_target aux données de … | 8.2 m |  |
| 35 | 6611462 | fix(8.2c): les commissions d'une vente ne dépassent plus le revenu net d'Event Village (AR5, L36). M4 plafonne N1 = min(calcul, net) et N2 = min(calcul, net − N1), et garde … | 8.2 c |  |
| 36 | a2731ec | fix(8.0s): canaux de vente par catégorie, côté serveur. M1 ajoute sale_online et sale_counter, is_visible restant le miroir de sale_online par trigger (L5) … | 8.0 (serveur) |  |
| 37 | 9212cca | fix(8.2e-s): mode renvoi seulement du scan, côté serveur. M5 recopie ticket_scan avec replay_only dans p : clé absente refusée avant toute écriture, aucune ligne forbidden en … | 8.2 e (serveur) |  |
| 38 | 7f00305 | fix(8.2f): la clôture refusée pour JUSTIFICATION_REQUIRED ou PIN_REQUIRED rend l'écart à l'écran. closeShift calcule expected, declared et discrepancy = déclaré − attendu … | 8.2 f |  |
| 39 | fb58820 | fix(8.2x): le lot hors ligne part réellement compressé. next start ne compresse aucune route API, Content-Type posé en tableau et refusé par compressible(), le lot de 48 h … | 8.2 x |  |
| 40 | 3cbb135 | fix(8.2h): un événement non public répond un vrai 404 HTTP. Layout serveur app/events/[id]/layout.tsx, force-dynamic : identifiant non UUID, ligne absente ou statut non … | 8.2 h |  |
| 41 | 44ccf4f | fix(8.2i-1): socle des messages publics, liste blanche par classe (contrat 3.8, L51). lib/api/public-error.ts : PublicError et apiFailure, tout ce qui n'est pas PublicError … | 8.2 i, lot 1 |  |
| 42 | 57eb9b1 | fix(8.2i-2): routes admin, le texte de la base ne part plus au navigateur (contrat 9, 23 puits). audit, communications, finance/reconciliation, metrics, partners … | 8.2 i, lot 2 |  |
| 43 | 7a074fb | fix(8.2i-3): routes d'authentification, parrainage, paiement et inscription partenaire (contrat 9, 8 puits). resolve-phone, send-otp, sign-out-global, verify-otp, my-stats et … | 8.2 i, lot 3 |  |
| 44 | 9a92e59 | fix(8.3-A3s): les remboursements à reprendre ont enfin une liste côté serveur (A3, contrat 3.10, L88). GET /api/admin/refunds?state=to_retry, permission refunds.manage, sert … | 8.3 d, A3 (serveur) |  |
| 45 | c1eabd6 | fix(8.3-A4s): le pilotage peut retrouver un billet à rembourser par son numéro (A4, contrat 3.11, L89). GET /api/partner/events/[id]/tickets/lookup?number=TCK-… reprend les … | 8.3 d, A4 (serveur) |  |
| 46 | 958e70e | fix(8.2k): une panne de lecture du profil contrôleur n'est plus présentée comme une liste vide ni comme un profil absent (contrat 3.9). GET /api/controller/profile : panne … | 8.2 k |  |
| 47 | 322ff97 | fix(8.2l): PATCH /api/partner/profile écrit la fiche et les activités en une seule transaction. M6 crée partner_profile_update(p jsonb) : fiche verrouillée sur (id, user_id) … | 8.2 l |  |
| 48 | b92928e | fix(8.3-A2s): le lien de parrainage mène enfin à l'inscription, côté serveur (contrat 3.12, AM6). my-stats rend <NEXT_PUBLIC_APP_URL>/register?ref=<code> lu par … | 8.3 d, A2 (serveur) |  |
| 49 | f2b2c8b | fix(8.2g): temps-reel-billets, un échec Realtime dit enfin si le conteneur tournait (contrat 7.3, L48, T32). tests/helpers/realtime.ts : realtimeDiagnostics() lit statut … | 8.2 g |  |
| 50 | c7df4f0 | fix(8.2i-4): routes de finance, d'indicateurs, de rapports et d'événement du partenaire, le texte de la base ne part plus au navigateur (contrat 9, 8 puits). finance … | 8.2 i, lot 4 |  |
| 51 | db8c2c1 | fix(8.2i-5): routes salles, commandes, produits et tables du partenaire, plus aucun texte de la base au navigateur (contrat 9, 23 puits). Les 12 fichiers répondent par … | 8.2 i, lot 5 |  |
| 52 | ae66fbf | fix(8.2p): plus aucun zéro en dur présenté comme une commission au partenaire (contrat 10.4, L60, L64). commissionAmount retiré des deux types et des deux objets du tableau … | 8.2 p |  |
| 53 | 1fa3fe9 | fix(8.3-A23): l'export comptable ne s'évalue plus dans un tableur et le refus du PDF de billet ne montre plus de statut technique (AM1). csvField préfixe d'une apostrophe … | 8.3 d, A23 |  |
| 54 | 565103f | chore(8.1): les scripts du mode d'essai s'appellent enfin par npm run (contrat 5.2). package.json : seed:dev, cron:local, fake:samirpay, essai:build, essai:start, branchés … | 8.1 |  |
| 55 | 9d844d0 | fix(8.2w): legacy-peer-deps retiré, le lock est refait sans l'option par npm 10.9.9, la version de la CI (contrat 12.2, L70, AM10, T38). .npmrc supprimé ; npx -y npm@10.9.9 … | 8.2 w |  |
| 56 | 9642b7c | test(8.2v)[T6]: l'invitation d'un contrôleur sur l'événement d'un autre partenaire est enfin testée (tableau 12.1, ligne 10). Cas ajouté à equipe-eligibilite, seul et mêlé à … | 8.2 v, T6 |  |
| 57 | efa07a6 | test(8.1): anonymisation-debogage admet app/api/dev à une condition plus forte que le refus du seul nom (test existant modifié, signalé au rapport). fix(8.1s) crée ce … | 8.1 |  |
| 58 | 2f79c3d | test(8.3-A29): ADMIN_REFUND_TO_RETRY d'un remboursement bloqué pour solde insuffisant doit nommer le solde. Rouge : BLOCKED_REASON_LABELS n'a pas ce code, la notification … | 8.3 d, A29 |  |
| 59 | f2334de | fix(8.3-A29): la notification ADMIN_REFUND_TO_RETRY dit enfin « solde insuffisant » au lieu d'un bénéficiaire incomplet. BLOCKED_REASON_LABELS reçoit SOLDE_INSUFFISANT, même … | 8.3 d, A29 |  |
| 60 | 8f77b1b | docs(lot8): journaux bruts du run « avant » (run 95, sha db21d1c, 172 suites vertes sur 219, 47 rouges attendues), triage par suite et par test | lot 8 (journaux CI) | 96 (échec) |
| 61 | 2f9f4b1 | fix(8.0e): le partenaire règle « Vendue en ligne » et « Vendue au guichet » par catégorie, avec aide reliée par aria-describedby et résumé categoryChannelLabel, le guichet … | 8.0 (écran) |  |
| 62 | 4cc9959 | fix(8.2e-c): un scan repris au retour dans l'application n'envoie plus que { eventId, replayOnly: true } avec sa clé d'origine, relances comprises, et ne peut plus composter … | 8.2 e (client) |  |
| 63 | e4995c0 | fix(8.2q): part du scanner portée par E1 (contrat 11.1) : heure de « Résultat retrouvé » sur le plein écran et la carte, montant du bouton d'encaissement en tabular-nums … | 8.2 q |  |
| 64 | 18c69b8 | fix(8.3-A4e): le partenaire rembourse enfin un billet depuis l'onglet Ventes : TicketRefundPanel cherche le numéro, montre la fiche, demande le motif par ReasonDialog puis le … | 8.3 d, A4 (écran) |  |
| 65 | f9cc0c8 | fix(8.2q): font-mono n'est plus porté que par les numéros de billets, les références, les codes et le JSON du journal d'audit : les 34 autres usages passent en police … | 8.2 q |  |
| 66 | 1e8dc05 | fix(8.2n): la page Notifications d'admin se recharge aussi sur SMS_OPTIONAL_80 et SMS_FORECAST : le filtre admin_signals passe à quatre valeurs (contrat 10.2), sinon l'alerte … | 8.2 n |  |
| 67 | bdb2cb1 | fix(8.2o): /admin/services dit enfin quand un service est fermé : CatalogPanel lit useFeatureFlags, TAB_FLAG relie salles à halls, tables à tables, produits et commandes à … | 8.2 o |  |
| 68 | 3fa31ed | fix(8.3-A1): /admin/referral n'annonce plus une sauvegarde qui n'existait pas : le bouton « Taux & Durée » et sa modale, dont le toast de réussite ne suivait aucun appel … | 8.3 d, A1 |  |
| 69 | 82ca88d | fix(8.2r): le rapport de clôture entre dans le système de design : jetons, KpiCard, DataList (tableau dès md, cartes en dessous), DefinitionRow sur bg-surface-sunken à la … | 8.2 r |  |
| 70 | bb2cd0c | fix(8.2s): .ev-page-enter passe en backwards, perd will-change: transform et prend isolation: isolate : l'enveloppe de chaque page ne retient plus les position: fixed, et la … | 8.2 s |  |
| 71 | 404d06a | fix(8.3-A13): une lecture échouée du journal d'audit, refus HTTP comme panne réseau, ne se déguise plus en « Aucun enregistrement » : l'écran passe par ErrorState avec … | 8.3 d, A13 |  |
| 72 | 161697f | fix(8.2j-e): l'accueil dit enfin pourquoi un espace a été refusé : AccessNotice lit ?error= par useSearchParams, sous <Suspense fallback={null}> dans app/page.tsx, et affiche … | 8.2 j (écran) |  |
| 73 | 2506b89 | fix(8.3-A3e): l'admin voit et relance enfin les remboursements en panne sur /admin/finance : RefundsToRetry lit GET /api/admin/refunds?state=to_retry, « Relancer » n'existe … | 8.3 d, A3 (écran) |  |
| 74 | b57441c | fix(8.2q): part d'E3 (contrat 11.1) : l'écart de la carte mobile de /admin/finance et le nombre de jours de /admin/notifications passent en tabular-nums, pour que les … | 8.2 q |  |
| 75 | 5a6dcbc | fix(8.3-A3e): une relance refusée en 403 n'affiche plus le nom technique de la permission que verifyAdminAuth met dans son message : RefundsToRetry écrit un texte français … | 8.3 d, A3 (écran) |  |
| 76 | b72003f | fix(8.2i-6): plus aucun texte anglais de Supabase Auth ni « Failed to fetch » à l'écran : LoginForm et /reset-password décident sur error.code et ses messages français … | 8.2 i, lot 6 |  |
| 77 | 407d09c | fix(8.3-A2e): le lien de parrainage parraine enfin : /register lit ?ref= dans le navigateur, comme redirect et sans useSearchParams, préremplit le code en majuscules, borné … | 8.3 d, A2 (écran) |  |
| 78 | 51d96fb | fix(8.1e): l'utilisateur peut enfin valider ou refuser un paiement simulé depuis le PC comme depuis le téléphone : /dev/paiements liste les paiements en attente lus sur le … | 8.1 (écran) |  |
| 79 | b405bab | test(8.2n): notif-interface accepte un chiffre dans le nom d'un signal (test existant corrigé, signalé au rapport). Le motif [A-Z_]+ refusait SMS_OPTIONAL_80 que le contrat … | 8.2 n |  |
| 80 | 02e331f | test(8.3-A35): un refus du fournisseur SMS ne doit plus arriver à l'écran. send-otp recopie sendResult.error dans sa réponse 502 (« Requête refusée par le fournisseur SMS … | 8.3 d, A35 |  |
| 81 | ef3e9fa | test(8.3-A36): le refus de rembourser un billet utilisé ne doit plus montrer le statut technique. ticket_refund_request écrit « Billet UTILISE : … » (migration gelée du lot … | 8.3 d, A36 |  |
| 82 | 5d4cdb7 | test(8.2v)[suppression]: dernier fichier legacy supprimé, fin de la quarantaine (T35, T36). T6 vu vert au run 96, ligne 10 soldée, tests/legacy n'existe plus. Retirés … | 8.2 v, suppression |  |
| 83 | 5586bf1 | test(8.2l): partenaire-profil-rpc compare les activités triées (test du lot corrigé, signalé au rapport). Sa lecture par .order('activity_type') suit l'ordre de l'enum, où … | 8.2 l |  |
| 84 | 621c804 | fix(8.2b): second cycle de verrous levé, ticket_scan contre event_cancel (rouge du run 96, point ouvert 11). Le contrat 2.3 avait manqué ticket_scans.category_id : l'INSERT … | 8.2 b | 97 (échec) |
| 85 | 0e7abcb | fix(8.0-seed): le seed de démonstration écrit les canaux du lot 8 (T31, L80). createEvent pose sale_online et sale_counter à la place de is_visible ; « ce soir » reçoit une … | 8.0 (seed, T31) |  |
| 86 | 459448c | test(8.3)[outils]: préparation de la recette, AM3 puis T25 et T26. POST /__test/samirpay/balance { solde } rejoint control de fake-core.mjs, entier positif ou nul exigé, pour … | 8.3 b, outillage (AM3, T25, T26) |  |
| 87 | f58af05 | docs(8.1): guide d'essai local pour Windows et déploiement à jour (contrat 5.6, 19, ligne D1 de 18.1). docs/essai-local.md, pas à pas sans valeur réelle : modes A et B … | 8.1 |  |
| 88 | f7d8c5d | test(8.3b): e2e/recette.spec.ts, les 8 actes du contrat 15.5 en mode serial sur la base du seed e2e, étiquetés [client], [partenaire], [contrôleur], [admin] : réglages du … | 8.3 b |  |
| 89 | aba8029 | test(e2e)[8]-captures: captures alignées sur les écrans livrés (contrat 15.6), aucun seuil relâché. partenaire-rapport-cloture exige les libellés de fix(8.2r) et ramène le … | e2e, lot 8, captures |  |
| 90 | a8c653b | test(8.2b): course-confirmation-annulation cas 6 exige FOR NO KEY UPDATE sur les catégories (test du lot renforcé, signalé au rapport). Il cherchait FOR UPDATE, ce que le … | 8.2 b |  |
| 91 | 15dc7d0 | fix(8.3-A35): send-otp ne recopie plus le texte du fournisseur SMS dans sa réponse 502 (A35, rouge au run 97). Texte fixe en français, détail au journal seulement. LoginForm … | 8.3 d, A35 |  |
| 92 | ffc0167 | fix(8.3-A36): le refus de rembourser un billet utilisé ne montre plus le statut technique (A36, rouge au run 97). La route remplace le message de ticket_refund_request par un … | 8.3 d, A36 |  |
| 93 | 9af8e75 | docs(8.3a): docs/recette-billetterie.md, matrice de traçabilité du CDC V3.0 sur 106 lignes (46 fait, 37 partiel, 3 non fait, 6 écarté, 14 hors périmètre), code et test par … | 8.3 a |  |
| 94 | 6f00501 | docs(8.3c): cahier de recette manuelle ajouté à docs/recette-billetterie.md pour un non-développeur sur event-village-dev, 61 essais numérotés (ordinateur et téléphone) … | 8.3 c |  |
| 95 | d5aa4e5 | test(8.3a): tests/schema/recette-matrice.test.ts, sans base, empêche la matrice de dériver : statuts de la légende, résumé égal aux lignes, fichiers et lignes cités … | 8.3 a |  |
| 96 | a7b4539 | fix(8.2r): le rapport de clôture défile enfin au clavier (axe scrollable-region-focusable, relevé par E2E au run 96). Le corps du modal n'a plus aucun élément focalisable … | 8.2 r |  |
| 97 | 6ea04e4 | fix(8.1): l'aide de cron-local donne une commande qui marche sous PowerShell 5.1. npm.ps1 y perd le « -- » (essai de D1) : l'en-tête et le message d'erreur citent désormais … | 8.1 | 98 (échec) |
| 98 | 0de9979 | test(8.3b)[selecteurs]: e2e/recette.spec.ts relu pas à pas contre le JSX et les routes des actes 2 à 8 après le rouge du run 98. Acte 2 : le dossier ouvre « Valider la … | 8.3 b, selecteurs |  |
| 99 | f6fcebd | chore(ci): run ciblé temporaire [recette-seule], pour mettre au point le parcours de recette sans 40 min par essai. Un commit portant ce marqueur remplace verify par le seul … | CI (verify.yml) | 99 (échec) |
| 100 | 697f9ec | test(8.3-A41): le devis d'un visiteur doit traverser le middleware. Rouge prouvé par le run 99, acte 4 de la recette : sur la fiche, un visiteur ajoute un billet et lit « … | 8.3 d, A41 |  |
| 101 | c532ca7 | fix(8.3-A41): un visiteur sans compte peut enfin commencer un achat depuis la fiche. /api/checkout/quote, route publique du lot 3, entre dans PUBLIC_API_EXACT du middleware. … | 8.3 d, A41 | 100 (échec) |
| 102 | dff5778 | fix(8.2u)[relecture]: corrections de la relecture des captures du run 98 : mots des boutons séparés (Button sans tracking-tight, word-spacing 0,1 em), barre d'achat collée à … | 8.2 u, relecture |  |
| 103 | e7512f4 | test(e2e)[8]-captures: caisse-cloture-ecart lit le montant enregistré au lieu de 43 000 en dur (relevé par la relecture : 55 000 enregistrés, 43 000 comptés, écart de -2 000 … | e2e, lot 8, captures |  |
| 104 | 86868ae | test(8.3b): l'acte 5 relit le numéro du billet après le transfert, que ticket_transfer_accept renouvelle (run 100 : « Aucun billet de cet événement ne porte ce numéro »). … | 8.3 b | 101 (échec) |
| 105 | 40e2473 | test(8.3b): l'acte 6 lit le fichier réellement téléchargé au lieu du corps de la réponse (run 101 : corps vide côté Playwright, l'écran passe par fetch puis un lien de … | 8.3 b | 102 (échec) |
| 106 | f4a66d0 | test(8.3b): l'acte 8 contrôle le statut du PATCH de suspension et le badge à l'écran au lieu de lire le corps (run 102 : suspension réussie à l'écran, mais /admin/users ne … | 8.3 b | 103 (échec) |
| 107 | ff4aae0 | chore(ci): run ciblé retiré, verify.yml revient à son état d'avant f6fcebd. Il a servi aux runs 99 à 103, 7 min par essai contre 40, et n'a jamais pu passer pour une preuve … | CI (verify.yml) | 104 (échec) |
| 108 | e96dab4 | fix(8.2p): la carte « Montant net organisateur » ne parle plus de commissions déduites, le modèle n'en prélève aucune sur l'organisateur (contrat 10.4). Vu en relisant la … | 8.2 p |  |
| 109 | da0dcef | test(lot8): les 7 dernières suites tirant un numéro par Math.random passent par randomSenegalPhone (suites existantes modifiées, signalé au rapport). Run 104 … | lot 8 |  |
| 110 | a03abe6 | chore(ci): délai du job ramené de 75 à 60 min (L77). Quatre runs sous 50 min : 96 2 318 s, 97 2 536 s, 98 2 261 s, 104 2 180 s, recette comprise au dernier. Délai de l'étape … | CI (verify.yml) | 105 (vert) |
| 111 | 0a6e83d | docs(8.3a): matrice et anomalies sur le run 105 : 46 fait (46 prouvées au run 105), 37 partiel, 3 non fait, 6 écarté, 14 hors périmètre ; anomalies 11 corrigées dont A41, 3 … | 8.3 a |  |
| 112 | 208d8df | test(8.3a): recette-matrice connaît A41, trouvée après son écriture. Bornes passées de 40 à 41, A41 ajoutée aux corrigées, qui exigent un test cité vert. Contrôle plus large … | 8.3 a |  |
| 113 | f488be0 | docs(lot8): journaux bruts du run « après » (run 105, sha a03abe6, job vert, 220 suites sur 220, e2e complet) | lot 8 (journaux CI) | 106 (vert) |
| 114 | bc864fa | fix(8.2u)[relecture]: ponctuation jamais seule en début de ligne (3 défauts vus sur les images du run 105, la correction des gouttières et des espaces ayant déplacé les … | 8.2 u, relecture | 107 (vert) |

Les runs 92 à 94 portent sur `7fdcb32`, avant le premier commit du lot : 92 en échec (fumée), 93 et 94 verts.

### Tests existants modifiés (signalement)

Règle de la consigne : « Aucun test existant affaibli. Toute modification d'un test existant est signalée et justifiée. » Chaque fichier ci-dessous a été retrouvé par `git diff --name-status 7fdcb32..HEAD -- tests e2e playwright.config.ts scripts .github`, puis par `git log` fichier par fichier. Les lignes retirées (`git diff 7fdcb32..HEAD -- <fichier> | grep '^-'`) ont été relues pour chaque fichier : aucune assertion n'est retirée sans être remplacée par une assertion égale ou plus stricte, sauf l'assouplissement ciblé de `e2e/support/checks.ts`, dit en B.15. Pour T16, T20, T21 à T30 et T34, j'ai relu les lignes retirées et le message de commit, pas chaque ligne ajoutée.

La colonne « Run 107 » vient du récapitulatif de `docs/lot8-logs/ci-run107-verify.log` (extrait brut à la fin de cette sous-section) ou, pour l'e2e, de `docs/lot8-logs/ci-run107-e2e.log`.

**A. Liste du contrat (section 17, T1 à T38)**

| # | Fichier | Commit | Avant → après | Raison | Run 107 |
|---|---|---|---|---|---|
| T1 | `e2e/fumee.spec.ts:411` (aujourd'hui `:91`, après l'extraction T25) | ef2b36b | `check({ force: true })` sur le radio masqué Wave → `dispatchEvent('click')` puis `expect(wave).toBeChecked()` | Instabilité du run 92 (A20), vert aux runs 93 et 94 sur le même commit ; premier commit du lot, seul (AR2, L78). Une vérification ajoutée, rien de relâché | fumée OK |
| T2 | `tests/schema/migration-lot7-rejouable.test.ts` | a3858d4 | Gel SHA-256 étendu aux sept migrations `20261105…` (`FROZEN_LOT7`) ; message « toute correction passe par une migration 20261106… » | Gel étendu (consigne) | PASS |
| T3 | `tests/security/r3-fonctions-rpc.test.ts` | a3858d4 | `LOT8_RPCS` ajoutées (39 lignes ajoutées, 0 retirée) | Fonctions nouvelles, refusées en 42501 | PASS |
| T4 | `tests/helpers/design-files.ts` | a3858d4 | Section « Lot 8 » ajoutée (17 lignes, 0 retirée) | Nouveaux `.tsx` (contrat 16.3) | — (aide) |
| T5 | `tests/parcours/paiement-controles.test.ts:62` | 1f5c16b | `CATEGORY_NOT_VISIBLE` → `CATEGORY_NOT_SOLD_ONLINE` | Code imposé par 8.0 ; refus identique (400, aucun paiement, aucun appel) | PASS |
| T6 | `tests/parcours/acces-tracabilite.test.ts` | 9398e35 | `not_processed` ajouté à `CONTRACT_RESULTS` | Union exacte des résultats (L42) | PASS |
| T7 | `tests/parcours/notif-modeles.test.ts` | 2923be4 | Lien de `PAYMENT_SUCCESS` : `['/orders']` → liens admis `/orders` et `/partner/subscription` ; type `ADMIN_DUPLICATE_PAYMENT` au catalogue attendu ; `const e = catalog[exp.type]` réécrit 9 fois | Consigne m ; liste exacte imposée par la suite | PASS |
| T8 | `tests/parcours/notif-outbox.test.ts` | d1d316e | Une ligne ajoutée : `ess('ADMIN_DUPLICATE_PAYMENT', …, 'refunds.manage')` | Registre exact (L32) | PASS |
| T9 | `tests/parcours/notif-migration.test.ts` | a3858d4 | Types émis par `payment_confirm` : `+ 'ADMIN_DUPLICATE_PAYMENT'` | La RPC émet l'alerte du double paiement | PASS |
| T10 | `tests/parcours/notif-interface.test.ts` | e6157ae | Filtre de la page Notifications : `NOTIFICATION_FAILED, SMS_DAILY_THRESHOLD` → `+ SMS_OPTIONAL_80, SMS_FORECAST` ; titre du test complété | Consigne n | PASS |
| T11 | `tests/parcours/temps-reel-prives.test.ts` | e6157ae | Ajout : abonnement admin avec le filtre lu dans la page (69 lignes ajoutées ; seule ligne retirée : un import inutilisé) | Consigne n | PASS |
| T12 | `tests/parcours/finance-hors-plateforme.test.ts:84` | 88ae17e | `commissionAmount: Number(dk.commissionAmount)` retiré | Champ supprimé par 8.2 p ; la ligne serait restée verte sur `NaN` | PASS |
| T13 | `tests/parcours/partenaire-lot7.test.ts:754` | 88ae17e | Message d'échec de l'assertion « Commissions EV » réécrit (assertion identique) ; ajouts : champ absent de l'API | Consigne p | PASS |
| T14 | `tests/parcours/dette-cloture-caisse.test.ts` | 3fd6b94 | Assertions ajoutées : `expected`, `declared`, `discrepancy` au refus de clôture | Consigne f | PASS |
| T15 | `tests/parcours/dette-interface-lot7.test.ts` | a3830da | `const POSTGRES_TEXT_RE` → `export const POSTGRES_TEXT_RE` | Réutilisée par `messages-bruts` | PASS |
| T16 | `tests/parcours/design-systeme.test.ts` | 3c9326e, 78756fe | Règle `font-mono` (`MONO_ALLOWED`) et `tabular-nums` ; `ClosingReportModal` retiré de `PRE_LOT5_UI_FILES` (seule ligne retirée) | Consignes q et r ; plus strict | PASS |
| T17 | `tests/parcours/perf-statique.test.ts` | cd4326e | Ajouts seuls : `.ev-page-enter` | Consigne s | PASS |
| T18 | `tests/parcours/hors-ligne-codes.test.ts` | c805751 | Ajouts 13 à 15 : gzip, `Vary`, `no-store`, 8 640 codes sous 40 000 octets, `[HORS-LIGNE-TRANSFERE]` ; seuil `:325` gardé. Le test 10 est traité en B.1 | Consigne x | PASS |
| T19 | `tests/security/r6-roles-jeton.test.ts` | 15aeb6d | `/controller/scanner` ajouté à `PROTECTED` ; 5 cas ajoutés (contrôleur suspendu, boucle, panne de lecture du statut) ; titre « /admin, /partner et /scan » → « …, /scan et /controller/scanner » | Consigne j (L53) | PASS |
| T20 | `tests/parcours/scanner-interface.test.ts` | 9398e35 | `FetchCall` enregistre aussi le corps ; `describe` 8.2 e (`replayOnly`) et 8.2 v (ports legacy 2 et 20) | Consigne e, legacy 2 et 20 | PASS |
| T21 | `e2e/support/screens.ts` (404) | db21d1c | `expectStatus` ajouté : 200 pour les fiches publiées, suspendues, annulées, terminées ; 404 pour non public, inconnu, identifiant invalide | HTTP 200 avant 8.2 h ; durci | captures OK |
| T22 | `e2e/support/screens.ts` (clôture) | db21d1c | Réponse simulée de `shifts/close` : statut 409 → 400 | Fidélité : le faux 409 masquait le défaut f | captures OK |
| T23 | `e2e/support/screens.ts` (guichet) | db21d1c | Attente de la mention « Sur place uniquement » | 8.0 ; durci | captures OK |
| T24 | `e2e/support/checks.ts` | db21d1c | Valeurs ajoutées à `RAW_ENUM_VALUES` | Plus strict. L'ajout de `references` (aba8029) est traité en B.15 | captures OK |
| T25 | `e2e/fumee.spec.ts` | 459448c, db21d1c | Outils extraits vers `e2e/support/parcours.ts` (212 lignes retirées, 38 ajoutées), corps identiques selon l'agent ; 404 de `/dev` | 8.3, 8.1 | fumée OK |
| T26 | `e2e/terrain.spec.ts` | 459448c, db21d1c | `expectResumed` importé ; mesures s, x, e, f ajoutées (220 lignes ajoutées, 12 retirées) | 8.3, 8.2 | terrain OK (13 sur 13) |
| T27 | `playwright.config.ts` | db21d1c | Drapeau de langue sur `mobile` et `desktop` ; projets `dev-page`, `fake-prod`, `recette` | 8.2 t (L66), 8.3 | toutes phases OK |
| T28 | `scripts/e2e/run-e2e.mjs` | db21d1c | Phases `fake-prod`, `dev-page`, `recette` | L29, 8.3 | toutes phases OK |
| T29 | `scripts/e2e/fake-services.mjs` | 5e17de5, 459448c | Cœur extrait vers `scripts/e2e/fake-core.mjs` (217 lignes retirées, 28 ajoutées) ; `POST /__test/samirpay/balance` (AM3) | 8.1, A3 | toutes phases OK |
| T30 | `scripts/e2e/start-app.mjs` | db21d1c | Contrôle de la sentinelle `EV_DEV_ADAPTERS_SENTINEL_LOT8` dans `.next` | L29 | fake-prod OK |
| T31 | `tests/seed/seed-demo.ts` | 0e7abcb | Canaux écrits (`sale_online`, `sale_counter`), catégorie sans canal sur `ceSoir`, `assertTerrainInvariants` → `assertRecetteInvariants` | 8.0, section 14 ; commit de correctif (L80) | e2e-seed success |
| T32 | `tests/helpers/realtime.ts` | f2b2c8b | `realtimeDiagnostics()` : états du canal, heure, statut du conteneur dans le message d'échec ; délais inchangés | Consigne g (L48) | — (aide) |
| T33 | `tests/parcours/course-annulation-transfert.test.ts` | 9de80df | Commentaires seulement : « FOR UPDATE » complété par « FOR NO KEY UPDATE depuis le lot 8 » (diff relu : aucune ligne de code) | 8.2 b | PASS |
| T34 | `activation-controleur`, `dette-retrait-controleur`, `acces-scan`, `dette-transferts`, `anonymisation-debogage`, `paiement-gratuits`, `edition-categories`, `confirmation-achat`, `finance-rapports`, `roles-fraicheur` | 3687cc0 | Cas legacy portés, ajoutés ; seules des lignes d'import sont retirées (regroupées) | 8.2 v | PASS (les dix) |
| T35 | `tests/legacy/*` (26 fichiers) | b7b1170 (25), 5d4cdb7 (1) | Supprimés | 8.2 v, tableau de la section 5 | — |
| T36 | `scripts/run-tests.mjs`, `package.json`, `tests/README.md`, `docs/lot0-inventaire-suites.md` | 5d4cdb7 | Filtre `legacy` du lanceur, `test:legacy` et la section du README retirés. `docs/lot0-inventaire-suites.md` **gardé** avec une mention historique (écart, voir plus bas) | 8.2 v | — |
| T37 | `.github/workflows/verify.yml` | a3858d4, f6fcebd, ff4aae0, a03abe6 | Délai du job 60 → 75 min (commentaire), `npm --version`, durée par étape dans `run.txt`, délai de l'étape e2e 50 min, quotas e2e par IP ; run ciblé ajouté puis retiré ; délai ramené à 60 | AR11, AM5, L71, L77 | job vert, 2 261 s |
| T38 | `tests/fondations-lot0.test.ts` | 9d844d0 | Ajout : absence de `legacy-peer-deps=true` dans `.npmrc` | 8.2 w | PASS |

Sur T37 : dans le diff `7fdcb32..HEAD`, la ligne `timeout-minutes: 60` du job n'apparaît pas comme modifiée, parce que `a3858d4` l'a passée de 60 à 75 et `a03abe6` l'a ramenée de 75 à 60. Le commentaire ajouté par `a3858d4` donne la règle (75 minutes pour le run « avant », retour à 60 si trois runs « après » restent sous 50 minutes) ; il ne dit pas que le retour a eu lieu, `a03abe6` n'ayant changé que la valeur.

```text
$ git show a3858d4 -- .github/workflows/verify.yml | grep 'timeout-minutes'
-    timeout-minutes: 60
+    timeout-minutes: 75
+        timeout-minutes: 50
$ git show a03abe6 -- .github/workflows/verify.yml | grep 'timeout-minutes'
-    timeout-minutes: 75
+    timeout-minutes: 60
```

**B. Modifications hors de la liste du contrat**

| # | Fichier | Commit | Avant | Après | Raison | Run 107 |
|---|---|---|---|---|---|---|
| B.1 | `tests/parcours/hors-ligne-codes.test.ts`, test 10 (T39, AM2) | c805751 | La route ne lit aucun en-tête | `req.headers.get('accept-encoding')` admis une fois au plus ; tout autre en-tête reste refusé (`route.replace(acceptEncoding, '')` puis même motif qu'avant) | Contrat 3.7 : la compression exige de lire `Accept-Encoding`. Élargissement minimal | PASS |
| B.2 | `tests/parcours/legacy-billet-pdf.test.ts`, `tests/parcours/legacy-exports-partenaire.test.ts` (suites du lot) | 3687cc0 | Contrat 12.1 : ports « réputés verts à l'écriture » | Deux cas rouges volontaires à l'écriture : T5 du PDF (statut technique `ANNULE` dans le refus) et l'injection de formule du CSV. Aucune modification depuis `3687cc0` (`git log` du fichier) | Anomalie A23 trouvée par le port (AM1), corrigée par `1fa3fe9`. Run 95 : FAIL ; run 107 : PASS | PASS, PASS |
| B.3 | `tests/parcours/equipe-eligibilite.test.ts` (suite du lot) | 9642b7c | 15 cas, T6 absent | Cas T6 ajouté : invitation sur l'événement d'un autre partenaire, seul et mêlé à un événement à soi : 403 « propriétaire », aucun compte, aucun SMS, aucune affectation | Ligne 10 du tableau 12.1 non soldée par `b7b1170` ; la couverture citée par la découverte visait d'autres routes (AM12) | PASS |
| B.4 | `tests/parcours/anonymisation-debogage.test.ts` | efa07a6 | Tout dossier `test`, `debug`, `dev`, `qa` sous `app/api` refusé | `app/api/dev` admis seulement s'il ne contient que des `route.dev.ts` ; tout autre fichier y est une faute ; un témoin exige `app/api/dev/samirpay/[action]/route.dev.ts`, pour prouver que le contrôle parcourt bien le dossier | Dossier imposé par le contrat 3.13 ; extension `.dev.ts` activée en développement seulement (L20). Condition plus forte que le refus du nom | PASS |
| B.5 | `tests/parcours/notif-modeles.test.ts` | 2f79c3d | — | Test A29 ajouté : `ADMIN_REFUND_TO_RETRY` d'un blocage `SOLDE_INSUFFISANT` contient « solde », ni « bénéficiaire », ni le code brut | A29, trouvée en relisant `fix(8.3-A3s)` ; corrigée par `f2334de` | PASS |
| B.6 | `tests/parcours/notif-interface.test.ts` | b405bab | `/^kind=in\.\(([A-Z_]+(?:,[A-Z_]+)*)\)$/` | `[A-Z0-9_]` dans le même motif | Le motif refusait `SMS_OPTIONAL_80`, que T10 exige : le cas échouait quelle que soit la page. Liste attendue identique. Trouvé par E3 | PASS |
| B.7 | `tests/parcours/otp-serveur.test.ts` | 02e331f | — | Test A35 ajouté : refus du fournisseur SMS simulé, réponse 502 avec un message, sans « fournisseur » ni « HTTP nnn » | A35, rouge au run suivant, corrigée par `15dc7d0` | PASS |
| B.8 | `tests/parcours/pilotage-remboursement-billet.test.ts` (suite du lot) | ef3e9fa | — | Test A36 ajouté : billet scanné, remboursement refusé en 409 `TICKET_NOT_REFUNDABLE`, message sans `UTILISE` ni motif `[A-Z]{4,}_[A-Z]+` | A36 (AM13), corrigée par `ffc0167` | PASS |
| B.9 | `tests/parcours/partenaire-profil-rpc.test.ts` (suite du lot) | 5586bf1 | Lecture `.order('activity_type')`, comparée à un ordre alphabétique | Lecture sans `order`, puis `.sort()` ; mêmes valeurs exigées | L'ordre de l'enum met SALLE avant ORGANISATEUR : faux rouge au run 96, les deux lignes étaient bien écrites | PASS |
| B.10 | `tests/parcours/course-confirmation-annulation.test.ts`, cas 6 (suite du lot) | a8c653b | `event_cancel` : verrou `FOR UPDATE` sur `ticket_categories` exigé | `FOR NO KEY UPDATE` exigé, et plus aucun `FOR UPDATE` sur les catégories | Second cycle de verrous levé par `621c804` (AM14) ; plus strict | PASS |
| B.11 | `tests/parcours/finance-affichage.test.ts` | 697f9ec | — | Test A41 ajouté : le middleware laisse passer `/api/checkout/quote` sans session, et bloque toujours `/api/checkout` | A41 (AM15), trouvée par la recette au run 99, corrigée par `c532ca7` | PASS |
| B.12 | 7 suites : `tests/partner-halls-m7`, `tests/partner-orders-m9`, `tests/security/r1-inscription-roles`, `r2-otp-codes`, `r21-notifications-rest`, `r7-profil-colonnes`, `tests/ux-performance-and-double-click` | da0dcef | Numéro tiré par `Math.random`, préfixes 70 à 77 | `randomSenegalPhone(…)`, préfixes 70 et 75 passés à 78 ; aucune assertion touchée | Run 104 : `partner-orders-m9` rouge sur « Phone number already registered », collision déjà décrite au run 86 | PASS (les sept) |
| B.13 | `tests/schema/recette-matrice.test.ts` (suite du lot) | 208d8df | Bornes A1 à A40 | Bornes A1 à A41, A41 ajoutée à `CORRIGEES`, qui exige un test cité vert | A41 trouvée après l'écriture de la suite ; contrôle plus large, rien de retiré. Au commit `0a6e83d`, la suite était rouge sur ce seul point | PASS |
| B.14 | `e2e/recette.spec.ts` (suite du lot) | 0de9979, 86868ae, 40e2473, f4a66d0 | Version de `f7d8c5d`, jamais jouée avant le run 98 | Acte 2 à 8 : sélecteurs relus contre le JSX (`/^suspendre$/` sans `i` ne trouvait pas « Suspendre ») ; acte 5 : numéro relu après le transfert, que `ticket_transfer_accept` renouvelle ; acte 6 : fichier réellement téléchargé au lieu du corps ; acte 8 : statut du PATCH et badge à l'écran au lieu du corps, que la page ne lit pas | Mise au point sur les runs 98 à 103. Aucune assertion retirée selon les messages ; l'acte 6 et l'acte 8 contrôlent davantage | recette OK (8 sur 8) |
| B.15 | `e2e/support/checks.ts`, `e2e/captures.spec.ts`, type `Screen` de `screens.ts` | aba8029 | Tout texte `CLOTURE` refusé comme valeur technique | Champ `references` par écran : un nœud de texte **égal** à `^CLOTURE-[0-9A-F]{8}-\d{8}$` n'est pas lu comme valeur technique ; `CLOTURE` seul reste refusé, sur cet écran aussi | **Seul assouplissement du lot**, limité à ce format et à l'écran `partenaire-rapport-cloture`. Accepté par l'orchestrateur comme correction d'un faux positif : ce numéro est imposé à l'écran par `design-systeme.test.ts:737` et dans le PDF par `legacy-exports-partenaire.test.ts:131,142` | captures OK |
| B.16 | Captures : `partenaire-rapport-cloture`, `pilotage-rembourser-billet`, `caisse-cloture-ecart` (`e2e/support/screens.ts`) | aba8029, e7512f4 | Dialogue quelconque ; `/^rechercher/`, `/^rembourser/` ; 43 000 comptés en dur | Nom du dialogue, « Généré le », « Entrées », « Télécharger le PDF » exigés, fond ramené en haut ; libellés exacts, « Annuler ce billet gratuit » refusé sur un billet payant, « Revenir à la fiche » joué ; montant compté lu depuis le montant enregistré | Écrans livrés par E0 et E2 ; image incohérente relevée par la relecture (55 000 enregistrés, 43 000 comptés, écart de -2 000). Capture seule, aucun contrôle changé (`e7512f4`) | captures OK |

Sur `e2e/recette.spec.ts`, l'orchestrateur compte six corrections pendant la mise au point. `git log -- e2e/recette.spec.ts` en montre quatre après sa création ; les runs 99 (A41, corrigée côté application par `c532ca7`) et 103 (dernier run ciblé, qui finit en échec par construction) n'ont pas modifié ce fichier. Sortie brute :

```text
$ git log --reverse --abbrev=7 --format='%h %s' 7fdcb32..HEAD -- e2e/recette.spec.ts | cut -c1-160
f7d8c5d test(8.3b): e2e/recette.spec.ts, les 8 actes du contrat 15.5 en mode serial sur la base du seed e2e, étiquetés [client], [partenaire], [contrôleur], [ad
0de9979 test(8.3b)[selecteurs]: e2e/recette.spec.ts relu pas à pas contre le JSX et les routes des actes 2 à 8 après le rouge du run 98. Acte 2 : le dossier ouv
86868ae test(8.3b): l'acte 5 relit le numéro du billet après le transfert, que ticket_transfer_accept renouvelle (run 100 : « Aucun billet de cet événement ne p
40e2473 test(8.3b): l'acte 6 lit le fichier réellement téléchargé au lieu du corps de la réponse (run 101 : corps vide côté Playwright, l'écran passe par fetch 
f4a66d0 test(8.3b): l'acte 8 contrôle le statut du PATCH de suspension et le badge à l'écran au lieu de lire le corps (run 102 : suspension réussie à l'écran, m
```

Run 107 (`bc864fa`, « après », code final), récapitulatif de `npm run test`, lignes des suites citées en A et B (extrait de `docs/lot8-logs/ci-run107-verify.log`) :

```text
tests/fondations-lot0.test.ts                          PASS     464ms     0     .test-logs/tests__fondations-lot0.test.ts.log
tests/partner-halls-m7.test.ts                         PASS     1.3s      0     .test-logs/tests__partner-halls-m7.test.ts.log
tests/partner-orders-m9.test.ts                        PASS     1.3s      0     .test-logs/tests__partner-orders-m9.test.ts.log
tests/ux-performance-and-double-click.test.ts          PASS     675ms     0     .test-logs/tests__ux-performance-and-double-click.test.ts.log
tests/parcours/acces-scan.test.ts                      PASS     2.0s      0     .test-logs/tests__parcours__acces-scan.test.ts.log
tests/parcours/acces-tracabilite.test.ts               PASS     2.5s      0     .test-logs/tests__parcours__acces-tracabilite.test.ts.log
tests/parcours/activation-controleur.test.ts           PASS     3.1s      0     .test-logs/tests__parcours__activation-controleur.test.ts.log
tests/parcours/anonymisation-debogage.test.ts          PASS     1.2s      0     .test-logs/tests__parcours__anonymisation-debogage.test.ts.log
tests/parcours/confirmation-achat.test.ts              PASS     3.0s      0     .test-logs/tests__parcours__confirmation-achat.test.ts.log
tests/parcours/course-annulation-transfert.test.ts     PASS     2.6s      0     .test-logs/tests__parcours__course-annulation-transfert.test.ts.log
tests/parcours/course-confirmation-annulation.test.ts  PASS     3.0s      0     .test-logs/tests__parcours__course-confirmation-annulation.test.ts.log
tests/parcours/design-systeme.test.ts                  PASS     2.2s      0     .test-logs/tests__parcours__design-systeme.test.ts.log
tests/parcours/dette-cloture-caisse.test.ts            PASS     4.2s      0     .test-logs/tests__parcours__dette-cloture-caisse.test.ts.log
tests/parcours/dette-interface-lot7.test.ts            PASS     2.8s      0     .test-logs/tests__parcours__dette-interface-lot7.test.ts.log
tests/parcours/dette-retrait-controleur.test.ts        PASS     2.8s      0     .test-logs/tests__parcours__dette-retrait-controleur.test.ts.log
tests/parcours/dette-transferts.test.ts                PASS     1.7s      0     .test-logs/tests__parcours__dette-transferts.test.ts.log
tests/parcours/edition-categories.test.ts              PASS     2.5s      0     .test-logs/tests__parcours__edition-categories.test.ts.log
tests/parcours/equipe-eligibilite.test.ts              PASS     3.6s      0     .test-logs/tests__parcours__equipe-eligibilite.test.ts.log
tests/parcours/finance-affichage.test.ts               PASS     1.3s      0     .test-logs/tests__parcours__finance-affichage.test.ts.log
tests/parcours/finance-hors-plateforme.test.ts         PASS     1.3s      0     .test-logs/tests__parcours__finance-hors-plateforme.test.ts.log
tests/parcours/finance-rapports.test.ts                PASS     1.5s      0     .test-logs/tests__parcours__finance-rapports.test.ts.log
tests/parcours/hors-ligne-codes.test.ts                PASS     10.7s     0     .test-logs/tests__parcours__hors-ligne-codes.test.ts.log
tests/parcours/legacy-billet-pdf.test.ts               PASS     1.8s      0     .test-logs/tests__parcours__legacy-billet-pdf.test.ts.log
tests/parcours/legacy-exports-partenaire.test.ts       PASS     1.9s      0     .test-logs/tests__parcours__legacy-exports-partenaire.test.ts.log
tests/parcours/notif-interface.test.ts                 PASS     2.4s      0     .test-logs/tests__parcours__notif-interface.test.ts.log
tests/parcours/notif-migration.test.ts                 PASS     1.7s      0     .test-logs/tests__parcours__notif-migration.test.ts.log
tests/parcours/notif-modeles.test.ts                   PASS     860ms     0     .test-logs/tests__parcours__notif-modeles.test.ts.log
tests/parcours/notif-outbox.test.ts                    PASS     1.8s      0     .test-logs/tests__parcours__notif-outbox.test.ts.log
tests/parcours/otp-serveur.test.ts                     PASS     785ms     0     .test-logs/tests__parcours__otp-serveur.test.ts.log
tests/parcours/paiement-controles.test.ts              PASS     1.9s      0     .test-logs/tests__parcours__paiement-controles.test.ts.log
tests/parcours/paiement-gratuits.test.ts               PASS     1.7s      0     .test-logs/tests__parcours__paiement-gratuits.test.ts.log
tests/parcours/partenaire-lot7.test.ts                 PASS     6.3s      0     .test-logs/tests__parcours__partenaire-lot7.test.ts.log
tests/parcours/partenaire-profil-rpc.test.ts           PASS     5.7s      0     .test-logs/tests__parcours__partenaire-profil-rpc.test.ts.log
tests/parcours/perf-statique.test.ts                   PASS     2.4s      0     .test-logs/tests__parcours__perf-statique.test.ts.log
tests/parcours/pilotage-remboursement-billet.test.ts   PASS     4.1s      0     .test-logs/tests__parcours__pilotage-remboursement-billet.test.ts.log
tests/parcours/roles-fraicheur.test.ts                 PASS     834ms     0     .test-logs/tests__parcours__roles-fraicheur.test.ts.log
tests/parcours/scanner-interface.test.ts               PASS     4.4s      0     .test-logs/tests__parcours__scanner-interface.test.ts.log
tests/parcours/temps-reel-prives.test.ts               PASS     62.8s     0     .test-logs/tests__parcours__temps-reel-prives.test.ts.log
tests/schema/migration-lot7-rejouable.test.ts          PASS     1.2s      0     .test-logs/tests__schema__migration-lot7-rejouable.test.ts.log
tests/schema/recette-matrice.test.ts                   PASS     333ms     0     .test-logs/tests__schema__recette-matrice.test.ts.log
tests/security/r1-inscription-roles.test.ts            PASS     1.3s      0     .test-logs/tests__security__r1-inscription-roles.test.ts.log
tests/security/r2-otp-codes.test.ts                    PASS     420ms     0     .test-logs/tests__security__r2-otp-codes.test.ts.log
tests/security/r21-notifications-rest.test.ts          PASS     888ms     0     .test-logs/tests__security__r21-notifications-rest.test.ts.log
tests/security/r3-fonctions-rpc.test.ts                PASS     1.1s      0     .test-logs/tests__security__r3-fonctions-rpc.test.ts.log
tests/security/r6-roles-jeton.test.ts                  PASS     1.2s      0     .test-logs/tests__security__r6-roles-jeton.test.ts.log
tests/security/r7-profil-colonnes.test.ts              PASS     2.0s      0     .test-logs/tests__security__r7-profil-colonnes.test.ts.log
…
TOTAL : 220 suite(s) — 220 réussie(s), 0 en échec, 0 expirée(s)
```

Run 107, phases e2e (extrait de `docs/lot8-logs/ci-run107-e2e.log`, lignes « passed » et « phase ») :

```text
  10 passed (11.0s)
[e2e] phase connexion : OK en 12s
  323 passed (13.7m)
[e2e] phase captures : OK en 822s
  5 passed (6.3s)
[e2e] phase emails : OK en 7s
  4 passed (4.0s)
[e2e] phase dev-page : OK en 4s
  2 passed (38.8s)
[e2e] phase fumee : OK en 39s
  13 passed (2.1m)
[e2e] phase terrain : OK en 129s
  4 passed (3.4s)
[e2e] phase pwa : OK en 4s
[e2e] phase fake-prod : OK en 1s
  4 passed (3.1m)
[e2e] phase perf : OK en 185s
  8 passed (1.1m)
[e2e] phase recette : OK en 65s
```

### Suites supprimées

Les 26 suites de `tests/legacy/`, en deux commits : 25 par `b7b1170` juste après le run « avant », la dernière (`controller-event-status-hotfix`) par `5d4cdb7`, une fois son cas T6 porté (`9642b7c`) et vu vert au run 96 selon le message de `5d4cdb7` (journal du run 96 non recopié ici ; T6 est vert au run 107, extrait en section 5). Aucune autre suite n'est supprimée : la seule autre suppression du lot est `.npmrc` (8.2 w). Le décompte passe de 181 suites (runs 93 et 94) à 220 (run 107) : 39 fichiers `*.test.ts` ajoutés sous `tests/`, les suites legacy n'ayant jamais été comptées par le lanceur.

```text
$ git diff --name-status 7fdcb32..HEAD -- tests/legacy
D	tests/legacy/admin-anonymize.test.ts
D	tests/legacy/camera-qr-scanner.test.ts
D	tests/legacy/cdc-v3-validation-checks.test.ts
D	tests/legacy/checkout-mixed-cart.test.ts
D	tests/legacy/chunk5-phase1-bugs.test.ts
D	tests/legacy/chunk5-phase2-b2c.test.ts
D	tests/legacy/client-ticket-lifecycle.test.ts
D	tests/legacy/controller-14-points.test.ts
D	tests/legacy/controller-complete-workflow.test.ts
D	tests/legacy/controller-event-status-hotfix.test.ts
D	tests/legacy/controller-multi-role.test.ts
D	tests/legacy/controller-realtime-sync.test.ts
D	tests/legacy/controller-shifts-z.test.ts
D	tests/legacy/dynamic-qr-totp.test.ts
D	tests/legacy/event-cancellation-and-refunds.test.ts
D	tests/legacy/event-live-editing-and-stock.test.ts
D	tests/legacy/partner-dashboard-and-exports.test.ts
D	tests/legacy/partner-events-m5.test.ts
D	tests/legacy/partner-tables-m8.test.ts
D	tests/legacy/scanner-security-hardening.test.ts
D	tests/legacy/security-fixes.test.ts
D	tests/legacy/ticket-pdf-and-exports.test.ts
D	tests/legacy/ticket-transfer-phase2-initiation.test.ts
D	tests/legacy/ticket-transfer-phase3-claim.test.ts
D	tests/legacy/ticket-transfers-phase1-schema.test.ts
D	tests/legacy/ticketing-e2e-final.test.ts

$ git show --shortstat --abbrev=7 --format='%h %s' b7b1170 5d4cdb7
b7b1170 test(8.2v)[suppression]: 25 suites de tests/legacy supprimées sur 26 (T35), tableau 12.1 relu ligne à ligne et c …
 25 files changed, 8220 deletions(-)
5d4cdb7 test(8.2v)[suppression]: dernier fichier legacy supprimé, fin de la quarantaine (T35, T36). T6 vu vert au run 96 …
 6 files changed, 10 insertions(+), 629 deletions(-)
```

### Écarts au contrat dans les commits et les tests

- **`docs/lot0-inventaire-suites.md` gardé** (`5d4cdb7`), alors que le contrat 12.1 et T36 le supprimaient : `docs/lot0-rapport.md:9,181` et `docs/lot1c-rapport.md:1090`, deux rapports gelés, y renvoient. Une mention « Document historique » en tête renvoie au présent rapport (AM14).
- **Message inexact de `dff5778`** : il annonce « plus 16 mineurs simples ». Le bilan de la relecture compte 23 lignes MINEUR corrigées et 2 partielles. Le message n'a pas été corrigé, `--amend` étant interdit ; le bilan fait foi.
- **Phrase mal tournée dans `9212cca`** (`fix(8.2e-s)`) : « …et rend les étapes 2 à 9 inatteignables, seul le compostage réel écrit donc jamais pour une reprise ». Sens voulu : en mode renvoi, rien n'est jamais écrit ; seul un compostage réel, hors renvoi, écrit une ligne. Le code et `scan-renvoi-seulement` disent la même chose (L42, L43).
- **`fix(8.2q)` découpé par agent** (AM13) : `e4995c0` (E1, scanner), `f9cc0c8` (E2), `b57441c` (E3), au lieu du seul commit d'E2 prévu par le contrat 11.1.
- **Run ciblé temporaire `[recette-seule]`** : `f6fcebd` (`chore(ci)`) faisait remplacer `verify` par le seul build et ne jouait que `setup` et `recette` pour un commit portant ce marqueur ; il servait à mettre au point le parcours en 7 minutes par essai au lieu de 40. Runs 99 à 103, tous en échec **par construction** : aucun ne prouve quoi que ce soit. Retiré par `ff4aae0`, qui rend à `verify.yml` son état d'avant `f6fcebd`. Le run 104 (`ff4aae0`) est un run complet, rouge sur une suite (`partner-orders-m9`, collision de numéros, corrigée par `da0dcef`).
- **Délai du job ramené à 60 minutes** par `a03abe6` (L77), sur quatre runs sous 50 minutes cités dans le message : 96 2 318 s, 97 2 536 s, 98 2 261 s, 104 2 180 s. Les runs 105, 106 et 107 ont duré 2 630 s, 2 116 s et 2 261 s (`runs-table.txt`). Le délai de l'étape e2e reste à 50 minutes.
- **Ordre de la suppression legacy (L69)** : 25 fichiers supprimés avant `fix(8.2p)` comme prévu ; le 26ᵉ après, une fois T6 porté (AM12). `fix(8.2p)` n'en dépendait pas : le fichier restant ne lit pas les champs retirés (S4b).
- **Lock régénéré avec npm 10.9.9 et non 10.9.2** (AM10, `9d844d0`), la version lue en CI au run 95 ; L70 et AR13 disent 10.9.2. Le run 107 journalise `npm_version=10.9.9`.
- **`tests/schema/recette-matrice.test.ts`** est sous `tests/schema/`, comme le demandait la mission de D2 ; le contrat 13.1 et la section 16 disaient `tests/parcours/`.

```text
$ git log --reverse --abbrev=7 --format='%h%x09%s' 7fdcb32..HEAD | grep -E '^(9212cca|f6fcebd|dff5778|ff4aae0|a03abe6)' | cut -c1-200
9212cca	fix(8.2e-s): mode renvoi seulement du scan, côté serveur. M5 recopie ticket_scan avec replay_only dans p : clé absente refusée avant toute écriture, aucune ligne forbidden en renvoi (L43), lig
f6fcebd	chore(ci): run ciblé temporaire [recette-seule], pour mettre au point le parcours de recette sans 40 min par essai. Un commit portant ce marqueur remplace verify par le seul build et ne joue q
dff5778	fix(8.2u)[relecture]: corrections de la relecture des captures du run 98 : mots des boutons séparés (Button sans tracking-tight, word-spacing 0,1 em), barre d'achat collée à la navigation (53 
ff4aae0	chore(ci): run ciblé retiré, verify.yml revient à son état d'avant f6fcebd. Il a servi aux runs 99 à 103, 7 min par essai contre 40, et n'a jamais pu passer pour une preuve : tous ces runs fin
a03abe6	chore(ci): délai du job ramené de 75 à 60 min (L77). Quatre runs sous 50 min : 96 2 318 s, 97 2 536 s, 98 2 261 s, 104 2 180 s, recette comprise au dernier. Délai de l'étape e2e gardé à 50 min
```

---

---

## 2. Par tâche : grep, test rouge, correctif, test vert

**Les runs de référence.**
- **Avant** : run 95 (`42276458389`, commit `db21d1c`), 172 suites vertes sur 219. Les tests rouges sont committés, aucun correctif ne l'est.
- **Après** : run 107 (`42334500969`, commit `bc864fa`), job vert, 220 suites sur 220, toutes les phases e2e dont la recette (8 actes). C'est le code final, après les dernières corrections de typographie : **tous les extraits verts ci-dessous viennent du run 107.** Les runs 105 (`a03abe6`) et 106 (`f488be0`, même code d'application que 105, second run exigé par L82) sont verts aussi ; ils ne sont pas recopiés ici.
- Trois rouges ne se lisent pas au run 95, parce que le défaut a été trouvé plus tard : le second cycle de verrous (run 96), A35 et A36 (run 97), A41 (run 99). Leur rouge est pris dans ces runs, sur `origin/ci-results`.

**Origine des extraits.**
- Chaque bloc « run 95 / run 107 » est recopié par script de `runs/<n>-<id>/test-logs/<suite>.log` (copies locales du scratchpad, identiques à `origin/ci-results`). On y trouve :
  - jusqu'à quatre sous-tests en échec, avec les deux premières lignes de leur erreur ;
  - le crochet `after()` en échec quand il existe (souvent l'invariant qui nomme le schéma absent) ;
  - au run 107, les **mêmes** sous-tests, retrouvés par leur nom, puis le nombre des autres réussis, la ligne `[INVARIANT-RECETTE]` de la suite et les compteurs TAP.
- Quand une suite porte plusieurs tâches, seuls les sous-tests de la tâche sont retenus, et le filtre est imprimé dans l'en-tête du bloc.
- Les lignes sont tronquées à 240 caractères (`…`). Aucune valeur `totp_secret` n'apparaît dans ces journaux ; le script masque quand même ce champ et tout jeton.
- Les blocs « git show --numstat » donnent les fichiers et les lignes ajoutées et retirées de chaque commit ; les traces `docs/lot8-logs/ui-ux-pro-max/` sont comptées, pas listées.
- « Origine » cite la découverte (fichiers `scratchpad/discovery-8-*.md`), qui a fait les greps sur l'arbre de `7fdcb32`. Ces greps n'ont pas été rejoués pour ce rapport.

### 8.0 — Canaux de vente par catégorie

**Origine.** `discovery-8-canaux.md`, section 1 :
- « La masquée est vendue au guichet par omission, pas par décision » : `counter_sale` filtre les problèmes par liste blanche, sans `CATEGORY_NOT_VISIBLE` (`lot6_bil:755-757`) ; `counter_sale_quote` de même (`lot7_scan:580-582`) ; le GET du guichet ne filtre que `is_active`. « Aucun test ne fige ce comportement. »
- Aucun code ne produit de billet `INVITATION` : une catégorie sans canal ne sera distribuée à personne (AR8, PO1).
- L'instantané ne peut pas se prendre à l'émission du billet : la décision a lieu au checkout, elle est figée sur `stock_reservations` puis recopiée.

```text
# run 95 (db21d1c, « avant ») — tests/parcours/canaux-vente.test.ts
not ok 1 - 1. checkout_create_payment en appel direct : ok false, CATEGORY_NOT_SOLD_ONLINE, aucun paiement, aucune réservation
      error: schéma des canaux de vente incomplet (migration 20261106000001) :
        colonne public.ticket_categories.sale_online absente — canaux de vente (contrat 2.4, migration 20261106000001)
not ok 2 - 2. POST /api/checkout : 400, code dans le corps, aucun appel SamirPay
      error: schéma des canaux de vente incomplet (migration 20261106000001) :
        colonne public.ticket_categories.sale_online absente — canaux de vente (contrat 2.4, migration 20261106000001)
not ok 3 - 2 bis. panier mixte : refusé en entier, seule la catégorie fautive est citée, aucune réservation sur l’autre
      error: schéma des canaux de vente incomplet (migration 20261106000001) :
        colonne public.ticket_categories.sale_online absente — canaux de vente (contrat 2.4, migration 20261106000001)
not ok 4 - 3. free_tickets_claim direct et /api/tickets/claim-free : refus, aucun billet, stock inchangé
      error: schéma des canaux de vente incomplet (migration 20261106000001) :
        colonne public.ticket_categories.sale_online absente — canaux de vente (contrat 2.4, migration 20261106000001)
# … 16 autre(s) sous-test(s) en échec retenu(s)
# crochet en échec :
not ok 8 - /home/runner/work/event-village/event-village/tests/parcours/canaux-vente.test.ts
  schéma du lot 8 incomplet (canaux-vente) : invariants (r)(s)(t) impossibles à vérifier :
  colonne public.ticket_categories.sale_online absente — canaux de vente (contrat 2.4, migration 20261106000001)
  colonne public.ticket_categories.sale_counter absente — canaux de vente (contrat 2.4, migration 20261106000001)
# tests 20
# pass 0
# fail 20
# cancelled 0
# run 107 (bc864fa, « après », code final) — tests/parcours/canaux-vente.test.ts
ok 1 - 1. checkout_create_payment en appel direct : ok false, CATEGORY_NOT_SOLD_ONLINE, aucun paiement, aucune réservation
ok 2 - 2. POST /api/checkout : 400, code dans le corps, aucun appel SamirPay
ok 3 - 2 bis. panier mixte : refusé en entier, seule la catégorie fautive est citée, aucune réservation sur l’autre
ok 4 - 3. free_tickets_claim direct et /api/tickets/claim-free : refus, aucun billet, stock inchangé
ok 1 - 4. counter_sale direct et route : CATEGORY_NOT_SOLD_AT_COUNTER, 409, rien vendu, caisse inchangée
ok 2 - 4 bis. panier mixte au guichet : refusé en entier, seule la catégorie fautive est citée
# … 14 autre(s) sous-test(s) réussi(s)
[INVARIANT-RECETTE] canaux-vente — (r)(s)(t) : 0 violation(s)
# tests 20
# pass 20
# fail 0
# cancelled 0
```

```text
# run 95 (db21d1c, « avant ») — tests/parcours/canaux-invariant.test.ts
not ok 1 - t0 : billet sans décision (défaut de colonne SANS_DECISION) ; témoin : décision conforme
      error: schéma du lot 8 incomplet (canaux-invariant t0) : invariants (r)(s)(t) impossibles à vérifier :
        colonne public.ticket_categories.sale_online absente — canaux de vente (contrat 2.4, migration 20261106000001)
not ok 2 - t1 ONLINE : décision sale_online faux, ou clé absente ; témoins : sale_online vrai avec sale_counter faux
      error: schéma du lot 8 incomplet (canaux-invariant t1 ONLINE) : invariants (r)(s)(t) impossibles à vérifier :
        colonne public.ticket_categories.sale_online absente — canaux de vente (contrat 2.4, migration 20261106000001)
not ok 3 - t1 FREE : un billet gratuit est soumis à sale_online (L9) ; témoin : sale_online vrai
      error: schéma du lot 8 incomplet (canaux-invariant t1 FREE) : invariants (r)(s)(t) impossibles à vérifier :
        colonne public.ticket_categories.sale_online absente — canaux de vente (contrat 2.4, migration 20261106000001)
not ok 4 - t2 : billet COUNTER à sale_counter faux ; témoin : sale_counter vrai avec sale_online faux (« Sur place uniquement »)
      error: schéma du lot 8 incomplet (canaux-invariant t2) : invariants (r)(s)(t) impossibles à vérifier :
        colonne public.ticket_categories.sale_online absente — canaux de vente (contrat 2.4, migration 20261106000001)
# … 5 autre(s) sous-test(s) en échec retenu(s)
# crochet en échec :
not ok 4 - /home/runner/work/event-village/event-village/tests/parcours/canaux-invariant.test.ts
  schéma du lot 8 incomplet (canaux-invariant) : invariants (r)(s)(t) impossibles à vérifier :
  colonne public.ticket_categories.sale_online absente — canaux de vente (contrat 2.4, migration 20261106000001)
  colonne public.ticket_categories.sale_counter absente — canaux de vente (contrat 2.4, migration 20261106000001)
# tests 9
# pass 0
# fail 9
# cancelled 0
# run 107 (bc864fa, « après », code final) — tests/parcours/canaux-invariant.test.ts
ok 1 - t0 : billet sans décision (défaut de colonne SANS_DECISION) ; témoin : décision conforme
ok 2 - t1 ONLINE : décision sale_online faux, ou clé absente ; témoins : sale_online vrai avec sale_counter faux
ok 3 - t1 FREE : un billet gratuit est soumis à sale_online (L9) ; témoin : sale_online vrai
ok 4 - t2 : billet COUNTER à sale_counter faux ; témoin : sale_counter vrai avec sale_online faux (« Sur place uniquement »)
ok 5 - t3 : is_visible et sale_online divergent (triggers de ticket_categories coupés) ; témoin : l’autre catégorie
ok 6 - t4 : billet payé en ligne dont la décision contredit sa réservation ; témoin : décision égale à la réservation
# … 3 autre(s) sous-test(s) réussi(s)
[INVARIANT-RECETTE] canaux-invariant — (r)(s)(t) : 0 violation(s)
# tests 9
# pass 9
# fail 0
# cancelled 0
```

```text
# run 95 (db21d1c, « avant ») — tests/parcours/canaux-interface.test.ts
not ok 1 - categoryChannelLabel : les quatre cas, exactement
      error: "module des canaux (contrat 4.1) absent ou illisible (../../lib/events/category-channels) : Cannot find module '/home/runner/work/event-village/event-village/lib/events/category-channels' imported from /home/runner/work/event-village/event-village/tests/parcou …
not ok 2 - CATEGORY_CHANNEL_HELP : trois aides en français, celle de `none` mot pour mot
      error: "module des canaux (contrat 4.1) absent ou illisible (../../lib/events/category-channels) : Cannot find module '/home/runner/work/event-village/event-village/lib/events/category-channels' imported from /home/runner/work/event-village/event-village/tests/parcou …
not ok 3 - le module reste pur, importable par le client : aucun import
      error: 'lib/events/category-channels.ts absent (contrat 4.1)'
not ok 1 - création : sale_online et sale_counter acceptés, catégorie sans canal permise
      error: catégorie sans canal permise : [{"code":"unrecognized_keys","keys":["sale_online","sale_counter"],"path":[],"message":"Unrecognized key(s) in object: 'sale_online', 'sale_counter'"}]
        false !== true
# … 12 autre(s) sous-test(s) en échec retenu(s)
# tests 16
# pass 0
# fail 16
# cancelled 0
# run 107 (bc864fa, « après », code final) — tests/parcours/canaux-interface.test.ts
ok 1 - categoryChannelLabel : les quatre cas, exactement
ok 2 - CATEGORY_CHANNEL_HELP : trois aides en français, celle de `none` mot pour mot
ok 3 - le module reste pur, importable par le client : aucun import
ok 1 - création : sale_online et sale_counter acceptés, catégorie sans canal permise
ok 2 - création : is_visible reste un alias, sans défaut, et aucun défaut de sale_online ne l’écrase (COALESCE de ticket_category_normalize)
ok 3 - modification : sale_online et sale_counter acceptés, is_visible toujours accepté
# … 10 autre(s) sous-test(s) réussi(s)
# tests 16
# pass 16
# fail 0
# cancelled 0
```

T5, test existant adapté (code d'erreur `CATEGORY_NOT_SOLD_ONLINE` au lieu de `SALE_CHECK_FAILED` seul) :

```text
# run 95 (db21d1c, « avant ») — tests/parcours/paiement-controles.test.ts
not ok 2 - vente close, vente pas encore ouverte, catégorie invisible ou inactive → 400
      error: `catégorie invisible : code CATEGORY_NOT_SOLD_ONLINE attendu dans {"error":"La catégorie « Cachee » n'est pas proposée à la vente.","code":"SALE_CHECK_FAILED","problems":[{"code":"CATEGORY_NOT_VISIBLE","message":"La catégorie « Cachee » n'est pas proposée à la …
# tests 8
# pass 7
# fail 1
# cancelled 0
# run 107 (bc864fa, « après », code final) — tests/parcours/paiement-controles.test.ts
ok 2 - vente close, vente pas encore ouverte, catégorie invisible ou inactive → 400
# … 7 autre(s) sous-test(s) réussi(s)
# tests 8
# pass 8
# fail 0
# cancelled 0
```

La reprise sans changement de comportement (`sale_online = is_visible`, `sale_counter = vrai`) et le rejeu des six migrations sont prouvés par `migration-lot8-rejouable`, qui couvre M1 à M6 :

```text
# run 95 (db21d1c, « avant ») — tests/schema/migration-lot8-rejouable.test.ts
not ok 1 - les migrations 20261106… du dépôt sont exactement les six du contrat, dans cet ordre
      error: migrations 20261106… présentes : aucune
not ok 2 - 20261106000001_lot8_canaux.sql : sans BEGIN ni COMMIT, appliquée deux fois de plus sans erreur
      error: 'migration du lot 8 absente : supabase/migrations/20261106000001_lot8_canaux.sql (contrat, section 2.1)'
not ok 3 - 20261106000002_lot8_essai.sql : sans BEGIN ni COMMIT, appliquée deux fois de plus sans erreur
      error: 'migration du lot 8 absente : supabase/migrations/20261106000002_lot8_essai.sql (contrat, section 2.1)'
not ok 4 - 20261106000003_lot8_paiement.sql : sans BEGIN ni COMMIT, appliquée deux fois de plus sans erreur
      error: 'migration du lot 8 absente : supabase/migrations/20261106000003_lot8_paiement.sql (contrat, section 2.1)'
# … 4 autre(s) sous-test(s) en échec retenu(s)
# crochet en échec :
not ok 3 - /home/runner/work/event-village/event-village/tests/schema/migration-lot8-rejouable.test.ts
  schéma du lot 8 incomplet (migration-lot8-rejouable) : invariants (r)(s)(t) impossibles à vérifier :
  colonne public.ticket_categories.sale_online absente — canaux de vente (contrat 2.4, migration 20261106000001)
  colonne public.ticket_categories.sale_counter absente — canaux de vente (contrat 2.4, migration 20261106000001)
# tests 8
# pass 0
# fail 8
# cancelled 0
# run 107 (bc864fa, « après », code final) — tests/schema/migration-lot8-rejouable.test.ts
ok 1 - les migrations 20261106… du dépôt sont exactement les six du contrat, dans cet ordre
ok 2 - 20261106000001_lot8_canaux.sql : sans BEGIN ni COMMIT, appliquée deux fois de plus sans erreur
ok 3 - 20261106000002_lot8_essai.sql : sans BEGIN ni COMMIT, appliquée deux fois de plus sans erreur
ok 4 - 20261106000003_lot8_paiement.sql : sans BEGIN ni COMMIT, appliquée deux fois de plus sans erreur
ok 5 - 20261106000004_lot8_commissions.sql : sans BEGIN ni COMMIT, appliquée deux fois de plus sans erreur
ok 6 - 20261106000005_lot8_scan.sql : sans BEGIN ni COMMIT, appliquée deux fois de plus sans erreur
# … 2 autre(s) sous-test(s) réussi(s)
[INVARIANT-RECETTE] migration-lot8-rejouable — (r)(s)(t) : 0 violation(s)
# tests 8
# pass 8
# fail 0
# cancelled 0
```

```text
# run 95 (db21d1c, « avant ») — tests/security/r3-fonctions-rpc.test.ts  [sous-tests retenus : /lot 8/]
not ok 1 - anon et authenticated (compte CLIENT) : rpc(ticket_counter_channel_problems) existe et est refusée
      error: 'anon rpc(ticket_counter_channel_problems) : refus attendu par le privilège EXECUTE (42501), obtenu PGRST202 Could not find the function public.ticket_counter_channel_problems(p_event, p_items) in the schema cache — PGRST202 : fonction absente (migrations 2026 …
not ok 2 - anon et authenticated (compte CLIENT) : rpc(ev_request_simulated) existe et est refusée
      error: 'anon rpc(ev_request_simulated) : refus attendu par le privilège EXECUTE (42501), obtenu PGRST202 Could not find the function public.ev_request_simulated without parameters in the schema cache — PGRST202 : fonction absente (migrations 20261106000001 (canaux),  …
not ok 3 - anon et authenticated (compte CLIENT) : rpc(payment_duplicate_of) existe et est refusée
      error: 'anon rpc(payment_duplicate_of) : refus attendu par le privilège EXECUTE (42501), obtenu PGRST202 Could not find the function public.payment_duplicate_of(p_payment_id) in the schema cache — PGRST202 : fonction absente (migrations 20261106000001 (canaux), …02 ( …
not ok 4 - anon et authenticated (compte CLIENT) : rpc(partner_profile_update) existe et est refusée
      error: 'anon rpc(partner_profile_update) : refus attendu par le privilège EXECUTE (42501), obtenu PGRST202 Could not find the function public.partner_profile_update(p) in the schema cache — PGRST202 : fonction absente (migrations 20261106000001 (canaux), …02 (essai), …
# tests 284
# pass 280
# fail 4
# cancelled 0
# run 107 (bc864fa, « après », code final) — tests/security/r3-fonctions-rpc.test.ts  [sous-tests retenus : /lot 8/]
ok 1 - anon et authenticated (compte CLIENT) : rpc(ticket_counter_channel_problems) existe et est refusée
ok 2 - anon et authenticated (compte CLIENT) : rpc(ev_request_simulated) existe et est refusée
ok 3 - anon et authenticated (compte CLIENT) : rpc(payment_duplicate_of) existe et est refusée
ok 4 - anon et authenticated (compte CLIENT) : rpc(partner_profile_update) existe et est refusée
# tests 284
# pass 284
# fail 0
# cancelled 0
```

**Correctif.** Serveur, écran, puis seed de démonstration (T31) :

```text
$ git show --numstat a2731ec9
a2731ec9 fix(8.0s): canaux de vente par catégorie, côté serveur. M1 ajoute sale_online et sale_counter, is_visible restant le miroir de sale_online par trigger (L5) ; ticket_sale_problems refuse CATEG …
  +    3 -    1  app/api/controller/counter-sale/quote/route.ts
  +    7 -    4  app/api/controller/counter-sale/route.ts
  +    4 -    4  app/api/events/[id]/route.ts
  +    3 -    3  app/api/events/route.ts
  +   20 -    0  lib/events/category-channels.ts
  +    1 -    1  lib/payments/checkout.service.ts
  +    7 -    1  lib/validations/event.ts
  + 1360 -    0  supabase/migrations/20261106000001_lot8_canaux.sql
$ git show --numstat 2f9f4b19
2f9f4b19 fix(8.0e): le partenaire règle « Vendue en ligne » et « Vendue au guichet » par catégorie, avec aide reliée par aria-describedby et résumé categoryChannelLabel, le guichet porte « Sur place u …
  +    8 -    6  app/admin/events/[id]/page.tsx
  +   58 -   21  components/events/EventTicketing.tsx
  +    2 -    1  components/partner/pilotage/SalesTab.tsx
  +    2 -    0  components/partner/pilotage/types.ts
  +    4 -    3  components/scan/CounterSalePanel.tsx
  (+ 3 trace(s) docs/lot8-logs/ non listée(s))
$ git show --numstat 0e7abcbe
0e7abcbe fix(8.0-seed): le seed de démonstration écrit les canaux du lot 8 (T31, L80). createEvent pose sale_online et sale_counter à la place de is_visible ; « ce soir » reçoit une vente au guichet d …
  +   31 -    8  tests/seed/seed-demo.ts
```

### 8.1 — Mode d'essai pour l'utilisateur

**Origine.** `discovery-8-essai.md`, section 0 :
- `npm run dev` ne peut pas prouver le hors ligne (`ServiceWorkerRegister.tsx:13` n'enregistre le service worker qu'en production) : deux modes, A (`npm run dev`, `EV_INTEGRATIONS=fake`) et B (build de production vers les faux services).
- `registry.ts:39-44` lève une erreur en mode `fake` sans enregistrement : protection à garder hors développement. `fake-services.mjs` refuse ce mode (`env.mjs:70,76`) et garde son état en mémoire.
- `@next/env` et `parseEnvFile` ne lisent pas la même valeur (`abc#def` → `abc`) ; avec `NODE_ENV=test`, `@next/env` saute `.env.local` sans rien dire.
- `seed-demo.ts` n'est pas réutilisable (garde `EV_TEST_GUARD`, non rejouable).

Les huit suites du lot (extraits réduits à deux rouges et trois verts par suite) :

```text
# run 95 (db21d1c, « avant ») — tests/schema/essai-integrations.test.ts
not ok 2 - NODE_ENV absent refusé : le défaut « development » de lib/env.ts n’autorise pas le mode simulé
      error: 'NODE_ENV undefined : {"mode":"fake"}'
not ok 1 - production : integrationsMode lève, aucun adaptateur n’est rendu
      error: integrationsMode doit lever hors development et test, valeur rendue : fake
# … 23 autre(s) sous-test(s) en échec retenu(s)
# tests 30
# pass 5
# fail 25
# cancelled 0
# run 107 (bc864fa, « après », code final) — tests/schema/essai-integrations.test.ts
ok 2 - NODE_ENV absent refusé : le défaut « development » de lib/env.ts n’autorise pas le mode simulé
ok 1 - production : integrationsMode lève, aucun adaptateur n’est rendu
ok 2 - NODE_ENV absent : integrationsMode lève aussi
# … 27 autre(s) sous-test(s) réussi(s)
# tests 30
# pass 30
# fail 0
# cancelled 0
```

```text
# run 95 (db21d1c, « avant ») — tests/schema/essai-cron-local.test.ts
not ok 1 - refus : NODE_ENV=production
      error: 'scripts/dev/cron-local.core.mjs absent : livré par fix(8.1s)'
not ok 2 - refus : NODE_ENV=test
      error: 'scripts/dev/cron-local.core.mjs absent : livré par fix(8.1s)'
# … 43 autre(s) sous-test(s) en échec retenu(s)
# tests 45
# pass 0
# fail 45
# cancelled 0
# run 107 (bc864fa, « après », code final) — tests/schema/essai-cron-local.test.ts
ok 1 - refus : NODE_ENV=production
ok 2 - refus : NODE_ENV=test
ok 3 - refus : CRON_SECRET absent
# … 42 autre(s) sous-test(s) réussi(s)
# tests 45
# pass 45
# fail 0
# cancelled 0
```

```text
# run 95 (db21d1c, « avant ») — tests/schema/essai-env-local.test.ts
not ok 1 - \# et $ : valeur lue par Next, pas celle de parseEnvFile
      error: 'scripts/dev/env-local.mjs absent : livré par fix(8.1s)'
not ok 2 - fichiers CRLF et avec BOM : lus comme Next
      error: 'scripts/dev/env-local.mjs absent : livré par fix(8.1s)'
# … 8 autre(s) sous-test(s) en échec retenu(s)
# tests 10
# pass 0
# fail 10
# cancelled 0
# run 107 (bc864fa, « après », code final) — tests/schema/essai-env-local.test.ts
ok 1 - \# et $ : valeur lue par Next, pas celle de parseEnvFile
ok 2 - fichiers CRLF et avec BOM : lus comme Next
ok 3 - valeur du fichier rendue même si le shell définit la clé ; copie du shell prise avant le chargement
# … 7 autre(s) sous-test(s) réussi(s)
# tests 10
# pass 10
# fail 0
# cancelled 0
```

```text
# run 95 (db21d1c, « avant ») — tests/schema/essai-seed-gardes.test.ts
not ok 1 - refus : NODE_ENV=production
      error: 'scripts/dev/seed-dev.core.ts absent : livré par fix(8.1s)'
not ok 2 - refus : NODE_ENV=test
      error: 'scripts/dev/seed-dev.core.ts absent : livré par fix(8.1s)'
# … 31 autre(s) sous-test(s) en échec retenu(s)
# tests 34
# pass 1
# fail 33
# cancelled 0
# run 107 (bc864fa, « après », code final) — tests/schema/essai-seed-gardes.test.ts
ok 1 - refus : NODE_ENV=production
ok 2 - refus : NODE_ENV=test
ok 3 - refus : hors terminal interactif
# … 31 autre(s) sous-test(s) réussi(s)
# tests 34
# pass 34
# fail 0
# cancelled 0
```

```text
# run 95 (db21d1c, « avant ») — tests/schema/essai-faux-samirpay.test.ts
not ok 1 - NODE_ENV=production : refus, rien n’écoute
      error: 'scripts/dev/fake-samirpay.mjs absent : livré par fix(8.1s)'
not ok 2 - NODE_ENV=test : refus, rien n’écoute
      error: 'scripts/dev/fake-samirpay.mjs absent : livré par fix(8.1s)'
# … 10 autre(s) sous-test(s) en échec retenu(s)
# tests 12
# pass 0
# fail 12
# cancelled 0
# run 107 (bc864fa, « après », code final) — tests/schema/essai-faux-samirpay.test.ts
ok 1 - NODE_ENV=production : refus, rien n’écoute
ok 2 - NODE_ENV=test : refus, rien n’écoute
ok 1 - écoute sur 127.0.0.1 seulement : une autre adresse de boucle locale ne répond pas
# … 9 autre(s) sous-test(s) réussi(s)
# tests 12
# pass 12
# fail 0
# cancelled 0
```

```text
# run 95 (db21d1c, « avant ») — tests/parcours/essai-middleware.test.ts
not ok 1 - en test (NODE_ENV=test, EV_INTEGRATIONS=fake), sans session
      error: sans session /dev : HTTP 307 vers http://localhost:3000/login?redirect=%2Fdev
        307 !== 404
not ok 2 - en production, sans session
      error: production /dev : HTTP 307 vers http://localhost:3000/login?redirect=%2Fdev
        307 !== 404
# … 3 autre(s) sous-test(s) en échec retenu(s)
# tests 6
# pass 1
# fail 5
# cancelled 0
# run 107 (bc864fa, « après », code final) — tests/parcours/essai-middleware.test.ts
ok 1 - en test (NODE_ENV=test, EV_INTEGRATIONS=fake), sans session
ok 2 - en production, sans session
ok 3 - avec une session de superadmin : toujours 404, en test comme en production
# … 3 autre(s) sous-test(s) réussi(s)
# tests 6
# pass 6
# fail 0
# cancelled 0
```

```text
# run 95 (db21d1c, « avant ») — tests/parcours/essai-seed-dev.test.ts
not ok 1 - six comptes de démonstration, un par rôle et deux clients, marqués et fictifs
      error: 'scripts/dev/seed-dev.core.ts absent : livré par fix(8.1s)'
not ok 2 - partenaire VALIDE et vérifié, activité ORGANISATEUR, contrôleur affecté
      error: 'scripts/dev/seed-dev.core.ts absent : livré par fix(8.1s)'
# … 9 autre(s) sous-test(s) en échec retenu(s)
# crochet en échec :
not ok 3 - /home/runner/work/event-village/event-village/tests/parcours/essai-seed-dev.test.ts
  schéma du lot 8 incomplet (essai-seed-dev) : invariants (r)(s)(t) impossibles à vérifier :
  colonne public.ticket_categories.sale_online absente — canaux de vente (contrat 2.4, migration 20261106000001)
  colonne public.ticket_categories.sale_counter absente — canaux de vente (contrat 2.4, migration 20261106000001)
# tests 11
# pass 0
# fail 11
# cancelled 0
# run 107 (bc864fa, « après », code final) — tests/parcours/essai-seed-dev.test.ts
ok 1 - six comptes de démonstration, un par rôle et deux clients, marqués et fictifs
ok 2 - partenaire VALIDE et vérifié, activité ORGANISATEUR, contrôleur affecté
ok 3 - quatre événements : deux publiés (payant, gratuit), un en attente, un brouillon, avec affiche
# … 8 autre(s) sous-test(s) réussi(s)
[INVARIANT-RECETTE] essai-seed-dev — (r)(s)(t) : 0 violation(s)
# tests 11
# pass 11
# fail 0
# cancelled 0
```

```text
# run 95 (db21d1c, « avant ») — tests/parcours/essai-simule.test.ts
not ok 1 - sonde indépendante de M2, puis ev_request_simulated de bout en bout
      error: SUPPOSÉ CONFIRMÉ : PostgREST 16.5 expose request.headers et x-ev-simulation y arrive. Rouge seulement parce que M2 n'est pas livrée : public.ev_request_simulated() ne répond pas (PGRST202 Could not find the function public.ev_request_simulated without paramete …
not ok 1 - en-tête présent : refund_request crée un cashout simulé, sur un paiement réel
      error: M2 (20261106000002_lot8_essai.sql, fix(8.1s)) non appliquée, objets absents : colonne public.payments.simulated ; colonne public.cashouts.simulated ; fonction public.ev_request_simulated ; trigger trg_payments_simulated sur public.payments ; trigger trg_paymen …
# … 22 autre(s) sous-test(s) en échec retenu(s)
# crochet en échec :
not ok 6 - /home/runner/work/event-village/event-village/tests/parcours/essai-simule.test.ts
  schéma du lot 8 incomplet (essai-simule) : invariants (r)(s)(t) impossibles à vérifier :
  colonne public.ticket_categories.sale_online absente — canaux de vente (contrat 2.4, migration 20261106000001)
  colonne public.ticket_categories.sale_counter absente — canaux de vente (contrat 2.4, migration 20261106000001)
# tests 24
# pass 0
# fail 24
# cancelled 0
# run 107 (bc864fa, « après », code final) — tests/parcours/essai-simule.test.ts
ok 1 - sonde indépendante de M2, puis ev_request_simulated de bout en bout
ok 1 - en-tête présent : refund_request crée un cashout simulé, sur un paiement réel
ok 2 - en-tête présent : ticket_refund_request crée un cashout simulé
# … 21 autre(s) sous-test(s) réussi(s)
[INVARIANT-RECETTE] essai-simule — (r)(s)(t) : 0 violation(s)
# tests 24
# pass 24
# fail 0
# cancelled 0
```

**Preuve contre le build (e2e).** Run 95, phase `fake-prod` : la page et la route de développement existaient sur le build (redirection 307 et 401 au lieu de 404) ; le refus de `EV_INTEGRATIONS=fake` en production tenait déjà.

```text
[FAKE-PROD] ═══ production : next start -p 3199, EV_INTEGRATIONS=fake ═══
[FAKE-PROD] production : OK GET /login répond (témoin) HTTP 200
[FAKE-PROD] production : OK POST /api/auth/register/start, numéro neuf, refusé HTTP 500 {"error":"Inscription momentanément impossible. Réessayez dans un instant.","code":"REGISTER_START_FAILED"}
[FAKE-PROD] production : OK aucun SMS au faux MTarget 0 SMS
[FAKE-PROD] production : ÉCHEC GET /dev/paiements HTTP 307 http://localhost:3199/login?redirect=%2Fdev%2Fpaiements (vers http://localhost:3
[FAKE-PROD] production : ÉCHEC POST /api/dev/samirpay/validate HTTP 401 {"error":"Authentification requise pour cette ressource."}
[FAKE-PROD] production : ÉCHEC, 2 écart(s) ; fin de la sortie du serveur :
```

```text
  ✘  2 [fumee] › e2e/fumee.spec.ts:807:5 › pages et routes de développement : 404 sur next start, avec et sans session (214ms)
[e2e] index des captures : .e2e-captures/captures/index.txt (323 entrée(s), 43 en échec)


  1) [fumee] › e2e/fumee.spec.ts:807:5 › pages et routes de développement : 404 sur next start, avec et sans session

    Error: aucune redirection vers la connexion, aucun 401 : ces adresses n’existent pas sur un build

    expect(received).toEqual(expected) // deep equality

    - Expected  - 3
    + Received  + 3

      Array [
    -   "sans session GET /dev/paiements : 404",
    -   "sans session GET /api/dev/samirpay/x : 404",
    -   "sans session POST /api/dev/samirpay/x : 404",
    +   "sans session GET /dev/paiements : 307",
    +   "sans session GET /api/dev/samirpay/x : 401",
    +   "sans session POST /api/dev/samirpay/x : 401",
```

```text
  1) [dev-page] › e2e/dev-page.spec.ts:53:13 › page de développement : mobile, clair ───────────────

    Error: [e2e][dev-page] scripts/e2e/render-dev-page.tsx : code 1
    [render-dev-page] components/dev/FakePaymentPanel.tsx absent : la page de développement n'est pas encore livrée (fix(8.1e)).
```

Run 107 :

```text
[FAKE-PROD] ═══ production : next start -p 3199, EV_INTEGRATIONS=fake ═══
[FAKE-PROD] production : OK GET /login répond (témoin) HTTP 200
[FAKE-PROD] production : OK POST /api/auth/register/start, numéro neuf, refusé HTTP 500 {"error":"Inscription momentanément impossible. Réessayez dans un instant.","code":"REGISTER_START_FAILED"}
[FAKE-PROD] production : OK aucun SMS au faux MTarget 0 SMS
[FAKE-PROD] production : OK GET /dev/paiements HTTP 404
[FAKE-PROD] production : OK POST /api/dev/samirpay/validate HTTP 404
[FAKE-PROD] production : conforme
[FAKE-PROD] ═══ development : next start -p 3199, EV_INTEGRATIONS=fake ═══
[FAKE-PROD] development : OK GET /login répond (témoin) HTTP 200
[FAKE-PROD] development : OK POST /api/auth/register/start, numéro neuf, refusé HTTP 500 {"error":"Inscription momentanément impossible. Réessayez dans un instant.","code":"REGISTER_START_FAILED"}
[FAKE-PROD] development : OK aucun SMS au faux MTarget 0 SMS
[FAKE-PROD] development : OK GET /dev/paiements HTTP 404
[FAKE-PROD] development : OK POST /api/dev/samirpay/validate HTTP 404
[FAKE-PROD] development : conforme
[FAKE-PROD] résultat : OK, simulé impossible sur le build, dans les deux lancements
[e2e] phase fake-prod : OK en 1s
```

```text
  ✓  1 [dev-page] › e2e/dev-page.spec.ts:53:13 › page de développement : mobile, clair (796ms)
  ✓  2 [dev-page] › e2e/dev-page.spec.ts:53:13 › page de développement : mobile, sombre (773ms)
  ✓  3 [dev-page] › e2e/dev-page.spec.ts:53:13 › page de développement : ordinateur, clair (653ms)
  ✓  4 [dev-page] › e2e/dev-page.spec.ts:53:13 › page de développement : ordinateur, sombre (687ms)
[e2e] phase dev-page : OK en 4s
  ✓  2 [fumee] › e2e/fumee.spec.ts:604:5 › pages et routes de développement : 404 sur next start, avec et sans session (100ms)
```

`anonymisation-debogage` (test existant modifié, signalé) admet désormais `app/api/dev` à condition d'y trouver seulement des `route.dev.ts` ; il est vert aux deux runs.

**Correctif.**

```text
$ git show --numstat 310a4d80
310a4d80 fix(8.1s): mode d'essai côté serveur et scripts. M2 marque payments et cashouts simulés depuis l'en-tête x-ev-simulation, envoyé par le seul client service_role d'un serveur d'essai, héritage …
  +   58 -    0  app/api/dev/samirpay/[action]/route.dev.ts
  +    2 -    2  app/api/partner/team/invite/route.ts
  +    4 -    0  instrumentation.ts
  +   10 -    3  lib/env.ts
  +   55 -    0  lib/integrations/dev-adapters.ts
  +   41 -    5  lib/integrations/registry.ts
  +   40 -    0  lib/integrations/simulation.ts
  +   11 -    4  lib/samirpay/http-client.ts
  +    4 -    1  lib/supabase/server.ts
  +   11 -    0  middleware.ts
  +   10 -    1  next.config.mjs
  +  129 -    0  scripts/dev/cron-local.core.mjs
  +  130 -    0  scripts/dev/cron-local.mjs
  +   69 -    0  scripts/dev/env-local.mjs
  +    6 -    0  scripts/dev/essai-keys.mjs
  +   88 -    0  scripts/dev/essai-start.mjs
  +  182 -    0  scripts/dev/fake-samirpay.mjs
  +  306 -    0  scripts/dev/seed-dev.core.ts
  +   54 -    0  scripts/dev/seed-dev.ts
  +  175 -    0  supabase/migrations/20261106000002_lot8_essai.sql
$ git show --numstat 565103ff
565103ff chore(8.1): les scripts du mode d'essai s'appellent enfin par npm run (contrat 5.2). package.json : seed:dev, cron:local, fake:samirpay, essai:build, essai:start, branchés sur les entrées de  …
  +    5 -    0  package.json
$ git show --numstat 51d96fbf
51d96fbf fix(8.1e): l'utilisateur peut enfin valider ou refuser un paiement simulé depuis le PC comme depuis le téléphone : /dev/paiements liste les paiements en attente lus sur le faux service à 127. …
  +  160 -    0  app/dev/paiements/[id]/page.dev.tsx
  +  117 -    0  app/dev/paiements/page.dev.tsx
  +  143 -    0  components/dev/FakePaymentPanel.tsx
  (+ 3 trace(s) docs/lot8-logs/ non listée(s))
$ git show --numstat 6ea04e48
6ea04e48 fix(8.1): l'aide de cron-local donne une commande qui marche sous PowerShell 5.1. npm.ps1 y perd le « -- » (essai de D1) : l'en-tête et le message d'erreur citent désormais node scripts/dev/c …
  +    4 -    3  scripts/dev/cron-local.mjs
$ git show --numstat f58af056
f58af056 docs(8.1): guide d'essai local pour Windows et déploiement à jour (contrat 5.6, 19, ligne D1 de 18.1). docs/essai-local.md, pas à pas sans valeur réelle : modes A et B, migrations 20261106 av …
  +   29 -    0  .env.example
  +   55 -    9  docs/deploiement-projet-neuf.md
  +  541 -    0  docs/essai-local.md
$ git show --numstat efa07a63
efa07a63 test(8.1): anonymisation-debogage admet app/api/dev à une condition plus forte que le refus du seul nom (test existant modifié, signalé au rapport). fix(8.1s) crée ce dossier, imposé par le c …
  +   14 -    2  tests/parcours/anonymisation-debogage.test.ts
```

`docs/essai-local.md` n'est relu par aucun test. `seed:dev` et les migrations sur event-village-dev n'ont pas été lancés par l'agent de documentation (terminal interactif, projet distant) : non prouvé par exécution.

### 8.2 a — Double paiement réussi d'un même panier

**Origine.** `discovery-8-paiement.md`, section a : trois chemins mènent à deux succès (garde D4 limitée au `PENDING` non échu, `M/20261105000006:66-74` ; annulation libérée puis succès tardif ; `FAILED` confirmé par webhook). « `payment_confirm` n'a aucun contrôle croisé : si le stock le permet, il émet un second jeu de billets », et le remboursement n'arrive que « par hasard de stock ». Trou voisin : `getSolde()` en échec laisse le cashout `A_ENVOYER` sans relance automatique.

```text
# run 95 (db21d1c, « avant ») — tests/parcours/double-paiement.test.ts
not ok 1 - 1. A annulé, B confirmé, succès tardif de A par webhook : A remboursé, un seul jeu, un REFUND_PAID, une alerte par admin
      error: paiement en double e446e0b2-208a-44a9-93b7-134cd56ee150 : statut SUCCESS, remboursement attendu ; 2 billet(s) émis en second jeu
not ok 2 - 2. même chose par le cron : A EXPIRED, rattrapage tardif (RECONCILIATION), A remboursé
      error: paiement en double 32d09996-63aa-4a41-8dc7-59d8e3500d76 : statut SUCCESS, remboursement attendu ; 2 billet(s) émis en second jeu
not ok 3 - 3. ordre inverse : A PENDING échu confirmé d’abord, B ensuite : B, second confirmé, est remboursé
      error: paiement en double 2a22af0b-f90f-40db-8079-f3e8749b4dc6 : statut SUCCESS, remboursement attendu ; 2 billet(s) émis en second jeu
not ok 4 - 4. rejeu du webhook : REFUND_IN_PROGRESS, pas de second cashout, pas de second envoi
      error: paiement en double ce6258bd-2291-4953-86e6-c41e1b032bee : statut SUCCESS, remboursement attendu ; 1 billet(s) émis en second jeu
# … 3 autre(s) sous-test(s) en échec retenu(s)
# crochet en échec :
not ok 4 - /home/runner/work/event-village/event-village/tests/parcours/double-paiement.test.ts
  schéma du lot 8 incomplet (double-paiement) : invariants (r)(s)(t) impossibles à vérifier :
  colonne public.ticket_categories.sale_online absente — canaux de vente (contrat 2.4, migration 20261106000001)
  colonne public.ticket_categories.sale_counter absente — canaux de vente (contrat 2.4, migration 20261106000001)
# tests 10
# pass 3
# fail 7
# cancelled 0
# run 107 (bc864fa, « après », code final) — tests/parcours/double-paiement.test.ts
ok 1 - 1. A annulé, B confirmé, succès tardif de A par webhook : A remboursé, un seul jeu, un REFUND_PAID, une alerte par admin
ok 2 - 2. même chose par le cron : A EXPIRED, rattrapage tardif (RECONCILIATION), A remboursé
ok 3 - 3. ordre inverse : A PENDING échu confirmé d’abord, B ensuite : B, second confirmé, est remboursé
ok 4 - 4. rejeu du webhook : REFUND_IN_PROGRESS, pas de second cashout, pas de second envoi
ok 5 - 8. concurrence : deux payment_confirm sur deux connexions, le second attend le premier : un seul jeu
ok 1 - 9. refus de l’opérateur : ADMIN_REFUND_TO_RETRY à l’admin, la relance par la route aboutit
# … 4 autre(s) sous-test(s) réussi(s)
[INVARIANT-RECETTE] double-paiement — (r)(s)(t) : 0 violation(s)
# tests 10
# pass 10
# fail 0
# cancelled 0
```

Registre des types : le type d'alerte `ADMIN_DUPLICATE_PAYMENT` manquait.

```text
# run 95 (db21d1c, « avant ») — tests/parcours/notif-outbox.test.ts
not ok 1 - public.notification_types contient exactement les types du contrat, avec famille, sujet, canaux, audience, politique, journal et permission
      error: types absents du registre : ADMIN_DUPLICATE_PAYMENT
# tests 32
# pass 31
# fail 1
# cancelled 0
# run 107 (bc864fa, « après », code final) — tests/parcours/notif-outbox.test.ts
ok 1 - public.notification_types contient exactement les types du contrat, avec famille, sujet, canaux, audience, politique, journal et permission
# … 31 autre(s) sous-test(s) réussi(s)
# tests 32
# pass 32
# fail 0
# cancelled 0
```

```text
# run 95 (db21d1c, « avant ») — tests/parcours/notif-migration.test.ts
not ok 1 - registre notification_types : tous les types de l’inventaire (K1) et des envois TypeScript
      error: types absents du registre : ADMIN_DUPLICATE_PAYMENT
not ok 2 - RPC recopiées : chacune existe et nomme ses types
      error: B1-B3, B4 : public.payment_confirm ne met pas 'ADMIN_DUPLICATE_PAYMENT' en file
# tests 20
# pass 18
# fail 2
# cancelled 0
# run 107 (bc864fa, « après », code final) — tests/parcours/notif-migration.test.ts
ok 1 - registre notification_types : tous les types de l’inventaire (K1) et des envois TypeScript
ok 2 - RPC recopiées : chacune existe et nomme ses types
# … 18 autre(s) sous-test(s) réussi(s)
# tests 20
# pass 20
# fail 0
# cancelled 0
```

**Correctif.**

```text
$ git show --numstat bf196db4
bf196db4 fix(8.2a): le second paiement réussi d'un même panier est remboursé par le cashout existant, avec avis REFUND_PAID et alerte ADMIN_DUPLICATE_PAYMENT, sous le verrou de l'événement (L30 à L32) …
  +    5 -    1  app/api/cron/payments-reconcile/route.ts
  +    2 -    2  lib/events/event-cancellation.service.ts
  +    2 -    0  lib/notifications/catalog-types.ts
  +    9 -    0  lib/notifications/catalog.ts
  +    1 -    0  lib/notifications/outbox-labels.ts
  +   89 -    5  lib/payments/cashout.service.ts
  +   78 -    5  supabase/migrations/20261106000003_lot8_paiement.sql
```

### 8.2 b — Ordre des verrous (`payment_confirm` contre `event_cancel`)

**Origine.** `discovery-8-paiement.md`, section b. D9 annonçait un cycle paiement ↔ catégories et « aucun test rouge déterministe possible ». La découverte rectifie : le vrai cycle passe par la clé étrangère (`payment_confirm` tient les catégories et veut `FOR KEY SHARE` sur `events` à l'`INSERT tickets` ; `event_cancel` tient `events FOR UPDATE` et attend les catégories). Une troisième connexion rend le cycle déterministe. Même famille : `ticket_scan`, `checkout_create_payment`, `free_tickets_claim`, `counter_sale`.

```text
# run 95 (db21d1c, « avant ») — tests/parcours/course-confirmation-annulation.test.ts
not ok 1 - 1. vrai cycle : C tient les réservations, A confirme, B annule, C annule : A CONFIRMED puis B aboutit, aucun 40P01
      error: interblocage (40P01) :
        B (annulation) : erreur 40P01 deadlock detected
not ok 3 - 3. point ouvert 11 : C tient les catégories, B tient events, A lance ticket_scan : A rend son verdict, B aboutit, aucun 40P01
      error: interblocage (40P01) :
        A : erreur 40P01 deadlock detected
not ok 4 - 4. même famille, checkout_create_payment : A tient sa catégorie et la clé étrangère passe, B aboutit, aucun 40P01
      error: interblocage (40P01) :
        A : erreur 40P01 deadlock detected
not ok 5 - 5. même famille, free_tickets_claim : A tient sa catégorie gratuite et la clé étrangère passe, B aboutit, aucun 40P01
      error: interblocage (40P01) :
        A : erreur 40P01 deadlock detected
# … 1 autre(s) sous-test(s) en échec retenu(s)
# crochet en échec :
not ok 3 - /home/runner/work/event-village/event-village/tests/parcours/course-confirmation-annulation.test.ts
  schéma du lot 8 incomplet (course-confirmation-annulation) : invariants (r)(s)(t) impossibles à vérifier :
  colonne public.ticket_categories.sale_online absente — canaux de vente (contrat 2.4, migration 20261106000001)
  colonne public.ticket_categories.sale_counter absente — canaux de vente (contrat 2.4, migration 20261106000001)
# tests 6
# pass 1
# fail 5
# cancelled 0
# run 107 (bc864fa, « après », code final) — tests/parcours/course-confirmation-annulation.test.ts
ok 1 - 1. vrai cycle : C tient les réservations, A confirme, B annule, C annule : A CONFIRMED puis B aboutit, aucun 40P01
ok 3 - 3. point ouvert 11 : C tient les catégories, B tient events, A lance ticket_scan : A rend son verdict, B aboutit, aucun 40P01
ok 4 - 4. même famille, checkout_create_payment : A tient sa catégorie et la clé étrangère passe, B aboutit, aucun 40P01
ok 5 - 5. même famille, free_tickets_claim : A tient sa catégorie gratuite et la clé étrangère passe, B aboutit, aucun 40P01
ok 1 - 6. pg_get_functiondef : events FOR NO KEY UPDATE dans les deux ; paiements avant catégories dans event_cancel ; events avant le verrou du paiement dans payment_confirm
# … 1 autre(s) sous-test(s) réussi(s)
[INVARIANT-RECETTE] course-confirmation-annulation — (r)(s)(t) : 0 violation(s)
# tests 6
# pass 6
# fail 0
# cancelled 0
```

```text
# run 95 (db21d1c, « avant ») — tests/parcours/course-annulation-transfert.test.ts
# (aucun sous-test retenu en échec à ce run)
# tests 4
# pass 4
# fail 0
# cancelled 0
# run 107 (bc864fa, « après », code final) — tests/parcours/course-annulation-transfert.test.ts
ok 1 - 1. A accepte sans COMMIT, B annule et attend ; après le COMMIT de A, le destinataire reçoit EVENT_CANCELLED, l’expéditeur non
ok 2 - 2. ordre inverse : B tient event_cancel sans COMMIT, A attend ; après le COMMIT de B, A est refusé et le porteur ne change pas
ok 3 - 3. course au milieu de event_cancel (C tient les catégories, B annule, A accepte) : aucun interblocage, A refusé, billet à l’expéditeur
ok 1 - 4. événement ANNULE puis SUSPENDU (transaction annulée) → EVENT_NOT_ACTIVE ; témoin PUBLIE → réclamation réussie
# tests 4
# pass 4
# fail 0
# cancelled 0
```

**Correctif, premier cycle.** `events FOR NO KEY UPDATE`, puis paiements, catégories, transferts, billets, dans `payment_confirm` et `event_cancel` (M3) :

```text
$ git show --numstat 14501cf0
14501cf0 fix(8.2b): ordre unique des verrous, events FOR NO KEY UPDATE puis paiements, catégories, transferts, billets (L34). M3 recopie payment_confirm, qui prend l'événement avant le paiement sauf s …
  +  357 -    0  supabase/migrations/20261106000003_lot8_paiement.sql
```

**Second cycle, que le contrat avait manqué.** Le contrat 2.3 ne connaissait pas `ticket_scans.category_id`. L'`INSERT` du scan demande `FOR KEY SHARE` sur la catégorie alors que le billet est tenu ; `event_cancel` tenait la catégorie `FOR UPDATE` et attendait le billet. Le cas 3 (point ouvert 11, `ticket_scan`) est resté rouge au run 96, après le premier correctif :

```text
# run 96 (8f77b1b) — tests/parcours/course-confirmation-annulation.test.ts
not ok 3 - 3. point ouvert 11 : C tient les catégories, B tient events, A lance ticket_scan : A rend son verdict, B aboutit, aucun 40P01
      error: interblocage (40P01) :
        A : erreur 40P01 deadlock detected
# tests 6
# pass 5
# fail 1
# cancelled 0
# run 107 (bc864fa, « après », code final) — tests/parcours/course-confirmation-annulation.test.ts
ok 3 - 3. point ouvert 11 : C tient les catégories, B tient events, A lance ticket_scan : A rend son verdict, B aboutit, aucun 40P01
# … 5 autre(s) sous-test(s) réussi(s)
[INVARIANT-RECETTE] course-confirmation-annulation — (r)(s)(t) : 0 violation(s)
# tests 6
# pass 6
# fail 0
# cancelled 0
```

`event_cancel` prend désormais ses catégories `FOR NO KEY UPDATE` (M3, même verrou que son `UPDATE sold_quantity`, conflit inchangé avec les `FOR UPDATE` de la vente) :

```text
$ git show --numstat 621c804f
621c804f fix(8.2b): second cycle de verrous levé, ticket_scan contre event_cancel (rouge du run 96, point ouvert 11). Le contrat 2.3 avait manqué ticket_scans.category_id : l'INSERT du scan demande FO …
  +    4 -    1  supabase/migrations/20261106000003_lot8_paiement.sql
```

Au run 97, le cas 3 est vert, mais le cas 6 (lecture de `pg_get_functiondef`) cherchait encore `FOR UPDATE` sur les catégories. Le test a été renforcé, pas relâché : il exige maintenant `FOR NO KEY UPDATE` et l'absence de tout `FOR UPDATE` sur les catégories d'`event_cancel` (test du lot modifié, signalé).

```text
# run 97 (621c804) — tests/parcours/course-confirmation-annulation.test.ts
not ok 1 - 6. pg_get_functiondef : events FOR NO KEY UPDATE dans les deux ; paiements avant catégories dans event_cancel ; events avant le verrou du paiement dans payment_confirm
      error: 'event_cancel : verrou des catégories'
# tests 6
# pass 5
# fail 1
# cancelled 0
# run 107 (bc864fa, « après », code final) — tests/parcours/course-confirmation-annulation.test.ts
ok 1 - 6. pg_get_functiondef : events FOR NO KEY UPDATE dans les deux ; paiements avant catégories dans event_cancel ; events avant le verrou du paiement dans payment_confirm
# … 5 autre(s) sous-test(s) réussi(s)
[INVARIANT-RECETTE] course-confirmation-annulation — (r)(s)(t) : 0 violation(s)
# tests 6
# pass 6
# fail 0
# cancelled 0
```

```text
$ git show --numstat a8c653b2
a8c653b2 test(8.2b): course-confirmation-annulation cas 6 exige FOR NO KEY UPDATE sur les catégories (test du lot renforcé, signalé au rapport). Il cherchait FOR UPDATE, ce que le correctif du second  …
  +    3 -    2  tests/parcours/course-confirmation-annulation.test.ts
```

Le tableau des verrous et les fonctions de la famille non corrigées sont en section 9 (PO3, PO4).

### 8.2 c — Commissions plafonnées au revenu net

**Origine.** `discovery-8-paiement.md`, section c : avec la grille (13 % au plus), un dépassement à la vente est impossible, force brute à l'appui ; il est possible en base (aucun plafond, taux réglables jusqu'à 100 % chacun) et **réel avec la grille après un remboursement partiel** : `fin_referral_on_refund` proratise sur le montant remboursé, pas sur le revenu net (31 cas sur 72 paniers balayés).

```text
# run 95 (db21d1c, « avant ») — tests/parcours/commissions-plafond.test.ts
not ok 1 - 1. relation à 80/30 sur 1 000 F : N1 27,40 F, N2 6,85 F, uncapped_amount 10,28 F, grand livre égal
      error: N2 plafonnée au reste du net (34,25 − 27,40), calculée 10.28 F
        1028 !== 685
not ok 2 - 2. relation à 100/100 : N1 = net, aucune ligne N2
      error: une seule ligne, N1 = net : [{"gen":"N1","kind":"COMMISSION","status":"PENDING","amount":34.25,"reason":null},{"gen":"N2","kind":"COMMISSION","status":"PENDING","amount":34.25,"reason":null}]
not ok 3 - 2 bis. relation à 120/10 : N1 plafonnée au net avec sa trace, aucune ligne N2
      error: N1 = net, calculée 41,10 F : [{"gen":"N1","kind":"COMMISSION","status":"PENDING","amount":41.1,"reason":null},{"gen":"N2","kind":"COMMISSION","status":"PENDING","amount":3.43,"reason":null}]
not ok 4 - 3. témoin : la grille 5/2 donne 1,71 F et 0,69 F, sans trace de plafond
      error: 'colonne referral_commissions.uncapped_amount absente — contrat 2.7, migration 20261106000004'
# … 4 autre(s) sous-test(s) en échec retenu(s)
# crochet en échec :
not ok 3 - /home/runner/work/event-village/event-village/tests/parcours/commissions-plafond.test.ts
  schéma du lot 8 incomplet (commissions-plafond) : invariants (r)(s)(t) impossibles à vérifier :
  colonne public.ticket_categories.sale_online absente — canaux de vente (contrat 2.4, migration 20261106000001)
  colonne public.ticket_categories.sale_counter absente — canaux de vente (contrat 2.4, migration 20261106000001)
# tests 9
# pass 1
# fail 8
# cancelled 0
# run 107 (bc864fa, « après », code final) — tests/parcours/commissions-plafond.test.ts
ok 1 - 1. relation à 80/30 sur 1 000 F : N1 27,40 F, N2 6,85 F, uncapped_amount 10,28 F, grand livre égal
ok 2 - 2. relation à 100/100 : N1 = net, aucune ligne N2
ok 3 - 2 bis. relation à 120/10 : N1 plafonnée au net avec sa trace, aucune ligne N2
ok 4 - 3. témoin : la grille 5/2 donne 1,71 F et 0,69 F, sans trace de plafond
ok 5 - 4. frais à 0 % : net négatif, aucune commission, aucune violation de (r)
ok 1 - 5. panier 10 000 + 100 F, remboursement du gros billet, net effectif −154,08 F : commissions annulées, soldes à 0
# … 3 autre(s) sous-test(s) réussi(s)
[INVARIANT-RECETTE] commissions-plafond — (r)(s)(t) : 0 violation(s)
# tests 9
# pass 9
# fail 0
# cancelled 0
```

**Correctif.** N1 = min(calcul, net), N2 = min(calcul, net − N1), même budget au remboursement partiel (AR5, extension signalée). Exemple chiffré : section 7.

```text
$ git show --numstat 66114620
66114620 fix(8.2c): les commissions d'une vente ne dépassent plus le revenu net d'Event Village (AR5, L36). M4 plafonne N1 = min(calcul, net) et N2 = min(calcul, net − N1), et garde le même budget au  …
  +  210 -    0  supabase/migrations/20261106000004_lot8_commissions.sql
```

### 8.2 d — Invariants (r) et (s)

**Origine.** `discovery-8-paiement.md`, section d : `0 ≤ net` est faux pour un paiement à net négatif sans commission, l'invariant (r) littéral sortirait en violation ; il porte donc sur `GREATEST(net, 0)`. Aide unique `tests/helpers/recette-invariants.ts`, qui enveloppe `assertTerrainInvariants` sans le modifier (AR2).

Garde-fous à violation fabriquée, en transaction annulée :

```text
# run 95 (db21d1c, « avant ») — tests/parcours/recette-invariant.test.ts
not ok 1 - r1 : commission 40 sur un net de 34,25 détectée ; annulée, elle ne compte plus ; net −15 sans commission : aucune ligne
      error: schéma du lot 8 incomplet (recetteViolations) : invariants (r)(s)(t) impossibles à vérifier :
        colonne public.ticket_categories.sale_online absente — canaux de vente (contrat 2.4, migration 20261106000001)
not ok 2 - r1 : net NULL avec une commission : violation, jamais une comparaison silencieuse
      error: schéma du lot 8 incomplet (recetteViolations) : invariants (r)(s)(t) impossibles à vérifier :
        colonne public.ticket_categories.sale_online absente — canaux de vente (contrat 2.4, migration 20261106000001)
not ok 3 - r2 : net 34,25, 30 remboursés : commission 5 détectée, commission 4 acceptée
      error: schéma du lot 8 incomplet (recetteViolations) : invariants (r)(s)(t) impossibles à vérifier :
        colonne public.ticket_categories.sale_online absente — canaux de vente (contrat 2.4, migration 20261106000001)
not ok 1 - s1 : deux SUCCESS, même panier, périodes recoupées, détectés ; rachat, panier différent, autre compte et second remboursé : aucune ligne
      error: schéma du lot 8 incomplet (recetteViolations) : invariants (r)(s)(t) impossibles à vérifier :
        colonne public.ticket_categories.sale_online absente — canaux de vente (contrat 2.4, migration 20261106000001)
# … 6 autre(s) sous-test(s) en échec retenu(s)
# crochet en échec :
not ok 4 - /home/runner/work/event-village/event-village/tests/parcours/recette-invariant.test.ts
  schéma du lot 8 incomplet (recette-invariant) : invariants (r)(s)(t) impossibles à vérifier :
  colonne public.ticket_categories.sale_online absente — canaux de vente (contrat 2.4, migration 20261106000001)
  colonne public.ticket_categories.sale_counter absente — canaux de vente (contrat 2.4, migration 20261106000001)
# tests 10
# pass 0
# fail 10
# cancelled 0
# run 107 (bc864fa, « après », code final) — tests/parcours/recette-invariant.test.ts
ok 1 - r1 : commission 40 sur un net de 34,25 détectée ; annulée, elle ne compte plus ; net −15 sans commission : aucune ligne
ok 2 - r1 : net NULL avec une commission : violation, jamais une comparaison silencieuse
ok 3 - r2 : net 34,25, 30 remboursés : commission 5 détectée, commission 4 acceptée
ok 1 - s1 : deux SUCCESS, même panier, périodes recoupées, détectés ; rachat, panier différent, autre compte et second remboursé : aucune ligne
ok 2 - s2 : paiement en double REFUND_PENDING conforme : aucune ligne (témoin) ; REFUNDED aussi
ok 3 - s2 : paiement en double au statut SUCCESS détecté
# … 4 autre(s) sous-test(s) réussi(s)
[INVARIANT-RECETTE] recette-invariant — (r)(s)(t) : 0 violation(s)
# tests 10
# pass 10
# fail 0
# cancelled 0
```

**Correctif.** Pas de commit propre : l'aide vient de l'infrastructure (`a3858d4`), le schéma de M1, M3 et M4. La suite reste rouge tant que les trois ne sont pas livrés (AM8).

```text
$ git show --numstat a3858d43
a3858d43 test(infra)[8]: infrastructure de test du lot 8 : tests/helpers/recette-invariants.ts (invariants (r)(s)(t), assertRecetteInvariants enveloppe assertTerrainInvariants, schéma absent nommé), m …
  +   43 -    3  .github/workflows/verify.yml
  +   17 -    0  tests/helpers/design-files.ts
  +  201 -    0  tests/helpers/recette-invariants.ts
  +    2 -    1  tests/parcours/notif-migration.test.ts
  +   26 -    1  tests/schema/migration-lot7-rejouable.test.ts
  +  234 -    0  tests/schema/migration-lot8-rejouable.test.ts
  +  146 -    0  tests/schema/ordre-suites.test.ts
  +   39 -    0  tests/security/r3-fonctions-rpc.test.ts
```

Au run 107, les 18 suites du lot qui appellent `assertRecetteInvariants` impriment toutes 0 violation (extrait de `verify.log`) ; le seed e2e et les quatre passages de la recette aussi (section 8.3 b) :

```text
[INVARIANT-RECETTE] admin-audit — (r)(s)(t) : 0 violation(s)
[INVARIANT-RECETTE] admin-remboursements — (r)(s)(t) : 0 violation(s)
[INVARIANT-RECETTE] canaux-invariant — (r)(s)(t) : 0 violation(s)
[INVARIANT-RECETTE] canaux-vente — (r)(s)(t) : 0 violation(s)
[INVARIANT-RECETTE] commissions-plafond — (r)(s)(t) : 0 violation(s)
[INVARIANT-RECETTE] course-confirmation-annulation — (r)(s)(t) : 0 violation(s)
[INVARIANT-RECETTE] double-paiement — (r)(s)(t) : 0 violation(s)
[INVARIANT-RECETTE] essai-seed-dev — (r)(s)(t) : 0 violation(s)
[INVARIANT-RECETTE] essai-simule — (r)(s)(t) : 0 violation(s)
[INVARIANT-RECETTE] evenement-404 — (r)(s)(t) : 0 violation(s)
[INVARIANT-RECETTE] messages-bruts — (r)(s)(t) : 0 violation(s)
[INVARIANT-RECETTE] notif-abonnement — (r)(s)(t) : 0 violation(s)
[INVARIANT-RECETTE] parrainage-lien — (r)(s)(t) : 0 violation(s)
[INVARIANT-RECETTE] partenaire-profil-rpc — (r)(s)(t) : 0 violation(s)
[INVARIANT-RECETTE] pilotage-remboursement-billet — (r)(s)(t) : 0 violation(s)
[INVARIANT-RECETTE] recette-invariant — (r)(s)(t) : 0 violation(s)
[INVARIANT-RECETTE] scan-renvoi-seulement — (r)(s)(t) : 0 violation(s)
[INVARIANT-RECETTE] migration-lot8-rejouable — (r)(s)(t) : 0 violation(s)
```

```text
[INVARIANT-RECETTE] seed-demo — (r)(s)(t) : 0 violation(s)
```

### 8.2 e — Scan en mode « renvoi seulement »

**Origine.** `discovery-8-scan-messages.md`, sections 0 et e : un champ `replayOnly` envoyé dans le corps est retiré sans bruit par `z.object` (`app/api/controller/scan/route.ts:15-21`) et le scan part en vrai compostage ; `ticket_scan` écrit une ligne `forbidden` **avant** le rejeu (`20261105000005_lot7_scan.sql:109-112`). Un scan repris jusqu'à 2 minutes après composte le billet sans le spectateur.

```text
# run 95 (db21d1c, « avant ») — tests/parcours/scan-renvoi-seulement.test.ts
not ok 1 - 1. billet VALIDE, replayOnly: true, avec ou sans code : 200 not_processed, billet VALIDE, aucune ligne ticket_scans, aucun avis au porteur
      error: renvoi avec un code valide : not_processed attendu, HTTP 200 {"result":"valid","ticket":{"id":"f855be4e-b6c4-4927-8802-4b9d854958d3","price":0,"holder":"Awa Inconnue","category":"Entrée","checked_in_at":"2026-11-06T19:17:14.631008+00:00","ticket_number":"TCK-H …
not ok 2 - libellé et classement : not_processed est un incident technique, jamais un verdict sur le billet
      error: libellé court de lib/scan/scan-result.ts (contrat 7.1)
not ok 1 - 2. lecture acceptée puis renvoi : verdict d’origine, replayed: true, même scan_id, même billet, une seule ligne
      error: renvoi : HTTP 400 {"error":"Scan invalide : eventId et payload (ou manualTicketNumber) requis."}
        400 !== 200
not ok 2 - 3. renvoi avec un code expiré, sans code ou avec un code illisible : même verdict, aucune ligne ; verdict de refus rendu tel quel
      error: code absent : HTTP 400 {"error":"Scan invalide : eventId et payload (ou manualTicketNumber) requis."}
        400 !== 200
# … 8 autre(s) sous-test(s) en échec retenu(s)
# crochet en échec :
not ok 8 - /home/runner/work/event-village/event-village/tests/parcours/scan-renvoi-seulement.test.ts
  schéma du lot 8 incomplet (scan-renvoi-seulement) : invariants (r)(s)(t) impossibles à vérifier :
  colonne public.ticket_categories.sale_online absente — canaux de vente (contrat 2.4, migration 20261106000001)
  colonne public.ticket_categories.sale_counter absente — canaux de vente (contrat 2.4, migration 20261106000001)
# tests 14
# pass 2
# fail 12
# cancelled 0
# run 107 (bc864fa, « après », code final) — tests/parcours/scan-renvoi-seulement.test.ts
ok 1 - 1. billet VALIDE, replayOnly: true, avec ou sans code : 200 not_processed, billet VALIDE, aucune ligne ticket_scans, aucun avis au porteur
ok 2 - libellé et classement : not_processed est un incident technique, jamais un verdict sur le billet
ok 1 - 2. lecture acceptée puis renvoi : verdict d’origine, replayed: true, même scan_id, même billet, une seule ligne
ok 2 - 3. renvoi avec un code expiré, sans code ou avec un code illisible : même verdict, aucune ligne ; verdict de refus rendu tel quel
ok 1 - 4. scanneur sans droit, avec ou sans code, par la route et par la RPC : 403 SCAN_FORBIDDEN, aucune ligne, pas même forbidden
ok 3 - 5. sans clé, par la RPC directe : { http: 400, code: IDEMPOTENCY_KEY_REQUIRED }, avant toute écriture
# … 8 autre(s) sous-test(s) réussi(s)
[INVARIANT-RECETTE] scan-renvoi-seulement — (r)(s)(t) : 0 violation(s)
# tests 14
# pass 14
# fail 0
# cancelled 0
```

```text
# run 95 (db21d1c, « avant ») — tests/parcours/scanner-interface.test.ts  [sous-tests retenus : /8\.2 e/]
not ok 1 - postScan(..., { replayOnly: true }) envoie { eventId, replayOnly: true }, sans le code, à chaque relance et avec la clé d’origine
      error: essai 1 : corps du renvoi
not ok 2 - saisie manuelle reprise : le numéro de billet n’est pas renvoyé non plus
      error: corps du renvoi d’une saisie manuelle
not ok 4 - not_processed : incident technique, verdict reçu (aucune boucle de renvoi), ni refus de billet ni vibration
      error: résultat lu par le client : {"result":"server_error","failure":"server","httpStatus":200,"message":"Scan non traité : aucune entrée enregistrée. Scannez le billet de nouveau.","attempts":1}
not ok 5 - app/controller/scanner/page.tsx : runScan envoie replayOnly seulement pour un scan repris (4e paramètre renseigné)
      error: 'app/controller/scanner/page.tsx : postScan(request, { …, replayOnly: recoveredAt !== null })'
# … 1 autre(s) sous-test(s) en échec retenu(s)
# tests 33
# pass 28
# fail 5
# cancelled 0
# run 107 (bc864fa, « après », code final) — tests/parcours/scanner-interface.test.ts  [sous-tests retenus : /8\.2 e/]
ok 1 - postScan(..., { replayOnly: true }) envoie { eventId, replayOnly: true }, sans le code, à chaque relance et avec la clé d’origine
ok 2 - saisie manuelle reprise : le numéro de billet n’est pas renvoyé non plus
ok 4 - not_processed : incident technique, verdict reçu (aucune boucle de renvoi), ni refus de billet ni vibration
ok 5 - app/controller/scanner/page.tsx : runScan envoie replayOnly seulement pour un scan repris (4e paramètre renseigné)
ok 7 - app/partner/scan/page.tsx : runScan envoie replayOnly seulement pour un scan repris (4e paramètre renseigné)
# … 3 autre(s) sous-test(s) réussi(s) dans ce filtre
# tests 33
# pass 33
# fail 0
# cancelled 0
```

```text
# run 95 (db21d1c, « avant ») — tests/parcours/acces-tracabilite.test.ts
not ok 1 - type ScanResult = exactement l’union du contrat
      error: ScanResult = valid | already_used | invalid | cancelled | refunded | wrong_event | event_cancelled | event_ended | event_suspended | event_not_open | payment_required | cash_required | qr_expired | dynamic_qr_required | manual_entry_refused | rate_limited | ne …
        ... Skipped lines
# tests 8
# pass 7
# fail 1
# cancelled 0
# run 107 (bc864fa, « après », code final) — tests/parcours/acces-tracabilite.test.ts
ok 1 - type ScanResult = exactement l’union du contrat
# … 7 autre(s) sous-test(s) réussi(s)
# tests 8
# pass 8
# fail 0
# cancelled 0
```

Terrain 11, run 95 puis run 107 :

```text
  4) [terrain] › e2e/terrain.spec.ts:863:5 › 11. lecture jamais arrivée au serveur : au retour, « non traité », pas de « Résultat retrouvé », billet intact

    Error: renvoi au retour : indicateur replayOnly dans le corps (3 envois coupés avant)

    expect(received).toBe(expected) // Object.is equality

    Expected: true
    Received: undefined
```

```text
  ✓  12 [terrain] › e2e/terrain.spec.ts:853:5 › 11. lecture jamais arrivée au serveur : au retour, « non traité », pas de « Résultat retrouvé », billet intact (2.9s)
```

**Correctif.** Serveur (M5, route, union `ScanResult`), puis client :

```text
$ git show --numstat 9212ccac
9212ccac fix(8.2e-s): mode renvoi seulement du scan, côté serveur. M5 recopie ticket_scan avec replay_only dans p : clé absente refusée avant toute écriture, aucune ligne forbidden en renvoi (L43), li …
  +   39 -    7  app/api/controller/scan/route.ts
  +    5 -    1  lib/scan/scan-result.ts
  +  224 -    0  supabase/migrations/20261106000005_lot8_scan.sql
$ git show --numstat 4cc99599
4cc99599 fix(8.2e-c): un scan repris au retour dans l'application n'envoie plus que { eventId, replayOnly: true } avec sa clé d'origine, relances comprises, et ne peut plus composter un billet dont le …
  +   15 -    9  app/controller/scanner/page.tsx
  +   13 -    8  app/partner/scan/page.tsx
  +    7 -    5  components/scan/CombatFlashOverlay.tsx
  +    4 -    2  components/scan/ScanResultPanel.tsx
  +   18 -    2  components/scan/scan-client.ts
  (+ 2 trace(s) docs/lot8-logs/ non listée(s))
```

### 8.2 f — Écart de caisse rendu au refus de clôture

**Origine.** `discovery-8-scan-messages.md`, section f : le chemin courant (`lib/shifts/shift.service.ts:400-401`) refuse sans détails ; l'écran lit `data.discrepancy` (`ShiftModals.tsx:205-207`) et retombe sur un texte sans chiffre. « 100 % des clôtures avec écart sont concernées. » La capture du lot 7 masquait le défaut : son stub fournissait `discrepancy: -2000`.

```text
# run 95 (db21d1c, « avant ») — tests/parcours/dette-cloture-caisse.test.ts
not ok 3 - garde-fou : écart sans justification, ou justification de moins de 10 caractères → 400 JUSTIFICATION_REQUIRED, caisse OUVERT
      error: sans justification : expected = total attendu : HTTP 400 {"error":"Un écart de caisse doit être justifié (10 caractères au moins).","code":"JUSTIFICATION_REQUIRED"}
        undefined !== 0
not ok 4 - garde-fou : écart justifié avec un PIN faux → 401 PIN_INVALID ; sans PIN → 400 PIN_REQUIRED ; caisse OUVERT
      error: écart sans PIN : expected = total attendu : HTTP 400 {"error":"Le code PIN régisseur est obligatoire pour co-signer une clôture avec écart.","code":"PIN_REQUIRED"}
        undefined !== 0
not ok 5 - écart négatif (espèces manquantes) : JUSTIFICATION_REQUIRED puis PIN_REQUIRED portent expected, declared et discrepancy = −1000 ; caisse OUVERT
      error: écart négatif sans justification : expected = total attendu : HTTP 400 {"error":"Un écart de caisse doit être justifié (10 caractères au moins).","code":"JUSTIFICATION_REQUIRED"}
# tests 14
# pass 11
# fail 3
# cancelled 0
# run 107 (bc864fa, « après », code final) — tests/parcours/dette-cloture-caisse.test.ts
ok 3 - garde-fou : écart sans justification, ou justification de moins de 10 caractères → 400 JUSTIFICATION_REQUIRED, caisse OUVERT
ok 4 - garde-fou : écart justifié avec un PIN faux → 401 PIN_INVALID ; sans PIN → 400 PIN_REQUIRED ; caisse OUVERT
ok 5 - écart négatif (espèces manquantes) : JUSTIFICATION_REQUIRED puis PIN_REQUIRED portent expected, declared et discrepancy = −1000 ; caisse OUVERT
# … 11 autre(s) sous-test(s) réussi(s)
# tests 14
# pass 14
# fail 0
# cancelled 0
```

Terrain 12 (sans réponse imposée), run 95 puis run 107 :

```text
  5) [terrain] › e2e/terrain.spec.ts:934:5 › 12. clôture de caisse avec écart, sans réponse imposée : refus 400, écart du serveur affiché, puis clôture juste

    Error: écart renvoyé par le serveur (contrat 3.6)

    expect(received).toBe(expected) // Object.is equality

    Expected: 1000
    Received: undefined
```

```text
  ✓  13 [terrain] › e2e/terrain.spec.ts:924:5 › 12. clôture de caisse avec écart, sans réponse imposée : refus 400, écart du serveur affiché, puis clôture juste (2.6s)
```

**Correctif.**

```text
$ git show --numstat 7f003055
7f003055 fix(8.2f): la clôture refusée pour JUSTIFICATION_REQUIRED ou PIN_REQUIRED rend l'écart à l'écran. closeShift calcule expected, declared et discrepancy = déclaré − attendu (signe de la RPC) et …
  +    7 -    3  lib/shifts/shift.service.ts
```

### 8.2 g — Diagnostic de `temps-reel-billets`

**Origine.** `discovery-8-scan-messages.md`, section g : états du canal, horodatages et journal filtré existaient déjà (`tests/helpers/realtime.ts`, commit 8b26b86) ; seul le statut du conteneur realtime manquait, et le rejet de `collector.ready` n'avait pas de trace.

```text
# run 95 (db21d1c, « avant ») — tests/parcours/realtime-diagnostic.test.ts
not ok 1 - Docker absent : une ligne « conteneur realtime : indisponible (raison) », jamais d’exception
      error: tests/helpers/realtime.ts : realtimeDiagnostics() non exportée (contrat 7.3)
not ok 2 - Docker présent : statut, démarrage et redémarrages lus par docker inspect sur le conteneur de l’instance
      error: tests/helpers/realtime.ts : realtimeDiagnostics() non exportée (contrat 7.3)
not ok 3 - docker en échec (code de sortie non nul) : « indisponible (raison) », jamais d’exception
      error: tests/helpers/realtime.ts : realtimeDiagnostics() non exportée (contrat 7.3)
not ok 4 - source : docker inspect avec un délai de 3 s, sans passer par un shell
      error: "tests/helpers/realtime.ts : execFileSync('docker', ['inspect', …])"
# … 3 autre(s) sous-test(s) en échec retenu(s)
# tests 8
# pass 1
# fail 7
# cancelled 0
# run 107 (bc864fa, « après », code final) — tests/parcours/realtime-diagnostic.test.ts
ok 1 - Docker absent : une ligne « conteneur realtime : indisponible (raison) », jamais d’exception
ok 2 - Docker présent : statut, démarrage et redémarrages lus par docker inspect sur le conteneur de l’instance
ok 3 - docker en échec (code de sortie non nul) : « indisponible (raison) », jamais d’exception
ok 4 - source : docker inspect avec un délai de 3 s, sans passer par un shell
ok 1 - waitForEvent : états du canal, instant de l’échec et conteneur realtime
ok 2 - produceUntilReceived : états du canal, instant de l’échec et conteneur realtime
# … 2 autre(s) sous-test(s) réussi(s)
# tests 8
# pass 8
# fail 0
# cancelled 0
```

**Correctif.** Dans l'aide de test seulement, délais inchangés :

```text
$ git show --numstat f2b2c8b6
f2b2c8b6 fix(8.2g): temps-reel-billets, un échec Realtime dit enfin si le conteneur tournait (contrat 7.3, L48, T32). tests/helpers/realtime.ts : realtimeDiagnostics() lit statut, démarrage et redémar …
  +   26 -    4  tests/helpers/realtime.ts
```

`temps-reel-billets` n'a échoué dans aucun run complet du lot (95 à 98, 104 à 107 ; les runs 99 à 103 ne jouaient pas `verify`) : le diagnostic n'a donc jamais servi en situation réelle.

### 8.2 h — Vrai 404 d'un événement non public

**Origine.** `discovery-8-scan-messages.md`, section h : `app/events/[id]/page.tsx` est `'use client'` ; l'état `not-found` rend `EventNotFound` en HTTP 200. Patron déjà prouvé : `app/orders/` (layout serveur), capture `page-masquee-commandes` à 404 au run 91.

```text
# run 95 (db21d1c, « avant ») — tests/parcours/evenement-404.test.ts
not ok 1 - le layout est un composant serveur, force-dynamic, qui appelle notFound()
      error: 'app/events/[id]/layout.tsx absent'
not ok 2 - la route partage PUBLIC_EVENT_STATUSES : un seul exemplaire
      error: "app/api/events/[id]/route.ts n'importe pas PUBLIC_EVENT_STATUSES"
not ok 3 - PUBLIC_EVENT_STATUSES : exactement les statuts publics
      error: 'lib/events/public-status.ts absent (fix(8.2h))'
not ok 2 - BROUILLON : NOT_PUBLIC, notFound() au layout, 404 à l'API
      error: 'lib/events/public-status.ts absent (fix(8.2h))'
# … 13 autre(s) sous-test(s) en échec retenu(s)
# crochet en échec :
not ok 3 - /home/runner/work/event-village/event-village/tests/parcours/evenement-404.test.ts
  schéma du lot 8 incomplet (evenement-404) : invariants (r)(s)(t) impossibles à vérifier :
  colonne public.ticket_categories.sale_online absente — canaux de vente (contrat 2.4, migration 20261106000001)
  colonne public.ticket_categories.sale_counter absente — canaux de vente (contrat 2.4, migration 20261106000001)
# tests 19
# pass 2
# fail 17
# cancelled 0
# run 107 (bc864fa, « après », code final) — tests/parcours/evenement-404.test.ts
ok 1 - le layout est un composant serveur, force-dynamic, qui appelle notFound()
ok 2 - la route partage PUBLIC_EVENT_STATUSES : un seul exemplaire
ok 3 - PUBLIC_EVENT_STATUSES : exactement les statuts publics
ok 2 - BROUILLON : NOT_PUBLIC, notFound() au layout, 404 à l'API
ok 3 - EN_ATTENTE : NOT_PUBLIC, notFound() au layout, 404 à l'API
ok 4 - VALIDE : NOT_PUBLIC, notFound() au layout, 404 à l'API
# … 13 autre(s) sous-test(s) réussi(s)
[INVARIANT-RECETTE] evenement-404 — (r)(s)(t) : 0 violation(s)
# tests 19
# pass 19
# fail 0
# cancelled 0
```

Captures, run 95 puis run 107 :

```text
  2) [mobile] › e2e/captures.spec.ts:159:9 › clair · anonyme › evenement-introuvable — URL d’un événement inconnu : vrai 404, page introuvable propre

    Error: statut HTTP du document /events/00000000-0000-4000-8000-000000000404

    expect(received).toBe(expected) // Object.is equality

    Expected: 404
    Received: 200
```

```text
  ✓    8 [mobile] › e2e/captures.spec.ts:159:9 › clair · anonyme › evenement-introuvable — URL d’un événement inconnu : vrai 404, page introuvable propre (1.6s)
  ✓    9 [mobile] › e2e/captures.spec.ts:159:9 › clair · anonyme › evenement-identifiant-invalide — URL d’un identifiant qui n’est pas un UUID : vrai 404 (1.6s)
  -  100 [mobile] › e2e/captures.spec.ts:159:9 › sombre · anonyme › evenement-identifiant-invalide — URL d’un identifiant qui n’est pas un UUID : vrai 404
  ✓   99 [mobile] › e2e/captures.spec.ts:159:9 › sombre · anonyme › evenement-introuvable — URL d’un événement inconnu : vrai 404, page introuvable propre (1.8s)
  -  191 [desktop] › e2e/captures.spec.ts:159:9 › clair · anonyme › evenement-identifiant-invalide — URL d’un identifiant qui n’est pas un UUID : vrai 404
  ✓  190 [desktop] › e2e/captures.spec.ts:159:9 › clair · anonyme › evenement-introuvable — URL d’un événement inconnu : vrai 404, page introuvable propre (1.8s)
  -  282 [desktop] › e2e/captures.spec.ts:159:9 › sombre · anonyme › evenement-identifiant-invalide — URL d’un identifiant qui n’est pas un UUID : vrai 404
  ✓  281 [desktop] › e2e/captures.spec.ts:159:9 › sombre · anonyme › evenement-introuvable — URL d’un événement inconnu : vrai 404, page introuvable propre (1.7s)
```

Les lignes marquées « - » sont des vues que la spec saute ; les mêmes vues étaient sautées au run 95.

**Correctif.** Layout serveur `force-dynamic`, statuts publics partagés avec la route :

```text
$ git show --numstat 3cbb135f
3cbb135f fix(8.2h): un événement non public répond un vrai 404 HTTP. Layout serveur app/events/[id]/layout.tsx, force-dynamic : identifiant non UUID, ligne absente ou statut non public donnent notFoun …
  +    5 -    8  app/api/events/[id]/route.ts
  +   17 -    0  app/events/[id]/layout.tsx
  +   40 -    0  lib/events/public-status.ts
```

### 8.2 i — Aucun message brut de la base au navigateur

**Origine.** `discovery-8-scan-messages.md`, section i, prototype AST (`d8i/scan.cjs`) sur `app/api/**` et `lib/**` : **65 puits, 2 faux positifs, 1 légitime, 62 à corriger.** Aucun `.details` ni `.hint` n'atteint une réponse. Piège : la plupart des `error instanceof Error ? error.message : …` portent aussi des messages français voulus ; d'où une liste blanche `PublicError`, pas un remplacement aveugle (AR10).

Contrôle statique, avec auto-contrôle :

```text
# run 95 (db21d1c, « avant ») — tests/schema/messages-bruts.test.ts
not ok 1 - règles 1 et 2 : aucune source n'atteint une réponse (app/api, lib)
      error: 62 message(s) brut(s) renvoyé(s) au navigateur :
        app/api/admin/audit/route.ts:45 [règle 1] NextResponse.json reçoit error.message
not ok 3 - règle 4 : les écrans du lot I6 n'affichent pas err.message filtré par Error (LoginForm, mot de passe, global-error)
      error: texte brut à l'écran (Supabase Auth en anglais, « Failed to fetch ») :
        components/auth/LoginForm.tsx:343 [règle 4] recordFailedAttempt reçoit msg ← err.message
not ok 1 - PublicError étend Error et garde son message
      error: "lib/api/public-error.ts absent ou illisible (fix(8.2i-1)) : Cannot find module '/home/runner/work/event-village/event-village/lib/api/public-error' imported from /home/runner/work/event-village/event-village/tests/schema/messages-bruts.test.ts"
not ok 2 - PublicError : message, code et statut de l'erreur
      error: "lib/api/public-error.ts absent ou illisible (fix(8.2i-1)) : Cannot find module '/home/runner/work/event-village/event-village/lib/api/public-error' imported from /home/runner/work/event-village/event-village/tests/schema/messages-bruts.test.ts"
# … 7 autre(s) sous-test(s) en échec retenu(s)
# tests 62
# pass 51
# fail 11
# cancelled 0
# run 107 (bc864fa, « après », code final) — tests/schema/messages-bruts.test.ts
ok 1 - règles 1 et 2 : aucune source n'atteint une réponse (app/api, lib)
ok 3 - règle 4 : les écrans du lot I6 n'affichent pas err.message filtré par Error (LoginForm, mot de passe, global-error)
ok 1 - PublicError étend Error et garde son message
ok 2 - PublicError : message, code et statut de l'erreur
ok 3 - PublicError sans code ni statut : code du repli, 400 par défaut
ok 4 - PublicError sans statut : statut du repli s'il en donne un
# … 56 autre(s) sous-test(s) réussi(s)
# tests 62
# pass 62
# fail 0
# cancelled 0
```

Routes témoins sous panne simulée :

```text
# run 95 (db21d1c, « avant ») — tests/parcours/messages-bruts.test.ts  [sous-tests retenus : /8\.2 i/]
not ok 1 - admin/communications : 500, CAMPAIGNS_UNAVAILABLE, message français
      error: 'admin/communications : texte de la base renvoyé au navigateur : {"error":"relation \\"x\\" SENTINELLE_SECRETE"}'
not ok 2 - admin/promotions : 500, PROMOTIONS_UNAVAILABLE, message français
      error: 'admin/promotions : texte de la base renvoyé au navigateur : {"error":"relation \\"x\\" SENTINELLE_SECRETE"}'
not ok 3 - partner/events/[id] : statut 404 conservé (section 9), code stable, message français
      error: partner/events/[id] : code stable absent : {"error":"Événement introuvable ou non autorisé."}
not ok 4 - partner/halls : 500, code *_UNAVAILABLE, message français
      error: 'partner/halls : texte de la base renvoyé au navigateur : {"error":"Erreur récupération salles: relation \\"x\\" SENTINELLE_SECRETE"}'
# tests 14
# pass 6
# fail 8
# cancelled 0
# run 107 (bc864fa, « après », code final) — tests/parcours/messages-bruts.test.ts  [sous-tests retenus : /8\.2 i/]
ok 1 - admin/communications : 500, CAMPAIGNS_UNAVAILABLE, message français
ok 2 - admin/promotions : 500, PROMOTIONS_UNAVAILABLE, message français
ok 3 - partner/events/[id] : statut 404 conservé (section 9), code stable, message français
ok 4 - partner/halls : 500, code *_UNAVAILABLE, message français
# … 4 autre(s) sous-test(s) réussi(s) dans ce filtre
[INVARIANT-RECETTE] messages-bruts — (r)(s)(t) : 0 violation(s)
# tests 14
# pass 14
# fail 0
# cancelled 0
```

**Correctif.** Socle, puis cinq lots de routes, puis les écrans d'authentification :

```text
$ git show --numstat 44ccf4f8
44ccf4f8 fix(8.2i-1): socle des messages publics, liste blanche par classe (contrat 3.8, L51). lib/api/public-error.ts : PublicError et apiFailure, tout ce qui n'est pas PublicError part au journal et …
  +    5 -    4  lib/admin/admin.service.ts
  +   56 -    0  lib/api/public-error.ts
  +    3 -    2  lib/events/event.service.ts
  +   14 -   13  lib/halls/hall.service.ts
  +    9 -    8  lib/orders/order.service.ts
  +   14 -   13  lib/payments/payment.service.ts
  +    3 -    2  lib/products/product.service.ts
  +   15 -    4  lib/tables/table.service.ts
$ git show --numstat 57eb9b15
57eb9b15 fix(8.2i-2): routes admin, le texte de la base ne part plus au navigateur (contrat 9, 23 puits). audit, communications, finance/reconciliation, metrics, partners, permissions, pricing, promot …
  +    5 -    5  app/api/admin/audit/route.ts
  +    2 -    1  app/api/admin/communications/route.ts
  +    2 -    3  app/api/admin/finance/reconciliation/route.ts
  +    2 -    3  app/api/admin/metrics/route.ts
  +    5 -    7  app/api/admin/partners/route.ts
  +    3 -    3  app/api/admin/permissions/route.ts
  +    6 -    6  app/api/admin/pricing/route.ts
  +    4 -    1  app/api/admin/promotions/route.ts
  +    2 -    2  app/api/admin/services/route.ts
  +    2 -    3  app/api/admin/users/[id]/anonymize/route.ts
  +   22 -   24  app/api/admin/users/route.ts
$ git show --numstat 7a074fbe
7a074fbe fix(8.2i-3): routes d'authentification, parrainage, paiement et inscription partenaire (contrat 9, 8 puits). resolve-phone, send-otp, sign-out-global, verify-otp, my-stats et register réponde …
  +    2 -    2  app/api/auth/resolve-phone/route.ts
  +    2 -    3  app/api/auth/send-otp/route.ts
  +    2 -    2  app/api/auth/sign-out-global/route.ts
  +    2 -    3  app/api/auth/verify-otp/route.ts
  +    5 -    6  app/api/partner/register/route.ts
  +    3 -    4  app/api/payments/create/route.ts
  +    2 -    2  app/api/referrals/my-stats/route.ts
$ git show --numstat c7df4f0e
c7df4f0e fix(8.2i-4): routes de finance, d'indicateurs, de rapports et d'événement du partenaire, le texte de la base ne part plus au navigateur (contrat 9, 8 puits). finance, metrics, stats, reports/ …
  +    5 -   10  app/api/partner/events/[id]/route.ts
  +    2 -    3  app/api/partner/finance/route.ts
  +    2 -    3  app/api/partner/metrics/route.ts
  +    2 -    2  app/api/partner/reports/accounting/route.ts
  +    2 -    2  app/api/partner/reports/closing/pdf/route.ts
  +    2 -    2  app/api/partner/reports/closing/route.ts
  +    2 -    3  app/api/partner/stats/route.ts
$ git show --numstat db8c2c19
db8c2c19 fix(8.2i-5): routes salles, commandes, produits et tables du partenaire, plus aucun texte de la base au navigateur (contrat 9, 23 puits). Les 12 fichiers répondent par apiFailure avec statut  …
  +    4 -   12  app/api/partner/halls/[id]/route.ts
  +    2 -    4  app/api/partner/halls/reservations/[id]/status/route.ts
  +    3 -    8  app/api/partner/halls/route.ts
  +    3 -    8  app/api/partner/orders/[id]/route.ts
  +    2 -    4  app/api/partner/orders/route.ts
  +    4 -   12  app/api/partner/products/[id]/route.ts
  +    2 -    4  app/api/partner/products/[id]/status/route.ts
  +    3 -    8  app/api/partner/products/route.ts
  +    3 -    8  app/api/partner/tables/[id]/route.ts
  +    3 -    8  app/api/partner/tables/reservations/[id]/route.ts
  +    3 -    8  app/api/partner/tables/reservations/route.ts
  +    3 -    8  app/api/partner/tables/route.ts
$ git show --numstat b72003f3
b72003f3 fix(8.2i-6): plus aucun texte anglais de Supabase Auth ni « Failed to fetch » à l'écran : LoginForm et /reset-password décident sur error.code et ses messages français (compte banni, trop de  …
  +    6 -    5  app/forgot-password/page.tsx
  +   13 -    3  app/global-error.tsx
  +   24 -    3  app/reset-password/page.tsx
  +   35 -   11  components/auth/LoginForm.tsx
  (+ 2 trace(s) docs/lot8-logs/ non listée(s))
```

Deux puits ont été trouvés après ce chantier et corrigés comme anomalies : A35 (`send-otp`) et A36 (remboursement d'un billet utilisé), en 8.3 d.

### 8.2 j — Messages des redirections du middleware

**Origine.** `discovery-8-scan-messages.md`, sections 0 et j : six redirections, dont quatre vers `/?error=…` ; `app/page.tsx` ne lit aucun paramètre, l'accueil est muet. `/login?error=unauthorized_controller` n'est jamais affiché à un connecté, et c'est une **boucle** pour un CONTROLEUR non ACTIF à la session valide (`middleware.ts:235-236` puis `:196-198`).

```text
# run 95 (db21d1c, « avant ») — tests/parcours/acces-messages.test.ts
not ok 1 - unauthorized_admin → « Cet espace est réservé aux administrateurs. »
      error: 'lib/auth/access-errors.ts absent'
not ok 2 - unauthorized_partner → « Cet espace est réservé aux partenaires. »
      error: 'lib/auth/access-errors.ts absent'
not ok 3 - unauthorized_scanner → « Le contrôle des billets est réservé aux contrôleurs et aux organisateurs. »
      error: 'lib/auth/access-errors.ts absent'
not ok 4 - unauthorized_controller → « Cet espace est réservé aux contrôleurs dont le compte est actif. »
      error: 'lib/auth/access-errors.ts absent'
# … 21 autre(s) sous-test(s) en échec retenu(s)
# tests 25
# pass 0
# fail 25
# cancelled 0
# run 107 (bc864fa, « après », code final) — tests/parcours/acces-messages.test.ts
ok 1 - unauthorized_admin → « Cet espace est réservé aux administrateurs. »
ok 2 - unauthorized_partner → « Cet espace est réservé aux partenaires. »
ok 3 - unauthorized_scanner → « Le contrôle des billets est réservé aux contrôleurs et aux organisateurs. »
ok 4 - unauthorized_controller → « Cet espace est réservé aux contrôleurs dont le compte est actif. »
ok 5 - roles_unavailable → « Vérification de vos droits impossible pour le moment. Réessayez dans un instant. »
ok 6 - toute clé émise par middleware.ts est dans la table
# … 19 autre(s) sous-test(s) réussi(s)
# tests 25
# pass 25
# fail 0
# cancelled 0
```

`r6-roles-jeton` (T19, test existant adapté à la nouvelle cible) :

```text
# run 95 (db21d1c, « avant ») — tests/security/r6-roles-jeton.test.ts
not ok 1 - CONTROLEUR SUSPENDU, session valide : au plus 3 sauts, atterrit sur /?error=unauthorized_controller
      error: parcours : /controller/scanner → /login?error=unauthorized_controller → /controller/scanner → /login?error=unauthorized_controller → /controller/scanner
not ok 3 - lecture du statut impossible : /?error=roles_unavailable, atterrissage sans boucle
      error: parcours : /controller/scanner → /login?error=unauthorized_controller → /controller/scanner → /login?error=unauthorized_controller → /controller/scanner
not ok 1 - signUp avec data.roles = [SUPERADMIN] → /admin, /partner, /scan et /controller/scanner redirigent
      error: inscription avec roles forgés : accès accordé alors qu'il doit être redirigé :
        /controller/scanner → HTTP 307 vers http://localhost:3000/login?error=unauthorized_controller
not ok 2 - compte CLIENT qui fait updateUser({ data: { roles: [SUPERADMIN] } }) → idem
      error: métadonnées modifiées par updateUser : accès accordé alors qu'il doit être redirigé :
        /controller/scanner → HTTP 307 vers http://localhost:3000/login?error=unauthorized_controller
# tests 8
# pass 4
# fail 4
# cancelled 0
# run 107 (bc864fa, « après », code final) — tests/security/r6-roles-jeton.test.ts
ok 1 - CONTROLEUR SUSPENDU, session valide : au plus 3 sauts, atterrit sur /?error=unauthorized_controller
ok 3 - lecture du statut impossible : /?error=roles_unavailable, atterrissage sans boucle
ok 1 - signUp avec data.roles = [SUPERADMIN] → /admin, /partner, /scan et /controller/scanner redirigent
ok 2 - compte CLIENT qui fait updateUser({ data: { roles: [SUPERADMIN] } }) → idem
# … 4 autre(s) sous-test(s) réussi(s)
# tests 8
# pass 8
# fail 0
# cancelled 0
```

**Correctif.** Middleware et table fermée des messages, puis l'accueil :

```text
$ git show --numstat b75d6c77
b75d6c77 fix(8.2j-s): redirections du middleware. Un connecté n'est plus jamais renvoyé vers /login?error=, qui le renvoyait vers son espace : boucle pour un CONTROLEUR SUSPENDU à la session valide (L …
  +   18 -    0  lib/auth/access-errors.ts
  +    3 -    2  middleware.ts
$ git show --numstat 161697ff
161697ff fix(8.2j-e): l'accueil dit enfin pourquoi un espace a été refusé : AccessNotice lit ?error= par useSearchParams, sous <Suspense fallback={null}> dans app/page.tsx, et affiche un StatusBanner  …
  +    7 -    1  app/page.tsx
  +   17 -    0  components/layout/AccessNotice.tsx
  (+ 3 trace(s) docs/lot8-logs/ non listée(s))
```

### 8.2 k — `GET /api/controller/profile` ne masque plus une panne

**Origine.** `discovery-8-scan-messages.md`, section k : `app/api/controller/profile/route.ts:34-43` lit `event_controllers` sans regarder `error` ; une panne donne `assignments: []` et `success: true`. `:30` confond erreur de lecture et profil absent (404).

```text
# run 95 (db21d1c, « avant ») — tests/parcours/messages-bruts.test.ts  [sous-tests retenus : /8\.2 k|L56/]
not ok 1 - panne de event_controllers : 500 ASSIGNMENTS_UNAVAILABLE, pas de assignments: [], journal
      error: panne présentée comme un succès : {"success":true,"profile":{"id":"9e7a5e27-f27f-498c-9653-227e57a60f61","first_name":"Ibrahima","last_name":"Controleur","phone":"+221775607034","role":"CONTROLEUR","status":"ACTIF","created_at":"2026-11-06T19:13:27.76836+00:00 …
        200 !== 500
not ok 2 - panne de lecture du profil : 500 PROFILE_UNAVAILABLE, pas 404
      error: panne présentée comme un profil absent : {"error":"Profil introuvable."}
        404 !== 500
not ok 1 - panne de lecture du numéro : 500, pas « Profil introuvable. »
      error: panne présentée comme un profil absent : {"error":"Profil introuvable."}
        404 !== 500
not ok 2 - panne de auth.admin.getUserById : 500 sans texte brut, et journalisée
      error: 'erreur de lecture ignorée : aucun journal'
# tests 14
# pass 6
# fail 8
# cancelled 0
# run 107 (bc864fa, « après », code final) — tests/parcours/messages-bruts.test.ts  [sous-tests retenus : /8\.2 k|L56/]
ok 1 - panne de event_controllers : 500 ASSIGNMENTS_UNAVAILABLE, pas de assignments: [], journal
ok 2 - panne de lecture du profil : 500 PROFILE_UNAVAILABLE, pas 404
ok 1 - panne de lecture du numéro : 500, pas « Profil introuvable. »
ok 2 - panne de auth.admin.getUserById : 500 sans texte brut, et journalisée
# … 2 autre(s) sous-test(s) réussi(s) dans ce filtre
[INVARIANT-RECETTE] messages-bruts — (r)(s)(t) : 0 violation(s)
# tests 14
# pass 14
# fail 0
# cancelled 0
```

**Correctif.** Le PATCH (L56) est traité en plus, signalé comme hors consigne :

```text
$ git show --numstat 958e70e9
958e70e9 fix(8.2k): une panne de lecture du profil contrôleur n'est plus présentée comme une liste vide ni comme un profil absent (contrat 3.9). GET /api/controller/profile : panne des affectations 50 …
  +   24 -    4  app/api/controller/profile/route.ts
```

### 8.2 l — `PATCH /api/partner/profile` en une seule RPC

**Origine.** `discovery-8-scan-messages.md`, section l : `app/api/partner/profile/route.ts:192-212` fait un `update` de `partners`, puis un `upsert` et un `delete` de `partner_activities`, trois écritures hors transaction.

```text
# run 95 (db21d1c, « avant ») — tests/parcours/partenaire-profil-rpc.test.ts
not ok 1 - retrait des activités en échec : 500 PROFILE_SAVE_FAILED, nom et activités inchangés
      error: la fiche a été écrite alors que l'enregistrement a échoué
not ok 2 - company_name : écrite seule, les autres inchangées, updated_at avancé
      error: company_name : écritures directes de la route, hors transaction
not ok 3 - commercial_name : écrite seule, les autres inchangées, updated_at avancé
      error: commercial_name : écritures directes de la route, hors transaction
not ok 4 - description : écrite seule, les autres inchangées, updated_at avancé
      error: description : écritures directes de la route, hors transaction
# … 33 autre(s) sous-test(s) en échec retenu(s)
# crochet en échec :
not ok 6 - /home/runner/work/event-village/event-village/tests/parcours/partenaire-profil-rpc.test.ts
  schéma du lot 8 incomplet (partenaire-profil-rpc) : invariants (r)(s)(t) impossibles à vérifier :
  colonne public.ticket_categories.sale_online absente — canaux de vente (contrat 2.4, migration 20261106000001)
  colonne public.ticket_categories.sale_counter absente — canaux de vente (contrat 2.4, migration 20261106000001)
# tests 38
# pass 1
# fail 37
# cancelled 0
# run 107 (bc864fa, « après », code final) — tests/parcours/partenaire-profil-rpc.test.ts
ok 1 - retrait des activités en échec : 500 PROFILE_SAVE_FAILED, nom et activités inchangés
ok 2 - company_name : écrite seule, les autres inchangées, updated_at avancé
ok 3 - commercial_name : écrite seule, les autres inchangées, updated_at avancé
ok 4 - description : écrite seule, les autres inchangées, updated_at avancé
ok 5 - address : écrite seule, les autres inchangées, updated_at avancé
ok 6 - city : écrite seule, les autres inchangées, updated_at avancé
# … 32 autre(s) sous-test(s) réussi(s)
[INVARIANT-RECETTE] partenaire-profil-rpc — (r)(s)(t) : 0 violation(s)
# tests 38
# pass 38
# fail 0
# cancelled 0
```

**Correctif.** M6 crée `partner_profile_update(p jsonb)`. Au run 96, deux cas restaient rouges : la suite lisait les activités par `.order('activity_type')`, qui suit l'ordre de l'enum. Le test compare désormais les activités triées (test du lot corrigé, signalé).

```text
$ git show --numstat 322ff970
322ff970 fix(8.2l): PATCH /api/partner/profile écrit la fiche et les activités en une seule transaction. M6 crée partner_profile_update(p jsonb) : fiche verrouillée sur (id, user_id), colonne écrite s …
  +   23 -   24  app/api/partner/profile/route.ts
  +   79 -    0  supabase/migrations/20261106000006_lot8_profil.sql
$ git show --numstat 5586bf12
5586bf12 test(8.2l): partenaire-profil-rpc compare les activités triées (test du lot corrigé, signalé au rapport). Sa lecture par .order('activity_type') suit l'ordre de l'enum, où SALLE précède ORGAN …
  +    2 -    2  tests/parcours/partenaire-profil-rpc.test.ts
```

### 8.2 m — Lien de `PAYMENT_SUCCESS` d'un abonnement

**Origine.** `discovery-8-scan-messages.md`, section m : `lib/notifications/catalog.ts:880-885` donne `link: () => '/orders'` ; le déclencheur `notif_payments_other_success` ne transmet que `payment_id` et `amount` (`20261103000006_lot6_pros_admin.sql:957-978`). Il fallait une migration (`payment_target`) et une lecture tolérante des lignes déjà en file.

```text
# run 95 (db21d1c, « avant ») — tests/parcours/notif-abonnement.test.ts
not ok 1 - abonnement payé et confirmé : une notification dont le lien mène à /partner/subscription
      error: notification de l’abonnement : lien vers la page d’abonnement, jamais /orders
# crochet en échec :
not ok 2 - /home/runner/work/event-village/event-village/tests/parcours/notif-abonnement.test.ts
  schéma du lot 8 incomplet (notif-abonnement) : invariants (r)(s)(t) impossibles à vérifier :
  colonne public.ticket_categories.sale_online absente — canaux de vente (contrat 2.4, migration 20261106000001)
  colonne public.ticket_categories.sale_counter absente — canaux de vente (contrat 2.4, migration 20261106000001)
# tests 2
# pass 1
# fail 1
# cancelled 0
# run 107 (bc864fa, « après », code final) — tests/parcours/notif-abonnement.test.ts
ok 1 - abonnement payé et confirmé : une notification dont le lien mène à /partner/subscription
# … 1 autre(s) sous-test(s) réussi(s)
[INVARIANT-RECETTE] notif-abonnement — (r)(s)(t) : 0 violation(s)
# tests 2
# pass 2
# fail 0
# cancelled 0
```

`notif-modeles` (T7, test existant adapté). Au run 95, ses rouges viennent aussi de 8.2 a (type `ADMIN_DUPLICATE_PAYMENT` absent du catalogue) :

```text
# run 95 (db21d1c, « avant ») — tests/parcours/notif-modeles.test.ts
not ok 1 - NOTIFICATION_CATALOG contient exactement les types de G2, chacun avec ses attributs
      error: types du catalogue = types de G2
not ok 3 - chaque type rend chaque canal qu'il déclare (sample), sans variable manquante ni valeur JS affichée
      error: 'type ADMIN_DUPLICATE_PAYMENT absent de NOTIFICATION_CATALOG'
not ok 5 - liens : chemin interne de G2 (« / », jamais « // » ni schéma), avec l'identifiant du sample
      error: 'type ADMIN_DUPLICATE_PAYMENT absent de NOTIFICATION_CATALOG'
not ok 6 - PAYMENT_SUCCESS : lien selon la cible, un abonnement mène à /partner/subscription (8.2 m, contrat 10.1)
      error: lien du catalogue pour payment_target = SUBSCRIPTION
# … 3 autre(s) sous-test(s) en échec retenu(s)
# tests 21
# pass 14
# fail 7
# cancelled 0
# run 107 (bc864fa, « après », code final) — tests/parcours/notif-modeles.test.ts
ok 1 - NOTIFICATION_CATALOG contient exactement les types de G2, chacun avec ses attributs
ok 3 - chaque type rend chaque canal qu'il déclare (sample), sans variable manquante ni valeur JS affichée
ok 6 - liens : chemin interne de G2 (« / », jamais « // » ni schéma), avec l'identifiant du sample
ok 7 - PAYMENT_SUCCESS : lien selon la cible, un abonnement mène à /partner/subscription (8.2 m, contrat 10.1)
ok 1 - titres in-app exacts (G4) ; variables in-app non tronquées (titre complet de l'événement)
ok 3 - push : titre = titre in-app, corps = contenu in-app (tronqué à 160 caractères au plus)
# … 16 autre(s) sous-test(s) réussi(s)
# tests 22
# pass 22
# fail 0
# cancelled 0
```

**Correctif.**

```text
$ git show --numstat 48f2e442
48f2e442 fix(8.2m): la notification PAYMENT_SUCCESS d'un abonnement mène à /partner/subscription au lieu de /orders (L57). M3 ajoute payment_target aux données de notif_payments_other_success, le cata …
  +    1 -    1  lib/notifications/catalog-types.ts
  +    1 -    1  lib/notifications/catalog.ts
  +   30 -    1  supabase/migrations/20261106000003_lot8_paiement.sql
```

### 8.2 n — Alertes `SMS_OPTIONAL_80` et `SMS_FORECAST` en direct

**Origine.** `discovery-8-scan-messages.md`, section n : filtre `app/admin/notifications/page.tsx:332`, `kind=in.(NOTIFICATION_FAILED,SMS_DAILY_THRESHOLD)`, figé par `notif-interface.test.ts:957-961`.

```text
# run 95 (db21d1c, « avant ») — tests/parcours/notif-interface.test.ts
not ok 2 - abonnements à admin_signals filtrés par kind : tableau de bord et file des événements kind=in.(EVENT_SUBMITTED,PARTNER_REGISTERED), page Notifications kind=in.(NOTIFICATION_FAILED,SMS_DAILY_THRESHOLD,SMS_OPTIONAL_80,SMS_FORECAST)
      error: app/admin/notifications/page.tsx:332 : filtre « kind=in.(NOTIFICATION_FAILED,SMS_DAILY_THRESHOLD) » (attendu kind=in.(NOTIFICATION_FAILED,SMS_DAILY_THRESHOLD,SMS_OPTIONAL_80,SMS_FORECAST))
# tests 38
# pass 37
# fail 1
# cancelled 0
# run 107 (bc864fa, « après », code final) — tests/parcours/notif-interface.test.ts
ok 2 - abonnements à admin_signals filtrés par kind : tableau de bord et file des événements kind=in.(EVENT_SUBMITTED,PARTNER_REGISTERED), page Notifications kind=in.(NOTIFICATION_FAILED,SMS_DAILY_THRESHOLD,SMS_OPTIONAL_80,SMS_FORECAST)
# … 37 autre(s) sous-test(s) réussi(s)
# tests 38
# pass 38
# fail 0
# cancelled 0
```

```text
# run 95 (db21d1c, « avant ») — tests/parcours/temps-reel-prives.test.ts  [sous-tests retenus : /8\.2 n|SMS_/]
not ok 3 - 8.2 n : avec le filtre lu dans la page, l’admin reçoit les INSERT de SMS_FORECAST et de SMS_OPTIONAL_80
      error: délai dépassé (20000 ms) : SMS_FORECAST reçu avec le filtre de la page (« kind=in.(NOTIFICATION_FAILED,SMS_DAILY_THRESHOLD) ») — 1 message(s) reçu(s) sur admin admin_signals [kind=in.(NOTIFICATION_FAILED,SMS_DAILY_THRESHOLD)] (états du canal : SUBSCRIBED ; éch …
        INSERT admin_signals commit=2026-11-06T19:18:52.440Z reçu=2026-11-06T19:18:53.346Z retard=906 ms {"id":"abd51485-4e94-4ce8-90d2-a0a6a4795010","kind":"SMS_DAILY_THRESHOLD","ref_id":"38b8cf42-ddca-4c02-a3b7-ec71a14b8c26","created_at":"2026-11-06T19:18:52.439292+ …
# tests 12
# pass 11
# fail 1
# cancelled 0
# run 107 (bc864fa, « après », code final) — tests/parcours/temps-reel-prives.test.ts  [sous-tests retenus : /8\.2 n|SMS_/]
ok 3 - 8.2 n : avec le filtre lu dans la page, l’admin reçoit les INSERT de SMS_FORECAST et de SMS_OPTIONAL_80
# … 1 autre(s) sous-test(s) réussi(s) dans ce filtre
# tests 12
# pass 12
# fail 0
# cancelled 0
```

**Correctif.** Au run 96, `notif-interface` restait rouge sur son propre motif `[A-Z_]+`, qui refusait le chiffre de `SMS_OPTIONAL_80` : le motif admet un chiffre (test existant corrigé, signalé).

```text
$ git show --numstat 1e8dc05f
1e8dc05f fix(8.2n): la page Notifications d'admin se recharge aussi sur SMS_OPTIONAL_80 et SMS_FORECAST : le filtre admin_signals passe à quatre valeurs (contrat 10.2), sinon l'alerte de budget SMS n' …
  +    1 -    1  app/admin/notifications/page.tsx
  (+ 2 trace(s) docs/lot8-logs/ non listée(s))
$ git show --numstat b405babe
b405babe test(8.2n): notif-interface accepte un chiffre dans le nom d'un signal (test existant corrigé, signalé au rapport). Le motif [A-Z_]+ refusait SMS_OPTIONAL_80 que le contrat 10.2 et ce même te …
  +    1 -    1  tests/parcours/notif-interface.test.ts
```

### 8.2 o — `/admin/services` : « Service désactivé »

**Origine.** `discovery-8-scan-messages.md`, section o : aucune lecture des interrupteurs dans `app/admin/services/page.tsx` (grep vide) ; `useFeatureFlags()` existe (`lib/features/client.ts:52`).

```text
# run 95 (db21d1c, « avant ») — tests/parcours/admin-services-mention.test.ts
not ok 1 - la page importe useFeatureFlags de lib/features/client et l’appelle
      error: 'app/admin/services/page.tsx : useFeatureFlags non importé de lib/features/client'
not ok 2 - chaque onglet de catalogue a sa clé : salles → halls, tables → tables, produits et commandes → orders ; Événements n’en a aucune
      error: app/admin/services/page.tsx : une correspondance onglet → interrupteur attendue, {"salles":"halls","tables":"tables","produits":"orders","commandes":"orders"} (trouvées : [])
        0 !== 1
not ok 3 - bandeau neutre, titre « Service désactivé », texte du contrat
      error: app/admin/services/page.tsx : un StatusBanner de titre « Service désactivé » attendu (trouvés : 0)
        0 !== 1
not ok 4 - bandeau sous condition de l’interrupteur de l’onglet ; rien tant que les interrupteurs ne sont pas lus (flags === null)
      error: app/admin/services/page.tsx : un StatusBanner de titre « Service désactivé » attendu (trouvés : 0)
        0 !== 1
# … 1 autre(s) sous-test(s) en échec retenu(s)
# tests 6
# pass 1
# fail 5
# cancelled 0
# run 107 (bc864fa, « après », code final) — tests/parcours/admin-services-mention.test.ts
ok 1 - la page importe useFeatureFlags de lib/features/client et l’appelle
ok 2 - chaque onglet de catalogue a sa clé : salles → halls, tables → tables, produits et commandes → orders ; Événements n’en a aucune
ok 3 - bandeau neutre, titre « Service désactivé », texte du contrat
ok 4 - bandeau sous condition de l’interrupteur de l’onglet ; rien tant que les interrupteurs ne sont pas lus (flags === null)
ok 5 - bandeau en tête du CatalogPanel : présent dans chaque retour du panneau (chargement, erreur, liste)
# … 1 autre(s) sous-test(s) réussi(s)
# tests 6
# pass 6
# fail 0
# cancelled 0
```

**Correctif.**

```text
$ git show --numstat bdb2cb19
bdb2cb19 fix(8.2o): /admin/services dit enfin quand un service est fermé : CatalogPanel lit useFeatureFlags, TAB_FLAG relie salles à halls, tables à tables, produits et commandes à orders, et le bande …
  +   46 -   19  app/admin/services/page.tsx
  (+ 2 trace(s) docs/lot8-logs/ non listée(s))
```

### 8.2 p — `commissionAmount` du tableau de bord partenaire

**Origine.** `discovery-8-scan-messages.md`, sections 0 et p : plus affiché par aucun écran (grep vide dans `app/` et `components/`), mais servi par l'API en zéro dur (`partner-dashboard.service.ts:28,70,663,743`) ; même famille, `commissionRate: 0` et `evCommission: 0` dans `app/api/partner/finance/route.ts:65,73`, sans lecteur.

```text
# run 95 (db21d1c, « avant ») — tests/parcours/partenaire-lot7.test.ts  [sous-tests retenus : /8\.2 p|commission/]
not ok 1 - statique : lib/partner/partner-dashboard.service.ts ne contient plus commissionAmount, ni aucun fichier de lib, app, components et hooks
      error: 'lib/partner/partner-dashboard.service.ts : commissionAmount encore présent'
not ok 2 - statique : app/api/partner/finance/route.ts ne sert plus commissionRate ni evCommission
      error: app/api/partner/finance/route.ts : zéros en dur encore servis (L60)
not ok 3 - GET /api/partner/dashboard : champ absent de kpis et de chaque événement, les montants réels restent servis
      error: zéro en dur encore servi par /api/partner/dashboard
not ok 4 - GET /api/partner/finance : ni commissionRate ni evCommission, les montants réels restent servis
      error: zéros en dur encore servis par /api/partner/finance
# tests 29
# pass 25
# fail 4
# cancelled 0
# run 107 (bc864fa, « après », code final) — tests/parcours/partenaire-lot7.test.ts  [sous-tests retenus : /8\.2 p|commission/]
ok 1 - statique : lib/partner/partner-dashboard.service.ts ne contient plus commissionAmount, ni aucun fichier de lib, app, components et hooks
ok 2 - statique : app/api/partner/finance/route.ts ne sert plus commissionRate ni evCommission
ok 3 - GET /api/partner/dashboard : champ absent de kpis et de chaque événement, les montants réels restent servis
ok 4 - GET /api/partner/finance : ni commissionRate ni evCommission, les montants réels restent servis
# tests 29
# pass 29
# fail 0
# cancelled 0
```

`finance-hors-plateforme` (T12, ligne retirée du cliché) devait rester vert ; il l'est aux deux runs :

```text
# run 95 — tests/parcours/finance-hors-plateforme.test.ts : tests 5 · pass 5 · fail 0
# run 107 — tests/parcours/finance-hors-plateforme.test.ts : tests 5 · pass 5 · fail 0
```

**Correctif.** Retrait du champ, après la suppression de `tests/legacy` qui le lisait typé (L69). La carte « Montant net organisateur » ne parlait plus de commissions déduites après relecture de la capture `pilotage-cloture` :

```text
$ git show --numstat ae66fbf8
ae66fbf8 fix(8.2p): plus aucun zéro en dur présenté comme une commission au partenaire (contrat 10.4, L60, L64). commissionAmount retiré des deux types et des deux objets du tableau de bord, commissio …
  +    0 -    2  app/api/partner/finance/route.ts
  +    1 -    6  lib/partner/partner-dashboard.service.ts
$ git show --numstat e96dab4a
e96dab4a fix(8.2p): la carte « Montant net organisateur » ne parle plus de commissions déduites, le modèle n'en prélève aucune sur l'organisateur (contrat 10.4). Vu en relisant la capture pilotage-clo …
  +    1 -    1  components/partner/pilotage/ClosingTab.tsx
  (+ 1 trace(s) docs/lot8-logs/ non listée(s))
```

### 8.2 q — Police à chasse fixe réservée, `tabular-nums` ailleurs

**Origine.** `discovery-8-design-outillage.md`, sections 0 et 1 : aucune police à chasse fixe définie (`tailwind.config.ts:27-30`), donc une police différente selon l'appareil ; **46 usages réels de `font-mono` : 9 à garder, 3 exceptions techniques, 34 à remplacer** ; 48 affichages de montants sans `tabular-nums`. `designViolations` n'avait aucune règle de police.

```text
# run 95 (db21d1c, « avant ») — tests/parcours/design-systeme.test.ts  [sous-tests retenus : /8\.2 q|font-mono|tabular|chasse/]
not ok 2 - 8.2 q : la règle de la police à chasse fixe et des chiffres tabulaires est consignée
      error: 'design-system/event-village/MASTER.md : rien ne dit que font-mono est réservé (contrat, section 11.1)'
not ok 1 - `font-mono` hors de MONO_ALLOWED : nombre exact par fichier
      error: font-mono est réservé aux numéros de billets, aux références et aux codes :
        app/admin/audit/page.tsx : 5 usage(s), 4 admis
not ok 2 - chaque usage admis porte bien un numéro de billet, une référence, un code ou le JSON du journal d'audit
      error: usages à déplacer ou à retirer :
        app/admin/audit/page.tsx:150 font-mono : text-xs font-mono font-bold text-[#FF5722]
not ok 1 - aucun appel affiché à formatFcfa, formatPrice, formatInteger, priceLabel ou formatTime sans tabular-nums
      error: 48 affichage(s) sans tabular-nums :
        app/admin/communications/page.tsx:230 [montant sans tabular-nums] formatInteger(lastSaved.recipients)
# tests 311
# pass 287
# fail 24
# cancelled 0
# run 107 (bc864fa, « après », code final) — tests/parcours/design-systeme.test.ts  [sous-tests retenus : /8\.2 q|font-mono|tabular|chasse/]
ok 2 - 8.2 q : la règle de la police à chasse fixe et des chiffres tabulaires est consignée
ok 1 - `font-mono` hors de MONO_ALLOWED : nombre exact par fichier
ok 2 - chaque usage admis porte bien un numéro de billet, une référence, un code ou le JSON du journal d'audit
ok 1 - aucun appel affiché à formatFcfa, formatPrice, formatInteger, priceLabel ou formatTime sans tabular-nums
# … 4 autre(s) sous-test(s) réussi(s) dans ce filtre
# tests 311
# pass 311
# fail 0
# cancelled 0
```

**Correctif.** Un commit par agent d'écran (AM13) :

```text
$ git show --numstat f9cc0c8d
f9cc0c8d fix(8.2q): font-mono n'est plus porté que par les numéros de billets, les références, les codes et le JSON du journal d'audit : les 34 autres usages passent en police normale, tabular-nums po …
  +    5 -    5  app/admin/audit/page.tsx
  +    1 -    1  app/admin/communications/page.tsx
  +    2 -    2  app/admin/notifications/[id]/page.tsx
  +    1 -    1  app/admin/pricing/page.tsx
  +    3 -    3  app/admin/users/page.tsx
  +    1 -    1  app/events/[id]/page.tsx
  +    1 -    1  app/paiement/[id]/page.tsx
  +    3 -    3  app/partner/dashboard/page.tsx
  +    3 -    3  app/partner/finance/page.tsx
  +    3 -    3  app/partner/subscription/page.tsx
  +    3 -    3  app/partner/team/page.tsx
  +    5 -    5  app/wallet/page.tsx
  +    6 -    6  components/events/AdjustTicketQuotaModal.tsx
  +    1 -    1  components/events/EventForm.tsx
  +   10 -   10  components/partner/ClosingReportModal.tsx
  +    1 -    1  components/partner/pilotage/ClosingTab.tsx
  +    1 -    1  components/partner/pilotage/EntriesTab.tsx
  +    1 -    1  components/partner/pilotage/OverviewTab.tsx
  +    1 -    1  components/partner/pilotage/TeamTab.tsx
  +    2 -    2  components/payment/PaymentModal.tsx
  +    1 -    1  components/payment/PendingPaymentBanner.tsx
  +    1 -    1  components/shifts/ShiftModals.tsx
  +    1 -    1  components/tickets/IncomingTransfers.tsx
  +    1 -    1  components/tickets/TicketCard.tsx
  +    2 -    2  components/tickets/offline/OfflineTicketView.tsx
  +    6 -    0  design-system/event-village/MASTER.md
  (+ 2 trace(s) docs/lot8-logs/ non listée(s))
$ git show --numstat e4995c0a
e4995c0a fix(8.2q): part du scanner portée par E1 (contrat 11.1) : heure de « Résultat retrouvé » sur le plein écran et la carte, montant du bouton d'encaissement en tabular-nums, pour que les chiffre …
  +    1 -    1  app/controller/scanner/page.tsx
  +    1 -    1  components/scan/CombatFlashOverlay.tsx
  +    1 -    1  components/scan/ScanResultPanel.tsx
  (+ 2 trace(s) docs/lot8-logs/ non listée(s))
$ git show --numstat b57441c3
b57441c3 fix(8.2q): part d'E3 (contrat 11.1) : l'écart de la carte mobile de /admin/finance et le nombre de jours de /admin/notifications passent en tabular-nums, pour que les chiffres restent alignés …
  +    1 -    1  app/admin/finance/page.tsx
  +    1 -    1  app/admin/notifications/page.tsx
```

Les autres rouges de `design-systeme` au run 95 sont les fichiers nouveaux déclarés dans `tests/helpers/design-files.ts` mais pas encore livrés (layout du 404, `AccessNotice`, `RefundsToRetry`, `TicketRefundPanel`, pages de développement, `ClosingReportModal` retiré de `PRE_LOT5_UI_FILES`) :

```text
# run 95 (db21d1c, « avant ») — tests/parcours/design-systeme.test.ts  [sous-tests retenus : /fichiers migrés|Q — design-system/]
not ok 2 - 8.2 q : la règle de la police à chasse fixe et des chiffres tabulaires est consignée
      error: 'design-system/event-village/MASTER.md : rien ne dit que font-mono est réservé (contrat, section 11.1)'
not ok 3 - garde-fou : chaque entrée de la liste existe, sans doublon, en chemin relatif à la racine
      error: entrées invalides ou fichiers absents : app/events/[id]/layout.tsx, components/layout/AccessNotice.tsx, components/admin/RefundsToRetry.tsx, components/partner/pilotage/TicketRefundPanel.tsx, app/dev/paiements/page.dev.tsx, app/dev/paiements/[id]/page.dev.tsx, …
not ok 261 - règles du contrat Q : app/events/[id]/layout.tsx
      error: 'app/events/[id]/layout.tsx absent'
not ok 262 - accessibilité et mobile (DoD 3 et 7) : app/events/[id]/layout.tsx
      error: 'app/events/[id]/layout.tsx absent'
not ok 263 - règles du contrat Q : components/layout/AccessNotice.tsx
      error: 'components/layout/AccessNotice.tsx absent'
not ok 264 - accessibilité et mobile (DoD 3 et 7) : components/layout/AccessNotice.tsx
      error: 'components/layout/AccessNotice.tsx absent'
# … 12 autre(s) sous-test(s) en échec retenu(s)
# tests 311
# pass 287
# fail 24
# cancelled 0
# run 107 (bc864fa, « après », code final) — tests/parcours/design-systeme.test.ts  [sous-tests retenus : /fichiers migrés|Q — design-system/]
ok 2 - 8.2 q : la règle de la police à chasse fixe et des chiffres tabulaires est consignée
ok 3 - garde-fou : chaque entrée de la liste existe, sans doublon, en chemin relatif à la racine
ok 261 - règles du contrat Q : app/events/[id]/layout.tsx
ok 262 - accessibilité et mobile (DoD 3 et 7) : app/events/[id]/layout.tsx
ok 263 - règles du contrat Q : components/layout/AccessNotice.tsx
ok 264 - accessibilité et mobile (DoD 3 et 7) : components/layout/AccessNotice.tsx
# … 272 autre(s) sous-test(s) réussi(s) dans ce filtre
# tests 311
# pass 311
# fail 0
# cancelled 0
```

### 8.2 r — `ClosingReportModal` migré

**Origine.** `discovery-8-design-outillage.md`, section 2 : 360 lignes hors système de design (4 `#FF5722`, 46 lignes de palette brute, 12 `text-xs`, 1 `<table>` hors `DataList`, 1 dégradé) ; « Document certifié Event Village • Conforme CDC V3.0 », terme interne, aussi dans le PDF ; message brut rendu (`json.error`) ; aucune capture.

```text
# run 95 (db21d1c, « avant ») — tests/parcours/design-systeme.test.ts  [sous-tests retenus : /8\.2 r|CDC|PDF :|erreur de chargement/]
not ok 1 - écran : ni « CDC » ni « commissions de la plateforme » (terme interne, affirmation fausse)
      error: components/partner/ClosingReportModal.tsx : termes à retirer de l'écran
not ok 2 - PDF : même retrait (rouge jusqu'à fix(8.2p), S4 porte ce fichier)
      error: lib/partner/partner-dashboard.service.ts : termes à retirer du PDF de clôture
not ok 3 - erreur de chargement : pas de message de la réponse affiché tel quel, ErrorState avec « Réessayer »
      error: 'components/partner/ClosingReportModal.tsx : le texte de la réponse devient le message affiché'
# tests 311
# pass 287
# fail 24
# cancelled 0
# run 107 (bc864fa, « après », code final) — tests/parcours/design-systeme.test.ts  [sous-tests retenus : /8\.2 r|CDC|PDF :|erreur de chargement/]
ok 1 - écran : ni « CDC » ni « commissions de la plateforme » (terme interne, affirmation fausse)
ok 2 - PDF : même retrait (rouge jusqu'à fix(8.2p), S4 porte ce fichier)
ok 3 - erreur de chargement : pas de message de la réponse affiché tel quel, ErrorState avec « Réessayer »
# tests 311
# pass 311
# fail 0
# cancelled 0
```

**Correctif.** Au run 96, la capture `partenaire-rapport-cloture` relevait `scrollable-region-focusable` (axe) : le corps du modal n'avait plus d'élément focalisable. Correctif `a7b4539`.

```text
$ git show --numstat 82ca88d4
82ca88d4 fix(8.2r): le rapport de clôture entre dans le système de design : jetons, KpiCard, DataList (tableau dès md, cartes en dessous), DefinitionRow sur bg-surface-sunken à la place du dégradé som …
  +  205 -  317  components/partner/ClosingReportModal.tsx
  (+ 2 trace(s) docs/lot8-logs/ non listée(s))
$ git show --numstat a7b4539c
a7b4539c fix(8.2r): le rapport de clôture défile enfin au clavier (axe scrollable-region-focusable, relevé par E2E au run 96). Le corps du modal n'a plus aucun élément focalisable depuis sa réécriture …
  +    1 -    0  components/partner/ClosingReportModal.tsx
  +   12 -    1  components/ui/Modal.tsx
  (+ 1 trace(s) docs/lot8-logs/ non listée(s))
```

### 8.2 s — Barre d'achat fixe en bas de l'écran

**Origine.** `discovery-8-design-outillage.md`, section 3, expérience Chromium à 390 × 844 : `.ev-page-enter` (`animation … both` et `will-change: transform`, `app/globals.css:441-444`) devient le bloc conteneur de tout `position: fixed`. La barre se plaçait à `top = 2868` au lieu de `712` et défilait avec la page. Aucune capture ne le montrait (panier vide, ou modale par-dessus).

```text
# run 95 (db21d1c, « avant ») — tests/parcours/perf-statique.test.ts  [sous-tests retenus : /8\.2 s|ev-page-enter|will-change|isolation/]
not ok 1 - ni will-change: transform, ni remplissage both ou forwards : l'animation reste, en backwards
      error: .ev-page-enter est le bloc conteneur des position: fixed de toutes les pages :
        app/globals.css « .ev-page-enter » : remplissage both : la transformation reste après l'animation
not ok 2 - garde son contexte d'empilement : isolation: isolate (caméra et barre z-30 sous l'en-tête z-20)
      error: '.ev-page-enter sans isolation: isolate (app/globals.css « .ev-page-enter » : {"animation":"evPageEnter 0.32s cubic-bezier(0.22, 1, 0.36, 1) both","will-change":"transform"})'
# tests 15
# pass 13
# fail 2
# cancelled 0
# run 107 (bc864fa, « après », code final) — tests/parcours/perf-statique.test.ts  [sous-tests retenus : /8\.2 s|ev-page-enter|will-change|isolation/]
ok 1 - ni will-change: transform, ni remplissage both ou forwards : l'animation reste, en backwards
ok 2 - garde son contexte d'empilement : isolation: isolate (caméra et barre z-30 sous l'en-tête z-20)
# … 2 autre(s) sous-test(s) réussi(s) dans ce filtre
# tests 15
# pass 15
# fail 0
# cancelled 0
```

Terrain 8 et 9, capture `fiche-barre-achat`, run 95 :

```text
  1) [terrain] › e2e/terrain.spec.ts:775:5 › 8. barre d’achat de la fiche : collée au bas de l’écran en haut de page et à mi-page, pleine largeur

    Error: gauche de la barre au bord de l'écran — fiche de l’événement, haut de page : {"scrollY":0,"scrollMax":1032,"top":1634.625,"bottom":1707.625,"left":16,"right":374,"innerWidth":390,"innerHeight":844,"navHeight":53}

    expect(received).toBeLessThanOrEqual(expected)

    Expected: <= 2
    Received:    16
```

```text
  2) [terrain] › e2e/terrain.spec.ts:791:5 › 9. résultat du scanner : plein écran égal à la fenêtre, page défilée de force

    Error: rectangle du plein écran : {"scrollY":1000,"top":-1000,"bottom":-156,"left":0,"right":390,"innerWidth":390,"innerHeight":844}

```

```text
  4) [mobile] › e2e/captures.spec.ts:159:9 › clair · client › fiche-barre-achat — Fiche d’un événement — barre d’achat fixe, panier non vide, page défilée

    Error: gauche de la barre au bord de l'écran — fiche de « ce soir », haut de page : {"scrollY":0,"scrollMax":2351,"top":2953.625,"bottom":3026.625,"left":16,"right":374,"innerWidth":390,"innerHeight":844,"navHeight":53}

    expect(received).toBeLessThanOrEqual(expected)

    Expected: <= 2
    Received:    16
```

Run 107 :

```text
  ✓   18 [mobile] › e2e/captures.spec.ts:159:9 › clair · client › fiche-barre-achat — Fiche d’un événement — barre d’achat fixe, panier non vide, page défilée (7.6s)
  ✓  109 [mobile] › e2e/captures.spec.ts:159:9 › sombre · client › fiche-barre-achat — Fiche d’un événement — barre d’achat fixe, panier non vide, page défilée (7.7s)
  -  200 [desktop] › e2e/captures.spec.ts:159:9 › clair · client › fiche-barre-achat — Fiche d’un événement — barre d’achat fixe, panier non vide, page défilée
  -  291 [desktop] › e2e/captures.spec.ts:159:9 › sombre · client › fiche-barre-achat — Fiche d’un événement — barre d’achat fixe, panier non vide, page défilée
  ✓   9 [terrain] › e2e/terrain.spec.ts:765:5 › 8. barre d’achat de la fiche : collée au bas de l’écran en haut de page et à mi-page, pleine largeur (1.5s)
  ✓  10 [terrain] › e2e/terrain.spec.ts:781:5 › 9. résultat du scanner : plein écran égal à la fenêtre, page défilée de force (1.7s)
```

Les vues ordinateur de `fiche-barre-achat` (« - ») sont sautées par la spec, comme au run 95.

**Correctif.** `bb2cd0c` lève le piège ; la relecture des captures du run 98 a ensuite collé la barre à la navigation (19 px d'écart, `dff5778`, voir 8.2 u) :

```text
$ git show --numstat bb2cd0c8
bb2cd0c8 fix(8.2s): .ev-page-enter passe en backwards, perd will-change: transform et prend isolation: isolate : l'enveloppe de chaque page ne retient plus les position: fixed, et la barre d'achat de  …
  +    7 -    2  app/globals.css
  (+ 3 trace(s) docs/lot8-logs/ non listée(s))
```

Effet de bord listé, non corrigé (A37) : les barres `fixed bottom-0 z-50` des écrans salles, menu et tables passent sous la navigation mobile ; ces écrans sont derrière des interrupteurs fermés.

### 8.2 t — Dates en français dans les captures

**Origine.** `discovery-8-design-outillage.md`, section 4 : `locale: 'fr-FR'` et `timezoneId: 'Africa/Dakar'` étaient **déjà** en place (`playwright.config.ts:40-41`) et sans effet sur le gabarit des champs (`mm/dd/yyyy`). L'explication du lot 7 (« le Chromium n'embarque que l'anglais ») est inexacte : le gabarit suit la langue du navigateur. Le drapeau `--enable-blink-features=LangAttributeAwareFormControlUI` donne `dd/mm/yyyy` et 24 h sans changer de binaire ; `jj/mm/aaaa` exigerait le Chromium complet en français.

**Test.** Pas de rouge : le drapeau est entré avec les captures du run « avant » (`db21d1c`). `admin-notifications` lit par CDP le gabarit du premier `input[type="date"]` et exige `dd/mm/yyyy` (`e2e/support/screens.ts:277`) ; vert au run 95 et au run 107 :

```text
  ✓   69 [mobile] › e2e/captures.spec.ts:159:9 › clair · admin › admin-notifications — Administration — supervision des notifications (liste filtrable, compteurs) (7.9s)
  ✓  160 [mobile] › e2e/captures.spec.ts:159:9 › sombre · admin › admin-notifications — Administration — supervision des notifications (liste filtrable, compteurs) (8.1s)
  ✓  251 [desktop] › e2e/captures.spec.ts:159:9 › clair · admin › admin-notifications — Administration — supervision des notifications (liste filtrable, compteurs) (8.0s)
  ✓  342 [desktop] › e2e/captures.spec.ts:159:9 › sombre · admin › admin-notifications — Administration — supervision des notifications (liste filtrable, compteurs) (8.0s)
```

**Non tenu.** Les champs `datetime-local` du formulaire de catégorie restent en `mm/dd/yyyy, --:-- --` sur les captures du run 105 (`rap8/verif-releve.md`, « Encore là ») : le drapeau agit sur `type="date"`, pas sur `datetime-local`, et le contrôle CDP ne lit que le premier champ `date`. C'est un écart de capture, documenté ; un Chrome réglé en français affiche le format français. Non revérifié sur les images du run 107.

### 8.2 u — Relecture humaine des captures

Pas de test : la relecture est faite par des agents, sur les images, et présentée comme telle. Bilan détaillé en section 3. Elle a donné trois commits de correction et un commit de capture :
- `dff5778` : 38 fichiers, relecture du run 98 (mots des boutons collés, barre d'achat, carte du lieu, visuels recadrés, jargon N1 et N2 au client, consigne répétée de `scanner-non-traite`, etc.) ;
- `e7512f4` : `caisse-cloture-ecart` lisait 43 000 en dur au lieu du montant enregistré ;
- `bc864fa` : trois ponctuations seules en début de ligne vues sur les images du run 105 (`rap8/verif-releve.md`, « Défauts nouveaux »), et « Créance » devenu « À compenser » côté partenaire.

```text
$ git show --numstat dff5778f
dff5778f fix(8.2u)[relecture]: corrections de la relecture des captures du run 98 : mots des boutons séparés (Button sans tracking-tight, word-spacing 0,1 em), barre d'achat collée à la navigation (53 …
  +    1 -    1  app/admin/events/page.tsx
  +    4 -    5  app/admin/finance/page.tsx
  +    3 -    3  app/admin/notifications/page.tsx
  +    3 -    2  app/admin/services/page.tsx
  +    4 -    3  app/events/[id]/page.tsx
  +   12 -    4  app/globals.css
  +    5 -    5  app/paiement/[id]/page.tsx
  +    2 -    2  app/partner/dashboard/page.tsx
  +    4 -    4  app/partner/events/[id]/page.tsx
  +    1 -    1  app/partner/events/page.tsx
  +    1 -    1  app/partner/finance/page.tsx
  +    2 -    2  app/partner/register/page.tsx
  +    1 -    1  app/partner/subscription/page.tsx
  +    2 -    3  app/partner/team/page.tsx
  +   11 -    5  app/wallet/page.tsx
  +    2 -    2  components/auth/LoginForm.tsx
  +    5 -    5  components/events/EventForm.tsx
  +    1 -    1  components/events/EventTicketing.tsx
  +    2 -    2  components/events/RefundProgress.tsx
  +    1 -    1  components/notifications/NotificationBell.tsx
  +    7 -    6  components/partner/pilotage/ClosingTab.tsx
  +    1 -    1  components/partner/pilotage/EntriesTab.tsx
  +   29 -   19  components/partner/pilotage/OverviewTab.tsx
  +    1 -    1  components/partner/pilotage/TeamTab.tsx
  +    1 -    1  components/partner/pilotage/TicketRefundPanel.tsx
  +    4 -    3  components/scan/CombatFlashOverlay.tsx
  +    1 -    1  components/scan/CounterSalePanel.tsx
  +    4 -    2  components/scan/ScanResultPanel.tsx
  +    1 -    1  components/scan/ScanStatusBar.tsx
  +    1 -    1  components/shifts/ShiftModals.tsx
  +    4 -    4  components/tickets/TicketCard.tsx
  +   13 -   13  components/tickets/TransferExplainerModal.tsx
  +    1 -    1  components/ui/Button.tsx
  +    3 -    1  components/ui/EventMap.tsx
  +    1 -    0  components/ui/MapPicker.tsx
  +    1 -    1  design-system/event-village/MASTER.md
  +   10 -    0  lib/format.ts
  +    6 -    0  lib/scan/scan-result.ts
  (+ 8 trace(s) docs/lot8-logs/ non listée(s))
$ git show --numstat e7512f45
e7512f45 test(e2e)[8]-captures: caisse-cloture-ecart lit le montant enregistré au lieu de 43 000 en dur (relevé par la relecture : 55 000 enregistrés, 43 000 comptés, écart de -2 000 à l'écran, image  …
  +    3 -    2  e2e/support/screens.ts
$ git show --numstat bc864fad
bc864fad fix(8.2u)[relecture]: ponctuation jamais seule en début de ligne (3 défauts vus sur les images du run 105, la correction des gouttières et des espaces ayant déplacé les coupures). Espace insé …
  +    1 -    1  app/partner/finance/page.tsx
  +    1 -    1  components/events/EventForm.tsx
  +    1 -    1  components/scan/CombatFlashOverlay.tsx
  +    1 -    1  components/shifts/ShiftModals.tsx
  (+ 1 trace(s) docs/lot8-logs/ non listée(s))
```

`bc864fa` est le code du run 107. Ses trois corrections de ponctuation n'ont pas été relues sur les images du run 107 dans cette partie.

### 8.2 v — Suites legacy

**Origine.** `discovery-8-design-outillage.md`, section 6 : `scripts/run-tests.mjs:54-55` ignorait `tests/legacy` et la CI ne lançait pas `test:legacy`. Les suites ne tournaient pas : UUID du projet distant, `LEGACY_TEST_PASSWORD` défini nulle part. « 18 sur 26 ont au moins un cas réellement unique ; 8 sont à supprimer sans portage. » Trous réels : routes `reports/closing/pdf` et `reports/accounting`, droits du PDF de billet, éligibilité de l'événement à l'affectation, `retryRefund`, `ACCOUNT_ALREADY_CONFIGURED`, `detectScannerSupport`, `resolvePostLoginRoute`.

**Tests.** Les cas portés (53 tests) sont annoncés verts dès l'écriture, sauf les deux de l'anomalie A23 (8.3 d). Compteurs des 15 fichiers touchés par `test(8.2v)[ports]`, run 95 puis run 107 :

```text
# run 95 — tests/parcours/legacy-billet-pdf.test.ts : tests 6 · pass 5 · fail 1
# run 107 — tests/parcours/legacy-billet-pdf.test.ts : tests 6 · pass 6 · fail 0
# run 95 — tests/parcours/legacy-exports-partenaire.test.ts : tests 9 · pass 8 · fail 1
# run 107 — tests/parcours/legacy-exports-partenaire.test.ts : tests 9 · pass 9 · fail 0
# run 95 — tests/parcours/equipe-eligibilite.test.ts : tests 15 · pass 15 · fail 0
# run 107 — tests/parcours/equipe-eligibilite.test.ts : tests 16 · pass 16 · fail 0
# run 95 — tests/parcours/remboursement-relance.test.ts : tests 5 · pass 5 · fail 0
# run 107 — tests/parcours/remboursement-relance.test.ts : tests 5 · pass 5 · fail 0
# run 95 — tests/parcours/acces-scan.test.ts : tests 10 · pass 10 · fail 0
# run 107 — tests/parcours/acces-scan.test.ts : tests 10 · pass 10 · fail 0
# run 95 — tests/parcours/activation-controleur.test.ts : tests 7 · pass 7 · fail 0
# run 107 — tests/parcours/activation-controleur.test.ts : tests 7 · pass 7 · fail 0
# run 95 — tests/parcours/anonymisation-debogage.test.ts : tests 3 · pass 3 · fail 0
# run 107 — tests/parcours/anonymisation-debogage.test.ts : tests 3 · pass 3 · fail 0
# run 95 — tests/parcours/confirmation-achat.test.ts : tests 22 · pass 22 · fail 0
# run 107 — tests/parcours/confirmation-achat.test.ts : tests 22 · pass 22 · fail 0
# run 95 — tests/parcours/dette-retrait-controleur.test.ts : tests 11 · pass 11 · fail 0
# run 107 — tests/parcours/dette-retrait-controleur.test.ts : tests 11 · pass 11 · fail 0
# run 95 — tests/parcours/dette-transferts.test.ts : tests 20 · pass 20 · fail 0
# run 107 — tests/parcours/dette-transferts.test.ts : tests 20 · pass 20 · fail 0
# run 95 — tests/parcours/edition-categories.test.ts : tests 25 · pass 25 · fail 0
# run 107 — tests/parcours/edition-categories.test.ts : tests 25 · pass 25 · fail 0
# run 95 — tests/parcours/finance-rapports.test.ts : tests 3 · pass 3 · fail 0
# run 107 — tests/parcours/finance-rapports.test.ts : tests 3 · pass 3 · fail 0
# run 95 — tests/parcours/paiement-gratuits.test.ts : tests 6 · pass 6 · fail 0
# run 107 — tests/parcours/paiement-gratuits.test.ts : tests 6 · pass 6 · fail 0
# run 95 — tests/parcours/roles-fraicheur.test.ts : tests 4 · pass 4 · fail 0
# run 107 — tests/parcours/roles-fraicheur.test.ts : tests 4 · pass 4 · fail 0
# run 95 — tests/security/r26-brouillon-autre-partenaire.test.ts : tests 3 · pass 3 · fail 0
# run 107 — tests/security/r26-brouillon-autre-partenaire.test.ts : tests 3 · pass 3 · fail 0
```

Ligne 10 du tableau (T6, invitation d'un contrôleur sur l'événement d'un autre partenaire) : cas ajouté après le run 95, vu vert au run 96 avant la suppression du dernier fichier legacy :

```text
    ok 7 - T6 : événement d’un autre partenaire → 403, aucun compte créé, aucune affectation, aucun SMS
# tests 16
# pass 16
# fail 0
```

**Correctif.** Ports, suppression de 25 fichiers sur 26, cas T6, puis suppression du dernier fichier et de la quarantaine :

```text
$ git show --numstat 3687cc0a
3687cc0a test(8.2v)[ports]: suites legacy, cas uniques portés (53 tests, annoncés verts sauf l'anomalie A23) : legacy-billet-pdf, legacy-exports-partenaire, equipe-eligibilite, remboursement-relance,  …
  +   19 -    0  tests/parcours/acces-scan.test.ts
  +   30 -    4  tests/parcours/activation-controleur.test.ts
  +   50 -    0  tests/parcours/anonymisation-debogage.test.ts
  +   33 -    1  tests/parcours/confirmation-achat.test.ts
  +   57 -    1  tests/parcours/dette-retrait-controleur.test.ts
  +  103 -    1  tests/parcours/dette-transferts.test.ts
  +   33 -    0  tests/parcours/edition-categories.test.ts
  +  213 -    0  tests/parcours/equipe-eligibilite.test.ts
  +   13 -    0  tests/parcours/finance-rapports.test.ts
  +  174 -    0  tests/parcours/legacy-billet-pdf.test.ts
  +  238 -    0  tests/parcours/legacy-exports-partenaire.test.ts
  +   48 -    2  tests/parcours/paiement-gratuits.test.ts
  +  218 -    0  tests/parcours/remboursement-relance.test.ts
  +   21 -    0  tests/parcours/roles-fraicheur.test.ts
  +   82 -    0  tests/security/r26-brouillon-autre-partenaire.test.ts
$ git show --numstat b7b11700
b7b11700 test(8.2v)[suppression]: 25 suites de tests/legacy supprimées sur 26 (T35), tableau 12.1 relu ligne à ligne et cas portés lus au run 95 : verts, sauf les deux rouges de l'anomalie A23. contro …
  +    0 -  272  tests/legacy/admin-anonymize.test.ts
  +    0 -  130  tests/legacy/camera-qr-scanner.test.ts
  +    0 -  266  tests/legacy/cdc-v3-validation-checks.test.ts
  +    0 -  316  tests/legacy/checkout-mixed-cart.test.ts
  +    0 -   94  tests/legacy/chunk5-phase1-bugs.test.ts
  +    0 -  322  tests/legacy/chunk5-phase2-b2c.test.ts
  +    0 -  467  tests/legacy/client-ticket-lifecycle.test.ts
  +    0 -  593  tests/legacy/controller-14-points.test.ts
  +    0 -  321  tests/legacy/controller-complete-workflow.test.ts
  +    0 -  532  tests/legacy/controller-multi-role.test.ts
  +    0 -  334  tests/legacy/controller-realtime-sync.test.ts
  +    0 -  339  tests/legacy/controller-shifts-z.test.ts
  +    0 -  188  tests/legacy/dynamic-qr-totp.test.ts
  +    0 -  114  tests/legacy/event-cancellation-and-refunds.test.ts
  +    0 -  446  tests/legacy/event-live-editing-and-stock.test.ts
  +    0 -  481  tests/legacy/partner-dashboard-and-exports.test.ts
  +    0 -  424  tests/legacy/partner-events-m5.test.ts
  +    0 -  282  tests/legacy/partner-tables-m8.test.ts
  +    0 -  176  tests/legacy/scanner-security-hardening.test.ts
  +    0 -  361  tests/legacy/security-fixes.test.ts
  +    0 -  323  tests/legacy/ticket-pdf-and-exports.test.ts
  +    0 -  337  tests/legacy/ticket-transfer-phase2-initiation.test.ts
  +    0 -  326  tests/legacy/ticket-transfer-phase3-claim.test.ts
  +    0 -  502  tests/legacy/ticket-transfers-phase1-schema.test.ts
  +    0 -  274  tests/legacy/ticketing-e2e-final.test.ts
$ git show --numstat 9642b7c7
9642b7c7 test(8.2v)[T6]: l'invitation d'un contrôleur sur l'événement d'un autre partenaire est enfin testée (tableau 12.1, ligne 10). Cas ajouté à equipe-eligibilite, seul et mêlé à un événement à so …
  +   24 -    2  tests/parcours/equipe-eligibilite.test.ts
$ git show --numstat 5d4cdb70
5d4cdb70 test(8.2v)[suppression]: dernier fichier legacy supprimé, fin de la quarantaine (T35, T36). T6 vu vert au run 96, ligne 10 soldée, tests/legacy n'existe plus. Retirés : filtre de scripts/run- …
  +    2 -    0  docs/lot0-inventaire-suites.md
  +    1 -    1  lib/payments/financial-calculator.service.ts
  +    0 -    1  package.json
  +    1 -    4  scripts/run-tests.mjs
  +    6 -   11  tests/README.md
  +    0 -  612  tests/legacy/controller-event-status-hotfix.test.ts
```

Le tableau des 26 suites est en section 5.

### 8.2 w — `legacy-peer-deps` retiré

**Origine.** `discovery-8-design-outillage.md`, section 7, essais dans une copie : aucun conflit de dépendances ; le blocage venait seulement de la synchronisation du lock. Un lock régénéré par npm 11 est refusé par `npm ci` de npm 10 ; un lock régénéré par npm 10 passe sur les deux. La version de npm en CI n'était dans aucun journal.

**Test.** T38 (`fondations-lot0`) est entré **avec** le correctif : il n'a jamais été rouge en CI, son rouge avant le retrait n'est affirmé que par le message du commit. La preuve de fond est le `npm ci` de la CI, sans l'option :

```text
    # Subtest: npm : legacy-peer-deps=true n’est plus actif dans le dépôt
    ok 10 - npm : legacy-peer-deps=true n’est plus actif dans le dépôt
```

```text
npm_version=10.9.9
etape_npm-ci=debut_s:4 duree_s:57 code:0
```

```text
npm_version=10.9.9
etape_npm-ci=debut_s:4 duree_s:9 code:0
```

**Correctif.** `npx -y npm@10.9.9 install --package-lock-only --legacy-peer-deps=false --ignore-scripts --no-audit --no-fund` (AM10 : 10.9.9, version lue en CI au run 95, et non 10.9.2) :

```text
$ git show --numstat 9d844d02
9d844d02 fix(8.2w): legacy-peer-deps retiré, le lock est refait sans l'option par npm 10.9.9, la version de la CI (contrat 12.2, L70, AM10, T38). .npmrc supprimé ; npx -y npm@10.9.9 install --package- …
  +    0 -    6  .npmrc
  +   28 -    3  package-lock.json
  +    9 -    0  tests/fondations-lot0.test.ts
```

Piège résiduel : un `npm install` lancé avec npm 11 réécrirait ce lock.

### 8.2 x — Taille réelle du lot hors ligne

**Origine.** `discovery-8-design-outillage.md`, section 0 : « l'affirmation du lot 7 est fausse ». `next start` 14.2.35 ne compresse aucune route API : `send-response.js` pose `Content-Type` en tableau, que `compressible()` refuse. Le lot de 48 h partait à 52 Ko bruts, pas 25,7 Ko.

```text
# run 95 (db21d1c, « avant ») — tests/parcours/hors-ligne-codes.test.ts  [sous-tests retenus : /8\.2 x|gzip|40 000/]
not ok 1 - 13. Accept-Encoding: gzip → corps gzip, Vary, no-store ; décompressé, c’est le JSON de la route
      error: navigateur : Content-Encoding: gzip attendu (contrat 3.7, fix(8.2x)), en-têtes reçus {"cache-control":"no-store","content-type":"application/json"}
not ok 3 - 15. lot de 48 h : corps réellement servi sous 40 000 octets, plus petit que le JSON
      error: lot de 48 h : Content-Encoding: gzip attendu (contrat 3.7, fix(8.2x)), en-têtes reçus {"cache-control":"no-store","content-type":"application/json"}
# tests 15
# pass 13
# fail 2
# cancelled 0
# run 107 (bc864fa, « après », code final) — tests/parcours/hors-ligne-codes.test.ts  [sous-tests retenus : /8\.2 x|gzip|40 000/]
ok 1 - 13. Accept-Encoding: gzip → corps gzip, Vary, no-store ; décompressé, c’est le JSON de la route
ok 3 - 15. lot de 48 h : corps réellement servi sous 40 000 octets, plus petit que le JSON
# … 2 autre(s) sous-test(s) réussi(s) dans ce filtre
# tests 15
# pass 15
# fail 0
# cancelled 0
```

Mesure e2e (terrain 10), run 95 puis run 107. Elle porte sur le lot servi dans ce scénario, pas sur le lot de 48 h de la découverte : 33 162 octets bruts au run 95, 16 730 octets transférés en gzip au run 107 (33 228 décompressés) :

```text
[HORS-LIGNE-TRANSFERE] content-encoding=aucun encodedBodySize=33162 decodedBodySize=33162 transferSize=33462 responseBodySize=33175 responseHeadersSize=393
```

```text
  3) [terrain] › e2e/terrain.spec.ts:825:5 › 10. lot hors ligne : réponse compressée en gzip, moins de 40 000 octets transférés

    Error: en-tête content-encoding de la réponse du lot

    expect(received).toBe(expected) // Object.is equality

    Expected: "gzip"
    Received: null
```

```text
[HORS-LIGNE-TRANSFERE] content-encoding=gzip encodedBodySize=16430 decodedBodySize=33228 transferSize=16730 responseBodySize=16443 responseHeadersSize=440
  ✓  11 [terrain] › e2e/terrain.spec.ts:815:5 › 10. lot hors ligne : réponse compressée en gzip, moins de 40 000 octets transférés (1.3s)
```

**Correctif.** La route compresse elle-même (T39 : `hors-ligne-codes` test 10 admet `accept-encoding` lu une seule fois, AM2). Les autres routes API restent non compressées par `next start` (PO8).

```text
$ git show --numstat fb588206
fb588206 fix(8.2x): le lot hors ligne part réellement compressé. next start ne compresse aucune route API, Content-Type posé en tableau et refusé par compressible(), le lot de 48 h partait à 52 Ko (L7 …
  +   35 -    4  app/api/tickets/[id]/offline-codes/route.ts
```

### 8.3 a — Matrice de traçabilité

**Origine.** `docs/CDC-V3.md` trouvé dans le dépôt (note de l'orchestrateur). AR14 : une ligne n'est « fait » qu'après lecture du corps du test cité.

**Test.** `tests/schema/recette-matrice.test.ts` (sans base) empêche la matrice de dériver : statuts de la légende, résumé égal aux lignes, fichiers et lignes cités existants, test cité vert pour une anomalie corrigée. Il n'existait pas au run 95. Son seul rouge connu (« anomalie inconnue : A41 », borne arrêtée à A40) a été vu sur le poste, d'après le message de `0a6e83d`, jamais en CI ; la borne est passée à A41 par `208d8df`, contrôle élargi, rien de retiré.

```text
# run 95 — tests/schema/recette-matrice.test.ts : absente
# run 107 — tests/schema/recette-matrice.test.ts : tests 18 · pass 18 · fail 0
```

**Correctif.** Matrice de 106 lignes (46 fait, 37 partiel, 3 non fait, 6 écarté, 14 hors périmètre), puis mise à jour sur le run 105 :

```text
$ git show --numstat 9af8e750
9af8e750 docs(8.3a): docs/recette-billetterie.md, matrice de traçabilité du CDC V3.0 sur 106 lignes (46 fait, 37 partiel, 3 non fait, 6 écarté, 14 hors périmètre), code et test par ligne, corps de cha …
  +  287 -    0  docs/recette-billetterie.md
$ git show --numstat 0a6e83d4
0a6e83d4 docs(8.3a): matrice et anomalies sur le run 105 : 46 fait (46 prouvées au run 105), 37 partiel, 3 non fait, 6 écarté, 14 hors périmètre ; anomalies 11 corrigées dont A41, 3 preuves ajoutées,  …
  +  103 -  104  docs/recette-billetterie.md
$ git show --numstat d5aa4e51
d5aa4e51 test(8.3a): tests/schema/recette-matrice.test.ts, sans base, empêche la matrice de dériver : statuts de la légende, résumé égal aux lignes, fichiers et lignes cités existants, ligne de test o …
  +  245 -    0  tests/schema/recette-matrice.test.ts
$ git show --numstat 208d8df1
208d8df1 test(8.3a): recette-matrice connaît A41, trouvée après son écriture. Bornes passées de 40 à 41, A41 ajoutée aux corrigées, qui exigent un test cité vert. Contrôle plus large, rien de retiré
  +    5 -    5  tests/schema/recette-matrice.test.ts
```

La colonne CI de la matrice est lue au run 105, pas au 107. Résumé en section 11.

### 8.3 b — Parcours de recette enchaînés

Un fichier, `e2e/recette.spec.ts`, 8 actes en mode `serial` sur une même base, étiquetés par rôle ; quatre passages d'invariants (a) à (t) avec les étiquettes `recette-client`, `recette-controleur`, `recette-partenaire`, `recette-admin`. Avant son écriture, la recette n'avait jamais tourné (run 97 : « phase recette NON LANCÉE »). L'agent qui l'a écrite n'avait pas de base : ses sélecteurs venaient de la lecture du code.

**Mise au point.** Le premier passage complet (run 98, `6ea04e4`) s'arrête à l'acte 2 :

```text
  1) [recette] › e2e/recette.spec.ts:322:5 › acte 2 [partenaire] [admin] : inscription avec pièces, validation, E1 et ses canaux, soumission, publication, E2 › validation par le SUPERADMIN, après consultation d’une pièce

    TimeoutError: locator.click: Timeout 15000ms exceeded.
    Call log:
      - waiting for getByRole('dialog', { name: /^dossier du partenaire/i }).getByRole('button', { name: /^valider$/i })

```

Pour ne pas payer 40 minutes par essai, un run ciblé temporaire (`f6fcebd`, marqueur `[recette-seule]`) ne jouait que le build, la connexion et la recette ; il finissait toujours en échec par construction et ne prouve donc rien du lot. Il a servi aux runs 99 à 103, puis a été retiré (`ff4aae0`). Chaque run a fait avancer la recette d'un acte :

Run 99 (`f6fcebd`) :

```text
  ✘  14 [recette] › e2e/recette.spec.ts:486:5 › acte 4 [client] : découverte, fiche, refus direct, inscription depuis l’achat, achats, Mes billets, transfert (21.1s)
  1 failed
  4 did not run
  13 passed (53.1s)
```

Run 100 (`c532ca7`) :

```text
  ✘  15 [recette] › e2e/recette.spec.ts:615:5 › acte 5 [contrôleur] : activation, caisse, scan en ligne et hors ligne, ancien code, saisie manuelle, guichet, reprise, clôture (30.9s)
    Error: expect(locator).toBeVisible() failed
    Error: element(s) not found
    > 671 |         await expect(page.getByRole('heading', { name: new RegExp(`billet ${escapeRe(r.numbers.std2)}`, 'i') })).toBeVisible();
```

Run 101 (`86868ae`) :

```text
  ✘  16 [recette] › e2e/recette.spec.ts:727:5 › acte 6 [partenaire] : pilotage, rapport de clôture, export, retrait, remboursement d’un billet à l’écran (6.1s)
    Error: export : les billets de l’événement
    > 748 |         expect(await res.text(), 'export : les billets de l’événement').toContain('Standard');
```

Run 102 (`40e2473`) :

```text
  ✘  18 [recette] › e2e/recette.spec.ts:841:5 › acte 8 [admin] : supervision et relance d’une notification, remboursement bloqué relancé (A3), événement et partenaire suspendus (6.1m)
    Error: response.text: Target page, context or browser has been closed
```

Run 103 (`f4a66d0`) :

```text
  ✓  11 [recette] › e2e/recette.spec.ts:285:5 › acte 1 [admin] : délai de garde coupé à l’écran, motif exigé, historique ; un ADMIN est refusé (2.7s)
  ✓  12 [recette] › e2e/recette.spec.ts:323:5 › acte 2 [partenaire] [admin] : inscription avec pièces, validation, E1 et ses canaux, soumission, publication, E2 (8.8s)
  ✓  13 [recette] › e2e/recette.spec.ts:453:5 › acte 3 [partenaire] : invitation de K1, permission espèces, point d’entrée, PIN régisseur (2.0s)
  ✓  14 [recette] › e2e/recette.spec.ts:487:5 › acte 4 [client] : découverte, fiche, refus direct, inscription depuis l’achat, achats, Mes billets, transfert (17.3s)
  ✓  15 [recette] › e2e/recette.spec.ts:616:5 › acte 5 [contrôleur] : activation, caisse, scan en ligne et hors ligne, ancien code, saisie manuelle, guichet, reprise, clôture (17.3s)
  ✓  16 [recette] › e2e/recette.spec.ts:728:5 › acte 6 [partenaire] : pilotage, rapport de clôture, export, retrait, remboursement d’un billet à l’écran (5.5s)
  ✓  17 [recette] › e2e/recette.spec.ts:797:5 › acte 7 [client] [partenaire] : annulation de E2, envoyeur par la vraie route, billet remboursé, avis, bandeau public (2.3s)
  ✓  18 [recette] › e2e/recette.spec.ts:841:5 › acte 8 [admin] : supervision et relance d’une notification, remboursement bloqué relancé (A3), événement et partenaire suspendus (7.2s)
  18 passed (1.4m)
```

- Run 99 : acte 4, défaut réel de l'application, **A41** (8.3 d) : un visiteur sans compte ne pouvait pas commencer un achat.
- Run 100 : acte 5, le numéro du billet change au transfert (`ticket_transfer_accept` le renouvelle) ; la spec relit le numéro (`86868ae`).
- Run 101 : acte 6, l'export passe par `fetch` puis un lien de téléchargement ; la spec lit le fichier téléchargé (`40e2473`).
- Run 102 : acte 8, `/admin/users` ne lit pas le corps du PATCH de suspension ; la spec contrôle le statut et le badge (`f4a66d0`).
- Run 103 : 8 actes verts, mais job en échec par construction.

Les corrections de la spec n'ont retiré aucune assertion (messages de `0de9979`, `86868ae`, `40e2473`, `f4a66d0`) ; elles n'ont pas été relues ligne à ligne pour cette partie.

```text
$ git show --numstat f7d8c5d1
f7d8c5d1 test(8.3b): e2e/recette.spec.ts, les 8 actes du contrat 15.5 en mode serial sur la base du seed e2e, étiquetés [client], [partenaire], [contrôleur], [admin] : réglages du superadmin et refus  …
  +  912 -    0  e2e/recette.spec.ts
  +   10 -    0  e2e/support/fixtures.ts
  +  110 -    1  e2e/support/parcours.ts
  +   33 -    0  scripts/e2e/invariants-run.ts
$ git show --numstat 0de99790
0de99790 test(8.3b)[selecteurs]: e2e/recette.spec.ts relu pas à pas contre le JSX et les routes des actes 2 à 8 après le rouge du run 98. Acte 2 : le dossier ouvre « Valider la candidature » puis une  …
  +    7 -    7  e2e/recette.spec.ts
$ git show --numstat 86868aed
86868aed test(8.3b): l'acte 5 relit le numéro du billet après le transfert, que ticket_transfer_accept renouvelle (run 100 : « Aucun billet de cet événement ne porte ce numéro »). Lignes citées par la …
  +   14 -   14  docs/recette-billetterie.md
  +    2 -    0  e2e/recette.spec.ts
$ git show --numstat 40e2473d
40e2473d test(8.3b): l'acte 6 lit le fichier réellement téléchargé au lieu du corps de la réponse (run 101 : corps vide côté Playwright, l'écran passe par fetch puis un lien de téléchargement). Contrô …
  +   29 -   29  docs/recette-billetterie.md
  +    3 -    2  e2e/recette.spec.ts
$ git show --numstat f4a66d0c
f4a66d0c test(8.3b): l'acte 8 contrôle le statut du PATCH de suspension et le badge à l'écran au lieu de lire le corps (run 102 : suspension réussie à l'écran, mais /admin/users ne lit pas le corps de …
  +    5 -    1  e2e/recette.spec.ts
```

**Run 107, sortie brute des 8 actes et des quatre passages d'invariants**, (a) à (q) par la chaîne existante puis (r)(s)(t) par `[INVARIANT-RECETTE]` :

```text
  ✓  1 [recette] › e2e/recette.spec.ts:285:5 › acte 1 [admin] : délai de garde coupé à l’écran, motif exigé, historique ; un ADMIN est refusé (2.3s)
  ✓  2 [recette] › e2e/recette.spec.ts:323:5 › acte 2 [partenaire] [admin] : inscription avec pièces, validation, E1 et ses canaux, soumission, publication, E2 (7.2s)
  ✓  3 [recette] › e2e/recette.spec.ts:453:5 › acte 3 [partenaire] : invitation de K1, permission espèces, point d’entrée, PIN régisseur (1.5s)
[e2e][recette] avant les invariants recette-client : 349 ligne(s) envoyée(s) par la vraie route
[INVARIANT] recette-client — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] recette-client — purge des réservations échues : {"expired":0}
[INVARIANT] recette-client — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] recette-client — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] recette-client — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] recette-client — cron events_finish_overdue : 0 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] recette-client — (j)(k)(l) : 0 violation(s)
[INVARIANT-NOTIF] recette-client — envoyeur : 0 ligne(s) réservée(s), 0 reprise(s)
[INVARIANT-NOTIF] recette-client — (m)(n)(o) : 0 violation(s)
[INVARIANT-TERRAIN] recette-client — (p)(q) : 0 violation(s)
[INVARIANT-RECETTE] recette-client — (r)(s)(t) : 0 violation(s)
  ✓  4 [recette] › e2e/recette.spec.ts:487:5 › acte 4 [client] : découverte, fiche, refus direct, inscription depuis l’achat, achats, Mes billets, transfert (17.4s)
[e2e][recette] avant les invariants recette-controleur : 11 ligne(s) envoyée(s) par la vraie route
[INVARIANT] recette-controleur — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] recette-controleur — purge des réservations échues : {"expired":0}
[INVARIANT] recette-controleur — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] recette-controleur — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] recette-controleur — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] recette-controleur — cron events_finish_overdue : 0 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] recette-controleur — (j)(k)(l) : 0 violation(s)
[INVARIANT-NOTIF] recette-controleur — envoyeur : 0 ligne(s) réservée(s), 0 reprise(s)
[INVARIANT-NOTIF] recette-controleur — (m)(n)(o) : 0 violation(s)
[INVARIANT-TERRAIN] recette-controleur — (p)(q) : 0 violation(s)
[INVARIANT-RECETTE] recette-controleur — (r)(s)(t) : 0 violation(s)
  ✓  5 [recette] › e2e/recette.spec.ts:616:5 › acte 5 [contrôleur] : activation, caisse, scan en ligne et hors ligne, ancien code, saisie manuelle, guichet, reprise, clôture (16.9s)
[e2e][recette] avant les invariants recette-partenaire : 9 ligne(s) envoyée(s) par la vraie route
[INVARIANT] recette-partenaire — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] recette-partenaire — purge des réservations échues : {"expired":0}
[INVARIANT] recette-partenaire — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] recette-partenaire — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] recette-partenaire — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] recette-partenaire — cron events_finish_overdue : 0 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] recette-partenaire — (j)(k)(l) : 0 violation(s)
[INVARIANT-NOTIF] recette-partenaire — envoyeur : 0 ligne(s) réservée(s), 0 reprise(s)
[INVARIANT-NOTIF] recette-partenaire — (m)(n)(o) : 0 violation(s)
[INVARIANT-TERRAIN] recette-partenaire — (p)(q) : 0 violation(s)
```

Observations non bloquantes du même run, lues : des préchargements Next abandonnés, un 403 attendu sur `PUT /api/admin/finance-settings` (acte 1, un ADMIN est refusé), un 400 sur `POST /api/checkout` (acte 4, « refus direct »).

**Non prouvé par la recette.** Le parcours tourne contre le build et les faux services ; il ne prouve rien sur SamirPay, MTarget, un téléphone réel ou event-village-dev. C'est l'objet du cahier de recette manuelle (8.3 c).

### 8.3 c — Cahier de recette manuelle

Pas de test : 61 essais numérotés dans `docs/recette-billetterie.md`, section 7, rédigés pour un non-développeur, avec étapes, résultat attendu et case « OK / anomalie ». Aucun essai n'a été joué sur event-village-dev par les agents.

```text
$ git show --numstat 6f00501a
6f00501a docs(8.3c): cahier de recette manuelle ajouté à docs/recette-billetterie.md pour un non-développeur sur event-village-dev, 61 essais numérotés (ordinateur et téléphone), préparation, étapes,  …
  + 1065 -    1  docs/recette-billetterie.md
```

### 8.3 d — Anomalies corrigées

Tableau complet en section 12. Chaque anomalie corrigée a un test rouge puis vert, sauf mention.

#### A1 — Fausse sauvegarde sur `/admin/referral` (Élevée)

Origine : `discovery-8-recette.md`, section 4 : « Fausse sauvegarde, `app/admin/referral/page.tsx:366-372` ». Le bouton « Taux & Durée » et sa modale annonçaient une réussite sans aucun appel réseau.

```text
# run 95 (db21d1c, « avant ») — tests/parcours/admin-parrainage.test.ts
not ok 1 - chaque toast.success de app/admin/** a un appel réseau dans son gestionnaire
      error: réussite annoncée sans aucun appel réseau :
        app/admin/referral/page.tsx:369
not ok 1 - aucun texte de la modale factice ne reste à l’écran
      error: textes de la fausse personnalisation encore présents dans app/admin/referral/page.tsx : Enregistrer la personnalisation ; Les taux personnalisés ont bien été enregistrés ; Taux & Durée ; Taux N1 Client (%) ; Taux N2 Client (%) ; Taux N1 Prestataire (%) ; Taux  …
not ok 2 - plus aucun champ non contrôlé : la modale de saisie est retirée
      error: champs defaultValue (saisies écrites nulle part) encore présents : ligne 316, ligne 324, ligne 335, ligne 343, ligne 352
not ok 3 - la mention exacte du contrat est affichée
      error: 'mention absente de app/admin/referral/page.tsx : « La personnalisation des taux n’est pas disponible pour le moment. »'
# tests 16
# pass 12
# fail 4
# cancelled 0
# run 107 (bc864fa, « après », code final) — tests/parcours/admin-parrainage.test.ts
ok 1 - chaque toast.success de app/admin/** a un appel réseau dans son gestionnaire
ok 1 - aucun texte de la modale factice ne reste à l’écran
ok 2 - plus aucun champ non contrôlé : la modale de saisie est retirée
ok 3 - la mention exacte du contrat est affichée
# … 12 autre(s) sous-test(s) réussi(s)
# tests 16
# pass 16
# fail 0
# cancelled 0
```

```text
$ git show --numstat 3fa31edb
3fa31edb fix(8.3-A1): /admin/referral n'annonce plus une sauvegarde qui n'existait pas : le bouton « Taux & Durée » et sa modale, dont le toast de réussite ne suivait aucun appel réseau, sont retirés, …
  +    4 -   95  app/admin/referral/page.tsx
  (+ 1 trace(s) docs/lot8-logs/ non listée(s))
```

#### A2 — Lien de parrainage mort (Élevée)

Origine : `discovery-8-recette.md`, section 4 : « Lien mort, `my-stats/route.ts:117` ».

```text
# run 95 (db21d1c, « avant ») — tests/parcours/parrainage-lien.test.ts
not ok 1 - referralLink vaut exactement <NEXT_PUBLIC_APP_URL>/register?ref=<code>, code de la base
      error: Expected values to be strictly equal:
not ok 2 - le lien suit NEXT_PUBLIC_APP_URL (adresse du tunnel d’essai), sans « / » doublé
      error: Expected values to be strictly equal:
not ok 3 - deux comptes aux six mêmes derniers chiffres : chacun son code, et le filleul va au bon parrain
      error: le second compte voit son propre code, pas celui recalculé depuis le téléphone
not ok 4 - de bout en bout : le code lu dans le lien crée la relation et le parrain voit son filleul
      error: le lien ne mène pas à l’inscription : https://eventvillage.sn/r/EV-721081
# … 2 autre(s) sous-test(s) en échec retenu(s)
# crochet en échec :
not ok 3 - /home/runner/work/event-village/event-village/tests/parcours/parrainage-lien.test.ts
  schéma du lot 8 incomplet (parrainage-lien) : invariants (r)(s)(t) impossibles à vérifier :
  colonne public.ticket_categories.sale_online absente — canaux de vente (contrat 2.4, migration 20261106000001)
  colonne public.ticket_categories.sale_counter absente — canaux de vente (contrat 2.4, migration 20261106000001)
# tests 8
# pass 2
# fail 6
# cancelled 0
# run 107 (bc864fa, « après », code final) — tests/parcours/parrainage-lien.test.ts
ok 1 - referralLink vaut exactement <NEXT_PUBLIC_APP_URL>/register?ref=<code>, code de la base
ok 2 - le lien suit NEXT_PUBLIC_APP_URL (adresse du tunnel d’essai), sans « / » doublé
ok 3 - deux comptes aux six mêmes derniers chiffres : chacun son code, et le filleul va au bon parrain
ok 4 - de bout en bout : le code lu dans le lien crée la relation et le parrain voit son filleul
ok 1 - la route ne garde aucun domaine en dur et lit l’adresse par getServerEnv()
ok 2 - /register lit ?ref= dans le navigateur, préremplit le champ et ouvre les options
# … 2 autre(s) sous-test(s) réussi(s)
[INVARIANT-RECETTE] parrainage-lien — (r)(s)(t) : 0 violation(s)
# tests 8
# pass 8
# fail 0
# cancelled 0
```

`my-stats` lit `users.referral_code` au lieu de le recalculer, `/register` lit `?ref=` et ouvre « Plus d'options » (AM6) :

```text
$ git show --numstat b92928e1
b92928e1 fix(8.3-A2s): le lien de parrainage mène enfin à l'inscription, côté serveur (contrat 3.12, AM6). my-stats rend <NEXT_PUBLIC_APP_URL>/register?ref=<code> lu par getServerEnv(), et non plus un …
  +   30 -   23  app/api/referrals/my-stats/route.ts
$ git show --numstat 407d09c2
407d09c2 fix(8.3-A2e): le lien de parrainage parraine enfin : /register lit ?ref= dans le navigateur, comme redirect et sans useSearchParams, préremplit le code en majuscules, borné aux 64 caractères  …
  +   12 -    2  app/register/page.tsx
  (+ 2 trace(s) docs/lot8-logs/ non listée(s))
```

#### A3 — Remboursements à reprendre sans écran (Élevée)

Origine : `discovery-8-recette.md`, section 4 : « Relance d'un remboursement bloqué sans écran ».

```text
# run 95 (db21d1c, « avant ») — tests/parcours/admin-remboursements.test.ts
not ok 1 - sans session 401 ; client, partenaire, ADMIN sans la permission 403 ; SUSPENDU 403 ; avec la permission et SUPERADMIN 200
      error: "GET /api/admin/refunds absente : app/api/admin/refunds/route.ts (contrat 3.10, fix(8.3-A3s)) — Cannot find module '/home/runner/work/event-village/event-village/app/api/admin/refunds/route' imported from /home/runner/work/event-village/event-village/tests/par …
not ok 1 - périmètre exact : le nombre de lignes est celui de l’oracle, aucune opération hors périmètre
      error: "GET /api/admin/refunds absente : app/api/admin/refunds/route.ts (contrat 3.10, fix(8.3-A3s)) — Cannot find module '/home/runner/work/event-village/event-village/app/api/admin/refunds/route' imported from /home/runner/work/event-village/event-village/tests/par …
not ok 2 - refus de SamirPay : état ECHOUE, relance possible, titre de l’événement, numéro masqué
      error: "GET /api/admin/refunds absente : app/api/admin/refunds/route.ts (contrat 3.10, fix(8.3-A3s)) — Cannot find module '/home/runner/work/event-village/event-village/app/api/admin/refunds/route' imported from /home/runner/work/event-village/event-village/tests/par …
not ok 3 - issue incertaine : état INCERTAIN, jamais de relance
      error: "GET /api/admin/refunds absente : app/api/admin/refunds/route.ts (contrat 3.10, fix(8.3-A3s)) — Cannot find module '/home/runner/work/event-village/event-village/app/api/admin/refunds/route' imported from /home/runner/work/event-village/event-village/tests/par …
# … 11 autre(s) sous-test(s) en échec retenu(s)
# crochet en échec :
not ok 4 - /home/runner/work/event-village/event-village/tests/parcours/admin-remboursements.test.ts
  schéma du lot 8 incomplet (admin-remboursements) : invariants (r)(s)(t) impossibles à vérifier :
  colonne public.ticket_categories.sale_online absente — canaux de vente (contrat 2.4, migration 20261106000001)
  colonne public.ticket_categories.sale_counter absente — canaux de vente (contrat 2.4, migration 20261106000001)
# tests 15
# pass 0
# fail 15
# cancelled 0
# run 107 (bc864fa, « après », code final) — tests/parcours/admin-remboursements.test.ts
ok 1 - sans session 401 ; client, partenaire, ADMIN sans la permission 403 ; SUSPENDU 403 ; avec la permission et SUPERADMIN 200
ok 1 - périmètre exact : le nombre de lignes est celui de l’oracle, aucune opération hors périmètre
ok 2 - refus de SamirPay : état ECHOUE, relance possible, titre de l’événement, numéro masqué
ok 3 - issue incertaine : état INCERTAIN, jamais de relance
ok 4 - solde insuffisant : état BLOQUE, relance possible, motif en français
ok 5 - opérateur inconnu : état BLOQUE, relance impossible, aucun numéro ni événement à montrer
# … 9 autre(s) sous-test(s) réussi(s)
[INVARIANT-RECETTE] admin-remboursements — (r)(s)(t) : 0 violation(s)
# tests 15
# pass 15
# fail 0
# cancelled 0
```

Prouvé aussi à l'écran par l'acte 8 de la recette (« remboursement bloqué relancé (A3) », ci-dessus).

```text
$ git show --numstat 9a92e59c
9a92e59c fix(8.3-A3s): les remboursements à reprendre ont enfin une liste côté serveur (A3, contrat 3.10, L88). GET /api/admin/refunds?state=to_retry, permission refunds.manage, sert les REFUND, EVENT …
  +  156 -    0  app/api/admin/refunds/route.ts
$ git show --numstat 2506b89a
2506b89a fix(8.3-A3e): l'admin voit et relance enfin les remboursements en panne sur /admin/finance : RefundsToRetry lit GET /api/admin/refunds?state=to_retry, « Relancer » n'existe que sous can_retry …
  +  121 -  130  app/admin/finance/page.tsx
  +  304 -    0  components/admin/RefundsToRetry.tsx
  (+ 3 trace(s) docs/lot8-logs/ non listée(s))
$ git show --numstat 5a6dcbc3
5a6dcbc3 fix(8.3-A3e): une relance refusée en 403 n'affiche plus le nom technique de la permission que verifyAdminAuth met dans son message : RefundsToRetry écrit un texte français, comme à la lecture …
  +    3 -    1  components/admin/RefundsToRetry.tsx
```

#### A4 — Remboursement d'un billet sans écran (Élevée)

Origine : `discovery-8-recette.md`, section 4 : « route testée mais sans appelant ».

```text
# run 95 (db21d1c, « avant ») — tests/parcours/pilotage-remboursement-billet.test.ts  [sous-tests retenus : /A4/]
not ok 1 - propriétaire et ADMIN 200 ; autre partenaire, contrôleur, client 403 ; sans session 401
      error: "GET …/tickets/lookup absente : app/api/partner/events/[id]/tickets/lookup/route.ts (contrat 3.11, fix(8.3-A4s)) — Cannot find module '/home/runner/work/event-village/event-village/app/api/partner/events/[id]/tickets/lookup/route' imported from /home/runner/wo …
not ok 2 - partenaire SUSPENDU : 403 ACCOUNT_NOT_ACTIVE
      error: "GET …/tickets/lookup absente : app/api/partner/events/[id]/tickets/lookup/route.ts (contrat 3.11, fix(8.3-A4s)) — Cannot find module '/home/runner/work/event-village/event-village/app/api/partner/events/[id]/tickets/lookup/route' imported from /home/runner/wo …
not ok 3 - 404 TICKET_NOT_FOUND : numéro inconnu, autre événement du partenaire, billet d’autrui sur son propre événement
      error: "GET …/tickets/lookup absente : app/api/partner/events/[id]/tickets/lookup/route.ts (contrat 3.11, fix(8.3-A4s)) — Cannot find module '/home/runner/work/event-village/event-village/app/api/partner/events/[id]/tickets/lookup/route' imported from /home/runner/wo …
not ok 1 - billet payé en ligne : fiche exacte, mode CASHOUT, remboursable, rien de plus que le contrat
      error: "GET …/tickets/lookup absente : app/api/partner/events/[id]/tickets/lookup/route.ts (contrat 3.11, fix(8.3-A4s)) — Cannot find module '/home/runner/work/event-village/event-village/app/api/partner/events/[id]/tickets/lookup/route' imported from /home/runner/wo …
# … 8 autre(s) sous-test(s) en échec retenu(s)
# tests 12
# pass 0
# fail 12
# cancelled 0
# run 107 (bc864fa, « après », code final) — tests/parcours/pilotage-remboursement-billet.test.ts  [sous-tests retenus : /A4/]
ok 1 - propriétaire et ADMIN 200 ; autre partenaire, contrôleur, client 403 ; sans session 401
ok 2 - partenaire SUSPENDU : 403 ACCOUNT_NOT_ACTIVE
ok 3 - 404 TICKET_NOT_FOUND : numéro inconnu, autre événement du partenaire, billet d’autrui sur son propre événement
ok 1 - billet payé en ligne : fiche exacte, mode CASHOUT, remboursable, rien de plus que le contrat
ok 2 - billet payé en espèces : remboursé par l’organisateur, mode ORGANISATEUR
ok 3 - billet gratuit : mode AUCUN, rien à verser
# … 7 autre(s) sous-test(s) réussi(s) dans ce filtre
[INVARIANT-RECETTE] pilotage-remboursement-billet — (r)(s)(t) : 0 violation(s)
# tests 13
# pass 13
# fail 0
# cancelled 0
```

Au run 96, la partie écran était encore rouge (panneau pas encore livré) :

```text
# run 96 (8f77b1b) — tests/parcours/pilotage-remboursement-billet.test.ts  [sous-tests retenus : /écran|TicketRefundPanel|panneau|motif/]
not ok 1 - l’onglet Ventes monte TicketRefundPanel avec l’événement
      error: components/partner/pilotage/SalesTab.tsx n'importe pas TicketRefundPanel
        0 !== 1
not ok 2 - le panneau cherche par numéro, encodé, sur la route de recherche
      error: 'components/partner/pilotage/TicketRefundPanel.tsx absent (contrat 13.4, fix(8.3-A4e))'
not ok 3 - motif par ReasonDialog puis ConfirmDialog : le POST part du second seulement
      error: 'components/partner/pilotage/TicketRefundPanel.tsx absent (contrat 13.4, fix(8.3-A4e))'
not ok 4 - le motif est envoyé, et le mode et le montant sont lus sur la fiche
      error: 'components/partner/pilotage/TicketRefundPanel.tsx absent (contrat 13.4, fix(8.3-A4e))'
# tests 12
# pass 8
# fail 4
# cancelled 0
```

```text
$ git show --numstat c1eabd66
c1eabd66 fix(8.3-A4s): le pilotage peut retrouver un billet à rembourser par son numéro (A4, contrat 3.11, L89). GET /api/partner/events/[id]/tickets/lookup?number=TCK-… reprend les droits de la route …
  +  148 -    0  app/api/partner/events/[id]/tickets/lookup/route.ts
$ git show --numstat 18c69b8a
18c69b8a fix(8.3-A4e): le partenaire rembourse enfin un billet depuis l'onglet Ventes : TicketRefundPanel cherche le numéro, montre la fiche, demande le motif par ReasonDialog puis le montant et le mo …
  +   21 -    5  components/partner/pilotage/SalesTab.tsx
  +  334 -    0  components/partner/pilotage/TicketRefundPanel.tsx
  (+ 2 trace(s) docs/lot8-logs/ non listée(s))
```

#### A13 — Erreur du journal d'audit affichée comme liste vide (Moyenne)

Origine : `discovery-8-recette.md`, section 4 : « `app/admin/audit/page.tsx:47-50` affiche une liste vide sur erreur ». AM6 y ajoute la colonne Utilisateur.

```text
# run 95 (db21d1c, « avant ») — tests/parcours/admin-audit.test.ts
not ok 1 - ErrorState importé du système de design et rendu avec relance
      error: app/admin/audit/page.tsx n'importe pas ErrorState de @/components/ui/EmptyState
        0 !== 1
not ok 2 - la lecture échouée passe par l’état d’erreur, pour un refus HTTP comme pour une panne réseau
      error: 'app/admin/audit/page.tsx ne rend pas <ErrorState />'
not ok 3 - « Aucun enregistrement » n’est jamais affiché quand la lecture a échoué
      error: 'app/admin/audit/page.tsx ne rend pas <ErrorState />'
not ok 4 - la colonne Utilisateur de §134 est affichée
      error: "app/admin/audit/page.tsx : aucune colonne Utilisateur (§134), user_id n'est affiché nulle part"
# crochet en échec :
not ok 4 - /home/runner/work/event-village/event-village/tests/parcours/admin-audit.test.ts
  schéma du lot 8 incomplet (admin-audit) : invariants (r)(s)(t) impossibles à vérifier :
  colonne public.ticket_categories.sale_online absente — canaux de vente (contrat 2.4, migration 20261106000001)
  colonne public.ticket_categories.sale_counter absente — canaux de vente (contrat 2.4, migration 20261106000001)
# tests 12
# pass 8
# fail 4
# cancelled 0
# run 107 (bc864fa, « après », code final) — tests/parcours/admin-audit.test.ts
ok 1 - ErrorState importé du système de design et rendu avec relance
ok 2 - la lecture échouée passe par l’état d’erreur, pour un refus HTTP comme pour une panne réseau
ok 3 - « Aucun enregistrement » n’est jamais affiché quand la lecture a échoué
ok 4 - la colonne Utilisateur de §134 est affichée
# … 8 autre(s) sous-test(s) réussi(s)
[INVARIANT-RECETTE] admin-audit — (r)(s)(t) : 0 violation(s)
# tests 12
# pass 12
# fail 0
# cancelled 0
```

```text
$ git show --numstat 404d06a7
404d06a7 fix(8.3-A13): une lecture échouée du journal d'audit, refus HTTP comme panne réseau, ne se déguise plus en « Aucun enregistrement » : l'écran passe par ErrorState avec Réessayer et cache le c …
  +   27 -    9  app/admin/audit/page.tsx
  (+ 2 trace(s) docs/lot8-logs/ non listée(s))
```

#### A20 — Instabilité de la fumée au run 92 (Moyenne, outillage)

Premier commit du lot, seul (AR2) : `check({ force: true })` sur le radio masqué de la modale de paiement le jugeait parfois hors de l'écran. Pas de test rouge déterministe : le run 92 était rouge, les runs 93 et 94 verts sur le même commit.

Tableau des runs (`scratchpad/runs-table.txt`, construit par script à partir des `run.txt` de `ci-results`) :

```text
92-42066164370 | 7fdcb32 | failure | 1854s | 181:181ok 0ko | connexion OK · captures OK · emails OK · fumee ÉCHEC · terrain OK · pwa OK · perf OK
93-42066175040 | 7fdcb32 | success | 2727s | 181:181ok 0ko | connexion OK · captures OK · emails OK · fumee OK · terrain OK · pwa OK · perf OK
94-42242724246 | 7fdcb32 | success | 2041s | 181:181ok 0ko | connexion OK · captures OK · emails OK · fumee OK · terrain OK · pwa OK · perf OK
```

```text
$ git show --numstat ef2b36b7
ef2b36b7 test(e2e)[run 92]: fumée, instabilité du run 92 corrigée seule, premier commit du lot 8 : check({ force: true }) sur le radio masqué (sr-only) de la modale de paiement le jugeait parfois hors …
  +    5 -    1  e2e/fumee.spec.ts
```

#### A23 — Injection de formule dans l'export CSV, statut technique au refus du PDF (Moyenne)

Trouvée par les ports legacy (AM1). Rouges au run 95 :

```text
# run 95 (db21d1c, « avant ») — tests/parcours/legacy-exports-partenaire.test.ts
not ok 1 - titre et catégorie commençant par = ou @ : cellule de texte préfixée d’une apostrophe, montants toujours numériques
      error: titre neutralisé : le tableur ne doit pas l’évaluer
# tests 9
# pass 8
# fail 1
# cancelled 0
# run 107 (bc864fa, « après », code final) — tests/parcours/legacy-exports-partenaire.test.ts
ok 1 - titre et catégorie commençant par = ou @ : cellule de texte préfixée d’une apostrophe, montants toujours numériques
# … 8 autre(s) sous-test(s) réussi(s)
# tests 9
# pass 9
# fail 0
# cancelled 0
```

```text
# run 95 (db21d1c, « avant ») — tests/parcours/legacy-billet-pdf.test.ts
not ok 5 - T5 : billet ANNULE, REMBOURSEMENT_EN_COURS puis REMBOURSE → 400, aucun document
      error: `aucun statut brut dans le message : HTTP 400 application/json {"error":"Ce billet n'est plus valide (statut: ANNULE) et ne peut pas être téléchargé."}`
# tests 6
# pass 5
# fail 1
# cancelled 0
# run 107 (bc864fa, « après », code final) — tests/parcours/legacy-billet-pdf.test.ts
ok 5 - T5 : billet ANNULE, REMBOURSEMENT_EN_COURS puis REMBOURSE → 400, aucun document
# … 5 autre(s) sous-test(s) réussi(s)
# tests 6
# pass 6
# fail 0
# cancelled 0
```

```text
$ git show --numstat 1fa3fe9e
1fa3fe9e fix(8.3-A23): l'export comptable ne s'évalue plus dans un tableur et le refus du PDF de billet ne montre plus de statut technique (AM1). csvField préfixe d'une apostrophe tout champ de TEXTE  …
  +    1 -    1  app/api/tickets/[id]/pdf/route.ts
  +    7 -    2  lib/partner/partner-dashboard.service.ts
```

Le troisième volet d'AM1 (`lib/events/event-cancellation.service.ts:220`, statut brut à l'annulation) est dans `bf196db` (8.2 a) ; aucun test ne le cible nommément.

#### A29 — Alerte « bénéficiaire incomplet » pour un solde insuffisant (Moyenne)

Trouvée en relisant `fix(8.3-A3s)`. **Rouge non prouvé en CI** : le test (`2f79c3d`) et le correctif (`f2334de`) sont arrivés ensemble au run 96. Vert au run 107 :

```text
# run 107 (bc864fa, « après », code final) — tests/parcours/notif-modeles.test.ts  [sous-tests retenus : /A29/]
ok 4 - A29 : ADMIN_REFUND_TO_RETRY nomme le solde insuffisant, pas un bénéficiaire incomplet
# tests 22
# pass 22
# fail 0
# cancelled 0
```

```text
$ git show --numstat 2f79c3d6
2f79c3d6 test(8.3-A29): ADMIN_REFUND_TO_RETRY d'un remboursement bloqué pour solde insuffisant doit nommer le solde. Rouge : BLOCKED_REASON_LABELS n'a pas ce code, la notification annonce « informatio …
  +    8 -    0  tests/parcours/notif-modeles.test.ts
$ git show --numstat f2334def
f2334def fix(8.3-A29): la notification ADMIN_REFUND_TO_RETRY dit enfin « solde insuffisant » au lieu d'un bénéficiaire incomplet. BLOCKED_REASON_LABELS reçoit SOLDE_INSUFFISANT, même libellé que BLOCK …
  +    1 -    0  lib/notifications/catalog.ts
```

#### A35 — Texte du fournisseur SMS dans la réponse de `send-otp` (Faible)

Listée par AM12, passée en corrigée par AM13. Rouge au run 97 :

```text
# run 97 (621c804) — tests/parcours/otp-serveur.test.ts
not ok 2 - A35 : un refus du fournisseur SMS reste au journal, la réponse garde un texte fixe
      error: 'texte fournisseur à l’écran : Requête refusée par le fournisseur SMS (HTTP 400).'
# tests 4
# pass 3
# fail 1
# cancelled 0
# run 107 (bc864fa, « après », code final) — tests/parcours/otp-serveur.test.ts
ok 2 - A35 : un refus du fournisseur SMS reste au journal, la réponse garde un texte fixe
# … 3 autre(s) sous-test(s) réussi(s)
# tests 4
# pass 4
# fail 0
# cancelled 0
```

```text
$ git show --numstat 02e331f6
02e331f6 test(8.3-A35): un refus du fournisseur SMS ne doit plus arriver à l'écran. send-otp recopie sendResult.error dans sa réponse 502 (« Requête refusée par le fournisseur SMS (HTTP 400) »). Rouge …
  +   10 -    0  tests/parcours/otp-serveur.test.ts
$ git show --numstat 15dc7d09
15dc7d09 fix(8.3-A35): send-otp ne recopie plus le texte du fournisseur SMS dans sa réponse 502 (A35, rouge au run 97). Texte fixe en français, détail au journal seulement. LoginForm portait déjà un t …
  +    3 -    4  app/api/auth/send-otp/route.ts
```

#### A36 — Statut technique au refus de rembourser un billet utilisé (Faible)

`ticket_refund_request` écrit « Billet UTILISE : … » dans une migration gelée du lot 3 ; la route remplace ce message par un texte fixe. Rouge au run 97 :

```text
# run 97 (621c804) — tests/parcours/pilotage-remboursement-billet.test.ts  [sous-tests retenus : /A36/]
not ok 3 - A36 : refus du remboursement d’un billet utilisé, sans statut technique dans la réponse
      error: 'aucun statut technique dans le message'
# tests 13
# pass 12
# fail 1
# cancelled 0
# run 107 (bc864fa, « après », code final) — tests/parcours/pilotage-remboursement-billet.test.ts  [sous-tests retenus : /A36/]
ok 3 - A36 : refus du remboursement d’un billet utilisé, sans statut technique dans la réponse
[INVARIANT-RECETTE] pilotage-remboursement-billet — (r)(s)(t) : 0 violation(s)
# tests 13
# pass 13
# fail 0
# cancelled 0
```

```text
$ git show --numstat ef3e9fab
ef3e9fab test(8.3-A36): le refus de rembourser un billet utilisé ne doit plus montrer le statut technique. ticket_refund_request écrit « Billet UTILISE : … » (migration gelée du lot 3) et la route le  …
  +   17 -    0  tests/parcours/pilotage-remboursement-billet.test.ts
$ git show --numstat ffc01674
ffc01674 fix(8.3-A36): le refus de rembourser un billet utilisé ne montre plus le statut technique (A36, rouge au run 97). La route remplace le message de ticket_refund_request par un texte fixe pour  …
  +    7 -    1  app/api/partner/events/[id]/tickets/[ticketId]/refund/route.ts
```

#### A41 — Un visiteur sans compte ne pouvait pas commencer un achat (Élevée)

Trouvée par le parcours de recette au run 99 (AM15). Depuis le lot 3, le middleware refusait `POST /api/checkout/quote` sans session : la fiche affichait « Total indisponible » et le bouton d'achat ne venait jamais. Les tests appelaient la route sans le middleware, et la fumée achète connectée. Rouge, run 99, acte 4 :

```text
[e2e][recette] C1 — observations du navigateur (non bloquantes) :
erreur de console : Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:3000/api/checkout/quote)
requête en échec : 401 POST localhost:3000/api/checkout/quote
préchargement Next abandonné (non bloquant) : GET localhost:3000/events/9d28913f-a6e4-44d4-b130-80a9f3c0f040?_rsc=jyl0o : net::ERR_ABORTED (en-tête next-router-prefetch)
  ✘  14 [recette] › e2e/recette.spec.ts:486:5 › acte 4 [client] : découverte, fiche, refus direct, inscription depuis l’achat, achats, Mes billets, transfert (21.1s)
```

```text
  1) [recette] › e2e/recette.spec.ts:486:5 › acte 4 [client] : découverte, fiche, refus direct, inscription depuis l’achat, achats, Mes billets, transfert › inscription depuis l’achat : numéro, code, profil, retour sur la fiche

    TimeoutError: locator.click: Timeout 15000ms exceeded.
    Call log:
      - waiting for getByRole('button', { name: /^acheter 1 billet \(/i })


      514 |     await test.step('inscription depuis l’achat : numéro, code, profil, retour sur la fiche', async () => {
      515 |         await client.getByRole('button', { name: standard() }).click();
    > 516 |         await client.getByRole('button', { name: /^acheter 1 billet \(/i }).click();
```

Le test unitaire (`finance-affichage`, cas A41) a été écrit après ce run et committé avant le correctif, mais aucun run complet ne l'a vu rouge : les runs 99 à 103 ne jouaient pas `verify`. Vert au run 107, avec l'acte 4 :

```text
# run 107 (bc864fa, « après », code final) — tests/parcours/finance-affichage.test.ts  [sous-tests retenus : /A41/]
ok 1 - A41 : le middleware laisse passer le devis d’un visiteur sans session ; le paiement reste protégé
# tests 9
# pass 9
# fail 0
# cancelled 0
```

```text
  ✓  4 [recette] › e2e/recette.spec.ts:487:5 › acte 4 [client] : découverte, fiche, refus direct, inscription depuis l’achat, achats, Mes billets, transfert (17.4s)
```

`/api/checkout/quote` entre dans `PUBLIC_API_EXACT` ; `POST /api/checkout` reste protégé, le test le vérifie :

```text
$ git show --numstat 697f9ecf
697f9ecf test(8.3-A41): le devis d'un visiteur doit traverser le middleware. Rouge prouvé par le run 99, acte 4 de la recette : sur la fiche, un visiteur ajoute un billet et lit « Total indisponible,  …
  +    8 -    0  tests/parcours/finance-affichage.test.ts
$ git show --numstat c532ca7e
c532ca7e fix(8.3-A41): un visiteur sans compte peut enfin commencer un achat depuis la fiche. /api/checkout/quote, route publique du lot 3, entre dans PUBLIC_API_EXACT du middleware. POST /api/checkou …
  +    3 -    0  middleware.ts
```

---

## 3. Captures : écrans capturés, relecture par agents, corrections

**Au run 107 : 327 captures sur 327, 0 en échec**, sur 92 écrans (`docs/lot8-logs` ne contient pas l’index ; il est sur `ci-results`, `runs/107-42334500969/captures/index.txt`). L’artefact contient 347 images : les 327 captures d’écran et les 20 captures des emails (5 emails, 390 et 600 px, clair et sombre). En-tête de l’index, tel quel :

```text
EVENT VILLAGE — CAPTURES D’ÉCRAN (lot 5, tâche 5.1 ; lot 6, tâche 6.12 ; lot 7, tâche 7.7)
généré le      : 2026-11-07T04:10:28.071Z
run CI         : 107-42334500969 (bc864fadd072badff2df6c9310e50bedc13b5fac)
format         : <écran>__<mobile|ordinateur>__<clair|sombre>.png — mobile 390×844 DPR 2, ordinateur 1440×900 DPR 1
captures       : 327 / 327 tentative(s)
en échec       : 0 (contrôles bloquants ou erreur)
avertissements : 309 capture(s) concernée(s) (lot 7 : cibles < 44 px, textes < 14 px hors exemption et axe-core sont bloquants)
emails         : captures email-<id>__<390|600>__<clair|sombre>.png et résumé emails.txt (projet emails, tâche 7.9)
textes < 14 px : 0 hors exemption au total (détail sous chaque capture ; tableau : avertissements.tsv)
préchargements : 159 préchargement(s) Next abandonné(s), non bloquants, listés sous chaque capture (network.ts, lot 6)
Relecture humaine obligatoire : un écran n’est terminé qu’une fois sa capture relue (rapport du lot, section 3).
```

La dernière ligne de cet en-tête (« Relecture humaine obligatoire ») est le texte fixe du gabarit depuis le lot 5. **Au lot 8, aucune capture n’a été relue par un humain.** La consigne 8.2 u demandait une relecture humaine ; elle a été faite par des agents (L67), et c’est ainsi qu’elle est présentée ci-dessous. La relecture à l’œil reste à faire par vous.

**D’où viennent les 327 captures.** Le lot 7 finissait à 286 captures sur 80 écrans (`docs/lot7-logs/ci-run84-captures-index.txt`). Le lot 8 ajoute 12 écrans, soit 41 captures, et n’en retire aucun ; aucun écran existant ne change de nombre de vues. 286 + 41 = 327.

| Écran nouveau | Vues | Tâche (contrat 15.6) |
|---|---|---|
| `accueil-acces-refuse` | 4 | 8.2 j |
| `admin-remboursements-a-reprendre` | 4 | A3 |
| `admin-services-desactive` | 4 | 8.2 o |
| `dev-paiements` | 4 | 8.1, rendu statique (L75, hors tableau 15.6) |
| `evenement-identifiant-invalide` | 1 | 8.2 h (hors tableau 15.6) |
| `evenement-introuvable` | 4 | 8.2 h |
| `fiche-barre-achat` | 2 | 8.2 s |
| `partenaire-categorie-canaux` | 4 | 8.0 |
| `partenaire-categorie-invitations` | 4 | 8.0 |
| `partenaire-rapport-cloture` | 4 | 8.2 r |
| `pilotage-rembourser-billet` | 4 | A4 |
| `scanner-non-traite` | 2 | 8.2 e |

Le contrat 15.6 annonçait « environ 36 captures de plus » ; l’écart vient des deux écrans hors de son tableau (`dev-paiements`, 4 vues ; `evenement-identifiant-invalide`, 1 vue). `scanner-guichet` existait déjà : il est durci, sans vue de plus.

`dev-paiements` est un rendu statique de `FakePaymentPanel` sans serveur ni police de l’application : l’image sort en police à empattements et ne prouve rien sur la typographie (relevé client, `lot8-releve-captures.md`).

### 3.1 Relecture par agents, captures du run 98

Trois agents lecteurs ont relu les images du run 98 (`6ea04e4`), un par groupe ; un agent correcteur a ensuite relu chaque constat dans le code avant de le corriger (commit `dff5778`). Les relevés sont dans le scratchpad : `lot8-releve-captures-client.md`, `-partenaire.md`, `-terrain-admin.md`, et le bilan dans `lot8-releve-captures.md`. Ce que chaque agent dit avoir relu (`lot8-relecture-results.md`) :

- groupe client : 23 écrans, 87 images, plus `scanner-non-traite__mobile__sombre.png` ;
- groupe partenaire : 20 écrans, 80 images, « toutes ouvertes », plus les 2 images `scanner-non-traite` et un témoin des dates ;
- groupe terrain et admin : 22 écrans, 58 images, plus les 58 lignes de `avertissements.tsv`.

Les écrans corrigés au lot 7 font partie de ces groupes ; le bilan en cite plusieurs : `aide-transfert`, `pilotage-annulation`, `billet-hors-ligne-*`, `mes-billets`, `paiement-attente`, `partenaire-abonnement`, `pilotage-entrees`, `pilotage-apercu`, `scanner-a-encaisser`, `partenaire-inscription`, `admin-notifications-erreur`, `evenement-annule`. Je n’ai pas vérifié écran par écran que tous les écrans corrigés au lot 7 ont été ouverts.

**Décompte du bilan** (`lot8-releve-captures.md`, recopié) : 79 lignes de relevé, dont 19 À CORRIGER (le constat `scanner-non-traite` compte trois fois, soit 17 défauts distincts) et 60 MINEUR. Aucun BLOQUANT.

| Gravité | Corrigé | Partiel | Non réel | Laissé |
|---|---|---|---|---|
| À CORRIGER (19 lignes) | 17 | 0 | 0 | 2 |
| MINEUR (60 lignes) | 23 | 2 | 2 | 33 |

Les deux À CORRIGER laissés :
- **champs `datetime-local` en format américain** sur `partenaire-categorie-*` : écart documenté, section 3.4 ;
- **`caisse-cloture-ecart`** : image incohérente (55 000 enregistrés, 43 000 comptés, écart affiché de −2 000). Défaut de la capture, pas du produit ; corrigé ensuite dans la capture par `e7512f4` (« lit le montant enregistré au lieu de 43 000 en dur »).

Le message du commit `dff5778` annonce « 16 mineurs simples » ; le correcteur signale lui-même que le vrai chiffre est 23 MINEUR corrigés et 2 partiels, et que le bilan fait foi (`lot8-relecture-results.md`, section « corrections »).

### 3.2 Vérification des corrections sur les images du run 105

Un agent a relu les images du run 105 (`a03abe6`, 327 captures sur 327) contre le relevé, en comparant au run 98 (`scratchpad/rap8/verif-releve.md`). Méthode qu’il déclare : planches réduites (vues ordinateur réduites de 54 %), recadrages en taille réelle ; **les 347 images n’ont pas toutes été ouvertes** ; seules les vues d’écran sont relues, pas le bas des pages.

Sur les 40 lignes « corrigé » ou « partiel » du relevé qu’il a vérifiées : 38 défauts disparus, 2 partiels comme annoncé, 0 encore là. 6 de ces lignes disent qu’une partie de la correction n’est pas prouvée sur image (liste des commissions du portefeuille vide dans le jeu d’essai, mention de `paiement-succes` hors de la vue, carte `pilotage-remboursements` sous la vue à 390 px, `MapPicker` jamais capturé, cinquième formulation du jargon non capturée, décimales du tableau `admin-remboursements-a-reprendre` sous la vue).

Lignes laissées que le bilan demandait de relire, telles quelles :

| Écran | Constat d'origine | État au run 105 | Gravité si encore là |
|---|---|---|---|
| `partenaire-categorie-*` | Champs `datetime-local` en format américain | Encore là. `mm/dd/yyyy, --:-- --` et `10/26/2026, 01:42 AM`, m c et s, o c et s. Dans le même run, les champs `date` de `admin-notifications` affichent `dd/mm/yyyy`, m c, o c et s. Le contrôle ne lit que le premier `input[type="date"]`, d'après le bilan. | À CORRIGER, écart à documenter |
| `caisse-cloture-ecart` | Image incohérente (55 000, 43 000, -2 000) | Disparu. m s et o s : 55 000 enregistrés, 53000 comptés, écart de -2 000 ; 43000 au 98. | |
| `pilotage-entrees` | « Encaisse-ments en attente » | Encore là en m c et s : « Encaisse- / ments en / attente », comme au 98. o c et s : « Encaissements en / attente », mot entier. | MINEUR |
| `pilotage-caisse` | Montant sur 2 lignes | Disparu. « 120 000 F CFA » sur une ligne, m c et s ; deux lignes au 98. | |
| T2 bis, `pilotage-caisse`, `pilotage-equipe` | Onglet voisin qui paraît actif (classé non réel) | Encore visible sur l'image : trait gris sous « Clôture » (`pilotage-caisse`, m c et s) et « Caisse » (`pilotage-equipe`, m c), comme au 98 sur `pilotage-caisse`. La relecture l'attribue à `hover:` sous le pointeur de capture ; le doigt n'est pas testé. | MINEUR, à reconfirmer |

**Défauts nouveaux vus au run 105** (comparés au run 98 sur la même vue ; aucun BLOQUANT), tels quels :

| Écran | Vue | Défaut | Gravité |
|---|---|---|---|
| `partenaire-edition` | m c et s | « Titre, dates, heures, lieu, ville et adresse / : les détenteurs de billets sont prévenus. » : le deux-points ouvre la ligne. Au 98 : « adresse : les détenteurs ». La colonne élargie par T3 déplace la coupure. o c : sur une ligne, sans défaut. Espace ordinaire avant le deux-points, `components/events/EventForm.tsx:731`. | À CORRIGER, même classe que le constat d'`aide-transfert` |
| `scanner-a-encaisser` | m s, o s | Le deux-points ouvre la ligne du montant : « Encaissement / requis / : 5 000 F CFA » à 390 px, sur trois lignes ; « Encaissement requis / : 5 000 F CFA » sur ordinateur. Au 98, aux deux tailles : « Encaissement / requis : 5 000 F CFA ». Espace ordinaire, `components/scan/CombatFlashOverlay.tsx:89`. Le montant reste lisible. | À CORRIGER, même classe |
| `caisse-cloture-ecart` | m s | « Justifiez l'écart / ; le régisseur co-signe… » : le point-virgule ouvre la ligne. Au 98 : « l'écart ; / le régisseur ». o s : sur une ligne, sans défaut. Espace ordinaire, `components/shifts/ShiftModals.tsx:267`. | À CORRIGER, même classe |
| `fiche-barre-achat` | m c | Pavé gris derrière la croix de la bulle, dont l'angle bas droit, carré, sort de l'arrondi. Absent en m s et au 98 clair. `app/globals.css:563-566` donne ce fond à l'état `:hover` : cause probable, le pointeur de capture, non prouvée. | MINEUR, à reconfirmer au doigt |
| `mes-billets` | o c et s | Le QR descend sous le pli : 38 px visibles sur 900, contre 112 au 98 (premier pavé de masque à y=862 au 105, y=788 au 98, mesure sur les pixels). Annoncé par la relecture. | MINEUR |
| `billet-hors-ligne-*` | m c et s | Dans le même encadré, « Une capture d'écran… » reste centré, « Sans téléphone… » passe à gauche. | MINEUR |
| `scanner-guichet` | m s | Le bouton « J'ai reçu 5 000 F CFA : valider la… » passe sur 2 lignes et sa seconde ligne sort de la vue, à faire défiler ; sur une ligne au 98. Le point médian reste seul en fin de ligne (« 5 000 F CFA · / 128 disponibles »), sur les trois catégories. | MINEUR |
| `portefeuille`, `partenaire-finances` | m c, o s | Deux noms pour la même somme : « À compenser » côté client, « Créance » côté partenaire (`app/partner/finance/page.tsx:519`). La correction n'a touché que le portefeuille. | MINEUR |

**Le document de vérification est incomplet à un endroit** : sa dernière section, « Non prouvé », ne contient que le mot `A_RELIRE`, laissé tel quel. Ce qui n’est pas prouvé est donc dit ligne par ligne dans ses tableaux, pas résumé.

### 3.3 Corrections après la vérification : `bc864fa`, et ce qui a été revu au run 107

Les trois défauts nouveaux classés À CORRIGER (ponctuation seule en début de ligne) et le doublon « Créance » / « À compenser » sont corrigés par `bc864fa`, trace `ORCH-003`. Diff des fichiers d’application, tel quel (les lignes « + » de `EventForm.tsx` et de `ShiftModals.tsx` contiennent `&nbsp;` ; la ligne de `CombatFlashOverlay.tsx` contient le caractère U+00A0 avant « : », invisible ici, vérifié par `od -c` : octets `302 240`) :

```text
# git show bc864fa -- app components (lignes de diff seulement)
diff --git a/app/partner/finance/page.tsx b/app/partner/finance/page.tsx
-                                    label="Créance"
+                                    label="À compenser"
diff --git a/components/events/EventForm.tsx b/components/events/EventForm.tsx
-                        <li>Titre, dates, heures, lieu, ville et adresse : les détenteurs de billets sont prévenus.</li>
+                        <li>Titre, dates, heures, lieu, ville et adresse&nbsp;: les détenteurs de billets sont prévenus.</li>
diff --git a/components/scan/CombatFlashOverlay.tsx b/components/scan/CombatFlashOverlay.tsx
-            return amountDue !== undefined ? `Encaissement requis : ${formatFcfa(amountDue)}` : LOOKS.a_encaisser.title;
+            return amountDue !== undefined ? `Encaissement requis : ${formatFcfa(amountDue)}` : LOOKS.a_encaisser.title;
diff --git a/components/shifts/ShiftModals.tsx b/components/shifts/ShiftModals.tsx
-                            Justifiez l’écart ; le régisseur co-signe la clôture avec son code PIN.
+                            Justifiez l’écart&nbsp;; le régisseur co-signe la clôture avec son code PIN.
```

Le run 107 porte ce commit. **Aucun agent n’a refait de relecture complète des images du run 107.** L’agent qui rédige cette partie a ouvert six images du run 107, pas davantage :

| Image du run 107 | Lu sur l’image |
|---|---|
| `partenaire-edition__mobile__clair.png` | « Titre, dates, heures, lieu, ville et / adresse : les détenteurs de billets sont / prévenus. » : le deux-points ne commence plus la ligne |
| `scanner-a-encaisser__mobile__sombre.png` | « Encaissement / requis : / 5 000 F CFA » : le deux-points reste avec « requis » |
| `caisse-cloture-ecart__mobile__sombre.png` | « Justifiez / l’écart ; le régisseur co-signe… » : le point-virgule reste avec « l’écart » ; 55 000 enregistrés, 53000 comptés, « Écart de -2 000 F CFA » |
| `partenaire-finances__ordinateur__sombre.png` | carte « À compenser », « Aucune somme à compenser. » |
| `partenaire-categorie-canaux__mobile__clair.png` | champ « Fin de la vente » : `mm/dd/yyyy, --:-- --` (écart 3.4, toujours là) |
| `cloche-ouverte__ordinateur__clair.png` | masques magenta décalés sur le panneau des notifications, deux vrais QR codes visibles en bas des cartes de billet |

Les autres vues de ces six écrans n’ont pas été ouvertes au run 107 (en particulier les vues ordinateur des trois premiers) : NON VÉRIFIÉ.

**Images à ne pas remettre au client en l’état :**
- `cloche-ouverte__ordinateur__clair.png` et `__sombre.png` : le masque se décale et un vrai QR reste à l’écran sous le panneau (`verif-releve.md`, « Vus, déjà là au run 98 » ; revu au run 107 sur la vue claire, ci-dessus). Défaut de la capture, pas du produit, non corrigé ;
- `partenaire-categorie-canaux` et `partenaire-categorie-invitations` (8 images) : format de date américain, à expliquer si elles sont montrées (3.4) ;
- `dev-paiements` (4 images) : police de repli, sans valeur sur la typographie ;
- `caisse-cloture-ecart` du run 98 : incohérente ; celles des runs 105 et 107 ne le sont plus (53000 comptés, écart de −2 000).

Autres défauts de capture déjà présents au run 98, vus au run 105 et non corrigés (`verif-releve.md`) : texte d’exemple coupé sur `mot-de-passe-oublie` et `admin-campagnes` à 390 px, affiches recadrées sur `partenaire-evenements` (o c), pavé de masque sur l’en-tête de `billet-hors-ligne-disponible` et `-a-telecharger`, « à / 18:00 » coupé sur `billet-hors-ligne-*` (o c et s).

### 3.4 Format de date américain des champs `datetime-local` (8.2 t, écart documenté)

Réglages des captures (`playwright.config.ts`, lus dans le dépôt) : `locale: 'fr-FR'` et `timezoneId: 'Africa/Dakar'` pour tous les projets ; pour les projets `mobile` et `desktop` seulement, le drapeau Chromium `--enable-blink-features=LangAttributeAwareFormControlUI` (L66, `playwright.config.ts:36`), pour que les champs suivent l’attribut `lang` de la page.

- **Champs `type="date"` : en français.** Le contrôle lit par CDP le gabarit du premier `input[type="date"]` de `admin-notifications` et exige `dd/mm/yyyy` (`e2e/support/screens.ts:270-282`, branché par `actions: expectFrenchDateField`, `:602`). Les 4 vues d’`admin-notifications` passent aux runs 95 et 107 (aucune capture en échec au run 107 ; 4 ✓ au run 95). La vérification du run 105 lit aussi `dd/mm/yyyy` sur ces champs.
- **Champs `type="datetime-local"` : toujours en américain sous le Chromium Linux de la CI.** `components/events/EventTicketing.tsx:270,280` (début et fin de la vente d’une catégorie). Images des runs 98, 105 et 107 : `mm/dd/yyyy, --:-- --` et, rempli, `10/26/2026, 01:42 AM` (run 105). Le contrôle CDP ne lit que le premier `input[type="date"]` : il ne voit pas ces champs.
- **Mesure sur le poste (agent correcteur, `lot8-releve-captures.md`)** : sous Windows, le Chromium de Playwright affiche `25/10/2026 23:07` avec `locale: 'fr-FR'`, avec `--lang=fr` et avec le drapeau. Le défaut n’est donc vu qu’en CI, sous Linux. Je n’ai pas établi pourquoi le drapeau agit sur `date` et pas sur `datetime-local` sous Linux : NON ÉTABLI.
- **Pourquoi l’écart est gardé** : c’est un champ natif. Un navigateur réglé en anglais affichera de toute façon son propre format, et un composant de saisie maison coûterait le sélecteur natif du téléphone. Le contrat 11.4 admet une explication documentée.
- **Ce que cela veut dire pour le client** : les captures CI de `partenaire-categorie-*` ne montrent pas ce que verra un partenaire dont le téléphone est en français ; ce rendu-là n’a été vu que sous Windows, par un agent.

### 3.5 Écrans existants dont l’aspect change au lot 8

Liste établie depuis les commits et les bilans des agents ; chaque ligne cite sa source. Les écrans nouveaux sont au tableau ci-dessus.

| Écran | Ce qui change | Source |
|---|---|---|
| presque tous (boutons, titres) | mots des boutons séparés (`tracking-tight` retiré, `word-spacing` 0,1 em, 0,12 em pour les titres) | `dff5778` |
| tout écran à montants, compteurs, heures, téléphones | `font-mono` réservé aux numéros de billets, références et codes ; `tabular-nums` ailleurs (8.2 q) | `f9cc0c8`, `e4995c0`, `b57441c` |
| `evenement-publie` et fiche événement | barre d’achat fixe en bas de l’écran (8.2 s), collée à la navigation (53 px plus la zone sûre) ; carte : zoom en bas à gauche, mention lisible en sombre, sans drapeau Leaflet | `bb2cd0c`, `dff5778` |
| `mes-billets`, `billet-hors-ligne-*` | visuel au ratio 16/9 (le QR descend de 25 px sur mobile, de 76 px sur ordinateur) ; « Catégorie » au lieu de « Emplacement » ; texte aligné à gauche | `dff5778` |
| `aide-transfert` | « Comment marche le transfert ? », espaces insécables | `dff5778` |
| `portefeuille` | plus de « N1 » ni « N2 » ; carte « À compenser » ; phrase du retrait réécrite | `dff5778` |
| `partenaire-finances` | « À compenser » au lieu de « Créance » | `bc864fa` |
| `scanner-*` (plein écran) | `not_processed` : « Aucune entrée enregistrée. » sous le titre ; barre du scanner sur deux lignes au plus ; « Résultat retrouvé » masqué pour un incident | `dff5778`, `4cc9959` |
| `scanner-a-encaisser` | deux-points insécable | `bc864fa` |
| `scanner-guichet` | mention « Sur place uniquement » ; « 128 disponibles » tenu ensemble | `2f9f4b1`, `dff5778` |
| `caisse-cloture-ecart` | point-virgule insécable ; capture qui lit le montant enregistré | `bc864fa`, `e7512f4` |
| `caisse-ticket-z` | boutons pleine largeur sur mobile | `dff5778` |
| `partenaire-edition` | deux-points insécable ; gouttière unique | `bc864fa`, `dff5778` |
| pages partenaire (tableau de bord, événements, finances, abonnement, équipe, édition, création) | double gouttière retirée : colonne à 16 px du bord sur mobile, jusqu’à 48 px de plus sur ordinateur | `dff5778` |
| `pilotage-*` | grilles au nombre de cartes ; « Vente : Arrêtée » sur un événement annulé ; jargon retiré (« validés sur place ») ; carte « Montant net organisateur » sans « commissions déduites » | `dff5778`, `e96dab4` |
| `pilotage-cloture` | une colonne sous `sm`, 3 colonnes sur grand écran | `dff5778` |
| `partenaire-tableau-de-bord` | plus de commission à 0 en dur ; rapport de clôture réécrit (« Rapport de clôture », « Généré le », « Entrées ») | `ae66fbf`, `82ca88d`, `a7b4539` |
| `partenaire-categorie-*` | cases « Vendue en ligne », « Vendue au guichet », résumé « Résultat : … » ; « Catégorie active » au lieu de « En vente » | `2f9f4b1`, `dff5778` |
| `partenaire-equipe` | titre d’événement à la ligne, loupe retirée | `dff5778` |
| `partenaire-inscription` | exemples sans nom de société réelle | `dff5778` |
| `pilotage-ventes` | libellé de canal sous le nom de catégorie ; panneau de remboursement d’un billet | `2f9f4b1`, `18c69b8` |
| `accueil`, `connexion` | message des redirections `?error=unauthorized_*` ; onglet actif cerné en sombre | `161697f`, `dff5778` |
| `cloche-ouverte` | pastille visible sur une notification non lue | `dff5778` |
| `paiement-attente`, `-succes`, `-echec` | échéance avec la date ; texte aligné ; « ci-dessous » insécable | `dff5778` |
| `evenement-suspendu`, `evenement-publie` | heure insécable (« à 16:00 ») | `dff5778` |
| `admin-notifications` | « heure de Dakar », pluriel accordé | `dff5778` |
| `admin-evenements` | écart après « Soumis le » | `dff5778` |
| `evenement-non-public` | vrai 404 HTTP (8.2 h) | voir section 2 |

Les hachés courts sont ceux de `git log --format=%h 7fdcb32..HEAD` (`scratchpad/rap8/commits.tsv`, régénéré pour cette partie).

---

---

## 4. Requêtes des invariants et leur sortie

**(a) à (o).** Requêtes des lots 2 à 6, inchangées ; recopiées dans `docs/lot6-rapport.md`, section 4.

**(p)(q).** Requête du lot 7, `tests/helpers/terrain-invariants.ts`, recopiée dans `docs/lot7-rapport.md`, section 4. Le fichier ne change pas au lot 8 (AR2) : `git diff --stat 7fdcb32..HEAD -- tests/helpers/terrain-invariants.ts` ne renvoie rien.

**(r)(s)(t).** Requête du lot 8, `tests/helpers/recette-invariants.ts:34-107`, identique au contrat 14.2. Elle est exécutée en lecture seule (`inspect`, transaction READ ONLY) sur toute la base locale, après (a) à (q) et après un contrôle du schéma qui nomme chaque colonne, trigger ou fonction absent (`missingRecetteSchema`).

- (r) commissions non annulées d’un paiement ≤ son revenu net (r1), et restant ≤ net effectif après remboursements (r2) ; un net NULL avec commission est une violation (L39) ;
- (s) aucun couple de paiements conservés pour le même panier (s1, oracle écrit à part : `payment_duplicate_of` n’est pas appelée) ; tout paiement marqué `duplicate_of` est remboursé en entier, sans billet ni crédit (s2) ;
- (t) aucun billet sans décision de vente (t0), aucun billet ONLINE ou FREE d’une catégorie non vendue en ligne à l’achat (t1), aucun COUNTER d’une catégorie non vendue au guichet (t2), `is_visible` miroir de `sale_online` (t3), décision d’un billet payé en ligne égale à sa réservation (t4).

```sql
WITH cm AS (
    SELECT payment_id,
           sum(amount) FILTER (WHERE kind = 'COMMISSION' AND status <> 'CANCELLED') AS brut,
           sum(amount) FILTER (WHERE status <> 'CANCELLED') AS effectif
      FROM public.referral_commissions GROUP BY payment_id
),
r1 AS (
    SELECT 'r'::text AS regle, cm.payment_id::text AS objet,
           format('commissions %s > revenu net %s', cm.brut, p.net_event_village_revenue) AS detail
      FROM cm LEFT JOIN public.payments p ON p.id = cm.payment_id
     WHERE cm.brut > 0 AND (p.id IS NULL OR p.net_event_village_revenue IS NULL
                            OR cm.brut > p.net_event_village_revenue)
),
r2 AS (
    SELECT 'r', cm.payment_id::text,
           format('commissions restantes %s > net effectif %s', cm.effectif, p.net_event_village_revenue - p.refunded_net_revenue)
      FROM cm JOIN public.payments p ON p.id = cm.payment_id
     WHERE cm.effectif > GREATEST(p.net_event_village_revenue - p.refunded_net_revenue, 0)
),
paniers AS (
    SELECT payment_id, array_agg(category_id::text || ':' || quantity ORDER BY category_id::text) AS panier
      FROM public.stock_reservations GROUP BY payment_id
),
gardes AS (
    SELECT p.id, p.client_id, p.event_id, p.created_at, p.paid_at, c.panier
      FROM public.payments p JOIN paniers c ON c.payment_id = p.id
     WHERE p.payment_target = 'TICKET' AND p.is_platform_payment AND p.status IN ('SUCCESS', 'PARTIAL')
),
s1 AS (
    SELECT 's', a.id::text || '/' || b.id::text, 'deux paiements conservés pour le même panier'
      FROM gardes a JOIN gardes b
        ON a.id < b.id AND a.client_id = b.client_id AND a.event_id = b.event_id AND a.panier = b.panier
     WHERE a.created_at < b.paid_at AND b.created_at < a.paid_at
),
doubles AS (SELECT * FROM public.payments WHERE metadata ? 'duplicate_of'),
s2 AS (
    SELECT 's', d.id::text, 'paiement en double au statut ' || d.status FROM doubles d
     WHERE d.status NOT IN ('REFUND_PENDING', 'REFUNDED')
    UNION ALL SELECT 's', d.id::text, 'paiement en double avec billets' FROM doubles d
     WHERE EXISTS (SELECT 1 FROM public.tickets t WHERE t.payment_id = d.id)
    UNION ALL SELECT 's', d.id::text, 'paiement en double sans remboursement du total' FROM doubles d
     WHERE NOT EXISTS (SELECT 1 FROM public.refunds r JOIN public.cashouts c ON c.refund_id = r.id
                        WHERE r.payment_id = d.id AND r.settlement = 'PLATEFORME' AND r.amount = d.amount)
    UNION ALL SELECT 's', d.id::text, 'paiement en double crédité' FROM doubles d
     WHERE EXISTS (SELECT 1 FROM public.finance_ledger l WHERE l.source_key = 'VENTE-' || d.id::text)
        OR EXISTS (SELECT 1 FROM public.referral_commissions c WHERE c.payment_id = d.id AND c.status <> 'CANCELLED')
),
t AS (SELECT * FROM public.tickets),
t0 AS (
    SELECT 't'::text, t.id::text, 'billet sans décision de vente' FROM t WHERE t.sale_decision->>'source' = 'SANS_DECISION'
),
t1 AS (
    SELECT 't', t.id::text, 'billet ' || t.sale_channel || ' d''une catégorie non vendue en ligne au moment de l''achat'
      FROM t WHERE t.sale_channel IN ('ONLINE', 'FREE') AND t.sale_decision->>'source' <> 'REPRISE'
       AND COALESCE((t.sale_decision->>'sale_online')::boolean, FALSE) IS NOT TRUE
),
t2 AS (
    SELECT 't', t.id::text, 'billet COUNTER d''une catégorie non vendue au guichet au moment de la vente'
      FROM t WHERE t.sale_channel = 'COUNTER' AND t.sale_decision->>'source' <> 'REPRISE'
       AND COALESCE((t.sale_decision->>'sale_counter')::boolean, FALSE) IS NOT TRUE
),
t3 AS (
    SELECT 't', c.id::text, 'is_visible et sale_online divergent'
      FROM public.ticket_categories c WHERE c.is_visible IS DISTINCT FROM c.sale_online
),
t4 AS (
    SELECT 't', t.id::text, 'billet payé en ligne dont la décision ne vient pas de sa réservation'
      FROM t JOIN public.stock_reservations r ON r.payment_id = t.payment_id AND r.category_id = t.category_id
     WHERE t.sale_channel = 'ONLINE' AND t.sale_decision->>'source' <> 'REPRISE'
       AND (t.sale_decision->>'sale_online')::boolean IS DISTINCT FROM r.sale_online_at_checkout
)
SELECT * FROM r1 UNION ALL SELECT * FROM r2 UNION ALL SELECT * FROM s1 UNION ALL SELECT * FROM s2
UNION ALL SELECT * FROM t0 UNION ALL SELECT * FROM t1 UNION ALL SELECT * FROM t2 UNION ALL SELECT * FROM t3
UNION ALL SELECT * FROM t4 ORDER BY 1, 2
```

**Sortie au run 107, `npm run verify` : 18 suites appellent `assertRecetteInvariants`, 0 violation dans chacune** (`docs/lot8-logs/ci-run107-verify.log`, lignes 2041 à 22068, ordre du journal) :

```text
[INVARIANT-RECETTE] admin-audit — (r)(s)(t) : 0 violation(s)
[INVARIANT-RECETTE] admin-remboursements — (r)(s)(t) : 0 violation(s)
[INVARIANT-RECETTE] canaux-invariant — (r)(s)(t) : 0 violation(s)
[INVARIANT-RECETTE] canaux-vente — (r)(s)(t) : 0 violation(s)
[INVARIANT-RECETTE] commissions-plafond — (r)(s)(t) : 0 violation(s)
[INVARIANT-RECETTE] course-confirmation-annulation — (r)(s)(t) : 0 violation(s)
[INVARIANT-RECETTE] double-paiement — (r)(s)(t) : 0 violation(s)
[INVARIANT-RECETTE] essai-seed-dev — (r)(s)(t) : 0 violation(s)
[INVARIANT-RECETTE] essai-simule — (r)(s)(t) : 0 violation(s)
[INVARIANT-RECETTE] evenement-404 — (r)(s)(t) : 0 violation(s)
[INVARIANT-RECETTE] messages-bruts — (r)(s)(t) : 0 violation(s)
[INVARIANT-RECETTE] notif-abonnement — (r)(s)(t) : 0 violation(s)
[INVARIANT-RECETTE] parrainage-lien — (r)(s)(t) : 0 violation(s)
[INVARIANT-RECETTE] partenaire-profil-rpc — (r)(s)(t) : 0 violation(s)
[INVARIANT-RECETTE] pilotage-remboursement-billet — (r)(s)(t) : 0 violation(s)
[INVARIANT-RECETTE] recette-invariant — (r)(s)(t) : 0 violation(s)
[INVARIANT-RECETTE] scan-renvoi-seulement — (r)(s)(t) : 0 violation(s)
[INVARIANT-RECETTE] migration-lot8-rejouable — (r)(s)(t) : 0 violation(s)
```

**Seed de démonstration au run 107** (`e2e-seed.log:223-233`, sur `ci-results`, `runs/107-42334500969/e2e-seed.log`) :

```text
[INVARIANT] seed-demo — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] seed-demo — purge des réservations échues : {"expired":0}
[INVARIANT] seed-demo — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] seed-demo — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] seed-demo — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] seed-demo — cron events_finish_overdue : 0 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] seed-demo — (j)(k)(l) : 0 violation(s)
[INVARIANT-NOTIF] seed-demo — envoyeur : 0 ligne(s) réservée(s), 0 reprise(s)
[INVARIANT-NOTIF] seed-demo — (m)(n)(o) : 0 violation(s)
[INVARIANT-TERRAIN] seed-demo — (p)(q) : 0 violation(s)
[INVARIANT-RECETTE] seed-demo — (r)(s)(t) : 0 violation(s)
```

**Parcours de recette au run 107** (`docs/lot8-logs/ci-run107-e2e.log`) : quatre passages, un par rôle, chacun précédé d’un passage de l’envoyeur par la vraie route (L79) :

```text
750: [e2e][recette] avant les invariants recette-client : 349 ligne(s) envoyée(s) par la vraie route
761: [INVARIANT-RECETTE] recette-client — (r)(s)(t) : 0 violation(s)
763: [e2e][recette] avant les invariants recette-controleur : 11 ligne(s) envoyée(s) par la vraie route
774: [INVARIANT-RECETTE] recette-controleur — (r)(s)(t) : 0 violation(s)
776: [e2e][recette] avant les invariants recette-partenaire : 9 ligne(s) envoyée(s) par la vraie route
787: [INVARIANT-RECETTE] recette-partenaire — (r)(s)(t) : 0 violation(s)
791: [e2e][recette] avant les invariants recette-admin : 13 ligne(s) envoyée(s) par la vraie route
802: [INVARIANT-RECETTE] recette-admin — (r)(s)(t) : 0 violation(s)
```

Les quatre libellés attendus par l’agent e2e (`recette-client`, `recette-controleur`, `recette-partenaire`, `recette-admin`) y sont, à 0 violation.

**Au run 95 (« avant »)**, aucune ligne `(r)(s)(t) : … violation(s)` n’apparaît (`grep` : 0 occurrence dans `ci-run95-verify.log`) : le schéma du lot n’était pas livré, et chaque appel s’arrêtait sur le contrôle du schéma, en nommant les 8 objets absents. Exemple, `recette-invariant` :

```text
# run 95 (db21d1c, « avant ») — docs/lot8-logs/ci-run95-verify.log:29681-29690
[INVARIANT-RECETTE] recette-invariant — schéma du lot 8 incomplet : 8 objet(s) manquant(s)
[INVARIANT-RECETTE]   colonne public.ticket_categories.sale_online absente — canaux de vente (contrat 2.4, migration 20261106000001)
[INVARIANT-RECETTE]   colonne public.ticket_categories.sale_counter absente — canaux de vente (contrat 2.4, migration 20261106000001)
[INVARIANT-RECETTE]   colonne public.tickets.sale_decision absente — instantané de la décision de vente (contrat 2.4, migration 20261106000001)
[INVARIANT-RECETTE]   colonne public.stock_reservations.sale_online_at_checkout absente — instantané au checkout (contrat 2.4, migration 20261106000001)
[INVARIANT-RECETTE]   colonne public.referral_commissions.uncapped_amount absente — trace du plafond des commissions (contrat 2.7, migration 20261106000004)
[INVARIANT-RECETTE]   trigger trg_tickets_sale_decision absent de public.tickets — instantané de la vente (contrat 2.4, migration 20261106000001)
[INVARIANT-RECETTE]   trigger trg_stock_reservations_sale_online absent de public.stock_reservations — instantané de la vente (contrat 2.4, migration 20261106000001)
[INVARIANT-RECETTE]   fonction public.payment_duplicate_of absente — paiement en double (contrat 6.1, migration 20261106000003)
not ok 4 - /home/runner/work/event-village/event-village/tests/parcours/recette-invariant.test.ts
```

### Garde-fous (r)(s)(t)

Chaque règle reçoit une violation fabriquée dans une transaction annulée, avec un témoin conforme ; le dernier cas vérifie qu’aucune ligne fabriquée ne reste. (r)(s) : `tests/parcours/recette-invariant.test.ts` ; (t) : `tests/parcours/canaux-invariant.test.ts`.

```text
# run 107 (bc864fa, « après ») — tests/parcours/recette-invariant.test.ts (docs/lot8-logs/ci-run107-verify.log:17213 ; lignes duration_ms, type, location et piles d’appels retirées)
━━━ tests/parcours/recette-invariant.test.ts ━━━
TAP version 13
# Subtest: Invariant (r) : commissions et revenu net
    # Subtest: r1 : commission 40 sur un net de 34,25 détectée ; annulée, elle ne compte plus ; net −15 sans commission : aucune ligne
    ok 1 - r1 : commission 40 sur un net de 34,25 détectée ; annulée, elle ne compte plus ; net −15 sans commission : aucune ligne
    # Subtest: r1 : net NULL avec une commission : violation, jamais une comparaison silencieuse
    ok 2 - r1 : net NULL avec une commission : violation, jamais une comparaison silencieuse
    # Subtest: r2 : net 34,25, 30 remboursés : commission 5 détectée, commission 4 acceptée
    ok 3 - r2 : net 34,25, 30 remboursés : commission 5 détectée, commission 4 acceptée
    1..3
ok 1 - Invariant (r) : commissions et revenu net
# Subtest: Invariant (s) : aucun paiement réussi en double non remboursé
    # Subtest: s1 : deux SUCCESS, même panier, périodes recoupées, détectés ; rachat, panier différent, autre compte et second remboursé : aucune ligne
    ok 1 - s1 : deux SUCCESS, même panier, périodes recoupées, détectés ; rachat, panier différent, autre compte et second remboursé : aucune ligne
    # Subtest: s2 : paiement en double REFUND_PENDING conforme : aucune ligne (témoin) ; REFUNDED aussi
    ok 2 - s2 : paiement en double REFUND_PENDING conforme : aucune ligne (témoin) ; REFUNDED aussi
    # Subtest: s2 : paiement en double au statut SUCCESS détecté
    ok 3 - s2 : paiement en double au statut SUCCESS détecté
    # Subtest: s2 : paiement en double avec un billet détecté
    ok 4 - s2 : paiement en double avec un billet détecté
    # Subtest: s2 : paiement en double sans remboursement du total détecté
    ok 5 - s2 : paiement en double sans remboursement du total détecté
    # Subtest: s2 : paiement en double crédité détecté, par une VENTE au grand livre ou par une commission non annulée
    ok 6 - s2 : paiement en double crédité détecté, par une VENTE au grand livre ou par une commission non annulée
    1..6
ok 2 - Invariant (s) : aucun paiement réussi en double non remboursé
# Subtest: Invariants (r)(s) après annulation des transactions
    # Subtest: aucune ligne fabriquée ne reste dans recetteViolations()
    ok 1 - aucune ligne fabriquée ne reste dans recetteViolations()
    1..1
ok 3 - Invariants (r)(s) après annulation des transactions
[INVARIANT] recette-invariant — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] recette-invariant — purge des réservations échues : {"expired":0}
[INVARIANT] recette-invariant — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] recette-invariant — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] recette-invariant — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] recette-invariant — cron events_finish_overdue : 0 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] recette-invariant — (j)(k)(l) : 0 violation(s)
[notifications] Canal push désactivé : variables VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY et VAPID_SUBJECT absentes. Les notifications partent dans l'application et par SMS.
[INVARIANT-NOTIF] recette-invariant — envoyeur : 43 ligne(s) réservée(s), 0 reprise(s)
[INVARIANT-NOTIF] recette-invariant — (m)(n)(o) : 0 violation(s)
[INVARIANT-TERRAIN] recette-invariant — (p)(q) : 0 violation(s)
[INVARIANT-RECETTE] recette-invariant — (r)(s)(t) : 0 violation(s)
1..3
# tests 10
# suites 3
# pass 10
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1471.982329
```

```text
# run 107 (bc864fa, « après ») — tests/parcours/canaux-invariant.test.ts (docs/lot8-logs/ci-run107-verify.log:2830 ; lignes duration_ms, type, location et piles d’appels retirées)
━━━ tests/parcours/canaux-invariant.test.ts ━━━
TAP version 13
# Subtest: 8.0 Invariant (t) : chaque règle détecte une violation fabriquée
    # Subtest: t0 : billet sans décision (défaut de colonne SANS_DECISION) ; témoin : décision conforme
    ok 1 - t0 : billet sans décision (défaut de colonne SANS_DECISION) ; témoin : décision conforme
    # Subtest: t1 ONLINE : décision sale_online faux, ou clé absente ; témoins : sale_online vrai avec sale_counter faux
    ok 2 - t1 ONLINE : décision sale_online faux, ou clé absente ; témoins : sale_online vrai avec sale_counter faux
    # Subtest: t1 FREE : un billet gratuit est soumis à sale_online (L9) ; témoin : sale_online vrai
    ok 3 - t1 FREE : un billet gratuit est soumis à sale_online (L9) ; témoin : sale_online vrai
    # Subtest: t2 : billet COUNTER à sale_counter faux ; témoin : sale_counter vrai avec sale_online faux (« Sur place uniquement »)
    ok 4 - t2 : billet COUNTER à sale_counter faux ; témoin : sale_counter vrai avec sale_online faux (« Sur place uniquement »)
    # Subtest: t3 : is_visible et sale_online divergent (triggers de ticket_categories coupés) ; témoin : l’autre catégorie
    ok 5 - t3 : is_visible et sale_online divergent (triggers de ticket_categories coupés) ; témoin : l’autre catégorie
    # Subtest: t4 : billet payé en ligne dont la décision contredit sa réservation ; témoin : décision égale à la réservation
    ok 6 - t4 : billet payé en ligne dont la décision contredit sa réservation ; témoin : décision égale à la réservation
    # Subtest: ligne REPRISE ignorée, quel que soit le canal (billets anciens, sans réécriture)
    ok 7 - ligne REPRISE ignorée, quel que soit le canal (billets anciens, sans réécriture)
    1..7
ok 1 - 8.0 Invariant (t) : chaque règle détecte une violation fabriquée
# Subtest: 8.0 Invariant (t) sur une vente réelle
    # Subtest: vente en ligne, gratuite et au guichet, puis coupure des canaux : décisions inchangées, invariant à 0
    ok 1 - vente en ligne, gratuite et au guichet, puis coupure des canaux : décisions inchangées, invariant à 0
    1..1
ok 2 - 8.0 Invariant (t) sur une vente réelle
# Subtest: 8.0 Invariant (t) sur l’état réel
    # Subtest: schéma du lot présent ; après ROLLBACK, aucune ligne fabriquée ne reste et les triggers sont actifs
    ok 1 - schéma du lot présent ; après ROLLBACK, aucune ligne fabriquée ne reste et les triggers sont actifs
    1..1
ok 3 - 8.0 Invariant (t) sur l’état réel
[INVARIANT] canaux-invariant — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] canaux-invariant — purge des réservations échues : {"expired":0}
[INVARIANT] canaux-invariant — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] canaux-invariant — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] canaux-invariant — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] canaux-invariant — cron events_finish_overdue : 0 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] canaux-invariant — (j)(k)(l) : 0 violation(s)
[notifications] Canal push désactivé : variables VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY et VAPID_SUBJECT absentes. Les notifications partent dans l'application et par SMS.
[INVARIANT-NOTIF] canaux-invariant — envoyeur : 69 ligne(s) réservée(s), 0 reprise(s)
[INVARIANT-NOTIF] canaux-invariant — (m)(n)(o) : 0 violation(s)
[INVARIANT-TERRAIN] canaux-invariant — (p)(q) : 0 violation(s)
[INVARIANT-RECETTE] canaux-invariant — (r)(s)(t) : 0 violation(s)
1..3
# tests 9
# suites 3
# pass 9
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1346.630669
```

```text
# run 95 (db21d1c, « avant ») — récapitulatif, docs/lot8-logs/ci-run95-verify.log:41723
tests/parcours/recette-invariant.test.ts               FAIL     2.0s      1     .test-logs/tests__parcours__recette-invariant.test.ts.log
```

```text
# run 95 (db21d1c, « avant ») — récapitulatif, docs/lot8-logs/ci-run95-verify.log:41609
tests/parcours/canaux-invariant.test.ts                FAIL     1.3s      1     .test-logs/tests__parcours__canaux-invariant.test.ts.log
```

Les suites `tests/security` du lot n’appellent pas l’aide (règle du lot 1A : ni service_role ni envoyeur dans ce dossier), comme aux lots 6 et 7.

---

---

## 5. Tableau des suites legacy (8.2 v)

26 fichiers suivis dans `tests/legacy/` à `7fdcb32` ; 26 lignes soldées ; `tests/legacy` n'existe plus à `bc864fa`. Décision du contrat 12.1 : 8 suites supprimées sans portage, 18 portées pour leurs cas uniques puis supprimées (L68). Les cas portés sont dans des suites qui tournent en CI.

Colonnes :
- **Lot 0 (run 3)** : seule exécution connue de ces suites, sur base locale, lue dans `docs/lot0-rapport.md` (sections 4 et 4.b). Elles n'ont jamais été relancées depuis : UUID du projet distant et `LEGACY_TEST_PASSWORD` absents. La découverte du lot 8 n'a fait qu'une lecture statique appuyée sur ce run.
- **Couvert ailleurs** : colonne de la découverte (`discovery-8-design-outillage.md`), citations de lignes au blob `7fdcb32` ; `edition-categories` et `dette-transferts` ont bougé depuis. Les citations des lignes supprimées ont été relues test par test par l'agent legacy au run 95 ; celle de la ligne 10 était fausse (voir sous le tableau).
- **Accueil au run 107** : statut des suites qui reçoivent les cas portés, lu dans le récapitulatif du run 107.

| # | Suite | Lot 0 (run 3) | Décision | Cas portés | Couvert ailleurs (découverte) | Accueil au run 107 |
|---|---|---|---|---|---|---|
| 1 | admin-anonymize | ÉCHOUE (0 ok / 1 ko / 0 annulés) | Porter | billet et commande conservés, identité, `event_controllers` vidé | `anonymisation-debogage:41` (Auth, ban, email libéré), `revocation-sessions:89`, `securite-admin-lot7:237` | anonymisation-debogage PASS |
| 2 | camera-qr-scanner | ÉCHOUE (0 ok / 0 ko / 4 annulés) | Porter | `detectScannerSupport` : native, zxing, manual_only | aucun | scanner-interface PASS |
| 3 | cdc-v3-validation-checks | ÉCHOUE (2 ok / 4 ko / 0 annulés) | Porter T3 | brouillon d'un autre partenaire illisible en lecture directe ; T5 noté pour le lot salles | T4 `partner-orders-m9:159` ; T1, T2 testaient des méthodes mortes ; T3 par l'API `cycle-visibilite:141` | r26-brouillon-autre-partenaire PASS |
| 4 | checkout-mixed-cart | ÉCHOUE (0 ok / 0 ko / 5 annulés) | Porter T1 | panier 100 % gratuit par `POST /api/checkout` | T2 `paiement-gratuits:42,53` ; T3 `finance-moteur:176`, `achat-serveur:59` ; T5 `paiement-reservation:57` ; T4 contraintes UNIQUE sur `ticket_number` et `qr_code` | paiement-gratuits PASS |
| 5 | chunk5-phase1-bugs | ÉCHOUE (0 ok / 0 ko / 4 annulés) | Supprimer | — | sans objet : 0 cas restant (4 cas retirés aux lots 2 et 6) | — |
| 6 | chunk5-phase2-b2c | ÉCHOUE (0 ok / 0 ko / 8 annulés) | Supprimer | — (T6, cron des moratoires, noté pour le lot salles) | T2 `partner-halls-m7:188`, T3 `partner-orders-m9`, T5 `temps-reel-billets:139`, `statut-compte:196` | — |
| 7 | client-ticket-lifecycle | ÉCHOUE (0 ok / 0 ko / 20 annulés) | Porter T13 | `isUpcoming` et `usedAt` de `GET /api/tickets` | T4 `paiement-gratuits:64`, T5 `confirmation-achat:571`, T7 `notif-pros:371`, T10 et T11 `acces-scan:115`, T16 `acces-totp:316`, T17 `acces-totp:349`, T19 `statut-compte:196`, T20 `temps-reel-billets:139` | confirmation-achat PASS |
| 8 | controller-14-points | ÉCHOUE (0 ok / 0 ko / 14 annulés) | Porter T12 | `GET /api/partner/finance` refusé au contrôleur | T2 à T4 `pilotage-equipe-caisse:72`, `notif-controleurs:185` ; T5 `dette-retrait-controleur:209` ; T7 `:171`, `revocation-sessions:56` ; T8 `activation-controleur:246` ; T11 `scan-controleur-stats:299` ; T13 `dette-retrait-controleur:171` | finance-rapports PASS |
| 9 | controller-complete-workflow | ÉCHOUE (0 ok / 0 ko / 4 annulés) | Porter T1 | `resolvePostLoginRoute` réel | T2 réimplémentation locale, sans valeur ; le vrai : `roles-fraicheur:69` ; T3 `acces-qr:159` ; T4 `acces-scan:115` | roles-fraicheur PASS |
| 10 | controller-event-status-hotfix | ÉCHOUE (0 ok / 0 ko / 15 annulés) | Porter, T6 compris | affectation et invitation selon le statut (`INELIGIBLE_EVENT_ASSIGNMENT_ERROR`), idempotence, retrait sur événement clos ; **T6** invitation sur l'événement d'un autre partenaire (403), ajouté par `9642b7c` | T8, T9 `acces-fenetre:116` ; T11 par l'anti-contournement d'`equipe-eligibilite`. La couverture de T6 citée par la découverte (`dette-retrait-controleur`, `pilotage-equipe-caisse:112`) visait d'autres routes | equipe-eligibilite PASS |
| 11 | controller-multi-role | ÉCHOUE (0 ok / 0 ko / 6 annulés) | Porter T3, T5 | retour au rôle CLIENT et statut ACTIF ; ré-invitation après retrait total | T1.A `invitation-identite:64`, T1.B `:83`, `attribution-roles:90`, T4 `dette-retrait-controleur:171`. T2 non porté (voir sous le tableau) | dette-retrait-controleur PASS |
| 12 | controller-realtime-sync | ÉCHOUE (0 ok / 0 ko / 5 annulés) | Supprimer | — | `pilotage-equipe-caisse`, `scan-controleur-stats:314`, `dette-retrait-controleur:238`, `revocation-sessions:81` ; `scanned_today` retiré au lot 4 | — |
| 13 | controller-shifts-z | ÉCHOUE (0 ok / 0 ko / 9 annulés) | Supprimer | — | T5 `dette-cloture-caisse:178` ; T8 `acces-caisse-pin:439` ; T3 `pin-regisseur:12` ; T2 `cycle-cron:309` ; T1 `acces-encaissement:284` ; notes « non couvert » des cas 6 et 7 périmées (`dette-cloture-caisse:191,209,221`) | — |
| 14 | dynamic-qr-totp | ÉCHOUE (0 ok / 0 ko / 7 annulés) | Supprimer | — | `acces-qr:119` | — |
| 15 | event-cancellation-and-refunds | ÉCHOUE (1 ok / 7 ko / 0 annulés) | Porter T5 réécrit | `retryRefund` sur `cashouts` : ECHOUE, SOLDE_INSUFFISANT, INCERTAIN, déjà confirmé, audit `REFUND_RETRY` | `securite-admin-lot7:311` ne testait que 403 et 404. T7 non porté : `getEventEligibilityRejectionReason` n'a aucun appelant ; comportement couvert par `acces-fenetre:116` | remboursement-relance PASS |
| 16 | event-live-editing-and-stock | ÉCHOUE (0 ok / 9 ko / 0 annulés) | Porter T8 | deux hausses de quota simultanées | T2, T3 `edition-categories:329,415` ; T4 `:285,438` ; T5 `edition-formulaire:545` ; T6 `:501` ; T7 `edition-categories:516` ; T9 `:500` ; T1 contredit `edition-categories:337`, qui fait foi | edition-categories PASS |
| 17 | partner-dashboard-and-exports | ÉCHOUE (0 ok / 0 ko / 0 annulés) | Porter T8 à T11, T14 | PDF de clôture et CSV par les routes : 401, 403, 404, 200, A/B, aucun secret ; injection de formule (A23) | T1 à T7 `finance-rapports:102,112`, `finance-moteur`, `pilotage-apercu-ventes` ; T15 à T18 `paiement-*`, `acces-*`, `dette-transferts` | legacy-exports-partenaire PASS |
| 18 | partner-events-m5 | ÉCHOUE (0 ok / 6 ko / 0 annulés) | Supprimer | — | T1 `cycle-visibilite:141,216` ; T2 `r20:117`, `edition-formulaire:388`, `edition-services` ; T4 `cycle-transitions:272,375` | — |
| 19 | partner-tables-m8 | ÉCHOUE (0 ok / 0 ko / 0 annulés) | Supprimer | — | aucun : module hors périmètre ; la concurrence y était simulée par un faux RPC ; à réécrire au lot tables | — |
| 20 | scanner-security-hardening | ÉCHOUE (0 ok / 0 ko / 5 annulés) | Porter | `CAMERA_SCAN_THROTTLE_MS`, `CAMERA_INACTIVITY_TIMEOUT_MS` (180 000 ms exigés, et non les 45 s périmées du legacy) | torche `scanner-combat-ui:113` | scanner-interface PASS |
| 21 | security-fixes | ÉCHOUE (0 ok / 0 ko / 10 annulés) | Porter T1.2, T2.3, T3.2 | `ACCOUNT_ALREADY_CONFIGURED` ; `requires_confirmation` par `PATCH assignments` ; contrôleur SUSPENDU au scan | T1.3 `activation-controleur`, `statut-compte:104` ; T3.4 `invitation-identite:139` | activation-controleur PASS, equipe-eligibilite PASS, acces-scan PASS |
| 22 | ticket-pdf-and-exports | ÉCHOUE (0 ok / 0 ko / 12 annulés) | Porter T2 à T6 | PDF de billet : tiers, anonyme, inconnu, annulé, transféré | T1, T7 `acces-qr:258`, `finance-affichage:142` | legacy-billet-pdf PASS |
| 23 | ticket-transfer-phase2-initiation | ÉCHOUE (0 ok / 0 ko / 9 annulés) | Porter T5 | billet UTILISE refusé | T1 `notif-transferts:180` ; T3, T4 `dette-transferts:352` ; T6 `notif-transferts:225` ; T7 `dette-transferts:334,370` | dette-transferts PASS |
| 24 | ticket-transfer-phase3-claim | ÉCHOUE (0 ok / 0 ko / 18 annulés) | Porter T11, T12, T15, T16 | route d'annulation, rejeu d'expiration, nouveau transfert après expiration | T2, T3 `notif-transferts:382` ; T14 `dette-transferts:410,470` | dette-transferts PASS |
| 25 | ticket-transfers-phase1-schema | ÉCHOUE (0 ok / 0 ko / 12 annulés) | Supprimer | — | simulateur en mémoire, chaînes de migration ; T3, T4 `dette-transferts:334` ; T9 `:352` ; T10 `temps-reel-billets:139`, `statut-compte:196` | — |
| 26 | ticketing-e2e-final | ÉCHOUE (0 ok / 0 ko / 11 annulés) | Porter T1.2 | `claim-free` après épuisement | T6.1 `edition-categories:329`, T6.2 `:516` ; stock `temps-reel-stock:200` ; limite `paiement-gratuits:64` | paiement-gratuits PASS |

Bilan : 18 lignes « Porter », 8 « Supprimer » ; 53 tests écrits pour les ports selon le message de `3687cc0`. Au run 3 du lot 0, les 26 suites étaient toutes en échec ; les seuls sous-tests passés étaient 2 de `cdc-v3-validation-checks` et 1 d'`event-cancellation-and-refunds` (colonne « Lot 0 »).

**Ligne 10.** `b7b1170` a supprimé 25 fichiers sur 26 et gardé `controller-event-status-hotfix` : son cas T6 (`POST /api/partner/team/invite` sur l'événement d'un autre partenaire, 403, `invite/route.ts:121-124`) n'était ni porté ni couvert. Retirer ce contrôle d'accès ne faisait échouer aucun test. Il a été ajouté à `equipe-eligibilite` (`9642b7c`), puis le dernier fichier a été supprimé (`5d4cdb7`).

**Cas non portés, lignes soldées.** Ligne 11, T2 : la route de retrait n'a aucune barrière de rôle sur le compte client (`withdrawals/request/route.ts:66` ne filtre que `ORGANISATEUR`) ; aucun test moderne n'exerce ce cas avec un compte CONTROLEUR, résiduel faible (section 19). Ligne 15, T7 : code mort.

**Rouges des ports.** Deux cas étaient rouges à l'écriture, contrairement à « réputés verts » : T5 de `legacy-billet-pdf` (statut technique dans le refus du PDF) et l'injection de formule de `legacy-exports-partenaire`. C'est l'anomalie A23, corrigée par `1fa3fe9`. Au run 95, T5 s'arrêtait au premier statut : REMBOURSEMENT_EN_COURS et REMBOURSE n'étaient vérifiés qu'à partir du run suivant le correctif.

Run 95 (`db21d1c`, « avant ») et run 107 (`bc864fa`, « après »), récapitulatifs, suites d'accueil :

```text
# run 95 (db21d1c, « avant »)
tests/parcours/equipe-eligibilite.test.ts              PASS     4.3s      0     .test-logs/tests__parcours__equipe-eligibilite.test.ts.log
tests/parcours/legacy-billet-pdf.test.ts               FAIL     2.1s      1     .test-logs/tests__parcours__legacy-billet-pdf.test.ts.log
tests/parcours/legacy-exports-partenaire.test.ts       FAIL     2.3s      1     .test-logs/tests__parcours__legacy-exports-partenaire.test.ts.log
tests/parcours/remboursement-relance.test.ts           PASS     3.1s      0     .test-logs/tests__parcours__remboursement-relance.test.ts.log
tests/security/r26-brouillon-autre-partenaire.test.ts  PASS     1.8s      0     .test-logs/tests__security__r26-brouillon-autre-partenaire.test.ts.log
# run 107 (bc864fa, « après »), suites d'accueil et suites citées pour les lignes supprimées
tests/parcours/acces-fenetre.test.ts                   PASS     1.8s      0     .test-logs/tests__parcours__acces-fenetre.test.ts.log
tests/parcours/acces-qr.test.ts                        PASS     1.7s      0     .test-logs/tests__parcours__acces-qr.test.ts.log
tests/parcours/acces-scan.test.ts                      PASS     2.0s      0     .test-logs/tests__parcours__acces-scan.test.ts.log
tests/parcours/activation-controleur.test.ts           PASS     3.1s      0     .test-logs/tests__parcours__activation-controleur.test.ts.log
tests/parcours/anonymisation-debogage.test.ts          PASS     1.2s      0     .test-logs/tests__parcours__anonymisation-debogage.test.ts.log
tests/parcours/confirmation-achat.test.ts              PASS     3.0s      0     .test-logs/tests__parcours__confirmation-achat.test.ts.log
tests/parcours/cycle-transitions.test.ts               PASS     13.0s     0     .test-logs/tests__parcours__cycle-transitions.test.ts.log
tests/parcours/cycle-visibilite.test.ts                PASS     1.7s      0     .test-logs/tests__parcours__cycle-visibilite.test.ts.log
tests/parcours/dette-cloture-caisse.test.ts            PASS     4.2s      0     .test-logs/tests__parcours__dette-cloture-caisse.test.ts.log
tests/parcours/dette-retrait-controleur.test.ts        PASS     2.8s      0     .test-logs/tests__parcours__dette-retrait-controleur.test.ts.log
tests/parcours/dette-transferts.test.ts                PASS     1.7s      0     .test-logs/tests__parcours__dette-transferts.test.ts.log
tests/parcours/edition-categories.test.ts              PASS     2.5s      0     .test-logs/tests__parcours__edition-categories.test.ts.log
tests/parcours/edition-formulaire.test.ts              PASS     4.6s      0     .test-logs/tests__parcours__edition-formulaire.test.ts.log
tests/parcours/equipe-eligibilite.test.ts              PASS     3.6s      0     .test-logs/tests__parcours__equipe-eligibilite.test.ts.log
tests/parcours/finance-rapports.test.ts                PASS     1.5s      0     .test-logs/tests__parcours__finance-rapports.test.ts.log
tests/parcours/legacy-billet-pdf.test.ts               PASS     1.8s      0     .test-logs/tests__parcours__legacy-billet-pdf.test.ts.log
tests/parcours/legacy-exports-partenaire.test.ts       PASS     1.9s      0     .test-logs/tests__parcours__legacy-exports-partenaire.test.ts.log
tests/parcours/paiement-gratuits.test.ts               PASS     1.7s      0     .test-logs/tests__parcours__paiement-gratuits.test.ts.log
tests/parcours/pilotage-equipe-caisse.test.ts          PASS     4.1s      0     .test-logs/tests__parcours__pilotage-equipe-caisse.test.ts.log
tests/parcours/remboursement-relance.test.ts           PASS     2.6s      0     .test-logs/tests__parcours__remboursement-relance.test.ts.log
tests/parcours/revocation-sessions.test.ts             PASS     1.6s      0     .test-logs/tests__parcours__revocation-sessions.test.ts.log
tests/parcours/roles-fraicheur.test.ts                 PASS     834ms     0     .test-logs/tests__parcours__roles-fraicheur.test.ts.log
tests/parcours/scan-controleur-stats.test.ts           PASS     4.8s      0     .test-logs/tests__parcours__scan-controleur-stats.test.ts.log
tests/parcours/scanner-interface.test.ts               PASS     4.4s      0     .test-logs/tests__parcours__scanner-interface.test.ts.log
tests/partner-orders-m9.test.ts                        PASS     1.3s      0     .test-logs/tests__partner-orders-m9.test.ts.log
tests/scanner-combat-ui.test.ts                        PASS     409ms     0     .test-logs/tests__scanner-combat-ui.test.ts.log
tests/security/r26-brouillon-autre-partenaire.test.ts  PASS     1.5s      0     .test-logs/tests__security__r26-brouillon-autre-partenaire.test.ts.log
```

Run 107, `tests/parcours/equipe-eligibilite.test.ts`, lignes de résultat (le cas T6 est la 7ᵉ du premier groupe) :

```text
    ok 1 - événement BROUILLON : 400, aucun compte créé, aucune affectation, aucun SMS
    ok 2 - événement EN_ATTENTE : 400, aucun compte créé, aucune affectation, aucun SMS
    ok 3 - événement SUSPENDU : 400, aucun compte créé, aucune affectation, aucun SMS
    ok 4 - événement TERMINE : 400, aucun compte créé, aucune affectation, aucun SMS
    ok 5 - événement ANNULE : 400, aucun compte créé, aucune affectation, aucun SMS
    ok 6 - T4 : VALIDE et PUBLIE → 201, deux affectations (témoin)
    ok 7 - T6 : événement d’un autre partenaire → 403, aucun compte créé, aucune affectation, aucun SMS
    ok 8 - T7 : événement déjà affecté → 200, aucune seconde ligne
ok 1 - 8.2 v — POST /api/partner/team/invite selon le statut de l’événement
    ok 1 - événement BROUILLON ajouté à la liste : 400, affectations intactes
    ok 2 - événement EN_ATTENTE ajouté à la liste : 400, affectations intactes
    ok 3 - événement SUSPENDU ajouté à la liste : 400, affectations intactes
    ok 4 - événement TERMINE ajouté à la liste : 400, affectations intactes
    ok 5 - événement ANNULE ajouté à la liste : 400, affectations intactes
    ok 6 - anti-contournement { controllerId, eventId } : brouillon 400, événement d’un autre 403, publié 200
    ok 7 - T12 : retrait d’affectations sur des événements devenus SUSPENDU et TERMINE → 200, seule l’affectation gardée reste
    ok 8 - security-fixes T2.3 : compte CLIENT → requires_confirmation sans aucun effet, puis confirm_promotion → rôle CONTROLEUR, ACTIF, affecté
ok 2 - 8.2 v — PATCH /api/partner/team/assignments selon le statut de l’événement
# tests 16
# pass 16
# fail 0
# cancelled 0
```

---

---

## 6. Sortie brute de `npm run verify`, de `npm run e2e` et CI

Journaux complets : `docs/lot8-logs/ci-run95-*` (« avant », committés par `8f77b1b`), `ci-run105-*` (committés par `f488be0`), `ci-run107-*` (non committés, voir l’en-tête de cette partie). Sur `ci-results` : `runs/95-42276458389/`, `runs/105-42323674856/`, `runs/106-42328234330/`, `runs/107-42334500969/`.

### 6.1 Run 95 (référence « avant »), récapitulatif : suites en échec

```text
# run 95 (db21d1c) — docs/lot8-logs/ci-run95-verify.log:41578-41802, lignes PASS retirées
═══════════════════ RÉCAPITULATIF ═══════════════════
Suite                                                  Statut   Durée     Code  Journal
tests/parcours/acces-messages.test.ts                  FAIL     794ms     1     .test-logs/tests__parcours__acces-messages.test.ts.log
tests/parcours/acces-tracabilite.test.ts               FAIL     2.9s      1     .test-logs/tests__parcours__acces-tracabilite.test.ts.log
tests/parcours/admin-audit.test.ts                     FAIL     2.2s      1     .test-logs/tests__parcours__admin-audit.test.ts.log
tests/parcours/admin-parrainage.test.ts                FAIL     981ms     1     .test-logs/tests__parcours__admin-parrainage.test.ts.log
tests/parcours/admin-remboursements.test.ts            FAIL     3.6s      1     .test-logs/tests__parcours__admin-remboursements.test.ts.log
tests/parcours/admin-services-mention.test.ts          FAIL     729ms     1     .test-logs/tests__parcours__admin-services-mention.test.ts.log
tests/parcours/canaux-interface.test.ts                FAIL     665ms     1     .test-logs/tests__parcours__canaux-interface.test.ts.log
tests/parcours/canaux-invariant.test.ts                FAIL     1.3s      1     .test-logs/tests__parcours__canaux-invariant.test.ts.log
tests/parcours/canaux-vente.test.ts                    FAIL     1.7s      1     .test-logs/tests__parcours__canaux-vente.test.ts.log
tests/parcours/commissions-plafond.test.ts             FAIL     6.4s      1     .test-logs/tests__parcours__commissions-plafond.test.ts.log
tests/parcours/course-confirmation-annulation.test.ts  FAIL     6.7s      1     .test-logs/tests__parcours__course-confirmation-annulation.test.ts.log
tests/parcours/design-systeme.test.ts                  FAIL     2.8s      1     .test-logs/tests__parcours__design-systeme.test.ts.log
tests/parcours/dette-cloture-caisse.test.ts            FAIL     4.4s      1     .test-logs/tests__parcours__dette-cloture-caisse.test.ts.log
tests/parcours/double-paiement.test.ts                 FAIL     5.4s      1     .test-logs/tests__parcours__double-paiement.test.ts.log
tests/parcours/essai-middleware.test.ts                FAIL     801ms     1     .test-logs/tests__parcours__essai-middleware.test.ts.log
tests/parcours/essai-seed-dev.test.ts                  FAIL     914ms     1     .test-logs/tests__parcours__essai-seed-dev.test.ts.log
tests/parcours/essai-simule.test.ts                    FAIL     2.0s      1     .test-logs/tests__parcours__essai-simule.test.ts.log
tests/parcours/evenement-404.test.ts                   FAIL     2.0s      1     .test-logs/tests__parcours__evenement-404.test.ts.log
tests/parcours/hors-ligne-codes.test.ts                FAIL     12.8s     1     .test-logs/tests__parcours__hors-ligne-codes.test.ts.log
tests/parcours/legacy-billet-pdf.test.ts               FAIL     2.1s      1     .test-logs/tests__parcours__legacy-billet-pdf.test.ts.log
tests/parcours/legacy-exports-partenaire.test.ts       FAIL     2.3s      1     .test-logs/tests__parcours__legacy-exports-partenaire.test.ts.log
tests/parcours/messages-bruts.test.ts                  FAIL     2.3s      1     .test-logs/tests__parcours__messages-bruts.test.ts.log
tests/parcours/notif-abonnement.test.ts                FAIL     1.3s      1     .test-logs/tests__parcours__notif-abonnement.test.ts.log
tests/parcours/notif-interface.test.ts                 FAIL     2.9s      1     .test-logs/tests__parcours__notif-interface.test.ts.log
tests/parcours/notif-migration.test.ts                 FAIL     1.8s      1     .test-logs/tests__parcours__notif-migration.test.ts.log
tests/parcours/notif-modeles.test.ts                   FAIL     1.0s      1     .test-logs/tests__parcours__notif-modeles.test.ts.log
tests/parcours/notif-outbox.test.ts                    FAIL     2.1s      1     .test-logs/tests__parcours__notif-outbox.test.ts.log
tests/parcours/paiement-controles.test.ts              FAIL     2.3s      1     .test-logs/tests__parcours__paiement-controles.test.ts.log
tests/parcours/parrainage-lien.test.ts                 FAIL     2.3s      1     .test-logs/tests__parcours__parrainage-lien.test.ts.log
tests/parcours/partenaire-lot7.test.ts                 FAIL     6.7s      1     .test-logs/tests__parcours__partenaire-lot7.test.ts.log
tests/parcours/partenaire-profil-rpc.test.ts           FAIL     4.8s      1     .test-logs/tests__parcours__partenaire-profil-rpc.test.ts.log
tests/parcours/perf-statique.test.ts                   FAIL     2.9s      1     .test-logs/tests__parcours__perf-statique.test.ts.log
tests/parcours/pilotage-remboursement-billet.test.ts   FAIL     4.1s      1     .test-logs/tests__parcours__pilotage-remboursement-billet.test.ts.log
tests/parcours/realtime-diagnostic.test.ts             FAIL     634ms     1     .test-logs/tests__parcours__realtime-diagnostic.test.ts.log
tests/parcours/recette-invariant.test.ts               FAIL     2.0s      1     .test-logs/tests__parcours__recette-invariant.test.ts.log
tests/parcours/scan-renvoi-seulement.test.ts           FAIL     13.2s     1     .test-logs/tests__parcours__scan-renvoi-seulement.test.ts.log
tests/parcours/scanner-interface.test.ts               FAIL     4.6s      1     .test-logs/tests__parcours__scanner-interface.test.ts.log
tests/parcours/temps-reel-prives.test.ts               FAIL     82.7s     1     .test-logs/tests__parcours__temps-reel-prives.test.ts.log
tests/schema/essai-cron-local.test.ts                  FAIL     414ms     1     .test-logs/tests__schema__essai-cron-local.test.ts.log
tests/schema/essai-env-local.test.ts                   FAIL     362ms     1     .test-logs/tests__schema__essai-env-local.test.ts.log
tests/schema/essai-faux-samirpay.test.ts               FAIL     340ms     1     .test-logs/tests__schema__essai-faux-samirpay.test.ts.log
tests/schema/essai-integrations.test.ts                FAIL     2.7s      1     .test-logs/tests__schema__essai-integrations.test.ts.log
tests/schema/essai-seed-gardes.test.ts                 FAIL     379ms     1     .test-logs/tests__schema__essai-seed-gardes.test.ts.log
tests/schema/messages-bruts.test.ts                    FAIL     1.7s      1     .test-logs/tests__schema__messages-bruts.test.ts.log
tests/schema/migration-lot8-rejouable.test.ts          FAIL     1.3s      1     .test-logs/tests__schema__migration-lot8-rejouable.test.ts.log
tests/security/r3-fonctions-rpc.test.ts                FAIL     1.5s      1     .test-logs/tests__security__r3-fonctions-rpc.test.ts.log
tests/security/r6-roles-jeton.test.ts                  FAIL     1.4s      1     .test-logs/tests__security__r6-roles-jeton.test.ts.log
TOTAL : 219 suite(s) — 172 réussie(s), 47 en échec, 0 expirée(s)

[verify] ÉCHEC à l'étape "test" (code 1).
```

Le tri de ces 47 échecs est dans `docs/lot8-logs/ci-run95-triage.txt` (et `scratchpad/triage-95-42276458389.txt`) ; il est repris en section 2.

### 6.2 Run 107 (référence « après »), `npm run verify`

```text
# run 107 (bc864fa) — docs/lot8-logs/ci-run107-verify.log:1-25

> event-village@1.0.0 verify
> node scripts/verify.mjs


═══════════════ verify › typecheck : npm run typecheck ═══════════════

> event-village@1.0.0 typecheck
> tsc --noEmit


═══════════════ verify › lint : npm run lint ═══════════════

> event-village@1.0.0 lint
> next lint

✔ No ESLint warnings or errors

═══════════════ verify › test : npm run test ═══════════════

> event-village@1.0.0 test
> node scripts/run-tests.mjs

[run-tests] suites lourdes (massHolders) après la dernière suite temps réel (tests/parcours/temps-reel-stock.test.ts) : tests/parcours/sms-plafond-optionnel.test.ts, tests/parcours/sms-veille.test.ts
[run-tests] 220 suite(s) — garde-fou : tests/helpers/env.ts — délai/suite : 600.0s
```

Récapitulatif complet (220 lignes PASS, aucune autre) :

```text
# run 107 (bc864fa) — docs/lot8-logs/ci-run107-verify.log:25693-25916
═══════════════════ RÉCAPITULATIF ═══════════════════
Suite                                                  Statut   Durée     Code  Journal
tests/auth-rbac.test.ts                                PASS     262ms     0     .test-logs/tests__auth-rbac.test.ts.log
tests/e2e-scenarios.test.ts                            PASS     407ms     0     .test-logs/tests__e2e-scenarios.test.ts.log
tests/fondations-lot0.test.ts                          PASS     464ms     0     .test-logs/tests__fondations-lot0.test.ts.log
tests/notifications-and-documents.test.ts              PASS     278ms     0     .test-logs/tests__notifications-and-documents.test.ts.log
tests/parcours/acces-caisse-pin.test.ts                PASS     3.0s      0     .test-logs/tests__parcours__acces-caisse-pin.test.ts.log
tests/parcours/acces-encaissement.test.ts              PASS     2.6s      0     .test-logs/tests__parcours__acces-encaissement.test.ts.log
tests/parcours/acces-fenetre.test.ts                   PASS     1.8s      0     .test-logs/tests__parcours__acces-fenetre.test.ts.log
tests/parcours/acces-guichet.test.ts                   PASS     1.9s      0     .test-logs/tests__parcours__acces-guichet.test.ts.log
tests/parcours/acces-invariant.test.ts                 PASS     426ms     0     .test-logs/tests__parcours__acces-invariant.test.ts.log
tests/parcours/acces-limiteurs.test.ts                 PASS     3.4s      0     .test-logs/tests__parcours__acces-limiteurs.test.ts.log
tests/parcours/acces-messages.test.ts                  PASS     737ms     0     .test-logs/tests__parcours__acces-messages.test.ts.log
tests/parcours/acces-pilotage.test.ts                  PASS     17.9s     0     .test-logs/tests__parcours__acces-pilotage.test.ts.log
tests/parcours/acces-qr.test.ts                        PASS     1.7s      0     .test-logs/tests__parcours__acces-qr.test.ts.log
tests/parcours/acces-reglages.test.ts                  PASS     1.2s      0     .test-logs/tests__parcours__acces-reglages.test.ts.log
tests/parcours/acces-scan.test.ts                      PASS     2.0s      0     .test-logs/tests__parcours__acces-scan.test.ts.log
tests/parcours/acces-securite-urgente.test.ts          PASS     1.9s      0     .test-logs/tests__parcours__acces-securite-urgente.test.ts.log
tests/parcours/acces-totp.test.ts                      PASS     1.7s      0     .test-logs/tests__parcours__acces-totp.test.ts.log
tests/parcours/acces-tracabilite.test.ts               PASS     2.5s      0     .test-logs/tests__parcours__acces-tracabilite.test.ts.log
tests/parcours/achat-serveur.test.ts                   PASS     566ms     0     .test-logs/tests__parcours__achat-serveur.test.ts.log
tests/parcours/activation-controleur.test.ts           PASS     3.1s      0     .test-logs/tests__parcours__activation-controleur.test.ts.log
tests/parcours/admin-audit.test.ts                     PASS     1.9s      0     .test-logs/tests__parcours__admin-audit.test.ts.log
tests/parcours/admin-evenements.test.ts                PASS     4.0s      0     .test-logs/tests__parcours__admin-evenements.test.ts.log
tests/parcours/admin-parrainage.test.ts                PASS     814ms     0     .test-logs/tests__parcours__admin-parrainage.test.ts.log
tests/parcours/admin-remboursements.test.ts            PASS     3.8s      0     .test-logs/tests__parcours__admin-remboursements.test.ts.log
tests/parcours/admin-services-mention.test.ts          PASS     612ms     0     .test-logs/tests__parcours__admin-services-mention.test.ts.log
tests/parcours/anonymisation-debogage.test.ts          PASS     1.2s      0     .test-logs/tests__parcours__anonymisation-debogage.test.ts.log
tests/parcours/attribution-roles.test.ts               PASS     1.2s      0     .test-logs/tests__parcours__attribution-roles.test.ts.log
tests/parcours/bootstrap-superadmin.test.ts            PASS     525ms     0     .test-logs/tests__parcours__bootstrap-superadmin.test.ts.log
tests/parcours/canaux-interface.test.ts                PASS     543ms     0     .test-logs/tests__parcours__canaux-interface.test.ts.log
tests/parcours/canaux-invariant.test.ts                PASS     1.7s      0     .test-logs/tests__parcours__canaux-invariant.test.ts.log
tests/parcours/canaux-vente.test.ts                    PASS     4.9s      0     .test-logs/tests__parcours__canaux-vente.test.ts.log
tests/parcours/changement-role-admin.test.ts           PASS     900ms     0     .test-logs/tests__parcours__changement-role-admin.test.ts.log
tests/parcours/client-interface.test.ts                PASS     1.3s      0     .test-logs/tests__parcours__client-interface.test.ts.log
tests/parcours/commissions-plafond.test.ts             PASS     5.9s      0     .test-logs/tests__parcours__commissions-plafond.test.ts.log
tests/parcours/confirmation-achat.test.ts              PASS     3.0s      0     .test-logs/tests__parcours__confirmation-achat.test.ts.log
tests/parcours/course-annulation-transfert.test.ts     PASS     2.6s      0     .test-logs/tests__parcours__course-annulation-transfert.test.ts.log
tests/parcours/course-confirmation-annulation.test.ts  PASS     3.0s      0     .test-logs/tests__parcours__course-confirmation-annulation.test.ts.log
tests/parcours/cycle-annulation.test.ts                PASS     11.9s     0     .test-logs/tests__parcours__cycle-annulation.test.ts.log
tests/parcours/cycle-cron.test.ts                      PASS     3.3s      0     .test-logs/tests__parcours__cycle-cron.test.ts.log
tests/parcours/cycle-invariant.test.ts                 PASS     1.3s      0     .test-logs/tests__parcours__cycle-invariant.test.ts.log
tests/parcours/cycle-transitions.test.ts               PASS     13.0s     0     .test-logs/tests__parcours__cycle-transitions.test.ts.log
tests/parcours/cycle-visibilite.test.ts                PASS     1.7s      0     .test-logs/tests__parcours__cycle-visibilite.test.ts.log
tests/parcours/decouverte-recherche.test.ts            PASS     1.7s      0     .test-logs/tests__parcours__decouverte-recherche.test.ts.log
tests/parcours/design-systeme.test.ts                  PASS     2.2s      0     .test-logs/tests__parcours__design-systeme.test.ts.log
tests/parcours/dette-admin-services.test.ts            PASS     3.1s      0     .test-logs/tests__parcours__dette-admin-services.test.ts.log
tests/parcours/dette-annulation-transferts.test.ts     PASS     3.5s      0     .test-logs/tests__parcours__dette-annulation-transferts.test.ts.log
tests/parcours/dette-categories-publiques.test.ts      PASS     1.7s      0     .test-logs/tests__parcours__dette-categories-publiques.test.ts.log
tests/parcours/dette-cloture-caisse.test.ts            PASS     4.2s      0     .test-logs/tests__parcours__dette-cloture-caisse.test.ts.log
tests/parcours/dette-guichet.test.ts                   PASS     1.4s      0     .test-logs/tests__parcours__dette-guichet.test.ts.log
tests/parcours/dette-incidents.test.ts                 PASS     6.9s      0     .test-logs/tests__parcours__dette-incidents.test.ts.log
tests/parcours/dette-interface-lot7.test.ts            PASS     2.8s      0     .test-logs/tests__parcours__dette-interface-lot7.test.ts.log
tests/parcours/dette-publication-reservations.test.ts  PASS     20.5s     0     .test-logs/tests__parcours__dette-publication-reservations.test.ts.log
tests/parcours/dette-retrait-controleur.test.ts        PASS     2.8s      0     .test-logs/tests__parcours__dette-retrait-controleur.test.ts.log
tests/parcours/dette-roles-otp.test.ts                 PASS     1.7s      0     .test-logs/tests__parcours__dette-roles-otp.test.ts.log
tests/parcours/dette-suppression-evenement.test.ts     PASS     1.8s      0     .test-logs/tests__parcours__dette-suppression-evenement.test.ts.log
tests/parcours/dette-suspendu-temps-reel.test.ts       PASS     48.6s     0     .test-logs/tests__parcours__dette-suspendu-temps-reel.test.ts.log
tests/parcours/dette-transferts.test.ts                PASS     1.7s      0     .test-logs/tests__parcours__dette-transferts.test.ts.log
tests/parcours/documents-inscription.test.ts           PASS     1.7s      0     .test-logs/tests__parcours__documents-inscription.test.ts.log
tests/parcours/double-paiement.test.ts                 PASS     5.2s      0     .test-logs/tests__parcours__double-paiement.test.ts.log
tests/parcours/edition-categories.test.ts              PASS     2.5s      0     .test-logs/tests__parcours__edition-categories.test.ts.log
tests/parcours/edition-formulaire.test.ts              PASS     4.6s      0     .test-logs/tests__parcours__edition-formulaire.test.ts.log
tests/parcours/edition-services.test.ts                PASS     891ms     0     .test-logs/tests__parcours__edition-services.test.ts.log
tests/parcours/edition-validation.test.ts              PASS     923ms     0     .test-logs/tests__parcours__edition-validation.test.ts.log
tests/parcours/email-optionnel.test.ts                 PASS     935ms     0     .test-logs/tests__parcours__email-optionnel.test.ts.log
tests/parcours/equipe-eligibilite.test.ts              PASS     3.6s      0     .test-logs/tests__parcours__equipe-eligibilite.test.ts.log
tests/parcours/essai-middleware.test.ts                PASS     628ms     0     .test-logs/tests__parcours__essai-middleware.test.ts.log
tests/parcours/essai-seed-dev.test.ts                  PASS     1.9s      0     .test-logs/tests__parcours__essai-seed-dev.test.ts.log
tests/parcours/essai-simule.test.ts                    PASS     6.7s      0     .test-logs/tests__parcours__essai-simule.test.ts.log
tests/parcours/evenement-404.test.ts                   PASS     1.8s      0     .test-logs/tests__parcours__evenement-404.test.ts.log
tests/parcours/filtres-postgrest.test.ts               PASS     490ms     0     .test-logs/tests__parcours__filtres-postgrest.test.ts.log
tests/parcours/finance-affichage.test.ts               PASS     1.3s      0     .test-logs/tests__parcours__finance-affichage.test.ts.log
tests/parcours/finance-annulation.test.ts              PASS     2.0s      0     .test-logs/tests__parcours__finance-annulation.test.ts.log
tests/parcours/finance-cibles.test.ts                  PASS     1.6s      0     .test-logs/tests__parcours__finance-cibles.test.ts.log
tests/parcours/finance-commissions.test.ts             PASS     4.2s      0     .test-logs/tests__parcours__finance-commissions.test.ts.log
tests/parcours/finance-hors-plateforme.test.ts         PASS     1.3s      0     .test-logs/tests__parcours__finance-hors-plateforme.test.ts.log
tests/parcours/finance-invariant.test.ts               PASS     457ms     0     .test-logs/tests__parcours__finance-invariant.test.ts.log
tests/parcours/finance-moteur.test.ts                  PASS     1.4s      0     .test-logs/tests__parcours__finance-moteur.test.ts.log
tests/parcours/finance-rapports.test.ts                PASS     1.5s      0     .test-logs/tests__parcours__finance-rapports.test.ts.log
tests/parcours/finance-reglages.test.ts                PASS     1.3s      0     .test-logs/tests__parcours__finance-reglages.test.ts.log
tests/parcours/finance-remboursement-billet.test.ts    PASS     1.8s      0     .test-logs/tests__parcours__finance-remboursement-billet.test.ts.log
tests/parcours/finance-retraits.test.ts                PASS     6.0s      0     .test-logs/tests__parcours__finance-retraits.test.ts.log
tests/parcours/hors-ligne-client.test.ts               PASS     1.6s      0     .test-logs/tests__parcours__hors-ligne-client.test.ts.log
tests/parcours/hors-ligne-codes.test.ts                PASS     10.7s     0     .test-logs/tests__parcours__hors-ligne-codes.test.ts.log
tests/parcours/hors-ligne-rotation.test.ts             PASS     7.6s      0     .test-logs/tests__parcours__hors-ligne-rotation.test.ts.log
tests/parcours/hors-ligne-service-worker.test.ts       PASS     1.6s      0     .test-logs/tests__parcours__hors-ligne-service-worker.test.ts.log
tests/parcours/inscription-numero-dabord.test.ts       PASS     2.1s      0     .test-logs/tests__parcours__inscription-numero-dabord.test.ts.log
tests/parcours/interrupteurs.test.ts                   PASS     2.7s      0     .test-logs/tests__parcours__interrupteurs.test.ts.log
tests/parcours/invitation-identite.test.ts             PASS     1.3s      0     .test-logs/tests__parcours__invitation-identite.test.ts.log
tests/parcours/legacy-billet-pdf.test.ts               PASS     1.8s      0     .test-logs/tests__parcours__legacy-billet-pdf.test.ts.log
tests/parcours/legacy-exports-partenaire.test.ts       PASS     1.9s      0     .test-logs/tests__parcours__legacy-exports-partenaire.test.ts.log
tests/parcours/messages-bruts.test.ts                  PASS     1.9s      0     .test-logs/tests__parcours__messages-bruts.test.ts.log
tests/parcours/notif-abonnement.test.ts                PASS     1.1s      0     .test-logs/tests__parcours__notif-abonnement.test.ts.log
tests/parcours/notif-admin.test.ts                     PASS     3.3s      0     .test-logs/tests__parcours__notif-admin.test.ts.log
tests/parcours/notif-admins.test.ts                    PASS     4.5s      0     .test-logs/tests__parcours__notif-admins.test.ts.log
tests/parcours/notif-canaux.test.ts                    PASS     4.5s      0     .test-logs/tests__parcours__notif-canaux.test.ts.log
tests/parcours/notif-cloche.test.ts                    PASS     15.9s     0     .test-logs/tests__parcours__notif-cloche.test.ts.log
tests/parcours/notif-controleurs.test.ts               PASS     3.6s      0     .test-logs/tests__parcours__notif-controleurs.test.ts.log
tests/parcours/notif-envoyeur.test.ts                  PASS     2.8s      0     .test-logs/tests__parcours__notif-envoyeur.test.ts.log
tests/parcours/notif-interface.test.ts                 PASS     2.4s      0     .test-logs/tests__parcours__notif-interface.test.ts.log
tests/parcours/notif-invariant.test.ts                 PASS     1.2s      0     .test-logs/tests__parcours__notif-invariant.test.ts.log
tests/parcours/notif-migration.test.ts                 PASS     1.7s      0     .test-logs/tests__parcours__notif-migration.test.ts.log
tests/parcours/notif-modeles.test.ts                   PASS     860ms     0     .test-logs/tests__parcours__notif-modeles.test.ts.log
tests/parcours/notif-outbox.test.ts                    PASS     1.8s      0     .test-logs/tests__parcours__notif-outbox.test.ts.log
tests/parcours/notif-preferences.test.ts               PASS     3.7s      0     .test-logs/tests__parcours__notif-preferences.test.ts.log
tests/parcours/notif-pros.test.ts                      PASS     10.1s     0     .test-logs/tests__parcours__notif-pros.test.ts.log
tests/parcours/notif-rappels-annulation.test.ts        PASS     3.7s      0     .test-logs/tests__parcours__notif-rappels-annulation.test.ts.log
tests/parcours/notif-rappels.test.ts                   PASS     6.1s      0     .test-logs/tests__parcours__notif-rappels.test.ts.log
tests/parcours/notif-reglages.test.ts                  PASS     2.1s      0     .test-logs/tests__parcours__notif-reglages.test.ts.log
tests/parcours/notif-transferts.test.ts                PASS     3.5s      0     .test-logs/tests__parcours__notif-transferts.test.ts.log
tests/parcours/otp-hachage.test.ts                     PASS     440ms     0     .test-logs/tests__parcours__otp-hachage.test.ts.log
tests/parcours/otp-objet.test.ts                       PASS     1.4s      0     .test-logs/tests__parcours__otp-objet.test.ts.log
tests/parcours/otp-serveur.test.ts                     PASS     785ms     0     .test-logs/tests__parcours__otp-serveur.test.ts.log
tests/parcours/paiement-attente-lot7.test.ts           PASS     3.0s      0     .test-logs/tests__parcours__paiement-attente-lot7.test.ts.log
tests/parcours/paiement-confirmation.test.ts           PASS     1.4s      0     .test-logs/tests__parcours__paiement-confirmation.test.ts.log
tests/parcours/paiement-controles.test.ts              PASS     1.9s      0     .test-logs/tests__parcours__paiement-controles.test.ts.log
tests/parcours/paiement-gratuits.test.ts               PASS     1.7s      0     .test-logs/tests__parcours__paiement-gratuits.test.ts.log
tests/parcours/paiement-operateur.test.ts              PASS     867ms     0     .test-logs/tests__parcours__paiement-operateur.test.ts.log
tests/parcours/paiement-reconciliation.test.ts         PASS     1.4s      0     .test-logs/tests__parcours__paiement-reconciliation.test.ts.log
tests/parcours/paiement-remboursement.test.ts          PASS     1.9s      0     .test-logs/tests__parcours__paiement-remboursement.test.ts.log
tests/parcours/paiement-reservation.test.ts            PASS     1.8s      0     .test-logs/tests__parcours__paiement-reservation.test.ts.log
tests/parcours/paiement-retour.test.ts                 PASS     643ms     0     .test-logs/tests__parcours__paiement-retour.test.ts.log
tests/parcours/paiement-statut.test.ts                 PASS     1.1s      0     .test-logs/tests__parcours__paiement-statut.test.ts.log
tests/parcours/paiement-webhook.test.ts                PASS     2.1s      0     .test-logs/tests__parcours__paiement-webhook.test.ts.log
tests/parcours/parrainage-gardes.test.ts               PASS     2.2s      0     .test-logs/tests__parcours__parrainage-gardes.test.ts.log
tests/parcours/parrainage-lien.test.ts                 PASS     2.2s      0     .test-logs/tests__parcours__parrainage-lien.test.ts.log
tests/parcours/partenaire-liste.test.ts                PASS     2.8s      0     .test-logs/tests__parcours__partenaire-liste.test.ts.log
tests/parcours/partenaire-lot7.test.ts                 PASS     6.3s      0     .test-logs/tests__parcours__partenaire-lot7.test.ts.log
tests/parcours/partenaire-profil-rpc.test.ts           PASS     5.7s      0     .test-logs/tests__parcours__partenaire-profil-rpc.test.ts.log
tests/parcours/perf-statique.test.ts                   PASS     2.4s      0     .test-logs/tests__parcours__perf-statique.test.ts.log
tests/parcours/pilotage-acces.test.ts                  PASS     12.6s     0     .test-logs/tests__parcours__pilotage-acces.test.ts.log
tests/parcours/pilotage-apercu-ventes.test.ts          PASS     3.2s      0     .test-logs/tests__parcours__pilotage-apercu-ventes.test.ts.log
tests/parcours/pilotage-cloture-export.test.ts         PASS     3.3s      0     .test-logs/tests__parcours__pilotage-cloture-export.test.ts.log
tests/parcours/pilotage-entrees.test.ts                PASS     17.0s     0     .test-logs/tests__parcours__pilotage-entrees.test.ts.log
tests/parcours/pilotage-equipe-caisse.test.ts          PASS     4.1s      0     .test-logs/tests__parcours__pilotage-equipe-caisse.test.ts.log
tests/parcours/pilotage-invariant.test.ts              PASS     3.7s      0     .test-logs/tests__parcours__pilotage-invariant.test.ts.log
tests/parcours/pilotage-remboursement-billet.test.ts   PASS     4.1s      0     .test-logs/tests__parcours__pilotage-remboursement-billet.test.ts.log
tests/parcours/pin-regisseur.test.ts                   PASS     394ms     0     .test-logs/tests__parcours__pin-regisseur.test.ts.log
tests/parcours/push-abonnements.test.ts                PASS     3.7s      0     .test-logs/tests__parcours__push-abonnements.test.ts.log
tests/parcours/push-service-worker.test.ts             PASS     911ms     0     .test-logs/tests__parcours__push-service-worker.test.ts.log
tests/parcours/pwa-manifest.test.ts                    PASS     1.2s      0     .test-logs/tests__parcours__pwa-manifest.test.ts.log
tests/parcours/rappels-gratuits.test.ts                PASS     3.3s      0     .test-logs/tests__parcours__rappels-gratuits.test.ts.log
tests/parcours/realtime-diagnostic.test.ts             PASS     585ms     0     .test-logs/tests__parcours__realtime-diagnostic.test.ts.log
tests/parcours/realtime-scanner.test.ts                PASS     13.4s     0     .test-logs/tests__parcours__realtime-scanner.test.ts.log
tests/parcours/recette-invariant.test.ts               PASS     1.8s      0     .test-logs/tests__parcours__recette-invariant.test.ts.log
tests/parcours/remboursement-relance.test.ts           PASS     2.6s      0     .test-logs/tests__parcours__remboursement-relance.test.ts.log
tests/parcours/revocation-sessions.test.ts             PASS     1.6s      0     .test-logs/tests__parcours__revocation-sessions.test.ts.log
tests/parcours/roles-fraicheur.test.ts                 PASS     834ms     0     .test-logs/tests__parcours__roles-fraicheur.test.ts.log
tests/parcours/roles-metadonnees.test.ts               PASS     587ms     0     .test-logs/tests__parcours__roles-metadonnees.test.ts.log
tests/parcours/scan-controleur-stats.test.ts           PASS     4.8s      0     .test-logs/tests__parcours__scan-controleur-stats.test.ts.log
tests/parcours/scan-idempotence.test.ts                PASS     3.7s      0     .test-logs/tests__parcours__scan-idempotence.test.ts.log
tests/parcours/scan-renvoi-seulement.test.ts           PASS     4.3s      0     .test-logs/tests__parcours__scan-renvoi-seulement.test.ts.log
tests/parcours/scanner-interface.test.ts               PASS     4.4s      0     .test-logs/tests__parcours__scanner-interface.test.ts.log
tests/parcours/scanner-reprise.test.ts                 PASS     1.0s      0     .test-logs/tests__parcours__scanner-reprise.test.ts.log
tests/parcours/securite-admin-lot7.test.ts             PASS     4.2s      0     .test-logs/tests__parcours__securite-admin-lot7.test.ts.log
tests/parcours/sms-anti-abus.test.ts                   PASS     786ms     0     .test-logs/tests__parcours__sms-anti-abus.test.ts.log
tests/parcours/sms-commande-4-billets.test.ts          PASS     1.4s      0     .test-logs/tests__parcours__sms-commande-4-billets.test.ts.log
tests/parcours/statut-compte.test.ts                   PASS     2.3s      0     .test-logs/tests__parcours__statut-compte.test.ts.log
tests/parcours/temps-reel-billets.test.ts              PASS     25.1s     0     .test-logs/tests__parcours__temps-reel-billets.test.ts.log
tests/parcours/temps-reel-hook.test.ts                 PASS     297ms     0     .test-logs/tests__parcours__temps-reel-hook.test.ts.log
tests/parcours/temps-reel-prives.test.ts               PASS     62.8s     0     .test-logs/tests__parcours__temps-reel-prives.test.ts.log
tests/parcours/temps-reel-public.test.ts               PASS     26.9s     0     .test-logs/tests__parcours__temps-reel-public.test.ts.log
tests/parcours/temps-reel-stock.test.ts                PASS     24.3s     0     .test-logs/tests__parcours__temps-reel-stock.test.ts.log
tests/parcours/sms-plafond-optionnel.test.ts           PASS     9.4s      0     .test-logs/tests__parcours__sms-plafond-optionnel.test.ts.log
tests/parcours/sms-veille.test.ts                      PASS     2.9s      0     .test-logs/tests__parcours__sms-veille.test.ts.log
tests/parcours/terrain-invariant.test.ts               PASS     1.4s      0     .test-logs/tests__parcours__terrain-invariant.test.ts.log
tests/partner-auth-complete.test.ts                    PASS     415ms     0     .test-logs/tests__partner-auth-complete.test.ts.log
tests/partner-halls-m7.test.ts                         PASS     1.3s      0     .test-logs/tests__partner-halls-m7.test.ts.log
tests/partner-orders-m9.test.ts                        PASS     1.3s      0     .test-logs/tests__partner-orders-m9.test.ts.log
tests/payment.test.ts                                  PASS     245ms     0     .test-logs/tests__payment.test.ts.log
tests/roles-isolation.test.ts                          PASS     247ms     0     .test-logs/tests__roles-isolation.test.ts.log
tests/samirpay-contrat.test.ts                         PASS     3.7s      0     .test-logs/tests__samirpay-contrat.test.ts.log
tests/scanner-combat-ui.test.ts                        PASS     409ms     0     .test-logs/tests__scanner-combat-ui.test.ts.log
tests/schema/essai-cron-local.test.ts                  PASS     948ms     0     .test-logs/tests__schema__essai-cron-local.test.ts.log
tests/schema/essai-env-local.test.ts                   PASS     732ms     0     .test-logs/tests__schema__essai-env-local.test.ts.log
tests/schema/essai-faux-samirpay.test.ts               PASS     1.6s      0     .test-logs/tests__schema__essai-faux-samirpay.test.ts.log
tests/schema/essai-integrations.test.ts                PASS     5.6s      0     .test-logs/tests__schema__essai-integrations.test.ts.log
tests/schema/essai-seed-gardes.test.ts                 PASS     761ms     0     .test-logs/tests__schema__essai-seed-gardes.test.ts.log
tests/schema/fonctions-privileges.test.ts              PASS     300ms     0     .test-logs/tests__schema__fonctions-privileges.test.ts.log
tests/schema/hotfix-identique.test.ts                  PASS     250ms     0     .test-logs/tests__schema__hotfix-identique.test.ts.log
tests/schema/hotfix-scripts.test.ts                    PASS     655ms     0     .test-logs/tests__schema__hotfix-scripts.test.ts.log
tests/schema/messages-bruts.test.ts                    PASS     1.4s      0     .test-logs/tests__schema__messages-bruts.test.ts.log
tests/schema/migration-lot6-rejouable.test.ts          PASS     371ms     0     .test-logs/tests__schema__migration-lot6-rejouable.test.ts.log
tests/schema/migration-lot7-rejouable.test.ts          PASS     1.2s      0     .test-logs/tests__schema__migration-lot7-rejouable.test.ts.log
tests/schema/migration-lot8-rejouable.test.ts          PASS     1.2s      0     .test-logs/tests__schema__migration-lot8-rejouable.test.ts.log
tests/schema/ordre-suites.test.ts                      PASS     439ms     0     .test-logs/tests__schema__ordre-suites.test.ts.log
tests/schema/planification-crons.test.ts               PASS     1.1s      0     .test-logs/tests__schema__planification-crons.test.ts.log
tests/schema/recette-matrice.test.ts                   PASS     333ms     0     .test-logs/tests__schema__recette-matrice.test.ts.log
tests/schema/reset-test-password.test.ts               PASS     271ms     0     .test-logs/tests__schema__reset-test-password.test.ts.log
tests/schema/rls-toutes-tables.test.ts                 PASS     259ms     0     .test-logs/tests__schema__rls-toutes-tables.test.ts.log
tests/schema/secrets-codes-en-dur.test.ts              PASS     333ms     0     .test-logs/tests__schema__secrets-codes-en-dur.test.ts.log
tests/security/anon-uniquement.test.ts                 PASS     240ms     0     .test-logs/tests__security__anon-uniquement.test.ts.log
tests/security/r1-inscription-roles.test.ts            PASS     1.3s      0     .test-logs/tests__security__r1-inscription-roles.test.ts.log
tests/security/r10-user-roles.test.ts                  PASS     1.3s      0     .test-logs/tests__security__r10-user-roles.test.ts.log
tests/security/r11-storage-documents.test.ts           PASS     602ms     0     .test-logs/tests__security__r11-storage-documents.test.ts.log
tests/security/r12-reglages-finance.test.ts            PASS     494ms     0     .test-logs/tests__security__r12-reglages-finance.test.ts.log
tests/security/r13-parrainage-relations.test.ts        PASS     695ms     0     .test-logs/tests__security__r13-parrainage-relations.test.ts.log
tests/security/r14-retraits-insertion.test.ts          PASS     552ms     0     .test-logs/tests__security__r14-retraits-insertion.test.ts.log
tests/security/r15-statut-ambassadeur.test.ts          PASS     557ms     0     .test-logs/tests__security__r15-statut-ambassadeur.test.ts.log
tests/security/r16-reglages-acces.test.ts              PASS     423ms     0     .test-logs/tests__security__r16-reglages-acces.test.ts.log
tests/security/r17-statut-evenement-rest.test.ts       PASS     442ms     0     .test-logs/tests__security__r17-statut-evenement-rest.test.ts.log
tests/security/r18-partenaires-public.test.ts          PASS     877ms     0     .test-logs/tests__security__r18-partenaires-public.test.ts.log
tests/security/r19-categories-transferts.test.ts       PASS     661ms     0     .test-logs/tests__security__r19-categories-transferts.test.ts.log
tests/security/r2-otp-codes.test.ts                    PASS     420ms     0     .test-logs/tests__security__r2-otp-codes.test.ts.log
tests/security/r20-evenements-ecritures-rest.test.ts   PASS     528ms     0     .test-logs/tests__security__r20-evenements-ecritures-rest.test.ts.log
tests/security/r21-notifications-rest.test.ts          PASS     888ms     0     .test-logs/tests__security__r21-notifications-rest.test.ts.log
tests/security/r22-reglages-notif.test.ts              PASS     569ms     0     .test-logs/tests__security__r22-reglages-notif.test.ts.log
tests/security/r23-reglages-lot7.test.ts               PASS     628ms     0     .test-logs/tests__security__r23-reglages-lot7.test.ts.log
tests/security/r24-categories-anon.test.ts             PASS     515ms     0     .test-logs/tests__security__r24-categories-anon.test.ts.log
tests/security/r25-commandes-idor.test.ts              PASS     943ms     0     .test-logs/tests__security__r25-commandes-idor.test.ts.log
tests/security/r26-brouillon-autre-partenaire.test.ts  PASS     1.5s      0     .test-logs/tests__security__r26-brouillon-autre-partenaire.test.ts.log
tests/security/r3-fonctions-rpc.test.ts                PASS     1.1s      0     .test-logs/tests__security__r3-fonctions-rpc.test.ts.log
tests/security/r4-ecritures-directes.test.ts           PASS     483ms     0     .test-logs/tests__security__r4-ecritures-directes.test.ts.log
tests/security/r5-lectures-anon.test.ts                PASS     981ms     0     .test-logs/tests__security__r5-lectures-anon.test.ts.log
tests/security/r6-roles-jeton.test.ts                  PASS     1.2s      0     .test-logs/tests__security__r6-roles-jeton.test.ts.log
tests/security/r7-profil-colonnes.test.ts              PASS     2.0s      0     .test-logs/tests__security__r7-profil-colonnes.test.ts.log
tests/security/r8-controleur-lectures.test.ts          PASS     2.0s      0     .test-logs/tests__security__r8-controleur-lectures.test.ts.log
tests/security/r9-partenaire-ecritures.test.ts         PASS     485ms     0     .test-logs/tests__security__r9-partenaire-ecritures.test.ts.log
tests/sms-formatage.test.ts                            PASS     320ms     0     .test-logs/tests__sms-formatage.test.ts.log
tests/superadmin-complete.test.ts                      PASS     361ms     0     .test-logs/tests__superadmin-complete.test.ts.log
tests/ux-performance-and-double-click.test.ts          PASS     675ms     0     .test-logs/tests__ux-performance-and-double-click.test.ts.log
──────────────────────────────────────────────────────
TOTAL : 220 suite(s) — 220 réussie(s), 0 en échec, 0 expirée(s)
```

```text
# run 107 — docs/lot8-logs/ci-run107-verify.log:25918-25925 puis 26174-26184
═══════════════ verify › build : npm run build ═══════════════

> event-village@1.0.0 build
> next build

  ▲ Next.js 14.2.35
  - Experiments (use with caution):
    · instrumentationHook
# […]
═══════════════ verify › js-budget : node scripts/js-budget.mjs ═══════════════
[JS-BUDGET] budgets : scripts/js-budget.json
[JS-BUDGET] / : 214735 octets gzip (214,7 Ko), 16 fichier(s) JS, 742650 octets bruts — budget 217000 octets (217,0 Ko) : OK
[JS-BUDGET] /events/[id] : 220686 octets gzip (220,7 Ko), 16 fichier(s) JS, 766708 octets bruts — budget 224000 octets (224,0 Ko) : OK
[JS-BUDGET] /tickets : 237729 octets gzip (237,7 Ko), 20 fichier(s) JS, 815236 octets bruts — budget 241000 octets (241,0 Ko) : OK
[JS-BUDGET] /controller/scanner : 222731 octets gzip (222,7 Ko), 17 fichier(s) JS, 770483 octets bruts — budget 226000 octets (226,0 Ko) : OK
[JS-BUDGET] /billet/hors-ligne : 211628 octets gzip (211,6 Ko), 15 fichier(s) JS, 735453 octets bruts — budget 215000 octets (215,0 Ko) : OK
[JS-BUDGET] tableau écrit : .verify/js-budget.tsv
[JS-BUDGET] toutes les routes budgétées sont dans leur budget.

[verify] OK — 5 étapes réussies en 811s.
```

### 6.3 Run 107, `npm run e2e`

Lignes de phase, de résultat et de test, hors captures (les 323 ✓ des projets `mobile` et `desktop` ne sont pas recopiés : `docs/lot8-logs/ci-run107-e2e.log`, lignes 26 à 398). Les sorties `[INVARIANT…]`, `[FAKE-PROD]`, `[PERF]` et `[HORS-LIGNE-TRANSFERE]` sont aux sections 4, 10, 13 et 8.

```text
# run 107 (bc864fa) — docs/lot8-logs/ci-run107-e2e.log, lignes filtrées (phases, ✓ et ✘ hors captures, résumés)
═══════════════ e2e › connexion : playwright test --project=setup ═══════════════
Running 10 tests using 2 workers
  ✓   2 [setup] › e2e/auth.setup.ts:26:10 › connexion : organisateur (démonstration) (2.3s)
  ✓   1 [setup] › e2e/auth.setup.ts:26:10 › connexion : administrateur (démonstration, events.read et events.write) (2.4s)
  ✓   4 [setup] › e2e/auth.setup.ts:26:10 › connexion : contrôleur (démonstration) (2.3s)
  ✓   3 [setup] › e2e/auth.setup.ts:26:10 › connexion : client (démonstration) (2.4s)
  ✓   5 [setup] › e2e/auth.setup.ts:26:10 › connexion : partenaire « premiers pas » (démonstration, aucun événement) (1.7s)
  ✓   6 [setup] › e2e/auth.setup.ts:26:10 › connexion : organisateur A (seed de test) (1.7s)
  ✓   7 [setup] › e2e/auth.setup.ts:26:10 › connexion : superadmin (seed de test) (1.9s)
  ✓   8 [setup] › e2e/auth.setup.ts:26:10 › connexion : client (seed de test) (1.9s)
  ✓   9 [setup] › e2e/auth.setup.ts:26:10 › connexion : second client (seed de test) (1.6s)
  ✓  10 [setup] › e2e/auth.setup.ts:26:10 › connexion : contrôleur A (seed de test) (1.7s)
  10 passed (11.0s)
[e2e] phase connexion : OK en 12s
═══════════════ e2e › captures : playwright test --project=mobile --project=desktop ═══════════════
Running 364 tests using 2 workers
[e2e] index des captures : .e2e-captures/captures/index.txt (323 entrée(s), 0 en échec)
  41 skipped
  323 passed (13.7m)
[e2e] phase captures : OK en 822s
═══════════════ e2e › emails : playwright test --project=emails --workers=1 ═══════════════
Running 5 tests using 1 worker
  ✓  1 [emails] › e2e/emails.spec.ts:142:9 › email achat-1-billet : 390 et 600 px, clair et sombre, sans ressource externe (1.1s)
  ✓  2 [emails] › e2e/emails.spec.ts:142:9 › email achat-4-billets : 390 et 600 px, clair et sombre, sans ressource externe (1.1s)
  ✓  3 [emails] › e2e/emails.spec.ts:142:9 › email achat-12-billets : 390 et 600 px, clair et sombre, sans ressource externe (1.1s)
  ✓  4 [emails] › e2e/emails.spec.ts:142:9 › email gratuits-2-billets : 390 et 600 px, clair et sombre, sans ressource externe (1.0s)
  ✓  5 [emails] › e2e/emails.spec.ts:142:9 › email transfert-recu : 390 et 600 px, clair et sombre, sans ressource externe (1.1s)
[e2e] index des captures : .e2e-captures/captures/index.txt (323 entrée(s), 0 en échec)
  5 passed (6.3s)
[e2e] phase emails : OK en 7s
═══════════════ e2e › dev-page : playwright test --project=dev-page --workers=1 ═══════════════
Running 4 tests using 1 worker
  ✓  1 [dev-page] › e2e/dev-page.spec.ts:53:13 › page de développement : mobile, clair (796ms)
  ✓  2 [dev-page] › e2e/dev-page.spec.ts:53:13 › page de développement : mobile, sombre (773ms)
  ✓  3 [dev-page] › e2e/dev-page.spec.ts:53:13 › page de développement : ordinateur, clair (653ms)
  ✓  4 [dev-page] › e2e/dev-page.spec.ts:53:13 › page de développement : ordinateur, sombre (687ms)
[e2e] index des captures : .e2e-captures/captures/index.txt (327 entrée(s), 0 en échec)
  4 passed (4.0s)
[e2e] phase dev-page : OK en 4s
═══════════════ e2e › fumee : playwright test --project=fumee ═══════════════
Running 2 tests using 1 worker
  ✓  1 [fumee] › e2e/fumee.spec.ts:91:5 › fumée : créer, soumettre, valider, publier, acheter, scanner, piloter (37.7s)
  ✓  2 [fumee] › e2e/fumee.spec.ts:604:5 › pages et routes de développement : 404 sur next start, avec et sans session (100ms)
[e2e] index des captures : .e2e-captures/captures/index.txt (327 entrée(s), 0 en échec)
  2 passed (38.8s)
[e2e] phase fumee : OK en 39s
═══════════════ e2e › terrain : playwright test --project=terrain --workers=1 ═══════════════
Running 13 tests using 1 worker
  ✓   1 [terrain] › e2e/terrain.spec.ts:119:9 › 1. téléphone en avance de 5 min : codes téléchargés, hors ligne, QR accepté par le contrôleur (3.4s)
  ✓   2 [terrain] › e2e/terrain.spec.ts:119:9 › 1. téléphone en retard de 5 min : codes téléchargés, hors ligne, QR accepté par le contrôleur (3.3s)
  ✓   3 [terrain] › e2e/terrain.spec.ts:154:5 › 2. cache du service worker : coquille hors ligne et ressources statiques seulement, anciens caches supprimés (2.1s)
  ✓   4 [terrain] › e2e/terrain.spec.ts:219:5 › 3. réponse du scan perdue : relance automatique avec la même clé, une seule entrée (2.3s)
  ✓   5 [terrain] › e2e/terrain.spec.ts:369:5 › 4. mesure du scan : billets neufs en réseau normal puis en 3G, relectures « déjà utilisé », puis une lecture hors ligne (1.6m)
  ✓   6 [terrain] › e2e/terrain.spec.ts:468:5 › 5. vibrations : accepté [60], refusé [120,60,120,60,120], motifs distincts, aucune vibration à la lecture (3.3s)
  ✓   7 [terrain] › e2e/terrain.spec.ts:506:5 › 6. onglet en arrière-plan : pistes de la caméra arrêtées (1.3s)
  ✓   8 [terrain] › e2e/terrain.spec.ts:604:5 › 7. reprise de session : même événement et même mode après une sortie, chiffres et historique relus, « Reprendre le contrôle », scan sans réponse renvoyé avec sa clé (8.0s)
  ✓   9 [terrain] › e2e/terrain.spec.ts:765:5 › 8. barre d’achat de la fiche : collée au bas de l’écran en haut de page et à mi-page, pleine largeur (1.5s)
  ✓  10 [terrain] › e2e/terrain.spec.ts:781:5 › 9. résultat du scanner : plein écran égal à la fenêtre, page défilée de force (1.7s)
  ✓  11 [terrain] › e2e/terrain.spec.ts:815:5 › 10. lot hors ligne : réponse compressée en gzip, moins de 40 000 octets transférés (1.3s)
  ✓  12 [terrain] › e2e/terrain.spec.ts:853:5 › 11. lecture jamais arrivée au serveur : au retour, « non traité », pas de « Résultat retrouvé », billet intact (2.9s)
  ✓  13 [terrain] › e2e/terrain.spec.ts:924:5 › 12. clôture de caisse avec écart, sans réponse imposée : refus 400, écart du serveur affiché, puis clôture juste (2.6s)
[e2e] index des captures : .e2e-captures/captures/index.txt (327 entrée(s), 0 en échec)
  13 passed (2.1m)
[e2e] phase terrain : OK en 129s
═══════════════ e2e › pwa : playwright test --project=pwa --workers=1 ═══════════════
Running 4 tests using 1 worker
  ✓  1 [pwa] › e2e/installable.spec.ts:109:5 › Chromium reconnaît l’application installable (beforeinstallprompt, aucune erreur d’installabilité) (1.2s)
  ✓  2 [pwa] › e2e/installable.spec.ts:147:5 › témoin négatif : manifest servi sans icône → Chromium signale l’icône manquante (885ms)
  ✓  3 [pwa] › e2e/installable.spec.ts:166:5 › manifest servi : id, scope, start_url, standalone, couleurs, icônes 192 et 512 dont une maskable (contrat 4.5) (166ms)
  ✓  4 [pwa] › e2e/installable.spec.ts:193:5 › iPhone : balises apple-mobile-web-app et icône apple-touch 180×180 dans le <head> de l’accueil (465ms)
[e2e] index des captures : .e2e-captures/captures/index.txt (327 entrée(s), 0 en échec)
  4 passed (3.4s)
[e2e] phase pwa : OK en 4s
═══════════════ e2e › fake-prod : node scripts/e2e/fake-prod.mjs ═══════════════
[e2e] phase fake-prod : OK en 1s
═══════════════ e2e › perf : playwright test --project=perf --workers=1 ═══════════════
Running 4 tests using 1 worker
  ✓  1 [perf] › e2e/perf.spec.ts:374:9 › Accueil : premier affichage utile et JavaScript chargé, 4G simulée et processeur ×4 (5 passages) (40.6s)
  ✓  2 [perf] › e2e/perf.spec.ts:374:9 › Page événement : premier affichage utile et JavaScript chargé, 4G simulée et processeur ×4 (5 passages) (40.1s)
  ✓  3 [perf] › e2e/perf.spec.ts:374:9 › Mes billets : premier affichage utile et JavaScript chargé, 4G simulée et processeur ×4 (5 passages) (46.6s)
  ✓  4 [perf] › e2e/perf.spec.ts:374:9 › Scanner : premier affichage utile et JavaScript chargé, 4G simulée et processeur ×4 (5 passages) (56.4s)
[e2e] index des captures : .e2e-captures/captures/index.txt (327 entrée(s), 0 en échec)
  4 passed (3.1m)
[e2e] phase perf : OK en 185s
═══════════════ e2e › recette : playwright test --project=recette --workers=1 ═══════════════
Running 8 tests using 1 worker
  ✓  1 [recette] › e2e/recette.spec.ts:285:5 › acte 1 [admin] : délai de garde coupé à l’écran, motif exigé, historique ; un ADMIN est refusé (2.3s)
  ✓  2 [recette] › e2e/recette.spec.ts:323:5 › acte 2 [partenaire] [admin] : inscription avec pièces, validation, E1 et ses canaux, soumission, publication, E2 (7.2s)
  ✓  3 [recette] › e2e/recette.spec.ts:453:5 › acte 3 [partenaire] : invitation de K1, permission espèces, point d’entrée, PIN régisseur (1.5s)
  ✓  4 [recette] › e2e/recette.spec.ts:487:5 › acte 4 [client] : découverte, fiche, refus direct, inscription depuis l’achat, achats, Mes billets, transfert (17.4s)
  ✓  5 [recette] › e2e/recette.spec.ts:616:5 › acte 5 [contrôleur] : activation, caisse, scan en ligne et hors ligne, ancien code, saisie manuelle, guichet, reprise, clôture (16.9s)
  ✓  6 [recette] › e2e/recette.spec.ts:728:5 › acte 6 [partenaire] : pilotage, rapport de clôture, export, retrait, remboursement d’un billet à l’écran (4.4s)
  ✓  7 [recette] › e2e/recette.spec.ts:797:5 › acte 7 [client] [partenaire] : annulation de E2, envoyeur par la vraie route, billet remboursé, avis, bandeau public (1.8s)
  ✓  8 [recette] › e2e/recette.spec.ts:841:5 › acte 8 [admin] : supervision et relance d’une notification, remboursement bloqué relancé (A3), événement et partenaire suspendus (5.7s)
[e2e] index des captures : .e2e-captures/captures/index.txt (327 entrée(s), 0 en échec)
  8 passed (1.1m)
[e2e] phase recette : OK en 65s
[e2e] durées : connexion 12s · captures 822s · emails 7s · dev-page 4s · fumee 39s · terrain 129s · pwa 4s · fake-prod 1s · perf 185s · recette 65s — total 1268s (21.1 min)
[e2e] résumé :connexion OK · captures OK · emails OK · dev-page OK · fumee OK · terrain OK · pwa OK · fake-prod OK · perf OK · recette OK
```

### 6.4 Run 107, CI (`run.txt`)

```text
# runs/107-42334500969/run.txt (ci-results) = docs/lot8-logs/ci-run107-run.txt
run_id=42334500969
run_number=107
sha=bc864fadd072badff2df6c9310e50bedc13b5fac
ref=refs/heads/lot8/recette
job_status=success
build_mesure=skipped
e2e_seed=success
e2e=success
url=https://github.com/fallouu-mn/event-village/actions/runs/42334500969
job_elapsed_s=2261
npm_version=10.9.9
etape_npm-ci=debut_s:4 duree_s:9 code:0
etape_supabase-start=debut_s:15 duree_s:64 code:0
etape_db-reset=debut_s:79 duree_s:27 code:0
etape_env-test=debut_s:106 duree_s:1 code:0
etape_seed-test=debut_s:107 duree_s:2 code:0
etape_verify=debut_s:109 duree_s:811 code:0
etape_e2e-chromium=debut_s:922 duree_s:9 code:0
etape_e2e-env=debut_s:931 duree_s:1 code:0
etape_e2e-seed=debut_s:932 duree_s:50 code:0
etape_e2e-demarrage=debut_s:982 duree_s:3 code:0
etape_e2e=debut_s:985 duree_s:1267 code:0

```

Le job dure 2 261 s (37,7 min), sous le délai de 60 min rétabli par `a03abe6` (L77) ; l’étape e2e dure 1 267 s, sous son délai de 50 min (AM5).

### 6.5 Tableau des runs 92 à 107

Lu sur `ci-results` (copie locale `origin/ci-results`) : `run.txt` (SHA, statut, `job_elapsed_s`), ligne `TOTAL` de `verify.log`, dernière ligne « index des captures » et « résumé » de `e2e.log`. Les durées sont `job_elapsed_s`.

| Run | SHA | Statut | verify | Captures (index) | Fumée | Recette | Durée (s) | Cause d’échec ou remarque |
|---|---|---|---|---|---|---|---|---|
| 92 | `7fdcb32` | failure | 181/181 | 286, 0 en échec | ÉCHEC | — | 1854 | fumée : case à cocher forcée jugée hors de l’écran (A20) ; corrigé seul par `ef2b36b`, premier commit du lot |
| 93 | `7fdcb32` | success | 181/181 | 286, 0 en échec | OK | — | 2727 | — |
| 94 | `7fdcb32` | success | 181/181 | 286, 0 en échec | OK | — | 2041 | — |
| 95 | `db21d1c` | failure | 172/219 | 323, 43 en échec | ÉCHEC | NON LANCÉE | 2668 | run « avant » : 47 rouges attendues (triage) ; captures (43 en échec, écrans pas encore livrés), dev-page, fumée, terrain, fake-prod en échec ; recette absente |
| 96 | `8f77b1b` | failure | 203/219 | 323, 32 en échec | OK | NON LANCÉE | 2318 | avant la vague E : 16 suites rouges, surtout des écrans ; second cycle de verrous (`course-confirmation-annulation` cas 3, AM14) |
| 97 | `621c804` | failure | 216/219 | 327, 8 en échec | OK | NON LANCÉE | 2536 | 3 suites : `course-confirmation-annulation` cas 6 (contrôle statique, renforcé par `a8c653b`), `otp-serveur` (A35) et `pilotage-remboursement-billet` (A36), rouges écrits avant leur correctif ; captures en échec |
| 98 | `6ea04e4` | failure | 220/220 | 327, 0 en échec | OK | ÉCHEC | 2261 | recette, acte 2 : sélecteur du dialogue de validation (corrigé par `0de9979`) |
| 99 | `f6fcebd` | failure | build seul | non lancées | non lancée | manuel : ÉCHEC | 394 | run ciblé `[recette-seule]` (`f6fcebd`) : verify réduit au build, échec par construction ; acte 4 : A41 trouvée |
| 100 | `c532ca7` | failure | build seul | non lancées | non lancée | manuel : ÉCHEC | 413 | run ciblé : acte 5 (numéro du billet renouvelé par le transfert, `86868ae`) |
| 101 | `86868ae` | failure | build seul | non lancées | non lancée | manuel : ÉCHEC | 414 | run ciblé : acte 6 (fichier d’export lu dans la réponse, `40e2473`) |
| 102 | `40e2473` | failure | build seul | non lancées | non lancée | manuel : ÉCHEC | 826 | run ciblé : acte 8 bloqué 6 min sur `response.text()` (`f4a66d0`) |
| 103 | `f4a66d0` | failure | build seul | non lancées | non lancée | manuel : OK | 447 | run ciblé : 18 tests verts, job en échec par construction |
| 104 | `ff4aae0` | failure | 219/220 | 327, 0 en échec | OK | OK | 2180 | `tests/partner-orders-m9.test.ts` : collision de numéro de téléphone (voir 6.6), corrigée par `da0dcef` |
| 105 | `a03abe6` | success | 220/220 | 327, 0 en échec | OK | OK | 2630 | — |
| 106 | `f488be0` | success | 220/220 | 327, 0 en échec | OK | OK | 2116 | — (même code d’application que 105, L82) |
| 107 | `bc864fa` | success | 220/220 | 327, 0 en échec | OK | OK | 2261 | — (code final) |

Sources brutes de ce tableau (une ligne par run, valeurs telles que lues) :

```text
92-42066164370 | sha=7fdcb32 | failure | job_elapsed_s=1854 | TOTAL : 181 suite(s) — 181 réussie(s), 0 en échec, 0 expirée(s) | résumé=connexion OK · captures OK · emails OK · fumee ÉCHEC · terrain OK · pwa OK · perf OK
93-42066175040 | sha=7fdcb32 | success | job_elapsed_s=2727 | TOTAL : 181 suite(s) — 181 réussie(s), 0 en échec, 0 expirée(s) | résumé=connexion OK · captures OK · emails OK · fumee OK · terrain OK · pwa OK · perf OK
94-42242724246 | sha=7fdcb32 | success | job_elapsed_s=2041 | TOTAL : 181 suite(s) — 181 réussie(s), 0 en échec, 0 expirée(s) | résumé=connexion OK · captures OK · emails OK · fumee OK · terrain OK · pwa OK · perf OK
95-42276458389 | sha=db21d1c | failure | job_elapsed_s=2668 | TOTAL : 219 suite(s) — 172 réussie(s), 47 en échec, 0 expirée(s) | résumé=connexion OK · captures ÉCHEC · emails OK · dev-page ÉCHEC · fumee ÉCHEC · terrain ÉCHEC · pwa OK · fake-prod ÉCHEC · perf OK · recette NON LANCÉE
96-42295220467 | sha=8f77b1b | failure | job_elapsed_s=2318 | TOTAL : 219 suite(s) — 203 réussie(s), 16 en échec, 0 expirée(s) | résumé=connexion OK · captures ÉCHEC · emails OK · dev-page ÉCHEC · fumee OK · terrain ÉCHEC · pwa OK · fake-prod OK · perf OK · recette NON LANCÉE
97-42301401029 | sha=621c804 | failure | job_elapsed_s=2536 | TOTAL : 219 suite(s) — 216 réussie(s), 3 en échec, 0 expirée(s) | résumé=connexion OK · captures ÉCHEC · emails OK · dev-page OK · fumee OK · terrain OK · pwa OK · fake-prod OK · perf OK · recette NON LANCÉE
98-42307727821 | sha=6ea04e4 | failure | job_elapsed_s=2261 | TOTAL : 220 suite(s) — 220 réussie(s), 0 en échec, 0 expirée(s) | résumé=connexion OK · captures OK · emails OK · dev-page OK · fumee OK · terrain OK · pwa OK · fake-prod OK · perf OK · recette ÉCHEC
99-42314443175 | sha=f6fcebd | failure | job_elapsed_s=394 | TOTAL absent | résumé=-
100-42315379887 | sha=c532ca7 | failure | job_elapsed_s=413 | TOTAL absent | résumé=-
101-42316300730 | sha=86868ae | failure | job_elapsed_s=414 | TOTAL absent | résumé=-
102-42317225121 | sha=40e2473 | failure | job_elapsed_s=826 | TOTAL absent | résumé=-
103-42318858634 | sha=f4a66d0 | failure | job_elapsed_s=447 | TOTAL absent | résumé=-
104-42319749554 | sha=ff4aae0 | failure | job_elapsed_s=2180 | TOTAL : 220 suite(s) — 219 réussie(s), 1 en échec, 0 expirée(s) | résumé=connexion OK · captures OK · emails OK · dev-page OK · fumee OK · terrain OK · pwa OK · fake-prod OK · perf OK · recette OK
105-42323674856 | sha=a03abe6 | success | job_elapsed_s=2630 | TOTAL : 220 suite(s) — 220 réussie(s), 0 en échec, 0 expirée(s) | résumé=connexion OK · captures OK · emails OK · dev-page OK · fumee OK · terrain OK · pwa OK · fake-prod OK · perf OK · recette OK
106-42328234330 | sha=f488be0 | success | job_elapsed_s=2116 | TOTAL : 220 suite(s) — 220 réussie(s), 0 en échec, 0 expirée(s) | résumé=connexion OK · captures OK · emails OK · dev-page OK · fumee OK · terrain OK · pwa OK · fake-prod OK · perf OK · recette OK
107-42334500969 | sha=bc864fa | success | job_elapsed_s=2261 | TOTAL : 220 suite(s) — 220 réussie(s), 0 en échec, 0 expirée(s) | résumé=connexion OK · captures OK · emails OK · dev-page OK · fumee OK · terrain OK · pwa OK · fake-prod OK · perf OK · recette OK
```

Remarques :
- **Le run 92 n’apparaît pas dans l’addendum du lot 7** (`docs/lot7-rapport.md`, section 16, tableau des runs 85 à 91). C’est le premier run sur `7fdcb32`, le `main` du lot 7 ; il est rouge sur la fumée, puis les runs 93 et 94 sont verts sur le même commit. Le correctif (`ef2b36b`) est le premier commit du lot 8 (AR2, L78) ; c’est l’anomalie A20.
- `scratchpad/runs-table.txt` coupe la colonne des phases (runs 95, 97, 98, 104 et 105, parfois au milieu d’un caractère) ; le tableau ci-dessus a été relu sur les `e2e.log` de `ci-results`, pas sur ce fichier.
- Les runs 99 à 103 viennent du marqueur temporaire `[recette-seule]` (`f6fcebd`, retiré par `ff4aae0`) : verify réduit au build, seuls `setup` et `recette` joués, job toujours en échec. Ils ne prouvent rien sur le lot ; ils ont servi à mettre au point le parcours (7 min par essai au lieu de 40).
- Durée : les runs complets du lot vont de 2 116 s (106) à 2 668 s (95). Le délai du job est revenu de 75 à 60 min (`a03abe6`, L77) sur la base des runs 96, 97, 98 et 104 ; les runs 105 à 107 tiennent sous 45 min.

### 6.6 Instabilité observée une fois : `partner-orders-m9` au run 104

```text
# run 104 (ff4aae0) — runs/104-42319749554/verify.log:19743-19792 (ci-results), bruit YAML retiré
━━━ tests/partner-orders-m9.test.ts ━━━
TAP version 13
# Subtest: Test 1 : CRUD PRODUIT - Créer catégorie + produit, modifier, changer statut
ok 1 - Test 1 : CRUD PRODUIT - Créer catégorie + produit, modifier, changer statut
# Subtest: Test 2 : CRÉATION COMMANDE & CALCUL FINANCIER
not ok 2 - Test 2 : CRÉATION COMMANDE & CALCUL FINANCIER
  error: 'Création utilisateurs échouée: Phone number already registered by another user'
# Subtest: Test 3 : CYCLE STATUTS
ok 3 - Test 3 : CYCLE STATUTS
# Subtest: Test 4 : BLOCAGE PRODUIT INTERDIT
ok 4 - Test 4 : BLOCAGE PRODUIT INTERDIT
# Subtest: Test 5 : ANNULATION & RÉGULARISATION STOCK
ok 5 - Test 5 : ANNULATION & RÉGULARISATION STOCK
1..5
# tests 5
# suites 0
# pass 4
# fail 1
# cancelled 0
# skipped 0
# todo 0
```

Cause : le numéro tiré au hasard par la suite (`Math.random`) était déjà pris par un autre compte de la base de test ; ce type de collision était déjà décrit au run 86 dans `tests/parcours/helpers.ts`. `da0dcef` fait passer les 7 dernières suites qui tiraient un numéro par `Math.random` par `randomSenegalPhone` (préfixe 78, hors de l’espace des comptes en masse). Tests existants modifiés, aucune assertion touchée (signalé en section 1). La suite est verte aux runs 105, 106 et 107 :

```text
# run 107 — docs/lot8-logs/ci-run107-verify.log:25862
tests/partner-orders-m9.test.ts                        PASS     1.3s      0     .test-logs/tests__partner-orders-m9.test.ts.log
```

Une seule occurrence en 16 runs ; je ne peux pas exclure d’autres collisions dans les suites qui tirent encore un numéro autrement : NON VÉRIFIÉ.

---

---

## 7. Commissions de parrainage : règle et exemple chiffré

**Règle appliquée** (`supabase/migrations/20261106000004_lot8_commissions.sql`, commit `6611462`, contrat 6.3, L36) :

```text
à la vente (calculate_referral_commissions) :
  N1 = min(arrondi(net × taux N1), net)
  N2 = min(arrondi(net × taux N2), net − N1)        (N2 nul : aucune ligne)
  uncapped_amount = montant calculé si plafonné, sinon NULL
au remboursement partiel (fin_referral_on_refund) :
  budget = max(net − net déjà remboursé, 0)
  pour chaque commission : nouveau = min(prorata, budget) ; budget = budget − min(nouveau, montant en cours)
```

**Pourquoi.** Avec la grille actuelle (N1 5 %, N2 2 %), le dépassement est impossible à la vente : la force brute du contrat (`scratchpad/lot8-commissions-brute.py`, net de 0,01 à 2 000 F) le montre. Il était possible en base, les taux n’ayant pas de plafond, et **réel après un remboursement partiel** avec la grille : panier à deux prix, porteur `EVENT_VILLAGE`.

**Extension de la consigne, à lire (★ L36).** La consigne 8.2 c demande de plafonner à la vente. Le lot applique le même budget au remboursement partiel, seul cas de dépassement réel avec la grille. Effet signalé par l’agent S2 : le budget s’applique aussi à des paniers à prix égaux ; par exemple 10 billets de 1 000 F dont 9 remboursés donnent un net effectif de −107,50 F, donc des commissions à 0 au lieu d’un dixième du prorata. C’est voulu par (r2).

**Exemple chiffré** (contrat 6.3, montants en F CFA) :

| Cas | Net Event Village | N1 | N2 | Reste à Event Village |
|---|---|---|---|---|
| Billet de 1 000 F, frais 50, total 1 050, agrégateur 15,75 ; grille 5/2 | 34,25 | 1,71 | 0,69 | 31,85 |
| Même billet, taux fabriqués 80/30, **avant** le lot | 34,25 | 27,40 | 10,28 | −3,43 |
| Même billet, taux 80/30, **après** le lot | 34,25 | 27,40 | 6,85 (plafonnée, `uncapped_amount` 10,28) | 0 |
| Panier 10 000 + 100 F, grille 5/2, à la vente | 345,92 | 17,30 | 6,92 | 321,70 |
| Même panier, billet de 10 000 F remboursé (réversion 500, net effectif −154,08), **avant** | −154,08 | 0,17 restant | 0,07 restant | — |
| Même panier, même remboursement, **après** | −154,08 | 0 (annulée) | 0 (annulée) | — |

Les chiffres de la dernière colonne sont calculés ici (net − N1 − N2) ; les autres viennent du contrat et sont exigés par le test :

```text
# run 95 (db21d1c, « avant ») — tests/parcours/commissions-plafond.test.ts (docs/lot8-logs/ci-run95-verify.log:7774 ; lignes duration_ms, type, location et piles d’appels retirées)
━━━ tests/parcours/commissions-plafond.test.ts ━━━
# Subtest: 8.2 c — plafond à la vente : N1 = min(calcul, net), N2 = min(calcul, net − N1)
    # Subtest: 1. relation à 80/30 sur 1 000 F : N1 27,40 F, N2 6,85 F, uncapped_amount 10,28 F, grand livre égal
    not ok 1 - 1. relation à 80/30 sur 1 000 F : N1 27,40 F, N2 6,85 F, uncapped_amount 10,28 F, grand livre égal
      error: |-
        N2 plafonnée au reste du net (34,25 − 27,40), calculée 10.28 F
      expected: 685
      actual: 1028
    # Subtest: 2. relation à 100/100 : N1 = net, aucune ligne N2
    not ok 2 - 2. relation à 100/100 : N1 = net, aucune ligne N2
      error: |-
        une seule ligne, N1 = net : [{"gen":"N1","kind":"COMMISSION","status":"PENDING","amount":34.25,"reason":null},{"gen":"N2","kind":"COMMISSION","status":"PENDING","amount":34.25,"reason":null}]
        + actual - expected
        +   [
        +     'N2',
        +     3425
        +   ]
      expected:
      actual:
    # Subtest: 2 bis. relation à 120/10 : N1 plafonnée au net avec sa trace, aucune ligne N2
    not ok 3 - 2 bis. relation à 120/10 : N1 plafonnée au net avec sa trace, aucune ligne N2
      error: |-
        N1 = net, calculée 41,10 F : [{"gen":"N1","kind":"COMMISSION","status":"PENDING","amount":41.1,"reason":null},{"gen":"N2","kind":"COMMISSION","status":"PENDING","amount":3.43,"reason":null}]
        + actual - expected
        +     4110
        -     3425
        +   [
        +     'N2',
        +     343
        +   ]
      expected:
      actual:
    # Subtest: 3. témoin : la grille 5/2 donne 1,71 F et 0,69 F, sans trace de plafond
    not ok 4 - 3. témoin : la grille 5/2 donne 1,71 F et 0,69 F, sans trace de plafond
      error: 'colonne referral_commissions.uncapped_amount absente — contrat 2.7, migration 20261106000004'
      expected: true
      actual: false
[INVARIANT-RECETTE] recetteViolations — schéma du lot 8 incomplet : 8 objet(s) manquant(s)
[INVARIANT-RECETTE]   colonne public.ticket_categories.sale_online absente — canaux de vente (contrat 2.4, migration 20261106000001)
[INVARIANT-RECETTE]   colonne public.ticket_categories.sale_counter absente — canaux de vente (contrat 2.4, migration 20261106000001)
[INVARIANT-RECETTE]   colonne public.tickets.sale_decision absente — instantané de la décision de vente (contrat 2.4, migration 20261106000001)
[INVARIANT-RECETTE]   colonne public.stock_reservations.sale_online_at_checkout absente — instantané au checkout (contrat 2.4, migration 20261106000001)
[INVARIANT-RECETTE]   colonne public.referral_commissions.uncapped_amount absente — trace du plafond des commissions (contrat 2.7, migration 20261106000004)
[INVARIANT-RECETTE]   trigger trg_tickets_sale_decision absent de public.tickets — instantané de la vente (contrat 2.4, migration 20261106000001)
[INVARIANT-RECETTE]   trigger trg_stock_reservations_sale_online absent de public.stock_reservations — instantané de la vente (contrat 2.4, migration 20261106000001)
[INVARIANT-RECETTE]   fonction public.payment_duplicate_of absente — paiement en double (contrat 6.1, migration 20261106000003)
    # Subtest: 4. frais à 0 % : net négatif, aucune commission, aucune violation de (r)
    not ok 5 - 4. frais à 0 % : net négatif, aucune commission, aucune violation de (r)
      error: |-
        schéma du lot 8 incomplet (recetteViolations) : invariants (r)(s)(t) impossibles à vérifier :
        + actual - expected
        + [
        +   'colonne public.ticket_categories.sale_online absente — canaux de vente (contrat 2.4, migration 20261106000001)',
        +   'colonne public.ticket_categories.sale_counter absente — canaux de vente (contrat 2.4, migration 20261106000001)',
        +   'colonne public.tickets.sale_decision absente — instantané de la décision de vente (contrat 2.4, migration 20261106000001)',
        +   'colonne public.stock_reservations.sale_online_at_checkout absente — instantané au checkout (contrat 2.4, migration 20261106000001)',
        +   'colonne public.referral_commissions.uncapped_amount absente — trace du plafond des commissions (contrat 2.7, migration 20261106000004)',
        +   'trigger trg_tickets_sale_decision absent de public.tickets — instantané de la vente (contrat 2.4, migration 20261106000001)',
        +   'trigger trg_stock_reservations_sale_online absent de public.stock_reservations — instantané de la vente (contrat 2.4, migration 20261106000001)',
        +   'fonction public.payment_duplicate_of absente — paiement en double (contrat 6.1, migration 20261106000003)'
        + ]
        - []
      expected:
      actual:
not ok 1 - 8.2 c — plafond à la vente : N1 = min(calcul, net), N2 = min(calcul, net − N1)
  error: '5 subtests failed'
# Subtest: 8.2 c — plafond au remboursement partiel : budget = max(net − net remboursé, 0)
    # Subtest: 5. panier 10 000 + 100 F, remboursement du gros billet, net effectif −154,08 F : commissions annulées, soldes à 0
    not ok 1 - 5. panier 10 000 + 100 F, remboursement du gros billet, net effectif −154,08 F : commissions annulées, soldes à 0
      error: |-
# [… 74 ligne(s) de plus, non recopiées : docs/lot8-logs/ci-run95-verify.log]
```

```text
# run 107 (bc864fa, « après ») — tests/parcours/commissions-plafond.test.ts (docs/lot8-logs/ci-run107-verify.log:3313 ; lignes duration_ms, type, location et piles d’appels retirées)
━━━ tests/parcours/commissions-plafond.test.ts ━━━
TAP version 13
# Subtest: 8.2 c — plafond à la vente : N1 = min(calcul, net), N2 = min(calcul, net − N1)
    # Subtest: 1. relation à 80/30 sur 1 000 F : N1 27,40 F, N2 6,85 F, uncapped_amount 10,28 F, grand livre égal
    ok 1 - 1. relation à 80/30 sur 1 000 F : N1 27,40 F, N2 6,85 F, uncapped_amount 10,28 F, grand livre égal
    # Subtest: 2. relation à 100/100 : N1 = net, aucune ligne N2
    ok 2 - 2. relation à 100/100 : N1 = net, aucune ligne N2
    # Subtest: 2 bis. relation à 120/10 : N1 plafonnée au net avec sa trace, aucune ligne N2
    ok 3 - 2 bis. relation à 120/10 : N1 plafonnée au net avec sa trace, aucune ligne N2
    # Subtest: 3. témoin : la grille 5/2 donne 1,71 F et 0,69 F, sans trace de plafond
    ok 4 - 3. témoin : la grille 5/2 donne 1,71 F et 0,69 F, sans trace de plafond
    # Subtest: 4. frais à 0 % : net négatif, aucune commission, aucune violation de (r)
    ok 5 - 4. frais à 0 % : net négatif, aucune commission, aucune violation de (r)
    1..5
ok 1 - 8.2 c — plafond à la vente : N1 = min(calcul, net), N2 = min(calcul, net − N1)
# Subtest: 8.2 c — plafond au remboursement partiel : budget = max(net − net remboursé, 0)
    # Subtest: 5. panier 10 000 + 100 F, remboursement du gros billet, net effectif −154,08 F : commissions annulées, soldes à 0
    ok 1 - 5. panier 10 000 + 100 F, remboursement du gros billet, net effectif −154,08 F : commissions annulées, soldes à 0
    # Subtest: 6. même panier, N1 déjà versée par un retrait : régularisation jusqu’à 0, créance du déjà versé
    ok 2 - 6. même panier, N1 déjà versée par un retrait : régularisation jusqu’à 0, créance du déjà versé
    # Subtest: 7. témoin : 2 billets de 1 000 F, un remboursé : prorata inchangé, 1,72 F et 0,69 F (finance-commissions:375)
    ok 3 - 7. témoin : 2 billets de 1 000 F, un remboursé : prorata inchangé, 1,72 F et 0,69 F (finance-commissions:375)
    # Subtest: 8. relation à 80/30, 2 billets de 1 000 F, un remboursé : budget 18,50 F, N1 coupée avec sa trace, N2 annulée
    ok 4 - 8. relation à 80/30, 2 billets de 1 000 F, un remboursé : budget 18,50 F, N1 coupée avec sa trace, N2 annulée
    1..4
ok 2 - 8.2 c — plafond au remboursement partiel : budget = max(net − net remboursé, 0)
[INVARIANT] commissions-plafond — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] commissions-plafond — purge des réservations échues : {"expired":0}
[INVARIANT] commissions-plafond — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] commissions-plafond — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] commissions-plafond — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] commissions-plafond — cron events_finish_overdue : 0 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] commissions-plafond — (j)(k)(l) : 0 violation(s)
[notifications] Canal push désactivé : variables VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY et VAPID_SUBJECT absentes. Les notifications partent dans l'application et par SMS.
[INVARIANT-NOTIF] commissions-plafond — envoyeur : 243 ligne(s) réservée(s), 0 reprise(s)
[INVARIANT-NOTIF] commissions-plafond — (m)(n)(o) : 0 violation(s)
[INVARIANT-TERRAIN] commissions-plafond — (p)(q) : 0 violation(s)
[INVARIANT-RECETTE] commissions-plafond — (r)(s)(t) : 0 violation(s)
1..2
# tests 9
# suites 2
# pass 9
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 5523.490225
```

Le témoin du lot 3 (`finance-commissions.test.ts:375`, prorata 1,72 + 0,69 F) est rejoué tel quel par le cas 7 ci-dessus. L’invariant (r) est à 0 partout au run 107 (section 4).

**Écart avec l’Annexe A du cahier des charges (N2 à 2 % ou 3 %).** La consigne fixe N2 à 2 % (« Le taux N2 reste à 2 % (décision) »). Le cahier des charges prévoit 3 % pour une seule ligne de sa grille, l’Ambassadeur qui parraine un prestataire (`docs/CDC-V3.md:704-711`, tel quel) :

```text
# docs/CDC-V3.md:704-713 et 718-719
## ANNEXE A — GRILLE FINALE DU PARRAINAGE

| Profil | Filleul | N1 | N2 | Durée |
|---|---|---|---|---|
| Client standard | Client | 5 % | 2 % | 12 mois |
| Client standard | Prestataire | 7 % | 2 % | 24 mois |
| Ambassadeur | Client | 7 % | 2 % | 24 mois |
| Ambassadeur | Prestataire | 10 % | 3 % | 36 mois |

Base dans tous les cas : Revenu net Event Village éligible.
[…]
## ANNEXE C — EXEMPLE TICKETING
Ticket 1 000 F ; Frais 50 F ; Total 1 050 F ; Agrégateur 15,75 F ; Organisateur 1 000 F ; Revenu net Event Village 34,25 F. Client standard : N1 5 % 1,71 F ; N2 2 % 0,69 F. Ambassadeur : N1 7 % 2,40 F ; N2 3 % 1,03 F.
```

Le lot ne tranche pas (L37) : la ligne 10/3 reste en base, inatteignable, car le parrainage prestataire n’existe pas (A5, PO15). La question est posée au client en section 12.

---

---

## 8. Taille réelle du lot de codes hors ligne

**Mesure dans le navigateur** (e2e `terrain` 10, `e2e/terrain.spec.ts`, lot d’un billet gratuit, `access.scan_window_before_hours` porté à 24 ; le nombre de codes du lot n’est pas imprimé par ce test) :

```text
# run 95 (db21d1c, « avant ») — docs/lot8-logs/ci-run95-e2e.log:2549-2552
[e2e][terrain] taille du lot : événement 0b79e9d8-45b1-44a5-80d6-eea973872d83 (début 2026-11-07T15:45:00.000Z), 1 billet(s) gratuit(s) de client, access.scan_window_before_hours 6 → 24
[HORS-LIGNE-TRANSFERE] content-encoding=aucun encodedBodySize=33162 decodedBodySize=33162 transferSize=33462 responseBodySize=33175 responseHeadersSize=393
[e2e][terrain] access.scan_window_before_hours remis à 6
  ✘  11 [terrain] › e2e/terrain.spec.ts:825:5 › 10. lot hors ligne : réponse compressée en gzip, moins de 40 000 octets transférés (1.8s)
```

```text
# run 107 (bc864fa, « après ») — docs/lot8-logs/ci-run107-e2e.log:627-630
[e2e][terrain] taille du lot : événement c3866619-ea03-4f64-9b73-c87c1a5ea56e (début 2026-11-08T00:10:00.000Z), 1 billet(s) gratuit(s) de client, access.scan_window_before_hours 6 → 24
[HORS-LIGNE-TRANSFERE] content-encoding=gzip encodedBodySize=16430 decodedBodySize=33228 transferSize=16730 responseBodySize=16443 responseHeadersSize=440
[e2e][terrain] access.scan_window_before_hours remis à 6
  ✓  11 [terrain] › e2e/terrain.spec.ts:815:5 › 10. lot hors ligne : réponse compressée en gzip, moins de 40 000 octets transférés (1.3s)
```

```text
# run 105 (a03abe6) — docs/lot8-logs/ci-run105-e2e.log:633
[HORS-LIGNE-TRANSFERE] content-encoding=gzip encodedBodySize=16394 decodedBodySize=33144 transferSize=16694 responseBodySize=16407 responseHeadersSize=440
```

| Run | `content-encoding` | Corps transféré | Corps décompressé | `transferSize` |
|---|---|---|---|---|
| 95 | aucun | 33 162 | 33 162 | 33 462 |
| 105 | gzip | 16 394 | 33 144 | 16 694 |
| 107 | gzip | 16 430 | 33 228 | 16 730 |

Au run 95, le lot part **sans compression : 33 462 octets transférés** pour 33 162 octets de JSON. Au run 107, il part en gzip : 16 430 octets de corps pour 33 228 décompressés, environ la moitié. Le test exige `gzip`, un corps transféré plus petit que le corps décompressé et sous 40 000 octets. Au run 95, il échouait ainsi :

```text
# run 95 — docs/lot8-logs/ci-run95-e2e.log:2652-2680
  3) [terrain] › e2e/terrain.spec.ts:825:5 › 10. lot hors ligne : réponse compressée en gzip, moins de 40 000 octets transférés 

    Error: en-tête content-encoding de la réponse du lot

    expect(received).toBe(expected) // Object.is equality

    Expected: "gzip"
    Received: null

      850 |             + `transferSize=${timing.transferSize} responseBodySize=${sizes.responseBodySize} responseHeadersSize=${sizes.responseHeadersSize}`);
      851 |         expect(timing.decodedBodySize, 'taille décompressée du lot lue par le navigateur').toBeGreaterThan(0);
    > 852 |         expect.soft(encoding, 'en-tête content-encoding de la réponse du lot').toBe('gzip');
          |                                                                                ^
      853 |         expect.soft(timing.encodedBodySize, 'corps transféré plus petit que le corps décompressé').toBeLessThan(timing.decodedBodySize);
      854 |         expect.soft(timing.encodedBodySize, `corps transféré sous ${OFFLINE_LOT_MAX_ENCODED} octets`).toBeLessThan(OFFLINE_LOT_MAX_ENCODED);
      855 |     } finally {
        at /home/runner/work/event-village/event-village/e2e/terrain.spec.ts:852:80

    Error: corps transféré plus petit que le corps décompressé

    expect(received).toBeLessThan(expected)

    Expected: < 33162
    Received:   33162

      851 |         expect(timing.decodedBodySize, 'taille décompressée du lot lue par le navigateur').toBeGreaterThan(0);
      852 |         expect.soft(encoding, 'en-tête content-encoding de la réponse du lot').toBe('gzip');
    > 853 |         expect.soft(timing.encodedBodySize, 'corps transféré plus petit que le corps décompressé').toBeLessThan(timing.decodedBodySize);
          |                                                                                                    ^
```

**Mesure sur la route, côté serveur** (`hors-ligne-codes`, cas 13 à 15, lot de 48 h, 8 640 codes) :

```text
# run 95 (db21d1c, « avant ») — tests/parcours/hors-ligne-codes.test.ts (docs/lot8-logs/ci-run95-verify.log:18898 ; lignes duration_ms, type, location et piles d’appels retirées)
━━━ tests/parcours/hors-ligne-codes.test.ts ━━━
# Subtest: 7.1 GET /api/tickets/[id]/offline-codes : accès
    # Subtest: 1. 401 sans session ; 403 compte SUSPENDU ; 404 même corps pour le billet d’un autre, un UUID inconnu et un id non UUID
    # Subtest: 2. 409 TICKET_NOT_VALID (UTILISE, ANNULE), EVENT_NOT_PUBLISHED (SUSPENDU, TERMINE), TRANSFER_PENDING
ok 1 - 7.1 GET /api/tickets/[id]/offline-codes : accès
# Subtest: 7.1 Fenêtre de téléchargement [début − 24 h ; fin + access.scan_window_after_hours]
    # Subtest: 3. début dans 23,9 h → 200 ; dans 24,1 h → 409 OFFLINE_WINDOW_CLOSED avec available_from ; fin passée, after = 0 → 409 (témoin after = 6 : 200)
    # Subtest: 4. bornes à la seconde (ticket_offline_grant, p.now) : début − 24 h − 1 s refusé, début − 24 h admis, fin + after admis, + 1 s refusé ; now passé → INVALID_NOW
ok 2 - 7.1 Fenêtre de téléchargement [début − 24 h ; fin + access.scan_window_after_hours]
# Subtest: 7.1 Contenu du lot (contrat 3.1)
    # Subtest: 5. format compact, champs dérivés, 30 codes au hasard égaux au code calculé ; le code courant est accepté au scan
    # Subtest: 6. aucun secret dans la réponse ; Cache-Control: no-store
    # Subtest: 7. taille : 3 jours avec before = after = 48 → 8 640 codes, lot glissant incomplet, gzip < 40 000 octets ; soirée par défaut complète
ok 3 - 7.1 Contenu du lot (contrat 3.1)
# Subtest: 7.1 Quotas et journal des téléchargements
    # Subtest: 8. quota par billet puis par compte (3 par heure) : 4ᵉ → 429 RATE_LIMITED + Retry-After, refus non journalisé
    # Subtest: 9. une ligne par 200 avec l’instantané de décision, aucune pour 404 et 409 ; aucune colonne ne contient un code servi
ok 4 - 7.1 Quotas et journal des téléchargements
# Subtest: 7.1 Contrôles statiques, liste des billets, RLS
    # Subtest: 10. statique : la route ne lit ni paramètre ni en-tête d’heure ; issueOfflineCodes({ ticketId, userId }) seulement ; aucun now transmis
    # Subtest: 11. GET /api/tickets : champ offline par billet (dans la fenêtre, pas encore ouverte, transfert en attente)
    # Subtest: 12. ticket_secret_versions et ticket_offline_downloads : RLS activée, aucune politique, aucun accès anon ni authenticated (clé anon)
ok 5 - 7.1 Contrôles statiques, liste des billets, RLS
# Subtest: 8.2 x Compression du lot hors ligne dans la route (contrat 3.7)
    # Subtest: 13. Accept-Encoding: gzip → corps gzip, Vary, no-store ; décompressé, c’est le JSON de la route
    not ok 1 - 13. Accept-Encoding: gzip → corps gzip, Vary, no-store ; décompressé, c’est le JSON de la route
      error: |-
        navigateur : Content-Encoding: gzip attendu (contrat 3.7, fix(8.2x)), en-têtes reçus {"cache-control":"no-store","content-type":"application/json"}
        + actual - expected
        + undefined
        - 'gzip'
      expected: 'gzip'
    # Subtest: 14. sans gzip accepté (en-tête absent, identity, br seul) → JSON brut, aucun Content-Encoding, no-store (témoin)
    # Subtest: 15. lot de 48 h : corps réellement servi sous 40 000 octets, plus petit que le JSON
    not ok 3 - 15. lot de 48 h : corps réellement servi sous 40 000 octets, plus petit que le JSON
      error: |-
        lot de 48 h : Content-Encoding: gzip attendu (contrat 3.7, fix(8.2x)), en-têtes reçus {"cache-control":"no-store","content-type":"application/json"}
        + actual - expected
        + undefined
        - 'gzip'
# [… 7 ligne(s) de plus, non recopiées : docs/lot8-logs/ci-run95-verify.log]
```

```text
# run 107 — docs/lot8-logs/ci-run107-verify.log
10358: [HORS-LIGNE-TAILLE] 3 jours, before = after = 48 h : 8640 codes, 52629 octets bruts, 25641 octets gzip (niveau 6)
10359: [HORS-LIGNE-TAILLE] soirée de 4 h, réglages courants : 2162 codes, 13715 octets bruts, 6744 octets gzip (niveau 6)
10433: [HORS-LIGNE-TRANSFERE] 3 jours, before = after = 48 h : 8640 codes, 52627 octets de JSON, 25653 octets servis
```

**Cause** (contrat 12.3, prouvée à la découverte par `scratchpad/d8q/preload.cjs`, non rejouée ici) : `next/dist/server/send-response.js` pose les en-têtes par `appendHeader` ; `Content-Type` devient un tableau et `compressible()` refuse. Toutes les routes API sont concernées, sur tout Node ; `compress: true` n’y change rien. `next start` 14.2.35 ne compresse donc aucune route API.

**Correctif** (`fb58820`, `fix(8.2x)`) : la route `app/api/tickets/[id]/offline-codes/route.ts` compresse elle-même en gzip quand `Accept-Encoding` l’accepte, pour un 200 seulement, avec `Vary` et `no-store` (contrat 3.7). Les autres routes API restent non compressées : point ouvert PO8, à régler à l’hébergement (L72). L’agent S3 a relu `offline-codes.service.ts` contre BREACH : le corps ne reflète aucune entrée de l’appelant.

**Correction de la section 7 du rapport du lot 7 (L73).** Il écrivait, tel quel (`docs/lot7-rapport.md:3098-3101`) :

```text
- **Seuil des 40 000 octets tenu** : 25 663 octets au pire (run 83 ; 25 633 au run 84), pour un lot de 48 h, soit une marge d'environ 36 %. Le test l'exige (`gzip < 40 000 octets`).
- **Découpage retenu** : lot glissant de 48 h. Tous les événements d'une journée, avec les réglages par défaut, tiennent en un seul lot.
- **NON VÉRIFIÉ :** la mesure « réelle » en e2e demandée par le contrat (16.7), avec l'en-tête `content-encoding` et la taille transférée, n'a pas été écrite. Ni la fumée ni `terrain` n'impriment la taille reçue.
- **Compression chez l'hébergeur** : le serveur Next compresse (`compress: true`, `next.config.mjs:38`). Sans gzip, un lot de 48 h fait 52 Ko. C'est un point ouvert du lot 8.
```

Deux choses y étaient fausses :
- les « 25 663 octets gzip » sont calculés par le test lui-même (`gzip` niveau 6 appliqué au corps), pas mesurés à la sortie du serveur. Au run 95, la route n’avait pas changé depuis le lot 7 (le correctif `fb58820` vient après) : la réponse arrivait **sans** `Content-Encoding` (cas 13, en-têtes reçus ci-dessus), soit environ 52 Ko de JSON pour un lot de 48 h de 8 640 codes (52 629 octets bruts au cas 7), et 33 462 octets transférés pour le lot de l’e2e ;
- « le serveur Next compresse (`compress: true`) » est faux pour les routes API, voir la cause ci-dessus.

Le seuil des 40 000 octets n’était donc pas tenu pour un lot de 48 h avant le lot 8. Il l’est au run 107 : 25 653 octets servis pour ce lot (cas 15), 16 430 octets pour le lot de l’e2e.

---

---

## 9. Ordre des verrous (8.2 b)

**Ordre unique : `events` (`FOR NO KEY UPDATE`) → paiements (par id) → catégories (par id, `FOR NO KEY UPDATE` dans `event_cancel`) → transferts → billets.** `FOR KEY SHARE` (clé étrangère) n’est pas bloqué par `FOR NO KEY UPDATE`.

**Tableau 2.3 du contrat, rectifié par AM14** (run 96 : le contrat avait manqué `ticket_scans.category_id`). Seules les lignes `event_cancel` et `ticket_scan` changent par rapport au contrat ; les autres sont recopiées.

| Fonction | Ordre réel après le lot | Verdict | Action |
|---|---|---|---|
| `payment_confirm` | events NKU (`M3:116`, sauf statut final) → paiement (`:121`) → catégories (`:141`) → (réservations, billets) | conforme | M3 |
| `event_cancel` | events NKU (`M3:297`) → paiements (`:338`) → catégories **NKU** (`:340`, AM14) → transferts (`:348`) → billets (`:349`) | conforme | M3 (`14501cf`, puis `621c804`) |
| `checkout_create_payment` | catégories → verrou consultatif → `INSERT payments` (FK events KEY SHARE) | ne prend pas `events` ; KEY SHARE compatible | aucune, scénario 4 |
| `free_tickets_claim` | catégories → `INSERT tickets` (FK) | idem | aucune, scénario 5 |
| `counter_sale` | caisse → catégories → `INSERT` (FK) | idem | aucune (recopiée en M1 pour 8.0) |
| `ticket_scan` | billet → `INSERT ticket_scans` (FK events **et FK catégorie** KEY SHARE) | compatible avec NKU des deux côtés après AM14 | aucune, scénario 3 |
| `ticket_cash_checkin` | scan → billet → commande → caisse → `INSERT payments` (FK) | ne prend ni `events` ni catégories | aucune |
| `payment_release` | paiement → catégories | conforme | aucune |
| `stock_reservations_expire` | catégories | conforme | aucune |
| `refund_request` | paiement | conforme | aucune |
| `cashout_finalize` | cashout → remboursement → paiement → billets | conforme | aucune |
| `ticket_transfer_accept`, `ticket_offline_grant` | events `FOR SHARE` → transfert → billet | conforme ; `FOR SHARE` reste en conflit avec NKU (D20 tient) | aucune |
| `event_controller_set_cash`, `event_transition` | events `FOR UPDATE`, aucune catégorie verrouillée | pas de cycle | aucune |
| `events_finish_overdue` | events `FOR UPDATE SKIP LOCKED` | saute les lignes prises | aucune |
| `ticket_refund_request` | paiement → billet → catégorie | **billet avant catégorie** ; non protégé pour un billet sans paiement | **PO3** |
| `event_update`, `ticket_category_guard` | events `FOR UPDATE` → catégories | cycle possible avec `checkout_create_payment` par la FK | **PO4** |

`M3` = `supabase/migrations/20261106000003_lot8_paiement.sql` ; les numéros de ligne sont lus dans le fichier final. Conséquence à lire (★ L34) : deux confirmations d’un même événement se sérialisent désormais sur l’événement (avant : par catégorie) ; effet sous charge non mesuré (PO5).

**Sortie brute des scénarios** (`tests/parcours/course-confirmation-annulation.test.ts`, trois connexions, sans minuterie) :

```text
# run 95 (db21d1c, « avant ») — tests/parcours/course-confirmation-annulation.test.ts (docs/lot8-logs/ci-run95-verify.log:8478 ; lignes duration_ms, type, location et piles d’appels retirées)
━━━ tests/parcours/course-confirmation-annulation.test.ts ━━━
# Subtest: 8.2 b — payment_confirm et event_cancel, trois connexions
    # Subtest: 1. vrai cycle : C tient les réservations, A confirme, B annule, C annule : A CONFIRMED puis B aboutit, aucun 40P01
    not ok 1 - 1. vrai cycle : C tient les réservations, A confirme, B annule, C annule : A CONFIRMED puis B aboutit, aucun 40P01
      error: |-
        interblocage (40P01) :
        B (annulation) : erreur 40P01 deadlock detected
        + actual - expected
        + [
        +   'B (annulation) : erreur 40P01 deadlock detected'
        + ]
        - []
      expected:
      actual:
        0: 'B (annulation) : erreur 40P01 deadlock detected'
    # Subtest: 2. garde-fou : C tient les catégories, B annule, A confirme : B annule l’événement, A rend REFUND_REQUIRED après le COMMIT de B
    # Subtest: 3. point ouvert 11 : C tient les catégories, B tient events, A lance ticket_scan : A rend son verdict, B aboutit, aucun 40P01
    not ok 3 - 3. point ouvert 11 : C tient les catégories, B tient events, A lance ticket_scan : A rend son verdict, B aboutit, aucun 40P01
      error: |-
        interblocage (40P01) :
        A : erreur 40P01 deadlock detected
        + actual - expected
        + [
        +   'A : erreur 40P01 deadlock detected'
        + ]
        - []
      expected:
      actual:
        0: 'A : erreur 40P01 deadlock detected'
    # Subtest: 4. même famille, checkout_create_payment : A tient sa catégorie et la clé étrangère passe, B aboutit, aucun 40P01
    not ok 4 - 4. même famille, checkout_create_payment : A tient sa catégorie et la clé étrangère passe, B aboutit, aucun 40P01
      error: |-
        interblocage (40P01) :
        A : erreur 40P01 deadlock detected
        + actual - expected
        + [
        +   'A : erreur 40P01 deadlock detected'
        + ]
        - []
      expected:
      actual:
        0: 'A : erreur 40P01 deadlock detected'
    # Subtest: 5. même famille, free_tickets_claim : A tient sa catégorie gratuite et la clé étrangère passe, B aboutit, aucun 40P01
    not ok 5 - 5. même famille, free_tickets_claim : A tient sa catégorie gratuite et la clé étrangère passe, B aboutit, aucun 40P01
      error: |-
        interblocage (40P01) :
        A : erreur 40P01 deadlock detected
        + actual - expected
        + [
        +   'A : erreur 40P01 deadlock detected'
        + ]
        - []
      expected:
      actual:
        0: 'A : erreur 40P01 deadlock detected'
not ok 1 - 8.2 b — payment_confirm et event_cancel, trois connexions
  error: '4 subtests failed'
# Subtest: 8.2 b — ordre écrit dans les deux fonctions
    # Subtest: 6. pg_get_functiondef : events FOR NO KEY UPDATE dans les deux ; paiements avant catégories dans event_cancel ; events avant le verrou du paiement dans payment_confirm
    not ok 1 - 6. pg_get_functiondef : events FOR NO KEY UPDATE dans les deux ; paiements avant catégories dans event_cancel ; events avant le verrou du paiement dans payment_confirm
      error: 'event_cancel : verrou FOR NO KEY UPDATE sur public.events'
      expected: true
      actual: false
not ok 2 - 8.2 b — ordre écrit dans les deux fonctions
  error: '1 subtest failed'
[INVARIANT-RECETTE] course-confirmation-annulation — schéma du lot 8 incomplet : 8 objet(s) manquant(s)
[INVARIANT-RECETTE]   colonne public.ticket_categories.sale_online absente — canaux de vente (contrat 2.4, migration 20261106000001)
[INVARIANT-RECETTE]   colonne public.ticket_categories.sale_counter absente — canaux de vente (contrat 2.4, migration 20261106000001)
[INVARIANT-RECETTE]   colonne public.tickets.sale_decision absente — instantané de la décision de vente (contrat 2.4, migration 20261106000001)
[INVARIANT-RECETTE]   colonne public.stock_reservations.sale_online_at_checkout absente — instantané au checkout (contrat 2.4, migration 20261106000001)
[INVARIANT-RECETTE]   colonne public.referral_commissions.uncapped_amount absente — trace du plafond des commissions (contrat 2.7, migration 20261106000004)
[INVARIANT-RECETTE]   trigger trg_tickets_sale_decision absent de public.tickets — instantané de la vente (contrat 2.4, migration 20261106000001)
[INVARIANT-RECETTE]   trigger trg_stock_reservations_sale_online absent de public.stock_reservations — instantané de la vente (contrat 2.4, migration 20261106000001)
[INVARIANT-RECETTE]   fonction public.payment_duplicate_of absente — paiement en double (contrat 6.1, migration 20261106000003)
not ok 3 - /home/runner/work/event-village/event-village/tests/parcours/course-confirmation-annulation.test.ts
# [… 20 ligne(s) de plus, non recopiées : docs/lot8-logs/ci-run95-verify.log]
```

```text
# run 96 (8f77b1b) — scratchpad/rap8/ci/96-42295220467/tests__parcours__course-confirmation-annulation.test.ts.log (= .test-logs du run), lignes ok, not ok, error et totaux
    # Subtest: 1. vrai cycle : C tient les réservations, A confirme, B annule, C annule : A CONFIRMED puis B aboutit, aucun 40P01
    ok 1 - 1. vrai cycle : C tient les réservations, A confirme, B annule, C annule : A CONFIRMED puis B aboutit, aucun 40P01
    ok 2 - 2. garde-fou : C tient les catégories, B annule, A confirme : B annule l’événement, A rend REFUND_REQUIRED après le COMMIT de B
    # Subtest: 3. point ouvert 11 : C tient les catégories, B tient events, A lance ticket_scan : A rend son verdict, B aboutit, aucun 40P01
    not ok 3 - 3. point ouvert 11 : C tient les catégories, B tient events, A lance ticket_scan : A rend son verdict, B aboutit, aucun 40P01
      error: |-
        interblocage (40P01) :
        A : erreur 40P01 deadlock detected
        +   'A : erreur 40P01 deadlock detected'
        0: 'A : erreur 40P01 deadlock detected'
    # Subtest: 4. même famille, checkout_create_payment : A tient sa catégorie et la clé étrangère passe, B aboutit, aucun 40P01
    ok 4 - 4. même famille, checkout_create_payment : A tient sa catégorie et la clé étrangère passe, B aboutit, aucun 40P01
    # Subtest: 5. même famille, free_tickets_claim : A tient sa catégorie gratuite et la clé étrangère passe, B aboutit, aucun 40P01
    ok 5 - 5. même famille, free_tickets_claim : A tient sa catégorie gratuite et la clé étrangère passe, B aboutit, aucun 40P01
not ok 1 - 8.2 b — payment_confirm et event_cancel, trois connexions
  error: '1 subtest failed'
    ok 1 - 6. pg_get_functiondef : events FOR NO KEY UPDATE dans les deux ; paiements avant catégories dans event_cancel ; events avant le verrou du paiement dans payment_confirm
ok 2 - 8.2 b — ordre écrit dans les deux fonctions
# tests 6
# pass 5
# fail 1
```

```text
# run 97 (621c804) — scratchpad/rap8/ci/97-42301401029/tests__parcours__course-confirmation-annulation.test.ts.log (= .test-logs du run), lignes ok, not ok, error et totaux
    # Subtest: 1. vrai cycle : C tient les réservations, A confirme, B annule, C annule : A CONFIRMED puis B aboutit, aucun 40P01
    ok 1 - 1. vrai cycle : C tient les réservations, A confirme, B annule, C annule : A CONFIRMED puis B aboutit, aucun 40P01
    ok 2 - 2. garde-fou : C tient les catégories, B annule, A confirme : B annule l’événement, A rend REFUND_REQUIRED après le COMMIT de B
    # Subtest: 3. point ouvert 11 : C tient les catégories, B tient events, A lance ticket_scan : A rend son verdict, B aboutit, aucun 40P01
    ok 3 - 3. point ouvert 11 : C tient les catégories, B tient events, A lance ticket_scan : A rend son verdict, B aboutit, aucun 40P01
    # Subtest: 4. même famille, checkout_create_payment : A tient sa catégorie et la clé étrangère passe, B aboutit, aucun 40P01
    ok 4 - 4. même famille, checkout_create_payment : A tient sa catégorie et la clé étrangère passe, B aboutit, aucun 40P01
    # Subtest: 5. même famille, free_tickets_claim : A tient sa catégorie gratuite et la clé étrangère passe, B aboutit, aucun 40P01
    ok 5 - 5. même famille, free_tickets_claim : A tient sa catégorie gratuite et la clé étrangère passe, B aboutit, aucun 40P01
ok 1 - 8.2 b — payment_confirm et event_cancel, trois connexions
    not ok 1 - 6. pg_get_functiondef : events FOR NO KEY UPDATE dans les deux ; paiements avant catégories dans event_cancel ; events avant le verrou du paiement dans payment_confirm
      error: 'event_cancel : verrou des catégories'
not ok 2 - 8.2 b — ordre écrit dans les deux fonctions
  error: '1 subtest failed'
# tests 6
# pass 5
# fail 1
```

Lecture : au run 95, les cas 1, 3, 4 et 5 finissent en `40P01` et le contrôle statique (6) échoue ; au run 96 (`14501cf` livré), il ne reste que le cas 3 (`ticket_scan`), le second cycle par `ticket_scans.category_id` ; `621c804` le lève ; au run 97, le cas 6 échoue parce qu’il cherchait encore `FOR UPDATE` sur les catégories, ce que `621c804` a retiré : `a8c653b` le renforce (il exige maintenant `FOR NO KEY UPDATE` et l’absence de tout `FOR UPDATE` sur les catégories d’`event_cancel`). Test du lot modifié, signalé.

```text
# run 107 (bc864fa, « après ») — tests/parcours/course-confirmation-annulation.test.ts (docs/lot8-logs/ci-run107-verify.log:3688 ; lignes duration_ms, type, location et piles d’appels retirées)
━━━ tests/parcours/course-confirmation-annulation.test.ts ━━━
TAP version 13
# Subtest: 8.2 b — payment_confirm et event_cancel, trois connexions
    # Subtest: 1. vrai cycle : C tient les réservations, A confirme, B annule, C annule : A CONFIRMED puis B aboutit, aucun 40P01
    ok 1 - 1. vrai cycle : C tient les réservations, A confirme, B annule, C annule : A CONFIRMED puis B aboutit, aucun 40P01
    # Subtest: 2. garde-fou : C tient les catégories, B annule, A confirme : B annule l’événement, A rend REFUND_REQUIRED après le COMMIT de B
    ok 2 - 2. garde-fou : C tient les catégories, B annule, A confirme : B annule l’événement, A rend REFUND_REQUIRED après le COMMIT de B
    # Subtest: 3. point ouvert 11 : C tient les catégories, B tient events, A lance ticket_scan : A rend son verdict, B aboutit, aucun 40P01
    ok 3 - 3. point ouvert 11 : C tient les catégories, B tient events, A lance ticket_scan : A rend son verdict, B aboutit, aucun 40P01
    # Subtest: 4. même famille, checkout_create_payment : A tient sa catégorie et la clé étrangère passe, B aboutit, aucun 40P01
    ok 4 - 4. même famille, checkout_create_payment : A tient sa catégorie et la clé étrangère passe, B aboutit, aucun 40P01
    # Subtest: 5. même famille, free_tickets_claim : A tient sa catégorie gratuite et la clé étrangère passe, B aboutit, aucun 40P01
    ok 5 - 5. même famille, free_tickets_claim : A tient sa catégorie gratuite et la clé étrangère passe, B aboutit, aucun 40P01
    1..5
ok 1 - 8.2 b — payment_confirm et event_cancel, trois connexions
# Subtest: 8.2 b — ordre écrit dans les deux fonctions
    # Subtest: 6. pg_get_functiondef : events FOR NO KEY UPDATE dans les deux ; paiements avant catégories dans event_cancel ; events avant le verrou du paiement dans payment_confirm
    ok 1 - 6. pg_get_functiondef : events FOR NO KEY UPDATE dans les deux ; paiements avant catégories dans event_cancel ; events avant le verrou du paiement dans payment_confirm
    1..1
ok 2 - 8.2 b — ordre écrit dans les deux fonctions
[INVARIANT] course-confirmation-annulation — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] course-confirmation-annulation — purge des réservations échues : {"expired":0}
[INVARIANT] course-confirmation-annulation — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] course-confirmation-annulation — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] course-confirmation-annulation — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] course-confirmation-annulation — cron events_finish_overdue : 0 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] course-confirmation-annulation — (j)(k)(l) : 0 violation(s)
[notifications] Canal push désactivé : variables VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY et VAPID_SUBJECT absentes. Les notifications partent dans l'application et par SMS.
[INVARIANT-NOTIF] course-confirmation-annulation — envoyeur : 126 ligne(s) réservée(s), 0 reprise(s)
[INVARIANT-NOTIF] course-confirmation-annulation — (m)(n)(o) : 0 violation(s)
[INVARIANT-TERRAIN] course-confirmation-annulation — (p)(q) : 0 violation(s)
[INVARIANT-RECETTE] course-confirmation-annulation — (r)(s)(t) : 0 violation(s)
1..2
# tests 6
# suites 2
# pass 6
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 2585.22123
```

**Points ouverts** (contrat 21, recopiés) :
- **PO3** `ticket_refund_request` pour un billet sans paiement : billet puis catégorie, inverse d’`event_cancel` ; cycle possible, rattrapé par `rpcWithRetry` (`CashoutService.requestTicketRefund`). Correctif d’une ligne possible, hors consigne.
- **PO4** `event_update`, `ticket_category_guard` : `events FOR UPDATE` puis catégories, cycle possible avec `checkout_create_payment` par la clé étrangère ; rattrapé par `rpcWithRetry` (`lib/events/event.service.ts:348,362,393,409`).
- **PO5** Deux confirmations du même événement sérialisées (L34) : effet sous charge à mesurer au test de charge.

Aucun test ne joue PO3 ni PO4 : le « rattrapage par `rpcWithRetry` » vient de la lecture du code, NON VÉRIFIÉ par un test de concurrence.

---

---

## 10. Mode simulé : marquage, refus, `[FAKE-PROD]`, sentinelle

**Règle (AR6, ★ L28)** : un remboursement ou un retrait créé en mode simulé ne peut jamais partir en réel. Trois couches :

1. **Marque en base** (`supabase/migrations/20261106000002_lot8_essai.sql`, M2, `310a4d8`) : `payments.simulated` et `cashouts.simulated` (`:29-30`), posées à la création par `trg_payments_simulated` et `trg_cashouts_simulated` depuis l’en-tête `x-ev-simulation` (`ev_request_simulated()`, `:43-56`), envoyé par le seul client service_role d’un serveur d’essai. Un cashout hérite de la marque de son paiement, ou du solde pour un retrait. La marque est immuable (`EV422`, `:119`, `:144`).
2. **Refus dans le code** (`lib/payments/cashout.service.ts:102-104`, `cashoutSendRefusal`), au début de l’envoi, avant tout appel SamirPay : ligne simulée sur un serveur réel → `blocked_reason = 'SIMULATED'` et alerte ; ligne réelle sur un serveur d’essai → rien n’est écrit, `REAL_IN_SIMULATION`. `sendBatch`, `confirmSent` et la reprise filtrent de même.
3. **Refus en base** : `trg_cashouts_simulation_guard` (`M2:110-130`) refuse en `EV403` (`SIMULATION_MISMATCH`) la réservation d’envoi d’une ligne dont la marque ne correspond pas au serveur.

Le paiement simulé remboursé après le retour en réel est le chemin le plus probable vers de l’argent réel : c’est pourquoi la marque porte sur `payments` et `cashouts`, pas seulement sur le remboursement (rectification du contrat). Effet voulu, à savoir (PO14) : un compte partenaire qui a des ventes simulées voit tout retrait marqué simulé, donc bloqué en réel.

```text
# run 107 (bc864fa, « après ») — tests/parcours/essai-simule.test.ts (docs/lot8-logs/ci-run107-verify.log:8975 ; lignes duration_ms, type, location et piles d’appels retirées)
━━━ tests/parcours/essai-simule.test.ts ━━━
TAP version 13
[SONDE-REQUEST-HEADERS] postgrest=16.5 avec={"cles":["accept","accept-encoding","accept-language","apikey","authorization","connection","content-length","content-profile","content-type","host","sec-fetch-mode","user-agent","x-client-info","x-ev-simulation","x-forwarded-for","x-forwarded-host","x-forwarded-path","x-forwarded-port","x-forwarded-prefix","x-forwarded-proto","x-real-ip"],"valeur":"1","present":true} sans={"cles":["accept","accept-encoding","accept-language","apikey","authorization","cache-control","connection","content-length","content-profile","content-type","host","pragma","sec-fetch-mode","user-agent","x-client-info","x-forwarded-for","x-forwarded-host","x-forwarded-path","x-forwarded-port","x-forwarded-prefix","x-forwarded-proto","x-real-ip"],"valeur":null,"present":true} zero={"cles":["accept","accept-encoding","accept-language","apikey","authorization","connection","content-length","content-profile","content-type","host","sec-fetch-mode","user-agent","x-client-info","x-ev-simulation","x-forwarded-for","x-forwarded-host","x-forwarded-path","x-forwarded-port","x-forwarded-prefix","x-forwarded-proto","x-real-ip"],"valeur":"0","present":true}
# Subtest: SUPPOSÉ 2.5 : PostgREST expose request.headers sous la CLI 2.122.0
    # Subtest: sonde indépendante de M2, puis ev_request_simulated de bout en bout
    ok 1 - sonde indépendante de M2, puis ev_request_simulated de bout en bout
    1..1
ok 1 - SUPPOSÉ 2.5 : PostgREST expose request.headers sous la CLI 2.122.0
# Subtest: marquage à la création, en base
    # Subtest: en-tête présent : refund_request crée un cashout simulé, sur un paiement réel
    ok 1 - en-tête présent : refund_request crée un cashout simulé, sur un paiement réel
    # Subtest: en-tête présent : ticket_refund_request crée un cashout simulé
    ok 2 - en-tête présent : ticket_refund_request crée un cashout simulé
    # Subtest: en-tête présent : withdrawal_request crée un cashout simulé
    ok 3 - en-tête présent : withdrawal_request crée un cashout simulé
    # Subtest: paiement marqué, cashout créé sans en-tête : hérite
    ok 4 - paiement marqué, cashout créé sans en-tête : hérite
    # Subtest: solde issu d’un paiement simulé, retrait sans en-tête : hérite
    ok 5 - solde issu d’un paiement simulé, retrait sans en-tête : hérite
    # Subtest: témoin : solde réel, retrait sans en-tête : réel
    ok 6 - témoin : solde réel, retrait sans en-tête : réel
    # Subtest: la valeur reçue à l’INSERT est écrasée, dans les deux sens
    ok 7 - la valeur reçue à l’INSERT est écrasée, dans les deux sens
    1..7
ok 2 - marquage à la création, en base
# Subtest: envoi refusé dans le code
    # Subtest: cashoutSendRefusal : les 4 cas
    ok 1 - cashoutSendRefusal : les 4 cas
    # Subtest: simulationHeaders vide et isSimulationRun faux en NODE_ENV=test, malgré EV_INTEGRATIONS=fake
    ok 2 - simulationHeaders vide et isSimulationRun faux en NODE_ENV=test, malgré EV_INTEGRATIONS=fake
    # Subtest: serveur réel, cashout simulé : ni getSolde ni sendCashout, blocked_reason = SIMULATED, skipped = SIMULATED
    ok 3 - serveur réel, cashout simulé : ni getSolde ni sendCashout, blocked_reason = SIMULATED, skipped = SIMULATED
    # Subtest: libellé du motif pour les administrateurs : clair, sans code technique
    ok 4 - libellé du motif pour les administrateurs : clair, sans code technique
    # Subtest: relance admin (retryRefund) d’un cashout simulé bloqué : aucun appel, reste bloqué
    ok 5 - relance admin (retryRefund) d’un cashout simulé bloqué : aucun appel, reste bloqué
    # Subtest: relance admin d’un cashout simulé ECHOUE : remis à envoyer puis bloqué, aucun appel
    ok 6 - relance admin d’un cashout simulé ECHOUE : remis à envoyer puis bloqué, aucun appel
    # Subtest: cron de reprise : le cashout simulé n’est pas repris, le réel l’est
    ok 7 - cron de reprise : le cashout simulé n’est pas repris, le réel l’est
[cashout] statut de l'envoi REFUND-TKT-d8cdd60b-5a8b-44bf-995a-1a4df39301b0 indisponible : Transaction introuvable (simulation)
[cashout] statut de l'envoi REFUND-43830768-75cf-4573-a3a5-11ff1acae415 indisponible : Transaction introuvable (simulation)
    # Subtest: confirmSent ne relit pas le statut d’un cashout simulé
    ok 8 - confirmSent ne relit pas le statut d’un cashout simulé
    # Subtest: sendBatch : la ligne simulée sort du total et n’est pas envoyée, la réelle part
    ok 9 - sendBatch : la ligne simulée sort du total et n’est pas envoyée, la réelle part
    # Subtest: témoin : cashout sans en-tête, envoyé normalement
    ok 10 - témoin : cashout sans en-tête, envoyé normalement
[cashout] envoi réel REFUND-fffe15f4-10ec-46de-8d9f-c43d44af5b4a refusé par un serveur d'essai : rien n'est écrit, rien ne part
    # Subtest: serveur d’essai, ligne réelle : aucune écriture, aucun appel, skipped = REAL_IN_SIMULATION
    ok 11 - serveur d’essai, ligne réelle : aucune écriture, aucun appel, skipped = REAL_IN_SIMULATION
    # Subtest: serveur d’essai, ligne simulée : envoyée au faux service, la garde en base l’accepte
    ok 12 - serveur d’essai, ligne simulée : envoyée au faux service, la garde en base l’accepte
    1..12
ok 3 - envoi refusé dans le code
# Subtest: refus en base (trg_cashouts_simulation_guard)
    # Subtest: UPDATE send_started_at direct d’un cashout simulé sans en-tête : EV403
    ok 1 - UPDATE send_started_at direct d’un cashout simulé sans en-tête : EV403
    # Subtest: UPDATE send_started_at d’un cashout réel avec l’en-tête : EV403
    ok 2 - UPDATE send_started_at d’un cashout réel avec l’en-tête : EV403
    # Subtest: témoin : cashout simulé réservé avec l’en-tête
    ok 3 - témoin : cashout simulé réservé avec l’en-tête
    1..3
ok 4 - refus en base (trg_cashouts_simulation_guard)
# Subtest: marque immuable
    # Subtest: UPDATE simulated refusé sur payments et cashouts, dans les deux sens
    ok 1 - UPDATE simulated refusé sur payments et cashouts, dans les deux sens
    1..1
ok 5 - marque immuable
[INVARIANT] essai-simule — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] essai-simule — purge des réservations échues : {"expired":0}
[INVARIANT] essai-simule — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] essai-simule — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] essai-simule — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] essai-simule — cron events_finish_overdue : 0 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] essai-simule — (j)(k)(l) : 0 violation(s)
[notifications] Canal push désactivé : variables VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY et VAPID_SUBJECT absentes. Les notifications partent dans l'application et par SMS.
[INVARIANT-NOTIF] essai-simule — envoyeur : 345 ligne(s) réservée(s), 0 reprise(s)
[INVARIANT-NOTIF] essai-simule — (m)(n)(o) : 0 violation(s)
[INVARIANT-TERRAIN] essai-simule — (p)(q) : 0 violation(s)
[INVARIANT-RECETTE] essai-simule — (r)(s)(t) : 0 violation(s)
1..5
# tests 24
# suites 5
# pass 24
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 6240.131084
```

La ligne `[SONDE-REQUEST-HEADERS]` ne contient que des noms d’en-têtes et la valeur de `x-ev-simulation` ; aucune valeur de clé. Au run 95, les 24 cas de cette suite échouaient (`# pass 0`, `# fail 24`), faute de M2 et de `lib/integrations/simulation.ts` :

```text
# run 95 (db21d1c, « avant ») — tests/parcours/essai-simule.test.ts (docs/lot8-logs/ci-run95-verify.log:16386 ; lignes duration_ms, type, location et piles d’appels retirées)
━━━ tests/parcours/essai-simule.test.ts ━━━
# Subtest: SUPPOSÉ 2.5 : PostgREST expose request.headers sous la CLI 2.122.0
    # Subtest: sonde indépendante de M2, puis ev_request_simulated de bout en bout
    not ok 1 - sonde indépendante de M2, puis ev_request_simulated de bout en bout
      error: |-
        SUPPOSÉ CONFIRMÉ : PostgREST 16.5 expose request.headers et x-ev-simulation y arrive. Rouge seulement parce que M2 n'est pas livrée : public.ev_request_simulated() ne répond pas (PGRST202 Could not find the function public.ev_request_simulated without parameters in the schema cache).
        + actual - expected
        + {
        +   code: 'PGRST202',
        +   details: 'Searched for the function public.ev_request_simulated without parameters or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        +   hint: null,
        +   message: 'Could not find the function public.ev_request_simulated without parameters in the schema cache'
        + }
        - null
      expected: ~
      actual:
not ok 1 - SUPPOSÉ 2.5 : PostgREST expose request.headers sous la CLI 2.122.0
  error: '1 subtest failed'
# Subtest: marquage à la création, en base
    # Subtest: en-tête présent : refund_request crée un cashout simulé, sur un paiement réel
    not ok 1 - en-tête présent : refund_request crée un cashout simulé, sur un paiement réel
      error: |-
        M2 (20261106000002_lot8_essai.sql, fix(8.1s)) non appliquée, objets absents : colonne public.payments.simulated ; colonne public.cashouts.simulated ; fonction public.ev_request_simulated ; trigger trg_payments_simulated sur public.payments ; trigger trg_payments_simulation_guard sur public.payments ; trigger trg_cashouts_simulated sur public.cashouts ; trigger trg_cashouts_simulation_guard sur public.cashouts
        + actual - expected
        + [
        +   'colonne public.payments.simulated',
        +   'colonne public.cashouts.simulated',
        +   'fonction public.ev_request_simulated',
        +   'trigger trg_payments_simulated sur public.payments',
        +   'trigger trg_payments_simulation_guard sur public.payments',
        +   'trigger trg_cashouts_simulated sur public.cashouts',
        +   'trigger trg_cashouts_simulation_guard sur public.cashouts'
        + ]
        - []
      expected:
      actual:
    # Subtest: en-tête présent : ticket_refund_request crée un cashout simulé
    not ok 2 - en-tête présent : ticket_refund_request crée un cashout simulé
      error: |-
        M2 (20261106000002_lot8_essai.sql, fix(8.1s)) non appliquée, objets absents : colonne public.payments.simulated ; colonne public.cashouts.simulated ; fonction public.ev_request_simulated ; trigger trg_payments_simulated sur public.payments ; trigger trg_payments_simulation_guard sur public.payments ; trigger trg_cashouts_simulated sur public.cashouts ; trigger trg_cashouts_simulation_guard sur public.cashouts
        + actual - expected
        + [
        +   'colonne public.payments.simulated',
        +   'colonne public.cashouts.simulated',
        +   'fonction public.ev_request_simulated',
# [… 373 ligne(s) de plus, non recopiées : docs/lot8-logs/ci-run95-verify.log]
```

**`EV_INTEGRATIONS=fake` refusé hors développement, prouvé contre le vrai build** (phase e2e `fake-prod`, `next start` sur le build de la CI, avec `EV_INTEGRATIONS=fake`, `NODE_ENV` à `production` puis `development`) :

```text
# run 107 (bc864fa, « après ») — docs/lot8-logs/ci-run107-e2e.log:668-683
[FAKE-PROD] ═══ production : next start -p 3199, EV_INTEGRATIONS=fake ═══
[FAKE-PROD] production : OK GET /login répond (témoin) HTTP 200
[FAKE-PROD] production : OK POST /api/auth/register/start, numéro neuf, refusé HTTP 500 {"error":"Inscription momentanément impossible. Réessayez dans un instant.","code":"REGISTER_START_FAILED"}
[FAKE-PROD] production : OK aucun SMS au faux MTarget 0 SMS
[FAKE-PROD] production : OK GET /dev/paiements HTTP 404 
[FAKE-PROD] production : OK POST /api/dev/samirpay/validate HTTP 404 
[FAKE-PROD] production : conforme
[FAKE-PROD] ═══ development : next start -p 3199, EV_INTEGRATIONS=fake ═══
[FAKE-PROD] development : OK GET /login répond (témoin) HTTP 200
[FAKE-PROD] development : OK POST /api/auth/register/start, numéro neuf, refusé HTTP 500 {"error":"Inscription momentanément impossible. Réessayez dans un instant.","code":"REGISTER_START_FAILED"}
[FAKE-PROD] development : OK aucun SMS au faux MTarget 0 SMS
[FAKE-PROD] development : OK GET /dev/paiements HTTP 404 
[FAKE-PROD] development : OK POST /api/dev/samirpay/validate HTTP 404 
[FAKE-PROD] development : conforme
[FAKE-PROD] résultat : OK, simulé impossible sur le build, dans les deux lancements
[e2e] phase fake-prod : OK en 1s
```

Au run 95, les deux pages de développement répondaient 307 et 401 au lieu de 404, et le serveur refusait déjà `fake` en production :

```text
# run 95 (db21d1c, « avant ») — docs/lot8-logs/ci-run95-e2e.log:2891-2927
[FAKE-PROD] ═══ production : next start -p 3199, EV_INTEGRATIONS=fake ═══
[FAKE-PROD] production : OK GET /login répond (témoin) HTTP 200
[FAKE-PROD] production : OK POST /api/auth/register/start, numéro neuf, refusé HTTP 500 {"error":"Inscription momentanément impossible. Réessayez dans un instant.","code":"REGISTER_START_FAILED"}
[FAKE-PROD] production : OK aucun SMS au faux MTarget 0 SMS
[FAKE-PROD] production : ÉCHEC GET /dev/paiements HTTP 307 http://localhost:3199/login?redirect=%2Fdev%2Fpaiements (vers http://localhost:3
[FAKE-PROD] production : ÉCHEC POST /api/dev/samirpay/validate HTTP 401 {"error":"Authentification requise pour cette ressource."}
[FAKE-PROD] production : ÉCHEC, 2 écart(s) ; fin de la sortie du serveur :
[FAKE-PROD]     ▲ Next.js 14.2.35
[FAKE-PROD]     - Local:        http://127.0.0.1:3199
[FAKE-PROD]     - Network:      http://127.0.0.1:3199
[FAKE-PROD]    ✓ Starting...
[FAKE-PROD]   [notifications] Canal email désactivé : RESEND_API_KEY absente. Les notifications partent par SMS et dans l’application.
[FAKE-PROD]    ✓ Ready in 272ms
[FAKE-PROD]   [API /api/auth/register/start] erreur interne : Configuration serveur invalide — variables d'environnement manquantes ou incorrectes :
[FAKE-PROD]     - EV_INTEGRATIONS=fake est interdit en production
[FAKE-PROD]   Référence : .env.example (production) / .env.test.example (tests).
[FAKE-PROD] ═══ development : next start -p 3199, EV_INTEGRATIONS=fake ═══
[FAKE-PROD] development : OK GET /login répond (témoin) HTTP 200
[FAKE-PROD] development : OK POST /api/auth/register/start, numéro neuf, refusé HTTP 500 {"error":"Inscription momentanément impossible. Réessayez dans un instant.","code":"REGISTER_START_FAILED"}
[FAKE-PROD] development : OK aucun SMS au faux MTarget 0 SMS
[FAKE-PROD] development : ÉCHEC GET /dev/paiements HTTP 307 http://localhost:3199/login?redirect=%2Fdev%2Fpaiements (vers http://localhost:3
[FAKE-PROD] development : ÉCHEC POST /api/dev/samirpay/validate HTTP 401 {"error":"Authentification requise pour cette ressource."}
[FAKE-PROD] development : ÉCHEC, 2 écart(s) ; fin de la sortie du serveur :
[FAKE-PROD]    ⚠ You are using a non-standard "NODE_ENV" value in your environment. This creates inconsistencies in the project and is strongly advised against. Read more: https://nextjs.org/docs/messages/non-standard-node-env
[FAKE-PROD]     ▲ Next.js 14.2.35
[FAKE-PROD]     - Local:        http://127.0.0.1:3199
[FAKE-PROD]     - Network:      http://127.0.0.1:3199
[FAKE-PROD]    ✓ Starting...
[FAKE-PROD]   [notifications] Canal email désactivé : RESEND_API_KEY absente. Les notifications partent par SMS et dans l’application.
[FAKE-PROD]    ✓ Ready in 344ms
[FAKE-PROD]   [API /api/auth/register/start] erreur interne : EV_INTEGRATIONS=fake mais aucun faux adaptateur "sms" n'est enregistré. Importez tests/helpers/env.ts (qui appelle installFakeIntegrations) avant d'utiliser les services.
[FAKE-PROD] résultat : ÉCHEC
[FAKE-PROD]   production : GET /dev/paiements HTTP 307 http://localhost:3199/login?redirect=%2Fdev%2Fpaiements (vers http://localhost:3
[FAKE-PROD]   production : POST /api/dev/samirpay/validate HTTP 401 {"error":"Authentification requise pour cette ressource."}
[FAKE-PROD]   development : GET /dev/paiements HTTP 307 http://localhost:3199/login?redirect=%2Fdev%2Fpaiements (vers http://localhost:3
[FAKE-PROD]   development : POST /api/dev/samirpay/validate HTTP 401 {"error":"Authentification requise pour cette ressource."}
[e2e] phase fake-prod : ÉCHEC (code 1) en 1s
```

Le même refus est joué avec et sans session par la fumée (`e2e/fumee.spec.ts:604`, ✓ au run 107, section 6.3 : « pages et routes de développement : 404 sur next start, avec et sans session »).

**Sentinelle (L17, L29).** `lib/integrations/dev-adapters.ts:18` exporte la chaîne `EV_DEV_ADAPTERS_SENTINEL_LOT8` ; `scripts/e2e/start-app.mjs:65-84` lit en octets chaque fichier de `.next/server` et `.next/static` avant de démarrer l’application et refuse le build s’il la trouve. Au run 107 :

```text
# runs/107-42334500969/next-start.log:1 (ci-results)
[e2e-app] EV_DEV_ADAPTERS_SENTINEL_LOT8 absente de 825 fichier(s) de .next/server et .next/static
```

```text
# run 107 — docs/lot8-logs/ci-run107-verify.log (tests/schema/essai-integrations.test.ts)
20588:     # Subtest: sentinelle du build exportée et présente dans le module (L17, L29)
20589:     ok 9 - sentinelle du build exportée et présente dans le module (L17, L29)
```

Limite : la sentinelle prouve que le module des faux adaptateurs n’est pas dans ce build ; elle ne dit rien d’un autre build fait sur un autre poste. `instrumentation.ts` n’a aucun `throw` : le refus a lieu au premier appel (ci-dessus, `REGISTER_START_FAILED`), pas au démarrage (décision 4 de S1 ; comportement sous Next 14 SUPPOSÉ).

---

---

## 11. Matrice de traçabilité

La matrice complète, avec le code et le test de chaque ligne, est dans [`docs/recette-billetterie.md`](recette-billetterie.md), sections 3 et 4. Son résumé, tel quel (`docs/recette-billetterie.md:5-18`) :

| Statut | Lignes |
|---|---|
| fait | 46 |
| partiel | 37 |
| non fait | 3 |
| écarté | 6 |
| hors périmètre | 14 |
| total | 106 |


Les 46 lignes « fait » ont toutes leurs preuves lues vertes au run 105. Aucune n’attend de preuve.

Le run 105 a tourné le 07/11/2026 sur le commit a03abe6, écrans compris : 220 suites vertes sur 220 et toutes les phases e2e vertes, dont 323 captures sur deux écrans et le parcours `e2e/recette.spec.ts`, 8 actes sur 8. Les 41 cas de capture ignorés sont des vues que leur écran ne prévoit pas. Les rouges du run 97 sont verts : `tests/parcours/otp-serveur.test.ts` (A35), `tests/parcours/pilotage-remboursement-billet.test.ts` (A36) et le cas 6 de `tests/parcours/course-confirmation-annulation.test.ts`.

Décompte refait sur le fichier par cette partie (statut de la 3ᵉ colonne de chaque ligne des sections 3 et 4) : 106 lignes, fait 46, partiel 37, hors périmètre 14, écarté 6, non fait 3.

| Partie du cahier des charges | fait | partiel | non fait | écarté | hors périmètre |
|---|---|---|---|---|---|
| Parties I et II : principes et rôles | 8 | 2 | 0 | 0 | 0 |
| Partie III : compte client | 1 | 5 | 1 | 0 | 1 |
| Partie IV : espace partenaire | 2 | 1 | 0 | 0 | 2 |
| Partie V : événements | 3 | 1 | 0 | 1 | 0 |
| Partie VI : ticketing | 7 | 0 | 0 | 0 | 0 |
| Parties VII à IX : salles, tables, commandes | 0 | 0 | 0 | 0 | 1 |
| Partie X : paiements et finances | 5 | 2 | 0 | 0 | 0 |
| Partie XI : parrainage, part billetterie | 7 | 6 | 1 | 0 | 1 |
| Parties XII et XIII : modèle économique et communication | 0 | 0 | 1 | 0 | 2 |
| Partie XIV : administration | 2 | 5 | 0 | 0 | 0 |
| Parties XV à XVIII : données, automatisation, sécurité, statistiques | 7 | 10 | 0 | 0 | 3 |
| Parties XX à XXIII : architecture, règles, livrables | 4 | 5 | 0 | 0 | 4 |
| Écarts par décision du client (section 4) | 0 | 0 | 0 | 5 | 0 |

Ce qu’il faut savoir pour lire ces chiffres :
- **« fait » exige deux lectures** : le corps de chaque test cité, et son résultat dans les journaux bruts (`docs/recette-billetterie.md`, légende). Les 46 lignes « fait » ont toutes leurs preuves lues vertes **au run 105**. La colonne CI n’a pas été relue sur les runs 106 et 107 ; au run 107, `tests/schema/recette-matrice.test.ts` est vert (section 6.2), ce qui garantit que chaque ligne citée ouvre toujours un test, pas que le document a été relu.
- Le statut est strict (L85) : « partiel » dès qu’un affichage ou une route n’a pas d’assertion. La découverte comptait 47 « fait » sur 95 lignes ; après lecture des corps de tests, plusieurs lignes sont retombées en « partiel ».
- Deux suites ne sont jamais citées comme preuve (AR14) : `tests/superadmin-complete.test.ts` et `tests/auth-rbac.test.ts` ; ni aucune suite à la racine de `tests/` qui ne prouve rien (A21).
- Limite écrite dans le document : l’annexe de l’audit n’a été lue qu’en version condensée à la découverte.

---

---

## 12. Anomalies et questions au client

Tableau recopié tel quel de `docs/recette-billetterie.md`, section 5 (lignes 226 à 274). 41 anomalies, A1 à A41 :

- **corrigée** : 11 (A1, A2, A3, A4, A13, A20, A23, A29, A35, A36, A41) ;
- **preuve ajoutée** : 3 (A11, A14, A15) ;
- **listée** : 27 (A5, A6, A7, A8, A9, A10, A12, A16, A17, A18, A19, A21, A22, A24, A25, A26, A27, A28, A30, A31, A32, A33, A34, A37, A38, A39, A40) ;
- par gravité : Élevée 7, Moyenne 17, Faible 17.

« corrigée » veut dire test rouge puis correctif ; « preuve ajoutée », que le code était juste et que le test manquait (garde-fous annoncés verts dès l’écriture, pas des rouges, AR7) ; « listée », non corrigée dans ce lot. La colonne CI renvoie au run 105, voir 11.

Gravité : **Élevée** trompe un utilisateur, ou bloque une opération d’argent ou une exigence nommée. **Moyenne** : exigence manquante avec un contournement. **Faible** : finition ou preuve manquante.

État : `corrigée` (test rouge puis correctif), `preuve ajoutée` (le code était juste, le test manquait), `listée` (non corrigée dans ce lot).

| Id | Gravité | Exigence | Constat | État | Référence | Test | CI |
|---|---|---|---|---|---|---|---|
| A1 | Élevée | §98, §133 | Fausse sauvegarde sur la page de parrainage de l’administration. Bouton et modale retirés, mention « La personnalisation des taux n’est pas disponible pour le moment. » | corrigée | `fix(8.3-A1)` 3fa31ed ; `app/admin/referral/page.tsx:157` | `tests/parcours/admin-parrainage.test.ts:229`, `tests/parcours/admin-parrainage.test.ts:239`, `tests/parcours/admin-parrainage.test.ts:250` | vert au run 105 |
| A2 | Élevée | §86 | Lien de parrainage mort. Lien sur l’adresse de l’application, /register lit ref et ouvre les options | corrigée | `fix(8.3-A2s)` b92928e, `fix(8.3-A2e)` 407d09c ; `app/api/referrals/my-stats/route.ts`, `app/register/page.tsx` | `tests/parcours/parrainage-lien.test.ts:122`, `tests/parcours/parrainage-lien.test.ts:159`, `tests/parcours/parrainage-lien.test.ts:227` | vert au run 105 |
| A3 | Élevée | §41, §131 | Relance d’un remboursement bloqué sans écran. Panneau sur les finances de l’administration, double étape, cas incertain sans bouton | corrigée | `fix(8.3-A3s)` 9a92e59, `fix(8.3-A3e)` 2506b89 et 5a6dcbc ; `app/api/admin/refunds/route.ts`, `components/admin/RefundsToRetry.tsx` | `tests/parcours/admin-remboursements.test.ts:180`, `tests/parcours/admin-remboursements.test.ts:350`, `tests/parcours/admin-remboursements.test.ts:467`, `tests/parcours/admin-remboursements.test.ts:479`, `tests/parcours/admin-remboursements.test.ts:498`, `e2e/recette.spec.ts:841` | vert au run 105 |
| A4 | Élevée | §41, §82 | Remboursement d’un billet sans écran. Recherche par numéro et double confirmation dans l’onglet Ventes | corrigée | `fix(8.3-A4s)` c1eabd6, `fix(8.3-A4e)` 18c69b8 ; `app/api/partner/events/[id]/tickets/lookup/route.ts`, `components/partner/pilotage/TicketRefundPanel.tsx` | `tests/parcours/pilotage-remboursement-billet.test.ts:138`, `tests/parcours/pilotage-remboursement-billet.test.ts:191`, `tests/parcours/pilotage-remboursement-billet.test.ts:235`, `tests/parcours/pilotage-remboursement-billet.test.ts:356`, `tests/parcours/pilotage-remboursement-billet.test.ts:369`, `e2e/recette.spec.ts:728` | vert au run 105 |
| A5 | Élevée | §87, §88, §96, §97 | Parrainage prestataire absent : Q2 à trancher d’abord | listée | `app/api/auth/register/route.ts` | — | sans objet |
| A6 | Moyenne | §15 | Profil en lecture seule. Changer téléphone ou email touche à l’identité du compte | listée | `app/profile/page.tsx` | — | sans objet |
| A7 | Moyenne | §17 | Événements populaires et proches absents : Q4 | listée | `app/api/events/route.ts` | — | sans objet |
| A8 | Moyenne | §22, §144 | WhatsApp absent, sans décision écrite : Q1 | listée | `lib/notifications/dispatcher.ts` | — | sans objet |
| A9 | Moyenne | §106, §119, §132, §133, §162 | Historique du parrainage incomplet, ROI absent | listée | `app/api/referrals/my-stats/route.ts`, `app/admin/referral/page.tsx` | — | sans objet |
| A10 | Moyenne | §83, §105 | Virement bancaire non traité, réglage fermé par défaut | listée | `docs/lot3-rapport.md:1900` | — | sans objet |
| A11 | Moyenne | §104 | Auto-parrainage et boucles sans test. Preuve ajoutée, verte dès l’écriture | preuve ajoutée | `test(8.3)[garde-fous]` 2769248 ; `tests/parcours/parrainage-gardes.test.ts` | `tests/parcours/parrainage-gardes.test.ts:90`, `tests/parcours/parrainage-gardes.test.ts:128`, `tests/parcours/parrainage-gardes.test.ts:139` | vert au run 105 |
| A12 | Moyenne | §1, §183 | Un client ne devient pas partenaire (D8, D63) | listée | `docs/lot7-rapport.md` | — | sans objet |
| A13 | Moyenne | §134 | Une erreur de lecture du journal d’audit s’affichait comme une liste vide. ErrorState et colonne Utilisateur | corrigée | `fix(8.3-A13)` 404d06a ; `app/admin/audit/page.tsx` | `tests/parcours/admin-audit.test.ts:107`, `tests/parcours/admin-audit.test.ts:180`, `tests/parcours/admin-audit.test.ts:246`, `tests/parcours/admin-audit.test.ts:277` | vert au run 105 |
| A14 | Faible | §16 | q et city de la liste publique sans test. Preuve ajoutée, verte dès l’écriture | preuve ajoutée | `test(8.3)[garde-fous]` 2769248 ; `tests/parcours/decouverte-recherche.test.ts` | `tests/parcours/decouverte-recherche.test.ts:88`, `tests/parcours/decouverte-recherche.test.ts:97`, `tests/parcours/decouverte-recherche.test.ts:111`, `tests/parcours/decouverte-recherche.test.ts:122`, `tests/parcours/decouverte-recherche.test.ts:129` | vert au run 105 |
| A15 | Faible | §32, §33 | Affichage public sans assertion. Assertions ajoutées à l’acte 4, sauf le contact de l’organisateur | preuve ajoutée | `test(8.3b)` f7d8c5d ; `e2e/recette.spec.ts` | `e2e/recette.spec.ts:487` | vert au run 105 |
| A16 | Faible | décision | Code « à régler sur place » conservé, sans émetteur en production | listée | `lib/scan/scan-result.ts:20` | — | sans objet |
| A17 | Faible | §21 | Pas de liste des paiements du client | listée | `app/tickets/page.tsx` | — | sans objet |
| A18 | Faible | §157 | Pas d’écran de statistiques client | listée | `app/wallet/page.tsx` | — | sans objet |
| A19 | Faible | §189 | Guides client et administration absents, pages légales à prévoir | listée | `docs/guide-organisateur-entrees.md` | — | sans objet |
| A20 | Moyenne | outillage | Instabilité de la fumée au run 92 : case forcée hors de l’écran | corrigée | `test(e2e)[run 92]` ef2b36b ; `e2e/fumee.spec.ts` | `e2e/fumee.spec.ts:91` | vert au run 105 |
| A21 | Moyenne | §190 | Suites à la racine de tests/ qui ne prouvent rien : jamais citées ici | listée | `docs/lot0-rapport.md:547` | — | sans objet |
| A22 | Faible | design | Pages d’administration non migrées, hors du contrôle de design | listée | `tests/parcours/design-systeme.test.ts` | — | sans objet |
| A23 | Moyenne | export | Injection de formule dans l’export CSV ; statut technique affiché au refus du PDF ; statut brut à l’annulation | corrigée | `fix(8.3-A23)` 1fa3fe9 ; `lib/partner/partner-dashboard.service.ts`, `app/api/tickets/[id]/pdf/route.ts` | `tests/parcours/legacy-exports-partenaire.test.ts:221`, `tests/parcours/legacy-billet-pdf.test.ts:115` | vert au run 105 |
| A24 | Moyenne | §134, §152 | La route du journal d’audit sert tout ADMIN alors que la RLS réserve le superadmin | listée | `app/api/admin/audit/route.ts:15`, `M/0003_rls.sql:355` | — | sans objet |
| A25 | Faible | §134 | `limit` de cette route non borné | listée | `app/api/admin/audit/route.ts:23` | — | sans objet |
| A26 | Faible | §31 | Fiche partenaire d’un événement : une panne de lecture reste un 404 | listée | `app/api/partner/events/[id]/route.ts` | — | sans objet |
| A27 | Faible | §104 | Le trigger de boucle de parrainage ne couvre pas l’UPDATE par service_role | listée | `M/0011_referral_codes.sql:107` | — | sans objet |
| A28 | Faible | §16 | Écrans de recherche sans q ni city : filtre dans le navigateur, sur la liste déjà chargée. Le serveur sait filtrer (A14) | listée | `app/explore/page.tsx:140` | — | sans objet |
| A29 | Moyenne | §131 | L’alerte d’un remboursement bloqué pour solde insuffisant parlait d’un bénéficiaire incomplet | corrigée | `fix(8.3-A29)` f2334de ; `lib/notifications/catalog.ts` | `tests/parcours/notif-modeles.test.ts:501` | vert au run 105 |
| A30 | Élevée | §152, §155 | GET partner/halls/[id] sans contrôle de rôle ni de propriétaire : réservations et téléphone du partenaire lisibles par tout compte connecté quand le service est ouvert. Hors périmètre, service fermé aujourd’hui | listée | `app/api/partner/halls/[id]/route.ts` | — | sans objet |
| A31 | Moyenne | §152 | GET partner/products/[id] sans contrôle de propriétaire. Hors périmètre, service fermé | listée | `app/api/partner/products/[id]/route.ts` | — | sans objet |
| A32 | Faible | qualité | Panne présentée comme une absence, non journalisée : getEventById, getHallById, getProductById, GET orders/[id] | listée | `lib/events/event.service.ts:291`, `lib/halls/hall.service.ts:124`, `lib/products/product.service.ts:163` | — | sans objet |
| A33 | Moyenne | qualité | Écritures ignorées : admin/permissions POST, partner/register | listée | `app/api/admin/permissions/route.ts`, `app/api/partner/register/route.ts` | — | sans objet |
| A34 | Moyenne | qualité | Lectures ignorées : admin/communications POST, admin/pricing POST, send-otp, verify-otp, admin/users PATCH | listée | `app/api/admin/communications/route.ts`, `app/api/admin/pricing/route.ts`, `app/api/auth/send-otp/route.ts`, `app/api/auth/verify-otp/route.ts`, `app/api/admin/users/route.ts` | — | sans objet |
| A35 | Faible | 8.2 i | Un refus du fournisseur SMS arrivait à l’écran : send-otp recopiait `sendResult.error`. Texte fixe, détail au journal | corrigée | `test(8.3-A35)` 02e331f, `fix(8.3-A35)` 15dc7d0 ; `app/api/auth/send-otp/route.ts` | `tests/parcours/otp-serveur.test.ts:77` | vert au run 105 |
| A36 | Faible | 8.2 i | Le refus de rembourser un billet utilisé montrait le statut technique : `ticket_refund_request` l’écrit, migration gelée, la route met un texte fixe | corrigée | `test(8.3-A36)` ef3e9fa, `fix(8.3-A36)` ffc0167 ; `app/api/partner/events/[id]/tickets/[ticketId]/refund/route.ts`, `M/20261101000005_lot3_remboursements.sql:85` | `tests/parcours/pilotage-remboursement-billet.test.ts:266` | vert au run 105 |
| A37 | Faible | design | Effet de 8.2 s : les barres fixes en bas des pages salles, menu et tables passent sous la navigation mobile. Hors périmètre, derrière interrupteurs | listée | `app/halls/[id]/page.tsx:347`, `app/restaurants/[id]/menu/page.tsx:395`, `app/restaurants/[id]/tables/page.tsx:343` | — | sans objet |
| A38 | Faible | §134 | La route du journal lit `select('*')` sans jointure : la colonne Utilisateur montre un identifiant tronqué | listée | `app/api/admin/audit/route.ts:29`, `app/admin/audit/page.tsx:187` | — | sans objet |
| A39 | Moyenne | §158 | Le PDF de clôture garde « Document comptable certifie » et « Certificat de cloture » | listée | `lib/partner/partner-dashboard.service.ts:1069`, `lib/partner/partner-dashboard.service.ts:1072` | — | sans objet |
| A40 | Faible | outil d’essai | La route de développement ignore le statut du webhook : un webhook en 500 rend ok:true. Message prudent à l’écran | listée | `app/api/dev/samirpay/[action]/route.dev.ts`, `components/dev/FakePaymentPanel.tsx` | — | sans objet |
| A41 | Élevée | §36, §179 | Depuis le lot 3, un visiteur sans compte ne pouvait pas commencer un achat : le middleware refusait le devis public, la fiche affichait « Total indisponible ». Trouvée par le parcours de recette au run 99. Le devis passe sans session, le paiement reste protégé | corrigée | `test(8.3-A41)` 697f9ec, `fix(8.3-A41)` c532ca7 ; `middleware.ts:38` | `tests/parcours/finance-affichage.test.ts:80`, `e2e/recette.spec.ts:487` | vert au run 105 |

A41 est la seule anomalie de gravité Élevée trouvée par la recette elle-même : depuis le lot 3, un visiteur sans compte ne pouvait pas commencer un achat. Elle a été vue au run 99 (acte 4) et corrigée par `c532ca7`.

### Questions au client

Recopiées de `docs/recette-billetterie.md`, section 6 :

| N° | Question |
|---|---|
| Q1 | WhatsApp : faut-il le construire, et pour quels messages ? |
| Q2 | Parrainage prestataire : quelles transactions d’un prestataire comptent ? |
| Q3 | Que recouvre « Wallet » : Apple ou Google Wallet, ou la page Portefeuille ? |
| Q4 | Événements populaires et proches : selon quels critères ? |
| Q5 | Personnalisation des taux par le superadmin : à construire quand ? |
| Q6 | Quels taux après le passage d’un client en Ambassadeur ? |
| Sans numéro | Outil d’invitations : une catégorie sans canal n’est distribuée à personne aujourd’hui. Faut-il un outil pour envoyer des invitations ? |

À ajouter, posée par la consigne et la section 7 :

| N° | Question |
|---|---|
| N2 | Taux N2 : 2 % comme le fixe la consigne du lot 8, ou 3 % comme l’Annexe A du cahier des charges pour un Ambassadeur qui parraine un prestataire ? Aujourd’hui 2 %, la ligne 3 % est inatteignable tant que le parrainage prestataire n’existe pas (A5, Q2). |

L’outil d’invitations (ligne « Sans numéro ») répond à « Carré presse » : une catégorie sans aucun canal n’est distribuée à personne en production (PO1, AR8). L’aide du formulaire le dit (« Invitations seulement » avec l’alerte « aucun billet ne sera distribué ») ; rien n’a été construit.

---

---

## 13. Performance avant et après

### 13.1 Poids JavaScript après build (`[JS-BUDGET]`, gzip)

Au run 95, `verify` s’arrête à l’étape `test` : le `[JS-BUDGET]` n’y est pas imprimé. Le tableau du run 95 vient de l’étape `build-mesure` du même run (`build_mesure=success` dans `run.txt`), écrit dans `js-budget.tsv` :

```text
# run 95 (db21d1c) — docs/lot8-logs/ci-run95-js-budget.tsv
route	fichiers	octets_gzip	octets_bruts	budget	statut
/	16	214399	741617	217000	OK
/events/[id]	16	220604	766376	224000	OK
/tickets	20	237601	814713	241000	OK
/controller/scanner	17	222499	769681	226000	OK
/billet/hors-ligne	15	211561	735210	215000	OK
```

```text
# run 107 (bc864fa) — docs/lot8-logs/ci-run107-verify.log:26175-26182
[JS-BUDGET] budgets : scripts/js-budget.json
[JS-BUDGET] / : 214735 octets gzip (214,7 Ko), 16 fichier(s) JS, 742650 octets bruts — budget 217000 octets (217,0 Ko) : OK
[JS-BUDGET] /events/[id] : 220686 octets gzip (220,7 Ko), 16 fichier(s) JS, 766708 octets bruts — budget 224000 octets (224,0 Ko) : OK
[JS-BUDGET] /tickets : 237729 octets gzip (237,7 Ko), 20 fichier(s) JS, 815236 octets bruts — budget 241000 octets (241,0 Ko) : OK
[JS-BUDGET] /controller/scanner : 222731 octets gzip (222,7 Ko), 17 fichier(s) JS, 770483 octets bruts — budget 226000 octets (226,0 Ko) : OK
[JS-BUDGET] /billet/hors-ligne : 211628 octets gzip (211,6 Ko), 15 fichier(s) JS, 735453 octets bruts — budget 215000 octets (215,0 Ko) : OK
[JS-BUDGET] tableau écrit : .verify/js-budget.tsv
[JS-BUDGET] toutes les routes budgétées sont dans leur budget.
```

| Route | Run 95 (octets gzip) | Run 107 | Écart | Budget | Marge au run 107 |
|---|---|---|---|---|---|
| `/` | 214 399 | 214 735 | +336 | 217 000 | 2 265 |
| `/events/[id]` | 220 604 | 220 686 | +82 | 224 000 | 3 314 |
| `/tickets` | 237 601 | 237 729 | +128 | 241 000 | 3 271 |
| `/controller/scanner` | 222 499 | 222 731 | +232 | 226 000 | 3 269 |
| `/billet/hors-ligne` | 211 561 | 211 628 | +67 | 215 000 | 3 372 |

Aucun budget relevé (L74). La plus petite marge est sur `/` : 2 265 octets au run 107, contre 2 601 au run 95 (le contrat annonçait 2 602 avant le lot). Les quatre autres routes gardent entre 3 269 et 3 372 octets.

### 13.2 Temps d’affichage (e2e `perf`, médianes de 5 passages, 4G simulée, processeur ×4)

La fiche événement bouge au lot 8 (barre d’achat, 8.2 s ; carte), d’où la comparaison. Lignes de synthèse telles quelles :

```text
# run 95 (db21d1c) — docs/lot8-logs/ci-run95-e2e.log
[PERF] Accueil (/, anonyme) — 5 passages, 4G (DevTools « Slow 4G »), processeur ×4
[PERF]   premier affichage utile : médiane 4773 ms, max 4775 ms ; FCP médiane 1492 ms ; LCP médiane 1492 ms, max 1496 ms
[PERF]   JavaScript (a) avant le marqueur : médiane 218,0 Ko, max 218,0 Ko ; (b) à + 3 s : médiane 250,4 Ko ; CSS 17,1 Ko ; total 368,0 Ko ; recoupement réseau 250,8 Ko
[PERF]   budget post-build / : 217,0 Ko + 20,0 Ko de tolérance
[PERF-AVERTISSEMENT] accueil : premier affichage utile médian 4773 ms > 3 000 ms
[PERF] Page événement (/events/e872d2a3-e91e-4f3b-b293-18547fdd5ac5, anonyme) — 5 passages, 4G (DevTools « Slow 4G »), processeur ×4
[PERF]   premier affichage utile : médiane 4695 ms, max 4737 ms ; FCP médiane 1460 ms ; LCP médiane 5376 ms, max 5420 ms
[PERF]   JavaScript (a) avant le marqueur : médiane 224,3 Ko, max 224,3 Ko ; (b) à + 3 s : médiane 270,5 Ko ; CSS 17,1 Ko ; total 353,7 Ko ; recoupement réseau 271,0 Ko
[PERF]   budget post-build /events/[id] : 224,0 Ko + 20,0 Ko de tolérance
[PERF-AVERTISSEMENT] evenement : premier affichage utile médian 4695 ms > 3 000 ms
[PERF-AVERTISSEMENT] evenement : LCP médian 5376 ms > 4 000 ms
[PERF] Mes billets (/tickets, client) — 5 passages, 4G (DevTools « Slow 4G »), processeur ×4
[PERF]   premier affichage utile : médiane 5817 ms, max 5842 ms ; FCP médiane 1476 ms ; LCP médiane 7132 ms, max 7184 ms
[PERF]   JavaScript (a) avant le marqueur : médiane 241,3 Ko, max 241,3 Ko ; (b) à + 3 s : médiane 321,3 Ko ; CSS 17,1 Ko ; total 493,7 Ko ; recoupement réseau 321,9 Ko
[PERF]   budget post-build /tickets : 241,0 Ko + 20,0 Ko de tolérance
[PERF-AVERTISSEMENT] mes-billets : premier affichage utile médian 5817 ms > 3 000 ms
[PERF-AVERTISSEMENT] mes-billets : LCP médian 7132 ms > 4 000 ms
[PERF] Scanner (/controller/scanner, controleur) — 5 passages, 4G (DevTools « Slow 4G »), processeur ×4
[PERF]   premier affichage utile : médiane 4721 ms, max 4729 ms ; FCP médiane 1476 ms ; LCP médiane 4744 ms, max 4756 ms
[PERF]   JavaScript (a) avant le marqueur : médiane 235,1 Ko, max 240,0 Ko ; (b) à + 3 s : médiane 273,6 Ko ; CSS 17,1 Ko ; total 331,1 Ko ; recoupement réseau 274,1 Ko
[PERF]   caméra en lecture : médiane 8076 ms ; JavaScript à + 3 s caméra lancée : médiane 450,8 Ko, max 450,8 Ko
[PERF]   budget post-build /controller/scanner : 226,0 Ko + 20,0 Ko de tolérance
[PERF-AVERTISSEMENT] scanner : premier affichage utile médian 4721 ms > 3 000 ms
[PERF-AVERTISSEMENT] scanner : LCP médian 4744 ms > 4 000 ms
```

```text
# run 107 (bc864fa) — docs/lot8-logs/ci-run107-e2e.log
[PERF] Accueil (/, anonyme) — 5 passages, 4G (DevTools « Slow 4G »), processeur ×4
[PERF]   premier affichage utile : médiane 4735 ms, max 4736 ms ; FCP médiane 1476 ms ; LCP médiane 1476 ms, max 1492 ms
[PERF]   JavaScript (a) avant le marqueur : médiane 218,5 Ko, max 218,5 Ko ; (b) à + 3 s : médiane 250,8 Ko ; CSS 16,9 Ko ; total 381,3 Ko ; recoupement réseau 251,3 Ko
[PERF]   budget post-build / : 217,0 Ko + 20,0 Ko de tolérance
[PERF-AVERTISSEMENT] accueil : premier affichage utile médian 4735 ms > 3 000 ms
[PERF] Page événement (/events/a01f3149-dd2d-413e-8409-c04cad13edc4, anonyme) — 5 passages, 4G (DevTools « Slow 4G »), processeur ×4
[PERF]   premier affichage utile : médiane 4649 ms, max 4652 ms ; FCP médiane 1456 ms ; LCP médiane 5328 ms, max 5344 ms
[PERF]   JavaScript (a) avant le marqueur : médiane 224,4 Ko, max 224,4 Ko ; (b) à + 3 s : médiane 271,0 Ko ; CSS 16,9 Ko ; total 354,2 Ko ; recoupement réseau 271,5 Ko
[PERF]   budget post-build /events/[id] : 224,0 Ko + 20,0 Ko de tolérance
[PERF-AVERTISSEMENT] evenement : premier affichage utile médian 4649 ms > 3 000 ms
[PERF-AVERTISSEMENT] evenement : LCP médian 5328 ms > 4 000 ms
[PERF] Mes billets (/tickets, client) — 5 passages, 4G (DevTools « Slow 4G »), processeur ×4
[PERF]   premier affichage utile : médiane 5760 ms, max 5768 ms ; FCP médiane 1472 ms ; LCP médiane 7128 ms, max 7152 ms
[PERF]   JavaScript (a) avant le marqueur : médiane 241,5 Ko, max 241,5 Ko ; (b) à + 3 s : médiane 321,9 Ko ; CSS 16,9 Ko ; total 478,5 Ko ; recoupement réseau 322,6 Ko
[PERF]   budget post-build /tickets : 241,0 Ko + 20,0 Ko de tolérance
[PERF-AVERTISSEMENT] mes-billets : premier affichage utile médian 5760 ms > 3 000 ms
[PERF-AVERTISSEMENT] mes-billets : LCP médian 7128 ms > 4 000 ms
[PERF] Scanner (/controller/scanner, controleur) — 5 passages, 4G (DevTools « Slow 4G »), processeur ×4
[PERF]   premier affichage utile : médiane 4678 ms, max 4691 ms ; FCP médiane 1464 ms ; LCP médiane 4708 ms, max 4716 ms
[PERF]   JavaScript (a) avant le marqueur : médiane 233,9 Ko, max 240,4 Ko ; (b) à + 3 s : médiane 274,3 Ko ; CSS 16,9 Ko ; total 331,7 Ko ; recoupement réseau 274,9 Ko
[PERF]   caméra en lecture : médiane 7987 ms ; JavaScript à + 3 s caméra lancée : médiane 451,5 Ko, max 451,5 Ko
[PERF]   budget post-build /controller/scanner : 226,0 Ko + 20,0 Ko de tolérance
[PERF-AVERTISSEMENT] scanner : premier affichage utile médian 4678 ms > 3 000 ms
[PERF-AVERTISSEMENT] scanner : LCP médian 4708 ms > 4 000 ms
```

| Page | Affichage utile, médiane 95 → 107 | LCP, médiane 95 → 107 | JS avant le marqueur 95 → 107 |
|---|---|---|---|
| Accueil | 4773 → 4735 ms | 1492 → 1476 ms | 218,0 → 218,5 Ko |
| Page événement | 4695 → 4649 ms | 5376 → 5328 ms | 224,3 → 224,4 Ko |
| Mes billets | 5817 → 5760 ms | 7132 → 7128 ms | 241,3 → 241,5 Ko |
| Scanner | 4721 → 4678 ms | 4744 → 4708 ms | 235,1 → 233,9 Ko |

Les avertissements `[PERF-AVERTISSEMENT]` (affichage utile au-delà de 3 s, LCP au-delà de 4 s) sont les mêmes avant et après, sur les quatre pages ; ils ne sont pas bloquants et existaient avant le lot 8. Entre les deux runs, l’affichage utile et le LCP baissent de moins de 1 % sur les quatre pages, et le JavaScript chargé varie de moins de 1 % dans les deux sens : écarts trop faibles pour les attribuer à un correctif, sur un seul run de chaque côté.

---

---

## 14. Avertissements et contrôles bloquants des captures au run final (107)

Contrôles **bloquants** depuis le lot 7 : cibles tactiles sous 44 px, textes sous 14 px hors exemption, règles axe-core, contraste ≥ 7:1 du titre des pleins écrans du scanner (D73), valeurs techniques à l’écran. Au lot 8, `RAW_ENUM_VALUES` reçoit `not_processed`, `sale_online`, `sale_counter` et `on_site_only` (`e2e/support/checks.ts:72`, contrat 15.7, T24, plus strict). **Seul assouplissement** : le champ `references` de l’écran `partenaire-rapport-cloture` admet un nœud égal à `^CLOTURE-[0-9A-F]{8}-\d{8}$` (numéro du rapport, imposé par `design-systeme.test.ts:737`) ; `CLOTURE` seul reste refusé, même sur cet écran (`aba8029`, signalé par l’agent e2e).

Décompte refait sur `avertissements.tsv` du run 107 (327 lignes) : résultat `OK` pour 327 captures ; cibles < 44 px : 0 ; textes < 14 px hors exemption : 0 ; règles axe-core en défaut : 0 ; préchargements Next abandonnés (non bloquants) : 159.

Tableau écran × règle de l’index, tel quel (`index.txt:13-106`) :

```text
TABLEAU ÉCRAN × RÈGLE (avertissements ; valeurs par vue : m-c/m-s/o-c/o-s = mobile clair/sombre, ordinateur clair/sombre ; ? = contrôles non exécutés)
écran | cibles < 44 px | textes < 14 px bruts | dont admis | dont hors exemption | axe (règles, nœuds au plus)
accueil | 0/0/0/0 | 12/12/8/8 | 12/12/8/8 | 0/0/0/0 | aucune
accueil-acces-refuse | 0/0/0/0 | 13/13/9/9 | 13/13/9/9 | 0/0/0/0 | aucune
admin-campagnes | 0/0/0/0 | 6/6/1/1 | 6/6/1/1 | 0/0/0/0 | aucune
admin-evenements | 0/0/0/0 | 10/10/5/5 | 10/10/5/5 | 0/0/0/0 | aucune
admin-evenements-en-attente | 0/0/0/0 | 10/10/5/5 | 10/10/5/5 | 0/0/0/0 | aucune
admin-evenements-erreur | 0/0/0/0 | 6/6/1/1 | 6/6/1/1 | 0/0/0/0 | aucune
admin-fiche-en-attente | 0/0/0/0 | 13/13/8/8 | 13/13/8/8 | 0/0/0/0 | aucune
admin-fiche-suspendu | 0/0/0/0 | 11/11/6/6 | 11/11/6/6 | 0/0/0/0 | aucune
admin-notifications | 0/0/0/0 | 26/26/21/21 | 26/26/21/21 | 0/0/0/0 | aucune
admin-notifications-detail | 0/0/0/0 | 9/9/4/4 | 9/9/4/4 | 0/0/0/0 | aucune
admin-notifications-erreur | 0/0/0/0 | 6/6/1/1 | 6/6/1/1 | 0/0/0/0 | aucune
admin-remboursements-a-reprendre | 0/0/0/0 | 9/9/4/4 | 9/9/4/4 | 0/0/0/0 | aucune
admin-services-desactive | 0/0/0/0 | 6/6/1/1 | 6/6/1/1 | 0/0/0/0 | aucune
aide-transfert | 0/0/0/0 | 8/8/4/4 | 8/8/4/4 | 0/0/0/0 | aucune
billet-hors-ligne-a-telecharger | 0/0/0/0 | 8/8/4/4 | 8/8/4/4 | 0/0/0/0 | aucune
billet-hors-ligne-disponible | 0/0/0/0 | 8/8/4/4 | 8/8/4/4 | 0/0/0/0 | aucune
billet-hors-ligne-qr | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 | aucune
billet-hors-ligne-sans-codes | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 | aucune
caisse-cloture-ecart | —/0/—/0 | —/1/—/1 | —/1/—/1 | —/0/—/0 | aucune
caisse-ouverture | —/0/—/0 | —/1/—/1 | —/1/—/1 | —/0/—/0 | aucune
caisse-ticket-z | —/0/—/0 | —/1/—/1 | —/1/—/1 | —/0/—/0 | aucune
catalogue | 0/0/0/0 | 15/15/11/11 | 15/15/11/11 | 0/0/0/0 | aucune
cloche-ouverte | 0/0/0/0 | 27/27/23/23 | 27/27/23/23 | 0/0/0/0 | aucune
connexion | 0/0/0/0 | 4/4/0/0 | 4/4/0/0 | 0/0/0/0 | aucune
controleur-activation | —/0/—/0 | —/0/—/0 | —/0/—/0 | —/0/—/0 | aucune
controleur-profil | —/0/—/0 | —/3/—/3 | —/3/—/3 | —/0/—/0 | aucune
controleur-scanner | —/0/—/0 | —/1/—/1 | —/1/—/1 | —/0/—/0 | aucune
dev-paiements | 0/0/0/0 | 1/1/1/1 | 1/1/1/1 | 0/0/0/0 | aucune
evenement-annule | 0/0/0/0 | 7/7/3/3 | 7/7/3/3 | 0/0/0/0 | aucune
evenement-identifiant-invalide | 0/—/—/— | 4/—/—/— | 4/—/—/— | 0/—/—/— | aucune
evenement-introuvable | 0/0/0/0 | 4/4/0/0 | 4/4/0/0 | 0/0/0/0 | aucune
evenement-non-public | 0/0/0/0 | 4/4/0/0 | 4/4/0/0 | 0/0/0/0 | aucune
evenement-publie | 0/0/0/0 | 9/9/5/5 | 9/9/5/5 | 0/0/0/0 | aucune
evenement-suspendu | 0/0/0/0 | 7/7/3/3 | 7/7/3/3 | 0/0/0/0 | aucune
evenement-termine | 0/0/0/0 | 7/7/3/3 | 7/7/3/3 | 0/0/0/0 | aucune
fiche-barre-achat | 0/0/—/— | 13/13/—/— | 13/13/—/— | 0/0/—/— | aucune
hors-ligne | 0/0/0/0 | 15/15/11/11 | 15/15/11/11 | 0/0/0/0 | aucune
inscription | 0/0/0/0 | 4/4/0/0 | 4/4/0/0 | 0/0/0/0 | aucune
inscription-code | 0/0/0/0 | 4/4/0/0 | 4/4/0/0 | 0/0/0/0 | aucune
mes-billets | 0/0/0/0 | 8/8/4/4 | 8/8/4/4 | 0/0/0/0 | aucune
mes-billets-recus | 0/0/0/0 | 5/5/1/1 | 5/5/1/1 | 0/0/0/0 | aucune
mot-de-passe-oublie | 0/0/0/0 | 4/4/0/0 | 4/4/0/0 | 0/0/0/0 | aucune
notifications | 0/0/0/0 | 14/14/10/10 | 14/14/10/10 | 0/0/0/0 | aucune
notifications-erreur | 0/0/0/0 | 4/4/0/0 | 4/4/0/0 | 0/0/0/0 | aucune
notifications-vide | 0/0/0/0 | 4/4/0/0 | 4/4/0/0 | 0/0/0/0 | aucune
page-masquee-commandes | 0/0/0/0 | 5/5/1/1 | 5/5/1/1 | 0/0/0/0 | aucune
page-masquee-salles | 0/0/0/0 | 4/4/0/0 | 4/4/0/0 | 0/0/0/0 | aucune
paiement-attente | 0/0/0/0 | 6/6/2/2 | 6/6/2/2 | 0/0/0/0 | aucune
paiement-echec | 0/0/0/0 | 6/6/2/2 | 6/6/2/2 | 0/0/0/0 | aucune
paiement-modale | 0/0/0/0 | 10/10/6/6 | 10/10/6/6 | 0/0/0/0 | aucune
paiement-succes | 0/0/0/0 | 6/6/2/2 | 6/6/2/2 | 0/0/0/0 | aucune
partenaire-abonnement | 0/0/0/0 | 12/12/7/7 | 12/12/7/7 | 0/0/0/0 | aucune
partenaire-categorie-canaux | 0/0/0/0 | 6/6/1/1 | 6/6/1/1 | 0/0/0/0 | aucune
partenaire-categorie-invitations | 0/0/0/0 | 6/6/1/1 | 6/6/1/1 | 0/0/0/0 | aucune
partenaire-creation | 0/0/0/0 | 6/6/1/1 | 6/6/1/1 | 0/0/0/0 | aucune
partenaire-edition | 0/0/0/0 | 6/6/1/1 | 6/6/1/1 | 0/0/0/0 | aucune
partenaire-equipe | 0/0/0/0 | 9/9/4/4 | 9/9/4/4 | 0/0/0/0 | aucune
partenaire-evenements | 0/0/0/0 | 14/14/9/9 | 14/14/9/9 | 0/0/0/0 | aucune
partenaire-evenements-annules | 0/0/0/0 | 7/7/2/2 | 7/7/2/2 | 0/0/0/0 | aucune
partenaire-evenements-erreur | 0/0/0/0 | 6/6/1/1 | 6/6/1/1 | 0/0/0/0 | aucune
partenaire-finances | 0/0/0/0 | 6/6/1/1 | 6/6/1/1 | 0/0/0/0 | aucune
partenaire-inscription | 0/0/0/0 | 5/5/1/1 | 5/5/1/1 | 0/0/0/0 | aucune
partenaire-premiers-pas | 0/0/0/0 | 8/8/3/3 | 8/8/3/3 | 0/0/0/0 | aucune
partenaire-profil | 0/0/0/0 | 6/6/1/1 | 6/6/1/1 | 0/0/0/0 | aucune
partenaire-rapport-cloture | 0/0/0/0 | 30/30/25/25 | 30/30/25/25 | 0/0/0/0 | aucune
partenaire-tableau-de-bord | 0/0/0/0 | 30/30/25/25 | 30/30/25/25 | 0/0/0/0 | aucune
pilotage-annulation | 0/0/0/0 | 6/6/1/1 | 6/6/1/1 | 0/0/0/0 | aucune
pilotage-apercu | 0/0/0/0 | 6/6/1/1 | 6/6/1/1 | 0/0/0/0 | aucune
pilotage-caisse | 0/0/0/0 | 6/6/1/1 | 6/6/1/1 | 0/0/0/0 | aucune
pilotage-cloture | 0/0/0/0 | 6/6/1/1 | 6/6/1/1 | 0/0/0/0 | aucune
pilotage-entrees | 0/0/0/0 | 6/6/1/1 | 6/6/1/1 | 0/0/0/0 | aucune
pilotage-equipe | 0/0/0/0 | 6/6/1/1 | 6/6/1/1 | 0/0/0/0 | aucune
pilotage-erreur | 0/0/0/0 | 6/6/1/1 | 6/6/1/1 | 0/0/0/0 | aucune
pilotage-remboursements | 0/0/0/0 | 6/6/1/1 | 6/6/1/1 | 0/0/0/0 | aucune
pilotage-rembourser-billet | 0/0/0/0 | 6/6/1/1 | 6/6/1/1 | 0/0/0/0 | aucune
pilotage-ventes | 0/0/0/0 | 6/6/1/1 | 6/6/1/1 | 0/0/0/0 | aucune
portefeuille | 0/0/0/0 | 5/5/1/1 | 5/5/1/1 | 0/0/0/0 | aucune
preferences-push-active | 0/0/0/0 | 5/5/1/1 | 5/5/1/1 | 0/0/0/0 | aucune
preferences-push-non-pris-en-charge | 0/0/0/0 | 5/5/1/1 | 5/5/1/1 | 0/0/0/0 | aucune
preferences-push-refuse | 0/0/0/0 | 5/5/1/1 | 5/5/1/1 | 0/0/0/0 | aucune
scanner-a-encaisser | —/0/—/0 | —/1/—/1 | —/1/—/1 | —/0/—/0 | aucune
scanner-accepte | —/0/—/0 | —/1/—/1 | —/1/—/1 | —/0/—/0 | aucune
scanner-accueil | —/0/—/0 | —/1/—/1 | —/1/—/1 | —/0/—/0 | aucune
scanner-deja-utilise | —/0/—/0 | —/1/—/1 | —/1/—/1 | —/0/—/0 | aucune
scanner-evenement-annule | —/0/—/0 | —/1/—/1 | —/1/—/1 | —/0/—/0 | aucune
scanner-guichet | —/0/—/0 | —/1/—/1 | —/1/—/1 | —/0/—/0 | aucune
scanner-hors-fenetre | —/0/—/0 | —/1/—/1 | —/1/—/1 | —/0/—/0 | aucune
scanner-hors-ligne | —/0/—/0 | —/1/—/1 | —/1/—/1 | —/0/—/0 | aucune
scanner-non-traite | —/0/—/0 | —/1/—/1 | —/1/—/1 | —/0/—/0 | aucune
scanner-refuse | —/0/—/0 | —/1/—/1 | —/1/—/1 | —/0/—/0 | aucune
scanner-reseau-lent | —/0/—/0 | —/1/—/1 | —/1/—/1 | —/0/—/0 | aucune
scanner-saisie-manuelle | —/0/—/0 | —/1/—/1 | —/1/—/1 | —/0/—/0 | aucune
```

Tous les textes de moins de 14 px sont admis par une exemption (`data-ev-caption`, `small`, `time`, détaillée sous chaque capture de l’index).

Contraste des pleins écrans du scanner, contrôle bloquant (`index.txt`, 14 lignes) :

```text
avertissement : plein écran du scanner (cash_required, « Encaissement requis : 5 000 F CFA ») : contraste 10.36:1 (texte rgb(255, 255, 255), fond rgb(30, 58, 138)) ≥ 7:1 (contrôle bloquant satisfait)
avertissement : plein écran du scanner (cash_required, « Encaissement requis : 5 000 F CFA ») : contraste 10.36:1 (texte rgb(255, 255, 255), fond rgb(30, 58, 138)) ≥ 7:1 (contrôle bloquant satisfait)
avertissement : plein écran du scanner (valid, « Entrée validée ») : contraste 12.05:1 (texte rgb(0, 0, 0), fond rgb(74, 222, 128)) ≥ 7:1 (contrôle bloquant satisfait)
avertissement : plein écran du scanner (valid, « Entrée validée ») : contraste 12.05:1 (texte rgb(0, 0, 0), fond rgb(74, 222, 128)) ≥ 7:1 (contrôle bloquant satisfait)
avertissement : plein écran du scanner (already_used, « Billet déjà utilisé ») : contraste 9.37:1 (texte rgb(255, 255, 255), fond rgb(124, 45, 18)) ≥ 7:1 (contrôle bloquant satisfait)
avertissement : plein écran du scanner (already_used, « Billet déjà utilisé ») : contraste 9.37:1 (texte rgb(255, 255, 255), fond rgb(124, 45, 18)) ≥ 7:1 (contrôle bloquant satisfait)
avertissement : plein écran du scanner (event_cancelled, « Événement annulé ») : contraste 10.02:1 (texte rgb(255, 255, 255), fond rgb(127, 29, 29)) ≥ 7:1 (contrôle bloquant satisfait)
avertissement : plein écran du scanner (event_cancelled, « Événement annulé ») : contraste 10.02:1 (texte rgb(255, 255, 255), fond rgb(127, 29, 29)) ≥ 7:1 (contrôle bloquant satisfait)
avertissement : plein écran du scanner (event_not_open, « Contrôle pas encore ouvert ») : contraste 12.58:1 (texte rgb(0, 0, 0), fond rgb(251, 191, 36)) ≥ 7:1 (contrôle bloquant satisfait)
avertissement : plein écran du scanner (event_not_open, « Contrôle pas encore ouvert ») : contraste 12.58:1 (texte rgb(0, 0, 0), fond rgb(251, 191, 36)) ≥ 7:1 (contrôle bloquant satisfait)
avertissement : plein écran du scanner (not_processed, « Scan non traité : scannez le billet de nouveau ») : contraste 14.89:1 (texte rgb(255, 255, 255), fond rgb(39, 39, 42)) ≥ 7:1 (contrôle bloquant satisfait)
avertissement : plein écran du scanner (not_processed, « Scan non traité : scannez le billet de nouveau ») : contraste 14.89:1 (texte rgb(255, 255, 255), fond rgb(39, 39, 42)) ≥ 7:1 (contrôle bloquant satisfait)
avertissement : plein écran du scanner (qr_expired, « QR expiré : demandez au client de rafraîchir son billet ») : contraste 10.02:1 (texte rgb(255, 255, 255), fond rgb(127, 29, 29)) ≥ 7:1 (contrôle bloquant satisfait)
avertissement : plein écran du scanner (qr_expired, « QR expiré : demandez au client de rafraîchir son billet ») : contraste 10.02:1 (texte rgb(255, 255, 255), fond rgb(127, 29, 29)) ≥ 7:1 (contrôle bloquant satisfait)
```

Notes de l’index (non bloquantes ; chiffres remplacés par N pour les regrouper), les plus fréquentes :

```text
 341  requêtes /api/ encore en cours après N s (attente plafonnée, DN) : GET localhost:N/api/notifications?limit=N
  20  minuteries de N ms ou plus étirées ×N (état tenu pendant les contrôles)
  18  caméra simulée (barcode-detector) : faux BarcodeDetector, payload posé par le test
  16  localStorage posé avant le chargement : ev_scanner_auto_return_ms=N
  14  images encore en chargement après N s (page.waitForFunction: Timeout Nms exceeded.)
  14  caméra simulée (camera)
   8  requête retenue (jamais servie) : GET /\/api\/tickets\/[^/]+\/offline-codes(\?.*)?$/
   8  service worker autorisé dans ce contexte (DN : bloqué partout ailleurs)
   6  requêtes /api/ encore en cours après N s (attente plafonnée, DN) : GET localhost:N/api/notifications?limit=N, 
   4  état d'erreur simulé : réponses /\/api\/admin\/events(\?.*)?$/ remplacées par un N (erreurs de console attendu
   4  état d'erreur simulé : réponses /\/api\/admin\/notifications(\?.*)?$/ remplacées par un N (erreurs de console 
   4  réponse simulée : GET /\/api\/admin\/finance\/reconciliation(\?.*)?$/ remplacée par HTTP N {"summary":{"period
```

Les 341 notes « requêtes /api/ encore en cours après 3 s » visent `GET /api/notifications?limit=20` : l’attente est plafonnée (D84 du lot 7), la capture est prise quand même. Les 14 « images encore en chargement après 5 s » portent sur l’accueil et le catalogue. Ni l’une ni l’autre ne rend une capture fausse à elle seule ; une image prise avant la fin du chargement peut montrer un visuel incomplet : NON VÉRIFIÉ image par image.

Comparaison des en-têtes : run 105, `avertissements : 311 capture(s)`, `préchargements : 138` ; run 107, 309 et 159. Au run 95, la phase captures finissait à 323 entrées dont 43 en échec :

```text
# run 95 — docs/lot8-logs/ci-run95-e2e.log:394, puis décompte des ✘ par écran de la phase captures
[e2e] index des captures : .e2e-captures/captures/index.txt (323 entrée(s), 43 en échec)
4 × accueil-acces-refuse
4 × admin-remboursements-a-reprendre
4 × admin-services-desactive
1 × evenement-identifiant-invalide
4 × evenement-introuvable
4 × evenement-non-public
2 × fiche-barre-achat
4 × partenaire-categorie-canaux
4 × partenaire-categorie-invitations
4 × partenaire-rapport-cloture
4 × pilotage-rembourser-billet
2 × scanner-guichet
2 × scanner-non-traite
```

Les 43 échecs du run 95 portent tous sur des écrans pas encore livrés ou pas encore corrigés au moment du run « avant » (contrat 15.6 : « écrits au commit rouge »).

---

---

## 15. Traces ui-ux-pro-max

47 traces dans `docs/lot8-logs/ui-ux-pro-max/`, une par appel du skill (outil `scratchpad/uiux.sh`, AR15). Chaque fichier garde l’en-tête (agent, sujet, date, commande) puis la sortie brute du skill. Répartition : E0 5, E1 4, E2 9, E3 8, E4 7, E5 3, ORCH 3, R2 8. « R2 » est l’agent correcteur de la relecture (8.2 u) ; « ORCH », l’orchestrateur.

| Fichier | Agent | Requête | Résultats | Règles renvoyées (titres) |
|---|---|---|---|---|
| `E0-001-canaux-formulaire.txt` | E0 | domain ux | 3 | Focusable Error Summary; ARIA Labels; Consistent Help |
| `E0-002-canaux-formulaire-nextjs.txt` | E0 | stack nextjs | 3 | Push Client Components down; Mark Client Components explicitly; Use Server Actions for mutations |
| `E0-003-remboursement-billet.txt` | E0 | domain ux | 3 | Confirmation Dialogs; Confirmation Messages; Error Recovery |
| `E0-004-remboursement-billet-nextjs.txt` | E0 | stack nextjs | 3 | Handle loading states; Handle errors with error.tsx; Use Server Actions for mutations |
| `E0-005-guichet-pilotage-canaux.txt` | E0 | domain ux | 3 | Color Only; Contextual Live Badge Updates; Color Contrast |
| `E1-001-scan-non-traite.txt` | E1 | domain ux | 3 | Error Recovery; Toast Notifications; Submit Feedback |
| `E1-002-scan-reprise-etat.txt` | E1 | stack nextjs | 3 | Revalidate or update data appropriately; Use streaming for better UX; Use use cache for cacheable functions and components |
| `E1-003-scan-chiffres-tabulaires.txt` | E1 | domain typography | 0 | — |
| `E1-004-scan-chiffres-lisibles.txt` | E1 | domain ux | 3 | Number Formatting; Table Handling; Bulk Actions |
| `E2-001-police-tabulaire.txt` | E2 | domain ux | 3 | Table Handling; Number Formatting; Font Loading |
| `E2-002-police-tabulaire-nextjs.txt` | E2 | stack nextjs | 3 | Use variable fonts; Use next/font for fonts; Apply font to layout |
| `E2-003-rapport-cloture.txt` | E2 | domain ux | 3 | Table Handling; Focusable Error Summary; Mobile First |
| `E2-004-rapport-cloture-nextjs.txt` | E2 | stack nextjs | 3 | Use dynamic imports; Handle errors with error.tsx; Push Client Components down |
| `E2-005-barre-achat.txt` | E2 | domain ux | 3 | Sticky Navigation; Stacking Context; Z-Index Management |
| `E2-006-barre-achat-nextjs.txt` | E2 | stack nextjs | 0 | — |
| `E2-007-journal-audit.txt` | E2 | domain ux | 3 | Active State; Deep Linking; Cancellable State Transitions |
| `E2-008-journal-audit-nextjs.txt` | E2 | stack nextjs | 3 | Handle loading states; Handle errors with error.tsx; Push Client Components down |
| `E2-009-barre-achat-nextjs2.txt` | E2 | stack nextjs | 3 | Apply font to layout; Avoid layout shifts; Provide width and height |
| `E3-001-alertes-sms.txt` | E3 | domain ux | 3 | Content Jumping; Chip Collection Reflow; Contextual Live Badge Updates |
| `E3-002-alertes-sms-nextjs.txt` | E3 | stack nextjs | 3 | Push Client Components down; Mark Client Components explicitly; Use NEXT_PUBLIC prefix |
| `E3-003-services-desactive.txt` | E3 | domain ux | 3 | Disabled States; Submit Feedback; Color Only |
| `E3-004-services-desactive-nextjs.txt` | E3 | stack nextjs | 3 | Handle loading states; Push Client Components down; Mark Client Components explicitly |
| `E3-005-parrainage-fausse-sauvegarde.txt` | E3 | domain ux | 3 | Success Feedback; Disabled States; Text Reflow and Spacing |
| `E3-006-remboursements-reprise.txt` | E3 | domain ux | 3 | Error Recovery; Confirmation Dialogs; Confirmation Messages |
| `E3-007-remboursements-table-mobile.txt` | E3 | domain ux | 3 | Horizontal Scroll; Touch Target Size; Table Handling |
| `E3-008-remboursements-nextjs.txt` | E3 | stack nextjs | 3 | Handle errors with error.tsx; Push Client Components down; Use updateTag for read-your-own-writes |
| `E4-001-accueil-acces.txt` | E4 | domain ux | 3 | Compact Control Semantics; Haptic Feedback; Feedback Loop |
| `E4-002-accueil-acces-nextjs.txt` | E4 | stack nextjs | 3 | Use Partial Prerendering; Push Client Components down; Use Server Components by default |
| `E4-003-erreurs-auth.txt` | E4 | domain ux | 3 | Error Recovery; Password Visibility; Error Messages |
| `E4-004-global-error.txt` | E4 | stack nextjs | 3 | Handle errors with error.tsx; Use proxy.ts for auth and request guards; Push Client Components down |
| `E4-005-parrainage-register.txt` | E4 | domain ux | 3 | Error Placement; Submit Feedback; Form Labels |
| `E4-006-parrainage-nextjs.txt` | E4 | stack nextjs | 3 | Use streaming for better UX; Fetch data in Server Components; Push Client Components down |
| `E4-007-accueil-acces-alerte.txt` | E4 | domain ux | 3 | Error Messages; ARIA Labels; Confirmation Messages |
| `E5-001-paiement-simule.txt` | E5 | domain ux | 3 | Confirmation Messages; Success Feedback; Submit Feedback |
| `E5-002-retour-action.txt` | E5 | domain ux | 3 | Submit Feedback; Success Feedback; Loading Indicators |
| `E5-003-rendu-serveur.txt` | E5 | stack nextjs | 3 | Use Server Actions for mutations; Validate Server Action input; Use updateTag for read-your-own-writes |
| `ORCH-001-modal-defilement-clavier.txt` | ORCH | domain ux | 3 | Focus States; Focus Not Obscured (Enhanced); Focus Not Obscured (Minimum) |
| `ORCH-002-libelle-net-organisateur.txt` | ORCH | domain ux | 3 | Compact Label Overflow; Input Labels; Compact Label Semantics |
| `ORCH-003-ponctuation-insecable.txt` | ORCH | domain ux | 3 | Line Height; Line Length; Heading Line Balance |
| `R2-001-boutons-espace-mots.txt` | R2 | domain ux | 3 | Text Reflow and Spacing; Touch Spacing; Contrast Readability |
| `R2-002-barre-achat-carte.txt` | R2 | domain ux | 3 | Sticky Navigation; Fixed Positioning; Auto-Rotating Content Controls |
| `R2-003-billet-visuel-recadrage.txt` | R2 | domain ux | 3 | Image Optimization; Image Scaling; Asset Weight |
| `R2-004-scanner-message-court.txt` | R2 | domain ux | 3 | Streaming; Focusable Error Summary; Error Messages |
| `R2-005-cartes-etroites-mobile.txt` | R2 | domain ux | 3 | Dragging Movements; Text Reflow and Spacing; Long Token Wrapping |
| `R2-006-onglets-debordement.txt` | R2 | domain ux | 3 | Horizontal Scroll; Long Token Wrapping; Table Handling |
| `R2-007-champ-date-locale.txt` | R2 | domain ux | 3 | Date Formatting; Input Types; Input Labels |
| `R2-008-libelles-jargon.txt` | R2 | domain ux | 3 | Form Labels; Error Messages; Chip Collection Reflow |

2 appels n’ont rien renvoyé : `E1-003-scan-chiffres-tabulaires.txt`, `E2-006-barre-achat-nextjs.txt`.

### Extrait brut, une trace par agent (en-tête et premier résultat)

```text
# docs/lot8-logs/ui-ux-pro-max/E0-001-canaux-formulaire.txt (lignes 1 à 21, lignes vides retirées)
# Trace d'invocation du skill ui-ux-pro-max (lot 8)
# agent    : E0
# sujet    : canaux-formulaire
# date UTC : 2026-11-06T21:19:29Z
# commande : python ~/.claude/skills/ui-ux-pro-max/scripts/search.py checkbox\ help\ text\ form\ label\ aria-describedby\ summary --domain ux
# ---------------------------------------------------------------- sortie brute
## UI Pro Max Search Results
**Domain:** ux | **Query:** checkbox help text form label aria-describedby summary
**Source:** ux-guidelines.csv | **Found:** 3 results
### Result 1
- **Category:** Forms / Accessibility
- **Issue:** Focusable Error Summary
- **Platform:** Web
- **Description:** An error summary for failed validation complements inline field errors and must be easy to find by keyboard and screen reader users
- **Do:** Place it at the top of the form; move focus to its heading or container after failed submit; link each item to its invalid field; retain inline errors
- **Don't:** Replace inline errors with a visual-only summary or move focus on every blur
- **Code Example Good:** <div role="alert" tabindex="-1" aria-labelledby="error-title"><h2 id="error-title">There is a problem</h2><a href="#email">Enter an email address</a></div>
- **Code Example Bad:** Toast only with no field links or focus target
- **Severity:** High
```

```text
# docs/lot8-logs/ui-ux-pro-max/E1-001-scan-non-traite.txt (lignes 1 à 21, lignes vides retirées)
# Trace d'invocation du skill ui-ux-pro-max (lot 8)
# agent    : E1
# sujet    : scan-non-traite
# date UTC : 2026-11-06T21:17:53Z
# commande : python ~/.claude/skills/ui-ux-pro-max/scripts/search.py error\ message\ recovery\ retry\ clear\ next\ action\ status\ feedback\ toast\ duration\ auto\ dismiss --domain ux
# ---------------------------------------------------------------- sortie brute
## UI Pro Max Search Results
**Domain:** ux | **Query:** error message recovery retry clear next action status feedback toast duration auto dismiss
**Source:** ux-guidelines.csv | **Found:** 3 results
### Result 1
- **Category:** Feedback
- **Issue:** Error Recovery
- **Platform:** All
- **Description:** Help users recover from errors
- **Do:** Provide clear next steps
- **Don't:** Error without recovery path
- **Code Example Good:** Try again button + help link
- **Code Example Bad:** Error message only
- **Severity:** Medium
```

```text
# docs/lot8-logs/ui-ux-pro-max/E2-001-police-tabulaire.txt (lignes 1 à 21, lignes vides retirées)
# Trace d'invocation du skill ui-ux-pro-max (lot 8)
# agent    : E2
# sujet    : police-tabulaire
# date UTC : 2026-11-06T21:25:16Z
# commande : python ~/.claude/skills/ui-ux-pro-max/scripts/search.py tabular\ numbers\ monospace\ font\ numeric\ alignment\ tables\ amounts --domain ux
# ---------------------------------------------------------------- sortie brute
## UI Pro Max Search Results
**Domain:** ux | **Query:** tabular numbers monospace font numeric alignment tables amounts
**Source:** ux-guidelines.csv | **Found:** 3 results
### Result 1
- **Category:** Responsive
- **Issue:** Table Handling
- **Platform:** Web
- **Description:** Tables can overflow on mobile
- **Do:** Use horizontal scroll or card layout
- **Don't:** Wide tables breaking layout
- **Code Example Good:** overflow-x-auto wrapper
- **Code Example Bad:** Table overflows viewport
- **Severity:** Medium
```

```text
# docs/lot8-logs/ui-ux-pro-max/E3-001-alertes-sms.txt (lignes 1 à 21, lignes vides retirées)
# Trace d'invocation du skill ui-ux-pro-max (lot 8)
# agent    : E3
# sujet    : alertes-sms
# date UTC : 2026-11-06T21:29:02Z
# commande : python ~/.claude/skills/ui-ux-pro-max/scripts/search.py realtime\ alert\ filter\ admin\ notification\ dashboard\ live\ update --domain ux
# ---------------------------------------------------------------- sortie brute
## UI Pro Max Search Results
**Domain:** ux | **Query:** realtime alert filter admin notification dashboard live update
**Source:** ux-guidelines.csv | **Found:** 3 results
### Result 1
- **Category:** Layout
- **Issue:** Content Jumping
- **Platform:** Web
- **Description:** Images badges validation text and skeleton replacements can shift nearby content when they update
- **Do:** Reserve appropriate space or keep async states in a stable content-driven container
- **Don't:** Insert compact text or media without a layout strategy
- **Code Example Good:** aspect-ratio for media; stable count slot for badges
- **Code Example Bad:** Badge insertion pushes toolbar actions
- **Severity:** High
```

```text
# docs/lot8-logs/ui-ux-pro-max/E4-001-accueil-acces.txt (lignes 1 à 21, lignes vides retirées)
# Trace d'invocation du skill ui-ux-pro-max (lot 8)
# agent    : E4
# sujet    : accueil-acces
# date UTC : 2026-11-06T21:38:11Z
# commande : python ~/.claude/skills/ui-ux-pro-max/scripts/search.py permission\ denied\ redirect\ notice\ banner\ role\ alert\ feedback\ message --domain ux
# ---------------------------------------------------------------- sortie brute
## UI Pro Max Search Results
**Domain:** ux | **Query:** permission denied redirect notice banner role alert feedback message
**Source:** ux-guidelines.csv | **Found:** 3 results
### Result 1
- **Category:** Accessibility
- **Issue:** Compact Control Semantics
- **Platform:** Web
- **Description:** Interactive chips need a native role accessible name state keyboard operation and visible focus
- **Do:** Prefer a button and expose pressed or selected state that matches the visible label
- **Don't:** Use a clickable div or reveal the only action on hover
- **Code Example Good:** <button aria-pressed='true'>Open now</button>
- **Code Example Bad:** <div class='selected' onclick='toggle()'>Open now</div>
- **Severity:** Critical
```

```text
# docs/lot8-logs/ui-ux-pro-max/E5-001-paiement-simule.txt (lignes 1 à 21, lignes vides retirées)
# Trace d'invocation du skill ui-ux-pro-max (lot 8)
# agent    : E5
# sujet    : paiement-simule
# date UTC : 2026-11-06T21:44:01Z
# commande : python ~/.claude/skills/ui-ux-pro-max/scripts/search.py mock\ payment\ confirm\ action\ list\ pending\ destructive\ feedback\ disabled\ loading --domain ux
# ---------------------------------------------------------------- sortie brute
## UI Pro Max Search Results
**Domain:** ux | **Query:** mock payment confirm action list pending destructive feedback disabled loading
**Source:** ux-guidelines.csv | **Found:** 3 results
### Result 1
- **Category:** Feedback
- **Issue:** Confirmation Messages
- **Platform:** All
- **Description:** Confirm successful actions
- **Do:** Brief success message
- **Don't:** Silent success
- **Code Example Good:** Saved successfully toast
- **Code Example Bad:** No confirmation
- **Severity:** Medium
```

```text
# docs/lot8-logs/ui-ux-pro-max/ORCH-001-modal-defilement-clavier.txt (lignes 1 à 21, lignes vides retirées)
# Trace d'invocation du skill ui-ux-pro-max (lot 8)
# agent    : ORCH
# sujet    : modal-defilement-clavier
# date UTC : 2026-11-06T22:49:39Z
# commande : python ~/.claude/skills/ui-ux-pro-max/scripts/search.py keyboard\ access\ scrollable\ region\ modal\ focus\ tabindex --domain ux
# ---------------------------------------------------------------- sortie brute
## UI Pro Max Search Results
**Domain:** ux | **Query:** keyboard access scrollable region modal focus tabindex
**Source:** ux-guidelines.csv | **Found:** 3 results
### Result 1
- **Category:** Interaction
- **Issue:** Focus States
- **Platform:** All
- **Description:** Keyboard focus, including controls inside a modal, needs a visible indicator
- **Do:** Use a visible focus ring on every interactive control, including modal controls
- **Don't:** Remove focus outline without replacement
- **Code Example Good:** focus:ring-2 focus:ring-blue-500
- **Code Example Bad:** outline-none without alternative
- **Severity:** High
```

```text
# docs/lot8-logs/ui-ux-pro-max/R2-001-boutons-espace-mots.txt (lignes 1 à 21, lignes vides retirées)
# Trace d'invocation du skill ui-ux-pro-max (lot 8)
# agent    : R2
# sujet    : boutons-espace-mots
# date UTC : 2026-11-06T23:50:42Z
# commande : python ~/.claude/skills/ui-ux-pro-max/scripts/search.py button\ label\ word\ spacing\ letter\ spacing\ readability\ small\ text --domain ux
# ---------------------------------------------------------------- sortie brute
## UI Pro Max Search Results
**Domain:** ux | **Query:** button label word spacing letter spacing readability small text
**Source:** ux-guidelines.csv | **Found:** 3 results
### Result 1
- **Category:** Accessibility
- **Issue:** Text Reflow and Spacing
- **Platform:** Web
- **Description:** Text must remain available at narrow widths zoom and user spacing overrides
- **Do:** Use fluid sizes content-driven height and unitless line height
- **Don't:** Clip text in fixed-width or fixed-height boxes
- **Code Example Good:** .copy { inline-size: min(100%, 65ch); height: auto; line-height: 1.5; }
- **Code Example Bad:** .copy { width: 900px; height: 40px; overflow: hidden; }
- **Severity:** Critical
```

### Ce qui a été appliqué, par agent

Ce que chaque agent dit avoir décidé à partir de ses traces (`lot8-ecrans-results.md`, `lot8-relecture-results.md`, messages de commit). Ces lignes sont leurs déclarations ; je n’ai pas vérifié dans le code que chaque règle citée a produit le changement annoncé.

**E0** (canaux, remboursement d’un billet, 5 traces) :
- `E0-001` : erreurs et aides gardées près de leur champ, reliées par `aria-describedby` ;
- `E0-002` : formulaire resté client, Server Actions écartées (les routes API sont le contrat) ;
- `E0-003` : confirmation avant l’action irréversible, message de succès explicite, relance dans le dialogue ;
- `E0-004` : erreurs traitées dans le composant (`error.tsx` ne couvre pas un gestionnaire) ;
- `E0-005` : canal toujours écrit en texte, jamais par la couleur seule.

**E1** (scanner, 4 traces) :
- `E1-001` : « Error Recovery », d’où « Touchez l’écran pour reprendre le scan » ; « Toast Notifications » (3 à 5 s pour le non critique), d’où l’attente d’un toucher pour un scan repris ;
- `E1-002` : aucune règle n’a fait changer le code ;
- `E1-003` : 0 résultat ; `E1-004` : aucune contrainte nouvelle. **Écart déclaré** : E1-003 et E1-004 ont été lancées après l’écriture des `tabular-nums`, pas avant.

**E2** (police, rapport de clôture, barre d’achat, journal d’audit, 9 traces) :
- `E2-001` : `formatFcfa` et `formatInteger` gardés, `tabular-nums` ajouté ; le skill n’a aucune entrée sur `tabular-nums`, la règle vient du contrat ;
- `E2-002` : `next/font` en police variable, aucune police à chasse fixe embarquée ;
- `E2-003` : tableau en cartes sur mobile (`DataList`), `ErrorState` en `role="alert"`, grille de KPI mobile d’abord ;
- `E2-005` : contextes d’empilement, `isolation: isolate` sans z-index arbitraire ;
- `E2-006` : 0 résultat ; `E2-009`, relance, lancée après l’écriture du CSS, sans objet : la décision vient du contrat 11.3 ;
- `E2-007`, `E2-008` : règle « la dernière requête gagne » des filtres, état local conservé.

**E3** (administration, 8 traces) :
- `E3-001` : mise à jour discrète, sans nouvelle région annoncée ;
- `E3-003` : bandeau titré, icône et texte, la couleur ne porte pas seule l’information ;
- `E3-005` : bouton retiré, pas grisé ;
- `E3-006` : confirmation avant la relance, chemin de reprise, message après chaque issue ;
- `E3-007` : cartes sous `md` par `DataList`, région défilable pour le tableau des paiements, 44 px ;
- `E3-002`, `E3-004`, `E3-008` : composants clients conservés, recommandations Server Actions écartées.

**E4** (accueil, connexion, inscription, 7 traces) :
- `E4-001` : résultats hors sujet, requête refaite en `E4-007` (« Error Messages » : `role=alert`) ;
- `E4-002` : `AccessNotice` reste une feuille cliente sous `Suspense` ;
- `E4-003` : chaque message fixe dit quoi faire ;
- `E4-004` : `reset` gardé dans `global-error` ;
- `E4-005` : libellé visible gardé ; `E4-006` : sans objet.

**E5** (page de développement, 3 traces) :
- `E5-001` : succès jamais silencieux, bandeau de résultat annoncé ;
- `E5-002` : chargement puis succès ou erreur, `aria-busy`, région `role="status"` toujours présente ;
- `E5-003` : Server Actions pour la mutation, entrée validée et autorisée dans l’action.

**R2** (corrections de la relecture, 8 traces) :
- `R2-002` : zone sûre et autres éléments fixes, d’où 53 px plus `env(safe-area-inset-bottom)` pour la barre d’achat ;
- `R2-005`, `R2-006` : retour à la ligne plutôt que troncature, indice de débordement sur les onglets ;
- `R2-007` : éviter les formats ambigus, d’où la mesure locale du champ de date ;
- `R2-001`, `R2-003`, `R2-004`, `R2-008` : « rien d’utilisable pour ces défauts ».

**ORCH** (orchestrateur, 3 traces) :
- `ORCH-001` (`a7b4539`) : le focus doit rester visible, d’où l’anneau en retrait dans la zone défilante du rapport de clôture ;
- `ORCH-002` (`e96dab4`) : carte « Montant net organisateur » sans « commissions déduites » ; les trois résultats (débordement et sémantique des libellés courts, libellés de champs) ne portent pas sur l’exactitude d’un libellé : la correction vient du contrat 10.4 ;
- `ORCH-003` (`bc864fa`) : aucun des trois résultats (hauteur de ligne, longueur de ligne, équilibre des titres) ne parle de l’espace insécable ; la décision vient de la typographie française, pas du skill.

Bilan : sur les 47 appels, beaucoup de résultats sont génériques ou hors sujet, et plusieurs décisions viennent du contrat ou du cahier des charges plutôt que du skill ; plusieurs agents le disent eux-mêmes (E1, E2, E4, R2, ORCH-003). Le skill a surtout servi de liste de vérification (accessibilité, états d’erreur, retours après action).

---

## 16. Variables d'environnement et réglages SUPERADMIN

Référence : `lib/env.ts` et `.env.example` à `bc864fa`, contrat section 19, `docs/essai-local.md` section 4. Aucune valeur réelle n'est écrite ici.

### 16.1 Variables d'environnement

**Aucune variable nouvelle en production.** Les variables ajoutées par le lot ne servent qu'au mode d'essai sur le PC de l'utilisateur (8.1).

| Variable | Rôle | Lue par | Défaut |
|---|---|---|---|
| `EV_INTEGRATIONS` | `fake` : faux SMS et faux SamirPay. **Désormais refusée hors développement et test** (avant le lot : refusée en production seulement). Le contrôle lit `process.env.NODE_ENV` littéral, figé au build | `lib/env.ts` | `real` |
| `EV_DEV_FAKE_SERVICES_URL` | URL du faux SamirPay local, obligatoire en `fake`, boucle locale seulement | `lib/env.ts`, `lib/integrations/dev-adapters.ts` | aucun |
| `EV_DEV_FAKE_PORT` | port du faux SamirPay | `scripts/dev/fake-samirpay.mjs`, `essai-start.mjs`, pages et route `.dev` | 4010 |
| `EV_DEV_APP_PORT` | port de l'application locale | `scripts/dev/cron-local.mjs`, `essai-start.mjs`, `fake-samirpay.mjs`, `app/dev/paiements/[id]/page.dev.tsx` | 3000 |
| `EV_DEV_PROJECT_REF` | référence de projet exigée par `seed:dev`, comparée à l'URL | `scripts/dev/seed-dev.ts`, `seed-dev.core.ts` | aucun |
| `EV_DEV_SEED_PASSWORD` | mot de passe des comptes de démonstration | idem | aucun |
| `EV_DEV_TUNNEL_URL` | origine du tunnel déclaré (`https://*.trycloudflare.com`) | `scripts/dev/cron-local.core.mjs` | aucun |
| `EV_ESSAI_SIMULATION` | posée par `essai:start` seulement, jamais à la main ; sans effet si `SAMIRPAY_API_URL` n'est pas locale | `lib/env.ts`, `lib/integrations/simulation.ts`, `scripts/dev/essai-start.mjs` | absente |

**Documentées dans `.env.example` sans être nouvelles** (déjà dans `lib/env.ts` au lot 7) : `MTARGET_SERVICE_ID`, `MTARGET_API_URL`, `PAYMENT_RECONCILE_BATCH`, `STATUS_POLL_RECONCILE_SECONDS`, `NEXT_PUBLIC_MAP_TILE_URL`, `NEXT_PUBLIC_MAP_TILE_ATTRIBUTION`.

**En e2e seulement**, `.env.e2e` relève trois quotas par adresse IP, toute la CI venant de 127.0.0.1 (contrat 15.1, précédent D37) : `SMS_OTP_PER_IP_HOUR=1000`, `SMS_OTP_PER_IP_DAY=1000`, `PARTNER_REGISTER_PER_IP_HOUR=100`. Ce fichier n'est jamais utilisé en production.

**Outils de test, antérieurs au lot** (présents à `7fdcb32`) : `EV_ENV_FILE`, `EV_E2E_ENV_FILE`, `EV_TEST_GUARD`. `EV_DEV_ADAPTERS_SENTINEL_LOT8` n'est pas une variable : c'est la chaîne sentinelle cherchée dans `.next` (L29).

**À l'essai au téléphone**, `NEXT_PUBLIC_APP_URL` prend l'adresse du tunnel, avec redémarrage ; `CRON_SECRET` est lu par `cron:local`, qui appelle toujours `localhost` (L21).

Diff de `lib/env.ts` et de `.env.example` sur le lot (lignes ajoutées et retirées) :

```text
$ git diff 7fdcb32..HEAD -- lib/env.ts | grep '^[-+]'
-    // Intégrations : "real" (défaut) ou "fake" (tests uniquement)
+    // Intégrations : "real" (défaut) ou "fake" (tests, et mode d'essai en développement ; refusé ailleurs, voir getServerEnv)
+    // Lot 8 (8.1), mode d'essai seulement ; aucune de ces variables n'existe en production.
+    // URL du faux SamirPay local, exigée et contrôlée par lib/integrations/dev-adapters.ts
+    EV_DEV_FAKE_SERVICES_URL: optionalString,
+    // Posée par scripts/dev/essai-start.mjs seulement, sans effet si SAMIRPAY_API_URL n'est pas locale
+    EV_ESSAI_SIMULATION: optionalString,
-    if (parsed.data.EV_INTEGRATIONS === 'fake' && parsed.data.NODE_ENV === 'production') {
-        throw new ServerEnvError(['EV_INTEGRATIONS=fake est interdit en production']);
+    // Lot 8 (8.1) : `process.env.NODE_ENV` littéral, figé au build, et non parsed.data : `NODE_ENV=development
+    // next start` passerait, et le défaut « development » du schéma autoriserait le mode si la variable manquait.
+    if (parsed.data.EV_INTEGRATIONS === 'fake' && process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test') {
+        throw new ServerEnvError(['EV_INTEGRATIONS=fake est interdit hors développement et test']);

$ git diff 7fdcb32..HEAD -- .env.example | grep '^[-+]'
+# Service et adresse de l'API MTarget : à ne renseigner que sur instruction du fournisseur
+# MTARGET_SERVICE_ID=
+# MTARGET_API_URL=
+# PAYMENT_RECONCILE_BATCH=50
+# STATUS_POLL_RECONCILE_SECONDS=5
+
+# Cartes : fournisseur de tuiles (OpenStreetMap par défaut)
+# NEXT_PUBLIC_MAP_TILE_URL=
+# NEXT_PUBLIC_MAP_TILE_ATTRIBUTION=
+
+# ============================================================================
+# MODE D'ESSAI LOCAL (lot 8) : à recopier dans .env.local, jamais en production
+# ============================================================================
+# Guide : docs/essai-local.md. Aucune valeur réelle ici ; ni $ ni # dans les valeurs de .env.local.
+# ATTENTION : sans EV_INTEGRATIONS=fake, npm run dev et npm run cron:local envoient de vrais SMS et
+# appellent le vrai SamirPay. Cette valeur est refusée hors développement et test (défaut : real).
+# EV_INTEGRATIONS=fake
+# Faux SamirPay local (npm run fake:samirpay), obligatoire avec EV_INTEGRATIONS=fake, boucle locale seulement
+# EV_DEV_FAKE_SERVICES_URL=http://127.0.0.1:4010/samirpay
+# Ports du faux SamirPay et de l'application locale (valeurs par défaut)
+# EV_DEV_FAKE_PORT=4010
+# EV_DEV_APP_PORT=3000
+# Référence du projet d'essai, exigée par npm run seed:dev : https://<référence>.supabase.co
+# EV_DEV_PROJECT_REF=
+# Mot de passe des comptes de seed:dev : 14 caractères, minuscule, majuscule, chiffre, signe
+# EV_DEV_SEED_PASSWORD=
+# Adresse du tunnel (https://<nom>.trycloudflare.com), égale à NEXT_PUBLIC_APP_URL pendant les essais au téléphone
+# EV_DEV_TUNNEL_URL=
+# EV_ESSAI_SIMULATION : posée par npm run essai:start seulement, ne jamais l'écrire ici ni dans .env.local
```

Lectures directes de `process.env` dans le code de l'application et les scripts du mode d'essai (`app`, `lib`, `components`, `hooks`, `middleware.ts`, `instrumentation.ts`, `next.config.*`, `scripts/dev`, `scripts/*.mjs`) ; le reste passe par `getServerEnv()` ou par `loadLocalEnv` des scripts :

```text
$ grep -rhoE "process\.env\.[A-Z_][A-Z0-9_]*|process\.env\[['\"][A-Z_][A-Z0-9_]*" app lib components hooks middleware.ts instrumentation.ts next.config.* scripts/dev scripts/*.mjs | sed … | sort | uniq -c
      1 CRON_SECRET
      1 EV_DEV_APP_PORT
      3 EV_DEV_FAKE_PORT
      1 EV_DEV_FAKE_SERVICES_URL
      2 EV_ENV_FILE
      5 EV_INTEGRATIONS
      1 MTARGET_API_URL
      1 MTARGET_PASSWORD
      1 MTARGET_SENDER
      1 MTARGET_SERVICE_ID
      1 MTARGET_TIMEOUT_MS
      1 MTARGET_USERNAME
      2 NEXT_PUBLIC_APP_URL
      2 NEXT_PUBLIC_MAP_TILE_ATTRIBUTION
      2 NEXT_PUBLIC_MAP_TILE_URL
      5 NEXT_PUBLIC_SUPABASE_ANON_KEY
     10 NEXT_PUBLIC_SUPABASE_URL
      1 NEXT_RUNTIME
      1 NEXT_TELEMETRY_DISABLED
     19 NODE_ENV
      1 NOTIFICATION_FROM_EMAIL
      1 PUSH_ENDPOINT_ALLOWED_ORIGINS
      1 PUSH_TIMEOUT_MS
      2 RESEND_API_KEY
      1 SUPABASE_AUTH_HOOK_SECRET
      1 VAPID_PRIVATE_KEY
      1 VAPID_PUBLIC_KEY
      1 VAPID_SUBJECT
```

Aucune de ces lectures n'introduit de variable absente de `lib/env.ts` ou du tableau ci-dessous, sauf trois qui ne sont pas des réglages de l'application : `NEXT_RUNTIME` (posée par Next.js, lue par `instrumentation.ts:8`), `NEXT_TELEMETRY_DISABLED` (écrite par `scripts/verify.mjs:49`) et `EV_ENV_FILE` (lanceurs de tests, `scripts/run-tests.mjs:146`, `scripts/verify.mjs:20`).

**Tableau complet après le lot 8** (lot 7, section 11.1 de `docs/lot7-rapport.md`, plus la ligne du lot 8) :

| Catégorie | Variables |
|---|---|
| **Obligatoires** (le serveur refuse de démarrer sans elles) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL` (HTTPS définitive), `SAMIRPAY_API_URL`, `SAMIRPAY_API_KEY`, `SAMIRPAY_SECRET_KEY`, `MTARGET_USERNAME`, `MTARGET_PASSWORD`, `OTP_HASH_SECRET`, `TICKET_TOTP_MASTER_KEY`, `REGISSEUR_PIN_KEY` (trois secrets différents entre eux et de toute autre clé) |
| **Obligatoire en exploitation** | `CRON_SECRET` : sans elle, toutes les routes `/api/cron/*` répondent 503. Sa valeur est recopiée dans le secret Vault `ev_cron_secret` |
| **Facultatives du lot 6** | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (les trois ou aucune) ; `MTARGET_TIMEOUT_MS` (15 000) ; `PUSH_TIMEOUT_MS` (10 000) ; `PUSH_SUBSCRIBE_PER_USER_HOUR` (20) ; `PUSH_TEST_PER_USER_HOUR` (5) ; `PUSH_ENDPOINT_ALLOWED_ORIGINS` (à ne pas renseigner en production) |
| **Facultatives du lot 7** | `OFFLINE_CODES_PER_TICKET_HOUR` (12), `OFFLINE_CODES_PER_USER_HOUR` (60), `SCAN_LOOKUP_PER_SCANNER_MIN` (20) |
| **Intégrations** | `MTARGET_API_URL`, `MTARGET_SERVICE_ID`, `MTARGET_SENDER`, `SAMIRPAY_TIMEOUT_MS` (15 000), `RESEND_API_KEY`, `NOTIFICATION_FROM_EMAIL`, `SUPPORT_EMAIL`, `SUPABASE_AUTH_HOOK_SECRET` |
| **Quotas SMS** | `SMS_OTP_PER_PHONE_15MIN` (3), `SMS_OTP_PER_PHONE_DAY` (10), `SMS_OTP_PER_IP_HOUR` (10), `SMS_OTP_PER_IP_DAY` (30), `SMS_PER_PHONE_DAY` (30), `SMS_GLOBAL_DAILY_CAP` (1 000), `SMS_PER_ACCOUNT_DAY` (30), `SMS_GLOBAL_OTP_RESERVED_PERCENT` (30) |
| **Paiement** | `PAYMENT_HOLD_MINUTES` (15), `CHECKOUT_PER_USER_15MIN` (10), `CHECKOUT_PER_USER_DAY` (50), `CLAIM_FREE_PER_USER_HOUR` (20), `STATUS_POLL_RECONCILE_SECONDS` (5), `PAYMENT_RECONCILE_MIN_AGE_MINUTES` (2), `PAYMENT_PENDING_MAX_AGE_MINUTES` (60), `PAYMENT_LATE_SUCCESS_WINDOW_HOURS` (48), `PAYMENT_RECONCILE_BATCH` (50) |
| **Quotas du lot 4** | `SCAN_PER_SCANNER_10S` (30), `CASH_COLLECT_PER_SCANNER_MIN` (20), `LIVE_CODE_PER_USER_MIN` (60), `RESOLVE_PHONE_PER_IP_HOUR` (30), `VERIFY_OTP_PER_PHONE_15MIN` (10), `CONTROLLER_SETUP_PER_PHONE_HOUR` (10), `PARTNER_REGISTER_PER_IP_HOUR` (10), `INVITE_PER_PARTNER_HOUR` (20), `INVITE_PER_PHONE_DAY` (3), `REGISSEUR_PIN_PER_SHIFT_15MIN` (5) |
| **Quotas du lot 5** | `WITHDRAWAL_REQUEST_PER_USER_HOUR` (10), `COUNTER_RECEIPT_PER_SHIFT_DAY` (500), `SCAN_INCIDENT_REPORT_PER_SCANNER_MIN` (10), `SCAN_INCIDENT_LOG_PER_SCANNER_MIN` (60) |
| **Autres** | `DOCUMENT_UPLOADS_PER_IP_HOUR` (20), `CLIENT_IP_SOURCE` (`x-forwarded-for`), `NEXT_PUBLIC_MAP_TILE_URL`, `NEXT_PUBLIC_MAP_TILE_ATTRIBUTION`, `SUPERADMIN_PHONE` (déclarée, lue nulle part), `NODE_ENV` ; `EV_INTEGRATIONS` : **ne pas définir en production** (refusée hors développement et test) |
| **Mode d'essai (lot 8), jamais en production** | `EV_DEV_FAKE_SERVICES_URL`, `EV_DEV_FAKE_PORT` (4010), `EV_DEV_APP_PORT` (3000), `EV_DEV_PROJECT_REF`, `EV_DEV_SEED_PASSWORD`, `EV_DEV_TUNNEL_URL`, `EV_ESSAI_SIMULATION` (posée par `essai:start` seulement) |

Les clés du schéma de `lib/env.ts` à `bc864fa` ont été relues : ce sont exactement celles du tableau, plus `EV_DEV_FAKE_SERVICES_URL` et `EV_ESSAI_SIMULATION` ajoutées par le lot. Les autres `EV_DEV_*` ne sont pas dans le schéma : seuls les scripts du mode d'essai et les fichiers `.dev` les lisent.

### 16.2 Réglages SUPERADMIN

**Aucun réglage nouveau au lot 8** (L83). Preuve : les six migrations du lot ne nomment ni `platform_settings`, ni `fin_setting_valid`, ni `finance_setting_set` ; les migrations `20261105…`, où le lot 7 a fixé les bornes, sont gelées par SHA-256 et `migration-lot7-rejouable` est vert au run 107.

```text
$ git grep -nE 'platform_settings|fin_setting_valid|finance_setting_set' HEAD -- 'supabase/migrations/20261106*'; echo "code $?"

code 1

tests/schema/migration-lot7-rejouable.test.ts          PASS     1.2s      0     .test-logs/tests__schema__migration-lot7-rejouable.test.ts.log
```

Le tableau reste donc celui de la fin du lot 7 : 28 clés modifiables par `finance_setting_set` (SUPERADMIN actif, motif obligatoire, historique), bornes dans `fin_setting_valid` de la migration `20261105000001`. Je ne l'ai pas relu contre une base : il est recopié de `docs/lot7-rapport.md`, section 11.2, et rien dans le lot ne l'a touché.

| Clé | Défaut | Valeurs admises | Lot |
|---|---|---|---|
| `finance.service_fee_rate` | 5 (repris de `ticketing_fee_config`) | 0 à 50 (%) | 3 |
| `finance.aggregator_fee_rate.WAVE` | 1,5 | 0 à 10 (%) | 3 |
| `finance.aggregator_fee_rate.ORANGE_MONEY` | 1,5 | 0 à 10 (%) | 3 |
| `finance.cancellation_aggregator_fee_bearer` | `EVENT_VILLAGE` | `EVENT_VILLAGE`, `ORGANISATEUR` | 3 |
| `finance.payout_hold_enabled` | true | booléen | 3 |
| `finance.payout_delay_hours` | 48 | entier de 0 à 720 | 3 |
| `finance.withdrawal_fee_rate` | 1 | 0 à 10 (%) | 3 |
| `finance.withdrawal_min_amount` | 5 000 | entier de 0 à 10 000 000 (F CFA) | 3 |
| `finance.withdrawal_bank_enabled` | false | booléen | 3 |
| `finance.referral_availability_days` | 7 | entier de 7 à 14 | 3 |
| `access.manual_entry_scope` | `ASSIGNED_CONTROLLER` | `ASSIGNED_CONTROLLER`, `STAFF` | 4 |
| `access.scan_window_before_hours` | 6 | entier de 0 à 48 | 4 |
| `access.scan_window_after_hours` | 6 | entier de 0 à 48 | 4 |
| `access.counter_sale_enabled` | true | booléen | 4 |
| `access.low_stock_threshold` | 10 | entier de 1 à 1 000 | 5 |
| `notif.reminder_j1_enabled` | true | booléen | 6 |
| `notif.reminder_j1_hour` | 10 | entier de 6 à 20 (heure de Dakar) | 6 |
| `notif.reminder_h3_enabled` | true | booléen | 6 |
| `notif.reminder_h3_hours` | 3 | entier de 1 à 12 | 6 |
| `notif.j1_sms` | `ALWAYS` | `ALWAYS`, `IF_NO_PUSH`, `NEVER` | 6 |
| `notif.h3_sms` | `IF_NO_PUSH` | idem | 6 |
| `notif.sms_quiet_start` | 22 | entier de 0 à 23 | 6 |
| `notif.sms_quiet_end` | 8 | entier de 0 à 23 | 6 |
| `notif.sms_optional_daily_cap` | 700 | entier de 0 à 1 000 000 ; 0 : aucun SMS optionnel | 7 |
| `notif.free_ticket_reminder_sms` | `NEVER` | `NEVER`, `SAME_AS_PAID` | 7 |
| `features.halls_enabled` | false | booléen ; un ADMIN ne peut pas l'écrire | 7 |
| `features.tables_enabled` | false | idem | 7 |
| `features.orders_enabled` | false | idem ; `/orders` en 404 seulement si les trois sont fermés | 7 |

**Budget optionnel et plafond global, rappel** (détail : `docs/lot7-rapport.md`, section 11.3, et `docs/deploiement-projet-neuf.md`, section 5.5). `notif.sms_optional_daily_cap` (700 par jour de Dakar, réglage SUPERADMIN sans redéploiement) est un **budget** : il ne limite que les SMS optionnels (rappels J-1 et H-3, rappel des contrôleurs, changement de date ou de lieu, etc.), au-delà `SKIPPED SMS_OPTIONAL_CAP`. `SMS_GLOBAL_DAILY_CAP` (1 000 par jour, variable d'environnement, avec redéploiement) est une **protection anti-abus** : OTP jusqu'au plafond entier, le reste jusqu'à la part non OTP. Ni l'un ni l'autre ne limite les SMS indispensables, comme la confirmation d'achat. Le guide d'essai le dit, pour qu'un plafond bas posé par l'utilisateur ne soit pas pris pour un plafond total.

---

---

## 17. Comment tester

Tout est dans **`docs/essai-local.md`**, écrit pour Windows, 8 Go, sans Docker, contre le projet **event-village-dev**. Il se suit dans l'ordre ; il compte une heure pour la première installation.

**À lire avant tout** : sans la ligne `EV_INTEGRATIONS=fake` dans `.env.local`, `npm run dev` et `npm run cron:local` envoient de vrais SMS, facturés, et parlent au vrai SamirPay. Le guide fait vérifier une bannière avant chaque séance (section 6).

Ce que le guide couvre, par section :

- 2. Pré-requis : Node 22, `npm ci` (jamais `npm install` : npm 11 réécrit le lock), Supabase CLI par `npx supabase@2.122.0`, `cloudflared` pour le téléphone.
- 3. Migrations sur event-village-dev : `supabase db push --dry-run` doit lister exactement les six migrations `20261106…` manquantes, sinon arrêt, sans `--include-all` ni `repair`. Une requête de contrôle des catégories est placée **avant** `db push` (écart à l'ordre du contrat 5.6, décision de D1).
- 4. `.env.local` : variables de base et du mode d'essai, sans aucune valeur réelle ; quotas relevés pour une séance de test, à retirer avant tout essai en réel.
- 5. Simulé ou réel : ce que protège le marquage `simulated` (L28), comment repasser en réel (file vidée, trois requêtes de contrôle à 0).
- 6. Mode A : `npm run fake:samirpay`, `npm run dev`, `npm run cron:local` (sous PowerShell 5.1, `node scripts/dev/cron-local.mjs --once <tâche>`, car `npm.ps1` perd le `--`).
- 7. Comptes de test : `npm run seed:dev` (référence de projet et confirmation tapée exigées ; ne supprime rien, rejouable, refus au-delà de 25 comptes réels).
- 8. Parcours complet : création, validation et publication, achat payant validé et refusé (page `/dev/paiements`), billet gratuit, code SMS lu dans la console, rappels, scan, guichet, annulation, remboursement.
- 9 à 11. Téléphone par Cloudflare Tunnel (caméra, webhook), changement d'adresse du tunnel, mode B (`npm run essai:build` puis `npm run essai:start`) pour l'installation et le billet hors ligne.
- 12. Dépannage et arrêt.

**Cahier de recette manuelle** : `docs/recette-billetterie.md`, section 7, 61 essais numérotés pour un non-développeur (étapes, résultat attendu, case OK ou anomalie), environ 2 h 30. Il renvoie au guide pour le lancement.

**Ce qui est prouvé et ce qui ne l'est pas.** Les refus du mode d'essai sont prouvés en CI : `essai-integrations`, `essai-cron-local`, `essai-env-local`, `essai-seed-gardes`, `essai-faux-samirpay`, `essai-middleware`, `essai-seed-dev`, `essai-simule` sont PASS au run 107, et la phase e2e `fake-prod` (vrai build, `EV_INTEGRATIONS=fake` refusé) est OK. **Le guide lui-même n'a été déroulé par personne contre event-village-dev** : la règle du lot interdit toute exécution des agents contre un projet distant, et le poste n'a pas de base locale. Seuls des essais isolés ont tourné sur le poste (la perte du `--` par `npm.ps1`, la lecture de `.env.local` par `@next/env` sur un fichier fabriqué). Le 502 du tunnel sous Windows et le rechargement à chaud de `next dev` par le tunnel restent SUPPOSÉS (section 19).

```text
# run 107 (bc864fa), récapitulatif, suites du mode d'essai
tests/schema/essai-integrations.test.ts                PASS     5.6s      0     .test-logs/tests__schema__essai-integrations.test.ts.log
tests/schema/essai-cron-local.test.ts                  PASS     948ms     0     .test-logs/tests__schema__essai-cron-local.test.ts.log
tests/schema/essai-env-local.test.ts                   PASS     732ms     0     .test-logs/tests__schema__essai-env-local.test.ts.log
tests/schema/essai-seed-gardes.test.ts                 PASS     761ms     0     .test-logs/tests__schema__essai-seed-gardes.test.ts.log
tests/schema/essai-faux-samirpay.test.ts               PASS     1.6s      0     .test-logs/tests__schema__essai-faux-samirpay.test.ts.log
tests/parcours/essai-middleware.test.ts                PASS     628ms     0     .test-logs/tests__parcours__essai-middleware.test.ts.log
tests/parcours/essai-seed-dev.test.ts                  PASS     1.9s      0     .test-logs/tests__parcours__essai-seed-dev.test.ts.log
tests/parcours/essai-simule.test.ts                    PASS     6.7s      0     .test-logs/tests__parcours__essai-simule.test.ts.log
# run 107, e2e, lignes « fake-prod »
═══════════════ e2e › fake-prod : node scripts/e2e/fake-prod.mjs ═══════════════
[FAKE-PROD] ═══ production : next start -p 3199, EV_INTEGRATIONS=fake ═══
[FAKE-PROD] production : OK GET /login répond (témoin) HTTP 200
[FAKE-PROD] production : OK POST /api/auth/register/start, numéro neuf, refusé HTTP 500 {"error":"Inscription momentanément impossible. Réessayez dans un instant.","code":"REGISTER_START_FAILED"}
[FAKE-PROD] production : OK aucun SMS au faux MTarget 0 SMS
[FAKE-PROD] production : OK GET /dev/paiements HTTP 404 
[FAKE-PROD] production : OK POST /api/dev/samirpay/validate HTTP 404 
[FAKE-PROD] production : conforme
[FAKE-PROD] ═══ development : next start -p 3199, EV_INTEGRATIONS=fake ═══
[FAKE-PROD] development : OK GET /login répond (témoin) HTTP 200
[FAKE-PROD] development : OK POST /api/auth/register/start, numéro neuf, refusé HTTP 500 {"error":"Inscription momentanément impossible. Réessayez dans un instant.","code":"REGISTER_START_FAILED"}
[FAKE-PROD] development : OK aucun SMS au faux MTarget 0 SMS
[FAKE-PROD] development : OK GET /dev/paiements HTTP 404 
[FAKE-PROD] development : OK POST /api/dev/samirpay/validate HTTP 404 
[FAKE-PROD] development : conforme
[FAKE-PROD] résultat : OK, simulé impossible sur le build, dans les deux lancements
[e2e] phase fake-prod : OK en 1s
[e2e] durées : connexion 12s · captures 822s · emails 7s · dev-page 4s · fumee 39s · terrain 129s · pwa 4s · fake-prod 1s · perf 185s · recette 65s — total 1268s (21.1 min)
[e2e] résumé :connexion OK · captures OK · emails OK · dev-page OK · fumee OK · terrain OK · pwa OK · fake-prod OK · perf OK · recette OK
```

---

---

## 18. Décisions prises

La consigne demande, pour toute décision non tranchée et non bloquante, l'option la plus prudente, appliquée et listée ici. Aucune question n'a été bloquante (AR1). Les décisions L1 à L93 sont recopiées du contrat (`lot8-design.md`, section 1), une ligne chacune ; une note en italique dit ce que le lot a réellement fait quand cela diffère ou mérite d'être su. Dans ces lignes et en 18.3, « section x » renvoie au contrat, pas au présent rapport.

### 18.1 Décisions ★ (à lire par l'utilisateur)

- **L28** Marquage simulé en base : `payments.simulated` et `cashouts.simulated`, posés par trigger depuis l'en-tête `x-ev-simulation` du seul client service_role d'un serveur d'essai ; un cashout hérite de son paiement, et un retrait hérite de l'origine simulée du solde. Envoi refusé des deux côtés si la marque diffère du mode du serveur : dans le code (`CashoutService.send`) et en base (`trg_cashouts_simulation_guard`). Marque immuable.
- **L30** Même panier : mêmes catégories et mêmes quantités, même compte, même événement, X créé avant la confirmation de Y (`X.created_at < Y.paid_at`), sans borne de durée. Un rachat fait après confirmation n'est jamais touché. Paniers différents non traités (point ouvert).
- **L34** Ordre unique `events FOR NO KEY UPDATE → paiements → catégories → transferts → billets`, dans `payment_confirm` et `event_cancel`. Conséquence : deux confirmations du même événement se sérialisent (avant : par catégorie).
- **L36** Plafond des commissions : N1 = min(calcul, net), N2 = min(calcul, net − N1), et même budget au remboursement partiel. Extension de la consigne : c'est le seul dépassement réel avec la grille.

Exemple chiffré de L36 : section 7 du rapport.

### 18.2 Décisions du contrat, L1 à L93


*1.1 Cadre*

- **L1** Aucune question bloquante : chaque point ouvert a reçu l'option la plus prudente.
- **L2** Une seule définition finale par fonction SQL, dans un seul fichier de migration (section 2.2).
- **L3** Six migrations `20261106000001` à `…06`, listées exactement par `migration-lot8-rejouable`.
- **L4** Aucune signature de fonction existante ne change ; `replay_only` reste dans `p jsonb`.

*1.2 Canaux de vente (8.0)*

- **L5** `sale_online` est la source de vérité ; `is_visible` reste en miroir permanent, écrit par trigger ; tous les lecteurs passent à `sale_online`. Impossible à supprimer tant que les tests de rejeu du lot 7 recréent une politique sur cette colonne.
- **L6** Contrôle en ligne dans `ticket_sale_problems` ; `checkout_create_payment` et `free_tickets_claim` en héritent sous verrou sans recopie ; preuve par appel direct des RPC.
- **L7** Refus en ligne : `SALE_CHECK_FAILED` + problème `CATEGORY_NOT_SOLD_ONLINE` (contrat existant) ; refus au guichet : code de tête `CATEGORY_NOT_SOLD_AT_COUNTER`, HTTP 409, y compris au devis. Panier mixte refusé en entier.
- **L8** Paiement en cours quand un canal est coupé : le billet est émis, la décision est celle du checkout, le client a payé.
- **L9** Le canal `FREE` entre dans l'invariant (t) : `free_tickets_claim` est soumis à `sale_online`. Extension du texte de (t), signalée.
- **L10** Catégorie non vendue en ligne absente de la page publique, comme aujourd'hui ; le catalogue garde « Bientôt en vente » pour un événement sans catégorie en ligne (`cycle-visibilite.test.ts:255`).
- **L11** Invitations : rien à construire. Libellé « Invitations seulement », avec une aide qui dit que l'application n'envoie pas encore d'invitations. Écart avec la consigne signalé. *Libellé et aide livrés par E0 ; écart avec la consigne dit en AR8.*
- **L12** Instantané en deux étages, posé par triggers : `stock_reservations.sale_online_at_checkout`, puis `tickets.sale_decision` (jsonb immuable). Lignes anciennes en `REPRISE` sans réécriture ; défauts futurs fail-closed (`SANS_DECISION`, faux).
- **L13** `AdjustTicketQuotaModal` et `EventCancelModal` (code mort) conservés, listés. *`AdjustTicketQuotaModal` : classes corrigées par 8.2 q, toujours mort (section 19).*
- **L14** `sale_counter` lisible par GRANT, comme toute colonne de la table, mais non servi par l'API publique.
- **L15** Les helpers de test existants ne changent pas : `canaux-*` coupe un canal par `UPDATE` en service_role après la création.

*1.3 Mode d'essai (8.1)*

- **L16** Deux modes : A `npm run dev` + `EV_INTEGRATIONS=fake` ; B `next build` + `next start`, vrais adaptateurs vers le faux service local, pour le service worker et le hors ligne.
- **L17** `lib/integrations/dev-adapters.ts`, chargé dans une branche morte au build, avec sentinelle contrôlée.
- **L18** Faux SamirPay en processus séparé, écoute 127.0.0.1 seulement, état sur disque (`.logs/fake-samirpay.json`).
- **L19** Aucune vraie clé SamirPay envoyée en mode simulé.
- **L20** Page de développement à trois verrous : `pageExtensions` par phase, middleware, serveur.
- **L21** `cron:local` lit `supabase/ops/schedule-crons.sql` (source unique) et appelle toujours `localhost` : `CRON_SECRET` ne traverse jamais le tunnel.
- **L22** `.env.local` lu par `@next/env` : mêmes valeurs que Next. `NODE_ENV=test` refusé (Next y saute `.env.local` sans rien dire).
- **L23** `seed:dev` exige `EV_INTEGRATIONS=fake`, ne vend rien, n'utilise jamais `TEST_PASSWORD`, mot de passe par `EV_DEV_SEED_PASSWORD`, ne réécrit jamais un compte existant, ne supprime jamais rien.
- **L24** Seuil N = 25 comptes réels, constante documentée, sans dérogation par variable.
- **L25** Tunnel limité à `https://*.trycloudflare.com`, égalité stricte d'origine avec `EV_DEV_TUNNEL_URL`.
- **L26** `app/api/partner/team/invite/route.ts:403` passe par `getServerEnv()` : seul correctif de production hors outillage.
- **L27** `tests/helpers/env.ts`, `scripts/e2e/env.mjs`, `tests/fakes/*`, `supabase/ops/*` inchangés.
- **L28** ★ voir 18.1.
- **L29** Refus de `fake` hors développement prouvé contre le vrai build : sentinelle absente de `.next` et phase e2e `fake-prod` (`next start` avec `EV_INTEGRATIONS=fake`, `NODE_ENV` production puis development).

*1.4 Paiement et finance (8.2 a à d)*

- **L30** ★ voir 18.1.
- **L31** Le paiement remboursé est le second confirmé chez nous, quel que soit l'ordre de création ; frais d'agrégateur à la charge d'Event Village (`kind='REFUND'`).
- **L32** Alerte : type `ADMIN_DUPLICATE_PAYMENT` en boîte d'envoi, aucun nouveau `kind` dans `admin_signals`.
- **L33** Reprise automatique par `payments-reconcile` des cashouts `kind='REFUND'`, `A_ENVOYER`, non bloqués, non réservés, créés depuis plus de 5 min : ferme le trou `SOLDE_UNAVAILABLE`.
- **L34** ★ voir 18.1.
- **L35** Fonctions de la famille non corrigées : points ouverts avec raison (section 2.3), jamais de repli silencieux.
- **L36** ★ voir 18.1.
- **L37** Le taux N2 reste à 2 % ; l'écart avec l'Annexe A et §97 (3 %) est signalé, pas tranché. La ligne 10/3 reste en base, inatteignable.
- **L38** Trace `referral_commissions.uncapped_amount`, nulle sauf plafonnement (§106).
- **L39** (r) compte les commissions non annulées, ne compare que s'il en existe une, `net NULL` = violation ; (r2) borne le restant au net effectif.
- **L40** (s) ne classe pas un cashout `ECHOUE` en violation : il a son alerte et sa relance. Signalé.
- **L41** `assertRecetteInvariants` enveloppe `assertTerrainInvariants` ; `terrain-invariants.ts` inchangé ; (r)(s)(t) lus sur toute la base.

*1.5 Scan, caisse, Realtime (8.2 e à g)*

- **L42** Renvoi sans ligne : résultat `not_processed`, HTTP 200, classé technique ; ni 404, ni `invalid`.
- **L43** En mode renvoi, aucune écriture, pas même `forbidden`.
- **L44** Indicateur mal formé (`"true"`, `1`, `null`, `replay_only` en snake_case) : 400 `INVALID_REPLAY_FLAG`, jamais un compostage.
- **L45** `replayOnly` côté client déduit de `createdAt`, passé seulement à la reprise : `scanner-reprise.test.ts:338` reste intact.
- **L46** `PENDING_SCAN_MAX_AGE_MS` reste à 2 minutes.
- **L47** Écart de caisse : correctif dans `closeShift` seul, aucun changement d'écran, aucune migration ; stub e2e aligné sur le vrai statut 400.
- **L48** Diagnostic Realtime : statut du conteneur par `docker inspect`, sans lecture de `pg_replication_slots` ; délais inchangés.

*1.6 Pages et messages (8.2 h à p)*

- **L49** 404 d'un événement par un layout serveur ; erreur de lecture : journal et page rendue (l'API reste protectrice). D79 respectée.
- **L50** `notFound()` affiche le `not-found` racine ; pas de `app/events/not-found.tsx` sans preuve.
- **L51** Messages : liste blanche par classe (`PublicError`, plus les classes métier existantes), jamais de liste noire.
- **L52** Chantier i découpé en 6 lots ; `LoginForm`, `forgot-password`, `reset-password`, `global-error` inclus.
- **L53** Toutes les redirections d'un connecté visent `/?error=…`, ce qui ferme aussi la boucle `/controller/scanner` ↔ `/login`.
- **L54** Clé d'erreur inconnue : rien d'affiché, jamais le paramètre lui-même.
- **L55** `partner_profile_update` : champs mis à jour selon la présence de la clé, liste fermée de colonnes.
- **L56** `GET` et `PATCH /api/controller/profile` : toute lecture ignorée traite son erreur. Le `PATCH` n'était pas demandé : signalé.
- **L57** `PAYMENT_SUCCESS` : `payment_target` ajouté au déclencheur ; lecture tolérante pour les lignes déjà en file.
- **L58** Filtre de `/admin/notifications` à quatre valeurs.
- **L59** `/admin/services` : `useFeatureFlags` existant, bandeau en tête de panneau, contrat de route inchangé.
- **L60** `commissionAmount` retiré, avec `commissionRate` et `evCommission` de `app/api/partner/finance/route.ts:65,73` (mêmes zéros en dur, aucun lecteur, signalé). *`e96dab4` a ensuite retiré « commissions déduites » de la carte « Montant net organisateur ».*

*1.7 Système de design (8.2 q à u)*

- **L61** `font-mono` réservé aux numéros de billets, références et codes, plus l'exception `<pre>` du journal d'audit ; aucune police à chasse fixe embarquée ; contrôle global par dictionnaire `MONO_ALLOWED`.
- **L62** `tabular-nums` contrôlé sur tous les `.tsx` d'`app/` et `components/` ; les 48 affichages sont corrigés.
- **L63** Téléphones, lien de parrainage et noms de permission en police normale.
- **L64** `ClosingReportModal` migré ; « Conforme CDC V3.0 » et « commissions de la plateforme » retirés de l'écran et du PDF : termes internes ou faux. *Le PDF garde « Document comptable certifie » et « Certificat de cloture » (A39, listée).*
- **L65** Barre d'achat : `backwards`, retrait de `will-change`, `isolation: isolate` sur `.ev-page-enter` ; repli sur portail si la relecture montre un effet de bord, signalé. *E2 avait laissé la fiche inchangée (écart de 19 px accepté) ; la relecture l'a relevé et `dff5778` colle la barre à la navigation (53 px plus la zone sûre). Constaté disparu sur les images du run 105.*
- **L66** Dates de capture : drapeau `LangAttributeAwareFormControlUI` sur les projets `mobile` et `desktop` seulement, soit `dd/mm/yyyy` et 24 h ; `jj/mm/aaaa` documenté, non visé. `locale: 'fr-FR'` était déjà en place et n'a aucun effet sur ces champs. *Effet réel : seuls les champs `type="date"` passent en `dd/mm/yyyy`. Les champs `datetime-local` restent en `mm/dd/yyyy` dans le Chromium Linux de la CI (relu aux runs 98 et 105) ; non reproduit sous Windows. Écart documenté, non corrigé (section 19).*
- **L67** La relecture des captures par des agents est présentée comme telle au rapport.

*1.8 Outillage (8.2 v à x)*

- **L68** Legacy : 8 suites supprimées sans portage, 18 portées pour leurs cas uniques puis supprimées ; dossier, script et option du lanceur retirés. *Fait. Le 26ᵉ fichier n'a été supprimé qu'après le port de son cas T6 (AM12).*
- **L69** Suppression de `tests/legacy` juste après le run « avant » et avant `fix(8.2p)` : `tsc` compile ces fichiers. *25 fichiers supprimés avant `fix(8.2p)`, le dernier après (AM12).*
- **L70** `legacy-peer-deps` retiré, lock régénéré avec npm 10.9.2, `.npmrc` supprimé, `npm ci` imposé dans les guides. *Remplacée par AM10 : lock régénéré avec npm 10.9.9, la version de la CI.*
- **L71** `npm --version` journalisé en CI.
- **L72** Compression gzip dans la seule route `offline-codes` : `next start` 14.2.35 ne compresse aucune route API. Les autres routes vont en point ouvert. *Mesure réelle : section 8 du rapport.*
- **L73** Le rapport corrige la section 7 du lot 7 : la compression annoncée n'existait pas.

*1.9 Infrastructure et e2e*

- **L74** Aucun relèvement de budget JS ; `dynamic()` si `/` dépasse.
- **L75** Page de développement capturée par rendu statique (`renderToStaticMarkup`), modèle de la phase `emails` ; repli : relecture manuelle signalée. *Phase e2e `dev-page` : 4 tests verts au run 107. La capture est en police à empattements (rendu statique) : elle ne prouve rien sur la typographie.*
- **L76** `demo-ids` version 3 conservée, aucun rôle de capture ajouté.
- **L77** `timeout-minutes: 75` pour le run « avant », retour à 60 si trois runs restent sous 50 min, sinon 75 justifié au rapport. Pas de relèvement de `workers` sans mesure. *Fait : 75 min posé par `a3858d4`, ramené à 60 par `a03abe6` après quatre runs sous 50 min.*
- **L78** Premier commit du lot : `e2e/fumee.spec.ts:411`, seul. *Fait : `ef2b36b`.*
- **L79** Recette : file vidée par la vraie route avant chaque appel d'invariants ; 0 ligne réservée exigée.
- **L80** Toute écriture du seed sur le schéma du lot reste dans un commit de correctif.
- **L81** Aucune aide RLS nouvelle.
- **L82** Run « après » sur deux commits successifs identiques en code (second : commit vide, seule voie sans `gh`), comme les runs 90 et 91. *Runs 105 (`a03abe6`) et 106 (`f488be0`, commit de journaux seulement, et non un commit vide). Le run 107 (`bc864fa`) porte ensuite le code final.*
- **L83** Aucun réglage `platform_settings` nouveau dans ce lot.

*1.10 Recette (8.3)*

- **L84** Parcours : 8 actes étiquetés par rôle dans un seul fichier, phase `recette` en dernier, après `perf`. *Phase `recette` verte au run 107 : 8 actes sur 8, 65 s.*
- **L85** Statut strict : « partiel » dès qu'un affichage ou une route n'a pas d'assertion.
- **L86** A1 : fausse sauvegarde retirée, personnalisation non construite. *A1 corrigée (`3fa31ed`).*
- **L87** A2 : lien `<NEXT_PUBLIC_APP_URL>/register?ref=<code>`, sans nouvelle route. *A2 corrigée (`b92928e`, `407d09c`).*
- **L88** A3 : `GET /api/admin/refunds` et panneau sur `/admin/finance` ; `INCERTAIN` affiché sans bouton. *A3 corrigée (`9a92e59`, `2506b89`, `5a6dcbc`).*
- **L89** A4 : recherche par numéro et remboursement dans l'onglet Ventes, double confirmation, droits de la route existante. *A4 corrigée (`c1eabd6`, `18c69b8`).*
- **L90** A5 à A10, A12, A16 à A19, A21, A22 : listés, non corrigés (nouvelles fonctions, décision du client ou hors consolidation).
- **L91** Code « à régler sur place » conservé (A16).
- **L92** Suites racine jamais citées comme preuve (AR14).
- **L93** « Wallet » lu comme Apple ou Google Wallet (Q3), distinct de la page `/wallet`.

### 18.3 Arbitrages et amendements de l'orchestrateur (font foi sur le contrat)

Recopiés de l'en-tête du contrat. AR1 à AR15 ont été posés avant les tests rouges, AM1 à AM15 pendant le lot.

- **AR1** Aucune question n'est bloquante : on applique la décision la plus prudente et on la liste.
- **AR2** D8-T1 à D8-T14 du rapport tests sont retenues : `assertRecetteInvariants` enveloppe `assertTerrainInvariants`, `terrain-invariants.ts` inchangé ; aucun nouveau `kind` dans `admin_signals` (`M/20261105000002_lot7_sms.sql:52-55` refait la contrainte et le fichier est gelé) ; l'alerte du double paiement reste le type `ADMIN_DUPLICATE_PAYMENT` ; la page de développement est capturée par rendu statique, jamais de `next dev` en CI ; aucun relèvement du budget JS ; le premier commit du lot corrige seul `e2e/fumee.spec.ts:411` (rouge au run 92, vert aux runs 93 et 94 sur le même commit), test existant modifié et signalé.
- **AR3** Une seule définition finale par fonction SQL dans le lot (section 2.2). Une migration n'efface jamais le travail d'une autre.
- **AR4** Ordre des verrous (8.2 b) : ordre unique vérifié pour chaque fonction qui prend `events`, paiements, catégories (section 2.3), test rouge déterministe à 3 connexions ; les fonctions de la famille non corrigées vont en points ouverts avec une raison, sans repli silencieux.
- **AR5** Commissions (8.2 c) : N1 = min(calcul, net), N2 = min(calcul, net − N1), même budget au remboursement partiel. Extension du texte de la consigne, à signaler. La grille N2 reste à 2 % ; l'écart avec l'Annexe A (3 %) est signalé au rapport, pas tranché. Exemple chiffré obligatoire au rapport.
- **AR6** Mode simulé (8.1) : un remboursement ou un retrait créé en simulé ne peut JAMAIS partir en réel. Marquage en base et refus côté envoi, testés par des rouges (section 5.4). `EV_INTEGRATIONS=fake` reste impossible hors développement, prouvé contre le build de production. `tests/helpers/env.ts` ne change pas.
- **AR7** 8.3 d, corrigées dans le lot (test rouge puis vert) : A1, A2, A3, A4, A13, A20. Preuves ajoutées, annoncées vertes dès l'écriture (garde-fous, pas des rouges) : A11, A14, A15. Le reste est listé avec gravité et raison, dont A5 et les six questions au client.
- **AR8** Invitations (Carré presse) : rien à construire en 8.0. Une catégorie sans canal n'est distribuée à personne ; l'aide du formulaire reste factuelle ; le manque va en point ouvert et la question de l'outil d'invitations au rapport. Écart avec le libellé de la consigne signalé.
- **AR9** 8.2 v : tableau complet des 26 suites ; les cas à porter le sont avec leur test ; `tests/legacy` n'est supprimé qu'une fois chaque ligne soldée.
- **AR10** 8.2 i : liste blanche `PublicError` + `apiFailure`, jamais de remplacement aveugle ; chantier découpé en lots de routes ; contrôle statique avec auto-contrôle.
- **AR11** Délai du job CI : 75 min pour le run « avant », signalé ; retour à 60 à la fin si les chiffres le permettent (D8-T7). `npm --version` ajouté à `verify.yml`.
- **AR12** Toute suite qui écrit massivement dans une table publiée suit la règle `massHolders` de `scripts/run-tests.mjs`.
- **AR13** Le lock est régénéré avec npm 10.9.2, jamais npm 11 (8.2 w).
- **AR14** La matrice de traçabilité n'est marquée « fait » qu'après lecture du corps du test cité. `tests/superadmin-complete.test.ts` et `tests/auth-rbac.test.ts` ne sont jamais cités comme preuve.
- **AR15** Tout travail d'interface passe par le skill ui-ux-pro-max, traces dans `docs/lot8-logs/ui-ux-pro-max/` (outil : `bash "S/uiux.sh" <agent> <sujet> "<requête>" [--domain ux|--stack nextjs]`). Tout nouveau `.tsx` est déclaré dans `tests/helpers/design-files.ts`.
- **AM1** A23, anomalie ajoutée et corrigée : `csvField` neutralise par une apostrophe tout champ de TEXTE commençant par `=`, `+`, `-`, `@`, tabulation ou retour chariot ; les nombres restent des nombres (S4, `lib/partner/partner-dashboard.service.ts`, commit `fix(8.3-A23)`). `app/api/tickets/[id]/pdf/route.ts:75` n'affiche plus le statut technique (S4, même commit). `lib/events/event-cancellation.service.ts:220` n'affiche plus `outcome.status` brut : message français (S2, avec A3).
- **AM2** T39 : `hors-ligne-codes` test 10 admet `req.headers.get('accept-encoding')` une seule fois, tout autre en-tête reste refusé. S3 écrit exactement cette forme.
- **AM3** `POST /__test/samirpay/balance` : à ajouter par l'agent E2E en vague F, avant `test(8.3b)`, dans `control` de `fake-core.mjs`.
- **AM4** `tests/parcours/messages-bruts.test.ts` porte i et k : commit rouge `test(8.2i-k)`. `scanner-interface.test.ts` porte e et les ports 2 et 20 : commit `test(8.2e)`.
- **AM5** Étape e2e de `verify.yml` : 50 min au lieu de 40 pour le run « avant » (marge mesurée insuffisante). Signalé au rapport.
- **AM6** A2 : `my-stats` lit `users.referral_code`, il ne le recalcule plus (S4). `/register` ouvre « Plus d'options » quand `ref` est présent (E4). A13 : colonne Utilisateur exigée (E2).
- **AM7** Listés, non corrigés : A24 `/api/admin/audit` sert tout ADMIN alors que la RLS réserve le superadmin ; A25 `limit` de cette route non borné ; A26 `partner/events/[id]` : une panne de lecture reste un 404 ; A27 le trigger de boucle de parrainage ne couvre pas l'UPDATE par service_role ; A28 écrans de recherche sans `q` ni `city` (filtre navigateur).
- **AM8** Une suite qui appelle `assertRecetteInvariants` reste rouge tant que M1, M3 et M4 ne sont pas tous livrés : critère de sortie jugé après S2, pas tâche par tâche.
- **AM9** Sur le poste, un `after()` en échec peut donner un faux PASS sous Node 26 : lire la section « failing tests » du journal ; commande : `EV_ENV_FILE=.env.test.example node scripts/run-tests.mjs <fichier>`, et `--dir tests/schema --filter essai-` pour un groupe.
- **AM10** Le lock (8.2 w) est régénéré avec npm 10.9.9, la version lue en CI au run 95 (`npm_version=10.9.9`), et non 10.9.2 : la règle de fond reste « npm 10, jamais npm 11 ».
- **AM11** Les agents committent eux-mêmes par `S/commit8.sh`, un commit par tâche, sans pousser (`S/lot8-fixer-brief.md`, règle 8). S4 est découpé : S4a (I1, I2, I3, k, l, A2s) puis S4b (I4, I5, p, A23), en série.
- **AM12** Après la vague serveur. T6 (ligne 10 du tableau 12.1) ajouté à equipe-eligibilite ; suppression du dernier fichier legacy et T36 seulement après ce cas vu vert en CI. anonymisation-debogage admet app/api/dev à condition de n'y trouver que des route.dev.ts. A29 ajoutée et corrigée (notification, SOLDE_INSUFFISANT). Listées, non corrigées, hors périmètre : A30 GET partner/halls/[id] sans contrôle de rôle ni de propriétaire, réservations et téléphone du partenaire lisibles par tout compte connecté quand le service est ouvert ; A31 GET partner/products/[id] sans contrôle de propriétaire ; A32 panne présentée comme une absence, non journalisée (getEventById, getHallById, getProductById, GET orders/[id]) ; A33 écritures ignorées admin/permissions POST, partner/register ; A34 lectures ignorées admin/communications POST, admin/pricing POST, send-otp, verify-otp, admin/users PATCH ; A35 send-otp:100 sendResult.error arrive à la réponse, texte à vérifier.
- **AM13** Après la vague E. A36 ajoutée : le refus de ticket_refund_request porte le statut brut, la route le remplace par un texte fixe (migration lot 3 gelée). A35 passe de « listée » à « corrigée » (send-otp, texte fixe, détail au journal). Tests A35 et A36 rouges au prochain run, correctifs ensuite. Listées, non corrigées : A37 effet de 8.2 s, barres fixed bottom-0 z-50 de app/halls/[id], app/restaurants/[id]/menu et tables passent sous la navigation mobile z-40 (hors périmètre, derrière interrupteurs) ; A38 /api/admin/audit fait select('*') sans jointure, colonne Utilisateur = identifiant tronqué ; A39 le PDF garde « Document comptable certifie » et « Certificat de cloture » ; A40 route.dev.ts ignore webhookStatus, un webhook en 500 rend ok:true (outil d'essai, message prudent à l'écran). Un commit fix(8.2q) par agent E1, E2, E3 (part du contrat 11.1).
- **AM14** Run 96. event_cancel prend ses catégories FOR NO KEY UPDATE (M3), second cycle par ticket_scans.category_id, section 2.3 rectifiée d'autant. T36 fait : docs/lot0-inventaire-suites.md gardé avec mention historique, à la différence de 12.1, deux rapports gelés y renvoient.
- **AM15** A41 ajoutée, Élevée, corrigée : middleware, /api/checkout/quote public, depuis le lot 3 un visiteur ne pouvait pas commencer un achat. Trouvée par la recette, run 99.

### 18.4 Décisions prises par les agents (au plus prudent, signalées dans leurs réponses)

Tirées des sections « Décisions prises » des réponses des agents, une ligne par décision. Les agents S (serveur), E (écrans), W et INFRA (tests), E2E, D (documentation) et le correcteur de la relecture ont travaillé chacun sur leurs fichiers (contrat, section 16).

**S0, canaux et 404 (`fix(8.0s)`, `fix(8.2h)`)**

- `decided_at` d'une décision RESERVATION : date de création de la réservation (décision du checkout, L8) ; CATEGORIE : `now()`.
- Contrôle avant reprise limité aux lignes que l'UPDATE réécrit, avec un arrêt en français ; testé sur une ligne hors règle.
- `sale_online` et `is_visible` fournis ensemble à l'API : `sale_online` gagne, à la création comme à la modification ; la règle « les deux vrais » ne vaut que pour une écriture directe en table.
- `ticket_category_normalize` ne rend plus `is_visible`, seulement `sale_online` et `sale_counter`.
- Fonctions de triggers : `GRANT EXECUTE` à `service_role` en plus du `REVOKE` (patron du lot 7, exigé par `03-verification.sql`), alors que le contrat 2.4 disait « REVOKE seulement ».
- `VOLATILE` explicite ajouté aux recopies qui n'en avaient pas.
- `ticket_category_update` : message de refus reformulé, champ fautif précis ; audit `CATEGORY_CREATED` inchangé.
- Effet de la reprise : `updated_at` change sur les catégories masquées réécrites, aucun autre champ métier.
- `readPublicEventStatus` rend `PUBLIC`, `NOT_PUBLIC` ou `UNAVAILABLE` ; `isEventId` partagé avec la route.
- Aides `online` et `counter` du formulaire rédigées par S0 (non fixées par le contrat), relues et gardées par E0.

**S1, mode d'essai (`fix(8.1s)`, `fix(8.2j-s)`)**

- Mode B : `essai-start` remplace aussi les clés SamirPay et MTarget par des valeurs factices (`essai-keys.mjs`) ; le contrat ne listait que les URL, mais L19 interdit d'envoyer une vraie clé.
- Mode B : le faux service reconnaît ce mode à cette clé et sert sa propre page `/` ; sinon le lien viserait `/dev/paiements/<id>`, en 404 sur un build.
- `essai:build` passe par `essai-start.mjs --build`, pour que `EV_INTEGRATIONS=fake` de `.env.local` n'arrive jamais à `next build`.
- `instrumentation.ts` n'a aucun `throw` : comportement sous Next 14 SUPPOSÉ ; le refus reste au premier appel, prouvé par `fake-prod`.
- Immuabilité de `simulated` : refus en `EV422` ; `EV403` reste réservé à `SIMULATION_MISMATCH`.
- Fonctions de triggers de M2 : `GRANT EXECUTE` à `service_role` (patron du lot 7).
- Le seed ne reprend pas une création interrompue : un compte ou un événement partiel reste tel quel et l'erreur dit lequel (« présent : rien » prime).
- `isLoopbackUrl` admet `localhost`, `127.0.0.1`, `[::1]`, refuse tout identifiant dans l'URL et tout protocole autre que http(s).
- Solde du faux service non conservé au redémarrage ; seules les transactions le sont.
- `loadLocalEnv` refuse un `.env.local` absent, et isole le shell pendant la lecture (un `$VAR` du fichier ne voit pas le shell ; le guide proscrit `$` dans les valeurs).

**S2, paiement et finance (`fix(8.2b)`, `fix(8.2a)`, `fix(8.2m)`, `fix(8.2c)`)**

- `duplicate_of` n'apparaît dans le résultat que pour un vrai double ; le résultat `REFUND_REQUIRED` d'un panier impossible reste identique à l'octet.
- `SIMULATED` remplace tout autre motif de blocage déjà posé (cause définitive) ; une ligne déjà `SIMULATED` n'est ni renvoyée ni réalertée.
- `sendBatch` : les lignes refusées passent par `send` avant la lecture du solde ; une panne de solde ne les marque pas `SOLDE_UNAVAILABLE`, elles sont bloquées dans tous les cas.
- `resumeUnsentRefunds` rend `{ checked, resumed, failed }`, un échec n'arrête pas les lignes suivantes, la route expose `refunds_resumed` et `refunds_resume_failed` (second compteur ajouté au contrat), appel après `confirmSent` et les envois interrompus.
- AM1 : `sendOutcomeLabel(outcome)` exportée par `cashout.service.ts` ; message « Remboursement non envoyé : <raison>. ».
- Alerte du double paiement : titre « Paiement en double remboursé », contenu « son remboursement au client est lancé » (l'argent n'est pas encore parti à l'envoi de l'alerte).
- `uncapped_amount` sur une ligne de remplacement : posé seulement si le budget a coupé le prorata de cette ligne ; pas de report, pas sur une régularisation.
- Effet de L36 à signaler : le budget porte aussi sur des paniers à prix égaux. Exemple de S2 : 10 billets de 1 000 F, 9 remboursés, net effectif −107,50 F, donc commissions à 0 au lieu d'un dixième du prorata. Voulu par (r2).
- Contrôles faits en plus de l'inventaire 2.3 : aucun trigger n'écrit sur `events` ; `checkout_create_payment` ne verrouille aucun paiement après les catégories.

**S3, scan, caisse, lot hors ligne (`fix(8.2e-s)`, `fix(8.2f)`, `fix(8.2x)`)**

- Renvoi avec `eventId` illisible : `400 INVALID_EVENT_ID` (code libre au contrat) ; le 400 du parcours normal reste sans code.
- Ordre sur la route : quota, corps, clé d'idempotence, puis indicateur ; un indicateur mal formé sans clé rend `IDEMPOTENCY_KEY_REQUIRED` ; le quota est consommé dans tous les cas.
- `replay_only` en snake_case dans le corps : refusé quelle que soit sa valeur, `false` compris.
- RPC appelée directement avec `replay_only: null` : mode normal selon la formule du contrat ; la route refuse ce cas et seul `service_role` peut appeler la RPC (signalé, section 19).
- Message de `not_processed` : phrase longue dans une constante de la route, libellé court dans `SCAN_RESULT_LABELS`.
- Compression seulement pour un 200 ; les refus restent en JSON brut. `Vary` posé sur la variante gzip seulement. `gzip;q=0` ou poids illisible : refus de gzip.
- Échec de `zlib.gzip` : journal et `500 SERVER_ERROR`, sans repli sur le JSON brut ; la ligne de `ticket_offline_downloads` et le quota restent consommés.
- BREACH : relu dans `offline-codes.service.ts`, le corps ne reflète aucune entrée de l'appelant.
- Écart de caisse : `const expected` introduit dans `closeShift` ; `shift_close` non touchée.

**S4a, messages bruts, profils, parrainage (`fix(8.2i-1)` à `i-3`, `fix(8.2k)`, `fix(8.2l)`, `fix(8.3-A2s)`)**

- Statuts conservés à la lettre : `payments/create`, `DELETE users`, `anonymize` et l'échec de Supabase Auth sur `POST users` gardent 400 pour une panne technique.
- `create_table_reservation_atomic` : seuls ses 3 refus rédigés deviennent `PublicError` ; son repli `SQLERRM` part au journal.
- Throw laissés techniques : « Erreur d'équilibre financier » de `hall.service` et ceux qui embarquent un texte de la base (repli générique à l'écran).
- Textes reformulés sans identifiant ni statut technique : « Un produit de cette commande n'appartient pas à ce partenaire. », « Statut de commande invalide. », « Produit introuvable. ».
- `POST /api/admin/users` : `email_exists`, `phone_exists`, `user_already_exists` donnent `USER_ALREADY_EXISTS`, 400, message français (`user_already_exists` ajouté au contrat).
- `partner/register` : le cas « déjà associé » lit « has already been registered » et passe de 400 en anglais à 409.
- `my-stats`, hors tâche : `catch {}` des taux retiré ; pannes des filleuls et du profil en 500 `REFERRAL_STATS_UNAVAILABLE` (avant : 200 et zéros). Compte sans `referral_code` : journal, code et lien vides.
- Codes ajoutés, absents du contrat : `RECONCILIATION_UNAVAILABLE`, `METRICS_UNAVAILABLE`, `SERVICES_UNAVAILABLE`, `ACCOUNT_LOOKUP_UNAVAILABLE`, `REFERRAL_STATS_UNAVAILABLE`, `IDENTITY_UNAVAILABLE`, `ANONYMIZE_FAILED`, `USER_DELETE_FAILED`, `USER_CREATE_FAILED`, `ACCOUNT_CREATE_FAILED`, `OTP_SEND_FAILED`, `OTP_VERIFY_FAILED`, `SIGN_OUT_FAILED`, `PAYMENT_CREATE_FAILED`, `PARTNER_REGISTER_FAILED`.
- `PATCH /api/partner/profile` : corps vide, aucun appel à la RPC ; `PARTNER_NOT_FOUND` en 404 ; `activities: []` en appel direct retirerait tout, seule la route garantit au moins une activité.

**S4b, messages bruts (suite), commissions, export (`fix(8.2i-4)`, `fix(8.2i-5)`, `fix(8.2p)`, `fix(8.3-A23)`)**

- Chaque `apiFailure` porte un statut explicite : une panne d'écriture reste en 400, une `PublicError` sur une lecture reste en 500, le code rendu est celui du repli (`TABLES_UNAVAILABLE`, `HALL_SAVE_FAILED`…).
- `GET partner/events/[id]` garde son 404 sur panne (A26), code `EVENT_NOT_FOUND` ; `GET halls/[id]` de même, `HALL_NOT_FOUND`.
- `DELETE partner/events/[id]` garde 400 pour le profil introuvable et pour toute autre exception non `EventServiceError`, avec un repli français.
- Rapports (`accounting`, `closing`, `closing/pdf`) : les refus nommés (403, 404) restent mappés dans les routes, sans `code` ; seul le dernier repli passe par `apiFailure`.
- Pied du PDF : « Conforme CDC V3.0 » retiré, numéro de certificat gardé ; « Document comptable certifie… » non touché (A39).
- `csvField` : même jeu de caractères que `csvCell` de l'export des participants, mais contrôle sur le type de la valeur, pour qu'un négatif reste un nombre.
- Codes ajoutés, absents du contrat : 11 de lecture (`FINANCE_UNAVAILABLE` … `TABLE_RESERVATIONS_UNAVAILABLE`), 11 d'écriture (`HALL_SAVE_FAILED` … `TABLE_RESERVATION_CANCEL_FAILED`), `HALL_NOT_FOUND`.

**S5, A3 et A4 côté serveur (`fix(8.3-A3s)`, `fix(8.3-A4s)`)**

- A3 : tri par `created_at` croissant puis `id` (argent dû depuis le plus longtemps d'abord) ; au-delà de 100 lignes, les plus récentes sont coupées et `truncated` le signale.
- A3 : `can_retry` exige en plus un `refund_id` (sans lui, `retryRefund` répondrait 404) ; plus strict que le contrat 3.10.
- A3 : `reason_label` seulement pour BLOQUE ; `phone_masked` à `null` sans numéro ; titre de l'événement lu comme `event_cancel` ; `state` invalide en 400 `INVALID_STATE`, panne en 500 `REFUNDS_UNAVAILABLE` ; motif inconnu « Blocage à vérifier » et journal ; libellés copiés localement (`BLOCK_LABELS` non exporté).
- A4 : un billet gratuit VALIDE est `refundable` en mode `AUCUN` (la RPC l'annule sans argent) ; E0 écrit que rien n'est versé.
- A4 : `refundable` = statut VALIDE plus paiement `SUCCESS` ou `PARTIAL` en mode CASHOUT, sans contrôle du reste à rembourser (cas jugé inatteignable, non prouvé ; le POST recontrôle sous verrou).
- A4 : `holder_short` « Vente au guichet » sans compte ; numéro `trim` puis majuscules, 4 à 60 caractères, sinon `INVALID_TICKET_NUMBER` ; événement absent en 404 `TICKET_NOT_FOUND` ; propriété vérifiée avant la lecture du billet ; aucun quota ni audit, aucune donnée sensible renvoyée.

**W4, diagnostic Realtime (`fix(8.2g)`)**

- Le rejet de `ready` reçoit toute la trace du canal (états, heure de l'échec, conteneur) ; son texte existant ne change pas.
- `docker inspect` lancé avec `stdio: ['ignore', 'pipe', 'pipe']`, pour que son stderr entre dans la raison ; sortie vide avec code 0 : « indisponible (sortie vide) ».
- Chaque échec peut bloquer 3 s au plus ; seuls des tests déjà en échec sont touchés.

**INFRA, outillage (`fix(8.2w)`, `chore(8.1)`)**

- Lock régénéré avec npm 10.9.9, options du contrat 12.2 conservées (AM10).
- `@next/env` reste une dépendance transitive (version fixée par `next`) : la déclarer aurait changé `package.json` hors consigne.
- T38 tolère un `.npmrc` sans l'option : il exige l'absence de `legacy-peer-deps=true`.
- `fake:samirpay` ajouté aux scripts npm, cité par le contrat 5.2.

**W8 et INFRA, suites legacy (`test(8.2v)[…]`)**

- T2 de la ligne 11 non porté, ligne soldée : la route de retrait n'a aucune barrière de rôle à protéger ; résiduel faible, listé.
- T7 de la ligne 15 non porté : code mort, comportement couvert par `acces-fenetre:116`.
- `docs/lot0-inventaire-suites.md` gardé avec une mention historique (deux rapports gelés y renvoient) ; le commentaire de `financial-calculator.service.ts` mis à jour par `5d4cdb7`.

**E0, canaux et remboursement d'un billet (`fix(8.0e)`, `fix(8.3-A4e)`)**

- Montant annoncé : prix plus frais en mode CASHOUT, prix seul en mode ORGANISATEUR ; le résultat affiché lit `amount` de la réponse.
- Billet gratuit : bouton « Annuler ce billet gratuit », texte « rien n'est versé, le billet est annulé ».
- Résultat : « versé » seulement pour `CONFIRME`, « envoyé » pour `ENVOYE`, sinon « versement en attente » ; en mode ORGANISATEUR, le partenaire est invité à remettre l'argent lui-même.
- Échec du POST : réseau ou 5xx, la confirmation reste ouverte (clé `REFUND-TKT` contre le doublon) ; 4xx, fermeture, bandeau et relecture de la fiche.
- Changer le numéro retire la fiche et annule la recherche ; `SalesTab` découpé pour qu'une relecture en échec ne ferme pas une confirmation ouverte.
- Bouton d'annulation des dialogues : « Revenir à la fiche » ; aide du motif : « Le motif est conservé avec cette opération. » (le client ne le reçoit pas).
- Formulaire de catégorie : cases sous « Où vendre cette catégorie » (`fieldset`), résumé « Résultat : … », aide `none` en bandeau d'avertissement ; administration : colonne « Canaux et état », badge neutre « Invitations seulement ».

**E1, scanner (`fix(8.2e-c)`, `fix(8.2q)` part du scanner)**

- « Résultat retrouvé » masqué aussi pour tout incident technique (plus large que la consigne).
- Durée d'affichage gardée pour un scan repris (`Shown.resumed`, hors contrat) : le scanner attend un toucher, l'écran partenaire garde 10 s.
- Icône ScanLine pour `not_processed` (le serveur a répondu, ce n'est pas une panne) ; fin du plein écran « Touchez l'écran pour reprendre le scan ».
- `postScan` avec `replayOnly` et sans `key` : clé neuve tirée ; la réponse ne peut être que `not_processed`.

**E2, système de design, audit, clôture (`fix(8.2q)`, `fix(8.2r)`, `fix(8.2s)`, `fix(8.3-A13)`)**

- q du modal limité au `font-mono` et aux montants, la réécriture vient avec r.
- `ErrorState` reçoit un texte fixe, jamais le message de la réponse.
- Téléchargements du rapport par `fetch` puis blob ; un refus s'affiche dans un `StatusBanner` au lieu d'une page JSON sous un toast de réussite (hors contrat).
- Textes du modal : « Rapport de clôture », « Généré le … », « Entrées », « Télécharger le PDF ».
- Audit : la dernière requête gagne, compteur masqué en erreur, heure en `tabular-nums`, « (§134, §156) » retiré du titre, identifiant complet dans le détail.
- Barre d'achat : fiche inchangée pour 8.2 s, écart de 19 px accepté (repris ensuite par la relecture, voir L65).

**E3, notifications, services, parrainage, finance admin (`fix(8.2n)`, `fix(8.2o)`, `fix(8.3-A1)`, `fix(8.3-A3e)`)**

- A3 : 403 en bandeau neutre sans « Réessayer » ; relance sans réponse lisible : « Résultat inconnu », « le remboursement a pu partir », puis relecture ; focus sur le titre de section après une relance ; liste en panne remplacée par `ErrorState` ; ligne bloquée : « Aucune relance possible depuis cet écran ».
- Panneau monté hors de la synthèse (une panne du rapprochement ne le cache pas) ; prop `refreshToken` pour « Actualiser ».
- `/admin/finance`, au-delà du contrat : titre « Rapprochement financier », `PageHeader`, « Console Superadmin » retiré, jetons, 14 px, 44 px, `Select` du système, tableau défilable au clavier, codes inconnus « Autre objet » et « Autre moyen ».
- A1 : mention en `StatusBanner` neutre ; emoji et textes « CDC » de la page non touchés (A22).
- 8.2 o : si la lecture des interrupteurs échoue, aucune mention (`flags === null : rien`).

**E4, connexion, accueil, inscription (`fix(8.2j-e)`, `fix(8.2i-6)`, `fix(8.3-A2e)`)**

- Pas de classe d'erreur partagée : les refus rédigés par nos routes s'affichent directement ; tout `catch` tombe sur un texte fixe.
- L'écran décide sur `error.code` de Supabase Auth, le texte part au journal, le code n'est jamais affiché. Codes traités à la connexion et sur `/reset-password` ; non vérifiés contre une vraie GoTrue.
- `user_banned` : « Ce compte n'est plus actif » (posé seulement par l'anonymisation).
- A35 traitée d'abord à l'écran (texte fixe dans `LoginForm`), puis côté route par `15dc7d0`.
- Journal ajouté dans les `catch` de `forgot-password` et `reset-password` ; `global-error` en texte fixe, empreinte au journal seulement.
- `/register` : `ref` coupé à 64 caractères et mis en majuscules ; `AccessNotice` reste affiché tant que `?error=` est dans l'URL.

**E5, page de développement (`fix(8.1e)`)**

- Action serveur plutôt qu'un `fetch` client ; elle rappelle `POST /api/dev/samirpay/<action>` sur `127.0.0.1:<EV_DEV_APP_PORT>`.
- `FakePaymentPanel` en `'use client'`, sans `useFormStatus` (absent du `react-dom` 18.3.1 du script de capture).
- Lecteur du faux service dupliqué dans les deux pages (environ 20 lignes), faute de pouvoir exporter une aide d'une page.
- Troisième verrou (`notFound()`) repris dans l'action serveur, `decision` contrôlée à l'exécution ; messages par table fermée sur `code`.
- Relance possible après `FAKE_SERVICE_ERROR` ; refus sans confirmation ; liste limitée aux paiements en attente parmi les 50 dernières opérations ; « Actualiser » est un vrai rechargement ; mention « simulé » sur tous les écrans.

**E2E, seed, recette, captures (`fix(8.0-seed)`, `test(8.3)[outils]`, `test(8.3b)`, `test(e2e)[8]-captures`)**

- Le second client achète 2 Standard de plus (écart de données au contrat) : il fallait deux billets payants valables pour A3 et A4.
- Le scan en ligne utilise le billet gratuit, les autres étant déjà pris.
- Catégorie sans canal du seed : « Invités de la production », 0 F, `total: 10`.
- Une vente au guichet de Carré presse ajoutée au seed, cas réel pour `t2`.
- `manualLookup` exigé payant, en ligne et VALIDE dans le seed, sinon le seed échoue.
- `invariants-run` passe l'envoyeur avant `assertRecetteInvariants` et la recette exige 0 ligne due.
- Suspension de P1 par `/admin/users` (le tableau de bord n'a pas de bouton « Suspendre »).
- `/__test/samirpay/balance` refuse tout ce qui n'est pas un entier positif ou nul ; la route vit dans `control`, donc le mode d'essai la reçoit aussi.
- `references` de `checks.ts` pour le numéro `CLOTURE-…` (section 1, B.15).

**D1, guide d'essai (`docs(8.1)`)**

- Requête de contrôle `NOT VALID` de M1 placée avant `db push`, contrairement au contrat 5.6 ; contrôle de reprise ajouté après.
- `docs/deploiement-projet-neuf.md` corrigé hors des lignes demandées : compression, en-tête du projet du 02/11 devenu event-village-dev, ajouts factuels du lot 8.
- Le guide fait vider la file avant le retour en réel, par trois requêtes SQL non fixées par le contrat.
- `node scripts/dev/cron-local.mjs --once <tâche>` dans le guide, car `npm.ps1` perd le `--` sous PowerShell 5.1 (essai réel) ; l'aide du script corrigée par `6ea04e4`.

**D2, matrice et cahier de recette (`docs(8.3a)`, `docs(8.3c)`, `test(8.3a)`)**

- Gravités fixées pour A23 à A40, que le contrat ne notait pas, sur l'échelle de la découverte ; A30 Élevée.
- Statut durci (L85) : §20, §29, §33, §84, §127, §129, §131, §134, §142, §151, §152, §161, §163 restent partielles.
- Manques sans numéro d'anomalie (§84, §101, §104, §142, §134) notés dans la colonne « Manque » seulement.
- Essai 58 contient une commande PowerShell avec une adresse de contrôle, seule entorse à « sans nom de route » ; essai 50 se termine 7 jours plus tard.
- `recette-matrice` : toute ligne citée doit ouvrir un test ; si un fichier cité bouge, la suite passe au rouge, sciemment.

**Correcteur de la relecture des captures (`fix(8.2u)[relecture]` : `dff5778`, `bc864fa`)**

- Scan non traité corrigé à l'affichage seulement (`NOT_PROCESSED_DETAIL`, « Aucune entrée enregistrée. ») : le message de l'API reste celui du contrat 3.5, que `scan-renvoi-seulement.test.ts:46` impose.
- `formatFcfaPrecise` ajouté à `lib/format.ts` pour la finance admin, `formatFcfa` arrondissant à l'entier ; documenté dans `MASTER.md`.
- Hors relevé : N1 et N2 retirés aussi de la liste des commissions du portefeuille ; gouttière retirée de toutes les pages partenaire (plus larges aussi sur ordinateur) ; préfixe Leaflet retiré aussi de `MapPicker`.
- Visuel du billet en 16/9 : le QR descend de 25 px sur mobile et de 76 px sur ordinateur.
- « Aide au transfert » gardé sur chaque carte : le même nom que la modale rendrait ambigu le sélecteur de `e2e/support/screens.ts:916`.
- `bc864fa` : espace insécable avant le deux-points et le point-virgule dans `EventForm`, `CombatFlashOverlay`, `ShiftModals` ; « Créance » devient « À compenser » côté partenaire, comme côté client.

---

---

## 19. Points ouverts

Hors périmètre ou non corrigés. Chaque point dit d'où il vient. Rien ici n'est un défaut caché : tous sont déjà nommés dans le contrat, dans `docs/recette-billetterie.md` ou dans les réponses des agents.

### 19.1 Points ouverts du contrat (section 21)

| # | Point | État |
|---|---|---|
| PO1 | Invitations : aucun émetteur en production ; une catégorie sans canal n'est distribuée à personne. Question au client (AR8, L11). | ouvert |
| PO2 | Paniers différents (1 VIP puis 2 VIP) : deux paiements réussis gardés, hors définition du même panier (L30). | ouvert |
| PO3 | `ticket_refund_request` pour un billet sans paiement : billet puis catégorie, inverse d'`event_cancel` ; cycle possible, rattrapé par `rpcWithRetry`. Correctif d'une ligne possible, hors consigne. | ouvert |
| PO4 | `event_update`, `ticket_category_guard` : `events FOR UPDATE` puis catégories, cycle possible avec `checkout_create_payment` par la clé étrangère ; rattrapé par `rpcWithRetry`. | ouvert |
| PO5 | Deux confirmations du même événement sérialisées (L34) : effet sous charge à mesurer au test de charge. | ouvert |
| PO6 | Initialisation en délai dépassé mais acceptée par SamirPay : `FAILED` sans identifiant, webhook rejeté `REJECTED_CORRELATION`, argent pris sans remboursement (SUPPOSÉ, `webhook.service.ts:87-88`). | SUPPOSÉ, non vérifié |
| PO7 | Cashout `ECHOUE` d'un paiement en double : pas de violation de (s), alerte et relance seulement (L40). | ouvert, voulu |
| PO8 | Autres routes API non compressées (L72) : à régler à l'hébergement. | ouvert |
| PO9 | `is_visible` miroir permanent tant que les tests de rejeu du lot 7 existent (L5). | ouvert |
| PO10 | `AdjustTicketQuotaModal`, `EventCancelModal`, `calculateTicketingFinancials`, `calculateOrderFinancials` : code mort, non supprimé. | ouvert |
| PO11 | `EVENT_SOLD_OUT` non émis tant qu'une catégorie sans canal a du stock (`M/20261103000005:919-921`). | ouvert |
| PO12 | Événement « sur place uniquement » : le catalogue affiche « Bientôt en vente » (L10), texte trompeur figé par `cycle-visibilite.test.ts:255`. | ouvert |
| PO13 | Course résiduelle du renvoi : envoi d'origine arrivé après le renvoi, écran « non traité », nouveau scan `already_used` avec `checked_in_by_me`. | ouvert |
| PO14 | Solde partenaire d'un compte qui a des ventes simulées : tout retrait y reste marqué simulé, donc bloqué en réel. Voulu sur event-village-dev. | voulu |
| PO15 | Taux N2 de 3 %, ligne 10/3 de la grille : inatteignable sans parrainage prestataire (A5, L37). | ouvert, question au client |
| PO16 | Cause des 766 s hors `verify` et e2e du run 93 non établie. La durée par étape est maintenant écrite dans `run.txt` (extrait ci-dessous) ; au run 107, les étapes se suivent sans trou notable, mais l'écart du run 93 n'a pas été reproduit, donc pas expliqué. | mesure en place, cause inconnue |
| PO17 | `next dev` au téléphone par le tunnel : rechargement à chaud SUPPOSÉ, sans effet fonctionnel. | SUPPOSÉ |
| PO18 | Anomalies listées A5 à A10, A12, A16 à A19, A21, A22 (tableau en 19.2). | listées |

Run 107, `run.txt` (extrait de `docs/lot8-logs/ci-run107-run.txt`) :

```text
job_elapsed_s=2261
npm_version=10.9.9
etape_npm-ci=debut_s:4 duree_s:9 code:0
etape_supabase-start=debut_s:15 duree_s:64 code:0
etape_db-reset=debut_s:79 duree_s:27 code:0
etape_env-test=debut_s:106 duree_s:1 code:0
etape_seed-test=debut_s:107 duree_s:2 code:0
etape_verify=debut_s:109 duree_s:811 code:0
etape_e2e-chromium=debut_s:922 duree_s:9 code:0
etape_e2e-env=debut_s:931 duree_s:1 code:0
etape_e2e-seed=debut_s:932 duree_s:50 code:0
etape_e2e-demarrage=debut_s:982 duree_s:3 code:0
etape_e2e=debut_s:985 duree_s:1267 code:0
```

Lecture : le job démarre à 0 ; `npm-ci` commence à 4 s ; l'étape e2e finit à 985 + 1 267 = 2 252 s pour un job de 2 261 s. Les étapes `uses` (checkout, Node, CLI, cache) tiennent dans les écarts entre deux lignes.

### 19.2 Anomalies listées, non corrigées (`docs/recette-billetterie.md`, section 5)

Gravité et texte recopiés du tableau des anomalies. A24 à A28 viennent d'AM7, A30 à A34 d'AM12, A37 à A40 d'AM13.

| # | Gravité | Anomalie |
|---|---|---|
| A5 | Élevée | Parrainage prestataire absent : Q2 à trancher d'abord |
| A6 | Moyenne | Profil en lecture seule. Changer téléphone ou email touche à l'identité du compte |
| A7 | Moyenne | Événements populaires et proches absents : Q4 |
| A8 | Moyenne | WhatsApp absent, sans décision écrite : Q1 |
| A9 | Moyenne | Historique du parrainage incomplet, ROI absent |
| A10 | Moyenne | Virement bancaire non traité, réglage fermé par défaut |
| A12 | Moyenne | Un client ne devient pas partenaire (D8, D63) |
| A16 | Faible | Code « à régler sur place » conservé, sans émetteur en production |
| A17 | Faible | Pas de liste des paiements du client |
| A18 | Faible | Pas d'écran de statistiques client |
| A19 | Faible | Guides client et administration absents, pages légales à prévoir |
| A21 | Moyenne | Suites à la racine de tests/ qui ne prouvent rien : jamais citées comme preuve |
| A22 | Faible | Pages d'administration non migrées, hors du contrôle de design |
| A24 | Moyenne | La route du journal d'audit sert tout ADMIN alors que la RLS réserve le superadmin (`app/api/admin/audit/route.ts:15`) |
| A25 | Faible | `limit` de cette route non borné |
| A26 | Faible | Fiche partenaire d'un événement : une panne de lecture reste un 404 |
| A27 | Faible | Le trigger de boucle de parrainage ne couvre pas l'UPDATE par service_role |
| A28 | Faible | Écrans de recherche sans q ni city : filtre dans le navigateur, sur la liste déjà chargée ; le serveur sait filtrer (A14) |
| A30 | Élevée | `GET partner/halls/[id]` sans contrôle de rôle ni de propriétaire : réservations et téléphone du partenaire lisibles par tout compte connecté quand le service est ouvert. Hors périmètre, service fermé aujourd'hui (`features.halls_enabled` à false). **À corriger avant d'ouvrir le module salles** |
| A31 | Moyenne | `GET partner/products/[id]` sans contrôle de propriétaire. Hors périmètre, service fermé |
| A32 | Faible | Panne présentée comme une absence, non journalisée : `getEventById`, `getHallById`, `getProductById`, `GET orders/[id]` |
| A33 | Moyenne | Écritures ignorées : `admin/permissions` POST (`delete` et `insert` sans contrôle), `partner/register` (`users.upsert`, `partner_activities.insert`) |
| A34 | Moyenne | Lectures ignorées : `admin/communications` POST, `admin/pricing` POST, `send-otp`, `verify-otp`, `admin/users` PATCH |
| A37 | Faible | Effet de 8.2 s : les barres fixes en bas des pages salles, menu et tables passent sous la navigation mobile. Hors périmètre, derrière interrupteurs |
| A38 | Faible | La route du journal lit `select('*')` sans jointure : la colonne Utilisateur montre un identifiant tronqué |
| A39 | Moyenne | Le PDF de clôture garde « Document comptable certifie » et « Certificat de cloture » (`partner-dashboard.service.ts:1069,1072`) ; à arbitrer avec la référence `CLOTURE-` sans accent |
| A40 | Faible | La route de développement ignore le statut du webhook : un webhook en 500 rend `ok:true`. Message prudent à l'écran |

A23, A29, A35, A36 et A41, ajoutées pendant le lot, sont corrigées (test rouge puis vert) ; elles ne sont pas des points ouverts.

### 19.3 Points relevés par les agents, non corrigés

- **W4** : `tests/parcours/dette-publication-reservations.test.ts:206` et `dette-suspendu-temps-reel.test.ts:247` ont une copie locale du message « abonnement Realtime … » : elles n'auront pas le statut du conteneur en cas d'échec. Le contrat 7.3 ne visait que l'aide partagée.
- **S3** : La RPC `ticket_scan` appelée directement avec `replay_only: null` passe en mode normal. La route refuse ce cas et seul `service_role` peut appeler la RPC.
- **S4b** : `csvField` ne neutralise ni une espace ni un saut de ligne en tête de champ, conformément à la liste du contrat (AM1).
- **S5** : `refundable` de la fiche A4 ne contrôle pas le reste à rembourser ; le cas « billet VALIDE sur paiement épuisé » est jugé inatteignable, sans preuve. Le POST recontrôle sous verrou.
- **S1** : `instrumentation.ts` ne refuse pas au démarrage : le refus de `fake` hors développement intervient au premier appel de `getServerEnv()` (prouvé par `fake-prod`).
- **E2** : `CombatFlashOverlay` sur `/partner/scan` reste sous l'en-tête et la navigation, comme avant le lot (le plein écran du contrôleur n'est pas concerné). « statut » de §134 n'est pas une colonne de `audit_logs`.
- **E3** : `/admin/finance` reste hors de la liste des fichiers migrés (A22). Les emoji et textes « CDC » de `/admin/referral` ne sont pas touchés.
- **E4** : Comportements conservés : une panne réseau à la connexion par mot de passe compte comme un échec et rapproche le verrou de 60 s ; sur `/reset-password`, une panne après un `updateUser` réussi affiche une erreur alors que le mot de passe a changé ; `app/forgot-password/page.tsx` ignore le résultat de `verifyOtp` ; `/register` ne prévient pas si le code de parrainage est inconnu. Les codes d'erreur de Supabase Auth traités n'ont pas été vérifiés contre une vraie GoTrue.
- **W8** : Ligne 11 du tableau legacy, T2 : aucun test moderne n'exerce une demande de retrait par un compte CONTROLEUR. Résiduel faible.
- **E2E, D1** : Les événements de `seed:dev` ont lieu dans 3 à 6 semaines : le scan et le guichet ne s'y ouvrent pas (fenêtre de 6 h) ; le guide fait créer un événement du jour. `winget` et `cloudflared` sont absents du poste : le 502 du tunnel sous Windows reste SUPPOSÉ.
- **D2** : Manques de la matrice sans numéro d'anomalie : §84, §101 (fraude, chargeback), §104 (transactions artificielles), §142 (revenu final), §134 (statut). L'annexe de l'audit n'a été lue qu'en version condensée à la découverte.
- **D2** : `docs/recette-billetterie.md` date ses preuves du run 105 (`a03abe6`), pas du run 107. Le code testé a changé entre les deux par `bc864fa` (typographie et un libellé, aucune route) ; la matrice n'a pas été régénérée sur le run 107.
- **Orchestrateur** : À la rédaction, `docs/lot8-logs/ci-run106-run.txt` et les cinq journaux du run 107 sont dans le dossier mais non suivis par git (`git status`).

### 19.4 Captures : défauts laissés après la relecture

La relecture des captures a été faite par des agents, sur des images, pas par un humain (L67). Elle a porté sur les images du run 98, puis une vérification des corrections sur celles du run 105. **Les trois corrections de `bc864fa` (ponctuation en début de ligne, « À compenser » côté partenaire) n'ont pas été revérifiées sur les images du run 107 dans cette partie du rapport** : le code est vu, le rendu non.

**À CORRIGER laissé, écart documenté.** Champs `datetime-local` de `partenaire-categorie-*` en format américain (`mm/dd/yyyy, --:-- --`, `10/26/2026, 01:42 AM`), toutes vues, aux runs 98 et 105. Les champs `type="date"` du même run affichent `dd/mm/yyyy`. Non reproduit sous Windows ; le contrôle CDP ne lit que le premier `input[type="date"]`. Un navigateur réglé en anglais gardera ce format (L66).

**MINEUR laissés, vus sur les images du run 105** (`scratchpad/rap8/verif-releve.md`) :

| Écran | Défaut |
|---|---|
| `aide-transfert`, `mes-billets` | Trois noms pour la même aide : « Aide au transfert » reste sur chaque carte (partiel, voulu pour le sélecteur e2e). |
| `partenaire-inscription`, `-abonnement`, `-profil` | Cloche du visiteur, noms des offres, titre « Page professionnelle » : à confirmer avec le client (partiel). |
| `pilotage-entrees` | « Encaisse- / ments en / attente » coupé à 390 px, comme au run 98. |
| `pilotage-caisse`, `pilotage-equipe` | Onglet voisin qui paraît actif (trait gris), attribué à `hover:` sous le pointeur de capture ; à reconfirmer au doigt. |
| `fiche-barre-achat` | Pavé gris carré derrière la croix de la bulle, en clair ; cause probable le `:hover` de `app/globals.css:563-566`, non prouvée. |
| `mes-billets` | Sur ordinateur, le QR descend sous le pli : 38 px visibles sur 900, contre 112 au run 98 (effet du visuel en 16/9, annoncé). |
| `billet-hors-ligne-*` | Dans le même encadré, un paragraphe centré et un aligné à gauche. |
| `scanner-guichet` | Le bouton « J'ai reçu 5 000 F CFA : valider la… » passe sur 2 lignes et sort de la vue à 390 px ; le point médian reste seul en fin de ligne. |

Le défaut « Créance » côté partenaire, relevé au même endroit, est corrigé par `bc864fa` (`grep -rn Créance app components` ne renvoie plus rien).

**Déjà là au run 98, hors relevé, ni causés ni corrigés** : texte d'exemple coupé sur `mot-de-passe-oublie` et `admin-campagnes` à 390 px ; affiches recadrées sur `partenaire-evenements` ; « à / 18:00 » séparés sur `billet-hors-ligne-*` (ordinateur). **Deux images à ne pas remettre au client en l'état** : `cloche-ouverte` sur ordinateur, où le masque se décale et laisse un vrai QR visible sous le panneau, et `billet-hors-ligne-disponible` et `-a-telecharger` sur mobile, où le pavé de masque recouvre l'en-tête (défaut de capture).

**MINEUR laissés par le correcteur au bilan du run 98** (33 lignes, raisons du correcteur) :

| Écran | Constat | Raison du maintien |
|---|---|---|
| `mes-billets` | Compteur de « Reçus » hors écran à 390 px | indice de défilement présent |
| `mes-billets` | Trois boutons avant le premier billet | réorganisation de l'écran |
| `mes-billets` | Texte d'en-tête sur trois lignes | `PageHeader` partagé |
| `paiement-succes` | « Rester sur cette page » sous la navigation | réordonner la page pendant le décompte |
| `cloche-ouverte` | « est annulé.… » | points de suspension de `line-clamp` |
| `cloche-ouverte` | Chevron visible à côté du panneau | panneau sans voile |
| `accueil-acces-refuse` | Vide sous le message | sans effet sur la lecture |
| `evenement-annule` | Remboursement dit trois fois | la troisième redite vient du jeu d'essai |
| `evenement-annule` | Trait sur l'affiche | image du jeu d'essai |
| Onglets du pilotage | Chevron sur la lettre estompée | dégradé partagé par `ScrollableTabs` |
| `pilotage-entrees` | « Encaisse-ments en attente » | encore là au run 105 (ci-dessus) |
| `pilotage-caisse` | Montant sur 2 lignes | disparu au run 105 |
| `partenaire-equipe` | Nom en double sur mobile | la colonne porte aussi téléphone et droit espèces |
| `partenaire-categorie-canaux` | Ligne d'état mélangée | sans effet sur la lecture |
| `partenaire-categorie-*` | Carte dans une carte | structure du formulaire |
| `partenaire-edition` | Choix verrouillé peu contrasté | style à revoir, non traité |
| `partenaire-rapport-cloture` | Décalage de 3 px | négligeable |
| `partenaire-rapport-cloture` | « CLOTURE- » sans accent | référence, à arbitrer avec A39 |
| `pilotage-rembourser-billet` | « Valable » contre « valides » | libellé de statut partagé |
| `pilotage-annulation` | Bouton sur 2 lignes | sans effet sur l'usage |
| `partenaire-tableau-de-bord` | « Clôture » sur un brouillon | décision de produit |
| `scanner-saisie-manuelle` | Case décochée grise | rendu natif en sombre |
| `scanner-hors-ligne` | Consignes contradictoires | le viseur ne connaît pas l'état du réseau |
| `scanner-a-encaisser` | Bouton sur 2 lignes | lisible, cible large |
| `caisse-cloture-ecart` | Modale sans pied fixe | déplacer les boutons d'un écran de PIN : pas assez sûr pour un mineur |
| `controleur-profil` | Deux flèches de retour | navigation du contrôleur à revoir |
| `admin-notifications` | « Notification en échec », « En attente » | type de l'alerte et état |
| `admin-notifications` | Apostrophe droite | figée par `notif-interface.test.ts:996` |
| `admin-notifications-erreur` | Doublon sur la carte | rendu générique de `DataList` |
| `admin-notifications-erreur` | Icône contre la date | champ natif |
| `admin-remboursements-a-reprendre` | Largeur dictée par le badge | sans effet sur la lecture |
| `admin-fiche-en-attente` | Téléphone brut | formateur local à une autre page |
| `admin-fiche-en-attente` | Lieu et adresse identiques | donnée du jeu d'essai |

**Non capturés, donc non relus** : les deux dialogues du remboursement A4, la liste des paiements en attente de 8.1, quatre des messages de 8.2 j, les canaux sur la fiche admin (hors de la fenêtre capturée), le bas des pages longues et des modales.
