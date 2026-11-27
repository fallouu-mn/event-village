# Contre-vérification du lot 12c — commandes : partenaire et vérification des produits

Contre-vérification indépendante de la branche `origin/lot12c/partenaire` (0a0997d464, rapport `docs/lot12c-rapport.md`,
état des lieux `docs/lot12-etat-des-lieux.md` sur `etat/lot12`). Tests sur la branche **`lot12c/cv-rouges`** (partie de
0a0997d464, **jamais fusionnée**) : un test rouge = un trou ouvert, vert = attaque bloquée. Base LOCALE de la CI
seulement : aucun appel au projet distant, aucune migration appliquée, branche du lot et branche du 12b non touchées.
Chemins relatifs au dépôt ; `M/` = `supabase/migrations/`.

Suites ajoutées (`ci-rapide`) :

| Suite | Contenu | Attendu |
|---|---|---|
| `tests/audit/cv12c-1-trous.test.ts` | T1 à T6 | rouges sur la branche du lot |
| `tests/audit/cv12c-2-gardes.test.ts` | G1 à G8 | verts |
| `tests/audit/cv12c-3-statique.test.ts` | T3b (rouge), S1 à S3 (verts) | sans base |

Runs rapides (branche `lot12c/cv-rouges`) :
- **run 736** (ef632a76a9, les trois suites) : `cv12c-1-trous` 0/7 (T1a, T1b, T2 à T6 rouges pour la bonne raison) ;
  `cv12c-3-statique` 8/9 (seul T3b rouge, voulu) ; `cv12c-2-gardes` 6/8 — G5 et G8 en échec par **erreurs de mon test**
  (réponse lue deux fois ; paiement attendu en 200 alors que la route rend 201), aucune assertion de sécurité en cause ;
- **run 739** (commit suivant, garde-fous seuls, corrections de test sans changement d'assertion) : `cv12c-2-gardes`
  **8/8 verts**.

---

## 1. Verdict

**Le lot 12c tient ses promesses d'argent et d'accès, mais la vérification des produits se contourne.** Six trous,
tous prouvés rouges pour la bonne raison au run 736 : deux moyens (T1, T2) et quatre faibles (T3 à T6). À corriger
avant la fusion : T1 et T2 (ils rendent vendable en ligne un alcool, ce que le client interdit), T6 (une ligne) ; T3,
T4 et T5 demandent une décision (client pour T3 et T5, partage avec le 12b pour T4).

| N° | Gravité | Trou | Test |
|---|---|---|---|
| T1 | moyenne | « À vérifier » contourné par l'écriture du mot : lettres séparées (« W.H.I.S.K.Y », « W H I S K Y »), accent décomposé, espace invisible, lettre cyrillique, pleine chasse | `cv12c-1-trous` T1a, T1b |
| T2 | moyenne | La décision de l'administration n'est pas liée au texte qu'elle a vu : un texte changé entre la file et « Autoriser » devient vendable sans avoir été vu | `cv12c-1-trous` T2 |
| T3 | faible | Un mot ajouté à la liste ne s'applique pas aux produits déjà en vente ; la migration ne revoit pas les produits existants | `cv12c-1-trous` T3, `cv12c-3-statique` T3b |
| T4 | faible | La clé anon et toute partenaire lisent par la REST l'état « à vérifier », les mots trouvés et l'archivage des produits d'autrui | `cv12c-1-trous` T4 |
| T5 | faible | Une catégorie « Bières et alcools » ne met pas ses produits à vérifier | `cv12c-1-trous` T5 |
| T6 | faible | Le statut d'un produit archivé se change encore | `cv12c-1-trous` T6 |

Aucun trou critique ni élevé : aucun chemin ne fait **payer** un produit déjà marqué « à vérifier » ou réglementé (devis,
création, paiement, acceptation et remise refusent : G2 et tests du lot), aucune écriture d'autrui, aucune fuite du code
de remise, aucun mouvement d'argent sur le « reste reçu ».

---

## 2. Trous, par gravité

### T1 (moyenne) — « À vérifier » contourné par l'écriture du mot

**Où** : `M/20261224000001_l12c_verification.sql:67-77` (`private.order_text_fold`) et `:109-124`
(`private.order_review_words`). Le texte est mis en minuscules, les accents précomposés sont remplacés (`translate`),
puis **tout caractère hors `[a-z0-9'-]` devient une espace** avant la recherche « début de mot ». Conséquences :

- « W.H.I.S.K.Y » devient `w h i s k y` : six lettres isolées, aucun mot de la liste ;
- « Bière » saisi en forme décomposée (`e` + accent combinant U+0300, ce que produisent certains claviers et copier-coller)
  devient `bie re` ;
- une espace invisible (U+200B) n'est ni un caractère de contrôle (`[[:cntrl:]]` ne la retire pas) ni une lettre :
  « Whis​ky » s'affiche « Whisky » et devient `whis ky` ;
- une lettre d'une autre écriture d'aspect identique (« і » cyrillique U+0456 dans « Bіère »), ou des lettres pleine
  chasse (« ＷＨＩＳＫＹ »), ne sont pas ramenées à l'alphabet latin.

Le produit reste « vendable » au sens de la base : aucun état, aucun avis à l'administration ; le devis l'accepte.
L'écran de la partenaire (`lib/orders/review-highlight.ts`) applique la même règle, donc rien ne le signale non plus.

**Sortie** :

```
# run 736, tests/audit/cv12c-1-trous.test.ts
[CV12C-T1a] [["W.H.I.S.K.Y Jack 70 cl",null,"VENDABLE"],["W H I S K Y écossais",null,"VENDABLE"],["C.H.I.C.H.A menthe",null,"VENDABLE"]]
[CV12C-T1b] [["Bière en NFD",null,"VENDABLE"],["espace invisible",null,"VENDABLE"],["і cyrillique",null,"VENDABLE"],["pleine chasse",null,"VENDABLE"]]
    not ok 1 - T1a lettres séparées par des points ou des espaces : « W.H.I.S.K.Y », « W H I S K Y », « C.H.I.C.H.A »
      error: |-
        produits non mis à vérifier : [["W.H.I.S.K.Y Jack 70 cl",null,"VENDABLE"],["W H I S K Y écossais",null,"VENDABLE"],["C.H.I.C.H.A menthe",null,"VENDABLE"]]
    not ok 2 - T1b caractères proches : accent décomposé (NFD), espace invisible, « і » cyrillique, lettres pleine chasse
      error: |-
        produits non mis à vérifier : [["Bière en NFD",null,"VENDABLE"],["espace invisible",null,"VENDABLE"],["і cyrillique",null,"VENDABLE"],["pleine chasse",null,"VENDABLE"]]
```

**Correctif proposé** (une seule fonction, recopiée nulle part ailleurs) : dans `order_text_fold`, avant le reste,
`normalize(p_text, NFKC)` (pleine chasse → latin, ligatures), puis `normalize(…, NFD)` et retrait des marques
combinantes (`regexp_replace(…, '[̀-ͯ]', '', 'g')`), retrait des caractères de format
(`[​-‏⁠﻿­]`), table courte des lettres cyrilliques et grecques d'aspect latin (а е о р с у х і
ј ѕ ο ν…) ; dans `order_review_words`, chercher aussi sur une seconde forme où les suites de lettres isolées séparées par
un même signe ou une espace sont recollées (`w.h.i.s.k.y` → `whisky`). Même règle dans `review-highlight.ts` (test
miroir). Garder les cas négatifs actuels (« vinaigrette », « gingembre ») verts.

Limite à dire au client : une liste de mots ne reconnaîtra jamais une marque (« Gazelle », « Flag ») ni une photo ; la
case « réglementé » de la partenaire et la vérification a posteriori restent la vraie barrière (voir T3, T5).

### T2 (moyenne) — décision de l'administration non liée à ce qu'elle a vu

**Où** : `app/api/admin/products/[id]/regulation/route.ts:28` transmet `{ actor_id, product_id, regulated, reason }` ;
`M/20261224000001_l12c_verification.sql:270-278` (`order_product_regulation_decide`) verrouille le produit puis efface
**l'état courant**, quel qu'il soit. Aucune version (date de la demande, nom, description, suppléments) de la fiche
affichée n'est comparée.

**Scénario** : « Bière sans alcool » est à vérifier ; l'administratrice ouvre la file ; pendant qu'elle lit, la
partenaire renomme en « Whisky 12 ans d'âge » (nouvelle demande, nouveaux mots) ; l'administratrice clique
« Autoriser » sur ce qu'elle voit encore : la base efface la nouvelle demande, `regulated_admin = false`, et le whisky
devient commandable en ligne sans que personne ne l'ait vu. Même chose avec un supplément ajouté entre-temps.

**Sortie** :

```
# run 736
[CV12C-T2] décision 200 {"success":true,"message":"Produit vérifié : il peut être commandé en ligne.","product":{"id":"7a49d3b8-5d6b-4162-a621-ae2688f01fd5","regulated":false}} ; produit {"name":"Whisky 12 ans d’âge","review_state":null,"regulated_admin":false} ; devis VENDABLE
    not ok 1 - texte changé entre l’affichage de la file et « autoriser » : le nouveau texte reste à vérifier
      error: '« Whisky 12 ans d’âge » vendable en ligne sans que l’administration ait vu ce texte (décision HTTP 200)'
```

**Correctif proposé** : la file sert `requestedAt` (déjà là) ; l'écran le renvoie avec la décision ; la fonction exige
`p->>'reviewed_at'` égal à `review_requested_at` (ou, pour un produit marqué « réglementé » sans mots, à `updated_at`)
et refuse sinon (`REVIEW_CHANGED` : « Ce produit a changé depuis l'affichage : relisez-le. », 409). Recopie de
`order_product_regulation_decide` **en place** dans `20261224000001` (jamais appliquée), une seule recopie (S1).

### T3 (faible) — liste des mots non rétroactive, produits existants non revus

**Où** : `app/api/admin/products/keywords/route.ts:13` (« les produits déjà en vente ne sont pas revus ») ;
`order_product_save` ne cherche les mots que si le nom ou la description changent
(`M/20261224000001_l12c_verification.sql:468-471`) ; aucune instruction de la migration ne revoit les produits déjà
enregistrés (`cv12c-3-statique` T3b) alors que les routes du lot 7 créaient des produits depuis le 05/11 et que les
tests et données de `event-village-dev` en contiennent.

**Effet** : ajouter « flag » ou « gazelle » à la liste ne bloque pas « Flag spéciale 33 cl » déjà en vente ; un
« Bière Gazelle » créé avant le lot reste vendable le jour où `features.orders_enabled` s'ouvre. C'est un choix écrit
dans la route, pas dans le rapport du lot : à faire valider par le client.

**Sortie** :

```
# run 736, tests/audit/cv12c-1-trous.test.ts
[CV12C-T3] après ajout de « flag » : {"review_state":null,"devis":"VENDABLE"}
    not ok 1 - un mot ajouté (« flag ») : le produit « Flag spéciale 33 cl » déjà en vente devient à vérifier
      error: '« Flag spéciale 33 cl » toujours vendable en ligne après l’ajout du mot « flag »'
# run 736, tests/audit/cv12c-3-statique.test.ts
    not ok 1 - une instruction hors fonction pose « à vérifier » sur les produits déjà enregistrés qui contiennent un mot de la liste
      error: 'aucune migration du lot ne revoit les produits déjà enregistrés (un « Bière Gazelle » créé avant le lot reste vendable en ligne)'
```

**Correctif proposé** : `order_review_keywords_set` et la migration appellent une aide `private.order_review_backfill()`
qui pose l'état (sans jamais l'effacer) sur les produits non archivés dont le nom, la description ou un supplément
contient un mot, avec un avis groupé aux administrateurs (un seul, nombre de produits). Rejouable.

### T4 (faible) — lecture REST de l'état de vérification et de l'archivage

**Où** : règle `products_read` (`M/0003_rls.sql:237-238`, jamais redéfinie sur cette branche) : tout produit
`DISPONIBLE` est lisible par la clé anon et par toute session, **toutes colonnes**, dont les quatre colonnes ajoutées
(`review_state`, `review_words`, `review_requested_at`, `archived_at`). Un concurrent lit donc les mots qui ont arrêté
un produit d'une autre partenaire, et les produits retirés.

**Sortie** :

```
# run 736
[CV12C-T4] {"anon":[{"id":"5dd0402a-bdbc-49bc-adb1-0079f71e20f3","review_state":"A_VERIFIER","review_words":["bière"],"review_requested_at":"2026-11-27T01:19:27.03829+00:00","archived_at":null}],"autre partenaire":[{"id":"5dd0402a-bdbc-49bc-adb1-0079f71e20f3","review_state":"A_VERIFIER","review_words":["bière"],"review_requested_at":"2026-11-27T01:19:27.03829+00:00","archived_at":null}]}
    not ok 1 - clé anon et autre partenaire : ni l’état « à vérifier », ni les mots trouvés, ni l’archivage d’un produit d’autrui
      error: 'anon lit l’état et les mots de vérification : [{"id":"5dd0402a-bdbc-49bc-adb1-0079f71e20f3","review_state":"A_VERIFIER","review_words":["bière"],"review_requested_at":"2026-11-27T01:19:27.03829+00:00","archived_at":null}]'
```

**Note sur le 12b** : `products_read` appartient au 12b (`M/20261222000002_l12b_carte_des_plats.sql:177-184` sur
`lot12b/client`) : il retire les produits archivés et les établissements non listés, mais garde **toutes les colonnes**
d'un produit à vérifier `DISPONIBLE` d'un établissement listé (`review_words` compris). **Correctif proposé** :
`REVOKE SELECT (review_state, review_words, review_requested_at) ON public.products FROM anon, authenticated` (droits
par colonne : la carte publique du 12b passe par une fonction en base, et la partenaire lit sa carte par les routes
serveur), à poser par le lot qui fusionne en second, avec un test REST.

### T5 (faible) — catégorie au nom d'un mot de la liste

**Où** : `app/api/partner/products/categories/route.ts:42` (création par `ProductService.createCategory`, écriture
directe, aucun contrôle des mots) ; `order_product_save` ne regarde que le nom et la description
(`M/20261224000001_l12c_verification.sql:469`). Une catégorie « Bières et alcools » affichée sur la carte avec « Flag
33 cl », « Gazelle 65 cl » vend de la bière en ligne sans aucune vérification.

**Sortie** :

```
# run 736
[CV12C-T5] {"review_state":null,"devis":"VENDABLE"}
    not ok 1 - « Flag 33 cl » rangé dans la catégorie « Bières et alcools » : à vérifier (ou refusé au devis)
      error: 'produit de la catégorie « Bières et alcools » vendable en ligne sans vérification'
```

**Correctif proposé** : chercher les mots aussi dans le nom de la catégorie (à la création et au renommage de la
catégorie : tous ses produits passent « à vérifier » ; à l'enregistrement d'un produit : nom de sa catégorie compris),
la création de catégorie passant par une fonction en base.

### T6 (faible) — statut d'un produit archivé modifiable

**Où** : `lib/products/product.service.ts:262-268` → `writeProduct` (`:232`), écriture directe du statut sans regarder
`archived_at`. Le rapport dit « archivé : il ne se modifie plus » ; le produit reste hors du devis (pas de vente), mais
le journal et la règle sont faux.

**Sortie** :

```
# run 736
[CV12C-T6] statut d’un archivé : HTTP 200 {"success":true,"product":{"id":"4edcc959-058d-48df-a223-f9ed90d012fe","partner_id":"dd0404f5-d263-439b-8b7f-bd75badb59ff","category_id":null,"name":"Dibi mouto … ; statut en base SUSPENDU
    not ok 1 - le statut d’un produit archivé ne se change plus
      error: |-
        statut d’un produit archivé changé (HTTP 200)
        + 'SUSPENDU'
        - 'DISPONIBLE'
```

**Correctif proposé** : `writeProduct` filtre `.is('archived_at', null)` et rend 409 `PRODUCT_ARCHIVED` (même texte que
`order_product_save`), ou le statut passe lui aussi par une fonction en base.

---

## 3. Garde-fous verts (attaques bloquées)

Run 739, `tests/audit/cv12c-2-gardes.test.ts` (`# tests 8 / # pass 8 / # fail 0`) et run 736,
`cv12c-3-statique` (S1 à S3) :

```
[CV12C-G1] [["BIÈRE BLONDE 65 CL","A_VERIFIER"],["Biére pression","A_VERIFIER"],["CHICHA menthe","A_VERIFIER"],["Bière-pression maison","A_VERIFIER"],["Vins rouges du Sine","A_VERIFIER"],["Thé glacé","A_VERIFIER"]]
[CV12C-G2] paiement d’une commande devenue à vérifier : HTTP 400 {"success":false,"error":"« Jus de ditakh » est un produit réglementé : il ne se commande pas en ligne.","code":"REGULATED_PRODUCT"}
[CV12C-G4] finance_setting_set : {"ok":false,"code":"UNKNOWN_KEY","message":"Réglage inconnu."}
[CV12C-G5] [["produit",404],["supplément (par leur produit)",404],["supplément (par mon produit)",404],["zone (leur établissement)",404],["zone (mon établissement)",404],["zone retirée",404]]
[CV12C-G7] [["produit créé",403],["produit modifié",403],["supplément",403],["zone",403],["catégorie",403],["catalogue lu",200]]
[CV12C-G8] {"goods":5500,"fee":1000,"paiement":5775}
ok 1 - G1 … ok 8 - G8
[CV12C-S3] pire cas en septets : ORDER_RECEIVED=122 ORDER_ACCEPTED=104 ORDER_PREPARING=110 ORDER_READY=129 ORDER_HANDED_OVER=110 ORDER_CANCELLED=123 ORDER_PAYMENT_REFUNDED=143 ORDER_REFUND_PAID=118 ORDER_PICKUP_REMINDER=136 ORDER_NOT_COLLECTED=126 ORDER_NEW=130 ORDER_CANCELLED_PRO=130 ORDER_HANDED_OVER_PRO=78 ORDER_COURIER_ASSIGNED=132 ORDER_COURIER_CANCELLED=123
```

| N° | Ce qui est éprouvé |
|---|---|
| G1 | « À vérifier » posé pour « BIÈRE BLONDE 65 CL », « Biére pression », « CHICHA menthe », « Bière-pression maison », « Vins rouges du Sine », un mot dans la description, un supplément renommé « Liqueur de bissap » ; la partenaire ne l'efface ni par la route (champ interdit, 400) ni par la REST |
| G2 | Produit à vérifier refusé au devis et à la création ; produit devenu à vérifier après la commande (gin ajouté à la description) : paiement refusé |
| G3 | Administrateur sans `partners.validate` et compte partenaire : file et décision refusées (403), la fonction en base refuse aussi (`FORBIDDEN`) |
| G4 | La liste des mots ne s'écrit ni par `finance_setting_set` (clé inconnue) ni par la REST ; liste vide, de blancs, de 101 mots, mot de 41 lettres, `null`, doublon plié, objet, `vin|rhum`, `.*` refusés par la fonction appelée directement |
| G5 | Prix et supplément à centimes, négatifs, géants, en lettres refusés (400) ; frais et minimum de zone à centimes ou négatifs refusés ; produit, supplément, zone d'une autre partenaire (identifiants devinés, par son produit ou par le mien, par son établissement ou par le mien) : 404, rien de modifié |
| G6 | Retrait payé à la remise : le code n'est jamais dans la réponse servie à la partenaire ; l'autre partenaire : 404 ; sans « reste reçu » : `BALANCE_DUE` ; remise : reste noté (5 000), aucun paiement Event Village ; deuxième confirmation refusée ; une seule écriture au journal |
| G7 | Fiche SUSPENDU : création et modification de produit, supplément, zone, catégorie refusées (403) ; catalogue lisible ; fiche remise VALIDE |
| G8 | Commande non payée en livraison : prix, supplément et frais changés, zone retirée (désactivée) avant le paiement : le paiement prend les montants figés (5 500 + 275) |
| S1 | Recopies de `product_regulated`, `products_order_guard`, `order_product_regulation_decide`, `order_quote_compute` : une par fonction, aucune ligne perdue (calcul indépendant) ; `finance_setting_set`, `fin_setting_valid`, `platform_settings_defaults` non recopiées |
| S2 | Aucune écriture directe de `products`, `product_options`, `order_delivery_zones` dans app, lib, components, hooks, scripts, supabase/functions, middleware, instrumentation (hors statut, voir T6) |
| S3 | Les deux avis nouveaux : pas de SMS, liens vers des pages qui existent, textes sans mot technique ; les 15 SMS de commande du catalogue : GSM-7, un segment au pire cas |

---

## 4. Points du rapport du lot revérifiés, et points écartés

| Affirmation ou piste | Vérification | Conclusion |
|---|---|---|
| Recopies sans ligne perdue (§ « Migrations ») | diff ligne à ligne indépendant (script, puis S1) : seules les lignes élargies déclarées changent | **juste** |
| Ne pas recopier `finance_setting_set` / `fin_setting_valid` / `platform_settings_defaults` | `finance_setting_set` refuse `orders.review_keywords` (`UNKNOWN_KEY`, `M/20261130000001_l12a_reglages.sql:73-76`) ; aucune écriture REST de `platform_settings` ; `order_review_keywords_valid` borne la liste (1-100 mots pliés distincts, 2-40 caractères, alphabet fermé, aucune injection d'expression régulière) ; super-administrateur actif exigé en base et à la route | **juste**, aucune autre voie (G4) |
| « À vérifier » posé par une fonction, pas par un déclencheur | aucune autre écriture applicative de `products` (S2) ; écritures REST révoquées (`M/20261130000002:441`) ; la garde refuse de poser ou d'effacer l'état hors des fonctions ; seule exception : le rôle de service en SQL direct (tests), sans chemin applicatif | **juste** ; les trous sont dans la détection (T1, T3, T5) et la décision (T2) |
| Refus au devis, à la création, au paiement, à l'acceptation, à la remise | `order_quote_compute` (recopie) puis `product_regulated` élargie, appelée par paiement, acceptation et remise (`M/20261130000006_l12a_etapes.sql:385`) | **juste** (G2 et tests D du lot) |
| Coordonnées seulement pendant la commande ouverte | `partnerOrderView` (`lib/orders/booking.ts`, fin) retire `contact` dès un état terminé ; `order_view` ne sert ni nom ni code à la partenaire | **juste** ; les notes par ligne (« sans piment ») restent, ce ne sont pas des coordonnées |
| Commande non transmise invisible | `order_partner_day` ne compte que `received_at IS NOT NULL` ; listes du 12a inchangées | **juste** |
| Fiche SUSPENDU en lecture seule | garde de la fiche sur `/api/partner/products/*`, `/api/partner/venues/*` (`lib/auth/partner-fiche-guard.ts:122-138`) et `order_catalog_owner` en base | **juste** (G7) |
| Archivage | produit vendu archivé, hors devis, catalogue, listes ; lignes de commande gardent `product_name`, `base_price`, `options` (`M/20261130000004:610-614`) | **juste**, sauf le statut (T6) ; la carte publique de cette branche (`app/api/restaurants/[id]/menu/route.ts:51-63`, hors du lot) montre encore les archivés et les « à vérifier » : remplacée par le 12b (`order_venue_menu`), à contrôler à la fusion |
| Course « produit jamais vendu supprimé » contre une commande | le `FOR UPDATE` du retrait et le verrou de clé de la ligne de commande s'excluent ; au pire la commande échoue sur la clé étrangère (erreur générique), jamais une ligne orpheline | écarté (pas de faille ; erreur peu probable) |
| File de l'administration limitée à 200 | `app/api/admin/products/review/route.ts:32` : les 200 demandes les plus anciennes ; au-delà, les plus récentes n'apparaissent pas tant que les anciennes ne sont pas traitées | écarté comme faille (le produit reste bloqué) ; à paginer si le volume le demande |
| Mots techniques (point 8) | écrans du lot : libellés traduits, refus du serveur en français ; seuls deux refus de route contiennent un mot de code, inatteignables depuis l'écran (requête forgée) : « Le champ status est requis. » (`app/api/partner/products/[id]/status/route.ts:24`, lot 7) et « Ce champ ne se modifie pas ici : review_state. » (`lib/products/product.service.ts:306`) | écarté comme faille ; à reformuler en passant (« Choisissez une disponibilité. », « Ce champ ne se modifie pas ici. ») |
| Texte du refus de paiement d'un produit « à vérifier » | run 736 (G2) : `HTTP 400 {"error":"« Jus de ditakh » est un produit réglementé : il ne se commande pas en ligne.","code":"REGULATED_PRODUCT"}` — le paiement passe par `product_regulated` (élargie) et dit « réglementé » pour un produit seulement en vérification ; le devis, lui, dit « en cours de vérification » | pas de faille (le paiement est refusé) ; texte inexact pour le client, à distinguer (`PRODUCT_UNDER_REVIEW`) |
| Contrôle statique S4 du lot | ne parcourt que `app` et `lib`, et ne repère que `from('products')` littéral ; aucun autre dossier n'écrit ces tables aujourd'hui (S2 élargi : vert) | suffisant aujourd'hui ; S2 de cette contre-vérification le complète |

### Tests existants modifiés par le lot (point 9)

| Fichier | Avant → après | Affaibli ? |
|---|---|---|
| `tests/parcours/notif-modeles.test.ts:319-321`, `notif-outbox.test.ts:186-188` | 2 lignes ajoutées (types nouveaux), aucune ligne existante changée | non |
| `tests/schema/f3b-ecrans.test.ts:118-120` | une ligne `[statistics.read, partners.read, partners.validate] → aucune entrée` devient deux lignes : `[statistics.read, partners.read] → aucune` et `[partners.validate] → /admin/products` | non : les deux droits sans entrée restent contrôlés, l'entrée nouvelle est exigée |
| `f3b-ecrans.test.ts:136` | liste exacte du SUPERADMIN, `/admin/products` inséré à sa place | non (liste toujours exacte) |
| `tests/parcours/partenaire-lot7.test.ts:784-790` | « usePartnerOrders importé » devient « usePartnerOrders absent, routes `/api/partner/orders/day` et `?filter=open` lues » | non : inversé à dessein (lecture REST fermée depuis le 12a), assertion aussi stricte |
| `partenaire-lot7.test.ts:931-935` (A21) | « Realtime ou connected » devient « `formatTime(openOrders.updatedAt)` » | non : l'ancien garde-fou ne prouvait qu'un mot ; le nouveau exige l'heure de lecture |

---

## 5. Avis (point 7)

### 5.1 Les deux types nouveaux

| Type | Destinataires | Canaux | Nuit | Lien | SMS |
|---|---|---|---|---|---|
| `ADMIN_PRODUCT_REVIEW` | administrateurs avec `partners.validate` (et super-administrateurs) | cloche, email | reporté | `/admin/products?produit=<id>` (la carte est mise en vue) | aucun |
| `PRODUCT_REVIEW_DECIDED` | propriétaire de la fiche partenaire | cloche, téléphone, email | reporté | `/partner/products/<id>` | aucun |

Textes simples, sans mot technique, contrôlés au rendu (S3). Un seul défaut de fond, hors texte : l'avis
`ADMIN_PRODUCT_REVIEW` est envoyé à **chaque** demande (`ref` = produit + date de la demande) : une partenaire qui
renomme dix fois son produit envoie dix avis (cloche + email) à chaque administrateur. À regrouper si le volume monte
(observation, pas de test).

### 5.2 Avis de commande qui partent par SMS aujourd'hui

Pire cas mesuré en septets GSM-7 (nom d'établissement de 90 caractères avec accents et signes de la table d'extension,
montants à 7 chiffres, toutes les origines d'annulation et tous les modes) ; limite d'un segment : 160. Aucun n'est en
UCS-2.

| Type | Moment | Destinataire | Pire cas | Texte au pire cas |
|---|---|---|---|---|
| `ORDER_RECEIVED` | commande transmise (payée, ou créée si paiement à la remise) | client | 122 | Event Village : commande CMD-261205-A1B2C3 transmise à Chez Mame Diarra " Terang... Réponse avant 12:15, sinon remboursée. |
| `ORDER_ACCEPTED` | acceptation par l'établissement | client | 104 | Event Village : Chez Mame Diarra " Terang... a accepté la commande CMD-261205-A1B2C3. Prévue vers 12:45. |
| `ORDER_PREPARING` | passage en préparation | client | 110 | Event Village : commande CMD-261205-A1B2C3 en préparation chez Chez Mame Diarra " Terang... Prévue vers 12:45. |
| `ORDER_READY` | prête — livraison et sur place seulement (en retrait, le SMS de l'étape est le code) | client | 129 | Event Village : votre commande CMD-261205-A1B2C3 est terminée chez Chez Mame Diarra " Terang..., le livreur part dans un instant. |
| `ORDER_HANDOVER_CODE` (envoi immédiat) | prête en retrait ; départ en livraison ; nouveau code demandé | client | 130 | Event Village : votre commande CMD-261205-A1B2C3 vous attend. Donnez le code 1234 au comptoir pour la retirer, à personne d'autre. |
| `ORDER_HANDED_OVER` | remise (livrée, retirée, servie) | client | 110 | Event Village : commande CMD-261205-A1B2C3 de Chez Mame Diarra " Teranga... retirée. Merci et à la prochaine ! |
| `ORDER_CANCELLED` | annulée, refusée, sans réponse, non payée à temps, produit réglementé | client | 123 | Event Village : Chez Mame Diarra " Ter... n'a pas répondu : commande CMD-261205-A1B2C3 annulée. 1 312 500 F CFA remboursés. |
| `ORDER_PAYMENT_REFUNDED` | paiement arrivé après l'annulation ou l'expiration | client | 143 | Event Village : votre paiement de 1 312 500 F CFA pour la commande CMD-261205-A1B2C3 n'a pas pu servir. Il vous est remboursé sur Orange Money. |
| `ORDER_REFUND_PAID` | remboursement versé | client | 118 | Event Village : 1 312 500 F CFA versés sur votre compte Orange Money : remboursement de la commande CMD-261205-A1B2C3. |
| `ORDER_PICKUP_REMINDER` | retrait : `orders.pickup_warning_hours` avant la clôture d'une commande non retirée | client | 136 | Event Village : commande CMD-261205-A1B2C3 à retirer chez Chez Mame Diarra "... avant le 6 déc. à 12:45, sinon close sans remboursement. |
| `ORDER_NOT_COLLECTED` | clôture d'une commande non retirée | client | 126 | Event Village : commande CMD-261205-A1B2C3 non retirée à temps chez Chez Mame Diarra " Teranga... : close, sans remboursement. |
| `ORDER_NEW` | commande transmise, à accepter dans les 15 minutes | partenaire (propriétaire) | 130 | Event Village : nouvelle commande CMD-261205-A1B2C3 : 12 articles, 1 250 000 F CFA. Répondez avant 12:15, sinon elle sera annulée. |
| `ORDER_CANCELLED_PRO` | annulée par le client, Event Village, faute de réponse, non retirée, produit réglementé | partenaire | 130 | Event Village : commande CMD-261205-A1B2C3 annulée : produit réglementé, non vendu en ligne. Client remboursé. Ne la remettez pas. |
| `ORDER_HANDED_OVER_PRO` | remise faite par le livreur (reporté la nuit) | partenaire | 78 | Event Village : votre livreur a remis la commande CMD-261205-A1B2C3 au client. |
| `ORDER_COURIER_ASSIGNED` | livreur choisi | livreur | 132 | Event Village : commande CMD-261205-A1B2C3 à livrer pour Chez Mame Diarra "..., zone Chez Mame Diarra... Adresse dans l'application. |
| `ORDER_COURIER_CANCELLED` | livraison annulée ou confiée à un autre | livreur | 123 | Event Village : commande CMD-261205-A1B2C3 annulée (produit réglementé) : ne la livrez pas, rapportez-la à l'établissement. |

Sans SMS aujourd'hui : `ORDER_ON_THE_WAY` (son SMS est le code), `ORDER_COURIER_INVITED` (numéro saisi par la
partenaire : pas de SMS à un numéro qui n'a rien demandé — à garder ainsi), `ADMIN_PRODUCT_REVIEW`,
`PRODUCT_REVIEW_DECIDED`. Aucun avis de commande ne va à l'administration par SMS.

### 5.3 Étapes importantes sans SMS : textes proposés (aucun SMS existant retiré)

Mesurés de la même façon (nom d'établissement ou de produit coupé à 28 caractères comme le fait déjà le catalogue,
montant à 7 chiffres) ; tous GSM-7, un segment.

| N° | Étape sans SMS | Destinataire | Moment d'envoi proposé | Texte au pire cas | Septets |
|---|---|---|---|---|---|
| P1 | Code de remise bloqué après 5 essais faux (aujourd'hui : rien ne prévient le client, il reste bloqué devant le comptoir ou le livreur) | client | au 5ᵉ essai faux (`order_handover_apply`, `CODE_LOCKED`), une fois par code | Event Village : trop d'essais du code pour la commande CMD-261205-A1B2C3. Demandez un nouveau code depuis la commande dans l'application. | 137 |
| P2 | Délai de réponse bientôt fini (aujourd'hui : un seul SMS à l'arrivée, puis l'annulation) | partenaire | 5 minutes avant `response_due_at` si la commande est toujours « reçue » (`order_tick`, une fois) | Event Village : commande CMD-261205-A1B2C3 toujours sans réponse. Il reste 5 min pour l'accepter ou la refuser, sinon elle sera annulée. | 136 |
| P3 | Commande pour plus tard : début de préparation | partenaire | à `scheduled_for − prep_minutes`, pour une commande acceptée prévue plus d'une heure après son acceptation | Event Village : commande CMD-261205-A1B2C3 prévue à 12:45. Lancez la préparation maintenant pour la servir à l'heure. | 117 |
| P4 | Commande prête à emporter par le livreur (aujourd'hui : le livreur n'est prévenu qu'au choix, jamais quand la commande est prête) | livreur choisi | passage à « prête » d'une livraison qui a un livreur | Event Village : commande CMD-261205-A1B2C3 terminée chez Chez Mame Diarra " Terang... Passez la prendre. Adresse du client dans l'application. | 142 |
| P5 | Produit vérifié par Event Village | partenaire | décision de l'administration (reporté la nuit, comme l'avis actuel) | Event Village : Bissap maison et biere lo... est vérifié et autorisé à la vente en ligne. / … n'est pas autorisé à la vente en ligne. Motif dans l'application. | 89 / 110 |
| P6 | Remboursement d'une commande bloqué ou incertain (le client attend son argent ; aujourd'hui cloche, téléphone et email seulement) | administrateurs `refunds.manage` | même déclencheur que `ADMIN_REFUND_TO_RETRY` / `ADMIN_CASHOUT_UNCERTAIN` pour un versement de commande | Event Village : remboursement de 9 875 000 F CFA de la commande CMD-261205-A1B2C3 bloqué : à reprendre dans Finances, versements à reprendre. | 141 |
| P7 | Commande pour plus tard : rappel au client | client | 1 heure avant `scheduled_for` pour une commande prévue un autre jour que sa création | Event Village : votre commande CMD-261205-A1B2C3 chez Chez Mame Diarra " Terang... est prévue à 12:45. Suivez-la dans l'application. | 132 |

Ordre d'intérêt proposé : P1 et P2 (ils évitent une commande perdue ou un client bloqué), P4, puis P6 ; P3, P5 et P7
sont du confort. Chaque ajout suit la règle de nuit des avis (`night_policy`) et le plafond des SMS existant.

---

## 6. Pour les correctifs

- Partir de cette branche (`lot12c/cv-rouges`) : faire passer **au vert, sans les modifier**, T1 à T6 et T3b ; garder
  G1 à G8 et S1 à S3 verts. Recopies **en place** dans les migrations 20261224… (jamais appliquées), une seule par
  fonction.
- T4 touche `products_read`, propriété du 12b : décider quel lot pose les droits par colonne (celui qui fusionne en
  second), test REST à la clé anon.
- T3 et la limite de T1 (marques, photos) : décision du client à demander (revue des produits existants à l'ajout d'un
  mot, liste de marques).

---

## Corrections

Correctifs sur `lot12c/partenaire` (rapport : `docs/lot12c-rapport.md`, section « Correctifs après contre-vérification »).
Les trois suites de cette contre-vérification y sont reprises sans changer une assertion (5cf7daefcb), sauf une ligne de
préparation de T3, changée sur décision (ci-dessous). **Toutes vertes au run complet 753** (eb0a6a25a2, branche à jour
avec `origin/main`) et au run rapide 754 (b485b9e1c8).

| Test | Trou | Correctif (commit) | Vert au run |
|---|---|---|---|
| `cv12c-1` T1a lettres séparées (« W.H.I.S.K.Y », « W H I S K Y », « C.H.I.C.H.A ») | T1 | lecture des lettres isolées recollées dans `private.order_review_words` (dffd6fe10a) | 743, 753 |
| `cv12c-1` T1b accent décomposé, espace invisible, « і » cyrillique, pleine chasse | T1 | `private.order_text_fold` : NFKC, marques, invisibles, lettres cyrilliques et grecques (dffd6fe10a) | 743, 753 |
| `cv12c-1` T2 texte changé entre l'affichage et « autoriser » | T2 | version lue exigée par la route, refusée par la base si périmée (`REVIEW_CHANGED`) ; nouvelle version à chaque modification d'un produit à vérifier (dffd6fe10a, 19694aaa70) | 743, 753 |
| `cv12c-1` T3 mot ajouté, produit déjà en vente | T3 | revue des produits à chaque changement de la liste, un avis groupé (dffd6fe10a) | 743, 753 |
| `cv12c-1` T4 lecture REST anon et autre partenaire | T4 | droits par colonne sur `products` (dffd6fe10a) | 743, 753 |
| `cv12c-1` T5 catégorie « Bières et alcools » | T5 | nom de la catégorie compté, renommage qui revoit ses produits (dffd6fe10a) | 743, 753 |
| `cv12c-1` T6 statut d'un produit archivé | T6 | produit archivé figé : garde, service, portions (dffd6fe10a ; défaut de lecture de `restore` corrigé en 655cd54609) | 743, 753 |
| `cv12c-3` T3b instruction hors fonction qui revoit les produits | T3 | revue par la migration `20261224000005` (dffd6fe10a) | 743, 753 |
| `cv12c-2` G1 à G8, `cv12c-3` S1 à S3 | — | restés verts (S1 : `order_daily_portions_set` recopiée une fois, lignes ajoutées seulement ; S3 : avis de commande ajoutés en GSM-7 d'un segment, les deux types du 12c toujours sans SMS) | 743, 753 |

**Ligne de préparation changée (décision du 27/11)** — `tests/audit/cv12c-1-trous.test.ts`, T3, lignes 141, 146, 151,
155 et 156 (dbfdbe38a9) : « Flag » est entré dans la liste par défaut (marques demandées par la consigne des
correctifs) ; la précondition « vendable » de T3 devenait impossible.

| | Avant | Après |
|---|---|---|
| nom du produit | « Flag spéciale 33 cl » | « Zorba spéciale 33 cl » |
| mot ajouté à la liste | « flag » | « zorba » |

Même scénario (un mot ajouté rend « à vérifier » un produit déjà en vente), même assertion (`q.ok !== true`).

Points de la section 6 : T4 posé par ce lot (droits par colonne ; la règle de lignes `products_read` reste au 12b) ;
revue des produits existants et liste de marques faites sur décision du client (consigne des correctifs). Les sept avis
de la section 5.3 sont ajoutés (P1 à P7), textes dans le rapport.
