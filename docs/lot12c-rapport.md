# Lot 12c — Commandes : écrans de la partenaire et vérification des produits

Branche `lot12c/partenaire` (worktree `event-village-lot12c`), partie de `main` 953914229a, `main` 774e19a34a (lot 11c-b)
fusionnée en cours de lot. **Non fusionnée dans `main`, aucune migration appliquée** (consigne). Chemins relatifs au
dépôt ; `M/` = `supabase/migrations/`.

> **Correctifs après contre-vérification (27/11)** : section du même nom, en tête ci-dessous. Six trous de l'audit verts,
> sept avis ajoutés, « Remettre en vente », mode comptoir, rappel sonore, rupture en un geste. **Run complet 753 vert sauf
> trois règles du catalogue des avis, corrigées au run rapide 754** ; migration `20261224000005` ajoutée, les cinq
> migrations du lot **non appliquées** ; pas de fusion.

Résultat : **run complet 732** (branche à jour avec `main` 5b7f3399ca) : qualité, e2e, contrôle responsive (247 tests, 0
défaut bloquant, écrans du lot contrôlés et capturés dans les deux thèmes), budgets (toutes les pages budgétées en légère
baisse) et mesure mobile (94 / 91 / 92) verts ; tests 634/636, les deux rouges (contrôles statiques : appel de
`requireActiveSession` dans chaque route, numéros de ligne de la recette) corrigés et **verts au run rapide 734**. Quatre
migrations `20261224000001` à `…04`, **non appliquées**. Une décision à valider : les trois fonctions des réglages ne sont
pas recopiées (voir ci-dessous).

---

## Correctifs après contre-vérification

Consigne « Lot 12c — correctifs après contre-vérification, points ouverts et améliorations » ; audit
`docs/audit-lot12c.md` (branche `lot12c/cv-rouges`, be86be41bc). Les suites rouges de l'audit sont reprises **sans
changer une assertion** (5cf7daefcb), sauf une ligne de préparation de T3 changée sur décision (dbfdbe38a9, ci-dessous).
Migrations `20261224000001` à `…04` **modifiées en place** (jamais appliquées), fonctions nouvelles dans
**`20261224000005_l12c_cv_correctifs.sql`** ; les cinq restent **non appliquées**. Pas de fusion.

Résultat : **run complet 753** (branche à jour avec `origin/main`) : qualité, e2e, responsive (0 défaut bloquant, 84
captures du lot), budgets (+24 octets par page, aucun relevé) et mesure mobile (96 / 92 / 93) verts ; tests 635/638, les
trois rouges (règles du catalogue des avis) corrigés au run rapide 754 (8/8). Les **six trous de l'audit sont verts** (`cv12c-1`
T1 à T6, `cv12c-3` T3b), sans assertion changée.

### Trous de l'audit

| Trou | Correctif | Commit | Preuve (vert au run 753) |
|---|---|---|---|
| T1 (moyenne) mot de la liste contourné par l'écriture (forme décomposée, espace sans chasse, lettre cyrillique, pleine chasse) | une seule fonction de pliage en base, `private.order_text_fold` (NFKC puis accents retirés ; caractères invisibles et de contrôle retirés ; lettres cyrilliques et grecques qui ressemblent à des lettres latines ramenées à celles-ci ; œ, æ, ß, apostrophes) et une seule lecture des mots, `private.order_review_words` (mots tels quels, et lettres isolées recollées : « W.H.I.S.K.Y », « W H I S K Y »). Utilisées à l'enregistrement, pour les suppléments, la catégorie, la revue groupée et le **surlignage, servi par le serveur** (`order_review_marks_many` : plages du texte d'origine ; le pliage côté navigateur est supprimé). « vinaigrette », « gingembre », « G i n g e m b r e » restent non reconnus | dffd6fe10a | `cv12c-1` T1, T1b ; `l12c-cv-correctifs` A |
| T2 (moyenne) décision de l'administration non liée à ce qu'elle a vu | la page envoie la version affichée (`reviewedAt` : date de la demande, ou date de la fiche d'un produit sans demande) ; la route l'exige (`REVIEW_VERSION_REQUIRED`) ; la base refuse une version périmée (`REVIEW_CHANGED`, « Ce produit a changé pendant votre lecture : relisez-le. ») et la page se recharge sur la fiche. Toute modification d'un produit encore « à vérifier » (nom, description, catégorie, photos, supplément ajouté ou renommé) lui donne une nouvelle version. Après une autorisation, les mots vus sont gardés (`review_cleared_words`) : un mot **nouveau** (nom, description, catégorie, supplément) remet « à vérifier » | dffd6fe10a, 19694aaa70 | `cv12c-1` T2 ; B |
| T3 (faible) liste des mots non rétroactive | à **chaque** changement de la liste, et **une fois par la migration** (instruction hors fonction), revue des produits non archivés, non réglementés, non refusés, dont le texte (nom, description, catégorie, suppléments) contient un mot que l'administration n'a pas déjà autorisé : elle **pose seulement** « à vérifier ». **Un seul avis groupé** aux administrateurs `partners.validate` (`ADMIN_PRODUCTS_REVIEW_BATCH`, journal `PRODUCT_REVIEW_BACKFILL`) ; la page montre la dernière revue. Marques dans la liste par défaut (36 mots) : Gazelle, Flag, Castel, 33 Export, Heineken, Guinness, Desperados, Johnnie Walker, Jack Daniel's, Chivas, Smirnoff, Baileys, Martini, Ricard, Marlboro, Dunhill, Camel, Winston. Bouton **« Mettre à vérifier »** de l'administration sur n'importe quel produit en vente (`order_product_review_request`, droit `partners.validate`, motif envoyé à la partenaire et affiché dans la file) | dffd6fe10a, 19694aaa70 | `cv12c-1` T3 ; `cv12c-3` T3b ; C, D |
| T4 (faible) lecture REST de l'état de vérification et de l'archivage | droits par colonne : `SELECT` de la table retiré à `anon` et `authenticated`, puis rendu colonne par colonne **sauf** `review_state`, `review_words`, `review_requested_at`, `review_note`, `review_cleared_words`, `archived_at` (bloc rejouable lu dans `information_schema`). Aucun écran ni code du navigateur ne lit `products` par la REST (contrôlé par E ; vérifié aussi sur `origin/lot12b/client` : seule `app/api/partner/stats`, côté serveur, lit `id, status`). La règle de lignes `products_read` reste au 12b | dffd6fe10a | `cv12c-1` T4 ; E |
| T5 (faible) catégorie au nom d'un mot de la liste | le nom de la catégorie compte ; catégories créées et renommées par la base (`order_category_save`, `POST` et nouveau `PATCH /api/partner/products/categories/[id]`, bouton « Renommer » de « Ma carte ») ; renommer une catégorie avec un mot remet tous ses produits « à vérifier » (avis groupé, origine « catégorie ») ; doublon de nom refusé (`CATEGORY_EXISTS`) | dffd6fe10a, 19694aaa70 | `cv12c-1` T5 ; F |
| T6 (faible) statut d'un produit archivé modifiable | produit archivé **figé** : statut, prix, suppléments, portions refusés (garde de la table, `ProductService.writeProduct`, `product_option_set`, `order_daily_portions_set` recopiée), seule « Remettre en vente » le rouvre | dffd6fe10a, 655cd54609 | `cv12c-1` T6 ; G |

`cv12c-2` (G1 à G8) et `cv12c-3` (S1 à S3) restent verts.

### Points ouverts et améliorations de la consigne

| Point | Fait | Commit | Preuve |
|---|---|---|---|
| 7. Sept avis (P1 à P7 de l'audit) | voir « Avis ajoutés » ci-dessous | 90b5ae2097 | I ; `notif-modeles` (textes exacts), `cv12c-3` S3 |
| 8. Remettre en vente un produit archivé | section « Produits archivés » de « Ma carte » (100 derniers), bouton « Remettre en vente » (`POST /api/partner/products/[id]/restore` → `order_product_save` `restore`) : le produit revient tel qu'il était, revu par la liste (les mots déjà autorisés ne sont pas repris) ; journal `PRODUCT_RESTORED` | dffd6fe10a, 19694aaa70 | G ; capture `catalogue` |
| 9. Commandes à 1 440 px avec le menu | à partir de 1 280 px, colonnes d'au moins 18 rem côte à côte dans une zone qui défile **seule** à l'horizontale (jamais la page), numéro de commande sur une ligne (contrôlé à chaque largeur par le parcours e2e) ; le menu latéral n'est pas replié automatiquement (`AppLayout` interdit) | 19694aaa70 | e2e ; capture `commandes__1440` |
| 10. Mode comptoir | bouton « Mode comptoir » : fenêtre plein écran native (`<dialog>`), sans menu, plein écran du navigateur demandé dans le geste, très grands boutons (64 px), **écran gardé allumé** (Wake Lock) ou message simple « Cet appareil peut se mettre en veille : réglez sa mise en veille sur « jamais » pendant le service. » ; sortie en un geste (« Quitter le mode comptoir », qui sort aussi du plein écran, ou Échap) | 19694aaa70, 519815214e | e2e (ouverture, contrôle responsive, sortie) ; capture `comptoir` |
| 11. Rappel sonore à 5 et 2 minutes | deux notes descendantes (distinctes de l'arrivée d'une commande), vibration, message « Commande A1B2C3 : plus que 5 minutes pour répondre. » ; même interrupteur que le son ; une fois par commande et par seuil | 19694aaa70 | — (son : non testable en CI) |
| 12. Rupture en un geste | « Ma journée » liste les plats du jour encore en vente avec un bouton « Plus de … » (`POST …/portions { soldOut: true }` : portions ramenées à ce qui est déjà vendu, en base sous verrou) ; annulation 6 secondes (les portions d'avant sont remises) | dffd6fe10a, 19694aaa70 | H ; capture `commandes` |

### Avis ajoutés (point 7)

Tous les canaux pour chaque destinataire ; SMS en GSM-7, **un segment au pire cas** (nom d'établissement de 100
caractères avec guillemets, tiret long, accolades, symbole euro ; montant à 7 chiffres ; URL de 28 caractères) ; aucun
mot technique ; chaque avis mène à l'objet. Règle de nuit (1 h – 7 h, `notification_types.night_policy`) : un avis qui
concerne une commande en cours ou prévue dans l'heure part **tout de suite** (code bloqué et rappel de réponse compris) ;
la décision sur un produit, le remboursement bloqué et la revue groupée sont **reportés** à la fin de la plage. Chaque
rappel part une fois par commande (clé de l'avis).

| N° | Type | Destinataire, moment | Canaux, nuit | Texte (cloche, téléphone, email) | SMS au pire cas (septets) |
|---|---|---|---|---|---|
| P1 | `ORDER_CODE_LOCKED` | client, au 5ᵉ essai faux du code (déclencheur sur `orders`, une fois par code) | 4, tout de suite | « Code de remise bloqué — Le code de remise de la commande CMD-261205-A1B2C3 a été mal saisi trop de fois : il ne fonctionne plus. Ouvrez la commande, demandez un nouveau code et donnez-le à la remise. » | « Event Village : code de remise de la commande CMD-261205-A1B2C3 bloqué après trop d'essais. Demandez un nouveau code dans l'application. » (136) |
| P2 | `ORDER_RESPONSE_REMINDER` | partenaire, moins de 5 minutes avant la fin du délai de réponse (`order_reminders`) | 4, tout de suite | « Commande sans réponse — La commande … chez « … » attend votre réponse. Acceptez-la ou refusez-la avant 12:15 : sans réponse, elle est annulée et le client remboursé. » | « Event Village : commande CMD-261205-A1B2C3 toujours sans réponse. Acceptez-la ou refusez-la avant 12:15, sinon elle sera annulée. » (129) |
| P3 | `ORDER_PREP_REMINDER` | partenaire, à l'heure prévue moins la préparation, commande acceptée plus d'une heure avant | 4, tout de suite | « Commande à préparer — La commande … chez « … » est prévue à 12:45 : lancez sa préparation maintenant. Livraison (zone …). » | « Event Village : commande CMD-261205-A1B2C3 prévue à 12:45 : lancez sa préparation maintenant. » (93) |
| P4 | `ORDER_READY_COURIER` | livreur choisi, quand la livraison passe à « prête » (déclencheur sur `orders`) | 4, tout de suite | « Commande prête à livrer — La commande … est prête chez « … » (zone …) : passez la prendre. À la remise, demandez son code au client. » | « Event Village : commande CMD-261205-A1B2C3 à récupérer chez Chez Mame Diarra " Teranga... pour la livrer. Adresse dans l'application. » (133) |
| P5 | `PRODUCT_DECISION_SMS` | partenaire, décision de l'administration (en plus de `PRODUCT_REVIEW_DECIDED`, qui reste sans SMS) | SMS, reporté | — | « Event Village : produit "…" non autorisé à la vente en ligne. Motif dans l'application. » / « … vérifié : il se commande en ligne. » / « … vérifié. Marqué réglementé par vous, il reste sans vente en ligne. » (126 au pire) |
| P6 | `ADMIN_ORDER_REFUND_BLOCKED` | administrateurs `refunds.manage`, remboursement d'une commande bloqué, refusé ou incertain (déclencheur sur `cashouts` ; cloche, téléphone et email partent déjà) | SMS, reporté | — | « Event Village : remboursement de 9 875 000 F CFA de la commande CMD-261205-A1B2C3 bloqué. Reprenez-le depuis les finances. » ; « … refusé par l'opérateur. … » ; « … sans réponse de l'opérateur. Vérifiez-le avant toute reprise. » (≤ 141) |
| P7 | `ORDER_SCHEDULED_REMINDER` | client, 1 heure avant une commande prévue un autre jour que sa transmission | 4, tout de suite | « Votre commande approche — Votre commande … chez « … » est prévue à 12:45. Gardez votre téléphone près de vous et votre code de remise prêt. » (retrait : « Pensez à votre code de remise pour la retirer. » ; sur place : « Présentez-vous à l'heure : elle vous sera servie sur place. ») | « Event Village : rappel, commande CMD-261205-A1B2C3 prévue à 12:45 chez Chez Mame Diarra " Teranga... Gardez votre téléphone près de vous. » (137) |
| T3 | `ADMIN_PRODUCTS_REVIEW_BATCH` | administrateurs `partners.validate`, revue groupée | cloche, email ; reporté | « Produits à vérifier — 12 produits déjà en vente sont à vérifier : la liste des mots a changé. Ils ne se commandent plus en ligne tant que vous ne les avez pas autorisés ou refusés. » | — |
| T3 | `PRODUCT_REVIEW_DECIDED` (branche ajoutée) | partenaire, bouton « Mettre à vérifier » | inchangé | « Produit en vérification — « … » est en vérification par Event Village : il ne se commande plus en ligne jusqu'à la décision. Motif : … Il reste affiché avec son prix sur votre carte. » | — |

Liens : commande du client `/orders/<id>`, de la partenaire `/partner/orders/<id>`, du livreur `/courier/orders/<id>`
(mêmes liens que les avis du 12a ; pages des lots 12b et 12d), produit `/partner/products/<id>`, administration
`/admin/products` et `/admin/finance#versements-a-reprendre`. Les rappels P2, P3, P7 sont posés par
`order_reminders`, appelée par la tâche des commandes (`/api/cron/orders`, toutes les 5 minutes) après `order_tick` ; un
échec des rappels n'empêche pas le reste (journalisé).

### Décisions et écarts

- **Ligne de préparation d'un test d'audit changée (décision du 27/11)** : « Flag » entre dans la liste par défaut, la
  précondition « vendable » de T3 devenait impossible. `tests/audit/cv12c-1-trous.test.ts`, lignes 141, 146, 151, 155
  et 156 : **avant** « Flag spéciale 33 cl » / « flag », **après** « Zorba spéciale 33 cl » / « zorba » ; même scénario,
  même assertion. T5 (« Flag 33 cl ») est inchangé : il est désormais repéré par son nom ; le cas de la catégorie seule
  est prouvé par F.
- La base accepte encore une décision **sans** version quand la fonction est appelée directement (rôle de service
  seulement : tâches et tests du 12a) ; la seule route qui l'appelle exige la version.
- P5 : `PRODUCT_REVIEW_DECIDED` garde ses trois canaux sans SMS (règle S3 de l'audit) ; le SMS part par un type à part.
  P6 : `notif_cashouts_notify` n'est pas recopiée (règle S1 du 12a, et alerte R1 de la contre-vérification de la
  finition 4) ; le SMS part d'un déclencheur à part sur `cashouts`. P1 et P4 : déclencheur à part sur `orders`, aucune
  fonction d'étape du 12a recopiée.
- `order_daily_portions_set` recopiée de `M/20261130000002_l12a_catalogue.sql:318-369`, **lignes ajoutées seulement**
  (refus d'un produit archivé, rupture en un geste) ; déclarée dans `l12c-statique` S1.
- Mode comptoir : une sortie du plein écran par le navigateur (Échap) laisse le mode ouvert (toujours sans menu) ;
  « Quitter » ou un second Échap le ferment. Le lier à la sortie du plein écran le refermait dès l'ouverture dans le
  navigateur des captures (run 743).
- Son des commandes : permis au **clic** et non plus à l'appui. Au premier toucher, « Activer le son » disparaissait
  entre l'appui et le relâchement, la rangée glissait et le geste n'atteignait pas le bouton visé (run 744 : « Mode
  comptoir » jamais ouvert).
- Limite qui reste : un produit dont **seule la photo** montre de l'alcool n'est repéré que par la case de la partenaire
  ou par le bouton « Mettre à vérifier » (reconnaissance d'image hors périmètre ; noté dans `docs/apres-lancement.md`).

### Tests existants modifiés (signalés)

| Fichier | Avant | Après | Raison |
|---|---|---|---|
| `tests/audit/cv12c-1-trous.test.ts:141-156` (T3) | « Flag spéciale 33 cl », mot « flag » | « Zorba spéciale 33 cl », mot « zorba » | décision du 27/11 (ci-dessus) ; assertion inchangée |
| `tests/parcours/l12c-catalogue.test.ts` A | mots trouvés de « Bière Gazelle 65 cl » : `['bière']` | `['bière', 'gazelle']` | marque dans la liste par défaut |
| `tests/parcours/l12c-catalogue.test.ts` C | décisions sans version | `reviewedAt` envoyé (aide `version`) | T2 : version exigée par la route |
| `tests/parcours/l12c-catalogue.test.ts` L | 4 migrations du lot | 5 | migration 20261224000005 |
| `tests/parcours/l12c-statique.test.ts` S1 | 4 recopies | 5 (`order_daily_portions_set`, depuis `M/20261130000002`) | T6, point 12 |
| `tests/parcours/notif-modeles.test.ts`, `notif-outbox.test.ts` (table G2, textes exacts G3) | — | 8 types ajoutés (lignes G2), 16 textes SMS exacts | avis ajoutés ; aucune assertion existante changée |
| `docs/recette-billetterie.md` (lignes citées) | `notif-modeles.test.ts:582` ; `email-regle-envoi.test.ts:118`, `:312`, `:533` | `:591` ; `:121`, `:315`, `:536` | lignes ajoutées avant les tests cités (`recette-matrice` vert en local et au run 757) |
| `tests/parcours/email-regle-envoi.test.ts` (G.49, `G49_EXCLUDED`) | `PUSH_TEST`, `COUNTER_RECEIPT`, `ADMIN_REVIEW_SMS` | + `PRODUCT_DECISION_SMS`, `ADMIN_ORDER_REFUND_BLOCKED` | SMS qui doublent un avis qui a déjà son email (même raison qu'`ADMIN_REVIEW_SMS`, lot 9 quinquies) ; un email de plus serait un doublon |
| `tests/schema/f5-liens-avis.test.ts` (`SANS_OBJET`) | — | + `ADMIN_ORDER_REFUND_BLOCKED` : file « Versements à reprendre » | même lien et même raison qu'`ADMIN_REFUND_TO_RETRY` (aucune fiche par versement) |

### Suite ajoutée

`tests/parcours/l12c-cv-correctifs.test.ts` (base locale, faux SamirPay ; liste et réglages remis à la fin de chaque
test) : A mots déguisés (9 formes), non-repérés (5), marques (9), surlignage servi ; B version exigée, périmée
refusée (supplément, nom), version à jour acceptée, mot nouveau après autorisation (supplément, description) ; C revue
groupée par la liste (un avis groupé, aucun avis par produit, mots déjà autorisés non repris ; produit refusé non
touché) ; D bouton « Mettre à vérifier » (droit, partenaire, motif, avis, double) ; E colonnes illisibles par anon,
autre partenaire et partenaire elle-même, colonnes de la carte lisibles, aucun écran qui lit `products` par la REST ;
F catégories ; G archivé figé (statut, prix, supplément, écriture directe, portions) et remise en vente ; H rupture en
un geste et annulation ; I les 7 avis (une fois chacun), règle de nuit et canaux identiques à la base, SMS au pire cas.
Parcours e2e du lot complété : mode comptoir (ouverture, contrôle responsive, capture, sortie), numéro de commande sur
une ligne à chaque largeur, produits archivés, onglet « Mettre à vérifier ».

### Runs de la contre-vérification

| Run | Commit | Mode | Résultat |
|---|---|---|---|
| 743 | c2425e06e7 | rapide, 25 suites (audit 12c et 12a, lot, avis, design, statut des comptes, remboursements…) + responsive + captures | **23/25** : `cv12c-1`, `cv12c-2`, `cv12c-3` passent au **vert** ; rouges : `l12c-catalogue` G (produit archivé modifiable : `restore` absent lu NULL → **vrai défaut**, corrigé) et `l12c-cv-correctifs` (deux erreurs du test) ; spec e2e du lot : mode comptoir refermé dès l'ouverture |
| 744 | 655cd54609 | rapide, 7 suites + responsive + captures | suites **7/7** ; spec e2e : « Mode comptoir » jamais atteint (son activé à l'appui, la rangée glissait) → corrigé |
| 746 | 815d3d206c | rapide, 2 suites + responsive + captures | suites vertes ; mode comptoir : texte coupé à 390 px (corps de la fenêtre sans défilement) ; `carte-b3` (autre lot) : repère d'une salle non trouvé, vert aux runs 743, 744, 749, 751 et 753 |
| 749 | 25934bfe9c | rapide, 1 suite + responsive + captures | même texte coupé (la fenêtre plein écran du système de design masque son débordement) → fenêtre native |
| 751 | 519815214e | rapide, 1 suite + responsive + captures | **vert** : 0 défaut bloquant, spec du lot vert dans les deux thèmes, 84 captures |
| **753** | **eb0a6a25a2** | **complet** (branche à jour avec `origin/main`) | qualité, e2e, responsive (0 défaut bloquant), budgets et mesure mobile **verts** ; tests **635/638**. Rouges, règles du catalogue des avis : `email-regle-envoi` (G.49 : tout avis indispensable déclare l'email), `f5-liens-avis` (lien vers l'objet exact) pour les deux types SMS qui doublent un avis, et `textes-sms-9bis` (« .... » dans le rappel client, déjà corrigé localement) |
| 754 | b485b9e1c8 | rapide : les 3 suites rouges + `notif-modeles`, `notif-outbox`, `l12c-cv-correctifs`, `cv12c-3`, `cv12a-3` | **vert** : 8/8, typage et lint ; avec le run complet 753, plus aucune suite rouge |

### Poids JavaScript et mesure mobile, avant et après

Avant : run complet 732 (rapport du lot, 6e1ca5f9fb). Après : run complet 753 (eb0a6a25a2). **Aucun budget relevé.**

| Route | Avant (732) | Après (753) | Écart | Budget | Marge |
|---|---|---|---|---|---|
| `/` | 215 534 | 215 558 | +24 | 226 342 | 10 784 |
| `/events/[id]` | 224 474 | 224 498 | +24 | 233 316 | 8 818 |
| `/tickets` | 240 911 | 240 935 | +24 | 250 417 | 9 482 |
| `/controller/scanner` | 225 198 | 225 222 | +24 | 234 911 | 9 689 |
| `/billet/hors-ligne` | 214 148 | 214 172 | +24 | 224 268 | 10 096 |
| `/explore` | 225 887 | 225 911 | +24 | 235 712 | 9 801 |

Aucune page budgétée n'importe de code du lot ; les 24 octets, identiques partout, sont la table des morceaux du
chargeur commun (nouveaux morceaux des pages du lot), non vérifié octet par octet.

Mesure mobile (Lighthouse, médiane de 5 passages, seuil 90, une seule tentative, mesure fiable) :

| Page | Avant (732) | Après (753) | TBT médian avant → après |
|---|---|---|---|
| Accueil | 94 | 96 | 292 → 246 ms |
| Fiche d'un événement | 91 | 92 | 342 → 296 ms |
| Mes billets | 92 | 93 | 356 → 319 ms |

### Captures

Run 753 (et 751), `ci-results`, `runs/<n>/captures-responsive/l12c-<écran>__<largeur>__<thème>.jpg` : **14 écrans × 3
largeurs × 2 thèmes = 84**, chacune après le contrôle responsive (0 défaut bloquant). Ajoutées : `comptoir` (mode
comptoir) et `admin-signaler` (« Mettre à vérifier ») ; `catalogue` montre maintenant les produits archivés et
`commandes` les plats du jour avec « Plus de … ». Relues à l'œil (runs 744, 751, 753) :

- `commandes__1440` : les quatre colonnes, le menu ouvert, la quatrième entamée au bord droit : la zone des colonnes
  défile seule à l'horizontale ; numéros complets sur une ligne (contrôlé à chaque largeur) ;
- `comptoir` : colonnes larges en ordinateur, liste par étape en téléphone, grands boutons, message de mise en veille
  (le navigateur de CI refuse le maintien de l'écran allumé) ;
- **reste visible** : un liseré d'environ 22 px en haut du mode comptoir laisse voir l'en-tête de la page derrière, dans
  les captures seulement à ce jour. L'ancrage explicite de la fenêtre (eb0a6a25a2) ne l'a pas fait disparaître : il
  vient vraisemblablement du plein écran demandé au navigateur sans affichage de la CI ; à vérifier sur une vraie
  tablette (aucune construction locale possible pour le confirmer).

### Autres idées, par valeur

1. **Pause des commandes en un geste** (« Plus de commandes pendant 30 min ») en plein rush : évite les annulations
   sans réponse et les remboursements, sans fermer l'établissement dans les réglages.
2. **Bon de cuisine imprimé** (ticket 58/80 mm) à l'acceptation, avec le numéro court en grand.
3. **Écart entre deux versions** dans « Produits à vérifier » : après « Ce produit a changé pendant votre lecture »,
   montrer ce qui a changé (nom, supplément, photo) plutôt que de tout relire.
4. **Signalement par les clients** (« Signaler ce produit ») qui alimente la file : couvre la limite des photos.
5. **Temps de préparation appris** : proposer à l'acceptation la durée médiane des dernières commandes de
   l'établissement.
6. **Écran de cuisine sans montants** (variante du mode comptoir) pour une tablette posée en cuisine.

---

## À lire en premier

### Migrations (5, intervalle 20261224…, à appliquer dans l'ordre, après celles de `main`)

| Fichier | Contenu |
|---|---|
| `M/20261224000001_l12c_verification.sql` | colonnes `products.review_state`, `review_words`, `review_requested_at`, `archived_at` et `order_delivery_zones.archived_at` ; réglage `orders.review_keywords` (18 mots par défaut) et `order_review_keywords_set` / `_valid` ; aides `private.order_text_fold`, `order_review_words`, `order_catalog_owner`, `order_product_review_notify` ; **recopies** de `product_regulated`, `products_order_guard`, `order_product_regulation_decide` ; nouvelles `order_product_save`, `order_product_remove` ; avis `ADMIN_PRODUCT_REVIEW`, `PRODUCT_REVIEW_DECIDED` |
| `M/20261224000002_l12c_zones_supplements.sql` | `order_delivery_zone_set`, `order_delivery_zone_remove`, `order_delivery_zones_reorder`, `product_option_set`, `product_option_remove` (aucune recopie) |
| `M/20261224000003_l12c_devis.sql` | **recopie** de `order_quote_compute` (produit archivé, produit « à vérifier ») |
| `M/20261224000004_l12c_journee.sql` | `order_partner_day` (« Ma journée », lecture seule ; plats du jour en vente ajoutés aux correctifs) |
| `M/20261224000005_l12c_cv_correctifs.sql` | correctifs de la contre-vérification : revue groupée, « Mettre à vérifier », catégories par la base, surlignage servi, recopie d'`order_daily_portions_set`, avis ajoutés et leurs déclencheurs, `order_reminders`, droits par colonne de `products`, revue des produits existants (instruction hors fonction) |

- Sans `BEGIN` ni `COMMIT`, rejouables (rejouées dans une transaction annulée par `l12c-catalogue`, L) ; fonctions
  publiques au **rôle de service seulement**, aides `private` à **aucun** rôle de l'API (contrôlé par `l12c-statique` S3).
- **Une seule recopie par fonction dans le lot**, depuis sa dernière définition, sans ligne perdue (`l12c-statique` S1) :

  | Fonction | Dernière définition recopiée | Changement |
  |---|---|---|
  | `product_regulated` | `M/20261130000002_l12a_catalogue.sql:86-94` | vrai aussi tant que le produit est « à vérifier » (1 ligne élargie) |
  | `products_order_guard` | `M/20261130000002_l12a_catalogue.sql:96-139` | bloc ajouté : état « à vérifier », mots trouvés et archivage écrits seulement par les fonctions en base |
  | `order_product_regulation_decide` | `M/20261130000002_l12a_catalogue.sql:373-415` | la décision efface l'état « à vérifier », avis à la partenaire (2 lignes élargies) |
  | `order_quote_compute` | `M/20261130000004_l12a_devis_commande.sql:196-456` | 2 refus ajoutés (archivé, à vérifier), aucune ligne retirée |

- **Écart à la consigne, voulu et à valider : `finance_setting_set`, `fin_setting_valid` et `platform_settings_defaults`
  ne sont PAS recopiées.** La suite d'audit `tests/audit/cv12a-3-statique.test.ts` (S1) exige **une seule** recopie de
  ces fonctions après `main` (`lotDefs.length === 1` pour tout fichier ≥ 20261130000001) : les recopier une deuxième
  fois la ferait passer au rouge, et ses assertions ne se changent pas. Même solution que le lot 11c-a
  (`M/20261201000001`) : fonction propre `order_review_keywords_set` (super-administrateur actif, motif historisé par
  `platform_settings_history`, mêmes refus). `platform_settings_defaults` couvre déjà le préfixe `orders`
  (`M/20261130000001_l12a_reglages.sql:226`). Le réglage n'est donc pas modifiable par la page générique des réglages
  (elle ne sert plus cette clé : c'est une liste) mais par la page « Produits à vérifier ».
- **« À vérifier » posé par une fonction en base, pas par un déclencheur sur toute écriture.** Plusieurs suites
  existantes, dont la suite d'audit `cv12a-1-trous` (T2c « Vin de palme », T2d « Bière blonde ») et `l12a-commandes`
  (« Vin rouge », « Bière pression », « Cigarettes »), créent ces produits par une écriture directe du rôle de service et
  attendent qu'ils soient commandables avant de les rendre réglementés : un déclencheur sur toute écriture les ferait
  échouer. L'état est donc posé par `order_product_save` (création et modification d'un produit par sa partenaire) et
  `product_option_set` (supplément), seuls chemins d'écriture de la partenaire ; la garde `products_order_guard` refuse
  à toute autre écriture de poser, d'effacer ou de modifier l'état et l'archivage (testé : écriture directe refusée), et
  `l12c-statique` S4 vérifie qu'aucun code applicatif n'écrit `products` directement, sauf le statut.

### Failles

**Aucune faille de sécurité nouvelle trouvée** dans le code des commandes du lot 12a en le reprenant (routes de la
partenaire, fonctions en base, garde des fiches). Défauts et durcissements traités dans le lot, chacun prouvé par
`l12c-catalogue` :

| Défaut de l'existant | Correction | Preuve |
|---|---|---|
| Supprimer un produit déjà vendu : erreur 500 (clé étrangère `order_items.product_id … ON DELETE RESTRICT`, `M/0001_initial_schema.sql:497`) — relevé par l'état des lieux | `order_product_remove` : archivé (retiré de la carte, gardé dans l'historique) ; un produit jamais vendu est supprimé avec ses suppléments et ses portions (la garde des portions refusait aussi cette suppression) | G |
| Prix d'un produit accepté jusqu'à 100 000 000 F avec des centimes par la route, refusé ensuite par la contrainte de la base (`products_price_franc_chk`) en erreur générique | prix entier de 0 à 10 000 000 F à la route ET en base (`INVALID_PRICE`) | E |
| Coordonnées du client (adresse, téléphone, consignes) servies à la partenaire jusqu'à 7 jours après la remise | servies seulement pendant la commande ouverte (décision du client du 26/11), la base masquant toujours au bout de 7 jours | J |
| Aucun chemin pour écrire zones et suppléments : les seules écritures étaient faites par le rôle de service (tests) | fonctions en base bornées, propriétaire, fiche VALIDE ; écritures REST toujours refusées | H, I, L |
| Contournements possibles du futur « à vérifier » si l'état était écrit par la route | état posé et effacé seulement par les fonctions en base ; la garde refuse toute autre écriture ; un supplément ou une description avec un mot de la liste le pose aussi | B |

### Tests existants modifiés (tous signalés ; aucune suite de `tests/audit/` ni `tests/audit-auth/` touchée)

| Fichier | Avant | Après | Raison |
|---|---|---|---|
| `tests/parcours/partenaire-lot7.test.ts:783` (garde-fou SCENARIO 15) | exige `import { usePartnerOrders } from 'hooks/usePartnerOrders'` dans le tableau de bord | exige **l'absence** de cet import et la lecture de `/api/partner/orders/day` et `/api/partner/orders?filter=open` | consigne (point 6) : la partenaire ne lit plus les commandes par REST depuis le 12a, le crochet ne rendait plus rien ; il est supprimé |
| `tests/parcours/partenaire-lot7.test.ts:926` (A21) | « le code mentionne toujours Realtime ou connected » (mot lu de `usePartnerOrders`) | la carte des commandes dit l'heure de sa dernière mise à jour (`openOrders.updatedAt`, `formatTime(...)`) | plus de temps réel des commandes pour la partenaire |
| `tests/schema/f3b-ecrans.test.ts` (menu de l'administration) | `partners.validate` → aucune entrée ; liste exacte du SUPERADMIN sans `/admin/products` | `partners.validate` → `/admin/products` ; `/admin/products` ajouté après `/admin/halls` | entrée « Produits à vérifier » ajoutée au menu (sinon la page n'est atteignable que par les avis) |
| `tests/parcours/notif-modeles.test.ts`, `tests/parcours/notif-outbox.test.ts` (table G2 du contrat) | — | 2 lignes ajoutées : `ADMIN_PRODUCT_REVIEW`, `PRODUCT_REVIEW_DECIDED` | nouveaux types d'avis (même pratique que les lots 11c-a et 12a) ; aucune assertion existante changée |

### Fichiers partagés touchés

- `lib/orders/booking.ts` : **ajouts seulement** (fin du fichier : `ORDER_CLOSED_STATES`, `partnerOrderView`). Le code de
  refus `PRODUCT_UNDER_REVIEW` (devis) prend le statut par défaut de `orderRefusalStatus` (409) : je n'ai pas modifié son
  `switch` (« ajouts seulement ») ; le 12b peut l'ajouter aux 400 s'il le souhaite.
- `lib/notifications/catalog.ts`, `catalog-types.ts`, `outbox-labels.ts` : 2 types ajoutés.
- `lib/device/device-prefs.ts` : préférence du son des commandes (clé sous `event-village:appareil:`, effacée à la
  déconnexion comme les autres ; seul fichier où une écriture du stockage est admise par `cvf2b-6`). Conflit de fusion
  avec le 11c-b réglé en gardant les deux blocs.
- `components/layout/admin-nav.ts` (menu de l'administration, chargé à la demande, hors des pages budgétées).
- `app/api/admin/finance-settings/route.ts` : ne sert plus `orders.review_keywords`.
- `app/api/partner/orders/route.ts`, `app/api/partner/orders/[id]/route.ts` : coordonnées du client retirées d'une
  commande terminée ; `onsiteAmount` dans la réponse d'une action.
- `lib/products/product.service.ts` : création, modification, retrait par les fonctions en base ; « épuisé » admis à la
  main ; prix entier ≤ 10 000 000 ; établissement à la création seulement.
- `tests/helpers/design-files.ts`, `e2e/support/responsive-pages.ts` : écrans du lot.
- **Non touchés** (consigne) : `app/orders/**`, `app/restaurants/**`, `app/api/orders/route.ts`,
  `private.order_issue_code`, `products_read`, `components/layout/AppLayout.tsx`.

### Pour le lot 12b (en parallèle)

- Le menu public du 12b doit exclure les produits **archivés** (`products.archived_at IS NOT NULL`) et montrer les
  produits « à vérifier » comme non commandables : `product_regulated` les dit déjà réglementés, et le devis refuse avec
  `PRODUCT_UNDER_REVIEW` (« … est en cours de vérification par Event Village : il ne se commande pas encore en ligne. »).
- Zones : `order_delivery_zones.archived_at` (zone retirée qui a servi) ; ne proposer que `is_active AND archived_at IS NULL`.
- **Correctifs (T4)** : `anon` et `authenticated` ne lisent plus par la REST `products.review_state`, `review_words`,
  `review_requested_at`, `review_note`, `review_cleared_words` ni `archived_at` (droits par colonne) ; un
  `select('*')` sur `products` avec la clé publique ou le jeton d'un compte est désormais refusé. Lire ces colonnes côté
  serveur (rôle de service), comme le fait déjà `app/api/restaurants/[id]/menu`.

---

## Écrans livrés

Tous derrière l'interrupteur `features.orders_enabled` (layouts de garde existants), sauf la page de l'administration.
Jetons du système de design seulement (contrôle `design-systeme`, 889 cas verts en local), aucun montant calculé dans le
navigateur, refus du serveur affichés tels quels, animations 150-300 ms en `motion-safe:` (coupées si « réduire les
animations »), cibles tactiles de 44 px au moins.

| Adresse | Contenu |
|---|---|
| `/partner/products` | « Ma carte » : choix de l'établissement (puces), grille de cartes (photo ou illustration, prix en grand, pastilles de disponibilité, « Plat du jour » avec la jauge des portions du jour mis en tête, « Réglementé » et sa sorte, « En vérification » avec la raison, « Refusé à la vente »), filtres par catégorie, état vide illustré « Ajoutez votre premier plat », changement rapide de disponibilité (disponible, indisponible, épuisé, suspendu), « Retirer » (supprimé s'il n'a jamais été vendu, archivé sinon : la fenêtre le dit avant), bandeaux (fiche suspendue en lecture seule, établissement en attente de validation, commandes fermées, produits en vérification) |
| `/partner/products/new`, `/partner/products/<id>` | formulaire : établissement choisi à la création puis verrouillé (« L'établissement ne change pas »), photo, nom, description, catégorie (création sur place), prix entier, suivi du stock, plat du jour et portions du jour (vendues / servies par la base), case « réglementé » avec l'explication AVANT de cocher et la sorte, suppléments (ajout, prix, masquer, retirer), aperçu « vue client » ; produit d'une autre partenaire ou archivé : « Cet élément n'est plus disponible » |
| `/partner/products/vente` | « Réglages de vente » par établissement : ouvert à la commande, modes (livraison, retrait, sur place avec la liste des tables de l'établissement et un lien pour les gérer), acompte (10 à 90 %, défaut de la plateforme rappelé), paiement à la remise, préparation (10 à 240 min) ; zones de livraison en liste (nom, frais, minimum, active, ordre par glisser au doigt ou à la souris, et boutons « Monter » / « Descendre » au clavier), retrait expliqué (supprimée, désactivée car une commande en cours l'utilise, ou retirée) |
| `/partner/orders` | « Commandes » : relecture de la route serveur toutes les 5 s **tant que la page est visible** (arrêt quand elle est cachée, relecture au retour) — plus aucun temps réel REST ; « Ma journée » (commandes du jour, à accepter, recette du jour avec la part payée en ligne et sur place, plats bientôt épuisés), servie par la base ; colonnes Reçues / En préparation / Prêtes / En route sur tablette et ordinateur, onglets avec compteurs sur téléphone ; une carte par commande (numéro en grand, mode, lignes, montant servi, heure demandée mise en avant pour une commande pour plus tard), qui glisse d'une colonne à l'autre ; nouvelle commande : courte animation, halo, **son** (Web Audio, après un premier toucher comme l'exige le navigateur ; bouton pour couper, préférence gardée sur l'appareil) et **vibration** ; compte à rebours des 15 minutes en anneau, vert → orange (5 min) → rouge (2 min) avec le texte (« Répondez tout de suite »), annoncé aux changements de palier seulement ; onglet « Terminées » ; bandeau de lecture seule d'une fiche suspendue |
| `/partner/orders/<id>` | fiche : étapes avec heures, lignes et suppléments, consignes, montants servis (articles, livraison, total, payé, reste à encaisser, remboursé), heure demandée et estimée, mode, zone ou table ; coordonnées du client **seulement pendant la commande ouverte** (« masquées une fois la commande terminée » ensuite) ; actions selon l'état : accepter (minutes), refuser (motif envoyé au client), préparer, prête, confier à un livreur actif ou « Je livre moi-même », partir, remettre (code en **4 grandes cases**, essais restants, blocage expliqué, « Reste reçu en espèces » avec le montant servi ; vibration au bon code, coche animée), annuler (motif) ; commande absente ou d'une autre partenaire : « Cet élément n'est plus disponible » |
| `/partner/orders/livreurs` | inviter par numéro, invitations (nom masqué avant l'accord), livreurs actifs, retirer (fenêtre : ses livraisons pas encore parties lui sont retirées) |
| `/partner/dashboard` | carte « commandes » lue par `/api/partner/orders/day` et `/api/partner/orders` (relue toutes les 30 s pendant la visibilité), heure de mise à jour ; `hooks/usePartnerOrders.ts` supprimé |
| `/admin/products` (menu « Produits à vérifier », droit `partners.validate`) | file des produits à vérifier et des produits marqués « réglementé » sans décision : photo, texte et suppléments avec **les mots trouvés surlignés** (même règle que la base : sans accents, début de mot, pluriel), établissement, partenaire, date ; « Autoriser à la vente » / « Refuser à la vente » avec motif (fenêtre qui dit les conséquences) ; historique des décisions ; liste des mots (modifiable par un super-administrateur, avec motif) ; `?produit=<id>` (lien de l'avis) met la carte en vue |

## Serveur ajouté

| Route | Fonction en base | Règles |
|---|---|---|
| `GET /api/partner/catalog` | — (rôle de service, partenaire de la session) | établissements (réglages, zones non archivées, tables actives), catégories, produits non archivés avec suppléments, portions du jour, « réglementé », décision, « à vérifier » ; état de la fiche |
| `POST /api/partner/products`, `PATCH /api/partner/products/[id]` | `order_product_save` | liste blanche (zod) puis la base : fiche VALIDE (SUSPENDU : lecture seule), établissement de la partenaire, choisi à la création et jamais changé (`VENUE_LOCKED`), catégorie de la partenaire, prix entier 0 à 10 000 000, stock entier, 10 images au plus, sorte exigée si « réglementé » ; « à vérifier » posé quand un mot de la liste apparaît dans le nom ou la description (jamais effacé par une modification) ; avis aux administrateurs |
| `GET /api/partner/products/[id]` | — | produit complet ; archivé ou d'une autre : 404 |
| `DELETE /api/partner/products/[id]` | `order_product_remove` | jamais vendu : supprimé avec suppléments et portions ; vendu : archivé (avant : erreur 500 de clé étrangère) |
| `POST /api/partner/products/[id]/status` | (écriture du statut) | « épuisé » admis à la main |
| `GET/POST /api/partner/products/categories` | — | 2 à 60 caractères, 50 au plus, nom déjà pris : la catégorie existante |
| `POST /api/partner/products/[id]/options`, `PATCH`/`DELETE …/options/[optionId]` | `product_option_set`, `product_option_remove` | prix entier 0 à 1 000 000, 20 au plus, produit de la partenaire non archivé ; nom avec un mot de la liste : produit « à vérifier » ; le prix figé des lignes ne change jamais |
| `POST/PUT /api/partner/venues/[id]/zones`, `PATCH`/`DELETE …/zones/[zoneId]` | `order_delivery_zone_set`, `order_delivery_zones_reorder`, `order_delivery_zone_remove` | nom 2 à 80 caractères (unique dans l'établissement), frais entiers 0 à 100 000, minimum entier 0 à 10 000 000, 50 zones ; retrait : supprimée, désactivée si une commande ouverte l'utilise, archivée si seules des commandes terminées l'ont utilisée ; ordre complet exigé |
| `GET /api/partner/orders/day` | `order_partner_day` | jour de Dakar ; jamais une commande non transmise ; état de la fiche |
| `GET /api/partner/orders`, `GET /api/partner/orders/[id]` | `order_partner_list`, `order_view` (12a, inchangées) | coordonnées retirées d'une commande terminée (`contactHidden`) |
| `GET /api/admin/products/review` | — | droit `partners.validate` ; file, historique (journal `PRODUCT_REGULATION_DECIDED`), liste des mots |
| `POST /api/admin/products/[id]/regulation` | `order_product_regulation_decide` (recopiée) | la décision efface « à vérifier » ; avis `PRODUCT_REVIEW_DECIDED` |
| `PUT /api/admin/products/keywords` | `order_review_keywords_set` | super-administrateur ; 1 à 100 mots distincts (une fois pliés), 2 à 40 caractères ; motif |

Avis : `ADMIN_PRODUCT_REVIEW` (administrateurs `partners.validate`, cloche et email, reporté la nuit, lien
`/admin/products?produit=<id>`) ; `PRODUCT_REVIEW_DECIDED` (partenaire, cloche, notification du téléphone et email, lien
`/partner/products/<id>`, texte selon la décision et la case de la partenaire). Aucun SMS.

Garde des fiches suspendues : chaque écriture ajoutée est sous `/api/partner/products/*` ou `/api/partner/venues/*`,
déjà refusées à une fiche SUSPENDU par `partnerEventWrite` (`l12c-statique` S5) ; les fonctions en base refusent aussi
(`PARTNER_SUSPENDED`).

## Tests et accès

### Suites ajoutées

`tests/parcours/l12c-statique.test.ts` (sans base) :

| | Contrôle |
|---|---|
| S1 | 4 recopies, **une seule fois chacune** dans le lot, aucune ligne perdue de leur dernière définition (lignes élargies déclarées une à une) — sortie `[L12C-S1] aucune ligne perdue` |
| S2 | non recopiées : `finance_setting_set`, `fin_setting_valid`, `platform_settings_defaults`, `order_partner_action`, `order_view`, `order_partner_list`, `order_create`, `private.order_issue_code` ; règle `products_read` non touchée |
| S3 | sans `BEGIN`/`COMMIT` ; chaque fonction publique retirée à `PUBLIC, anon, authenticated` et donnée au seul rôle de service ; chaque aide `private` retirée à tous, rôle de service compris, jamais donnée ; `search_path` fixé partout |
| S4 | aucune écriture directe de `products` dans `app/` et `lib/`, sauf le statut (`writeProduct`) ; création, modification, retrait par `order_product_save` / `order_product_remove` |
| S5 | chaque écriture ajoutée est refusée à une fiche SUSPENDU par la garde de la fiche ; `catalog` et `orders/day` sont des lectures |
| S6 | les 2 avis ont dans le catalogue les canaux, le public, la politique, le droit et la règle de nuit de la base |

`tests/parcours/l12c-catalogue.test.ts` (base locale, faux SamirPay ; montants attendus calculés à la main) :

| | Ce qui est essayé | Attendu |
|---|---|---|
| A | « Bière Gazelle 65 cl » par la route ; 7 noms et descriptions (« BIERES fraîches », « Vin de palme », « vinaigrette », « gingembre », « WHISKY » dans la description, « l'alcool », « Chicha et cigarettes ») | état posé, mots trouvés exacts, « vinaigrette » et « gingembre » non ; administrateur `partners.validate` prévenu (cloche, email) ; devis et création refusés `PRODUCT_UNDER_REVIEW` |
| B | renommer sans le mot, champ `review_state` dans le corps, statut changé deux fois, écriture directe de l'état et de l'archivage, supplément « Bière en plus » sur un plat propre, description modifiée avec « vin » | l'état reste ; `FIELD_NOT_EDITABLE` ; écritures directes refusées par la base ; supplément → « à vérifier », devis refusé ; modification → « à vérifier » |
| C | décision sans droit, sans motif, puis « autoriser », puis « refuser » une autre bière et la renommer | 403, `REASON_REQUIRED` ; autoriser : état effacé, commandable, partenaire prévenue (cloche, push, email, `AUTORISE`), historique ; refuser : `REGULATED_PRODUCT`, même renommé |
| D | commande payable à la remise, produit renommé avec « bière » avant l'acceptation ; commande à payer, supplément « Rhum » ajouté avant le paiement | acceptation refusée `REGULATED_ORDER_REFUSED`, commande refusée ; paiement refusé |
| E | prix 2 500,5 / 10 000 001 / −1, prix 2,5 en base, stock −3, « réglementé » sans sorte, établissement d'une autre partenaire, changement d'établissement (route et base), produit d'une autre (lecture, modification, retrait) | tous refusés (`INVALID_INPUT`, `INVALID_PRICE`, `REGULATED_KIND_REQUIRED`, `VENUE_NOT_FOUND`, `FIELD_NOT_EDITABLE`, `VENUE_LOCKED`, 404) ; prix inchangé |
| F | fiche SUSPENDU (remise VALIDE dans un `finally`) : création, supplément, zone par les routes ; enregistrement, zone, supplément, retrait par la base | routes 403 `PARTNER_SUSPENDED` ; base `PARTNER_SUSPENDED` ; catalogue et journée lisibles (`partnerStatus` SUSPENDU) ; produit inchangé |
| G | retrait d'un plat du jour jamais vendu (supplément, portions) ; retrait d'un plat vendu | supprimé avec suppléments et portions ; vendu : archivé, ligne de commande gardée, devis `PRODUCT_UNAVAILABLE`, hors catalogue, 404, modification `PRODUCT_ARCHIVED` |
| H | supplément à 1 000 001, −1, 2,5, « beaucoup » ; supplément sur le produit d'une autre ; commande avec « Frites » à 300 F puis prix passé à 900 F ; 21e supplément | refusés ; 404 ; ligne figée (4 300 / 8 600 F, option à 300 F), nouveau devis à 4 900 F ; `TOO_MANY_OPTIONS` |
| I | zones : nom d'une lettre, frais 100 001 / 2,5 / −5, minimum 10 000 001, établissement d'une autre, nom en double ; devis sous le minimum puis au-dessus ; frais changés après une commande ; retrait d'une zone d'une commande ouverte, puis après la fin de la commande, puis d'une zone jamais servie ; ordre complet puis partiel | refusés (`INVALID_ZONE`, `INVALID_FEE`, `INVALID_MINIMUM`, `VENUE_NOT_FOUND`, `ZONE_EXISTS`) ; `BELOW_MINIMUM` puis 10 000 + 1 500 = 11 500 F ; frais figés à 1 500 F ; `DEACTIVATED` (zone plus proposée), `ARCHIVED`, `DELETED` ; ordre suivi, ordre partiel `INVALID_ORDER` |
| J | acompte 5 / 95 / 33,5 % puis 40 % ; commande non payée ; commande sur place payable à la remise avec téléphone, puis remise ; livreur d'une autre partenaire ; code de remise faux cinq fois puis bon | acompte refusé, puis 4 000 / 6 000 F sur 10 000 F ; commande non payée absente de la liste et 404 ; téléphone pendant la commande ouverte, plus après (`contactHidden`, aussi dans la liste des terminées) ; journée +1 remise, +5 000 F, +5 000 F sur place ; `COURIER_NOT_FOUND` ; essais restants 4, 3, 2, 1, puis blocage, bon code refusé `CODE_LOCKED` |
| K | liste des mots : page générique des réglages, administrateur sans le rôle, valeurs invalides (1 lettre, doublon après pliage, vide, 101 mots, nombre, « ; », texte seul), sans motif, puis ajout de « bissap fermenté » | absente de la page générique ; 403 ; `INVALID_VALUE` ; `FORBIDDEN` ; `REASON_REQUIRED` ; produit suivant « à vérifier » avec ce mot ; motif historisé ; liste remise dans un `finally` |
| L | les 4 migrations rejouées (transaction annulée) après un réglage changé ; fonctions et tables par la session du navigateur | aucune erreur, réglage gardé, droits inchangés ; 10 fonctions refusées à la session, aucune écriture REST des zones, suppléments ni produits |

### Runs

| Run | Commit | Mode | Résultat |
|---|---|---|---|
| 725 | d6a389cbfd | rapide, 106 suites qui citent les tables, écrans et avis touchés | 103/106 : table G2 des avis (notif-modeles, notif-outbox) et `{x.error.message}` rendu (design1b-mots) → corrigés ; `l12c-catalogue` (12 groupes) et `l12c-statique` verts du premier coup |
| 726 | 9c8ca6a3fe | rapide, 19 suites + responsive + captures + mesure | suites vertes ; responsive : thème clair du spec du lot vert (36 captures), thème sombre refusé à la connexion (429, limite par adresse) → une seule connexion ; mesure faussée (machine trop rapide) |
| 730 | 261a369cfa | rapide, 3 suites + responsive + captures | **vert** : 247 tests du responsive, 196 résultats sans défaut bloquant, spec du lot vert dans les deux thèmes, 72 captures |
| **732** | **6e1ca5f9fb** | **complet** (branche à jour avec `main` 5b7f3399ca) | qualité verte ; tests **634/636** ; e2e vert (toutes les phases) ; responsive vert (247 tests, 0 défaut bloquant) ; budgets et mesure mobile verts. Rouges : `statut-compte` (les 7 routes du lot appelaient `requireActiveSession` par l'aide commune, la règle du lot 1B.6 exige l'appel dans chaque fichier) et `recette-matrice` (trois numéros de ligne cités par la recette, décalés par les ajouts du lot) |
| 734 | 256da29e82 | rapide : les 2 suites rouges + `l12c-catalogue`, `l12c-statique`, `f2acv-ecritures-fiche`, `interrupteurs` | **vert** : 6/6, typage et lint ; avec le run complet 732, plus aucune suite rouge |

En local (sans base) pendant le lot : typage, lint, `design-systeme` (889 cas), `design1c-responsive`, `design1b-mots`,
`l12c-statique`, `cv12a-3-statique`, `cv11cb-3-statique`, `cv11cc-3-statique`, `cvcb3-3-statique`, `f3b-ecrans`,
`recette-matrice`, `statut-compte` (partie statique) verts.

Suites d'audit : aucune modifiée ; toutes celles qui citent les tables touchées tournent dans les runs ci-dessus et au run
complet (`cv12a-1`, `cv12a-2`, `cv12a-3`, `cv11a-4`, `cv11a-5`, `cvcb-3`, `cvf2b-6`, `cvf4-*`, `cv9qq-4`…), vertes.

## Poids JavaScript et mesure mobile, avant et après

Octets gzip du premier chargement des pages budgétées (`js-budget.tsv`). Avant : run complet 723 (contenu de `main`
après la fusion du 11c-b, 4b47cf1361). Après : run complet 732 du lot (6e1ca5f9fb). **Aucun budget relevé.**

| Route | Avant (723) | Après (732) | Écart | Budget | Marge |
|---|---|---|---|---|---|
| `/` | 215 613 | 215 534 | −79 | 226 342 | 10 808 |
| `/events/[id]` | 224 570 | 224 474 | −96 | 233 316 | 8 842 |
| `/tickets` | 241 692 | 240 911 | −781 | 250 417 | 9 506 |
| `/controller/scanner` | 225 297 | 225 198 | −99 | 234 911 | 9 713 |
| `/billet/hors-ligne` | 214 237 | 214 148 | −89 | 224 268 | 10 120 |
| `/explore` | 226 459 | 225 887 | −572 | 235 712 | 9 825 |

Aucune page budgétée n'importe de code du lot ; la baisse vient du découpage des morceaux partagés par webpack après la
suppression de `hooks/usePartnerOrders.ts` et du client temps réel des commandes (non vérifié module par module).

Mesure mobile (Lighthouse, médiane de 5 passages, seuil 90) :

| Page | Avant (723) | Après (732) | TBT médian avant → après |
|---|---|---|---|
| Accueil | 93 | 94 | 307 → 292 ms |
| Fiche d'un événement | 93 | 91 | 279 → 342 ms |
| Mes billets | 91 | 92 | 372 → 356 ms |

La fiche perd 2 points sur une page que le lot ne touche pas (aucun octet de plus, −96 octets) : variation de la machine
de CI (règle de la mesure mobile : rien à reprendre). Le run rapide 726 avait une mesure faussée (machine trop rapide,
ralentissement ×6,7 à ×7,2) : non retenue.

## Captures

Publiées sur la branche `ci-results` (`runs/<n>/captures-responsive/l12c-<écran>__<largeur>__<thème>.jpg`), 12 écrans ×
3 largeurs (390, 768, 1 440 px) × 2 thèmes = 72 captures par run, chacune après le contrôle responsive (0 défaut
bloquant) : `commandes` (téléphone : onglets ; tablette et ordinateur : colonnes), `commande-recue` (anneau, « Accepter »),
`saisie-code` (4 grandes cases, « reste à encaisser »), `livreurs`, `catalogue`, `produit` (suppléments, aperçu « vue
client »), `produit-verification`, `nouveau-produit`, `reglages`, `zones`, `tableau-de-bord`, `admin-produits` (mots
surlignés).

Relues à l'œil pendant le lot (run 726, thème clair ; run 730, thème sombre) ; corrigé après lecture : boutons des cartes
de commande trop serrés dans les colonnes de la tablette (empilés), choix de disponibilité tronqué sur la carte du plat du
jour, « 1 remises », « minimum aucun ». Reste visible et accepté : à 1 440 px avec le menu latéral, les quatre colonnes
sont étroites (le numéro complet de la commande passe sur deux lignes) ; le numéro court reste en grand.

## Essais pour un non-développeur

Sur un projet où les migrations du lot sont appliquées, service des commandes ouvert (Réglages de la plateforme →
« Commandes de repas »), avec un compte partenaire validé qui a un établissement validé.

1. **Ma carte** (menu « Produits et menu ») : ajouter un plat « Yassa poulet », 3 500 F, avec la photo. Il apparaît dans
   la grille avec son prix en grand. Ajouter le supplément « Frites » à 500 F.
2. **Produit à vérifier** : ajouter « Bière Gazelle ». Après l'enregistrement, un bandeau bleu « En vérification par
   Event Village » explique que le mot « bière » demande une vérification. Le renommer « Gazelle » : le bandeau reste.
3. **Côté administration** (menu « Produits à vérifier ») : la bière y est, le mot « Bière » surligné. « Refuser à la
   vente », motif « Boisson alcoolisée ». Côté partenaire, une notification arrive ; la carte affiche « Refusé à la
   vente » ; le produit reste affiché avec son prix mais ne se commande pas.
4. **Réglages de vente** : ouvrir la commande, cocher Livraison et Retrait, acompte 40 %. Essayer 95 % : refus en clair
   (« L'acompte est compris entre 10 et 90 % »). Ajouter les zones « Almadies » (1 500 F, minimum 5 000 F) et
   « Mermoz » ; les réordonner en les faisant glisser.
5. **Commandes** (menu « Commandes ») sur une tablette posée au comptoir : toucher l'écran une fois (le son s'active).
   Depuis un autre téléphone, passer une commande « à payer à la remise » : une carte arrive avec un halo et un son,
   l'anneau vert compte les 15 minutes. Toucher « Accepter », puis « Commencer la préparation », puis « Marquer prête » :
   la carte change de colonne.
6. **Remise** : le client reçoit un code par SMS. Ouvrir la commande, taper un faux code : « Code incorrect. Il reste 4
   essais. » Taper le bon code, cocher « Reste reçu en espèces » : coche animée, commande remise ; ses coordonnées
   disparaissent de la fiche.
7. **Livreurs** (bouton depuis les commandes) : inviter un numéro de téléphone qui a un compte ; l'invitation apparaît
   avec un nom masqué jusqu'à l'accord.
8. **Retirer un produit** : retirer un plat jamais commandé (il disparaît) ; retirer un plat déjà vendu : il est archivé
   (il disparaît de la carte et reste dans l'historique des commandes).
9. **Fiche suspendue** (par l'administration) : la carte, les réglages et les commandes restent visibles avec un bandeau
   jaune, sans bouton d'enregistrement ; toute action est refusée.

## Autres idées

Liste du rapport du lot, gardée telle quelle : la revue après un changement de la liste, le mode comptoir, la rupture
en un geste, le rappel sonore et l'archive avec « Remettre en vente » sont **faits aux correctifs** (section en tête, avec
les nouvelles idées classées par valeur).

- **Revue de la carte après un changement de la liste des mots** : un bouton « Revoir les produits existants » dans la
  page de l'administration (aujourd'hui seuls les produits enregistrés ensuite sont comparés : `docs/apres-lancement.md`).
- **Mode comptoir** plein écran de l'écran des commandes (sans menu, grands boutons, écran gardé allumé par l'API Wake
  Lock) pour une tablette posée en permanence.
- **Impression du bon de cuisine** (format ticket 58/80 mm) à l'acceptation d'une commande.
- **Rupture en un geste** depuis « Ma journée » : « Plus de Thiéboudienne » met le plat du jour à zéro portion.
- **Temps de préparation appris** : proposer à l'acceptation la durée médiane des dernières commandes de l'établissement.
- **Statistiques** (lot 12e) : plats les plus vendus, heures de pointe, part payée en ligne et sur place.
- **Rappel sonore** d'une commande reçue sans réponse à 5 et 2 minutes de la fin du délai (en plus de l'anneau).
- **Archive** des produits retirés, avec « Remettre en vente » (décision du client à prendre).
