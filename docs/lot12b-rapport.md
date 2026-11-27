# Lot 12b — Commandes : écrans du client

Branche `lot12b/client` (depuis main `5b7f3399ca`, lot 11c-b fusionné), worktree `event-village-lot12b`. **Non fusionnée ;
aucune migration appliquée.** Service toujours fermé par `features.orders_enabled` (les tests l'ouvrent le temps de leur
passage).

## À lire en premier

**Migrations** (intervalle `20261222…`, sans BEGIN ni COMMIT, rejouables : appliquées deux fois de plus dans une
transaction annulée par `tests/schema/migration-lot12b-rejouable.test.ts`) :

| Fichier | Contenu |
|---|---|
| `20261222000001_l12b_code_visible.sql` | clé `private.order_code_enc_key` (32 octets tirés une fois) ; table `private.order_codes` (code chiffré `pgp_sym_encrypt` AES-256, empreinte au moment de l'émission) ; **seule recopie du lot** : `private.order_issue_code` depuis `20261130000006_l12a_etapes.sql:281-299` (aucune ligne perdue, contrôlé) ; déclencheur `private.order_codes_clear` (code effacé dès que `orders.code_hash` repasse à vide ou change) ; fonction nouvelle `order_code_reveal` |
| `20261222000002_l12b_carte_des_plats.sql` | fonction nouvelle `order_venue_menu(établissement)` ; règles REST `products_read` (`0003_rls.sql:237-238`), `product_options_read` et `product_daily_portions_read` (`20261130000002:425-430`) limitées aux établissements listés |
| `20261222000003_l12b_garde_prix.sql` | colonne `orders.client_request_key` (index unique par client) ; enveloppes `order_create_checked` et `order_payment_start` (aucune recopie de `order_create` ni `order_payment_create`) |

Droits : les quatre fonctions publiques nouvelles au rôle de service seulement ; les aides et tables de `private` à aucun
rôle de l'API (clé de service comprise) ; `supabase/hotfix/2026-10-31-lot1a/03-verification.sql` inchangé et vérifié par
le test de migration (aucune fonction ajoutée à la liste blanche). Fonctions du 12c jamais touchées
(`order_quote_compute`, `product_regulated`, `products_order_guard`, `order_product_regulation_decide`), ni les 9 recopies
du 12a suivies par `cv12a-3-statique` S1 (contrôlé).

**Failles et constats** :

1. **Lecture REST des produits ouverte à tous (existant, corrigé)** : `products_read` (`0003_rls.sql:237`) laissait lire
   avec la clé anon tout produit DISPONIBLE, y compris d'une **partenaire suspendue**, d'un **établissement suspendu ou non
   validé** et les produits sans établissement ; suppléments et portions suivaient. Test rouge sur main :
   `tests/parcours/l12b-commandes-client.test.ts` B (clé anon et autre compte : un seul produit attendu, quatre servis
   avant la migration) ; vert après `20261222000002`.
2. **Route publique de la carte** : servait les produits d'une partenaire (aucun établissement) et une **photo d'un site
   extérieur** (Unsplash) pour chaque produit sans image ; remplacée par `order_venue_menu` (établissement listé et ouvert à
   la commande, aucun champ interne, aucune image extérieure) ; test A et test statique.
3. **Constat sans correctif (hors de mon périmètre)** : `order_quote_compute` ne vérifie pas les **fermetures
   exceptionnelles** (`venue_closures`) ; une commande « forgée » pendant une fermeture passe. La carte du 12b retire déjà
   les fermetures des heures proposées et coupe « Tout de suite ». À corriger dans la recopie du 12c (fonction interdite au
   12b) : `docs/apres-lancement.md`.
4. **Fusion avec le 12c (e2e)** : `e2e/lot12c.responsive.spec.ts` ouvre `features.orders_enabled` puis le remet à sa
   valeur d'avant ; s'il tourne en même temps que le spec du 12b, il peut refermer le service sous ses pas (cause du run
   722 pour les tables). Le 12b ajoute le compteur partagé `e2e/support/orders-service.ts` : le spec du 12c doit l'utiliser
   à la fusion.

**Tests existants modifiés** (aucune suite d'audit `tests/audit/` ni `tests/audit-auth/` modifiée) :

| Test | Avant | Après | Raison |
|---|---|---|---|
| `tests/parcours/interrupteurs.test.ts` (PUBLIC_GETS, préparation) | carte lue par l'identifiant de la partenaire, produit sans établissement | carte lue par l'identifiant de l'établissement, produit de l'établissement ouvert à la commande | la carte des plats est celle d'un établissement (consigne) |
| `tests/parcours/l11a-cv-correctifs.test.ts` (T6) | identifiant de la partenaire → 200 | identifiant de l'établissement → 200 ; nom, nom partiel, « rest-… », **identifiant de la partenaire** → 404 | même exigence (identifiant exact seulement), sur l'établissement |
| `tests/parcours/client-interface.test.ts` (entrée « Restaurants et tables ») | lien en `/restaurants/…` | lien `/tables` ou `/restaurants/…` | le lien de la coquille mène à la recherche des établissements (consigne) ; même exigence d'interrupteur |
| `e2e/carte-b3.responsive.spec.ts:96` | 10 champs publics d'un lieu | 11 champs (`orders`), faux pour une salle | nouveau champ public de la carte des lieux (bouton « Commander ») |

Assertions d'audit gardées telles quelles et vertes : `cv11a-4-droits:339-346` (identifiant partiel → 404),
`cvf2b-6-deconnexion:200` (`app/orders/page.tsx` garde sur la perte du compte) et 13b (écritures du stockage web : toutes
dans `lib/device/device-prefs.ts`), `cv12a-1/2/3`, `cv11a-4`, `r25` (le compte vient de la session).

**Fichiers partagés touchés** : `components/layout/AppLayout.tsx` (une ligne : « Restaurants et tables » →
`/tables`) ; `lib/device/device-prefs.ts` (ajout : lecture et écriture brutes du panier) ; `lib/notifications/catalog.ts`
(texte de la cloche du code) ; `lib/validations/payment.ts` (champ facultatif `expectedAmount`) ;
`app/api/payments/create/route.ts`, `app/api/payments/[transactionId]/status/route.ts` ; `lib/lieux/carte-lieux*.ts`,
`components/explore/MapPlaceCard.tsx` (chargés en différé par Explorer) ; `app/tables/(catalogue)/[id]/page.tsx` (encart
« Commander ») ; `tests/helpers/design-files.ts`, `e2e/support/responsive-pages.ts` (lignes voisines de celles du 12c :
conflit attendu à la fusion, les deux listes sont à garder) ; `docs/apres-lancement.md`. `lib/orders/booking.ts` : **non
touché** (aides du client dans `lib/orders/client-view.ts`, sans dépendance serveur).

## Écrans livrés

(à compléter avec les captures du run final)

## Serveur ajouté

(à compléter)

## Tests et accès

(à compléter)

## Poids JavaScript et mesure mobile

(à compléter)

## Captures

(à compléter)

## Runs

(à compléter)

## Essais pour un non-développeur

(à compléter)

## Autres idées

(à compléter)
