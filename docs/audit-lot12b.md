# Contre-vérification du lot 12b — commandes : écrans du client

Contre-vérification indépendante de la branche `origin/lot12b/client` (234c7fc67f, rapport `docs/lot12b-rapport.md`,
état des lieux `docs/lot12-etat-des-lieux.md` § 2 sur `etat/lot12`). Tests sur la branche **`lot12b/cv-rouges`**
(partie de 234c7fc67f, **jamais fusionnée**) : un test rouge = un trou ouvert, vert = attaque bloquée. Base LOCALE de la
CI seulement : aucun appel au projet distant, aucune migration appliquée, branche du lot, `main` et `lot12c/partenaire`
non touchées. Chemins relatifs au dépôt ; `M/` = `supabase/migrations/`.

**Base des tests = 12b + 12c.** Le 12c a été fusionné dans `main` (85a1c85f57) pendant l'audit. Pour éprouver l'état
réel après la fusion du 12b (et le point prioritaire demandé en cours d'audit : `products_read` face aux droits par
colonne du 12c), la branche porte aussi les 5 migrations du 12c (`M/20261224000001` à `05`), recopiées octet pour octet
de `main` (blobs identiques vérifiés). Le code applicatif du 12c n'est pas recopié.

Suites ajoutées (`ci-rapide`) :

| Suite | Contenu | Attendu |
|---|---|---|
| `tests/audit/cv12b-1-trous.test.ts` | T1, T2 | rouges |
| `tests/audit/cv12b-2-gardes.test.ts` | G1 à G6 | verts |
| `tests/audit/cv12b-3-statique.test.ts` | T3 (rouge), S1 à S4 (verts) | sans base |
| `tests/parcours/l12b-commandes-client.test.ts`, `l12b-produits-rest.test.ts`, `tests/schema/migration-lot12b-rejouable.test.ts` | suites du lot, **inchangées** | compatibilité avec le 12c |

Runs rapides (branche `lot12b/cv-rouges`) :
- **run 768** (c86a735020, six suites) : `cv12b-1-trous` T1 **rouge pour la bonne raison**, T2 en échec par **erreur
  de mon test** (fermeture posée avec des secondes, refusée par `venue_closures_period_chk`) ; `cv12b-2-gardes` 9/10
  (G5b en échec par erreur de mon test : `text = uuid` dans ma requête SQL) ; `cv12b-3-statique` 4/5 (seul T3 rouge,
  voulu) ; suites du lot sur la base 12b + 12c : `l12b-commandes-client` **13/13 vert**, `migration-lot12b-rejouable`
  **6/6 vert**, `l12b-produits-rest` **rouge** (même cause que T1) ;
- **run 769** (18f958b26c, mes deux erreurs corrigées, aucune assertion changée) : `cv12b-1-trous` T1 et T2 **rouges pour
  la bonne raison** ; `cv12b-2-gardes` **10/10 verts**.

Aucun run complet. Fiches et réglages : l'interrupteur `features.orders_enabled` est remis par `openOrdersService` ;
la fermeture de T2 est annulée (`cancelled_at`) et les commandes non payées de mes comptes closes à la fin ; tout le
reste est créé pour le test (comptes, établissements, produits).

---

## 1. Verdict

**Les écrans du client tiennent l'argent, le code et l'accès ; la fusion avec le 12c casse la lecture REST des
suppléments et des portions, et la base ignore toujours les fermetures exceptionnelles.** Trois trous, prouvés rouges
pour la bonne raison : T1 **élevé à la fusion** (règles REST du 12b incompatibles avec les droits par colonne du 12c :
« permission denied » pour tout le monde, propriétaire compris ; la suite du lot `l12b-produits-rest` rougit), T2
**moyen** (commande acceptée pendant une fermeture exceptionnelle ; constat déjà signalé par le lot, toujours ouvert après
les deux lots), T3 **faible** (panier et notes gardés sur l'appareil après une fin de session silencieuse). Aucun trou
critique : montants, quantités, suppléments, zone, mode et part lus en base ; prix changé entre devis et commande →
rien de créé ; idempotence réelle ; plafond tenu ; code lisible par le seul client, jamais ailleurs, effacé à la
clôture ; clé inatteignable ; 404 pour tout autre compte ; annulation unique sous concurrence, remboursée au montant
affiché.

**À corriger avant la fusion : T1** (une migration après 20261224000005, aides `SECURITY DEFINER`) ; **avant l'ouverture
des commandes : T2** ; T3 peut suivre. À régler aussi à la fusion : les 3 conflits textuels et le spec e2e du 12c qui
doit passer par le compteur partagé de l'interrupteur (§ 4.2).

---

## 2. Trous, par gravité

### T1 (élevée à la fusion) — lecture REST des suppléments et des portions cassée par les droits par colonne du 12c

**Où.** `M/20261222000002_l12b_carte_des_plats.sql:186-211` : les règles `product_options_read` et
`product_daily_portions_read` testent le produit dans une sous-requête qui lit **la ligne entière**
(`AND (to_jsonb(pr) ->> 'archived_at') IS NULL`, lignes 194 et 206) ; même construction dans `products_read`
(`to_jsonb(products.*)`, ligne 179-180). Le 12c retire à `anon` et `authenticated` le droit de lire la table products et
ne le rend que colonne par colonne, sans `review_*` ni `archived_at` (`M/20261224000005_l12c_cv_correctifs.sql:571-582`).
Le rapport du lot l'avait laissé ouvert (point 6 : « rien ne l'a vérifié ici »). Une sous-requête d'une règle de lignes est vérifiée avec les droits **de l'appelant** ; une référence à la ligne entière
exige le droit de lire toutes les colonnes. Le lot a écrit `to_jsonb(...)` pour ne pas dépendre de l'existence de la
colonne pendant que les deux lots étaient écrits en parallèle (commentaire lignes 16-19) : c'est précisément ce qui casse
une fois les deux lots réunis.

**Effet.** Sur la base réunie, `products_read` elle-même tient (le produit d'un établissement listé est lu : PostgreSQL
ne vérifie pas les droits par colonne pour une expression de la règle sur la table même). Mais **toute lecture REST des
suppléments et des portions échoue** — « permission denied for table products » — pour la clé anon, un client **et la
partenaire propriétaire** (la sous-requête est vérifiée avant le `OR is_partner_owner`). La suite du lot
`tests/parcours/l12b-produits-rest.test.ts`, inchangée, est **rouge** sur cette base (ligne 64 : suppléments attendus,
réponse vide car l'erreur est ignorée). Les écrans du 12b ne lisent pas ces tables par la REST (S1) ; tout autre
lecteur REST (écran existant, futur, outil de la partenaire avec sa session) recevra une erreur, et `l12b-produits-rest`
fera rougir le run complet de `main` dès la fusion.

**Preuve (run 768, `cv12b-1-trous`, T1 — sortie brute).**

```
[CV12B] T1. témoin des droits : {"anon_archived":false,"anon_price":true,"anon_table":false,"policies_whole_row":3}
[CV12B] T1. lectures REST :
  anon : products 1 ligne(s) ; product_options ERREUR « permission denied for table products » ; product_daily_portions ERREUR « permission denied for table products »
  client : products 1 ligne(s) ; product_options ERREUR « permission denied for table products » ; product_daily_portions ERREUR « permission denied for table products »
  propriétaire : products 1 ligne(s) ; product_options ERREUR « permission denied for table products » ; product_daily_portions ERREUR « permission denied for table products »
    not ok 1 - clé anon, client et propriétaire : produit, supplément et portions d’un établissement listé lisibles sans erreur
        + [
        +   'anon/product_options',
        +   'anon/product_daily_portions',
        +   'client/product_options',
        +   'client/product_daily_portions',
        +   'propriétaire/product_options',
        +   'propriétaire/product_daily_portions'
        + ]
        - []
```

Même run, suite du lot `l12b-produits-rest` (inchangée) :

```
    not ok 1 - établissement listé seulement ; rien d’une partenaire suspendue, d’un établissement suspendu ni sans établissement ; la propriétaire lit les siens
        + []
        - [
        -   '46ca9ff3-8fec-4256-8fef-6aa9975fbe57'
        - ]
      stack: |-
        TestContext.<anonymous> (/home/runner/work/event-village/event-village/tests/parcours/l12b-produits-rest.test.ts:64:20)
```

**Correctif proposé.** Ne jamais lire la ligne entière dans une règle. Une aide `SECURITY DEFINER` (comme `listed_venue`),
qui lit les colonnes fermées avec les droits de son propriétaire :

```sql
-- après le 12c (archived_at existe) : à placer dans une migration postérieure à 20261224000005
CREATE OR REPLACE FUNCTION public.product_public(p_product_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (SELECT 1 FROM public.products pr
                    WHERE pr.id = p_product_id AND pr.status = 'DISPONIBLE' AND pr.venue_id IS NOT NULL
                      AND pr.archived_at IS NULL AND public.listed_venue(pr.venue_id));
$$;
REVOKE ALL ON FUNCTION public.product_public(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.product_public(uuid) TO anon, authenticated, service_role;
```

puis `products_read` : `USING (public.product_public(id) OR public.is_partner_owner(partner_id) OR public.is_admin())` ;
`product_options_read` : `USING ((is_active AND public.product_public(product_id)) OR public.product_owner_or_admin(product_id))`
avec une seconde aide `SECURITY DEFINER` pour « propriétaire ou administration » (même raison : pas de sous-requête sur
products dans la règle) ; idem `product_daily_portions_read`. Comme le 12b passe avant le 12c dans l'ordre des
migrations (20261222 < 20261224), le plus simple à la fusion est de **réécrire les trois règles dans une migration
nouvelle datée après 20261224000005** (la colonne `archived_at` y existe, plus besoin de `to_jsonb`), et de laisser
celle du 12b telle quelle (déjà rejouable). Test à garder : `cv12b-1-trous` T1 (anon, client, propriétaire).

### T2 (moyenne) — fermeture exceptionnelle : la carte la retire, la base l'ignore

**Déjà signalé par le lot** (rapport, « Failles et constats » point 3, et `docs/apres-lancement.md`), sans correctif car
`order_quote_compute` appartenait au 12c. Prouvé ici par la route, sur la base 12b + 12c : il reste ouvert après les deux
lots.

**Où.** La carte du 12b retire les fermetures (`venue_closures`) des créneaux proposés et de « tout de suite »
(`M/20261222000002:84-96`, commentaire : « la base refait tous les contrôles au devis »). Le devis ne lit que les
horaires de la semaine : `order_quote_compute` (12a `M/20261130000004:408-432`, recopié par le 12c
`M/20261224000003:236-262`) appelle `venue_open_covers` (horaires seuls, `M/20261123000102`), jamais
`venue_closed_during`.

**Effet.** Une commande « tout de suite » ou pour une heure pendant une fermeture exceptionnelle (deuil, travaux, jour
férié posé par la partenaire) est acceptée et payée : depuis un onglet ouvert avant la fermeture, un panier gardé, un
lien « Commander à nouveau » ou un appel direct à la route. La partenaire doit la refuser (remboursement, mauvaise
expérience des deux côtés) ou ne la voit qu'à la réouverture.

**Preuve (run 769, `cv12b-1-trous`, T2 — sortie brute).**

```
[CV12B] T2. fermeture 2026-11-27 11:27:00 → 2026-11-28 14:27:00 ; carte : asapAvailable=false, maintenant 2026-11-27T12:27, première fenêtre proposée 2026-11-28T14:27
[CV12B] T2. « tout de suite » pendant la fermeture : HTTP 201 {"id":"80de646d-412d-478b-bc55-702d24a10406","state":"EN_ATTENTE_PAIEMENT","scheduledFor":"2026-11-27T12:58:00+00:00"}
[CV12B] T2. heure 2026-11-27T15:30 pendant la fermeture : HTTP 201 {"id":"7cf5d85d-ee38-4c34-b589-c7f49236c2d4","state":"EN_ATTENTE_PAIEMENT","scheduledFor":"2026-11-27T15:30:00+00:00"}
    not ok 1 - « tout de suite » et heure choisie pendant une fermeture : refusés à la création, comme la carte le montre
      error: 'commande « tout de suite » acceptée pendant une fermeture exceptionnelle : HTTP 201 {"id":"80de646d-412d-478b-bc55-702d24a10406","state":"EN_ATTENTE_PAIEMENT","scheduledFor":"2026-11-27T12:58:00+00:00"}'
```

La carte dit juste (« pas tout de suite », premier créneau après la réouverture) ; la base crée les deux commandes.

**Correctif proposé.** Dans `order_quote_compute` (dernière définition : 12c, à recopier dans une migration postérieure),
après chaque `venue_open_covers` :

```sql
-- au plus tôt
IF public.venue_closed_during(v.id, tsrange(date_trunc('minute', v_now), v_at, '[)')) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'CLOSED_NOW', 'message',
        'L’établissement est exceptionnellement fermé en ce moment : choisissez une heure après la réouverture.');
END IF;
-- heure choisie
IF public.venue_closed_during(v.id, tsrange(v_at, v_at + interval '1 minute', '[)')) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'OUTSIDE_HOURS', 'message',
        'L’établissement est exceptionnellement fermé à cette heure-là. Choisissez une autre heure.');
END IF;
```

Le paiement (`order_payable_refusal`) peut refaire le même contrôle pour une commande passée juste avant la pose de la
fermeture. Test à garder : `cv12b-1-trous` T2.

### T3 (faible) — panier gardé (notes libres) non effacé quand la session se ferme à l'insu du navigateur

**Où.** `lib/device/device-prefs.ts:197-213` (ajout du lot) garde le panier sous
`event-village:appareil:panier:<établissement>` : produits, suppléments, mode et **note libre par plat** (200 caractères),
24 h. `components/providers/AuthProvider.tsx:231` n'appelle que `clearDevicePrefs('paiement')` quand la page se charge
sans session (« Déconnecter tous mes appareils » depuis un autre téléphone, session expirée : cvf2b 6.5) ;
`lib/device/device-prefs-purge.ts:35-46` n'y efface que le paiement, les invités et les demandes de table. Le bouton
« Se déconnecter » et SIGNED_OUT effacent bien tout (lignes 211 et 304). L'inventaire de `cvf2b-6` (test 13) décrit
encore `device-prefs.ts` comme « opérateur et numéro de paiement, recherches récentes » : le panier n'y est pas.
Précédents identiques : CV 11b T5, CV 11c-b T3.

**Effet.** Sur un téléphone partagé, après une fin de session silencieuse, le compte suivant (ou un visiteur) retrouve
le panier du précédent avec ses notes (« pour Fatou, diabétique, appeler le 77… »). Aucun prix, aucun code, aucune
adresse (vérifié : `lib/orders/device-store.ts` ne garde que lignes et mode, champ par champ).

**Preuve (run 768, `cv12b-3-statique`, T3 — sortie brute).**

```
[CV12B] T3. purge du chemin sans session : clearDevicePrefs('paiement') ; clés avant ["event-village:appareil:panier:5b0e2f7a-1c3d-4e5f-8a9b-0c1d2e3f4a5b","event-village:appareil:paiement"] ; après ["event-village:appareil:panier:5b0e2f7a-1c3d-4e5f-8a9b-0c1d2e3f4a5b"] ; panier restant : ["{\"at\":1795782007855,\"mode\":\"LIVRAISON\",\"lines\":[{\"productId\":\"7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f\",\"quantity\":2,\"optionIds\":[],\"notes\":\"Sans piment, pour Fatou (diabétique), appeler le 77 123 45 67\"}]}"] ; classement de device-prefs.ts dans cvf2b-6 : « opérateur et numéro de paiement, recherches récentes de l’appareil (localStorage) »
    not ok 1 - page chargée sans session : le panier (notes libres par plat) est effacé comme le numéro de paiement
```

**Correctif proposé.** Dans `clearDevicePrefs`, scope `'paiement'` : ajouter `k.startsWith(ORDER_CART_PREFIX)` (ou, si le
panier d'un visiteur doit survivre, n'effacer que les notes) ; mettre à jour la ligne de `device-prefs.ts` dans
l'inventaire de `cvf2b-6`.

---

## 3. Garde-fous verts (attaques bloquées)

Run 769, `cv12b-2-gardes` **10/10**, sorties brutes (extraits) :

| | Attaque | Résultat |
|---|---|---|
| G1 | autre compte : suivi, code, nouveau code, annulation, paiement, solde de la commande d'un client (lien deviné) ; « Mes commandes » avec `?userId=` | `{"suivi":404,"code":404,"nouveauCode":404,"annulation":404,"paiement":404,"solde":404}` ; aucun paiement à son nom, aucun nouveau code, état inchangé, liste sans la commande |
| G2 | supplément 500 → 900 F entre devis et commande | `HTTP 409 … « Le prix de votre commande a changé : 6 090 F CFA. Vérifiez avant de payer. » ORDER_PRICE_CHANGED total 6090` (2 × 2 900 + 5 %), aucune commande créée |
| G2 | frais de zone 500 → 1 500 F | `HTTP 409 … 4 725 F CFA`, aucune commande créée |
| G2 | 4e commande non payée | statuts `[201,201,201,429]`, « Vous avez déjà 3 commandes non payées… » |
| G3 | deux annulations simultanées | `HTTP 200 / 409 ; affiché 4200 ; remboursements [4200] ; refunded_amount 4200` |
| G3 | annulation ∥ acceptation de la partenaire | `client HTTP 200, partenaire HTTP 409 ; état ANNULEE_CLIENT ; payé 5250 ; remboursements [5250]` |
| G4 | passé / > 7 jours / hors du quart d'heure / hors horaires / zone inactive / zone archivée / minimum / table d'un autre établissement | `TOO_SOON`, `TOO_FAR`, `INVALID_TIME`, `OUTSIDE_HOURS`, `ZONE_NOT_FOUND` ×2, `BELOW_MINIMUM`, `TABLE_NOT_FOUND`, chacun avec sa phrase ; aucune commande créée |
| G5 | droits sur `private` (anon, authenticated, service_role) | usage du schéma, `order_codes`, clé, déchiffrement, émission : tous `false` ; `order_code_reveal` au seul `service_role` ; REST : `Invalid schema: private` |
| G5 | annulation par Event Village pendant « prête » | `code 9211 : lignes private avant 1, après annulation 0 ; lecture après : HTTP 409 NO_CODE_YET ; traces examinées 32, contenant le code 0` (cloche, journal, file) |
| G6 | carte : produit archivé (par `order_product_remove` du 12c), zone archivée, produit « à vérifier » | archivé absent, zone absente, « à vérifier » affiché `orderable:false, inReview:true` ; aucune clé hors de la liste ; aucun champ interne (`stock_quantity`, `regulated_admin`, `review_words`, `archived_at`, `partner_id`) dans la réponse brute de `order_venue_menu` |

Sans base (`cv12b-3-statique`, runs 768 et local) : **S1** aucun écran du 12b ne lit products / options / portions par
la REST ni `review_*` / `archived_at` (31 fichiers) ; **S2** le code n'est ni dans le stockage, ni dans l'adresse, ni dans
la console, ni dans la vue de suivi ; **S3** 9 refus du 12b, tous avec un message, l'écran n'affiche jamais un code de
refus ; **S4** recopie de `order_issue_code` : 0 ligne perdue, 7 lignes ajoutées (le seul bloc d'écriture chiffrée).

Suites du lot, inchangées, sur la base 12b + 12c (run 768) : `l12b-commandes-client` 13/13 (dont idempotence en double
clic, deux requêtes simultanées et rejeu ; acompte puis solde jusqu'au bout ; réglementé à chaque étape ; code pour le
seul client, livreur compris), `migration-lot12b-rejouable` 6/6.

---

## 4. Points du rapport du lot revérifiés, et points écartés

### 4.1 Revérifiés dans le code (en plus des tests)

- **Argent jamais lu du navigateur** : `orderInput` (`lib/orders/booking.ts:180-205`) ne transmet ni prix, ni total, ni
  part ; `expectedTotal`, `expectedToPay`, `expectedAmount` ne servent qu'à la comparaison, dans la même transaction que
  la création (`order_create_checked`, `order_payment_start`, sous-bloc annulé par `OR412` : ni commande, ni lignes, ni
  stock, ni journal). Absents : aucune comparaison, le montant reste celui de la base (aucun gain pour un attaquant).
- **Idempotence** : commande, clé unique par client (`uq_orders_client_request_key`), verrous établissement puis client
  dans l'ordre de `order_create` ; paiement, verrou consultatif sur (client, clé) puis index existant. Deux onglets =
  deux clés : le second paiement est refusé par « paiement déjà en attente » (`order_payment_create`).
- **Numéro vérifié** : `requireVerifiedPhone` dans `POST /api/orders/create` et `POST /api/payments/create`.
- **Code de remise** : recopie de `private.order_issue_code` exacte (S4) ; effacement par déclencheur à chaque changement
  de l'empreinte (remise `M/20261130000006:419`, clôture `:160` qui couvre annulations, sans réponse, non retirée) et
  remplacement au nouveau code ; lecture refusée hors « prête à retirer » / « en route », commande close, empreinte
  différente ; réponses `no-store, private`, `Pragma`, `Expires` sur succès comme sur refus ; composant
  `HandoverCode` : état React seulement, effacé au démontage, à `active` faux et à la déconnexion (S2).
- **« Commander à nouveau »** (`components/orders/client/menu/MenuView.tsx:101-162`) : lit la commande par
  `GET /api/orders/<id>` (404 pour un autre compte), vérifie l'établissement, puis `reconcileLines`
  (`lib/orders/cart-client.ts:64-82`) : produit absent, non commandable ou supplément disparu → **signalé** (liste
  `dropped`), jamais ajouté en silence ; aucun prix repris (le devis de la base recalcule).
- **Paiement mémorisé** : opérateur et numéro seulement, enregistrés après acceptation du serveur, effacés à la
  déconnexion (y compris sans session : clé `paiement`).
- **Avis** : tous les avis de commande du client mènent à `/orders/<id>` (`orderLink`, `lib/notifications/catalog.ts:3069`) ;
  `PAYMENT_SUCCESS` (lien `/orders`) n'est pas émis pour une commande. Texte de la cloche « Donnez au comptoir le code
  reçu par SMS, visible aussi dans votre commande » : le code n'est dans aucune cloche, push, email ni file (G5).
- **Mots** : les 9 refus des fonctions du 12b portent un message en français simple (S3) ; l'écran affiche le message du
  serveur, `PRODUCT_UNDER_REVIEW` a sa phrase (`lib/orders/cart-client.ts:339-342`).
- **Coquille** : `components/layout/AppLayout.tsx` ne change que la ligne 184 (`/restaurants/rest-terrou-bi/tables` →
  `/tables`), vérifié par `git diff 5b7f3399ca..234c7fc67f`.

### 4.2 Compatibilité avec le 12c (point 9)

- Aucun écran du 12b ne lit `products`, `product_options` ni `product_daily_portions` par la REST, ni `review_*` /
  `archived_at` (S1, 31 fichiers) : la carte passe par `order_venue_menu` (rôle de service).
- La carte exclut les produits archivés et les zones archivées, affiche « à vérifier » non commandable (G6, colonnes du
  12c réelles) ; `in_review = review_state IS NOT NULL` correspond au 12c (seul état non vide : `A_VERIFIER`).
- **Casse à la fusion** : T1 (règles REST) — `l12b-produits-rest` du lot rouge sur la base 12b + 12c (run 768).
  **Tient sur la base réunie** (run 768, suites du lot inchangées) : `l12b-commandes-client` **13/13** (carte, code,
  prix changé, idempotence, paiement, acompte et solde, réglementé avec la décision de l'administration du 12c,
  « Mes commandes ») et `migration-lot12b-rejouable` **6/6**.
- **Conflits textuels** (`git merge-tree origin/main origin/lot12b/client`) : `e2e/support/responsive-pages.ts`,
  `lib/device/device-prefs.ts`, `tests/helpers/design-files.ts` (ajouts des deux lots aux mêmes endroits : garder les
  deux).
- **e2e (point 5 du rapport du lot, confirmé sur `main`)** : `e2e/lot12c.responsive.spec.ts:205-210` lit
  `features.orders_enabled`, l'ouvre puis le remet à sa valeur d'avant **sans le compteur partagé**
  `e2e/support/orders-service.ts` du 12b ; les deux specs sont dans le même groupe « services » du verrou, donc peuvent
  tourner ensemble : le 12c peut refermer le service sous les pas du 12b (même cause que le run 722 des tables). À la
  fusion : le spec du 12c doit passer par `openOrdersService` / `releaseOrdersService`.
- **Ordre des migrations** : 20261222 (12b) < 20261224 (12c). Si le 12c est appliqué sur `event-village-dev` avant le
  12b, `supabase db push` refusera des migrations plus anciennes que la dernière appliquée (`--include-all`
  nécessaire) ; et la règle T1 doit être réécrite après 20261224000005 de toute façon.

### 4.3 Tests existants modifiés par le lot (point 10)

| Fichier | Avant → après | Jugement |
|---|---|---|
| `tests/parcours/client-interface.test.ts:302` | lien `/restaurants/…` exigé sous interrupteur `tables` → `/tables` ou `/restaurants/…`, même interrupteur | même exigence |
| `tests/parcours/interrupteurs.test.ts:121-127, 226-228` | carte d'une partenaire → carte d'un établissement ouvert à la commande ; même assertion (404 service fermé, produit attendu sinon) | même exigence |
| `tests/parcours/l11a-cv-correctifs.test.ts:213-241` | identifiant exact seulement ; ajout de l'identifiant de la partenaire dans les entrées qui doivent rendre 404 | **renforcé** |
| `e2e/carte-b3.responsive.spec.ts:96-99` | liste des champs publics + `orders`, et `orders === false` pour une salle | **renforcé** |
| `e2e/support/responsive-checks.ts:112-121` | « texte coupé » : les ancêtres situés **au-dessus** d'un conteneur qui défile réellement en hauteur ne comptent plus pour la coupure verticale | assouplissement **borné** : le conteneur qui défile reste contrôlé lui-même, la largeur aussi ; portée globale (toutes les pages), signalée par le lot |
| `tests/helpers/design-files.ts`, `e2e/support/responsive-pages.ts` | ajouts des fichiers et pages du lot | aucun retrait |

Aucune assertion affaiblie.

### 4.4 Écartés après vérification

- **Code révélé si `client_id` vide** (`o.client_id <> v_client` donnerait NULL) : `orders.client_id` est `NOT NULL`
  (`M/0001_initial_schema.sql:331`).
- **Produit `SUSPENDU` affiché sur la carte** : aucune écriture de ce statut dans le code actuel ; la carte montre un
  produit non disponible avec son état, choix assumé.
- **Code visible alors que trop d'essais** (`locked`) : voulu, le client doit pouvoir demander un nouveau code.
- **Clé de chiffrement** : table `private.order_code_enc_key` sans droit pour aucun rôle de l'API, schéma `private`
  sans `USAGE` pour `service_role`, aides privées sans `EXECUTE` (G5).
- **Annulation pendant un paiement en cours** : `order_payment_confirm` rembourse un paiement arrivé sur une commande
  annulée (« commande annulée », `M/20261130000005`), comme au 12a.

### 4.5 Observations (sans test rouge)

- **Clé d'idempotence du paiement non liée à la commande** : `order_payment_start` rend le paiement déjà créé avec la
  même clé **sans vérifier `order_id`** (`M/20261222000003:118-123`) ; une même clé envoyée pour une autre commande rend le
  paiement de la première (« duplicate »). L'écran ne réutilise jamais une clé pour une autre commande (`useIdempotencyKey` :
  nouvelle clé dès que le corps change) ; même comportement que les billets et les tables. Ajouter
  `AND order_id = v_order_id` (ou refuser `IDEMPOTENCY_KEY_REUSED`) coûterait une ligne.
- **Même clé, autre corps** pour la commande : rend la commande déjà créée (comme les billets).

---

## 5. Idées pour l'expérience du client (classées par valeur)

1. **« Le prix a changé » en un geste.** Aujourd'hui : un message et un devis relu. Montrer ligne par ligne l'ancien et le
   nouveau prix (le devis les a), avec un seul bouton « Commander à 6 090 F ». Moins d'abandons au moment le plus
   sensible.
2. **Fermeture exceptionnelle annoncée sur la carte.** Bandeau « Fermé exceptionnellement jusqu'au 28/11 à 18 h —
   commandez pour plus tard » avec le premier créneau proposé (la carte a déjà les fenêtres) ; va de pair avec T2.
3. **Heure de remise estimée avant de payer.** « Prête vers 13 h 05 » (ou « livrée vers 13 h 25 ») dans le panier, à
   partir de la préparation et de l'heure choisie, et rappelée dans « Mes commandes ».
4. **Code de remise en plein écran au comptoir.** Bouton « Montrer au comptoir » : 4 chiffres en très grand, écran
   maintenu allumé (Wake Lock), retour automatique ; jamais de copie ni de capture proposée.
5. **Payer le solde en un geste depuis l'avis « commande acceptée ».** Lien direct vers le panneau de paiement du solde
   (montant relu en base), pour ne rien sortir au comptoir ou au livreur.
6. **Retrait par un proche.** « Envoyer le code à un autre numéro » (une fois par commande, numéro vérifié par SMS,
   journalisé) : le cas fréquent du collègue ou du frère qui passe chercher la commande.

---

## 6. Pour les correctifs

- Partir de cette branche : `cv12b-1-trous` (T1, T2) et `cv12b-3-statique` (T3) doivent passer au vert sans changer
  leurs assertions ; `cv12b-2-gardes` doit rester vert.
- T1 bloque la fusion (lectures REST cassées dès que les deux lots sont réunis) ; T2 avant l'ouverture des commandes ;
  T3 peut suivre.
- Les correctifs de T1 et T2 touchent des objets du 12c (règles après 20261224000005, `order_quote_compute`) : une
  migration nouvelle, datée après celles du 12c.

---

## Corrections

Correctifs sur `lot12b/client` (rapport du lot, section « Correctifs après contre-vérification »). Suites de l'audit
reprises telles quelles (`bed373124b`), sans les cinq migrations du 12c recopiées (elles viennent de main). Seules
modifications, acceptées par l'utilisateur le 27/11 : `cv12b-3-statique.test.ts:111` et `:137`, noms des migrations
(`20261222…` → `20261226…`, migrations renommées) ; `cvf2b-6-deconnexion.test.ts:631`, description de
`lib/device/device-prefs.ts` (« panier des commandes »). **Aucune assertion changée.**

| Test | État | Correctif | Run |
|---|---|---|---|
| `cv12b-1-trous` T1 — REST des produits, suppléments et portions avec les droits par colonne du 12c | **vert** (anon, client, propriétaire : 1 ligne chacun, aucune erreur ; `policies_whole_row` 0) | aides `product_public` et `product_owner_or_admin`, règles sans ligne entière (`e43aa7664b`, `d5082cc898`) | 777 (rapide) ; 779 (complet) |
| `cv12b-1-trous` T2 — fermeture exceptionnelle | **vert** (« tout de suite » et heure pendant la fermeture : HTTP 409 `VENUE_CLOSED`) | devis du 12c (`b52a9c255e`, fusionné `14d43a79ea`) ; carte alignée (`2b624f87a6`) | 777 (rapide) ; 779 (complet) |
| `cv12b-2-gardes` G1 à G6 | **verts** (G6 : la fiche d'un plat garde exactement ses champs ; le visuel des correctifs est servi à part, `699cf8fcd2`) | — | 777 (rapide) ; 779 (complet) |
| `cv12b-3-statique` T3 — panier et purge sans session | **vert** (« clés avant [panier, paiement] ; après [] » ; `device-prefs.ts` classé avec le panier) | portée « paiement » de `clearDevicePrefs` (`b7846278fa`) | 777 (rapide) ; 779 (complet) |
| `cv12b-3-statique` S1 à S4 | **verts** (S3 : 10 refus examinés, tous avec message) | — | 777 (rapide) ; 779 (complet) |
| suites du lot `l12b-commandes-client`, `l12b-produits-rest`, `migration-lot12b-rejouable` | **vertes** sur la base réunie (`l12b-produits-rest` rouge à l'audit, verte) | idem T1 | 777 (rapide) ; 779 (complet) |

Observation de l'audit (§ 4) : clé d'idempotence d'un paiement liée à sa commande (`f862d4db25`, refus
`IDEMPOTENCY_KEY_REUSED`). Fusion e2e (§ 4.2) : spec du 12c par le compteur partagé (`8b036a06fb`). Constat ouvert hors
du 12b : `order_payable_refusal` (12a) ne lit pas les fermetures (commande créée juste avant une fermeture encore
payable), signalé au rapport du lot.
