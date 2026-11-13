# 06 — Achat et paiement : fiche publique, panier, gratuits, Wave et Orange Money, suivi, cas difficiles, circuit de l'argent

> Guide complet de l'application Event Village, état de `main` à `0889df6` (lots 1 à 9 ter). Source de vérité : le code.
> Chaque fait porte sa preuve `fichier:ligne` (chemins relatifs au dépôt ; `M/` = `supabase/migrations/`).
> Ce qui n'a pas pu être établi est marqué **NON VÉRIFIÉ**. Données d'exemple fictives : cliente « Fatou Diop »
> (numéro `77 000 00 00`), événement « Concert Test » (samedi 5 décembre 2026 à 20:00), catégories « Standard »
> 5 000 F, « VIP » 12 500 F, « Enfant » gratuite.
> Les billets eux-mêmes (Mes billets, QR, transfert, invitations) sont dans `07-billets.md` ; les remboursements, versements
> et le rapprochement dans `08-argent.md` ; les messages (canaux, heures calmes, plafonds) dans `10-notifications.md` ;
> les tâches planifiées dans `12-taches-planifiees.md`. Les écarts relevés sont listés dans `15-constats.md` (W6-xx).

## Sommaire

| N° | Scénario |
|---|---|
| 06.1 | La fiche publique d'un événement : bandeaux, formules, états de stock, mise à jour en direct |
| 06.2 | Les cartes du catalogue : « À partir de », « Gratuit », badges « Dernières places » et « Complet » |
| 06.3 | Composer son panier : quantités, limites, total calculé par le serveur, visiteur non connecté |
| 06.4 | Panier entièrement gratuit : réservation sans paiement, limite par compte |
| 06.5 | Panier mixte (gratuits et payants) |
| 06.6 | La fenêtre « Paiement sécurisé » : opérateur, numéro du payeur, lancement |
| 06.7 | Payer avec Wave (lien de paiement) |
| 06.8 | Payer avec Orange Money (lien de l'application ou QR) |
| 06.9 | La page de suivi `/paiement/{id}` : attente, durée de garde des places, ce que la cliente va recevoir |
| 06.10 | Paiement confirmé : billets émis, messages, ce que voient la partenaire et l'administration |
| 06.11 | Retour depuis l'application de l'opérateur (adresses de retour) |
| 06.12 | Paiement refusé ou échoué ; « Réessayer le paiement » |
| 06.13 | Annuler un paiement en attente (vérification chez SamirPay d'abord) |
| 06.14 | Paiement abandonné : page fermée, places libérées, paiement expiré |
| 06.15 | Second achat pendant qu'un paiement attend |
| 06.16 | Succès tardif après l'échéance des places (H1) |
| 06.17 | Double paiement du même panier |
| 06.18 | Prix minimum d'un billet payant |
| 06.19 | Erreurs de SamirPay traduites pour la cliente (tableau) |
| 06.20 | SamirPay ne répond pas (au lancement, pendant le suivi, à l'annulation) |
| 06.21 | Le circuit de l'argent : qui reçoit quoi, avec un exemple chiffré |
| 06.22 | « Mes paiements » : l'historique de la cliente |

Règles communes à tout le fichier :

- **Seuls Wave et Orange Money existent** comme moyens de paiement en ligne (`lib/samirpay/types.ts:7-8`). Free Money,
  Wizall, Kpay et carte bancaire : `14-non-implemente.md`.
- **Les montants viennent toujours du serveur.** Le navigateur n'additionne jamais de frais : il affiche le devis du
  serveur (`app/api/checkout/quote/route.ts:13-18`, `app/events/[id]/page.tsx:113`) ; le montant réellement demandé est
  recalculé en base à la création du paiement, prix relus sous verrou (`M/20261109000007_lot9bis_versements.sql:758-766`).
- **Statuts d'un paiement** (libellés de « Mes paiements », `lib/payments/payment-labels.ts:5-14`) : `PENDING`
  « En attente », `SUCCESS` « Confirmé », `FAILED` « Échoué », `CANCELLED` « Annulé », `EXPIRED` « Expiré »,
  `REFUND_PENDING` « Remboursement en cours », `REFUNDED` « Remboursé », `PARTIAL` « Remboursé en partie ».
- **Durées** (valeurs à l'installation) : garde des places 10 minutes (réglage SUPERADMIN `finance.payment_hold_minutes`,
  5 à 60, `M/20261109000001_lot9bis_reglages.sql:33`, `lib/payments/checkout.service.ts:101-108`) ; validité d'une demande
  chez SamirPay 60 minutes (`lib/payments/checkout.service.ts:95-99`) ; délai d'attente de SamirPay 15 secondes
  (`lib/env.ts:43`) ; succès tardifs recherchés pendant 48 h (`lib/env.ts:78`).

---

## 06.1 La fiche publique d'un événement : bandeaux, formules, états de stock, mise à jour en direct

1. **Qui, où.** Tout le monde, connecté ou non : `/events/{id}` (route publique, `middleware.ts:108-111`). On y arrive
   depuis une carte de l'accueil ou d'« Explorer » (06.2), ou par un lien partagé (bouton « Partager l’événement »).
2. **Ce qu'il saisit.** Rien (le panier : 06.3).
3. **Ce que fait le système.**
   - **Visibilité.** Un événement Brouillon, En attente, Validé (jamais publié), ou Terminé sans avoir été publié répond
     « Erreur 404 » / « Événement introuvable » / « Cet événement n’existe pas ou n’est pas ouvert au public. Vérifiez le
     lien reçu, ou parcourez les événements à venir. », boutons « Voir les événements » et « Retour à l’accueil »
     (`app/api/events/[id]/route.ts:35-46`, `:89`, `app/events/[id]/page.tsx:325-346`). Publié, Suspendu, Annulé et
     Terminé (après publication) s'affichent.
   - **Bandeau d'état** (`app/api/events/[id]/route.ts:14-31`, `app/events/[id]/page.tsx:842-855`) :

     | Statut | Titre | Texte exact |
     |---|---|---|
     | Suspendu | « Événement suspendu » | « La billetterie est momentanément fermée par l’organisation. Les billets déjà achetés restent valables ; vous serez informé de la suite. » |
     | Annulé | « Événement annulé » | « Cet événement n’aura pas lieu. Les billets payés en ligne sont remboursés automatiquement. » puis l'encadré « Message de l’organisateur » (avis public saisi à l'annulation) et « Annulé le {date et heure} » ; dans la colonne de droite, « Remboursement » : « Les billets payés en ligne sont remboursés automatiquement sur le compte Mobile Money utilisé pour l’achat, frais de service compris. Les billets réglés en espèces sont remboursés par l’organisateur. » et le bouton « Voir mes billets » |
     | Terminé | « Événement terminé » | « Cet événement a eu lieu. La billetterie est fermée. » |

     Le motif interne d'une annulation n'est jamais montré (`app/api/events/[id]/route.ts:158-174`).
   - **Formules affichées** : seulement les catégories **actives ET vendues en ligne** ; une catégorie « guichet seul » ou
     « invitations seulement » n'apparaît pas (`app/api/events/[id]/route.ts:113`). Pour chacune : nom, prix
     (« Gratuit » pour 0, sinon ex. « 5 000 F CFA »), description, et un état (`app/events/[id]/page.tsx:266-284`) :

     | État | Texte exact |
     |---|---|
     | Plus aucune place (vendues + retenues par un paiement en cours = quantité) | « Complet » |
     | Vente pas encore ouverte | « Vente à partir du {date et heure} », ex. « Vente à partir du sam. 21 nov. 2026 à 10:00 », ou « Bientôt en vente » sans date |
     | Vente close (date de fin de vente passée) | « Vente terminée » |
     | Restant au seuil ou dessous (10 à l'installation, réglable) | « Plus que {n} places », ex. « Plus que 3 places » ; pour 1 : « Plus qu’une place » |
     | Sinon | « Disponible » |

     Le restant = quantité mise en vente − vendues − retenues ; il n'est jamais donné au-dessus du seuil
     (`app/api/events/[id]/route.ts:120-132`). Le seuil est commun à toute la plateforme (réponse détaillée :
     06.2).
   - **Achetable ?** Le module d'achat (« Choisissez vos billets », « Places et disponibilités mises à jour en direct. »)
     n'apparaît que si l'événement est Publié, pas encore fini (fin saisie, sinon début + 6 h) et qu'au moins une
     formule est en vente avec des places (`app/api/events/[id]/route.ts:93`, `:123`, `:149-150`,
     `app/events/[id]/page.tsx:1012-1017`). Sinon, la colonne s'appelle « Billetterie » et dit pourquoi
     (`app/events/[id]/page.tsx:1151-1163`) :
     - suspendu, annulé ou terminé : « La vente de billets est fermée pour cet événement. » ;
     - toutes les ventes en ligne closes : « La vente en ligne est terminée pour cet événement. » ;
     - tout est complet avec des places retenues par des paiements en cours : « Toutes les places sont vendues ou en
       cours de paiement. Des places peuvent se libérer : cette page se met à jour d’elle-même. » ; sans place retenue :
       « Toutes les places ont été vendues. » ;
     - sinon : « Aucune catégorie n’est en vente pour le moment. Revenez bientôt : cette page se met à jour d’elle-même. »
     puis la liste des formules (sans état si l'événement a un bandeau) et « Voir d’autres événements ».
   - **Infos** : « Date et heure » (ex. « Samedi 5 décembre 2026 à 20:00 », fin seulement si une date de fin est saisie,
     ex. « Jusqu’à 23:00 »), « Lieu », « À propos de l’événement », « Programme », « Lieu et accès » (carte, « Voir
     l’itinéraire », « Accès et transports », « Stationnement », « Contact de l’organisateur », « Règlement et
     consignes »), « Organisé par {nom} » (`app/events/[id]/page.tsx:890-1007`, `app/api/events/[id]/route.ts:96-105`,
     `:176-228`). Sans heure de début enregistrée, la fiche affiche « 20:00 » (`app/api/events/[id]/route.ts:104`,
     constat W6-11).
   - **Direct.** La fiche s'abonne au résumé public de l'événement et au stock de ses catégories ; chaque changement
     relit la fiche sans recharger la page (`app/events/[id]/page.tsx:471-479`). Une relecture ratée affiche « La page
     n’a pas pu être mise à jour » / « {message} Les informations affichées sont celles du dernier chargement. » et
     « Réessayer » (`:861-874`). Le panier en cours est réduit automatiquement à ce qui reste achetable (`:482-497`).
   - Erreur au premier chargement : « Impossible d’afficher l’événement » avec « Connexion impossible : vérifiez votre
     réseau, puis réessayez. » (ou le message du serveur) et « Réessayer » (`:209`, `:673-689`).
4. **Messages envoyés.** Aucun.
5. **Ce que voient les autres rôles.** Rien de propre à cette page. Une vente, un abandon de paiement ou un changement
   de quantité par la partenaire se voit ici en direct (essai 79).
6. **Refus.** Voir 3 (404 et billetterie fermée).
7. **Preuves et essai.** Fichiers cités. Recette : essais 3, 5, 6, 21, 79 (`docs/recette-billetterie.md:355-418`,
   `:675-690`, `:1702-1721`).

## 06.2 Les cartes du catalogue : « À partir de », « Gratuit », badges « Dernières places » et « Complet »

1. **Qui, où.** Tout le monde : accueil `/`, « Explorer » `/explore`, section « Populaires » de l'accueil
   (`app/page.tsx:297-298`, `app/explore/page.tsx:326-327`, `components/events/HomeDiscovery.tsx:55-56`). Seuls les
   événements Publiés pas encore finis sont listés, triés par date de début, les complets après ceux en vente à date
   égale (`app/api/events/route.ts:34-37`, `:63-75`).
2. **Ce qu'il saisit.** Recherche, ville, catégorie (filtres : `01-roles-menus-ecrans.md`).
3. **Ce que fait le système.**
   - **Catégorie « achetable en ligne »** : active, vendue en ligne, au moins une place restante (retenues déduites),
     vente commencée et pas close (`lib/events/catalog.server.ts:107-110`).
   - **Bas de la carte** (`components/events/EventCard.tsx:130-141`, `lib/events/catalog.server.ts:189-194`) :
     - s'il existe au moins une catégorie achetable : ligne « À partir de », puis le plus petit prix parmi elles :
       « Gratuit » s'il vaut 0, sinon le montant (ex. « 5 000 F CFA ») ;
     - sinon : ligne « Billetterie », puis l'état servi par le serveur (`lib/events/catalog.server.ts:130-143`) :
       « Bientôt en vente » (une catégorie en ligne avec des places n'a pas encore ouvert), « Complet » (plus aucune
       place en ligne ni au guichet), « Vente sur place uniquement » (des places restent au guichet), « Vente en ligne
       terminée » (toutes les ventes en ligne closes), à défaut « Bientôt en vente ».
     - **Règle de « À partir de Gratuit »** : une catégorie gratuite encore achetable en ligne fait descendre le minimum
       à 0, quels que soient les prix des autres : la carte écrit « À partir de » / « Gratuit ». C'est aussi le cas quand
       **toutes** les catégories sont gratuites. Si la gratuite est épuisée, close, inactive ou vendue seulement au
       guichet, elle ne compte plus : « À partir de » / prix de la payante la moins chère. Le libellé serveur « Gratuit »
       sans « À partir de » existe mais n'est jamais affiché quand un prix existe (constat W6-03).
   - **Badge de stock** (`lib/events/catalog.server.ts:112-128`, `components/events/EventCard.tsx:112-117`), jamais de
     nombre :
     - « Dernières places » : toutes les catégories achetables en ligne de l'événement ont un restant ≤ seuil ; une
       seule au-dessus du seuil suffit à ne rien afficher ;
     - « Complet » : plus aucune catégorie achetable en ligne, et au moins une catégorie en ligne épuisée sans être
       close.
   - **Seuil** : réglage unique `access.low_stock_threshold`, 10 à l'installation, entier de 1 à 1 000, modifiable par le
     SUPERADMIN seul dans `/admin/finance-settings`, section « Contrôle d’accès », ligne « Seuil « bientôt complet » »
     (`M/20261102000006_lot5_temps_reel.sql:30-34`, `M/20261110000002_lot9ter_reglages.sql:89`,
     `app/admin/finance-settings/page.tsx:81`, scénario 11.13). Ni par catégorie, ni par événement. Valeur illisible ou
     hors bornes : 10 (`lib/events/low-stock.server.ts:12-18`). L'aide de l'écran ne cite que la fiche (constat W6-04).
   - Les « Populaires » sont gardés 60 secondes en cache côté serveur : leur badge peut avoir une minute de retard
     (`app/api/events/popular/route.ts:9-13`).
4. **Messages envoyés.** Aucun.
5. **Ce que voient les autres rôles.** Identique pour tous.
6. **Refus.** Sans objet.
7. **Preuves et essai.** Fichiers cités ; c'est la réponse aux questions « Dernières places » et « À partir de Gratuit » de la recette (00-index.md). Recette : essais 3, 4, 64, 79
   (`docs/recette-billetterie.md:355-387`, `:1419-1434`, `:1702-1721`).

## 06.3 Composer son panier : quantités, limites, total calculé par le serveur, visiteur non connecté

1. **Qui, où.** Toute personne sur la fiche d'un événement achetable, colonne « Choisissez vos billets » (sur téléphone,
   une barre d'achat apparaît en bas dès qu'un billet est choisi) (`app/events/[id]/page.tsx:1015-1016`, `:1206-1220`).
2. **Ce qu'il saisit.** Les boutons « - » et « + » de chaque formule (« Retirer un billet {formule} », « Ajouter un
   billet {formule} »). Limite par formule : le maximum par commande de la catégorie (10 si non renseigné, 50 au plus en
   base) et, quand le restant est affiché, ce restant ; « + » se grise à la limite (`app/events/[id]/page.tsx:576-590`,
   `:1040-1062`, `lib/payments/checkout.service.ts:31-32`). Sans billet : « Choisissez au moins un billet avec le
   bouton « + ». » (`:1144-1146`).
3. **Ce que fait le système.**
   - **Devis du serveur** dès qu'un billet payant est dans le panier (un court délai de 250 ms regroupe les clics) :
     lignes, prix des billets, frais de service, total (`app/events/[id]/page.tsx:612-662`,
     `app/api/checkout/quote/route.ts:13-59`, `M/20261101000003_lot3_moteur.sql:122-147`). Affichage : sous chaque formule
     « {n} × {prix} : {montant de la ligne} », ex. « 2 × 5 000 F CFA : 10 000 F CFA » ; récapitulatif « Billets »,
     « Frais de service », « Total ({n} billets) » ; bouton « Acheter {n} billet(s) ({total}) », ex. « Acheter 3 billets
     (23 625 F CFA) » (barre du téléphone : « Acheter (23 625 F CFA) ») ; tant que le devis manque : « Calcul du
     total… » ; en échec : « Total indisponible », bandeau « Total indisponible » avec le message et « Réessayer »
     (`app/events/[id]/page.tsx:1064-1132`, `:785-792`). Sous le bouton : « Paiement Wave ou Orange Money. Frais de
     service calculés par Event Village sur chaque billet. » et « Billet avec QR code émis dès le paiement »
     (`:1133-1141`).
   - **Frais de service** : par billet, prix × taux (5 % à l'installation, réglage `finance.service_fee_rate`, 0 à 50 %)
     arrondi au franc supérieur, payés par l'acheteur ; un billet gratuit n'a pas de frais
     (`M/20261101000003_lot3_moteur.sql:5-8`, `:88`). Ex. 5 000 F → 250 F ; 12 500 F → 625 F ; 1 000 F → 50 F.
   - Messages du devis : « Panier invalide. », « Panier vide. », « Catégorie inconnue pour cet événement ou quantité
     invalide. », « Devis momentanément indisponible. », « Le total n’a pas pu être calculé (erreur {code}). »,
     « Connexion impossible : le total n’a pas pu être calculé. », « Réponse inattendue du serveur pour le calcul du
     total. » (`app/api/checkout/quote/route.ts:26-57`, `M/20261101000003_lot3_moteur.sql:131-146`,
     `app/events/[id]/page.tsx:636-656`).
   - **Visiteur non connecté** qui touche « Acheter » : toast « Connectez-vous pour acheter un billet. », renvoi vers
     `/login?redirect=/events/{id}` ; le panier est gardé 30 minutes dans l'onglet et rétabli au retour, dans la limite
     de ce qui reste achetable, avec « Votre sélection est reprise : vérifiez-la puis continuez. » ou « Les billets
     choisis avant la connexion ne sont plus disponibles. » (`app/events/[id]/page.tsx:210-263`, `:540-561`, `:695-700`).
   - Cliquer « Acheter » pendant le calcul : « Calcul du total en cours : patientez un instant. » (`:777-780`).
4. **Messages envoyés.** Aucun.
5. **Ce que voient les autres rôles.** Rien : un panier n'est enregistré nulle part tant que le paiement n'est pas lancé.
6. **Refus.** Voir 3.
7. **Preuves et essai.** Fichiers cités. Recette : essais 16, 17, 22 (`docs/recette-billetterie.md:592-625`, `:691-705`).

## 06.4 Panier entièrement gratuit : réservation sans paiement, limite par compte

1. **Qui, où.** Client connecté, compte actif, fiche d'un événement achetable ; panier composé uniquement de formules à
   0 F. Bouton « Réserver {n} billet(s) gratuit(s) », ex. « Réserver 2 billets gratuits » (barre du téléphone :
   « Réserver (2) ») ; total « Gratuit » (`app/events/[id]/page.tsx:785-792`, `:1097-1098`).
2. **Ce qu'il saisit.** Les quantités (06.3). Aucun opérateur, aucun numéro.
3. **Ce que fait le système.**
   - Appel `POST /api/checkout` avec une clé anti-doublon (un double clic ne crée pas deux fois les billets)
     (`app/events/[id]/page.tsx:703-722`, `lib/payments/checkout.service.ts:193-203`). Quota du compte : 10 achats par
     15 minutes et 50 par jour, gratuits compris (`lib/payments/checkout.service.ts:206-214`, `lib/env.ts:72-73`).
   - Contrôles de vente (06.6, tableau des refus), puis émission immédiate dans une seule transaction
     (`M/20261105000007_lot7_confirmation.sql:205-275`) :
     - **limite par compte** : pour chaque catégorie, billets déjà détenus par le compte dans cette catégorie
       (valables ou utilisés, quelle que soit leur origine) + quantité demandée ≤ maximum par commande de la catégorie
       (`:238-243`). Exemple : maximum 4, Fatou détient déjà 3 billets « Enfant » : elle peut en réserver 1, pas 2 ;
     - billets créés « valables », canal « gratuit », prix 0, stock vendu augmenté (`:244-255`) ;
     - confirmation mise en file dans la même transaction (`:257-268`).
   - Écran : toast « Billet gratuit réservé. » ou « {n} billets gratuits réservés. », puis Mes billets
     (`app/events/[id]/page.tsx:732-735`).
   - Un billet transféré à quelqu'un d'autre ne compte plus pour la limite de Fatou (il n'est plus à son compte).
4. **Messages envoyés.** Type `FREE_TICKETS_CONFIRMED` (détail 10).

   | Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
   |---|---|---|---|---|
   | Cliente | SMS | Indispensable (bloqué si le compte est suspendu) | File d'attente, envoyé à la minute suivante | « Event Village : {n} billet(s) gratuit(s) pour {titre, 30 car.} le {date courte}. Vos billets : {adresse}/tickets » — ex. « Event Village : 2 billets gratuits pour Concert Test le sam. 5 déc. à 20:00. Vos billets : https://app.exemple.sn/tickets » (121 caractères, 1 segment) |
   | Cliente | Cloche | Indispensable | Idem | « Billets confirmés » / « 2 billets gratuits pour « Concert Test » le sam. 5 déc. 2026 à 20:00. Vos billets sont dans Mes billets. » |
   | Cliente, si adresse vérifiée | Email | Indispensable | Idem | Mêmes faits, liste des numéros de billets, bouton « Voir mes billets » (10) |

   Preuves : `lib/notifications/catalog.ts:670-689`, registre `M/20261103000002_lot6_outbox.sql:79`.
5. **Ce que voient les autres rôles.** La partenaire : stock vendu à jour dans le pilotage, en direct
   (`app/partner/events/[id]/page.tsx:90-98`). **Aucun** avis « premier billet vendu » ni « nouvelle commande » pour un
   gratuit (le premier ne compte que les ventes en ligne payées et au guichet : `M/20261103000005_lot6_billetterie.sql:831`,
   `:857-861`). Avis « catégorie complète » ou « événement complet » si la réservation épuise le stock (10).
6. **Refus (texte exact).**
   - Limite atteinte : « Limite de {max} billet(s) gratuit(s) « {catégorie} » par compte atteinte. », ex. « Limite de 4
     billet(s) gratuit(s) « Enfant » par compte atteinte. » (`M/20261105000007_lot7_confirmation.sql:242`,
     `lib/payments/checkout.service.ts:234-237`).
   - Catégorie devenue payante : « La catégorie « {nom} » est payante. » (`:228`) ; prix changé entre l'affichage et
     l'envoi : « Le prix de ce panier a changé : vérifiez le récapitulatif puis relancez. » (`app/events/[id]/page.tsx:746-751`).
   - Contrôles de vente, quota, session : voir 06.6 (6) ; session expirée : renvoi à la connexion, panier gardé
     (`app/events/[id]/page.tsx:740-745`) ; réseau : « Connexion impossible : vérifiez votre réseau, puis réessayez. »
     (`:765-769`).
7. **Preuves et essai.** Fichiers cités. Recette : essai 20 (`docs/recette-billetterie.md:659-674`). La route
   `POST /api/tickets/claim-free` (même règle, quota de 20 demandes par heure) n'est appelée par aucun écran
   (`app/api/tickets/claim-free/route.ts:13-18`, recherche de `claim-free` dans `app/` et `components/`).

## 06.5 Panier mixte (gratuits et payants)

1. **Qui, où.** Client connecté ; panier avec au moins une formule payante et au moins une gratuite (ex. 2 « Standard »,
   1 « VIP », 1 « Enfant »).
2. **Ce qu'il saisit.** Comme 06.6 : tout le panier part en un seul paiement.
3. **Ce que fait le système.**
   - Le panier entier, gratuits compris, est envoyé à la fenêtre de paiement (`app/events/[id]/page.tsx:775-783`,
     `:1222-1238`). Le billet gratuit compte 0 F et 0 F de frais dans le total (`M/20261101000003_lot3_moteur.sql:83-98`).
   - Les places de **toutes** les lignes sont retenues ensemble pendant la garde (`M/20261109000007_lot9bis_versements.sql:796-803`) ;
     tous les billets, gratuits compris, sont émis ensemble à la confirmation du paiement, ou aucun
     (`M/20261106000003_lot8_paiement.sql:196-221`). Le billet gratuit ainsi émis porte le canal « en ligne » et le
     prix 0.
   - **La limite des gratuits par compte (06.4) ne s'applique pas** dans un panier mixte : seuls le maximum par
     commande et le stock sont contrôlés (`M/20261106000001_lot8_canaux.sql:211-277`) ; aucune trace du contrôle
     « par compte » dans `checkout_create_payment` ni dans `payment_confirm` (constat W6-02).
   - La confirmation d'achat (06.10) compte tous les billets, ex. « 4 billets ».
4. **Messages envoyés.** Ceux d'un achat payant (06.10) ; jamais `FREE_TICKETS_CONFIRMED`.
5. **Ce que voient les autres rôles.** Comme 06.10.
6. **Refus.** Comme 06.6.
7. **Preuves et essai.** Fichiers cités. NON VÉRIFIÉ en exécution (aucun essai du cahier ne mélange gratuit et payant).

## 06.6 La fenêtre « Paiement sécurisé » : opérateur, numéro du payeur, lancement

1. **Qui, où.** Client connecté, panier avec au moins un billet payant, devis reçu ; bouton « Acheter … » de la fiche.
   Fenêtre « Paiement sécurisé », sous-titre « Mobile Money, par SamirPay » (`app/events/[id]/page.tsx:777-782`,
   `components/payment/PaymentModal.tsx:496-503`).
2. **Ce qu'il saisit.**

   | Élément (libellé exact) | Obligatoire | Aide, limites, erreurs exactes | Preuve |
   |---|---|---|---|
   | « Récapitulatif » : titre « {événement} ({n} × {formule} + …) », « Prix des billets », « Frais de service ({taux} %) », « Total à payer » | — | ex. « Concert Test (2 × Standard + 1 × VIP + 1 × Enfant) », « Frais de service (5 %) » | `PaymentModal.tsx:557-589`, `app/events/[id]/page.tsx:1233` |
   | « Moyen de paiement » : « Wave » ou « Orange Money » (sous-titre « Mobile Money ») | oui, rien n'est présélectionné | « Choisissez l’opérateur avec lequel vous allez payer. » | `PaymentModal.tsx:649-710` |
   | « Numéro {Wave, Orange Money ou Mobile Money} du payeur », préfixe « +221 », exemple « 77 123 45 67 », 20 caractères au plus | oui | aide « Mobile sénégalais, avec ou sans +221. La demande de paiement sera liée à ce numéro. » ; prérempli avec le numéro du profil : « Numéro de votre profil. Modifiez-le si un autre compte {opérateur} paie. » ; vide : « Le numéro du payeur est obligatoire. » ; mal formé : « Numéro invalide : mobile sénégalais de 9 chiffres commençant par 70, 75, 76, 77 ou 78. » | `PaymentModal.tsx:275-300`, `:712-760`, `lib/payments/payer-phone.ts:1-13` |

   Une fois opérateur et numéro valides : « Vous validerez ensuite le paiement dans {opérateur}, depuis le +221
   {numéro}. » et toujours « Vos billets restent réservés pendant le paiement ; le temps restant s’affiche à l’étape
   suivante. » (`:762-781`). Bouton : « Payer {total} avec {opérateur} », ex. « Payer 23 625 F CFA avec Wave »
   (« Payer {total} » avant le choix ; « Connexion à {opérateur}… » pendant l'envoi) (`:480-492`). Pied : « Paiement
   sécurisé par SamirPay. Votre code secret ne vous sera jamais demandé ici. » (`:787-790`).
3. **Ce que fait le système** (`lib/payments/checkout.service.ts:184-342`), sans aucun débit tant qu'un contrôle échoue :
   1. clé anti-doublon de la tentative (même clé tant que la demande et son issue incertaine ne changent pas) ; une
      double soumission rend le paiement déjà créé (`:193-203`, `lib/payments/payment-client.ts:179-204`) ;
   2. quota du compte : 10 par 15 minutes, 50 par jour (`:206-214`) ;
   3. contrôles de vente (`M/20261106000001_lot8_canaux.sql:211-277`, tableau en 6) ;
   4. opérateur et numéro obligatoires (`:242-249`) ; durée de garde lue au réglage, sinon refus (`:251-259`) ;
   5. en base, sous verrou des catégories : réservations échues rendues, refus si un paiement de billets du même compte
      pour le même événement est encore en attente (06.15), contrôles refaits, prix relus, montants calculés par le
      moteur, paiement créé « En attente » avec les taux du moment, places de tout le panier retenues jusqu'à
      maintenant + durée de garde (`M/20261109000007_lot9bis_versements.sql:693-806`) ;
   6. demande à SamirPay (« cashin direct ») : montant total, numéro de commande, numéro du payeur, opérateur, adresse
      de notification propre au paiement, adresses de retour (06.11) ; un délai dépassé est relancé une seule fois avec
      le même numéro de commande (`lib/payments/checkout.service.ts:302-331`, `lib/payments/cashin-init.ts:84-92`) ;
   7. tout échec de SamirPay libère aussitôt les places et passe le paiement en échec (`:332-341`, 06.19).
   - Réussite : la fenêtre affiche « {opérateur} est ouvert » (lien ouvert) ou « Demande {opérateur} créée », avec
     « Validez le paiement de {total} dans {opérateur}, puis revenez ici : le suivi se met à jour tout seul. » ou « Sur
     la page de suivi, ouvrez {opérateur} ou scannez le QR code pour valider le paiement de {total}. », « Réservation
     valable jusqu’à {heure} », « Redirection vers le suivi du paiement… », « Suivre le paiement », puis passe à
     `/paiement/{id}` (`components/payment/PaymentModal.tsx:443-473`, `:504-547`).
   - Rejeu d'une tentative déjà close : « La demande précédente via {opérateur} n’a pas abouti ({échec, annulée ou délai
     dépassé}). Relancez le paiement pour en créer une nouvelle. » (`:445-452`, `:164-168`).
4. **Messages envoyés.** Aucun au lancement.
5. **Ce que voient les autres rôles.** La partenaire voit les places retenues baisser le restant (fiche et pilotage) ;
   aucun avis. L'administration voit le paiement « En attente » dans ses écrans de finance (08).
6. **Refus (texte exact).** Titre de l'encadré rouge selon le cas, puis le message (`PaymentModal.tsx:211-221`,
   `:609-647`, `lib/payments/payment-client.ts:221-254`) :

   | Cas | Titre | Message exact |
   |---|---|---|
   | Réseau coupé | « Connexion impossible » | « Le serveur est injoignable. Vérifiez votre connexion puis réessayez : votre demande ne sera pas dupliquée. » |
   | Session expirée | « Session expirée » | « Votre session a expiré : reconnectez-vous pour continuer. » + bouton « Se reconnecter » |
   | Quota | « Trop de tentatives » | « Trop de tentatives d’achat. Réessayez dans {délai}. » (bouton « Réessayer dans {délai} ») |
   | Paiement déjà en attente | « Un paiement est déjà en attente » | « Un paiement est déjà en attente pour cet événement : suivez-le avant d’en lancer un autre. » + « Suivre le paiement » |
   | Stock | « Plus assez de places » | « {formule} : Plus assez de places « {formule} » disponibles. » |
   | Autres contrôles | « Panier à ajuster » | une ligne par problème : « Cet événement n'est pas ouvert à la vente. », « Cet événement est terminé. », « La catégorie « {nom} » n'est plus en vente. », « La catégorie « {nom} » n'est pas vendue en ligne. », « La vente de « {nom} » n'est pas encore ouverte. », « La vente de « {nom} » est close. », « Au plus {n} billet(s) « {nom} » par commande. », « Le prix a changé : rechargez la page. », « Une catégorie apparaît plusieurs fois dans le panier. » (`M/20261106000001_lot8_canaux.sql:225-273`, `M/20261109000007_lot9bis_versements.sql:754`) |
   | Opérateur absent | « Paiement non lancé » | « Choisissez Wave ou Orange Money. » |
   | Numéro refusé | « Paiement non lancé » | « Numéro du payeur invalide (mobile sénégalais, 9 chiffres). » (aussi sous le champ) |
   | Garde indisponible | « Paiement non lancé » | « Achat momentanément indisponible. » |
   | Erreur interne | « Paiement non lancé » | « Erreur interne lors de l’achat. » |
   | Refus ou panne de SamirPay | « Paiement refusé » ou « Service de paiement indisponible » | voir 06.19 |
   | Réponse illisible | « Paiement non lancé » | « Réponse inattendue du serveur. Patientez un instant puis réessayez. » |

7. **Preuves et essai.** Fichiers cités. Recette : essais 16, 22 (`docs/recette-billetterie.md:592-609`, `:691-705`).

## 06.7 Payer avec Wave (lien de paiement)

1. **Qui, où.** Cliente qui a choisi « Wave » (06.6).
2. **Ce qu'il saisit.** La validation dans l'application Wave (hors Event Village).
3. **Ce que fait le système.**
   - SamirPay rend pour Wave un lien de paiement (`url`), éventuellement un QR ; aucun lien d'application dédié
     (`lib/samirpay/http-client.ts:249-261`, `lib/samirpay/types.ts:46-54`).
   - **Sur téléphone** : le lien est ouvert aussitôt (nouvel onglet pour un lien web) ; **sur ordinateur** : si un QR
     existe, rien ne s'ouvre et la page de suivi montre le QR, sinon le lien web s'ouvre dans un nouvel onglet
     (`components/payment/PaymentModal.tsx:190-209`, `:454-467`). Un blocage du navigateur est rattrapé par le bouton
     de la page de suivi.
   - Sur la page de suivi (06.9) : bouton « Ouvrir Wave » (ou « Rouvrir Wave » s'il a déjà été ouvert) ; sur
     ordinateur avec QR : « Scannez avec Wave » / « Ouvrez Wave sur votre téléphone, touchez « Scanner » puis visez ce
     code. » (`app/paiement/[id]/page.tsx:871-908`).
   - Ces liens ne sont connus que de l'onglet qui a lancé le paiement (mémoire de l'onglet) : ouverte ailleurs, la page
     dit « Validez la demande dans Wave, sur le téléphone du payeur. » (`lib/payments/payment-client.ts:287-331`,
     `app/paiement/[id]/page.tsx:899-905`).
   - NON VÉRIFIÉ : que SamirPay rende effectivement un QR pour Wave (le code le lit s'il est présent, sans le garantir).
4. **Messages envoyés.** Ceux de SamirPay et de Wave (hors Event Village, NON VÉRIFIÉ).
5. **Ce que voient les autres rôles.** Comme 06.6.
6. **Refus.** 06.12, 06.19.
7. **Preuves et essai.** Fichiers cités. Recette : essai 85 (`docs/recette-billetterie.md:1830-1846`).

## 06.8 Payer avec Orange Money (lien de l'application ou QR)

1. **Qui, où.** Cliente qui a choisi « Orange Money » (06.6).
2. **Ce qu'il saisit.** La validation dans Orange Money ou Max It.
3. **Ce que fait le système.**
   - SamirPay ne rend **pas** de lien web pour Orange Money ; il rend un lien d'application (`urls.OM`, à défaut
     `urls.MAXIT`) et un QR (base64 converti en image) (`lib/samirpay/http-client.ts:213-223`, `:254-261`,
     `lib/samirpay/types.ts:46-54`).
   - **Sur téléphone** : le lien de l'application est ouvert directement (la page reste en place) ; bouton « Ouvrir
     Orange Money » / « Rouvrir Orange Money » sur la page de suivi.
   - **Sur ordinateur** : pas de lien web à ouvrir ; la page de suivi montre le QR « QR code de paiement Orange Money »,
     « Scannez avec Orange Money », « Ouvrez Orange Money sur votre téléphone, touchez « Scanner » puis visez ce code. » ;
     sans QR : « Validez la demande dans Orange Money, sur le téléphone du payeur. » (`components/payment/PaymentModal.tsx:454-467`,
     `app/paiement/[id]/page.tsx:567-582`, `:763-767`, `:871-908`). Le QR est posé sur un fond blanc dans les deux thèmes.
4. **Messages envoyés.** Hors Event Village (NON VÉRIFIÉ).
5. **Ce que voient les autres rôles.** Comme 06.6.
6. **Refus.** 06.12, 06.19.
7. **Preuves et essai.** Fichiers cités. Aucun essai dédié (les essais 16 à 19 se font en mode simulé, voir 06.9).

## 06.9 La page de suivi `/paiement/{id}` : attente, durée de garde des places, ce que la cliente va recevoir

1. **Qui, où.** La cliente qui a lancé le paiement, connectée avec ce compte : `/paiement/{id}` (page réservée aux
   connectés, `middleware.ts:170-186`). On y arrive depuis la fenêtre de paiement, le bandeau 06.15, « Mes paiements »
   (06.22) ou le retour de l'opérateur (06.11).
2. **Ce qu'il saisit.** Rien, sauf « Annuler ce paiement » (06.13).
3. **Ce que fait le système.**
   - **Sondage** : statut relu tout de suite puis toutes les 3 secondes (10 secondes après 3 échecs réseau), en pause
     quand l'onglet est caché, relancé au retour dans l'application (`app/paiement/[id]/page.tsx:75-84`, `:363-470`).
     Le serveur demande lui-même le statut à SamirPay au plus toutes les 5 secondes pour un paiement non final
     (`app/api/payments/[transactionId]/status/route.ts:136-141`, `lib/env.ts:75`). Le sondage s'arrête sur un statut
     final, ou 2 minutes après la fin de validité de la demande (création + 60 min) ; la page dit alors « Confirmation
     non reçue » / « {opérateur} n’a pas encore confirmé ce paiement. Actualisez dans un instant : si votre compte a été
     débité, le paiement sera pris en compte automatiquement. » et « Actualiser le statut » (`:221-234`, `:422-428`,
     `:979-983`).
   - **En attente, places gardées** : pastille « En attente », « Validez le paiement » / « Confirmez le paiement de
     {total} dans {opérateur}. Cette page se met à jour automatiquement. » ; étapes « Demande envoyée », « Validation
     {opérateur} », « Confirmation » ; compte à rebours « Places gardées encore » {mm:ss}, « Vos places sont gardées {n}
     minutes. Validez le paiement sur votre téléphone avant l’échéance. Échéance à {heure}. » ; boutons d'opérateur (06.7,
     06.8) ; « Annuler ce paiement » (`:246-253`, `:518-565`, `:833-859`, `:985-995`).
   - **Après l'échéance des places, paiement toujours en attente** (H2, R47) : « Places plus garanties » / « Vos places
     ne sont plus garanties. Si vous validez quand même le paiement, vos billets seront émis s’il reste des places ;
     sinon vous serez remboursé automatiquement. » ; bandeau « Paiement toujours en attente. » / « Si vous n’avez pas
     validé sur votre téléphone, annulez-le : aucun autre paiement n’est possible pour cet événement tant que celui-ci
     n’est ni confirmé ni annulé. » / « Si vous avez déjà validé, attendez : vos billets arriveront, ou vous serez
     remboursé. » ; « La demande de paiement reste valable jusqu’à {heure} : cette page suit sa confirmation
     jusque-là. » ; « Annuler ce paiement » devient le bouton principal (`:236-244`, `:779-784`, `:861-868`, `:966-977`).
   - **« Ce que vous allez recevoir »** (`components/payment/PaymentWaitingInfo.tsx:34-127`) : l'événement et sa date,
     « {n} billets, avec leur QR code, dans Mes billets » (ou « 1 billet, avec son QR code, dans Mes billets ») et la
     liste « {n} × {formule} » ; « Dès la confirmation : » suivi des canaux réellement prévus : « Un SMS de confirmation
     au {numéro masqué} » (ex. « 77*****00 »), « Un email de confirmation, avec le détail de l’achat » (seulement si
     l'email est activé et l'adresse vérifiée), « Une notification dans Event Village »
     (`app/api/payments/[transactionId]/status/route.ts:90-108`, `lib/payments/payer-phone.ts:15-20`) ; encadré :
     « Gardez cette page ouverte pour suivre la confirmation. Si elle se ferme, votre achat est quand même enregistré :
     vous recevrez un SMS au {numéro masqué} et vos billets apparaîtront dans Mes billets. »
   - **Détails** : « Prix », « Frais de service », « Total » (« Total payé » après succès), « Opérateur », « Billets
     émis », « Référence » (8 premiers caractères de l'identifiant en capitales) (`app/paiement/[id]/page.tsx:922-961`).
     Pied : « Ne communiquez jamais votre code secret : Event Village ne vous le demandera pas. » (`:1052-1055`).
   - **Mode simulé (développement seulement)** : les pages `/dev/paiements/…` ne sont servies que sous `next dev`, jamais
     en production (`next.config.mjs:97-102`, `components/dev/FakePaymentPanel.tsx:10-17`).
4. **Messages envoyés.** Aucun pendant l'attente.
5. **Ce que voient les autres rôles.** Rien de cette page (réservée à la propriétaire du paiement).
6. **Refus (texte exact).** Identifiant mal formé : « Lien de paiement invalide » / « Ce lien ne correspond à aucun
   paiement. Retrouvez vos achats dans Mes billets. » ; non connecté : « Connexion requise » / « Connectez-vous avec le
   compte qui a lancé ce paiement pour suivre son statut. » + « Se connecter » ; paiement d'un autre compte ou inconnu :
   « Paiement introuvable » / « Ce paiement n’existe pas ou n’est pas associé à votre compte. Vérifiez que vous êtes
   connecté avec le bon compte. » ; compte non actif : « Accès refusé » / « Votre compte n'est pas actif. Contactez le
   support. » ; panne : « Statut momentanément indisponible » / « Le statut du paiement est momentanément indisponible.
   Nouvelle tentative automatique en cours… » + « Réessayer maintenant » ; réseau instable pendant l'attente :
   « Connexion instable : nouvelle vérification automatique dans quelques secondes. » (`app/paiement/[id]/page.tsx:680-757`,
   `:813-819`, `app/api/payments/[transactionId]/status/route.ts:125-134`, `lib/auth/session.ts:56-63`).
7. **Preuves et essai.** Fichiers cités. Recette : essais 16, 19 (`docs/recette-billetterie.md:592-609`, `:642-658`).

## 06.10 Paiement confirmé : billets émis, messages, ce que voient la partenaire et l'administration

1. **Qui, où.** Personne n'agit dans Event Village : la confirmation arrive par l'avis de SamirPay (adresse propre au
   paiement), par la page de suivi ou par la tâche de réconciliation (toutes les 5 minutes, 12.3).
2. **Ce qu'il saisit.** Rien.
3. **Ce que fait le système.**
   - **Seul le statut lu chez SamirPay fait foi.** L'avis reçu est enregistré, son jeton vérifié, puis le statut est
     demandé à SamirPay avec l'identifiant enregistré ; rien n'est confirmé sur la seule foi de l'avis
     (`lib/payments/webhook.service.ts:1-23`, `:80-129`, `lib/payments/confirmation.service.ts:159-196`).
   - **Émission, tout ou rien** (`M/20261106000003_lot8_paiement.sql:84-262`) : sous verrou de l'événement, le panier
     doit être honorable en entier (événement ni annulé, ni suspendu, ni terminé ; places encore retenues, ou libres si
     la garde est échue) et ne pas être un double (06.17) ; sinon remboursement (06.16). Puis réservations converties,
     stock vendu augmenté, un billet « valable » par place, avec son prix et ses frais de service ; paiement « Confirmé ».
   - **Argent** : la part de la partenaire est inscrite à son compte, disponible plus tard (06.21).
   - **Page de suivi** : « Confirmé » / « Paiement confirmé » / « Vos {n} billets sont disponibles dans Mes billets. »
     (« Votre billet est disponible dans Mes billets. » pour un seul), bouton « Voir mes billets », « Redirection
     automatique dans {n} s. » (6 secondes) et « Rester sur cette page » (`app/paiement/[id]/page.tsx:254-271`,
     `:997-1015`, `:84`).
4. **Messages envoyés.**

   | Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
   |---|---|---|---|---|
   | Acheteuse (au **numéro du payeur**) | SMS | Indispensable, envoyé même si le compte est suspendu | File d'attente, minute suivante | « Event Village : achat confirmé, {n} billet(s) {titre, 19 car.}. Frais de service {frais}, total payé {total}. {adresse}/tickets » — ex. « Event Village : achat confirmé, 4 billets Concert Test. Frais de service 1 125 F CFA, total payé 23 625 F CFA. https://app.exemple.sn/tickets » (141 caractères, 1 segment) |
   | Acheteuse | Cloche | Indispensable | Idem | « Achat confirmé » / « 4 billets pour « Concert Test » le sam. 5 déc. 2026 à 20:00. Total payé : 23 625 F CFA. Vos billets sont dans Mes billets. » |
   | Acheteuse, si adresse vérifiée | Email | Indispensable | Idem | Événement, billets par formule, « Montant payé » « {total}, dont frais de service {frais} », numéros (10 au plus), bouton « Voir mes billets » (10) |
   | Partenaire | Cloche | Optionnel (sujet « activité pro ») | À **chaque** vente confirmée | « Nouvelle commande » / « {n} billets vendus pour « {titre} » ({prix des billets, hors frais}). » — ex. « 4 billets vendus pour « Concert Test » (22 500 F CFA). » |
   | Partenaire | Cloche, push, SMS, email | Optionnel | **Une seule fois par événement**, au premier billet payé ou vendu au guichet ; SMS perdu en heures calmes (10) | `FIRST_TICKET_SOLD` : « Event Village : premier billet vendu pour Concert Test. Suivez vos ventes : https://app.exemple.sn/partner/events » (113 caractères) ; cloche « Premier billet vendu » / « Le premier billet de « Concert Test » est vendu. » |
   | Partenaire | Cloche, push, SMS, email | Optionnel | Quand une catégorie, puis tout l'événement, est épuisée | `CATEGORY_SOLD_OUT`, `EVENT_SOLD_OUT` (textes : 10) |

   Preuves : `lib/notifications/catalog.ts:648-669`, `:936-965`, `M/20261106000003_lot8_paiement.sql:224-252`,
   `M/20261103000005_lot6_billetterie.sql:831-861`.
5. **Ce que voient les autres rôles.** Mes billets de l'acheteuse se met à jour en direct (07.1). Partenaire : pilotage
   de l'événement, ventes et restants, en direct (`app/partner/events/[id]/page.tsx:90-98`) ; fiche publique et cartes
   en direct (06.1). Administration : le paiement dans ses écrans de finance (08). Un parrain éventuel : commission en
   attente (09.5).
6. **Refus.** Sans objet (les cas où le panier n'est plus honorable : 06.16, 06.17).
7. **Preuves et essai.** Fichiers cités. Recette : essais 16, 19 (`docs/recette-billetterie.md:592-609`, `:642-658`).

## 06.11 Retour depuis l'application de l'opérateur (adresses de retour)

1. **Qui, où.** La cliente qui a payé ou annulé dans Wave ou Orange Money.
2. **Ce qu'il saisit.** Rien.
3. **Ce que fait le système.**
   - À la création, Event Village transmet à SamirPay deux adresses de retour, **identiques** : `{adresse de
     l'application}/paiement/{id}`, pour le succès comme pour l'échec — **seulement si l'adresse de l'application
     commence par https** ; sinon aucune adresse n'est envoyée (`lib/payments/cashin-init.ts:50-60`,
     `lib/payments/checkout.service.ts:314-315`, `lib/samirpay/http-client.ts:234-236`).
   - La page de suivi ne déduit **rien** de l'adresse utilisée : elle relit le statut sur le serveur (06.9). Un retour
     « succès » avant la confirmation montre donc toujours « En attente » jusqu'à la confirmation réelle.
   - La page exige d'être connecté : si l'application de l'opérateur ramène dans un navigateur sans la session, la
     personne passe d'abord par la connexion (`middleware.ts:170-186`). NON VÉRIFIÉ : le navigateur utilisé par Wave et
     Orange Money au retour, et la prise en compte effective de ces adresses par SamirPay.
4. **Messages envoyés.** Aucun de plus.
5. **Ce que voient les autres rôles.** Rien.
6. **Refus.** Ceux de 06.9.
7. **Preuves et essai.** Fichiers cités. Recette : essai 85 (`docs/recette-billetterie.md:1830-1846`).

## 06.12 Paiement refusé ou échoué ; « Réessayer le paiement »

1. **Qui, où.** La cliente, sur `/paiement/{id}`, quand SamirPay dit le paiement échoué (refus dans l'application,
   solde insuffisant, délai de l'opérateur…) ; ou dès le lancement si SamirPay refuse la demande (06.19).
2. **Ce qu'il saisit.** « Réessayer le paiement ».
3. **Ce que fait le système.**
   - Statut lu « échoué » chez SamirPay : places rendues, paiement « Échoué » ; **cet échec n'est définitif qu'au bout de
     2 heures** après la création (un échec peut redevenir un succès, 06.16) ; un statut « annulé » chez SamirPay est
     définitif tout de suite (`lib/payments/confirmation.service.ts:44-48`, `:197-207`,
     `M/20261109000005_lot9bis_samirpay.sql:194-233`). SamirPay ne prévient pas des échecs : ils ne se connaissent que par
     la lecture du statut (page de suivi, tâche toutes les 5 minutes) (`app/api/cron/payments-reconcile/route.ts:12-27`).
   - Page : « Échoué » / « Le paiement n’a pas abouti » / « {opérateur} n’a pas confirmé le paiement de {total}. Vous
     pouvez réessayer ; si votre compte a tout de même été débité, contactez le support avec la référence ci-dessous. »
     (`app/paiement/[id]/page.tsx:272-280`).
   - « Réessayer le paiement » ramène sur `/events/{id}?reprise={paiement}` : le panier du paiement échoué est
     prérempli, dans la limite de ce qui reste achetable : « Panier précédent repris : vérifiez-le puis relancez le
     paiement. », « Panier précédent repris en partie (places limitées) : vérifiez-le puis relancez le paiement. »,
     « Les billets de votre panier précédent ne sont plus disponibles. », « Le panier précédent n’a pas pu être repris :
     choisissez à nouveau vos billets. », « Connexion impossible : le panier précédent n’a pas pu être repris. »
     (`app/api/payments/[transactionId]/status/route.ts:42-47`, `app/events/[id]/page.tsx:499-538`). Boutons
     complémentaires « Mes billets », et « Explorer les événements » s'il n'y a pas de reprise
     (`app/paiement/[id]/page.tsx:1017-1035`).
4. **Messages envoyés.** Aucun (aucun avis d'échec de paiement n'existe ; recherche de `PAYMENT_FAILED` dans
   `lib/notifications/catalog.ts` : absent).
5. **Ce que voient les autres rôles.** Places de nouveau disponibles sur la fiche et les cartes, en direct.
6. **Refus.** Ceux de 06.6 au nouvel essai.
7. **Preuves et essai.** Fichiers cités. Recette : essai 18 (`docs/recette-billetterie.md:626-641`).

## 06.13 Annuler un paiement en attente (vérification chez SamirPay d'abord)

1. **Qui, où.** La cliente, `/paiement/{id}`, bouton « Annuler ce paiement » (discret tant que les places sont gardées,
   principal après l'échéance) (`app/paiement/[id]/page.tsx:964-995`).
2. **Ce qu'il saisit.** La confirmation : « Annuler ce paiement ? » / « Nous vérifions d’abord auprès de l’opérateur : si
   vous avez déjà validé sur votre téléphone, le paiement est confirmé et vos billets émis. Sinon, la demande est
   abandonnée et la réservation libérée. », boutons « Annuler ce paiement » et « Continuer le paiement » (`:1058-1070`).
3. **Ce que fait le système** (`app/api/payments/[transactionId]/cancel/route.ts:19-107`) :
   - statut demandé d'abord à SamirPay ;
   - payé chez SamirPay : rien n'est annulé, les billets sont émis → toast « Votre paiement vient d'être confirmé. » ;
     payé mais impossible à honorer → « Votre paiement a été reçu mais ne peut pas être honoré : il est en cours de
     remboursement. » ; payé mais confirmation en échec → « Votre paiement est en cours de vérification : il ne peut pas
     être annulé. » ;
   - échoué ou annulé chez SamirPay : déjà libéré → statut réel affiché ;
   - toujours en attente (ou inconnu de SamirPay) : paiement « Annulé », places libérées → toast « Paiement annulé : la
     réservation a été libérée. » ; page « Paiement annulé » / « La demande a été annulée et la réservation libérée. Si
     vous aviez déjà validé sur votre téléphone, le paiement sera tout de même pris en compte ou remboursé
     automatiquement. » (`app/paiement/[id]/page.tsx:281-290`, `:647-651`).
   - Une annulation par la cliente reste surveillée 48 h : un succès tardif est honoré (06.16).
4. **Messages envoyés.** Aucun.
5. **Ce que voient les autres rôles.** Places libérées, visibles en direct sur la fiche.
6. **Refus (texte exact).** « Ce paiement n’est plus en attente. » (toast « Ce paiement n’est plus en attente : voici son
   statut à jour. ») ; SamirPay injoignable : « Vérification impossible pour le moment : réessayez dans un instant. »
   (rien n'est annulé à l'aveugle) ; session expirée : « Votre session a expiré : reconnectez-vous pour annuler. » puis
   renvoi à la connexion ; réseau : « Connexion impossible : l’annulation n’a pas été envoyée. Réessayez. » ;
   autre : « Annulation momentanément impossible. » (`app/api/payments/[transactionId]/cancel/route.ts:44-106`,
   `app/paiement/[id]/page.tsx:652-672`).
7. **Preuves et essai.** Fichiers cités. Aucun essai dédié.

## 06.14 Paiement abandonné : page fermée, places libérées, paiement expiré

1. **Qui, où.** La cliente lance un paiement puis ferme la page ou l'application de l'opérateur sans valider.
2. **Ce qu'il saisit.** Rien.
3. **Ce que fait le système.**
   - Les places restent retenues jusqu'à l'échéance de la garde (10 minutes à l'installation). Elles sont rendues par la
     tâche de réconciliation (toutes les 5 minutes), par la tâche horaire des places retenues, ou au prochain achat qui
     touche la même catégorie (`app/api/cron/payments-reconcile/route.ts:38-40`,
     `M/20261031000013_lot2_reservations.sql:229-247`, `M/20261109000007_lot9bis_versements.sql:716-720`) : au plus
     environ 15 minutes après l'abandon (essai 79, étape 6).
   - **Le paiement, lui, reste « En attente »** : la demande vit 60 minutes chez SamirPay. Passé ce délai, la lecture du
     statut le fait expirer (« Expiré », motif « en attente trop longtemps ») ; une demande jamais transmise à SamirPay
     expire de même au bout de 60 minutes (`lib/payments/confirmation.service.ts:209-215`,
     `app/api/cron/payments-reconcile/route.ts:62-66`, `lib/env.ts:77`).
   - Tant qu'il est « En attente », aucun nouvel achat n'est possible pour cet événement depuis ce compte (06.15).
   - Page si on la rouvre : « Délai de paiement dépassé » / « La réservation a expiré faute de confirmation à temps et
     les places ont été libérées. Si vous avez validé après l’échéance, le paiement sera pris en compte ou remboursé
     automatiquement. » (`app/paiement/[id]/page.tsx:291-300`).
4. **Messages envoyés.** Aucun (ni à la cliente, ni à la partenaire).
5. **Ce que voient les autres rôles.** Fiche : pendant la garde, « Toutes les places sont vendues ou en cours de
   paiement. Des places peuvent se libérer : cette page se met à jour d’elle-même. » si tout est retenu ; après,
   les places reviennent sans recharger (essai 79).
6. **Refus.** Sans objet.
7. **Preuves et essai.** Fichiers cités. Recette : essais 19, 79 (`docs/recette-billetterie.md:642-658`, `:1702-1721`).

## 06.15 Second achat pendant qu'un paiement attend

1. **Qui, où.** La cliente revient sur la fiche du même événement alors qu'un de ses paiements de billets est « En
   attente ».
2. **Ce qu'il saisit.** « Acheter … » puis un opérateur (06.6).
3. **Ce que fait le système.**
   - **Bandeau** sur la fiche : « Un paiement est déjà en attente pour cet événement » / « Paiement de {total} par
     {opérateur} à valider avant {heure}. Suivez-le au lieu d’en lancer un autre : vos billets arrivent dès sa
     confirmation. », bouton « Suivre le paiement » (`components/payment/PendingPaymentBanner.tsx:107-133`). Le bandeau
     **disparaît à l'échéance des places** (`:90-101`).
   - **Le serveur refuse** tout second paiement de billets du même compte pour le même événement tant que le premier
     est « En attente », **même après l'échéance des places**, quel que soit l'onglet ou l'opérateur ; rien n'est créé,
     SamirPay n'est pas appelé (`M/20261109000007_lot9bis_versements.sql:731-744`,
     `lib/payments/checkout.service.ts:288-292`). La fenêtre affiche « Un paiement est déjà en attente » et « Suivre le
     paiement » (06.6). Après l'échéance, le bandeau a donc disparu alors que le refus continue jusqu'à 60 minutes
     (constat W6-01) : la page de suivi propose d'abord « Annuler ce paiement » (06.9, 06.13).
4. **Messages envoyés.** Aucun.
5. **Ce que voient les autres rôles.** Rien.
6. **Refus (texte exact).** « Un paiement est déjà en attente pour cet événement : suivez-le avant d’en lancer un
   autre. » (`lib/payments/payment-client.ts:217-218`).
7. **Preuves et essai.** Fichiers cités. NON VÉRIFIÉ en exécution (aucun essai dédié).

## 06.16 Succès tardif après l'échéance des places (H1)

1. **Qui, où.** La cliente valide dans Wave ou Orange Money **après** l'échéance des places, ou après avoir annulé, ou
   après un échec non définitif.
2. **Ce qu'il saisit.** Sa validation chez l'opérateur.
3. **Ce que fait le système.**
   - **Surveillance** : un paiement « Expiré », « Annulé » par la cliente ou « Échoué » non définitif, portant un
     identifiant SamirPay, est relu chez SamirPay au plus toutes les 15 minutes pendant **48 heures** après sa création
     (`app/api/cron/payments-reconcile/route.ts:49-60`, `lib/env.ts:78`) ; la page de suivi le relit aussi
     (`app/api/payments/[transactionId]/status/route.ts:13-14`, `:138-141`). Un « échoué » lu chez SamirPay ne devient
     définitif que 2 heures après la création (`lib/payments/confirmation.service.ts:44-48`, `:197-206`). Une demande
     dont SamirPay n'a rendu aucun identifiant (délai dépassé au lancement) reste rattrapable par l'avis de SamirPay, qui
     apporte l'identifiant (`lib/payments/webhook.service.ts:102-122`).
   - **Si SamirPay dit « payé »** : même confirmation qu'en 06.10. Si les places ne sont plus retenues, le système
     vérifie qu'il en reste assez **maintenant** : oui → billets émis normalement ; non (ou événement annulé, suspendu,
     terminé) → aucun billet, paiement « Remboursement en cours », remboursement **intégral** (prix + frais) sur le
     compte Mobile Money qui a payé (`M/20261106000003_lot8_paiement.sql:143-187`, `lib/payments/confirmation.service.ts:60-73`).
   - Page de suivi : « Paiement en cours de remboursement » / « Ce paiement n’a pas pu être honoré : {total} vous est
     reversé sur le compte {opérateur} qui a payé. » (pastille « Remboursement en cours », ou « Remboursement retardé »
     si le versement attend l'équipe : « Remboursement retardé, l’équipe Event Village s’en occupe. »), puis
     « Paiement remboursé » / « {total} a été reversé sur le compte {opérateur} qui a payé. »
     (`app/paiement/[id]/page.tsx:301-327`, `:821-827`).
4. **Messages envoyés.**

   | Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
   |---|---|---|---|---|
   | Acheteuse (compte et numéro du payeur) | SMS, cloche, push, email | Indispensable, envoyé même suspendu | À la création du remboursement | `PAYMENT_REFUND_STARTED` — SMS : « Event Village : paiement de {total} ("{titre}") sans billet possible : il vous est remboursé sur votre compte {opérateur}. » — ex. « Event Village : paiement de 23 625 F CFA ("Concert Test") sans billet possible : il vous est remboursé sur votre compte Wave. » (125 caractères) ; cloche « Remboursement de votre paiement » / « Votre paiement de 23 625 F CFA pour « Concert Test » a été reçu, mais aucun billet n'a pu être émis. Il vous est remboursé sur votre compte Wave : vous serez prévenu du versement. » |
   | Acheteuse | SMS, cloche, email, push | Indispensable | Au versement effectif | `REFUND_PAID` — SMS : « Event Village : remboursement de 23 625 F CFA versé sur votre compte Wave (Concert Test). » (89 caractères) ; cloche « Remboursement versé » / « 23 625 F CFA vous ont été remboursés sur votre compte Wave pour « Concert Test ». » |

   Preuves : `lib/notifications/catalog.ts:858-872`, `:1365-1390`, `M/20261109000007_lot9bis_versements.sql:394-410`.
   Billets émis normalement : messages de 06.10.
5. **Ce que voient les autres rôles.** Partenaire : rien si le paiement est remboursé (aucune vente). Administration :
   le versement de remboursement dans ses écrans (08).
6. **Refus.** Sans objet.
7. **Preuves et essai.** Fichiers cités. NON VÉRIFIÉ en exécution (SamirPay réel exigé).

## 06.17 Double paiement du même panier

1. **Qui, où.** Une même cliente a deux paiements réglés pour le **même panier** du même événement : par exemple un
   premier paiement expiré puis validé en retard (06.16) alors qu'elle avait déjà payé un second achat identique.
2. **Ce qu'il saisit.** Rien.
3. **Ce que fait le système** (`M/20261106000003_lot8_paiement.sql:1-8`, `:43-69`, `:168-193`) :
   - « même panier » = même compte, même événement, mêmes catégories avec les mêmes quantités, paiements en ligne de
     billets ; le paiement déjà réglé est conservé, le second (créé avant la confirmation du premier) est un double ; un
     rachat fait après une confirmation n'est jamais touché ; un paiement entièrement remboursé ne compte plus ;
   - le double ne passe jamais par « Confirmé » : ni billet, ni vente, ni commission ; « Remboursement en cours »,
     remboursement intégral sur le compte qui a payé, frais d'agrégateur à la charge d'Event Village.
4. **Messages envoyés.**

   | Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
   |---|---|---|---|---|
   | Acheteuse | SMS, cloche, push, email | Indispensable | À la création du remboursement | `PAYMENT_REFUND_STARTED` (double) — SMS : « Event Village : paiement en double de 23 625 F CFA ("Concert Test"), remboursé sur votre compte Wave. Vos billets restent valables. » (131 caractères) ; cloche « Remboursement de votre paiement » / « Un second paiement de 23 625 F CFA pour « Concert Test » a été encaissé pour le même panier. Il vous est remboursé sur votre compte Wave ; vos billets restent valables. » |
   | Admins ayant la permission « remboursements » | Cloche, push, email | Indispensable | Immédiat (file) | `ADMIN_DUPLICATE_PAYMENT` — « Paiement en double remboursé » / « Un second paiement de 23 625 F CFA a été encaissé pour le même panier : son remboursement au client est lancé. » (lien `/admin/finance`) |
   | Acheteuse | SMS, cloche… | Indispensable | Au versement | `REFUND_PAID` (06.16) |

   Preuves : `lib/notifications/catalog.ts:1219-1224`, `:1365-1390`, `M/20261106000003_lot8_paiement.sql:28-34`.
5. **Ce que voient les autres rôles.** Partenaire : une seule vente. Administration : alerte et remboursement (08).
6. **Refus.** Sans objet.
7. **Preuves et essai.** Fichiers cités. NON VÉRIFIÉ en exécution.

## 06.18 Prix minimum d'un billet payant

1. **Qui, où.** La partenaire (ou l'administration) qui crée une catégorie payante ou change son prix (04.5, 04.15).
2. **Ce qu'il saisit.** Le prix.
3. **Ce que fait le système.** Un prix payant (plus de 0) sous le minimum est refusé à la création ou quand le prix
   change ; 0 (gratuit) est toujours admis ; une catégorie existante dont le prix ne change pas n'est pas contrôlée.
   Minimum : réglage SUPERADMIN `finance.min_paid_price`, **100 F** à l'installation, entier de 1 à 100 000 ; un réglage
   illisible bloque l'écriture (`M/20261109000005_lot9bis_samirpay.sql:234-270`, `M/20261109000001_lot9bis_reglages.sql:35`,
   `app/admin/finance-settings/page.tsx:67`). Aide de l'écran SUPERADMIN : « Appliqué à toute catégorie payante créée
   ou dont le prix change ; un billet gratuit reste à 0. À ajuster quand SamirPay donnera son minimum d’encaissement.
   Entier de 1 à 100 000. »
   - Si SamirPay refuse quand même un montant trop petit (erreur serveur de SamirPay), la cliente lit « Le paiement n’a
     pas pu être lancé. Réessayez dans quelques minutes ; si le problème continue, contactez le support. » (06.19).
4. **Messages envoyés.** Aucun.
5. **Ce que voient les autres rôles.** Rien.
6. **Refus (texte exact).** « Le prix d’un billet payant est d’au moins {minimum} F CFA. Pour un billet gratuit,
   indiquez 0. » — ex. « Le prix d’un billet payant est d’au moins 100 F CFA. Pour un billet gratuit, indiquez 0. » ;
   minimum illisible : « Le prix d’un billet payant est inférieur au minimum autorisé. Pour un billet gratuit, indiquez
   0. » (`lib/events/event.service.ts:124-138`).
7. **Preuves et essai.** Fichiers cités. Aucun essai dédié.

## 06.19 Erreurs de SamirPay traduites pour la cliente (tableau)

Au lancement (06.6), chaque échec est classé ; la cliente ne voit jamais un code ni un texte de SamirPay
(`lib/samirpay/http-client.ts:200-211`, `lib/payments/cashin-init.ts:23-48`, `components/payment/PaymentModal.tsx:211-221`,
`:413-420`). Dans tous les cas d'échec, le paiement passe « Échoué » et les places sont rendues tout de suite
(`lib/payments/checkout.service.ts:332-341`).

| Réponse de SamirPay | Relancé ? | Échec définitif ? | Titre | Message exact |
|---|---|---|---|---|
| Refus explicite (400) | non | oui | « Paiement refusé » | « Paiement refusé par l’opérateur. Vérifiez le numéro et le solde du compte {Wave ou Orange Money}, ou choisissez l’autre opérateur. » |
| Clés refusées (401, 403) | non | oui | « Service de paiement indisponible » | « Le service de paiement ne répond pas : réessayez. » |
| Erreur interne de SamirPay (500 et plus), ex. montant sous son minimum | non | non (surveillé) | « Service de paiement indisponible » | « Le paiement n’a pas pu être lancé. Réessayez dans quelques minutes ; si le problème continue, contactez le support. » |
| Délai de 15 s dépassé ou coupure, sans réponse | **une fois**, même numéro de commande | non (surveillé) | « Service de paiement indisponible » | « Le service de paiement ne répond pas : réessayez. » |
| Numéro de commande déjà utilisé (409) avec l'identifiant existant | non | paiement « Annulé », surveillé | « Service de paiement indisponible » | « Le service de paiement ne répond pas : réessayez. » |
| 409 sans identifiant, route introuvable (404), réponse hors format | non | non (surveillé) | « Service de paiement indisponible » | « Le service de paiement ne répond pas : réessayez. » |

Une réponse 502 donne une nouvelle clé au prochain essai : un nouveau paiement est créé
(`lib/payments/payment-client.ts:197-204`). Preuves de la relance unique et de l'adoption : `lib/payments/cashin-init.ts:62-106`.

## 06.20 SamirPay ne répond pas (au lancement, pendant le suivi, à l'annulation)

1. **Qui, où.** La cliente, à n'importe quelle étape, pendant une panne de SamirPay.
2. **Ce qu'il saisit.** Rien de plus.
3. **Ce que fait le système.**
   - **Au lancement** : 15 secondes d'attente, une relance, puis échec affiché (06.19) ; places rendues ; si SamirPay a
     pourtant créé la demande et que la cliente paie, l'avis de SamirPay rattache le paiement et le succès est honoré
     ou remboursé (06.16).
   - **Pendant le suivi** : la lecture du statut chez SamirPay échoue en silence côté cliente ; la page reste « En
     attente » et continue ; après la validité de la demande + 2 minutes : « Confirmation non reçue » (06.9)
     (`lib/payments/confirmation.service.ts:163-172`).
   - **À l'annulation** : rien n'est annulé sans réponse de SamirPay : « Vérification impossible pour le moment :
     réessayez dans un instant. » (06.13).
   - **Avis de SamirPay perdu** : la tâche de réconciliation (toutes les 5 minutes, obligatoire) rattrape la
     confirmation (12.3).
4. **Messages envoyés.** Aucun de plus.
5. **Ce que voient les autres rôles.** L'administration voit les avis reçus et leur résultat dans le journal des avis
   de SamirPay (`lib/payments/webhook.service.ts:61-78`) ; écran : 11.11 (NON VÉRIFIÉ qu'un écran les affiche).
6. **Refus.** Voir 06.13, 06.19.
7. **Preuves et essai.** Fichiers cités. Aucun essai dédié.

## 06.21 Le circuit de l'argent : qui reçoit quoi, avec un exemple chiffré

1. **Qui, où.** Tout paiement en ligne de billets.
2. **Ce qu'il saisit.** Rien.
3. **Ce que fait le système.** Un seul module calcule la répartition, avec les taux lus dans les réglages au moment du
   paiement et recopiés sur lui (non rétroactif) (`M/20261101000003_lot3_moteur.sql:1-15`, `:47-119`,
   `M/20261109000007_lot9bis_versements.sql:768-794`) :
   - **frais de service** = par billet, prix × taux de service (5 %), arrondi au franc supérieur ; payés par
     l'acheteuse en plus du prix ;
   - **total payé** = prix des billets + frais de service : c'est le montant demandé à Wave ou Orange Money ;
   - **frais SamirPay (agrégateur)** = total payé × taux de l'opérateur (1,5 % pour Wave comme pour Orange Money à
     l'installation, réglages `finance.aggregator_fee_rate.WAVE` et `.ORANGE_MONEY`, 0 à 10 %), arrondi au centime ;
     c'est une **estimation** : SamirPay ne donne aucun frais réel sur un encaissement, les colonnes prévues restent vides
     (`M/20261109000005_lot9bis_samirpay.sql:9-11`, `M/20261101000002_lot3_reglages.sql:61-65`) ;
   - **part de la partenaire** = prix des billets (les frais de service ne lui reviennent jamais) ; elle est inscrite à
     son compte « Vente en ligne » dès la confirmation, **disponible** à la fin de l'événement + 48 h (réglages
     `finance.payout_hold_enabled` et `finance.payout_delay_hours` ; fin = fin saisie, sinon début + 6 h)
     (`M/20261101000004_lot3_grand_livre.sql:107-131`, `:263-301`, `M/20261102000003_lot5_cycle.sql` `fin_event_end`) ;
     elle la retire ensuite moyennant des frais de retrait (1 %, minimum 5 000 F, 03.19) ;
   - **revenu brut d'Event Village** = frais de service ; **revenu net** = frais de service − frais SamirPay ; les
     commissions de parrainage sont prises sur ce revenu net (09.5) ;
   - un **abonnement** n'a pas de frais de service et revient entièrement à Event Village ; une **vente au guichet en
     espèces** n'a ni frais, ni agrégateur, ni revenu pour Event Village (`M/20261101000003_lot3_moteur.sql:8-9`,
     `:151-161`).
   - **Exemple fictif.** Fatou achète pour « Concert Test » 2 « Standard » à 5 000 F, 1 « VIP » à 12 500 F et 1
     « Enfant » gratuit, et paie avec Wave (taux d'installation).

     | Ligne | Prix des billets | Frais de service | Total |
     |---|---|---|---|
     | 2 × Standard (5 000 F) | 10 000 F | 2 × 250 F = 500 F | 10 500 F |
     | 1 × VIP (12 500 F) | 12 500 F | 625 F | 13 125 F |
     | 1 × Enfant (gratuit) | 0 F | 0 F | 0 F |
     | **Panier** | **22 500 F** | **1 125 F** | **23 625 F payés par Fatou** |

     | Qui | Montant | Calcul |
     |---|---|---|
     | Wave débite Fatou | 23 625 F | total payé |
     | Frais SamirPay (estimés) | 354,38 F | 23 625 × 1,5 % = 354,375, arrondi au centime |
     | Partenaire (compte, disponible fin + 48 h) | 22 500 F | prix des billets |
     | Event Village, brut | 1 125 F | frais de service |
     | Event Village, net | 770,62 F | 1 125 − 354,38 |
     | Partenaire, si elle retire 22 500 F | reçoit 22 275 F | frais de retrait 1 % = 225 F (03.19) |

     Écran de Fatou : « Prix des billets 22 500 F CFA », « Frais de service (5 %) 1 125 F CFA », « Total à payer
     23 625 F CFA » ; SMS « … Frais de service 1 125 F CFA, total payé 23 625 F CFA. … » (06.10). Chaque billet garde son
     prix et ses frais (part remboursable d'un billet, 08) (`M/20261106000003_lot8_paiement.sql:196-216`).
   - **Remboursements** : qui supporte les frais SamirPay perdus (réglage `finance.cancellation_aggregator_fee_bearer`,
     Event Village à l'installation) et les autres cas : `08-argent.md`.
4. **Messages envoyés.** Ceux de 06.10.
5. **Ce que voient les autres rôles.** Partenaire : « Finances » (03.18) ; administration : rapprochement
   `/admin/finance` (08, 11.11).
6. **Refus.** Sans objet.
7. **Preuves et essai.** Fichiers cités. NON VÉRIFIÉ : la valeur réelle du taux de service sur event-village-dev (5 %
   à l'installation, ou la valeur de l'ancien réglage `ticketing_fee_config` s'il existait,
   `M/20261101000002_lot3_reglages.sql:59-63`). Recette : essai 17 (1 000 F → 50 F de frais, 1 050 F au total,
   `docs/recette-billetterie.md:610-625`), essai 56.

## 06.22 « Mes paiements » : l'historique de la cliente

1. **Qui, où.** Client connecté : « Mon profil » → « Mes paiements » (`/profile/payments`) (01.2,
   `app/profile/payments/page.tsx:77`).
2. **Ce qu'il saisit.** Rien (pagination).
3. **Ce que fait le système.** Indicateurs « Total payé » et « Total remboursé », liste des paiements avec cible
   (« Événement »…), opérateur, montant et statut (libellés de la règle commune ; « Remboursement retardé, l’équipe
   Event Village s’en occupe. » quand un remboursement attend l'équipe) ; chaque ligne ouvre `/paiement/{id}`
   (`app/profile/payments/page.tsx:100-140`, `lib/payments/payment-labels.ts:5-35`). Vide : « Aucun paiement pour le
   moment » / « Vos paiements apparaîtront ici dès votre premier achat. » ; erreur : « Vos paiements n’ont pas pu être
   chargés ».
4. **Messages envoyés.** Aucun.
5. **Ce que voient les autres rôles.** Rien.
6. **Refus.** Non connecté : « Connectez-vous pour voir vos paiements » (`:68-69`).
7. **Preuves et essai.** Fichiers cités. Recette : essai 69 (`docs/recette-billetterie.md:1506-1522`).

---

## NON VÉRIFIÉ (récapitulatif)

- QR rendu par SamirPay pour Wave (06.7) ; comportement des applications Wave et Orange Money au retour (06.11) ;
  prise en compte des adresses de retour par SamirPay (essai 85).
- Taux de service réel sur event-village-dev (06.21) ; frais réels de SamirPay sur un encaissement (non fournis).
- Panier mixte en exécution (06.5) ; second achat bloqué (06.15) ; succès tardif et double paiement réels (06.16,
  06.17).
- Écran d'administration listant les avis de SamirPay (06.20).
